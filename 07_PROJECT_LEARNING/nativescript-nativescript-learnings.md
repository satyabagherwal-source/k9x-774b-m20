> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nativescript-nativescript-learnings.md`  
> **Source**: github ([https://github.com/NativeScript/NativeScript](https://github.com/NativeScript/NativeScript))  
> **Source Version**: `49c79f42`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T15:49:44.751Z  
> **Learning ID**: `learn-github-nativescript-nativescript`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): NativeScript/NativeScript

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativescript-nativescript-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NativeScript/NativeScript](https://github.com/NativeScript/NativeScript))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T15:49:44.743Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NativeScript/NativeScript`
- **Description**: ⚡ Write Native with TypeScript ✨ Best of all worlds (TypeScript, Swift, Objective C, Kotlin, Java, Dart). Use what you love ❤️ Angular, React, Solid, Svelte, Vue with: iOS (UIKit, SwiftUI), Android (View, Jetpack Compose), Flutter and you name it compatible.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25689 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11238** (2026-06-08): **When making use of axios CancelToken, `ReferenceError: exports is not defined at xhr.onabort` error occurs**
  *Symptoms*: ### Issue Description  When making use of axios' `CancelToken`, `ReferenceError: exports is not defined at xhr.onabort` error occurs.  In my code base I've had this issue due to a production issue and fixed it via patching the `packages/core/fetch/index.mjs` file. I replaced `exports.DOMException` with `DOMException` in these two instances:  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L457-L463  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L492-L496  I believe with the changes done here: https://github.com/NativeScript/NativeScript/commit/cc0b5034c4042418aa5b54f0b1f448430a9d0297, `DOMException` can be accessed from the exported classes.  If it helps I have a branch ready with the changes which I can push too :)  ### Reproduction  Sample code:  ```js // service.js let requestSource;  getData() {   if (requestSource) {     requestSource.cancel('Request cancelled!');   }    const currentSource = axios.CancelToken.source();   requestSource = currentSource;    const config = {     cancelToken: requestSource.token   };    return axios.get('api/get-data', undefined, config).finally(() => {     if (requestSource === currentSource) {       requestSource = undefined;     }   }); } ``` ```js // somewhere in app call function try {   getData(); } catch (e) {   console.log('Error ::', e); // results in ReferenceError: exports is not defin

- **Issue #11142** (2026-10-18): **Android edge-to-edge: layout issues when switching Navigation mode**
  *Symptoms*: ### Issue Description  When starting the NativeScript app on Android, switch to Android settings, switch navigation mode (e.g. from 3-button navigation to gesture-navigation or vice versa) and resume the NativeScript app, the layout is messed up like this:  https://github.com/user-attachments/assets/ed665727-4a81-4cac-b73b-2e5713237623  ### Reproduction  [ns9test.zip](https://github.com/user-attachments/files/26111687/ns9test.zip)  Build and run the app switch to Android settings for navigation mode switch from 3-button-navigation to gesture-navigation (or vice versa) switch back to the NativeScript app -> layout is messed up  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  <!-- COPY START --> ```yaml OS: macOS 26.3.1 CPU: (12) x64 Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz Shell: /bin/zsh node: 22.19.0 npm: 11.6.2 nativescript: 9.0.5  # android java: 17.0.11 ndk: Not Found apis: 29, 35, 36, 36 build_tools: 25.0.2, 27.0.3, 28.0.3, 29.0.2, 30.0.2, 30.0.3, 32.0.0, 33.0.0, 33.0.1, 33.0.2, 34.0.0, 35.0.0, 35.0.1, 36.0.0, 36.1.0 system_images:    - android-28 | Google Play Intel x86_64 Atom   - android-29 | Google Play Intel x86_64 Atom   - android-30 | Google APIs Intel x86_64 Atom   - android-35 | Google Play Intel x86_64 Atom   - android-36.1 | Google Play Intel x86_64 Atom   - android-36.1 | Pre-Release 16 KB Page Size Google Play Intel x86_64 Atom  # ios xcode: 26.3/17C529 cocoapods: 1.16.2 python: 2.7.18 python3: 3.13.0 ruby: 2.6.10 platforms:    - Dri
  **Post-Mortem & Fix Analysis**:
  > Hello, I think I am seeing exactely the same problem. Are you also using androidOverflowEdge="dont-apply" ?  <GridLayout rows="auto,*,auto" (loaded)="mainGridLayoutLoaded($event)" androidOverflowEdge="dont-apply" (androidOverflowInset)="onAndroidOverflowInset($event)">  public onAndroidOverflowInset(args: AndroidOverflowInsetData) { 		if (args.inset) { 			args.inset.bottom = 0; 			args.inset.top = 0; 			args.inset.topConsumed = true; 			args.inset.bottomConsumed = true; 			args.inset.imeBottom = 0; 			args.inset.imeBottomConsumed = true; 		} 	}  I see the layout issue when I go to the system settings and change the language settings. This seems to lead to a partial recreation of the activity. From what I found out it seems like the insets, are 0 like I have set them. However the first level of child views under the root layout gets the insets applied as padding top/bottom  Update: Just seen you demo code. Yes same problem. Have you found a workaround?
  > The issue is resolved in nativescript/core 9.1.3

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

### Incident Patch 1: `10448387` (2026-10-29)
**Commit Message**: fix(core): css var() fallbacks, order-independent custom properties, and no crash on unresolvable ones (#11527)

[skip ci]

**File**: `apps/automated/src/ui/styling/style-tests.ts` (modified, +2/-2)
```diff
@@ -1996,7 +1996,7 @@ export function test_css_variable_fallback() {
 		},
 		{
 			className: 'undefined-css-variable-with-multiple-fallbacks',
-			expectedColor: limeColor,
+			expectedColor: undefined,
 		},
 		{
 			className: 'undefined-css-variable-with-missing-fallback-value',
@@ -2037,7 +2037,7 @@ export function test_css_variable_fallback() {
 
     .undefined-css-variable-with-multiple-fallbacks {
         --my-fallback-var: lime;
-        color: var(--undefined-var, var(--my-fallback-var), yellow); /* resolved as color: lime; */
+        color: var(--undefined-var, var(--my-fallback-var), yellow); /* resolved as color: unset; */
     }
 
     .undefined-css-variable-with-missing-fallback-value {
```

**File**: `packages/core/ui/core/properties/css-variable-expression.spec.ts` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+import { describe, it, expect } from 'vitest';
+
+import { _evaluateCssVariableExpression } from '.';
+
+function evaluate(value: string, variables: Record<string, string> = {}) {
+	const view = { style: { getCssVariable: (name: string) => (name in variables ? variables[name] : null) } };
+	return _evaluateCssVariableExpression(view as any, 'color', value);
+}
+
+describe('_evaluateCssVariableExpression', () => {
+	it('substitutes defined variables and falls back for undefined ones', () => {
+		expect(evaluate('var(--a)', { '--a': 'blue' })).toBe('blue');
+		expect(evaluate('var(--a, red)', { '--a': 'blue' })).toBe('blue');
+		expect(evaluate('var(--missing, red)')).toBe('red');
+		expect(evaluate('var(--missing)')).toBe('unset');
+	});
+
+	it('resolves nested fallbacks', () => {
+		expect(evaluate('var(--missing, var(--b))', { '--b': 'lime' })).toBe('lime');
+		expect(evaluate('var(--missing, var(--missing-too, yellow))')).toBe('yellow');
+		expect(evaluate('var(--missing, var(--missing-too))')).toBe('unset');
+	});
+
+	it('keeps parentheses inside the fallback', () => {
+		expect(evaluate('var(--missing, rgb(0, 0, 255))')).toBe('rgb(0, 0, 255)');
+		expect(evaluate('linear-gradient(var(--missing, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%))')).toBe('linear-gradient(rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)');
+	});
+
+	it('keeps every comma-separated part of the fallback', () => {
+		expect(evaluate('var(--missing, red 0%, blue 100%)')).toBe('red 0%, blue 100%');
+	});
+
+	it('uses the fallback for a variable set to initial', () => {
+		expect(evaluate('var(--a, red)', { '--a': 'initial' })).toBe('red');
+		expect(evaluate('var(--a)', { '--a': 'initial' })).toBe('unset');
+	});
+
+	it('resolves a gradient built from variables with fallbacks', () => {
+		const variables = {
+			'--via-stops': 'initial',
+			'--position': 'to right in oklab',
+			'--from': 'rgb(98, 96, 255)',
+			'--from-position': '0%',
+			'--to': 'rgb(246, 51, 154)',
+			'--to-position': '100%',
+		};
+		expect(evaluate('linear-gradient(var(--via-stops, var(--position), var(--from) var(--from-position), var(--to) var(--to-position)))', variables)).toBe(
+			'linear-gradient(to right in oklab, rgb(98, 96, 255) 0%, rgb(246, 51, 154) 100%)',
+		);
+	});
+
+	it('leaves values without variables alone', () => {
+		expect(evaluate('rgb(0, 0, 0)')).toBe('rgb(0, 0, 0)');
+	});
+});
```

**File**: `packages/core/ui/core/properties/index.ts` (modified, +24/-9)
```diff
@@ -229,20 +229,21 @@ export function _evaluateCssVariableExpression(view: ViewBase, cssName: string,
 			continue;
 		}
 
-		const endIdx = output.indexOf(')', idx);
+		const endIdx = findClosingParenthesis(output, idx + 3);
 		if (endIdx === -1) {
 			continue;
 		}
 
-		const matched = output
-			.substring(idx + 4, endIdx)
-			.split(',')
-			.map((v) => v.trim())
-			.filter((v) => !!v);
-		const cssVariableName = matched.shift();
+		const body = output.substring(idx + 4, endIdx);
+		const commaIdx = body.indexOf(',');
+		const cssVariableName = (commaIdx === -1 ? body : body.substring(0, commaIdx)).trim();
+		const fallback = commaIdx === -1 ? '' : body.substring(commaIdx + 1).trim();
 		let cssVariableValue = view.style.getCssVariable(cssVariableName);
-		if (cssVariableValue === null && matched.length) {
-			cssVariableValue = _evaluateCssVariableExpression(view, cssName, matched.join(', ')).split(',')[0];
+		if (typeof cssVariableValue === 'string' && cssVariableValue.trim() === 'initial') {
+			cssVariableValue = null;
+		}
+		if (cssVariableValue === null && fallback) {
+			cssVariableValue = _evaluateCssVariableExpression(view, cssName, fallback);
 		}
 
 		if (!cssVariableValue) {
@@ -255,6 +256,20 @@ export function _evaluateCssVariableExpression(view: ViewBase, cssName: string,
 	return output;
 }
 
+function findClosingParenthesis(value: string, openIdx: number): number {
+	let depth = 0;
+	for (let i = openIdx; i < value.length; i++) {
+		const ch = value[i];
+		if (ch === '(') {
+			depth++;
+		} else if (ch === ')' && --depth === 0) {
+			return i;
+		}
+	}
+
+	return -1;
+}
+
 export function _evaluateCssCalcExpression(value: string) {
 	if (typeof value !== 'string') {
 		return value;
```

**File**: `packages/core/ui/styling/style-scope.spec.ts` (modified, +73/-0)
```diff
@@ -43,6 +43,14 @@ function styled(css: string, className?: string): { view: any; scope: StyleScope
 	return { view, scope };
 }
 
+function styledWithParent(css: string, parentClassName: string): { view: any; parent: any; scope: StyleScope } {
+	const { view, scope } = styled(css);
+	const parent = view.parent;
+	parent.className = parentClassName;
+
+	return { view, parent, scope };
+}
+
 describe('CssState.setPropertyValues', () => {
 	it('applies matched declarations', () => {
 		const { view } = styled('label { color: red; }');
@@ -112,6 +120,71 @@ describe('CssState.setPropertyValues', () => {
 		expect(view.style.color.toString()).toBe('#FF0000');
 	});
 
+	it('resolves custom properties that refer to ones declared after them', () => {
+		const { view } = styled('label { --a: var(--b, blue); --b: var(--c); --c: red; color: var(--a); }');
+		view._cssState.onLoaded();
+
+		expect(view.style.color.toString()).toBe('#FF0000');
+	});
+
+	it('resolves a chain of custom properties that each refer to a later one', () => {
+		const { view } = styled('label { --a: var(--b); --b: var(--c); --c: var(--d); --d: red; color: var(--a); }');
+		view._cssState.onLoaded();
+
+		expect(view.style.color.toString()).toBe('#FF0000');
+		expect(view.style.getCssVariable('--a')).toBe('red');
+	});
+
+	it('treats custom properties in a cycle as undefined, so var() falls back', () => {
+		const { view } = styled('label { --a: var(--b); --b: var(--a); color: var(--a, blue); }');
+		view._cssState.onLoaded();
+
+		expect(view.style.color.toString()).toBe('#0000FF');
+		expect(view.style.getCssVariable('--a')).toBeNull();
+	});
+
+	it('does not inherit a custom property this view declared with an unresolvable value', () => {
+		const { view, parent } = styledWithParent('.p { --a: green; } label { --a: var(--missing); color: var(--a, blue); }', 'p');
+		parent._cssState.onLoaded();
+		view._cssState.onLoaded();
+
+		expect(view.style.color.toString()).toBe('#0000FF');
+	});
+
+	it('evaluates properties after the custom properties they use, whatever the order', () => {
+		const { view } = styled('.a { color: var(--brand); } .b { --brand: var(--base); --base: red; }', 'a b');
+		view._cssState.onLoaded();
+
+		expect(view.style.color.toString()).toBe('#FF0000');
+	});
+
+	it('prefers a later-defined variable over the fallback that referenced it', () => {
+		const css = `
+			.l { --via-stops: initial; }
+			.from { --from: red; --stops: var(--via-stops, var(--from)); }
+			.via { --via: lime; --via-stops: var(--from), var(--via); --stops: var(--via-stops); }
+			.to { --stops: var(--via-stops, var(--from)); color: var(--stops); }
+		`;
+		const { view } = styled(css, 'l from via to');
+		view._cssState.onLoaded();
+
+		expect(view.style.getCssVariable('--stops')).toBe('red, lime');
+	});
+
+	it('unsets a property whose new value is invalid instead of keeping the previous one', () => {
+		const css = `
+			.valid { --fallback: lime; color: var(--missing, var(--fallback)); }
+			.invalid { --fallback: lime; color: var(--missing, var(--fallback), yellow); }
+		`;
+		const { view } = styled(css, 'valid');
+		view._cssState.onLoaded();
+		expect(view.style.color.toString()).toBe('#00FF00');
+
+		view.className = 'invalid';
+		view._cssState.onLoaded();
+		expect(view.style.color).toBeUndefined();
+	});
+
 	it('does not re-apply an unchanged css expression', () => {
 		const { view } = styled('label { --brand: red; color: var(--brand); }');
 		view._cssState.onLoaded();
```

**File**: `packages/core/ui/styling/style-scope.ts` (modified, +73/-5)
```diff
@@ -117,6 +117,61 @@ function evaluateCssExpressions(view: ViewBase, property: string, value: string)
 	return value;
 }
 
+function evaluateCssVariable(view: ViewBase, name: string, value: string): string | null {
+	const evaluated = evaluateCssExpressions(view, name, value);
+
+	return evaluated === unsetValue ? null : evaluated;
+}
+
+function settleCssVariables(view: ViewBase, cssExpsProperties: Record<string, string>) {
+	let names: string[];
+	for (const property in cssExpsProperties) {
+		if (isCssVariable(property)) {
+			if (!names) {
+				names = [];
+			}
+			names.push(property);
+			view.style.setScopedCssVariable(property, evaluateCssVariable(view, property, cssExpsProperties[property]));
+		}
+	}
+	if (!names || names.length < 2 || !hasForwardCssVariableReference(names, cssExpsProperties)) {
+		return;
+	}
+
+	for (let pass = 1; pass < names.length; pass++) {
+		let changed = false;
+		for (const name of names) {
+			const value = evaluateCssVariable(view, name, cssExpsProperties[name]);
+			if (value !== view.style.getCssVariable(name)) {
+				view.style.setScopedCssVariable(name, value);
+				changed = true;
+			}
+		}
+		if (!changed) {
+			return;
+		}
+	}
+}
+
+function hasForwardCssVariableReference(names: string[], values: Record<string, string>): boolean {
+	for (let i = 0; i < names.length; i++) {
+		const value = values[names[i]];
+		for (let j = i + 1; j < names.length; j++) {
+			const ref = `var(${names[j]}`;
+			let at = value.indexOf(ref);
+			while (at !== -1) {
+				const next = value[at + ref.length];
+				if (next === ')' || next === ',' || next === ' ' || next === undefined) {
+					return true;
+				}
+				at = value.indexOf(ref, at + 1);
+			}
+		}
+	}
+
+	return false;
+}
+
 /**
  * Only marks the merged list dirty - it is rebuilt on next read, since frameworks
  * register stylesheets one call at a time.
@@ -934,21 +989,23 @@ export class CssState {
 			valuesToApply[property] = value;
 		}
 		//we need to parse CSS vars first before evaluating css expressions
+		if (cssExpsProperties) {
+			settleCssVariables(view, cssExpsProperties);
+		}
 		for (const property in cssExpsProperties) {
 			const hadOldValue = property in oldProperties;
 			const oldValue = hadOldValue ? oldProperties[property] : undefined;
 			if (hadOldValue) {
 				delete oldProperties[property];
 			}
 
-			const value = evaluateCssExpressions(view, property, cssExpsProperties[property]);
-
 			if (isCssVariable(property)) {
-				view.style.setScopedCssVariable(property, value);
 				delete newPropertyValues[property];
 				continue;
 			}
 
+			const value = evaluateCssExpressions(view, property, cssExpsProperties[property]);
+
 			if (value === unsetValue) {
 				delete newPropertyValues[property];
 			} else {
@@ -1017,15 +1074,26 @@ export class CssState {
 		// Set new values to the style
 		for (const property in valuesToApply) {
 			const value = valuesToApply[property];
+			const inStyle = property in view.style;
+			const camelCasedProperty = inStyle ? undefined : property.replace(kebabCasePattern, kebabCaseReplacementFunc);
 			try {
-				if (property in view.style) {
+				if (inStyle) {
 					view.style[`css:${property}`] = value;
 				} else {
-					const camelCasedProperty = property.replace(kebabCasePattern, kebabCaseReplacementFunc);
 					view[camelCasedProperty] = value;
 				}
 			} catch (e) {
 				Trace.write(`Failed to apply property [${property}] with value [${value}] to ${view}. ${e.stack}`, Trace.categories.Error, Trace.messageType.error);
+				delete newPropertyValues[property];
+				try {
+					if (inStyle) {
+						view.style[`css:${property}`] = unsetValue;
+					} else {
+						view[camelCasedProperty] = unsetValue;
+					}
+				} catch (e) {
+					Trace.write(`Failed to unset property [${property}] on ${view}. ${e.stack}`, Trace.categories.Error, Trace.messageType.error);
+				}
 			}
 		}
 
```

---

### Incident Patch 2: `005970f2` (2026-10-29)
**Commit Message**: feat(core): CSS Color 4 and 5 color functions (#11532)

Color reads `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`,
`color()` and relative colors (`oklch(from var(--x) calc(l * .9) c h)`)
with @csstools/css-color-parser, which core already uses for
`color-mix()`. Tailwind v4 and Bootstrap 6 define their whole palettes in
oklch, which threw "Invalid color".

The modern `rgb()`/`hsl()` syntax the fast path misread now goes the
same way: a `/` alpha given as a percentage (`rgb(0 0 0 / 15%)` came
out opaque), rgb percentages, and `none`. The legacy syntax keeps the
fast path.

The value parser behind `background` and gradients recognises the new
functions too, and nested ones such as `color-mix(in srgb, rgb(0 0 0), red)`.
`Color.isValid()` accepts them.

**File**: `packages/core/color/color-common.ts` (modified, +10/-4)
```diff
@@ -1,7 +1,7 @@
 import type { IColor } from './color-types';
 import * as types from '../utils/types';
 import * as knownColors from './known-colors';
-import { HEX_REGEX, argbFromColorMix, argbFromHslOrHsla, argbFromHsvOrHsva, argbFromRgbOrRgba, hslToRgb, hsvToRgb, isCssColorMixExpression, isHslOrHsla, isHsvOrHsva, isRgbOrRgba, rgbToHsl, rgbToHsv, argbFromString } from './color-utils';
+import { HEX_REGEX, argbFromColorMix, argbFromCssColor, argbFromHslOrHsla, argbFromHsvOrHsva, argbFromRgbOrRgba, hslToRgb, hsvToRgb, isCssColorFunction, isCssColorMixExpression, isHslOrHsla, isHsvOrHsva, isModernRgbOrHsl, isRgbOrRgba, rgbToHsl, rgbToHsv, argbFromString } from './color-utils';
 
 export class ColorBase implements IColor {
 	private _argb: number;
@@ -15,9 +15,9 @@ export class ColorBase implements IColor {
 			const arg = args[0];
 			if (types.isString(arg)) {
 				const lowered = arg.toLowerCase();
-				if (isRgbOrRgba(lowered)) {
+				if (isRgbOrRgba(lowered) && !isModernRgbOrHsl(lowered)) {
 					this._argb = argbFromRgbOrRgba(lowered);
-				} else if (isHslOrHsla(lowered)) {
+				} else if (isHslOrHsla(lowered) && !isModernRgbOrHsl(lowered)) {
 					this._argb = argbFromHslOrHsla(lowered);
 				} else if (isHsvOrHsva(lowered)) {
 					this._argb = argbFromHsvOrHsva(lowered);
@@ -37,6 +37,12 @@ export class ColorBase implements IColor {
 					// strange that it would not be. And if it is not a thrown error seems best
 					// The parameter is a "#RRGGBBAA" formatted string
 					this._argb = this._argbFromString(arg);
+				} else if (isCssColorFunction(lowered) || isRgbOrRgba(lowered) || isHslOrHsla(lowered)) {
+					const argb = argbFromCssColor(lowered);
+					if (argb === null) {
+						throw new Error('Invalid color: ' + arg);
+					}
+					this._argb = argb >>> 0;
 				} else {
 					throw new Error('Invalid color: ' + arg);
 				}
@@ -147,7 +153,7 @@ export class ColorBase implements IColor {
 			return true;
 		}
 
-		return HEX_REGEX.test(value) || isRgbOrRgba(lowered) || isHslOrHsla(lowered);
+		return HEX_REGEX.test(value) || isRgbOrRgba(lowered) || isHslOrHsla(lowered) || isCssColorFunction(lowered) || isCssColorMixExpression(lowered);
 	}
 	public static fromHSL(a, h, s, l) {
 		return new ColorBase(a, h, s, l, 'hsl');
```

**File**: `packages/core/color/color-utils.ts` (modified, +14/-0)
```diff
@@ -5,10 +5,24 @@ import { tokenize } from '@csstools/css-tokenizer';
 
 export const HEX_REGEX = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)|(^#[0-9A-F]{8}$)|(^#[0-9A-F]{4}$)/i;
 
+const CSS_COLOR_FUNCTION_REGEX = /^(?:oklch|oklab|lab|lch|hwb|color)\(/;
+
 export function isCssColorMixExpression(value: string) {
 	return value.includes('color-mix(');
 }
 
+export function isCssColorFunction(value: string) {
+	return CSS_COLOR_FUNCTION_REGEX.test(value);
+}
+
+export function isModernRgbOrHsl(value: string) {
+	return value.includes('/') || value.includes('none') || value.includes('from ') || (value.startsWith('rgb') && value.includes('%'));
+}
+
+export function argbFromCssColor(value: string): number | null {
+	return argbFromColorMix(value);
+}
+
 export function argbFromColorMix(value: string): number | null {
 	const astComponentValue = parseComponentValue(tokenize({ css: value }));
 	const colorData = color(astComponentValue);
```

**File**: `packages/core/color/color.spec.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect } from 'vitest';
+
+import { Color } from '.';
+
+const rgba = (value: string) => new Color(value).toRgbString();
+
+describe('Color', () => {
+	it('parses CSS Color 4 color spaces', () => {
+		expect(rgba('oklch(0.6 0.2 250)')).toBe('rgba(0, 131, 224, 1.00)');
+		expect(rgba('oklch(70% 0.1 30deg / .5)')).toBe('rgba(213, 134, 121, 0.50)');
+		expect(rgba('OKLCH(0.6 0.2 250)')).toBe('rgba(0, 131, 224, 1.00)');
+		expect(rgba('oklab(0.628 0.225 0.126)')).toBe('rgba(255, 0, 0, 1.00)');
+		expect(rgba('lab(50 40 59.5)')).toBe('rgba(191, 87, 0, 1.00)');
+		expect(rgba('lch(50 72 56)')).toBe('rgba(191, 87, 0, 1.00)');
+		expect(rgba('hwb(0 0% 0%)')).toBe('rgba(255, 0, 0, 1.00)');
+		expect(rgba('color(srgb 1 0 0)')).toBe('rgba(255, 0, 0, 1.00)');
+	});
+
+	it('parses relative colors', () => {
+		expect(rgba('oklch(from #ff0000 calc(l * 0.9) c h)')).toBe('rgba(222, 0, 0, 1.00)');
+		expect(rgba('rgb(from red r g b / 50%)')).toBe('rgba(255, 0, 0, 0.50)');
+	});
+
+	it('parses the modern rgb() and hsl() syntax', () => {
+		expect(rgba('rgb(0 0 0 / 15%)')).toBe('rgba(0, 0, 0, 0.15)');
+		expect(rgba('rgb(100% 0% 0%)')).toBe('rgba(255, 0, 0, 1.00)');
+		expect(rgba('rgb(255 0 0 / none)')).toBe('rgba(255, 0, 0, 0.00)');
+		expect(rgba('hsl(0 100% 50% / 50%)')).toBe('rgba(255, 0, 0, 0.50)');
+	});
+
+	it('keeps the legacy syntax on the fast path', () => {
+		expect(rgba('rgb(255, 8, 128)')).toBe('rgba(255, 8, 128, 1.00)');
+		expect(rgba('rgba(255, 8, 128, 0.5)')).toBe('rgba(255, 8, 128, 0.50)');
+		expect(rgba('rgb(255 8 128)')).toBe('rgba(255, 8, 128, 1.00)');
+		expect(rgba('hsl(330.9, 100%, 51.6%)')).toBe('rgba(255, 8, 128, 1.00)');
+	});
+
+	it('rejects what is not a color', () => {
+		expect(() => new Color('oklch(nope)')).toThrow('Invalid color');
+		expect(() => new Color('colorful(1 2 3)')).toThrow('Invalid color');
+		expect(() => new Color('light-dark(red, blue)')).toThrow('Invalid color');
+	});
+
+	it('reports the new functions as valid', () => {
+		expect(Color.isValid('oklch(0.6 0.2 250)')).toBe(true);
+		expect(Color.isValid('color-mix(in srgb, red, blue)')).toBe(true);
+		expect(Color.isValid('nope(1)')).toBe(false);
+	});
+});
```

**File**: `packages/core/css/parser.spec.ts` (modified, +4/-0)
```diff
@@ -50,6 +50,10 @@ describe('css', () => {
 				test(parseColor, '  rgba(255, 8, 128, 0.5) ', { start: 0, end: 24, value: new Color(0x80ff0880) });
 				test(parseColor, '  hsl(330.9, 100%, 51.6%) ', { start: 0, end: 25, value: new Color(0xffff0880) });
 				test(parseColor, '  hsla(330.9, 100%, 51.6%, 0.5) ', { start: 0, end: 31, value: new Color(0x80ff0880) });
+				test(parseColor, '  rgb(0 0 0 / 15%) ', { start: 0, end: 18, value: new Color(0x26000000) });
+				test(parseColor, '  oklch(0.6 0.2 250) ', { start: 0, end: 20, value: new Color(0xff0083e0) });
+				test(parseColor, '  color-mix(in srgb, rgb(255 0 0), blue) ', { start: 0, end: 40, value: new Color('color-mix(in srgb, rgb(255 0 0), blue)') });
+				test(parseColor, '  oklch(0.6 0.2 250 ', 0, null);
 				test(parseColor, '#FF0000 url(lucky.gif)', 8, null);
 				test(parseColor, 'url(lucky.gif) #FF0000 repeat', 15, { start: 15, end: 23, value: new Color(0xffff0000) });
 			});
```

**File**: `packages/core/css/parser.ts` (modified, +16/-3)
```diff
@@ -79,16 +79,29 @@ export function parseHexColor(text: string, start = 0): Parsed<Color> {
 	return { start, end, value: new Color('#' + result[1]) };
 }
 
-const cssColorRegEx = /\s*((?:rgb|rgba|hsl|hsla|hsv|hsva)\([^\(\)]*\))/gy;
+const cssColorRegEx = /\s*(rgba?|hsla?|hsva?|oklch|oklab|lab|lch|hwb|color-mix|color)\(/gy;
 export function parseCssColor(text: string, start = 0): Parsed<Color> {
 	cssColorRegEx.lastIndex = start;
 	const result = cssColorRegEx.exec(text);
 	if (!result) {
 		return null;
 	}
-	const end = cssColorRegEx.lastIndex;
+
+	let end = cssColorRegEx.lastIndex;
+	for (let depth = 1; depth > 0; end++) {
+		if (end >= text.length) {
+			return null;
+		}
+		const char = text[end];
+		if (char === '(') {
+			depth++;
+		} else if (char === ')') {
+			depth--;
+		}
+	}
+
 	try {
-		return { start, end, value: new Color(result[1]) };
+		return { start, end, value: new Color(text.substring(cssColorRegEx.lastIndex - result[1].length - 1, end)) };
 	} catch {
 		return null;
 	}
```

---

### Incident Patch 3: `0ac04893` (2026-10-29)
**Commit Message**: fix(core): keyframes without a 0% or 100% keyframe animate from and to the view's own values (#11528)

Core played the first keyframe as a jump and held the last one, so
keyframes that leave out an end did not animate as in CSS:
`to { transform: rotate(360deg) }` jumped to 360deg on every iteration
and a spinner never turned, and keyframes that stop at 50% never came
back.

A missing 0% or 100% keyframe is now added when the animation is built,
and filled with the view's own values for the animated properties when
it plays. An auto width or height, which cannot be animated from, is
left out.

[skip ci]

**File**: `packages/core/ui/animation/keyframe-animation.spec.ts` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import { describe, it, expect } from 'vitest';
+
+import { KeyframeAnimation, KeyframeAnimationInfo, KeyframeInfo } from './keyframe-animation';
+import { Label } from '../label';
+
+function info(keyframes: Array<Partial<KeyframeInfo>>, options: Partial<KeyframeAnimationInfo> = {}): KeyframeAnimationInfo {
+	return Object.assign(new KeyframeAnimationInfo(), { duration: 1000, keyframes }, options);
+}
+
+describe('KeyframeAnimation.keyframeAnimationFromInfo', () => {
+	it('keeps keyframes that already start at 0% and end at 100%', () => {
+		const animation = KeyframeAnimation.keyframeAnimationFromInfo(
+			info([
+				{ duration: 0, declarations: [{ property: 'opacity', value: 0 }] },
+				{ duration: 1, declarations: [{ property: 'opacity', value: 1 }] },
+			]),
+		);
+
+		expect(animation.animations.length).toBe(2);
+		expect(animation.animations.map((a) => a.opacity)).toEqual([0, 1]);
+	});
+
+	it('starts from the view’s own values when there is no 0% keyframe', () => {
+		const animation = KeyframeAnimation.keyframeAnimationFromInfo(info([{ duration: 1, declarations: [{ property: 'rotate', value: { x: 0, y: 0, z: 360 } }] }]));
+		const view = new Label();
+		view.rotate = 45;
+
+		(animation as any)._fillImplicitKeyframes(view);
+
+		expect(animation.animations.length).toBe(2);
+		expect(animation.animations[0].rotate).toEqual({ x: 0, y: 0, z: 45 });
+		expect(animation.animations[1].rotate).toEqual({ x: 0, y: 0, z: 360 });
+		expect(animation.animations[1].duration).toBe(1000);
+	});
+
+	it('ends at the view’s own values when there is no 100% keyframe', () => {
+		const animation = KeyframeAnimation.keyframeAnimationFromInfo(
+			info([
+				{ duration: 0, declarations: [{ property: 'opacity', value: 0 }] },
+				{ duration: 0.5, declarations: [{ property: 'opacity', value: 0.5 }] },
+			]),
+		);
+		const view = new Label();
+		view.opacity = 0.8;
+
+		(animation as any)._fillImplicitKeyframes(view);
+
+		expect(animation.animations.map((a) => a.opacity)).toEqual([0, 0.5, 0.8]);
+		expect(animation.animations.map((a) => a.duration)).toEqual([0.01, 500, 500]);
+	});
+
+	it('fills only the properties the keyframes animate', () => {
+		const animation = KeyframeAnimation.keyframeAnimationFromInfo(info([{ duration: 0.5, declarations: [{ property: 'opacity', value: 0 }] }]));
+
+		(animation as any)._fillImplicitKeyframes(new Label());
+
+		expect(animation.animations.length).toBe(3);
+		for (const keyframe of animation.animations) {
+			expect('rotate' in keyframe).toBe(false);
+			expect('opacity' in keyframe).toBe(true);
+		}
+		expect(animation.animations[0].opacity).toBe(1);
+		expect(animation.animations[2].opacity).toBe(1);
+	});
+
+	it('does not animate from an auto size', () => {
+		const animation = KeyframeAnimation.keyframeAnimationFromInfo(info([{ duration: 1, declarations: [{ property: 'width', value: 100 }] }]));
+
+		(animation as any)._fillImplicitKeyframes(new Label());
+
+		expect('width' in animation.animations[0]).toBe(false);
+		expect(animation.animations[1].width).toBe(100);
+	});
+
+	it('does not change the info it was built from', () => {
+		const animationInfo = info([{ duration: 1, declarations: [{ property: 'opacity', value: 0 }] }]);
+
+		KeyframeAnimation.keyframeAnimationFromInfo(animationInfo);
+
+		expect(animationInfo.keyframes.length).toBe(1);
+	});
+});
```

**File**: `packages/core/ui/animation/keyframe-animation.ts` (modified, +77/-3)
```diff
@@ -59,6 +59,28 @@ interface Keyframe {
 	forceLayer?: boolean;
 }
 
+const KEYFRAME_PROPERTIES = ['backgroundColor', 'scale', 'translate', 'rotate', 'opacity', 'width', 'height'];
+
+function getKeyframeValue(view: View, property: string): any {
+	switch (property) {
+		case 'backgroundColor':
+			return view.backgroundColor instanceof Color ? view.backgroundColor : new Color(0, 0, 0, 0);
+		case 'scale':
+			return { x: view.scaleX ?? 1, y: view.scaleY ?? 1 };
+		case 'translate':
+			return { x: view.translateX ?? 0, y: view.translateY ?? 0 };
+		case 'rotate':
+			return { x: view.rotateX ?? 0, y: view.rotateY ?? 0, z: view.rotate ?? 0 };
+		case 'opacity':
+			return view.opacity ?? 1;
+		case 'width':
+		case 'height': {
+			const value = view[property];
+			return value == null || value === 'auto' ? undefined : value;
+		}
+	}
+}
+
 export class KeyframeAnimation {
 	public animations: Array<Keyframe>;
 	public delay = 0;
@@ -69,26 +91,47 @@ export class KeyframeAnimation {
 	private _isForwards: boolean;
 	private _nativeAnimations: Array<Animation>;
 	private _target: View;
+	private _implicitKeyframes: Array<Keyframe>;
 
 	public static keyframeAnimationFromInfo(info: KeyframeAnimationInfo): KeyframeAnimation {
 		if (!info?.keyframes?.length) {
 			Trace.write(`No keyframes found for animation '${info.name}'.`, Trace.categories.Animation, Trace.messageType.warn);
 			return null;
 		}
 
-		const length = info.keyframes.length;
+		const keyframes = info.keyframes.slice();
+		const implicitInfos = new Array<KeyframeInfo>();
+		if (keyframes[0].duration > 0) {
+			const from = { duration: 0, declarations: [] };
+			implicitInfos.push(from);
+			keyframes.unshift(from);
+		}
+		if (keyframes[keyframes.length - 1].duration < 1) {
+			const to = { duration: 1, declarations: [] };
+			implicitInfos.push(to);
+			keyframes.push(to);
+		}
+
+		const length = keyframes.length;
 		const animations = new Array<Keyframe>();
+		const implicitKeyframes = new Array<Keyframe>();
 		let startDuration = 0;
 
 		if (info.isReverse) {
 			for (let index = length - 1; index >= 0; index--) {
-				const keyframe = info.keyframes[index];
+				const keyframe = keyframes[index];
 				startDuration = KeyframeAnimation.parseKeyframe(info, keyframe, animations, startDuration);
+				if (implicitInfos.includes(keyframe)) {
+					implicitKeyframes.push(animations[animations.length - 1]);
+				}
 			}
 		} else {
 			for (let index = 0; index < length; index++) {
-				const keyframe = info.keyframes[index];
+				const keyframe = keyframes[index];
 				startDuration = KeyframeAnimation.parseKeyframe(info, keyframe, animations, startDuration);
+				if (implicitInfos.includes(keyframe)) {
+					implicitKeyframes.push(animations[animations.length - 1]);
+				}
 			}
 			for (let index = length - 1; index > 0; index--) {
 				const a1 = animations[index];
@@ -107,6 +150,9 @@ export class KeyframeAnimation {
 		animation.iterations = info.iterations;
 		animation.animations = animations;
 		animation._isForwards = info.isForwards;
+		if (implicitKeyframes.length) {
+			animation._implicitKeyframes = implicitKeyframes;
+		}
 
 		return animation;
 	}
@@ -174,6 +220,7 @@ export class KeyframeAnimation {
 		this._isPlaying = true;
 		this._nativeAnimations = new Array<Animation>();
 		this._target = view;
+		this._fillImplicitKeyframes(view);
 
 		if (this.delay !== 0) {
 			setTimeout(() => this.animate(view, 0, this.iterations), this.delay);
@@ -260,6 +307,33 @@ export class KeyframeAnimation {
 		}
 	}
 
+	private _fillImplicitKeyframes(view: View) {
+		const implicitKeyframes = this._implicitKeyframes;
+		if (!implicitKeyframes) {
+			return;
+		}
+
+		const animated = new Set<string>();
+		for (const animation of this.animations) {
+			for (const property of KEYFRAME_PROPERTIES) {
+				if (property in animation && !implicitKeyframes.includes(animation)) {
+					animated.add(property);
+				}
+			}
+		}
+
+		for (const keyframe of implicitKeyframes) {
+			for (const property of animated) {
+				const value = getKeyframeValue(view, property);
+				if (value === undefined) {
+					delete keyframe[property];
+				} else {
+					keyframe[property] = value;
+				}
+			}
+		}
+	}
+
 	public _resolveAnimationFinishedPromise() {
 		this._nativeAnimations = new Array<Animation>();
 		this._isPlaying = false;
```

#### Recent Merged Pull Requests:
- **PR #11593** (2026-10-29): fix(core): unresolved var() unsets the whole value and invalid color-mix() no longer renders white (@edusperoni)
- **PR #11585** (2026-10-28): docs: fix stale unit-test anchors and API reference build command (@ZainnQureshii)
- **PR #11583** (2026-10-28): chore(skills): add issue-sweep skill (@NathanWalker)
- **PR #11582** (2026-10-28): fix(android): create prompt and login inputs from the dialog context (@NathanWalker)
- **PR #11581** (2026-10-28): fix(windows): break import cycle between view and animation modules (@aleclarson)
- **PR #11579** (2026-10-28): fix(ios): skip Switch color updates without a native view (@NathanWalker)

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

## X. core): css var() fallbacks, order-independent custom properties, and no crash on

**RULE**:
When implementing operations in `apps/automated/src/ui/styling/style-tests.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NativeScript/NativeScript. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `10448387`: core): css var() fallbacks, order-independent custom properties, and no crash on unresolvable ones (#11527). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/automated/src/ui/styling/style-tests.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
			expectedColor: undefined,
        color: var(--undefined-var, var(--my-fallback-var), yellow); /* resolved as color: unset; */
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
			expectedColor: limeColor,
        color: var(--undefined-var, var(--my-fallback-var), yellow); /* resolved as color: lime; */
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `10448387` are properly handled with clean fallback behavior.
