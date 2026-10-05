# Forensic Learning Record (Deep Inspection): hypit-ai/hypit

> **Canonical Artifact**: `07_PROJECT_LEARNING/hypit-ai-hypit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hypit-ai/hypit](https://github.com/hypit-ai/hypit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:08.367Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hypit-ai/hypit`
- **Description**: Clone any viral video with AI agents. Not just a script, the whole workflow: swap the face, the words, the B-roll, ship 100 variants in one command, and get your 100M views.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17966 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/hypit.mjs`
```
#!/usr/bin/env node

import { register } from "tsx/esm/api";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.argv.length === 3 && ["--version", "-v"].includes(process.argv[2])) {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(manifest.version);
  process.exit(0);
}

const emitWarning = process.emitWarning;
process.emitWarning = function hypitWarning(warning, ...args) {
  const message = warning instanceof Error ? warning.message : String(warning);
  if (message === "SQLite is an experimental feature and might change at any time") return;
  return emitWarning.call(process, warning, ...args);
};

// Bootstrap and package activation must agree on the physical Distribution root. Windows short
// paths can survive Node's ordinary resolution while package lookup expands them through libuv.
const distributionRoot = realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const distributionUrl = pathToFileURL(distributionRoot + sep);
register();
const {
  installDistributionPackageResolution,
  installExternalPackageResolution,
} = await import(new URL("packages/package-loader-node/src/distribution-resolution.ts", distributionUrl).href);
installDistributionPackageResolution([distributionRoot]);
const { hypitHostPackageRoot } = await import(new URL("packages/runtime-host-node/src/index.ts", distributionUrl).href);
installExternalPackageResolution([hypitHostPackageRoot()]);
const args = process.argv.slice(2);
if (args[0] === "studio" || (args[0] === "help" && args[1] === "studio")) {
  const { runStudio } = await import(new URL("packages/studio/start.ts", distributionUrl).href);
  try {
    await runStudio(args[0] === "help" ? ["--help"] : args.slice(1).filter((arg) => arg !== "--debug"), {
      write: (text) => process.stdout.write(text),
    });
  } catch (error) {
    const { renderCliError } = await import(new URL("packages/cli/src/index.ts", distributionUrl).href);
    process.stderr.write(renderCliError(error, { debug: args.includes("--debug") }));
    process.exitCode = 1;
  }
} else {
  await import(new URL("packages/video-cli/src/cli.ts", distributionUrl).href);
}

```

### Core Architecture Module: `examples/complex-explainer/packages/launch-scenes/src/activation.js`
```
import { sceneCompanions } from "./studio.js";
import { createStudioTrackCompanionHostFacet } from "@hypit/hypit/studio-adapter";
import {
  assertAttributes,
  assertEmptyElement,
  textAttribute,
  canonicalize,
  sameType,
  sealGraphFragment,
  createMarkupSurfaceHostFacet,
} from "@hypit/hypit/author-kit";
import { compositionTypes } from "@hypit/hypit/composition";
import { mediaTypes } from "@hypit/hypit/media";
import { timelineTypes } from "@hypit/hypit/timeline";
import { spatialTypes } from "@hypit/hypit/spatial";
import { temporalTypes, assertTemporalInstantFor } from "@hypit/hypit/temporal";
import {
  resolveTemporalContext,
  createTemporalWindowProjection,
  createTemporalInstantProjection,
  temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary,
  temporalContextAttributeVocabulary,
  temporalInstantAttributeNames,
  temporalInstantAttributeVocabulary,
} from "@hypit/hypit/temporal-markup";
import { renderPoster } from "./render.js";
const module = { name: "@explainer/launch-scenes", version: "1" },
  type = (name) => ({ module, name }),
  producer = (name) => ({ module, name }),
  port = (name, type) => ({ name, type });
const options = type("Options"),
  events = type("Events");
const common = [
  port("timeline", timelineTypes.track),
  port("canvas", spatialTypes.canvas),
  port("window", temporalTypes.window),
  port("font", mediaTypes.fontArtifact),
  port("options", options),
  port("events", events),
];
const tags = {
  PosterTitle: {
    name: "poster",
    render: renderPoster,
    assets: [],
    defaults: {
      text: "Hypit",
      subtitle: "",
      z: 45,
      y: 0.18,
      size: 180,
      "subtitle-size": 44,
      "subtitle-gap": 36,
    },
  },
};
const ins = (tag) => [...common, ...tags[tag].assets.map((n) => port(n, mediaTypes.blobArtifact))];
export const manifest = {
  format: "hypit.module@1",
  ...module,
  dependencies: [
    ...new Map(
      [
        compositionTypes.visualTrack,
        mediaTypes.fontArtifact,
        mediaTypes.blobArtifact,
        timelineTypes.track,
        spatialTypes.canvas,
        temporalTypes.window,
        temporalTypes.instant,
      ].map((t) => [t.module.name, { module: t.module }]),
    ).values(),
  ],
  types: [{ name: "Options" }, { name: "Events" }],
  capabilities: [],
  producers: [
    { name: "empty", inputs: [], outputs: [port("events", events)], needs: [] },
    {
      name: "append",
      inputs: [
        port("timeline", timelineTypes.track),
        port("events", events),
        port("options", options),
        port("at", temporalTypes.instant),
      ],
      outputs: [port("events", events)],
      needs: [],
    },
    ...Object.keys(tags).map((tag) => ({
      name: tags[tag].name,
      inputs: ins(tag),
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    })),
  ],
};
const inline = (r) => {
    if (r?.value.kind !== "inline") throw Error("Expected inline scene value");
    return r.value.value;
  },
  value = (v) => ({ kind: "inline", value: canonicalize(v) }),
  out = (n, v) => ({ outputs: { [n]: value(v) }, needs: {} });
const component = {
  producers: [
    { producer: producer("empty"), handler: () => out("events", []) },
    {
      producer: producer("append"),
      handler: ({ inputs: i }) => {
        const o = inline(i.options),
          at = inline(i.at),
          list = inline(i.events);
        assertTemporalInstantFor(at, {
          subjectId: o.id,
          space: inline(i.timeline),
        });
        if (list.some((e) => e.name === o.name)) throw Error("Beat names must be unique");
        return out("events", [...list, { ...o, at }]);
      },
    },
    ...Object.keys(tags).map((tag) => ({
      producer: producer(tags[tag].name),
      handler: ({ inputs: i }) =>
        out(
          "track",
          tags[tag].render(
            inline(i.timeline),
            inline(i.canvas),
            inline(i.window),
            inline(i.font),
            inline(i.options),
            inline(i.events),
            Object.fromEntries(tags[tag].assets.map((n) => [n, i[n].value])),
          ),
        ),
    })),
  ],
};
function decode(tag) {
  return ({ element, resolveReference }) => {
    const spec = tags[tag];
    assertAttributes(element, [
      "id",
      "timeline",
      "canvas",
      "font",
      ...spec.assets,
      ...Object.keys(spec.defaults),
      ...temporalWindowAttributeNames,
    ]);
    const id = textAttribute(element, "id"),
      context = resolveTemporalContext({ element, resolveReference }),
      window = createTemporalWindowProjection({
        id: id + ".window",
        subjectId: id,
        element,
        ...context,
        resolveReference,
      });
    const ref = (el, n, t) => {
      const raw = el.attributes[n];
      if (typeof raw !== "object" || raw.kind !== "reference")
        throw Error(n + " must be a reference");
      const r = resolveReference(raw.path);
      if (!r || !sameType(r.type, t)) throw Error(n + " has wrong type");
      return r.ref;
    };
    const opts = { id };
    for (const [n, d] of Object.entries(spec.defaults)) {
      const v = element.attributes[n];
      if (v !== undefined && typeof v !== "string") throw Error(n + " must be literal");
      opts[n] = typeof d === "number" ? Number(v ?? d) : (v ?? d);
    }
    if (!Number.isSafeInteger(opts.z)) throw Error("z must be integer");
    const records = [
        ...window.records,
        {
          id: id + ".options",
          type: options,
          value: value(opts),
          range: element.range,
        },
      ],
      components = [...window.components],
      fragments = [...window.fragments];
    const inputs = ins(tag).filter((p) => p.name !== "events"),
      bindings = {
        timeline: context.timeline.ref,
        canvas: ref(element, "canvas", spatialTypes.canvas),
        window: window.ref,
        font: ref(element, "font", mediaTypes.fontArtifact),
        options: { kind: "record", id: id + ".options" },
      };
    for (const n of spec.assets) bindings[n] = ref(element, n, mediaTypes.blobArtifact);
    const input = (name) => ({ kind: "fragment-input", name }),
      op = (operation) => ({ kind: "fragment-operation", operation }),
      operations = [
        {
          id: "empty",
          producer: producer("empty"),
          inputs: {},
          result: { kind: "output", name: "events" },
        },
      ];
    let prev = "empty",
      count = 0;
    for (const ch of element.children) {
      if (ch.kind === "text") {
        if (ch.value.trim()) throw Error("Expected Beat");
        continue;
      }
      if (ch.name.split(":").at(-1) !== "Beat") throw Error("Expected Beat");
      assertAttributes(ch, ["name", ...temporalInstantAttributeNames]);
      assertEmptyElement(ch);
      const name = textAttribute(ch, "name"),
        key = "beat" + ++count,
        eid = id + "." + key,
        at = createTemporalInstantProjection({
          id: eid,
          subjectId: eid,
          element: ch,
          ...context,
          resolveReference,
        });
      records.push(...at.records, {
        id: eid + ".options",
        type: options,
        value: value({ id: eid, name }),
        range: ch.range,
      });
      components.push(...at.components);
      fragments.push(...at.fragments);
      inputs.push(port(key, options), port(key + "-at", temporalTypes.instant));
      bindings[key] = { kind: "record", id: eid + ".options" };
      bindings[key + "-at"] = at.ref;
      operations.push({
        id: key,
        producer: producer("append"),
        inputs: {
          timeline: input("timeline"),
          events: op(prev),
          options: input(key),
          at: input(key + "-at"),
        },
        result: { kind: "output", name: "events" },
      });
      prev = key;
    }
    operations.push({
      id: "render",
      producer: producer(spec.name),
      inputs: {
        ...Object
```

### Core Architecture Module: `examples/complex-explainer/packages/launch-scenes/src/render.js`
```
import { sealVisualTrack } from "@hypit/hypit/composition";
import { browserProgram } from "@hypit/hypit/hyperframes";
import { assertTemporalWindowFor } from "@hypit/hypit/temporal";
const sty = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
function seal(t, c, w, o, html, css, setup, data, children = []) {
  assertTemporalWindowFor(w, { subjectId: o.id, space: t });
  return sealVisualTrack({
    id: o.id,
    programSpaceId: t.id,
    visualIr: "hypit.visual-ir@1",
    presents: [
      {
        id: o.id,
        span: w.span,
        stacking: { order: o.z, tieBreak: o.id },
        elements: [
          {
            id: "scene",
            kind: "program",
            order: 0,
            program: browserProgram({
              html: html + '<div class="font-resource">{{font}}</div>',
              css:
                ":scope{pointer-events:none}.font-resource{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}" +
                css,
              setup:
                `const family=getComputedStyle(root.querySelector('.font-resource>*')).fontFamily;root.style.fontFamily=family;` +
                setup,
              data,
            }),
            style: sty({
              position: "absolute",
              inset: 0,
              width: c.widthPx + "px",
              height: c.heightPx + "px",
            }),
          },
          {
            id: "font",
            parent: "scene",
            kind: "text",
            order: 1,
            text: "Hypit 字",
            fonts: [data.font],
            style: sty({ "font-size": "12px" }),
          },
          ...children,
        ],
      },
    ],
  });
}
export function renderPoster(t, c, w, font, o) {
  return seal(
    t,
    c,
    w,
    o,
    `<div class="poster"><div class="poster-title">${esc(o.text)}</div><div class="poster-subtitle">${esc(o.subtitle)}</div></div>`,
    `.poster{position:absolute;left:5%;top:${o.y * 100}%;width:90%;text-align:center}.poster-title{font-size:${o.size}px;line-height:1.05;color:#ff79bc;-webkit-text-stroke:5px #2b1f30;paint-order:stroke fill;text-shadow:2px 2px #2b1f30,4px 4px #2b1f30,7px 8px #2b1f30;filter:drop-shadow(0 0 1px #ffe6f2)}.poster-subtitle{display:inline-block;margin-top:${o["subtitle-gap"]}px;padding:10px 26px 13px;font-size:${o["subtitle-size"]}px;line-height:1.2;color:#2b1f30;background:#fff0f7;border:3px solid #2b1f30;border-radius:6px;box-shadow:6px 7px 0 #fa67aa}`,
    "return frame=>{};",
    { font },
  );
}

```

### Core Architecture Module: `examples/complex-explainer/packages/launch-scenes/src/studio.js`
```
import { compositionTypes } from "@hypit/hypit/composition";
import { textLayer, temporalLineageFor } from "@hypit/hypit/studio-adapter";
const fields = {
  PosterTitle: [
    ["text", "Title", "text"],
    ["subtitle", "Subtitle", "text"],
    ["y", "Y", "number"],
    ["size", "Title size", "number"],
    ["subtitle-size", "Subtitle size", "number"],
    ["subtitle-gap", "Subtitle gap", "number"],
  ],
};
export function sceneCompanions(module, tags) {
  return Object.entries(tags).map(([tag, spec]) => {
    const inspector = [...fields[tag], ["z", "Drawing order", "number"]].map(
      ([binding, label, control]) => ({
        binding,
        label,
        control,
        domain: ["y", "z"].includes(binding) ? "where" : "how",
        section: { id: "title", label: "Title" },
        ...(binding === "y" ? { unit: "%", number: { scale: 100, step: 1 } } : {}),
        ...(["size", "subtitle-size", "subtitle-gap"].includes(binding)
          ? { unit: "px", number: { minimum: 0, step: 1 } }
          : {}),
      }),
    );
    return {
      id: spec.name,
      role: "track",
      output: {
        type: compositionTypes.visualTrack,
        surface: spec.name,
        modules: [module],
      },
      family: "launch-scenes",
      label: "Montage title",
      tone: "orange",
      icon: "text",
      lane: { heightPx: 44 },
      bindings: inspector.map((f) => ({
        name: f.binding,
        writable: true,
        fallback: spec.defaults[f.binding],
      })),
      inspector,
      project(context) {
        return context.generic().map((e) => ({
          ...e,
          temporal: temporalLineageFor(context, context.placement.id, "window"),
          display: {
            title: "Montage title",
            layers: [
              textLayer(
                context.placement?.attributes.text ?? context.placement?.attributes.title ?? tag,
              ),
            ],
          },
        }));
      },
    };
  });
}

```

### Core Architecture Module: `examples/complex-explainer/packages/opening-system/src/activation.js`
```
import { installPortraitTransition } from "./portrait-transition.js";
import { installPortraitInset } from "./portrait-inset.js";
import { installReframe } from "./reframe.js";
import { installPullback } from "./pullback.js";
import {
  assertAttributes,
  assertEmptyElement,
  canonicalize,
  createMarkupSurfaceHostFacet,
  sameType,
  sealGraphFragment,
  textAttribute,
} from "@hypit/hypit/author-kit";
import { compositionTypes } from "@hypit/hypit/composition";
import { mediaTypes } from "@hypit/hypit/media";
import { timelineTypes } from "@hypit/hypit/timeline";
import { spatialTypes } from "@hypit/hypit/spatial";
import { temporalTypes } from "@hypit/hypit/temporal";
import {
  createTemporalWindowProjection,
  createTemporalInstantProjection,
  resolveTemporalContext,
  temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary,
  temporalContextAttributeVocabulary,
} from "@hypit/hypit/temporal-markup";
import { renderTitle, renderTimer, renderFlag, renderStage, renderVeil } from "./render.js";
import { module, defaults } from "./definition.js";
import { studioFacet } from "./studio.js";
const type = (name) => ({ module, name });
const optionsType = type("Options"),
  itemsType = type("Items");
const producer = (name) => ({ module, name });
const port = (name, type) => ({ name, type });
const common = [
  port("timeline", timelineTypes.track),
  port("canvas", spatialTypes.canvas),
  port("window", temporalTypes.window),
  port("options", optionsType),
];
export const manifest = {
  format: "hypit.module@1",
  ...module,
  dependencies: [
    ...new Map(
      [
        compositionTypes.visualTrack,
        mediaTypes.fontArtifact,
        mediaTypes.synchronized,
        mediaTypes.blobArtifact,
        timelineTypes.track,
        spatialTypes.canvas,
        temporalTypes.window,
      ].map((t) => [t.module.name, { module: t.module }]),
    ).values(),
  ],
  types: [{ name: "Options" }, { name: "Items" }],
  capabilities: [],
  producers: [
    {
      name: "title",
      inputs: [...common, port("font", mediaTypes.fontArtifact), port("bounce", temporalTypes.instant)],
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    },
    {
      name: "timer",
      inputs: [
        ...common,
        port("font", mediaTypes.fontArtifact),
        port("logo", mediaTypes.blobArtifact),
        port("stop", temporalTypes.instant),
      ],
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    },
    { name: "flag", inputs: [...common, port("logo", mediaTypes.blobArtifact)], outputs: [port("track", compositionTypes.visualTrack)], needs: [] },
    {
      name: "veil",
      inputs: common,
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    },
    {
      name: "empty",
      inputs: [],
      outputs: [port("items", itemsType)],
      needs: [],
    },
    ...["image", "video"].map((kind) => ({
      name: "append-" + kind,
      inputs: [
        port("items", itemsType),
        port("options", optionsType),
        port("window", temporalTypes.window),
        port(
          "asset",
          kind === "image" ? mediaTypes.blobArtifact : mediaTypes.synchronized,
        ),
      ],
      outputs: [port("items", itemsType)],
      needs: [],
    })),
    {
      name: "stage",
      inputs: [...common, port("items", itemsType)],
      outputs: [port("track", compositionTypes.visualTrack)],
      needs: [],
    },
  ],
};
const inline = (r) => {
  if (r?.value.kind !== "inline")
    throw Error("Opening-system expects inline domain values.");
  return r.value.value;
};
const val = (v) => ({ kind: "inline", value: canonicalize(v) });
const output = (name, v) => ({ outputs: { [name]: val(v) }, needs: {} });
const component = {
  producers: [
    { producer: producer("flag"), handler: ({inputs: i}) => output("track", renderFlag(inline(i.timeline), inline(i.canvas), inline(i.window), inline(i.options), i.logo.value)) },
    ...[
      ["title", renderTitle],
      ["timer", renderTimer],
    ].map(([name, fn]) => ({
      producer: producer(name),
      handler: ({ inputs: i }) =>
        output(
          "track",
          fn(
            inline(i.timeline),
            inline(i.canvas),
            inline(i.window),
            inline(i.font),
            inline(i.options),
            name === "title" ? inline(i.bounce) : i.logo?.value,
            name === "timer" ? inline(i.stop) : undefined,
          ),
        ),
    })),
    {
      producer: producer("veil"),
      handler: ({ inputs: i }) =>
        output(
          "track",
          renderVeil(
            inline(i.timeline),
            inline(i.canvas),
            inline(i.window),
            inline(i.options),
          ),
        ),
    },
    { producer: producer("empty"), handler: () => output("items", []) },
    ...["image", "video"].map((kind) => ({
      producer: producer("append-" + kind),
      handler: ({ inputs: i }) =>
        output("items", [
          ...inline(i.items),
          {
            ...inline(i.options),
            window: inline(i.window),
            [kind === "image" ? "image" : "media"]:
              kind === "image" ? i.asset.value : inline(i.asset),
          },
        ]),
    })),
    {
      producer: producer("stage"),
      handler: ({ inputs: i }) =>
        output(
          "track",
          renderStage(
            inline(i.timeline),
            inline(i.canvas),
            inline(i.window),
            inline(i.items),
            inline(i.options),
          ),
        ),
    },
  ],
};
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function decode(kind) {
  return ({ element, resolveReference }) => {
    const values = defaults[kind];
    assertAttributes(element, [
      "id",
      "timeline",
      "canvas",
      ...(kind === "Title" ? ["bounce-at"] : []),
      ...(kind === "Timer" ? ["stop-at"] : []),
      ...(["Title", "Timer"].includes(kind) ? ["font"] : []),
      ...(["Timer", "Flag"].includes(kind) ? ["logo"] : []),
      ...Object.keys(values),
      ...temporalWindowAttributeNames,
    ]);
    const id = textAttribute(element, "id"),
      context = resolveTemporalContext({ element, resolveReference });
    const win = createTemporalWindowProjection({
      id: id + ".window",
      subjectId: id,
      element,
      ...context,
      resolveReference,
    });
    const ref = (el, name, t) => {
      const raw = el.attributes[name];
      if (typeof raw !== "object" || raw.kind !== "reference")
        throw Error(name + " must be a reference");
      const found = resolveReference(raw.path);
      if (!found || !sameType(found.type, t))
        throw Error(name + " has the wrong type");
      return found.ref;
    };
    const o = { id };
    for (const [name, d] of Object.entries(values)) {
      const raw = element.attributes[name];
      if (raw !== undefined && typeof raw !== "string")
        throw Error(name + " must be literal");
      const v = typeof d === "number" ? Number(raw ?? d) : (raw ?? d);
      if (typeof v === "number" && !Number.isFinite(v))
        throw Error(name + " must be finite");
      o[camel(name)] = v;
    }
    if (!Number.isSafeInteger(o.z)) throw Error("z must be an integer");
    if (
      kind === "Stage" &&
      (!["contain", "cover"].includes(o.fit) ||
        o.width <= 0 ||
        o.height <= 0 ||
        o.brightness < 0 ||
        o.blur < 0 ||
        o.pushRate < 0)
    )
      throw Error(
        "Stage needs positive dimensions, contain/cover fit, and nonnegative background values.",
      );
    if (
      ["Title", "Timer"].includes(kind) &&
      (!Number.isSafeInteger(o.seconds) || o.seconds < 0)
    )
      throw Error("seconds must be a nonnegative integer");
    if (
      kind === "Timer" &&
      (!Number.isSafeInteger(o.entranceFrames) || o.entranceFrames < 1)
    )
      throw Error("entrance-frames must be positive");
    if (
    
```

### Core Architecture Module: `examples/complex-explainer/packages/opening-system/src/definition.js`
```
export const module = { name: "@explainer/opening-system", version: "1" };
export const defaults = {
  Veil: {
    z: 20,
    pattern: "mesh",
    cell: 12,
    amount: 0.26,
    shade: 0.48,
    tint: "#0c101b",
    "fade-frames": 6,
  },
  Title: {
    z: 40,
    title: "Hypit",
    subtitle: "一分钟了解",
    seconds: 60,
    color: "#e0f5ff",
    "timer-y": 0.175,
    "title-y": 0.53,
    "title-size": 0.19,
  },
  Timer: {
    z: 80,
    title: "Hypit",
    subtitle: "VIDEO FRAMEWORK",
    seconds: 60,
    x: 0,
    y: 0.13,
    width: 0.28,
    accent: "#386f7e",
    "flag-color": "#c92f4d",
    "flag-amplitude": 0.06,
    "flag-speed": 0.25,
    "entrance-frames": 7,
  },
  Flag: { z: 35, x: 0.17, y: 0.81, width: 0.66, height: 0.17, "flag-color": "#fa67aa", "flag-amplitude": 0.04, "flag-speed": 0.25 },
  Stage: {
    z: 10,
    x: 0,
    y: 0.263,
    width: 1,
    height: 0.463,
    fit: "contain",
    blur: 32,
    brightness: 0.32,
    zoom: 1.13,
    radius: 0,
    "push-rate": 0,
  },
};

```

### Core Architecture Module: `examples/complex-explainer/packages/opening-system/src/flag-cloth.js`
```
// Shared pixel-art flag: a small texture, stepped folds and two authored views.
// Every frame is determined by its time; no simulation history is needed.
export const flagSetup = String.raw`
const flagCanvas=root.querySelector('.flag-canvas'), ctx=flagCanvas.getContext('2d');
flagCanvas.width=256;flagCanvas.height=160;ctx.imageSmoothingEnabled=false;
const logo=root.querySelector('.logo-resource img');
const texture=document.createElement('canvas');texture.width=128;texture.height=52;
const tc=texture.getContext('2d');tc.imageSmoothingEnabled=false;
const flagRaster=document.createElement('canvas');flagRaster.width=256;flagRaster.height=160;
const cc=flagRaster.getContext('2d');cc.imageSmoothingEnabled=false;
const mask=document.createElement('canvas');mask.width=256;mask.height=160;
const mc=mask.getContext('2d');let pixels=null;
function prepareTexture(){
 if(!logo?.complete||!logo.naturalWidth)return false;
 tc.fillStyle=data.flagColor;tc.fillRect(0,0,128,52);
 const lw=110,lh=Math.round(lw*logo.naturalHeight/logo.naturalWidth);
 tc.drawImage(logo,9,Math.round((52-lh)/2),lw,lh);
 // A few stitched pixels frame the logo without covering its lettering.
 tc.fillStyle='#ffe8f4';for(let x=4;x<124;x+=5){tc.fillRect(x,2,2,1);tc.fillRect(x,49,2,1);}
 pixels=tc.getImageData(0,0,128,52).data;return true;
}
function drawFlag(frame){
 if(!pixels&&!prepareTexture())return;
 const floor=data.flagPose==='floor',t=Math.floor(frame/data.fps*12)/12;
 const phase=t*data.flagSpeed*Math.PI*2,amp=Math.min(7,data.flagAmplitude*60);
 cc.clearRect(0,0,256,160);ctx.clearRect(0,0,256,160);
 for(let y=0;y<52;y++)for(let x=0;x<128;x++){
  const u=x/127,v=y/51,p=7*u-2*v-phase;
  const wave=Math.sin(p)+.2*Math.sin(p*1.8+.7);
  const dy=Math.round(amp*wave*(floor?1:Math.pow(u,.75)));
  const width=floor?142+v*65:190;
  const px=Math.round((floor?128-width/2-5*v:37)+u*width);
  const py=Math.round((floor?58+v*40:35+v*73+u*9)+dy);
  const band=Math.cos(p-0.45),shade=band>.5?1.1:band<-.55?.76:band<-.05?.9:1;
  const i=(y*128+x)*4;
  cc.fillStyle='rgb('+Math.min(255,Math.round(pixels[i]*shade))+','+Math.min(255,Math.round(pixels[i+1]*shade))+','+Math.min(255,Math.round(pixels[i+2]*shade))+')';
  cc.fillRect(px,py,Math.ceil(width/127)+1,floor?2:3);
 }
 mc.clearRect(0,0,256,160);mc.drawImage(flagRaster,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle='#42263e';mc.fillRect(0,0,256,160);mc.globalCompositeOperation='source-over';
 if(!floor){ctx.fillStyle='#281d2d';ctx.fillRect(32,22,4,121);ctx.fillRect(30,18,8,6);ctx.fillStyle='#ffe6b3';ctx.fillRect(31,18,5,4);ctx.fillStyle='#faafd1';ctx.fillRect(33,25,1,113);}
 ctx.drawImage(mask,3,4);
 for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1]])ctx.drawImage(mask,x,y);
 ctx.drawImage(flagRaster,0,0);
}
`;

```

### Core Architecture Module: `examples/complex-explainer/packages/opening-system/src/performance-media.js`
```
import { projectTimelineMedia } from "@hypit/hypit/timeline";
export function performanceMedia(timeline, window, parent = "scene") {
  const clips = projectTimelineMedia(timeline, window.span).filter(
    (clip) => clip.media.visual,
  );
  const children = clips.map((clip, index) => ({
    id: "clip" + index,
    parent,
    kind: "video",
    order: index + 1,
    muted: true,
    artifact: clip.media.visual.artifact,
    style: Object.entries({
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      "object-fit": "cover",
    }).map(([name, value]) => ({ name, value })),
    sampling: {
      sourceFrameRate: clip.media.timeline.frameRate,
      sourceFrameCount: clip.media.timeline.frameCount,
      segments: [
        {
          target: {
            startFrame: clip.span.startFrame - window.span.startFrame,
            endFrameExclusive:
              clip.span.endFrameExclusive - window.span.startFrame,
          },
          sourceFrame: { numerator: clip.source.startFrame, denominator: 1 },
          rate: { numerator: 1, denominator: 1 },
        },
      ],
    },
  }));
  return { clips, children };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #369** (2026-09-30): **[Bug] HypiHub 当前模型目录接口不可达**
  *Symptoms*: ### What happened  <img width="1140" height="361" alt="Image" src="https://github.com/user-attachments/assets/6dc37984-fa93-4736-ab65-5e23351381cb" />  ### What you expected  好像上游接口又有问题了？😂这两天一直没办法生成，难得生成一个有点小问题。  ### How to reproduce  codex里调用skill执行复刻生成，前面都正常解析，说明生成费用，但到生成授权时就不行了  ### Hypit version  0.2.16  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > Taking this one — the screenshot pinpoints it, and unlike #366/#367/#368 this part is fixable on the Hypit side. Root cause:  **Where it fails.** The failure phase "HypiHub GPT Image 2 模型目录检查 / generation not submitted: fetch failed" is `verifyModelRoute` (`packages/provider-hypihub/src/provider.ts`): before every submission the Provider reads `GET /v1/models/<model>` to confirm the model card lists the operation. Until now, **any** failure of that read — including a pure transport failure like `fetch failed` — was wrapped into "HypiHub model catalogue check failed; … generation not submitted" and permanently failed the Build, before a single reference was uploaded and before any job was created. That is why three Build retries all died at the same step with 0 credits spent and Seedance never started: the catalogue route was unreachable while the rest of the service (plan, pricing reads you saw succeed moments earlier) answered fine, so a catalogue outage was silently escalated into a 
  > PR: #371 — the catalogue precheck now skips only when the read carries no verdict (transport failure, 429/5xx), reports the skip as progress, and lets the submission itself decide; definitive catalogue answers still fail fast before any upload.

- **Issue #367** (2026-09-30): **[Bug] HypiHub seedance-2-mini jobs fail with 402 "Credits insufficient" despite sufficient balance**
  *Symptoms*: ### What happened  Since 2026-09-29 06:46 UTC, `bytedance/seedance-2-mini` (reference video) jobs submitted through HypiHub fail shortly after submission with:  HypiHub job <id> failed; 402; model=bytedance/seedance-2-mini: Credits insufficient : Your current balance isn't enough to run this request. Please top up to continue.  - My HypiHub balance is about 2,090 credits, and the failed jobs charge nothing (Credits "—" in Projects). - The jobs are created and appear as "Failed" in Projects, so the failure seems to happen after submission, not at the balance check. - It fails regardless of size: 720p / 11-12 s, 720p / 7 s, and a small 480p / 4 s test (~11 credits) fail the same way. - It is intermittent: jobs succeeded at 2026-09-29 04:27 UTC and at 2026-09-29 15:04 UTC, but failed from 06:46 to 12:42 UTC on Sep 29 (12 jobs) and again from 21:34 UTC on Sep 29 (4 jobs so far, including a single job submitted alone). - I've emailed official@hypit.ai with job IDs and can share my account email privately.  ### What you expected  The job should run and be charged normally (about 5.75 credits/s at 720p with a reference video), since the balance covers it.  ### How to reproduce  1. Author a production with the Seedance 2 Mini Surface: 6 reference images (person references + one background with person-reference="false") and 1 reference video (576x1024, constant 30 fps, 7-12 s), 720p. 2. `hypit build <run>.svrun --follow` 3. The HypiHub job is submitted, then fails with the 402 above w
  **Post-Mortem & Fix Analysis**:
  > Taking this one on the Hypit side — I've traced where the message comes from and prepared a client-side improvement; summary of the root cause below.  **Where the message is produced.** `HypiHub job <id> failed; 402; model=…` is emitted by `hypiHubJobFailure` (`packages/provider-hypihub/src/errors.ts`), which only runs for a job the service has already created (terminal states `failed` / `queue_expired` / `canceled`). So HypiHub accepted the submission and created the job, and its **own billing precheck rejected it afterwards** — exactly the sequence this issue describes ("created and appear as Failed in Projects … after submission, not at the balance check").  **Hypit performs no balance check of its own.** The submission path sends a deterministic wire body (`model`, `prompt`, `resolution`, `aspect_ratio`, `seconds`, `generate_audio`, `web_search`, plus staged `reference_*` URLs — pinned by provider tests) and nothing reads an account balance; the guide documents permission as "separ
  > PR: #370 — keeps the service's facts verbatim and appends the post-submission billing-precheck explanation (with tests). The service-side credit-ledger reservation precheck still needs HypiHub's own fix; the job ids in this issue and in #368 are what support needs to trace it.
  > We checked the later failed jobs. Seedance’s reference-image review returned: “The request failed because the input image may contain sensitive information.”  HypiHub incorrectly displayed this as “Credits insufficient,” which was misleading. Your HypiHub balance was sufficient, and the failed jobs were fully refunded. We’ve now fixed the error-reporting issue. We’re very sorry for the confusion and inconvenience this caused.

- **Issue #366** (2026-09-29): **[Bug] HypiHub 准备 Seedance 2.5 视频请求fetch failed**
  *Symptoms*: ### What happened  <img width="1008" height="154" alt="Image" src="https://github.com/user-attachments/assets/1129268d-a0e4-4cbe-a12a-a2f5d0ac51fc" />  用新版 Hypit 0.2.16 再试，仍然失败： - 失败位置：HypiHub 准备 Seedance 2.5 视频请求 - 错误：fetch failed - 状态：generation not submitted  ### What you expected  ...  ### How to reproduce  ...  ### Hypit version  0.2.16   ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > <img width="948" height="538" alt="Image" src="https://github.com/user-attachments/assets/7ec40306-6725-44c4-86ff-e4204cd8748b" />
  > Build：bld_20260929T025821106Z_EFCE87795E 错误：HypiHub 请求准备阶段 fetch failed 状态：generation not submitted
  > 非常抱歉！您可以提供一下注册 HypiHub 的邮箱吗，我这就去检查

- **Issue #359** (2026-09-26): **https://hypit.ai/订阅服务[Bug]**
  *Symptoms*: ### What happened  在https://hypit.ai/订阅网站里，单个账号创建的订阅订单在不支付的情况下，关闭这笔订阅订单的支付界面后，重新创建新的订阅订单会提示“上一次结账还在准备中，请稍等后重试”，去账号的账单界面查看会发现上一次创建的未支付订阅订单会一直卡在账号的账单里面并未随着关闭支付界面后自动结束这笔订单，也没有手动关闭此订单的入口，导致这个账号无法重新创建新的订阅订单购买服务  <img width="1884" height="502" alt="Image" src="https://github.com/user-attachments/assets/c30a4e25-21d1-4fb2-b563-6631143fc0f2" /> <img width="1242" height="672" alt="Image" src="https://github.com/user-attachments/assets/81ab30a2-e3a5-42f7-86e3-69e1ec8dab5e" /> <img width="1221" height="478" alt="Image" src="https://github.com/user-attachments/assets/8c58c29e-477e-452c-819d-ad382823e90f" />  ### What you expected  无  ### How to reproduce  无  ### Hypit version  https://hypit.ai/  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，已修复。

- **Issue #352** (2026-09-25): **[Bug] 使用codex调用skill时为什么会出现把需要复刻的视频传入另外个视频剪辑软件并读取积分的情况？**
  *Symptoms*: ### What happened   使用codex调用skill时，因为打开了一款在codex上也有连接的桌面版软件chatcut，skill把需要复刻的视频传入了chatcut中，并读取了chatcut的积分，但因为chatcut没什么积分，hypit没有执行复刻任务。  <img width="1165" height="658" alt="Image" src="https://github.com/user-attachments/assets/10a8478b-bc4c-4a3e-ab90-44e95d7e5598" />  ### What you expected  我不知道是提示词问题，还是什么原因。因为我是从skill入口点击启用skiill的，如果是提示词问题，那是否有什么解决办法？即如果用户开启了类似chatcut这种桌面软件，其同时在codex里也有skill的，那这个可以避免吗？  <img width="772" height="112" alt="Image" src="https://github.com/user-attachments/assets/38c3aee9-bd7a-4895-9445-632be1f0de66" />  ### How to reproduce  高度复刻附件参考视频的画面构图、固定机位、镜头顺序、动作时间点、主体运动轨迹和遮挡关系。具体要求：   1、将视频中的人物改成具有美国美国南部特征的白人男性，与此同时，白人男性背着的背包改成我们的产品 xxxx 2、动作保持一致 3、人物动作和产品运动应与参考视频逐段对应。所有连续动作必须保持人物、产品、尺度、方向和空间位置一致。产品与人物发生接触时保持真实手部关系和物理惯性。任何跨越字幕、界面或画面区域的物体都位于正确的前景层，并按参考轨迹连续穿过。禁止复制、瞬移、变形、突然缩放、残影、涂抹、白边、额外物体和未经要求的镜头变化。 最终分析完告诉我整体生成费用。  ### Hypit version  0.2.10  ### Coding agent  _No response_  ### Model service  _No response_  ### Logs  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > 我们的 skill 中没有将 HypiHub（Hypit 的官方 api 服务）作为唯一的 provider，这也与我们一向推荐的 BYOK 方式相符。您的 Agent 可能发现了本地已经安装了可以作为视频生成 provider 的其他产品就去使用了，若要使用 Hypit 官方的 HypiHub Provider，可以向您的 agent 明确要求使用 HypiHub OAuth 登录。

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

### Incident Patch 1: `32baae6d` (2026-09-26)
**Commit Message**: fix(cli): resolve packages status the way a Build resolves (#361)

`packages status <name>@<version>` read the machine package home and nothing
else, while the loader finds an external package in two places: the
node_modules chain above whoever requires it, and the machine home addressed by
the version that requirer declares. A package installed where the first half
looks — a pnpm workspace's own node_modules, or the global node_modules a
`npm i -g @hypit/hypit` shares with a `npm i -g @hyperframes/engine` — was
reported `Ready false` and exited 1, and `hypit doctor` then loaded the provider
from it on the next line.

Measured on a global install with an empty machine home, before and after:

  @hyperframes/engine@0.7.101   Ready false, exit 1
  @hyperframes/engine@0.7.101   Ready true,  exit 0
                                Required by   .../packages/provider-hyperframes-local
                                Installation  .../lib/node_modules/@hyperframes/engine

Status now locates the Distribution package that declares the specifier and
asks `locateNodePackage` once, from there — one call covering both places
rather than a second opinion beside the loader, which is how the two c

**File**: `packages/cli/src/commands/environment.ts` (modified, +102/-16)
```diff
@@ -1,8 +1,9 @@
 import { readFile } from "node:fs/promises";
-import { resolve } from "node:path";
+import { join, resolve } from "node:path";
 
+import { distributionPackageDeclaring, locateNodePackage } from "@hypit/package-loader-node";
 import type { NodeRuntimeHost } from "@hypit/runtime-host-node";
-import { hypitHostPackageRoot, inspectHostPackage, prepareHostPackages } from "@hypit/runtime-host-node";
+import { hypitHostPackageRoot, inspectHostPackage, parseRegistryPackageSpec, prepareHostPackages } from "@hypit/runtime-host-node";
 
 import type { CliCommand, EnvironmentCommand } from "../command.js";
 import { commandHint } from "../command-hint.js";
@@ -14,6 +15,68 @@ import { hypitHostStateRoot, hypitProjectStateRoot } from "../paths.js";
 import type { CliManagedProgramProgress, CliManagedProgramReport, CliRuntimeController } from "../runtime-port.js";
 import type { OperationalWriter } from "./types.js";
 
+type PackageStatus = {
+  readonly ready: boolean;
+  readonly declaredBy?: string;
+  readonly installation?: string;
+  readonly installedVersion?: string;
+  readonly detail?: string;
+};
+
+/**
+ * Whether `specifier` will resolve when a Build needs it.
+ *
+ * The loader finds an external package in two places — the node_modules chain above whoever
+ * requires it, and the machine home addressed by the version that requirer declares — and both
+ * start from the requiring package. So the requirer is located first and the loader asked once,
+ * rather than reimplementing either half here: a second opinion is exactly how this command came
+ * to disagree with the thing it reports on.
+ *
+ * Without a Distribution on disk there is no requirer to find, and the machine home remains the
+ * only place this command can speak about.
+ */
+async function packageStatus(
+  specifier: string,
+  hostRoot: string,
+  distributionRoot: string | undefined,
+): Promise<PackageStatus> {
+  const required = parseRegistryPackageSpec(specifier);
+  if (distributionRoot === undefined) {
+    const existing = await inspectHostPackage(specifier, hostRoot);
+    return existing === undefined
+      ? { ready: false, detail: "not installed in the machine package home" }
+      : { ready: true, installation: existing.root, installedVersion: required.version };
+  }
+  const declaring = distributionPackageDeclaring(distributionRoot, required.name, required.version);
+  if (declaring === undefined) {
+    return { ready: false, detail: `no Distribution package declares ${specifier}` };
+  }
+  try {
+    const located = locateNodePackage(required.name, {
+      from: join(declaring, "__hypit_package_status__.mjs"),
+      distributionRoots: [distributionRoot],
+      externalRoots: [hostRoot],
+      allowExternal: true,
+    });
+    const installed = located.manifest.version;
+    return installed === required.version
+      ? { ready: true, declaredBy: declaring, installation: located.root, installedVersion: installed }
+      : {
+        ready: false,
+        declaredBy: declaring,
+        installation: located.root,
+        ...(installed === undefined ? {} : { installedVersion: installed }),
+        detail: `resolved version is ${installed ?? "unknown"}`,
+      };
+  } catch (error) {
+    return {
+      ready: false,
+      declaredBy: declaring,
+      detail: error instanceof Error ? error.message : String(error),
+    };
+  }
+}
+
 function programRecord(item: CliManagedProgramReport) {
   return {
     ...item,
@@ -119,28 +182,51 @@ export async function runEnvironmentCommand(input: {
 
   if (args.command === "packages") {
     const root = hypitHostPackageRoot();
-    const existing = await inspectHostPackage(args.package, root);
-    const reports = args.action === "install"
-      ? await prepareHostPackages([args.package], {
+    if (args.action === "install") {
+      const reports = await prepareHostPackages([args.package], {
         root,
         ...(reportPackageProgress === undefined ? {} : { onProgre
```

**File**: `packages/package-loader-node/src/index.ts` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ export {
 export {
   locateNodePackage,
   NodePackageNotFoundError,
+  distributionPackageDeclaring,
   externalPackageInstallRoot,
   resolveNodePackageExecutable,
   resolveNodePackageResource,
```

**File**: `packages/package-loader-node/src/location.ts` (modified, +41/-0)
```diff
@@ -190,6 +190,47 @@ export function distributionPackageDirectory(root: string, name: string): string
   return undefined;
 }
 
+/**
+ * The Distribution package that declares `name@version` as an external dependency, or undefined
+ * when none does.
+ *
+ * Resolution of an external package starts from whoever requires it — the ancestor walk begins at
+ * that package's directory, and the machine home is addressed by the version that package
+ * declares. A caller holding only `name@version`, as `hypit packages status` does, cannot ask the
+ * question the loader answers until it knows the requirer. Finding it here keeps that one answer
+ * in one place instead of letting each caller approximate it.
+ */
+export function distributionPackageDeclaring(
+  root: string,
+  name: string,
+  version: string,
+): string | undefined {
+  for (const directory of distributionPackageDirectories(root)) {
+    const manifest = join(directory, "package.json");
+    if (!existsSync(manifest)) continue;
+    const value = JSON.parse(readFileSync(manifest, "utf8")) as {
+      dependencies?: Record<string, string>;
+      optionalDependencies?: Record<string, string>;
+    };
+    // npm lets optionalDependencies override dependencies of the same name, and
+    // declaredExternalPackageRoot reads them in that order; match it.
+    const declared = value.optionalDependencies?.[name] ?? value.dependencies?.[name];
+    if (declared === version) return directory;
+  }
+  return undefined;
+}
+
+function* distributionPackageDirectories(root: string): Generator<string> {
+  const base = resolve(root);
+  for (const group of ["packages", "services"]) {
+    const directory = join(base, group);
+    if (!existsSync(directory)) continue;
+    for (const entry of readdirSync(directory, { withFileTypes: true })) {
+      if (entry.isDirectory()) yield join(directory, entry.name);
+    }
+  }
+}
+
 function distributionPackage(root: string, name: string): LocatedNodePackage | undefined {
   const directory = distributionPackageDirectory(root, name);
   return directory === undefined ? nodeModulesPackage(root, name) : readPackage(directory, name);
```

---

### Incident Patch 2: `c80e5137` (2026-09-25)
**Commit Message**: fix(test): declare linkedom as a dev dependency

capture-scope.test.ts imports linkedom, which only resolved locally as a
transitive dependency; CI type checking failed with TS2307.

Co-Authored-By: Claude Code <noreply@anthropic.com>

**File**: `package.json` (modified, +1/-0)
```diff
@@ -284,6 +284,7 @@
     "@hypit/wan": "workspace:*",
     "@hypit/whisperx": "workspace:*",
     "@types/node": "24.10.1",
+    "linkedom": "0.18.13",
     "rollup": "4.62.4",
     "rollup-plugin-dts": "6.2.3",
     "vitepress": "^1.6.4"
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -330,6 +330,9 @@ importers:
       '@types/node':
         specifier: 24.10.1
         version: 24.10.1
+      linkedom:
+        specifier: 0.18.13
+        version: 0.18.13
       rollup:
         specifier: 4.62.4
         version: 4.62.4
```

---

### Incident Patch 3: `78d74360` (2026-09-23)
**Commit Message**: fix(oauth): answer the callback preflight for Chrome Private Network Access

The hosted callback page fetches the loopback from a public page, and
Chrome preflights that with OPTIONS under Private Network Access. Without
the CORS and PNA headers the auto-forward breaks once Chrome sends the
preflight. Answer OPTIONS and add the allow-origin header to the GET and
error responses.

Co-Authored-By: Claude Code <noreply@anthropic.com>

**File**: `packages/cli/src/oauth.ts` (modified, +16/-0)
```diff
@@ -87,6 +87,7 @@ export async function acquireOAuthCredential(
   const verifier = base64url(randomBytes(32));
   // S256 is part of OAuth PKCE. It authenticates this browser exchange; it is not content identity.
   const challenge = base64url(createHash("sha256").update(verifier).digest());
+  const callbackOrigin = new URL(acquisition.redirectUri).origin;
   const nonce = base64url(randomBytes(24));
   let state = nonce;
   const server = createServer();
@@ -97,6 +98,19 @@ export async function acquireOAuthCredential(
       server.unref();
     };
     server.on("request", (request, response) => {
+      // The hosted callback page fetches this loopback from a public page; Chrome's Private
+      // Network Access check preflights with OPTIONS and expects these headers back.
+      if (request.method === "OPTIONS") {
+        response.writeHead(204, {
+          "access-control-allow-origin": callbackOrigin,
+          "access-control-allow-methods": "GET, OPTIONS",
+          "access-control-allow-private-network": "true",
+          "cache-control": "no-store",
+          connection: "close",
+        });
+        response.end();
+        return;
+      }
       if (settled) {
         response.writeHead(204, { "cache-control": "no-store", connection: "close" });
         response.end();
@@ -111,6 +125,7 @@ export async function acquireOAuthCredential(
         const code = url.searchParams.get("code");
         if (code === null || code.length === 0) throw new Error("OAuth callback contained no code");
         response.writeHead(200, {
+          "access-control-allow-origin": callbackOrigin,
           "cache-control": "no-store",
           connection: "close",
           "content-type": "text/html; charset=utf-8",
@@ -120,6 +135,7 @@ export async function acquireOAuthCredential(
         resolveCode(code);
       } catch (error) {
         response.writeHead(400, {
+          "access-control-allow-origin": callbackOrigin,
           "cache-control": "no-store",
           connection: "close",
           "content-type": "text/html; charset=utf-8",
```

---

### Incident Patch 4: `66a35294` (2026-09-23)
**Commit Message**: fix(oauth): return sign-in through the hosted callback page (#349)

fix(oauth): return sign-in through the hosted callback page (#349)

**File**: `packages/cli/src/oauth.ts` (modified, +6/-2)
```diff
@@ -87,7 +87,8 @@ export async function acquireOAuthCredential(
   const verifier = base64url(randomBytes(32));
   // S256 is part of OAuth PKCE. It authenticates this browser exchange; it is not content identity.
   const challenge = base64url(createHash("sha256").update(verifier).digest());
-  const state = base64url(randomBytes(24));
+  const nonce = base64url(randomBytes(24));
+  let state = nonce;
   const server = createServer();
   const callback = new Promise<string>((resolveCode, reject) => {
     let settled = false;
@@ -140,7 +141,10 @@ export async function acquireOAuthCredential(
   });
   const address = server.address();
   if (address === null || typeof address === "string") throw new Error("could not open a local OAuth callback");
-  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
+  // The hosted callback page forwards the code to this port when the browser shares this host;
+  // otherwise the page shows `code#state` for the user to deliver to this port themselves.
+  state = `${nonce}.${address.port}`;
+  const redirectUri = acquisition.redirectUri;
   const authorize = new URL(acquisition.authorizationEndpoint);
   authorize.searchParams.set("response_type", "code");
   authorize.searchParams.set("client_id", acquisition.clientId);
```

**File**: `packages/cli/test/oauth.test.ts` (modified, +12/-5)
```diff
@@ -14,15 +14,22 @@ import { acquireOAuthCredential, authorizeBrowserLaunch } from "../src/oauth.js"
 const acquisition = {
   kind: "oauth2-pkce" as const,
   authorizationEndpoint: "https://identity.example.test/authorize",
+  redirectUri: "https://identity.example.test/callback",
   tokenEndpoint: "https://identity.example.test/token",
   clientId: "client",
   scopes: ["work"],
   requestTimeoutMs: 1_000,
 };
 
+/** Where the hosted callback page forwards the code: the port packed after the last `.` of state. */
+function loopbackCallback(authorization: URL): URL {
+  const state = authorization.searchParams.get("state")!;
+  return new URL(`http://127.0.0.1:${state.slice(state.lastIndexOf(".") + 1)}/callback`);
+}
+
 function returnAuthorization(url: string, page: (html: string) => void): void {
   const authorization = new URL(url);
-  const redirect = new URL(authorization.searchParams.get("redirect_uri")!);
+  const redirect = loopbackCallback(authorization);
   redirect.searchParams.set("state", authorization.searchParams.get("state")!);
   redirect.searchParams.set("code", "authorization-code");
   void globalThis.fetch(redirect).then(async (response) => {
@@ -60,8 +67,7 @@ test("OAuth callback releases another browser connection after sending its page"
   let browserConnection: ReturnType<typeof createConnection> | undefined;
   const raw = await acquireOAuthCredential(acquisition, {
     open: (url) => {
-      const authorization = new URL(url);
-      const redirect = new URL(authorization.searchParams.get("redirect_uri")!);
+      const redirect = loopbackCallback(new URL(url));
       browserConnection = createConnection({ host: redirect.hostname, port: Number(redirect.port) });
       void once(browserConnection, "connect").then(() => {
         browserConnection!.write(`GET /favicon.ico HTTP/1.1\r\nHost: ${redirect.host}\r\n`);
@@ -150,8 +156,9 @@ const value = await acquireOAuthCredential(${JSON.stringify(acquisition)}, {
   onProgress(message) {
     if (!message.startsWith("Opening sign-in: ")) return;
     const authorize = new URL(message.slice("Opening sign-in: ".length));
-    const callback = new URL(authorize.searchParams.get("redirect_uri"));
-    callback.searchParams.set("state", authorize.searchParams.get("state"));
+    const state = authorize.searchParams.get("state");
+    const callback = new URL("http://127.0.0.1:" + state.slice(state.lastIndexOf(".") + 1) + "/callback");
+    callback.searchParams.set("state", state);
     callback.searchParams.set("code", "manual-code");
     setTimeout(() => { void fetch(callback); }, 50);
   },
```

**File**: `packages/provider-hypihub/src/provider.ts` (modified, +1/-0)
```diff
@@ -607,6 +607,7 @@ export function createHypiHubProvider(options: CreateHypiHubProviderOptions = {}
       acquisition: {
         kind: "oauth2-pkce",
         authorizationEndpoint: new URL("/oauth/consent", oauthOrigin).toString(),
+        redirectUri: new URL("/oauth/callback", oauthOrigin).toString(),
         tokenEndpoint: new URL("/oauth/token", oauthOrigin).toString(),
         clientId: "hyc_d5d5e8e7131b0c877756e66c",
         scopes: ["user:profile", "user:inference"],
```

**File**: `packages/runtime/src/credentials.ts` (modified, +2/-0)
```diff
@@ -43,6 +43,8 @@ export function decodeOAuth2Credential(secret: string): OAuth2Credential | undef
 export type CredentialAcquisition = {
   readonly kind: "oauth2-pkce";
   readonly authorizationEndpoint: string;
+  /** Service-hosted page that shows the code and forwards it to the port packed into `state`. */
+  readonly redirectUri: string;
   readonly tokenEndpoint: string;
   readonly clientId: string;
   readonly scopes: readonly string[];
```

**File**: `skills/hypit/references/environment/model-and-provider.md` (modified, +10/-3)
```diff
@@ -108,9 +108,16 @@ For the selected account:
 hypit auth login hypihub.default
 ```
 
-The Endpoint opens its browser authorization flow and the CLI reports completion after the credential
-is stored. That connection can serve the supported models; login is not repeated per Model. This is
-the integrated account setup, not a promise to install local tools or make every model free.
+Run it as a background task and send the user the URL after `Opening sign-in:` in its output. Ask
+them to authorize and, if the login does not finish on its own, to send back the `<code>#<state>`
+shown on the callback page. The login is done when the CLI reports the credential stored. If the
+user sends `<code>#<state>` while the login is still waiting, deliver it with
+`curl "http://127.0.0.1:<port>/callback?code=<code>&state=<state>"`, where `<port>` is the digits
+after the last `.` in `<state>`. The code works once and only for the waiting login process, so
+passing it through the conversation does not expose the credential.
+
+That connection can serve the supported models; login is not repeated per Model. This is the
+integrated account setup, not a promise to install local tools or make every model free.
 A callback page alone does not prove the CLI finished storing the credential.
 
 To use a HypiHub static API key instead, explicitly import a private file supplied through a secure
```

---

### Incident Patch 5: `59d5e296` (2026-09-23)
**Commit Message**: fix: round mux duration to the PCM sample boundary (#339)

**File**: `packages/media-pipeline/src/component.ts` (modified, +5/-3)
```diff
@@ -1,4 +1,4 @@
-import { verifyMediaFrameRange } from "@hypit/media";
+import { mediaFrameRangeSamples, verifyMediaFrameRange } from "@hypit/media";
 import { mediaComponent } from "@hypit/media";
 import { plannedNeedInputs } from "@hypit/component-kit";
 import type { ComponentPackage, PlannedNeedFacet } from "@hypit/component-kit";
@@ -344,8 +344,10 @@ export const mediaPipelineComponent = {
         const audio = inline(inputs.audio!.value, "TimelineAudio");
         verifyRenderedVisual(visual);
         verifyTimelineAudio(audio);
-        if (visual.frameCount * visual.frameRate.denominator * 48_000
-          !== audio.sampleFrames * visual.frameRate.numerator) {
+        const { sampleFrames } = mediaFrameRangeSamples(
+          { startFrame: 0, endFrameExclusive: visual.frameCount }, visual.frameRate,
+        );
+        if (audio.sampleFrames !== sampleFrames) {
           throw new Error("Rendered visual and TimelineAudio have different presentation durations");
         }
         const need: MuxMediaNeed = { visual, audio };
```

**File**: `packages/media-pipeline/test/mux.test.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { sealRenderedVisual, sealTimelineAudio } from "@hypit/media";
+import { fixtureResource } from "../../../test/fixture-resource.js";
+import { mediaPipelineComponent } from "../src/component.js";
+import { mediaPipelineProducers } from "../src/manifest.js";
+
+const mux = mediaPipelineComponent.producers.find((item) => item.producer.name === mediaPipelineProducers.mux.name)!;
+
+const cases = [
+  { frameRate: { numerator: 30, denominator: 1 }, frameCount: 149, sampleFrames: 238400 },
+  { frameRate: { numerator: 24000, denominator: 1001 }, frameCount: 149, sampleFrames: 298298 },
+  { frameRate: { numerator: 30000, denominator: 1001 }, frameCount: 149, sampleFrames: 238638 },
+  { frameRate: { numerator: 30000, denominator: 1001 }, frameCount: 1, sampleFrames: 1602 },
+  { frameRate: { numerator: 60000, denominator: 1001 }, frameCount: 1, sampleFrames: 801 },
+];
+
+for (const { frameRate, frameCount, sampleFrames } of cases) {
+  test(`mux accepts the nearest PCM sample boundary for ${frameCount} frames at ${frameRate.numerator}/${frameRate.denominator}`, async () => {
+    const visual = sealRenderedVisual({ frameRate, frameCount, canvas: { width: 540, height: 960 },
+      artifact: { kind: "blob", resource: fixtureResource("mux:visual"), size: 1, mediaType: "video/mp4" } });
+    const run = (samples: number) => {
+      const audio = sealTimelineAudio({ sampleFrames: samples,
+        artifact: { kind: "blob", resource: fixtureResource("mux:audio"), size: 1, mediaType: "audio/wav" } });
+      return mux.handler({ inputs: {
+        visual: { value: { kind: "inline", value: visual } },
+        audio: { value: { kind: "inline", value: audio } },
+      } } as never);
+    };
+    const result = await run(sampleFrames);
+    assert.deepEqual(Object.keys(result.needs), ["media"]);
+    for (const incorrect of [sampleFrames - 1, sampleFrames + 1]) {
+      await assert.rejects(async () => run(incorrect), /different presentation durations/u);
+    }
+  });
+}
```

---

### Incident Patch 6: `465bef7e` (2026-09-23)
**Commit Message**: fix: encode HyperFrames renders with BT.709 and tag the output (#342)

The local provider converted sRGB PNG frames to yuv420p without choosing a
matrix or writing color metadata, so FFmpeg used BT.601 while players decode
untagged HD video as BT.709. Convert with BT.709 and tag the stream.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `packages/provider-hyperframes-local/src/capture.ts` (modified, +4/-1)
```diff
@@ -255,7 +255,10 @@ export async function captureStagedVisual(input: CaptureInput, controller: Abort
     await runProcess({ executable: ffmpegPath,
       argv: ["-v", "error", "-y", "-framerate", `${fps.num}/${fps.den}`, "-i", join(outputFrames, "%09d.png"),
         "-frames:v", String(frameCount), "-an", "-c:v", "libx264", "-crf", String(crf),
-        "-preset", config.quality === "draft" ? "veryfast" : "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output],
+        "-preset", config.quality === "draft" ? "veryfast" : "medium",
+        // Chromium composites in sRGB: convert with the BT.709 matrix and tag the stream so players decode it the same way.
+        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
+        "-movflags", "+faststart", output],
       timeoutMs: config.processTimeoutMs, maxOutputBytes: config.maxProcessOutputBytes, signal });
     const outputStat = await stat(output);
     assert(outputStat.size > 0 && outputStat.size <= config.maxRenderedBytes, "HyperFrames output is empty or exceeds its byte limit");
```

---

### Incident Patch 7: `7e03b01a` (2026-09-23)
**Commit Message**: fix: include bundled packages in vocabulary listings (#345)

**File**: `packages/video-cli/src/vocabulary.ts` (modified, +13/-12)
```diff
@@ -65,15 +65,14 @@ export type PackageListing = {
 };
 
 export async function listPackages(projectRoot: string): Promise<readonly PackageListing[]> {
-  // Every scope, and the project's own directory, from both the project's node_modules and the
-  // Distribution's: the packages a project does not carry are in the Distribution, and the ones it
-  // does are beside it.
+  // Discover installed scopes and unlinked packages in both the project and the Distribution.
   const roots = [...new Set([
-    join(projectRoot, "node_modules"),
-    ...(videoCliDistribution.packageRoot === undefined ? [] : [join(videoCliDistribution.packageRoot, "node_modules")]),
+    projectRoot,
+    ...(videoCliDistribution.packageRoot === undefined ? [] : [videoCliDistribution.packageRoot]),
   ])];
   const candidates: { readonly name: string; readonly directory: string }[] = [];
-  for (const modules of roots) {
+  for (const root of roots) {
+    const modules = join(root, "node_modules");
     const scopes = (await readdir(modules, { withFileTypes: true }).catch(() => []))
       .filter((entry) => entry.isDirectory() && entry.name.startsWith("@"))
       .map((entry) => entry.name)
@@ -85,12 +84,14 @@ export async function listPackages(projectRoot: string): Promise<readonly Packag
       }
     }
   }
-  // A project's own packages are its `packages/<name>/`, where the loader finds them by name whether
-  // or not a package manager linked them.
-  for (const entry of (await readdir(join(projectRoot, "packages")).catch(() => [] as string[])).sort()) {
-    const directory = join(projectRoot, "packages", entry);
-    const own = await readJson<{ readonly name?: string }>(join(directory, "package.json"));
-    if (own?.name !== undefined && !candidates.some((item) => item.name === own.name)) candidates.push({ name: own.name, directory });
+  // The loader also finds packages by name under `packages/<name>/`, even without package-manager
+  // links. Published Distributions carry their built-in packages here.
+  for (const root of roots) {
+    for (const entry of (await readdir(join(root, "packages")).catch(() => [] as string[])).sort()) {
+      const directory = join(root, "packages", entry);
+      const own = await readJson<{ readonly name?: string }>(join(directory, "package.json"));
+      if (own?.name !== undefined && !candidates.some((item) => item.name === own.name)) candidates.push({ name: own.name, directory });
+    }
   }
   const listing: PackageListing[] = [];
   for (const { name, directory } of candidates) {
```

**File**: `packages/video-cli/test/vocabulary.test.ts` (modified, +70/-1)
```diff
@@ -1,10 +1,14 @@
 import assert from "node:assert/strict";
-import { basename, dirname, resolve } from "node:path";
+import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
+import { tmpdir } from "node:os";
+import { basename, dirname, join, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import test from "node:test";
 
 import type { CliIo } from "@hypit/cli";
+import { markupSurfaceHostFacetAbi } from "@hypit/markup";
 
+import { videoCliDistribution } from "../src/distribution.js";
 import { listPackages, listSurfaces, runVocabularyCli, visualSchema } from "../src/vocabulary.js";
 
 const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
@@ -24,12 +28,77 @@ function io(): { readonly io: CliIo; text: () => string } {
 
 test("the listing sees every activatable package from the repository root", async () => {
   const listing = await listPackages(repositoryRoot);
+  assert.equal(new Set(listing.map((item) => item.name)).size, listing.length);
   const pipeline = listing.find((item) => item.name === "@hypit/media-pipeline");
   assert.ok(pipeline !== undefined, "media-pipeline is listed");
   assert.ok(pipeline.tags.includes("StillVideo"), `tags: ${pipeline.tags.join(", ")}`);
   assert.equal(pipeline.unreadable, undefined);
 });
 
+test("vocabulary discovers bundled packages from a separate project without node_modules", async () => {
+  const root = await mkdtemp(join(tmpdir(), "hypit-vocabulary-"));
+  const project = join(root, "project");
+  const distribution = join(root, "distribution");
+  const originalRoot = Object.getOwnPropertyDescriptor(videoCliDistribution, "packageRoot")!;
+  async function packageAt(directory: string, name: string, description = name): Promise<void> {
+    await mkdir(directory, { recursive: true });
+    await writeFile(join(directory, "package.json"), JSON.stringify({
+      name, version: "1.0.0", type: "module", description,
+      hypit: { activation: "./activation.mjs" },
+    }));
+    await writeFile(join(directory, "activation.mjs"), `export default {
+      format: "hypit.node-package@1",
+      hostFacets: [{
+        abi: ${JSON.stringify(markupSurfaceHostFacetAbi)},
+        implementation: {
+          module: { name: ${JSON.stringify(name)}, version: "1" },
+          surface: "card", tag: "Card", mode: "raw", outputs: [], handler: () => [],
+        },
+      }],
+    };`);
+  }
+  try {
+    await mkdir(project, { recursive: true });
+    await writeFile(join(project, "package.json"), JSON.stringify({ name: "example-project", private: true }));
+    const bundled = join(distribution, "packages", "bundled");
+    await packageAt(bundled, "@hypit/bundled");
+    await writeFile(join(bundled, "README.md"), "Example bundled component.\n");
+    await mkdir(join(distribution, "packages", "inactive"), { recursive: true });
+    await writeFile(join(distribution, "packages", "inactive", "package.json"), JSON.stringify({ name: "@hypit/inactive" }));
+    Object.defineProperty(videoCliDistribution, "packageRoot", { value: distribution });
+
+    const human = io();
+    await runVocabularyCli(["vocabulary"], human.io, project);
+    assert.match(human.text(), /@hypit\/bundled\n\s+tags: Card/u);
+    const json = io();
+    await runVocabularyCli(["vocabulary", "--json"], json.io, project);
+    assert.deepEqual(JSON.parse(json.text()).packages, [{
+      name: "@hypit/bundled", description: "@hypit/bundled", tags: ["Card"],
+    }]);
+
+    const named = io();
+    await runVocabularyCli(["vocabulary", "@hypit/bundled", "--tag", "Card", "--json"], named.io, project);
+    const surfaces = JSON.parse(named.text()).surfaces;
+    assert.equal(surfaces.length, 1);
+    assert.equal(surfaces[0].package, "@hypit/bundled");
+    assert.equal(surfaces[0].tag, "Card");
+    assert.equal(basename(surfaces[0].readme), "README.md");
+
+    // Workspace links and project components must not duplicate the bundled listing.
+    aw
```

---

### Incident Patch 8: `ecf69e4c` (2026-09-23)
**Commit Message**: fix: ignore album artwork in media probes (#347)

**File**: `packages/video-cli/src/media.ts` (modified, +6/-3)
```diff
@@ -157,13 +157,16 @@ function requireVideo(info: MediaProbe, path: string): asserts info is MediaProb
 
 export async function probeMedia(path: string): Promise<MediaProbe> {
   const raw = await runProcess("ffprobe", [
-    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", path,
+    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate:stream_disposition=attached_pic", "-of", "json", path,
   ]);
   const parsed = JSON.parse(raw.toString("utf8")) as {
     format?: { duration?: string };
-    streams?: readonly { codec_type?: string; width?: number; height?: number; r_frame_rate?: string }[];
+    streams?: readonly {
+      codec_type?: string; width?: number; height?: number; r_frame_rate?: string;
+      disposition?: { attached_pic?: number };
+    }[];
   };
-  const video = parsed.streams?.find((item) => item.codec_type === "video");
+  const video = parsed.streams?.find((item) => item.codec_type === "video" && item.disposition?.attached_pic !== 1);
   const duration = Number(parsed.format?.duration);
   assert(Number.isFinite(duration) && duration > 0, `${path}: duration is unavailable`);
   const hasAudio = parsed.streams?.some((item) => item.codec_type === "audio") ?? false;
```

**File**: `packages/video-cli/test/media.test.ts` (modified, +41/-0)
```diff
@@ -135,6 +135,47 @@ test("fetch refuses anything but an http link and an explicit video destination"
   await assert.rejects(runMediaCli(["media", "fetch", "https://example.com/v", "--to", "x.txt"], io().io, tmpdir()), /must end in/);
 });
 
+test("album artwork does not turn an audio cut into video", { skip: !ffmpeg && "ffmpeg is not installed" }, async () => {
+  const work = await mkdtemp(join(tmpdir(), "hypit-covered-audio-"));
+  try {
+    const audio = join(work, "plain.mp3");
+    const artwork = join(work, "cover.jpg");
+    const covered = join(work, "covered.mp3");
+    const tone = spawnSync("ffmpeg", [
+      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
+      "sine=frequency=440:duration=1", "-c:a", "libmp3lame", audio,
+    ], { encoding: "utf8" });
+    assert.equal(tone.status, 0, tone.stderr);
+    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#ee3344" } }).jpeg().toFile(artwork);
+    const attach = spawnSync("ffmpeg", [
+      "-hide_banner", "-loglevel", "error", "-y", "-i", audio, "-i", artwork,
+      "-map", "0:a:0", "-map", "1:v:0", "-c", "copy", "-id3v2_version", "3",
+      "-disposition:v:0", "attached_pic", covered,
+    ], { encoding: "utf8" });
+    assert.equal(attach.status, 0, attach.stderr);
+
+    for (const [index, source] of [audio, covered].entries()) {
+      const info = await probeMedia(source);
+      assert.equal(info.hasAudio, true);
+      assert.equal(info.hasVideo, false, "album artwork is not a timed video stream");
+      const output = join(work, `cut-${index}.wav`);
+      const cut = io();
+      await runMediaCli(["media", "cut", source, "--start", "0", "--end", "0.5", "--to", output, "--json"], cut.io, work);
+      const result = JSON.parse(cut.text()) as { hasVideo: boolean; hasAudio: boolean; actualSeconds: number };
+      assert.equal(result.hasVideo, false);
+      assert.equal(result.hasAudio, true);
+      assert.ok(Math.abs(result.actualSeconds - 0.5) < 0.01);
+      const probe = spawnSync("ffprobe", [
+        "-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "json", output,
+      ], { encoding: "utf8" });
+      assert.equal(probe.status, 0, probe.stderr);
+      assert.deepEqual(JSON.parse(probe.stdout).streams, [{ codec_name: "pcm_s24le", codec_type: "audio" }]);
+    }
+  } finally {
+    await rm(work, { recursive: true, force: true });
+  }
+});
+
 test("cut prepares recorded audio and joined video without changing the existing evidence cut", { skip: !ffmpeg && "ffmpeg is not installed" }, async () => {
   const work = await mkdtemp(join(tmpdir(), "hypit-recorded-cut-"));
   try {
```

---

### Incident Patch 9: `ec6f2083` (2026-09-21)
**Commit Message**: fix(endpoint-kit): share the poll error decision across asynchronous Providers (#337)

endpoint-kit now defines the error classes a Provider transport throws
(EndpointTransportError, EndpointHttpError with status and retryAfterMs,
EndpointResponseError, EndpointServiceError) and one decision,
pollAgainOrFail: transport errors and HTTP 429/5xx keep the job pending
for the next poll, honouring Retry-After when given; every other error,
including missing credentials and unusable responses, fails the job.

The six asynchronous Providers (hypihub, beatapi, hiapi, pollo, monid,
tokendance) throw those classes from their request code and route their
poll catch through pollAgainOrFail, replacing the per-Provider status
check that failed on 429 and retried configuration errors until the
operation deadline.

**File**: `packages/endpoint-kit/src/index.ts` (modified, +47/-0)
```diff
@@ -492,3 +492,50 @@ export function wakeAfter(
     ...(progress === undefined ? {} : { progress }),
   };
 }
+
+/** A service reported a failure with a stable code. */
+export class EndpointServiceError extends Error {
+  constructor(readonly code: string, message: string) { super(message); }
+}
+/** A non-success HTTP response, with the wait the service asked for when it gave one. */
+export class EndpointHttpError extends EndpointServiceError {
+  constructor(code: string, message: string, readonly status: number, readonly retryAfterMs?: number) { super(code, message); }
+}
+/** The request produced no response: connection failure, interrupted read, or request timeout. */
+export class EndpointTransportError extends Error {}
+/** A success response whose body cannot be used. */
+export class EndpointResponseError extends Error {}
+
+/** Report a rejected send or read as a transport error. */
+export async function transport<T>(request: Promise<T>): Promise<T> {
+  try { return await request; } catch (error) {
+    if (error instanceof EndpointTransportError) throw error;
+    throw new EndpointTransportError(error instanceof Error ? error.message : String(error), { cause: error });
+  }
+}
+
+/** The wait a `Retry-After` header asks for, in milliseconds; either delay-seconds or an HTTP-date. */
+export function retryAfterMs(headers: Headers, now = Date.now()): number | undefined {
+  const value = headers.get("retry-after")?.trim();
+  if (value === undefined || value.length === 0) return undefined;
+  const delay = /^\d+$/u.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
+  return Number.isFinite(delay) ? Math.max(0, Math.round(delay)) : undefined;
+}
+
+/**
+ * Decide a poll action's outcome from the error it threw. Transport errors and HTTP 429/5xx keep the
+ * job pending for the next poll; every other error, including credential and response errors, fails it.
+ */
+export function pollAgainOrFail(error: unknown, options: {
+  readonly handle: CanonicalValue;
+  readonly pollIntervalMs: number;
+  readonly failure: (error: unknown) => EndpointOutcome;
+}): EndpointOutcome {
+  if (error instanceof EndpointTransportError) {
+    return wakeAfter(options.handle, options.pollIntervalMs, Date.now(), { phase: "retrying" });
+  }
+  if (error instanceof EndpointHttpError && (error.status === 429 || error.status >= 500)) {
+    return wakeAfter(options.handle, error.retryAfterMs ?? options.pollIntervalMs, Date.now(), { phase: "retrying" });
+  }
+  return options.failure(error);
+}
```

**File**: `packages/provider-beatapi/src/errors.ts` (modified, +7/-6)
```diff
@@ -1,3 +1,5 @@
+import { EndpointHttpError, EndpointServiceError } from "@hypit/endpoint-kit";
+
 /** BeatAPI's `{ error: { code, message, request_id, retry_after_seconds } }` envelope and terminal task errors. */
 function record(value: unknown): Record<string, unknown> | undefined {
   return value !== null && typeof value === "object" && !Array.isArray(value)
@@ -12,12 +14,10 @@ export function safeBeatApiReason(value: string): string {
   return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
 }
 
-export class BeatApiServiceError extends Error {
-  constructor(readonly code: string, message: string) { super(message); }
-}
+export class BeatApiServiceError extends EndpointServiceError {}
 
-export class BeatApiHttpError extends BeatApiServiceError {
-  constructor(readonly status: number, response: { readonly headers: Headers }, bodyText: string,
+export class BeatApiHttpError extends EndpointHttpError {
+  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
     request: { readonly method: string; readonly path: string; readonly model?: string }) {
     let body: Record<string, unknown> | undefined;
     try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON gateway failures still have HTTP evidence. */ }
@@ -32,7 +32,8 @@ export class BeatApiHttpError extends BeatApiServiceError {
       ...(requestId === undefined ? [] : [`request=${requestId}`]),
       ...(retryAfter === undefined ? [] : [`retry-after=${retryAfter}s`]),
     ];
-    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeBeatApiReason(reason)}`}`);
+    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeBeatApiReason(reason)}`}`,
+      status, retryAfter === undefined ? undefined : Math.round(retryAfter * 1000));
   }
 }
 
```

**File**: `packages/provider-beatapi/src/provider.ts` (modified, +10/-16)
```diff
@@ -1,6 +1,6 @@
 import { requestDeadline } from "@hypit/runtime-kit";
 import type { AsyncEndpoint, EndpointCredential, EndpointInvocationContext, EndpointOutcome } from "@hypit/endpoint-kit";
-import { defineEndpointPackage, wakeAfter } from "@hypit/endpoint-kit";
+import { EndpointResponseError, EndpointServiceError, EndpointTransportError, defineEndpointPackage, pollAgainOrFail, transport, wakeAfter } from "@hypit/endpoint-kit";
 import type { GenerationArtifactUrlResolver } from "@hypit/generation";
 import { canonicalize } from "@hypit/protocol";
 import type { BlobRef, CapabilityRef } from "@hypit/protocol";
@@ -75,26 +75,26 @@ function failureMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
 }
 function failure(error: unknown): EndpointOutcome {
-  return { status: "failed", failure: { code: error instanceof BeatApiServiceError ? error.code : "BEATAPI_ERROR", message: failureMessage(error) } };
+  return { status: "failed", failure: { code: error instanceof EndpointServiceError ? error.code : "BEATAPI_ERROR", message: failureMessage(error) } };
 }
 
 class BeatApiClient {
   constructor(readonly baseUrl: string, readonly timeout: number, readonly fetcher: typeof globalThis.fetch) {}
   async json(path: string, key: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
-    const deadline = requestDeadline(this.timeout);
+    const deadline = requestDeadline(this.timeout, () => new EndpointTransportError("BeatAPI request timed out"));
     try {
-      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
+      const response = await transport(deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
         ...init, signal: deadline.signal, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
-      }));
-      const text = await deadline.wait(response.text());
+      })));
+      const text = await transport(deadline.wait(response.text()));
       if (!response.ok) {
         const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
         throw new BeatApiHttpError(response.status, response, text, {
           method: init.method ?? "GET", path, ...(typeof input?.model === "string" ? { model: input.model } : {}),
         });
       }
       let body: unknown;
-      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`BeatAPI returned invalid JSON (${response.status})`); }
+      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`BeatAPI returned invalid JSON (${response.status})`); }
       return object(object(body, "BeatAPI response").data, "BeatAPI response data");
     } finally { deadline.finish(); }
   }
@@ -154,7 +154,7 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         try {
           body = await request.compile(resolverFor(client, context, publicAssetUrl));
         } catch (error) {
-          throw new BeatApiServiceError(error instanceof BeatApiServiceError ? error.code : "BEATAPI_ERROR",
+          throw new BeatApiServiceError(error instanceof EndpointServiceError ? error.code : "BEATAPI_ERROR",
             `BeatAPI request preparation failed; model=${request.model}; generation not submitted: ${failureMessage(error)}`);
         }
         await context.reportProgress?.({ phase: `Submitting BeatAPI request: ${request.model}` });
@@ -181,13 +181,7 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "BEATAPI_OPERATION_TIMEOUT", message: `BeatAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        let task: Record<string, unknown>;
-        try {
-          task = await client.json(`/v1/t
```

**File**: `packages/provider-hiapi/src/errors.ts` (modified, +6/-6)
```diff
@@ -1,3 +1,5 @@
+import { EndpointHttpError, EndpointServiceError } from "@hypit/endpoint-kit";
+
 /** HiAPI's `{ code, message, error_code }` envelope and task `error` object, kept at the service boundary. */
 function record(value: unknown): Record<string, unknown> | undefined {
   return value !== null && typeof value === "object" && !Array.isArray(value)
@@ -12,12 +14,10 @@ export function safeHiApiReason(value: string): string {
   return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
 }
 
-export class HiApiServiceError extends Error {
-  constructor(readonly code: string, message: string) { super(message); }
-}
+export class HiApiServiceError extends EndpointServiceError {}
 
-export class HiApiHttpError extends HiApiServiceError {
-  constructor(readonly status: number, response: { readonly headers: Headers }, bodyText: string,
+export class HiApiHttpError extends EndpointHttpError {
+  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
     request: { readonly method: string; readonly path: string; readonly model?: string }) {
     let body: Record<string, unknown> | undefined;
     try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON gateway failures still have HTTP evidence. */ }
@@ -29,7 +29,7 @@ export class HiApiHttpError extends HiApiServiceError {
       ...(request.model === undefined ? [] : [`model=${request.model}`]),
       ...(requestId === undefined ? [] : [`request=${requestId}`]),
     ];
-    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeHiApiReason(reason)}`}`);
+    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeHiApiReason(reason)}`}`, status);
   }
 }
 
```

**File**: `packages/provider-hiapi/src/provider.ts` (modified, +10/-16)
```diff
@@ -1,6 +1,6 @@
 import { requestDeadline } from "@hypit/runtime-kit";
 import type { AsyncEndpoint, EndpointCredential, EndpointInvocationContext, EndpointOutcome } from "@hypit/endpoint-kit";
-import { defineEndpointPackage, wakeAfter } from "@hypit/endpoint-kit";
+import { EndpointResponseError, EndpointServiceError, EndpointTransportError, defineEndpointPackage, pollAgainOrFail, transport, wakeAfter } from "@hypit/endpoint-kit";
 import type { GenerationArtifactUrlResolver } from "@hypit/generation";
 import { canonicalize } from "@hypit/protocol";
 import type { BlobRef, CapabilityRef } from "@hypit/protocol";
@@ -56,26 +56,26 @@ function failureMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
 }
 function failure(error: unknown): EndpointOutcome {
-  return { status: "failed", failure: { code: error instanceof HiApiServiceError ? error.code : "HIAPI_ERROR", message: failureMessage(error) } };
+  return { status: "failed", failure: { code: error instanceof EndpointServiceError ? error.code : "HIAPI_ERROR", message: failureMessage(error) } };
 }
 
 class HiApiClient {
   constructor(readonly baseUrl: string, readonly timeout: number, readonly fetcher: typeof globalThis.fetch) {}
   async json(path: string, key: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
-    const deadline = requestDeadline(this.timeout);
+    const deadline = requestDeadline(this.timeout, () => new EndpointTransportError("HiAPI request timed out"));
     try {
-      const response = await deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
+      const response = await transport(deadline.wait(this.fetcher(`${this.baseUrl}${path}`, {
         ...init, signal: deadline.signal, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
-      }));
-      const text = await deadline.wait(response.text());
+      })));
+      const text = await transport(deadline.wait(response.text()));
       if (!response.ok) {
         const input = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
         throw new HiApiHttpError(response.status, response, text, {
           method: init.method ?? "GET", path, ...(typeof input?.model === "string" ? { model: input.model } : {}),
         });
       }
       let body: unknown;
-      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new Error(`HiAPI returned invalid JSON (${response.status})`); }
+      try { body = text.length === 0 ? {} : JSON.parse(text); } catch { throw new EndpointResponseError(`HiAPI returned invalid JSON (${response.status})`); }
       return object(object(body, "HiAPI response").data, "HiAPI response data");
     } finally { deadline.finish(); }
   }
@@ -130,7 +130,7 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         try {
           body = await request.compile(resolverFor(request.mediaLimits, context, publicAssetUrl));
         } catch (error) {
-          throw new HiApiServiceError(error instanceof HiApiServiceError ? error.code : "HIAPI_ERROR",
+          throw new HiApiServiceError(error instanceof EndpointServiceError ? error.code : "HIAPI_ERROR",
             `HiAPI request preparation failed; model=${request.model}; generation not submitted: ${failureMessage(error)}`);
         }
         await context.reportProgress?.({ phase: `Submitting HiAPI request: ${request.model}` });
@@ -155,13 +155,7 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "HIAPI_OPERATION_TIMEOUT", message: `HiAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        let task: Record<string, unknown>;
-        try {
-          task = await client.json(`/v1/tasks/${encodeURIComponent
```

---

### Incident Patch 10: `636270fe` (2026-09-21)
**Commit Message**: fix(providers): keep async jobs pending when a progress poll hits a transport error (#336)

A single failed status request (5xx such as 522, connection failure, or
request timeout) in poll() was returned as a failed operation, so the
driver stopped polling while the remote job continued to run and settle.
The job is now kept pending and polled again after pollIntervalMs; 4xx
responses still fail the operation, and operationTimeoutMs remains the
upper bound.

Applies to hypihub, beatapi, hiapi, pollo, monid and tokendance.

**File**: `packages/provider-beatapi/src/provider.ts` (modified, +7/-1)
```diff
@@ -181,7 +181,13 @@ function endpoint(client: BeatApiClient, pollIntervalMs: number, maxOperationMs:
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "BEATAPI_OPERATION_TIMEOUT", message: `BeatAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        let task: Record<string, unknown>;
+        try {
+          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof BeatApiHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(task.status);
         if (pendingStatuses.includes(status)) {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

**File**: `packages/provider-hiapi/src/provider.ts` (modified, +7/-1)
```diff
@@ -155,7 +155,13 @@ function endpoint(client: HiApiClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "HIAPI_OPERATION_TIMEOUT", message: `HiAPI task ${handle.taskId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        let task: Record<string, unknown>;
+        try {
+          task = await client.json(`/v1/tasks/${encodeURIComponent(handle.taskId)}`, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof HiApiHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(task.status);
         if (status === "queued" || status === "handling" || status === "archiving") {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

**File**: `packages/provider-hypihub/src/provider.ts` (modified, +8/-1)
```diff
@@ -494,7 +494,14 @@ function endpoint(client: HypiHubClient, pollIntervalMs: number, maxOperationMs:
             receipt: { id: handle.jobId },
             failure: { code: "HYPIHUB_OPERATION_TIMEOUT", message: `HypiHub job ${handle.jobId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client)); const status = job.status;
+        let job: Record<string, unknown>;
+        try {
+          job = await client.json(`/jobs/${encodeURIComponent(handle.jobId)}`, authFor(context, client));
+        } catch (error) {
+          if (error instanceof HypiHubHttpError && error.status < 500) return failure(error);
+          return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" });
+        }
+        const status = job.status;
         if (status === "queued" || status === "running" || status === "in_progress") return wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: String(status) });
         const rejected = hypiHubJobFailure(job, handle.jobId);
         if (rejected !== undefined) return { ...failure(rejected), receipt: { id: handle.jobId } };
```

**File**: `packages/provider-hypihub/test/provider.test.ts` (modified, +3/-3)
```diff
@@ -786,7 +786,7 @@ test("HypiHub exposes model groups beneath its own total capacity", async () =>
   assert.throws(() => createHypiHubProvider({ capabilityConcurrency: { invented: 1 } }), /unknown HypiHub capacity/);
 });
 
-test("HypiHub polling errors and operation deadlines fail without settlement polling", async () => {
+test("HypiHub operation deadlines fail while polling transport errors keep the job pending", async () => {
   const request = need({});
   let requests = 0;
   const registry = new EndpointRegistry();
@@ -807,8 +807,8 @@ test("HypiHub polling errors and operation deadlines fail without settlement pol
   assert.equal(timedOut.status === "failed" && timedOut.failure.code, "HYPIHUB_OPERATION_TIMEOUT");
   assert.equal(requests, 0);
   const offline = await endpoint.poll({ ...common, handle: { ...common.handle, startedAt: Date.now() } });
-  assert.equal(offline.status, "failed");
-  assert.match(offline.status === "failed" ? offline.failure.message : "", /offline/);
+  assert.equal(offline.status, "pending");
+  assert.equal(offline.status === "pending" && offline.progress?.phase, "retrying");
   assert.equal(requests, 1);
 });
 
```

**File**: `packages/provider-monid/src/provider.ts` (modified, +7/-1)
```diff
@@ -202,7 +202,13 @@ function endpoint(client: MonidClient, pollIntervalMs: number, maxOperationMs: n
         if (Date.now() - handle.startedAt > maxOperationMs) {
           return { status: "failed", receipt, failure: { code: "MONID_OPERATION_TIMEOUT", message: `Monid run ${handle.runId} exceeded this Provider's operationTimeoutMs (${maxOperationMs}); remote outcome is unknown` } };
         }
-        const run = await client.getRun(handle.runId, apiKey(context.credentials));
+        let run: Record<string, unknown>;
+        try {
+          run = await client.getRun(handle.runId, apiKey(context.credentials));
+        } catch (error) {
+          if (error instanceof MonidHttpError && error.status < 500) return { ...failure(error), receipt };
+          return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: "retrying" }), receipt };
+        }
         const status = String(run.status);
         if (!monidTerminalStatuses.includes(status as typeof monidTerminalStatuses[number])) {
           return { ...wakeAfter(canonicalize(handle), pollIntervalMs, Date.now(), { phase: status }), receipt };
```

#### Recent Merged Pull Requests:
- **PR #361** (2026-09-26): fix(cli): resolve packages status the way a Build resolves (@rponeawa)
- **PR #353** (2026-09-24): feat(studio): add a light theme that follows the browser (@rponeawa)
- **PR #351** (closed): feat(provider-muapi): add native MuAPI Seedance gateway (@Anil-matcha)
- **PR #349** (2026-09-23): fix(oauth): return sign-in through the hosted callback page (@rponeawa)
- **PR #347** (2026-09-23): fix: ignore album artwork in media probes (@HaokaiDing)
- **PR #345** (2026-09-23): fix: include bundled packages in vocabulary listings (@wanchenxing)
- **PR #342** (2026-09-23): fix: encode HyperFrames renders with BT.709 and tag the output (@zhangfeite)
- **PR #341** (2026-09-23): docs: link Runtime from the images pages with a relative path (@qianqiang-del)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
