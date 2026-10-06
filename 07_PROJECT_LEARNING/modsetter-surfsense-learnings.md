# Forensic Learning Record (Deep Inspection): MODSetter/SurfSense

> **Canonical Artifact**: `07_PROJECT_LEARNING/modsetter-surfsense-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MODSetter/SurfSense](https://github.com/MODSetter/SurfSense))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:33:32.097Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MODSetter/SurfSense`
- **Description**: Air gapped, privacy focused open source NotebookLM alternative. Join our Discord: https://discord.gg/ejRNvftDp9
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16321 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/sandbox/remotion/render-mindmap.mjs`
```
import {readFile, mkdir, rename, rm, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {
  makeCancelSignal,
  renderStill,
  selectComposition,
} from "@remotion/renderer";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBundle = path.join(rootDir, "bundle");
const renderTimeout = Number(
  process.env.MINDMAP_RENDER_TIMEOUT_MS ?? 20_000,
);
const MAX_NODES = 60;
const MAX_DEPTH = 6;
const MAX_LABEL_LENGTH = 120;
const UNSUPPORTED_MARKDOWN =
  /(^|\s)(?:```|~~~|:::)|(^|\n)\s*(?:>|\|.*\|\s*$)|!\[|\[[^\]\n]+\](?:\(|\[)|<[^>\n]+>/m;

export class MindmapRenderError extends Error {
  constructor(code, error) {
    super(error instanceof Error ? error.message : String(error), {cause: error});
    this.name = "MindmapRenderError";
    this.code = code;
  }
}

function stageError(code, error) {
  return error instanceof MindmapRenderError
    ? error
    : new MindmapRenderError(code, error);
}

export function validateMindmapMarkdown(markdown) {
  if (!markdown.trim()) throw new Error("Mind-map Markdown must not be empty");
  for (let index = 0; index < markdown.length; index += 1) {
    const code = markdown.charCodeAt(index);
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      throw new Error("Mind-map Markdown contains control characters");
    }
  }
  if (UNSUPPORTED_MARKDOWN.test(markdown)) {
    throw new Error("Mind-map Markdown contains an unsupported construct");
  }

  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line));
  if (headings.length !== 1 || !/^#\s+\S/.test(headings[0])) {
    throw new Error("Mind map must have exactly one non-empty level-one heading");
  }
  if (lines.find((line) => line.trim()) !== headings[0]) {
    throw new Error("Mind-map root heading must be the first content");
  }

  let nodes = 1;
  let indentWidth;
  let previousLevel = 0;
  let sawChild = false;
  for (const line of lines) {
    if (!line.trim() || line === headings[0]) continue;
    const match = /^( *)(?:[-+*])\s+(.+)$/.exec(line);
    if (!match) {
      throw new Error("Mind map may contain only one root heading and list nodes");
    }
    const indent = match[1].length;
    if (!sawChild && indent) {
      throw new Error("Mind-map first list node must start at the first level");
    }
    if (indent) {
      if (indentWidth === undefined) {
        indentWidth = indent;
        if (indentWidth < 2 || indentWidth > 4) {
          throw new Error("Mind-map indentation must use 2-4 spaces per level");
        }
      }
      if (indent % indentWidth !== 0) {
        throw new Error("Mind-map list indentation is inconsistent");
      }
    }
    const level = indentWidth === undefined ? 0 : indent / indentWidth;
    if (level > previousLevel + 1) {
      throw new Error("Mind-map hierarchy skips a nesting level");
    }
    const depth = level + 2;
    if (depth > MAX_DEPTH) {
      throw new Error(`Mind map exceeds maximum depth ${MAX_DEPTH}`);
    }
    const label = match[2].trim();
    if (!label) throw new Error("Mind-map node labels must not be empty");
    if (label.length > MAX_LABEL_LENGTH) {
      throw new Error(
        `Mind-map node label exceeds ${MAX_LABEL_LENGTH} characters`,
      );
    }
    nodes += 1;
    if (nodes > MAX_NODES) {
      throw new Error(`Mind map exceeds maximum node count ${MAX_NODES}`);
    }
    previousLevel = level;
    sawChild = true;
  }
  if (!sawChild) throw new Error("Mind map must contain at least one child node");
  return {nodes};
}

export function parseArguments(argv) {
  if (argv.length !== 2) {
    throw new Error(
      "Usage: node /opt/remotion/render-mindmap.mjs input.md output.png",
    );
  }
  const markdownPath = path.resolve(argv[0]);
  const outputPath = path.resolve(argv[1]);
  if (path.extname(outputPath).toLowerCase() !== ".png") {
    throw new Error("Output path must end in .png");
  }
  return {markdownPath, outputPath};
}

export async function renderMindmap(
  argv = process.argv.slice(2),
  {
    serveUrl = process.env.REMOTION_BUNDLE_PATH ?? defaultBundle,
    browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined,
    select = selectComposition,
    render = renderStill,
  } = {},
) {
  if (!Number.isFinite(renderTimeout) || renderTimeout < 1_000) {
    throw new MindmapRenderError(
      "argument_validation",
      new Error("MINDMAP_RENDER_TIMEOUT_MS must be at least 1000"),
    );
  }
  let markdownPath;
  let outputPath;
  try {
    ({markdownPath, outputPath} = parseArguments(argv));
  } catch (error) {
    throw stageError("argument_validation", error);
  }
  let markdown;
  try {
    markdown = new TextDecoder("utf-8", {fatal: true}).decode(
      await readFile(markdownPath),
    );
    validateMindmapMarkdown(markdown);
  } catch (error) {
    throw stageError("markdown_transform", error);
  }

  let composition;
  try {
    await stat(serveUrl);
    composition = await select({
      serveUrl,
      id: "Mindmap",
      inputProps: {markdown},
      browserExecutable,
    });
  } catch (error) {
    throw stageError("layout_readiness", error);
  }
  if (composition.width !== 2400 || composition.height !== 1600) {
    throw new MindmapRenderError(
      "layout_readiness",
      new Error("Mind-map composition must be exactly 2400x1600"),
    );
  }

  await mkdir(path.dirname(outputPath), {recursive: true});
  const stagedOutput = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp.png`,
  );
  const {cancelSignal, cancel} = makeCancelSignal();
  const requestCancel = () => cancel();
  process.once("SIGINT", requestCancel);
  process.once("SIGTERM", requestCancel);
  try {
    await render({
      composition,
      serveUrl,
      output: stagedOutput,
      frame: 0,
      imageFormat: "png",
      inputProps: {markdown},
      overwrite: true,
      chromiumOptions: {enableMultiProcessOnLinux: true},
      timeoutInMilliseconds: renderTimeout,
      cancelSignal,
      browserExecutable,
    });
  } catch (error) {
    await rm(stagedOutput, {force: true});
    const timedOut = /tim(?:ed? out|eout)/i.test(
      error instanceof Error ? error.message : String(error),
    );
    throw stageError(timedOut ? "render_timeout" : "layout_readiness", error);
  } finally {
    process.off("SIGINT", requestCancel);
    process.off("SIGTERM", requestCancel);
  }

  try {
    const output = await stat(stagedOutput);
    if (!output.isFile() || output.size === 0) {
      throw new Error("Mind-map renderer produced no PNG data");
    }
    await rename(stagedOutput, outputPath);
  } catch (error) {
    await rm(stagedOutput, {force: true});
    throw stageError("output_publication", error);
  }

  const result = {
    ok: true,
    output: outputPath,
    width: composition.width,
    height: composition.height,
  };
  console.log(JSON.stringify(result));
  return result;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (invokedPath === import.meta.url) {
  renderMindmap().catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        code:
          error instanceof MindmapRenderError
            ? error.code
            : "mindmap_render_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  });
}

```

### Core Architecture Module: `docker/sandbox/remotion/render-utils.mjs`
```
import {createHash} from "node:crypto";
import {mkdir, readdir, rename, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {build} from "esbuild";

const EMPTY_GENERATED_MODULE =
  "// Replaced by render.mjs before bundling and restored during cleanup.\nexport const sceneComponents = [];\n";

export function validateInputProps(input) {
  if (!input || typeof input !== "object") {
    throw new Error("props.json must contain an object");
  }
  if (!Number.isInteger(input.fps) || input.fps <= 0) {
    throw new Error("fps must be a positive integer");
  }
  if (
    !Number.isInteger(input.min_duration_in_frames) ||
    input.min_duration_in_frames <= 0
  ) {
    throw new Error("min_duration_in_frames must be a positive integer");
  }
  if (!Array.isArray(input.scenes) || input.scenes.length === 0) {
    throw new Error("scenes must be a non-empty array");
  }
  if (input.scenes.length > 12) {
    throw new Error("scenes must contain at most 12 entries");
  }

  const slideNumbers = new Set();
  for (const [index, scene] of input.scenes.entries()) {
    if (!scene || typeof scene !== "object") {
      throw new Error(`scenes[${index}] must be an object`);
    }
    if (!Number.isInteger(scene.slide_number) || scene.slide_number <= 0) {
      throw new Error(`scenes[${index}].slide_number must be a positive integer`);
    }
    if (slideNumbers.has(scene.slide_number)) {
      throw new Error(`Duplicate slide_number ${scene.slide_number}`);
    }
    slideNumbers.add(scene.slide_number);
    if (typeof scene.code !== "string" || !scene.code.trim()) {
      throw new Error(`scenes[${index}].code must be non-empty`);
    }
    if (scene.audio !== undefined) {
      if (
        typeof scene.audio !== "string" ||
        !scene.audio ||
        path.posix.isAbsolute(scene.audio) ||
        path.posix.normalize(scene.audio).startsWith("../")
      ) {
        throw new Error(`scenes[${index}].audio must be a public-relative path`);
      }
    }
  }

  return input;
}

export function cumulativeStartFrames(durations) {
  let offset = 0;
  return durations.map((duration) => {
    const start = offset;
    offset += duration;
    return start;
  });
}

export function scenePreviewFrames(durations) {
  const starts = cumulativeStartFrames(durations);
  return durations.map((duration, index) => {
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new Error(`sceneDurations[${index}] must be a positive integer`);
    }
    const start = starts[index];
    const end = start + duration - 1;
    return [start, start + Math.floor((duration - 1) / 2), end];
  });
}

export function assertDurationLimit(composition, maxDurationSeconds = 180) {
  const durationSeconds = composition.durationInFrames / composition.fps;
  if (durationSeconds > maxDurationSeconds) {
    const error = new Error(
      `Composition duration ${durationSeconds.toFixed(3)}s exceeds ${maxDurationSeconds}s`,
    );
    error.code = "duration_limit";
    throw error;
  }
  return durationSeconds;
}

export function inputHash(source) {
  return createHash("sha256").update(source).digest("hex");
}

export async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true});
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function writeSceneModules(rootDir, scenes) {
  const scenesDir = path.join(rootDir, "src", "scenes");
  await mkdir(scenesDir, {recursive: true});
  await cleanupSceneModules(rootDir);

  await Promise.all(
    scenes.map((scene, index) =>
      writeFile(
        path.join(scenesDir, `scene-${index}.tsx`),
        scene.code,
        "utf8",
      ),
    ),
  );

  const imports = scenes
    .map((_, index) => `import Scene${index} from "./scene-${index}";`)
    .join("\n");
  const components = scenes.map((_, index) => `Scene${index}`).join(", ");
  await writeFile(
    path.join(scenesDir, "generated.ts"),
    `${imports}\n\nexport const sceneComponents = [${components}];\n`,
    "utf8",
  );
}

export async function validateSceneModules(rootDir) {
  await build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: ["src/scenes/generated.ts"],
    jsx: "automatic",
    logLevel: "silent",
    packages: "external",
    platform: "browser",
    tsconfig: path.join(rootDir, "tsconfig.json"),
    write: false,
  });
}

export async function cleanupSceneModules(rootDir) {
  const scenesDir = path.join(rootDir, "src", "scenes");
  let entries;
  try {
    entries = await readdir(scenesDir);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    entries
      .filter((name) => /^scene-\d+\.tsx$/.test(name))
      .map((name) => rm(path.join(scenesDir, name), {force: true})),
  );
  await writeFile(path.join(scenesDir, "generated.ts"), EMPTY_GENERATED_MODULE, "utf8");
}

```

### Core Architecture Module: `docker/sandbox/remotion/render.mjs`
```
import {execFile} from "node:child_process";
import {existsSync} from "node:fs";
import {
  access,
  readFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {promisify} from "node:util";
import {bundle} from "@remotion/bundler";
import {
  makeCancelSignal,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  assertDurationLimit,
  atomicWriteJson,
  cleanupSceneModules,
  inputHash,
  scenePreviewFrames,
  validateInputProps,
  validateSceneModules,
  writeSceneModules,
} from "./render-utils.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(rootDir, "src", "index.ts");
const publicDir = path.join(rootDir, "public");
const configuredTimeout = Number(
  process.env.VIDEO_SANDBOX_RENDER_FRAME_TIMEOUT_MS ?? 7000,
);
const maxFramesPerSegment = Number(
  process.env.VIDEO_SANDBOX_MAX_FRAMES_PER_SEGMENT ?? 1800,
);
const maxDurationSeconds = 180;
const cacheDir = path.join(rootDir, ".remotion-cache");
const progressPath = path.join(rootDir, "progress.json");
const cancelMarkerPath = path.join(rootDir, "cancel");
const execFileAsync = promisify(execFile);

if (!Number.isFinite(configuredTimeout) || configuredTimeout < 7000) {
  throw new Error(
    "VIDEO_SANDBOX_RENDER_FRAME_TIMEOUT_MS must be at least 7000",
  );
}
if (!Number.isInteger(maxFramesPerSegment) || maxFramesPerSegment <= 0) {
  throw new Error(
    "VIDEO_SANDBOX_MAX_FRAMES_PER_SEGMENT must be a positive integer",
  );
}

function createProgressWriter() {
  let writes = Promise.resolve();
  return {
    write(snapshot) {
      writes = writes.then(() =>
        atomicWriteJson(progressPath, {
          ...snapshot,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    flush() {
      return writes;
    },
  };
}

function createCancellation() {
  let requested = false;
  let activeCancel;
  const request = () => {
    requested = true;
    activeCancel?.();
  };
  const poll = () => {
    if (existsSync(cancelMarkerPath)) request();
    return requested;
  };
  const assertActive = () => {
    if (!poll()) return;
    const error = new Error("Render cancelled");
    error.code = "cancelled";
    throw error;
  };
  const withSignal = async (operation) => {
    assertActive();
    const {cancelSignal, cancel} = makeCancelSignal();
    activeCancel = cancel;
    if (poll()) cancel();
    try {
      return await operation(cancelSignal);
    } catch (error) {
      if (requested || String(error?.message).includes("got cancelled")) {
        const cancellationError = new Error("Render cancelled");
        cancellationError.code = "cancelled";
        throw cancellationError;
      }
      throw error;
    } finally {
      activeCancel = undefined;
    }
  };
  process.on("SIGTERM", request);
  process.on("SIGINT", request);
  return {
    assertActive,
    poll,
    withSignal,
    dispose() {
      process.off("SIGTERM", request);
      process.off("SIGINT", request);
    },
  };
}

async function ensureBundle(hash) {
  const bundleDir = path.join(cacheDir, hash, "bundle");
  const completeMarker = path.join(cacheDir, hash, "complete");
  try {
    await Promise.all([access(completeMarker), access(bundleDir)]);
    return {serveUrl: bundleDir, reused: true};
  } catch {
    await rm(path.dirname(bundleDir), {recursive: true, force: true});
  }
  await mkdir(path.dirname(bundleDir), {recursive: true});
  try {
    const serveUrl = await bundle({entryPoint, publicDir, outDir: bundleDir});
    await writeFile(completeMarker, `${hash}\n`, "utf8");
    return {serveUrl, reused: false};
  } catch (error) {
    await rm(path.dirname(bundleDir), {recursive: true, force: true});
    throw error;
  }
}

function structuredDiagnostic(error, inputProps, phase) {
  const message = error instanceof Error ? error.message : String(error);
  const index = inputProps.scenes.findIndex((_, sceneIndex) =>
    message.includes(`scene-${sceneIndex}.tsx`),
  );
  return {
    ok: false,
    phase,
    code: error?.code ?? "remotion_error",
    message,
    ...(index === -1
      ? {}
      : {
          scene: inputProps.scenes[index].slide_number,
          file: `src/scenes/scene-${index}.tsx`,
        }),
  };
}

async function renderVideo({
  cancellation,
  composition,
  serveUrl,
  inputProps,
  outputPath,
  progress,
  workDir,
}) {
  const segmentCount = Math.ceil(
    composition.durationInFrames / maxFramesPerSegment,
  );
  const segmentPaths = [];
  const segmentDurations = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const start = index * maxFramesPerSegment;
    const end = Math.min(
      composition.durationInFrames - 1,
      start + maxFramesPerSegment - 1,
    );
    const segmentPath = path.join(workDir, `segment-${index}.mp4`);
    const segmentStartedAt = Date.now();
    await cancellation.withSignal((cancelSignal) =>
      renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: segmentPath,
        inputProps,
        frameRange: [start, end],
        chromiumOptions: {enableMultiProcessOnLinux: true},
        timeoutInMilliseconds: configuredTimeout,
        cancelSignal,
        onProgress: ({progress: segmentProgress}) => {
          cancellation.poll();
          progress.write({
            phase: "render",
            progress: (index + segmentProgress) / segmentCount,
            segment: index + 1,
            segment_count: segmentCount,
          });
        },
      }),
    );
    console.log(
      `SURFSENSE_SEGMENT_SECONDS=${(Date.now() - segmentStartedAt) / 1000}`,
    );
    segmentPaths.push(segmentPath);
    segmentDurations.push((end - start + 1) / composition.fps);
  }

  if (segmentPaths.length === 1) {
    await execFileAsync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-i",
      segmentPaths[0],
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  } else {
    const manifestPath = path.join(workDir, "segments.txt");
    await writeFile(
      manifestPath,
      segmentPaths.map((segment) => `file '${segment}'`).join("\n"),
      "utf8",
    );
    await execFileAsync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  }
  await writeFile(
    `${outputPath}.segments.json`,
    JSON.stringify({
      expected_duration_seconds:
        composition.durationInFrames / composition.fps,
      segment_durations_seconds: segmentDurations,
      render_workdir: rootDir,
    }),
    "utf8",
  );
  console.log(`SURFSENSE_SEGMENT_COUNT=${segmentCount}`);
}

export async function render(argv = process.argv.slice(2)) {
  const mode =
    argv[0] === "--preflight"
      ? "preflight"
      : argv[0] === "--stills"
        ? "stills"
        : "render";
  const propsArg = mode === "render" ? argv[0] : argv[1];
  const outputArg = mode === "render" ? argv[1] : argv[2];
  const expectedArguments = mode === "preflight" ? 2 : mode === "stills" ? 3 : 2;
  if (
    !propsArg ||
    (mode !== "preflight" && !outputArg) ||
    argv.length !== expectedArguments
  ) {
    throw new Error(
      "Usage: node render.mjs --preflight props.json | --stills props.json outdir | props.json out.mp4",
    );
  }

  const propsPath = path.resolve(propsArg);
  const outputPath = outputArg ? path.resolve(outputArg) : undefined;
  let propsSource;
  let inputProps;
  try {
    propsSource = await readFile(propsPath, "utf8");
    inputProps = validateInputProps(JSON.parse(propsSource));
  } catch (error) {
    const diagnostic = {
      ok: false,
      phase: "validate",
      code: error?.code ?? "invalid_props",
      message: error instanceof Error ? error.message : String(error),
    };
    if (error && typeof error === "object") error.diagnostic = diagnostic;
    throw error;
  }
  const temporaryDir = await mkdtemp(path.join(tmpdir(), "surfsense-remotion-"));
  const progress = createProgressWriter();
  const cancellation = createCancellation();
  let phase = "write";

  try {
    progress.write({phase, progress: 0});
    cancellation.assertActive();
    await writeSceneModules(rootDir, inputProps.scenes);
    phase = "bundle";
    progress.write({phase, progress: 0});
    await validateSceneModules(rootDir);
    const hash = inputHash(propsSource);
    const {serveUrl, reused} = await ensureBundle(hash);
    phase = "select_composition";
    progress.write({phase, progress: 0});
    const composition = await selectComposition({
      serveUrl,
      id: "Main",
      inputProps,
    });
    const durationSeconds = assertDurationLimit(
      composition,
      maxDurationSeconds,
    );
    progress.write({phase, progress: 1, duration_seconds: durationSeconds});

    if (mode === "preflight") {
      const result = {
        ok: true,
        phase: "preflight",
        bundle_hash: hash,
        bundle_reused: reused,
        duration_seconds: durationSeconds,
        duration_in_frames: composition.durationInFrames,
        fps: composition.fps,
      };
      progress.write({phase: "preflight", progress: 1, ...result});
      await progress.flush();
      console.log(JSON.stringify(result));
      return result;
    }

    if (mode === "stills") {
      phase = "stills";
      const sceneDurations = composition.props.sceneDurations;
      if (!Array.isArray(sceneDurations)) {
        throw new Error("calculateMetadata did not return sceneDurations");
      }
      const frames = scenePreviewFrames(sceneDurations);
      await mkdir(path.dirname(outputPath), {recursive: true});
      const stagingDir = await mkdtemp(
        path.join(path.dirname(outputPath), ".remotion-stills-"),
      );
      try {
   
```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/__init__.py`
```
"""The surfsense-plugins command: what authors, CI and maintainers run outside the app."""

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/__main__.py`
```
"""python -m surfsense_plugin_cli, the same command as surfsense-plugins."""

from surfsense_plugin_cli.main import app

app()

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/__init__.py`
```
"""A plugin's dependencies: the short list it asks for, and the pins every platform installs."""

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/add.py`
```
"""surfsense-plugins add: a library the plugin needs, listed and pinned."""

from typing import Annotated

import typer

from surfsense_plugin_cli.dependencies.listed import library_name, listed
from surfsense_plugin_cli.dependencies.rewrite_and_pin import rewrite_and_pin
from surfsense_plugin_cli.plugin_folder import plugin_folder


def add(
    plugin: Annotated[
        str, typer.Argument(help="The plugin's id, such as hn-search, or its folder.")
    ],
    requirements: Annotated[
        list[str], typer.Argument(help="A library, such as lxml or 'requests>=2'.")
    ],
) -> None:
    """Add libraries to a plugin, pinned for every platform it runs on.

    Example: surfsense-plugins add hn-search lxml
    """
    folder = plugin_folder(plugin)
    lines = listed(folder.path)
    for requirement in requirements:
        name = library_name(requirement)
        # A library already listed takes the new version range in its place.
        lines = [line for line in lines if library_name(line) != name]
        lines.append(requirement)
    pinned = rewrite_and_pin(folder, lines)
    typer.echo(f"Added {', '.join(requirements)} to {folder.manifest.id}: {pinned}.")

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/listed.py`
```
"""requirements.in: the libraries a plugin asks for, as the author wrote them."""

import re
from pathlib import Path


def listed(plugin: Path) -> list[str]:
    """Its lines, or none when the plugin has no dependencies."""
    path = plugin / "requirements.in"
    return path.read_text(encoding="utf-8").splitlines() if path.is_file() else []


def library_name(requirement: str) -> str:
    """The name pip compares: tiny_lib, Tiny.Lib and tiny-lib are one library."""
    match = re.match(r"\s*([A-Za-z0-9][A-Za-z0-9._-]*)", requirement)
    return re.sub(r"[-_.]+", "-", match.group(1)).lower() if match else ""

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/pin_dependencies.py`
```
"""surfsense-plugins pin-dependencies: pins again what requirements.in lists."""

from typing import Annotated

import typer

from surfsense_plugin_cli.dependencies.listed import listed
from surfsense_plugin_cli.dependencies.rewrite_and_pin import rewrite_and_pin
from surfsense_plugin_cli.plugin_folder import plugin_folder


def pin_dependencies(
    plugin: Annotated[
        str, typer.Argument(help="The plugin's id, such as hn-search, or its folder.")
    ],
) -> None:
    """Pin a plugin's dependencies again, after editing requirements.in by hand.

    Example: surfsense-plugins pin-dependencies hn-search
    """
    folder = plugin_folder(plugin)
    lines = listed(folder.path)
    if not lines:
        typer.echo(
            f"{folder.manifest.id} lists no dependencies: add one with"
            f" surfsense-plugins add {folder.manifest.id} <library>",
            err=True,
        )
        raise typer.Exit(1)
    typer.echo(f"{rewrite_and_pin(folder, lines)}.")

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/remove.py`
```
"""surfsense-plugins remove: a library the plugin no longer needs."""

from typing import Annotated

import typer

from surfsense_plugin_cli.dependencies.listed import library_name, listed
from surfsense_plugin_cli.dependencies.rewrite_and_pin import rewrite_and_pin
from surfsense_plugin_cli.plugin_folder import plugin_folder


def remove(
    plugin: Annotated[
        str, typer.Argument(help="The plugin's id, such as hn-search, or its folder.")
    ],
    names: Annotated[list[str], typer.Argument(help="A library the plugin lists.")],
) -> None:
    """Remove libraries from a plugin, and pin what remains.

    Example: surfsense-plugins remove hn-search lxml
    """
    folder = plugin_folder(plugin)
    lines = listed(folder.path)
    for name in names:
        kept = [line for line in lines if library_name(line) != library_name(name)]
        if kept == lines:
            typer.echo(f"{folder.manifest.id} does not list {name}", err=True)
            raise typer.Exit(1)
        lines = kept
    pinned = rewrite_and_pin(folder, lines)
    typer.echo(f"Removed {', '.join(names)}: {pinned}.")

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/dependencies/rewrite_and_pin.py`
```
"""Writes requirements.in and pins requirements.txt from it, the one way all three commands do."""

import re
import subprocess

import typer
from uv import find_uv_bin

from surfsense_plugin_cli.build_targets import build_targets
from surfsense_plugin_cli.plugin_folder import PluginFolder

FILES = ("requirements.in", "requirements.txt")


def rewrite_and_pin(plugin: PluginFolder, lines: list[str]) -> str:
    """Both files updated together, or both put back as they were.

    Returns what is pinned now, in words, for the command to tell the author.
    """
    before = {name: _read(plugin, name) for name in FILES}
    if not lines:
        for name in FILES:
            (plugin.path / name).unlink(missing_ok=True)
        return f"{plugin.manifest.id} has no dependencies left"
    (plugin.path / "requirements.in").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    refused = _pin(plugin)
    if refused:
        for name, text in before.items():
            _restore(plugin, name, text)
        typer.echo(f"the dependencies cannot be pinned:\n{refused}", err=True)
        raise typer.Exit(1)
    pinned = _pinned_packages(plugin)
    return f"requirements.txt pins {pinned} package{'' if pinned == 1 else 's'}"


def _pin(plugin: PluginFolder) -> str | None:
    """Every version and file hash, for every platform. uv's reason when it cannot.

    uv keeps what requirements.txt already pins, so one change upgrades nothing else.
    """
    finished = subprocess.run(
        [
            find_uv_bin(),
            "pip",
            "compile",
            "--quiet",
            "--universal",
            "--generate-hashes",
            "--python-version",
            build_targets().python,
            "--custom-compile-command",
            f"surfsense-plugins pin-dependencies {plugin.manifest.id}",
            "requirements.in",
            "--output-file",
            "requirements.txt",
        ],
        cwd=plugin.path,
        capture_output=True,
        text=True,
    )
    return finished.stderr.strip() if finished.returncode != 0 else None


def _pinned_packages(plugin: PluginFolder) -> int:
    """How many packages requirements.txt pins, the libraries' own dependencies included."""
    pinned = _read(plugin, "requirements.txt") or ""
    return len(re.findall(r"^[A-Za-z0-9][^=\s]*==", pinned, re.MULTILINE))


def _read(plugin: PluginFolder, name: str) -> str | None:
    """A file's text, or None when the plugin has no such file."""
    path = plugin.path / name
    return path.read_text(encoding="utf-8") if path.is_file() else None


def _restore(plugin: PluginFolder, name: str, text: str | None) -> None:
    """A file as it was, including not being there at all."""
    path = plugin.path / name
    if text is None:
        path.unlink(missing_ok=True)
    else:
        path.write_text(text, encoding="utf-8")

```

### Core Architecture Module: `plugins/core/cli/surfsense_plugin_cli/invoke/__init__.py`
```
"""Runs one action of a plugin once, against the author's running SurfSense."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2141** (2026-10-02): **The workspace event stream adds an abort listener on every retry and never removes it**
  *Symptoms*: ## The gap  [`docs/architecture/overview.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/overview.md) lists this under **Known gaps**, added in #2140:  > The retry `wait()` in [`workspace-changes.ts`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/frontend/src/features/workspaces/workspace-changes.ts) never removes its `abort` listener when its timer fires, so a stream that keeps dropping, as it does while the API is down, adds one listener to the workspace's signal per attempt, about 360 an hour, until the last list leaves. It also waits out its timer when the signal is already aborted, so a stream torn down between attempts takes up to 10 seconds to stop.  ## Why it matters  The sources panel and the Studio list share this one stream per workspace since #2126, and it reconnects whenever it drops: the API restarts, the machine sleeps, the sidecar crashes. While the API stays down, `follow()` retries every 10 seconds, and each retry's `wait()` leaves a closure on the signal, holding its timer and its settled promise, until the workspace is left. Nothing breaks and nothing logs, which is why it went unnoticed; a window left open on a broken backend just keeps growing.  ## Where  - [`surfsense_local/frontend/src/features/workspaces/workspace-changes.ts`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/frontend/src/features/workspaces/workspace-changes.ts): `wait()`, which `follow()` awaits after every dropped or refused st
  **Post-Mortem & Fix Analysis**:
  > Fixed by #2142, merged into `dev`, by @DYNOSuprovo.  `wait()` in `features/workspaces/workspace-changes.ts` now removes its `abort` listener when its timer fires, so a stream that keeps dropping no longer leaves one behind per attempt, and it returns at once when the signal is already aborted, so a stream torn down between attempts stops without waiting out its retry. It takes the shape of `use-studio.ts`'s `wait()`, plus the early return. `workspace-changes.test.ts` drives two dropped streams and checks that every listener `wait()` adds is removed again, and that a teardown during a retry wait clears the timer and fetches nothing more.  The Known gaps line this issue quoted is deleted in the same PR. Closing by hand: GitHub only auto-closes on a merge to the default branch, and we merge through `dev`.

- **Issue #2005** (2026-09-29): **Celery beat keeps scheduling hosted work while `SUNSET_MODE` is on**
  *Symptoms*: ## The gap  [`docs/architecture/sunset.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/sunset.md) lists this under **Known gaps**:  > Celery beat keeps scheduling its periodic tasks, connector indexing checks and automation triggers among them, and none checks `is_sunset_mode()`; the middleware covers HTTP only.  ## Why it matters  `SunsetWriteBlockMiddleware` decides on the method and path of an HTTP request. Beat never makes one, so from T-0 the service refuses a user's own write while its scheduler goes on writing on their behalf: `check_periodic_schedules` keeps re-indexing connectors, and the automation schedule triggers keep firing runs.  That costs third-party API quota, embedding spend and worker time on documents nobody can reach through an app that redirects to `/sunset`, and all of it is deleted on 18 Oct 2026 anyway. It also reaches outward — a connector index is a call to someone else's API, made on behalf of an account that has been told the service is closed.  ## Where  - [`surfsense_backend/app/celery_app.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_backend/app/celery_app.py) — `celery_app.conf.beat_schedule` holds every entry, and merges `SCHEDULE_BEAT_SCHEDULE` in at the end. - [`surfsense_backend/app/tasks/celery_tasks/schedule_checker_task.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_backend/app/tasks/celery_tasks/schedule_checker_task.py) — `check_periodic_schedules_task()`, the met
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this issue. I'll audit the Beat entries against the sunset runbook, guard hosted-app work at task boundaries while preserving licensing, scraper, and shared housekeeping schedules, add sunset-on/off regression tests, and update the documented Known gap after verification.
  > Fixed by #2020, `fix(sunset): pause hosted recurring user work`, by @sb123sb123. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #2005` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #2003** (2026-09-29): **Gate the web sunset redirect on `DEPLOYMENT_MODE`**
  *Symptoms*: ## The gap  [`docs/architecture/sunset.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/sunset.md) lists this under **Known gaps**:  > The web redirect is not gated on `DEPLOYMENT_MODE`: a self-hosted web app with `SUNSET_MODE` set redirects to `/sunset`.  ## Why it matters  The backend half of this switch has a safety net and the web half does not. `is_sunset_mode()` returns false unless `DEPLOYMENT_MODE=cloud`, precisely so that a `.env` copied from a hosted template cannot take a self-hosted install down. `shouldRedirectToSunset()` checks `SUNSET_MODE` alone, so the same stray line in `surfsense_web/.env` sends every app route of a self-hosted install to `/sunset` — a page about a wind-down that has nothing to do with them — while their own backend goes on accepting writes.  The operator gets no error and no log line. The app simply stops being reachable, which is the outage [ADR 0023](https://github.com/MODSetter/SurfSense/blob/dev/docs/adr/0023-sunset-behind-flags.md) says these flags exist to prevent.  ## Where  - [`surfsense_web/lib/sunset.ts`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_web/lib/sunset.ts) — `shouldRedirectToSunset()` decides on the flag and the pathname only. - [`surfsense_web/proxy.ts`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_web/proxy.ts) — the one caller, passing `process.env.SUNSET_MODE`. - `DEPLOYMENT_MODE` is already a runtime variable in this tree, so do not invent a second n
  **Post-Mortem & Fix Analysis**:
  > I'll work on this one , can I get assigned?
  > Fixed by #2023, `fix(sunset): gate the web redirect on DEPLOYMENT_MODE`, by @MannXo. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #2003` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1993** (2026-09-29): **Tooltip text is not announced to screen readers**
  *Symptoms*: ## The gap  [`docs/architecture/overview.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/overview.md) lists this under **Known gaps**:  > Base UI tooltips are visual only, with no `role="tooltip"` or `aria-describedby`, so text that appears only in a tooltip is not announced to screen readers: the Studio format explanations and the retry hints on failed sources and artifacts.  ## Why it matters  The Studio format tooltip is the only place that says what a format produces, and on an unavailable format it is the only place that says why it is greyed out. The retry hints are the only place that says whether a failed row was cancelled or failed. A screen reader user reaches those controls, hears the label, and gets none of the explanation — not because it is hidden, but because nothing connects the popup to the control it describes.  The popup is also `pointer-events-none` and rendered through a portal at the end of the document, so even a user who could reach it cannot, and reading order puts it nowhere near its trigger.  ## Where  - [`surfsense_local/frontend/src/components/ui/tooltip.tsx`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/frontend/src/components/ui/tooltip.tsx) — `TooltipContent` renders `TooltipPrimitive.Popup` with a `data-slot` and no role, and `TooltipTrigger` passes straight through. Fix it here once. Every consumer imports these four components, so a per-caller fix would be the same change written five t
  **Post-Mortem & Fix Analysis**:
  > Fixed by #2018, `fix(ui): connect tooltip descriptions to screen readers with role and aria-describedby`, by @AdamMagued. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1993` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1989** (2026-09-29): **Give `LlamaCppProvider` an `inspect()` so `from_llamacpp()` is used**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/selection.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/selection.md) lists this under **Known gaps**:  > Local fingerprints come from the filename only: `LlamaCppProvider` has no `inspect()`, so `from_llamacpp()`, which reads `general.parameter_count` from `/props`, is never called.  ## Why it matters  Everything needed is already here and wired to nothing. `from_llamacpp()` exists, is tested, and reads the exact parameter count the runtime states. `_collect()` in selection already calls `provider.inspect(model_name)` for a local model. The method it calls does not exist, the resulting `AttributeError` is caught alongside the network failures, and the code falls through to reading the size out of the filename.  So a local model is tiered by whatever the person who quantized it happened to put in the file name. `Qwen3-8B-Q4_K_M` works. A file renamed, or published without a size, has no count at all, and with no count and no vendor a local model falls to `compact` — which happens to be right often enough that this has gone unnoticed, and is simply wrong for a local 70B.  ## Where  - [`surfsense_local/backend/modules/llm/providers/llamacpp/provider.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/backend/modules/llm/providers/llamacpp/provider.py) — `LlamaCppProvider`. This is where `inspect()` goes; `context_tokens()` and `capabilities()` right above it show th
  **Post-Mortem & Fix Analysis**:
  > I would like to take this. I will add `LlamaCppProvider.inspect()` using the existing `/props` client and `from_llamacpp()` path, preserve the filename fallback on runtime failures, update the selection architecture doc, and add the focused provider regression test described here.
  > Fixed by #2034, `fix(local): inspect llama.cpp model size at selection`, by @fukalous. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1989` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1988** (2026-09-29): **A listing row with no Hugging Face id ignores the size in the model name**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/selection.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/selection.md) lists this under **Known gaps**:  > A remote listing row with no `hugging_face_id` always sets `vendor` (to `owned_by`, or to the id's prefix even when that is empty) and never reads the size in the name, so such a model is classified `frontier`: a `qwen3-4b` from a local endpoint whose listing carries no `hugging_face_id` gets frontier prompts. Featherless lists every model this way (`"owned_by": "Feather"`, no `hugging_face_id`), so every model there, Qwen3 0.6B included, gets frontier prompts.  ## Why it matters  `from_remote()` takes one look at a listing row, sees no `hugging_face_id`, and stops. It sets a vendor and returns — never reading `qwen3-4b`, which states the size right there in the id. A vendor with no count classifies as `frontier`, so a 4B model is prompted as if it were a hundred times larger.  That is not an edge case. Featherless lists its entire catalogue without a `hugging_face_id`, so every model on that endpoint, down to Qwen3 0.6B, gets frontier prompts. Frontier prompts give judgement where a compact model needs steps, which is the failure the tiers exist to prevent.  There is a second, smaller defect in the same two lines: when `owned_by` is absent and the id has no `/`, `described.rpartition("/")[0]` is the empty string, and an empty string is still "a vendor is known" as far as `class
  **Post-Mortem & Fix Analysis**:
  > Fixed by #2029, `fix(local): read the size in a Featherless-shaped listing row's id`, by @jamalkamaladdin. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1988` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1987** (2026-09-29): **Key the prompt-tier fallback on a loopback host, not the provider name**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/selection.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/selection.md) lists this under **Known gaps**:  > The tier fallback keys on the provider name, not on loopback: `Fingerprint.local` is `provider == "llamacpp"`, so a local endpoint reached through a connection falls to `capable` when nothing else is known; the decision is to key on `host_destination()`, which already computes loopback.  ## Why it matters  The last two rows of the tier table are one bet: a hosted endpoint runs models too big for a laptop, a local one runs the laptop. Running a 4B through LM Studio or Ollama on `localhost` is a local model by every measure that matters, but it arrives as `openai_compatible`, so when the name states no size it gets `capable` prompts — scaffolding written for a model large enough to follow it. On a compact model that instruction structure costs accuracy, which is the finding the thresholds exist to encode.  The fix is decided, not open. `host_destination()` already answers this question for egress, and both the docstring on `Fingerprint.local` and the comment in `classify()` already describe keying on where the endpoint is rather than what the provider is called. The code underneath does the other thing.  ## Where  - [`surfsense_local/backend/modules/llm/profile/types.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/backend/modules/llm/profile/types.py) — `Fin
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one — PR is up: #2051. `Fingerprint` carries `loopback`, set by `SelectedModel.fingerprint` from its connection through `host_destination()`; the connection is a joined relationship so the tier stays computed on read with no lazy query and nothing stored. The trade-off against setting it where each caller builds the fingerprint is in the PR.
  > Fixed by #2051, `fix(local): give a loopback connection's unknown model the compact prompt`, by @Cedric921. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1987` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1985** (2026-09-30): **The startup model warm is thrown away by the preset watcher's restart**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/runtime.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/runtime.md) lists this under **Known gaps**:  > The startup warm most likely loads into a router that is about to restart: `reprice()` rewrites the preset on every start, `watchGenerationPreset()` starts watching before the API is healthy and restarts the sidecar within 5 seconds of the rewrite, and `warm_selected()` sends the load straight after `reprice()` returns. This is from reading the code, not a measurement.  ## Why it matters  The startup warm exists so the first question of a session does not sit in silence for the ten to twenty-six seconds a cold load takes, with nothing on screen to explain the wait. On startup it probably buys nothing at all: the preset is rewritten whether or not anything about the models changed, Electron sees a new size and mtime within five seconds and restarts `llama-server`, and the restart throws away the model the warm just finished loading. The user waits exactly as long as they would have without the warm, and the machine has done the work twice.  `write_presets()` already carries a TODO naming the fix, so this is a confirmation plus a small change rather than a design question.  ## Where  - [`surfsense_local/backend/modules/llm/providers/llamacpp/preset.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/backend/modules/llm/providers/llamacpp/preset.py) — `write_presets(
  **Post-Mortem & Fix Analysis**:
  > I am taking this. I reproduced the no-op rewrite through the preset mtime, added coverage for both unchanged and genuinely changed catalogs, and have a tested fix that preserves atomic replacement. The implementation was AI-assisted and the local diff was reviewed and approved by a human before submission.
  > Fixed by #2064, merged into `dev`, by @fukalous.  `write_presets()` compares the rendered text against the file and returns before touching it when nothing changed, so the mtime holds and Electron keeps the sidecar that the startup warm just loaded into. It implements the `TODO` that was already sitting in that function pointing at this gap.  The Known gaps line this issue quoted is deleted in the same PR. Closing by hand: GitHub only auto-closes on a merge to the default branch, and we merge through `dev`.

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

### Incident Patch 1: `0847e12f` (2026-10-03)
**Commit Message**: Merge pull request #2166 from MODSetter/fix/release-artifact-actions-node-24

[CI|Release] Run the artifact actions on Node 24

**File**: `.github/workflows/build-audiocpp.yml` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ jobs:
       - name: Pack
         run: tar -cf audiocpp.tar audiocpp
 
-      - uses: actions/upload-artifact@v4
+      - uses: actions/upload-artifact@v7
         with:
           name: audiocpp-${{ runner.os }}
           path: surfsense_local/electron/audiocpp.tar
```

**File**: `.github/workflows/build-sdcpp.yml` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ jobs:
       - name: Pack
         run: tar -cf sdcpp.tar sdcpp
 
-      - uses: actions/upload-artifact@v4
+      - uses: actions/upload-artifact@v7
         with:
           name: sdcpp-${{ runner.os }}
           path: surfsense_local/electron/sdcpp.tar
```

**File**: `.github/workflows/release-local.yml` (modified, +3/-3)
```diff
@@ -223,7 +223,7 @@ jobs:
 
       - name: Fetch the audio.cpp build
         if: runner.os != 'macOS'
-        uses: actions/download-artifact@v4
+        uses: actions/download-artifact@v8
         with:
           name: audiocpp-${{ runner.os }}
           path: surfsense_local/electron
@@ -236,7 +236,7 @@ jobs:
 
       - name: Fetch the sd.cpp build
         if: runner.os != 'Windows'
-        uses: actions/download-artifact@v4
+        uses: actions/download-artifact@v8
         with:
           name: sdcpp-${{ runner.os }}
           path: surfsense_local/electron
@@ -339,7 +339,7 @@ jobs:
           test -f "$DIR/stable-diffusion.cpp.txt"
 
       - name: Upload installers
-        uses: actions/upload-artifact@v4
+        uses: actions/upload-artifact@v7
         with:
           name: surfsense-local-${{ matrix.os }}
           path: |
```

---

### Incident Patch 2: `801e2003` (2026-10-03)
**Commit Message**: Merge pull request #2162 from MODSetter/fix/node-24

[CI|Node] Build the website and the installers on Node 24

**File**: `.github/workflows/build-audiocpp.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
 
       - uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           # The scripts need Node only, not the app's pnpm install.
           package-manager-cache: false
 
```

**File**: `.github/workflows/build-sdcpp.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
 
       - uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           # The scripts need Node only, not the app's pnpm install.
           package-manager-cache: false
 
```

**File**: `.github/workflows/docker-tests.yml` (modified, +9/-6)
```diff
@@ -134,11 +134,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
@@ -169,11 +170,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
@@ -369,11 +371,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
```

**File**: `.github/workflows/release-local.yml` (modified, +2/-1)
```diff
@@ -137,10 +137,11 @@ jobs:
           # Both desktop trees pin the same pnpm; the root one is the web app's.
           package_json_file: surfsense_local/electron/package.json
 
+      # Node 24, as desktop-tests: the Node that Electron 44 embeds.
       - name: Setup Node.js
         uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           cache: pnpm
           cache-dependency-path: |
             surfsense_local/frontend/pnpm-lock.yaml
```

**File**: `surfsense_web/Dockerfile` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # syntax=docker.io/docker/dockerfile:1
 
-FROM node:20-alpine AS base
+FROM node:24-alpine AS base
 
 # Install dependencies only when needed
 FROM base AS deps
```

**File**: `surfsense_web/package.json` (modified, +4/-1)
```diff
@@ -3,6 +3,9 @@
 	"version": "0.0.40",
 	"private": true,
 	"packageManager": "pnpm@10.26.0",
+	"engines": {
+		"node": "24.x"
+	},
 	"description": "SurfSense Frontend",
 	"scripts": {
 		"dev": "next dev --turbopack",
@@ -171,7 +174,7 @@
 		"@types/canvas-confetti": "^1.9.0",
 		"@types/gapi": "^0.0.47",
 		"@types/google.picker": "^0.0.52",
-		"@types/node": "^20.19.9",
+		"@types/node": "^24",
 		"@types/pg": "^8.15.5",
 		"@types/react": "^19.1.8",
 		"@types/react-dom": "^19.1.6",
```

**File**: `surfsense_web/pnpm-lock.yaml` (modified, +52/-52)
```diff
@@ -73,7 +73,7 @@ importers:
         version: 52.0.15(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
       '@platejs/dnd':
         specifier: ^52.0.11
-        version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dnd-html5-backend@16.0.1)(react-dnd@16.0.1(@types/node@20.19.33)(@types/react@19.2.14)(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
+        version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dnd-html5-backend@16.0.1)(react-dnd@16.0.1(@types/node@24.19.0)(@types/react@19.2.14)(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
       '@platejs/floating':
         specifier: ^52.0.11
         version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
@@ -250,19 +250,19 @@ importers:
         version: 3.2.0
       fumadocs-core:
         specifier: ^16.3.1
-        version: 16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6)
+        version: 16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6)
       fumadocs-mdx:
         specifier: ^14.2.1
-        version: 14.3.0(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react@19.2.4)(vite@7.3.6(@types/node@20.19.33)(jiti@2.6.1)(lightningcss@1.31.1)(tsx@4.23.15)(yaml@2.9.0))
+        version: 14.3.0(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react@19.2.4)(vite@7.3.6(@types/node@24.19.0)(jiti@2.6.1)(lightningcss@1.31.1)(tsx@4.23.15)(yaml@2.9.0))
       fumadocs-ui:
         specifier: ^16.3.1
-        version: 16.6.5(@types/react-dom@19.2.3(@types/react@19.2.14))(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(tailwindcss@4.2.1)
+        version: 16.6.5(@types/react-dom@19.2.3(@types/react@19.2.14))(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(reac
```

---

### Incident Patch 3: `e1d30b29` (2026-10-03)
**Commit Message**: Merge pull request #2165 from MODSetter/fix/web-format-drift

[Web|Lint] Format the files Biome flags on dev

**File**: `surfsense_web/app/(home)/downloads/page.tsx` (modified, +1/-3)
```diff
@@ -25,9 +25,7 @@ export default async function DownloadsPage() {
 			<section className="ss-home-hero ss-home-pad">
 				<div className="mx-auto max-w-2xl text-center">
 					<h1 className="ss-home-display">Download SurfSense</h1>
-					<p className="ss-home-lede mx-auto mt-6 max-w-xl">
-						One installer, no account, no cloud.
-					</p>
+					<p className="ss-home-lede mx-auto mt-6 max-w-xl">One installer, no account, no cloud.</p>
 					<TrialForm label="Download" note="" />
 				</div>
 			</section>
```

**File**: `surfsense_web/app/(home)/private-ai-for-business/page.tsx` (modified, +11/-11)
```diff
@@ -68,9 +68,7 @@ export const metadata: Metadata = {
 		url: canonicalUrl,
 		siteName: "SurfSense",
 		type: "website",
-		images: [
-			{ url: "/og-image.png", width: 1200, height: 630, alt: "Private AI for business" },
-		],
+		images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Private AI for business" }],
 	},
 	twitter: {
 		card: "summary_large_image",
@@ -158,8 +156,8 @@ export default function PrivateAiForBusinessPage() {
 					    you have the file, the deliverable comes out here, nothing is
 					    uploaded, so there is no copy for anyone to reach. */}
 					<p className="ss-home-lede mx-auto mt-8 max-w-2xl">
-						You already have the file. The deliverable comes out on the same machine it went in
-						on: nothing is uploaded, so there is no vendor copy of your client's contract, your
+						You already have the file. The deliverable comes out on the same machine it went in on:
+						nothing is uploaded, so there is no vendor copy of your client's contract, your
 						patient's notes or your firm's numbers, and nothing for anyone to subpoena from us.
 					</p>
 					<p className="ss-home-body mx-auto mt-5 max-w-2xl text-sm">
@@ -216,8 +214,8 @@ export default function PrivateAiForBusinessPage() {
 
 				<div className="ss-home-rule ss-home-pad py-8">
 					<p className="ss-home-body max-w-4xl text-sm">
-						Every one of them also exports to PDF. What goes in is the file you already have:
-						PDF, Word, PowerPoint, Excel, HTML, CSV, Markdown, plain text and images.
+						Every one of them also exports to PDF. What goes in is the file you already have: PDF,
+						Word, PowerPoint, Excel, HTML, CSV, Markdown, plain text and images.
 					</p>
 				</div>
 			</section>
@@ -259,15 +257,17 @@ export default function PrivateAiForBusinessPage() {
 			<section className="ss-home-rule">
 				<div className="ss-home-head ss-home-head-plain">
 					<p className="ss-home-eyebrow">Compliance</p>
-					<h2 className="ss-home-h2 mt-2">Compliance depends on your controls, not on our software</h2>
+					<h2 className="ss-home-h2 mt-2">
+						Compliance depends on your controls, not on our software
+					</h2>
 				</div>
 
 				<div className="ss-home-pad pb-12">
 					<div className="ss-home-body flex max-w-3xl flex-col gap-4">
 						<p>
-							Whether a workflow is HIPAA, GDPR or SRA compliant depends on the controls around
-							it, and those are yours to establish. No piece of software carries that property on
-							its own.
+							Whether a workflow is HIPAA, GDPR or SRA compliant depends on the controls around it,
+							and those are yours to establish. No piece of software carries that property on its
+							own.
 						</p>
 						<p>
 							What we can tell you is narrower and checkable. The index and every prompt stay on
```

**File**: `surfsense_web/app/layout.tsx` (modified, +1/-5)
```diff
@@ -128,11 +128,7 @@ export default function RootLayout({
 				<SoftwareApplicationJsonLd />
 			</head>
 			<body
-				className={cn(
-					roboto.className,
-					roboto.variable,
-					"bg-[#141414] antialiased h-full w-full "
-				)}
+				className={cn(roboto.className, roboto.variable, "bg-[#141414] antialiased h-full w-full ")}
 			>
 				<PostHogProvider>
 					<LocaleProvider>
```

**File**: `surfsense_web/components/assistant-ui/composer-add-menu-drawer.tsx` (modified, +3/-9)
```diff
@@ -7,9 +7,9 @@ import {
 	LayoutGrid,
 	LibraryBig,
 	ListFilter,
+	type LucideIcon,
 	Settings2,
 	TriangleAlert,
-	type LucideIcon,
 	Unplug,
 	Upload,
 	Wrench,
@@ -207,11 +207,7 @@ export function ComposerAddMenuDrawer({
 						<span className="flex-1 text-left">Manage Tools</span>
 						<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
 					</button>
-					<button
-						type="button"
-						className={ROW}
-						onClick={() => push({ kind: "searchScope" })}
-					>
+					<button type="button" className={ROW} onClick={() => push({ kind: "searchScope" })}>
 						<ListFilter className="size-4 shrink-0 text-muted-foreground" />
 						<span className="flex-1 text-left">Search Scope</span>
 						{selectedSearchScope ? (
@@ -242,9 +238,7 @@ export function ComposerAddMenuDrawer({
 						<Icon className="size-4 shrink-0 text-muted-foreground" />
 						<span className="min-w-0 flex-1 text-left">
 							<span className="block font-medium">{option.label}</span>
-							<span className="mt-0.5 block text-xs text-muted-foreground">
-								{option.tooltip}
-							</span>
+							<span className="mt-0.5 block text-xs text-muted-foreground">{option.tooltip}</span>
 						</span>
 						{isSelected ? <Check className="size-4 shrink-0" /> : null}
 					</button>
```

**File**: `surfsense_web/components/assistant-ui/thread.tsx` (modified, +4/-1)
```diff
@@ -999,7 +999,10 @@ const Composer: FC<ComposerProps> = ({ isLoadingMessages = false, showExamplePro
 							onDismiss={() => setClipboardInitialText(undefined)}
 						/>
 					)}
-					<div ref={inputWrapperRef} className="aui-composer-input-wrapper relative px-4 py-2 sm:mb-5">
+					<div
+						ref={inputWrapperRef}
+						className="aui-composer-input-wrapper relative px-4 py-2 sm:mb-5"
+					>
 						<span
 							ref={placeholderMeasureRef}
 							aria-hidden="true"
```

**File**: `surfsense_web/components/homepage/home/home-sections.tsx` (modified, +1/-2)
```diff
@@ -246,8 +246,7 @@ export function HomeConfidential() {
 					<p className="ss-home-body mt-5">{CONFIDENTIAL.body}</p>
 					<p className="mt-6">
 						<Link className="ss-home-forward" href={CONFIDENTIAL.action.href}>
-							{CONFIDENTIAL.action.label}{" "}
-							<ArrowRightIcon aria-hidden="true" className="size-4" />
+							{CONFIDENTIAL.action.label} <ArrowRightIcon aria-hidden="true" className="size-4" />
 						</Link>
 					</p>
 				</div>
```

**File**: `surfsense_web/components/json-view.tsx` (modified, +1/-1)
```diff
@@ -1,8 +1,8 @@
 "use client";
 
 import type { InteractionProps } from "@microlink/react-json-view";
-import { useTheme } from "next-themes";
 import dynamic from "next/dynamic";
+import { useTheme } from "next-themes";
 import { useCallback, useMemo } from "react";
 
 // @microlink/react-json-view reads `document` at module-eval time, which throws
```

**File**: `surfsense_web/components/settings/git-remote-settings.tsx` (modified, +4/-1)
```diff
@@ -669,7 +669,10 @@ export function GitRemoteSettings({
 																}}
 																className="w-full justify-start gap-2 font-normal"
 															>
-																<IconBrandGitlab size={14} className="shrink-0 text-muted-foreground" />
+																<IconBrandGitlab
+																	size={14}
+																	className="shrink-0 text-muted-foreground"
+																/>
 																<span className="truncate">{repo.full_name}</span>
 															</Button>
 														</li>
```

---

### Incident Patch 4: `5b787584` (2026-10-03)
**Commit Message**: build(node): build the website and the installers on Node 24

**File**: `.github/workflows/build-audiocpp.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
 
       - uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           # The scripts need Node only, not the app's pnpm install.
           package-manager-cache: false
 
```

**File**: `.github/workflows/build-sdcpp.yml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ jobs:
 
       - uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           # The scripts need Node only, not the app's pnpm install.
           package-manager-cache: false
 
```

**File**: `.github/workflows/docker-tests.yml` (modified, +9/-6)
```diff
@@ -134,11 +134,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
@@ -169,11 +170,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
@@ -369,11 +371,12 @@ jobs:
         with:
           package_json_file: surfsense_web/package.json
 
-      # Matches surfsense_web's Dockerfile (node:20) and @types/node ^20.
+      # Matches surfsense_web's engines, which Vercel builds with, its Dockerfile
+      # (node:24) and @types/node ^24.
       - name: Setup Node.js
         uses: actions/setup-node@v7
         with:
-          node-version: 20
+          node-version: 24
           cache: pnpm
           cache-dependency-path: surfsense_web/pnpm-lock.yaml
 
```

**File**: `.github/workflows/release-local.yml` (modified, +2/-1)
```diff
@@ -137,10 +137,11 @@ jobs:
           # Both desktop trees pin the same pnpm; the root one is the web app's.
           package_json_file: surfsense_local/electron/package.json
 
+      # Node 24, as desktop-tests: the Node that Electron 44 embeds.
       - name: Setup Node.js
         uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           cache: pnpm
           cache-dependency-path: |
             surfsense_local/frontend/pnpm-lock.yaml
```

**File**: `surfsense_web/Dockerfile` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # syntax=docker.io/docker/dockerfile:1
 
-FROM node:20-alpine AS base
+FROM node:24-alpine AS base
 
 # Install dependencies only when needed
 FROM base AS deps
```

**File**: `surfsense_web/package.json` (modified, +4/-1)
```diff
@@ -3,6 +3,9 @@
 	"version": "0.0.40",
 	"private": true,
 	"packageManager": "pnpm@10.26.0",
+	"engines": {
+		"node": "24.x"
+	},
 	"description": "SurfSense Frontend",
 	"scripts": {
 		"dev": "next dev --turbopack",
@@ -171,7 +174,7 @@
 		"@types/canvas-confetti": "^1.9.0",
 		"@types/gapi": "^0.0.47",
 		"@types/google.picker": "^0.0.52",
-		"@types/node": "^20.19.9",
+		"@types/node": "^24",
 		"@types/pg": "^8.15.5",
 		"@types/react": "^19.1.8",
 		"@types/react-dom": "^19.1.6",
```

**File**: `surfsense_web/pnpm-lock.yaml` (modified, +52/-52)
```diff
@@ -73,7 +73,7 @@ importers:
         version: 52.0.15(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
       '@platejs/dnd':
         specifier: ^52.0.11
-        version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dnd-html5-backend@16.0.1)(react-dnd@16.0.1(@types/node@20.19.33)(@types/react@19.2.14)(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
+        version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dnd-html5-backend@16.0.1)(react-dnd@16.0.1(@types/node@24.19.0)(@types/react@19.2.14)(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
       '@platejs/floating':
         specifier: ^52.0.11
         version: 52.0.11(platejs@52.0.17(@types/react@19.2.14)(immer@10.2.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(scheduler@0.27.0)(use-sync-external-store@1.6.0(react@19.2.4)))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)
@@ -250,19 +250,19 @@ importers:
         version: 3.2.0
       fumadocs-core:
         specifier: ^16.3.1
-        version: 16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6)
+        version: 16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6)
       fumadocs-mdx:
         specifier: ^14.2.1
-        version: 14.3.0(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react@19.2.4)(vite@7.3.6(@types/node@20.19.33)(jiti@2.6.1)(lightningcss@1.31.1)(tsx@4.23.15)(yaml@2.9.0))
+        version: 14.3.0(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react@19.2.4)(vite@7.3.6(@types/node@24.19.0)(jiti@2.6.1)(lightningcss@1.31.1)(tsx@4.23.15)(yaml@2.9.0))
       fumadocs-ui:
         specifier: ^16.3.1
-        version: 16.6.5(@types/react-dom@19.2.3(@types/react@19.2.14))(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@20.19.33)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(tailwindcss@4.2.1)
+        version: 16.6.5(@types/react-dom@19.2.3(@types/react@19.2.14))(@types/react@19.2.14)(fumadocs-core@16.6.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.14)(lucide-react@1.40.0(react@19.2.4))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(react@19.2.4)(zod@4.3.6))(next@16.3.6(@babel/core@7.29.7)(@opentelemetry/api@1.9.0)(@playwright/test@1.59.1)(@types/node@24.19.0)(react-dom@19.2.4(react@19.2.4))(react@19.2.4))(react-dom@19.2.4(react@19.2.4))(reac
```

---

### Incident Patch 5: `7a7b9d94` (2026-10-02)
**Commit Message**: fix(local): keep the right panel visible during preview, and the Help menu without a workspace

- The source preview column can shrink, down to the sidebar's width, so
  on a narrow window it narrows instead of pushing the open right panel
  out of view
- Help › Report Issue… claims Settings only while a workspace is active;
  on the "No workspaces" screen, where Settings isn't rendered, it opens
  the popup instead of doing nothing

**File**: `surfsense_local/frontend/src/features/dashboard/dashboard-page.test.tsx` (modified, +35/-0)
```diff
@@ -927,6 +927,41 @@ describe("dashboard chat", () => {
     delete window.surfsense?.help
   })
 
+  it("leaves the Help menu to the popup when there is no workspace", async () => {
+    vi.stubGlobal(
+      "fetch",
+      vi.fn(async () => Response.json([]))
+    )
+    let reportIssue = () => {}
+    window.surfsense = {
+      ...window.surfsense!,
+      help: {
+        onReportIssue: (listener) => {
+          reportIssue = listener
+          return () => {}
+        },
+      },
+    }
+
+    render(
+      <TooltipProvider>
+        <IssueReportDialog />
+        <DashboardPage
+          selection={null}
+          initialWorkspaces={[]}
+          onModelSelected={vi.fn()}
+        />
+      </TooltipProvider>
+    )
+
+    act(() => reportIssue())
+
+    expect(
+      await screen.findByRole("dialog", { name: "Report an issue" })
+    ).toBeTruthy()
+    delete window.surfsense?.help
+  })
+
   it("surfaces a message request failure inside the conversation", async () => {
     const fetchMock = vi.fn(
       async (input: RequestInfo | URL, init?: RequestInit) => {
```

**File**: `surfsense_local/frontend/src/features/dashboard/dashboard-page.tsx` (modified, +10/-4)
```diff
@@ -221,9 +221,11 @@ function WorkspaceDashboard({
       </div>
       <section className="my-2 mr-2 flex min-h-0 min-w-0 overflow-hidden rounded-[16px] border bg-background shadow-sm">
         {/* A preview takes over the left column and widens it, as an
-            inspected artifact does the right one; the right panel stays put. */}
+            inspected artifact does the right one; the right panel stays put.
+            It shrinks, down to the sidebar's width, before the chat or the
+            right panel lose room on a narrow window. */}
         <div
-          className="flex h-full min-h-0 min-w-58 shrink-0 flex-col transition-[width] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
+          className="flex h-full min-h-0 min-w-68 flex-col transition-[width] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
           style={{
             width: sourcePreviewOpen ? DETAIL_RAIL_WIDTH : SIDEBAR_WIDTH,
           }}
@@ -546,8 +548,12 @@ export function DashboardPage({
     setSettingsSection(section)
     setSettingsOpen(true)
   }
-  // The menu has Settings to go to here; elsewhere it opens the dialog.
-  useHelpMenuReport(() => openSettings("report-issue"))
+  // The menu has Settings to go to here, once a workspace renders it;
+  // otherwise it opens the dialog.
+  useHelpMenuReport(
+    () => openSettings("report-issue"),
+    Boolean(workspaces.activeWorkspace)
+  )
 
   // Checked when the model changes, when settings close (a key entered again,
   // egress switched, a connection edited) and after egress is allowed.
```

**File**: `surfsense_local/frontend/src/features/feedback/help-menu-report.ts` (modified, +4/-2)
```diff
@@ -12,17 +12,19 @@ export function helpMenuReportClaimant(): (() => void) | null {
   return claimant
 }
 
-export function useHelpMenuReport(onReport: () => void): void {
+// `enabled` false leaves the menu to the dialog, as when Settings cannot render.
+export function useHelpMenuReport(onReport: () => void, enabled = true): void {
   // Read at click time, so a re-render's new closure needs no re-claim.
   const latest = useRef(onReport)
   useEffect(() => {
     latest.current = onReport
   })
   useEffect(() => {
+    if (!enabled) return
     const claim = () => latest.current()
     claimant = claim
     return () => {
       if (claimant === claim) claimant = null
     }
-  }, [])
+  }, [enabled])
 }
```

---

### Incident Patch 6: `a68e47f7` (2026-10-02)
**Commit Message**: Merge pull request #2145 from ybai08/fix/spellcheck-egress

fix(local): stop Chromium's spellchecker from downloading dictionaries

**File**: `docs/ROADMAP.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ What the maintainers are working on, grouped by when. This page names the initia
 ## Now
 
 - **Release and CI health.** v2.0.3 was the first release to carry the llama.cpp, sd.cpp and audio.cpp runtimes, built and packaged on all three runners, and [`desktop-tests.yml`](../.github/workflows/desktop-tests.yml) runs the desktop backend, frontend and Electron tests on pull requests. What is left is the CI that proves the runtimes: no job generates an image with the staged `sd-server`, and the release workflow still accepts a prerelease version. See [packaging](architecture/packaging.md) and [updates](architecture/updates.md).
-- **Egress gaps.** The follow-up fetch for a remote image URL leaves without a consent decision, Electron's spellchecker likely fetches dictionaries without one, and some stored grants no longer match what Settings › Network shows. See [egress](architecture/egress.md).
+- **Egress gaps.** The follow-up fetch for a remote image URL leaves without a consent decision, and some stored grants no longer match what Settings › Network shows. See [egress](architecture/egress.md).
 - **Import from cloud.** The hosted export window closes on 18 Oct 2026. Imports need a progress summary, and a re-run must bring back the chat threads an interrupted import missed. See [import](architecture/import.md).
 - **Scraper API and MCP license mode.** PATs are purged on 18 Oct 2026; after that, license mode is how scraper API and MCP users keep access. See [contract 2](contracts/02-scraper-api-auth.md).
 - **Model catalog.** One catalog for local and remote models, each classified offline from a reviewed, packaged manifest and keyed by model type. See the [proposal](proposals/model-catalog.md).
```

**File**: `docs/architecture/egress.md` (modified, +1/-1)
```diff
@@ -45,6 +45,7 @@ The GGUF download runs inside the API (`modules/llm/providers/llamacpp/download.
 - App updates. electron-updater talks to GitHub from the Electron main process, out of reach of `egress.require()`, so it is gated by the `automatic` preference in `updates.json` and by consent in the renderer instead ([updates](updates.md)). Settings › Network shows it as the App updates row, host `github.com`.
 - Links. The main process refuses new windows and `https:` navigations inside the app, and hands a URL on `surfsense.com` or `www.surfsense.com`, under `github.com/MODSetter/SurfSense`, the project's Discord invite, or an OpenRouter page shaped `/<author>/<model>` (where OpenRouter names a speech model's voices) to `shell.openExternal` (`electron/src/main/external-url.ts`); that request is the browser's. Report issue opens one such link, a GitHub bug form with the user's description in it; its session log goes to the clipboard, never into the link ([issue reports](issue-reports.md)).
 - Docling. Packaged Python sidecars run with `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`) and parse with the bundled parser pack ([packaging](packaging.md)). [`test_parsing.py`](../../surfsense_local/backend/tests/integration/worker/test_parsing.py) converts a scanned PDF and images from the parser pack with every outbound connection refused and an empty Hugging Face cache; it runs from source and skips where the pack is not staged.
+- Spellchecking. Chromium fetches a Hunspell dictionary from Google's CDN (`redirector.gvt1.com/edgedl/chrome/dict/`) for each language in a session's spellchecker list, when the session is created. Measured on Electron 44.2.0 on Linux, `webPreferences.spellcheck: false` and `setSpellCheckerEnabled(false)` do not stop it, and `webRequest` never sees it. The main process empties the list on `session-created`, before the app is ready ([`spellcheck.ts`](../../surfsense_local/electron/src/main/spellcheck.ts)), and no request is made after that. So Windows and Linux have no spellchecking. macOS uses the OS spellchecker, downloads nothing and ignores the call, so it keeps working there. Not measured on Windows, which runs the same code.
 - Licenses. The app verifies license files offline and never contacts Keygen ([license](license/app.md)); `PUT /egress/keygen` is refused as unknown.
 
 ## Asking for consent
@@ -66,6 +67,5 @@ Settings › Network lists the App updates row and every destination with its ho
 
 ## Known gaps
 
-- Electron's Chromium spellchecker is not configured in `electron/src/main/index.ts`. Electron's type definitions say it downloads Hunspell dictionaries from the Chromium CDN by default, and `spellcheck` is on unless turned off, so on Windows and Linux it likely makes that call; nobody has checked at runtime.
 - The Office Studio formats run model-written code in the worker, and that code can open connections of its own ([studio](studio.md)).
 - Grants stored under the earlier destination names, `model_download`, `model_search` and `image_model_pull`, are not carried over to `host:huggingface.co`. Nothing reads them any more, so someone who had allowed model downloads is asked again, and the old rows stay in the table; revision 0012 still turns an Ollama-era `ollama_pull` grant into `model_download`.
```

**File**: `docs/architecture/updates.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ How to cut a release is in [`surfsense_local/RELEASE.md`](../../surfsense_local/
 
 ## Consent
 
-Updates are the one call the app is designed to make on its own, so they are off until the user turns them on. The spellchecker's dictionary download is a known exception ([egress](egress.md)).
+Updates are the one call the app is designed to make on its own, so they are off until the user turns them on.
 
 - The preference is `updates.json` in Electron's user data: `automatic`, false by default, and `lastCheckedAt`, which Settings › Network shows as the App updates row's last call.
 - The check at launch runs only when `automatic` is on.
```

**File**: `surfsense_local/electron/src/main/index.ts` (modified, +4/-0)
```diff
@@ -58,6 +58,7 @@ import {
   type Sidecars,
 } from "./sidecars/supervisor.ts"
 import type { SidecarContext, SidecarSpec } from "./sidecars/types.ts"
+import { refuseSpellcheckDownloads } from "./spellcheck.ts"
 import {
   attachUpdater,
   readUpdatePrefs,
@@ -712,6 +713,9 @@ app.commandLine.appendSwitch(
   "OverlayScrollbar,FluentScrollbar,FluentOverlayScrollbars"
 )
 
+// Also before whenReady(): the default session is created with the app.
+refuseSpellcheckDownloads(app)
+
 // one app, one set of sidecars: a second instance would fight over the SQLite
 // file and the port, so hand off to the primary window and quit
 if (app.requestSingleInstanceLock()) {
```

**File**: `surfsense_local/electron/src/main/spellcheck.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import assert from "node:assert/strict"
+import { readFileSync } from "node:fs"
+import test from "node:test"
+
+import { refuseSpellcheckDownloads } from "./spellcheck.ts"
+
+function fakeApp() {
+  const listeners: Record<string, ((session: never) => void)[]> = {}
+  return {
+    listeners,
+    on(event: string, listener: (session: never) => void) {
+      ;(listeners[event] ??= []).push(listener)
+    },
+  }
+}
+
+test("empties the spellchecker's language list for every session created", () => {
+  const app = fakeApp()
+  refuseSpellcheckDownloads(app)
+
+  const set: string[][] = []
+  const session = {
+    setSpellCheckerLanguages: (languages: string[]) => set.push(languages),
+  }
+  for (const listener of app.listeners["session-created"] ?? []) {
+    listener(session as never)
+    listener(session as never)
+  }
+
+  // A language in the list is what Chromium downloads a dictionary for.
+  assert.deepEqual(set, [[], []])
+})
+
+test("listens for nothing but a session being created", () => {
+  const app = fakeApp()
+  refuseSpellcheckDownloads(app)
+
+  assert.deepEqual(Object.keys(app.listeners), ["session-created"])
+})
+
+test("is registered before the app can become ready", () => {
+  // Measured on Electron 44.2.0: one `await` after `ready` is already too late,
+  // because the default session starts its download when it is created.
+  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
+  const registered = source.indexOf("\nrefuseSpellcheckDownloads(app)")
+  const started = source.indexOf("\nif (app.requestSingleInstanceLock())")
+
+  assert.ok(registered !== -1, "index.ts calls it at the top level")
+  assert.ok(started !== -1)
+  assert.ok(registered < started)
+})
```

**File**: `surfsense_local/electron/src/main/spellcheck.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+// Chromium downloads a Hunspell dictionary from Google's CDN for every
+// language in a session's spellchecker list, as soon as the session exists.
+// Measured on Electron 44.2.0 on Linux: `webPreferences.spellcheck: false` and
+// `setSpellCheckerEnabled(false)` stop the checking and not the download, and
+// `webRequest` never sees it. An empty list is what leaves nothing to fetch.
+// macOS uses the OS spellchecker, downloads nothing, and ignores the call.
+type SpellcheckSession = { setSpellCheckerLanguages(languages: string[]): void }
+type SessionCreator = {
+  on(event: "session-created", listener: (session: SpellcheckSession) => void): unknown
+}
+
+/** Call before `ready`: the default session is created with the app. */
+export function refuseSpellcheckDownloads(app: SessionCreator): void {
+  app.on("session-created", (session) => session.setSpellCheckerLanguages([]))
+}
```

---

### Incident Patch 7: `baf6d899` (2026-10-02)
**Commit Message**: Merge pull request #2148 from Cedric921/fix/finish-job-keeps-edits

fix(local): keep a rename or note edit made while a document ingests

**File**: `docs/architecture/documents.md` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ The desktop app previews an original in its left rail when its MIME type has a s
 3. **Chunk** ([`chunking.py`](../../surfsense_local/backend/worker/ingestion/chunking.py)). Chonkie's `RecursiveChunker` splits at the coarsest boundary that fits: a heading, a paragraph, a line, a sentence, a word, then a bare split so an over-long line still ends. Passages are at most 480 tokens by bge-small's tokenizer, under its 512-token limit with room for the two tokens it adds. That tokenizer is pinned to the chunker rather than taken from the active embedder, so changing the embedder would not re-cut documents and move every chunk id. Pieces under 24 characters are merged into a neighbour while splitting, so only a document shorter than that yields a shorter passage. The tokenizer is passed as an object, because one named by a string would reach the network even offline. Each passage records the lines its first and last characters fall on.
 4. **Embed** ([`encoder.py`](../../surfsense_local/backend/modules/embedding/encoder.py)). The active index's model, as its spec says, on onnxruntime's CPU provider: the document prefix, tokenize (truncated at the spec's `max_tokens`), pool, normalise, in batches of 32. For bge-small that is no prefix, 512 tokens, CLS pooling and L2 normalisation. No network and no model server. A vector whose width is not the spec's is refused rather than stored.
 5. **Index** ([`indexing.py`](../../surfsense_local/backend/worker/ingestion/indexing.py)). The document's old chunks are deleted, which clears both index tables through the delete trigger, and the new chunks are inserted with their float32 embeddings, followed by one row per chunk in the active index's vector table, and the document records that index in `embedding_index_id`. The keyword index follows by trigger; the vector cannot, because only ingest holds it. Editing a note therefore stops its old text being findable.
-6. **Finish.** The markdown is stored on `documents.content`, and `finish_job` writes `ready` unless a cancel won the race.
+6. **Finish.** `finish_job` writes `ready` unless a cancel won the race, and beside it only what the job produced: a file's extracted markdown on `documents.content`. A note's content is the user's and is only read, and ingest never writes `title`, so a rename or a note edit committed while the job ran stands, and the ingest that edit enqueued indexes the new text.
 
 Cancellation is checked after parsing and after embedding. On any other failure the worker rolls back and re-reads the row. If the document was deleted or cancelled meanwhile it stops; otherwise it writes `failed` with `error_message` set to the exception type and message, cut to 500 characters, notifies, and re-raises so Huey runs the job again, up to two more times. A later success clears the message. The sources panel shows it and offers Retry.
 
```

**File**: `surfsense_local/backend/tests/integration/worker/test_edits_during_ingest.py` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+"""An edit the API commits while a document ingests survives the ingest.
+
+`PATCH` has no processing guard, and right after an upload, while its parse
+runs, is when people rename. Ingest must finish with what it produced, not
+write back the row it read when it began.
+"""
+
+from collections.abc import Iterator
+
+import pytest
+from sqlalchemy import Engine, text
+from sqlalchemy.orm import Session
+
+from modules.documents.models import Document, DocumentStatus, DocumentType
+from modules.workspaces.models import Workspace
+from shared.db import create_session_factory
+from worker.ingestion import run
+
+pytestmark = pytest.mark.integration
+
+OLD = "# Cassini\n\nIt carried the Huygens probe, which landed on Titan.\n"
+NEW = "# Cassini\n\nThe mission ended in a dive into Saturn in 2017.\n"
+
+
+@pytest.fixture
+def session(engine: Engine) -> Iterator[Session]:
+    """A session on the migrated database ingest opens again by path."""
+    with create_session_factory(engine)() as opened:
+        yield opened
+
+
+def workspace(session: Session) -> Workspace:
+    """The workspace each document here belongs to."""
+    saturn = Workspace(name="Saturn")
+    session.add(saturn)
+    session.flush()
+    return saturn
+
+
+def edit_while_parsing(
+    session: Session, monkeypatch: pytest.MonkeyPatch, parsed: str, **changes: object
+) -> None:
+    """Commit `changes` to the row from another session, as the API would, while
+    the worker's first parse runs; every parse returns what the row held then."""
+    edited = False
+
+    def parse_during_edit(document: Document) -> str:
+        nonlocal edited
+        if edited:
+            return document.content or parsed
+        edited = True
+        with create_session_factory(session.get_bind())() as api:
+            row = api.get(Document, document.id)
+            for column, value in changes.items():
+                setattr(row, column, value)
+            api.commit()
+        return parsed
+
+    monkeypatch.setattr("worker.ingestion.parsing.markdown_for", parse_during_edit)
+
+
+def test_a_file_renamed_during_its_parse_keeps_its_new_name(
+    session: Session, stub_model: None, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """Without this the upload's name came back when ingest finished."""
+    document = Document(
+        workspace_id=workspace(session).id,
+        title="scan-0042.md",
+        document_type=DocumentType.FILE,
+        dedup_key="abc",
+        document_metadata={"suffix": ".md"},
+    )
+    session.add(document)
+    session.commit()
+    edit_while_parsing(session, monkeypatch, OLD, title="Cassini notes")
+
+    run(document.id)
+
+    session.expire_all()
+    assert document.title == "Cassini notes"
+    assert document.status is DocumentStatus.READY
+    assert document.content == OLD
+
+
+def test_a_note_edited_during_its_ingest_ends_with_the_new_text_indexed(
+    session: Session, stub_model: None, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """The edit queues another ingest; it must find the new text, not the old."""
+    note = Document(
+        workspace_id=workspace(session).id,
+        title="Cassini",
+        document_type=DocumentType.NOTE,
+        content=OLD,
+    )
+    session.add(note)
+    session.commit()
+    edit_while_parsing(
+        session, monkeypatch, OLD, content=NEW, status=DocumentStatus.PENDING
+    )
+
+    run(note.id)
+    run(note.id)  # the ingest the edit enqueued
+
+    session.expire_all()
+    assert note.content == NEW
+    assert note.status is DocumentStatus.READY
+
+    def indexed(word: str) -> int:
+        return session.scalar(
+            text("SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH :word"),
+            {"word": word},
+        )
+
+    assert (indexed("Huygens"), indexed("dive")) == (0, 1)
```

**File**: `surfsense_local/backend/worker/ingestion/pipeline.py` (modified, +7/-3)
```diff
@@ -2,7 +2,7 @@
 
 from sqlalchemy.orm import Session
 
-from modules.documents.models import Document, DocumentStatus
+from modules.documents.models import Document, DocumentStatus, DocumentType
 from modules.embedding.active import require_active_index
 from shared.config import get_storage_settings
 from shared.db import create_db_engine, create_session_factory
@@ -47,8 +47,12 @@ def _ingest(session: Session, document: Document) -> None:
         raise_if_cancelled(session, document)
         indexing.replace_chunks(session, document, index, passages, vectors)
 
-        document.content = markdown
-        if not finish_job(session, document, DocumentStatus.READY):
+        # A file's text is what ingest extracted; a note's is the user's, only
+        # read here, so writing it back would undo an edit made mid-ingest.
+        produced = (
+            {"content": markdown} if document.document_type is DocumentType.FILE else {}
+        )
+        if not finish_job(session, document, DocumentStatus.READY, **produced):
             return
         notify_document_updates(document)
     except JobCancelledError:
```

**File**: `surfsense_local/backend/worker/jobs.py` (modified, +7/-7)
```diff
@@ -68,20 +68,20 @@ def finish_job(
     document: Document,
     status: DocumentStatus,
     error_message: str | None = None,
+    **produced: str,
 ) -> bool:
-    """Write a terminal status unless cancel won the race. Returns whether we wrote."""
+    """Write a terminal status unless cancel won the race. Returns whether we wrote.
+
+    Only the columns the job `produced` are written beside it, never the row as
+    `begin_job` read it: a rename or a note edit committed meanwhile must stand.
+    """
     result = session.execute(
         update(Document)
         .where(
             Document.id == document.id,
             Document.status != DocumentStatus.CANCELLED,
         )
-        .values(
-            status=status,
-            error_message=error_message,
-            content=document.content,
-            title=document.title,
-        )
+        .values(status=status, error_message=error_message, **produced)
     )
     if result.rowcount == 0:
         session.rollback()
```

**File**: `surfsense_local/backend/worker/studio/job.py` (modified, +7/-1)
```diff
@@ -97,7 +97,13 @@ def _generate(session: Session, artifact: Artifact) -> None:
         )
         persist.persist(session, artifact, document, built)
 
-        if not finish_job(session, document, DocumentStatus.READY):
+        if not finish_job(
+            session,
+            document,
+            DocumentStatus.READY,
+            title=document.title,
+            content=document.content,
+        ):
             return
         notify_artifact_updates(artifact)
         logger.info(
```

---

### Incident Patch 8: `2d8af9a3` (2026-10-02)
**Commit Message**: Merge pull request #2153 from MODSetter/fix/agent-switch-allows-uncatalogued-models

[Agent|Engine] Let the developer switch try models newer than the catalog

**File**: `docs/architecture/agent.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ A chat thread can be the agent's. opencode, bundled in the installer and started
 
 ## Which threads get it
 
-A new thread is the agent's when the selected text model is in `TESTED_MODELS`, or `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1` is set in the environment Electron starts the API from, and the model is known to call tools: llama-server reports `supports_tool_calls` for a local model's template, or the remote catalog records `tool_call: true` for the model under its connection's catalog provider. A catalog that says nothing, or a runtime that cannot be read, counts as no ([`engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py)). `TESTED_MODELS` is empty: a model goes on it once it passes the agent test at a window of 32,768 tokens or more ([proposal](../proposals/agent/01-which-engine.md#what-tested-means)). When opencode is not staged, or does not become ready, the thread opens as a chat. A thread keeps its engine; its row stores the opencode session that holds its turns ([data model](data-model.md)). Once the selected model changes to one that fails the check, a turn sent to the thread is refused with `409` before any prompt is sent: the user chooses another model or starts a new chat.
+A new thread is the agent's when the selected text model is in `TESTED_MODELS`, or `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1` is set in the environment Electron starts the API from, and the model is known to call tools: llama-server reports `supports_tool_calls` for a local model's template, or the remote catalog records `tool_call: true` for the model under its connection's catalog provider. A runtime that cannot be read counts as no. A catalog that says nothing counts as no for a tested model and as yes under the developer switch, because the packaged catalog lags the providers and a model released after it is the one most worth trying; a stated `tool_call: false` keeps a model out either way ([`engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py)). `TESTED_MODELS` is empty: a model goes on it once it passes the agent test at a window of 32,768 tokens or more ([proposal](../proposals/agent/01-which-engine.md#what-tested-means)). When opencode is not staged, or does not become ready, the thread opens as a chat. A thread keeps its engine; its row stores the opencode session that holds its turns ([data model](data-model.md)). Once the selected model changes to one that fails the check, a turn sent to the thread is refused with `409` before any prompt is sent: the user chooses another model or starts a new chat.
 
 ## From a thread to a running opencode
 
```

**File**: `docs/architecture/chat.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ A turn can carry images, and a model that reads them receives them; every other
 
 ## Agent threads
 
-How the agent runs is in [agent](agent.md). A thread is opened for the agent instead of the chat when the selected model may run it: a model on the tested list, which is empty, or any model while `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1`, and only one known to call tools ([`modules/agent/engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py), [agent](agent.md#which-threads-get-it)). Opening such a thread starts opencode if it is not running, waits until it serves SurfSense's configuration, and opens an opencode session under the thread's title; the session's id is stored on the thread, and `ThreadRead` reports `uses_agent`. When opencode is not part of the install or is not ready, the thread opens as a chat. A thread keeps the engine it was opened with ([agent proposal](../proposals/agent/01-which-engine.md)).
+How the agent runs is in [agent](agent.md). A thread is opened for the agent instead of the chat when the selected model may run it: a model on the tested list, which is empty, or any model while `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1`, and only one that calls tools as far as SurfSense can tell ([`modules/agent/engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py), [agent](agent.md#which-threads-get-it)). Opening such a thread starts opencode if it is not running, waits until it serves SurfSense's configuration, and opens an opencode session under the thread's title; the session's id is stored on the thread, and `ThreadRead` reports `uses_agent`. When opencode is not part of the install or is not ready, the thread opens as a chat. A thread keeps the engine it was opened with ([agent proposal](../proposals/agent/01-which-engine.md)).
 
 The same routes then reach the agent ([`modules/agent/agent_threads/`](../../surfsense_local/backend/modules/agent/agent_threads/)):
 
```

**File**: `surfsense_local/backend/modules/agent/engine_choice.py` (modified, +12/-8)
```diff
@@ -22,18 +22,22 @@
 
 
 async def selected_model_can_run_agent(session: Session) -> bool:
-    """Whether the selected text model may run the agent: tested, and known to call tools."""
+    """Whether the selected text model may run the agent: tested, and known to call tools.
+
+    Under the developer switch a remote model the catalog says nothing of is let in.
+    """
     found = await transact(session, _selected)
     if found is None:
         return False
     selected, catalog_provider = found
-    if not (
-        selected.name in TESTED_MODELS or get_agent_settings().agent_untested_models
-    ):
+    switch = get_agent_settings().agent_untested_models
+    if not (selected.name in TESTED_MODELS or switch):
         return False
     if selected.provider == llamacpp.PROVIDER:
         return await _local_calls_tools(selected.name)
-    return _catalog_calls_tools(selected.name, catalog_provider)
+    stated = _catalog_tool_call(selected.name, catalog_provider)
+    # The packaged catalog lags the providers; under the switch only a stated no keeps a model out.
+    return stated is True or (stated is None and switch)
 
 
 def _selected(session: Session) -> tuple[SelectedModel, str | None] | None:
@@ -61,8 +65,8 @@ async def _local_calls_tools(name: str) -> bool:
         return False
 
 
-def _catalog_calls_tools(name: str, catalog_provider: str | None) -> bool:
-    """Whether the remote catalog says the model calls tools; one it says nothing of does not."""
+def _catalog_tool_call(name: str, catalog_provider: str | None) -> bool | None:
+    """What the remote catalog says of the model's tool calls; None when it says nothing."""
     provider = None if catalog_provider in (None, CUSTOM) else catalog_provider
     found = remote_lookup().classify(name, provider=provider)
-    return found.supports is not None and found.supports.tool_call is True
+    return found.supports.tool_call if found.supports is not None else None
```

**File**: `surfsense_local/backend/tests/integration/agent/test_engine_choice.py` (modified, +4/-4)
```diff
@@ -138,13 +138,13 @@ async def test_a_remote_model_that_calls_tools_gets_the_agent(session: Session)
     assert await selected_model_can_run_agent(session) is True
 
 
-async def test_a_remote_model_the_catalog_does_not_know_gets_the_chat(
+async def test_with_the_switch_a_model_the_catalog_does_not_know_gets_the_agent(
     session: Session,
 ) -> None:
-    """A user's own endpoint may serve anything: support that is not stated is not confirmed."""
-    select_remote(session, "stub-model", "custom")
+    """A model released after the packaged catalog is the one most worth trying; only a stated no keeps it out."""
+    select_remote(session, "anthropic/claude-sonnet-99", "openrouter")
 
-    assert await selected_model_can_run_agent(session) is False
+    assert await selected_model_can_run_agent(session) is True
 
 
 async def test_without_the_switch_even_a_model_that_calls_tools_gets_the_chat(
```

---

### Incident Patch 9: `84df4a35` (2026-10-02)
**Commit Message**: fix(agent): let the developer switch run a remote model the catalog does not know yet

**File**: `docs/architecture/agent.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ A chat thread can be the agent's. opencode, bundled in the installer and started
 
 ## Which threads get it
 
-A new thread is the agent's when the selected text model is in `TESTED_MODELS`, or `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1` is set in the environment Electron starts the API from, and the model is known to call tools: llama-server reports `supports_tool_calls` for a local model's template, or the remote catalog records `tool_call: true` for the model under its connection's catalog provider. A catalog that says nothing, or a runtime that cannot be read, counts as no ([`engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py)). `TESTED_MODELS` is empty: a model goes on it once it passes the agent test at a window of 32,768 tokens or more ([proposal](../proposals/agent/01-which-engine.md#what-tested-means)). When opencode is not staged, or does not become ready, the thread opens as a chat. A thread keeps its engine; its row stores the opencode session that holds its turns ([data model](data-model.md)). Once the selected model changes to one that fails the check, a turn sent to the thread is refused with `409` before any prompt is sent: the user chooses another model or starts a new chat.
+A new thread is the agent's when the selected text model is in `TESTED_MODELS`, or `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1` is set in the environment Electron starts the API from, and the model is known to call tools: llama-server reports `supports_tool_calls` for a local model's template, or the remote catalog records `tool_call: true` for the model under its connection's catalog provider. A runtime that cannot be read counts as no. A catalog that says nothing counts as no for a tested model and as yes under the developer switch, because the packaged catalog lags the providers and a model released after it is the one most worth trying; a stated `tool_call: false` keeps a model out either way ([`engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py)). `TESTED_MODELS` is empty: a model goes on it once it passes the agent test at a window of 32,768 tokens or more ([proposal](../proposals/agent/01-which-engine.md#what-tested-means)). When opencode is not staged, or does not become ready, the thread opens as a chat. A thread keeps its engine; its row stores the opencode session that holds its turns ([data model](data-model.md)). Once the selected model changes to one that fails the check, a turn sent to the thread is refused with `409` before any prompt is sent: the user chooses another model or starts a new chat.
 
 ## From a thread to a running opencode
 
```

**File**: `docs/architecture/chat.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ A turn can carry images, and a model that reads them receives them; every other
 
 ## Agent threads
 
-How the agent runs is in [agent](agent.md). A thread is opened for the agent instead of the chat when the selected model may run it: a model on the tested list, which is empty, or any model while `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1`, and only one known to call tools ([`modules/agent/engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py), [agent](agent.md#which-threads-get-it)). Opening such a thread starts opencode if it is not running, waits until it serves SurfSense's configuration, and opens an opencode session under the thread's title; the session's id is stored on the thread, and `ThreadRead` reports `uses_agent`. When opencode is not part of the install or is not ready, the thread opens as a chat. A thread keeps the engine it was opened with ([agent proposal](../proposals/agent/01-which-engine.md)).
+How the agent runs is in [agent](agent.md). A thread is opened for the agent instead of the chat when the selected model may run it: a model on the tested list, which is empty, or any model while `SURFSENSE_LOCAL_AGENT_UNTESTED_MODELS=1`, and only one that calls tools as far as SurfSense can tell ([`modules/agent/engine_choice.py`](../../surfsense_local/backend/modules/agent/engine_choice.py), [agent](agent.md#which-threads-get-it)). Opening such a thread starts opencode if it is not running, waits until it serves SurfSense's configuration, and opens an opencode session under the thread's title; the session's id is stored on the thread, and `ThreadRead` reports `uses_agent`. When opencode is not part of the install or is not ready, the thread opens as a chat. A thread keeps the engine it was opened with ([agent proposal](../proposals/agent/01-which-engine.md)).
 
 The same routes then reach the agent ([`modules/agent/agent_threads/`](../../surfsense_local/backend/modules/agent/agent_threads/)):
 
```

**File**: `surfsense_local/backend/modules/agent/engine_choice.py` (modified, +12/-8)
```diff
@@ -22,18 +22,22 @@
 
 
 async def selected_model_can_run_agent(session: Session) -> bool:
-    """Whether the selected text model may run the agent: tested, and known to call tools."""
+    """Whether the selected text model may run the agent: tested, and known to call tools.
+
+    Under the developer switch a remote model the catalog says nothing of is let in.
+    """
     found = await transact(session, _selected)
     if found is None:
         return False
     selected, catalog_provider = found
-    if not (
-        selected.name in TESTED_MODELS or get_agent_settings().agent_untested_models
-    ):
+    switch = get_agent_settings().agent_untested_models
+    if not (selected.name in TESTED_MODELS or switch):
         return False
     if selected.provider == llamacpp.PROVIDER:
         return await _local_calls_tools(selected.name)
-    return _catalog_calls_tools(selected.name, catalog_provider)
+    stated = _catalog_tool_call(selected.name, catalog_provider)
+    # The packaged catalog lags the providers; under the switch only a stated no keeps a model out.
+    return stated is True or (stated is None and switch)
 
 
 def _selected(session: Session) -> tuple[SelectedModel, str | None] | None:
@@ -61,8 +65,8 @@ async def _local_calls_tools(name: str) -> bool:
         return False
 
 
-def _catalog_calls_tools(name: str, catalog_provider: str | None) -> bool:
-    """Whether the remote catalog says the model calls tools; one it says nothing of does not."""
+def _catalog_tool_call(name: str, catalog_provider: str | None) -> bool | None:
+    """What the remote catalog says of the model's tool calls; None when it says nothing."""
     provider = None if catalog_provider in (None, CUSTOM) else catalog_provider
     found = remote_lookup().classify(name, provider=provider)
-    return found.supports is not None and found.supports.tool_call is True
+    return found.supports.tool_call if found.supports is not None else None
```

**File**: `surfsense_local/backend/tests/integration/agent/test_engine_choice.py` (modified, +4/-4)
```diff
@@ -138,13 +138,13 @@ async def test_a_remote_model_that_calls_tools_gets_the_agent(session: Session)
     assert await selected_model_can_run_agent(session) is True
 
 
-async def test_a_remote_model_the_catalog_does_not_know_gets_the_chat(
+async def test_with_the_switch_a_model_the_catalog_does_not_know_gets_the_agent(
     session: Session,
 ) -> None:
-    """A user's own endpoint may serve anything: support that is not stated is not confirmed."""
-    select_remote(session, "stub-model", "custom")
+    """A model released after the packaged catalog is the one most worth trying; only a stated no keeps it out."""
+    select_remote(session, "anthropic/claude-sonnet-99", "openrouter")
 
-    assert await selected_model_can_run_agent(session) is False
+    assert await selected_model_can_run_agent(session) is True
 
 
 async def test_without_the_switch_even_a_model_that_calls_tools_gets_the_chat(
```

---

### Incident Patch 10: `427a67ba` (2026-10-02)
**Commit Message**: fix(local): toast note and rename failures, send content only when changed

**File**: `surfsense_local/frontend/src/features/sources/note-editor-dialog.tsx` (modified, +12/-4)
```diff
@@ -20,7 +20,11 @@ import { MAX_SOURCE_TITLE, cleanSourceTitle } from "./source-title"
 export type NoteActions = {
   write: (title: string, content: string) => Promise<boolean>
   load: (documentId: number) => Promise<{ title: string; content: string }>
-  edit: (documentId: number, title: string, content: string) => Promise<boolean>
+  edit: (
+    documentId: number,
+    title: string,
+    content?: string
+  ) => Promise<boolean>
 }
 
 /** A new note, or the note with this id reopened with its text. */
@@ -65,12 +69,16 @@ export function NoteEditorDialog({
     event.preventDefault()
     if (!cleanTitle) return
     setSaving(true)
-    const saved =
+    const stored =
       documentId === null
         ? await notes.write(cleanTitle, content)
-        : await notes.edit(documentId, cleanTitle, content)
+        : await notes.edit(
+            documentId,
+            cleanTitle,
+            content === (saved.data?.content ?? "") ? undefined : content
+          )
     setSaving(false)
-    if (saved) onOpenChange(false)
+    if (stored) onOpenChange(false)
   }
 
   return (
```

**File**: `surfsense_local/frontend/src/features/sources/source-notes.test.tsx` (modified, +60/-1)
```diff
@@ -2,6 +2,8 @@ import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
 import { cleanup, screen, waitFor } from "@testing-library/react"
 import userEvent from "@testing-library/user-event"
 
+import { toast } from "sonner"
+
 import { TooltipProvider } from "@/components/ui/tooltip"
 import { render } from "@/test-utils"
 
@@ -64,7 +66,7 @@ function NotesHarness() {
 }
 
 /** The workspace's documents, and every write the panel sends. */
-function serving(documents: object[]) {
+function serving(documents: object[], { failWrites = false } = {}) {
   const writes: { method: string; path: string; body: unknown }[] = []
   const fetchMock = vi.fn(
     async (input: RequestInfo | URL, init?: RequestInit) => {
@@ -81,6 +83,9 @@ function serving(documents: object[]) {
       if (method === "GET") return Response.json([])
       const body = init?.body ? JSON.parse(String(init.body)) : null
       writes.push({ method, path, body })
+      if (failWrites) {
+        return Response.json({ detail: "database is locked" }, { status: 503 })
+      }
       if (method === "POST" && path === "/workspaces/1/documents") {
         return Response.json(
           {
@@ -225,4 +230,58 @@ describe("notes and renaming in the sources panel", () => {
     ).toBe(true)
     expect(writes).toEqual([])
   })
+
+  it("sends no content when only a note's title changed", async () => {
+    // Content puts the note back to pending and re-ingests it for nothing.
+    const writes = serving([note])
+    const user = userEvent.setup()
+    render(<NotesHarness />)
+
+    await user.click(
+      await screen.findByRole("button", { name: "Actions for Ideas" })
+    )
+    await user.click(await screen.findByRole("menuitem", { name: "Edit note" }))
+    const body = await screen.findByRole("textbox", { name: "Note" })
+    await waitFor(() =>
+      expect((body as HTMLTextAreaElement).value).toBe("First draft")
+    )
+    const title = screen.getByRole("textbox", { name: "Title" })
+    await user.clear(title)
+    await user.type(title, "Plans")
+    await user.click(screen.getByRole("button", { name: "Save note" }))
+
+    await waitFor(() =>
+      expect(writes).toEqual([
+        {
+          method: "PATCH",
+          path: "/workspaces/1/documents/8",
+          body: { title: "Plans" },
+        },
+      ])
+    )
+  })
+
+  it("says why a rename failed where it can be seen, and keeps the dialog", async () => {
+    // The panel's own alert sits behind the dialog's backdrop.
+    serving([file], { failWrites: true })
+    const user = userEvent.setup()
+    render(<NotesHarness />)
+
+    await user.click(
+      await screen.findByRole("button", { name: "Actions for guide.txt" })
+    )
+    await user.click(await screen.findByRole("menuitem", { name: "Rename" }))
+    const name = await screen.findByRole("textbox", { name: "Name" })
+    await user.clear(name)
+    await user.type(name, "Field guide")
+    await user.click(screen.getByRole("button", { name: "Rename" }))
+
+    await waitFor(() =>
+      expect(toast.error).toHaveBeenCalledWith(
+        "Couldn’t rename the source",
+        expect.anything()
+      )
+    )
+    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy()
+  })
 })
```

**File**: `surfsense_local/frontend/src/features/sources/use-sources.ts` (modified, +30/-10)
```diff
@@ -248,10 +248,19 @@ export function useSources(workspaceId: number) {
       )
     )
 
-  // Each answers whether it saved, so its dialog closes only then. An edited
-  // note comes back pending, and the ingestion poll carries it to ready.
+  // Each answers whether it saved, so its dialog closes only then, and says why
+  // not in a toast: the panel's alert sits behind the dialog. An edited note
+  // comes back pending, and the ingestion poll carries it to ready.
+  const noteFailed = (cause: unknown) =>
+    errorToast(
+      intl.formatMessage({
+        id: "sources_note_save_toast",
+        defaultMessage: "Couldn’t save the note",
+      }),
+      { description: messageFrom(cause) }
+    )
+
   const writeNote = async (title: string, content: string) => {
-    setError(null)
     try {
       const created = await createNote(workspaceId, { title, content })
       // The server announces the note before it answers, so a refetch may
@@ -262,33 +271,44 @@ export function useSources(workspaceId: number) {
       ])
       return true
     } catch (cause) {
-      setError(messageFrom(cause))
+      noteFailed(cause)
       return false
     }
   }
 
   const rename = async (documentId: number, title: string) => {
-    setError(null)
     try {
       replace(await updateDocument(workspaceId, documentId, { title }))
       return true
     } catch (cause) {
-      setError(messageFrom(cause))
+      errorToast(
+        intl.formatMessage({
+          id: "sources_rename_toast",
+          defaultMessage: "Couldn’t rename the source",
+        }),
+        { description: messageFrom(cause) }
+      )
       return false
     }
   }
 
+  // Content only when it changed: sending it re-ingests the note.
   const editNote = async (
     documentId: number,
     title: string,
-    content: string
+    content?: string
   ) => {
-    setError(null)
     try {
-      replace(await updateDocument(workspaceId, documentId, { title, content }))
+      replace(
+        await updateDocument(
+          workspaceId,
+          documentId,
+          content === undefined ? { title } : { title, content }
+        )
+      )
       return true
     } catch (cause) {
-      setError(messageFrom(cause))
+      noteFailed(cause)
       return false
     }
   }
```

**File**: `surfsense_local/frontend/translations/de.json` (modified, +2/-0)
```diff
@@ -631,12 +631,14 @@
   "sources_note_load_error": "Diese Notiz konnte nicht geöffnet werden. Schließe sie und versuche es erneut.",
   "sources_note_new_title": "Neue Notiz",
   "sources_note_save_button": "Notiz speichern",
+  "sources_note_save_toast": "Notiz konnte nicht gespeichert werden",
   "sources_note_title_label": "Titel",
   "sources_open_original_error": "Quelle konnte nicht geöffnet werden",
   "sources_rename_cancel_button": "Abbrechen",
   "sources_rename_dialog_title": "Quelle umbenennen",
   "sources_rename_name_label": "Name",
   "sources_rename_submit_button": "Umbenennen",
+  "sources_rename_toast": "Quelle konnte nicht umbenannt werden",
   "sources_reveal_original_error": "Quelle konnte nicht gefunden werden",
   "sources_row_actions_aria": "Aktionen für {title}",
   "sources_row_cancelled_status": "Abgebrochen",
```

**File**: `surfsense_local/frontend/translations/en.json` (modified, +2/-0)
```diff
@@ -631,12 +631,14 @@
   "sources_note_load_error": "Couldn’t open this note. Close it and try again.",
   "sources_note_new_title": "New note",
   "sources_note_save_button": "Save note",
+  "sources_note_save_toast": "Couldn’t save the note",
   "sources_note_title_label": "Title",
   "sources_open_original_error": "Couldn’t open source",
   "sources_rename_cancel_button": "Cancel",
   "sources_rename_dialog_title": "Rename source",
   "sources_rename_name_label": "Name",
   "sources_rename_submit_button": "Rename",
+  "sources_rename_toast": "Couldn’t rename the source",
   "sources_reveal_original_error": "Couldn’t locate source",
   "sources_row_actions_aria": "Actions for {title}",
   "sources_row_cancelled_status": "Cancelled",
```

**File**: `surfsense_local/frontend/translations/es.json` (modified, +2/-0)
```diff
@@ -631,12 +631,14 @@
   "sources_note_load_error": "No se pudo abrir esta nota. Ciérrala e inténtalo de nuevo.",
   "sources_note_new_title": "Nueva nota",
   "sources_note_save_button": "Guardar nota",
+  "sources_note_save_toast": "No se pudo guardar la nota",
   "sources_note_title_label": "Título",
   "sources_open_original_error": "No se pudo abrir la fuente",
   "sources_rename_cancel_button": "Cancelar",
   "sources_rename_dialog_title": "Cambiar nombre de la fuente",
   "sources_rename_name_label": "Nombre",
   "sources_rename_submit_button": "Cambiar nombre",
+  "sources_rename_toast": "No se pudo cambiar el nombre de la fuente",
   "sources_reveal_original_error": "No se pudo localizar la fuente",
   "sources_row_actions_aria": "Acciones para {title}",
   "sources_row_cancelled_status": "Cancelado",
```

**File**: `surfsense_local/frontend/translations/fr.json` (modified, +2/-0)
```diff
@@ -631,12 +631,14 @@
   "sources_note_load_error": "Impossible d’ouvrir cette note. Fermez-la et réessayez.",
   "sources_note_new_title": "Nouvelle note",
   "sources_note_save_button": "Enregistrer la note",
+  "sources_note_save_toast": "Impossible d’enregistrer la note",
   "sources_note_title_label": "Titre",
   "sources_open_original_error": "Impossible d’ouvrir la source",
   "sources_rename_cancel_button": "Annuler",
   "sources_rename_dialog_title": "Renommer la source",
   "sources_rename_name_label": "Nom",
   "sources_rename_submit_button": "Renommer",
+  "sources_rename_toast": "Impossible de renommer la source",
   "sources_reveal_original_error": "Impossible de localiser la source",
   "sources_row_actions_aria": "Actions pour {title}",
   "sources_row_cancelled_status": "Annulé",
```

**File**: `surfsense_local/frontend/translations/hi.json` (modified, +2/-0)
```diff
@@ -631,12 +631,14 @@
   "sources_note_load_error": "यह नोट नहीं खुल सका। इसे बंद करें और फिर से कोशिश करें।",
   "sources_note_new_title": "नया नोट",
   "sources_note_save_button": "नोट सहेजें",
+  "sources_note_save_toast": "नोट सहेजा नहीं जा सका",
   "sources_note_title_label": "शीर्षक",
   "sources_open_original_error": "स्रोत नहीं खुल सका",
   "sources_rename_cancel_button": "रद्द करें",
   "sources_rename_dialog_title": "स्रोत का नाम बदलें",
   "sources_rename_name_label": "नाम",
   "sources_rename_submit_button": "नाम बदलें",
+  "sources_rename_toast": "स्रोत का नाम नहीं बदला जा सका",
   "sources_reveal_original_error": "स्रोत नहीं मिल सका",
   "sources_row_actions_aria": "{title} के लिए कार्रवाइयां",
   "sources_row_cancelled_status": "रद्द किया गया",
```

---

### Incident Patch 11: `cc502804` (2026-10-02)
**Commit Message**: fix(local): keep a rename or note edit made while a document ingests

finish_job wrote back the title and content begin_job had read, so a
file renamed during its parse got its upload name back, and a note
edited mid-ingest got its old text written over the edit, which the
re-ingest the edit queued then indexed. finish_job now writes only the
status, the error and the columns its caller produced: ingest passes a
file's extracted text and never a note's or a title; Studio passes the
title and content it generated.

**File**: `docs/architecture/documents.md` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ The desktop app previews an original in its left rail when its MIME type has a s
 3. **Chunk** ([`chunking.py`](../../surfsense_local/backend/worker/ingestion/chunking.py)). Chonkie's `RecursiveChunker` splits at the coarsest boundary that fits: a heading, a paragraph, a line, a sentence, a word, then a bare split so an over-long line still ends. Passages are at most 480 tokens by bge-small's tokenizer, under its 512-token limit with room for the two tokens it adds. That tokenizer is pinned to the chunker rather than taken from the active embedder, so changing the embedder would not re-cut documents and move every chunk id. Pieces under 24 characters are merged into a neighbour while splitting, so only a document shorter than that yields a shorter passage. The tokenizer is passed as an object, because one named by a string would reach the network even offline. Each passage records the lines its first and last characters fall on.
 4. **Embed** ([`encoder.py`](../../surfsense_local/backend/modules/embedding/encoder.py)). The active index's model, as its spec says, on onnxruntime's CPU provider: the document prefix, tokenize (truncated at the spec's `max_tokens`), pool, normalise, in batches of 32. For bge-small that is no prefix, 512 tokens, CLS pooling and L2 normalisation. No network and no model server. A vector whose width is not the spec's is refused rather than stored.
 5. **Index** ([`indexing.py`](../../surfsense_local/backend/worker/ingestion/indexing.py)). The document's old chunks are deleted, which clears both index tables through the delete trigger, and the new chunks are inserted with their float32 embeddings, followed by one row per chunk in the active index's vector table, and the document records that index in `embedding_index_id`. The keyword index follows by trigger; the vector cannot, because only ingest holds it. Editing a note therefore stops its old text being findable.
-6. **Finish.** The markdown is stored on `documents.content`, and `finish_job` writes `ready` unless a cancel won the race.
+6. **Finish.** `finish_job` writes `ready` unless a cancel won the race, and beside it only what the job produced: a file's extracted markdown on `documents.content`. A note's content is the user's and is only read, and ingest never writes `title`, so a rename or a note edit committed while the job ran stands, and the ingest that edit enqueued indexes the new text.
 
 Cancellation is checked after parsing and after embedding. On any other failure the worker rolls back and re-reads the row. If the document was deleted or cancelled meanwhile it stops; otherwise it writes `failed` with `error_message` set to the exception type and message, cut to 500 characters, notifies, and re-raises so Huey runs the job again, up to two more times. A later success clears the message. The sources panel shows it and offers Retry.
 
```

**File**: `surfsense_local/backend/tests/integration/worker/test_edits_during_ingest.py` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+"""An edit the API commits while a document ingests survives the ingest.
+
+`PATCH` has no processing guard, and right after an upload, while its parse
+runs, is when people rename. Ingest must finish with what it produced, not
+write back the row it read when it began.
+"""
+
+from collections.abc import Iterator
+
+import pytest
+from sqlalchemy import Engine, text
+from sqlalchemy.orm import Session
+
+from modules.documents.models import Document, DocumentStatus, DocumentType
+from modules.workspaces.models import Workspace
+from shared.db import create_session_factory
+from worker.ingestion import run
+
+pytestmark = pytest.mark.integration
+
+OLD = "# Cassini\n\nIt carried the Huygens probe, which landed on Titan.\n"
+NEW = "# Cassini\n\nThe mission ended in a dive into Saturn in 2017.\n"
+
+
+@pytest.fixture
+def session(engine: Engine) -> Iterator[Session]:
+    """A session on the migrated database ingest opens again by path."""
+    with create_session_factory(engine)() as opened:
+        yield opened
+
+
+def workspace(session: Session) -> Workspace:
+    """The workspace each document here belongs to."""
+    saturn = Workspace(name="Saturn")
+    session.add(saturn)
+    session.flush()
+    return saturn
+
+
+def edit_while_parsing(
+    session: Session, monkeypatch: pytest.MonkeyPatch, parsed: str, **changes: object
+) -> None:
+    """Commit `changes` to the row from another session, as the API would, while
+    the worker's first parse runs; every parse returns what the row held then."""
+    edited = False
+
+    def parse_during_edit(document: Document) -> str:
+        nonlocal edited
+        if edited:
+            return document.content or parsed
+        edited = True
+        with create_session_factory(session.get_bind())() as api:
+            row = api.get(Document, document.id)
+            for column, value in changes.items():
+                setattr(row, column, value)
+            api.commit()
+        return parsed
+
+    monkeypatch.setattr("worker.ingestion.parsing.markdown_for", parse_during_edit)
+
+
+def test_a_file_renamed_during_its_parse_keeps_its_new_name(
+    session: Session, stub_model: None, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """Without this the upload's name came back when ingest finished."""
+    document = Document(
+        workspace_id=workspace(session).id,
+        title="scan-0042.md",
+        document_type=DocumentType.FILE,
+        dedup_key="abc",
+        document_metadata={"suffix": ".md"},
+    )
+    session.add(document)
+    session.commit()
+    edit_while_parsing(session, monkeypatch, OLD, title="Cassini notes")
+
+    run(document.id)
+
+    session.expire_all()
+    assert document.title == "Cassini notes"
+    assert document.status is DocumentStatus.READY
+    assert document.content == OLD
+
+
+def test_a_note_edited_during_its_ingest_ends_with_the_new_text_indexed(
+    session: Session, stub_model: None, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """The edit queues another ingest; it must find the new text, not the old."""
+    note = Document(
+        workspace_id=workspace(session).id,
+        title="Cassini",
+        document_type=DocumentType.NOTE,
+        content=OLD,
+    )
+    session.add(note)
+    session.commit()
+    edit_while_parsing(
+        session, monkeypatch, OLD, content=NEW, status=DocumentStatus.PENDING
+    )
+
+    run(note.id)
+    run(note.id)  # the ingest the edit enqueued
+
+    session.expire_all()
+    assert note.content == NEW
+    assert note.status is DocumentStatus.READY
+
+    def indexed(word: str) -> int:
+        return session.scalar(
+            text("SELECT count(*) FROM chunks_fts WHERE chunks_fts MATCH :word"),
+            {"word": word},
+        )
+
+    assert (indexed("Huygens"), indexed("dive")) == (0, 1)
```

**File**: `surfsense_local/backend/worker/ingestion/pipeline.py` (modified, +7/-3)
```diff
@@ -2,7 +2,7 @@
 
 from sqlalchemy.orm import Session
 
-from modules.documents.models import Document, DocumentStatus
+from modules.documents.models import Document, DocumentStatus, DocumentType
 from modules.embedding.active import require_active_index
 from shared.config import get_storage_settings
 from shared.db import create_db_engine, create_session_factory
@@ -47,8 +47,12 @@ def _ingest(session: Session, document: Document) -> None:
         raise_if_cancelled(session, document)
         indexing.replace_chunks(session, document, index, passages, vectors)
 
-        document.content = markdown
-        if not finish_job(session, document, DocumentStatus.READY):
+        # A file's text is what ingest extracted; a note's is the user's, only
+        # read here, so writing it back would undo an edit made mid-ingest.
+        produced = (
+            {"content": markdown} if document.document_type is DocumentType.FILE else {}
+        )
+        if not finish_job(session, document, DocumentStatus.READY, **produced):
             return
         notify_document_updates(document)
     except JobCancelledError:
```

**File**: `surfsense_local/backend/worker/jobs.py` (modified, +7/-7)
```diff
@@ -68,20 +68,20 @@ def finish_job(
     document: Document,
     status: DocumentStatus,
     error_message: str | None = None,
+    **produced: str,
 ) -> bool:
-    """Write a terminal status unless cancel won the race. Returns whether we wrote."""
+    """Write a terminal status unless cancel won the race. Returns whether we wrote.
+
+    Only the columns the job `produced` are written beside it, never the row as
+    `begin_job` read it: a rename or a note edit committed meanwhile must stand.
+    """
     result = session.execute(
         update(Document)
         .where(
             Document.id == document.id,
             Document.status != DocumentStatus.CANCELLED,
         )
-        .values(
-            status=status,
-            error_message=error_message,
-            content=document.content,
-            title=document.title,
-        )
+        .values(status=status, error_message=error_message, **produced)
     )
     if result.rowcount == 0:
         session.rollback()
```

**File**: `surfsense_local/backend/worker/studio/job.py` (modified, +7/-1)
```diff
@@ -97,7 +97,13 @@ def _generate(session: Session, artifact: Artifact) -> None:
         )
         persist.persist(session, artifact, document, built)
 
-        if not finish_job(session, document, DocumentStatus.READY):
+        if not finish_job(
+            session,
+            document,
+            DocumentStatus.READY,
+            title=document.title,
+            content=document.content,
+        ):
             return
         notify_artifact_updates(artifact)
         logger.info(
```

---

### Incident Patch 12: `6f1f8363` (2026-10-02)
**Commit Message**: fix(local): keep the thinking choice for the session when it cannot be stored

**File**: `surfsense_local/frontend/src/features/chat/chat-composer.test.tsx` (modified, +28/-0)
```diff
@@ -96,6 +96,34 @@ describe("chat composer", () => {
     ).toBe("false")
   })
 
+  it("sends what the switch shows when the choice cannot be stored", async () => {
+    vi.stubGlobal(
+      "fetch",
+      vi.fn(async () => Response.json([]))
+    )
+    const setItem = vi
+      .spyOn(Storage.prototype, "setItem")
+      .mockImplementation(() => {
+        throw new DOMException("full", "QuotaExceededError")
+      })
+    const user = userEvent.setup()
+    render(
+      <TooltipProvider>
+        <Harness />
+      </TooltipProvider>
+    )
+
+    const toggle = screen.getByRole("button", { name: "Thinking" })
+    await user.click(toggle)
+
+    expect(toggle.getAttribute("aria-pressed")).toBe("false")
+    expect(readThinkingOn()).toBe(false)
+
+    setItem.mockRestore()
+    await user.click(toggle)
+    expect(readThinkingOn()).toBe(true)
+  })
+
   it("holds the thinking switch on for a model that cannot be told to stop", async () => {
     vi.stubGlobal(
       "fetch",
```

**File**: `surfsense_local/frontend/src/features/chat/thinking-preference.ts` (modified, +7/-0)
```diff
@@ -7,7 +7,12 @@ export function canSkipThinking(model: ModelSelection | null | undefined) {
   return model?.provider === "llamacpp"
 }
 
+// The choice a failed write could not store, so the switch and the next
+// request still agree for as long as the window lives.
+let unsaved: boolean | null = null
+
 export function readThinkingOn() {
+  if (unsaved !== null) return unsaved
   try {
     return localStorage.getItem(THINKING_KEY) !== "off"
   } catch {
@@ -18,7 +23,9 @@ export function readThinkingOn() {
 export function writeThinkingOn(on: boolean) {
   try {
     localStorage.setItem(THINKING_KEY, on ? "on" : "off")
+    unsaved = null
   } catch {
     // Private browsing and full disks throw.
+    unsaved = on
   }
 }
```

---

### Incident Patch 13: `4323d11e` (2026-10-02)
**Commit Message**: docs(local): drop the spellchecker lines the fix makes untrue

**File**: `docs/ROADMAP.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ What the maintainers are working on, grouped by when. This page names the initia
 ## Now
 
 - **Release and CI health.** v2.0.3 was the first release to carry the llama.cpp, sd.cpp and audio.cpp runtimes, built and packaged on all three runners, and [`desktop-tests.yml`](../.github/workflows/desktop-tests.yml) runs the desktop backend, frontend and Electron tests on pull requests. What is left is the CI that proves the runtimes: no job generates an image with the staged `sd-server`, and the release workflow still accepts a prerelease version. See [packaging](architecture/packaging.md) and [updates](architecture/updates.md).
-- **Egress gaps.** The follow-up fetch for a remote image URL leaves without a consent decision, Electron's spellchecker likely fetches dictionaries without one, and some stored grants no longer match what Settings › Network shows. See [egress](architecture/egress.md).
+- **Egress gaps.** The follow-up fetch for a remote image URL leaves without a consent decision, and some stored grants no longer match what Settings › Network shows. See [egress](architecture/egress.md).
 - **Import from cloud.** The hosted export window closes on 18 Oct 2026. Imports need a progress summary, and a re-run must bring back the chat threads an interrupted import missed. See [import](architecture/import.md).
 - **Scraper API and MCP license mode.** PATs are purged on 18 Oct 2026; after that, license mode is how scraper API and MCP users keep access. See [contract 2](contracts/02-scraper-api-auth.md).
 - **Model catalog.** One catalog for local and remote models, each classified offline from a reviewed, packaged manifest and keyed by model type. See the [proposal](proposals/model-catalog.md).
```

**File**: `docs/architecture/egress.md` (modified, +1/-2)
```diff
@@ -45,7 +45,7 @@ The GGUF download runs inside the API (`modules/llm/providers/llamacpp/download.
 - App updates. electron-updater talks to GitHub from the Electron main process, out of reach of `egress.require()`, so it is gated by the `automatic` preference in `updates.json` and by consent in the renderer instead ([updates](updates.md)). Settings › Network shows it as the App updates row, host `github.com`.
 - Links. The main process refuses new windows and `https:` navigations inside the app, and hands a URL on `surfsense.com` or `www.surfsense.com`, under `github.com/MODSetter/SurfSense`, the project's Discord invite, or an OpenRouter page shaped `/<author>/<model>` (where OpenRouter names a speech model's voices) to `shell.openExternal` (`electron/src/main/external-url.ts`); that request is the browser's. Report issue opens one such link, a GitHub bug form with the user's description in it; its session log goes to the clipboard, never into the link ([issue reports](issue-reports.md)).
 - Docling. Packaged Python sidecars run with `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`) and parse with the bundled parser pack ([packaging](packaging.md)). [`test_parsing.py`](../../surfsense_local/backend/tests/integration/worker/test_parsing.py) converts a scanned PDF and images from the parser pack with every outbound connection refused and an empty Hugging Face cache; it runs from source and skips where the pack is not staged.
-- Spellchecking. Chromium fetches a Hunspell dictionary from Google's CDN (`redirector.gvt1.com/edgedl/chrome/dict/`) for each language in a session's spellchecker list, when the session is created. Measured on Electron 44.2.0 on Linux, `webPreferences.spellcheck: false` and `setSpellCheckerEnabled(false)` do not stop it, and `webRequest` never sees it. The main process empties the list on `session-created`, before the app is ready ([`spellcheck.ts`](../../surfsense_local/electron/src/main/spellcheck.ts)), and no request is made after that. So Windows and Linux have no spellchecking. macOS uses the OS spellchecker, downloads nothing and ignores the call, so it keeps working there.
+- Spellchecking. Chromium fetches a Hunspell dictionary from Google's CDN (`redirector.gvt1.com/edgedl/chrome/dict/`) for each language in a session's spellchecker list, when the session is created. Measured on Electron 44.2.0 on Linux, `webPreferences.spellcheck: false` and `setSpellCheckerEnabled(false)` do not stop it, and `webRequest` never sees it. The main process empties the list on `session-created`, before the app is ready ([`spellcheck.ts`](../../surfsense_local/electron/src/main/spellcheck.ts)), and no request is made after that. So Windows and Linux have no spellchecking. macOS uses the OS spellchecker, downloads nothing and ignores the call, so it keeps working there. Not measured on Windows, which runs the same code.
 - Licenses. The app verifies license files offline and never contacts Keygen ([license](license/app.md)); `PUT /egress/keygen` is refused as unknown.
 
 ## Asking for consent
@@ -67,6 +67,5 @@ Settings › Network lists the App updates row and every destination with its ho
 
 ## Known gaps
 
-- The spellchecker's dictionary download is measured as stopped on Linux and absent on macOS; nobody has run it on Windows.
 - The Office Studio formats run model-written code in the worker, and that code can open connections of its own ([studio](studio.md)).
 - Grants stored under the earlier destination names, `model_download`, `model_search` and `image_model_pull`, are not carried over to `host:huggingface.co`. Nothing reads them any more, so someone who had allowed model downloads is asked again, and the old rows stay in the table; revision 0012 still turns an Ollama-era `ollama_pull` grant into `model_download`.
```

**File**: `docs/architecture/updates.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ How to cut a release is in [`surfsense_local/RELEASE.md`](../../surfsense_local/
 
 ## Consent
 
-Updates are the one call the app is designed to make on its own, so they are off until the user turns them on. The spellchecker's dictionary download is a known exception ([egress](egress.md)).
+Updates are the one call the app is designed to make on its own, so they are off until the user turns them on.
 
 - The preference is `updates.json` in Electron's user data: `automatic`, false by default, and `lastCheckedAt`, which Settings › Network shows as the App updates row's last call.
 - The check at launch runs only when `automatic` is on.
```

---

### Incident Patch 14: `5f7a6306` (2026-10-02)
**Commit Message**: fix(local): stop Chromium's spellchecker from downloading dictionaries

On Linux Electron fetched a Hunspell dictionary from Google's CDN at startup,
and neither spellcheck: false nor setSpellCheckerEnabled(false) stopped it.
Empty every session's spellchecker language list on session-created, which
leaves nothing to fetch; macOS uses the OS spellchecker and is unaffected.

**File**: `docs/architecture/egress.md` (modified, +2/-1)
```diff
@@ -45,6 +45,7 @@ The GGUF download runs inside the API (`modules/llm/providers/llamacpp/download.
 - App updates. electron-updater talks to GitHub from the Electron main process, out of reach of `egress.require()`, so it is gated by the `automatic` preference in `updates.json` and by consent in the renderer instead ([updates](updates.md)). Settings › Network shows it as the App updates row, host `github.com`.
 - Links. The main process refuses new windows and `https:` navigations inside the app, and hands a URL on `surfsense.com` or `www.surfsense.com`, under `github.com/MODSetter/SurfSense`, the project's Discord invite, or an OpenRouter page shaped `/<author>/<model>` (where OpenRouter names a speech model's voices) to `shell.openExternal` (`electron/src/main/external-url.ts`); that request is the browser's. Report issue opens one such link, a GitHub bug form with the user's description in it; its session log goes to the clipboard, never into the link ([issue reports](issue-reports.md)).
 - Docling. Packaged Python sidecars run with `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`) and parse with the bundled parser pack ([packaging](packaging.md)). [`test_parsing.py`](../../surfsense_local/backend/tests/integration/worker/test_parsing.py) converts a scanned PDF and images from the parser pack with every outbound connection refused and an empty Hugging Face cache; it runs from source and skips where the pack is not staged.
+- Spellchecking. Chromium fetches a Hunspell dictionary from Google's CDN (`redirector.gvt1.com/edgedl/chrome/dict/`) for each language in a session's spellchecker list, when the session is created. Measured on Electron 44.2.0 on Linux, `webPreferences.spellcheck: false` and `setSpellCheckerEnabled(false)` do not stop it, and `webRequest` never sees it. The main process empties the list on `session-created`, before the app is ready ([`spellcheck.ts`](../../surfsense_local/electron/src/main/spellcheck.ts)), and no request is made after that. So Windows and Linux have no spellchecking. macOS uses the OS spellchecker, downloads nothing and ignores the call, so it keeps working there.
 - Licenses. The app verifies license files offline and never contacts Keygen ([license](license/app.md)); `PUT /egress/keygen` is refused as unknown.
 
 ## Asking for consent
@@ -66,6 +67,6 @@ Settings › Network lists the App updates row and every destination with its ho
 
 ## Known gaps
 
-- Electron's Chromium spellchecker is not configured in `electron/src/main/index.ts`. Electron's type definitions say it downloads Hunspell dictionaries from the Chromium CDN by default, and `spellcheck` is on unless turned off, so on Windows and Linux it likely makes that call; nobody has checked at runtime.
+- The spellchecker's dictionary download is measured as stopped on Linux and absent on macOS; nobody has run it on Windows.
 - The Office Studio formats run model-written code in the worker, and that code can open connections of its own ([studio](studio.md)).
 - Grants stored under the earlier destination names, `model_download`, `model_search` and `image_model_pull`, are not carried over to `host:huggingface.co`. Nothing reads them any more, so someone who had allowed model downloads is asked again, and the old rows stay in the table; revision 0012 still turns an Ollama-era `ollama_pull` grant into `model_download`.
```

**File**: `surfsense_local/electron/src/main/index.ts` (modified, +4/-0)
```diff
@@ -58,6 +58,7 @@ import {
   type Sidecars,
 } from "./sidecars/supervisor.ts"
 import type { SidecarContext, SidecarSpec } from "./sidecars/types.ts"
+import { refuseSpellcheckDownloads } from "./spellcheck.ts"
 import {
   attachUpdater,
   readUpdatePrefs,
@@ -712,6 +713,9 @@ app.commandLine.appendSwitch(
   "OverlayScrollbar,FluentScrollbar,FluentOverlayScrollbars"
 )
 
+// Also before whenReady(): the default session is created with the app.
+refuseSpellcheckDownloads(app)
+
 // one app, one set of sidecars: a second instance would fight over the SQLite
 // file and the port, so hand off to the primary window and quit
 if (app.requestSingleInstanceLock()) {
```

**File**: `surfsense_local/electron/src/main/spellcheck.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import assert from "node:assert/strict"
+import { readFileSync } from "node:fs"
+import test from "node:test"
+
+import { refuseSpellcheckDownloads } from "./spellcheck.ts"
+
+function fakeApp() {
+  const listeners: Record<string, ((session: never) => void)[]> = {}
+  return {
+    listeners,
+    on(event: string, listener: (session: never) => void) {
+      ;(listeners[event] ??= []).push(listener)
+    },
+  }
+}
+
+test("empties the spellchecker's language list for every session created", () => {
+  const app = fakeApp()
+  refuseSpellcheckDownloads(app)
+
+  const set: string[][] = []
+  const session = {
+    setSpellCheckerLanguages: (languages: string[]) => set.push(languages),
+  }
+  for (const listener of app.listeners["session-created"] ?? []) {
+    listener(session as never)
+    listener(session as never)
+  }
+
+  // A language in the list is what Chromium downloads a dictionary for.
+  assert.deepEqual(set, [[], []])
+})
+
+test("listens for nothing but a session being created", () => {
+  const app = fakeApp()
+  refuseSpellcheckDownloads(app)
+
+  assert.deepEqual(Object.keys(app.listeners), ["session-created"])
+})
+
+test("is registered before the app can become ready", () => {
+  // Measured on Electron 44.2.0: one `await` after `ready` is already too late,
+  // because the default session starts its download when it is created.
+  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
+  const registered = source.indexOf("\nrefuseSpellcheckDownloads(app)")
+  const started = source.indexOf("\nif (app.requestSingleInstanceLock())")
+
+  assert.ok(registered !== -1, "index.ts calls it at the top level")
+  assert.ok(started !== -1)
+  assert.ok(registered < started)
+})
```

**File**: `surfsense_local/electron/src/main/spellcheck.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+// Chromium downloads a Hunspell dictionary from Google's CDN for every
+// language in a session's spellchecker list, as soon as the session exists.
+// Measured on Electron 44.2.0 on Linux: `webPreferences.spellcheck: false` and
+// `setSpellCheckerEnabled(false)` stop the checking and not the download, and
+// `webRequest` never sees it. An empty list is what leaves nothing to fetch.
+// macOS uses the OS spellchecker, downloads nothing, and ignores the call.
+type SpellcheckSession = { setSpellCheckerLanguages(languages: string[]): void }
+type SessionCreator = {
+  on(event: "session-created", listener: (session: SpellcheckSession) => void): unknown
+}
+
+/** Call before `ready`: the default session is created with the app. */
+export function refuseSpellcheckDownloads(app: SessionCreator): void {
+  app.on("session-created", (session) => session.setSpellCheckerLanguages([]))
+}
```

---

### Incident Patch 15: `1d74dce5` (2026-10-02)
**Commit Message**: Merge pull request #2138 from ybai08/fix/sunset-deletion-date

fix(web): state the 18 October 2026 deletion date on /sunset

**File**: `docs/architecture/sunset.md` (modified, +1/-1)
```diff
@@ -54,4 +54,4 @@ On the web, `proxy.ts` sends every non-public route to `/sunset` with a 307. The
 
 - The purge selects every user, so once license mode creates synthetic license users it would erase them too.
 - The synchronous export has no size warning and no timeout.
-- `/sunset` has the export button, download links and import steps, but not the deletion date (18 Oct 2026), the refund-or-discount offer or the change for MCP users, which the launch plan put on it.
+- `/sunset` has the export button, the deletion date, download links and import steps, but not the refund-or-discount offer or the change for MCP users, which the launch plan put on it.
```

**File**: `surfsense_web/app/(home)/sunset/page.tsx` (modified, +12/-1)
```diff
@@ -15,6 +15,13 @@ export const metadata: Metadata = {
 	robots: { index: false, follow: false },
 };
 
+/**
+ * The day the purge runs, written out: the page must still read correctly
+ * after it, which a countdown would not. `docs/architecture/sunset.md` is the
+ * source.
+ */
+const DELETION_DATE = "18 October 2026";
+
 /**
  * The move, in the order someone does it.
  *
@@ -31,7 +38,7 @@ export const metadata: Metadata = {
 const STEPS: GuideStep[] = [
 	{
 		title: "Export your cloud data",
-		body: "Save the ZIP somewhere you will find it again. You need it in step five.",
+		body: `Your cloud data is deleted on ${DELETION_DATE}, and an export made before then is the only copy you keep. Save the ZIP somewhere you will find it again. You need it in step five.`,
 		control: <SunsetExport />,
 	},
 	{
@@ -77,6 +84,10 @@ export default function SunsetPage() {
 			<section className="ss-home-hero ss-home-pad">
 				<div className="mx-auto max-w-2xl text-center">
 					<h1 className="ss-home-display">SurfSense is moving to a local app</h1>
+					<p className="ss-home-lede mx-auto mt-6 max-w-xl">
+						The cloud service is export-only, and everything stored in it is deleted on{" "}
+						<strong className="whitespace-nowrap">{DELETION_DATE}</strong>. Export before then.
+					</p>
 				</div>
 			</section>
 
```

#### Recent Merged Pull Requests:
- **PR #2180** (2026-10-06): feat(sources): tidy the sources panel and rebuild its drag and drop (@AnishSarkar22)
- **PR #2179** (2026-10-05): feat(chat): keep chat and agent replies running in the background (@AnishSarkar22)
- **PR #2178** (2026-10-06): [Local|Cache] Let the model reuse the start of every prompt (@CREDO23)
- **PR #2177** (2026-10-05): File agent: folders, PowerPoint and Excel, templates, per-chat folders, inline previews and model capability levels (@MODSetter)
- **PR #2168** (2026-10-05): feat(local): give install events a code the interface can translate (@ybai08)
- **PR #2167** (2026-10-04): [Local|Release] Release desktop 2.1.0 (@CREDO23)
- **PR #2166** (2026-10-03): [CI|Release] Run the artifact actions on Node 24 (@CREDO23)
- **PR #2165** (2026-10-03): [Web|Lint] Format the files Biome flags on dev (@CREDO23)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
