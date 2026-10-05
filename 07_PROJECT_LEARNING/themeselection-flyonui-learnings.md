# Forensic Learning Record (Deep Inspection): themeselection/flyonui

> **Canonical Artifact**: `07_PROJECT_LEARNING/themeselection-flyonui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/themeselection/flyonui](https://github.com/themeselection/flyonui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:40.427Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `themeselection/flyonui`
- **Description**: 🚀 The easiest, free and open-source Tailwind CSS component library with semantic classes.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2529 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/js/utils/index.ts`
```
/*
 * @version: 3.2.3
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */

const stringToBoolean = (string: string): boolean => {
  return string === 'true' ? true : false
}

const getClassProperty = (el: HTMLElement, prop: string, val = '') => {
  return (window.getComputedStyle(el).getPropertyValue(prop) || val).replace(' ', '')
}

const getClassPropertyAlt = (el: HTMLElement, prop?: string, val: string = '') => {
  let targetClass = ''

  el.classList.forEach(c => {
    if (c.includes(prop)) {
      targetClass = c
    }
  })

  return targetClass.match(/:(.*)]/) ? targetClass.match(/:(.*)]/)[1] : val
}

const getZIndex = (el: HTMLElement) => {
  const computedStyle = window.getComputedStyle(el)
  const zIndex = computedStyle.getPropertyValue('z-index')

  return zIndex
}

const getHighestZIndex = (arr: HTMLElement[]) => {
  let highestZIndex = Number.NEGATIVE_INFINITY

  arr.forEach(el => {
    let zIndex: string | number = getZIndex(el)

    if (zIndex !== 'auto') {
      zIndex = parseInt(zIndex, 10)

      if (zIndex > highestZIndex) highestZIndex = zIndex
    }
  })

  return highestZIndex
}

const isDirectChild = (parent: Element, child: HTMLElement) => {
  const children = parent.children

  for (let i = 0; i < children.length; i++) {
    if (children[i] === child) return true
  }

  return false
}

const isEnoughSpace = (
  el: HTMLElement,
  toggle: HTMLElement,
  preferredPosition: 'top' | 'bottom' | 'auto' = 'auto',
  space = 10,
  wrapper: HTMLElement | null = null
) => {
  const referenceRect = toggle.getBoundingClientRect()
  const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : null
  const viewportHeight = window.innerHeight
  const spaceAbove = wrapperRect ? referenceRect.top - wrapperRect.top : referenceRect.top
  const spaceBelow = (wrapper ? wrapperRect.bottom : viewportHeight) - referenceRect.bottom
  const minimumSpaceRequired = el.clientHeight + space

  if (preferredPosition === 'bottom') {
    return spaceBelow >= minimumSpaceRequired
  } else if (preferredPosition === 'top') {
    return spaceAbove >= minimumSpaceRequired
  } else {
    return spaceAbove >= minimumSpaceRequired || spaceBelow >= minimumSpaceRequired
  }
}

const isFocused = (target: HTMLElement) => {
  return document.activeElement === target
}

const isFormElement = (target: HTMLElement) => {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  )
}

const isIOS = () => {
  if (/iPad|iPhone|iPod/.test(navigator.platform)) {
    return true
  } else {
    return navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform)
  }
}

const isIpadOS = () => {
  return navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform)
}

const isJson = (str: string) => {
  if (typeof str !== 'string') return false

  const firstChar = str.trim()[0]
  const lastChar = str.trim().slice(-1)

  if ((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']')) {
    try {
      JSON.parse(str)

      return true
    } catch {
      return false
    }
  }

  return false
}

const isParentOrElementHidden = (element: any): any => {
  if (!element) return false

  const computedStyle = window.getComputedStyle(element)

  if (computedStyle.display === 'none') return true

  return isParentOrElementHidden(element.parentElement)
}

const isScrollable = (el: HTMLElement) => {
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  const overflowX = style.overflowX
  const canScrollVertically = (overflowY === 'scroll' || overflowY === 'auto') && el.scrollHeight > el.clientHeight
  const canScrollHorizontally = (overflowX === 'scroll' || overflowX === 'auto') && el.scrollWidth > el.clientWidth

  return canScrollVertically || canScrollHorizontally
}

const debounce = (func: Function, timeout = 200) => {
  let timer: any

  return (...args: any[]) => {
    clearTimeout(timer)

    timer = setTimeout(() => {
      func.apply(this, args)
    }, timeout)
  }
}

const dispatch = (evt: string, element: any, payload: any = null) => {
  const event = new CustomEvent(evt, {
    detail: { payload },
    bubbles: true,
    cancelable: true,
    composed: false
  })

  element.dispatchEvent(event)
}

const afterTransition = (el: HTMLElement, callback: Function) => {
  const handleEvent = () => {
    callback()

    el.removeEventListener('transitionend', handleEvent, true)
  }

  const computedStyle = window.getComputedStyle(el)
  const transitionDuration = computedStyle.getPropertyValue('transition-duration')
  const transitionProperty = computedStyle.getPropertyValue('transition-property')
  const hasTransition = transitionProperty !== 'none' && parseFloat(transitionDuration) > 0

  if (hasTransition) el.addEventListener('transitionend', handleEvent, true)
  else callback()
}

const htmlToElement = (html: string): HTMLElement => {
  const template = document.createElement('template')
  html = html.trim()
  template.innerHTML = html

  return template.content.firstChild as HTMLElement
}

const classToClassList = (classes: string, target: HTMLElement, splitter = ' ', action: 'add' | 'remove' = 'add') => {
  const classesToArray = classes.split(splitter)
  classesToArray.forEach(cl => {
    if (cl.trim()) {
      action === 'add' ? target.classList.add(cl) : target.classList.remove(cl)
    }
  })
}

const menuSearchHistory = {
  historyIndex: -1,

  addHistory(index: number) {
    this.historyIndex = index
  },

  existsInHistory(index: number) {
    return index > this.historyIndex
  },

  clearHistory() {
    this.historyIndex = -1
  }
}

export {
  afterTransition,
  classToClassList,
  debounce,
  dispatch,
  getClassProperty,
  getClassPropertyAlt,
  getHighestZIndex,
  getZIndex,
  htmlToElement,
  isDirectChild,
  isEnoughSpace,
  isFocused,
  isFormElement,
  isIOS,
  isIpadOS,
  isJson,
  isParentOrElementHidden,
  isScrollable,
  menuSearchHistory,
  stringToBoolean
}

```

### Core Architecture Module: `src/js/utils/interfaces.ts`
```
export interface IMenuSearchHistory {
  historyIndex: number

  addHistory(index: number): void
  existsInHistory(index: number): boolean
  clearHistory(): void
}

```

### Core Architecture Module: `src/js/utils/types.ts`
```
// no types

```

### Core Architecture Module: `flyonui.d.ts`
```
import { VirtualElement } from '@floating-ui/dom';

export interface ICopyMarkupOptions {
	targetSelector: string;
	wrapperSelector: string;
	limit?: number;
}
export interface ICopyMarkup {
	options?: ICopyMarkupOptions;
	delete(target: HTMLElement): void;
	destroy(): void;
}
export interface IBasePlugin<O, E> {
	el: E;
	options?: O;
	events?: {};
}
declare class HSBasePlugin<O, E = HTMLElement> implements IBasePlugin<O, E> {
	el: E;
	options: O;
	events?: any;
	constructor(el: E, options: O, events?: any);
	createCollection(collection: any[], element: any): void;
	fireEvent(evt: string, payload?: any): any;
	on(evt: string, cb: Function): void;
}
export interface ICollectionItem<T> {
	id: string | number;
	element: T;
}
export declare class HSCopyMarkup extends HSBasePlugin<ICopyMarkupOptions> implements ICopyMarkup {
	private readonly targetSelector;
	private readonly wrapperSelector;
	private readonly limit;
	private target;
	private wrapper;
	private items;
	private count;
	private onElementClickListener;
	private onDeleteItemButtonClickListener;
	constructor(el: HTMLElement, options?: ICopyMarkupOptions);
	private elementClick;
	private deleteItemButtonClick;
	private init;
	private copy;
	private addPredefinedItems;
	private setTarget;
	private setWrapper;
	private addToItems;
	delete(target: HTMLElement): void;
	destroy(): void;
	static getInstance(target: HTMLElement | string, isInstance?: boolean): HSCopyMarkup | ICollectionItem<HSCopyMarkup>;
	static autoInit(): void;
}
export interface IAccordionTreeViewStaticOptions {
}
export interface IAccordionTreeView {
	el: HTMLElement | null;
	options?: IAccordionTreeViewStaticOptions;
	listeners?: {
		el: HTMLElement;
		listener: (evt: Event) => void;
	}[];
}
export interface IAccordionOptions {
}
export interface IAccordion {
	options?: IAccordionOptions;
	toggleClick(evt: Event): void;
	show(): void;
	hide(): void;
	update(): void;
	destroy(): void;
}
export declare class HSAccordion extends HSBasePlugin<IAccordionOptions> implements IAccordion {
	private toggle;
	content: HTMLElement | null;
	private group;
	private isAlwaysOpened;
	private keepOneOpen;
	private isToggleStopPropagated;
	private onToggleClickListener;
	static selectable: IAccordionTreeView[];
	constructor(el: HTMLElement, options?: IAccordionOptions, events?: {});
	private init;
	toggleClick(evt: Event): boolean;
	show(): boolean;
	hide(): boolean;
	update(): boolean;
	destroy(): void;
	private static findInCollection;
	static autoInit(): void;
	static getInstance(target: HTMLElement | string, isInstance?: boolean): HTMLElement | ICollectionItem<HSAccordion>;
	static show(target: HSAccordion | HTMLElement | string): void;
	static hide(target: HSAccordion | HTMLElement | string): void;
	static onSelectableClick: (evt: Event, item: IAccordionTreeView, el: HTMLElement) => void;
	static treeView(): boolean;
	static toggleSelected(root: IAccordionTreeView, item: HTMLElement): void;
	static on(evt: string, target: HSAccordion | HTMLElement | string, cb: Function): void;
}
export type TCarouselOptionsSlidesQty = {
	[key: string]: number;
};
export interface ICarouselOptions {
	currentIndex: number;
	loadingClasses?: string | string[];
	dotsItemClasses?: string;
	mode?: "default" | "scroll-nav";
	isAutoHeight?: boolean;
	isAutoPlay?: boolean;
	isCentered?: boolean;
	isDraggable?: boolean;
	isInfiniteLoop?: boolean;
	isRTL?: boolean;
	isSnap?: boolean;
	hasSnapSpacers?: boolean;
	slidesQty?: TCarouselOptionsSlidesQty | number;
	speed?: number;
	updateDelay?: number;
}
export interface ICarousel {
	options?: ICarouselOptions;
	recalculateWidth(): void;
	goToPrev(): void;
	goToNext(): void;
	goTo(i: number): void;
	destroy(): void;
}
export declare class HSCarousel extends HSBasePlugin<ICarouselOptions> implements ICarousel {
	private currentIndex;
	private readonly loadingClasses;
	private readonly dotsItemClasses;
	private readonly isAutoHeight;
	private readonly isAutoPlay;
	private readonly isCentered;
	private readonly isDraggable;
	private readonly isInfiniteLoop;
	private readonly isRTL;
	private readonly isSnap;
	private readonly hasSnapSpacers;
	private readonly slidesQty;
	private readonly speed;
	private readonly updateDelay;
	private readonly loadingClassesRemove;
	private readonly loadingClassesAdd;
	private readonly afterLoadingClassesAdd;
	private readonly container;
	private readonly inner;
	private readonly slides;
	private readonly prev;
	private readonly next;
	private readonly dots;
	private dotsItems;
	private readonly info;
	private readonly infoTotal;
	private readonly infoCurrent;
	private sliderWidth;
	private timer;
	private isScrolling;
	private isDragging;
	private dragStartX;
	private initialTranslateX;
	private readonly touchX;
	private readonly touchY;
	private resizeContainer;
	resizeContainerWidth: number;
	private onPrevClickListener;
	private onNextClickListener;
	private onContainerScrollListener;
	private onElementTouchStartListener;
	private onElementTouchEndListener;
	private onInnerMouseDownListener;
	private onInnerTouchStartListener;
	private onDocumentMouseMoveListener;
	private onDocumentTouchMoveListener;
	private onDocumentMouseUpListener;
	private onDocumentTouchEndListener;
	private onDotClickListener;
	constructor(el: HTMLElement, options?: ICarouselOptions);
	private setIsSnap;
	private prevClick;
	private nextClick;
	private containerScroll;
	private elementTouchStart;
	private elementTouchEnd;
	private innerMouseDown;
	private innerTouchStart;
	private documentMouseMove;
	private documentTouchMove;
	private documentMouseUp;
	private documentTouchEnd;
	private dotClick;
	private init;
	private initDragHandling;
	private getTranslateXValue;
	private removeClickEventWhileDragging;
	private handleDragStart;
	private handleDragMove;
	private handleDragEnd;
	private getEventX;
	private getCurrentSlidesQty;
	private buildSnapSpacers;
	private initDots;
	private buildDots;
	private setDots;
	private goToCurrentDot;
	private buildInfo;
	private setInfoTotal;
	private setInfoCurrent;
	private buildSingleDot;
	private singleDotEvents;
	private observeResize;
	private calculateWidth;
	private addCurrentClass;
	private setCurrentDot;
	private setElementToDisabled;
	private unsetElementToDisabled;
	private addDisabledClass;
	private autoPlay;
	private setTimer;
	private resetTimer;
	private detectDirection;
	private calculateTransform;
	private setTransform;
	private setTranslate;
	private setIndex;
	recalculateWidth(): void;
	goToPrev(): void;
	goToNext(): void;
	goTo(i: number): void;
	destroy(): void;
	static getInstance(target: HTMLElement | string, isInstance?: boolean): HSCarousel | ICollectionItem<HSCarousel>;
	static autoInit(): void;
}
export interface ICollapse {
	options?: {};
	show(): void;
	hide(): void;
	destroy(): void;
}
export declare class HSCollapse extends HSBasePlugin<{}> implements ICollapse {
	private readonly contentId;
	content: HTMLElement | null;
	private animationInProcess;
	private onElementClickListener;
	constructor(el: HTMLElement, options?: {}, events?: {});
	private elementClick;
	private init;
	private hideAllMegaMenuItems;
	private closeDropdowns;
	show(): boolean;
	hide(): boolean;
	destroy(): void;
	private static findInCollection;
	static getInstance(target: HTMLElement, isInstance?: boolean): HTMLElement | ICollectionItem<HSCollapse>;
	static autoInit(): void;
	static show(target: HSCollapse | HTMLElement | string): void;
	static hide(target: HSCollapse | HTMLElement | string): void;
	static on(evt: string, target: HSCollapse | HTMLElement | string, cb: Function): void;
}
export interface IComboBoxOptions {
	gap?: number;
	viewport?: string | HTMLElement | null;
	preventVisibility?: boolean;
	minSearchLength?: number;
	apiUrl?: string | null;
	apiDataPart?: string | null;
	apiQuery?: string | null;
	apiSearchQuery?: string | null;
	apiSearchPath?: string | null;
	apiSearchDefaultPath?: string | null;
	apiHeaders?: {};
	apiGroupField?: string | null;
	outputItemTemplate?: string | null;
	outputEmptyTemplate?: string | null;
	outputLoaderTemplate?: string | null;
	groupingType?: "default" | "tabs" | null;
	groupingTitleTemplate?: string | null;
	tabsWrapperTemplate?: string | null;
	preventSelection?: boolean;
	preventAutoPosition?: boolean;
	preventClientFiltering?: boolean;
	isOpenOnFocus?: boolean;
	keepOriginalOrder?: boolean;
	preserveSelectionOnEmpty?: boolean;
}
export interface IComboBox {
	options?: IComboBoxOptions;
	getCurrentData(): {} | {}[];
	open(): void;
	close(): void;
	recalculateDirection(): void;
	destroy(): void;
}
export declare class HSComboBox extends HSBasePlugin<IComboBoxOptions> implements IComboBox {
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
	groupingType: "default" | "tabs" | null;
	groupingTitleTemplate: string | null;
	tabsWrapperTemplate: string | null;
	preventSelection: boolean;
	preventAutoPosition: boolean;
	preventClientFiltering: boolean;
	isOpenOnFocus: boolean;
	keepOriginalOrder: boolean;
	preserveSelectionOnEmpty: boolean;
	private accessibilityComponent;
	private readonly input;
	private readonly output;
	private readonly itemsWrapper;
	private items;
	private tabs;
	private readonly toggle;
	private readonly toggleClose;
	private readonly toggleOpen;
	private outputPlaceholder;
	private outputLoader;
	private value;
	private selected;
	private currentData;
	private groups;
	private selectedGroup;
	isOpened: boolean;
	isCurrent: boolean;
	private animationInProcess;
	private isSearchLengthExceeded;
	private onInputFocusListener;
	private onInputInputListener;
	private onToggleClickLi
```

### Core Architecture Module: `flyonui.js`
```
!function(e,t){if("object"==typeof exports&&"object"==typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var i=t();for(var s in i)("object"==typeof exports?exports:e)[s]=i[s]}}(self,()=>(()=>{"use strict";var e={12:function(e,t,i){
/*
 * HSCopyMarkup
 * @version: 3.2.3
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */
var s=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const n=i(806),o=s(i(287));class l extends o.default{constructor(e,t){super(e,t),this.count=0;const i=e.getAttribute("data-copy-markup"),s=i?JSON.parse(i):{},n=Object.assign(Object.assign({},s),t);this.targetSelector=(null==n?void 0:n.targetSelector)||null,this.wrapperSelector=(null==n?void 0:n.wrapperSelector)||null,this.limit=(null==n?void 0:n.limit)||null,this.items=[],this.targetSelector&&this.init()}elementClick(){this.copy()}deleteItemButtonClick(e){this.delete(e)}init(){this.createCollection(window.$hsCopyMarkupCollection,this),this.onElementClickListener=()=>this.elementClick(),this.setTarget(),this.setWrapper(),this.addPredefinedItems(),this.el.addEventListener("click",this.onElementClickListener)}copy(){if(this.limit&&this.items.length>=this.limit)return!1;this.el.hasAttribute("disabled")&&this.el.setAttribute("disabled","");const e=this.target.cloneNode(!0),t=`${this.target.id}-${this.count++}`;e.setAttribute("id",t),this.addToItems(e),this.limit&&this.items.length>=this.limit&&this.el.setAttribute("disabled","disabled"),this.fireEvent("copy",e),(0,n.dispatch)("copy.copyMarkup",e,e)}addPredefinedItems(){Array.from(this.wrapper.children).filter(e=>!e.classList.contains("[--ignore-for-count]")).forEach(e=>{this.addToItems(e)}),this.limit&&this.items.length>=this.limit&&this.el.setAttribute("disabled","disabled")}setTarget(){const e="string"==typeof this.targetSelector?document.querySelector(this.targetSelector).cloneNode(!0):this.targetSelector.cloneNode(!0);this.target=e}setWrapper(){this.wrapper="string"==typeof this.wrapperSelector?document.querySelector(this.wrapperSelector):this.wrapperSelector}addToItems(e){const t=e.querySelector("[data-copy-markup-delete-item]");this.wrapper?this.wrapper.append(e):this.el.before(e),t&&(this.onDeleteItemButtonClickListener=()=>this.deleteItemButtonClick(e),t.addEventListener("click",this.onDeleteItemButtonClickListener)),this.items.push(e)}delete(e){if(e){const t=this.items.indexOf(e);-1!==t&&this.items.splice(t,1),e.remove(),this.fireEvent("delete",e),(0,n.dispatch)("delete.copyMarkup",e,e),this.limit&&this.items.length<this.limit&&this.el.removeAttribute("disabled")}}destroy(){const e=this.wrapper.querySelectorAll("[data-copy-markup-delete-item]");this.el.removeEventListener("click",this.onElementClickListener),e.length&&e.forEach(e=>e.removeEventListener("click",this.onDeleteItemButtonClickListener)),this.el.removeAttribute("disabled"),this.target=null,this.wrapper=null,this.items=null,window.$hsCopyMarkupCollection=window.$hsCopyMarkupCollection.filter(({element:e})=>e.el!==this.el)}static getInstance(e,t){const i=window.$hsCopyMarkupCollection.find(t=>t.element.el===("string"==typeof e?document.querySelector(e):e));return i?t?i:i.element:null}static autoInit(){window.$hsCopyMarkupCollection||(window.$hsCopyMarkupCollection=[]),window.$hsCopyMarkupCollection&&(window.$hsCopyMarkupCollection=window.$hsCopyMarkupCollection.filter(({element:e})=>document.contains(e.el))),document.querySelectorAll("[data-copy-markup]:not(.--prevent-on-load-init)").forEach(e=>{if(!window.$hsCopyMarkupCollection.find(t=>{var i;return(null===(i=null==t?void 0:t.element)||void 0===i?void 0:i.el)===e})){const t=e.getAttribute("data-copy-markup"),i=t?JSON.parse(t):{};new l(e,i)}})}}window.addEventListener("load",()=>{l.autoInit()}),"undefined"!=typeof window&&(window.HSCopyMarkup=l),t.default=l},75:function(e,t,i){
/*
 * HSComboBox
 * @version: 3.2.3
 * @author: Preline Labs Ltd.
 * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
 * Copyright 2024 Preline Labs Ltd.
 */
var s=this&&this.__awaiter||function(e,t,i,s){return new(i||(i=Promise))(function(n,o){function l(e){try{a(s.next(e))}catch(e){o(e)}}function r(e){try{a(s.throw(e))}catch(e){o(e)}}function a(e){var t;e.done?n(e.value):(t=e.value,t instanceof i?t:new i(function(e){e(t)})).then(l,r)}a((s=s.apply(e,t||[])).next())})},n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const o=i(806),l=n(i(287)),r=n(i(294));class a extends l.default{constructor(e,t,i){var s,n,o,l,r,a,h,d,c,u,p,m,g,v,f,w,y,b,C,S,L,I,E,T,x,k,A,O,P,B,$;super(e,t,i),this.isSearchLengthExceeded=!1;const M=e.getAttribute("data-combo-box"),D=M?JSON.parse(M):{},N=Object.assign(Object.assign({},D),t);this.gap=6,this.viewport=null!==(s="string"==typeof(null==N?void 0:N.viewport)?document.querySelector(null==N?void 0:N.viewport):null==N?void 0:N.viewport)&&void 0!==s?s:null,this.preventVisibility=null!==(n=null==N?void 0:N.preventVisibility)&&void 0!==n&&n,this.minSearchLength=null!==(o=null==N?void 0:N.minSearchLength)&&void 0!==o?o:0,this.apiUrl=null!==(l=null==N?void 0:N.apiUrl)&&void 0!==l?l:null,this.apiDataPart=null!==(r=null==N?void 0:N.apiDataPart)&&void 0!==r?r:null,this.apiQuery=null!==(a=null==N?void 0:N.apiQuery)&&void 0!==a?a:null,this.apiSearchQuery=null!==(h=null==N?void 0:N.apiSearchQuery)&&void 0!==h?h:null,this.apiSearchPath=null!==(d=null==N?void 0:N.apiSearchPath)&&void 0!==d?d:null,this.apiSearchDefaultPath=null!==(c=null==N?void 0:N.apiSearchDefaultPath)&&void 0!==c?c:null,this.apiHeaders=null!==(u=null==N?void 0:N.apiHeaders)&&void 0!==u?u:{},this.apiGroupField=null!==(p=null==N?void 0:N.apiGroupField)&&void 0!==p?p:null,this.outputItemTemplate=null!==(m=null==N?void 0:N.outputItemTemplate)&&void 0!==m?m:'<div class="dropdown-item combo-box-selected:dropdown-active" data-combo-box-output-item>\n\t\t\t\t<div class="flex justify-between items-center w-full">\n\t\t\t\t\t<span data-combo-box-search-text></span>\n\t\t\t\t\t<span class="hidden combo-box-selected:block">\n            <svg class="shrink-0 size-4 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 12l5 5L20 7"/></svg>\n\t\t\t\t\t</span>\n\t\t\t\t</div>\n\t\t\t</div>',this.outputEmptyTemplate=null!==(g=null==N?void 0:N.outputEmptyTemplate)&&void 0!==g?g:'<div class="dropdown-item">Nothing found...</div>',this.outputLoaderTemplate=null!==(v=null==N?void 0:N.outputLoaderTemplate)&&void 0!==v?v:'<span class="loading loading-spinner text-primary"></span>',this.groupingType=null!==(f=null==N?void 0:N.groupingType)&&void 0!==f?f:null,this.groupingTitleTemplate=null!==(w=null==N?void 0:N.groupingTitleTemplate)&&void 0!==w?w:"default"===this.groupingType?'<div class="block mb-1 text-xs font-semibold uppercase text-primary"></div>':'<button type="button" class="btn btn-soft btn-primary"></button>',this.tabsWrapperTemplate=null!==(y=null==N?void 0:N.tabsWrapperTemplate)&&void 0!==y?y:'<div class="overflow-x-auto p-4"></div>',this.preventSelection=null!==(b=null==N?void 0:N.preventSelection)&&void 0!==b&&b,this.preventAutoPosition=null!==(C=null==N?void 0:N.preventAutoPosition)&&void 0!==C&&C,this.preventClientFiltering=null!==(S=null==t?void 0:t.preventClientFiltering)&&void 0!==S?S:!!(null==N?void 0:N.apiSearchQuery)||!!(null==N?void 0:N.apiSearchPath),this.isOpenOnFocus=null!==(L=null==N?void 0:N.isOpenOnFocus)&&void 0!==L&&L,this.keepOriginalOrder=null!==(I=null==N?void 0:N.keepOriginalOrder)&&void 0!==I&&I,this.preserveSelectionOnEmpty=null===(E=null==N?void 0:N.preserveSelectionOnEmpty)||void 0===E||E,this.input=null!==(T=this.el.querySelector("[data-combo-box-input]"))&&void 0!==T?T:null,this.output=null!==(x=this.el.querySelector("[data-combo-box-output]"))&&void 0!==x?x:null,this.itemsWrapper=null!==(k=this.el.querySelector("[data-combo-box-output-items-wrapper]"))&&void 0!==k?k:null,this.items=null!==(A=Array.from(this.el.querySelectorAll("[data-combo-box-output-item]")))&&void 0!==A?A:[],this.tabs=[],this.toggle=null!==(O=this.el.querySelector("[data-combo-box-toggle]"))&&void 0!==O?O:null,this.toggleClose=null!==(P=this.el.querySelector("[data-combo-box-close]"))&&void 0!==P?P:null,this.toggleOpen=null!==(B=this.el.querySelector("[data-combo-box-open]"))&&void 0!==B?B:null,this.outputPlaceholder=null,this.selected=this.value=null!==($=this.el.querySelector("[data-combo-box-input]").value)&&void 0!==$?$:"",this.currentData=null,this.isOpened=!1,this.isCurrent=!1,this.animationInProcess=!1,this.selectedGroup="all",this.init()}inputFocus(){this.isOpened||(this.setResultAndRender(),this.open())}inputInput(e){const t=e.target.value.trim();t.length<=this.minSearchLength?this.setResultAndRender(""):this.setResultAndRender(t),this.preserveSelectionOnEmpty||""!==t||(this.selected="",this.value="",this.currentData=null),""!==this.input.value?this.el.classList.add("has-value"):this.el.classList.remove("has-value"),this.isOpened||this.open()}toggleClick(){this.isOpened?this.close():this.open(this.toggle.getAttribute("data-combo-box-toggle"))}toggleCloseClick(){this.close()}toggleOpenClick(){this.open()}init(){this.createCollection(window.$hsComboBoxCollection,this),this.build(),"undefined"!=typeof window&&(window.HSAccessibilityObserver||(window.HSAccessibilityObserver=new r.default),this.setupAccessibility())}build(){this.buildInput(),this.groupingType&&this.setGroups(),this.buildItems(),this.preventVisibility&&(this.preventAutoPosition||this.recalculateDirection()),this.toggle&&this.buildToggle(),this.toggleClose&&this.buildToggleClose(),this.toggleOpen&&this.buildToggleOpen()}getNestedProperty(e,t){return t.spl
```

### Core Architecture Module: `functions/addPrefix.js`
```
const defaultExcludedPrefixes = ['color-', 'size-', 'radius-', 'border', 'depth', 'noise']

const shouldExcludeVariable = (variableName, excludedPrefixes) => {
  if (variableName.startsWith('tw')) {
    return true
  }
  return excludedPrefixes.some(excludedPrefix => variableName.startsWith(excludedPrefix))
}

const prefixVariable = (variableName, prefix, excludedPrefixes) => {
  if (shouldExcludeVariable(variableName, excludedPrefixes)) {
    return variableName
  }
  return `${prefix}${variableName}`
}

const getPrefixedSelector = (selector, prefix) => {
  if (!selector.startsWith('.')) return selector
  return `.${prefix}${selector.slice(1)}`
}

const getPrefixedKey = (key, prefix, excludedPrefixes) => {
  const prefixAmpDot = prefix ? `&.${prefix}` : ''

  if (!prefix) return key

  if (key.startsWith('--')) {
    const variableName = key.slice(2)
    return `--${prefixVariable(variableName, prefix, excludedPrefixes)}`
  }

  if (key.startsWith('@') || key.startsWith('[')) {
    return key
  }

  if (key.startsWith('&')) {
    // If it's a complex selector with :not(), :has(), etc.
    if (key.match(/:[a-z-]+\(/)) {
      return key.replace(/\.([\w-]+)/g, `.${prefix}$1`)
    }
    // For simple &. cases
    if (key.startsWith('&.')) {
      return `${prefixAmpDot}${key.slice(2)}`
    }
    // For other & cases (like &:hover or &:not(...))
    return key.replace(/\.([\w-]+)/g, `.${prefix}$1`)
  }

  if (key.startsWith(':')) {
    return key.replace(/\.([\w-]+)/g, `.${prefix}$1`)
  }

  if (key.includes('.') && !key.includes(' ') && !key.includes('>') && !key.includes('+') && !key.includes('~')) {
    return key
      .split('.')
      .filter(Boolean)
      .map(part => prefix + part)
      .join('.')
      .replace(/^/, '.')
  }

  if (key.includes('>') || key.includes('+') || key.includes('~')) {
    // For comma-separated selectors
    if (key.includes(',')) {
      return key
        .split(/\s*,\s*/)
        .map(part => {
          // Replace class names with prefixed versions for each part
          return part.replace(/\.([\w-]+)/g, `.${prefix}$1`)
        })
        .join(', ')
    }

    // For simple combinators (not comma-separated)
    let processedKey = key.replace(/\.([\w-]+)/g, `.${prefix}$1`)

    // Add a space before combinators at the beginning
    if (processedKey.startsWith('>') || processedKey.startsWith('+') || processedKey.startsWith('~')) {
      processedKey = ` ${processedKey}`
    }

    return processedKey
  }

  if (key.includes(' ')) {
    return key
      .split(/\s+/)
      .map(part => {
        if (part.startsWith('.')) {
          return getPrefixedSelector(part, prefix)
        }
        return part
      })
      .join(' ')
  }

  if (key.includes(':')) {
    const [selector, ...pseudo] = key.split(':')
    if (selector.startsWith('.')) {
      return `${getPrefixedSelector(selector, prefix)}:${pseudo.join(':')}`
    }
    return key.replace(/\.([\w-]+)/g, `.${prefix}$1`)
  }

  if (key.startsWith('.')) {
    return getPrefixedSelector(key, prefix)
  }

  return key
}

const processArrayValue = (value, prefix, excludedPrefixes) => {
  return value.map(item => {
    if (typeof item === 'string') {
      if (item.startsWith('.')) {
        return prefix ? `.${prefix}${item.slice(1)}` : item
      }
      return processStringValue(item, prefix, excludedPrefixes)
    }
    return item
  })
}

const processStringValue = (value, prefix, excludedPrefixes) => {
  if (prefix === 0) return value
  return value.replace(/var\(--([^)]+)\)/g, (match, variableName) => {
    if (shouldExcludeVariable(variableName, excludedPrefixes)) {
      return match
    }
    return `var(--${prefix}${variableName})`
  })
}

const processValue = (value, prefix, excludedPrefixes) => {
  if (Array.isArray(value)) {
    return processArrayValue(value, prefix, excludedPrefixes)
  } else if (typeof value === 'object' && value !== null) {
    return addPrefix(value, prefix, excludedPrefixes)
  } else if (typeof value === 'string') {
    return processStringValue(value, prefix, excludedPrefixes)
  } else {
    return value
  }
}

export const addPrefix = (obj, prefix, excludedPrefixes = defaultExcludedPrefixes) => {
  return Object.entries(obj).reduce((result, [key, value]) => {
    const newKey = getPrefixedKey(key, prefix, excludedPrefixes)
    result[newKey] = processValue(value, prefix, excludedPrefixes)
    return result
  }, {})
}

```

### Core Architecture Module: `functions/breakpoints.js`
```
export default {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
}

```

### Core Architecture Module: `functions/cleanCss.js`
```
export const cleanCss = cssContent => {
  // Precompile regular expressions for better performance
  const emptyFallbackRegex = /var\((--[^,)]+),\s*\)/g
  const spacingWidthFallbackRegex = /var\((--(spacing|width)[\w-]*),\s*((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g
  const spacingVarRegex = /var\(--spacing\)/g

  // Remove empty fallbacks
  cssContent = cssContent.replace(emptyFallbackRegex, 'var($1)')

  // Remove spacing, width css variable if there's a fallback value
  cssContent = cssContent.replace(spacingWidthFallbackRegex, (match, variable, prefix, fallback) => {
    // If there's no actual fallback value, return the original match
    return fallback.trim() ? fallback.trim() : match
  })

  // Replace all `var(--spacing)` with `0.25rem`
  cssContent = cssContent.replace(spacingVarRegex, '0.25rem')

  return cssContent
}

```

### Core Architecture Module: `functions/compileAndExtractStyles.js`
```
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { compile } from 'tailwindcss'

export async function loadThemes() {
  const [defaultTheme, theme] = await Promise.all([
    fs.readFile(path.join(import.meta.dirname, '../node_modules/tailwindcss/theme.css'), 'utf-8'),
    fs.readFile(path.join(import.meta.dirname, './variables.css'), 'utf-8')
  ])
  return { defaultTheme, theme }
}

export async function compileAndExtractStyles(styleContent, defaultTheme, theme) {
  const compiledContent = (
    await compile(`
    @layer theme{${defaultTheme}${theme}}
    @layer wrapperStart{${styleContent}}
    @layer wrapperEnd
  `)
  ).build([])

  const startIndex = compiledContent.indexOf('@layer wrapperStart')
  const endIndex = compiledContent.indexOf('@layer wrapperEnd')

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Failed to find wrapper layers in compiled content')
  }

  const openingBraceIndex = compiledContent.indexOf('{', startIndex)
  const closingBraceIndex = compiledContent.lastIndexOf('}', endIndex)

  if (openingBraceIndex === -1 || closingBraceIndex === -1 || openingBraceIndex >= closingBraceIndex) {
    throw new Error('Invalid wrapper structure in compiled content')
  }

  return compiledContent.substring(openingBraceIndex + 1, closingBraceIndex).trim()
}

```

### Core Architecture Module: `functions/copyFile.js`
```
import fs from 'fs/promises'
import path from 'path'

export const copyFile = async (from, to, newName = null) => {
  try {
    const destDir = path.dirname(to)
    await fs.mkdir(destDir, { recursive: true })

    let destPath = to
    if (newName) {
      destPath = path.join(destDir, newName)
    }

    await fs.copyFile(from, destPath)
  } catch (error) {
    throw new Error(`Error copying file from ${from} to ${to}: ${error.message}`)
  }
}

```

### Core Architecture Module: `functions/createDirectoryBasedOnFileNames.js`
```
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const createDirectoryBasedOnFileNames = async (fileName, fileExtension, distDir) => {
  const componentName = path.basename(fileName, fileExtension)
  const componentDir = path.join(distDir, componentName)
  await fs.mkdir(componentDir, { recursive: true })
  return componentDir
}

```

### Core Architecture Module: `functions/createPluginFiles.js`
```
import { promises as fs } from 'fs'
import path from 'path'

export const createPluginFiles = async (type, componentDir, jsContent, fileName) => {
  const types = {
    base: 'addBase',
    component: 'addComponents',
    utility: 'addUtilities'
  }

  // create object.js
  const objectJsPath = path.join(componentDir, 'object.js')
  await fs.writeFile(objectJsPath, `export default ${jsContent};`)

  // create index.js
  const indexJsPath = path.join(componentDir, 'index.js')
  const indexJsContent = `import ${fileName} from './object.js';
import { addPrefix } from '../../functions/addPrefix.js';

export default ({ ${types[type]}, prefix = '' }) => {
  const prefixed${fileName} = addPrefix(${fileName}, prefix);
  ${types[type]}({ ...prefixed${fileName} });
};
`
  await fs.writeFile(indexJsPath, indexJsContent)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #118** (2025-09-26): **bug: Dropdown form input elements non functional**
  *Symptoms*: ### What version of FlyonUI are you using?  2.4.0  ### Which browsers are you seeing the problem on?  Edge  ### Reproduction URL  https://flyonui.com/docs/overlays/dropdown/  ### Describe your issue  Dropdown input fields are currently non-functional—typing into any of them is not possible.
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @mateors <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @mateors,  Could you please provide more details? An example would help.
  > @PruthviPraj00 This is something you’ll need to simulate on your end. Please try entering any text into the yellow-marked input field. You won’t be able to type because the dropdown modal blocks interaction. This is the issue I’m currently facing, and I’ll share a few more related problems shortly.   <img width="1095" height="659" alt="Image" src="https://github.com/user-attachments/assets/5c3a6d25-dfdc-41d8-b014-22420dece71e" />

- **Issue #117** (2025-09-26): **Alternative to popover trigger:focus interaction:true**
  *Symptoms*:  ### Discussed in https://github.com/themeselection/flyonui/discussions/115  <div type='discussions-op-text'>  <sup>Originally posted by **cbecker** August 27, 2025</sup> Updating flyonui from 2.1.0 I noticed that our code doesn't work anymore.  We were using the documented feature --trigger:focus --interaction:true from popover tooltips, but it was recently removed.  Is there an alternative to provide similar functionality? or will it be re-added in a newer version?  Thank you.</div>
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @PruthviPraj00 <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello  @cbecker,  We've released a fix for the bug. Please update to the latest version and check if the issue has been resolved. Cheers!

- **Issue #116** (2025-09-26): **bug: Modal keyboard control not working**
  *Symptoms*: ### What version of FlyonUI are you using?  v2.4.0  ### Which browsers are you seeing the problem on?  All browsers  ### Reproduction URL  https://flyonui.com/docs/overlays/modal/#keyboard-control  ### Describe your issue  Hi Flyonui team, First of all, thanks for your work.  I found that the `data-overlay-keyboard` doesn't work anymore.  Steps to reproduce : 1. Add `data-overlay-keyboard="false"` to the div.overlay.modal 2. Open the modal 3. Press 'Escape'  Unfortunately, the modal is closing.
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @LexAgone <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hey **@LexAgone**, thank you for reporting the bug. We'll fix it in the next release. 
  > Hello  @LexAgone,  We've released a fix for the bug. Please update to the latest version and check if the issue has been resolved. Cheers!

- **Issue #114** (2025-09-26): **bug: RTL Nested dropdowns in Navbar open under parent instead of side (placement ignored)**
  *Symptoms*: ### What version of FlyonUI are you using?  2.4  ### Which browsers are you seeing the problem on?  All browsers  ### Reproduction URL  https://flyonui.com/docs/navigations/navbar/#multilevel-navigation-dropdown  ### Describe your issue  In RTL mode, nested dropdowns inside the Navbar component do not open to the left as expected; instead, they drop down vertically under the parent item.
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @mmdfarajzadeh <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @mmdfarajzadeh,  Thank you for reporting this issue. Our team will review it and incorporate the improvements in the next update.
  > Hello  @mmdfarajzadeh,  We've released a fix for the bug. Please update to the latest version and check if the issue has been resolved. Cheers!

- **Issue #85** (2025-04-10): **bug: Input numer doesnt support steps lower than 1**
  *Symptoms*: ### What version of FlyonUI are you using?  2.1.0  ### Which browsers are you seeing the problem on?  Chrome, but I don't think it works in any other browser.  ### Describe your issue  I just copied the example from the Input Number documentation. and tried to change the step to 0.5, but it does not work anymore.  ``` <div class="input max-w-sm" data-input-number='{ "step": 0.5 }'>       <input type="text" value="0" aria-label="Step control" data-input-number-input />       <span class="my-auto flex gap-3">         <button type="button" class="btn btn-primary btn-soft size-5.5 min-h-0 rounded-sm p-0" aria-label="Decrement button" data-input-number-decrement >           <span class="icon-[tabler--minus] size-3.5 shrink-0"></span>         </button>         <button type="button" class="btn btn-primary btn-soft size-5.5 min-h-0 rounded-sm p-0" aria-label="Increment button" data-input-number-increment >           <span class="icon-[tabler--plus] size-3.5 shrink-0"></span>         </button>       </span>   </div> ```  If you could fix it in the next version, that would be cool.
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @akemmanuel <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @akemmanuel ,  We’ve reviewed the code you provided and were able to run it successfully without encountering any issues. To help resolve the problem on your end, could you please ensure that the FlyonUI JavaScript is correctly included in your project?  We recommend revisiting the installation guide to verify that all steps have been followed properly:  [FlyonUI Quick Start Guide](https://flyonui.com/docs/getting-started/quick-start/)  If the issue persists, we’d appreciate it if you could share more details about the error or your project setup. This will help us assist you more effectively.  ~Best regards,

- **Issue #60** (2025-03-25): **bug: table border bottom issue with 1 row**
  *Symptoms*: ### What version of FlyonUI are you using?  v1.3.0  ### Which browsers are you seeing the problem on?  All browsers  ### Reproduction URL  https://stackblitz.com/edit/bolt-vanilla-vite-xmsl1gdj?file=index.html  ### Describe your issue  The issue (occurs when there is 1 row only): ![Image](https://github.com/user-attachments/assets/67b0240f-3809-46a8-a739-2d56aa51deb0)  The same table without the issue (because there are > 1 rows): ![Image](https://github.com/user-attachments/assets/a8285823-9c3d-4060-9745-7c07dd1e1a56)
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @FPierre <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @FPierre,    Thank you for bringing this issue to our attention.    We have analyzed the problem and will be fixing it in the next release. We will inform you once the fix is live.    We appreciate your patience and understanding.    ~ Best regards,
  > Hello @FPierre ,  The issue has been resolved in the latest release. Please check out FlyonUI version v2.0.0, which is now compatible with Tailwind 4.

- **Issue #56** (2025-03-25): **bug: float input label width problem when blur**
  *Symptoms*: ### What version of FlyonUI are you using?  v1.3.0  ### Which browsers are you seeing the problem on?  _No response_  ### Reproduction URL  https://stackblitz.com/edit/sb1-hnyuz3xv?file=index.html  ### Describe your issue  Two screenshots.  ![Image](https://github.com/user-attachments/assets/7d978c3c-3843-4c32-94d8-640f65b243b6)  ![Image](https://github.com/user-attachments/assets/79420931-8269-4bda-9b06-e2d0e652d1de)
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @poorthink <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @cinthus,  Thank you for reaching out to us.    I checked the StackBlitz link you provided, but I couldn’t find the issue mentioned in the image. I have also attached a screenshot from my side. Could you please share more detailed reproduction steps? This will help me assist you better.    **Screenshots:** ![Image](https://github.com/user-attachments/assets/e70e0caf-5b61-4414-a197-af8c7c498e5d)  ![Image](https://github.com/user-attachments/assets/03d2260d-cb1e-4fb1-a29c-b8c6c567c966)  ~Best regards,
  > > Hello [@cinthus](https://github.com/cinthus), >  > Thank you for reaching out to us. >  > I checked the StackBlitz link you provided, but I couldn’t find the issue mentioned in the image. I have also attached a screenshot from my side. Could you please share more detailed reproduction steps? This will help me assist you better. >  > **Screenshots:** ![Image](https://github.com/user-attachments/assets/e70e0caf-5b61-4414-a197-af8c7c498e5d) >  > ![Image](https://github.com/user-attachments/assets/03d2260d-cb1e-4fb1-a29c-b8c6c567c966) >  > ~Best regards,  I don't know how to describe it exactly. It looks like there is a white or black layer covering from top when the float label moving back to it's original position. You can see it in gif.  ![Image](https://github.com/user-attachments/assets/b14d0853-2a94-4670-80fc-d5e6d40c55ef)  It's not easy to recognize in the similar background. It's normal by setting label to w-fit.

- **Issue #54** (2025-03-25): **bug: Menu title will have an active effect by click when it is not plain text.**
  *Symptoms*: ### What version of FlyonUI are you using?  1.3.0  ### Which browsers are you seeing the problem on?  _No response_  ### Reproduction URL  https://stackblitz.com/edit/bolt-vanilla-vite-ymjdahhq?file=index.html  ### Describe your issue   ![Image](https://github.com/user-attachments/assets/39a1e3a1-0916-4607-9de3-3c0a69e21584)
  **Post-Mortem & Fix Analysis**:
  > <div>   <strong>Hi @poorthink <img     src="https://user-images.githubusercontent.com/47495003/171637050-b790338b-c8fd-4807-af43-19c6fd6713ed.gif"     height="25px" width="25px"></strong>    <p>Thank you for your support in helping us improve FlyonUI!</p>    <p>We’ve received your submission and will respond within few business days. Our team handles issues one at a time, and we’ll be reviewing yours as soon as possible. </p>    <p>In the meantime, any additional details or a reproducible example would be greatly appreciated and will help us resolve the issue more efficiently.</p>    <p>Thank you for your patience and understanding!</p> </div>
  > Hello @poorthink,  Thank you for bringing this to our attention. We appreciate it and will inform you once the issue has been resolved.
  > Hello @xchristopherhayes ,  The issue has been resolved in the latest release. Please check out FlyonUI version v2.0.0, which is now compatible with Tailwind 4.

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

### Incident Patch 1: `80e33d44` (2026-03-20)
**Commit Message**: refactor(readme): fixes some grammatical mistakes in readme file

**File**: `README.md` (modified, +3/-3)
```diff
@@ -57,7 +57,7 @@ Under the hood, it uses the strengths of:
 > Bundled third-party components are governed by their respective licenses as outlined in the [license page](https://github.com/themeselection/flyonui/blob/main/LICENSE) and files.
 
 - [Tailwind CSS](https://tailwindcss.com/) A utility-first CSS framework that helps you build beautiful websites with ease.
-- [daisyUI](https://daisyui.com/) adds component semantic class names to Tailwind CSS so you can make beautiful websites faster, easier and Maintainable.
+- [daisyUI](https://daisyui.com/) adds component semantic class names to Tailwind CSS so you can make beautiful websites faster, easier and maintainable.
 - [Preline](https://preline.co/plugins.html) JavaScript headless & fully unstyled Tailwind plugins for accessible, responsive UI. Enhance experiences with animations, transitions, and more.
 
 ## Why should I use FlyonUI? 💡
@@ -214,10 +214,10 @@ To use FlyonUI, ensure that you have [Node.js](https://nodejs.org/en/) and [Tail
    ```css
    @import "tailwindcss";
    @plugin "flyonui";
-   @import "./node_modules/flyonui/variants.css"; // Require only if you want to use FlyonUI JS component
+   @import "./node_modules/flyonui/variants.css"; // Require only if you want to use FlyonUI JS components
 
  
-   @source "./node_modules/flyonui/dist/index.js"; // Require only if you want to use FlyonUI JS component
+   @source "./node_modules/flyonui/dist/index.js"; // Require only if you want to use FlyonUI JS components
    ```
 
    This ensures that FlyonUI's styling is applied correctly throughout your project.
```

---

### Incident Patch 2: `855be9f6` (2026-02-04)
**Commit Message**: Revise Preline UI licensing details in LICENSE file

Updated licensing information for Preline UI, correcting copyright year and clarifying usage terms.

**File**: `LICENSE` (modified, +7/-10)
```diff
@@ -23,6 +23,7 @@ SOFTWARE.
 ---
 
 ### Third-Party Licenses
+FlyonUI's original code is licensed under MIT. Bundled third-party components, including Daisy UI and Preline UI JavaScript sources, are governed by their respective licenses and used under explicit permission.
 
 FlyonUI incorporates the following third-party open-source software:
 
@@ -73,7 +74,7 @@ The below files are from daisyUI (https://github.com/saadeghi/daisyui) under dai
 
 - @Author: Preline Labs Ltd.
 - @Website: https://preline.co
-- @License: Preline UI is free for both personal and commercial projects, released under dual license terms "MIT" and "Preline UI Fair Use License", and copyrighted 2024 by Preline Labs Ltd.
+- @License: Preline UI is free for both personal and commercial projects, released under dual license terms "MIT" and "Preline UI Fair Use License", and copyrighted 2026 by Preline Labs Ltd.
 
 MIT License
 
@@ -100,35 +101,31 @@ SOFTWARE.
 Preline UI Fair Use License
 
 1. Usage Restrictions:
-
 - Competing Products: The Software shall not be used to create any product or service that directly competes with Preline UI. A competing product is defined as any software or service that replicates the primary functionalities of Preline UI.
 - Misuse and Abuse: The Software shall not be used for any activities that are deemed harmful, abusive, or intended to deceive end-users. This includes, but is not limited to, creating malware, engaging in fraudulent activities, or infringing on the rights of others.
 
 2. Commercial Derivative Works:
-   Users are permitted to create and sell derivative works such as templates, themes, and page builders, provided that:
-
+Users are permitted to create and sell derivative works such as templates, themes, and page builders, provided that:
 - The derivative works must not be marketed as competing products.
 - Proper attribution must be given to the original author, including the name "Preline UI" and a link to the original repository.
 - A clear distinction must be made between the original work and the derivative work, ensuring that users understand the source of each.
 
 3. Distribution and Sublicensing:
-   Redistribution of the Software in its original or modified form is allowed under the MIT License, with the following additional conditions:
-
+Redistribution of the Software in its original or modified form is allowed under the MIT License, with the following additional conditions:
 - Redistributions must include this Fair Use License in addition to the MIT License.
 - Redistributions must not remove or alter any licensing information or notices.
 - Must include clear attribution with a link to the original repository.
 
 4. Termination:
-   The author reserves the right to terminate the rights granted under this Fair Use License if the user fails to comply with the terms. Upon termination, the user must cease all use and distribution of the Software, and destroy all copies in their possession.
+The author reserves the right to terminate the rights granted under this Fair Use License if the user fails to comply with the terms. Upon termination, the user must cease all use and distribution of the Software, and destroy all copies in their possession.
 
 5. Enforcement and Compliance:
-
 - Users who believe that the terms of this Fair Use License have been violated are encouraged to report the violation to the author.
 - The author reserves the right to take legal action to enforce compliance with this Fair Use License.
 
-The below files are from Preline (https://github.com/htmlstreamofficial/preline) under the Preline MIT license and using them in other projects requires including Preline MIT license text:
+The files below are from Preline (https://github.com/htmlstreamofficial/preline) under the Preline MIT license, and using them in other projects requires including the Preline MIT license text:
 
-- `src/js/plugins/` (modified)
+- `src/js/plugins/` (entire directory, with modifications)
 - `dts-config.js`
 - `preline.d.ts` (modified)
 - `preline.js` (modified)
```

---

### Incident Patch 3: `0bc42340` (2025-07-31)
**Commit Message**: fix: update link to contributing guidelines in README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -353,7 +353,7 @@ Join the FlyonUI community to discuss the library, ask questions, and share your
 
 Fix a bug, or add a new feature. You can make a pull request and see your code in the next version of FlyonUI.
 
-Before adding a pull request, please see the **[contributing guidelines](https://github.com/themeselection/flyonui/blob/main/.github/CONTRIBUTING.md)**.
+Before adding a pull request, please see the **[contributing guidelines](https://github.com/themeselection/flyonui/blob/main/CONTRIBUTING.md)**.
 
 ## Credits 🤘
 
```

---

### Incident Patch 4: `3e45aec6` (2025-05-12)
**Commit Message**: Merge pull request #93 from dax/fix-selected-option

fix: #86 Keep selected value when building options of HSSelect

**File**: `src/js/plugins/select/index.ts` (modified, +3/-2)
```diff
@@ -800,13 +800,14 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
         options.rest[key] = el[key]
       })
 
-      this.buildOriginalOption(title, `${value}`, id, false, false, options as ISingleOptionOptions & IApiFieldMap)
+      const isSelected = (typeof this.value === 'string' && this.value === `${value}`) || (Array.isArray(this.value) && this.value.includes(`${value}`));
+      this.buildOriginalOption(title, `${value}`, id, false, isSelected, options as ISingleOptionOptions & IApiFieldMap)
 
       this.buildOptionFromRemoteData(
         title,
         `${value}`,
         false,
-        false,
+        isSelected,
         `${i}`,
         id,
         options as ISingleOptionOptions & IApiFieldMap
```

---

### Incident Patch 5: `150675ea` (2025-04-12)
**Commit Message**: fix: #86 Keep selected value when building options of HSSelect

**File**: `src/js/plugins/select/index.ts` (modified, +3/-2)
```diff
@@ -800,13 +800,14 @@ class HSSelect extends HSBasePlugin<ISelectOptions> implements ISelect {
         options.rest[key] = el[key]
       })
 
-      this.buildOriginalOption(title, `${value}`, id, false, false, options as ISingleOptionOptions & IApiFieldMap)
+      const isSelected = (typeof this.value === 'string' && this.value === `${value}`) || (Array.isArray(this.value) && this.value.includes(`${value}`));
+      this.buildOriginalOption(title, `${value}`, id, false, isSelected, options as ISingleOptionOptions & IApiFieldMap)
 
       this.buildOptionFromRemoteData(
         title,
         `${value}`,
         false,
-        false,
+        isSelected,
         `${i}`,
         id,
         options as ISingleOptionOptions & IApiFieldMap
```

---

### Incident Patch 6: `a9a2a55f` (2025-04-06)
**Commit Message**: fix: Indentation

**File**: `src/components/textarea.css` (modified, +3/-3)
```diff
@@ -43,9 +43,9 @@
     &:first-child {
       @apply py-2 ps-4;
     }
-      &:nth-child(2) {
-        @apply py-2;
-      }
+    &:nth-child(2) {
+      @apply py-2;
+    }
     &:last-child {
       @apply py-2 pe-4;
     }
```

---

### Incident Patch 7: `3cf3d366` (2025-04-06)
**Commit Message**: fix(textarea): css to allow placeholder to have padding and label to be position correctly when using both trailing and leading icons in textarea.css

**File**: `src/components/textarea.css` (modified, +8/-0)
```diff
@@ -43,6 +43,9 @@
     &:first-child {
       @apply py-2 ps-4;
     }
+      &:nth-child(2) {
+        @apply py-2;
+      }
     &:last-child {
       @apply py-2 pe-4;
     }
@@ -56,10 +59,15 @@
     @apply py-2 ps-4;
   }
 
+  :where(.textarea-floating:nth-child(2)) > textarea {
+    @apply py-2;
+  }
+
   :where(.textarea-floating:last-child) > textarea {
     @apply py-2 pe-4;
   }
 
+  :where(.textarea-floating:nth-child(2)) .textarea-floating-label,
   :where(.textarea-floating:last-child) .textarea-floating-label {
     @apply ms-0;
   }
```

---

### Incident Patch 8: `27ed10f9` (2025-03-24)
**Commit Message**: fix(release): change publish command to use npm instead of runtime variable

**File**: `.github/workflows/release-new-version.yml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ jobs:
 
       - name: Publish package to NPM
         if: github.repository == 'themeselection/flyonui'
-        run: ${{ env.runtime }} publish
+        run: npm publish
         env:
           NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
```

---

### Incident Patch 9: `20101a1c` (2024-12-20)
**Commit Message**: fix

**File**: `src/components/styled/select.css` (modified, +4/-4)
```diff
@@ -145,16 +145,16 @@
   }
 }
 
-.select:focus:valid ~ .select-floating-label,
+.select:focus.is-valid ~ .select-floating-label,
 .validate .select:focus:valid ~ .select-floating-label,
-.select:focus:valid ~ .select-filled-label,
+.select:focus.is-valid ~ .select-filled-label,
 .validate .select:focus:valid ~ .select-filled-label {
   @apply text-success;
 }
 
-.select:focus:invalid ~ .select-floating-label,
+.select:focus.is-invalid ~ .select-floating-label,
 .validate .select:focus:invalid ~ .select-floating-label,
-.select:focus:invalid ~ .select-filled-label,
+.select:focus.is-invalid ~ .select-filled-label,
 .validate .select:focus:invalid ~ .select-filled-label {
   @apply text-error;
 }
```

---

### Incident Patch 10: `8d1a0888` (2024-12-20)
**Commit Message**: fix

**File**: `src/components/styled/select.css` (modified, +8/-8)
```diff
@@ -145,17 +145,17 @@
   }
 }
 
-.select:focus.is-valid ~ .select-floating-label,
-.validate .select:focus.is-valid ~ .select-floating-label,
-.select:focus.is-valid ~ .select-filled-label,
-.validate .select:focus.is-valid ~ .select-filled-label {
+.select:focus:valid ~ .select-floating-label,
+.validate .select:focus:valid ~ .select-floating-label,
+.select:focus:valid ~ .select-filled-label,
+.validate .select:focus:valid ~ .select-filled-label {
   @apply text-success;
 }
 
-.select:focus.is-invalid ~ .select-floating-label,
-.validate .select:focus.is-invalid ~ .select-floating-label,
-.select:focus.is-invalid ~ .select-filled-label,
-.validate .select:focus.is-invalid ~ .select-filled-label {
+.select:focus:invalid ~ .select-floating-label,
+.validate .select:focus:invalid ~ .select-floating-label,
+.select:focus:invalid ~ .select-filled-label,
+.validate .select:focus:invalid ~ .select-filled-label {
   @apply text-error;
 }
 
```

**File**: `src/components/styled/textarea.css` (modified, +4/-4)
```diff
@@ -127,16 +127,16 @@ textarea {
 }
 
 .textarea:focus.is-valid ~ .textarea-floating-label,
-.validate .textarea:focus.is-valid ~ .textarea-floating-label,
+.validate .textarea:focus:valid ~ .textarea-floating-label,
 .textarea:focus.is-valid ~ .textarea-filled-label,
-.validate .textarea:focus.is-valid ~ .textarea-filled-label {
+.validate .textarea:focus:valid ~ .textarea-filled-label {
   @apply text-success;
 }
 
 .textarea:focus.is-invalid ~ .textarea-floating-label,
-.validate .textarea:focus.is-invalid ~ .textarea-floating-label,
+.validate .textarea:focus:invalid ~ .textarea-floating-label,
 .textarea:focus.is-invalid ~ .textarea-filled-label,
-.validate .textarea:focus.is-invalid ~ .textarea-filled-label {
+.validate .textarea:focus:invalid ~ .textarea-filled-label {
   @apply text-error;
 }
 
```

---

### Incident Patch 11: `0a1587e9` (2024-12-19)
**Commit Message**: fix styles

**File**: `src/components/styled/select.css` (modified, +4/-4)
```diff
@@ -146,16 +146,16 @@
 }
 
 .select:focus.is-valid ~ .select-floating-label,
-.validate .select:focus:is-valid ~ .select-floating-label,
+.validate .select:focus.is-valid ~ .select-floating-label,
 .select:focus.is-valid ~ .select-filled-label,
-.validate .select:focus:is-valid ~ .select-filled-label {
+.validate .select:focus.is-valid ~ .select-filled-label {
   @apply text-success;
 }
 
 .select:focus.is-invalid ~ .select-floating-label,
-.validate .select:focus:is-invalid ~ .select-floating-label,
+.validate .select:focus.is-invalid ~ .select-floating-label,
 .select:focus.is-invalid ~ .select-filled-label,
-.validate .select:focus:is-invalid ~ .select-filled-label {
+.validate .select:focus.is-invalid ~ .select-filled-label {
   @apply text-error;
 }
 
```

**File**: `src/components/styled/textarea.css` (modified, +4/-4)
```diff
@@ -127,16 +127,16 @@ textarea {
 }
 
 .textarea:focus.is-valid ~ .textarea-floating-label,
-.validate .textarea:focus:is-valid ~ .textarea-floating-label,
+.validate .textarea:focus.is-valid ~ .textarea-floating-label,
 .textarea:focus.is-valid ~ .textarea-filled-label,
-.validate .textarea:focus:is-valid ~ .textarea-filled-label {
+.validate .textarea:focus.is-valid ~ .textarea-filled-label {
   @apply text-success;
 }
 
 .textarea:focus.is-invalid ~ .textarea-floating-label,
-.validate .textarea:focus:is-invalid ~ .textarea-floating-label,
+.validate .textarea:focus.is-invalid ~ .textarea-floating-label,
 .textarea:focus.is-invalid ~ .textarea-filled-label,
-.validate .textarea:focus:is-invalid ~ .textarea-filled-label {
+.validate .textarea:focus.is-invalid ~ .textarea-filled-label {
   @apply text-error;
 }
 
```

---

### Incident Patch 12: `6b663bd5` (2024-10-09)
**Commit Message**: refactor(multi): refactor CSS class names for progress and table components

**File**: `src/components/styled/progress.css` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     @apply border-base-content/25 border;
   }
 
-  &-stripped {
+  &-striped {
     background-image: linear-gradient(
       45deg,
       rgba(255, 255, 255, 0.15) 25%,
```

**File**: `src/components/styled/table.css` (modified, +7/-7)
```diff
@@ -17,28 +17,28 @@
   }
   tr.active,
   tr.active:nth-child(even),
-  &-stripped tbody tr:nth-child(even) {
+  &-striped tbody tr:nth-child(even) {
     @apply bg-base-content/10;
   }
   tr.hover,
   tr.hover:nth-child(even) {
     @apply [@media(hover:hover)]:hover:bg-base-content/5;
   }
 
-  &-stripped {
+  &-striped {
     tr.active,
     tr.active:nth-child(even),
-    &-stripped tbody tr:nth-child(even) {
+    &-striped tbody tr:nth-child(even) {
       @apply bg-base-content/10;
     }
   }
-  &-stripped tr.hover,
-  &-stripped tr.hover:nth-child(even) {
+  &-striped tr.hover,
+  &-striped tr.hover:nth-child(even) {
     @apply [@media(hover:hover)]:bg-base-content/5;
   }
 
-  &-stripped-columns td:nth-child(even),
-  &-stripped-columns th:nth-child(even) {
+  &-striped-columns td:nth-child(even),
+  &-striped-columns th:nth-child(even) {
     @apply bg-base-content/10;
   }
 
```

**File**: `src/components/unstyled/table.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   :where(.table-pin-cols tr th) {
     @apply bg-base-100 sticky end-0 start-0;
   }
-  &-stripped tbody tr:nth-child(even) :where(.table-pin-cols tr th) {
+  &-striped tbody tr:nth-child(even) :where(.table-pin-cols tr th) {
     @apply bg-base-200;
   }
 }
```

---

### Incident Patch 13: `b1ae9055` (2024-10-01)
**Commit Message**: refactor(package.json): updated homepage and bugs URL

**File**: `package.json` (modified, +2/-2)
```diff
@@ -4,13 +4,13 @@
   "description": "The most easiest, free and open-source Tailwind CSS component library with semantic classes.",
   "author": "ThemeSelection",
   "license": "MIT",
-  "homepage": "",
+  "homepage": "https://flyonui.com/",
   "repository": {
     "type": "git",
     "url": "git+https://github.com/themeslection/flyonui.git"
   },
   "bugs": {
-    "url": "issues_url"
+    "url": "https://github.com/themeselection/flyonui/issues"
   },
   "keywords": [
     "flyonui",
```

#### Recent Merged Pull Requests:
- **PR #143** (closed): Alert secondary (@PierreLebedel)
- **PR #108** (closed): Make plugin's destroy() resilient to DOM changes (@cbecker)
- **PR #100** (closed): fix(apexcharts.css): replace Tailwind @apply with standard CSS to res… (@nx2io)
- **PR #93** (2025-05-12): fix: #86 Keep selected value when building options of HSSelect (@dax)
- **PR #83** (2025-04-07): fix(textarea): css to allow placeholder to have padding and label to be position correctly when using both trailing and leading icons (@michaelcozzolino)
- **PR #58** (2025-03-21): Upddated searchWrapperClasses style (@IlGalvo)
- **PR #30** (2025-01-03): fix .is-valid and .is-invalid in css (@lilabyte)
- **PR #3** (2024-10-04): Update LICENSE (@saadeghi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
