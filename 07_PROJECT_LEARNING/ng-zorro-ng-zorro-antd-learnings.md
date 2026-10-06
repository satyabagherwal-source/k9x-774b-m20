# Forensic Learning Record (Deep Inspection): NG-ZORRO/ng-zorro-antd

> **Canonical Artifact**: `07_PROJECT_LEARNING/ng-zorro-ng-zorro-antd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NG-ZORRO/ng-zorro-antd](https://github.com/NG-ZORRO/ng-zorro-antd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:43.523Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NG-ZORRO/ng-zorro-antd`
- **Description**: Angular UI Component Library based on Ant Design
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9180 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/affix/utils.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

export interface SimpleRect {
  top: number;
  left: number;
  width?: number;
  height?: number;
  bottom?: number;
}

export function isTargetWindow(target: Element | Window): target is Window {
  return typeof window !== 'undefined' && target === window;
}

export function getTargetRect(target: Element | Window): SimpleRect {
  return !isTargetWindow(target)
    ? target.getBoundingClientRect()
    : {
        top: 0,
        left: 0,
        bottom: 0
      };
}

```

### Core Architecture Module: `components/alert/demo/loop-banner.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { Component } from '@angular/core';

import { NzAlertModule } from 'ng-zorro-antd/alert';

@Component({
  selector: 'nz-demo-alert-loop-banner',
  imports: [NzAlertModule],
  template: `
    <nz-alert nzBanner [nzMessage]="message" />
    <br />
    <nz-alert nzBanner [nzMessage]="messagePauseOnHover" />

    <ng-template #message>
      <nz-alert-marquee nzSpeed="60">
        I can be a long text that scrolls continuously in the banner alert. This text will loop seamlessly.
      </nz-alert-marquee>
    </ng-template>

    <ng-template #messagePauseOnHover>
      <nz-alert-marquee nzSpeed="60" nzPauseOnHover="true">
        Hover over me to pause the scrolling animation. This text loops continuously.
      </nz-alert-marquee>
    </ng-template>
  `
})
export class NzDemoAlertLoopBannerComponent {}

```

### Core Architecture Module: `components/anchor/util.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

export function getOffsetTop(element: HTMLElement, container: HTMLElement | Window): number {
  if (!element || !element.getClientRects().length) {
    return 0;
  }
  const rect = element.getBoundingClientRect();

  if (rect.width || rect.height) {
    if (container === window) {
      const documentElement = element.ownerDocument!.documentElement!;
      return rect.top - documentElement.clientTop;
    }
    return rect.top - (container as HTMLElement).getBoundingClientRect().top;
  }

  return rect.top;
}

```

### Core Architecture Module: `components/carousel/demo/loop.ts`
```
import { Component } from '@angular/core';

import { NzCarouselModule } from 'ng-zorro-antd/carousel';

@Component({
  selector: 'nz-demo-carousel-loop',
  imports: [NzCarouselModule],
  template: `
    <nz-carousel nzAutoPlay [nzEffect]="effect" [nzLoop]="false">
      @for (index of array; track index) {
        <div nz-carousel-content>
          <h3>{{ index }}</h3>
        </div>
      }
    </nz-carousel>
  `,
  styles: `
    [nz-carousel-content] {
      text-align: center;
      height: 160px;
      line-height: 160px;
      background: #364d79;
      color: #fff;
      overflow: hidden;
    }

    h3 {
      color: #fff;
      margin-bottom: 0;
      user-select: none;
    }
  `
})
export class NzDemoCarouselLoopComponent {
  array = [1, 2, 3, 4];
  effect = 'scrollx';
}

```

### Core Architecture Module: `components/carousel/strategies/experimental/transform-no-loop-strategy.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { Platform } from '@angular/cdk/platform';
import { ChangeDetectorRef, QueryList, Renderer2 } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { NzCarouselContentDirective } from '../../carousel-content.directive';
import { NzCarouselComponentAsSource, PointerVector } from '../../typings';
import { NzCarouselBaseStrategy } from '../base-strategy';

interface NzCarouselTransformOnLoopStrategyOptions {
  direction: 'left' | 'right';
}

/**
 * this strategy is very much like NzCarouselTransformStrategy, but it doesn't loop between the first and the last one
 */
export class NzCarouselTransformNoLoopStrategy extends NzCarouselBaseStrategy<NzCarouselTransformOnLoopStrategyOptions> {
  private isTransitioning = false;

  private get vertical(): boolean {
    return this.carouselComponent!.vertical;
  }

  constructor(
    carouselComponent: NzCarouselComponentAsSource,
    cdr: ChangeDetectorRef,
    renderer: Renderer2,
    platform: Platform,
    options?: NzCarouselTransformOnLoopStrategyOptions
  ) {
    super(carouselComponent, cdr, renderer, platform, options);
  }

  override dispose(): void {
    this.renderer.setStyle(this.slickTrackEl, 'transform', null);

    super.dispose();
  }

  override withCarouselContents(contents: QueryList<NzCarouselContentDirective> | null): void {
    super.withCarouselContents(contents);

    const carousel = this.carouselComponent!;
    const activeIndex = carousel.activeIndex;

    if (this.platform.isBrowser && this.contents.length) {
      this.renderer.setStyle(this.slickListEl, 'height', `${this.unitHeight}px`);

      if (this.platform.isBrowser && this.contents.length) {
        this.renderer.setStyle(this.slickListEl, 'height', `${this.unitHeight}px`);

        if (this.vertical) {
          this.renderer.setStyle(this.slickTrackEl, 'width', `${this.unitWidth}px`);
          this.renderer.setStyle(this.slickTrackEl, 'height', `${this.length * this.unitHeight}px`);
          this.renderer.setStyle(
            this.slickTrackEl,
            'transform',
            `translate3d(0, ${-activeIndex * this.unitHeight}px, 0)`
          );
        } else {
          this.renderer.setStyle(this.slickTrackEl, 'height', `${this.unitHeight}px`);
          this.renderer.setStyle(this.slickTrackEl, 'width', `${this.length * this.unitWidth}px`);
          this.renderer.setStyle(
            this.slickTrackEl,
            'transform',
            `translate3d(${-activeIndex * this.unitWidth}px, 0, 0)`
          );
        }

        this.contents.forEach((content: NzCarouselContentDirective) => {
          this.renderer.setStyle(content.el, 'position', 'relative');
          this.renderer.setStyle(content.el, 'width', `${this.unitWidth}px`);
          this.renderer.setStyle(content.el, 'height', `${this.unitHeight}px`);
        });
      }
    }
  }

  switch(_f: number, _t: number): Observable<void> {
    const to = (_t + this.length) % this.length;
    const transitionSpeed = this.carouselComponent!.nzTransitionSpeed;
    const complete$ = new Subject<void>();

    this.renderer.setStyle(this.slickTrackEl, 'transition', `transform ${transitionSpeed}ms ease`);

    if (this.vertical) {
      this.renderer.setStyle(this.slickTrackEl, 'transform', `translate3d(0, ${-to * this.unitHeight}px, 0)`);
    } else {
      this.renderer.setStyle(this.slickTrackEl, 'transform', `translate3d(${-to * this.unitWidth}px, 0, 0)`);
    }

    this.isTransitioning = true;

    setTimeout(() => {
      // this strategy don't need to do a following adjust
      this.isTransitioning = false;

      complete$.next();
      complete$.complete();
    }, transitionSpeed);

    return complete$.asObservable();
  }

  override dragging(vector: PointerVector): void {
    if (this.isTransitioning) {
      return;
    }

    const activeIndex = this.carouselComponent!.activeIndex;

    if (this.vertical) {
      this.renderer.setStyle(
        this.slickTrackEl,
        'transform',
        `translate3d(0, ${-activeIndex * this.unitHeight + vector.x}px, 0)`
      );
    } else {
      this.renderer.setStyle(
        this.slickTrackEl,
        'transform',
        `translate3d(${-activeIndex * this.unitWidth + vector.x}px, 0, 0)`
      );
    }
  }
}

```

### Core Architecture Module: `components/cascader/cascader-display-render.pipe.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { inject, Pipe, PipeTransform } from '@angular/core';

import { NzTreeNode } from 'ng-zorro-antd/tree';

import { NzCascaderTreeService } from './cascader-tree.service';
import { NzCascaderService } from './cascader.service';
import { NzDisplayRenderContext } from './typings';

export const defaultDisplayRender = (labels: string[]): string => labels.join(' / ');

@Pipe({
  name: 'nzDisplayRender'
})
export class NzDisplayRenderPipe implements PipeTransform {
  private cascaderService = inject(NzCascaderService);
  private cascaderTreeService = inject(NzCascaderTreeService);

  transform(node: NzTreeNode): string {
    const ancestors = this.cascaderTreeService.getAncestorNodeList(node);
    const selectedOptions = this.cascaderTreeService.toOptions(ancestors);
    const labels = selectedOptions.map(o => this.cascaderService.getOptionLabel(o));
    return defaultDisplayRender(labels);
  }
}

@Pipe({
  name: 'nzDisplayRenderContext'
})
export class NzDisplayRenderContextPipe implements PipeTransform {
  private cascaderService = inject(NzCascaderService);
  private cascaderTreeService = inject(NzCascaderTreeService);

  transform(node: NzTreeNode): NzDisplayRenderContext {
    const ancestors = this.cascaderTreeService.getAncestorNodeList(node);
    const selectedOptions = this.cascaderTreeService.toOptions(ancestors);
    const labels = selectedOptions.map(o => this.cascaderService.getOptionLabel(o));
    return {
      labels,
      selectedOptions
    };
  }
}

```

### Core Architecture Module: `components/cascader/demo/custom-render.ts`
```
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzCascaderModule, NzCascaderOption } from 'ng-zorro-antd/cascader';

const options: NzCascaderOption[] = [
  {
    value: 'zhejiang',
    label: 'Zhejiang',
    children: [
      {
        value: 'hangzhou',
        label: 'Hangzhou',
        children: [
          {
            value: 'xihu',
            label: 'West Lake',
            code: 752100,
            isLeaf: true
          }
        ]
      },
      {
        value: 'ningbo',
        label: 'Ningbo',
        code: '315000',
        isLeaf: true
      }
    ]
  },
  {
    value: 'jiangsu',
    label: 'Jiangsu',
    children: [
      {
        value: 'nanjing',
        label: 'Nanjing',
        children: [
          {
            value: 'zhonghuamen',
            label: 'Zhong Hua Men',
            code: 453400,
            isLeaf: true
          }
        ]
      }
    ]
  }
];

@Component({
  selector: 'nz-demo-cascader-custom-render',
  imports: [FormsModule, NzCascaderModule],
  template: `
    <nz-cascader
      style="width: 100%;"
      [nzLabelRender]="renderTpl"
      [nzOptions]="nzOptions"
      [(ngModel)]="values"
      (ngModelChange)="onChanges($event)"
    />

    <ng-template #renderTpl let-labels="labels" let-selectedOptions="selectedOptions">
      @for (label of labels; track label) {
        @if (!$last) {
          <span>{{ label }} /</span>
        } @else {
          <span>
            {{ label }} (
            <a href="javascript:;" (click)="handleAreaClick($event, label, selectedOptions[$index])">
              {{ selectedOptions[$index].code }}
            </a>
            )
          </span>
        }
      }
    </ng-template>
  `
})
export class NzDemoCascaderCustomRenderComponent {
  readonly nzOptions: NzCascaderOption[] = options;
  values: string[] | null = null;

  onChanges(values: string[]): void {
    console.log(values, this.values);
  }

  handleAreaClick(e: Event, label: string, option: NzCascaderOption): void {
    e.preventDefault();
    e.stopPropagation();
    console.log('clicked "', label, '"', option);
  }
}

```

### Core Architecture Module: `components/cascader/demo/popup-render.ts`
```
import { NgTemplateOutlet } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzCascaderModule, NzCascaderOption } from 'ng-zorro-antd/cascader';
import { NzDividerModule } from 'ng-zorro-antd/divider';

const options: NzCascaderOption[] = [
  {
    value: 'zhejiang',
    label: 'Zhejiang',
    children: [
      {
        value: 'hangzhou',
        label: 'Hangzhou',
        children: [
          {
            value: 'xihu',
            label: 'West Lake',
            isLeaf: true
          }
        ]
      }
    ]
  },
  {
    value: 'jiangsu',
    label: 'Jiangsu',
    children: [
      {
        value: 'nanjing',
        label: 'Nanjing',
        children: [
          {
            value: 'zhonghuamen',
            label: 'Zhong Hua Men',
            isLeaf: true
          }
        ]
      }
    ]
  }
];

@Component({
  selector: 'nz-demo-cascader-popup-render',
  imports: [FormsModule, NgTemplateOutlet, NzCascaderModule, NzDividerModule],
  template: `
    <nz-cascader [nzOptions]="nzOptions" [nzPopupRender]="popupRenderTpl" [(ngModel)]="values" />

    <ng-template #popupRenderTpl let-menu>
      <div style="padding: 8px; color: #1890ff">This is header.</div>
      <nz-divider style="margin: 0" />
      <ng-container [ngTemplateOutlet]="menu" />
      <nz-divider style="margin: 0" />
      <div style="padding: 8px">The footer is not very short.</div>
    </ng-template>
  `
})
export class NzDemoCascaderPopupRenderComponent {
  readonly nzOptions: NzCascaderOption[] = options;
  values: string[] | null = null;
}

```

### Core Architecture Module: `components/cascader/utils.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { NzTreeNode } from 'ng-zorro-antd/core/tree';

export function isChildNode(node: NzTreeNode): boolean {
  return node.isLeaf || !node.children || !node.children.length;
}

export function isParentNode(node: NzTreeNode): boolean {
  return !!node.children && !!node.children.length && !node.isLeaf;
}

```

### Core Architecture Module: `components/color-picker/src/util/util.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { Color } from '../interfaces/color';
import type { ColorGenInput, HsbaColorType, TransformOffset } from '../interfaces/type';

export const generateColor = (color: ColorGenInput): Color => {
  if (color instanceof Color) {
    return color;
  }
  return new Color(color);
};

export const defaultColor = generateColor('#1677ff');

export function calculateColor(
  offset: TransformOffset,
  containerRef: HTMLDivElement,
  targetRef: HTMLDivElement,
  color?: Color | null,
  type?: HsbaColorType
): Color {
  const { width, height } = containerRef.getBoundingClientRect();
  const { width: targetWidth, height: targetHeight } = targetRef.getBoundingClientRect();
  const centerOffsetX = targetWidth / 2;
  const centerOffsetY = targetHeight / 2;
  const saturation = (offset.x + centerOffsetX) / width;
  const bright = 1 - (offset.y + centerOffsetY) / height;
  const hsb = color?.toHsb() || { a: 0, h: 0, s: 0, b: 0 };
  const alphaOffset = saturation;
  const hueOffset = ((offset.x + centerOffsetX) / width) * 360;

  if (type) {
    switch (type) {
      case 'hue':
        return generateColor({
          ...hsb,
          h: hueOffset <= 0 ? 0 : hueOffset
        });
      case 'alpha':
        return generateColor({
          ...hsb,
          a: alphaOffset <= 0 ? 0 : alphaOffset
        });
    }
  }

  return generateColor({
    h: hsb.h,
    s: saturation <= 0 ? 0 : saturation,
    b: bright >= 1 ? 1 : bright,
    a: hsb.a
  });
}

export const calculateOffset = (
  containerRef: HTMLDivElement,
  targetRef: HTMLDivElement,
  color?: Color | null,
  type?: HsbaColorType
): TransformOffset | null => {
  const { width, height } = containerRef.getBoundingClientRect();
  const { width: targetWidth, height: targetHeight } = targetRef.getBoundingClientRect();
  const centerOffsetX = targetWidth / 2;
  const centerOffsetY = targetHeight / 2;
  const hsb = color?.toHsb() || { a: 0, h: 0, s: 0, b: 0 };

  // Exclusion of boundary cases
  if ((targetWidth === 0 && targetHeight === 0) || targetWidth !== targetHeight) {
    return null;
  }

  if (type) {
    switch (type) {
      case 'hue':
        return {
          x: (hsb.h / 360) * width - centerOffsetX,
          y: -centerOffsetY / 3
        };
      case 'alpha':
        return {
          x: hsb.a * width - centerOffsetX,
          y: -centerOffsetY / 3
        };
    }
  }
  return {
    x: hsb.s * width - centerOffsetX,
    y: (1 - hsb.b) * height - centerOffsetY
  };
};

```

### Core Architecture Module: `components/core/animation/animation-consts.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

export class AnimationDuration {
  static SLOW = '0.3s'; // Modal
  static BASE = '0.2s';
  static FAST = '0.1s'; // Tooltip
}

export class AnimationCurves {
  static EASE_BASE_OUT = 'cubic-bezier(0.7, 0.3, 0.1, 1)';
  static EASE_BASE_IN = 'cubic-bezier(0.9, 0, 0.3, 0.7)';
  static EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1)';
  static EASE_IN = 'cubic-bezier(0.55, 0.055, 0.675, 0.19)';
  static EASE_IN_OUT = 'cubic-bezier(0.645, 0.045, 0.355, 1)';
  static EASE_OUT_BACK = 'cubic-bezier(0.12, 0.4, 0.29, 1.46)';
  static EASE_IN_BACK = 'cubic-bezier(0.71, -0.46, 0.88, 0.6)';
  static EASE_IN_OUT_BACK = 'cubic-bezier(0.71, -0.46, 0.29, 1.46)';
  static EASE_OUT_CIRC = 'cubic-bezier(0.08, 0.82, 0.17, 1)';
  static EASE_IN_CIRC = 'cubic-bezier(0.6, 0.04, 0.98, 0.34)';
  static EASE_IN_OUT_CIRC = 'cubic-bezier(0.78, 0.14, 0.15, 0.86)';
  static EASE_OUT_QUINT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  static EASE_IN_QUINT = 'cubic-bezier(0.755, 0.05, 0.855, 0.06)';
  static EASE_IN_OUT_QUINT = 'cubic-bezier(0.86, 0, 0.07, 1)';
}

```

### Core Architecture Module: `components/core/animation/collapse.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { AnimationCallbackEvent, Directive, effect, ElementRef, inject, Injectable, input } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';

import { requestAnimationFrame } from 'ng-zorro-antd/core/polyfill';

import { isAnimationEnabled, NzNoAnimationDirective } from './no-animation';

const COLLAPSE_MOTION_CLASS = 'ant-motion-collapse';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[animation-collapse]',
  host: {
    '(transitionend)': 'onTransitionEnd($event)'
  }
})
export class NzAnimationCollapseDirective {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly noAnimation = inject(NzNoAnimationDirective, { optional: true, host: true });
  private readonly animationEnabled = isAnimationEnabled(() => !this.noAnimation?.nzNoAnimation());

  readonly open = input<boolean>(false);
  readonly leavedClassName = input<string>('');
  private firstRender = true;

  constructor() {
    effect(() => {
      const open = this.open();
      // should skip the first rendering
      const animationEnabled = this.animationEnabled() && !this.firstRender;
      const element = this.elementRef.nativeElement;
      const leavedClassName = this.leavedClassName();

      if (open && leavedClassName) {
        element.classList.remove(leavedClassName);
      }

      if (animationEnabled) {
        /**
         * | open  | animation stage | height | opacity |
         * | ----  | --------------- | ------ | ------- |
         * | true  | before          | 0            | 1 |
         * | true  | active          | scrollHeight | 1 |
         * | true  | end             | auto         | 1 |
         * | false | before          | scrollHeight | 0 |
         * | false | active          | 0            | 0 |
         * | false | end             | 0            | 0 |
         */
        element.classList.add(COLLAPSE_MOTION_CLASS);

        if (open) {
          // Wait for next frame to get correct scrollHeight after removing hidden class
          requestAnimationFrame(() => {
            const scrollHeight = this.getActualScrollHeight(element);
            element.style.height = coerceCssPixelValue(scrollHeight);
            element.style.opacity = '1';
          });
        } else {
          // Used for setting height to actual height when transition start
          const scrollHeight = this.getActualScrollHeight(element);
          element.style.height = coerceCssPixelValue(scrollHeight);
          requestAnimationFrame(() => {
            element.style.height = coerceCssPixelValue(0);
            element.style.opacity = '0';
          });
        }
      } else {
        if (open) {
          element.style.height = 'auto';
          element.style.opacity = '1';
        } else {
          element.style.height = coerceCssPixelValue(0);
          element.style.opacity = '0';
          if (leavedClassName) {
            element.classList.add(leavedClassName);
          }
        }
      }

      this.firstRender = false;
    });
  }

  // Calculate height by summing up direct children's offsetHeight
  // This naturally excludes collapsed nested submenus since they have height: 0
  private getActualScrollHeight(element: HTMLElement): number {
    return Array.from(element.children).reduce((acc, child) => acc + (child as HTMLElement).offsetHeight, 0);
  }

  protected onTransitionEnd(event: TransitionEvent): void {
    if (!this.animationEnabled() || event.target !== this.elementRef.nativeElement) {
      return;
    }

    // set height to auto after transition end, so that it's height can be changed along with content
    if (this.open()) {
      this.elementRef.nativeElement.style.height = 'auto';
    } else if (this.leavedClassName()) {
      this.elementRef.nativeElement.classList.add(this.leavedClassName());
    }

    this.elementRef.nativeElement.classList.remove(COLLAPSE_MOTION_CLASS);
  }
}

@Injectable()
export class NzAnimationTreeCollapseService {
  firstRender = true;
  virtualScroll = false;

  readonly animationDone$ = new Subject<void>();

  constructor() {
    this.animationDone$.pipe(debounceTime(50), take(1)).subscribe(() => {
      this.firstRender = false;
    });
  }
}

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[animation-tree-collapse]',
  host: {
    '(animate.enter)': 'onAnimationEnter($event)',
    '(animate.leave)': 'onAnimationLeave($event)'
  }
})
export class NzAnimationTreeCollapseDirective {
  private readonly treeCollapseService = inject(NzAnimationTreeCollapseService, { optional: true });
  private readonly noAnimation = inject(NzNoAnimationDirective, { optional: true, host: true });
  // should disable animation in virtual scrolling
  private readonly animationEnabled = isAnimationEnabled(
    () => !this.noAnimation?.nzNoAnimation() && !(this.treeCollapseService?.virtualScroll ?? false)
  );

  private get firstRender(): boolean {
    return this.treeCollapseService?.firstRender ?? false;
  }

  protected onAnimationEnter(event: AnimationCallbackEvent): void {
    if (!this.animationEnabled() || this.firstRender) {
      this.treeCollapseService?.animationDone$.next();
      event.animationComplete();
      return;
    }

    const element = event.target as HTMLElement;
    element.style.height = coerceCssPixelValue(0);
    element.style.opacity = '0';
    element.classList.add(COLLAPSE_MOTION_CLASS);

    const onTransitionEnd = (e: TransitionEvent): void => {
      // Only handle height transition to avoid premature cleanup
      if (e.propertyName !== 'height') {
        return;
      }
      element.removeEventListener('transitionend', onTransitionEnd);
      element.style.height = 'auto';
      element.classList.remove(COLLAPSE_MOTION_CLASS);
      event.animationComplete();
    };

    requestAnimationFrame(() => {
      element.style.height = coerceCssPixelValue(element.scrollHeight);
      element.style.opacity = '1';
    });

    element.addEventListener('transitionend', onTransitionEnd);
  }

  protected onAnimationLeave(event: AnimationCallbackEvent): void {
    if (!this.animationEnabled()) {
      event.animationComplete();
      return;
    }

    const element = event.target as HTMLElement;
    element.style.height = coerceCssPixelValue(element.scrollHeight);
    element.style.opacity = '1';
    element.classList.add(COLLAPSE_MOTION_CLASS);

    const onTransitionEnd = (e: TransitionEvent): void => {
      // Only handle height transition to avoid premature cleanup
      if (e.propertyName !== 'height') {
        return;
      }
      element.removeEventListener('transitionend', onTransitionEnd);
      event.animationComplete();
    };

    requestAnimationFrame(() => {
      element.style.height = coerceCssPixelValue(0);
      element.style.opacity = '0';
      element.style.marginBottom = '0';
    });

    element.addEventListener('transitionend', onTransitionEnd);
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9995** (2026-09-30): **[nz-select] use ngModel + ngModelChange work incorrect**
  *Symptoms*:  ### Reproduction link [https://stackblitz.com/~/github.com/sdwdjzhy/test-ng-zorro-antd](https://stackblitz.com/~/github.com/sdwdjzhy/test-ng-zorro-antd)  ### Steps to reproduce change to 'lucy1' , when open confirm dialog ,  click 'Cancel' button. it show the value not change, but the nz-select show "lucy1" already  改变nz-select的选项，选中 lucy1 时，会弹窗提醒是否要改变。点“取消”，但是nz-select显示的已经是 lucy1 了   ### What is expected? do not change  ### What is actually happening? the nz-select shows incorrect  nz-select显示错误  | Environment | Info | |---|---| | ng-zorro-antd | 22.1.1 | | Browser | google |  --- 应该是 源码中自己的value 信号量已经变更了，但是没有与外界传入的ngModel 做联动  <!-- generated by ng-zorro-issue-helper. DO NOT REMOVE -->
  **Post-Mortem & Fix Analysis**:
  > 感谢提供可运行的复现。这个现象符合 Angular `ngModel` / ControlValueAccessor 的行为，并非 Select 在 v22 中的回归。  `[ngModel]="value()"` 是单向绑定。用户选择 option 后，Select 会先更新内部选中值并触发 `ngModelChange`；当前回调在取消时没有向绑定值写入新的值，因此 Angular 不会再次调用控件的 `writeValue` 来恢复显示。  如果需要在确认弹窗取消后恢复选择，请维护一个用于界面展示的 draft value，并在取消时显式将它恢复为旧值：  ```ts confirmedValue = signal('jack'); displayValue = signal('jack');  changeValue(next: string): void {   const previous = this.displayValue();   this.displayValue.set(next);    if (next !== 'lucy1') {     this.confirmedValue.set(next);     return;   }    this.modal.confirm({     nzContent: 'Confirm change?',     nzOnOk: () => this.confirmedValue.set(next),     nzOnCancel: () => this.displayValue.set(previous)   }); } ```  ```html <nz-select [ngModel]="displayValue()" (ngModelChange)="changeValue($event)"> ```  这样取消时 `displayValue` 会实际从新值变回旧值，Select 将通过正常的 CVA `writeValue` 流程恢复显示；`confirmedValue` 则只在确认后更新。
  > 以上，我认为这是一个使用问题，因此关闭此 issue。

- **Issue #9990** (2026-09-28): **fix(module:icon): set rotate through CSSOM so strict CSP allows it**
  *Symptoms*: ## PR Checklist Please check if your PR fulfills the following requirements:  - [x] The commit message follows our guidelines: https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/CONTRIBUTING.md#commit - [x] Tests for the changes have been added (for bug fixes / features) - [ ] Docs have been added / updated (for bug fixes / features)   ## PR Type What kind of change does this PR introduce?  <!-- Please check the one that applies to this PR using "x". --> - [x] Bugfix - [ ] Feature - [ ] Code style update (formatting, local variables) - [ ] Refactoring (no functional changes, no api changes) - [ ] Build related changes - [ ] CI related changes - [ ] Documentation content changes - [ ] Application (the showcase website) / infrastructure changes - [ ] Other... Please describe:  ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  Issue Number: #9987  `nzRotate` is applied with `renderer.setAttribute(svg, 'style', 'transform: rotate(Ndeg)')`. A strict `style-src` Content Security Policy (no `'unsafe-inline'`) blocks inline `style` attributes, so the icon never rotates. Clearing the rotation also removed the whole `style` attribute, dropping any other inline styles on a custom `<svg>`.  ## What is the new behavior?  `handleRotate` uses `renderer.setStyle(svg, 'transform', …)` / `renderer.removeStyle(svg, 'transform')`, which write through the CSSOM (`el.style`), the same approach `core/util/text-mea
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9990?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.04%. Comparing base ([`9111740`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/9111740ecd86349538a4ef2bc7e28d840122e893?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)) to head ([`5e962ec`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/5e962ec66bb42a2c7ab4d80c67cb08091fb95cd6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff        

- **Issue #9987** (2026-09-28): **Icon rotate property violating strict CSP**
  *Symptoms*:  ### Reproduction link [https://stackblitz.com/edit/imuon3mg?file=src%2Fapp%2Fapp.ts](https://stackblitz.com/edit/imuon3mg?file=src%2Fapp%2Fapp.ts)  ### Steps to reproduce Load the application  ### What is expected? Smiley is upside down  ### What is actually happening? Smiley is not upside down because rotation is prevented by CSP  | Environment | Info | |---|---| | ng-zorro-antd | 22.1.1 | | Browser | All |    <!-- generated by ng-zorro-issue-helper. DO NOT REMOVE -->

- **Issue #9986** (2026-09-28): **fix(module:*): add standalone ngModelOptions to avoid NG01354**
  *Symptoms*: ## PR Checklist Please check if your PR fulfills the following requirements:  - [X] The commit message follows our guidelines: https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/CONTRIBUTING.md#commit - [ ] Tests for the changes have been added (for bug fixes / features) - [ ] Docs have been added / updated (for bug fixes / features)   ## PR Type What kind of change does this PR introduce?  <!-- Please check the one that applies to this PR using "x". --> - [X] Bugfix - [ ] Feature - [ ] Code style update (formatting, local variables) - [ ] Refactoring (no functional changes, no api changes) - [ ] Build related changes - [ ] CI related changes - [ ] Documentation content changes - [ ] Application (the showcase website) / infrastructure changes - [ ] Other... Please describe:  ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  Issue Number: N/A   ## What is the new behavior?   ## Does this PR introduce a breaking change? - [ ] Yes - [x] No  <!-- If this PR contains a breaking change, please describe the impact and migration path for existing applications below. -->   ## Other information 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9986?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO) Report :x: Patch coverage is `72.22222%` with `5 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 89.03%. Comparing base ([`061ffc2`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/061ffc271bdd7cb3c034c34dd097fa81c9fea8b3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)) to head ([`1344e2b`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/1344e2b041604bacdbf8f5752805f12a98ef69b6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)). :warning: Report is 3 commits behind head on master.  | [Files with missing lines](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9986

- **Issue #9984** (2026-09-30): **NG01354 - components in [formGroup] produce the NG01354 warning on the browser console**
  *Symptoms*:  ### Reproduction link [https://stackblitz.com/edit/wgyfn7qo-sf3mk3oa?file=src%2Fapp%2Fapp.ts](https://stackblitz.com/edit/wgyfn7qo-sf3mk3oa?file=src%2Fapp%2Fapp.ts)  ### Steps to reproduce Create a form with a [formGroup] and include e.g. checkbox or a date-picker. Then the warning NG01354 shows in the browser console  ### What is expected? There is no warning  ### What is actually happening? There is the NG01354 warning  | Environment | Info | |---|---| | ng-zorro-antd | 22.1.1 | | Browser | every browser |  --- Most likely this issue will not only affect nz-checkbox and nz-date-picker but all components. There was already an issue regarding nz-select and nz-cascader. See: https://github.com/NG-ZORRO/ng-zorro-antd/issues/9926 and the fix: https://github.com/NG-ZORRO/ng-zorro-antd/pull/9945  <!-- generated by ng-zorro-issue-helper. DO NOT REMOVE -->
  **Post-Mortem & Fix Analysis**:
  > Getting this in v21.1.0 in date picker.

- **Issue #9983** (2026-09-30): **fix(module:image): respect nzKeyboard when closing preview with escape**
  *Symptoms*: Keep the image preview open on Escape when `nzKeyboard` is `false`.  Closes #9980.  ## PR Checklist Please check if your PR fulfills the following requirements:  - [x] The commit message follows our guidelines: https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/CONTRIBUTING.md#commit - [x] Tests for the changes have been added (for bug fixes / features) - [ ] Docs have been added / updated (for bug fixes / features): not needed, the docs already say `nzKeyboard: false` disables Escape  ## PR Type What kind of change does this PR introduce?  - [x] Bugfix - [ ] Feature - [ ] Code style update (formatting, local variables) - [ ] Refactoring (no functional changes, no api changes) - [ ] Build related changes - [ ] CI related changes - [ ] Documentation content changes - [ ] Application (the showcase website) / infrastructure changes - [ ] Other... Please describe:  ## What is the current behavior?  `NzImageService.preview(images, { nzKeyboard: false })` still closes when Escape is pressed. `NzImagePreviewRef` only handles Escape and the arrow keys when `nzKeyboard` is true, but `NzImagePreviewComponent` also listens for Escape on `document` (added in #8809) and never checks the option.  Issue Number: #9980  ## What is the new behavior?  The component only registers its document-level Escape listener when `nzKeyboard` is true. With `nzKeyboard: false`, neither Escape nor the arrow keys affect the preview. The default (`true`) behaves as before.  The new spec opens a preview wit
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9983?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.04%. Comparing base ([`061ffc2`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/061ffc271bdd7cb3c034c34dd097fa81c9fea8b3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)) to head ([`c58a6b7`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/c58a6b7005b975dc815636ff8fb504e45c3224e2?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)). :warning: Report is 5 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff       

- **Issue #9980** (2026-09-30): **image预览无法用nzKeyboard禁止ESC关闭**
  *Symptoms*:  ### Reproduction link [https://stackblitz.com/edit/stackblitz-starters-pkusqtpc?file=src%2Fmain.ts](https://stackblitz.com/edit/stackblitz-starters-pkusqtpc?file=src%2Fmain.ts)  ### Steps to reproduce 文档中说明：nzKeyboard 属性 可以禁止 ESC关闭。 但是没有生效  ### What is expected? nzKeyboard 可以 禁止 ESC关闭  ### What is actually happening? nzKeyboard 可以 无法禁止 ESC关闭  | Environment | Info | |---|---| | ng-zorro-antd | 22.1.1 | | Browser | 谷歌 |    <!-- generated by ng-zorro-issue-helper. DO NOT REMOVE -->

- **Issue #9975** (2026-09-22): **chore(release): release 22.1.1**
  *Symptoms*: ## PR Checklist  - [x] The commit message follows our guidelines: https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/CONTRIBUTING.md#commit - [ ] Tests for the changes have been added (for bug fixes / features) - [x] Docs have been added / updated (for bug fixes / features)  ## PR Type  - [ ] Bugfix - [ ] Feature - [ ] Code style update (formatting, local variables) - [ ] Refactoring (no functional changes, no api changes) - [ ] Build related changes - [ ] CI related changes - [ ] Documentation content changes - [ ] Application (the showcase website) / infrastructure changes - [x] Other... Please describe: Release preparation for 22.1.1.  ## What is the current behavior?  The library package and version token are at 22.1.0. Six subsequent fixes have not yet been included in the release notes.  Issue Number: N/A  ## What is the new behavior?  Bump the library package and version token to 22.1.1, and update the root, English, and Chinese changelogs dated 2026-09-22. The release covers fixes for date-picker accessibility, input search button borders, submenu state, rating focus order, slider initialization with Signal Forms, and table column measurement during modal animations.  ## Does this PR introduce a breaking change?  - [ ] Yes - [x] No  ## Other information  Validation:  - `git diff --check` - Repository pre-commit checks: TypeScript and ESLint; commitlint. - Verified both version files, six matching bilingual entries and links, and preservation of existing changelog h
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9975?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.06%. Comparing base ([`6a44eff`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/6a44eff4be805797a3794de196d888ee69ba6fac?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)) to head ([`cb94d3d`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/cb94d3d34f9a833fc19c8667576f47d89bead93f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #9975      +/-   ## =

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

### Incident Patch 1: `10a07e40` (2026-09-30)
**Commit Message**: fix(module:image): respect nzKeyboard when closing preview with escape (#9983)

The preview component listened for Escape on the document regardless of
nzKeyboard, so the preview still closed when the option was false.

Closes #9980

Co-authored-by: Manos Kaparos <>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `components/image/image-preview.component.ts` (modified, +12/-10)
```diff
@@ -257,17 +257,19 @@ export class NzImagePreviewComponent implements OnInit {
         this.ngZone.run(() => this.wheelZoomEventHandler(event));
       });
 
-    fromEventOutsideAngular<KeyboardEvent>(this.document, 'keydown')
-      .pipe(
-        filter(event => event.keyCode === ESCAPE),
-        takeUntilDestroyed(this.destroyRef)
-      )
-      .subscribe(() => {
-        this.ngZone.run(() => {
-          this.onClose();
-          this.markForCheck();
+    if (this.config.nzKeyboard) {
+      fromEventOutsideAngular<KeyboardEvent>(this.document, 'keydown')
+        .pipe(
+          filter(event => event.keyCode === ESCAPE),
+          takeUntilDestroyed(this.destroyRef)
+        )
+        .subscribe(() => {
+          this.ngZone.run(() => {
+            this.onClose();
+            this.markForCheck();
+          });
         });
-      });
+    }
   }
 
   setImages(images: NzImage[], scaleStepMap?: Map<string, number>): void {
```

**File**: `components/image/image.spec.ts` (modified, +17/-2)
```diff
@@ -27,6 +27,7 @@ import {
   NzImageDirective,
   NzImageGroupComponent,
   NzImageModule,
+  NzImagePreviewOptions,
   NzImagePreviewRef,
   NzImageService
 } from 'ng-zorro-antd/image';
@@ -473,6 +474,20 @@ describe('image preview', () => {
 
         expect(previewInstance.onClose).toHaveBeenCalled();
       });
+
+      it('should not close image preview when escape is pressed and nzKeyboard is false', () => {
+        context.images = [{ src: QUICK_SRC }];
+        context.createByService({ nzKeyboard: false });
+        const previewInstance = context.previewRef!.previewInstance;
+        tickChanges();
+        vi.spyOn(previewInstance, 'onClose');
+
+        dispatchKeyboardEvent(overlayContainerElement, 'keydown', ESCAPE);
+        vi.advanceTimersByTime(0);
+
+        expect(previewInstance.onClose).not.toHaveBeenCalled();
+        expect(getPreviewRootElement()).not.toBeNull();
+      });
     });
 
     it('should container click work', async () => {
@@ -807,8 +822,8 @@ export class TestImagePreviewGroupComponent {
   @ViewChild(NzImageGroupComponent) nzImageGroup!: NzImageGroupComponent;
   @ViewChild(NzImageDirective) nzImage!: NzImageDirective;
 
-  createByService(): void {
-    this.previewRef = this.nzImageService.preview(this.images, { nzZoom: 1.5, nzRotate: 0 });
+  createByService(options?: NzImagePreviewOptions): void {
+    this.previewRef = this.nzImageService.preview(this.images, { nzZoom: 1.5, nzRotate: 0, ...options });
   }
 
   triggerPreview(): void {
```

---

### Incident Patch 2: `e95d13f7` (2026-09-28)
**Commit Message**: fix(module:icon): set rotate through CSSOM so strict CSP allows it (#9990)

**File**: `components/icon/icon.directive.ts` (modified, +4/-2)
```diff
@@ -172,11 +172,13 @@ export class NzIconDirective extends IconBase implements AfterContentChecked {
       return;
     }
 
+    // Set the property through the CSSOM rather than a `style` attribute,
+    // which a strict `style-src` Content Security Policy blocks.
     const rotate = this.nzRotate();
     if (rotate) {
-      this.renderer.setAttribute(svg, 'style', `transform: rotate(${rotate}deg)`);
+      this.renderer.setStyle(svg, 'transform', `rotate(${rotate}deg)`);
     } else {
-      this.renderer.removeAttribute(svg, 'style');
+      this.renderer.removeStyle(svg, 'transform');
     }
   }
 
```

**File**: `components/icon/icon.spec.ts` (modified, +16/-1)
```diff
@@ -3,7 +3,7 @@
  * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
  */
 
-import { Component, DebugElement, NgModule, inject, signal } from '@angular/core';
+import { Component, DebugElement, NgModule, Renderer2, inject, signal } from '@angular/core';
 import { ComponentFixture, TestBed } from '@angular/core/testing';
 import { By } from '@angular/platform-browser';
 
@@ -107,6 +107,21 @@ describe('nz-icon', () => {
       expect(icons[0].nativeElement.firstChild.style.transform).toBeFalsy();
     });
 
+    it('should rotate without writing a style attribute, which strict CSP blocks', async () => {
+      fixture.detectChanges();
+      await updateNonSignalsInput(fixture);
+      fixture.detectChanges();
+      const setAttribute = vi.spyOn(icons[0].injector.get(Renderer2), 'setAttribute');
+
+      testComponent.rotate.set(90);
+      fixture.detectChanges();
+      await updateNonSignalsInput(fixture);
+      fixture.detectChanges();
+
+      expect(icons[0].nativeElement.firstChild.style.transform).toBe('rotate(90deg)');
+      expect(setAttribute).not.toHaveBeenCalledWith(expect.anything(), 'style', expect.anything());
+    });
+
     it('should not throw when firstChild is not an Element', async () => {
       fixture.detectChanges();
       await updateNonSignalsInput(fixture);
```

---

### Incident Patch 3: `5ac745b2` (2026-09-28)
**Commit Message**: fix(module:*): add standalone ngModelOptions to avoid NG01354 (#9986)

**File**: `components/calendar/calendar-header.component.ts` (modified, +3/-0)
```diff
@@ -40,6 +40,7 @@ import { NzSelectModule, NzSelectSizeType } from 'ng-zorro-antd/select';
           [nzSize]="size"
           [nzDropdownMatchSelectWidth]="false"
           [ngModel]="activeYear"
+          [ngModelOptions]="{ standalone: true }"
           (ngModelChange)="updateYear($event)"
         >
           @for (year of years; track year.value) {
@@ -53,6 +54,7 @@ import { NzSelectModule, NzSelectSizeType } from 'ng-zorro-antd/select';
             [nzSize]="size"
             [nzDropdownMatchSelectWidth]="false"
             [ngModel]="activeMonth"
+            [ngModelOptions]="{ standalone: true }"
             (ngModelChange)="monthChange.emit($event)"
           >
             @for (month of months; track month.value) {
@@ -64,6 +66,7 @@ import { NzSelectModule, NzSelectSizeType } from 'ng-zorro-antd/select';
         <nz-radio-group
           class="ant-picker-calendar-mode-switch"
           [(ngModel)]="mode"
+          [ngModelOptions]="{ standalone: true }"
           (ngModelChange)="modeChange.emit($event)"
           [nzSize]="size"
         >
```

**File**: `components/check-list/check-list-content.component.ts` (modified, +3/-1)
```diff
@@ -96,7 +96,9 @@ import { NzItemProps } from './typings';
           <button nz-button (click)="visible.set(true)">{{ i18n.cancel }}</button>
         </div>
         <div class="ant-check-list-close-check-other">
-          <label nz-checkbox [(ngModel)]="checked">{{ i18n.checkListCheckOther }}</label>
+          <label nz-checkbox [(ngModel)]="checked" [ngModelOptions]="{ standalone: true }">{{
+            i18n.checkListCheckOther
+          }}</label>
         </div>
       </div>
     }
```

**File**: `components/checkbox/checkbox.component.ts` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ import { NZ_CHECKBOX_GROUP } from './tokens';
         [attr.name]="nzName || checkboxGroupComponent?.nzName()"
         [checked]="nzChecked"
         [ngModel]="nzChecked"
+        [ngModelOptions]="{ standalone: true }"
         [disabled]="nzDisabled || (checkboxGroupComponent?.finalDisabled() ?? false)"
         (ngModelChange)="innerCheckedChange($event)"
       />
```

**File**: `components/cron-expression/cron-expression-input.component.ts` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ import { CronChangeType, TimeType } from './typings';
       <input
         nz-input
         [(ngModel)]="value"
+        [ngModelOptions]="{ standalone: true }"
         [name]="label"
         [disabled]="disabled"
         (focus)="focusInputEffect($event)"
```

**File**: `components/date-picker/date-picker.component.ts` (modified, +2/-0)
```diff
@@ -116,6 +116,7 @@ export type NzDatePickerSizeType = 'large' | 'default' | 'small';
             [disabled]="nzDisabled"
             [readOnly]="nzInputReadOnly"
             [(ngModel)]="inputValue"
+            [ngModelOptions]="{ standalone: true }"
             placeholder="{{ getPlaceholder() }}"
             [size]="inputSize"
             autocomplete="off"
@@ -163,6 +164,7 @@ export type NzDatePickerSizeType = 'large' | 'default' | 'small';
         (focus)="onFocus($event, partType)"
         (keyup.enter)="onKeyupEnter($event)"
         [(ngModel)]="inputValue[datePickerService.getActiveIndex(partType)]"
+        [ngModelOptions]="{ standalone: true }"
         (ngModelChange)="onInputChange($event)"
         placeholder="{{ getPlaceholder(partType) }}"
       />
```

**File**: `components/date-picker/inner-popup.component.ts` (modified, +1/-0)
```diff
@@ -164,6 +164,7 @@ import { PREFIX_CLASS } from './util';
         <nz-time-picker-panel
           [nzInDatePicker]="true"
           [ngModel]="value?.nativeDate"
+          [ngModelOptions]="{ standalone: true }"
           (ngModelChange)="onSelectTime($event)"
           [format]="$any(timeOptions.nzFormat)"
           [nzHourStep]="$any(timeOptions.nzHourStep)"
```

**File**: `components/pagination/pagination-options.component.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ import { NzSelectModule } from 'ng-zorro-antd/select';
         [nzDisabled]="disabled"
         [nzSize]="nzSize"
         [ngModel]="pageSize"
+        [ngModelOptions]="{ standalone: true }"
         (ngModelChange)="onPageSizeChange($event)"
       >
         @for (option of listOfPageSizeOption; track option.value) {
```

**File**: `components/table/src/addon/filter.component.ts` (modified, +12/-2)
```diff
@@ -61,9 +61,19 @@ interface NzThItemInterface {
             @for (f of listOfParsedFilter; track f.value) {
               <li nz-menu-item [nzSelected]="f.checked" (click)="check(f)">
                 @if (!filterMultiple) {
-                  <label nz-radio [ngModel]="f.checked" (ngModelChange)="check(f)"></label>
+                  <label
+                    nz-radio
+                    [ngModel]="f.checked"
+                    [ngModelOptions]="{ standalone: true }"
+                    (ngModelChange)="check(f)"
+                  ></label>
                 } @else {
-                  <label nz-checkbox [ngModel]="f.checked" (ngModelChange)="check(f)"></label>
+                  <label
+                    nz-checkbox
+                    [ngModel]="f.checked"
+                    [ngModelOptions]="{ standalone: true }"
+                    (ngModelChange)="check(f)"
+                  ></label>
                 }
                 <span>{{ f.text }}</span>
               </li>
```

---

### Incident Patch 4: `9111740e` (2026-09-26)
**Commit Message**: docs: fix stale table/collapse API docs and space compact demo casing (#9989)

* docs(module:table): rename nzHasBackdrop to nzBackdrop in dropdown filter docs

The filter panel's backdrop input is `nzBackdrop`
(components/table/src/addon/filter-trigger.component.ts), but the API
table in both the English and Chinese docs still listed the old
`nzHasBackdrop` name.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* docs(module:collapse): remove nzDisabled row removed from the panel api

`nz-collapse-panel[nzDisabled]` was deprecated in v20 and removed in
v22 (CHANGELOG.md), replaced by `nzCollapsible="disabled"`, which the
docs already list. The API table still documented the removed
`nzDisabled` input.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* docs(module:space): fix addon input casing in compact demo

`nz-input-wrapper` declares `nzAddonBefore`/`nzAddonAfter`
(components/input/input-wrapper.component.ts:198-199), but the compact
demo used `nzAddOnBefore`/`nzAddOnAfter`. Angular template bindings are
case-sensitive, so the addon text never rendered.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `components/collapse/doc/index.en-US.md` (modified, +9/-10)
```diff
@@ -26,13 +26,12 @@ description: A content area which can be collapsed and expanded.
 
 ### nz-collapse-panel
 
-| Property           | Description                                 | Type                               | Default | Global Config | Version |
-| ------------------ | ------------------------------------------- | ---------------------------------- | ------- | ------------- | ------- |
-| `[nzDisabled]`     | If `true`, panel cannot be opened or closed | `boolean`                          | `false` | -             |
-| `[nzHeader]`       | Title of the panel                          | `string \| TemplateRef<void>`      | -       | -             |
-| `[nzExpandedIcon]` | Customize an icon for toggle                | `string \| TemplateRef<void>`      | -       | -             |
-| `[nzExtra]`        | Extra element in the corner                 | `string \| TemplateRef<void>`      | -       | -             |
-| `[nzShowArrow]`    | Display arrow or not                        | `boolean`                          | `true`  | ✅            |
-| `[nzActive]`       | Active status of panel, double binding      | `boolean`                          | -       | -             |
-| `[nzCollapsible]`  | Set collapsible trigger area                | `'header' \| 'icon' \| 'disabled'` | -       | -             | 20.2.0  |
-| `(nzActiveChange)` | Callback function of the active status      | `EventEmitter<boolean>`            | -       | -             |
+| Property           | Description                            | Type                               | Default | Global Config | Version |
+| ------------------ | -------------------------------------- | ---------------------------------- | ------- | ------------- | ------- |
+| `[nzHeader]`       | Title of the panel                     | `string \| TemplateRef<void>`      | -       | -             |
+| `[nzExpandedIcon]` | Customize an icon for toggle           | `string \| TemplateRef<void>`      | -       | -             |
+| `[nzExtra]`        | Extra element in the corner            | `string \| TemplateRef<void>`      | -       | -             |
+| `[nzShowArrow]`    | Display arrow or not                   | `boolean`                          | `true`  | ✅            |
+| `[nzActive]`       | Active status of panel, double binding | `boolean`                          | -       | -             |
+| `[nzCollapsible]`  | Set collapsible trigger area           | `'header' \| 'icon' \| 'disabled'` | -       | -             | 20.2.0  |
+| `(nzActiveChange)` | Callback function of the active status | `EventEmitter<boolean>`            | -       | -             |
```

**File**: `components/collapse/doc/index.zh-CN.md` (modified, +9/-10)
```diff
@@ -27,13 +27,12 @@ description: 可以折叠/展开的内容区域。
 
 ### nz-collapse-panel
 
-| 参数               | 说明                                       | 类型                               | 默认值  | 全局配置 | 版本   |
-| ------------------ | ------------------------------------------ | ---------------------------------- | ------- | -------- | ------ |
-| `[nzDisabled]`     | 禁用后的面板展开与否将无法通过用户交互改变 | `boolean`                          | `false` | -        |
-| `[nzHeader]`       | 面板头内容                                 | `string \| TemplateRef<void>`      | -       | -        |
-| `[nzExpandedIcon]` | 自定义切换图标                             | `string \| TemplateRef<void>`      | -       | -        |
-| `[nzExtra]`        | 自定义渲染每个面板右上角的内容             | `string \| TemplateRef<void>`      | -       | -        |
-| `[nzShowArrow]`    | 是否展示箭头                               | `boolean`                          | `true`  | ✅       |
-| `[nzActive]`       | 面板是否展开，可双向绑定                   | `boolean`                          | -       | -        |
-| `[nzCollapsible]`  | 设置可折叠触发区域                         | `'header' \| 'icon' \| 'disabled'` | -       | -        | 20.2.0 |
-| `(nzActiveChange)` | 面板展开回调                               | `EventEmitter<boolean>`            | -       | -        |
+| 参数               | 说明                           | 类型                               | 默认值 | 全局配置 | 版本   |
+| ------------------ | ------------------------------ | ---------------------------------- | ------ | -------- | ------ |
+| `[nzHeader]`       | 面板头内容                     | `string \| TemplateRef<void>`      | -      | -        |
+| `[nzExpandedIcon]` | 自定义切换图标                 | `string \| TemplateRef<void>`      | -      | -        |
+| `[nzExtra]`        | 自定义渲染每个面板右上角的内容 | `string \| TemplateRef<void>`      | -      | -        |
+| `[nzShowArrow]`    | 是否展示箭头                   | `boolean`                          | `true` | ✅       |
+| `[nzActive]`       | 面板是否展开，可双向绑定       | `boolean`                          | -      | -        |
+| `[nzCollapsible]`  | 设置可折叠触发区域             | `'header' \| 'icon' \| 'disabled'` | -      | -        | 20.2.0 |
+| `(nzActiveChange)` | 面板展开回调                   | `EventEmitter<boolean>`            | -      | -        |
```

**File**: `components/space/demo/compact.ts` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ import { NzTreeSelectModule } from 'ng-zorro-antd/tree-select';
     </nz-space-compact>
     <br />
     <nz-space-compact nzBlock>
-      <nz-input-wrapper nzAddOnBefore="Http://" nzAddOnAfter=".com" [style.width.%]="50">
+      <nz-input-wrapper nzAddonBefore="Http://" nzAddonAfter=".com" [style.width.%]="50">
         <input nz-input placeholder="input here" />
       </nz-input-wrapper>
       <nz-input-number>
```

**File**: `components/table/doc/index.en-US.md` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ Customized filter panel
 | `[nzDropdownMenu]`  | Dropdown menu                                                                                     | `NzDropdownMenuComponent` | -       |
 | `[nzVisible]`       | whether the dropdown menu is visible, double binding                                              | `boolean`                 | -       |
 | `[nzActive]`        | whether the icon status is activated                                                              | `boolean`                 | `false` |
-| `[nzHasBackdrop]`   | Whether or not attach a backdrop.                                                                 | `boolean`                 | `false` |
+| `[nzBackdrop]`      | Whether or not attach a backdrop.                                                                 | `boolean`                 | `false` |
 | `(nzVisibleChange)` | a callback function takes an argument: `nzVisible`, is executed when the visible state is changed | `EventEmitter<boolean>`   | -       |
 
 ### [nz-virtual-scroll]
```

**File**: `components/table/doc/index.zh-CN.md` (modified, +1/-1)
```diff
@@ -230,7 +230,7 @@ Table 组件同时具备了易用性和高度可定制性
 | `[nzDropdownMenu]`  | Dropdown 下拉菜单组件                    | `NzDropdownMenuComponent` | -       |
 | `[nzVisible]`       | 菜单是否显示，可双向绑定                 | `boolean`                 | -       |
 | `[nzActive]`        | 是否激活选中图标效果                     | `boolean`                 | `false` |
-| `[nzHasBackdrop]`   | 是否附带背景板                           | `boolean`                 | `false` |
+| `[nzBackdrop]`      | 是否附带背景板                           | `boolean`                 | `false` |
 | `(nzVisibleChange)` | 菜单显示状态改变时调用，参数为 nzVisible | `EventEmitter<boolean>`   | -       |
 
 ### [nz-virtual-scroll]
```

---

### Incident Patch 5: `fb93d6b6` (2026-09-25)
**Commit Message**: fix(module:modal): ensure mask fade-out animation completes before close (#9967)

* fix(module:modal): missing  mask animation

* fix(module:modal): maks not working at close

* fix(module:modal): test failing

* fix(module:modal): ensure mask fade-out animation completes before close

**File**: `components/modal/modal-container.directive.ts` (modified, +43/-10)
```diff
@@ -86,7 +86,7 @@ export class BaseModalContainerComponent extends BasePortalOutlet {
     onConfigChangeEventForComponent(NZ_CONFIG_MODULE_NAME, () => this.updateMaskClassname());
 
     this.destroyRef.onDestroy(() => {
-      this.setMaskExitAnimationClass(true);
+      this.setMaskExitAnimationClass(this.overlayRef.backdropElement, true);
     });
   }
 
@@ -219,17 +219,16 @@ export class BaseModalContainerComponent extends BasePortalOutlet {
     }
   }
 
-  private setExitAnimationClass(): void {
+  private setExitAnimationClass(backdropElement: HTMLElement | null): void {
     const modalElement = this.modalElementRef.nativeElement;
 
     modalElement.classList.add(ZOOM_CLASS_NAME_MAP.leave);
     modalElement.classList.add(ZOOM_CLASS_NAME_MAP.leaveActive);
 
-    this.setMaskExitAnimationClass();
+    this.setMaskExitAnimationClass(backdropElement);
   }
 
-  private setMaskExitAnimationClass(force: boolean = false): void {
-    const backdropElement = this.overlayRef.backdropElement;
+  private setMaskExitAnimationClass(backdropElement: HTMLElement | null, force: boolean = false): void {
     if (backdropElement) {
       if (this.animationDisabled() || force) {
         // https://github.com/angular/components/issues/18645
@@ -327,23 +326,57 @@ export class BaseModalContainerComponent extends BasePortalOutlet {
     }
   }
 
-  _startLeaveAnimation(): void {
+  _startLeaveAnimation(backdropElement: HTMLElement | null): void {
     this.animationStateChanged.emit('leave-start');
 
     if (this.animationDisabled()) {
       this.restoreFocus();
       this.animationStateChanged.emit('leave-active');
     } else {
-      this.setExitAnimationClass();
+      this.setExitAnimationClass(backdropElement);
       const element = this.modalElementRef.nativeElement;
-      const onAnimationEnd = (): void => {
-        element.removeEventListener('animationend', onAnimationEnd);
+      let pendingAnimations = backdropElement ? 2 : 1;
+      const finish = (): void => {
+        if (--pendingAnimations > 0) {
+          return;
+        }
         this.restoreFocus();
         this.cleanAnimationClass();
         this.animationStateChanged.emit('leave-active');
       };
 
-      element.addEventListener('animationend', onAnimationEnd);
+      const onModalAnimationEnd = (event: AnimationEvent): void => {
+        if (event.target !== element || event.animationName !== 'antZoomOut') {
+          return;
+        }
+        element.removeEventListener('animationend', onModalAnimationEnd);
+        finish();
+      };
+      element.addEventListener('animationend', onModalAnimationEnd);
+
+      if (backdropElement) {
+        const backdropParent = backdropElement.parentNode;
+        const observer = new MutationObserver(() => {
+          if (!backdropElement.isConnected) {
+            finishBackdrop();
+          }
+        });
+        const finishBackdrop = (): void => {
+          backdropElement.removeEventListener('animationend', onBackdropAnimationEnd);
+          observer.disconnect();
+          finish();
+        };
+        const onBackdropAnimationEnd = (event: AnimationEvent): void => {
+          if (event.target !== backdropElement || event.animationName !== 'antFadeOut') {
+            return;
+          }
+          finishBackdrop();
+        };
+        backdropElement.addEventListener('animationend', onBackdropAnimationEnd);
+        if (backdropParent) {
+          observer.observe(backdropParent, { childList: true });
+        }
+      }
     }
   }
 
```

**File**: `components/modal/modal-ref.ts` (modified, +2/-1)
```diff
@@ -132,8 +132,9 @@ export class NzModalRef<T = NzSafeAny, R = NzSafeAny> implements NzModalLegacyAP
     }
     this.result = result;
     this.state = NzModalState.CLOSING;
+    const backdropElement = this.overlayRef.backdropElement;
     this.overlayRef.detachBackdrop();
-    this.containerInstance._startLeaveAnimation();
+    this.containerInstance._startLeaveAnimation(backdropElement);
   }
 
   updateConfig(config: ModalOptions): void {
```

**File**: `components/modal/modal.spec.ts` (modified, +88/-12)
```diff
@@ -62,12 +62,8 @@ describe('modal with animation', () => {
     overlayContainer.ngOnDestroy();
   });
 
-  // mock animationend events
-  function animationDone(element: Element, action: 'enter' | 'leave'): void {
-    dispatchEvent(
-      element,
-      new AnimationEvent('animationend', { animationName: action === 'enter' ? 'antZoomIn' : 'antZoomOut' })
-    );
+  function animationDone(element: Element, animationName: 'antZoomIn' | 'antZoomOut' | 'antFadeOut'): void {
+    dispatchEvent(element, new AnimationEvent('animationend', { animationName }));
   }
 
   it('should apply enter class immediately to prevent flicker', () => {
@@ -97,17 +93,93 @@ describe('modal with animation', () => {
     expect(modalContentElement!.classList).toContain('ant-zoom-enter');
     expect(modalContentElement!.classList).toContain('ant-zoom-enter-active');
 
-    animationDone(modalContentElement!, 'enter');
+    animationDone(modalContentElement!, 'antZoomIn');
     await fixture.whenStable();
 
     const backdropElement = modalRef.getBackdropElement()!;
     modalRef.close();
 
     expect(modalContentElement!.classList).toContain('ant-zoom-leave');
     expect(modalContentElement!.classList).toContain('ant-zoom-leave-active');
+    expect(backdropElement.classList).toContain('ant-fade-leave');
+    expect(backdropElement.classList).toContain('ant-fade-leave-active');
     expect(backdropElement.classList).not.toContain('cdk-overlay-backdrop-showing');
   });
 
+  it('should wait for both the panel and the backdrop animations before disposing on close', async () => {
+    const modalRef = modalService.create({ nzContent: TestWithModalContentComponent });
+    const modalContentElement = overlayContainerElement.querySelector('.ant-modal')!;
+
+    animationDone(modalContentElement, 'antZoomIn');
+    await fixture.whenStable();
+
+    const backdropElement = modalRef.getBackdropElement()!;
+    modalRef.close();
+    const afterClose = vi.fn();
+    modalRef.afterClose.subscribe(afterClose);
+
+    animationDone(backdropElement, 'antFadeOut');
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSING);
+    expect(afterClose).not.toHaveBeenCalled();
+
+    animationDone(modalContentElement, 'antZoomOut');
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSED);
+    expect(afterClose).toHaveBeenCalledOnce();
+    expect(overlayContainerElement.querySelector('nz-modal-container')).toBeNull();
+  });
+
+  it('should close when the backdrop is removed without a fade animation', async () => {
+    const modalRef = modalService.create({
+      nzContent: TestWithModalContentComponent,
+      nzMaskStyle: { animation: 'none' }
+    });
+    const modalContentElement = overlayContainerElement.querySelector('.ant-modal')!;
+
+    animationDone(modalContentElement, 'antZoomIn');
+    await fixture.whenStable();
+
+    const backdropElement = modalRef.getBackdropElement()!;
+    modalRef.close();
+    animationDone(modalContentElement, 'antZoomOut');
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSING);
+
+    dispatchEvent(backdropElement, new Event('transitionend'));
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSED);
+  });
+
+  it('should ignore animationend events bubbling from projected modal content when closing', async () => {
+    const modalRef = modalService.create({ nzContent: TestWithModalContentComponent });
+    const modalContentElement = overlayContainerElement.querySelector('.ant-modal')!;
+
+    animationDone(modalContentElement, 'antZoomIn');
+    await fixture.whenStable();
+
+    const backdropElement = modalRef.getBackdropElement()!;
+    modalRef.close();
+
+    animationDone(modalContentElement, 'antFadeOut');
+    animationDone(backdropElement, 'antZoomOut');
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSING);
+
+    const projectedElement = modalContentElement.querySelector('.modal-content')!;
+    dispatchEvent(
+      projectedElement,
+      new AnimationEvent('animationend', { animationName: 'someChildAnimation', bubbles: true })
+    );
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSING);
+
+    animationDone(modalContentElement, 'antZoomOut');
+    animationDone(backdropElement, 'antFadeOut');
+    await fixture.whenStable();
+    expect(modalRef.getState()).toBe(NzModalState.CLOSED);
+  });
+
   it('should emit when modal opening animation is complete', async () => {
     const modalRef = modalService.create({
       nzContent: TestWithModalContentComponent
@@ -118,7 +190,7 @@ describe('modal with animation', () => {
     expect(spy).not.toHaveBeenCalled();
 
     const modalContentElement = overlayContainerElement.querySelector('.ant-modal');
-    animationDone(modalContentElement!, 'enter');
+    animationDone(modalContentElement!, 'antZoomIn');
 
     await fi
```

**File**: `components/modal/style/index.less` (modified, +2/-0)
```diff
@@ -1,5 +1,6 @@
 @import '../../style/themes/index';
 @import '../../style/mixins/index';
+@import '../../style/core/motion/fade';
 @import '../../style/core/motion/zoom';
 @import './modal';
 @import './confirm';
@@ -8,3 +9,4 @@
 
 // Animations
 .zoom-motion('zoom', antZoom);
+.make-motion(ant-fade, antFade, @animation-duration-slow);
```

---

### Incident Patch 6: `6a44eff4` (2026-09-22)
**Commit Message**: fix(module:input): correct search button border radius (#9972)

**File**: `components/input/style/search-input.less` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@
       .@{search-prefix}-button {
         padding-top: 0;
         padding-bottom: 0;
+        border-start-start-radius: 0;
+        border-end-start-radius: 0;
         border-start-end-radius: @border-radius-base;
         border-end-end-radius: @border-radius-base;
       }
```

---

### Incident Patch 7: `9f42b301` (2026-09-21)
**Commit Message**: fix(module:slider): initialize slider correctly with signal forms (#9961)

**File**: `components/slider/slider.component.ts` (modified, +2/-0)
```diff
@@ -174,6 +174,8 @@ export class NzSliderComponent implements ControlValueAccessor, OnInit, OnChange
 
     if (this.getValue() === null) {
       this.setValue(this.formatValue(null));
+    } else {
+      this.updateTrackAndHandles();
     }
   }
 
```

**File**: `components/slider/slider.spec.ts` (modified, +25/-0)
```diff
@@ -8,6 +8,7 @@ import { OverlayContainer } from '@angular/cdk/overlay';
 import { Component, DebugElement, signal } from '@angular/core';
 import { ComponentFixture, inject, TestBed } from '@angular/core/testing';
 import { AbstractControl, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
+import { form, FormField } from '@angular/forms/signals';
 import { By } from '@angular/platform-browser';
 
 import { vi } from 'vitest';
@@ -887,6 +888,21 @@ describe('slider', () => {
     });
   });
 
+  describe('signal forms (formField)', () => {
+    let fixture: ComponentFixture<NzTestSliderInSignalFormComponent>;
+
+    it('should display the initial value provided via [formField]', () => {
+      fixture = TestBed.createComponent(NzTestSliderInSignalFormComponent);
+      fixture.detectChanges();
+      const slider = fixture.debugElement.query(By.directive(NzSliderComponent)).componentInstance;
+      const handle = fixture.nativeElement.querySelector('.ant-slider-handle') as HTMLElement;
+      expect(slider.value).toBe(1200);
+      expect(slider.handles[0].offset).toBe(100);
+      expect(slider.handles[0].value).toBe(1200);
+      expect(handle.style.left).toBe('100%');
+    });
+  });
+
   describe('support keyboard event', () => {
     let fixture: ComponentFixture<NzTestSliderKeyboardComponent>;
     let testComponent: NzTestSliderKeyboardComponent;
@@ -1138,6 +1154,15 @@ class SliderWithFormControlComponent {
   }
 }
 
+@Component({
+  imports: [FormField, NzSliderModule],
+  template: `<nz-slider [formField]="myForm.width" [nzMin]="500" [nzMax]="1200" />`
+})
+class NzTestSliderInSignalFormComponent {
+  readonly model = signal({ width: 1200 });
+  readonly myForm = form(this.model);
+}
+
 @Component({
   selector: 'nz-test-slider-show-tooltip',
   imports: [FormsModule, NzSliderModule],
```

---

### Incident Patch 8: `cfe390e1` (2026-09-20)
**Commit Message**: fix(module:table): measure column width correctly during modal animations (#9960)

**File**: `components/table/src/table/tr-measure.component.spec.ts` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+/**
+ * Use of this source code is governed by an MIT-style license that can be
+ * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
+ */
+
+import { Component, viewChild } from '@angular/core';
+import { ComponentFixture, TestBed } from '@angular/core/testing';
+import { Subject } from 'rxjs';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { NzResizeObserver } from 'ng-zorro-antd/cdk/resize-observer';
+
+import { NzTrMeasureComponent } from './tr-measure.component';
+
+describe('NzTrMeasureComponent', () => {
+  let fixture: ComponentFixture<TestHostComponent>;
+  let component: TestHostComponent;
+  let resizeEntries$: Subject<ResizeObserverEntry[]>;
+
+  beforeEach(() => {
+    resizeEntries$ = new Subject<ResizeObserverEntry[]>();
+    TestBed.configureTestingModule({
+      providers: [{ provide: NzResizeObserver, useValue: { observe: () => resizeEntries$ } }]
+    });
+    fixture = TestBed.createComponent(TestHostComponent);
+    component = fixture.componentInstance;
+    vi.useFakeTimers();
+    fixture.detectChanges();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it('should measure widths from contentRect rather than getBoundingClientRect', () => {
+    const target = document.createElement('td');
+    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ width: 31 } as DOMRect);
+
+    resizeEntries$.next([{ target, contentRect: { width: 155 } as DOMRectReadOnly } as unknown as ResizeObserverEntry]);
+    vi.advanceTimersByTime(16);
+
+    expect(component.measureComponent().listOfMeasureColumn).toEqual(['col']);
+    expect(component.widths).toEqual([155]);
+  });
+});
+
+@Component({
+  template: `
+    <table>
+      <tbody>
+        <tr nz-table-measure-row [listOfMeasureColumn]="['col']" (listOfAutoWidth)="onAutoWidth($event)"></tr>
+      </tbody>
+    </table>
+  `,
+  imports: [NzTrMeasureComponent]
+})
+class TestHostComponent {
+  readonly measureComponent = viewChild.required(NzTrMeasureComponent);
+  widths: number[] = [];
+
+  onAutoWidth(widths: number[]): void {
+    this.widths = widths;
+  }
+}
```

**File**: `components/table/src/table/tr-measure.component.ts` (modified, +7/-2)
```diff
@@ -18,7 +18,7 @@ import {
   ViewEncapsulation
 } from '@angular/core';
 import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
-import { Observable, combineLatest } from 'rxjs';
+import { combineLatest, Observable } from 'rxjs';
 import { debounceTime, map, startWith, switchMap } from 'rxjs/operators';
 
 import { NzResizeObserver } from 'ng-zorro-antd/cdk/resize-observer';
@@ -54,7 +54,12 @@ export class NzTrMeasureComponent implements AfterViewInit {
               list.toArray().map((item: ElementRef) =>
                 this.nzResizeObserver.observe(item).pipe(
                   map(([entry]) => {
-                    const { width } = entry.target.getBoundingClientRect();
+                    /**
+                     * https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/contentRect
+                     * contentRect measures only the inner content area of an element (excluding padding and borders)
+                     * means it's not impacted by ancestor CSS transforms (e.g. a modal's open animation)
+                     */
+                    const { width } = entry.contentRect;
                     return Math.floor(width);
                   })
                 )
```

---

### Incident Patch 9: `52682e53` (2026-09-20)
**Commit Message**: fix(module:rate): use tabindex 0 instead of 1 on the rate list (#9970)

A positive tabindex moves the rating ahead of every other focusable
element on the page, so the first Tab press skips the content before
it (WCAG 2.4.3, failure F44) and axe reports the tabindex rule.

Use 0 so the list is reached in document order; the disabled state
keeps -1.

**File**: `components/rate/rate.component.ts` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ const NZ_CONFIG_MODULE_NAME: NzConfigKey = 'rate';
       [class]="classMap"
       (keydown)="onKeyDown($event); $event.preventDefault()"
       (mouseleave)="onRateLeave(); $event.stopPropagation()"
-      [tabindex]="nzDisabled ? -1 : 1"
+      [tabindex]="nzDisabled ? -1 : 0"
     >
       @for (star of starArray; track star) {
         <li
```

**File**: `components/rate/rate.spec.ts` (modified, +8/-0)
```diff
@@ -104,6 +104,14 @@ describe('rate', () => {
       expect(testComponent.modelChange).toHaveBeenCalledTimes(0);
     });
 
+    it('should keep the list in the natural tab order', () => {
+      const rateElement = rate.nativeElement.querySelector('ul') as HTMLElement;
+      expect(rateElement.getAttribute('tabindex')).toBe('0');
+      testComponent.disabled.set(true);
+      fixture.detectChanges();
+      expect(rateElement.getAttribute('tabindex')).toBe('-1');
+    });
+
     it('should count work', () => {
       fixture.detectChanges();
       expect(rate.nativeElement.firstElementChild.children.length).toBe(5);
```

---

### Incident Patch 10: `e07388bb` (2026-09-20)
**Commit Message**: fix(module:date-picker): put aria-selected and aria-disabled on gridcell (#9968)

The date table bound aria-selected and aria-disabled to the roleless ant-picker-cell-inner div, so axe reports aria-allowed-attr on every cell of an open panel (42 critical nodes in the date panel) and assistive tech never hears which cell is selected or disabled. Both bindings now sit on the td role="gridcell" that wraps each cell, which covers every panel mode rendered through this table. The calendar shares the template, so its cells announce the same state.

**File**: `components/date-picker/date-picker.component.spec.ts` (modified, +16/-0)
```diff
@@ -436,6 +436,22 @@ describe('NzDatePickerComponent', () => {
       expect(getPickerContainer()).toBeNull();
     });
 
+    it('should put aria-selected and aria-disabled on the gridcell', async () => {
+      fixture.detectChanges();
+      fixtureInstance.nzValue.set(new Date('2018-11-11 12:12:12'));
+      fixtureInstance.nzDisabledDate.set((current: Date) => isSameDay(current, new Date('2018-11-15 00:00:00')));
+      await stabilize(10000);
+      openPickerByClickTrigger();
+      const selectedCell = queryFromOverlay(`td.${PREFIX_CLASS}-cell-selected`);
+      const disabledCell = queryFromOverlay(`td.${PREFIX_CLASS}-cell-disabled`);
+      expect(selectedCell.getAttribute('role')).toBe('gridcell');
+      expect(selectedCell.getAttribute('aria-selected')).toBe('true');
+      expect(disabledCell.getAttribute('role')).toBe('gridcell');
+      expect(disabledCell.getAttribute('aria-disabled')).toBe('true');
+      expect(queryFromOverlay(`.${PREFIX_CLASS}-cell-inner[aria-selected]`)).toBeNull();
+      expect(queryFromOverlay(`.${PREFIX_CLASS}-cell-inner[aria-disabled]`)).toBeNull();
+    });
+
     // #5633
     it('should support disable year and month right', () => {
       fixtureInstance.nzLocale.set({
```

**File**: `components/date-picker/lib/abstract-table.html` (modified, +3/-5)
```diff
@@ -22,6 +22,8 @@
           <td
             [title]="cell.title"
             role="gridcell"
+            [attr.aria-selected]="cell.isSelected"
+            [attr.aria-disabled]="cell.isDisabled"
             [class]="cell.classMap!"
             (click)="cell.isDisabled ? null : cell.onClick()"
             (mouseenter)="cell.onMouseEnter()"
@@ -36,11 +38,7 @@
                     {{ cell.cellRender }}
                   </ng-template>
                 } @else {
-                  <div
-                    class="{{ prefixCls }}-cell-inner"
-                    [attr.aria-selected]="cell.isSelected"
-                    [attr.aria-disabled]="cell.isDisabled"
-                  >
+                  <div class="{{ prefixCls }}-cell-inner">
                     {{ cell.content }}
                   </div>
                 }
```

---

### Incident Patch 11: `6058afa2` (2026-09-20)
**Commit Message**: fix(module:menu): reset submenu state when its overlay detaches (#9966)

Closing a non-inline submenu with Escape detaches its overlay through the CDK,
but the submenu's own state is never reset, so isMouseEnterTitleOrOverlay$ keeps
reporting it as entered. The submenu stays open with nothing on screen and cannot
be reopened, and the parent menu's isChildSubMenuOpen$ stays true, holding an
enclosing dropdown open with no way to close it by Escape, an outside click or
the trigger.

Reset the mouse enter state on detach, beside the existing overlayOutsideClick
handler. It is the setter that reaches the parent, since isChildSubMenuOpen$ is
only written from the subscription that isMouseEnterTitleOrOverlay$ feeds.

**File**: `components/dropdown/dropdown.directive.spec.ts` (modified, +42/-0)
```diff
@@ -174,6 +174,31 @@ describe('dropdown', () => {
     expect(nullBackdrop).toBeNull();
   });
 
+  it('should disappear if Escape pressed after a click triggered submenu is closed', async () => {
+    const fixture = TestBed.createComponent(NzTestDropdownSubmenuComponent);
+    fixture.detectChanges();
+    const dropdownElement = fixture.debugElement.query(By.directive(NzDropdownDirective)).nativeElement;
+
+    dispatchFakeEvent(dropdownElement, 'click');
+    await stabilize(fixture, 1000);
+    expect(overlayContainerElement.querySelector('.ant-dropdown')).not.toBeNull();
+
+    const submenuTitle = overlayContainerElement.querySelector('.ant-dropdown-menu-submenu-title')!;
+    dispatchFakeEvent(submenuTitle, 'click');
+    await stabilize(fixture, 1000);
+    expect(overlayContainerElement.querySelector('.sub-menu-item')).not.toBeNull();
+
+    /** the first Escape detaches the submenu overlay **/
+    dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
+    await stabilize(fixture, 1000);
+    expect(overlayContainerElement.querySelector('.sub-menu-item')).toBeNull();
+
+    /** the second Escape should close the dropdown itself **/
+    dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
+    await stabilize(fixture, 1000);
+    expect(overlayContainerElement.querySelector('.ant-dropdown')).toBeNull();
+  });
+
   it('should nzOverlayClassName and nzOverlayStyle work', async () => {
     const fixture = TestBed.createComponent(NzTestDropdownComponent);
     fixture.detectChanges();
@@ -292,3 +317,20 @@ export class NzTestDropdownArrowComponent {
   readonly arrow = signal(false);
   readonly placement = signal<NzPlacementType>('bottomLeft');
 }
+
+@Component({
+  imports: [NzDropdownModule, NzMenuModule],
+  template: `
+    <a nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click">Trigger</a>
+    <nz-dropdown-menu #menu="nzDropdownMenu">
+      <ul nz-menu>
+        <li nz-submenu nzTitle="Submenu" nzTriggerSubMenuAction="click">
+          <ul>
+            <li nz-menu-item class="sub-menu-item">Sub menu item</li>
+          </ul>
+        </li>
+      </ul>
+    </nz-dropdown-menu>
+  `
+})
+export class NzTestDropdownSubmenuComponent {}
```

**File**: `components/menu/menu.spec.ts` (modified, +25/-1)
```diff
@@ -4,6 +4,7 @@
  */
 
 import { Directionality } from '@angular/cdk/bidi';
+import { ESCAPE } from '@angular/cdk/keycodes';
 import { ConnectedOverlayPositionChange, OverlayContainer } from '@angular/cdk/overlay';
 import { Component, DebugElement, ElementRef, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
 import { ComponentFixture, inject, TestBed } from '@angular/core/testing';
@@ -13,7 +14,12 @@ import { vi } from 'vitest';
 
 import { NzButtonModule } from 'ng-zorro-antd/button';
 import { provideNzNoAnimation } from 'ng-zorro-antd/core/animation';
-import { dispatchFakeEvent, provideMockDirectionality, updateNonSignalsInput } from 'ng-zorro-antd/core/testing';
+import {
+  dispatchFakeEvent,
+  dispatchKeyboardEvent,
+  provideMockDirectionality,
+  updateNonSignalsInput
+} from 'ng-zorro-antd/core/testing';
 import { NzSafeAny } from 'ng-zorro-antd/core/types';
 import { NzIconModule } from 'ng-zorro-antd/icon';
 import { provideNzIconsTesting } from 'ng-zorro-antd/icon/testing';
@@ -343,6 +349,24 @@ describe('menu', () => {
         expect(mouseenterCallback).toHaveBeenCalledTimes(1);
       });
 
+      it('should reopen after the overlay is detached by Escape', async () => {
+        testComponent.nzTriggerSubMenuAction.set('click');
+        fixture.detectChanges();
+        const title = submenu.nativeElement.querySelector('.ant-menu-submenu-title');
+
+        title.click();
+        await stabilize(fixture, 500);
+        expect(testComponent.subs.first.nzOpen).toBe(true);
+
+        dispatchKeyboardEvent(document.body, 'keydown', ESCAPE);
+        await stabilize(fixture, 500);
+        expect(testComponent.subs.first.nzOpen).toBe(false);
+
+        title.click();
+        await stabilize(fixture, 500);
+        expect(testComponent.subs.first.nzOpen).toBe(true);
+      });
+
       it('should submenu mouseleave work', () => {
         fixture.detectChanges();
         const mouseleaveCallback = vi.fn();
```

**File**: `components/menu/submenu.component.ts` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ const listOfHorizontalPositions = [
         [cdkConnectedOverlayOpen]="nzOpen"
         cdkConnectedOverlayTransformOriginOn=".ant-menu-submenu"
         (overlayOutsideClick)="setMouseEnterState(false)"
+        (detach)="setMouseEnterState(false)"
       >
         <div
           nz-submenu-none-inline-child
```

---

### Incident Patch 12: `844ac55b` (2026-09-17)
**Commit Message**: fix(module:select): prevent dropdown option overflow (#9849) (#9957)

**File**: `components/select/style/patch.less` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
   display: block;
   width: 100%;
 
+  .cdk-virtual-scroll-content-wrapper {
+    right: 0;
+  }
+
   .full-width {
     contain: initial;
 
```

---

### Incident Patch 13: `bcf0ee0e` (2026-09-16)
**Commit Message**: fix(module:descriptions): lost data on resizing (#9942)

* revert(module:descriptions): track by item

**File**: `components/descriptions/descriptions.component.ts` (modified, +5/-5)
```diff
@@ -70,7 +70,7 @@ const DEFAULT_COLUMN_NUM = 3;
           @if (nzLayout === 'horizontal') {
             @for (row of itemMatrix; track $index; let i = $index) {
               <tr class="ant-descriptions-row">
-                @for (item of row; track $index; let isLast = $last) {
+                @for (item of row; track item.content; let isLast = $last) {
                   @if (!nzBordered) {
                     <td class="ant-descriptions-item" [colSpan]="item.span">
                       <div class="ant-descriptions-item-container">
@@ -103,7 +103,7 @@ const DEFAULT_COLUMN_NUM = 3;
             @if (!nzBordered) {
               @for (row of itemMatrix; track $index; let i = $index) {
                 <tr class="ant-descriptions-row">
-                  @for (item of row; track $index; let isLast = $last) {
+                  @for (item of row; track item.content; let isLast = $last) {
                     <td class="ant-descriptions-item" [colSpan]="item.span">
                       <div class="ant-descriptions-item-container">
                         <span class="ant-descriptions-item-label" [class.ant-descriptions-item-no-colon]="!nzColon">
@@ -116,7 +116,7 @@ const DEFAULT_COLUMN_NUM = 3;
                   }
                 </tr>
                 <tr class="ant-descriptions-row">
-                  @for (item of row; track $index; let isLast = $last) {
+                  @for (item of row; track item.content; let isLast = $last) {
                     <td class="ant-descriptions-item" [colSpan]="item.span">
                       <div class="ant-descriptions-item-container">
                         <span class="ant-descriptions-item-content">
@@ -130,7 +130,7 @@ const DEFAULT_COLUMN_NUM = 3;
             } @else {
               @for (row of itemMatrix; track $index; let i = $index) {
                 <tr class="ant-descriptions-row">
-                  @for (item of row; track $index; let isLast = $last) {
+                  @for (item of row; track item.content; let isLast = $last) {
                     <td class="ant-descriptions-item-label" [colSpan]="item.span">
                       <ng-container *nzStringTemplateOutlet="item.title">
                         {{ item.title }}
@@ -139,7 +139,7 @@ const DEFAULT_COLUMN_NUM = 3;
                   }
                 </tr>
                 <tr class="ant-descriptions-row">
-                  @for (item of row; track $index; let isLast = $last) {
+                  @for (item of row; track item.content; let isLast = $last) {
                     <td class="ant-descriptions-item-content" [colSpan]="item.span">
                       <ng-template [ngTemplateOutlet]="item.content" />
                     </td>
```

**File**: `components/descriptions/descriptions.spec.ts` (modified, +54/-0)
```diff
@@ -152,6 +152,47 @@ describe('descriptions', () => {
       expect(componentElement.classList).not.toContain('ant-descriptions-rtl');
     });
   });
+
+  // fix #9927
+  describe('resize', () => {
+    let fixture: ComponentFixture<NzTestDescriptionsResponsiveContentComponent>;
+    let componentElement: HTMLElement;
+
+    beforeEach(() => {
+      fixture = TestBed.createComponent(NzTestDescriptionsResponsiveContentComponent);
+      componentElement = fixture.debugElement.nativeElement;
+      fixture.detectChanges();
+    });
+
+    it('should keep item content after resizing down and back up', async () => {
+      const getContents = (): Array<string | undefined> =>
+        Array.from(componentElement.querySelectorAll('.ant-descriptions-item-content')).map(item =>
+          item.textContent?.trim()
+        );
+
+      viewport.set(1200, 1000);
+      window.dispatchEvent(new Event('resize'));
+      fixture.detectChanges();
+      await updateNonSignalsInput(fixture, 1000);
+      fixture.detectChanges();
+
+      viewport.set(320, 600);
+      window.dispatchEvent(new Event('resize'));
+      fixture.detectChanges();
+      await updateNonSignalsInput(fixture, 1000);
+      fixture.detectChanges();
+
+      viewport.set(1200, 1000);
+      window.dispatchEvent(new Event('resize'));
+      fixture.detectChanges();
+      await updateNonSignalsInput(fixture, 1000);
+      fixture.detectChanges();
+
+      viewport.reset();
+
+      expect(getContents()).toEqual(['UserName content', 'Telephone content', 'Live content']);
+    });
+  });
 });
 
 @Component({
@@ -172,3 +213,16 @@ export class NzTestDescriptionsComponent {
   readonly title = signal('Title');
   readonly itemTitle = signal('Item Title ');
 }
+
+@Component({
+  imports: [NzDescriptionsModule],
+  selector: 'nz-test-descriptions-responsive-content',
+  template: `
+    <nz-descriptions>
+      <nz-descriptions-item nzTitle="UserName">UserName content</nz-descriptions-item>
+      <nz-descriptions-item nzTitle="Telephone">Telephone content</nz-descriptions-item>
+      <nz-descriptions-item nzTitle="Live">Live content</nz-descriptions-item>
+    </nz-descriptions>
+  `
+})
+export class NzTestDescriptionsResponsiveContentComponent {}
```

---

### Incident Patch 14: `b3ddf739` (2026-09-16)
**Commit Message**: fix(module:graph): remove units from SVG transforms (#9950)

**File**: `components/graph/graph-node.component.spec.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+/**
+ * Use of this source code is governed by an MIT-style license that can be
+ * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
+ */
+
+import { EventEmitter } from '@angular/core';
+import { ComponentFixture, TestBed } from '@angular/core/testing';
+
+import { vi } from 'vitest';
+
+import { NzGraph } from './graph';
+import { NzGraphNodeComponent } from './graph-node.component';
+import { NzGraphNode } from './interface';
+
+describe('graph node', () => {
+  let fixture: ComponentFixture<NzGraphNodeComponent>;
+  let component: NzGraphNodeComponent;
+  let element: HTMLElement;
+
+  const node = {
+    id: 'node',
+    name: 'node',
+    x: 160,
+    y: 100,
+    width: 120,
+    height: 40,
+    coreBox: { width: 120 }
+  } as NzGraphNode;
+
+  beforeEach(async () => {
+    TestBed.configureTestingModule({
+      providers: [{ provide: NzGraph, useValue: { nzNodeClick: new EventEmitter() } }]
+    });
+
+    fixture = TestBed.createComponent(NzGraphNodeComponent);
+    component = fixture.componentInstance;
+    element = fixture.nativeElement;
+    fixture.componentRef.setInput('node', { ...node });
+    await fixture.whenStable();
+  });
+
+  it('should use unitless coordinates for SVG transforms without animation', () => {
+    component.makeNoAnimation();
+
+    expect(element.getAttribute('transform')).toBe('translate(100, 80)');
+  });
+
+  it('should use CSS pixel values for animation and unitless coordinates for the SVG transform', async () => {
+    await component.makeAnimation();
+
+    expect(element.getAttribute('transform')).toBe('translate(100, 80)');
+
+    const parentAnimation = { onfinish: null } as unknown as Animation;
+    const animate = vi.fn().mockReturnValue(parentAnimation);
+    const group = element.querySelector('g')!;
+    Object.defineProperty(element, 'animate', { configurable: true, value: animate });
+    Object.defineProperty(group, 'animate', { configurable: true, value: vi.fn() });
+
+    component.node = { ...node, x: 220 };
+    const animationFinished = component.makeAnimation();
+
+    expect(animate).toHaveBeenCalledWith(
+      [{ transform: 'translate(100px, 80px)' }, { transform: 'translate(160px, 80px)' }],
+      { duration: 150, easing: 'ease-out', fill: 'forwards' }
+    );
+
+    parentAnimation.onfinish!(new Event('finish') as AnimationPlaybackEvent);
+    await animationFinished;
+
+    expect(element.getAttribute('transform')).toBe('translate(160, 80)');
+  });
+});
```

**File**: `components/graph/graph-node.component.ts` (modified, +7/-5)
```diff
@@ -31,7 +31,9 @@ interface Info {
   height: number;
 }
 
-const translate = (x: number, y: number): string => `translate(${coerceCssPixelValue(x)}, ${coerceCssPixelValue(y)})`;
+const cssTranslate = (x: number, y: number): string =>
+  `translate(${coerceCssPixelValue(x)}, ${coerceCssPixelValue(y)})`;
+const svgTranslate = (x: number, y: number): string => `translate(${x}, ${y})`;
 
 @Component({
   selector: '[nz-graph-node]',
@@ -90,7 +92,7 @@ export class NzGraphNodeComponent implements OnInit {
 
     if (this.initialState) {
       // Initial state: directly set position without animation
-      this.renderer.setAttribute(this.el, 'transform', translate(cur.x, cur.y));
+      this.renderer.setAttribute(this.el, 'transform', svgTranslate(cur.x, cur.y));
       if (group) {
         this.renderer.setStyle(group, 'width', coerceCssPixelValue(cur.width));
         this.renderer.setStyle(group, 'height', coerceCssPixelValue(cur.height));
@@ -101,7 +103,7 @@ export class NzGraphNodeComponent implements OnInit {
       return new Promise(resolve => {
         // Animate parent element (transform)
         const parentAnimation = this.el.animate(
-          [{ transform: translate(pre.x, pre.y) }, { transform: translate(cur.x, cur.y) }],
+          [{ transform: cssTranslate(pre.x, pre.y) }, { transform: cssTranslate(cur.x, cur.y) }],
           {
             duration: 150,
             easing: 'ease-out',
@@ -127,7 +129,7 @@ export class NzGraphNodeComponent implements OnInit {
         // Wait for animations to complete
         parentAnimation.onfinish = () => {
           // Need this for canvas for now.
-          this.renderer.setAttribute(this.el, 'transform', translate(cur.x, cur.y));
+          this.renderer.setAttribute(this.el, 'transform', svgTranslate(cur.x, cur.y));
           if (group) {
             this.renderer.setStyle(group, 'width', coerceCssPixelValue(cur.width));
             this.renderer.setStyle(group, 'height', coerceCssPixelValue(cur.height));
@@ -143,7 +145,7 @@ export class NzGraphNodeComponent implements OnInit {
   makeNoAnimation(): void {
     const cur = this.getAnimationInfo();
     // Need this for canvas for now.
-    this.renderer.setAttribute(this.el, 'transform', translate(cur.x, cur.y));
+    this.renderer.setAttribute(this.el, 'transform', svgTranslate(cur.x, cur.y));
   }
 
   getAnimationInfo(): Info {
```

---

### Incident Patch 15: `eea2bb4f` (2026-09-14)
**Commit Message**: fix(module:colorpicker): preserve hue when reapplying equivalent grayscale values (#9938)

**File**: `components/color-picker/src/ng-antd-color-picker.component.spec.ts` (modified, +22/-0)
```diff
@@ -116,6 +116,28 @@ describe('NgxColorPickerComponent', () => {
     expect(component.complete).toBe('hue');
   });
 
+  it('color-picker slide hue preserves selection for grayscale colors on ngModel round trip (#9929)', () => {
+    component.value.set('#ffffff');
+    fixture.detectChanges();
+    const element = fixture.debugElement.nativeElement.querySelector('.ant-color-picker-slider-hue');
+    const { x, y } = {
+      x: element.offsetLeft + 230,
+      y: element.offsetTop + 4
+    };
+    const event = new MouseEvent('mousedown', { clientX: x, clientY: y });
+    const closeEvent = new MouseEvent('mouseup');
+    element.dispatchEvent(event);
+    element.dispatchEvent(closeEvent);
+    fixture.detectChanges();
+    const emittedHue = component.changeColor!.toHsb().h;
+
+    component.value.set(component.changeColor!.toRgbString());
+    fixture.detectChanges();
+
+    const internalColor = (resultEl.componentInstance as NgAntdColorPickerComponent).colorValue!;
+    expect(internalColor.toHsb().h).toBe(emittedHue);
+  });
+
   it('color-picker slide alpha', () => {
     fixture.detectChanges();
     const element = fixture.debugElement.nativeElement.querySelector('.ant-color-picker-slider-alpha');
```

**File**: `components/color-picker/src/ng-antd-color-picker.component.ts` (modified, +14/-0)
```diff
@@ -130,6 +130,20 @@ export class NgAntdColorPickerComponent implements OnInit, OnChanges {
   ngOnChanges(changes: SimpleChanges): void {
     const { value, defaultValue } = changes;
     if (value || defaultValue) {
+      /**
+       * `value` is an RGBA string, which loses hue/saturation for grayscale colors (e.g. white,black).
+       * If it only echoes back the current `colorValue`'s RGBA (round-tripped through a
+       * controlling ngModel), skip rebuilding `colorValue` so that hue isn't discarded.
+       */
+
+      if (
+        value &&
+        this.colorValue &&
+        this.hasValue(this.value) &&
+        generateColor(this.value).toRgbString() === this.colorValue.toRgbString()
+      ) {
+        return;
+      }
       this.setColorValue(this.value);
     }
   }
```

#### Recent Merged Pull Requests:
- **PR #9990** (2026-09-28): fix(module:icon): set rotate through CSSOM so strict CSP allows it (@costajohnt)
- **PR #9986** (2026-09-28): fix(module:*): add standalone ngModelOptions to avoid NG01354 (@Nicoss54)
- **PR #9983** (2026-09-30): fix(module:image): respect nzKeyboard when closing preview with escape (@mnkprs)
- **PR #9975** (2026-09-22): chore(release): release 22.1.1 (@Laffery)
- **PR #9972** (2026-09-22): fix(module:input): correct search button border radius (@Laffery)
- **PR #9970** (2026-09-20): fix(module:rate): use tabindex 0 instead of 1 on the rate list (@thekhegay)
- **PR #9968** (2026-09-20): fix(module:date-picker): put aria-selected and aria-disabled on gridcell (@thekhegay)
- **PR #9967** (2026-09-25): fix(module:modal): missing  mask animation (@Nicoss54)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
