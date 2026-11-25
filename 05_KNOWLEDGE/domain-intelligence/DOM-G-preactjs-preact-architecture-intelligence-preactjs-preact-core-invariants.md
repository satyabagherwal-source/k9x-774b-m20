# Domain G — Architecture Intelligence: Architecture Intelligence: preactjs/preact Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "preactjs/preact",
  "source_url": "https://github.com/preactjs/preact",
  "source_version": "1fbc07f6",
  "license": "MIT",
  "timestamp": "2026-11-25T00:16:46.837Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-preactjs-preact",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [preactjs/preact](https://github.com/preactjs/preact) (Revision: `1fbc07f6`).  
> **License**: MIT | **Timestamp**: `2026-11-25T00:16:46.837Z`  
> **Learning ID**: `learn-github-preactjs-preact`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 71%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from preactjs/preact:

# Forensic Learning Record (Deep Inspection): preactjs/preact

> **Canonical Artifact**: `07_PROJECT_LEARNING/preactjs-preact-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/preactjs/preact](https://github.com/preactjs/preact))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T00:16:45.944Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `preactjs/preact`
- **Description**: ⚛️ Fast 3kB React alternative with the same modern API. Components & Virtual DOM.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 39012 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `compat/src/hooks.js`
```
import { useLayoutEffect, useRef } from 'preact/hooks';

export function startTransition(cb) {
	cb();
}

export function useDeferredValue(val) {
	return val;
}

export function useTransition() {
	return [false, startTransition];
}

// TODO: in theory this should be done after a VNode is diffed as we want to insert
// styles/... before it attaches
export const useInsertionEffect = useLayoutEffect;

/**
 * @template {Function} T
 * @param {T} callback
 * @returns {T}
 */
export function useEffectEvent(callback) {
	const ref = useRef(callback);
	ref.current = callback;

	return /** @type {T} */ (
		function () {
			return ref.current.apply(undefined, arguments);
		}
	);
}

```

### Core Architecture Module: `compat/src/render.js`
```
import {
	render as preactRender,
	hydrate as preactHydrate,
	options,
	toChildArray,
	Component
} from 'preact';
import {
	useCallback,
	useContext,
	useDebugValue,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState
} from 'preact/hooks';
import { useDeferredValue, useInsertionEffect, useTransition } from './index';
import { assign, IS_NON_DIMENSIONAL } from './util';

export const REACT_ELEMENT_TYPE = Symbol.for('react.element');

const MODE_HYDRATE = 1 << 5;
let currentComponent, hydrationRoot, renderTrackingInitialized;

const CAMEL_PROPS =
	/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(?!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
const CAMEL_REPLACE = /[A-Z0-9]/g;
const IS_DOM = typeof document < 'u';

/**
 * This is taken from https://github.com/facebook/react/blob/main/packages/use-sync-external-store/src/useSyncExternalStoreShimClient.js#L84
 * on a high level this cuts out the warnings, ... and attempts a smaller implementation
 * @typedef {{ _value: any; _getSnapshot: () => any }} Store
 */
export const useSyncExternalStore = /* @__PURE__ */ initRenderTracking(
	function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
		const serverRendering = options._skipEffects || hydrationRoot;
		const value = serverRendering
			? (getServerSnapshot || getSnapshot)()
			: getSnapshot();

		/**
		 * @typedef {{ _instance: Store }} StoreRef
		 * @type {[StoreRef, (store: StoreRef) => void]}
		 */
		const [{ _instance }, forceUpdate] = useState({
			_instance: { _value: value, _getSnapshot: getSnapshot }
		});

		useLayoutEffect(() => {
			_instance._value = value;
			_instance._getSnapshot = getSnapshot;

			if (didSnapshotChange(_instance)) {
				forceUpdate({ _instance });
			}
		}, [subscribe, value, getSnapshot]);

		useEffect(() => {
			if (didSnapshotChange(_instance)) {
				forceUpdate({ _instance });
			}

			return subscribe(() => {
				if (didSnapshotChange(_instance)) {
					forceUpdate({ _instance });
				}
			});
		}, [subscribe]);

		return value;
	}
);

/** @type {(inst: Store) => boolean} */
function didSnapshotChange(inst) {
	try {
		return !Object.is(inst._value, inst._getSnapshot());
	} catch (error) {
		return true;
	}
}

// Input types for which onchange should not be converted to oninput.
const onChangeInputType = type => /fil|che|rad/.test(type);

// Some libraries like `react-virtualized` explicitly check for this.
Component.prototype.isReactComponent = true;

// `UNSAFE_*` lifecycle hooks
// Preact only ever invokes the unprefixed methods.
// Here we provide a base "fallback" implementation that calls any defined UNSAFE_ prefixed method.
// - If a component defines its own `componentDidMount()` (including via defineProperty), use that.
// - If a component defines `UNSAFE_componentDidMount()`, `componentDidMount` is the alias getter/setter.
// - If anything assigns to an `UNSAFE_*` property, the assignment is forwarded to the unprefixed property.
// See https://github.com/preactjs/preact/issues/1941
[
	'componentWillMount',
	'componentWillReceiveProps',
	'componentWillUpdate'
].forEach(key => {
	Object.defineProperty(Component.prototype, key, {
		configurable: true,
		get() {
			return this['UNSAFE_' + key];
		},
		set(v) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value: v
			});
		}
	});
});

/**
 * Proxy render() since React returns a Component reference.
 * @param {import('./internal').VNode} vnode VNode tree to render
 * @param {import('./internal').PreactElement} parent DOM node to render vnode tree into
 * @param {() => void} [callback] Optional callback that will be called after rendering
 * @returns {import('./internal').Component | null} The root component reference or null
 */
export function render(vnode, parent, callback) {
	// React destroys any existing DOM nodes, see #1727
	// ...but only on the first render, see #1828
	if (parent._children == null) {
		parent.textContent = '';
	}

	preactRender(vnode, parent);
	if (typeof callback == 'function') callback();

	return vnode ? vnode._component : null;
}

export function hydrate(vnode, parent, callback) {
	preactHydrate(vnode, parent);
	if (typeof callback == 'function') callback();

	return vnode ? vnode._component : null;
}

let oldEventHook = options.event;
options.event = e => {
	if (oldEventHook) e = oldEventHook(e);

	e.persist = () => {};
	e.isPropagationStopped = function isPropagationStopped() {
		return this.cancelBubble;
	};
	e.isDefaultPrevented = function isDefaultPrevented() {
		return this.defaultPrevented;
	};
	return (e.nativeEvent = e);
};

const classNameDescriptorNonEnumberable = {
	configurable: true,
	get() {
		return this.class;
	}
};

function handleDomVNode(vnode) {
	let props = vnode.props,
		type = vnode.type,
		normalizedProps = {},
		isNonDashedType = type.indexOf('-') == -1;

	for (let i in props) {
		let value = props[i];

		if (
			(i == 'value' && 'defaultValue' in props && value == null) ||
			// Emulate React's behavior of not rendering the contents of noscript tags on the client.
			(IS_DOM && i == 'children' && type == 'noscript') ||
			i == 'class' ||
			i == 'className'
		) {
			// Skip applying value if it is null/undefined and we already set
			// a default value
			continue;
		}

		if (i == 'style' && value && value.constructor == Object) {
			let cloned;
			for (let key in value) {
				if (typeof value[key] == 'number' && !IS_NON_DIMENSIONAL.test(key)) {
					if (!cloned) {
						cloned = value = assign({}, value);
					}
					value[key] += 'px';
				}
			}
		} else if (i == 'defaultValue' && 'value' in props && props.value == null) {
			// `defaultValue` is treated as a fallback `value` when a value prop is present but null/undefined.
			// `defaultValue` for Elements with no value prop is the same as the DOM defaultValue property.
			i = 'value';
		} else if (i == 'download' && value === true) {
			// Calling `setAttribute` with a truthy value will lead to it being
			// passed as a stringified value, e.g. `download="true"`. React
			// converts it to an empty string instead, otherwise the attribute
			// value will be used as the file name and the file will be called
			// "true" upon downloading it.
			value = '';
		} else if (i == 'translate' && value === 'no') {
			value = false;
		} else if (i[0] == 'o' && i[1] == 'n') {
			let lowerCased = i.toLowerCase();
			if (lowerCased == 'ondoubleclick') {
				i = 'ondblclick';
			} else if (
				lowerCased == 'onchange' &&
				(type == 'input' || type == 'textarea') &&
				!onChangeInputType(props.type)
			) {
				lowerCased = i = 'oninput';
			} else if (lowerCased == 'onfocus') {
				i = 'onfocusin';
			} else if (lowerCased == 'onblur') {
				i = 'onfocusout';
			}

			// Add support for onInput and onChange, see #3561
			// if we have an oninput prop already change it to oninputCapture
			if (lowerCased == 'oninput') {
				i = lowerCased;
				if (normalizedProps[i]) {
					i = 'oninputCapture';
				}
			}
		} else if (isNonDashedType && CAMEL_PROPS.test(i)) {
			i = i.replace(CAMEL_REPLACE, '-$&').toLowerCase();
		} else if (value === null) {
			value = undefined;
		}

		normalizedProps[i] = value;
	}

	if (type == 'select') {
		// Select the matching options for a defaultValue, or for an array value
		// of <select multiple value={[]} />.
		let selected =
			normalizedProps.defaultValue != null
				? normalizedProps.defaultValue
				: normalizedProps.multiple && Array.isArray(normalizedProps.value)
					? normalizedProps.value
					: null;
		if (selected != null) {
			// forEach() always returns undefined, which we abuse here to unset the value prop.
			normalizedProps.value = toChildArray(props.children).forEach(child => {
				child.props.selected = normalizedProps.multiple
					? selected.indexOf(child.props.value) != -1
					: selected == child.props.value;
			});
		}
	}

	if (props.class && !props.className) {
		normalizedProps.class = props.class;
		Object.defineProperty(
			normalizedProps,
			'className',
			classNameDescriptorNonEnumberable
		);
	} else if (props.className) {
		normalizedProps.class = normalizedProps.className = props.className;
	}

	vnode.props = normalizedProps;
}

let oldVNodeHook = options.vnode;
options.vnode = vnode => {
	// only normalize props on Element nodes
	if (typeof vnode.type == 'string') {
		handleDomVNode(vnode);
	} else if (typeof vnode.type == 'function') {
		const shouldApplyRef =
			'prototype' in vnode.type && vnode.type.prototype.render;
		if ('ref' in vnode.props && shouldApplyRef) {
			vnode.ref = vnode.props.ref;
			delete vnode.props.ref;
		}

		if (vnode.type.defaultProps) {
			let normalizedProps = assign({}, vnode.props);
			for (let i in vnode.type.defaultProps) {
				if (normalizedProps[i] === undefined) {
					normalizedProps[i] = vnode.type.defaultProps[i];
				}
			}
			vnode.props = normalizedProps;
		}
	}

	// React 19 keeps `ref` in element.props for every element type, and that's
	// where libraries detecting React 19 read it (e.g. MUI's getReactElementRef).
	// DOM and class vnodes keep theirs on vnode.ref.
	if (vnode.ref && !('ref' in vnode.props)) {
		Object.defineProperty(vnode.props, 'ref', {
			value: vnode.ref,
			configurable: true,
			writable: true
		});
	}
	vnode.$$typeof = REACT_ELEMENT_TYPE;

	if (oldVNodeHook) oldVNodeHook(vnode);
};

// Only needed for react-relay and useSyncExternalStore hydration.
function initRenderTracking(value) {
	if (!renderTrackingInitialized) {
		renderTrackingInitialized = true;

		const oldBeforeRender = options._render;
		options._render = vnode => {
			if (oldBeforeRender) oldBeforeRender(vnode);
			if (vnode._flags & MODE_HYDRATE) hydrationRoot = vnode;
			currentComponent = vnode._component;
		};

		const oldDiffed = op
```

### Core Architecture Module: `compat/src/util.js`
```
export const assign = Object.assign;

/**
 * Check if two objects have a different shape
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function shallowDiffers(a, b) {
	for (let i in a) if (i != '__source' && a[i] !== b[i]) return true;
	for (let i in b) if (i != '__source' && !(i in a)) return true;
	return false;
}

export const IS_NON_DIMENSIONAL =
	/^(-|f[lo].*[^se]$|g.{5,}[^ps]$|z|o[pr]|(W.{5})?[lL]i.*(t|mp)$|an|(bo|s).{4}Im|sca|m.{6}[ds]|ta|c.*[st]$|wido|ini|asp|fill|st)/;

```

### Core Architecture Module: `debug/src/util.js`
```
export const assign = Object.assign;

export function isNaN(value) {
	return value !== value;
}

```

### Core Architecture Module: `demo/stateOrderBug.jsx`
```
import htm from 'htm';
import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';

const html = htm.bind(h);

// configuration used to show behavior vs. workaround
let childFirst = true;
const Config = () => html`
	<label>
		<input
			type="checkbox"
			checked=${childFirst}
			onchange=${evt => {
				childFirst = evt.target.checked;
			}}
		/>
		Set child state before parent state.
	</label>
`;

const Child = ({ items, setItems }) => {
	let [pendingId, setPendingId] = useState(null);
	if (!pendingId) {
		setPendingId((pendingId = Math.random().toFixed(20).slice(2)));
	}

	const onInput = useCallback(
		evt => {
			let val = evt.target.value,
				_items = [...items, { _id: pendingId, val }];
			if (childFirst) {
				setPendingId(null);
				setItems(_items);
			} else {
				setItems(_items);
				setPendingId(null);
			}
		},
		[childFirst, setPendingId, setItems, items, pendingId]
	);

	return html`
		<div class="item-editor">
			${items.map(
				(item, idx) => html`
					<input
						key=${item._id}
						value=${item.val}
						oninput=${evt => {
							let val = evt.target.value,
								_items = [...items];
							_items.splice(idx, 1, { ...item, val });
							setItems(_items);
						}}
					/>
				`
			)}

			<input
				key=${pendingId}
				placeholder="type to add an item"
				oninput=${onInput}
			/>
		</div>
	`;
};

const Parent = () => {
	let [items, setItems] = useState([]);
	return html`
		<div><${Config} /><${Child} items=${items} setItems=${setItems} /></div>
	`;
};

export default Parent;

```

### Core Architecture Module: `hooks/src/index.d.ts`
```
import { ErrorInfo, PreactContext, Ref, RefObject } from '../../src/index';

type Inputs = ReadonlyArray<unknown>;

export type Dispatch<A> = (value: A) => void;
export type StateUpdater<S> = S | ((prevState: S) => S);

/**
 * Returns a stateful value, and a function to update it.
 * @param initialState The initial value (or a function that returns the initial value)
 */
export function useState<S>(
	initialState: S | (() => S)
): [S, Dispatch<StateUpdater<S>>];

export function useState<S = undefined>(): [
	S | undefined,
	Dispatch<StateUpdater<S | undefined>>
];

export type Reducer<S, A> = (prevState: S, action: A) => S;

/**
 * An alternative to `useState`.
 *
 * `useReducer` is usually preferable to `useState` when you have complex state logic that involves
 * multiple sub-values. It also lets you optimize performance for components that trigger deep
 * updates because you can pass `dispatch` down instead of callbacks.
 * @param reducer Given the current state and an action, returns the new state
 * @param initialState The initial value to store as state
 */
export function useReducer<S, A>(
	reducer: Reducer<S, A>,
	initialState: S
): [S, Dispatch<A>];

/**
 * An alternative to `useState`.
 *
 * `useReducer` is usually preferable to `useState` when you have complex state logic that involves
 * multiple sub-values. It also lets you optimize performance for components that trigger deep
 * updates because you can pass `dispatch` down instead of callbacks.
 * @param reducer Given the current state and an action, returns the new state
 * @param initialArg The initial argument to pass to the `init` function
 * @param init A function that, given the `initialArg`, returns the initial value to store as state
 */
export function useReducer<S, A, I>(
	reducer: Reducer<S, A>,
	initialArg: I,
	init: (arg: I) => S
): [S, Dispatch<A>];

/**
 * `useRef` returns a mutable ref object whose `.current` property is initialized to the passed argument
 * (`initialValue`). The returned object will persist for the full lifetime of the component.
 *
 * Note that `useRef()` is useful for more than the `ref` attribute. It’s handy for keeping any mutable
 * value around similar to how you’d use instance fields in classes.
 *
 * @param initialValue the initial value to store in the ref object
 */
export function useRef<T>(initialValue: T): RefObject<T>;
export function useRef<T>(initialValue: T | null): RefObject<T | null>;
export function useRef<T>(
	initialValue: T | undefined
): RefObject<T | undefined>;

type EffectCallback = () => void | (() => void);
/**
 * Accepts a function that contains imperative, possibly effectful code.
 * The effects run after browser paint, without blocking it.
 *
 * @param effect Imperative function that can return a cleanup function
 * @param inputs If present, effect will only activate if the values in the list change (using ===).
 */
export function useEffect(effect: EffectCallback, inputs?: Inputs): void;

type CreateHandle = () => object;

/**
 * @param ref The ref that will be mutated
 * @param create The function that will be executed to get the value that will be attached to
 * ref.current
 * @param inputs If present, effect will only activate if the values in the list change (using ===).
 */
export function useImperativeHandle<T, R extends T>(
	ref: Ref<T> | undefined,
	create: () => R,
	inputs?: Inputs
): void;

/**
 * Accepts a function that contains imperative, possibly effectful code.
 * Use this to read layout from the DOM and synchronously re-render.
 * Updates scheduled inside `useLayoutEffect` will be flushed synchronously, after all DOM mutations but before the browser has a chance to paint.
 * Prefer the standard `useEffect` hook when possible to avoid blocking visual updates.
 *
 * @param effect Imperative function that can return a cleanup function
 * @param inputs If present, effect will only activate if the values in the list change (using ===).
 */
export function useLayoutEffect(effect: EffectCallback, inputs?: Inputs): void;

/**
 * Returns a memoized version of the callback that only changes if one of the `inputs`
 * has changed (using ===).
 */
export function useCallback<T extends Function>(callback: T, inputs: Inputs): T;

/**
 * Pass a factory function and an array of inputs.
 * useMemo will only recompute the memoized value when one of the inputs has changed.
 * This optimization helps to avoid expensive calculations on every render.
 * If no array is provided, a new value will be computed whenever a new function instance is passed as the first argument.
 */
// for `inputs`, allow undefined, but don't make it optional as that is very likely a mistake
export function useMemo<T>(factory: () => T, inputs: Inputs | undefined): T;

/**
 * Returns the current context value, as given by the nearest context provider for the given context.
 * When the provider updates, this Hook will trigger a rerender with the latest context value.
 *
 * @param context The context you want to use
 */
export function useContext<T>(context: PreactContext<T>): T;

/**
 * Customize the displayed value in the devtools panel.
 *
 * @param value Custom hook name or object that is passed to formatter
 * @param formatter Formatter to modify value before sending it to the devtools
 */
export function useDebugValue<T>(value: T, formatter?: (value: T) => any): void;

export function useErrorBoundary(
	callback?: (error: any, errorInfo: ErrorInfo) => Promise<void> | void
): [any, () => void];

export function useId(): string;

```

### Core Architecture Module: `hooks/src/index.js`
```
import { options as _options } from 'preact';

const ObjectIs = Object.is;

/** @type {number} */
let currentIndex;

/** @type {import('./internal').Component} */
let currentComponent;

/** @type {number} */
let currentHook = 0;

/** @type {Array<import('./internal').Component>} */
let afterPaintEffects = [];

/**
 * Passive (useEffect) hook states of unmounted components whose cleanup is
 * still pending. Deferred to the after-paint flush to match React, which runs
 * passive destroys after the commit has painted. Each state's `_passive` holds
 * the surviving component its errors should be routed to.
 * @type {Array<import('./internal').EffectHookState>}
 */
let unmountCleanups = [];

// Cast to use internal Options type
const options = /** @type {import('./internal').Options} */ (_options);

let oldBeforeRender = options._render;
let oldAfterDiff = options.diffed;
let oldCommit = options._commit;
let oldBeforeUnmount = options.unmount;

// We take the minimum timeout for requestAnimationFrame to ensure that
// the callback is invoked after the next frame. 35ms is based on a 30hz
// refresh rate, which is the minimum rate for a smooth user experience.
const RAF_TIMEOUT = 35;
let prevRaf;

/** @type {(vnode: import('./internal').VNode) => void} */
options._render = vnode => {
	if (oldBeforeRender) oldBeforeRender(vnode);

	const component = vnode._component;
	const hooks = component.__hooks;
	if (hooks) {
		// Still current: the render loop is running this component again.
		if (currentComponent == component) {
			component._renderCallbacks = [];
		} else {
			hooks._pendingEffects.some(invokeCleanup);
			hooks._pendingEffects.some(invokeEffect);
		}
		hooks._pendingEffects = [];

		// Runs before every render, forced or not, so `shouldComponentUpdate`
		// never has to apply these itself.
		hooks._list.some(hookItem => {
			if (hookItem._nextValue) {
				hookItem._value = hookItem._nextValue;
			}
			hookItem._pendingArgs = hookItem._nextValue = undefined;
		});
	}

	// Set last: an effect flushed above can render another root.
	currentComponent = component;
	currentIndex = 0;
};

/** @type {(vnode: import('./internal').VNode) => void} */
options.diffed = vnode => {
	if (oldAfterDiff) oldAfterDiff(vnode);

	const c = vnode._component;
	if (c && c.__hooks) {
		if (c.__hooks._pendingEffects.length) afterPaint(afterPaintEffects.push(c));
		// `_pendingArgs` is cleared again by `options._render` before anything
		// can read it, so committing it here is enough.
		c.__hooks._list.some(hookItem => {
			if (hookItem._pendingArgs) hookItem._args = hookItem._pendingArgs;
		});
	}
	currentComponent = null;
};

// TODO: Improve typing of commitQueue parameter
/** @type {(vnode: import('./internal').VNode, commitQueue: any) => void} */
options._commit = (vnode, commitQueue) => {
	commitQueue.some(component => {
		try {
			component._renderCallbacks.some(invokeCleanup);
			component._renderCallbacks = component._renderCallbacks.filter(cb =>
				cb._value ? invokeEffect(cb) : true
			);
		} catch (e) {
			// Only this component skips its remaining effects, commitRoot rethrows
			// the error to its boundary after the others ran.
			component._renderCallbacks = [
				() => {
					throw e;
				}
			];
		}
	});

	if (oldCommit) oldCommit(vnode, commitQueue);
};

/** @type {(vnode: import('./internal').VNode) => void} */
options.unmount = vnode => {
	if (oldBeforeUnmount) oldBeforeUnmount(vnode);

	const c = vnode._component;
	if (c && c.__hooks) {
		let hasErrored, errorParent;
		c.__hooks._list.some(s => {
			try {
				// Layout cleanups have to run before the new DOM is in place, so
				// they stay in the commit phase (see #1886). Passive cleanups run
				// after paint, before any new passive effect (see #4299), with
				// `_passive` repurposed to hold the error-routing component.
				if (s._passive && s._cleanup) {
					if (errorParent === undefined) {
						errorParent = vnode._parent;
						while (
							errorParent &&
							!(errorParent._component && errorParent._component._parentDom)
						) {
							errorParent = errorParent._parent;
						}
						errorParent = errorParent && errorParent._component;
					}
					s._passive = errorParent;
					afterPaint(unmountCleanups.push(s));
				} else {
					invokeCleanup(s);
				}
			} catch (e) {
				hasErrored = e;
			}
		});
		c.__hooks = undefined;
		if (hasErrored) options._catchError(hasErrored, c._vnode);
	}
};

/**
 * Get the state of the next hook of the currentComponent
 * @param {number} type The type of the hook to get
 * @returns {any}
 */
function getHookState(type) {
	const index = currentIndex++;
	if (options._hook) {
		options._hook(currentComponent, index, currentHook || type);
	}
	currentHook = 0;

	// Largely inspired by:
	// * https://github.com/michael-klein/funcy.js/blob/f6be73468e6ec46b0ff5aa3cc4c9baf72a29025a/src/hooks/core_hooks.mjs
	// * https://github.com/michael-klein/funcy.js/blob/650beaa58c43c33a74820a3c98b3c7079cf2e333/src/renderer.mjs
	// Other implementations to look at:
	// * https://codesandbox.io/s/mnox05qp8
	const hooks =
		currentComponent.__hooks ||
		(currentComponent.__hooks = {
			_list: [],
			_pendingEffects: []
		});

	return hooks._list[index] || (hooks._list[index] = {});
}

/**
 * @template {unknown} S
 * @param {import('./index').Dispatch<import('./index').StateUpdater<S>>} [initialState]
 * @returns {[S, (state: S) => void]}
 */
export function useState(initialState) {
	currentHook = 1;
	return useReducer(invokeOrReturn, initialState);
}

/**
 * @template {unknown} S
 * @template {unknown} A
 * @param {import('./index').Reducer<S, A>} reducer
 * @param {import('./index').Dispatch<import('./index').StateUpdater<S>>} initialState
 * @param {(initialState: any) => void} [init]
 * @returns {[ S, (state: S) => void ]}
 */
export function useReducer(reducer, initialState, init) {
	/** @type {import('./internal').ReducerHookState} */
	const hookState = getHookState(2);
	hookState._reducer = reducer;
	if (!hookState._component) {
		hookState._value = [
			!init ? invokeOrReturn(undefined, initialState) : init(initialState),

			action => {
				const currentValue = (hookState._nextValue || hookState._value)[0];
				const nextValue = hookState._reducer(currentValue, action);

				if (!ObjectIs(currentValue, nextValue)) {
					hookState._nextValue = [nextValue, hookState._value[1]];
					hookState._component.setState({});
				}
			}
		];

		hookState._component = currentComponent;

		if (!currentComponent._hasScuFromHooks) {
			currentComponent._hasScuFromHooks = true;
			const prevScu = currentComponent.shouldComponentUpdate;

			// This SCU has the purpose of bailing out after repeated updates
			// to stateful hooks. We store the next value in `_nextValue[0]` and
			// keep doing that for all state setters; if we have next states and
			// all next states within a component end up being equal to their
			// original state we are safe to bail out for this specific component.
			currentComponent.shouldComponentUpdate = function (p, s, c) {
				const hooks = this.__hooks;
				if (!hooks) return true;

				// We check whether we have components with a nextValue set that
				// have values that aren't equal to one another this pushes
				// us to update further down the tree
				let updatedHook = false;
				let shouldUpdate = this.props != p;
				hooks._list.some(hookItem => {
					if (hookItem._nextValue) {
						updatedHook = true;
						if (!ObjectIs(hookItem._value[0], hookItem._nextValue[0])) {
							shouldUpdate = true;
						}
					}
				});

				if (prevScu) {
					const result = prevScu.call(this, p, s, c);
					return updatedHook ? result || shouldUpdate : result;
				}

				return !updatedHook || shouldUpdate;
			};
		}
	}

	return hookState._value;
}

/**
 * @param {import('./internal').Effect} callback
 * @param {unknown[]} args
 * @returns {void}
 */
export function useEffect(callback, args) {
	/** @type {import('./internal').EffectHookState} */
	const state = getHookState(3);
	if (!options._skipEffects && argsChanged(state._args, args)) {
		state._passive = true;
		state._value = callback;
		state._pendingArgs = args;

		currentComponent.__hooks._pendingEffects.push(state);
	}
}

/**
 * @param {import('./internal').Effect} callback
 * @param {unknown[]} args
 * @returns {void}
 */
export function useLayoutEffect(callback, args) {
	/** @type {import('./internal').EffectHookState} */
	const state = getHookState(4);
	if (!options._skipEffects && argsChanged(state._args, args)) {
		state._passive = false;
		state._value = callback;
		state._pendingArgs = args;

		currentComponent._renderCallbacks.push(state);
	}
}

/** @type {(initialValue: unknown) => unknown} */
export function useRef(initialValue) {
	currentHook = 5;
	return useMemo(() => ({ current: initialValue }), []);
}

/**
 * @param {object} ref
 * @param {() => object} createHandle
 * @param {unknown[]} args
 * @returns {void}
 */
export function useImperativeHandle(ref, createHandle, args) {
	currentHook = 6;
	useLayoutEffect(
		() => {
			if (typeof ref == 'function') {
				const result = ref(createHandle());
				return () => {
					ref(null);
					if (typeof result == 'function') result();
				};
			} else if (ref) {
				ref.current = createHandle();
				return () => (ref.current = null);
			}
		},
		args == null ? args : args.concat(ref)
	);
}

/**
 * @template {unknown} T
 * @param {() => T} factory
 * @param {unknown[]} args
 * @returns {T}
 */
export function useMemo(factory, args) {
	/** @type {import('./internal').MemoHookState<T>} */
	const state = getHookState(7);
	if (argsChanged(state._args, args)) {
		state._value = factory();
		state._args = args;
	}

	return state._value;
}

/**
 * @param {() => void} callback
 * @param {unknown[]} args
 * @returns {() => void}
 */
export function useCallback(callback, args) {
	currentHook = 8;
	return useMemo(() => callback, args);
}

/**
 * @param {import('./internal').PreactContext} context
 */
export function 
```

### Core Architecture Module: `hooks/src/internal.d.ts`
```
import {
	Options as PreactOptions,
	Component as PreactComponent,
	VNode as PreactVNode,
	PreactContext,
	HookType,
	ErrorInfo
} from '../../src/internal';
import { Reducer, StateUpdater } from '.';

export { PreactContext };

export interface Options extends PreactOptions {
	/** Attach a hook that is invoked before a vnode is diffed. */
	_diff?(vnode: VNode): void;
	/** Attach a hook that is invoked before a vnode has rendered. */
	_render?(vnode: VNode): void;
	/** Attach a hook that is invoked after a vnode has rendered. */
	diffed?(vnode: VNode): void;
	/** Attach a hook that is invoked after a tree was mounted or was updated. */
	_commit?(vnode: VNode, commitQueue: Component[]): void;
	/** Attach a hook that is invoked before a hook's state is queried. */
	_hook?(component: Component, index: number, type: HookType): void;
}

// Hook tracking

export interface ComponentHooks {
	/** The list of hooks a component uses */
	_list: HookState[];
	/** List of Effects to be invoked after the next frame is rendered */
	_pendingEffects: EffectHookState[];
}

export interface Component extends Omit<
	PreactComponent<any, any>,
	'_renderCallbacks'
> {
	__hooks?: ComponentHooks;
	_mask?: [number | string, number];
	// Extend to include HookStates
	_renderCallbacks?: Array<HookState | (() => void)>;
	_hasScuFromHooks?: boolean;
}

export interface VNode extends Omit<PreactVNode, '_component'> {
	_mask?: [number | string, number];
	_component?: Component; // Override with our specific Component type
}

export type HookState =
	| EffectHookState
	| MemoHookState
	| ReducerHookState
	| ContextHookState
	| ErrorBoundaryHookState
	| IdHookState;

interface BaseHookState {
	_value?: unknown;
	_nextValue?: unknown;
	_args?: unknown;
	_pendingArgs?: unknown;
	_component?: unknown;
	_cleanup?: unknown;
}

export type Effect = () => void | Cleanup;
export type Cleanup = () => void;

export interface EffectHookState extends BaseHookState {
	_value?: Effect;
	_args?: unknown[];
	_pendingArgs?: unknown[];
	_cleanup?: Cleanup | void;
	/**
	 * Whether this is a passive effect (useEffect), whose unmount cleanup runs
	 * after paint. Once unmounted it holds the surviving component that deferred
	 * cleanup errors are routed to instead.
	 */
	_passive?: boolean | Component;
}

export interface MemoHookState<T = unknown> extends BaseHookState {
	_value?: T;
	_args?: unknown[];
	_pendingArgs?: unknown[];
}

export interface ReducerHookState<
	S = unknown,
	A = unknown
> extends BaseHookState {
	_nextValue?: [S, StateUpdater<S>];
	_value?: [S, StateUpdater<S>];
	_component?: Component;
	_reducer?: Reducer<S, A>;
}

export interface ContextHookState extends BaseHookState {
	/** Whether this hooks as subscribed to updates yet */
	_value?: boolean;
	_context?: PreactContext;
}

export interface ErrorBoundaryHookState extends BaseHookState {
	_value?: (error: unknown, errorInfo: ErrorInfo) => void;
}

export interface IdHookState extends BaseHookState {
	_value?: string;
}

```

### Core Architecture Module: `jsx-runtime/src/utils.js`
```
const ENCODED_ENTITIES = /["&<]/;

/** @param {string} str */
export function encodeEntities(str) {
	// Skip all work for strings with no entities needing encoding:
	if (!str.length || !ENCODED_ENTITIES.test(str)) return str;

	let last = 0,
		i = 0,
		out = '',
		ch = '';

	// Seek forward in str until the next entity char:
	for (; i < str.length; i++) {
		switch (str.charCodeAt(i)) {
			case 34:
				ch = '&quot;';
				break;
			case 38:
				ch = '&amp;';
				break;
			case 60:
				ch = '&lt;';
				break;
			default:
				continue;
		}
		// Append skipped/buffered characters and the encoded entity:
		if (i != last) out += str.slice(last, i);
		out += ch;
		// Start the next seek/buffer after the entity's offset:
		last = i + 1;
	}
	if (i != last) out += str.slice(last, i);
	return out;
}

```

### Core Architecture Module: `src/render.js`
```
import { EMPTY_OBJ, MODE_HYDRATE, NULL } from './constants';
import { commitRoot, diff } from './diff/index';
import { createVNode, Fragment } from './create-element';
import options from './options';
import { slice } from './util';

/**
 * Render a Preact virtual node into a DOM element
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to render into
 */
export function render(vnode, parentDom) {
	if (options._root) options._root(vnode, parentDom);

	// https://github.com/preactjs/preact/issues/3794
	// https://github.com/preactjs/preact/issues/5118
	if (parentDom.nodeType == 9) {
		parentDom = parentDom.documentElement;
	}

	// @ts-expect-error
	let isHydrating = vnode && vnode._flags & MODE_HYDRATE;

	// To be able to support calling `render()` multiple times on the same
	// DOM node, we need to obtain a reference to the previous tree. We do
	// this by assigning a new `_children` property to DOM nodes which points
	// to the last rendered tree. By default this property is not present, which
	// means that we are mounting a new tree for the first time.
	let oldVNode = isHydrating ? NULL : parentDom._children;

	parentDom._children = createVNode(Fragment, { children: [vnode] });

	// List of effects that need to be called after diffing.
	let commitQueue = [],
		refQueue = [];

	diff(
		parentDom,
		// Determine the new vnode tree and store it on the DOM element on
		// our custom `_children` property.
		parentDom._children,
		oldVNode || EMPTY_OBJ,
		EMPTY_OBJ,
		parentDom.namespaceURI,
		oldVNode
			? NULL
			: parentDom.firstChild
				? slice.call(parentDom.childNodes)
				: NULL,
		commitQueue,
		oldVNode ? oldVNode._dom : parentDom.firstChild,
		// @ts-expect-error we are doing a bit-wise operation so it's either 0 or true
		isHydrating,
		refQueue
	);

	// Flush all queued effects
	commitRoot(commitQueue, parentDom._children, refQueue);

	// The live children are tracked on _children after diffing.
	parentDom._children.props.children = NULL;
}

/**
 * Update an existing DOM element with data from a Preact virtual node
 * @param {import('./internal').ComponentChild} vnode The virtual node to render
 * @param {import('./internal').PreactElement} parentDom The DOM element to update
 */
export function hydrate(vnode, parentDom) {
	// Only objects can carry the flag. Primitives (null, strings, numbers,
	// booleans) render into the existing DOM the same way hydrating would.
	if (vnode && typeof vnode == 'object') {
		// @ts-expect-error
		vnode._flags |= MODE_HYDRATE;
	}
	render(vnode, parentDom);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4716** (2025-02-27): **Fragment unmounts when it shouldn't**
  *Symptoms*: - [ ] Check if updating to the latest Preact version resolves the issue  **Describe the bug** After updating to 10.26.2, some Fragments are disappearing during a second render. I think this was caused by #4680.  **To Reproduce**  https://git.sr.ht/~vpzom/fragment-gone-issue  Steps to reproduce the behavior:  1. Open the page 2. Click either of the links 3. Both links disappear  **Expected behavior** Nothing
  **Post-Mortem & Fix Analysis**:
  > This is not a reproduction, can you do this in something like stackblitz.com
  > to clarify, the link is a git repo

- **Issue #4422** (2024-06-28): **[preact/hooks] useMemo keeps recalculating even when the dependency is not changed**
  *Symptoms*: - [ ] Check if updating to the latest Preact version resolves the issue  **Describe the bug** When using the useMemo hook to calculate a value and then using this value to conditionally update the state during render, the app indefinitely re-renders. Something like shown below  ```js const [value, setValue] = useState(false);  const data = useMemo(() => {   return { data: 'some data' }; }, [value]);  const [prevData, setPreviousData] = useState(data);  if (prevData !== data) {   // This causes the infinite loop   setPreviousData(data); } ```  Preact version - 10.21.0  **To Reproduce**  Sandbox - https://codesandbox.io/p/sandbox/usememo-behavior-preact-w3rlrv  Steps to reproduce the behavior:  1. Go to the sandbox and open the console 2. Click on the 'Set to true' button 3. See error (and the console log of the memoized value changes)  After some debugging, it seems like the internalHookState of the useMemo hook is not updated with the new dependency args if a state update happens during the render cycle. And the hook always ends up comparing the dependency array with the very first dependency array. This is resulting in a recalculation of the hook every render and the component re-renders indefinitely.  **Expected behavior** The useMemo hook should remember the last provided dependency array and should only recalculate the value when there is an actual change in the dependency array.  React seems to be handling this case as expected - http

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

### Incident Patch 1: `2d3075ec` (2026-11-21)
**Commit Message**: Revert "Merge pull request #5360 from preactjs/pending-range-hydration"

This reverts commit 7f8004bf47282c37ed4cd38a9354f5a8651f69f2, reversing
changes made to 39310e58924654a9371b5e7e66c278ea53c5b90a.

**File**: `compat/test/browser/suspense-hydration.test.jsx` (modified, +0/-284)
```diff
@@ -2424,288 +2424,4 @@ describe('suspense hydration owning a streamed range', () => {
 		rerender();
 		expect(scratch.innerHTML).to.equal('<main></main>');
 	});
-
-	describe('pending streamed ranges', () => {
-		// A range whose chunk hasn't arrived opens with `$s?` and still holds the
-		// fallback, wrapped in `<?start>`/`<?end>` (comments where the parser has
-		// no processing instructions).
-		const pending = [
-			['processing instructions', '<?start name="1">', '<?end>'],
-			['comments', '<!--?start name="1"-->', '<!--?end-->']
-		];
-
-		pending.forEach(([name, start, end]) => {
-			it(`should not adopt the fallback for content that rendered first (${name})`, () => {
-				scratch.innerHTML = `<div><!--$s?:1-->${start}<p class="fb" data-fallback="1">loading</p>${end}<!--/$s:1--><footer>foot</footer></div>`;
-				const footer = scratch.querySelector('footer');
-				const onClick = vi.fn();
-
-				hydrate(
-					<div>
-						<Suspense fallback={<p class="fb">loading</p>}>
-							<p class="content" onClick={onClick}>
-								content
-							</p>
-						</Suspense>
-						<footer>foot</footer>
-					</div>,
-					scratch
-				);
-				rerender();
-
-				expect(scratch.querySelectorAll('p').length).to.equal(1);
-				expect(scratch.querySelector('p').outerHTML).to.equal(
-					'<p class="content">content</p>'
-				);
-				expect(scratch.querySelector('footer')).to.equal(footer);
-				expect(scratch.querySelector('p').nextElementSibling).to.equal(footer);
-				scratch.querySelector('p').dispatchEvent(createEvent('click'));
-				expect(onClick).toHaveBeenCalledOnce();
-			});
-
-			it(`should not adopt the fallback when the client resolves before the chunk (${name})`, async () => {
-				scratch.innerHTML = `<div><!--$s?:1-->${start}<p class="fb">loading</p>${end}<!--/$s:1--><footer>foot</footer></div>`;
-				const footer = scratch.querySelector('footer');
-				const [Lazy, resolve] = createLazy();
-
-				hydrate(
-					<div>
-						<Suspense fallback={<p class="fb">loading</p>}>
-							<Lazy />
-						</Suspense>
-						<footer>foot</footer>
-					</div>,
-					scratch
-				);
-				rerender();
-				expect(scratch.querySelector('p').className).to.equal('fb');
-
-				await resolve(() => <p class="content">content</p>);
-				rerender();
-
-				expect(scratch.querySelectorAll('p').length).to.equal(1);
-				expect(scratch.querySelector('p').outerHTML).to.equal(
-					'<p class="content">content</p>'
-				);
-				expect(scratch.querySelector('p').nextElementSibling).to.equal(footer);
-			});
-		});
-
-		it('should not adopt fallback text', () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"-->loading<!--?end--><!--/$s:1--></div>';
-
-			hydrate(
-				<div>
-					<Suspense fallback="loading">content</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(scratch.textContent).to.equal('content');
-		});
-
-		it('should still adopt the content of a range that was patched', () => {
-			scratch.innerHTML =
-				'<div><!--$s:1--><p class="content">content</p><!--/$s:1--></div>';
-			const p = scratch.querySelector('p');
-			clearLog();
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<p class="content">content</p>
-					</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(scratch.querySelector('p')).to.equal(p);
-			expect(getLog()).to.deep.equal([]);
-		});
-
-		it('should mount every node of content that outnumbers the fallback', () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"--><p class="fb">loading</p><!--?end--><!--/$s:1--><p class="after">after</p></div>';
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<p class="a">a</p>
-						<p class="b">b</p>
-					</Suspense>
-					<p class="after">after</p>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(
-				[...scratch.querySelectorAll('p')].map(p => p.outerHTML)
-			).to.deep.equal([
-				'<p class="a">a</p>',
-				'<p class="b">b</p>',
-				'<p class="after">after</p>'
-			]);
-		});
-
-		it('should hydrate the chunk that arrives while the client is suspended', async () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"--><p class="fb">loading</p><!--?end--><!--/$s:1--></div>';
-			const [Lazy, resolve] = createLazy();
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<Lazy />
-					</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			// what the stream's patch does to the range
-			const start = scratch.firstChild.firstChild;
-			start.data = '$s:1';
-			while (start.nextSibling.data != '/$s:1') start.nextSibling.remove();
-			start.after(
-				Object.assign(document.createElement('p'), {
-					className: 'content',
-					textContent: 'content'
-				})
-			);
-			const p = scratch.querySelector('p');
-			clearLog();
-
-			await resolve(() => <p class="content">content</p>);
-			rerender();
-
-			expect(scratch.quer
```

**File**: `src/diff/index.js` (modified, +18/-44)
```diff
@@ -68,9 +68,6 @@ export function diff(
 ) {
 	/** @type {any} */
 	let tmp,
-		// The closing marker of the range a boundary takes over, then what
-		// followed it
-		rangeNext,
 		resumed,
 		newType = newVNode.type;
 
@@ -79,35 +76,23 @@ export function diff(
 
 	// If the previous diff bailed out, resume creating/hydrating into the DOM
 	// that was kept while suspended (server-rendered, or already in the
-	// container we rendered into).
+	// container we rendered into). `tmp` holds the stored excess node until the
+	// options._diff call below.
 	if (
 		oldVNode._flags & MODE_SUSPENDED &&
 		// @ts-expect-error This is MODE_HYDRATE or 0
 		((isHydrating = oldVNode._flags & MODE_HYDRATE),
 		(tmp = oldVNode._component._excess))
 	) {
 		newVNode._flags |= isHydrating;
-		// Re-scan DOM from stored start marker for streamed hydration.
-		tmp = rangeEnd(tmp, (resumed = excessDomChildren = []));
-		oldDom = excessDomChildren[0];
-		// The closing marker stays until unmount.
-		if (tmp) excessDomChildren.pop();
-	} else if (
-		isHydrating &&
-		newType &&
-		(tmp = newType.prototype) &&
-		tmp._childDidSuspend &&
-		(rangeNext = rangeEnd(oldDom, (tmp = [oldDom]))) &&
-		tmp._excess
-	) {
-		// A boundary in front of a range that holds a fallback, because the
-		// server is still streaming it or gave up on it (`$s!`): its children
-		// only get that range, and diff the attributes of what they adopt.
-		rangeNext = rangeNext.nextSibling;
-		tmp.some(node => {
-			excessDomChildren[excessDomChildren.indexOf(node)] = NULL;
-		});
-		resumed = excessDomChildren = tmp;
+		resumed = excessDomChildren = [];
+		if (tmp.nodeType == 8) {
+			// Re-scan DOM from stored start marker for streamed hydration.
+			oldDom = rangeEnd(tmp, excessDomChildren);
+		} else {
+			excessDomChildren.push(tmp);
+		}
+		oldDom = excessDomChildren[0] || oldDom;
 	}
 
 	if ((tmp = options._diff)) tmp(newVNode);
@@ -356,8 +341,6 @@ export function diff(
 
 			// Remove the kept DOM this resumed render didn't claim
 			if (resumed) resumed.some(removeNode);
-			// The markers the cursor stopped at go with a range a boundary took
-			if (resumed && rangeNext !== UNDEFINED) oldDom = rangeNext;
 
 			if (c._renderCallbacks.length) {
 				commitQueue.push(c);
@@ -462,26 +445,20 @@ export function diff(
 /**
  * Find the closing marker of a streamed range.
  * @param {PreactElement} start A `$s` marker opening a range
- * @param {PreactElement[]} [nodes] Collects the nodes after `start` up to and
- * including the closing marker, or `start` itself when it isn't a comment. For
- * a comment its `_excess` tells whether the range holds a fallback (`$s?`,
- * `$s!`).
+ * @param {PreactElement[]} [nodes] Collects the nodes inside the range
  * @returns {PreactElement} The closing marker, or undefined when `start` doesn't
  * open a range or the range is unclosed
  */
 function rangeEnd(start, nodes) {
-	if (start && start.nodeType == 8) {
-		if (nodes) nodes._excess = start.data[2] && start.data[2] != ':';
-		if (start.data.startsWith('$s')) {
-			for (let depth = 1; (start = start.nextSibling); ) {
-				if (nodes) nodes.push(start);
-				if (start.nodeType == 8) {
-					if (start.data.startsWith('$s')) depth++;
-					else if (start.data.startsWith('/$s') && !--depth) return start;
-				}
+	if (start && start.nodeType == 8 && start.data.startsWith('$s')) {
+		for (let depth = 1; (start = start.nextSibling); ) {
+			if (start.nodeType == 8) {
+				if (start.data.startsWith('$s')) depth++;
+				else if (start.data.startsWith('/$s') && !--depth) return start;
 			}
+			if (nodes) nodes.push(start);
 		}
-	} else if (nodes) nodes.push(start);
+	}
 }
 
 function markAsForce(vnode) {
@@ -569,9 +546,6 @@ function diffElementNodes(
 	else if (!namespace) namespace = XHTML_NAMESPACE;
 
 	if (excessDomChildren) {
-		// DOM that held a fallback isn't what we render: diff its attributes too
-		if (excessDomChildren._excess) isHydrating = false;
-
 		for (i = 0; i < excessDomChildren.length; i++) {
 			value = excessDomChildren[i];
 
```

---

### Incident Patch 2: `1fbc07f6` (2026-11-21)
**Commit Message**: Merge pull request #5402 from preactjs/fix/suspense-scoped-use-id

Give each Suspense boundary its own useId counter

**File**: `compat/src/internal.d.ts` (modified, +1/-0)
```diff
@@ -38,4 +38,5 @@ export interface SuspenseComponent extends PreactComponent<
 	_pendingSuspensionCount: number;
 	_suspenders: Component[];
 	_detachOnNextRender: null | VNode<any>;
+	_mask?: [string, number];
 }
```

**File**: `compat/src/suspense.js` (modified, +5/-0)
```diff
@@ -6,6 +6,7 @@ import {
 	UNDEFINED,
 	VNODE_MARKER
 } from '../../src/constants';
+import { useId } from 'preact/hooks';
 import { assign } from './util';
 
 function initSuspenseHooks() {
@@ -212,6 +213,10 @@ function createSuspense() {
 	 * @param {import('./internal').SuspenseState} state
 	 */
 	Suspense.prototype.render = function (props, state) {
+		// Ids inside a boundary come from its own counter, so they don't depend
+		// on when it resolves on the server or hydrates on the client.
+		this._mask || (this._mask = [useId(), 0]);
+
 		if (this._detachOnNextRender) {
 			// When the Suspense's _vnode was created by a call to createVNode
 			// (i.e. due to a setState further up in the tree)
```

**File**: `compat/test/browser/suspense-hydration.test.jsx` (modified, +24/-0)
```diff
@@ -7,6 +7,7 @@ import React, {
 	Suspense,
 	use,
 	memo,
+	useId,
 	useState,
 	useSyncExternalStore,
 	createPortal
@@ -2055,6 +2056,29 @@ describe('suspense hydration', () => {
 			expect(scratch.innerHTML).to.equal('<p>a</p><p>b</p>');
 		});
 	});
+
+	it('should give ids inside a boundary the same value whenever it resolves', async () => {
+		const Id = () => <input id={useId()} />;
+		const [Lazy, resolve] = createLazy();
+		const App = ({ Inner }) => (
+			<Fragment>
+				<Id />
+				<Suspense fallback={<i>f</i>}>
+					<Inner />
+				</Suspense>
+				<Id />
+			</Fragment>
+		);
+		const ids = el => [...el.querySelectorAll('input')].map(i => i.id);
+
+		const other = document.createElement('div');
+		render(<App Inner={Id} />, other);
+
+		render(<App Inner={Lazy} />, scratch);
+		await resolve(Id);
+		rerender();
+		expect(ids(scratch)).to.deep.equal(ids(other));
+	});
 });
 
 describe('suspense hydration resuming into mismatched server DOM', () => {
```

**File**: `hooks/src/index.js` (modified, +4/-5)
```diff
@@ -401,15 +401,14 @@ export function useId() {
 	/** @type {import('./internal').IdHookState} */
 	const state = getHookState(11);
 	if (!state._value) {
-		// Grab either the root node or the nearest async boundary node.
+		// Grab either the root node or the nearest Suspense boundary. Both keep
+		// their mask on the component: their vnodes get replaced, it doesn't.
 		/** @type {import('./internal').VNode | import('./internal').Component} */
 		let root = currentComponent._vnode;
-		while (!root._mask && root._parent) {
+		while (!(root._component || root)._mask && root._parent) {
 			root = root._parent;
 		}
-
-		// The root vnode is replaced on every `render()`, its component isn't.
-		if (!root._mask && root._component) root = root._component;
+		root = root._component || root;
 
 		let mask = root._mask || (root._mask = [0, 0]);
 		state._value = 'P' + mask[0] + '-' + mask[1]++;
```

**File**: `hooks/src/internal.d.ts` (modified, +2/-2)
```diff
@@ -37,14 +37,14 @@ export interface Component extends Omit<
 	'_renderCallbacks'
 > {
 	__hooks?: ComponentHooks;
-	_mask?: [number, number];
+	_mask?: [number | string, number];
 	// Extend to include HookStates
 	_renderCallbacks?: Array<HookState | (() => void)>;
 	_hasScuFromHooks?: boolean;
 }
 
 export interface VNode extends Omit<PreactVNode, '_component'> {
-	_mask?: [number, number];
+	_mask?: [number | string, number];
 	_component?: Component; // Override with our specific Component type
 }
 
```

---

### Incident Patch 3: `0233fc27` (2026-11-21)
**Commit Message**: Merge branch 'main' into fix/suspense-scoped-use-id

**File**: `compat/src/index.d.ts` (modified, +12/-5)
```diff
@@ -125,15 +125,15 @@ declare namespace React {
 	// React 18 hooks
 	export import useInsertionEffect = _hooks.useLayoutEffect;
 	export function useTransition(): [false, typeof startTransition];
-	export function useDeferredValue<T = any>(val: T): T;
+	export function useDeferredValue<T = any>(val: T, initialValue?: T): T;
 	export function useSyncExternalStore<T>(
 		subscribe: (flush: () => void) => () => void,
 		getSnapshot: () => T,
 		getServerSnapshot?: () => T
 	): T;
 	export function useEffectEvent<T extends Function>(cb: T): T;
 	// React 19 hooks
-	export function use<T>(resource: Promise<T> | _preact.Context<T>): T;
+	export function use<T>(resource: PromiseLike<T> | _preact.Context<T>): T;
 
 	// Preact Defaults
 	export import Context = _preact.Context;
@@ -246,6 +246,7 @@ declare namespace React {
 
 	// Events
 	export import TargetedEvent = _preact.TargetedEvent;
+	export import SyntheticEvent = _preact.TargetedEvent;
 	export import ChangeEvent = _preact.TargetedEvent;
 	export import ClipboardEvent = _preact.TargetedClipboardEvent;
 	export import CompositionEvent = _preact.TargetedCompositionEvent;
@@ -256,8 +257,10 @@ declare namespace React {
 	export import InvalidEvent = _preact.TargetedEvent;
 	export import KeyboardEvent = _preact.TargetedKeyboardEvent;
 	export import MouseEvent = _preact.TargetedMouseEvent;
+	export import ToggleEvent = _preact.TargetedToggleEvent;
 	export import TouchEvent = _preact.TargetedTouchEvent;
 	export import UIEvent = _preact.TargetedUIEvent;
+	export import WheelEvent = _preact.TargetedWheelEvent;
 	export import AnimationEvent = _preact.TargetedAnimationEvent;
 	export import TransitionEvent = _preact.TargetedTransitionEvent;
 
@@ -270,11 +273,15 @@ declare namespace React {
 	export import PointerEventHandler = _preact.PointerEventHandler;
 	export import FocusEventHandler = _preact.FocusEventHandler;
 	export import FormEventHandler = _preact.GenericEventHandler;
+	export import InputEventHandler = _preact.InputEventHandler;
 	export import InvalidEventHandler = _preact.GenericEventHandler;
 	export import KeyboardEventHandler = _preact.KeyboardEventHandler;
 	export import MouseEventHandler = _preact.MouseEventHandler;
+	export import SubmitEventHandler = _preact.SubmitEventHandler;
+	export import ToggleEventHandler = _preact.ToggleEventHandler;
 	export import TouchEventHandler = _preact.TouchEventHandler;
 	export import UIEventHandler = _preact.UIEventHandler;
+	export import WheelEventHandler = _preact.WheelEventHandler;
 	export import AnimationEventHandler = _preact.AnimationEventHandler;
 	export import TransitionEventHandler = _preact.TransitionEventHandler;
 
@@ -310,7 +317,7 @@ declare namespace React {
 	export function isFragment(element: any): boolean;
 	export function isMemo(element: any): boolean;
 	export function findDOMNode(
-		component: _preact.Component | Element
+		component: _preact.Component | Element | null | undefined
 	): Element | null;
 
 	export abstract class PureComponent<
@@ -411,12 +418,12 @@ declare namespace React {
 
 	export const Children: {
 		map<T extends _preact.ComponentChild, R>(
-			children: T | T[],
+			children: T | readonly T[],
 			fn: (child: T, i: number) => R,
 			context?: any
 		): R[];
 		forEach<T extends _preact.ComponentChild>(
-			children: T | T[],
+			children: T | readonly T[],
 			fn: (child: T, i: number) => void,
 			context?: any
 		): void;
```

**File**: `compat/test/browser/suspense-hydration.test.jsx` (modified, +0/-284)
```diff
@@ -2448,288 +2448,4 @@ describe('suspense hydration owning a streamed range', () => {
 		rerender();
 		expect(scratch.innerHTML).to.equal('<main></main>');
 	});
-
-	describe('pending streamed ranges', () => {
-		// A range whose chunk hasn't arrived opens with `$s?` and still holds the
-		// fallback, wrapped in `<?start>`/`<?end>` (comments where the parser has
-		// no processing instructions).
-		const pending = [
-			['processing instructions', '<?start name="1">', '<?end>'],
-			['comments', '<!--?start name="1"-->', '<!--?end-->']
-		];
-
-		pending.forEach(([name, start, end]) => {
-			it(`should not adopt the fallback for content that rendered first (${name})`, () => {
-				scratch.innerHTML = `<div><!--$s?:1-->${start}<p class="fb" data-fallback="1">loading</p>${end}<!--/$s:1--><footer>foot</footer></div>`;
-				const footer = scratch.querySelector('footer');
-				const onClick = vi.fn();
-
-				hydrate(
-					<div>
-						<Suspense fallback={<p class="fb">loading</p>}>
-							<p class="content" onClick={onClick}>
-								content
-							</p>
-						</Suspense>
-						<footer>foot</footer>
-					</div>,
-					scratch
-				);
-				rerender();
-
-				expect(scratch.querySelectorAll('p').length).to.equal(1);
-				expect(scratch.querySelector('p').outerHTML).to.equal(
-					'<p class="content">content</p>'
-				);
-				expect(scratch.querySelector('footer')).to.equal(footer);
-				expect(scratch.querySelector('p').nextElementSibling).to.equal(footer);
-				scratch.querySelector('p').dispatchEvent(createEvent('click'));
-				expect(onClick).toHaveBeenCalledOnce();
-			});
-
-			it(`should not adopt the fallback when the client resolves before the chunk (${name})`, async () => {
-				scratch.innerHTML = `<div><!--$s?:1-->${start}<p class="fb">loading</p>${end}<!--/$s:1--><footer>foot</footer></div>`;
-				const footer = scratch.querySelector('footer');
-				const [Lazy, resolve] = createLazy();
-
-				hydrate(
-					<div>
-						<Suspense fallback={<p class="fb">loading</p>}>
-							<Lazy />
-						</Suspense>
-						<footer>foot</footer>
-					</div>,
-					scratch
-				);
-				rerender();
-				expect(scratch.querySelector('p').className).to.equal('fb');
-
-				await resolve(() => <p class="content">content</p>);
-				rerender();
-
-				expect(scratch.querySelectorAll('p').length).to.equal(1);
-				expect(scratch.querySelector('p').outerHTML).to.equal(
-					'<p class="content">content</p>'
-				);
-				expect(scratch.querySelector('p').nextElementSibling).to.equal(footer);
-			});
-		});
-
-		it('should not adopt fallback text', () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"-->loading<!--?end--><!--/$s:1--></div>';
-
-			hydrate(
-				<div>
-					<Suspense fallback="loading">content</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(scratch.textContent).to.equal('content');
-		});
-
-		it('should still adopt the content of a range that was patched', () => {
-			scratch.innerHTML =
-				'<div><!--$s:1--><p class="content">content</p><!--/$s:1--></div>';
-			const p = scratch.querySelector('p');
-			clearLog();
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<p class="content">content</p>
-					</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(scratch.querySelector('p')).to.equal(p);
-			expect(getLog()).to.deep.equal([]);
-		});
-
-		it('should mount every node of content that outnumbers the fallback', () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"--><p class="fb">loading</p><!--?end--><!--/$s:1--><p class="after">after</p></div>';
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<p class="a">a</p>
-						<p class="b">b</p>
-					</Suspense>
-					<p class="after">after</p>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			expect(
-				[...scratch.querySelectorAll('p')].map(p => p.outerHTML)
-			).to.deep.equal([
-				'<p class="a">a</p>',
-				'<p class="b">b</p>',
-				'<p class="after">after</p>'
-			]);
-		});
-
-		it('should hydrate the chunk that arrives while the client is suspended', async () => {
-			scratch.innerHTML =
-				'<div><!--$s?:1--><!--?start name="1"--><p class="fb">loading</p><!--?end--><!--/$s:1--></div>';
-			const [Lazy, resolve] = createLazy();
-
-			hydrate(
-				<div>
-					<Suspense fallback={<p class="fb">loading</p>}>
-						<Lazy />
-					</Suspense>
-				</div>,
-				scratch
-			);
-			rerender();
-
-			// what the stream's patch does to the range
-			const start = scratch.firstChild.firstChild;
-			start.data = '$s:1';
-			while (start.nextSibling.data != '/$s:1') start.nextSibling.remove();
-			start.after(
-				Object.assign(document.createElement('p'), {
-					className: 'content',
-					textContent: 'content'
-				})
-			);
-			const p = scratch.querySelector('p');
-			clearLog();
-
-			await resolve(() => <p class="content">content</p>);
-			rerender();
-
-			expect(scratch.quer
```

**File**: `hooks/src/index.d.ts` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ type CreateHandle = () => object;
  * @param inputs If present, effect will only activate if the values in the list change (using ===).
  */
 export function useImperativeHandle<T, R extends T>(
-	ref: Ref<T>,
+	ref: Ref<T> | undefined,
 	create: () => R,
 	inputs?: Inputs
 ): void;
```

**File**: `src/diff/index.js` (modified, +18/-44)
```diff
@@ -68,9 +68,6 @@ export function diff(
 ) {
 	/** @type {any} */
 	let tmp,
-		// The closing marker of the range a boundary takes over, then what
-		// followed it
-		rangeNext,
 		resumed,
 		newType = newVNode.type;
 
@@ -79,35 +76,23 @@ export function diff(
 
 	// If the previous diff bailed out, resume creating/hydrating into the DOM
 	// that was kept while suspended (server-rendered, or already in the
-	// container we rendered into).
+	// container we rendered into). `tmp` holds the stored excess node until the
+	// options._diff call below.
 	if (
 		oldVNode._flags & MODE_SUSPENDED &&
 		// @ts-expect-error This is MODE_HYDRATE or 0
 		((isHydrating = oldVNode._flags & MODE_HYDRATE),
 		(tmp = oldVNode._component._excess))
 	) {
 		newVNode._flags |= isHydrating;
-		// Re-scan DOM from stored start marker for streamed hydration.
-		tmp = rangeEnd(tmp, (resumed = excessDomChildren = []));
-		oldDom = excessDomChildren[0];
-		// The closing marker stays until unmount.
-		if (tmp) excessDomChildren.pop();
-	} else if (
-		isHydrating &&
-		newType &&
-		(tmp = newType.prototype) &&
-		tmp._childDidSuspend &&
-		(rangeNext = rangeEnd(oldDom, (tmp = [oldDom]))) &&
-		tmp._excess
-	) {
-		// A boundary in front of a range that holds a fallback, because the
-		// server is still streaming it or gave up on it (`$s!`): its children
-		// only get that range, and diff the attributes of what they adopt.
-		rangeNext = rangeNext.nextSibling;
-		tmp.some(node => {
-			excessDomChildren[excessDomChildren.indexOf(node)] = NULL;
-		});
-		resumed = excessDomChildren = tmp;
+		resumed = excessDomChildren = [];
+		if (tmp.nodeType == 8) {
+			// Re-scan DOM from stored start marker for streamed hydration.
+			oldDom = rangeEnd(tmp, excessDomChildren);
+		} else {
+			excessDomChildren.push(tmp);
+		}
+		oldDom = excessDomChildren[0] || oldDom;
 	}
 
 	if ((tmp = options._diff)) tmp(newVNode);
@@ -356,8 +341,6 @@ export function diff(
 
 			// Remove the kept DOM this resumed render didn't claim
 			if (resumed) resumed.some(removeNode);
-			// The markers the cursor stopped at go with a range a boundary took
-			if (resumed && rangeNext !== UNDEFINED) oldDom = rangeNext;
 
 			if (c._renderCallbacks.length) {
 				commitQueue.push(c);
@@ -462,26 +445,20 @@ export function diff(
 /**
  * Find the closing marker of a streamed range.
  * @param {PreactElement} start A `$s` marker opening a range
- * @param {PreactElement[]} [nodes] Collects the nodes after `start` up to and
- * including the closing marker, or `start` itself when it isn't a comment. For
- * a comment its `_excess` tells whether the range holds a fallback (`$s?`,
- * `$s!`).
+ * @param {PreactElement[]} [nodes] Collects the nodes inside the range
  * @returns {PreactElement} The closing marker, or undefined when `start` doesn't
  * open a range or the range is unclosed
  */
 function rangeEnd(start, nodes) {
-	if (start && start.nodeType == 8) {
-		if (nodes) nodes._excess = start.data[2] && start.data[2] != ':';
-		if (start.data.startsWith('$s')) {
-			for (let depth = 1; (start = start.nextSibling); ) {
-				if (nodes) nodes.push(start);
-				if (start.nodeType == 8) {
-					if (start.data.startsWith('$s')) depth++;
-					else if (start.data.startsWith('/$s') && !--depth) return start;
-				}
+	if (start && start.nodeType == 8 && start.data.startsWith('$s')) {
+		for (let depth = 1; (start = start.nextSibling); ) {
+			if (start.nodeType == 8) {
+				if (start.data.startsWith('$s')) depth++;
+				else if (start.data.startsWith('/$s') && !--depth) return start;
 			}
+			if (nodes) nodes.push(start);
 		}
-	} else if (nodes) nodes.push(start);
+	}
 }
 
 function markAsForce(vnode) {
@@ -569,9 +546,6 @@ function diffElementNodes(
 	else if (!namespace) namespace = XHTML_NAMESPACE;
 
 	if (excessDomChildren) {
-		// DOM that held a fallback isn't what we render: diff its attributes too
-		if (excessDomChildren._excess) isHydrating = false;
-
 		for (i = 0; i < excessDomChildren.length; i++) {
 			value = excessDomChildren[i];
 
```

**File**: `src/dom.d.ts` (modified, +68/-1)
```diff
@@ -51,6 +51,23 @@ interface SnapEventInit extends EventInit {
 	snapTargetInline?: Element | null;
 }
 
+/** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/ContentVisibilityAutoStateChangeEvent) */
+interface ContentVisibilityAutoStateChangeEvent extends Event {
+	readonly skipped: boolean;
+}
+
+declare var ContentVisibilityAutoStateChangeEvent: {
+	prototype: ContentVisibilityAutoStateChangeEvent;
+	new (
+		type: string,
+		eventInitDict?: ContentVisibilityAutoStateChangeEventInit
+	): ContentVisibilityAutoStateChangeEvent;
+};
+
+interface ContentVisibilityAutoStateChangeEventInit extends EventInit {
+	skipped?: boolean;
+}
+
 type Booleanish = boolean | 'true' | 'false';
 
 export interface SignalLike<T> {
@@ -516,6 +533,11 @@ export type TargetedSnapEvent<Target extends EventTarget> = TargetedEvent<
 	Target,
 	SnapEvent
 >;
+export type TargetedContentVisibilityAutoStateChangeEvent<
+	Target extends EventTarget
+> = TargetedEvent<Target, ContentVisibilityAutoStateChangeEvent>;
+export type TargetedSecurityPolicyViolationEvent<Target extends EventTarget> =
+	TargetedEvent<Target, SecurityPolicyViolationEvent>;
 export type TargetedSubmitEvent<Target extends EventTarget> = TargetedEvent<
 	Target,
 	SubmitEvent
@@ -559,6 +581,9 @@ export type CommandEventHandler<Target extends EventTarget> = EventHandler<
 export type CompositionEventHandler<Target extends EventTarget> = EventHandler<
 	TargetedCompositionEvent<Target>
 >;
+export type ContentVisibilityAutoStateChangeEventHandler<
+	Target extends EventTarget
+> = EventHandler<TargetedContentVisibilityAutoStateChangeEvent<Target>>;
 export type DragEventHandler<Target extends EventTarget> = EventHandler<
 	TargetedDragEvent<Target>
 >;
@@ -583,6 +608,8 @@ export type MouseEventHandler<Target extends EventTarget> = EventHandler<
 export type PointerEventHandler<Target extends EventTarget> = EventHandler<
 	TargetedPointerEvent<Target>
 >;
+export type SecurityPolicyViolationEventHandler<Target extends EventTarget> =
+	EventHandler<TargetedSecurityPolicyViolationEvent<Target>>;
 export type SnapEventHandler<Target extends EventTarget> = EventHandler<
 	TargetedSnapEvent<Target>
 >;
@@ -607,6 +634,23 @@ export type PictureInPictureEventHandler<Target extends EventTarget> =
 export interface DOMAttributes<
 	Target extends EventTarget
 > extends PreactDOMAttributes {
+	onFullscreenChange?: GenericEventHandler<Target> | undefined;
+	onFullscreenChangeCapture?: GenericEventHandler<Target> | undefined;
+	onFullscreenError?: GenericEventHandler<Target> | undefined;
+	onFullscreenErrorCapture?: GenericEventHandler<Target> | undefined;
+	onContentVisibilityAutoStateChange?:
+		| ContentVisibilityAutoStateChangeEventHandler<Target>
+		| undefined;
+	onContentVisibilityAutoStateChangeCapture?:
+		| ContentVisibilityAutoStateChangeEventHandler<Target>
+		| undefined;
+	onSecurityPolicyViolation?:
+		| SecurityPolicyViolationEventHandler<Target>
+		| undefined;
+	onSecurityPolicyViolationCapture?:
+		| SecurityPolicyViolationEventHandler<Target>
+		| undefined;
+
 	// Image Events
 	onLoad?: GenericEventHandler<Target> | undefined;
 	onLoadCapture?: GenericEventHandler<Target> | undefined;
@@ -635,6 +679,10 @@ export interface DOMAttributes<
 	onToggle?: ToggleEventHandler<Target> | undefined;
 	onToggleCapture?: ToggleEventHandler<Target> | undefined;
 
+	// Hidden-until-found Events
+	onBeforeMatch?: GenericEventHandler<Target> | undefined;
+	onBeforeMatchCapture?: GenericEventHandler<Target> | undefined;
+
 	// Dialog Events
 	onClose?: GenericEventHandler<Target> | undefined;
 	onCloseCapture?: GenericEventHandler<Target> | undefined;
@@ -769,6 +817,10 @@ export interface DOMAttributes<
 	// Selection Events
 	onSelect?: GenericEventHandler<Target> | undefined;
 	onSelectCapture?: GenericEventHandler<Target> | undefined;
+	onSelectStart?: GenericEventHandler<Target> | undefined;
+	onSelectStartCapture?: GenericEventHandler<Target> | undefined;
+	onSelectionChange?: GenericEventHandler<Target> | undefined;
+	onSelectionChangeCapture?: GenericEventHandler<Target> | undefined;
 
 	// Touch Events
 	onTouchCancel?: TouchEventHandler<Target> | undefined;
@@ -801,6 +853,8 @@ export interface DOMAttributes<
 	onGotPointerCaptureCapture?: PointerEventHandler<Target> | undefined;
 	onLostPointerCapture?: PointerEventHandler<Target> | undefined;
 	onLostPointerCaptureCapture?: PointerEventHandler<Target> | undefined;
+	onPointerRawUpdate?: PointerEventHandler<Target> | undefined;
+	onPointerRawUpdateCapture?: PointerEventHandler<Target> | undefined;
 
 	// Scroll Events
 	onScroll?: GenericEventHandler<Target> | undefined;
@@ -817,6 +871,8 @@ export interface DOMAttributes<
 	onWheelCapture?: WheelEventHandler<Target> | undefined;
 
 	// Animation Events
+	onAnimationCancel?: AnimationEventHandler<Target> | undefined;
+	onAnimationCancelCapture?: AnimationEventHandler<Target> | undefined;
 	onAnimationStart?: AnimationEventHandler<Target> | undefined;
 
```

#### Recent Merged Pull Requests:
- **PR #5405** (closed): Clear stale parent links on replaced VNodes (@k0d3r1s)
- **PR #5404** (closed): Clear _parent of a matched child once it is replaced (#5403) (@tony1233200)
- **PR #5402** (2026-11-21): Give each Suspense boundary its own useId counter (@JoviDeCroock)
- **PR #5400** (2026-11-21): Revert DPU streaming (@JoviDeCroock)
- **PR #5399** (closed): Don't claim past a streamed range for a component that suspends while hydrating (@JoviDeCroock)
- **PR #5398** (closed): fix(types): accept undefined ref in useImperativeHandle (@ragib-mrb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
