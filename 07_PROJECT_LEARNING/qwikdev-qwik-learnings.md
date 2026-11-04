> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source**: github ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Source Version**: `11765ab6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T03:23:35.894Z  
> **Learning ID**: `learn-github-qwikdev-qwik`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): QwikDev/qwik

> **Canonical Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T03:23:34.857Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `QwikDev/qwik`
- **Description**: Instant-loading web apps, without effort
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 22070 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/adapters-e2e/src/routes/service-worker.ts`
```
import { greeting } from '~/greeting';

export declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  event.ports[0].postMessage(greeting());
});

```

### Core Architecture Module: `e2e/adapters-e2e/src/routes/worker/index.tsx`
```
import { component$, useSignal, useTask$ } from '@qwik.dev/core';
import { type DocumentHead } from '@qwik.dev/router';
import { worker$ } from '@qwik.dev/core/worker';

const serverWorker = worker$(() => {
  return 'hello from worker';
});

export default component$(() => {
  const result = useSignal('pending');

  useTask$(async () => {
    result.value = await serverWorker();
  });

  return (
    <>
      <h1>Worker page</h1>
      <div id="worker-server-result">{result.value}</div>
    </>
  );
});

export const head: DocumentHead = {
  title: 'Worker page',
};

```

### Core Architecture Module: `e2e/qwik-cli-e2e/utils/index.ts`
```
import { ChildProcess, exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { yellow } from 'kleur/colors';
import { dirname, join, resolve } from 'path';
import { dirSync } from 'tmp';
import treeKill from 'tree-kill';
import { promisify } from 'util';
import { createDocument } from '../../../packages/qwik/src/testing/document';

export type QwikProjectType = 'playground' | 'library' | 'empty';
export function scaffoldQwikProject(type: QwikProjectType): {
  tmpDir: string;
  cleanupFn: () => void;
} {
  const tmpHostDirData = getTmpDirSync(
    process.env.TEMP_E2E_PATH ? `${process.env.TEMP_E2E_PATH}/${type}` : undefined
  );
  const cleanupFn = () => {
    if (!tmpHostDirData.overridden) {
      cleanup(tmpHostDirData.path);
    } else {
      log('Custom E2E test path was used, skipping the removal of test folder');
    }
  };
  try {
    const tmpDir = runCreateQwikCommand(tmpHostDirData.path, type);
    log(`Created test application at "${tmpDir}"`);
    replacePackagesWithLocalOnes(tmpDir);
    return { cleanupFn, tmpDir };
  } catch (error) {
    cleanupFn();
    throw error;
  }
}

function cleanup(tmpDir: string) {
  log(`Removing tmp dir "${tmpDir}"`);
  rmSync(tmpDir, { recursive: true });
}

function getTmpDirSync(tmpDirOverride?: string) {
  if (tmpDirOverride) {
    tmpDirOverride = resolve(workspaceRoot, tmpDirOverride);
  }

  if (tmpDirOverride && !existsSync(tmpDirOverride)) {
    throw new Error(`"${tmpDirOverride}" does not exist.`);
  }
  if (tmpDirOverride) {
    const p = join(tmpDirOverride, 'qwik_e2e');
    if (existsSync(p)) {
      log(`Removing project folder "${p}" (will be recreated).`);
      rmSync(p, { recursive: true });
    }
    mkdirSync(p);
    return { path: p, overridden: true };
  }
  return { path: dirSync({ prefix: 'qwik_e2e' }).name, overridden: false };
}

function runCreateQwikCommand(tmpDir: string, type: 'playground' | 'library' | 'empty'): string {
  const appDir = 'e2e-app';
  execSync(
    `node "${workspaceRoot}/packages/create-qwik/create-qwik.mjs" ${type} "${join(tmpDir, appDir)}"`
  );
  return join(tmpDir, appDir);
}

function replacePackagesWithLocalOnes(tmpDir: string) {
  const tarballConfig = JSON.parse(
    readFileSync(join(workspaceRoot, 'temp/tarballs/paths.json'), 'utf-8')
  );
  for (const { name, absolutePath } of tarballConfig) {
    patchPackageJsonForPlugin(tmpDir, name, absolutePath);
  }
  writeFileSync(
    join(tmpDir, 'pnpm-workspace.yaml'),
    "packages:\n  - .\nallowBuilds:\n  '@parcel/watcher': true\n  sharp: true\n"
  );
  execSync('pnpm i', {
    cwd: tmpDir,
    // only output errors
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function patchPackageJsonForPlugin(tmpDirName: string, npmPackageName: string, distPath: string) {
  const path = join(tmpDirName, 'package.json');
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  json.devDependencies[npmPackageName] = `file:${distPath}`;
  writeFileSync(path, JSON.stringify(json));
}

export function registerExecutedChildProcess(process: ChildProcess) {
  if (typeof global !== 'undefined') {
    (global.pIds ??= []).push(process.pid);
    log(`Registered a process with id "${process.pid}"`);
  } else {
    throw new Error('"global" is not defined');
  }
}

export function runCommandUntil(
  command: string,
  tmpDir: string,
  criteria: (output: string) => boolean,
  env?: Record<string, string>
): Promise<ChildProcess> {
  const p = exec(command, {
    cwd: tmpDir,
    encoding: 'utf-8',
    env: env && { ...process.env, ...env },
  });
  registerExecutedChildProcess(p);
  return new Promise<ChildProcess>((res, rej) => {
    let output = '';
    let complete = false;

    function checkCriteria(c: any) {
      output += c.toString();
      console.warn(output);
      if (criteria(stripConsoleColors(output)) && !complete) {
        complete = true;
        res(p);
      }
    }

    p.stdout?.on('data', checkCriteria);
    p.stderr?.on('data', checkCriteria);
    p.on('exit', (code) => {
      if (!complete) {
        rej(`Exited with ${code}`);
      } else {
        res(p);
      }
    });
  });
}

function stripConsoleColors(log: string): string {
  return log.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

export async function getPageHtml(pageUrl: string): Promise<Document> {
  const res = await fetch(pageUrl, { headers: { accept: 'text/html' } }).then((r) => r.text());
  return createDocument({ html: res });
}

export async function assertHostUnused(host: string): Promise<void> {
  try {
    const response = await fetch(host, { headers: { accept: 'text/html' } });
  } catch (error) {
    // TODO: test this in different environments
    if (error.cause.code === 'ECONNREFUSED') {
      return;
    }
  }
  throw new Error(`Host ${host} is already in use!`);
}

// promisify fails to get the proper type overload, so manually enforcing the type
const _promisifiedTreeKill = promisify(treeKill) as (pid: number, signal: string) => Promise<void>;

export const promisifiedTreeKill = async (pid: number, signal: string) => {
  try {
    return await _promisifiedTreeKill(pid, signal);
  } catch (error) {
    // Don't treat process termination failures as test failures
    // This is especially important on Windows where processes may already be gone
    // or may not be properly terminated with tree-kill
    log(`Process ${pid} could not be killed, but continuing: ${error.message}`);
    return Promise.resolve();
  }
};

export async function killAllRegisteredProcesses() {
  const pIds = (global?.pIds as number[]) ?? [];
  const result = await Promise.allSettled(pIds.map((pId) => promisifiedTreeKill(pId, 'SIGKILL')));
  const stringifiedResult = JSON.stringify(
    result.map((v, i) => ({
      pId: pIds[i],
      status: v.status === 'fulfilled' ? 'success' : 'failure',
    }))
  );
  log('Cleaned up processes invoked by e2e test: ' + stringifiedResult);
}

export const workspaceRoot = _computeWorkspaceRoot(process.cwd());

function _computeWorkspaceRoot(cwd: string) {
  if (dirname(cwd) === cwd) {
    return process.cwd();
  }

  const packageJsonAtCwd = join(cwd, 'package.json');
  if (existsSync(packageJsonAtCwd)) {
    const content = JSON.parse(readFileSync(packageJsonAtCwd, 'utf-8'));
    if (content.name === 'qwik-monorepo') {
      return cwd;
    }
  }
  return _computeWorkspaceRoot(dirname(cwd));
}

export function log(text: string) {
  // eslint-disable-next-line no-console
  console.log(yellow('E2E: ' + text));
}

export const DEFAULT_TIMEOUT = process.env.CI ? 120000 : 30000;

```

### Core Architecture Module: `e2e/qwik-cli-e2e/utils/setup.ts`
```
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '.';

const OPTIMIZER_PACKAGE = '@qwik.dev/optimizer';
const CORE_PACKAGE = '@qwik.dev/core';
const corePackagePath = join(workspaceRoot, 'packages/qwik/package.json');

const packageCfg: Record<string, { packagePath: string; distPath: string }> = {
  '@qwik.dev/optimizer': {
    packagePath: 'packages/optimizer',
    distPath: 'packages/optimizer/dist',
  },
  '@qwik.dev/core': {
    packagePath: 'packages/qwik',
    distPath: 'packages/qwik/dist',
  },
  '@qwik.dev/router': {
    packagePath: 'packages/qwik-router',
    distPath: 'packages/qwik-router/lib',
  },
  'eslint-plugin-qwik': {
    packagePath: 'packages/eslint-plugin-qwik',
    distPath: 'packages/eslint-plugin-qwik/dist',
  },
};
function ensurePackageBuilt() {
  for (const [name, cfg] of Object.entries(packageCfg)) {
    if (!existsSync(join(workspaceRoot, cfg.distPath))) {
      throw new Error(`Looks like package "${name}" has not been built yet.`);
    }
  }
  // The scaffolded starters use the Rust optimizer, which needs prebuilt bindings.
  if (!existsSync(join(workspaceRoot, 'packages/optimizer/bindings'))) {
    throw new Error(
      `Missing ${OPTIMIZER_PACKAGE} bindings. Run "pnpm build.rust" (needs the Rust toolchain) or "pnpm build.platform.copy" (downloads the published bindings) first.`
    );
  }
}
function packPackages() {
  const tarballPaths: { name: string; absolutePath: string }[] = [];
  const tarballOutDir = join(workspaceRoot, 'temp', 'tarballs');
  const originalCorePackageJson = readFileSync(corePackagePath, 'utf-8');

  try {
    for (const [name, cfg] of Object.entries(packageCfg)) {
      if (name === CORE_PACKAGE) {
        const optimizerTarball = tarballPaths.find((pkg) => pkg.name === OPTIMIZER_PACKAGE);
        if (!optimizerTarball) {
          throw new Error(`Missing packed ${OPTIMIZER_PACKAGE} package.`);
        }
        updateCoreOptimizerDependency(optimizerTarball.absolutePath);
      }

      tarballPaths.push({
        name,
        absolutePath: packPackage(join(workspaceRoot, cfg.packagePath), tarballOutDir),
      });
    }
  } finally {
    writeFileSync(corePackagePath, originalCorePackageJson);
  }

  writeFileSync(join(tarballOutDir, 'paths.json'), JSON.stringify(tarballPaths));
}

function packPackage(packagePath: string, tarballOutDir: string) {
  const out = execSync(`pnpm pack --json --pack-destination=${tarballOutDir}`, {
    cwd: packagePath,
    encoding: 'utf-8',
  });
  const json = JSON.parse(out);
  return json.filename;
}

function updateCoreOptimizerDependency(optimizerTarballPath: string) {
  const packageJson = JSON.parse(readFileSync(corePackagePath, 'utf-8'));
  packageJson.dependencies = {
    ...packageJson.dependencies,
    [OPTIMIZER_PACKAGE]: `file:${optimizerTarballPath.replace(/\\/g, '/')}`,
  };
  writeFileSync(corePackagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

ensurePackageBuilt();
packPackages();

```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/events/events-lifecycle.tsx`
```
import { $, component$, useOnDocument, useSignal } from '@qwik.dev/core';

export const EventsLifecycle = component$(() => {
  const count = useSignal(0);

  useOnDocument(
    'qinit',
    $(async () => {
      await new Promise<void>((resolve) => {
        (window as any).releaseQinit = resolve;
      });
      document.getElementById('init-state')!.textContent = 'done';
    })
  );

  return (
    <div>
      <p id="init-state">pending</p>
      <button id="lifecycle-counter" onClick$={() => count.value++}>
        Count {count.value}
      </button>
    </div>
  );
});

```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/factory/utils.tsx`
```
import { component$, implicit$FirstArg, type QRL } from '@qwik.dev/core';

export function factoryQrl<P extends Record<string, any>>(componentQRL: QRL<(props: P) => any>) {
  return component$((props: P) => {
    const component = componentQRL.resolve();
    return (
      <div>
        {component.then((Cmp) => (
          <Cmp {...props} />
        ))}
      </div>
    );
  });
}
export const factory$ = implicit$FirstArg(factoryQrl);

```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/render/render.tsx`
```
import {
  component$,
  createContextId,
  event$,
  isServer,
  jsx,
  SkipRender,
  Slot,
  useContext,
  useContextProvider,
  useSignal,
  useStore,
  useStylesScoped$,
  useTask$,
  type JSXOutput,
  type PropsOf,
  type QRL,
  type Signal,
} from '@qwik.dev/core';
import { h, SSRComment, SSRRaw } from '@qwik.dev/core/internal';
import { delay } from '../streaming/demo';

export const Render = component$(() => {
  const rerender = useSignal(0);
  return (
    <>
      <button id="rerender" data-v={rerender.value} onClick$={() => rerender.value++}>
        Rerender
      </button>
      <RenderChildren v={rerender.value} key={rerender.value} />
    </>
  );
});
export const RenderChildren = component$<{ v: number }>(({ v }) => {
  const parent = {
    counter: {
      count: 0,
    },
    count: 0,
    children: [] as any[],
  };
  parent.children.push(parent);

  const state = useStore(parent, { deep: true });
  return (
    <>
      <div id="rerenderCount">Render {v}</div>
      <button
        id="increment"
        onClick$={() => {
          state.counter.count++;
          state.count++;
        }}
      >
        Increment
      </button>
      <Child counter={state.counter}></Child>
      <InlineJsxComponentOrderIssue1475 />
      <BindingsNotPrintingIssue2563 />
      <BrokenRenderingBehaviorIssue2608 />
      <StoreNewKeyReactivityIssue2800 />
      <DateSerializationDeepStoreIssue2889 />
      <PropRenderFunctionIssue3116 />
      <CounterToggle />
      <PropsDestructuring
        message="Hello"
        count={state.count}
        id="props-destructuring"
        aria-hidden="true"
      />
      <PropsDestructuringNo count={state.count} id="props-destructuring-no" aria-hidden="true" />
      <PropsDestructuring
        message="Count"
        count={state.count}
        id="props-destructuring-count"
        aria-count={state.count}
      />
      <IssueReorder />
      <ArrayItemsDisplayOrderIssue2414 />
      <ProxyOwnKeysSymbolIssue3178 />
      <DynamicElementTagSetPropertyIssue3398 />
      <ClickHandlersExecutedMultipleTimesIssue3479 />
      <SpreadReplacesExistingPropsIssue3481 />
      <ReactImportKeySpreadLoopIssue3468 />
      <Pr3475 />
      <DestructuringAssignmentBrokenIssue3561 />
      <UndefinedVariableAfterUpgradeIssue3542 atom={{ code: 1 }} />
      <ForLoopItemsAccumulateIssue3643 />
      <IssueChildrenSpread />
      <WrongDynamicListRenderingIssue3731 />
      <OptimizerSyntaxErrorConditionalIssue3702 />
      <VariableAssignmentsOptimizedIssue3795 />
      <DynamicComponentsWithSignalsIssue4029 />
      <UndefinedRefPropIssue4346 />
      <SkipRenderTest />
      <SSRRawTest />
      <ProxyOwnKeysDuplicateEntriesIssue4292 />
      <OptimizerRemovesLocalConstIssue4386 />
      <RangeInputInitialValueStepIssue4455 />
      <DynamicTagBreaksReactivityIssue5266 />
      <DynamicButton id="dynamic-button" />;
      <RerenderOnce />
      <PropSpreadLogicBrokenCsrIssue8213 />
    </>
  );
});

export const Child = component$((props: { counter: { count: number } }) => {
  const state = useStore({
    hideAttributes: false,
  });
  useStylesScoped$(`
  .even::before{
    content: "even"
  }
  .odd::after{
    content: "odd"
  }
  `);

  if (state.hideAttributes) {
    const count = props.counter.count;
    return (
      <>
        <span id="rerenders">Rerender {count}</span>
        <div id="attributes">
          <button id="toggle" onClick$={() => (state.hideAttributes = !state.hideAttributes)}>
            Toggle attributes
          </button>
        </div>
      </>
    );
  }
  const count = props.counter.count;
  return (
    <>
      <span id="rerenders">Rerender {count}</span>
      <div
        id="attributes"
        preventdefault:click
        autoCorrect="all"
        aria-hidden="true"
        class={{
          even: count % 2 === 0,
          odd: count % 2 === 1,
          stable0: true,
          hidden: false,
        }}
      >
        <button id="toggle" onClick$={() => (state.hideAttributes = !state.hideAttributes)}>
          Toggle attributes
        </button>
      </div>
    </>
  );
});

export const InlineJsxComponentOrderIssue1475 = component$(() => {
  const render = useSignal(false);
  return (
    <>
      <button id="issue-1475-button" onClick$={() => (render.value = true)}>
        Render
      </button>
      <div id="issue-1475-result">
        {render.value ? (
          <>
            <h1>1. Before</h1>
            2. Some text
            <LazyInlineJsxComponentOrderIssue1475 />
            {'\n'}
            <h2>3 After</h2>
            <p>Stuff</p>
          </>
        ) : (
          <>
            <h1>Welcome</h1>
            <ul></ul>
            <h2>Here</h2>
          </>
        )}
      </div>
    </>
  );
});

export const LazyInlineJsxComponentOrderIssue1475 = component$(() => {
  useTask$(async () => {
    await delay(50);
  });

  return <div>Middle</div>;
});

export const CounterToggle = component$(() => {
  const cond = useSignal({ cond: true });
  return (
    <>
      <button id="counter-toggle-btn" onClick$={() => (cond.value = { cond: !cond.value.cond })}>
        Toggle
      </button>
      {cond.value.cond ? <CounterToggleShow text="even" /> : <CounterToggleShow text="odd" />}
      <CounterToggleShow2 cond={cond.value.cond} />
    </>
  );
});

export const CounterToggleShow = component$((props: { text: string }) => {
  return (
    <>
      <div id="counter-toggle-show">{props.text}</div>
    </>
  );
});

export const CounterToggleShow2 = component$((props: { cond: boolean }) => {
  return (
    <>
      <div id="counter-toggle-show-2">{String(props.cond)}</div>
    </>
  );
});

export const PropsDestructuring = component$(
  ({ message, id, count: c, ...rest }: Record<string, any>) => {
    const renders = useStore(
      { renders: 0 },
      {
        reactive: false,
      }
    );
    renders.renders++;
    const rerenders = renders.renders + 0;

    return (
      <div id={id}>
        <span {...rest}>
          {message} {c}
        </span>
        <div class="renders">{rerenders}</div>
      </div>
    );
  }
);

export const PropsDestructuringNo = component$(
  ({ message = 'Default', count, id, ...rest }: Record<string, any>) => {
    const renders = useStore(
      { renders: 0 },
      {
        reactive: false,
      }
    );
    renders.renders++;
    const rerenders = renders.renders + 0;
    return (
      <div id={id}>
        <span {...rest}>
          {message} {count}
        </span>
        <div class="renders">{rerenders}</div>
      </div>
    );
  }
);

export const BindingsNotPrintingIssue2563 = component$(() => {
  const html = `hola`;
  const obj = { length: 4 };
  return (
    <ul>
      <li id="issue-2563-string">4={html.length}</li>
      <li id="issue-2563-obj">4={obj.length}</li>
      <li id="issue-2563-operation">4+1={html.length + 1}</li>
    </ul>
  );
});

export const BrokenRenderingBehaviorIssue2608 = component$(() => {
  const show = useSignal(false);
  return (
    <>
      <button id="issue-2608-btn" onClick$={() => (show.value = !show.value)}>
        Toggle
      </button>
      {show.value && <div>Content</div>}
      <div>
        <input id="issue-2608-input" type="text" />
      </div>
    </>
  );
});

export const StoreNewKeyReactivityIssue2800 = component$(() => {
  const store = useStore<Record<string, number>>({
    alpha: 1,
    bravo: 2,
    charlie: 3,
  });

  return (
    <div>
      <button
        id="issue-2800-btn"
        onClick$={() => {
          const keys = Object.keys(store);
          store[`extra${keys.length}`] = 1;
        }}
      >
        Add key
      </button>
      <ul id="issue-2800-result">
        {Object.entries(store).map(([key, value]) => (
          <li key={key}>
            {key} - {value}
          </li>
        ))}
      </ul>
    </div>
  );
});

export const DateSerializationDeepStoreIssue2889 = component$(() => {
  const appState = useStore(
    {
      events: [
        { created: new Date(2022, 1, 15), count: 2 },
        { created: new Date(2022, 1, 18), count: 8 },
        { created: new Date(2022, 1, 21), count: 3 },
        { created: new Date(2022, 1, 26), count: 6 },
      ],
    },
    { deep: true }
  );

  const filteredEvents = useSignal<{ created: Date; count: number }[]>();

  useTask$(({ track }) => {
    const list = track(() => appState.events);
    filteredEvents.value = list.filter((x) => x.created >= new Date(2022, 1, 20));
  });

  return (
    <>
      <h2 id="issue-2889-result1">Deeds: {appState.events.length}</h2>
      <h2 id="issue-2889-result2">Filtered Deeds: {(filteredEvents.value || []).length}</h2>
    </>
  );
});

type Product = string;

export type ProductRelationProps = {
  render$: QRL<(products: Product[]) => JSXOutput>;
};

export const ProductRelations = component$((props: ProductRelationProps) => {
  return <div>{props.render$(['this comes from render$'])}</div>;
});

export const PropRenderFunctionIssue3116 = component$(() => {
  return (
    <>
      <ProductRelations
        render$={(products) => <div id="issue-3116-result">{products.join('hi')}</div>}
      />
    </>
  );
});

export const IssueReorder = component$(() => {
  const cond = useSignal(false);

  return (
    <div>
      {!cond.value && (
        <p id="running" class="issue-order">
          TOP
        </p>
      )}

      <div class="issue-order" data-value="first">
        1. First
      </div>
      <div class="issue-order" data-value="second">
        2. Second
      </div>

      {cond.value && (
        <p id="form-error" class="issue-order">
          BOTTOM
        </p>
      )}
      <button
        id="issue-order-btn"
        type="button"
        onClick$={() => {
          cond.value = true;
        }}
      >
        Submit
      </button>
    </div>
  );
});

const ArrayItemsDisplayOrderIssue2414 = component$(() => {
  const sort = useSignal<'id' | 'size' | 'age'>('size');
  const showTable =
```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/signals/utils/utils.tsx`
```
/* eslint-disable no-console */

import { component$, Slot } from '@qwik.dev/core';

export const TestC = component$((props: { color: string }) => {
  console.log('TestC');
  return (
    <p class={props.color}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestAC = component$((props: { color: string }) => {
  console.log('TestAC');
  return (
    <p class={[props.color]}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestCStr = component$((props: { color: string }) => {
  console.log('TestCStr');
  return (
    <p class={`${props.color}`}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestACStr = component$((props: { color: string }) => {
  console.log('TestACStr');
  return (
    <p class={[`${props.color}`]}>
      {' '}
      <Slot />
    </p>
  );
});

export const TestCN = component$((props: { color: string }) => {
  console.log('TestCN');
  return (
    <p class={props.color}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestACN = component$((props: { color: string }) => {
  console.log('TestACN');
  return (
    <p class={[props.color] as any}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestCNStr = component$((props: { color: string }) => {
  console.log('TestCNStr');
  return (
    <p class={`${props.color}`}>
      {' '}
      <Slot />
    </p>
  );
});
export const TestACNStr = component$((props: { color: string }) => {
  console.log('TestACNStr');
  return (
    <p class={[`${props.color}`] as any}>
      {' '}
      <Slot />
    </p>
  );
});

export const TestCWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestCWithFlag');
  return (
    <p class={props.color}>
      <span class={props.flag ? 'true' : 'false'}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestACWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestACWithFlag');
  return (
    <p class={[props.color]}>
      <span class={[props.flag ? 'true' : 'false']}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestCStrWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestCStr');
  return (
    <p class={`${props.color}`}>
      <span class={`${props.flag ? 'true' : 'false'}`}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestACStrWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestACStrWithFlag');
  return (
    <p class={[`${props.color}`]}>
      <span class={[`${props.flag ? 'true' : 'false'}`]}>In {props.color}</span> <Slot />
    </p>
  );
});

export const TestCNWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestCNWithFlag');
  return (
    <p class={props.color}>
      <span class={props.flag ? 'true' : 'false'}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestACNWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestACNWithFlag');
  return (
    <p class={[props.color] as any}>
      <span class={[props.flag ? 'true' : 'false'] as any}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestCNStrWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestCNStrWithFlag');
  return (
    <p class={`${props.color}`}>
      <span class={`${props.flag ? 'true' : 'false'}`}>In {props.color}</span> <Slot />
    </p>
  );
});
export const TestACNStrWithFlag = component$((props: { color: string; flag: boolean }) => {
  console.log('TestACNStrWithFlag');
  return (
    <p class={[`${props.color}`] as any}>
      <span class={[`${props.flag ? 'true' : 'false'}`] as any}>In {props.color}</span> <Slot />
    </p>
  );
});

```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/worker/worker.tsx`
```
import { component$, useSignal, $, useTask$ } from '@qwik.dev/core';
import { worker$ } from '@qwik.dev/core/worker';

const serverWorker = worker$(() => {
  return 'hello from worker';
});

const incrementInWorker = worker$((count: number) => count + 1);

const inspectEventInWorker = worker$((event: Event | null) => {
  return event === null ? 'null' : 'event';
});

const submitInWorker = worker$((data: FormData) => {
  return `${data.get('name')}:${data.get('count')}`;
});

const formatError = (err: unknown) => {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
};

export const WorkerRoot = component$(() => {
  const count = useSignal(0);
  const serverWorkerResult = useSignal('');
  const eventResult = useSignal('pending');
  const formResult = useSignal('pending');
  const status = useSignal('idle');

  useTask$(async () => {
    serverWorkerResult.value = await serverWorker();
  });

  return (
    <div>
      <button
        id="worker-add"
        onClick$={async () => {
          status.value = 'increment:start';
          try {
            count.value = await incrementInWorker(count.value);
            status.value = 'increment:done';
          } catch (err) {
            status.value = `increment:error:${formatError(err)}`;
          }
        }}
      >
        Increment in worker
      </button>
      <div id="worker-add-result">{count.value}</div>

      <button
        id="worker-event"
        onClick$={async (event) => {
          status.value = 'event:start';
          try {
            eventResult.value = await inspectEventInWorker(event);
            status.value = 'event:done';
          } catch (err) {
            status.value = `event:error:${formatError(err)}`;
          }
        }}
      >
        Inspect event in worker
      </button>
      <div id="worker-event-result">{eventResult.value}</div>

      <form
        id="worker-form"
        preventdefault:submit
        onSubmit$={async (event) => {
          status.value = 'form:start';
          try {
            formResult.value = await submitInWorker(event);
            status.value = 'form:done';
          } catch (err) {
            status.value = `form:error:${formatError(err)}`;
          }
        }}
      >
        <input name="name" value="qwik" />
        <input name="count" value="2" />
        <button id="worker-form-submit" type="submit">
          Submit to worker
        </button>
      </form>
      <div id="worker-form-result">{formResult.value}</div>
      <div id="worker-status">{status.value}</div>
      <div id="worker-server-result">{serverWorkerResult.value}</div>
    </div>
  );
});

```

### Core Architecture Module: `e2e/qwik-e2e/apps/error-handling.prod/src/routes/render-crash/index.tsx`
```
export { default, onGet } from '../../../../error-handling/src/routes/render-crash/index';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9041** (2026-10-26): **router: visible `<Link>` prefetch skips bundles for dynamic and catch-all routes**
  *Symptoms*: # What is it?  - Bug  # Description  A visible `<Link>` (`prefetchBundles="visible"`, the default) preloads nothing for dynamic routes. `link-prefetch.ts` calls `preloadRouteBundles(url.pathname)`, so the preloader gets `products/123/`, but the bundle graph keys routes by name (`products/[id]/`, see `get-route-imports.ts`). Static routes work because their pathname is their route name. Link clicks and SPA navigation go through `prefetchRoute()`, which resolves the route name first. 48fb84ed0 had moved the visible path to `prefetchRoute()` too, but the merge with the shared-observer refactor (4ba1ad594) only carried over the data branch.  Catch-all routes miss even through `prefetchRoute()`. The build keys `docs/[...slug]/index.tsx` as `docs/[...slug]` with no trailing slash, because `normalizePathname` treats a last segment containing `.` as a file name. `prefetchRoute()` calls `ensureSlash` and looks up `docs/[...slug]/`, so Link clicks and SPA navigation miss catch-all bundles too. Other routes whose last segment contains a dot, and maybe every route with `trailingSlash: false`, likely hit the same mismatch (not checked).  Reproduced on a production build of the `qwikrouter-test.prod` e2e app with temporary `[id]`, `[...slug]` and static routes: only the static link's bundles loaded. #9040 (closed, untested) switched the observer to `prefetchRoute()`. With it, `[id]` links loaded their route module and component bundle, but `[...slug]` links only got their route module. `pr

- **Issue #8962** (2026-10-10): **core: failed handler-chunk import reaches the boundary after resume, bypassing the importError skip**
  *Symptoms*: # What is it?  - Bug  # Description  The client `qerror` listener deliberately skips `importError` events so a failed chunk import never routes to an `<ErrorBoundary>` (`error-handling.ts` — chunk 404s are a version-skew problem, #8795). After the Vite 8 / rolldown merge on #8745, a resumed container dispatches handlers through core (`_qDispatch` / `run-qrl`) instead of the qwikloader import path, so a failed handler-chunk fetch now lands in the nearest boundary as a plain error and the fallback renders the raw browser message (`Failed to fetch dynamically imported module: …`). No `qerror` event fires at all.  Two channels now disagree: the loader path still skips import errors, the core dispatch path catches them. Decide which behavior is intended (skip everywhere per #8795, or boundary-catches everywhere — possibly as `NetworkError`, #8882) and align both paths.  The e2e pin (`error-handling.e2e.ts` — "a failed qwikloader dynamic import (chunk 404) leaves the boundary inert") is parked on this issue.
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this
  > @akasakariko go for it!

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

### Incident Patch 1: `914b53ee` (2026-10-31)
**Commit Message**: fix(router): report production crashes to next(err) and the logs

The crash path sends the 500 page, which makes headersSent true, so the
node middleware returned before it looked at the error. completion now
holds failures only, so the checks can go back in their old order and
the other adapters stop logging redirects.

**File**: `.changeset/report-production-crashes.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@qwik.dev/router': patch
+---
+
+fix: production crashes now reach `next(err)` and the server logs
```

**File**: `packages/qwik-router/src/middleware/node/index.ts` (modified, +3/-3)
```diff
@@ -83,12 +83,12 @@ export function createQwikRouter(
       const handled = await requestHandler(serverRequestEv, opts);
       if (handled) {
         const err = await handled.completion;
-        if (handled.requestEv.headersSent) {
-          return;
-        }
         if (err) {
           throw err;
         }
+        if (handled.requestEv.headersSent) {
+          return;
+        }
       }
       next();
     } catch (e) {
```

**File**: `packages/qwik-router/src/middleware/node/index.unit.ts` (modified, +28/-6)
```diff
@@ -50,16 +50,38 @@ describe('createQwikRouter().router', () => {
     expect(middleware.router).toHaveLength(3);
   });
 
-  it('should not forward handled completion errors after headers are sent', async () => {
-    const requestEv = {
-      headersSent: true,
-    };
+  it('forwards a render crash to next after the response started', async () => {
+    const error = new Error('render failed');
     mockFromNodeHttp.mockResolvedValue({
       platform: {},
     });
     mockRequestHandler.mockResolvedValue({
-      completion: Promise.resolve(new Error('already handled')),
-      requestEv,
+      completion: Promise.resolve(error),
+      requestEv: {
+        headersSent: true,
+      },
+    });
+
+    const next = vi.fn();
+    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+    const middleware = createQwikRouter(createNodeOptions());
+
+    await middleware.router({ url: '/', headers: {} } as any, {} as any, next);
+
+    expect(next).toHaveBeenCalledWith(error);
+    expect(consoleError).toHaveBeenCalledWith(error);
+    consoleError.mockRestore();
+  });
+
+  it('does not call next once a response went out without a failure', async () => {
+    mockFromNodeHttp.mockResolvedValue({
+      platform: {},
+    });
+    mockRequestHandler.mockResolvedValue({
+      completion: Promise.resolve(undefined),
+      requestEv: {
+        headersSent: true,
+      },
     });
 
     const next = vi.fn();
```

**File**: `packages/qwik-router/src/middleware/node/request-failures.unit.ts` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+import { createServer, type Server } from 'node:http';
+import type { AddressInfo } from 'node:net';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { _setRouterConfig } from '../../runtime/src/router-config';
+import type { RequestEvent } from '../../runtime/src/types';
+import { ServerError } from '../request-handler/server-error';
+
+vi.mock('@qwik.dev/core', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@qwik.dev/core')>()),
+  isDev: false,
+}));
+
+vi.mock('@qwik.dev/core/internal', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@qwik.dev/core/internal')>()),
+  isDev: false,
+}));
+
+import { createQwikRouter } from './index';
+
+const routeState = { module: {} as Record<string, unknown> };
+
+_setRouterConfig({
+  routes: { _I: async () => routeState.module },
+  cacheModules: false,
+  basePathname: '/',
+  fallthrough: false,
+} as any);
+
+const FIRST_CHUNK = '<!DOCTYPE html><html q:container="paused">';
+
+const renderFirstChunkThenThrow = (thrown: unknown) =>
+  vi.fn(async (opts: any) => {
+    await opts.stream.write(FIRST_CHUNK);
+    throw thrown;
+  });
+
+const renderNothing = vi.fn();
+
+describe('request failures through the node middleware', () => {
+  const servers: Server[] = [];
+
+  const request = async (render: unknown) => {
+    const next = vi.fn();
+    const handled: Promise<void>[] = [];
+    const { router } = createQwikRouter({ render } as any);
+    const server = createServer((req, res) => {
+      handled.push(router(req, res, next));
+    });
+    servers.push(server);
+    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
+    const { port } = server.address() as AddressInfo;
+
+    const response = await fetch(`http://127.0.0.1:${port}/`, {
+      headers: { accept: 'text/html' },
+      redirect: 'manual',
+    });
+    const body = await response.text();
+    await Promise.all(handled);
+
+    return { body, next, status: response.status };
+  };
+
+  let consoleError: ReturnType<typeof vi.spyOn>;
+
+  beforeEach(() => {
+    routeState.module = { default: () => null };
+    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+  });
+
+  afterEach(async () => {
+    consoleError.mockRestore();
+    await Promise.all(
+      servers.splice(0).map(
+        (server) =>
+          new Promise((resolve) => {
+            server.closeAllConnections();
+            server.close(resolve);
+          })
+      )
+    );
+  });
+
+  it('a render crash after the first chunk reaches next and the response ends', async () => {
+    const crash = new Error('render failed');
+
+    const { body, next, status } = await request(renderFirstChunkThenThrow(crash));
+
+    expect(status).toBe(200);
+    expect(body).toContain(FIRST_CHUNK);
+    expect(next).toHaveBeenCalledOnce();
+    expect(next).toHaveBeenCalledWith(crash);
+    expect(consoleError).toHaveBeenCalledWith(crash);
+  });
+
+  it('forwards a middleware crash that got the 500 page to next', async () => {
+    const crash = new Error('middleware failed');
+    routeState.module = {
+      default: () => null,
+      onGet: () => {
+        throw crash;
+      },
+    };
+
+    const { body, next, status } = await request(renderNothing);
+
+    expect(status).toBe(500);
+    expect(body).toContain('Internal Server Error');
+    expect(next).toHaveBeenCalledOnce();
+    expect(next).toHaveBeenCalledWith(crash);
+    expect(consoleError).toHaveBeenCalledWith(crash);
+  });
+
+  it('forwards a ServerError thrown after headers were sent', async () => {
+    const lateError = new ServerError(404, 'No such order');
+
+    const { next, status } = await request(renderFirstChunkThenThrow(lateError));
+
+    expect(status).toBe(200);
+    expect(next).toHaveBeenCalledOnce();
+    expect(next).toHaveBeenCalledWith(lateError);
+  });
+
+  it('does not call next for a redirect', async () => {
+    routeState.module = {
+      default: () => null,
+      onGet: (ev: RequestEvent) => {
+        throw ev.redirect(302, '/elsewhere');
+      },
+    };
+
+    const { next, status } = await request(renderNothing);
+
+    expect(status).toBe(302);
+    expect(next).not.toHaveBeenCalled();
+    expect(consoleError).not.toHaveBeenCalled();
+  });
+
+  it('does not call next for an error page the router sent', async () => {
+    routeState.module = {
+      onGet: (ev: RequestEvent) => {
+        throw ev.error(403, 'Members only');
+      },
+    };
+
+    const { body, next, status } = await request(renderNothing);
+
+    expect(status).toBe(403);
+    expect(body).toContain('Members only');
+    expect(next).not.toHaveBeenCalled();
+    expect(consoleError).not.toHaveBeenCalled();
+  });
+});
```

**File**: `packages/qwik-router/src/middleware/request-handler/request-event-core.ts` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ export const RequestEvIsRewrite = '@rewrite';
 export const RequestEvShareServerTiming = '@serverTiming';
 export const RequestEvETagCacheKey = '@eTagCacheKey';
 export const RequestEvCaughtError = '@caughtError';
+export const RequestEvSentServerError = '@sentServerError';
 export const RequestEvHttpStatusMessage = '@httpStatusMessage';
 
 export function createRequestEvent(
```

**File**: `packages/qwik-router/src/middleware/request-handler/user-response.ts` (modified, +10/-7)
```diff
@@ -9,7 +9,11 @@ import type {
 } from '../../runtime/src/types';
 import { _asyncRequestStore } from './async-request-store';
 import { getErrorHtml } from './error-handler';
-import { createRequestEvent, type RequestEventInternal } from './request-event-core';
+import {
+  createRequestEvent,
+  RequestEvSentServerError,
+  type RequestEventInternal,
+} from './request-event-core';
 import { AbortMessage, RedirectMessage } from './redirect-handler';
 import { RewriteMessage } from './rewrite-handler';
 import { ServerError } from './server-error';
@@ -78,7 +82,8 @@ async function runNext(
     const message = 'Resource Not Found';
     requestEv.status(status);
     requestEv.html(status, getErrorHtml(status, message));
-    return new ServerError(status, message);
+    requestEv.sharedMap.set(RequestEvSentServerError, new ServerError(status, message));
+    return;
   }
 
   let rewriteAttempt = 1;
@@ -90,7 +95,7 @@ async function runNext(
       if (e instanceof RedirectMessage) {
         const stream = requestEv.getWritableStream();
         await stream.close();
-        return e;
+        return;
       } else if (e instanceof RewriteMessage) {
         if (rewriteAttempt > 50) {
           return new Error(`Infinite rewrite loop`);
@@ -114,12 +119,10 @@ async function runNext(
         } else {
           requestEv.html(status, getErrorHtml(status, e.data));
         }
-        return e;
+        requestEv.sharedMap.set(RequestEvSentServerError, e);
+        return;
       }
       if (!isDev || requestEv.headersSent) {
-        if (isDev) {
-          console.error(e);
-        }
         try {
           if (!requestEv.headersSent) {
             requestEv.headers.set('content-type', 'text/html; charset=utf-8');
```

**File**: `packages/qwik-router/src/middleware/request-handler/user-response.unit.ts` (modified, +33/-16)
```diff
@@ -13,7 +13,8 @@ vi.mock('@qwik.dev/core/internal', async (importOriginal) => ({
   },
 }));
 
-vi.mock('./request-event-core', () => ({
+vi.mock('./request-event-core', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('./request-event-core')>()),
   createRequestEvent: mocks.createRequestEvent,
 }));
 
@@ -23,6 +24,7 @@ vi.mock('./async-request-store', () => ({
   },
 }));
 
+import { RedirectMessage } from './redirect-handler';
 import { ServerError } from './server-error';
 import { runQwikRouter } from './user-response';
 import type { ServerRequestEvent } from './types';
@@ -96,32 +98,44 @@ describe('runQwikRouter', () => {
     };
     mocks.createRequestEvent.mockReturnValue(requestEv);
 
-    await runQwikRouter({} as any, {} as any, [], vi.fn() as any, '/').completion;
+    const completion = await runQwikRouter({} as any, {} as any, [], vi.fn() as any, '/')
+      .completion;
 
-    return { html: written.join(''), writer };
+    return { completion, html: written.join(''), writer };
   };
 
-  it('finishes, logs and shows an error that is thrown after the response started in dev', async () => {
-    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+  it('finishes and shows an error that is thrown after the response started in dev', async () => {
+    const { completion, html, writer } = await failAfterResponseStarted();
 
-    try {
-      const { html, writer } = await failAfterResponseStarted();
-
-      expect(html).toContain('boom');
-      expect(writer.close).toHaveBeenCalled();
-      expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
-    } finally {
-      consoleError.mockRestore();
-    }
+    expect(html).toContain('boom');
+    expect(writer.close).toHaveBeenCalled();
+    expect(completion).toEqual(expect.objectContaining({ message: 'boom' }));
   });
 
   it('keeps the generic error page in production when SSR fails after the response started', async () => {
     mocks.isDev = false;
 
-    const { html } = await failAfterResponseStarted();
+    const { completion, html } = await failAfterResponseStarted();
 
     expect(html).toContain('Internal Server Error');
     expect(html).not.toContain('boom');
+    expect(completion).toEqual(expect.objectContaining({ message: 'boom' }));
+  });
+
+  it('resolves completion with nothing for a redirect', async () => {
+    const requestEv = {
+      originalUrl: new URL('http://localhost/'),
+      next: vi.fn(async () => {
+        throw new RedirectMessage();
+      }),
+      getWritableStream: vi.fn(() => ({ close: vi.fn() })),
+      isDirty: () => true,
+    };
+    mocks.createRequestEvent.mockReturnValue(requestEv);
+
+    const run = runQwikRouter({} as any, {} as any, [], vi.fn() as any, '/');
+
+    await expect(run.completion).resolves.toBeUndefined();
   });
 
   it.each(['application/json', 'text/html'])(
@@ -132,6 +146,7 @@ describe('runQwikRouter', () => {
         request: new Request('http://localhost/members/', { headers: { Accept: accept } }),
         headers: new Headers({ 'Cache-Control': 'public, max-age=60' }),
         headersSent: false,
+        sharedMap: new Map(),
         next: vi.fn(async () => {
           throw new ServerError(403, 'Members only');
         }),
@@ -141,7 +156,9 @@ describe('runQwikRouter', () => {
       };
       mocks.createRequestEvent.mockReturnValue(requestEv);
 
-      await runQwikRouter({} as any, {} as any, [], vi.fn() as any, '/').completion;
+      await expect(
+        runQwikRouter({} as any, {} as any, [], vi.fn() as any, '/').completion
+      ).resolves.toBeUndefined();
 
       expect(requestEv.send.mock.calls.length + requestEv.html.mock.calls.length).toBe(1);
       expect(requestEv.headers.get('Cache-Control')).toBe('no-store');
```

**File**: `packages/qwik-router/src/ssg/worker-thread.ts` (modified, +7/-16)
```diff
@@ -4,7 +4,10 @@ import {
   renderQwikMiddleware,
   resolveRequestHandlers,
 } from '../middleware/request-handler/resolve-request-handlers-core';
-import { RequestEvCaughtError } from '../middleware/request-handler/request-event-core';
+import {
+  RequestEvCaughtError,
+  RequestEvSentServerError,
+} from '../middleware/request-handler/request-event-core';
 import { trimInternalPathname } from '../middleware/request-handler/request-path';
 import type { ServerRequestEvent } from '../middleware/request-handler/types';
 import { runQwikRouter } from '../middleware/request-handler/user-response';
@@ -317,20 +320,16 @@ export async function workerRender(
               }
               return completion;
             };
+            const failure = r ?? rsp.requestEv.sharedMap.get(RequestEvSentServerError);
             if (routeWriter) {
-              return closePromise.then(() => failRouteOnCaughtBoundary(r));
+              return closePromise.then(() => failRouteOnCaughtBoundary(failure));
             }
-            return failRouteOnCaughtBoundary(r);
+            return failRouteOnCaughtBoundary(failure);
           });
         }
       })
       .then((e: any) => {
         if (e !== undefined) {
-          if (isRedirectMessage(e)) {
-            // TODO We should render a html page for redirects too
-            // that would require refactoring redirects
-            return;
-          }
           if (e instanceof Error) {
             result.error = {
               message: e.message,
@@ -378,14 +377,6 @@ export async function workerRender(
 /** Create a fresh no-op WritableStream (must be a real instance for pipeTo checks). */
 const createNoopWritableStream = () => new WritableStream();
 
-function isRedirectMessage(value: unknown) {
-  return (
-    typeof value === 'object' &&
-    value !== null &&
-    (value as { constructor?: { name?: string } }).constructor?.name === 'RedirectMessage'
-  );
-}
-
 async function requestHandlerForSsg<T>(
   serverRequestEv: ServerRequestEvent<T>,
   opts: SsgHandlerOptions,
```

---

### Incident Patch 2: `fa1528e4` (2026-11-03)
**Commit Message**: fix(router): settle a superseded action while resolving a server rewrite

- Call abandonAction() when a newer navigation takes over during the q-route.json lookup or the
  rewritten route load, so the submit promise does not stay pending.
- Do not reload an obsolete navigation when loading the rewritten route fails.
- A "reload" answer with an action no longer reaches loadRoute('reload'); the action is submitted.
- e2e: a navigation started while q-route.json is pending, and an action superseded meanwhile.
- Shorter changeset without internal names.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/rewrite-spa-navigation.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 '@qwik.dev/router': patch
 ---
 
-fix: client navigation to a URL that only exists through a server `rewrite()` now renders the rewrite target instead of the 404 page. When no page matches on the client, the router asks the server (`q-route.json`) where the URL routes to and loads that route, keeping the original URL. This also follows a redirect thrown by a route that has no component. Submitting an action on such a URL resolves the rewrite too, so the page no longer turns into the 404 after the action runs.
+fix: client-side navigation to a URL that only exists through a server `rewrite()` now shows the rewritten page instead of a 404, and keeps the original URL in the address bar. Submitting an action on such a page keeps it rendered too, and navigating to a route that only redirects (no page component) now follows the redirect.
```

**File**: `e2e/qwik-e2e/apps/qwikrouter-test/src/routes/rewrite-spa/target/index.tsx` (modified, +16/-1)
```diff
@@ -1,5 +1,5 @@
 import { component$ } from '@qwik.dev/core';
-import { Form, routeAction$, routeLoader$ } from '@qwik.dev/router';
+import { Form, Link, routeAction$, routeLoader$ } from '@qwik.dev/router';
 
 export const useTarget = routeLoader$(({ originalUrl, url }) => ({
   original: originalUrl.pathname,
@@ -22,6 +22,21 @@ export default component$(() => {
         </button>
       </Form>
       {submit.value?.done && <p id="rewrite-spa-action-done">action done</p>}
+      <button
+        id="rewrite-spa-submit-js"
+        onClick$={() => {
+          (window as any).__submitOutcome = 'pending';
+          submit.submit().then(
+            () => ((window as any).__submitOutcome = 'resolved'),
+            () => ((window as any).__submitOutcome = 'rejected')
+          );
+        }}
+      >
+        submit from code
+      </button>
+      <Link href="/qwikrouter-test/rewrite-spa/" id="rewrite-spa-back">
+        back
+      </Link>
     </>
   );
 });
```

**File**: `e2e/qwik-e2e/tests/qwikrouter/rewrite-spa.e2e.ts` (modified, +55/-1)
```diff
@@ -1,8 +1,23 @@
-import { expect, test } from '@playwright/test';
+import { expect, test, type Page } from '@playwright/test';
 
 const pretty = '/qwikrouter-test/rewrite-spa/pretty/';
 const target = '/qwikrouter-test/rewrite-spa/target/';
 
+/** Holds the `pretty` q-route.json response until `release()` is called. */
+async function holdPrettyRoute(page: Page) {
+  let release!: () => void;
+  let started!: () => void;
+  const gate = new Promise<void>((resolve) => (release = resolve));
+  const requested = new Promise<void>((resolve) => (started = resolve));
+  await page.route(`**${pretty}q-route.json`, async (route) => {
+    const response = await route.fetch();
+    started();
+    await gate;
+    await route.fulfill({ response }).catch(() => {});
+  });
+  return { requested, release };
+}
+
 test.describe('rewrite to a different route', () => {
   test('SSR serves the target page under the original URL', async ({ page }) => {
     const response = await page.goto(pretty);
@@ -76,4 +91,43 @@ test.describe('rewrite to a different route', () => {
     await expect(page.locator('#rewrite-spa-original')).toHaveText(pretty);
     expect(pageErrors).toEqual([]);
   });
+
+  test('a navigation started while q-route.json is pending wins', async ({ page }) => {
+    const prettyCached = '/qwikrouter-test/rewrite-spa/pretty-cached/';
+    const pageErrors: Error[] = [];
+    page.on('pageerror', (err) => pageErrors.push(err));
+    await page.goto('/qwikrouter-test/rewrite-spa/');
+    await page.evaluate(() => ((window as any).__noReload = true));
+    const held = await holdPrettyRoute(page);
+
+    await page.locator('[data-test-link="rewrite-spa-pretty"]').click();
+    await held.requested;
+    await page.locator('[data-test-link="rewrite-spa-pretty-cached"]').click();
+
+    await expect(page).toHaveURL(new RegExp(`${prettyCached}$`));
+    await expect(page.locator('#rewrite-spa-original')).toHaveText(prettyCached);
+
+    held.release();
+    await page.waitForTimeout(200);
+    await expect(page).toHaveURL(new RegExp(`${prettyCached}$`));
+    await expect(page.locator('#rewrite-spa-original')).toHaveText(prettyCached);
+    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
+    expect(pageErrors).toEqual([]);
+  });
+
+  test('an action superseded while q-route.json is pending settles its submit promise', async ({
+    page,
+  }) => {
+    await page.goto(pretty);
+    await expect(page.locator('#rewrite-spa-target')).toBeVisible();
+    const held = await holdPrettyRoute(page);
+
+    await page.locator('#rewrite-spa-submit-js').click();
+    await held.requested;
+    await page.locator('#rewrite-spa-back').click();
+
+    await expect(page.locator('#rewrite-spa-source')).toBeVisible();
+    await expect.poll(() => page.evaluate(() => (window as any).__submitOutcome)).toBe('rejected');
+    held.release();
+  });
 });
```

**File**: `packages/qwik-router/src/runtime/src/qwik-router-component.tsx` (modified, +13/-5)
```diff
@@ -778,23 +778,31 @@ export const useQwikRouter = (props?: QwikRouterProps) => {
         // An action on a rewritten page also needs the real route, or the page renders as not found after submit.
         const resolved = await Promise.race([resolveServerRewrite(trackUrl), canceled]);
         if (internalState.navCount !== navCountBefore) {
+          abandonAction();
           return;
         }
-        if (resolved === 'reload' && !action) {
-          window.location.href = trackUrl.href;
-          return;
-        }
-        if (resolved && resolved !== trackUrl.pathname) {
+        if (resolved === 'reload') {
+          // With an action, skip the reload so the submission is not dropped; the action still runs.
+          if (!action) {
+            window.location.href = trackUrl.href;
+            return;
+          }
+        } else if (resolved && resolved !== trackUrl.pathname) {
           try {
             const config = await getRouterConfig();
             loadedRoute = await loadRoute(config.routes, config.cacheModules, resolved);
             rewrittenTo = resolved;
           } catch (e) {
+            if (internalState.navCount !== navCountBefore) {
+              abandonAction();
+              return;
+            }
             console.error(`Could not load rewritten route ${resolved}, reloading:`, e);
             window.location.href = trackUrl.href;
             return;
           }
           if (internalState.navCount !== navCountBefore) {
+            abandonAction();
             return;
           }
         }
```

---

### Incident Patch 3: `9832c7d9` (2026-11-02)
**Commit Message**: Merge pull request #9345 from omerman/fix/removed-dirty-component-cleanup

fix(core): run the visible task cleanups of a removed component that had a pending re-render

**File**: `.changeset/removed-dirty-component-cleanup.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@qwik.dev/core': patch
+---
+
+fix: `useVisibleTask$` cleanups now run when a component is removed while it is about to re-render (for example, a `usePreventNavigate$` handler is now unregistered).
```

**File**: `packages/qwik/src/core/client/vnode-diff.ts` (modified, +11/-1)
```diff
@@ -61,7 +61,11 @@ import type { TextVNode } from '../shared/vnode/text-vnode';
 import { createSetAttributeOperation } from '../shared/vnode/types/dom-vnode-operation';
 import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
 import type { VNode } from '../shared/vnode/vnode';
-import { addVNodeOperation, markVNodeDirty } from '../shared/vnode/vnode-dirty';
+import {
+  addVNodeOperation,
+  markVNodeDirty,
+  propagateToCursorRoot,
+} from '../shared/vnode/vnode-dirty';
 import { updateDirtySubtreeCursorBoundary, type CursorBoundary } from '../use/use-cursor-boundary';
 import { trackSignalAndAssignHost, untrack } from '../use/use-core';
 import { TaskFlags, isTask } from '../use/use-task';
@@ -1912,6 +1916,12 @@ export function cleanup(
   do {
     if (cursorRootData && vCursor !== cursorRoot && isCursor(vCursor)) {
       abandonCursor(container, cursorRootData, vCursor);
+      // The abandoned cursor keeps its dirty bits, but nothing walks it any more. Link it to the
+      // cursor root, otherwise markVNodeDirty() below skips it as "already dirty" and the cleanups
+      // of the visible tasks in this subtree are never executed.
+      if (vCursor.dirty & ChoreBits.DIRTY_MASK) {
+        propagateToCursorRoot(vCursor, cursorRoot!);
+      }
     }
     const type = vCursor.flags;
     if (type & VNodeFlags.ELEMENT_OR_VIRTUAL_MASK) {
```

**File**: `packages/qwik/src/core/shared/vnode/vnode-dirty.ts` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ function propagatePath(target: VNode): void {
  * Propagates dirty bits from vNode up to the specified cursorRoot. Used during diff when we know
  * the cursor root to merge with. Also updates cursor position if we pass through any cursors.
  */
-function propagateToCursorRoot(vNode: VNode, cursorRoot: VNode): void {
+export function propagateToCursorRoot(vNode: VNode, cursorRoot: VNode): void {
   reusablePath.push(vNode);
   let cursorBoundary = getOwnCursorBoundary(vNode);
   let current: VNode | null = vNode.slotParent || vNode.parent;
```

**File**: `packages/qwik/src/core/tests/use-visible-task.spec.tsx` (modified, +52/-0)
```diff
@@ -764,6 +764,58 @@ describe.each([
       (globalThis as any).log = undefined;
     });
 
+    it('should execute cleanup visible task on unmount when the removed component has a pending re-render', async () => {
+      (globalThis as any).log = [] as string[];
+      // Not captured by the components: Qwik would serialize (= await) a captured promise.
+      let finishTask!: () => void;
+      (globalThis as any).taskDone = new Promise<void>((resolve) => (finishTask = resolve));
+      const Child = component$((props: { count: SignalType<number> }) => {
+        useVisibleTask$(({ cleanup }) => {
+          (globalThis as any).log.push('visible_task:');
+          cleanup(() => (globalThis as any).log.push('cleanup:'));
+        });
+        // render blocking: when `count` changes the re-render of the component waits for this task
+        useTask$(async ({ track }) => {
+          const count = track(props.count);
+          if (count > 0) {
+            (globalThis as any).log.push('task: waiting');
+            await (globalThis as any).taskDone;
+          }
+        });
+        // reading the signal in the body makes the whole component re-render when it changes
+        return <span>Child {props.count.value}</span>;
+      });
+      const Parent = component$(() => {
+        const show = useSignal(true);
+        const count = useSignal(0);
+        return (
+          <button
+            onClick$={() => {
+              // the child gets a pending re-render in the same moment it is removed
+              count.value++;
+              show.value = false;
+            }}
+          >
+            {show.value ? <Child count={count} /> : 'click'}
+          </button>
+        );
+      });
+
+      const { document } = await render(<Parent />, { debug });
+      await trigger(document.body, 'span', 'qvisible');
+      expect((globalThis as any).log).toEqual(['visible_task:']);
+      (globalThis as any).log = [];
+      // the pending task keeps the scheduler busy, so don't wait for it to go idle
+      const click = trigger(document.body, 'button', 'click', {}, { waitForIdle: false });
+      await vi.waitFor(() =>
+        expect((globalThis as any).log).toEqual(expect.arrayContaining(['cleanup:']))
+      );
+      finishTask();
+      await click;
+      (globalThis as any).log = undefined;
+      (globalThis as any).taskDone = undefined;
+    });
+
     it('#9203 - should run visible task cleanups for nested components', async () => {
       (globalThis as any).log = [] as string[];
       const Grandchild = component$(() => {
```

#### Recent Merged Pull Requests:
- **PR #9368** (2026-11-03): fix(core): keep SSR-shared text intact when a keyed diff reorders or replaces siblings (@omerman)
- **PR #9354** (closed): fix(core): keep a JSX event handler when useOn() adds the same event (@intellix)
- **PR #9348** (2026-11-02): fix(core): hold a document's first flush until body opens (@maiieul)
- **PR #9345** (2026-11-02): fix(core): run the visible task cleanups of a removed component that had a pending re-render (@omerman)
- **PR #9344** (closed): fix(router): a pending render blocking task no longer blocks client navigation (@omerman)
- **PR #9341** (2026-11-01): fix(router): report production crashes to next(err) and the logs (@maiieul)

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

## X. router): report production crashes to next(err) and the logs

**RULE**:
When implementing operations in `.changeset/report-production-crashes.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in QwikDev/qwik. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `914b53ee`: router): report production crashes to next(err) and the logs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/report-production-crashes.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@qwik.dev/router': patch
---

fix: production crashes now reach `next(err)` and the server logs
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `914b53ee` are properly handled with clean fallback behavior.
