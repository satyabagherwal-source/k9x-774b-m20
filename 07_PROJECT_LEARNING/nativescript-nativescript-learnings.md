# Forensic Learning Record (Deep Inspection): NativeScript/NativeScript

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativescript-nativescript-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NativeScript/NativeScript](https://github.com/NativeScript/NativeScript))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:51.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NativeScript/NativeScript`
- **Description**: ⚡ Write Native with TypeScript ✨ Best of all worlds (TypeScript, Swift, Objective C, Kotlin, Java, Dart). Use what you love ❤️ Angular, React, Solid, Svelte, Vue with: iOS (UIKit, SwiftUI), Android (View, Jetpack Compose), Flutter and you name it compatible.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25665 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/automated/src/http/http-string-worker.ts`
```
postMessage('stub');

// todo: figure out why this worker is including the whole core and not just the Http module
// ie. tree-shaking is not working as expected here. (same setup works in a separate app)
//
// import { getString } from '@nativescript/core/http';
//
// getString('https://http-echo.nativescript.org/get').then(
// 	function (r) {
// 		postMessage(r);
// 	},
// 	function (e) {
// 		throw e;
// 	}
// );

```

### Core Architecture Module: `apps/automated/src/ui/lifecycle/pages/button-counter.ts`
```
import * as button from '@nativescript/core/ui/button';
import { colorProperty, backgroundInternalProperty, fontInternalProperty } from '@nativescript/core';

export class Button extends button.Button {
	nativeBackgroundRedraws = 0;
	backgroundInternalSetNativeCount = 0;
	fontInternalSetNativeCount = 0;
	colorSetNativeCount = 0;
	colorPropertyChangeCount = 0;

	constructor() {
		super();
		this.style.on('colorChange', () => this.colorPropertyChangeCount++);
	}

	[backgroundInternalProperty.setNative](value) {
		this.backgroundInternalSetNativeCount++;

		return (super[backgroundInternalProperty.setNative] as any).call(this, value);
	}
	[fontInternalProperty.setNative](value) {
		this.fontInternalSetNativeCount++;

		return (super[fontInternalProperty.setNative] as any).call(this, value);
	}
	_redrawNativeBackground(value: any): void {
		this.nativeBackgroundRedraws++;
		super._redrawNativeBackground(value);
	}
	[colorProperty.setNative](value) {
		this.colorSetNativeCount++;

		return (super[colorProperty.setNative] as any).call(this, value);
	}
}
Button.prototype.recycleNativeView = 'never';

```

### Core Architecture Module: `apps/toolbox/src/pages/ete/lifecycle.ts`
```
import { AndroidOverflowInsetData, CoreTypes, EventData, Frame, GridLayout, Observable, Page, View } from '@nativescript/core';

/** Survives navigation so a second visit can be compared against the first. */
const visits: number[] = [];

class Lifecycle extends Observable {
	private visit: number;

	constructor(private page: Page) {
		super();
		this.visit = visits.push(0) - 1;
		this.set('resetLog', 'not run yet');
		this.set('resetVerdict', '');
		this.publishVisits();

		this.probe.on(View.androidOverflowInsetEvent, this.onInset, this);
		this.page.on(Page.navigatedFromEvent, () => this.probe.off(View.androidOverflowInsetEvent, this.onInset, this));
	}

	get probe(): GridLayout {
		return this.page.getViewById<GridLayout>('probe');
	}

	private onInset(_args: AndroidOverflowInsetData) {
		visits[this.visit]++;
		this.publishVisits();
	}

	private publishVisits() {
		this.set('visitLog', visits.map((count, index) => `visit ${index + 1}: ${count} event(s)`).join('\n'));
		const silent = visits.findIndex((count) => count === 0);
		this.set('visitVerdict', visits.length < 2 ? 'leave and come back to compare visits' : silent === -1 ? 'PASS - the listener survived the native view being recycled' : `FAIL - visit ${silent + 1} received no inset events`);
	}

	/**
	 * none pads the probe by the system bars; going back to ignore has to hand that
	 * padding back, not leave the view stranded on the old gap.
	 */
	runReset = () => {
		const native = () => this.probe.android as android.view.View;
		const log: string[] = [];
		const record = (label: string) => {
			const view = native();
			log.push(`${label.padEnd(12)} ${view.getPaddingLeft()}, ${view.getPaddingTop()}, ${view.getPaddingRight()}, ${view.getPaddingBottom()}`);
			this.set('resetLog', log.join('\n'));
		};

		const step = (edge: CoreTypes.AndroidOverflow, label: string, next: () => void) => {
			this.probe.androidOverflowEdge = edge;
			setTimeout(() => {
				record(label);
				next();
			}, 120);
		};

		this.set('resetVerdict', 'running...');
		step('ignore', 'ignore (a)', () => {
			const baseline = native().getPaddingTop();
			const baselineBottom = native().getPaddingBottom();
			step('none', 'none', () => {
				const padded = native().getPaddingTop() + native().getPaddingBottom();
				step('ignore', 'ignore (b)', () => {
					const top = native().getPaddingTop();
					const bottom = native().getPaddingBottom();
					const problems: string[] = [];
					if (padded === 0) {
						problems.push('none applied no padding at all - no insets to test with?');
					}
					if (top !== baseline || bottom !== baselineBottom) {
						problems.push(`ignore left ${top}/${bottom} behind, baseline was ${baseline}/${baselineBottom}`);
					}
					this.set('resetVerdict', problems.length ? `FAIL: ${problems.join('; ')}` : 'PASS - ignore handed the padding back');
					// Put it back the way the page expects it.
					this.probe.androidOverflowEdge = 'dont-apply';
				});
			});
		});
	};

	back = () => {
		Frame.topmost().goBack();
	};
}

export function navigatingTo(args: EventData) {
	const page = <Page>args.object;
	page.bindingContext = new Lifecycle(page);
}

```

### Core Architecture Module: `packages/core/abortcontroller/abortsignal.ts`
```
import { Observable } from '../data/observable';

// Known Limitation
//   Use `any` because the type of `AbortSignal` in `lib.dom.d.ts` is wrong and
//   to make assignable our `AbortSignal` into that.
//   https://github.com/Microsoft/TSJS-lib-generator/pull/623
type Events = {
	abort: any; // Event & Type<"abort">
};
type EventAttributes = {
	onabort: any; // Event & Type<"abort">
};

/**
 * The signal class.
 * @see https://dom.spec.whatwg.org/#abortsignal
 */
export default class AbortSignal extends Observable {
	/**
	 * AbortSignal cannot be constructed directly.
	 */
	public constructor() {
		super();
	}

	/**
	 * Returns `true` if this `AbortSignal`'s `AbortController` has signaled to abort, and `false` otherwise.
	 */
	public get aborted(): boolean {
		const aborted = abortedFlags.get(this);
		if (typeof aborted !== 'boolean') {
			throw new TypeError(`Expected 'this' to be an 'AbortSignal' object, but got ${this === null ? 'null' : typeof this}`);
		}
		return aborted;
	}
}

/**
 * Create an AbortSignal object.
 */
export function createAbortSignal(): AbortSignal {
	const signal = new AbortSignal();
	abortedFlags.set(signal, false);
	return signal;
}

/**
 * Abort a given signal.
 */
export function abortSignal(signal: AbortSignal): void {
	if (abortedFlags.get(signal) !== false) {
		return;
	}

	abortedFlags.set(signal, true);
	signal.notify({ eventName: 'abort', type: 'abort' });
}

/**
 * Aborted flag for each instances.
 */
const abortedFlags = new WeakMap<AbortSignal, boolean>();

// Properties should be enumerable.
Object.defineProperties(AbortSignal.prototype, {
	aborted: { enumerable: true },
});

// `toString()` should return `"[object AbortSignal]"`
if (typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol') {
	Object.defineProperty(AbortSignal.prototype, Symbol.toStringTag, {
		configurable: true,
		value: 'AbortSignal',
	});
}

```

### Core Architecture Module: `packages/core/abortcontroller/index.ts`
```
import AbortSignal, { abortSignal, createAbortSignal } from './abortsignal';
/**
 * The AbortController.
 * @see https://dom.spec.whatwg.org/#abortcontroller
 */
export default class AbortController {
	/**
	 * Initialize this controller.
	 */
	public constructor() {
		signals.set(this, createAbortSignal());
	}

	/**
	 * Returns the `AbortSignal` object associated with this object.
	 */
	public get signal(): AbortSignal {
		return getSignal(this);
	}

	/**
	 * Abort and signal to any observers that the associated activity is to be aborted.
	 */
	public abort(): void {
		abortSignal(getSignal(this));
	}
}

/**
 * Associated signals.
 */
const signals = new WeakMap<AbortController, AbortSignal>();

/**
 * Get the associated signal of a given controller.
 */
function getSignal(controller: AbortController): AbortSignal {
	const signal = signals.get(controller);
	if (signal == null) {
		throw new TypeError(`Expected 'this' to be an 'AbortController' object, but got ${controller === null ? 'null' : typeof controller}`);
	}
	return signal;
}

// Properties should be enumerable.
Object.defineProperties(AbortController.prototype, {
	signal: { enumerable: true },
	abort: { enumerable: true },
});

if (typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol') {
	Object.defineProperty(AbortController.prototype, Symbol.toStringTag, {
		configurable: true,
		value: 'AbortController',
	});
}

export { AbortController, AbortSignal };

```

### Core Architecture Module: `packages/core/accessibility/accessibility-common.ts`
```
import type { EventData, EventDataValue } from '../data/observable';
import { Observable } from '../data/observable';
import type { View } from '../ui/core/view';
import type { Page } from '../ui/page';

const lastFocusedViewOnPageKeyName = '__lastFocusedViewOnPage';

export const accessibilityBlurEvent = 'accessibilityBlur';
export const accessibilityFocusEvent = 'accessibilityFocus';
export const accessibilityFocusChangedEvent = 'accessibilityFocusChanged';
export const accessibilityPerformEscapeEvent = 'accessibilityPerformEscape';

/**
 * Send notification when accessibility focus state changes.
 * If either receivedFocus or lostFocus is true, 'accessibilityFocusChanged' is send with value true if element received focus
 * If receivedFocus, 'accessibilityFocus' is send
 * if lostFocus, 'accessibilityBlur' is send
 *
 * @param {View} view
 * @param {boolean} receivedFocus
 * @param {boolean} lostFocus
 */
export function notifyAccessibilityFocusState(view: View, receivedFocus: boolean, lostFocus: boolean): void {
	if (!receivedFocus && !lostFocus) {
		return;
	}

	view.notify({
		eventName: accessibilityFocusChangedEvent,
		object: view,
		value: !!receivedFocus,
	} as EventDataValue);

	if (receivedFocus) {
		if (view.page) {
			view.page[lastFocusedViewOnPageKeyName] = new WeakRef(view);
		}

		view.notify({
			eventName: accessibilityFocusEvent,
			object: view,
		} as EventData);
	} else if (lostFocus) {
		view.notify({
			eventName: accessibilityBlurEvent,
			object: view,
		} as EventData);
	}
}

export function getLastFocusedViewOnPage(page: Page): View | null {
	try {
		const lastFocusedViewRef = page[lastFocusedViewOnPageKeyName] as WeakRef<View>;
		if (!lastFocusedViewRef) {
			return null;
		}

		const lastFocusedView = lastFocusedViewRef.deref();
		if (!lastFocusedView) {
			return null;
		}

		if (!lastFocusedView.parent || lastFocusedView.page !== page) {
			return null;
		}

		return lastFocusedView;
	} catch {
		// ignore
	} finally {
		delete page[lastFocusedViewOnPageKeyName];
	}

	return null;
}

export class SharedA11YObservable extends Observable {
	accessibilityServiceEnabled?: boolean;
}

export const AccessibilityServiceEnabledPropName = 'accessibilityServiceEnabled';

export class CommonA11YServiceEnabledObservable extends SharedA11YObservable {
	constructor(sharedA11YObservable: SharedA11YObservable) {
		super();

		const ref = new WeakRef(this);
		let lastValue: boolean;

		function callback() {
			const self = ref?.get();
			if (!self) {
				sharedA11YObservable.off(Observable.propertyChangeEvent, callback);

				return;
			}

			const newValue = !!sharedA11YObservable.accessibilityServiceEnabled;
			if (newValue !== lastValue) {
				self.set(AccessibilityServiceEnabledPropName, newValue);
				lastValue = newValue;
			}
		}

		sharedA11YObservable.on(Observable.propertyChangeEvent, callback);

		this.set(AccessibilityServiceEnabledPropName, !!sharedA11YObservable.accessibilityServiceEnabled);
	}
}

let a11yServiceEnabled: boolean;
export function isA11yEnabled(): boolean {
	if (typeof a11yServiceEnabled === 'boolean') {
		return a11yServiceEnabled;
	}
	return undefined;
}
export function setA11yEnabled(value: boolean): void {
	a11yServiceEnabled = value;
}

export function enforceArray(val: string | string[]): string[] {
	if (Array.isArray(val)) {
		return val;
	}

	if (typeof val === 'string') {
		return val.split(/[, ]/g).filter((v: string) => !!v);
	}

	return [];
}

export const VALID_FONT_SCALES = __APPLE__ // Apple supports a wider number of font scales than Android does.
	? [0.5, 0.7, 0.85, 1, 1.15, 1.3, 1.5, 2, 2.5, 3, 3.5, 4]
	: [0.85, 1, 1.15, 1.3];

export function getClosestValidFontScale(fontScale: number): number {
	fontScale = Number(fontScale) || 1;

	return VALID_FONT_SCALES.sort((a, b) => Math.abs(fontScale - a) - Math.abs(fontScale - b))[0];
}

export enum FontScaleCategory {
	ExtraSmall = 'extra-small',
	Medium = 'medium',
	ExtraLarge = 'extra-large',
}

export const fontScaleExtraSmallCategoryClass = `a11y-fontscale-xs`;
export const fontScaleMediumCategoryClass = `a11y-fontscale-m`;
export const fontScaleExtraLargeCategoryClass = `a11y-fontscale-xl`;

export const fontScaleCategoryClasses = [fontScaleExtraSmallCategoryClass, fontScaleMediumCategoryClass, fontScaleExtraLargeCategoryClass];

export const a11yServiceEnabledClass = `a11y-service-enabled`;
export const a11yServiceDisabledClass = `a11y-service-disabled`;
export const a11yServiceClasses = [a11yServiceEnabledClass, a11yServiceDisabledClass];

let currentFontScale: number = null;
export function setFontScale(scale: number) {
	currentFontScale = scale;
}

export function getFontScale() {
	return currentFontScale;
}

export function getFontScaleCategory(): FontScaleCategory {
	if (__ANDROID__) {
		return FontScaleCategory.Medium;
	}

	if (getFontScale() < 0.85) {
		return FontScaleCategory.ExtraSmall;
	}

	if (getFontScale() > 1.5) {
		return FontScaleCategory.ExtraLarge;
	}

	return FontScaleCategory.Medium;
}

let initAccessibilityCssHelperCallback: () => void;
export function setInitAccessibilityCssHelper(callback: () => void) {
	initAccessibilityCssHelperCallback = callback;
}

export function readyInitAccessibilityCssHelper() {
	if (initAccessibilityCssHelperCallback) {
		initAccessibilityCssHelperCallback();
		initAccessibilityCssHelperCallback = null;
	}
}

let initFontScaleCallback: () => void;
export function setInitFontScale(callback: () => void) {
	initFontScaleCallback = callback;
}

export function readyInitFontScale() {
	if (initFontScaleCallback) {
		initFontScaleCallback();
		initFontScaleCallback = null;
	}
}

let fontScaleCssClasses: Map<number, string>;
export function setFontScaleCssClasses(value: Map<number, string>) {
	fontScaleCssClasses = value;
}

export function getFontScaleCssClasses() {
	return fontScaleCssClasses;
}

let currentFontScaleClass = '';
export function setCurrentFontScaleClass(value: string) {
	currentFontScaleClass = value;
}

export function getCurrentFontScaleClass() {
	return currentFontScaleClass;
}
let currentFontScaleCategory = '';
export function setCurrentFontScaleCategory(value: string) {
	currentFontScaleCategory = value;
}

export function getCurrentFontScaleCategory() {
	return currentFontScaleCategory;
}
let currentA11YServiceClass = '';
export function setCurrentA11YServiceClass(value: string) {
	currentA11YServiceClass = value;
}

export function getCurrentA11YServiceClass() {
	return currentA11YServiceClass;
}

/**
 * Applies the current accessibility state — the a11y service class, the font scale
 * classes and the inherited font scale — to a root view.
 *
 * Runs for every window's root view; the `readyInit*` helpers next to it only wire up
 * the process-wide listeners that keep this state current, and do so once.
 */
export function applyAccessibilityCssToRoot(rootView: View): void {
	if (!rootView) {
		return;
	}

	const a11yServiceClass = getCurrentA11YServiceClass();
	if (a11yServiceClass) {
		rootView.cssClasses.add(a11yServiceClass);
	}

	const fontScaleClass = getCurrentFontScaleClass();
	if (fontScaleClass) {
		rootView.cssClasses.add(fontScaleClass);
	}

	const fontScaleCategoryClass = getCurrentFontScaleCategory();
	if (fontScaleCategoryClass) {
		rootView.cssClasses.add(fontScaleCategoryClass);
	}

	const fontScale = getFontScale();
	if (fontScale) {
		rootView.style.fontScaleInternal = fontScale;
	}
}

export enum AccessibilityTrait {
	/**
	 * The element allows direct touch interaction for VoiceOver users.
	 */
	AllowsDirectInteraction = 'allowsDirectInteraction',

	/**
	 * The element should cause an automatic page turn when VoiceOver finishes reading the text within it.
	 * Note: Requires custom view with accessibilityScroll(...)
	 */
	CausesPageTurn = 'pageTurn',

	/**
	 * The element is not enabled and does not respond to user interaction.
	 */
	NotEnabled = 'disabled',

	/**
	 * The element is currently selected.
	 */
	Selected = 'selected',

	/**
	 * The element frequently updates its label or value.
	 */
	UpdatesFrequently = 'frequentUpdates',
}

export enum AccessibilityRole {
	/**
	 * The element allows continuous adjustment through a range of values.
	 */
	Adjustable = 'adjustable',

	/**
	 * The element should be treated as a button.
	 */
	Button = 'button',

	/**
	 * The element behaves like a Checkbox
	 */
	Checkbox = 'checkbox',

	/**
	 * The element is a header that divides content into sections, such as the title of a navigation bar.
	 */
	Header = 'header',

	/**
	 * The element should be treated as an image.
	 */
	Image = 'image',

	/**
	 * The element should be treated as a image button.
	 */
	ImageButton = 'imageButton',

	/**
	 * The element behaves as a keyboard key.
	 */
	KeyboardKey = 'keyboardKey',

	/**
	 * The element should be treated as a link.
	 */
	Link = 'link',

	/**
	 * The element has no traits.
	 */
	None = 'none',

	/**
	 * The element plays its own sound when activated.
	 */
	PlaysSound = 'plays',

	/**
	 * The element behaves like a ProgressBar
	 */
	ProgressBar = 'progressBar',

	/**
	 * The element behaves like a RadioButton
	 */
	RadioButton = 'radioButton',

	/**
	 * The element should be treated as a search field.
	 */
	Search = 'search',

	/**
	 * The element behaves like a SpinButton
	 */
	SpinButton = 'spinButton',

	/**
	 * The element starts a media session when it is activated.
	 */
	StartsMediaSession = 'startsMedia',

	/**
	 * The element should be treated as static text that cannot change.
	 */
	StaticText = 'text',

	/**
	 * The element provides summary information when the application starts.
	 */
	Summary = 'summary',

	/**
	 * The element behaves like a switch
	 */
	Switch = 'switch',
}

export enum AccessibilityState {
	Selected = 'selected',
	Checked = 'checked',
	Unchecked = 'unchecked',
	Disabled = 'disabled',
}

export enum AccessibilityLiveRegion {
	None = 'none',
	Polite = 'polite',
	Assertive = 'assertive',
}

export enum IOSPostAccessibilityNotificationType {
	Ann
```

### Core Architecture Module: `packages/core/accessibility/accessibility-properties.ts`
```
import { CssProperty, InheritedCssProperty, Property } from '../ui/core/properties';
import type { View } from '../ui/core/view';
import { booleanConverter } from '../ui/core/view-base/utils';
import { Style } from '../ui/styling/style';
import { AccessibilityLiveRegion, AccessibilityRole, AccessibilityState, AccessibilityTrait } from './accessibility-common';

function makePropertyEnumConverter<T>(enumValues) {
	return (value: string): T | null => {
		if (!value || typeof value !== 'string') {
			return null;
		}

		for (const [enumKey, enumValue] of Object.entries<T>(enumValues)) {
			if (typeof enumKey !== 'string') {
				continue;
			}

			if (enumKey === value || `${enumValue}`.toLowerCase() === `${value}`.toLowerCase()) {
				return enumValue;
			}
		}

		return null;
	};
}

export const accessibilityEnabledProperty = new CssProperty<Style, boolean>({
	name: 'accessible',
	cssName: 'a11y-enabled',
	valueConverter: booleanConverter,
});
accessibilityEnabledProperty.register(Style);

export const iosAccessibilityAdjustsFontSizeProperty = new InheritedCssProperty<Style, boolean>({
	defaultValue: false,
	name: 'iosAccessibilityAdjustsFontSize',
	cssName: 'ios-a11y-adjusts-font-size',
	valueConverter: booleanConverter,
});
iosAccessibilityAdjustsFontSizeProperty.register(Style);

export const iosAccessibilityMinFontScaleProperty = new InheritedCssProperty<Style, number>({
	defaultValue: 0,
	name: 'iosAccessibilityMinFontScale',
	cssName: 'ios-a11y-min-font-scale',
	valueConverter: parseFloat,
});
iosAccessibilityMinFontScaleProperty.register(Style);

export const iosAccessibilityMaxFontScaleProperty = new InheritedCssProperty<Style, number>({
	defaultValue: 0,
	name: 'iosAccessibilityMaxFontScale',
	cssName: 'ios-a11y-max-font-scale',
	valueConverter: parseFloat,
});
iosAccessibilityMaxFontScaleProperty.register(Style);

export const accessibilityHiddenProperty = new (__APPLE__ ? InheritedCssProperty : CssProperty)({
	name: 'accessibilityHidden',
	cssName: 'a11y-hidden',
	valueConverter: booleanConverter,
});
accessibilityHiddenProperty.register(Style);

export const accessibilityIdentifierProperty = new Property<View, string>({
	name: 'accessibilityIdentifier',
});

export const accessibilityRoleProperty = new CssProperty<Style, AccessibilityRole>({
	name: 'accessibilityRole',
	cssName: 'a11y-role',
	valueConverter: makePropertyEnumConverter<AccessibilityRole>(AccessibilityRole),
});
accessibilityRoleProperty.register(Style);

export const accessibilityStateProperty = new CssProperty<Style, AccessibilityState>({
	name: 'accessibilityState',
	cssName: 'a11y-state',
	valueConverter: makePropertyEnumConverter<AccessibilityState>(AccessibilityState),
});
accessibilityStateProperty.register(Style);

export const accessibilityLabelProperty = new Property<View, string>({
	name: 'accessibilityLabel',
});

export const accessibilityValueProperty = new Property<View, string>({
	name: 'accessibilityValue',
});

export const accessibilityHintProperty = new Property<View, string>({
	name: 'accessibilityHint',
});

export const accessibilityIgnoresInvertColorsProperty = new Property<View, boolean>({
	name: 'accessibilityIgnoresInvertColors',
	valueConverter: booleanConverter,
});

export const accessibilityLiveRegionProperty = new CssProperty<Style, AccessibilityLiveRegion>({
	name: 'accessibilityLiveRegion',
	cssName: 'a11y-live-region',
	defaultValue: AccessibilityLiveRegion.None,
	valueConverter: makePropertyEnumConverter<AccessibilityLiveRegion>(AccessibilityLiveRegion),
});
accessibilityLiveRegionProperty.register(Style);

export const accessibilityTraitsProperty = new Property<View, AccessibilityTrait | AccessibilityTrait[]>({
	name: 'accessibilityTraits',
});

export const accessibilityLanguageProperty = new CssProperty<Style, string>({
	name: 'accessibilityLanguage',
	cssName: 'a11y-lang',
});
accessibilityLanguageProperty.register(Style);

export const accessibilityMediaSessionProperty = new CssProperty({
	name: 'accessibilityMediaSession',
	cssName: 'a11y-media-session',
});
accessibilityMediaSessionProperty.register(Style);

/**
 * Represents the observable property backing the accessibilityStep property.
 */
export const accessibilityStepProperty = new CssProperty<Style, number>({
	name: 'accessibilityStep',
	cssName: 'a11y-step',
	defaultValue: 10,
	valueConverter: (v): number => {
		const step = parseFloat(v);

		if (isNaN(step) || step <= 0) {
			return 10;
		}

		return step;
	},
});
accessibilityStepProperty.register(Style);

```

### Core Architecture Module: `packages/core/accessibility/index.ts`
```
export * from './accessibility-common';

```

### Core Architecture Module: `packages/core/animation-frame/animation-native.android.ts`
```
export function getTimeInFrameBase(): number {
	return java.lang.System.nanoTime() / 1000000;
}

```

### Core Architecture Module: `packages/core/animation-frame/animation-native.d.ts`
```
/**
 * Gets the time in millisseconds in the same base as frames
 */
export function getTimeInFrameBase(): number;

```

### Core Architecture Module: `packages/core/animation-frame/animation-native.ios.ts`
```
import { time } from '../profiling';

export const getTimeInFrameBase = time;

```

### Core Architecture Module: `packages/core/animation-frame/index.d.ts`
```
/**
 * Callback called on frame rendered
 * @argument time Time of the current frame in milliseconds
 */
export interface FrameRequestCallback {
	(time: number): void;
}

/**
 * Requests an animation frame and returns the timer ID
 * @param cb Callback to be called on frame
 */
export function requestAnimationFrame(cb: FrameRequestCallback): number;

/**
 * Cancels a previously scheduled animation frame request
 * @param id timer ID to cancel
 */
export function cancelAnimationFrame(id: number): void;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11238** (2026-06-08): **When making use of axios CancelToken, `ReferenceError: exports is not defined at xhr.onabort` error occurs**
  *Symptoms*: ### Issue Description  When making use of axios' `CancelToken`, `ReferenceError: exports is not defined at xhr.onabort` error occurs.  In my code base I've had this issue due to a production issue and fixed it via patching the `packages/core/fetch/index.mjs` file. I replaced `exports.DOMException` with `DOMException` in these two instances:  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L457-L463  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L492-L496  I believe with the changes done here: https://github.com/NativeScript/NativeScript/commit/cc0b5034c4042418aa5b54f0b1f448430a9d0297, `DOMException` can be accessed from the exported classes.  If it helps I have a branch ready with the changes which I can push too :)  ### Reproduction  Sample code:  ```js // service.js let requestSource;  getData() {   if (requestSource) {     requestSource.cancel('Request cancelled!');   }    const currentSource = axios.CancelToken.source();   requestSource = currentSource;    const config = {     cancelToken: requestSource.token   };    return axios.get('api/get-data', undefined, config).finally(() => {     if (requestSource === currentSource) {       requestSource = undefined;     }   }); } ``` ```js // somewhere in app call function try {   getData(); } catch (e) {   console.log('Error ::', e); // results in ReferenceError: exports is not defin
  **Post-Mortem & Fix Analysis**:
  > By the way I forgot to mention that to trigger the issue the "cancel request" logic needs to be triggered. Meaning that making a single request will work fine, however if you trigger a request whilst an initial request was triggered the error mentioned above would occur.

- **Issue #11001** (2025-12-10): **Android targetSdkVersion 36: app is getting closed when using back-button or back-swipe gesture**
  *Symptoms*: ### Issue Description  When setting Android targetSdkVersion to 36 (Android 16), I am not able to "navigate back" anymore using the Android back button or the back-swipe gesture, as the app is getting closed (or at least suspended).  https://github.com/user-attachments/assets/9faa3ef3-a137-40d7-bed7-eee6c223471f  This is not related to NativeScript 9, I already experienced that during some short tests using the NativeScript 8.9 modules some months ago.  ### Reproduction  Sample app:  [ns9test.zip](https://github.com/user-attachments/files/23931705/ns9test.zip) It's a newly generated NS 9 app, I just added a second page.  - tap the button to navigate to the second page - use the Android back button (or swipe-gesture) to navigate back  --> app is closed  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  <!-- COPY START --> ```yaml OS: macOS 26.1 CPU: (12) x64 Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz Shell: /bin/zsh node: 22.19.0 npm: 11.6.2 nativescript: 9.0.1  # android java: 17.0.11 ndk: Not Found apis: 29, 33, 34, 35, 36, 36 build_tools: 25.0.2, 27.0.3, 28.0.3, 29.0.2, 30.0.2, 30.0.3, 32.0.0, 33.0.0, 33.0.1, 33.0.2, 34.0.0, 35.0.0, 35.0.1, 36.0.0, 36.1.0 system_images:    - android-29 | Google Play Intel x86_64 Atom   - android-35 | Google Play Intel x86_64 Atom   - android-35 | Google Play Tablet Intel x86_64 Atom   - android-36.1 | Google Play Intel x86_64 Atom   - android-36.1 | Pre-Release 16 KB Page Size Google Play Intel x86_64 Atom  # ios xcode:

- **Issue #10764** (2025-07-20): **Animation of transition rotate not working**
  *Symptoms*: ### Issue Description  Animation of transition rotate does not work on iOS, when using NativeScript >= 8.9.0. This happens when using css keyframe animation or when using the Animation class. We are only developing for iOS, I do not know if this is an issue on Android. Animating other properties works as expected.  Also fails on latest pre-release: 8.9.3-next-07-11-2025-16231435223  Lowering @nativescript/core to 8.8.6 fixes the problem.  Thank You to anyone who can look into this and save our spinny.  ### Reproduction  This works: ```scss @keyframes move {   from {     transform: translate(0, 0);   }   to {     transform: translate(100, 100);   } }  .move {   animation: move 2s linear infinite forwards; } ```  This fails (nothing happens):  ```scss @keyframes spin {   from {     transform: rotate(0deg);   }   to {     transform: rotate(359deg);   } }  .spin {   animation: spin 2s linear infinite forwards; } ```  As mentioned above, this also fails (nothing happens), but animating other properties work: ``` const spinAnimation = new Animation([{   target: this.iconEl.nativeElement,   rotate: 359,   duration: 2000,   iterations: Number.POSITIVE_INFINITY,   curve: CoreTypes.AnimationCurve.linear }]);  spinAnimation.play(); ```  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  ```yaml OS: macOS 15.5 CPU: (8) arm64 Apple M2 Shell: /opt/homebrew/bin/zsh node: 22.13.1 npm: 11.0.0 nativescript: 8.9.2  # android java: Not Found ndk: Not Found apis: Not Found b
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for reporting this. It seemed to work after the last improvements but there might be a corner case here. Can you try applying different values to iterations and rotate?  EDITED: We have already prepared a pull request to revert the faulty changes.
  > Sorry for the late reply. I tried a few different values for itterations and rotation. Itteration seems to work well. There must be a bit of a math misshap with the rotate value though.  transform: rotate(**X**deg);  0 < X < 180 Rotate X degrees **clockwise**  180 <= X < 360 Also rotate X degrees **counter clockwise**  -180 <= X < 0 Rotate X degrees **counter clockwise**.  -360 < X < -180 Rotate X degrees **clockwise**.  Both 0 and 360 produce no rotation and 180 produces most rotation.  I tried both the shorthand animation and expanded properties.  Sorry if this is not clear. 

- **Issue #10717** (2025-06-30): **Android 8.9 error on clip-path**
  *Symptoms*: ### Issue Description  The following code crashes the app. The problem is the last semicolon in  _clipPathTopVolume. As I just learned it should not be there at all. However, app should not crash but throw an exception instead.  <Label row="1" class="top-volume" [style.width]="_scaleX" [style.height]="_scaleY" [style.clip-path]="_clipPathTopVolume"></Label>  public _clipPathTopVolume = 'polygon(27.5% 45%, 50% 0%, 50% 0%, 72.5% 45%);';  ### Reproduction  _No response_  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  <!-- COPY START --> ```yaml OS: macOS 15.3.1 CPU: (10) arm64 Apple M1 Pro Shell: /bin/zsh node: 22.14.0 npm: 10.9.2 nativescript: 8.9.1  # android java: 17.0.14 ndk: Not Found apis: Not Found build_tools: Not Found system_images: Not Found  # ios xcode: 16.2/16C5032a cocoapods: 1.16.2 python: 3.13.2 python3: 3.13.2 ruby: 3.4.2 platforms:    - DriverKit 24.2   - iOS 18.2   - macOS 15.2   - tvOS 18.2   - visionOS 2.2   - watchOS 11.2 ```  ### Dependencies  ```json "dependencies": {   "@angular/animations": "19.2.2",   "@angular/common": "19.2.2",   "@angular/compiler": "19.2.2",   "@angular/core": "19.2.2",   "@angular/forms": "19.2.2",   "@angular/platform-browser": "19.2.2",   "@angular/platform-browser-dynamic": "19.2.2",   "@angular/router": "19.2.2",   "@apollo/client": "3.13.4",   "@mnd/external-web-view": "file:../app-plugins/dist/packages/external-web-view/mnd-external-web-view-2.0.0.tgz",   "@nativescript/angular": "19.0.1",   "@nati
  **Post-Mortem & Fix Analysis**:
  > Hi @cjohn001 I would love to work on this issue! I am a full stack engineer with expertise in JavaScript, TypeScript and React. It looks like it is still up for grabs - may I work on it?

- **Issue #10702** (2025-02-21): **Android: App crash on Android version ≤ 8 when using FormattedString**
  *Symptoms*: ### Issue Description  App crashes on older devices because of `<FormattedString>`   ### Reproduction  Create a new app, use the `<FormattedString>` and run it on older Android device. I tested with Android 8.  ### Relevant log output (if applicable)  ```shell Error: Calling js method onCreateView failed Error: java.lang.NoSuchMethodError: No direct method <init>(Landroid/graphics/Typeface;)V in class Landroid/text/style/TypefaceSpan; or its super classes (declaration of 'android.text.style.TypefaceSpan' ```  ### Environment  ⚠ Update available for component nativescript. Your current version is 8.8.2 and the latest available version is 8.8.3. ⚠ Update available for component @nativescript/core. Your current version is 8.9.0-next-02-20-2025-13443308496 and the latest available version is 8.8.6. ✔ Component @nativescript/ios has 8.8.2 version and is up to date. ✔ Component @nativescript/android has 8.8.6 version and is up to date.  ### Please accept these terms  - [x] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [x] This is a bug report - [x] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)
  **Post-Mortem & Fix Analysis**:
  > @asharghi I suspect a 8.9 PR broke this. Can you check if it happens with 8.8?

- **Issue #10625** (2026-01-05): **Image disposal removes ImageSource content event when directly passed to the component.**
  *Symptoms*: ### Issue Description  On iOS, I have an `ImageSource` that I want to pass to some `Image` components:  ``` <Image *ngIf="cond" [src]="myImageSource"></Image> <Image *ngIf="otherCond" [src]="myImageSource"></Image> ```  But when `Image` is disposed, it clears the content of the provided `ImageSource` (`this.imageSource.ios = null; `), which makes it not reusable!  https://github.com/NativeScript/NativeScript/blob/050601232ac4f424e9d3ba6b711f3ada4afe253b/packages/core/ui/image/index.ios.ts#L29-L41  Note that when `src` is an `ImageSource`, the `_createImageSourceFromSrc` function does not create but just use the provided `ImageSource`  https://github.com/NativeScript/NativeScript/blob/050601232ac4f424e9d3ba6b711f3ada4afe253b/packages/core/ui/image/image-common.ts#L124-L127   ### Reproduction  _No response_  ### Relevant log output (if applicable)  _No response_  ### Environment  _No response_  ### Please accept these terms  - [X] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [X] This is a bug report - [X] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)
  **Post-Mortem & Fix Analysis**:
  > Interesting. Does android behave as expected?
  > Yep
  > How can we reproduce this? 

- **Issue #10587** (2024-07-19): **using separate id's for ios/android in nativescript.config**
  *Symptoms*: ### Issue Description  In my app I have different app identifiers for Android and iOS. After updating to Nativescript 8.8.0, Android build fails with this Gradle error:  ``` Execution failed for task ':app:processDebugGoogleServices'. No matching client found for package name 'com.tns.testapplication'  Command ./gradlew failed with exit code 1 ```  My NativeScript config: ```js {   appPath: 'app',   appResourcesPath: 'App_Resources',   android: {     id: "com.company.androidapp",     v8Flags: "--nolazy --expose_gc",     markingMode: 'none'   },   ios: {     id: "com.company.iosapp",   } } ```  If i move the id to the root of the object, the build succedes.  ```js {   id: "com.company.androidapp",   appPath: 'app',   appResourcesPath: 'App_Resources',   android: {     v8Flags: "--nolazy --expose_gc",     markingMode: 'none'   } } ```  Seems to me it doesn't parse correctly the NativeScript config in @nativescript/android/framework/app/build.gradle. Works fine on iOS.  {N} CLI: 8.0.0 @nativescript/core: 8.8.1 @nativescript/android": "8.8.0"  ### Reproduction  _No response_  ### Relevant log output (if applicable)  NativeScript build output: ``` (node:32723) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead. (Use `node --trace-deprecation ...` to show where the warning was created) Preparing project... assets by path fonts/*.ttf 2.35 MiB   asset fonts/fa-solid-90
  **Post-Mortem & Fix Analysis**:
  > Hi @tommag21 could you include the full stacktrace/build output? 
  > @NathanWalker included in the first post, is it fine?
  > Thank you, your output mentions this: > Incorrect package="com.company.androidapp" found in source AndroidManifest.xml > Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported.  If using 8.8+ cli (`npm i -g nativescript@latest`), you can remove `AndroidManifest.xml` settings: ```xml <manifest xmlns:android="http://schemas.android.com/apk/res/android" 	package="__PACKAGE__" <--- remove this ``` so just this: ```xml <manifest xmlns:android="http://schemas.android.com/apk/res/android"> ``` and it should set it properly. Confirmed here that nativescript.config multi level bundle id is working well.

- **Issue #10515** (2024-04-15): **[android] Image tintColor set to null will cause a throwable**
  *Symptoms*: ### Issue Description  When using `<Image [tintColor]="null" ...` a throwable will occur: ```bash java.lang.Throwable Cannot read properties of null (reading 'android') .[tintColor:setNative] (vendor.js) .Style.<anonymous> (vendor.js) .set tintColor [as tintColor] (vendor.js) .ViewUtil.setPropertyInternal (vendor.js) .ViewUtil.setProperty (vendor.js) .EmulatedRenderer.setProperty (vendor.js) ```  ### Reproduction  Setting Image with `null` tintColor on Android.  ### Relevant log output (if applicable)  _No response_  ### Environment  _No response_  ### Please accept these terms  - [X] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [X] This is a bug report - [X] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)

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

### Incident Patch 1: `86733c5c` (2026-10-05)
**Commit Message**: fix(vite): serve worker re-exports per module, not from the deps bundle (#11504)

[skip ci]

**File**: `packages/vite/hmr/server/process-code-for-device.ts` (modified, +4/-6)
```diff
@@ -299,12 +299,10 @@ function processCodeForDevice(code: string, isVitePreBundled: boolean, preserveV
 		resolvedSpecifierOverrides,
 		// Worker entries evaluate in their own realm, where the main realm's
 		// vendor registry / __nsRequire never exist — route their vendor
-		// imports to the /ns/m/node_modules HTTP ESM form instead (realm-local
-		// copy via the deps-bundle bridge, matching webpack's per-worker
-		// bundling semantics). Entry-level detection by the `.worker` filename
-		// convention; a worker's TRANSITIVE imports share URLs with the main
-		// realm and cannot be forked per-realm, so plugins consumed by worker
-		// code should be imported from the worker entry itself.
+		// imports to the per-module /ns/m/node_modules HTTP ESM form instead,
+		// matching webpack's per-worker bundling semantics. The entry is
+		// detected by the `.worker` filename convention; its transitive
+		// imports by the `?ns_worker=1` marker the /ns/m route propagates.
 		vendorImportsAsHttp: options?.workerRealm || isWorkerEntryModuleId(sourceId),
 	};
 
```

**File**: `packages/vite/hmr/server/websocket-bindings.spec.ts` (modified, +48/-1)
```diff
@@ -3,7 +3,7 @@ import { tmpdir } from 'os';
 import { join } from 'path';
 import { parse as babelParse } from '@babel/parser';
 import { afterEach, describe, it, expect } from 'vitest';
-import { ensureNativeScriptModuleBindings } from './websocket-module-bindings.js';
+import { ensureNativeScriptModuleBindings, getProcessCodeResolvedSpecifierOverrides } from './websocket-module-bindings.js';
 import { rewriteImports } from './websocket-device-transform.js';
 
 // Helper to normalize whitespace for robust assertions
@@ -204,6 +204,53 @@ describe('ensureNativeScriptModuleBindings — package metadata NativeScript det
 		expect(text).not.toContain('__nsVendorModule_');
 	});
 
+	it('routes node_modules re-exports to the /ns/m worker form with vendorImportsAsHttp, even without imports', () => {
+		const input = [`export * from "/node_modules/@nativescript/canvas/Canvas2D/Path2D/index.js?v=1a2b";`, `export { Helpers } from "/node_modules/@nativescript/canvas/helpers.js";`, `export * from "/node_modules/@nativescript/core/index.js";`, `export { local } from "./local";`].join('\n');
+
+		const worker = ensureNativeScriptModuleBindings(input, { vendorImportsAsHttp: true });
+		expect(worker).toContain(`export * from "/ns/m/node_modules/@nativescript/canvas/Canvas2D/Path2D/index.js?ns_worker=1";`);
+		expect(worker).toContain(`export { Helpers } from "/ns/m/node_modules/@nativescript/canvas/helpers.js?ns_worker=1";`);
+		expect(worker).toContain(`export * from "/node_modules/@nativescript/core/index.js";`);
+		expect(worker).toContain(`export { local } from "./local";`);
+
+		expect(ensureNativeScriptModuleBindings(input)).toBe(input);
+	});
+
+	it('names the resolved file for worker imports and re-exports alike, ignoring the authored spelling', () => {
+		const root = mkdtempSync(join(tmpdir(), 'ns-websocket-bindings-'));
+		tempRoots.push(root);
+
+		const pkg = join(root, 'node_modules', '@nativescript', 'canvas');
+		mkdirSync(join(pkg, 'Canvas2D', 'Path2D'), { recursive: true });
+		writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture-app' }, null, 2));
+		writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@nativescript/canvas', main: './index', nativescript: { platforms: { ios: '6.0.0' } } }, null, 2));
+		writeFileSync(join(pkg, 'Canvas2D', 'Path2D', 'index.js'), `export class Path2D {}\n`);
+		writeFileSync(join(pkg, 'Canvas2D', 'index.js'), `export * from './Path2D';\n`);
+		writeFileSync(join(pkg, 'Canvas2D', 'context.js'), `import { Path2D } from './Path2D';\nexport const make = () => new Path2D();\n`);
+
+		process.chdir(root);
+
+		const served = `"/node_modules/@nativescript/canvas/Canvas2D/Path2D/index.js?v=1a2b"`;
+		const reExport = ensureNativeScriptModuleBindings(`export * from ${served};\n`, {
+			vendorImportsAsHttp: true,
+			resolvedSpecifierOverrides: getProcessCodeResolvedSpecifierOverrides('/node_modules/@nativescript/canvas/Canvas2D/index.js', root),
+		});
+		const importer = ensureNativeScriptModuleBindings(`import { Path2D } from ${served};\nexport const make = () => new Path2D();\n`, {
+			vendorImportsAsHttp: true,
+			resolvedSpecifierOverrides: getProcessCodeResolvedSpecifierOverrides('/node_modules/@nativescript/canvas/Canvas2D/context.js', root),
+		});
+
+		expect(reExport).toContain(`export * from "/ns/m/node_modules/@nativescript/canvas/Canvas2D/Path2D/index.js?ns_worker=1";`);
+		expect(importer).toContain(`import { Path2D } from "/ns/m/node_modules/@nativescript/canvas/Canvas2D/Path2D/index.js?ns_worker=1";`);
+
+		// The main realm keeps the authored spelling for the import map.
+		const mainImporter = ensureNativeScriptModuleBindings(`import { Path2D } from ${served};\nexport const make = () => new Path2D();\n`, {
+			preserveNonPluginVendorImports: true,
+			resolvedSpecifierOverrides: getProcessCodeResolvedSpecifierOverrides('/node_modules/@nativescript/canvas/Canvas2D/context.js', root),
+		});
+		expect(mainImporter).toContain(`from "@nativescript/canvas/Canvas2D/Path2D"`);
+	});
+
 	it('preserves exact bare runtime-plugin subpaths instead of collapsing them to the root package', () => {
 		const root = mkdtempSync(join(tmpdir(), 'ns-websocket-bindings-'));
 		tempRoots.push(root);
```

**File**: `packages/vite/hmr/server/websocket-module-bindings.ts` (modified, +70/-3)
```diff
@@ -38,9 +38,9 @@ export interface EnsureNativeScriptModuleBindingsOptions {
 	 * shim's fallback to the native `require()` fails for every vendor
 	 * package (observed with `@nativescript/zip` in a zip worker on a fresh
 	 * install — the first boot's DB unzip was the first code path to ever
-	 * exercise a vendor require inside a worker). The HTTP form gives the
-	 * worker its own realm-local copy via the deps-bundle bridge — the same
-	 * isolation semantics webpack's per-worker bundles had.
+	 * exercise a vendor require inside a worker). The `?ns_worker=1` HTTP form
+	 * gives the worker its own per-module copy, bypassing the deps bundle —
+	 * the same isolation semantics webpack's per-worker bundles had.
 	 */
 	vendorImportsAsHttp?: boolean;
 }
@@ -104,6 +104,65 @@ function collectTopLevelImportRecords(code: string): TopLevelImportRecord[] {
 	}
 }
 
+/** Value re-exports (`export * from 'x'`, `export { a } from 'x'`), as the positions of their source literals. */
+function collectTopLevelReExportSources(code: string): Array<{ start: number; end: number; source: string }> {
+	try {
+		const ast = babelParse(code, {
+			sourceType: 'module',
+			plugins: [...MODULE_IMPORT_ANALYSIS_PLUGINS],
+		}) as any;
+		const body = ast?.program?.body;
+		if (!Array.isArray(body)) {
+			return [];
+		}
+
+		return body
+			.filter((node: any) => (node?.type === 'ExportAllDeclaration' || node?.type === 'ExportNamedDeclaration') && node.exportKind !== 'type' && typeof node.source?.value === 'string')
+			.map((node: any) => ({
+				start: node.source.start as number,
+				end: node.source.end as number,
+				source: node.source.value as string,
+			}));
+	} catch {
+		return [];
+	}
+}
+
+/**
+ * The worker serve's URL for a node_modules module Vite already resolved
+ * (`/node_modules/<pkg>/<file>`, `/@fs/.../node_modules/<pkg>/<file>`), or
+ * null when the specifier is not one. A worker realm has no vendor registry
+ * and must not reach the deps-bundle bridge, so its imports and re-exports
+ * both name the resolved file: one URL per module, as on the web. The
+ * authored spelling (`getPreservedImportSpecifier`) is for the main realm's
+ * import map; a re-export never carries it, so a worker using it for imports
+ * would load a module once per spelling.
+ */
+function getWorkerNodeModulesSpecifier(specifier: string): string | null {
+	const nodeModulesSpecifier = normalizeNodeModulesSpecifier(specifier);
+	if (!nodeModulesSpecifier || /^@nativescript\/core(\b|\/)/i.test(nodeModulesSpecifier) || isEsmFrameworkPackageSpecifier(specifier)) {
+		return null;
+	}
+	return `/ns/m/node_modules/${nodeModulesSpecifier}?ns_worker=1`;
+}
+
+/**
+ * Left alone, `rewriteImports` hands a package's own `export * from './sub'`
+ * to the import map as a bare specifier, which routes it to the deps-bundle
+ * shim: the worker then evaluates the bundle too, and with it a second copy
+ * of the package it already loaded per module.
+ */
+function rewriteWorkerReExportSpecifiers(code: string): string {
+	const records = collectTopLevelReExportSources(code);
+	for (const record of [...records].sort((left, right) => right.start - left.start)) {
+		const workerSpecifier = getWorkerNodeModulesSpecifier(record.source.replace(PAT.QUERY_PATTERN, ''));
+		if (workerSpecifier) {
+			code = code.slice(0, record.start) + JSON.stringify(workerSpecifier) + code.slice(record.end);
+		}
+	}
+	return code;
+}
+
 function stripTopLevelImportRecords(code: string, records: TopLevelImportRecord[]): string {
 	let stripped = code;
 	for (const record of [...records].sort((left, right) => right.start - left.start)) {
@@ -113,6 +172,9 @@ function stripTopLevelImportRecords(code: string, records: TopLevelImportRecord[
 }
 
 export function ensureNativeScriptModuleBindings(code: string, options?: EnsureNativeScriptModuleBindingsOptions): string {
+	if (options?.vendorImportsAsHttp) {
+		code = rewriteWorkerReExportSpecifiers(code);
+	}
 	const importRecords = collectTopLevelImportRecords(code);
 	if (!importRecords.length) {
 		return code;
@@ -166,6 +228,11 @@ export function ensureNativeScriptModuleBindings(code: string, options?: EnsureN
 
 		const rawSpec = record.source;
 		const specifier = rawSpec.replace(PAT.QUERY_PATTERN, '');
+		const workerSpecifier = options?.vendorImportsAsHttp ? getWorkerNodeModulesSpecifier(specifier) : null;
+		if (workerSpecifier) {
+			preservedImports.push(rewritePreservedImportSpecifier(original, rawSpec, workerSpecifier));
+			continue;
+		}
 		const preservedSpecifier = getPreservedImportSpecifier(specifier, options);
 
 		if (!record.clause) {
```

---

### Incident Patch 2: `75cbfc55` (2026-10-02)
**Commit Message**: fix(core): nested tab frames stay loaded and never outrank the selected tab (#11446)

[skip ci]

**File**: `apps/toolbox/src/main-page.xml` (modified, +2/-0)
```diff
@@ -22,6 +22,8 @@
         <Button text="list-page-sticky" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="list-page-sticky-templates" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="multiple-scenes" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
+        <Button text="nested-tab-frame" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
+        <Button text="nested-tab-frame-4tabs" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="root-layout" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="scroll-view" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="sliders" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
```

**File**: `apps/toolbox/src/pages/nested-tab-frame-4tabs.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+import { EventData, Page } from '@nativescript/core';
+import { setupPage } from './nested-tab-frame-shared';
+
+export function navigatingTo(args: EventData) {
+	setupPage(<Page>args.object, { tabCount: 4 });
+}
```

**File**: `apps/toolbox/src/pages/nested-tab-frame-4tabs.xml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+<Page xmlns="http://schemas.nativescript.org/tns.xsd" navigatingTo="navigatingTo" class="page">
+    <Page.actionBar>
+        <ActionBar title="Nested Tab Frame (4 tabs)" icon="" class="action-bar">
+        </ActionBar>
+    </Page.actionBar>
+</Page>
```

**File**: `apps/toolbox/src/pages/nested-tab-frame-shared.ts` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+import { Button, Frame, Label, Page, ScrollView, StackLayout, TabView, TabViewItem, Trace } from '@nativescript/core';
+
+/**
+ * Playground for a Frame hosted as a TabViewItem view (issue #11444): every tab frame mounts
+ * its first page in `loaded`, and the inner pages expose the navigation and frame-stack
+ * probes used to reproduce the reported stalls.
+ */
+export interface NestedTabFrameOptions {
+	tabCount: number;
+	androidOffscreenTabLimit?: number;
+}
+
+const TITLES = ['Home', 'Demos', 'Third', 'Fourth'];
+
+export const registry = { tabView: null as TabView, frames: [] as Frame[] };
+
+export function log(msg: string) {
+	console.log(`[NTF] ${msg}`);
+}
+
+export function describe(frame: Frame): string {
+	const f = frame as any;
+	return `isLoaded=${frame.isLoaded} current=${frame.currentPage ? frame.currentPage.id : null} backStack=${frame.backStack.length} executing=${!!f._executingContext} queue=${f._navigationQueue.length} inStack=${f._isInFrameStack}`;
+}
+
+export function makePage(frame: Frame, depth: number): Page {
+	const page = new Page();
+	page.id = `${frame.id}-page${depth}`;
+	page.actionBarHidden = true;
+	const stack = new StackLayout();
+	stack.className = 'p-20';
+
+	const label = new Label();
+	label.text = `${page.id}`;
+	label.className = 'h2 text-center';
+	stack.addChild(label);
+
+	const addButton = (text: string, cls: string, onTap: () => void) => {
+		const btn = new Button();
+		btn.text = text;
+		btn.className = cls;
+		btn.on('tap', onTap);
+		stack.addChild(btn);
+	};
+
+	addButton(`Push page ${depth + 1}`, 'btn btn-primary', () => {
+		log(`push from ${page.id}: ${describe(frame)}`);
+		frame.navigate({ create: () => makePage(frame, depth + 1) });
+		log(`after push: ${describe(frame)}`);
+	});
+	addButton(`Push page ${depth + 1} (animated=false)`, 'btn btn-primary', () => {
+		log(`push (no anim) from ${page.id}: ${describe(frame)}`);
+		frame.navigate({ create: () => makePage(frame, depth + 1), animated: false });
+		log(`after push: ${describe(frame)}`);
+	});
+	addButton('Go back', 'btn btn-outline', () => {
+		log(`goBack from ${page.id}: canGoBack=${frame.canGoBack()} ${describe(frame)}`);
+		frame.goBack();
+		log(`after goBack: ${describe(frame)}`);
+	});
+	addButton('Log status', 'btn btn-outline', () => {
+		log(`status ${frame.id}: ${describe(frame)} topmost=${Frame.topmost()?.id}`);
+	});
+	addButton('callLoaded() workaround', 'btn btn-outline', () => {
+		frame.callLoaded();
+		log(`after callLoaded: ${describe(frame)}`);
+	});
+	registry.frames.forEach((f, i) => {
+		addButton(`Select tab ${TITLES[i]}`, 'btn btn-outline', () => {
+			log(`programmatic select tab ${i} (${TITLES[i]}) from ${page.id}; topmost=${Frame.topmost()?.id}`);
+			registry.tabView.selectedIndex = i;
+			log(`after select: ${TITLES[i]} ${describe(registry.frames[i])} topmost=${Frame.topmost()?.id}`);
+		});
+	});
+	addButton('Frame.topmost().navigate()', 'btn btn-outline', () => {
+		const top = Frame.topmost() as Frame;
+		log(`topmost navigate: topmost=${top?.id} (this page's frame=${frame.id}) before ${describe(top)}`);
+		top.navigate({ create: () => makePage(top, (top.backStack.length || 0) + 2) });
+		log(`after topmost navigate: ${describe(top)}`);
+	});
+	addButton('Frame.topmost().goBack()', 'btn btn-outline', () => {
+		const top = Frame.topmost() as Frame;
+		log(`topmost goBack: topmost=${top?.id} canGoBack=${top?.canGoBack()} ${describe(top)}`);
+		top.goBack();
+		log(`after topmost goBack: ${describe(top)}`);
+	});
+	addButton('Reassign items (new array)', 'btn btn-outline', () => {
+		const tv = registry.tabView;
+		log(`reassign items: selectedIndex=${tv.selectedIndex} before ${describe(frame)}`);
+		tv.items = [...tv.items];
+		log(`after reassign: selectedIndex=${tv.selectedIndex} ${describe(frame)} topmost=${Frame.topmost()?.id}`);
+	});
+	addButton('Log all frames', 'btn btn-outline', () => {
+		registry.frames.forEach((f) => log(`  ${f.id}: ${describe(f)}`));
+		log(
+			`  topmost=${Frame.topmost()?.id} stack=[${(Frame as any)
+				._stack()
+				.map((f: Frame) => f.id)
+				.join(', ')}]`,
+		);
+	});
+	addButton('Select next tab + push there', 'btn btn-outline', () => {
+		const n = registry.frames.length;
+		const i = (registry.tabView.selectedIndex + 1) % n;
+		const target = registry.frames[i];
+		log(`select next tab ${i} + push: before ${describe(target)}`);
+		registry.tabView.selectedIndex = i;
+		log(`after select: ${describe(target)} topmost=${Frame.topmost()?.id}`);
+		target.navigate({ create: () => makePage(target, (target.backStack.length || 0) + 2) });
+		log(`after push on ${target.id}: ${describe(target)}`);
+	});
+	addButton('Push + switch tab', 'btn btn-outline', () => {
+		const n = registry.frames.length;
+		const i = (registry.tabView.selectedIndex + 1) % n;
+		log(`push on ${frame.id} then switch to tab ${i}`);
+		frame.navigate({ create: () => makePage(frame, depth + 1) });
+		registry.tabView.selectedIndex =
```

**File**: `apps/toolbox/src/pages/nested-tab-frame.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+import { EventData, Page } from '@nativescript/core';
+import { setupPage } from './nested-tab-frame-shared';
+
+export function navigatingTo(args: EventData) {
+	setupPage(<Page>args.object, { tabCount: 2 });
+}
```

**File**: `apps/toolbox/src/pages/nested-tab-frame.xml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+<Page xmlns="http://schemas.nativescript.org/tns.xsd" navigatingTo="navigatingTo" class="page">
+    <Page.actionBar>
+        <ActionBar title="Nested Tab Frame" icon="" class="action-bar">
+        </ActionBar>
+    </Page.actionBar>
+</Page>
```

**File**: `packages/core/ui/core/view-base/index.ts` (modified, +9/-0)
```diff
@@ -1075,6 +1075,15 @@ export abstract class ViewBase extends Observable {
 		}
 	}
 
+	/**
+	 * Whether a child is the one currently shown. Containers that keep several children
+	 * alive but show one at a time (a TabView's items) override it for the hidden ones.
+	 * @param child A direct child of this view.
+	 */
+	public _isChildPresented(child: ViewBase): boolean {
+		return true;
+	}
+
 	/**
 	 * Core logic for removing a child view from this instance. Used by the framework to handle lifecycle events more centralized. Do not use outside the UI Stack implementation.
 	 */
```

**File**: `packages/core/ui/frame/frame-common.spec.ts` (modified, +134/-0)
```diff
@@ -5,6 +5,9 @@ import { setActiveWindow } from '../../application/helpers-common';
 import type { NativeWindow } from '../../native-window';
 import type { BackstackEntry } from './frame-interfaces';
 import { NavigationType } from './frame-interfaces';
+import { View } from '../core/view';
+import { ViewBase } from '../core/view-base';
+import { TabViewBase, TabViewItemBase } from '../tab-view/tab-view-common';
 
 /**
  * `FrameBase` is used directly instead of the platform `Frame`: the navigation queue and the
@@ -256,3 +259,134 @@ describe('FrameBase.topmost', () => {
 		expect(frameStack).toEqual([scoped, other]);
 	});
 });
+
+/** A container that shows a single child, like a TabView does with its items. */
+class SingleChildHost extends ViewBase {
+	public shown: ViewBase;
+
+	public _isChildPresented(child: ViewBase): boolean {
+		return child === this.shown;
+	}
+}
+
+class TabViewItem extends TabViewItemBase {
+	public _update() {
+		// no native tab to refresh in the common layer
+	}
+}
+
+function createTabItem(frame: FrameBase): TabViewItem {
+	const item = new TabViewItem();
+	item.view = frame;
+
+	return item;
+}
+
+function stackIds(): string[] {
+	return frameStack.map((frame) => frame.id);
+}
+
+describe('frame stack presentation', () => {
+	afterEach(() => {
+		frameStack.splice(0).forEach((frame) => (frame._isInFrameStack = false));
+	});
+
+	it('puts a frame nobody hides on top', () => {
+		const host = new SingleChildHost();
+		const frame = new FrameBase();
+		host._addView(frame);
+		host.shown = frame;
+
+		frame._pushInFrameStack();
+
+		expect(FrameBase.topmost()).toBe(frame);
+	});
+
+	it('keeps a hidden frame in the stack without making it topmost', () => {
+		const shownFrame = new FrameBase();
+		shownFrame.id = 'shown';
+		const hiddenFrame = new FrameBase();
+		hiddenFrame.id = 'hidden';
+		const host = new SingleChildHost();
+		host._addView(shownFrame);
+		host._addView(hiddenFrame);
+		host.shown = shownFrame;
+		shownFrame._pushInFrameStack();
+
+		hiddenFrame._pushInFrameStack();
+
+		expect(FrameBase.topmost()).toBe(shownFrame);
+		expect(FrameBase.getFrameById('hidden')).toBe(hiddenFrame);
+		expect(stackIds()).toEqual(['hidden', 'shown']);
+	});
+
+	it('leaves a hidden frame where it is when it is already in the stack', () => {
+		const shownFrame = new FrameBase();
+		shownFrame.id = 'shown';
+		const hiddenFrame = new FrameBase();
+		hiddenFrame.id = 'hidden';
+		const host = new SingleChildHost();
+		host._addView(shownFrame);
+		host._addView(hiddenFrame);
+		host.shown = hiddenFrame;
+		hiddenFrame._pushInFrameStack();
+		host.shown = shownFrame;
+		shownFrame._pushInFrameStack();
+
+		hiddenFrame._pushInFrameStack();
+
+		expect(stackIds()).toEqual(['hidden', 'shown']);
+	});
+
+	it('does not let a frame hidden further up the tree reach the top', () => {
+		const host = new SingleChildHost();
+		const shownPane = new View();
+		const hiddenPane = new View();
+		host._addView(shownPane);
+		host._addView(hiddenPane);
+		host.shown = shownPane;
+		const shownFrame = new FrameBase();
+		const hiddenFrame = new FrameBase();
+		shownPane._addView(shownFrame);
+		hiddenPane._addView(hiddenFrame);
+		shownFrame._pushInFrameStack();
+
+		hiddenFrame._pushInFrameStack();
+
+		expect(FrameBase.topmost()).toBe(shownFrame);
+	});
+
+	it('keeps the selected tab frame topmost while a preloaded tab frame navigates', () => {
+		const tabView = new TabViewBase();
+		const homeFrame = new FrameBase();
+		homeFrame.id = 'home';
+		const demosFrame = new FrameBase();
+		demosFrame.id = 'demos';
+		tabView.items = [createTabItem(homeFrame), createTabItem(demosFrame)];
+		tabView.selectedIndex = 0;
+		homeFrame.navigate({ create: () => new View() });
+
+		demosFrame.navigate({ create: () => new View() });
+
+		expect(FrameBase.topmost()).toBe(homeFrame);
+		expect(FrameBase.getFrameById('demos')).toBe(demosFrame);
+	});
+
+	it('promotes the frame of a tab once that tab is selected', () => {
+		const tabView = new TabViewBase();
+		const homeFrame = new FrameBase();
+		homeFrame.id = 'home';
+		const demosFrame = new FrameBase();
+		demosFrame.id = 'demos';
+		tabView.items = [createTabItem(homeFrame), createTabItem(demosFrame)];
+		tabView.selectedIndex = 0;
+		homeFrame.navigate({ create: () => new View() });
+		demosFrame.navigate({ create: () => new View() });
+
+		tabView.selectedIndex = 1;
+		demosFrame._pushInFrameStackRecursive();
+
+		expect(FrameBase.topmost()).toBe(demosFrame);
+		expect(stackIds()).toEqual(['home', 'demos']);
+	});
+});
```

---

### Incident Patch 3: `9f2e0721` (2026-10-02)
**Commit Message**: fix(core): android edge to edge stabilization (#11434)

**File**: `apps/toolbox/src/main-page.xml` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@
         <Button text="webview" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="winter-tc" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
         <Button text="ete" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
+        <Button text="ete/hub" tap="{{ viewDemo }}" class="btn btn-primary btn-view-demo" />
       </StackLayout>
     </ScrollView>
   </StackLayout>
```

**File**: `apps/toolbox/src/pages/ete/bars.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { Application, Color, EventData, Frame, Observable, Page, Utils } from '@nativescript/core';
+import { deviceSummary } from './shared';
+
+class Bars extends Observable {
+	private dark = true;
+	private lightContent = false;
+	private tinted = false;
+
+	constructor(private page: Page) {
+		super();
+		this.publish();
+
+		const onAppearance = () => this.publish();
+		Application.on(Application.systemAppearanceChangedEvent, onAppearance);
+		this.page.on(Page.navigatedFromEvent, () => Application.off(Application.systemAppearanceChangedEvent, onAppearance));
+	}
+
+	toggleStyle = () => {
+		this.dark = !this.dark;
+		this.publish();
+	};
+
+	toggleContent = () => {
+		this.lightContent = !this.lightContent;
+		this.publish();
+	};
+
+	/** The colours only show up behind translucent bars, which is the edge-to-edge case. */
+	toggleBarColors = () => {
+		this.tinted = !this.tinted;
+		const activity = Utils.android.getCurrentActivity() as androidx.appcompat.app.AppCompatActivity;
+		if (this.tinted) {
+			Utils.android.setStatusBarColor({ activity, lightColor: new Color('#3320c997'), darkColor: new Color('#33064e3b') });
+			Utils.android.setNavigationBarColor({ activity, lightColor: new Color('#33f59e0b'), darkColor: new Color('#33451a03') });
+		} else {
+			Utils.android.setStatusBarColor({ activity, lightColor: new Color('transparent'), darkColor: new Color('transparent') });
+			Utils.android.setNavigationBarColor({ activity, lightColor: new Color('transparent'), darkColor: new Color('transparent') });
+		}
+		this.publish();
+	};
+
+	back = () => {
+		Frame.topmost().goBack();
+	};
+
+	private publish() {
+		const style = this.dark ? 'dark' : 'light';
+		this.set('statusBarStyle', style);
+		this.set('statusBarLine', `statusBarStyle: ${style}`);
+		this.set('contentColor', this.lightContent ? '#f8fafc' : '#111827');
+		this.set('appearanceLine', `system appearance: ${Application.systemAppearance()}`);
+		this.set('ignoreOlderLine', `ignoreEdgeToEdgeOnOlderDevices: ${Utils.android.getIgnoreEdgeToEdgeOnOlderDevices()}`);
+		this.set('device', deviceSummary());
+	}
+}
+
+export function navigatingTo(args: EventData) {
+	const page = <Page>args.object;
+	page.bindingContext = new Bars(page);
+}
```

**File**: `apps/toolbox/src/pages/ete/bars.xml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+<Page xmlns="http://schemas.nativescript.org/tns.xsd" navigatingTo="navigatingTo" actionBarHidden="true" androidOverflowEdge="ignore" backgroundColor="#3f0d12" statusBarStyle="{{ statusBarStyle }}">
+  <GridLayout id="probe" backgroundColor="#166534" androidOverflowEdge="top,bottom">
+    <GridLayout backgroundColor="{{ contentColor }}" rows="auto, auto, *">
+      <StackLayout row="0" padding="12" marginTop="48">
+        <Label text="System bars" color="#ffffff" fontWeight="bold" fontSize="17" />
+        <Label text="The probe overflows top and bottom, so the content colour runs under both bars - that is the only way to tell whether the bar icons are still readable." color="#e5e7eb" fontSize="13" textWrap="true" />
+      </StackLayout>
+
+      <StackLayout row="1" padding="8">
+        <GridLayout columns="*, *">
+          <Button col="0" text="statusBarStyle" tap="{{ toggleStyle }}" color="#ffffff" backgroundColor="#111827" />
+          <Button col="1" text="content colour" tap="{{ toggleContent }}" color="#ffffff" backgroundColor="#111827" />
+        </GridLayout>
+        <GridLayout columns="*, *" marginTop="4">
+          <Button col="0" text="bar colours" tap="{{ toggleBarColors }}" color="#ffffff" backgroundColor="#111827" />
+          <Button col="1" text="back" tap="{{ back }}" color="#ffffff" backgroundColor="#111827" />
+        </GridLayout>
+      </StackLayout>
+
+      <ScrollView row="2">
+        <StackLayout padding="12">
+          <Label text="{{ statusBarLine }}" color="#ffffff" fontFamily="monospace" fontSize="14" />
+          <Label text="{{ appearanceLine }}" color="#ffffff" fontFamily="monospace" fontSize="14" marginTop="4" />
+          <Label text="{{ ignoreOlderLine }}" color="#ffffff" fontFamily="monospace" fontSize="14" marginTop="4" />
+          <Label text="{{ device }}" color="#e5e7eb" fontSize="13" textWrap="true" marginTop="8" />
+          <Label text="Switch the system theme while this page is open: the bar icons have to flip with it, not stay on the old theme." color="#fde68a" fontSize="13" textWrap="true" marginTop="12" />
+        </StackLayout>
+      </ScrollView>
+
+    </GridLayout>
+  </GridLayout>
+</Page>
```

**File**: `apps/toolbox/src/pages/ete/edges.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { CoreTypes, EventData, Frame, GridLayout, Observable, Page } from '@nativescript/core';
+import { readEdges, readWindowInsets } from './shared';
+
+interface Case {
+	edge: CoreTypes.AndroidOverflow;
+	description: string;
+}
+
+/**
+ * One entry per shape androidOverflowEdge can take. Walk them with prev/next and the
+ * green ring tells you which edges the probe padded.
+ */
+const CASES: Case[] = [
+	{ edge: 'none', description: 'pads every edge and consumes them - expect a green ring all the way round' },
+	{ edge: 'ignore', description: 'takes no part at all - expect no green ring, and no ring left over from the previous case' },
+	{ edge: 'top', description: 'overflows the top - blue should reach up under the status bar, green on the other three' },
+	{ edge: 'bottom', description: 'overflows the bottom - blue should reach down under the navigation bar' },
+	{ edge: 'left', description: 'overflows the left - only visible when there is a left inset (landscape / gesture nav)' },
+	{ edge: 'right', description: 'overflows the right - only visible when there is a right inset' },
+	{ edge: 'top,bottom', description: 'overflows both - green only on left/right, which are usually 0 in portrait' },
+	{ edge: 'left,right', description: 'overflows the sides - green top and bottom' },
+	{ edge: 'all-but-top', description: 'only the top is padded' },
+	{ edge: 'all-but-bottom', description: 'only the bottom is padded' },
+	{ edge: 'top-dont-consume', description: 'pads the top AND passes the top inset on to children' },
+	{ edge: 'bottom-dont-consume', description: 'pads the bottom AND passes the bottom inset on to children' },
+	{ edge: 'dont-apply', description: 'hands the insets to JS and pads nothing - expect no green ring' },
+	{ edge: 'none,none', description: 'a stacked value that resolves to none - must behave exactly like the first case' },
+	{ edge: 'ignore,bottom', description: 'ignore wins over anything after it - must behave exactly like ignore' },
+	{ edge: 'none,cutout', description: 'like none, but the display cutout counts too - rotate to landscape, where the camera sits on an edge with no system bar' },
+	{ edge: 'top,cutout', description: 'overflows the top while still keeping clear of the cutout on the other edges' },
+];
+
+class EdgeMatrix extends Observable {
+	private index = 0;
+
+	constructor(private page: Page) {
+		super();
+		this.apply();
+	}
+
+	get probe(): GridLayout {
+		return this.page.getViewById<GridLayout>('probe');
+	}
+
+	next = () => {
+		this.index = (this.index + 1) % CASES.length;
+		this.apply();
+	};
+
+	prev = () => {
+		this.index = (this.index - 1 + CASES.length) % CASES.length;
+		this.apply();
+	};
+
+	back = () => {
+		Frame.topmost().goBack();
+	};
+
+	private apply() {
+		const current = CASES[this.index];
+		this.set('edge', current.edge);
+		this.set('heading', `androidOverflowEdge = "${current.edge}"`);
+		this.set('description', current.description);
+		this.set('hint', `green ring = padded edge, blue to the screen edge = overflowing (${this.index + 1} of ${CASES.length})`);
+		// The insets land on the next layout pass, so read the probe after it.
+		setTimeout(() => this.refresh(), 80);
+	}
+
+	refresh() {
+		const readout = readEdges(this.probe);
+		this.set('padding', readout.padding);
+		this.set('edgeInsets', readout.edgeInsets);
+		this.set('imeInsets', readout.imeInsets);
+		this.set('windowInsets', readWindowInsets(this.page));
+	}
+}
+
+export function navigatingTo(args: EventData) {
+	const page = <Page>args.object;
+	page.bindingContext = new EdgeMatrix(page);
+}
```

**File**: `apps/toolbox/src/pages/ete/edges.xml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+<Page xmlns="http://schemas.nativescript.org/tns.xsd" navigatingTo="navigatingTo" actionBarHidden="true" androidOverflowEdge="ignore" backgroundColor="#3f0d12">
+  <!-- The page ignores insets so the probe below is the only view distributing them. -->
+  <GridLayout id="probe" backgroundColor="#166534" androidOverflowEdge="{{ edge }}">
+    <GridLayout backgroundColor="#1d4ed8" rows="auto, auto, *">
+      <StackLayout row="0" padding="12">
+        <Label text="{{ heading }}" color="#ffffff" fontWeight="bold" fontSize="17" textWrap="true" />
+        <Label text="{{ description }}" color="#bfdbfe" fontSize="13" textWrap="true" />
+      </StackLayout>
+
+      <GridLayout row="1" columns="*, *, *" padding="8">
+        <Button col="0" text="&lt; prev" tap="{{ prev }}" color="#ffffff" backgroundColor="#1e40af" />
+        <Button col="1" text="next &gt;" tap="{{ next }}" color="#ffffff" backgroundColor="#1e40af" />
+        <Button col="2" text="back" tap="{{ back }}" color="#ffffff" backgroundColor="#1e40af" />
+      </GridLayout>
+
+      <ScrollView row="2">
+        <StackLayout padding="12">
+          <Label text="probe padding" color="#ffffff" fontWeight="bold" />
+          <Label text="{{ padding }}" color="#bfdbfe" fontFamily="monospace" fontSize="13" textWrap="true" />
+          <Label text="getEdgeInsets (l,t,r,b)" color="#ffffff" fontWeight="bold" marginTop="8" />
+          <Label text="{{ edgeInsets }}" color="#bfdbfe" fontFamily="monospace" fontSize="13" textWrap="true" />
+          <Label text="getImeInsets (l,t,r,b)" color="#ffffff" fontWeight="bold" marginTop="8" />
+          <Label text="{{ imeInsets }}" color="#bfdbfe" fontFamily="monospace" fontSize="13" textWrap="true" />
+          <Label text="window insets" color="#ffffff" fontWeight="bold" marginTop="8" />
+          <Label text="{{ windowInsets }}" color="#bfdbfe" fontFamily="monospace" fontSize="13" textWrap="true" />
+          <Label text="{{ hint }}" color="#fde68a" fontSize="13" textWrap="true" marginTop="12" />
+        </StackLayout>
+      </ScrollView>
+
+    </GridLayout>
+  </GridLayout>
+</Page>
```

**File**: `apps/toolbox/src/pages/ete/hub.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import { EventData, Frame, Observable, Page, View } from '@nativescript/core';
+import { deviceSummary, readWindowInsets } from './shared';
+
+export function navigatingTo(args: EventData) {
+	const page = <Page>args.object;
+	const model = new Observable();
+	model.set('device', deviceSummary());
+	model.set('windowInsets', 'reading...');
+	model.set('open', (tap: EventData) => {
+		Frame.topmost().navigate({ moduleName: `pages/${(tap.object as View).id}` });
+	});
+	page.bindingContext = model;
+
+	setTimeout(() => model.set('windowInsets', readWindowInsets(page)), 120);
+}
```

**File**: `apps/toolbox/src/pages/ete/hub.xml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+<Page xmlns="http://schemas.nativescript.org/tns.xsd" navigatingTo="navigatingTo" androidOverflowEdge="none" backgroundColor="#3f0d12">
+  <Page.actionBar>
+    <ActionBar title="Edge to Edge tests" class="action-bar" />
+  </Page.actionBar>
+  <ScrollView>
+    <StackLayout class="p-20">
+      <Label text="{{ device }}" textWrap="true" color="#fca5a5" fontSize="13" marginBottom="4" />
+      <Label text="{{ windowInsets }}" textWrap="true" color="#fca5a5" fontSize="13" fontFamily="monospace" marginBottom="16" />
+
+      <Label text="Colour legend" color="#ffffff" fontWeight="bold" marginBottom="6" />
+      <GridLayout columns="auto, *" rows="auto, auto, auto, auto" marginBottom="20">
+        <StackLayout row="0" col="0" width="24" height="24" backgroundColor="#3f0d12" borderWidth="1" borderColor="#ffffff" margin="2" />
+        <Label row="0" col="1" text="backdrop - nothing reached here" color="#ffffff" marginLeft="8" verticalAlignment="center" />
+        <StackLayout row="1" col="0" width="24" height="24" backgroundColor="#166534" margin="2" />
+        <Label row="1" col="1" text="probe - the ring you see is its padding" color="#ffffff" marginLeft="8" verticalAlignment="center" />
+        <StackLayout row="2" col="0" width="24" height="24" backgroundColor="#1d4ed8" margin="2" />
+        <Label row="2" col="1" text="inner - what is left after the probe padded" color="#ffffff" marginLeft="8" verticalAlignment="center" />
+        <StackLayout row="3" col="0" width="24" height="24" backgroundColor="#b45309" margin="2" />
+        <Label row="3" col="1" text="core - third level, for the nested tests" color="#ffffff" marginLeft="8" verticalAlignment="center" />
+      </GridLayout>
+
+      <Button text="1. Edge matrix" tap="{{ open }}" id="ete/edges" class="btn btn-primary btn-view-demo" />
+      <Button text="2. Nested consume (dont-apply)" tap="{{ open }}" id="ete/nested" class="btn btn-primary btn-view-demo" />
+      <Button text="3. Keyboard insets" tap="{{ open }}" id="ete/ime" class="btn btn-primary btn-view-demo" />
+      <Button text="4. Lifecycle and reset" tap="{{ open }}" id="ete/lifecycle" class="btn btn-primary btn-view-demo" />
+      <Button text="5. Modals" tap="{{ open }}" id="ete/modals" class="btn btn-primary btn-view-demo" />
+      <Button text="6. System bars" tap="{{ open }}" id="ete/bars" class="btn btn-primary btn-view-demo" />
+      <Button text="7. Scrolling content" tap="{{ open }}" id="ete/scroll" class="btn btn-primary btn-view-demo" />
+    </StackLayout>
+  </ScrollView>
+</Page>
```

**File**: `apps/toolbox/src/pages/ete/ime.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { EventData, Frame, GridLayout, Observable, Page, TextField, Utils } from '@nativescript/core';
+import { readEdges } from './shared';
+
+class Ime extends Observable {
+	private ownPadding = 0;
+
+	constructor(private page: Page) {
+		super();
+		// Poll instead of waiting on a layout pass: the keyboard animates in and the
+		// interesting numbers are the ones after it settles.
+		const timer = setInterval(() => this.refresh(), 250);
+		this.page.on(Page.navigatedFromEvent, () => clearInterval(timer));
+	}
+
+	get probe(): GridLayout {
+		return this.page.getViewById<GridLayout>('probe');
+	}
+
+	/** Raising the app's own padding while the keyboard is up must not eat the keyboard gap. */
+	bumpPadding = () => {
+		this.ownPadding = this.ownPadding ? 0 : 24;
+		this.probe.padding = this.ownPadding;
+		setTimeout(() => this.refresh(), 60);
+	};
+
+	dismiss = () => {
+		this.page.getViewById<TextField>('field').dismissSoftInput();
+	};
+
+	back = () => {
+		Frame.topmost().goBack();
+	};
+
+	refresh() {
+		const readout = readEdges(this.probe);
+		this.set('padding', readout.padding);
+		this.set('edgeInsets', `edge  ${readout.edgeInsets}`);
+		this.set('imeInsets', `ime   ${readout.imeInsets}`);
+
+		const native = this.probe?.android as org.nativescript.widgets.LayoutBase;
+		if (!native?.getImeInsets) {
+			return;
+		}
+
+		// toDevicePixels can land on a half pixel; the view rounds it, so compare rounded.
+		const own = Math.round(Utils.layout.toDevicePixels(this.ownPadding));
+		const expected = own + Math.max(native.getEdgeInsets().bottom, native.getImeInsets().bottom);
+		const actual = native.getPaddingBottom();
+		this.set('verdict', actual === expected ? `PASS - bottom padding ${actual} = own ${own} + max(nav, ime)` : `FAIL - bottom padding ${actual}, expected ${expected}`);
+	}
+}
+
+export function navigatingTo(args: EventData) {
+	const page = <Page>args.object;
+	page.bindingContext = new Ime(page);
+}
```

---

### Incident Patch 4: `1cf6c9fc` (2026-10-02)
**Commit Message**: chore(deps-dev): bump @nativescript/android from 9.0.5 to 9.1.1 in /apps/ui (#11502)

chore(deps-dev): bump @nativescript/android in /apps/ui

Bumps [@nativescript/android](https://github.com/NativeScript/android) from 9.0.5 to 9.1.1.
- [Release notes](https://github.com/NativeScript/android/releases)
- [Changelog](https://github.com/NativeScript/android/blob/main/CHANGELOG.md)
- [Commits](https://github.com/NativeScript/android/compare/v9.0.5...v9.1.1)

---
updated-dependencies:
- dependency-name: "@nativescript/android"
  dependency-version: 9.1.1
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
[skip ci]

**File**: `apps/ui/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     "nativescript-theme-core": "^1.0.4"
   },
   "devDependencies": {
-    "@nativescript/android": "~9.0.0",
+    "@nativescript/android": "~9.1.1",
     "@nativescript/ios": "~9.0.0",
     "@nativescript/visionos": "~9.0.0",
     "@nativescript/webpack": "file:../../dist/packages/webpack5",
```

---

### Incident Patch 5: `e8e91890` (2026-10-01)
**Commit Message**: chore(deps): bump step-security/harden-runner from 2.21.0 to 2.21.1 (#11485)

Bumps [step-security/harden-runner](https://github.com/step-security/harden-runner) from 2.21.0 to 2.21.1.
- [Release notes](https://github.com/step-security/harden-runner/releases)
- [Commits](https://github.com/step-security/harden-runner/compare/05e31511f85b41b11d1cf0ef85d0992719546e2c...e14015d583714f6e62063499dc959a02595150a1)

---
updated-dependencies:
- dependency-name: step-security/harden-runner
  dependency-version: 2.21.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
[skip ci]

**File**: `.github/workflows/npm_release_tns_core.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ jobs:
 
     steps:
       - name: Harden the runner (Audit all outbound calls)
-        uses: step-security/harden-runner@05e31511f85b41b11d1cf0ef85d0992719546e2c # v2.21.0
+        uses: step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1 # v2.21.1
         with:
           egress-policy: audit
 
```

**File**: `.github/workflows/npm_release_types.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ jobs:
 
     steps:
       - name: Harden the runner (Audit all outbound calls)
-        uses: step-security/harden-runner@05e31511f85b41b11d1cf0ef85d0992719546e2c # v2.21.0
+        uses: step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1 # v2.21.1
         with:
           egress-policy: audit
 
```

**File**: `.github/workflows/npm_release_webpack.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
 
     steps:
       - name: Harden the runner (Audit all outbound calls)
-        uses: step-security/harden-runner@05e31511f85b41b11d1cf0ef85d0992719546e2c # v2.21.0
+        uses: step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1 # v2.21.1
         with:
           egress-policy: audit
 
```

**File**: `.github/workflows/preview-release.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Harden the runner (Audit all outbound calls)
-        uses: step-security/harden-runner@05e31511f85b41b11d1cf0ef85d0992719546e2c # v2.21.0
+        uses: step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1 # v2.21.1
         with:
           egress-policy: audit
 
```

**File**: `.github/workflows/secure_nx_release.yml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ jobs:
 
     steps:
       - name: Harden the runner (Audit all outbound calls)
-        uses: step-security/harden-runner@05e31511f85b41b11d1cf0ef85d0992719546e2c # v2.21.0
+        uses: step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1 # v2.21.1
         with:
           egress-policy: audit
 
```

---

### Incident Patch 6: `648cff75` (2026-09-30)
**Commit Message**: fix(vite): decode percent-encoded /ns/m request paths (#11483)

[skip ci]

**File**: `packages/vite/hmr/frameworks/vue/server/sfc-route-serve.ts` (modified, +4/-0)
```diff
@@ -57,6 +57,10 @@ export function registerSfcServeRoute(server: ViteDevServer, options: RegisterSf
 			}
 			if (pathStyle && pathStyle !== '/' && !pathParam) {
 				if (!pathStyle.startsWith('/')) pathStyle = '/' + pathStyle;
+				// URL.pathname stays percent-encoded; decode before the query is appended.
+				try {
+					pathStyle = decodeURI(pathStyle);
+				} catch {}
 				// Include endpoint query for variant-style requests (e.g. /ns/sfc/Comp.vue?vue&type=template)
 				pathParam = pathStyle + (urlObj.search || '');
 			}
```

**File**: `packages/vite/hmr/frameworks/vue/server/websocket-sfc.spec.ts` (modified, +11/-0)
```diff
@@ -88,6 +88,17 @@ describe('registerSfcHandlers', () => {
 			expect(res.body).toContain('export { default } from "/ns/asm?path=%2Fsrc%2FApp.vue";');
 		});
 
+		it('decodes percent-encoded path-style specs (device-encoded bracketed files)', async () => {
+			const { sfc, transformRequest } = mount();
+			transformRequest.mockResolvedValue({ code: 'export default {}' });
+			const res = makeRes();
+			await sfc({ url: '/ns/sfc/src/pages/%5Bid%5D.vue' }, res, vi.fn());
+			expect(transformRequest).toHaveBeenCalledWith('/src/pages/[id].vue?vue');
+			expect(res.statusCode).toBe(200);
+			expect(res.body).toContain('path=/src/pages/[id].vue');
+			expect(res.body).toContain(`export * from "/ns/asm?path=${encodeURIComponent('/src/pages/[id].vue')}";`);
+		});
+
 		it('returns an empty module for style variants', async () => {
 			const { sfc, transformRequest } = mount();
 			transformRequest.mockResolvedValue({ code: '/* css */' });
```

**File**: `packages/vite/hmr/server/websocket-ns-m-request.spec.ts` (modified, +36/-0)
```diff
@@ -19,6 +19,42 @@ describe('createNsMRequestContext', () => {
 		expect(result.value.bootTaggedRequest).toBe(false);
 	});
 
+	it('decodes percent-encoded pathname specs (device-encoded bracketed files)', () => {
+		const encoded = createNsMRequestContext('/ns/m/packages/app/src/app/demo/%5Bid%5D.tsrx?import', '/workspace', '/src/');
+		const raw = createNsMRequestContext('/ns/m/packages/app/src/app/demo/[id].tsrx?import', '/workspace', '/src/');
+
+		expect(encoded.kind).toBe('context');
+		expect(raw.kind).toBe('context');
+		if (encoded.kind !== 'context' || raw.kind !== 'context') {
+			return;
+		}
+
+		expect(encoded.value.spec).toBe('/packages/app/src/app/demo/[id].tsrx');
+		expect(encoded.value.spec).toBe(raw.value.spec);
+	});
+
+	it('does not double-decode the already-decoded ?path= spec', () => {
+		const result = createNsMRequestContext('/ns/m/?path=/app/demo/%255Bid%255D.tsrx', '/workspace', '/src/');
+
+		expect(result.kind).toBe('context');
+		if (result.kind !== 'context') {
+			return;
+		}
+
+		expect(result.value.spec).toBe('/app/demo/%5Bid%5D.tsrx');
+	});
+
+	it('leaves encoded reserved characters encoded, matching Vite', () => {
+		const result = createNsMRequestContext('/ns/m/app/a%3Fb%23c%2Fd.ts', '/workspace', '/src/');
+
+		expect(result.kind).toBe('context');
+		if (result.kind !== 'context') {
+			return;
+		}
+
+		expect(result.value.spec).toBe('/app/a%3Fb%23c%2Fd.ts');
+	});
+
 	it('returns a response module for blocked build-time node_modules imports', () => {
 		const result = createNsMRequestContext('/ns/m/node_modules/vite/dist/index.js', '/workspace', '/src/');
 
```

**File**: `packages/vite/hmr/server/websocket-ns-m-request.ts` (modified, +9/-0)
```diff
@@ -89,12 +89,14 @@ export function createNsMRequestContext(requestUrl: string, serverRoot: string,
 		let spec = urlObj.searchParams.get('path') || '';
 		let forcedVer = urlObj.searchParams.get('v');
 		let bootTaggedRequest = false;
+		let specFromPathname = false;
 
 		if (!spec) {
 			const base = '/ns/m';
 			const rest = urlObj.pathname.slice(base.length);
 			if (rest && rest !== '/') {
 				spec = rest;
+				specFromPathname = true;
 			}
 		}
 
@@ -115,6 +117,13 @@ export function createNsMRequestContext(requestUrl: string, serverRoot: string,
 		}
 
 		spec = spec.replace(/[?#].*$/, '');
+		// URL.pathname stays percent-encoded (URLSearchParams already decoded
+		// `path`). decodeURI matches Vite's transform middleware.
+		if (specFromPathname) {
+			try {
+				spec = decodeURI(spec);
+			} catch {}
+		}
 		const decorated = collapseLegacyNsMTags(spec, 'inbound-request-spec');
 		spec = decorated.cleanedSpec;
 		bootTaggedRequest = decorated.bootTaggedRequest;
```

---

### Incident Patch 7: `35521728` (2026-09-30)
**Commit Message**: fix(core): iOS child index mapping skips the glass effect subview (#11410)

[skip ci]

**File**: `packages/core/ui/core/view/index.ios.ts` (modified, +13/-0)
```diff
@@ -1003,6 +1003,19 @@ export class View extends ViewCommon {
 		IOSHelper.invalidateStatusBarAppearance(ownerController, `View.updateStatusBarStyle:${value}`);
 	}
 
+	public _childIndexToNativeChildIndex(index?: number): number {
+		if (typeof index !== 'number') {
+			return index;
+		}
+		// The glass effect view is a subview but not a child: it sits at subview
+		// 0, so every child's subview index is one past its child index.
+		const effectView = this._glassEffectView;
+		if (effectView && effectView.superview === this.nativeViewProtected) {
+			return index + 1;
+		}
+		return index;
+	}
+
 	[iosGlassEffectProperty.setNative](value: GlassEffectType) {
 		if (!this.nativeViewProtected || !supportsGlass()) {
 			return;
```

**File**: `packages/core/ui/layouts/layout-base-common.ts` (modified, +2/-1)
```diff
@@ -147,7 +147,8 @@ export class LayoutBaseCommon extends CustomLayoutView implements LayoutBaseDefi
 			result += this._subViews[i]._getNativeViewsCount();
 		}
 
-		return result;
+		// The platform base accounts for native subviews that are not children.
+		return super._childIndexToNativeChildIndex(result);
 	}
 
 	public eachChildView(callback: (child: View) => boolean): void {
```

---

### Incident Patch 8: `c9250ecb` (2026-09-30)
**Commit Message**: fix(core): iOS scrollToVerticalOffset lands past the offset when there is a content inset (#11409)

[skip ci]

**File**: `packages/core/ui/scroll-view/index.ios.ts` (modified, +16/-6)
```diff
@@ -153,17 +153,27 @@ export class ScrollView extends ScrollViewBase {
 		this.updateContentInsetAdjustmentBehavior(value);
 	}
 
+	// The offset is set directly rather than through scrollRectToVisible with a
+	// viewport-sized rect: that rect cannot fit inside a content inset, so UIKit
+	// would land contentInset.bottom (or .right) past the requested offset. The
+	// value is clamped to the range a user scroll can reach.
 	public scrollToVerticalOffset(value: number, animated: boolean) {
-		if (this.nativeViewProtected && this.orientation === 'vertical' && this.isScrollEnabled) {
-			const bounds = this.nativeViewProtected.bounds.size;
-			this.nativeViewProtected.scrollRectToVisibleAnimated(CGRectMake(0, value, bounds.width, bounds.height), animated);
+		const nativeView = this.nativeViewProtected;
+		if (nativeView && this.orientation === 'vertical' && this.isScrollEnabled) {
+			const inset = nativeView.adjustedContentInset;
+			const min = -inset.top;
+			const max = Math.max(min, nativeView.contentSize.height + inset.bottom - nativeView.bounds.size.height);
+			nativeView.setContentOffsetAnimated(CGPointMake(nativeView.contentOffset.x, Math.min(Math.max(value, min), max)), animated);
 		}
 	}
 
 	public scrollToHorizontalOffset(value: number, animated: boolean) {
-		if (this.nativeViewProtected && this.orientation === 'horizontal' && this.isScrollEnabled) {
-			const bounds = this.nativeViewProtected.bounds.size;
-			this.nativeViewProtected.scrollRectToVisibleAnimated(CGRectMake(value, 0, bounds.width, bounds.height), animated);
+		const nativeView = this.nativeViewProtected;
+		if (nativeView && this.orientation === 'horizontal' && this.isScrollEnabled) {
+			const inset = nativeView.adjustedContentInset;
+			const min = -inset.left;
+			const max = Math.max(min, nativeView.contentSize.width + inset.right - nativeView.bounds.size.width);
+			nativeView.setContentOffsetAnimated(CGPointMake(Math.min(Math.max(value, min), max), nativeView.contentOffset.y), animated);
 		}
 	}
 
```

---

### Incident Patch 9: `5fa2a5bd` (2026-09-30)
**Commit Message**: fix(core): insert iOS child views relative to their sibling, not by raw index (#11406)

[skip ci]

**File**: `packages/core/ui/action-bar/index.android.ts` (modified, +1/-5)
```diff
@@ -385,11 +385,7 @@ export class ActionBar extends ActionBarBase {
 		super._addViewToNativeVisualTree(child);
 
 		if (this.nativeViewProtected && child.nativeViewProtected) {
-			if (atIndex >= this.nativeViewProtected.getChildCount()) {
-				this.nativeViewProtected.addView(child.nativeViewProtected);
-			} else {
-				this.nativeViewProtected.addView(child.nativeViewProtected, atIndex);
-			}
+			AndroidHelper.insertNativeSubview(this.nativeViewProtected, child.nativeViewProtected, atIndex);
 
 			return true;
 		}
```

**File**: `packages/core/ui/core/view/index.android.ts` (modified, +1/-1)
```diff
@@ -1826,7 +1826,7 @@ export class CustomLayoutView extends ContainerView {
 			if (Trace.isEnabled()) {
 				Trace.write(`${this}.nativeView.addView(${child}.nativeView, ${atIndex})`, Trace.categories.VisualTreeEvents);
 			}
-			this.nativeViewProtected.addView(child.nativeViewProtected, atIndex);
+			AndroidHelper.insertNativeSubview(this.nativeViewProtected, child.nativeViewProtected, atIndex);
 			if (child instanceof View) {
 				this._updateNativeLayoutParams(child);
 			}
```

**File**: `packages/core/ui/core/view/index.ios.ts` (modified, +1/-5)
```diff
@@ -1270,11 +1270,7 @@ export class CustomLayoutView extends ContainerView {
 		const childNativeView: NativeScriptUIView = <NativeScriptUIView>child.nativeViewProtected;
 
 		if (parentNativeView && childNativeView) {
-			if (typeof atIndex !== 'number' || atIndex >= parentNativeView.subviews.count) {
-				parentNativeView.addSubview(childNativeView);
-			} else {
-				parentNativeView.insertSubviewAtIndex(childNativeView, atIndex);
-			}
+			IOSHelper.insertNativeSubview(parentNativeView, childNativeView, atIndex);
 
 			// Add outer shadow layer manually as it belongs to parent layer tree (this is needed for reusable views)
 			if (childNativeView.outerShadowContainerLayer && !childNativeView.outerShadowContainerLayer.superlayer) {
```

**File**: `packages/core/ui/core/view/view-helper/index.android.spec.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect, vi } from 'vitest';
+
+vi.hoisted(() => {
+	(globalThis as any).androidx = { core: { graphics: {} } };
+});
+
+import { AndroidHelper } from './index.android';
+
+/** Models android.view.ViewGroup, including its IndexOutOfBoundsException for out-of-range indexes. */
+class FakeViewGroup {
+	readonly children: string[] = [];
+
+	getChildCount(): number {
+		return this.children.length;
+	}
+
+	addView(view: string, index?: number): void {
+		if (index === undefined || index === -1) {
+			this.children.push(view);
+			return;
+		}
+		if (index < 0 || index > this.children.length) {
+			throw new Error(`IndexOutOfBoundsException: index=${index} count=${this.children.length}`);
+		}
+		this.children.splice(index, 0, view);
+	}
+}
+
+function parentWith(...views: string[]): FakeViewGroup {
+	const parent = new FakeViewGroup();
+	parent.children.push(...views);
+	return parent;
+}
+
+describe('AndroidHelper.insertNativeSubview', () => {
+	it('inserts at the child index', () => {
+		const parent = parentWith('a', 'b', 'c');
+		AndroidHelper.insertNativeSubview(parent as any, 'x' as any, 1);
+		expect(parent.children).toEqual(['a', 'x', 'b', 'c']);
+	});
+
+	it('appends when the index is absent, negative, or out of range', () => {
+		const parent = parentWith('a', 'b');
+		AndroidHelper.insertNativeSubview(parent as any, 'x' as any);
+		AndroidHelper.insertNativeSubview(parent as any, 'y' as any, -1);
+		AndroidHelper.insertNativeSubview(parent as any, 'z' as any, Number.MAX_SAFE_INTEGER);
+		expect(parent.children).toEqual(['a', 'b', 'x', 'y', 'z']);
+	});
+});
```

**File**: `packages/core/ui/core/view/view-helper/index.android.ts` (modified, +8/-0)
```diff
@@ -51,6 +51,14 @@ export class AndroidHelper {
 		}
 	}
 
+	static insertNativeSubview(parentNativeView: android.view.ViewGroup, childNativeView: android.view.View, atIndex?: number): void {
+		if (typeof atIndex !== 'number' || atIndex < 0 || atIndex >= parentNativeView.getChildCount()) {
+			parentNativeView.addView(childNativeView);
+		} else {
+			parentNativeView.addView(childNativeView, atIndex);
+		}
+	}
+
 	static getCopyOrDrawable(drawable: android.graphics.drawable.Drawable, resources?: android.content.res.Resources): android.graphics.drawable.Drawable {
 		if (drawable) {
 			const constantState = drawable.getConstantState();
```

**File**: `packages/core/ui/core/view/view-helper/index.d.ts` (modified, +14/-0)
```diff
@@ -41,6 +41,13 @@ export namespace AndroidHelper {
 	export function setDrawableColor(color: number, drawable: any /* android.graphics.drawable.Drawable */, blendMode?: any /* androidx.core.graphics.BlendModeCompat */): void;
 	export function clearDrawableColor(drawable: any /* android.graphics.drawable.Drawable */): void;
 	export function getCopyOrDrawable(drawable: any /* android.graphics.drawable.Drawable */, resources?: any /* android.content.res.Resources */): any; /* android.graphics.drawable.Drawable */
+	/**
+	 * Inserts a native child view at a child index, appending when the index is absent or out of range.
+	 * @param parentNativeView Parent ViewGroup.
+	 * @param childNativeView Android view to insert.
+	 * @param atIndex Child index to insert at.
+	 */
+	export function insertNativeSubview(parentNativeView: any /* android.view.ViewGroup */, childNativeView: any /* android.view.View */, atIndex?: number): void;
 }
 
 /**
@@ -66,6 +73,13 @@ export namespace IOSHelper {
 	export function invalidateStatusBarAppearance(controller?: any /* UIViewController */, reason?: string): void;
 	export function updateAutoAdjustScrollInsets(controller: any /* UIViewController */, owner: View): void;
 	export function updateConstraints(controller: any /* UIViewController */, owner: View): void;
+	/**
+	 * Inserts a native subview at a subview index, appending when the index is absent or out of range.
+	 * @param parentNativeView Parent UIView.
+	 * @param childNativeView UIView to insert.
+	 * @param atIndex Subview index to insert at.
+	 */
+	export function insertNativeSubview(parentNativeView: any /* UIView */, childNativeView: any /* UIView */, atIndex?: number): void;
 	export function layoutView(controller: any /* UIViewController */, owner: View): void;
 	export function getPositionFromFrame(frame: any /* CGRect */): Position;
 	export function getFrameFromPosition(position: Position, insets?: Position): any; /* CGRect */
```

**File**: `packages/core/ui/core/view/view-helper/index.ios.spec.ts` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+import { describe, it, expect } from 'vitest';
+import { IOSHelper } from './index.ios';
+
+/** Models UIView's subview ordering; `insertSubviewAtIndex` is absent so any use of it throws. */
+class FakeUIView {
+	readonly children: FakeUIView[] = [];
+
+	constructor(readonly tag: string) {}
+
+	get subviews() {
+		const children = this.children;
+		return {
+			count: children.length,
+			objectAtIndex: (index: number) => children[index],
+		};
+	}
+
+	addSubview(view: FakeUIView): void {
+		this.children.push(view);
+	}
+
+	insertSubviewBelowSubview(view: FakeUIView, sibling: FakeUIView): void {
+		this.children.splice(this.children.indexOf(sibling), 0, view);
+	}
+}
+
+function parentWith(...tags: string[]): FakeUIView {
+	const parent = new FakeUIView('parent');
+	for (const tag of tags) {
+		parent.addSubview(new FakeUIView(tag));
+	}
+	return parent;
+}
+
+function order(parent: FakeUIView): string[] {
+	return parent.children.map((child) => child.tag);
+}
+
+describe('IOSHelper.insertNativeSubview', () => {
+	it('inserts below the subview currently at the index', () => {
+		const parent = parentWith('a', 'b', 'c');
+		IOSHelper.insertNativeSubview(parent as any, new FakeUIView('x') as any, 1);
+		expect(order(parent)).toEqual(['a', 'x', 'b', 'c']);
+	});
+
+	it('inserts at the front for index 0', () => {
+		const parent = parentWith('a', 'b');
+		IOSHelper.insertNativeSubview(parent as any, new FakeUIView('x') as any, 0);
+		expect(order(parent)).toEqual(['x', 'a', 'b']);
+	});
+
+	it('appends when the index is absent or out of range', () => {
+		const parent = parentWith('a', 'b');
+		IOSHelper.insertNativeSubview(parent as any, new FakeUIView('x') as any);
+		IOSHelper.insertNativeSubview(parent as any, new FakeUIView('y') as any, 3);
+		IOSHelper.insertNativeSubview(parent as any, new FakeUIView('z') as any, Number.MAX_SAFE_INTEGER);
+		expect(order(parent)).toEqual(['a', 'b', 'x', 'y', 'z']);
+	});
+});
```

**File**: `packages/core/ui/core/view/view-helper/index.ios.ts` (modified, +10/-0)
```diff
@@ -312,6 +312,16 @@ export class IOSHelper {
 		return rootView.safeAreaLayoutGuide;
 	}
 
+	static insertNativeSubview(parentNativeView: UIView, childNativeView: UIView, atIndex?: number): void {
+		const subviews = parentNativeView.subviews;
+		if (typeof atIndex !== 'number' || atIndex >= subviews.count) {
+			parentNativeView.addSubview(childNativeView);
+		} else {
+			// insertSubview:atIndex: also counts non-view sublayers, e.g. gradient backgrounds
+			parentNativeView.insertSubviewBelowSubview(childNativeView, subviews.objectAtIndex(atIndex));
+		}
+	}
+
 	static layoutView(controller: UIViewController, owner: View): void {
 		let layoutGuide = controller.view.safeAreaLayoutGuide;
 		if (!layoutGuide) {
```

---

### Incident Patch 10: `282205d2` (2026-09-30)
**Commit Message**: fix(vite): start HMR graph population after every plugin's configureServer (#11479)

[skip ci]

**File**: `packages/vite/hmr/server/websocket-populate-order.spec.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { createServer, type Plugin } from 'vite';
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { getProjectAppPath } from '../../helpers/utils.js';
+import { hmrWebSocketPluginForFlavor } from './websocket.js';
+
+describe('HMR graph population start', () => {
+	let root: string;
+
+	afterEach(() => {
+		rmSync(root, { recursive: true, force: true });
+	});
+
+	it('waits until every plugin has run configureServer before transforming app modules', async () => {
+		root = realpathSync(mkdtempSync(join(tmpdir(), 'ns-hmr-populate-order-')));
+		mkdirSync(join(root, getProjectAppPath()), { recursive: true });
+		writeFileSync(join(root, getProjectAppPath(), 'probe.ts'), 'export const probe = 1;\n');
+
+		// Stands in for plugins ordered between the HMR plugin and the framework
+		// plugin whose configureServer awaits (the vue config's type-check plugins).
+		const slowPlugin: Plugin = {
+			name: 'slow-configure-server',
+			async configureServer() {
+				await new Promise((resolve) => setTimeout(resolve, 150));
+			},
+		};
+		// Stands in for @vitejs/plugin-vue, which only receives the dev server in
+		// its own configureServer and compiles SFCs differently before that.
+		let configured = false;
+		const transformsBeforeConfigured: string[] = [];
+		const transformsAfterConfigured: string[] = [];
+		const lateFrameworkPlugin: Plugin = {
+			name: 'late-framework-plugin',
+			configureServer() {
+				configured = true;
+			},
+			transform(_code, id) {
+				(configured ? transformsAfterConfigured : transformsBeforeConfigured).push(id);
+			},
+		};
+
+		const server = await createServer({
+			root,
+			configFile: false,
+			logLevel: 'silent',
+			server: { port: 0, hmr: false },
+			plugins: [hmrWebSocketPluginForFlavor('typescript', {})!, slowPlugin, lateFrameworkPlugin],
+		});
+		try {
+			await new Promise((resolve) => setTimeout(resolve, 300));
+			expect(configured).toBe(true);
+			expect(transformsBeforeConfigured).toEqual([]);
+			expect(transformsAfterConfigured).toContain(join(root, getProjectAppPath(), 'probe.ts'));
+		} finally {
+			await server.close();
+		}
+	});
+});
```

**File**: `packages/vite/hmr/server/websocket.ts` (modified, +22/-18)
```diff
@@ -531,24 +531,16 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 				next();
 			});
 
-			// Give `populateInitialGraph` a head start: kicking it off at
-			// `configureServer` time gives populate the full app build/launch
-			// window (typically 2-3s on simulator), so more of its work lands
-			// before the device even connects and starts competing for the
-			// transform slots. Disable via `NS_VITE_HMR_DISABLE_POPULATE=1`
-			// when profiling whether populate is helping or hurting a
-			// specific app.
-			try {
-				const disablePopulate = process.env.NS_VITE_HMR_DISABLE_POPULATE === '1' || process.env.NS_VITE_HMR_DISABLE_POPULATE === 'true';
-				if (disablePopulate) {
-					if (verbose) console.info('[hmr-ws][populate] disabled via NS_VITE_HMR_DISABLE_POPULATE');
-					// Short-circuit: mark as resolved so /ns/m never schedules it and
-					// HMR still works (handleHotUpdate just has no pre-warmed graph).
-					graphInitialPopulationPromise = Promise.resolve();
-				} else {
-					ensureInitialGraphPopulationStarted(server);
-				}
-			} catch {}
+			// Populate is started from the post hook returned below, not here.
+			// Disable via `NS_VITE_HMR_DISABLE_POPULATE=1` when profiling whether
+			// populate is helping or hurting a specific app.
+			const disablePopulate = process.env.NS_VITE_HMR_DISABLE_POPULATE === '1' || process.env.NS_VITE_HMR_DISABLE_POPULATE === 'true';
+			if (disablePopulate) {
+				if (verbose) console.info('[hmr-ws][populate] disabled via NS_VITE_HMR_DISABLE_POPULATE');
+				// Short-circuit: mark as resolved so /ns/m never schedules it and
+				// HMR still works (handleHotUpdate just has no pre-warmed graph).
+				graphInitialPopulationPromise = Promise.resolve();
+			}
 
 			// Attempt early vendor manifest bootstrap once per server.
 			if (!vendorBootstrapDone) {
@@ -801,6 +793,18 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 				}
 				moduleGraph.emitFullGraph(ws as any);
 			});
+
+			// Vite runs post hooks after every plugin's `configureServer`. Starting
+			// populate any earlier transforms modules before framework plugins hold
+			// the dev server (@vitejs/plugin-vue then emits SFCs without HMR code
+			// and with their script imports split out of the graph), and the shared
+			// transform cache serves those results to the device. It still gets the
+			// whole app build/launch window as a head start.
+			return () => {
+				try {
+					ensureInitialGraphPopulationStarted(server);
+				} catch {}
+			};
 		},
 
 		async handleHotUpdate(ctx) {
```

---

### Incident Patch 11: `e3719ada` (2026-09-29)
**Commit Message**: fix(vite): hot-update vue screens on plain .ts edits (#11478)

[skip ci]

**File**: `packages/vite/hmr/frameworks/angular/server/strategy.ts` (modified, +1/-1)
```diff
@@ -822,7 +822,7 @@ export const angularServerStrategy: FrameworkServerStrategy = {
 			}
 		}
 
-		walkForTemplates(path.join(root, 'src'));
+		walkForTemplates(path.join(root, ANGULAR_APP_DIR));
 		try {
 			for (const abs of templateFiles) {
 				try {
```

**File**: `packages/vite/hmr/frameworks/vue/client/index.ts` (modified, +1/-1)
```diff
@@ -539,7 +539,7 @@ function openHmrReplaceNavWindow(): () => void {
  * that matches no live instances is a no-op (component not currently
  * displayed); the caller treats that as handled.
  */
-function tryInPlaceVueReload(comp: any, rerenderOnly = false): boolean {
+export function tryInPlaceVueReload(comp: any, rerenderOnly = false): boolean {
 	try {
 		const rt: any = (getGlobalScope() as any).__VUE_HMR_RUNTIME__;
 		const id = comp && comp.__hmrId;
```

**File**: `packages/vite/hmr/frameworks/vue/client/strategy.spec.ts` (modified, +34/-0)
```diff
@@ -24,6 +24,7 @@ function makeDeps(overrides: Partial<VueDepPropagationDeps> = {}): VueDepPropaga
 	return {
 		findBoundaries: findNearestSfcBoundaries,
 		loadComponent: vi.fn(async () => ({ name: 'FreshComponent' })),
+		reloadInPlace: vi.fn(() => false),
 		sfcChangedInVersion: () => false,
 		getVersion: () => 42,
 		driveOverlay: driveVueSfcUpdateOverlay,
@@ -65,6 +66,39 @@ describe('propagateDepChangeToSfcBoundary', () => {
 		expect(stages).toEqual(['evicting', 'reimporting', 'rebooting', 'complete']);
 	});
 
+	it('reloads every importing .vue boundary in place, keeping the mounted root', async () => {
+		const graph = makeGraph([
+			['/app/app.ts', ['/app/components/Home.vue']],
+			['/app/components/Home.vue', ['/app/screens/ListenNow.vue', '/app/screens/AlbumDetail.vue']],
+			['/app/screens/AlbumDetail.vue', ['/app/music.ts']],
+			['/app/screens/ListenNow.vue', ['/app/music.ts']],
+			['/app/music.ts', []],
+		]);
+		const stages: string[] = [];
+		const ctx = makeCtx({ graph, getOverlay: () => ({ setUpdateStage: (stage: string) => stages.push(stage) }) });
+		const deps = makeDeps({ loadComponent: vi.fn(async (target: string) => ({ target })), reloadInPlace: vi.fn(() => true) });
+
+		expect(await propagateDepChangeToSfcBoundary(['/app/music.ts'], ctx, deps)).toBe(true);
+		expect(deps.reloadInPlace).toHaveBeenCalledWith({ target: '/app/screens/AlbumDetail.vue' });
+		expect(deps.reloadInPlace).toHaveBeenCalledWith({ target: '/app/screens/ListenNow.vue' });
+		expect(ctx.performResetRoot).not.toHaveBeenCalled();
+		expect(stages).toEqual(['evicting', 'reimporting', 'complete']);
+	});
+
+	it('remounts only the nearest boundary as root when in-place reload is unavailable', async () => {
+		const graph = makeGraph([
+			['/app/screens/AlbumDetail.vue', ['/app/music.ts']],
+			['/app/screens/ListenNow.vue', ['/app/music.ts']],
+			['/app/music.ts', []],
+		]);
+		const ctx = makeCtx({ graph });
+		const deps = makeDeps({ loadComponent: vi.fn(async (target: string) => ({ target })) });
+
+		expect(await propagateDepChangeToSfcBoundary(['/app/music.ts'], ctx, deps)).toBe(true);
+		expect(deps.loadComponent).toHaveBeenCalledTimes(1);
+		expect(ctx.performResetRoot).toHaveBeenCalledWith({ target: '/app/screens/AlbumDetail.vue' });
+	});
+
 	it('falls back when no .vue boundary imports the changed module', async () => {
 		const ctx = makeCtx({ graph: makeGraph([['/src/app.ts', ['/src/util.ts']]]) });
 		const deps = makeDeps();
```

**File**: `packages/vite/hmr/frameworks/vue/client/strategy.ts` (modified, +27/-20)
```diff
@@ -1,8 +1,8 @@
 import type { FrameworkClientStrategy, FrameworkClientMountContext, FrameworkClientBatchContext, FrameworkClientMessageContext } from '../../../client/framework-client-strategy.js';
 import { ENV_VERBOSE as VERBOSE, getGraphVersion } from '../../../client/utils.js';
-import { installNsVueDevShims, ensureBackWrapperInstalled, getRootForVue, loadSfcComponent, ensureVueGlobals, recordVuePayloadChanges, handleVueSfcRegistry, handleVueSfcRegistryUpdate, sfcArtifactMap, sfcChangedInVersion } from './index.js';
+import { installNsVueDevShims, ensureBackWrapperInstalled, getRootForVue, loadSfcComponent, ensureVueGlobals, recordVuePayloadChanges, handleVueSfcRegistry, handleVueSfcRegistryUpdate, sfcArtifactMap, sfcChangedInVersion, tryInPlaceVueReload } from './index.js';
 import { installVueNavigateUsingApp } from './navigate-app.js';
-import { driveVueSfcUpdateOverlay } from './vue-sfc-update-overlay.js';
+import { APPLIED_IN_PLACE, driveVueSfcUpdateOverlay } from './vue-sfc-update-overlay.js';
 import { findNearestSfcBoundaries } from './dep-propagation.js';
 
 const VUE_SFC_RE = /\.vue$/i;
@@ -11,6 +11,7 @@ const VUE_SFC_RE = /\.vue$/i;
 export interface VueDepPropagationDeps {
 	findBoundaries: typeof findNearestSfcBoundaries;
 	loadComponent: (targetVuePath: string) => Promise<any | null>;
+	reloadInPlace: (component: any) => boolean;
 	sfcChangedInVersion: (version: number) => boolean;
 	getVersion: () => number;
 	driveOverlay: typeof driveVueSfcUpdateOverlay;
@@ -19,22 +20,25 @@ export interface VueDepPropagationDeps {
 const defaultPropagationDeps: VueDepPropagationDeps = {
 	findBoundaries: findNearestSfcBoundaries,
 	loadComponent: loadSfcComponent,
+	reloadInPlace: (component) => tryInPlaceVueReload(component),
 	sfcChangedInVersion,
 	getVersion: getGraphVersion,
 	driveOverlay: driveVueSfcUpdateOverlay,
 };
 
 /**
  * Non-SFC dependency propagation. When a plain `.ts`/`.js` module changes, the
- * shared queue evicts + re-imports it, but the live component instance still
- * holds bindings to the OLD module instance — nothing on the Vue side remounts
+ * shared queue evicts + re-imports it, but the live component instances still
+ * hold bindings to the OLD module instance — nothing on the Vue side remounts
  * (the server only emits `ns:vue-sfc-registry-update` for `.vue` edits). Walk
- * the reverse import graph to the nearest `.vue` boundary and remount it the
- * same way the registry-update path does: `loadSfcComponent` re-assembles the
- * SFC at the bumped graph version, whose rewritten static imports resolve to
- * the freshly re-imported dep modules.
+ * the reverse import graph to every `.vue` boundary, re-assemble each one
+ * (`loadSfcComponent` links the freshly re-imported deps) and reload its
+ * mounted instances in place, as the registry-update path does. Boundaries
+ * with no mounted instance are a no-op for Vue's HMR runtime, so only visible
+ * components re-render and the app shell and navigation stay put. Without the
+ * runtime, the nearest boundary is remounted as the root instead.
  *
- * Returns true when a boundary remount cycle ran (and drove the overlay to
+ * Returns true when a propagation cycle ran (and drove the overlay to
  * 'complete' itself); false when the caller should fall through to the plain
  * overlay-complete frame (no boundary found, mixed batch handled by the
  * registry-update path, or missing context).
@@ -48,20 +52,23 @@ export async function propagateDepChangeToSfcBoundary(drained: string[], ctx: Fr
 		}
 		const boundaries = deps.findBoundaries(drained, ctx.graph);
 		if (!boundaries.length) return false;
-		// Remount the NEAREST boundary only — resetRoot replaces the whole root,
-		// so multiple resets would be wasted work with last-wins semantics. This
-		// mirrors the registry-update policy of remounting the SFC closest to the
-		// change. Surface skipped boundaries so multi-importer cases are diagnosable.
-		const target = boundaries[0];
-		if (boundaries.length > 1 && VERBOSE) {
-			console.log('[hmr][vue][dep-propagation] multiple SFC boundaries import the change; remounting nearest', { target, skipped: boundaries.slice(1) });
-		}
-		if (VERBOSE) console.log('[hmr][vue][dep-propagation] remounting SFC boundary for dep change', { target, drained });
+		if (VERBOSE) console.log('[hmr][vue][dep-propagation] reloading SFC boundaries for dep change', { boundaries, drained });
 		const performResetRoot = ctx.performResetRoot;
 		await deps.driveOverlay(
 			{
-				filePath: target,
-				loadComponent: () => deps.loadComponent(target),
+				filePath: boundaries[0],
+				loadComponent: async () => {
+					let reloaded = false;
+					for (const target of boundaries) {
+						const component = await deps.loadComponent(target);
+						if (!component) continue;
+						if (!deps.reloadInPlace(component)) {
+							return reloaded ? APPLIED_IN_PLACE : component;
+						}
+						reloaded = true;
+					}
+					return reloaded ? APPLIED_
```

**File**: `packages/vite/hmr/server/runtime-graph-filter.spec.ts` (modified, +28/-1)
```diff
@@ -1,6 +1,9 @@
+import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
 import { describe, expect, it } from 'vitest';
 
-import { isRuntimeGraphExcludedPath, matchesRuntimeGraphModuleId, shouldIncludeRuntimeGraphFile } from './runtime-graph-filter.js';
+import { isRuntimeGraphExcludedPath, listRuntimeGraphSourceFiles, matchesRuntimeGraphModuleId, shouldIncludeRuntimeGraphFile } from './runtime-graph-filter.js';
 
 const TS_PATTERN = /\.(ts|js|tsx|jsx|mjs)$/i;
 
@@ -45,3 +48,27 @@ describe('shouldIncludeRuntimeGraphFile / matchesRuntimeGraphModuleId', () => {
 		expect(matchesRuntimeGraphModuleId('/src/main.ts', '/src/', TS_PATTERN)).toBe(true);
 	});
 });
+
+describe('listRuntimeGraphSourceFiles', () => {
+	it('lists runtime source files under the app dir and skips dependency, hidden and test dirs', () => {
+		const root = realpathSync(mkdtempSync(join(tmpdir(), 'ns-runtime-graph-walk-')));
+		try {
+			const write = (rel: string) => {
+				mkdirSync(join(root, rel, '..'), { recursive: true });
+				writeFileSync(join(root, rel), '');
+			};
+			for (const rel of ['app/music.ts', 'app/screens/ListenNow.vue', 'app/app.css', 'app/types.d.ts', 'app/music.spec.ts', 'app/__mocks__/x.ts', 'app/node_modules/pkg/index.js', 'app/.cache/x.ts', 'src/other.ts']) {
+				write(rel);
+			}
+
+			const files = listRuntimeGraphSourceFiles(join(root, 'app'), /\.(vue|ts|js|mjs|tsx|jsx)$/i).sort();
+			expect(files).toEqual([join(root, 'app/music.ts'), join(root, 'app/screens/ListenNow.vue')]);
+		} finally {
+			rmSync(root, { recursive: true, force: true });
+		}
+	});
+
+	it('returns nothing for a missing dir', () => {
+		expect(listRuntimeGraphSourceFiles(join(tmpdir(), 'ns-runtime-graph-missing-dir'), TS_PATTERN)).toEqual([]);
+	});
+});
```

**File**: `packages/vite/hmr/server/runtime-graph-filter.ts` (modified, +30/-0)
```diff
@@ -1,3 +1,6 @@
+import { readdirSync, statSync } from 'fs';
+import * as path from 'path';
+
 export function normalizeRuntimeGraphPath(value: string): string {
 	return String(value || '')
 		.replace(/\\/g, '/')
@@ -29,3 +32,30 @@ export function matchesRuntimeGraphModuleId(value: string, appPrefix: string, fi
 	const normalized = normalizeRuntimeGraphPath(value);
 	return normalized.startsWith(appPrefix) && filePattern.test(normalized) && !isRuntimeGraphExcludedPath(normalized);
 }
+
+/**
+ * Absolute paths of the runtime-graph source files under `dir`, skipping
+ * dependency, hidden and test directories. Unreadable entries are ignored.
+ */
+export function listRuntimeGraphSourceFiles(dir: string, filePattern: RegExp): string[] {
+	const files: string[] = [];
+	const walk = (current: string) => {
+		let names: string[];
+		try {
+			names = readdirSync(current);
+		} catch {
+			return;
+		}
+		for (const name of names) {
+			if (name === 'node_modules' || name.startsWith('.') || shouldSkipRuntimeGraphDirectoryName(name)) continue;
+			const full = path.join(current, name);
+			try {
+				const stat = statSync(full);
+				if (stat.isDirectory()) walk(full);
+				else if (stat.isFile() && shouldIncludeRuntimeGraphFile(full, filePattern)) files.push(full);
+			} catch {}
+		}
+	};
+	walk(dir);
+	return files;
+}
```

**File**: `packages/vite/hmr/server/websocket.ts` (modified, +22/-48)
```diff
@@ -1,5 +1,4 @@
 import type { Plugin, ViteDevServer } from 'vite';
-import { createRequire } from 'node:module';
 import { readFileSync } from 'fs';
 import { WebSocketServer } from 'ws';
 import * as path from 'path';
@@ -17,7 +16,7 @@ import { javascriptServerStrategy } from '../frameworks/javascript/server/strate
 import { getFrameworkFlavor } from '../framework-flavors.js';
 import { getProjectAppPath, getProjectAppRelativePath, getProjectAppVirtualPath } from '../../helpers/utils.js';
 import { getVitePackageVersion } from '../../helpers/vite-package-version.js';
-import { shouldIncludeRuntimeGraphFile, shouldSkipRuntimeGraphDirectoryName } from './runtime-graph-filter.js';
+import { listRuntimeGraphSourceFiles } from './runtime-graph-filter.js';
 import { getHmrSourceRoots } from '../../helpers/hmr-scope.js';
 import { getTsConfigData } from '../../helpers/ts-config-paths.js';
 import { createAngularComponentUpdateLedger, normalizeHotReloadMatchPath, shouldSuppressAngularComponentUpdatePayload, shouldSuppressViteFullReloadPayload, type PendingAngularReloadSuppressionEntry } from '../frameworks/angular/server/websocket-angular-hot-update.js';
@@ -221,19 +220,6 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 		const tStart = Date.now();
 		const versionAtStart = moduleGraph.version;
 		const root = server.config.root || process.cwd();
-		// Avoid direct require in ESM build: lazily obtain fs & path via createRequire or dynamic import
-		let fs: typeof import('fs');
-		let pathMod: typeof import('path');
-		try {
-			// Prefer createRequire to stay synchronous
-			const req = createRequire(import.meta.url);
-			fs = req('fs');
-			pathMod = req('path');
-		} catch {
-			// Fallback to dynamic imports (should not normally happen)
-			fs = await import('fs');
-			pathMod = await import('path');
-		}
 		// Route every bulk transform through `sharedTransformRequest` when it's
 		// already been wired up — this way the background walk shares the 60s
 		// TTL cache with live /ns/m requests, so the device sees cached results
@@ -246,41 +232,29 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 			}
 			return server.transformRequest(rel) as Promise<{ code?: string } | null | undefined>;
 		};
-		async function walk(dir: string) {
-			for (const name of fs.readdirSync(dir)) {
-				if (name === 'node_modules' || name.startsWith('.') || shouldSkipRuntimeGraphDirectoryName(name)) continue;
-				const full = pathMod.join(dir, name);
-				try {
-					const stat = fs.statSync(full);
-					if (stat.isDirectory()) await walk(full);
-					else if (stat.isFile()) {
-						if (shouldIncludeRuntimeGraphFile(full, /\.(vue|ts|js|mjs|tsx|jsx)$/i)) {
-							const rel = '/' + pathMod.relative(root, full).split(pathMod.sep).join('/');
-							// Transform via Vite to gather deps (ignore failures)
-							try {
-								const transformed = await bulkTransform(rel);
-								const code = transformed?.code || '';
-								const deps: string[] = [];
-								// fallback to import relationships via moduleGraph
-								const modNode = server.moduleGraph.getModuleById(full) || server.moduleGraph.getModuleById(rel);
-								if (modNode) {
-									for (const m of modNode.importedModules) {
-										if (m.id) deps.push(m.id.split('?')[0]);
-									}
-								}
-								// bumpVersion: false — the initial walk is a bulk load, not a live
-								// edit. Keeping graphVersion stable during cold boot avoids double
-								// cache-key drift.
-								moduleGraph.upsert(rel, code, deps, { bumpVersion: false });
-							} catch {}
-						}
+		// The configured `appPath` (nativescript.config), not a fixed `src/`:
+		// without these importer edges the client cannot trace a plain `.ts`
+		// edit back to the component that must re-render.
+		for (const full of listRuntimeGraphSourceFiles(path.join(root, APP_ROOT_DIR), /\.(vue|ts|js|mjs|tsx|jsx)$/i)) {
+			const rel = '/' + path.relative(root, full).split(path.sep).join('/');
+			// Transform via Vite to gather deps (ignore failures)
+			try {
+				const transformed = await bulkTransform(rel);
+				const code = transformed?.code || '';
+				const deps: string[] = [];
+				// fallback to import relationships via moduleGraph
+				const modNode = server.moduleGraph.getModuleById(full) || server.moduleGraph.getModuleById(rel);
+				if (modNode) {
+					for (const m of modNode.importedModules) {
+						if (m.id) deps.push(m.id.split('?')[0]);
 					}
-				} catch {}
-			}
+				}
+				// bumpVersion: false — the initial walk is a bulk load, not a live
+				// edit. Keeping graphVersion stable during cold boot avoids double
+				// cache-key drift.
+				moduleGraph.upsert(rel, code, deps, { bumpVersion: false });
+			} catch {}
 		}
-		try {
-			await walk(pathMod.join(root, 'src'));
-		} catch {}
 		// Diagnostic summary. Gated behind the verbose flag so the
 		// dev console stays quiet on a normal save. Flip
 		// NS_VI
```

---

### Incident Patch 12: `19b70712` (2026-09-29)
**Commit Message**: fix: keep escaped commas inside CSS selectors (#11463)

[skip ci]

**File**: `packages/core/css/css-tree-parser.spec.ts` (modified, +7/-0)
```diff
@@ -13,6 +13,13 @@ describe('CssTreeParser', () => {
 		expect(reworkAST.stylesheet.rules[0].declarations[0].value).toBe('red');
 	});
 
+	it('keeps escaped commas inside a selector', () => {
+		const testCase = '.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260px\\,1fr\\)\\)\\], .a\\\\, .b { color: red; }';
+		const expected = ['.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260px\\,1fr\\)\\)\\]', '.a\\\\', '.b'];
+		expect(reworkCssParse(testCase, { source: 'file.css' }).stylesheet.rules[0].selectors).toEqual(expected);
+		expect(cssTreeParse(testCase, 'file.css').stylesheet.rules[0].selectors).toEqual(expected);
+	});
+
 	it('empty rule', () => {
 		const css = `.test {
 	        color: red;
```

**File**: `packages/core/css/css-tree-parser.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,11 @@ function mapSelectors(selector: string): string[] {
 		return [];
 	}
 
-	return selector.split(/\s*(?![^(]*\)),\s*/).map((s) => s.replace(/\u200C/g, ','));
+	// escaped commas (Tailwind arbitrary values) are part of the selector
+	return selector
+		.replace(/\\[\s\S]/g, (m) => (m === '\\,' ? '\\\u200C' : m))
+		.split(/\s*(?![^(]*\)),\s*/)
+		.map((s) => s.replace(/\u200C/g, ','));
 }
 
 function mapPosition(node, css) {
```

**File**: `packages/core/css/lib/parse/index.ts` (modified, +5/-1)
```diff
@@ -195,12 +195,16 @@ export function parse(css, options) {
 		var m = match(/^([^{]+)/);
 		if (!m) return;
 		/* @fix Remove all comments from selectors
-		 * http://ostermiller.org/findcomment.html */
+		 * http://ostermiller.org/findcomment.html
+		 * Escaped commas (Tailwind arbitrary values) are masked like quoted ones. */
 		return trim(m[0])
 			.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
 			.replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function (m) {
 				return m.replace(/,/g, '\u200C');
 			})
+			.replace(/\\[\s\S]/g, function (m) {
+				return m === '\\,' ? '\\\u200C' : m;
+			})
 			.split(/\s*(?![^(]*\)),\s*/)
 			.map(function (s) {
 				return s.replace(/\u200C/g, ',');
```

**File**: `packages/vite/helpers/css-ast.spec.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { describe, expect, it } from 'vitest';
+
+import { joinEscapedSelectorCommas, parseCssAst } from './css-ast.js';
+
+describe('parseCssAst', () => {
+	it('keeps an escaped comma inside a class name', () => {
+		const ast = parseCssAst('.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\] { grid-template-columns: repeat(auto-fill,minmax(260,1fr)); }');
+		expect(ast.stylesheet.rules[0].selectors).toEqual(['.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\]']);
+	});
+
+	it('still splits a real selector list', () => {
+		const ast = parseCssAst('.a\\,b, .c { color: red; }');
+		expect(ast.stylesheet.rules[0].selectors).toEqual(['.a\\,b', '.c']);
+	});
+
+	it('repairs rules nested in at-rules', () => {
+		const ast = parseCssAst('@media (min-width: 1px) { .x-\\[a\\,b\\] { color: red; } }');
+		expect(ast.stylesheet.rules[0].rules[0].selectors).toEqual(['.x-\\[a\\,b\\]']);
+	});
+});
+
+describe('joinEscapedSelectorCommas', () => {
+	it('does not join after an escaped backslash', () => {
+		// `.a\\` ends in an escaped backslash, so the comma after it is a real separator.
+		expect(joinEscapedSelectorCommas(['.a\\\\', '.b'])).toEqual(['.a\\\\', '.b']);
+	});
+});
```

**File**: `packages/vite/helpers/css-ast.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { parse } from 'css';
+
+/**
+ * Rejoins selectors that `css` split at an escaped comma.
+ *
+ * `css` splits a rule's selector list on every comma outside parentheses, and
+ * treats an escaped `\(` as a parenthesis for that purpose, so an escaped
+ * `\,` inside a class name splits the class: Tailwind's
+ * `.grid-cols-\[repeat\(auto-fill\,minmax\(260\,1fr\)\)\]` became
+ * `.grid-cols-\[repeat\(auto-fill\` and `minmax\(260\,1fr\)\)\]`, neither of
+ * which matches anything. A piece that ends in an odd number of backslashes
+ * ended on an escaped comma, so it is glued back to the next one.
+ */
+export function joinEscapedSelectorCommas(selectors: string[]): string[] {
+	const joined: string[] = [];
+	for (const selector of selectors) {
+		const previous = joined[joined.length - 1];
+		if (previous !== undefined && /(?:^|[^\\])(?:\\\\)*\\$/.test(previous)) {
+			joined[joined.length - 1] = `${previous},${selector}`;
+		} else {
+			joined.push(selector);
+		}
+	}
+	return joined;
+}
+
+function repairRules(rules: any[] | undefined): void {
+	if (!Array.isArray(rules)) return;
+	for (const rule of rules) {
+		if (Array.isArray(rule?.selectors)) {
+			rule.selectors = joinEscapedSelectorCommas(rule.selectors);
+		}
+		// @media, @supports, @document, @host, ... nest their rules.
+		repairRules(rule?.rules);
+	}
+}
+
+/** `css`'s parse, with selector lists repaired (see joinEscapedSelectorCommas). */
+export function parseCssAst(code: string, options?: { silent?: boolean; source?: string }): any {
+	const ast: any = parse(code, options);
+	repairRules(ast?.stylesheet?.rules);
+	return ast;
+}
```

**File**: `packages/vite/helpers/main-entry.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { getPackageJson, getProjectFilePath, getProjectRootPath } from './projec
 import fs from 'fs';
 import path from 'path';
 import { preprocessCSS, type ResolvedConfig, type ViteDevServer } from 'vite';
-import { parse as parseCssToAst } from 'css';
+import { parseCssAst as parseCssToAst } from './css-ast.js';
 import { getProjectFlavor } from './flavor.js';
 import { getProjectAppPath, getProjectAppRelativePath, getProjectAppVirtualPath, resolveProjectGlobalCssPath } from './utils.js';
 import { getResolvedAppComponents } from './app-components.js';
```

**File**: `packages/webpack5/__tests__/loaders/css2json-loader.spec.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import css2jsonLoader, {
+	joinEscapedSelectorCommas,
+} from '../../src/loaders/css2json-loader';
+
+function run(css: string): any {
+	let output = '';
+	css2jsonLoader.call(
+		{
+			getOptions: () => ({}),
+			callback: (_error: unknown, code: string) => {
+				output = code;
+			},
+		},
+		css,
+		null,
+	);
+	const json = output
+		.slice(output.indexOf('=') + 1, output.lastIndexOf('export default'))
+		.trim();
+	return JSON.parse(json);
+}
+
+describe('css2json-loader', () => {
+	it('keeps an escaped comma inside a class name', () => {
+		const ast = run(
+			'.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\] { grid-template-columns: repeat(auto-fill,minmax(260,1fr)); }',
+		);
+		expect(ast.stylesheet.rules[0].selectors).toEqual([
+			'.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\]',
+		]);
+	});
+
+	it('still splits a real selector list, including in at-rules', () => {
+		const ast = run(
+			'.a\\,b, .c { color: red; } @media (min-width: 1px) { .x-\\[a\\,b\\], .y { color: red; } }',
+		);
+		expect(ast.stylesheet.rules[0].selectors).toEqual(['.a\\,b', '.c']);
+		expect(ast.stylesheet.rules[1].rules[0].selectors).toEqual([
+			'.x-\\[a\\,b\\]',
+			'.y',
+		]);
+	});
+
+	it('does not join after an escaped backslash', () => {
+		expect(joinEscapedSelectorCommas(['.a\\\\', '.b'])).toEqual([
+			'.a\\\\',
+			'.b',
+		]);
+	});
+});
```

**File**: `packages/webpack5/src/loaders/css2json-loader/index.ts` (modified, +34/-3)
```diff
@@ -12,6 +12,7 @@ export default function loader(content: string, map: any) {
 	const requirePrefix = inline ? inlineLoader : '';
 
 	const ast = parse(content);
+	repairSelectors(ast.stylesheet?.rules);
 
 	// todo: revise if this is necessary
 	// todo: perhaps use postCSS and just build imports into a single file?
@@ -36,7 +37,7 @@ export default function loader(content: string, map: any) {
 	this.callback(
 		null,
 		code, //`${dependencies.join('\n')}module.exports = ${str};`,
-		map
+		map,
 	);
 }
 
@@ -46,15 +47,15 @@ function getImportRules(ast: Stylesheet): Import[] {
 	}
 	return <Import[]>(
 		ast.stylesheet.rules.filter(
-			(rule) => rule.type === 'import' && (<any>rule).import
+			(rule) => rule.type === 'import' && (<any>rule).import,
 		)
 	);
 }
 
 function getAndRemoveImportRules(ast: Stylesheet): Import[] {
 	const imports = getImportRules(ast);
 	ast.stylesheet.rules = ast.stylesheet.rules.filter(
-		(rule) => rule.type !== 'import'
+		(rule) => rule.type !== 'import',
 	);
 
 	return imports;
@@ -79,3 +80,33 @@ function createRequireUri(uri): { uri: string; requireURI: string } {
 		requireURI: urlToRequest(uri),
 	};
 }
+
+/**
+ * `css` splits a selector list on every comma outside parentheses and counts an escaped `\(` as a
+ * parenthesis, so an escaped `\,` in a class name (Tailwind's `grid-cols-[repeat(auto-fill,...)]`)
+ * splits the class in two and neither half matches. A piece ending in an odd number of
+ * backslashes ended on an escaped comma: glue it back to the next one.
+ */
+export function joinEscapedSelectorCommas(selectors: string[]): string[] {
+	const joined: string[] = [];
+	for (const selector of selectors) {
+		const previous = joined[joined.length - 1];
+		if (previous !== undefined && /(?:^|[^\\])(?:\\\\)*\\$/.test(previous)) {
+			joined[joined.length - 1] = `${previous},${selector}`;
+		} else {
+			joined.push(selector);
+		}
+	}
+	return joined;
+}
+
+function repairSelectors(rules: any[] | undefined): void {
+	if (!Array.isArray(rules)) return;
+	for (const rule of rules) {
+		if (Array.isArray(rule?.selectors)) {
+			rule.selectors = joinEscapedSelectorCommas(rule.selectors);
+		}
+		// @media, @supports, ... nest their rules.
+		repairSelectors(rule?.rules);
+	}
+}
```

---

### Incident Patch 13: `89014ecb` (2026-09-29)
**Commit Message**: fix(vite): resolve a file before a same-named directory (#11464)

[skip ci]

**File**: `packages/vite/helpers/resolver.ts` (modified, +10/-14)
```diff
@@ -1,6 +1,6 @@
 import type { Plugin } from 'vite';
 import path from 'path';
-import { resolveNativeScriptPlatformFile } from './utils.js';
+import { resolveNativeScriptPlatformModule } from './utils.js';
 import { normalizeModuleId } from './normalize-id.js';
 
 const normalizeImporterId = (importer: string): string => {
@@ -25,19 +25,15 @@ export default function NativeScriptPlugin(options: { platform: 'ios' | 'android
 			}
 
 			const resolved = path.resolve(path.dirname(normalizeImporterId(importer)), source);
-			const extVariants = ['.ts', '.js'];
-
-			for (const ext of extVariants) {
-				const file = resolveNativeScriptPlatformFile(resolved + ext, platform);
-				if (file) {
-					// Canonicalize before handing the id to Rolldown. `path.resolve`
-					// emits backslashes on Windows; the @nativescript/core alias and
-					// Vite's own resolver emit forward slashes. Returning the raw
-					// backslash form here makes Rolldown treat the same core file as a
-					// second module, double-evaluating widthProperty.register. No-op on
-					// POSIX. See normalize-id.ts for the full rationale.
-					return normalizeModuleId(file);
-				}
+			const file = resolveNativeScriptPlatformModule(resolved, ['.ts', '.js'], platform);
+			if (file) {
+				// Canonicalize before handing the id to Rolldown. `path.resolve`
+				// emits backslashes on Windows; the @nativescript/core alias and
+				// Vite's own resolver emit forward slashes. Returning the raw
+				// backslash form here makes Rolldown treat the same core file as a
+				// second module, double-evaluating widthProperty.register. No-op on
+				// POSIX. See normalize-id.ts for the full rationale.
+				return normalizeModuleId(file);
 			}
 
 			return null;
```

**File**: `packages/vite/helpers/utils.spec.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+import { afterAll, describe, expect, it } from 'vitest';
+
+import { resolveNativeScriptPlatformFile, resolveNativeScriptPlatformModule } from './utils.js';
+
+describe('resolveNativeScriptPlatformFile', () => {
+	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-resolve-'));
+	const write = (file: string) => {
+		const full = path.join(root, file);
+		fs.mkdirSync(path.dirname(full), { recursive: true });
+		fs.writeFileSync(full, '');
+		return full;
+	};
+
+	afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
+
+	it('prefers a file over a directory of the same name, as Node does', () => {
+		const file = write('pkg/platform.js');
+		write('pkg/platform/index.ios.js');
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'pkg/platform.js'), 'ios')).toBe(file);
+	});
+
+	it('prefers the platform file over the plain one', () => {
+		write('a/view.js');
+		const platform = write('a/view.ios.js');
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'a/view.js'), 'ios')).toBe(platform);
+	});
+
+	it('falls back to the directory barrel', () => {
+		const index = write('b/application/index.ios.js');
+		expect(path.normalize(resolveNativeScriptPlatformFile(path.join(root, 'b/application.js'), 'ios')!)).toBe(index);
+	});
+
+	it('returns undefined when nothing matches', () => {
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'missing.js'), 'ios')).toBeUndefined();
+	});
+});
+
+describe('resolveNativeScriptPlatformModule', () => {
+	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-resolve-module-'));
+	const write = (file: string) => {
+		const full = path.join(root, file);
+		fs.mkdirSync(path.dirname(full), { recursive: true });
+		fs.writeFileSync(full, '');
+		return full;
+	};
+
+	afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
+
+	it('prefers a file with a later extension over a directory barrel with an earlier one', () => {
+		const file = write('pkg/platform.js');
+		write('pkg/platform/index.ios.ts');
+		expect(resolveNativeScriptPlatformModule(path.join(root, 'pkg/platform'), ['.ts', '.js'], 'ios')).toBe(file);
+	});
+
+	it('falls back to the directory barrel', () => {
+		const index = write('b/application/index.ios.js');
+		expect(resolveNativeScriptPlatformModule(path.join(root, 'b/application'), ['.ts', '.js'], 'ios')).toBe(index);
+	});
+});
```

**File**: `packages/vite/helpers/utils.ts` (modified, +30/-10)
```diff
@@ -39,21 +39,41 @@ export function nsConfigToJson() {
  */
 export function resolveNativeScriptPlatformFile(id: string, platform: string): string | undefined {
 	const ext = path.extname(id);
-	const base = id.slice(0, -ext.length);
+	return resolveNativeScriptPlatformModule(id.slice(0, -ext.length), [ext], platform);
+}
 
-	let platformFile = `${base}.${platform}${ext}`;
-	if (fs.existsSync(platformFile)) {
-		return platformFile;
+/**
+ * Resolves an extensionless module path the way Node and webpack do: every
+ * file candidate (`base.<platform>.ext`, then `base.ext`, per extension)
+ * before any directory barrel (`base/index.<platform>.ext`), so a package
+ * shipping both `platform.js` and a `platform/` directory gets the file.
+ */
+export function resolveNativeScriptPlatformModule(base: string, extensions: readonly string[], platform: string): string | undefined {
+	for (const ext of extensions) {
+		const platformFile = `${base}.${platform}${ext}`;
+		if (isFile(platformFile)) {
+			return platformFile;
+		}
+		if (isFile(base + ext)) {
+			return base + ext;
+		}
 	}
-
 	// core uses indices for many barrels
-	platformFile = `${base}/index.${platform}${ext}`;
-	if (fs.existsSync(platformFile)) {
-		return platformFile;
+	for (const ext of extensions) {
+		const platformIndex = `${base}/index.${platform}${ext}`;
+		if (isFile(platformIndex)) {
+			return platformIndex;
+		}
 	}
+	return undefined;
+}
 
-	// fallback to non-platform file
-	return fs.existsSync(id) ? id : undefined;
+function isFile(file: string): boolean {
+	try {
+		return fs.statSync(file).isFile();
+	} catch {
+		return false;
+	}
 }
 
 /**
```

**File**: `packages/vite/helpers/workers.ts` (modified, +6/-13)
```diff
@@ -1,6 +1,6 @@
 import path from 'path';
 import type { Plugin } from 'vite';
-import { nsConfigToJson, resolveNativeScriptPlatformFile } from './utils.js';
+import { nsConfigToJson, resolveNativeScriptPlatformModule } from './utils.js';
 import { createTsConfigPathsResolver, getTsConfigData } from './ts-config-paths.js';
 import { packagePlatformResolverPlugin } from './package-platform-aliases.js';
 import { nativescriptPackageResolver } from './nativescript-package-resolver.js';
@@ -131,18 +131,11 @@ export function getWorkerPlugins(platformOrOpts: string | WorkerPluginsOptions)
 				if (importer) {
 					const resolvedPath = path.resolve(path.dirname(importer), id);
 
-					// Try different extensions with platform-specific resolution
-					const extensions = ['.js', '.mjs', '.ts'];
-
-					for (const ext of extensions) {
-						const testPath = resolvedPath + ext;
-						// Use the existing NativeScript platform file resolver
-						const platformResolvedFile = resolveNativeScriptPlatformFile(testPath, platform);
-						if (platformResolvedFile) {
-							// Canonicalize so the worker bundle dedupes core the same way
-							// the main bundle does (forward slash + uppercase Windows drive).
-							return normalizeModuleId(platformResolvedFile);
-						}
+					const platformResolvedFile = resolveNativeScriptPlatformModule(resolvedPath, ['.js', '.mjs', '.ts'], platform);
+					if (platformResolvedFile) {
+						// Canonicalize so the worker bundle dedupes core the same way
+						// the main bundle does (forward slash + uppercase Windows drive).
+						return normalizeModuleId(platformResolvedFile);
 					}
 
 					return null;
```

---

### Incident Patch 14: `ef297bc0` (2026-09-29)
**Commit Message**: fix(vite): evaluate transitively bundled deps on first use (#11465)

[skip ci]

**File**: `packages/vite/hmr/server/deps-bundle.spec.ts` (modified, +54/-0)
```diff
@@ -1,6 +1,7 @@
 import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import * as path from 'node:path';
+import { pathToFileURL } from 'node:url';
 import { afterAll, describe, expect, it } from 'vitest';
 
 import { setUserDefineEntries } from '../../helpers/global-defines.js';
@@ -63,6 +64,20 @@ describe('buildDepsBundleEntryCode', () => {
 		expect(code).toContain('globalThis.__NS_DEPS_MODULES__');
 		expect(code).toContain(`__nsDepsReg["node_modules/pkg-a/index.js"] = __ns_dep_0__;`);
 		expect(code).toContain(`__nsDepsReg["node_modules/pkg-b/lib/x.js"] = __ns_dep_1__;`);
+		expect(code).not.toContain('__nsDepsLazy');
+	});
+
+	it('registers lazy files behind a getter instead of importing them', () => {
+		const code = buildDepsBundleEntryCode([
+			{ key: 'node_modules/pkg-a/index.js', absPath: '/proj/node_modules/pkg-a/index.js' },
+			{ key: 'node_modules/pkg-a/esm.js', absPath: '/proj/node_modules/pkg-a/esm.js', lazy: true },
+			{ key: 'node_modules/pkg-a/cjs.js', absPath: '/proj/node_modules/pkg-a/cjs.js', lazy: true, cjs: true },
+		]);
+		expect(code).toContain(`import * as __ns_dep_0__ from "/proj/node_modules/pkg-a/index.js";`);
+		expect(code).not.toContain('from "/proj/node_modules/pkg-a/esm.js"');
+		expect(code).not.toContain('from "/proj/node_modules/pkg-a/cjs.js"');
+		expect(code).toContain(`__nsDepsLazy("node_modules/pkg-a/esm.js", () => require("/proj/node_modules/pkg-a/esm.js"));`);
+		expect(code).toContain(`__nsDepsLazy("node_modules/pkg-a/cjs.js", () => __nsDepsCjsNamespace(require("/proj/node_modules/pkg-a/cjs.js")));`);
 	});
 });
 
@@ -286,6 +301,14 @@ function createFixtureProject(): string {
 	// Dep code reading app-level `__FOO__` defines (Vue feature-flag shape).
 	write('node_modules/pkg-flags/package.json', JSON.stringify({ name: 'pkg-flags', version: '1.0.0', module: 'index.js' }));
 	write('node_modules/pkg-flags/index.js', `export const optionsApi = typeof __VUE_OPTIONS_API__ === 'boolean' ? __VUE_OPTIONS_API__ : 'unset';\nexport const bad = typeof __BAD_DEFINE__ === 'undefined' ? 'unset' : __BAD_DEFINE__;\n`);
+	// A package probing an optional dependency with a guarded require. The dependency throws on
+	// evaluation, by design.
+	write('node_modules/pkg-guard/package.json', JSON.stringify({ name: 'pkg-guard', version: '1.0.0', module: 'index.js' }));
+	write('node_modules/pkg-guard/index.js', `export { helper } from './helper.js';\nexport function probe() {\n  try {\n    return require('pkg-media').Audio;\n  } catch (e) {\n    return 'caught';\n  }\n}\n`);
+	write('node_modules/pkg-guard/helper.js', `exports.helper = () => 'helped';\n`);
+	write('node_modules/pkg-media/package.json', JSON.stringify({ name: 'pkg-media', version: '1.0.0', module: 'index.js' }));
+	write('node_modules/pkg-media/index.js', `export { Audio } from './audio';\n`);
+	write('node_modules/pkg-media/audio.js', `throw new Error('pkg-media is not supported here');\n`);
 	return projectRoot;
 }
 
@@ -357,6 +380,37 @@ describe('generateDepsBundle', () => {
 		expect(second!.keys).toEqual(first!.keys);
 	});
 
+	it('evaluates transitive files on first use, so a guarded require of a throwing module stays guarded', async () => {
+		const state = await generateDepsBundle({ projectRoot, platform: 'ios', mode: 'development', flavor: 'typescript', recordedPaths: ['/ns/m/node_modules/pkg-guard/index.js'] });
+		expect(state).not.toBeNull();
+		expect(state!.keys).toContain('node_modules/pkg-media/index.js');
+		expect(state!.keys).toContain('node_modules/pkg-media/audio.js');
+
+		// Each copy evaluates as its own module instance: esbuild's CommonJS wrapper remembers a
+		// module whose first evaluation threw, so each check needs a fresh one.
+		const evaluate = async (name: string) => {
+			const file = path.join(projectRoot, `deps-bundle-${name}-${Date.now()}.mjs`);
+			writeFileSync(file, state!.code);
+			(globalThis as any).__NS_DEPS_MODULES__ = undefined;
+			// Evaluating the bundle must not evaluate the throwing file.
+			await import(pathToFileURL(file).href);
+			return (globalThis as any).__NS_DEPS_MODULES__;
+		};
+		const previous = (globalThis as any).__NS_DEPS_MODULES__;
+		try {
+			// The guarded require still sees the throw...
+			const guarded = await evaluate('guarded');
+			expect(guarded['node_modules/pkg-guard/index.js'].probe()).toBe('caught');
+			expect(guarded['node_modules/pkg-guard/helper.js'].helper()).toBe('helped');
+			expect(guarded['node_modules/pkg-guard/helper.js'].default.helper()).toBe('helped');
+			// ...and a direct read reports it, as importing the module would.
+			const registry = await evaluate('direct');
+			expect(() => registry['node_modules/pkg-media/audio.js']).toThrow('pkg-media is not supported here');
+		} finally {
+			(globalThis as any).__NS_DEPS_MODULES__ = previous;
+		}
+	});
+
 	it('returns null when the recording has no bundleable node_modules ent
```

**File**: `packages/vite/hmr/server/deps-bundle.ts` (modified, +52/-8)
```diff
@@ -341,20 +341,63 @@ export function resolveDepsEntriesFromVendorCollection(projectRoot: string, work
 // Bundle generation — two esbuild passes
 // ============================================================================
 
+export interface DepsBundleEntryFile {
+	key: string;
+	absPath: string;
+	/**
+	 * Registered behind a getter that evaluates the file on first read instead
+	 * of an eager `import *`. Transitive files must not run up front: packages
+	 * `require()` some of them inside a try/catch, and those may throw by
+	 * design on an unsupported platform.
+	 */
+	lazy?: boolean;
+	/** CommonJS (no ESM syntax): its lazy namespace is built the way esbuild's `import *` builds it. */
+	cjs?: boolean;
+}
+
 /**
  * Synthetic esbuild entry: evaluate the dep closure once and expose every
  * bundled file's live namespace through `globalThis.__NS_DEPS_MODULES__`,
  * keyed by node_modules-relative file path.
  */
-export function buildDepsBundleEntryCode(files: readonly { key: string; absPath: string }[]): string {
+export function buildDepsBundleEntryCode(files: readonly DepsBundleEntryFile[]): string {
 	const lines: string[] = [];
-	files.forEach(({ absPath }, i) => {
-		lines.push(`import * as __ns_dep_${i}__ from ${JSON.stringify(absPath)};`);
+	files.forEach(({ absPath, lazy }, i) => {
+		if (!lazy) lines.push(`import * as __ns_dep_${i}__ from ${JSON.stringify(absPath)};`);
 	});
 	lines.push('');
 	lines.push('const __nsDepsReg = (globalThis.__NS_DEPS_MODULES__ || (globalThis.__NS_DEPS_MODULES__ = Object.create(null)));');
-	files.forEach(({ key }, i) => {
-		lines.push(`__nsDepsReg[${JSON.stringify(key)}] = __ns_dep_${i}__;`);
+	if (files.some((f) => f.lazy)) {
+		// What `import * as ns` gives for a CommonJS module (esbuild's __toESM): its exports as named
+		// bindings and itself as `default`, unless it is transpiled ESM (`__esModule`).
+		lines.push('function __nsDepsCjsNamespace(m) {');
+		lines.push('  const ns = Object.create(null);');
+		lines.push("  if (m != null && (typeof m === 'object' || typeof m === 'function')) {");
+		lines.push("    for (const k of Object.keys(m)) if (k !== 'default') Object.defineProperty(ns, k, { enumerable: true, get: () => m[k] });");
+		lines.push('  }');
+		lines.push("  Object.defineProperty(ns, 'default', { enumerable: true, value: m != null && m.__esModule ? m.default : m });");
+		lines.push('  return ns;');
+		lines.push('}');
+		lines.push('function __nsDepsLazy(key, load) {');
+		lines.push('  Object.defineProperty(__nsDepsReg, key, {');
+		lines.push('    configurable: true,');
+		lines.push('    enumerable: true,');
+		lines.push('    get() {');
+		lines.push('      const ns = load();');
+		lines.push('      Object.defineProperty(__nsDepsReg, key, { configurable: true, enumerable: true, writable: true, value: ns });');
+		lines.push('      return ns;');
+		lines.push('    },');
+		lines.push('  });');
+		lines.push('}');
+	}
+	files.forEach(({ key, absPath, lazy, cjs }, i) => {
+		if (!lazy) {
+			lines.push(`__nsDepsReg[${JSON.stringify(key)}] = __ns_dep_${i}__;`);
+		} else if (cjs) {
+			lines.push(`__nsDepsLazy(${JSON.stringify(key)}, () => __nsDepsCjsNamespace(require(${JSON.stringify(absPath)})));`);
+		} else {
+			lines.push(`__nsDepsLazy(${JSON.stringify(key)}, () => require(${JSON.stringify(absPath)}));`);
+		}
 	});
 	lines.push('export {};');
 	lines.push('');
@@ -738,15 +781,16 @@ export async function generateDepsBundle(options: GenerateDepsBundleOptions): Pr
 		plugins: buildPlugins(),
 	});
 
-	const files: { key: string; absPath: string }[] = entries.map(({ key, absPath }) => ({ key, absPath }));
-	for (const input of Object.keys(discovery.metafile?.inputs ?? {})) {
+	const files: DepsBundleEntryFile[] = entries.map(({ key, absPath }) => ({ key, absPath }));
+	for (const [input, meta] of Object.entries(discovery.metafile?.inputs ?? {})) {
 		if (input === '<stdin>' || input.includes(':') || !input.includes('node_modules/')) continue;
 		const absPath = path.resolve(projectRoot, input);
 		if (!existsSync(absPath)) continue;
 		const key = depsRegistryKeyForFile(absPath);
 		if (!key || entryKeySet.has(key) || NEVER_BUNDLED_KEY_RE.test(key)) continue;
 		entryKeySet.add(key);
-		files.push({ key, absPath });
+		// Evaluated on first use, as the dependency graph would, not up front.
+		files.push({ key, absPath, lazy: true, cjs: meta.format !== 'esm' });
 	}
 
 	const buildResult = await esbuild.build({
```

---

### Incident Patch 15: `fbd4cedf` (2026-09-29)
**Commit Message**: fix(vite): decode dots in prebundled subpath specifiers (#11466)

[skip ci]

**File**: `packages/vite/hmr/server/device-transform-helpers.ts` (modified, +11/-22)
```diff
@@ -6,7 +6,7 @@ import * as path from 'path';
 import { existsSync } from 'fs';
 import * as PAT from './constants.js';
 import { getProjectRootPath } from '../../helpers/project.js';
-import { isLikelyNativeScriptRuntimePluginSpecifier, isNativeScriptCoreModule, isNativeScriptPluginModule, normalizeNativeScriptCoreSpecifier, normalizeNodeModulesSpecifier, resolveNodeModulesPackageBoundary, resolveVendorFromCandidate, viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
+import { decodeFlattenedId, isLikelyNativeScriptRuntimePluginSpecifier, isNativeScriptCoreModule, isNativeScriptPluginModule, normalizeNativeScriptCoreSpecifier, normalizeNodeModulesSpecifier, resolveNodeModulesPackageBoundary, resolveVendorFromCandidate, viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
 import { collectTopLevelImportRecords } from './websocket-served-module-helpers.js';
 
 // Bare specifiers and special skip patterns (virtual, data:, etc.)
@@ -17,6 +17,15 @@ const SKIP_PATTERNS = /^(?:data:|blob:|node:|virtual:|vite:|\0|\/@@?id|\/__vite|
 // the console on every served module.
 const warnedVendorMisses = new Set<string>();
 
+function packageIsInstalled(packageName: string): boolean {
+	if (!packageName) return false;
+	try {
+		return existsSync(path.join(getProjectRootPath(), 'node_modules', ...packageName.split('/'), 'package.json'));
+	} catch {
+		return false;
+	}
+}
+
 /**
  * Vendor-manifest miss fallback — e.g. `emoji-regex`, a transitive dep of
  * @nativescript/core that is never part of the vendor bundle. Dropping the
@@ -32,26 +41,6 @@ const warnedVendorMisses = new Set<string>();
  * being committed; if nothing resolves, the first candidate is used anyway —
  * a loud 404 on device beats a silent undefined binding.
  */
-function decodeFlattenedDepId(flat: string): string {
-	// Reverse Vite's flattenId, which encodes '.' as '__' and '/' (and ':') as
-	// '_'. Split on the '__' (dot) boundaries first so a single '_' inside each
-	// segment becomes a '/', then rejoin the segments with '.'. This avoids any
-	// placeholder sentinel (a literal NUL would corrupt the served module).
-	return flat
-		.split('__')
-		.map((segment) => segment.replace(/_/g, '/'))
-		.join('.');
-}
-
-function packageIsInstalled(packageName: string): boolean {
-	if (!packageName) return false;
-	try {
-		return existsSync(path.join(getProjectRootPath(), 'node_modules', ...packageName.split('/'), 'package.json'));
-	} catch {
-		return false;
-	}
-}
-
 function bareSpecifierFromFlatDepPath(depPath: string): string {
 	const flat = depPath.split('?')[0].replace(/\.m?js$/, '');
 	// flattenId is lossy (names may contain '_'), so build candidates from the
@@ -64,7 +53,7 @@ function bareSpecifierFromFlatDepPath(depPath: string): string {
 	const pushCandidate = (c: string) => {
 		if (c && !candidates.includes(c)) candidates.push(c);
 	};
-	pushCandidate(decodeFlattenedDepId(flat));
+	pushCandidate(decodeFlattenedId(flat));
 	if (flat.startsWith('@')) {
 		// Scope-only decode: just the first '_' is the scope separator.
 		pushCandidate(flat.replace('_', '/'));
```

**File**: `packages/vite/hmr/server/websocket-module-specifiers.prebundle.spec.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import { clearVendorManifest, registerVendorManifest } from '../shared/vendor/registry.js';
+import { viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
+
+describe('viteDepsPathToBareSpecifier', () => {
+	beforeEach(() => {
+		registerVendorManifest({ hash: 'test', modules: { pkg: {}, '@scope/pkg': {} } } as any);
+	});
+	afterEach(() => clearVendorManifest());
+
+	it('decodes the dots in a subpath under a vendored package', () => {
+		expect(viteDepsPathToBareSpecifier('pkg_addons_env_file__js.js')).toBe('pkg/addons/env/file.js');
+	});
+
+	it('decodes an extensionless subpath and a scoped package', () => {
+		expect(viteDepsPathToBareSpecifier('pkg_examples_controls_orbit.js')).toBe('pkg/examples/controls/orbit');
+		expect(viteDepsPathToBareSpecifier('@scope_pkg_lib_x__min.js')).toBe('@scope/pkg/lib/x.min');
+	});
+
+	it('returns the package itself for its own prebundle', () => {
+		expect(viteDepsPathToBareSpecifier('pkg.js')).toBe('pkg');
+	});
+});
```

**File**: `packages/vite/hmr/server/websocket-module-specifiers.ts` (modified, +15/-6)
```diff
@@ -27,6 +27,18 @@ export function extractVitePrebundleId(spec: string): string | null {
 	return null;
 }
 
+/**
+ * Reverses Vite's flattenId, which encodes '.' as '__' and '/' as '_'. The
+ * dots are split out first so `lib_file__js` decodes to `lib/file.js`, not
+ * `lib/file//js`. Lossy for names that themselves contain '_'.
+ */
+export function decodeFlattenedId(flat: string): string {
+	return flat
+		.split('__')
+		.map((segment) => segment.replace(/_/g, '/'))
+		.join('.');
+}
+
 export function getFlattenedManifestMap(manifest: VendorManifest): Map<string, string> {
 	const map = new Map<string, string>();
 	const mods = Object.keys(manifest.modules || {});
@@ -280,8 +292,7 @@ export function resolveVendorFromCandidate(specifier: string | null | undefined)
 				return canonical;
 			}
 			if (flattenedId.startsWith(`${flatKey}_`)) {
-				const flatSuffix = flattenedId.slice(flatKey.length + 1);
-				const subpath = flatSuffix.replace(/_/g, '/');
+				const subpath = decodeFlattenedId(flattenedId.slice(flatKey.length + 1));
 				if (isFileDistSubpath(subpath)) {
 					return canonical;
 				}
@@ -291,7 +302,7 @@ export function resolveVendorFromCandidate(specifier: string | null | undefined)
 				}
 			}
 		}
-		const guessedId = flattenedId.replace(/__/g, '.').replace(/_/g, '/');
+		const guessedId = decodeFlattenedId(flattenedId);
 		if (guessedId && guessedId !== flattenedId) {
 			const guessedCanonical = resolveVendorSpecifier(guessedId);
 			if (guessedCanonical) {
@@ -640,9 +651,7 @@ export function viteDepsPathToBareSpecifier(depPath: string): string | null {
 	}
 
 	if (bestKey && bestCanonical) {
-		const flatSuffix = flatId.slice(bestKey.length + 1);
-		const subpath = flatSuffix.replace(/_/g, '/');
-		return `${bestCanonical}/${subpath}`;
+		return `${bestCanonical}/${decodeFlattenedId(flatId.slice(bestKey.length + 1))}`;
 	}
 
 	return null;
```

#### Recent Merged Pull Requests:
- **PR #11504** (2026-10-05): fix(vite): serve worker re-exports per module, not from the deps bundle (@triniwiz)
- **PR #11502** (2026-10-02): chore(deps-dev): bump @nativescript/android from 9.0.5 to 9.1.1 in /apps/ui (@dependabot[bot])
- **PR #11501** (2026-10-02): chore(deps-dev): bump @nativescript/android from 9.1.0-alpha.4 to 9.1.1 in /apps/toolbox (@dependabot[bot])
- **PR #11500** (2026-10-02): chore(deps-dev): bump @nativescript/core from 9.1.0-next.4 to 9.1.2 in /packages/devtools (@dependabot[bot])
- **PR #11499** (2026-10-02): chore(deps-dev): bump @nativescript/android from 9.0.5 to 9.1.1 in /apps/automated (@dependabot[bot])
- **PR #11498** (closed): chore(deps-dev): bump ts-jest from 29.4.5 to 29.4.14 (@dependabot[bot])
- **PR #11497** (closed): chore(deps-dev): bump @vitejs/plugin-vue-jsx from 5.1.5 to 5.1.6 (@dependabot[bot])
- **PR #11496** (closed): chore(deps-dev): bump @nx/devkit from 22.5.4 to 22.7.12 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
