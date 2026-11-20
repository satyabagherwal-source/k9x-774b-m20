# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: solidjs/solid Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "solidjs/solid",
  "source_url": "https://github.com/solidjs/solid",
  "source_version": "5a43d6f8",
  "license": "MIT",
  "timestamp": "2026-11-20T23:21:22.395Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-solidjs-solid",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [solidjs/solid](https://github.com/solidjs/solid) (Revision: `5a43d6f8`).  
> **License**: MIT | **Timestamp**: `2026-11-20T23:21:22.395Z`  
> **Learning ID**: `learn-github-solidjs-solid`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), F (Design Intelligence)
- **Confidence Rating**: 70%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from solidjs/solid:

# Forensic Learning Record (Deep Inspection): solidjs/solid

> **Canonical Artifact**: `07_PROJECT_LEARNING/solidjs-solid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/solidjs/solid](https://github.com/solidjs/solid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T23:21:21.165Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `solidjs/solid`
- **Description**: A declarative, efficient, and flexible JavaScript library for building user interfaces.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 36881 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/rendering/csr/client.tsx`
```
import { render } from "@solidjs/web";
import App from "../shared/src/components/App";

render(() => <App />, document.getElementById("app")!);

```

### Core Architecture Module: `examples/rendering/csr/vite.config.mjs`
```
import { defineConfig } from "vite";
// Exercises the current @solidjs/vite-plugin pipeline: native JSX compiler by
// default, native lazy/refresh passes, solid-js/refresh HMR runtime.
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  root: import.meta.dirname,
  publicDir: "../shared/static",
  plugins: [solid()],
  server: { port: 3000 },
  preview: { port: 3000 }
});

```

### Core Architecture Module: `examples/rendering/shared/src/components/App.tsx`
```
import { isPending, lazy, Match, Switch } from "solid-js";
import { Link, RouteHOC, useRouter } from "../router";
import Profile from "./Profile";

// @solidjs/vite-plugin's lazy() module-URL pass keys these against the client
// manifest automatically — no hand-written module keys needed.
const Home = lazy(() => import("./Home"));
const Settings = lazy(() => import("./Settings"));
const Stream = lazy(() => import("./Stream"));
const ErrorStream = lazy(() => import("./ErrorStream"));
const RevealPage = lazy(() => import("./Reveal"));
const Skeleton = lazy(() => import("./Skeleton"));

const App = RouteHOC(() => {
  const [location, { matches }] = useRouter();

  return (
    <>
      <ul class="inline">
        <li class={{ selected: matches("index") }}>
          <Link path="">Home</Link>
        </li>
        <li class={{ selected: matches("profile") }}>
          <Link path="profile">Profile</Link>
        </li>
        <li class={{ selected: matches("settings") }}>
          <Link path="settings">Settings</Link>
        </li>
        <li class={{ selected: matches("stream") }}>
          <Link path="stream">Stream</Link>
        </li>
        <li class={{ selected: matches("error-stream") }}>
          <Link path="error-stream">Error Stream</Link>
        </li>
        <li class={{ selected: matches("reveal") }}>
          <Link path="reveal">Reveal</Link>
        </li>
        <li class={{ selected: matches("skeleton") }}>
          <Link path="skeleton">Skeleton</Link>
        </li>
      </ul>
      <div class={["tab", { pending: isPending(location) }]}>
        <Switch>
          <Match when={matches("index")}>
            <Home />
          </Match>
          <Match when={matches("profile")}>
            <Profile />
          </Match>
          <Match when={matches("settings")}>
            <Settings />
          </Match>
          <Match when={matches("stream")}>
            <Stream />
          </Match>
          <Match when={matches("error-stream")}>
            <ErrorStream />
          </Match>
          <Match when={matches("reveal")}>
            <RevealPage />
          </Match>
          <Match when={matches("skeleton")}>
            <Skeleton />
          </Match>
        </Switch>
      </div>
    </>
  );
});

export default App;

```

### Core Architecture Module: `examples/rendering/shared/src/components/ErrorStream.tsx`
```
import { createMemo, createSignal, Errored, Loading } from "solid-js";

interface Item {
  title: string;
}

function loadItem(id: string): Promise<Item> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id !== "1") {
        reject(new Error(`Item ${id} not found`));
        return;
      }

      resolve({ title: "Test Item" });
    }, 1500);
  });
}

function InnerBoundaryItem(props: { id: string }) {
  const [id, setId] = createSignal(props.id);
  const item = createMemo<Item>(async () => loadItem(id()));

  return (
    <Loading fallback={<div>Item Loading...</div>}>
      <Errored
        fallback={(error, reset) => (
          <div>
            <div>ItemError: {String(error())}</div>
            <button
              onClick={() => {
                setId("1");
                reset();
              }}
            >
              Reset to valid item
            </button>
          </div>
        )}
      >
        <div>{item().title}</div>
      </Errored>
    </Loading>
  );
}

function OuterBoundaryItem(props: { id: string }) {
  const [id, setId] = createSignal(props.id);
  const item = createMemo<Item>(async () => loadItem(id()));

  return (
    <Errored
      fallback={(error, reset) => (
        <div>
          <div>ItemError: {String(error())}</div>
          <button
            onClick={() => {
              setId("1");
              reset();
            }}
          >
            Reset to valid item
          </button>
        </div>
      )}
    >
      <Loading fallback={<div>Item Loading...</div>}>
        <div>{item().title}</div>
      </Loading>
    </Errored>
  );
}

const ErrorStream = () => {
  return (
    <>
      <h1>Loading + Errored Streaming</h1>
      <p>
        Reproduces both boundary shapes for streamed SSR + hydration, with reset buttons to confirm
        recovery after hydration.
      </p>
      <h2>Errored inside Loading</h2>
      <div>
        <InnerBoundaryItem id="1" />
        <InnerBoundaryItem id="bad-item" />
      </div>
      <h2>Errored outside Loading</h2>
      <div>
        <OuterBoundaryItem id="1" />
        <OuterBoundaryItem id="bad-item" />
      </div>
    </>
  );
};

export default ErrorStream;

```

### Core Architecture Module: `examples/rendering/shared/src/components/Home.tsx`
```
import { createSignal, onSettled } from "solid-js";

const Home = () => {
  const [s, set] = createSignal(0);

  onSettled(() => {
    const t = setInterval(() => {
      set(s() + 1);
    }, 100);

    return () => {
      clearInterval(t);
    };
  });

  return (
    <>
      <h1>Welcome to this Simple Routing Example</h1>
      <p>Click the links in the Navigation above to load different routes.</p>
      <span>{s()}</span>
    </>
  );
};

export default Home;

```

### Core Architecture Module: `examples/rendering/shared/src/components/Profile/Profile.tsx`
```
import { For, Loading } from "solid-js";

export interface User {
  firstName: string;
  lastName: string;
}

function Profile(props: { info: string[]; user: User }) {
  return (
    <>
      <h1>{props.user.firstName}'s Profile</h1>
      <p>This section could be about you.</p>
      <Loading fallback={<span class="loader">Loading Info...</span>}>
        <ul>
          <For each={props.info}>{fact => <li>{fact}</li>}</For>
        </ul>
      </Loading>
    </>
  );
}

export default Profile;

```

### Core Architecture Module: `examples/rendering/shared/src/components/Profile/index.tsx`
```
import { createMemo, lazy } from "solid-js";
import type { User } from "./Profile";

const Profile = lazy(() => import("./Profile"));

// this component lazy loads data and code in parallel
export default () => {
  const user = createMemo<User>(() => {
    // simulate data loading
    console.log("LOAD USER");
    return new Promise<User>(resolve => {
      setTimeout(() => resolve({ firstName: "Jon", lastName: "Snow" }), 400);
    });
  });

  const info = createMemo<string[]>(() => {
    user();
    // simulate cascading data loading
    console.log("LOAD INFO");
    return new Promise<string[]>(resolve => {
      setTimeout(
        () =>
          resolve(["Something Interesting", "Something else you might care about", "Or maybe not"]),
        400
      );
    });
  });

  return <Profile user={user()} info={info()} />;
};

```

### Core Architecture Module: `examples/rendering/shared/src/components/Reveal.tsx`
```
import { createMemo, createSignal, Loading, Reveal, Show, type RevealOrder } from "solid-js";

function delayedValue<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function AsyncCard(props: { delay: number; title: string }) {
  const value = createMemo(() =>
    delayedValue(props.delay, `${props.title} resolved in ${props.delay}ms`)
  );

  return (
    <Loading fallback={<div class="loader">{props.title} loading...</div>}>
      <div class="reveal-card">
        <strong>{props.title}</strong>
        <div>{value()}</div>
      </div>
    </Loading>
  );
}

const RevealPage = () => {
  const [order, setOrder] = createSignal<RevealOrder>("sequential");
  const [collapsed, setCollapsed] = createSignal(true);
  const [seed, setSeed] = createSignal(1);

  return (
    <>
      <h1>Reveal</h1>
      <p>
        Compare reveal ordering with different <code>order</code> modes and watch the nested group
        behave as a single composite slot inside its parent. Restart the run to replay SSR and
        hydration timings.
      </p>
      <p>
        <strong>Run:</strong> {seed()}
      </p>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          "align-items": "center",
          "margin-bottom": "1rem",
          "flex-wrap": "wrap"
        }}
      >
        <fieldset style={{ display: "flex", gap: "0.75rem", "align-items": "center" }}>
          <legend>order</legend>
          <label>
            <input
              type="radio"
              name="order"
              value="sequential"
              checked={order() === "sequential"}
              onInput={() => setOrder("sequential")}
            />{" "}
            sequential
          </label>
          <label>
            <input
              type="radio"
              name="order"
              value="together"
              checked={order() === "together"}
              onInput={() => setOrder("together")}
            />{" "}
            together
          </label>
          <label>
            <input
              type="radio"
              name="order"
              value="natural"
              checked={order() === "natural"}
              onInput={() => setOrder("natural")}
            />{" "}
            natural
          </label>
        </fieldset>
        <label title="Only applies when order is sequential">
          <input
            type="checkbox"
            checked={collapsed()}
            disabled={order() !== "sequential"}
            onInput={e => setCollapsed(e.currentTarget.checked)}
          />{" "}
          collapsed <em>(sequential only)</em>
        </label>
        <button onClick={() => setSeed(s => s + 1)}>Restart run</button>
      </div>

      <Show when={seed()} keyed>
        <h2>Primary Group</h2>
        <p>
          Three siblings under a single <code>{`<Reveal order="${order()}">`}</code>. Compare how
          they swap in as each resolves.
        </p>
        <Reveal order={order()} collapsed={collapsed()}>
          <div class="reveal-grid">
            <AsyncCard title="A" delay={500} />
            <AsyncCard title="B" delay={1100} />
            <AsyncCard title="C" delay={1700} />
          </div>
        </Reveal>

        <h2>Nested Group</h2>
        <p>
          The outer group uses <code>order="{order()}"</code>. The inner group is always{" "}
          <code>order="natural"</code> — it registers as a single composite slot to the outer group
          and, once the outer releases it, each inner card reveals on its own.
        </p>
        <Reveal order={order()} collapsed={collapsed()}>
          <div class="reveal-grid">
            <AsyncCard title="Outer-1" delay={700} />
            <Reveal order="natural">
              <div class="reveal-grid">
                <AsyncCard title="Inner-1" delay={900} />
                <AsyncCard title="Inner-2" delay={1300} />
              </div>
            </Reveal>
            <AsyncCard title="Outer-2" delay={1500} />
          </div>
        </Reveal>
      </Show>
    </>
  );
};

export default RevealPage;

```

### Core Architecture Module: `examples/rendering/shared/src/components/Settings.tsx`
```
import { createSignal, createUniqueId } from "solid-js";
import { Portal } from "@solidjs/web";

const Settings = () => {
  const [text, setText] = createSignal("Hi");
  const [modalOpen, setModalOpen] = createSignal(true);
  const [modalClicks, setModalClicks] = createSignal(0);
  const id = createUniqueId();

  return (
    <section onClick={() => modalOpen() && setModalClicks(c => c + 1)}>
      <h1>Settings</h1>
      <p>All that configuration you never really ever want to look at.</p>
      <label for={id}>Write:</label>
      <input type="text" id={id} value={text()} onInput={e => setText(e.currentTarget.value)} />
      <p>{text()}</p>
      <button type="button" onClick={() => setModalOpen(true)}>
        Open body portal
      </button>
      <p>Portal logical clicks: {modalClicks()}</p>
      {modalOpen() && (
        <Portal>
          <div class="modal-backdrop">
            <div class="modal-card" role="dialog" aria-modal="true" aria-label="Settings portal">
              <h2>Body Portal</h2>
              <p>This modal is portaled to document.body.</p>
              <button type="button" onClick={() => setModalOpen(false)}>
                Close portal
              </button>
            </div>
          </div>
        </Portal>
      )}
    </section>
  );
};

export default Settings;

```

### Core Architecture Module: `examples/rendering/shared/src/components/Shell.tsx`
```
import type { ParentProps } from "solid-js";
import { HydrationScript } from "@solidjs/web";

/**
 * SSR-only shell. Wraps the shared `<App />` content in an `<html>` document
 * with hydration script, stylesheet, and the client entry module. The CSR
 * variant serves its own static `index.html` and does not use this.
 *
 * `clientEntry` is the dev module path of the mode's client entry (e.g.
 * `/client.tsx`); in production builds the server harness rewrites it to the
 * hashed asset from the Vite client manifest.
 */
export default function Shell(props: ParentProps<{ clientEntry: string }>) {
  return (
    <html lang="en">
      <head>
        <title>🔥 Solid Rendering 🔥</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/styles.css" />
        <HydrationScript />
      </head>
      <body>
        <div id="app">{props.children}</div>
      </body>
      <script type="module" src={props.clientEntry} async></script>
    </html>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4587** (2026-11-02): **[2.0] A long memo chain overflows the stack in the commit/settle path**
  *Symptoms*: ## What happens  A chain of `createMemo` nodes over an async source, read under `<Errored>` with `isPending`, overflows the call stack in the commit/settle path once the chain is long enough.  - On `next`, a warm-built chain of about **8,000+** memos surfaces `E:Maximum call stack size exceeded` as the rendered error, in place of the source's own error. - With #4582 (the settle walk also stage-marks chain nodes via `stageMark`), the walk recurses through chains too. At about **15,000** nodes it silently drops the staged `E:boomA` frame instead of erroring.  Real apps rarely build chains this deep, but the error should be the source's (`boomA`), never a stack overflow, and a frame should never be dropped without an error.  ## Repro shape  1. Make an async source that rejects with `new Error("boomA")`. 2. Build a chain of N `createMemo` nodes, each reading the previous one, after the source has a first value (warm build). 3. Read the last memo under an `Errored` boundary, together with `isPending(last)`, in a render effect that records frames. 4. Trigger the rejecting flight and flush.  With N ≈ 8,000 on `next`, the recorded error is `Maximum call stack size exceeded`. Expected: `E:boomA`.  ## Likely fix direction  Make the commit/settle walks (including `settlePendingSource` and the staged-error marking) iterative with an explicit stack, instead of recursing per node.  Found during review of #4582. It doesn't block that PR, because `next` already fails at a shallower depth.

- **Issue #4486** (2026-10-30): **A memo that catches an errored sync memo's throw and is re-run halts the system on its second re-run**
  *Symptoms*: On `next` (ab3d2add5d41fb8cc1069ac2e01c330c04f0af1d), a memo that wraps the read of an **errored sync memo** in `try/catch` and completes with a substitute value works for its creation pass and its first re-run, then **halts the whole system on its second re-run** when nothing but an unrelated signal changed. With an `<Errored>` boundary above there is no halt, but the boundary flips to its fallback while the content memo itself still reads `"caught"`.  Found while building #4481 (the `CAUGHT_REACTIVE_READ` dev diagnostic); independent of it — reproduced on plain `next` with that branch not present.  ## Reproduction (vitest, `packages/signals`)  ```ts import { expect, it, vi } from "vitest"; import { createMemo, createRenderEffect, createRoot, createSignal, flush } from "../src/index.js";  it("a catching memo over an errored sync memo halts on its second re-run", () => {   const errors: string[] = [];   vi.spyOn(console, "error").mockImplementation((m, e) => errors.push(`${m} || ${e}`));   const [other, setOther] = createSignal(0);   const screens: string[] = [];   let catching!: () => string;   createRoot(() => {     const bad = createMemo((): string => {       throw new Error("boom");     });     catching = createMemo(() => {       other();       try {         return bad();       } catch {         return "caught";       }     });     createRenderEffect(catching, v => void screens.push(v));   });   flush();   expect(screens).toEqual(["caught"]);   setOther(1);   flush(); // 

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

### Incident Patch 1: `fc0dac0c` (2026-11-20)
**Commit Message**: fix(solid): a server projection over a pending async store waits for it (#5097) (#5105)

* fix(solid): a server projection over a pending async store waits for it (#5097)

The sync result of a projection's fn was adopted after the NotReady
retry's try block, so returning a pending store (() => rows) threw out
of the component body. Adopt it inside the try, so it takes the same
retry as a derive that reads the store.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0117BoWPYxt1bEM9zZ5G6dPL

* test(web): type the #5097 spec's function-form projection as the issue writes it

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0117BoWPYxt1bEM9zZ5G6dPL

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/ssr-projection-pending-store-5097.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"solid-js": patch
+---
+
+On the server, a projection or derived optimistic store whose function returns a pending async store (`createProjection(() => rows, …)`, `createOptimisticStore(() => rows, …)`) now waits for that store like a derive that read it, so `<Loading>` shows its fallback and the answer streams in. Before, adopting the pending store threw `NotReadyError` out of the component body.
```

**File**: `packages/solid/src/server/signals.ts` (modified, +11/-4)
```diff
@@ -3181,6 +3181,17 @@ export function createProjection<T extends object = {}>(
   let result: void | T | Promise<void | T> | AsyncIterable<void | T>;
   try {
     result = runProjection();
+    // Synchronous: fn either mutated state directly (void) or returned a new
+    // value. Adopted here, a pending store it returns (`() => rows`) takes
+    // the NotReady retry below like a derive that read it (#5097).
+    if (
+      result !== undefined &&
+      result !== state &&
+      result !== draft &&
+      !isThenable(result) &&
+      typeof (result as any)[Symbol.asyncIterator] !== "function"
+    )
+      replaceState(state, result as T);
   } catch (error) {
     if (!(error instanceof NotReadyError)) throw error;
     // The derive read a client hole synchronously: FINAL at discovery, the
@@ -3411,10 +3422,6 @@ export function createProjection<T extends object = {}>(
     return recordSlot(pending);
   }
 
-  // Synchronous: fn either mutated state directly (void) or returned a new value
-  if (result !== undefined && result !== state && result !== draft) {
-    replaceState(state, result as T);
-  }
   return state;
 }
 
```

**File**: `packages/web/test/server/projection-over-pending-store-5097.spec.tsx` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+/**
+ * @jsxImportSource @solidjs/web
+ */
+// #5097: on the server, a projection whose fn returns a pending async store
+// (`createProjection(() => rows, …)`, and `createOptimisticStore(() => rows,
+// …)` through the same path) adopted it at creation, outside the NotReady
+// retry, so the pending proxy's read escaped the component body. It now
+// waits for the store like a derive that read it, as on the client.
+import { describe, expect, test } from "vitest";
+import { renderToStream } from "@solidjs/web";
+import { createOptimisticStore, createProjection, createStore, Loading } from "solid-js";
+
+const render = (App: () => any) =>
+  new Promise<string>((resolve, reject) => {
+    let out = "";
+    renderToStream(() => <App />, { onError: reject }).pipe({
+      write: (c: string) => {
+        out += c;
+      },
+      end: () => resolve(out)
+    });
+  });
+
+const rowsStore = () =>
+  createStore(
+    async () => {
+      await new Promise(r => setTimeout(r, 10));
+      return [{ id: 1, t: "A" }];
+    },
+    [] as { id: number; t: string }[],
+    { key: "id" } as any
+  )[0];
+
+describe("#5097: a projection over a pending async store on the server", () => {
+  test("createProjection(() => store) waits for the store", async () => {
+    function App() {
+      const rows = rowsStore();
+      const view = createProjection((() => rows) as any, [] as any[], { key: "id" } as any);
+      return (
+        <Loading fallback="loading">
+          <p>{view.map((r: any) => r.t).join(",")}</p>
+        </Loading>
+      );
+    }
+    const html = await render(App);
+    expect(html).toMatch(/loading.*<p[^>]*>A<\/p>/s);
+  });
+
+  test("createOptimisticStore(() => store) waits for the store", async () => {
+    function App() {
+      const rows = rowsStore();
+      const [view] = createOptimisticStore((() => rows) as any, [] as any[], { key: "id" } as any);
+      return (
+        <Loading fallback="loading">
+          <p>{view.map((r: any) => r.t).join(",")}</p>
+        </Loading>
+      );
+    }
+    const html = await render(App);
+    expect(html).toMatch(/loading.*<p[^>]*>A<\/p>/s);
+  });
+});
```

---

### Incident Patch 2: `83d42bae` (2026-11-20)
**Commit Message**: fix(signals): a removed row's cleanup can call an action during teardown (#5123) (#5124)

#4168 let a cleanup write during teardown by standing the owned-scope write
guard down while disposalDepth is raised. The action() guard, which its
comment calls the same scope test as setSignal, did not get the exemption, so
a keyed row whose cleanup invokes an action threw ACTION_CALLED_IN_OWNED_SCOPE
in development while production ran it.

Co-authored-by: Chris Gaafary <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/cleanup-action-during-teardown.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@solidjs/signals": patch
+---
+
+Allow calling an action from a cleanup during teardown, as #4165 allowed writes. Removing a keyed row ran its cleanups inside the list's pass, so an action invoked from an `onCleanup` or an effect's returned cleanup threw `ACTION_CALLED_IN_OWNED_SCOPE` in development, while the same cleanup under a branch switching away ran. The dev-only action guard now stands down while cleanups run, like the owned-scope write guard. Production builds are unchanged.
```

**File**: `packages/signals/src/core/action.ts` (modified, +10/-3)
```diff
@@ -1,6 +1,6 @@
 import { CONFIG_CHILDREN_FORBIDDEN } from "./constants.js";
 import { isThenable } from "./async.js";
-import { enterCallback, exitCallback, inRefCallback } from "./core.js";
+import { disposalDepth, enterCallback, exitCallback, inRefCallback } from "./core.js";
 import { getOwner } from "./owner.js";
 import type { Owner } from "./types.js";
 import { emitDiagnostic } from "./dev.js";
@@ -136,10 +136,17 @@ export function action<Args extends any[], Y, R>(
     // and a computation tracking what its action writes livelocks (every
     // write retriggers the compute, which fires a fresh invocation). Same
     // scope test as setSignal: leaf imperative scopes (tracked effects,
-    // onSettled) stay legal.
+    // onSettled) stay legal, and so do cleanups during teardown — a cleanup
+    // is not part of the computation disposing its owner (a list pass
+    // removing a row), so invoking an action there is imperative (#4165).
     if (__DEV__) {
       const owner = getOwner();
-      if (owner && !(owner._config & CONFIG_CHILDREN_FORBIDDEN) && !inRefCallback()) {
+      if (
+        owner &&
+        !(owner._config & CONFIG_CHILDREN_FORBIDDEN) &&
+        !disposalDepth &&
+        !inRefCallback()
+      ) {
         emitDiagnostic({
           code: "ACTION_CALLED_IN_OWNED_SCOPE",
           kind: "write",
```

**File**: `packages/signals/tests/for-row-cleanup-action.test.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+/**
+ * #4165 let a cleanup write during teardown: a cleanup is teardown, not part
+ * of whichever computation is disposing its owner. Invoking an action from a
+ * cleanup is the same imperative act, so the action guard stands down there
+ * too. Without it, removing a keyed row whose cleanup calls an action threw
+ * ACTION_CALLED_IN_OWNED_SCOPE in development, while the same cleanup under a
+ * branch switching away ran.
+ */
+import { afterEach, expect, it } from "vitest";
+import {
+  action,
+  createEffect,
+  createMemo,
+  createRenderEffect,
+  createRoot,
+  createSignal,
+  flush,
+  mapArray,
+  onCleanup,
+  untrack
+} from "../src/index.js";
+
+afterEach(() => flush());
+
+it("a removed row's onCleanup can call an action", async () => {
+  const [rows, setRows] = createSignal([1, 2]);
+  const [count, setCount] = createSignal(0);
+  const release = action(function* () {
+    setCount(n => n + 1);
+  });
+  const seen: unknown[] = [];
+  createRoot(() => {
+    const mapped = mapArray(rows, r => {
+      onCleanup(() => void release());
+      return r;
+    });
+    createRenderEffect(
+      () => mapped(),
+      v => void seen.push([...v])
+    );
+  });
+  flush();
+  setRows([2]);
+  flush();
+  await Promise.resolve();
+  flush();
+  setRows([2, 3]);
+  flush();
+  expect(seen).toEqual([[1, 2], [2], [2, 3]]);
+  expect(count()).toBe(1);
+});
+
+it("a removed row's effect-returned cleanup can call an action", async () => {
+  const [rows, setRows] = createSignal([1, 2]);
+  const [count, setCount] = createSignal(0);
+  const release = action(function* () {
+    setCount(n => n + 1);
+  });
+  createRoot(() => {
+    const mapped = mapArray(rows, r => {
+      createEffect(
+        () => r,
+        () => () => void release()
+      );
+      return r;
+    });
+    createRenderEffect(mapped, () => {});
+  });
+  flush();
+  setRows([2]);
+  flush();
+  await Promise.resolve();
+  flush();
+  expect(count()).toBe(1);
+});
+
+it("a branch's cleanup can call an action when the branch switches away", async () => {
+  const [on, setOn] = createSignal(true);
+  const [count, setCount] = createSignal(0);
+  const release = action(function* () {
+    setCount(n => n + 1);
+  });
+  createRoot(() => {
+    const branch = createMemo(() => {
+      if (!on()) return null;
+      return untrack(() => {
+        onCleanup(() => void release());
+        return 1;
+      });
+    });
+    createRenderEffect(branch, () => {});
+  });
+  flush();
+  setOn(false);
+  flush();
+  await Promise.resolve();
+  flush();
+  expect(count()).toBe(1);
+});
+
+it("still rejects an action called in a row's mapping body", () => {
+  const [rows] = createSignal([1]);
+  const noop = action(function* () {});
+  let caught: unknown;
+  createRoot(() => {
+    const mapped = mapArray(rows, r => {
+      try {
+        noop();
+      } catch (e) {
+        caught = e;
+      }
+      return r;
+    });
+    createRenderEffect(mapped, () => {});
+  });
+  flush();
+  expect(String(caught)).toMatch(/ACTION_CALLED_IN_OWNED_SCOPE/);
+});
```

**File**: `packages/web/test/for-row-cleanup-action.spec.tsx` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+/**
+ * @jsxImportSource @solidjs/web
+ * @vitest-environment jsdom
+ */
+// #4165 let a removed <For> row's cleanup write; invoking an action from the
+// same cleanup is the same imperative act and must not be rejected as a call
+// in the list's owned scope.
+import { afterEach, expect, test } from "vitest";
+import { action, createSignal, flush, For, onCleanup, onSettled, resetErrorHalt } from "solid-js";
+import { render } from "../src/index.js";
+
+afterEach(() => resetErrorHalt());
+
+for (const [label, register] of [
+  ["onSettled cleanup", (fn: () => void) => onSettled(() => fn)],
+  ["onCleanup", (fn: () => void) => onCleanup(fn)]
+] as const)
+  test(`a row's ${label} can call an action when the row is removed`, async () => {
+    const [rows, setRows] = createSignal([1, 2]);
+    const [released, setReleased] = createSignal<number[]>([]);
+    const release = action(function* (n: number) {
+      yield Promise.resolve();
+      setReleased(r => [...r, n]);
+    });
+    function Row(props: { n: number }) {
+      register(() => void release(props.n));
+      return <i>{props.n}</i>;
+    }
+    const div = document.createElement("div");
+    const dispose = render(() => <For each={rows()}>{n => <Row n={n} />}</For>, div);
+    flush();
+    expect(div.textContent).toBe("12");
+    setRows([2]);
+    flush();
+    await Promise.resolve();
+    await Promise.resolve();
+    flush();
+    expect(div.textContent).toBe("2");
+    expect(released()).toEqual([1]);
+    setRows([2, 3]);
+    flush();
+    expect(div.textContent).toBe("23");
+    dispose();
+  });
```

---

### Incident Patch 3: `99db9bce` (2026-11-20)
**Commit Message**: fix(signals): refresh() while its answer is out waits for it, then re-asks once (#5094) (#5101)

A refresh() re-asks the same question (D-34, F-9), so the answer already
in flight is a valid value. Superseding it, a poll faster than the
response never landed an answer, and a hold that read the polled node
never settled.

Outside an action, a refresh() made while the node's promise flight is
pending now marks after that answer lands (a microtask after its flush).
Calls made meanwhile share one re-ask, and their waiters deliver its
answer. An action's refresh() still re-asks in its hold at once (D-31).
The change lives in refresh() alone: bundles without refresh() are
unchanged.


Claude-Session: https://claude.ai/code/session_0117BoWKDYxhpjoT3aFUwrQv

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/refresh-overlapping-poll-5094.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@solidjs/signals": patch
+---
+
+`refresh()` called while the same question's answer is still out no longer drops that answer (#5094). It waits for the answer to land, then re-asks once, however many times it was called meanwhile. Polling on an interval shorter than the response time now shows each answer, and other changes no longer wait behind the poll. A `refresh()` inside an action still re-asks at once in the action's hold.
```

**File**: `packages/signals/docs/RULES-INDEX.md` (modified, +3/-3)
```diff
@@ -58,7 +58,7 @@ Status legend: **live** stated and standing · **ruled** carries an explicit rul
 | F-5 | live | `docs/RULES-FUNDAMENTALS.md:77` | boundaries.ts×1 | lean.test.ts×1 loading-on-errorboundary-sibling-4638.test.ts×1 loading-on-held-change-4605.test.ts×2 loading-reveal-held-outside-4593.test.ts×1 | A disarmed boundary forwards: it keeps its content and holds like any reader, until `on` arms it again |
 | F-6 | live | `docs/RULES-FUNDAMENTALS.md:85` | boundaries.ts×1 constants.ts×2 core.ts×5 effect.ts×1 lanes.ts×10 scheduler.ts×4 seat.ts×2 verdict.ts×2 optimistic.ts×4 projection.ts×1 store.ts×3 | async-reads-ahead-edges.test.ts×1 async-reads-ahead-matrix.test.ts×2 async-reads-ahead-second-write.test.ts×1 derived-store-lane-derive.test.ts×1 error-is-an-answer.test.ts×1 gc.test.ts×1 ispending-async-derivation-4677.test.ts×3 ispending-memo-parked-seam-4439.test.ts×1 ispending-memo-wrapped-asker-4778.test.ts×2 latest-beside-staged-read-4365.test.ts×1 latest-derived-held-error-4106.test.ts×1 latest-derived-sync-error-4377.test.ts×1 latest-first-one-pass-4402.test.ts×1 latest-memo-inline-parity.test.ts×3 latest-stale-branch-hold-4661.test.ts×2 latest-two-readers-one-ask-4393.test.ts×5 loading-on-latest-fallback-4337.test.ts×1 optimistic-guess-beside-reask-4824.test.ts×1 optimistic-held-write-leak.test.ts×1 optimistic-layered-filter-4336.test.ts×1 optimistic-outside-reask-4690.test.ts×2 optimistic-question-change-4336.test.ts×6 optimistic-second-guess-reask-4629.test.ts×1 optimistic-second-log-guess-4666.test.ts×1 projection-lane-length-4631.test.ts×1 projection-second-guess-4629.test.ts×1 rejection-beside-ispending-3957.test.ts×1 derived-latest-confirmed-key.test.ts×1 derived-store-heal-4451.test.ts×1 unread-derive-midflight-mount-4491.test.ts×2 verdict-memo-after-staged-read.test.ts×1 verdict-memo-flight-no-reask.test.ts×7 verdict-memo-held-branch-4544.test.ts×3 verdict-memo-under-held-memo-4050.test.ts×1 verdict-read-order.test.ts×1 | Display-ahead readers show now and never hold the change they read ahead of; their own async holds them, in their own lane |
 | F-7 | live | `docs/RULES-FUNDAMENTALS.md:93` | boundaries.ts×2 action.ts×1 constants.ts×1 core.ts×8 effect.ts×2 lanes.ts×2 signals.ts×1 | error-staged-recovery.test.ts×1 ispending-async-derivation-4677.test.ts×1 loading-reveal-held-outside-4593.test.ts×1 optimistic-held-write-leak.test.ts×1 optimistic-lane-seam-loop-4643.test.ts×4 ref-born-held-staged-4767.test.ts×2 verdict-memo-after-staged-read.test.ts×2 | Nothing else reveals ahead of the hold it belongs to |
-| F-9 | live | `docs/RULES-FUNDAMENTALS.md:101` | boundaries.ts×2 async.ts×6 constants.ts×1 core.ts×10 effect.ts×1 lanes.ts×1 scheduler.ts×1 seat.ts×4 types.ts×4 verdict.ts×17 deferred.ts×2 projection.ts×1 store.ts×1 | action-refresh-ispending-loop-4349.test.ts×1 answered-then-reasked-released-reader.test.ts×1 answered-then-reasked-same-tick.test.ts×2 async-reads-ahead-second-write.test.ts×1 derived-store-derive-settle.test.ts×2 derived-store-first-landing-verdict.test.ts×1 first-load-superseded-answer-4569.test.ts×1 latest-first-one-pass-4402.test.ts×2 latest-ispending-refetch-loop.test.ts×1 loading-on-held-filter-refresh-4379.test.ts×1 midflight-memo-over-reask-4504.test.ts×1 optimistic-question-change-4336.test.ts×2 settle-diamond-revisit.test.ts×1 staged-error-netted-write.test.ts×1 staged-error-through-async-memo-4640.test.ts×1 two-sources-answered-reasked-4495.test.ts×2 verdict-memo-flight-no-reask.test.ts×9 verdict-probe-committed-4648.test.ts×2 | `isPending` is about a new question; a re-ask is quiet; a first load is loading, not pending |
+| F-9 | live | `docs/RULES-FUNDAMENTALS.md:101` | boundaries.ts×2 async.ts×6 constants.ts×1 core.ts×10 effect.ts×1 lanes.ts×1 scheduler.ts×1 seat.ts×4 types.ts×4 verdict.ts×17 deferred.ts×2 signals.ts×1 projection.ts×1 store.ts×1 | action-refresh-ispending-loop-4349.test.ts×1 answered-then-reasked-released-reader.test.ts×1 answered-then-reasked-same-tick.test.ts×2 async-reads-ahead-second-write.test.ts×1 derived-store-derive-settle.test.ts×2 derived-store-first-landing-verdict.test.ts×1 first-load-superseded-answer-4569.test.ts×1 latest-first-one-pass-4402.test.ts×2 latest-ispending-refetch-loop.test.ts×1 loading-on-held-filter-refresh-4379.test.ts×1 midflight-memo-over-reask-4504.test.ts×1 optimistic-question-change-4336.test.ts×2 refresh-overlapping-poll-5094.test.ts×1 settle-diamond-revisit.test.ts×1 staged-error-netted-write.test.ts×1 staged-error-through-async-memo-4640.test.ts×1 two-sources-answered-reasked-4495.test.ts×2 verdict-memo-flight-no-reask.test.ts×9 verdict-probe-committed-4648.test.ts×2 | `isPending` is about a new question; a re-ask is quiet; a first load is loading, not pending |
 | F-10 | live | `docs/RULES-FUNDAMENTALS.md:109` | async.ts×1 constants.ts×1 core.ts×8 guesses.ts×1 scheduler.ts×1 seat.ts×6 types.ts×1 verdict.ts×4 | latest-memo-inline-parity.test.ts×1 optimistic-lane-seam-loop-4643.test.ts×1 proto-key-removal
```

**File**: `packages/signals/src/core/core.ts` (modified, +4/-3)
```diff
@@ -2470,8 +2470,9 @@ export function staleValues<T>(fn: () => T, set = true): T {
 }
 
 /** Core half of `refresh()` (signals.ts): marks the next recompute a quiet
- * re-ask and schedules it. */
-export function markRefresh(node: Computed<any>): void {
+ * re-ask and schedules it. `check`: the owned-scope check alone, the mark
+ * coming after the answer out lands (#5094). */
+export function markRefresh(node: Computed<any>, check?: boolean): void {
   if (
     __DEV__ &&
     context &&
@@ -2492,7 +2493,7 @@ export function markRefresh(node: Computed<any>): void {
     });
     throw new Error(REACTIVE_WRITE_IN_OWNED_SCOPE_REFRESH_MESSAGE);
   }
-  if (typeof node._fn === "function" && !(node._flags & REACTIVE_DISPOSED)) {
+  if (!check && typeof node._fn === "function" && !(node._flags & REACTIVE_DISPOSED)) {
     // A refresh in a manual write's frame re-asks with the write as `prev`
     // (D-8, #3026). The next pass's flight is a quiet re-ask (F-9), unless an
     // input changed this tick.
```

**File**: `packages/signals/src/signals.ts` (modified, +35/-7)
```diff
@@ -42,7 +42,13 @@ import {
   staleReader,
   type Transaction
 } from "./core/scheduler.js";
-import { REACTIVE_JOINED, STATUS_ERROR, STATUS_PENDING } from "./core/constants.js";
+import {
+  REACTIVE_CHECK,
+  REACTIVE_DIRTY,
+  REACTIVE_JOINED,
+  STATUS_ERROR,
+  STATUS_PENDING
+} from "./core/constants.js";
 import { unwrapStatusError } from "./core/error.js";
 import { optimisticWrite } from "./core/guesses.js";
 import { truthConfirmed, truthRead } from "./core/truth.js";
@@ -900,9 +906,12 @@ export function resolve<T>(fn: () => T): Promise<T> {
  * - Accessor targets resolve with the settled value; store targets resolve
  *   with the store node passed (reads through it are fresh after the await).
  * - A failed re-ask rejects with the error.
- * - Semantics are quiescence, not flight identity: if another refresh (or
- *   any invalidation) supersedes this one mid-flight, the promise waits for
- *   — and delivers — whatever finally lands.
+ * - Semantics are quiescence, not flight identity: if an invalidation
+ *   supersedes this one mid-flight, the promise waits for — and delivers —
+ *   whatever finally lands.
+ * - Called while the target's previous answer is still out (outside an
+ *   action), it waits for that answer to land, then re-asks once; calls made
+ *   meanwhile share that re-ask, and the promise delivers its answer.
  *
  * @example
  * ```ts
@@ -949,12 +958,27 @@ export function refresh<T>(
   // answer. resolve()'s own eager compute is untouched: created after a
   // refresh it still settles stale-while-revalidate (#2930) — its contract is
   // "first settled value", not "next quiescent state".
-  markRefresh(node);
   // The transaction `refresh()` is called in (an action's slice): the
   // waiter, created on the microtask below, is its reader (`watch`).
   const own = flushTransaction;
+  // A re-ask while the same question's answer is out waits for that answer,
+  // then re-asks once: the answer is a valid value (D-34, F-9). Superseding
+  // it, a poll faster than the response never landed one, and a hold that
+  // read the polled node never settled (#5094). The calls made meanwhile mark
+  // after the landing's flush, so they coalesce as same-tick calls do, and
+  // their waiters deliver the re-ask's answer. An action's `refresh()`
+  // re-asks in its hold at once (D-31).
+  const flight = node._x?._inFlight as PromiseLike<unknown> | null | undefined;
+  const later = !!(
+    own === null &&
+    node._statusFlags & STATUS_PENDING &&
+    !(node._flags & (REACTIVE_CHECK | REACTIVE_DIRTY)) &&
+    typeof (flight as any)?.then === "function"
+  );
+  markRefresh(node, later);
   const promise = new Promise<any>((res, rej) => {
-    queueMicrotask(() => {
+    const run = () => {
+      if (later && node._x?._inFlight === flight) markRefresh(node);
       // The root is load-bearing: an ownerless computed is auto-disposing,
       // and the settle walk releases an unobserved one instead of re-running
       // it, so the waiter would never see the refetch land (#3888). Settle
@@ -990,7 +1014,11 @@ export function refresh<T>(
           own
         );
       createRoot(make);
-    });
+    };
+    if (later) {
+      const re = () => queueMicrotask(run);
+      flight!.then(re, re);
+    } else queueMicrotask(run);
   });
   // Fire-and-forget refresh must not turn a failed refetch into an unhandled
   // rejection; awaiting callers attach their own handlers to `promise`.
```

**File**: `packages/signals/tests/optimistic-lane-seam-loop-4643.test.ts` (modified, +5/-2)
```diff
@@ -346,7 +346,8 @@ for (const withMemo of [true, false])
         "a list lands=read:",
         "filter all=all:[2][4]",
         ...rest,
-        "land list=all:[2][4]",
+        // The second poll, made while the first's answer was out, waited for
+        // it and re-asked once (#5094): one list request fewer.
         "land list=all:[1][2][4]",
         "poll=all:[1][2][4]",
         "land list=all:[1][2][4]"
@@ -471,8 +472,10 @@ it("#4643: a toggle beside a held poll answer shows the screen's other rows, who
     "land poll=[1o][2o][3o] 3 left",
     "t3=[1o][2o][3x] 2 left",
     "land toggle:1=[1o][2o][3x] 2 left",
-    "land list=[1o][2o][3x] 2 left",
+    // A refresh made while the poll's answer was out re-asks after it lands
+    // (#5094), so its list request comes after the add's.
     "land add:3=[1o][2o][3x] 2 left",
+    "land list=[1o][2o][3x] 2 left",
     "land toggle:3=[1o][2o][3x] 2 left",
     "land list=[1o][2o][3x] 2 left",
     "land list=[1o][2o][3x] 2 left",
```

**File**: `packages/signals/tests/refresh-await.test.ts` (modified, +12/-7)
```diff
@@ -4,8 +4,9 @@
  * Contract under test:
  * - Accessor targets resolve with the settled value; store targets resolve
  *   with the store node passed (root or nested — the family re-asks as one).
- * - Quiescence, not flight identity: a superseding refresh (or any newer
- *   invalidation) folds every waiter onto whatever finally lands.
+ * - Quiescence, not flight identity: a newer invalidation (an input change)
+ *   folds every waiter onto whatever finally lands. A refresh made while a
+ *   re-ask's answer is out waits for it and re-asks once (#5094).
  * - The seam is the landing itself, not graph notification: an equal-value
  *   landing (completely silent to subscribers) still settles the promise.
  * - A failed re-ask rejects with the error; `yield refresh(x)` in an action
@@ -191,7 +192,7 @@ test("fire-and-forget refresh with a failing re-ask surfaces no unhandled reject
   dispose();
 });
 
-test("supersession: waiters from both refreshes deliver the final landing", async () => {
+test("overlapping refreshes: the answer out lands, then one re-ask (#5094)", async () => {
   const gates: ReturnType<typeof deferred<string>>[] = [];
   let m!: SourceAccessor<string>;
   let dispose!: () => void;
@@ -212,18 +213,22 @@ test("supersession: waiters from both refreshes deliver the final landing", asyn
   const p1 = refresh(m);
   flush();
   await tick();
-  const p2 = refresh(m); // supersedes flight 2 with flight 3
+  // Flight 2 is out: this re-ask waits for its answer, then asks once.
+  const p2 = refresh(m);
   flush();
   await tick();
+  expect(gates.length).toBe(2);
 
-  // The superseded flight landing is ignored — not delivered to anyone.
-  gates[1].resolve("stale");
+  // Flight 2's answer is a valid value of the same question (D-34): it lands
+  // and settles p1; p2's re-ask goes up after it.
+  gates[1].resolve("second");
   await tick();
   flush();
+  await expect(p1).resolves.toBe("second");
+  expect(gates.length).toBe(3);
   gates[2].resolve("final");
   await tick();
   flush();
-  await expect(p1).resolves.toBe("final");
   await expect(p2).resolves.toBe("final");
   expect(m()).toBe("final");
   dispose();
```

**File**: `packages/signals/tests/refresh-overlapping-poll-5094.test.ts` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+/**
+ * #5094: `refresh()` while the same question's answer is still out waits for
+ * that answer and re-asks once after it lands. A re-ask asks the same
+ * question (D-34, F-9), so the answer in flight is a valid value: superseding
+ * it, a poll faster than the response never showed a new value, and an
+ * unrelated write that read the polled memo waited behind the poll forever.
+ */
+import { expect, test } from "vitest";
+import {
+  action,
+  createMemo,
+  createRenderEffect,
+  createRoot,
+  createSignal,
+  flush,
+  isPending,
+  refresh
+} from "../src/index.js";
+
+const tick = () => new Promise<void>(r => setTimeout(r, 0));
+
+function setup() {
+  const answers: ((v: number) => void)[] = [];
+  let asked = 0;
+  const seen: number[] = [];
+  let stats!: () => number;
+  createRoot(() => {
+    stats = createMemo(() => {
+      const n = ++asked;
+      return new Promise<number>(r => answers.push(() => r(n)));
+    });
+    createRenderEffect(stats, v => {
+      seen.push(v);
+    });
+  });
+  flush();
+  const answer = async () => {
+    answers.shift()!(0);
+    await tick();
+    await tick();
+  };
+  return { answers, seen, stats: () => stats, asked: () => asked, answer };
+}
+
+test("refreshes while an answer is out coalesce into one re-ask after it lands", async () => {
+  const { seen, stats, asked, answer } = setup();
+  await answer();
+  expect(seen).toEqual([1]);
+
+  refresh(stats());
+  await tick();
+  expect(asked()).toBe(2);
+
+  // Two more polls while #2 is out: no new request yet.
+  refresh(stats());
+  refresh(stats());
+  await tick();
+  expect(asked()).toBe(2);
+
+  // #2 lands and shows; the polls owe one re-ask.
+  await answer();
+  expect(seen).toEqual([1, 2]);
+  expect(asked()).toBe(3);
+
+  await answer();
+  expect(seen).toEqual([1, 2, 3]);
+  // Nothing was owed after #3.
+  expect(asked()).toBe(3);
+});
+
+test("a poll faster than the response shows every answer", async () => {
+  const { seen, stats, asked, answer } = setup();
+  await answer();
+  for (let i = 0; i < 4; i++) {
+    refresh(stats());
+    await tick();
+    refresh(stats());
+    await tick();
+    await answer();
+  }
+  expect(seen).toEqual([1, 2, 3, 4, 5]);
+  expect(asked()).toBe(6);
+});
+
+test("the awaited refresh() settles at the answer that lands", async () => {
+  const { stats, answer } = setup();
+  await answer();
+  refresh(stats());
+  await tick();
+  const p = refresh(stats());
+  await answer();
+  await answer();
+  expect(await p).toBeGreaterThanOrEqual(2);
+});
+
+test("a write that reads the polled memo is not held behind the poll", async () => {
+  const answers: ((v: string) => void)[] = [];
+  const seen: string[] = [];
+  let stats!: () => string;
+  let setRange!: (v: number) => void;
+  createRoot(() => {
+    const [range, set] = createSignal(1);
+    setRange = set;
+    stats = createMemo(() => {
+      const r = range();
+      return new Promise<string>(res => answers.push(() => res("range " + r)));
+    });
+    createRenderEffect(stats, v => {
+      seen.push(v);
+    });
+  });
+  flush();
+  answers.shift()!("");
+  await tick();
+  expect(seen).toEqual(["range 1"]);
+
+  refresh(stats);
+  await tick();
+  setRange(2);
+  flush();
+  // Polls keep coming while the range's answer is out.
+  refresh(stats);
+  await tick();
+  while (answers.length) {
+    answers.shift()!("");
+    await tick();
+    await tick();
+  }
+  expect(seen[seen.length - 1]).toBe("range 2");
+});
+
+test("refresh() with nothing out re-asks at once", async () => {
+  const { stats, asked, answer } = setup();
+  await answer();
+  refresh(stats());
+  await tick();
+  expect(asked()).toBe(2);
+  await answer();
+  refresh(stats());
+  await tick();
+  expect(asked()).toBe(3);
+});
+
+test("the coalesced re-ask stays quiet", async () => {
+  const { stats, answer } = setup();
+  await answer();
+  refresh(stats());
+  await tick();
+  refresh(stats());
+  let pending: boolean | undefined;
+  createRoot(() =>
+    createRenderEffect(
+      () => isPending(stats()),
+      v => void (pending = v)
+    )
+  );
+  flush();
+  expect(pending).toBe(false);
+  await answer();
+  expect(pending).toBe(false);
+});
+
+test("an action's refresh() still re-asks inside its hold", async () => {
+  const { stats, asked, answer } = setup();
+  await answer();
+  refresh(stats());
+  await tick();
+  expect(asked()).toBe(2);
+  const run = action(function* () {
+    yield refresh(stats());
+  });
+  const done = run();
+  await tick();
+  expect(asked()).toBe(3);
+  await answer();
+  await answer();
+  await done;
+});
```

#### Recent Merged Pull Requests:
- **PR #5138** (2026-11-20): docs(signals): a pass stops at its first throw; read order decides a rejection's first screen (#5114) (@ryansolid)
- **PR #5137** (2026-11-20): refactor(signals): a guessed node stores two values; its lane holds the waiting guess (@ryansolid)
- **PR #5135** (2026-11-20): docs: optimistic writes always revert; examples keep the truth (#5129) (@devagrawal09)
- **PR #5134** (2026-11-20): test(babel-plugin): accept @babel/generator 8.1.3's NaN output (fixes red babel-8 job) (@ryansolid)
- **PR #5133** (2026-11-20): docs: state the engine's value model in AGENTS.md (@ryansolid)
- **PR #5132** (closed): fix(compiler): keep JSX setup of a later declarator in place (#5102) (@devagrawal09)

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

## X. solid): a server projection over a pending async store waits for it

**RULE**:
When implementing operations in `.changeset/ssr-projection-pending-store-5097.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in solidjs/solid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fc0dac0c`: solid): a server projection over a pending async store waits for it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/ssr-projection-pending-store-5097.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"solid-js": patch
---

On the server, a projection or derived optimistic store whose function returns a pending async store (`createProjection(() => rows, …)`, `createOptimisticStore(() => rows, …)`) now waits for that store like a derive that read it, so `<Loading>` shows its fallback and the answer streams in. Before, adopting the pending store threw `NotReadyError` out of the component body.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fc0dac0c` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
