# Forensic Learning Record (Deep Inspection): openai/openai-agents-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/openai-openai-agents-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openai/openai-agents-js](https://github.com/openai/openai-agents-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:46:40.397Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openai/openai-agents-js`
- **Description**: A lightweight, powerful framework for multi-agent workflows and voice agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3889 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/implementation-final-review/scripts/review_state.py`
```
#!/usr/bin/env python3
"""Print deterministic content and repository fingerprints for a review state."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(
        ("git", "-C", os.fspath(repo), *args), stderr=subprocess.PIPE
    )


def _git_diff(repo: Path, *args: str) -> bytes:
    completed = subprocess.run(
        ("git", "-C", os.fspath(repo), *args),
        capture_output=True,
    )
    if completed.returncode not in {0, 1}:
        raise subprocess.CalledProcessError(
            completed.returncode,
            completed.args,
            output=completed.stdout,
            stderr=completed.stderr,
        )
    return completed.stdout


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True, slots=True)
class _Snapshot:
    tracked_diff: bytes
    complete_diff: bytes
    status: bytes
    workspace: list[dict[str, object]]
    unfiltered_status: bytes
    unfiltered_workspace: list[dict[str, object]]
    component_workspaces: dict[str, list[dict[str, object]]]


class _NonRegularFileError(ValueError):
    pass


def _nonblocking_opener(path: str, flags: int) -> int:
    return os.open(path, flags | getattr(os, "O_NONBLOCK", 0))


def _read_regular_file(path: Path) -> tuple[bytes, os.stat_result]:
    with open(path, "rb", opener=_nonblocking_opener) as file:
        file_stat = os.fstat(file.fileno())
        if not stat.S_ISREG(file_stat.st_mode):
            raise _NonRegularFileError(path)
        return file.read(), file_stat


def _unsafe_index_paths(repo: Path) -> tuple[tuple[str, str], ...]:
    raw_entries = _git(repo, "ls-files", "-v", "-z")
    unsafe_paths: list[tuple[str, str]] = []
    for entry in raw_entries.split(b"\0"):
        if len(entry) < 3 or entry[1:2] != b" ":
            continue
        tag = entry[:1]
        relative_path = os.fsdecode(entry[2:])
        if tag.islower():
            unsafe_paths.append(("assume-unchanged", relative_path))
        elif tag == b"S":
            candidate = repo / relative_path
            if candidate.exists() or candidate.is_symlink():
                unsafe_paths.append(("materialized skip-worktree", relative_path))
    for entry in _git(repo, "ls-files", "--unmerged", "-z").split(b"\0"):
        _, separator, raw_path = entry.partition(b"\t")
        if separator:
            unsafe_paths.append(("unmerged", os.fsdecode(raw_path)))
    return tuple(sorted(set(unsafe_paths)))


def _require_reviewable_index(repo: Path, context: str = "repository") -> None:
    unsafe_paths = _unsafe_index_paths(repo)
    if unsafe_paths:
        details = ", ".join(f"{kind}={path}" for kind, path in unsafe_paths)
        raise ValueError(f"The {context} contains unsupported index state: {details}")


def _index_gitlinks(repo: Path) -> dict[str, str]:
    raw_entries = _git(repo, "ls-files", "--stage", "-z")
    gitlinks: dict[str, str] = {}
    for raw_entry in raw_entries.split(b"\0"):
        metadata, separator, raw_path = raw_entry.partition(b"\t")
        fields = metadata.split()
        if separator and len(fields) == 3 and fields[0] == b"160000" and fields[2] == b"0":
            gitlinks[os.fsdecode(raw_path)] = fields[1].decode()
    return gitlinks


def _is_repository_root(path: Path) -> bool:
    try:
        top_level = _git(path, "rev-parse", "--show-toplevel")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False
    return Path(os.fsdecode(top_level.rstrip(b"\n"))).resolve() == path.resolve()


def _require_clean_submodule(
    repo: Path,
    display_path: str,
    expected_head: str,
    ancestors: frozenset[Path],
) -> None:
    resolved_repo = repo.resolve()
    if resolved_repo in ancestors:
        raise ValueError(f"Cyclic submodule worktree is unsupported: {display_path}")
    ancestors |= {resolved_repo}
    _require_reviewable_index(repo, f"submodule {display_path}")
    actual_head = _git(repo, "rev-parse", "HEAD^{commit}").decode().strip()
    if actual_head != expected_head:
        raise ValueError(f"Submodule HEAD does not match the parent index: {display_path}")
    for nested_relative_path, nested_head in _index_gitlinks(repo).items():
        nested_path = repo / nested_relative_path
        _require_clean_gitlink(
            nested_path,
            f"{display_path}/{nested_relative_path}",
            nested_head,
            ancestors,
        )
    if _git(
        repo,
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ):
        raise ValueError(f"Dirty submodule worktrees are unsupported: {display_path}")


def _require_clean_gitlink(
    path: Path,
    display_path: str,
    expected_head: str,
    ancestors: frozenset[Path],
) -> None:
    if _is_repository_root(path):
        _require_clean_submodule(path, display_path, expected_head, ancestors)
    elif path.is_dir() and any(path.iterdir()):
        raise ValueError(f"Materialized gitlink is not an initialized submodule: {display_path}")


def _require_clean_submodules(repo: Path) -> None:
    ancestors = frozenset({repo.resolve()})
    for relative_path, expected_head in _index_gitlinks(repo).items():
        _require_clean_gitlink(
            repo / relative_path,
            relative_path,
            expected_head,
            ancestors,
        )


def _write_bytes_atomically(path: Path, data: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".review-state-diff-",
        dir=path.parent,
    )
    try:
        with os.fdopen(descriptor, "wb") as temporary_file:
            temporary_file.write(data)
        os.replace(temporary_name, path)
    finally:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass


def _directory_is_within(path: Path, root: Path) -> bool:
    current = path
    while True:
        try:
            if current.samefile(root):
                return True
        except OSError:
            pass
        parent = current.parent
        if parent == current:
            return False
        current = parent


def _canonical_pathspecs(pathspecs: tuple[str, ...]) -> tuple[str, ...]:
    canonical: list[str] = []
    seen: set[str] = set()
    for pathspec in pathspecs:
        if not pathspec:
            raise ValueError("Pathspecs must not be empty.")
        if "\0" in pathspec:
            raise ValueError("Pathspecs must not contain NUL bytes.")
        if pathspec not in seen:
            canonical.append(pathspec)
            seen.add(pathspec)
    return tuple(canonical)


def _base_has_literal_path(repo: Path, base: str, pathspec: str) -> bool:
    raw_path = os.fsencode(pathspec)
    entries = _git(
        repo,
        "ls-tree",
        "-z",
        base,
        "--",
        f":(literal){pathspec}",
    )
    for entry in entries.split(b"\0"):
        metadata, separator, entry_path = entry.partition(b"\t")
        fields = metadata.split()
        if separator and entry_path == raw_path and len(fields) >= 2 and fields[1] != b"tree":
            return True
    return False


def _load_pathspec_file(path: Path) -> tuple[str, ...]:
    try:
        data, _ = _read_regular_file(path)
        values = [line for line in data.decode().splitlines() if line]
    except (OSError, UnicodeError, ValueError) as error:
        raise ValueError(f"Cannot read pathspec file {path}: {error}") from error
    return _canonical_pathspecs(tuple(values))


def _read_workspace_file(path: Path, relative_path: str) -> tuple[bytes, os.stat_result]:
    try:
        return _read_regular_file(path)
    except _NonRegularFileError as error:
        raise ValueError(f"Unsupported workspace file type: {relative_path}") from error
    except OSError as error:
        raise ValueError(f"Cannot read workspace file: {relative_path}") from error


def _workspace_entry(repo: Path, relative_path: str) -> dict[str, object]:
    path = repo / relative_path
    if path.is_symlink():
        content = b"symlink\0" + os.fsencode(os.readlink(path))
        return {
            "path": relative_path,
            "kind": "symlink",
            "sha256": _digest(content),
        }
    if path.is_file():
        file_content, file_stat = _read_workspace_file(path, relative_path)
        content = b"file\0" + file_content
        return {
            "path": relative_path,
            "kind": "file",
            "executable": bool(file_stat.st_mode & 0o100),
            "sha256": _digest(content),
        }
    indexed_head = _index_gitlinks(repo).get(relative_path)
    if path.is_dir():
        if indexed_head is not None:
            return {
                "path": relative_path,
                "kind": "gitlink",
                "head": indexed_head,
            }
        if _is_repository_root(path):
            raise ValueError(f"Untracked nested Git repositories are unsupported: {relative_path}")
        return {"path": relative_path, "kind": "directory"}
    if indexed_head is not None:
        return {
            "path": relative_path,
            "kind": "gitlink",
            "head": indexed_head,
        }
    if path.exists():
        raise ValueError(f"Unsupported workspace file type: {relative_path}")
    return {"path": relative_path, "kind": "missing"}


def _workspace_entries(
    repo: Path, base: str, pathspecs: tuple[str, ...]
) -> list[dict[str, object]]:
    git_pathspecs = _git_pathspecs(repo, base, pathspecs)
    tracked_paths = _git(
        repo,
        "diff",
        "--name-only",
        "--no-renames",
        "--ignore-submodules=none",
        "-z",
        base,
        "--",
        *git_pathspecs,
    )
    untracked_paths = _untracked_pa
```

### Core Architecture Module: `examples/agent-patterns/human-in-the-loop-server.ts`
```
/**
 * A CLI simulation, not an HTTP service or authentication implementation.
 * Complete snapshots and RunResult objects stay in the server implementation.
 * Production needs trusted authentication, request protections, atomic shared
 * storage, bounded retention, and recovery that reconciles tool side effects.
 */
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import readline from 'node:readline/promises';
import { ApprovalServer } from '../docs/human-in-the-loop/server';

async function main() {
  const server = new ApprovalServer(
    new Agent({
      name: 'Weather assistant',
      instructions: 'Use get_temperature to answer temperature questions.',
      tools: [
        tool({
          name: 'get_temperature',
          description: 'Return a sample temperature for a city.',
          parameters: z.object({ city: z.string() }),
          needsApproval: true,
          execute: async ({ city }) =>
            `The temperature in ${city} is 20 Celsius.`,
        }),
      ],
    }),
  );
  // Server-side simulation of authenticated middleware; never a request-body field.
  const authenticatedUserId = 'example-user';
  let response = await server.start(
    authenticatedUserId,
    'What is the temperature in Oakland?',
  );
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    while (response.kind === 'approval') {
      const decisions: Record<string, boolean> = {};
      for (const prompt of response.prompts) {
        // JSON quoting also keeps terminal control characters out of the prompt.
        const answer = await rl.question(
          `Allow ${JSON.stringify(prompt.toolName)} with ${JSON.stringify(prompt.arguments)}? (y/n): `,
        );
        decisions[prompt.decisionId] = answer.trim().toLowerCase() === 'y';
      }
      response = await server.decide(
        authenticatedUserId,
        response.requestId,
        decisions,
      );
    }
    console.log(response.output);
  } finally {
    rl.close();
  }
}

main().catch(() => {
  // Raw SDK errors can contain execution state. Keep diagnostics server-side.
  console.error(
    'The approval run failed. Reconcile side effects before retrying.',
  );
  process.exitCode = 1;
});

```

### Core Architecture Module: `examples/agent-patterns/human-in-the-loop-stream.ts`
```
import { z } from 'zod';
import readline from 'node:readline/promises';
import { Agent, run, tool } from '@openai/agents';

const AUTO_APPROVE_HITL = process.env.AUTO_APPROVE_HITL === '1';

// Prompt user for yes/no confirmation
async function confirm(question: string): Promise<boolean> {
  if (AUTO_APPROVE_HITL) {
    console.log(`[auto-approve] ${question}`);
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(`${question} (y/n): `);
  rl.close();
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

async function main() {
  // Define a tool that requires approval for certain inputs
  const getWeatherTool = tool({
    name: 'get_weather',
    description:
      'Get weather conditions for one city. The result does not include temperature.',
    parameters: z.object({
      city: z.string().describe('City whose weather conditions to retrieve.'),
    }),
    async execute({ city }) {
      return `The weather in ${city} is sunny.`;
    },
  });

  const weatherAgent = new Agent({
    name: 'Weather agent',
    instructions:
      'Use the available tool to report weather conditions for every requested city. Report conditions only, without temperatures.',
    handoffDescription: 'Handles weather-related queries',
    tools: [getWeatherTool],
  });

  const getTemperatureTool = tool({
    name: 'get_temperature',
    description:
      'Get the current temperature for one city. Call separately for each requested city.',
    parameters: z.object({
      city: z.string().describe('City whose current temperature to retrieve.'),
    }),
    needsApproval: async (_ctx, { city }) => city.includes('Oakland'),
    execute: async ({ city }) => {
      return `The temperature in ${city} is 20° Celsius`;
    },
  });

  const mainAgent = new Agent({
    name: 'Main agent',
    instructions:
      'Use the available tools to answer weather questions. Retrieve every requested kind of information for every requested city before answering.',
    tools: [
      getTemperatureTool,
      weatherAgent.asTool({
        toolName: 'ask_weather_agent',
        toolDescription:
          'Get weather conditions for one or more locations. This tool does not return temperatures.',
        // Require approval when the generated input mentions San Francisco.
        needsApproval: async (_ctx, { input }) =>
          input.includes('San Francisco'),
      }),
    ],
  });

  let stream = await run(
    mainAgent,
    'What is the weather and temperature in San Francisco and Oakland?',
    { stream: true },
  );
  stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);
  await stream.completed;

  while (stream.interruptions?.length) {
    console.log(
      'Human-in-the-loop: approval required for the following tool calls:',
    );
    const state = stream.state;
    for (const interruption of stream.interruptions) {
      if (interruption.rawItem.type !== 'function_call') {
        throw new Error(
          'Invalid interruption type: ' + interruption.rawItem.type,
        );
      }
      const ok = await confirm(
        `Agent ${interruption.agent.name} would like to use the tool ${interruption.rawItem.name} with "${interruption.rawItem.arguments}". Do you approve?`,
      );
      if (ok) {
        state.approve(interruption);
      } else {
        state.reject(interruption);
      }
    }

    // Resume execution with streaming output
    stream = await run(mainAgent, state, { stream: true });
    const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });
    textStream.pipe(process.stdout);
    await stream.completed;
  }

  console.log('\n\nDone');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `examples/agent-patterns/human-in-the-loop.ts`
```
// This local CLI trusts its saved state. Browser/mobile approval UIs should keep
// snapshots on the server; see human-in-the-loop-server.ts in agent-patterns.
import { z } from 'zod';
import readline from 'node:readline/promises';
import fs from 'node:fs/promises';
import { Agent, run, tool, RunState, RunResult } from '@openai/agents';

const getWeatherTool = tool({
  name: 'get_weather',
  description:
    'Get weather conditions for one city. The result does not include temperature.',
  parameters: z.object({
    city: z.string().describe('City whose weather conditions to retrieve.'),
  }),
  execute: async ({ city }) => {
    return `The weather in ${city} is sunny`;
  },
});

// A specialist sub-agent that we will expose as a tool.
const weatherAgent = new Agent({
  name: 'Weather agent',
  instructions:
    'Use the available tool to report weather conditions for every requested city. Report conditions only, without temperatures.',
  handoffDescription: 'Handles weather-related queries',
  tools: [getWeatherTool],
});

const getTemperatureTool = tool({
  name: 'get_temperature',
  description:
    'Get the current temperature for one city. Call separately for each requested city.',
  parameters: z.object({
    city: z.string().describe('City whose current temperature to retrieve.'),
  }),
  needsApproval: async (_ctx, { city }) => city.includes('Oakland'),
  execute: async ({ city }) => {
    return `The temperature in ${city} is 20° Celsius`;
  },
});

// Main agent that can call the weather agent as a tool.
const agent = new Agent({
  name: 'Basic test agent',
  instructions:
    'Use the available tools to answer weather questions. Retrieve every requested kind of information for every requested city before answering.',
  tools: [
    getTemperatureTool,
    weatherAgent.asTool({
      toolName: 'ask_weather_agent',
      toolDescription:
        'Get weather conditions for one or more locations. This tool does not return temperatures.',
      // Demonstrate approvals at the agent-as-tool level.
      // Require approval when the input mentions San Francisco.
      needsApproval: async (_ctx, { input }) => input.includes('San Francisco'),
    }),
  ],
});

const AUTO_APPROVE_HITL = process.env.AUTO_APPROVE_HITL === '1';

async function confirm(question: string) {
  if (AUTO_APPROVE_HITL) {
    console.log(`[auto-approve] ${question}`);
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`${question} (y/n): `);
  const normalizedAnswer = answer.toLowerCase();
  rl.close();
  return normalizedAnswer === 'y' || normalizedAnswer === 'yes';
}

async function main() {
  let result: RunResult<unknown, Agent<unknown, any>> = await run(
    agent,
    'What is the weather and temperature in San Francisco and Oakland?',
  );
  let hasInterruptions = result.interruptions?.length > 0;
  while (hasInterruptions) {
    // storing
    await fs.writeFile(
      'result.json',
      JSON.stringify(result.state, null, 2),
      'utf-8',
    );

    // from here on you could run things on a different thread/process

    // reading later on
    const storedState = await fs.readFile('result.json', 'utf-8');
    const state = await RunState.fromString(agent, storedState);

    for (const interruption of result.interruptions) {
      const confirmed = await confirm(
        `Agent ${interruption.agent.name} would like to use the tool ${interruption.name} with "${interruption.arguments || 'no arguments'}". Do you approve?`,
      );

      if (confirmed) {
        state.approve(interruption);
      } else {
        state.reject(interruption);
      }
    }

    // resume execution of the current state
    result = await run(agent, state);
    hasInterruptions = result.interruptions?.length > 0;
  }

  console.log(result.finalOutput);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `examples/basic/agent-lifecycle-example.ts`
```
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

const randomNumberTool = tool({
  name: 'random_number',
  description: 'Generate a random number up to the provided maximum.',
  parameters: z.object({ max: z.number() }),
  execute: async ({ max }: { max: number }) => {
    return Math.floor(Math.random() * (max + 1)).toString();
  },
});

const multiplyByTwoTool = tool({
  name: 'multiply_by_two',
  description: 'Simple multiplication by two.',
  parameters: z.object({ x: z.number() }),
  execute: async ({ x }: { x: number }) => {
    return (x * 2).toString();
  },
});

const multiplyAgent = new Agent({
  name: 'Multiply Agent',
  instructions: 'Multiply the number by 2 and then return the final result.',
  tools: [multiplyByTwoTool],
  outputType: z.object({ number: z.number() }),
});

const startAgent = new Agent({
  name: 'Start Agent',
  instructions:
    "Generate a random number. If it's even, stop. If it's odd, hand off to the multiply agent.",
  tools: [randomNumberTool],
  outputType: z.object({ number: z.number() }),
  handoffs: [multiplyAgent],
});

function attachHooks(agent: Agent<any, any>) {
  agent.on('agent_start', (_ctx, agent) => {
    console.log(`${agent.name} started`);
  });
  agent.on('agent_end', (_ctx, output) => {
    console.log(`${agent.name} ended with output ${output}`);
  });
  agent.on('agent_handoff', (_ctx, nextAgent) => {
    console.log(`${agent.name} handed off to ${nextAgent.name}`);
  });
  agent.on('agent_tool_start', (_ctx, tool) => {
    console.log(`${agent.name} started tool ${tool.name}`);
  });
  agent.on('agent_tool_end', (_ctx, tool, output) => {
    console.log(`${agent.name} tool ${tool.name} ended with output ${output}`);
  });
}

attachHooks(startAgent);
attachHooks(multiplyAgent);

async function main() {
  const result = await run(startAgent, 'Generate a random number up to 10');
  console.log(result.finalOutput);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `examples/basic/lifecycle-example.ts`
```
import { Agent, run, tool, Usage } from '@openai/agents';
import { z } from 'zod';

const randomNumberTool = tool({
  name: 'random_number',
  description: 'Generate a random number up to the provided maximum.',
  parameters: z.object({ max: z.number() }),
  execute: async ({ max }: { max: number }) => {
    return Math.floor(Math.random() * (max + 1)).toString();
  },
});

const multiplyByTwoTool = tool({
  name: 'multiply_by_two',
  description: 'Simple multiplication by two.',
  parameters: z.object({ x: z.number() }),
  execute: async ({ x }: { x: number }) => {
    return (x * 2).toString();
  },
});

const multiplyAgent = new Agent({
  name: 'Multiply Agent',
  instructions: 'Multiply the number by 2 and then return the final result.',
  tools: [multiplyByTwoTool],
  outputType: z.object({ number: z.number() }),
});

const startAgent = new Agent({
  name: 'Start Agent',
  instructions:
    "Generate a random number. If it's even, stop. If it's odd, hand off to the multiply agent.",
  tools: [randomNumberTool],
  outputType: z.object({ number: z.number() }),
  handoffs: [multiplyAgent],
});

function attachHooks(agent: Agent<any, any>) {
  let eventCounter = 0;
  function toPrintableUsage(usage: Usage): string {
    if (!usage) return 'No usage info';
    return (
      `${usage.requests ?? 0} requests, ` +
      `${usage.inputTokens ?? 0} input tokens, ` +
      `${usage.outputTokens ?? 0} output tokens, ` +
      `${usage.totalTokens ?? 0} total tokens`
    );
  }

  agent.on('agent_start', (ctx, agent) => {
    eventCounter++;
    console.log(
      `### ${eventCounter}: ${agent.name} started. Usage: ${toPrintableUsage(ctx?.usage)}`,
    );
  });
  agent.on('agent_end', (ctx, output) => {
    eventCounter++;
    console.log(
      `### ${eventCounter}: ${agent.name} ended with output ${JSON.stringify(output)}. Usage: ${toPrintableUsage(ctx?.usage)}`,
    );
  });
  agent.on('agent_tool_start', (ctx, tool, { toolCall }) => {
    eventCounter++;
    const args = toolCall.type === 'function_call' ? toolCall.arguments : '';
    console.log(
      `### ${eventCounter}: Tool ${tool.name} (args: ${args}) started. Usage: ${toPrintableUsage(ctx?.usage)}`,
    );
  });
  agent.on('agent_tool_end', (ctx, tool, result, { toolCall }) => {
    eventCounter++;
    const args = toolCall.type === 'function_call' ? toolCall.arguments : '';
    console.log(
      `### ${eventCounter}: Tool ${tool.name} (args: ${args}) ended with result ${JSON.stringify(result)}. Usage: ${toPrintableUsage(ctx?.usage)}`,
    );
  });
  agent.on('agent_handoff', (ctx, nextAgent) => {
    eventCounter++;
    console.log(
      `### ${eventCounter}: Handoff from ${agent.name} to ${nextAgent.name}. Usage: ${toPrintableUsage(ctx?.usage)}`,
    );
  });
}

attachHooks(startAgent);
attachHooks(multiplyAgent);

async function main() {
  const result = await run(startAgent, 'Generate a random number up to 10');
  console.log(result.finalOutput);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `examples/mcp/hosted-mcp-human-in-the-loop.ts`
```
import {
  Agent,
  Runner,
  hostedMcpTool,
  RunToolApprovalItem,
} from '@openai/agents';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

async function confirm(item: RunToolApprovalItem): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const name = item.name;
  const params = JSON.parse(item.arguments ?? '{}');
  const answer = await rl.question(
    `Approve running tool (mcp: ${name}, params: ${JSON.stringify(params)})? (y/n) `,
  );
  rl.close();
  return answer.toLowerCase().trim() === 'y';
}

async function main(verbose: boolean, stream: boolean): Promise<void> {
  // 'always' | 'never' | { never, always }
  const requireApproval = {
    never: { toolNames: ['read_wiki_structure', 'read_wiki_contents'] },
    always: { toolNames: ['ask_question'] },
  };
  const agent = new Agent({
    name: 'MCP Assistant',
    instructions:
      'You must always use the MCP tools to answer repository questions.',
    tools: [
      hostedMcpTool({
        serverLabel: 'deepwiki',
        serverUrl: 'https://mcp.deepwiki.com/mcp',
        allowedTools: ['ask_question'],
        requireApproval,
        // when you don't pass onApproval, the agent loop will handle the approval process
      }),
    ],
  });
  // Use the concise question tool first, then allow the model to answer after
  // approval instead of forcing the same tool again.
  const initialRunner = new Runner({
    modelSettings: { toolChoice: 'required' },
  });
  const resumeRunner = new Runner({
    modelSettings: { toolChoice: 'auto' },
  });

  const input =
    'For the repository openai/codex, tell me the primary programming language.';

  if (stream) {
    // Streaming
    let result = await initialRunner.run(agent, input, {
      stream: true,
      maxTurns: 100,
    });
    for await (const event of result) {
      if (verbose) {
        console.log(JSON.stringify(event, null, 2));
      } else {
        if (
          event.type === 'raw_model_stream_event' &&
          event.data.type === 'model'
        ) {
          console.log(event.data.event.type);
        }
      }
    }
    while (result.interruptions && result.interruptions.length) {
      for (const interruption of result.interruptions) {
        // Human in the loop here
        const approval = await confirm(interruption);
        if (approval) {
          result.state.approve(interruption);
        } else {
          result.state.reject(interruption);
        }
      }
      result = await resumeRunner.run(agent, result.state, {
        stream: true,
        maxTurns: 100,
      });
      for await (const event of result) {
        if (verbose) {
          console.log(JSON.stringify(event, null, 2));
        } else if (
          event.type === 'raw_model_stream_event' &&
          event.data.type === 'model'
        ) {
          console.log(event.data.event.type);
        }
      }
    }
    console.log(`Done streaming; final result: ${result.finalOutput}`);
  } else {
    // Non-streaming
    let result = await initialRunner.run(agent, input, { maxTurns: 100 });
    while (result.interruptions && result.interruptions.length) {
      for (const interruption of result.interruptions) {
        // Human in the loop here
        const approval = await confirm(interruption);
        if (approval) {
          result.state.approve(interruption);
        } else {
          result.state.reject(interruption);
        }
      }
      result = await resumeRunner.run(agent, result.state, { maxTurns: 100 });
    }
    console.log(result.finalOutput);

    if (verbose) {
      console.log('----------------------------------------------------------');
      console.log(JSON.stringify(result.newItems, null, 2));
      console.log('----------------------------------------------------------');
    }
  }
}

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const stream = args.includes('--stream');

main(verbose, stream).catch((err) => {
  console.error(err);
  process.exit(1);
});

```

### Core Architecture Module: `examples/memory/oai-compact-stateless.ts`
```
import {
  Agent,
  MemorySession,
  OpenAIResponsesCompactionSession,
  run,
  withTrace,
} from '@openai/agents';
import { fetchImageData } from './tools.ts';

async function main() {
  const session = new OpenAIResponsesCompactionSession({
    model: 'gpt-5.4',
    // If store: false in modelSettings, auto switches to input mode.
    // compactionMode: 'input',
    // Use a local session store because the server is stateless when store is false.
    underlyingSession: new MemorySession(),
    // Auto mode chooses input compaction when store is false.
    // Set a low threshold to observe compaction in action.
    shouldTriggerCompaction: ({ compactionCandidateItems }) =>
      compactionCandidateItems.length >= 4,
  });

  const agent = new Agent({
    name: 'Assistant',
    model: 'gpt-5.4',
    instructions:
      'Keep answers short. This example demonstrates responses.compact with input mode and store=false. For every user turn, call fetch_image_data with the provided label. Do not include raw image bytes or data URLs in your final answer.',
    modelSettings: {
      toolChoice: 'required',
      // When you disable store, auto compaction mode is used.
      store: false,
    },
    tools: [fetchImageData],
  });

  // To see compaction debug logs, run: DEBUG=openai-agents:openai:compaction pnpm -C examples/memory start:oai-compact-stateless.
  await withTrace('memory:compactSession:stateless', async () => {
    const prompts = [
      'Call fetch_image_data with label "alpha". Then explain compaction in 1 sentence.',
      'Call fetch_image_data with label "beta". Then add a fun fact about space in 1 sentence.',
      'Call fetch_image_data with label "gamma". Then add a fun fact about oceans in 1 sentence.',
      'Call fetch_image_data with label "delta". Then add a fun fact about volcanoes in 1 sentence.',
      'Call fetch_image_data with label "epsilon". Then add a fun fact about deserts in 1 sentence.',
    ];

    for (const prompt of prompts) {
      const result = await run(agent, prompt, { session });
      console.log(`\nUser: ${prompt}`);
      console.log(`Assistant: ${result.finalOutput}`);
      console.log(
        'Usage for the turn:',
        result.state.usage.requestUsageEntries,
      );
    }

    const compactedHistory = await session.getItems();
    console.log('\nHistory including compaction and newer items:');
    for (const item of compactedHistory) {
      console.log(`- ${item.type}`);
    }

    // You can manually run compaction without a response id in input mode.
    const compactionResult = await session.runCompaction({ force: true });
    console.log('Manual compaction result:', compactionResult);

    const finalHistory = await session.getItems();
    console.log('\nStored history after final compaction:');
    for (const item of finalHistory) {
      console.log(`- ${item.type}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `examples/nextjs/src/components/ui/utils.ts`
```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `examples/nextjs/src/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `examples/realtime-demo/src/utils.ts`
```
import type { TransportEvent } from '@openai/agents-realtime';

export function log(event: TransportEvent) {
  const log = document.querySelector<HTMLDivElement>('#eventLog')!;
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.innerText = event.type;
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(event, null, 2);
  details.appendChild(summary);
  details.appendChild(pre);
  log.appendChild(details);
}

export const muteButton =
  document.querySelector<HTMLButtonElement>('#muteButton')!;
export const disconnectButton =
  document.querySelector<HTMLButtonElement>('#disconnectButton')!;
export const connectButton =
  document.querySelector<HTMLButtonElement>('#connectButton')!;

type ButtonState = 'muted' | 'unmuted' | 'disconnected';
export function setButtonStates(newState: ButtonState) {
  if (newState === 'muted') {
    disconnectButton.style.display = 'block';
    connectButton.style.display = 'none';
    muteButton.style.display = 'block';
    muteButton.classList.replace('bg-gray-500', 'bg-green-500');
    muteButton.innerText = 'Unmute';
  } else if (newState === 'unmuted') {
    disconnectButton.style.display = 'block';
    connectButton.style.display = 'none';
    muteButton.style.display = 'block';
    muteButton.classList.replace('bg-green-500', 'bg-gray-500');
    muteButton.innerText = 'Mute';
  } else if (newState === 'disconnected') {
    muteButton.style.display = 'none';
    disconnectButton.style.display = 'none';
    connectButton.style.display = 'block';
  }
}

```

### Core Architecture Module: `examples/realtime-next/src/components/ui/utils.ts`
```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1435** (2026-07-02): **Consecutive tool call approvals fail in a streamed run with `previousResponseId`**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  ### Describe the bug  When a streamed run is started with `previousResponseId` and then resumed more than one tool-approval interruption, the run fails with: `400 No tool call found for function call output with call_id <id>`  ### Debug information  - Agents SDK version: v0.11.6 - Runtime environment: Node.js v24.12.0  ### Repro steps  1. Start a streamed run with previousResponseId set. 2. Agent calls an approval-gated tool → interruption. Approve. 3. Agent does more work, then calls another approval-gated tool → second interruption. Approve. 4. SDK sends back second approval including the first tool's `function_call_output` again, but `previous_response_id` now points past its `function_call` -> 400 error  ```js import { Agent, run, tool } from '@openai/agents'; import { z } from 'zod';  const ping = tool({   name: 'ping',   description: 'Ping a host.',   parameters: z.object({ host: z.string() }),   needsApproval: true,   execute: async ({ host }) => `pong ${host}`, });  const agent = new Agent({   name: 'repro',   model: 'gpt-5.4',   instructions:     'Call ping for "example.com", then AFTER it returns call ping again for "google.com". One at a time.',   tools: [ping], });  // Seed a first response so the failing run starts with previousResponseId set. const seed = await r

- **Issue #1340** (2026-05-21): **extractUsage does not propagate outputTokensDetails (reasoning tokens lost in tracing)**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** Yes - **Have you searched for related issues?** Yes, no existing issues for this.  ### Describe the bug  `extractUsage` in `packages/agents-extensions/src/ai-sdk/index.ts` extracts `inputTokensDetails` (cache read/write tokens) but does not extract `outputTokensDetails`. When models use reasoning effort > `'none'`, the AI SDK provider reports output tokens as `{ total: N, reasoning: M }`. The `extractTokenCount` helper correctly reads `.total` for the aggregate count, but the `.reasoning` breakdown is discarded and never propagated to tracing spans via `toTracingUsage`.  This means `GenerationSpanData.usage` never contains output token details (reasoning tokens), making it impossible for downstream tracing/observability integrations to report per-span reasoning token breakdowns.  ### Debug information  - Agents SDK version: `@openai/agents-extensions@0.11.3` (also verified at HEAD/0.11.4) - Runtime environment: Node.js 22.x - AI SDK versions: `ai@^6.0.0`, `@ai-sdk/provider@^3.0.0`  ### Repro steps  1. Configure an agent with a GPT-5.x model using `reasoning: { effort: 'low' }` via the `aisdk()` adapter from `@openai/agents-extensions/ai-sdk` 2. Run the agent and inspect `GenerationSpanData.usage` in a `TracingProcessor.onSpanEnd` callback 3. Observe that `usage` contains `input_tokens`, `output_tokens`, and optionally `input_tokens_details` (with `cached_tokens`) 4. `output_tokens_details` / `reasoning_tokens` is never

- **Issue #1190** (2026-05-05): **`run()` abort with `conversationId` leaves orphan `function_call` items in the conversation store**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) Yes - **Have you searched for related issues?** Others may have faced similar issues. Yes  ### Describe the bug  When a streamed `run()` is aborted via its `signal` after the model has emitted one or more `function_call`s but before the SDK executes the tools and sends the corresponding `function_call_output`s, those calls stay in the server-side conversation store without outputs. Any later `run()` against the same `conversationId` fails with:  > 400 No tool output found for function call call_XXX  ### Our use case We run an SSE endpoint that pipes `run(agent, input, { stream: true, conversationId, signal: controller.signal })` to the client. We wire `controller.abort()` to `req.on('aborted')` / `req.on('close')` to stop the run when the user closes the tab, refreshes, or loses the network. Whenever that happens mid tool-call, the conversation becomes unusable and we have to reconcile orphan items manually via the Conversations API.  ### Reproduction ```js const controller = new AbortController(); const stream = await run(agent, input, {   stream: true,   conversationId,   signal: controller.signal, }); for await (const e of stream) { /* consume */ } ``` Call `controller.abort()` while the model is streaming a `function_call`, then start a new `run()` against the same `conversationId`.  ### Root cause In `@openai/agents-core`, `run.js` around the streamed r
  **Post-Mortem & Fix Analysis**:
  > Hi @seratch, would love to take a stab at this. Posting a proposed approach first to confirm scope before opening a PR.  ## Proposed fix  In `packages/agents-core/src/run.ts` (around the streamed-response loop at L1170–1233), I'd:  1. **Track `function_call` items as they're streamed** — collect call IDs from `event.type === 'response.output_item.added'` (or equivalent) when the item type is `function_call`, into a `pendingFunctionCalls: Map<callId, FunctionCallItem>`. 2. **Reconcile on `response_done`** — clear entries whose tool outputs we know we'll execute below, so successful turns are unaffected. 3. **In the `isAbortError` branch (L1225)** — if `serverConversationTracker?.conversationId` is set AND `pendingFunctionCalls` is non-empty, POST synthetic `function_call_output` items to `/v1/conversations/{conversationId}/items` (one per orphaned call) before returning. Synthetic body: `{ output: 'aborted' }` with `status: 'incomplete'` (matches the precedent set in #1110 for rejected 
  > Put together a fix in https://github.com/openai/openai-agents-js/pull/1198.

- **Issue #1176** (2026-04-17): **Session compaction converts prompt to invalid format**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** yes - **Have you searched for related issues?** yes  ### Describe the bug  After OpenAIResponsesCompactionSession runs compaction it converts prompt images to Responses API format which is not supported by Agents SDK. That means, it changes `{type: 'input_image', image: 'data:image/jpeg;base64,xxx'}` to: `{type: 'input_image', detail:'auto', file_id:null, image_url: 'data:image/jpeg;base64,xxx'}`  ### Debug information  - Agents SDK version: (e.g. `v0.8.3`) - Runtime environment (e.g. `Node.js 24.11.1`)  ### Repro steps  ``` const session = new OpenAIResponsesCompactionSession({ 	client: openai, 	model: 'gpt-5.4', 	underlyingSession: new MemorySession(), 	shouldTriggerCompaction: ({ compactionCandidateItems }) => { 		return compactionCandidateItems.length >= 2; 	} }); const content = [ 	{type: 'input_text', text: 'analyse these images'}, 	{type: 'input_image', image: `data:image/jpeg;base64,${Buffer.from(datafile).toString('base64')}`}, ]; const history = [ 	{role: 'user', content}, 	{role: 'assistant', content: [{type: 'output_text', text: 'how can I help?'}]}, ]; const prompt = [{role: 'user', content: [{type: 'input_text', text: 'analyse these images'}]}];  await session.addItems(history); await session.runCompaction();  const agent = new Agent({name: 'agent', model: 'gpt-5.4', modelSettings: {store: false}}); const res = await run(agent, prompt, {session}); ```  ### Error Error: 400 Missing mutually exclusive param

- **Issue #1163** (2026-04-15): **Bug: Using Twilio Transport extension causes session options specified in non-deprecated format to be silently ignored**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  ### Describe the bug  Using the Twilio extension forces session options to use the "deprecated" format. It also causes RealtimeSession to silently drop the majority of options if specified in the current preferred format. The issue is that [the code ](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-extensions/src/TwilioRealtimeTransport.ts#L69-L88) assigns the audio types to properties that trigger the legacy deprecated check, and causes a change in the session options format internally, which drops the passed values.  Not sure what the best backwards compatible fix for this would be. Maybe check if the partialConfig has attributes in the non-deprecated paths, and assign the ulav values either to new or old props based on that?  ### Debug information  - Agents SDK version: v.0.8.3 - Runtime environment (e.g. `Node.js 22.16.0`)  ### Repro steps If you create a session like so: ``` this.sessionOptions = {         model: config.model,         config: {           ...(inputTranscription && { input_audio_transcription: inputTranscription }),           audio: {             input: {               turnDetection: config.turnDetection,               noiseReduction: config.noiseReduction || { type: 'near_field' },               ...(
  **Post-Mortem & Fix Analysis**:
  > And this is the [location](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-realtime/src/clientMessages.ts#L181) that trips it inside the core Realtime when it is called in [here](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-realtime/src/clientMessages.ts#L202). So in essence, when the audio format fields are added by the Twilio extension, it deprecates any config passed in automatically.

- **Issue #972** (2026-02-16): **Built-in tools (shellTool, applyPatchTool, computerTool) don’t emit tracing spans**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  > Note: I have used AI to produce a detailed bug report description. The bug is real though.  ### Describe the bug  Built-in tools (`shellTool`, `applyPatchTool`, `computerTool`) do not create tracing spans when executed. Only regular function tools (created with `tool()`) produce `function`-type spans via `withFunctionSpan()`.  In `packages/agents-core/src/runner/toolExecution.ts`:  - `runApprovedFunctionTool()` (line 346) wraps execution in `withFunctionSpan()` — spans appear in traces. - `executeShellActions()` (line 675) only calls `emitToolStart()`/`emitToolEnd()` — **no tracing span is created**. - Same for `executeApplyPatchOperations()` and `executeComputerActions()`.  This means any `TracingExporter` (e.g. a custom OTLP exporter or `ConsoleSpanExporter`) will never receive spans for built-in tool executions, making it impossible to observe tool calls in trace UIs.  ### Debug information  - Agents SDK version: `v0.4.8` (`@openai/agents-core`) - Runtime environment: `Node.js v24.12.0`  ### Repro steps  1. Add a `ConsoleSpanExporter` to `examples/tools/local-shell.ts`: ```typescript import { ConsoleSpanExporter, BatchTraceProcessor, setTraceProcessors } from '@openai/agents';  setTraceProcessors([new BatchTraceProcessor(new ConsoleSpanExporter())]); ```  2. Run the examp
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue. We'll resolve it in the next release.

- **Issue #955** (2026-02-13): **Write cache tokens are not reported in span data from vercel ai SDK**
  *Symptoms*:  Following up this [issue](https://github.com/openai/openai-agents-js/issues/945).  Some providers charge for cache tokens writes(basically only Anthropic - from [AWS Bedrock](https://aws.amazon.com/bedrock/pricing/) and [Anthropic API](https://platform.claude.com/docs/en/about-claude/pricing)). Reporting this cache writes helps for calculating the cost of features.  AI SDK reports this as `cacheWrite` under `inputTokens`(see [LanguageModelV3Usage](https://github.com/vercel/ai/blob/99e3a4631f68207e157e8caf2abfe24038511437/packages/provider/src/language-model/v3/language-model-v3-usage.ts#L6)).  Exposing it in [`extractCachedInputTokens`](https://github.com/openai/openai-agents-js/blob/9b1386ad86066313d20315af7ae8dfa7e3ab5f46/packages/agents-extensions/src/ai-sdk/index.ts#L1573C10-L1573C34) will help report this data point to observability platforms.  ### Debug information  - Agents SDK version: (e.g. `v0.4.7`) - Runtime environment (e.g. `Node.js 22.19.0`) ``` "@ai-sdk/amazon-bedrock": "^4.0.24", "@ai-sdk/anthropic": "^3.0.18", "@ai-sdk/google-vertex": "^4.0.23", ```  ### Expected behavior  report token cache writes for Generation spans

- **Issue #945** (2026-02-09): **Cache tokens are not reported in span data from vercel ai SDK**
  *Symptoms*:   ### Describe the bug  I am currently using Bedrock with Vercel AI as model provider.  I noticed that cache tokens are not extracted and reported in the span data(I am using [braintrust integration](https://github.com/braintrustdata/braintrust-sdk/blob/10e2d2237b0791683386e551bd4be79cf86367db/integrations/openai-agents-js/src/index.ts#L409) as my observability platform) - they expect the `usage.input_tokens_details?.cached_tokens` to be reported in the span data. Seems like [extractTokenCount](https://github.com/openai/openai-agents-js/blob/2e8bbbd767a1afd65a9efb198de41dd579f19ea3/packages/agents-extensions/src/ai-sdk/index.ts#L1567) don't populate `input_tokens_details` and read `cacheRead` property defined in [LanguageModelV3Usage](https://github.com/vercel/ai/blob/99e3a4631f68207e157e8caf2abfe24038511437/packages/provider/src/language-model/v3/language-model-v3-usage.ts#L6) in the vercel AI SDK and omits the cache reads.  What should be the expected result? what is the right shape of the usage object in the span?   ### Debug information  - Runtime environment - `Node.js 22.19.0`  My versions:  ```     "@ai-sdk/amazon-bedrock": "^4.0.24",     "@braintrust/openai-agents": "^0.1.2",     "@openai/agents": "^0.4.1",     "@openai/agents-extensions": "^0.4.1", ```  I created custom trace processor that replicates this:  ``` class CacheUsageTraceProcessor implements TracingProcessor {   async onTraceStart(): Promise<void> {}   async onTraceEnd(): Promise<void> {}   async onSpanSt

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

### Incident Patch 1: `6c00d749` (2026-10-05)
**Commit Message**: fix: bind AI SDK UI demo conversations to browser cookies (#2034)

* fix: bind AI SDK UI demo conversations to browser cookies

* fix: establish demo owner cookie before creating conversations

* fix: isolate demo ownership cookies per conversation

**File**: `examples/ai-sdk-ui/README.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ pnpm -F ai-sdk-ui dev
 
 Open http://localhost:3000 for the UI message stream (tool calls and reasoning parts are rendered). Open http://localhost:3000/text for the text-only stream.
 
+This is a local demo, not a production authentication example. Each conversation is bound to its own HttpOnly browser cookie: opening a conversation link in another browser starts a new conversation, and clearing cookies loses access to existing conversations. Both stream views use the same cookie for a given conversation. Browser cookie limits also limit how many conversations this demo can retain. Before hosting this for other users, add your application's authentication and authorization.
+
 ## Run the Node.js text stream samples
 
 ```bash
```

**File**: `examples/ai-sdk-ui/src/app/api/chat/route.ts` (modified, +10/-5)
```diff
@@ -4,7 +4,7 @@ import type { UIMessage } from 'ai';
 
 import { agent, customerSupportAgent } from './agents';
 import { toAgentInput } from '@/app/lib/messageConverters';
-import { findOrCreateSession, saveSession } from '@/app/lib/session';
+import { findSession, getOwnerId, saveSession } from '@/app/lib/session';
 
 const agentRegistry = new Map<string, Agent<any, any>>([
   [agent.name, agent],
@@ -21,7 +21,15 @@ export async function POST(req: Request) {
       ? body.sessionId
       : typeof body?.id === 'string'
         ? body.id
-        : 'default';
+        : undefined;
+  if (!sessionId) {
+    return new Response('Missing session ID.', { status: 400 });
+  }
+  const entry = findSession(sessionId, await getOwnerId(sessionId));
+  if (!entry) {
+    return new Response('Session not found.', { status: 404 });
+  }
+
   const lastUserMessage = [...messages]
     .reverse()
     .find((message) => message.role === 'user');
@@ -31,9 +39,6 @@ export async function POST(req: Request) {
     return new Response('Missing messages.', { status: 400 });
   }
 
-  const entry = await findOrCreateSession(sessionId, {
-    activeAgentName: agent.name,
-  });
   const activeAgentName = entry.activeAgentName ?? agent.name;
   const activeAgent = agentRegistry.get(activeAgentName) ?? agent;
 
```

**File**: `examples/ai-sdk-ui/src/app/api/chat/text/route.ts` (modified, +10/-3)
```diff
@@ -3,7 +3,7 @@ import { createAiSdkTextStreamResponse } from '@openai/agents-extensions/ai-sdk-
 import type { UIMessage } from 'ai';
 
 import { toAgentInput } from '@/app/lib/messageConverters';
-import { findOrCreateSession } from '@/app/lib/session';
+import { findSession, getOwnerId } from '@/app/lib/session';
 
 const textAgent = new Agent({
   name: 'Sky Guide',
@@ -26,7 +26,15 @@ export async function POST(req: Request) {
       ? body.sessionId
       : typeof body?.id === 'string'
         ? body.id
-        : 'default';
+        : undefined;
+  if (!sessionId) {
+    return new Response('Missing session ID.', { status: 400 });
+  }
+  const entry = findSession(sessionId, await getOwnerId(sessionId));
+  if (!entry) {
+    return new Response('Session not found.', { status: 404 });
+  }
+
   const lastUserMessage = [...messages]
     .reverse()
     .find((message) => message.role === 'user');
@@ -36,7 +44,6 @@ export async function POST(req: Request) {
     return new Response('Missing messages.', { status: 400 });
   }
 
-  const entry = await findOrCreateSession(sessionId);
   const stream = await run(textAgent, input, {
     stream: true,
     conversationId: entry.conversationId,
```

**File**: `examples/ai-sdk-ui/src/app/api/session/route.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import { NextRequest, NextResponse } from 'next/server';
+import { createSession, ownerCookieName } from '@/app/lib/session';
+
+export async function GET(req: NextRequest) {
+  const sessionId = crypto.randomUUID();
+  const ownerId = crypto.randomUUID();
+  await createSession(sessionId, ownerId);
+
+  const path =
+    req.nextUrl.searchParams.get('stream') === 'text' ? '/text' : '/';
+  const response = NextResponse.redirect(
+    new URL(`${path}?session=${sessionId}`, req.url),
+  );
+  response.cookies.set(ownerCookieName(sessionId), ownerId, {
+    httpOnly: true,
+    sameSite: 'lax',
+    secure: req.nextUrl.protocol === 'https:',
+    path: '/',
+  });
+  response.headers.set('Cache-Control', 'no-store');
+  return response;
+}
```

**File**: `examples/ai-sdk-ui/src/app/lib/session.ts` (modified, +20/-18)
```diff
@@ -1,6 +1,18 @@
+import { cookies } from 'next/headers';
 import { OpenAIConversationsSession } from '@openai/agents-openai';
 
+export function ownerCookieName(sessionId: string): string {
+  return `ai-sdk-ui-owner-${sessionId}`;
+}
+
+export async function getOwnerId(
+  sessionId: string,
+): Promise<string | undefined> {
+  return (await cookies()).get(ownerCookieName(sessionId))?.value;
+}
+
 export type SessionEntry = {
+  ownerId: string;
   conversationId: string;
   activeAgentName?: string;
 };
@@ -19,8 +31,12 @@ if (!globalStore.__aiSdkUiSessionStore) {
   globalStore.__aiSdkUiSessionStore = sessionStore;
 }
 
-export function findSession(sessionId: string): SessionEntry | undefined {
-  return sessionStore.get(sessionId);
+export function findSession(
+  sessionId: string,
+  ownerId: string | undefined,
+): SessionEntry | undefined {
+  const entry = sessionStore.get(sessionId);
+  return ownerId && entry?.ownerId === ownerId ? entry : undefined;
 }
 
 export function saveSession(sessionId: string, entry: SessionEntry): void {
@@ -29,28 +45,14 @@ export function saveSession(sessionId: string, entry: SessionEntry): void {
 
 export async function createSession(
   sessionId: string,
-  options: { activeAgentName?: string } = {},
+  ownerId: string,
 ): Promise<SessionEntry> {
   const session = new OpenAIConversationsSession();
   const conversationId = await session.getSessionId();
   const entry: SessionEntry = {
     conversationId,
-    activeAgentName: options.activeAgentName,
+    ownerId,
   };
   sessionStore.set(sessionId, entry);
   return entry;
 }
-
-export async function findOrCreateSession(
-  sessionId: string,
-  options: { activeAgentName?: string } = {},
-): Promise<SessionEntry> {
-  const existing = sessionStore.get(sessionId);
-  if (existing) {
-    if (!existing.activeAgentName && options.activeAgentName) {
-      existing.activeAgentName = options.activeAgentName;
-    }
-    return existing;
-  }
-  return createSession(sessionId, options);
-}
```

**File**: `examples/ai-sdk-ui/src/app/page.tsx` (modified, +5/-12)
```diff
@@ -2,7 +2,7 @@ import { redirect } from 'next/navigation';
 import { OpenAIConversationsSession } from '@openai/agents-openai';
 import ChatView from '@/app/components/ChatView';
 import { toUiMessages } from '@/app/lib/messageConverters';
-import { createSession, findSession } from '@/app/lib/session';
+import { findSession, getOwnerId } from '@/app/lib/session';
 
 export const dynamic = 'force-dynamic';
 
@@ -25,17 +25,10 @@ export default async function Page({ searchParams }: PageProps) {
   const resolvedSearchParams = await Promise.resolve(searchParams);
   const sessionId = readSessionId(resolvedSearchParams);
 
-  if (!sessionId) {
-    const nextSessionId = crypto.randomUUID();
-    await createSession(nextSessionId);
-    redirect(`/?${SESSION_QUERY_KEY}=${nextSessionId}`);
-  }
-
-  const entry = findSession(sessionId);
-  if (!entry) {
-    const fallbackSessionId = crypto.randomUUID();
-    await createSession(fallbackSessionId);
-    redirect(`/?${SESSION_QUERY_KEY}=${fallbackSessionId}`);
+  const ownerId = sessionId ? await getOwnerId(sessionId) : undefined;
+  const entry = sessionId ? findSession(sessionId, ownerId) : undefined;
+  if (!sessionId || !entry) {
+    redirect('/api/session');
   }
 
   const session = new OpenAIConversationsSession({
```

**File**: `examples/ai-sdk-ui/src/app/text/page.tsx` (modified, +5/-12)
```diff
@@ -1,6 +1,6 @@
 import { redirect } from 'next/navigation';
 import { OpenAIConversationsSession } from '@openai/agents-openai';
-import { createSession, findSession } from '@/app/lib/session';
+import { findSession, getOwnerId } from '@/app/lib/session';
 import { toUiMessages } from '@/app/lib/messageConverters';
 import TextStreamChatClient from './TextStreamChatClient';
 
@@ -25,17 +25,10 @@ export default async function TextStreamPage({ searchParams }: PageProps) {
   const resolvedSearchParams = await Promise.resolve(searchParams);
   const sessionId = readSessionId(resolvedSearchParams);
 
-  if (!sessionId) {
-    const nextSessionId = crypto.randomUUID();
-    await createSession(nextSessionId);
-    redirect(`/text?${SESSION_QUERY_KEY}=${nextSessionId}`);
-  }
-
-  const entry = findSession(sessionId);
-  if (!entry) {
-    const fallbackSessionId = crypto.randomUUID();
-    await createSession(fallbackSessionId);
-    redirect(`/text?${SESSION_QUERY_KEY}=${fallbackSessionId}`);
+  const ownerId = sessionId ? await getOwnerId(sessionId) : undefined;
+  const entry = sessionId ? findSession(sessionId, ownerId) : undefined;
+  if (!sessionId || !entry) {
+    redirect('/api/session?stream=text');
   }
 
   const session = new OpenAIConversationsSession({
```

**File**: `examples/ai-sdk-ui/test/sessionOwnership.test.ts` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { NextRequest, NextResponse } from 'next/server';
+
+const provider = vi.hoisted(() => ({
+  cookies: new Map<string, string>(),
+  create: vi.fn(),
+  getItems: vi.fn(),
+  run: vi.fn(),
+}));
+vi.mock('next/headers', () => ({
+  cookies: async () => ({
+    get: (name: string) => {
+      const value = provider.cookies.get(name);
+      return value ? { value } : undefined;
+    },
+  }),
+}));
+vi.mock('next/navigation', () => ({
+  redirect: (url: string) => {
+    throw new Error(`redirect:${url}`);
+  },
+}));
+vi.mock('@openai/agents-openai', () => ({
+  OpenAIConversationsSession: class {
+    constructor(private options?: { conversationId: string }) {}
+    getSessionId() {
+      return provider.create();
+    }
+    getItems() {
+      return provider.getItems(this.options?.conversationId);
+    }
+  },
+}));
+vi.mock('@openai/agents', () => ({
+  Agent: class {},
+  run: provider.run,
+  user: (text: string) => ({ role: 'user', content: text }),
+}));
+vi.mock('@openai/agents-extensions/ai-sdk-ui', () => ({
+  createAiSdkUiMessageStreamResponse: () => new Response('ui stream'),
+  createAiSdkTextStreamResponse: () => new Response('text stream'),
+}));
+vi.mock('../src/app/api/chat/agents', () => ({
+  agent: { name: 'Sky Guide' },
+  customerSupportAgent: { name: 'Support' },
+}));
+vi.mock('../src/app/components/ChatView', () => ({ default: () => null }));
+vi.mock('../src/app/text/TextStreamChatClient', () => ({
+  default: () => null,
+}));
+
+import Page from '../src/app/page';
+import TextPage from '../src/app/text/page';
+import { GET } from '../src/app/api/session/route';
+import { POST as postUi } from '../src/app/api/chat/route';
+import { POST as postText } from '../src/app/api/chat/text/route';
+import { ownerCookieName } from '../src/app/lib/session';
+
+function receiveResponse(response: NextResponse) {
+  for (const cookie of response.cookies.getAll()) {
+    provider.cookies.set(cookie.name, cookie.value);
+  }
+  const url = new URL(response.headers.get('location')!);
+  return { response, url, sessionId: url.searchParams.get('session')! };
+}
+
+async function openConversation(stream = 'ui') {
+  return receiveResponse(
+    await GET(
+      new NextRequest(`https://demo.test/api/session?stream=${stream}`),
+    ),
+  );
+}
+
+function messageRequest(identifier: Record<string, string> = {}) {
+  return new Request('https://demo.test/api/chat', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify({
+      ...identifier,
+      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
+    }),
+  });
+}
+
+beforeEach(() => {
+  vi.clearAllMocks();
+  provider.cookies = new Map();
+  provider.create.mockImplementation(async () => `conv_${crypto.randomUUID()}`);
+  provider.getItems.mockResolvedValue([
+    { role: 'user', content: 'Private astronomy question' },
+  ]);
+  provider.run.mockResolvedValue({
+    completed: Promise.resolve(),
+    currentAgent: { name: 'Support' },
+  });
+});
+
+describe('browser-owned conversations', () => {
+  it('issues an independent private cookie for each conversation', async () => {
+    const first = await openConversation();
+    const cookie = first.response.cookies.get(
+      ownerCookieName(first.sessionId),
+    )!;
+    expect(cookie).toMatchObject({
+      httpOnly: true,
+      sameSite: 'lax',
+      secure: true,
+      path: '/',
+    });
+    expect(first.response.headers.get('cache-control')).toBe('no-store');
+    expect(first.sessionId).not.toBe(cookie.value);
+    expect(first.url.pathname).toBe('/');
+    expect(first.url.href).not.toContain(cookie.value);
+    const second = await openConversation('text');
+    expect(second.sessionId).not.toBe(first.sessionId);
+    expect(second.url.pathname).toBe('/text');
+    expect(provider.cookies.size).toBe(2);
+    expect(provider.cookies.get(cookie.name)).toBe(cookie.value);
+    expect(provider.cookies.get(ownerCookieName(second.sessionId))).not.toBe(
+      cookie.value,
+    );
+    // Both stream views can open the same owned conversation.
+    expect(
+      (await TextPage({ searchParams: { session: first.sessionId } })).props
+        .sessionId,
+    ).toBe(first.sessionId);
+  });
+
+  for (const delayed of ['provider completion', 'cookie delivery']) {
+    it(`preserves both original conversations after late ${delayed}`, async () => {
+      let finishFirst!: (id: string) => void;
+      provider.create.mockImplementationOnce(
+        () =>
+          new Promise<string>((resolve) => {
+            finishFirst = resolve;
+          }),
+      );
+      const pendingFirst = GET(
+        new NextRequest('https://demo.test/api/session'),
+      );
+      await vi.waitFor(() => expect(provider.create).toHaveBeenCalledTimes(1));
+      if (delayed === 'cookie delivery') finishFirst('conv_first_tab');
+      const heldRespo
```

---

### Incident Patch 2: `df205296` (2026-10-05)
**Commit Message**: fix(realtime): preserve playback interruption after audio generation (#2027)

* fix(realtime): preserve playback interruption after audio generation

* fix(realtime): honor playback ownership and response audio formats

* fix(realtime): preserve prior audio on final text guardrails

* fix(realtime): preserve prior playback for non-audio responses

* fix(realtime): recognize legacy audio in final guardrails

* fix(realtime): tolerate malformed final output members

**File**: `.changeset/tidy-audio-playback.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-realtime': patch
+---
+
+fix: Preserve audio interruption after generation with transport-appropriate buffer clearing and response-specific playback duration.
```

**File**: `packages/agents-realtime/src/openaiRealtimeSip.ts` (modified, +12/-3)
```diff
@@ -81,6 +81,17 @@ export class OpenAIRealtimeSIP extends OpenAIRealtimeWebSocket {
     );
   }
 
+  override interrupt(cancelOngoingResponse: boolean = true): void {
+    if (this.status !== 'connected') {
+      return;
+    }
+    if (cancelOngoingResponse) {
+      this._cancelResponse();
+    }
+    // SIP playback and its truncation boundary are owned by the server.
+    this.sendEvent({ type: 'output_audio_buffer.clear' });
+  }
+
   async connect(options: RealtimeTransportLayerConnectOptions): Promise<void> {
     if (!options.callId) {
       throw new UserError(
@@ -95,9 +106,7 @@ export class OpenAIRealtimeSIP extends OpenAIRealtimeWebSocket {
     payload: RealtimeSessionPayload,
   ): void {
     const turnDetection = payload.audio?.input?.turn_detection as
-      | Record<string, unknown>
-      | null
-      | undefined;
+      Record<string, unknown> | null | undefined;
 
     if (!turnDetection || typeof turnDetection !== 'object') {
       return;
```

**File**: `packages/agents-realtime/src/openaiRealtimeWebsocket.ts` (modified, +35/-3)
```diff
@@ -8,7 +8,11 @@ import {
   RealtimeTransportLayer,
 } from './transportLayer';
 
-import { RealtimeClientMessage, RealtimeSessionConfig } from './clientMessages';
+import {
+  RealtimeClientMessage,
+  RealtimeSessionConfig,
+  RealtimeAudioFormat,
+} from './clientMessages';
 import {
   OpenAIRealtimeBase,
   OpenAIRealtimeBaseOptions,
@@ -106,6 +110,8 @@ export class OpenAIRealtimeWebSocket
   #useInsecureApiKey: boolean;
   #currentItemId: string | undefined;
   #currentAudioContentIndex: number | undefined;
+  #audioGenerationDone = false;
+  #responseAudioFormats = new Map<string, RealtimeAudioFormat>();
   /**
    * Timestamp maintained by the transport layer to aid with the calculation of the elapsed time
    * since the response started to compute the right interruption time.
@@ -123,6 +129,7 @@ export class OpenAIRealtimeWebSocket
     (error) => this._onError(error),
   );
   #resetAudioPlaybackState() {
+    this.#audioGenerationDone = false;
     this.#currentItemId = undefined;
     this._firstAudioTimestamp = undefined;
     this._audioLengthMs = 0;
@@ -135,6 +142,7 @@ export class OpenAIRealtimeWebSocket
     }
 
     this.#responseCreateSequencer.releaseWaiters();
+    this.#responseAudioFormats.clear();
     this.#resetAudioPlaybackState();
 
     if (this.#state.status === 'disconnected') {
@@ -278,7 +286,8 @@ export class OpenAIRealtimeWebSocket
   }
 
   protected override _afterAudioDoneEvent() {
-    this.#resetAudioPlaybackState();
+    // Generation can finish while the application still has buffered audio.
+    this.#audioGenerationDone = true;
   }
 
   async #setupWebSocket(
@@ -419,6 +428,12 @@ export class OpenAIRealtimeWebSocket
       }
 
       if (parsed.type === 'response.output_audio.delta') {
+        if (
+          this.#currentItemId !== parsed.item_id ||
+          this.#currentAudioContentIndex !== parsed.content_index
+        ) {
+          this.#resetAudioPlaybackState();
+        }
         this.#currentAudioContentIndex = parsed.content_index;
         this.#currentItemId = parsed.item_id;
         if (this._firstAudioTimestamp === undefined) {
@@ -431,7 +446,9 @@ export class OpenAIRealtimeWebSocket
         const buff = base64ToArrayBuffer(parsed.delta);
         // calculate the audio length in milliseconds
         // GA format: session.audio.output.format supports structured { type: "audio/pcm", rate } or "audio/pcmu" etc.
-        const fmt = this._rawSessionConfig?.audio?.output?.format;
+        const fmt =
+          this.#responseAudioFormats.get(parsed.response_id) ??
+          this._rawSessionConfig?.audio?.output?.format;
         if (fmt && typeof fmt === 'object') {
           // Structured format
           const t = fmt.type as string;
@@ -470,8 +487,18 @@ export class OpenAIRealtimeWebSocket
             ?.interrupt_response ?? false;
         this.interrupt(!automaticResponseCancellationEnabled);
       } else if (parsed.type === 'response.created') {
+        if (parsed.response.id) {
+          this.#responseAudioFormats.set(
+            parsed.response.id,
+            parsed.response.audio?.output?.format ??
+              this._rawSessionConfig?.audio?.output?.format,
+          );
+        }
         this.#responseCreateSequencer.markResponseCreated();
       } else if (parsed.type === 'response.done') {
+        if (parsed.response.id) {
+          this.#responseAudioFormats.delete(parsed.response.id);
+        }
         this.#responseCreateSequencer.markResponseDone();
       } else if (parsed.type === 'session.created') {
         this._tracingConfig = parsed.session.tracing;
@@ -723,6 +750,11 @@ export class OpenAIRealtimeWebSocket
     const audio_end_ms = Math.max(0, Math.floor(Math.min(elapsedTime, length)));
 
     this.emit('audio_interrupted');
+    // Avoid removing the transcript of audio estimated to be fully played.
+    // Still notify the player: only the application knows its actual buffer.
+    if (this.#audioGenerationDone && elapsedTime >= length) {
+      return;
+    }
     this.sendEvent({
       type: 'conversation.item.truncate',
       item_id: this.#currentItemId,
```

**File**: `packages/agents-realtime/src/realtimeSession.ts` (modified, +17/-5)
```diff
@@ -293,7 +293,7 @@ type IssuedRealtimeApproval<TBaseContext> = {
   decisionState: 'pending' | 'sending' | 'decided';
 };
 
-type OutputGuardrailDeltaSource = 'audio' | 'text';
+type OutputGuardrailSource = 'audio' | 'text';
 
 type OutputGuardrailDeltaState = {
   text: string;
@@ -1499,7 +1499,7 @@ export class RealtimeSession<
     responseId: string,
     itemId: string,
     sourceAgent: SessionRealtimeAgent<TBaseContext>,
-    source: OutputGuardrailDeltaSource | 'final',
+    source: OutputGuardrailSource,
     responseGeneration: number,
     connectionGeneration: number,
   ) {
@@ -1566,7 +1566,7 @@ export class RealtimeSession<
     output: string,
     responseId: string,
     itemId: string,
-    source: OutputGuardrailDeltaSource | 'final',
+    source: OutputGuardrailSource,
     sourceAgent: SessionRealtimeAgent<TBaseContext>,
     responseGeneration = this.#responseGeneration,
     connectionGeneration = this.#connectionGeneration,
@@ -1586,7 +1586,7 @@ export class RealtimeSession<
 
   #handleOutputGuardrailDelta(
     event: TransportLayerTranscriptDelta | TransportLayerOutputTextDelta,
-    source: OutputGuardrailDeltaSource,
+    source: OutputGuardrailSource,
   ) {
     const { delta, itemId, responseId } = event;
     if (this.#activeResponseId === undefined) {
@@ -1694,6 +1694,18 @@ export class RealtimeSession<
       const outputItems = event.response.output ?? [];
       let textOutput = '';
       let itemId = '';
+      const source: OutputGuardrailSource = outputItems.some(
+        (item) =>
+          item?.type === 'message' &&
+          Array.isArray(item.content) &&
+          // Realtime transports retain provider-specific content tags.
+          item.content.some(
+            (content: { type?: string } | null) =>
+              content?.type === 'output_audio' || content?.type === 'audio',
+          ),
+      )
+        ? 'audio'
+        : 'text';
 
       for (let idx = outputItems.length - 1; idx >= 0; idx--) {
         const candidate = outputItems[idx];
@@ -1719,7 +1731,7 @@ export class RealtimeSession<
         textOutput,
         responseId,
         itemId,
-        'final',
+        source,
         sourceAgent,
         responseGeneration,
         connectionGeneration,
```

**File**: `packages/agents-realtime/src/utils.ts` (modified, +2/-0)
```diff
@@ -73,6 +73,8 @@ export function getLastTextFromAudioOutputMessage(
   const lastContentItem = item.content[item.content.length - 1];
 
   if (
+    lastContentItem === null ||
+    typeof lastContentItem !== 'object' ||
     !('type' in lastContentItem) ||
     typeof lastContentItem.type !== 'string'
   ) {
```

**File**: `packages/agents-realtime/test/openaiRealtimeWebsocket.test.ts` (modified, +445/-0)
```diff
@@ -691,8 +691,450 @@ describe('OpenAIRealtimeWebSocket', () => {
     ).toBe(true);
   });
 
+  it.each([
+    { debounceTextLength: -1, sip: false, contentType: 'output_audio' },
+    { debounceTextLength: 1, sip: false, contentType: 'output_audio' },
+    { debounceTextLength: -1, sip: true, contentType: 'output_audio' },
+    { debounceTextLength: -1, sip: false, contentType: 'audio' },
+  ])(
+    'stops buffered audio after generation ends (debounce=$debounceTextLength, sip=$sip, content=$contentType)',
+    async ({ debounceTextLength, sip, contentType }) => {
+      const check = createDeferred<{
+        tripwireTriggered: boolean;
+        outputInfo: null;
+      }>();
+      const execute = vi.fn(() => check.promise);
+      const session = new RealtimeSession(new RealtimeAgent({ name: 'test' }), {
+        transport: sip ? new OpenAIRealtimeSIP() : 'websocket',
+        outputGuardrails: [{ name: 'test-policy', execute }],
+        outputGuardrailSettings: { debounceTextLength },
+      });
+      const interrupted = vi.fn();
+      session.on('audio_interrupted', interrupted);
+      const connect = session.connect({
+        apiKey: 'ek_test',
+        ...(sip ? { callId: 'call_test' } : {}),
+      });
+      await vi.runAllTimersAsync();
+      await connect;
+      const emit = (event: Record<string, unknown>) =>
+        lastFakeSocket.emit('message', { data: JSON.stringify(event) });
+      emit({
+        type: 'response.created',
+        event_id: 'created',
+        response: { id: 'r' },
+      });
+      if (!sip) {
+        emit({
+          type: 'response.output_audio.delta',
+          event_id: 'audio',
+          response_id: 'r',
+          item_id: 'i',
+          output_index: 0,
+          content_index: 0,
+          delta: Buffer.alloc(48000).toString('base64'), // One second of PCM16.
+        });
+      }
+      emit({
+        type: 'response.output_audio_transcript.delta',
+        event_id: 'transcript',
+        response_id: 'r',
+        item_id: 'i',
+        output_index: 0,
+        content_index: 0,
+        delta: 'Synthetic blocked output',
+      });
+      await vi.advanceTimersByTimeAsync(100);
+      expect(execute).toHaveBeenCalledTimes(debounceTextLength === -1 ? 0 : 1);
+      emit({
+        type: 'response.output_audio.done',
+        event_id: 'audio-done',
+        response_id: 'r',
+        item_id: 'i',
+        output_index: 0,
+        content_index: 0,
+      });
+      emit({
+        type: 'response.done',
+        event_id: 'done',
+        response: {
+          id: 'r',
+          status: 'completed',
+          output: [
+            {
+              type: 'message',
+              id: 'i',
+              role: 'assistant',
+              status: 'completed',
+              content: [
+                {
+                  type: contentType,
+                  transcript: 'Synthetic blocked output',
+                },
+              ],
+            },
+          ],
+        },
+      });
+      check.resolve({ tripwireTriggered: true, outputInfo: null });
+      await vi.advanceTimersByTimeAsync(0);
+      if (sip) {
+        expect(sentPayloads()).toContainEqual({
+          type: 'output_audio_buffer.clear',
+        });
+        expect(
+          sentPayloads().some(
+            (event: any) => event.type === 'conversation.item.truncate',
+          ),
+        ).toBe(false);
+      } else {
+        expect(interrupted).toHaveBeenCalledTimes(1);
+        expect(sentPayloads()).toContainEqual({
+          type: 'conversation.item.truncate',
+          item_id: 'i',
+          content_index: 0,
+          audio_end_ms: 100,
+        });
+        expect(
+          sentPayloads().some(
+            (event: any) => event.type === 'output_audio_buffer.clear',
+          ),
+        ).toBe(false);
+        session.interrupt();
+        expect(interrupted).toHaveBeenCalledTimes(1);
+      }
+      expect(
+        sentPayloads().filter((event: any) => event.type === 'response.cancel'),
+      ).toEqual([]);
+      session.close();
+    },
+  );
+
+  it.each([
+    { name: 'missing content', output: [{ type: 'message' }] },
+    { name: 'non-array content', output: [{ type: 'message', content: {} }] },
+    { name: 'null output member', output: [null] },
+    {
+      name: 'malformed content members',
+      output: [{ type: 'message', content: [null, 7] }],
+    },
+  ])('handles final output with $name without throwing', async ({ output }) => {
+    const execute = vi.fn(async () => ({
+      tripwireTriggered: true,
+      outputInfo: null,
+    }));
+    const session = new RealtimeSession(new RealtimeAgent({ name: 'test' }), {
+      transport: 'websocket',
+      outputGuardrails: [{ name: 'test-policy', execute }],
+      outputGuardrailSettings: { debounceTextLength: -1 },
+    });
+    const interrupted = vi.fn();
+    const tripped = vi.fn();
+    session.on('audio_interrupted', interrupted);
+    session.on('guardrail_tripped'
```

**File**: `packages/agents-realtime/test/realtimeSession.test.ts` (modified, +2/-2)
```diff
@@ -647,7 +647,7 @@ describe('RealtimeSession', () => {
     expect(newHist).toEqual([]);
   });
 
-  it('triggers guardrail and emits feedback', async () => {
+  it('triggers final text guardrail and emits feedback without interrupting audio', async () => {
     const runMock = vi.fn(async () => ({
       guardrail: { name: 'test', version: '1', policyHint: 'bad' },
       output: { tripwireTriggered: true, outputInfo: { r: 'bad' } },
@@ -677,7 +677,7 @@ describe('RealtimeSession', () => {
       },
     } as any);
     const [, , , details] = await guardrailTripped;
-    expect(transport.interruptCalls).toBe(1);
+    expect(transport.interruptCalls).toBe(0);
     expect(transport.sendMessageCalls.at(-1)?.[0]).toContain('blocked');
     expect(details).toEqual({ itemId: '123' });
     vi.restoreAllMocks();
```

**File**: `packages/agents-realtime/test/realtimeSessionGuardrailSerialization.test.ts` (modified, +11/-12)
```diff
@@ -34,29 +34,28 @@ describe('RealtimeSession guardrail outputInfo serialization', () => {
       guardrail: { name: 'test', version: '1', policyHint: 'bad' },
       output: { tripwireTriggered: true, outputInfo },
     }));
-    vi.spyOn(
-      guardrailModule,
-      'defineRealtimeOutputGuardrail',
-    ).mockReturnValue({ run: runMock } as any);
+    vi.spyOn(guardrailModule, 'defineRealtimeOutputGuardrail').mockReturnValue({
+      run: runMock,
+    } as any);
 
     const transport = new FakeTransport();
     const agent = new RealtimeAgent({ name: 'A', handoffs: [] });
     const session = new RealtimeSession(agent, {
       transport,
-      outputGuardrails: [
-        { name: 'test', execute: async () => ({}) } as any,
-      ],
+      outputGuardrails: [{ name: 'test', execute: async () => ({}) } as any],
       outputGuardrailSettings: { debounceTextLength: -1 },
     });
     await session.connect({ apiKey: 'test' });
 
-    const guardrailTripped = waitForEvent<any[]>(
-      session,
-      'guardrail_tripped',
-    );
+    const guardrailTripped = waitForEvent<any[]>(session, 'guardrail_tripped');
     transport.emit('turn_done', {
       response: {
-        output: [fakeModelMessage('bad output')],
+        output: [
+          {
+            ...fakeModelMessage('bad output'),
+            content: [{ type: 'output_audio', transcript: 'bad output' }],
+          },
+        ],
         usage: new Usage(),
       },
     } as any);
```

---

### Incident Patch 3: `2f3591bb` (2026-10-05)
**Commit Message**: fix: preserve sticky sandbox permissions (#2029)

* fix: preserve sticky sandbox permissions

* fix: validate sticky permission metadata

* fix: restore manifest sticky intent after snapshots

* fix: secure sticky permissions during snapshot recovery

**File**: `.changeset/tidy-sticky-permissions.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@openai/agents-core': patch
+'@openai/agents-extensions': patch
+---
+
+fix: preserve sticky permission bits through manifest normalization and local and remote materialization, and reapply manifest sticky intent to restored Unix-local and Docker snapshot directories
```

**File**: `packages/agents-core/src/sandbox/permissions.ts` (modified, +34/-5)
```diff
@@ -11,11 +11,21 @@ export type PermissionsValue = {
   group?: number;
   other?: number;
   directory?: boolean;
+  /**
+   * Preserve the Unix sticky bit (01000), including on shared directories.
+   * Unix-local and Docker snapshot restore reapply this flag to existing directories,
+   * even if execution removed it; other restored permission bits are unchanged.
+   */
+  sticky?: boolean;
 };
 
+// Omit a disabled sticky bit to preserve the shape of ordinary permission records.
+type NormalizedPermissions = Required<Omit<PermissionsValue, 'sticky'>> &
+  Pick<PermissionsValue, 'sticky'>;
+
 export type PermissionsInit = PermissionsValue | string | number | Permissions;
 
-export const DEFAULT_SANDBOX_ENTRY_PERMISSIONS: Required<PermissionsValue> = {
+export const DEFAULT_SANDBOX_ENTRY_PERMISSIONS: NormalizedPermissions = {
   owner: FileMode.ALL,
   group: FileMode.READ | FileMode.EXEC,
   other: FileMode.READ | FileMode.EXEC,
@@ -33,13 +43,15 @@ export class Permissions {
   readonly group: number;
   readonly other: number;
   readonly directory: boolean;
+  readonly sticky: boolean;
 
   constructor(init: PermissionsInit = {}) {
     if (init instanceof Permissions) {
       this.owner = init.owner;
       this.group = init.group;
       this.other = init.other;
       this.directory = init.directory;
+      this.sticky = init.sticky;
       return;
     }
 
@@ -49,6 +61,7 @@ export class Permissions {
       this.group = parsed.group;
       this.other = parsed.other;
       this.directory = parsed.directory;
+      this.sticky = parsed.sticky;
       return;
     }
 
@@ -58,13 +71,18 @@ export class Permissions {
       this.group = parsed.group;
       this.other = parsed.other;
       this.directory = parsed.directory;
+      this.sticky = parsed.sticky;
       return;
     }
 
     this.owner = normalizePermissionBits(init.owner ?? FileMode.ALL, 'owner');
     this.group = normalizePermissionBits(init.group ?? FileMode.NONE, 'group');
     this.other = normalizePermissionBits(init.other ?? FileMode.NONE, 'other');
     this.directory = init.directory ?? false;
+    if (init.sticky !== undefined && typeof init.sticky !== 'boolean') {
+      throw new TypeError('Permission sticky must be a boolean.');
+    }
+    this.sticky = init.sticky ?? false;
   }
 
   static fromMode(mode: number): Permissions {
@@ -73,6 +91,7 @@ export class Permissions {
       group: (mode >> 3) & 0b111,
       other: mode & 0b111,
       directory: (mode & 0o40000) !== 0,
+      sticky: (mode & 0o1000) !== 0,
     });
   }
 
@@ -88,6 +107,7 @@ export class Permissions {
 
     return new Permissions({
       directory: permissions[0] === 'd',
+      sticky: permissions[9] === 't' || permissions[9] === 'T',
       owner: parsePermissionTriplet(permissions.slice(1, 4), ['s', 'S']),
       group: parsePermissionTriplet(permissions.slice(4, 7), ['s', 'S']),
       other: parsePermissionTriplet(permissions.slice(7, 10), ['t', 'T']),
@@ -97,18 +117,20 @@ export class Permissions {
   toMode(): number {
     return (
       (this.directory ? 0o40000 : 0) |
+      (this.sticky ? 0o1000 : 0) |
       (this.owner << 6) |
       (this.group << 3) |
       this.other
     );
   }
 
-  normalized(): Required<PermissionsValue> {
+  normalized(): NormalizedPermissions {
     return {
       owner: this.owner,
       group: this.group,
       other: this.other,
       directory: this.directory,
+      ...(this.sticky ? { sticky: true } : {}),
     };
   }
 
@@ -117,13 +139,14 @@ export class Permissions {
       this.owner,
     )}${formatPermissionTriplet(this.group)}${formatPermissionTriplet(
       this.other,
+      this.sticky,
     )}`;
   }
 }
 
 export function normalizePermissions(
   permissions: PermissionsInit,
-): Required<PermissionsValue> {
+): NormalizedPermissions {
   return new Permissions(permissions).normalized();
 }
 
@@ -162,10 +185,16 @@ function parsePermissionTriplet(
   return mode;
 }
 
-function formatPermissionTriplet(value: number): string {
+function formatPermissionTriplet(value: number, sticky = false): string {
   return [
     value & FileMode.READ ? 'r' : '-',
     value & FileMode.WRITE ? 'w' : '-',
-    value & FileMode.EXEC ? 'x' : '-',
+    sticky
+      ? value & FileMode.EXEC
+        ? 't'
+        : 'T'
+      : value & FileMode.EXEC
+        ? 'x'
+        : '-',
   ].join('');
 }
```

**File**: `packages/agents-core/src/sandbox/sandboxes/docker.ts` (modified, +14/-1)
```diff
@@ -81,11 +81,13 @@ import {
   UnixLocalSandboxSession,
   type UnixLocalSandboxSessionState,
 } from './unixLocal';
+import { permissionsForSandboxEntry } from '../permissions';
 import {
   assertLocalWorkspaceManifestMetadataSupported,
   joinSandboxLogicalPath,
   materializeLocalWorkspaceManifest,
   materializeLocalWorkspaceManifestMounts,
+  restoreLocalWorkspaceManifestStickyPermissions,
   pathExists,
 } from './shared/localWorkspace';
 import {
@@ -1602,6 +1604,10 @@ export class DockerSandboxClient implements SandboxClient<
           state.workspaceRootPath,
           { archiveLimits },
         );
+        await restoreLocalWorkspaceManifestStickyPermissions(
+          restoredState.manifest,
+          restoredState.workspaceRootPath,
+        );
         await this.cleanupDockerResources(state);
         return await this.restartContainer(
           restoredState,
@@ -1652,6 +1658,10 @@ export class DockerSandboxClient implements SandboxClient<
         workspaceRootPath,
         { archiveLimits },
       );
+      await restoreLocalWorkspaceManifestStickyPermissions(
+        restoredState.manifest,
+        workspaceRootPath,
+      );
       return await this.restartContainer(
         restoredState,
         workspaceRootPath,
@@ -2577,7 +2587,10 @@ async function prepareDockerWorkspaceRoot(
   if (manifest.users.length === 0 && manifest.groups.length === 0) {
     return;
   }
-  await chmod(workspaceRootPath, 0o755);
+  const sticky = permissionsForSandboxEntry(
+    manifest.entries['']?.permissions,
+  ).sticky;
+  await chmod(workspaceRootPath, 0o755 | (sticky ? 0o1000 : 0));
 }
 
 async function provisionDockerAccounts(
```

**File**: `packages/agents-core/src/sandbox/sandboxes/shared/localWorkspace.ts` (modified, +49/-1)
```diff
@@ -263,6 +263,54 @@ export async function materializeLocalWorkspaceManifestMounts(
   }
 }
 
+/** Reapply manifest sticky intent without replacing snapshot contents or modes. */
+export async function restoreLocalWorkspaceManifestStickyPermissions(
+  manifest: Manifest,
+  workspaceRootPath: string,
+): Promise<void> {
+  for (const { logicalPath, entry } of manifest.iterEntries()) {
+    if (
+      isMount(entry) ||
+      !permissionsForSandboxEntry(entry.permissions).sticky
+    ) {
+      continue;
+    }
+    const destination = resolve(workspaceRootPath, logicalPath);
+    const info = await lstat(destination).catch((error: unknown) => {
+      // A snapshot may have replaced a manifest ancestor with a file.
+      if (
+        isSandboxPathNotFoundError(error) ||
+        (error as NodeJS.ErrnoException).code === 'ENOTDIR'
+      ) {
+        return null;
+      }
+      throw error;
+    });
+    if (info?.isDirectory()) {
+      await assertSafeMaterializationPath(
+        workspaceRootPath,
+        destination,
+        logicalPath,
+      );
+      const handle = await open(destination, LOCAL_SOURCE_DIRECTORY_READ_FLAGS);
+      try {
+        const openedInfo = await handle.stat();
+        if (
+          !openedInfo.isDirectory() ||
+          !sameFilesystemEntry(info, openedInfo)
+        ) {
+          throw new UserError(
+            `Sandbox sticky permission target changed during restore: ${logicalPath || '.'}`,
+          );
+        }
+        await handle.chmod((openedInfo.mode & 0o7777) | 0o1000);
+      } finally {
+        await handle.close();
+      }
+    }
+  }
+}
+
 export async function applyOwnershipRecursive(
   targetPath: string,
   uid: number,
@@ -1289,7 +1337,7 @@ async function applyEntryPermissions(
     logicalPath,
   );
   const permissions = permissionsForSandboxEntry(entry.permissions);
-  await chmod(destination, permissions.toMode() & 0o777);
+  await chmod(destination, permissions.toMode() & 0o1777);
 }
 
 function materializationEscapesWorkspaceError(logicalPath: string): UserError {
```

**File**: `packages/agents-core/src/sandbox/sandboxes/unixLocal.ts` (modified, +6/-0)
```diff
@@ -65,6 +65,7 @@ import {
   materializeLocalWorkspaceManifest,
   materializeLocalWorkspaceManifestEntry,
   materializeLocalWorkspaceManifestMounts,
+  restoreLocalWorkspaceManifestStickyPermissions,
   pathExists,
 } from './shared/localWorkspace';
 import {
@@ -1321,6 +1322,11 @@ async function restoreSnapshotAndMounts(
     workspaceRootPath,
     { archiveLimits },
   );
+  // Restore sticky intent before mounts can expose host-owned directories.
+  await restoreLocalWorkspaceManifestStickyPermissions(
+    restoredState.manifest,
+    restoredState.workspaceRootPath,
+  );
   await materializeLocalWorkspaceManifestMounts(
     restoredState.manifest,
     restoredState.workspaceRootPath,
```

**File**: `packages/agents-core/test/sandboxManifest.test.ts` (modified, +65/-0)
```diff
@@ -1140,6 +1140,71 @@ describe('Manifest', () => {
     expect(specialWithoutExec.other & FileMode.EXEC).toBe(FileMode.NONE);
   });
 
+  it.each([
+    ['drwxrwxrwt', 0o41777],
+    ['drwxrwxrwT', 0o41776],
+    ['drwxrwxrwt+', 0o41777],
+  ])(
+    'preserves sticky permissions through manifest cloning: %s',
+    (value, mode) => {
+      const permissions = Permissions.fromString(value);
+      expect(permissions.toMode()).toBe(mode);
+      expect(new Permissions(permissions).toMode()).toBe(mode);
+      expect(Permissions.fromMode(mode).toString()).toBe(value.slice(0, 10));
+
+      const manifest = new Manifest({
+        entries: { shared: { type: 'dir', permissions: value } },
+      });
+      const cloned = cloneManifest(manifest);
+      const restored = new Manifest(JSON.parse(JSON.stringify(cloned)));
+      expect(restored.entries.shared.permissions).toEqual({
+        owner: 7,
+        group: 7,
+        other: mode === 0o41776 ? 6 : 7,
+        directory: true,
+        sticky: true,
+      });
+      expect(
+        new Permissions(restored.entries.shared.permissions).toMode(),
+      ).toBe(mode);
+    },
+  );
+
+  it.each(['false', 1, null])(
+    'rejects raw manifest sticky value %s',
+    (sticky) => {
+      const raw = JSON.parse(
+        JSON.stringify({
+          entries: { shared: { type: 'dir', permissions: { sticky } } },
+        }),
+      );
+      expect(() => new Manifest(raw)).toThrow(
+        'Permission sticky must be a boolean.',
+      );
+    },
+  );
+
+  it.each([true, false, undefined])(
+    'normalizes boolean or absent sticky value %s',
+    (sticky) => {
+      const manifest = new Manifest({
+        entries: {
+          shared: {
+            type: 'dir',
+            permissions: { owner: 7, group: 7, other: 7, sticky },
+          },
+        },
+      });
+      expect(manifest.entries.shared.permissions).toEqual({
+        owner: 7,
+        group: 7,
+        other: 7,
+        directory: false,
+        ...(sticky === true ? { sticky: true } : {}),
+      });
+    },
+  );
+
   it.each([
     '-rwTr--r--',
     '-rwxrwTr--',
```

**File**: `packages/agents-core/test/sandboxes/docker.test.ts` (modified, +97/-1)
```diff
@@ -1,10 +1,19 @@
-import { mkdir, mkdtemp, rm } from 'node:fs/promises';
+import {
+  chmod,
+  mkdir,
+  mkdtemp,
+  readFile,
+  rm,
+  stat,
+  writeFile,
+} from 'node:fs/promises';
 import { spawnSync } from 'node:child_process';
 import { join } from 'node:path';
 import { tmpdir } from 'node:os';
 import { afterEach, describe, expect, it } from 'vitest';
 import {
   DockerSandboxClient,
+  InMemoryRemoteSnapshotStore,
   inContainerMountStrategy,
   Manifest,
   NoopSnapshotSpec,
@@ -212,6 +221,93 @@ describe('DockerSandboxClient', () => {
     DOCKER_TEST_TIMEOUT_MS,
   );
 
+  itIfDocker.each(['local', 'remote'] as const)(
+    'reapplies manifest sticky intent during %s snapshot recovery',
+    async (type) => {
+      rootDir = await mkdtemp(
+        join(tmpdir(), 'agents-core-docker-sticky-test-'),
+      );
+      const client = new DockerSandboxClient({
+        workspaceBaseDir: rootDir,
+        image: DOCKER_TEST_IMAGE,
+        snapshot:
+          type === 'local'
+            ? { type, baseDir: rootDir }
+            : { type, store: new InMemoryRemoteSnapshotStore() },
+      });
+      const session = await client.create(
+        new Manifest({
+          users: [{ name: 'sticky-user' }],
+          entries: {
+            '.': { type: 'dir', permissions: 'drwxrwxrwt' },
+            shared: {
+              type: 'dir',
+              permissions: 'drwxrwxrwt',
+              children: {
+                'value.txt': { type: 'file', content: 'original' },
+              },
+            },
+            deleted: { type: 'dir', permissions: 'drwxrwxrwt' },
+            replaced: {
+              type: 'dir',
+              children: {
+                nested: { type: 'dir', permissions: 'drwxrwxrwt' },
+              },
+            },
+            ordinary: { type: 'dir', permissions: 0o777 },
+          },
+        }),
+      );
+      cleanupContainerIds.add(session.state.containerId);
+      const workspace = session.state.workspaceRootPath;
+      await chmod(join(workspace, 'shared'), 0o777);
+      await writeFile(join(workspace, 'shared/value.txt'), 'snapshot contents');
+      await rm(join(workspace, 'deleted'), { recursive: true });
+      await rm(join(workspace, 'replaced'), { recursive: true });
+      await writeFile(join(workspace, 'replaced'), 'now a file');
+      const serialized = JSON.parse(
+        JSON.stringify(await client.serializeSessionState(session.state)),
+      );
+      removeDockerContainer(session.state.containerId);
+      cleanupContainerIds.delete(session.state.containerId);
+      // Exercise both existing-workspace extraction and new-workspace extraction.
+      for (const recovery of ['drifted', 'missing']) {
+        if (recovery === 'drifted') {
+          await writeFile(join(workspace, 'shared/value.txt'), 'drift');
+        } else {
+          await rm(workspace, { recursive: true, force: true });
+        }
+        const restored = await client.resume(
+          await client.deserializeSessionState(serialized),
+        );
+        cleanupContainerIds.add(restored.state.containerId);
+        const restoredRoot = restored.state.workspaceRootPath;
+        expect((await stat(restoredRoot)).mode & 0o7777).toBe(0o1755);
+        expect((await stat(join(restoredRoot, 'shared'))).mode & 0o7777).toBe(
+          (0o777 & ~process.umask()) | 0o1000,
+        );
+        expect((await stat(join(restoredRoot, 'ordinary'))).mode & 0o7777).toBe(
+          0o777 & ~process.umask(),
+        );
+        expect(
+          await readFile(join(restoredRoot, 'shared/value.txt'), 'utf8'),
+        ).toBe('snapshot contents');
+        await expect(stat(join(restoredRoot, 'deleted'))).rejects.toMatchObject(
+          { code: 'ENOENT' },
+        );
+        expect(await readFile(join(restoredRoot, 'replaced'), 'utf8')).toBe(
+          'now a file',
+        );
+        expect(
+          await restored.execCommand({ cmd: 'stat -c %a shared' }),
+        ).toContain(((0o777 & ~process.umask()) | 0o1000).toString(8));
+        removeDockerContainer(restored.state.containerId);
+        cleanupContainerIds.delete(restored.state.containerId);
+      }
+    },
+    DOCKER_TEST_TIMEOUT_MS,
+  );
+
   itIfDocker(
     'keeps application environment separate from file helpers',
     async () => {
```

**File**: `packages/agents-core/test/sandboxes/localWorkspace.stickyPermissions.test.ts` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+import type { FileHandle } from 'node:fs/promises';
+import {
+  chmod,
+  mkdir,
+  mkdtemp,
+  open,
+  rename,
+  rm,
+  stat,
+  symlink,
+  writeFile,
+} from 'node:fs/promises';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { afterEach, expect, it, vi } from 'vitest';
+import { Manifest } from '../../src/sandbox/manifest';
+import { restoreLocalWorkspaceManifestStickyPermissions } from '../../src/sandbox/sandboxes/shared/localWorkspace';
+
+const race = vi.hoisted(() => ({
+  afterRealpath: undefined as undefined | ((path: unknown) => Promise<void>),
+  afterOpen: undefined as
+    undefined | ((path: unknown, handle: FileHandle) => Promise<void>),
+}));
+vi.mock('node:fs/promises', async (importOriginal) => {
+  const fs = await importOriginal<typeof import('node:fs/promises')>();
+  return {
+    ...fs,
+    realpath: async (...args: Parameters<typeof fs.realpath>) => {
+      const result = await fs.realpath(...args);
+      await race.afterRealpath?.(args[0]);
+      return result;
+    },
+    open: async (...args: Parameters<typeof fs.open>) => {
+      const handle = await fs.open(...args);
+      await race.afterOpen?.(args[0], handle);
+      return handle;
+    },
+  };
+});
+let root: string;
+afterEach(async () => {
+  race.afterRealpath = undefined;
+  race.afterOpen = undefined;
+  if (root) await rm(root, { recursive: true, force: true });
+});
+
+// The helper owns the descriptor boundary; controlled filesystem swaps here avoid
+// timing-dependent processes while exercising real directories and chmod effects.
+it.each(['symlink', 'directory', 'after-open'] as const)(
+  'binds sticky chmod to the validated directory during a %s swap',
+  async (swap) => {
+    root = await mkdtemp(join(tmpdir(), 'sticky-restore-race-'));
+    const workspace = join(root, 'workspace');
+    const target = join(workspace, 'shared');
+    const moved = join(workspace, 'original');
+    const outside = join(root, 'private.txt');
+    await mkdir(target, { recursive: true });
+    await chmod(target, 0o755);
+    await writeFile(outside, 'private');
+    await chmod(outside, 0o600);
+    let opened: Awaited<ReturnType<typeof open>> | undefined;
+    const replace = async (
+      path: unknown,
+      handle?: Awaited<ReturnType<typeof open>>,
+    ) => {
+      if (path !== target) return;
+      race.afterRealpath = undefined;
+      race.afterOpen = undefined;
+      opened = handle;
+      await rename(target, moved);
+      if (swap === 'directory') {
+        await mkdir(target);
+        await chmod(target, 0o755);
+      } else {
+        await symlink(outside, target);
+      }
+    };
+    if (swap === 'after-open') race.afterOpen = replace;
+    else race.afterRealpath = replace;
+    const restored = restoreLocalWorkspaceManifestStickyPermissions(
+      new Manifest({
+        entries: { shared: { type: 'dir', permissions: 'drwxrwxrwt' } },
+      }),
+      workspace,
+    );
+    if (swap === 'after-open') {
+      await restored;
+      expect((await stat(moved)).mode & 0o7777).toBe(0o1755);
+      expect(opened).toBeDefined();
+    } else {
+      const error = await restored.then(
+        () => undefined,
+        (failure: unknown) => failure,
+      );
+      expect((await stat(outside)).mode & 0o7777).toBe(0o600);
+      expect(error).toBeInstanceOf(Error);
+      expect((await stat(moved)).mode & 0o7777).toBe(0o755);
+      if (swap === 'directory')
+        expect((await stat(target)).mode & 0o7777).toBe(0o755);
+    }
+    expect((await stat(outside)).mode & 0o7777).toBe(0o600);
+    if (opened) await expect(opened.stat()).rejects.toThrow();
+  },
+);
```

---

### Incident Patch 4: `836cb509` (2026-10-05)
**Commit Message**: fix(mcp): default automatic tool discovery to 64 pages (#2028)

**File**: `.changeset/default-mcp-page-limit.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': minor
+---
+
+fix: default automatic MCP tool discovery to 64 pages; set maxListPages explicitly for larger listings
```

**File**: `packages/agents-core/src/mcp.ts` (modified, +9/-6)
```diff
@@ -1431,8 +1431,9 @@ export interface BaseMCPServerStdioOptions {
   cacheToolsList?: boolean;
   /**
    * Maximum successful pages per automatic `listTools()` call. Must be a positive
-   * integer; omission leaves pagination unlimited. A terminal page at the limit
-   * succeeds; a fresh continuation at the limit rejects without returning or
+   * integer; defaults to 64. Set a higher limit for larger listings.
+   * A terminal page at the limit succeeds; a fresh continuation at the limit
+   * rejects without returning or
    * caching partial tools. Existing cursor-cycle handling is unchanged: modern
    * clients end listing on a repeated cursor; legacy clients reject it.
    * Request retries do not reset this budget. Does not limit page size or explicit
@@ -1484,8 +1485,9 @@ export interface MCPServerStreamableHttpOptions {
   cacheToolsList?: boolean;
   /**
    * Maximum successful pages per automatic `listTools()` call. Must be a positive
-   * integer; omission leaves pagination unlimited. A terminal page at the limit
-   * succeeds; a fresh continuation at the limit rejects without returning or
+   * integer; defaults to 64. Set a higher limit for larger listings.
+   * A terminal page at the limit succeeds; a fresh continuation at the limit
+   * rejects without returning or
    * caching partial tools. Existing cursor-cycle handling is unchanged: modern
    * clients end listing on a repeated cursor; legacy clients reject it.
    * Request retries do not reset this budget. Does not limit page size or explicit
@@ -1540,8 +1542,9 @@ export interface MCPServerSSEOptions {
   cacheToolsList?: boolean;
   /**
    * Maximum successful pages per automatic `listTools()` call. Must be a positive
-   * integer; omission leaves pagination unlimited. A terminal page at the limit
-   * succeeds; a fresh continuation at the limit rejects without returning or
+   * integer; defaults to 64. Set a higher limit for larger listings.
+   * A terminal page at the limit succeeds; a fresh continuation at the limit
+   * rejects without returning or
    * caching partial tools. Existing cursor-cycle handling is unchanged: modern
    * clients end listing on a repeated cursor; legacy clients reject it.
    * Request retries do not reset this budget. Does not limit page size or explicit
```

**File**: `packages/agents-core/src/shims/mcp-server/node.ts` (modified, +2/-2)
```diff
@@ -92,11 +92,11 @@ function buildCacheableRequestOptions(
   };
 }
 
-function validateMaxListPages(value: number | undefined): number | undefined {
+function validateMaxListPages(value: number | undefined): number {
   if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
     throw new UserError('maxListPages must be a positive integer.');
   }
-  return value;
+  return value ?? 64;
 }
 
 class ToolListPageLimitError extends UserError {
```

**File**: `packages/agents-core/test/shims/mcp-server/mcpV2Compatibility.test.ts` (modified, +2/-1)
```diff
@@ -109,7 +109,7 @@ describe('MCP SDK v2 compatibility', () => {
     }
   });
 
-  it('lists more than 64 tool pages for a pinned session', async () => {
+  it('lists more than 64 tool pages for a pinned session with an explicit limit', async () => {
     const pageCount = 65;
     const requestedCursors: Array<string | undefined> = [];
     const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
@@ -140,6 +140,7 @@ describe('MCP SDK v2 compatibility', () => {
     };
     const server = new NodeMCPServerStreamableHttp({
       name: 'large-pinned-tool-list',
+      maxListPages: 65,
       url: 'https://example.test/mcp',
       sessionId: 'existing-session',
       fetch,
```

**File**: `packages/agents-core/test/shims/mcp-server/node.test.ts` (modified, +1/-1)
```diff
@@ -279,7 +279,7 @@ describe('NodeMCPServerStdio', () => {
     await server.connect();
     expect(lastConnectOptions?.timeout).toBe(5000);
     expect(lastClientOptions?.versionNegotiation).toEqual({ mode: 'auto' });
-    expect(lastClientOptions?.listMaxPages).toBe(0);
+    expect(lastClientOptions?.listMaxPages).toBe(64);
     await server.close();
   });
 
```

**File**: `packages/agents-core/test/shims/mcp-server/pageLimits.test.ts` (modified, +34/-1)
```diff
@@ -278,8 +278,41 @@ describe.each(['modern', 'legacy'] as const)(
       }
     });
 
-    it('leaves omitted limits unlimited beyond the native default of 64 pages', async () => {
+    it('accepts a terminal page at the default limit of 64', async () => {
       const fixture = paginatedServer(era);
+      fixture.terminalAt(64);
+      await fixture.server.connect();
+      try {
+        const tools = await fixture.server.listTools();
+        expect(tools).toHaveLength(64);
+        expect(tools.at(-1)?.name).toBe('tool-64');
+        expect(fixture.cursors).toHaveLength(64);
+      } finally {
+        await fixture.server.close();
+      }
+    });
+
+    it('rejects fresh continuation cursors at the default limit without caching partial tools', async () => {
+      const fixture = paginatedServer(era);
+      fixture.terminalAt(70);
+      await fixture.server.connect();
+      try {
+        await expect(fixture.server.listTools()).rejects.toThrow(
+          'exceeded maxListPages',
+        );
+        expect(fixture.cursors).toHaveLength(64);
+        fixture.terminalAt(1);
+        await expect(fixture.server.listTools()).resolves.toMatchObject([
+          { name: 'tool-1' },
+        ]);
+        expect(fixture.cursors).toHaveLength(65);
+      } finally {
+        await fixture.server.close();
+      }
+    });
+
+    it('allows an explicit limit above the default', async () => {
+      const fixture = paginatedServer(era, 65);
       fixture.terminalAt(65);
       await fixture.server.connect();
       try {
```

**File**: `packages/agents-core/test/shims/mcp-server/streamableHttpRetry.test.ts` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@ describe('NodeMCPServerStreamableHttp closed-session recovery', () => {
     expect(client.connectMock).toHaveBeenCalledOnce();
     expect(client.clientOptions).toEqual({
       versionNegotiation: { mode: 'auto' },
-      listMaxPages: 0,
+      listMaxPages: 64,
     });
     expect((server as any).session).toBe(client);
     expect((server as any).transport).toBe(
```

---

### Incident Patch 5: `b89905c0` (2026-10-05)
**Commit Message**: fix: preserve computer tool initializers across runs (#2031)

* fix: preserve computer tool initializers across runs

* fix: serialize run-scoped computers after concurrent cleanup

**File**: `.changeset/tidy-computer-initializers.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: Preserve computer tool initializers and serialize each run's resolved computer across overlapping runs.
```

**File**: `packages/agents-core/src/runner/modelPreparation.ts` (modified, +16/-1)
```diff
@@ -138,7 +138,22 @@ export async function prepareAgentArtifacts<
     serializedHandoffs: capabilities.handoffs.map((handoff) =>
       serializeHandoff(handoff),
     ),
-    serializedTools: capabilities.tools.map((tool) => serializeTool(tool)),
+    serializedTools: await Promise.all(
+      capabilities.tools.map(async (tool) =>
+        serializeTool(
+          tool.type === 'computer'
+            ? {
+                ...tool,
+                // Another run may replace tool.computer while preparation awaits.
+                computer: await resolveComputer({
+                  tool,
+                  runContext: state._context,
+                }),
+              }
+            : tool,
+        ),
+      ),
+    ),
     toolsExplicitlyProvided: executionAgent.hasExplicitToolConfig(),
   };
 }
```

**File**: `packages/agents-core/src/tool.ts` (modified, +1/-0)
```diff
@@ -790,6 +790,7 @@ function getComputerInitializer<Context>(
     typeof tool.computer === 'function' ||
     isComputerProvider(tool.computer)
   ) {
+    computerInitializerMap.set(tool as AnyComputerTool, tool.computer);
     return tool.computer as ComputerInitializer<Context, any>;
   }
   return undefined;
```

**File**: `packages/agents-core/test/computerToolIsolation.test.ts` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+import { describe, expect, it, vi } from 'vitest';
+import {
+  Agent,
+  Runner,
+  Usage,
+  computerTool,
+  type ComputerTool,
+  type RunContext,
+  type RunItem,
+  type Computer,
+} from '../src';
+import { ScriptedModel, modelResponder, modelResponse } from '../src/testing';
+import { FakeComputer, fakeModelMessage } from './stubs';
+
+function actionResponse(text: string) {
+  return modelResponse({
+    usage: new Usage(),
+    output: [
+      {
+        type: 'computer_call',
+        callId: `call-${text}`,
+        status: 'completed',
+        action: { type: 'type', text },
+      },
+    ],
+  });
+}
+
+function expectScreenshot(result: { newItems: RunItem[] }, data: string) {
+  const item = result.newItems.find(
+    (item) => item.rawItem.type === 'computer_call_result',
+  );
+  expect(item?.rawItem).toMatchObject({
+    output: {
+      type: 'computer_screenshot',
+      data: `data:image/png;base64,${data}`,
+    },
+  });
+}
+
+describe('computer initializer isolation through Runner', () => {
+  it('retains a directly configured function initializer across completed runs', async () => {
+    const computers = [new FakeComputer(), new FakeComputer()];
+    const screenshots = ['Zmlyc3Q=', 'c2Vjb25k'];
+    for (const [index, computer] of computers.entries()) {
+      computer.screenshot = vi.fn(async () => screenshots[index]);
+      computer.type = vi.fn();
+    }
+    const create = vi.fn(
+      ({ runContext }: { runContext: RunContext<string> }) =>
+        computers[runContext.context === 'first' ? 0 : 1],
+    );
+    const tool: ComputerTool<string> = {
+      type: 'computer',
+      name: 'computer_use_preview',
+      computer: create,
+      needsApproval: async () => false,
+    };
+    const agent = new Agent<string>({
+      name: 'Computer',
+      tools: [tool],
+      model: new ScriptedModel([
+        actionResponse('first'),
+        modelResponse({
+          output: [fakeModelMessage('done')],
+          usage: new Usage(),
+        }),
+        actionResponse('second'),
+        modelResponse({
+          output: [fakeModelMessage('done')],
+          usage: new Usage(),
+        }),
+      ]),
+    });
+    const runner = new Runner({ tracingDisabled: true });
+    const first = await runner.run(agent, 'act', { context: 'first' });
+    const second = await runner.run(agent, 'act', { context: 'second' });
+
+    expect(create).toHaveBeenCalledTimes(2);
+    expect(computers[0].type).toHaveBeenCalledExactlyOnceWith(
+      'first',
+      expect.anything(),
+    );
+    expect(computers[1].type).toHaveBeenCalledExactlyOnceWith(
+      'second',
+      expect.anything(),
+    );
+    expectScreenshot(first, screenshots[0]);
+    expectScreenshot(second, screenshots[1]);
+    expect(tool.computer).toBe(create);
+  });
+
+  it.each(['direct', 'copy', 'factory'] as const)(
+    'isolates overlapping runs and cleanup for a %s provider tool',
+    async (construction) => {
+      const computers = {
+        first: new FakeComputer(),
+        second: new FakeComputer(),
+      };
+      computers.first.dimensions = [800, 600];
+      computers.second.dimensions = [1280, 720];
+      const closed = new Set<Computer>();
+      for (const [label, computer] of Object.entries(computers)) {
+        computer.type = vi.fn(async () => {
+          expect(closed.has(computer)).toBe(false);
+        });
+        computer.screenshot = vi.fn(async () => {
+          expect(closed.has(computer)).toBe(false);
+          return label === 'first' ? 'Zmlyc3Q=' : 'c2Vjb25k';
+        });
+      }
+      const provider = {
+        create: vi.fn(({ runContext }: { runContext: RunContext<string> }) =>
+          runContext.context === 'first' ? computers.first : computers.second,
+        ),
+        dispose: vi.fn(async ({ computer }: { computer: Computer }) => {
+          closed.add(computer);
+        }),
+      };
+      const tool: ComputerTool<string> =
+        construction === 'direct'
+          ? {
+              type: 'computer',
+              name: 'computer_use_preview',
+              computer: provider,
+              needsApproval: async () => false,
+            }
+          : construction === 'copy'
+            ? { ...computerTool<string>({ computer: provider }) }
+            : computerTool<string>({ computer: provider });
+      let firstReady!: () => void;
+      let releaseFirst!: () => void;
+      const ready = new Promise<void>((resolve) => {
+        firstReady = resolve;
+      });
+      const released = new Promise<void>((resolve) => {
+        releaseFirst = resolve;
+      });
+      const firstAgent = new Agent<string>({
+        name: 'First',
+        tools: [tool],
+        model: new ScriptedModel([
+          actionResponse('first'),
+          modelResponder(async () => {
+            firstReady();
+            await released;
+            return {
+              output: [
+                {
+                  type: 'computer
```

---

### Incident Patch 6: `8567e09e` (2026-10-05)
**Commit Message**: fix: count resumed model calls toward maxTurns (#2032)

* fix: count resumed model calls toward maxTurns

* fix: rotate turn spans after approval resolution

* fix: preserve session offsets written during approval resume

**File**: `.changeset/tidy-turn-budget.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': minor
+---
+
+fix: count model calls after approval resumes toward maxTurns; callers needing a follow-up model response at the limit must increase maxTurns.
```

**File**: `packages/agents-core/src/run.ts` (modified, +10/-16)
```diff
@@ -1792,14 +1792,11 @@ export class Runner extends RunHooks<any, AgentOutputType<unknown>> {
                 continuingInterruptedTurn = value;
               },
             });
-            if (
-              !shouldContinue ||
-              interruptedOutcome.nextStep.type === 'next_step_handoff'
-            ) {
-              finishRunnerSpan(currentTurnSpan);
-              setRunStateTurnSpanParent(state, undefined);
-              currentTurnSpan = undefined;
-            }
+            // Approval resolution belongs to the previous turn; any next model call
+            // starts a new counted turn with its own span and usage.
+            finishRunnerSpan(currentTurnSpan);
+            setRunStateTurnSpanParent(state, undefined);
+            currentTurnSpan = undefined;
             if (shouldReturn) {
               // we are still in an interruption, so we need to avoid an infinite loop
               return completeResult(new RunResult<TContext, TAgent>(state));
@@ -2828,14 +2825,11 @@ export class Runner extends RunHooks<any, AgentOutputType<unknown>> {
               continuingInterruptedTurn = value;
             },
           });
-          if (
-            !shouldContinue ||
-            interruptedOutcome.nextStep.type === 'next_step_handoff'
-          ) {
-            finishRunnerSpan(currentTurnSpan);
-            setRunStateTurnSpanParent(result.state, undefined);
-            currentTurnSpan = undefined;
-          }
+          // Approval resolution belongs to the previous turn; any next model call
+          // starts a new counted turn with its own span and usage.
+          finishRunnerSpan(currentTurnSpan);
+          setRunStateTurnSpanParent(result.state, undefined);
+          currentTurnSpan = undefined;
           if (shouldReturn) {
             // we are still in an interruption, so we need to avoid an infinite loop
             return;
```

**File**: `packages/agents-core/src/runner/runLoop.ts` (modified, +8/-2)
```diff
@@ -356,6 +356,12 @@ export async function resumeInterruptedTurn<
     onStepItems: unfilteredHandoffInput ? undefined : onStepItems,
   });
 
+  if (turnResult.nextStep.type === 'next_step_run_again') {
+    // Approval resolution completes the previous model turn. Persist that fact
+    // before session writes so a retry also counts the next model request.
+    state._currentTurnInProgress = false;
+  }
+
   if (turnResult.nextStep.type === 'next_step_handoff') {
     // The transfer and tool effects have completed. Persist their continuation before
     // the caller attempts the fallible resumed Session append.
@@ -383,7 +389,7 @@ export async function resumeInterruptedTurn<
   }
 
   // Map next-step outcomes to interruption flow control for the outer run loop.
-  // return_interruption: still waiting on approvals. rerun_turn: same turn rerun without increment.
+  // return_interruption: still waiting on approvals. rerun_turn: prepare the next model turn.
   // advance_step: proceed without rerunning the same turn.
   if (turnResult.nextStep.type === 'next_step_interruption') {
     return {
@@ -421,7 +427,7 @@ export function handleInterruptedOutcome<
       state._currentStep = outcome.nextStep;
       return { shouldReturn: true, shouldContinue: false };
     case 'rerun_turn':
-      // Clear the step so the outer loop treats this as a new run-again without incrementing the turn.
+      // Preserve interruption context for preparation of the next model turn.
       setContinuingInterruptedTurn(true);
       state._currentStep = undefined;
       return { shouldReturn: false, shouldContinue: true };
```

**File**: `packages/agents-core/src/runner/turnPreparation.ts` (modified, +10/-4)
```diff
@@ -344,11 +344,17 @@ function beginTurn<TContext, TAgent extends Agent<TContext, AgentOutputType>>(
   const resumingTurnInProgress =
     options.isResumedState && state._currentTurnInProgress === true;
 
-  // Do not advance the turn when resuming from an interruption; the next model call is
-  // still part of the same logical turn.
-  if (!isResumingFromInterruption && !resumingTurnInProgress) {
+  // Resolving approvals does not consume a turn, but the next model call does.
+  // Only resume an already-counted turn when its model work is still in progress.
+  if (!resumingTurnInProgress) {
     state._currentTurn++;
-    if (!options.isResumedState || !options.preserveTurnPersistenceOnResume) {
+    // Resumed approval work may have persisted items after the run-entry snapshot.
+    // Keep those offsets even when the checkpoint initially had none.
+    if (
+      !options.isResumedState ||
+      (!options.preserveTurnPersistenceOnResume &&
+        state._currentTurnPersistedItemCount === 0)
+    ) {
       state.resetTurnPersistence();
     } else if (
       state._currentTurnPersistedItemCount > state._generatedItems.length
```

**File**: `packages/agents-core/test/approvalTurnBudget.test.ts` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+import { expect, it } from 'vitest';
+import { z } from 'zod';
+import { Agent, MaxTurnsExceededError, Runner, RunState, tool } from '../src';
+import { ScriptedModel, modelResponse, functionCall } from '../src/testing';
+
+for (const stream of [false, true]) {
+  for (const decision of ['approve', 'reject'] as const) {
+    it(`bounds repeated ${decision} resumes (stream=${stream})`, async () => {
+      let executions = 0;
+      const model = new ScriptedModel(
+        Array.from({ length: 4 }, (_, i) =>
+          modelResponse([functionCall('check', {}, { callId: `call_${i}` })]),
+        ),
+      );
+      const agent = new Agent({
+        name: 'Budget',
+        model,
+        tools: [
+          tool({
+            name: 'check',
+            description: 'Approval tool',
+            parameters: z.object({}),
+            needsApproval: true,
+            execute: () => {
+              executions++;
+              return 'ok';
+            },
+          }),
+        ],
+      });
+      const runner = new Runner({ tracingDisabled: true });
+      const execute = async (
+        input: string | RunState<any, any>,
+        maxTurns?: number,
+      ) => {
+        const result = stream
+          ? await runner.run(agent, input, { stream: true, maxTurns })
+          : await runner.run(agent, input, { maxTurns });
+        if ('completed' in result) {
+          for await (const _event of result.toStream()) {
+            /* drain */
+          }
+          await result.completed;
+        }
+        return result;
+      };
+      let input: string | RunState<any, any> = 'Check';
+      for (let i = 0; i < 3; i++) {
+        const result = await execute(input, i === 0 ? 3 : undefined);
+        expect(result.interruptions).toHaveLength(1);
+        expect(model.calls).toHaveLength(i + 1);
+        // Alternate direct and serialized resumes, preserving the initial budget.
+        input =
+          i === 1
+            ? result.state
+            : await RunState.fromString(agent, result.state.toString());
+        input[decision](input.getInterruptions()[0]);
+      }
+      const error = await execute(input).catch((error: unknown) => error);
+      expect(error).toBeInstanceOf(MaxTurnsExceededError);
+      expect(model.calls).toHaveLength(3);
+      expect(executions).toBe(decision === 'approve' ? 3 : 0);
+      // Retrying the error checkpoint must not restore the spent exemption or rerun tools.
+      const checkpoint = (error as MaxTurnsExceededError).state!;
+      const restored = await RunState.fromString(agent, checkpoint.toString());
+      await expect(execute(restored)).rejects.toBeInstanceOf(
+        MaxTurnsExceededError,
+      );
+      expect(model.calls).toHaveLength(3);
+      expect(executions).toBe(decision === 'approve' ? 3 : 0);
+      // A caller can explicitly extend the existing budget.
+      const extended = await execute(restored, 4);
+      expect(extended.interruptions).toHaveLength(1);
+      expect(model.calls).toHaveLength(4);
+    });
+  }
+
+  it(`resolves pending tool approvals at the limit without another model call (stream=${stream})`, async () => {
+    const model = new ScriptedModel([
+      modelResponse([functionCall('check', {}, { callId: 'call_1' })]),
+    ]);
+    let executions = 0;
+    const agent = new Agent({
+      name: 'StopAfterTool',
+      model,
+      toolUseBehavior: 'stop_on_first_tool',
+      tools: [
+        tool({
+          name: 'check',
+          description: 'Approval tool',
+          parameters: z.object({}),
+          needsApproval: true,
+          execute: () => {
+            executions++;
+            return 'done';
+          },
+        }),
+      ],
+    });
+    const runner = new Runner({ tracingDisabled: true });
+    const execute = async (input: string | RunState<any, any>) => {
+      const result = stream
+        ? await runner.run(agent, input, { stream: true, maxTurns: 1 })
+        : await runner.run(agent, input, { maxTurns: 1 });
+      if ('completed' in result) {
+        for await (const _event of result.toStream()) {
+          /* drain */
+        }
+        await result.completed;
+      }
+      return result;
+    };
+    const first = await execute('Check');
+    const state = await RunState.fromString(agent, first.state.toString());
+    const undecided = await execute(state);
+    expect(undecided.interruptions).toHaveLength(1);
+    expect(model.calls).toHaveLength(1);
+    undecided.state.approve(undecided.interruptions[0]);
+    const result = await execute(undecided.state);
+    expect(result.finalOutput).toBe('done');
+    expect(model.calls).toHaveLength(1);
+    expect(executions).toBe(1);
+  });
+}
```

**File**: `packages/agents-core/test/run.approvalGuardrailSession.test.ts` (modified, +1/-1)
```diff
@@ -3078,7 +3078,7 @@ describe('approved tool output guardrail session persistence', () => {
       ) => {
         const options = {
           session,
-          maxTurns: 1,
+          maxTurns: 2,
           callModelInputFilter: ({ modelData }: CallModelInputFilterArgs) => ({
             ...modelData,
             input: modelData.input.filter(
```

**File**: `packages/agents-core/test/run.sessionWriteRecovery.test.ts` (modified, +67/-0)
```diff
@@ -3,6 +3,7 @@ import { z } from 'zod';
 
 import {
   Agent,
+  MaxTurnsExceededError,
   RunState,
   ToolGuardrailFunctionOutputFactory,
   Usage,
@@ -3491,6 +3492,72 @@ describe('resumed Session write recovery', () => {
     );
   });
 
+  it.each([
+    { mode: 'non_streamed' as const, maxTurns: 2 },
+    { mode: 'streamed' as const, maxTurns: 2 },
+    { mode: 'non_streamed' as const, maxTurns: 1 },
+    { mode: 'streamed' as const, maxTurns: 1 },
+  ])(
+    'preserves approval writes after a transient Session-ID failure ($mode, maxTurns=$maxTurns)',
+    async ({ mode, maxTurns }) => {
+      const { agent, execute, model } = createApprovalRun();
+      const session = new UncertainAppendSession();
+      const first =
+        mode === 'streamed'
+          ? await run<typeof agent, unknown>(agent, 'Use approval_tool', {
+              stream: true,
+              maxTurns,
+            })
+          : await run<typeof agent, unknown>(agent, 'Use approval_tool', {
+              maxTurns,
+            });
+      if ('completed' in first) await first.completed;
+      first.state.approve(first.interruptions[0]!);
+      session.failNextSessionIdRead();
+      await expect(runOnce(mode, agent, first.state, session)).rejects.toThrow(
+        'session ID read rejected',
+      );
+      expect(execute).not.toHaveBeenCalled();
+      expect(await session.getItems()).toEqual([]);
+
+      let retryState = first.state;
+      if (maxTurns === 1) {
+        const error = await runOnce(mode, agent, retryState, session).catch(
+          (error: unknown) => error,
+        );
+        expect(error).toBeInstanceOf(MaxTurnsExceededError);
+        expect(model.calls).toHaveLength(1);
+        expect(execute).toHaveBeenCalledTimes(1);
+        retryState = await RunState.fromString(
+          agent,
+          (error as MaxTurnsExceededError).state!.toString(),
+        );
+      }
+      const completed =
+        mode === 'streamed'
+          ? await run<typeof agent, unknown>(agent, retryState, {
+              session,
+              stream: true,
+              maxTurns: 2,
+            })
+          : await run<typeof agent, unknown>(agent, retryState, {
+              session,
+              maxTurns: 2,
+            });
+      if ('completed' in completed) await completed.completed;
+      expect(completed.finalOutput).toBe('done');
+      expect(model.calls).toHaveLength(2);
+      expect(execute).toHaveBeenCalledTimes(1);
+      const items = await session.getItems();
+      expect(
+        items.filter((item) => item.type === 'function_call'),
+      ).toHaveLength(1);
+      expect(
+        items.filter((item) => item.type === 'function_call_result'),
+      ).toHaveLength(1);
+    },
+  );
+
   it('rejects concurrent recovery on the same live RunState', async () => {
     const { agent, execute, model } = createApprovalRun();
     const session = new UncertainAppendSession();
```

**File**: `packages/agents-core/test/run.stream.test.ts` (modified, +4/-4)
```diff
@@ -2657,7 +2657,7 @@ describe('Runner.run (streaming)', () => {
     }
   });
 
-  it('does not advance the turn for streaming runs resuming an interruption without persisted items', async () => {
+  it('counts the streamed model call after resolving an interruption', async () => {
     const approvalTool = tool({
       name: 'get_weather',
       description: 'Gets weather for a city.',
@@ -2696,7 +2696,7 @@ describe('Runner.run (streaming)', () => {
     });
 
     let result = await run(agent, 'Stream weather?', {
-      maxTurns: 1,
+      maxTurns: 2,
       stream: true,
     });
 
@@ -2711,15 +2711,15 @@ describe('Runner.run (streaming)', () => {
 
     result.state.approve(result.interruptions[0]);
 
-    result = await run(agent, result.state, { maxTurns: 1, stream: true });
+    result = await run(agent, result.state, { maxTurns: 2, stream: true });
 
     for await (const _event of result.toStream()) {
       // Consume stream.
     }
     await result.completed;
 
     expect(result.finalOutput).toBe('Stream done.');
-    expect(result.state._currentTurn).toBe(1);
+    expect(result.state._currentTurn).toBe(2);
   });
 
   it('emits run item events in the order items are generated', async () => {
```

---

### Incident Patch 7: `edfa4101` (2026-10-05)
**Commit Message**: fix: preserve current Vercel credentials on session restore (#2030)

* fix: preserve current Vercel credentials on session restore

* fix: isolate Vercel restore authentication from persisted state

* fix: honor per-resume Vercel archive limits

* fix: preserve live Vercel authentication during serialization

**File**: `.changeset/tidy-vercel-resume-auth.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-extensions': minor
+---
+
+fix: Use current Vercel authentication configuration for restored sessions and disable legacy authentication fallback when current authentication is configured; retain per-create authentication choices for live sessions. Keep restoration credentials runtime-only and honor per-run resume overrides.
```

**File**: `packages/agents-extensions/src/sandbox/vercel/sandbox.ts` (modified, +115/-17)
```diff
@@ -13,6 +13,7 @@ import {
   type SandboxClient,
   type SandboxClientCreateArgs,
   type SandboxClientOptions,
+  type SandboxClientResumeOptions,
   type SandboxArchiveLimits,
   type SandboxConcurrencyLimits,
   type MaterializeEntryArgs,
@@ -238,23 +239,24 @@ export type VercelWorkspacePersistence = 'tar' | 'snapshot';
 
 export interface VercelSandboxClientOptions extends SandboxClientOptions {
   /**
-   * Vercel project ID. Per-create options override constructor options, which
+   * Vercel project ID. Per-create or per-resume options override constructor options, which
    * override `VERCEL_PROJECT_ID`. Credentials are forwarded only when the
    * resolved `projectId`, `teamId`, and `token` are all non-empty.
    */
   projectId?: string;
   /**
-   * Vercel team ID. Per-create options override constructor options, which
+   * Vercel team ID. Per-create or per-resume options override constructor options, which
    * override `VERCEL_TEAM_ID`. Credentials are forwarded only when the
    * resolved `projectId`, `teamId`, and `token` are all non-empty.
    */
   teamId?: string;
   /**
-   * Vercel access token. Per-create options override constructor options,
+   * Vercel access token. Per-create or per-resume options override constructor options,
    * which override `VERCEL_TOKEN`. Credentials are forwarded only when the
    * resolved `projectId`, `teamId`, and `token` are all non-empty; otherwise
-   * authentication is delegated to `@vercel/sandbox`. Resolved tokens are
-   * included in serialized session state.
+   * authentication is delegated to `@vercel/sandbox`. Create-time tokens are
+   * included in serialized session state; current restoration credentials
+   * remain runtime-only.
    */
   token?: string;
   runtime?: string;
@@ -609,7 +611,13 @@ export class VercelSandboxSession extends RemoteSandboxSessionBase<VercelSandbox
       }
       throw error;
     });
-    await this.closePromise;
+    try {
+      await this.closePromise;
+    } finally {
+      if (this.closeCompleted) {
+        vercelSessionAuthentication.delete(this.state);
+      }
+    }
   }
 
   private async closeOnce(): Promise<void> {
@@ -1539,6 +1547,11 @@ export class VercelSandboxSession extends RemoteSandboxSessionBase<VercelSandbox
   }
 }
 
+const vercelSessionAuthentication = new WeakMap<
+  VercelSandboxSessionState,
+  { owner?: VercelSandboxClient; credentials?: NormalizedVercelCredentials }
+>();
+
 /**
  * @see {@link https://vercel.com/docs/vercel-sandbox | Vercel Sandbox overview}.
  * @see {@link https://vercel.com/docs/vercel-sandbox/sdk-reference | Sandbox SDK reference}.
@@ -1695,6 +1708,7 @@ export class VercelSandboxClient implements SandboxClient<
           }
           throw error;
         }
+        vercelSessionAuthentication.set(session.state, { owner: this });
         return session;
       },
     );
@@ -1704,7 +1718,8 @@ export class VercelSandboxClient implements SandboxClient<
     state: VercelSandboxSessionState,
     options?: SandboxSessionSerializationOptions,
   ): Promise<Record<string, unknown>> {
-    const stateGeneration = captureSandboxStateGeneration(state);
+    const sourceState = state;
+    const stateGeneration = captureSandboxStateGeneration(sourceState);
     const liveManifest = state.manifest;
     const sanitizedMountEnvironment =
       sanitizeMountCredentialEnvironmentForPersistence(state);
@@ -1713,8 +1728,18 @@ export class VercelSandboxClient implements SandboxClient<
     );
     recordLiveMountCredentialAuthority(sanitizedManifest, liveManifest);
     state.manifest = sanitizedManifest;
-    const credentials = selectVercelSessionCredentials(state, this.options);
-    applyVercelCredentials(state, credentials);
+    // Serialization does not resume a live session, even through another client.
+    // Resolve restored-state authentication on a separate state object.
+    const liveAuthentication = vercelSessionAuthentication.get(state);
+    if (!liveAuthentication?.owner) {
+      state = { ...state };
+    }
+    const credentials = liveAuthentication?.owner
+      ? selectVercelSessionCredentials(state, this.options)
+      : this.resolveSessionCredentials(state);
+    if (!vercelSessionAuthentication.get(state)?.credentials) {
+      applyVercelCredentials(state, credentials);
+    }
     if (
       !hasVercelMounts(state.manifest) &&
       state.workspacePersistence === 'snapshot' &&
@@ -1733,9 +1758,9 @@ export class VercelSandboxClient implements SandboxClient<
         ...state,
         environment: sanitizedMountEnvironment.environment,
       },
-      state,
+      sourceState,
     );
-    assertSandboxStateGenerationUnchanged(state, stateGeneration);
+    assertSandboxStateGenerationUnchanged(sourceState, stateGeneration);
     return serialized;
   }
 
@@ -1847,10 +1872,11 @@ export class VercelSandboxClient implements SandboxClient<
   }
 
   async resume(
-    state: VercelSandboxSessionState,
+    inputState: VercelSandboxSess
```

**File**: `packages/agents-extensions/test/sandbox/vercel.test.ts` (modified, +426/-18)
```diff
@@ -286,6 +286,42 @@ describe('VercelSandboxClient', () => {
     },
   );
 
+  test.each(['override', 'fallback', 'disabled'] as const)(
+    'honors resumed archive limits: %s',
+    async (mode) => {
+      const client = new VercelSandboxClient({
+        archiveLimits: { maxExtractedBytes: mode === 'override' ? 100 : 1 },
+      });
+      const state = await client.deserializeSessionState({
+        manifest: new Manifest(),
+        sandboxId: 'vercel_original',
+        environment: {},
+        workspacePersistence: 'tar',
+      });
+      const session = await client.resume(state, {
+        archiveLimits:
+          mode === 'override'
+            ? { maxExtractedBytes: 1 }
+            : mode === 'disabled'
+              ? null
+              : undefined,
+      });
+      const archive = makeTarArchive([{ name: 'README.md', content: 'large' }]);
+      writeFilesMock.mockClear();
+      runCommandMock.mockClear();
+      if (mode === 'disabled') {
+        await session.hydrateWorkspace(archive);
+        expect(writeFilesMock).toHaveBeenCalled();
+      } else {
+        await expect(session.hydrateWorkspace(archive)).rejects.toThrow(
+          'archive extracted size exceeds limit',
+        );
+        expect(writeFilesMock).not.toHaveBeenCalled();
+        expect(runCommandMock).not.toHaveBeenCalled();
+      }
+    },
+  );
+
   test.each(['constructor', 'create options', 'top-level'] as const)(
     'rejects invalid archive limits from %s before provisioning',
     async (source) => {
@@ -2311,7 +2347,387 @@ describe('VercelSandboxClient', () => {
     );
   });
 
-  test('retains serialized access token credentials when resuming live sandboxes', async () => {
+  test.each(['live', 'snapshot', 'snapshot lookup'] as const)(
+    'uses current explicit credentials for restored %s state',
+    async (operation) => {
+      const client = new VercelSandboxClient({
+        projectId: 'prj_current',
+        teamId: 'team_current',
+        token: 'current_token',
+      });
+      const state = await client.deserializeSessionState({
+        manifest: new Manifest(),
+        sandboxId: 'vercel_original',
+        environment: {},
+        authenticationMode: 'sdk',
+        workspacePersistence: operation === 'live' ? 'tar' : 'snapshot',
+        ...(operation === 'snapshot'
+          ? {
+              snapshotId: 'snap_original',
+              snapshotSandboxId: 'vercel_original',
+            }
+          : {}),
+      });
+      if (operation === 'snapshot lookup') {
+        await client.serializeSessionState(state, {
+          willCloseAfterSerialize: true,
+        });
+      } else {
+        const session = await client.resume(state);
+        // Subsequent snapshot replacement must retain the selected identity.
+        if (operation === 'snapshot') {
+          await session.hydrateWorkspace(
+            encodeNativeSnapshotRef({
+              provider: 'vercel',
+              snapshotId: 'snap_restore',
+            }),
+          );
+        }
+        const serialized = await client.serializeSessionState(session.state);
+        expect(serialized.authenticationMode).toBe('sdk');
+        expect(serialized).not.toHaveProperty('token');
+      }
+      const calls =
+        operation === 'snapshot' ? createMock.mock.calls : getMock.mock.calls;
+      expect(calls.length).toBeGreaterThan(0);
+      for (const [params] of calls) {
+        expect(params).toMatchObject({
+          projectId: 'prj_current',
+          teamId: 'team_current',
+          token: 'current_token',
+        });
+      }
+      expect(state.authenticationMode).toBe('sdk');
+      expect(state).not.toHaveProperty('token');
+    },
+  );
+
+  test.each(['sdk', 'explicit', undefined] as const)(
+    'does not downgrade restored %s authentication after a 401',
+    async (authenticationMode) => {
+      const client = new VercelSandboxClient({
+        projectId: 'prj_current',
+        teamId: 'team_current',
+        token: 'current_token',
+      });
+      // Direct resume is also a public restored-state boundary.
+      const state = {
+        manifest: new Manifest(),
+        sandboxId: 'vercel_original',
+        environment: {},
+        authenticationMode,
+        workspacePersistence: 'tar' as const,
+        projectId: 'prj_old',
+        teamId: 'team_old',
+        token: 'old_token',
+      };
+      getMock.mockRejectedValueOnce(vercelHttpError(401));
+      await expect(client.resume(state)).rejects.toThrow();
+      expect(getMock).toHaveBeenCalledExactlyOnceWith({
+        sandboxId: 'vercel_original',
+        projectId: 'prj_current',
+        teamId: 'team_current',
+        token: 'current_token',
+      });
+    },
+  );
+
+  test('keeps current credentials out of restored serialization before and after resume', async () => {
+    const client = new VercelSandboxClient({
+      projectId: 'prj_current',
+      teamId: 'team_current',
+      token: 'current_token',
+    });

```

---

### Incident Patch 8: `9e32e889` (2026-10-05)
**Commit Message**: fix: bound MCP streamable HTTP session termination (#2026)

**File**: `.changeset/tidy-mcp-cleanup.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: Bound streamable HTTP session termination by the client session timeout and cancel stalled cleanup requests.
```

**File**: `packages/agents-core/src/shims/mcp-server/node.ts` (modified, +9/-1)
```diff
@@ -1120,7 +1120,15 @@ export class NodeMCPServerStreamableHttp extends BaseMCPServerStreamableHttp {
 
       try {
         if (typeof detachedTransport.terminateSession === 'function') {
-          await detachedTransport.terminateSession();
+          // start() installs the abort controller used by terminateSession().
+          // Closing this detached transport then cancels a stalled DELETE too.
+          await detachedTransport.start();
+          await withTimeout(
+            detachedTransport.terminateSession(),
+            this.getClientSessionTimeoutMs(),
+            () =>
+              new Error('Timed out terminating streamable HTTP MCP session.'),
+          );
         }
       } finally {
         await detachedTransport.close().catch(() => {});
```

**File**: `packages/agents-core/test/mcpStreamableHttpClose.test.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+import { describe, expect, it, vi } from 'vitest';
+import { MCPServerStreamableHttp } from '../src';
+
+describe('MCP streamable HTTP session cleanup', () => {
+  it.each(['headers', 'body'] as const)(
+    'bounds close and aborts a DELETE stalled at response %s',
+    async (stallAt) => {
+      let deleteSignal: AbortSignal | null | undefined;
+      let releaseDelete = () => {};
+      let notifyDeleteStarted = () => {};
+      const deleteStarted = new Promise<void>((resolve) => {
+        notifyDeleteStarted = resolve;
+      });
+      const logger = {
+        namespace: 'mcp-close-test',
+        debug: vi.fn(),
+        warn: vi.fn(),
+        error: vi.fn(),
+        dontLogModelData: true,
+        dontLogToolData: true,
+      };
+      const server = new MCPServerStreamableHttp({
+        url: 'https://example.test/mcp',
+        clientSessionTimeoutSeconds: 0.05,
+        logger,
+        fetch: async (_url: string | URL | Request, init?: RequestInit) => {
+          if (init?.method === 'DELETE') {
+            deleteSignal = init.signal;
+            notifyDeleteStarted();
+            if (stallAt === 'headers') {
+              return new Promise<Response>((resolve, reject) => {
+                releaseDelete = () => resolve(new Response(null));
+                deleteSignal?.addEventListener(
+                  'abort',
+                  () => {
+                    reject(deleteSignal?.reason);
+                  },
+                  { once: true },
+                );
+              });
+            }
+            return new Response(
+              new ReadableStream({
+                start(controller) {
+                  releaseDelete = () => controller.close();
+                  deleteSignal?.addEventListener(
+                    'abort',
+                    () => {
+                      releaseDelete = () => {};
+                      controller.error(deleteSignal?.reason);
+                    },
+                    { once: true },
+                  );
+                },
+              }),
+            );
+          }
+          if (init?.method === 'GET') {
+            return new Response(null, { status: 405 });
+          }
+          const message = JSON.parse(String(init?.body));
+          if (message.id === undefined) {
+            return new Response(null, { status: 202 });
+          }
+          return Response.json(
+            {
+              jsonrpc: '2.0',
+              id: message.id,
+              result:
+                message.method === 'initialize'
+                  ? {
+                      protocolVersion: '2025-06-18',
+                      capabilities: { tools: {} },
+                      serverInfo: { name: 'cleanup-test', version: '1.0.0' },
+                    }
+                  : { tools: [] },
+            },
+            { headers: { 'mcp-session-id': 'cleanup-session' } },
+          );
+        },
+      });
+      await server.connect();
+      expect(server.sessionId).toBe('cleanup-session');
+      vi.useFakeTimers();
+      let closed = false;
+      const closing = server.close().then(() => {
+        closed = true;
+      });
+      try {
+        await deleteStarted;
+        await vi.advanceTimersByTimeAsync(49);
+        expect(closed).toBe(false);
+        await vi.advanceTimersByTimeAsync(1);
+        expect(closed).toBe(true);
+        expect(deleteSignal?.aborted).toBe(true);
+        expect(server.sessionId).toBeUndefined();
+        expect(logger.warn).toHaveBeenCalledTimes(1);
+        // A completed close must also release the public wrapper's lifecycle guard.
+        await server.connect();
+        await expect(server.listTools()).resolves.toEqual([]);
+      } finally {
+        releaseDelete();
+        await closing;
+        const cleanup = server.close();
+        await vi.advanceTimersByTimeAsync(50);
+        await cleanup;
+        vi.useRealTimers();
+      }
+    },
+  );
+
+  it.each([200, 405])(
+    'preserves completed termination with HTTP %s',
+    async (status) => {
+      const requests: string[] = [];
+      let deleteSignal: AbortSignal | null | undefined;
+      const server = new MCPServerStreamableHttp({
+        url: 'https://example.test/mcp',
+        sessionId: 'existing-session',
+        fetch: async (_url: string | URL | Request, init?: RequestInit) => {
+          requests.push(init?.method ?? 'GET');
+          deleteSignal = init?.signal;
+          return new Response(null, { status });
+        },
+      });
+      await server.connect();
+      await server.close();
+      expect(requests).toEqual(['DELETE']);
+      expect(deleteSignal?.aborted).toBe(true);
+      expect(server.sessionId).toBeUndefined();
+    },
+  );
+});
```

---

### Incident Patch 9: `96aa754b` (2026-10-02)
**Commit Message**: fix: redact computer safety-check callback trace errors (#2018)

* fix: redact computer safety-check callback trace errors

* fix: redact enclosing run-span error names

**File**: `.changeset/tidy-computer-traces.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: respect sensitive tracing settings for computer safety-check callback errors and enclosing run-span error names.
```

**File**: `packages/agents-core/src/runner/toolExecution.ts` (modified, +9/-0)
```diff
@@ -2577,6 +2577,15 @@ export async function executeComputerActions(
           if (isSiblingCancellationSignal(signal)) {
             return buildStartedCancellationItem();
           }
+          if (!runner.config.traceIncludeSensitiveData) {
+            span?.setError({
+              message: 'Error running tool',
+              data: {
+                tool_name: COMPUTER_TRACE_NAME,
+                error: REDACTED_TOOL_ERROR_MESSAGE,
+              },
+            });
+          }
           throw error;
         }
         if (signal?.aborted) {
```

**File**: `packages/agents-core/src/runner/tracing.ts` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ export function getRunnerSpanErrorDetails(
   if (traceIncludeSensitiveData) {
     return String(error);
   }
-  return error instanceof Error ? error.name : 'Error';
+  return 'Error';
 }
 
 /**
```

**File**: `packages/agents-core/test/runner/toolExecution.test.ts` (modified, +96/-0)
```diff
@@ -76,7 +76,10 @@ import {
   ScriptedModelProvider,
   FakeShell,
   FakeEditor,
+  FakeComputer,
 } from '../stubs';
+import { ScriptedModel, modelResponse } from '../../src/testing';
+import { Usage } from '../../src/usage';
 import * as protocol from '../../src/types/protocol';
 import { AgentToolUseTracker } from '../../src/runner/toolUseTracker';
 import { runWithSiblingCancellation } from '../../src/runner/siblingCancellation';
@@ -1586,6 +1589,99 @@ describe('executeComputerActions', () => {
     });
   });
 
+  it.each([
+    { stream: false, traceIncludeSensitiveData: false },
+    { stream: true, traceIncludeSensitiveData: false },
+    { stream: false, traceIncludeSensitiveData: true },
+    { stream: true, traceIncludeSensitiveData: true },
+  ])(
+    'respects sensitive tracing for safety-check errors (stream=$stream, sensitive=$traceIncludeSensitiveData)',
+    async ({ stream, traceIncludeSensitiveData }) => {
+      const callbackError = Object.assign(
+        new Error('synthetic safety secret'),
+        {
+          name: 'synthetic safety error name',
+          data: { detail: 'synthetic safety payload' },
+        },
+      );
+      const computer = new FakeComputer();
+      const screenshot = vi.spyOn(computer, 'screenshot');
+      const onSafetyCheck = vi.fn().mockRejectedValue(callbackError);
+      const agent = new Agent({
+        name: 'SafetyCheckAgent',
+        model: new ScriptedModel([
+          modelResponse({
+            output: [
+              {
+                type: 'computer_call',
+                callId: 'safety-call',
+                status: 'completed',
+                action: { type: 'screenshot' },
+                providerData: {
+                  pending_safety_checks: [
+                    { id: 'check-1', code: 'sensitive_domain' },
+                  ],
+                },
+              },
+            ],
+            usage: new Usage(),
+          }),
+        ]),
+        tools: [computerTool({ computer, onSafetyCheck })],
+      });
+      const runner = new Runner({
+        tracingDisabled: false,
+        traceIncludeSensitiveData,
+      });
+
+      await withRecordingTrace(async (processor) => {
+        if (stream) {
+          const result = await runner.run(agent, 'start', { stream: true });
+          await expect(result.completed).rejects.toBe(callbackError);
+        } else {
+          await expect(runner.run(agent, 'start')).rejects.toBe(callbackError);
+        }
+
+        expect(onSafetyCheck).toHaveBeenCalledOnce();
+        expect(screenshot).not.toHaveBeenCalled();
+        const functionSpan = getEndedFunctionSpan(processor, 'computer');
+        for (const type of ['agent', 'turn', 'task']) {
+          const runSpan = processor.spansEnded.find(
+            (span) => span.spanData.type === type,
+          );
+          expect(runSpan?.error).toEqual({
+            message: 'Error in agent run',
+            data: {
+              error: traceIncludeSensitiveData
+                ? String(callbackError)
+                : 'Error',
+            },
+          });
+        }
+        if (traceIncludeSensitiveData) {
+          expect(functionSpan.error).toEqual({
+            message: callbackError.message,
+            data: callbackError.data,
+          });
+        } else {
+          expect(functionSpan.error).toEqual({
+            message: 'Error running tool',
+            data: {
+              tool_name: 'computer',
+              error: REDACTED_TOOL_ERROR_MESSAGE,
+            },
+          });
+          const serializedSpans = JSON.stringify(
+            processor.spansEnded.map((span) => span.toJSON()),
+          );
+          expect(serializedSpans).not.toContain(callbackError.message);
+          expect(serializedSpans).not.toContain(callbackError.name);
+          expect(serializedSpans).not.toContain(callbackError.data.detail);
+        }
+      });
+    },
+  );
+
   it('propagates onSafetyCheck callback errors', async () => {
     const sensitiveError = 'safety check leaked data';
     const fakeComputer = {
```

---

### Incident Patch 10: `130a8d37` (2026-10-02)
**Commit Message**: fix: honor configured archive limits in remote sandbox creation (#2020)

* fix: honor configured archive limits in remote sandbox creation

* fix: validate sandbox archive policy before provisioning

**File**: `.changeset/tidy-archives-respect-options.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-extensions': patch
+---
+
+fix: honor configured archive limits when creating remote sandbox sessions.
```

**File**: `packages/agents-extensions/src/sandbox/blaxel/sandbox.ts` (modified, +7/-1)
```diff
@@ -33,6 +33,7 @@ import {
   SANDBOX_MANIFEST_METADATA_SUPPORT,
   assertRunAsUnsupported,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   assertShellEnvironmentName,
   rehydrateRemoteSandboxSessionStateValues,
   formatPtyExecUpdate,
@@ -864,6 +865,11 @@ export class BlaxelSandboxClient implements SandboxClient<
     internalOptions: BlaxelCreateInternalOptions = {},
   ): Promise<BlaxelSandboxSession> {
     const createArgs = normalizeSandboxClientCreateArgs(args, manifestOptions);
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      createArgs.options?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported('BlaxelSandboxClient', createArgs.snapshot);
     const manifest = createArgs.manifest;
     const resolvedOptions = {
@@ -971,7 +977,7 @@ export class BlaxelSandboxClient implements SandboxClient<
           apiKey: resolvedOptions.apiKey ?? loadEnv().BL_API_KEY,
           ownsSandbox,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           state: {
             manifest,
             sandboxName,
```

**File**: `packages/agents-extensions/src/sandbox/cloudflare/sandbox.ts` (modified, +8/-1)
```diff
@@ -91,6 +91,7 @@ import {
 import {
   assertCoreSnapshotUnsupported,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   withProviderError,
   withSandboxSpan,
 } from '../shared/session';
@@ -1145,6 +1146,12 @@ export class CloudflareSandboxClient implements SandboxClient<
       args,
       manifestOptions as CloudflareSandboxClientOptions | undefined,
     );
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      (createArgs.options as CloudflareSandboxClientOptions | undefined)
+        ?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported(
       'CloudflareSandboxClient',
       createArgs.snapshot,
@@ -1241,7 +1248,7 @@ export class CloudflareSandboxClient implements SandboxClient<
         const session = new CloudflareSandboxSession({
           apiKey,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           state: {
             manifest,
             workerUrl: normalizedWorkerUrl,
```

**File**: `packages/agents-extensions/src/sandbox/daytona/sandbox.ts` (modified, +7/-1)
```diff
@@ -48,6 +48,7 @@ import {
   assertSandboxManifestMetadataSupported,
   MOUNT_MANIFEST_METADATA_SUPPORT,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   cloneManifestWithRoot,
   createRunAsRemoteEditor,
   rehydrateRemoteSandboxSessionStateValues,
@@ -1314,6 +1315,11 @@ export class DaytonaSandboxClient implements SandboxClient<
     manifestOptions?: DaytonaSandboxClientOptions,
   ): Promise<DaytonaSandboxSession> {
     const createArgs = normalizeSandboxClientCreateArgs(args, manifestOptions);
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      createArgs.options?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported('DaytonaSandboxClient', createArgs.snapshot);
     const manifest = createArgs.manifest;
     const resolvedOptions = {
@@ -1386,7 +1392,7 @@ export class DaytonaSandboxClient implements SandboxClient<
         const session = new DaytonaSandboxSession({
           sandbox,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           state: {
             manifest: resolvedManifest,
             sandboxId: sandbox.id,
```

**File**: `packages/agents-extensions/src/sandbox/e2b/sandbox.ts` (modified, +7/-1)
```diff
@@ -33,6 +33,7 @@ import {
   assertSandboxManifestMetadataSupported,
   SANDBOX_MANIFEST_METADATA_SUPPORT,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   decodeNativeSnapshotRef,
   encodeNativeSnapshotRef,
   materializeEnvironment,
@@ -882,6 +883,11 @@ export class E2BSandboxClient implements SandboxClient<
     manifestOptions?: E2BSandboxClientOptions,
   ): Promise<E2BSandboxSession> {
     const createArgs = normalizeSandboxClientCreateArgs(args, manifestOptions);
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      createArgs.options?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported('E2BSandboxClient', createArgs.snapshot);
     const manifest = createArgs.manifest;
     return await withSandboxSpan(
@@ -917,7 +923,7 @@ export class E2BSandboxClient implements SandboxClient<
         const session = new E2BSandboxSession({
           sandbox,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           state: {
             manifest,
             sandboxId: sandbox.sandboxId,
```

**File**: `packages/agents-extensions/src/sandbox/modal/sandbox.ts` (modified, +8/-1)
```diff
@@ -46,6 +46,7 @@ import {
   assertSandboxManifestMetadataSupported,
   MOUNT_MANIFEST_METADATA_SUPPORT,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   createRunAsRemoteEditor,
   decodeNativeSnapshotRef,
   rehydrateRemoteSandboxSessionStateValues,
@@ -1357,6 +1358,12 @@ export class ModalSandboxClient implements SandboxClient<
       args,
       manifestOptions as ModalSandboxClientOptions | undefined,
     );
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      (createArgs.options as ModalSandboxClientOptions | undefined)
+        ?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported('ModalSandboxClient', createArgs.snapshot);
     const manifest = createArgs.manifest;
     const resolvedOptions = resolveOptions(
@@ -1511,7 +1518,7 @@ export class ModalSandboxClient implements SandboxClient<
           state: sessionState,
           cloudBucketMounts,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           cloudBucketMountsProvider: async () =>
             await modalCloudBucketMountsForManifest({
               modal,
```

**File**: `packages/agents-extensions/src/sandbox/runloop/sandbox.ts` (modified, +7/-1)
```diff
@@ -41,6 +41,7 @@ import {
   assertSandboxManifestMetadataSupported,
   SANDBOX_MANIFEST_METADATA_SUPPORT,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   cloneManifestWithRoot,
   decodeNativeSnapshotRef,
   assertShellEnvironmentName,
@@ -1649,6 +1650,11 @@ export class RunloopSandboxClient implements SandboxClient<
     manifestOptions?: RunloopSandboxClientOptions,
   ): Promise<RunloopSandboxSession> {
     const createArgs = normalizeSandboxClientCreateArgs(args, manifestOptions);
+    const archiveLimits = resolveCreateArchiveLimits(
+      createArgs.archiveLimits,
+      createArgs.options?.archiveLimits,
+      this.options.archiveLimits,
+    );
     assertCoreSnapshotUnsupported('RunloopSandboxClient', createArgs.snapshot);
     const resolvedOptions = resolveRunloopOptions(
       this.options,
@@ -1763,7 +1769,7 @@ export class RunloopSandboxClient implements SandboxClient<
           devbox,
           mountSecretAuthorityTrusted: true,
           concurrencyLimits: createArgs.concurrencyLimits,
-          archiveLimits: createArgs.archiveLimits,
+          archiveLimits,
           state: {
             manifest,
             devboxId: devbox.id,
```

**File**: `packages/agents-extensions/src/sandbox/shared/index.ts` (modified, +1/-0)
```diff
@@ -85,6 +85,7 @@ export {
   assertResumeRecreateAllowed,
   assertRunAsUnsupported,
   closeRemoteSessionOnManifestError,
+  resolveCreateArchiveLimits,
   isProviderSandboxNotFoundError,
   providerErrorDetails,
   providerErrorMessage,
```

---

### Incident Patch 11: `24946f30` (2026-10-02)
**Commit Message**: fix(openai): omit mixed tool output from strict conversion errors (#2022)

**File**: `.changeset/quiet-strict-tool-output.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-openai': patch
+---
+
+fix: omit tool content from strict Chat Completions mixed-output diagnostics.
```

**File**: `packages/agents-openai/src/openaiChatCompletionsConverter.ts` (modified, +1/-2)
```diff
@@ -613,8 +613,7 @@ function normalizeFunctionCallOutputForChat(
 
     if (options.strictFeatureValidation && textItems.length !== output.length) {
       throw new UserError(
-        'Only text tool outputs are supported for chat completions. Got item: ' +
-          JSON.stringify(output),
+        'Only text tool outputs are supported for chat completions.',
       );
     }
 
```

**File**: `packages/agents-openai/test/openaiChatCompletionsModel.test.ts` (modified, +51/-0)
```diff
@@ -2,6 +2,7 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import {
   Agent,
   ModelBehaviorError,
+  UserError,
   Runner,
   Span,
   Trace,
@@ -395,6 +396,56 @@ describe('OpenAIChatCompletionsModel', () => {
     expect(client.chat.completions.create).not.toHaveBeenCalled();
   });
 
+  it.each(['non-streaming', 'streaming'] as const)(
+    'omits mixed tool output from strict errors and traces (%s)',
+    async (mode) => {
+      setTracingDisabled(false);
+      const processor = new RecordingProcessor();
+      setTraceProcessors([processor]);
+      const client = new FakeClient();
+      const model = new OpenAIChatCompletionsModel(client as any, 'gpt', {
+        strictFeatureValidation: true,
+      });
+      const request = {
+        input: [
+          {
+            type: 'function_call_result',
+            callId: 'call_mixed',
+            name: 'lookup',
+            status: 'completed',
+            output: [
+              { type: 'input_text', text: 'SYNTHETIC_PRIVATE_TOOL_TEXT' },
+              {
+                type: 'input_image',
+                image: 'https://example.com/SYNTHETIC_PRIVATE_IMAGE',
+              },
+            ],
+          },
+        ],
+        modelSettings: {},
+        tools: [],
+        outputType: 'text',
+        handoffs: [],
+        tracing: 'enabled_without_data',
+      };
+
+      await expect(callModel(model, request, mode)).rejects.toThrow(
+        new UserError(
+          'Only text tool outputs are supported for chat completions.',
+        ),
+      );
+      expect(client.chat.completions.create).not.toHaveBeenCalled();
+      const generation = processor.spansEnded.find(
+        (span) => span.spanData.type === 'generation',
+      );
+      expect(generation).toBeDefined();
+      expect(generation?.error).toBeDefined();
+      expect(JSON.stringify(generation?.toJSON())).not.toContain(
+        'SYNTHETIC_PRIVATE',
+      );
+    },
+  );
+
   it('warns and ignores server-managed conversation state by default', async () => {
     const client = new FakeClient();
     const response = {
```

---

### Incident Patch 12: `b9a4fb8d` (2026-10-02)
**Commit Message**: fix: redact escaping tool callback trace errors (#2017)

**File**: `.changeset/redact-tool-callback-traces.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: respect sensitive-data trace settings for escaping tool callbacks.
```

**File**: `packages/agents-core/src/runner/toolExecution.ts` (modified, +17/-1)
```diff
@@ -1776,7 +1776,23 @@ async function withToolFunctionSpan<T>(
   }
 
   return withFunctionSpan(
-    async (span) => fn(span),
+    async (span) => {
+      try {
+        return await fn(span);
+      } catch (error) {
+        // Escaping callbacks must not fall through to generic error capture.
+        if (!runner.config.traceIncludeSensitiveData && span.error === null) {
+          span.setError({
+            message: 'Error running tool',
+            data: {
+              tool_name: toolName,
+              error: REDACTED_TOOL_ERROR_MESSAGE,
+            },
+          });
+        }
+        throw error;
+      }
+    },
     {
       data: {
         name: toolName,
```

**File**: `packages/agents-core/test/toolCallbackTracing.test.ts` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+import { Agent } from '../src/agent';
+import { Runner } from '../src/run';
+import { computerTool } from '../src/tool';
+import { ScriptedModel } from '../src/testing';
+import { setTraceProcessors, setTracingDisabled } from '../src/tracing';
+import { defaultProcessor } from '../src/tracing/processor';
+import type { Span } from '../src/tracing/spans';
+import { FakeComputer } from './stubs';
+
+let spans: Span<any>[];
+
+beforeEach(() => {
+  spans = [];
+  setTracingDisabled(false);
+  setTraceProcessors([
+    {
+      async onTraceStart() {},
+      async onTraceEnd() {},
+      async onSpanStart() {},
+      async onSpanEnd(span) {
+        spans.push(span);
+      },
+      async shutdown() {},
+      async forceFlush() {},
+    },
+  ]);
+});
+
+afterEach(() => {
+  setTraceProcessors([defaultProcessor()]);
+  setTracingDisabled(true);
+  vi.restoreAllMocks();
+});
+
+it.each([
+  { callback: 'safety', sensitive: false, stream: false },
+  { callback: 'safety', sensitive: false, stream: true },
+  { callback: 'safety', sensitive: true, stream: false },
+  { callback: 'start', sensitive: false, stream: false },
+  { callback: 'end', sensitive: false, stream: false },
+])(
+  'applies tool trace policy to escaping callbacks: %j',
+  async ({ callback, sensitive, stream }) => {
+    const secret = 'synthetic-confidential-callback-context';
+    const error = Object.assign(new Error('Callback failed'), {
+      data: { confidentialContext: secret },
+    });
+    const computer = new FakeComputer();
+    const screenshot = vi.spyOn(computer, 'screenshot');
+    const safety = vi.fn(async () => {
+      if (callback === 'safety') throw error;
+      return true;
+    });
+    const agent = new Agent({
+      name: 'Computer callback test',
+      model: new ScriptedModel([
+        [
+          {
+            type: 'computer_call',
+            callId: 'callback-call',
+            status: 'completed',
+            action: { type: 'screenshot' },
+            providerData: {
+              pending_safety_checks: [
+                { id: 'check', code: 'test', message: 'Confirm action' },
+              ],
+            },
+          },
+        ],
+      ]),
+      tools: [computerTool({ computer, onSafetyCheck: safety })],
+    });
+    const runner = new Runner({ traceIncludeSensitiveData: sensitive });
+    if (callback !== 'safety') {
+      runner.on(
+        callback === 'start' ? 'agent_tool_start' : 'agent_tool_end',
+        () => {
+          throw error;
+        },
+      );
+    }
+    const run = async () => {
+      if (stream) {
+        const result = await runner.run(agent, 'start', { stream: true });
+        await result.completed;
+      } else {
+        await runner.run(agent, 'start');
+      }
+    };
+    await expect(run()).rejects.toBe(error);
+    expect(screenshot).toHaveBeenCalledTimes(callback === 'end' ? 1 : 0);
+    expect(safety).toHaveBeenCalledTimes(callback === 'start' ? 0 : 1);
+    const functionSpans = spans.filter(
+      (span) => span.spanData.type === 'function',
+    );
+    expect(functionSpans).toHaveLength(1);
+    expect(functionSpans[0].endedAt).not.toBeNull();
+    if (sensitive) {
+      expect(functionSpans[0].error).toEqual({
+        message: error.message,
+        data: error.data,
+      });
+    } else {
+      expect(functionSpans[0].error).toMatchObject({
+        message: 'Error running tool',
+        data: { error: 'Tool execution failed. Error details are redacted.' },
+      });
+      expect(JSON.stringify(spans.map((span) => span.toJSON()))).not.toContain(
+        secret,
+      );
+    }
+    expect(error.data.confidentialContext).toBe(secret);
+  },
+);
```

---

### Incident Patch 13: `a73577e1` (2026-10-02)
**Commit Message**: fix(extensions): omit raw provider diagnostics from AI SDK traces (#2021)

**File**: `.changeset/tidy-provider-trace-errors.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-extensions': patch
+---
+
+fix: omit raw provider response bodies, headers, and causes from AI SDK error traces while preserving caller errors.
```

**File**: `packages/agents-extensions/src/ai-sdk/index.ts` (modified, +6/-38)
```diff
@@ -1171,25 +1171,9 @@ export class AiSdkModel implements Model {
                   ? {
                       name: error.name,
                       message: error.message,
-                      // Include AI SDK specific error fields if they exist.
-                      ...(typeof error === 'object' && error !== null
-                        ? {
-                            ...('responseBody' in error
-                              ? { responseBody: (error as any).responseBody }
-                              : {}),
-                            ...('responseHeaders' in error
-                              ? {
-                                  responseHeaders: (error as any)
-                                    .responseHeaders,
-                                }
-                              : {}),
-                            ...('statusCode' in error
-                              ? { statusCode: (error as any).statusCode }
-                              : {}),
-                            ...('cause' in error
-                              ? { cause: (error as any).cause }
-                              : {}),
-                          }
+                      // Keep raw provider payloads and transport metadata out of traces.
+                      ...('statusCode' in error
+                        ? { statusCode: (error as any).statusCode }
                         : {}),
                     }
                   : error.name,
@@ -1662,25 +1646,9 @@ export class AiSdkModel implements Model {
                   ? {
                       name: error.name,
                       message: error.message,
-                      // Include AI SDK specific error fields if they exist.
-                      ...(typeof error === 'object' && error !== null
-                        ? {
-                            ...('responseBody' in error
-                              ? { responseBody: (error as any).responseBody }
-                              : {}),
-                            ...('responseHeaders' in error
-                              ? {
-                                  responseHeaders: (error as any)
-                                    .responseHeaders,
-                                }
-                              : {}),
-                            ...('statusCode' in error
-                              ? { statusCode: (error as any).statusCode }
-                              : {}),
-                            ...('cause' in error
-                              ? { cause: (error as any).cause }
-                              : {}),
-                          }
+                      // Keep raw provider payloads and transport metadata out of traces.
+                      ...('statusCode' in error
+                        ? { statusCode: (error as any).statusCode }
                         : {}),
                     }
                   : String(error)
```

**File**: `packages/agents-extensions/test/ai-sdk/index.test.ts` (modified, +81/-0)
```diff
@@ -15,6 +15,7 @@ import {
   protocol,
   run,
   RunContext,
+  Runner,
   tool,
   toolNamespace,
   withTrace,
@@ -5066,6 +5067,86 @@ describe('AiSdkModel', () => {
   });
 
   describe('Error handling with tracing', () => {
+    test.each(['generate', 'stream-request', 'stream-chunk'] as const)(
+      'omits raw provider error diagnostics from traces for %s',
+      async (failureMode) => {
+        const privateMarker = 'SYNTHETIC_PRIVATE_DIAGNOSTIC';
+        const providerError = new APICallError({
+          message: 'Provider request failed',
+          url: 'https://provider.example.invalid',
+          requestBodyValues: { prompt: privateMarker },
+          responseBody: privateMarker,
+          responseHeaders: { 'set-cookie': privateMarker },
+          cause: { diagnostic: privateMarker },
+          statusCode: 400,
+          isRetryable: false,
+        });
+        const model = new AiSdkModel(
+          stubModel({
+            async doGenerate() {
+              throw providerError;
+            },
+            async doStream() {
+              if (failureMode === 'stream-request') {
+                throw providerError;
+              }
+              return {
+                stream: partsStream([{ type: 'error', error: providerError }]),
+              } as any;
+            },
+          }),
+        );
+        const agent = new Agent({ name: 'trace-error-test', model });
+        // Omitted configuration exercises the default sensitive tracing setting.
+        for (const traceIncludeSensitiveData of [undefined, false]) {
+          const processor = new RecordingTracingProcessor();
+          setTraceProcessors([processor]);
+          setTracingDisabled(false);
+          try {
+            const runner = new Runner({ traceIncludeSensitiveData });
+            if (failureMode === 'generate') {
+              await expect(runner.run(agent, 'test')).rejects.toBe(
+                providerError,
+              );
+            } else {
+              const result = await runner.run(agent, 'test', { stream: true });
+              await expect(result.completed).rejects.toBe(providerError);
+            }
+            const spans = processor.spansEnded.map((span) => span.toJSON());
+            expect(JSON.stringify(spans)).not.toContain(privateMarker);
+            const generationSpans = processor.spansEnded.filter(
+              (span) => span.spanData.type === 'generation',
+            );
+            expect(generationSpans).toHaveLength(1);
+            expect(generationSpans[0].error).toEqual({
+              message:
+                traceIncludeSensitiveData === false
+                  ? 'Unknown error'
+                  : 'Provider request failed',
+              data: {
+                error:
+                  traceIncludeSensitiveData === false
+                    ? 'AI_APICallError'
+                    : {
+                        name: 'AI_APICallError',
+                        message: 'Provider request failed',
+                        statusCode: 400,
+                      },
+              },
+            });
+            expect(providerError.responseBody).toBe(privateMarker);
+            expect(providerError.responseHeaders).toEqual({
+              'set-cookie': privateMarker,
+            });
+            expect(providerError.cause).toEqual({ diagnostic: privateMarker });
+          } finally {
+            setTraceProcessors([]);
+            setTracingDisabled(true);
+          }
+        }
+      },
+    );
+
     test('getRetryAdvice ignores status-only AI SDK errors without provider guidance', () => {
       const aiSdkError = new Error('API call failed');
       (aiSdkError as any).statusCode = 429;
```

---

### Incident Patch 14: `3626398f` (2026-10-02)
**Commit Message**: fix: honor sensitive-data opt-out in Responses tracing (#2016)

**File**: `.changeset/quiet-responses-tracing.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-openai': patch
+---
+
+fix: Honor sensitive-data tracing opt-out for Responses payloads and provider errors.
```

**File**: `packages/agents-openai/src/openaiResponsesModel.ts` (modified, +13/-16)
```diff
@@ -1884,7 +1884,12 @@ export class OpenAIResponsesModel implements Model {
           request,
           false,
           endpointMetadata,
-        );
+        ).catch((error: unknown) => {
+          if (request.tracing === 'enabled_without_data') {
+            span.setError({ message: 'Error getting response' });
+          }
+          throw error;
+        });
         const rawUsage =
           request.modelSettings.preserveRawUsage === true
             ? snapshotRawUsage(response.usage)
@@ -1903,7 +1908,7 @@ export class OpenAIResponsesModel implements Model {
           ) {
             span.spanData.response_id = response.id;
           }
-          if (request.tracing === true || !terminalType) {
+          if (request.tracing === true) {
             span.spanData._input = request.input;
             span.spanData._response = response;
           }
@@ -2113,26 +2118,18 @@ export class OpenAIResponsesModel implements Model {
         }
       }
 
-      if (request.tracing && span && finalResponse) {
-        if (request.tracing === true) {
-          span.spanData.response_id = finalResponse.id;
-        }
-        if (request.tracing === true || !terminalError) {
-          span.spanData._response = finalResponse;
-        }
+      if (request.tracing === true && span && finalResponse) {
+        span.spanData.response_id = finalResponse.id;
+        span.spanData._response = finalResponse;
       }
     } catch (error) {
       const errorToThrow = terminalError ?? error;
       if (span?.error === null) {
         span.setError({
           message: 'Error streaming response',
-          data: {
-            error: request.tracing
-              ? String(errorToThrow)
-              : errorToThrow instanceof Error
-                ? errorToThrow.name
-                : undefined,
-          },
+          ...(request.tracing === true
+            ? { data: { error: String(errorToThrow) } }
+            : {}),
         });
       }
       throw errorToThrow;
```

**File**: `packages/agents-openai/test/openaiResponsesModel.test.ts` (modified, +120/-0)
```diff
@@ -943,6 +943,126 @@ describe('OpenAIResponsesModel', () => {
     expect(result.output).toEqual([]);
   });
 
+  describe.each([false, true])('sensitive tracing with stream=%s', (stream) => {
+    it.each([false, true])(
+      'honors traceIncludeSensitiveData=%s on successful runs',
+      async (traceIncludeSensitiveData) => {
+        const spans = captureResponseSpans();
+        const input = 'synthetic-private-input';
+        const output = 'synthetic-private-output';
+        const response = {
+          id: 'resp_sensitive_test',
+          status: 'completed',
+          usage: {},
+          output: [
+            {
+              id: 'msg_sensitive_test',
+              type: 'message',
+              role: 'assistant',
+              status: 'completed',
+              content: [{ type: 'output_text', text: output, annotations: [] }],
+            },
+          ],
+        };
+        async function* events() {
+          yield { type: 'response.completed', response, sequence_number: 0 };
+        }
+        const model = new OpenAIResponsesModel(
+          {
+            baseURL: 'https://api.openai.com/v1',
+            responses: {
+              create: vi
+                .fn()
+                .mockReturnValue(
+                  createResponsePromiseWithURL(
+                    stream ? events() : response,
+                    'https://api.openai.com/v1/responses',
+                  ),
+                ),
+            },
+          } as unknown as OpenAI,
+          'gpt-test',
+        );
+        const runner = new Runner({ traceIncludeSensitiveData });
+        const agent = new Agent({ name: 'TracingTest', model });
+        if (stream) {
+          const result = await runner.run(agent, input, { stream: true });
+          for await (const _event of result) {
+            /* consume */
+          }
+          await result.completed;
+          expect(result.finalOutput).toBe(output);
+        } else {
+          expect((await runner.run(agent, input)).finalOutput).toBe(output);
+        }
+        expect(spans).toHaveLength(1);
+        expect(spans[0].spanData.response_id).toBe(response.id);
+        if (traceIncludeSensitiveData) {
+          expect(JSON.stringify(spans[0].spanData._input)).toContain(input);
+          expect(JSON.stringify(spans[0].spanData._response)).toContain(output);
+        } else {
+          expect(spans[0].spanData._input).toBeUndefined();
+          expect(spans[0].spanData._response).toBeUndefined();
+          expect(JSON.stringify(spans[0].toJSON())).not.toContain(input);
+          expect(JSON.stringify(spans[0].toJSON())).not.toContain(output);
+        }
+      },
+    );
+
+    it.each([true, 'enabled_without_data'] as const)(
+      'preserves the caller error and honors tracing=%s on provider failure',
+      async (tracing) => {
+        const spans = captureResponseSpans();
+        const error = new Error('synthetic-private-provider-error');
+        async function* events() {
+          yield { type: 'response.created', response: { id: 'resp_error' } };
+          throw error;
+        }
+        const model = new OpenAIResponsesModel(
+          {
+            responses: {
+              create: stream
+                ? vi.fn().mockResolvedValue(events())
+                : vi.fn().mockRejectedValue(error),
+            },
+          } as unknown as OpenAI,
+          'gpt-test',
+        );
+        const request: ModelRequest = {
+          systemInstructions: undefined,
+          input: 'synthetic-private-input',
+          modelSettings: {},
+          tools: [],
+          outputType: 'text',
+          handoffs: [],
+          tracing,
+        };
+        await expect(
+          withTrace('test', async () => {
+            if (stream) {
+              for await (const _event of model.getStreamedResponse(request)) {
+                /* consume */
+              }
+            } else {
+              await model.getResponse(request);
+            }
+          }),
+        ).rejects.toBe(error);
+        expect(spans).toHaveLength(1);
+        expect(spans[0].error).not.toBeNull();
+        if (tracing === true) {
+          expect(JSON.stringify(spans[0].error)).toContain(error.message);
+        } else {
+          expect(JSON.stringify(spans[0].toJSON())).not.toContain(
+            error.message,
+          );
+          expect(spans[0].spanData._input).toBeUndefined();
+          expect(spans[0].spanData._response).toBeUndefined();
+        }
+      },
+    );
+  });
+
   it('redacts an unsuccessful non-streaming response from no-data tracing', async () => {
     setTracingDisabled(false);
     let responseSpan: Span<any> | undefined;
```

---

### Incident Patch 15: `58b08f84` (2026-10-01)
**Commit Message**: fix(tracing): bound repeated span truncation work (#2013)

* fix(tracing): bound repeated span truncation work

* refactor(tracing): isolate export field processing

**File**: `.changeset/tidy-trace-work.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-openai': patch
+---
+
+fix: Bound repeated trace truncation work and fall back to a preview for expensive fields.
```

**File**: `packages/agents-openai/src/openaiTracingExporter.ts` (modified, +7/-537)
```diff
@@ -9,6 +9,10 @@ import {
 import { logModelAndToolActionError } from '@openai/agents-core/utils/internal';
 import { getTracingExportApiKey, HEADERS } from './defaults';
 import logger from './logger';
+import {
+  truncateSpanFieldValue,
+  sanitizeGenerationUsageForTracesIngest,
+} from './tracingFieldProcessing';
 
 /**
  * Options for OpenAITracingExporter.
@@ -23,20 +27,8 @@ export type OpenAITracingExporterOptions = {
   maxDelay: number;
 };
 
-type GenerationUsageData = NonNullable<GenerationSpanData['usage']>;
-type JsonCompatibleValue =
-  | null
-  | string
-  | number
-  | boolean
-  | JsonCompatibleValue[]
-  | { [key: string]: JsonCompatibleValue };
-
-const OPENAI_TRACING_MAX_FIELD_BYTES = 100_000;
 const OPENAI_TRACING_INGEST_ENDPOINT =
   'https://api.openai.com/v1/traces/ingest';
-const OPENAI_TRACING_MAX_RECURSION_DEPTH = 1_000;
-const OPENAI_TRACING_STRING_TRUNCATION_SUFFIX = '... [truncated]';
 
 function retryAfterMs(headers: Headers): number | undefined {
   const milliseconds = headers.get('retry-after-ms')?.trim();
@@ -86,496 +78,23 @@ async function sleepWithAbort(
     signal?.addEventListener('abort', onAbort, { once: true });
   });
 }
-const UNSERIALIZABLE = Symbol('openaiTracingExporter.unserializable');
-const textEncoder = new TextEncoder();
 
 function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === 'object' && value !== null;
 }
 
-function isPlainObject(value: unknown): value is Record<string, unknown> {
-  if (!isRecord(value)) {
-    return false;
-  }
-
-  const prototype = Object.getPrototypeOf(value);
-  return prototype === Object.prototype || prototype === null;
-}
-
-function hasToJSON(value: object): value is object & { toJSON: () => unknown } {
-  try {
-    return typeof (value as { toJSON?: unknown }).toJSON === 'function';
-  } catch {
-    return false;
-  }
-}
-
 function isGenerationSpanData(
   spanData: Record<string, unknown>,
 ): spanData is GenerationSpanData {
   return spanData.type === 'generation';
 }
 
-function isGenerationUsageData(usage: unknown): usage is GenerationUsageData {
+function isGenerationUsageData(
+  usage: unknown,
+): usage is NonNullable<GenerationSpanData['usage']> {
   return isRecord(usage);
 }
 
-function isFiniteJsonNumber(value: unknown): value is number {
-  return typeof value === 'number' && Number.isFinite(value);
-}
-
-function valueJsonSizeBytes(value: unknown): number {
-  try {
-    const serialized = JSON.stringify(value);
-    if (serialized === undefined) {
-      return 0;
-    }
-    if (typeof serialized !== 'string') {
-      return OPENAI_TRACING_MAX_FIELD_BYTES + 1;
-    }
-    return textEncoder.encode(serialized).length;
-  } catch {
-    return OPENAI_TRACING_MAX_FIELD_BYTES + 1;
-  }
-}
-
-function truncateStringForJsonLimit(value: string, maxBytes: number): string {
-  const valueSize = valueJsonSizeBytes(value);
-  if (valueSize <= maxBytes) {
-    return value;
-  }
-
-  const suffixSize = valueJsonSizeBytes(
-    OPENAI_TRACING_STRING_TRUNCATION_SUFFIX,
-  );
-  if (suffixSize > maxBytes) {
-    return '';
-  }
-  if (suffixSize === maxBytes) {
-    return OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
-  }
-
-  const budgetWithoutSuffix = maxBytes - suffixSize;
-  let estimatedChars = Math.floor(
-    (value.length * budgetWithoutSuffix) / Math.max(valueSize, 1),
-  );
-  estimatedChars = Math.max(0, Math.min(value.length, estimatedChars));
-
-  let best =
-    value.slice(0, estimatedChars) + OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
-  let bestSize = valueJsonSizeBytes(best);
-  while (bestSize > maxBytes && estimatedChars > 0) {
-    const overflowRatio = (bestSize - maxBytes) / Math.max(bestSize, 1);
-    const trimChars = Math.max(
-      1,
-      Math.floor(estimatedChars * overflowRatio) + 1,
-    );
-    estimatedChars = Math.max(0, estimatedChars - trimChars);
-    best =
-      value.slice(0, estimatedChars) + OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
-    bestSize = valueJsonSizeBytes(best);
-  }
-
-  return best;
-}
-
-function sanitizeJsonCompatibleValue(
-  value: unknown,
-  seen: Set<object> = new Set(),
-  depth: number = 0,
-): JsonCompatibleValue | typeof UNSERIALIZABLE {
-  if (depth >= OPENAI_TRACING_MAX_RECURSION_DEPTH) {
-    return UNSERIALIZABLE;
-  }
-
-  if (
-    value === null ||
-    typeof value === 'string' ||
-    typeof value === 'boolean'
-  ) {
-    return value;
-  }
-
-  if (typeof value === 'number') {
-    return Number.isFinite(value) ? value : UNSERIALIZABLE;
-  }
-
-  if (value && typeof value === 'object' && hasToJSON(value)) {
-    if (seen.has(value)) {
-      return UNSERIALIZABLE;
-    }
-
-    seen.add(value);
-    try {
-      return sanitizeJsonCompatibleValue(value.toJSON(), seen, depth + 1);
-    } catch {
-      return UNSERIALIZABLE;
-    } finally {
-      seen.delete(value);
-    }
-  }
-
-  if (Array.isArray(value)) {
-    if (seen.has(value)) {
-      return UNSERIALIZABLE;
-    }
-
-    seen.add(value);

```

**File**: `packages/agents-openai/src/tracingFieldProcessing.ts` (added, +578/-0)
```diff
@@ -0,0 +1,578 @@
+import type { GenerationSpanData } from '@openai/agents-core';
+
+type GenerationUsageData = NonNullable<GenerationSpanData['usage']>;
+type JsonCompatibleValue =
+  | null
+  | string
+  | number
+  | boolean
+  | JsonCompatibleValue[]
+  | { [key: string]: JsonCompatibleValue };
+
+const OPENAI_TRACING_MAX_FIELD_BYTES = 100_000;
+// Limit repeated sizing work independently of the retained field size.
+const OPENAI_TRACING_MAX_TRUNCATION_WORK_BYTES = 8_000_000;
+type TruncationWork = { remainingBytes: number };
+const TRUNCATION_WORK_EXHAUSTED = Symbol('truncationWorkExhausted');
+const OPENAI_TRACING_MAX_RECURSION_DEPTH = 1_000;
+const OPENAI_TRACING_STRING_TRUNCATION_SUFFIX = '... [truncated]';
+
+const UNSERIALIZABLE = Symbol('openaiTracingExporter.unserializable');
+const textEncoder = new TextEncoder();
+
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null;
+}
+
+function isPlainObject(value: unknown): value is Record<string, unknown> {
+  if (!isRecord(value)) {
+    return false;
+  }
+
+  const prototype = Object.getPrototypeOf(value);
+  return prototype === Object.prototype || prototype === null;
+}
+
+function hasToJSON(value: object): value is object & { toJSON: () => unknown } {
+  try {
+    return typeof (value as { toJSON?: unknown }).toJSON === 'function';
+  } catch {
+    return false;
+  }
+}
+
+function isFiniteJsonNumber(value: unknown): value is number {
+  return typeof value === 'number' && Number.isFinite(value);
+}
+
+function valueJsonSizeBytes(value: unknown, work?: TruncationWork): number {
+  // Check before starting another traversal. The final traversal can exceed the
+  // budget by one value's size, keeping total work linear in input plus budget.
+  if (work && work.remainingBytes <= 0) {
+    throw TRUNCATION_WORK_EXHAUSTED;
+  }
+  let size: number;
+  try {
+    const serialized = JSON.stringify(value);
+    size =
+      serialized === undefined
+        ? 0
+        : typeof serialized === 'string'
+          ? textEncoder.encode(serialized).length
+          : OPENAI_TRACING_MAX_FIELD_BYTES + 1;
+  } catch {
+    size = OPENAI_TRACING_MAX_FIELD_BYTES + 1;
+  }
+  if (work) {
+    work.remainingBytes -= Math.max(1, size);
+    if (work.remainingBytes < 0) {
+      throw TRUNCATION_WORK_EXHAUSTED;
+    }
+  }
+  return size;
+}
+
+function truncateStringForJsonLimit(
+  value: string,
+  maxBytes: number,
+  work?: TruncationWork,
+): string {
+  const valueSize = valueJsonSizeBytes(value, work);
+  if (valueSize <= maxBytes) {
+    return value;
+  }
+
+  const suffixSize = valueJsonSizeBytes(
+    OPENAI_TRACING_STRING_TRUNCATION_SUFFIX,
+    work,
+  );
+  if (suffixSize > maxBytes) {
+    return '';
+  }
+  if (suffixSize === maxBytes) {
+    return OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
+  }
+
+  const budgetWithoutSuffix = maxBytes - suffixSize;
+  let estimatedChars = Math.floor(
+    (value.length * budgetWithoutSuffix) / Math.max(valueSize, 1),
+  );
+  estimatedChars = Math.max(0, Math.min(value.length, estimatedChars));
+
+  let best =
+    value.slice(0, estimatedChars) + OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
+  let bestSize = valueJsonSizeBytes(best, work);
+  while (bestSize > maxBytes && estimatedChars > 0) {
+    const overflowRatio = (bestSize - maxBytes) / Math.max(bestSize, 1);
+    const trimChars = Math.max(
+      1,
+      Math.floor(estimatedChars * overflowRatio) + 1,
+    );
+    estimatedChars = Math.max(0, estimatedChars - trimChars);
+    best =
+      value.slice(0, estimatedChars) + OPENAI_TRACING_STRING_TRUNCATION_SUFFIX;
+    bestSize = valueJsonSizeBytes(best, work);
+  }
+
+  return best;
+}
+
+function sanitizeJsonCompatibleValue(
+  value: unknown,
+  seen: Set<object> = new Set(),
+  depth: number = 0,
+): JsonCompatibleValue | typeof UNSERIALIZABLE {
+  if (depth >= OPENAI_TRACING_MAX_RECURSION_DEPTH) {
+    return UNSERIALIZABLE;
+  }
+
+  if (
+    value === null ||
+    typeof value === 'string' ||
+    typeof value === 'boolean'
+  ) {
+    return value;
+  }
+
+  if (typeof value === 'number') {
+    return Number.isFinite(value) ? value : UNSERIALIZABLE;
+  }
+
+  if (value && typeof value === 'object' && hasToJSON(value)) {
+    if (seen.has(value)) {
+      return UNSERIALIZABLE;
+    }
+
+    seen.add(value);
+    try {
+      return sanitizeJsonCompatibleValue(value.toJSON(), seen, depth + 1);
+    } catch {
+      return UNSERIALIZABLE;
+    } finally {
+      seen.delete(value);
+    }
+  }
+
+  if (Array.isArray(value)) {
+    if (seen.has(value)) {
+      return UNSERIALIZABLE;
+    }
+
+    seen.add(value);
+    const sanitized: JsonCompatibleValue[] = [];
+    try {
+      for (const nestedValue of value) {
+        const sanitizedNested = sanitizeJsonCompatibleValue(
+          nestedValue,
+          seen,
+          depth + 1,
+        );
+        sanitized.push(
+          sanitizedNested === UNSERIALIZABLE ? null 
```

**File**: `packages/agents-openai/test/openaiTracingExporter.test.ts` (modified, +5/-7)
```diff
@@ -1,8 +1,6 @@
+import { _tracingFieldProcessingTestUtils } from '../src/tracingFieldProcessing';
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
-import {
-  OpenAITracingExporter,
-  _openAITracingExporterTestUtils,
-} from '../src/openaiTracingExporter';
+import { OpenAITracingExporter } from '../src/openaiTracingExporter';
 import { HEADERS } from '../src/defaults';
 import { BatchTraceProcessor, createCustomSpan } from '@openai/agents-core';
 import logger from '../src/logger';
@@ -1112,7 +1110,7 @@ describe('OpenAITracingExporter', () => {
 
   it('deletes mapping children when child budget is zero', () => {
     const truncated =
-      _openAITracingExporterTestUtils.truncateMappingForJsonLimit(
+      _tracingFieldProcessingTestUtils.truncateMappingForJsonLimit(
         { a: {}, b: {} },
         0,
       );
@@ -1122,7 +1120,7 @@ describe('OpenAITracingExporter', () => {
 
   it('truncates mapping children stored under empty-string keys', () => {
     const truncated =
-      _openAITracingExporterTestUtils.truncateMappingForJsonLimit(
+      _tracingFieldProcessingTestUtils.truncateMappingForJsonLimit(
         { '': 'x'.repeat(maxFieldBytes), keep: 'y' },
         128,
       );
@@ -1135,7 +1133,7 @@ describe('OpenAITracingExporter', () => {
   });
 
   it('deletes list children when child budget is zero', () => {
-    const truncated = _openAITracingExporterTestUtils.truncateListForJsonLimit(
+    const truncated = _tracingFieldProcessingTestUtils.truncateListForJsonLimit(
       [{}, {}],
       0,
     );
```

**File**: `packages/agents-openai/test/tracingTruncation.test.ts` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import {
+  BatchTraceProcessor,
+  setTraceProcessors,
+  setTracingDisabled,
+  withTrace,
+  type ModelRequest,
+  type Span,
+} from '@openai/agents-core';
+import { OpenAIChatCompletionsModel } from '../src/openaiChatCompletionsModel';
+import { OpenAITracingExporter } from '../src/openaiTracingExporter';
+
+// Measure actual serialization work rather than relying on machine timing.
+function measureSerialization() {
+  const stringify = JSON.stringify;
+  let bytes = 0;
+  const spy = vi.spyOn(JSON, 'stringify').mockImplementation((...args) => {
+    const result = stringify(...args);
+    bytes += result === undefined ? 0 : new TextEncoder().encode(result).length;
+    return result;
+  });
+  return () => {
+    spy.mockRestore();
+    return bytes;
+  };
+}
+
+afterEach(() => {
+  setTraceProcessors([]);
+  setTracingDisabled(true);
+  vi.restoreAllMocks();
+  vi.unstubAllGlobals();
+});
+
+describe('trace truncation work', () => {
+  it.each(['success', 'rejection', 'stream rejection'] as const)(
+    'bounds export of wide user content after model %s',
+    async (mode) => {
+      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
+      vi.stubGlobal('fetch', fetchMock);
+      const exporter = new OpenAITracingExporter({ apiKey: 'test-key' });
+      const exportSpy = vi.spyOn(exporter, 'export');
+      const processor = new BatchTraceProcessor(exporter, {
+        scheduleDelay: 60_000,
+      });
+      setTraceProcessors([processor]);
+      setTracingDisabled(false);
+      const create = vi.fn();
+      if (mode === 'success') {
+        create.mockResolvedValue({
+          id: 'test-completion',
+          choices: [
+            {
+              index: 0,
+              message: { role: 'assistant', content: 'ok' },
+              finish_reason: 'stop',
+            },
+          ],
+          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
+        });
+      } else {
+        create.mockRejectedValue(new Error('synthetic provider rejection'));
+      }
+      const model = new OpenAIChatCompletionsModel(
+        {
+          chat: { completions: { create } },
+          baseURL: 'https://example.com',
+        } as any,
+        'test-model',
+      );
+      const content = Array.from({ length: 8_000 }, () => ({
+        type: 'input_text' as const,
+        text: 'a',
+      }));
+      const request: ModelRequest = {
+        input: [{ role: 'user', content }],
+        modelSettings: {},
+        tools: [],
+        handoffs: [],
+        outputType: 'text',
+        tracing: true,
+      };
+      try {
+        const call = withTrace('wide-input-test', async () => {
+          if (mode === 'stream rejection') {
+            for await (const event of model.getStreamedResponse(request)) {
+              void event;
+            }
+          } else {
+            await model.getResponse(request);
+          }
+        });
+        if (mode === 'success') await call;
+        else await expect(call).rejects.toThrow('synthetic provider rejection');
+
+        const finishMeasurement = measureSerialization();
+        await processor.forceFlush();
+        const bytes = finishMeasurement();
+        // A fixed ceiling includes initial sizing, the budget's last traversal,
+        // and the final small payload. The old loop processes gigabytes here.
+        expect(bytes).toBeLessThan(10_000_000);
+        const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
+        const generation = sent.data.find(
+          (item: any) => item.span_data?.type === 'generation',
+        );
+        expect(generation.span_data.input).toEqual({
+          truncated: true,
+          original_type: 'Array',
+          preview: '<Array len=1 truncated>',
+        });
+        const source = exportSpy.mock.calls[0][0].find(
+          (item) => 'spanData' in item && item.spanData.type === 'generation',
+        ) as Span<any>;
+        expect(source.spanData.input[0].content).toHaveLength(8_000);
+        expect(create.mock.calls[0][0].messages[0].content).toHaveLength(8_000);
+        expect(content).toHaveLength(8_000);
+      } finally {
+        await processor.shutdown();
+      }
+    },
+  );
+
+  it.each(['input', 'output'] as const)(
+    'bounds a wide mapping in %s',
+    async (field) => {
+      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
+      vi.stubGlobal('fetch', fetchMock);
+      const exporter = new OpenAITracingExporter({
+        apiKey: 'test-key',
+        endpoint: 'https://example.com/ingest',
+      });
+      const value = Object.fromEntries(
+        Array.from({ length: 8_000 }, (_, i) => [`key-${i}`, 'abcdefghij']),
+      );
+      const item = {
+        toJSON: () => ({
+          object: 'trace.span',
+          span_data: { type: 'generation', [field]: value },
+        }),
+      } as any;
+      const finishMeasurement = measureSeria
```

#### Recent Merged Pull Requests:
- **PR #2034** (2026-10-05): fix: bind AI SDK UI demo conversations to browser cookies (@jbeckwith-oai)
- **PR #2032** (2026-10-05): fix: count resumed model calls toward maxTurns (@jbeckwith-oai)
- **PR #2031** (2026-10-05): fix: preserve computer tool initializers across runs (@jbeckwith-oai)
- **PR #2030** (2026-10-05): fix: preserve current Vercel credentials on session restore (@jbeckwith-oai)
- **PR #2029** (2026-10-05): fix: preserve sticky sandbox permissions (@jbeckwith-oai)
- **PR #2028** (2026-10-05): fix(mcp): default automatic tool discovery to 64 pages (@jbeckwith-oai)
- **PR #2027** (2026-10-05): fix(realtime): preserve playback interruption after audio generation (@jbeckwith-oai)
- **PR #2026** (2026-10-05): fix: bound MCP streamable HTTP session termination (@jbeckwith-oai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
