# Forensic Learning Record (Deep Inspection): reshaped-ui/reshaped

> **Canonical Artifact**: `07_PROJECT_LEARNING/reshaped-ui-reshaped-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/reshaped-ui/reshaped](https://github.com/reshaped-ui/reshaped))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:24:08.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `reshaped-ui/reshaped`
- **Description**: Reshaped provides accessible React and Figma components for building beautiful products or starting your own design system
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2243 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/reshaped/src/components/Calendar/Calendar.utils.ts`
```
import type * as T from "./Calendar.types";

const DAYS_IN_WEEK = 7;
const FIRST_WEEK_DAY = 1;

/**
 * Return the ISO date format without the timezones adjustemnts
 */
export const getLocalISODate = (args: { date: Date }) => {
	const { date } = args;

	return [
		date.getFullYear(),
		(date.getMonth() + 1).toString().padStart(2, "0"),
		date.getDate().toString().padStart(2, "0"),
	].join("-");
};

const getNormalizedDay = (args: { date: Date; firstWeekDay?: number }) => {
	const { date, firstWeekDay = FIRST_WEEK_DAY } = args;

	const day = date.getDay();

	return (day - firstWeekDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
};

/**
 * Return an array of US weekday names for the calendar
 */
export const getWeekdayNames = (args: {
	firstWeekDay?: number;
	renderWeekDay: T.BaseProps["renderWeekDay"];
}) => {
	const { firstWeekDay = FIRST_WEEK_DAY, renderWeekDay } = args;
	const baseDate = new Date(2021, 1, firstWeekDay); // Starting from Sunday + firstWeekDay
	const weekdays = [];

	for (let i = firstWeekDay; i < firstWeekDay + DAYS_IN_WEEK; i++) {
		const weekday = renderWeekDay
			? renderWeekDay({ weekDay: i, date: baseDate })
			: baseDate.toLocaleDateString("en-US", { weekday: "short" });
		weekdays.push(weekday.slice(0, 2));
		baseDate.setDate(baseDate.getDate() + 1);
	}

	return weekdays;
};

/**
 * Return an array of all month names
 */
export const getMonthNames = (args: { renderMonthLabel: T.BaseProps["renderMonthLabel"] }) => {
	const { renderMonthLabel } = args;

	return Array.from({ length: 12 }).map((_, i) => {
		const date = new Date(0, i);
		return renderMonthLabel
			? renderMonthLabel({ month: i, date })
			: date.toLocaleString("default", { month: "short" });
	});
};

/**
 * Return an array of weeks based on the month passed to the function
 */
export const getMonthWeeks = (args: { date: Date; firstWeekDay?: number }): (Date | null)[][] => {
	const { date, firstWeekDay } = args;
	const month = date.getMonth();
	const year = date.getFullYear();
	const weeks: (Date | null)[][] = [];
	const currentDate = new Date(year, month, 1);

	// Fill in the days if month starts in the middle of the week
	const firstDay = getNormalizedDay({ date: currentDate, firstWeekDay });
	if (firstDay !== 0) {
		const emptyDates = Array.from({ length: firstDay }).map(() => null);
		weeks.push(emptyDates);
	}

	while (month === currentDate.getMonth()) {
		const day = getNormalizedDay({ date: currentDate, firstWeekDay });

		if (day === 0 || !weeks.length) weeks.push([]);

		weeks[weeks.length - 1].push(new Date(currentDate));
		currentDate.setDate(currentDate.getDate() + 1);
	}

	// Fill in the days if month ends in the middle of the week
	const lastDay = getNormalizedDay({ date: currentDate, firstWeekDay });
	if (lastDay !== 0) {
		const emptyDates = Array.from({ length: 7 - lastDay }).map(() => null);
		weeks[weeks.length - 1].push(...emptyDates);
	}

	return weeks;
};

export const getFocusableDates = (rootEl: HTMLElement | null) => {
	return (rootEl?.querySelectorAll("[data-rs-date]") || []) as unknown as HTMLButtonElement[];
};

export const changeDate = (date: Date, delta: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);

export const setMonthTo = (date: Date, value: number) => {
	return new Date(date.getFullYear(), value, 1);
};

export const setMonthToPrevious = (date: Date) => {
	return setMonthTo(date, date.getMonth() - 1);
};

export const setMonthToNext = (date: Date) => {
	return setMonthTo(date, date.getMonth() + 1);
};

export const setYearTo = (date: Date, value: number) => {
	const resultDate = new Date(date);

	resultDate.setFullYear(value);
	return resultDate;
};

export const setYearToPrevious = (date: Date) => {
	return setYearTo(date, date.getFullYear() - 1);
};

export const setYearToNext = (date: Date) => {
	return setYearTo(date, date.getFullYear() + 1);
};

export const applyNavigationBounds = (args: { date: Date; min?: Date; max?: Date }) => {
	const { date, min, max } = args;
	const currentMonth = date.getMonth();
	const currentYear = date.getFullYear();
	const prevMonthLastDate = new Date(currentYear, currentMonth, 0);
	const nextMonthFirstDate = setMonthToNext(date);
	nextMonthFirstDate.setDate(0);

	return {
		isFirstMonth: min && min > prevMonthLastDate,
		isLastMonth: max && max < nextMonthFirstDate,
	};
};

const isMonthMatch = (date1: Date, date2: Date) => {
	return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
};

/**
 * Decide if date has to be focusable with Tab (only one date should be)
 * 1. If there is a selected value - it's focusable
 * 2. Otherwise, today's date is focusable
 * 3. Otherwise, first non-disabled date is focusable
 */
export const isDateFocusable = (args: {
	date: Date;
	lastFocusedDate?: Date;
	startValue: Date | null;
}) => {
	const { date, startValue, lastFocusedDate } = args;
	const today = new Date();
	const isoDate = getLocalISODate({ date });
	const isoToday = getLocalISODate({ date: today });
	const isoValueDate = startValue && getLocalISODate({ date: startValue });
	const isoLastFocusedDate = lastFocusedDate && getLocalISODate({ date: lastFocusedDate });

	if (lastFocusedDate && isMonthMatch(date, lastFocusedDate)) return isoDate === isoLastFocusedDate;
	if (startValue && isMonthMatch(date, startValue)) return isoDate === isoValueDate;
	if (isMonthMatch(date, today)) return isoDate === isoToday;
	return true;
};

```

### Core Architecture Module: `packages/reshaped/src/components/Flyout/utilities/cooldown.ts`
```
class Cooldown {
	status: "warming" | "warm" | "cooling" | "cold" = "cold";

	timer?: ReturnType<typeof setTimeout>;

	warm = () => {
		clearTimeout(this.timer);

		if (this.status === "cooling") {
			this.status = "warm";
			return;
		}

		this.status = "warming";

		this.timer = setTimeout(() => {
			this.status = "warm";
			this.timer = undefined;
		}, 100);
	};

	cool = () => {
		clearTimeout(this.timer);

		if (this.status === "warming") {
			this.status = "cold";
			return;
		}

		this.status = "cooling";

		this.timer = setTimeout(() => {
			this.status = "cold";
			this.timer = undefined;
		}, 500);
	};
}

export default new Cooldown();

```

### Core Architecture Module: `packages/reshaped/src/components/Flyout/utilities/safeArea.ts`
```
import type { Coordinates } from "@reshaped/utilities/internal";

type SafePolygonOptions = {
	contentRef: React.RefObject<HTMLElement | null>;
	triggerRef: React.RefObject<HTMLElement | null>;
	position: string | null | undefined;
	onClose: () => void;
	origin: Coordinates;
};

/**
 * Checks if a point is inside a triangle using barycentric coordinates
 */
function isPointInTriangle(
	point: Coordinates,
	triangle: [Coordinates, Coordinates, Coordinates]
): boolean {
	const [p1, p2, p3] = triangle;

	const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);

	const a = ((p2.y - p3.y) * (point.x - p3.x) + (p3.x - p2.x) * (point.y - p3.y)) / denominator;
	const b = ((p3.y - p1.y) * (point.x - p3.x) + (p1.x - p3.x) * (point.y - p3.y)) / denominator;
	const c = 1 - a - b;

	return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

/**
 * Gets the two closest corners of the content element based on the flyout position
 */
function getContentCorners(
	contentRect: DOMRect,
	position: string | null | undefined
): [Coordinates, Coordinates] {
	const corners = {
		topLeft: { x: contentRect.left, y: contentRect.top },
		topRight: { x: contentRect.right, y: contentRect.top },
		bottomLeft: { x: contentRect.left, y: contentRect.bottom },
		bottomRight: { x: contentRect.right, y: contentRect.bottom },
	};

	if (position?.startsWith("bottom")) {
		return [corners.topLeft, corners.topRight];
	} else if (position?.startsWith("top")) {
		return [corners.bottomLeft, corners.bottomRight];
	} else if (position?.startsWith("start")) {
		return [corners.topRight, corners.bottomRight];
	} else {
		return [corners.topLeft, corners.bottomLeft];
	}
}

export function createSafeArea(options: SafePolygonOptions): () => void {
	const { contentRef, triggerRef, position, onClose, origin: passedOrigin } = options;

	if (!contentRef.current) {
		// If content doesn't exist, just close immediately
		onClose();
		return () => {};
	}

	const contentRect = contentRef.current.getBoundingClientRect();
	const [corner1, corner2] = getContentCorners(contentRect, position);
	const origin = { x: passedOrigin.x, y: passedOrigin.y };

	const triangle: [Coordinates, Coordinates, Coordinates] = [origin, corner1, corner2];

	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const cleanup = () => {
		document.removeEventListener("mousemove", handleMouseMove);

		if (timeoutId) clearTimeout(timeoutId);
	};

	// Start timeout for 1 second
	const startTimeout = () => {
		if (timeoutId) clearTimeout(timeoutId);

		timeoutId = setTimeout(() => {
			onClose();
			cleanup();
		}, 1000);
	};

	const handleMouseMove = (e: MouseEvent) => {
		const currentPoint: Coordinates = { x: e.clientX, y: e.clientY };

		if (isPointInTriangle(currentPoint, triangle) && contentRef.current && triggerRef.current) {
			startTimeout();
		} else {
			onClose();
			cleanup();
		}
	};

	startTimeout();
	document.addEventListener("mousemove", handleMouseMove);

	return cleanup;
}

```

### Core Architecture Module: `packages/reshaped/src/components/FormControl/FormControl.utilities.ts`
```
import type * as T from "./FormControl.types";

export const getCaptionId = (id: string, variant?: T.PrivateCaptionProps["variant"]) =>
	`${id}-${variant || "caption"}`;

```

### Core Architecture Module: `packages/reshaped/src/components/Slider/Slider.utilities.ts`
```
export const getPrecision = (value: number) => {
	const floatPart = value.toString().split(".")[1];
	return floatPart?.length || 0;
};

export const applyStepToValue = (value: number, step: number) => {
	const isStepFloat = step % 1 !== 0;
	const result = Math.round(value / step) * step;

	// Handle javascript floats manually with string conversion
	if (isStepFloat) {
		const precision = getPrecision(step);
		return Number(result.toFixed(precision));
	}

	return result;
};

export const getDragCoord = ({
	event,
	vertical,
}: {
	event: MouseEvent | TouchEvent;
	vertical?: boolean;
}) => {
	if (vertical) {
		if (event instanceof MouseEvent) return event.clientY;
		return event.changedTouches[0].clientY;
	}

	if (event instanceof MouseEvent) return event.clientX;
	return event.changedTouches[0].clientX;
};

/**
 * Workaround for changing a hidden input value with triggering
 * React input onChange and form onChange handlers
 *
 * Based on https://stackoverflow.com/a/60378508
 */
export const triggerChangeEvent = (el: HTMLInputElement, value: string) => {
	const nativeInputValueSetter = Object!.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value"
	)!.set;

	nativeInputValueSetter!.call(el, value);
	el.dispatchEvent(new Event("change", { bubbles: true }));
};

```

### Core Architecture Module: `packages/reshaped/src/components/Theme/Theme.utilities.ts`
```
export const getRootThemeEl = (scopeEl?: HTMLElement | null): HTMLElement => {
	if (!scopeEl) return document.documentElement;

	if (
		scopeEl.hasAttribute("data-rs-root") ||
		scopeEl === document.documentElement ||
		!scopeEl.parentElement
	) {
		return scopeEl;
	}

	return getRootThemeEl(scopeEl.parentElement);
};

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/useDrag.ts`
```
"use client";

import React from "react";
import { disableScroll, enableScroll } from "@reshaped/utilities/internal";

import useHandlerRef from "@/hooks/useHandlerRef";
import useHotkeys from "@/hooks/useHotkeys";
import useToggle from "@/hooks/useToggle";
import * as keys from "@/constants/keys";

export type UseDragCallbackArgs = { x: number; y: number; triggerX: number; triggerY: number };

const useDrag = <
	TriggerElement extends HTMLElement = HTMLButtonElement,
	ContainerElement extends HTMLElement = HTMLDivElement,
>(
	cb: (args: UseDragCallbackArgs) => void,
	options?: {
		disabled?: boolean;
		containerRef?: React.RefObject<ContainerElement | null>;
		orientation?: "horizontal" | "vertical" | "both";
	}
) => {
	const { disabled, containerRef: passedContainerRef, orientation = "both" } = options || {};
	const cbRef = useHandlerRef(cb);
	const toggle = useToggle();
	const triggerRef = React.useRef<TriggerElement>(null);
	const internalContainerRef = React.useRef<ContainerElement>(null);
	const containerRef = passedContainerRef || internalContainerRef;
	const triggerCompensationRef = React.useRef({ x: 0, y: 0 });
	const isVertical = orientation === "vertical" || orientation === "both";
	const isHorizontal = orientation === "horizontal" || orientation === "both";

	const handleKeyboard = (x: number, y: number) => {
		const triggerEl = triggerRef.current;

		if (!triggerEl) return;

		const container = containerRef.current ?? document.body;
		const containerRect = container.getBoundingClientRect();
		const triggerRect = triggerEl?.getBoundingClientRect();
		const nextArgs = { x: 0, y: 0, triggerX: 0, triggerY: 0 };

		if (isVertical) {
			const relativeY = Math.round(triggerRect.y) - containerRect.y + y;
			nextArgs.y = Math.max(0, Math.min(relativeY, containerRect.height - triggerRect!.height));
			nextArgs.triggerY = triggerRect.y - containerRect.y;
		}

		if (isHorizontal) {
			const relativeX = Math.round(triggerRect.x) - containerRect.x + x;
			nextArgs.x = Math.max(0, Math.min(relativeX, containerRect.width - triggerRect!.width));
			nextArgs.triggerX = triggerRect.x - containerRect.x;
		}

		cb(nextArgs);
	};

	useHotkeys<TriggerElement>(
		{
			[keys.LEFT]: () => isHorizontal && handleKeyboard(-20, 0),
			[keys.RIGHT]: () => isHorizontal && handleKeyboard(20, 0),
			[keys.UP]: () => isVertical && handleKeyboard(0, -20),
			[keys.DOWN]: () => isVertical && handleKeyboard(0, 20),
		},
		[],
		{
			ref: triggerRef,
			preventDefault: true,
			disabled,
		}
	);

	React.useEffect(() => {
		const triggerEl = triggerRef.current;
		if (!triggerEl) return;
		if (!toggle.active) return;

		const handleDrag = (event: MouseEvent | TouchEvent) => {
			const resolvedEvent = event instanceof MouseEvent ? event : event.changedTouches[0];

			const container = containerRef.current ?? document.body;
			const containerRect = container.getBoundingClientRect();
			const triggerRect = triggerEl.getBoundingClientRect();

			const triggerX = resolvedEvent.clientX - containerRect.x;
			const triggerY = resolvedEvent.clientY - containerRect.y;

			// Calculate position relative to the container
			const relativeX = triggerX - triggerCompensationRef.current.x;
			const relativeY = triggerY - triggerCompensationRef.current.y;

			cbRef.current?.({
				x: isHorizontal
					? Math.max(0, Math.min(relativeX, containerRect.width - triggerRect.width))
					: 0,
				y: isVertical
					? Math.max(0, Math.min(relativeY, containerRect.height - triggerRect.height))
					: 0,
				triggerX: triggerRect.x - containerRect.x,
				triggerY: triggerRect.y - containerRect.y,
			});
		};

		const handleDragEnd = () => {
			triggerCompensationRef.current = { x: 0, y: 0 };
			toggle.deactivate();
			enableScroll();
		};

		document.addEventListener("touchmove", handleDrag, { passive: true });
		document.addEventListener("touchend", handleDragEnd, { passive: true });
		document.addEventListener("mousemove", handleDrag, { passive: true });
		document.addEventListener("mouseup", handleDragEnd, { passive: true });

		return () => {
			document.removeEventListener("touchmove", handleDrag);
			document.removeEventListener("touchend", handleDragEnd);
			document.removeEventListener("mousemove", handleDrag);
			document.removeEventListener("mouseup", handleDragEnd);
		};
	}, [toggle, isHorizontal, isVertical, containerRef, cbRef]);

	React.useEffect(() => {
		const triggerEl = triggerRef.current;
		if (!triggerEl || disabled) return;

		const handleStart = (event: MouseEvent | TouchEvent) => {
			const resolvedEvent = event instanceof MouseEvent ? event : event.changedTouches[0];

			// Find the coordinate of the event inside the trigger
			const triggerRect = triggerEl.getBoundingClientRect();
			triggerCompensationRef.current = {
				x: resolvedEvent.clientX - triggerRect.x,
				y: resolvedEvent.clientY - triggerRect.y,
			};

			toggle.activate();
			disableScroll();
		};

		triggerEl.addEventListener("touchstart", handleStart, { passive: true });
		triggerEl.addEventListener("mousedown", handleStart, { passive: true });

		return () => {
			triggerEl.removeEventListener("touchstart", handleStart);
			triggerEl.removeEventListener("mousedown", handleStart);
		};
	}, [toggle, disabled]);

	return { ref: triggerRef, containerRef, active: toggle.active };
};

export default useDrag;

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/useFadeSide.ts`
```
"use client";

import React from "react";
import { rafThrottle } from "@reshaped/utilities/internal";

import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import useRTL from "@/hooks/useRTL";

const useFadeSide = (
	scrollableRef: React.RefObject<HTMLElement | null>,
	options: { disabled?: boolean } = {}
) => {
	const { disabled } = options;
	const [rtl] = useRTL();
	const [fadeSide, setFadeSide] = React.useState<"start" | "end" | "both" | null>(null);

	const updateFade = React.useCallback(() => {
		const elScrollable = scrollableRef.current;
		if (!elScrollable) return;

		const isScrollable = elScrollable.clientWidth < elScrollable.scrollWidth;
		if (!isScrollable) setFadeSide(null);

		// scrollLeft in RTL starts from 1 instead of 0, so we compare values using this delta
		const scrollLeft = elScrollable.scrollLeft * (rtl ? -1 : 1);
		const cutOffStart = scrollLeft > 1;
		const cutOffEnd = scrollLeft + elScrollable.clientWidth < elScrollable.scrollWidth - 1;

		if (cutOffEnd && cutOffStart) return setFadeSide("both");
		if (cutOffStart) return setFadeSide("start");
		if (cutOffEnd) return setFadeSide("end");
	}, [rtl, scrollableRef]);

	useIsomorphicLayoutEffect(() => {
		const elScrollable = scrollableRef.current;

		if (!elScrollable) return;
		if (disabled) return;

		const debouncedUpdate = rafThrottle(updateFade);

		// Use RaF when scroll to have scrollWidth calculated correctly on the first effect
		// For example: And edge case inside the complex flexbox layout
		requestAnimationFrame(() => updateFade());

		window.addEventListener("resize", debouncedUpdate);
		elScrollable.addEventListener("scroll", debouncedUpdate);

		return () => {
			window.removeEventListener("resize", debouncedUpdate);
			elScrollable.removeEventListener("scroll", debouncedUpdate);
		};
	}, [rtl, disabled]);

	return fadeSide;
};

export default useFadeSide;

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/usePrevious.ts`
```
"use client";

import React from "react";

const copy = <T>(value?: T) => {
	const valueIsDate = value instanceof Date;

	if (valueIsDate) return String(valueIsDate);

	const string = JSON.stringify(value);

	return JSON.parse(string);
};

const usePrevious = <T>(value?: T, clean = false) => {
	const ref = React.useRef<T>(clean ? copy<T>(value) : value);

	React.useEffect(() => {
		ref.current = clean ? copy<T>(value) : value;
	}, [value, clean]);

	return ref.current;
};

export default usePrevious;

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx`
```
"use client";

import React from "react";

/**
 * Types
 */
type Callback = (e?: KeyboardEvent) => void;
type PressedMap = Record<string, KeyboardEvent>;
export type Hotkeys = Record<string, Callback | null>;
type HotkeyOptions = { preventDefault?: boolean };
type Context = {
	isPressed: (key: string) => boolean;
	addHotkeys: (
		hotkeys: Hotkeys,
		ref: React.RefObject<HTMLElement | null>,
		options?: HotkeyOptions
	) => (() => void) | undefined;
};

type HotkeyData = {
	callback: Callback;
	ref: React.RefObject<HTMLElement | null>;
	options: HotkeyOptions;
};

/**
 * Utilities
 */
const COMBINATION_DELIMETER = "+";
const MODIFIER_KEYS = ["meta", "control", "alt", "shift"];

const formatHotkey = (hotkey: string) => {
	if (hotkey === " ") return hotkey;
	return hotkey.replace(/\s/g, "").toLowerCase();
};

// Normalize passed key combinations to turn them into a consistent ids
const getHotkeyId = (hotkey: string) => {
	return formatHotkey(hotkey).split(COMBINATION_DELIMETER).sort().join(COMBINATION_DELIMETER);
};

const getEventKey = (e: KeyboardEvent) => {
	if (!e.key) return;

	// Having alt pressed modifies e.key value, so relying on e.code for it
	if (e.altKey && /^(Key|Digit|Numpad)/.test(e.code)) {
		return e.code.toLowerCase().replace(/^(key|digit|numpad)/, "");
	}

	return e.key.toLowerCase();
};

/**
 * Support for `mod` that represents both Mac and Win keyboards
 * We create the hotkeyId again to sort the mod key correctly
 */
const getPressedIds = (pressedId: string) => {
	const pressedFormattedKeys = pressedId.split(COMBINATION_DELIMETER);
	const ids = [pressedId];

	if (pressedFormattedKeys.includes("control")) {
		ids.push(getHotkeyId(pressedId.replace("control", "mod")));
	}

	if (pressedFormattedKeys.includes("meta")) {
		ids.push(getHotkeyId(pressedId.replace("meta", "mod")));
	}

	return ids;
};

// Removing the unknown gets highlighted an invalid syntax
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
const walkHotkeys = <T extends unknown>(
	hotkeys: Record<string, T>,
	cb: (id: string, hotkeyData: T) => void
) => {
	Object.keys(hotkeys).forEach((key) => {
		key.split(",").forEach((hotkey) => {
			const data = hotkeys[key];
			if (!data) return;

			cb(getHotkeyId(hotkey), data);
		});
	});
};

export class HotkeyStore {
	hotkeyMap: Record<string, Set<HotkeyData>> = {};

	getSize = () => Object.keys(this.hotkeyMap).length;

	hasHandlers = (pressedId: string) => {
		return getPressedIds(pressedId).some((id) => this.hotkeyMap[id]?.size);
	};

	bindHotkeys = (
		hotkeys: Hotkeys,
		ref: React.RefObject<HTMLElement | null>,
		options: HotkeyOptions
	) => {
		const boundData: Array<{ id: string; data: HotkeyData }> = [];

		walkHotkeys(hotkeys, (id, callback) => {
			if (!callback) return;

			const data = { callback, ref, options };

			if (!this.hotkeyMap[id]) {
				this.hotkeyMap[id] = new Set();
			}

			this.hotkeyMap[id].add(data);
			boundData.push({ id, data });
		});

		return () => {
			boundData.forEach(({ id, data }) => {
				this.hotkeyMap[id]?.delete(data);

				if (!this.hotkeyMap[id]?.size) {
					delete this.hotkeyMap[id];
				}
			});
		};
	};

	handleKeyDown = (pressedMap: PressedMap, e: KeyboardEvent) => {
		const pressedKeys = Object.keys(pressedMap);
		if (!pressedKeys.length) return;

		const pressedId = getHotkeyId(pressedKeys.join(COMBINATION_DELIMETER));
		const eventTarget = e.composedPath()[0] as Node;

		getPressedIds(pressedId).forEach((id) => {
			const hotkeyData = this.hotkeyMap[id];
			if (!hotkeyData?.size) return;

			hotkeyData.forEach((data) => {
				if (
					data.ref.current &&
					!(eventTarget === data.ref.current || data.ref.current.contains(eventTarget))
				) {
					return;
				}

				if (data.options.preventDefault) {
					e.preventDefault();
				}

				data.callback(e);
			});
		});
	};
}

const globalHotkeyStore = new HotkeyStore();

/**
 * Components / Hooks
 */
const HotkeyContext = React.createContext({} as Context);

const HotkeysProvider: React.FC<{ children: React.ReactNode }> = (props) => {
	const { children } = props;
	// Ref is the source of truth to keep the map in sync with the native events,
	// state is mirroring it to re-render the consumers relying on isPressed
	const pressedMapRef = React.useRef<PressedMap>({});
	const [, setPressedState] = React.useState<PressedMap>({});
	// Keyup events don't trigger for regular keys while Meta is pressed on macOS,
	// so we track the keys pressed during that time to release them manually
	const metaModifiedKeysRef = React.useRef<string[]>([]);
	const hooksCountRef = React.useRef(0);

	const setPressedMap = React.useCallback((nextPressedMap: PressedMap) => {
		pressedMapRef.current = nextPressedMap;
		setPressedState(nextPressedMap);
	}, []);

	const addPressedKey = React.useCallback(
		(e: KeyboardEvent): PressedMap | undefined => {
			if (e.repeat || hooksCountRef.current === 0) return;

			const eventKey = getEventKey(e);
			if (!eventKey) return;

			const nextPressedMap = { ...pressedMapRef.current };
			nextPressedMap[eventKey] = e;

			if (nextPressedMap["meta"]) {
				if (!MODIFIER_KEYS.includes(eventKey)) {
					// Keys pressed while Meta was held might have been released already
					// without us receiving their keyup events, so when the whole pressed combination
					// doesn't match any hotkey - we treat them as released
					const staleKeys = metaModifiedKeysRef.current.filter(
						(key) => key !== eventKey && key in nextPressedMap
					);
					const pressedId = getHotkeyId(Object.keys(nextPressedMap).join(COMBINATION_DELIMETER));

					if (staleKeys.length && !globalHotkeyStore.hasHandlers(pressedId)) {
						staleKeys.forEach((key) => delete nextPressedMap[key]);
					}
				}

				metaModifiedKeysRef.current = Object.keys(nextPressedMap).filter(
					(key) => !MODIFIER_KEYS.includes(key)
				);
			}

			setPressedMap(nextPressedMap);
			return nextPressedMap;
		},
		[setPressedMap]
	);

	const removePressedKey = React.useCallback(
		(e: KeyboardEvent) => {
			if (hooksCountRef.current === 0) return;

			const eventKey = getEventKey(e);
			if (!eventKey) return;

			const nextPressedMap = { ...pressedMapRef.current };
			delete nextPressedMap[eventKey];

			if (eventKey === "meta") {
				metaModifiedKeysRef.current.forEach((key) => {
					delete nextPressedMap[key];
				});
				metaModifiedKeysRef.current = [];
			}

			setPressedMap(nextPressedMap);
		},
		[setPressedMap]
	);

	const isPressed = React.useCallback((hotkey: string) => {
		const pressedMap = pressedMapRef.current;
		const keys = formatHotkey(hotkey).split(COMBINATION_DELIMETER);

		return keys.every((key) => {
			if (key === "mod") return Boolean(pressedMap["meta"] || pressedMap["control"]);
			return Boolean(pressedMap[key]);
		});
	}, []);

	const handleWindowKeyDown = React.useCallback(
		(e: KeyboardEvent) => {
			// Browsers trigger keyboard event without passing e.key when you click on autocomplete
			if (!e.key) return;

			const nextPressedMap = addPressedKey(e) ?? pressedMapRef.current;
			globalHotkeyStore.handleKeyDown(nextPressedMap, e);
		},
		[addPressedKey]
	);

	const handleWindowKeyUp = React.useCallback(
		(e: KeyboardEvent) => {
			if (!e.key) return;

			removePressedKey(e);
		},
		[removePressedKey]
	);

	const handleWindowBlur = React.useCallback(() => {
		setPressedMap({});
		metaModifiedKeysRef.current = [];
	}, [setPressedMap]);

	const addHotkeys: Context["addHotkeys"] = React.useCallback((hotkeys, ref, options = {}) => {
		hooksCountRef.current += 1;
		const unbindHotkeys = globalHotkeyStore.bindHotkeys(hotkeys, ref, options);

		return () => {
			hooksCountRef.current -= 1;
			unbindHotkeys();
		};
	}, []);

	React.useEffect(() => {
		window.addEventListener("keydown", handleWindowKeyDown);
		window.addEventListener("keyup", handleWindowKeyUp);
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			window.removeEventListener("keydown", handleWindowKeyDown);
			window.removeEventListener("keyup", handleWindowKeyUp);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [handleWindowKeyDown, handleWindowKeyUp, handleWindowBlur]);

	return (
		<HotkeyContext.Provider value={{ addHotkeys, isPressed }}>{children}</HotkeyContext.Provider>
	);
};

export const SingletonHotkeysProvider: React.FC<{ children: React.ReactNode }> = (props) => {
	const { children } = props;
	// Hotkeys are handled globally, so nested providers rely on the root provider
	// instead of attaching their own window event listeners
	const hasParentProvider = Boolean(React.useContext(HotkeyContext).addHotkeys);

	if (hasParentProvider) return <>{children}</>;
	return <HotkeysProvider>{children}</HotkeysProvider>;
};

export const useSingletonHotkeys = () => React.useContext(HotkeyContext);

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/useSingletonKeyboardMode.tsx`
```
"use client";

import React from "react";
import { activateKeyboardMode, deactivateKeyboardMode } from "@reshaped/utilities/internal";

const ESC = "Escape";

const isEditing = (e: KeyboardEvent) => {
	const el = e.target as HTMLElement;

	if (!el?.tagName) return false;

	const tagName = el.tagName?.toLowerCase();
	const editable = el.isContentEditable || tagName === "textarea" || tagName === "input";

	if (!editable) return false;
	return e.isComposing || e.key.length === 1;
};

type ContextProps = {
	disabledRef: React.RefObject<boolean> | null;
	disable: () => void;
	enable: () => void;
	activate: () => void;
	deactivate: () => void;
};

const SingletonKeyboardModeContext = React.createContext<ContextProps>({
	disabledRef: null,
	disable: () => {},
	enable: () => {},
	activate: () => {},
	deactivate: () => {},
});

export const SingletonKeyboardModeProvider: React.FC<{ children: React.ReactNode }> = (props) => {
	const disabledRef = React.useRef(false);

	const disable = React.useCallback(() => {
		disabledRef.current = true;
	}, []);

	const enable = React.useCallback(() => {
		disabledRef.current = false;
	}, []);

	const activate = React.useCallback(() => {
		if (disabledRef.current) return;
		activateKeyboardMode();
	}, []);

	const deactivate = React.useCallback(() => {
		if (disabledRef.current) return;
		deactivateKeyboardMode();
	}, []);

	const handleKeyDown = React.useCallback(
		(e: KeyboardEvent) => {
			if (e.metaKey || e.altKey || e.ctrlKey) return;
			// Prevent focus ring from appearing when using mouse but closing with esc
			if (e.key === ESC) return;
			if (isEditing(e)) return;
			activate();
		},
		[activate]
	);

	const handleClick = React.useCallback(() => {
		deactivate();
	}, [deactivate]);

	React.useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("mousedown", handleClick);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("mousedown", handleClick);
		};
	}, [handleClick, handleKeyDown]);

	const value = React.useMemo(
		() => ({
			disabledRef,
			disable,
			enable,
			activate,
			deactivate,
		}),
		[disable, enable, activate, deactivate]
	);

	return (
		<SingletonKeyboardModeContext.Provider value={value}>
			{props.children}
		</SingletonKeyboardModeContext.Provider>
	);
};

export const useSingletonKeyboardMode = () => React.useContext(SingletonKeyboardModeContext);

```

### Core Architecture Module: `packages/reshaped/src/hooks/_internal/useSingletonRTL.tsx`
```
"use client";

import React from "react";
import { isRTL } from "@reshaped/utilities";

import useIsomorphicLayoutEffect from "../useIsomorphicLayoutEffect";

type Context = {
	rtl: [boolean, (state: boolean) => void];
};

const SingletonRTLContext = React.createContext<Context>({
	rtl: [false, () => {}],
});

export const useSingletonRTL = (defaultRTL?: boolean) => {
	const state = React.useState(defaultRTL || false);
	const [rtl, setRTL] = state;

	/**
	 * Handle changing dir attribute directly
	 */
	useIsomorphicLayoutEffect(() => {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.attributeName !== "dir") return;

				const nextRTL = isRTL();
				if (rtl !== nextRTL) setRTL(nextRTL);
			});
		});

		observer.observe(document.documentElement, { attributes: true });
		return () => observer.disconnect();
	}, [rtl]);

	/**
	 * Handle setRTL usage
	 */
	useIsomorphicLayoutEffect(() => {
		document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
	}, [rtl]);

	return state;
};

export const SingletonRTLProvider: React.FC<{
	children: React.ReactNode;
	defaultRTL?: boolean;
}> = (props) => {
	const { children, defaultRTL } = props;
	const rtlState = useSingletonRTL(defaultRTL);

	return (
		<SingletonRTLContext.Provider value={{ rtl: rtlState }}>
			{children}
		</SingletonRTLContext.Provider>
	);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #670** (2026-09-12): **Modal: velocity-aware release spring and rubber band for the swipe gesture**
  *Symptoms*: ## Summary  The swipe-to-close gesture had three physics gaps:  1. **Release ignored the finger speed.** Closing always ran the base `150ms` `accelerate` transition from the dragged position, so a flick started slow (ease-in from rest) and a slow release jumped to a much higher speed. 2. **Returning to the open position snapped.** `resetDragData()` wrote `--rs-modal-drag: 0px` synchronously in `touchend`, while the `--dragging` class (`transition: none`) was still in the DOM until React committed, so there was no transition at all. 3. **Overdrag was hard-clamped** to 0 in both JS and CSS (`max(var(--rs-modal-drag), 0px)`), so pulling a bottom sheet up or a drawer inward did nothing.  ### Velocity-aware release  - The release velocity is measured over the last 100ms of touch samples. - Close decision: a flick faster than `0.4px/ms` in the closing direction closes regardless of distance (same threshold Vaul uses); a drag past the existing 32px threshold closes unless the finger was moving back on release; everything else returns. - The release animation is resolved from a **critically damped spring** (ω = 20/s) that starts at the measured velocity, sampled at 120Hz into a CSS `linear()` easing with a matching duration (`resolveSpringTransition` in `utilities/animation.ts`). The transition is still a plain CSS `transform` transition on the compositor; JS only computes the easing once on release. Velocity fed to the spring is capped at 3px/ms to bound the overshoot. - Browsers wi
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 51.53 KB (+1.71% 🔺) | 1.1 s (+1.71% 🔺) | 1.8 s (-15.96% 🔽)        | 2.9 s      | | Library / CSS                                | 23.77 KB (0%)        | 476 ms (0%)       | 0 ms (+100% 🔺)           | 476 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)       | 128 ms (+58.04% 🔺)       | 283 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)       | 208 ms (-14.63% 🔽)       | 382 ms     |

- **Issue #669** (2026-09-12): **Modal: register the drag offset as a non-inherited property**
  *Symptoms*: ## Summary  `Modal` drives its swipe-to-close gesture by writing `--rs-modal-drag` to the modal root on every `touchmove` frame (throttled by `requestAnimationFrame`), and the root's `transform` reads it back. The property itself is the right tool (the transform stays on the compositor), but as an unregistered custom property it **inherits**, so each write invalidates the computed style of every element inside the modal. On a content-heavy sheet that is the dominant per-frame cost of the gesture, and it lands on the main thread, which is exactly what gets throttled on phones in low-power mode.  This PR registers it with `@property { inherits: false }` so the update only recalculates the root's own style. No JS or markup changes; nothing else reads the variable.  Measured in headless Chromium on the `position: bottom` story with 2000 extra rows appended (6008 nodes inside the dialog), timing `style.setProperty('--rs-modal-drag')` + forced style recalc:  | | per drag frame | |---|---| | `main` (inherited custom property) | 5.94 ms | | this PR (`@property`, `inherits: false`) | 0.115 ms |  Browsers without `@property` support ignore the rule and keep the previous behavior, same as the existing registrations in `ScrollArea` and `Table`.  ## Related Issue  N/A  ## Screenshots / Recordings  Simulated a touch drag on a bottom modal in Chromium: the sheet follows the finger (`translate(0, 88px)` at 88px of drag) and closes on release, same as before.  ## Notes for Reviewers  - Modal 
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.67 KB (0%) | 1.1 s (0%)        | 106 ms (-47.13% 🔽)       | 1.2 s      | | Library / CSS                                | 23.77 KB (0%) | 476 ms (0%)       | 0 ms (+100% 🔺)           | 476 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 13 ms (-16.92% 🔽)        | 168 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 15 ms (-0.14% 🔽)         | 189 ms     |

- **Issue #668** (2026-09-12): **ScrollArea: move the thumb with transform instead of inset**
  *Symptoms*: ## Summary  Following the guidance in [The Browser's Main Thread Is Expensive](https://kciter.so/posts/the-expensive-main-thread/en/): scroll-linked visuals should be driven by `transform`/`opacity` on the compositor, not by layout properties updated from JavaScript on every frame.  `ScrollArea`'s custom scrollbar previously did the most expensive version of this on every `scroll` event:  1. `handleScroll` called `setScrollPosition`, re-rendering `ScrollArea` and both `ScrollAreaBar`s through React. 2. The new position was applied to the thumb's `::before` via `inset-block-start` / `inset-inline-start`, which are layout properties, so each scroll frame ran style → layout → paint on the main thread.  This PR:  - **Moves the thumb with `transform: translateX/translateY`** instead of `inset`. The translate percentage is relative to the thumb's own size, so the position is divided by the ratio to map it back onto the track (`position / ratio * 100%`). The thumb pseudo-element gets `will-change: transform` so it stays on its own compositor layer between updates. - **Lets each bar track the scrollable element itself.** `ScrollAreaBar` receives the `scrollableRef`, attaches a passive `scroll` listener, and writes `--rs-scroll-area-position` onto its own element. Scroll events no longer re-render anything, and the style recalculation stays scoped to the bar (writing an inherited custom property on the root instead would invalidate every node of the scrolled content: measured ~10ms pe
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.66 KB (0%) | 1.1 s (0%)        | 1.3 s (+14.12% 🔺)        | 2.3 s      | | Library / CSS                                | 23.87 KB (0%) | 478 ms (0%)       | 0 ms (+100% 🔺)           | 478 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 183 ms (+153.75% 🔺)      | 339 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 136 ms (-18.77% 🔽)       | 310 ms     |

- **Issue #667** (2026-09-12): **Overlay: animate backdrop opacity instead of background-color**
  *Symptoms*: ## Summary  Following the guidance in [The Browser's Main Thread Is Expensive](https://kciter.so/posts/the-expensive-main-thread/en/): only `transform` and `opacity` can be animated on the compositor thread, everything else forces style/layout/paint work on the main thread every frame.  The `Overlay` root is a `position: fixed` element covering the whole viewport. It transitioned `background-color` (0% → 70% black) together with `opacity` on open/close, and `Modal` updated that `background-color` on every frame of the drag-to-close gesture through the inherited `--rs-overlay-opacity` custom property. Every one of those frames repainted the full viewport on the main thread, and the custom property change on the root also forced a style recalculation of the entire overlay subtree (the whole modal content).  This PR renders the backdrop as a dedicated `.backdrop` element with a **static** 70% black background and animates only its `opacity`:  - Open/close: `.backdrop` transitions `opacity` with the same duration/easing as the root, so the resulting fade curve (`0.7 · t²`) is unchanged and runs on the compositor. - Drag-to-close: `instanceRef.setOpacity()` now writes `style.opacity` directly on the backdrop element, so the update is scoped to that single element instead of invalidating style for every descendant. Measured in Chromium: updating an inherited custom property on the root of a 6000-node subtree costs ~10ms of style recalc per update, versus ~0.01ms for a direct opacit
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.66 KB (0%) | 1.1 s (0%)        | 2.1 s (-7.88% 🔽)         | 3.1 s      | | Library / CSS                                | 23.87 KB (0%) | 478 ms (0%)       | 0 ms (+100% 🔺)           | 478 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 469 ms (+293.9% 🔺)       | 625 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 279 ms (+65.24% 🔺)       | 453 ms     |

- **Issue #666** (2026-09-07): **Image: render the fallback when loading fails before hydration**
  *Symptoms*: ## Summary  `Image` only learned about a failed load from its React `onError` handler, so a server rendered `<img>` that failed before hydration never moved `status` past `loading` and the `fallback` was never rendered — the browser's broken image icon stayed on screen.  The image element is now also checked when it gets mounted: if it already finished loading without intrinsic dimensions, `decode()` tells a genuinely broken image (rejects) apart from one that legitimately has no intrinsic size, like a `viewBox` only svg (resolves). Images that are still loading keep going through `onError` as before.  - `Image.tsx`: added a callback ref on the image element that detects an already failed load and switches the status to `error`. It composes with a `ref` passed through `imageAttributes` or `attributes`, so existing refs keep working, and it re-runs when `src` changes. - Added a `fallback, error before hydration` story that reproduces the issue: it lets server rendered markup fail to load, then hydrates it and expects the fallback. The story fails on `main` and passes with this change. - Added a patch changeset.  ## Related Issue  Fixes #660  ## Screenshots / Recordings  No visual changes to the existing states — the fallback simply renders in a case where the broken image icon used to show.  ## Notes for Reviewers  - The status is only flipped to `error`; `onLoad` / `onError` callbacks are not synthesized for the pre-hydration case since there is no real event to pass to them.
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 49.77 KB (0%) | 996 ms (0%)       | 1.7 s (-34.18% 🔽)        | 2.7 s      | | Library / CSS                                | 23.44 KB (0%) | 469 ms (0%)       | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 182 ms (+109.12% 🔺)      | 338 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 178 ms (-17.76% 🔽)       | 352 ms     |

- **Issue #665** (2026-09-12): **DropdownMenu, ContextMenu: support size on the root component**
  *Symptoms*: ## Summary  Added a `size` property to the `DropdownMenu` and `ContextMenu` root components. It's used as the default size of all their menu items, so items no longer have to be updated one by one.  - `DropdownMenu` accepts `size` (same responsive `MenuItem` size value) and passes it down through a new internal size context. - `DropdownMenu.Item` uses that size when it doesn't have its own `size`, so per-item `size` still takes priority. - `DropdownMenu.SubMenu` inherits the size from its parent menu and can also override it with its own `size`. - `ContextMenu` picks the property up automatically since its props extend `DropdownMenuProps`.  ```tsx <DropdownMenu size="large"> 	<DropdownMenu.Content> 		<DropdownMenu.Item>Large item</DropdownMenu.Item> 		<DropdownMenu.Item size="small">Small item</DropdownMenu.Item> 	</DropdownMenu.Content> </DropdownMenu> ```  ## Related Issue  N/A  ## Screenshots / Recordings  No new visual behavior beyond the existing `MenuItem` sizes — the new `size` stories in `DropdownMenu.stories.tsx` and `ContextMenu.stories.tsx` cover small / medium / large, a per-item override and a responsive value.  ## Notes for Reviewers  - The size context is defined in `DropdownMenu.tsx` next to the existing submenu contexts instead of a separate `DropdownMenu.context.ts` file — happy to move it if you'd prefer the convention used by newer components. - Submenu inheritance is implemented by resolving `size ?? parentSize` in the root component, since `DropdownMenu.
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.77 KB (+0.68% 🔺) | 996 ms (+0.68% 🔺) | 2.3 s (+1.96% 🔺)         | 3.3 s      | | Library / CSS                                | 23.44 KB (+1.38% 🔺) | 469 ms (+1.38% 🔺) | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (-0.12% 🔽)  | 156 ms (-0.12% 🔽) | 181 ms (+106.74% 🔺)      | 337 ms     | | Theming with a default theme definition / JS | 8.69 KB (+0.21% 🔺)  | 174 ms (+0.21% 🔺) | 264 ms (+15.01% 🔺)       | 438 ms     |

- **Issue #664** (2026-09-12): **fix(Flyout): close content on right click outside**
  *Symptoms*: ## Summary  Flyout only reacted to the `click` event when detecting outside clicks, and browsers don't emit `click` for the secondary mouse button — `useOnClickOutside` even had an explicit `event.button === 2` guard. So right clicking outside of the rendered content never closed it. It's most noticeable with `ContextMenu`: every right click opened a new menu while all the previous ones stayed on the screen.  `useOnClickOutside` now also listens for the `contextmenu` event:  - The listener is registered in the **capture** phase, so the currently rendered content closes *before* another component opens its own content on the same event. That lets `ContextMenu` components replace each other instead of stacking up. Right clicking the same area again still just moves the menu to the new position, because both state updates are batched into a single render. - The target check runs synchronously off the event instead of reusing the `mousedown` result, since `contextmenu` can also be triggered from the keyboard (`Shift+F10` / the context menu key) with no preceding `mousedown`. - Everything still goes through the existing `disabled` option, so `disableCloseOnOutsideClick` keeps working and the close reason stays `outside-click`.  The inside-the-refs check used by `mousedown`/`touchstart` was extracted into a shared `checkEventInsideRefs` helper so both paths stay in sync.  ## Related Issue  N/A  ## Screenshots / Recordings  N/A — covered by the interaction tests below.  ## Notes for
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.74 KB (-0.18% 🔽) | 995 ms (-0.18% 🔽) | 1.8 s (-13.56% 🔽)        | 2.8 s      | | Library / CSS                                | 23.44 KB (0%)        | 469 ms (0%)        | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)        | 224 ms (+197.93% 🔺)      | 380 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)        | 150 ms (-39.33% 🔽)       | 324 ms     |

- **Issue #663** (2026-09-06): **feat(Link): add fullWidth support**
  *Symptoms*: ## Summary  Adds a responsive `fullWidth` prop to `Link`, matching the API already used by `Button` (`G.Responsive<boolean>`).  `Link` renders as `display: inline` by default, so `width: 100%` alone has no effect. The prop therefore switches the display mode as well:  | state | `display` | `width` | | --- | --- | --- | | `fullWidth` | `block` | `100%` | | `fullWidth` + `icon` | `flex` | `100%` | | not full width | `inline` | `auto` | | not full width + `icon` | `inline-flex` | `auto` |  The `--with-icon` case is handled inside both the `true` and `false` `@value` blocks so that responsive values reset correctly at every breakpoint — the nested selectors carry higher specificity than the base `.root.--with-icon` rule, and the generated media-query rules keep matching specificity so a later breakpoint can override an earlier one.  Unlike `Button`, this does not force `text-align: center` — that reads as button-specific and would be surprising for a text link.  Changes: - `Link.types.ts` — new `fullWidth?: G.Responsive<boolean>` prop - `Link.tsx` — wires it through `responsiveClassNames`, same as `Button` - `Link.module.css` — new `@responsive .root.--full-width` block - `Link.stories.tsx` — `fullWidth` story (plain, with icon, and responsive `{ s: true, m: false }`) with a `display: block` assertion - changeset (`minor`)  ## Related Issue  <!-- Link to the issue number if applicable -->  ## Screenshots / Recordings  No screenshots attached — the new `fullWidth` story covers the
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.76 KB (+0.17% 🔺) | 996 ms (+0.17% 🔺) | 1.4 s (-14.06% 🔽)        | 2.4 s      | | Library / CSS                                | 23.5 KB (+0.28% 🔺)  | 471 ms (+0.28% 🔺) | 0 ms (+100% 🔺)           | 471 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)        | 159 ms (+421.23% 🔺)      | 315 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)        | 162 ms (-5.56% 🔽)        | 336 ms     |

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

### Incident Patch 1: `924b7424` (2026-09-07)
**Commit Message**: Image: render the fallback when loading fails before hydration (#666)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-image-fallback-before-hydration.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Image: Rendered the fallback when a server rendered image fails to load before React hydrates the page
```

**File**: `packages/reshaped/src/components/Image/Image.tsx` (modified, +16/-0)
```diff
@@ -27,6 +27,8 @@ const Image: React.FC<T.Props> = (props) => {
 		renderImage,
 	} = props;
 	const [status, setStatus] = React.useState("loading");
+	// Image attributes are merged on top of the root attributes when rendering the image element
+	const passedImageRef = passedImageAttributes?.ref ?? attributes?.ref;
 	const mixinStyles = resolveMixin({ radius: borderRadius, width, height, maxWidth, aspectRatio });
 	const rootClassNames = classNames(
 		s.root,
@@ -56,6 +58,19 @@ const Image: React.FC<T.Props> = (props) => {
 		passedImageAttributes?.onError?.(e);
 	};
 
+	const handleImageRef = React.useCallback(
+		(el: HTMLImageElement | null) => {
+			if (typeof passedImageRef === "function") passedImageRef(el);
+			else if (passedImageRef) passedImageRef.current = el;
+
+			// Server rendered images start loading before React hydrates,
+			// so their error event can fire before the error handler gets attached
+			if (!el || !src || !el.complete || el.naturalWidth > 0) return;
+			el.decode().catch(() => setStatus("error"));
+		},
+		[passedImageRef, src]
+	);
+
 	React.useEffect(() => {
 		setStatus("loading");
 	}, [src]);
@@ -90,6 +105,7 @@ const Image: React.FC<T.Props> = (props) => {
 		role: alt ? undefined : "presentation",
 		onLoad: handleLoad,
 		onError: handleError,
+		ref: handleImageRef,
 		className: outline ? imageClassNames : classNames([imageClassNames, rootClassNames]),
 		style,
 	};
```

---

### Incident Patch 2: `469a1b27` (2026-09-06)
**Commit Message**: fix(Badge): truncate long text and stop dismiss from following the link (#662)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-badge-dismiss-link.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Badge: Fixed dismiss button following the link when the badge is rendered with the href prop
```

**File**: `.changeset/fix-badge-truncation.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Badge: Limited the width to 100% of the parent element and truncated the long text with an ellipsis
```

**File**: `packages/reshaped/src/components/Badge/Badge.module.css` (modified, +14/-0)
```diff
@@ -13,6 +13,7 @@
 	color: var(--rs-color-on-background-neutral);
 	box-sizing: border-box;
 	box-shadow: 0 0 0 1px var(--rs-badge-border-color) inset;
+	max-width: 100%;
 
 	/* GPU for container positioning */
 	backface-visibility: hidden;
@@ -32,9 +33,20 @@
 	display: inline-flex;
 	align-items: center;
 	gap: var(--rs-badge-gap);
+	max-width: 100%;
+	min-width: 0;
+}
+
+.text {
+	overflow: hidden;
+	white-space: nowrap;
+	text-overflow: ellipsis;
+	min-width: 0;
 }
 
 .icon {
+	flex-shrink: 0;
+
 	&:first-child {
 		margin-inline-start: calc(var(--rs-unit-x0-5) * -1);
 	}
@@ -49,6 +61,7 @@
 }
 
 .dismiss {
+	flex-shrink: 0;
 	border-radius: var(--rs-radius-small);
 	transition: var(--rs-duration-fast) var(--rs-easing-standard);
 	transition-property: opacity;
@@ -170,6 +183,7 @@
 .container .root {
 	position: absolute;
 	z-index: 10;
+	max-width: none;
 	inset-inline-end: 0;
 	transform: translate(50%, var(--rs-badge-translate-y)) scale(1);
 	user-select: none;
```

**File**: `packages/reshaped/src/components/Badge/Badge.tsx` (modified, +4/-0)
```diff
@@ -49,6 +49,9 @@ const Badge = forwardRef<ActionableRef, T.Props>((props, ref) => {
 	);
 
 	const handleDismiss: ActionableProps["onClick"] = (e) => {
+		// Prevent the parent Actionable from handling the click,
+		// including following the link when the badge is rendered as one
+		e.preventDefault();
 		e.stopPropagation();
 		onDismiss?.();
 	};
@@ -69,6 +72,7 @@ const Badge = forwardRef<ActionableRef, T.Props>((props, ref) => {
 					<Text
 						variant={size === "large" ? "body-2" : "caption-1"}
 						weight="medium"
+						className={s.text}
 						attributes={{
 							"aria-hidden": hidden ? "true" : undefined,
 						}}
```

**File**: `packages/reshaped/src/components/Badge/tests/Badge.stories.tsx` (modified, +63/-0)
```diff
@@ -337,6 +337,69 @@ export const href: StoryObj = {
 	},
 };
 
+export const hrefDismissible: StoryObj<{ handleDismiss: ReturnType<typeof fn> }> = {
+	name: "test: href, onDismiss",
+	args: {
+		handleDismiss: fn(),
+	},
+	render: (args) => (
+		<Badge href="#badge-dismiss" onDismiss={args.handleDismiss} dismissAriaLabel="Dismiss">
+			Badge
+		</Badge>
+	),
+	play: async ({ canvas, args }) => {
+		const initialHash = window.location.hash;
+		const dismissTrigger = canvas.getByRole("button", { name: "Dismiss" });
+
+		expect(canvas.getByRole("link")).toHaveAttribute("href", "#badge-dismiss");
+
+		await userEvent.click(dismissTrigger);
+
+		expect(args.handleDismiss).toHaveBeenCalledTimes(1);
+		// Dismissing the badge shouldn't follow the link
+		expect(window.location.hash).toBe(initialHash);
+	},
+};
+
+export const truncation: StoryObj = {
+	name: "test: truncation",
+	render: () => (
+		<Example>
+			<Example.Item title={["truncation", "text is truncated, badge is not wider than 200px"]}>
+				<View width="200px" align="start" gap={3} attributes={{ "data-testid": "root" }}>
+					<Badge attributes={{ "data-testid": "badge" }}>
+						Badge with a very long text that should get truncated
+					</Badge>
+					<Badge icon={IconPlus} endIcon={IconPlus} attributes={{ "data-testid": "badge" }}>
+						Badge with a very long text that should get truncated
+					</Badge>
+					<Badge
+						onDismiss={() => {}}
+						dismissAriaLabel="Dismiss"
+						attributes={{ "data-testid": "badge" }}
+					>
+						Badge with a very long text that should get truncated
+					</Badge>
+				</View>
+			</Example.Item>
+		</Example>
+	),
+	play: async ({ canvas }) => {
+		const badges = canvas.getAllByTestId("badge");
+
+		badges.forEach((badge) => {
+			// Badge is not growing wider than its parent
+			expect(badge.getBoundingClientRect().width).toBeLessThanOrEqual(200);
+
+			// Badge text is rendered on a single line and gets clipped
+			const text = badge.querySelector("div")!;
+
+			expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
+			expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
+		});
+	},
+};
+
 export const onClick: StoryObj<{ handleClick: ReturnType<typeof fn> }> = {
 	name: "onClick",
 	args: {
```

---

### Incident Patch 3: `69b74133` (2026-09-06)
**Commit Message**: fix(Accordion): don't replay the expand animation when effects are re-attached (#661)

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.changeset/fix-accordion-animation-replay.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Accordion: Fixed the expand animation replaying when React re-attaches the effects of a mounted accordion without changing its state, for example when it's moved between its siblings or hidden and shown by a Suspense boundary. Toggling the accordion while it's still animating now continues from the current height instead of jumping, and transitions bubbling up from the content no longer end the animation early.
```

**File**: `packages/reshaped/src/components/_private/Expandable/Expandable.tsx` (modified, +32/-18)
```diff
@@ -12,6 +12,8 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 	const { children, active, attributes } = props;
 	const rootRef = React.useRef<HTMLDivElement>(null);
 	const mountedRef = React.useRef(false);
+	const animatedActiveRef = React.useRef(active);
+	const frameRef = React.useRef<number | null>(null);
 	const [animatedHeight, setAnimatedHeight] = React.useState<React.CSSProperties["height"] | null>(
 		active ? "auto" : null
 	);
@@ -22,7 +24,7 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 	);
 
 	const handleTransitionEnd = (e: React.TransitionEvent) => {
-		if (e.propertyName !== "height") return;
+		if (e.propertyName !== "height" || e.target !== rootRef.current) return;
 
 		setAnimatedHeight(active ? "auto" : null);
 	};
@@ -35,33 +37,45 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 		});
 	}, []);
 
+	// Animating only on the active prop change keeps React from replaying the animation
+	// when it tears down and sets up the effects of the mounted component again
 	useIsomorphicLayoutEffect(() => {
 		const rootEl = rootRef.current;
-		if (!rootEl || !mountedRef.current) return;
+		const activeChanged = animatedActiveRef.current !== active;
 
-		if (!checkTransitions()) {
+		animatedActiveRef.current = active;
+
+		if (!rootEl || !activeChanged) return;
+
+		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
+		frameRef.current = null;
+
+		const settle = () => {
+			rootEl.style.height = "";
 			setAnimatedHeight(active ? "auto" : null);
+		};
+
+		if (!mountedRef.current || !checkTransitions()) {
+			settle();
 			return;
 		}
 
-		if (active) {
-			rootEl.style.height = "auto";
-
-			requestAnimationFrame(() => {
-				const targetHeight = rootEl.clientHeight;
-				rootEl.style.height = "0";
+		const currentHeight = rootEl.clientHeight;
 
-				requestAnimationFrame(() => {
-					setAnimatedHeight(targetHeight);
-				});
-			});
-		} else {
-			rootEl.style.height = `${rootEl.clientHeight}px`;
+		if (active) rootEl.style.height = "auto";
+		const targetHeight = active ? rootEl.clientHeight : 0;
 
-			requestAnimationFrame(() => {
-				setAnimatedHeight(0);
-			});
+		if (targetHeight === currentHeight) {
+			settle();
+			return;
 		}
+
+		rootEl.style.height = `${currentHeight}px`;
+
+		frameRef.current = requestAnimationFrame(() => {
+			frameRef.current = null;
+			setAnimatedHeight(targetHeight);
+		});
 	}, [active]);
 
 	return (
```

---

### Incident Patch 4: `7561531e` (2026-08-17)
**Commit Message**: fix: useHotkeys multi-key handling with held Meta + global handler audit fixes (#657)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/use-hotkeys-meta-keys.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+useHotkeys: Fixed hotkeys not triggering when switching between different keys while holding Meta on macOS, since the keyup events for regular keys are not emitted while Meta is pressed. Also fixed the pressed keys tracking for quick key sequences, the `mod` key support in `checkHotkeyState`, duplicate hotkey calls when multiple Reshaped providers are rendered on the same page and hotkeys removal when the same callback is used by multiple components
```

**File**: `packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx` (modified, +120/-82)
```diff
@@ -28,7 +28,7 @@ type HotkeyData = {
  * Utilities
  */
 const COMBINATION_DELIMETER = "+";
-let modifiedKeys: string[] = [];
+const MODIFIER_KEYS = ["meta", "control", "alt", "shift"];
 
 const formatHotkey = (hotkey: string) => {
 	if (hotkey === " ") return hotkey;
@@ -44,13 +44,32 @@ const getEventKey = (e: KeyboardEvent) => {
 	if (!e.key) return;
 
 	// Having alt pressed modifies e.key value, so relying on e.code for it
-	if (e.altKey && /^[Key|Digit|Numpad]/.test(e.code)) {
-		return e.code.toLowerCase().replace(/key|digit|numpad/, "");
+	if (e.altKey && /^(Key|Digit|Numpad)/.test(e.code)) {
+		return e.code.toLowerCase().replace(/^(key|digit|numpad)/, "");
 	}
 
 	return e.key.toLowerCase();
 };
 
+/**
+ * Support for `mod` that represents both Mac and Win keyboards
+ * We create the hotkeyId again to sort the mod key correctly
+ */
+const getPressedIds = (pressedId: string) => {
+	const pressedFormattedKeys = pressedId.split(COMBINATION_DELIMETER);
+	const ids = [pressedId];
+
+	if (pressedFormattedKeys.includes("control")) {
+		ids.push(getHotkeyId(pressedId.replace("control", "mod")));
+	}
+
+	if (pressedFormattedKeys.includes("meta")) {
+		ids.push(getHotkeyId(pressedId.replace("meta", "mod")));
+	}
+
+	return ids;
+};
+
 // Removing the unknown gets highlighted an invalid syntax
 // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
 const walkHotkeys = <T extends unknown>(
@@ -72,82 +91,66 @@ export class HotkeyStore {
 
 	getSize = () => Object.keys(this.hotkeyMap).length;
 
+	hasHandlers = (pressedId: string) => {
+		return getPressedIds(pressedId).some((id) => this.hotkeyMap[id]?.size);
+	};
+
 	bindHotkeys = (
 		hotkeys: Hotkeys,
 		ref: React.RefObject<HTMLElement | null>,
 		options: HotkeyOptions
 	) => {
-		walkHotkeys(hotkeys, (id, hotkeyData) => {
-			if (!hotkeyData) return;
+		const boundData: Array<{ id: string; data: HotkeyData }> = [];
+
+		walkHotkeys(hotkeys, (id, callback) => {
+			if (!callback) return;
+
+			const data = { callback, ref, options };
 
 			if (!this.hotkeyMap[id]) {
 				this.hotkeyMap[id] = new Set();
 			}
 
-			this.hotkeyMap[id].add({ callback: hotkeyData, ref, options });
+			this.hotkeyMap[id].add(data);
+			boundData.push({ id, data });
 		});
-	};
 
-	unbindHotkeys = (hotkeys: Hotkeys) => {
-		walkHotkeys(hotkeys, (id, hotkeyCallback) => {
-			if (!hotkeyCallback) return;
+		return () => {
+			boundData.forEach(({ id, data }) => {
+				this.hotkeyMap[id]?.delete(data);
 
-			this.hotkeyMap[id]?.forEach((data) => {
-				if (data.callback === hotkeyCallback) {
-					this.hotkeyMap[id].delete(data);
+				if (!this.hotkeyMap[id]?.size) {
+					delete this.hotkeyMap[id];
 				}
 			});
-
-			if (!this.hotkeyMap[id]?.size) {
-				delete this.hotkeyMap[id];
-			}
-		});
+		};
 	};
 
 	handleKeyDown = (pressedMap: PressedMap, e: KeyboardEvent) => {
 		const pressedKeys = Object.keys(pressedMap);
 		if (!pressedKeys.length) return;
 
 		const pressedId = getHotkeyId(pressedKeys.join(COMBINATION_DELIMETER));
-		const pressedFormattedKeys = pressedId.split(COMBINATION_DELIMETER);
-
-		const hotkeyData = this.hotkeyMap[pressedId];
-
-		/**
-		 * Support for `mod` that represents both Mac and Win keyboards
-		 * We create the hotkeyId again to sort the mod key correctly
-		 */
-		const controlToModPressedId = getHotkeyId(pressedId.replace("control", "mod"));
-		const metaToModPressedId = getHotkeyId(pressedId.replace("meta", "mod"));
-		const hotkeyControlModData =
-			pressedFormattedKeys.includes("control") && this.hotkeyMap[controlToModPressedId];
-		const hotkeyMetaModData =
-			pressedFormattedKeys.includes("meta") && this.hotkeyMap[metaToModPressedId];
-
-		[hotkeyData, hotkeyControlModData, hotkeyMetaModData].forEach((hotkeyData) => {
-			if (!hotkeyData) return;
-
-			if (hotkeyData?.size) {
-				hotkeyData.forEach((data) => {
-					const eventTarget = e.composedPath()[0] as Node;
-
-					if (
-						data.ref.current &&
-						!(eventTarget === data.ref.current || data.ref.current.contains(eventTarget))
-					) {
-						return;
-					}
-
-					const resolvedEvent = pressedMap[pressedId];
+		const eventTarget = e.composedPath()[0] as Node;
+
+		getPressedIds(pressedId).forEach((id) => {
+			const hotkeyData = this.hotkeyMap[id];
+			if (!hotkeyData?.size) return;
+
+			hotkeyData.forEach((data) => {
+				if (
+					data.ref.current &&
+					!(eventTarget === data.ref.current || data.ref.current.contains(eventTarget))
+				) {
+					return;
+				}
 
-					if (data.options.preventDefault) {
-						resolvedEvent?.preventDefault();
-						e.preventDefault();
-					}
+				if (data.options.preventDefault) {
+					e.preventDefault();
+				}
 
-					data.callback(e);
-				});
-			}
+				data.callback(e);
+			});
 		});
 	};
 }
@@ -159,30 +162,56 @@ const globalHotkeyStore = new HotkeyStore();
  */
 const HotkeyContext = React.createContext({} as Context);
 
-export const SingletonHotkeysProvider: React.FC<{ children: React.ReactNode }> = 
```

---

### Incident Patch 5: `792c5756` (2026-08-15)
**Commit Message**: feat: use caption-1 text for the small size of Button, MenuItem, Tabs and form fields (#656)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/small-size-caption-text.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Button, MenuItem, Tabs, TextField, Select and PinField: Small size now renders caption-1 text, their vertical padding grows by the line height difference so the component size stays the same
```

**File**: `packages/reshaped/src/components/Button/Button.module.css` (modified, +12/-8)
```diff
@@ -6,6 +6,7 @@
 	/* Using --rs-button-p and --rs-p to dynamically reassign --rs-p for all sizes of ghost buttons, used by Aligner */
 	--rs-p-v: var(--rs-button-p-v);
 	--rs-p-h: var(--rs-button-p-h);
+	--rs-button-min-size: calc(var(--rs-button-line-height) + var(--rs-button-p-v) * 2);
 
 	transition: var(--rs-duration-fast) var(--rs-easing-standard);
 	transition-property: background-color, box-shadow, border-color, color, transform, opacity;
@@ -29,10 +30,10 @@
 	line-height: var(--rs-button-line-height);
 	letter-spacing: var(--rs-button-letter-spacing);
 	box-sizing: border-box;
-	min-height: calc(var(--rs-button-line-height) + var(--rs-p-v) * 2);
-	min-width: calc(
-		var(--rs-button-line-height) - (var(--rs-unit-x1) * 2) + (var(--rs-button-p-h) * 2)
-	);
+
+	/* Keeps icon-only buttons square by using the same value for both dimensions */
+	min-height: var(--rs-button-min-size);
+	min-width: var(--rs-button-min-size);
 	background-color: var(--rs-button-background-color);
 	color: var(--rs-button-color);
 	isolation: isolate;
@@ -142,13 +143,16 @@
 
 @responsive .--size {
 	@value small {
-		--rs-button-p-v: var(--rs-unit-x1);
+		/* Padding absorbs the caption-1 line height difference to keep the size it had with body-2 text */
+		--rs-button-p-v: calc(
+			var(--rs-unit-x1) + (var(--rs-line-height-body-2) - var(--rs-line-height-caption-1)) / 2
+		);
 		--rs-button-p-h: var(--rs-unit-x2);
 		--rs-button-gap: var(--rs-unit-x1-5);
 		--rs-button-icon-align: var(--rs-unit-x0-5);
-		--rs-button-line-height: var(--rs-line-height-body-2);
-		--rs-button-font-size: var(--rs-font-size-body-2);
-		--rs-button-letter-spacing: var(--rs-letter-spacing-body-2);
+		--rs-button-line-height: var(--rs-line-height-caption-1);
+		--rs-button-font-size: var(--rs-font-size-caption-1);
+		--rs-button-letter-spacing: var(--rs-letter-spacing-caption-1);
 		--rs-button-radius: var(--rs-radius-small);
 	}
 
```

**File**: `packages/reshaped/src/components/MenuItem/MenuItem.module.css` (modified, +7/-4)
```diff
@@ -32,13 +32,16 @@ button.root {
 
 @responsive .--size {
 	@value small {
-		--rs-p-v: var(--rs-unit-x1);
+		/* Padding absorbs the caption-1 line height difference to keep the size it had with body-2 text */
+		--rs-p-v: calc(
+			var(--rs-unit-x1) + (var(--rs-line-height-body-2) - var(--rs-line-height-caption-1)) / 2
+		);
 		--rs-p-h: var(--rs-unit-x1-5);
 		--rs-menu-item-radius: var(--rs-radius-small);
 
-		font-size: var(--rs-font-size-body-2);
-		line-height: var(--rs-line-height-body-2);
-		letter-spacing: var(--rs-letter-spacing-body-2);
+		font-size: var(--rs-font-size-caption-1);
+		line-height: var(--rs-line-height-caption-1);
+		letter-spacing: var(--rs-letter-spacing-caption-1);
 	}
 
 	@value medium {
```

**File**: `packages/reshaped/src/components/PinField/PinFieldControlled.tsx` (modified, +5/-3)
```diff
@@ -45,9 +45,11 @@ const PinFieldControlled: React.FC<T.ControlledProps> = (props) => {
 	} = props;
 	const patternRegexp = patternMap[pattern];
 	const responsiveInputSize = responsivePropDependency(size, (value) => sizeMap[value]);
-	const responsiveTextVariant = responsivePropDependency(size, (value) =>
-		value === "medium" ? "body-2" : "body-1"
-	);
+	const responsiveTextVariant = responsivePropDependency(size, (value) => {
+		if (value === "small") return "caption-1";
+		if (value === "medium") return "body-2";
+		return "body-1";
+	});
 	const responsiveRadius = responsivePropDependency(size, (value) =>
 		value === "small" ? "small" : "medium"
 	);
```

**File**: `packages/reshaped/src/components/Select/Select.module.css` (modified, +9/-5)
```diff
@@ -107,13 +107,17 @@
 		--rs-select-gap: var(--rs-unit-x1-5);
 		--rs-select-chevron-size: var(--rs-unit-x4);
 		--rs-select-radius: var(--rs-radius-small);
-		--rs-select-p-v: var(--rs-unit-x1);
+
+		/* Padding absorbs the caption-1 line height difference to keep the size it had with body-2 text */
+		--rs-select-p-v: calc(
+			var(--rs-unit-x1) + (var(--rs-line-height-body-2) - var(--rs-line-height-caption-1)) / 2
+		);
 		--rs-select-p-h: var(--rs-unit-x2);
-		--rs-select-font-size: var(--rs-font-size-body-2);
-		--rs-select-line-height: var(--rs-line-height-body-2);
-		--rs-select-letter-spacing: var(--rs-letter-spacing-body-2);
+		--rs-select-font-size: var(--rs-font-size-caption-1);
+		--rs-select-line-height: var(--rs-line-height-caption-1);
+		--rs-select-letter-spacing: var(--rs-letter-spacing-caption-1);
 		--rs-select-icon-align: var(--rs-unit-x0-5);
-		--rs-select-min-height: calc(var(--rs-select-line-height) + var(--rs-unit-x1) * 2);
+		--rs-select-min-height: calc(var(--rs-select-line-height) + var(--rs-select-p-v) * 2);
 	}
 
 	@value medium {
```

**File**: `packages/reshaped/src/components/Tabs/Tabs.module.css` (modified, +4/-1)
```diff
@@ -355,7 +355,10 @@
 }
 
 .--size-small {
-	--rs-tabs-item-p-v: var(--rs-unit-x1);
+	/* Padding absorbs the caption-1 line height difference to keep the size it had with body-2 text */
+	--rs-tabs-item-p-v: calc(
+		var(--rs-unit-x1) + (var(--rs-line-height-body-2) - var(--rs-line-height-caption-1)) / 2
+	);
 	--rs-tabs-item-p-h: var(--rs-unit-x2);
 	--rs-tabs-icon-gap: var(--rs-unit-x1-5);
 	--rs-tabs-radius: var(--rs-radius-small);
```

**File**: `packages/reshaped/src/components/Tabs/TabsItem.tsx` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ const TabsItem = React.forwardRef<ActionableRef, T.ItemProps>((props, ref) => {
 				{icon && <Icon svg={icon} className={s.icon} size={4} />}
 				{children && (
 					<Text
-						variant={size === "large" ? "body-1" : "body-2"}
+						variant={size === "large" ? "body-1" : size === "small" ? "caption-1" : "body-2"}
 						weight="medium"
 						className={s.buttonText}
 					>
```

**File**: `packages/reshaped/src/components/TextField/TextField.module.css` (modified, +11/-5)
```diff
@@ -194,14 +194,20 @@
 	@value small {
 		--rs-text-field-gap: var(--rs-unit-x1-5);
 		--rs-text-field-radius: var(--rs-radius-small);
-		--rs-text-field-p-v: var(--rs-unit-x1);
+
+		/* Padding absorbs the caption-1 line height difference to keep the size it had with body-2 text */
+		--rs-text-field-p-v: calc(
+			var(--rs-unit-x1) + (var(--rs-line-height-body-2) - var(--rs-line-height-caption-1)) / 2
+		);
 		--rs-text-field-p-h: var(--rs-unit-x2);
 		--rs-text-field-icon-align: var(--rs-unit-x0-5);
-		--rs-text-field-font-size: var(--rs-font-size-body-2);
-		--rs-text-field-line-height: var(--rs-line-height-body-2);
-		--rs-text-field-letter-spacing: var(--rs-letter-spacing-body-2);
+		--rs-text-field-font-size: var(--rs-font-size-caption-1);
+		--rs-text-field-line-height: var(--rs-line-height-caption-1);
+		--rs-text-field-letter-spacing: var(--rs-letter-spacing-caption-1);
 		--rs-text-field-action-inset: var(--rs-unit-x1);
-		--rs-text-field-min-height: calc(var(--rs-text-field-line-height) + var(--rs-unit-x1) * 2);
+		--rs-text-field-min-height: calc(
+			var(--rs-text-field-line-height) + var(--rs-text-field-p-v) * 2
+		);
 	}
 
 	@value medium {
```

---

### Incident Patch 6: `00954aea` (2026-08-15)
**Commit Message**: feat(Select): add renderTrigger for custom trigger elements (#655)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/select-render-trigger.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": minor
+---
+
+Select: Added a renderTrigger prop for rendering a custom trigger element, it receives the flyout attributes as the first argument and the selection state as the second one
```

**File**: `packages/reshaped/src/components/Select/Select.types.ts` (modified, +36/-3)
```diff
@@ -3,6 +3,7 @@ import type { ClassName } from "@reshaped/utilities";
 
 import type { ActionableProps } from "@/components/Actionable";
 import type { DropdownMenuProps } from "@/components/DropdownMenu";
+import type { FlyoutTriggerAttributes } from "@/components/Flyout";
 import type { IconProps } from "@/components/Icon";
 import type { MenuItemProps } from "@/components/MenuItem";
 import type * as G from "@/types/global";
@@ -13,6 +14,34 @@ type Size = G.Responsive<"small" | "medium" | "large" | "xlarge">;
 type RenderSingleValue = (args: { value: string }) => React.ReactNode;
 type RenderMultipleValues = (args: { value: string[] }) => React.ReactNode;
 
+/**
+ * Attributes passed to the renderTrigger function, they have to be applied
+ * to the custom trigger element for it to control the dropdown
+ */
+export type TriggerRenderAttributes = Omit<FlyoutTriggerAttributes, "onClick"> & {
+	// Widened from the Flyout signature since we also pass the Select onClick event through it
+	onClick?: ActionableProps["onClick"];
+	/** Currently selected value, falls back to the placeholder when there is no selection */
+	children?: React.ReactNode;
+};
+
+type TriggerRenderState = {
+	/** Indicates that the dropdown is currently displayed */
+	active: boolean;
+	disabled?: boolean;
+	hasError?: boolean;
+};
+
+type RenderSingleTrigger = (
+	attributes: TriggerRenderAttributes,
+	props: TriggerRenderState & { value: string }
+) => React.ReactNode;
+
+type RenderMultipleTrigger = (
+	attributes: TriggerRenderAttributes,
+	props: TriggerRenderState & { value: string[] }
+) => React.ReactNode;
+
 // Use a single event type across Native and Custom Select variants so that
 // inline `onChange` callbacks can be contextually typed consistently across
 // overloads. Native fires a real `HTMLSelectElement` change event; Custom
@@ -84,12 +113,14 @@ export type NativeControlledFragment = {
 	value: string;
 	defaultValue?: never;
 	renderValue?: never;
+	renderTrigger?: never;
 	onChange?: SelectChangeHandler<string>;
 };
 export type NativeUncontrolledFragment = {
 	value?: never;
 	defaultValue?: string;
 	renderValue?: never;
+	renderTrigger?: never;
 	onChange?: SelectChangeHandler<string>;
 };
 
@@ -99,13 +130,15 @@ export type CustomControlledFragment =
 			value: string;
 			defaultValue?: never;
 			renderValue?: RenderSingleValue;
+			renderTrigger?: RenderSingleTrigger;
 			onChange?: SelectChangeHandler<string>;
 	  }
 	| {
 			multiple: true;
 			value: string[];
 			defaultValue?: never[];
 			renderValue: RenderMultipleValues;
+			renderTrigger?: RenderMultipleTrigger;
 			onChange?: SelectChangeHandler<string[]>;
 	  };
 export type CustomUncontrolledFragment =
@@ -114,13 +147,15 @@ export type CustomUncontrolledFragment =
 			value?: never;
 			defaultValue?: string;
 			renderValue?: RenderSingleValue;
+			renderTrigger?: RenderSingleTrigger;
 			onChange?: SelectChangeHandler<string>;
 	  }
 	| {
 			multiple: true;
 			value?: never[];
 			defaultValue?: string[];
 			renderValue: RenderMultipleValues;
+			renderTrigger?: RenderMultipleTrigger;
 			onChange?: SelectChangeHandler<string[]>;
 	  };
 
@@ -159,6 +194,4 @@ export type TriggerProps = Pick<
 	triggerAttributes?: ActionableProps["attributes"];
 };
 
-export type RootProps = Omit<Props, "children"> & {
-	children: (props: Omit<Props, "children">) => React.ReactNode;
-};
+export type HiddenInputProps = Pick<TriggerProps, "value" | "name" | "id" | "inputAttributes">;
```

**File**: `packages/reshaped/src/components/Select/SelectCustomControlled.tsx` (modified, +48/-0)
```diff
@@ -9,6 +9,7 @@ import { responsivePropDependency } from "@/utilities/props";
 import CheckmarkIcon from "@/icons/Checkmark";
 import type * as T from "./Select.types";
 import SelectGroup from "./SelectGroup";
+import SelectHiddenInput from "./SelectHiddenInput";
 import SelectOption from "./SelectOption";
 import SelectTrigger from "./SelectTrigger";
 
@@ -17,6 +18,7 @@ const SelectCustomControlled: React.FC<T.CustomControlledProps> = (props) => {
 		children,
 		value,
 		name,
+		id,
 		placeholder,
 		multiple,
 		selectedIconPosition = "start",
@@ -25,7 +27,12 @@ const SelectCustomControlled: React.FC<T.CustomControlledProps> = (props) => {
 		fallbackPositions,
 		positionRef,
 		size,
+		disabled,
+		hasError,
+		inputAttributes,
+		onClick,
 		renderValue: passedRenderValue,
+		renderTrigger: passedRenderTrigger,
 	} = props;
 	const initialFocusRef = React.useRef<HTMLButtonElement>(null);
 	const searchStringRef = React.useRef<string>("");
@@ -155,6 +162,20 @@ const SelectCustomControlled: React.FC<T.CustomControlledProps> = (props) => {
 		return null;
 	};
 
+	const renderTrigger = (attributes: T.TriggerRenderAttributes) => {
+		if (!passedRenderTrigger) return null;
+
+		const triggerState = {
+			active: !!attributes["data-rs-flyout-active"],
+			disabled,
+			hasError,
+		};
+
+		// Calling it in both branches for correct type inference, same as renderValue
+		if (multiple) return passedRenderTrigger(attributes, { ...triggerState, value });
+		return passedRenderTrigger(attributes, { ...triggerState, value });
+	};
+
 	return (
 		<DropdownMenu
 			width={width}
@@ -177,6 +198,33 @@ const SelectCustomControlled: React.FC<T.CustomControlledProps> = (props) => {
 						},
 					};
 
+					if (passedRenderTrigger) {
+						const renderedValue = renderValue();
+
+						return (
+							<>
+								{renderTrigger({
+									...triggerAttributes,
+									// Actionable handles both handlers for the default trigger,
+									// with a custom one we have to compose them manually
+									onClick: (e) => {
+										if (disabled) return;
+										onClick?.(e);
+										triggerAttributes.onClick?.();
+									},
+									children: renderedValue ?? placeholder,
+								})}
+
+								<SelectHiddenInput
+									value={value}
+									name={name}
+									id={id}
+									inputAttributes={inputAttributes}
+								/>
+							</>
+						);
+					}
+
 					return (
 						<SelectTrigger {...props} triggerAttributes={triggerAttributes} value={value}>
 							{renderValue()}
```

**File**: `packages/reshaped/src/components/Select/SelectHiddenInput.tsx` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import type * as T from "./Select.types";
+
+/**
+ * Holds the selected value for the form submission,
+ * shared between the default and the custom trigger rendering
+ */
+const SelectHiddenInput: React.FC<T.HiddenInputProps> = (props) => {
+	const { value, name, id, inputAttributes } = props;
+
+	return (
+		<input
+			{...inputAttributes}
+			type="hidden"
+			value={typeof value === "string" ? value : JSON.stringify(value)}
+			name={name}
+			id={id}
+		/>
+	);
+};
+
+SelectHiddenInput.displayName = "SelectHiddenInput";
+
+export default SelectHiddenInput;
```

**File**: `packages/reshaped/src/components/Select/SelectTrigger.tsx` (modified, +2/-7)
```diff
@@ -9,6 +9,7 @@ import { responsiveClassNames } from "@/utilities/props";
 import { resolveMixin } from "@/styles/mixin";
 import type * as T from "./Select.types";
 import SelectEndContent from "./SelectEndContent";
+import SelectHiddenInput from "./SelectHiddenInput";
 import SelectStartContent from "./SelectStartContent";
 import s from "./Select.module.css";
 
@@ -71,13 +72,7 @@ const SelectTrigger: React.FC<T.TriggerProps> = (props) => {
 				<SelectEndContent disabled={disabled} size={size} />
 			</Actionable>
 
-			<input
-				{...inputAttributes}
-				type="hidden"
-				value={typeof value === "string" ? value : JSON.stringify(value)}
-				name={name}
-				id={id}
-			/>
+			<SelectHiddenInput value={value} name={name} id={id} inputAttributes={inputAttributes} />
 		</div>
 	);
 };
```

**File**: `packages/reshaped/src/components/Select/tests/Select.stories.tsx` (modified, +59/-0)
```diff
@@ -2,12 +2,14 @@ import { StoryObj } from "@storybook/react-vite";
 import React from "react";
 import { expect, fn, Mock, userEvent, within } from "storybook/test";
 
+import Actionable from "@/components/Actionable";
 import Badge from "@/components/Badge";
 import FormControl from "@/components/FormControl";
 import MenuItem from "@/components/MenuItem";
 import Modal from "@/components/Modal";
 import Select, { SelectProps, SelectTrigger } from "@/components/Select";
 import Text from "@/components/Text";
+import View from "@/components/View";
 import useToggle from "@/hooks/useToggle";
 import { Example, Placeholder } from "@/utilities/storybook";
 import IconZap from "@/icons/Zap";
@@ -385,6 +387,63 @@ export const renderValue = {
 	},
 };
 
+export const renderTrigger: StoryObj<{ handleChange: Mock }> = {
+	name: "renderTrigger",
+	args: {
+		handleChange: fn(),
+	},
+	render: (args) => (
+		<Example>
+			<Example.Item title="renderTrigger">
+				<Select
+					name="animal"
+					position="bottom-start"
+					width="200px"
+					size="small"
+					placeholder="Select an animal"
+					onChange={args.handleChange}
+					renderTrigger={(attributes) => (
+						<Actionable attributes={attributes}>
+							<View direction="row" gap={1} align="center">
+								<Text color="neutral-faded">{attributes.children}</Text>
+							</View>
+						</Actionable>
+					)}
+				>
+					<Select.Option value="dog">Dog</Select.Option>
+					<Select.Option value="turtle">Turtle</Select.Option>
+				</Select>
+			</Example.Item>
+		</Example>
+	),
+	play: async ({ canvas, canvasElement, args }) => {
+		const [trigger] = canvas.getAllByRole("button");
+		const [hiddenInput] = Array.from(canvasElement.querySelectorAll('input[type="hidden"]'));
+
+		expect(hiddenInput).toHaveAttribute("name", "animal");
+		expect(hiddenInput).toHaveValue("");
+		expect(trigger).toHaveTextContent("Select an animal");
+		expect(trigger).toHaveAttribute("aria-expanded", "false");
+
+		await userEvent.click(trigger);
+
+		expect(trigger).toHaveAttribute("aria-expanded", "true");
+
+		const [_, option] = within(canvasElement.ownerDocument.body).getAllByRole("option");
+
+		await userEvent.click(option);
+
+		expect(hiddenInput).toHaveValue("turtle");
+		expect(trigger).toHaveTextContent("Turtle");
+		expect(trigger).toHaveAttribute("aria-expanded", "false");
+		expect(args.handleChange).toHaveBeenCalledTimes(1);
+		expect(args.handleChange).toHaveBeenCalledWith({
+			name: "animal",
+			value: "turtle",
+		});
+	},
+};
+
 export const error: StoryObj = {
 	name: "error",
 	render: () => (
```

---

### Incident Patch 7: `b9196293` (2026-08-15)
**Commit Message**: fix: export postcss config subpath with file extension (#654)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-postcss-config-subpath-extension.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+PostCSS config: Added `reshaped/config/postcss.js` and `reshaped/config/postcss.cjs` to the package exports, so importing the config with a file extension no longer fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`
```

**File**: `packages/reshaped/package.json` (modified, +9/-0)
```diff
@@ -53,6 +53,15 @@
 			"import": "./dist/config/postcss.js",
 			"default": "./dist/config/postcss.cjs"
 		},
+		"./config/postcss.js": {
+			"types": "./dist/config/postcss.d.ts",
+			"import": "./dist/config/postcss.js",
+			"default": "./dist/config/postcss.cjs"
+		},
+		"./config/postcss.cjs": {
+			"types": "./dist/config/postcss.d.cts",
+			"default": "./dist/config/postcss.cjs"
+		},
 		"./bundle": {
 			"types": "./dist/bundle.d.ts",
 			"import": "./dist/bundle.js",
```

---

### Incident Patch 8: `db93fa8d` (2026-07-04)
**Commit Message**: fix(Button): keep group border above highlighted buttons (#651)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-button-group-border-zindex.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Button.Group: Fixed the outline group border being masked by a highlighted button when the highlight color is fully opaque, by rendering the group border above highlighted buttons in the stacking context
```

**File**: `packages/reshaped/src/components/Button/Button.module.css` (modified, +4/-2)
```diff
@@ -384,7 +384,9 @@
 			content: "";
 			position: absolute;
 			pointer-events: none;
-			z-index: var(--rs-z-index-relative);
+
+			/* Keep the group border above highlighted buttons so a plain highlight color doesn't mask it */
+			z-index: calc(var(--rs-z-index-relative) + 1);
 			inset: 0;
 			border: 1px solid var(--rs-color-border-neutral);
 			border-radius: 6px;
@@ -396,7 +398,7 @@
 			inset: 1px;
 			pointer-events: none;
 			border-radius: inherit;
-			z-index: var(--rs-z-index-relative);
+			z-index: calc(var(--rs-z-index-relative) + 1);
 		}
 	}
 }
```

**File**: `packages/reshaped/src/components/Button/tests/Button.stories.tsx` (modified, +32/-0)
```diff
@@ -756,6 +756,38 @@ export const group: StoryObj = {
 				</View>
 			</Example.Item>
 
+			<Example.Item title="variant: outline, highlighted">
+				<View gap={2} align="start">
+					{(["neutral", "primary", "critical", "positive"] as const).map((color) => (
+						<Button.Group key={color}>
+							<Button color={color} variant="outline">
+								One
+							</Button>
+							<Button color={color} variant="outline" highlighted>
+								Two
+							</Button>
+							<Button color={color} variant="outline">
+								Three
+							</Button>
+						</Button.Group>
+					))}
+					{/* Plain (opaque) highlight color should not mask the group border – see #649 */}
+					<Button.Group
+						attributes={{
+							style: {
+								["--rs-color-background-neutral-highlighted-faded" as string]: "#d4d4d4",
+							},
+						}}
+					>
+						<Button variant="outline">One</Button>
+						<Button variant="outline" highlighted>
+							Two
+						</Button>
+						<Button variant="outline">Three</Button>
+					</Button.Group>
+				</View>
+			</Example.Item>
+
 			<Example.Item title="variant: ghost">
 				<View gap={2} align="start">
 					{(["neutral", "primary", "critical", "positive"] as const).map((color) => (
```

---

### Incident Patch 9: `8acb35bd` (2026-07-01)
**Commit Message**: fix(theming): prevent reference errors on CJS require call (#645)

**File**: `.changeset/orange-bugs-fold.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/theming": patch
+---
+
+Fixed cli/run undefined CJS require call in an ES module context.
```

**File**: `packages/theming/src/cli/run.ts` (modified, +2/-0)
```diff
@@ -1,12 +1,14 @@
 import fs from "node:fs";
 import path from "node:path";
 import process from "node:process";
+import { createRequire } from "node:module";
 import chalk from "chalk";
 import { Command } from "commander";
 
 import defaultConfig from "./reshaped.config";
 import { addTheme, addThemeFragment } from "./index";
 
+const require = createRequire(import.meta.url);
 const program = new Command();
 
 const importJSConfig = (configPath: string) => {
```

---

### Incident Patch 10: `4aaa4911` (2026-06-22)
**Commit Message**: fix(scroll): reference-count locks so stacked locks release correctly (#640)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-lockscroll-refcount.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+lockScroll: Fixed stacked/nested scroll locks releasing the scroll prematurely by reference-counting locks per container
```

**File**: `packages/utilities/src/scroll/lock.ts` (modified, +20/-11)
```diff
@@ -3,33 +3,42 @@ import { isIOS } from "@/platform";
 import lockSafariScroll from "./lockSafari";
 import lockStandardScroll from "./lockStandard";
 
+const locks = new WeakMap<HTMLElement, { count: number; reset: () => void }>();
+
 export const lockScroll = (args?: {
 	containerEl?: HTMLElement | null;
 	originEl?: HTMLElement | null;
 	callback?: () => void;
 }) => {
 	const isIOSLock = isIOS();
-	let reset = () => {};
 
 	const container =
 		args?.containerEl ??
 		(args?.originEl && findClosestScrollableContainer({ el: args.originEl })) ??
 		document.documentElement;
 	const lockedDocumentScroll = container === document.documentElement;
 
-	// Already locked so no need to lock again and trigger the callback
-	if (container.style.overflow === "hidden") return;
-
-	if (isIOSLock && lockedDocumentScroll) {
-		reset = lockSafariScroll();
-	} else {
-		reset = lockStandardScroll({ container });
+	let lock = locks.get(container);
+	if (!lock) {
+		const reset =
+			isIOSLock && lockedDocumentScroll ? lockSafariScroll() : lockStandardScroll({ container });
+		lock = { count: 0, reset };
+		locks.set(container, lock);
 	}
 
+	lock.count++;
 	args?.callback?.();
 
-	return (args?: { callback?: () => void }) => {
-		reset();
-		args?.callback?.();
+	let released = false;
+	return (unlockArgs?: { callback?: () => void }) => {
+		if (released) return;
+		released = true;
+
+		if (--lock.count <= 0) {
+			lock.reset();
+			locks.delete(container);
+		}
+
+		unlockArgs?.callback?.();
 	};
 };
```

**File**: `packages/utilities/src/scroll/tests/lock.test.ts` (modified, +20/-2)
```diff
@@ -124,14 +124,30 @@ describe("scroll/lockScroll", () => {
 		expect(scrollableContainer.style.overflow).toBe("auto");
 	});
 
-	test("unlocks after multiple locks", () => {
+	test("keeps scroll locked until every stacked lock is released", () => {
 		const unlock1 = lockScroll({});
 		const unlock2 = lockScroll({});
 
 		expect(document.documentElement.style.overflow).toBe("hidden");
 
+		// The first release must not unlock while a second lock is still held
 		unlock1?.();
+		expect(document.documentElement.style.overflow).toBe("hidden");
+
+		// Only the last release actually unlocks the container
+		unlock2?.();
 		expect(document.documentElement.style.overflow).toBe("");
+	});
+
+	test("ignores repeated calls to the same unlock", () => {
+		const unlock1 = lockScroll({});
+		const unlock2 = lockScroll({});
+
+		// Calling the first unlock twice must not decrement the count for unlock2
+		unlock1?.();
+		unlock1?.();
+
+		expect(document.documentElement.style.overflow).toBe("hidden");
 
 		unlock2?.();
 		expect(document.documentElement.style.overflow).toBe("");
@@ -171,9 +187,11 @@ describe("scroll/lockScroll", () => {
 	test("calls lock callback immediately", () => {
 		const lockCb = vi.fn();
 
-		lockScroll({ callback: lockCb });
+		const unlock = lockScroll({ callback: lockCb });
 
 		expect(lockCb).toHaveBeenCalledTimes(1);
+
+		unlock?.();
 	});
 
 	test("calls unlock callback when unlocking", () => {
```

---

### Incident Patch 11: `193948ec` (2026-06-22)
**Commit Message**: fix(TrapFocus): trap focus when content is added to an empty container (#638)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-trapfocus-observer-leak.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+TrapFocus: Trapping a container with no focusable content now defers instead of bailing — once focusable content is added (e.g. async-loaded dialog content) the focus is trapped automatically, as long as no other trap was triggered in the meantime. Also fixed the observer leaking in this case
```

**File**: `packages/utilities/src/a11y/TrapFocus.ts` (modified, +84/-47)
```diff
@@ -17,6 +17,12 @@ type TrapOptions = {
 class TrapFocus {
 	static chain = new Chain<TrapFocus>();
 
+	// Monotonic counter bumped on every trap() call. Used by the deferred
+	// observer to tell whether a newer trap was triggered after this one.
+	static #globalTrapCounter = 0;
+
+	#trapCounter = 0;
+
 	#chainId?: number;
 
 	#root: HTMLElement | null = null;
@@ -114,59 +120,35 @@ class TrapFocus {
 		return tailItem && tailItem.data.#root === this.#root;
 	};
 
-	/**
-	 * Trap the focus, add observer and keyboard event listeners
-	 * and create a chain item
-	 */
-	trap = (root: HTMLElement, options: TrapOptions = {}) => {
-		const { mode = "dialog", includeTrigger, initialFocusEl } = options;
-
-		this.#root = root;
-		this.#screenReaderTrap = new TrapScreenReader(root);
-
-		const trigger = getActiveElement(this.#root);
-		const focusable = getFocusableElements(this.#root, {
-			additionalElement: includeTrigger ? trigger : undefined,
+	#getFocusable = () => {
+		if (!this.#root) return [];
+		return getFocusableElements(this.#root, {
+			additionalElement: this.#options.includeTrigger ? this.#trigger : undefined,
 		});
-		const pseudoFocus = mode === "selection-menu";
-
-		this.#options = { ...options, pseudoFocus };
-		this.#trigger = trigger;
-
-		this.#mutationObserver = new MutationObserver(() => {
-			if (!this.#root) return;
-			if (!this.#isLast()) return;
-
-			const currentActiveElement = getActiveElement(this.#root);
-
-			// Focus stayed inside the wrapper, no need to refocus
-			if (this.#root.contains(currentActiveElement)) return;
-
-			const focusable = getFocusableElements(this.#root, {
-				additionalElement: includeTrigger ? trigger : undefined,
-			});
+	};
 
-			if (!focusable.length) return;
-			focusElement(focusable[0], { pseudoFocus });
-		});
+	/**
+	 * Establish the trap once there is something focusable inside.
+	 * Stays a no-op while the container is empty, so an empty container remains
+	 * deferred until its observer detects focusable content being added.
+	 */
+	#activate = () => {
+		if (!this.#root || this.trapped) return;
 
-		this.#removeListeners();
-		this.#mutationObserver.observe(this.#root, { childList: true, subtree: true });
+		const { mode, initialFocusEl, pseudoFocus } = this.#options;
+		const focusable = this.#getFocusable();
 
-		// Don't trap in case there is nothing to focus inside
+		// Nothing to focus yet — stay deferred.
 		if (!focusable.length && !initialFocusEl) return;
 
 		this.#addListeners();
-		if (mode === "dialog") this.#screenReaderTrap.trap();
-
-		const currentActiveElement = getActiveElement(this.#root);
-		const isLastInChain = this.#isLast();
+		if (mode === "dialog") this.#screenReaderTrap?.trap();
 
 		// Don't add back to the chain if we're traversing back
-		if (!isLastInChain) {
+		if (!this.#isLast()) {
 			this.#chainId = TrapFocus.chain.add(this);
 
-			const focusInside = this.#root.contains(currentActiveElement);
+			const focusInside = this.#root.contains(getActiveElement(this.#root));
 
 			if (initialFocusEl) {
 				focusElement(initialFocusEl, { pseudoFocus });
@@ -179,20 +161,73 @@ class TrapFocus {
 		this.trapped = true;
 	};
 
+	/**
+	 * Trap the focus, add observer and keyboard event listeners
+	 * and create a chain item
+	 */
+	trap = (root: HTMLElement, options: TrapOptions = {}) => {
+		const { mode = "dialog" } = options;
+		const pseudoFocus = mode === "selection-menu";
+
+		this.#root = root;
+		this.#screenReaderTrap = new TrapScreenReader(root);
+		this.#trigger = getActiveElement(root);
+		this.#options = { ...options, mode, pseudoFocus };
+		this.#trapCounter = ++TrapFocus.#globalTrapCounter;
+
+		this.#removeListeners();
+		this.#mutationObserver?.disconnect();
+
+		this.#mutationObserver = new MutationObserver(() => {
+			if (!this.#root) return;
+
+			// Still deferred: trap once focusable content is added (e.g. async-loaded
+			// dialog content), as long as no newer trap was triggered in the meantime.
+			if (!this.trapped) {
+				if (this.#trapCounter !== TrapFocus.#globalTrapCounter) {
+					this.#mutationObserver?.disconnect();
+					return;
+				}
+
+				this.#activate();
+				return;
+			}
+
+			// Active trap: keep the focus inside the region if it escaped.
+			if (!this.#isLast()) return;
+			if (this.#root.contains(getActiveElement(this.#root))) return;
+
+			const focusable = this.#getFocusable();
+			if (!focusable.length) return;
+			focusElement(focusable[0], { pseudoFocus });
+		});
+
+		this.#mutationObserver.observe(root, { childList: true, subtree: true });
+
+		this.#activate();
+	};
+
 	/**
 	 * Disabled the trap focus for the element,
 	 * cleanup all observers/handlers and trap for the previous element in the chain
 	 */
 	release = (releaseOptions: ReleaseOptions = {}) => {
 		const { withoutFocusReturn } = releaseOptions;
 
-		if (!this.trapped || !this.#chainId || !this.#root) return;
+		if (!this.trapped || !this.#chainId || !this.#root) {
+			// A deferred (never-trapped) 
```

**File**: `packages/utilities/src/a11y/tests/TrapFocus.test.ts` (modified, +69/-0)
```diff
@@ -59,6 +59,75 @@ describe("a11y/TrapFocus", () => {
 			expect(trap.trapped).toBeUndefined();
 		});
 
+		test("traps focus once focusable content is added to an empty container", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const trap = new TrapFocus();
+			trap.trap(container);
+			expect(trap.trapped).toBeUndefined();
+
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			// Wait for the MutationObserver callback to run
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			expect(trap.trapped).toBe(true);
+			expect(document.activeElement?.id).toBe("late");
+
+			trap.release();
+		});
+
+		test("does not trap added content if another trap was triggered after", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const deferredTrap = new TrapFocus();
+			deferredTrap.trap(container);
+			expect(deferredTrap.trapped).toBeUndefined();
+
+			// A newer trap is triggered before the empty container gets content
+			const other = document.createElement("div");
+			other.innerHTML = `<button id="other-btn">Other</button>`;
+			document.body.appendChild(other);
+			const otherTrap = new TrapFocus();
+			otherTrap.trap(other);
+
+			// Now the originally-empty container receives focusable content
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			// The deferred trap must stay inactive and must not steal focus
+			expect(deferredTrap.trapped).toBeUndefined();
+			expect(document.activeElement?.id).not.toBe("late");
+
+			otherTrap.release();
+			document.body.removeChild(other);
+		});
+
+		test("releasing an empty container stops it from trapping later", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const trap = new TrapFocus();
+			trap.trap(container);
+			trap.release();
+
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			expect(trap.trapped).toBeUndefined();
+			expect(document.activeElement?.id).not.toBe("late");
+		});
+
 		test("focuses initialFocusEl when provided", () => {
 			container.innerHTML = `
 				<button id="btn1">Button 1</button>
```

---

### Incident Patch 12: `64b1574c` (2026-06-20)
**Commit Message**: fix(scroll): scope StyleCache.reset to the locked element (#641)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-stylecache-scoped-reset.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+StyleCache: `reset()` used to restore and clear the entire cache, which let one scroll lock wipe the saved styles of another still-active lock. It now takes a required element and restores only that one. `set()` is also a no-op when the element is already cached, so locking an already-locked element keeps its original styles intact.
```

**File**: `packages/utilities/src/css/StyleCache.ts` (modified, +11/-9)
```diff
@@ -1,26 +1,28 @@
 type Styles = Record<string, string>;
 
 class StyleCache {
-	cache: Map<HTMLElement, Record<string, string>> = new Map();
+	cache: Map<HTMLElement, Styles> = new Map();
 
 	set = (el: HTMLElement, styles: Styles) => {
-		const originalStyles: Styles = {};
-		const cachedStyles = this.cache.get(el);
+		// Already cached (locked) — keep the originals captured the first time and
+		// don't reapply, so locking an element that's already locked is a no-op.
+		if (this.cache.has(el)) return;
 
+		const originalStyles: Styles = {};
 		Object.keys(styles).forEach((key) => {
 			originalStyles[key] = el.style.getPropertyValue(key);
 		});
 
-		this.cache.set(el, { ...originalStyles, ...cachedStyles });
+		this.cache.set(el, originalStyles);
 		Object.assign(el.style, styles);
 	};
 
-	reset = () => {
-		for (const [el, styles] of this.cache.entries()) {
-			Object.assign(el.style, styles);
-		}
+	reset = (el: HTMLElement) => {
+		const styles = this.cache.get(el);
+		if (!styles) return;
 
-		this.cache.clear();
+		Object.assign(el.style, styles);
+		this.cache.delete(el);
 	};
 }
 
```

**File**: `packages/utilities/src/css/tests/StyleCache.test.ts` (modified, +27/-7)
```diff
@@ -19,43 +19,63 @@ describe("css/StyleCache", () => {
 		expect(el.style.color).toBe("blue");
 		expect(el.style.overflow).toBe("hidden");
 
-		styleCache.reset();
+		styleCache.reset(el);
 
 		expect(el.style.color).toBe("red");
 		expect(el.style.overflow).toBe("visible");
 	});
 
-	test("preserves original styles across multiple set calls", () => {
+	test("ignores repeated set calls on an already-cached element", () => {
 		const el = document.createElement("div");
 		el.style.color = "red";
 
 		styleCache.set(el, { color: "blue" });
+		// The element is already cached, so this is a no-op (style stays "blue")
 		styleCache.set(el, { color: "green" });
-		styleCache.reset();
+
+		expect(el.style.color).toBe("blue");
+
+		styleCache.reset(el);
 
 		expect(el.style.color).toBe("red");
 	});
 
-	test("handles multiple elements", () => {
+	test("reset only affects the given element", () => {
 		const el1 = document.createElement("div");
 		const el2 = document.createElement("div");
 		el1.style.color = "red";
 		el2.style.color = "blue";
 
 		styleCache.set(el1, { color: "green" });
 		styleCache.set(el2, { color: "yellow" });
-		styleCache.reset();
 
+		styleCache.reset(el1);
+
+		// el1 is restored, el2 stays locked
 		expect(el1.style.color).toBe("red");
+		expect(el2.style.color).toBe("yellow");
+		expect(styleCache.cache.has(el2)).toBe(true);
+
+		styleCache.reset(el2);
+
 		expect(el2.style.color).toBe("blue");
 	});
 
-	test("clears cache after reset", () => {
+	test("reset is a no-op for an element that was never cached", () => {
+		const el = document.createElement("div");
+		el.style.color = "red";
+
+		styleCache.reset(el);
+
+		expect(el.style.color).toBe("red");
+	});
+
+	test("removes the element from the cache after reset", () => {
 		const el = document.createElement("div");
 		el.style.color = "red";
 
 		styleCache.set(el, { color: "blue" });
-		styleCache.reset();
+		styleCache.reset(el);
 
 		expect(styleCache.cache.size).toBe(0);
 	});
```

**File**: `packages/utilities/src/scroll/lockSafari.ts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ const lockSafariScroll = () => {
 	});
 
 	return () => {
-		styleCache.reset();
+		styleCache.reset(document.body);
 		window.scrollTo({ top: scrollY, left: scrollX, behavior: "instant" });
 	};
 };
```

**File**: `packages/utilities/src/scroll/lockStandard.ts` (modified, +6/-6)
```diff
@@ -6,19 +6,19 @@ const styleCache = new StyleCache();
 const lockStandardScroll = (args: { container: HTMLElement }) => {
 	const { container } = args;
 	const isOverflowing = container.scrollHeight > container.clientHeight;
-
-	styleCache.set(container, { overflow: "hidden" });
+	const styles: Record<string, string> = { overflow: "hidden" };
 
 	if (isOverflowing) {
 		if (CSS.supports("scrollbar-gutter", "stable")) {
-			styleCache.set(container, { scrollbarGutter: "stable" });
+			styles.scrollbarGutter = "stable";
 		} else {
-			const scrollBarWidth = getScrollbarWidth();
-			styleCache.set(container, { paddingRight: `${scrollBarWidth}px` });
+			styles.paddingRight = `${getScrollbarWidth()}px`;
 		}
 	}
 
-	return () => styleCache.reset();
+	styleCache.set(container, styles);
+
+	return () => styleCache.reset(container);
 };
 
 export default lockStandardScroll;
```

**File**: `packages/utilities/src/scroll/tests/lock.test.ts` (modified, +31/-0)
```diff
@@ -137,6 +137,37 @@ describe("scroll/lockScroll", () => {
 		expect(document.documentElement.style.overflow).toBe("");
 	});
 
+	test("unlocking one container does not affect another locked container", () => {
+		const a = document.createElement("div");
+		a.style.overflow = "auto";
+		a.style.height = "100px";
+		document.body.appendChild(a);
+
+		const b = document.createElement("div");
+		b.style.overflow = "scroll";
+		b.style.height = "100px";
+		document.body.appendChild(b);
+
+		const unlockA = lockScroll({ containerEl: a });
+		const unlockB = lockScroll({ containerEl: b });
+
+		expect(a.style.overflow).toBe("hidden");
+		expect(b.style.overflow).toBe("hidden");
+
+		unlockA?.();
+
+		// B shares the module-level StyleCache with A, but must stay locked
+		expect(a.style.overflow).toBe("auto");
+		expect(b.style.overflow).toBe("hidden");
+
+		unlockB?.();
+
+		expect(b.style.overflow).toBe("scroll");
+
+		document.body.removeChild(a);
+		document.body.removeChild(b);
+	});
+
 	test("calls lock callback immediately", () => {
 		const lockCb = vi.fn();
 
```

---

### Incident Patch 13: `0b671182` (2026-06-20)
**Commit Message**: fix(scroll): detect container overflow correctly when locking scroll (#639)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/fix-lockstandard-scrollbar.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+lockScroll: Fixed scrollbar-width compensation not being applied when locking a scrollable container, which caused a layout shift
```

**File**: `packages/utilities/src/scroll/lockStandard.ts` (modified, +1/-2)
```diff
@@ -5,8 +5,7 @@ const styleCache = new StyleCache();
 
 const lockStandardScroll = (args: { container: HTMLElement }) => {
 	const { container } = args;
-	const rect = container.getBoundingClientRect();
-	const isOverflowing = rect.left + rect.right < window.innerWidth;
+	const isOverflowing = container.scrollHeight > container.clientHeight;
 
 	styleCache.set(container, { overflow: "hidden" });
 
```

**File**: `packages/utilities/src/scroll/tests/lock.test.ts` (modified, +51/-0)
```diff
@@ -50,6 +50,57 @@ describe("scroll/lockScroll", () => {
 		expect(container.style.overflow).toBe("auto");
 	});
 
+	test("reserves space for the scrollbar on a vertically overflowing container", () => {
+		const container = document.createElement("div");
+		container.style.overflow = "auto";
+		container.style.height = "100px";
+		document.body.appendChild(container);
+
+		const content = document.createElement("div");
+		content.style.height = "500px";
+		container.appendChild(content);
+
+		// The container actually overflows vertically, so locking it removes the
+		// vertical scrollbar and must compensate for the horizontal space it took.
+		expect(container.scrollHeight).toBeGreaterThan(container.clientHeight);
+
+		const unlock = lockScroll({ containerEl: container });
+
+		// Chromium (the test browser) supports scrollbar-gutter, so the lock
+		// reserves the gutter rather than falling back to paddingRight.
+		expect(container.style.scrollbarGutter).toBe("stable");
+
+		unlock?.();
+
+		expect(container.style.scrollbarGutter).toBe("");
+
+		document.body.removeChild(container);
+	});
+
+	test("does not reserve space when the container does not overflow vertically", () => {
+		const container = document.createElement("div");
+		container.style.overflow = "auto";
+		container.style.height = "200px";
+		document.body.appendChild(container);
+
+		const content = document.createElement("div");
+		content.style.height = "50px";
+		container.appendChild(content);
+
+		// No vertical overflow -> no scrollbar to compensate for.
+		expect(container.scrollHeight).not.toBeGreaterThan(container.clientHeight);
+
+		const unlock = lockScroll({ containerEl: container });
+
+		expect(container.style.overflow).toBe("hidden");
+		expect(container.style.scrollbarGutter).toBe("");
+		expect(container.style.paddingRight).toBe("");
+
+		unlock?.();
+
+		document.body.removeChild(container);
+	});
+
 	test("finds scrollable container from origin element", () => {
 		const scrollableContainer = document.createElement("div");
 		scrollableContainer.style.overflow = "auto";
```

---

### Incident Patch 14: `84790ef9` (2026-06-20)
**Commit Message**: fix(Select): expose listbox/option selection state to assistive tech (#636)

**File**: `.changeset/fix-select-listbox-a11y.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Select: Fixed listbox accessibility by giving the custom dropdown a listbox role and exposing selection state with aria-selected and aria-multiselectable
```

**File**: `packages/reshaped/src/components/Select/SelectCustomControlled.tsx` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ const SelectCustomControlled: React.FC<T.CustomControlledProps> = (props) => {
 					attributes: {
 						...component.props.attributes,
 						ref: selected ? initialFocusRef : undefined,
+						"aria-selected": matchingValue,
 					},
 				});
 			}
```

---

### Incident Patch 15: `de3c4529` (2026-06-20)
**Commit Message**: fix(Carousel): don't steal focus when scrolling to an edge (#635)

**File**: `.changeset/fix-carousel-focus-theft.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Carousel: Fixed controls stealing focus to the opposite arrow when scrolling to an edge
```

**File**: `packages/reshaped/src/components/Carousel/Carousel.tsx` (modified, +2/-2)
```diff
@@ -169,7 +169,7 @@ const Carousel: React.FC<T.Props> = (props) => {
 					<CarouselControl
 						isRTL={isRTL}
 						type="back"
-						ref={prevControlElRef}
+						controlRef={prevControlElRef}
 						oppositeControlElRef={nextControlElRef}
 						scrollElRef={scrollElRef}
 						scrollPosition={scrollPosition}
@@ -179,7 +179,7 @@ const Carousel: React.FC<T.Props> = (props) => {
 					<CarouselControl
 						isRTL={isRTL}
 						type="forward"
-						ref={nextControlElRef}
+						controlRef={nextControlElRef}
 						oppositeControlElRef={prevControlElRef}
 						scrollElRef={scrollElRef}
 						scrollPosition={scrollPosition}
```

**File**: `packages/reshaped/src/components/Carousel/Carousel.types.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ export type Instance =
 
 export type ControlProps = {
 	type: "back" | "forward";
+	controlRef: React.RefObject<ActionableRef | null>;
 	oppositeControlElRef: React.RefObject<ActionableRef | null>;
 	scrollElRef: React.RefObject<HTMLElement | null>;
 	scrollPosition: number;
```

**File**: `packages/reshaped/src/components/Carousel/CarouselControl.tsx` (modified, +17/-8)
```diff
@@ -1,19 +1,26 @@
 "use client";
 
-import { forwardRef, useState } from "react";
+import { useState } from "react";
 import { classNames } from "@reshaped/utilities";
 
-import type { ActionableRef } from "@/components/Actionable";
 import Button from "@/components/Button";
 import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
 import IconChevronLeft from "@/icons/ChevronLeft";
 import IconChevronRight from "@/icons/ChevronRight";
 import * as T from "./Carousel.types";
 import s from "./Carousel.module.css";
 
-const CarouselControl = forwardRef<ActionableRef, T.ControlProps>((props, ref) => {
-	const { type, scrollElRef, oppositeControlElRef, scrollPosition, onClick, isRTL, mounted } =
-		props;
+const CarouselControl = (props: T.ControlProps) => {
+	const {
+		type,
+		controlRef,
+		scrollElRef,
+		oppositeControlElRef,
+		scrollPosition,
+		onClick,
+		isRTL,
+		mounted,
+	} = props;
 	const [visible, setVisible] = useState(false);
 	const [rendered, setRendered] = useState(false);
 	const isNext = type === "forward";
@@ -40,7 +47,9 @@ const CarouselControl = forwardRef<ActionableRef, T.ControlProps>((props, ref) =
 			setVisible(false);
 			timer = setTimeout(() => setRendered(false), 1500);
 
-			oppositeControlElRef.current?.focus();
+			if (controlRef.current && document.activeElement === controlRef.current) {
+				oppositeControlElRef.current?.focus();
+			}
 		} else {
 			setRendered(true);
 			setVisible(true);
@@ -61,11 +70,11 @@ const CarouselControl = forwardRef<ActionableRef, T.ControlProps>((props, ref) =
 				variant="outline"
 				raised
 				attributes={{ "aria-disabled": !visible, "aria-hidden": true }}
-				ref={ref}
+				ref={controlRef}
 			/>
 		</div>
 	);
-});
+};
 
 CarouselControl.displayName = "CarouselControl";
 
```

#### Recent Merged Pull Requests:
- **PR #670** (2026-09-12): Modal: velocity-aware release spring and rubber band for the swipe gesture (@blvdmitry)
- **PR #669** (2026-09-12): Modal: register the drag offset as a non-inherited property (@blvdmitry)
- **PR #668** (2026-09-12): ScrollArea: move the thumb with transform instead of inset (@blvdmitry)
- **PR #667** (2026-09-12): Overlay: animate backdrop opacity instead of background-color (@blvdmitry)
- **PR #666** (2026-09-07): Image: render the fallback when loading fails before hydration (@blvdmitry)
- **PR #665** (closed): DropdownMenu, ContextMenu: support size on the root component (@blvdmitry)
- **PR #664** (closed): fix(Flyout): close content on right click outside (@blvdmitry)
- **PR #663** (closed): feat(Link): add fullWidth support (@blvdmitry)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
