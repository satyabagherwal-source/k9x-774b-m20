# Forensic Learning Record (Deep Inspection): NG-ZORRO/ng-zorro-antd

> **Canonical Artifact**: `07_PROJECT_LEARNING/ng-zorro-ng-zorro-antd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NG-ZORRO/ng-zorro-antd](https://github.com/NG-ZORRO/ng-zorro-antd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:50.078Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NG-ZORRO/ng-zorro-antd`
- **Description**: Angular UI Component Library based on Ant Design
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9179 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  singleQuote: true,
  useTabs: false,
  printWidth: 120,
  tabWidth: 2,
  semi: true,
  htmlWhitespaceSensitivity: 'strict',
  arrowParens: 'avoid',
  bracketSpacing: true,
  proseWrap: 'preserve',
  trailingComma: 'none',
  endOfLine: 'lf'
};

```

### Core Architecture Module: `commitlint.config.js`
```
'use strict';
const message = process.env['HUSKY_GIT_PARAMS'];
const fs = require('fs');

const types = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'release', 'revert', 'style', 'test'];

const scopes = ['showcase', 'release', 'packaging', 'changelog', 'schematics', 'module:*'];

function parseMessage(message) {
  const PATTERN = /^(\w+)(?:\(([^)]+)\))?\: (.+)$/;
  const match = PATTERN.exec(message);
  if (!match) {
    return null;
  }
  return {
    type: match[1] || null,
    scope: match[2] || null
  };
}

function getScopesRule() {
  const messages = fs.readFileSync(message, { encoding: 'utf-8' });
  const parsed = parseMessage(messages.split('\n')[0]);
  if (!parsed) {
    return [2, 'always', scopes];
  }
  const { scope, type } = parsed;
  if (scope && !scopes.includes(scope) && type !== 'release' && !/module:.+/.test(scope)) {
    return [2, 'always', scopes];
  } else {
    return [2, 'always', []];
  }
}

module.exports = {
  extends: ['@commitlint/config-angular'],
  rules: {
    'type-enum': [2, 'always', types],
    'scope-enum': getScopesRule
  }
};

```

### Core Architecture Module: `components/affix/affix.component.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { Directionality } from '@angular/cdk/bidi';
import { Platform } from '@angular/cdk/platform';
import {
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnChanges,
  output,
  Renderer2,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge, ReplaySubject, Subscription } from 'rxjs';
import { map, throttleTime } from 'rxjs/operators';

import { NzResizeObserver } from 'ng-zorro-antd/cdk/resize-observer';
import { NzConfigKey, WithConfig } from 'ng-zorro-antd/core/config';
import { NzScrollService } from 'ng-zorro-antd/core/services';
import { NgStyleInterface } from 'ng-zorro-antd/core/types';
import { getStyleAsText, numberAttributeWithZeroFallback, shallowEqual } from 'ng-zorro-antd/core/util';

import { AffixRespondEvents } from './respond-events';
import { getTargetRect, SimpleRect } from './utils';

const NZ_CONFIG_MODULE_NAME: NzConfigKey = 'affix';
const NZ_AFFIX_CLS_PREFIX = 'ant-affix';
const NZ_AFFIX_DEFAULT_SCROLL_TIME = 20;
const NOOP_EVENT = {} as Event;

@Component({
  selector: 'nz-affix',
  exportAs: 'nzAffix',
  template: `
    <div #fixedEl>
      <ng-content />
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class NzAffixComponent implements OnChanges {
  private readonly scrollSrv = inject(NzScrollService);
  private readonly ngZone = inject(NgZone);
  private readonly platform = inject(Platform);
  private readonly renderer = inject(Renderer2);
  private readonly nzResizeObserver = inject(NzResizeObserver);
  private readonly dir = inject(Directionality).valueSignal;
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly placeholderNode: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;

  readonly _nzModuleName: NzConfigKey = NZ_CONFIG_MODULE_NAME;

  @ViewChild('fixedEl', { static: true }) private fixedEl!: ElementRef<HTMLDivElement>;

  @Input() nzTarget?: string | Element | Window;

  @Input({ transform: numberAttributeWithZeroFallback })
  @WithConfig()
  nzOffsetTop?: null | number;

  @Input({ transform: numberAttributeWithZeroFallback })
  @WithConfig()
  nzOffsetBottom?: null | number;

  readonly nzChange = output<boolean>();

  private affixStyle?: NgStyleInterface;
  private placeholderStyle?: NgStyleInterface;
  private positionChangeSubscription = Subscription.EMPTY;
  private offsetChanged$ = new ReplaySubject<void>(1);
  private timeout?: ReturnType<typeof setTimeout>;

  private get target(): Element | Window {
    const el = this.nzTarget;
    return (typeof el === 'string' ? this.document.querySelector(el) : el) || window;
  }

  constructor() {
    effect(() => {
      // should update position on dir change
      void this.dir();
      this.registerListeners();
      this.updatePosition(NOOP_EVENT);
    });

    this.destroyRef.onDestroy(() => {
      this.removeListeners();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const { nzOffsetBottom, nzOffsetTop, nzTarget } = changes;

    if (nzOffsetBottom || nzOffsetTop) {
      this.offsetChanged$.next();
    }
    if (nzTarget) {
      this.registerListeners();
    }
  }

  private registerListeners(): void {
    if (!this.platform.isBrowser) {
      return;
    }

    this.removeListeners();
    const el = this.target === window ? this.document.body : (this.target as Element);
    this.positionChangeSubscription = this.ngZone.runOutsideAngular(() =>
      merge(
        ...Object.keys(AffixRespondEvents).map(eventName => fromEvent(this.target, eventName)),
        this.offsetChanged$.pipe(map(() => NOOP_EVENT)),
        this.nzResizeObserver.observe(el)
      )
        .pipe(
          throttleTime(NZ_AFFIX_DEFAULT_SCROLL_TIME, undefined, { trailing: true }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(e => this.updatePosition(e as Event))
    );
    this.timeout = setTimeout(() => this.updatePosition(NOOP_EVENT));
  }

  private removeListeners(): void {
    clearTimeout(this.timeout);
    this.positionChangeSubscription.unsubscribe();
  }

  getOffset(element: Element, target: Element | Window | undefined): SimpleRect {
    const elemRect = element.getBoundingClientRect();
    const targetRect = getTargetRect(target!);

    const scrollTop = this.scrollSrv.getScroll(target, true);
    const scrollLeft = this.scrollSrv.getScroll(target, false);

    const docElem = this.document.body;
    const clientTop = docElem.clientTop || 0;
    const clientLeft = docElem.clientLeft || 0;

    return {
      top: elemRect.top - targetRect.top + scrollTop - clientTop,
      left: elemRect.left - targetRect.left + scrollLeft - clientLeft,
      width: elemRect.width,
      height: elemRect.height
    };
  }

  private setAffixStyle(e: Event, affixStyle?: NgStyleInterface): void {
    const originalAffixStyle = this.affixStyle;
    if (e.type === 'scroll' && originalAffixStyle && affixStyle && this.target === window) {
      return;
    }
    if (shallowEqual(originalAffixStyle, affixStyle)) {
      return;
    }

    const fixed = !!affixStyle;
    const wrapEl = this.fixedEl.nativeElement;
    this.renderer.setStyle(wrapEl, 'cssText', getStyleAsText(affixStyle));
    this.affixStyle = affixStyle;
    if (fixed) {
      wrapEl.classList.add(NZ_AFFIX_CLS_PREFIX);
    } else {
      wrapEl.classList.remove(NZ_AFFIX_CLS_PREFIX);
    }
    if ((affixStyle && !originalAffixStyle) || (!affixStyle && originalAffixStyle)) {
      this.nzChange.emit(fixed);
    }
  }

  private setPlaceholderStyle(placeholderStyle?: NgStyleInterface): void {
    const originalPlaceholderStyle = this.placeholderStyle;
    if (shallowEqual(placeholderStyle, originalPlaceholderStyle)) {
      return;
    }
    this.renderer.setStyle(this.placeholderNode, 'cssText', getStyleAsText(placeholderStyle));
    this.placeholderStyle = placeholderStyle;
  }

  private syncPlaceholderStyle(e: Event): void {
    if (!this.affixStyle) {
      return;
    }
    this.renderer.setStyle(this.placeholderNode, 'cssText', '');
    this.placeholderStyle = undefined;
    const styleObj = {
      width: this.placeholderNode.offsetWidth,
      height: this.fixedEl.nativeElement.offsetHeight
    };
    this.setAffixStyle(e, {
      ...this.affixStyle,
      ...styleObj
    });
    this.setPlaceholderStyle(styleObj);
  }

  updatePosition(e: Event): void {
    if (!this.platform.isBrowser) {
      return;
    }

    const targetNode = this.target;
    let offsetTop = this.nzOffsetTop;
    const scrollTop = this.scrollSrv.getScroll(targetNode, true);
    const elemOffset = this.getOffset(this.placeholderNode, targetNode!);
    const fixedNode = this.fixedEl.nativeElement;
    const elemSize = {
      width: fixedNode.offsetWidth,
      height: fixedNode.offsetHeight
    };
    const offsetMode = {
      top: false,
      bottom: false
    };
    // Default to `offsetTop=0`.
    if (typeof offsetTop !== 'number' && typeof this.nzOffsetBottom !== 'number') {
      offsetMode.top = true;
      offsetTop = 0;
    } else {
      offsetMode.top = typeof offsetTop === 'number';
      offsetMode.bottom = typeof this.nzOffsetBottom === 'number';
    }
    const targetRect = getTargetRect(targetNode);
    const targetInnerHeight = (targetNode as Window).innerHeight || (targetNode as HTMLElement).clientHeight;
    if (scrollTop >= elemOffset.top - (offsetTop as number) && offsetMode.top) {
      const width = elemOffset.width;
      const top = targetRect.top + (offsetTop as number);
      this.setAffixStyle(e, {
        position: 'fixed',
        top,
        left: targetRect.left + elemOffset.left,
        width
      });
      this.setPlaceholderStyle({
      
```

### Core Architecture Module: `components/affix/affix.module.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

import { NgModule } from '@angular/core';

import { NzAffixComponent } from './affix.component';

@NgModule({
  exports: [NzAffixComponent],
  imports: [NzAffixComponent]
})
export class NzAffixModule {}

```

### Core Architecture Module: `components/affix/demo/basic.ts`
```
import { Component } from '@angular/core';

import { NzAffixModule } from 'ng-zorro-antd/affix';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'nz-demo-affix-basic',
  imports: [NzAffixModule, NzButtonModule],
  template: `
    <nz-affix [nzOffsetTop]="offsetTop">
      <button nz-button nzType="primary" (click)="setOffsetTop()">
        <span>Affix top</span>
      </button>
    </nz-affix>
    <br />
    <nz-affix [nzOffsetBottom]="nzOffsetBottom" (click)="setOffsetBottom()">
      <button nz-button nzType="primary">
        <span>Affix bottom</span>
      </button>
    </nz-affix>
  `
})
export class NzDemoAffixBasicComponent {
  offsetTop = 10;
  nzOffsetBottom = 10;

  setOffsetTop(): void {
    this.offsetTop += 10;
  }

  setOffsetBottom(): void {
    this.nzOffsetBottom += 10;
  }
}

```

### Core Architecture Module: `components/affix/demo/on-change.ts`
```
import { Component } from '@angular/core';

import { NzAffixModule } from 'ng-zorro-antd/affix';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'nz-demo-affix-on-change',
  imports: [NzAffixModule, NzButtonModule],
  template: `
    <nz-affix [nzOffsetTop]="120" (nzChange)="onChange($event)">
      <button nz-button>
        <span>120px to affix top</span>
      </button>
    </nz-affix>
  `
})
export class NzDemoAffixOnChangeComponent {
  onChange(status: boolean): void {
    console.log(status);
  }
}

```

### Core Architecture Module: `components/affix/demo/target.ts`
```
import { Component } from '@angular/core';

import { NzAffixModule } from 'ng-zorro-antd/affix';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'nz-demo-affix-target',
  imports: [NzAffixModule, NzButtonModule],
  template: `
    <div class="scrollable-container" #target>
      <div class="background">
        <nz-affix [nzTarget]="target" id="affix-container-target">
          <button nz-button nzType="primary">
            <span>Fixed at the top of container</span>
          </button>
        </nz-affix>
      </div>
    </div>
  `,
  styles: `
    .scrollable-container {
      height: 100px;
      overflow-y: scroll;
    }

    .background {
      padding-top: 60px;
      height: 300px;
      background-image: url(//zos.alipayobjects.com/rmsportal/RmjwQiJorKyobvI.jpg);
    }
  `
})
export class NzDemoAffixTargetComponent {}

```

### Core Architecture Module: `components/affix/index.ts`
```
/**
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/LICENSE
 */

export * from './public-api';

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

- **Issue #9989** (2026-09-26): **docs: fix stale table/collapse API docs and space compact demo casing**
  *Symptoms*: ## PR Checklist Please check if your PR fulfills the following requirements:  - [x] The commit message follows our guidelines: https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/CONTRIBUTING.md#commit - [ ] Tests for the changes have been added (for bug fixes / features) - [x] Docs have been added / updated (for bug fixes / features)   ## PR Type What kind of change does this PR introduce?  <!-- Please check the one that applies to this PR using "x". --> - [ ] Bugfix - [ ] Feature - [ ] Code style update (formatting, local variables) - [ ] Refactoring (no functional changes, no api changes) - [ ] Build related changes - [ ] CI related changes - [x] Documentation content changes - [ ] Application (the showcase website) / infrastructure changes - [ ] Other... Please describe:  ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  Three stale docs/demo entries no longer match the current source:  1. `components/table/doc/index.en-US.md:230` and `index.zh-CN.md:233` document the `nz-filter-trigger`    input as `[nzHasBackdrop]`. That name was renamed to `nzBackdrop` (`CHANGELOG.md:1518`); the    component only declares `nzBackdrop` (`components/table/src/addon/filter-trigger.component.ts:62`:    `@Input({ transform: booleanAttribute }) @WithConfig() nzBackdrop = false;`). 2. `components/collapse/doc/index.en-US.md:31` and `index.zh-CN.md:32` still document    `[nzDisabled]` on `nz-collapse-panel`. I
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/pull/9989?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.04%. Comparing base ([`fb93d6b`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/fb93d6b6fca3349f28bff5d85946e5dc5686be4e?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)) to head ([`32a2c0a`](https://app.codecov.io/gh/NG-ZORRO/ng-zorro-antd/commit/32a2c0ad9044a34c391a6ed7d936149632ad111f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=NG-ZORRO)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff        

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
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

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

---

### Incident Patch 4: `9111740e` (2026-09-26)
**Commit Message**: docs: fix stale table/collapse API docs and space compact demo casing (#9989)

* docs(module:table): rename nzHasBackdrop to nzBackdrop in dropdown filter docs

The filter panel's backdrop input is `nzBackdrop`
(components/table/src/addon/filter-trigger.component.ts), but the API
table in both the English and Chinese docs still listed the old
`nzHasBackdrop` name.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* docs(module:collapse): remove nzDisabled row removed from the panel api

`nz-collapse-panel[nzDisabled]` was deprecated in v20 and removed in
v22 (CHANGELOG.md), replaced by `nzCollapsible="disabled"`, which the
docs already list. The API table still documented the removed
`nzDisabled` input.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

* docs(module:space): fix addon input casing in compact demo

`nz-input-wrapper` declares `nzAddonBefore`/`nzAddonAfter`
(components/input/input-wrapper.component.ts:198-199), but the compact
demo used `nzAddOnBefore`/`nzAddOnAfter`. Angular template bindings are
case-sensitive, so the addon text never rendered.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 5 <norep

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
+    const project
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

#### Recent Merged Pull Requests:
- **PR #9990** (2026-09-28): fix(module:icon): set rotate through CSSOM so strict CSP allows it (@costajohnt)
- **PR #9989** (2026-09-26): docs: fix stale table/collapse API docs and space compact demo casing (@ZainnQureshii)
- **PR #9986** (2026-09-28): fix(module:*): add standalone ngModelOptions to avoid NG01354 (@Nicoss54)
- **PR #9983** (2026-09-30): fix(module:image): respect nzKeyboard when closing preview with escape (@mnkprs)
- **PR #9975** (2026-09-22): chore(release): release 22.1.1 (@Laffery)
- **PR #9972** (2026-09-22): fix(module:input): correct search button border radius (@Laffery)
- **PR #9970** (2026-09-20): fix(module:rate): use tabindex 0 instead of 1 on the rate list (@thekhegay)
- **PR #9968** (2026-09-20): fix(module:date-picker): put aria-selected and aria-disabled on gridcell (@thekhegay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
