# Forensic Learning Record (Deep Inspection): tutti-os/tutti

> **Canonical Artifact**: `07_PROJECT_LEARNING/tutti-os-tutti-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tutti-os/tutti](https://github.com/tutti-os/tutti))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:17.384Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tutti-os/tutti`
- **Description**: Where people and agents build in tune.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3791 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.codex/skills/tutti-architecture-review/scripts/plan-review.mjs`
```
#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: node ./.codex/skills/tutti-architecture-review/scripts/plan-review.mjs [options]

Options:
  --base <ref>        Compare against a base ref. Defaults to HEAD.
  --staged           Review only staged changes.
  --no-untracked     Exclude untracked files from planning.
  --scope-file <path>
                     Limit review planning to a normalized scope JSON file.
  --scope-mode <mode>
                     Scope selection mode: auto or static-only. Defaults to auto.
  --format <format>  Output format: json, markdown, or summary. Defaults to json.
  --output <path>    Write output to a file instead of stdout.
  --output-temp      Write output to an OS temp task package path.
  --from-package <path>
                     Render an existing JSON task package instead of reading git diff.
  --task <id>        Keep only one task id in the rendered package.
  --help             Show this help.
`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const reviewRules = loadReviewRules(
  resolve(scriptDir, "../references/review-rules.json")
);
const TASKS = reviewRules.tasks;
const SIGNAL_RULES = reviewRules.signals;

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }

  const outputPath = resolveOutputPath(options);
  if (options.fromPackage) {
    const packageJson = applyTaskFilter(
      readTaskPackage(options.fromPackage),
      options.taskId
    );
    const output = renderOutput(packageJson, options.format);
    writeOrPrintOutput(output, outputPath);
    return;
  }

  const repoRoot = git(["rev-parse", "--show-toplevel"]).trim();
  process.chdir(repoRoot);

  const scope = options.scopeFile ? readScopeFile(options.scopeFile) : null;
  const changedFiles = selectReviewFiles(
    collectChangedFiles(options),
    scope,
    options
  );
  const preflightSignals = collectPreflightSignals(changedFiles, options);
  const context = buildContext(changedFiles, preflightSignals);
  const tasks = TASKS.map((task) =>
    buildTask(task, changedFiles, preflightSignals, context)
  ).filter((task) => task.matchedFiles.length > 0);

  const packageJson = applyTaskFilter(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      repoRoot,
      baseRef: options.staged ? null : options.base,
      mode: options.staged ? "staged" : "worktree",
      includeUntracked: options.includeUntracked,
      workflowEntry: {
        packagePath: outputPath,
        fromPackage: null,
        scopeFile: scope?.path ?? null,
        scopeQuery: scope?.query ?? null,
        scopeMode: scope ? options.scopeMode : null,
        scopeSelectionMode: scope?.selectionMode ?? null,
        scopeSummary: scope ? summarizeScope(scope, options.scopeMode) : null,
        recommendedNextStep:
          "Use the tasks array as the main-agent orchestration plan. Spawn explorer sub-agents according to spawnRecommendation."
      },
      diffCommands: buildDiffCommands(options),
      crossCuttingReasons: context.crossCuttingReasons,
      reviewScope: scope
        ? buildReviewScopeMetadata(scope, options.scopeMode)
        : null,
      changedFiles,
      preflightSignals,
      tasks,
      empty: tasks.length === 0
    },
    options.taskId
  );

  const output = renderOutput(packageJson, options.format);
  writeOrPrintOutput(output, outputPath);
}

function parseArgs(args) {
  const options = {
    base: "HEAD",
    staged: false,
    includeUntracked: true,
    format: "json",
    output: null,
    outputTemp: false,
    fromPackage: null,
    scopeFile: null,
    scopeMode: "auto",
    taskId: null,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--base") {
      options.base = requireValue(args, (index += 1), "--base");
    } else if (arg === "--staged") {
      options.staged = true;
    } else if (arg === "--no-untracked") {
      options.includeUntracked = false;
    } else if (arg === "--scope-file") {
      options.scopeFile = requireValue(args, (index += 1), "--scope-file");
    } else if (arg === "--scope-mode") {
      options.scopeMode = requireValue(args, (index += 1), "--scope-mode");
      if (!["auto", "static-only"].includes(options.scopeMode)) {
        throw new Error(`Unsupported --scope-mode: ${options.scopeMode}`);
      }
    } else if (arg === "--format") {
      options.format = requireValue(args, (index += 1), "--format");
      if (!["json", "markdown", "summary"].includes(options.format)) {
        throw new Error(`Unsupported --format: ${options.format}`);
      }
    } else if (arg === "--output") {
      options.output = requireValue(args, (index += 1), "--output");
    } else if (arg === "--output-temp") {
      options.outputTemp = true;
    } else if (arg === "--from-package") {
      options.fromPackage = requireValue(args, (index += 1), "--from-package");
    } else if (arg === "--task") {
      options.taskId = requireValue(args, (index += 1), "--task");
    } else {
      throw new Error(`Unknown option: ${arg}\n\n${USAGE}`);
    }
  }

  if (options.output && options.outputTemp) {
    throw new Error("--output and --output-temp cannot be used together");
  }

  return options;
}

function resolveOutputPath(options) {
  if (options.output) return resolve(options.output);
  if (!options.outputTemp) return null;

  const extension = options.format === "json" ? "json" : "md";
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
  return resolve(
    tmpdir(),
    `tutti-architecture-review-${timestamp}.${extension}`
  );
}

function readScopeFile(path) {
  const scopePath = resolve(path);
  const scopeJson = JSON.parse(readFileSync(scopePath, "utf8"));

  if (scopeJson.version !== 1) {
    throw new Error(`Unsupported review scope version: ${scopeJson.version}`);
  }
  if (!Array.isArray(scopeJson.scopes)) {
    throw new Error("Review scope must define a scopes array");
  }

  const scopes = scopeJson.scopes.map(normalizeScope).filter(Boolean);
  if (scopes.length === 0) {
    throw new Error("Review scope must contain at least one valid scope entry");
  }

  return {
    path: scopePath,
    query: String(scopeJson.query ?? "").trim(),
    keywords: Array.isArray(scopeJson.keywords)
      ? scopeJson.keywords
          .map((keyword) => String(keyword).trim())
          .filter(Boolean)
      : [],
    strategy: String(scopeJson.strategy ?? "").trim() || "scope-file",
    scopes,
    selectionMode: null
  };
}

function loadReviewRules(path) {
  const rules = JSON.parse(readFileSync(path, "utf8"));
  if (rules.version !== 1) {
    throw new Error(`Unsupported review rules version: ${rules.version}`);
  }
  if (!Array.isArray(rules.tasks) || !Array.isArray(rules.signals)) {
    throw new Error("Review rules must define tasks and signals arrays");
  }
  return rules;
}

function readTaskPackage(path) {
  const packagePath = resolve(path);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

  return {
    ...packageJson,
    workflowEntry: {
      ...(packageJson.workflowEntry ?? {}),
      packagePath: packageJson.workflowEntry?.packagePath ?? packagePath,
      fromPackage: packagePath,
      recommendedNextStep:
        packageJson.workflowEntry?.recommendedNextStep ??
        "Use the tasks array as the main-agent orchestration plan. Spawn explorer sub-agents according to spawnRecommendation."
    }
  };
}

function renderOutput(packageJson, format) {
  if (format === "markdown") return renderMarkdown(packageJson);
  if (format === "su
```

### Core Architecture Module: `.codex/skills/tutti-record-agent-session-replay/scripts/audit-cassette.mjs`
```
#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCassette } from "../../../../tools/scripts/agent-session-replay-runner/cassette.mjs";

const directory = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("usage: audit-cassette.mjs <cassette-directory>");
}

const repoRoot = await resolveRepoRoot();
const activityContract = await readJSON(
  join(
    repoRoot,
    "packages",
    "agent",
    "session-replay",
    "activity-contract.json"
  )
);
if (activityContract.schemaVersion !== 1) {
  throw new Error(
    `Unsupported activity contract schemaVersion ${activityContract.schemaVersion}, want 1`
  );
}

const manifest = await verifyCassette(directory);
const [providerManifest, frameText, activityText, expectedState] =
  await Promise.all([
    readJSON(join(directory, "provider", "manifest.json")),
    readFile(join(directory, "provider", "frames.jsonl"), "utf8"),
    readFile(join(directory, "activity-events.jsonl"), "utf8"),
    readJSON(join(directory, "expected-state.json"))
  ]);

const frames = parseJSONLines(frameText);
const activities = parseJSONLines(activityText);
assertContinuous(
  frames.map((frame) => frame.globalSeq),
  "Provider global sequence"
);
assertContinuous(
  activities.map((event) => event.sequence),
  "Activity sequence"
);
const causalityViolations = auditActivityCausality(
  activities,
  activityContract
);
if (causalityViolations.length > 0) {
  throw new Error(
    `Activity causality audit failed with ${causalityViolations.length} violation(s):\n` +
      causalityViolations.map((violation) => `- ${violation}`).join("\n")
  );
}
for (const connection of providerManifest.connections ?? []) {
  assertContinuous(
    frames
      .filter((frame) => frame.connectionId === connection.connectionId)
      .map((frame) => frame.chunkSeq),
    `Provider ${connection.connectionId} sequence`
  );
}

const sessions = expectedState.agent?.sessions ?? [];
const result = {
  cassette: {
    id: manifest.id,
    name: manifest.name,
    providerTarget: manifest.agentTargetId,
    mode: manifest.mode,
    schemaVersion: manifest.schemaVersion,
    totalBytes: manifest.totalBytes
  },
  provider: {
    status: providerManifest.status,
    frameCount: providerManifest.frameCount,
    actualFrameCount: frames.length,
    framesSha256: providerManifest.framesSha256,
    connections: (providerManifest.connections ?? []).map((connection) => ({
      connectionId: connection.connectionId,
      provider: connection.provider,
      launchOrdinal: connection.launchOrdinal,
      captureOrigin: connection.captureOrigin
    }))
  },
  activities: activities.map((event) => ({
    sequence: event.sequence,
    kind: event.kind,
    type: event.type,
    optionId: event.payload?.optionId ?? null,
    action: event.payload?.action ?? null,
    requestId: event.payload?.requestId ?? null
  })),
  causality: {
    contractSchemaVersion: activityContract.schemaVersion,
    intentCount: activities.filter((event) => event.kind === "intent").length,
    effectCount: activities.filter((event) => event.kind === "effect").length,
    directStimulusCount: activities.filter(
      (event) => event.kind === "direct-stimulus"
    ).length
  },
  state: {
    sessions: sessions.map((session) => ({
      id: session.id,
      turns: (session.turns ?? []).map((turn) => ({
        id: turn.id,
        phase: turn.phase,
        outcome: turn.outcome ?? null
      })),
      interactions: (session.interactions ?? []).map((interaction) => ({
        requestId: interaction.requestId,
        kind: interaction.kind,
        status: interaction.status,
        optionId: interaction.output?.optionId ?? null,
        action: interaction.output?.action ?? null
      })),
      tools: (session.messages ?? [])
        .filter((message) => message.kind === "tool_call")
        .map((message) => ({
          status: message.status,
          exitCode: message.payload?.output?.exitCode ?? null
        })),
      finalAssistantText:
        [...(session.messages ?? [])]
          .reverse()
          .find((message) => message.kind === "text")?.payload?.text ?? null
    }))
  }
};

if (
  providerManifest.status !== "complete" ||
  providerManifest.frameCount !== frames.length
) {
  throw new Error("Provider cassette is incomplete");
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseJSONLines(text) {
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

async function resolveRepoRoot() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const root = resolve(scriptDirectory, "../../../..");
  for (const marker of ["pnpm-workspace.yaml", "package.json"]) {
    try {
      await access(join(root, marker));
      return root;
    } catch {
      // try the next marker
    }
  }
  throw new Error(
    `Repository root not found at ${root} (missing pnpm-workspace.yaml/package.json)`
  );
}

function auditActivityCausality(activities, contract) {
  const violations = [];
  const intents = contract.intents ?? {};
  const eventsById = new Map(activities.map((event) => [event.eventId, event]));
  const referencedIntentIds = new Set();

  for (const event of activities) {
    if (event.kind === "direct-stimulus") {
      if (event.causedByEventId != null) {
        violations.push(
          `${describeEvent(event)}: direct-stimulus must not have causedByEventId ${event.causedByEventId}`
        );
      }
      continue;
    }
    if (event.kind === "intent") {
      if (!intents[event.type]) {
        violations.push(
          `${describeEvent(event)}: intent type is not declared in activity-contract.json`
        );
      }
      continue;
    }
    if (event.kind !== "effect") {
      continue;
    }
    if (event.causedByEventId == null) {
      violations.push(
        `${describeEvent(event)}: effect is missing causedByEventId`
      );
      continue;
    }
    const cause = eventsById.get(event.causedByEventId);
    if (!cause) {
      violations.push(
        `${describeEvent(event)}: causedByEventId ${event.causedByEventId} does not exist`
      );
      continue;
    }
    if (cause.kind !== "intent") {
      violations.push(
        `${describeEvent(event)}: causedByEventId ${event.causedByEventId} is kind ${cause.kind}, want intent`
      );
      continue;
    }
    referencedIntentIds.add(cause.eventId);
    if (cause.sequence >= event.sequence) {
      violations.push(
        `${describeEvent(event)}: cause sequence ${cause.sequence} is not earlier than effect`
      );
    }
    if (
      event.correlationId != null &&
      cause.correlationId != null &&
      event.correlationId !== cause.correlationId
    ) {
      violations.push(
        `${describeEvent(event)}: correlationId conflicts with cause correlationId ${cause.correlationId}`
      );
    }
    const declaredEffects = intents[cause.type]?.effects;
    if (declaredEffects && !declaredEffects.includes(event.type)) {
      violations.push(
        `${describeEvent(event)}: effect type is not declared for intent ${cause.type} (allowed: ${declaredEffects.join(", ") || "none"})`
      );
    }
  }

  for (const event of activities) {
    if (event.kind !== "intent") {
      continue;
    }
    if (
      intents[event.type]?.requiresEffect &&
      !referencedIntentIds.has(event.eventId)
    ) {
      violations.push(
        `${describeEvent(event)}: intent requires at least one effect but none references it`
      );
    }
  }

  return violations;
}

function describeEvent(event) {
  return (
    `sequence=${event.sequence ?? "?"} eventId=${event.eventId ?? "?"} ` +
    `kind=${event.kind ?? "?"} type=${event.type ?? "?"} ` +
    `correlationId=${event.correlatio
```

### Core Architecture Module: `apps/cli/cmd/tutti/main.go`
```
package main

import (
	"context"
	"os"

	"github.com/tutti-os/tutti/apps/cli/internal/app"
)

func main() {
	os.Exit(app.RunWithProgram(context.Background(), os.Args[0], os.Args[1:], os.Stdout, os.Stderr))
}

```

### Core Architecture Module: `apps/cli/internal/app/command_input.go`
```
package app

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/tutti-os/tutti/apps/cli/internal/daemon"
)

func parseCommandInput(command daemon.Capability, args []string) (map[string]any, error) {
	input, err := parseCommandArguments(command, args)
	if err != nil {
		return nil, err
	}
	return typedCommandInput(command.InputSchema, input), nil
}

func parseCommandArguments(command daemon.Capability, args []string) (map[string]any, error) {
	if input, ok, err := parsePositionalCommandInput(command, args); ok || err != nil {
		return input, err
	}
	return parseFlagCommandInput(command, args)
}

// typedCommandInput restores the JSON types the advertised input schema
// declares. Terminal arguments always arrive as text, and the daemon validates
// invocation input against that schema before a command binds it, so a numeric
// or boolean flag has to leave the CLI as a JSON number or boolean rather than
// a quoted string.
//
// Values that do not parse are forwarded untouched: rejecting them here would
// duplicate daemon-owned validation, and the daemon already reports the
// authoritative error for the declared type.
func typedCommandInput(schema map[string]any, input map[string]any) map[string]any {
	if len(input) == 0 {
		return input
	}
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return input
	}
	for name, value := range input {
		text, isText := value.(string)
		if !isText {
			continue
		}
		property, declared := properties[name]
		if !declared {
			continue
		}
		if typed, ok := schemaTypedValue(schemaPropertyType(property), text); ok {
			input[name] = typed
		}
	}
	return input
}

func schemaTypedValue(propertyType string, value string) (any, bool) {
	value = strings.TrimSpace(value)
	switch propertyType {
	case "integer":
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return nil, false
		}
		return parsed, true
	case "number":
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return nil, false
		}
		return parsed, true
	case "boolean":
		// Mirrors the daemon input binder, which has always accepted these
		// spellings for boolean flags.
		switch strings.ToLower(value) {
		case "1", "true", "yes", "on":
			return true, true
		case "0", "false", "no", "off":
			return false, true
		default:
			return nil, false
		}
	default:
		return nil, false
	}
}

func parseFlagCommandInput(command daemon.Capability, args []string) (map[string]any, error) {
	booleanFlags := commandBooleanFlags(command.InputSchema)
	arrayFlags := commandArrayFlags(command.InputSchema)
	input := map[string]any{}
	for index := 0; index < len(args); index++ {
		arg := args[index]
		if !strings.HasPrefix(arg, "--") {
			return nil, fmt.Errorf("unexpected argument %q", arg)
		}
		nameValue := strings.TrimPrefix(arg, "--")
		name, value, found := strings.Cut(nameValue, "=")
		if !found {
			if index+1 >= len(args) || strings.HasPrefix(args[index+1], "--") {
				if !booleanFlags[name] {
					return nil, fmt.Errorf("missing value for --%s", name)
				}
				input[name] = true
				continue
			} else {
				index++
				value = args[index]
			}
		}
		if strings.TrimSpace(name) == "" {
			return nil, fmt.Errorf("invalid flag %q", arg)
		}
		if existing, ok := input[name]; ok {
			switch typed := existing.(type) {
			case []string:
				input[name] = append(typed, value)
			case string:
				input[name] = []string{typed, value}
			default:
				input[name] = value
			}
			continue
		}
		if arrayFlags[name] {
			input[name] = []string{value}
			continue
		}
		input[name] = value
	}
	return input, nil
}

func commandBooleanFlags(schema map[string]any) map[string]bool {
	flags := map[string]bool{}
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return flags
	}
	for name, property := range properties {
		if schemaPropertyType(property) == "boolean" {
			flags[name] = true
		}
	}
	return flags
}

func commandArrayFlags(schema map[string]any) map[string]bool {
	flags := map[string]bool{}
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return flags
	}
	for name, property := range properties {
		if schemaPropertyType(property) == "array" {
			flags[name] = true
		}
	}
	return flags
}

func parsePositionalCommandInput(command daemon.Capability, args []string) (map[string]any, bool, error) {
	switch command.ID {
	case "agent-context.agent.open":
		if len(args) != 1 || strings.HasPrefix(args[0], "--") {
			return nil, false, nil
		}
		return map[string]any{"session-id": args[0]}, true, nil
	case "agent-context.agent.send":
		if len(args) < 2 || strings.HasPrefix(args[0], "--") {
			return nil, false, nil
		}
		if flagIndex := firstKnownFlagIndex(command.InputSchema, args[1:]); flagIndex >= 0 {
			input, err := parseFlagCommandInput(command, args[1+flagIndex:])
			if err != nil {
				return nil, true, err
			}
			if flagIndex > 0 {
				input["prompt"] = strings.Join(args[1:1+flagIndex], " ")
			}
			input["session-id"] = args[0]
			return input, true, nil
		}
		return map[string]any{
			"session-id": args[0],
			"prompt":     strings.Join(args[1:], " "),
		}, true, nil
	default:
		return nil, false, nil
	}
}

func firstKnownFlagIndex(schema map[string]any, args []string) int {
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return -1
	}
	for index, arg := range args {
		if !strings.HasPrefix(arg, "--") {
			continue
		}
		nameValue := strings.TrimPrefix(arg, "--")
		name, _, _ := strings.Cut(nameValue, "=")
		if _, ok := properties[name]; ok {
			return index
		}
	}
	return -1
}

type commandFlag struct {
	Name        string
	Type        string
	Description string
	Required    bool
	Values      []string
	Default     string
	HasDefault  bool
}

func commandFlags(schema map[string]any) []commandFlag {
	properties, ok := schema["properties"].(map[string]any)
	if !ok || len(properties) == 0 {
		return nil
	}
	requiredNames := schemaRequiredNames(schema)
	required := map[string]bool{}
	for _, name := range requiredNames {
		required[name] = true
	}

	flags := make([]commandFlag, 0, len(properties))
	for _, name := range requiredNames {
		property, ok := properties[name]
		if !ok {
			continue
		}
		flags = append(flags, commandFlag{
			Name:        name,
			Type:        schemaPropertyType(property),
			Description: schemaPropertyDescription(property),
			Required:    true,
			Values:      schemaPropertyEnumValues(property),
			Default:     schemaPropertyDefault(property),
			HasDefault:  schemaPropertyHasDefault(property),
		})
	}

	optionalNames := make([]string, 0, len(properties))
	for name := range properties {
		if !required[name] {
			optionalNames = append(optionalNames, name)
		}
	}
	sort.Strings(optionalNames)
	for _, name := range optionalNames {
		flags = append(flags, commandFlag{
			Name:        name,
			Type:        schemaPropertyType(properties[name]),
			Description: schemaPropertyDescription(properties[name]),
			Values:      schemaPropertyEnumValues(properties[name]),
			Default:     schemaPropertyDefault(properties[name]),
			HasDefault:  schemaPropertyHasDefault(properties[name]),
		})
	}
	return flags
}

func schemaRequiredNames(schema map[string]any) []string {
	value, ok := schema["required"]
	if !ok {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		names := make([]string, 0, len(typed))
		for _, entry := range typed {
			name, ok := entry.(string)
			if ok {
				names = append(names, name)
			}
		}
		return names
	default:
		return nil
	}
}

func schemaPropertyType(property any) string {
	propertyMap, ok := property.(map[string]any)
	if !ok {
		return "value"
	}
	typeName, ok := propertyMap["type"].(string)
	if !ok || strings.TrimSpace(typeName) == "" {
		return "value"
	}
	return typeName
}

func schemaPropertyDescription(property any) string {
	propertyMap, ok := property.(map[string]any)
	if !ok {
		return ""
	}
	description, o
```

### Core Architecture Module: `apps/cli/internal/app/errors.go`
```
package app

import (
	"fmt"
	"io"
	"strings"

	"github.com/tutti-os/tutti/apps/cli/internal/daemon"
)

const (
	reasonCommandNotFound      = "command_not_found"
	reasonCommandOutputMissing = "command_output_missing"
	reasonDaemonRequestFailed  = "daemon_request_failed"
	reasonDaemonUnavailable    = "daemon_unavailable"
	reasonInvalidInput         = "invalid_input"
)

type cliErrorEnvelope struct {
	Error cliErrorDetails `json:"error"`
}

type cliErrorDetails struct {
	ReasonCode    string `json:"reasonCode"`
	Message       string `json:"message"`
	Retryable     bool   `json:"retryable,omitempty"`
	CorrelationID string `json:"correlationId,omitempty"`
}

func jsonRequested(args []string) bool {
	for _, arg := range args {
		if arg == "--json" {
			return true
		}
	}
	return false
}

func writeCLIError(
	stdout io.Writer,
	stderr io.Writer,
	jsonOutput bool,
	prefix string,
	reasonCode string,
	err error,
	exitCode int,
) int {
	message := strings.TrimSpace(errorMessage(err))
	if jsonOutput {
		details := cliErrorDetails{
			ReasonCode: strings.TrimSpace(reasonCode),
			Message:    message,
		}
		if daemonDetails, ok := daemon.RequestErrorDetails(err); ok {
			if daemonDetails.ReasonCode != "" {
				details.ReasonCode = daemonDetails.ReasonCode
			}
			if daemonDetails.Message != "" {
				details.Message = daemonDetails.Message
			}
			details.Retryable = daemonDetails.Retryable
			details.CorrelationID = daemonDetails.CorrelationID
		}
		if details.ReasonCode == "" {
			details.ReasonCode = reasonInvalidInput
		}
		if details.Message == "" {
			details.Message = details.ReasonCode
		}
		if code := writeJSON(stdout, stderr, cliErrorEnvelope{Error: details}); code != 0 {
			return code
		}
		return exitCode
	}
	if prefix == "" {
		fmt.Fprintln(stderr, message)
	} else {
		fmt.Fprintf(stderr, "%s: %s\n", strings.TrimSpace(prefix), message)
	}
	return exitCode
}

func daemonErrorExitCode(err error) int {
	details, ok := daemon.RequestErrorDetails(err)
	if ok && details.StatusCode == 400 {
		return 2
	}
	return 1
}

func errorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

```

### Core Architecture Module: `apps/cli/internal/app/managed_model.go`
```
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/tutti-os/tutti/apps/cli/internal/daemon"
)

const managedModelInputLimitBytes = 64 * 1024

const (
	managedModelExchangeCommandID   = "managed-model.grant.exchange"
	managedModelModelsCommandID     = "managed-model.models"
	managedModelCredentialCommandID = "managed-model.credential"
	managedModelRevokeCommandID     = "managed-model.revoke"
)

var managedModelInputReader = func() io.Reader { return os.Stdin }

type managedModelExchangeInput struct {
	ContextToken string `json:"contextToken"`
	GrantCode    string `json:"grantCode"`
	Nonce        string `json:"nonce"`
	State        string `json:"state"`
}

type managedModelGrantRefInput struct {
	GrantRef string `json:"grantRef"`
}

type managedModelCredentialInput struct {
	Capability string `json:"capability"`
	GrantRef   string `json:"grantRef"`
	Model      string `json:"model"`
	Provider   string `json:"provider"`
}

func runManagedModel(ctx context.Context, commandName string, opts options, args []string, stdout io.Writer, stderr io.Writer) int {
	commandID, input, err := parseManagedModelInput(args)
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, commandName+" managed-model", reasonInvalidInput, err, 2)
	}
	client, err := discoverClient()
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, commandName+" managed-model", reasonDaemonUnavailable, err, 1)
	}
	response, err := client.Invoke(ctx, commandID, daemon.InvokeRequest{
		Input:      input,
		OutputMode: "json",
		Context:    cliInvokeContextFromEnv(),
	})
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, commandName+" managed-model", reasonDaemonRequestFailed, err, daemonErrorExitCode(err))
	}
	if response.Output == nil {
		return writeCLIError(
			stdout, stderr, opts.json, commandName+" managed-model", reasonCommandOutputMissing,
			fmt.Errorf("command returned no output"), 1,
		)
	}
	return writeDynamicJSON(stdout, stderr, *response.Output)
}

func parseManagedModelInput(args []string) (string, map[string]any, error) {
	commandID, payloadArgs, err := managedModelCommand(args)
	if err != nil {
		return "", nil, err
	}
	if len(payloadArgs) != 2 || payloadArgs[0] != "--input-json" || payloadArgs[1] != "-" {
		return "", nil, fmt.Errorf("usage: managed-model %s --input-json -", strings.Join(args[:len(args)-len(payloadArgs)], " "))
	}
	switch commandID {
	case managedModelExchangeCommandID:
		var input managedModelExchangeInput
		if err := decodeManagedModelInput(&input); err != nil {
			return "", nil, err
		}
		normalized, err := requiredManagedModelFields(map[string]any{
			"contextToken": input.ContextToken,
			"grantCode":    input.GrantCode,
			"nonce":        input.Nonce,
			"state":        input.State,
		})
		return commandID, normalized, err
	case managedModelModelsCommandID, managedModelRevokeCommandID:
		var input managedModelGrantRefInput
		if err := decodeManagedModelInput(&input); err != nil {
			return "", nil, err
		}
		normalized, err := requiredManagedModelFields(map[string]any{"grantRef": input.GrantRef})
		return commandID, normalized, err
	case managedModelCredentialCommandID:
		var input managedModelCredentialInput
		if err := decodeManagedModelInput(&input); err != nil {
			return "", nil, err
		}
		normalized, err := requiredManagedModelFields(map[string]any{
			"capability": input.Capability,
			"grantRef":   input.GrantRef,
			"model":      input.Model,
			"provider":   input.Provider,
		})
		return commandID, normalized, err
	default:
		return "", nil, fmt.Errorf("unsupported managed-model command")
	}
}

func managedModelCommand(args []string) (string, []string, error) {
	if len(args) >= 2 && args[0] == "grant" && args[1] == "exchange" {
		return managedModelExchangeCommandID, args[2:], nil
	}
	if len(args) >= 1 && args[0] == "models" {
		return managedModelModelsCommandID, args[1:], nil
	}
	if len(args) >= 1 && args[0] == "credential" {
		return managedModelCredentialCommandID, args[1:], nil
	}
	if len(args) >= 1 && args[0] == "revoke" {
		return managedModelRevokeCommandID, args[1:], nil
	}
	return "", nil, fmt.Errorf("expected grant exchange, models, credential, or revoke")
}

func decodeManagedModelInput(target any) error {
	reader := io.LimitReader(managedModelInputReader(), managedModelInputLimitBytes+1)
	content, err := io.ReadAll(reader)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}
	if len(content) > managedModelInputLimitBytes {
		return fmt.Errorf("input exceeds %d bytes", managedModelInputLimitBytes)
	}
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid input JSON: %w", err)
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return fmt.Errorf("input must contain exactly one JSON object")
	}
	return nil
}

func requiredManagedModelFields(input map[string]any) (map[string]any, error) {
	for key, value := range input {
		text, ok := value.(string)
		if !ok || strings.TrimSpace(text) == "" {
			return nil, fmt.Errorf("%s is required", key)
		}
		input[key] = strings.TrimSpace(text)
	}
	return input, nil
}

```

### Core Architecture Module: `apps/cli/internal/app/run.go`
```
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/tutti-os/tutti/apps/cli/internal/daemon"
	"github.com/tutti-os/tutti/apps/cli/internal/defaults"
)

const prefixHelpGroupPreviewLimit = 5
const dynamicStdinInputLimitBytes = 1024 * 1024

var dynamicInputReader = func() io.Reader { return os.Stdin }

type options struct {
	json bool
}

func RunWithProgram(ctx context.Context, program string, args []string, stdout io.Writer, stderr io.Writer) int {
	commandName := displayCommandName(program)
	opts, rest, err := parseOptions(args)
	if err != nil {
		return writeCLIError(stdout, stderr, jsonRequested(args), "", reasonInvalidInput, err, 2)
	}
	if len(rest) == 0 || rest[0] == "help" || rest[0] == "--help" || rest[0] == "-h" {
		return runHelp(ctx, commandName, stdout)
	}

	switch rest[0] {
	case "status":
		if len(rest) != 1 {
			return writeCLIError(
				stdout, stderr, opts.json, "", reasonInvalidInput,
				fmt.Errorf("usage: %s status [--json]", commandName), 2,
			)
		}
		return runStatus(ctx, commandName, opts, stdout, stderr)
	case "managed-model":
		return runManagedModel(ctx, commandName, opts, rest[1:], stdout, stderr)
	default:
		return runDynamic(ctx, commandName, opts, rest, stdout, stderr)
	}
}

func displayCommandName(program string) string {
	name := filepath.Base(strings.TrimSpace(program))
	if name == "." || name == "" {
		name = "tutti"
	}
	if strings.EqualFold(name, "tutti") && isDevelopmentCLI(program) {
		return "tutti-dev"
	}
	return name
}

func isDevelopmentCLI(program string) bool {
	cleanProgram := filepath.Clean(program)
	devBuildSegment := "build" + string(filepath.Separator) + "dev" + string(filepath.Separator)
	if strings.HasPrefix(cleanProgram, devBuildSegment) ||
		strings.Contains(cleanProgram, string(filepath.Separator)+devBuildSegment) {
		return true
	}
	return defaults.ResolveDefaultsFromEnv().Runtime.Env == "development"
}

func parseOptions(args []string) (options, []string, error) {
	var opts options
	rest := make([]string, 0, len(args))
	for _, arg := range args {
		switch arg {
		case "--json":
			opts.json = true
		default:
			rest = append(rest, arg)
		}
	}
	return opts, rest, nil
}

func runStatus(ctx context.Context, commandName string, opts options, stdout io.Writer, stderr io.Writer) int {
	client, err := discoverClient()
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, commandName+" status", reasonDaemonUnavailable, err, 1)
	}
	health, err := client.GetHealth(ctx)
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, commandName+" status", reasonDaemonRequestFailed, err, daemonErrorExitCode(err))
	}

	if opts.json {
		return writeJSON(stdout, stderr, health)
	}

	fmt.Fprintf(stdout, "service: %s\nstatus: %s\n", health.Service, health.Status)
	return 0
}

func runDynamic(ctx context.Context, commandName string, opts options, args []string, stdout io.Writer, stderr io.Writer) int {
	invocationPrefix := strings.TrimSpace(commandName + " " + strings.Join(args, " "))
	client, err := discoverClient()
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, invocationPrefix, reasonDaemonUnavailable, err, 1)
	}
	invokeContext := cliInvokeContextFromEnv()
	capabilities, err := client.ListCapabilitiesForWorkspaceWithOptions(ctx, invokeContext.WorkspaceID, daemon.CapabilityListOptions{
		IncludeIntegration: includeIntegrationCapabilitiesFromEnv(),
		AgentSessionID:     invokeContext.AgentSessionID,
	})
	if err != nil {
		return writeCLIError(stdout, stderr, opts.json, invocationPrefix, reasonDaemonRequestFailed, err, daemonErrorExitCode(err))
	}
	command, commandArgs, ok := matchCapability(capabilities.Commands, args)
	if !ok && legacyAgentCompatibilityInvocation(args) && !includeIntegrationCapabilitiesFromEnv() {
		compatibilities, listErr := client.ListCapabilitiesForWorkspaceWithOptions(ctx, invokeContext.WorkspaceID, daemon.CapabilityListOptions{
			IncludeIntegration: true,
			AgentSessionID:     invokeContext.AgentSessionID,
		})
		if listErr == nil {
			command, commandArgs, ok = matchCapability(compatibilities.Commands, args)
		}
	}
	if !ok {
		if prefix, help := commandHelpPrefix(args); help {
			if printCommandPrefixHelp(stdout, commandName, prefix, capabilities.Commands) {
				return 0
			}
		}
		if !opts.json && printCommandPrefixHelp(stdout, commandName, args, capabilities.Commands) {
			return 2
		}
		return writeCLIError(
			stdout, stderr, opts.json, "", reasonCommandNotFound,
			fmt.Errorf("unknown command: %s", strings.Join(args, " ")), 2,
		)
	}
	if isCommandHelpRequest(commandArgs) {
		printDynamicCommandHelp(stdout, commandName, command)
		return 0
	}
	waitOptions, commandArgs, err := parseWaitOptions(command, commandArgs)
	if err != nil {
		prefix := strings.TrimSpace(commandName + " " + strings.Join(command.Path, " "))
		return writeCLIError(stdout, stderr, opts.json, prefix, reasonInvalidInput, err, 2)
	}
	input, err := parseCommandInput(command, commandArgs)
	if err != nil {
		prefix := strings.TrimSpace(commandName + " " + strings.Join(command.Path, " "))
		return writeCLIError(stdout, stderr, opts.json, prefix, reasonInvalidInput, err, 2)
	}
	input, err = hydrateDynamicStdinInput(command, input)
	if err != nil {
		prefix := strings.TrimSpace(commandName + " " + strings.Join(command.Path, " "))
		return writeCLIError(stdout, stderr, opts.json, prefix, reasonInvalidInput, err, 2)
	}
	outputMode := command.Output.DefaultMode
	if opts.json {
		outputMode = "json"
	}
	response, err := invokeDynamicCommand(ctx, client, command, daemon.InvokeRequest{
		Input:      input,
		OutputMode: outputMode,
		Context:    invokeContext,
	}, waitOptions)
	if err != nil {
		prefix := strings.TrimSpace(commandName + " " + strings.Join(command.Path, " "))
		return writeCLIError(stdout, stderr, opts.json, prefix, reasonDaemonRequestFailed, err, daemonErrorExitCode(err))
	}
	if response.Output == nil {
		return 0
	}
	if opts.json {
		return writeDynamicJSON(stdout, stderr, *response.Output)
	}
	return writeCommandOutput(stdout, stderr, *response.Output)
}

func hydrateDynamicStdinInput(command daemon.Capability, input map[string]any) (map[string]any, error) {
	value, _ := input["arguments-json"].(string)
	if strings.TrimSpace(value) != "-" {
		return input, nil
	}
	properties, _ := command.InputSchema["properties"].(map[string]any)
	if properties["arguments-json"] == nil {
		return nil, fmt.Errorf("--arguments-json - is not supported by this command")
	}
	content, err := io.ReadAll(io.LimitReader(dynamicInputReader(), dynamicStdinInputLimitBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read standard input: %w", err)
	}
	if len(content) > dynamicStdinInputLimitBytes {
		return nil, fmt.Errorf("standard input exceeds %d bytes", dynamicStdinInputLimitBytes)
	}
	if strings.TrimSpace(string(content)) == "" {
		return nil, fmt.Errorf("standard input must contain one JSON object")
	}
	next := make(map[string]any, len(input))
	for key, value := range input {
		next[key] = value
	}
	next["arguments-json"] = string(content)
	return next, nil
}

func legacyAgentCompatibilityInvocation(args []string) bool {
	if len(args) < 2 {
		return false
	}
	path := strings.Join(args[:2], " ")
	return path == "agent providers" || path == "agent cancel" || path == "agent session-summary" ||
		path == "codex start" || path == "claude start"
}

func runHelp(ctx context.Context, commandName string, stdout io.Writer) int {
	var commands []daemon.Capability
	client, err := discoverClient()
	if err == nil {
		invokeContext := cliInvokeContextFromEnv()
		capabilities, listErr := client.ListCapabilitiesForWorkspaceWithOptions(ctx, invokeContext.WorkspaceID, daemon.CapabilityListOptions{
			IncludeIntegration: includeIntegrationCapabilitiesFromEnv(),
			AgentSessionID:     invokeContext.AgentSessionID,
		})
		if listErr == nil {
			commands = capabilities.Commands
		}
	}
	printHelp(stdout, commandName, commands)
	return 0
}

func includ
```

### Core Architecture Module: `apps/cli/internal/app/wait.go`
```
package app

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tutti-os/tutti/apps/cli/internal/daemon"
)

const appHandlerRequestTimeoutMargin = 30 * time.Second

type waitOptions struct {
	timeout time.Duration
	set     bool
}

func isWaitCommand(command daemon.Capability) bool {
	return command.Execution != nil && command.Execution.Mode == "wait"
}

func waitCommandFlags(command daemon.Capability, flags []commandFlag) []commandFlag {
	if !isWaitCommand(command) {
		return flags
	}
	for _, flag := range flags {
		if flag.Name == "timeout-ms" {
			return flags
		}
	}
	return append(flags, commandFlag{
		Name: "timeout-ms", Type: "integer",
		Description: "Maximum total wait in milliseconds; omit to wait until the command reaches a stop point.",
	})
}

func parseWaitOptions(command daemon.Capability, args []string) (waitOptions, []string, error) {
	if !isWaitCommand(command) {
		return waitOptions{}, args, nil
	}
	filtered := make([]string, 0, len(args))
	var options waitOptions
	for index := 0; index < len(args); index++ {
		arg := args[index]
		if arg != "--timeout-ms" && !strings.HasPrefix(arg, "--timeout-ms=") {
			filtered = append(filtered, arg)
			continue
		}
		if options.set {
			return waitOptions{}, nil, errors.New("--timeout-ms may only be provided once")
		}
		value := ""
		if _, inline, found := strings.Cut(arg, "="); found {
			value = inline
		} else {
			if index+1 >= len(args) || strings.HasPrefix(args[index+1], "--") {
				return waitOptions{}, nil, errors.New("missing value for --timeout-ms")
			}
			index++
			value = args[index]
		}
		milliseconds, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil || milliseconds <= 0 || milliseconds > int64(^uint64(0)>>1)/int64(time.Millisecond) {
			return waitOptions{}, nil, fmt.Errorf("invalid --timeout-ms value %q: expected a positive integer", value)
		}
		options = waitOptions{timeout: time.Duration(milliseconds) * time.Millisecond, set: true}
	}
	return options, filtered, nil
}

func invokeDynamicCommand(
	ctx context.Context,
	client *daemon.Client,
	command daemon.Capability,
	request daemon.InvokeRequest,
	options waitOptions,
) (daemon.InvokeResponse, error) {
	if !isWaitCommand(command) {
		return invokeOnce(ctx, client, command, request)
	}

	waitCtx := ctx
	var cancel context.CancelFunc
	if options.set {
		waitCtx, cancel = context.WithTimeout(ctx, options.timeout)
		defer cancel()
	}

	var lastOutput *daemon.CommandOutput
	for {
		response, err := invokeOnce(waitCtx, client, command, request)
		if err != nil {
			if options.set && errors.Is(waitCtx.Err(), context.DeadlineExceeded) {
				return waitTimedOutResponse(lastOutput), nil
			}
			return daemon.InvokeResponse{}, err
		}
		if response.Output == nil || response.Output.Continuation == nil {
			return response, nil
		}
		lastOutput = response.Output
		delay := time.Duration(response.Output.Continuation.RetryAfterMs) * time.Millisecond
		timer := time.NewTimer(delay)
		select {
		case <-waitCtx.Done():
			timer.Stop()
			if options.set && errors.Is(waitCtx.Err(), context.DeadlineExceeded) {
				return waitTimedOutResponse(lastOutput), nil
			}
			return daemon.InvokeResponse{}, waitCtx.Err()
		case <-timer.C:
		}
	}
}

func invokeOnce(ctx context.Context, client *daemon.Client, command daemon.Capability, request daemon.InvokeRequest) (daemon.InvokeResponse, error) {
	if command.HandlerTimeoutMs <= 0 {
		return client.Invoke(ctx, command.ID, request)
	}
	timeout := time.Duration(command.HandlerTimeoutMs)*time.Millisecond + appHandlerRequestTimeoutMargin
	return client.InvokeWithTimeout(ctx, command.ID, request, timeout)
}

func waitTimedOutResponse(lastOutput *daemon.CommandOutput) daemon.InvokeResponse {
	value := map[string]any{
		"reason":             "wait_timeout",
		"timedOut":           true,
		"executionContinues": true,
	}
	if lastOutput != nil {
		switch {
		case len(lastOutput.Value) > 0:
			value["lastResult"] = lastOutput.Value
		case lastOutput.Rows != nil:
			value["lastResult"] = lastOutput.Rows
		case strings.TrimSpace(lastOutput.Text) != "":
			value["lastResult"] = lastOutput.Text
		}
	}
	return daemon.InvokeResponse{
		OK:     true,
		Output: &daemon.CommandOutput{Kind: "json", Value: value},
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #440** (2026-07-01): **Card counts do not update after searching in Daily Product Radar**
  *Symptoms*: ## Summary After searching in Daily Product Radar, the card counts do not update to match the filtered results.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Daily Product Radar. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Daily Product Radar should complete the workflow without the problem described above.  ## Actual behavior After searching in Daily Product Radar, the card counts do not update to match the filtered results.  ## Affected area Daily Product Radar  ## Platform Desktop app  ## Additional context - Priority: P2 - Affected area: Daily Product Radar - Platform: Desktop app - Public screenshots/videos:   - ![Screenshot 1](https://github.com/tutti-os/tutti-issue-assets/releases/download/feishu-p2-bugs-2026-06-27/issue-440-1-C1GebmZ79oTvgzxWLKpc6Izonwf.jpg) 
  **Post-Mortem & Fix Analysis**:
  > Verified against the latest published Daily Product Radar package (`0.0.34`, gitSha `59879680ff8bab4fec9dd10a356a7b157d71d6d3`). I could not reproduce the stale category-chip counts on the latest package.  Repro check: - Opened Daily Product Radar for `2026-06-13`, matching the screenshot metrics: `6` Product Hunt launches / `14` GitHub repos / `80%` AI related. - Searched for `firec`. - The card list narrowed to one card: `Prometheus by Firecrawl`. - Category chips updated to the filtered result set: `AI 1`, `AI代理 1`, `图像生成 1`, `开发工具 1`, `内容创作 1`. - The hero signal metrics stayed global by design.  This looks like either an older installed/cached app package, or the known product distinction where hero metrics remain global while category chips follow the current query.  Recording: https://github.com/superche/tutti-apps/releases/download/issue-440-verification-assets/issue-440-latest-0.0.34-2026-06-13-firec.mp4 

- **Issue #431** (2026-06-29): **Queued messages can overflow conversation details without a scrollbar**
  *Symptoms*: ## Summary When too many messages are queued, conversation details can overflow without a scrollbar.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Agent GUI. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Agent GUI should complete the workflow without the problem described above.  ## Actual behavior When too many messages are queued, conversation details can overflow without a scrollbar.  ## Affected area Agent GUI  ## Platform Desktop app  ## Additional context - Priority: P2 - Affected area: Agent GUI - Platform: Desktop app - Public screenshots/videos:   - ![Screenshot 1](https://github.com/tutti-os/tutti-issue-assets/releases/download/feishu-p2-bugs-2026-06-27/issue-431-1-L6gJbQjyToXpB7xYNz9cKirqnR0.png) 

- **Issue #421** (2026-07-01): **Long file paths are truncated in Agent GUI**
  *Symptoms*: ## Summary Long file paths in Agent GUI are truncated and cannot be read clearly.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Agent GUI. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Agent GUI should complete the workflow without the problem described above.  ## Actual behavior Long file paths in Agent GUI are truncated and cannot be read clearly.  ## Affected area Agent GUI  ## Platform Desktop app  ## Additional context - Priority: P2 - Affected area: Agent GUI - Platform: Desktop app - Public screenshots/videos:   - ![Screenshot 1](https://github.com/tutti-os/tutti-issue-assets/releases/download/feishu-p2-bugs-2026-06-27/issue-421-1-Ep5EbwviZoWoxNxNLPtcVs8vnSb.png) 
  **Post-Mortem & Fix Analysis**:
  > <img width="1756" height="1260" alt="Image" src="https://github.com/user-attachments/assets/acbb9e9f-8f87-41a7-8498-cb1a0562d929" />看起来这个问题已经修复？   没复现出来  
  > @dengbiao 感谢确认！PR #477 (fix(agent-gui): wrap long file paths instead of truncating) 确实修复了这个问题。修复方案是改用 `overflow-wrap: anywhere` + `word-break: break-word` 替代原来的 ellipsis 截断，这样长路径在容器边界处自然换行而不是被裁切。已通过 check:full，mergerable 状态。如还有 edge case 复现，随时同步。

- **Issue #236** (2026-06-20): **Personal desktop issue needs a clearer problem description**
  *Symptoms*: ## Summary Personal desktop issue needs a clearer problem description.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to the affected workflow once more details are available. 3. Capture the exact interaction that reproduces the issue.  ## Expected behavior The issue should include enough public reproduction detail for a maintainer or contributor to investigate it.  ## Actual behavior The current report does not include enough public reproduction detail yet.  ## Affected area Unspecified  ## Platform Desktop app  ## Additional context - Priority: UNTRIAGED - Affected area: Unspecified - Platform: Desktop app - Public screenshots or logs: not attached yet

- **Issue #235** (2026-06-20): **Personal desktop issue needs reproduction details**
  *Symptoms*: ## Summary Personal desktop issue needs reproduction details.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to the affected workflow once more details are available. 3. Capture the exact interaction that reproduces the issue.  ## Expected behavior The issue should include enough public reproduction detail for a maintainer or contributor to investigate it.  ## Actual behavior The current report does not include enough public reproduction detail yet.  ## Affected area Unspecified  ## Platform Desktop app  ## Additional context - Priority: UNTRIAGED - Affected area: Unspecified - Platform: Desktop app - Public screenshots or logs: not attached yet

- **Issue #234** (2026-06-27): **Onboarding app does not open by default and binding an agent does not respond**
  *Symptoms*: ## Summary Onboarding app does not open by default and binding an agent does not respond.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Unspecified. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Unspecified should complete the workflow without the problem described above.  ## Actual behavior Onboarding app does not open by default and binding an agent does not respond.  ## Affected area Unspecified  ## Platform Desktop app  ## Additional context - Priority: P0 - Affected area: Unspecified - Platform: Desktop app - Public screenshots or logs: not attached yet

- **Issue #233** (2026-06-24): **Card counts do not update after searching in Daily Product Radar**
  *Symptoms*: ## Summary Card counts do not update after searching in Daily Product Radar.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Daily Product Radar. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Daily Product Radar should complete the workflow without the problem described above.  ## Actual behavior Card counts do not update after searching in Daily Product Radar.  ## Affected area Daily Product Radar  ## Platform Desktop app  ## Additional context - Priority: P2 - Affected area: Daily Product Radar - Platform: Desktop app - Public screenshots or logs: not attached yet - Contributor note: this appears suitable for a focused first contribution if the reproduction path is confirmed.
  **Post-Mortem & Fix Analysis**:
  > Reproduced and fixed in https://github.com/tutti-os/tutti-apps/pull/55.  Scope clarified: - The hero signal metrics stay global for the daily signal set. - Category chips now update with the current source + search query.  Validation: - `pnpm --filter @tutti-apps/daily-tech-radar test` - `pnpm --filter @tutti-apps/daily-tech-radar typecheck` - `pnpm --filter @tutti-apps/daily-tech-radar i18n:check` - `pnpm package:tutti --app daily-tech-radar`  I also verified the fix with an automated browser recording: after searching, cards and category chips update to the query-scoped result set, while the global daily signal metrics remain unchanged.  https://github.com/user-attachments/assets/479d146a-51c9-46fb-afdb-946521f3ed78
  > Fixed by tutti-os/tutti-apps#55, which updates Daily Product Radar category chips to follow the current source + search query scope while keeping the hero signal metrics global.

- **Issue #232** (2026-06-27): **Browser should support multiple links as tabs within one window instead of one window per link**
  *Symptoms*: ## Summary Browser should support multiple links as tabs within one window instead of one window per link.  ## Steps to reproduce 1. Open Tutti desktop. 2. Navigate to Browser. 3. Perform the workflow described in the summary. 4. Observe the incorrect behavior.  ## Expected behavior Browser should complete the workflow without the problem described above.  ## Actual behavior Browser should support multiple links as tabs within one window instead of one window per link.  ## Affected area Browser  ## Platform Desktop app  ## Additional context - Priority: P2 - Affected area: Browser - Platform: Desktop app - Public screenshots or logs: not attached yet

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

### Incident Patch 1: `8821cf47` (2026-09-05)
**Commit Message**: fix(agent): require current Codex CLI (#2643)

* fix(agent): require current Codex CLI

Signed-off-by: jomeswang <1551403343@qq.com>

* test(agent): use supported Codex fixtures

Signed-off-by: jomeswang <1551403343@qq.com>

---------

Signed-off-by: jomeswang <1551403343@qq.com>

**File**: `.changeset/agent-codex-version-floor.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 "@tutti-os/desktop": patch
 ---
 
-Lower the minimum supported Codex version to 0.126.0. The floor is now capability-derived — 0.126.0 is the release that introduced the newest app-server method our codex runtime integrates — instead of an arbitrary "latest at the time" value.
+Raise the minimum supported Codex version to 0.153.4 so outdated clients rejected by the upstream service are routed through Tutti's upgrade flow before starting a model request.
```

**File**: `.github/workflows/windows-agent-adapters.yml` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ jobs:
         run: |
           $ErrorActionPreference = 'Stop'
           $contractRoot = Join-Path $env:RUNNER_TEMP 'tutti-codex-contract'
-          npm install --prefix $contractRoot --no-save --no-audit --no-fund --include=optional @openai/codex@0.147.0
+          npm install --prefix $contractRoot --no-save --no-audit --no-fund --include=optional @openai/codex@0.153.4
           $binaries = @(Get-ChildItem -Path $contractRoot -Recurse -Filter codex.exe)
           if ($binaries.Count -ne 1) {
             throw "Expected one native codex.exe, found $($binaries.Count)"
```

**File**: `packages/agent/daemon/providerregistry/codex.go` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import canonical "github.com/tutti-os/tutti/packages/agent/store-sqlite/canonica
 const (
 	CodexProviderID                = canonical.CodexProviderID
 	CodexTargetID                  = "local:codex"
-	CodexMinVersion                = "0.126.0"
+	CodexMinVersion                = "0.153.4"
 	CodexThroughTurnForkMinVersion = "0.144.0"
 )
 
```

**File**: `services/tuttid/service/agentstatus/codex_bun_discovery_test.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ func TestCodexDiscoveryUsesBunConfiguredGlobalBinForStatusAndLaunch(t *testing.T
 		"exit 1\n")
 	codexPath := filepath.Join(customGlobalBin, "codex")
 	writeExecutable(t, codexPath, "#!/bin/sh\n"+
-		"if [ \"$1\" = \"--version\" ]; then echo 'codex 0.142.0'; exit 0; fi\n"+
+		"if [ \"$1\" = \"--version\" ]; then echo 'codex "+MinSupportedCodexVersion+"'; exit 0; fi\n"+
 		"exit 1\n")
 
 	service := probeTestService(home)
```

**File**: `services/tuttid/service/agentstatus/codex_runtime_catalog_test.go` (modified, +9/-9)
```diff
@@ -43,8 +43,8 @@ func TestCodexRuntimeSelectionUsesOnlyReadyCandidateForStatusAndLaunch(t *testin
 	home := t.TempDir()
 	broken := filepath.Join(home, "broken", "codex")
 	healthy := filepath.Join(home, "healthy", "codex")
-	broken = writeCodexVersionFixture(t, broken, "0.142.0")
-	healthy = writeCodexVersionFixture(t, healthy, "0.142.0")
+	broken = writeCodexVersionFixture(t, broken, MinSupportedCodexVersion)
+	healthy = writeCodexVersionFixture(t, healthy, MinSupportedCodexVersion)
 	service := probeTestService(home)
 	service.Environ = func() []string {
 		return []string{"PATH=" + filepath.Dir(broken) + string(filepath.ListSeparator) + filepath.Dir(healthy)}
@@ -75,8 +75,8 @@ func TestCodexRuntimeSelectionRequiresAUserChoiceBeforeStatusOrLaunch(t *testing
 	home := t.TempDir()
 	first := filepath.Join(home, "first", "codex")
 	second := filepath.Join(home, "second", "codex")
-	first = writeCodexVersionFixture(t, first, "0.142.0")
-	second = writeCodexVersionFixture(t, second, "0.142.0")
+	first = writeCodexVersionFixture(t, first, MinSupportedCodexVersion)
+	second = writeCodexVersionFixture(t, second, MinSupportedCodexVersion)
 	service := probeTestService(home)
 	service.Environ = func() []string {
 		return []string{"PATH=" + filepath.Dir(first) + string(filepath.ListSeparator) + filepath.Dir(second)}
@@ -118,8 +118,8 @@ func TestCodexRuntimeSelectionPersistsOnlyAReadyCandidateFromTheCurrentCatalog(t
 	home := t.TempDir()
 	first := filepath.Join(home, "first", "codex")
 	second := filepath.Join(home, "second", "codex")
-	first = writeCodexVersionFixture(t, first, "0.142.0")
-	second = writeCodexVersionFixture(t, second, "0.142.0")
+	first = writeCodexVersionFixture(t, first, MinSupportedCodexVersion)
+	second = writeCodexVersionFixture(t, second, MinSupportedCodexVersion)
 	store := &memoryCodexRuntimeSelectionStore{}
 	service := probeTestService(home)
 	service.Environ = func() []string {
@@ -169,8 +169,8 @@ func TestCodexRuntimeSelectionDoesNotFallbackFromBrokenExplicitCandidate(t *test
 	home := t.TempDir()
 	broken := filepath.Join(home, "broken", "codex")
 	healthy := filepath.Join(home, "healthy", "codex")
-	broken = writeCodexVersionFixture(t, broken, "0.142.0")
-	healthy = writeCodexVersionFixture(t, healthy, "0.142.0")
+	broken = writeCodexVersionFixture(t, broken, MinSupportedCodexVersion)
+	healthy = writeCodexVersionFixture(t, healthy, MinSupportedCodexVersion)
 	service := probeTestService(home)
 	service.Environ = func() []string {
 		return []string{"PATH=" + filepath.Dir(broken) + string(filepath.ListSeparator) + filepath.Dir(healthy)}
@@ -199,7 +199,7 @@ func TestCodexRuntimeSelectionDoesNotFallbackFromBrokenExplicitCandidate(t *test
 func TestSetCodexRuntimeSelectionInvalidatesDerivedAvailability(t *testing.T) {
 	home := t.TempDir()
 	launcher := filepath.Join(home, "codex")
-	launcher = writeCodexVersionFixture(t, launcher, "0.146.0")
+	launcher = writeCodexVersionFixture(t, launcher, MinSupportedCodexVersion)
 	service := probeTestService(home)
 	service.CodexRuntimeSelectionStore = &memoryCodexRuntimeSelectionStore{}
 	service.Environ = func() []string {
```

---

### Incident Patch 2: `404a084f` (2026-09-02)
**Commit Message**: fix(agent): preserve external Claude commands (#2636)

* fix(agent): preserve external Claude commands

Signed-off-by: jomeswang <1551403343@qq.com>

* fix(dev): align Claude status with managed runtime

Signed-off-by: jomeswang <1551403343@qq.com>

---------

Signed-off-by: jomeswang <1551403343@qq.com>

**File**: `docs/architecture/agent-runtime-preparation.md` (modified, +12/-0)
```diff
@@ -44,6 +44,18 @@ the enabled Session's recorded runtime paths. The Tutti integrated terminal
 also prepends the Tutti-owned RTK directory to its child environment, but Tutti
 never mutates the operating-system or user-global PATH.
 
+Claude Code follows a separate SDK compatibility contract. The daemon keeps the
+SDK-paired executable under the private Agent runtime root, and runtime
+preparation passes its absolute path to the Claude SDK. A user-level `claude`
+command is published only when the complete effective command search contains no
+independently installed Claude executable. If a later reconciliation finds an
+external command, the daemon removes only a user entry that is still provably
+Tutti-owned: it atomically quarantines the current entry, inspects the moved
+object, and restores it without replacement if ownership changed concurrently.
+The private stable hop stays active. This prevents the managed runtime from
+shadowing or deleting a user's CLI while preserving Tutti's existing managed
+runtime selection inside Claude Sessions.
+
 Deployment differences are expressed with `DeploymentProfile` and
 `CapabilityPack`. A pack resolves policy, skills, and environment together.
 Dynamic host skills use `SkillSource`; per-session skills use `ExtraSkills`.
```

**File**: `docs/architecture/windows-platform-support.md` (modified, +14/-9)
```diff
@@ -201,15 +201,20 @@ existing verified package is reused and updated in place instead of creating a
 second copy. After verification the daemon publishes the directory that owns
 the selected launcher. It does not migrate or delete the legacy package.
 
-Managed Agent Extensions and the provisioned Claude Code runtime publish into
-the same `%USERPROFILE%\.local\bin` contract. Their versioned executables stay
-under `%USERPROFILE%\.local\share\tutti\agent-runtimes`; a stable per-Agent
-`.cmd` launcher and a user-level `.cmd` launcher form two verified hops to the
-active executable. This avoids file-symlink privilege and keeps versioned
-runtime directories out of `PATH`. The daemon refuses to replace an existing
-entry unless it carries the Tutti launcher marker and points inside the
-expected managed runtime root. Successful install actions surface user-PATH
-write failures, while status-time adoption repairs PATH on a best-effort basis.
+Managed Agent Extensions and the provisioned Claude Code runtime use the same
+`%USERPROFILE%\.local\bin` publication contract. Their versioned executables
+stay under `%USERPROFILE%\.local\share\tutti\agent-runtimes`; a stable per-Agent
+`.cmd` launcher and an optional user-level `.cmd` launcher form two verified
+hops to the active executable. This avoids file-symlink privilege and keeps
+versioned runtime directories out of `PATH`. Before publishing Claude, the
+daemon scans the complete effective command search and preserves any
+independently installed launcher. A later reconciliation removes an older
+public launcher only when it still carries the Tutti marker and targets the
+expected stable runtime hop. Removal first atomically quarantines the launcher,
+then inspects the moved file; a concurrently replaced external launcher is
+restored without overwriting a newer entry. The private hop remains active.
+Successful publication surfaces user-PATH write failures, while skipped
+publication never adds the directory to the current-user registry PATH.
 Registry changes affect new processes only, so an already-open terminal must be
 restarted before it can resolve a newly published command.
 
```

**File**: `docs/conventions/troubleshooting/README.md` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ Use the focused runtime index or open one area directly:
   probes, Windows managed-runtime adoption sharing violations, optional Provider
   absence misclassified as an environment failure, extension release refresh
   delaying daemon startup, Tutti Agent browser login that loses the managed Node
-  environment, repeated Hermes helper downloads in isolated session homes, and
-  CPU spikes.
+  environment, a Tutti-published Claude command shadowing an external CLI,
+  repeated Hermes helper downloads in isolated session homes, and CPU spikes.
 - [Agent Sessions And Lifecycle](./agent-session-lifecycle.md): Turn state, activation, planning-mode classification, capability snapshots, Tutti workflow response contracts, loading, cancel, goal controls, restore, file-change undo, rail projection, realtime completion provenance, event updates, imports, and performance.
   Includes shared-device recovery that looks terminal while the host is still retrying.
   Also covers new or derived conversations that silently fail or lose
```

**File**: `docs/conventions/troubleshooting/agent-provider-setup.md` (modified, +33/-0)
```diff
@@ -1638,6 +1638,39 @@ cannot find the path specified`, while the same repository is searchable
   [acp_live_state.go](../../../packages/agent/daemon/runtime/acp_live_state.go)
   [service_helpers.go](../../../services/tuttid/service/agentstatus/service_helpers.go)
 
+### Installing Tutti changes the terminal's Claude version
+
+- Symptom:
+  `claude --version` reports a newer independently installed release before
+  Tutti starts, then resolves to the SDK-paired Tutti release afterward.
+- Quick checks:
+  Enumerate every `claude` candidate in effective PATH order and resolve links
+  or Windows launchers. Compare `~/.local/bin/claude` (or
+  `%USERPROFILE%\.local\bin\claude.cmd`) with the private
+  `agent-runtimes/claude-code/bin` hop. Do not infer ownership from the public
+  pathname alone.
+- Root cause:
+  Older releases checked only whether the intended public pathname was occupied.
+  When an external Claude command existed later in PATH, Tutti could fill the
+  earlier user-bin slot and shadow it even though no file was overwritten.
+- Fix:
+  Keep the SDK-paired Claude executable private and pass it to the SDK by
+  absolute path. Publish a user command only when the complete effective search
+  has no external Claude candidate. During reconciliation, atomically quarantine
+  the current public entry and inspect the moved Tutti symlink or Windows
+  launcher before deletion. If ownership changed concurrently, restore it with
+  no-replace semantics; never delete or overwrite a foreign file or launcher.
+- Validation:
+  Cover an external command later in PATH, migration from an older managed
+  public entry, preservation of a foreign occupant at the publication path, and
+  private stable-hop activation after publication is skipped. Run the native
+  Windows launcher tests as well as the POSIX symlink tests.
+- References:
+  [claude_binary.go](../../../services/tuttid/service/agentstatus/claude_binary.go)
+  [entry.go](../../../services/tuttid/service/usercommand/entry.go)
+  [entry_unix.go](../../../services/tuttid/service/usercommand/entry_unix.go)
+  [entry_windows.go](../../../services/tuttid/service/usercommand/entry_windows.go)
+
 ### Claude SDK model aliases resolve to configured Anthropic defaults
 
 - Symptom:
```

**File**: `packages/agent/claude-sdk-sidecar/package.json` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@
     "typecheck": "node ../../../tools/scripts/run-tsgo-typecheck.mjs"
   },
   "dependencies": {
-    "@anthropic-ai/claude-agent-sdk": "0.3.220",
+    "@anthropic-ai/claude-agent-sdk": "0.3.258",
     "zod": "^4.0.0"
   },
   "devDependencies": {
```

---

### Incident Patch 3: `d448e4a2` (2026-08-28)
**Commit Message**: fix(agent): restore Claude remote auth probe (#2630)

Co-authored-by: rv4no <292825565+rv4no@users.noreply.github.com>

**File**: `packages/agent/daemon/providerregistry/claude_code.go` (modified, +12/-4)
```diff
@@ -33,10 +33,18 @@ func claudeCodeDescriptor() ProviderDescriptor {
 			BinaryNames:                     []string{"claude"},
 			AuthStatusCommand:               []string{"auth", "status"},
 			AuthStatusCommandTimeoutSeconds: 600,
-			// Claude authentication is owned by the SDK/CLI auth-status and real
-			// runtime outcomes. Account usage is an optional presentation
-			// capability and must never be used as remote auth evidence.
-			RemoteAuthProbe: RemoteAuthProbeDescriptor{},
+			RemoteAuthProbe: RemoteAuthProbeDescriptor{
+				Kind:           RemoteAuthProbeKindHTTPBearer,
+				CredentialKind: RemoteAuthCredentialKindClaudeOAuth,
+				Endpoint:       "https://api.anthropic.com/api/oauth/usage",
+				Method:         "GET",
+				Headers: map[string]string{
+					"Accept":         "application/json",
+					"anthropic-beta": "oauth-2025-04-20",
+					"User-Agent":     "claude-code/2.1.0",
+				},
+				TimeoutSeconds: 10,
+			},
 			AuthMarkerPaths: []string{"~/.claude.json", "~/.claude/auth.json"},
 			APIEndpoints:    []string{"https://api.anthropic.com/v1/messages"},
 			CustomConfigEnvVars: []string{
```

**File**: `packages/agent/daemon/providerregistry/registry_test.go` (modified, +13/-7)
```diff
@@ -463,13 +463,19 @@ func TestMigratedClaudeCodeDescriptorIsComplete(t *testing.T) {
 		descriptor.Status.AuthStatusCommandTimeoutSeconds != 600 {
 		t.Fatalf("target/status = %#v / %#v", descriptor.Target, descriptor.Status)
 	}
-	if descriptor.Status.RemoteAuthProbe.Kind != "" ||
-		descriptor.Status.RemoteAuthProbe.CredentialKind != "" ||
-		descriptor.Status.RemoteAuthProbe.Endpoint != "" ||
-		descriptor.Status.RemoteAuthProbe.Method != "" ||
-		len(descriptor.Status.RemoteAuthProbe.Headers) != 0 ||
-		descriptor.Status.RemoteAuthProbe.TimeoutSeconds != 0 {
-		t.Fatalf("remote auth probe = %#v", descriptor.Status.RemoteAuthProbe)
+	probe := descriptor.Status.RemoteAuthProbe
+	if probe.Kind != RemoteAuthProbeKindHTTPBearer ||
+		probe.CredentialKind != RemoteAuthCredentialKindClaudeOAuth ||
+		probe.Endpoint != "https://api.anthropic.com/api/oauth/usage" ||
+		probe.Method != "GET" ||
+		probe.TimeoutSeconds != 10 ||
+		probe.Headers["Accept"] != "application/json" ||
+		probe.Headers["anthropic-beta"] != "oauth-2025-04-20" ||
+		probe.Headers["User-Agent"] != "claude-code/2.1.0" {
+		t.Fatalf("remote auth probe = %#v", probe)
+	}
+	if !descriptor.Desktop.AuthProbeAfterCredentialSync {
+		t.Fatal("Claude auth probe must run after credential synchronization")
 	}
 	if !descriptor.ComposerProfile.Behavior.ModelOptionsAuthoritative ||
 		!descriptor.ComposerProfile.Behavior.RefreshModelOptionsAfterSettings ||
```

---

### Incident Patch 4: `89551ba8` (2026-08-28)
**Commit Message**: fix(agent): classify Claude account balance failures (#2628)

Signed-off-by: rv4no <292825565+rv4no@users.noreply.github.com>
Co-authored-by: rv4no <292825565+rv4no@users.noreply.github.com>

**File**: `packages/agent/daemon/runtime/provider_failure.go` (modified, +11/-1)
```diff
@@ -78,7 +78,13 @@ func claudeProviderFailure(payload map[string]any) ProviderFailure {
 	}
 	switch providerCode {
 	case "authentication_failed":
-		failure.Code, failure.AuthImpact, failure.AuthReason = "auth_required", providerFailureAuthRequired, "authentication_failed"
+		// Claude's SDK also uses this code for some HTTP 403 account failures;
+		// only a real 401 (or a missing status) is an authentication gate.
+		if claudeProviderInsufficientAccountBalance(message) {
+			failure.Code = FailureCodeInsufficientCredits
+		} else if status == nil || *status == 401 {
+			failure.Code, failure.AuthImpact, failure.AuthReason = "auth_required", providerFailureAuthRequired, "authentication_failed"
+		}
 	case "oauth_org_not_allowed":
 		failure.Code = "account_not_allowed"
 	case "billing_error":
@@ -116,6 +122,10 @@ func claudeProviderFailure(payload map[string]any) ProviderFailure {
 	return failure
 }
 
+func claudeProviderInsufficientAccountBalance(message string) bool {
+	return strings.Contains(strings.ToLower(message), "insufficient account balance")
+}
+
 func failureFromACPCall(err *acpCallError) ProviderFailure {
 	failure := ProviderFailure{
 		Code:       "provider_error",
```

**File**: `packages/agent/daemon/runtime/provider_failure_test.go` (modified, +4/-1)
```diff
@@ -28,10 +28,13 @@ func TestClaudeProviderFailureClassification(t *testing.T) {
 		name       string
 		code       string
 		status     int64
+		message    string
 		wantCode   string
 		wantImpact string
 	}{
 		{name: "auth", code: "authentication_failed", status: 401, wantCode: "auth_required", wantImpact: providerFailureAuthRequired},
+		{name: "insufficient account balance", code: "authentication_failed", status: 403, message: "Failed to authenticate. API Error: 403 Insufficient account balance", wantCode: FailureCodeInsufficientCredits, wantImpact: providerFailureAuthNone},
+		{name: "forbidden authentication error", code: "authentication_failed", status: 403, message: "Failed to authenticate. API Error: 403 Forbidden", wantCode: "provider_error", wantImpact: providerFailureAuthNone},
 		{name: "org", code: "oauth_org_not_allowed", status: 403, wantCode: "account_not_allowed", wantImpact: providerFailureAuthNone},
 		{name: "specific org beats status", code: "oauth_org_not_allowed", status: 401, wantCode: "account_not_allowed", wantImpact: providerFailureAuthNone},
 		{name: "billing", code: "billing_error", status: 402, wantCode: "billing_error", wantImpact: providerFailureAuthNone},
@@ -43,7 +46,7 @@ func TestClaudeProviderFailureClassification(t *testing.T) {
 	}
 	for _, test := range tests {
 		t.Run(test.name, func(t *testing.T) {
-			payload := map[string]any{"code": test.code, "error": "upstream detail"}
+			payload := map[string]any{"code": test.code, "error": firstNonEmptyString(test.message, "upstream detail")}
 			if test.status != 0 {
 				payload["apiErrorStatus"] = test.status
 			}
```

---

### Incident Patch 5: `97914ef9` (2026-08-27)
**Commit Message**: fix(agent): preserve managed runtime for auth (#2624)

Signed-off-by: jomeswang <1551403343@qq.com>

**File**: `docs/conventions/troubleshooting/README.md` (modified, +3/-2)
```diff
@@ -28,8 +28,9 @@ Use the focused runtime index or open one area directly:
   Also covers focus-driven provider CLI scans, repeated Extension Target version
   probes, Windows managed-runtime adoption sharing violations, optional Provider
   absence misclassified as an environment failure, extension release refresh
-  delaying daemon startup, repeated Hermes helper downloads in isolated session
-  homes, and CPU spikes.
+  delaying daemon startup, Tutti Agent browser login that loses the managed Node
+  environment, repeated Hermes helper downloads in isolated session homes, and
+  CPU spikes.
 - [Agent Sessions And Lifecycle](./agent-session-lifecycle.md): Turn state, activation, planning-mode classification, capability snapshots, Tutti workflow response contracts, loading, cancel, goal controls, restore, file-change undo, rail projection, realtime completion provenance, event updates, imports, and performance.
   Includes shared-device recovery that looks terminal while the host is still retrying.
   Also covers new or derived conversations that silently fail or lose
```

**File**: `docs/conventions/troubleshooting/agent-provider-setup.md` (modified, +41/-0)
```diff
@@ -4,6 +4,47 @@
 
 Provider discovery, installation, authentication, models, configuration, and runtime reachability.
 
+### Tutti Agent browser login succeeds but the desktop remains on the login screen
+
+- Symptom:
+  Tutti account state is already visible in the desktop header and the browser
+  login flow returns successfully, but the Tutti Agent surface does not react.
+  Daemon logs show the token issue request succeeding, followed by
+  `tutti-agent login --with-tutti-llm-tokens` failing because `node` cannot be
+  found.
+- Quick checks:
+  Compare the auth subprocess logs with the provider command resolution. A
+  packaged npm launcher commonly starts with `#!/usr/bin/env node`; therefore
+  finding the launcher binary is not enough. Check the resolved auth-command
+  event for `managed_node_configured=true` and `managed_node_on_path=true`, then
+  correlate it with the login process start and completion events. Never print
+  token payloads while diagnosing this path.
+- Root cause:
+  Tutti Agent sessions, status probes, and model discovery resolve the provider
+  command through Tutti's managed-runtime resolver, which adds the bundled Node
+  directory to the child environment. The dedicated auth bootstrap previously
+  reused only a binary path and launched it with the daemon's ambient
+  environment. On machines without a compatible system Node, `/usr/bin/env`
+  could not execute the npm launcher even though the Rust program behind that
+  launcher and the browser login itself were healthy.
+- Fix:
+  Resolve the provider command and full managed-runtime environment at each
+  auth entrypoint, then pass that same environment to the login subprocess.
+  Keep the canonical Tutti Agent auth-home overrides authoritative. Do not
+  special-case a guessed Node path or copy only `TUTTI_APP_NODE`: npm launchers
+  consume `PATH`, and the shared resolver owns its construction.
+- Validation:
+  Remove system Node from `PATH`, retain only Tutti's managed Node in the
+  provider resolution, and execute an npm-style `/usr/bin/env node` launcher.
+  Verify browser callback, model discovery, and session preparation all create
+  ready auth material and leave the UI. Repeat provider command/environment
+  resolution tests on Windows; on macOS/Linux retain an executable shebang
+  integration test.
+- References:
+  [auth_bootstrapper.go](../../../services/tuttid/service/tuttiagent/auth_bootstrapper.go)
+  [service.go](../../../services/tuttid/service/tuttiagent/service.go)
+  [wiring_daemon_api.go](../../../services/tuttid/wiring_daemon_api.go)
+
 ### A cold Agent Extension handoff fails at `acp session/new timed out after 30s`
 
 - Symptom:
```

**File**: `services/tuttid/agent_replay_composition.go` (modified, +2/-1)
```diff
@@ -257,8 +257,9 @@ func configureReplayAwareTuttiAgentReadiness(
 	account *accountservice.Service,
 	status *agentstatusservice.Service,
 	targets agenttargetservice.Service,
+	bootstrapAuth func(context.Context),
 ) *tuttiagentservice.ReadinessCoordinator {
-	readiness := tuttiagentservice.NewReadinessCoordinator(status, targets)
+	readiness := tuttiagentservice.NewReadinessCoordinator(status, targets, bootstrapAuth)
 	if replay {
 		return readiness
 	}
```

**File**: `services/tuttid/service/agent/model_catalog.go` (modified, +23/-10)
```diff
@@ -59,12 +59,13 @@ type AgentModelLister interface {
 }
 
 type CachedAgentModelCatalog struct {
-	Codex             AgentModelLister
-	TuttiAgent        AgentModelLister
-	OpenCode          AgentModelLister
-	ModelCapabilities ModelCapabilitiesResolver
-	ProviderCommands  ProviderCommandResolver
-	Now               func() time.Time
+	Codex                   AgentModelLister
+	TuttiAgent              AgentModelLister
+	OpenCode                AgentModelLister
+	ModelCapabilities       ModelCapabilitiesResolver
+	ProviderCommands        ProviderCommandResolver
+	TuttiAgentAuthBootstrap func(context.Context)
+	Now                     func() time.Time
 	// PersistentPath is configured by the daemon composition root. Keeping the
 	// path injectable leaves unit tests in-memory and avoids coupling them to a
 	// developer's real provider cache.
@@ -425,21 +426,33 @@ func modelCatalogFetchTimeoutForSpec(spec agentModelCatalogSpec) time.Duration {
 	return modelCatalogFetchTimeout
 }
 
-func defaultTuttiAgentModelLister(provider string, providerCommands ProviderCommandResolver) CodexCLIModelLister {
+func defaultTuttiAgentModelLister(
+	provider string,
+	providerCommands ProviderCommandResolver,
+	bootstrapAuth func(context.Context),
+) CodexCLIModelLister {
 	return CodexCLIModelLister{
 		Command:          "tutti-agent",
 		ClientName:       "tutti_agent",
 		Provider:         provider,
 		ProviderCommands: providerCommands,
-		PrepareEnv:       prepareTuttiAgentModelListEnv,
+		PrepareEnv: func(ctx context.Context, env []string) ([]string, error) {
+			return prepareTuttiAgentModelListEnv(ctx, env, bootstrapAuth)
+		},
 	}
 }
 
-func prepareTuttiAgentModelListEnv(ctx context.Context, env []string) ([]string, error) {
+func prepareTuttiAgentModelListEnv(
+	ctx context.Context,
+	env []string,
+	bootstrapAuth func(context.Context),
+) ([]string, error) {
 	env = append([]string(nil), env...)
 	env = withoutEnvKeys(env, "TUTTI_AGENT_HOME", "CODEX_HOME")
 	tuttiAgentHome := filepath.Join(tuttitypes.DefaultStateDir(), "agent-model-catalog", "tutti-agent-home")
-	tuttiagentservice.BootstrapTuttiAgentUserAuth(ctx)
+	if bootstrapAuth != nil {
+		bootstrapAuth(ctx)
+	}
 	if err := refreshTuttiAgentModelCatalogAuth(tuttiAgentHome); err != nil {
 		return nil, err
 	}
```

**File**: `services/tuttid/service/agent/model_catalog_specs.go` (modified, +5/-1)
```diff
@@ -137,7 +137,11 @@ func agentModelCatalogSpecFromDescriptor(descriptor providerregistry.ProviderDes
 				if c.TuttiAgent != nil {
 					return c.TuttiAgent
 				}
-				lister := defaultTuttiAgentModelLister(descriptor.Identity.ID, c.ProviderCommands)
+				lister := defaultTuttiAgentModelLister(
+					descriptor.Identity.ID,
+					c.ProviderCommands,
+					c.TuttiAgentAuthBootstrap,
+				)
 				lister.Session = c.codexSession(descriptor.Identity.ID, lister)
 				return lister
 			},
```

---

### Incident Patch 6: `8fa59f86` (2026-08-27)
**Commit Message**: fix(agent): resolve extension setup, recovery, and capability regressions (#2597)

* fix(agent-extension): tolerate foreign user command names during runtime activation

Installing an extension runtime whose manifest publishes a user command
failed hard when the user command name was already occupied by a command
Tutti does not own (e.g. a locally installed CLI on PATH, as happened
with Hermes after the 0.19.0 runtime upgrade): entry.Validate() treated
"user executable entry is not owned by Tutti" as fatal and rolled back
the whole activation.

The owner-protection intent stayed (never overwrite a user-owned
command), but the failure semantics were wrong: a skipped user-command
publication must not block the managed runtime installation.

- usercommand: classify the user-path hop as absent/managed/foreign.
  Validate/Verify tolerate foreign; Publish skips the user entry (leaves
  the foreign command untouched) and only refreshes the internal stable
  hop, reporting published=false.
- agentextension: adapt publish call sites (uv/npm runners and the
  adoption flow) to log a warning when publication is skipped.

Co-Authored-By: Claude <noreply@anthropic.com>
Signed-off-by: dreamt <mo

**File**: `apps/desktop/src/main/generated/defaults.ts` (modified, +5/-2)
```diff
@@ -87,9 +87,12 @@ export const generatedDefaults = {
       },
       {
         key: "hermes",
-        pinnedVersion: "1.0.10",
+        pinnedVersion: "1.0.11",
         releaseIndexUrl:
-          "https://d1x7gb6wqsqmnm.cloudfront.net/tutti-agent-releases/agents/hermes/versions.json",
+          "https://d1x7gb6wqsqmnm.cloudfront.net/tutti-agent-releases/agents/hermes/account-usage-v1/versions.json",
+        fallbackReleaseIndexUrls: [
+          "https://d1x7gb6wqsqmnm.cloudfront.net/tutti-agent-releases/agents/hermes/versions.json"
+        ],
         signingKeyId: "tutti-hermes-release-v1",
         signingPublicKey:
           "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAIeel8ddNiN3b4qOq0KucF3BRxfi3zourM0BVyGuP8eY=\n-----END PUBLIC KEY-----\n",
```

**File**: `apps/desktop/src/main/ipc/computerUse.test.ts` (modified, +57/-1)
```diff
@@ -3,7 +3,8 @@ import test from "node:test";
 import {
   parseCuaDriverDoctorStatus,
   parseCuaDriverPermissionsStatus,
-  parseCuaDriverPermissionsStatusDetail
+  parseCuaDriverPermissionsStatusDetail,
+  resolveCuaDriverAuthorizationStatus
 } from "./computerUsePermissions.ts";
 import { buildWindowsCuaDriverCommand } from "./computerUseWindows.ts";
 
@@ -82,6 +83,34 @@ test("parseCuaDriverDoctorStatus recognizes usable Win32 fallback", () => {
   );
 });
 
+test("parseCuaDriverDoctorStatus recognizes Win32 fallback emitted before JSON", () => {
+  const warning =
+    "\u001b[33mWARN\u001b[0m UIA health probe exceeded 2000ms; falling back to Win32-only window tools";
+  assert.deepEqual(
+    parseCuaDriverDoctorStatus(
+      [
+        warning,
+        JSON.stringify({
+          ok: false,
+          probes: [
+            {
+              label: "binary",
+              message: "cua-driver 0.18.0 (x86_64-windows)",
+              status: "ok"
+            }
+          ]
+        })
+      ].join("\n")
+    ),
+    { ok: false, degraded: true }
+  );
+
+  assert.deepEqual(parseCuaDriverDoctorStatus(`${warning}\nnot json`), {
+    ok: false,
+    diagnosticMessage: `${warning}\nnot json`
+  });
+});
+
 test("parseCuaDriverPermissionsStatus maps driver-daemon permission payload", () => {
   assert.deepEqual(
     parseCuaDriverPermissionsStatus(
@@ -173,3 +202,30 @@ test("parseCuaDriverPermissionsStatusDetail preserves partial permission state",
     }
   );
 });
+
+test("CuaDriver 0.20 unprobed capture status remains ready after TCC grants", () => {
+  assert.deepEqual(
+    resolveCuaDriverAuthorizationStatus({
+      accessibility: true,
+      screenRecording: true,
+      screenRecordingCapturable: null,
+      source: "driver-daemon"
+    }),
+    { authorization: "authorized" }
+  );
+});
+
+test("an explicit failed capture probe still requires authorization", () => {
+  assert.deepEqual(
+    resolveCuaDriverAuthorizationStatus({
+      accessibility: true,
+      screenRecording: true,
+      screenRecordingCapturable: false,
+      source: "driver-daemon"
+    }),
+    {
+      authorization: "needs-authorization",
+      reason: "screen-recording-not-capturable"
+    }
+  );
+});
```

**File**: `apps/desktop/src/main/ipc/computerUse.ts` (modified, +3/-36)
```diff
@@ -19,7 +19,8 @@ import { shell } from "electron";
 import { registerDesktopIpcHandler } from "./handle.ts";
 import {
   parseCuaDriverDoctorStatus,
-  parseCuaDriverPermissionsStatusDetail
+  parseCuaDriverPermissionsStatusDetail,
+  resolveCuaDriverAuthorizationStatus
 } from "./computerUsePermissions.ts";
 import {
   buildWindowsCuaDriverCommand,
@@ -505,7 +506,7 @@ function resolveComputerUseStatus(input: {
     };
   }
 
-  const status = resolveComputerUseAuthorizationStatus(permissions);
+  const status = resolveCuaDriverAuthorizationStatus(permissions);
   return {
     installed: true,
     platform: input.platform ?? computerUsePlatform(),
@@ -525,40 +526,6 @@ function computerUsePlatform(): DesktopComputerUsePlatform {
   return "unknown";
 }
 
-function resolveComputerUseAuthorizationStatus(
-  permissions: DesktopComputerUsePermissionsStatus
-): {
-  authorization: DesktopComputerUseStatus["authorization"];
-  reason?: DesktopComputerUseStatusReason;
-} {
-  if (
-    permissions.accessibility === true &&
-    permissions.screenRecording === true &&
-    permissions.screenRecordingCapturable === true
-  ) {
-    return { authorization: "authorized" };
-  }
-  if (
-    permissions.screenRecording === true &&
-    permissions.screenRecordingCapturable !== true
-  ) {
-    return {
-      authorization: "needs-authorization",
-      reason: "screen-recording-not-capturable"
-    };
-  }
-  if (
-    permissions.accessibility === false ||
-    permissions.screenRecording === false
-  ) {
-    return {
-      authorization: "needs-authorization",
-      reason: "permission-missing"
-    };
-  }
-  return { authorization: "unknown", reason: "status-unparseable" };
-}
-
 async function checkWindowsCuaDriverStatus(
   executable: string,
   startedAtUnixMs: number
```

**File**: `apps/desktop/src/main/ipc/computerUsePermissions.ts` (modified, +50/-6)
```diff
@@ -1,4 +1,5 @@
 import type {
+  DesktopComputerUseAuthorizationState,
   DesktopComputerUsePermissionsStatus,
   DesktopComputerUsePermissionStatusSource,
   DesktopComputerUseStatusReason
@@ -19,6 +20,40 @@ export interface CuaDriverPermissionsStatusDetail {
   diagnosticMessage?: string;
 }
 
+export function resolveCuaDriverAuthorizationStatus(
+  permissions: DesktopComputerUsePermissionsStatus
+): {
+  authorization: DesktopComputerUseAuthorizationState;
+  reason?: DesktopComputerUseStatusReason;
+} {
+  if (
+    permissions.accessibility === true &&
+    permissions.screenRecording === true &&
+    permissions.screenRecordingCapturable !== false
+  ) {
+    return { authorization: "authorized" };
+  }
+  if (
+    permissions.screenRecording === true &&
+    permissions.screenRecordingCapturable === false
+  ) {
+    return {
+      authorization: "needs-authorization",
+      reason: "screen-recording-not-capturable"
+    };
+  }
+  if (
+    permissions.accessibility === false ||
+    permissions.screenRecording === false
+  ) {
+    return {
+      authorization: "needs-authorization",
+      reason: "permission-missing"
+    };
+  }
+  return { authorization: "unknown", reason: "status-unparseable" };
+}
+
 export function parseCuaDriverPermissionsStatus(
   output: string
 ): DesktopComputerUsePermissionsStatus | null {
@@ -118,15 +153,23 @@ export function parseCuaDriverDoctorStatus(
     };
   }
 
+  // CuaDriver 0.18 on Windows can emit its UIA fallback warning to stderr
+  // before writing the JSON doctor result to stdout. runSubprocess preserves
+  // both streams, so inspect the validated combined output as well as fields
+  // inside the JSON payload.
+  const outputReportsUsableWin32Fallback =
+    isCuaDriverDegradedDiagnostic(output);
+
   if (typeof payload.ok === "boolean") {
     const diagnosticMessage =
       stringOrUndefined(payload.message) ?? stringOrUndefined(payload.reason);
+    const degraded =
+      outputReportsUsableWin32Fallback ||
+      isCuaDriverDegradedDiagnostic(diagnosticMessage);
     return {
       ok: payload.ok,
       ...(diagnosticMessage ? { diagnosticMessage } : {}),
-      ...(isCuaDriverDegradedDiagnostic(diagnosticMessage)
-        ? { degraded: true }
-        : {})
+      ...(degraded ? { degraded: true } : {})
     };
   }
 
@@ -159,12 +202,13 @@ export function parseCuaDriverDoctorStatus(
   }
   const diagnosticMessage =
     diagnostics.length > 0 ? diagnostics.join("; ") : undefined;
+  const degraded =
+    outputReportsUsableWin32Fallback ||
+    isCuaDriverDegradedDiagnostic(diagnosticMessage);
   return {
     ok: !failed,
     ...(diagnosticMessage ? { diagnosticMessage } : {}),
-    ...(isCuaDriverDegradedDiagnostic(diagnosticMessage)
-      ? { degraded: true }
-      : {})
+    ...(degraded ? { degraded: true } : {})
   };
 }
 
```

**File**: `apps/desktop/src/renderer/src/features/workspace-agent/services/internal/workspaceAgentActivityReconcileBridge.ts` (modified, +57/-3)
```diff
@@ -10,7 +10,8 @@ import {
 import {
   createAgentActivitySnapshotProjector,
   createAgentActivitySessionReconcileExecutor,
-  createAgentActivityWorkspaceEventCoordinator
+  createAgentActivityWorkspaceEventCoordinator,
+  selectEngineSessionReconcile
 } from "@tutti-os/agent-activity-core";
 import type { WorkspaceAgentActivityEnsureSessionSynchronizedInput } from "../workspaceAgentActivityService.interface.ts";
 import type { WorkspaceAgentSessionEngineHost } from "./workspaceAgentSessionEngineHost.ts";
@@ -29,6 +30,17 @@ import type {
 import { WorkspaceAgentComposerOptionsInvalidationCoordinator } from "./workspaceAgentComposerOptionsInvalidationCoordinator.ts";
 import { editRetryAvailabilityFromTuttid } from "./workspaceAgentEditRetry.ts";
 
+function sessionSynchronizationError(
+  errorCode: string,
+  errorMessage: string
+): Error {
+  const error = new Error(
+    errorMessage || errorCode || "Session synchronization failed."
+  ) as Error & { code?: string };
+  if (errorCode) error.code = errorCode;
+  return error;
+}
+
 export abstract class WorkspaceAgentActivityReconcileBridge {
   private readonly reconcileDependencies: WorkspaceAgentActivityReconcileDependencies;
   private readonly entries = new Map<string, WorkspaceAgentSessionEngineHost>();
@@ -154,6 +166,10 @@ export abstract class WorkspaceAgentActivityReconcileBridge {
     // Keep the release hook for hosts that implement a narrower stream lease.
     const workspaceId = normalizeWorkspaceId(input.workspaceId);
     const agentSessionId = input.agentSessionId.trim();
+    let released = false;
+    let retryingAfterFailure = false;
+    let lastReportedFailure: string | null = null;
+    let unsubscribeReconcile = () => {};
     if (agentSessionId) {
       let refCounts =
         this.prioritySessionRefCountsByWorkspaceId.get(workspaceId);
@@ -162,18 +178,56 @@ export abstract class WorkspaceAgentActivityReconcileBridge {
         this.prioritySessionRefCountsByWorkspaceId.set(workspaceId, refCounts);
       }
       refCounts.set(agentSessionId, (refCounts.get(agentSessionId) ?? 0) + 1);
-      this.entry(workspaceId).engine.dispatch({
+      const engine = this.entry(workspaceId).engine;
+      const observeReconcile = () => {
+        if (released) return;
+        const record = selectEngineSessionReconcile(
+          engine.getSnapshot(),
+          agentSessionId
+        );
+        if (
+          !record ||
+          record.inFlightCommandId ||
+          record.pendingMessages ||
+          record.pendingState
+        ) {
+          return;
+        }
+        const errorCode = record.errorCode?.trim() ?? "";
+        const errorMessage = record.errorMessage?.trim() ?? "";
+        if (!errorCode && !errorMessage) {
+          retryingAfterFailure = false;
+          lastReportedFailure = null;
+          return;
+        }
+        const failureKey = `${errorCode}\u0000${errorMessage}`;
+        if (failureKey !== lastReportedFailure) {
+          lastReportedFailure = failureKey;
+          input.onError?.(sessionSynchronizationError(errorCode, errorMessage));
+        }
+        if (retryingAfterFailure) return;
+        retryingAfterFailure = true;
+        engine.dispatch({
+          agentSessionId,
+          needsMessages: true,
+          needsState: true,
+          type: "session/reconcileRequested",
+          workspaceId
+        });
+      };
+      unsubscribeReconcile = engine.subscribe(observeReconcile);
+      engine.dispatch({
         agentSessionId,
         needsMessages: true,
         needsState: true,
         type: "session/reconcileRequested",
         workspaceId
       });
     }
-    let released = false;
     return () => {
       if (released || !agentSessionId) return;
       released = true;
+      unsubscribeReconcile();
       const refCounts =
         this.prioritySessionRefCountsByWorkspaceId.get(workspaceId);
       const nextCount = (refCounts?.get(agentSessionId) ?? 0) - 1;
```

---

### Incident Patch 7: `38ac9578` (2026-08-27)
**Commit Message**: fix(agent): prepare Tutti Agent auth home before login (#2621)

Signed-off-by: JomesWang <56079587+jomeswang@users.noreply.github.com>

**File**: `docs/architecture/tutti-agent-readiness-bootstrap.md` (modified, +10/-0)
```diff
@@ -98,6 +98,14 @@ Desktop account auth and provider auth are related but distinct:
 - the daemon exchanges that session for a `tutti_llm` token bundle;
 - `tutti-agent login --with-tutti-llm-tokens` writes the provider auth marker.
 
+Before launching the login command, the daemon creates the canonical provider
+auth home when it is missing, then sets `TUTTI_AGENT_HOME` to that existing
+directory and clears an inherited `CODEX_HOME`. This ordering is required
+because Tutti Agent accepts an absent default home but requires an explicitly
+configured home to exist before configuration loading. Auth-home creation logs
+only the structured action and reason; login failures may include bounded CLI
+diagnostics after access and refresh tokens are redacted.
+
 The daemon wires account lifecycle callbacks at startup:
 
 ```text
@@ -187,6 +195,8 @@ The durable test surface covers:
   reconciliation, shared refresh-lock serialization, and explicit logout
   cleanup and revocation;
 - desktop routing of Tutti Agent login actions to the account service.
+- canonical auth-home preparation before an explicitly scoped login command,
+  including Windows and POSIX path handling and token-redacted diagnostics.
 
 Related documents:
 
```

**File**: `docs/conventions/troubleshooting/agent-provider-setup.md` (modified, +31/-0)
```diff
@@ -709,6 +709,37 @@ file or directory`. A failed `codex app-server` probe is diagnostic evidence,
   [service.go](../../../services/tuttid/service/tuttiagent/service.go)
   [tutti-agent-readiness-bootstrap.md](../../architecture/tutti-agent-readiness-bootstrap.md)
 
+### Tutti Agent stays on login while the desktop account is signed in
+
+- Symptom:
+  The desktop account avatar is present, but Tutti Agent remains
+  `auth_required`. Repeated bootstrap attempts log
+  `stage=login`, while the Account service successfully issues and then
+  compensates the short-lived LLM token.
+- Root cause:
+  Desktop Account auth and provider auth are separate. The daemon scopes the
+  provider login subprocess to the canonical user `TUTTI_AGENT_HOME`. Tutti
+  Agent requires an explicitly configured home to exist during configuration
+  loading, even though its later credential writer can create the default home.
+  Passing a missing explicit directory therefore used to fail before the
+  writer ran.
+- Fix:
+  Create the canonical provider auth home before launching
+  `tutti-agent login --with-tutti-llm-tokens`. Keep the explicit environment
+  override so session-scoped homes cannot capture durable user credentials.
+  Log auth-home creation without the local path, and include only bounded,
+  access-token- and refresh-token-redacted CLI diagnostics on login failure.
+- Validation:
+  Run the `service/tuttiagent` tests covering
+  `RunTuttiAgentTokenLoginPreparesCanonicalAuthHomeBeforeLaunch`,
+  `PrepareTuttiAgentAuthHomeRejectsFile`, and
+  `SanitizeTuttiAgentLoginOutputRedactsTokensAndTruncates`. Confirm a clean user
+  home gains `.tutti-agent/auth.json`, provider status changes from
+  `auth_required` to `ready`, and no token value appears in daemon logs.
+- References:
+  [service.go](../../../services/tuttid/service/tuttiagent/service.go)
+  [tutti-agent-readiness-bootstrap.md](../../architecture/tutti-agent-readiness-bootstrap.md)
+
 ### Agent sandbox cannot reach local daemon
 
 - Symptom:
```

**File**: `docs/conventions/troubleshooting/agent-runtime.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ Provider discovery, installation, authentication, models, configuration, and run
 - [Tutti Agent npm install misses the platform package](./agent-provider-setup.md#tutti-agent-npm-install-misses-the-platform-package)
 - [Managed npm install fails before reaching every registry](./agent-provider-setup.md#managed-npm-install-fails-before-reaching-every-registry)
 - [Tutti Agent unexpectedly loses login after a host auth read failure](./agent-provider-setup.md#tutti-agent-unexpectedly-loses-login-after-a-host-auth-read-failure)
+- [Tutti Agent stays on login while the desktop account is signed in](./agent-provider-setup.md#tutti-agent-stays-on-login-while-the-desktop-account-is-signed-in)
 - [Agent sandbox cannot reach local daemon](./agent-provider-setup.md#agent-sandbox-cannot-reach-local-daemon)
 - [Codex provider install fails with missing npm](./agent-provider-setup.md#codex-provider-install-fails-with-missing-npm)
 - [Codex ACP warns about user-level config as project-local config](./agent-provider-setup.md#codex-acp-warns-about-user-level-config-as-project-local-config)
```

**File**: `services/tuttid/service/tuttiagent/service.go` (modified, +66/-1)
```diff
@@ -181,6 +181,9 @@ func bootstrapTuttiAgentUserAuth(ctx context.Context, input runtimeprep.PrepareI
 		if stage := tuttiAgentAuthFailureStage(err); stage != "" {
 			logArgs = append(logArgs, "stage", stage)
 		}
+		if detail := tuttiAgentAuthFailureDetail(err); detail != "" {
+			logArgs = append(logArgs, "detail", detail)
+		}
 		slog.Warn("tutti-agent auth reconcile failed", logArgs...)
 		if tuttiAgentLLMTokenIssueRejectedWithCode(err, http.StatusUnauthorized) {
 			slog.Info("tutti-agent auth retained after token issue rejection",
@@ -395,6 +398,14 @@ func tuttiAgentAuthFailureStage(err error) string {
 	return strings.TrimSpace(stageErr.Stage)
 }
 
+func tuttiAgentAuthFailureDetail(err error) string {
+	var stageErr tuttiagentauth.StageError
+	if !errors.As(err, &stageErr) || strings.TrimSpace(stageErr.Stage) != "login" || stageErr.Err == nil {
+		return ""
+	}
+	return truncateTuttiAgentDiagnostic(strings.TrimSpace(stageErr.Err.Error()), 2048)
+}
+
 func issueTuttiAgentLLMToken(ctx context.Context, cookie string) (tuttiAgentLLMTokenBundle, error) {
 	requestBody, err := json.Marshal(map[string]any{
 		"requested_app_id": tuttiAgentLLMAppID(),
@@ -526,16 +537,70 @@ func runTuttiAgentTokenLogin(ctx context.Context, binaryPath string, bundle tutt
 		// the same canonical user auth file inspected by the reconciler; leaving
 		// either override in place can make a successful login invisible to the
 		// verifier (or write the bundle into another session home).
+		created, prepareErr := prepareTuttiAgentAuthHome(authPath)
+		if prepareErr != nil {
+			return prepareErr
+		}
+		if created {
+			slog.Info("tutti-agent auth home prepared",
+				"event", "tutti_agent.auth_home.prepared",
+				"action", "create",
+				"reason", "missing_directory",
+			)
+		}
 		cmd.Env = tuttiAgentLoginEnvironment(os.Environ(), authPath)
 	}
 	cmd.Stdin = bytes.NewReader(stdin)
 	output, err := cmd.CombinedOutput()
 	if err != nil {
-		return fmt.Errorf("tutti-agent login failed: %w: %s", err, strings.TrimSpace(string(output)))
+		detail := sanitizeTuttiAgentLoginOutput(string(output), bundle)
+		if detail == "" {
+			return fmt.Errorf("tutti-agent login failed: %w", err)
+		}
+		return fmt.Errorf("tutti-agent login failed: %w: %s", err, detail)
 	}
 	return nil
 }
 
+func prepareTuttiAgentAuthHome(authPath string) (bool, error) {
+	authHome := filepath.Dir(filepath.Clean(authPath))
+	info, err := os.Stat(authHome)
+	if err == nil {
+		if !info.IsDir() {
+			return false, fmt.Errorf("prepare tutti-agent auth home: %s is not a directory", authHome)
+		}
+		return false, nil
+	}
+	if !errors.Is(err, os.ErrNotExist) {
+		return false, fmt.Errorf("inspect tutti-agent auth home: %w", err)
+	}
+	if err := os.MkdirAll(authHome, 0o700); err != nil {
+		return false, fmt.Errorf("prepare tutti-agent auth home: %w", err)
+	}
+	return true, nil
+}
+
+func sanitizeTuttiAgentLoginOutput(output string, bundle tuttiAgentLLMTokenBundle) string {
+	detail := strings.TrimSpace(output)
+	for _, secret := range []string{bundle.AccessToken, bundle.RefreshToken} {
+		if secret = strings.TrimSpace(secret); secret != "" {
+			detail = strings.ReplaceAll(detail, secret, "[REDACTED]")
+		}
+	}
+	return truncateTuttiAgentDiagnostic(detail, 2048)
+}
+
+func truncateTuttiAgentDiagnostic(value string, limit int) string {
+	if limit <= 0 {
+		return ""
+	}
+	runes := []rune(value)
+	if len(runes) <= limit {
+		return value
+	}
+	return string(runes[:limit]) + "…"
+}
+
 func tuttiAgentLoginEnvironment(base []string, authPath string) []string {
 	env := append([]string(nil), base...)
 	env = replaceEnvironmentValue(env, "TUTTI_AGENT_HOME", filepath.Dir(filepath.Clean(authPath)))
```

**File**: `services/tuttid/service/tuttiagent/service_test.go` (modified, +55/-0)
```diff
@@ -111,6 +111,61 @@ func TestTuttiAgentLoginEnvironmentUsesCanonicalAuthHome(t *testing.T) {
 	}
 }
 
+func TestRunTuttiAgentTokenLoginPreparesCanonicalAuthHomeBeforeLaunch(t *testing.T) {
+	home := t.TempDir()
+	t.Setenv("HOME", home)
+	t.Setenv("USERPROFILE", home)
+	authHome := filepath.Join(home, ".tutti-agent")
+
+	err := runTuttiAgentTokenLogin(
+		t.Context(),
+		filepath.Join(t.TempDir(), "missing-tutti-agent"),
+		tuttiAgentLLMTokenBundle{},
+	)
+	if err == nil {
+		t.Fatal("runTuttiAgentTokenLogin() succeeded with a missing binary")
+	}
+	info, statErr := os.Stat(authHome)
+	if statErr != nil {
+		t.Fatalf("stat prepared auth home: %v", statErr)
+	}
+	if !info.IsDir() {
+		t.Fatalf("prepared auth home mode = %v, want directory", info.Mode())
+	}
+}
+
+func TestPrepareTuttiAgentAuthHomeRejectsFile(t *testing.T) {
+	authHome := filepath.Join(t.TempDir(), ".tutti-agent")
+	if err := os.WriteFile(authHome, []byte("not a directory"), 0o600); err != nil {
+		t.Fatal(err)
+	}
+
+	_, err := prepareTuttiAgentAuthHome(filepath.Join(authHome, "auth.json"))
+	if err == nil || !strings.Contains(err.Error(), "is not a directory") {
+		t.Fatalf("prepareTuttiAgentAuthHome() error = %v, want not-a-directory detail", err)
+	}
+}
+
+func TestSanitizeTuttiAgentLoginOutputRedactsTokensAndTruncates(t *testing.T) {
+	bundle := tuttiAgentLLMTokenBundle{
+		AccessToken:  "access-secret",
+		RefreshToken: "refresh-secret",
+	}
+	detail := sanitizeTuttiAgentLoginOutput(
+		"login failed access-secret refresh-secret "+strings.Repeat("x", 2100),
+		bundle,
+	)
+	if strings.Contains(detail, "access-secret") || strings.Contains(detail, "refresh-secret") {
+		t.Fatalf("sanitizeTuttiAgentLoginOutput() leaked a token: %q", detail)
+	}
+	if !strings.Contains(detail, "[REDACTED]") {
+		t.Fatalf("sanitizeTuttiAgentLoginOutput() = %q, want redaction marker", detail)
+	}
+	if !strings.HasSuffix(detail, "…") {
+		t.Fatalf("sanitizeTuttiAgentLoginOutput() was not truncated: %q", detail)
+	}
+}
+
 func TestTuttiAgentUserAuthReadyRejectsExpiredAccessToken(t *testing.T) {
 	expiresAt := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
 	writeTuttiAgentUserAuth(t, t.TempDir(), `{"tutti_llm":{"access_token":"lat_test","access_token_expires_at":`+strconv.Quote(expiresAt)+`,"refresh_token":"lrt_test"}}`)
```

---

### Incident Patch 8: `c2fd80ca` (2026-08-27)
**Commit Message**: fix(agent): fail closed when provider turn state is lost (#2620)

* fix(agent): fail closed when provider turn state is lost

* refactor(agent): split runtime cancel helpers

---------

Co-authored-by: rv4no <292825565+rv4no@users.noreply.github.com>

**File**: `packages/agent/claude-sdk-sidecar/README.md` (modified, +7/-2)
```diff
@@ -108,14 +108,19 @@ proceed. Checkpoint and terminal events use the same bound provider Turn ID and
 never fall back to the outbound correlation UUID.
 
 Exact cancellation returns a structured `pre_accept`, `provider_active`,
-`absent`, or `mismatch` disposition. An undispatched Turn or deferred Goal
-command can be removed locally. A dispatched Turn is fenced immediately, but
+`provider_state_lost`, `absent`, or `mismatch` disposition. An undispatched
+Turn or deferred Goal command can be removed locally. A dispatched Turn is
+fenced immediately, but
 its terminal event is emitted only after the Query reaches an authoritative
 shutdown boundary: either the SDK acknowledges the interrupt or the sidecar
 closes the owned Query transport and its consumer drains. `provider_active`
 includes the resolved provider Turn ID so the
 daemon can wait for that exact Turn's durable acceptance result before it
 confirms cancellation; failures and unknown dispositions remain fail-closed.
+If an accepted Turn still has live provider-acceptance evidence but its Query
+generation or provider mapping is gone, the sidecar returns
+`provider_state_lost`; it never downgrades that observation to ordinary
+`absent`.
 
 Interactive responses use `(turnId, requestId)` identity. The sidecar keeps a
 bounded terminal disposition registry so `submit_interactive` is idempotent:
```

**File**: `packages/agent/claude-sdk-sidecar/src/sessionRuntime.ts` (modified, +48/-2)
```diff
@@ -74,6 +74,7 @@ type ClaudeQueryFactory = (input: {
 export type SessionCancelDisposition =
   | "pre_accept"
   | "provider_active"
+  | "provider_state_lost"
   | "absent"
   | "mismatch";
 
@@ -143,6 +144,7 @@ export class SessionRuntime {
   private readonly providerTurnAcceptance: ProviderTurnAcceptanceCoordinator;
   private readonly diagnostics: ClaudeSessionDiagnostics;
   private readonly emittedProviderCheckpoints = new Set<string>();
+  private readonly acceptedProviderTurnIds = new Set<string>();
 
   get query(): ClaudeQueryRuntime | undefined {
     return this.queryGeneration?.query;
@@ -174,9 +176,24 @@ export class SessionRuntime {
       onSyntheticActivate: (turnId) =>
         this.queryGeneration?.registerTurn(turnId),
       onSettled: (turnId) => {
+        this.acceptedProviderTurnIds.delete(turnId.trim());
         this.providerTurnAcceptance.terminal(turnId);
         this.emitSessionState();
       },
+      onProviderTurnIdentityBound: (turnId) => {
+        const normalizedTurnId = turnId.trim();
+        if (!normalizedTurnId) {
+          return;
+        }
+        this.acceptedProviderTurnIds.add(normalizedTurnId);
+        while (this.acceptedProviderTurnIds.size > 64) {
+          const oldest = this.acceptedProviderTurnIds.values().next().value;
+          if (typeof oldest !== "string") {
+            break;
+          }
+          this.acceptedProviderTurnIds.delete(oldest);
+        }
+      },
       continuationStartTimeoutMs,
       onContinuationStartTimeout: () => {
         this.activities.clearBackgroundContinuation();
@@ -676,7 +693,27 @@ export class SessionRuntime {
     // Generation ownership is the narrow proof that permits retiring that
     // Query; it never retargets a stop request to an unrelated newer Query.
     const ownsExpectedTurn = generation?.ownsTurn(expectedTurnId) === true;
+    const phase =
+      this.providerTurnAcceptance.phase(expectedTurnId) ?? "unknown";
+    const providerStateWasAccepted =
+      preparation.providerTurnId.trim() !== "" ||
+      this.acceptedProviderTurnIds.has(expectedTurnId) ||
+      (phase !== "queued" &&
+        phase !== "dispatched" &&
+        phase !== "provider_observed" &&
+        phase !== "resolving_identity" &&
+        phase !== "terminal" &&
+        phase !== "unknown");
     if (preparation.disposition === "absent" && !ownsExpectedTurn) {
+      if (providerStateWasAccepted) {
+        return cancelResult(
+          false,
+          "provider_state_lost",
+          expectedTurnId,
+          preparation.providerTurnId,
+          phase
+        );
+      }
       return cancelResult(false, "absent", expectedTurnId);
     }
     if (preparation.disposition === "mismatch" && !ownsExpectedTurn) {
@@ -688,8 +725,6 @@ export class SessionRuntime {
       );
     }
 
-    const phase =
-      this.providerTurnAcceptance.phase(expectedTurnId) ?? "unknown";
     if (
       preparation.differentActiveTurn &&
       phase !== "queued" &&
@@ -709,6 +744,17 @@ export class SessionRuntime {
     }
 
     if (!generation) {
+      if (providerStateWasAccepted) {
+        this.turns.releaseExactCancellation(expectedTurnId);
+        this.turns.clearCancelled();
+        return cancelResult(
+          false,
+          "provider_state_lost",
+          expectedTurnId,
+          preparation.providerTurnId,
+          phase
+        );
+      }
       this.turns.discardExactAbsent(expectedTurnId);
       this.turns.clearCancelled();
       return cancelResult(false, "absent", expectedTurnId, "", phase);
```

**File**: `packages/agent/claude-sdk-sidecar/src/turnLifecycle.ts` (modified, +5/-0)
```diff
@@ -51,6 +51,7 @@ export class TurnLifecycle {
   private readonly emit: ClaudeSDKSidecarEventEmitter;
   private readonly onActivate: () => void;
   private readonly onSyntheticActivate: (turnId: string) => void;
+  private readonly onProviderTurnIdentityBound: (turnId: string) => void;
   private readonly onSettled: (turnId: string) => void;
   private readonly onContinuationStartTimeout: () => void;
   private readonly continuationStartTimeoutMs: number;
@@ -68,13 +69,16 @@ export class TurnLifecycle {
     emit: ClaudeSDKSidecarEventEmitter;
     onActivate: () => void;
     onSyntheticActivate?: (turnId: string) => void;
+    onProviderTurnIdentityBound?: (turnId: string) => void;
     onSettled: (turnId: string) => void;
     onContinuationStartTimeout?: () => void;
     continuationStartTimeoutMs?: number;
   }) {
     this.emit = options.emit;
     this.onActivate = options.onActivate;
     this.onSyntheticActivate = options.onSyntheticActivate ?? (() => {});
+    this.onProviderTurnIdentityBound =
+      options.onProviderTurnIdentityBound ?? (() => {});
     this.onSettled = options.onSettled;
     this.onContinuationStartTimeout =
       options.onContinuationStartTimeout ?? (() => {});
@@ -657,6 +661,7 @@ export class TurnLifecycle {
     }
     turn.awaitingProviderTurnIdentity = false;
     turn.providerTurnStarted = true;
+    this.onProviderTurnIdentityBound(turn.turnId);
     this.emit({
       type: "provider_turn_identity_resolved",
       payload: {
```

**File**: `packages/agent/daemon/hostadapter/runtime.go` (modified, +5/-4)
```diff
@@ -338,10 +338,11 @@ func (a *RuntimeController) Cancel(ctx context.Context, input host.RuntimeCancel
 		confirmed = append(confirmed, host.RuntimeCancelTarget{AgentSessionID: target.AgentSessionID, TurnID: target.TurnID})
 	}
 	hostResult := host.RuntimeCancelResult{
-		AgentSessionID:   result.AgentSessionID,
-		Canceled:         result.Canceled,
-		TargetAbsent:     result.TargetAbsent,
-		ConfirmedTargets: confirmed,
+		AgentSessionID:    result.AgentSessionID,
+		Canceled:          result.Canceled,
+		TargetAbsent:      result.TargetAbsent,
+		ProviderStateLost: result.ProviderStateLost,
+		ConfirmedTargets:  confirmed,
 	}
 	if errors.Is(err, agentruntime.ErrCancelTargetMismatch) {
 		return hostResult, host.ErrRuntimeCancelDeliveryUnconfirmed
```

**File**: `packages/agent/daemon/runtime/claude_sdk_execution.go` (modified, +5/-0)
```diff
@@ -669,6 +669,11 @@ func (a *ClaudeCodeSDKAdapter) cancelClaudeSDKTurn(
 			return nil, errors.New("claude SDK returned inconsistent absent cancellation")
 		}
 		return nil, ErrSessionNoActiveTurn
+	case "provider_state_lost":
+		if canceled {
+			return nil, errors.New("claude SDK returned inconsistent provider state loss cancellation")
+		}
+		return nil, ErrProviderStateLost
 	case "mismatch":
 		if canceled || providerTurnID != "" {
 			return nil, errors.New("claude SDK returned inconsistent mismatched cancellation")
```

---

### Incident Patch 9: `de81966f` (2026-08-27)
**Commit Message**: fix(release): publish app runtime before desktop builds (#2619)

Signed-off-by: jomeswang <1551403343@qq.com>

**File**: `.github/workflows/desktop-release.yml` (modified, +4/-0)
```diff
@@ -214,6 +214,10 @@ jobs:
           echo "dry_run=${dry_run}" >> "$GITHUB_OUTPUT"
           echo "strategy=${strategy}" >> "$GITHUB_OUTPUT"
 
+      - name: Verify managed app runtime is published before release build
+        if: steps.mode.outputs.dry_run != 'true'
+        run: node tools/scripts/verify-tutti-app-runtime-release.mjs
+
       - name: Resolve release tag
         id: release
         shell: bash
```

**File**: `.github/workflows/publish-tutti-app-runtime.yml` (modified, +9/-0)
```diff
@@ -1,6 +1,11 @@
 name: Publish Tutti App Runtime
 
 on:
+  push:
+    branches:
+      - main
+    paths:
+      - config/tutti.app-runtime.lock.json
   workflow_dispatch:
     inputs:
       aws_region:
@@ -32,6 +37,10 @@ permissions:
   contents: read
   id-token: write
 
+concurrency:
+  group: tutti-app-runtime-production
+  cancel-in-progress: false
+
 env:
   FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
   RUNTIME_LOCK_FILE: config/tutti.app-runtime.lock.json
```

**File**: `docs/conventions/desktop-release.md` (modified, +5/-4)
```diff
@@ -458,10 +458,11 @@ Promotion performs these checks before changing public state:
 - the reviewed bilingual notes still produce the approval digest captured before the Environment gate
 - the target version does not move the selected public channel backwards
 
-When `config/tutti.app-runtime.lock.json` changes, run `Publish Tutti App
-Runtime` and verify the production catalog before promoting the desktop release.
-The promotion gate reads the lock from the exact release target, so a later
-manual promotion cannot bypass this ordering.
+Merging a change to `config/tutti.app-runtime.lock.json` on `main` automatically
+runs `Publish Tutti App Runtime`; its manual trigger remains available for
+recovery. Desktop release resolution checks the catalog before reserving a tag
+or starting platform builds. The promotion gate repeats the check against the
+exact release target, so a later manual promotion cannot bypass this ordering.
 
 It then extracts the human-reviewed summary, copies stable candidate objects from `candidates/<candidate-id>/` to the immutable `<tag>/` path, creates the formal stable tag, updates release notes and assets, publishes the GitHub Release, writes the channel pointer and changelog, refreshes the stable alias, verifies the public pointer, and sends the published card. Promotion never rebuilds installers or calls the summary model. Editing notes or replacing assets after submission changes the approval digest and forces a new approval run. Promotion is serialized because channel pointers are shared mutable state.
 
```

**File**: `docs/conventions/workspace-app-runtime.md` (modified, +5/-2)
```diff
@@ -141,8 +141,11 @@ release is promoted. Runtime versions use an ordered `YYYY.MM.PATCH` format and
 newer runtime releases remain compatible with older desktop releases because
 tuttid always resolves the mutable catalog's current entry. The promotion
 workflow enforces this ordering with
-`tools/scripts/verify-tutti-app-runtime-release.mjs`; publish the managed runtime
-first when the lock version changes.
+`tools/scripts/verify-tutti-app-runtime-release.mjs`. Merging a change to
+`config/tutti.app-runtime.lock.json` on `main` automatically runs `Publish Tutti
+App Runtime`; the manual trigger remains available for recovery. Desktop
+releases check the production catalog before reserving a tag or starting builds,
+and promotion repeats the check as a final safety gate.
 
 ## Catalog Shape
 
```

**File**: `tools/scripts/build-tutti-app-runtime-catalog.test.mjs` (modified, +7/-0)
```diff
@@ -110,6 +110,13 @@ test("Tutti app runtime workflow publishes immutable artifacts and mutable catal
   const workflow = await readFile(runtimeWorkflowPath, "utf8");
 
   assert.match(workflow, /workflow_dispatch:/);
+  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
+  assert.match(
+    workflow,
+    /paths:\s*\n\s*- config\/tutti\.app-runtime\.lock\.json/
+  );
+  assert.match(workflow, /group: tutti-app-runtime-production/);
+  assert.match(workflow, /cancel-in-progress: false/);
   assert.match(workflow, /config\/tutti\.app-runtime\.lock\.json/);
   assert.match(workflow, /platform === "windows-amd64"/);
   assert.match(workflow, /lock\.python\?\.windows\?\.version/);
```

---

### Incident Patch 10: `f693531e` (2026-08-26)
**Commit Message**: fix(agent-gui): hide retired task-center entry points (#2614)

* fix(agent): classify provider runtime failures

* fix(agent-gui): hide retired task-center entry points

* fix(agent-gui): satisfy degradation line budget

---------

Co-authored-by: rv4no <292825565+rv4no@users.noreply.github.com>

**File**: `packages/agent/daemon/runtime/visible_error.go` (modified, +15/-1)
```diff
@@ -317,6 +317,12 @@ func visibleFailureCode(detail string) string {
 	case strings.Contains(normalized, "session/set_config_option") &&
 		strings.Contains(normalized, "timed out"):
 		return "provider_config_timeout"
+	case strings.Contains(normalized, "stream disconnected before completion") &&
+		strings.Contains(normalized, "modelcode") && strings.Contains(normalized, "不存在"):
+		return "provider_model_not_found"
+	case strings.Contains(normalized, "configured-routes/") &&
+		strings.Contains(normalized, "404 page not found"):
+		return "configured_route_not_found"
 	case strings.Contains(normalized, "stream disconnected before completion") ||
 		strings.Contains(normalized, "stream closed before response.completed"):
 		return "provider_stream_disconnected"
@@ -381,7 +387,7 @@ func structuredRuntimeTransportFailureCode(normalized string) string {
 		end++
 	}
 	code := remainder[:end]
-	if strings.HasPrefix(code, "egress_") || strings.HasPrefix(code, "provider_process_exit_") {
+	if strings.HasPrefix(code, "egress_") || strings.HasPrefix(code, "provider_process_") {
 		return code
 	}
 	return ""
@@ -551,6 +557,10 @@ func visibleFailureContent(provider string, phase string, code string) string {
 			return fmt.Sprintf("%s could not apply session settings before startup timed out. Try again in a moment.", name)
 		case "provider_stream_disconnected":
 			return fmt.Sprintf("%s could not start because the response was interrupted. Try again in a moment.", name)
+		case "provider_model_not_found":
+			return fmt.Sprintf("%s could not start because the selected model was not found. Check the model setting and try again.", name)
+		case "configured_route_not_found":
+			return fmt.Sprintf("%s could not start because its runtime route was not available. Try again in a moment.", name)
 		case "session_interrupted":
 			return fmt.Sprintf("%s stopped unexpectedly before it finished starting. Try again.", name)
 		case "request_timed_out":
@@ -588,6 +598,10 @@ func visibleFailureContent(provider string, phase string, code string) string {
 		return fmt.Sprintf("%s could not apply session settings before the request timed out. Try again in a moment.", name)
 	case "provider_stream_disconnected":
 		return fmt.Sprintf("%s response was interrupted before it completed. Try again in a moment.", name)
+	case "provider_model_not_found":
+		return fmt.Sprintf("%s could not use the selected model because it was not found. Check the model setting and try again.", name)
+	case "configured_route_not_found":
+		return fmt.Sprintf("%s could not reach its runtime route. Try again in a moment.", name)
 	case "provider_empty_response":
 		return fmt.Sprintf("%s returned no response. Check the provider settings or try again.", name)
 	case "session_interrupted":
```

**File**: `packages/agent/daemon/runtime/visible_error_test.go` (modified, +21/-0)
```diff
@@ -120,6 +120,27 @@ func TestVisibleFailureCodeClassifiesStreamDisconnected(t *testing.T) {
 	}
 }
 
+func TestVisibleFailureCodeClassifiesProviderModelNotFound(t *testing.T) {
+	detail := `stream disconnected before completion: modelCode：不存在[2026082021072905b55e622c4a42ba]`
+	if got := visibleFailureCode(detail); got != "provider_model_not_found" {
+		t.Fatalf("visibleFailureCode() = %q, want provider_model_not_found", got)
+	}
+}
+
+func TestVisibleFailureCodeClassifiesConfiguredRouteNotFound(t *testing.T) {
+	detail := `unexpected status 404 Not Found: 404 page not found, url: http://127.0.0.1:7794/_tsh/configured-routes/route-1/v1/responses`
+	if got := visibleFailureCode(detail); got != "configured_route_not_found" {
+		t.Fatalf("visibleFailureCode() = %q, want configured_route_not_found", got)
+	}
+}
+
+func TestVisibleFailureCodeClassifiesClosedProviderStream(t *testing.T) {
+	detail := `provider process stream is closed; error_code=provider_process_stream_closed; stream_phase=send; cause=io: read/write on closed pipe`
+	if got := visibleFailureCode(detail); got != "provider_process_stream_closed" {
+		t.Fatalf("visibleFailureCode() = %q, want provider_process_stream_closed", got)
+	}
+}
+
 func TestVisibleFailureCodeClassifiesProviderEmptyResponse(t *testing.T) {
 	detail := "provider_empty_response: ACP agent ended the turn without assistant output or tool activity"
 	if got := visibleFailureCode(detail); got != "provider_empty_response" {
```

**File**: `packages/agent/gui/agent-gui/agentGuiNode/AgentComposer.tsx` (modified, +8/-2)
```diff
@@ -82,6 +82,8 @@ export type {
 } from "./composer/AgentComposer.types";
 import { useSessionWorktreeLaunch } from "./composer/useSessionWorktreeLaunch";
 
+const EMPTY_HIDDEN_MENTION_FILTER_IDS: readonly string[] = [];
+
 export function AgentComposer(props: AgentComposerProps): React.JSX.Element {
   "use memo";
   const {
@@ -162,7 +164,8 @@ export function AgentComposer(props: AgentComposerProps): React.JSX.Element {
     prepareExternalPromptFiles = null,
     promptAssetLimit = null,
     onRequestGitBranches = null,
-    referenceProvenanceFilters = null
+    referenceProvenanceFilters = null,
+    hiddenMentionFilterIds = EMPTY_HIDDEN_MENTION_FILTER_IDS
   } = props;
   const slashCapabilitiesRefreshedSessionRef = useRef<string | null>(null);
   const handleDraftContentChange = useComposerDraftCapabilitiesRequest({
@@ -317,7 +320,10 @@ export function AgentComposer(props: AgentComposerProps): React.JSX.Element {
   });
   const promptTipRef = useRef<HTMLSpanElement | null>(null);
   const { mentionControllerRef, mentionSearchState } =
-    useAgentMentionSearchController(referenceProvenanceFilters);
+    useAgentMentionSearchController(
+      referenceProvenanceFilters,
+      hiddenMentionFilterIds
+    );
   const editorHandleRef = useRef<AgentRichTextEditorHandle | null>(null);
   const wasActiveRef = useRef(isActive);
   const lastComposerFocusRequestRef = useRef<number | null>(null);
```

**File**: `packages/agent/gui/agent-gui/agentGuiNode/AgentGUINode.tsx` (modified, +2/-0)
```diff
@@ -117,6 +117,7 @@ export const AgentGUINode = memo(function AgentGUINode({
     providerAuthAccountLabels,
     mentionService,
     workspaceAppIcons,
+    hiddenMentionFilterIds,
     disabledHomeSuggestions,
     referenceProvenanceFilterCatalog: injectedReferenceProvenanceFilterCatalog,
     referenceProvenanceFilterEnabled = false,
@@ -489,6 +490,7 @@ export const AgentGUINode = memo(function AgentGUINode({
             <AgentGUINodeView
               viewModel={viewModel}
               mentionAgentTargets={mentionAgentTargets}
+              hiddenMentionFilterIds={hiddenMentionFilterIds}
               renderAgentTargetInfo={renderAgentTargetInfo}
               renderSidebarFooter={renderSidebarFooter}
               renderProviderRailEmpty={renderProviderRailEmpty}
```

**File**: `packages/agent/gui/agent-gui/agentGuiNode/AgentGUINode.types.ts` (modified, +3/-0)
```diff
@@ -166,6 +166,8 @@ export interface AgentGUINodeHostCapabilities {
   agentTargetsLoading?: boolean;
   /** Complete presentation-only catalog for resolving Agent mention identity. */
   mentionAgentTargets?: readonly AgentGUIAgentTarget[];
+  /** Host-owned mention categories to omit from the palette. */
+  hiddenMentionFilterIds?: readonly string[];
   /** Launch-only targets for active-conversation handoff. */
   handoffAgentTargets?: readonly AgentGUIAgentTarget[];
   handoffAgentTargetsLoading?: boolean;
@@ -460,6 +462,7 @@ export function areAgentGUINodePropsEqual(
       nc.referenceProvenanceFilterCatalog &&
     pc.referenceProvenanceFilterEnabled ===
       nc.referenceProvenanceFilterEnabled &&
+    pc.hiddenMentionFilterIds === nc.hiddenMentionFilterIds &&
     pc.sessionInputHistoryEnabled === nc.sessionInputHistoryEnabled &&
     pc.sideConversationEnabled === nc.sideConversationEnabled &&
     pc.sideConversationPresentation === nc.sideConversationPresentation &&
```

#### Recent Merged Pull Requests:
- **PR #2645** (2026-09-05): fix(release): pin macOS packaging to stable runner (@jomeswang)
- **PR #2644** (2026-09-05): fix(agent): backport current Codex CLI requirement to release/0818 (@jomeswang)
- **PR #2643** (2026-09-05): fix(agent): require current Codex CLI (@jomeswang)
- **PR #2642** (closed): fix(agent): support workspace agent cli selection (@rainhotel)
- **PR #2640** (2026-09-02): fix(agent): backport external Claude command protection to release/0818 (@jomeswang)
- **PR #2637** (2026-09-02): chore(release): disable daily desktop builds (@jomeswang)
- **PR #2636** (2026-09-02): fix(agent): preserve external Claude commands (@jomeswang)
- **PR #2634** (closed): fix(cli): expose workspace custom agents (@jomeswang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
