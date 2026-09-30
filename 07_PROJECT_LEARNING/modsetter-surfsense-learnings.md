# Forensic Learning Record (Deep Inspection): MODSetter/SurfSense

> **Canonical Artifact**: `07_PROJECT_LEARNING/modsetter-surfsense-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MODSetter/SurfSense](https://github.com/MODSetter/SurfSense))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:46:45.884Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MODSetter/SurfSense`
- **Description**: Air gapped, privacy focused open source NotebookLM alternative. Join our Discord: https://discord.gg/ejRNvftDp9
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 16303 stars

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
      message: error instanceof Error ?
```

### Core Architecture Module: `docker/sandbox/remotion/src/Deck.tsx`
```
import {Audio} from "@remotion/media";
import type React from "react";
import type {ComponentType} from "react";
import {
  AbsoluteFill,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {sceneComponents} from "./scenes/generated";

export type SceneInput = {
  slide_number: number;
  code: string;
  audio?: string;
};

export type DeckProps = {
  fps: number;
  min_duration_in_frames: number;
  scenes: SceneInput[];
  sceneDurations?: number[];
};

const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 0.68], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        right: 36,
        display: "grid",
        placeItems: "center",
        width: 44,
        height: 44,
        alignItems: "center",
        borderRadius: 9999,
        background: "rgba(0, 0, 0, 0.2)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        pointerEvents: "none",
        zIndex: 9999,
        opacity,
      }}
    >
      <img
        src={staticFile("icon-128.svg")}
        alt=""
        style={{
          width: 28,
          height: 28,
          objectFit: "contain",
          filter: "brightness(0) invert(1)",
          opacity: 0.82,
        }}
      />
    </div>
  );
};

export const Deck: React.FC<DeckProps> = ({
  scenes,
  sceneDurations = [],
}) => {
  const {fps} = useVideoConfig();
  if (scenes.length !== sceneComponents.length) {
    throw new Error(
      `Compiled ${sceneComponents.length} scenes, received ${scenes.length} scene props`,
    );
  }

  return (
    <AbsoluteFill>
      <Series>
        {scenes.map((scene, index) => {
          const Scene = sceneComponents[index] as ComponentType;
          const durationInFrames = sceneDurations[index];
          if (!durationInFrames) {
            throw new Error(`Missing duration for slide ${scene.slide_number}`);
          }
          return (
            <Series.Sequence
              key={scene.slide_number}
              durationInFrames={durationInFrames}
              premountFor={fps}
            >
              <Scene />
              {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
      <Watermark />
    </AbsoluteFill>
  );
};

```

### Core Architecture Module: `docker/sandbox/remotion/src/MindmapPng.tsx`
```
import {Transformer} from "markmap-lib";
import {Markmap} from "markmap-view";
import type React from "react";
import {useEffect, useRef, useState} from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
} from "remotion";

export type MindmapPngProps = {
  markdown: string;
};

const LAYOUT_TIMEOUT_MS = 15_000;
const MIN_READABLE_SCALE = 0.25;
const transformer = new Transformer([]);

const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export const MindmapPng: React.FC<MindmapPngProps> = ({markdown}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderHandle] = useState(() =>
    delayRender("Rendering mind map", {timeoutInMilliseconds: LAYOUT_TIMEOUT_MS}),
  );

  useEffect(() => {
    let disposed = false;
    let markmap: Markmap | undefined;

    const render = async () => {
      try {
        await document.fonts.ready;
        if (!svgRef.current) throw new Error("Mind-map SVG is unavailable");

        const {root} = transformer.transform(markdown);
        if (!root.children?.length) {
          throw new Error("Mind map must contain at least one child node");
        }

        // No Markmap options are supplied: export uses its built-in stylesheet,
        // default colors, default spacing, and default all-expanded state.
        markmap = Markmap.create(svgRef.current);
        await markmap.setData(root);
        await markmap.fit();
        await nextPaint();
        if (disposed) return;

        const bounds = markmap.g.node()?.getBoundingClientRect();
        const zoomState = (
          svgRef.current as SVGSVGElement & {__zoom?: {k?: number}}
        ).__zoom;
        const scale = zoomState?.k;
        if (
          !bounds ||
          ![bounds.left, bounds.top, bounds.right, bounds.bottom].every(
            Number.isFinite,
          ) ||
          bounds.width <= 0 ||
          bounds.height <= 0
        ) {
          throw new Error("Mind-map layout produced invalid bounds");
        }
        if (!Number.isFinite(scale) || (scale as number) < MIN_READABLE_SCALE) {
          throw new Error("Mind-map layout is too dense for a readable export");
        }

        continueRender(renderHandle);
      } catch (error) {
        cancelRender(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void render();
    return () => {
      disposed = true;
      markmap?.destroy();
    };
  }, [markdown, renderHandle]);

  return (
    <AbsoluteFill style={{backgroundColor: "#fff"}}>
      <svg
        ref={svgRef}
        className="markmap"
        width="2400"
        height="1600"
        aria-label="Mind map"
      />
    </AbsoluteFill>
  );
};

```

### Core Architecture Module: `docker/sandbox/remotion/src/Root.tsx`
```
import {parseMedia} from "@remotion/media-parser";
import type React from "react";
import {Composition, staticFile, Still} from "remotion";
import {Deck, type DeckProps} from "./Deck";
import {MindmapPng, type MindmapPngProps} from "./MindmapPng";

const defaultProps: DeckProps = {
  fps: 30,
  min_duration_in_frames: 300,
  scenes: [],
  sceneDurations: [],
};

const defaultMindmapProps: MindmapPngProps = {
  markdown: "# Mind map\n\n- Branch\n  - Leaf",
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Main"
      component={Deck}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1}
      defaultProps={defaultProps}
      calculateMetadata={async ({props}) => {
        const sceneDurations = await Promise.all(
          props.scenes.map(async (scene) => {
            if (!scene.audio) {
              return props.min_duration_in_frames;
            }
            const {durationInSeconds} = await parseMedia({
              src: staticFile(scene.audio),
              fields: {durationInSeconds: true},
              acknowledgeRemotionLicense: true,
            });
            if (
              durationInSeconds === null ||
              !Number.isFinite(durationInSeconds)
            ) {
              throw new Error(
                `Could not measure audio for slide ${scene.slide_number}`,
              );
            }
            return Math.max(
              Math.ceil(durationInSeconds * props.fps),
              props.min_duration_in_frames,
            );
          }),
        );

        return {
          fps: props.fps,
          durationInFrames: Math.max(
            1,
            sceneDurations.reduce((sum, duration) => sum + duration, 0),
          ),
          props: {...props, sceneDurations},
        };
      }}
    />
    <Still
      id="Mindmap"
      component={MindmapPng}
      width={2400}
      height={1600}
      defaultProps={defaultMindmapProps}
    />
  </>
);

```

### Core Architecture Module: `docker/sandbox/remotion/src/index.ts`
```
import {registerRoot} from "remotion";
import {Root} from "./Root";

registerRoot(Root);

```

### Core Architecture Module: `docker/sandbox/remotion/src/scenes/generated.ts`
```
// Replaced by render.mjs before bundling and restored during cleanup.
export const sceneComponents = [];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #1980** (2026-09-29): **The model screen never marks the local runtime unavailable**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/catalog.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/catalog.md) lists this under **Known gaps**:  > The screen never marks the runtime unavailable, so installs stay enabled while llama-server is down.  ## Why it matters  The state is already designed and already written: `ModelCard` renders "The local runtime is unavailable." and `BuildAction` refuses to install when `runtimeAvailable` is false. Every one of the five call sites passes the bare `runtimeAvailable`, which is `true`, so neither can ever happen.  With llama-server down, the screen looks completely normal. Download works, because the API fetches the file itself — then the job sits in "Preparing…" for the thirty seconds `wait_until_servable()` waits before giving up, and finishes with "Downloaded. It becomes available once the runtime restarts." Pressing Use afterwards fails. Nothing in that sequence names the runtime, so the user concludes the model is broken, or the app is, and tries another one.  ## Where  - [`surfsense_local/frontend/src/features/models/local/chat/build-action.tsx`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/frontend/src/features/models/local/chat/build-action.tsx) — `runtimeAvailable`, and `cannotInstall` which already reads it. - [`surfsense_local/frontend/src/features/models/local/chat/model-card.tsx`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/frontend
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one.  Plan: a failing test first in `download-chat-models.test.tsx` with `/llm/providers` reporting llama.cpp `healthy: false`, asserting the screen says the runtime is unavailable once, not per row. Then a small hook over the existing `getProviders()` with its own query key, refetched on window focus and on an interval, feeding `runtimeAvailable` to the chat call sites only; the image and audio sections stay hard-coded and say so, since their servers are a different question. I'll state in the PR whether Download stays enabled while the runtime is down. Known gaps line deleted in the same PR, against `dev`.
  > Fixed by #2057, `fix(local): say once on the chat model screen that the runtime is down`, by @ybai08. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1980` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

- **Issue #1976** (2026-09-29): **`POST /llm/installs` accepts a curated build that will not fit on this machine**
  *Symptoms*: ## The gap  [`docs/architecture/local-models/catalog.md`](https://github.com/MODSetter/SurfSense/blob/dev/docs/architecture/local-models/catalog.md) lists this under **Known gaps**:  > `POST /llm/installs` does not refuse a curated build that will not fit; only the screen's disabled Download does.  ## Why it matters  The whole catalog is built on the server deciding and the screen rendering — the doc says so twice, and every fit, badge and recommendation is computed in the backend for exactly that reason. This one refusal is the exception: the only thing standing between a user and a multi-gigabyte download of a model their machine cannot load is a `disabled` attribute in the renderer.  Anything that is not that button gets through. Onboarding's model step, a catalog the page fetched before the user unplugged an external GPU, a second window, or a retry of a job whose id is still warm — all of them reach `POST /llm/installs`, and the job runs to completion, writes an install record, and leaves a model that fails when it is chosen. The searched path already refuses this properly with a sentence; the curated path, the one the app actually recommends from, does not.  ## Where  - [`surfsense_local/backend/modules/llm/catalog/local/engines/llamacpp/engine.py`](https://github.com/MODSetter/SurfSense/blob/dev/surfsense_local/backend/modules/llm/catalog/local/engines/llamacpp/engine.py) — `check()`, and its `if not plan.needs_check: return plan` first line. Everything b
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one.  Plan: a failing test first in `test_service.py`, a curated build resolved on a tiny budget, asserting `InstallRefusedError` before any bytes move, plus a job-level case in `test_install_jobs.py` ending in the error event. Then the plumbing: the curated plan learns its entry's committed `shape` when `resolve_install()` builds it, so `check()` can price it through the same `price()` the rows path uses and refuse only `TOO_BIG`; anything that spills still installs with no confirmation. Known gaps line deleted and the install sections updated in the same PR, against `dev`.
  > I'd like to take this one — PR is up: #2055. A curated id now resolves with its manifest entry's shape, and llama.cpp's `check()` prices it with the row's own `price()` and refuses `TOO_BIG`; spills still install. Why the plan learns the shape rather than the check moving is in the PR.
  > Fixed by #2056, `fix(local): refuse a curated install that will not fit before any bytes move`, by @ybai08. Merged into `dev`.  Closing by hand rather than by keyword: `Fixes #1976` only auto-closes on a merge to the default branch, and this repo merges through `dev` ([CONTRIBUTING](https://github.com/MODSetter/SurfSense/blob/dev/CONTRIBUTING.md)), so this would have stayed open and claimable while the work was already done. It reaches `main` with the next release.  Nothing left to pick up here.

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

### Incident Patch 1: `a0b4171f` (2026-09-28)
**Commit Message**: fix(local): stop offering Retry for unfixable chat errors

model_cannot_run and context_too_long both tell the user what would
actually help (pick another model, or start a new chat / pick a model
with a larger window), but chat-error-notice.tsx fell through to the
"retry" default, offering a button that resends the identical message
to the identical model and fails identically.

model_cannot_run now maps to the existing Model setup action, and
context_too_long offers no action, since its sentence already says
what to do and no button can shrink the conversation.

Co-Authored-By: Claude <noreply@anthropic.com>

**File**: `docs/architecture/chat.md` (modified, +1/-2)
```diff
@@ -101,7 +101,7 @@ The list handed to the generator is `[system, *history within budget, user]`.
 - The runtime is scoped to the active thread; thread lists and workspaces stay application state. Sending from a new chat first creates a thread titled "New chat". The last open thread of each workspace is remembered in `localStorage`.
 - [`sse.ts`](../../surfsense_local/frontend/src/features/chat/sse.ts) parses the stream chunk-safely: frames split on blank lines, and a partial frame waits for the next read. This token stream is separate from the `/events` channel.
 - From send until the first token, the assistant turn shows a shimmering "Thinking" beside an orbiting-dots indicator ported from surfsense_web ([`thinking-indicator.tsx`](../../surfsense_local/frontend/src/features/chat/thinking-indicator.tsx)), so a model load or a long prompt is never a blank reply. It is one header from send to answer, whose state moves from waiting to thinking to done, so the indicator and shimmer never restart when the trace arrives. A thinking model's trace then streams open below it, above the answer, in a box 13rem tall that fades at its scrolled edges and follows the newest line until the reader scrolls up, and folds to "Thought for N seconds" when the answer starts, the indicator sliding away; the person's own open or close wins until the next reply, and holds the chat's scroll still while the trace slides, with assistant-ui's `useScrollLock` ([`reply-thinking.tsx`](../../surfsense_local/frontend/src/features/chat/reply-thinking.tsx)). The trace rides in the message's `metadata.custom`, beside the citations, not as a content part, so Copy takes the answer alone.
-- Sending is disabled without a usable model or while threads or messages load, and Stop aborts the request. A `409` "no chat model selected" opens model setup. An `error` frame attaches to its assistant turn: auth and not-found errors, and network errors from a remote endpoint, offer Model setup; a network error from the local runtime offers nothing, since no setting restarts it; the rest offer Retry, which resends the same text.
+- Sending is disabled without a usable model or while threads or messages load, and Stop aborts the request. A `409` "no chat model selected" opens model setup. An `error` frame attaches to its assistant turn: auth, not-found and model-cannot-run errors, and network errors from a remote endpoint, offer Model setup; a network error from the local runtime and a context-too-long error offer nothing, since no button fixes either; the rest offer Retry, which resends the same text.
 - Every turn sends the ids of the ready sources the user left included in the sources panel, so unticking a source takes it out of retrieval, and unticking all of them leaves the model with no context.
 
 ## Citation panel
@@ -128,7 +128,6 @@ The list handed to the generator is `[system, *history within budget, user]`.
 
 - A stream that ends without an error but yields no text still renames the thread and stores an empty assistant turn; the discard guard is `failed and not parts`.
 - `budget.py` prices the question at 1,024 tokens and says `MessageText` enforces that, but `MessageText` has no length limit, so a long question can push a turn past the model's window.
-- `model_cannot_run` and `context_too_long` offer Retry in `chat-error-notice.tsx`, which cannot fix either.
 - No live region announces streamed text, and focus does not move to the conversation heading after a thread switch; the dashboard design asks for both.
 - No test covers a client disconnecting mid-reply. The assistant's text is written only when generation ends, inside the stream, so whether a disconnected reply is kept is unverified.
 - With no hits, the system message is the instructions alone, which still ask for `[n]` labels. In the chat eval, Qwen3 1.7B wrote a `[1]` in all three such answers, which chat drops, and one of them never said the sources did not cover the question.
```

**File**: `surfsense_local/frontend/src/features/chat/chat-error-notice.tsx` (modified, +5/-0)
```diff
@@ -12,11 +12,16 @@ function actionFor(error: ChatTurnError): Action {
   switch (error.kind) {
     case "provider_auth":
     case "provider_not_found":
+    case "model_cannot_run":
       return "model-setup"
     case "network":
       // A bad base URL is a Model setup fix; a local runtime that isn't
       // running isn't — there's no settings action that starts it.
       return error.provider === "llamacpp" ? "none" : "model-setup"
+    case "context_too_long":
+      // The notice text already says to start a new chat or pick a model
+      // with a larger window — Retry would resend the same overlong turn.
+      return "none"
     default:
       return "retry"
   }
```

**File**: `surfsense_local/frontend/src/features/dashboard/dashboard-page.test.tsx` (modified, +79/-0)
```diff
@@ -891,6 +891,85 @@ describe("dashboard chat", () => {
     expect(screen.queryByRole("button", { name: "Model setup" })).toBeNull()
   })
 
+  it("offers no Retry for a context-too-long failure it cannot fix", async () => {
+    const fetchMock = vi.fn(
+      async (input: RequestInfo | URL, init?: RequestInit) => {
+        const path = String(input)
+        if (path === "/llm/providers") {
+          return Response.json([
+            { name: "llamacpp", healthy: true, can_download: true },
+          ])
+        }
+        if (
+          path === "/workspaces/1/documents?document_type=FILE&document_type=NOTE"
+        ) {
+          return Response.json([])
+        }
+        if (path === "/workspaces/1/chat/threads" && !init?.method) {
+          return Response.json([])
+        }
+        if (path === "/workspaces/1/chat/threads" && init?.method === "POST") {
+          return Response.json(
+            {
+              id: 10,
+              workspace_id: 1,
+              title: "Too long",
+              created_at: "2026-09-05T00:00:00Z",
+              updated_at: "2026-09-05T00:00:00Z",
+            },
+            { status: 201 }
+          )
+        }
+        if (path === "/chat/threads/10/messages" && init?.method === "POST") {
+          return new Response(
+            'data: {"type":"accepted","user_message_id":100,"assistant_message_id":101,"user_created_at":"2026-09-05T00:00:00Z"}\n\ndata: {"type":"error","kind":"context_too_long","message":"context window exceeded","provider":"llamacpp"}\n\ndata: [DONE]\n\n',
+            { headers: { "Content-Type": "text/event-stream" } }
+          )
+        }
+        if (path === "/chat/threads/10/messages") {
+          return Response.json([])
+        }
+        return Response.json({ detail: "not found" }, { status: 404 })
+      }
+    )
+    vi.stubGlobal("fetch", fetchMock)
+    const user = userEvent.setup()
+
+    render(
+      <TooltipProvider>
+        <DashboardPage
+          initialProviderAvailable={true}
+          selection={{
+            model_type: "text_gen",
+            provider: "llamacpp",
+            connection_id: null,
+            name: "llama3.2:1b",
+            updated_at: "2026-09-05T00:00:00Z",
+          }}
+          initialWorkspaces={[workspace]}
+          onModelSelected={vi.fn()}
+        />
+      </TooltipProvider>
+    )
+
+    await screen.findByRole("textbox", { name: "Message" })
+    await user.type(
+      screen.getByRole("textbox", { name: "Message" }),
+      "Too long"
+    )
+    await user.click(screen.getByRole("button", { name: "Send message" }))
+
+    expect(
+      await screen.findByText(
+        "This conversation is too long for the model’s context window. Start a new chat or pick a model with a larger window."
+      )
+    ).toBeTruthy()
+    // Retry resends the identical message to the identical model and fails
+    // identically — it cannot fix an oversized context window.
+    const retryButton = screen.queryByRole("button", { name: "Retry" })
+    expect(retryButton, "context_too_long must not offer Retry").toBeNull()
+  })
+
   it("aborts the active stream when stop is pressed", async () => {
     const captured: { signal: AbortSignal | null } = { signal: null }
     const fetchMock = vi.fn(
```

---

### Incident Patch 2: `69b792c0` (2026-09-26)
**Commit Message**: Merge pull request #1931 from AnishSarkar22/fix/remote-manifest-utf8-windows

fix(local): read the model manifests as UTF-8 on Windows

**File**: `surfsense_local/backend/modules/llm/catalog/local/manifest/loader.py` (modified, +3/-1)
```diff
@@ -8,7 +8,9 @@
 
 
 def load_local_manifest(path: Path | None = None) -> LocalManifest:
-    return LocalManifest.model_validate_json((path or MANIFEST_PATH).read_text())
+    return LocalManifest.model_validate_json(
+        (path or MANIFEST_PATH).read_text(encoding="utf-8")
+    )
 
 
 def empty_manifest() -> LocalManifest:
```

**File**: `surfsense_local/backend/modules/llm/catalog/remote/manifest/loader.py` (modified, +3/-1)
```diff
@@ -14,7 +14,9 @@
 
 
 def load_remote_manifest(path: Path | None = None) -> RemoteManifest:
-    return RemoteManifest.model_validate_json((path or MANIFEST).read_text())
+    return RemoteManifest.model_validate_json(
+        (path or MANIFEST).read_text(encoding="utf-8")
+    )
 
 
 @lru_cache
```

**File**: `surfsense_local/backend/tests/unit/llm/catalog/remote/test_shipped_manifest.py` (modified, +28/-0)
```diff
@@ -1,5 +1,8 @@
 """The committed manifest is the one every remote label comes from."""
 
+import subprocess
+import sys
+
 import pytest
 
 from modules.llm.catalog.remote.manifest.loader import (
@@ -19,6 +22,31 @@ def test_the_shipped_manifest_loads() -> None:
     assert "openrouter" in manifest.providers
 
 
+def test_the_shipped_manifest_loads_without_the_system_encoding() -> None:
+    """Windows reads cp1252 by default, and the manifest's UTF-8 left it empty."""
+    load = (
+        "from modules.llm.catalog.remote.manifest.loader import load_remote_manifest;"
+        "load_remote_manifest()"
+    )
+    run = subprocess.run(
+        [
+            sys.executable,
+            "-X",
+            "warn_default_encoding",
+            "-W",
+            "error::EncodingWarning",
+            "-c",
+            load,
+        ],
+        capture_output=True,
+        text=True,
+        encoding="utf-8",
+        check=False,
+    )
+
+    assert run.returncode == 0, run.stderr
+
+
 def test_the_shipped_manifest_knows_an_embedder_is_not_a_chat_model() -> None:
     """The old snapshot labelled text-embedding-3-small a chat model."""
     found = remote_lookup().classify("text-embedding-3-small", provider="openai")
```

---

### Incident Patch 3: `e1c50d53` (2026-09-26)
**Commit Message**: Merge pull request #1928 from CREDO23/fix/local-dist-toolchain

[Local|Packaging] Fail pnpm dist on a missing toolchain, with the install command

**File**: `.github/workflows/build-audiocpp.yml` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ on:
   pull_request:
     paths:
       - surfsense_local/electron/scripts/audiocpp/**
+      - surfsense_local/electron/scripts/not-staged/**
       - surfsense_local/electron/scripts/msvc-runtime.mjs
       - surfsense_local/electron/scripts/pinned-download.mjs
       - surfsense_local/backend/modules/llm/providers/audiocpp/**
```

**File**: `.github/workflows/build-sdcpp.yml` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ on:
   pull_request:
     paths:
       - surfsense_local/electron/scripts/sdcpp/**
+      - surfsense_local/electron/scripts/not-staged/**
       - .github/workflows/build-sdcpp.yml
 
 permissions:
```

**File**: `docs/architecture/packaging.md` (modified, +5/-5)
```diff
@@ -64,19 +64,19 @@ The release workflow runs the three scripts directly. Without the parser pack, D
 - `scripts/sdcpp/stage.mjs`, which `build:sdcpp` runs, stages stable-diffusion.cpp's `sd-server` into `electron/sdcpp/` with the libraries it loads from beside itself and its licences, leaving `sd-cli` behind. It runs `sd-server --help` from the staged folder before it swaps the folder into place.
   - Windows downloads upstream's Vulkan archive, checked against its pinned SHA-256, and copies the MSVC and OpenMP runtimes beside it, which the archive needs and does not carry.
   - Linux and macOS compile the pinned commit, because upstream's Linux archives need glibc 2.38 and its macOS archive needs macOS 26.0. The recipe, `scripts/sdcpp/recipe.mjs`, builds Vulkan on Linux, with one ggml library per micro-architecture, and Metal on macOS, for 13.3.
-  - Compiling needs CMake, a C++ compiler and the Vulkan SDK (`glslc` and headers) on Linux, or Xcode's command line tools on macOS; Windows needs Visual Studio 2022 or newer with the C++ tools, for the runtime it ships. Without them the script stages an empty folder and says why, and the app runs without local images. Release CI passes `--strict`, which fails instead.
+  - Compiling needs CMake, a C++ compiler and the Vulkan SDK (`glslc` and headers) on Linux, or Xcode's command line tools on macOS; Windows needs Visual Studio 2022 or newer with the C++ tools, for the runtime it ships. Without them the script stages an empty folder and says why, and the app runs without local images. Release CI and `pnpm dist` pass `--strict`, which fails instead, naming everything missing and the command that installs it with the machine's package manager.
 - `scripts/audiocpp/stage.mjs`, which `build:audiocpp` runs, stages audio.cpp's `audiocpp_server` into `electron/audiocpp/` with the model specs of the three curated families. It adds eSpeak-ng 1.52.0 from the pinned `espeakng-loader` wheel, which Kokoro and Kitten phonemise through (Kokoro finds it through the server's environment, Kitten through `server.json`, [`local-models/catalog.md`](local-models/catalog.md)), and eSpeak-ng's GPL licence text, which the wheel does not carry. It runs `--list-devices` from the staged folder before it swaps the folder into place.
   - macOS downloads upstream's archive, checked against its pinned SHA-256.
   - Windows and Linux compile the pinned commit, because upstream's Linux archives need glibc 2.38 and its Windows archive compiles AVX-512 into the executable. The recipe, `scripts/audiocpp/recipe.mjs`, builds only the CPU backend, since the server runs with `--backend cpu`, with one ggml library per micro-architecture and only the curated model families.
-  - Compiling needs CMake and GCC 13 or newer on Linux, or Visual Studio 2022 or newer with the C++ tools on Windows. Without them the script stages an empty folder and says why, and the app runs without local audio. Release CI passes `--strict`, which fails instead.
+  - Compiling needs CMake and GCC 13 or newer on Linux, or Visual Studio 2022 or newer with the C++ tools on Windows. Without them the script stages an empty folder and says why, and the app runs without local audio. Release CI and `pnpm dist` pass `--strict`, which fails instead, naming everything missing and the command that installs it with the machine's package manager.
 
-`pnpm dist` in `electron/` runs every staging step, every native runtime included, before `electron-builder`.
+`pnpm dist` in `electron/` runs every staging step before `electron-builder`, the native runtimes first, so a missing toolchain stops it before the frontend and the Python binaries are built. It stages sd.cpp and audio.cpp with `--strict`, so an installer never ships without them; `predev` does not, so dev runs without a toolchain.
 
 `frontend/` and `electron/` each pin their pnpm in `packageManager` (`pnpm@11.27.1`), which pnpm switches to locally and the desktop workflows read through `package_json_file`.
```

**File**: `surfsense_local/electron/package.json` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
     "build:llamacpp": "node scripts/fetch-llamacpp.mjs",
     "build:sdcpp": "node scripts/sdcpp/stage.mjs",
     "build:audiocpp": "node scripts/audiocpp/stage.mjs",
-    "dist": "pnpm build:frontend && pnpm build:binaries && pnpm build:model && pnpm build:voice && pnpm build:parser && pnpm build:llamacpp && pnpm build:sdcpp && pnpm build:audiocpp && pnpm build && electron-builder",
+    "dist": "pnpm build:llamacpp && pnpm build:sdcpp --strict && pnpm build:audiocpp --strict && pnpm build:frontend && pnpm build:binaries && pnpm build:model && pnpm build:voice && pnpm build:parser && pnpm build && electron-builder",
     "test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/main/*.test.ts src/main/**/*.test.ts scripts/**/*.test.mjs",
     "typecheck": "tsc --noEmit -p tsconfig.json",
     "check:sidecars": "node scripts/check-sidecars.mjs"
```

**File**: `surfsense_local/electron/scripts/audiocpp/compile.mjs` (modified, +10/-6)
```diff
@@ -10,6 +10,7 @@ import { availableParallelism } from "node:os"
 import { join } from "node:path"
 
 import { visualStudio } from "../msvc-runtime.mjs"
+import { CMAKE, GCC_13, VISUAL_STUDIO } from "../not-staged/tools.mjs"
 import { COMMIT, SOURCE, TAG } from "./pins.mjs"
 import { configureArgs } from "./recipe.mjs"
 
@@ -21,17 +22,20 @@ function output(cmd, args) {
   }
 }
 
-/** What this machine lacks to compile it, or null. audio.cpp requires GCC 13. */
+/** Everything this machine lacks to compile it, empty if nothing. audio.cpp requires GCC 13. */
 export function missingToolchain() {
-  if (output("cmake", ["--version"]) == null) return "CMake"
+  const missing = []
+  if (output("cmake", ["--version"]) == null) missing.push(CMAKE)
   if (process.platform === "win32") {
-    return visualStudio() ? null : "Visual Studio 2022 or newer with the C++ tools"
+    if (!visualStudio()) missing.push(VISUAL_STUDIO)
+    return missing
   }
   const cxx = process.env.CXX ?? "g++"
   const version = output(cxx, ["-dumpversion"])
-  if (version == null) return "GCC 13 or newer"
-  if (Number(version.split(".")[0]) < 13) return `GCC 13 or newer (${cxx} is ${version})`
-  return null
+  if (version == null) missing.push(GCC_13)
+  // No package fixes an old one: the distribution's g++ is already installed.
+  else if (Number(version.split(".")[0]) < 13) missing.push({ name: `${GCC_13.name} (${cxx} is ${version})` })
+  return missing
 }
 
 /** Build the server in `work`; returns where its files and its source are. */
```

---

### Incident Patch 4: `7e637d8f` (2026-09-26)
**Commit Message**: fix(local): read the model manifests as UTF-8 on Windows

Windows reads text as cp1252 by default, which fails on the remote manifest's UTF-8. The loader treated that as a missing manifest and served an empty one, so Connect a server listed no providers. The local manifest loader gets the same encoding before it gains a non-ASCII character.

**File**: `surfsense_local/backend/modules/llm/catalog/local/manifest/loader.py` (modified, +3/-1)
```diff
@@ -8,7 +8,9 @@
 
 
 def load_local_manifest(path: Path | None = None) -> LocalManifest:
-    return LocalManifest.model_validate_json((path or MANIFEST_PATH).read_text())
+    return LocalManifest.model_validate_json(
+        (path or MANIFEST_PATH).read_text(encoding="utf-8")
+    )
 
 
 def empty_manifest() -> LocalManifest:
```

**File**: `surfsense_local/backend/modules/llm/catalog/remote/manifest/loader.py` (modified, +3/-1)
```diff
@@ -14,7 +14,9 @@
 
 
 def load_remote_manifest(path: Path | None = None) -> RemoteManifest:
-    return RemoteManifest.model_validate_json((path or MANIFEST).read_text())
+    return RemoteManifest.model_validate_json(
+        (path or MANIFEST).read_text(encoding="utf-8")
+    )
 
 
 @lru_cache
```

**File**: `surfsense_local/backend/tests/unit/llm/catalog/remote/test_shipped_manifest.py` (modified, +28/-0)
```diff
@@ -1,5 +1,8 @@
 """The committed manifest is the one every remote label comes from."""
 
+import subprocess
+import sys
+
 import pytest
 
 from modules.llm.catalog.remote.manifest.loader import (
@@ -19,6 +22,31 @@ def test_the_shipped_manifest_loads() -> None:
     assert "openrouter" in manifest.providers
 
 
+def test_the_shipped_manifest_loads_without_the_system_encoding() -> None:
+    """Windows reads cp1252 by default, and the manifest's UTF-8 left it empty."""
+    load = (
+        "from modules.llm.catalog.remote.manifest.loader import load_remote_manifest;"
+        "load_remote_manifest()"
+    )
+    run = subprocess.run(
+        [
+            sys.executable,
+            "-X",
+            "warn_default_encoding",
+            "-W",
+            "error::EncodingWarning",
+            "-c",
+            load,
+        ],
+        capture_output=True,
+        text=True,
+        encoding="utf-8",
+        check=False,
+    )
+
+    assert run.returncode == 0, run.stderr
+
+
 def test_the_shipped_manifest_knows_an_embedder_is_not_a_chat_model() -> None:
     """The old snapshot labelled text-embedding-3-small a chat model."""
     found = remote_lookup().classify("text-embedding-3-small", provider="openai")
```

---

### Incident Patch 5: `6986759b` (2026-09-26)
**Commit Message**: fix(local): match the image editing step's copy to the other steps

**File**: `surfsense_local/frontend/src/features/onboarding/model-step/model-step.tsx` (modified, +9/-6)
```diff
@@ -106,12 +106,15 @@ const COPY: Record<
         id: "onboarding_image_edit_step_title",
         defaultMessage: "Choose an image editing model",
       }),
-    description: () =>
-      intl.formatMessage({
-        id: "onboarding_image_edit_step_body",
-        defaultMessage:
-          "Edits images. An image model that edits too needs nothing more to download.",
-      }),
+    description: (servers) =>
+      intl.formatMessage(
+        {
+          id: "onboarding_image_edit_step_body",
+          defaultMessage:
+            "Edits images for you. {servers, select, yes {Run one on this computer, or use one from a server.} other {Run one on this computer.}}",
+        },
+        { servers: servers ? "yes" : "no" }
+      ),
     noLocal: (servers) =>
       intl.formatMessage(
         {
```

**File**: `surfsense_local/frontend/translations/de.json` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@
   "onboarding_finish_no_chat_model_error": "Wähle zuerst ein Chatmodell",
   "onboarding_hugging_face_search_hide_button": "Hugging-Face-Suche ausblenden",
   "onboarding_hugging_face_search_show_button": "Nicht dabei? Auf Hugging Face suchen",
-  "onboarding_image_edit_step_body": "Bearbeitet Bilder. Ein Bildmodell, das auch bearbeitet, braucht keinen weiteren Download.",
+  "onboarding_image_edit_step_body": "Bearbeitet Bilder für dich. {servers, select, yes {Führe eines auf diesem Computer aus oder nutze eines von einem Server.} other {Führe eines auf diesem Computer aus.}}",
   "onboarding_image_edit_step_no_local_empty": "Bildbearbeitungsmodelle können auf diesem Computer nicht laufen.{servers, select, yes { Nutze stattdessen einen Server.} other {}}",
   "onboarding_image_edit_step_title": "Modell für Bildbearbeitung wählen",
   "onboarding_image_step_body": "Erstellt Bilder für dich. {servers, select, yes {Führe eines auf diesem Computer aus oder nutze eines von einem Server.} other {Führe eines auf diesem Computer aus.}}",
```

**File**: `surfsense_local/frontend/translations/en.json` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@
   "onboarding_finish_no_chat_model_error": "Choose a chat model first",
   "onboarding_hugging_face_search_hide_button": "Hide Hugging Face search",
   "onboarding_hugging_face_search_show_button": "Not listed? Search Hugging Face",
-  "onboarding_image_edit_step_body": "Edits images. An image model that edits too needs nothing more to download.",
+  "onboarding_image_edit_step_body": "Edits images for you. {servers, select, yes {Run one on this computer, or use one from a server.} other {Run one on this computer.}}",
   "onboarding_image_edit_step_no_local_empty": "Image editing models cannot run on this computer.{servers, select, yes { Use a server instead.} other {}}",
   "onboarding_image_edit_step_title": "Choose an image editing model",
   "onboarding_image_step_body": "Creates images for you. {servers, select, yes {Run one on this computer, or use one from a server.} other {Run one on this computer.}}",
```

**File**: `surfsense_local/frontend/translations/es.json` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@
   "onboarding_finish_no_chat_model_error": "Elige primero un modelo de chat",
   "onboarding_hugging_face_search_hide_button": "Ocultar la búsqueda en Hugging Face",
   "onboarding_hugging_face_search_show_button": "¿No está en la lista? Busca en Hugging Face",
-  "onboarding_image_edit_step_body": "Edita imágenes. Un modelo de imagen que también edita no necesita descargar nada más.",
+  "onboarding_image_edit_step_body": "Edita imágenes para ti. {servers, select, yes {Ejecuta uno en este equipo o usa uno de un servidor.} other {Ejecuta uno en este equipo.}}",
   "onboarding_image_edit_step_no_local_empty": "Los modelos de edición de imágenes no pueden ejecutarse en este equipo.{servers, select, yes { Usa un servidor en su lugar.} other {}}",
   "onboarding_image_edit_step_title": "Elige un modelo de edición de imágenes",
   "onboarding_image_step_body": "Crea imágenes para ti. {servers, select, yes {Ejecuta uno en este equipo o usa uno de un servidor.} other {Ejecuta uno en este equipo.}}",
```

**File**: `surfsense_local/frontend/translations/fr.json` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@
   "onboarding_finish_no_chat_model_error": "Choisissez d’abord un modèle de chat",
   "onboarding_hugging_face_search_hide_button": "Masquer la recherche Hugging Face",
   "onboarding_hugging_face_search_show_button": "Absent de la liste ? Rechercher sur Hugging Face",
-  "onboarding_image_edit_step_body": "Modifie vos images. Un modèle d’image qui sait aussi les modifier ne nécessite aucun autre téléchargement.",
+  "onboarding_image_edit_step_body": "Modifie vos images. {servers, select, yes {Exécutez-en un sur cet ordinateur ou utilisez-en un depuis un serveur.} other {Exécutez-en un sur cet ordinateur.}}",
   "onboarding_image_edit_step_no_local_empty": "Les modèles de modification d’images ne peuvent pas fonctionner sur cet ordinateur.{servers, select, yes { Utilisez plutôt un serveur.} other {}}",
   "onboarding_image_edit_step_title": "Choisissez un modèle de modification d’images",
   "onboarding_image_step_body": "Crée vos images. {servers, select, yes {Exécutez-en un sur cet ordinateur ou utilisez-en un depuis un serveur.} other {Exécutez-en un sur cet ordinateur.}}",
```

---

### Incident Patch 6: `a0a4d514` (2026-09-26)
**Commit Message**: fix(local): keep dialog content through the exit animation

Closing a dialog cleared the data it showed in the same update, so its text went blank before the fade-out. Dialogs that the parent unmounted on close vanished with no fade at all.

- DialogContent and AlertDialogContent keep their last open children until Base UI unmounts the popup.
- Rename workspace/chat, create workspace, try model, license form and the egress prompt stay mounted on their last value, keyed by useDialogPayload's opening count so each opening starts fresh.
- ConnectionDialog no longer drops its form the moment it starts closing.
- Rename chat and the unlisted-model confirm render inside their parent dialog, so Base UI nests them and the parent steps back.
- Refused requests go to the innermost egress prompt, like askEgress, and ConnectionDialog hosts one, so consent for a new server's host opens as that dialog's nested dialog.

**File**: `.agents/skills/frontend-workflow/base-ui.md` (modified, +6/-0)
```diff
@@ -33,6 +33,12 @@ These are the rules that compile fine and still break. Check
 - `AlertDialogAction` closes the dialog unless its click handler calls
   `event.preventDefault()`. The local wrapper keeps this Radix contract on
   purpose; the stock base-nova Action does not close at all.
+- A controlled `DialogContent` / `AlertDialogContent` keeps its last open
+  children through the exit animation, so `open={target !== null}` with
+  content read from `target` is safe. Never unmount a dialog on close
+  (`{target ? <Dialog open/> : null}`): keep it mounted with
+  `useDialogPayload` from `components/ui/use-dialog-payload`, keyed by its
+  `opening` so its form resets when it opens.
 - A nested dialog renders no backdrop. The parent dims and shrinks through
   `data-nested-dialog-open` and `--nested-dialogs`, already in the wrappers.
 - A popup inside a modal dialog (the combobox, through `container`) portals
```

**File**: `docs/architecture/egress.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ Studio resolves its model in the worker, where no dialog can reach the user, so
 - **Updates**, because their call is not the backend's to refuse: Check now asks while `automatic` is off, and Allow turns it on.
 - **Model search**, because the answer is wanted before the request: focusing the search box asks while `host:huggingface.co` is off, once per visit to the screen, so a refused search is not the first news that search is off. After Cancel, search says it needs `huggingface.co`, while curated and installed models keep working.
 
-While Settings is open, a second prompt inside it answers `askEgress()`, so the question opens as Settings' nested dialog and Settings steps back behind it. Refused requests still go to the app's prompt.
+Refused requests and `askEgress()` go to the innermost mounted prompt. Settings and the connection dialog each render one inside themselves, so while either is open the question opens as its nested dialog and it steps back behind it; otherwise the app's prompt answers.
 
 Settings › Network lists the App updates row and every destination with its host and last call. Unticking one refuses the next call outright.
 
```

**File**: `surfsense_local/frontend/src/components/ui/alert-dialog.tsx` (modified, +14/-2)
```diff
@@ -5,9 +5,17 @@ import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog
 import { cn } from "@/lib/utils"
 
 import { Button } from "@/components/ui/button"
+import {
+  DialogOpenScope,
+  useContentThroughExit,
+} from "@/components/ui/dialog-exit-content"
 
 function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
-  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
+  return (
+    <DialogOpenScope open={props.open}>
+      <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
+    </DialogOpenScope>
+  )
 }
 
 function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
@@ -41,10 +49,12 @@ function AlertDialogOverlay({
 function AlertDialogContent({
   className,
   size = "default",
+  children,
   ...props
 }: AlertDialogPrimitive.Popup.Props & {
   size?: "default" | "sm"
 }) {
+  const content = useContentThroughExit(children)
   return (
     <AlertDialogPortal>
       <AlertDialogOverlay />
@@ -58,7 +68,9 @@ function AlertDialogContent({
           className
         )}
         {...props}
-      />
+      >
+        {content}
+      </AlertDialogPrimitive.Popup>
     </AlertDialogPortal>
   )
 }
```

**File**: `surfsense_local/frontend/src/components/ui/dialog-exit-content.test.tsx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import type { ReactElement } from "react"
+import { afterEach, describe, expect, it } from "vitest"
+import { cleanup, render, screen } from "@testing-library/react"
+
+import {
+  AlertDialog,
+  AlertDialogContent,
+  AlertDialogTitle,
+} from "./alert-dialog"
+import { Dialog, DialogContent, DialogTitle } from "./dialog"
+
+// Callers clear what a dialog shows in the same update that closes it.
+const modals: [string, (target: string | null) => ReactElement][] = [
+  [
+    "dialog",
+    (target) => (
+      <Dialog open={target !== null}>
+        <DialogContent>
+          <DialogTitle>{target ? `Delete ${target}?` : "Delete?"}</DialogTitle>
+        </DialogContent>
+      </Dialog>
+    ),
+  ],
+  [
+    "alert dialog",
+    (target) => (
+      <AlertDialog open={target !== null}>
+        <AlertDialogContent>
+          <AlertDialogTitle>
+            {target ? `Delete ${target}?` : "Delete?"}
+          </AlertDialogTitle>
+        </AlertDialogContent>
+      </AlertDialog>
+    ),
+  ],
+]
+
+afterEach(cleanup)
+
+describe.each(modals)("%s closing", (_, modal) => {
+  it("keeps showing what it showed while open", () => {
+    const { rerender } = render(modal("Report.pdf"))
+
+    rerender(modal(null))
+
+    expect(screen.getByText("Delete Report.pdf?")).toBeTruthy()
+    expect(screen.queryByText("Delete?")).toBeNull()
+  })
+
+  it("shows fresh content when reopened", () => {
+    const { rerender } = render(modal("Report.pdf"))
+    rerender(modal(null))
+
+    rerender(modal("Notes.md"))
+
+    expect(screen.getByText("Delete Notes.md?")).toBeTruthy()
+  })
+})
```

**File**: `surfsense_local/frontend/src/components/ui/dialog-exit-content.tsx` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import { createContext, use, useState, type ReactNode } from "react"
+
+// Undefined for an uncontrolled dialog, whose content never changes on close.
+const DialogOpenContext = createContext<boolean | undefined>(undefined)
+
+export function DialogOpenScope({
+  open,
+  children,
+}: {
+  open: boolean | undefined
+  children: ReactNode
+}) {
+  return <DialogOpenContext value={open}>{children}</DialogOpenContext>
+}
+
+// Callers clear a dialog's data in the same update that closes it; the popup
+// keeps what it showed while open until its exit animation unmounts it.
+export function useContentThroughExit(children: ReactNode) {
+  const open = use(DialogOpenContext)
+  const [shown, setShown] = useState(children)
+  if (open !== false && children !== shown) setShown(children)
+  return open === false ? shown : children
+}
```

---

### Incident Patch 7: `910e147f` (2026-09-26)
**Commit Message**: fix(local): fail pnpm dist on a missing toolchain and show the install command

pnpm dist staged audio.cpp and sd.cpp leniently, so a machine without
CMake or GCC 13 built an installer with no local audio and only a warning
in the scrollback. It now passes --strict, as release CI does, and stages
the native runtimes first so a missing tool stops it in about a second.

The failure names every missing tool at once and prints the command that
installs them with the machine's package manager, without a stack trace.
predev stays lenient.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `.github/workflows/build-audiocpp.yml` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ on:
   pull_request:
     paths:
       - surfsense_local/electron/scripts/audiocpp/**
+      - surfsense_local/electron/scripts/not-staged/**
       - surfsense_local/electron/scripts/msvc-runtime.mjs
       - surfsense_local/electron/scripts/pinned-download.mjs
       - surfsense_local/backend/modules/llm/providers/audiocpp/**
```

**File**: `.github/workflows/build-sdcpp.yml` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ on:
   pull_request:
     paths:
       - surfsense_local/electron/scripts/sdcpp/**
+      - surfsense_local/electron/scripts/not-staged/**
       - .github/workflows/build-sdcpp.yml
 
 permissions:
```

**File**: `docs/architecture/packaging.md` (modified, +5/-5)
```diff
@@ -64,19 +64,19 @@ The release workflow runs the three scripts directly. Without the parser pack, D
 - `scripts/sdcpp/stage.mjs`, which `build:sdcpp` runs, stages stable-diffusion.cpp's `sd-server` into `electron/sdcpp/` with the libraries it loads from beside itself and its licences, leaving `sd-cli` behind. It runs `sd-server --help` from the staged folder before it swaps the folder into place.
   - Windows downloads upstream's Vulkan archive, checked against its pinned SHA-256, and copies the MSVC and OpenMP runtimes beside it, which the archive needs and does not carry.
   - Linux and macOS compile the pinned commit, because upstream's Linux archives need glibc 2.38 and its macOS archive needs macOS 26.0. The recipe, `scripts/sdcpp/recipe.mjs`, builds Vulkan on Linux, with one ggml library per micro-architecture, and Metal on macOS, for 13.3.
-  - Compiling needs CMake, a C++ compiler and the Vulkan SDK (`glslc` and headers) on Linux, or Xcode's command line tools on macOS; Windows needs Visual Studio 2022 or newer with the C++ tools, for the runtime it ships. Without them the script stages an empty folder and says why, and the app runs without local images. Release CI passes `--strict`, which fails instead.
+  - Compiling needs CMake, a C++ compiler and the Vulkan SDK (`glslc` and headers) on Linux, or Xcode's command line tools on macOS; Windows needs Visual Studio 2022 or newer with the C++ tools, for the runtime it ships. Without them the script stages an empty folder and says why, and the app runs without local images. Release CI and `pnpm dist` pass `--strict`, which fails instead, naming everything missing and the command that installs it with the machine's package manager.
 - `scripts/audiocpp/stage.mjs`, which `build:audiocpp` runs, stages audio.cpp's `audiocpp_server` into `electron/audiocpp/` with the model specs of the three curated families. It adds eSpeak-ng 1.52.0 from the pinned `espeakng-loader` wheel, which Kokoro and Kitten phonemise through (Kokoro finds it through the server's environment, Kitten through `server.json`, [`local-models/catalog.md`](local-models/catalog.md)), and eSpeak-ng's GPL licence text, which the wheel does not carry. It runs `--list-devices` from the staged folder before it swaps the folder into place.
   - macOS downloads upstream's archive, checked against its pinned SHA-256.
   - Windows and Linux compile the pinned commit, because upstream's Linux archives need glibc 2.38 and its Windows archive compiles AVX-512 into the executable. The recipe, `scripts/audiocpp/recipe.mjs`, builds only the CPU backend, since the server runs with `--backend cpu`, with one ggml library per micro-architecture and only the curated model families.
-  - Compiling needs CMake and GCC 13 or newer on Linux, or Visual Studio 2022 or newer with the C++ tools on Windows. Without them the script stages an empty folder and says why, and the app runs without local audio. Release CI passes `--strict`, which fails instead.
+  - Compiling needs CMake and GCC 13 or newer on Linux, or Visual Studio 2022 or newer with the C++ tools on Windows. Without them the script stages an empty folder and says why, and the app runs without local audio. Release CI and `pnpm dist` pass `--strict`, which fails instead, naming everything missing and the command that installs it with the machine's package manager.
 
-`pnpm dist` in `electron/` runs every staging step, every native runtime included, before `electron-builder`.
+`pnpm dist` in `electron/` runs every staging step before `electron-builder`, the native runtimes first, so a missing toolchain stops it before the frontend and the Python binaries are built. It stages sd.cpp and audio.cpp with `--strict`, so an installer never ships without them; `predev` does not, so dev runs without a toolchain.
 
 `frontend/` and `electron/` each pin their pnpm in `packageManager` (`pnpm@11.27.1`), which pnpm switches to locally and the desktop workflows read through `package_json_file`.
```

**File**: `surfsense_local/electron/package.json` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
     "build:llamacpp": "node scripts/fetch-llamacpp.mjs",
     "build:sdcpp": "node scripts/sdcpp/stage.mjs",
     "build:audiocpp": "node scripts/audiocpp/stage.mjs",
-    "dist": "pnpm build:frontend && pnpm build:binaries && pnpm build:model && pnpm build:voice && pnpm build:parser && pnpm build:llamacpp && pnpm build:sdcpp && pnpm build:audiocpp && pnpm build && electron-builder",
+    "dist": "pnpm build:llamacpp && pnpm build:sdcpp --strict && pnpm build:audiocpp --strict && pnpm build:frontend && pnpm build:binaries && pnpm build:model && pnpm build:voice && pnpm build:parser && pnpm build && electron-builder",
     "test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/main/*.test.ts src/main/**/*.test.ts scripts/**/*.test.mjs",
     "typecheck": "tsc --noEmit -p tsconfig.json",
     "check:sidecars": "node scripts/check-sidecars.mjs"
```

**File**: `surfsense_local/electron/scripts/audiocpp/compile.mjs` (modified, +10/-6)
```diff
@@ -10,6 +10,7 @@ import { availableParallelism } from "node:os"
 import { join } from "node:path"
 
 import { visualStudio } from "../msvc-runtime.mjs"
+import { CMAKE, GCC_13, VISUAL_STUDIO } from "../not-staged/tools.mjs"
 import { COMMIT, SOURCE, TAG } from "./pins.mjs"
 import { configureArgs } from "./recipe.mjs"
 
@@ -21,17 +22,20 @@ function output(cmd, args) {
   }
 }
 
-/** What this machine lacks to compile it, or null. audio.cpp requires GCC 13. */
+/** Everything this machine lacks to compile it, empty if nothing. audio.cpp requires GCC 13. */
 export function missingToolchain() {
-  if (output("cmake", ["--version"]) == null) return "CMake"
+  const missing = []
+  if (output("cmake", ["--version"]) == null) missing.push(CMAKE)
   if (process.platform === "win32") {
-    return visualStudio() ? null : "Visual Studio 2022 or newer with the C++ tools"
+    if (!visualStudio()) missing.push(VISUAL_STUDIO)
+    return missing
   }
   const cxx = process.env.CXX ?? "g++"
   const version = output(cxx, ["-dumpversion"])
-  if (version == null) return "GCC 13 or newer"
-  if (Number(version.split(".")[0]) < 13) return `GCC 13 or newer (${cxx} is ${version})`
-  return null
+  if (version == null) missing.push(GCC_13)
+  // No package fixes an old one: the distribution's g++ is already installed.
+  else if (Number(version.split(".")[0]) < 13) missing.push({ name: `${GCC_13.name} (${cxx} is ${version})` })
+  return missing
 }
 
 /** Build the server in `work`; returns where its files and its source are. */
```

---

### Incident Patch 8: `6c02bce0` (2026-09-26)
**Commit Message**: fix(llm): handle prefix rejection in HeaderPrefixReader to ensure proper unmapping

Updated the HeaderPrefixReader's constructor to close memory mappings if the prefix is rejected, preventing potential permission errors on Windows. Added a test to verify that the memory mapping is closed before the caller attempts to unlink the file.

**File**: `surfsense_local/backend/modules/llm/gguf/header_prefix.py` (modified, +16/-1)
```diff
@@ -87,6 +87,21 @@ class HeaderPrefixReader(GGUFReader):
 
     header_tensors: tuple[HeaderTensor, ...]
 
+    def __init__(self, path: os.PathLike[str] | str) -> None:
+        """Map, and unmap again if the base constructor rejects the prefix.
+
+        The base class maps the file in its first statement and parses in the
+        rest, so a truncated prefix raises with the map still open and no
+        instance for the caller to close. Windows then refuses the unlink, and
+        that `PermissionError` replaces the `TruncatedHeaderError` a caller
+        widens on.
+        """
+        try:
+            super().__init__(path)
+        except BaseException:
+            self.close()
+            raise
+
     def _get(
         self,
         offset: int,
@@ -211,7 +226,7 @@ def close(self) -> None:
         Windows refuses to unlink a mapped file, and this runs once per searched
         model, so the map is closed explicitly rather than left to the collector.
         """
-        mapping = getattr(self.data, "_mmap", None)
+        mapping = getattr(getattr(self, "data", None), "_mmap", None)
         if mapping is not None:
             mapping.close()
 
```

**File**: `surfsense_local/backend/tests/unit/llm/gguf/test_header_prefix.py` (modified, +28/-0)
```diff
@@ -7,8 +7,10 @@
 
 from importlib.metadata import version
 
+import numpy as np
 import pytest
 
+from gguf import gguf_reader
 from modules.llm.gguf import HeaderTensor, TruncatedHeaderError, read_header_prefix
 from tests.unit.llm.gguf.build import STRING, UINT32, array, gguf, kv, tensor
 
@@ -90,6 +92,32 @@ def test_the_reader_leaves_no_temporary_file_behind(tmp_path, monkeypatch) -> No
     assert list(tmp_path.iterdir()) == []
 
 
+def test_a_rejected_prefix_unmaps_before_the_caller_unlinks(monkeypatch) -> None:
+    """The base constructor maps the file in its first statement and parses in the
+    rest, so a prefix it rejects leaves the map open with no instance to close it.
+
+    Asserted here rather than left to the platform: only Windows refuses to unlink
+    a mapped file, and CI is Linux, where the leak is invisible and the widening
+    retry in `source.py` keeps working. A long array is the cut, because its walk
+    is the one that holds a `memoryview` of the map when it raises.
+    """
+    maps: list[np.memmap] = []
+    real_memmap = gguf_reader.np.memmap
+
+    def recording(*args, **kwargs):
+        maps.append(real_memmap(*args, **kwargs))
+        return maps[-1]
+
+    monkeypatch.setattr(gguf_reader.np, "memmap", recording)
+    whole = gguf([kv("general.architecture", STRING, "qwen3"),
+                  array("tokenizer.ggml.tokens", STRING, [f"t{i}" for i in range(10_000)])])
+
+    with pytest.raises(TruncatedHeaderError):
+        read_header_prefix(whole[: len(whole) - 100])
+
+    assert [mapping._mmap.closed for mapping in maps] == [True]
+
+
 def test_a_vocabulary_is_counted_rather_than_decoded() -> None:
     """A vocabulary is 150k strings, and walking it element by element through
     the base class cost 3.4 s of a 3.5 s parse. Nothing reads the words, only how
```

---

### Incident Patch 9: `35df8d00` (2026-09-25)
**Commit Message**: Merge pull request #1925 from MODSetter/fix/local-image-and-podcast-generation

fix(local): make room for local image and podcast generation

**File**: `docs/architecture/local-models/runtime.md` (modified, +4/-1)
```diff
@@ -91,7 +91,10 @@ directory.
   measurement recorded a self-eviction after about 30 s without the flag; it did
   not reproduce on either backend and was withdrawn. The cost is that a local
   model, once loaded, stays resident while the app runs, even after the user
-  switches to a remote connection: nothing calls `RouterClient.unload()`.
+  switches to a remote connection. Only Studio calls `RouterClient.unload()`:
+  before a local image, which shares the graphics card, and before voicing a
+  podcast, which needs its memory ([`studio.md`](../studio.md)); the next
+  request reloads it.
   Someone who never loads a local model spends none of it, because the router
   holds no device memory until something loads.
 - `--models-autoload` is the upstream default, stated because the chat path
```

**File**: `docs/architecture/overview.md` (modified, +2/-2)
```diff
@@ -28,9 +28,9 @@ api, worker-studio ── HTTP ──> llama-server, sd-server, remote OpenAI-co
 worker-ingest, worker-studio ── POST /internal/events ──> api ── SSE /workspaces/{id}/events
 ```
 
-- Electron's main process starts four sidecars at boot and supervises them ([`index.ts`](../../surfsense_local/electron/src/main/index.ts), [`sidecars/`](../../surfsense_local/electron/src/main/sidecars/)): the API, one Huey worker per queue, and llama-server. Packaged builds run frozen binaries from the app's resources; `pnpm dev` runs `uv run main.py` and `uv run worker.py <queue>`.
+- Electron's main process starts four sidecars at boot and supervises them ([`index.ts`](../../surfsense_local/electron/src/main/index.ts), [`sidecars/`](../../surfsense_local/electron/src/main/sidecars/)): the API, one Huey worker per queue, and llama-server. Packaged builds run frozen binaries from the app's resources; `pnpm dev` runs `main.py` and `worker.py <queue>` on the backend's `.venv` interpreter, synced by `predev`'s own `uv run` scripts. Not through `uv run`: Windows kills Electron's children with it but not theirs, so after a Ctrl-C the last session's Studio worker, still reading the queue, took the next jobs.
 - llama-server starts whenever its pinned build is staged, in dev too (`pnpm build:llamacpp`, which `predev` runs). It reads per-model arguments from a preset file once at startup, so Electron restarts it when the API rewrites that file ([`local-models/runtime.md`](local-models/runtime.md)).
-- sd-server takes its model as startup arguments, so it cannot start at boot. Whenever its pinned build is staged, in dev too (`pnpm build:sdcpp`, which `predev` runs), `watchImageModel` asks the API every 5 seconds which files to run, and starts, restarts or stops it on a change. The API names a model only while a Studio job needs one and for 5 minutes after, so its weights are not held beside the chat model all session ([`studio.md`](studio.md#the-image-path)).
+- sd-server takes its model as startup arguments, so it cannot start at boot. Whenever its pinned build is staged, in dev too (`pnpm build:sdcpp`, which `predev` runs), `watchImageModel` asks the API every 5 seconds which files to run, and starts, restarts or stops it on a change. The API names a model only while a Studio job needs one and for up to 5 minutes after, so its weights are not held beside the chat model all session ([`studio.md`](studio.md#the-image-path)).
 - audiocpp_server refuses an empty model list, so it starts only once the API has written `audio/server.json` under the data directory, in dev too (`pnpm build:audiocpp`, which `predev` runs). On Windows and Linux that script compiles audio.cpp, and without a C++ toolchain the app runs without local audio ([packaging](packaging.md)). Electron checks that file every 5 seconds and restarts the server when it changes. Electron sets the machine-wide flags: the CPU backend, half the logical cores up to 8, one loaded model, and an unload after 5 idle minutes. The API writes that file whenever an audio model is installed or deleted, and at startup ([`local-models/catalog.md`](local-models/catalog.md)). The Studio worker voices podcasts there, at `SURFSENSE_LOCAL_AUDIO_BASE_URL`, and unloads the model when a podcast ends ([`studio.md`](studio.md)).
 - Only the API gates the window. Electron waits up to 60 seconds for `/health` and gives up at once if the API exits. llama-server is best-effort; its state shows through `/llm/providers`.
 - On macOS and Linux each child runs in its own process group. On quit Electron sends SIGTERM and, after 5 seconds, SIGKILL; on Windows it kills the process tree. A single-instance lock hands a second launch to the first window, because two sets of sidecars would fight over the SQLite file.
```

**File**: `docs/architecture/packaging.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ The asar holds only the Electron main and preload bundles. Everything else rides
 
 The app icon lives in `electron/build/icons/`: `packaged/` holds the `.icns`, `.ico` and `.png` that `electron-builder.yml` names per OS, and `dev/` a variant with a "DEV" badge, which `electron/src/main/dev-app-identity.ts` sets on the Dock, taskbar, window and About panel only while unpackaged, alongside the name "SurfSense Dev", because development runs inside Electron's own bundle and would otherwise show Electron's icon. The macOS menu bar name and the About panel icon stay Electron’s in development; only packaging changes them. Artwork on Windows and Linux fills its canvas; on macOS it sits at 824 of 1024 px with a transparent margin, Apple's icon grid, so `icon.icns` and `dev/icon-macos.png` carry that margin and the `.ico` and `.png` files do not.
 
-Packaged, Electron runs `resources/backend/api/api` and one `worker` process per queue, `ingest` and `studio`, and gives both `SURFSENSE_LOCAL_MODELS_DIR` pointing at `resources/models` and `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`). In development the same sidecars run through `uv run`.
+Packaged, Electron runs `resources/backend/api/api` and one `worker` process per queue, `ingest` and `studio`, and gives both `SURFSENSE_LOCAL_MODELS_DIR` pointing at `resources/models` and `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`). In development the same sidecars run on the backend's `.venv` interpreter ([`overview.md`](overview.md) says why not `uv run`).
 
 ## Freezing the backend
 
```

**File**: `docs/architecture/studio.md` (modified, +3/-3)
```diff
@@ -55,7 +55,7 @@ Eight formats follow it:
 - **flashcards**: JSON cards, at most 20, become a deck JSON file and a markdown body.
 - **quiz**: JSON questions, at most 10, each kept only with exactly four options and an answer among them, become a quiz JSON file and a markdown body.
 - **html**: a JSON title and sections, at most 10. Every value is HTML-escaped into a fixed template, so the page cannot carry a script.
-- **podcast**: the model outlines the episode from the brief, then drafts it segment by segment; the chosen audio model voices every line through audio.cpp's server, and the transcript is the body.
+- **podcast**: the model outlines the episode from the brief, then drafts it segment by segment, each reply capped at 12 tokens per word of the segment's target, and never under a planned 250-word segment's worth. Uncapped, Qwen3 1.7B looped on a 225-word segment until its 40,960-token window was full, and the JSON retry, which replays the failed reply, could not fit. The target is the outline's own guess: Qwen3 1.7B once gave a segment 20 words, wrote past them, and a 240-token cap ended both replies mid-JSON. The chosen audio model voices every line through audio.cpp's server, and the transcript is the body.
 - **image**: the model writes a title and an image prompt, and the image model paints the prompt.
 - **infographic**: the model writes a factual brief (a title, a summary and up to 8 sections of label, value and detail), and the image model paints a prompt built from it in a fixed sketchnote style.
 
@@ -68,7 +68,7 @@ There is no Electron `printToPDF` and no ffmpeg in `surfsense_local`. A PDF is R
 [`providers/audiocpp/`](../../surfsense_local/backend/modules/llm/providers/audiocpp/) voices a podcast with the `audio_gen` model, an audio.cpp build installed in the audio folder ([`local-models/catalog.md`](local-models/catalog.md)):
 
 - **The voices are the model's roster**, from its manifest entry: each voice with the languages it speaks, one for a Kokoro or Kitten voice and all 31 for a Supertonic voice. The brief's language list, A to Z by the name shown in the interface language, and each speaker's voice picker come from it, the picker grouped into female and male voices. The brief opens in American English where a voice speaks it, else in any English, else in the roster's first language, and a remembered brief the chosen model cannot voice falls back to that.
-- **Memory is checked before anything loads, twice.** The worker compares the operating system's available memory (`MemAvailable` on Linux, free plus inactive pages on macOS, `GlobalMemoryStatusEx` on Windows) with the model's peak measured while voicing with every chunk of text full, from its entry, plus 1 GiB, and refuses short of it: "Voicing needs about 3.5 GB free; this computer has 1.8 GB. Supertonic 3 needs about 1.6 GB." The second sentence names the first other curated audio model, in the manifest's order, that would fit, and is left out when none would. It checks first, before the chat model drafts anything, so a machine that cannot voice the episode does not spend minutes writing it. It checks again at voicing, because the chat model's own memory may have changed the answer. audio.cpp's own guard counts only the file it reads.
+- **Memory is checked before anything loads, twice.** The worker compares the operating system's available memory (`MemAvailable` on Linux, free plus inactive pages on macOS, `GlobalMemoryStatusEx` on Windows) with the model's peak measured while voicing with every chunk of text full, from its entry, plus 1 GiB, and refuses short of it: "Voicing needs about 3.5 GB free; this computer has 1.8 GB. Supertonic 3 needs about 1.6 GB." The second sentence names the first other curated audio model, in the manifest's order, that would fit, and is left out when none would. It checks first, before the chat model drafts anything, so a machine that cannot voice the episode does not spend minutes writing it. Short there, it unloa
```

**File**: `surfsense_local/backend/modules/artifacts/local_image_demand.py` (modified, +12/-6)
```diff
@@ -22,21 +22,27 @@
 
 def local_image_demand(session: Session, now: datetime) -> ModelType | None:
     """The oldest running job's image type; else the last one's, for IDLE after
-    it ended; else None. A cancel ends the window at once: sd-server cannot
-    stop a generation, so stopping the process is the cancel."""
+    it ended, while no other Studio job runs; else None. A cancel ends the
+    window at once: sd-server cannot stop a generation, so stopping the
+    process is the cancel."""
     needs = {fmt.key: slot for fmt in FORMATS if (slot := _image_type(fmt))}
-    jobs = (
-        select(Artifact.format, Document.status, Document.updated_at)
-        .join(Document, Artifact.document_id == Document.id)
-        .where(Artifact.format.in_(needs))
+    studio = select(Artifact.format, Document.status, Document.updated_at).join(
+        Document, Artifact.document_id == Document.id
     )
+    jobs = studio.where(Artifact.format.in_(needs))
     running = session.execute(
         jobs.where(Document.status == DocumentStatus.PROCESSING)
         .order_by(Document.updated_at)
         .limit(1)
     ).first()
     if running is not None:
         return needs[running.format]
+    # A podcast voices on the processor and a text job loads the chat model;
+    # either needs the memory more than a second image would.
+    if session.execute(
+        studio.where(Document.status == DocumentStatus.PROCESSING).limit(1)
+    ).first():
+        return None
     last = session.execute(
         jobs.where(Document.status.in_(_ENDED))
         .order_by(Document.updated_at.desc())
```

---

### Incident Patch 10: `0da6ec58` (2026-09-25)
**Commit Message**: fix(local): run dev sidecars on the backend's venv so they exit with the app

On Windows, Electron's children die with it but theirs do not. Under
`uv run` Python was one of theirs, so after a Ctrl-C the last session's
Studio worker kept reading the queue, took the next session's podcast jobs
and failed them against its dead router. predev's own `uv run` scripts have
synced the venv by the time the sidecars start.

**File**: `docs/architecture/overview.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ api, worker-studio ── HTTP ──> llama-server, sd-server, remote OpenAI-co
 worker-ingest, worker-studio ── POST /internal/events ──> api ── SSE /workspaces/{id}/events
 ```
 
-- Electron's main process starts four sidecars at boot and supervises them ([`index.ts`](../../surfsense_local/electron/src/main/index.ts), [`sidecars/`](../../surfsense_local/electron/src/main/sidecars/)): the API, one Huey worker per queue, and llama-server. Packaged builds run frozen binaries from the app's resources; `pnpm dev` runs `uv run main.py` and `uv run worker.py <queue>`.
+- Electron's main process starts four sidecars at boot and supervises them ([`index.ts`](../../surfsense_local/electron/src/main/index.ts), [`sidecars/`](../../surfsense_local/electron/src/main/sidecars/)): the API, one Huey worker per queue, and llama-server. Packaged builds run frozen binaries from the app's resources; `pnpm dev` runs `main.py` and `worker.py <queue>` on the backend's `.venv` interpreter, synced by `predev`'s own `uv run` scripts. Not through `uv run`: Windows kills Electron's children with it but not theirs, so after a Ctrl-C the last session's Studio worker, still reading the queue, took the next jobs.
 - llama-server starts whenever its pinned build is staged, in dev too (`pnpm build:llamacpp`, which `predev` runs). It reads per-model arguments from a preset file once at startup, so Electron restarts it when the API rewrites that file ([`local-models/runtime.md`](local-models/runtime.md)).
 - sd-server takes its model as startup arguments, so it cannot start at boot. Whenever its pinned build is staged, in dev too (`pnpm build:sdcpp`, which `predev` runs), `watchImageModel` asks the API every 5 seconds which files to run, and starts, restarts or stops it on a change. The API names a model only while a Studio job needs one and for up to 5 minutes after, so its weights are not held beside the chat model all session ([`studio.md`](studio.md#the-image-path)).
 - audiocpp_server refuses an empty model list, so it starts only once the API has written `audio/server.json` under the data directory, in dev too (`pnpm build:audiocpp`, which `predev` runs). On Windows and Linux that script compiles audio.cpp, and without a C++ toolchain the app runs without local audio ([packaging](packaging.md)). Electron checks that file every 5 seconds and restarts the server when it changes. Electron sets the machine-wide flags: the CPU backend, half the logical cores up to 8, one loaded model, and an unload after 5 idle minutes. The API writes that file whenever an audio model is installed or deleted, and at startup ([`local-models/catalog.md`](local-models/catalog.md)). The Studio worker voices podcasts there, at `SURFSENSE_LOCAL_AUDIO_BASE_URL`, and unloads the model when a podcast ends ([`studio.md`](studio.md)).
```

**File**: `docs/architecture/packaging.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ The asar holds only the Electron main and preload bundles. Everything else rides
 
 The app icon lives in `electron/build/icons/`: `packaged/` holds the `.icns`, `.ico` and `.png` that `electron-builder.yml` names per OS, and `dev/` a variant with a "DEV" badge, which `electron/src/main/dev-app-identity.ts` sets on the Dock, taskbar, window and About panel only while unpackaged, alongside the name "SurfSense Dev", because development runs inside Electron's own bundle and would otherwise show Electron's icon. The macOS menu bar name and the About panel icon stay Electron’s in development; only packaging changes them. Artwork on Windows and Linux fills its canvas; on macOS it sits at 824 of 1024 px with a transparent margin, Apple's icon grid, so `icon.icns` and `dev/icon-macos.png` carry that margin and the `.ico` and `.png` files do not.
 
-Packaged, Electron runs `resources/backend/api/api` and one `worker` process per queue, `ingest` and `studio`, and gives both `SURFSENSE_LOCAL_MODELS_DIR` pointing at `resources/models` and `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`). In development the same sidecars run through `uv run`.
+Packaged, Electron runs `resources/backend/api/api` and one `worker` process per queue, `ingest` and `studio`, and gives both `SURFSENSE_LOCAL_MODELS_DIR` pointing at `resources/models` and `HF_HUB_OFFLINE=1` (`electron/src/main/sidecars/python.ts`). In development the same sidecars run on the backend's `.venv` interpreter ([`overview.md`](overview.md) says why not `uv run`).
 
 ## Freezing the backend
 
```

**File**: `surfsense_local/electron/src/main/sidecars/python.test.ts` (modified, +16/-2)
```diff
@@ -5,8 +5,8 @@ import { join } from "node:path"
 import test from "node:test"
 
 import { audiocppSpec, SERVER_CONFIG } from "./audiocpp.ts"
-import { exe } from "./platform.ts"
-import { apiSpec } from "./python.ts"
+import { exe, isWindows } from "./platform.ts"
+import { apiSpec, workerSpec } from "./python.ts"
 import type { SidecarContext } from "./types.ts"
 
 /** A packaged build with audio.cpp staged and the API's config written. */
@@ -47,3 +47,17 @@ test("the API is told where the staged eSpeak is, as the server is", () => {
   assert.ok(api.SURFSENSE_LOCAL_AUDIO_ESPEAK_LIBRARY)
   assert.equal(api.SURFSENSE_LOCAL_AUDIO_ESPEAK_LIBRARY, server.AUDIOCPP_ESPEAK_LIBRARY)
 })
+
+test("under pnpm dev a worker is the app's own child, so it dies with the app", () => {
+  // Under `uv run` it ran a level lower, which Windows does not kill with the
+  // app: after a Ctrl-C the last session's Studio worker took the next jobs.
+  const ctx = { ...withAudio(), packaged: false }
+  const venvPython = isWindows
+    ? join(".venv", "Scripts", "python.exe")
+    : join(".venv", "bin", "python")
+
+  const worker = workerSpec(ctx, "studio")
+
+  assert.equal(worker.cmd, join(ctx.backendDir, venvPython))
+  assert.deepEqual(worker.args, ["worker.py", "studio"])
+})
```

**File**: `surfsense_local/electron/src/main/sidecars/python.ts` (modified, +9/-4)
```diff
@@ -1,13 +1,14 @@
 /**
  * The Python sidecars: the API, and the worker once per queue. Same shape: a
- * frozen onedir binary when packaged, `uv run` in dev, same SURFSENSE_LOCAL_*
- * env. Both reach llama-server, so both need the bundled address.
+ * frozen onedir binary when packaged, the backend's venv interpreter in dev,
+ * same SURFSENSE_LOCAL_* env. Both reach llama-server, so both need the bundled
+ * address.
  */
 import { existsSync } from "node:fs"
 import { join } from "node:path"
 
 import { binaryPath as audiocppBinary, espeakPaths } from "./audiocpp.ts"
-import { exe } from "./platform.ts"
+import { exe, isWindows } from "./platform.ts"
 import type { SidecarContext, SidecarSpec } from "./types.ts"
 
 function pythonEnv(ctx: SidecarContext): Record<string, string> {
@@ -54,9 +55,13 @@ function pythonCmd(
   devEntry: string,
   args: string[] = [],
 ): { cmd: string; args: string[]; cwd: string } {
+  // Not `uv run`: Windows kills the app's children with it but not theirs, and
+  // under uv Python is one of theirs, so a Ctrl-C left workers taking the next
+  // session's jobs. predev's own `uv run` scripts have synced this venv.
+  const venv = join(ctx.backendDir, ".venv", isWindows ? "Scripts" : "bin")
   return ctx.packaged
     ? { cmd: join(ctx.binariesDir, "backend", name, exe(name)), args, cwd: ctx.binariesDir }
-    : { cmd: "uv", args: ["run", devEntry, ...args], cwd: ctx.backendDir }
+    : { cmd: join(venv, exe("python")), args: [devEntry, ...args], cwd: ctx.backendDir }
 }
 
 export function apiSpec(ctx: SidecarContext): SidecarSpec {
```

#### Recent Merged Pull Requests:
- **PR #2083** (2026-09-30): feat(local): voice podcasts with server audio models (@AnishSarkar22)
- **PR #2082** (2026-09-30): [Plugins|Runtime] Run a plugin in its own process (@CREDO23)
- **PR #2081** (2026-09-30): [Local|Sources] Reload Sources on document events (@CREDO23)
- **PR #2079** (2026-09-30): [Plugins|CLI] Add the author commands (@CREDO23)
- **PR #2076** (2026-09-30): [Plugins|SDK] Test the SDK against the real app (@CREDO23)
- **PR #2075** (2026-09-30): [Plugins|CLI] Design the author commands (@CREDO23)
- **PR #2073** (2026-09-30): [Plugins|SDK] Add the plugin SDK (@CREDO23)
- **PR #2070** (2026-09-30): [Plugins|Manifest] Accept the stamped version, explain name rules (@CREDO23)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
