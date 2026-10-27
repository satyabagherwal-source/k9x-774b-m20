> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source**: github ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Source Version**: `fd3c66a5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T16:45:08.875Z  
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
> **Harvest Timestamp**: 2026-10-27T16:45:08.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `QwikDev/qwik`
- **Description**: Instant-loading web apps, without effort
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 22065 stars

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

### Core Architecture Module: `e2e/qwik-e2e/utils/release-gate.ts`
```
type ReleaseStore = {
  resolved: Set<string>;
  resolvers: Map<string, Set<() => void>>;
};

// Each app bundle and the dev-server resolver rendezvous on this globalThis store.
export const getReleaseStore = (): ReleaseStore =>
  ((globalThis as any).__qwikOOOSReleaseStore ||= {
    resolved: new Set<string>(),
    resolvers: new Map<string, Set<() => void>>(),
  });

export const getReleaseKey = (requestId: string, releaseId: string): string =>
  `${requestId}:${releaseId}`;

export const waitForRelease = (requestId: string, releaseId: string): Promise<void> =>
  new Promise<void>((resolve) => {
    const store = getReleaseStore();
    const key = getReleaseKey(requestId, releaseId);
    if (store.resolved.has(key)) {
      resolve();
    } else {
      let resolvers = store.resolvers.get(key);
      if (!resolvers) {
        store.resolvers.set(key, (resolvers = new Set()));
      }
      resolvers.add(resolve);
    }
  });

// Runs produce after the test's release POST, or after a short fallback delay.
export const releaseGated = <T>(
  requestId: string,
  releaseId: string | null,
  produce: () => T
): Promise<T> =>
  (releaseId
    ? waitForRelease(requestId, releaseId)
    : new Promise<void>((resolve) => setTimeout(resolve, 1000))
  ).then(produce);

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

### Incident Patch 1: `5afd1689` (2026-10-27)
**Commit Message**: revert: fix(router): treat background loaders as blocking during SSG

This reverts commit 024824521f3db8b9cd3dcb2fb4d171d15301e393 (#9303).

When the page reads a background loader during SSR, SSG already waits for it. The change only helped loaders nothing reads, which shouldn't exist, and it let background loaders change the response.

**File**: `.changeset/ssg-background-loaders.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@qwik.dev/router': patch
----
-
-fix: SSG ignored failing background loaders and skipped their data files
```

**File**: `packages/docs/src/routes/docs/(qwikrouter)/route-loader/index.mdx` (modified, +0/-2)
```diff
@@ -289,8 +289,6 @@ export const useRecommendations = routeLoader$(
 
 A background loader is treated as a **separate request**: it cannot redirect or error the page response. If it calls `redirect()` or `error()`, that control flow is captured on its own signal (surfacing when `.value` is read) and never changes the page's status or headers. Keep route guards that must redirect or set a status in a [request handler](/docs/middleware) such as `onRequest`, or in a blocking loader.
 
-SSG ignores `blockSSR: false`: the build waits for every loader, and a background loader's redirect or error applies to the static page, as it would for a blocking loader.
-
 Note: when the client fetches a background loader for SPA navigation, there is no difference between a blocking and non-blocking loader — the SPA fetch is always async, and the page is already rendered. Errors are not surfaced directly, but redirects are followed automatically.
 
 ## Accessing `RequestEvent`
```

**File**: `packages/qwik-router/src/middleware/request-handler/resolve-request-handlers-core.ts` (modified, +3/-5)
```diff
@@ -328,16 +328,14 @@ function createResolveRequestHandlers() {
       // Start every loader concurrently. `blockSSR` loaders (the default) are awaited before SSR so
       // a redirect/error short-circuits the response; the first one in route order wins. Loaders
       // with `blockSSR: false` resolve in the background and only surface when their `.value` is
-      // read, except in a static render, which treats every loader as blocking.
-      const isStatic = getRequestMode(requestEv) === 'static';
+      // read.
       let allBlockSSRLoaders: Promise<void> | undefined;
       for (let i = 0; i < routeLoaders.length; i++) {
         const loader = routeLoaders[i];
-        const blocksSSR = loader.__blockSSR || isStatic;
-        const promise = loadRouteLoader(loader, requestEv, blocksSSR);
+        const promise = loadRouteLoader(loader, requestEv);
         // Handle every rejection so a background loader can't crash the request.
         promise.catch(() => {});
-        if (blocksSSR) {
+        if (loader.__blockSSR) {
           // Chain the promises so a thrown error is handled in route order
           // Note: status changes are last-writer wins, but that's fine
           allBlockSSRLoaders = (
```

**File**: `packages/qwik-router/src/middleware/request-handler/resolve-request-handlers.unit.ts` (modified, +3/-20)
```diff
@@ -10,7 +10,7 @@ import { RequestEvHttpStatusMessage, RequestEvSharedActionId } from './request-e
 import { createRequestEvent } from './request-event-core';
 import { RedirectMessage } from './redirect-handler';
 import { isContentType } from './request-utils';
-import type { RequestEvent, ServerRequestEvent, ServerRequestMode } from './types';
+import type { RequestEvent, ServerRequestEvent } from './types';
 import { checkCSRF } from './resolve-request-handlers-core';
 import type { LoadedRoute, RouteModule } from '../../runtime/src/types';
 import { ServerError } from '@qwik.dev/router/middleware/request-handler';
@@ -573,11 +573,11 @@ describe('resolve-request-handler', () => {
       };
     }
 
-    function runPage(route: LoadedRoute, renderHandler: any, mode: ServerRequestMode = 'server') {
+    function runPage(route: LoadedRoute, renderHandler: any) {
       globalThis.__NO_TRAILING_SLASH__ = false;
       const handlers = resolveRequestHandlers(undefined, route, 'GET', true, renderHandler);
       const requestEv = createRequestEvent(
-        { ...createMockServerRequestEvent('http://localhost:3000/'), mode },
+        createMockServerRequestEvent('http://localhost:3000/'),
         route,
         handlers,
         '/',
@@ -753,23 +753,6 @@ describe('resolve-request-handler', () => {
       release();
     });
 
-    it('waits for background loaders before rendering a static page', async () => {
-      const route = pageRouteWithLoaders(
-        makeLoader('slow', () => new Promise((resolve) => setTimeout(resolve, 10, 'late')), {
-          blockSSR: false,
-        })
-      );
-      const renderHandler = vi.fn((requestEv: RequestEvent) => {
-        expect(getRouteLoaderValues(requestEv)).toEqual({ slow: 'late' });
-        requestEv.exit();
-      });
-      const requestEv = runPage(route, renderHandler, 'static');
-
-      await requestEv.next();
-
-      expect(renderHandler).toHaveBeenCalledOnce();
-    });
-
     it('errors the response when a blockSSR loader errors, before render', async () => {
       const route = pageRouteWithLoaders(
         makeLoader('l1', () => {
```

**File**: `packages/qwik-router/src/runtime/src/route-loaders.ts` (modified, +2/-6)
```diff
@@ -1055,18 +1055,14 @@ const detachResponseFromEvent = (requestEv: RequestEvent): RequestEvent => {
   }) as RequestEvent;
 };
 
-export const loadRouteLoader = (
-  loader: LoaderInternal,
-  requestEv: RequestEvent,
-  blocksSSR = loader.__blockSSR
-) => {
+export const loadRouteLoader = (loader: LoaderInternal, requestEv: RequestEvent) => {
   const loaderEv = getLoaderRequestEvent(loader, requestEv);
   return loadRouteLoaderByQrl(
     loader.__id,
     loader.__qrl,
     loader.__validators,
     // A background (blockSSR:false) loader must not touch the page response.
-    blocksSSR ? loaderEv : detachResponseFromEvent(loaderEv)
+    loader.__blockSSR ? loaderEv : detachResponseFromEvent(loaderEv)
   );
 };
 
```

**File**: `packages/qwik-router/src/runtime/src/types.ts` (modified, +0/-2)
```diff
@@ -883,8 +883,6 @@ export type LoaderOptions = {
    * immediately and reading its `.value` suspends until it resolves. A background loader cannot
    * redirect or error the initial SSR response; treat it as a separate request.
    *
-   * SSG ignores `false` and waits for every loader.
-   *
    * Setting `false` is experimental and requires adding `experimental: ["blockSSR"]` to your
    * qwikVite plugin options.
    */
```

**File**: `packages/qwik-router/src/ssg/worker-thread.unit.ts` (modified, +2/-57)
```diff
@@ -5,7 +5,6 @@ import {
   resolveRequestHandlers,
 } from '../middleware/request-handler/resolve-request-handlers-core';
 import { trimInternalPathname } from '../middleware/request-handler/request-path';
-import type { RequestEventLoader } from '../middleware/request-handler/types';
 import { runQwikRouter } from '../middleware/request-handler/user-response';
 import { loadRoute } from '../runtime/src/routing';
 import type { SsgHandlerOptions, SsgWorkerRenderResult, System } from './types';
@@ -62,13 +61,13 @@ const createRender = ({ earlyCatch = false, lateCatch = false } = {}) =>
     };
   });
 
-function renderRoute(sys: System, render: any, routeModule: object = { default: () => null }) {
+function renderRoute(sys: System, render: any) {
   const opts: SsgHandlerOptions = {
     outDir: '/out',
     origin: 'https://example.com',
     render,
     qwikRouterConfig: {
-      routes: { _I: async () => routeModule },
+      routes: { _I: async () => ({ default: () => null }) },
       serverPlugins: undefined,
       cacheModules: false,
       basePathname: '/',
@@ -117,57 +116,3 @@ describe('SSG worker error boundary handling', () => {
     expect(result.filePath).toBeNull();
   });
 });
-
-describe('SSG worker background loaders', () => {
-  function createBackgroundLoader(id: string, load: (ev: RequestEventLoader) => unknown) {
-    const loader: any = () => {};
-    loader.__brand = 'server_loader';
-    loader.__id = id;
-    loader.__qrl = { call: (_: unknown, ev: RequestEventLoader) => load(ev), getHash: () => id };
-    loader.__validators = undefined;
-    loader.__serializationStrategy = 'never';
-    loader.__cacheControl = 'immutable';
-    loader.__search = undefined;
-    loader.__blockSSR = false;
-    return loader;
-  }
-
-  afterEach(() => {
-    vi.restoreAllMocks();
-  });
-
-  it('fails the route when a background loader fails', async () => {
-    vi.spyOn(console, 'error').mockImplementation(() => {});
-    const { sys } = createSystem();
-    const useFailing = createBackgroundLoader('failing', () => {
-      throw new Error('background loader failed');
-    });
-    const result = await renderRoute(sys, createRender(), { default: () => null, useFailing });
-
-    expect(result.ok).toBe(false);
-    expect(result.error?.message).toBe('background loader failed');
-  });
-
-  it('does not write the page when a background loader redirects', async () => {
-    const { sys, written } = createSystem();
-    const useRedirect = createBackgroundLoader('redirect', (ev) => {
-      throw ev.redirect(302, '/login/');
-    });
-    const result = await renderRoute(sys, createRender(), { default: () => null, useRedirect });
-
-    expect(result.ok).toBe(false);
-    expect(written.size).toBe(0);
-  });
-
-  it("writes a slow background loader's data file", async () => {
-    const { sys, written } = createSystem();
-    const useSlow = createBackgroundLoader(
-      'slow',
-      () => new Promise((resolve) => setTimeout(resolve, 50, 'late'))
-    );
-    const result = await renderRoute(sys, createRender(), { default: () => null, useSlow });
-
-    expect(result.ok).toBe(true);
-    expect([...written.keys()]).toContain('/out/q-data-slow.json');
-  });
-});
```

---

### Incident Patch 2: `0bf04a72` (2026-10-26)
**Commit Message**: fix(router): treat background loaders as blocking during SSG

SSG closed a route before its background loaders settled, so a failing
one shipped as a working page and a slow one never wrote its data file.
A static file gains nothing from out-of-order streaming, so a static
render now awaits every loader and gives it the real response.

**File**: `.changeset/ssg-background-loaders.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@qwik.dev/router': patch
+---
+
+fix: SSG ignored failing background loaders and skipped their data files
```

**File**: `packages/docs/src/routes/docs/(qwikrouter)/route-loader/index.mdx` (modified, +2/-0)
```diff
@@ -289,6 +289,8 @@ export const useRecommendations = routeLoader$(
 
 A background loader is treated as a **separate request**: it cannot redirect or error the page response. If it calls `redirect()` or `error()`, that control flow is captured on its own signal (surfacing when `.value` is read) and never changes the page's status or headers. Keep route guards that must redirect or set a status in a [request handler](/docs/middleware) such as `onRequest`, or in a blocking loader.
 
+SSG ignores `blockSSR: false`: the build waits for every loader, and a background loader's redirect or error applies to the static page, as it would for a blocking loader.
+
 Note: when the client fetches a background loader for SPA navigation, there is no difference between a blocking and non-blocking loader — the SPA fetch is always async, and the page is already rendered. Errors are not surfaced directly, but redirects are followed automatically.
 
 ## Accessing `RequestEvent`
```

**File**: `packages/qwik-router/src/middleware/request-handler/resolve-request-handlers-core.ts` (modified, +5/-3)
```diff
@@ -328,14 +328,16 @@ function createResolveRequestHandlers() {
       // Start every loader concurrently. `blockSSR` loaders (the default) are awaited before SSR so
       // a redirect/error short-circuits the response; the first one in route order wins. Loaders
       // with `blockSSR: false` resolve in the background and only surface when their `.value` is
-      // read.
+      // read, except in a static render, which treats every loader as blocking.
+      const isStatic = getRequestMode(requestEv) === 'static';
       let allBlockSSRLoaders: Promise<void> | undefined;
       for (let i = 0; i < routeLoaders.length; i++) {
         const loader = routeLoaders[i];
-        const promise = loadRouteLoader(loader, requestEv);
+        const blocksSSR = loader.__blockSSR || isStatic;
+        const promise = loadRouteLoader(loader, requestEv, blocksSSR);
         // Handle every rejection so a background loader can't crash the request.
         promise.catch(() => {});
-        if (loader.__blockSSR) {
+        if (blocksSSR) {
           // Chain the promises so a thrown error is handled in route order
           // Note: status changes are last-writer wins, but that's fine
           allBlockSSRLoaders = (
```

**File**: `packages/qwik-router/src/middleware/request-handler/resolve-request-handlers.unit.ts` (modified, +20/-3)
```diff
@@ -10,7 +10,7 @@ import { RequestEvHttpStatusMessage, RequestEvSharedActionId } from './request-e
 import { createRequestEvent } from './request-event-core';
 import { RedirectMessage } from './redirect-handler';
 import { isContentType } from './request-utils';
-import type { RequestEvent, ServerRequestEvent } from './types';
+import type { RequestEvent, ServerRequestEvent, ServerRequestMode } from './types';
 import { checkCSRF } from './resolve-request-handlers-core';
 import type { LoadedRoute, RouteModule } from '../../runtime/src/types';
 import { ServerError } from '@qwik.dev/router/middleware/request-handler';
@@ -573,11 +573,11 @@ describe('resolve-request-handler', () => {
       };
     }
 
-    function runPage(route: LoadedRoute, renderHandler: any) {
+    function runPage(route: LoadedRoute, renderHandler: any, mode: ServerRequestMode = 'server') {
       globalThis.__NO_TRAILING_SLASH__ = false;
       const handlers = resolveRequestHandlers(undefined, route, 'GET', true, renderHandler);
       const requestEv = createRequestEvent(
-        createMockServerRequestEvent('http://localhost:3000/'),
+        { ...createMockServerRequestEvent('http://localhost:3000/'), mode },
         route,
         handlers,
         '/',
@@ -753,6 +753,23 @@ describe('resolve-request-handler', () => {
       release();
     });
 
+    it('waits for background loaders before rendering a static page', async () => {
+      const route = pageRouteWithLoaders(
+        makeLoader('slow', () => new Promise((resolve) => setTimeout(resolve, 10, 'late')), {
+          blockSSR: false,
+        })
+      );
+      const renderHandler = vi.fn((requestEv: RequestEvent) => {
+        expect(getRouteLoaderValues(requestEv)).toEqual({ slow: 'late' });
+        requestEv.exit();
+      });
+      const requestEv = runPage(route, renderHandler, 'static');
+
+      await requestEv.next();
+
+      expect(renderHandler).toHaveBeenCalledOnce();
+    });
+
     it('errors the response when a blockSSR loader errors, before render', async () => {
       const route = pageRouteWithLoaders(
         makeLoader('l1', () => {
```

**File**: `packages/qwik-router/src/runtime/src/route-loaders.ts` (modified, +6/-2)
```diff
@@ -1055,14 +1055,18 @@ const detachResponseFromEvent = (requestEv: RequestEvent): RequestEvent => {
   }) as RequestEvent;
 };
 
-export const loadRouteLoader = (loader: LoaderInternal, requestEv: RequestEvent) => {
+export const loadRouteLoader = (
+  loader: LoaderInternal,
+  requestEv: RequestEvent,
+  blocksSSR = loader.__blockSSR
+) => {
   const loaderEv = getLoaderRequestEvent(loader, requestEv);
   return loadRouteLoaderByQrl(
     loader.__id,
     loader.__qrl,
     loader.__validators,
     // A background (blockSSR:false) loader must not touch the page response.
-    loader.__blockSSR ? loaderEv : detachResponseFromEvent(loaderEv)
+    blocksSSR ? loaderEv : detachResponseFromEvent(loaderEv)
   );
 };
 
```

**File**: `packages/qwik-router/src/runtime/src/types.ts` (modified, +2/-0)
```diff
@@ -883,6 +883,8 @@ export type LoaderOptions = {
    * immediately and reading its `.value` suspends until it resolves. A background loader cannot
    * redirect or error the initial SSR response; treat it as a separate request.
    *
+   * SSG ignores `false` and waits for every loader.
+   *
    * Setting `false` is experimental and requires adding `experimental: ["blockSSR"]` to your
    * qwikVite plugin options.
    */
```

**File**: `packages/qwik-router/src/ssg/worker-thread.unit.ts` (modified, +57/-2)
```diff
@@ -5,6 +5,7 @@ import {
   resolveRequestHandlers,
 } from '../middleware/request-handler/resolve-request-handlers-core';
 import { trimInternalPathname } from '../middleware/request-handler/request-path';
+import type { RequestEventLoader } from '../middleware/request-handler/types';
 import { runQwikRouter } from '../middleware/request-handler/user-response';
 import { loadRoute } from '../runtime/src/routing';
 import type { SsgHandlerOptions, SsgWorkerRenderResult, System } from './types';
@@ -61,13 +62,13 @@ const createRender = ({ earlyCatch = false, lateCatch = false } = {}) =>
     };
   });
 
-function renderRoute(sys: System, render: any) {
+function renderRoute(sys: System, render: any, routeModule: object = { default: () => null }) {
   const opts: SsgHandlerOptions = {
     outDir: '/out',
     origin: 'https://example.com',
     render,
     qwikRouterConfig: {
-      routes: { _I: async () => ({ default: () => null }) },
+      routes: { _I: async () => routeModule },
       serverPlugins: undefined,
       cacheModules: false,
       basePathname: '/',
@@ -116,3 +117,57 @@ describe('SSG worker error boundary handling', () => {
     expect(result.filePath).toBeNull();
   });
 });
+
+describe('SSG worker background loaders', () => {
+  function createBackgroundLoader(id: string, load: (ev: RequestEventLoader) => unknown) {
+    const loader: any = () => {};
+    loader.__brand = 'server_loader';
+    loader.__id = id;
+    loader.__qrl = { call: (_: unknown, ev: RequestEventLoader) => load(ev), getHash: () => id };
+    loader.__validators = undefined;
+    loader.__serializationStrategy = 'never';
+    loader.__cacheControl = 'immutable';
+    loader.__search = undefined;
+    loader.__blockSSR = false;
+    return loader;
+  }
+
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it('fails the route when a background loader fails', async () => {
+    vi.spyOn(console, 'error').mockImplementation(() => {});
+    const { sys } = createSystem();
+    const useFailing = createBackgroundLoader('failing', () => {
+      throw new Error('background loader failed');
+    });
+    const result = await renderRoute(sys, createRender(), { default: () => null, useFailing });
+
+    expect(result.ok).toBe(false);
+    expect(result.error?.message).toBe('background loader failed');
+  });
+
+  it('does not write the page when a background loader redirects', async () => {
+    const { sys, written } = createSystem();
+    const useRedirect = createBackgroundLoader('redirect', (ev) => {
+      throw ev.redirect(302, '/login/');
+    });
+    const result = await renderRoute(sys, createRender(), { default: () => null, useRedirect });
+
+    expect(result.ok).toBe(false);
+    expect(written.size).toBe(0);
+  });
+
+  it("writes a slow background loader's data file", async () => {
+    const { sys, written } = createSystem();
+    const useSlow = createBackgroundLoader(
+      'slow',
+      () => new Promise((resolve) => setTimeout(resolve, 50, 'late'))
+    );
+    const result = await renderRoute(sys, createRender(), { default: () => null, useSlow });
+
+    expect(result.ok).toBe(true);
+    expect([...written.keys()]).toContain('/out/q-data-slow.json');
+  });
+});
```

---

### Incident Patch 3: `a1f47aef` (2026-10-25)
**Commit Message**: chore(deps): update dependencies with security advisories

Bump overrides and direct deps to patched releases flagged by pnpm audit.
image-size 2.0.4 ships the fix the local patch backported, so the patch is dropped.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012PTys5dJYaEqvijZKoGTDg

**File**: `.changeset/secure-image-size-bump.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@qwik.dev/core': patch
+---
+
+fix: bundle image-size 2.0.4 to address its denial-of-service advisories
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@
     "vite-imagetools": "10.0.0",
     "vite-plugin-dts": "5.0.3",
     "vite-tsconfig-paths": "6.1.1",
-    "vitest": "5.0.0",
+    "vitest": "5.0.5",
     "watchlist": "0.3.1",
     "which-pm-runs": "1.1.0",
     "zod": "3.25.48"
```

**File**: `packages/browser-extension/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "@emnapi/runtime": "1.11.3",
     "@types/chrome": "0.1.38",
     "typescript": "5.9.3",
-    "vitest": "5.0.0"
+    "vitest": "5.0.5"
   },
   "private": true,
   "scripts": {
```

**File**: `packages/devtools/package.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
     "typescript": "5.9.3",
     "vite": "8.2.4",
     "vite-tsconfig-paths": "6.1.1",
-    "vitest": "5.0.0"
+    "vitest": "5.0.5"
   },
   "exports": {
     ".": {
```

**File**: `packages/insights/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     "typescript-eslint": "8.56.1",
     "vite": "8.2.4",
     "vite-tsconfig-paths": "6.1.1",
-    "vitest": "5.0.0",
+    "vitest": "5.0.5",
     "zod": "3.25.48"
   },
   "engines": {
```

**File**: `packages/mcp/package.json` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
     "esbuild": "0.28.2",
     "typescript": "5.9.3",
     "vite": "8.2.4",
-    "vitest": "5.0.0"
+    "vitest": "5.0.5"
   },
   "peerDependencies": {
     "@qwik.dev/core": "workspace:*",
```

**File**: `packages/qwik-vite/package.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "devDependencies": {
     "@qwik.dev/optimizer": "workspace:*",
     "@qwik.dev/ts-optimizer": "workspace:*",
-    "image-size": "2.0.2",
+    "image-size": "2.0.4",
     "magic-string": "0.30.21",
     "rolldown": "1.2.4",
     "vite": "8.2.4"
```

**File**: `packages/qwik/package.json` (modified, +2/-2)
```diff
@@ -27,11 +27,11 @@
     "@qwik.dev/dom": "workspace:*",
     "domino": "2.1.6",
     "ignore": "5.3.1",
-    "image-size": "2.0.2",
+    "image-size": "2.0.4",
     "kleur": "4.1.5",
     "prettier": "3.7.4",
     "rolldown": "1.2.4",
-    "vitest": "5.0.0"
+    "vitest": "5.0.5"
   },
   "engines": {
     "node": "^20.3.0 || >=21.0.0"
```

#### Recent Merged Pull Requests:
- **PR #9311** (2026-10-27): revert: fix(router): treat background loaders as blocking during SSG (@maiieul)
- **PR #9304** (2026-10-26): fix(router): key route bundle graph entries with a trailing slash (@Varixo)
- **PR #9303** (2026-10-26): fix(router): treat background loaders as blocking during SSG (@maiieul)
- **PR #9302** (2026-10-26): fix(core): serialize source-free wrapped signals as their value (@intellix)
- **PR #9297** (2026-10-25): chore(deps): update dependencies with security advisories (v1) (@wmertens)
- **PR #9296** (2026-10-25): chore(deps): update dependencies with security advisories (@wmertens)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
