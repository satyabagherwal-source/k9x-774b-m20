# Forensic Learning Record (Deep Inspection): earthtojake/text-to-cad

> **Canonical Artifact**: `07_PROJECT_LEARNING/earthtojake-text-to-cad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:10.435Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `earthtojake/text-to-cad`
- **Description**: Give your agent CAD superpowers.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16508 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/postcss.config.mjs`
```
export default {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

```

### Core Architecture Module: `apps/web/scripts/directoryRoot.mjs`
```
import path from "node:path";

// Development tooling and its tests consume the root workspace's compiled
// @text-to-cad/core export, just like the app.
import { pathIsInside } from "@text-to-cad/core/lib/pathUtils.mjs";

export function resolveDirectoryRoot({
  directoryRoot = "",
  env = process.env,
  cwd = process.cwd(),
  appRoot = "",
  defaultDirectoryRoot = "",
} = {}) {
  const explicitRoot = directoryRoot || "";
  if (explicitRoot) {
    return path.resolve(cwd, explicitRoot);
  }

  const resolvedAppRoot = appRoot ? path.resolve(appRoot) : "";
  for (const candidate of [env.INIT_CWD, cwd]) {
    if (!candidate) {
      continue;
    }
    const resolvedCandidate = path.resolve(candidate);
    if (!resolvedAppRoot || (resolvedCandidate !== resolvedAppRoot && !pathIsInside(resolvedCandidate, resolvedAppRoot))) {
      return resolvedCandidate;
    }
  }

  return defaultDirectoryRoot ? path.resolve(defaultDirectoryRoot) : path.resolve(cwd);
}

```

### Core Architecture Module: `apps/web/scripts/serverFsAllow.mjs`
```
// Vite's `server.fs.allow` roots for the dev server.
//
// Vite checks a module id AFTER resolving it, so ids arrive as real paths. The
// client imports @text-to-cad/core from `packages/core` OUTSIDE the app root, and a
// checkout may reach it through a link (a worktree, a linked node_modules), in
// which case allowing only the spelled path leaves the real path outside the
// list and Vite refuses to serve anything it resolves through it -- notably
// `packages/core/src/lib/render/glbMeshWorker.js`, whose loader falls back to
// main-thread GLB decoding, so the only symptom is a dev-server log line.
//
// Listing both a root and its real path keeps the allow list correct either
// way; in a flat checkout the two are the same path and dedupe to one entry.

export function resolveServerFsAllow(paths, { realpath } = {}) {
  const allow = [];
  const add = (value) => {
    const entry = String(value || "").trim();
    if (entry && !allow.includes(entry)) {
      allow.push(entry);
    }
  };
  for (const candidate of Array.isArray(paths) ? paths : []) {
    if (!candidate) {
      continue;
    }
    add(candidate);
    if (typeof realpath !== "function") {
      continue;
    }
    try {
      add(realpath(candidate));
    } catch {
      // A root that does not exist yet is still worth allowing by its literal
      // path; there is simply no real path to add for it.
    }
  }
  return allow;
}

```

### Core Architecture Module: `apps/web/scripts/serverLifetime.mjs`
```
// Dev-server lifetime only (VIEWER_SERVER_LIFETIME_MS, consumed by
// vite.config.mjs). The CLI-flag duration parser and HTTP close helper that
// used to live here served the deleted Python `serve --shutdown-after` path
// and had no remaining callers.
const MAX_SERVER_LIFETIME_MS = 2_147_483_647;

export function normalizeServerLifetimeMs(value, defaultMs = null) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return defaultMs;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_SERVER_LIFETIME_MS) {
    return defaultMs;
  }
  return parsed;
}

function formatServerLifetime(ms) {
  if (ms % (60 * 60 * 1000) === 0) {
    return `${ms / (60 * 60 * 1000)}h`;
  }
  if (ms % (60 * 1000) === 0) {
    return `${ms / (60 * 1000)}m`;
  }
  if (ms % 1000 === 0) {
    return `${ms / 1000}s`;
  }
  return `${ms}ms`;
}


export function scheduleProcessShutdown({
  lifetimeMs,
  label = "CAD Viewer server",
  close = async () => {},
} = {}) {
  const normalizedLifetimeMs = normalizeServerLifetimeMs(lifetimeMs);
  if (normalizedLifetimeMs === null) {
    return null;
  }
  const timer = setTimeout(() => {
    console.log(`${label} reached ${formatServerLifetime(normalizedLifetimeMs)} lifetime; shutting down.`);
    const forceExit = setTimeout(() => process.exit(0), 5000);
    forceExit.unref?.();
    Promise.resolve()
      .then(() => close())
      .then(
        () => process.exit(0),
        (error) => {
          console.error(`${label} shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      );
  }, normalizedLifetimeMs);
  timer.unref?.();
  return timer;
}

```

### Core Architecture Module: `apps/web/scripts/viewerEnv.mjs`
```
export const DEPRECATED_LOCAL_ROOT_ENV_VARS = Object.freeze([
  "VIEWER_LOCAL_ROOT_DIR",
  "VIEWER_LOCAL_WORKSPACE_ROOT",
]);

export function assertNoDeprecatedLocalRootEnv(env = process.env) {
  const configured = DEPRECATED_LOCAL_ROOT_ENV_VARS.filter((name) => String(env?.[name] || "").trim());
  if (configured.length) {
    throw new Error(
      `${configured.join(", ")} ${configured.length === 1 ? "is" : "are"} no longer supported. ` +
      "Start dev from the directory to serve with npm --prefix <checkout>/apps/web run dev. " +
      "Open the bare origin with ?file=<relative-path> to select an artifact within that root."
    );
  }
}

```

### Core Architecture Module: `apps/web/src/App.tsx`
```
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FileViewer } from '@text-to-cad/ui/file-viewer';
import type { ViewerHost } from '@text-to-cad/ui/host';
import { EmptyState } from '@text-to-cad/ui/navigation';
import { FileText } from 'lucide-react';
import { createStepRenderer } from '@text-to-cad/ui/renderers/step';
import { createDxfRenderer } from '@text-to-cad/ui/renderers/dxf';
import { createGlbRenderer } from '@text-to-cad/ui/renderers/glb';
import { createMeshRenderer } from '@text-to-cad/ui/renderers/mesh';
import { createRobotRenderer } from '@text-to-cad/ui/renderers/robot';
import { MissingFileAlert, ViewerLoadingOverlay } from '@text-to-cad/ui/file-viewer/presentation';
import { useTabViewerState, type Appearance, type TabStore } from '@text-to-cad/ui/tab-store';
import { useViewerAutoReload } from './host/useViewerAutoReload.js';
import { EmptyCadBackdrop } from '@text-to-cad/ui/file-viewer/empty';
import type { CadServerInfo } from '@text-to-cad/core/client';
import type { CadClient } from './adapters/fileSource';
import { createWebFileSource, createWebFileActions } from './adapters/fileSource';
import { browserClipboard, browserClipboardSupportsImages } from './host/clipboard';
import { createWebPromptContext } from './host/promptContext';
import ViewerAppearance from './client/components/workbench/ViewerAppearance.jsx';
import ViewerBrand from './client/components/workbench/ViewerBrand.jsx';
import ViewerLinks from './client/components/workbench/ViewerLinks.jsx';
import { cadFileParamForEntry, findEntryByUrlPath, normalizeCadFileQueryParam, readCadParam, readDefaultCadParam, writeCadParam } from './client/workbench/sidebar.js';
import { applyColorSchemeToDocument, resolveColorSchemeMode } from './client/ui/colorScheme.js';

/** The keyboard the page is typed on — ⌘ on Apple devices, Ctrl elsewhere: the host's one platform answer. */
const keyboardPlatform = () => /Mac|iPhone|iPad/.test(navigator.platform) ? "darwin" : /Win/.test(navigator.platform) ? "win32" : "linux";
const DARK_QUERY = '(prefers-color-scheme: dark)';
const subscribeToSystemDark = (onChange: () => void) => {
  const query = matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const systemPrefersDark = () => matchMedia(DARK_QUERY).matches;

/** The appearance the tab keeps, resolved against the OS: `light` or `dark`, live. */
export function useTabAppearance(tabStore: TabStore): { preference: Appearance; colorScheme: 'light' | 'dark' } {
  const settings = useSyncExternalStore(tabStore.settings.subscribe, tabStore.settings.getSnapshot, tabStore.settings.getSnapshot);
  const prefersDark = useSyncExternalStore(subscribeToSystemDark, systemPrefersDark, systemPrefersDark);
  return { preference: settings.appearance, colorScheme: resolveColorSchemeMode(settings.appearance, { prefersDark }) as 'light' | 'dark' };
}

export default function App(props: { client: CadClient; server: CadServerInfo; tabStore: TabStore }) {
  return <RootView key={props.server.rootId} {...props} />;
}

/** A root change creates a new session; the tab store, and everything in it, is the tab's across roots. */
function RootView({ client, server, tabStore }: { client: CadClient; server: CadServerInfo; tabStore: TabStore }) {
  useViewerAutoReload(server, { fetchServerInfo: () => client.serverInfo({ fresh: true }).then(info => ({ ok: true, identityToken: String(info.identityToken || '') }), () => ({ ok: false })) });
  const source = useMemo(() => createWebFileSource(client, server), [client, server]);
  const promptContext = useMemo(() => createWebPromptContext(source.id, server.rootPath || '', browserClipboard, browserClipboardSupportsImages()), [source.id, server.rootPath]);
  const fileActions = useMemo(() => createWebFileActions(client, server, { clipboard: browserClipboard }), [client, server]);
  // Every renderer reads its preferences from the tab's settings.
  const preferences = tabStore.settings;
  // One renderer per file family; each lazy-loads only its own code.
  const renderers = useMemo(() => [createStepRenderer({ client, preferences }), createDxfRenderer({ client, preferences }), createGlbRenderer({ client, preferences }), createMeshRenderer({ client, preferences }), createRobotRenderer({ client, preferences })], [client, preferences]);
  const catalog = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [file, setFile] = useState(() => readCadParam() || readDefaultCadParam() || '');
  const selectedEntry = useMemo(() => findEntryByUrlPath(catalog.entries, file), [catalog.entries, file]);
  // The FileViewer's state, from and into the tab store: the panel column's width, this root's open
  // folders and its file views. The open panel is the page's own and never stored.
  const { state, onStateChange, setPanel } = useTabViewerState(tabStore, source.id);
  const appearance = useTabAppearance(tabStore);
  const changeColorScheme = useCallback((value: string) => tabStore.settings.update({ appearance: value as Appearance }), [tabStore]);
  useEffect(() => { applyColorSchemeToDocument(appearance.colorScheme, document.documentElement); }, [appearance.colorScheme]);
  useEffect(() => {
    const sync = () => setFile(readCadParam() || readDefaultCadParam() || '');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void client.refresh({ signal: controller.signal, markRefreshing: false }).catch(() => {}); };
    const visible = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client]);
  useEffect(() => {
    document.title = selectedEntry ? `CAD | ${selectedEntry.file.split(/[\\/]/).pop()}` : 'CAD';
    if (selectedEntry && !readCadParam()) writeCadParam(file, { history: 'replace' });
  }, [file, selectedEntry]);
  const shownFile = useRef(file);
  shownFile.current = file;
  const open = useCallback((path: string, options?: { panel?: string }) => {
    const entry = findEntryByUrlPath(client.getSnapshot().entries, path);
    if (!entry) return;
    const next = normalizeCadFileQueryParam(cadFileParamForEntry(entry));
    if (next !== shownFile.current) {
      writeCadParam(next, { history: 'push' });
      setFile(next);
    } else if (options?.panel === undefined) return;
    // The file opens with the panel it was opened with (the tree, for one picked there) or with
    // its own default. FileViewer owns mobile visibility and keeps its sheets closed.
    setPanel(options?.panel ?? null);
  }, [client, setPanel]);
  const host = useMemo<ViewerHost>(() => ({
    files: source, fileActions, clipboard: browserClipboard, promptContext,
    navigation: { openFile: open }, environment: { colorScheme: appearance.colorScheme, platform: keyboardPlatform() },
  }), [source, fileActions, promptContext, open, appearance.colorScheme]);
  const empty = <div className="pointer-events-auto absolute inset-0 z-10 bg-background"><EmptyState icon={FileText} title="No file open" description="Pick one from the tree on the right, or filter by name." /></div>;
  // Unselected while the catalog resolves the file; once it has, a missing file is named by its own crumbs.
  const navigationPath = selectedEntry ? normalizeCadFileQueryParam(cadFileParamForEntry(selectedEntry)) : catalog.hydrated ? normalizeCadFileQueryParam(file) || null : null;
  return <div className="flex h-svh flex-col overflow-hidden"><div className="min-h-0 flex-1">
    <FileViewer file={file || null} host={host} re
```

### Core Architecture Module: `apps/web/src/adapters/fileSource.ts`
```
import type { ClipboardPort } from '@text-to-cad/ui/host';
import type { FileActions, FileChange, FileEntry, FileMetadata, FileSource } from '@text-to-cad/ui/file-viewer';
import type { createCadClient, CadEntry, CadServerInfo } from '@text-to-cad/core/client';

export type CadClient = ReturnType<typeof createCadClient>;
export const catalogPath = (entry: CadEntry): string => String(entry.rootRelativeFile || entry.file || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

/** Catalog access remains read-only; the shared viewer derives menus from these capabilities. */
export function createWebFileSource(client: CadClient, server: CadServerInfo): FileSource {
  const paths = () => client.getSnapshot().entries.map(catalogPath).filter(Boolean);
  async function ready(signal: AbortSignal) {
    signal.throwIfAborted();
    if (!client.getSnapshot().hydrated) await client.refresh({ signal });
    signal.throwIfAborted();
  }
  return {
    id: server.rootId,
    rootName: 'This directory',
    async stat(path, { signal }): Promise<FileMetadata> {
      const entry = await client.resolveEntry(path, { signal });
      signal.throwIfAborted();
      const relative = catalogPath(entry);
      return { path: relative, name: relative.split('/').pop() || relative, kind: 'file', size: Number(entry.bytes || 0), extension: relative.split('.').pop()?.toLowerCase() || '', mediaType: 'cad', revision: contentRevision(entry) };
    },
    async list(directory, { signal }) {
      await ready(signal);
      const prefix = directory ? `${directory}/` : '';
      const entries = new Map<string, FileEntry>();
      for (const path of paths()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        if (!rest) continue;
        const name = rest.split('/')[0];
        const child = prefix + name;
        entries.set(child, { path: child, name, kind: rest.includes('/') ? 'directory' : 'file' });
      }
      return [...entries.values()].sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    },
    async paths({ signal }) { await ready(signal); return paths(); },
    subscribe(listener) {
      let previous = client.getSnapshot().entries;
      return client.subscribe(() => {
        const current = client.getSnapshot().entries;
        if (current === previous) return;
        const before = new Map(previous.map(entry => [catalogPath(entry), entry]));
        const after = new Map(current.map(entry => [catalogPath(entry), entry]));
        const changes: FileChange[] = [];
        for (const path of new Set([...before.keys(), ...after.keys()])) {
          const oldEntry = before.get(path), entry = after.get(path);
          if (!oldEntry) changes.push({ kind: 'added', path, entryKind: 'file' });
          else if (!entry) changes.push({ kind: 'deleted', path, entryKind: 'file' });
          else if (contentRevision(oldEntry) !== contentRevision(entry)) changes.push({ kind: 'content', path, revision: contentRevision(entry) });
          else if (JSON.stringify(oldEntry) !== JSON.stringify(entry)) changes.push({ kind: 'metadata', path });
        }
        previous = current;
        if (changes.length) listener({ sourceId: server.rootId, changes });
      });
    },
  };
}

/** Render-affecting revisions, not transient compiler progress, invalidate the document. */
function contentRevision(entry: CadEntry): string {
  return JSON.stringify([entry.hash, entry.documentHash, entry.animationHash, entry.appearanceHash, entry.url, entry.relations, entry.sourceSidecar, entry.mtime, entry.bytes]);
}

export function createWebFileActions(client: CadClient, server: CadServerInfo, { clipboard }: {
  clipboard: ClipboardPort;
}): FileActions {
  const copy = async (entry: { path: string }, absolute = false) => {
    const catalogEntry = client.getSnapshot().entries.find(candidate => catalogPath(candidate) === entry.path);
    if (!catalogEntry) return;
    const rootPath = String(server.rootPath || '').replace(/[\\/]+$/, '');
    const rawPath = String(catalogEntry.file).trim().replace(/\\/g, '/');
    const rootPrefix = rootPath.replace(/\\/g, '/');
    const relativePath = rawPath.startsWith(`${rootPrefix}/`) ? rawPath.slice(rootPrefix.length + 1) : catalogPath(catalogEntry);
    const text = absolute ? `${rootPath}${rootPath.includes('\\') ? '\\' : '/'}${rootPath.includes('\\') ? relativePath.replace(/\//g, '\\') : relativePath}` : relativePath;
    await clipboard.writeText(text);

  };
  return {
    platform: server.platform === 'darwin' || server.platform === 'win32' || server.platform === 'linux' ? server.platform : navigator.userAgent.includes('Macintosh') ? 'darwin' : navigator.userAgent.includes('Windows') ? 'win32' : 'linux',
    perform: {
      'copy-relative-path': entry => copy(entry),
      ...(Array.isArray(server.serverFeatures) && server.serverFeatures.includes('reveal-path') ? {
        async reveal(entry: { path: string }) {
          const response = await fetch('/__cad/reveal', { method: 'POST',
            headers: { 'x-cadgen-viewer': '1', 'content-type': 'application/json' },
            body: JSON.stringify({ path: entry.path }) });
          if (!response.ok) {
            const detail = await response.json().catch(() => null);
            throw new Error(detail?.error || 'Could not reveal this file in the file manager.');
          }
        },
      } : {}),
      ...((server.backend || 'local-fs') === 'local-fs' && server.rootPath ? { 'copy-path': (entry: { path: string }) => copy(entry, true) } : {}),
    },
  };
}

```

### Core Architecture Module: `apps/web/src/client/components/workbench/ViewerAppearance.jsx`
```
import { Monitor, Moon, Sun } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@text-to-cad/ui/primitives/select";
import { COLOR_SCHEMES } from "../../ui/colorScheme.js";

const ICONS = { system: Monitor, light: Sun, dark: Moon };
// Host-owned appearance preference, placed beside Projection by the shared sheet.
/** @param {{ colorSchemePreference?: string, resolvedColorSchemeMode?: 'light' | 'dark', onColorSchemePreferenceChange?: (value: string) => void }} props */
export default function ViewerAppearance({ colorSchemePreference = "system", resolvedColorSchemeMode = "light", onColorSchemePreferenceChange = undefined }) {
  const displayedMode = colorSchemePreference === "system" ? resolvedColorSchemeMode : colorSchemePreference;
  const Icon = ICONS[displayedMode] || Sun;
  return <Select value={colorSchemePreference} onValueChange={onColorSchemePreferenceChange}>
    <SelectTrigger aria-label="Appearance"  size="sm" className="!h-7 min-w-0 gap-1 px-2 !text-tiny [&_svg]:size-3.5">
      <span className="flex min-w-0 items-center gap-1"><Icon className="size-3.5 shrink-0" aria-hidden="true" /><SelectValue>{displayedMode === "dark" ? "Dark" : "Light"}</SelectValue></span>
    </SelectTrigger>
    <SelectContent>
      {COLOR_SCHEMES.map(option => {
        const OptionIcon = ICONS[option.id];
        return <SelectItem key={option.id} value={option.id} icon={<OptionIcon className="size-3.5" />}>{option.label}</SelectItem>;
      })}
    </SelectContent>
  </Select>;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #405** (2026-09-17): **Metadata capture never certifies a read a coarse write clock cannot date**
  *Symptoms*: `test_missing_or_corrupt_unrequested_geometry_is_rejected_every_time` failed its SAME-SIZE corruption subtest on Windows CI ([run 35131269027](https://github.com/earthtojake/text-to-cad/actions/runs/35131269027)) and passes on Linux and macOS. It is a real read-path gap in the store, not a test artefact.  ## The gap  `capture_tree(hash, retain_payloads=False)` is the one closure gate behind `request_view`, `surfaces.derive`, the surface manager's `resolve` and `pinned_surface_object`: it reads and verifies every tree and every `.brep` in the closure, including components the request does not touch. To keep a viewer poll from re-hashing the whole document, it caches the flattened descriptor and revalidates it by fingerprinting each required object as `(digest, st_dev, st_ino, st_size, st_mtime_ns, st_ctime_ns)` on both sides of its verified read.  That fingerprint only reports damage when a later write could not reproduce it. On Windows it can:  - `st_ctime` is the file's **creation** time, so it does not move for a rewrite   at all. On Linux and macOS it is the inode-change time and always moves, which   is the only reason the test passes there. - the last-write time is stamped from the ~15.6 ms system timer, so a rewrite in   the tick the verified read observed keeps `st_mtime_ns`.  An in-place, same-size rewrite therefore leaves dev, inode, size, mtime and ctime identical, the cache hits, and all five entry points return a descriptor for a closure whose bytes no longer hash

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

### Incident Patch 1: `9ab99c73` (2026-09-29)
**Commit Message**: Fix renderer playback and orbit updates; add radial engine sample (#470)

Preview playback can briefly return to its starting pose after a
renderer update, and orbit-driven LOD samples unnecessarily rerender the
STEP surface. This fixes both behaviors, accelerates tube projection for
animated springs, and adds the radial engine sample used to exercise
them.

Split from #449 and based directly on current `main` (`94e6170f6`). This
PR contains no cadgen performance changes and can merge independently of
#449.

## Changes

- STEP pose updates and GLB mixer recreation read the active playback
clock, preserving the current frame during display changes and geometry
updates.
- LOD snapshots update React state only when fields used by the visible
status change, avoiding a surface rerender on every orbit frame.
- Tube deformation uses a bounded Newton projection with the existing
bracketing search as fallback, reducing spring preparation work while
retaining the projection contract.
- Add `models/radial`: the complete source for the 18-system,
nine-cylinder engine, its embedded animation and manual validation
tools, hand-off notes, and model-catalog entry. Generated STEP files and
caches re

**File**: `models/README.md` (modified, +7/-1)
```diff
@@ -17,7 +17,7 @@ models/
 ├── assemblies/       demo ASSEMBLIES, one src/<assembly>/ group each
 ├── drawings/         2D `@dxf` drawings, one script each
 ├── thang010146/      imported, annotated mechanism assemblies
-├── f1/ f14d/ hypercar/ moonwatch/ motorbike/ qdd_actuator/ w16/
+├── f1/ f14d/ hypercar/ moonwatch/ motorbike/ qdd_actuator/ radial/ w16/
 ├── tendon_hand/      tendon-driven research hand (source-only)
 ├── falcon_heavy/     SpaceX public-source reconstruction
 ├── juno/ lyra/       authored robot description packages (URDF/SRDF)
@@ -113,6 +113,12 @@ Models that need a **folder of their own** rather than a single loose script.
   one virtual `drive` DOF gears the rotor, carrier, both ball cages and the
   three planets through the 4.5:1 planetary reduction, with the exploded
   teardown embedded in `qdd_actuator.py`.
+- [radial/](radial/src/README.md): nine-cylinder supercharged radial aircraft engine, as a
+  museum restoration. Eighteen system models are linked by `src/radial.py`, with a
+  master/articulating rod train, a 1/8-speed cam ring, a 3:2 planetary reduction and a
+  10:1 blower. It has a sectioned cylinder, a crankcase window, and `running` and
+  `explode` clips. Its hand-off notes (`REPORT.md`, `GAUNTLET.md`, `BUILDING.md`,
+  `BUGS.md`) sit beside the source.
 - [w16/](w16/src/README.md): quad-turbo 8.0 L W16, sectioned museum cutaway —
   thirteen system models linked by `src/w16.py`, with `crank` and `explode`
   clips from its embedded `ANIMATION_JS`. Its hand-off notes (`REPORT.md`,
```

**File**: `models/radial/.gitignore` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/STEP/*
+!/STEP/imported/
+/DXF/*
+!/DXF/imported/
+/STL/*
+!/STL/imported/
+/GLB/*
+!/GLB/imported/
+/3MF/*
+!/3MF/imported/
+/tmp/
+__pycache__/
```

**File**: `models/radial/BUGS.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+# Repo defects found while building the radial
+
+Each entry: symptom, minimal trigger, workaround applied in this model. Only
+defects of the repo's tooling (cadgen / skills), not of the model itself.
+
+1. **STEP export can turn a valid solid into an invalid or garbage one.**
+   - `heads:seat_1I`: correct and valid in Python, but read back from the saved
+     STEP as a 2.85-litre "spike" (bbox 988 mm) — found by the kinematic gate.
+     Trigger: a seat ring made by a boolean with the chamber sphere, then cut by
+     the section cutter. Workaround: rebuilt the ring without the sphere boolean;
+     the heads build now round-trips every cut leaf through STEP and aborts on
+     growth.
+   - `heads:head_2`: passes BRepCheck at every build stage in memory; written to
+     STEP and read back, one small planar face at y = 109 in the intake-port
+     throat fails with `BadOrientationOfSubshape`. Trigger: a swept port bore
+     (circle along a spline, R24) meeting a straight cylindrical flange bore of
+     the same R24 → near-coincident surfaces leave a sliver face. Workaround: a
+     deliberate 0.4 mm step (R24.4 from y 104).
+   - `propshaft:thrust_inner`: balls fused into the inner race failed BRepCheck
+     only after the STEP round trip. Workaround: balls/cage as a separate body.
+   Expected: the canonical STEP writer should either preserve validity or fail
+   the build; today it silently writes an invalid/garbage solid.
+2. **`gate --static`-style exact distance on big finned castings is extremely
+   slow** (BRepExtrema: seconds to >10 min per pair on heads/crankcase); the
+   model's gate uses mesh screens + OCC booleans instead.
```

**File**: `models/radial/BUILDING.md` (added, +308/-0)
```diff
@@ -0,0 +1,308 @@
+# Building the radial — rules for every part builder
+
+Read this whole file before touching a module. Then read `src/lib/spec.py` (the
+frame and every shared number), `src/lib/kin.py` (where every moving part is),
+`src/lib/geo.py` (placement + the museum-section cutters) and skim
+`src/lib/palette.py`, `src/lib/castings.py`, `src/lib/fasteners.py`.
+
+The brief: a nine-cylinder, single-row, supercharged air-cooled radial,
+1930s–40s golden-age archetype (P&W R-1340 Wasp proportions: 146 × 146 mm,
+~1314 mm diameter), museum-restoration quality, UNBRANDED (no names, logos,
+cast-in badging, data-plate text). **Aesthetics are the primary objective; kinematics are
+non-negotiable.** Where beauty and function conflict on anything that does not
+move, choose beauty. Beauty decides what a part looks like; kinematics decide
+where it is.
+
+## Environment
+
+- Python: the repo's `.venv/bin/python` (cadgen is installed there, from
+  `requirements-dev.txt`). CLI: `.venv/bin/cadgen`.
+- Project root: `models/radial`. Run everything from there. Scratch work goes in
+  `tmp/` (gitignored).
+- Skill docs: `skills/cad/SKILL.md`
+  and `references/build123d-modeling.md` (read the pitfalls: `align=None`,
+  `.located()` vs `.moved()`, multi-tool booleans, tangent booleans, fillets
+  last; colour is linear unless via `srgb()`).
+- Your system: `src/<name>.py` is a thin wrapper (do not edit it); you write
+  `src/lib/<name>.py`, which must define
+  - `MATERIALS`: a tuple of the palette material ids your leaves use (exactly
+    those — the build fails on a mismatch), and
+  - `build() -> list[Shape]`: flat list of labelled, coloured leaf solids,
+    authored DIRECTLY in the engine frame at crank angle θ = 0.
+- Build your system alone: `python tools/engine.py system <name>` (writes
+  `STEP/<name>.step`; unchanged sources are no-ops).
+- Build the whole engine + render it: `python tools/engine.py build-render <job.json>`.
+  Assembly builds and renders are serialised across all builders by a lock; if it
+  says it is waiting, another builder is rendering — just wait.
+- Never edit `spec.py`, `kin.py`, `geo.py`, `palette.py`, `systems.py`,
+  `radial.py`, `tools/`, or another builder's module. If you need a shared number
+  changed, STOP and report it (say exactly what and why). Add helpers inside
+  your own module. You may import `castings`, `fasteners`, `geo`, `kin`, `spec`,
+  `palette` freely.
+- Never `git commit`. Never touch files outside `models/radial`.
+
+## The frame (memorise it)
+
+- **Y = crank axis, +Y = REAR** (blower/accessory section), **−Y = FRONT**
+  (propeller). **Z up. Cylinder 1 points straight up.** Seen from the front
+  (camera on −Y looking +Y), +X is to the right.
+- Crank turns clockwise seen from the rear = right-handed about `ROT_AXIS = (0,-1,0)`.
+  Cylinders are numbered in that sense: cylinder k sits at in-plane angle
+  `ALPHA(k) = 40(k−1)`; the unit vector at in-plane angle b is `(−sin b, 0, cos b)`
+  (so cylinder 2 is 40° toward −X; seen from the FRONT the numbering runs
+  counter-clockwise).
+- **Cylinder-local frame** (author per-cylinder parts once, for cylinder 1):
+  `h` along the cylinder axis from the crank centre (cyl 1: +Z), `y` along the
+  crank axis (+Y), `t` tangential (cyl 1: +X; points toward cylinder k−1).
+  `geo.on_cylinder(shape, k)` places a cylinder-1-authored copy on cylinder k
+  and shares geometry. `spec.cyl_point(k, h, y, t)` gives engine points.
+- **The model is authored at θ = 0**: crankpin on cylinder 1's axis, cylinder 1
+  at FIRING TDC. Everything that moves is placed by `kin` (below).
+
+## Architecture (settled — see `spec.SOURCES`)
+
+Firing order 1-3-5-7-9-2-4-6-8. Cam ring: 4 lobes per track, two tracks
+(intake + exhaust), 1/8 crank speed, turning AGAINST the crank, driven inside the
+ring by crank gear 32T → fixed compound idler 48T/15T → ring internal gear 80T.
+Reduction: 3:2 planetary — crank-driven internal bell gear 72T, FIXED sun 36T,
```

**File**: `models/radial/GAUNTLET.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+# Gauntlet log
+
+Protocol: per part, a fresh-context critic sees only two images — our in-context
+render (presentation envelope, presentation-large) and a museum/restoration
+photograph — as `a.png`/`b.png` in random order (`tools/critic_pack.py`; keys in
+`tmp/critic/keys/`, never shown to critics). Question: "which is more beautiful?"
+On a loss the critic names ONE largest gap, which goes back to the owner.
+
+## Part rounds
+
+| round | part | reference | ours | verdict | gap named (for the loser) | routed to |
+|---|---|---|---|---|---|---|
+| rods_r1 | rods | P_rods_01 | a | LOST (high) | "articulating rods look like stubby brass cup bushings on clevis stubs; no shanks reach the pistons" — the cups are the tappet guides in FRONT of the window: the rods are not visible in context | layout (window / nose cutaway / camera) |
+| crankshaft_r1 | crankshaft | P_crank_01 | b | LOST (medium) | "bronze sleeves float in the foreground and dwarf everything; the throw, counterweight and master-rod hub are hidden" — again the tappet guides, floating because the nose case is not built yet | cam (guides' look) + layout; part rounds paused until the core statics exist |
+| heads_r2 | heads | P_head_04 | b | LOST (high) | "rocker boxes are oversized flat-lidded rectangular blocks that dwarf the heads; should be small rounded cast housings blending into the head, beside tall thin tightly pitched fins" | heads |
+| barrels_r2 | barrels | P_barrel_02 | b | LOST (high) | "barrel fins read as a flat black block of shallow grooves; should be thin, deep, evenly spaced discs with light between them" | barrels |
+| pushrods_r2 | pushrods | B_02 | a | LOST (high) | "tubes read too thick (~1/3 cylinder width), crossing in a chaotic V, bulky gold sleeves pile up at the case; should be slim, one size, evenly spaced" | pushrods (+ cam: bronze guide flanges) |
+| pistons_r2 | pistons | P_piston_02 | a | LOST (medium) | "black speckled z-fighting on the wrist-pin boss; skirt ends in a flat faceted diagonal chop like a truncated cone; show the hollow interior, ribbed bosses, clean pin bore" | pistons |
+| valvetrain_r2 | valvetrain | P_head_03 | b | LOST (high) | "the two pushrods rise vertically through the middle of the cutaway, across valves, springs and chamber" | layout: section moved to cylinder 1's REAR half (no pushrods in front of it); front star now complete |
+| crankcase_r2 | crankcase | B_03 | b | LOST (high) | "front is a cut-open jumble of gear rings behind the prop hub, no readable nose case or harness ring" — nose case and harness not built yet at render time | nose / ignition (in progress); re-run |
+| valvetrain_r3 | valvetrain (rear section view) | P_head_03 | a | LOST (medium) | "section faces are the same grey as everything else, so walls, ports and chamber don't read; cut plane should be one distinct flat colour, solid wall around a carved chamber" | layout: museum-red section skins on every cut face (geo.cut_with_skin, palette.SECTION_RED) → heads, barrels, pistons, intake, exhaust, ignition, crankcase, nose |
+
+### Layout decisions forced by round 3 (whole-engine renders)
+- The FRONT exhaust collector hid the head-on star in every front view → exhaust moved to the REAR (rear-facing ports on the -t side, collector behind the cylinders). Heat tint re-based to warm stainless grey.
+- The nose cutaway's retained collar blocked every line of sight to the crankcase window → cutaway reworked so the rods show from the front-right three-quarter.
+- The mount ring's top arc crossed the rear section view → mount keeps the top clear.
+
+### User direction (2026-09-23)
+Part-level rounds stop after the in-flight iterations (heads rear exhaust port + red section, blower radial outlets → intake re-route, nose sightline, accessory). The user judged the parts good enough; no part has a recorded blind-A/B win. Work proceeds to the layout fixes, then the whole-engine gauntlet (four views), validation and animations.
+
+## Whol
```

---

### Incident Patch 2: `366937e3` (2026-09-17)
**Commit Message**: Stop MTEXT paragraph properties leaking into engraved text (#411)

`stripMtextFormatting` replaced the paragraph break `\P` case-insensitively, so lowercase `\p` (paragraph properties, which carry a payload up to a semicolon: `\pxqc;`, `\pxi-2,l2,t2;`) matched too, consuming two characters and leaving the payload in the engraved text. AutoCAD writes paragraph properties for centred or indented MTEXT, so centred labels engraved their alignment code.

Drop the `i` flag so `\P` only matches the break, and add `p` to the inline property-run class so `\p...;` is removed whole the way `\f...;` and `\H...;` already are.

Refiled from #385 on top of the runtime-bundle removal: same source and tests, without the two committed bundles that PR also patched and that no longer exist in the tree.

Closes #332. Supersedes #385.

Co-authored-by: NgoQuocViet2001 <ngoquocviet2001@gmail.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PZLP5p8ta3SJ3kqnntEuF7

**File**: `packages/cadgen-js/src/lib/dxf/parseDxf.js` (modified, +5/-2)
```diff
@@ -678,9 +678,12 @@ const NON_GEOMETRIC_ENTITY_TYPES = new Set([
 export function stripMtextFormatting(raw) {
   let text = String(raw ?? "");
   // \P is a paragraph break, \~ a hard space; \\ and \{ \} escape literals.
-  text = text.replace(/\\P/gi, "\n").replace(/\\~/g, " ");
+  // Case-sensitive: lowercase \p is paragraph PROPERTIES (\pxqc;), a different
+  // command carrying a payload up to a semicolon. Matching it here consumed
+  // only the two characters and left the rest in the text.
+  text = text.replace(/\\P/g, "\n").replace(/\\~/g, " ");
   // Inline property runs: \f...; \H...; \C...; \T...; \Q...; \W...; \A...; — command up to ;
-  text = text.replace(/\\[fFhHcCtTqQwWaA][^;]*;/g, "");
+  text = text.replace(/\\[fFhHcCtTqQwWaAp][^;]*;/g, "");
   // Stacking \S...^...; renders as the plain parts.
   text = text.replace(/\\S([^^;]*)\^([^;]*);/g, "$1/$2");
   // Grouping braces are structure, not content.
```

**File**: `packages/cadgen-js/src/lib/dxf/parseDxf.test.js` (modified, +21/-1)
```diff
@@ -1,7 +1,7 @@
 import assert from "node:assert/strict";
 import test from "node:test";
 
-import { parseDxf } from "./parseDxf.js";
+import { parseDxf, stripMtextFormatting } from "./parseDxf.js";
 
 function dxfText(lines) {
   return `${lines.join("\n")}\n`;
@@ -297,3 +297,23 @@ test("a HATCH's seed point is not read as another boundary vertex", () => {
     }
   }
 });
+
+const BS = String.fromCharCode(92);
+
+// \p is paragraph PROPERTIES; \P is a paragraph BREAK. Matching the break
+// case-insensitively consumed only the two characters of \p and left its
+// payload in the engraved text.
+test("MTEXT paragraph properties are removed whole", () => {
+  assert.equal(stripMtextFormatting(`${BS}pxqc;PART A`), "PART A");
+  assert.equal(stripMtextFormatting(`${BS}pxi-2,l2,t2;Item`), "Item");
+});
+
+test("an MTEXT paragraph break is still a newline", () => {
+  assert.equal(stripMtextFormatting(`Line1${BS}PLine2`), `Line1${String.fromCharCode(10)}Line2`);
+});
+
+test("other MTEXT inline property runs are unaffected", () => {
+  assert.equal(stripMtextFormatting(`${BS}H2.5x;BIG`), "BIG");
+  assert.equal(stripMtextFormatting(`${BS}C1;RED`), "RED");
+  assert.equal(stripMtextFormatting("plain"), "plain");
+});
```

---

### Incident Patch 3: `974b4427` (2026-09-16)
**Commit Message**: Three read-only test fixtures are built once per class (#408)

Follow-up to #399's test audit: test_generated_step_fidelity, test_step_export_target and test_mesh_export_store_reuse rebuilt the same document in every test and then only read it. Each now builds once in setUpClass and copies the script, the document and the store beside each test's own isolated roots (ClassCadRoots in tests/python/support/cad_test_roots.py). No test removed; 14 tests across the three files.

Per-file cost before, Linux / Windows CI: 14 / 63 s, 16 / 41 s, 31 / 72 s. Locally after: 6 s, 7 s, 16 s.

**File**: `tests/python/packages/cadgen/test_generated_step_fidelity.py` (modified, +34/-12)
```diff
@@ -25,7 +25,7 @@
 from cadgen import step_artifact_cli  # noqa: E402
 from cadgen._internal.step_assemble import assemble_step_from_package  # noqa: E402
 from cadgen.catalog import result_view_dir  # noqa: E402
-from tests.python.support.cad_test_roots import IsolatedCadRoots  # noqa: E402
+from tests.python.support.cad_test_roots import ClassCadRoots, IsolatedCadRoots  # noqa: E402
 
 # Two occurrences of DISTINCT parts with per-occurrence colors and a
 # kinematics block — the planetary pilot's shape of metadata, minimized.
@@ -56,26 +56,46 @@ def model():
 
 
 class GeneratedStepFidelityTests(unittest.TestCase):
+    # The generated package is built ONCE for the class: every test reads it (or
+    # assembles and imports a COPY into its own store), none rebuilds it.
+    @classmethod
+    def setUpClass(cls) -> None:
+        super().setUpClass()
+        cls._class_roots = ClassCadRoots(prefix="cadfid-seed-")
+        cls._seed_dir = cls._class_roots.cad_root / "seed"
+        cls._seed_dir.mkdir()
+        generator = cls._seed_dir / "colored.py"
+        generator.write_text(COLORED_ASSEMBLY_GENERATOR, encoding="utf-8")
+        payload = step_artifact_cli.build_step_artifact(
+            repo_root=Path.cwd(),
+            step=cls._seed_dir / "colored.step",
+            source_path=generator,
+        )
+        if not payload.get("ok"):
+            raise RuntimeError(f"the seed package could not be built: {payload}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._class_roots.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._isolated_roots = IsolatedCadRoots(self, prefix="cadfid-")
         self._tempdir = self._isolated_roots.temporary_cad_directory(prefix="tmp-cadfid-")
         self.temp_root = Path(self._tempdir.name)
+        self._class_roots.copy_store_into(self._isolated_roots)
 
     def tearDown(self) -> None:
         shutil.rmtree(self.temp_root, ignore_errors=True)
         self._tempdir.cleanup()
 
     def _build_generated_package(self) -> tuple[Path, Path]:
-        generator = self.temp_root / "colored.py"
-        generator.write_text(COLORED_ASSEMBLY_GENERATOR, encoding="utf-8")
-        logical_step = self.temp_root / "colored.step"
-        payload = step_artifact_cli.build_step_artifact(
-            repo_root=Path.cwd(),
-            step=logical_step,
-            source_path=generator,
-        )
-        self.assertTrue(payload.get("ok"), payload)
-        return generator, logical_step
+        """The seed build's script, document and sidecar, copied beside this test's store."""
+        for name in ("colored.py", "colored.step", "colored.step.json"):
+            source = self._seed_dir / name
+            if source.is_file():
+                shutil.copyfile(source, self.temp_root / name)
+        return self.temp_root / "colored.py", self.temp_root / "colored.step"
 
     def _descriptor(self, step_path: Path) -> dict:
         return json.loads(
@@ -108,7 +128,9 @@ def test_generated_descriptor_records_occurrence_colors_and_pose(self) -> None:
         self.assertNotIn("sourcePath", sidecar)
         from cadgen._internal.source_sidecar import read_source_provenance
 
-        provenance = read_source_provenance(logical_step) or {}
+        # Provenance is the model RECORD behind the document, keyed by the path the
+        # model wrote; the copied store carries it under the seed's path.
+        provenance = read_source_provenance(self._seed_dir / "colored.step") or {}
         self.assertEqual(provenance.get("sourceKind"), "python")
 
     def test_assembled_step_carries_occurrence_colors_and_no_cadgen_metadata(self) -> None:
```

**File**: `tests/python/packages/cadgen/test_mesh_export_store_reuse.py` (modified, +29/-5)
```diff
@@ -16,6 +16,7 @@
 from __future__ import annotations
 
 import os
+import shutil
 import subprocess
 import sys
 import tempfile
@@ -52,10 +53,38 @@ def model():
 
 
 class MeshExportStoreReuseTest(unittest.TestCase):
+    # block.py is built cold ONCE for the class; each test gets a copy of the
+    # project (script, document, store) and drives the doors against that copy.
+    @classmethod
+    def setUpClass(cls) -> None:
+        super().setUpClass()
+        cls._seed_tmp = tempfile.TemporaryDirectory(prefix="mesh-export-store-seed-")
+        cls._seed_root = Path(cls._seed_tmp.name).resolve()
+        entry = _write_model(cls._seed_root, size=6.0)
+        env = dict(os.environ)
+        env.update({
+            "CADGEN_DAEMON": "0",
+            "CADGEN_COMPONENT_WORKERS": "1",
+            "CADGEN_CACHE_DIR": str(cls._seed_root / "store"),
+            "PYTHONPATH": str(REPO / "packages/cadgen/src"),
+        })
+        build = subprocess.run(
+            [PYTHON, entry.name], cwd=str(cls._seed_root), env=env,
+            capture_output=True, text=True, timeout=600,
+        )
+        if build.returncode != 0 or not (cls._seed_root / "block.step").is_file():
+            raise RuntimeError(f"the seed build failed:\n{build.stdout}{build.stderr}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._seed_tmp.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._tmp = tempfile.TemporaryDirectory(prefix="mesh-export-store-")
         self.addCleanup(self._tmp.cleanup)
         self.root = Path(self._tmp.name).resolve()
+        shutil.copytree(self._seed_root, self.root, dirs_exist_ok=True)
         self.store = self.root / "store"
         self.env = dict(os.environ)
         self.env.update({
@@ -95,9 +124,6 @@ def _package_dirs(self) -> set[str]:
         return {p.name for p in records.iterdir() if p.is_file()}
 
     def test_a_generated_document_exports_current_and_after_source_edit(self) -> None:
-        entry = _write_model(self.root, size=6.0)
-        build = self._run([entry.name], self.root)
-        self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
         step_file = self.root / "block.step"
         self.assertTrue(step_file.is_file(), "model script writes its STEP")
 
@@ -131,8 +157,6 @@ def test_a_generated_document_exports_current_and_after_source_edit(self) -> Non
     def test_an_imported_document_writes_defaults_then_reuses_one_compilation(self) -> None:
         # A door reads no declarations: a bare door tessellates the document's
         # tree and writes ONE mesh beside it — imported or generated alike.
-        entry = _write_model(self.root, size=6.0)
-        self.assertEqual(0, self._run([entry.name], self.root).returncode)
         imported = self.root / "imported_block.step"
         imported.write_bytes((self.root / "block.step").read_bytes() + b"\n")
         self.assertFalse(imported.with_suffix(".step.json").exists(), "an import has no sidecar")
```

**File**: `tests/python/packages/cadgen/test_step_export_target.py` (modified, +36/-15)
```diff
@@ -16,7 +16,7 @@
 
 from cadgen import render as cad_render  # noqa: E402
 from cadgen import step_export_target  # noqa: E402
-from tests.python.support.cad_test_roots import IsolatedCadRoots  # noqa: E402
+from tests.python.support.cad_test_roots import ClassCadRoots, IsolatedCadRoots  # noqa: E402
 
 # A tiny generated model: model() returns a single labeled solid.
 BOX_GENERATOR = """from build123d import Box
@@ -43,12 +43,43 @@ def model():
 
 
 class StepExportTargetTests(unittest.TestCase):
+    # box.step (and its re-export, box_document.step) are built ONCE for the
+    # class: every test reads them through the export ABI and rebuilds nothing.
+    @classmethod
+    def setUpClass(cls) -> None:
+        from cadgen.generation import generate_step_targets
+
+        super().setUpClass()
+        cls._class_roots = ClassCadRoots(prefix="cadexp-seed-")
+        cls._seed_dir = cls._class_roots.cad_root / "seed"
+        cls._seed_dir.mkdir()
+        generator = cls._seed_dir / "box.py"
+        generator.write_text(BOX_GENERATOR, encoding="utf-8")
+        if generate_step_targets([str(generator)]) != 0 or not (cls._seed_dir / "box.step").is_file():
+            raise RuntimeError("the model script wrote no box.step")
+        buffer = StringIO()
+        with redirect_stdout(buffer):
+            code = step_export_target.main([
+                "--repo-root", str(Path.cwd()),
+                "--step", str(cls._seed_dir / "box.step"),
+                "--format", "step",
+                "--out", str(cls._seed_dir / "box_document.step"),
+            ])
+        if code != 0:
+            raise RuntimeError(f"the seed re-export failed: {buffer.getvalue()}")
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls._class_roots.cleanup()
+        super().tearDownClass()
+
     def setUp(self) -> None:
         self._isolated_roots = IsolatedCadRoots(self, prefix="cadexp-")
         self._tempdir = self._isolated_roots.temporary_cad_directory(prefix="tmp-cadexp-")
         self.temp_root = Path(self._tempdir.name)
         self.out_dir = self.temp_root / "out"
         self.out_dir.mkdir(parents=True, exist_ok=True)
+        self._class_roots.copy_store_into(self._isolated_roots)
 
     def tearDown(self) -> None:
         shutil.rmtree(self.temp_root, ignore_errors=True)
@@ -77,13 +108,10 @@ def _write_box_generator(self) -> Path:
 
     def _build_box_document(self) -> Path:
         """``box.step``, written the ONE way a document is written: by running
-        the model script. The export ABI takes documents and nothing else."""
-        from cadgen.generation import generate_step_targets
-
-        generator = self._write_box_generator()
-        self.assertEqual(0, generate_step_targets([str(generator)]))
+        the model script (once, in setUpClass). The export ABI takes documents
+        and nothing else."""
         document = self.temp_root / "box.step"
-        self.assertTrue(document.is_file(), "the model script wrote no box.step")
+        shutil.copyfile(self._seed_dir / "box.step", document)
         return document
 
     def test_the_export_abi_takes_documents_only(self) -> None:
@@ -141,15 +169,8 @@ def _write_box_document(self) -> Path:
         DOCUMENTS-ONLY: `export_cad_target` is the engine behind
         `cadgen stl|3mf|glb build`, which never sees a script.
         """
-        built = self._build_box_document()
         document = self.temp_root / "box_document.step"
-        code, payload = self._run([
-            "--repo-root", str(Path.cwd()),
-            "--step", str(built),
-            "--format", "step",
-            "--out", str(document),
-        ])
-        self.assertEqual(code, 0, payload)
+        shutil.copyfile(self._seed_dir / "box_document.step", document)
         return document
 
     def test_export_cad_target_rejects_step_format(self) -> None:
```

**File**: `tests/python/support/cad_test_roots.py` (modified, +26/-0)
```diff
@@ -53,3 +53,29 @@ def restore_cache_dir() -> None:
 
     def temporary_cad_directory(self, *, prefix: str) -> tempfile.TemporaryDirectory[str]:
         return tempfile.TemporaryDirectory(prefix=prefix, dir=self.cad_root)
+
+
+class ClassCadRoots:
+    """:class:`IsolatedCadRoots` for a ``setUpClass``: one build, every test reads it.
+
+    A fixture that every test only READS is built once here, under the same cwd and
+    store isolation a test gets, with the cleanups held until ``tearDownClass``
+    (``IsolatedCadRoots`` registers them on a TestCase, so a bare one stands in).
+    Each test then gets its own :class:`IsolatedCadRoots` as before and
+    :meth:`copy_store_into` it: the store is content-addressed, so a document
+    copied beside it is served from the copied store exactly as from the one
+    that built it, and whatever a test then writes lands in its own copy.
+    """
+
+    def __init__(self, *, prefix: str) -> None:
+        self._case = unittest.TestCase()
+        self.roots = IsolatedCadRoots(self._case, prefix=prefix)
+        self.cad_root = self.roots.cad_root
+
+    def copy_store_into(self, roots: IsolatedCadRoots) -> None:
+        import shutil
+
+        shutil.copytree(self.roots.cache_dir, roots.cache_dir, dirs_exist_ok=True)
+
+    def cleanup(self) -> None:
+        self._case.doCleanups()
```

---

### Incident Patch 4: `05bda7b7` (2026-09-16)
**Commit Message**: A leftover .step.js and a removed memory knob warn instead of refusing

Both are things nothing reads: the retired render module beside a document
and the removed CADGEN_WORKER_MEMORY_MB / CADGEN_DEPENDENCY_MEMORY_MB
settings. Neither can make a build's output wrong, so neither stops one.
Each is named once on stderr with its replacement; the viewer keeps its
model warning for the file. The cad_material entry points and the removed
display modes stay errors: those are calls whose effect would silently
vanish.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `packages/cadgen/src/cadgen/_internal/generation.py` (modified, +27/-18)
```diff
@@ -1047,18 +1047,13 @@ def _entries_by_step_path(specs: Sequence[EntrySpec]) -> dict[Path, EntrySpec]:
     }
 
 
-class RetiredRenderModuleError(ValueError):
-    """A ``<name>.step.js`` still sits beside a model's declared STEP output."""
-
-
 def retired_render_module_path(step_path: Path) -> Path | None:
     """The stale ``<out>.step.js`` / ``<out>.stp.js`` beside ``step_path``.
 
     Animation used to live in a companion ES module discovered by convention.
     It does not any more: ``@step(animation=...)`` embeds the module text in
     the document's sidecar, which is what every renderer reads. A leftover file
-    is therefore not read by anything, and the failure it produces is the one
-    law 10 forbids -- a model that renders inert, at exit 0.
+    is therefore read by nothing.
     """
     if step_path is None:
         return None
@@ -1069,22 +1064,36 @@ def retired_render_module_path(step_path: Path) -> Path | None:
         return None
 
 
-def _refuse_retired_render_module(spec: EntrySpec) -> None:
-    """Law 8 at the source door: the retired file fails, naming what replaced it."""
-    if spec.source != "generated" or not spec.step_output:
-        return
-    companion = retired_render_module_path(spec.step_path)
-    if companion is None:
-        return
-    raise RetiredRenderModuleError(
-        f"{_display_path(companion)} is a retired render module and is read by nothing. "
+_WARNED_RETIRED_RENDER_MODULES: set[str] = set()
+
+
+def retired_render_module_warning(companion: Path) -> str:
+    return (
+        f"warning: {_display_path(companion)} is a retired render module and is read by nothing. "
         "Animation is declared on the model: @step(animation=...) embeds the module text "
         "in the document's sidecar, which is what the viewer, snapshots and mesh exports "
         "read. Move this file's clips into the decorator and delete it; "
         "see the cad skill's kinematics reference (references/kinematics.md)."
     )
 
 
+def _warn_retired_render_module(spec: EntrySpec) -> None:
+    """A stray file nothing reads does not stop a build: the document is still
+    correct without it. It is named once per run, on stderr, with the replacement,
+    so the migration is visible without being enforced (the Viewer shows the same
+    text as a model warning)."""
+    if spec.source != "generated" or not spec.step_output:
+        return
+    companion = retired_render_module_path(spec.step_path)
+    if companion is None:
+        return
+    key = str(companion)
+    if key in _WARNED_RETIRED_RENDER_MODULES:
+        return
+    _WARNED_RETIRED_RENDER_MODULES.add(key)
+    print(retired_render_module_warning(companion), file=sys.stderr)
+
+
 def _validate_step_target(spec: EntrySpec, *, tool_name: str) -> None:
     if spec.step_path is None:
         raise ValueError(f"{tool_name} target has no STEP path: {spec.source_ref}")
@@ -1093,9 +1102,9 @@ def _validate_step_target(spec: EntrySpec, *, tool_name: str) -> None:
         if metadata is None or metadata.format != "step":
             raise ValueError(f"{tool_name} target is not a @step model: {spec.source_ref}")
         # Here rather than in the build: a model whose tree is already current
-        # takes the no-op path, and a retired file beside its document must
-        # fail every run, not only the ones that rebuild geometry.
-        _refuse_retired_render_module(spec)
+        # takes the no-op path, and a retired file beside its document must be
+        # named on every run, not only the ones that rebuild geometry.
+        _warn_retired_render_module(spec)
         return
     raise ValueError(
         f"{tool_name} builds @step Python sources only: {spec.source_ref}. "
```

**File**: `packages/cadgen/src/cadgen/daemon/memory.py` (modified, +6/-3)
```diff
@@ -106,12 +106,15 @@ def dependency_reserve(self, reservation: int) -> int:
     def from_environment(cls) -> "MemoryPolicy":
         for name, described in _REMOVED_SETTINGS.items():
             if os.environ.get(name, "").strip():
-                raise ValueError(
-                    f"{name} was removed: {described} is not configurable. A worker is "
+                # A stale setting cannot make admission wrong, only do nothing:
+                # say so once at policy construction and carry on.
+                print(
+                    f"warning: {name} is ignored: {described} is not configurable. A worker is "
                     f"charged a {WORKER_SEED_BYTES // MIB} MiB seed until the pool has measured an "
                     "idle worker of its own, then the observed baseline, and the dependency "
                     "headroom follows from that same number. Size the whole budget with "
-                    "CADGEN_MEMORY_MB instead (0 disables admission)."
+                    "CADGEN_MEMORY_MB instead (0 disables admission).",
+                    file=sys.stderr,
                 )
         # Leave 30% to the daemon, browser and other applications. An explicit
         # zero disables admission; unknown host capacity also leaves it off.
```

**File**: `tests/python/packages/cadgen/test_daemon_memory.py` (modified, +14/-6)
```diff
@@ -42,13 +42,21 @@ def test_policy_reserves_dependency_capacity_and_honors_explicit_zero(self):
             with mock.patch.dict(os.environ, {"CADGEN_MEMORY_MB": "0"}):
                 self.assertEqual(memory.MemoryPolicy.from_environment().limit_bytes, 0)
 
-    def test_removed_worker_reservation_settings_teach_instead_of_being_ignored(self):
+    def test_removed_worker_reservation_settings_are_ignored_with_a_warning(self):
+        import contextlib
+        import io
+
         for name in ("CADGEN_WORKER_MEMORY_MB", "CADGEN_DEPENDENCY_MEMORY_MB"):
-            with self.subTest(name), mock.patch.dict(os.environ, {name: "512"}):
-                with self.assertRaisesRegex(ValueError, f"{name} was removed") as raised:
-                    memory.MemoryPolicy.from_environment()
-                self.assertIn("CADGEN_MEMORY_MB", str(raised.exception))
-                self.assertIn("512 MiB seed", str(raised.exception))
+            env = {name: "512", "CADGEN_MEMORY_MB": "1024"}
+            with self.subTest(name), mock.patch.dict(os.environ, env):
+                stderr = io.StringIO()
+                with contextlib.redirect_stderr(stderr):
+                    policy = memory.MemoryPolicy.from_environment()
+                # The stale knob changes nothing; the budget still applies.
+                self.assertEqual(1024 * MIB, policy.limit_bytes)
+                self.assertEqual(memory.WORKER_SEED_BYTES, policy.seed_bytes)
+                self.assertIn(f"warning: {name} is ignored", stderr.getvalue())
+                self.assertIn("CADGEN_MEMORY_MB", stderr.getvalue())
 
     def test_baseline_is_the_leanest_never_used_worker_and_never_below_the_seed(self):
         seed = memory.WORKER_SEED_BYTES
```

**File**: `tests/python/packages/cadgen/test_retired_render_module.py` (modified, +31/-28)
```diff
@@ -1,18 +1,19 @@
-"""A leftover ``<name>.step.js`` fails the build, naming what replaced it.
+"""A leftover ``<name>.step.js`` is named on every run, and the build goes on.
 
 Animation used to be a companion ES module discovered by convention beside the
 document. It is now ``@step(animation=...)``, embedded in the document's
 sidecar, and nothing looks for the file any more. So a project carrying one
-across the cutover gets exactly the failure law 10 forbids: a model that used
-to articulate renders inert, at exit 0, with no message anywhere.
+across the cutover would get exactly the failure law 10 forbids: a model that
+used to articulate renders inert, at exit 0, with no message anywhere.
 
-Law 8 says a retired surface fails loudly and names its replacement, which is
-what these pin -- including on the run that rebuilds NOTHING, because a model
-whose tree is already current takes the no-op path and would otherwise sail
-past the check.
+The file is read by nothing, so the document a build writes is correct without
+it: a stray file is not a reason to refuse the build. It is a reason to say so,
+once per run on stderr, naming the replacement -- including on the run that
+rebuilds NOTHING, because a model whose tree is already current takes the no-op
+path and would otherwise sail past the check.
 
-The viewer's half is the opposite by law 1 (a door never refuses a document):
-it warns and renders. That is ``viewer/test_artifact_status.py``.
+The viewer says the same thing as a model warning (law 1: a door never refuses
+a document). That is ``viewer/test_artifact_status.py``.
 """
 
 from __future__ import annotations
@@ -49,7 +50,7 @@ def model():
 RETIRED_MODULE = "export const clips = { spin: { duration: 1, update() {} } };\n"
 
 
-class RetiredRenderModuleFailsTheBuild(unittest.TestCase):
+class RetiredRenderModuleWarns(unittest.TestCase):
     def setUp(self) -> None:
         self._tmp = tempfile.TemporaryDirectory(prefix="retired-render-module-")
         self.addCleanup(self._tmp.cleanup)
@@ -73,30 +74,32 @@ def _build(self) -> subprocess.CompletedProcess:
             capture_output=True, text=True, timeout=600,
         )
 
-    def test_the_build_refuses_and_names_the_decorator_and_the_reference(self) -> None:
+    def test_the_build_warns_names_the_decorator_and_still_writes_the_document(self) -> None:
         self.companion.write_text(RETIRED_MODULE, encoding="utf-8")
-        refused = self._build()
-        output = refused.stdout + refused.stderr
-
-        self.assertNotEqual(0, refused.returncode, output)
-        self.assertIn("part.step.js", output)
-        self.assertIn("@step(animation=...)", output)
-        self.assertIn("kinematics", output)
-        # Loud, and nothing half-written behind it.
-        self.assertFalse(self.document.exists(), "the refused build wrote its document")
-
-    def test_removing_it_builds_and_putting_it_back_refuses_the_no_op_run(self) -> None:
+        built = self._build()
+        output = built.stdout + built.stderr
+
+        self.assertEqual(0, built.returncode, output)
+        self.assertIn("warning:", built.stderr)
+        self.assertIn("part.step.js", built.stderr)
+        self.assertIn("@step(animation=...)", built.stderr)
+        self.assertIn("kinematics", built.stderr)
+        # A stray file nothing reads does not stop the build.
+        self.assertTrue(self.document.is_file(), "the build did not write its document")
+
+    def test_the_no_op_run_warns_too(self) -> None:
         clean = self._build()
         self.assertEqual(0, clean.returncode, clean.stdout + clean.stderr)
-        self.assertTrue(self.document.is_file())
+        self.assertNotIn("retired render module", clean.stderr)
 
         # Nothing about the model changed, so this run rebuilds nothing at all.
-        # The refusal still has to land: a check that only ran when geometry
-        # was recomputed would let the stale file survive every later run.
+        # The warning sti
```

---

### Incident Patch 5: `892538f1` (2026-09-16)
**Commit Message**: Merge claude/memory-self-calibration: worker reservation calibrates from measured spares; per-worker knobs removed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `packages/cadgen/STORE.md` (modified, +15/-4)
```diff
@@ -845,7 +845,13 @@ CPU scheduling and reuse remain independent of memory admission:
 **Memory admission.** The daemon sums worker RSS including extraction
 descendants, pending spawn reservations, and retiring workers until they exit.
 Idle workers are reclaimed oldest first. Busy/suspended workers retain at
-least a worker reservation. Ordinary root requests preserve dependency
+least a worker reservation. That reservation is calibrated, not configured: it
+starts at a 512 MiB seed and, on every accounting pass, becomes the lowest RSS
+among workers that are idle and have served no job — what a worker costs once
+it has imported the kernel and before it holds any geometry — never below the
+seed. A worker that has run a body is excluded, so retained geometry cannot
+inflate the reservation that keeps it resident; the dependency headroom is
+derived from the same number. Ordinary root requests preserve dependency
 headroom; nested requests can spend it. A known oversized root reservation or
 retained worker may use that headroom only as the sole worker charge, and
 only within the total allowance. A request that cannot fit waits while builds
@@ -863,15 +869,20 @@ active shared work is not killed merely to recover budget.
 | Setting | Default |
 |---|---|
 | `CADGEN_MEMORY_MB` | 70% of discovered physical/cgroup RAM; `0` disables |
-| `CADGEN_WORKER_MEMORY_MB` | up to 2048 MiB, scaled down for smaller limits |
-| `CADGEN_DEPENDENCY_MEMORY_MB` | one worker reservation, bounded by the limit |
 | `CADGEN_COMPONENT_MEMORY_MB` | 384 MiB per extraction subprocess |
 
+The per-worker reservation and the dependency headroom have no settings; the
+pool calibrates both. Setting the removed `CADGEN_WORKER_MEMORY_MB` or
+`CADGEN_DEPENDENCY_MEMORY_MB` is an error at policy construction rather than a
+value silently ignored.
+
 This is a soft admission envelope, not a native allocator limit. A single
 OCCT operation may grow between RSS samples. Where RSS cannot be enumerated,
 reservations still apply. Transient execution receives extraction-pool sizing,
 but has no daemon-wide aggregate process budget. CPU slot counts remain upper
-bounds, and extraction concurrency also fits the parent worker allowance.
+bounds, and extraction concurrency also fits a per-worker extraction ceiling
+(a third of the budget, capped at 2048 MiB), which is not the admission
+reservation and is likewise unconfigurable.
 Geometry publication no longer starts extraction subprocesses for native
 components. Surface requests use the shared artifact-job admission and one
 private derivation per requested component; they have no model binding,
```

**File**: `packages/cadgen/src/cadgen/daemon/memory.py` (modified, +62/-11)
```diff
@@ -14,11 +14,24 @@
 import time
 from dataclasses import dataclass
 from pathlib import Path
-from typing import Mapping
+from typing import Iterable, Mapping
 
 MIB = 1024 * 1024
-DEFAULT_WORKER_BYTES = 2048 * MIB
+# A worker that has imported the kernel and built nothing sits at roughly 480 MiB
+# resident. This seed is the reservation until the pool has measured a worker of
+# its own, and the floor a measured baseline may never fall below.
+WORKER_SEED_BYTES = 512 * MIB
 DEFAULT_COMPONENT_BYTES = 384 * MIB
+# One worker's own ceiling for extraction subprocesses. Not admission's
+# reservation: admission bounds the daemon as a whole, this only stops a single
+# worker's subprocess fan-out from claiming the entire budget.
+EXTRACTION_CEILING_BYTES = 2048 * MIB
+
+# Removed knobs. Their teaching error names the calibration that replaced them.
+_REMOVED_SETTINGS = {
+    "CADGEN_WORKER_MEMORY_MB": "the per-worker reservation",
+    "CADGEN_DEPENDENCY_MEMORY_MB": "the dependency headroom",
+}
 
 
 def _megabytes(name: str, default: int) -> int:
@@ -77,21 +90,58 @@ class Status(ctypes.Structure):
 
 @dataclass(frozen=True)
 class MemoryPolicy:
+    """The budget and the seed. The per-worker reservation is not configured:
+    the pool calibrates it from the workers it can see (``worker_baseline``).
+    """
+
     limit_bytes: int
-    worker_bytes: int = DEFAULT_WORKER_BYTES
-    dependency_bytes: int = DEFAULT_WORKER_BYTES
+    seed_bytes: int = WORKER_SEED_BYTES
     component_bytes: int = DEFAULT_COMPONENT_BYTES
 
+    def dependency_reserve(self, reservation: int) -> int:
+        """Headroom an ordinary root request keeps so a nested request can run."""
+        return min(reservation, max(0, self.limit_bytes - reservation))
+
     @classmethod
     def from_environment(cls) -> "MemoryPolicy":
+        for name, described in _REMOVED_SETTINGS.items():
+            if os.environ.get(name, "").strip():
+                raise ValueError(
+                    f"{name} was removed: {described} is not configurable. A worker is "
+                    f"charged a {WORKER_SEED_BYTES // MIB} MiB seed until the pool has measured an "
+                    "idle worker of its own, then the observed baseline, and the dependency "
+                    "headroom follows from that same number. Size the whole budget with "
+                    "CADGEN_MEMORY_MB instead (0 disables admission)."
+                )
         # Leave 30% to the daemon, browser and other applications. An explicit
         # zero disables admission; unknown host capacity also leaves it off.
         limit = _megabytes("CADGEN_MEMORY_MB", physical_memory_bytes() * 7 // 10)
-        default_worker = min(DEFAULT_WORKER_BYTES, max(256 * MIB, limit // 3)) if limit else DEFAULT_WORKER_BYTES
-        worker = max(MIB, _megabytes("CADGEN_WORKER_MEMORY_MB", default_worker))
-        dependency = _megabytes("CADGEN_DEPENDENCY_MEMORY_MB", min(worker, max(0, limit - worker)))
         component = max(MIB, _megabytes("CADGEN_COMPONENT_MEMORY_MB", DEFAULT_COMPONENT_BYTES))
-        return cls(limit, worker, dependency, component)
+        return cls(limit, component_bytes=component)
+
+
+def worker_baseline(samples: Iterable[int], *, seed: int, previous: int = 0) -> int:
+    """What a worker costs before geometry, from workers that have run nothing.
+
+    The minimum of the samples, never below ``seed``. Only workers that are idle
+    and have served no job are offered: a worker that has run a body retains its
+    geometry and op-memo caches, so its RSS answers what a build cost, and
+    admitting it would let a fat idle worker inflate the very reservation that
+    keeps it resident. Among never-used workers the only spread is a partial
+    import, which reads low and the seed absorbs, so the minimum is both the
+    faithful figure and the one no sample can talk upwards. With no sample the
+    previous baseline stands -- every worker busy is exactly when the estimate

```

**File**: `packages/cadgen/src/cadgen/daemon/pool.py` (modified, +39/-22)
```diff
@@ -6,7 +6,11 @@
 of one job — and runs now. A request for a model with no worker binds a spare. A
 request with no spare left spawns if its memory reservation fits. Admission
 counts resident worker trees (including extraction children), keeps headroom
-for dependencies, and reclaims idle workers first. Exhaustion waits for the
+for dependencies, and reclaims idle workers first. That reservation is not
+configured: it starts at the seed and is recalibrated on every accounting pass
+from the RSS of workers that are idle and have run nothing, which is what a
+worker costs before geometry (``memory.worker_baseline``). The dependency
+headroom follows from the same number. Exhaustion waits for the
 builds in flight to finish (a parent fanning out its children submits them all
 at once, and only a core's worth can run) and fails explicitly only when nothing
 is running that could release memory. These are soft RSS and
@@ -42,7 +46,7 @@
 import threading
 import time
 
-from cadgen.daemon.memory import MemoryPolicy, MIB, process_tree_bytes
+from cadgen.daemon.memory import MemoryPolicy, MIB, process_tree_bytes, worker_baseline
 
 DEFAULT_SPARES = 2
 DEFAULT_RECYCLE_AFTER = 1000
@@ -292,6 +296,9 @@ def __init__(self, clock=time.monotonic, *, policy: MemoryPolicy | None = None,
         self._active_pending = 0
         self._spares_pending = 0
         self._policy = policy if policy is not None else MemoryPolicy.from_environment()
+        # What one worker is estimated to cost. The seed until a never-used idle
+        # worker has been measured; recalibrated by every _memory_locked.
+        self._reservation = self._policy.seed_bytes
         self._memory_reader = memory_reader or process_tree_bytes
         # How many jobs hold a run slot right now. Each one hands its charge back when
         # it finishes, so admission waits on them instead of refusing.
@@ -322,9 +329,10 @@ def ensure_spares(self) -> None:
             borrowed = sum(worker.busy and not worker.model for worker in self._workers)
             want = spare_count() - len(self._spares_locked()) - borrowed - self._spares_pending
             if self._policy.limit_bytes:
-                usage = self._memory_locked()["chargedBytes"]
-                available = self._policy.limit_bytes - self._policy.dependency_bytes - usage
-                want = min(want, max(0, available // self._policy.worker_bytes))
+                snapshot = self._memory_locked()
+                available = (self._policy.limit_bytes - snapshot["dependencyReserveBytes"]
+                             - snapshot["chargedBytes"])
+                want = min(want, max(0, available // max(1, snapshot["workerReservationBytes"])))
             if want <= 0:
                 return
             self._spares_pending += want
@@ -375,7 +383,7 @@ def acquire(self, model: str = "", *, dependency: bool = False) -> Worker:
                 worker.busy = True  # reserve before releasing the bookkeeping lock
             try:
                 self._admit_locked(
-                    additional=0 if worker else self._policy.worker_bytes,
+                    spawning=worker is None,
                     dependency=dependency,
                     isolated_worker=worker,
                 )
@@ -387,10 +395,7 @@ def acquire(self, model: str = "", *, dependency: bool = False) -> Worker:
                     self._stats["memoryReclaims"] += 1
                     self._drop_locked(worker)
                     worker = None
-                    self._admit_locked(
-                        additional=self._policy.worker_bytes,
-                        dependency=dependency,
-                    )
+                    self._admit_locked(spawning=True, dependency=dependency)
                 else:
                     raise
             if worker is None:
@@ -432,16 +437,24 @@ def _memory_locked(self) -> dict:
         workers = [*self._workers, *self._retiring]
         measured = self._memory_reader([w.pid for w in 
```

**File**: `tests/python/packages/cadgen/test_daemon_artifacts_native.py` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ def assert_geometry_and_result(self, result):
     def daemon(self, child_prelude):
         address = transport.private_address(transport.identity_digest(str(self.root) + "native-server"))
         listener = transport.Server(address, self.private.key, backlog=8)
-        workers = pool.Pool(policy=MemoryPolicy(limit_bytes=1024 * MIB, worker_bytes=1024 * MIB, dependency_bytes=0))
+        workers = pool.Pool(policy=MemoryPolicy(limit_bytes=1024 * MIB, seed_bytes=1024 * MIB))
         ledger, handlers = JobLedger(), []
         processes = []
         original_popen = subprocess.Popen
```

**File**: `tests/python/packages/cadgen/test_daemon_memory.py` (modified, +120/-11)
```diff
@@ -31,17 +31,36 @@ def test_cycles_and_missing_processes_do_not_hang_or_invent_rss(self):
         self.assertEqual(memory.process_tree_bytes([10, 99], rows=rows), {10: 100})
 
     def test_policy_reserves_dependency_capacity_and_honors_explicit_zero(self):
-        env = {key: "" for key in ("CADGEN_MEMORY_MB", "CADGEN_WORKER_MEMORY_MB",
-                                  "CADGEN_DEPENDENCY_MEMORY_MB", "CADGEN_COMPONENT_MEMORY_MB")}
+        env = {key: "" for key in ("CADGEN_MEMORY_MB", "CADGEN_COMPONENT_MEMORY_MB")}
         with mock.patch.dict(os.environ, env), mock.patch.object(memory, "physical_memory_bytes", return_value=12 * 1024 * MIB):
             policy = memory.MemoryPolicy.from_environment()
             self.assertEqual(policy.limit_bytes, 12 * 1024 * MIB * 7 // 10)
-            self.assertEqual(policy.dependency_bytes, policy.worker_bytes)
+            self.assertEqual(policy.seed_bytes, memory.WORKER_SEED_BYTES)
+            # Headroom for one nested request, derived from the same reservation.
+            self.assertEqual(policy.dependency_reserve(policy.seed_bytes), policy.seed_bytes)
+            self.assertEqual(memory.MemoryPolicy(600 * MIB).dependency_reserve(512 * MIB), 88 * MIB)
             with mock.patch.dict(os.environ, {"CADGEN_MEMORY_MB": "0"}):
                 self.assertEqual(memory.MemoryPolicy.from_environment().limit_bytes, 0)
 
+    def test_removed_worker_reservation_settings_teach_instead_of_being_ignored(self):
+        for name in ("CADGEN_WORKER_MEMORY_MB", "CADGEN_DEPENDENCY_MEMORY_MB"):
+            with self.subTest(name), mock.patch.dict(os.environ, {name: "512"}):
+                with self.assertRaisesRegex(ValueError, f"{name} was removed") as raised:
+                    memory.MemoryPolicy.from_environment()
+                self.assertIn("CADGEN_MEMORY_MB", str(raised.exception))
+                self.assertIn("512 MiB seed", str(raised.exception))
+
+    def test_baseline_is_the_leanest_never_used_worker_and_never_below_the_seed(self):
+        seed = memory.WORKER_SEED_BYTES
+        self.assertEqual(memory.worker_baseline([], seed=seed), seed)
+        # A partial import reads low; the seed absorbs it.
+        self.assertEqual(memory.worker_baseline([300 * MIB, 505 * MIB], seed=seed), seed)
+        self.assertEqual(memory.worker_baseline([900 * MIB, 780 * MIB], seed=seed), 780 * MIB)
+        # No sample: the last baseline stands rather than collapsing to the seed.
+        self.assertEqual(memory.worker_baseline([], seed=seed, previous=780 * MIB), 780 * MIB)
+
     def test_component_processes_fit_the_parent_reservation(self):
-        policy = memory.MemoryPolicy(8192 * MIB, 2048 * MIB, 2048 * MIB, 384 * MIB)
+        policy = memory.MemoryPolicy(8192 * MIB, component_bytes=384 * MIB)
         with mock.patch.object(memory.MemoryPolicy, "from_environment", return_value=policy):
             with mock.patch.object(memory, "process_tree_bytes", return_value={os.getpid(): 300 * MIB}):
                 self.assertEqual(memory.component_worker_limit(8), 4)
@@ -58,7 +77,7 @@ def setUp(self):
             patcher.start()
             self.addCleanup(patcher.stop)
         self.resident = {}
-        self.policy = memory.MemoryPolicy(12 * MIB, 4 * MIB, 4 * MIB)
+        self.policy = memory.MemoryPolicy(12 * MIB, 4 * MIB)
         self.pool = pool.Pool(policy=self.policy, memory_reader=lambda pids: {
             pid: self.resident.get(pid, 2 * MIB) for pid in pids
         })
@@ -142,7 +161,7 @@ def fluctuating_reader(pids):
 
     def test_configured_oversized_reservation_runs_alone_but_cannot_starve_a_child(self):
         isolated = pool.Pool(
-            policy=memory.MemoryPolicy(6 * MIB, 4 * MIB, 4 * MIB),
+            policy=memory.MemoryPolicy(6 * MIB, 4 * MIB),
             memory_reader=lambda pids: {pid: 2 * MIB for pid in pids},
         )
         self.addCleanup(isolated.shutdown)
@@ -153,7 +172,7 @@ def test_configured_oversized_reservation_runs_alone_but_
```

---

### Incident Patch 6: `0b3a31df` (2026-09-16)
**Commit Message**: Calibrate the daemon's per-worker memory reservation; drop its two knobs

CADGEN_WORKER_MEMORY_MB defaulted to 2048 MiB (or a third of the budget, which
on a 1 GiB budget was 341 MiB) for a worker whose real cost is about 450 MiB of
imported kernel. The large default under-admitted a fan-out; a knob set below
the real floor overbooked it. Neither number was knowable in advance, so both
settings are removed and the pool measures instead.

The reservation is a 512 MiB seed until the pool has a sample, then the lowest
RSS among workers that are idle and have served no job -- what a worker costs
once it has imported the kernel and before it holds any geometry -- never below
the seed, recalculated on every accounting pass from the reader already in
hand. A worker that has run a body is excluded on purpose: its RSS answers what
a build cost, and letting it in would let a fat idle worker inflate the very
reservation that justifies keeping it resident. Pending spawns and
busy-but-unmeasured workers are charged that reservation, a busy measured
worker max(RSS, reservation), and the dependency headroom derives from it
exactly as it derived from the knob. Setting either removed name now raise

**File**: `packages/cadgen/STORE.md` (modified, +15/-4)
```diff
@@ -839,7 +839,13 @@ CPU scheduling and reuse remain independent of memory admission:
 **Memory admission.** The daemon sums worker RSS including extraction
 descendants, pending spawn reservations, and retiring workers until they exit.
 Idle workers are reclaimed oldest first. Busy/suspended workers retain at
-least a worker reservation. Ordinary root requests preserve dependency
+least a worker reservation. That reservation is calibrated, not configured: it
+starts at a 512 MiB seed and, on every accounting pass, becomes the lowest RSS
+among workers that are idle and have served no job — what a worker costs once
+it has imported the kernel and before it holds any geometry — never below the
+seed. A worker that has run a body is excluded, so retained geometry cannot
+inflate the reservation that keeps it resident; the dependency headroom is
+derived from the same number. Ordinary root requests preserve dependency
 headroom; nested requests can spend it. A known oversized root reservation or
 retained worker may use that headroom only as the sole worker charge, and
 only within the total allowance. A request that cannot fit waits while builds
@@ -857,15 +863,20 @@ active shared work is not killed merely to recover budget.
 | Setting | Default |
 |---|---|
 | `CADGEN_MEMORY_MB` | 70% of discovered physical/cgroup RAM; `0` disables |
-| `CADGEN_WORKER_MEMORY_MB` | up to 2048 MiB, scaled down for smaller limits |
-| `CADGEN_DEPENDENCY_MEMORY_MB` | one worker reservation, bounded by the limit |
 | `CADGEN_COMPONENT_MEMORY_MB` | 384 MiB per extraction subprocess |
 
+The per-worker reservation and the dependency headroom have no settings; the
+pool calibrates both. Setting the removed `CADGEN_WORKER_MEMORY_MB` or
+`CADGEN_DEPENDENCY_MEMORY_MB` is an error at policy construction rather than a
+value silently ignored.
+
 This is a soft admission envelope, not a native allocator limit. A single
 OCCT operation may grow between RSS samples. Where RSS cannot be enumerated,
 reservations still apply. Transient execution receives extraction-pool sizing,
 but has no daemon-wide aggregate process budget. CPU slot counts remain upper
-bounds, and extraction concurrency also fits the parent worker allowance.
+bounds, and extraction concurrency also fits a per-worker extraction ceiling
+(a third of the budget, capped at 2048 MiB), which is not the admission
+reservation and is likewise unconfigurable.
 Geometry publication no longer starts extraction subprocesses for native
 components. Surface requests use the shared artifact-job admission and one
 private derivation per requested component; they have no model binding,
```

**File**: `packages/cadgen/src/cadgen/daemon/memory.py` (modified, +62/-11)
```diff
@@ -14,11 +14,24 @@
 import time
 from dataclasses import dataclass
 from pathlib import Path
-from typing import Mapping
+from typing import Iterable, Mapping
 
 MIB = 1024 * 1024
-DEFAULT_WORKER_BYTES = 2048 * MIB
+# A worker that has imported the kernel and built nothing sits at roughly 480 MiB
+# resident. This seed is the reservation until the pool has measured a worker of
+# its own, and the floor a measured baseline may never fall below.
+WORKER_SEED_BYTES = 512 * MIB
 DEFAULT_COMPONENT_BYTES = 384 * MIB
+# One worker's own ceiling for extraction subprocesses. Not admission's
+# reservation: admission bounds the daemon as a whole, this only stops a single
+# worker's subprocess fan-out from claiming the entire budget.
+EXTRACTION_CEILING_BYTES = 2048 * MIB
+
+# Removed knobs. Their teaching error names the calibration that replaced them.
+_REMOVED_SETTINGS = {
+    "CADGEN_WORKER_MEMORY_MB": "the per-worker reservation",
+    "CADGEN_DEPENDENCY_MEMORY_MB": "the dependency headroom",
+}
 
 
 def _megabytes(name: str, default: int) -> int:
@@ -77,21 +90,58 @@ class Status(ctypes.Structure):
 
 @dataclass(frozen=True)
 class MemoryPolicy:
+    """The budget and the seed. The per-worker reservation is not configured:
+    the pool calibrates it from the workers it can see (``worker_baseline``).
+    """
+
     limit_bytes: int
-    worker_bytes: int = DEFAULT_WORKER_BYTES
-    dependency_bytes: int = DEFAULT_WORKER_BYTES
+    seed_bytes: int = WORKER_SEED_BYTES
     component_bytes: int = DEFAULT_COMPONENT_BYTES
 
+    def dependency_reserve(self, reservation: int) -> int:
+        """Headroom an ordinary root request keeps so a nested request can run."""
+        return min(reservation, max(0, self.limit_bytes - reservation))
+
     @classmethod
     def from_environment(cls) -> "MemoryPolicy":
+        for name, described in _REMOVED_SETTINGS.items():
+            if os.environ.get(name, "").strip():
+                raise ValueError(
+                    f"{name} was removed: {described} is not configurable. A worker is "
+                    f"charged a {WORKER_SEED_BYTES // MIB} MiB seed until the pool has measured an "
+                    "idle worker of its own, then the observed baseline, and the dependency "
+                    "headroom follows from that same number. Size the whole budget with "
+                    "CADGEN_MEMORY_MB instead (0 disables admission)."
+                )
         # Leave 30% to the daemon, browser and other applications. An explicit
         # zero disables admission; unknown host capacity also leaves it off.
         limit = _megabytes("CADGEN_MEMORY_MB", physical_memory_bytes() * 7 // 10)
-        default_worker = min(DEFAULT_WORKER_BYTES, max(256 * MIB, limit // 3)) if limit else DEFAULT_WORKER_BYTES
-        worker = max(MIB, _megabytes("CADGEN_WORKER_MEMORY_MB", default_worker))
-        dependency = _megabytes("CADGEN_DEPENDENCY_MEMORY_MB", min(worker, max(0, limit - worker)))
         component = max(MIB, _megabytes("CADGEN_COMPONENT_MEMORY_MB", DEFAULT_COMPONENT_BYTES))
-        return cls(limit, worker, dependency, component)
+        return cls(limit, component_bytes=component)
+
+
+def worker_baseline(samples: Iterable[int], *, seed: int, previous: int = 0) -> int:
+    """What a worker costs before geometry, from workers that have run nothing.
+
+    The minimum of the samples, never below ``seed``. Only workers that are idle
+    and have served no job are offered: a worker that has run a body retains its
+    geometry and op-memo caches, so its RSS answers what a build cost, and
+    admitting it would let a fat idle worker inflate the very reservation that
+    keeps it resident. Among never-used workers the only spread is a partial
+    import, which reads low and the seed absorbs, so the minimum is both the
+    faithful figure and the one no sample can talk upwards. With no sample the
+    previous baseline stands -- every worker busy is exactly when the estimate

```

**File**: `packages/cadgen/src/cadgen/daemon/pool.py` (modified, +39/-22)
```diff
@@ -6,7 +6,11 @@
 of one job — and runs now. A request for a model with no worker binds a spare. A
 request with no spare left spawns if its memory reservation fits. Admission
 counts resident worker trees (including extraction children), keeps headroom
-for dependencies, and reclaims idle workers first. Exhaustion waits for the
+for dependencies, and reclaims idle workers first. That reservation is not
+configured: it starts at the seed and is recalibrated on every accounting pass
+from the RSS of workers that are idle and have run nothing, which is what a
+worker costs before geometry (``memory.worker_baseline``). The dependency
+headroom follows from the same number. Exhaustion waits for the
 builds in flight to finish (a parent fanning out its children submits them all
 at once, and only a core's worth can run) and fails explicitly only when nothing
 is running that could release memory. These are soft RSS and
@@ -42,7 +46,7 @@
 import threading
 import time
 
-from cadgen.daemon.memory import MemoryPolicy, MIB, process_tree_bytes
+from cadgen.daemon.memory import MemoryPolicy, MIB, process_tree_bytes, worker_baseline
 
 DEFAULT_SPARES = 2
 DEFAULT_RECYCLE_AFTER = 1000
@@ -292,6 +296,9 @@ def __init__(self, clock=time.monotonic, *, policy: MemoryPolicy | None = None,
         self._active_pending = 0
         self._spares_pending = 0
         self._policy = policy if policy is not None else MemoryPolicy.from_environment()
+        # What one worker is estimated to cost. The seed until a never-used idle
+        # worker has been measured; recalibrated by every _memory_locked.
+        self._reservation = self._policy.seed_bytes
         self._memory_reader = memory_reader or process_tree_bytes
         # How many jobs hold a run slot right now. Each one hands its charge back when
         # it finishes, so admission waits on them instead of refusing.
@@ -322,9 +329,10 @@ def ensure_spares(self) -> None:
             borrowed = sum(worker.busy and not worker.model for worker in self._workers)
             want = spare_count() - len(self._spares_locked()) - borrowed - self._spares_pending
             if self._policy.limit_bytes:
-                usage = self._memory_locked()["chargedBytes"]
-                available = self._policy.limit_bytes - self._policy.dependency_bytes - usage
-                want = min(want, max(0, available // self._policy.worker_bytes))
+                snapshot = self._memory_locked()
+                available = (self._policy.limit_bytes - snapshot["dependencyReserveBytes"]
+                             - snapshot["chargedBytes"])
+                want = min(want, max(0, available // max(1, snapshot["workerReservationBytes"])))
             if want <= 0:
                 return
             self._spares_pending += want
@@ -375,7 +383,7 @@ def acquire(self, model: str = "", *, dependency: bool = False) -> Worker:
                 worker.busy = True  # reserve before releasing the bookkeeping lock
             try:
                 self._admit_locked(
-                    additional=0 if worker else self._policy.worker_bytes,
+                    spawning=worker is None,
                     dependency=dependency,
                     isolated_worker=worker,
                 )
@@ -387,10 +395,7 @@ def acquire(self, model: str = "", *, dependency: bool = False) -> Worker:
                     self._stats["memoryReclaims"] += 1
                     self._drop_locked(worker)
                     worker = None
-                    self._admit_locked(
-                        additional=self._policy.worker_bytes,
-                        dependency=dependency,
-                    )
+                    self._admit_locked(spawning=True, dependency=dependency)
                 else:
                     raise
             if worker is None:
@@ -432,16 +437,24 @@ def _memory_locked(self) -> dict:
         workers = [*self._workers, *self._retiring]
         measured = self._memory_reader([w.pid for w in 
```

**File**: `tests/python/packages/cadgen/test_daemon_artifacts_native.py` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ def assert_geometry_and_result(self, result):
     def daemon(self, child_prelude):
         address = transport.private_address(transport.identity_digest(str(self.root) + "native-server"))
         listener = transport.Server(address, self.private.key, backlog=8)
-        workers = pool.Pool(policy=MemoryPolicy(limit_bytes=1024 * MIB, worker_bytes=1024 * MIB, dependency_bytes=0))
+        workers = pool.Pool(policy=MemoryPolicy(limit_bytes=1024 * MIB, seed_bytes=1024 * MIB))
         ledger, handlers = JobLedger(), []
         processes = []
         original_popen = subprocess.Popen
```

**File**: `tests/python/packages/cadgen/test_daemon_memory.py` (modified, +120/-11)
```diff
@@ -31,17 +31,36 @@ def test_cycles_and_missing_processes_do_not_hang_or_invent_rss(self):
         self.assertEqual(memory.process_tree_bytes([10, 99], rows=rows), {10: 100})
 
     def test_policy_reserves_dependency_capacity_and_honors_explicit_zero(self):
-        env = {key: "" for key in ("CADGEN_MEMORY_MB", "CADGEN_WORKER_MEMORY_MB",
-                                  "CADGEN_DEPENDENCY_MEMORY_MB", "CADGEN_COMPONENT_MEMORY_MB")}
+        env = {key: "" for key in ("CADGEN_MEMORY_MB", "CADGEN_COMPONENT_MEMORY_MB")}
         with mock.patch.dict(os.environ, env), mock.patch.object(memory, "physical_memory_bytes", return_value=12 * 1024 * MIB):
             policy = memory.MemoryPolicy.from_environment()
             self.assertEqual(policy.limit_bytes, 12 * 1024 * MIB * 7 // 10)
-            self.assertEqual(policy.dependency_bytes, policy.worker_bytes)
+            self.assertEqual(policy.seed_bytes, memory.WORKER_SEED_BYTES)
+            # Headroom for one nested request, derived from the same reservation.
+            self.assertEqual(policy.dependency_reserve(policy.seed_bytes), policy.seed_bytes)
+            self.assertEqual(memory.MemoryPolicy(600 * MIB).dependency_reserve(512 * MIB), 88 * MIB)
             with mock.patch.dict(os.environ, {"CADGEN_MEMORY_MB": "0"}):
                 self.assertEqual(memory.MemoryPolicy.from_environment().limit_bytes, 0)
 
+    def test_removed_worker_reservation_settings_teach_instead_of_being_ignored(self):
+        for name in ("CADGEN_WORKER_MEMORY_MB", "CADGEN_DEPENDENCY_MEMORY_MB"):
+            with self.subTest(name), mock.patch.dict(os.environ, {name: "512"}):
+                with self.assertRaisesRegex(ValueError, f"{name} was removed") as raised:
+                    memory.MemoryPolicy.from_environment()
+                self.assertIn("CADGEN_MEMORY_MB", str(raised.exception))
+                self.assertIn("512 MiB seed", str(raised.exception))
+
+    def test_baseline_is_the_leanest_never_used_worker_and_never_below_the_seed(self):
+        seed = memory.WORKER_SEED_BYTES
+        self.assertEqual(memory.worker_baseline([], seed=seed), seed)
+        # A partial import reads low; the seed absorbs it.
+        self.assertEqual(memory.worker_baseline([300 * MIB, 505 * MIB], seed=seed), seed)
+        self.assertEqual(memory.worker_baseline([900 * MIB, 780 * MIB], seed=seed), 780 * MIB)
+        # No sample: the last baseline stands rather than collapsing to the seed.
+        self.assertEqual(memory.worker_baseline([], seed=seed, previous=780 * MIB), 780 * MIB)
+
     def test_component_processes_fit_the_parent_reservation(self):
-        policy = memory.MemoryPolicy(8192 * MIB, 2048 * MIB, 2048 * MIB, 384 * MIB)
+        policy = memory.MemoryPolicy(8192 * MIB, component_bytes=384 * MIB)
         with mock.patch.object(memory.MemoryPolicy, "from_environment", return_value=policy):
             with mock.patch.object(memory, "process_tree_bytes", return_value={os.getpid(): 300 * MIB}):
                 self.assertEqual(memory.component_worker_limit(8), 4)
@@ -58,7 +77,7 @@ def setUp(self):
             patcher.start()
             self.addCleanup(patcher.stop)
         self.resident = {}
-        self.policy = memory.MemoryPolicy(12 * MIB, 4 * MIB, 4 * MIB)
+        self.policy = memory.MemoryPolicy(12 * MIB, 4 * MIB)
         self.pool = pool.Pool(policy=self.policy, memory_reader=lambda pids: {
             pid: self.resident.get(pid, 2 * MIB) for pid in pids
         })
@@ -142,7 +161,7 @@ def fluctuating_reader(pids):
 
     def test_configured_oversized_reservation_runs_alone_but_cannot_starve_a_child(self):
         isolated = pool.Pool(
-            policy=memory.MemoryPolicy(6 * MIB, 4 * MIB, 4 * MIB),
+            policy=memory.MemoryPolicy(6 * MIB, 4 * MIB),
             memory_reader=lambda pids: {pid: 2 * MIB for pid in pids},
         )
         self.addCleanup(isolated.shutdown)
@@ -153,7 +172,7 @@ def test_configured_oversized_reservation_runs_alone_but_
```

---

### Incident Patch 7: `f110bf8f` (2026-09-16)
**Commit Message**: Merge claude/review-skills: skill docs match the CLIs; six CLI defects fixed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `packages/cadgen/src/cadgen/_internal/generation.py` (modified, +32/-9)
```diff
@@ -1298,6 +1298,18 @@ def _run_selected_specs(
     return results
 
 
+def _reported_document(spec: EntrySpec) -> str | None:
+    """The document a model run names on stdout: the STEP it declares, or -- for a
+    mesh-only model (`@stl`/`@glb`/`@threemf` with no `@step`) -- the first mesh it
+    declares. A STEP model that also declares meshes still names its STEP: the line
+    names the model's primary document, not everything the build wrote."""
+    if spec.step_output:
+        return _display_path(spec.step_path) if spec.step_path is not None else None
+    for export in spec.mesh_exports:
+        return _display_path(export.path)
+    return None
+
+
 def _model_for_spec(spec: EntrySpec) -> str | None:
     """The store identity of a spec: ``script::fn`` (generated) or its document's
     path (imported) -- cadgen.store.index.model_ref."""
@@ -1385,9 +1397,11 @@ def _emit(spec: EntrySpec, outcome: str, tree: str | None) -> None:
                 # inspect gives; the authored kind only steered the packaging.
                 "kind": tree_kind_for(tree) or "part",
                 "outcome": outcome,
-                # The document the run wrote (None for a mesh-only model, which
-                # declares no STEP) and the hash of the result tree it came from.
-                "document": _display_path(spec.step_path) if spec.step_output else None,
+                # The document the run wrote, and the hash of the result tree it came
+                # from. A mesh-only model declares no STEP, so it answers with the mesh
+                # it wrote -- a path the caller can open, never the tree hash, which
+                # names nothing on disk.
+                "document": _reported_document(spec),
                 "tree": tree,
             }
         )
@@ -1396,8 +1410,9 @@ def _flush() -> None:
         # STDOUT IS THE RESULT, on every CLI. `gen` used to print nothing there at all --
         # its only output was the logger's prose on stderr -- so a caller reading the two
         # streams apart got an exit code and nothing else, while export, snapshot, validate
-        # and inspect all answered on stdout. One line per target, `outcome document`
-        # (`outcome <tree hash>` for a model with no document), upgraded to JSON by --json.
+        # and inspect all answered on stdout. One line per target, `outcome document`,
+        # upgraded to JSON by --json. Every model has a document to name -- a mesh-only
+        # one names its mesh -- so the tree hash is the last resort it never reaches.
         for entry in reported:
             if json_output:
                 print(json.dumps(entry, separators=(",", ":")))
@@ -1530,12 +1545,20 @@ def _flush() -> None:
             else:
                 print(f"{entry['outcome']} {entry['document']}")
 
-    def dxf_output_current(script_path: Path, output_path: Path | None) -> bool:
+    def dxf_output_current(spec: EntrySpec, output_path: Path | None) -> bool:
         # The ONE gate every model answers to (STORE.md §4): the drawing's record,
         # its closure, its pinned children and its .dxf output.
+        #
+        # Ask it by the model's IDENTITY (``script::fn``), never by the bare script
+        # path: a file may hold several models, and a bare path is ambiguous there --
+        # cadgen.store.index.resolve_model_ref refuses it rather than guessing, which
+        # would fail the drawing before it ever reached its own gate.
         if output_path is None:
             return False
-        verdict = stale(script_path)
+        model = _model_for_spec(spec)
+        if model is None:
+            return False
+        verdict = stale(model)
         return not verdict.stale
 
     logger = CliLogger("cadgen", verbose=verbose)
@@ -1556,7 +1579,7 @@ def _effective_output(spec: EntrySpec) -> Path | None:
             spec
             for spec in selected_specs
             if spec.script_path is not None
-            and dxf_output_current(spe
```

**File**: `packages/cadgen/src/cadgen/sdf_external.py` (modified, +13/-2)
```diff
@@ -21,9 +21,20 @@ def run_gz_sdf_check(xml_text: str, *, output_path: Path, mode: GzCheckMode = "a
 
     gz_path = shutil.which("gz")
     if gz_path is None:
-        severity = "error" if normalized_mode == "required" else "warning"
+        # Under `auto` an absent tool is a note, never a finding against the FILE.
+        # `auto` means "run gz if it is here", so a machine without Gazebo would
+        # otherwise fail every clean document -- and, because `--strict` promotes
+        # warnings, fail it blockingly. Asking for the check with `required` is the
+        # way to say its absence is an error.
+        if normalized_mode == "required":
+            result.add(
+                "error",
+                "gz_check_unavailable",
+                "gz sdf --check could not run: 'gz' is not on PATH",
+            )
+            return result
         result.add(
-            severity,
+            "info",
             "gz_check_unavailable",
             "gz sdf --check skipped because 'gz' is not on PATH",
         )
```

**File**: `skills/bambu-labs/references/local-lan-protocol.md` (modified, +18/-0)
```diff
@@ -54,6 +54,7 @@ Representative payload:
 ```json
 {
   "print": {
+    "sequence_id": "1789515297609",
     "command": "project_file",
     "param": "Metadata/plate_1.gcode",
     "project_id": "0",
@@ -82,6 +83,7 @@ The plain path uploads `cache/<job>.gcode` and publishes:
 ```json
 {
   "print": {
+    "sequence_id": "1789515309288",
     "command": "gcode_file",
     "param": "cache/job.gcode"
   }
@@ -99,6 +101,22 @@ enabled profiles, validates the archive, uploads it to FTPS root, and publishes
 the same `project_file` shape as template projects. Current enabled profile is
 `p1s-0.4`; A1/A1 Mini are disabled until a validated bambox profile exists.
 
+### Print Controls
+
+`pause`, `cancel`, and `clear-error` publish a control request on the same
+request topic and never upload files:
+
+```json
+{"print": {"sequence_id": "1789515309340", "command": "pause"}}
+{"print": {"sequence_id": "1789515309390", "command": "stop", "param": ""}}
+{"print": {"sequence_id": "1789515309441", "command": "clean_print_error"}}
+```
+
+## Sequence Ids
+
+Every published payload carries `sequence_id`. It defaults to the current
+timestamp in milliseconds; `--sequence-id` overrides it.
+
 ## Observed Failure Modes
 
 - **Direct G-code rejected:** MQTT report after `gcode_file` may include
```

**File**: `skills/bambu-labs/scripts/bambu_lan_print.py` (modified, +21/-3)
```diff
@@ -1544,7 +1544,19 @@ def add_config_parser(subparsers: argparse._SubParsersAction) -> None:
     parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Printer config JSON path.")
     config_subparsers = parser.add_subparsers(dest="config_command", required=True)
 
-    set_parser = config_subparsers.add_parser("set", help="Create or update a configured printer.")
+    # `config` is the only two-level command, and --config names the same file
+    # here that it names on `send`, `status` and the rest -- where it sits on the
+    # command itself. Accept both placements so the flag reads the same
+    # everywhere. SUPPRESS is what keeps them from fighting: an omitted leaf
+    # --config sets nothing, so `config --config X set` keeps X.
+    config_path = argparse.ArgumentParser(add_help=False)
+    config_path.add_argument(
+        "--config", default=argparse.SUPPRESS, help="Printer config JSON path."
+    )
+
+    set_parser = config_subparsers.add_parser(
+        "set", parents=[config_path], help="Create or update a configured printer."
+    )
     set_parser.add_argument("--printer", required=True, help="Local printer id, for example a1-mini.")
     set_parser.add_argument("--host", help="Printer LAN IP or hostname.")
     set_parser.add_argument("--access-code", help="Printer LAN access code.")
@@ -1562,10 +1574,16 @@ def add_config_parser(subparsers: argparse._SubParsersAction) -> None:
     )
     set_parser.set_defaults(func=config_set_main)
 
-    list_parser = config_subparsers.add_parser("list", help="List configured printers.")
+    list_parser = config_subparsers.add_parser(
+        "list", parents=[config_path], help="List configured printers."
+    )
     list_parser.set_defaults(func=config_list_main)
 
-    show_parser = config_subparsers.add_parser("show", help="Show one configured printer without printing the access code.")
+    show_parser = config_subparsers.add_parser(
+        "show",
+        parents=[config_path],
+        help="Show one configured printer without printing the access code.",
+    )
     show_parser.add_argument("--printer", required=True)
     show_parser.set_defaults(func=config_show_main)
 
```

**File**: `skills/cad-viewer/agents/openai.yaml` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
 interface:
   display_name: "CAD Viewer"
-  short_description: "Open CAD, G-code, and robot files in Viewer."
-  default_prompt: "Use $cad-viewer to start CAD Viewer and return review links for explicit CAD, G-code, or robot-description files."
+  short_description: "Open CAD, drawing, and robot files in Viewer."
+  default_prompt: "Use $cad-viewer to start CAD Viewer and return review links for explicit CAD, drawing, or robot-description files."
```

#### Recent Merged Pull Requests:
- **PR #475** (2026-09-29): Release 0.7.4 (@earthtojake)
- **PR #473** (closed): Refine the TEXT2CAD X logo (@earthtojake)
- **PR #472** (2026-09-29): Refresh docs styling, navigation, and TEXT2CAD logo (@earthtojake)
- **PR #471** (2026-09-29): Adopt shaded block logos and CAD branding (@earthtojake)
- **PR #470** (2026-09-29): Fix renderer playback and orbit updates; add radial engine sample (@earthtojake)
- **PR #469** (2026-09-29): Move viewer instructions into CAD skills (@earthtojake)
- **PR #468** (closed): Add CAD extension with a resilient local runtime and plugin distribution (@earthtojake)
- **PR #466** (2026-09-29): Release 0.7.3 (@earthtojake)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
