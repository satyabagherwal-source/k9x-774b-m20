# Forensic Learning Record (Deep Inspection): htmlstreamofficial/preline

> **Canonical Artifact**: `07_PROJECT_LEARNING/htmlstreamofficial-preline-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/htmlstreamofficial/preline](https://github.com/htmlstreamofficial/preline))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:53.999Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `htmlstreamofficial/preline`
- **Description**: Preline UI is an open-source set of prebuilt UI components based on the utility-first Tailwind CSS framework.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6459 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dts-config.js`
```
const fs = require('fs');

const pluginsDir = './src/plugins';
const helpersDir = './src/helpers';
const distDir = './dist';
const excludePlugins = ['base-plugin', 'docs-scrollspy'];

const outputConfig = { noBanner: true };

const config = {
	compilationOptions: {
		preferredConfigPath: './tsconfig.json',
	},
	entries: [
		{
			filePath: './src/globals.ts',
			outFile: './dist/globals.d.ts',
			output: outputConfig,
		},
		{
			filePath: './src/index.ts',
			outFile: './dist/index.d.ts',
			output: outputConfig,
		},
		{
			filePath: './src/auto/index.ts',
			outFile: './dist/auto.d.ts',
			output: outputConfig,
		},
		...fs
			.readdirSync(pluginsDir)
			.map((pluginName) => writeFile(pluginsDir, pluginName))
			.filter(Boolean),
		...fs
			.readdirSync(helpersDir)
			.map((pluginName) => writeFile(helpersDir, pluginName, 'helper-'))
			.filter(Boolean),
	],
};

function writeFile(dir, plugin, prefix = '') {
	const pluginDir = `${dir}/${plugin}`;
	if (
		!fs.lstatSync(pluginDir).isDirectory() ||
		excludePlugins.includes(plugin)
	) {
		return null;
	}

	const corePath = `${pluginDir}/core.ts`;
	const indexPath = `${pluginDir}/index.ts`;
	let filePath = indexPath;

	if (fs.existsSync(corePath)) {
		filePath = corePath;
	} else if (!fs.existsSync(indexPath)) {
		return null;
	}

	return {
		filePath,
		outFile: `${distDir}/${prefix}${plugin}.d.ts`,
		output: outputConfig,
	};
}

module.exports = config;

```

### Core Architecture Module: `global.d.ts`
```
import type INoUiSlider from 'nouislider';

declare global {
	var noUiSlider: typeof INoUiSlider;
	var FloatingUIDOM: {
		computePosition: (
			reference: Element,
			floating: HTMLElement,
			options?: any,
		) => Promise<{ x: number; y: number; placement: string }>;
		autoUpdate: (
			reference: Element,
			floating: HTMLElement,
			update: () => void,
		) => () => void;
		offset: (offset: number | [number, number]) => any;
		flip: (options?: { fallbackPlacements?: string[] }) => any;
	};

	interface Window {
		HS_CLIPBOARD_SELECTOR: string;
		HSAccessibilityObserver: any;
		HSStaticMethods: any;

		HSCopyMarkup: any;
		HSAccordion: any;
		HSCarousel: any;
		HSCollapse: any;
		HSComboBox: any;
		HSDataTable: any;
		HSDatepicker: any;
		HSDropdown: any;
		HSFileUpload: any;
		HSInputNumber: any;
		HSLayoutSplitter: any;
		HSOverlay: any;
		HSPinInput: any;
		HSRangeSlider: any;
		HSRemoveElement: any;
		HSScrollNav: any;
		HSScrollspy: any;
		HSSelect: any;
		HSStepper: any;
		HSStrongPassword: any;
		HSTabs: any;
		HSTextareaAutoHeight: any;
		HSThemeSwitch: any;
		HSToggleCount: any;
		HSTogglePassword: any;
		HSTooltip: any;
		HSTreeView: any;

		$hsCopyMarkupCollection: any[];
		$hsAccordionCollection: any[];
		$hsCarouselCollection: any[];
		$hsCollapseCollection: any[];
		$hsComboBoxCollection: any[];
		$hsDataTableCollection: any[];
		$hsDatepickerCollection: any[];
		$hsDropdownCollection: any[];
		$hsFileUploadCollection: any[];
		$hsInputNumberCollection: any[];
		$hsLayoutSplitterCollection: any[];
		$hsOverlayCollection: any[];
		$hsPinInputCollection: any[];
		$hsRemoveElementCollection: any[];
		$hsRangeSliderCollection: any[];
		$hsScrollNavCollection: any[];
		$hsScrollspyCollection: any[];
		$hsSelectCollection: any[];
		$hsStepperCollection: any[];
		$hsStrongPasswordCollection: any[];
		$hsTabsCollection: any[];
		$hsTextareaAutoHeightCollection: any[];
		$hsThemeSwitchCollection: any[];
		$hsToggleCountCollection: any[];
		$hsTogglePasswordCollection: any[];
		$hsTooltipCollection: any[];
		$hsTreeViewCollection: any[];
	}
}

export {};

```

### Core Architecture Module: `index.d.ts`
```
import { VirtualElement } from '@floating-ui/dom';
import { Config } from 'datatables.net-dt';
import { DropzoneOptions } from 'dropzone';
import { Options as Options$1 } from 'nouislider';
import { DatesArr } from 'vanilla-calendar-pro';
import { Options } from 'vanilla-calendar-pro/types';

export type TAutoInitPlugin = {
	autoInit?: () => void;
};
export type TCollectionItem = {
	key: string;
	fn: TAutoInitPlugin | null;
	collection: string;
};
export declare const COLLECTIONS: TCollectionItem[];
export declare const HSStaticMethods: {
	getClassProperty: (el: HTMLElement, prop: string, val?: string) => string;
	afterTransition: (el: HTMLElement, callback: Function) => void;
	autoInit(collection?: string | string[]): void;
	cleanCollection(name?: string | string[]): void;
};
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
	createCollection(collection: any[] | undefined, element: any): void;
	fireEvent(evt: string, payload?: any): any;
	on(evt: string, cb: Function): void;
}
export declare class HSCopyMarkup extends HSBasePlugin<ICopyMarkupOptions> implements ICopyMarkup {
	private readonly targetSelector;
	private readonly wrapperSelector;
	private readonly limit;
	private target;
	private wrapper;
	private items;
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
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	isAutoHeight?: boolean;
	isAutoPlay?: boolean;
	isCentered?: boolean;
	isDraggable?: boolean;
	dragThreshold?: number;
	isInfiniteLoop?: boolean;
	isItemCustomWidth?: boolean;
	isRTL?: boolean;
	isSnap?: boolean;
	isScrollBlocked?: boolean;
	hasSnapSpacers?: boolean;
	slidesQty?: TCarouselOptionsSlidesQty | number;
	slideBy?: TCarouselOptionsSlidesQty | number | null;
	speed?: number;
	updateDelay?: number;
	mode?: "default" | "snap" | "bounded";
	boundedOptions?: {
		maxWidth?: [
			number,
			"px" | "rem"
		];
		slidesGap?: [
			number,
			"px" | "rem"
		];
		spacersWidth?: number | "auto";
	};
}
export interface ICarousel {
	options: ICarouselOptions;
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
	private readonly dragThreshold;
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
	private dragStartTime;
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
	private getTargetTranslateX;
	private calculateTransform;
	private setTransform;
	private setTranslate;
	private setIndex;
	recalculateWidth(): void;
	goToPrev(): void;
	goToNext(): void;
	goTo(i: number): void;
	destroy(): void;
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	priv
```

### Core Architecture Module: `index.js`
```
!function(e,t){if("object"==typeof exports&&"object"==typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var i=t();for(var s in i)("object"==typeof exports?exports:e)[s]=i[s]}}(self,()=>(()=>{var e={949(e,t,i){"use strict";i.r(t),i.d(t,{arrow:()=>Me,autoPlacement:()=>Te,autoUpdate:()=>Se,computePosition:()=>Pe,detectOverflow:()=>xe,flip:()=>ke,getOverflowAncestors:()=>ne,hide:()=>Ae,inline:()=>Oe,limitShift:()=>De,offset:()=>Le,platform:()=>we,shift:()=>Ee,size:()=>Ie});const s=["top","right","bottom","left"],n=["start","end"],o=s.reduce((e,t)=>e.concat(t,t+"-"+n[0],t+"-"+n[1]),[]),l=Math.min,r=Math.max,a=Math.round,d=Math.floor,c=e=>({x:e,y:e}),h={left:"right",right:"left",bottom:"top",top:"bottom"};function u(e,t,i){return r(e,l(t,i))}function p(e,t){return"function"==typeof e?e(t):e}function m(e){return e.split("-")[0]}function g(e){return e.split("-")[1]}function v(e){return"x"===e?"y":"x"}function f(e){return"y"===e?"height":"width"}function y(e){const t=e[0];return"t"===t||"b"===t?"y":"x"}function b(e){return v(y(e))}function w(e,t,i){void 0===i&&(i=!1);const s=g(e),n=b(e),o=f(n);let l="x"===n?s===(i?"end":"start")?"right":"left":"start"===s?"bottom":"top";return t.reference[o]>t.floating[o]&&(l=k(l)),[l,k(l)]}function C(e){return e.includes("start")?e.replace("start","end"):e.replace("end","start")}const S=["left","right"],x=["right","left"],L=["top","bottom"],T=["bottom","top"];function E(e,t,i,s){const n=g(e);let o=function(e,t,i){switch(e){case"top":case"bottom":return i?t?x:S:t?S:x;case"left":case"right":return t?L:T;default:return[]}}(m(e),"start"===i,s);return n&&(o=o.map(e=>e+"-"+n),t&&(o=o.concat(o.map(C)))),o}function k(e){const t=m(e);return h[t]+e.slice(t.length)}function I(e){return"number"!=typeof e?function(e){return{top:0,right:0,bottom:0,left:0,...e}}(e):{top:e,right:e,bottom:e,left:e}}function A(e){const{x:t,y:i,width:s,height:n}=e;return{width:s,height:n,top:i,left:t,right:t+s,bottom:i+n,x:t,y:i}}function M(e,t,i){let{reference:s,floating:n}=e;const o=y(t),l=b(t),r=f(l),a=m(t),d="y"===o,c=s.x+s.width/2-n.width/2,h=s.y+s.height/2-n.height/2,u=s[r]/2-n[r]/2;let p;switch(a){case"top":p={x:c,y:s.y-n.height};break;case"bottom":p={x:c,y:s.y+s.height};break;case"right":p={x:s.x+s.width,y:h};break;case"left":p={x:s.x-n.width,y:h};break;default:p={x:s.x,y:s.y}}switch(g(t)){case"start":p[l]-=u*(i&&d?-1:1);break;case"end":p[l]+=u*(i&&d?-1:1)}return p}async function O(e,t){var i;void 0===t&&(t={});const{x:s,y:n,platform:o,rects:l,elements:r,strategy:a}=e,{boundary:d="clippingAncestors",rootBoundary:c="viewport",elementContext:h="floating",altBoundary:u=!1,padding:m=0}=p(t,e),g=I(m),v=r[u?"floating"===h?"reference":"floating":h],f=A(await o.getClippingRect({element:null==(i=await(null==o.isElement?void 0:o.isElement(v)))||i?v:v.contextElement||await(null==o.getDocumentElement?void 0:o.getDocumentElement(r.floating)),boundary:d,rootBoundary:c,strategy:a})),y="floating"===h?{x:s,y:n,width:l.floating.width,height:l.floating.height}:l.reference,b=await(null==o.getOffsetParent?void 0:o.getOffsetParent(r.floating)),w=await(null==o.isElement?void 0:o.isElement(b))&&await(null==o.getScale?void 0:o.getScale(b))||{x:1,y:1},C=A(o.convertOffsetParentRelativeRectToViewportRelativeRect?await o.convertOffsetParentRelativeRectToViewportRelativeRect({elements:r,rect:y,offsetParent:b,strategy:a}):y);return{top:(f.top-C.top+g.top)/w.y,bottom:(C.bottom-f.bottom+g.bottom)/w.y,left:(f.left-C.left+g.left)/w.x,right:(C.right-f.right+g.right)/w.x}}function D(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function P(e){return s.some(t=>e[t]>=0)}function $(e){const t=l(...e.map(e=>e.left)),i=l(...e.map(e=>e.top));return{x:t,y:i,width:r(...e.map(e=>e.right))-t,height:r(...e.map(e=>e.bottom))-i}}const H=new Set(["left","top"]);function N(){return"undefined"!=typeof window}function _(e){return F(e)?(e.nodeName||"").toLowerCase():"#document"}function B(e){var t;return(null==e||null==(t=e.ownerDocument)?void 0:t.defaultView)||window}function q(e){var t;return null==(t=(F(e)?e.ownerDocument:e.document)||window.document)?void 0:t.documentElement}function F(e){return!!N()&&(e instanceof Node||e instanceof B(e).Node)}function R(e){return!!N()&&(e instanceof Element||e instanceof B(e).Element)}function j(e){return!!N()&&(e instanceof HTMLElement||e instanceof B(e).HTMLElement)}function V(e){return!(!N()||"undefined"==typeof ShadowRoot)&&(e instanceof ShadowRoot||e instanceof B(e).ShadowRoot)}function z(e){const{overflow:t,overflowX:i,overflowY:s,display:n}=ee(e);return/auto|scroll|overlay|hidden|clip/.test(t+s+i)&&"inline"!==n&&"contents"!==n}function W(e){return/^(table|td|th)$/.test(_(e))}function U(e){try{if(e.matches(":popover-open"))return!0}catch(e){}try{return e.matches(":modal")}catch(e){return!1}}const Y=/transform|translate|scale|rotate|perspective|filter/,K=/paint|layout|strict|content/,Q=e=>!!e&&"none"!==e;let J;function Z(e){const t=R(e)?ee(e):e;return Q(t.transform)||Q(t.translate)||Q(t.scale)||Q(t.rotate)||Q(t.perspective)||!G()&&(Q(t.backdropFilter)||Q(t.filter))||Y.test(t.willChange||"")||K.test(t.contain||"")}function G(){return null==J&&(J="undefined"!=typeof CSS&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),J}function X(e){return/^(html|body|#document)$/.test(_(e))}function ee(e){return B(e).getComputedStyle(e)}function te(e){return R(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function ie(e){if("html"===_(e))return e;const t=e.assignedSlot||e.parentNode||V(e)&&e.host||q(e);return V(t)?t.host:t}function se(e){const t=ie(e);return X(t)?e.ownerDocument?e.ownerDocument.body:e.body:j(t)&&z(t)?t:se(t)}function ne(e,t,i){var s;void 0===t&&(t=[]),void 0===i&&(i=!0);const n=se(e),o=n===(null==(s=e.ownerDocument)?void 0:s.body),l=B(n);if(o){const e=oe(l);return t.concat(l,l.visualViewport||[],z(n)?n:[],e&&i?ne(e):[])}return t.concat(n,ne(n,[],i))}function oe(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function le(e){const t=ee(e);let i=parseFloat(t.width)||0,s=parseFloat(t.height)||0;const n=j(e),o=n?e.offsetWidth:i,l=n?e.offsetHeight:s,r=a(i)!==o||a(s)!==l;return r&&(i=o,s=l),{width:i,height:s,$:r}}function re(e){return R(e)?e:e.contextElement}function ae(e){const t=re(e);if(!j(t))return c(1);const i=t.getBoundingClientRect(),{width:s,height:n,$:o}=le(t);let l=(o?a(i.width):i.width)/s,r=(o?a(i.height):i.height)/n;return l&&Number.isFinite(l)||(l=1),r&&Number.isFinite(r)||(r=1),{x:l,y:r}}const de=c(0);function ce(e){const t=B(e);return G()&&t.visualViewport?{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}:de}function he(e,t,i,s){void 0===t&&(t=!1),void 0===i&&(i=!1);const n=e.getBoundingClientRect(),o=re(e);let l=c(1);t&&(s?R(s)&&(l=ae(s)):l=ae(e));const r=function(e,t,i){return void 0===t&&(t=!1),!(!i||t&&i!==B(e))&&t}(o,i,s)?ce(o):c(0);let a=(n.left+r.x)/l.x,d=(n.top+r.y)/l.y,h=n.width/l.x,u=n.height/l.y;if(o){const e=B(o),t=s&&R(s)?B(s):s;let i=e,n=oe(i);for(;n&&s&&t!==i;){const e=ae(n),t=n.getBoundingClientRect(),s=ee(n),o=t.left+(n.clientLeft+parseFloat(s.paddingLeft))*e.x,l=t.top+(n.clientTop+parseFloat(s.paddingTop))*e.y;a*=e.x,d*=e.y,h*=e.x,u*=e.y,a+=o,d+=l,i=B(n),n=oe(i)}}return A({width:h,height:u,x:a,y:d})}function ue(e,t){const i=te(e).scrollLeft;return t?t.left+i:he(q(e)).left+i}function pe(e,t){const i=e.getBoundingClientRect();return{x:i.left+t.scrollLeft-ue(e,i),y:i.top+t.scrollTop}}function me(e,t,i){let s;if("viewport"===t)s=function(e,t){const i=B(e),s=q(e),n=i.visualViewport;let o=s.clientWidth,l=s.clientHeight,r=0,a=0;if(n){o=n.width,l=n.height;const e=G();(!e||e&&"fixed"===t)&&(r=n.offsetLeft,a=n.offsetTop)}const d=ue(s);if(d<=0){const e=s.ownerDocument,t=e.body,i=getComputedStyle(t),n="CSS1Compat"===e.compatMode&&parseFloat(i.marginLeft)+parseFloat(i.marginRight)||0,l=Math.abs(s.clientWidth-t.clientWidth-n);l<=25&&(o-=l)}else d<=25&&(o+=d
```

### Core Architecture Module: `preline.d.ts`
```
import { VirtualElement } from '@floating-ui/dom';
import { Config } from 'datatables.net-dt';
import { DropzoneOptions } from 'dropzone';
import { Options as Options$1 } from 'nouislider';
import { DatesArr } from 'vanilla-calendar-pro';
import { Options } from 'vanilla-calendar-pro/types';

export type TAutoInitPlugin = {
	autoInit?: () => void;
};
export type TCollectionItem = {
	key: string;
	fn: TAutoInitPlugin | null;
	collection: string;
};
export declare const COLLECTIONS: TCollectionItem[];
export declare const HSStaticMethods: {
	getClassProperty: (el: HTMLElement, prop: string, val?: string) => string;
	afterTransition: (el: HTMLElement, callback: Function) => void;
	autoInit(collection?: string | string[]): void;
	cleanCollection(name?: string | string[]): void;
};
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
	createCollection(collection: any[] | undefined, element: any): void;
	fireEvent(evt: string, payload?: any): any;
	on(evt: string, cb: Function): void;
}
export declare class HSCopyMarkup extends HSBasePlugin<ICopyMarkupOptions> implements ICopyMarkup {
	private readonly targetSelector;
	private readonly wrapperSelector;
	private readonly limit;
	private target;
	private wrapper;
	private items;
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
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	isAutoHeight?: boolean;
	isAutoPlay?: boolean;
	isCentered?: boolean;
	isDraggable?: boolean;
	dragThreshold?: number;
	isInfiniteLoop?: boolean;
	isItemCustomWidth?: boolean;
	isRTL?: boolean;
	isSnap?: boolean;
	isScrollBlocked?: boolean;
	hasSnapSpacers?: boolean;
	slidesQty?: TCarouselOptionsSlidesQty | number;
	slideBy?: TCarouselOptionsSlidesQty | number | null;
	speed?: number;
	updateDelay?: number;
	mode?: "default" | "snap" | "bounded";
	boundedOptions?: {
		maxWidth?: [
			number,
			"px" | "rem"
		];
		slidesGap?: [
			number,
			"px" | "rem"
		];
		spacersWidth?: number | "auto";
	};
}
export interface ICarousel {
	options: ICarouselOptions;
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
	private readonly dragThreshold;
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
	private dragStartTime;
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
	private getTargetTranslateX;
	private calculateTransform;
	private setTransform;
	private setTranslate;
	private setIndex;
	recalculateWidth(): void;
	goToPrev(): void;
	goToNext(): void;
	goTo(i: number): void;
	destroy(): void;
	static getInstance(target: HTMLElement | string, isInstance?: boolean): any;
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
	priv
```

### Core Architecture Module: `preline.js`
```
!function(e,t){if("object"==typeof exports&&"object"==typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var i=t();for(var s in i)("object"==typeof exports?exports:e)[s]=i[s]}}(self,()=>(()=>{var e={949(e,t,i){"use strict";i.r(t),i.d(t,{arrow:()=>Me,autoPlacement:()=>Te,autoUpdate:()=>Se,computePosition:()=>Pe,detectOverflow:()=>xe,flip:()=>ke,getOverflowAncestors:()=>ne,hide:()=>Ae,inline:()=>Oe,limitShift:()=>De,offset:()=>Le,platform:()=>we,shift:()=>Ee,size:()=>Ie});const s=["top","right","bottom","left"],n=["start","end"],o=s.reduce((e,t)=>e.concat(t,t+"-"+n[0],t+"-"+n[1]),[]),l=Math.min,r=Math.max,a=Math.round,d=Math.floor,c=e=>({x:e,y:e}),h={left:"right",right:"left",bottom:"top",top:"bottom"};function u(e,t,i){return r(e,l(t,i))}function p(e,t){return"function"==typeof e?e(t):e}function m(e){return e.split("-")[0]}function g(e){return e.split("-")[1]}function v(e){return"x"===e?"y":"x"}function f(e){return"y"===e?"height":"width"}function y(e){const t=e[0];return"t"===t||"b"===t?"y":"x"}function b(e){return v(y(e))}function w(e,t,i){void 0===i&&(i=!1);const s=g(e),n=b(e),o=f(n);let l="x"===n?s===(i?"end":"start")?"right":"left":"start"===s?"bottom":"top";return t.reference[o]>t.floating[o]&&(l=k(l)),[l,k(l)]}function C(e){return e.includes("start")?e.replace("start","end"):e.replace("end","start")}const S=["left","right"],x=["right","left"],L=["top","bottom"],T=["bottom","top"];function E(e,t,i,s){const n=g(e);let o=function(e,t,i){switch(e){case"top":case"bottom":return i?t?x:S:t?S:x;case"left":case"right":return t?L:T;default:return[]}}(m(e),"start"===i,s);return n&&(o=o.map(e=>e+"-"+n),t&&(o=o.concat(o.map(C)))),o}function k(e){const t=m(e);return h[t]+e.slice(t.length)}function I(e){return"number"!=typeof e?function(e){return{top:0,right:0,bottom:0,left:0,...e}}(e):{top:e,right:e,bottom:e,left:e}}function A(e){const{x:t,y:i,width:s,height:n}=e;return{width:s,height:n,top:i,left:t,right:t+s,bottom:i+n,x:t,y:i}}function M(e,t,i){let{reference:s,floating:n}=e;const o=y(t),l=b(t),r=f(l),a=m(t),d="y"===o,c=s.x+s.width/2-n.width/2,h=s.y+s.height/2-n.height/2,u=s[r]/2-n[r]/2;let p;switch(a){case"top":p={x:c,y:s.y-n.height};break;case"bottom":p={x:c,y:s.y+s.height};break;case"right":p={x:s.x+s.width,y:h};break;case"left":p={x:s.x-n.width,y:h};break;default:p={x:s.x,y:s.y}}switch(g(t)){case"start":p[l]-=u*(i&&d?-1:1);break;case"end":p[l]+=u*(i&&d?-1:1)}return p}async function O(e,t){var i;void 0===t&&(t={});const{x:s,y:n,platform:o,rects:l,elements:r,strategy:a}=e,{boundary:d="clippingAncestors",rootBoundary:c="viewport",elementContext:h="floating",altBoundary:u=!1,padding:m=0}=p(t,e),g=I(m),v=r[u?"floating"===h?"reference":"floating":h],f=A(await o.getClippingRect({element:null==(i=await(null==o.isElement?void 0:o.isElement(v)))||i?v:v.contextElement||await(null==o.getDocumentElement?void 0:o.getDocumentElement(r.floating)),boundary:d,rootBoundary:c,strategy:a})),y="floating"===h?{x:s,y:n,width:l.floating.width,height:l.floating.height}:l.reference,b=await(null==o.getOffsetParent?void 0:o.getOffsetParent(r.floating)),w=await(null==o.isElement?void 0:o.isElement(b))&&await(null==o.getScale?void 0:o.getScale(b))||{x:1,y:1},C=A(o.convertOffsetParentRelativeRectToViewportRelativeRect?await o.convertOffsetParentRelativeRectToViewportRelativeRect({elements:r,rect:y,offsetParent:b,strategy:a}):y);return{top:(f.top-C.top+g.top)/w.y,bottom:(C.bottom-f.bottom+g.bottom)/w.y,left:(f.left-C.left+g.left)/w.x,right:(C.right-f.right+g.right)/w.x}}function D(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function P(e){return s.some(t=>e[t]>=0)}function $(e){const t=l(...e.map(e=>e.left)),i=l(...e.map(e=>e.top));return{x:t,y:i,width:r(...e.map(e=>e.right))-t,height:r(...e.map(e=>e.bottom))-i}}const H=new Set(["left","top"]);function N(){return"undefined"!=typeof window}function _(e){return F(e)?(e.nodeName||"").toLowerCase():"#document"}function B(e){var t;return(null==e||null==(t=e.ownerDocument)?void 0:t.defaultView)||window}function q(e){var t;return null==(t=(F(e)?e.ownerDocument:e.document)||window.document)?void 0:t.documentElement}function F(e){return!!N()&&(e instanceof Node||e instanceof B(e).Node)}function R(e){return!!N()&&(e instanceof Element||e instanceof B(e).Element)}function j(e){return!!N()&&(e instanceof HTMLElement||e instanceof B(e).HTMLElement)}function V(e){return!(!N()||"undefined"==typeof ShadowRoot)&&(e instanceof ShadowRoot||e instanceof B(e).ShadowRoot)}function z(e){const{overflow:t,overflowX:i,overflowY:s,display:n}=ee(e);return/auto|scroll|overlay|hidden|clip/.test(t+s+i)&&"inline"!==n&&"contents"!==n}function W(e){return/^(table|td|th)$/.test(_(e))}function U(e){try{if(e.matches(":popover-open"))return!0}catch(e){}try{return e.matches(":modal")}catch(e){return!1}}const Y=/transform|translate|scale|rotate|perspective|filter/,K=/paint|layout|strict|content/,Q=e=>!!e&&"none"!==e;let J;function Z(e){const t=R(e)?ee(e):e;return Q(t.transform)||Q(t.translate)||Q(t.scale)||Q(t.rotate)||Q(t.perspective)||!G()&&(Q(t.backdropFilter)||Q(t.filter))||Y.test(t.willChange||"")||K.test(t.contain||"")}function G(){return null==J&&(J="undefined"!=typeof CSS&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),J}function X(e){return/^(html|body|#document)$/.test(_(e))}function ee(e){return B(e).getComputedStyle(e)}function te(e){return R(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function ie(e){if("html"===_(e))return e;const t=e.assignedSlot||e.parentNode||V(e)&&e.host||q(e);return V(t)?t.host:t}function se(e){const t=ie(e);return X(t)?e.ownerDocument?e.ownerDocument.body:e.body:j(t)&&z(t)?t:se(t)}function ne(e,t,i){var s;void 0===t&&(t=[]),void 0===i&&(i=!0);const n=se(e),o=n===(null==(s=e.ownerDocument)?void 0:s.body),l=B(n);if(o){const e=oe(l);return t.concat(l,l.visualViewport||[],z(n)?n:[],e&&i?ne(e):[])}return t.concat(n,ne(n,[],i))}function oe(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function le(e){const t=ee(e);let i=parseFloat(t.width)||0,s=parseFloat(t.height)||0;const n=j(e),o=n?e.offsetWidth:i,l=n?e.offsetHeight:s,r=a(i)!==o||a(s)!==l;return r&&(i=o,s=l),{width:i,height:s,$:r}}function re(e){return R(e)?e:e.contextElement}function ae(e){const t=re(e);if(!j(t))return c(1);const i=t.getBoundingClientRect(),{width:s,height:n,$:o}=le(t);let l=(o?a(i.width):i.width)/s,r=(o?a(i.height):i.height)/n;return l&&Number.isFinite(l)||(l=1),r&&Number.isFinite(r)||(r=1),{x:l,y:r}}const de=c(0);function ce(e){const t=B(e);return G()&&t.visualViewport?{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}:de}function he(e,t,i,s){void 0===t&&(t=!1),void 0===i&&(i=!1);const n=e.getBoundingClientRect(),o=re(e);let l=c(1);t&&(s?R(s)&&(l=ae(s)):l=ae(e));const r=function(e,t,i){return void 0===t&&(t=!1),!(!i||t&&i!==B(e))&&t}(o,i,s)?ce(o):c(0);let a=(n.left+r.x)/l.x,d=(n.top+r.y)/l.y,h=n.width/l.x,u=n.height/l.y;if(o){const e=B(o),t=s&&R(s)?B(s):s;let i=e,n=oe(i);for(;n&&s&&t!==i;){const e=ae(n),t=n.getBoundingClientRect(),s=ee(n),o=t.left+(n.clientLeft+parseFloat(s.paddingLeft))*e.x,l=t.top+(n.clientTop+parseFloat(s.paddingTop))*e.y;a*=e.x,d*=e.y,h*=e.x,u*=e.y,a+=o,d+=l,i=B(n),n=oe(i)}}return A({width:h,height:u,x:a,y:d})}function ue(e,t){const i=te(e).scrollLeft;return t?t.left+i:he(q(e)).left+i}function pe(e,t){const i=e.getBoundingClientRect();return{x:i.left+t.scrollLeft-ue(e,i),y:i.top+t.scrollTop}}function me(e,t,i){let s;if("viewport"===t)s=function(e,t){const i=B(e),s=q(e),n=i.visualViewport;let o=s.clientWidth,l=s.clientHeight,r=0,a=0;if(n){o=n.width,l=n.height;const e=G();(!e||e&&"fixed"===t)&&(r=n.offsetLeft,a=n.offsetTop)}const d=ue(s);if(d<=0){const e=s.ownerDocument,t=e.body,i=getComputedStyle(t),n="CSS1Compat"===e.compatMode&&parseFloat(i.marginLeft)+parseFloat(i.marginRight)||0,l=Math.abs(s.clientWidth-t.clientWidth-n);l<=25&&(o-=l)}else d<=25&&(o+=d
```

### Core Architecture Module: `prettier.config.js`
```
const config = {
	useTabs: true,
	singleQuote: true,
	bracketSameLine: true,
	arrowParens: 'always',
};

module.exports = config;

```

### Core Architecture Module: `scripts/flatten-dts.js`
```
const fs = require('fs');
const path = require('path');
const { generateDtsBundle } = require('dts-bundle-generator');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const tmpDir = path.join(rootDir, '.dts-tmp');

const pluginsDir = path.join(srcDir, 'plugins');
const helpersDir = path.join(srcDir, 'helpers');
const excludedPlugins = new Set(['base-plugin', 'docs-scrollspy']);

const ensureDist = () => {
	if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
};

const clearDistDts = () => {
	if (!fs.existsSync(distDir)) return;

	for (const name of fs.readdirSync(distDir)) {
		if (name.endsWith('.d.ts'))
			fs.rmSync(path.join(distDir, name), { force: true });
	}
};

const bundleTo = (inputFile, outFile) => {
	if (!fs.existsSync(inputFile)) return false;

	const [bundled] = generateDtsBundle(
		[
			{
				filePath: inputFile,
				output: {
					noBanner: true,
				},
			},
		],
		{
			preferredConfigPath: path.join(rootDir, 'tsconfig.dts.json'),
		},
	);

	fs.writeFileSync(outFile, bundled);

	return true;
};

const bundleIndexDeclaration = () => {
	bundleTo(
		path.join(tmpDir, 'auto', 'index.d.ts'),
		path.join(distDir, 'index.d.ts'),
	);
};

const bundleNonAutoDeclaration = () => {
	bundleTo(
		path.join(tmpDir, 'index.d.ts'),
		path.join(distDir, 'non-auto.d.ts'),
	);
};

const bundlePluginDeclarations = () => {
	if (!fs.existsSync(pluginsDir)) return;

	for (const pluginName of fs.readdirSync(pluginsDir)) {
		if (excludedPlugins.has(pluginName)) continue;

		const pluginSrcDir = path.join(pluginsDir, pluginName);

		if (!fs.lstatSync(pluginSrcDir).isDirectory()) continue;

		const pluginTmpDir = path.join(tmpDir, 'plugins', pluginName);
		const coreDts = path.join(pluginTmpDir, 'core.d.ts');
		const indexDts = path.join(pluginTmpDir, 'index.d.ts');
		const outDts = path.join(distDir, `${pluginName}.d.ts`);

		bundleTo(coreDts, outDts) || bundleTo(indexDts, outDts);
	}
};

const bundleHelperDeclarations = () => {
	if (!fs.existsSync(helpersDir)) return;

	for (const helperName of fs.readdirSync(helpersDir)) {
		const helperSrcDir = path.join(helpersDir, helperName);

		if (!fs.lstatSync(helperSrcDir).isDirectory()) continue;

		const helperDts = path.join(tmpDir, 'helpers', helperName, 'index.d.ts');
		const outDts = path.join(distDir, `helper-${helperName}.d.ts`);

		bundleTo(helperDts, outDts);
	}
};

const bundleUtilsDeclaration = () => {
	const utilsDts = path.join(tmpDir, 'utils', 'index.d.ts');
	const outDts = path.join(distDir, 'utils.d.ts');

	bundleTo(utilsDts, outDts);
};

const cleanupTmp = () => {
	if (fs.existsSync(tmpDir))
		fs.rmSync(tmpDir, { recursive: true, force: true });
};

const cleanupLegacyDistDirs = () => {
	for (const dirName of ['auto', 'helpers', 'plugins', 'utils']) {
		const target = path.join(distDir, dirName);

		if (fs.existsSync(target))
			fs.rmSync(target, { recursive: true, force: true });
	}
};

ensureDist();
clearDistDts();

bundleIndexDeclaration();
bundleNonAutoDeclaration();
bundlePluginDeclarations();
bundleHelperDeclarations();
bundleUtilsDeclaration();

cleanupTmp();
cleanupLegacyDistDirs();

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
-var e={189:(e,t,n)=>{n.d(t,{lP:()=>s});const s={auto:"auto","auto-start":"auto-start","auto-end":"auto-end",top:"top","top-left":"top-start","top-right":"top-end",bottom:"bottom","bottom-left":"bottom-start","bottom-right":"bottom-end",right:"right","right-start":"right-start","right-end":"right-end",left:"left","left-start":"left-start","left-end":"left-end"}},236:(e,t,n)=>{n.d(t,{A:()=>d});var s=n(926),i=n(615),o=n(862),a=n(189),l=function(e,t,n,s){return new(n||(n=Promise))((function(i,o){function a(e){try{r(s.next(e))}catch(e){o(e)}}function l(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(a,l)}r((s=s.apply(e,t||[])).next())}))};class r extends i.A{constructor(e,t){var n,s,i,o,a;super(e,t),this.disabledObserver=null,this.optionId=0;const l=e.getAttribute("data-hs-select"),r=l?JSON.parse(l):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(n=null==d?void 0:d.minSearchLength)&&void 0!==n?n:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)
```

**File**: `dist/index.js` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
  * @author: Preline Labs Ltd.
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
- */var s=this&&this.__awaiter||function(e,t,i,s){return new(i||(i=Promise))((function(n,o){function l(e){try{r(s.next(e))}catch(e){o(e)}}function a(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?n(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t)}))).then(l,a)}r((s=s.apply(e,t||[])).next())}))},n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const o=i(292),l=n(i(961)),a=n(i(248)),r=i(223);class d extends l.default{constructor(e,t){var i,s,n,o,l;super(e,t),this.disabledObserver=null,this.optionId=0;const a=e.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(n=null==d?void 0:d.toggleSeparators)||void 0===n?void 0:n.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 
```

**File**: `dist/index.mjs` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ class o extends n.A{constructor(e,t){super(e,t);const i=e.getAttribute("data-hs-
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-class o extends n.A{constructor(e,t,i){super(e,t,i),this.items=[];const s=e.getAttribute("data-hs-tree-view"),n=s?JSON.parse(s):{},o=Object.assign(Object.assign({},n),t);this.controlBy=(null==o?void 0:o.controlBy)||"button",this.autoSelectChildren=(null==o?void 0:o.autoSelectChildren)||!1,this.isIndeterminate=(null==o?void 0:o.isIndeterminate)||!0,this.onElementClickListener=[],this.onControlChangeListener=[],this.init()}elementClick(e,t,i){if(e.stopPropagation(),t.classList.contains("disabled"))return!1;e.metaKey||e.shiftKey||this.unselectItem(i),this.selectItem(t,i),this.fireEvent("click",{el:t,data:i}),(0,s.JD)("click.hs.treeView",this.el,{el:t,data:i})}controlChange(e,t){this.autoSelectChildren?(this.selectItem(e,t),t.isDir&&this.selectChildren(e,t),this.toggleParent(e)):this.selectItem(e,t)}init(){this.createCollection(window.$hsTreeViewCollection,this),o.group+=1,this.initItems()}initItems(){this.el.querySelectorAll("[data-hs-tree-view-item]").forEach(((e,t)=>{var i,s;const n=JSON.parse(e.getAttribute("data-hs-tree-view-item"));e.id||(e.id=`tree-view-item-${o.group}-${t}`);const l=Object.assign(Object.assign({},n),{id:null!==(i=n.id)&&void 0!==i?i:e.id,path:this.getPath(e),isSelected:null!==(s=n.isSelected)&&void 0!==s&&s});this.items.push(l),"checkbox"===this.controlBy?this.controlByCheckbox(e,l):this.controlByButton(e,l)}))}controlByButton(e,t){this.onElementClickListener.push({el:e,fn:i=>this.elementClick(i,e,t)}),e.addEventListener("click",this.onElementClickListener.find((t=>t.el===e)).fn)}controlByCheckbox(e,t){const i=e.querySelector(`input[value="${t.value}"]`);i&&(this.onControlChangeListener.push({el:i,fn:()=>this.controlChange(e,t)}),i.addEventListener("change",this.onControlChangeListener.find((e=>e.el===i)).fn))}getItem(e){return this.items.find((t=>t.id===e))}getPath(e){var t;const i=[];let s=e.closest("[data-hs-tree-view-item]");for(;s;){const e=JSON.parse(s.getAttribute("data-hs-tree-view-item"));i.push(e.value),s=null===(t=s.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]")}return i.reverse().join("/")}unselectItem(e=null){let t=this.getSelectedItems();e&&(t=t.filter((t=>t.id!==e.id))),t.length&&t.forEach((e=>{document.querySelector(`#${e.id}`).classList.remove("selected"),this.changeItemProp(e.id,"isSelected",!1)}))}selectItem(e,t){t.isSelected?(e.classList.remove("selected"),this.changeItemProp(t.id,"isSelected",!1)):(e.classList.add("selected"),this.changeItemProp(t.id,"isSelected",!0))}selectChildren(e,t){const i=e.querySelectorAll("[data-hs-tree-view-item]");Array.from(i).filter((e=>!e.classList.contains("disabled"))).forEach((e=>{const i=e.id?this.getItem(e.id):null;if(!i)return!1;t.isSelected?(e.classList.add("selected"),this.changeItemProp(i.id,"isSelected",!0)):(e.classList.remove("selected"),this.changeItemProp(i.id,"isSelected",!1));const s=this.getItem(e.id),n=e.querySelector(`input[value="${s.value}"]`);this.isIndeterminate&&(n.indeterminate=!1),s.isSelected?n.checked=!0:n.checked=!1}))}toggleParent(e){var t,i;let s=null===(t=e.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]");for(;s;){const e=s.querySelectorAll("[data-hs-tree-view-item]:not(.disabled)"),t=JSON.parse(s.getAttribute("data-hs-tree-view-item")),n=s.querySelector(`input[value="${t.value}"]`);let o=!1,l=0;e.forEach((e=>{const t=this.getItem(e.id);t.isSelected&&(l+=1),t.isSelected||(o=!0)})),o?(s.classList.remove("selected"),this.changeItemProp(s.id,"isSelected",!1),n.checked=!1):(s.classList.add("selected"),this.changeItemProp(s.id,"isSelected",!0),n.checked=!0),this.isIndeterminate&&(l>0&&l<e.length?n.indeterminate=!0:n.indeterminate=!1),s=null===(i=s.parentElement)||void 0===i?void 0:i.closest("[data-hs-tree-view-item]")}}update(){this.items.m
```

**File**: `dist/select.js` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ Object.defineProperty(e,"__esModule",{value:!0}),e.stringToBoolean=e.menuSearchH
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-var i=this&&this.__awaiter||function(t,e,s,i){return new(s||(s=Promise))((function(o,n){function l(t){try{r(i.next(t))}catch(t){n(t)}}function a(t){try{r(i.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof s?e:new s((function(t){t(e)}))).then(l,a)}r((i=i.apply(t,e||[])).next())}))},o=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(e,"__esModule",{value:!0});const n=s(292),l=o(s(961)),a=o(s(248)),r=s(223);class d extends l.default{constructor(t,e){var s,i,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(s=null==d?void 0:d.minSearchLength)&&void 0!==s?s:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTempla
```

**File**: `dist/select.mjs` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@ var t={189:(t,e,i)=>{i.d(e,{lP:()=>s});const s={auto:"auto","auto-start":"auto-s
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-const s=(t,e,i="auto",s=10,o=null)=>{const n=e.getBoundingClientRect(),l=o?o.getBoundingClientRect():null,a=window.innerHeight,r=l?n.top-l.top:n.top,d=(o?l.bottom:a)-n.bottom,h=t.clientHeight+s;return"bottom"===i?d>=h:"top"===i?r>=h:r>=h||d>=h},o=(t,e=200)=>{let i;return(...s)=>{clearTimeout(i),i=setTimeout((()=>{t.apply(void 0,s)}),e)}},n=(t,e,i=null)=>{const s=new CustomEvent(t,{detail:{payload:i},bubbles:!0,cancelable:!0,composed:!1});e.dispatchEvent(s)},l=(t,e)=>{const i=()=>{e(),t.removeEventListener("transitionend",i,!0)},s=window.getComputedStyle(t),o=s.getPropertyValue("transition-duration");"none"!==s.getPropertyValue("transition-property")&&parseFloat(o)>0?t.addEventListener("transitionend",i,!0):e()},a=t=>{const e=document.createElement("template");return t=t.trim(),e.innerHTML=t,e.content.firstChild},r=(t,e,i=" ",s="add")=>{t.split(i).forEach((t=>{t.trim()&&("add"===s?e.classList.add(t):e.classList.remove(t))}))}}},e={};function i(s){var o=e[s];if(void 0!==o)return o.exports;var n=e[s]={exports:{}};return t[s](n,n.exports,i),n.exports}i.d=(t,e)=>{for(var s in e)i.o(e,s)&&!i.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:e[s]})},i.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);var s={};i.d(s,{A:()=>h});var o=i(926),n=i(615),l=i(862),a=i(189),r=function(t,e,i,s){return new(i||(i=Promise))((function(o,n){function l(t){try{r(s.next(t))}catch(t){n(t)}}function a(t){try{r(s.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof i?e:new i((function(t){t(e)}))).then(l,a)}r((s=s.apply(t,e||[])).next())}))};class d extends n.A{constructor(t,e){var i,s,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparato
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
-var e={189:(e,t,n)=>{n.d(t,{lP:()=>s});const s={auto:"auto","auto-start":"auto-start","auto-end":"auto-end",top:"top","top-left":"top-start","top-right":"top-end",bottom:"bottom","bottom-left":"bottom-start","bottom-right":"bottom-end",right:"right","right-start":"right-start","right-end":"right-end",left:"left","left-start":"left-start","left-end":"left-end"}},236:(e,t,n)=>{n.d(t,{A:()=>d});var s=n(926),i=n(615),o=n(862),a=n(189),l=function(e,t,n,s){return new(n||(n=Promise))((function(i,o){function a(e){try{r(s.next(e))}catch(e){o(e)}}function l(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?i(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(a,l)}r((s=s.apply(e,t||[])).next())}))};class r extends i.A{constructor(e,t){var n,s,i,o,a;super(e,t),this.disabledObserver=null,this.optionId=0;const l=e.getAttribute("data-hs-select"),r=l?JSON.parse(l):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(n=null==d?void 0:d.minSearchLength)&&void 0!==n?n:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)
```

**File**: `dist/index.js` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
  * @author: Preline Labs Ltd.
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
- */var s=this&&this.__awaiter||function(e,t,i,s){return new(i||(i=Promise))((function(n,o){function l(e){try{r(s.next(e))}catch(e){o(e)}}function a(e){try{r(s.throw(e))}catch(e){o(e)}}function r(e){var t;e.done?n(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t)}))).then(l,a)}r((s=s.apply(e,t||[])).next())}))},n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0});const o=i(292),l=n(i(961)),a=n(i(248)),r=i(223);class d extends l.default{constructor(e,t){var i,s,n,o,l;super(e,t),this.disabledObserver=null,this.optionId=0;const a=e.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),t);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparators)||void 0===s?void 0:s.items)||", ",betweenItemsAndCounter:(null===(n=null==d?void 0:d.toggleSeparators)||void 0===n?void 0:n.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTemplate)||null,this.searchWrapperClasses=(null==d?void 
```

**File**: `dist/index.mjs` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ class o extends n.A{constructor(e,t){super(e,t);const i=e.getAttribute("data-hs-
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-class o extends n.A{constructor(e,t,i){super(e,t,i),this.items=[];const s=e.getAttribute("data-hs-tree-view"),n=s?JSON.parse(s):{},o=Object.assign(Object.assign({},n),t);this.controlBy=(null==o?void 0:o.controlBy)||"button",this.autoSelectChildren=(null==o?void 0:o.autoSelectChildren)||!1,this.isIndeterminate=(null==o?void 0:o.isIndeterminate)||!0,this.onElementClickListener=[],this.onControlChangeListener=[],this.init()}elementClick(e,t,i){if(e.stopPropagation(),t.classList.contains("disabled"))return!1;e.metaKey||e.shiftKey||this.unselectItem(i),this.selectItem(t,i),this.fireEvent("click",{el:t,data:i}),(0,s.JD)("click.hs.treeView",this.el,{el:t,data:i})}controlChange(e,t){this.autoSelectChildren?(this.selectItem(e,t),t.isDir&&this.selectChildren(e,t),this.toggleParent(e)):this.selectItem(e,t)}init(){this.createCollection(window.$hsTreeViewCollection,this),o.group+=1,this.initItems()}initItems(){this.el.querySelectorAll("[data-hs-tree-view-item]").forEach(((e,t)=>{var i,s;const n=JSON.parse(e.getAttribute("data-hs-tree-view-item"));e.id||(e.id=`tree-view-item-${o.group}-${t}`);const l=Object.assign(Object.assign({},n),{id:null!==(i=n.id)&&void 0!==i?i:e.id,path:this.getPath(e),isSelected:null!==(s=n.isSelected)&&void 0!==s&&s});this.items.push(l),"checkbox"===this.controlBy?this.controlByCheckbox(e,l):this.controlByButton(e,l)}))}controlByButton(e,t){this.onElementClickListener.push({el:e,fn:i=>this.elementClick(i,e,t)}),e.addEventListener("click",this.onElementClickListener.find((t=>t.el===e)).fn)}controlByCheckbox(e,t){const i=e.querySelector(`input[value="${t.value}"]`);i&&(this.onControlChangeListener.push({el:i,fn:()=>this.controlChange(e,t)}),i.addEventListener("change",this.onControlChangeListener.find((e=>e.el===i)).fn))}getItem(e){return this.items.find((t=>t.id===e))}getPath(e){var t;const i=[];let s=e.closest("[data-hs-tree-view-item]");for(;s;){const e=JSON.parse(s.getAttribute("data-hs-tree-view-item"));i.push(e.value),s=null===(t=s.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]")}return i.reverse().join("/")}unselectItem(e=null){let t=this.getSelectedItems();e&&(t=t.filter((t=>t.id!==e.id))),t.length&&t.forEach((e=>{document.querySelector(`#${e.id}`).classList.remove("selected"),this.changeItemProp(e.id,"isSelected",!1)}))}selectItem(e,t){t.isSelected?(e.classList.remove("selected"),this.changeItemProp(t.id,"isSelected",!1)):(e.classList.add("selected"),this.changeItemProp(t.id,"isSelected",!0))}selectChildren(e,t){const i=e.querySelectorAll("[data-hs-tree-view-item]");Array.from(i).filter((e=>!e.classList.contains("disabled"))).forEach((e=>{const i=e.id?this.getItem(e.id):null;if(!i)return!1;t.isSelected?(e.classList.add("selected"),this.changeItemProp(i.id,"isSelected",!0)):(e.classList.remove("selected"),this.changeItemProp(i.id,"isSelected",!1));const s=this.getItem(e.id),n=e.querySelector(`input[value="${s.value}"]`);this.isIndeterminate&&(n.indeterminate=!1),s.isSelected?n.checked=!0:n.checked=!1}))}toggleParent(e){var t,i;let s=null===(t=e.parentElement)||void 0===t?void 0:t.closest("[data-hs-tree-view-item]");for(;s;){const e=s.querySelectorAll("[data-hs-tree-view-item]:not(.disabled)"),t=JSON.parse(s.getAttribute("data-hs-tree-view-item")),n=s.querySelector(`input[value="${t.value}"]`);let o=!1,l=0;e.forEach((e=>{const t=this.getItem(e.id);t.isSelected&&(l+=1),t.isSelected||(o=!0)})),o?(s.classList.remove("selected"),this.changeItemProp(s.id,"isSelected",!1),n.checked=!1):(s.classList.add("selected"),this.changeItemProp(s.id,"isSelected",!0),n.checked=!0),this.isIndeterminate&&(l>0&&l<e.length?n.indeterminate=!0:n.indeterminate=!1),s=null===(i=s.parentElement)||void 0===i?void 0:i.closest("[data-hs-tree-view-item]")}}update(){this.items.m
```

**File**: `dist/select.js` (modified, +1/-1)
```diff
@@ -13,4 +13,4 @@ Object.defineProperty(e,"__esModule",{value:!0}),e.stringToBoolean=e.menuSearchH
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-var i=this&&this.__awaiter||function(t,e,s,i){return new(s||(s=Promise))((function(o,n){function l(t){try{r(i.next(t))}catch(t){n(t)}}function a(t){try{r(i.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof s?e:new s((function(t){t(e)}))).then(l,a)}r((i=i.apply(t,e||[])).next())}))},o=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(e,"__esModule",{value:!0});const n=s(292),l=o(s(961)),a=o(s(248)),r=s(223);class d extends l.default{constructor(t,e){var s,i,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(s=null==d?void 0:d.minSearchLength)&&void 0!==s?s:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(i=null==d?void 0:d.toggleSeparators)||void 0===i?void 0:i.items)||", ",betweenItemsAndCounter:(null===(o=null==d?void 0:d.toggleSeparators)||void 0===o?void 0:o.betweenItemsAndCounter)||"and"},this.tagsItemTemplate=(null==d?void 0:d.tagsItemTemplate)||null,this.tagsItemClasses=(null==d?void 0:d.tagsItemClasses)||null,this.tagsInputId=(null==d?void 0:d.tagsInputId)||null,this.tagsInputClasses=(null==d?void 0:d.tagsInputClasses)||null,this.dropdownTag=(null==d?void 0:d.dropdownTag)||null,this.dropdownClasses=(null==d?void 0:d.dropdownClasses)||null,this.dropdownDirectionClasses=(null==d?void 0:d.dropdownDirectionClasses)||null,this.dropdownSpace=(null==d?void 0:d.dropdownSpace)||10,this.dropdownPlacement=(null==d?void 0:d.dropdownPlacement)||null,this.dropdownVerticalFixedPlacement=(null==d?void 0:d.dropdownVerticalFixedPlacement)||null,this.dropdownScope=(null==d?void 0:d.dropdownScope)||"parent",this.dropdownAutoPlacement=(null==d?void 0:d.dropdownAutoPlacement)||!1,this.searchTemplate=(null==d?void 0:d.searchTemplate)||null,this.searchWrapperTemplate=(null==d?void 0:d.searchWrapperTempla
```

**File**: `dist/select.mjs` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@ var t={189:(t,e,i)=>{i.d(e,{lP:()=>s});const s={auto:"auto","auto-start":"auto-s
  * @license: Licensed under MIT and Preline UI Fair Use License (https://preline.co/docs/license.html)
  * Copyright 2024 Preline Labs Ltd.
  */
-const s=(t,e,i="auto",s=10,o=null)=>{const n=e.getBoundingClientRect(),l=o?o.getBoundingClientRect():null,a=window.innerHeight,r=l?n.top-l.top:n.top,d=(o?l.bottom:a)-n.bottom,h=t.clientHeight+s;return"bottom"===i?d>=h:"top"===i?r>=h:r>=h||d>=h},o=(t,e=200)=>{let i;return(...s)=>{clearTimeout(i),i=setTimeout((()=>{t.apply(void 0,s)}),e)}},n=(t,e,i=null)=>{const s=new CustomEvent(t,{detail:{payload:i},bubbles:!0,cancelable:!0,composed:!1});e.dispatchEvent(s)},l=(t,e)=>{const i=()=>{e(),t.removeEventListener("transitionend",i,!0)},s=window.getComputedStyle(t),o=s.getPropertyValue("transition-duration");"none"!==s.getPropertyValue("transition-property")&&parseFloat(o)>0?t.addEventListener("transitionend",i,!0):e()},a=t=>{const e=document.createElement("template");return t=t.trim(),e.innerHTML=t,e.content.firstChild},r=(t,e,i=" ",s="add")=>{t.split(i).forEach((t=>{t.trim()&&("add"===s?e.classList.add(t):e.classList.remove(t))}))}}},e={};function i(s){var o=e[s];if(void 0!==o)return o.exports;var n=e[s]={exports:{}};return t[s](n,n.exports,i),n.exports}i.d=(t,e)=>{for(var s in e)i.o(e,s)&&!i.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:e[s]})},i.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);var s={};i.d(s,{A:()=>h});var o=i(926),n=i(615),l=i(862),a=i(189),r=function(t,e,i,s){return new(i||(i=Promise))((function(o,n){function l(t){try{r(s.next(t))}catch(t){n(t)}}function a(t){try{r(s.throw(t))}catch(t){n(t)}}function r(t){var e;t.done?o(t.value):(e=t.value,e instanceof i?e:new i((function(t){t(e)}))).then(l,a)}r((s=s.apply(t,e||[])).next())}))};class d extends n.A{constructor(t,e){var i,s,o,n,l;super(t,e),this.disabledObserver=null,this.optionId=0;const a=t.getAttribute("data-hs-select"),r=a?JSON.parse(a):{},d=Object.assign(Object.assign({},r),e);this.value=(null==d?void 0:d.value)||this.el.value||null,this.placeholder=(null==d?void 0:d.placeholder)||"Select...",this.hasSearch=(null==d?void 0:d.hasSearch)||!1,this.minSearchLength=null!==(i=null==d?void 0:d.minSearchLength)&&void 0!==i?i:0,this.preventSearchFocus=(null==d?void 0:d.preventSearchFocus)||!1,this.mode=(null==d?void 0:d.mode)||"default",this.viewport=void 0!==(null==d?void 0:d.viewport)?document.querySelector(null==d?void 0:d.viewport):null,this._isOpened=Boolean(null==d?void 0:d.isOpened)||!1,this.isMultiple=this.el.hasAttribute("multiple")||!1,this.isDisabled=this.el.hasAttribute("disabled")||!1,this.selectedItems=[],this.apiUrl=(null==d?void 0:d.apiUrl)||null,this.apiQuery=(null==d?void 0:d.apiQuery)||null,this.apiOptions=(null==d?void 0:d.apiOptions)||null,this.apiSearchQueryKey=(null==d?void 0:d.apiSearchQueryKey)||null,this.apiDataPart=(null==d?void 0:d.apiDataPart)||null,this.apiLoadMore=!0===(null==d?void 0:d.apiLoadMore)?{perPage:10,scrollThreshold:100}:"object"==typeof(null==d?void 0:d.apiLoadMore)&&null!==(null==d?void 0:d.apiLoadMore)&&{perPage:d.apiLoadMore.perPage||10,scrollThreshold:d.apiLoadMore.scrollThreshold||100},this.apiFieldsMap=(null==d?void 0:d.apiFieldsMap)||null,this.apiIconTag=(null==d?void 0:d.apiIconTag)||null,this.apiSelectedValues=(null==d?void 0:d.apiSelectedValues)||null,this.currentPage=0,this.isLoading=!1,this.hasMore=!0,this.wrapperClasses=(null==d?void 0:d.wrapperClasses)||null,this.toggleTag=(null==d?void 0:d.toggleTag)||null,this.toggleClasses=(null==d?void 0:d.toggleClasses)||null,this.toggleCountText=void 0===typeof(null==d?void 0:d.toggleCountText)?null:d.toggleCountText,this.toggleCountTextPlacement=(null==d?void 0:d.toggleCountTextPlacement)||"postfix",this.toggleCountTextMinItems=(null==d?void 0:d.toggleCountTextMinItems)||1,this.toggleCountTextMode=(null==d?void 0:d.toggleCountTextMode)||"countAfterLimit",this.toggleSeparators={items:(null===(s=null==d?void 0:d.toggleSeparato
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
