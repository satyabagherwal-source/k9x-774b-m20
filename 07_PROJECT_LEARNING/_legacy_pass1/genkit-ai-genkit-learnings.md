# Forensic Learning Record (Deep Inspection): genkit-ai/genkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:49.057Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6461 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `commitlint.config.js`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'build', // Build system or external dependencies
        'ci', // CI configuration changes
        'chore', // Other changes that don't modify src or test files
        'revert', // Revert a previous commit
      ],
    ],
    'subject-case': [0], // Level 0 ignores the rule
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 120],
  },
};

```

### Core Architecture Module: `genkit-tools/cli/jest.config.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';

const config: Config = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // A preset that is used as a base for Jest's configuration
  preset: 'ts-jest',

  // The glob patterns Jest uses to detect test files
  testMatch: ['**/tests/**/*_test.ts'],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ['/node_modules/'],

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.[jt]s$': 'ts-jest',
  },

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: ['/node_modules/'],
};

export default config;

```

### Core Architecture Module: `genkit-tools/cli/src/bin/genkit.ts`
```
#!/usr/bin/env node
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** Shim wrapper for genkit CLI */

import { startCLI } from '../cli';

void (async () => {
  await startCLI();
  process.exit();
})();

```

### Core Architecture Module: `genkit-tools/cli/src/cli.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ToolPluginSubCommandsSchema } from '@genkit-ai/tools-common/plugin';
import {
  RunCommandEvent,
  detectRuntime,
  findProjectRoot,
  logger,
  notifyAnalyticsIfFirstRun,
  record,
} from '@genkit-ai/tools-common/utils';
import { Command, program } from 'commander';
import { config } from './commands/config';
import { devTestModel } from './commands/dev-test-model';
import { docsList, docsRead, docsSearch } from './commands/docs';
import { evalExtractData } from './commands/eval-extract-data';
import { evalFlow } from './commands/eval-flow';
import { evalRun } from './commands/eval-run';
import { flowBatchRun } from './commands/flow-batch-run';
import { flowRun } from './commands/flow-run';
import { initAiTools } from './commands/init-ai-tools/index';
import { logList } from './commands/log-list';
import { mcp } from './commands/mcp';
import { getPluginCommands, getPluginSubCommand } from './commands/plugins';
import {
  SERVER_HARNESS_COMMAND,
  serverHarness,
} from './commands/server-harness';
import { start } from './commands/start';
import { startFlutter } from './commands/start-flutter';
import { traceGet } from './commands/trace-get';
import { traceList } from './commands/trace-list';
import { uiStart } from './commands/ui-start';
import { uiStop } from './commands/ui-stop';
import { detectCLIRuntime } from './utils/runtime-detector.js';
import { showUpdateNotification } from './utils/updates';
import { version } from './utils/version';

/**
 * All commands need to be directly registered in this list.
 *
 * To add a new command to the CLI, create a file under src/commands that
 * exports a Command constant, then add it to the list below
 */
const commands: Command[] = [
  uiStart,
  uiStop,
  flowRun,
  flowBatchRun,
  evalExtractData,
  evalRun,
  evalFlow,
  initAiTools,
  config,
  start,
  startFlutter,
  devTestModel,
  mcp,
  docsList,
  docsRead,
  docsSearch,
  logList,
  traceGet,
  traceList,
];

/** Main entry point for CLI. */
export async function startCLI(): Promise<void> {
  program
    .name('genkit')
    .description('Genkit CLI')
    .version(version)
    .option('--no-update-notification', 'Do not show update notification')
    .option(
      '--non-interactive',
      'Run in non-interactive mode. All interactions will use the default choice.'
    )
    .hook('preAction', async (command, actionCommand) => {
      // For now only record known command names, to avoid tools plugins causing
      // arbitrary text to get recorded. Once we launch tools plugins, we'll have
      // to give this more thought
      const commandNames = commands.map((c) => c.name()).concat('help');
      let commandName: string;
      if (commandNames.includes(actionCommand.name())) {
        commandName = actionCommand.name();
      } else if (
        actionCommand.parent &&
        commandNames.includes(actionCommand.parent.name())
      ) {
        commandName = actionCommand.parent.name();
      } else {
        commandName = 'unknown';
      }

      if (
        !process.argv.includes('--non-interactive') &&
        commandName !== 'config'
      ) {
        await notifyAnalyticsIfFirstRun();
      }

      const { isCompiledBinary } = detectCLIRuntime();
      const projectRoot = await findProjectRoot();
      const projectRuntime = await detectRuntime(projectRoot);
      await record(
        new RunCommandEvent(
          commandName,
          isCompiledBinary ? 'binary' : 'node',
          projectRuntime
        )
      );
    });

  // Check for updates and show notification if available,
  // unless --no-update-notification is set
  // Run this synchronously to ensure it shows before command execution
  const hasNoUpdateNotification = process.argv.includes(
    '--no-update-notification'
  );
  if (!hasNoUpdateNotification) {
    try {
      await showUpdateNotification();
    } catch (e) {
      logger.debug('Failed to show update notification', e);
      // Silently ignore errors - update notifications shouldn't break the CLI
    }
  }

  // When running as a spawned UI server process, argv[1] will be '__server-harness'
  // instead of a normal command. This allows the same binary to serve both CLI and server roles.
  if (process.argv[2] === SERVER_HARNESS_COMMAND) {
    program.addCommand(serverHarness);
  }

  for (const command of commands) program.addCommand(command);
  for (const command of await getPluginCommands()) program.addCommand(command);

  for (const cmd of ToolPluginSubCommandsSchema.keyof().options) {
    const command = await getPluginSubCommand(cmd);
    if (command) {
      program.addCommand(command);
    }
  }
  program.addCommand(
    new Command('help').action(() => {
      logger.info(program.help());
    })
  );
  // Handle unknown commands.
  program.on('command:*', (operands) => {
    logger.error(`error: unknown command '${operands[0]}'`);
    logger.info(program.help());
    process.exit(1);
  });

  await program.parseAsync();
}

```

### Core Architecture Module: `genkit-tools/cli/src/commands/config.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ANALYTICS_OPT_OUT_CONFIG_TAG,
  ConfigEvent,
  getUserSettings,
  logger,
  record,
  setUserSettings,
} from '@genkit-ai/tools-common/utils';
import * as clc from 'colorette';
import { Command } from 'commander';

export const UPDATE_NOTIFICATIONS_OPT_OUT_CONFIG_TAG =
  'updateNotificationsOptOut';

const CONFIG_TAGS: Record<
  string,
  (value: string) => string | boolean | number
> = {
  [ANALYTICS_OPT_OUT_CONFIG_TAG]: (value) => {
    let o: boolean | undefined;
    try {
      o = JSON.parse(value);
    } finally {
      if (typeof o !== 'boolean') throw new Error('Expected boolean');
      return o;
    }
  },
  [UPDATE_NOTIFICATIONS_OPT_OUT_CONFIG_TAG]: (value) => {
    let o: boolean | undefined;
    try {
      o = JSON.parse(value);
    } finally {
      if (typeof o !== 'boolean') throw new Error('Expected boolean');
      return o;
    }
  },
};

export const config = new Command('config');

config
  .description('set development environment configuration')
  .command('get')
  .argument('<tag>', `The config tag to get. One of [${readableTagsHint()}]`)
  .action((tag) => {
    if (!CONFIG_TAGS[tag]) {
      logger.error(
        `Unknown config tag "${clc.bold(tag)}.\nValid options: ${readableTagsHint()}`
      );
      return;
    }

    const userSettings = getUserSettings();
    if (userSettings[tag] !== undefined) {
      logger.info(userSettings[tag]);
    } else {
      logger.info(clc.italic('(unset)'));
    }
  });

config
  .command('set')
  .argument('<tag>', `The config tag to get. One of [${readableTagsHint()}]`)
  .argument('<value>', 'The value to set tag to')
  .action(async (tag, value) => {
    if (!CONFIG_TAGS[tag]) {
      logger.error(
        `Unknown config tag "${clc.bold(tag)}.\nValid options: ${readableTagsHint()}`
      );
      return;
    }

    let parsedValue: string | boolean | number;
    try {
      parsedValue = CONFIG_TAGS[tag](value);
    } catch (e: any) {
      logger.error(`Invalid type for "${clc.bold(tag)}.\n${e.message}`);
      return;
    }

    await record(new ConfigEvent(tag));

    const userSettings = getUserSettings();
    setUserSettings({
      ...userSettings,
      [tag]: parsedValue,
    });

    logger.info(`Set "${clc.bold(tag)}" to "${clc.bold(value)}".`);
  });

function readableTagsHint() {
  return Object.keys(CONFIG_TAGS).map(clc.bold).join(', ');
}

```

### Core Architecture Module: `genkit-tools/cli/src/commands/eval-extract-data.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  EvalInput,
  EvalInputDataset,
  TraceData,
} from '@genkit-ai/tools-common';
import type { BaseRuntimeManager } from '@genkit-ai/tools-common/manager';
import {
  findProjectRoot,
  generateTestCaseId,
  getEvalExtractors,
  logger,
} from '@genkit-ai/tools-common/utils';
import * as clc from 'colorette';
import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { runWithManager } from '../utils/manager-utils';

interface EvalDatasetOptions {
  output?: string;
  maxRows: string;
  label?: string;
}

/** Command to extract evaluation data. */
export const evalExtractData = new Command('eval:extractData')
  .description('extract evaludation data for a given flow from the trace store')
  .argument('<flowName>', 'name of the flow to run')
  .option(
    '--output <filename>',
    'name of the output file to store the extracted data'
  )
  .option('--maxRows <maxRows>', 'maximum number of rows', '100')
  .option('--label [label]', 'label flow run in this batch')
  .action(async (flowName: string, options: EvalDatasetOptions) => {
    const dashDashIndex = process.argv.indexOf('--');
    let runtimeCommand: string[] | undefined;
    if (dashDashIndex !== -1) {
      runtimeCommand = process.argv.slice(dashDashIndex + 1);
    }

    const projectRoot = await findProjectRoot();

    const runAction = async (manager: BaseRuntimeManager) => {
      const extractors = await getEvalExtractors(`/flow/${flowName}`);

      logger.debug(`Extracting trace data '/flow/${flowName}'...`);
      let dataset: EvalInputDataset = [];
      let continuationToken = undefined;
      while (dataset.length < Number.parseInt(options.maxRows)) {
        const response = await manager.listTraces({
          limit: Number.parseInt(options.maxRows),
          continuationToken,
        });
        continuationToken = response.continuationToken;
        const traces = response.traces;
        const batch: EvalInput[] = traces
          .map((t) => {
            const rootSpan = Object.values(t.spans).find(
              (s) =>
                s.attributes['genkit:metadata:subtype'] === 'flow' &&
                (!options.label ||
                  s.attributes['batchRun'] === options.label) &&
                s.attributes['genkit:name'] === flowName
            );
            if (!rootSpan) {
              return undefined;
            }
            return t;
          })
          .filter((t): t is TraceData => !!t)
          .map((trace) => {
            return {
              testCaseId: generateTestCaseId(),
              input: extractors.input(trace),
              output: extractors.output(trace),
              context: toArray(extractors.context(trace)),
              // The trace (t) does not contain the traceId, so we have to pull it out of the
              // spans, de- dupe, and turn it back into an array.
              traceIds: Array.from(
                new Set(Object.values(trace.spans).map((span) => span.traceId))
              ),
            } as EvalInput;
          })
          .filter((result): result is EvalInput => !!result);
        batch.forEach((d) => dataset.push(d));
        if (dataset.length > Number.parseInt(options.maxRows)) {
          dataset = dataset.splice(0, Number.parseInt(options.maxRows));
          break;
        }
        if (!continuationToken) {
          break;
        }
      }

      if (options.output) {
        logger.debug(`Writing data to '${options.output}'...`);
        await writeFile(
          options.output,
          JSON.stringify(dataset, undefined, '  ')
        );
      } else {
        logger.debug(`Results will not be written to file.`);
        logger.info(clc.green('Results:'));
        logger.info(JSON.stringify(dataset, undefined, '  '));
      }
    };

    await runWithManager(projectRoot, runAction, { runtimeCommand });
  });

function toArray(input: any) {
  return Array.isArray(input) ? input : [input];
}

```

### Core Architecture Module: `genkit-tools/cli/src/commands/eval-flow.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  DatasetSchema,
  type Action,
  type Dataset,
  type DatasetMetadata,
} from '@genkit-ai/tools-common';
import {
  getAllEvaluatorActions,
  getDatasetStore,
  getExporterForString,
  getMatchingEvaluatorActions,
  runEvaluation,
  runInference,
  type EvalExporter,
} from '@genkit-ai/tools-common/eval';
import type { BaseRuntimeManager } from '@genkit-ai/tools-common/manager';
import {
  confirmLlmUse,
  findProjectRoot,
  hasAction,
  loadInferenceDatasetFile,
  logger,
} from '@genkit-ai/tools-common/utils';
import * as clc from 'colorette';
import { Command } from 'commander';
import { runWithManager } from '../utils/manager-utils';

interface EvalFlowRunCliOptions {
  input?: string;
  output?: string;
  context?: string;
  evaluators?: string;
  force?: boolean;
  batchSize?: number;
  outputFormat: string;
}

const EVAL_FLOW_SCHEMA = 'Array<{input: any; reference?: any;}>';
enum SourceType {
  DATA = 'data',
  FILE = 'file',
  DATASET = 'dataset',
}

/** Command to run a flow and evaluate the output */
export const evalFlow = new Command('eval:flow')
  .description(
    'evaluate a flow against configured evaluators using provided data as input'
  )
  .argument('<flowName>', 'Name of the flow to run')
  .argument('[data]', 'JSON data to use to start the flow')
  .option(
    '--input <input>',
    'Input dataset ID or JSON file to be used for evaluation'
  )
  .option('-c, --context <JSON>', 'JSON object passed to context', '')
  .option(
    '-o, --output <filename>',
    'Name of the output file to write evaluation results. Defaults to json output.'
  )
  // TODO: Figure out why passing a new Option with choices doesn't work
  .option(
    '--output-format <format>',
    'The output file format (csv, json)',
    'json'
  )
  .option(
    '-e, --evaluators <evaluators>',
    'comma separated list of evaluators to use (by default uses all)'
  )
  .option(
    '--batchSize <batchSize>',
    'batch size to use for parallel evals (default to 1, no parallelization)',
    Number.parseInt
  )
  .option('-f, --force', 'Automatically accept all interactive prompts')
  .action(
    async (flowName: string, data: string, options: EvalFlowRunCliOptions) => {
      const dashDashIndex = process.argv.indexOf('--');
      let runtimeCommand: string[] | undefined;
      let actualData: string | undefined = data;

      // Commander removes the '--' separator from evalFlow.args.
      // We find '--' in process.argv to determine which arguments belong to the runtime command
      // and which belong to the command itself (like the optional [data] argument).
      if (dashDashIndex !== -1) {
        const numArgsAfterDashDash = process.argv.length - dashDashIndex - 1;
        runtimeCommand = evalFlow.args.slice(-numArgsAfterDashDash);
        const commandArgs = evalFlow.args.slice(
          0,
          evalFlow.args.length - numArgsAfterDashDash
        );
        if (commandArgs.length > 1) {
          actualData = commandArgs[1];
        } else {
          actualData = undefined;
        }
      }

      const projectRoot = await findProjectRoot();

      const runAction = async (manager: BaseRuntimeManager) => {
        const actionRef = `/flow/${flowName}`;
        if (!actualData && !options.input) {
          throw new Error(
            'No input data passed. Specify input data using [data] argument or --input <filename> option'
          );
        }

        const hasTargetAction = await hasAction({ manager, actionRef });
        if (!hasTargetAction) {
          throw new Error(`Cannot find action ${actionRef}.`);
        }

        let evaluatorActions: Action[];
        if (!options.evaluators) {
          evaluatorActions = await getAllEvaluatorActions(manager);
        } else {
          const evalActionKeys = options.evaluators
            .split(',')
            .map((k) => `/evaluator/${k}`);
          evaluatorActions = await getMatchingEvaluatorActions(
            manager,
            evalActionKeys
          );
        }
        if (!evaluatorActions.length) {
          throw new Error(
            options.evaluators
              ? `No matching evaluators found for '${options.evaluators}'`
              : `No evaluators found in your app`
          );
        }
        logger.debug(
          `Using evaluators: ${evaluatorActions.map((action) => action.name).join(',')}`
        );

        if (!options.force) {
          const confirmed = await confirmLlmUse(evaluatorActions);
          if (!confirmed) {
            throw new Error('User declined using billed evaluators.');
          }
        }

        const sourceType = getSourceType(actualData, options.input);
        let targetDatasetMetadata;
        if (sourceType === SourceType.DATASET) {
          const datasetStore = await getDatasetStore();
          const datasetMetadatas = await datasetStore.listDatasets();
          targetDatasetMetadata = datasetMetadatas.find(
            (d: DatasetMetadata) => d.datasetId === options.input
          );
        }

        const inferenceDataset = await readInputs(
          sourceType,
          actualData,
          options.input
        );
        const evalDataset = await runInference({
          manager,
          actionRef,
          inferenceDataset,
          context: options.context,
        });

        const evalRun = await runEvaluation({
          manager,
          evaluatorActions,
          evalDataset,
          batchSize: options.batchSize,
          augments: {
            actionRef: `/flow/${flowName}`,
            datasetId:
              sourceType === SourceType.DATASET ? options.input : undefined,
            datasetVersion: targetDatasetMetadata?.version,
          },
        });

        if (options.output) {
          const exportFn: EvalExporter = getExporterForString(
            options.outputFormat
          );
          await exportFn(evalRun, options.output);
        }

        const toolsInfo = manager.getMostRecentDevUI();
        if (toolsInfo) {
          logger.info(
            clc.green(
              `\nView the evaluation results at: ${toolsInfo.url}/evaluate/${evalRun.key.evalRunId}`
            )
          );
        } else {
          logger.info(`${clc.cyan('Evaluation ID:')} ${evalRun.key.evalRunId}`);
        }
      };

      // Wait for the target flow to register. If specific evaluators were
      // requested, wait for those too. When none are specified we cannot know
      // the keys ahead of time, so we skip them and let discovery handle it.
      const waitForActionKeys = [`/flow/${flowName}`];
      if (options.evaluators) {
        waitForActionKeys.push(
          ...options.evaluators.split(',').map((k) => `/evaluator/${k}`)
        );
      }

      await runWithManager(projectRoot, runAction, {
        runtimeCommand,
        waitForActionKeys,
      });
    }
  );

/**
 * Reads EvalFlowInput dataset from data string or input identified.
 * Only one of these parameters is expected to be provided.
 **/
async function readInputs(
  sourceType: SourceType,
  dataField?: string,
  input?: string
): Promise<Dataset> {
  let parsedData;
  switch (sourceType) {
    case SourceType.DATA:
      parsedData = JSON.parse(dataField!);
      break;
    case SourceType.FILE:
      try {
        return await loadInferenceDatasetFile(input!);
      } catch (e) {
        throw new Error(`Error p
```

### Core Architecture Module: `genkit-tools/cli/src/commands/eval-run.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Action, EvalInputDataset } from '@genkit-ai/tools-common';
import {
  getAllEvaluatorActions,
  getExporterForString,
  getMatchingEvaluatorActions,
  runEvaluation,
  type EvalExporter,
} from '@genkit-ai/tools-common/eval';
import type { BaseRuntimeManager } from '@genkit-ai/tools-common/manager';
import {
  confirmLlmUse,
  findProjectRoot,
  loadEvaluationDatasetFile,
  logger,
} from '@genkit-ai/tools-common/utils';
import * as clc from 'colorette';
import { Command } from 'commander';
import { runWithManager } from '../utils/manager-utils';

interface EvalRunCliOptions {
  output?: string;
  evaluators?: string;
  force?: boolean;
  batchSize?: number;
  outputFormat: string;
}

/** Command to run evaluation on a dataset. */
export const evalRun = new Command('eval:run')
  .description('evaluate provided dataset against configured evaluators')
  .argument(
    '<dataset>',
    'Dataset to evaluate on (currently only supports JSON)'
  )
  .option(
    '--output <filename>',
    'name of the output file to write evaluation results. Defaults to json output.'
  )
  .option(
    '--output-format <format>',
    'The output file format (csv, json)',
    'json'
  )
  .option(
    '--evaluators <evaluators>',
    'comma separated list of evaluators to use (by default uses all)'
  )
  .option(
    '--batchSize <batchSize>',
    'batch size to use for parallel evals (default to 1, no parallelization)',
    Number.parseInt
  )
  .option('--force', 'Automatically accept all interactive prompts')
  .action(async (dataset: string, options: EvalRunCliOptions) => {
    const dashDashIndex = process.argv.indexOf('--');
    let runtimeCommand: string[] | undefined;
    let actualDataset: string | undefined = dataset;

    // Commander removes the '--' separator from evalRun.args.
    // We find '--' in process.argv to determine which arguments belong to the runtime command.
    if (dashDashIndex !== -1) {
      const numArgsAfterDashDash = process.argv.length - dashDashIndex - 1;
      runtimeCommand = evalRun.args.slice(-numArgsAfterDashDash);
      const commandArgs = evalRun.args.slice(
        0,
        evalRun.args.length - numArgsAfterDashDash
      );
      actualDataset = commandArgs[0];
    }

    const projectRoot = await findProjectRoot();

    const runAction = async (manager: BaseRuntimeManager) => {
      if (!actualDataset) {
        throw new Error('Missing required argument <dataset>');
      }

      let evaluatorActions: Action[];
      if (!options.evaluators) {
        evaluatorActions = await getAllEvaluatorActions(manager);
      } else {
        const evalActionKeys = options.evaluators
          .split(',')
          .map((k) => `/evaluator/${k}`);
        evaluatorActions = await getMatchingEvaluatorActions(
          manager,
          evalActionKeys
        );
      }
      if (!evaluatorActions.length) {
        throw new Error(
          options.evaluators
            ? `No matching evaluators found for '${options.evaluators}'`
            : `No evaluators found in your app`
        );
      }
      logger.info(
        `Using evaluators: ${evaluatorActions.map((action) => action.name).join(',')}`
      );

      if (!options.force) {
        const confirmed = await confirmLlmUse(evaluatorActions);
        if (!confirmed) {
          throw new Error('User declined using billed evaluators.');
        }
      }

      const evalDataset: EvalInputDataset =
        await loadEvaluationDatasetFile(actualDataset);
      const evalRun = await runEvaluation({
        manager,
        evaluatorActions,
        evalDataset,
        batchSize: options.batchSize,
      });

      if (options.output) {
        const exportFn: EvalExporter = getExporterForString(
          options.outputFormat
        );
        await exportFn(evalRun, options.output);
      }

      const toolsInfo = manager.getMostRecentDevUI();
      if (toolsInfo) {
        logger.info(
          clc.green(
            `\nView the evaluation results at: ${toolsInfo.url}/evaluate/${evalRun.key.evalRunId}`
          )
        );
      } else {
        logger.info(`${clc.cyan('Evaluation ID:')} ${evalRun.key.evalRunId}`);
      }
    };

    // If specific evaluators were requested, wait for them to register before
    // dispatching. When none are specified we cannot know the keys ahead of
    // time, so we skip the wait and let discovery handle it.
    const waitForActionKeys = options.evaluators
      ? options.evaluators.split(',').map((k) => `/evaluator/${k}`)
      : undefined;

    await runWithManager(projectRoot, runAction, {
      runtimeCommand,
      waitForActionKeys,
    });
  });

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6392** (2026-09-23): **[Go] Flaky TestAgentConformance: aborted snapshot reaches status 'completed' instead of 'aborted'**
  *Symptoms*: **Describe the bug**  `TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight` in `go/ai/exp` fails intermittently on CI. An aborted snapshot reaches a terminal status of `completed` instead of `aborted`:  ``` === RUN   TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.status: want aborted, got completed     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.finishReason: want aborted, got <nil> --- FAIL: TestAgentConformance (10.58s) FAIL	github.com/firebase/genkit/go/ai/exp	18.582s ```  Observed on `tests (1.26.x)`, while `tests (1.25.x)` passed on the identical commit: https://github.com/genkit-ai/genkit/actions/runs/35612375025/job/106391562891  Surfaced on an unrelated PR (#6339, an MCP transport fix). Nothing on that branch touches or is imported by `go/ai/exp`.  **To Reproduce**  The case is `an aborted snapshot keeps the finished turns and drops the one in flight` in `tests/specs/agent.yaml:1768`, run by `go/ai/exp/agents_conformance_test.go`:  ``` go test -run 'TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns' ./ai/exp/ ```  It does not reproduce reliably — 20/20 passes locally on go1.25.0 darwin/arm64. The observed failure is on linux/amd64 go1.26.8 (CI).  **Expected behavior**  Aborting a snapshot whose status is still `pending` should leave it terminal as `aborted` with `f

- **Issue #6329** (2026-09-21): **[Go] `StreamableHTTPConfig.HTTPClient` is silently ignored by the Streamable HTTP transport**
  *Symptoms*: # Summary `StreamableHTTPConfig.HTTPClient` (`go/plugins/mcp/client.go`) is a dead field: Genkit pins `mcp-go v0.29.0`, whose Streamable HTTP transport exposes no option to inject a custom `http.Client`, so the field is silently ignored.  The SSE transport already honors its `HTTPClient` field via `WithHTTPClient`; Streamable HTTP does not, even though it's the newer, recommended transport.  **Why a custom `http.Client` matters**  A custom client is the only way to set the transport-level behavior that a remote MCP server often requires:  - **mTLS / client certificates** (`TLSClientConfig.Certificates`) - **Private CA / custom trust** (`TLSClientConfig.RootCAs`) - **Corporate proxies** (`http.Transport.Proxy`) - **Connection pooling / keep-alive tuning** (`MaxIdleConns`,   `MaxIdleConnsPerHost`, `IdleConnTimeout`) - **Dial and TLS handshake timeouts** (`DialContext`, `TLSHandshakeTimeout`) - **Custom `RoundTripper`** (tracing, retries, rate limiting)  # Reproducing the Issue Pass a custom `http.Client` to the Streamable HTTP transport and observe that it is never used:  ```go package main  import (     "net/http"      "github.com/firebase/genkit/go/plugins/mcp" )  // A round tripper that records whether it is ever called. It isn't. type recordingTransport struct{ called bool } func (t *recordingTransport) RoundTrip(*http.Request) (*http.Response, error) {     t.called = true     return nil, nil }  func main() {     recorder := &recordingTransport{}     customClient := &http.C
  **Post-Mortem & Fix Analysis**:
  > I will take this issue. Please assign it to me.  The problem is that `StreamableHTTPConfig.HTTPClient` in `go/plugins/mcp/client.go` is ignored. The code does not allow injecting a custom `http.Client`. I will first inspect the `mcp-go` package version being used. Then, I will add a mechanism similar to `WithHTTPClient` in the SSE transport to use the provided `HTTPClient`. I will test by passing a custom client and checking if it is used. 
  > @modelpath-dev btw, how can one become a contributor? I have deep interest in the project, for both personal and professional use and I would love to contribute.
  > Hey @vllst-io, that's awesome to hear! You can start by checking out the contribution guidelines in the repo. It's usually a good idea to begin with small issues or bug fixes to get familiar with the codebase. Looking forward to your contributions! 

- **Issue #6009** (2026-08-19): **[Dev UI] Numeric model config fields are sent to the runtime as strings**
  *Symptoms*: Every numeric field in the model config panel reaches the runtime as a string. Setting `temperature` to `0.5` sends `{"config":{"temperature":"0.5"}}`.  Against a Go runtime the request fails outright, because the typed-config constructors fold a model's config schema into the action's input schema and validate it:  ``` invalid input to action "/model/anthropic/claude-opus-4-8": data did not match expected schema: - config: Must validate at least one schema (anyOf) - config.temperature: Invalid type. Expected: number, given: string ```  JS runtimes publish the config schema as `metadata.model.customOptions` and don't validate against it, so there the string is handed to the plugin rather than rejected. The payload on the wire is the same either way.  ## Cause  `text-input.component.html` binds the input type:  ```html <input   [type]="     customOption().type === 'number' || customOption().type === 'integer'       ? 'number'       : 'text'   "   matInput   [formControl]="control()" /> ```  Angular declares `NumberValueAccessor` with the selector `input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]`. That is a static attribute selector, resolved against the template at compile time, so a bound `[type]` never matches it however it evaluates. `DefaultValueAccessor` binds instead, and it writes `$event.target.value`, which is always a string.  The rendered DOM genuinely is `<input type="number">`, so the spinner, the numeric keyboard, a

- **Issue #5776** (2026-07-29): **[Dev UI] Manual tool calls incorrectly sent as resume**
  *Symptoms*: ### What Currently Happens vs. The Distinction for Manual Tool Calls                                                                                                                                                                                                                                                                    1. How resume is currently used:                                                                                                                                        - When `buildPrompt(messages)` runs, it filters out all entries where `item.type !== 'message'`, stripping `tool_action` cards from messages.                             - It then calls `buildResumePayloadFromChatLog(messages)` on the last `tool_action` card and attaches it output to `GenerateActionOptions.resume` (`resume: { respond: [...] }`).                                                                                                                                              2. Why manual tool calls should append to messages instead:                                                                                                             - resume is designed for Genkit's interrupt/resumption loop (`source === 'interrupt'`), where the runner resumes an interrupted execution using resume.restart or resume.respond.                                                                                                                                                     - manual tool calling

- **Issue #5734** (2026-08-03): **[JS] Vertex AI JS plugin does not support multi-region endpoints (eu, us) for Gemini models**
  *Symptoms*: **Describe the bug**  The Vertex AI JavaScript plugin currently does not appear to support the new Vertex AI multi-region endpoints (`eu` and `us`).  Google now recommends using the multi-region locations to access Gemini models, including newer models that may not be available in regional endpoints.  When configuring Genkit to use the `eu` location, requests fail with:  ``` GenkitError: UNKNOWN: Error fetching from https://eu-aiplatform.googleapis.com/v1beta1/projects/<project>/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent  [404 Not Found] ```  The same code works correctly when using `global`.  The `eu` multi-region is valid and available in Vertex AI Studio, so this appears to be a client library limitation rather than a service issue.  **To Reproduce**  ```ts import { genkit } from "genkit"; import { vertexAI } from "@genkit-ai/google-genai";  const ai = genkit({   plugins: [     vertexAI({       location: "eu",     }),   ], }); ```  Then call any Gemini model, for example:  ```ts await ai.generate({   model: vertexAI.model("gemini-3.5-flash"),   prompt: "Hello", }); ```  The request fails with:  ``` 404 Not Found https://eu-aiplatform.googleapis.com/v1beta1/projects/<project>/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent ```  Changing only the location to:  ```ts location: "global" ```  makes the same request succeed.  **Expected behavior**  The SDK should support the Vertex AI multi-region locations (`eu` and `us`) in th
  **Post-Mortem & Fix Analysis**:
  > Multi-region locations are supported as of #5753: `vertexAI({ location: 'eu' })` now resolves to `aiplatform.eu.rep.googleapis.com` instead of the invalid `eu-aiplatform.googleapis.com`. Python got the same in #5763.  Upgrading `@genkit-ai/google-genai` should sort it. Closing this, and #5457 is superseded by #5753 so that can go alongside. If you still get a 404, I'll happily reopen. 

- **Issue #5710** (2026-07-09): **[Tooling] Switching to append mode is causing pending tool calls to turn into resumed**
  *Symptoms*: Once there is a pending tool call card on the model runner, if we switch to append mode, the tool call card turns into resumed state with whatever inputs were present.

- **Issue #5700** (2026-07-17): **[Ollama][Python] Streaming responses return empty `response.text` (final ModelResponse content is discarded)**
  *Symptoms*: ### Describe the bug  In the Python Ollama plugin, streaming a generation sends text deltas via `ctx.send_chunk()` but discards the aggregated content from the final `ModelResponse`. As a result, `(await response).text` (and `response.message`) is empty even on a fully successful stream.  The offending code is in `OllamaModel.generate()` in `py/plugins/ollama/src/genkit/plugins/ollama/models.py`. After the streaming branch has emitted all chunks, the method explicitly resets the accumulated content to an empty list before building the final response:  ```python if self.is_streaming_request(ctx=ctx):     content = []  response_message = Message(role=Role.MODEL, content=content) # ... return ModelResponse(     message=Message(role=Role.MODEL, content=content),  # content == []     usage=..., ) ```  The streaming helpers (`_chat_with_ollama` / `_generate_ollama_response`) send each chunk via `ctx.send_chunk(...)` and then return `None`, so nothing is ever accumulated into the final response.  ### Impact  Any consumer using the documented streaming pattern gets an empty string for the final text:  ```python stream, response = ai.generate_stream(model='ollama/...', prompt='...') async for chunk in stream:     ...  # chunks arrive fine final = await response print(final.text)  # '' — even though the stream succeeded ```  Callers are forced to buffer the streamed chunks themselves to reconstruct the full text, which defeats the purpose of awaiting the final response.  ### To Reprodu

- **Issue #5608** (2026-08-14): **[Dev UI] agent prompt render steps do not open in prompt runner**
  *Symptoms*: 

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

### Incident Patch 1: `b1a3fb31` (2026-09-30)
**Commit Message**: fix(google-genai): correct Vertex multimodal embedding dimensions (#6484)

**File**: `js/plugins/google-genai/src/vertexai/embedder.ts` (modified, +3/-3)
```diff
@@ -49,7 +49,7 @@ export const EmbeddingConfigSchema = z
     version: z.string().optional(),
     /**
      * The `outputDimensionality` parameter allows you to specify the dimensionality of the embedding output.
-     * By default, the model generates embeddings with 768 dimensions.
+     * The default dimensions depend on the model (1408 for multimodalembedding@001).
      * By selecting a smaller output dimensionality, users can save memory and storage space, leading to more efficient computations.
      **/
     outputDimensionality: z.number().min(1).optional(),
@@ -91,7 +91,7 @@ const GENERIC_TEXT_MODEL = commonRef('text', {
   supports: { input: ['text'] },
 });
 const GENERIC_MULTIMODAL_MODEL = commonRef('multimodal', {
-  dimensions: 768,
+  dimensions: 1408,
   supports: { input: ['text', 'image', 'video'] },
 });
 
@@ -101,7 +101,7 @@ export const KNOWN_MODELS = {
     'text-multilingual-embedding-002'
   ),
   'multimodalembedding@001': commonRef('multimodalembedding@001', {
-    dimensions: 768,
+    dimensions: 1408,
     supports: { input: ['text', 'image', 'video'] },
   }),
   'gemini-embedding-001': commonRef('gemini-embedding-001', {
```

**File**: `js/plugins/google-genai/tests/vertexai/embedder_test.ts` (modified, +9/-0)
```diff
@@ -24,13 +24,22 @@ import { getVertexAIUrl } from '../../src/vertexai/client.js';
 import {
   EmbeddingConfig,
   defineEmbedder,
+  model,
 } from '../../src/vertexai/embedder.js';
 import {
   ClientOptions,
   EmbedContentResponse,
   EmbeddingInstance,
 } from '../../src/vertexai/types.js';
 
+it('reports the default dimensions for multimodal embedders', () => {
+  assert.strictEqual(model('multimodalembedding@001').info?.dimensions, 1408);
+  assert.strictEqual(
+    model('custom-multimodalembedding', { multimodal: true }).info?.dimensions,
+    1408
+  );
+});
+
 describe('defineEmbedder', () => {
   let fetchStub: sinon.SinonStub;
   let authMock: sinon.SinonStubbedInstance<GoogleAuth>;
```

---

### Incident Patch 2: `228015f1` (2026-09-25)
**Commit Message**: fix(py/plugins/openai): set raw to the full completion on the non-streaming path (#6423)

**File**: `py/packages/genkit-openai/src/genkit_openai/models/model.py` (modified, +1/-1)
```diff
@@ -515,7 +515,7 @@ async def _generate(self, request: ModelRequest) -> ModelResponse:
             finish_message=finish_message,
             usage=_usage_from_completion(response.usage),
             custom=metadata or None,
-            raw=metadata or None,
+            raw=response.to_dict(),
         )
         return self._clean_json_response(result, request)
 
```

**File**: `py/packages/genkit-openai/tests/openai_model_test.py` (modified, +70/-72)
```diff
@@ -204,21 +204,9 @@ async def test_get_openai_config_model_field_overrides_version() -> None:
 
 
 @pytest.mark.asyncio
-async def test__generate(sample_request: ModelRequest) -> None:
+async def test__generate(sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]) -> None:
     """Test generate method calls OpenAI API and returns ModelResponse."""
-    mock_message = MagicMock()
-    mock_message.content = 'Hello, user!'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = None
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    mock_client = _mock_completion(make_completion())
 
     model = OpenAIModel(model='gpt-4', client=mock_client)
     response = await model._generate(sample_request)
@@ -434,21 +422,11 @@ async def iterator() -> AsyncIterator[ChatCompletionChunk]:
 
 
 @pytest.mark.asyncio
-async def test__generate_reports_usage(sample_request: ModelRequest) -> None:
+async def test__generate_reports_usage(
+    sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]
+) -> None:
     """A non-streaming response's token usage reaches the ModelResponse."""
-    mock_message = MagicMock()
-    mock_message.content = 'Hello, user!'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = CompletionUsage.model_validate(_USAGE_PAYLOAD)
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    mock_client = _mock_completion(make_completion(usage=_USAGE_PAYLOAD))
 
     model = OpenAIModel(model='gpt-4', client=mock_client)
     sample_request.config = OpenAIConfig(stream_options={'include_usage': False})
@@ -460,35 +438,26 @@ async def test__generate_reports_usage(sample_request: ModelRequest) -> None:
 
 
 @pytest.mark.asyncio
-async def test__generate_reports_extra_token_counts() -> None:
+async def test__generate_reports_extra_token_counts(make_completion: Callable[..., ChatCompletion]) -> None:
     """Counts Genkit has no field for land in usage.custom; zeroes are dropped."""
-    mock_message = MagicMock()
-    mock_message.content = 'hi'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = CompletionUsage.model_validate({
-        'prompt_tokens': 3,
-        'completion_tokens': 2,
-        'total_tokens': 5,
-        'prompt_tokens_details': {'cached_tokens': 0, 'image_tokens': 9},
-        'completion_tokens_details': {
-            'audio_tokens': 4,
-            'accepted_prediction_tokens': 0,
-            'rejected_prediction_tokens': 2,
-            'reasoning_tokens': 0,
+    completion = make_completion(
+        content='hi',
+        usage={
+            'prompt_tokens': 3,
+            'completion_tokens': 2,
+            'total_tokens': 5,
+            'prompt_tokens_details': {'cached_tokens': 0, 'image_tokens': 9},
+            'completion_tokens_details': {
+                'audio_tokens': 4,
+                'accepted_prediction_tokens': 0,
+                'rejected_prediction_tokens': 2,
+                'reasoning_tokens': 0,
+            },
+            'num_sources_used': 8,
         },
-        'num_sources_used': 8,
-    })
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    )
 
-    model = OpenAIModel(model='gpt-4', clien
```

**File**: `py/packages/genkit-openai/tests/tool_calling_test.py` (modified, +22/-26)
```diff
@@ -17,46 +17,42 @@
 """Test tool calling."""
 
 import json
+from collections.abc import Callable
 from functools import reduce
 from unittest.mock import AsyncMock, MagicMock
 
 import pytest
 from genkit_openai.models import OpenAIModel
+from openai.types.chat import ChatCompletion
 
 from genkit import ModelRequest, ModelResponseChunk
 
 
 @pytest.mark.asyncio
-async def test_generate_with_tool_calls_executes_tools(sample_request: ModelRequest) -> None:
+async def test_generate_with_tool_calls_executes_tools(
+    sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]
+) -> None:
     """Test generate with tool calls executes tools."""
-    mock_tool_call = MagicMock()
-    mock_tool_call.id = 'tool123'
-    mock_tool_call.function.name = 'tool_fn'
-    mock_tool_call.function.arguments = '{"a": 1}'
-
     # First call triggers tool execution
-    first_message = MagicMock()
-    first_message.role = 'assistant'
-    first_message.tool_calls = [mock_tool_call]
-    first_message.content = None
-    first_message.reasoning_content = None
-    first_message.refusal = None
-
-    first_response = MagicMock()
-    first_response.choices = [MagicMock(finish_reason='tool_calls', message=first_message)]
-    first_response.usage = None
+    first_response = make_completion(
+        choice={
+            'finish_reason': 'tool_calls',
+            'message': {
+                'role': 'assistant',
+                'content': None,
+                'tool_calls': [
+                    {
+                        'id': 'tool123',
+                        'type': 'function',
+                        'function': {'name': 'tool_fn', 'arguments': '{"a": 1}'},
+                    }
+                ],
+            },
+        }
+    )
 
     # Second call is the model response
-    second_message = MagicMock()
-    second_message.role = 'model'
-    second_message.tool_calls = None
-    second_message.content = 'final response'
-    second_message.reasoning_content = None
-    second_message.refusal = None
-
-    second_response = MagicMock()
-    second_response.choices = [MagicMock(finish_reason='stop', message=second_message)]
-    second_response.usage = None
+    second_response = make_completion(content='final response')
 
     mock_client = MagicMock()
     mock_client.chat.completions.create = AsyncMock(
```

---

### Incident Patch 3: `f4e32773` (2026-09-23)
**Commit Message**: fix(go/ai/exp): honor abort in conformance fixture (#6415)

**File**: `go/ai/exp/agents_conformance_test.go` (modified, +6/-0)
```diff
@@ -276,6 +276,12 @@ func setupHarness(t *testing.T) *harness {
 			}); err != nil {
 				return nil, err
 			}
+			// An abort can land after the first turn but before Run starts the
+			// queued "block" turn. Run then returns nil; propagate the stop so
+			// this abortable fixture does not report a successful invocation.
+			if err := ctx.Err(); err != nil {
+				return nil, err
+			}
 			return &exp.AgentResult{Message: ai.NewModelTextMessage("done")}, nil
 		}, newStore("customAgentAbortable"))
 
```

---

### Incident Patch 4: `ff058716` (2026-09-23)
**Commit Message**: fix(py/core): list dynamic action provider children in the registry (#6378)

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +2/-6)
```diff
@@ -86,11 +86,7 @@
     missing_operation_error,
 )
 from genkit._core._channel import Channel, run_loop
-from genkit._core._dap import (
-    DapFn,
-    DynamicActionProvider,
-    define_dynamic_action_provider as define_dap_block,
-)
+from genkit._core._dap import DapFn, DynamicActionProvider
 from genkit._core._environment import is_dev_environment
 from genkit._core._error import GenkitError, RuntimeErrorReason, StatusName
 from genkit._core._logger import configure_logging, get_logger, resolve_level
@@ -104,7 +100,7 @@
 from genkit._core._protocols import SessionLike
 from genkit._core._reflection import ReflectionServer, ServerSpec, create_reflection_asgi_app
 from genkit._core._reflection_v2 import ReflectionServerV2
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider as define_dap_block
 from genkit._core._tracing import SpanMetadata, run_in_new_span
 from genkit._core._typing import (
     BaseDataPoint,
```

**File**: `py/packages/genkit/src/genkit/_core/_dap.py` (modified, +0/-33)
```diff
@@ -23,12 +23,10 @@
 from typing import Any
 
 from genkit._core._action import (
-    GENKIT_DYNAMIC_ACTION_PROVIDER_ATTR,
     Action,
     ActionKind,
     create_action_key,
 )
-from genkit._core._registry import Registry
 from genkit._core._typing import ActionMetadata
 
 ActionMetadataLike = Mapping[str, object]
@@ -186,34 +184,3 @@ def is_dynamic_action_provider(obj: object) -> bool:
         return True
     metadata = getattr(obj, 'metadata', None)
     return isinstance(metadata, dict) and metadata.get('type') == 'dynamic-action-provider'
-
-
-def define_dynamic_action_provider(
-    registry: Registry,
-    name: str,
-    fn: DapFn,
-    *,
-    description: str | None = None,
-    cache_ttl_millis: int | None = None,
-    metadata: dict[str, Any] | None = None,
-) -> DynamicActionProvider:
-    """Define and register a Dynamic Action Provider for lazy action resolution."""
-
-    async def dap_action(input: DapMetadata) -> DapMetadata:
-        return input
-
-    action = registry.register_action(
-        name=name,
-        kind=ActionKind.DYNAMIC_ACTION_PROVIDER,
-        description=description,
-        fn=dap_action,
-        metadata={**(metadata or {}), 'type': 'dynamic-action-provider'},
-    )
-
-    dap = DynamicActionProvider(action, fn, cache_ttl_millis)
-    # Attach the provider to the registered Action so anyone holding the
-    # Action (e.g. ``Registry.resolve_action_by_key`` for a DAP-qualified key,
-    # or ``Registry.list_actions`` expanding children for reflection) can
-    # recover the cache and helpers via ``getattr(action, ATTR, None)``.
-    setattr(action, GENKIT_DYNAMIC_ACTION_PROVIDER_ATTR, dap)
-    return dap
```

**File**: `py/packages/genkit/src/genkit/_core/_registry.py` (modified, +140/-9)
```diff
@@ -22,7 +22,7 @@
 import threading
 import weakref
 from collections.abc import Awaitable, Callable
-from typing import cast
+from typing import Any, cast
 
 from dotpromptz.dotprompt import Dotprompt
 from pydantic import BaseModel
@@ -40,6 +40,7 @@
     parse_dap_qualified_name,
     set_action_name,
 )
+from genkit._core._dap import DapFn, DapMetadata, DynamicActionProvider
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._model import (
@@ -59,6 +60,10 @@
 
 logger = get_logger(__name__)
 
+# A provider backed by a remote or subprocess transport can stall indefinitely,
+# and the reflection server it is listed for must still answer.
+DEFAULT_DAP_LIST_TIMEOUT_SECONDS = 10.0
+
 # An action store is a nested dictionary mapping ActionKind to a dictionary of
 # action names and their corresponding Action instances.
 #
@@ -98,6 +103,77 @@ def _action_metadata_for_registered_action(action: Action) -> ActionMetadata:
     )
 
 
+# The event loop holds only a weak reference to a running task.
+_dap_listing_tasks: set[asyncio.Task[dict[str, ActionMetadata]]] = set()
+
+
+def _release_listing_task(task: asyncio.Task[dict[str, ActionMetadata]]) -> None:
+    """Drop a finished listing and take its outcome so asyncio does not report it as never retrieved."""
+    _dap_listing_tasks.discard(task)
+    if not task.cancelled():
+        task.exception()
+
+
+def _is_runnable_dap_key(key: str) -> bool:
+    """Report whether ``resolve_action_by_key`` can resolve this DAP child key."""
+    try:
+        kind, name = parse_action_key(key)
+    except ValueError:
+        return False
+    return kind == ActionKind.DYNAMIC_ACTION_PROVIDER and parse_dap_qualified_name(name) is not None
+
+
+async def _list_dap_children(
+    provider_name: str,
+    provider: DynamicActionProvider,
+    timeout_seconds: float | None,
+) -> dict[str, ActionMetadata]:
+    """List one provider's children for the catalog, degrading to no rows on failure.
+
+    Children whose key ``resolve_action_by_key`` cannot parse are dropped, so the
+    catalog never offers a row that fails when it is run.
+
+    Args:
+        provider_name: Registered name of the provider action.
+        provider: The provider whose children to list.
+        timeout_seconds: How long to wait for the listing, or None to wait
+            indefinitely.
+
+    Returns:
+        Map of qualified child key to metadata, empty if the provider timed out,
+        failed, or had its listing cancelled.
+    """
+    task = asyncio.create_task(provider.list_action_metadata_by_key(provider_name))
+    _dap_listing_tasks.add(task)
+    task.add_done_callback(_release_listing_task)
+
+    # asyncio.wait rather than wait_for: cancelling would abort a fetch that
+    # concurrent callers share through the provider cache.
+    done, _pending = await asyncio.wait({task}, timeout=timeout_seconds)
+    if not done:
+        logger.warning('Timed out listing actions for dynamic action provider %s', provider_name)
+        return {}
+    if task.cancelled():
+        # Only a third party can have cancelled it: this coroutine's own
+        # cancellation surfaces at the await above and propagates from there.
+        logger.warning('Listing actions for dynamic action provider %s was cancelled', provider_name)
+        return {}
+    try:
+        children = task.result()
+    except Exception:
+        logger.exception('Error listing actions for dynamic action provider %s', provider_name)
+        return {}
+
+    runnable = {key: meta for key, meta in children.items() if _is_runnable_dap_key(key)}
+    if len(runnable) != len(children):
+        logger.warning(
+            'Skipped %d action(s) from dynamic action provider %s: their keys cannot be resolved',
+            len(children) - len(runnable),
+            provider_name,
+        )
+    return runnable
+
+
 class Registry:
     """Central repository for Genkit resourc
```

**File**: `py/packages/genkit/tests/genkit/ai/dap_test.py` (modified, +1/-2)
```diff
@@ -34,10 +34,9 @@
     DapMetadata,
     DapValue,
     DynamicActionProvider,
-    define_dynamic_action_provider,
     is_dynamic_action_provider,
 )
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider
 from genkit._core._typing import ActionMetadata
 
 
```

**File**: `py/packages/genkit/tests/genkit/ai/dynamic_tools_generate_test.py` (modified, +11/-11)
```diff
@@ -23,9 +23,9 @@
 from genkit._ai._generate import expand_wildcard_tools, resolve_tool
 from genkit._ai._testing import define_programmable_model
 from genkit._core._action import Action, ActionKind
-from genkit._core._dap import DapValue, define_dynamic_action_provider
+from genkit._core._dap import DapValue
 from genkit._core._error import GenkitError, RuntimeErrorReason
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider
 from genkit._core._typing import (
     FinishReason,
     Role,
@@ -98,19 +98,19 @@ async def dap_fn() -> DapValue:
 
     define_dynamic_action_provider(registry, 'mcp', dap_fn)
 
-    # The provider is a catalog row. Its tools are not — people pick them
-    # with a selector, and generate binds them on the child it passes in.
+    # The provider and its tools are catalog rows, but only under the DAP-qualified
+    # key: generate binds ``/tool.v2/echo`` on the child registry it passes in.
     before = await registry.list_actions()
     assert '/dynamic-action-provider/mcp' in before
-    assert '/dynamic-action-provider/mcp:tool/echo' not in before
+    assert '/dynamic-action-provider/mcp:tool/echo' in before
     assert '/tool.v2/echo' not in before
 
     expanded = await expand_wildcard_tools(registry, ['mcp:tool/echo'])
     assert expanded == ['/tool.v2/echo']
     assert registry._entries.get(ActionKind.TOOL, {}).get('echo') is echo
     catalog = await registry.list_actions()
     assert catalog['/tool.v2/echo'].name == 'echo'
-    assert '/dynamic-action-provider/mcp:tool/echo' not in catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in catalog
     assert '/dynamic-action-provider/mcp' in catalog
 
 
@@ -143,8 +143,8 @@ async def dap_fn() -> DapValue:
 
 
 @pytest.mark.asyncio
-async def test_mcp_tool_echo_does_not_appear_on_the_app_catalog() -> None:
-    """mcp:tool/echo is not a row on the app catalog. /tool.v2/echo lives on the generate child."""
+async def test_mcp_tool_echo_is_not_a_tool_v2_row_on_the_app_catalog() -> None:
+    """mcp:tool/echo is a DAP-qualified row. /tool.v2/echo lives on the generate child."""
     parent = Registry()
 
     async def tool_fn(x: str) -> str:
@@ -165,7 +165,7 @@ async def dap_fn() -> DapValue:
 
     parent_catalog = await parent.list_actions()
     assert '/dynamic-action-provider/mcp' in parent_catalog
-    assert '/dynamic-action-provider/mcp:tool/echo' not in parent_catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in parent_catalog
     assert '/tool.v2/echo' not in parent_catalog
 
     child_catalog = await child.list_actions()
@@ -356,7 +356,7 @@ async def dap_fn() -> DapValue:
     assert 'echo' not in ai.registry._entries.get(ActionKind.TOOL, {})
     root_catalog = await ai.registry.list_actions()
     assert '/dynamic-action-provider/mcp' in root_catalog
-    assert '/dynamic-action-provider/mcp:tool/echo' not in root_catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in root_catalog
     assert '/tool.v2/echo' not in root_catalog
 
 
@@ -393,7 +393,7 @@ async def dap_fn() -> DapValue:
     assert 'dap_only_tool' not in root_tools
     root_catalog = await ai.registry.list_actions()
     assert '/dynamic-action-provider/mcp' in root_catalog
-    assert '/dynamic-action-provider/mcp:tool/dap_only_tool' not in root_catalog
+    assert '/dynamic-action-provider/mcp:tool/dap_only_tool' in root_catalog
     assert '/tool.v2/dap_only_tool' not in root_catalog
 
 
```

---

### Incident Patch 5: `f093bb97` (2026-09-23)
**Commit Message**: fix(py/core): make dynamic action provider fetches loop and thread safe (#6379)

**File**: `py/packages/genkit/src/genkit/_core/_dap.py` (modified, +62/-28)
```diff
@@ -17,6 +17,7 @@
 """Dynamic Action Provider (DAP) support for Genkit."""
 
 import asyncio
+import threading
 import time
 from collections.abc import Awaitable, Callable, Mapping
 from typing import Any
@@ -40,7 +41,18 @@
 
 
 class DynamicActionProvider:
-    """Lazily resolves actions from an external source with TTL caching."""
+    """Lazily resolves actions from an external source with TTL caching.
+
+    The cached actions are shared by every event loop that lists this provider,
+    so an action returned by ``dap_fn`` must resolve any loop-bound resource of
+    its own when it is called, not when it is listed. In-flight fetches are
+    coalesced per loop, because a task cannot be awaited from a loop other than
+    the one that created it.
+
+    The cache is one attribute holding both the value and its expiry, so a
+    reader takes a consistent pair in a single read and an invalidation from
+    another thread cannot land between the two.
+    """
 
     def __init__(
         self,
@@ -50,45 +62,67 @@ def __init__(
     ) -> None:
         self.action = action
         self._dap_fn = dap_fn
-        self._value: DapValue | None = None
-        self._expires_at: float | None = None
-        self._fetch_task: asyncio.Task[DapValue] | None = None
+        self._cache: tuple[DapValue, float] | None = None
+        self._fetch_tasks: dict[asyncio.AbstractEventLoop, asyncio.Task[DapValue]] = {}
+        self._fetch_tasks_lock = threading.Lock()
         self._ttl_millis = (
             _DEFAULT_CACHE_TTL_MS if cache_ttl_millis is None or cache_ttl_millis == 0 else cache_ttl_millis
         )
 
     def invalidate_cache(self) -> None:
-        self._value = None
-        self._expires_at = None
+        """Drop the cached actions so the next call fetches them again."""
+        self._cache = None
 
     async def _get_or_fetch(self, skip_trace: bool = False) -> DapValue:
-        """Get cached value or fetch fresh data, coalescing concurrent fetches."""
-        is_stale = (
-            self._value is None
-            or self._expires_at is None
-            or self._ttl_millis < 0
-            or time.time() * 1000 > self._expires_at
-        )
-        if not is_stale and self._value is not None:
-            return self._value
-
-        if self._fetch_task is not None:
-            return await self._fetch_task
-
-        self._fetch_task = asyncio.create_task(self._do_fetch(skip_trace))
-        try:
-            return await self._fetch_task
-        finally:
-            self._fetch_task = None
+        """Get cached value or fetch fresh data, coalescing concurrent fetches per loop."""
+        cached = self._cache
+        if cached is not None and self._ttl_millis >= 0:
+            value, expires_at = cached
+            if time.time() * 1000 <= expires_at:
+                return value
+
+        loop = asyncio.get_running_loop()
+        with self._fetch_tasks_lock:
+            # A pending task strongly references its loop, so weak keys never fire.
+            for ended in [known for known in self._fetch_tasks if known.is_closed()]:
+                del self._fetch_tasks[ended]
+            task = self._fetch_tasks.get(loop)
+            if task is None:
+                task = asyncio.create_task(self._do_fetch(skip_trace))
+                self._fetch_tasks[loop] = task
+                task.add_done_callback(self._forget_fetch(loop))
+
+        # Shielded, so a caller that is cancelled cannot cancel the fetch every
+        # other caller on this loop is waiting on.
+        return await asyncio.shield(task)
+
+    def _forget_fetch(self, loop: asyncio.AbstractEventLoop) -> Callable[[asyncio.Task[DapValue]], None]:
+        """Build the callback that drops a finished fetch from the per-loop table.
+
+        Cleanup belongs to the task rather than to whichever caller started it,
+        because a shielded caller can be cancelled while the fetch it started
+        keeps running, and dropping the en
```

**File**: `py/packages/genkit/tests/genkit/ai/dap_test.py` (modified, +320/-0)
```diff
@@ -17,17 +17,28 @@
 """Tests for the Dynamic Action Provider (DAP) module."""
 
 import asyncio
+import concurrent.futures
+import contextlib
+import gc
+import sys
+import threading
+import time
+from collections.abc import Iterator
+from types import SimpleNamespace
 
 import pytest
 
+from genkit._core import _dap
 from genkit._core._action import Action, ActionKind
 from genkit._core._dap import (
+    DapMetadata,
     DapValue,
     DynamicActionProvider,
     define_dynamic_action_provider,
     is_dynamic_action_provider,
 )
 from genkit._core._registry import Registry
+from genkit._core._typing import ActionMetadata
 
 
 @pytest.fixture
@@ -302,6 +313,115 @@ async def dap_fn() -> DapValue:
     assert call_count == 1
 
 
+@pytest.mark.asyncio
+async def test_a_cancelled_caller_does_not_cancel_the_fetch_others_are_waiting_on(
+    registry: Registry, tool1: Action, tool2: Action
+) -> None:
+    """Callers coalesce onto one task, so an unshielded await would let any of them cancel it."""
+    call_count = 0
+
+    async def dap_fn() -> DapValue:
+        nonlocal call_count
+        call_count += 1
+        await asyncio.sleep(0.05)
+        return {'tool': [tool1, tool2]}
+
+    dap = define_dynamic_action_provider(registry, 'my-dap', dap_fn)
+
+    leaving = asyncio.create_task(dap.list_action_metadata('tool', '*'))
+    staying = asyncio.create_task(dap.list_action_metadata('tool', '*'))
+    await asyncio.sleep(0)
+    leaving.cancel()
+
+    with pytest.raises(asyncio.CancelledError):
+        await leaving
+    assert len(await staying) == 2
+    assert call_count == 1
+
+
+@pytest.mark.asyncio
+async def test_a_cancelled_caller_leaves_its_fetch_coalescing_for_the_next_one(
+    registry: Registry, tool1: Action, tool2: Action
+) -> None:
+    """The caller that starts a fetch may leave before it finishes, and the entry outlives it."""
+    call_count = 0
+    started = asyncio.Event()
+
+    async def dap_fn() -> DapValue:
+        nonlocal call_count
+        call_count += 1
+        started.set()
+        await asyncio.sleep(0.05)
+        return {'tool': [tool1, tool2]}
+
+    dap = define_dynamic_action_provider(registry, 'my-dap', dap_fn)
+
+    starter = asyncio.create_task(dap.list_action_metadata('tool', '*'))
+    await started.wait()
+    starter.cancel()
+    with pytest.raises(asyncio.CancelledError):
+        await starter
+
+    assert len(await dap.list_action_metadata('tool', '*')) == 2
+    assert call_count == 1
+
+
+@pytest.mark.asyncio
+async def test_a_failed_fetch_abandoned_by_its_only_caller_is_not_reported_as_unretrieved(
+    registry: Registry,
+) -> None:
+    """Cancelling the last shielded caller unhooks shield's retrieval, leaving the task to take its own.
+
+    Python 3.14 reports a discarded shielded exception itself whatever the task does, so the
+    never-retrieved report is the only one pinned here.
+    """
+    started = asyncio.Event()
+    reported: list[str] = []
+    asyncio.get_running_loop().set_exception_handler(
+        lambda _loop, context: reported.append(str(context.get('message')))
+    )
+
+    async def dap_fn() -> DapValue:
+        started.set()
+        await asyncio.sleep(0.05)
+        raise RuntimeError('mcp server died')
+
+    dap = define_dynamic_action_provider(registry, 'my-dap', dap_fn)
+
+    starter = asyncio.create_task(dap.list_action_metadata('tool', '*'))
+    await started.wait()
+    starter.cancel()
+    with pytest.raises(asyncio.CancelledError):
+        await starter
+
+    await asyncio.sleep(0.1)
+    gc.collect()
+    await asyncio.sleep(0)
+
+    assert [message for message in reported if 'never retrieved' in message] == []
+
+
+@pytest.mark.asyncio
+async def test_a_finished_fetch_is_dropped_so_the_next_call_refetches(
+    registry: Registry, tool1: Action, tool2: Action
+) -> None:
+    """Coalescing is per fetch, not a second cache: the entry goes when the task completes."""
+    call_count = 0
+
+    async def dap_fn() -> Da
```

---

### Incident Patch 6: `118865b6` (2026-09-23)
**Commit Message**: fix(py/plugins/openai): encodingFormat 'base64' no longer fails embedding validation (#6346)

Co-authored-by: Hilary <holaryc@gmail.com>

**File**: `py/packages/genkit-openai/src/genkit_openai/openai_plugin.py` (modified, +5/-4)
```diff
@@ -465,7 +465,7 @@ async def embed_fn(request: EmbedRequest) -> EmbedResponse:
 
             # Get optional parameters (omit when None; OpenAI create() uses Omit, not None)
             dimensions: int | None = None
-            encoding_format: Literal['base64', 'float'] | None = None
+            encoding_format: Literal['float'] | None = None
             if request.options:
                 dim_val = request.options.get('dimensions')
                 if dim_val is not None:
@@ -476,9 +476,10 @@ async def embed_fn(request: EmbedRequest) -> EmbedResponse:
                             message=f'dimensions must be an int, got {dim_val!r}',
                         )
                     dimensions = dim_val
-                enc_val = request.options.get('encodingFormat')
-                if enc_val in ('float', 'base64'):
-                    encoding_format = cast(Literal['base64', 'float'], enc_val)
+                # 'base64' is deliberately not forwarded: the SDK sends base64 either
+                # way and only decodes the response when it was not asked explicitly.
+                if request.options.get('encodingFormat') == 'float':
+                    encoding_format = 'float'
 
             # Call with only non-None optional params to satisfy strict typings
             try:
```

**File**: `py/packages/genkit-openai/tests/openai_plugin_test.py` (modified, +29/-5)
```diff
@@ -31,7 +31,7 @@
 from openai import APIStatusError, APITimeoutError
 from openai.types import Model
 
-from genkit import Document, EmbedRequest, GenkitError, Supports
+from genkit import Document, EmbedRequest, EmbedResponse, GenkitError, Supports
 from genkit.plugin_api import ActionKind, ActionMetadata, loop_local_client
 
 
@@ -274,21 +274,21 @@ def _embedder_client(error: Exception) -> MagicMock:
     return client
 
 
-def _embedding_client() -> MagicMock:
+def _embedding_client(embedding: list[float] | None = None) -> MagicMock:
     """Create a stub client whose embeddings call returns one vector."""
     client = MagicMock()
     item = MagicMock()
-    item.embedding = [0.1, 0.2]
+    item.embedding = [0.1, 0.2] if embedding is None else embedding
     result = MagicMock()
     result.data = [item]
     client.embeddings.create = AsyncMock(return_value=result)
     return client
 
 
-async def _run_embedder(client: MagicMock, options: dict[str, Any] | None = None) -> None:
+async def _run_embedder(client: MagicMock, options: dict[str, Any] | None = None) -> EmbedResponse:
     """Run the embedder action function against a stub client."""
     action = _plugin_with(client)._create_embedder_action('openai/text-embedding-3-small')
-    await action._fn(EmbedRequest(input=[Document.from_text('hello')], options=options))
+    return await action._fn(EmbedRequest(input=[Document.from_text('hello')], options=options))
 
 
 @pytest.mark.asyncio
@@ -313,6 +313,30 @@ async def test_embedder_maps_status_errors_for_every_option_shape(options: dict[
     assert exc_info.value.__cause__ is api_error
 
 
+@pytest.mark.asyncio
+async def test_embedder_requesting_base64_omits_the_parameter() -> None:
+    """encodingFormat=base64 is not forwarded, so the SDK decodes the vector itself."""
+    values = [0.1, -0.25, 0.5]
+    client = _embedding_client(embedding=values)
+
+    response = await _run_embedder(client, options={'encodingFormat': 'base64'})
+
+    client.embeddings.create.assert_awaited_once_with(model='text-embedding-3-small', input=['hello'])
+    assert [e.embedding for e in response.embeddings] == [values]
+
+
+@pytest.mark.asyncio
+async def test_embedder_forwards_float_encoding_format() -> None:
+    """encodingFormat=float is a genuinely different request, so it is passed through."""
+    client = _embedding_client()
+
+    await _run_embedder(client, options={'encodingFormat': 'float'})
+
+    client.embeddings.create.assert_awaited_once_with(
+        model='text-embedding-3-small', input=['hello'], encoding_format='float'
+    )
+
+
 @pytest.mark.asyncio
 async def test_embedder_carries_retry_after_metadata() -> None:
     """A rate-limited embed reports RESOURCE_EXHAUSTED with the parsed delay."""
```

---

### Incident Patch 7: `b8019785` (2026-09-21)
**Commit Message**: fix(go/plugins/mcp): honor StreamableHTTPConfig.HTTPClient in the Str… (#6339)

Co-authored-by: Adesina H <delameh@icloud.com>

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ require (
 	github.com/jackc/pgx/v5 v5.7.5
 	github.com/jba/slog v0.2.0
 	github.com/lib/pq v1.10.9
-	github.com/mark3labs/mcp-go v0.29.0
+	github.com/mark3labs/mcp-go v0.32.0
 	github.com/pgvector/pgvector-go v0.3.0
 	github.com/weaviate/weaviate v1.30.0
 	github.com/weaviate/weaviate-go-client/v5 v5.1.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -291,8 +291,8 @@ github.com/mailru/easyjson v0.7.6/go.mod h1:xzfreul335JAWq5oZzymOObrkdz5UnU4kGfJ
 github.com/mailru/easyjson v0.7.7/go.mod h1:xzfreul335JAWq5oZzymOObrkdz5UnU4kGfJJLY9Nlc=
 github.com/mailru/easyjson v0.9.0 h1:PrnmzHw7262yW8sTBwxi1PdJA3Iw/EKBa8psRf7d9a4=
 github.com/mailru/easyjson v0.9.0/go.mod h1:1+xMtQp2MRNVL/V1bOzuP3aP8VNwRW55fQUto+XFtTU=
-github.com/mark3labs/mcp-go v0.29.0 h1:sH1NBcumKskhxqYzhXfGc201D7P76TVXiT0fGVhabeI=
-github.com/mark3labs/mcp-go v0.29.0/go.mod h1:rXqOudj/djTORU/ThxYx8fqEVj/5pvTuuebQ2RC7uk4=
+github.com/mark3labs/mcp-go v0.32.0 h1:fgwmbfL2gbd67obg57OfV2Dnrhs1HtSdlY/i5fn7MU8=
+github.com/mark3labs/mcp-go v0.32.0/go.mod h1:rXqOudj/djTORU/ThxYx8fqEVj/5pvTuuebQ2RC7uk4=
 github.com/markbates/oncer v0.0.0-20181203154359-bf2de49a0be2/go.mod h1:Ld9puTsIW75CHf65OeIOkyKbteujpZVXDpWK6YGZbxE=
 github.com/markbates/safe v1.0.1/go.mod h1:nAqgmRi7cY2nqMc92/bSEeQA+R4OheNU2T1kNSCBdG0=
 github.com/mbleigh/raymond v0.0.0-20250414171441-6b3a58ab9e0a h1:v2cBA3xWKv2cIOVhnzX/gNgkNXqiHfUgJtA3r61Hf7A=
```

**File**: `go/plugins/mcp/client.go` (modified, +29/-12)
```diff
@@ -43,10 +43,19 @@ type SSEConfig struct {
 
 // StreamableHTTPConfig contains options for the Streamable HTTP transport
 type StreamableHTTPConfig struct {
-	BaseURL    string
-	Headers    map[string]string
-	HTTPClient *http.Client  // Optional custom HTTP client
-	Timeout    time.Duration // HTTP request timeout
+	BaseURL string
+	Headers map[string]string
+	// HTTPClient is an optional custom HTTP client. The transport takes a
+	// shallow copy of it, so later changes to the client's own fields
+	// (Timeout, Transport, Jar, ...) are not observed by an MCP client that
+	// has already been created. Note also that its Timeout, if set, bounds the
+	// entire response read - including the text/event-stream response the
+	// transport consumes until the final JSON-RPC message - so a short Timeout
+	// will abort long-running or streaming tool calls.
+	HTTPClient *http.Client
+	// Timeout is the HTTP request timeout. When set, it takes precedence over
+	// HTTPClient.Timeout and carries the same caveat.
+	Timeout time.Duration
 }
 
 // MCPClientOptions holds configuration for the MCPClient.
@@ -166,12 +175,24 @@ func (c *GenkitMCPClient) createTransport(options MCPClientOptions) (transport.I
 
 	if options.StreamableHTTP != nil {
 		var streamableHTTPOptions []transport.StreamableHTTPCOption
+		if httpClient := options.StreamableHTTP.HTTPClient; httpClient != nil {
+			// Shallow-copy the caller's client before handing it to the transport,
+			// so that applying the configured timeout below cannot mutate (or race
+			// on) a client shared elsewhere, e.g. http.DefaultClient.
+			clientCopy := *httpClient
+			// Set the timeout on the copy directly rather than via WithHTTPTimeout:
+			// that option mutates whichever client is installed at the time it runs,
+			// which would make the result depend on option ordering.
+			if options.StreamableHTTP.Timeout > 0 {
+				clientCopy.Timeout = options.StreamableHTTP.Timeout
+			}
+			streamableHTTPOptions = append(streamableHTTPOptions, transport.WithHTTPBasicClient(&clientCopy))
+		} else if options.StreamableHTTP.Timeout > 0 {
+			streamableHTTPOptions = append(streamableHTTPOptions, transport.WithHTTPTimeout(options.StreamableHTTP.Timeout))
+		}
 		if options.StreamableHTTP.Headers != nil {
 			streamableHTTPOptions = append(streamableHTTPOptions, transport.WithHTTPHeaders(options.StreamableHTTP.Headers))
 		}
-		if options.StreamableHTTP.Timeout > 0 {
-			streamableHTTPOptions = append(streamableHTTPOptions, transport.WithHTTPTimeout(options.StreamableHTTP.Timeout))
-		}
 
 		transportImpl, err := transport.NewStreamableHTTP(options.StreamableHTTP.BaseURL, streamableHTTPOptions...)
 		if err != nil {
@@ -186,11 +207,7 @@ func (c *GenkitMCPClient) createTransport(options MCPClientOptions) (transport.I
 // initializeClient initializes the MCP client connection
 func (c *GenkitMCPClient) initializeClient(ctx context.Context, mcpClient *client.Client, version string) string {
 	initReq := mcp.InitializeRequest{
-		Params: struct {
-			ProtocolVersion string                 `json:"protocolVersion"`
-			Capabilities    mcp.ClientCapabilities `json:"capabilities"`
-			ClientInfo      mcp.Implementation     `json:"clientInfo"`
-		}{
+		Params: mcp.InitializeParams{
 			ProtocolVersion: mcp.LATEST_PROTOCOL_VERSION,
 			ClientInfo: mcp.Implementation{
 				Name:    "genkit-mcp-client",
```

**File**: `go/plugins/mcp/client_test.go` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+// Copyright 2025 Google LLC
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package mcp
+
+import (
+	"context"
+	"errors"
+	"io"
+	"net/http"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/mark3labs/mcp-go/client/transport"
+	"github.com/mark3labs/mcp-go/mcp"
+)
+
+type roundTripFunc func(*http.Request) (*http.Response, error)
+
+func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
+	return f(req)
+}
+
+// TestCreateTransportHonorsStreamableHTTPClient verifies that a custom
+// http.Client set on StreamableHTTPConfig is actually used by the Streamable
+// HTTP transport, rather than being silently ignored.
+func TestCreateTransportHonorsStreamableHTTPClient(t *testing.T) {
+	var mu sync.Mutex
+	var requests int
+
+	customClient := &http.Client{
+		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
+			mu.Lock()
+			requests++
+			mu.Unlock()
+			return &http.Response{
+				StatusCode: http.StatusOK,
+				Header:     http.Header{"Content-Type": []string{"application/json"}},
+				Body: io.NopCloser(strings.NewReader(
+					`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05"}}`,
+				)),
+				Request: req,
+			}, nil
+		}),
+	}
+
+	c := &GenkitMCPClient{}
+	tr, err := c.createTransport(MCPClientOptions{
+		StreamableHTTP: &StreamableHTTPConfig{
+			BaseURL:    "http://example.com/mcp",
+			HTTPClient: customClient,
+			Timeout:    7 * time.Second,
+		},
+	})
+	if err != nil {
+		t.Fatalf("createTransport() error = %v", err)
+	}
+
+	// The caller's client must NOT be mutated: the transport receives a shallow
+	// copy, so a timeout configured here must not leak back onto customClient.
+	if customClient.Timeout != 0 {
+		t.Errorf("custom client Timeout = %v, want 0; the transport must not mutate the caller's client", customClient.Timeout)
+	}
+
+	// Drive one request through the transport to prove it uses the custom client.
+	ctx := context.Background()
+	if err := tr.Start(ctx); err != nil {
+		t.Fatalf("Start() error = %v", err)
+	}
+	if _, err := tr.SendRequest(ctx, transport.JSONRPCRequest{
+		JSONRPC: "2.0",
+		ID:      mcp.NewRequestId(1),
+		Method:  string(mcp.MethodInitialize),
+	}); err != nil {
+		t.Fatalf("SendRequest() error = %v", err)
+	}
+
+	mu.Lock()
+	defer mu.Unlock()
+	if requests == 0 {
+		t.Error("custom HTTP client transport was not used; expected at least one request")
+	}
+}
+
+// TestCreateTransportAppliesTimeoutToCustomClient verifies that
+// StreamableHTTPConfig.Timeout still takes effect when a custom http.Client is
+// supplied, and that it is applied to the copy rather than depending on the
+// order in which transport options happen to be assembled.
+func TestCreateTransportAppliesTimeoutToCustomClient(t *testing.T) {
+	customClient := &http.Client{
+		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
+			select {
+			case <-req.Context().Done():
+				// The client's Timeout cancelled the request, as expected.
+				return nil, req.Context().Err()
+			case <-time.After(2 * time.Second):
+				// The timeout never reached this client. Answer normally so the
+				// assertion below reports it rather than hanging the test.
+				return &http.Response{
+					StatusCode: http.StatusOK,
+					Header:     http.Header{"Content-Type": []string{"application/json"}},
+					Body: io.NopCloser(strings.NewReader(
+						`{"jsonrpc":"2.0","id":1,"result":{}}`,
+					)),
+					Request
```

**File**: `go/plugins/mcp/prompts.go` (modified, +2/-7)
```diff
@@ -49,10 +49,7 @@ func (c *GenkitMCPClient) GetPrompt(ctx context.Context, g *genkit.Genkit, promp
 // fetchMCPPrompt retrieves a prompt from the MCP server
 func (c *GenkitMCPClient) fetchMCPPrompt(ctx context.Context, promptName string, args map[string]string) (*mcp.GetPromptResult, error) {
 	req := mcp.GetPromptRequest{
-		Params: struct {
-			Name      string            `json:"name"`
-			Arguments map[string]string `json:"arguments,omitempty"`
-		}{
+		Params: mcp.GetPromptParams{
 			Name:      promptName,
 			Arguments: args,
 		},
@@ -143,9 +140,7 @@ func (c *GenkitMCPClient) getPrompts(ctx context.Context) ([]mcp.Prompt, error)
 func (c *GenkitMCPClient) fetchPromptsPage(ctx context.Context, cursor mcp.Cursor) ([]mcp.Prompt, mcp.Cursor, error) {
 	listReq := mcp.ListPromptsRequest{
 		PaginatedRequest: mcp.PaginatedRequest{
-			Params: struct {
-				Cursor mcp.Cursor `json:"cursor,omitempty"`
-			}{
+			Params: mcp.PaginatedParams{
 				Cursor: cursor,
 			},
 		},
```

---

### Incident Patch 8: `d786b9ed` (2026-09-21)
**Commit Message**: fix(py): generate returns completed history instead of raising when a turn dies (#6255)

**File**: `py/packages/genkit-a2ui/src/genkit_a2ui/__init__.py` (modified, +2/-1)
```diff
@@ -17,7 +17,7 @@
 """A2UI generate middleware for Genkit."""
 
 from ._catalog import A2uiCatalog, A2uiCatalogComponent
-from ._loader import load_catalog, load_catalog_file, register_basic_catalog
+from ._loader import A2uiCatalogError, load_catalog, load_catalog_file, register_basic_catalog
 from ._middleware import Surfaces, SurfacesConfig
 from ._parser import A2uiParseError
 from ._part import a2ui_part, envelopes_from_parts, is_a2ui_part
@@ -29,6 +29,7 @@
     'DEFAULT_CATALOG_ID',
     'A2uiCatalog',
     'A2uiCatalogComponent',
+    'A2uiCatalogError',
     'A2uiParseError',
     'Surfaces',
     'SurfacesConfig',
```

**File**: `py/packages/genkit-a2ui/src/genkit_a2ui/_loader.py` (modified, +28/-7)
```diff
@@ -21,6 +21,7 @@
 import json
 from pathlib import Path
 
+from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._protocols import GenkitLike, RegistryLike
 
@@ -30,14 +31,34 @@
 logger = get_logger(__name__)
 
 
+class A2uiCatalogError(GenkitError):
+    """Raised when a catalog cannot be read, registered, or resolved.
+
+    `load_catalog` and `load_catalog_file` raise this at startup, so a bad
+    catalog file fails loudly before any model call. `resolve_catalog` runs
+    inside the model call instead, so an unregistered catalog id comes back as a
+    failed `ModelResponse` with the reason on `finish_message`.
+    """
+
+    def __init__(self, message: str) -> None:
+        # A catalog you did not register, or a file that does not parse, is a
+        # bad argument, not a bad model answer. Mirrors Go's
+        # ErrInvalidInput = ErrInvalidArgument.Subtype("invalid input").
+        super().__init__(
+            status='INVALID_ARGUMENT',
+            message=message,
+            reason=RuntimeErrorReason.INVALID_INPUT,
+        )
+
+
 def load_catalog(ai: GenkitLike, catalog: A2uiCatalog) -> A2uiCatalog:
     if not catalog.id:
-        raise ValueError('a2ui: load_catalog: catalog has no id')
+        raise A2uiCatalogError('a2ui: load_catalog: catalog has no id')
     existing = ai.registry.lookup_value(A2UI_CATALOG_VALUE_TYPE, catalog.id)
     if existing is not None:
         current = A2uiCatalog.from_value(existing)
         if current is None:
-            raise ValueError(f'a2ui: load_catalog: registry value {catalog.id!r} is not a catalog')
+            raise A2uiCatalogError(f'a2ui: load_catalog: registry value {catalog.id!r} is not a catalog')
         if current != catalog:
             logger.warning(
                 'a2ui: load_catalog: a different catalog is already registered under this id; keeping the existing one'
@@ -59,12 +80,12 @@ def read_catalog_file(*, path: str) -> A2uiCatalog:
     try:
         raw = json.loads(Path(path).read_text(encoding='utf-8'))
     except (OSError, UnicodeDecodeError) as exc:
-        raise ValueError(f'a2ui: failed to read catalog file {path!r}: {exc}') from exc
+        raise A2uiCatalogError(f'a2ui: failed to read catalog file {path!r}: {exc}') from exc
     except json.JSONDecodeError as exc:
-        raise ValueError(f'a2ui: catalog file {path!r} is not valid JSON: {exc}') from exc
+        raise A2uiCatalogError(f'a2ui: catalog file {path!r} is not valid JSON: {exc}') from exc
     catalog = A2uiCatalog.from_value(raw)
     if catalog is None:
-        raise ValueError(
+        raise A2uiCatalogError(
             f'a2ui: catalog file {path!r} is not a catalog '
             '(need an id, a components array, and a name on every component)'
         )
@@ -77,11 +98,11 @@ def resolve_catalog(*, registry: RegistryLike, catalog: str | None) -> A2uiCatal
     if found is not None:
         resolved = A2uiCatalog.from_value(found)
         if resolved is None:
-            raise ValueError(f'a2ui: registry value {lookup!r} is not a catalog')
+            raise A2uiCatalogError(f'a2ui: registry value {lookup!r} is not a catalog')
         return resolved
     if lookup in {DEFAULT_CATALOG_ID, BASIC_CATALOG_ID}:
         return BASIC_CATALOG
-    raise ValueError(
+    raise A2uiCatalogError(
         f'a2ui: no catalog registered under id {lookup!r}; '
         f'register one with load_catalog(ai, catalog) or use the default {DEFAULT_CATALOG_ID!r} catalog'
     )
```

**File**: `py/packages/genkit-a2ui/src/genkit_a2ui/_middleware.py` (modified, +17/-9)
```diff
@@ -26,6 +26,7 @@
 from pydantic import BaseModel, ConfigDict, Field
 
 from genkit._core._model import (
+    ABNORMAL_FINISH_REASONS,
     Message,
     ModelRequest,
     ModelResponse,
@@ -41,14 +42,13 @@
 from ._part import a2ui_part, envelopes_from_parts, has_a2ui_mime
 from ._types import DEFAULT_VERSION, SURFACE_KEYS, Envelope, SupportedVersion, ValidateMode
 
-ABNORMAL_FINISH_REASONS = frozenset({
-    FinishReason.BLOCKED,
-    FinishReason.ABORTED,
-    FinishReason.INTERRUPTED,
-    FinishReason.FAILED,
-    FinishReason.OTHER,
-    FinishReason.UNKNOWN,
-})
+# Everything core refuses to parse, plus UNKNOWN. Core asks "is there
+# conforming output to validate?"; this asks "is there a complete fence to
+# turn into a card?" UNKNOWN answers no here and yes there: plugins map
+# unrecognized provider reasons to it, so core keeps validating in case the
+# model finished, while a turn that may have stopped mid-fence would paint a
+# half-written card.
+SKIP_REWRITE_FINISH_REASONS = ABNORMAL_FINISH_REASONS | {FinishReason.UNKNOWN}
 
 
 class SurfacesConfig(BaseModel):
@@ -57,6 +57,9 @@ class SurfacesConfig(BaseModel):
     model_config = ConfigDict(extra='forbid', populate_by_name=True)
 
     instructions: Literal['system', 'none'] = 'system'
+    # 'off' passes envelopes through unchecked, 'warn' logs and drops the
+    # offending block, 'strict' kills the turn. Default is 'warn' because a
+    # single hallucinated component should not cost the whole answer.
     validation: ValidateMode = Field(default='warn', alias='validate')
     surface_id: str | None = Field(default=None, alias='surfaceId')
     # Registry id from load_catalog. The Developer UI lists those same ids.
@@ -72,6 +75,11 @@ class Surfaces(BaseMiddleware[SurfacesConfig]):
     prior surfaces and button clicks. A stopped turn (blocked / interrupted /
     aborted / failed / unknown / other) is left alone — the stop is the result,
     not a salvaged card.
+
+    Under `validate='strict'` a bad fence fails the turn: generate returns a
+    response with `finish_reason` failed, no `message`, and the reason on
+    `error`. `messages` ends at the user turn, so a retry does not feed the
+    hallucinated surface back to the model.
     """
 
     async def wrap_model(
@@ -107,7 +115,7 @@ async def wrap_model(
             if handler is not None:
                 ctx.replace_on_chunk(handler.emit)
 
-        if response.finish_reason in ABNORMAL_FINISH_REASONS:
+        if response.finish_reason in SKIP_REWRITE_FINISH_REASONS:
             return response
         if handler is not None and handler.parse_error is not None:
             raise handler.parse_error
```

**File**: `py/packages/genkit-a2ui/src/genkit_a2ui/_parser.py` (modified, +23/-2)
```diff
@@ -24,6 +24,7 @@
 from dataclasses import dataclass, field
 from typing import Any, cast
 
+from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 
 from ._catalog import A2uiCatalog
@@ -56,8 +57,28 @@ class ClosedBlock:
     prose: str = ''
 
 
-class A2uiParseError(ValueError):
-    """Raised in strict mode when a fence is malformed or names an unknown component."""
+class A2uiParseError(GenkitError):
+    """Raised in strict mode when a fence is malformed or names an unknown component.
+
+    You rarely catch this directly. Strict mode fails the turn, so `ai.generate`
+    boxes it into a failed `ModelResponse`: `finish_message` carries the reason
+    ("component 'X' is not in catalog 'Y'") and `messages` stops at your prompt,
+    keeping the unrenderable surface out of history you send again.
+    """
+
+    def __init__(self, message: str) -> None:
+        # Invalid output is an INTERNAL subtype, not a bad argument: the caller
+        # asked correctly and the model answered with something unrenderable.
+        # Same pairing as ModelResponse._mark_invalid_output and as Go's
+        # ErrInvalidOutput = ErrInternal.Subtype("invalid output").
+        #
+        # INTERNAL does not cost the message. Boxing only redacts an exception
+        # it does not recognize, or a GenkitError wrapping a foreign cause.
+        super().__init__(
+            status='INTERNAL',
+            message=message,
+            reason=RuntimeErrorReason.INVALID_OUTPUT,
+        )
 
 
 class StreamParser:
```

**File**: `py/packages/genkit-a2ui/tests/catalog_loader_test.py` (modified, +45/-17)
```diff
@@ -26,7 +26,7 @@
     A2UI_CATALOG_VALUE_TYPE,
     A2uiCatalog,
     A2uiCatalogComponent,
-    A2uiParseError,
+    A2uiCatalogError,
     Surfaces,
     SurfacesConfig,
     load_catalog,
@@ -35,6 +35,7 @@
 )
 from helpers import (
     BASIC_CATALOG_ID,
+    assert_dead_turn,
     assert_finished_message,
     create_surface_ids,
     envelopes,
@@ -46,6 +47,8 @@
 )
 from pydantic import ValidationError
 
+from genkit._core._error import RuntimeErrorReason
+
 BANNER_CATALOG = A2uiCatalog(
     id='https://example.com/catalogs/banner.json',
     components=(A2uiCatalogComponent(name='Banner', description='A banner.', props='title: string.'),),
@@ -107,16 +110,26 @@ async def test_generate_default_stays_basic_when_a_custom_catalog_is_registered(
 
 
 @pytest.mark.asyncio
-async def test_generate_unknown_catalog_fails_before_the_model() -> None:
+async def test_generate_unknown_catalog_fails_the_turn_before_the_model() -> None:
+    """An unregistered catalog id kills the turn without ever reaching the model.
+
+    This one is your configuration, not the model's answer, so it reports
+    INVALID_ARGUMENT rather than the INTERNAL a strict-mode refusal uses.
+    """
     ai, pm = setup()
     pm.responses = [model_ok(weather_fence())]
 
-    with pytest.raises(ValueError, match='no catalog registered'):
-        await ai.generate(
-            model='programmableModel',
-            prompt='banner',
-            use=[Surfaces(catalog=BANNER_CATALOG.id)],
-        )
+    response = await ai.generate(
+        model='programmableModel',
+        prompt='banner',
+        use=[Surfaces(catalog=BANNER_CATALOG.id)],
+    )
+    assert_dead_turn(
+        response,
+        reason=RuntimeErrorReason.INVALID_INPUT,
+        match='no catalog registered',
+        status='INVALID_ARGUMENT',
+    )
     assert pm.last_request is None
 
 
@@ -132,16 +145,17 @@ async def test_generate_catalog_basic_falls_back_without_register() -> None:
 
 @pytest.mark.asyncio
 async def test_generate_strict_rejects_a_component_the_loaded_catalog_lacks() -> None:
+    """Strict mode refuses a component the catalog lacks and drops the turn."""
     ai, pm = setup()
     load_catalog(ai, BANNER_CATALOG)
     pm.responses = [model_ok(weather_fence())]
 
-    with pytest.raises(A2uiParseError, match='not in catalog'):
-        await ai.generate(
-            model='programmableModel',
-            prompt='weather',
-            use=[Surfaces(catalog=BANNER_CATALOG.id, validate='strict')],
-        )
+    response = await ai.generate(
+        model='programmableModel',
+        prompt='weather',
+        use=[Surfaces(catalog=BANNER_CATALOG.id, validate='strict')],
+    )
+    assert_dead_turn(response, reason=RuntimeErrorReason.INVALID_OUTPUT, match='not in catalog')
 
 
 @pytest.mark.asyncio
@@ -211,15 +225,29 @@ def test_load_catalog_same_catalog_twice_is_ok() -> None:
 def test_load_catalog_raises_when_id_already_holds_something_else() -> None:
     ai, _ = setup()
     ai.registry.register_value(A2UI_CATALOG_VALUE_TYPE, BANNER_CATALOG.id, 'not-a-catalog')
-    with pytest.raises(ValueError, match='is not a catalog'):
+    with pytest.raises(A2uiCatalogError, match='is not a catalog'):
+        load_catalog(ai, BANNER_CATALOG)
+
+
+def test_catalog_error_reports_invalid_argument() -> None:
+    """A catalog you did not register is your configuration, so the status says so.
+
+    INVALID_ARGUMENT tells a client the call itself needs fixing, which is
+    true here and false for a strict-mode refusal — that one is the model's
+    answer and reports INTERNAL. The message is not redacted either way.
+    """
+    ai, _ = setup()
+    ai.registry.register_value(A2UI_CATALOG_VALUE_TYPE, BANNER_CATALOG.id, 'not-a-catalog')
+    with pytest.raises(A2uiCatalogError, match='is not a catalog') as exc_info:
         load_catalog(ai, BANNER_CATALOG)
+    assert exc_info.value.status == 'INVALID_ARGUMENT'
 
 
 def test_load_catalog_file_names_the_path_when_the_fi
```

---

### Incident Patch 9: `30cfeafb` (2026-09-18)
**Commit Message**: fix(py): use async Google GenAI model discovery (#6298)

Co-authored-by: Hilary <holaryc@gmail.com>

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/google.py` (modified, +60/-148)
```diff
@@ -57,7 +57,7 @@
 from google.auth.credentials import Credentials
 from google.auth.exceptions import DefaultCredentialsError
 from google.genai.client import DebugConfig
-from google.genai.types import HttpOptions, HttpOptionsDict
+from google.genai.types import HttpOptions, HttpOptionsDict, Model as GenaiModel
 from pydantic import BaseModel
 
 import genkit_google_genai.constants as const
@@ -181,102 +181,68 @@ def __init__(self) -> None:
         self.veo = []
 
 
-def _list_genai_models(client: genai.Client, is_vertex: bool) -> GenaiModels:
-    """Discover and categorize available models from the Google GenAI API.
-
-    This function queries the API for all available models and categorizes them.
-    Models marked as deprecated are excluded.
-
-    Two categorization strategies are used depending on the backend:
-
-    - Google AI populates each model's ``supported_actions`` field, so models
-      are categorized by action:
-        - 'embedContent' action → embedders
-        - 'predict' + Imagen name (``imagen-``) → imagen
-        - 'generateVideos' or Veo name (``veo-``) → veo
-        - 'generateContent' + 'gemini'/'gemma' in name → gemini
-    - Vertex AI returns ``supported_actions = None`` for every publisher model,
-      so categorizing by action would skip them all. The Vertex path instead
-      categorizes by model name:
-        - Imagen name (``imagen-``) → imagen
-        - Veo name (``veo-``) → veo
-        - 'gemini'/'gemma' in name (and not an embedding) → gemini
-      Ids with no working generate path here (``imagegeneration@*``,
-      ``imagetext@*``, ``virtual-try-on-*``) are not categorized at all, so
-      they are never advertised or registered.
-      Embedders are intentionally NOT discovered here. The Vertex catalog
-      over-lists embedders that are published but not callable, so they
-      are advertised from a curated list (``VERTEX_KNOWN_EMBEDDERS``) instead.
+def _categorize_genai_model(m: GenaiModel, models: GenaiModels, is_vertex: bool) -> None:
+    """Add a model to the appropriate catalog bucket."""
+    name = m.name
+    if not name:
+        return
+
+    # Cleanup prefix
+    if is_vertex:
+        if name.startswith('publishers/google/models/'):
+            name = name[25:]
+    elif name.startswith('models/'):
+        name = name[7:]
+
+    description = (m.description or '').lower()
+    if 'deprecated' in description:
+        return
+
+    # Vertex AI returns supported_actions=None for every publisher model, so
+    # categorize by name. Embedders are deliberately excluded: the catalog
+    # over-lists embedders that are not callable, so they are advertised from a curated list
+    # (VERTEX_KNOWN_EMBEDDERS) rather than discovered here.
+    if is_vertex:
+        lower_name = name.lower()
+        if 'embedding' in lower_name:
+            return
+        elif is_unsupported_image_model_name(name):
+            return
+        elif is_imagen_model_name(name):
+            models.imagen.append(name)
+        elif is_veo_model(name):
+            models.veo.append(name)
+        elif 'gemini' in lower_name or 'gemma' in lower_name:
+            models.gemini.append(name)
+        return
 
-    Args:
-        client: The Google GenAI client instance.
-        is_vertex: True if using Vertex AI, False for Google AI.
+    if not m.supported_actions:
+        return
 
-    Returns:
-        GenaiModels containing categorized model names.
+    # Embedders
+    if 'embedContent' in m.supported_actions:
+        models.embedders.append(name)
 
-    Note:
-        Model name prefixes are stripped for consistency:
-        - Vertex AI: 'publishers/google/models/' prefix removed
-        - Google AI: 'models/' prefix removed
-    """
-    models = GenaiModels()
+    # Imagen (imagen- prefix, not a bare "image" substring)
+    if 'predict' in m.supported_actions and is_imagen_model_name(name):
+        models.imagen.append(name)
 
-    for m in client.models.list():
-       
```

**File**: `py/packages/genkit-google-genai/test/google_plugin_test.py` (modified, +30/-150)
```diff
@@ -20,9 +20,10 @@
 import os
 import sys  # noqa
 import unittest
+from collections.abc import AsyncIterator
 from dataclasses import dataclass
 from typing import Any, cast
-from unittest.mock import ANY, MagicMock, patch
+from unittest.mock import ANY, AsyncMock, MagicMock, patch
 
 import pytest
 from genkit_google_genai import GoogleAI, VertexAI
@@ -59,6 +60,15 @@ async def _get_runtime_client(plugin: GoogleAI | VertexAI) -> object:
     return plugin._runtime_client()
 
 
+async def _async_model_pager(models: list[Any]) -> AsyncIterator[Any]:
+    for model in models:
+        yield model
+
+
+def _set_async_model_list(mock_client: MagicMock, models: list[Any]) -> None:
+    mock_client.aio.models.list = AsyncMock(side_effect=lambda: _async_model_pager(models))
+
+
 @pytest.fixture
 @patch('google.genai.client.Client')
 def googleai_plugin_instance(client: MagicMock) -> GoogleAI:
@@ -146,7 +156,7 @@ async def test_googleai_initialize(mock_client_cls: MagicMock) -> None:
     m2.supported_actions = ['embedContent']
     m2.description = ' Embedding '
 
-    mock_client.models.list.return_value = [m1, m2]
+    _set_async_model_list(mock_client, [m1, m2])
 
     api_key = 'test_api_key'
     plugin = GoogleAI(api_key=api_key)
@@ -330,10 +340,11 @@ class MockModel:
         MockModel(supported_actions=['embedContent'], name='models/gemini-embedding-2-preview'),
         MockModel(supported_actions=['embedContent'], name='models/gemini-embedding-001'),
         MockModel(supported_actions=['generateContent'], name='models/gemini-2.0-flash-tts'),  # TTS
+        MockModel(supported_actions=['generateVideos'], name='models/veo-2.0-generate-001'),  # Veo
     ]
 
     mock_client = MagicMock()
-    mock_client.models.list.return_value = models_return_value
+    _set_async_model_list(mock_client, models_return_value)
     googleai_plugin_instance._runtime_client = lambda: mock_client
 
     result = await googleai_plugin_instance.list_actions()
@@ -371,86 +382,10 @@ class MockModel:
     # assert action3.config_schema == GeminiTtsConfigSchema
     # assert action1.config_schema == GeminiConfigSchema
 
-
-@pytest.mark.asyncio
-async def test_googleai_list_known_models(googleai_plugin_instance: GoogleAI) -> None:
-    """Unit test for list known models."""
-
-    @dataclass
-    class MockModel:
-        supported_actions: list[str]
-        name: str
-        description: str = ''
-
-    models_return_value = [
-        MockModel(supported_actions=['generateContent'], name='models/gemini-pro'),
-        MockModel(supported_actions=['embedContent'], name='models/gemini-embedding-001'),
-        MockModel(supported_actions=['generateContent'], name='models/gemini-2.0-flash-tts'),  # TTS
-    ]
-
-    mock_client = MagicMock()
-    mock_client.models.list.return_value = models_return_value
-    googleai_plugin_instance._runtime_client = lambda: mock_client
-
-    result = googleai_plugin_instance._list_known_models()
-
-    # Check Gemini Pro
-    action1 = next(a for a in result if a.name == googleai_name('gemini-pro'))
-    assert action1 is not None
-
-    # Check TTS
-    action3 = next(a for a in result if a.name == googleai_name('gemini-2.0-flash-tts'))
-    assert action3 is not None
-
-
-@pytest.mark.asyncio
-async def test_googleai_list_known_veo_models(googleai_plugin_instance: GoogleAI) -> None:
-    """Unit test for list known veo models."""
-
-    @dataclass
-    class MockModel:
-        supported_actions: list[str]
-        name: str
-        description: str = ''
-
-    models_return_value = [
-        MockModel(supported_actions=['generateVideos'], name='models/veo-2.0-generate-001'),
-    ]
-
-    mock_client = MagicMock()
-    mock_client.models.list.return_value = models_return_value
-    googleai_plugin_instance._runtime_client = lambda: mock_client
-
-    result = googleai_plugin_instance._list_known_veo_models()
-
     # Check Veo
-    action1 = next(a for a in result if a.name == googleai_name('veo-2.0-generat
```

**File**: `py/packages/genkit-google-genai/tests/google_genai_plugin_test.py` (modified, +33/-10)
```diff
@@ -20,6 +20,7 @@
 import os
 import queue
 import threading
+from collections.abc import AsyncIterator
 from typing import cast, get_args, get_type_hints
 from unittest.mock import AsyncMock, MagicMock, patch
 
@@ -704,7 +705,8 @@ async def test_list_actions_advertises_veo_as_background(mock_list_models: Magic
         assert veo_entries[0].action_type == ActionKind.BACKGROUND_MODEL
 
 
-def test_list_genai_models_vertex_skips_substring_veo_and_retired_image() -> None:
+@pytest.mark.asyncio
+async def test_list_genai_models_vertex_skips_substring_veo_and_retired_image() -> None:
     """Discovery buckets on the ``veo-`` prefix, not a ``veo`` substring."""
 
     def _model(name: str) -> MagicMock:
@@ -714,22 +716,43 @@ def _model(name: str) -> MagicMock:
         item.description = ''
         return item
 
+    async def model_pager() -> AsyncIterator[MagicMock]:
+        for model in [
+            _model('publishers/google/models/gemini-2.5-flash'),
+            _model('publishers/google/models/veo-3.0-generate-001'),
+            _model('publishers/google/models/braveo-lab'),
+            _model('publishers/google/models/imagegeneration@006'),
+            _model('publishers/google/models/virtual-try-on-001'),
+            _model('publishers/google/models/imagetext@001'),
+        ]:
+            yield model
+
     client = MagicMock()
-    client.models.list.return_value = [
-        _model('publishers/google/models/gemini-2.5-flash'),
-        _model('publishers/google/models/veo-3.0-generate-001'),
-        _model('publishers/google/models/braveo-lab'),
-        _model('publishers/google/models/imagegeneration@006'),
-        _model('publishers/google/models/virtual-try-on-001'),
-        _model('publishers/google/models/imagetext@001'),
-    ]
-    catalog = _list_genai_models(client, is_vertex=True)
+    client.aio.models.list = AsyncMock(return_value=model_pager())
+    catalog = await _list_genai_models(client, is_vertex=True)
     assert catalog.veo == ['veo-3.0-generate-001']
     assert catalog.imagen == []
     assert 'imagetext@001' not in catalog.gemini
     assert 'braveo-lab' not in catalog.gemini
 
 
+@pytest.mark.asyncio
+async def test_list_genai_models_async_does_not_block_event_loop() -> None:
+    """Model discovery uses the SDK's asynchronous client surface."""
+
+    async def empty_models() -> AsyncIterator[MagicMock]:
+        if False:
+            yield MagicMock()
+
+    client = MagicMock()
+    client.aio.models.list = AsyncMock(return_value=empty_models())
+
+    result = await _list_genai_models(client, is_vertex=False)
+
+    client.aio.models.list.assert_awaited_once_with()
+    assert result.gemini == []
+
+
 @patch('genkit_google_genai.google.genai.client.Client')
 @patch('genkit_google_genai.google._list_genai_models')
 @pytest.mark.asyncio
```

**File**: `py/packages/genkit-google-genai/tests/interactions/interactions_models_test.py` (modified, +15/-5)
```diff
@@ -18,6 +18,7 @@
 
 from __future__ import annotations
 
+from collections.abc import AsyncIterator
 from typing import Any
 from unittest.mock import AsyncMock, MagicMock, patch
 
@@ -40,6 +41,15 @@
 from genkit.model import Operation
 
 
+async def _empty_model_pager() -> AsyncIterator[Any]:
+    for model in ():
+        yield model
+
+
+def _set_empty_async_model_list(mock_client: MagicMock) -> None:
+    mock_client.aio.models.list = AsyncMock(side_effect=_empty_model_pager)
+
+
 def test_split_system_instruction_folds_system_turns() -> None:
     messages = [
         Message(role=Role.SYSTEM, content=[Part(TextPart(text='Be helpful'))]),
@@ -648,7 +658,7 @@ async def test_deep_research_background_action_sets_action() -> None:
 @pytest.mark.asyncio
 async def test_googleai_resolve_model_skips_deep_research_foreground() -> None:
     mock_client = MagicMock()
-    mock_client.models.list.return_value = iter([])
+    _set_empty_async_model_list(mock_client)
 
     with patch('genkit_google_genai.google.genai.client.Client', return_value=mock_client):
         plugin = GoogleAI(api_key='test-key')
@@ -663,7 +673,7 @@ async def test_googleai_resolve_model_skips_deep_research_foreground() -> None:
 @pytest.mark.asyncio
 async def test_googleai_plugin_registers_interactions_models() -> None:
     mock_client = MagicMock()
-    mock_client.models.list.return_value = iter([])
+    _set_empty_async_model_list(mock_client)
 
     with patch('genkit_google_genai.google.genai.client.Client', return_value=mock_client):
         plugin = GoogleAI(api_key='test-key')
@@ -684,7 +694,7 @@ async def test_googleai_plugin_registers_interactions_models() -> None:
 @pytest.mark.asyncio
 async def test_googleai_resolve_routes_interactions_models() -> None:
     mock_client = MagicMock()
-    mock_client.models.list.return_value = iter([])
+    _set_empty_async_model_list(mock_client)
 
     with patch('genkit_google_genai.google.genai.client.Client', return_value=mock_client):
         plugin = GoogleAI(api_key='test-key')
@@ -722,7 +732,7 @@ async def test_googleai_resolve_routes_interactions_models() -> None:
 @pytest.mark.asyncio
 async def test_googleai_list_actions_includes_interactions_models() -> None:
     mock_client = MagicMock()
-    mock_client.models.list.return_value = iter([])
+    _set_empty_async_model_list(mock_client)
 
     with patch('genkit_google_genai.google.genai.client.Client', return_value=mock_client):
         plugin = GoogleAI(api_key='test-key')
@@ -737,7 +747,7 @@ async def test_googleai_list_actions_includes_interactions_models() -> None:
 @pytest.mark.asyncio
 async def test_vertex_keeps_interactions_families_fail_closed() -> None:
     mock_client = MagicMock()
-    mock_client.models.list.return_value = iter([])
+    _set_empty_async_model_list(mock_client)
 
     with patch('genkit_google_genai.google.genai.client.Client', return_value=mock_client):
         plugin = VertexAI(project='p', location='us-central1')
```

---

### Incident Patch 10: `8812fc22` (2026-09-15)
**Commit Message**: fix(js/plugins/google-genai): TTS ModelInfo no longer claims constrained support (#6341)

**File**: `js/plugins/google-genai/src/googleai/gemini.ts` (modified, +2/-1)
```diff
@@ -452,7 +452,8 @@ const GENERIC_TTS_MODEL = commonRef(
       tools: false,
       toolChoice: false,
       systemRole: false,
-      constrained: 'all',
+      constrained: 'none',
+      output: ['media'],
     },
   },
   GeminiTtsConfigSchema
```

**File**: `js/plugins/google-genai/tests/googleai/gemini_test.ts` (modified, +92/-0)
```diff
@@ -92,6 +92,21 @@ describe('Google AI Gemini', () => {
     messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
   };
 
+  const jsonOutputSchema = {
+    type: 'object',
+    properties: { name: { type: 'string' } },
+  };
+
+  const constrainedJsonRequest: GenerateRequest<typeof GeminiConfigSchema> = {
+    ...minimalRequest,
+    output: {
+      format: 'json',
+      contentType: 'application/json',
+      constrained: true,
+      schema: jsonOutputSchema,
+    },
+  };
+
   const mockCandidate = {
     index: 0,
     content: {
@@ -596,6 +611,69 @@ describe('Google AI Gemini', () => {
         );
       });
 
+      it('sets a response schema for constrained JSON output', async () => {
+        const model = defineModel('gemini-2.5-flash', defaultPluginOptions);
+        mockFetchResponse(defaultApiResponse);
+        await model.run(constrainedJsonRequest);
+
+        const apiRequest: GenerateContentRequest = JSON.parse(
+          fetchStub.lastCall.args[1].body
+        );
+        assert.strictEqual(
+          apiRequest.generationConfig?.responseMimeType,
+          'application/json'
+        );
+        assert.deepStrictEqual(
+          apiRequest.generationConfig?.responseJsonSchema,
+          jsonOutputSchema
+        );
+      });
+
+      it('sets a legacy response schema for constrained JSON output', async () => {
+        const model = defineModel('gemini-2.5-flash', {
+          ...defaultPluginOptions,
+          legacyResponseSchema: true,
+        });
+        mockFetchResponse(defaultApiResponse);
+        await model.run(constrainedJsonRequest);
+
+        const apiRequest: GenerateContentRequest = JSON.parse(
+          fetchStub.lastCall.args[1].body
+        );
+        assert.deepStrictEqual(
+          apiRequest.generationConfig?.responseSchema,
+          jsonOutputSchema
+        );
+        assert.strictEqual(
+          apiRequest.generationConfig?.responseJsonSchema,
+          undefined
+        );
+      });
+
+      it('simulates constrained generation for TTS models', async () => {
+        const model = defineModel(
+          'gemini-2.5-flash-preview-tts',
+          defaultPluginOptions
+        );
+        mockFetchResponse(defaultApiResponse);
+        await model.run(constrainedJsonRequest);
+
+        const apiRequest: GenerateContentRequest = JSON.parse(
+          fetchStub.lastCall.args[1].body
+        );
+        assert.deepStrictEqual(apiRequest.generationConfig, {
+          responseModalities: ['AUDIO'],
+        });
+        const lastMessage = apiRequest.contents[apiRequest.contents.length - 1];
+        assert.ok(
+          lastMessage.parts.some((part) =>
+            part.text?.includes(
+              'Output should be in JSON format and conform to the following schema'
+            )
+          )
+        );
+      });
+
       it('defaults responseModalities to TEXT, IMAGE for image models', async () => {
         const model = defineModel(
           'gemini-2.5-flash-image',
@@ -720,6 +798,8 @@ describe('Google AI Gemini', () => {
       const modelRef = model(name);
       assert.strictEqual(modelRef.name, `googleai/${name}`);
       assert.strictEqual(modelRef.info?.supports?.multiturn, false);
+      assert.strictEqual(modelRef.info?.supports?.constrained, 'none');
+      assert.deepStrictEqual(modelRef.info?.supports?.output, ['media']);
       assert.strictEqual(modelRef.configSchema, GeminiTtsConfigSchema);
     });
 
@@ -728,6 +808,18 @@ describe('Google AI Gemini', () => {
       const modelRef = model(name);
       assert.strictEqual(modelRef.name, `googleai/${name}`);
       assert.strictEqual(modelRef.info?.supports?.multiturn, false);
+      assert.strictEqual(modelRef.info?.supports?.constrained, 'none');
+      assert.deepStrictEqual(modelRef.info?.supports?.output, ['media']);
+      assert.strictEqual(modelRef.configSchema, GeminiTtsConfigSchema);
+    });
+
+    it('returns a ModelReference for an unknown tts model string', () => 
```

**File**: `js/plugins/google-genai/tests/googleai/index_test.ts` (modified, +10/-0)
```diff
@@ -243,6 +243,16 @@ describe('GoogleAI Plugin', () => {
         !modelRef.info?.supports?.multiturn,
         'Gemini TTS model should not support multiturn'
       );
+      assert.strictEqual(
+        modelRef.info?.supports?.constrained,
+        'none',
+        'Gemini TTS model should not support constrained generation'
+      );
+      assert.deepStrictEqual(
+        modelRef.info?.supports?.output,
+        ['media'],
+        'Gemini TTS model should output media'
+      );
     });
 
     it('should have config values for gemini TTS', () => {
```

#### Recent Merged Pull Requests:
- **PR #6487** (2026-09-30): docs(cli,js,go,python): add coding agent skill installation instructions to READMEs (@pavelgj)
- **PR #6484** (2026-09-30): fix(google-genai): correct Vertex multimodal embedding dimensions (@harbinresearcher)
- **PR #6474** (closed): chore(deps): bump fast-uri from 3.0.6 to 3.1.8 in /samples/js-character-generator (@dependabot[bot])
- **PR #6472** (closed): chore(deps): bump ip-address and socks in /samples/js-chatbot/genkit-app (@dependabot[bot])
- **PR #6471** (closed): chore(deps): bump @angular/platform-server from 20.3.21 to 20.3.31 in /js (@dependabot[bot])
- **PR #6467** (2026-09-28): chore(js): bump next to ^16.3.3 (@MichaelDoyle)
- **PR #6449** (2026-09-25): fix(go/ai): seed the Genkit instance in the `util/generate` action (@apascal07)
- **PR #6434** (closed): chore(deps): bump hpack from 4.1.0 to 4.2.0 in /py (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
