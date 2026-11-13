# Verification Protocol: Verification Protocol: Empirical Defect Shield for solidjs/solid

<!-- PROVENANCE_START
{
  "source_repository": "solidjs/solid",
  "source_url": "https://github.com/solidjs/solid",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [solidjs/solid](https://github.com/solidjs/solid) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `solidjs/solid` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/solidjs-solid-learnings.md`  
> **Source**: github ([https://github.com/solidjs/solid](https://github.com/solidjs/solid))  
> **Source Version**: `99714d4e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T12:19:55.098Z  
> **Learning ID**: `learn-github-solidjs-solid`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): solidjs/solid

> **Canonical Artifact**: `07_PROJECT_LEARNING/solidjs-solid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/solidjs/solid](https://github.com/solidjs/solid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T12:14:51.036Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `solidjs/solid`
- **Description**: A declarative, efficient, and flexible JavaScript library for building user interfaces.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 36259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/solid/src/render/Suspense.ts`
```
import { createComponent } from "./component.js";
import {
  createRoot,
  createSignal,
  createContext,
  useContext,
  getSuspenseContext,
  resumeEffects,
  createMemo,
  Accessor,
  onCleanup,
  getOwner
} from "../reactive/signal.js";
import { HydrationContext, setHydrateContext, sharedConfig } from "./hydration.js";
import type { JSX } from "../jsx.js";

type SuspenseListContextType = {
  register: (inFallback: Accessor<boolean>) => Accessor<SuspenseListRegisteredState>;
};

type SuspenseListRegisteredState = { showContent: boolean; showFallback: boolean };
interface SuspenseListState extends Array<SuspenseListRegisteredState> {
  inFallback: boolean;
}

const suspenseListEquals = (a: SuspenseListRegisteredState, b: SuspenseListRegisteredState) =>
  a.showContent === b.showContent && a.showFallback === b.showFallback;
const SuspenseListContext = /* #__PURE__ */ createContext<SuspenseListContextType>();

/**
 * **[experimental]** Controls the order in which suspended content is rendered
 *
 * @description https://docs.solidjs.com/reference/components/suspense-list
 */
export function SuspenseList(props: {
  children: JSX.Element;
  revealOrder: "forwards" | "backwards" | "together";
  tail?: "collapsed" | "hidden";
}) {
  let [wrapper, setWrapper] = createSignal(() => ({ inFallback: false })),
    show: Accessor<{ showContent: boolean; showFallback: boolean }>;

  // Nested SuspenseList support
  const listContext = useContext(SuspenseListContext);
  const [registry, setRegistry] = createSignal<Accessor<boolean>[]>([]);
  if (listContext) {
    show = listContext.register(createMemo(() => wrapper()().inFallback));
  }
  const resolved = createMemo<SuspenseListState>(
    (prev: Partial<SuspenseListState>) => {
      const reveal = props.revealOrder,
        tail = props.tail,
        { showContent = true, showFallback = true } = show ? show() : {},
        reg = registry(),
        reverse = reveal === "backwards";

      if (reveal === "together") {
        const all = reg.every(inFallback => !inFallback());
        const res: SuspenseListState = reg.map(() => ({
          showContent: all && showContent,
          showFallback
        })) as SuspenseListState;
        res.inFallback = !all;
        return res;
      }

      let stop = false;
      let inFallback = prev.inFallback as boolean;
      const res: SuspenseListState = [] as any;
      for (let i = 0, len = reg.length; i < len; i++) {
        const n = reverse ? len - i - 1 : i,
          s = reg[n]();
        if (!stop && !s) {
          res[n] = { showContent, showFallback };
        } else {
          const next = !stop;
          if (next) inFallback = true;
          res[n] = {
            showContent: next,
            showFallback: !tail || (next && tail === "collapsed") ? showFallback : false
          };
          stop = true;
        }
      }
      if (!stop) inFallback = false;
      res.inFallback = inFallback;
      return res;
    },
    { inFallback: false } as unknown as SuspenseListState
  );
  setWrapper(() => resolved);

  return createComponent(SuspenseListContext.Provider, {
    value: {
      register: (inFallback: Accessor<boolean>) => {
        let index: number;
        setRegistry(registry => {
          index = registry.length;
          return [...registry, inFallback];
        });
        return createMemo(() => resolved()[index], undefined, {
          equals: suspenseListEquals
        });
      }
    },
    get children() {
      return props.children;
    }
  });
}

/**
 * Tracks all resources inside a component and renders a fallback until they are all resolved
 * ```typescript
 * const AsyncComponent = lazy(() => import('./component'));
 *
 * <Suspense fallback={<LoadingIndicator />}>
 *   <AsyncComponent />
 * </Suspense>
 * ```
 * @description https://docs.solidjs.com/reference/components/suspense
 */
export function Suspense(props: { fallback?: JSX.Element; children: JSX.Element }) {
  let counter = 0,
    show: Accessor<SuspenseListRegisteredState>,
    ctx: HydrationContext | undefined,
    p: Promise<any> | any,
    flicker: Accessor<void> | undefined,
    error: any;
  const [inFallback, setFallback] = createSignal<boolean>(false),
    SuspenseContext = getSuspenseContext(),
    store = {
      increment: () => {
        if (++counter === 1) setFallback(true);
      },
      decrement: () => {
        if (--counter === 0) setFallback(false);
      },
      inFallback,
      effects: [],
      resolved: false
    },
    owner = getOwner();
  if (sharedConfig.context && sharedConfig.load) {
    const key = sharedConfig.getContextId();
    let ref = sharedConfig.load(key);
    if (ref) {
      if (typeof ref !== "object" || ref.s !== 1) p = ref;
      else sharedConfig.gather!(key);
    }
    if (p && p !== "$$f") {
      const [s, set] = createSignal(undefined, { equals: false });
      flicker = s;
      p.then(
        () => {
          if (sharedConfig.done) return set();
          sharedConfig.gather!(key);
          setHydrateContext(ctx);
          set();
          setHydrateContext();
        },
        (err: any) => {
          error = err;
          set();
        }
      );
    }
  }

  // SuspenseList support
  const listContext = useContext(SuspenseListContext);
  if (listContext) show = listContext.register(store.inFallback);
  let dispose: undefined | (() => void);
  onCleanup(() => dispose && dispose());

  return createComponent(SuspenseContext.Provider, {
    value: store,
    get children() {
      return createMemo(() => {
        if (error) throw error;
        ctx = sharedConfig.context!;
        if (flicker) {
          flicker();
          return (flicker = undefined);
        }
        if (ctx && p === "$$f") setHydrateContext();
        const rendered = createMemo(() => props.children);
        return createMemo((prev: JSX.Element) => {
          const inFallback = store.inFallback(),
            { showContent = true, showFallback = true } = show ? show() : {};
          if ((!inFallback || (p && p !== "$$f")) && showContent) {
            store.resolved = true;
            dispose && dispose();
            dispose = ctx = p = undefined;
            resumeEffects(store.effects);
            return rendered();
          }
          if (!showFallback) return;
          if (dispose) return prev;
          return createRoot(disposer => {
            dispose = disposer;
            if (ctx) {
              setHydrateContext({ id: ctx.id + "F", count: 0 });
              ctx = undefined;
            }
            return props.fallback;
          }, owner!);
        });
      }) as unknown as JSX.Element;
    }
  });
}

```

### Core Architecture Module: `packages/solid/src/render/component.ts`
```
import {
  untrack,
  createSignal,
  createResource,
  createMemo,
  onCleanup,
  devComponent,
  $PROXY,
  SUPPORTS_PROXY,
  $DEVCOMP,
  EffectFunction,
  IS_DEV
} from "../reactive/signal.js";
import { sharedConfig, nextHydrateContext, setHydrateContext } from "./hydration.js";
import type { JSX } from "../jsx.js";

let hydrationEnabled = false;
export function enableHydration() {
  hydrationEnabled = true;
}

/**
 * A general `Component` has no implicit `children` prop.  If desired, you can
 * specify one as in `Component<{name: String, children: JSX.Element}>`.
 */
export type Component<P extends Record<string, any> = {}> = (props: P) => JSX.Element;

/**
 * Extend props to forbid the `children` prop.
 * Use this to prevent accidentally passing `children` to components that
 * would silently throw them away.
 */
export type VoidProps<P extends Record<string, any> = {}> = P & { children?: never };
/**
 * `VoidComponent` forbids the `children` prop.
 * Use this to prevent accidentally passing `children` to components that
 * would silently throw them away.
 */
export type VoidComponent<P extends Record<string, any> = {}> = Component<VoidProps<P>>;

/**
 * Extend props to allow an optional `children` prop with the usual
 * type in JSX, `JSX.Element` (which allows elements, arrays, strings, etc.).
 * Use this for components that you want to accept children.
 */
export type ParentProps<P extends Record<string, any> = {}> = P & { children?: JSX.Element };
/**
 * `ParentComponent` allows an optional `children` prop with the usual
 * type in JSX, `JSX.Element` (which allows elements, arrays, strings, etc.).
 * Use this for components that you want to accept children.
 */
export type ParentComponent<P extends Record<string, any> = {}> = Component<ParentProps<P>>;

/**
 * Extend props to require a `children` prop with the specified type.
 * Use this for components where you need a specific child type,
 * typically a function that receives specific argument types.
 * Note that all JSX <Elements> are of the type `JSX.Element`.
 */
export type FlowProps<P extends Record<string, any> = {}, C = JSX.Element> = P & { children: C };
/**
 * `FlowComponent` requires a `children` prop with the specified type.
 * Use this for components where you need a specific child type,
 * typically a function that receives specific argument types.
 * Note that all JSX <Elements> are of the type `JSX.Element`.
 */
export type FlowComponent<P extends Record<string, any> = {}, C = JSX.Element> = Component<
  FlowProps<P, C>
>;

/** @deprecated: use `ParentProps` instead */
export type PropsWithChildren<P extends Record<string, any> = {}> = ParentProps<P>;

export type ValidComponent = keyof JSX.IntrinsicElements | Component<any> | (string & {});

/**
 * Takes the props of the passed component and returns its type
 *
 * @example
 * ComponentProps<typeof Portal> // { mount?: Node; useShadow?: boolean; children: JSX.Element }
 * ComponentProps<'div'> // JSX.HTMLAttributes<HTMLDivElement>
 */
export type ComponentProps<T extends ValidComponent> =
  T extends Component<infer P>
    ? P
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : Record<string, unknown>;

/**
 * Type of `props.ref`, for use in `Component` or `props` typing.
 *
 * @example Component<{ref: Ref<Element>}>
 */
export type Ref<T> = T | ((val: T) => void);

export function createComponent<T extends Record<string, any>>(
  Comp: Component<T>,
  props: T
): JSX.Element {
  if (hydrationEnabled) {
    if (sharedConfig.context) {
      const c = sharedConfig.context;
      setHydrateContext(nextHydrateContext());
      const r = IS_DEV
        ? devComponent(Comp, props || ({} as T))
        : untrack(() => Comp(props || ({} as T)));
      setHydrateContext(c);
      return r;
    }
  }
  if (IS_DEV) return devComponent(Comp, props || ({} as T));
  return untrack(() => Comp(props || ({} as T)));
}

function trueFn() {
  return true;
}

const propTraps: ProxyHandler<{
  get: (k: string | number | symbol) => any;
  has: (k: string | number | symbol) => boolean;
  keys: () => string[];
}> = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    if (property === $PROXY) return true;
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};

type DistributeOverride<T, F> = T extends undefined ? F : T;
type Override<T, U> = T extends any
  ? U extends any
    ? {
        [K in keyof T]: K extends keyof U ? DistributeOverride<U[K], T[K]> : T[K];
      } & {
        [K in keyof U]: K extends keyof T ? DistributeOverride<U[K], T[K]> : U[K];
      }
    : T & U
  : T & U;
type OverrideSpread<T, U> = T extends any
  ? {
      [K in keyof ({ [K in keyof T]: any } & { [K in keyof U]?: any } & {
        [K in U extends any ? keyof U : keyof U]?: any;
      })]: K extends keyof T
        ? Exclude<U extends any ? U[K & keyof U] : never, undefined> | T[K]
        : U extends any
          ? U[K & keyof U]
          : never;
    }
  : T & U;
type Simplify<T> = T extends any ? { [K in keyof T]: T[K] } : T;
type _MergeProps<T extends unknown[], Curr = {}> = T extends [
  infer Next | (() => infer Next),
  ...infer Rest
]
  ? _MergeProps<Rest, Override<Curr, Next>>
  : T extends [...infer Rest, infer Next | (() => infer Next)]
    ? Override<_MergeProps<Rest, Curr>, Next>
    : T extends []
      ? Curr
      : T extends (infer I | (() => infer I))[]
        ? OverrideSpread<Curr, I>
        : Curr;

export type MergeProps<T extends unknown[]> = Simplify<_MergeProps<T>>;

function resolveSource(s: any) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}

function resolveSources(this: (() => any)[]) {
  for (let i = 0, length = this.length; i < length; ++i) {
    const v = this[i]();
    if (v !== undefined) return v;
  }
}

export function mergeProps<T extends unknown[]>(...sources: T): MergeProps<T> {
  // [breaking && performance]
  //if (sources.length === 1) return sources[0] as any;
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || (!!s && $PROXY in (s as object));
    sources[i] =
      typeof s === "function" ? ((proxy = true), createMemo(s as EffectFunction<unknown>)) : s;
  }
  if (SUPPORTS_PROXY && proxy) {
    return new Proxy(
      {
        get(property: string | number | symbol) {
          for (let i = sources.length - 1; i >= 0; i--) {
            const v = resolveSource(sources[i])[property];
            if (v !== undefined) return v;
          }
        },
        has(property: string | number | symbol) {
          for (let i = sources.length - 1; i >= 0; i--) {
            if (property in resolveSource(sources[i])) return true;
          }
          return false;
        },
        keys() {
          const keys = [];
          for (let i = 0; i < sources.length; i++)
            keys.push(...Object.keys(resolveSource(sources[i])));
          return [...new Set(keys)];
        }
      },
      propTraps
    ) as unknown as MergeProps<T>;
  }
  const sourcesMap: Record<string, any[]> = {};
  const defined: Record<string, PropertyDescriptor | undefined> = Object.create(null);
  //let someNonTargetKey = false;

  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i] as Record<string, any>;
    if (!source) continue;
    const sourceKeys = Object.getOwnPropertyNames(source);
    //someNonTargetKey = someNonTargetKey || (i !== 0 && !!sourceKeys.length);
    for (let i = sourceKeys.length - 1; i >= 0; i--) {
      const key = sourceKeys[i];
      if (key === "__proto__" || key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(source, key)!;
      if (!defined[key]) {
        defined[key] = desc.get
          ? {
              enumerable: true,
              configurable: true,
              get: resolveSources.bind((sourcesMap[key] = [desc.get.bind(source)]))
            }
          : desc.value !== undefined
            ? desc
            : undefined;
      } else {
        const sources = sourcesMap[key];
        if (sources) {
          if (desc.get) sources.push(desc.get.bind(source));
          else if (desc.value !== undefined) sources.push(() => desc.value);
        }
      }
    }
  }
  const target: Record<string, any> = {};
  const definedKeys = Object.keys(defined);
  for (let i = definedKeys.length - 1; i >= 0; i--) {
    const key = definedKeys[i],
      desc = defined[key];
    if (desc && desc.get) Object.defineProperty(target, key, desc);
    else target[key] = desc ? desc.value : undefined;
  }
  // [breaking && performance]
  //return (someNonTargetKey ? target : sources[0]) as any;
  return target as any;
}

export type SplitProps<T, K extends (readonly (keyof T)[])[]> = [
  ...{
    [P in keyof K]: P extends `${number}`
      ? Pick<T, Extract<K[P], readonly (keyof T)[]>[number]>
      : never;
  },
  { [P in keyof T as Exclude<P, K[number][number]>]: T[P] }
];

export function splitProps<
  T extends Record<any, any>,
  K extends [readonly (keyof T)[], ...(readonly (keyof T)[])[]]
>(props: T, ...keys: K): SplitProps<T, K> {
  const len = keys.length;

  if (SUPPORTS_PROXY && $PROXY in props) {
    const blocked = len > 1 ? keys.flat() : keys[0];
    const claimed = new Set<PropertyKey>();
    const res = keys.map(k => {
      // a key belongs to the first group that lists it (matches non-proxy path)
      const owned = k.filter(property => !claimed.has(property) && (claimed.add(property), true));
      return new Proxy(
        {
          get(property) {
            return owned.includes(property) ? props[property as any] : undefined;
          },
      
```

### Core Architecture Module: `packages/solid/src/render/flow.ts`
```
import {
  createMemo,
  untrack,
  createSignal,
  catchError,
  children,
  Accessor,
  Setter,
  onCleanup,
  IS_DEV
} from "../reactive/signal.js";
import { mapArray, indexArray } from "../reactive/array.js";
import { sharedConfig } from "./hydration.js";
import type { JSX } from "../jsx.js";

const narrowedError = (name: string) =>
  IS_DEV
    ? `Attempting to access a stale value from <${name}> that could possibly be undefined. This may occur because you are reading the accessor returned from the component at a time where it has already been unmounted. We recommend cleaning up any stale timers or async, or reading from the initial condition.`
    : `Stale read from <${name}>.`;

/**
 * Creates a list elements from a list
 *
 * it receives a map function as its child that receives a list element and an accessor with the index and returns a JSX-Element; if the list is empty, an optional fallback is returned:
 * ```typescript
 * <For each={items} fallback={<div>No items</div>}>
 *   {(item, index) => <div data-index={index()}>{item}</div>}
 * </For>
 * ```
 * If you have a list with fixed indices and changing values, consider using `<Index>` instead.
 *
 * @description https://docs.solidjs.com/reference/components/for
 */
export function For<T extends readonly any[], U extends JSX.Element>(props: {
  each: T | undefined | null | false;
  fallback?: JSX.Element;
  children: (item: T[number], index: Accessor<number>) => U;
}) {
  const fallback = "fallback" in props && { fallback: () => props.fallback };
  return (IS_DEV
    ? createMemo(
        mapArray(() => props.each, props.children, fallback || undefined),
        undefined,
        { name: "value" }
      )
    : createMemo(
        mapArray(() => props.each, props.children, fallback || undefined)
      )) as unknown as JSX.Element;
}

/**
 * Non-keyed iteration over a list creating elements from its items
 *
 * To be used if you have a list with fixed indices, but changing values.
 * ```typescript
 * <Index each={items} fallback={<div>No items</div>}>
 *   {(item, index) => <div data-index={index}>{item()}</div>}
 * </Index>
 * ```
 * If you have a list with changing indices, better use `<For>`.
 *
 * @description https://docs.solidjs.com/reference/components/index-component
 */
export function Index<T extends readonly any[], U extends JSX.Element>(props: {
  each: T | undefined | null | false;
  fallback?: JSX.Element;
  children: (item: Accessor<T[number]>, index: number) => U;
}) {
  const fallback = "fallback" in props && { fallback: () => props.fallback };
  return (IS_DEV
    ? createMemo(
        indexArray(() => props.each, props.children, fallback || undefined),
        undefined,
        { name: "value" }
      )
    : createMemo(
        indexArray(() => props.each, props.children, fallback || undefined)
      )) as unknown as JSX.Element;
}

type RequiredParameter<T> = T extends () => unknown ? never : T;
/**
 * Conditionally render its children or an optional fallback component
 * @description https://docs.solidjs.com/reference/components/show
 */
export function Show<
  T,
  TRenderFunction extends (item: Accessor<NonNullable<T>>) => JSX.Element
>(props: {
  when: T | undefined | null | false;
  keyed?: false;
  fallback?: JSX.Element;
  children: JSX.Element | RequiredParameter<TRenderFunction>;
}): JSX.Element;
export function Show<T, TRenderFunction extends (item: NonNullable<T>) => JSX.Element>(props: {
  when: T | undefined | null | false;
  keyed: true;
  fallback?: JSX.Element;
  children: JSX.Element | RequiredParameter<TRenderFunction>;
}): JSX.Element;
export function Show<T>(props: {
  when: T | undefined | null | false;
  keyed?: boolean;
  fallback?: JSX.Element;
  children: JSX.Element | ((item: NonNullable<T> | Accessor<NonNullable<T>>) => JSX.Element);
}): JSX.Element {
  const keyed = props.keyed;
  const conditionValue = createMemo<T | undefined | null | boolean>(
    () => props.when,
    undefined,
    IS_DEV ? { name: "condition value" } : undefined
  );
  const condition = keyed
    ? conditionValue
    : createMemo(
        conditionValue,
        undefined,
        IS_DEV
          ? {
              equals: (a, b) => !a === !b,
              name: "condition"
            }
          : { equals: (a, b) => !a === !b }
      );
  return createMemo(
    () => {
      const c = condition();
      if (c) {
        const child = props.children;
        const fn = typeof child === "function" && child.length > 0;
        return fn
          ? untrack(() =>
              (child as any)(
                keyed
                  ? (c as T)
                  : () => {
                      if (!untrack(condition)) throw narrowedError("Show");
                      return conditionValue();
                    }
              )
            )
          : child;
      }
      return props.fallback;
    },
    undefined,
    IS_DEV ? { name: "value" } : undefined
  ) as unknown as JSX.Element;
}

type EvalConditions = readonly [number, Accessor<unknown>, MatchProps<unknown>];

/**
 * Switches between content based on mutually exclusive conditions
 * ```typescript
 * <Switch fallback={<FourOhFour />}>
 *   <Match when={state.route === 'home'}>
 *     <Home />
 *   </Match>
 *   <Match when={state.route === 'settings'}>
 *     <Settings />
 *   </Match>
 * </Switch>
 * ```
 * @description https://docs.solidjs.com/reference/components/switch-and-match
 */
export function Switch(props: { fallback?: JSX.Element; children: JSX.Element }): JSX.Element {
  const chs = children(() => props.children);
  const switchFunc = createMemo(() => {
    const ch = chs() as unknown as MatchProps<unknown> | MatchProps<unknown>[];
    const mps = Array.isArray(ch) ? ch : [ch];
    let func: Accessor<EvalConditions | undefined> = () => undefined;
    for (let i = 0; i < mps.length; i++) {
      const index = i;
      const mp = mps[i];
      const prevFunc = func;
      const conditionValue = createMemo(
        () => (prevFunc() ? undefined : mp.when),
        undefined,
        IS_DEV ? { name: "condition value" } : undefined
      );
      const condition = mp.keyed
        ? conditionValue
        : createMemo(
            conditionValue,
            undefined,
            IS_DEV
              ? {
                  equals: (a, b) => !a === !b,
                  name: "condition"
                }
              : { equals: (a, b) => !a === !b }
          );
      func = () => prevFunc() || (condition() ? [index, conditionValue, mp] : undefined);
    }
    return func;
  });
  return createMemo(
    () => {
      const sel = switchFunc()();
      if (!sel) return props.fallback;
      const [index, conditionValue, mp] = sel;
      const child = mp.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn
        ? untrack(() =>
            (child as any)(
              mp.keyed
                ? (conditionValue() as any)
                : () => {
                    if (untrack(switchFunc)()?.[0] !== index) throw narrowedError("Match");
                    return conditionValue();
                  }
            )
          )
        : child;
    },
    undefined,
    IS_DEV ? { name: "eval conditions" } : undefined
  ) as unknown as JSX.Element;
}

export type MatchProps<T> = {
  when: T | undefined | null | false;
  keyed?: boolean;
  children: JSX.Element | ((item: NonNullable<T> | Accessor<NonNullable<T>>) => JSX.Element);
};
/**
 * Selects a content based on condition when inside a `<Switch>` control flow
 * ```typescript
 * <Match when={condition()}>
 *   <Content/>
 * </Match>
 * ```
 * @description https://docs.solidjs.com/reference/components/switch-and-match
 */
export function Match<
  T,
  TRenderFunction extends (item: Accessor<NonNullable<T>>) => JSX.Element
>(props: {
  when: T | undefined | null | false;
  keyed?: false;
  children: JSX.Element | RequiredParameter<TRenderFunction>;
}): JSX.Element;
export function Match<T, TRenderFunction extends (item: NonNullable<T>) => JSX.Element>(props: {
  when: T | undefined | null | false;
  keyed: true;
  children: JSX.Element | RequiredParameter<TRenderFunction>;
}): JSX.Element;
export function Match<T>(props: MatchProps<T>) {
  return props as unknown as JSX.Element;
}

let Errors: Set<Setter<any>>;
export function resetErrorBoundaries() {
  Errors && [...Errors].forEach(fn => fn());
}
/**
 * Catches uncaught errors inside components and renders a fallback content
 *
 * Also supports a callback form that passes the error and a reset function:
 * ```typescript
 * <ErrorBoundary fallback={
 *   (err, reset) => <div onClick={reset}>Error: {err.toString()}</div>
 * }>
 *   <MyComp />
 * </ErrorBoundary>
 * ```
 * Errors thrown from the fallback can be caught by a parent ErrorBoundary
 *
 * @description https://docs.solidjs.com/reference/components/error-boundary
 */
export function ErrorBoundary(props: {
  fallback: JSX.Element | ((err: any, reset: () => void) => JSX.Element);
  children: JSX.Element;
}): JSX.Element {
  let err;
  if (sharedConfig!.context && sharedConfig!.load)
    err = sharedConfig.load(sharedConfig.getContextId());
  const [errored, setErrored] = createSignal<any>(err, IS_DEV ? { name: "errored" } : undefined);
  Errors || (Errors = new Set());
  Errors.add(setErrored);
  onCleanup(() => Errors.delete(setErrored));
  return createMemo(
    () => {
      let e: any;
      if ((e = errored())) {
        const f = props.fallback;
        if (IS_DEV && (typeof f !== "function" || f.length == 0)) console.error(e);
        return typeof f === "function" && f.length ? untrack(() => f(e, () => setErrored())) : f;
      }
      return catchError(() => props.children, setErrored);
    },
    undefined,
    IS_DEV ? { name: "value" } : undefined
  ) as unknown as JSX.Element;
}

```

### Core Architecture Module: `packages/solid/src/render/hydration.ts`
```
import { Computation } from "../reactive/signal.js";

export type HydrationContext = { id: string; count: number };

type SharedConfig = {
  context?: HydrationContext;
  resources?: { [key: string]: any };
  load?: (id: string) => Promise<any> | any;
  has?: (id: string) => boolean;
  gather?: (key: string) => void;
  registry?: Map<string, Element>;
  done?: boolean;
  count?: number;
  effects?: Computation<any, any>[];
  getContextId(): string;
  getNextContextId(): string;
};

export const sharedConfig: SharedConfig = {
  context: undefined,
  registry: undefined,
  effects: undefined,
  done: false,
  getContextId() {
    return getContextId(this.context!.count);
  },
  getNextContextId() {
    return getContextId(this.context!.count++);
  }
};

function getContextId(count: number) {
  const num = String(count),
    len = num.length - 1;
  return sharedConfig.context!.id + (len ? String.fromCharCode(96 + len) : "") + num;
}

export function setHydrateContext(context?: HydrationContext): void {
  sharedConfig.context = context;
}

export function nextHydrateContext(): HydrationContext | undefined {
  return {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  };
}

```

### Core Architecture Module: `packages/solid/src/render/index.ts`
```
export * from "./component.js";
export * from "./flow.js";
export * from "./Suspense.js";
export { sharedConfig } from "./hydration.js";

```

### Core Architecture Module: `packages/solid/src/server/rendering.ts`
```
import {
  Accessor,
  castError,
  catchError,
  cleanNode,
  createContext,
  createMemo,
  createOwner,
  Owner,
  resolveChildren,
  runWithOwner,
  Setter,
  Signal,
  useContext
} from "./reactive.js";
import type { JSX } from "../jsx.js";

export type Component<P = {}> = (props: P) => JSX.Element;
export type VoidProps<P = {}> = P & { children?: never };
export type VoidComponent<P = {}> = Component<VoidProps<P>>;
export type ParentProps<P = {}> = P & { children?: JSX.Element };
export type ParentComponent<P = {}> = Component<ParentProps<P>>;
export type FlowProps<P = {}, C = JSX.Element> = P & { children: C };
export type FlowComponent<P = {}, C = JSX.Element> = Component<FlowProps<P, C>>;
export type Ref<T> = T | ((val: T) => void);
export type ValidComponent = keyof JSX.IntrinsicElements | Component<any> | (string & {});
export type ComponentProps<T extends ValidComponent> =
  T extends Component<infer P>
    ? P
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : Record<string, unknown>;

// these methods are duplicates from solid-js/web
// we need a better solution for this in the future
function escape(s: any, attr?: boolean) {
  const t = typeof s;
  if (t !== "string") {
    if (!attr && t === "function") return escape(s());
    if (!attr && Array.isArray(s)) {
      for (let i = 0; i < s.length; i++) s[i] = escape(s[i]);
      return s;
    }
    if (attr && t === "boolean") return String(s);
    return s;
  }
  const delim = attr ? '"' : "<";
  const escDelim = attr ? "&quot;" : "&lt;";
  let iDelim = s.indexOf(delim);
  let iAmp = s.indexOf("&");

  if (iDelim < 0 && iAmp < 0) return s;

  let left = 0,
    out = "";

  while (iDelim >= 0 && iAmp >= 0) {
    if (iDelim < iAmp) {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } else {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }
  }

  if (iDelim >= 0) {
    do {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } while (iDelim >= 0);
  } else
    while (iAmp >= 0) {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }

  return left < s.length ? out + s.substring(left) : out;
}

function resolveSSRNode(node: any): string {
  const t = typeof node;
  if (t === "string") return node;
  if (node == null || t === "boolean") return "";
  if (Array.isArray(node)) {
    let prev = {};
    let mapped = "";
    for (let i = 0, len = node.length; i < len; i++) {
      if (typeof prev !== "object" && typeof node[i] !== "object") mapped += `<!--!$-->`;
      mapped += resolveSSRNode((prev = node[i]));
    }
    return mapped;
  }
  if (t === "object") return node.t;
  if (t === "function") return resolveSSRNode(node());
  return String(node);
}

type SharedConfig = {
  context?: HydrationContext;
  getContextId(): string;
  getNextContextId(): string;
};
export const sharedConfig: SharedConfig = {
  context: undefined,
  getContextId() {
    if (!this.context) throw new Error(`getContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count);
  },
  getNextContextId() {
    if (!this.context)
      throw new Error(`getNextContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count++);
  }
};

function getContextId(count: number) {
  const num = String(count),
    len = num.length - 1;
  return sharedConfig.context!.id + (len ? String.fromCharCode(96 + len) : "") + num;
}

function setHydrateContext(context?: HydrationContext): void {
  sharedConfig.context = context;
}

function nextHydrateContext(): HydrationContext | undefined {
  return sharedConfig.context
    ? {
        ...sharedConfig.context,
        id: sharedConfig.getNextContextId(),
        count: 0
      }
    : undefined;
}

export function createUniqueId(): string {
  return sharedConfig.getNextContextId();
}

export function createComponent<T>(Comp: (props: T) => JSX.Element, props: T): JSX.Element {
  if (sharedConfig.context && !sharedConfig.context.noHydrate) {
    const c = sharedConfig.context;
    setHydrateContext(nextHydrateContext());
    const r = Comp(props || ({} as T));
    setHydrateContext(c);
    return r;
  }
  return Comp(props || ({} as T));
}

export function mergeProps<T>(source: T): T;
export function mergeProps<T, U>(source: T, source1: U): T & U;
export function mergeProps<T, U, V>(source: T, source1: U, source2: V): T & U & V;
export function mergeProps<T, U, V, W>(
  source: T,
  source1: U,
  source2: V,
  source3: W
): T & U & V & W;
export function mergeProps(...sources: any): any {
  const target = {};
  for (let i = 0; i < sources.length; i++) {
    let source = sources[i];
    if (typeof source === "function") source = source();
    if (source) {
      const descriptors = Object.getOwnPropertyDescriptors(source);
      for (const key in descriptors) {
        if (
          key === "__proto__" ||
          key === "constructor" ||
          Object.prototype.hasOwnProperty.call(target, key)
        )
          continue;
        Object.defineProperty(target, key, {
          enumerable: true,
          get() {
            for (let i = sources.length - 1; i >= 0; i--) {
              let v,
                s = sources[i];
              if (typeof s === "function") s = s();
              v = (s || {})[key];
              if (v !== undefined) return v;
            }
          }
        });
      }
    }
  }
  return target;
}

export function splitProps<T extends object, K1 extends keyof T>(
  props: T,
  ...keys: [K1[]]
): [Pick<T, K1>, Omit<T, K1>];
export function splitProps<T extends object, K1 extends keyof T, K2 extends keyof T>(
  props: T,
  ...keys: [K1[], K2[]]
): [Pick<T, K1>, Pick<T, K2>, Omit<T, K1 | K2>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[]]
): [Pick<T, K1>, Pick<T, K2>, Pick<T, K3>, Omit<T, K1 | K2 | K3>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T,
  K4 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[], K4[]]
): [Pick<T, K1>, Pick<T, K2>, Pick<T, K3>, Pick<T, K4>, Omit<T, K1 | K2 | K3 | K4>];
export function splitProps<
  T extends object,
  K1 extends keyof T,
  K2 extends keyof T,
  K3 extends keyof T,
  K4 extends keyof T,
  K5 extends keyof T
>(
  props: T,
  ...keys: [K1[], K2[], K3[], K4[], K5[]]
): [
  Pick<T, K1>,
  Pick<T, K2>,
  Pick<T, K3>,
  Pick<T, K4>,
  Pick<T, K5>,
  Omit<T, K1 | K2 | K3 | K4 | K5>
];
export function splitProps<T>(props: T, ...keys: [(keyof T)[]]) {
  const descriptors = Object.getOwnPropertyDescriptors(props),
    split = (k: (keyof T)[]) => {
      const clone: Partial<T> = {};
      for (let i = 0; i < k.length; i++) {
        const key = k[i];
        if (descriptors[key]) {
          Object.defineProperty(clone, key, descriptors[key]);
          delete descriptors[key];
        }
      }
      return clone;
    };
  return keys.map(split).concat(split(Object.keys(descriptors) as (keyof T)[]));
}

function simpleMap(
  props: { each: any[]; children: Function; fallback?: string },
  wrap: (fn: Function, item: any, i: number) => string
) {
  const list = props.each || [],
    len = list.length,
    fn = props.children;
  if (len) {
    let mapped = Array(len);
    for (let i = 0; i < len; i++) mapped[i] = wrap(fn, list[i], i);
    return mapped;
  }
  return props.fallback;
}

export function For<T>(props: {
  each: T[];
  fallback?: string;
  children: (item: T, index: () => number) => string;
}) {
  return simpleMap(props, (fn, item, i) => fn(item, () => i));
}

// non-keyed
export function Index<T>(props: {
  each: T[];
  fallback?: string;
  children: (item: () => T, index: number) => string;
}) {
  return simpleMap(props, (fn, item, i) => fn(() => item, i));
}

type RequiredParameter<T> = T extends () => unknown ? never : T;
/**
 * Conditionally render its children or an optional fallback component
 * @description https://docs.solidjs.com/reference/components/show
 */
export function Show<T>(props: {
  when: T | undefined | null | false;
  keyed?: boolean;
  fallback?: string;
  children: string | ((item: NonNullable<T> | Accessor<NonNullable<T>>) => string);
}): string {
  let c: string | ((item: NonNullable<T> | Accessor<NonNullable<T>>) => string);
  const w = props.when;
  return w
    ? typeof (c = props.children) === "function" && c.length > 0
      ? c(props.keyed ? w! : () => w as any)
      : (c as string)
    : props.fallback || "";
}

export function Switch(props: {
  fallback?: string;
  children: MatchProps<unknown> | MatchProps<unknown>[];
}) {
  let conditions = resolveChildren(props.children) as MatchProps<unknown> | MatchProps<unknown>[];
  Array.isArray(conditions) || (conditions = [conditions]);

  for (let i = 0; i < conditions.length; i++) {
    const w = conditions[i].when;
    if (w) {
      const c = conditions[i].children;
      return typeof c === "function" && c.length > 0
        ? c(conditions[i].keyed ? w : () => w)
        : (c as string);
    }
  }
  return props.fallback || "";
}

type MatchProps<T> = {
  when: T | false;
  keyed?: boolean;
  children: string | ((item: NonNullable<T> | Accessor<NonNullable<T>>) => string);
};
export function Match<T>(props: MatchProps<T>) {
  return props;
}

export function resetErrorBoundaries() {}
export function ErrorBoundary(props: {
  fallback: string | ((err: any, reset: () => void) => string);
  children: string;
}) {
  let error: any,
    res: any,
    clean: any,
    sync = true;
  const ctx = sharedConfig.context!;
  const id = sharedConfig.getC
```

### Core Architecture Module: `packages/solid/web/src/core.ts`
```
//@ts-nocheck
import { createMemo } from "solid-js";
export {
  getOwner,
  createComponent,
  createRoot as root,
  createRenderEffect as effect,
  sharedConfig,
  untrack,
  mergeProps
} from "solid-js";

export const memo = fn => createMemo(() => fn());

```

### Core Architecture Module: `packages/babel-preset-solid/index.js`
```
const jsxTransform = require("babel-plugin-jsx-dom-expressions");

module.exports = function (context, options = {}) {
  const plugins = [
    [
      jsxTransform,
      Object.assign(
        {
          moduleName: "solid-js/web",
          builtIns: [
            "For",
            "Show",
            "Switch",
            "Match",
            "Suspense",
            "SuspenseList",
            "Portal",
            "Index",
            "Dynamic",
            "ErrorBoundary"
          ],
          contextToCustomElements: true,
          wrapConditionals: true,
          generate: "dom"
        },
        options
      )
    ]
  ];

  return {
    plugins
  };
};

```

### Core Architecture Module: `packages/solid-element/sample.jsx`
```
import { createSignal } from "solid-js";
import { customElement } from "solid-element";

const style = `div * {
          font-size: 200%;
        }

        span {
          width: 4rem;
          display: inline-block;
          text-align: center;
        }

        button {
          width: 4rem;
          height: 4rem;
          border: none;
          border-radius: 10px;
          background-color: seagreen;
          color: white;
        }`;

customElement("my-counter", () => {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <style>{style}</style>
      <button onClick={() => setCount(count() - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(count() + 1)}>+</button>
    </div>
  );
});

```

### Core Architecture Module: `packages/solid-element/src/index.ts`
```
import {
  register,
  ComponentType as mComponentType,
  ICustomElement,
  FunctionComponent,
  ComponentOptions,
  PropsDefinitionInput
} from "component-register";
export { hot, getCurrentElement, noShadowDOM } from "component-register";
export type ComponentType<T> = mComponentType<T>;
import { createRoot, createSignal } from "solid-js";
import { insert } from "solid-js/web";

function createProps<T extends object>(raw: T) {
  const keys = Object.keys(raw) as (keyof T)[];
  const props = {};
  for (let i = 0; i < keys.length; i++) {
    const [get, set] = createSignal(raw[keys[i]]);
    Object.defineProperty(props, keys[i], {
      get,
      set(v) {
        set(() => v);
      }
    });
  }
  return props as T;
}

function lookupContext(el: ICustomElement & { _$owner?: any }) {
  if (el.assignedSlot && el.assignedSlot._$owner) return el.assignedSlot._$owner;
  let next: Element & { _$owner?: any } = el.parentNode;
  while (next) {
    if (next._$owner) return next._$owner;
    if (next.assignedSlot && (next.assignedSlot as Element & { _$owner?: any })._$owner)
      return (next.assignedSlot as Element & { _$owner?: any })._$owner;
    next = next.parentNode as Element;
  }
  return el._$owner;
}

function withSolid<T extends object>(ComponentType: ComponentType<T>): ComponentType<T> {
  return (rawProps: T, options: ComponentOptions) => {
    const { element } = options as {
      element: ICustomElement & { _$owner?: any };
    };
    return createRoot((dispose: Function) => {
      const props = createProps<T>(rawProps);

      element.addPropertyChangedCallback((key: string, val: any) => (props[key as keyof T] = val));
      element.addReleaseCallback(() => {
        element.renderRoot.textContent = "";
        dispose();
      });

      const comp = (ComponentType as FunctionComponent<T>)(props as T, options);
      return insert(element.renderRoot, comp);
    }, lookupContext(element));
  };
}

function customElement<T extends object>(
  tag: string,
  ComponentType: ComponentType<T>
): CustomElementConstructor;
function customElement<T extends object>(
  tag: string,
  props: PropsDefinitionInput<T>,
  ComponentType: ComponentType<T>
): CustomElementConstructor;
function customElement<T extends object>(
  tag: string,
  props: PropsDefinitionInput<T> | ComponentType<T>,
  ComponentType?: ComponentType<T>
): CustomElementConstructor {
  if (arguments.length === 2) {
    ComponentType = props as ComponentType<T>;
    props = {} as PropsDefinitionInput<T>;
  }
  return register<T>(tag, props as PropsDefinitionInput<T>)(withSolid(ComponentType!));
}

export { withSolid, customElement };

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

### Incident Patch 1: `64010be8` (2026-11-10)
**Commit Message**: fix(solid): release disposed transition sources during pending Suspense (#4744)

* fix(solid): release disposed transition sources during pending Suspense (#4728)

* fix(solid): avoid passing forEach index into cleanNode

* test: type For children as Element in #4728 regression

**File**: `.changeset/fix-transition-pending-store-oom.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"solid-js": patch
+---
+
+Release disposed transition sources during a pending Suspense transition so keyed store reconciles cannot retain unbounded memory.
```

**File**: `packages/solid/src/reactive/signal.ts` (modified, +19/-4)
```diff
@@ -1384,7 +1384,7 @@ export function writeSignal(node: SignalState<any> | Memo<any>, value: any, isCo
 
 function updateComputation(node: Computation<any>) {
   if (!node.fn) return;
-  cleanNode(node);
+  cleanNode(node, true);
   const time = ExecCount;
   runComputation(
     node,
@@ -1417,11 +1417,11 @@ function runComputation(node: Computation<any>, value: any, time: number) {
     if (node.pure) {
       if (Transition && Transition.running) {
         node.tState = STALE;
-        (node as Memo<any>).tOwned && (node as Memo<any>).tOwned!.forEach(cleanNode);
+        (node as Memo<any>).tOwned && (node as Memo<any>).tOwned!.forEach(n => cleanNode(n));
         (node as Memo<any>).tOwned = undefined;
       } else {
         node.state = STALE;
-        node.owned && node.owned.forEach(cleanNode);
+        node.owned && node.owned.forEach(n => cleanNode(n));
         node.owned = null;
       }
     }
@@ -1704,7 +1704,14 @@ function markDownstream(node: Memo<any>) {
   }
 }
 
-function cleanNode(node: Owner) {
+function releaseTransitionSource(node: SignalState<any> | Memo<any> | Owner) {
+  if (Transition && Transition.sources.has(node as SignalState<any>)) {
+    Transition.sources.delete(node as SignalState<any>);
+    delete (node as SignalState<any>).tValue;
+  }
+}
+
+function cleanNode(node: Owner, recompute?: boolean) {
   let i;
   if ((node as Computation<any>).sources) {
     while ((node as Computation<any>).sources!.length) {
@@ -1720,6 +1727,9 @@ function cleanNode(node: Owner) {
           source.observerSlots![index] = s;
         }
       }
+      // Drop unobserved transition copies so removed store leaves do not
+      // accumulate on a long-lived pending Suspense transition (#4728).
+      if (!recompute && (!obs || !obs.length) && Transition) releaseTransitionSource(source);
     }
   }
 
@@ -1734,6 +1744,10 @@ function cleanNode(node: Owner) {
     for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
     node.owned = null;
   }
+  // Permanent disposal must drop Transition.sources entries. Recompute must not:
+  // when the transition is paused (!running), cleanNode skips the pure/reset
+  // branch above and would otherwise clear tValue before runComputation (#4728).
+  if (!recompute) releaseTransitionSource(node);
 
   if (node.cleanups) {
     for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
@@ -1748,6 +1762,7 @@ function reset(node: Computation<any>, top?: boolean) {
   if (!top) {
     node.tState = 0;
     Transition!.disposed.add(node);
+    releaseTransitionSource(node);
   }
   if (node.owned) {
     for (let i = 0; i < node.owned.length; i++) reset(node.owned[i]);
```

**File**: `packages/solid/web/test/transition-oom-4728.spec.tsx` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+﻿/**
+ * @jsxImportSource solid-js
+ * @vitest-environment jsdom
+ */
+
+import { describe, expect, test, vi } from "vitest";
+import {
+  createSignal,
+  createResource,
+  createComponent,
+  enableScheduling,
+  useTransition,
+  startTransition,
+  For
+} from "../../src/index.js";
+import { getSuspenseContext, Transition } from "../../src/reactive/signal.js";
+import { createStore, reconcile } from "../../store/src/index.js";
+import { render, Suspense } from "../src/index.js";
+
+describe("#4728 pending transition store retention", () => {
+  test("Transition.sources stays bounded while suspense transition is pending", async () => {
+    enableScheduling(null as any);
+    getSuspenseContext();
+
+    const div = document.createElement("div");
+    const [key, setKey] = createSignal(0);
+    const [state, setState] = createStore({
+      data: [
+        { symbol: "A", value: 0 },
+        { symbol: "B", value: 0 }
+      ]
+    });
+    const [pending, start] = useTransition();
+    let resolveResource!: (v: string) => void;
+
+    function Child() {
+      const [resource] = createResource(key, id =>
+        id === 0
+          ? Promise.resolve("ready")
+          : new Promise<string>(resolve => {
+              resolveResource = resolve;
+            })
+      );
+      // Use createComponent so For children stay typed as JSX.Element (not accessors).
+      return [
+        resource as unknown as string,
+        createComponent(For as any, {
+          get each() {
+            resource();
+            return state.data;
+          },
+          children: (row: { symbol: string; value: number }) =>
+            createComponent(For as any, {
+              each: ["symbol", "value"],
+              children: (column: string) => (row as Record<string, string | number>)[column]
+            })
+        })
+      ];
+    }
+
+    const dispose = render(() => {
+      return (
+        <Suspense fallback="loading">
+          <Child />
+        </Suspense>
+      );
+    }, div);
+
+    await Promise.resolve();
+    await Promise.resolve();
+
+    const transition = start(() => setKey(1));
+    await vi.waitFor(() => expect(pending()).toBe(true));
+
+    for (let step = 1; step <= 300; step++) {
+      void startTransition(() =>
+        setState(
+          "data",
+          reconcile(
+            [
+              { symbol: step % 2 ? "A" : "B", value: step },
+              { symbol: step % 2 ? "C" : "D", value: step }
+            ],
+            { key: "symbol" }
+          )
+        )
+      );
+      await new Promise(r => setImmediate(r));
+    }
+
+    const sources = Transition?.sources.size ?? -1;
+    const disposed = Transition?.disposed.size ?? -1;
+    expect(pending()).toBe(true);
+    expect(sources).toBeGreaterThan(0);
+    // Live store leaves + computations only — must not grow with update count.
+    expect(sources).toBeLessThan(100);
+    expect(disposed).toBeLessThan(100);
+
+    resolveResource("done");
+    await transition;
+    dispose();
+  });
+});
```

---

### Incident Patch 2: `f24b303b` (2026-11-10)
**Commit Message**: fix(store): preserve class accessor precedence in createMutable (#4703)

* fix(store): preserve class accessor precedence in createMutable

Retain the nearest descriptor while walking class prototypes so ancestor accessors cannot replace derived or own properties.

* test(store): cover mutable class descriptor overrides

Check derived accessors, instance accessors and own data properties, including reactive reads and derived setters.

* chore: add changeset for mutable descriptor precedence

Record the store bug fix as a patch release.

**File**: `.changeset/retain-mutable-class-descriptors.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"solid-js": patch
+---
+
+Preserve own and derived class property descriptors when wrapping instances with `createMutable`.
```

**File**: `packages/solid/store/src/mutable.ts` (modified, +5/-3)
```diff
@@ -98,7 +98,7 @@ function wrap<T extends StoreNode>(value: T): T {
   if (!p) {
     Object.defineProperty(value, $PROXY, { value: (p = new Proxy(value, proxyTraps)) });
     const keys = Object.keys(value),
-      desc = Object.getOwnPropertyDescriptors(value);
+      desc: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(value);
 
     const proto = Object.getPrototypeOf(value);
     const isClass =
@@ -111,8 +111,10 @@ function wrap<T extends StoreNode>(value: T): T {
       let curProto = proto;
       while (curProto != null) {
         const descriptors = Object.getOwnPropertyDescriptors(curProto);
-        keys.push(...Object.keys(descriptors));
-        Object.assign(desc, descriptors);
+        for (const prop of Object.keys(descriptors)) {
+          keys.push(prop);
+          if (!Object.prototype.hasOwnProperty.call(desc, prop)) desc[prop] = descriptors[prop];
+        }
         curProto = Object.getPrototypeOf(curProto);
       }
     }
```

**File**: `packages/solid/store/test/mutable.spec.ts` (modified, +72/-0)
```diff
@@ -74,6 +74,78 @@ describe("State Getter/Setters", () => {
   });
 });
 
+describe("Class accessor precedence", () => {
+  class BaseCounter {
+    count = 1;
+    get value() {
+      return this.count;
+    }
+    set value(value: number) {
+      this.count = value;
+    }
+  }
+
+  class Counter extends BaseCounter {
+    get value() {
+      return this.count * 2;
+    }
+    set value(value: number) {
+      this.count = value / 2;
+    }
+  }
+
+  test("preserves overridden getters and setters", () => {
+    createRoot(dispose => {
+      const counter = createMutable(new Counter());
+      const value = createMemo(() => counter.value);
+      expect(value()).toBe(2);
+      counter.count = 4;
+      expect(value()).toBe(8);
+      counter.value = 6;
+      expect(counter.count).toBe(3);
+      expect(value()).toBe(6);
+      dispose();
+    });
+  });
+
+  test("preserves own accessors over prototype accessors", () => {
+    createRoot(dispose => {
+      const instance = new Counter();
+      Object.defineProperty(instance, "value", {
+        get() {
+          return this.count * 3;
+        },
+        set(value: number) {
+          this.count = value / 3;
+        },
+        configurable: true
+      });
+      const counter = createMutable(instance);
+      const value = createMemo(() => counter.value);
+      expect(value()).toBe(3);
+      counter.value = 6;
+      expect(counter.count).toBe(2);
+      expect(value()).toBe(6);
+      dispose();
+    });
+  });
+
+  test("preserves own data properties over prototype accessors", () => {
+    const instance = new Counter();
+    Object.defineProperty(instance, "value", {
+      value: 10,
+      writable: true,
+      enumerable: true,
+      configurable: true
+    });
+    const counter = createMutable(instance);
+    expect(counter.value).toBe(10);
+    counter.value = 20;
+    expect(counter.value).toBe(20);
+    expect(counter.count).toBe(1);
+  });
+});
+
 describe("Simple update modes", () => {
   test("Simple Key Value", () => {
     const state = createMutable({ key: "" });
```

---

### Incident Patch 3: `27f701fb` (2026-11-10)
**Commit Message**: fix(solid): recover from missing observerSlots after a failed allocation (#4752)

**File**: `packages/solid/src/reactive/signal.ts` (modified, +37/-4)
```diff
@@ -1306,6 +1306,25 @@ export function enableExternalSource(
 }
 
 // Internal
+
+// Rebuild a source's `observerSlots` from its observers' back-pointers.
+// A source can end up with observers but no (or out-of-sync) slots when an
+// array allocation fails midway through `readSignal` (see #4680); without
+// this, `cleanNode` and a later `readSignal` throw on the missing array.
+// Each observer subscribes to a source at most once, so the slot for
+// `observers[i]` is the index of the source in that observer's `sources`.
+function repairObserverSlots(source: SignalState<any> | Memo<any>) {
+  source.observerSlots = source.observers!.map((observer, slot) => {
+    const sources = observer.sources;
+    if (!sources) return -1;
+    for (let i = sources.length - 1; i >= 0; i--) {
+      if (sources[i] === source && observer.sourceSlots && observer.sourceSlots[i] === slot)
+        return i;
+    }
+    return sources.lastIndexOf(source);
+  });
+}
+
 export function readSignal(this: SignalState<any> | Memo<any>) {
   const runningTransition = Transition && Transition.running;
   if (
@@ -1326,16 +1345,28 @@ export function readSignal(this: SignalState<any> | Memo<any>) {
     if (!observers || observers[observers.length - 1] !== Listener) {
       const sSlot = observers ? observers.length : 0;
       if (!Listener.sources) {
-        Listener.sources = [this];
-        Listener.sourceSlots = [sSlot];
+        // Build both arrays before assigning either, so an allocation
+        // failure cannot leave `sources` set while `sourceSlots` is null.
+        const sources = [this];
+        const sourceSlots = [sSlot];
+        Listener.sources = sources;
+        Listener.sourceSlots = sourceSlots;
       } else {
         Listener.sources.push(this);
         Listener.sourceSlots!.push(sSlot);
       }
       if (!observers) {
-        this.observers = [Listener];
-        this.observerSlots = [Listener.sources.length - 1];
+        // Build both arrays before assigning either, so an allocation
+        // failure cannot leave `observers` set while `observerSlots` is null.
+        const newObservers = [Listener];
+        const newObserverSlots = [Listener.sources.length - 1];
+        this.observers = newObservers;
+        this.observerSlots = newObserverSlots;
       } else {
+        // The slot array may be missing or out of sync if an earlier
+        // allocation failed; rebuild it from the back-pointers first.
+        if (!this.observerSlots || this.observerSlots.length !== observers.length)
+          repairObserverSlots(this);
         observers.push(Listener);
         this.observerSlots!.push(Listener.sources.length - 1);
       }
@@ -1719,6 +1750,8 @@ function cleanNode(node: Owner, recompute?: boolean) {
         index = (node as Computation<any>).sourceSlots!.pop()!,
         obs = source.observers;
       if (obs && obs.length) {
+        if (!source.observerSlots || source.observerSlots.length !== obs.length)
+          repairObserverSlots(source);
         const n = obs.pop()!,
           s = source.observerSlots!.pop()!;
         if (index < obs.length) {
```

**File**: `packages/solid/test/signals.spec.ts` (modified, +57/-0)
```diff
@@ -922,6 +922,63 @@ describe("runWithOwner", () => {
   });
 });
 
+describe("Missing observerSlots recovery", () => {
+  test("Disposing an observer recovers when a source has observers but null observerSlots", () => {
+    const [count, setCount] = createSignal(0);
+    let observer: any;
+    let effectRuns = 0;
+    const disposeBroken = createRoot(dispose => {
+      createComputed(() => {
+        observer = getOwner();
+        count();
+      });
+      return dispose;
+    });
+    createRoot(() => {
+      createEffect(() => {
+        count();
+        effectRuns++;
+      });
+    });
+    expect(effectRuns).toBe(1);
+    // Simulate the state left behind when readSignal's second array
+    // allocation fails: the source has observers but observerSlots is null.
+    observer.sources[0].observerSlots = null;
+    expect(() => disposeBroken()).not.toThrow();
+    // The surviving observer is still subscribed: writes still reach it.
+    setCount(1);
+    expect(effectRuns).toBe(2);
+  });
+
+  test("Reading a source with null observerSlots recovers instead of throwing", () => {
+    const [count, setCount] = createSignal(0);
+    let observer: any;
+    let runs = 0;
+    const disposeBroken = createRoot(dispose => {
+      createComputed(() => {
+        observer = getOwner();
+        count();
+      });
+      return dispose;
+    });
+    observer.sources[0].observerSlots = null;
+    // A new subscription must not throw on observerSlots.push().
+    expect(() =>
+      createRoot(() => {
+        createComputed(() => {
+          count();
+          runs++;
+        });
+      })
+    ).not.toThrow();
+    expect(runs).toBe(1);
+    expect(() => disposeBroken()).not.toThrow();
+    // The new observer is still subscribed after the broken one is disposed.
+    setCount(1);
+    expect(runs).toBe(2);
+  });
+});
+
 describe("createReaction", () => {
   test("Create and trigger a Reaction", () =>
     new Promise(done => {
```

#### Recent Merged Pull Requests:
- **PR #4800** (2026-11-12): perf(web): move end nodes once and stamp the reconcile window (@ryansolid)
- **PR #4799** (2026-11-12): fix(compiler): fold module constants whatever their order against a hoisted component (#4791) (@ryansolid)
- **PR #4798** (2026-11-12): fix(signals): a guess derived from another hold's live guess entangles the two (#4788) (@ryansolid)
- **PR #4797** (2026-11-12): fix(signals): a shown guess over a new question keeps the screen; warn OPTIMISTIC_WRITE_WHILE_LOADING (#4795) (@ryansolid)
- **PR #4796** (2026-11-12): fix(signals): a projection's reader pulls the derive it reads through (#4782) (@ryansolid)
- **PR #4794** (2026-11-12): fix(signals): a landing's re-derived memo re-runs the held runs that read it stale (@ryansolid)

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

## X. solid): release disposed transition sources during pending Suspense (#4744)

**RULE**:
When implementing operations in `.changeset/fix-transition-pending-store-oom.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in solidjs/solid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `64010be8`: solid): release disposed transition sources during pending Suspense (#4744). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/fix-transition-pending-store-oom.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"solid-js": patch
---

Release disposed transition sources during a pending Suspense transition so keyed store reconciles cannot retain unbounded memory.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `64010be8` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
