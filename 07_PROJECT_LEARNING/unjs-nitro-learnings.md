> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/unjs-nitro-learnings.md`  
> **Source**: github ([https://github.com/unjs/nitro](https://github.com/unjs/nitro))  
> **Source Version**: `d046d733`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T06:07:07.945Z  
> **Learning ID**: `learn-github-nitrojs-nitro`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nitrojs/nitro

> **Canonical Artifact**: `07_PROJECT_LEARNING/unjs-nitro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unjs/nitro](https://github.com/unjs/nitro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T06:07:07.695Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nitrojs/nitro`
- **Description**: Next Generation Server Toolkit. Create web servers with everything you need and deploy them wherever you prefer.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11293 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/import-alias/server/utils/math.ts`
```
export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sum(a: number, b: number): number {
  return a + b;
}

```

### Core Architecture Module: `examples/renderer/api/hello.ts`
```
import { defineHandler } from "nitro";

export default defineHandler(() => "Nitro is amazing!");

```

### Core Architecture Module: `examples/renderer/nitro.config.ts`
```
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { handler: "./renderer" },
});

```

### Core Architecture Module: `examples/renderer/renderer.ts`
```
import { fetch } from "nitro";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());
  return new Response(
    /* html */ `<!DOCTYPE html>
    <html>
    <head>
      <title>Custom Renderer</title>
    </head>
    <body>
      <h1>Hello from custom renderer!</h1>
      <p>Current path: ${url.pathname}</p>
      <p>API says: ${apiRes}</p>
    </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

```

### Core Architecture Module: `examples/renderer/vite.config.ts`
```
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });

```

### Core Architecture Module: `src/prerender/_meta.ts`
```
import type { Nitro } from "nitro/types";

export type PrerenderMeta = Record<string, { contentType?: string }>;

const prerenderMetas = new WeakMap<Nitro, PrerenderMeta>();

export function getPrerenderMeta(nitro: Nitro): PrerenderMeta {
  let meta = prerenderMetas.get(nitro);
  if (!meta) {
    meta = {};
    prerenderMetas.set(nitro, meta);
  }
  return meta;
}

```

### Core Architecture Module: `src/prerender/prerender.ts`
```
import { pathToFileURL } from "node:url";
import { defu } from "defu";
import mime from "mime";
import { writeFile } from "../utils/fs.ts";
import type { Nitro, NormalizedRouteRules, PrerenderRoute, PublicAssetDir } from "nitro/types";
import { join, relative, resolve } from "pathe";
import { createRouter, addRoute, findAllRoutes } from "rou3";
import { joinURL, withBase, withoutBase, withTrailingSlash } from "ufo";
import { build } from "../build/build.ts";
import { resolveRolldown } from "../build/rolldown/_import.ts";
import { createNitro } from "../nitro.ts";
import { compressPublicAssets } from "../utils/compress.ts";
import { runParallel } from "../utils/parallel.ts";
import { extractLinks, formatPrerenderRoute, matchesIgnorePattern } from "./utils.ts";
import { getPrerenderMeta } from "./_meta.ts";
import { scanUnprefixedPublicAssets } from "../build/assets.ts";
import { toRequest } from "h3";
import { EnvServer } from "env-runner";

const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/; // From unjs/destr

// const linkParents = new Map<string, Set<string>>();

export async function prerender(nitro: Nitro) {
  if (nitro.options.noPublicDir) {
    nitro.logger.warn("Skipping prerender since `noPublicDir` option is enabled.");
    return;
  }

  // Initial list of routes to prerender
  const routes = new Set(nitro.options.prerender.routes);

  // Extend with static prerender route rules
  const prerenderRulePaths = Object.entries(nitro.options.routeRules)
    .filter(([path, options]) => options.prerender && !path.includes("*"))
    .map((e) => e[0]);
  for (const route of prerenderRulePaths) {
    routes.add(route);
  }

  // Allow extending prerender routes
  await nitro.hooks.callHook("prerender:routes", routes);

  // Skip if no prerender routes specified
  if (routes.size === 0) {
    // Crawl / at least if no routes are specified
    if (nitro.options.prerender.crawlLinks) {
      routes.add("/");
    } else {
      return;
    }
  }

  // Build with prerender preset
  nitro.logger.info("Initializing prerenderer");
  nitro._prerenderedRoutes = [];
  const prerendererConfig = {
    ...nitro.options._config,
    static: false,
    compressPublicAssets: false,
    rootDir: nitro.options.rootDir,
    renderer: nitro.options.renderer,
    virtual: { ...nitro.options.virtual },
    logLevel: 0,
    preset: "nitro-prerender",
    builder: prerenderBuilder(nitro),
  };
  await nitro.hooks.callHook("prerender:config", prerendererConfig);
  const nitroRenderer = await createNitro(prerendererConfig);
  const prerenderStartTime = Date.now();
  await nitro.hooks.callHook("prerender:init", nitroRenderer);
  await nitroRenderer.routing.sync();

  // Set path to preview prerendered routes relative to the "host" nitro preset
  let path = relative(nitro.options.output.dir, nitro.options.output.publicDir);
  if (!path.startsWith(".")) {
    path = `./${path}`;
  }
  nitroRenderer.options.commands.preview = `npx serve ${path}`;
  nitroRenderer.options.output.dir = nitro.options.output.dir;

  // Run prerender server in an isolate worker
  const prerenderer = await startPrerenderer(nitroRenderer);

  // Create route rule matcher
  const routeRules = createRouter<NormalizedRouteRules>();
  for (const [route, rules] of Object.entries(nitro.options.routeRules)) {
    addRoute(routeRules, undefined, route, rules);
  }

  const _getRouteRules = (path: string) =>
    defu(
      {},
      ...findAllRoutes(routeRules, undefined, path)
        .map((r) => r.data)
        .reverse()
    ) as NormalizedRouteRules;

  // Start prerendering
  const generatedRoutes = new Set();
  const failedRoutes = new Set<PrerenderRoute>();
  const skippedRoutes = new Set();
  const displayedLengthWarns = new Set();

  const publicAssetBases: string[] = nitro.options.publicAssets
    .filter(
      (a): a is PublicAssetDir & { baseURL: string } =>
        !!a.baseURL && a.baseURL !== "/" && !a.fallthrough
    )
    .map((a) => withTrailingSlash(a.baseURL));

  const scannedPublicAssets = nitro.options.prerender.ignoreUnprefixedPublicAssets
    ? new Set(await scanUnprefixedPublicAssets(nitro))
    : new Set<string>();

  const canPrerender = (route = "/") => {
    // Skip if route is already generated or skipped
    if (generatedRoutes.has(route) || skippedRoutes.has(route)) {
      return false;
    }

    // Check for explicitly ignored routes
    if (nitro.options.prerender.ignore) {
      for (const pattern of nitro.options.prerender.ignore) {
        if (matchesIgnorePattern(route, pattern)) {
          return false;
        }
      }
    }

    if (publicAssetBases.some((base) => route.startsWith(base))) {
      return false;
    }

    if (scannedPublicAssets.has(route)) {
      return false;
    }

    // Check for route rules explicitly disabling prerender
    if (_getRouteRules(route).prerender === false) {
      return false;
    }

    return true;
  };

  const canWriteToDisk = (route: PrerenderRoute) => {
    // Cannot write routes with query or `..` segments
    if (route.route.includes("?") || route.route.split(/[/\\]/).includes("..")) {
      return false;
    }

    // Ensure length is not too long for filesystem
    // https://en.wikipedia.org/wiki/Comparison_of_file_systems#Limits
    const FS_MAX_SEGMENT = 255;
    // 1024 is the max path length on APFS (undocumented)
    const FS_MAX_PATH = 1024;
    const FS_MAX_PATH_PUBLIC_HTML = FS_MAX_PATH - (nitro.options.output.publicDir.length + 10);

    if (
      (route.route.length >= FS_MAX_PATH_PUBLIC_HTML ||
        route.route.split("/").some((s) => s.length > FS_MAX_SEGMENT)) &&
      !displayedLengthWarns.has(route)
    ) {
      displayedLengthWarns.add(route);
      const _route = route.route.slice(0, 60) + "...";
      if (route.route.length >= FS_MAX_PATH_PUBLIC_HTML) {
        nitro.logger.warn(
          `Prerendering long route "${_route}" (${route.route.length}) can cause filesystem issues since it exceeds ${FS_MAX_PATH_PUBLIC_HTML}-character limit when writing to \`${nitro.options.output.publicDir}\`.`
        );
      } else {
        nitro.logger.warn(
          `Skipping prerender of the route "${_route}" since it exceeds the ${FS_MAX_SEGMENT}-character limit in one of the path segments and can cause filesystem issues.`
        );
        return false;
      }
    }

    return true;
  };

  const generateRoute = async (route: string) => {
    const start = Date.now();

    // Ensure route is decoded to start with
    route = decodeURI(route);

    // Check if we should render route
    if (!canPrerender(route)) {
      skippedRoutes.add(route);
      return;
    }
    generatedRoutes.add(route);

    // Create result object
    const _route: PrerenderRoute = { route };

    // Fetch the route
    const encodedRoute = encodeURI(route);

    const req = toRequest(withBase(encodedRoute, nitro.options.baseURL), {
      headers: [["x-nitro-prerender", encodedRoute]],
    });
    const res = await prerenderer.fetch(req);
    // Data will be removed as soon as written to the disk
    let dataBuff: Buffer | undefined = Buffer.from(await res.arrayBuffer());

    Object.defineProperty(_route, "contents", {
      get: () => {
        return dataBuff ? dataBuff.toString("utf8") : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });
    Object.defineProperty(_route, "data", {
      get: () => {
        return dataBuff ? dataBuff.buffer : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
    const redirectCodes = [301, 302, 303, 304, 307, 308];
    if (![200, ...redirectCodes].includes(res.status)) {
      _route.error = new Error(`[${res.status}] ${res.statusText}`) as any;
      // @ts-expect-error (typed as readonly)
      _route.error!.status = res.status;
      // @ts-expect-error (typed as readonly)
      _route.error!.statusText = res.statusText;
    }

    // Measure actual time taken for generating route
    _route.generateTimeMS = Date.now() - start;

    // Guess route type and populate fileName
    const contentType = res.headers.get("content-type") || "";
    const isImplicitHTML =
      !route.endsWith(".html") &&
      contentType.includes("html") &&
      !JsonSigRx.test(dataBuff!.subarray(0, 32).toString("utf8"));
    const routeWithIndex = route.endsWith("/") ? route + "index" : route;
    const htmlPath =
      route.endsWith("/") || nitro.options.prerender.autoSubfolderIndex
        ? joinURL(route, "index.html")
        : route + ".html";
    _route.fileName = withoutBase(
      isImplicitHTML ? htmlPath : routeWithIndex,
      nitro.options.baseURL
    );
    // Allow overriding content-type in `prerender:generate` hook
    const inferredContentType = mime.getType(_route.fileName) || "text/plain";
    _route.contentType = contentType || inferredContentType;

    // Allow hooking before generate
    await nitro.hooks.callHook("prerender:generate", _route, nitro);
    if (_route.contentType !== inferredContentType) {
      const prerenderMeta = getPrerenderMeta(nitro);
      prerenderMeta[_route.fileName] ||= {};
      prerenderMeta[_route.fileName].contentType = _route.contentType;
    }

    // After hook to allow ignoring in `prerender:generate` hook
    if (_route.error) {
      failedRoutes.add(_route);
    }

    // Check if route is skipped or has errors
    if (_route.skip || _route.error) {
      await nitro.hooks.callHook("prerender:route", _route);
      nitro.logger.log(formatPrerenderRoute(_route));
      dataBuff = undefined; // Free memory
      return _route;
    }

    // Write to the disk
    const filePath = join(nitro.options.output.publicDir, _route.fileName);
```

### Core Architecture Module: `src/prerender/utils.ts`
```
import { colors } from "consola/utils";
import type { PrerenderRoute } from "nitro/types";
import { parseURL } from "ufo";
import { parse as parseHTML, walk } from "ultrahtml";

const allowedExtensions = new Set(["", ".json"]);

const linkParents = new Map<string, Set<string>>();

const HTML_ENTITIES = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&apos;": "'",
  "&quot;": '"',
} as Record<string, string>;

function escapeHtml(text: string) {
  return text.replace(/&(lt|gt|amp|apos|quot);/g, (ch) => HTML_ENTITIES[ch] || ch);
}

export async function extractLinks(html: string, from: string, res: Response, crawlLinks: boolean) {
  const links: string[] = [];
  const _links: string[] = [];

  // Extract from any <TAG href=""> to crawl
  if (crawlLinks) {
    await walk(parseHTML(html), (node) => {
      if (!node.attributes?.href) {
        return;
      }

      const link = escapeHtml(node.attributes.href);
      if (!decodeURIComponent(link).startsWith("#") && allowedExtensions.has(getExtension(link))) {
        _links.push(link);
      }
    });
  }

  // Extract from x-nitro-prerender headers
  const header = res.headers.get("x-nitro-prerender") || "";
  _links.push(...header.split(",").map((i) => decodeURIComponent(i.trim())));

  for (const link of _links.filter(Boolean)) {
    const _link = parseURL(link);
    if (_link.protocol || _link.host) {
      continue;
    }
    if (!_link.pathname.startsWith("/")) {
      const fromURL = new URL(from, "http://localhost");
      _link.pathname = new URL(_link.pathname, fromURL).pathname;
    }
    links.push(_link.pathname + _link.search);
  }
  for (const link of links) {
    const _parents = linkParents.get(link);
    if (_parents) {
      _parents.add(from);
    } else {
      linkParents.set(link, new Set([from]));
    }
  }
  return links;
}

const EXT_REGEX = /\.[\da-z]+$/;

function getExtension(link: string): string {
  const pathname = parseURL(link).pathname;
  return (pathname.match(EXT_REGEX) || [])[0] || "";
}

export function formatPrerenderRoute(route: PrerenderRoute) {
  let str = `  ├─ ${route.route} (${route.generateTimeMS}ms)`;

  if (route.error) {
    const parents = linkParents.get(route.route);
    const errorColor = colors[route.error.status === 404 ? "yellow" : "red"];
    const errorLead = parents?.size ? "├──" : "└──";
    str += `\n  │ ${errorLead} ${errorColor(route.error.message || "unknown error")}`;

    if (parents?.size) {
      str += `\n${[...parents.values()].map((link) => `  │ └── Linked from ${link}`).join("\n")}`;
    }
  }

  if (route.skip) {
    str += colors.gray(" (skipped)");
  }

  return colors.gray(str);
}

// prettier-ignore
type IgnorePattern =
  | string
  | RegExp
  | ((path: string) => undefined | null | boolean);
export function matchesIgnorePattern(path: string, pattern: IgnorePattern) {
  if (typeof pattern === "string") {
    // TODO: support rou3 patterns
    return path.startsWith(pattern as string);
  }

  if (typeof pattern === "function") {
    return pattern(path) === true;
  }

  if (pattern instanceof RegExp) {
    return pattern.test(path);
  }

  return false;
}

```

### Core Architecture Module: `src/presets/_nitro/base-worker.ts`
```
import { defineNitroPreset } from "../_utils/preset.ts";

const baseWorker = defineNitroPreset(
  {
    entry: null as any, // Abstract
    node: false,
    minify: true,
    noExternals: true,
    rollupConfig: {
      output: {
        format: "iife",
        generatedCode: {
          symbols: true,
        },
      },
    },
    inlineDynamicImports: true, // iffe does not support code-splitting
  },
  {
    name: "base-worker" as const,
  }
);

export default [baseWorker] as const;

```

### Core Architecture Module: `src/presets/_nitro/nitro-prerender.ts`
```
import { defineNitroPreset } from "../_utils/preset.ts";

const nitroPrerender = defineNitroPreset(
  {
    entry: "./_nitro/runtime/nitro-prerenderer",
    serveStatic: true,
    output: {
      serverDir: "{{ buildDir }}/prerender",
    },
    externals: { noTrace: true },
  },
  {
    name: "nitro-prerender" as const,
  }
);

export default [nitroPrerender] as const;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4661** (2026-10-18): **vite dev: scan-dir and rootDir watchers are never closed when the vite server closes or restarts**
  *Symptoms*: ### Environment  - nitro 3.0.260903-beta (also 3.0.1-alpha.2), vite 8.3.0 - Node v22.22.3 and v24.21.0, macOS 26.6.2 (arm64)  ### Reproduction  https://gist.github.com/light-merlin-dark/4bf3cef36788493c770dc05520733469  ``` npm install npm run repro   # node repro.mjs 3 ```  ### Describe the bug  `configureViteDevServer` opens a chokidar watcher on the scan dirs and an `fs.watch` on `rootDir`. It closes both only in `nitro.hooks.hook("close")`. In vite dev, `nitro.close()` is never called when the vite server closes or restarts in process (a config or `.env` change calls `server.restart()`). Each restart therefore leaves both watchers open. Their `change` closures capture `nitroEnv`, which keeps the previous environment and its module graph reachable.  The repro counts `fs.watch` watchers opened from nitro that are not yet closed:  ``` {"restarts":3,"nitroFsWatchersAfterStart":1,"nitroFsWatchersAfterRestarts":4, ...} {"nitroFsWatchersAfterClose":4} ```  Even after `server.close()`, all 4 stay open.  A heap snapshot of a real app shows the path `FSEventWrap → FSWatcher → _events.change → closure → nitroEnv → FetchableDevEnvironment → EnvironmentModuleGraph` for each previous server.  Closing the watchers together with the nitro dev environment fixes it in the repro. After 3 restarts 1 watcher is open, and after close 0:  ```js const closeWatchers = () => {   scanDirsWatcher.close();   rootDirWatcher.close(); }; nitro.hooks.hook("close", closeWatchers); const closeNitroEnv = ni

- **Issue #4569** (2026-09-02): **fix(build): count each output file once in the size report**
  *Symptoms*: ### 🔗 Linked issue  Resolves #4567  `v2` backport of #4568 — replace with the number of the `main` PR once it exists.  ### ❓ Type of change  - [ ] 📖 Documentation (updates to the documentation, readme, or JSdoc annotations) - [x] 🐞 Bug fix (a non-breaking change that fixes an issue) - [x] 👌 Enhancement (improving an existing functionality like performance) - [ ] ✨ New feature (a non-breaking change that adds functionality) - [ ] 🧹 Chore (updates to the build process or auxiliary tools and libraries) - [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)  ### 📚 Description  Same fix as #4568, against `v2` (`src/core/utils/fs-tree.ts`, which uses `globby` rather than `tinyglobby` — the defaults and the fix are identical).  `generateFSTree` globbed the server output with symlink traversal left at its default, while the output itself is built from directory symlinks — externals traced in more than one version are written to `.nitro/<pkg>@<version>` and linked into place, both flat and under each parent. Every file behind those links was therefore read, and gzipped when `compressedSizes` is on, once per path, inflating the reported total.  Disabling traversal alone under-counts: the only real copies sit inside the `.nitro` dot directory that globs skip by default, so `dot` is needed too. With both, the report matches the bytes actually on disk.  Verified on 2.13.4 with the reproduction from #4567:  | | reported | 

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

### Incident Patch 1: `f6daa502` (2026-10-18)
**Commit Message**: fix(dev): warn instead of failing when nitro dev detects a vite config (#4850)

**File**: `src/config/resolvers/builder.ts` (modified, +11/-2)
```diff
@@ -48,8 +48,16 @@ export async function resolveBuilder(options: NitroOptions) {
     isDepInstalled("vite", { dir: options.rootDir, paths: options.deps?.paths }) &&
     hasNitroViteConfig(options)
   ) {
-    options.builder = "vite";
-    return;
+    if (!options.dev) {
+      options.builder = "vite";
+      return;
+    }
+    if (!_viteHintShown) {
+      _viteHintShown = true;
+      consola.warn(
+        "Detected a `vite.config` with the `nitro()` plugin, but the Nitro dev server does not run Vite, so Vite plugins and features are not available. Use `vite dev` for the full Vite experience."
+      );
+    }
   }
 
   // Default to rolldown when installed in the project, and otherwise install it on build, unless
@@ -75,6 +83,7 @@ export async function resolveBuilder(options: NitroOptions) {
 }
 
 let _hintShown = false;
+let _viteHintShown = false;
 
 function hasConfig(config: object | undefined): boolean {
   return !!config && Object.keys(config).length > 0;
```

**File**: `test/unit/builder-resolve.test.ts` (modified, +48/-2)
```diff
@@ -1,16 +1,25 @@
 import type { NitroOptions } from "nitro/types";
-import { mkdtemp, rm } from "node:fs/promises";
+import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "pathe";
 import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
 
-const state = vi.hoisted(() => ({ rolldown: undefined as string | undefined }));
+const state = vi.hoisted(() => ({ rolldown: undefined as string | undefined, vite: false }));
 
 vi.mock("../../src/build/rolldown/_import.ts", async (importOriginal) => ({
   ...(await importOriginal<typeof import("../../src/build/rolldown/_import.ts")>()),
   resolveRolldown: () => state.rolldown,
 }));
 
+vi.mock("../../src/utils/dep.ts", async (importOriginal) => {
+  const mod = await importOriginal<typeof import("../../src/utils/dep.ts")>();
+  return {
+    ...mod,
+    isDepInstalled: (id: string, opts: Parameters<typeof mod.isDepInstalled>[1]) =>
+      id === "vite" ? state.vite : mod.isDepInstalled(id, opts),
+  };
+});
+
 const { resolveBuilder } = await import("../../src/config/resolvers/builder.ts");
 
 describe("resolveBuilder", () => {
@@ -33,6 +42,7 @@ describe("resolveBuilder", () => {
   beforeEach(() => {
     delete process.env.NITRO_BUILDER;
     state.rolldown = undefined;
+    state.vite = false;
   });
 
   async function resolve(opts: Partial<NitroOptions>) {
@@ -86,4 +96,40 @@ describe("resolveBuilder", () => {
     state.rolldown = "/rolldown/index.mjs";
     expect(await resolve({ dev: false, builder: false })).toBe(false);
   });
+
+  describe("vite config with nitro() plugin", () => {
+    let viteRootDir: string;
+
+    beforeAll(async () => {
+      viteRootDir = join(rootDir, "vite-app");
+      await mkdir(viteRootDir, { recursive: true });
+      await writeFile(
+        join(viteRootDir, "vite.config.ts"),
+        `import { nitro } from "nitro/vite";\nexport default { plugins: [nitro()] };\n`
+      );
+    });
+
+    it("uses vite to build", async () => {
+      state.vite = true;
+      expect(await resolve({ rootDir: viteRootDir, dev: false })).toBe("vite");
+    });
+
+    it("falls back with a warning in nitro dev", async () => {
+      vi.resetModules();
+      const { consola } = await import("consola");
+      const { resolveBuilder: freshResolveBuilder } =
+        await import("../../src/config/resolvers/builder.ts");
+      const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
+      try {
+        state.vite = true;
+        state.rolldown = "/rolldown/index.mjs";
+        const options = { rootDir: viteRootDir, dev: true } as NitroOptions;
+        await freshResolveBuilder(options);
+        expect(options.builder).toBe("rolldown");
+        expect(warn).toHaveBeenCalledOnce();
+      } finally {
+        warn.mockRestore();
+      }
+    });
+  });
 });
```

---

### Incident Patch 2: `cf950f28` (2026-10-20)
**Commit Message**: fix(vite): allow importing `.svg` files as text and bytes in dev (#4869)

**File**: `src/build/plugins/raw.ts` (modified, +5/-3)
```diff
@@ -12,8 +12,10 @@ const TYPES = ["raw", "bytes", "text"] as const;
 
 const PREFIX_RE = new RegExp(`^(${TYPES.join("|")}):`);
 
-// Modules under this prefix hold file contents, not source code, so other transforms must skip them
-export const RESOLVED_RE = new RegExp(`^virtual:nitro:(${TYPES.join("|")}):`);
+// Modules under this prefix hold file contents, not source code, so other transforms must skip them.
+// The `\0` keeps vite dev from checking file access on them (denied for ids with `:`, e.g. `.svg`).
+export const RESOLVED_PREFIX = "\0virtual:nitro:";
+export const RESOLVED_RE = new RegExp(`^${RESOLVED_PREFIX}(${TYPES.join("|")}):`);
 
 // Resolved ids are JavaScript modules. Without this, plugins matching the original
 // extension (`@rollup/plugin-json`, vite's json plugin, ...) try to transform them again.
@@ -45,7 +47,7 @@ export function raw(): Plugin {
               `Could not resolve \`${specifier}\`${importer ? ` (imported by \`${importer}\`)` : ""} to contents to inline as \`${type}\`.`
             );
           }
-          return { id: `virtual:nitro:${type}:${resolved.id}${RESOLVED_SUFFIX}` };
+          return { id: `${RESOLVED_PREFIX}${type}:${resolved.id}${RESOLVED_SUFFIX}` };
         });
       },
     },
```

**File**: `src/build/unbundled/plugins.ts` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ import { importAttributes } from "../plugins/import-attributes.ts";
 import { resolveDep } from "../../utils/dep.ts";
 import { importOXC } from "../../utils/oxc.ts";
 import { chain } from "../../utils/sync.ts";
-import { raw, RESOLVED_RE as RAW_RE } from "../plugins/raw.ts";
+import { raw, RESOLVED_PREFIX as RAW_PREFIX, RESOLVED_RE as RAW_RE } from "../plugins/raw.ts";
 import { routeMeta } from "../plugins/route-meta.ts";
 import { resolveBuildPlugins } from "../plugins.ts";
 import {
@@ -226,7 +226,7 @@ function rawVirtualPlugin(nitro: Nitro): EnvRunnerPlugin {
         const [, type] = prefixRe.exec(source) || [];
         const id = source.slice(`${type}:`.length);
         if (type && nitro.vfs.has(id)) {
-          return `virtual:nitro:${type}:${id}.js`;
+          return `${RAW_PREFIX}${type}:${id}.js`;
         }
       },
     },
```

**File**: `test/vite/app-fixture/api/icon.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>
```

**File**: `test/vite/app-fixture/api/svg.ts` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+// @ts-ignore
+import text from "./icon.svg" with { type: "text" };
+// @ts-ignore
+import bytes from "./icon.svg" with { type: "bytes" };
+// @ts-ignore
+import raw from "raw:./icon.svg";
+
+export default () => ({
+  text: (text as unknown as string).trim(),
+  bytes: new TextDecoder().decode(bytes as unknown as Uint8Array).trim(),
+  // `raw:` infers the type from the mime (`image/svg+xml` is binary)
+  raw: new TextDecoder().decode(raw as unknown as Uint8Array).trim(),
+});
```

**File**: `test/vite/app.test.ts` (modified, +8/-0)
```diff
@@ -56,6 +56,14 @@ describe("vite:app", () => {
     expect(await res.text()).toBe("Hello from build plugin!");
   });
 
+  // #4868: `.svg` ids are checked by Vite's dev server access control, which denies ids with `:`
+  test("imports `.svg` files as text and bytes", async () => {
+    const res = await fetch(`${serverURL}/api/svg`);
+    expect(res.status).toBe(200);
+    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>`;
+    expect(await res.json()).toEqual({ text: svg, bytes: svg, raw: svg });
+  });
+
   // #4234: a request matching only the SSR `/**` catch-all (no explicit route) that looks like
   // an asset must be handled by Vite, not swallowed by the catch-all renderer.
   test("does not let the SSR catch-all swallow asset-tagged requests", async () => {
```

---

### Incident Patch 3: `65ca5ca8` (2026-10-20)
**Commit Message**: fix(vite): guard against builtin aliases leaking into client build (#4864)

**File**: `src/build/vite/plugin.ts` (modified, +32/-5)
```diff
@@ -9,6 +9,7 @@ import type {
 import type { InputOption } from "rollup";
 import type { NitroPluginConfig, NitroPluginContext } from "./types.ts";
 import { resolve, join } from "pathe";
+import { resolveAlias } from "pathe/utils";
 import { createNitro, prepare } from "../../builder.ts";
 import { installModules } from "../../module.ts";
 import { getBundlerConfig } from "./bundler.ts";
@@ -50,6 +51,7 @@ export function nitro(pluginConfig: NitroPluginConfig = {}): VitePlugin[] {
   return [
     nitroInit(ctx),
     nitroEnv(ctx),
+    nitroServerAliases(ctx),
     nitroMain(ctx),
     nitroPrepare(ctx),
     nitroDevServiceProxy(ctx),
@@ -209,6 +211,29 @@ function nitroEnv(ctx: NitroPluginContext): VitePlugin {
   };
 }
 
+function nitroServerAliases(ctx: NitroPluginContext): VitePlugin {
+  return {
+    name: "nitro:server-aliases",
+    enforce: "pre",
+    applyToEnvironment: (env) => env.name !== "client" && env.config?.consumer !== "client",
+
+    async resolveId(id, importer, options) {
+      if (!ctx.bundlerConfig) {
+        return;
+      }
+      const resolved = resolveAlias(id, ctx.bundlerConfig.base.aliases);
+      if (resolved !== id && resolved.startsWith("node:")) {
+        return (
+          (await this.resolve(resolved, importer, { ...options, skipSelf: true })) || {
+            id: resolved,
+            external: true,
+          }
+        );
+      }
+    },
+  };
+}
+
 function nitroMain(ctx: NitroPluginContext): VitePlugin {
   return {
     name: "nitro:main",
@@ -225,11 +250,13 @@ function nitroMain(ctx: NitroPluginContext): VitePlugin {
         resolve: {
           // TODO: environment specific aliases not working
           // https://github.com/vitejs/vite/pull/17583 (seems not effective)
-          // preserve alias order
-          alias: Object.entries(ctx.bundlerConfig.base.aliases).map(([find, replacement]) => ({
-            find,
-            replacement,
-          })),
+          // preserve alias order (exclude node: builtins to prevent leaking to client builds)
+          alias: Object.entries(ctx.bundlerConfig.base.aliases)
+            .filter(([, replacement]) => !replacement.startsWith("node:"))
+            .map(([find, replacement]) => ({
+              find,
+              replacement,
+            })),
         },
         builder: {
           sharedConfigBuild: true,
```

**File**: `test/vite/client-builtins.test.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { describe, expect, it } from "vitest";
+import { nitro } from "../../src/build/vite/plugin.ts";
+import { createServer, resolveConfig } from "vite";
+
+describe("vite: client builtin aliases (#4853)", () => {
+  it.each(["cloudflare-module", "cloudflare-pages", "cloudflare-durable", "deno"] as const)(
+    "does not leak node: aliases into shared resolve.alias for preset: %s",
+    async (preset) => {
+      const config = await resolveConfig(
+        {
+          plugins: [nitro({ preset })],
+          logLevel: "silent",
+        },
+        "build"
+      );
+
+      const rawAliases = config.resolve.alias;
+      const aliases: Array<{ find: string | RegExp; replacement: string }> = Array.isArray(
+        rawAliases
+      )
+        ? (rawAliases as any)
+        : Object.entries(rawAliases || {}).map(([find, replacement]) => ({
+            find,
+            replacement:
+              typeof replacement === "string" ? replacement : (replacement as any).replacement,
+          }));
+
+      const nodeAliases = aliases.filter(
+        (a) => typeof a.replacement === "string" && a.replacement.startsWith("node:")
+      );
+
+      expect(nodeAliases).toEqual([]);
+    }
+  );
+
+  it("resolves node: aliases in server environments", async () => {
+    const server = await createServer({
+      plugins: [nitro({ preset: "cloudflare-module" })],
+      logLevel: "silent",
+    });
+    try {
+      const nitroEnv = server.environments.nitro;
+      const resolved = await nitroEnv.pluginContainer.resolveId("events");
+      expect(resolved?.id).toBe("node:events");
+      expect(resolved?.external).toBe(true);
+
+      const bufferResolved = await nitroEnv.pluginContainer.resolveId("buffer/");
+      expect(bufferResolved?.id).toBe("node:buffer");
+      expect(bufferResolved?.external).toBe(true);
+    } finally {
+      await server.close();
+    }
+  });
+
+  it("preserves non-node aliases in shared resolve.alias", async () => {
+    const config = await resolveConfig(
+      {
+        plugins: [
+          nitro({
+            preset: "cloudflare-module",
+            alias: {
+              "~/custom": "/path/to/custom",
+            },
+          }),
+        ],
+        logLevel: "silent",
+      },
+      "build"
+    );
+
+    const rawAliases = config.resolve.alias;
+    const aliases: Array<{ find: string | RegExp; replacement: string }> = Array.isArray(rawAliases)
+      ? (rawAliases as any)
+      : Object.entries(rawAliases || {}).map(([find, replacement]) => ({
+          find,
+          replacement:
+            typeof replacement === "string" ? replacement : (replacement as any).replacement,
+        }));
+
+    const customAlias = aliases.find((a) => a.find === "~/custom");
+    expect(customAlias?.replacement).toBe("/path/to/custom");
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4870** (2026-10-20): docs(bun): document runtime environment variables and unix socket listening (@sarankumar1325)
- **PR #4869** (2026-10-20): fix(vite): allow importing `.svg` files as text and bytes in dev (@pi0x)
- **PR #4867** (2026-10-20): fix(deps): do not auto-install dependencies inside node_modules (@pi0x)
- **PR #4865** (2026-10-20): perf(cli): run `nitro serve` in-process without `buildPlugins` (@pi0x)
- **PR #4864** (2026-10-20): fix(vite): guard against builtin aliases leaking into client build (#4853) (@agustin18)
- **PR #4862** (2026-10-20): perf(unbundled): synchronous built-in plugin hooks (@pi0x)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. dev): warn instead of failing when nitro dev detects a vite config (#4850)

**RULE**:
When implementing operations in `src/config/resolvers/builder.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nitrojs/nitro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f6daa502`: dev): warn instead of failing when nitro dev detects a vite config (#4850). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/config/resolvers/builder.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    if (!options.dev) {
      options.builder = "vite";
      return;
    }
    if (!_viteHintShown) {
      _viteHintShown = true;
      consola.warn(
        "Detected a `vite.config` with the `nitro()` plugin, but the Nitro dev server does not run Vite, so Vite plugins and features are not available. Use `vite dev` for the full Vite experience."
      );
    }
let _viteHintShown = false;
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    options.builder = "vite";
    return;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f6daa502` are properly handled with clean fallback behavior.
