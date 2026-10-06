# Forensic Learning Record (Deep Inspection): htmlstreamofficial/preline

> **Canonical Artifact**: `07_PROJECT_LEARNING/htmlstreamofficial-preline-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/htmlstreamofficial/preline](https://github.com/htmlstreamofficial/preline))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:31.378Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `htmlstreamofficial/preline`
- **Description**: Preline UI is an open-source set of prebuilt UI components based on the utility-first Tailwind CSS framework.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6472 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/plugins/accordion/core.ts`
```
/*
 * HSAccordion
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import {
	getClassProperty,
	stringToBoolean,
	dispatch,
	afterTransition,
} from '../../utils';

import {
	IAccordionOptions,
	IAccordion,
	IAccordionTreeView,
	IAccordionTreeViewStaticOptions,
} from '../accordion/interfaces';

import HSBasePlugin from '../base-plugin';
import { ICollectionItem } from '../../interfaces';

class HSAccordion
	extends HSBasePlugin<IAccordionOptions>
	implements IAccordion
{
	private toggle: HTMLElement | null;
	public content: HTMLElement | null;
	private group: HTMLElement | null;
	private isAlwaysOpened: boolean;
	private keepOneOpen: boolean;
	private isToggleStopPropagated: boolean;

	private onToggleClickListener: (evt: Event) => void;

	static selectable: IAccordionTreeView[];

	constructor(el: HTMLElement, options?: IAccordionOptions, events?: {}) {
		super(el, options, events);

		this.toggle = this.el.querySelector('.hs-accordion-toggle') || null;
		this.content = this.el.querySelector('.hs-accordion-content') || null;
		this.group = this.el.closest('.hs-accordion-group') || null;
		this.isAlwaysOpened = false;
		this.keepOneOpen = false;
		this.isToggleStopPropagated = false;
		if (!window.$hsAccordionCollection) window.$hsAccordionCollection = [];
		this.update();

		this.isToggleStopPropagated = stringToBoolean(
			getClassProperty(this.toggle, '--stop-propagation', 'false') || 'false',
		);
		this.keepOneOpen = this.group
			? stringToBoolean(
					getClassProperty(this.group, '--keep-one-open', 'false') || 'false',
				)
			: false;

		if (this.toggle && this.content) this.init();
	}

	private init() {
		this.createCollection(window.$hsAccordionCollection, this);

		this.onToggleClickListener = (evt: Event) => this.toggleClick(evt);

		this.toggle.addEventListener('click', this.onToggleClickListener);
	}

	// Public methods
	public toggleClick(evt: Event) {
		if (this.el.classList.contains('active') && this.keepOneOpen) return false;

		if (this.isToggleStopPropagated) evt.stopPropagation();

		if (this.el.classList.contains('active')) {
			this.hide();
		} else {
			this.show();
		}
	}

	public show() {
		if (
			this.group &&
			!this.isAlwaysOpened &&
			this.group.querySelector(':scope > .hs-accordion.active') &&
			this.group.querySelector(':scope > .hs-accordion.active') !== this.el
		) {
			const currentlyOpened = window.$hsAccordionCollection.find(
				(el) =>
					el.element.el ===
					this.group.querySelector(':scope > .hs-accordion.active'),
			);

			currentlyOpened.element.hide();
		}

		if (this.el.classList.contains('active')) return false;

		this.el.classList.add('active');
		if (this?.toggle?.ariaExpanded) this.toggle.ariaExpanded = 'true';

		this.fireEvent('beforeOpen', this.el);
		dispatch('beforeOpen.hs.accordion', this.el, this.el);

		this.content.style.display = 'block';
		this.content.style.height = '0';
		setTimeout(() => {
			this.content.style.height = `${this.content.scrollHeight}px`;

			afterTransition(this.content, () => {
				this.content.style.display = 'block';
				this.content.style.height = '';

				this.fireEvent('open', this.el);
				dispatch('open.hs.accordion', this.el, this.el);
			});
		});
	}

	public hide() {
		if (!this.el.classList.contains('active')) return false;

		this.el.classList.remove('active');
		if (this?.toggle?.ariaExpanded) this.toggle.ariaExpanded = 'false';

		this.fireEvent('beforeClose', this.el);
		dispatch('beforeClose.hs.accordion', this.el, this.el);

		this.content.style.height = `${this.content.scrollHeight}px`;
		setTimeout(() => {
			this.content.style.height = '0';
		});

		afterTransition(this.content, () => {
			this.content.style.display = 'none';
			this.content.style.height = '';

			this.fireEvent('close', this.el);
			dispatch('close.hs.accordion', this.el, this.el);
		});
	}

	public update() {
		this.group = this.el.closest('.hs-accordion-group') || null;

		if (!this.group) return false;

		this.isAlwaysOpened =
			this.group.hasAttribute('data-hs-accordion-always-open') || false;

		if (!window.$hsAccordionCollection) return false;

		window.$hsAccordionCollection.map((el) => {
			if (el.id === this.el.id) {
				el.element.group = this.group;
				el.element.isAlwaysOpened = this.isAlwaysOpened;
			}

			return el;
		});
	}

	public destroy() {
		if (HSAccordion?.selectable?.length) {
			HSAccordion.selectable.forEach((item) => {
				item.listeners.forEach(({ el, listener }) => {
					el.removeEventListener('click', listener);
				});
			});
		}

		if (this.onToggleClickListener) {
			this.toggle.removeEventListener('click', this.onToggleClickListener);
		}

		this.toggle = null;
		this.content = null;
		this.group = null;

		this.onToggleClickListener = null;

		window.$hsAccordionCollection = window.$hsAccordionCollection.filter(
			({ element }) => element.el !== this.el,
		);
	}

	// Static methods
	private static findInCollection(
		target: HSAccordion | HTMLElement | string,
	): ICollectionItem<HSAccordion> | null {
		return (
			window.$hsAccordionCollection.find((el) => {
				if (target instanceof HSAccordion) return el.element.el === target.el;
				else if (typeof target === 'string')
					return el.element.el === document.querySelector(target);
				else return el.element.el === target;
			}) || null
		);
	}

	static autoInit() {
		if (!window.$hsAccordionCollection) window.$hsAccordionCollection = [];

		if (window.$hsAccordionCollection) {
			window.$hsAccordionCollection = window.$hsAccordionCollection.filter(
				({ element }) => document.contains(element.el),
			);
		}

		document
			.querySelectorAll('.hs-accordion:not(.--prevent-on-load-init)')
			.forEach((el: HTMLElement) => {
				if (
					!window.$hsAccordionCollection.find(
						(elC) => (elC?.element?.el as HTMLElement) === el,
					)
				)
					new HSAccordion(el);
			});
	}

	static getInstance(target: HTMLElement | string, isInstance?: boolean) {
		const elInCollection = window.$hsAccordionCollection.find(
			(el) =>
				el.element.el ===
				(typeof target === 'string' ? document.querySelector(target) : target),
		);

		return elInCollection
			? isInstance
				? elInCollection
				: elInCollection.element.el
			: null;
	}

	static show(target: HSAccordion | HTMLElement | string) {
		const instance = HSAccordion.findInCollection(target);

		if (instance && instance.element.content.style.display !== 'block')
			instance.element.show();
	}

	static hide(target: HSAccordion | HTMLElement | string) {
		const instance = HSAccordion.findInCollection(target);
		const style = instance
			? window.getComputedStyle(instance.element.content)
			: null;

		if (instance && style.display !== 'none') instance.element.hide();
	}

	static onSelectableClick = (
		evt: Event,
		item: IAccordionTreeView,
		el: HTMLElement,
	) => {
		evt.stopPropagation();

		HSAccordion.toggleSelected(item, el);
	};

	static treeView() {
		if (!document.querySelectorAll('.hs-accordion-treeview-root').length)
			return false;

		this.selectable = [];

		document
			.querySelectorAll('.hs-accordion-treeview-root')
			.forEach((el: HTMLElement) => {
				const data = el?.getAttribute('data-hs-accordion-options');
				const options: IAccordionTreeViewStaticOptions = data
					? JSON.parse(data)
					: {};

				this.selectable.push({
					el,
					options: { ...options },
					listeners: [],
				});
			});

		if (this.selectable.length)
			this.selectable.forEach((item) => {
				const { el } = item;

				el.querySelectorAll('.hs-accordion-selectable').forEach(
					(_el: HTMLElement) => {
						const listener = (evt: Event) =>
							this.onSelectableClick(evt, item, _el);

						_el.addEventListener('click', listener);

						item.listeners.push({ el: _el, listener });
					},
				);
			});
	}

	static toggleSelected(root: IAccordionTreeView, item: HTMLElement) {
		if (item.classList.contains('selected')) item.classList.remove('selected');
		else {
			root.el
				.querySelectorAll('.hs-accordion-selectable')
				.forEach((el: HTMLElement) => el.classList.remove('selected'));
			item.classList.add('selected');
		}
	}

	// Backward compatibility
	static on(
		evt: string,
		target: HSAccordion | HTMLElement | string,
		cb: Function,
	) {
		const instance = HSAccordion.findInCollection(target);

		if (instance) instance.element.events[evt] = cb;
	}
}

export default HSAccordion;

```

### Core Architecture Module: `src/plugins/carousel/core.ts`
```
/*
 * HSCarousel
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { classToClassList, debounce, htmlToElement } from '../../utils';

import { ICarousel, ICarouselOptions } from './interfaces';
import { TCarouselOptionsSlidesQty } from './types';

import HSBasePlugin from '../base-plugin';
import { BREAKPOINTS } from '../../constants';

class HSCarousel extends HSBasePlugin<ICarouselOptions> implements ICarousel {
	private currentIndex: number;
	private readonly loadingClasses: string | string[];
	private readonly dotsItemClasses: string;
	private readonly isAutoHeight: boolean;
	private readonly isAutoPlay: boolean;
	private readonly isCentered: boolean;
	private readonly isDraggable: boolean;
	private readonly dragThreshold: number;
	private readonly isInfiniteLoop: boolean;
	private readonly isRTL: boolean;
	private readonly isSnap: boolean;
	private readonly hasSnapSpacers: boolean;
	private readonly slidesQty: TCarouselOptionsSlidesQty | number;
	private readonly speed: number;
	private readonly updateDelay: number;

	private readonly loadingClassesRemove: string | string[];
	private readonly loadingClassesAdd: string | string[];
	private readonly afterLoadingClassesAdd: string | string[];

	private readonly container: HTMLElement | null;
	private readonly inner: HTMLElement | null;
	private readonly slides: NodeListOf<HTMLElement> | undefined[];
	private readonly prev: HTMLElement | null;
	private readonly next: HTMLElement | null;
	private readonly dots: HTMLElement | null;
	private dotsItems: NodeListOf<HTMLElement> | undefined[] | null;
	private readonly info: HTMLElement | null;
	private readonly infoTotal: HTMLElement | null;
	private readonly infoCurrent: HTMLElement | null;

	private sliderWidth: number;
	private timer: any;

	// Drag events' help variables
	private isScrolling: ReturnType<typeof setTimeout>;
	private isDragging: boolean;
	private dragStartX: number | null;
	private dragStartTime: number | null;
	private initialTranslateX: number | null;

	// Touch events' help variables
	private readonly touchX: {
		start: number;
		end: number;
	};
	private readonly touchY: {
		start: number;
		end: number;
	};

	// Resize events' help variables
	private resizeContainer: HTMLElement;
	public resizeContainerWidth: number;

	// Listeners
	private onPrevClickListener: () => void;
	private onNextClickListener: () => void;
	private onContainerScrollListener: () => void;
	private onElementTouchStartListener: (evt: TouchEvent) => void;
	private onElementTouchEndListener: (evt: TouchEvent) => void;
	private onInnerMouseDownListener: (evt: MouseEvent | TouchEvent) => void;
	private onInnerTouchStartListener: (evt: MouseEvent | TouchEvent) => void;
	private onDocumentMouseMoveListener: (evt: MouseEvent | TouchEvent) => void;
	private onDocumentTouchMoveListener: (evt: MouseEvent | TouchEvent) => void;
	private onDocumentMouseUpListener: () => void;
	private onDocumentTouchEndListener: () => void;
	private onDotClickListener: () => void;

	constructor(el: HTMLElement, options?: ICarouselOptions) {
		super(el, options);

		const data = el.getAttribute('data-hs-carousel');
		const dataOptions: ICarouselOptions = data ? JSON.parse(data) : {};
		const concatOptions = {
			...dataOptions,
			...options,
		};

		this.currentIndex = concatOptions.currentIndex || 0;
		this.loadingClasses = concatOptions.loadingClasses
			? `${concatOptions.loadingClasses}`.split(',')
			: null;
		this.dotsItemClasses = concatOptions.dotsItemClasses
			? concatOptions.dotsItemClasses
			: null;
		this.isAutoHeight =
			typeof concatOptions.isAutoHeight !== 'undefined'
				? concatOptions.isAutoHeight
				: false;
		this.isAutoPlay =
			typeof concatOptions.isAutoPlay !== 'undefined'
				? concatOptions.isAutoPlay
				: false;
		this.isCentered =
			typeof concatOptions.isCentered !== 'undefined'
				? concatOptions.isCentered
				: false;
		this.isDraggable =
			typeof concatOptions.isDraggable !== 'undefined'
				? concatOptions.isDraggable
				: false;
		this.dragThreshold =
			typeof concatOptions.dragThreshold === 'number'
				? concatOptions.dragThreshold
				: 0.2;
		this.isInfiniteLoop =
			typeof concatOptions.isInfiniteLoop !== 'undefined'
				? concatOptions.isInfiniteLoop
				: false;
		this.isRTL =
			typeof concatOptions.isRTL !== 'undefined' ? concatOptions.isRTL : false;
		this.isSnap =
			typeof concatOptions.isSnap !== 'undefined'
				? concatOptions.isSnap
				: false;
		this.hasSnapSpacers =
			typeof concatOptions.hasSnapSpacers !== 'undefined'
				? concatOptions.hasSnapSpacers
				: true;
		this.speed = concatOptions.speed || 4000;
		this.updateDelay = concatOptions.updateDelay || 0;
		this.slidesQty = concatOptions.slidesQty || 1;

		this.loadingClassesRemove = this.loadingClasses?.[0]
			? this.loadingClasses[0].split(' ')
			: 'opacity-0';
		this.loadingClassesAdd = this.loadingClasses?.[1]
			? this.loadingClasses[1].split(' ')
			: '';
		this.afterLoadingClassesAdd = this.loadingClasses?.[2]
			? this.loadingClasses[2].split(' ')
			: '';

		this.container = this.el.querySelector('.hs-carousel') || null;
		this.inner = this.el.querySelector('.hs-carousel-body') || null;
		this.slides = this.el.querySelectorAll('.hs-carousel-slide') || [];
		this.prev = this.el.querySelector('.hs-carousel-prev') || null;
		this.next = this.el.querySelector('.hs-carousel-next') || null;
		this.dots = this.el.querySelector('.hs-carousel-pagination') || null;
		this.info = this.el.querySelector('.hs-carousel-info') || null;
		this.infoTotal =
			this?.info?.querySelector('.hs-carousel-info-total') || null;
		this.infoCurrent =
			this?.info?.querySelector('.hs-carousel-info-current') || null;

		this.sliderWidth = this.el.getBoundingClientRect().width;

		// Drag events' help variables
		this.isDragging = false;
		this.dragStartX = null;
		this.dragStartTime = null;
		this.initialTranslateX = null;

		// Touch events' help variables
		this.touchX = {
			start: 0,
			end: 0,
		};
		this.touchY = {
			start: 0,
			end: 0,
		};

		// Resize events' help variables
		this.resizeContainer = document.querySelector('body');
		this.resizeContainerWidth = 0;

		this.init();
	}

	private setIsSnap() {
		const containerRect = this.container.getBoundingClientRect();
		const containerCenter = containerRect.left + containerRect.width / 2;

		let closestElement: HTMLElement | null = null;
		let closestElementIndex: number | null = null;
		let closestDistance = Infinity;

		Array.from(this.inner.children).forEach((child: HTMLElement) => {
			const childRect = child.getBoundingClientRect();
			const innerContainerRect = this.inner.getBoundingClientRect();
			const childCenter =
				childRect.left + childRect.width / 2 - innerContainerRect.left;
			const distance = Math.abs(
				containerCenter - (innerContainerRect.left + childCenter),
			);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestElement = child;
			}
		});

		if (closestElement) {
			closestElementIndex = Array.from(this.slides).findIndex(
				(el) => el === closestElement,
			);
		}

		this.setIndex(closestElementIndex);

		if (this.dots) this.setCurrentDot();
	}

	private prevClick() {
		this.goToPrev();
		if (this.isAutoPlay) {
			this.resetTimer();
			this.setTimer();
		}
	}

	private nextClick() {
		this.goToNext();
		if (this.isAutoPlay) {
			this.resetTimer();
			this.setTimer();
		}
	}

	private containerScroll() {
		clearTimeout(this.isScrolling);

		this.isScrolling = setTimeout(() => {
			this.setIsSnap();
		}, 100);
	}

	private elementTouchStart(evt: TouchEvent) {
		this.touchX.start = evt.changedTouches[0].screenX;
		this.touchY.start = evt.changedTouches[0].screenY;
	}

	private elementTouchEnd(evt: TouchEvent) {
		this.touchX.end = evt.changedTouches[0].screenX;
		this.touchY.end = evt.changedTouches[0].screenY;

		this.detectDirection();
	}

	private innerMouseDown(evt: MouseEvent | TouchEvent) {
		this.handleDragStart(evt);
	}

	private innerTouchStart(evt: MouseEvent | TouchEvent) {
		this.handleDragStart(evt);
	}

	private documentMouseMove(evt: MouseEvent | TouchEvent) {
		this.handleDragMove(evt);
	}

	private documentTouchMove(evt: MouseEvent | TouchEvent) {
		this.handleDragMove(evt);
	}

	private documentMouseUp() {
		this.handleDragEnd();
	}

	private documentTouchEnd() {
		this.handleDragEnd();
	}

	private dotClick(ind: number) {
		this.goTo(ind);

		if (this.isAutoPlay) {
			this.resetTimer();
			this.setTimer();
		}
	}

	private init() {
		this.createCollection(window.$hsCarouselCollection, this);

		if (this.inner) {
			this.calculateWidth();

			if (this.isDraggable && !this.isSnap) this.initDragHandling();
		}

		if (this.prev) {
			this.onPrevClickListener = () => this.prevClick();

			this.prev.addEventListener('click', this.onPrevClickListener);
		}

		if (this.next) {
			this.onNextClickListener = () => this.nextClick();

			this.next.addEventListener('click', this.onNextClickListener);
		}

		if (this.dots) this.initDots();
		if (this.info) this.buildInfo();
		if (this.slides.length) {
			this.addCurrentClass();
			if (!this.isInfiniteLoop) this.addDisabledClass();
			if (this.isAutoPlay) this.autoPlay();
		}

		setTimeout(() => {
			if (this.isSnap) this.setIsSnap();

			if (this.loadingClassesRemove) {
				if (typeof this.loadingClassesRemove === 'string') {
					this.inner.classList.remove(this.loadingClassesRemove);
				} else this.inner.classList.remove(...this.loadingClassesRemove);
			}
			if (this.loadingClassesAdd) {
				if (typeof this.loadingClassesAdd === 'string') {
					this.inner.classList.add(this.loadingClassesAdd);
				} else this.inner.classList.add(...this.loadingClassesAdd);
			}

			if (this.inner && this.afterLoadingClassesAdd) {
				setTimeout(() => {
					if (typeof this.afterLoadingClassesAdd === 'string') {
						this.inner.classList.add(t
```

### Core Architecture Module: `src/plugins/collapse/core.ts`
```
/*
 * HSCollapse
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { afterTransition, dispatch } from '../../utils';

import { ICollapse } from '../collapse/interfaces';

import HSBasePlugin from '../base-plugin';
import { ICollectionItem } from '../../interfaces';

class HSCollapse extends HSBasePlugin<{}> implements ICollapse {
	private readonly contentId: string | null;
	public content: HTMLElement | null;
	private animationInProcess: boolean;

	private onElementClickListener: () => void;

	constructor(el: HTMLElement, options?: {}, events?: {}) {
		super(el, options, events);

		this.contentId = this.el.dataset.hsCollapse;
		this.content = document.querySelector(this.contentId);
		this.animationInProcess = false;

		if (this.content) this.init();
	}

	private elementClick() {
		if (this.content.classList.contains('open')) {
			this.hide();
		} else {
			this.show();
		}
	}

	private init() {
		this.createCollection(window.$hsCollapseCollection, this);

		this.onElementClickListener = () => this.elementClick();

		if (this?.el?.ariaExpanded) {
			if (this.el.classList.contains('open')) this.el.ariaExpanded = 'true';
			else this.el.ariaExpanded = 'false';
		}

		this.el.addEventListener('click', this.onElementClickListener);
	}

	private hideAllMegaMenuItems() {
		this.content
			.querySelectorAll('.hs-mega-menu-content.block')
			.forEach((el) => {
				el.classList.remove('block');
				el.classList.add('hidden');
			});
	}

	// Public methods
	public show() {
		if (this.animationInProcess || this.el.classList.contains('open')) {
			return false;
		}

		this.animationInProcess = true;

		this.el.classList.add('open');
		if (this?.el?.ariaExpanded) this.el.ariaExpanded = 'true';
		this.content.classList.add('open');
		this.content.classList.remove('hidden');

		this.content.style.height = '0';
		setTimeout(() => {
			this.content.style.height = `${this.content.scrollHeight}px`;

			this.fireEvent('beforeOpen', this.el);
			dispatch('beforeOpen.hs.collapse', this.el, this.el);

			afterTransition(this.content, () => {
				this.content.style.height = '';

				this.fireEvent('open', this.el);
				dispatch('open.hs.collapse', this.el, this.el);

				this.animationInProcess = false;
			});
		});
	}

	public hide() {
		if (this.animationInProcess || !this.el.classList.contains('open')) {
			return false;
		}

		this.animationInProcess = true;

		this.el.classList.remove('open');
		if (this?.el?.ariaExpanded) this.el.ariaExpanded = 'false';

		this.content.style.height = `${this.content.scrollHeight}px`;
		setTimeout(() => {
			this.content.style.height = '0';
		});

		this.content.classList.remove('open');

		afterTransition(this.content, () => {
			this.content.classList.add('hidden');
			this.content.style.height = '';

			this.fireEvent('hide', this.el);
			dispatch('hide.hs.collapse', this.el, this.el);

			this.animationInProcess = false;
		});

		if (this.content.querySelectorAll('.hs-mega-menu-content.block').length) {
			this.hideAllMegaMenuItems();
		}
	}

	public destroy() {
		this.el.removeEventListener('click', this.onElementClickListener);

		this.content = null;
		this.animationInProcess = false;

		window.$hsCollapseCollection = window.$hsCollapseCollection.filter(
			({ element }) => element.el !== this.el,
		);
	}

	// Static methods
	private static findInCollection(
		target: HSCollapse | HTMLElement | string,
	): ICollectionItem<HSCollapse> | null {
		return (
			window.$hsCollapseCollection.find((el) => {
				if (target instanceof HSCollapse) return el.element.el === target.el;
				else if (typeof target === 'string') {
					return el.element.el === document.querySelector(target);
				} else return el.element.el === target;
			}) || null
		);
	}

	static getInstance(target: HTMLElement, isInstance = false) {
		const elInCollection = window.$hsCollapseCollection.find(
			(el) =>
				el.element.el ===
				(typeof target === 'string' ? document.querySelector(target) : target),
		);

		return elInCollection
			? isInstance
				? elInCollection
				: elInCollection.element.el
			: null;
	}

	static autoInit() {
		if (!window.$hsCollapseCollection) window.$hsCollapseCollection = [];

		if (window.$hsCollapseCollection) {
			window.$hsCollapseCollection = window.$hsCollapseCollection.filter(
				({ element }) => document.contains(element.el),
			);
		}

		document
			.querySelectorAll('.hs-collapse-toggle:not(.--prevent-on-load-init)')
			.forEach((el: HTMLElement) => {
				if (
					!window.$hsCollapseCollection.find(
						(elC) => (elC?.element?.el as HTMLElement) === el,
					)
				) {
					new HSCollapse(el);
				}
			});
	}

	static show(target: HSCollapse | HTMLElement | string) {
		const instance = HSCollapse.findInCollection(target);

		if (instance && instance.element.content.classList.contains('hidden'))
			instance.element.show();
	}

	static hide(target: HSCollapse | HTMLElement | string) {
		const instance = HSCollapse.findInCollection(target);

		if (instance && !instance.element.content.classList.contains('hidden'))
			instance.element.hide();
	}

	// Backward compatibility
	static on(
		evt: string,
		target: HSCollapse | HTMLElement | string,
		cb: Function,
	) {
		const instance = HSCollapse.findInCollection(target);

		if (instance) instance.element.events[evt] = cb;
	}
}

export default HSCollapse;

```

### Core Architecture Module: `src/plugins/combobox/core.ts`
```
/*
 * HSComboBox
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import {
	afterTransition,
	debounce,
	dispatch,
	htmlToElement,
	isEnoughSpace,
} from '../../utils';

import {
	IComboBox,
	IComboBoxItemAttr,
	IComboBoxOptions,
} from '../combobox/interfaces';

import HSBasePlugin from '../base-plugin';
import { IAccessibilityComponent } from '../accessibility-manager/interfaces';
import HSAccessibilityObserver from '../accessibility-manager';

class HSComboBox extends HSBasePlugin<IComboBoxOptions> implements IComboBox {
	private static globalListenersInitialized = false;

	gap: number;
	viewport: string | HTMLElement | null;
	preventVisibility: boolean;
	minSearchLength: number;
	apiUrl: string | null;
	apiDataPart: string | null;
	apiQuery: string | null;
	apiSearchQuery: string | null;
	apiSearchPath: string | null;
	apiSearchDefaultPath: string | null;
	apiHeaders: {};
	apiGroupField: string | null;
	outputItemTemplate: string | null;
	outputEmptyTemplate: string | null;
	outputLoaderTemplate: string | null;
	groupingType: 'default' | 'tabs' | null;
	groupingTitleTemplate: string | null;
	tabsWrapperTemplate: string | null;
	preventSelection: boolean;
	preventAutoPosition: boolean;
	preventClientFiltering: boolean;
	isOpenOnFocus: boolean;
	keepOriginalOrder: boolean;
	preserveSelectionOnEmpty: boolean;

	private accessibilityComponent: IAccessibilityComponent;

	private readonly input: HTMLInputElement | null;
	private readonly output: HTMLElement | null;
	private readonly itemsWrapper: HTMLElement | null;
	private items: HTMLElement[];
	private tabs: HTMLElement[] | [];
	private readonly toggle: HTMLElement | null;
	private readonly toggleClose: HTMLElement | null;
	private readonly toggleOpen: HTMLElement | null;
	private outputPlaceholder: HTMLElement | null;
	private outputLoader: HTMLElement | null;

	private value: string | null;
	private selected: string | null;
	private currentData: {} | {}[] | null;
	private groups: any[] | null;
	private selectedGroup: string | null;

	isOpened: boolean;
	isCurrent: boolean;
	private animationInProcess: boolean;
	private isSearchLengthExceeded = false;
	private lastQuery = '';
	private queryAbortController?: AbortController;

	private onInputFocusListener: () => void;
	private onInputInputListener: (evt: InputEvent) => void;
	private onToggleClickListener: () => void;
	private onToggleCloseClickListener: () => void;
	private onToggleOpenClickListener: () => void;

	constructor(el: HTMLElement, options?: IComboBoxOptions, events?: {}) {
		super(el, options, events);

		// Data parameters
		const data = el.getAttribute('data-hs-combo-box');
		const dataOptions: IComboBoxOptions = data ? JSON.parse(data) : {};
		const concatOptions = {
			...dataOptions,
			...options,
		};

		this.gap = 5;
		this.viewport =
			(typeof concatOptions?.viewport === 'string'
				? (document.querySelector(concatOptions?.viewport) as HTMLElement)
				: concatOptions?.viewport) ?? null;
		this.preventVisibility = concatOptions?.preventVisibility ?? false;
		this.minSearchLength = concatOptions?.minSearchLength ?? 0;
		this.apiUrl = concatOptions?.apiUrl ?? null;
		this.apiDataPart = concatOptions?.apiDataPart ?? null;
		this.apiQuery = concatOptions?.apiQuery ?? null;
		this.apiSearchQuery = concatOptions?.apiSearchQuery ?? null;
		this.apiSearchPath = concatOptions?.apiSearchPath ?? null;
		this.apiSearchDefaultPath = concatOptions?.apiSearchDefaultPath ?? null;
		this.apiHeaders = concatOptions?.apiHeaders ?? {};
		this.apiGroupField = concatOptions?.apiGroupField ?? null;
		this.outputItemTemplate =
			concatOptions?.outputItemTemplate ??
			`<div class="cursor-pointer py-2 px-4 w-full text-sm text-gray-800 hover:bg-gray-100 rounded-lg focus:outline-hidden focus:bg-gray-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-200 dark:focus:bg-neutral-800" data-hs-combo-box-output-item>
				<div class="flex justify-between items-center w-full">
					<span data-hs-combo-box-search-text></span>
					<span class="hidden hs-combo-box-selected:block">
						<svg class="shrink-0 size-3.5 text-blue-600 dark:text-blue-500" xmlns="http:.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					</span>
				</div>
			</div>`;
		this.outputEmptyTemplate =
			concatOptions?.outputEmptyTemplate ??
			`<div class="py-2 px-4 w-full text-sm text-gray-800 rounded-lg dark:bg-neutral-900 dark:text-neutral-200">Nothing found...</div>`;
		this.outputLoaderTemplate =
			concatOptions?.outputLoaderTemplate ??
			`<div class="flex justify-center items-center py-2 px-4 text-sm text-gray-800 rounded-lg bg-white dark:bg-neutral-900 dark:text-neutral-200">
				<div class="animate-spin inline-block size-6 border-3 border-current border-t-transparent text-blue-600 rounded-[999px] dark:text-blue-500" role="status" aria-label="loading">
					<span class="sr-only">Loading...</span>
				</div>
			</div>`;
		this.groupingType = concatOptions?.groupingType ?? null;
		this.groupingTitleTemplate =
			concatOptions?.groupingTitleTemplate ??
			(this.groupingType === 'default'
				? `<div class="block mb-1 text-xs font-semibold uppercase text-blue-600 dark:text-blue-500"></div>`
				: `<button type="button" class="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-semibold whitespace-nowrap rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"></button>`);
		this.tabsWrapperTemplate =
			concatOptions?.tabsWrapperTemplate ??
			`<div class="overflow-x-auto p-4"></div>`;
		this.preventSelection = concatOptions?.preventSelection ?? false;
		this.preventAutoPosition = concatOptions?.preventAutoPosition ?? false;
		this.preventClientFiltering =
			options?.preventClientFiltering ??
			(!!concatOptions?.apiSearchQuery || !!concatOptions?.apiSearchPath);
		this.isOpenOnFocus = concatOptions?.isOpenOnFocus ?? false;
		this.keepOriginalOrder = concatOptions?.keepOriginalOrder ?? false;
		this.preserveSelectionOnEmpty =
			concatOptions?.preserveSelectionOnEmpty ?? true;

		// Internal parameters
		this.input = this.el.querySelector('[data-hs-combo-box-input]') ?? null;
		this.output = this.el.querySelector('[data-hs-combo-box-output]') ?? null;
		this.itemsWrapper =
			this.el.querySelector('[data-hs-combo-box-output-items-wrapper]') ?? null;
		this.items =
			Array.from(this.el.querySelectorAll('[data-hs-combo-box-output-item]')) ??
			[];
		this.tabs = [];
		this.toggle = this.el.querySelector('[data-hs-combo-box-toggle]') ?? null;
		this.toggleClose =
			this.el.querySelector('[data-hs-combo-box-close]') ?? null;
		this.toggleOpen = this.el.querySelector('[data-hs-combo-box-open]') ?? null;
		this.outputPlaceholder = null;

		this.selected = this.value =
			(this.el.querySelector('[data-hs-combo-box-input]') as HTMLInputElement)
				.value ?? '';
		this.currentData = null;
		this.isOpened = false;
		this.isCurrent = false;
		this.animationInProcess = false;
		this.selectedGroup = 'all';

		this.init();
	}

	private inputFocus() {
		if (!this.isOpened) {
			this.setResultAndRender();
			this.open();
		}
	}

	private inputInput() {
		const val = this.input.value.trim();

		if (val.length <= this.minSearchLength) this.setResultAndRender('');
		else this.setResultAndRender(val);

		if (!this.preserveSelectionOnEmpty && val === '') {
			this.selected = '';
			this.value = '';
			this.currentData = null;
		}

		if (this.input.value !== '') this.el.classList.add('has-value');
		else this.el.classList.remove('has-value');

		if (!this.isOpened) this.open();
	}

	private toggleClick() {
		if (this.isOpened) this.close();
		else this.open(this.toggle.getAttribute('data-hs-combo-box-toggle'));
	}

	private toggleCloseClick() {
		this.close();
	}

	private toggleOpenClick() {
		this.open();
	}

	private init() {
		HSComboBox.ensureGlobalHandlers();
		this.createCollection(window.$hsComboBoxCollection, this);

		this.build();

		if (typeof window !== 'undefined') {
			if (!window.HSAccessibilityObserver) {
				window.HSAccessibilityObserver = new HSAccessibilityObserver();
			}
			this.setupAccessibility();
		}
	}

	private build() {
		this.buildInput();
		if (this.groupingType) this.setGroups();
		this.buildItems();
		if (this.preventVisibility) {
			// TODO:: test the plugin while the line below is commented.
			// this.isOpened = true;

			if (!this.preventAutoPosition) this.recalculateDirection();
		}
		if (this.toggle) this.buildToggle();
		if (this.toggleClose) this.buildToggleClose();
		if (this.toggleOpen) this.buildToggleOpen();
	}

	private getNestedProperty<T>(obj: T, path: string): any {
		return path
			.split('.')
			.reduce((acc: any, key: string) => acc && acc[key], obj);
	}

	private setValue(val: string, data: {} | null = null) {
		this.selected = val;
		this.value = val;
		this.input.value = val;

		if (data) this.currentData = data;

		this.fireEvent('select', this.currentData);
		dispatch('select.hs.combobox', this.el, this.currentData);
	}

	private setValueAndOpen(val: string) {
		this.value = val;

		if (this.items.length) {
			this.setItemsVisibility();
		}
	}

	private setValueAndClear(val: string | null, data: {} | null = null) {
		if (val) this.setValue(val, data);
		else this.setValue(this.selected, data);

		if (this.outputPlaceholder) this.destroyOutputPlaceholder();
	}

	private setSelectedByValue(val: string[]) {
		this.items.forEach((el) => {
			const valueElement = el.querySelector('[data-hs-combo-box-value]');

			if (valueElement && val.includes(valueElement.textContent)) {
				(el as HTMLElement).classList.add('selected');
			} else {
				(el as HTMLElement).classList.remove('selected');
			}
		});
	}


```

### Core Architecture Module: `src/plugins/copy-markup/core.ts`
```
/*
 * HSCopyMarkup
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { dispatch } from '../../utils';

import { ICopyMarkup, ICopyMarkupOptions } from '../copy-markup/interfaces';

import HSBasePlugin from '../base-plugin';

class HSCopyMarkup
	extends HSBasePlugin<ICopyMarkupOptions>
	implements ICopyMarkup
{
	private readonly targetSelector: string | null;
	private readonly wrapperSelector: string | null;
	private readonly limit: number | null;

	private target: HTMLElement | null;
	private wrapper: HTMLElement | null;
	private items: HTMLElement[] | null;

	private onElementClickListener: () => void;
	private onDeleteItemButtonClickListener: () => void;

	constructor(el: HTMLElement, options?: ICopyMarkupOptions) {
		super(el, options);

		const data = el.getAttribute('data-hs-copy-markup');
		const dataOptions: ICopyMarkupOptions = data ? JSON.parse(data) : {};
		const concatOptions = {
			...dataOptions,
			...options,
		};

		this.targetSelector = concatOptions?.targetSelector || null;
		this.wrapperSelector = concatOptions?.wrapperSelector || null;
		this.limit = concatOptions?.limit || null;
		this.items = [];

		if (this.targetSelector) this.init();
	}

	private elementClick() {
		this.copy();
	}

	private deleteItemButtonClick(item: HTMLElement) {
		this.delete(item);
	}

	private init() {
		this.createCollection(window.$hsCopyMarkupCollection, this);

		this.onElementClickListener = () => this.elementClick();

		this.setTarget();
		this.setWrapper();
		this.addPredefinedItems();

		this.el.addEventListener('click', this.onElementClickListener);
	}

	private copy() {
		if (this.limit && this.items.length >= this.limit) return false;

		if (this.el.hasAttribute('disabled')) this.el.setAttribute('disabled', '');

		const copiedElement = this.target.cloneNode(true) as HTMLElement;

		this.addToItems(copiedElement);

		if (this.limit && this.items.length >= this.limit) {
			this.el.setAttribute('disabled', 'disabled');
		}

		this.fireEvent('copy', copiedElement);
		dispatch('copy.hs.copyMarkup', copiedElement, copiedElement);
	}

	private addPredefinedItems() {
		Array.from(this.wrapper.children)
			.filter(
				(el: HTMLElement) => !el.classList.contains('[--ignore-for-count]'),
			)
			.forEach((el: HTMLElement) => {
				this.addToItems(el);
			});

		if (this.limit && this.items.length >= this.limit) {
			this.el.setAttribute('disabled', 'disabled');
		}
	}

	private setTarget() {
		const target: HTMLElement =
			typeof this.targetSelector === 'string'
				? (document
						.querySelector(this.targetSelector)
						.cloneNode(true) as HTMLElement)
				: ((this.targetSelector as HTMLElement).cloneNode(true) as HTMLElement);

		target.removeAttribute('id');

		this.target = target;
	}

	private setWrapper() {
		this.wrapper =
			typeof this.wrapperSelector === 'string'
				? document.querySelector(this.wrapperSelector)
				: this.wrapperSelector;
	}

	private addToItems(item: HTMLElement) {
		const deleteItemButton = item.querySelector(
			'[data-hs-copy-markup-delete-item]',
		);

		if (this.wrapper) this.wrapper.append(item);
		else this.el.before(item);

		if (deleteItemButton) {
			this.onDeleteItemButtonClickListener = () =>
				this.deleteItemButtonClick(item);

			deleteItemButton.addEventListener(
				'click',
				this.onDeleteItemButtonClickListener,
			);
		}

		this.items.push(item);
	}

	// Public methods
	public delete(target: HTMLElement) {
		const index = this.items.indexOf(target);

		if (index !== -1) this.items.splice(index, 1);

		target.remove();

		if (this.limit && this.items.length < this.limit) {
			this.el.removeAttribute('disabled');
		}

		this.fireEvent('delete', target);
		dispatch('delete.hs.copyMarkup', target, target);
	}

	public destroy() {
		const deleteItemButtons = this.wrapper.querySelectorAll(
			'[data-hs-copy-markup-delete-item]',
		);

		this.el.removeEventListener('click', this.onElementClickListener);
		if (deleteItemButtons.length) {
			deleteItemButtons.forEach((el) =>
				el.removeEventListener('click', this.onDeleteItemButtonClickListener),
			);
		}

		this.el.removeAttribute('disabled');

		this.target = null;
		this.wrapper = null;
		this.items = null;

		window.$hsCopyMarkupCollection = window.$hsCopyMarkupCollection.filter(
			({ element }) => element.el !== this.el,
		);
	}

	// Static method
	static getInstance(target: HTMLElement | string, isInstance?: boolean) {
		const elInCollection = window.$hsCopyMarkupCollection.find(
			(el) =>
				el.element.el ===
				(typeof target === 'string' ? document.querySelector(target) : target),
		);

		return elInCollection
			? isInstance
				? elInCollection
				: elInCollection.element
			: null;
	}

	static autoInit() {
		if (!window.$hsCopyMarkupCollection) window.$hsCopyMarkupCollection = [];

		if (window.$hsCopyMarkupCollection) {
			window.$hsCopyMarkupCollection = window.$hsCopyMarkupCollection.filter(
				({ element }) => document.contains(element.el),
			);
		}

		document
			.querySelectorAll('[data-hs-copy-markup]:not(.--prevent-on-load-init)')
			.forEach((el: HTMLElement) => {
				if (
					!window.$hsCopyMarkupCollection.find(
						(elC) => (elC?.element?.el as HTMLElement) === el,
					)
				) {
					const data = el.getAttribute('data-hs-copy-markup');
					const options: ICopyMarkupOptions = data ? JSON.parse(data) : {};

					new HSCopyMarkup(el, options);
				}
			});
	}
}

export default HSCopyMarkup;

```

### Core Architecture Module: `src/plugins/datatable/core.ts`
```
/*
 * HSDataTable
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { Api } from 'datatables.net';

import { debounce, htmlToElement, classToClassList } from '../../utils';

import {
	IDataTableOptions,
	IDataTable,
	IColumnDef,
} from '../datatable/interfaces';

import HSBasePlugin from '../base-plugin';

declare var DataTable: any;

class HSDataTable
	extends HSBasePlugin<IDataTableOptions>
	implements IDataTable
{
	private concatOptions: IDataTableOptions;

	private dataTable: Api<any>;

	private readonly table: HTMLTableElement;

	private searches: HTMLElement[] | null;

	private pageEntitiesList: (HTMLSelectElement | HTMLInputElement)[] | null;

	private pagingList: HTMLElement[] | null;
	private pagingPagesList: HTMLElement[] | null;

	private pagingPrevList: HTMLElement[] | null;
	private pagingNextList: HTMLElement[] | null;

	private readonly infoList: HTMLElement[] | null;

	private rowSelectingAll: HTMLElement | null;
	private rowSelectingIndividual: string | null;

	private maxPagesToShow: number;
	private isRowSelecting: boolean;
	private readonly pageBtnClasses: string | null;

	private onSearchInputListener:
		| {
				el: Element;
				fn: (evt: InputEvent) => void;
		  }[]
		| null;
	private onPageEntitiesChangeListener:
		| {
				el: Element;
				fn: (evt: InputEvent) => void;
		  }[]
		| null;
	private onSinglePagingClickListener:
		| {
				el: Element;
				fn: () => void;
		  }[]
		| null;
	private onPagingPrevClickListener:
		| {
				el: Element;
				fn: () => void;
		  }[]
		| null;
	private onPagingNextClickListener:
		| {
				el: Element;
				fn: () => void;
		  }[]
		| null;
	private onRowSelectingAllChangeListener: () => void;

	constructor(el: HTMLElement, options?: IDataTableOptions, events?: {}) {
		super(el, options, events);

		this.el = typeof el === 'string' ? document.querySelector(el) : el;

		// Exclude columns from ordering
		const columnDefs: IColumnDef[] = [];
		Array.from(this.el.querySelectorAll('thead th, thead td')).forEach(
			(th: HTMLElement, ind: number) => {
				if (th.classList.contains('--exclude-from-ordering'))
					columnDefs.push({
						targets: ind,
						orderable: false,
					});
			},
		);

		const data = this.el.getAttribute('data-hs-datatable');
		const dataOptions: IDataTableOptions = data ? JSON.parse(data) : {};

		this.concatOptions = {
			searching: true,
			lengthChange: false,
			order: [],
			columnDefs: [...columnDefs],
			...dataOptions,
			...options,
		};

		this.table = this.el.querySelector('table');

		this.searches =
			Array.from(this.el.querySelectorAll('[data-hs-datatable-search]')) ??
			null;

		this.pageEntitiesList =
			Array.from(
				this.el.querySelectorAll('[data-hs-datatable-page-entities]'),
			) ?? null;

		this.pagingList =
			Array.from(this.el.querySelectorAll('[data-hs-datatable-paging]')) ??
			null;
		this.pagingPagesList =
			Array.from(
				this.el.querySelectorAll('[data-hs-datatable-paging-pages]'),
			) ?? null;
		this.pagingPrevList =
			Array.from(this.el.querySelectorAll('[data-hs-datatable-paging-prev]')) ??
			null;
		this.pagingNextList =
			Array.from(this.el.querySelectorAll('[data-hs-datatable-paging-next]')) ??
			null;

		this.infoList =
			Array.from(this.el.querySelectorAll('[data-hs-datatable-info]')) ?? null;

		if (this.concatOptions?.rowSelectingOptions)
			this.rowSelectingAll =
				(this.concatOptions?.rowSelectingOptions?.selectAllSelector
					? document.querySelector(
							this.concatOptions?.rowSelectingOptions?.selectAllSelector,
						)
					: document.querySelector('[data-hs-datatable-row-selecting-all]')) ??
				null;
		if (this.concatOptions?.rowSelectingOptions)
			this.rowSelectingIndividual =
				this.concatOptions?.rowSelectingOptions?.individualSelector ??
				'[data-hs-datatable-row-selecting-individual]';

		if (this.pageEntitiesList.length)
			this.concatOptions.pageLength = parseInt(this.pageEntitiesList[0].value);

		this.maxPagesToShow = 3;
		this.isRowSelecting = !!this.concatOptions?.rowSelectingOptions;
		this.pageBtnClasses =
			this.concatOptions?.pagingOptions?.pageBtnClasses ?? null;

		this.onSearchInputListener = [];
		this.onPageEntitiesChangeListener = [];
		this.onSinglePagingClickListener = [];
		this.onPagingPrevClickListener = [];
		this.onPagingNextClickListener = [];

		this.init();
	}

	private init() {
		this.createCollection(window.$hsDataTableCollection, this);

		this.initTable();

		if (this.searches.length) this.initSearch();

		if (this.pageEntitiesList.length) this.initPageEntities();

		if (this.pagingList.length) this.initPaging();
		if (this.pagingPagesList.length) this.buildPagingPages();
		if (this.pagingPrevList.length) this.initPagingPrev();
		if (this.pagingNextList.length) this.initPagingNext();

		if (this.infoList.length) this.initInfo();

		if (this.isRowSelecting) this.initRowSelecting();
	}

	private initTable() {
		this.dataTable = new DataTable(this.table, this.concatOptions);

		if (this.isRowSelecting) this.triggerChangeEventToRow();

		this.dataTable.on('draw', () => {
			if (this.isRowSelecting) this.updateSelectAllCheckbox();
			if (this.isRowSelecting) this.triggerChangeEventToRow();
			this.updateInfo();
			this.pagingPagesList.forEach((el) => this.updatePaging(el));
		});
	}

	private searchInput(evt: InputEvent) {
		this.onSearchInput((evt.target as HTMLInputElement).value);
	}

	private pageEntitiesChange(evt: Event) {
		this.onEntitiesChange(
			parseInt((evt.target as HTMLSelectElement).value),
			evt.target as HTMLSelectElement,
		);
	}

	private pagingPrevClick() {
		this.onPrevClick();
	}

	private pagingNextClick() {
		this.onNextClick();
	}

	private rowSelectingAllChange() {
		this.onSelectAllChange();
	}

	private singlePagingClick(count: number) {
		this.onPageClick(count);
	}

	// Search
	private initSearch() {
		this.searches.forEach((el) => {
			this.onSearchInputListener.push({
				el,
				fn: debounce((evt: InputEvent) => this.searchInput(evt)),
			});

			el.addEventListener(
				'input',
				this.onSearchInputListener.find((search) => search.el === el).fn,
			);
		});
	}

	private onSearchInput(val: string) {
		this.dataTable.search(val).draw();
	}

	// Page entities
	private initPageEntities() {
		this.pageEntitiesList.forEach((el) => {
			this.onPageEntitiesChangeListener.push({
				el,
				fn: (evt) => this.pageEntitiesChange(evt),
			});

			el.addEventListener(
				'change',
				this.onPageEntitiesChangeListener.find(
					(pageEntity) => pageEntity.el === el,
				).fn,
			);
		});
	}

	private onEntitiesChange(entities: number, target: HTMLSelectElement) {
		const otherEntities = this.pageEntitiesList.filter((el) => el !== target);

		if (otherEntities.length)
			otherEntities.forEach((el) => {
				if (window.HSSelect) {
					// @ts-ignore
					const hsSelectInstance = window.HSSelect.getInstance(el, true);
					if (hsSelectInstance && 'element' in hsSelectInstance) {
						hsSelectInstance.element.setValue(`${entities}`);
					}
				} else el.value = `${entities}`;
			});

		this.dataTable.page.len(entities).draw();
	}

	// Info
	private initInfo() {
		this.infoList.forEach((el) => {
			this.initInfoFrom(el);
			this.initInfoTo(el);
			this.initInfoLength(el);
		});
	}

	private initInfoFrom(el: HTMLElement) {
		const infoFrom =
			(el.querySelector('[data-hs-datatable-info-from]') as HTMLElement) ??
			null;
		const { start } = this.dataTable.page.info();

		if (infoFrom) infoFrom.innerText = `${start + 1}`;
	}

	private initInfoTo(el: HTMLElement) {
		const infoTo =
			(el.querySelector('[data-hs-datatable-info-to]') as HTMLElement) ?? null;
		const { end } = this.dataTable.page.info();

		if (infoTo) infoTo.innerText = `${end}`;
	}

	private initInfoLength(el: HTMLElement) {
		const infoLength =
			(el.querySelector('[data-hs-datatable-info-length]') as HTMLElement) ??
			null;
		const { recordsTotal } = this.dataTable.page.info();

		if (infoLength) infoLength.innerText = `${recordsTotal}`;
	}

	private updateInfo() {
		this.initInfo();
	}

	// Paging
	private initPaging() {
		this.pagingList.forEach((el) => this.hidePagingIfSinglePage(el));
	}

	private hidePagingIfSinglePage(el: HTMLElement) {
		const { pages } = this.dataTable.page.info();

		if (pages < 2) {
			el.classList.add('hidden');
			el.style.display = 'none';
		} else {
			el.classList.remove('hidden');
			el.style.display = '';
		}
	}

	private initPagingPrev() {
		this.pagingPrevList.forEach((el) => {
			this.onPagingPrevClickListener.push({
				el,
				fn: () => this.pagingPrevClick(),
			});

			el.addEventListener(
				'click',
				this.onPagingPrevClickListener.find(
					(pagingPrev) => pagingPrev.el === el,
				).fn,
			);
		});
	}

	private onPrevClick() {
		this.dataTable.page('previous').draw('page');
	}

	private disablePagingArrow(el: HTMLElement, statement: boolean) {
		if (statement) {
			el.classList.add('disabled');
			el.setAttribute('disabled', 'disabled');
		} else {
			el.classList.remove('disabled');
			el.removeAttribute('disabled');
		}
	}

	private initPagingNext() {
		this.pagingNextList.forEach((el) => {
			this.onPagingNextClickListener.push({
				el,
				fn: () => this.pagingNextClick(),
			});

			el.addEventListener(
				'click',
				this.onPagingNextClickListener.find(
					(pagingNext) => pagingNext.el === el,
				).fn,
			);
		});
	}

	private onNextClick() {
		this.dataTable.page('next').draw('page');
	}

	private buildPagingPages() {
		this.pagingPagesList.forEach((el) => this.updatePaging(el));
	}

	private updatePaging(pagingPages: HTMLElement) {
		const { page, pages, length } = this.dataTable.page.info();
		const totalRecords = this.dataTable.rows({ search: 'applied' }).count();
		const totalPages = Math.ceil(totalRecords / length);
		const currentPage = page + 1;

		let startPage = Math.max(
			1,
			currentPage - Math.floor(this.maxPagesToSh
```

### Core Architecture Module: `src/plugins/datepicker/core.ts`
```
/*
 * HSDatepicker
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { dispatch } from '../../utils';
import { Calendar, DatesArr, Range } from 'vanilla-calendar-pro';

import CustomVanillaCalendar from './vanilla-datepicker-pro';

import { templates } from './templates';
import { templatesBasedOnUtility } from './templates-utility';

import { todayTranslations } from './locale';
import { classToClassList, htmlToElement } from '../../utils';
import HSSelect from '../select/core';
import { ISelectOptions } from '../select/interfaces';

import {
	ICustomDatepickerOptions,
	IDatepicker,
	ITemplates,
} from './interfaces';

import HSBasePlugin from '../base-plugin';
import { ICollectionItem } from '../../interfaces';

declare var _: any;

class HSDatepicker extends HSBasePlugin<{}> implements IDatepicker {
	private dataOptions: ICustomDatepickerOptions;
	private concatOptions: ICustomDatepickerOptions;
	private updatedStyles: ICustomDatepickerOptions['styles'];
	private applyUtilityClasses: boolean;
	private templatesByType: ITemplates;

	private vanillaCalendar: Calendar;

	constructor(el: HTMLElement, options?: {}, events?: {}) {
		super(el, options, events);

		const dataOptions: ICustomDatepickerOptions = el.getAttribute(
			'data-hs-datepicker',
		)
			? JSON.parse(el.getAttribute('data-hs-datepicker')!)
			: {};

		this.dataOptions = {
			...dataOptions,
			...options,
		};
		this.applyUtilityClasses =
			typeof this.dataOptions?.applyUtilityClasses !== 'undefined'
				? this.dataOptions?.applyUtilityClasses
				: false;

		this.templatesByType = this.applyUtilityClasses
			? templates
			: templatesBasedOnUtility;

		const removeDefaultStyles =
			typeof this.dataOptions?.removeDefaultStyles !== 'undefined'
				? this.dataOptions?.removeDefaultStyles
				: false;

		this.updatedStyles = _.mergeWith(
			removeDefaultStyles ? {} : CustomVanillaCalendar.defaultStyles,
			this.dataOptions?.styles || {},
			(a: any, b: any) => {
				if (typeof a === 'string' && typeof b === 'string') {
					return `${a} ${b}`;
				}
			},
		);

		const today = new Date();
		const defaults = {
			selectedTheme: this.dataOptions.selectedTheme ?? '',
			styles: this.updatedStyles,
			dateMin: this.dataOptions.dateMin ?? today.toISOString().split('T')[0],
			dateMax: this.dataOptions.dateMax ?? '2470-12-31',
			mode: this.dataOptions.mode ?? 'default',
			inputMode:
				typeof this.dataOptions.inputMode !== 'undefined'
					? this.dataOptions.inputMode
					: true,
		};

		const chainCallbacks =
			(superCallback?: Function, customCallback?: (self: Calendar) => void) =>
			(self: Calendar) => {
				superCallback?.(self);
				customCallback?.(self);
			};
		const initTime = (self: Calendar) => {
			if (this.hasTime(self)) this.initCustomTime(self);
		};
		const _options = {
			layouts: {
				month: this.templatesByType.month(defaults.selectedTheme),
			},
			onInit: chainCallbacks(this.dataOptions.onInit, (self) => {
				if (defaults.mode === 'custom-select' && !this.dataOptions.inputMode) {
					initTime(self);
				}
			}),
			onShow: chainCallbacks(this.dataOptions.onShow, (self) => {
				if (defaults.inputMode) {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							window.dispatchEvent(new Event('resize'));
						});
					});
				}

				if (defaults.mode === 'custom-select') {
					this.updateCustomSelects(self);
					initTime(self);
				}
			}),
			onHide: chainCallbacks(this.dataOptions.onHide, (self) => {
				if (defaults.mode === 'custom-select') {
					this.destroySelects(self.context.mainElement);
				}
			}),
			onUpdate: chainCallbacks(this.dataOptions.onUpdate, (self) => {
				this.updateCalendar(self.context.mainElement);
			}),
			onCreateDateEls: chainCallbacks(
				this.dataOptions.onCreateDateEls,
				(self) => {
					if (defaults.mode === 'custom-select') this.updateCustomSelects(self);
				},
			),
			onChangeToInput: chainCallbacks(
				this.dataOptions.onChangeToInput,
				(self) => {
					if (!self.context.inputElement) return;

					this.setInputValue(
						self.context.inputElement,
						self.context.selectedDates,
					);

					const data = {
						selectedDates: self.context.selectedDates,
						selectedTime: self.context.selectedTime,
						rest: self.context,
					};

					this.fireEvent('change', data);
					dispatch('change.hs.datepicker', this.el, data);
				},
			),
			onChangeTime: chainCallbacks(this.dataOptions.onChangeTime, initTime),
			onClickYear: chainCallbacks(this.dataOptions.onClickYear, initTime),
			onClickMonth: chainCallbacks(this.dataOptions.onClickMonth, initTime),
			onClickArrow: chainCallbacks(this.dataOptions.onClickArrow, (self) => {
				if (defaults.mode === 'custom-select') {
					setTimeout(() => {
						this.disableNav();
						this.disableOptions();
						this.updateCalendar(self.context.mainElement);
					});
				}
			}),
		};

		this.concatOptions = _.merge(_options, this.dataOptions);

		const processedOptions = {
			...defaults,
			layouts: {
				default: this.processCustomTemplate(
					this.templatesByType.default(defaults.selectedTheme),
					'default',
				),
				multiple: this.processCustomTemplate(
					this.templatesByType.multiple(defaults.selectedTheme),
					'multiple',
				),
				year: this.processCustomTemplate(
					this.templatesByType.year(defaults.selectedTheme),
					'default',
				),
			},
		};

		this.concatOptions = _.merge(this.concatOptions, processedOptions);
		this.vanillaCalendar = new CustomVanillaCalendar(
			this.el,
			this.concatOptions,
		);

		this.init();
	}

	private init() {
		this.createCollection(window.$hsDatepickerCollection, this);

		this.vanillaCalendar.init();

		if (this.dataOptions?.selectedDates) {
			this.setInputValue(
				this.vanillaCalendar.context.inputElement,
				this.formatDateArrayToIndividualDates(this.dataOptions?.selectedDates),
			);
		}
	}

	private getTimeParts(time: string) {
		const [_time, meridiem] = time.split(' ');
		const [hours, minutes] = _time.split(':');

		return [hours, minutes, meridiem];
	}

	private getCurrentMonthAndYear(el: HTMLElement) {
		const currentMonthHolder = el.querySelector('[data-vc="month"]');
		const currentYearHolder = el.querySelector('[data-vc="year"]');

		return {
			month: +currentMonthHolder.getAttribute('data-vc-month'),
			year: +currentYearHolder.getAttribute('data-vc-year'),
		};
	}

	private extractSeparatorFromFormat(format: string): string {
		const match = format.match(/[^A-Za-z0-9]/);

		return match ? match[0] : '.';
	}

	private setInputValue(target: HTMLInputElement, dates: DatesArr) {
		const dateFormat = this.dataOptions?.dateFormat;
		const extractedSeparator = dateFormat
			? this.extractSeparatorFromFormat(dateFormat)
			: null;
		const dateSeparator =
			extractedSeparator ??
			this.dataOptions?.inputModeOptions?.dateSeparator ??
			'.';
		const itemsSeparator =
			this.dataOptions?.inputModeOptions?.itemsSeparator ?? ', ';
		const selectionDatesMode = this.dataOptions?.selectionDatesMode ?? 'single';

		if (dates.length && dates.length > 1) {
			if (selectionDatesMode === 'multiple') {
				const temp: string[] = [];
				dates.forEach((date) =>
					temp.push(
						dateFormat
							? this.formatDate(date, dateFormat)
							: this.changeDateSeparator(date, dateSeparator),
					),
				);

				target.value = temp.join(itemsSeparator);
			} else {
				const formattedStart = dateFormat
					? this.formatDate(dates[0], dateFormat)
					: this.changeDateSeparator(dates[0], dateSeparator);
				const formattedEnd = dateFormat
					? this.formatDate(dates[1], dateFormat)
					: this.changeDateSeparator(dates[1], dateSeparator);

				target.value = [formattedStart, formattedEnd].join(itemsSeparator);
			}
		} else if (dates.length && dates.length === 1) {
			target.value = dateFormat
				? this.formatDate(dates[0], dateFormat)
				: this.changeDateSeparator(dates[0], dateSeparator);
		} else target.value = '';
	}

	private getLocalizedTodayText(locale?: string): string {
		return todayTranslations[locale] || 'Today';
	}

	private changeDateSeparator(
		date: string | number | Date,
		separator = '.',
		defaultSeparator = '-',
	) {
		const dateObj = new Date(date);

		if (this.dataOptions?.replaceTodayWithText) {
			const today = new Date();
			const isToday = dateObj.toDateString() === today.toDateString();

			if (isToday) {
				const dateLocale = this.dataOptions?.dateLocale;

				return this.getLocalizedTodayText(dateLocale);
			}
		}

		const newDate = (date as string).split(defaultSeparator);
		return newDate.join(separator);
	}

	private formatDateArrayToIndividualDates(dates: DatesArr): string[] {
		const selectionDatesMode = this.dataOptions?.selectionDatesMode ?? 'single';
		const expandDateRange = (start: string, end: string): string[] => {
			const startDate = new Date(start);
			const endDate = new Date(end);
			const result: string[] = [];

			while (startDate <= endDate) {
				result.push(startDate.toISOString().split('T')[0]);
				startDate.setDate(startDate.getDate() + 1);
			}

			return result;
		};
		const formatDate = (date: string | number | Date): string[] => {
			if (typeof date === 'string') {
				if (date.toLowerCase() === 'today') {
					const today = new Date();

					return [today.toISOString().split('T')[0]];
				}

				const rangeMatch = date.match(
					/^(\d{4}-\d{2}-\d{2})\s*[^a-zA-Z0-9]*\s*(\d{4}-\d{2}-\d{2})$/,
				);

				if (rangeMatch) {
					const [_, start, end] = rangeMatch;

					return selectionDatesMode === 'multiple-ranged'
						? [start, end]
						: expandDateRange(start.trim(), end.trim());
				}

				return [date];
			} else if (typeof date === 'number') {
				return [new Date(date).toISOString().split('T')[0]];
			} else if (date instanceof Date) {
				return [date.toISOString().split('T')[0]];
			}

			return [];
		};

		return dates.fla
```

### Core Architecture Module: `src/plugins/datepicker/templates-utility.ts`
```
import { ITemplates } from './interfaces';

export const templatesBasedOnUtility: ITemplates = {
	default: (theme: string | boolean = false) =>
		`<div class="--single-month flex flex-col overflow-hidden">
    <div class="grid grid-cols-5 items-center gap-x-3 mx-1.5 pb-3" data-vc="header">
      <div class="col-span-1">
        <#CustomArrowPrev />
      </div>
      <div class="col-span-3 flex justify-center items-center gap-x-1">
        <#CustomMonth />
        <span class="text-gray-800 ${
					theme !== 'light' ? 'dark:text-neutral-200' : ''
				}">/</span>
        <#CustomYear />
      </div>
      <div class="col-span-1 flex justify-end">
        <#CustomArrowNext />
      </div>
    </div>
    <div data-vc="wrapper">
      <div data-vc="content">
        <#Week />
        <#Dates />
      </div>
    </div>
  </div>`,
	multiple: (theme: string | boolean = false) =>
		`<div class="relative flex flex-col overflow-hidden">
    <div class="absolute top-2 inset-s-2">
      <#CustomArrowPrev />
    </div>
    <div class="absolute top-2 inset-e-2">
      <#CustomArrowNext />
    </div>
    <div class="sm:flex" data-vc="grid">
      <#Multiple>
        <div class="p-3 space-y-0.5 --single-month" data-vc="column">
          <div class="pb-3" data-vc="header">
            <div class="flex justify-center items-center gap-x-1" data-vc-header="content">
              <#CustomMonth />
              <span class="text-gray-800 ${
								theme !== 'light' ? 'dark:text-neutral-200' : ''
							}">/</span>
              <#CustomYear />
            </div>
          </div>
          <div data-vc="wrapper">
            <div data-vc="content">
              <#Week />
              <#Dates />
            </div>
          </div>
        </div>
      <#/Multiple>
    </div>
  </div>`,
	year: (theme: string | boolean = false) =>
		`<div class="relative bg-white ${
			theme !== 'light' ? 'dark:bg-neutral-900' : ''
		}" data-vc="header" role="toolbar">
    <div class="grid grid-cols-5 items-center gap-x-3 mx-1.5 py-3" data-vc="header">
      <div class="col-span-1">
        <#CustomArrowPrev />
      </div>
      <div class="col-span-3 flex justify-center items-center gap-x-1">
        <#Month />
        <span class="text-gray-800 ${
					theme !== 'light' ? 'dark:text-neutral-200' : ''
				}">/</span>
        <#Year />
      </div>
      <div class="col-span-1 flex justify-end">
        <#CustomArrowNext />
      </div>
    </div>
  </div>
  <div data-vc="wrapper">
    <div data-vc="content">
      <#Years />
    </div>
  </div>`,
	month: (theme: string | boolean = false) =>
		`<div class="py-3" data-vc="header" role="toolbar">
    <div class="flex justify-center items-center gap-x-1" data-vc-header="content">
      <#Month />
      <span class="text-gray-800 ${
				theme !== 'light' ? 'dark:text-neutral-200' : ''
			}">/</span>
      <#Year />
    </div>
  </div>
  <div data-vc="wrapper">
    <div data-vc="content">
      <#Months />
    </div>
  </div>`,
	// Custom
	years: (options: string, theme: string | boolean = false) => {
		return `<div class="relative">
      <span class="hidden" data-vc="year"></span>
      <select data-hs-select='{
          "placeholder": "Select year",
          "dropdownScope": "parent",
          "dropdownVerticalFixedPlacement": "bottom",
          "toggleTag": "<button type=\\"button\\"><span data-title></span></button>",
          "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex text-nowrap w-full cursor-pointer text-start font-medium text-gray-800 hover:text-gray-600 focus:outline-hidden focus:text-gray-600 before:absolute before:inset-0 before:z-1 ${
						theme !== 'light'
							? 'dark:text-neutral-200 dark:hover:text-neutral-300 dark:focus:text-neutral-300'
							: ''
					}",
          "dropdownClasses": "mt-2 z-50 w-20 max-h-60 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 ${
						theme !== 'light'
							? 'dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 dark:bg-neutral-900 dark:border-neutral-700'
							: ''
					}",
          "optionClasses": "p-2 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden focus:bg-gray-100 ${
						theme !== 'light'
							? 'dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-200 dark:focus:bg-neutral-800'
							: ''
					}",
          "optionTemplate": "<div class=\\"flex justify-between items-center w-full\\"><span data-title></span><span class=\\"hidden hs-selected:block\\"><svg class=\\"shrink-0 size-3.5 text-gray-800 ${
						theme !== 'light' ? 'dark:text-neutral-200' : ''
					}\\" xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"/></svg></span></div>"
        }' class="hidden --year --prevent-on-load-init">
        ${options}
      </select>
    </div>`;
	},
	months: (theme: string | boolean = false) =>
		`<div class="relative">
    <span class="hidden" data-vc="month"></span>
    <select data-hs-select='{
        "placeholder": "Select month",
        "dropdownScope": "parent",
        "dropdownVerticalFixedPlacement": "bottom",
        "toggleTag": "<button type=\\"button\\"><span data-title></span></button>",
        "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex text-nowrap w-full cursor-pointer text-start font-medium text-gray-800 hover:text-gray-600 focus:outline-hidden focus:text-gray-600 before:absolute before:inset-0 before:z-1 ${
					theme !== 'light'
						? 'dark:text-neutral-200 dark:hover:text-neutral-300 dark:focus:text-neutral-300'
						: ''
				}",
        "dropdownClasses": "mt-2 z-50 w-32 max-h-60 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 ${
					theme !== 'light'
						? 'dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 dark:bg-neutral-900 dark:border-neutral-700'
						: ''
				}",
        "optionClasses": "p-2 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg hs-select-disabled:opacity-50 hs-select-disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 ${
					theme !== 'light'
						? 'dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-200 dark:focus:bg-neutral-800'
						: ''
				}",
        "optionTemplate": "<div class=\\"flex justify-between items-center w-full\\"><span data-title></span><span class=\\"hidden hs-selected:block\\"><svg class=\\"shrink-0 size-3.5 text-gray-800 ${
					theme !== 'light' ? 'dark:text-neutral-200' : ''
				}\\" xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"/></svg></span></div>"
      }' class="hidden --month --prevent-on-load-init">
      <option value="0">January</option>
      <option value="1">February</option>
      <option value="2">March</option>
      <option value="3">April</option>
      <option value="4">May</option>
      <option value="5">June</option>
      <option value="6">July</option>
      <option value="7">August</option>
      <option value="8">September</option>
      <option value="9">October</option>
      <option value="10">November</option>
      <option value="11">December</option>
    </select>
  </div>`,
	hours: (theme: string | boolean = false) =>
		`<div class="relative">
    <select class="--hours hidden" data-hs-select='{
      "placeholder": "Select option...",
      "dropdownVerticalFixedPlacement": "top",
      "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-1 px-2 pe-6 flex text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:border-blue-500 focus:ring-blue-500 before:absolute before:inset-0 before:z-1 ${
				theme !== 'light'
					? 'dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400'
					: ''
			}",
      "dropdownClasses": "mt-2 z-50 w-full min-w-24 max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 ${
				theme !== 'light'
					? 'dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 dark:bg-neutral-900 dark:border-neutral-700'
					: ''
			}",
      "optionClasses": "hs-selected:bg-gray-100 ${
				theme !== 'light' ? 'dark:hs-selected:bg-neutral-800' : ''
			} py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden focus:bg-gray-100 ${
				theme !== 'light' ? 'dark:hs-selected:bg-gray-700' : ''
			} ${
				theme !== 'light'
					? 'dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-200 dark:focus:bg-neutral-800'
					: ''
			}",
      "optionTemplate": "<div class=\\"flex justify-between items-center w-full\\"><span data-title></span></div>"
    }'>
      <option value="01">01</option>
      <option value="02">02</option>
      <option value="03">03</option>
      <option value="04">04</option>
      <option value="05">05</option>
      <option value="06">06</option>
      <option value="07">07</option>
      <option value="08">
```

### Core Architecture Module: `src/plugins/dropdown/core.ts`
```
/*
 * HSDropdown
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import {
	afterTransition,
	dispatch,
	getClassProperty,
	getClassPropertyAlt,
	isIOS,
	isIpadOS,
	stringToBoolean,
} from '../../utils';

import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	type Placement,
	type Strategy,
	VirtualElement,
} from '@floating-ui/dom';

import { IDropdown, IHTMLElementFloatingUI } from '../dropdown/interfaces';
import HSBasePlugin from '../base-plugin';
import HSAccessibilityObserver from '../accessibility-manager';
import { ICollectionItem } from '../../interfaces';
import { IAccessibilityComponent } from '../accessibility-manager/interfaces';

import { POSITIONS } from '../../constants';

class HSDropdown
	extends HSBasePlugin<{}, IHTMLElementFloatingUI>
	implements IDropdown
{
	private static globalListenersInitialized = false;

	private accessibilityComponent: IAccessibilityComponent;

	private readonly toggle: HTMLElement | null;
	private readonly closers: HTMLElement[] | null;
	public menu: HTMLElement | null;
	private eventMode: string;
	private closeMode: string;
	private hasAutofocus: boolean;
	private autofocusOnKeyboardOnly: boolean;
	private animationInProcess: boolean;
	private longPressTimer: number | null = null;
	private openedViaKeyboard: boolean = false;

	private onElementMouseEnterListener: () => void | null;
	private onElementMouseLeaveListener: () => void | null;
	private onToggleClickListener: (evt: Event) => void | null;
	private onToggleContextMenuListener: (evt: Event) => void | null;
	private onTouchStartListener: ((evt: TouchEvent) => void) | null = null;
	private onTouchEndListener: ((evt: TouchEvent) => void) | null = null;
	private onCloserClickListener:
		| {
				el: HTMLButtonElement;
				fn: () => void;
		  }[]
		| null;

	constructor(el: IHTMLElementFloatingUI, options?: {}, events?: {}) {
		super(el, options, events);

		this.toggle =
			this.el.querySelector(':scope > .hs-dropdown-toggle') ||
			this.el.querySelector(
				':scope > .hs-dropdown-toggle-wrapper > .hs-dropdown-toggle',
			) ||
			(this.el.children[0] as HTMLElement);
		this.closers =
			Array.from(this.el.querySelectorAll(':scope .hs-dropdown-close')) || null;
		this.menu = this.el.querySelector(':scope > .hs-dropdown-menu');
		this.eventMode = this.getEventMode();
		this.closeMode = getClassProperty(this.el, '--auto-close', 'true');
		this.hasAutofocus = stringToBoolean(
			getClassProperty(this.el, '--has-autofocus', 'true') || 'true',
		);
		this.autofocusOnKeyboardOnly = stringToBoolean(
			getClassProperty(this.el, '--autofocus-on-keyboard-only', 'true') ||
				'true',
		);
		this.animationInProcess = false;

		this.onCloserClickListener = [];

		if (this.toggle && this.menu) this.init();
	}

	private getEventMode(): string {
		const parentDropdown =
			this.el.parentElement?.closest<HTMLElement>('.hs-dropdown');

		if (!parentDropdown) {
			return getClassProperty(this.el, '--trigger', 'click');
		}

		parentDropdown.style.setProperty('--trigger', 'hs-init');
		const computed = getClassProperty(this.el, '--trigger', '');
		parentDropdown.style.removeProperty('--trigger');

		return !computed || computed === 'hs-init' ? 'click' : computed;
	}

	private elementMouseEnter() {
		this.onMouseEnterHandler();
	}

	private elementMouseLeave() {
		this.onMouseLeaveHandler();
	}

	private toggleClick(evt: Event) {
		this.onClickHandler(evt);
	}

	private toggleContextMenu(evt: MouseEvent) {
		evt.preventDefault();

		this.onContextMenuHandler(evt);
	}

	private handleTouchStart(evt: TouchEvent): void {
		evt.preventDefault();

		const touch = evt.touches[0];
		const clientX = touch?.clientX ?? 0;
		const clientY = touch?.clientY ?? 0;

		this.longPressTimer = window.setTimeout(() => {
			const contextMenuEvent = new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				view: window,
				clientX,
				clientY,
			});

			if (this.toggle) this.toggle.dispatchEvent(contextMenuEvent);
		}, 400);
	}

	private handleTouchEnd(evt: TouchEvent): void {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);

			this.longPressTimer = null;
		}
	}

	private closerClick() {
		this.close();
	}

	private init() {
		HSDropdown.ensureGlobalHandlers();
		this.createCollection(window.$hsDropdownCollection, this);

		if ((this.toggle as HTMLButtonElement).disabled) return false;

		if (this.toggle) this.buildToggle();
		if (this.menu) this.buildMenu();
		if (this.closers) this.buildClosers();

		if (!isIOS() && !isIpadOS()) {
			this.onElementMouseEnterListener = () => this.elementMouseEnter();
			this.onElementMouseLeaveListener = () => this.elementMouseLeave();

			this.el.addEventListener('mouseenter', this.onElementMouseEnterListener);
			this.el.addEventListener('mouseleave', this.onElementMouseLeaveListener);
		}

		if (typeof window !== 'undefined') {
			if (!window.HSAccessibilityObserver) {
				window.HSAccessibilityObserver = new HSAccessibilityObserver();
			}
			this.setupAccessibility();
		}
	}

	resizeHandler() {
		this.eventMode = this.getEventMode();
		this.closeMode = getClassProperty(this.el, '--auto-close', 'true');
		this.hasAutofocus = stringToBoolean(
			getClassProperty(this.el, '--has-autofocus', 'true') || 'true',
		);
		this.autofocusOnKeyboardOnly = stringToBoolean(
			getClassProperty(this.el, '--autofocus-on-keyboard-only', 'true') ||
				'true',
		);
	}

	private isOpen(): boolean {
		return (
			this.el.classList.contains('open') &&
			!this.menu.classList.contains('hidden')
		);
	}

	private buildToggle() {
		if (this?.toggle?.ariaExpanded) {
			if (this.el.classList.contains('open')) this.toggle.ariaExpanded = 'true';
			else this.toggle.ariaExpanded = 'false';
		}

		if (this.eventMode === 'contextmenu') {
			this.onToggleContextMenuListener = (evt: MouseEvent) =>
				this.toggleContextMenu(evt);
			this.onTouchStartListener = this.handleTouchStart.bind(this);
			this.onTouchEndListener = this.handleTouchEnd.bind(this);

			this.toggle.addEventListener(
				'contextmenu',
				this.onToggleContextMenuListener,
			);
			this.toggle.addEventListener('touchstart', this.onTouchStartListener, {
				passive: false,
			});
			this.toggle.addEventListener('touchend', this.onTouchEndListener);
			this.toggle.addEventListener('touchmove', this.onTouchEndListener);
		} else {
			this.onToggleClickListener = (evt) => this.toggleClick(evt);

			this.toggle.addEventListener('click', this.onToggleClickListener);
		}
	}

	private buildMenu() {
		this.menu.role = this.menu.getAttribute('role') || 'menu';
		this.menu.tabIndex = -1;

		const checkboxes = this.menu.querySelectorAll('[role="menuitemcheckbox"]');
		const radiobuttons = this.menu.querySelectorAll('[role="menuitemradio"]');

		checkboxes.forEach((el: HTMLElement) =>
			el.addEventListener('click', () => this.selectCheckbox(el)),
		);
		radiobuttons.forEach((el: HTMLElement) =>
			el.addEventListener('click', () => this.selectRadio(el)),
		);

		this.menu.addEventListener('click', (evt) => {
			const target = evt.target as HTMLElement;

			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.tagName === 'BUTTON' ||
				target.tagName === 'A' ||
				target.closest('button') ||
				target.closest('a') ||
				target.closest('input') ||
				target.closest('textarea') ||
				target.closest('select')
			) {
				return;
			}

			this.menu.focus();
		});
	}

	private buildClosers() {
		this.closers.forEach((el: HTMLButtonElement) => {
			this.onCloserClickListener.push({
				el,
				fn: () => this.closerClick(),
			});

			el.addEventListener(
				'click',
				this.onCloserClickListener.find((closer) => closer.el === el).fn,
			);
		});
	}

	private getScrollbarSize() {
		let div = document.createElement('div');
		div.style.overflow = 'scroll';
		div.style.width = '100px';
		div.style.height = '100px';
		document.body.appendChild(div);

		let scrollbarSize = div.offsetWidth - div.clientWidth;

		document.body.removeChild(div);

		return scrollbarSize;
	}

	private onContextMenuHandler(evt: MouseEvent) {
		const virtualElement: VirtualElement = {
			getBoundingClientRect: () => new DOMRect(),
		};
		virtualElement.getBoundingClientRect = () =>
			new DOMRect(evt.clientX, evt.clientY, 0, 0);

		HSDropdown.closeCurrentlyOpened();

		if (
			this.el.classList.contains('open') &&
			!this.menu.classList.contains('hidden')
		) {
			this.close();

			document.body.style.overflow = '';
			document.body.style.paddingRight = '';
		} else {
			document.body.style.overflow = 'hidden';
			document.body.style.paddingRight = `${this.getScrollbarSize()}px`;

			this.open(virtualElement);
		}
	}

	private onClickHandler(evt: Event) {
		const isMouseHoverTrigger =
			this.eventMode === 'hover' &&
			window.matchMedia('(hover: hover)').matches &&
			(evt as PointerEvent).pointerType === 'mouse';

		if (isMouseHoverTrigger) {
			const el = evt.currentTarget as HTMLElement;
			const isAnchor = el.tagName === 'A';
			const isNavLink =
				isAnchor && el.hasAttribute('href') && el.getAttribute('href') !== '#';

			if (!isNavLink) {
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation?.();
			}

			return false;
		}

		if (
			this.el.classList.contains('open') &&
			!this.menu.classList.contains('hidden')
		) {
			this.close();
		} else {
			this.open();
		}
	}

	private onMouseEnterHandler() {
		if (this.eventMode !== 'hover') return false;

		if (
			!this.el._floatingUI ||
			(this.el._floatingUI && !this.el.classList.contains('open'))
		)
			this.forceClearState();

		if (
			!this.el.classList.contains('open') &&
			this.menu.classList.contains('hidden')
		) {
			this.open();
		}
	}

	private onMouseLeaveHandler() {
		if (this.eventMode !== 'hover') return false;

		if (
			this.el.classList.contains('open') &&
	
```

### Core Architecture Module: `src/plugins/file-upload/core.ts`
```
/*
 * HSFileUpload
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { DropzoneFile } from 'dropzone';

import { htmlToElement, classToClassList } from '../../utils';

import { IFileUploadOptions, IFileUpload } from '../file-upload/interfaces';

import HSBasePlugin from '../base-plugin';

declare var _: any;
declare var Dropzone: any;

if (typeof Dropzone !== 'undefined') Dropzone.autoDiscover = false;

class HSFileUpload
	extends HSBasePlugin<IFileUploadOptions>
	implements IFileUpload
{
	private concatOptions: IFileUploadOptions;
	private previewTemplate: string;
	private extensions: any = {};
	private singleton: boolean;

	public dropzone: Dropzone | null;

	private onReloadButtonClickListener:
		| {
				el: Element;
				fn: (evt: MouseEvent) => void;
		  }[]
		| null;
	private onTempFileInputChangeListener:
		| {
				el: HTMLElement;
				fn: (event: Event) => void;
		  }[]
		| null;

	constructor(el: HTMLElement, options?: IFileUploadOptions, events?: {}) {
		super(el, options, events);

		this.el = typeof el === 'string' ? document.querySelector(el) : el;

		const data = this.el.getAttribute('data-hs-file-upload');
		const dataOptions: IFileUploadOptions = data ? JSON.parse(data) : {};

		this.previewTemplate =
			this.el.querySelector('[data-hs-file-upload-preview]')?.innerHTML ||
			`<div class="p-3 bg-white border border-solid border-gray-300 rounded-xl dark:bg-neutral-800 dark:border-neutral-600">
			<div class="mb-2 flex justify-between items-center">
				<div class="flex items-center gap-x-3">
					<span class="size-8 flex justify-center items-center border border-gray-200 text-gray-500 rounded-lg dark:border-neutral-700 dark:text-neutral-500" data-hs-file-upload-file-icon></span>
					<div>
						<p class="text-sm font-medium text-gray-800 dark:text-white">
							<span class="truncate inline-block max-w-75 align-bottom" data-hs-file-upload-file-name></span>.<span data-hs-file-upload-file-ext></span>
						</p>
						<p class="text-xs text-gray-500 dark:text-neutral-500" data-hs-file-upload-file-size></p>
					</div>
				</div>
				<div class="inline-flex items-center gap-x-2">
					<button type="button" class="text-gray-500 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-neutral-200" data-hs-file-upload-remove>
						<svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
					</button>
				</div>
			</div>
			<div class="flex items-center gap-x-3 whitespace-nowrap">
				<div class="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-neutral-700" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" data-hs-file-upload-progress-bar>
					<div class="flex flex-col justify-center rounded-full overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap transition-all duration-500 hs-file-upload-complete:bg-green-600 dark:bg-blue-500" style="width: 0" data-hs-file-upload-progress-bar-pane></div>
				</div>
				<div class="w-10 text-end">
					<span class="text-sm text-gray-800 dark:text-white">
						<span data-hs-file-upload-progress-bar-value>0</span>%
					</span>
				</div>
			</div>
		</div>`;
		this.extensions = _.merge(
			{
				default: {
					icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
					class: 'size-5',
				},
				xls: {
					icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.0243 1.43996H7.08805C6.82501 1.43996 6.57277 1.54445 6.38677 1.73043C6.20077 1.91642 6.09631 2.16868 6.09631 2.43171V6.64796L15.0243 11.856L19.4883 13.7398L23.9523 11.856V6.64796L15.0243 1.43996Z" fill="#21A366"></path><path d="M6.09631 6.64796H15.0243V11.856H6.09631V6.64796Z" fill="#107C41"></path><path d="M22.9605 1.43996H15.0243V6.64796H23.9523V2.43171C23.9523 2.16868 23.8478 1.91642 23.6618 1.73043C23.4758 1.54445 23.2235 1.43996 22.9605 1.43996Z" fill="#33C481"></path><path d="M15.0243 11.856H6.09631V21.2802C6.09631 21.5433 6.20077 21.7955 6.38677 21.9815C6.57277 22.1675 6.82501 22.272 7.08805 22.272H22.9606C23.2236 22.272 23.4759 22.1675 23.6618 21.9815C23.8478 21.7955 23.9523 21.5433 23.9523 21.2802V17.064L15.0243 11.856Z" fill="#185C37"></path><path d="M15.0243 11.856H23.9523V17.064H15.0243V11.856Z" fill="#107C41"></path><path opacity="0.1" d="M12.5446 5.15996H6.09631V19.296H12.5446C12.8073 19.2952 13.0591 19.1904 13.245 19.0046C13.4308 18.8188 13.5355 18.567 13.5363 18.3042V6.1517C13.5355 5.88892 13.4308 5.63712 13.245 5.4513C13.0591 5.26548 12.8073 5.16074 12.5446 5.15996Z" fill="black"></path><path opacity="0.2" d="M11.8006 5.90396H6.09631V20.04H11.8006C12.0633 20.0392 12.3151 19.9344 12.501 19.7486C12.6868 19.5628 12.7915 19.311 12.7923 19.0482V6.8957C12.7915 6.6329 12.6868 6.38114 12.501 6.19532C12.3151 6.0095 12.0633 5.90475 11.8006 5.90396Z" fill="black"></path><path opacity="0.2" d="M11.8006 5.90396H6.09631V18.552H11.8006C12.0633 18.5512 12.3151 18.4464 12.501 18.2606C12.6868 18.0748 12.7915 17.823 12.7923 17.5602V6.8957C12.7915 6.6329 12.6868 6.38114 12.501 6.19532C12.3151 6.0095 12.0633 5.90475 11.8006 5.90396Z" fill="black"></path><path opacity="0.2" d="M11.0566 5.90396H6.09631V18.552H11.0566C11.3193 18.5512 11.5711 18.4464 11.757 18.2606C11.9428 18.0748 12.0475 17.823 12.0483 17.5602V6.8957C12.0475 6.6329 11.9428 6.38114 11.757 6.19532C11.5711 6.0095 11.3193 5.90475 11.0566 5.90396Z" fill="black"></path><path d="M1.13604 5.90396H11.0566C11.3195 5.90396 11.5718 6.00842 11.7578 6.19442C11.9438 6.38042 12.0483 6.63266 12.0483 6.8957V16.8162C12.0483 17.0793 11.9438 17.3315 11.7578 17.5175C11.5718 17.7035 11.3195 17.808 11.0566 17.808H1.13604C0.873012 17.808 0.620754 17.7035 0.434765 17.5175C0.248775 17.3315 0.144287 17.0793 0.144287 16.8162V6.8957C0.144287 6.63266 0.248775 6.38042 0.434765 6.19442C0.620754 6.00842 0.873012 5.90396 1.13604 5.90396Z" fill="#107C41"></path><path d="M2.77283 15.576L5.18041 11.8455L2.9752 8.13596H4.74964L5.95343 10.5071C6.06401 10.7318 6.14015 10.8994 6.18185 11.01H6.19745C6.27683 10.8305 6.35987 10.6559 6.44669 10.4863L7.73309 8.13596H9.36167L7.09991 11.8247L9.41897 15.576H7.68545L6.29489 12.972C6.22943 12.861 6.17387 12.7445 6.12899 12.6238H6.10817C6.06761 12.7419 6.01367 12.855 5.94748 12.9608L4.51676 15.576H2.77283Z" fill="white"></path></svg>',
					class: 'size-5',
				},
				doc: {
					icon: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.6141 1.91994H9.45071C9.09999 1.91994 8.76367 2.05926 8.51567 2.30725C8.26767 2.55523 8.12839 2.89158 8.12839 3.24228V8.86395L20.0324 12.3359L31.9364 8.86395V3.24228C31.9364 2.89158 31.797 2.55523 31.549 2.30725C31.3011 2.05926 30.9647 1.91994 30.6141 1.91994Z" fill="#41A5EE"></path><path d="M31.9364 8.86395H8.12839V15.8079L20.0324 19.2799L31.9364 15.8079V8.86395Z" fill="#2B7CD3"></path><path d="M31.9364 15.8079H8.12839V22.7519L20.0324 26.2239L31.9364 22.7519V15.8079Z" fill="#185ABD"></path><path d="M31.9364 22.752H8.12839V28.3736C8.12839 28.7244 8.26767 29.0607 8.51567 29.3087C8.76367 29.5567 9.09999 29.696 9.45071 29.696H30.6141C30.9647 29.696 31.3011 29.5567 31.549 29.3087C31.797 29.0607 31.9364 28.7244 31.9364 28.3736V22.752Z" fill="#103F91"></path><path opacity="0.1" d="M16.7261 6.87994H8.12839V25.7279H16.7261C17.0764 25.7269 17.4121 25.5872 17.6599 25.3395C17.9077 25.0917 18.0473 24.756 18.0484 24.4056V8.20226C18.0473 7.8519 17.9077 7.51616 17.6599 7.2684C17.4121 7.02064 17.0764 6.88099 16.7261 6.87994Z" class="fill-black dark:fill-neutral-200" fill="currentColor"></path><path opacity="0.2" d="M15.7341 7.87194H8.12839V26.7199H15.7341C16.0844 26.7189 16.4201 26.5792 16.6679 26.3315C16.9157 26.0837 17.0553 25.748 17.0564 25.3976V9.19426C17.0553 8.84386 16.9157 8.50818 16.6679 8.26042C16.4201 8.01266 16.0844 7.87299 15.7341 7.87194Z" class="fill-black dark:fill-neutral-200" fill="currentColor"></path><path opacity="0.2" d="M15.7341 7.87194H8.12839V24.7359H15.7341C16.0844 24.7349 16.4201 24.5952 16.6679 24.3475C16.9157 24.0997 17.0553 23.764 17.0564 23.4136V9.19426C17.0553 8.84386 16.9157 8.50818 16.6679 8.26042C16.4201 8.01266 16.0844 7.87299 15.7341 7.87194Z" class="fill-black dark:fill-neutral-200" fill="currentColor"></path><path opacity="0.2" d="M14.7421 7.87194H8.12839V24.7359H14.7421C15.0924 24.7349 15.4281 24.5952 15.6759 24.3475C15.9237 24.0997 16.0633 23.764 16.0644 23.4136V9.19426C16.0633 8.84386 15.9237 8.50818 15.6759 8.26042C15.4281 8.01266 15.0924 7.87299 14.7421 7.87194Z" class="fill-black dark:fill-neutral-200" fill="currentColor"></path><path d="M1.51472 7.87194H14.7421C15.0927 7.87194 15.4291 8.01122 15.6771 8.25922C15.925 8.50722 16.0644 8.84354 16.0644 9.19426V22.4216C16.0644 22.7723 15.925 23.1087 15.6771 23.3567C15.4291 23.6047 15.0927 23.7439 14.7421 23.7439H1.51472C1.16401 23.7439 0.827669 23.6047 0.579687 23.3567C0.3317 23.1087 0.192383 22.7723 0.192383 22.4216V9.19426C0.192383 8.84354 0.3317 8.50722 0.579687 8.25922C0.827669 8.01122 1.16401 7.87194 1.51472 7.87194Z" fill="#185ABD"></path><path d="M12.0468 20.7679H10.2612L8.17801 13.9231L5.99558 20.7679H4.20998L2.22598 10.8479H4.01158L5.40038 17.7919L7.48358 11.0463H8.97161L10.9556 17.7919L12.3444 10.8479H14.0308L12.0468 20.7679Z" fill="white"></path></svg>',
					class: 'size-5',
				},
				zip: {
	
```

### Core Architecture Module: `src/plugins/input-number/core.ts`
```
/*
 * HSInputNumber
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

import { dispatch } from '../../utils';

import { IInputNumber, IInputNumberOptions } from '../input-number/interfaces';

import HSBasePlugin from '../base-plugin';

class HSInputNumber
	extends HSBasePlugin<IInputNumberOptions>
	implements IInputNumber
{
	private readonly input: HTMLInputElement | null;
	private readonly increment: HTMLElement | null;
	private readonly decrement: HTMLElement | null;
	private inputValue: number | null;
	private readonly minInputValue: number | null;
	private readonly maxInputValue: number | null;
	private readonly step: number;
	private readonly forceBlankValue: boolean;

	private onInputInputListener: () => void;
	private onIncrementClickListener: () => void;
	private onDecrementClickListener: () => void;

	constructor(el: HTMLElement, options?: IInputNumberOptions) {
		super(el, options);

		this.input = this.el.querySelector('[data-hs-input-number-input]') || null;
		this.increment =
			this.el.querySelector('[data-hs-input-number-increment]') || null;
		this.decrement =
			this.el.querySelector('[data-hs-input-number-decrement]') || null;

		const data = this.el.dataset.hsInputNumber;
		const dataOptions: IInputNumberOptions = data
			? JSON.parse(data)
			: { step: 1 };
		const concatOptions = {
			...dataOptions,
			...options,
		};

		this.minInputValue = 'min' in concatOptions ? concatOptions.min : 0;
		this.maxInputValue = 'max' in concatOptions ? concatOptions.max : null;
		this.step =
			'step' in concatOptions && concatOptions.step > 0
				? concatOptions.step
				: 1;
		this.forceBlankValue =
			'forceBlankValue' in concatOptions
				? concatOptions.forceBlankValue
				: false;

		if (this.input) this.checkIsNumberAndConvert();

		this.init();
	}

	private inputInput() {
		this.changeValue();
	}

	private incrementClick() {
		this.changeValue('increment');
	}

	private decrementClick() {
		this.changeValue('decrement');
	}

	private init() {
		this.createCollection(window.$hsInputNumberCollection, this);

		if (this.input && this.increment) this.build();
	}

	private checkIsNumberAndConvert() {
		const value = this.input.value.trim();
		const cleanedValue = this.cleanAndExtractNumber(value);

		if (cleanedValue !== null) {
			this.inputValue = cleanedValue;
			this.input.value = cleanedValue.toString();
		} else {
			if (!this.forceBlankValue) {
				this.inputValue = 0;
				this.input.value = '0';
			}
		}
	}

	private cleanAndExtractNumber(value: string): number | null {
		const cleanedArray: string[] = [];
		let decimalFound = false;
		let negativeFound = false;

		value.split('').forEach((char, index) => {
			if (char >= '0' && char <= '9') cleanedArray.push(char);
			else if (char === '.' && !decimalFound) {
				cleanedArray.push(char);

				decimalFound = true;
			} else if (char === '-' && !negativeFound && cleanedArray.length === 0) {
				cleanedArray.push(char);

				negativeFound = true;
			}
		});

		const cleanedValue = cleanedArray.join('');
		const number = parseFloat(cleanedValue);

		return isNaN(number) ? null : number;
	}

	private build() {
		if (this.input) this.buildInput();
		if (this.increment) this.buildIncrement();
		if (this.decrement) this.buildDecrement();

		if (this.inputValue <= this.minInputValue) {
			this.inputValue = this.minInputValue;
			this.input.value = `${this.minInputValue}`;
		}

		if (this.inputValue <= this.minInputValue) this.changeValue();

		if (this.input.hasAttribute('disabled')) this.disableButtons();
	}

	private buildInput() {
		this.onInputInputListener = () => this.inputInput();

		this.input.addEventListener('input', this.onInputInputListener);
	}

	private buildIncrement() {
		this.onIncrementClickListener = () => this.incrementClick();

		this.increment.addEventListener('click', this.onIncrementClickListener);
	}

	private buildDecrement() {
		this.onDecrementClickListener = () => this.decrementClick();

		this.decrement.addEventListener('click', this.onDecrementClickListener);
	}

	private changeValue(event = 'none') {
		const payload = { inputValue: this.inputValue };
		const minInputValue = this.minInputValue ?? Number.MIN_SAFE_INTEGER;
		const maxInputValue = this.maxInputValue ?? Number.MAX_SAFE_INTEGER;

		this.inputValue = isNaN(this.inputValue) ? 0 : this.inputValue;

		switch (event) {
			case 'increment':
				const incrementedResult = this.inputValue + this.step;
				this.inputValue =
					incrementedResult >= minInputValue &&
					incrementedResult <= maxInputValue
						? incrementedResult
						: maxInputValue;
				this.input.value = this.inputValue.toString();
				break;
			case 'decrement':
				const decrementedResult = this.inputValue - this.step;
				this.inputValue =
					decrementedResult >= minInputValue &&
					decrementedResult <= maxInputValue
						? decrementedResult
						: minInputValue;
				this.input.value = this.inputValue.toString();
				break;
			default:
				const defaultResult = isNaN(parseInt(this.input.value))
					? 0
					: parseInt(this.input.value);
				this.inputValue =
					defaultResult >= maxInputValue
						? maxInputValue
						: defaultResult <= minInputValue
							? minInputValue
							: defaultResult;

				this.input.value = this.inputValue.toString();

				break;
		}

		payload.inputValue = this.inputValue;

		if (this.inputValue === minInputValue) {
			this.el.classList.add('disabled');
			if (this.decrement) this.disableButtons('decrement');
		} else {
			this.el.classList.remove('disabled');
			if (this.decrement) this.enableButtons('decrement');
		}
		if (this.inputValue === maxInputValue) {
			this.el.classList.add('disabled');
			if (this.increment) this.disableButtons('increment');
		} else {
			this.el.classList.remove('disabled');
			if (this.increment) this.enableButtons('increment');
		}

		this.fireEvent('change', payload);
		dispatch('change.hs.inputNumber', this.el, payload);
	}

	private disableButtons(mode = 'all') {
		if (mode === 'all') {
			if (
				this.increment.tagName === 'BUTTON' ||
				this.increment.tagName === 'INPUT'
			) {
				this.increment.setAttribute('disabled', 'disabled');
			}
			if (
				this.decrement.tagName === 'BUTTON' ||
				this.decrement.tagName === 'INPUT'
			) {
				this.decrement.setAttribute('disabled', 'disabled');
			}
		} else if (mode === 'increment') {
			if (
				this.increment.tagName === 'BUTTON' ||
				this.increment.tagName === 'INPUT'
			) {
				this.increment.setAttribute('disabled', 'disabled');
			}
		} else if (mode === 'decrement') {
			if (
				this.decrement.tagName === 'BUTTON' ||
				this.decrement.tagName === 'INPUT'
			) {
				this.decrement.setAttribute('disabled', 'disabled');
			}
		}
	}

	private enableButtons(mode = 'all') {
		if (mode === 'all') {
			if (
				this.increment.tagName === 'BUTTON' ||
				this.increment.tagName === 'INPUT'
			) {
				this.increment.removeAttribute('disabled');
			}
			if (
				this.decrement.tagName === 'BUTTON' ||
				this.decrement.tagName === 'INPUT'
			) {
				this.decrement.removeAttribute('disabled');
			}
		} else if (mode === 'increment') {
			if (
				this.increment.tagName === 'BUTTON' ||
				this.increment.tagName === 'INPUT'
			) {
				this.increment.removeAttribute('disabled');
			}
		} else if (mode === 'decrement') {
			if (
				this.decrement.tagName === 'BUTTON' ||
				this.decrement.tagName === 'INPUT'
			) {
				this.decrement.removeAttribute('disabled');
			}
		}
	}

	// Public methods
	public destroy() {
		// Remove classes
		this.el.classList.remove('disabled');

		// Remove attributes
		this.increment.removeAttribute('disabled');
		this.decrement.removeAttribute('disabled');

		// Remove listeners
		this.input.removeEventListener('input', this.onInputInputListener);
		this.increment.removeEventListener('click', this.onIncrementClickListener);
		this.decrement.removeEventListener('click', this.onDecrementClickListener);

		window.$hsInputNumberCollection = window.$hsInputNumberCollection.filter(
			({ element }) => element.el !== this.el,
		);
	}

	// Global method
	static getInstance(target: HTMLElement | string, isInstance?: boolean) {
		const elInCollection = window.$hsInputNumberCollection.find(
			(el) =>
				el.element.el ===
				(typeof target === 'string' ? document.querySelector(target) : target),
		);

		return elInCollection
			? isInstance
				? elInCollection
				: elInCollection.element
			: null;
	}

	static autoInit() {
		if (!window.$hsInputNumberCollection) window.$hsInputNumberCollection = [];

		if (window.$hsInputNumberCollection) {
			window.$hsInputNumberCollection = window.$hsInputNumberCollection.filter(
				({ element }) => document.contains(element.el),
			);
		}

		document
			.querySelectorAll('[data-hs-input-number]:not(.--prevent-on-load-init)')
			.forEach((el: HTMLElement) => {
				if (
					!window.$hsInputNumberCollection.find(
						(elC) => (elC?.element?.el as HTMLElement) === el,
					)
				) {
					new HSInputNumber(el);
				}
			});
	}
}

export default HSInputNumber;

```

### Core Architecture Module: `src/plugins/layout-splitter/core.ts`
```
/*
 * HSLayoutSplitter
 * @version: 5.0.0
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */
import { isJson, classToClassList, htmlToElement, dispatch } from '../../utils';

import {
	ILayoutSplitterOptions,
	ILayoutSplitter,
	ISingleLayoutSplitter,
	IControlLayoutSplitter,
} from './interfaces';

import HSBasePlugin from '../base-plugin';
import { ICollectionItem } from '../../interfaces';

class HSLayoutSplitter
	extends HSBasePlugin<ILayoutSplitterOptions>
	implements ILayoutSplitter
{
	static isListenersInitialized = false;
	static isWindowListenersInitialized = false;

	private readonly horizontalSplitterClasses: string | null;
	private readonly horizontalSplitterTemplate: string;
	private readonly verticalSplitterClasses: string | null;
	private readonly verticalSplitterTemplate: string;
	private readonly isSplittersAddedManually: boolean;

	private horizontalSplitters: ISingleLayoutSplitter[];
	private horizontalControls: IControlLayoutSplitter[];
	private verticalSplitters: ISingleLayoutSplitter[];
	private verticalControls: IControlLayoutSplitter[];

	isDragging: boolean;
	activeSplitter: IControlLayoutSplitter | null;

	private onControlPointerDownListener:
		| {
				el: HTMLElement;
				fn: () => void;
		  }[]
		| null;

	constructor(el: HTMLElement, options?: ILayoutSplitterOptions) {
		super(el, options);

		const data = el.getAttribute('data-hs-layout-splitter');
		const dataOptions: ILayoutSplitterOptions = data ? JSON.parse(data) : {};
		const concatOptions = {
			...dataOptions,
			...options,
		};

		this.horizontalSplitterClasses =
			concatOptions?.horizontalSplitterClasses || null;
		this.horizontalSplitterTemplate =
			concatOptions?.horizontalSplitterTemplate || '<div></div>';
		this.verticalSplitterClasses =
			concatOptions?.verticalSplitterClasses || null;
		this.verticalSplitterTemplate =
			concatOptions?.verticalSplitterTemplate || '<div></div>';
		this.isSplittersAddedManually =
			concatOptions?.isSplittersAddedManually ?? false;

		this.horizontalSplitters = [];
		this.horizontalControls = [];
		this.verticalSplitters = [];
		this.verticalControls = [];

		this.isDragging = false;
		this.activeSplitter = null;

		this.onControlPointerDownListener = [];

		this.init();
	}

	private controlPointerDown(item: IControlLayoutSplitter) {
		this.isDragging = true;
		this.activeSplitter = item;

		this.onPointerDownHandler(item);
	}

	private controlPointerUp() {
		this.isDragging = false;
		this.activeSplitter = null;

		this.onPointerUpHandler();
	}

	private static onDocumentPointerMove = (evt: PointerEvent) => {
		const draggingElement = document.querySelector(
			'.hs-layout-splitter-control.dragging',
		);
		if (!draggingElement) return;

		const draggingInstance = HSLayoutSplitter.getInstance(
			draggingElement.closest('[data-hs-layout-splitter]') as HTMLElement,
			true,
		) as ICollectionItem<HSLayoutSplitter>;

		if (!draggingInstance || !draggingInstance.element.isDragging) return;

		const activeSplitter = draggingInstance.element.activeSplitter;
		if (!activeSplitter) return;

		if (activeSplitter.direction === 'vertical')
			draggingInstance.element.onPointerMoveHandler(
				evt,
				activeSplitter,
				'vertical',
			);
		else
			draggingInstance.element.onPointerMoveHandler(
				evt,
				activeSplitter,
				'horizontal',
			);
	};

	private static onDocumentPointerUp = () => {
		const draggingElement = document.querySelector(
			'.hs-layout-splitter-control.dragging',
		);
		if (!draggingElement) return;

		const draggingInstance = HSLayoutSplitter.getInstance(
			draggingElement.closest('[data-hs-layout-splitter]') as HTMLElement,
			true,
		) as ICollectionItem<HSLayoutSplitter>;

		if (draggingInstance) draggingInstance.element.controlPointerUp();
	};

	private init() {
		HSLayoutSplitter.ensureGlobalHandlers();
		this.createCollection(window.$hsLayoutSplitterCollection, this);
		this.buildSplitters();

		if (!HSLayoutSplitter.isListenersInitialized) {
			document.addEventListener(
				'pointermove',
				HSLayoutSplitter.onDocumentPointerMove,
			);

			document.addEventListener(
				'pointerup',
				HSLayoutSplitter.onDocumentPointerUp,
			);

			HSLayoutSplitter.isListenersInitialized = true;
		}
	}

	private buildSplitters() {
		this.buildHorizontalSplitters();
		this.buildVerticalSplitters();
	}

	private buildHorizontalSplitters() {
		const groups = this.el.querySelectorAll(
			'[data-hs-layout-splitter-horizontal-group]',
		);

		if (groups.length) {
			groups.forEach((el: HTMLElement) => {
				this.horizontalSplitters.push({
					el,
					items: Array.from(
						el.querySelectorAll(':scope > [data-hs-layout-splitter-item]'),
					),
				});
			});

			this.updateHorizontalSplitter();
		}
	}

	private buildVerticalSplitters() {
		const groups = this.el.querySelectorAll(
			'[data-hs-layout-splitter-vertical-group]',
		);

		if (groups.length) {
			groups.forEach((el: HTMLElement) => {
				this.verticalSplitters.push({
					el,
					items: Array.from(
						el.querySelectorAll(':scope > [data-hs-layout-splitter-item]'),
					),
				});
			});

			this.updateVerticalSplitter();
		}
	}

	private buildControl(
		prev: HTMLElement | null,
		next: HTMLElement | null,
		direction: 'horizontal' | 'vertical' = 'horizontal',
	) {
		let el;

		if (this.isSplittersAddedManually) {
			el = next?.previousElementSibling as HTMLElement;

			if (!el) return false;

			el.style.display = '';
		} else {
			el = htmlToElement(
				direction === 'horizontal'
					? this.horizontalSplitterTemplate
					: this.verticalSplitterTemplate,
			) as HTMLElement;
			classToClassList(
				direction === 'horizontal'
					? this.horizontalSplitterClasses
					: this.verticalSplitterClasses,
				el,
			);
			el.classList.add('hs-layout-splitter-control');
		}

		const item = { el, direction, prev, next };

		if (direction === 'horizontal') this.horizontalControls.push(item);
		else this.verticalControls.push(item);

		this.bindListeners(item);

		if (next && !this.isSplittersAddedManually)
			prev.insertAdjacentElement('afterend', el);
	}

	private getSplitterItemParsedParam(item: HTMLElement) {
		const param = item.getAttribute('data-hs-layout-splitter-item');

		return isJson(param) ? JSON.parse(param) : param;
	}

	private getContainerSize(container: Element, isHorizontal: boolean): number {
		return isHorizontal
			? container.getBoundingClientRect().width
			: container.getBoundingClientRect().height;
	}

	private getMaxFlexSize(
		element: HTMLElement,
		param: string,
		totalWidth: number,
	): number {
		const paramValue = this.getSplitterItemSingleParam(element, param);

		return typeof paramValue === 'number' ? (paramValue / 100) * totalWidth : 0;
	}

	private updateHorizontalSplitter() {
		this.horizontalSplitters.forEach(({ items }) => {
			items.forEach((el: HTMLElement) => {
				this.updateSingleSplitter(el);
			});

			items.forEach((el: HTMLElement, index: number) => {
				if (index >= items.length - 1) this.buildControl(el, null);
				else this.buildControl(el, items[index + 1]);
			});
		});
	}

	private updateSingleSplitter(el: HTMLElement) {
		const param = el.getAttribute('data-hs-layout-splitter-item');
		const parsedParam = isJson(param) ? JSON.parse(param) : param;
		const width = isJson(param) ? parsedParam.dynamicSize : param;
		el.style.flex = `${width} 1 0`;
	}

	private updateVerticalSplitter() {
		this.verticalSplitters.forEach(({ items }) => {
			items.forEach((el: HTMLElement) => {
				this.updateSingleSplitter(el);
			});

			items.forEach((el: HTMLElement, index: number) => {
				if (index >= items.length - 1) this.buildControl(el, null, 'vertical');
				else this.buildControl(el, items[index + 1], 'vertical');
			});
		});
	}

	private updateSplitterItemParam(item: HTMLElement, newSize: number) {
		const param = this.getSplitterItemParsedParam(item);
		const newSizeFixed = newSize.toFixed(1);
		const newParam =
			typeof param === 'object'
				? JSON.stringify({
						...param,
						dynamicSize: +newSizeFixed,
					})
				: newSizeFixed;

		item.setAttribute('data-hs-layout-splitter-item', newParam);
	}

	private onPointerDownHandler(item: IControlLayoutSplitter) {
		const { el, prev, next } = item;

		el.classList.add('dragging');
		prev.classList.add('dragging');
		next.classList.add('dragging');
		document.body.style.userSelect = 'none';
	}

	private onPointerUpHandler() {
		document.body.style.userSelect = '';
	}

	private onPointerMoveHandler(
		evt: PointerEvent,
		item: IControlLayoutSplitter,
		direction: 'horizontal' | 'vertical',
	) {
		const { prev, next } = item;
		const container = item.el.closest(
			direction === 'horizontal'
				? '[data-hs-layout-splitter-horizontal-group]'
				: '[data-hs-layout-splitter-vertical-group]',
		);
		const isHorizontal = direction === 'horizontal';
		const totalSize = this.getContainerSize(container, isHorizontal);
		const availableSize = this.calculateAvailableSize(
			container,
			prev,
			next,
			isHorizontal,
			totalSize,
		);

		const sizes = this.calculateResizedSizes(
			evt,
			prev,
			availableSize,
			isHorizontal,
		);
		const adjustedSizes = this.enforceLimits(
			sizes,
			prev,
			next,
			totalSize,
			availableSize,
		);

		this.applySizes(prev, next, adjustedSizes, totalSize);
	}

	private bindListeners(item: IControlLayoutSplitter) {
		const { el } = item;

		this.onControlPointerDownListener.push({
			el,
			fn: () => this.controlPointerDown(item),
		});

		el.addEventListener(
			'pointerdown',
			this.onControlPointerDownListener.find((control) => control.el === el).fn,
		);
	}

	private calculateAvailableSize(
		container: Element,
		prev: HTMLElement,
		next: HTMLElement,
		isHorizontal: boolean,
		totalSize: number,
	): number {
		const items = container.querySelectorAll(
			':scope > [data-hs-layout-splitter-item]',
		);
		const otherSize = Array.from(items).reduc
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #752** (2026-05-10): **Remote data with tags, error when re selecting a previously selected option after a second search**
  *Symptoms*: ### Summary  When you select a remote option, do a second search, the selected option can not be deselected/reselected   ### Steps to Reproduce  1. Go to https://preline.co/docs/advanced-select.html#remote-data-tags 2. Do a remote search like "Plant" and select the `Plant Pot` option 3. Do **an other** remote search like "Dior". The dropdown should now display 2 options: the `Plant Pot` (selected) and the  `Dior J'adore` option (unslected). 4. Now unselect the `Plant Pot` option in the dropdown (it is removed from the selected tags) 5. And then reselect it 6. Check the browser console  ### Demo Link  https://preline.co/docs/advanced-select.html#remote-data-tags  ### Expected Behavior  I guess the first option should be selected again, OR maybe the first option should not be displayed anymore in the dropdown after being deselected.  ### Actual Behavior  The tag is not added again to the tags selection, and you get the following error in the console       Uncaught TypeError: can't access property "title", h is undefined    ### Screenshots  <img width="1866" height="919" alt="Image" src="https://github.com/user-attachments/assets/0363da10-1a6a-4bc7-9c98-e85d23328fc4" />
  **Post-Mortem & Fix Analysis**:
  > @Tricote Hey, thanks for the detailed report and clear reproduction steps!  This is indeed a bug, the fix will be included in the next release.
  > Hey @Tricote - the fixes is live, please try out the latest version and let us know of you have more feedback. Thanks!

- **Issue #751** (2026-04-13): **[Tailwind] Cannot apply unknown utility class `border-border`**
  *Symptoms*: ### Summary  CSS Tailwind v4 incompatibility  ### Steps to Reproduce  1. Update `@preline/datepicker` to version `v4.1.3` 2. Import `@import "@preline/datepicker/styles.css";` in your app's main CSS file 3. Start vite's dev server and open up the website in your browser  ### Demo Link  –  ### Expected Behavior  Running vite should work and the website should look as before, without errors.  ### Actual Behavior  CSS can't be compiled with the latest version.  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, @aarongerig, thanks for the detailed report!  We have investigated and confirmed that the problem was caused by missing files in the published npm package, specifically `styles-utility.css` and `theme.css`, which were not included in the `@preline/datepicker` bundle prior to this fix.  This has been resolved and published as **v4.1.4**. Please update your package:  ``` npm install @preline/datepicker@latest ``` --- Which CSS file should you import?  The package now ships two distinct stylesheets. Please choose based on your setup:  **Option A**. `styles-utility.css`:  Use this if your project uses standard Tailwind v4 without a custom design token system. It relies exclusively on built-in Tailwind utility classes (`gray-200`, `blue-600`, etc.) and requires no additional configuration.  ``` @import "@preline/datepicker/styles-utility.css"; ```  **Option B**. `theme.css` + `styles.css`:  Use this if you are using the full Preline UI design system. `theme.css` defines the complete set

- **Issue #746** (2026-03-19): **Documentation for Astro integration is outdated and causing build errors (Astro 5)**
  *Symptoms*: ### Summary  The Astro integration documentation is currently outdated and does not work correctly with the latest stable version of Astro (5.x). Following the official guide results in build errors and configuration issues. The documentation needs to be updated to reflect the current Astro ecosystem and modern Vite behavior to ensure a smooth setup process.  ### Steps to Reproduce  **Description**  The current Astro integration guide for Preline UI [https://preline.co/docs/frameworks-astro.html](https://preline.co/docs/frameworks-astro.html)  is outdated and does not work correctly with **Astro 5.x (Vite 5)**.  Following the official documentation results in build/runtime errors related to:  * CSS imports that are not exported by the package (e.g. `variants.css`) * Direct references to `node_modules` in `<script>` tags * Missing clarification about required setup for modern Astro projects  These issues prevent a clean installation using the documented steps and create unnecessary friction for developers trying to adopt Preline with Astro.  ---  **Expected Behavior**  * The Astro documentation should be validated against the latest stable Astro version. * The setup instructions should work without modification. * Examples should follow modern Vite/Astro best practices.  ---  **Impact**  This negatively affects developer experience and gives the impression that Astro is not properly supported, even though the issue appears to be documentation-related.  ---  Please update the A
  **Post-Mortem & Fix Analysis**:
  > +1
  > Hey @alomia, @Hari-Bonda - our team published v4.1.3 release with fix and update the framework guides page with the latest Astro v6.x https://preline.co/docs/frameworks-astro.html  Thanks for reporting the issue!

- **Issue #745** (2026-02-27): **Imports such as HSDropdown are missing after v4.1.1**
  *Symptoms*: Hi,  I have been using in the past such import `import { HSDropdown } from 'preline'` for manually running autoinits and controlling HSOverlays. After updating to v4.1.1, it seems that they are not available anymore? Was this intentional change?  > Uncaught (in promise) SyntaxError: The requested module 'http://127.0.0.1:5176/node_modules/.vite/deps/preline.js?v=a68d2303' doesn't provide an export named: 'HSDropdown'  Currently for example this snippet from docs won't work at all since one can't import the HSDropdown from 'preline'.   ...  ``` const dropdown = new HSDropdown(document.querySelector('#dropdown')); const openBtn = document.querySelector('#open-btn');  openBtn.addEventListener('click', () => {   dropdown.open(); });  ```  Docs also say that "The HSDropdown object is contained within the global window object" but I get error: `can't access property "autoInit", window.HSDropdown is undefined`.  What makes me wonder that when changing all imports to refrerence the window.HSDropdown etc as said in the docks, then preline v4.0.1 works fine but 4.1.1 won't. I hope that the HSDropdown imports etc. are not discontinued since they provided handly methogd autocompletions.   Also there is no notice about any breaking changes in the [changelog](https://preline.co/docs/changelog.html).  Any ideas if I am just understanding this incorrectly or do you have something wrong? Thanks in advance!  Vue 3.5.29, Vite 7.3.1
  **Post-Mortem & Fix Analysis**:
  > Hey @antero111 - thanks for the bug report. We've released v4.1.2 which fixes the issue and added the additional initialization options to [Installation](https://preline.co/docs/index.html) docs.

- **Issue #742** (2026-01-30): **Where are the Preline Themes**
  *Symptoms*: ### Summary  I can't find the themes that Preline UI ships with.  ### Steps to Reproduce  1. Install tailwindcss v4, tailwindcss/cli and preline via npm 2. Import tailwindcss and preline with user stylesheet (in my case, `_includes/styles.css`) 3. Import themes according to the documentation 4. Run tailwindcss/cli: `tailwindcss -i _includes/styles.css -o _site/css/styles.css`  ### Demo Link  https://preline.co/docs/themes.html  ### Expected Behavior  _No response_  ### Actual Behavior  I'm not sure if this is a bug within the UI, an error in the documentation, or me simply overlooking something. In the [Themes section of the documentation](https://preline.co/docs/themes.html), it says that I need to import the base theme and then choose whichever theme I wan:  ```css @import "tailwindcss";  /* Base theme tokens + mappings */ @import "./themes/theme.css";  /* Optional: predefined themes (import only what you need) */ @import "./themes/harvest.css"; @import "./themes/retro.css"; @import "./themes/ocean.css"; @import "./themes/bubblegum.css"; @import "./themes/autumn.css"; @import "./themes/moon.css"; @import "./themes/cashmere.css"; @import "./themes/olive.css"; ```  But Tailwind (and I) "can't resolve" the path.  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey @BravishkaSkytano - thanks for reporting. It seems, we overlooked and missed to add the themes folder. We've just uploaded theme here: https://github.com/htmlstreamofficial/preline/tree/main/css/themes
  > This is still an issue in 4.0.1, I created a react-router app today and added preline, and [the docs](https://preline.co/docs/index.html) tell me to add this line:      @import "./themes/theme.css";  But that path doesn't exist, I had to change it to this so vite finds the themes:      @import "../node_modules/preline/css/themes/theme.css";  Somethings still seems off in the documentation.  Thanks.
  > Hey @dwilches - this issue (v4.0.1) addresses the missing Themes files.  There might be other reasons why you are having an issue in specific Framework.  Please open a separate issue with more details so others are able to debug it.  Thanks!

- **Issue #733** (2026-01-28): **advance select with remote data and initial value not displaying initial value**
  *Symptoms*: ### Summary  advance select with remote data and initial value not displaying initial value  ### Steps to Reproduce  this is a basic select with remote data an initial value  `                <!-- Select -->                 <select                   data-hs-select='{   "apiUrl": "/countries.json",   "apiQuery": "limit=10",   "apiSearchQueryKey": "q",   "apiDataPart": "countries",   "apiFieldsMap": {     "id": "id",     "val": "id",     "title": "title"   },   "isSelectedOptionOnTop": true,   "hasSearch": true,   "searchPlaceholder": "Search countries...",   "searchClasses": "block w-full sm:text-sm border-gray-200 rounded-lg focus:border-blue-500 focus:ring-blue-500 before:absolute before:inset-0 before:z-1 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 py-1.5 sm:py-2 px-3",   "searchWrapperClasses": "bg-white p-2 -mx-1 -mt-1 sticky top-0 dark:bg-neutral-900",   "placeholder": "Select country...",   "toggleTag": "<button type=\"button\" aria-expanded=\"false\"><span class=\"\" data-title></span></button>",   "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-neutral-600",   "dropdownCla
  **Post-Mortem & Fix Analysis**:
  > Would love to see an update on this. Also facing the same issue but could do a workaround calling `.addOption` after the select is initialized to force add the needed initial options.   
  > Our team is looking into it and we will make sure all open issues will be addressed with the upcoming v4.0 release. Thanks!
  > @Rudiney do you have a sample code please? 

- **Issue #710** (2026-01-28): **Advanced Select: <optgroup> groups are not rendered (is it supported?)**
  *Symptoms*: ### Summary `<optgroup>` inside a `<select>`, the groups are not rendered   ### Detailed Description  When using the Advanced Select component with native HTML `<optgroup>` inside a `<select>`, the groups are not rendered (group labels are ignored and items appear ungrouped). Documentation does not clearly state whether <optgroup> is supported by Advanced Select, and I haven’t found an explicit example in the docs. Could you please clarify support status and, if supported, the correct markup/configuration?  Plugin docs (@preline/select): https://preline.co/plugins/html/advanced-select.html HTML <optgroup> semantics  preline version: 3.2.3 Framework: Angular Browser: Chrome    ### Use Cases  Steps to reproduce  Install and initialize Preline and the Advanced Select plugin following the docs  https://preline.co/docs/advanced-select.html https://preline.co/plugins/html/advanced-select.html   Use this minimal markup with an <optgroup>:  ```HTML  <div class="relative">   <select     data-hs-select='{       "hasSearch": true,       "placeholder": "Choose an option..."     }'     class="hidden"   >     <optgroup label="Frontend">       <option value="react">React</option>       <option value="vue">Vue</option>       <option value="svelte">Svelte</option>     </optgroup>      <optgroup label="Backend" disabled>       <option value="node">Node.js</option>       <option value="dotnet">.NET</option>       <option value="java">Java</option>     </optgroup>   </select> </div> ```
  **Post-Mortem & Fix Analysis**:
  > Hi @sureMOISE , have you  solve this issue?
  > Hi, @danielfnz I haven't solved it yet. I found a temporary workaround, but I can confirm that Preline's select component doesn't support the <optgroup> tag.
  > Hey, this is now fixed and live with the Preline UI v4.0 release. Thanks!

- **Issue #708** (2026-01-28): **Input number max value does not behave correctly**
  *Symptoms*: ### Summary  The input number option `data-hs-input-number='{   "max": 10 }` does not limit the typed values but only disables the increase button, contrary to the `min` option that cull values to be inside the defined limits.  ### Steps to Reproduce  1. Go to https://preline.co/docs/input-number.html#maximum-value 2. Type a number higher than 10 (the max value set for that input) 3. Value is kept on the input even when focus is lost, and only the increase button gets disabled  ### Demo Link  https://preline.co/docs/input-number.html#maximum-value  ### Expected Behavior  As it happens with the `min` option [here](https://preline.co/docs/input-number.html#negative-value), the value that the user types should be corrected in real-time to be between the defined limits.  ### Actual Behavior  _No response_  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey @enrico-b-248 - this is now fixed and live with the Preline UI v4.0 release. Thanks!

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

### Incident Patch 1: `8897aad4` (2026-06-26)
**Commit Message**: fix(select): allow relative URLs for advanced select apiUrl

**File**: `src/plugins/select/core.ts` (modified, +7/-1)
```diff
@@ -1610,7 +1610,13 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 
 	private async apiRequest(val = '', signal?: AbortSignal): Promise<any> {
 		try {
-			const url = new URL(this.apiUrl);
+			let url;
+			try {
+				url = new URL(this.apiUrl, window.location.origin);
+			} catch {
+				console.error('Invalid API URL:', this.apiUrl);
+				return null;
+			}
 			const queryParams = new URLSearchParams(this.apiQuery ?? '');
 			const options = this.apiOptions ?? {};
 			const tempOptions = { ...(options as any) } as RequestInit;
```

---

### Incident Patch 2: `87d8528c` (2026-01-27)
**Commit Message**: Merge pull request #735 from haohuynhtn2005/owen/fixbug/emulate-scrollbar

Fix get body current scrollbar size overlay

**File**: `src/plugins/overlay/index.ts` (modified, +6/-12)
```diff
@@ -395,16 +395,10 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 		else input.focus();
 	}
 
-	private getScrollbarSize() {
-		let div = document.createElement("div");
-		div.style.overflow = "scroll";
-		div.style.width = "100px";
-		div.style.height = "100px";
-		document.body.appendChild(div);
-
-		let scrollbarSize = div.offsetWidth - div.clientWidth;
-
-		document.body.removeChild(div);
+	private getBodyCurrentScrollbarSize() {
+		const bodyWidth = parseFloat(getComputedStyle(document.body).width);
+		let scrollbarSize = window.innerWidth - bodyWidth;
+		scrollbarSize = Math.max(scrollbarSize, 0);
 
 		return scrollbarSize;
 	}
@@ -503,10 +497,10 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 		}
 
 		if (disabledScroll) {
-			document.body.style.overflow = "hidden";
 			if (this.emulateScrollbarSpace) {
-				document.body.style.paddingRight = `${this.getScrollbarSize()}px`;
+				document.body.style.paddingRight = `${this.getBodyCurrentScrollbarSize()}px`;
 			}
+			document.body.style.overflow = "hidden";
 		}
 
 		this.buildBackdrop();
```

---

### Incident Patch 3: `fdfa4085` (2026-01-27)
**Commit Message**: Merge pull request #717 from RosnelOn/fix/datepicker-format-separator

fix(datepicker): respect custom separators in dateFormat

**File**: `src/plugins/datepicker/index.ts` (modified, +19/-5)
```diff
@@ -203,10 +203,25 @@ class HSDatepicker extends HSBasePlugin<{}> implements IDatepicker {
 		};
 	}
 
+	/**
+	 * Extracts the separator from a date format string
+	 * @param format - Date format (e.g., "DD-MM-YYYY", "DD/MM/YYYY")
+	 * @returns The first non-alphanumeric character found, or "-" as fallback
+	 */
+	private extractSeparatorFromFormat(format: string): string {
+		const match = format.match(/[^A-Za-z0-9]/);
+		return match ? match[0] : "-";
+	}
+
 	private setInputValue(target: HTMLInputElement, dates: DatesArr) {
 		const dateFormat = this.dataOptions?.dateFormat;
-		const dateSeparator = this.dataOptions?.inputModeOptions?.dateSeparator ??
-			".";
+		// Extract separator from dateFormat if present
+		const extractedSeparator = dateFormat
+			? this.extractSeparatorFromFormat(dateFormat) 
+			: null;
+		const dateSeparator = extractedSeparator 
+			?? this.dataOptions?.inputModeOptions?.dateSeparator 
+			?? "-";
 		const itemsSeparator = this.dataOptions?.inputModeOptions?.itemsSeparator ??
 			", ";
 		const selectionDatesMode = this.dataOptions?.selectionDatesMode ?? "single";
@@ -246,7 +261,7 @@ class HSDatepicker extends HSBasePlugin<{}> implements IDatepicker {
 
 	private changeDateSeparator(
 		date: string | number | Date,
-		separator = ".",
+		separator = "-",
 		defaultSeparator = "-",
 	) {
 		const dateObj = new Date(date);
@@ -796,8 +811,7 @@ class HSDatepicker extends HSBasePlugin<{}> implements IDatepicker {
 		const dateLocale = this.dataOptions?.dateLocale || undefined;
 
 		if (!dateFormat) {
-			const dateSeparator = this.dataOptions?.inputModeOptions?.dateSeparator ??
-				".";
+			const dateSeparator = this.dataOptions?.inputModeOptions?.dateSeparator ?? "-";
 
 			return this.changeDateSeparator(date, dateSeparator);
 		}
```

---

### Incident Patch 4: `d3380aca` (2025-12-11)
**Commit Message**: Fix get body current scrollbar size overlay

**File**: `src/plugins/overlay/index.ts` (modified, +6/-12)
```diff
@@ -395,16 +395,10 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 		else input.focus();
 	}
 
-	private getScrollbarSize() {
-		let div = document.createElement("div");
-		div.style.overflow = "scroll";
-		div.style.width = "100px";
-		div.style.height = "100px";
-		document.body.appendChild(div);
-
-		let scrollbarSize = div.offsetWidth - div.clientWidth;
-
-		document.body.removeChild(div);
+	private getBodyCurrentScrollbarSize() {
+		const bodyWidth = parseFloat(getComputedStyle(document.body).width);
+		let scrollbarSize = window.innerWidth - bodyWidth;
+		scrollbarSize = Math.max(scrollbarSize, 0);
 
 		return scrollbarSize;
 	}
@@ -503,10 +497,10 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 		}
 
 		if (disabledScroll) {
-			document.body.style.overflow = "hidden";
 			if (this.emulateScrollbarSpace) {
-				document.body.style.paddingRight = `${this.getScrollbarSize()}px`;
+				document.body.style.paddingRight = `${this.getBodyCurrentScrollbarSize()}px`;
 			}
+			document.body.style.overflow = "hidden";
 		}
 
 		this.buildBackdrop();
```

---

### Incident Patch 5: `4e735b61` (2025-11-01)
**Commit Message**: docs: fix typo and remove extra spaces in README.md

**File**: `README.md` (modified, +2/-2)
```diff
@@ -46,14 +46,14 @@ For help, discussion about best practices, or any other conversation that would
 
 ## License
 
-Preline UI is free for both personal and commercial projects, released under dual license terms [MIT](https://preline.co/docs/license.html) and [Preline UI Fair Use License](https://preline.co/docs/license.html) , and copyrighted 2024 by Preline Labs Ltd.
+Preline UI is free for both personal and commercial projects, released under dual license terms [MIT](https://preline.co/docs/license.html) and [Preline UI Fair Use License](https://preline.co/docs/license.html), and copyrighted 2024 by Preline Labs Ltd.
 
 Preline UI Figma is free for both commercial and personal projects, learn more [here](https://preline.co/license.html).
   
 All brand icons are trademarks of their respective owners. The use of these trademarks does not indicate endorsement of the trademark holder by Preline UI, nor vice versa.
 
 ## A product of Htmlstream
 
-Preline UI is built and maintend by [Htmlstream](https://htmlstream.com) team. Over the last decade at Htmlstream, our journey has involved crafting UI Components and Templates. This process has allowed us to understand and explore a range of strategies for developing versatile UI designs that can adapt to a variety of needs.
+Preline UI is built and maintained by [Htmlstream](https://htmlstream.com) team. Over the last decade at Htmlstream, our journey has involved crafting UI Components and Templates. This process has allowed us to understand and explore a range of strategies for developing versatile UI designs that can adapt to a variety of needs.
 
 Share your thoughts about Preline on [Twitter](https://x.com/prelineUI) or leave supportive review on [ProductHunt](https://www.producthunt.com/products/preline-ui/reviews).
```

---

### Incident Patch 6: `e353b68c` (2025-10-13)
**Commit Message**: Revert "fix(select): build changes"

This reverts commit 57a7a9a4ca826f1759766d2f4bd48885ba987bdd.

**File**: `dist/datepicker.mjs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-var e={189:(e,t,n)=>{n.d(t,{lP:()=>s});const s={auto:"auto","auto-start":"auto-start","auto-end":"auto-end",top:"top","top-left":"top-start","top-right":"top-end",bottom:"bottom","bottom-left":"bottom-start","bottom-right":"bottom-end",right:"right","right-start":"right-start","right-end":"right-end",left:"left","left-start":"left-start","left-end":"left-end"}},236:(e,t,n)=>{n.d(t,{A:()=>d});var s=n(926),i=n(615),o=n(862),a=n(189),l=function(e,t,n,s){return new(n||(n=Promise))((function(i,o){function a(e){try{r(s.next(e))}catch(e){o(e)}}function l(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(a,l)}r((s=s.apply(e,t||[])).next())}))};class r extends i.A{constructor(e,t){var n,s,i,o,a;super(e,t),this.disabledObserver=null,this.optionId=0;const l=e.getAttribute("data-hs-select"),r=l?JSON.parse(l):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(n=null==d?void 0:d.minSearchLength)&&void 0!==n?n:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOption)
```

**File**: `dist/index.js` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
  * @author: Preline Labs Ltd.
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
- */var s=this&&this.__awaiter||function(e,t,i,s){return new(i||(i=Promise))((function(n,o){function l(e){try{r(s.next(e))}catch(e){o(e)}}function a(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?n(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t)}))).then(l,a)}r((s=s.apply(e,t||[])).next())}))},n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const o=i(292),l=n(i(961)),a=n(i(248)),r=i(223);class d extends l.default{constructor(e,t){var i,s,n,o,l;super(e,t),this.disabledObserver=null,this.optionId=0;const a=e.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(n=null==d?void 0:d.toggleSeparators)||void 0===n?void 0:n.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOption)&&(null==d?void 0:d.optionAllowEmptyOption),thi
```

**File**: `dist/index.mjs` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ class o extends n.A{constructor(e,t){super(e,t);const i=e.getAttribute("data-hs-
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-class o extends n.A{constructor(e,t,i){super(e,t,i),this.items=[];const s=e.getAttribute("data-hs-tree-view"),n=s?JSON.parse(s):{},o=Object.assign(Object.assign({},n),t);this.controlBy=(null==o?void 0:o.controlBy)||"button",this.autoSelectChildren=(null==o?void 0:o.autoSelectChildren)||!1,this.isIndeterminate=(null==o?void 0:o.isIndeterminate)||!0,this.onElementClickListener=[],this.onControlChangeListener=[],this.init()}elementClick(e,t,i){if(e.stopPropagation(),t.classList.contains("disabled"))return!1;e.metaKey||e.shiftKey||this.unselectItem(i),this.selectItem(t,i),this.fireEvent("click",{el:t,data:i}),(0,s.JD)("click.hs.treeView",this.el,{el:t,data:i})}controlChange(e,t){this.autoSelectChildren?(this.selectItem(e,t),t.isDir&&this.selectChildren(e,t),this.toggleParent(e)):this.selectItem(e,t)}init(){this.createCollection(window.$hsTreeViewCollection,this),o.group+=1,this.initItems()}initItems(){this.el.querySelectorAll("[data-hs-tree-view-item]").forEach(((e,t)=>{var i,s;const n=JSON.parse(e.getAttribute("data-hs-tree-view-item"));e.id||(e.id=`tree-view-item-${o.group}-${t}`);const l=Object.assign(Object.assign({},n),{id:null!==(i=n.id)&&void 0!==i?i:e.id,path:this.getPath(e),isSelected:null!==(s=n.isSelected)&&void 0!==s&&s});this.items.push(l),"checkbox"===this.controlBy?this.controlByCheckbox(e,l):this.controlByButton(e,l)}))}controlByButton(e,t){this.onElementClickListener.push({el:e,fn:i=>this.elementClick(i,e,t)}),e.addEventListener("click",this.onElementClickListener.find((t=>t.el===e)).fn)}controlByCheckbox(e,t){const i=e.querySelector(`input[value="${t.value}"]`);i&&(this.onControlChangeListener.push({el:i,fn:()=>this.controlChange(e,t)}),i.addEventListener("change",this.onControlChangeListener.find((e=>e.el===i)).fn))}getItem(e){return this.items.find((t=>t.id===e))}getPath(e){var t;const i=[];let s=e.closest("[data-hs-tree-view-item]");for(;s;){const e=JSON.parse(s.getAttribute("data-hs-tree-view-item"));i.push(e.value),s=null===(t=s.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]")}return i.reverse().join("/")}unselectItem(e=null){let t=this.getSelectedItems();e&&(t=t.filter((t=>t.id!==e.id))),t.length&&t.forEach((e=>{document.querySelector(`#${e.id}`).classList.remove("selected"),this.changeItemProp(e.id,"isSelected",!1)}))}selectItem(e,t){t.isSelected?(e.classList.remove("selected"),this.changeItemProp(t.id,"isSelected",!1)):(e.classList.add("selected"),this.changeItemProp(t.id,"isSelected",!0))}selectChildren(e,t){const i=e.querySelectorAll("[data-hs-tree-view-item]");Array.from(i).filter((e=>!e.classList.contains("disabled"))).forEach((e=>{const i=e.id?this.getItem(e.id):null;if(!i)return!1;t.isSelected?(e.classList.add("selected"),this.changeItemProp(i.id,"isSelected",!0)):(e.classList.remove("selected"),this.changeItemProp(i.id,"isSelected",!1));const s=this.getItem(e.id),n=e.querySelector(`input[value="${s.value}"]`);this.isIndeterminate&&(n.indeterminate=!1),s.isSelected?n.checked=!0:n.checked=!1}))}toggleParent(e){var t,i;let s=null===(t=e.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]");for(;s;){const e=s.querySelectorAll("[data-hs-tree-view-item]:not(.disabled)"),t=JSON.parse(s.getAttribute("data-hs-tree-view-item")),n=s.querySelector(`input[value="${t.value}"]`);let o=!1,l=0;e.forEach((e=>{const t=this.getItem(e.id);t.isSelected&&(l+=1),t.isSelected||(o=!0)})),o?(s.classList.remove("selected"),this.changeItemProp(s.id,"isSelected",!1),n.checked=!1):(s.classList.add("selected"),this.changeItemProp(s.id,"isSelected",!0),n.checked=!0),this.isIndeterminate&&(l>0&&l<e.length?n.indeterminate=!0:n.indeterminate=!1),s=null===(i=s.parentElement)||void 0===i?void 0:i.closest("[data-hs-tree-view-item]")}}update(){this.items.map((e=>{const t=document.querySelector(`#${e.id}`);return e.path!==this.getPath(t)&&(e.path=this.getPath(t)),e}))}getSelectedItems(){return this.items.filter((e=>e.isSelected))}changeItemProp(e,t,i){this.items.map((s=>(s.id===e&&(s[t]=i),s)))}destroy(){this.onElementClickListener.forEach((({el:e,fn:t})=>{e.removeEventListener("click",t)})),this.onControlChangeListener.length&&this.onElementClickListener.forEach((({el:e,fn:t})=>{e.removeEventListener("change",t)})),this.unselectItem(),this.items=[],window.$hsTreeViewCollection=window.$hsTreeViewCollection.filter((({element:e})=>e.el!==this.el)),o.group-=1}static findInCollection(e){return window.$hsTreeViewCollection.find((t=>e instanceof o?t.element.el===e.el:"string"==typeof e?t.element.el===document.querySelector(e):t.element.el===e))||null}static getInstance(e,t){const i=window.$hsTreeViewCollection.find((t=>t.element.el===("string"==typeof e?document.querySelector(e):e)));return i?t?i:i.element.el:null}static autoInit(){window.$hsT
```

**File**: `dist/select.js` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ Object.defineProperty(e,"__esModule",{value:!0}),e.stringToBoolean=e.menuSearchH
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-var i=this&&this.__awaiter||function(t,e,s,i){return new(s||(s=Promise))((function(o,n){function l(t){try{r(i.next(t))}catch(t){n(t)}}function a(t){try{r(i.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof s?e:new s((function(t){t(e)}))).then(l,a)}r((i=i.apply(t,e||[])).next())}))},o=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(e,"__esModule",{value:!0});const n=s(292),l=o(s(961)),a=o(s(248)),r=s(223);class d extends l.default{constructor(t,e){var s,i,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(s=null==d?void 0:d.minSearchLength)&&void 0!==s?s:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOpti
```

**File**: `dist/select.mjs` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@ var t={189:(t,e,i)=>{i.d(e,{lP:()=>s});const s={auto:"auto","auto-start":"auto-s
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-const s=(t,e,i="auto",s=10,o=null)=>{const n=e.getBoundingClientRect(),l=o?o.getBoundingClientRect():null,a=window.innerHeight,r=l?n.top-l.top:n.top,d=(o?l.bottom:a)-n.bottom,h=t.clientHeight+s;return"bottom"===i?d>=h:"top"===i?r>=h:r>=h||d>=h},o=(t,e=200)=>{let i;return(...s)=>{clearTimeout(i),i=setTimeout((()=>{t.apply(void 0,s)}),e)}},n=(t,e,i=null)=>{const s=new CustomEvent(t,{detail:{payload:i},bubbles:!0,cancelable:!0,composed:!1});e.dispatchEvent(s)},l=(t,e)=>{const i=()=>{e(),t.removeEventListener("transitionend",i,!0)},s=window.getComputedStyle(t),o=s.getPropertyValue("transition-duration");"none"!==s.getPropertyValue("transition-property")&&parseFloat(o)>0?t.addEventListener("transitionend",i,!0):e()},a=t=>{const e=document.createElement("template");return t=t.trim(),e.innerHTML=t,e.content.firstChild},r=(t,e,i=" ",s="add")=>{t.split(i).forEach((t=>{t.trim()&&("add"===s?e.classList.add(t):e.classList.remove(t))}))}}},e={};function i(s){var o=e[s];if(void 0!==o)return o.exports;var n=e[s]={exports:{}};return t[s](n,n.exports,i),n.exports}i.d=(t,e)=>{for(var s in e)i.o(e,s)&&!i.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:e[s]})},i.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);var s={};i.d(s,{A:()=>h});var o=i(926),n=i(615),l=i(862),a=i(189),r=function(t,e,i,s){return new(i||(i=Promise))((function(o,n){function l(t){try{r(s.next(t))}catch(t){n(t)}}function a(t){try{r(s.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof i?e:new i((function(t){t(e)}))).then(l,a)}r((s=s.apply(t,e||[])).next())}))};class d extends n.A{constructor(t,e){var i,s,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate
```

---

### Incident Patch 7: `d4882b5a` (2025-09-08)
**Commit Message**: fix(overlay): prevent modal from closing on ESC when data-hs-overlay-keyboard="false"

**File**: `src/plugins/overlay/index.ts` (modified, +2/-2)
```diff
@@ -783,7 +783,7 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 						if (!this.isOpened()) this.open();
 					},
 					onEsc: () => {
-						if (this.isOpened()) {
+						if (this.isOpened()  && this.hasAbilityToCloseOnBackdropClick) {
 							this.close();
 						}
 					},
@@ -837,7 +837,7 @@ class HSOverlay extends HSBasePlugin<{}> implements IOverlay {
 						if (!this.isOpened()) this.open();
 					},
 					onEsc: () => {
-						if (this.isOpened()) {
+						if (this.isOpened() && this.hasAbilityToCloseOnBackdropClick) {
 							this.close();
 						}
 					},
```

---

### Incident Patch 8: `57a7a9a4` (2025-08-13)
**Commit Message**: fix(select): build changes

**File**: `dist/datepicker.mjs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-var e={189:(e,t,n)=>{n.d(t,{lP:()=>s});const s={auto:"auto","auto-start":"auto-start","auto-end":"auto-end",top:"top","top-left":"top-start","top-right":"top-end",bottom:"bottom","bottom-left":"bottom-start","bottom-right":"bottom-end",right:"right","right-start":"right-start","right-end":"right-end",left:"left","left-start":"left-start","left-end":"left-end"}},236:(e,t,n)=>{n.d(t,{A:()=>d});var s=n(926),i=n(615),o=n(862),a=n(189),l=function(e,t,n,s){return new(n||(n=Promise))((function(i,o){function a(e){try{r(s.next(e))}catch(e){o(e)}}function l(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(a,l)}r((s=s.apply(e,t||[])).next())}))};class r extends i.A{constructor(e,t){var n,s,i,o,a;super(e,t),this.disabledObserver=null,this.optionId=0;const l=e.getAttribute("data-hs-select"),r=l?JSON.parse(l):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(n=null==d?void 0:d.minSearchLength)&&void 0!==n?n:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOption)
```

**File**: `dist/index.js` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
  * @author: Preline Labs Ltd.
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
- */var s=this&&this.__awaiter||function(e,t,i,s){return new(i||(i=Promise))((function(n,o){function l(e){try{r(s.next(e))}catch(e){o(e)}}function a(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?n(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t)}))).then(l,a)}r((s=s.apply(e,t||[])).next())}))},n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const o=i(292),l=n(i(961)),a=n(i(248)),r=i(223);class d extends l.default{constructor(e,t){var i,s,n,o,l;super(e,t),this.disabledObserver=null,this.optionId=0;const a=e.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(n=null==d?void 0:d.toggleSeparators)||void 0===n?void 0:n.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOption)&&(null==d?void 0:d.optionAllowEmptyOption),thi
```

**File**: `dist/index.mjs` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ class o extends n.A{constructor(e,t){super(e,t);const i=e.getAttribute("data-hs-
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-class o extends n.A{constructor(e,t,i){super(e,t,i),this.items=[];const s=e.getAttribute("data-hs-tree-view"),n=s?JSON.parse(s):{},o=Object.assign(Object.assign({},n),t);this.controlBy=(null==o?void 0:o.controlBy)||"button",this.autoSelectChildren=(null==o?void 0:o.autoSelectChildren)||!1,this.isIndeterminate=(null==o?void 0:o.isIndeterminate)||!0,this.onElementClickListener=[],this.onControlChangeListener=[],this.init()}elementClick(e,t,i){if(e.stopPropagation(),t.classList.contains("disabled"))return!1;e.metaKey||e.shiftKey||this.unselectItem(i),this.selectItem(t,i),this.fireEvent("click",{el:t,data:i}),(0,s.JD)("click.hs.treeView",this.el,{el:t,data:i})}controlChange(e,t){this.autoSelectChildren?(this.selectItem(e,t),t.isDir&&this.selectChildren(e,t),this.toggleParent(e)):this.selectItem(e,t)}init(){this.createCollection(window.$hsTreeViewCollection,this),o.group+=1,this.initItems()}initItems(){this.el.querySelectorAll("[data-hs-tree-view-item]").forEach(((e,t)=>{var i,s;const n=JSON.parse(e.getAttribute("data-hs-tree-view-item"));e.id||(e.id=`tree-view-item-${o.group}-${t}`);const l=Object.assign(Object.assign({},n),{id:null!==(i=n.id)&&void 0!==i?i:e.id,path:this.getPath(e),isSelected:null!==(s=n.isSelected)&&void 0!==s&&s});this.items.push(l),"checkbox"===this.controlBy?this.controlByCheckbox(e,l):this.controlByButton(e,l)}))}controlByButton(e,t){this.onElementClickListener.push({el:e,fn:i=>this.elementClick(i,e,t)}),e.addEventListener("click",this.onElementClickListener.find((t=>t.el===e)).fn)}controlByCheckbox(e,t){const i=e.querySelector(`input[value="${t.value}"]`);i&&(this.onControlChangeListener.push({el:i,fn:()=>this.controlChange(e,t)}),i.addEventListener("change",this.onControlChangeListener.find((e=>e.el===i)).fn))}getItem(e){return this.items.find((t=>t.id===e))}getPath(e){var t;const i=[];let s=e.closest("[data-hs-tree-view-item]");for(;s;){const e=JSON.parse(s.getAttribute("data-hs-tree-view-item"));i.push(e.value),s=null===(t=s.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]")}return i.reverse().join("/")}unselectItem(e=null){let t=this.getSelectedItems();e&&(t=t.filter((t=>t.id!==e.id))),t.length&&t.forEach((e=>{document.querySelector(`#${e.id}`).classList.remove("selected"),this.changeItemProp(e.id,"isSelected",!1)}))}selectItem(e,t){t.isSelected?(e.classList.remove("selected"),this.changeItemProp(t.id,"isSelected",!1)):(e.classList.add("selected"),this.changeItemProp(t.id,"isSelected",!0))}selectChildren(e,t){const i=e.querySelectorAll("[data-hs-tree-view-item]");Array.from(i).filter((e=>!e.classList.contains("disabled"))).forEach((e=>{const i=e.id?this.getItem(e.id):null;if(!i)return!1;t.isSelected?(e.classList.add("selected"),this.changeItemProp(i.id,"isSelected",!0)):(e.classList.remove("selected"),this.changeItemProp(i.id,"isSelected",!1));const s=this.getItem(e.id),n=e.querySelector(`input[value="${s.value}"]`);this.isIndeterminate&&(n.indeterminate=!1),s.isSelected?n.checked=!0:n.checked=!1}))}toggleParent(e){var t,i;let s=null===(t=e.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]");for(;s;){const e=s.querySelectorAll("[data-hs-tree-view-item]:not(.disabled)"),t=JSON.parse(s.getAttribute("data-hs-tree-view-item")),n=s.querySelector(`input[value="${t.value}"]`);let o=!1,l=0;e.forEach((e=>{const t=this.getItem(e.id);t.isSelected&&(l+=1),t.isSelected||(o=!0)})),o?(s.classList.remove("selected"),this.changeItemProp(s.id,"isSelected",!1),n.checked=!1):(s.classList.add("selected"),this.changeItemProp(s.id,"isSelected",!0),n.checked=!0),this.isIndeterminate&&(l>0&&l<e.length?n.indeterminate=!0:n.indeterminate=!1),s=null===(i=s.parentElement)||void 0===i?void 0:i.closest("[data-hs-tree-view-item]")}}update(){this.items.map((e=>{const t=document.querySelector(`#${e.id}`);return e.path!==this.getPath(t)&&(e.path=this.getPath(t)),e}))}getSelectedItems(){return this.items.filter((e=>e.isSelected))}changeItemProp(e,t,i){this.items.map((s=>(s.id===e&&(s[t]=i),s)))}destroy(){this.onElementClickListener.forEach((({el:e,fn:t})=>{e.removeEventListener("click",t)})),this.onControlChangeListener.length&&this.onElementClickListener.forEach((({el:e,fn:t})=>{e.removeEventListener("change",t)})),this.unselectItem(),this.items=[],window.$hsTreeViewCollection=window.$hsTreeViewCollection.filter((({element:e})=>e.el!==this.el)),o.group-=1}static findInCollection(e){return window.$hsTreeViewCollection.find((t=>e instanceof o?t.element.el===e.el:"string"==typeof e?t.element.el===document.querySelector(e):t.element.el===e))||null}static getInstance(e,t){const i=window.$hsTreeViewCollection.find((t=>t.element.el===("string"==typeof e?document.querySelector(e):e)));return i?t?i:i.element.el:null}static autoInit(){window.$hsT
```

**File**: `dist/select.js` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ Object.defineProperty(e,"__esModule",{value:!0}),e.stringToBoolean=e.menuSearchH
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-var i=this&&this.__awaiter||function(t,e,s,i){return new(s||(s=Promise))((function(o,n){function l(t){try{r(i.next(t))}catch(t){n(t)}}function a(t){try{r(i.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof s?e:new s((function(t){t(e)}))).then(l,a)}r((i=i.apply(t,e||[])).next())}))},o=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(e,"__esModule",{value:!0});const n=s(292),l=o(s(961)),a=o(s(248)),r=s(223);class d extends l.default{constructor(t,e){var s,i,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(s=null==d?void 0:d.minSearchLength)&&void 0!==s?s:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 0:d.searchWrapperClasses)||"bg-white p-2 sticky top-0",this.searchId=(null==d?void 0:d.searchId)||null,this.searchLimit=(null==d?void 0:d.searchLimit)||1/0,this.isSearchDirectMatch=void 0===(null==d?void 0:d.isSearchDirectMatch)||(null==d?void 0:d.isSearchDirectMatch),this.searchClasses=(null==d?void 0:d.searchClasses)||"block w-[calc(100%-32px)] text-sm border-gray-200 rounded-md focus:border-blue-500 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 py-2 px-3 my-2 mx-4",this.searchPlaceholder=(null==d?void 0:d.searchPlaceholder)||"Search...",this.searchNoResultTemplate=(null==d?void 0:d.searchNoResultTemplate)||"<span></span>",this.searchNoResultText=(null==d?void 0:d.searchNoResultText)||"No results found",this.searchNoResultClasses=(null==d?void 0:d.searchNoResultClasses)||"px-4 text-sm text-gray-800 dark:text-neutral-200",this.optionAllowEmptyOption=void 0!==(null==d?void 0:d.optionAllowEmptyOpti
```

**File**: `dist/select.mjs` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@ var t={189:(t,e,i)=>{i.d(e,{lP:()=>s});const s={auto:"auto","auto-start":"auto-s
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-const s=(t,e,i="auto",s=10,o=null)=>{const n=e.getBoundingClientRect(),l=o?o.getBoundingClientRect():null,a=window.innerHeight,r=l?n.top-l.top:n.top,d=(o?l.bottom:a)-n.bottom,h=t.clientHeight+s;return"bottom"===i?d>=h:"top"===i?r>=h:r>=h||d>=h},o=(t,e=200)=>{let i;return(...s)=>{clearTimeout(i),i=setTimeout((()=>{t.apply(void 0,s)}),e)}},n=(t,e,i=null)=>{const s=new CustomEvent(t,{detail:{payload:i},bubbles:!0,cancelable:!0,composed:!1});e.dispatchEvent(s)},l=(t,e)=>{const i=()=>{e(),t.removeEventListener("transitionend",i,!0)},s=window.getComputedStyle(t),o=s.getPropertyValue("transition-duration");"none"!==s.getPropertyValue("transition-property")&&parseFloat(o)>0?t.addEventListener("transitionend",i,!0):e()},a=t=>{const e=document.createElement("template");return t=t.trim(),e.innerHTML=t,e.content.firstChild},r=(t,e,i=" ",s="add")=>{t.split(i).forEach((t=>{t.trim()&&("add"===s?e.classList.add(t):e.classList.remove(t))}))}}},e={};function i(s){var o=e[s];if(void 0!==o)return o.exports;var n=e[s]={exports:{}};return t[s](n,n.exports,i),n.exports}i.d=(t,e)=>{for(var s in e)i.o(e,s)&&!i.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:e[s]})},i.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);var s={};i.d(s,{A:()=>h});var o=i(926),n=i(615),l=i(862),a=i(189),r=function(t,e,i,s){return new(i||(i=Promise))((function(o,n){function l(t){try{r(s.next(t))}catch(t){n(t)}}function a(t){try{r(s.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof i?e:new i((function(t){t(e)}))).then(l,a)}r((s=s.apply(t,e||[])).next())}))};class d extends n.A{constructor(t,e){var i,s,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate
```

---

### Incident Patch 9: `b23978cd` (2025-08-13)
**Commit Message**: fix(select): additional checking for images

**File**: `src/plugins/select/index.ts` (modified, +5/-2)
```diff
@@ -520,8 +520,11 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 
 			icon.append(img);
 
-			if (!img) icon.classList.add("hidden");
-			else icon.classList.remove("hidden");
+      if (img instanceof HTMLImageElement ? !img.src : !img) {
+        icon.classList.add('hidden');
+      } else {
+        icon.classList.remove('hidden');
+      }
 		}
 	}
 
```

---

### Incident Patch 10: `48b0ba3f` (2025-07-19)
**Commit Message**: fix(select): Fixed checking for images

**File**: `src/plugins/select/index.ts` (modified, +4/-3)
```diff
@@ -507,19 +507,20 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 				this.apiUrl && this.apiIconTag
 					? this.apiIconTag || ""
 					: item?.options?.icon || "",
-			) as HTMLImageElement;
+			);
 			if (
 				this.value &&
 				this.apiUrl &&
 				this.apiIconTag &&
-				item[this.apiFieldsMap.icon]
+				item[this.apiFieldsMap.icon] &&
+				img instanceof HTMLImageElement
 			) {
 				img.src = (item[this.apiFieldsMap.icon] as string) || "";
 			}
 
 			icon.append(img);
 
-			if (!img?.src) icon.classList.add("hidden");
+			if (!img) icon.classList.add("hidden");
 			else icon.classList.remove("hidden");
 		}
 	}
```

---

### Incident Patch 11: `9a8a460d` (2025-03-12)
**Commit Message**: Comply with css spec

variants.css was not following the css spec when it comes to @import rules. @import rules are required to be defined above any other declaration or else they get ignored.

https://drafts.csswg.org/css-cascade-5/#at-import

**File**: `variants.css` (modified, +24/-24)
```diff
@@ -1,26 +1,3 @@
-/* States */
-@custom-variant hs-success {
-
-  &.success {
-    @slot;
-  }
-
-  .success & {
-    @slot;
-  }
-}
-
-@custom-variant hs-error {
-
-  &.error {
-    @slot;
-  }
-
-  .error & {
-    @slot;
-  }
-}
-
 /* Preline */
 @import './src/plugins/dropdown/variants.css';
 @import './src/plugins/remove-element/variants.css';
@@ -46,6 +23,29 @@
 @import './src/plugins/datepicker/variants.css';
 @import './src/plugins/theme-switch/variants.css';
 
+/* States */
+@custom-variant hs-success {
+
+  &.success {
+    @slot;
+  }
+
+  .success & {
+    @slot;
+  }
+}
+
+@custom-variant hs-error {
+
+  &.error {
+    @slot;
+  }
+
+  .error & {
+    @slot;
+  }
+}
+
 /* Apexcharts */
 @custom-variant hs-apexcharts-tooltip-dark {
   &.dark {
@@ -70,4 +70,4 @@
   .toastify.on & {
     @slot;
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 12: `19d2d372` (2024-12-18)
**Commit Message**: fix(select): fixes setValue method to work with tags select

**File**: `src/plugins/select/index.ts` (modified, +36/-22)
```diff
@@ -277,23 +277,37 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 
 	public setValue(val: string | string[]) {
 		this.value = val;
-
 		this.clearSelections();
 
 		if (Array.isArray(val)) {
-			this.toggleTextWrapper.innerHTML = this.value.length
-				? this.stringFromValue()
-				: this.placeholder;
-			this.unselectMultipleItems();
-			this.selectMultipleItems();
+			if (this.mode === 'tags') {
+				this.unselectMultipleItems();
+				this.selectMultipleItems();
+
+				this.selectedItems = [];
+
+				const existingTags = this.wrapper.querySelectorAll('[data-tag-value]');
+				existingTags.forEach((tag) => tag.remove());
+
+				this.setTagsItems();
+				this.reassignTagsInputPlaceholder(
+					this.value.length ? '' : this.placeholder,
+				);
+			} else {
+				this.toggleTextWrapper.innerHTML = this.value.length
+					? this.stringFromValue()
+					: this.placeholder;
+				this.unselectMultipleItems();
+				this.selectMultipleItems();
+			}
 		} else {
 			this.setToggleTitle();
-
 			if (this.toggle.querySelector('[data-icon]')) this.setToggleIcon();
 			if (this.toggle.querySelector('[data-title]')) this.setToggleTitle();
-
 			this.selectSingleItem();
 		}
+
+		this.triggerChangeEventForNativeSelect();
 	}
 
 	private init() {
@@ -561,7 +575,7 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 		const value = this.apiUrl
 			? (this.remoteOptions as (ISingleOption & IApiFieldMap)[]).find(
 				(el) => `${el[this.apiFieldsMap.val]}` === val || el[this.apiFieldsMap.title] === val,
-			)
+				)
 			: this.selectOptions.find((el: ISingleOption) => el.val === val);
 
 		return value;
@@ -1029,7 +1043,7 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 				parseInt(window.getComputedStyle(this.wrapper).paddingRight));
 
 		(this.tagsInput as HTMLInputElement).style.width = `${Math.min(newWidth, maxWidth) + 2
-			}px`;
+		}px`;
 	}
 
 	private adjustInputWidth() {
@@ -1305,19 +1319,19 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 			const optionVal = el.getAttribute('data-title-value').toLocaleLowerCase();
 			const regexSafeVal = val
 				? val
-					.split('')
-					.map((char) => {
-						return char.match(/\w/) ? `${char}[\\W_]*` : '\\W*';
-					})
-					.join('')
+						.split('')
+						.map((char) => {
+							return char.match(/\w/) ? `${char}[\\W_]*` : '\\W*';
+						})
+						.join('')
 				: '';
 			const regex = new RegExp(regexSafeVal, 'i');
 			const directMatch = this.isSearchDirectMatch;
 			const cleanedOptionVal = optionVal.trim();
 			const condition = val
 				? directMatch
 					? !cleanedOptionVal.toLowerCase().includes(val.toLowerCase()) ||
-					countLimit >= this.searchLimit
+						countLimit >= this.searchLimit
 					: !regex.test(cleanedOptionVal) || countLimit >= this.searchLimit
 				: !regex.test(cleanedOptionVal);
 
@@ -1720,8 +1734,8 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 
 			const preparedOptions = isArrowUp
 				? Array.from(
-					dropdown.querySelectorAll(':scope > *:not(.hidden)'),
-				).reverse()
+						dropdown.querySelectorAll(':scope > *:not(.hidden)'),
+					).reverse()
 				: Array.from(dropdown.querySelectorAll(':scope > *:not(.hidden)'));
 			const options = preparedOptions.filter(
 				(el: any) => !el.classList.contains('disabled'),
@@ -1752,8 +1766,8 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 
 			const preparedOptions = isArrowUp
 				? Array.from(
-					dropdown.querySelectorAll(':scope >  *:not(.hidden)'),
-				).reverse()
+						dropdown.querySelectorAll(':scope >  *:not(.hidden)'),
+					).reverse()
 				: Array.from(dropdown.querySelectorAll(':scope >  *:not(.hidden)'));
 			const options = preparedOptions.filter(
 				(el: any) => !el.classList.contains('disabled'),
@@ -1791,8 +1805,8 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 			const preparedOptions = isStart
 				? Array.from(dropdown.querySelectorAll(':scope >  *:not(.hidden)'))
 				: Array.from(
-					dropdown.querySelectorAll(':scope >  *:not(.hidden)'),
-				).reverse();
+						dropdown.querySelectorAll(':scope >  *:not(.hidden)'),
+					).reverse();
 			const options = preparedOptions.filter(
 				(el: any) => !el.classList.contains('disabled'),
 			);
```

---

### Incident Patch 13: `257e2a23` (2024-12-06)
**Commit Message**: fix: stepper reset button

**File**: `src/plugins/stepper/index.ts` (modified, +2/-0)
```diff
@@ -752,7 +752,9 @@ class HSStepper extends HSBasePlugin<{}> implements IStepper {
 		this.unsetCompleted();
 		this.isCompleted = false;
 
+		this.showSkipButton();
 		this.setCurrentNavItem();
+		this.setCurrentContentItem();
 		this.showFinishButton();
 		this.showCompleteStepButton();
 		this.checkForTheFirstStep();
```

---

### Incident Patch 14: `878d7f30` (2024-10-14)
**Commit Message**: Merge pull request #411 from ZedObaia/fix-252-fire-change-event-on-tag-close-click

fixes #252 fire change event when the tag close icon is clicked and item is removed

**File**: `src/plugins/select/index.ts` (modified, +2/-0)
```diff
@@ -490,6 +490,8 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
 			this.selectMultipleItems();
 
 			newItem.remove();
+			this.fireEvent('change', this.value);
+			dispatch('change.hs.select', this.el, this.value);
 		});
 
 		this.wrapper.append(newItem);
```

---

### Incident Patch 15: `ec4b62d8` (2024-10-14)
**Commit Message**: Merge pull request #473 from parshurambagade/bug/type-error

add type to the addVariant

**File**: `plugin.ts` (modified, +1/-1)
```diff
@@ -264,7 +264,7 @@ export default plugin(function ({ addVariant, e }: PluginAPI) {
 				)}`;
 			});
 		},
-		({ modifySelectors, separator }) => {
+		({ modifySelectors, separator }: IAddVariantOptions) => {
 			modifySelectors(({ className }) => {
 				return `.dragging .${e(
 					`hs-carousel-dragging${separator}${className}`,
```

#### Recent Merged Pull Requests:
- **PR #764** (2026-08-21): docs: document Select API options (@jordansilly77-stack)
- **PR #762** (2026-08-21): fix(select): allow relative URLs for advanced select apiUrl (@delfuego)
- **PR #741** (closed): Fix encoding error in remote data call #695 (@noxilixon)
- **PR #735** (2026-01-27): Fix get body current scrollbar size overlay (@haohuynhwork)
- **PR #726** (closed): fix: format (@WuMingDao)
- **PR #725** (2026-01-20): docs: fix typo and remove extra spaces in README.md (@WuMingDao)
- **PR #724** (closed): Add Prettier cache (@WuMingDao)
- **PR #717** (2026-01-27): fix(datepicker): respect custom separators in dateFormat (@RosnelOn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
