# Forensic Learning Record (Deep Inspection): preset-io/agor

> **Canonical Artifact**: `07_PROJECT_LEARNING/preset-io-agor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/preset-io/agor](https://github.com/preset-io/agor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:27.064Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `preset-io/agor`
- **Description**: Agor - team command center for all things agentic
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1419 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/agor-cli/bin/dev.ts`
```
#!/usr/bin/env tsx

import { execute } from '@oclif/core';

// Use tsx to run TypeScript source directly in dev mode
await execute({ development: true, dir: import.meta.url });

```

### Core Architecture Module: `apps/agor-cli/bin/run.js`
```
#!/usr/bin/env node

import { execute } from '@oclif/core';

await execute({ development: false, dir: import.meta.url });

```

### Core Architecture Module: `apps/agor-cli/src/base-command.ts`
```
/**
 * Base Command - Shared logic for all Agor CLI commands
 *
 * Reduces boilerplate by providing common functionality like daemon connection checking.
 */

import type { AgorClient, AuthenticatedAgorClient } from '@agor-live/client';
import { createRestClient, getApiKeyFromEnv } from '@agor-live/client';
import { Command } from '@oclif/core';
import chalk from 'chalk';
import { loadToken } from './lib/auth';
import { probeAgorDaemon } from './lib/daemon-probe.js';
import {
  resolveConnectedDeploymentTarget,
  resolveLocalDeploymentTarget,
} from './lib/deployment-target.js';

/**
 * Base command with daemon connection utilities
 */
export abstract class BaseCommand extends Command {
  protected daemonUrl: string | null = null;
  protected deploymentId: string | null = null;

  /**
   * Connect to daemon (checks if running first)
   *
   * @returns Feathers client instance
   */
  protected async connectToDaemon(): Promise<AuthenticatedAgorClient> {
    const storedAuth = await loadToken();
    const apiKey = getApiKeyFromEnv();
    const target = await resolveConnectedDeploymentTarget();
    if (!target) {
      this.error(
        chalk.red('✗ Not authenticated') +
          '\n\n' +
          chalk.dim('Run:') +
          '\n  ' +
          chalk.cyan('agor login --url <daemon-url>')
      );
    }
    const daemonUrl = target.url;
    this.daemonUrl = daemonUrl;
    this.deploymentId = target.deploymentId;
    const probe = await probeAgorDaemon(daemonUrl);

    if (!probe.running) {
      this.log(
        chalk.red('✗ Connected deployment is not reachable') +
          '\n\n' +
          chalk.gray(`Target: ${this.daemonUrl}`) +
          (target.source === 'environment'
            ? '\n\nCheck AGOR_API_KEY, DAEMON_URL, and AGOR_DEPLOYMENT_ID.'
            : `\n\nSelect another deployment with:\n  ${chalk.cyan('agor login --url <daemon-url>')}`)
      );
      this.exit(1);
    }

    if (target.pinDeployment && probe.deploymentId !== target.deploymentId) {
      this.error(
        `The daemon identity at ${daemonUrl} changed. Run agor login --url ${daemonUrl} again.`
      );
    }
    // API key auth (environment, then a stored `login --api-key`) is sent as a
    // bearer on every request and takes precedence over a stored JWT.
    const effectiveApiKey = apiKey ?? target.apiKey;
    if (effectiveApiKey) {
      return await createRestClient(daemonUrl, effectiveApiKey);
    }

    if (storedAuth?.version !== 2) {
      this.error(`${chalk.red('✗ Not authenticated')}\n\nRun:\n  ${chalk.cyan('agor login')}`);
    }

    // Create REST-only client (prevents hanging processes)
    const client = await createRestClient(daemonUrl);

    // Load stored authentication token
    try {
      await client.authenticate({
        strategy: 'jwt',
        accessToken: storedAuth.accessToken,
      });
    } catch (_error) {
      // Token invalid or expired - clear it and show login prompt
      const { clearToken } = await import('./lib/auth');
      await clearToken();
      this.error(
        chalk.red('✗ Authentication failed') +
          '\n\n' +
          chalk.dim('Your session has expired or is invalid.') +
          '\n' +
          chalk.dim('Please login again:') +
          '\n  ' +
          chalk.cyan('agor login')
      );
    }

    return client;
  }

  /** Connect to the authenticated daemon for this machine's local deployment. */
  protected async connectToLocalDaemon(): Promise<AuthenticatedAgorClient> {
    const localTarget = await resolveLocalDeploymentTarget();
    const connectedTarget = await resolveConnectedDeploymentTarget();
    if (!connectedTarget || connectedTarget.deploymentId !== localTarget.deploymentId) {
      this.error(
        chalk.red('✗ Local deployment authentication required') +
          "\n\nAuthenticate with this machine's deployment first:\n  " +
          chalk.cyan('agor login --local')
      );
    }
    return await this.connectToDaemon();
  }

  /**
   * Cleanup client connection
   *
   * Ensures socket is properly closed to prevent hanging processes
   */
  protected async cleanupClient(client: AgorClient): Promise<void> {
    // Disable reconnection before closing to prevent new connection attempts
    client.io.io.opts.reconnection = false;

    // Remove all event listeners to prevent them from keeping process alive
    client.io.removeAllListeners();

    // Close the socket connection
    client.io.close();

    // Give a brief moment for cleanup, then force exit
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/commands/board/add-session.ts`
```
/**
 * Add a session's branch to a board
 *
 * Note: Sessions are now organized through branches. This command adds
 * the session's branch to the board, which will display all sessions
 * associated with that branch.
 */

import type { Board, BoardEntityObject, Branch, Session } from '@agor-live/client';
import { PAGINATION, shortId } from '@agor-live/client';
import { Args } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand } from '../../base-command';

export default class BoardAddSession extends BaseCommand {
  static override description =
    "Add a session's branch to a board (sessions are organized through branches)";

  static override examples = [
    '<%= config.bin %> <%= command.id %> default 0199b86c',
    '<%= config.bin %> <%= command.id %> 0199b850 0199b86c-10ab-7409-b053-38b62327e695',
  ];

  static override args = {
    boardId: Args.string({
      description: 'Board ID or slug',
      required: true,
    }),
    sessionId: Args.string({
      description: 'Session ID (short or full)',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(BoardAddSession);
    const client = await this.connectToDaemon();

    try {
      // Find board by ID or slug
      const boards = await client
        .service('boards')
        .findAll({ query: { $limit: PAGINATION.DEFAULT_LIMIT } });

      const board = boards.find(
        (b: Board) =>
          b.board_id === args.boardId ||
          b.board_id.startsWith(args.boardId) ||
          b.slug === args.boardId
      );

      if (!board) {
        await this.cleanupClient(client);
        this.error(`Board not found: ${args.boardId}`);
      }

      // Find session by short or full ID
      const sessions = await client
        .service('sessions')
        .findAll({ query: { $limit: PAGINATION.DEFAULT_LIMIT } });

      const session = sessions.find(
        (s: Session) => s.session_id === args.sessionId || s.session_id.startsWith(args.sessionId)
      );

      if (!session) {
        await this.cleanupClient(client);
        this.error(`Session not found: ${args.sessionId}`);
      }

      // Get branch for this session
      if (!session.branch_id) {
        await this.cleanupClient(client);
        this.error('Session has no branch associated');
      }

      const branches = await client
        .service('branches')
        .findAll({ query: { $limit: PAGINATION.DEFAULT_LIMIT } });

      const branch = branches.find((w: Branch) => w.branch_id === session.branch_id);

      if (!branch) {
        await this.cleanupClient(client);
        this.error('Branch not found for session');
      }

      // Check if branch is already on the board
      const boardObjects = await client.service('board-objects').findAll({
        query: {
          board_id: board.board_id,
        },
      });
      const typedBoardObjects = boardObjects as BoardEntityObject[];

      const existingObject = typedBoardObjects.find(
        (bo: BoardEntityObject) => bo.branch_id === branch.branch_id
      );

      if (existingObject) {
        this.log(chalk.yellow(`⚠ Branch "${branch.name}" already on board "${board.name}"`));
        await this.cleanupClient(client);
        return;
      }

      // Add branch to board via board_objects
      await client.service('board-objects').create({
        board_id: board.board_id,
        branch_id: branch.branch_id,
        position: { x: 100, y: 100 },
      });

      this.log(
        chalk.green(
          `✓ Added branch "${branch.name}" (containing session ${shortId(session.session_id)}) to board "${board.name}"`
        )
      );
    } catch (error) {
      await this.cleanupClient(client);
      this.error(
        `Failed to add session to board: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.cleanupClient(client);
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/commands/board/clone.ts`
```
import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command';

export default class BoardClone extends BaseCommand {
  static override description = 'Clone an existing board with a new name';

  static override examples = [
    '<%= config.bin %> <%= command.id %> <board-id-or-slug> "Sprint 43 Planning"',
    '<%= config.bin %> <%= command.id %> sprint-42 "Sprint 42 (Copy)"',
  ];

  static override args = {
    board: Args.string({
      description: 'Board ID or slug to clone',
      required: true,
    }),
    name: Args.string({
      description: 'Name for the cloned board',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(BoardClone);
    const { board, name } = args;

    const client = await this.connectToDaemon();

    try {
      const boardsService = client.service('boards');

      const clonedBoard = await boardsService.clone({ id: board, name });

      this.log(`Board cloned: ${clonedBoard.name} (${clonedBoard.board_id})`);
    } catch (error) {
      await this.cleanupClient(client);
      this.error(
        `Failed to clone board: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.cleanupClient(client);
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/commands/board/export.ts`
```
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command';

export default class BoardExport extends BaseCommand {
  static override description = 'Export a board to YAML or JSON';

  static override examples = [
    '<%= config.bin %> <%= command.id %> <board-id-or-slug> -o sprint-planning.yaml',
    '<%= config.bin %> <%= command.id %> <board-id-or-slug> -o sprint-planning.json --format json',
    '<%= config.bin %> <%= command.id %> <board-id-or-slug> # outputs to stdout',
  ];

  static override flags = {
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Export format (yaml or json)',
      options: ['yaml', 'json'],
      default: 'yaml',
    }),
  };

  static override args = {
    board: Args.string({
      description: 'Board ID or slug',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BoardExport);
    const { board } = args;
    const { output, format } = flags;

    const client = await this.connectToDaemon();

    try {
      const boardsService = client.service('boards');

      // Export based on format
      let content: string;
      if (format === 'json') {
        const blob = await boardsService.toBlob({ id: board });
        content = JSON.stringify(blob, null, 2);
      } else {
        content = await boardsService.toYaml({ id: board });
      }

      // Output to file or stdout
      if (output) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(output, content, 'utf-8');
        this.log(`Board exported to ${output}`);
      } else {
        this.log(content);
      }
    } catch (error) {
      await this.cleanupClient(client);
      this.error(
        `Failed to export board: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.cleanupClient(client);
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/commands/board/import.ts`
```
import { type BoardImportResult, summarizeBoardImportSkips } from '@agor-live/client';
import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command';

export default class BoardImport extends BaseCommand {
  static override description = 'Import a board from YAML or JSON file';

  static override examples = [
    '<%= config.bin %> <%= command.id %> sprint-planning.yaml',
    '<%= config.bin %> <%= command.id %> sprint-planning.json',
    'cat sprint-planning.yaml | <%= config.bin %> <%= command.id %> # from stdin',
  ];

  static override args = {
    file: Args.string({
      description: 'Path to YAML or JSON file (omit to read from stdin)',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(BoardImport);
    const { file } = args;

    const client = await this.connectToDaemon();

    try {
      const boardsService = client.service('boards');

      // Read content from file or stdin
      let content: string;
      if (file) {
        const fs = await import('node:fs/promises');
        content = await fs.readFile(file, 'utf-8');
      } else {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8');
      }

      // Import based on content (JSON or YAML)
      let board: BoardImportResult;
      try {
        // Try parsing as JSON first
        const blob = JSON.parse(content);
        board = await boardsService.fromBlob(blob);
      } catch {
        // If JSON parse fails, treat as YAML
        board = await boardsService.fromYaml({ yaml: content });
      }

      this.log(`Board imported: ${board.name} (${board.board_id})`);
      const skippedSummary = summarizeBoardImportSkips(board.import_skipped);
      if (skippedSummary) {
        this.warn(skippedSummary);
        for (const skipped of board.import_skipped ?? []) {
          this.log(`  - ${skipped.object_id}: ${skipped.detail}`);
        }
      }
    } catch (error) {
      await this.cleanupClient(client);
      this.error(
        `Failed to import board: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.cleanupClient(client);
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/commands/board/list.ts`
```
/**
 * List all boards
 */

import type { BoardEntityObject } from '@agor-live/client';
import { PAGINATION, shortId } from '@agor-live/client';
import { Flags } from '@oclif/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { BaseCommand } from '../../base-command';

export default class BoardList extends BaseCommand {
  static override description = 'List all boards';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    limit: Flags.integer({
      char: 'l',
      description: 'Maximum number of boards to show',
      default: PAGINATION.CLI_DEFAULT_LIMIT,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(BoardList);
    const client = await this.connectToDaemon();

    try {
      // Fetch all boards (high limit for accurate counts)
      const allBoards = await client
        .service('boards')
        .findAll({ query: { $limit: PAGINATION.DEFAULT_LIMIT } });

      if (allBoards.length === 0) {
        this.log(chalk.yellow('No boards found.'));
        await this.cleanupClient(client);
        return;
      }

      // Fetch all board objects to count branches per board
      const boardObjects = await client
        .service('board-objects')
        .findAll({ query: { $limit: PAGINATION.DEFAULT_LIMIT } });
      const typedBoardObjects = boardObjects as BoardEntityObject[];

      // Apply display limit
      const displayBoards = allBoards.slice(0, flags.limit);

      // Create table
      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Name'),
          chalk.cyan('Branches'),
          chalk.cyan('Description'),
          chalk.cyan('Created'),
        ],
        colWidths: [12, 20, 12, 40, 12],
        wordWrap: true,
      });

      // Add rows
      for (const board of displayBoards) {
        const branchCount = typedBoardObjects.filter((bo) => bo.board_id === board.board_id).length;
        table.push([
          shortId(board.board_id),
          `${board.icon || '📋'} ${board.name}`,
          branchCount.toString(),
          board.description || '',
          new Date(board.created_at).toLocaleDateString(),
        ]);
      }

      this.log(table.toString());
      if (displayBoards.length < allBoards.length) {
        this.log(chalk.gray(`\nShowing ${displayBoards.length} of ${allBoards.length} board(s)`));
      } else {
        this.log(chalk.gray(`\nShowing ${displayBoards.length} board(s)`));
      }
    } catch (error) {
      await this.cleanupClient(client);
      this.error(
        `Failed to fetch boards: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.cleanupClient(client);
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2874** (2026-09-26): **Cross-branch (remote_create) session archive cascade still leaves subsessions behind**
  *Symptoms*: ### Summary  Archiving a session still doesn't reliably cascade-archive all of its subsessions in every case. This is a known, explicitly-documented gap in the current cascade implementation, not a new bug.  ### Background  This is the third report of the same underlying complaint: - #1747 (closed via #1842, 2026-07-09) — added cascade for the dedicated archive/unarchive route, covering same-branch `parent_session_id`/`forked_from_session_id` descendants only. - #2661 (closed via #2678, 2026-09-08) — extended cascade to bulk archive, branch archive, and BTW-completion cleanup, still scoped to **branch-local** genealogy only. - A broader alternative, #2671 ("route every archive path through one cascade engine"), would have additionally cascaded cross-branch `remote_create` relationships (i.e. sessions spawned/forked into a *different* branch/worktree) by default. That PR was closed unmerged in favor of the narrower #2678, and cross-branch cascade was explicitly punted:    > Out of scope / follow-ups: Cross-branch `remote_create` lifecycle ownership  ### Steps to reproduce  1. Create a session that spawns/forks a child session into a **different branch/worktree** (a `remote_create` relationship), or a gateway-linked child session. 2. Archive the parent session (or its branch). 3. Observe the cross-branch/gateway-linked child session(s) remain active — user has to manually archive each one.  ### Expected  Archiving a parent cascades to cross-branch/gateway-linked descendants too
  **Post-Mortem & Fix Analysis**:
  > I think I fixed that recently, problem seemed limited to foreign-branch child. Should be fixed. Reopen if not.

- **Issue #2810** (2026-09-23): **UI crash: unknown component — Cannot read properties of undefined (reading 'trim')**
  *Symptoms*: ## UI crash report  - **When:** 2026-09-22T11:33:08.542Z - **Where:** https://agor.sandbox.preset.zone/ui/s/01a0226137a67389bb7bde56/ - **Component:** unknown component - **User:** amin@preset.io - **Build:** 49e3d3da3 - **Browser:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 - **Error:** Cannot read properties of undefined (reading 'trim')  ### Component stack ``` at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:10:2161     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:29:15889     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:8833     at div (<anonymous>)     at f (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:851)     at div (<anonymous>)     at Be (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:16480)     at div (<anonymous>)     at Cn (https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:14197)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:16540     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:24237     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.pres

- **Issue #2809** (2026-09-23): **UI crash: unknown component — Cannot read properties of undefined (reading 'trim')**
  *Symptoms*: ## UI crash report  - **When:** 2026-09-22T10:52:17.896Z - **Where:** https://agor.sandbox.preset.zone/ui/s/01a0c8bd320074779c69e888/ - **Component:** unknown component - **User:** amin@preset.io - **Build:** 49e3d3da3 - **Browser:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 - **Error:** Cannot read properties of undefined (reading 'trim')  ### Component stack ``` at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:10:2161     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:29:15889     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:8833     at div (<anonymous>)     at f (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:851)     at div (<anonymous>)     at Be (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:16480)     at div (<anonymous>)     at Cn (https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:14197)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:16540     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:24237     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.pres

- **Issue #2738** (2026-09-14): **Stop on a remote task whose executor has not connected fails instantly with a misleading 15 s quiescence timeout**
  *Symptoms*: ## Summary  On Agor Cloud (templated/remote executors), pressing Stop while the target task's executor pod has not connected yet immediately fails with:  > Remote executor did not acknowledge quiescence for this termination request within 15000ms. Agor could not verify that this executor stopped. It may still be running and writing to the branch. A branch owner or administrator may force-fail Task …  No wait actually happens, and the wording claims a 15 s timeout elapsed. The session is left guarded in `stopping` with a force-fail prompt for a pod that has not even started. Reliably reproducible when queued messages exist. Never seen in local mode.  ## Steps to reproduce  1. On an Agor Cloud workspace, start a prompt and queue one or more messages while it runs. 2. Press Stop. The active task stops and, because Stop preserves the queue, the next queued message is dispatched immediately as a new executor pod. 3. Press Stop again while that pod is still starting (task status `dispatching`). 4. Observe the immediate "did not acknowledge quiescence within 15000ms" notice and the force-fail offer.  Variant: queue messages while the very first pod is still starting, then press Stop once.  ## Root cause  - `waitForExecutorQuiescence` in the termination coordinator returns immediately when the task has no `executor_connected_at`. - The remote branch of `runContainment` then reports "within N ms" using the configured cooperative grace (15 s for templated executors) instead of the meas

- **Issue #2699** (2026-09-08): **Teammate session tree capped at 400px regardless of container height (regression from #2687)**
  *Symptoms*: ## Summary The session tree/list in the teammate panel (`BoardTeammatePanel`, rendered via `BranchSessionSections.tsx`, also shared by `BranchCard`) used to size to its container's full height. It now renders at a fixed **400px** regardless of the container's actual height or how many sessions there are — so on a taller viewport/panel, the list only fills part of the available space instead of the full height.  ## Regression source Introduced by [#2687](https://github.com/preset-io/agor/pull/2687) `fix: bound worktree session lists and correct MCP pagination` (merged 2026-09-07), which added:  ```ts // apps/agor-ui/src/components/BranchCard/branchCardLayout.ts export const BRANCH_SESSION_VIEWPORT_HEIGHT = 400; ```  used as a fixed `height` prop on the AntD `Tree` in `BranchSessionSections.tsx` (line ~986). Before this PR, the tree had no explicit `height`, so it sized naturally to its container. The 400px value was intentionally chosen as a shared viewport constant to bound virtualization/rendering cost (see the PR's investigation notes) — but it's a hardcoded pixel value, not derived from the actual available container height, so it under-fills taller panels.  Two follow-up PRs merged since ([#2692](https://github.com/preset-io/agor/pull/2692), [#2693](https://github.com/preset-io/agor/pull/2693)) adjusted zoom/wheel behavior around the same component but did not touch this constant.  ## Steps to reproduce 1. Open a teammate's panel/drawer (`BoardTeammatePanel`) on a board, 

- **Issue #2672** (2026-09-05): **Discord gateway channel save fails: "Missing tenant context for multi_tenancy.required_from_auth"**
  *Symptoms*: ## Summary  Creating/saving a Discord gateway bot channel on hosted Agor Cloud fails with:  ``` Save failed: Missing tenant context for multi_tenancy.required_from_auth ```  Reported by Richard (richard.fogaca@preset.io) via Slack #agor-cloud, 2026-09-04. Richard flagged that this might not be Discord-specific — worth checking Slack/Teams gateway channel creation too.  ## Source of the error  `resolveTenantContext` in [`packages/core/src/config/multitenancy.ts`](https://github.com/preset-io/agor/blob/main/packages/core/src/config/multitenancy.ts#L257) throws this exact string when it can't find a tenant candidate from the auth claim, trusted header, or `params`, in `required_from_auth` mode (hosted Cloud only — never reproducible locally in static single-tenant mode).  It's normally invoked as a before-hook (`ensureTenantContext`/`scopeTenantBefore` in `apps/agor-daemon/src/register-hooks.ts`) for services on `TENANT_OWNED_SERVICE_PATHS`. The gateway-channels write path (`apps/agor-daemon/src/services/gateway-channels.ts`) has its own `withTenantDatabase` helper that falls back to `getCurrentTenantId()` when `params.tenant.tenant_id` isn't set — so this looks like a code path where neither the hook nor the AsyncLocalStorage-based fallback has tenant context by the time a DB touch happens during Discord channel save (possibly the provider-probe/installation-verification step in `patchWithVerifiedDiscordInstallation`, which explicitly documents deferring provider calls to *afte

- **Issue #2661** (2026-09-08): **Archive cascade doesn't cover bulk/branch archive paths or gateway session relationships**
  *Symptoms*: ### Summary  #1747 fixed session-archive cascade (parent → child) for the dedicated archive/unarchive route (UI + MCP `agor_sessions_archive`/`unarchive`), landed in #1842. That PR's own notes call out that cascade is scoped narrowly and several other archive paths still leave subsessions behind:  - Generic `sessions.patch({ archived })` — unchanged, no cascade. - Bulk archive — unchanged, no cascade. - Branch archive / cleanup — unchanged, no cascade. - Gateway-linked sessions connected via `remote_relationships` (rather than branch-local `parent_session_id`/`forked_from_session_id`) — not covered by the cascade logic at all.  ### Steps to reproduce  1. Archive a parent session through one of the non-covered paths above (e.g. bulk-archive multiple sessions including a parent, or archive the whole branch, or archive a gateway session with linked children). 2. Observe that only the targeted session(s) are archived; branch-local or gateway-linked children remain active/unarchived.  ### Expected  Any archive path that removes a parent session from active view should cascade to its descendant sessions the same way the dedicated archive route does (or explicitly document why a given path is exempt).  ### Actual  Cascade only applies via the dedicated `POST /sessions/:id/archive` (and MCP archive/unarchive) path. Other paths silently leave orphaned active children.  ### Blockers / Dependencies  None — this extends the cascade helper introduced in #1842 to additional call sites; no 

- **Issue #2645** (2026-09-08): **Worktree session list has no cap — unbounded length with thousands of sessions**
  *Symptoms*: ## Bug  A worktree with a very large number of sessions (thousands) renders its full session list with no cap, pagination, or virtualization — the list grows unbounded on the page.  ## Expected  Cap or paginate/virtualize the worktree session list so it stays performant and usable regardless of session count.  ## Reported by  Amin, via #agor Slack thread, 2026-08-31.
  **Post-Mortem & Fix Analysis**:
  > Closing as addressed by merged #2687, which virtualizes session trees, bounds flat-list pages, and corrects MCP pagination. Merged #2689 subsequently improves session-inventory visibility query performance. Broader hydration costs remain separately documented follow-ups.

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

### Incident Patch 1: `67c8e714` (2026-09-30)
**Commit Message**: fix(repos): confine repository paths and Git remotes to the caller's tenant (#2934)

- Hosted mode accepts only network Git remotes (HTTPS, SSH, git://, SCP
  syntax) for clone and repo remote_url writes; local transports are rejected.
- Repository local_path is server-owned: hosted create must match the
  tenant-derived managed path, and it can no longer change after registration.
- The origin realign executor receives the tenant repos root and refuses any
  repository path outside it after resolving symlinks.
- Repo slugs reject "." and ".." path segments.

**File**: `apps/agor-daemon/src/services/hosted-repo-policy.test.ts` (modified, +114/-0)
```diff
@@ -129,6 +129,120 @@ describe('hosted repository storage policy canonical boundaries', () => {
     );
   });
 
+  describe('tenant filesystem confinement', () => {
+    const attackerParams = {
+      provider: 'rest',
+      user: { user_id: '550e8400-e29b-41d4-a716-446655440004', role: 'member' },
+      tenant: { tenant_id: 'attacker' },
+    } as never;
+    const victimRepo = '/home/agor/.agor/tenants/victim/repos/acme/private-source';
+    const victimCheckout = '/home/agor/.agor/tenants/victim/worktrees/acme/private-source/main';
+
+    function hostedService() {
+      return new ReposService(
+        {} as never,
+        { get: () => ({}), service: vi.fn() } as unknown as Application
+      );
+    }
+
+    it.each([`file://${victimRepo}`, victimRepo])(
+      'rejects a local clone source (%s) before creating any row',
+      async (url) => {
+        const service = hostedService();
+        const create = vi.spyOn(service, 'create');
+
+        await expect(
+          service.cloneRepository({ url, slug: 'attacker/copied-private-source' }, attackerParams)
+        ).rejects.toThrow(/HTTPS or SSH/);
+        expect(create).not.toHaveBeenCalled();
+      }
+    );
+
+    it('rejects a caller-selected local_path on create', async () => {
+      const adapterCreate = vi.spyOn(DrizzleService.prototype, 'create');
+
+      await expect(
+        hostedService().create(
+          {
+            slug: 'attacker/copy' as never,
+            repo_type: 'remote',
+            remote_url: 'https://forge.example/attacker/copy.git',
+            local_path: victimRepo,
+          },
+          attackerParams
+        )
+      ).rejects.toThrow(/local_path is managed by Agor/);
+      expect(adapterCreate).not.toHaveBeenCalled();
+    });
+
+    it('rejects a local remote_url on create', async () => {
+      await expect(
+        hostedService().create(
+          {
+            slug: 'attacker/copy' as never,
+            repo_type: 'remote',
+            remote_url: `file://${victimRepo}`,
+          },
+          attackerParams
+        )
+      ).rejects.toThrow(/HTTPS or SSH/);
+    });
+
+    it('rejects repointing an owned row at another tenant checkout', async () => {
+      const service = hostedService();
+      vi.spyOn(service, 'get').mockResolvedValue({
+        repo_id: 'repo-1',
+        repo_type: 'remote',
+        slug: 'attacker/copy',
+        local_path: '/home/agor/.agor/tenants/attacker/repos/attacker/copy',
+      } as Repo);
+      const adapterPatch = vi.spyOn(DrizzleService.prototype, 'patch');
+      const adapterUpdate = vi.spyOn(DrizzleService.prototype, 'update');
+
+      await expect(
+        service.patch(
+          'repo-1',
+          { local_path: victimCheckout, remote_url: 'https://attacker.example/drop.git' },
+          attackerParams
+        )
+      ).rejects.toThrow(/local_path is managed by Agor/);
+      await expect(
+        service.update('repo-1', { local_path: victimCheckout }, attackerParams)
+      ).rejects.toThrow(/local_path is managed by Agor/);
+      await expect(
+        service.patch(null, { local_path: victimCheckout }, attackerParams)
+      ).rejects.toThrow(/local_path is managed by Agor/);
+      expect(adapterPatch).not.toHaveBeenCalled();
+      expect(adapterUpdate).not.toHaveBeenCalled();
+    });
+
+    it('rejects a local remote_url patch', async () => {
+      await expect(
+        hostedService().patch(
+          'repo-1',
+          { remote_url: 'file:///home/agor/.agor/tenants/attacker/drop.git' },
+          attackerParams
+        )
+      ).rejects.toThrow(/HTTPS or SSH/);
+    });
+
+    it('accepts the executor re-sending the unchanged managed path', async () => {
+      const localPath = '/home/agor/.agor/tenants/attacker/repos/attacker/copy';
+      const service = hostedService();
+      vi.spyOn(service, 'get').mockResolvedValue({
+        repo_id: 'repo-1',
+        repo_type: 'remote',
+        local_path: localPath,
+      } as R
```

**File**: `apps/agor-daemon/src/services/repos.ts` (modified, +85/-25)
```diff
@@ -47,7 +47,11 @@ import {
   NotAuthenticated,
   NotFound,
 } from '@agor/core/feathers';
-import { redactGitUrlCredentials, stripGitUrlCredentials } from '@agor/core/git/pure';
+import {
+  assertNetworkGitRemoteUrl,
+  redactGitUrlCredentials,
+  stripGitUrlCredentials,
+} from '@agor/core/git/pure';
 import type {
   AuthenticatedParams,
   Branch,
@@ -200,13 +204,20 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
   ): Promise<Repo | Repo[]> {
     const rows = Array.isArray(data) ? data : [data];
     for (const row of rows) this.validateCleanupPolicyWrite(row, params);
-    if (
-      resolveMultiTenancyConfig(this.app.get('config')).mode === 'required_from_auth' &&
-      rows.some((row) => row.repo_type === 'local')
-    ) {
-      throw new BadRequest(
-        'Local repository registration is unavailable in hosted multi-tenant mode.'
-      );
+    if (this.isHostedMultiTenancy()) {
+      if (rows.some((row) => row.repo_type === 'local')) {
+        throw new BadRequest(
+          'Local repository registration is unavailable in hosted multi-tenant mode.'
+        );
+      }
+      for (const row of rows) {
+        this.validateHostedRemoteUrlWrite(row);
+        // Managed storage is derived from the authenticated tenant and slug; a
+        // caller-chosen path would become filesystem authority for Git executors.
+        if (row.local_path != null && row.local_path !== this.managedRepoPath(row.slug, params)) {
+          throw new BadRequest('local_path is managed by Agor and cannot be set.');
+        }
+      }
     }
     return super.create(data, params);
   }
@@ -217,30 +228,76 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
     params?: RepoParams
   ): Promise<Repo | Repo[]> {
     this.validateCleanupPolicyWrite(data, params);
-    if (
-      data.repo_type === 'local' &&
-      resolveMultiTenancyConfig(this.app.get('config')).mode === 'required_from_auth'
-    ) {
-      if (!id) {
-        throw new BadRequest(
-          'Bulk conversion to local repositories is unavailable in hosted multi-tenant mode.'
-        );
-      }
-      const current = await this.get(id, params);
-      if (current.repo_type !== 'local') {
-        throw new BadRequest(
-          'Local repository registration is unavailable in hosted multi-tenant mode.'
-        );
-      }
-    }
+    await this.validateRepoLocationWrite(id, data, params);
     return super.patch(id, data, params);
   }
 
   override async update(id: string, data: Partial<Repo>, params?: RepoParams): Promise<Repo> {
     this.validateCleanupPolicyWrite(data, params);
+    await this.validateRepoLocationWrite(id, data, params);
     return super.update(id, data, params);
   }
 
+  /**
+   * `local_path` is fixed when a repository is registered: rewriting it would
+   * aim every later Git executor (origin realign, branch materialization,
+   * sandbox mounts) at an arbitrary daemon-readable repository. Hosted
+   * deployments additionally require network remotes and forbid local rows.
+   */
+  private async validateRepoLocationWrite(
+    id: string | null,
+    data: Partial<Repo>,
+    params?: RepoParams
+  ): Promise<void> {
+    const hosted = this.isHostedMultiTenancy();
+    if (hosted) this.validateHostedRemoteUrlWrite(data);
+    const becomesLocal = hosted && data.repo_type === 'local';
+    const setsLocalPath = Object.hasOwn(data, 'local_path');
+    if (!becomesLocal && !setsLocalPath) return;
+    if (!id) {
+      throw new BadRequest(
+        becomesLocal
+          ? 'Bulk conversion to local repositories is unavailable in hosted multi-tenant mode.'
+          : 'local_path is managed by Agor and cannot be changed.'
+      );
+    }
+    const current = await this.get(id, params);
+    if (setsLocalPath && data.local_path !== current.local_path) {
+      throw new BadRequest('local_path is managed by Agor and cannot be changed.');
+    }
+    if (becomes
```

**File**: `apps/agor-daemon/src/utils/realign-repo-origin.test.ts` (modified, +27/-0)
```diff
@@ -11,6 +11,11 @@ vi.mock('./spawn-executor.js', () => ({
   spawnExecutorFireAndForget: vi.fn(),
 }));
 
+vi.mock('@agor/core/config', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@agor/core/config')>()),
+  getReposDir: vi.fn((tenantId?: string) => `/tenants/${tenantId ?? 'default'}/repos`),
+}));
+
 type RepoStub = {
   repo_id: string;
   slug: string;
@@ -91,6 +96,28 @@ describe('ensureRepoOriginAligned', () => {
         repoPath: '/tmp/repo',
         remoteUrl: 'https://github.com/owner/repo.git',
         repoSlug: 'owner/repo',
+        reposRoot: '/tenants/default/repos',
+      },
+    });
+  });
+
+  it("bounds the executor to the caller tenant's repos root", async () => {
+    await ensureRepoOriginAlignedForRepo(
+      makeApp(undefined),
+      {
+        repo_id: '550e8400-e29b-41d4-a716-446655440002',
+        slug: 'attacker/copy',
+        repo_type: 'remote',
+        remote_url: 'https://attacker.example/drop.git',
+        local_path: '/tenants/victim/repos/acme/private',
+      } as never,
+      { tenant: { tenant_id: 'attacker' } } as never
+    );
+
+    expect(spawnMock.mock.calls[0]?.[0]).toMatchObject({
+      params: {
+        repoPath: '/tenants/victim/repos/acme/private',
+        reposRoot: '/tenants/attacker/repos',
       },
     });
   });
```

**File**: `apps/agor-daemon/src/utils/realign-repo-origin.ts` (modified, +5/-0)
```diff
@@ -1,3 +1,5 @@
+import { getReposDir } from '@agor/core/config';
+import { getCurrentTenantId } from '@agor/core/db';
 import type { Application } from '@agor/core/feathers';
 import type { AuthenticatedParams, HookContext, Repo, RepoID } from '@agor/core/types';
 import { spawnExecutorFireAndForget } from './spawn-executor.js';
@@ -34,6 +36,8 @@ export async function ensureRepoOriginAlignedForRepo(
   if (repo.repo_type !== 'remote') return;
   if (!repo.remote_url) return;
   if (!repo.local_path) return;
+  // The executor rejects any stored path outside the caller's tenant repos root.
+  const reposRoot = getReposDir(params?.tenant?.tenant_id ?? getCurrentTenantId());
 
   spawnExecutorFireAndForget(
     {
@@ -43,6 +47,7 @@ export async function ensureRepoOriginAlignedForRepo(
         repoPath: repo.local_path,
         remoteUrl: repo.remote_url,
         repoSlug: repo.slug,
+        reposRoot,
       },
     },
     {
```

**File**: `packages/core/src/config/repo-reference.test.ts` (modified, +7/-0)
```diff
@@ -439,6 +439,13 @@ describe('isValidSlug', () => {
       expect(isValidSlug('org/sub/repo')).toBe(false);
     });
 
+    it('should reject dot path segments that escape a filesystem root', () => {
+      for (const slug of ['../repo', './repo', 'org/..', 'org/.', '../..']) {
+        expect(isValidSlug(slug)).toBe(false);
+      }
+      expect(isValidSlug('..org/repo..')).toBe(true);
+    });
+
     it('should reject slug with spaces', () => {
       expect(isValidSlug('my org/my repo')).toBe(false);
     });
```

---

### Incident Patch 2: `5a1f4fae` (2026-09-30)
**Commit Message**: fix(docs): restore complete Google favicon raster (#2926)

**File**: `.github/workflows/docs-pr-check.yml` (modified, +3/-0)
```diff
@@ -50,6 +50,9 @@ jobs:
         env:
           NEXT_PUBLIC_GA_ID: G-DME77D3LDH
 
+      - name: Verify favicon artwork and exported icon links
+        run: pnpm --filter @agor/docs validate:brand-assets --export
+
       - name: Verify build output
         run: |
           if [ ! -d "apps/agor-docs/out" ]; then
```

**File**: `apps/agor-docs/README.md` (modified, +7/-0)
```diff
@@ -51,8 +51,15 @@ the canonical SVG with:
 
 ```bash
 apps/agor-docs/scripts/generate-apple-touch-icon.sh
+pnpm --filter @agor/docs validate:brand-assets
 ```
 
+This stable Apple-touch URL is also a Google Search favicon candidate. Keep
+the complete badge and transparent outer corners; PNG header dimensions alone
+cannot detect missing artwork. Validation decodes and compares the raster to
+the canonical SVG. After a docs build, add `--export` to validate the actual
+homepage icon links and published asset bytes (also checked in docs PR CI).
+
 Screenshots, social-card images, generated video frames, and third-party tool
 logos are content assets rather than alternate Agor marks and keep the format
 required by their destination.
```

**File**: `apps/agor-docs/package.json` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@
     "@types/react": "^19.3.0",
     "next-sitemap": "^4.2.3",
     "pagefind": "^1.5.2",
+    "sharp": "0.35.4",
     "tsx": "4.23.15",
     "typescript": "^6.0.3"
   }
```

**File**: `apps/agor-docs/scripts/validate-brand-assets.ts` (modified, +68/-1)
```diff
@@ -1,7 +1,8 @@
 import { existsSync, readFileSync } from 'node:fs';
 import path from 'node:path';
 import { fileURLToPath } from 'node:url';
-import { LOGO_MARK_PATH, LOGO_PATH } from '../lib/siteMetadata';
+import sharp from 'sharp';
+import { getBasePath, LOGO_MARK_PATH, LOGO_PATH } from '../lib/siteMetadata';
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 const docsDir = path.resolve(__dirname, '..');
@@ -89,6 +90,72 @@ if (!existsSync(appleTouchIconPath)) {
     if (colorType !== 4 && colorType !== 6) {
       fail('Apple touch icon must retain an alpha channel for the transparent outer canvas');
     }
+
+    // A valid IHDR does not prove the artwork is complete: the former PNG had
+    // correct dimensions but fully transparent rows 93–179. Decode and compare
+    // the whole image to the canonical badge, including its legitimate alpha.
+    try {
+      const actual = await sharp(png).ensureAlpha().raw().toBuffer();
+      const expected = await sharp(canonicalLogoPath)
+        .resize(180, 180)
+        .ensureAlpha()
+        .raw()
+        .toBuffer();
+      if (actual.length !== expected.length) {
+        fail('Apple touch icon decoded dimensions do not match the canonical render');
+      } else {
+        const difference = actual.reduce(
+          (sum, value, index) => sum + Math.abs(value - expected[index]),
+          0
+        );
+        // Allow minor antialiasing differences across librsvg versions, but
+        // reject clipped, stretched, recolored, or flattened artwork.
+        if (difference / actual.length > 2) {
+          fail('Apple touch icon must render the complete canonical badge with transparency');
+        }
+      }
+    } catch (error) {
+      fail(`Apple touch icon could not be decoded/rendered: ${String(error)}`);
+    }
+  }
+}
+
+// Opt in after next build: check the real exported homepage, not just source
+// strings (App Router file conventions can silently introduce extra icons).
+if (process.argv.includes('--export')) {
+  const outDir = path.join(docsDir, 'out');
+  const homepage = readFileSync(path.join(outDir, 'index.html'), 'utf8');
+  const links = [...homepage.matchAll(/<link\b[^>]*>/g)]
+    .map(([tag]) =>
+      Object.fromEntries(
+        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])
+      )
+    )
+    .filter(({ rel }) => /\bicon\b|manifest/.test(rel ?? ''));
+  const basePath = getBasePath();
+  if (
+    links.length !== 2 ||
+    !links.some(
+      ({ rel, type, href }) =>
+        rel === 'icon' && type === 'image/svg+xml' && href === `${basePath}${LOGO_PATH}`
+    ) ||
+    !links.some(
+      ({ rel, sizes, href }) =>
+        rel === 'apple-touch-icon' &&
+        sizes === '180x180' &&
+        href === `${basePath}/apple-touch-icon.png`
+    )
+  ) {
+    fail('Exported homepage must advertise only the canonical SVG and 180 × 180 Apple touch icon');
+  }
+  for (const filename of ['logo.svg', 'apple-touch-icon.png']) {
+    if (
+      !readFileSync(path.join(outDir, filename)).equals(
+        readFileSync(path.join(docsDir, 'public', filename))
+      )
+    ) {
+      fail(`Exported ${filename} differs from its validated public asset`);
+    }
   }
 }
 
```

**File**: `pnpm-lock.yaml` (modified, +4/-3)
```diff
@@ -388,6 +388,9 @@ importers:
       pagefind:
         specifier: ^1.5.2
         version: 1.5.2
+      sharp:
+        specifier: 0.35.4
+        version: 0.35.4(@types/node@24.13.3)
       tsx:
         specifier: 4.23.15
         version: 4.23.15
@@ -12378,8 +12381,7 @@ snapshots:
       '@iconify/types': 2.0.0
       import-meta-resolve: 4.2.0
 
-  '@img/colour@1.1.0':
-    optional: true
+  '@img/colour@1.1.0': {}
 
   '@img/sharp-darwin-arm64@0.35.4':
     optionalDependencies:
@@ -21121,7 +21123,6 @@ snapshots:
       '@img/sharp-win32-ia32': 0.35.4
       '@img/sharp-win32-x64': 0.35.4
       '@types/node': 24.13.3
-    optional: true
 
   shebang-command@2.0.0:
     dependencies:
```

---

### Incident Patch 3: `b0acf00c` (2026-09-30)
**Commit Message**: fix(ui): finish #2904 header scale in session drawer and board panel (#2929)

- New-session (pending tool choice) header now matches the SessionPanel
  header: 16/600 title, 24px icon, 12/16 padding, and the branch as a
  12px secondary meta line instead of "Untitled session — <branch>".
  The 13px helper line uses the default 14px, like the session empty state.
- Comments tab: drop CommentsPanel's own "Comments" header (it duplicated
  the tab label; mobile already hid it). The now-dead hideHeader and
  onToggleCollapse props go with it; mobile empty-state centring follows
  useIsMobileViewport(). Filter and composer rows use 12/16 padding to
  line up with the other board-panel tabs.
- BranchModal Teammate tab: 24px emoji/icon, fontSizeLG title,
  sentence-case "Teammate configuration".
- Session drawer off-scale text: "Esc to close" 11px -> 12px, search
  "No results" and the Switch tool helper 13px -> 14px.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `apps/agor-ui/src/components/BranchModal/tabs/TeammateTab.tsx` (modified, +6/-5)
```diff
@@ -1,7 +1,7 @@
 import type { AgorClient, Branch } from '@agor-live/client';
 import { getTeammateConfig } from '@agor-live/client';
 import { RobotOutlined } from '@ant-design/icons';
-import { Button, Descriptions, Form, Input, Popconfirm, Space, Typography } from 'antd';
+import { Button, Descriptions, Form, Input, Popconfirm, Space, Typography, theme } from 'antd';
 import { useState } from 'react';
 import { useConnectionDisabled } from '../../../contexts/ConnectionContext';
 import { useThemedMessage } from '../../../utils/message';
@@ -26,6 +26,7 @@ export const TeammateTab: React.FC<TeammateTabProps> = ({
   client,
   onRetired,
 }) => {
+  const { token } = theme.useToken();
   const [retiring, setRetiring] = useState(false);
   const disabled = useConnectionDisabled();
   const { showSuccess, showError } = useThemedMessage();
@@ -50,12 +51,12 @@ export const TeammateTab: React.FC<TeammateTabProps> = ({
       <Space orientation="vertical" size="large" style={{ width: '100%' }}>
         <Space>
           {config.emoji ? (
-            <span style={{ fontSize: 20 }}>{config.emoji}</span>
+            <span style={{ fontSize: token.fontSizeHeading3, lineHeight: 1 }}>{config.emoji}</span>
           ) : (
-            <RobotOutlined style={{ fontSize: 20 }} />
+            <RobotOutlined style={{ fontSize: token.fontSizeHeading3 }} />
           )}
-          <Typography.Text strong style={{ fontSize: 16 }}>
-            Teammate Configuration
+          <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
+            Teammate configuration
           </Typography.Text>
         </Space>
 
```

**File**: `apps/agor-ui/src/components/CommentsPanel/CommentsPanel.tsx` (modified, +6/-48)
```diff
@@ -12,7 +12,6 @@ import {
   AppstoreOutlined,
   BranchesOutlined,
   CheckOutlined,
-  CloseOutlined,
   CommentOutlined,
   DeleteOutlined,
   SendOutlined,
@@ -34,14 +33,15 @@ import {
 } from 'antd';
 import React, { useEffect, useMemo, useState } from 'react';
 import { useMutationGate } from '../../contexts/ConnectionContext';
+import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
 import { AutocompleteTextarea } from '../AutocompleteTextarea';
 import { AgorEmojiPicker } from '../EmojiPickerInput';
 import { MarkdownRenderer } from '../MarkdownRenderer';
 import { MetaRow } from '../MetaRow';
 import { ZONE_CONTENT_OPACITY } from '../SessionCanvas/canvas/BoardObjectNodes';
 import { UserIdentityAvatar } from '../UserIdentityAvatar';
 
-const { Text, Title } = Typography;
+const { Text } = Typography;
 
 export interface CommentsPanelProps {
   client: AgorClient | null;
@@ -53,9 +53,6 @@ export interface CommentsPanelProps {
   branchById?: Map<string, Branch>; // For branch names
   loading?: boolean;
   collapsed?: boolean;
-  onToggleCollapse?: () => void;
-  /** Hide the internal "Comments" header (mobile already shows a board header). */
-  hideHeader?: boolean;
   onSendComment: (content: string) => void;
   onReplyComment?: (parentId: string, content: string) => void;
   onResolveComment?: (commentId: string) => void;
@@ -570,8 +567,6 @@ export const CommentsPanel: React.FC<CommentsPanelProps> = ({
   branchById,
   loading = false,
   collapsed = false,
-  onToggleCollapse,
-  hideHeader = false,
   onSendComment,
   onReplyComment,
   onResolveComment,
@@ -582,6 +577,7 @@ export const CommentsPanel: React.FC<CommentsPanelProps> = ({
   alwaysShowActions,
 }) => {
   const { token } = theme.useToken();
+  const isMobile = useIsMobileViewport();
   const [filter, setFilter] = useState<FilterMode>('active');
   const [commentInputValue, setCommentInputValue] = useState('');
 
@@ -764,48 +760,10 @@ export const CommentsPanel: React.FC<CommentsPanelProps> = ({
         flexDirection: 'column',
       }}
     >
-      {/* Header — hidden on mobile, where the board header already titles the view */}
-      {!hideHeader && (
-        <div
-          style={{
-            padding: 12,
-            borderBottom: `1px solid ${token.colorBorder}`,
-            display: 'flex',
-            alignItems: 'center',
-            justifyContent: 'space-between',
-          }}
-        >
-          <Space>
-            <CommentOutlined />
-            <Title level={5} style={{ margin: 0 }}>
-              Comments
-            </Title>
-            <Badge
-              count={filteredThreads.length}
-              showZero={false}
-              style={{
-                backgroundColor: filteredThreads.some(threadMentionsUser)
-                  ? token.colorError
-                  : token.colorPrimaryBgHover,
-              }}
-            />
-          </Space>
-          {onToggleCollapse && (
-            <Button
-              type="text"
-              size="small"
-              icon={<CloseOutlined />}
-              onClick={onToggleCollapse}
-              danger
-            />
-          )}
-        </div>
-      )}
-
       {/* Filter Tabs */}
       <div
         style={{
-          padding: 12,
+          padding: `${token.paddingSM}px ${token.padding}px`,
           borderBottom: `1px solid ${token.colorBorder}`,
           backgroundColor: token.colorBgContainer,
         }}
@@ -841,7 +799,7 @@ export const CommentsPanel: React.FC<CommentsPanelProps> = ({
               color: token.colorTextSecondary,
               // On mobile the panel fills the screen, so centre the empty state
               // instead of clustering it at the top.
-              ...(hideHeader
+              ...(isMobile
                 ? {
                     height: '100%',
                     display: 'flex',
@@ -936,7 +894,7 @@ export const CommentsPanel: React.FC<CommentsPanelProps> = ({
       {/* Input Box fo
```

**File**: `apps/agor-ui/src/components/SessionPanel/PendingToolChoicePanel.test.tsx` (modified, +17/-0)
```diff
@@ -1,3 +1,4 @@
+import type { Branch } from '@agor-live/client';
 import { fireEvent, render, screen } from '@testing-library/react';
 import { App, ConfigProvider } from 'antd';
 import type React from 'react';
@@ -49,6 +50,22 @@ describe('PendingToolChoicePanel', () => {
     expect(screen.getByText('Send').closest('button')).toHaveAttribute('disabled');
   });
 
+  it('shows the branch as a meta line under the session title', () => {
+    render(
+      <Wrapper>
+        <PendingToolChoicePanel
+          branch={{ name: 'feature-x' } as Branch}
+          availableAgents={agents}
+          onChoose={vi.fn()}
+          onClose={vi.fn()}
+        />
+      </Wrapper>
+    );
+
+    expect(screen.getByText('Untitled session')).toBeInTheDocument();
+    expect(screen.getByText('feature-x')).toBeInTheDocument();
+  });
+
   it('calls onChoose with the tool id when a tile is clicked', () => {
     const onChoose = vi.fn();
     render(
```

**File**: `apps/agor-ui/src/components/SessionPanel/PendingToolChoicePanel.tsx` (modified, +24/-7)
```diff
@@ -76,16 +76,33 @@ export const PendingToolChoicePanel: React.FC<PendingToolChoicePanelProps> = ({
         align="center"
         style={{
           flexShrink: 0,
-          padding: `${token.sizeUnit * 3}px ${token.sizeUnit * 6}px`,
+          padding: `${token.paddingSM}px ${token.padding}px`,
           borderBottom: `1px solid ${token.colorBorder}`,
           background: token.colorBgContainer,
         }}
       >
-        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
-          <RobotOutlined style={{ fontSize: 28, color: token.colorTextTertiary, flexShrink: 0 }} />
-          <Typography.Text strong style={{ fontSize: 18 }}>
-            {branch ? `Untitled session — ${branch.name}` : 'Untitled session'}
-          </Typography.Text>
+        <Flex align="center" gap={token.marginXS} style={{ minWidth: 0 }}>
+          <RobotOutlined
+            style={{
+              fontSize: token.fontSizeHeading3,
+              color: token.colorTextTertiary,
+              flexShrink: 0,
+            }}
+          />
+          <Flex vertical style={{ minWidth: 0 }}>
+            <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
+              Untitled session
+            </Typography.Text>
+            {branch && (
+              <Typography.Text
+                type="secondary"
+                style={{ fontSize: token.fontSizeSM }}
+                ellipsis={{ tooltip: branch.name }}
+              >
+                {branch.name}
+              </Typography.Text>
+            )}
+          </Flex>
         </Flex>
         <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Close panel" />
       </Flex>
@@ -103,7 +120,7 @@ export const PendingToolChoicePanel: React.FC<PendingToolChoicePanelProps> = ({
         }}
       >
         <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
-          <Typography.Text style={{ fontSize: 13 }} type="secondary">
+          <Typography.Text type="secondary">
             Choose which AI tool this session should use.
           </Typography.Text>
 
```

**File**: `apps/agor-ui/src/components/SessionPanel/SessionPanel.tsx` (modified, +3/-5)
```diff
@@ -1682,7 +1682,7 @@ const SessionPanel: React.FC<SessionPanelProps> = ({
               </Typography.Text>
             )}
             {!query && !isMobileShell && (
-              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
+              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                 Esc to close
               </Typography.Text>
             )}
@@ -1752,9 +1752,7 @@ const SessionPanel: React.FC<SessionPanelProps> = ({
               >
                 <SearchOutlined style={{ fontSize: 16, color: token.colorTextTertiary }} />
               </div>
-              <Typography.Text strong style={{ fontSize: 13 }}>
-                No results
-              </Typography.Text>
+              <Typography.Text strong>No results</Typography.Text>
               <Typography.Text
                 type="secondary"
                 style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5, maxWidth: 200 }}
@@ -1893,7 +1891,7 @@ const SessionPanel: React.FC<SessionPanelProps> = ({
           onCancel={() => setSwitchToolOpen(false)}
           footer={null}
         >
-          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
+          <Typography.Paragraph type="secondary">
             Choose a different tool for this session. Since nothing has been sent yet, this replaces
             the session in place.
           </Typography.Paragraph>
```

---

### Incident Patch 4: `122fe057` (2026-09-29)
**Commit Message**: fix: resolve implicit teammate template defaults from registered remote (#2924)

* fix: resolve implicit teammate defaults from registered remote

* test: align teammate recovery coverage with collapsed diagnostics

**File**: `apps/agor-daemon/src/services/branches.provenance.integration.test.ts` (modified, +27/-8)
```diff
@@ -73,7 +73,19 @@ dbTest(
     await writeFile(join(source, 'IDENTITY.md'), 'Disposable template persona');
     await git.add('.');
     await git.commit('template');
+    const firstSha = (await git.revparse('HEAD')).trim();
+    const remote = join(root, 'template.git');
+    await simpleGit().clone(source, remote, ['--bare']);
+    await git.addRemote('upstream', remote);
+    await writeFile(join(source, 'version'), 'remote update');
+    await git.add('.').commit('remote update');
     const sha = (await git.revparse('HEAD')).trim();
+    await git.push('upstream', 'main');
+    // Registered checkout is behind; fetching cannot reconcile its local branch.
+    const cache = join(root, 'registered-template');
+    await simpleGit().clone(remote, cache, ['--origin', 'upstream']);
+    await simpleGit(cache).raw(['update-ref', 'refs/heads/main', firstSha]);
+    await simpleGit(cache).fetch('upstream');
     // Only the public template URL is remapped; resolution and clone are real.
     // Production Git deliberately ignores inherited GIT_CONFIG_* overrides.
     transport.template = source;
@@ -126,14 +138,15 @@ dbTest(
       app.use('executor-git-environment', new ExecutorGitEnvironmentService(db));
     });
     try {
-      for (const kind of ['home', 'clone', 'worktree'] as const) {
+      for (const kind of ['implicit', 'home', 'clone', 'worktree'] as const) {
         const repo = await new RepoRepository(raw).create({
           name: `Disposable ${kind}`,
           slug: `fixture/${kind}`,
           repo_type: 'local',
-          local_path: source,
+          local_path: kind === 'implicit' ? cache : source,
           default_branch: 'main',
-          remote_url: kind === 'home' ? TEAMMATE_FRAMEWORK_REPO_URL : source,
+          remote_url:
+            kind === 'home' ? TEAMMATE_FRAMEWORK_REPO_URL : kind === 'implicit' ? remote : source,
         });
         const params = {
           user: owner,
@@ -146,11 +159,11 @@ dbTest(
               name: `fresh-${kind}`,
               ref: `fresh-${kind}`,
               createBranch: true,
-              sourceBranch: 'main',
+              ...(kind === 'implicit' ? {} : { sourceBranch: 'main' }),
               boardId: board.board_id,
               position: { x: 0, y: 0 },
-              storage_mode: kind === 'worktree' ? 'worktree' : 'clone',
-              ...(kind === 'home'
+              storage_mode: kind === 'worktree' || kind === 'implicit' ? 'worktree' : 'clone',
+              ...(kind === 'home' || kind === 'implicit'
                 ? {
                     custom_context: {
                       teammate: { kind: 'teammate', displayName: 'Disposable home' },
@@ -167,6 +180,7 @@ dbTest(
           .mocked(spawnExecutorFireAndForget)
           .mock.calls.at(-1)![0] as GitBranchAddPayload;
         const attempt = branch.provisioning_attempt_id!;
+        if (kind === 'implicit') expect(branch.base_ref).toBeUndefined();
         const provenance = { base_ref: 'refs/heads/main', base_sha: sha };
         const patch = (token: string, data: object) =>
           fetch(`${server.url}/branches/${branch.branch_id}`, {
@@ -190,7 +204,7 @@ dbTest(
               command === 'git.branch.add' ? attemptId : undefined
             )
           );
-        if (kind === 'home') {
+        if (kind === 'home' || kind === 'implicit') {
           const report = { ...provenance, provisioning_attempt_id: attempt };
           let before = await rows.findById(branch.branch_id);
           const userToken = server.headers(owner.user_id).authorization.slice(7);
@@ -247,7 +261,7 @@ dbTest(
             ],
           },
         });
-        if (kind === 'clone') {
+        if (kind === 'clone' || kind === 'implicit') {
           const rejected = await handleGitBranchAdd(
             {
               ...payload,
@@ -283,6 +297,11 @@ dbTest(
           expect(await simpleGit(branch.path).getRemotes()).toEqual([]);
           expect(ready?.base_source?.remote_ur
```

**File**: `apps/agor-docs/content/guide/teammates.mdx` (modified, +15/-1)
```diff
@@ -39,7 +39,21 @@ New teammates using the canonical public framework get independent, full-history
 clone homes with no `origin`. No Git token or private repository is needed to start.
 Home files survive only while installation storage survives; Knowledge is the
 primary memory and document store. Existing teammates and private/custom sources
-are unchanged. The Create dialog offers the same persona gallery as onboarding.
+retain their storage behavior. The Create dialog offers the same persona gallery as onboarding.
+
+For a private/custom template, Blank (with no explicit source ref) uses the
+registered repository’s default branch on its registered remote URL. Agor resolves
+the live commit and fetches it without resetting the registered checkout’s local
+branch or work. An unavailable remote or missing branch fails rather than using
+a stale local copy. Local-only repositories still use their local default.
+Explicit source refs retain their meaning: ambiguous bare names are rejected,
+and `refs/heads/<branch>` selects a local branch.
+
+If provisioning fails, ask an admin to check template availability, the starter
+branch, and your Git access. Open **Technical details** on the teammate’s board
+for the underlying error, then use **Retry** on that same teammate after repair;
+retry does not create another teammate. Agor does not infer default intent from
+an explicit `main`, including source refs saved by older versions.
 
 Private backup is optional after useful work: with your explicit authorization,
 an additional private remote can back up this isolated home without reassigning
```

**File**: `apps/agor-ui/src/App.tsx` (modified, +1/-1)
```diff
@@ -1709,7 +1709,7 @@ function AppContent() {
       ref: string;
       refType?: 'branch' | 'tag';
       createBranch: boolean;
-      sourceBranch: string;
+      sourceBranch?: string;
       sourceRemoteUrl?: string;
       pullLatest: boolean;
       issue_url?: string;
```

**File**: `apps/agor-ui/src/components/App/App.tsx` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ export interface AppProps {
       ref: string;
       refType?: 'branch' | 'tag';
       createBranch: boolean;
-      sourceBranch: string;
+      sourceBranch?: string;
       sourceRemoteUrl?: string;
       pullLatest: boolean;
       issue_url?: string;
```

**File**: `apps/agor-ui/src/components/BoardTeammatePanel/BoardTeammatePanel.primary.browser.test.tsx` (modified, +12/-1)
```diff
@@ -196,8 +196,19 @@ it.each([
   'preserves $action for the primary teammate filesystem',
   async ({ status, title, action }) => {
     const api = mount();
-    await act(async () => branchPatched({ ...old, filesystem_status: status }));
+    await act(async () =>
+      branchPatched({ ...old, filesystem_status: status, error_message: 'Template fetch failed' })
+    );
     expect(await screen.findByText(title)).toBeVisible();
+    if (status === 'failed') {
+      expect(screen.getByText(/Ask a workspace admin to check/)).toBeVisible();
+      expect(screen.getByText(/no need to create another one/)).toBeVisible();
+      const details = screen.getByText('Technical details').closest('details')!;
+      expect(details).not.toHaveAttribute('open');
+      await click(screen.getByText('Technical details'));
+      expect(details).toHaveAttribute('open');
+      expect(details).toHaveTextContent('Template fetch failed');
+    }
     expectNoPrimaryActions();
     await click(screen.getByRole('button', { name: action }));
     await waitFor(() => expect(api.retryProvisioning).toHaveBeenCalledExactlyOnceWith({}));
```

---

### Incident Patch 5: `504c7ec7` (2026-09-29)
**Commit Message**: fix: restore Gemini coding reliability and contract coverage (#2886)

* fix: harden Gemini execution and mark integration beta

* test: add packaged Gemini live smoke journeys

* fix: preserve execution boundaries and failure accounting

* fix(ui): keep managed configuration guidance within viewport

* test: align Gemini default and catalog option assertions

* fix(executor): preserve transitive module failures

* fix(executor): avoid forbidden post-response task write

* fix(executor): retain safe preturn errors and read results

* fix(executor): restore session startup and recovery

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -116,6 +116,8 @@ jobs:
       # all of its workspace declaration dependencies cheaply or reliably.
       - run: pnpm --filter @agor/executor exec vitest run
       - run: pnpm --filter @agor/executor test:runtime
+      - run: pnpm --filter @agor/executor test:gemini-contract
+      - run: pnpm --filter @agor/executor test:gemini-smoke
 
       # Every @agor/core dist entry imported by plain Node, then the tenant
       # scope stores driven across those entries. Vitest resolves this package
```

**File**: `.github/workflows/gemini-live-smoke.yml` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+name: Gemini packaged-agent live smoke
+
+on:
+  schedule:
+    - cron: '23 3 * * *'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: gemini-live-smoke
+  cancel-in-progress: false
+
+jobs:
+  smoke:
+    # Environment branch protection is also required; see the runbook. This
+    # workflow is intentionally not callable from PR or reusable workflows.
+    if: github.ref == 'refs/heads/main' && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')
+    environment: gemini-live-smoke
+    runs-on: ubuntu-latest
+    timeout-minutes: 35
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+
+      - uses: actions/setup-node@v7
+        with:
+          node-version: '24.19.0'
+          package-manager-cache: false
+
+      - name: Check live validation availability
+        id: key
+        env:
+          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
+        shell: bash
+        run: |
+          if [ -z "$GEMINI_API_KEY" ]; then
+            node packages/executor/scripts/gemini-live-smoke.mjs
+            echo 'available=false' >> "$GITHUB_OUTPUT"
+          else
+            echo 'available=true' >> "$GITHUB_OUTPUT"
+          fi
+
+      - uses: pnpm/action-setup@v6
+        if: steps.key.outputs.available == 'true'
+        with:
+          version: '11.17.0'
+
+      - name: Build exact release artifacts without credentials
+        if: steps.key.outputs.available == 'true'
+        run: |
+          npm install -g --ignore-scripts npm@11.16.0
+          pnpm install --frozen-lockfile
+          packages/agor-live/build.sh --skip-install
+        env:
+          AGOR_BUILD_SHA: ${{ github.sha }}
+          NODE_OPTIONS: --max-old-space-size=4096
+
+      - name: Install packaged agent without credentials
+        if: steps.key.outputs.available == 'true'
+        shell: bash
+        run: |
+          set -euo pipefail
+          RELEASE="$PWD/packages/agor-live/release"
+          ROOT="$RUNNER_TEMP/gemini-install"
+          mkdir -p "$ROOT"
+          npm install --prefix "$ROOT" --ignore-scripts --no-fund --no-audit \
+            "$RELEASE"/agor-live-[0-9]*.tgz "$RELEASE"/agor-live-client-*.tgz
+          VERSION=$(node -p "require('$ROOT/node_modules/agor-live/package.json').version")
+          npm install --prefix "$ROOT/tools/$VERSION/gemini" --ignore-scripts --no-fund --no-audit \
+            "$RELEASE"/agor-live-gemini-*.tgz
+          echo "PACKAGE_ROOT=$ROOT/node_modules/agor-live" >> "$GITHUB_ENV"
+          echo "TOOLS_ROOT=$ROOT/tools" >> "$GITHUB_ENV"
+
+      - name: Exercise both live journeys
+        if: steps.key.outputs.available == 'true'
+        env:
+          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
+        run: node packages/executor/scripts/gemini-live-smoke.mjs "$PACKAGE_ROOT" "$TOOLS_ROOT"
+
+      # No artifact upload: transcripts, prompts, provider bodies, SDK homes and
+      # logs must not escape the disposable fixture. Only fixed verdicts print.
+      - name: Remove installed artifacts
+        if: always()
+        run: rm -rf "$RUNNER_TEMP/gemini-install"
```

**File**: `apps/agor-daemon/src/branch-sdk-home.test.ts` (modified, +39/-1)
```diff
@@ -1,10 +1,12 @@
-import { mkdtempSync } from 'node:fs';
+import { spawnSync } from 'node:child_process';
+import { mkdtempSync, rmSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import { join } from 'node:path';
 import { afterAll, beforeAll, describe, expect, it } from 'vitest';
 import {
   branchSdkHomeAuthUnsupportedReason,
   resolveBranchSdkHomeLaunch,
+  resolveExecutionSdkHomeEnv,
   resolveNewSessionSdkHomeScope,
   resolveSdkHomeConfig,
   sessionUsesBranchSdkHome,
@@ -195,3 +197,39 @@ describe('branchSdkHomeAuthUnsupportedReason', () => {
     ).toBeUndefined();
   });
 });
+
+describe('Gemini execution-home projection', () => {
+  it.each(['execution_home', undefined, 'branch'] as const)(
+    'starts the adapter in the selected %s home',
+    (sessionScope) => {
+      const executionHome = mkdtempSync(join(tmpdir(), 'gemini-launch-'));
+      const branchHome = mkdtempSync(join(tmpdir(), 'gemini-branch-'));
+      const branch = sessionUsesBranchSdkHome({ sessionScope, branchSdkHomeIntent: 'per_branch' });
+      const env = resolveExecutionSdkHomeEnv({
+        tool: 'gemini',
+        executionHome,
+        branchEnv: branch ? { GEMINI_CLI_HOME: branchHome } : undefined,
+      });
+      expect(env.GEMINI_CLI_HOME).toBe(branch ? branchHome : executionHome);
+      const probe = spawnSync(
+        process.execPath,
+        [
+          '--import',
+          'tsx',
+          '--input-type=module',
+          '-e',
+          `
+      import { enterGeminiRuntime } from '../../packages/executor/src/sdk-handlers/gemini/runtime.ts';
+      const close = await enterGeminiRuntime();
+      if (!process.env.TMPDIR.startsWith(process.env.GEMINI_CLI_HOME + '/.gemini/')) throw new Error('wrong home');
+      await close();
+    `,
+        ],
+        { cwd: process.cwd(), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 }
+      );
+      rmSync(executionHome, { recursive: true, force: true });
+      rmSync(branchHome, { recursive: true, force: true });
+      expect(probe.status, probe.stderr).toBe(0);
+    }
+  );
+});
```

**File**: `apps/agor-daemon/src/branch-sdk-home.ts` (modified, +12/-0)
```diff
@@ -260,3 +260,15 @@ export function resolveBranchSdkHomeLaunch(input: {
   }
   return { branchHomeDir, envVars, ensureDirs: [...dirs] };
 }
+
+/** Project the launch owner's selected home without relocating historical SDK state. */
+export function resolveExecutionSdkHomeEnv(input: {
+  tool: AgenticToolName;
+  executionHome: string;
+  branchEnv?: Record<string, string>;
+}): Record<string, string> {
+  return {
+    ...(input.tool === 'gemini' ? { GEMINI_CLI_HOME: input.executionHome } : {}),
+    ...input.branchEnv,
+  };
+}
```

**File**: `apps/agor-daemon/src/ha-support.test.ts` (modified, +1/-0)
```diff
@@ -82,6 +82,7 @@ describe('constrained HA support profile', () => {
     ['claude-code', { mode: 'bypassPermissions' }],
     ['codex', { mode: 'allow-all', codex: { approvalPolicy: 'never' } }],
     ['gemini', { mode: 'yolo' }],
+    ['gemini', { mode: 'autoEdit' }],
     ['copilot', { mode: 'bypassPermissions' }],
     ['cursor', { mode: 'default' }],
   ] as const)('admits noninteractive %s execution', (agenticTool, permission_config) => {
```

---

### Incident Patch 6: `72fb5af2` (2026-09-29)
**Commit Message**: fix(mcp-catalog): single-row filter bar with consistent control sizes (#2900)

* fix(mcp-catalog): single-row filter bar with consistent control sizes

Put search, Category, Capability and Sort on one wrapping row at antd's
default 32px height. Category becomes a Select; Category and Sort use the
Select prefix as their label. On narrow screens every control fills the
width, matching the sibling Marketplace tabs' compact breakpoint.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix(mcp-catalog): flat toolbar with a Capability prefix

Drop the Card around the toolbar so it sits flat above the grid like the
other Agor filter bars, inset by the grid's half-gutter to align with the
cards. Capability gets the same prefix label as Category and Sort, with
"Any" as its empty value.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix(mcp-catalog): phone filters behind a button in a bottom sheet

On narrow screens the toolbar is the search box plus a Filters button
badged with the active-filter count. The button opens a bottom Drawer
with the same Category, Capability and Sort selects, plus Reset and a
"Show N servers" action. The sheet mounts on demand: left mounted

**File**: `apps/agor-ui/src/components/Marketplace/CatalogTab.test.tsx` (modified, +1/-1)
```diff
@@ -540,7 +540,7 @@ describe('catalog browsing', () => {
     await findCard('DeepWiki');
     const before = catalogReads.length;
 
-    fireEvent.click(screen.getByText('Observability').closest('label')!);
+    chooseSelectOption('Filter by category', 'Observability');
     await waitFor(() => expect(queryCard('DeepWiki')).not.toBeInTheDocument());
     expect(queryCard('Logs')).toBeInTheDocument();
     expect(queryCard('Metrics')).toBeInTheDocument();
```

**File**: `apps/agor-ui/src/components/Marketplace/CatalogTab.tsx` (modified, +19/-17)
```diff
@@ -95,13 +95,14 @@ function useSettledFlag(active: boolean, delayMs: number): boolean {
 }
 
 const DISCONNECT_NOTICE_DELAY_MS = 2000;
+const GRID_GUTTER = 16;
 
 const CatalogGrid = memo<{
   entries: MCPCatalogEntry[];
   onOpen: (entry: MCPCatalogEntry) => void;
 }>(({ entries, onOpen }) => (
   // Keep the half-gutters inside the scroll container, not outside its width.
-  <Row gutter={[16, 16]} style={{ marginInline: 0 }}>
+  <Row gutter={[GRID_GUTTER, GRID_GUTTER]} style={{ marginInline: 0 }}>
     {entries.map((entry) => (
       <Col key={entry.name} {...GRID_SPANS}>
         <CatalogCard entry={entry} onOpen={onOpen} />
@@ -511,14 +512,12 @@ const CatalogTabForIdentity: React.FC<CatalogTabProps> = ({
     [restoreDrawerFocus]
   );
 
-  // `REQ-CAT-3`: the count is a filtering aid, so it appears only once
-  // filtering is happening.
   const matchSummary = useMemo(
     () =>
-      status === 'ready' && isFilterActive(filters) && catalogSize !== null
+      status === 'ready' && catalogSize !== null
         ? { matched: matchCount, total: catalogSize }
         : null,
-    [status, filters, catalogSize, matchCount]
+    [status, catalogSize, matchCount]
   );
 
   const handleConnect = useCallback(
@@ -834,17 +833,20 @@ const CatalogTabForIdentity: React.FC<CatalogTabProps> = ({
 
   return (
     <Flex vertical gap={token.margin}>
-      <CatalogToolbar
-        search={filters.search}
-        category={filters.category}
-        capability={filters.capability}
-        sort={filters.sort}
-        onSearchChange={onSearchChange}
-        onCategoryChange={onCategoryChange}
-        onCapabilityChange={onCapabilityChange}
-        onSortChange={onSortChange}
-        matchSummary={matchSummary}
-      />
+      {/* Inset by the grid's half-gutter so the toolbar lines up with the cards. */}
+      <div style={{ paddingInline: GRID_GUTTER / 2 }}>
+        <CatalogToolbar
+          search={filters.search}
+          category={filters.category}
+          capability={filters.capability}
+          sort={filters.sort}
+          onSearchChange={onSearchChange}
+          onCategoryChange={onCategoryChange}
+          onCapabilityChange={onCapabilityChange}
+          onSortChange={onSortChange}
+          matchSummary={matchSummary}
+        />
+      </div>
 
       {showDisconnected && (
         <Alert
@@ -871,7 +873,7 @@ const CatalogTabForIdentity: React.FC<CatalogTabProps> = ({
         />
       ) : status === 'loading' ? (
         showDisconnected ? null : (
-          <Row gutter={[16, 16]} style={{ marginInline: 0 }}>
+          <Row gutter={[GRID_GUTTER, GRID_GUTTER]} style={{ marginInline: 0 }}>
             {Array.from({ length: 6 }, (_, index) => (
               // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder grid
               <Col key={index} {...GRID_SPANS}>
```

**File**: `apps/agor-ui/src/components/Marketplace/CatalogToolbar.layout.browser.test.tsx` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+import { cleanup, configure, render, screen, within } from '@testing-library/react';
+import { App, ConfigProvider } from 'antd';
+import { useState } from 'react';
+import { MemoryRouter } from 'react-router-dom';
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+import { page, userEvent } from 'vitest/browser';
+import { CatalogTab } from './CatalogTab';
+import { MCPCatalogModal } from './MCPCatalogModal';
+import { catalogEntry, catalogUser, makeCatalogClient } from './MCPCatalogModal.test-fixtures';
+
+beforeEach(() => {
+  // Browser events run outside React's synthetic act environment.
+  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
+});
+configure({ asyncUtilTimeout: 10_000 });
+afterEach(cleanup);
+
+const NO_MOTION = { token: { motion: false } };
+
+it.each([1440, 390])(
+  'clears filters to All/Any and updates results without losing search or sort at %ipx',
+  async (width) => {
+    await page.viewport(width, 900);
+    const { client } = makeCatalogClient([
+      catalogEntry,
+      { ...catalogEntry, name: 'test/a', title: 'Keep A' },
+      { ...catalogEntry, name: 'test/b', title: 'Keep B', category: 'search' },
+      {
+        ...catalogEntry,
+        name: 'test/c',
+        title: 'Keep C',
+        category: 'search',
+        capabilities: ['logs'],
+      },
+    ]);
+    render(
+      <ConfigProvider theme={NO_MOTION}>
+        <MemoryRouter>
+          <CatalogTab
+            client={client}
+            connected
+            connecting={false}
+            authGeneration={1}
+            currentUser={catalogUser}
+          />
+        </MemoryRouter>
+      </ConfigProvider>
+    );
+    await screen.findByRole('button', { name: 'Open DeepWiki' });
+    await userEvent.fill(screen.getByRole('textbox', { name: 'Search MCP servers' }), 'keep');
+    if (width === 390) await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
+    const select = (name: string) => screen.getByRole('combobox', { name });
+    const control = (name: string) => select(name).closest<HTMLElement>('.ant-select')!;
+    const choose = async (name: string, option: string) => {
+      await userEvent.click(select(name));
+      const popup = document
+        .getElementById(select(name).getAttribute('aria-controls')!)
+        ?.closest<HTMLElement>('.ant-select-dropdown');
+      if (!popup) throw new Error(`${name} popup not found`);
+      await userEvent.click(within(popup).getByText(option, { exact: true }));
+    };
+    const category = control('Filter by category');
+    const capability = control('Filter by capability');
+    expect(within(category).getByText('All')).toBeVisible();
+    expect(within(capability).getByText('Any')).toBeVisible();
+    expect(category.querySelector('.ant-select-clear')).toBeNull();
+    expect(capability.querySelector('.ant-select-clear')).toBeNull();
+    await choose('Sort servers', 'A–Z');
+    await choose('Filter by category', 'Dev tools');
+    await choose('Filter by capability', 'Docs');
+
+    const expectResults = async (count: number) => {
+      await screen.findByText(`${count} of 4 servers match`);
+      const cards = screen.getAllByRole('button', { name: /^Open Keep/ });
+      expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(
+        ['Open Keep A', 'Open Keep B', 'Open Keep C'].slice(0, count)
+      );
+      expect(screen.queryByRole('button', { name: 'Open DeepWiki' })).toBeNull();
+      expect(screen.getByRole('textbox', { name: 'Search MCP servers' })).toHaveValue('keep');
+      expect(control('Sort servers')).toHaveTextContent('A–Z');
+      if (width === 390) {
+        expect(
+          screen.getByRole('button', {
+            name: count === 1 ? 'Filters, 2 active' : count === 2 ? 'Filters, 1 active' : 'Filters',
+          })
+        ).toBeVisible();
+        expect(
+          screen.getByRole('button', {
+            name: `Show ${coun
```

**File**: `apps/agor-ui/src/components/Marketplace/CatalogToolbar.test.tsx` (modified, +172/-19)
```diff
@@ -1,5 +1,6 @@
-import { fireEvent, render, screen, within } from '@testing-library/react';
-import { describe, expect, it, vi } from 'vitest';
+import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
+import { theme } from 'antd';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { CatalogToolbar } from './CatalogToolbar';
 
 function selectInput(label: string): HTMLElement {
@@ -21,7 +22,55 @@ function selectOption(label: string): void {
 }
 
 describe('Marketplace catalog toolbar', () => {
-  it('publishes category choices from the Segmented control and resets to All', () => {
+  it.each([1200, 390])(
+    'clears only the chosen filter and restores its default at %ipx',
+    async (width) => {
+      const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
+      const props = {
+        category: 'search' as const,
+        capability: 'web-search',
+        sort: 'name' as const,
+        search: 'documentation',
+        onSearchChange: vi.fn(),
+        onCategoryChange: vi.fn(),
+        onCapabilityChange: vi.fn(),
+        onSortChange: vi.fn(),
+        matchSummary: { matched: 1, total: 52 },
+      };
+      try {
+        const { rerender } = render(<CatalogToolbar {...props} />);
+        if (width === 390) {
+          fireEvent.click(screen.getByRole('button', { name: 'Filters, 2 active' }));
+          await screen.findByRole('dialog', { name: 'Filters' });
+        }
+        const category = selectInput('Filter by category').closest('.ant-select')!;
+        const capability = selectInput('Filter by capability').closest('.ant-select')!;
+        fireEvent.click(capability.querySelector('.ant-select-clear')!);
+        expect(props.onCapabilityChange).toHaveBeenCalledExactlyOnceWith(undefined);
+        expect(props.onCategoryChange).not.toHaveBeenCalled();
+        rerender(<CatalogToolbar {...props} capability={undefined} />);
+        expect(within(capability as HTMLElement).getByText('Any')).toBeVisible();
+        expect(capability.querySelector('.ant-select-clear')).toBeNull();
+        expect(within(category as HTMLElement).getByText('Search')).toBeVisible();
+
+        fireEvent.click(category.querySelector('.ant-select-clear')!);
+        expect(props.onCategoryChange).toHaveBeenCalledExactlyOnceWith(undefined);
+        rerender(<CatalogToolbar {...props} category={undefined} capability={undefined} />);
+        expect(within(category as HTMLElement).getByText('All')).toBeVisible();
+        expect(category.querySelector('.ant-select-clear')).toBeNull();
+        expect(props.onSearchChange).not.toHaveBeenCalled();
+        expect(props.onSortChange).not.toHaveBeenCalled();
+        expect(screen.getByRole('textbox', { name: 'Search MCP servers' })).toHaveValue(
+          'documentation'
+        );
+        expect(selectInput('Sort servers').closest('.ant-select')).toHaveTextContent('A–Z');
+      } finally {
+        widthSpy.mockRestore();
+      }
+    }
+  );
+
+  it('publishes category choices from the Category select and resets to All', () => {
     const onCategoryChange = vi.fn();
     const props = {
       category: 'observability' as const,
@@ -35,13 +84,15 @@ describe('Marketplace catalog toolbar', () => {
     };
     render(<CatalogToolbar {...props} />);
 
-    expect(screen.getByText('Observability').closest('label')).toHaveClass(
-      'ant-segmented-item-selected'
-    );
-    fireEvent.click(screen.getByText('Dev tools').closest('label')!);
+    const select = selectInput('Filter by category').closest('.ant-select') as HTMLElement;
+    expect(within(select).getByText('Category')).toBeVisible();
+    expect(within(select).getByText('Observability')).toBeVisible();
+    openSelect('Filter by category');
+    selectOption('Dev tools');
     expect(onCategoryChange).toHaveBeenLastCalledWith('dev-tools');
 
-    fireEvent.click(screen.getByText('All').closest('label')!);
+    open
```

**File**: `apps/agor-ui/src/components/Marketplace/CatalogToolbar.tsx` (modified, +191/-76)
```diff
@@ -1,7 +1,9 @@
 /**
  * Search and every filter, in one toolbar directly under the page header
  * (REQ-CAT-2). Splitting them across regions makes the user hunt for the
- * control that is narrowing their results.
+ * control that is narrowing their results. It is always one row: when the full
+ * row does not fit its container, the selects move into a bottom sheet behind
+ * one Filters button.
  *
  * The search box publishes every keystroke. It used to hold a draft and debounce
  * it, because each change was a request; now narrowing is a pass over an array
@@ -10,27 +12,41 @@
  */
 
 import type { MCPCatalogCategory, MCPCatalogSort } from '@agor/core/types';
-import { SearchOutlined } from '@ant-design/icons';
-import { Card, Col, Input, Row, Segmented, Select, Space, Typography, theme } from 'antd';
-import { memo } from 'react';
+import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
+import { Badge, Button, Drawer, Flex, Input, type InputRef, Select, Typography, theme } from 'antd';
+import type { RefSelectProps } from 'antd/es/select';
+import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
+import { useElementWidth } from '../../hooks/useElementWidth';
+import { reducedMotionSurface, usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
+import { glassSurfaceStyle } from '../GlassSurface/glassStyles';
 import {
   ALL_CATEGORIES,
+  ANY_CAPABILITY,
   CAPABILITY_GROUPS,
   CATEGORY_OPTIONS,
   type CategoryFilter,
   capabilityLabel,
+  DEFAULT_SORT,
   SORT_OPTIONS,
 } from './catalogPresentation';
+import { isFilterActive } from './useCatalogSearch';
 
 const { Text } = Typography;
 
-const CAPABILITY_OPTIONS = CAPABILITY_GROUPS.map((group) => ({
-  label: group.label,
-  options: group.capabilities.map((capability) => ({
-    label: capabilityLabel(capability),
-    value: capability,
+const SEARCH_MIN = 240;
+const FILTER_MIN = 180;
+const SORT_WIDTH = 150;
+
+const CAPABILITY_OPTIONS = [
+  { label: 'Any', value: ANY_CAPABILITY },
+  ...CAPABILITY_GROUPS.map((group) => ({
+    label: group.label,
+    options: group.capabilities.map((capability) => ({
+      label: capabilityLabel(capability),
+      value: capability,
+    })),
   })),
-}));
+];
 
 export interface CatalogToolbarProps {
   category?: MCPCatalogCategory;
@@ -42,7 +58,7 @@ export interface CatalogToolbarProps {
   onCategoryChange: (value?: MCPCatalogCategory) => void;
   onCapabilityChange: (value?: string) => void;
   onSortChange: (value: MCPCatalogSort) => void;
-  /** `null` while the unfiltered catalog size is still unknown. */
+  /** `null` until the catalog has loaded. */
   matchSummary: { matched: number; total: number } | null;
 }
 
@@ -58,75 +74,174 @@ const CatalogToolbarInner: React.FC<CatalogToolbarProps> = ({
   matchSummary,
 }) => {
   const { token } = theme.useToken();
+  const rootRef = useRef<HTMLDivElement>(null);
+  const searchRef = useRef<InputRef>(null);
+  const categoryRef = useRef<RefSelectProps>(null);
+  const sheetRef = useRef<HTMLDivElement>(null);
+  const returnToToolbar = useRef(false);
+  const width = useElementWidth(rootRef);
+  // Unmeasured (0) keeps the full row.
+  const compact =
+    width > 0 && width < SEARCH_MIN + 2 * FILTER_MIN + SORT_WIDTH + 3 * token.paddingSM;
+  const reducedMotion = usePrefersReducedMotion();
+  const [filtersOpen, setFiltersOpen] = useState(false);
+  // Mount the sheet on demand: left mounted while closed, it broke the host modal's Escape.
+  const [filtersMounted, setFiltersMounted] = useState(false);
+  const [filtersEntered, setFiltersEntered] = useState(false);
+  useEffect(() => {
+    // With motion disabled, afterOpenChange can precede the drawer's focus lock.
+    // Focus after its effects have run, not while the host still owns the lock.
+    if (compact && filtersOpen && filtersEntered) categoryRef.current?.focus();
+  }, [compact, filtersOpen, filtersEntered]);
+  useEffect(() => {
+    if (!filtersMounted && re
```

---

### Incident Patch 7: `f98219a5` (2026-09-29)
**Commit Message**: fix(ui): bound streaming syntax-highlight result retention (#2909)

**File**: `apps/agor-ui/src/test/streamdownCodeCache.test.ts` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+// biome-ignore-all lint/plugin/noHardcodedColorLiteral: custom syntax themes are test fixtures
+import {
+  type CodeHighlighterPlugin,
+  clearHighlightCache,
+  code,
+  createCodePlugin,
+  type HighlightOptions,
+  type HighlightResult,
+} from '@streamdown/code';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+const themes: HighlightOptions['themes'] = ['github-light', 'github-dark'];
+const options = (source: string, language = 'typescript'): HighlightOptions => ({
+  code: source,
+  language: language as HighlightOptions['language'],
+  themes,
+});
+function highlight(input: HighlightOptions, plugin: CodeHighlighterPlugin = code) {
+  return new Promise<HighlightResult>((resolve) => {
+    const result = plugin.highlight(input, resolve);
+    if (result) resolve(result);
+  });
+}
+function syntheticCode(length: number) {
+  let source = '';
+  for (let i = 0; source.length < length; i++) {
+    source += `${i ? '\n' : ''}const value${i} = compute(${i}, "s${i}") + ${i * 2}; // c${i}`;
+  }
+  return source.slice(0, length);
+}
+const text = (result: HighlightResult) =>
+  result.tokens.map((line) => line.map((token) => token.content).join('')).join('\n');
+const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
+
+beforeEach(() => clearHighlightCache());
+afterEach(() => {
+  clearHighlightCache();
+  vi.restoreAllMocks();
+  vi.unstubAllGlobals();
+});
+
+// Pins the installed pnpm patch used by richContentPlugins, not a host wrapper
+// that would still fill upstream's unbounded module cache.
+describe('Streamdown code result retention', () => {
+  it('evicts realistic streaming prefixes across consumers and plugin instances', {
+    timeout: 60_000,
+  }, async () => {
+    const source = syntheticCode(10_240);
+    // No retained result/callback array: each consumer goes away after delivery.
+    for (let end = 40; end <= source.length; end += 40) {
+      await highlight(options(source.slice(0, end)), createCodePlugin());
+    }
+    expect(text(await highlight(options(source)))).toBe(source);
+    // A second instance cannot create a second budget or recover evicted tokens.
+    const other = createCodePlugin();
+    expect(other.highlight(options(source))).not.toBeNull();
+    expect(other.highlight(options(source.slice(0, 40)))).toBeNull();
+    expect(other.highlight(options(source.slice(0, 5120)))).toBeNull();
+    await settle();
+  });
+
+  it('uses recency as well as an aggregate token-weight budget', async () => {
+    for (let i = 0; i < 32; i++) await highlight(options(`const tiny${i} = ${i};`));
+    expect(code.highlight(options('const tiny0 = 0;'))).not.toBeNull();
+    await highlight(options('const overflow = 32;'));
+    expect(code.highlight(options('const tiny0 = 0;'))).not.toBeNull();
+    expect(code.highlight(options('const tiny1 = 1;'))).toBeNull();
+    await settle();
+    clearHighlightCache();
+    const source = syntheticCode(10_240);
+    for (let i = 0; i < 16; i++) await highlight(options(`${source}\n// ${i}`));
+    // Far fewer than 32 entries: weight, not count, must have forced eviction.
+    expect(code.highlight(options(`${source}\n// 0`))).toBeNull();
+    expect(code.highlight(options(`${source}\n// 15`))).not.toBeNull();
+    await settle();
+  });
+
+  it('delivers but does not retain huge source or token-dense results', {
+    timeout: 60_000,
+  }, async () => {
+    for (const source of ['x'.repeat(65_537), `${'0;'.repeat(100)}\n`.repeat(300)]) {
+      expect(
+        text(await highlight(options(source, source.startsWith('x') ? 'text' : 'typescript')))
+      ).toBe(source);
+      // The second source fits admission length but exceeds token weight.
+      expect(
+        code.highlight(options(source, source.startsWith('x') ? 'text' : 'typescript'))
+      ).toBeNull();
+      await settle();
+    }
+  });
+
+  it('uses the whole content, not length plus first/last characters', async () => {
+    cons
```

**File**: `patches/@streamdown__code@1.1.1.patch` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+diff --git a/dist/index.d.ts b/dist/index.d.ts
+index a81a2bce32c943bc0aa3f678b1793491df75d5fb..7f41246c5f1469cb60c5e3bd3171f84c1c53c5c7 100644
+--- a/dist/index.d.ts
++++ b/dist/index.d.ts
+@@ -57,4 +57,7 @@ declare function createCodePlugin(options?: CodePluginOptions): CodeHighlighterP
+  */
+ declare const code: CodeHighlighterPlugin;
+ 
+-export { type CodeHighlighterPlugin, type CodePluginOptions, type HighlightOptions, type HighlightResult, type ThemeInput, code, createCodePlugin };
++/** Clear retained browser results and cancel pending result delivery (Agor patch). */
++declare function clearHighlightCache(): void;
++
++export { clearHighlightCache, type CodeHighlighterPlugin, type CodePluginOptions, type HighlightOptions, type HighlightResult, type ThemeInput, code, createCodePlugin };
+diff --git a/dist/index.js b/dist/index.js
+index 1fcb536121ccb3c40a4bd2acf44f03b4836ae3cc..54d0ebc64129399e324ef42270f09e372b0123c7 100644
+--- a/dist/index.js
++++ b/dist/index.js
+@@ -1 +1,153 @@
+-import {bundledLanguagesInfo,bundledLanguages,createHighlighter}from'shiki';import {createJavaScriptRegexEngine}from'shiki/engine/javascript';var S=createJavaScriptRegexEngine({forgiving:true}),C=Object.fromEntries(bundledLanguagesInfo.flatMap(e=>{var n;return ((n=e.aliases)!=null?n:[]).map(t=>[t,e.id])})),r=new Set(Object.keys(bundledLanguages)),B=e=>{let t=e.trim().toLowerCase(),g=C[t];return g||(r.has(t),t)},c=new Map,p=new Map,s=new Map,o=e=>{var n;return typeof e=="string"?e:(n=e.name)!=null?n:"custom"},v=(e,n)=>`${e}-${o(n[0])}-${o(n[1])}`,x=(e,n,t)=>{let g=e.slice(0,100),u=e.length>100?e.slice(-100):"";return `${n}:${t[0]}:${t[1]}:${e.length}:${g}:${u}`},P=(e,n)=>{let t=v(e,n);if(c.has(t))return c.get(t);let g=createHighlighter({themes:n,langs:[e],engine:S});return c.set(t,g),g};function $(e={}){var t;let n=(t=e.themes)!=null?t:["github-light","github-dark"];return {name:"shiki",type:"code-highlighter",supportsLanguage(g){let u=B(g);return r.has(u)},getSupportedLanguages(){return Array.from(r)},getThemes(){return n},highlight({code:g,language:u,themes:h},m){let i=B(u),d=[o(h[0]),o(h[1])],a=x(g,i,d);if(p.has(a))return p.get(a);m&&(s.has(a)||s.set(a,new Set),s.get(a).add(m));let f=r.has(i)?i:"text";return P(f,h).then(l=>{let y=l.getLoadedLanguages().includes(i)?i:"text",L=l.codeToTokens(g,{lang:y,themes:{light:d[0],dark:d[1]}});p.set(a,L);let T=s.get(a);if(T){for(let H of T)H(L);s.delete(a);}}).catch(l=>{console.error("[Streamdown Code] Failed to highlight code:",l),s.delete(a);}),null}}}var G=$();export{G as code,$ as createCodePlugin};
+\ No newline at end of file
++import { bundledLanguagesInfo, bundledLanguages, createHighlighter } from 'shiki';
++import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
++
++const engine = createJavaScriptRegexEngine({ forgiving: true });
++const aliases = Object.fromEntries(bundledLanguagesInfo.flatMap(info =>
++  (info.aliases ?? []).map(alias => [alias, info.id])));
++const languages = new Set(Object.keys(bundledLanguages));
++const normalize = language => {
++  const id = language.trim().toLowerCase();
++  return aliases[id] || id;
++};
++
++// Agor patch: one browser-realm budget across ALL plugin instances, not one
++// unbounded result Map per module (or a fresh budget per mounted consumer).
++// These are retention/admission limits, NOT an absolute JS heap-byte cap.
++// Grammar/theme/engine state and live consumers/in-flight work are separate.
++const MAX_ENTRIES = 32;
++const MAX_WEIGHT = 4 * 1024 * 1024;
++const MAX_CODE_LENGTH = 64 * 1024;
++const results = new Map();
++const pending = new Map();
++let retainedWeight = 0;
++let generation = 0;
++
++// Full source participates in equality. The upstream first/last-100-character
++// shortcut aliases same-length edits in the middle of a fence.
++const themeIds = new WeakMap();
++let nextThemeId = 0;
++const themeId = theme => {
++  if (typeof theme === 'string') return theme;
++  let id = themeIds.get(th
```

**File**: `pnpm-lock.yaml` (modified, +3/-2)
```diff
@@ -72,6 +72,7 @@ overrides:
 
 patchedDependencies:
   '@rc-component/util@1.13.0': b9106e9587099133a5b54cf6e8075a8bab098413d2d1b986302739eb06106a27
+  '@streamdown/code@1.1.1': 6c4a3e4bb1c8f4eb48df153df1da1f2f448f68f4c1508c0cfd1df001c15ca023
   streamdown@2.5.0: 19300059403a0f3973e236d4d8049c92a6d5a3422d55cdf1653207fda4ddb8a4
 
 importers:
@@ -431,7 +432,7 @@ importers:
         version: 1.0.3(@types/mdast@4.0.4)(micromark-util-types@2.0.2)(micromark@4.0.2(supports-color@8.1.1))(react@19.3.0)(supports-color@8.1.1)(unified@11.0.5)
       '@streamdown/code':
         specifier: ^1.1.1
-        version: 1.1.1(react@19.3.0)
+        version: 1.1.1(patch_hash=6c4a3e4bb1c8f4eb48df153df1da1f2f448f68f4c1508c0cfd1df001c15ca023)(react@19.3.0)
       '@streamdown/math':
         specifier: ^1.0.2
         version: 1.0.2(react@19.3.0)(supports-color@8.1.1)
@@ -15037,7 +15038,7 @@ snapshots:
       - supports-color
       - unified
 
-  '@streamdown/code@1.1.1(react@19.3.0)':
+  '@streamdown/code@1.1.1(patch_hash=6c4a3e4bb1c8f4eb48df153df1da1f2f448f68f4c1508c0cfd1df001c15ca023)(react@19.3.0)':
     dependencies:
       react: 19.3.0
       shiki: 3.23.0
```

**File**: `pnpm-workspace.yaml` (modified, +4/-0)
```diff
@@ -109,6 +109,10 @@ patchedDependencies:
   # Remove once upstream useDelayState includes effect cleanup; regression:
   # apps/agor-ui/src/test/antdDelayState.test.tsx.
   '@rc-component/util@1.13.0': patches/@rc-component__util@1.13.0.patch
+  # Bound shared browser token retention; full-content/theme identity and async cleanup.
+  # Remove when upstream supplies equivalent limits and lifecycle correctness.
+  # Regression: apps/agor-ui/src/test/streamdownCodeCache.test.ts.
+  '@streamdown/code@1.1.1': patches/@streamdown__code@1.1.1.patch
   streamdown@2.5.0: patches/streamdown@2.5.0.patch
 # These reviewed versions must remain installable when CI or an operator's
 # global pnpm config enforces minimumReleaseAge; this repo sets no age itself.
```

---

### Incident Patch 8: `d4c9816f` (2026-09-29)
**Commit Message**: feat(mcp): explicit private/shared installs and audit fixes (#2913)

* feat(mcp): make Catalog and manual sharing explicit and credential-safe

* fix(mcp): preserve caller reconnect and warn on shared edits

* test(mcp): cover explicit ownership across UI and tenants

* fix(ui): keep catalog provider copy stable while sharing refreshes

* fix(mcp): allow restricted members to reuse shared catalog installs

* fix(mcp): clarify existing shared catalog guidance

* test(ui): await context popover exit before checking visibility

**File**: `apps/agor-daemon/src/register-routes.mcp-attachment.integration.test.ts` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+import { once } from 'node:events';
+import type { AddressInfo } from 'node:net';
+import {
+  BranchRepository,
+  createDatabaseAsync,
+  createTenantScopedDatabaseProxy,
+  generateId,
+  MCPServerRepository,
+  RepoRepository,
+  runMigrations,
+  runWithTenantDatabaseScope,
+  SessionMCPServerRepository,
+  SessionRepository,
+  UsersRepository,
+} from '@agor/core/db';
+import {
+  type Application,
+  errorHandler,
+  feathers,
+  feathersExpress,
+  NotAuthenticated,
+  rest,
+  socketio,
+} from '@agor/core/feathers';
+import type { AuthenticatedParams, User } from '@agor/core/types';
+import { expect, it, vi } from 'vitest';
+import { type RegisterRoutesContext, registerRoutes } from './register-routes';
+import { SessionMCPServersService } from './services/session-mcp-servers';
+
+it('registered HTTP attachment returns 403 for foreign private rows, including admins', async () => {
+  const raw = await createDatabaseAsync({ dialect: 'sqlite', url: ':memory:' });
+  await runMigrations(raw);
+  const db = createTenantScopedDatabaseProxy(raw, { requireScope: true });
+  const scoped = <T>(work: () => Promise<T>) => runWithTenantDatabaseScope(db, 'default', work);
+  const usersRepository = new UsersRepository(db);
+  const sessionsRepository = new SessionRepository(db);
+  const branchRepository = new BranchRepository(db);
+  const serverRepo = new MCPServerRepository(db);
+  const f = await scoped(async () => {
+    const alice = await usersRepository.create({ email: 'alice@example.invalid', role: 'member' });
+    const bob = await usersRepository.create({ email: 'bob@example.invalid', role: 'member' });
+    const admin = await usersRepository.create({ email: 'admin@example.invalid', role: 'admin' });
+    const repo = await new RepoRepository(db).create({
+      repo_id: generateId(),
+      slug: generateId(),
+      name: 'Test',
+      repo_type: 'remote',
+      remote_url: 'https://example.invalid/test',
+      local_path: '/disposable/test',
+      default_branch: 'main',
+    });
+    const branch = await branchRepository.create({
+      branch_id: generateId(),
+      repo_id: repo.repo_id,
+      name: 'test',
+      ref: 'main',
+      path: '/disposable/test/branch',
+      branch_unique_id: 1,
+      created_by: alice.user_id,
+    });
+    const sessions = await Promise.all(
+      [alice, admin].map((user) =>
+        sessionsRepository.create({
+          session_id: generateId(),
+          branch_id: branch.branch_id,
+          agentic_tool: 'codex',
+          created_by: user.user_id,
+          status: 'idle',
+        })
+      )
+    );
+    const own = await serverRepo.create({
+      name: 'own',
+      transport: 'http',
+      url: 'https://example.invalid/mcp',
+      scope: 'session',
+      owner_user_id: alice.user_id,
+    });
+    const foreign = await serverRepo.create({
+      name: 'foreign',
+      transport: 'http',
+      url: 'https://example.invalid/mcp',
+      scope: 'session',
+      owner_user_id: bob.user_id,
+    });
+    const shared = await serverRepo.create({
+      name: 'shared',
+      transport: 'http',
+      url: 'https://example.invalid/mcp',
+      scope: 'session',
+    });
+    return { alice, admin, sessions, own, foreign, shared };
+  });
+  const app = feathersExpress(feathers());
+  app.use(feathersExpress.json());
+  app.configure(rest());
+  app.configure(socketio());
+  // The standalone deployment's trusted tenant boundary; the DB refuses any
+  // repository access outside this unit, including nested service methods.
+  app.hooks({ around: { all: [(_context, next) => scoped(next)] } });
+  for (const path of ['users', 'tasks', 'repos', 'branches', 'session-mcp-servers'])
+    app.use(path, {
+      async get() {
+        return {};
+      },
+    });
+  app.use('sessions', {
+    get: (id: string) => sessionsRepository.findById(id),
+    setQueueProcessor: () => {},
+  });
+  const stop = new Error('MCP routes registered');
+  c
```

**File**: `apps/agor-daemon/src/register-routes.ts` (modified, +7/-4)
```diff
@@ -69,9 +69,9 @@ import {
   NotFound,
 } from '@agor/core/feathers';
 import {
+  isMCPServerNotUsableError,
   isMCPServerUsableBy,
   MCP_RUNTIME_PROVIDER_CAPABILITIES,
-  MCPServerNotUsableError,
   mcpRuntimeProviderCapability,
 } from '@agor/core/mcp';
 import type {
@@ -197,6 +197,7 @@ import {
 } from './permissions/deliver-permission-decision.js';
 import { publicBoardCommentRepositionInput } from './services/board-comments.js';
 import type { GatewayService } from './services/gateway.js';
+import { authorizeCatalogCaller } from './services/mcp-catalog-access.js';
 import { createMCPCatalogConnectService } from './services/mcp-catalog-connect.js';
 import { createMCPCatalogStartSessionService } from './services/mcp-catalog-start-session.js';
 import { isMCPOAuthGrantAuthorizedForServer } from './services/mcp-oauth-grant-authority.js';
@@ -752,6 +753,8 @@ export function createRegisteredMCPCatalogConnectService(
     return tenantId ? runWithTenantDatabaseScope(db, tenantId, work) : work();
   };
   return createMCPCatalogConnectService(app, {
+    authorizeCaller: (params) =>
+      runInTenantDatabaseScope(params, () => authorizeCatalogCaller(db, params)),
     runInTenantDatabaseScope,
     async listCandidates(userId, params) {
       const read = async () => new MCPCatalogCandidateRepository(db).listForUser(userId);
@@ -5376,7 +5379,7 @@ export async function registerRoutes(ctx: RegisterRoutesContext): Promise<void>
             params
           );
         } catch (error) {
-          if (error instanceof MCPServerNotUsableError) {
+          if (isMCPServerNotUsableError(error)) {
             throw new Forbidden('That MCP server is private to another user');
           }
           throw error;
@@ -5437,7 +5440,7 @@ export async function registerRoutes(ctx: RegisterRoutesContext): Promise<void>
             )
           );
         } catch (error) {
-          if (error instanceof MCPServerNotUsableError) {
+          if (isMCPServerNotUsableError(error)) {
             throw new Forbidden('That MCP server is private to another user');
           }
           throw error;
@@ -6564,7 +6567,7 @@ export async function registerRoutes(ctx: RegisterRoutesContext): Promise<void>
             try {
               await sessionMCPServersService.setServers(session.session_id, serverIds, params);
             } catch (error) {
-              if (error instanceof MCPServerNotUsableError) {
+              if (isMCPServerNotUsableError(error)) {
                 throw new Forbidden('An MCP server is private to another user');
               }
               throw error;
```

**File**: `apps/agor-daemon/src/register-services.oauth-sqlite.integration.test.ts` (modified, +97/-0)
```diff
@@ -20,6 +20,7 @@ import {
   SessionRepository,
   setMCPEgressGatewayMode,
   setMCPSlackConnectCardEnabled,
+  setMcpMemberPolicy,
   shortId,
   TaskRepository,
   type TenantScopeAwareDatabase,
@@ -4814,6 +4815,102 @@ describe('SQLite saved-row OAuth authority', () => {
     }
   });
 
+  it.each(['use_existing_only', 'allow_private_only'] as const)(
+    'lets a %s member acquire only their own grant on canonical shared Catalog configuration',
+    async (policy) => {
+      const provider = await createTestProvider();
+      providers.push(provider);
+      const harness = await createHarness(provider, 'per_user', { catalogPeer: true });
+      databases.push(harness.rawDb);
+      const entry = {
+        name: 'test/shared-member-grant',
+        title: 'Shared Member Grant',
+        transport: 'streamable-http',
+        remote_url: provider.savedMcpUrl,
+        has_remote: true,
+        auth_type: 'oauth',
+        oauth: { client_id: 'saved-client-id', compatibility_mode: 'strict' },
+        permission_disclosure: 'Local provider fixture only.',
+      } as MCPCatalogEntry;
+      // Controlled fixture: published configuration, not a claimed live Catalog
+      // provider E2E. Start/callback/token persistence below are the real lane.
+      await update(harness.rawDb, mcpServers)
+        .set({
+          owner_user_id: null,
+          scope: 'session',
+          source: 'catalog',
+          catalog_entry_name: entry.name,
+        })
+        .where(eq(mcpServers.mcp_server_id, harness.server.mcp_server_id))
+        .run();
+      vi.mocked(loadCatalog).mockResolvedValue([entry]);
+      await new UsersRepository(harness.rawDb).update(harness.user.user_id, { role: 'member' });
+      harness.liveSocket.feathers.user = { ...harness.user, role: 'member' };
+      await setMcpMemberPolicy(harness.rawDb, policy, undefined, null);
+      registerProductionHooksForHarness(harness);
+      harness.app.use('mcp-catalog', {
+        async get() {
+          return entry;
+        },
+      } as never);
+      const repository = new MCPServerRepository(harness.rawDb);
+      const before = await repository.findById(harness.server.mcp_server_id);
+      const connect = () =>
+        createRegisteredMCPCatalogConnectService(harness.app, harness.db).create(
+          {
+            catalog_key: entry.name,
+            sharing: 'shared',
+            acknowledged_disclosure: entry.permission_disclosure,
+          },
+          paramsFor(harness)
+        );
+      expect((await connect()).mcp_server.auth?.oauth_access_token).toBeUndefined();
+      await authorizeSavedServer(harness);
+      expect((await connect()).mcp_server.auth?.oauth_access_token).toBeTruthy();
+      const grants = new UserMCPOAuthTokenRepository(harness.rawDb);
+      expect(
+        await grants.getToken(harness.user.user_id as UserID, harness.server.mcp_server_id)
+      ).toMatchObject({
+        oauth_access_token: 'sqlite-access-token',
+        grant_binding_version: 4,
+      });
+      expect(await grants.getToken(null, harness.server.mcp_server_id)).toBeNull();
+      expect(await repository.findById(harness.server.mcp_server_id)).toEqual(before);
+      await expect(
+        harness.app
+          .service('mcp-servers')
+          .patch(
+            harness.server.mcp_server_id,
+            { url: 'https://not-allowed.example/mcp' },
+            paramsFor(harness)
+          )
+      ).rejects.toMatchObject({ code: 403 });
+      // Bounded advisory check: allow_crud keeps its documented edit authority,
+      // but a binding change must retire every user's grant, not only the editor's.
+      const other = await new UsersRepository(harness.rawDb).create({
+        email: 'other-grant@example.test',
+        role: 'member',
+      });
+      await grants.saveToken(other.user_id, harness.server.mcp_server_id, {
+        accessToken: 'other-fixture-token',
+        resourceUri: provider.savedMcpUrl,
+      });
+      await s
```

**File**: `apps/agor-daemon/src/services/mcp-catalog-access.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { type TenantScopeAwareDatabase, UsersRepository } from '@agor/core/db';
+import { BadRequest, NotAuthenticated } from '@agor/core/feathers';
+import type { AuthenticatedParams, MCPCatalogSharing } from '@agor/core/types';
+import { assertMcpCapabilityRole } from '../utils/mcp-server-authorization.js';
+
+export function readCatalogSharing(value: unknown): MCPCatalogSharing {
+  if (value === undefined) return 'private';
+  if (value === 'private' || value === 'shared') return value;
+  throw new BadRequest('sharing must be private or shared');
+}
+
+/** Called in a short trusted tenant unit, again after the external probe. */
+export async function authorizeCatalogCaller(
+  db: TenantScopeAwareDatabase,
+  params: AuthenticatedParams
+): Promise<AuthenticatedParams> {
+  const user = params.user?.user_id
+    ? await new UsersRepository(db).findById(params.user.user_id)
+    : undefined;
+  if (!user) throw new NotAuthenticated('Authentication required');
+  const current = { ...params, user: { ...params.user, role: user.role } } as AuthenticatedParams;
+  assertMcpCapabilityRole(current, 'connect MCP servers');
+  // Using a canonical shared row does not publish or configure it. Connect
+  // validates the actual selected row; any create/repair still goes through
+  // mcp-servers' current-policy write authorizer. Viewers cannot mint use/OAuth
+  // capabilities even when a row already exists.
+  return current;
+}
```

**File**: `apps/agor-daemon/src/services/mcp-catalog-connect.api-key.test.ts` (modified, +2/-0)
```diff
@@ -1,3 +1,4 @@
+import { authorizeCatalogCaller } from './mcp-catalog-access.js';
 /**
  * Where a marketplace API key ends up, and who can read it back.
  *
@@ -212,6 +213,7 @@ async function buildDaemon(entry: MCPCatalogEntry = CURATED) {
     }) as unknown as AuthenticatedParams;
   const candidateRepo = new MCPCatalogCandidateRepository(rawDb);
   const connectDeps = {
+    authorizeCaller: (params: AuthenticatedParams) => authorizeCatalogCaller(rawDb, params),
     runInTenantDatabaseScope: <T>(
       _params: AuthenticatedParams,
       work: () => Promise<T>
```

---

### Incident Patch 9: `8b5a097a` (2026-09-29)
**Commit Message**: fix(ui): compact, unified header type scale for board and session panels (#2904)

* fix(ui): compact, unified header type scale for board and session panels

- Board panel tabs: 12px labels, 12px gutter, shorter bar; the active tab
  gets strong weight + primary color. The "…" overflow menu is hidden so
  the tab list scrolls (wheel/touch) instead; all four tabs fit at 320px.
- Tab-bar insets live in tabBarExtraContent (left spacer, chevron's 4px
  right inset) instead of tab-bar padding, so antd's overflow math sees
  them and even a few px of overflow shows the edge fade and scrolls.
- Comments unread counter is in-flow inside its tab (raised into the top
  padding, tucked over the label end) so the scrolling list never clips it.
- Teammate header: 16px/600 name (Title level 5), 24px emoji/icon.
- Session drawer header: 16px/600 title, 24px tool icon, and one quiet
  12px line "● Idle · [avatar] <user>" with a "Created by" tooltip.
- Shared 16px horizontal header padding; sentence-case section labels
  (Sessions, Queued tasks) in both panels.

Replace/Clear primary teammate removal is handled in #2903.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix(ui): preserve 

**File**: `apps/agor-ui/src/components/BoardTeammatePanel/BoardTeammatePanel.tabs.browser.test.tsx` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+import type { Board } from '@agor-live/client';
+import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
+import { App, ConfigProvider, theme } from 'antd';
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+import { cdp, userEvent } from 'vitest/browser';
+import '../../index.css';
+import { EMPTY_MAPS } from '../../store/agorMaps';
+import { agorStore } from '../../store/agorStore';
+import { checkBrowserSanity } from '../../test/browserSanity';
+import { BoardTeammatePanel } from './BoardTeammatePanel';
+
+checkBrowserSanity();
+
+const board = { board_id: 'board-1', name: 'Board' } as Board;
+
+beforeEach(() => agorStore.setState({ ...EMPTY_MAPS }));
+afterEach(cleanup);
+
+function contains(outer: DOMRect, inner: DOMRect) {
+  return (
+    inner.left >= outer.left - 0.5 &&
+    inner.right <= outer.right + 0.5 &&
+    inner.top >= outer.top - 0.5 &&
+    inner.bottom <= outer.bottom + 0.5
+  );
+}
+
+it.each([1, 12])(
+  'keeps all tabs and a %i unread counter unclipped at the 320px minimum',
+  async (count) => {
+    render(
+      <App>
+        <div style={{ height: 600, width: 320 }}>
+          <BoardTeammatePanel
+            board={board}
+            activeTab="all-sessions"
+            primaryTeammateInaccessible={false}
+            unreadCommentsCount={count}
+            onSessionClick={vi.fn()}
+            onCollapse={vi.fn()}
+            client={null}
+          />
+        </div>
+      </App>
+    );
+
+    const counter = await screen.findByTitle(String(count));
+    // The tab list's scroll viewport is what clips; antd exposes no role for it.
+    const viewport = counter.closest('.ant-tabs-nav-wrap')!.getBoundingClientRect();
+    expect(contains(viewport, counter.getBoundingClientRect())).toBe(true);
+    for (const tab of screen.getAllByRole('tab')) {
+      expect(contains(viewport, tab.getBoundingClientRect())).toBe(true);
+    }
+  }
+);
+
+it('shows the edge fade and scrolls when the tabs overflow by only a few pixels', async () => {
+  const panel = (width: number) => (
+    <App>
+      <div style={{ height: 600, width }}>
+        <BoardTeammatePanel
+          board={board}
+          activeTab="all-sessions"
+          primaryTeammateInaccessible={false}
+          unreadCommentsCount={12}
+          onSessionClick={vi.fn()}
+          onCollapse={vi.fn()}
+          client={null}
+        />
+      </div>
+    </App>
+  );
+  const { rerender } = render(panel(600));
+  const counter = await screen.findByTitle('12');
+  const viewport = counter.closest<HTMLElement>('.ant-tabs-nav-wrap')!;
+  const list = viewport.firstElementChild as HTMLElement;
+  const bar = viewport.parentElement!;
+  // Everything in the bar that is not the tab list, plus the panel's 1px border.
+  const chrome = bar.getBoundingClientRect().width - viewport.getBoundingClientRect().width + 1;
+
+  rerender(panel(Math.ceil(chrome + list.scrollWidth) - 6));
+
+  await waitFor(() => expect(viewport).toHaveClass('ant-tabs-nav-wrap-ping-right'));
+  expect(contains(viewport.getBoundingClientRect(), counter.getBoundingClientRect())).toBe(false);
+  fireEvent.wheel(viewport, { deltaX: 50 });
+  await waitFor(() =>
+    expect(contains(viewport.getBoundingClientRect(), counter.getBoundingClientRect())).toBe(true)
+  );
+  expect(viewport).toHaveClass('ant-tabs-nav-wrap-ping-left');
+});
+
+it.each(['light', 'dark'])(
+  'keeps overflowing 99+ tabs reachable without the menu (%s)',
+  async (mode) => {
+    render(
+      <ConfigProvider
+        theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}
+      >
+        <App>
+          <div style={{ height: 600, width: 320 }}>
+            <BoardTeammatePanel
+              board={board}
+              primaryTeammateInaccessible={false}
+              unreadCommentsCount={100}
+              onSessionClick={vi.fn()}
+              onCollapse={vi.fn()}
+              client={
```

**File**: `apps/agor-ui/src/components/BoardTeammatePanel/BoardTeammatePanel.tsx` (modified, +65/-33)
```diff
@@ -290,36 +290,42 @@ const BoardTeammatePanelComponent: React.FC<BoardTeammatePanelProps> = ({
               borderBottom: `1px solid ${token.colorBorderSecondary}`,
             }}
           >
-            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
+            <div
+              style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, minWidth: 0 }}
+            >
               <div
                 style={{
-                  width: 36,
-                  height: 36,
+                  width: token.fontSizeHeading3,
+                  height: token.fontSizeHeading3,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   flexShrink: 0,
                 }}
               >
                 {isCreating ? (
-                  <Spin />
+                  <Spin size="small" />
                 ) : teammateConfig?.emoji ? (
-                  <span style={{ fontSize: 30 }}>{teammateConfig.emoji}</span>
+                  <span style={{ fontSize: token.fontSizeHeading3, lineHeight: 1 }}>
+                    {teammateConfig.emoji}
+                  </span>
                 ) : (
-                  <RobotOutlined style={{ fontSize: 30, color: token.colorInfo }} />
+                  <RobotOutlined
+                    style={{ fontSize: token.fontSizeHeading3, color: token.colorInfo }}
+                  />
                 )}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                 <Typography.Title
-                  level={4}
-                  style={{ margin: 0, fontWeight: 600 }}
+                  level={5}
+                  style={{ margin: 0 }}
                   ellipsis={{
                     tooltip: teammateConfig?.displayName ?? primaryTeammateBranch.name,
                   }}
                 >
                   {teammateConfig?.displayName ?? primaryTeammateBranch.name}
                 </Typography.Title>
-                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
+                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                   Primary teammate
                 </Typography.Text>
               </div>
@@ -507,16 +513,30 @@ const BoardTeammatePanelComponent: React.FC<BoardTeammatePanelProps> = ({
           {
             key: 'comments',
             label: (
-              <Badge
-                count={unreadCommentsCount}
-                size="small"
-                offset={[8, 0]}
-                style={{
-                  backgroundColor: hasUserMentions ? token.colorError : token.colorPrimaryBgHover,
-                }}
-              >
-                <span>Comments</span>
-              </Badge>
+              <span style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
+                Comments
+                {/* In-flow (so the tab measures it and the scrolling list never clips it),
+                    raised into the tab's top padding and tucked over the label's end. */}
+                <Badge
+                  count={unreadCommentsCount}
+                  size="small"
+                  styles={{
+                    root: {
+                      position: 'relative',
+                      top: -token.paddingXS,
+                      // An empty badge still has a root; do not subtract from
+                      // the measured label width after the unread count clears.
+                      marginInlineStart: unreadCommentsCount > 0 ? -token.marginXS : 0,
+                    },
+                    indicator: {
+                      paddingInline: token.paddingXXS,
+                      backgroundColor: hasUserMentions
+                        ? token.colorError
+                        : token.colorPrimaryBgHover,
+                    },
+                  }}
+                />
+              </span>
       
```

**File**: `apps/agor-ui/src/components/BranchCard/BranchSessionSections.tsx` (modified, +1/-3)
```diff
@@ -920,12 +920,10 @@ export const BranchSessionSections: React.FC<BranchSessionSectionsProps> = ({
     );
   };
 
-  // Section headers use the session panel's uppercase label ("Queued Tasks").
+  // Section headers match the session panel's queue label ("Queued tasks").
   const sectionLabelStyle: React.CSSProperties = {
     fontSize: token.fontSizeSM,
     fontWeight: 500,
-    letterSpacing: '0.5px',
-    textTransform: 'uppercase',
   };
   const renderSectionLabel = (label: string) => (
     <Typography.Text type="secondary" style={sectionLabelStyle}>
```

**File**: `apps/agor-ui/src/components/HomePage/StatusDot.tsx` (modified, +4/-1)
```diff
@@ -12,6 +12,9 @@ const STATUS_LABELS: Record<string, string> = {
   completed: 'Completed',
 };
 
+export const getSessionStatusLabel = (status: string) =>
+  STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
+
 const STATUS_ANIMATION: Record<string, string> = {
   running: 'status-dot-run',
   awaiting_permission: 'status-dot-wait',
@@ -39,7 +42,7 @@ export const StatusDot: React.FC<{ status: string; size?: number }> = ({ status,
   })();
 
   const cls = STATUS_ANIMATION[status] ?? '';
-  const label = STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
+  const label = getSessionStatusLabel(status);
   return (
     <Tooltip title={label}>
       <span
```

**File**: `apps/agor-ui/src/components/SessionPanel/SessionPanel.header.browser.test.tsx` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+import type { Session, User } from '@agor-live/client';
+import { cleanup, render, screen, waitFor } from '@testing-library/react';
+import { App, ConfigProvider, theme } from 'antd';
+import { afterEach, expect, it, vi } from 'vitest';
+import { page, userEvent } from 'vitest/browser';
+import { AppActionsProvider } from '../../contexts/AppActionsContext';
+import { agorStore } from '../../store/agorStore';
+import { checkBrowserSanity } from '../../test/browserSanity';
+import { MOBILE_SHELL_MAX_WIDTH } from '../../utils/deviceDetection';
+import SessionPanel from './SessionPanel';
+
+// Keep the real header and responsive shell; the transcript/composer are unrelated.
+vi.mock('./SessionPanelContent', () => ({ SessionPanelContent: () => null }));
+vi.mock('./SessionFooter', () => ({ SessionFooter: () => null }));
+vi.mock('../ForkSpawnModal/ForkSpawnModal', () => ({ ForkSpawnModal: () => null }));
+
+checkBrowserSanity();
+const originalViewport = { width: window.innerWidth, height: window.innerHeight };
+afterEach(async () => {
+  cleanup();
+  agorStore.setState({ userById: new Map() });
+  await page.viewport(originalViewport.width, originalViewport.height);
+});
+
+it.each(['light', 'dark'])(
+  'bounds creator attribution and preserves header actions (%s)',
+  async (mode) => {
+    if (originalViewport.width > 320) await page.viewport(1440, 900);
+    const creator = {
+      user_id: 'creator',
+      name: 'Averylongunbrokencreatordisplaynamethatmustnotcoverheaderactions'.repeat(2),
+    } as User;
+    const session = {
+      session_id: 'session-1',
+      agentic_tool: 'codex',
+      title: 'Review panel headers',
+      status: 'awaiting_permission',
+      created_by: creator.user_id,
+    } as unknown as Session;
+    const onUpdateSession = vi.fn();
+    const onClose = vi.fn();
+    agorStore.setState({ userById: new Map([[creator.user_id, creator]]) });
+    render(
+      <ConfigProvider
+        theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}
+      >
+        <App>
+          <AppActionsProvider value={{ onUpdateSession }}>
+            <div style={{ width: Math.min(window.innerWidth, 480), height: 600 }}>
+              <SessionPanel client={null} session={session} open onClose={onClose} />
+            </div>
+          </AppActionsProvider>
+        </App>
+      </ConfigProvider>
+    );
+
+    expect(screen.getByText('Awaiting permission')).toBeVisible();
+    const name = screen.getByText(creator.name!);
+    expect(name.parentElement!.querySelector('.ant-avatar')!.getBoundingClientRect().width).toBe(
+      16
+    );
+    const more = screen.getByRole('button', { name: 'More actions' });
+    await waitFor(() => {
+      expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(
+        more.getBoundingClientRect().left
+      );
+    });
+    await userEvent.hover(name);
+    await waitFor(() => expect(screen.getByText(`Created by ${creator.name}`)).toBeVisible());
+
+    await userEvent.click(screen.getByRole('button', { name: /Review panel headers/ }));
+    const input = screen.getByPlaceholderText('Untitled session');
+    expect(getComputedStyle(input).fontSize).toBe('16px');
+    await userEvent.fill(input, 'Renamed session');
+    await userEvent.keyboard('{Enter}');
+    expect(onUpdateSession).toHaveBeenCalledWith(session.session_id, { title: 'Renamed session' });
+
+    const mobile = window.innerWidth < MOBILE_SHELL_MAX_WIDTH;
+    const close = screen.getByRole('button', {
+      name: mobile ? 'Close' : 'Close panel',
+    });
+    const search = screen.getByRole('button', { name: 'Search session' });
+    if (mobile) {
+      for (const button of [close, more, search]) {
+        expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
+        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
+      }
+    }
+    await userEvent.click(search);
+    expect(screen.getByPlaceholderT
```

---

### Incident Patch 10: `95b14fa2` (2026-09-29)
**Commit Message**: fix(mcp): scope session choices and confirm delete-and-detach (#2899)

* fix(mcp): scope session choices and confirm atomic server detachment

* test(mcp): align picker fixtures and mutation guard coverage

* fix(mcp): preserve picker labels and focus during eligibility refresh

**File**: `apps/agor-daemon/src/mcp-egress/coordination.test.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import { runWithTenantDatabaseTransaction } from '@agor/core/db';
+import type { HookContext } from '@agor/core/types';
+import { expect, vi } from 'vitest';
+import { dbTest } from '../../../../packages/core/src/db/test-helpers';
+import { coordinateMCPServerMutationAfterWrite } from './coordination';
+
+dbTest(
+  'server revocation cancels local calls only after commit, never after rollback',
+  async ({ db }) => {
+    const gateway = { abortServer: vi.fn().mockReturnValue(0) };
+    const context = {
+      params: { tenant: { tenant_id: 'default' } },
+      result: { mcp_server_id: 'deleted-server' },
+    } as unknown as HookContext;
+    await expect(
+      runWithTenantDatabaseTransaction(db, 'default', async () => {
+        coordinateMCPServerMutationAfterWrite(context, gateway);
+        expect(gateway.abortServer).not.toHaveBeenCalled();
+        throw new Error('rollback');
+      })
+    ).rejects.toThrow('rollback');
+    expect(gateway.abortServer).not.toHaveBeenCalled();
+    await runWithTenantDatabaseTransaction(db, 'default', async () => {
+      coordinateMCPServerMutationAfterWrite(context, gateway);
+      expect(gateway.abortServer).not.toHaveBeenCalled();
+    });
+    expect(gateway.abortServer).toHaveBeenCalledExactlyOnceWith(
+      'default',
+      'deleted-server',
+      'stale_capability'
+    );
+  }
+);
```

**File**: `apps/agor-daemon/src/mcp-egress/coordination.ts` (modified, +5/-1)
```diff
@@ -1,4 +1,5 @@
 import {
+  enqueueAfterTenantDatabaseCommit,
   getMCPEgressGatewayMode,
   MCPServerRepository,
   SessionRepository,
@@ -64,7 +65,10 @@ export function coordinateMCPServerMutationAfterWrite(
   const tenantId = context.params.tenant?.tenant_id;
   const serverId = (context.result as { mcp_server_id?: unknown } | undefined)?.mcp_server_id;
   if (tenantId && typeof serverId === 'string') {
-    gateway?.abortServer(tenantId, serverId, 'stale_capability');
+    const abort = () => {
+      gateway?.abortServer(tenantId, serverId, 'stale_capability');
+    };
+    if (!enqueueAfterTenantDatabaseCommit(abort)) abort();
   }
 }
 
```

**File**: `apps/agor-daemon/src/register-hooks.ts` (modified, +28/-6)
```diff
@@ -2661,12 +2661,34 @@ export function registerHooks(ctx: RegisterHooksContext): void {
       create: [redactMCPServerSecretFieldsForGatewayMode],
       patch: [abortMcpInFlightAfterWrite, redactMCPServerSecretFieldsForGatewayMode],
       update: [abortMcpInFlightAfterWrite, redactMCPServerSecretFieldsForGatewayMode],
-      // `remove` returns the deleted row: the adapter loads it in full before
-      // deleting so it can return it, and that same object becomes the
-      // `removed` payload broadcast to every authenticated connection in the
-      // tenant. Without this it is the one method that hands out raw `env`,
-      // `headers`, and `auth` — a delete is not an exemption from redaction.
-      remove: [abortMcpInFlightAfterWrite, redactMCPServerSecretFieldsForGatewayMode],
+      // Removal still returns a redacted row to the authorized caller. Its
+      // realtime eviction is a separate minimal, ownership-scoped payload.
+      remove: [
+        abortMcpInFlightAfterWrite,
+        redactMCPServerSecretFieldsForGatewayMode,
+        (context: HookContext) => {
+          // Catalog deletion joins a transaction. Never publish its removal
+          // before commit (or publish anything if that transaction rolls back).
+          const event = context.event;
+          if (event) {
+            context.event = null;
+            emitServiceEvent(app, {
+              path: 'mcp-servers',
+              event,
+              method: 'remove',
+              id: context.id,
+              // Ownership is the pre-delete audience snapshot. No private
+              // configuration is needed to evict a deleted row from clients.
+              data: {
+                mcp_server_id: (context.result as MCPServer).mcp_server_id,
+                owner_user_id: (context.result as MCPServer).owner_user_id ?? null,
+              },
+              params: context.params,
+            });
+          }
+          return context;
+        },
+      ],
     },
   });
 
```

**File**: `apps/agor-daemon/src/register-routes.mcp-scope.test.ts` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ describe('Session MCP executor read scope', () => {
     const route = source.slice(routeStart, routeEnd);
 
     expect(routeStart).toBeGreaterThan(0);
-    expect(route.match(/authorizeAndLoadSessionForMcpConfig\(id, params\);/g)).toHaveLength(4);
+    expect(route.match(/authorizeAndLoadSessionForMcpConfig\(id, params\);/g)).toHaveLength(5);
     expect(
       route.match(
         /authorizeAndLoadSessionForMcpConfig\(id, params, \{\s*allowExecutorProjection: true,?\s*\}\)/g
```

**File**: `apps/agor-daemon/src/register-routes.ts` (modified, +11/-0)
```diff
@@ -5210,6 +5210,17 @@ export async function registerRoutes(ctx: RegisterRoutesContext): Promise<void>
         const session = await authorizeAndLoadSessionForMcpConfig(id, params, {
           allowExecutorProjection: true,
         });
+        if (params.query?.available === true || params.query?.available === 'true') {
+          // Configuration choices are not administrative inventory. Even admins
+          // may attach private rows only to their owner's sessions, and a shared
+          // session must not offer credentials belonging to a different caller.
+          await authorizeAndLoadSessionForMcpConfig(id, params);
+          const candidates = await sessionMCPServersService.listAvailableServers(
+            session,
+            params.user?.user_id as UserID | undefined
+          );
+          return candidates.map(redactMCPServerSecrets);
+        }
         const enabledOnly =
           params.query?.enabledOnly === 'true' || params.query?.enabledOnly === true;
         const includeGlobal =
```

#### Recent Merged Pull Requests:
- **PR #2936** (closed): fix(auth): clarify workspace logout confirmation (@richardfogaca)
- **PR #2934** (2026-09-30): fix(repos): tighten repository path and remote validation (@richardfogaca)
- **PR #2929** (2026-09-30): fix(ui): finish #2904 header scale in session drawer and board panel (@kasiazjc)
- **PR #2927** (2026-09-30): feat: add branch-local automatic Railway previews (@mistercrunch)
- **PR #2926** (2026-09-30): fix(docs): restore complete Google favicon raster (@mistercrunch)
- **PR #2924** (2026-09-29): fix: resolve implicit teammate template defaults from registered remote (@mistercrunch)
- **PR #2923** (2026-09-29): feat(analytics): add trusted ambient deployment provenance (@mistercrunch)
- **PR #2922** (2026-09-29): feat: guide agents through managed environment configuration (@richardfogaca)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
