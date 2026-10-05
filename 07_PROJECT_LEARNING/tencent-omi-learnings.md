# Forensic Learning Record (Deep Inspection): Tencent/omi

> **Canonical Artifact**: `07_PROJECT_LEARNING/tencent-omi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Tencent/omi](https://github.com/Tencent/omi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:14.495Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent/omi`
- **Description**: Web Components Framework - Web组件框架
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13273 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/omi-elements/src/demo/pages/components/button-group/examples/ButtonGroupActiveState.tsx`
```
import { tag, Component, bind } from 'omi'
import { Collapse, Ripple } from 'omi-elements'
import { tailwind } from '@/tailwind'

@tag('button-group-active-state')
export default class ButtonGroupActiveState extends Component {
  static css = [tailwind]

  render() {
    return (
      <div className="flex items-center justify-center">
        <div
          className="inline-flex rounded-md shadow-[0_4px_9px_-4px_#3b71ca] transition duration-150 ease-in-out hover:bg-primary-600 hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)] focus:bg-primary-600 focus:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)] focus:outline-none focus:ring-0 active:bg-primary-700 active:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)] dark:shadow-[0_4px_9px_-4px_rgba(59,113,202,0.5)] dark:hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.2),0_4px_18px_0_rgba(59,113,202,0.1)] dark:focus:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.2),0_4px_18px_0_rgba(59,113,202,0.1)] dark:active:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.2),0_4px_18px_0_rgba(59,113,202,0.1)]"
          role="group"
        >
          <Ripple.tagName class="inline-flex" rippleColor="light">
            <button
              type="button"
              className="inline-block rounded-l bg-primary-700 px-6 pb-2 pt-2.5 text-xs font-medium uppercase leading-normal text-white transition duration-150 ease-in-out hover:bg-primary-600 focus:bg-primary-600 focus:outline-none focus:ring-0 active:bg-primary-700"
            >
              Left
            </button>
          </Ripple.tagName>
          <Ripple.tagName class="inline-flex" rippleColor="light">
            <button
              type="button"
              className="inline-block bg-primary px-6 pb-2 pt-2.5 text-xs font-medium uppercase leading-normal text-white transition duration-150 ease-in-out hover:bg-primary-600 focus:bg-primary-600 focus:outline-none focus:ring-0 active:bg-primary-700"
            >
              Middle
            </button>
          </Ripple.tagName>
          <Ripple.tagName class="inline-flex" rippleColor="light">
            <button
              type="button"
              className="inline-block rounded-r bg-primary px-6 pb-2 pt-2.5 text-xs font-medium uppercase leading-normal text-white transition duration-150 ease-in-out hover:bg-primary-600 focus:bg-primary-600 focus:outline-none focus:ring-0 active:bg-primary-700"
            >
              Right
            </button>
          </Ripple.tagName>
        </div>
      </div>
    )
  }
}

```

### Core Architecture Module: `packages/omi-router/examples/advanced/state.ts`
```
import { signal, mixin } from 'omi'

export const userProfile = signal({})

export const userPosts = signal([])

mixin({
  userProfile,
  userPosts,
})

```

### Core Architecture Module: `packages/omi-templates/src/components/omiu/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `packages/omi/hooks/formAssociated.d.ts`
```
/**
 *
 * 为组件添加表单关联功能
 *
 * 即当表单元素内部包含组件时，组件可以与表单元素进行交互
 *
 *
 *
 *
 *
 */
import { FormAssociatedComponent } from '../component'
declare const _default: {
  define: (cls: typeof FormAssociatedComponent) => void
  initial: (self: FormAssociatedComponent) => void
  connected: (self: FormAssociatedComponent) => void
}
export default _default

```

### Core Architecture Module: `packages/omi/hooks/forwardRef.d.ts`
```
/**
 *
 * 为组件添加ref自动转发功能
 *
 * ref自动转发的目的是为了让组件的使用者可以直接通过组件实例获取到内部元素的引用，
 * 特别是组件多层嵌套时，可以通过ref获取到任意层级的组件实例，而不需要层层传递ref
 *
 *
 * 工作原理:
 *
 * 1. 为组件定义一个ref prop，这是约定的名称
 * 2. 在组件实例可以通过this.ref获取到ref对象，可以将this.ref绑定到任意内部元素上
 * 3.
 *
 *
 *
 *
 */
import { type Component } from '../component'
declare const _default: {
  /**
   * 为组件实例动态添加ref属性
   * @param self
   */
  initial: (self: Component) => void
  disconnected: (self: Component) => void
}
export default _default

```

### Core Architecture Module: `packages/omi/src/hooks/formAssociated.ts`
```
/**
 *
 * 为组件添加表单关联功能
 *
 * 即当表单元素内部包含组件时，组件可以与表单元素进行交互
 *
 *
 *
 *
 *
 */

import { FormAssociatedComponent } from '../component'

export default {
  define: (cls: typeof FormAssociatedComponent) => {
    cls.prototype.formAssociatedCallback = function (form) {
      this._form = form
      if (this._form) {
        // 当组件被添加到表单元素内部时，监听 formdata 事件
        this._form.addEventListener('formdata', this.handleFormData.bind(this))
      }
    }
    // cls.prototype.formDisabledCallback = function() {
    // 	//  禁用 input 元素
    // }
    // cls.prototype.formResetCallback = function() {
    // 	this._internals?.setFormValue('')
    // }
    // cls.prototype.formStateRestoreCallback = function(state:any, mode:any) {
    // 	//  根据 state 和 mode 恢复表单元素状态
    // }
  },
  initial: (self: FormAssociatedComponent) => {
    // 返回表单元素的值，格式为 [name, value]
    if (!self.getFieldValue) {
      self.getFieldValue = function () {
        const values: Record<string, any> = {}
        self._inputs = self.shadowRoot?.querySelectorAll(
          'input',
        ) as unknown as HTMLInputElement[]
        self._inputs.forEach((input) => {
          values[input.name] = input.value
        })
        return values
      }
    }
    if (!self.resetFieldValue) {
      self.resetFieldValue = function () {
        self._inputs = self.shadowRoot?.querySelectorAll(
          'input',
        ) as unknown as HTMLInputElement[]
        self._inputs.forEach((input) => {
          input.value = ''
        })
      }
    }
    if (!self.handleFormData) {
      self.handleFormData = function ({ formData }) {
        if (formData) {
          const values = self.getFieldValue()
          Object.entries(values).forEach(([name, value]) => {
            formData.append(name, value)
          })
        }
      }
    }
    self._internals = self.attachInternals()
  },
  connected: (self: FormAssociatedComponent) => {},
}

```

### Core Architecture Module: `packages/omi/src/hooks/forwardRef.ts`
```
/**
 *
 * 为组件添加ref自动转发功能
 *
 * ref自动转发的目的是为了让组件的使用者可以直接通过组件实例获取到内部元素的引用，
 * 特别是组件多层嵌套时，可以通过ref获取到任意层级的组件实例，而不需要层层传递ref
 *
 *
 * 工作原理:
 *
 * 1. 为组件定义一个ref prop，这是约定的名称
 * 2. 在组件实例可以通过this.ref获取到ref对象，可以将this.ref绑定到任意内部元素上
 * 3.
 *
 *
 *
 *
 */

import { type Component, type Ref } from '../component'

export default {
  /**
   * 为组件实例动态添加ref属性
   * @param self
   */
  initial: (self: Component) => {
    // 声明ref属性，该属性是一个proxy对象，当set时会在当前组件触发refAttach事件

    Object.defineProperty(self, 'ref', {
      get() {
        if (!self._ref) {
          self._ref = new Proxy<Ref>(
            {
              current: undefined,
            },
            {
              set(target, key, value, receiver) {
                if (key === 'current') {
                  self.fire(
                    'refAttached',
                    {
                      ref: value,
                      target: self,
                    },
                    { bubbles: true, composed: true },
                  )
                }
                return Reflect.set(target, key, value, receiver)
              },
            },
          )
        }
        return self._ref
      },
    })
    // @ts-ignore
    self._onRefAttached = function (e: any) {
      const { ref, target } = e.detail
      if (target !== self) {
        // @ts-ignore
        if (self.props.ref) self.props.ref.current = ref
      }
    }
    // @ts-ignore
    self.addEventListener('refAttached', self._onRefAttached)
  },
  disconnected: (self: Component) => {
    // @ts-ignore
    self.removeEventListener('refAttached', self._onRefAttached)
  },
}

```

### Core Architecture Module: `packages/omi/src/render.ts`
```
import { diff } from './diff'
import { ExtendedElement } from './dom'
import { VNode } from './vdom'

export function render(
  vnode: unknown,
  parent: Element | null | string,
  store?: unknown,
) {
  parent = typeof parent === 'string' ? document.querySelector(parent) : parent
  if (store && parent) {
    ;(parent as ExtendedElement).store = store
  }
  return diff(null, vnode as VNode, parent as ExtendedElement, null, false)
}

```

### Core Architecture Module: `packages/omi/src/utils.ts`
```
import { ExtendedElement } from './dom'
import { ObjectVNode, VNode, Attributes } from './vdom'
import './construct-style-sheets-polyfill'
import { ComponentHookType, ComponentHooks } from './component'

/**
 * Check if the environment has native custom elements support
 * and apply a shim for the HTMLElement constructor if needed.
 */
;(function () {
  const w = typeof window !== 'undefined' ? window : (global as any)
  if (
    w.Reflect === undefined ||
    w.customElements === undefined ||
    w.customElements.hasOwnProperty('polyfillWrapFlushCallback')
  ) {
    return
  }
  const BuiltInHTMLElement = w.HTMLElement
  w.HTMLElement = function HTMLElement() {
    return Reflect.construct(BuiltInHTMLElement, [], this.constructor)
  }
  HTMLElement.prototype = BuiltInHTMLElement.prototype
  HTMLElement.prototype.constructor = HTMLElement
  Object.setPrototypeOf(HTMLElement, BuiltInHTMLElement)
})()

/**
 * Convert a kebab-case string to camelCase.
 * @param str - The kebab-case string to convert.
 * @returns The camelCase version of the input string.
 */
export function camelCase(str: string): string {
  return str.replace(/-(\w)/g, (_, $1) => $1.toUpperCase())
}

/**
 * A functional component that renders its children.
 * @param props - The component's props.
 * @returns The component's children.
 */
export function Fragment(props: { children: any }): any {
  return props.children
}

/**
 * Invoke or update a ref, depending on whether it is a function or object ref.
 * @param ref - The ref to apply.
 * @param value - The value to set or pass to the ref.
 */
export function applyRef(
  ref: ((value: any) => void) | { current: any } | null,
  value: any,
): void {
  if (ref != null) {
    if (typeof ref == 'function') ref(value)
    else ref.current = value
  }
}

/**
 * Check if the given object is an array.
 * @param obj - The object to check.
 * @returns True if the object is an array, false otherwise.
 */
export function isArray(obj: unknown): boolean {
  return Object.prototype.toString.call(obj) === '[object Array]'
}

const hyphenateRE = /\B([A-Z])/g

/**
 * Convert a camelCase string to kebab-case.
 * @param str - The camelCase string to convert.
 * @returns The kebab-case version of the input string.
 */
export function hyphenate(str: string): string {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
}

/**
 * Capitalize the first letter of each word in a kebab-case string.
 * @param name - The kebab-case string to capitalize.
 * @returns The capitalized version of the input string.
 */
export function capitalize(name: string): string {
  return name
    .replace(/\-(\w)/g, (_, letter) => letter.toUpperCase())
    .replace(/^\S/, (s) => s.toUpperCase())
}

/**
 * Create a new CSSStyleSheet with the given style.
 * @param style - The CSS style to apply to the new stylesheet.
 * @returns The created CSSStyleSheet.
 */
export function createStyleSheet(style: string): CSSStyleSheet {
  const styleSheet = new CSSStyleSheet()
  styleSheet.replaceSync(style)
  return styleSheet
}

/**
 * Check if two nodes are equivalent.
 * @param node - The DOM Node to compare.
 * @param vnode - The virtual DOM node to compare.
 * @param hydrating - If true, ignores component constructors when comparing.
 * @returns True if the nodes are equivalent, false otherwise.
 */
export function isSameNodeType(node: ExtendedElement, vnode: VNode): boolean {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return node.splitText !== undefined
  }

  return isNamedNode(node, (vnode as ObjectVNode).nodeName as string)
}

/**
 * Check if an Element has a given nodeName, case-insensitively.
 * @param node - The DOM Element to inspect the name of.
 * @param nodeName - The unnormalized name to compare against.
 * @returns True if the element has the given nodeName, false otherwise.
 */
export function isNamedNode(node: ExtendedElement, nodeName: string): boolean {
  return (
    node.normalizedNodeName === nodeName ||
    node.nodeName.toLowerCase() === nodeName.toLowerCase()
  )
}

export function createRef() {
  return {}
}

export function bind(
  target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  return {
    configurable: true,
    get() {
      const bound = descriptor.value.bind(this)
      Object.defineProperty(this, propertyKey, {
        value: bound,
        configurable: true,
        writable: true,
      })
      return bound
    },
  }
}

export function isObject(item: any) {
  return typeof item === 'object' && !Array.isArray(item) && item !== null
}
// 判断对象是否是一个类
export function isClass(cls: any): boolean {
  let result = false
  if (typeof cls === 'function' && cls.prototype) {
    try {
      cls.arguments && cls.caller
    } catch (e) {
      result = true
    }
  }
  // 尝试通过正则表达式检查函数字符串形式的开头是否符合类定义的特征
  const classRegex = /^class\s/
  if (classRegex.test(cls.toString())) {
    return true
  }
  return result
}

export interface GetClassStaticValueOptions {
  merge?: 'none' | 'merge' | 'uniqueMerge' // 指定合并策略
  default?: any // 当不存在时提供一个默认值
}
/**
 *
 * 获取继承链上指定字段的值
 * 获取类的静态变量值，会沿继承链向上查找，并能自动合并数组和{}值
 *
 * calss A{
 *     static settings={a:1}
 * }
 * calss A1 extends A{
 *     static settings={b:2}
 * }
 *
 * getStaticFieldValue(new A1(),"settings") ==== {a:1,b:2}
 *
 * @param instanceOrClass
 * @param fieldName
 * @param options
 */
export function getClassStaticValue(
  instanceOrClass: object,
  fieldName: string,
  options?: GetClassStaticValueOptions,
) {
  const opts = Object.assign(
    {
      // 是否进行合并,0-代表不合并，也就是不会从原型链中读取，1-使用Object.assign合并,2-使用mergeDeepRigth合并
      // 对数组,0-不合并，1-合并数组,   2-合并且删除重复项
      merge: 'uniqueMerge',
      default: null, // 提供默认值，如果{}和[]，会使用上述的合并策略
    },
    options,
  ) as Required<GetClassStaticValueOptions>

  let proto = isClass(instanceOrClass)
    ? instanceOrClass
    : instanceOrClass.constructor
  let fieldValue = (proto as any)[fieldName]
  // 0-{}, 1-[], 2-其他类型
  let valueType = isObject(fieldValue) ? 0 : Array.isArray(fieldValue) ? 1 : 2
  // 如果不是数组或者{}，则不需要在继承链上进行合并
  if (opts.merge === 'none' || valueType === 2) {
    return fieldValue
  }

  const defaultValue =
    valueType === 0 ? Object.assign({}, opts.default) : opts.default

  let values = [fieldValue]

  // 依次读取继承链上的所有同名的字段值
  while (proto) {
    proto = (proto as any).__proto__
    if ((proto as any)[fieldName]) {
      values.push((proto as any)[fieldName])
    } else {
      break
    }
  }
  // 进行合并
  let mergedResult = fieldValue
  if (valueType === 0) {
    // Object
    mergedResult = values.reduce((result, item) => {
      if (isObject(item)) {
        // 只能合并字典
        return opts.merge === 'merge'
          ? Object.assign({}, defaultValue, item, result)
          : Object.assign({}, defaultValue, item, result)
      } else {
        return result
      }
    }, {})
  } else {
    // 数组
    mergedResult = values.reduce((result, item) => {
      if (Array.isArray(item)) {
        // 只能合并数组
        result.push(...item)
      }
      return result
    }, [])
  }
  // 删除数组中的重复项
  if (Array.isArray(mergedResult) && opts.merge === 'uniqueMerge') {
    mergedResult = Array.from(new Set(mergedResult))
    // 如果提供defaultValue并且数组成员是一个{},则进行合并
    if (isObject(defaultValue)) {
      mergedResult.forEach((value: any, index: number) => {
        if (isObject(value)) {
          mergedResult[index] = Object.assign({}, defaultValue, value)
        }
      })
    }
  }
  return mergedResult || defaultValue
}

export function installHook(target: any, hooks: ComponentHooks) {
  if (!target.hooks) {
    target.hooks = {}
  }
  Object.entries(hooks).forEach(([key, hook]) => {
    if (!target.hooks[key]) target.hooks[key] = []
    target.hooks[key].push(hook)
  })
}

/**
 * 执行指定名称的钩子函数
 * @param target  可以是组件实例或者组件类
 */
export function executeComponentHooks(
  target: any,
  hookName: ComponentHookType,
) {
  const hookRegistry = target._hooks
    ? target._hooks
    : getClassStaticValue(target, 'hooks') || {}
  if (!isClass(target)) target._hooks = hookRegistry
  if (hookName in hookRegistry) {
    const hooks = hookRegistry[hookName]
    if (Array.isArray(hooks)) {
      hooks.forEach((hook) => {
        try {
          hook.call(target, target)
        } catch (e: any) {
          console.warn(
            `Error occurred while executing hook function ${
              isClass(target) ? target.constructor.name : target.name
            }/${hookName}:`,
            e,
          )
        }
      })
    }
  }
}

// WeakMap to cache VNodes for DOM nodes
const nodeToVNodeCache = new WeakMap<Node, VNode | string>()

/**
 * 将DOM NodeList转换为Omi VNode，带缓存优化
 * @param childNodes DOM NodeList
 * @returns Omi VNode[]
 */
export function convertNodeListToVNodes(
  childNodes: NodeList,
): Array<VNode | string> {
  return Array.from(childNodes)
    .map((node): VNode | string => {
      const cached = nodeToVNodeCache.get(node)
      if (cached) return cached

      // 处理文本节点
      if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.textContent || ''
        nodeToVNodeCache.set(node, textContent)
        return textContent
      }

      const element = node as Element
      // 处理元素节点
      if (element.nodeType === Node.ELEMENT_NODE) {
        const attributes: Attributes = {
          ignoreAttrs: false,
        }

        // 转换元素属性
        Array.from(element.attributes).forEach((attr) => {
          attributes[camelCase(attr.name)] = attr.value
        })

        // 递归处理子节点
        const children = convertNodeListToVNodes(element.childNodes)
        const vnode = {
          nodeName: element.tagName.toLowerCase(),
          attributes,
          children,
          key: attributes.key,
        }

        nodeToVNodeCache.set(element, vnode)
        return vnode
      }
      // 其他类型节点（注释等）返回 null
      return null as any
    })
    .filter(Boolean) // 过滤掉 null 值
}

```

### Core Architecture Module: `packages/omiu/public/pdf.worker.js`
```
/**
 * @licstart The following is the entire license notice for the
 * JavaScript code in this page
 *
 * Copyright 2023 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @licend The above is the entire license notice for the
 * JavaScript code in this page
 */

(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("pdfjs-dist/build/pdf.worker", [], factory);
	else if(typeof exports === 'object')
		exports["pdfjs-dist/build/pdf.worker"] = factory();
	else
		root["pdfjs-dist/build/pdf.worker"] = root.pdfjsWorker = factory();
})(globalThis, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.WorkerTask = exports.WorkerMessageHandler = void 0;
var _util = __w_pdfjs_require__(2);
var _core_utils = __w_pdfjs_require__(3);
var _primitives = __w_pdfjs_require__(4);
var _pdf_manager = __w_pdfjs_require__(6);
var _cleanup_helper = __w_pdfjs_require__(71);
var _writer = __w_pdfjs_require__(65);
var _is_node = __w_pdfjs_require__(102);
var _message_handler = __w_pdfjs_require__(103);
var _worker_stream = __w_pdfjs_require__(104);
class WorkerTask {
  constructor(name) {
    this.name = name;
    this.terminated = false;
    this._capability = new _util.PromiseCapability();
  }
  get finished() {
    return this._capability.promise;
  }
  finish() {
    this._capability.resolve();
  }
  terminate() {
    this.terminated = true;
  }
  ensureNotTerminated() {
    if (this.terminated) {
      throw new Error("Worker task was terminated");
    }
  }
}
exports.WorkerTask = WorkerTask;
class WorkerMessageHandler {
  static setup(handler, port) {
    let testMessageProcessed = false;
    handler.on("test", function (data) {
      if (testMessageProcessed) {
        return;
      }
      testMessageProcessed = true;
      handler.send("test", data instanceof Uint8Array);
    });
    handler.on("configure", function (data) {
      (0, _util.setVerbosityLevel)(data.verbosity);
    });
    handler.on("GetDocRequest", function (data) {
      return WorkerMessageHandler.createDocumentHandler(data, port);
    });
  }
  static createDocumentHandler(docParams, port) {
    let pdfManager;
    let terminated = false;
    let cancelXHRs = null;
    const WorkerTasks = new Set();
    const verbosity = (0, _util.getVerbosityLevel)();
    const {
      docId,
      apiVersion
    } = docParams;
    const workerVersion = '3.6.172';
    if (apiVersion !== workerVersion) {
      throw new Error(`The API version "${apiVersion}" does not match ` + `the Worker version "${workerVersion}".`);
    }
    const enumerableProperties = [];
    for (const property in []) {
      enumerableProperties.push(property);
    }
    if (enumerableProperties.length) {
      throw new Error("The `Array.prototype` contains unexpected enumerable properties: " + enumerableProperties.join(", ") + "; thus breaking e.g. `for...in` iteration of `Array`s.");
    }
    if (_is_node.isNodeJS && typeof Path2D === "undefined" || typeof ReadableStream === "undefined") {
      const partialMsg = "The browser/environment lacks native support for critical " + "functionality used by the PDF.js library " + "(e.g. `Path2D` and/or `ReadableStream`); ";
      if (_is_node.isNodeJS) {
        throw new Error(partialMsg + "please use a `legacy`-build instead.");
      }
      throw new Error(partialMsg + "please update to a supported browser.");
    }
    const workerHandlerName = docId + "_worker";
    let handler = new _message_handler.MessageHandler(workerHandlerName, docId, port);
    function ensureNotTerminated() {
      if (terminated) {
        throw new Error("Worker was terminated");
      }
    }
    function startWorkerTask(task) {
      WorkerTasks.add(task);
    }
    function finishWorkerTask(task) {
      task.finish();
      WorkerTasks.delete(task);
    }
    async function loadDocument(recoveryMode) {
      await pdfManager.ensureDoc("checkHeader");
      await pdfManager.ensureDoc("parseStartXRef");
      await pdfManager.ensureDoc("parse", [recoveryMode]);
      await pdfManager.ensureDoc("checkFirstPage", [recoveryMode]);
      await pdfManager.ensureDoc("checkLastPage", [recoveryMode]);
      const isPureXfa = await pdfManager.ensureDoc("isPureXfa");
      if (isPureXfa) {
        const task = new WorkerTask("loadXfaFonts");
        startWorkerTask(task);
        await Promise.all([pdfManager.loadXfaFonts(handler, task).catch(reason => {}).then(() => finishWorkerTask(task)), pdfManager.loadXfaImages()]);
      }
      const [numPages, fingerprints] = await Promise.all([pdfManager.ensureDoc("numPages"), pdfManager.ensureDoc("fingerprints")]);
      const htmlForXfa = isPureXfa ? await pdfManager.ensureDoc("htmlForXfa") : null;
      return {
        numPages,
        fingerprints,
        htmlForXfa
      };
    }
    function getPdfManager({
      data,
      password,
      disableAutoFetch,
      rangeChunkSize,
      length,
      docBaseUrl,
      enableXfa,
      evaluatorOptions
    }) {
      const pdfManagerArgs = {
        source: null,
        disableAutoFetch,
        docBaseUrl,
        docId,
        enableXfa,
        evaluatorOptions,
        handler,
        length,
        password,
        rangeChunkSize
      };
      const pdfManagerCapability = new _util.PromiseCapability();
      let newPdfManager;
      if (data) {
        try {
          pdfManagerArgs.source = data;
          newPdfManager = new _pdf_manager.LocalPdfManager(pdfManagerArgs);
          pdfManagerCapability.resolve(newPdfManager);
        } catch (ex) {
          pdfManagerCapability.reject(ex);
        }
        return pdfManagerCapability.promise;
      }
      let pdfStream,
        cachedChunks = [];
      try {
        pdfStream = new _worker_stream.PDFWorkerStream(handler);
      } catch (ex) {
        pdfManagerCapability.reject(ex);
        return pdfManagerCapability.promise;
      }
      const fullRequest = pdfStream.getFullReader();
      fullRequest.headersReady.then(function () {
        if (!fullRequest.isRangeSupported) {
          return;
        }
        pdfManagerArgs.source = pdfStream;
        pdfManagerArgs.length = fullRequest.contentLength;
        pdfManagerArgs.disableAutoFetch ||= fullRequest.isStreamingSupported;
        newPdfManager = new _pdf_manager.NetworkPdfManager(pdfManagerArgs);
        for (const chunk of cachedChunks) {
          newPdfManager.sendProgressiveData(chunk);
        }
        cachedChunks = [];
        pdfManagerCapability.resolve(newPdfManager);
        cancelXHRs = null;
      }).catch(function (reason) {
        pdfManagerCapability.reject(reason);
        cancelXHRs = null;
      });
      let loaded = 0;
      const flushChunks = function () {
        const pdfFile = (0, _core_utils.arrayBuffersToBytes)(cachedChunks);
        if (length && pdfFile.length !== length) {
          (0, _util.warn)("reported HTTP length is different from actual");
        }
        try {
          pdfManagerArgs.source = pdfFile;
          newPdfManager = new _pdf_manager.LocalPdfManager(pdfManagerArgs);
          pdfManagerCapability.resolve(newPdfManager);
        } catch (ex) {
          pdfManagerCapability.reject(ex);
        }
        cachedChunks = [];
      };
      new Promise(function (resolve, reject) {
        const readChunk = function ({
          value,
          done
        }) {
          try {
            ensureNotTerminated();
            if (done) {
              if (!newPdfManager) {
                flushChunks();
              }
              cancelXHRs = null;
              return;
            }
            loaded += value.byteLength;
            if (!fullRequest.isStreamingSupported) {
              handler.send("DocProgress", {
                loaded,
                total: Math.max(loaded, fullRequest.contentLength || 0)
              });
            }
            if (newPdfManager) {
              newPdfManager.sendProgressiveData(value);
            } else {
              cachedChunks.push(value);
            }
            fullRequest.read().then(readChunk, reject);
          } catch (e) {
            reject(e);
          }
        };
        fullRequest.read().then(readChunk, reject);
      }).catch(function (e) {
        pdfManagerCapability.reject(e);
        cancelXHRs = null;
      });
      cancelXHRs = function (reason) {
        pdfStream.cancelAllRequests(reason);
      };
      return pdfManagerCapability.promise;
    }
    function setupDoc(data) {
      function onSuccess(doc) {
        ensureNotTerminated();
        handler.send("GetDoc", {
          pdfInfo: doc
        });
      }
      function onFailure(ex) {
        ensureNotTerminated();
        if (ex instanceof _util.PasswordException) {
          const task = new WorkerTask(`PasswordException: response ${ex.code}`);
          startWorkerTask(task);
          handler.sendWithPromise("PasswordRequest", ex).then(function ({
            password
          }) {
            finishWorkerTask(task);
            pdfManager.updatePassword(password);
            pdfManagerReady();
          }).catch(function () {
            finishWorkerTask(task);
  
```

### Core Architecture Module: `packages/omiu/src/common/markdown-renderer.tsx`
```
import * as MarkdownIt from 'markdown-it'
import mdStyle from './md.css?raw'
import prismStyle from './prism.css?raw'
import { tag, Component } from 'omi'
import { tailwind } from '@/tailwind'

// @ts-ignore
const MdIt = MarkdownIt.default ? MarkdownIt.default : MarkdownIt

@tag('markdown-renderer')
export class MarkdownRenderer extends Component {
  static css = [tailwind, mdStyle, prismStyle]
  md: any

  install() {
    // @ts-ignore
    this.md = new MdIt()
  }

  installed() {
    this.highlight()
  }

  updated() {
    this.highlight()
  }

  highlight() {
    const codes = Array.prototype.slice.call(this.shadowRoot?.querySelectorAll('code'))
    const Prism = window.Prism
    codes.forEach((code) => {
      const arr = code.className.match(/{([\S\s]*)}/)
      let pre = code.parentNode
      // bug!
      arr && pre.setAttribute('data-line', arr[1])

      if (code.className) {
        pre.className = code.className
        const temp = code.className.match(/language-\w*/g)[0]
        const lan = temp.split('-')[1]
        const pl = Prism.languages[lan]
        if (temp && pl) {
          code.innerHTML = Prism.highlight(code.innerText, pl, lan)
        }
      } else {
        pre = code.parentNode
        code.className = 'language-markup'
        pre.className = 'language-markup'
        code.innerHTML = Prism.highlight(code.innerText, Prism.languages.markup, 'markup')
      }
    })

    // fix line-highlight invalid
    window.dispatchEvent(new Event('resize'))
  }

  render(props: { content: string }) {
    return <div unsafeHTML={this.md.render(props.content)} class="mb-48"></div>
  }
}

```

### Core Architecture Module: `packages/omiu/src/common/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1000** (2026-09-24): **fix(omi-vueify): refresh Omi children after Vue slot updates**
  *Symptoms*: ## 背景  当 Vue 中的条件具名 slot 从空变为有内容时，`omi-vueify` 会更新 Web Component 的 light DOM，但 Omi 组件可能仍保留初始化时的 `props.children`。依赖 slot 内容的组件 UI 因此保持旧状态，直到下一次 Omi 更新才显示。  ## 修复  - 在 Vue wrapper 的 `onUpdated` 钩子中等待 DOM patch 完成； - 清除已发布 Omi 版本使用的 `props.children` 缓存，并调用 Omi 的公开 `update()` 方法重新读取 light-DOM children； - 对没有 `update()` 方法的元素保持 no-op； - 增加具名 slot 增加和移除的回归测试。  ## 验证  - `npx jest test/vueify.test.jsx --runInBand --testNamePattern='slots'`：4/4 passed； - `npm run build`（Vite + TypeScript）：通过； - `npx eslint --config ../omi/.eslintrc.cjs --rule 'semi: off' ../omi-vueify/src/index.ts ../omi-vueify/test/vueify.test.jsx`：通过； - `git diff --check`：通过； - 完整 Jest 套件：22 项通过，1 个未修改的既有非 kebab-case 事件断言失败。  Fixes #997  ## AI assistance disclosure  Codex assisted with investigation and test drafting. I reviewed the complete diff and verified the behavior and build locally. 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=1000) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=1000) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent/omi?pullRequest=1000) it.</sub>

- **Issue #999** (2026-08-17): **fix(omi-vueify): 避免复杂属性被深度代理**
  *Symptoms*: ## 背景  `omi-vueify` 当前使用深层 `ref` 保存格式化后的 attrs。Vue 会继续深度代理这个结果对象，导致准备传给 Web Component 的复杂属性再次变成 Proxy；当下游把同一对象放入可冻结状态时，可能触发 ECMAScript Proxy invariant，因此业务侧此前需要额外使用 `markRaw` 或 `shallowRef` 规避。  - Vue 3.5.41 三种形式验证：[StackBlitz 沙盒](https://stackblitz.com/fork/github/RSS1102/omi-vueify-proxy-ab/tree/rss1102/chat-pr-6925-sandbox?file=src%2FApp.vue&startScript=dev) - 下游数据所有权修复：[TDesign Web Components #411](https://github.com/TDesignOteam/tdesign-web-components/pull/411) - Vue Chat 跨仓库验证：[tdesign-vue-next #6925](https://github.com/Tencent/tdesign-vue-next/pull/6925) - 相关问题：[TDesign Web Components #381](https://github.com/TDesignOteam/tdesign-web-components/issues/381)  ## 修复  将 attrs 汇总容器由 `ref` 改为 `shallowRef`：  - 只追踪格式化结果对象的整体替换； - 不再由汇总容器深度代理传给 Web Component 的复杂属性； - 保留现有 deep watch；响应式对象的嵌套更新仍会重新生成并传递结果对象； - 完整保留原有行为：只有属性本身是 `ref` 或 `reactive` 时才执行既有 `deepUnwrap`； - 普通 attrs 对象保持原引用，其内部已有的响应式值也不扫描、不复制，由下游按自身数据所有权处理。  本 PR 不改变 attrs 的公开用法，也不要求下游识别 Vue Proxy。Web Component 如果要把外部对象写入自身可冻结状态，仍应在其真正的数据所有权边界建立内部快照。  ## `markRaw` 兼容性  现有使用 `markRaw` 的代码仍兼容，不需要迁移。本次修复只保证普通复杂对象不会被 attrs 汇总容器二次深度代理；如果调用方本身传入 Proxy，仍会保持原样。对于 TDesign Chat 场景，下游 WebC #411 在消息所有权边界完成隔离，因此组合使用时业务侧不再必须使用 `markRaw`。  ## 测试  - 增加普通复杂对象不会被 attrs 汇总容器转换为 Proxy，且对象与嵌套数组引用保持不变的回归测试； - 增加 top-level reactive 对象沿用既有解包行为、嵌套更新仍会传递的回归测试； - 增加普通 attrs 对象内部已有 Proxy 保持原引用、不由适配器递归复制的回归测试； - `complex data types` 针对性测试 4/4 通过； - `npm run build` 通过； - 完整测试套件仍存在一个与本次改动无关的既有单词事件断言失败，本 PR 为保持范围最小未修改该行为或测试； - Omi 仓库目前没有 pkg.pr.new 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=999) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=999) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent/omi?pullRequest=999) it.</sub>

- **Issue #998** (2026-08-07): **fix: 定义专属命名空间 OmiJSX, 避免全局污染JSX**
  *Symptoms*: <img width="782" height="488" alt="image" src="https://github.com/user-attachments/assets/82bc9dce-38ab-4b9f-84db-4ba9f900cbf8" />  定义专属命名空间 OmiJSX, 避免全局污染JSX
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=998) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=998) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent/omi?pullRequest=998) it.</sub>
  > Related https://github.com/Tencent/tdesign-vue-next/issues/6476

- **Issue #997** (2026-09-24): **omi-vueify包的chatbot组件里slot发生变更时不会触发webc父组件的更新**
  *Symptoms*:  在vue里，slot发生变更时不会触发webc父组件的更新，actionbar就没出来，所以要等到下次webc组件更新时(issue里提的发了条消息)才渲染出来。 https://github.com/Tencent/tdesign-vue-next/issues/6304 修复方案建议：在判断到webc中传入的slot组件发生更新时，触发一次webc组件更新应该就好了
  **Post-Mortem & Fix Analysis**:
  > nice work 👍 grabbed a few ideas from the code for my own project

- **Issue #996** (2026-01-10): **[MVP]feat: 新增 omi-vue2ify 包，支持 Vue 2.7 的胶水层**
  *Symptoms*: ### 概述    新增 omi-vue2ify 包，为 Vue 2.7 项目提供 Omi Web Component 的桥接支持，与现有的 omi-vueify（Vue 3）形成互补。  ### 主要功能    - Props 传递：支持基本类型和对象类型的 props   - 事件监听：支持 kebab-case 风格的事件转发   - Slots：支持默认 slot 和具名 slot   - 方法暴露：通过 methodNames 配置暴露 Web Component 方法    ### 与 Vue 3 版本的差异    | 特性     | omi-vueify (Vue 3)          | omi-vue2ify (Vue 2.7)        |   |----------|-----------------------------|------------------------------|   | 组件定义 | defineComponent + setup     | Options API                  |   | 事件来源 | attrs.onXxx                 | $listeners                   |   | 生命周期 | onMounted / onBeforeUnmount | mounted / beforeDestroy      |   | 方法暴露 | expose()                    | Object.assign(this, methods) |   ###  测试    - 20/21 测试通过   - 1 个失败的测试与 vue 3 版本行为一致 > 这里主要是看 vue3 版本里也有一个，所以就保留了   ### TODO - **稍待验证哈**
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=996) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=996) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent/omi?pullRequest=996) it.</sub>

- **Issue #995** (2025-12-18): **feat: 从 tdesign-react/chatbot-agui 迁移 reactify**
  *Symptoms*: 迁移自 https://github.com/Tencent/tdesign-react/blob/feat/chatbot-agui/packages/pro-components/chat/_util/reactify.tsx
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=995) <br/>All committers have signed the CLA.

- **Issue #994** (2025-09-02): **fix(omi-vueify): event listener**
  *Symptoms*: 修复单词(类似remove，send)事件未正常监听的问题 修复函数类型参数无法传入的问题
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=994) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent/omi?pullRequest=994) before we can accept your contribution.<br/><hr/>**brightzhli** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent/omi?pullRequest=994) it.</sub>

- **Issue #993** (2025-09-02): **
R**
  *Symptoms*: https://chatgpt.com/share/68b4ed1f-dc80-8007-bebb-fd061e08b7b3

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

### Incident Patch 1: `9c8430d8` (2026-09-24)
**Commit Message**: Merge pull request #1000 from dvd233/codex/fix-vueify-slot-update-997

fix(omi-vueify): refresh Omi children after Vue slot updates

**File**: `packages/omi-vueify/src/index.ts` (modified, +14/-1)
```diff
@@ -1,4 +1,4 @@
-import { h, defineComponent, ref, onMounted, onBeforeUnmount, watch, isRef, isReactive, toRaw } from 'vue';
+import { h, defineComponent, ref, onMounted, onBeforeUnmount, onUpdated, watch, isRef, isReactive, toRaw } from 'vue';
 
 export function omiVueify(
   tagName: string,
@@ -71,6 +71,19 @@ export function omiVueify(
         eventHandlers.clear();
       })
 
+      onUpdated(() => {
+        // Vue patches slot children after the Web Component has been updated.
+        // Clear the published Omi children cache before asking it to re-read
+        // the patched light-DOM children.
+        const element = elRef.value as (HTMLElement & {
+          props?: { children?: unknown };
+          update?: () => void;
+        }) | null;
+        if (!element?.update) return;
+        if (element.props) element.props.children = undefined;
+        element.update();
+      });
+
       return () => {
         // 收集所有 slot vnode
         const children = [];
```

**File**: `packages/omi-vueify/test/vueify.test.jsx` (modified, +54/-0)
```diff
@@ -290,6 +290,60 @@ describe('slots', () => {
     expect(html()).toContain('Fragment Item 1')
     expect(html()).toContain('Fragment Item 2')
   })
+
+  it('should update an Omi component when a named slot is added', async () => {
+    class SlotAwareComponent extends Component {
+      render(props) {
+        const hasNamedSlot = props.children?.some(
+          (child) => child && typeof child === 'object' && child.attributes?.slot === 'named'
+        )
+
+        return hOmi(
+          'div',
+          { id: 'slot-status' },
+          hasNamedSlot ? 'visible' : 'missing'
+        )
+      }
+    }
+
+    const slotAwareNodeName = generateNodeName()
+    define(slotAwareNodeName, SlotAwareComponent)
+    const SlotAwareVue = omiVueify(slotAwareNodeName, { methodNames: [] })
+
+    const TestWrapper = defineComponent({
+      components: {
+        SlotAware: SlotAwareVue
+      },
+      props: {
+        showSlot: Boolean
+      },
+      template: `
+        <slot-aware>
+          <template #named>
+            <div v-if="showSlot">Named Slot</div>
+          </template>
+        </slot-aware>
+      `
+    })
+
+    const { container, rerender } = render(TestWrapper, {
+      props: { showSlot: false }
+    })
+    await nextTick()
+
+    const webComponent = container.querySelector(slotAwareNodeName)
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('missing')
+
+    await rerender({ showSlot: true })
+    await nextTick()
+
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('visible')
+
+    await rerender({ showSlot: false })
+    await nextTick()
+
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('missing')
+  })
 })
 
 describe('methods', () => {
```

---

### Incident Patch 2: `b9c97018` (2026-09-14)
**Commit Message**: fix(omi-vueify): refresh Omi children after Vue slot updates

**File**: `packages/omi-vueify/src/index.ts` (modified, +14/-1)
```diff
@@ -1,4 +1,4 @@
-import { h, defineComponent, ref, onMounted, onBeforeUnmount, watch, isRef, isReactive, toRaw } from 'vue';
+import { h, defineComponent, ref, onMounted, onBeforeUnmount, onUpdated, watch, isRef, isReactive, toRaw } from 'vue';
 
 export function omiVueify(
   tagName: string,
@@ -71,6 +71,19 @@ export function omiVueify(
         eventHandlers.clear();
       })
 
+      onUpdated(() => {
+        // Vue patches slot children after the Web Component has been updated.
+        // Clear the published Omi children cache before asking it to re-read
+        // the patched light-DOM children.
+        const element = elRef.value as (HTMLElement & {
+          props?: { children?: unknown };
+          update?: () => void;
+        }) | null;
+        if (!element?.update) return;
+        if (element.props) element.props.children = undefined;
+        element.update();
+      });
+
       return () => {
         // 收集所有 slot vnode
         const children = [];
```

**File**: `packages/omi-vueify/test/vueify.test.jsx` (modified, +54/-0)
```diff
@@ -290,6 +290,60 @@ describe('slots', () => {
     expect(html()).toContain('Fragment Item 1')
     expect(html()).toContain('Fragment Item 2')
   })
+
+  it('should update an Omi component when a named slot is added', async () => {
+    class SlotAwareComponent extends Component {
+      render(props) {
+        const hasNamedSlot = props.children?.some(
+          (child) => child && typeof child === 'object' && child.attributes?.slot === 'named'
+        )
+
+        return hOmi(
+          'div',
+          { id: 'slot-status' },
+          hasNamedSlot ? 'visible' : 'missing'
+        )
+      }
+    }
+
+    const slotAwareNodeName = generateNodeName()
+    define(slotAwareNodeName, SlotAwareComponent)
+    const SlotAwareVue = omiVueify(slotAwareNodeName, { methodNames: [] })
+
+    const TestWrapper = defineComponent({
+      components: {
+        SlotAware: SlotAwareVue
+      },
+      props: {
+        showSlot: Boolean
+      },
+      template: `
+        <slot-aware>
+          <template #named>
+            <div v-if="showSlot">Named Slot</div>
+          </template>
+        </slot-aware>
+      `
+    })
+
+    const { container, rerender } = render(TestWrapper, {
+      props: { showSlot: false }
+    })
+    await nextTick()
+
+    const webComponent = container.querySelector(slotAwareNodeName)
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('missing')
+
+    await rerender({ showSlot: true })
+    await nextTick()
+
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('visible')
+
+    await rerender({ showSlot: false })
+    await nextTick()
+
+    expect(webComponent?.shadowRoot.querySelector('#slot-status')?.textContent).toBe('missing')
+  })
 })
 
 describe('methods', () => {
```

---

### Incident Patch 3: `4331ebdb` (2026-03-27)
**Commit Message**: fix: remove omi-form

**File**: `packages/omi-form/.babelrc` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-{
-  "presets": [
-    [
-      "@babel/preset-typescript",
-      {
-        "jsxPragma": "h",
-        "jsxPragmaFrag": "h.f"
-      }
-    ],
-    "@babel/preset-env"
-  ],
-  "plugins": [
-    [
-      "@babel/plugin-transform-react-jsx",
-      {
-        "pragma": "h",
-        "pragmaFrag": "h.f"
-      }
-    ],
-    ["@babel/plugin-proposal-decorators", { "version": "2023-05" }],
-    "@babel/plugin-proposal-class-properties"
-  ]
-}
\ No newline at end of file
```

**File**: `packages/omi-form/.eslintrc.cjs` (removed, +0/-22)
```diff
@@ -1,22 +0,0 @@
-module.exports = {
-  parser: '@typescript-eslint/parser',
-  root: true,
-  env: {
-    browser: true,
-  },
-  rules: {
-    quotes: ['error', 'single'],
-    'semi': ['error', 'never']
-  },
-  ignorePatterns: ['test/qunit/qunit.js'],
-  overrides: [
-    {
-      files: ['**/*.ts'],
-      parserOptions: {
-       
-      },
-     
-   
-    },
-  ],
-};
```

**File**: `packages/omi-form/.gitignore` (removed, +0/-6)
```diff
@@ -1,6 +0,0 @@
-.DS_Store
-dist
-node_modules
-*.local
-*.lock
-*.log
```

**File**: `packages/omi-form/.prettierrc` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-{
-    "printWidth": 90,
-    "semi": false,
-    "singleQuote": true,
-    "tabWidth": 2,
-    "trailingComma": "es5",
-    "proseWrap": "always",
-    "endOfLine": "auto"
-}
\ No newline at end of file
```

**File**: `packages/omi-form/README.CN.md` (removed, +0/-186)
```diff
@@ -1,186 +0,0 @@
-## OMI-FORM
-
-> 强大、简单且跨框架表单解决方案
-
-## 特性
-
-* 支持json快速配置表单
-* 支持表单验证
-* 支持表单联动
-* 支持自定义渲染器和组件扩展
-* 支持多语言配置
-* 支持主题色一键更改
-* 支持分组和列表和任意嵌套
-* 跨框架支持，支持Omi、React、Vue、Angular等
-
-## 安装
-
-```bash
-npm i omi-form
-```
-
-## 使用
-
-```tsx
-import { define, WeElement, render, h } from 'omi'
-import 'omi-form'
-
-const config = {
-  components: [
-    {
-      type: 'h1',
-      text: 'Create Account',
-    },
-    {
-      type: 'divider',
-    },
-    {
-      label: 'Username',
-      tooltip: '',
-      description: 'Make sure it matches your legal name',
-      type: 'group',
-      components: [
-        {
-          type: 'input',
-          name: 'first',
-          defaultValue: 'o',
-          placeholder: 'First Name',
-          span: 6,
-        },
-        {
-          type: 'input',
-          name: 'last',
-          defaultValue: 'mi',
-          placeholder: 'Last Name',
-          span: 6,
-        },
-      ],
-    },
-    {
-      type: 'input',
-      defaultValue: '',
-      name: 'birthday',
-      placeholder: 'Birthday',
-      label: 'Birthday',
-      tooltip: '',
-      description: 'Your birthday is not visible others.',
-    },
-    {
-      type: 'select',
-      name: 'choice',
-      label: 'Country',
-      placeholder: 'Country',
-      options: [
-        { value: 'China', label: 'China' },
-        { value: 'Chile', label: 'Chile' },
-      ],
-    },
-    {
-      type: 'radio',
-      name: 'gender',
-      label: 'Gender',
-      placeholder: 'Gender',
-      options: [
-        { value: 'Male', label: 'Male' },
-        { value: 'female', label: 'female' },
-      ],
-    },
-    {
-      type: 'list',
-      label: 'Phones',
-      name: 'phones',
-      itemTemplate: {
-        label: '',
-        tooltip: '',
-        type: 'group',
-        components: [
-          {
-            type: 'input',
-            name: 'type',
-            placeholder: 'Phone Type',
-            span: 6,
-          },
-          {
-            type: 'input',
-            name: 'number',
-            props: { type: 'number' },
-            placeholder: 'Phone Number',
-            span: 6,
-          },
-        ],
-      },
-      items: [
-        {
-          label: '',
-          tooltip: '',
-          type: 'group',
-          components: [
-            {
-              type: 'input',
-              name: 'type',
-              placeholder: 'Phone Type',
-              span: 6,
-            },
-            {
-              type: 'input',
-              name: 'number',
-              placeholder: 'Phone Number',
-              span: 6,
-            },
-          ],
-        },
-      ],
-    },
-    {
-      type: 'input',
-      label: 'Email',
-      placeholder: 'Email',
-      defaultValue: 'john.doe@example.com',
-      description: 'You will receive a confirmation letter to this email.',
-    },
-    {
-      type: 'input',
-      props: { type: 'password' },
-      label: 'Password',
-      name: 'password',
-      placeholder: 'Password',
-    },
-    {
-      type: 'input',
-      props: { type: 'password' },
-      label: 'Password Again',
-      name: 'passwordConfirmation',
-      placeholder: 'Password Again',
-    },
-    {
-      type: 'checkbox',
-      text: 'I accept the Terms & Conditions & Privacy Policy',
-    },
-    {
-      type: 'checkbox',
-      text: 'I want to recieve marketing emails',
-    },
-    {
-      type: 'divider',
-    },
-  ],
-  values: { },
-  submitButton: true,
-  resetButton: true,
-  primaryColor: '#45a049',
-  labelStyle: {
-    // width: 125,
-    align: 'top', // left, right, top
-  },
-  style: {
-    maxWidth: '600px',
-    margin: '0 auto',
-    padding: '40px',
-    background: '#fff',
-    borderRadius: '5px',
-    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
-  },
-}
-
-render(<o-form config={config} />, 'body')
-```
\ No newline at end of file
```

**File**: `packages/omi-form/README.md` (removed, +0/-188)
```diff
@@ -1,188 +0,0 @@
-## OMI-FORM
-
-> Powerful, simple and cross frameworks form solution
-
-
-## Features
-
-* Support json quick configuration form
-* Support form validation
-* Support form linkage
-* Support custom renderer and component extension
-* Support multi-language configuration
-* Support theme color one-click change
-* Support grouping and list and any nesting
-* Cross-framework support, support Omi, React, Vue, Angular, etc.
-
-## Install
-
-```bash
-npm i omi-form
-```
-
-
-## Usage
-
-```tsx
-import { define, WeElement, render, h } from 'omi'
-import 'omi-form'
-
-const config = {
-  components: [
-    {
-      type: 'h1',
-      text: 'Create Account',
-    },
-    {
-      type: 'divider',
-    },
-    {
-      label: 'Username',
-      tooltip: '',
-      description: 'Make sure it matches your legal name',
-      type: 'group',
-      components: [
-        {
-          type: 'input',
-          name: 'first',
-          defaultValue: 'o',
-          placeholder: 'First Name',
-          span: 6,
-        },
-        {
-          type: 'input',
-          name: 'last',
-          defaultValue: 'mi',
-          placeholder: 'Last Name',
-          span: 6,
-        },
-      ],
-    },
-    {
-      type: 'input',
-      defaultValue: '',
-      name: 'birthday',
-      placeholder: 'Birthday',
-      label: 'Birthday',
-      tooltip: '',
-      description: 'Your birthday is not visible others.',
-    },
-    {
-      type: 'select',
-      name: 'choice',
-      label: 'Country',
-      placeholder: 'Country',
-      options: [
-        { value: 'China', label: 'China' },
-        { value: 'Chile', label: 'Chile' },
-      ],
-    },
-    {
-      type: 'radio',
-      name: 'gender',
-      label: 'Gender',
-      placeholder: 'Gender',
-      options: [
-        { value: 'Male', label: 'Male' },
-        { value: 'female', label: 'female' },
-      ],
-    },
-    {
-      type: 'list',
-      label: 'Phones',
-      name: 'phones',
-      itemTemplate: {
-        label: '',
-        tooltip: '',
-        type: 'group',
-        components: [
-          {
-            type: 'input',
-            name: 'type',
-            placeholder: 'Phone Type',
-            span: 6,
-          },
-          {
-            type: 'input',
-            name: 'number',
-            props: { type: 'number' },
-            placeholder: 'Phone Number',
-            span: 6,
-          },
-        ],
-      },
-      items: [
-        {
-          label: '',
-          tooltip: '',
-          type: 'group',
-          components: [
-            {
-              type: 'input',
-              name: 'type',
-              placeholder: 'Phone Type',
-              span: 6,
-            },
-            {
-              type: 'input',
-              name: 'number',
-              placeholder: 'Phone Number',
-              span: 6,
-            },
-          ],
-        },
-      ],
-    },
-    {
-      type: 'input',
-      label: 'Email',
-      placeholder: 'Email',
-      defaultValue: 'john.doe@example.com',
-      description: 'You will receive a confirmation letter to this email.',
-    },
-    {
-      type: 'input',
-      props: { type: 'password' },
-      label: 'Password',
-      name: 'password',
-      placeholder: 'Password',
-    },
-    {
-      type: 'input',
-      props: { type: 'password' },
-      label: 'Password Again',
-      name: 'passwordConfirmation',
-      placeholder: 'Password Again',
-    },
-    {
-      type: 'checkbox',
-      text: 'I accept the Terms & Conditions & Privacy Policy',
-    },
-    {
-      type: 'checkbox',
-      text: 'I want to recieve marketing emails',
-    },
-    {
-      type: 'divider',
-    },
-  ],
-  values: { },
-  submitButton: true,
-  resetButton: true,
-  primaryColor: '#45a049',
-  labelStyle: {
-    // width: 125,
-    align: 'top', // left, right, top
-  },
-  style: {
-    maxWidth: '600px',
-    margin: '0 auto',
-    padding: '40px',
-    background: '#fff',
-    borderRadius: '5px',
-    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
-  },
-}
-
-render(<o-form config={config} />, 'body')
-```
\ No newline at end of file
```

**File**: `packages/omi-form/examples/depends-in-list.tsx` (removed, +0/-53)
```diff
@@ -1,53 +0,0 @@
-import { render, h } from 'omi'
-import '../src/index.tsx'
-
-const config = {
-  components: [
-    {
-      type: 'list',
-      name: 'myList',
-      itemTemplate: {
-        label: '',
-        tooltip: '',
-        description: 'Make sure it matches your legal name',
-        type: 'group',
-        components: [
-          {
-            type: 'select',
-            name: 'choice',
-            defaultValue: '1',
-            placeholder: 'Last Name',
-            options: [
-              { value: '1', label: 'Option 1' },
-              { value: '2', label: 'Option 2' },
-            ],
-          },
-          {
-            type: 'input',
-            name: 'address',
-            defaultValue: 'xxx',
-            dependsOn: {
-              name: 'choice',
-              value: '2',
-            },
-          },
-        ],
-      },
-      items: [],
-    },
-  ],
-
-  // 你理解错了我的意思，每一项的 choice 和 address 有依赖关系都可以联动，互相隔离
-  submitButton: true,
-  resetButton: true,
-  style: {
-    maxWidth: '600px',
-    margin: '0 auto',
-    padding: '40px',
-    background: '#fff',
-    borderRadius: '5px',
-    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
-  },
-}
-
-render(<o-form config={config} />, 'body')
```

**File**: `packages/omi-form/examples/depends.tsx` (removed, +0/-58)
```diff
@@ -1,58 +0,0 @@
-import { render, h } from 'omi'
-import '../src/index.tsx'
-
-const config = {
-  components: [
-    {
-      type: 'select',
-      name: 'choice',
-      defaultValue: '2',
-      placeholder: 'Last Name',
-      options: [
-        { value: '1', label: 'Option 1' },
-        { value: '2', label: 'Option 2' },
-      ],
-    },
-    {
-      type: 'input',
-      name: 'email',
-      defaultValue: 'john.doe@example.com',
-      dependsOn: {
-        name: 'choice',
-        value: '2',
-      },
-    },
-    {
-      type: 'select',
-      name: 'choice2',
-      defaultValue: '',
-      placeholder: 'Last Name',
-      options: [
-        { value: '1', label: 'Option 1' },
-        { value: '2', label: 'Option 2' },
-      ],
-    },
-    {
-      type: 'input',
-      name: 'email2',
-      defaultValue: 'john.doe@example.com',
-      dependsOn: 'values.choice2 === "2"',
-    },
-  ],
-  values: {
-    choice: '1',
-    email: 'omi@qq.com',
-  },
-  submitButton: true,
-  resetButton: true,
-  style: {
-    maxWidth: '600px',
-    margin: '0 auto',
-    padding: '40px',
-    background: '#fff',
-    borderRadius: '5px',
-    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
-  },
-}
-
-render(<o-form config={config} />, 'body')
```

---

### Incident Patch 4: `a55320bc` (2025-12-15)
**Commit Message**: feat: 照搬tdesign-react chatbot-agui reactify

**File**: `packages/omi-reactify/src/index.tsx` (modified, +343/-116)
```diff
@@ -1,83 +1,111 @@
-import React, { Component, createRef, createElement, forwardRef } from "react";
-import ReactDOM from "react-dom";
-import { createRoot } from "react-dom/client";
+import React, { Component, createRef, createElement, forwardRef } from 'react';
+import ReactDOM from 'react-dom';
+import { createRoot } from 'react-dom/client';
 
 // 检测 React 版本
-const isReact18Plus = () => {
-  return typeof createRoot !== 'undefined';
+const isReact18Plus = () => typeof createRoot !== 'undefined';
+const isReact19Plus = (): boolean => {
+  const majorVersion = parseInt(React.version.split('.')[0]);
+  return majorVersion >= 19;
 };
 
-// 创建渲染函数
+// 增强版本的缓存管理
+const rootCache = new WeakMap<
+  HTMLElement,
+  {
+    root: ReturnType<typeof createRoot>;
+    lastElement?: React.ReactElement;
+  }
+>();
+
 const createRenderer = (container: HTMLElement) => {
   if (isReact18Plus()) {
-    const root = createRoot(container);
+    let cached = rootCache.get(container);
+    if (!cached) {
+      cached = { root: createRoot(container) };
+      rootCache.set(container, cached);
+    }
+
     return {
       render: (element: React.ReactElement) => {
-        root.render(element);
+        // 可选：避免相同元素的重复渲染
+        if (cached.lastElement !== element) {
+          cached.root.render(element);
+          cached.lastElement = element;
+        }
       },
       unmount: () => {
-        root.unmount();
-      }
-    };
-  } else {
-    return {
-      render: (element: React.ReactElement) => {
-        ReactDOM.render(element, container);
+        cached.root.unmount();
+        rootCache.delete(container);
       },
-      unmount: () => {
-        ReactDOM.unmountComponentAtNode(container);
-      }
     };
   }
+
+  // React 17的实现
+  return {
+    render: (element: React.ReactElement) => {
+      ReactDOM.render(element, container);
+    },
+    unmount: () => {
+      ReactDOM.unmountComponentAtNode(container);
+    },
+  };
 };
 
-const isFunctionComponentWithHooks = (component: any): boolean => {
-  // 1. 先检查是否是函数
-  if (typeof component !== 'function') return false;
-
-  // 2. 检查函数体是否包含 Hook 关键字
-  const componentCode = component.toString();
-  const hookKeywords = [
-    'useState',
-    'useEffect',
-    'useRef',
-    'useContext',
-    'useMemo',
-    'useCallback',
-    'useReducer'
-  ];
-
-  return hookKeywords.some(hook => componentCode.includes(hook));
-}
+// 检查是否是React元素
+const isReactElement = (obj: any): obj is React.ReactElement =>
+  obj && typeof obj === 'object' && obj.$$typeof && obj.$$typeof.toString().includes('react');
 
-const isClassComponent = (component: any): boolean => {
-  const isFC = typeof component === 'function';
-  return !!(isFC && component.prototype?.render)
-}
+// 检查是否是有效的React节点
+const isValidReactNode = (node: any): node is React.ReactNode =>
+  node !== null &&
+  node !== undefined &&
+  (typeof node === 'string' ||
+    typeof node === 'number' ||
+    typeof node === 'boolean' ||
+    isReactElement(node) ||
+    Array.isArray(node));
 
 type AnyProps = {
   [key: string]: any;
-}
+};
 
-const hyphenateRE = /\B([A-Z])/g
+const hyphenateRE = /\B([A-Z])/g;
 
 export function hyphenate(str: string): string {
-  return str.replace(hyphenateRE, '-$1').toLowerCase()
+  return str.replace(hyphenateRE, '-$1').toLowerCase();
 }
 
-const styleObjectToString = (style: CSSRule) => {
+const styleObjectToString = (style: any) => {
+  if (!style || typeof style !== 'object') return '';
+
   const unitlessKeys = new Set([
-    'animationIterationCount', 'boxFlex', 'boxFlexGroup', 'boxOrdinalGroup',
-    'columnCount', 'fillOpacity', 'flex', 'flexGrow', 'flexShrink', 'fontWeight',
-    'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'tabSize',
-    'widows', 'zIndex', 'zoom'
+    'animationIterationCount',
+    'boxFlex',
+    'boxFlexGroup',
+    'boxOrdinalGroup',
+    'columnCount',
+    'fillOpacity',
+    'flex',
+    'flexGrow',
+    'flexShrink',
+    'fontWeight',
+    'lineClamp',
+    'lineHeight',
+    'opacity',
+    'order',
+    'orphans',
+    'tabSize',
+    'widows',
+    'zIndex',
+    'zoom',
   ]);
 
   return Object.entries(style)
-    .filter(([_, value]) => value != null && value !== '') // 过滤无效值
+    .filter(([, value]) => value != null && value !== '') // 过滤无效值
     .map(([key, value]) => {
       // 转换驼峰式为连字符格式
-      const cssKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
+      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
 
       // 处理数值类型值
       let cssValue = value;
@@ -88,19 +116,22 @@ const styleObjectToString = (style: CSSRule) => {
       return `${cssKey}:${cssValue};`;
     })
     .join(' ');
-}
+};
 
-const reactify = <T extends AnyProps = AnyProps>(WC: string): React.ForwardRefExoticComponent<Omit<T, "ref"> & React.RefAttributes<HTMLElement | undefined>> => {
+const reactify = <T extends AnyProps = AnyProps>(
+  WC: string,
+): React.ForwardRefExoticComponent<Omit<T, 'ref'> & React.RefAttributes<HT
```

---

### Incident Patch 5: `7a1fc4bb` (2025-09-02)
**Commit Message**: Merge pull request #994 from LzhengH/fix/vueify-event

fix(omi-vueify): event listener

**File**: `packages/omi-vueify/src/index.ts` (modified, +13/-3)
```diff
@@ -42,15 +42,25 @@ export function omiVueify(
         // 添加事件监听
         omiEvents.forEach((omiEvent) => {
           const vueEvent = camelToKebab(omiEvent);
-          // 仅处理kebab-case风格
-          if (!isKebabString(vueEvent)) return;
+          // 仅处理 kebab-case/单词 风格
+          if (!isKebabString(vueEvent) && omiEvent !== vueEvent) return;
 
           const handler = (e: Event) => {
             emit(vueEvent, e);
           };
           eventHandlers.set(omiEvent, handler);
           elRef.value?.addEventListener(omiEvent, handler);
-        })
+        });
+        // 处理函数参数传入
+        Object.entries(formatAttrs.value).forEach(([key, value]) => {
+          if (typeof value === 'function') {
+            // 函数参数通过props而非attrs传入
+            // @ts-ignore
+            elRef.value[kebabToCamel(key)] = value;
+            // @ts-ignore
+            delete formatAttrs.value[key];
+          }
+        });
       })
 
       // 清理事件监听
```

---

### Incident Patch 6: `123307dd` (2025-09-02)
**Commit Message**: fix(omi-vueify): function props

**File**: `packages/omi-vueify/src/index.ts` (modified, +11/-1)
```diff
@@ -50,7 +50,17 @@ export function omiVueify(
           };
           eventHandlers.set(omiEvent, handler);
           elRef.value?.addEventListener(omiEvent, handler);
-        })
+        });
+        // 处理函数参数传入
+        Object.entries(formatAttrs.value).forEach(([key, value]) => {
+          if (typeof value === 'function') {
+            // 函数参数通过props而非attrs传入
+            // @ts-ignore
+            elRef.value[kebabToCamel(key)] = value;
+            // @ts-ignore
+            delete formatAttrs.value[key];
+          }
+        });
       })
 
       // 清理事件监听
```

---

### Incident Patch 7: `8726f78b` (2025-09-02)
**Commit Message**: fix(omi-vueify): event listener

**File**: `packages/omi-vueify/src/index.ts` (modified, +2/-2)
```diff
@@ -42,8 +42,8 @@ export function omiVueify(
         // 添加事件监听
         omiEvents.forEach((omiEvent) => {
           const vueEvent = camelToKebab(omiEvent);
-          // 仅处理kebab-case风格
-          if (!isKebabString(vueEvent)) return;
+          // 仅处理 kebab-case/单词 风格
+          if (!isKebabString(vueEvent) && omiEvent !== vueEvent) return;
 
           const handler = (e: Event) => {
             emit(vueEvent, e);
```

---

### Incident Patch 8: `db1d3ec0` (2025-08-22)
**Commit Message**: Merge pull request #992 from LzhengH/fix/vueify-reactive

fix: 修复vueify中遇到reactive类型参数无法响应式的问题

**File**: `packages/omi-vueify/src/index.ts` (modified, +51/-18)
```diff
@@ -1,4 +1,4 @@
-import { h, defineComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';
+import { h, defineComponent, ref, onMounted, onBeforeUnmount, watch, isRef, isReactive, toRaw } from 'vue';
 
 export function omiVueify(
   tagName: string,
@@ -28,22 +28,7 @@ export function omiVueify(
 
       expose(methods);
 
-      // 处理属性命名规则
-      const formatAttrs = computed(() =>
-        Object.fromEntries(
-          Object.entries(attrs)
-            // 仅处理非事件
-            .filter(([key]) => !key.match(/^on[A-Za-z]/))
-            .map(([key, value]) => {
-              // 复杂类型 转驼峰
-              if (value && typeof value === 'object') {
-                return [kebabToCamel(key), value];
-              }
-              // 基本数据类型 转kebab-case
-              return [camelToKebab(key), value];
-            }),
-        ),
-      );
+      const formatAttrs = useUnwrapAndFormatAttrs(attrs);
 
       // 处理事件监听
       const omiEvents = Object.keys(attrs)
@@ -151,4 +136,52 @@ const camelToKebab = (omiEvent: string): string => {
  */
 const kebabToCamel = (str: string): string => {
   return str.replace(/-([a-z])/g, (_match, p1) => p1.toUpperCase());
-}
\ No newline at end of file
+}
+
+const deepUnwrap = (val: any): any => {
+  if (isRef(val)) return deepUnwrap(val.value);
+  if (isReactive(val)) val = toRaw(val);
+  if (Array.isArray(val)) return val.map(deepUnwrap);
+  if (val && typeof val === 'object') {
+    const obj: Record<string, any> = {};
+    for (const k in val) obj[k] = deepUnwrap(val[k]);
+    return obj;
+  }
+  return val;
+};
+
+/**
+ * 将 attrs 里的非事件属性递归解包为普通对象，且驼峰kebab命名兼容
+ */
+const useUnwrapAndFormatAttrs = (attrs: Record<string, any>) => {
+  const unwraped = ref({});
+
+  // watch keys变化，自动维护监听
+  watch(
+    () => Object.entries(attrs),
+    (entries) => {
+      const result: Record<string, any> = {};
+      entries.forEach(([key, value]) => {
+        if (!key.match(/^on[A-Za-z]/)) {
+          // 对象类型转驼峰，基本类型转kebab
+          let finalKey = key;
+          let finalValue = value;
+          if (isRef(value) || isReactive(value)) {
+            finalValue = deepUnwrap(value);
+          }
+
+          if (finalValue && typeof finalValue === 'object') {
+            finalKey = kebabToCamel(key);
+          } else {
+            finalKey = camelToKebab(key);
+          }
+          result[finalKey] = finalValue;
+        }
+      });
+      unwraped.value = result;
+    },
+    { immediate: true, deep: true },
+  );
+
+  return unwraped;
+};
```

---

### Incident Patch 9: `bbebedb7` (2025-08-22)
**Commit Message**: Merge branch 'master' into fix/vueify-reactive

**File**: `packages/omi-vueify/src/index.ts` (modified, +11/-6)
```diff
@@ -35,24 +35,30 @@ export function omiVueify(
         .filter(attrKey => attrKey.match(/^on[A-Za-z]/))
         .map(oriEvent => oriEventToOmi(oriEvent));
 
+      // 存储事件处理函数的引用，以便正确移除
+      const eventHandlers = new Map<string, (e: Event) => void>();
+
       onMounted(() => {
         // 添加事件监听
         omiEvents.forEach((omiEvent) => {
           const vueEvent = camelToKebab(omiEvent);
           // 仅处理kebab-case风格
           if (!isKebabString(vueEvent)) return;
 
-          elRef.value?.addEventListener(omiEvent, (e: Event) => {
+          const handler = (e: Event) => {
             emit(vueEvent, e);
-          })
+          };
+          eventHandlers.set(omiEvent, handler);
+          elRef.value?.addEventListener(omiEvent, handler);
         })
       })
 
       // 清理事件监听
       onBeforeUnmount(() => {
-        omiEvents.forEach((omiEvent) => {
-          elRef.value?.removeEventListener(omiEvent, () => {})
-        })
+        eventHandlers.forEach((handler, omiEvent) => {
+          elRef.value?.removeEventListener(omiEvent, handler);
+        });
+        eventHandlers.clear();
       })
 
       return () => {
@@ -132,7 +138,6 @@ const kebabToCamel = (str: string): string => {
   return str.replace(/-([a-z])/g, (_match, p1) => p1.toUpperCase());
 }
 
-
 const deepUnwrap = (val: any): any => {
   if (isRef(val)) return deepUnwrap(val.value);
   if (isReactive(val)) val = toRaw(val);
```

---

### Incident Patch 10: `f1c6b23e` (2025-08-22)
**Commit Message**: fix: 修复vueify中遇到reactive类型参数无法响应式的问题

**File**: `packages/omi-vueify/src/index.ts` (modified, +51/-17)
```diff
@@ -1,4 +1,4 @@
-import { h, defineComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';
+import { h, defineComponent, ref, onMounted, onBeforeUnmount, watch, isRef, isReactive, toRaw } from 'vue';
 
 export function omiVueify(
   tagName: string,
@@ -28,22 +28,7 @@ export function omiVueify(
 
       expose(methods);
 
-      // 处理属性命名规则
-      const formatAttrs = computed(() =>
-        Object.fromEntries(
-          Object.entries(attrs)
-            // 仅处理非事件
-            .filter(([key]) => !key.match(/^on[A-Za-z]/))
-            .map(([key, value]) => {
-              // 复杂类型 转驼峰
-              if (value && typeof value === 'object') {
-                return [kebabToCamel(key), value];
-              }
-              // 基本数据类型 转kebab-case
-              return [camelToKebab(key), value];
-            }),
-        ),
-      );
+      const formatAttrs = useUnwrapAndFormatAttrs(attrs);
 
       // 处理事件监听
       const omiEvents = Object.keys(attrs)
@@ -146,3 +131,52 @@ const camelToKebab = (omiEvent: string): string => {
 const kebabToCamel = (str: string): string => {
   return str.replace(/-([a-z])/g, (_match, p1) => p1.toUpperCase());
 }
+
+
+const deepUnwrap = (val: any): any => {
+  if (isRef(val)) return deepUnwrap(val.value);
+  if (isReactive(val)) val = toRaw(val);
+  if (Array.isArray(val)) return val.map(deepUnwrap);
+  if (val && typeof val === 'object') {
+    const obj: Record<string, any> = {};
+    for (const k in val) obj[k] = deepUnwrap(val[k]);
+    return obj;
+  }
+  return val;
+};
+
+/**
+ * 将 attrs 里的非事件属性递归解包为普通对象，且驼峰kebab命名兼容
+ */
+const useUnwrapAndFormatAttrs = (attrs: Record<string, any>) => {
+  const unwraped = ref({});
+
+  // watch keys变化，自动维护监听
+  watch(
+    () => Object.entries(attrs),
+    (entries) => {
+      const result: Record<string, any> = {};
+      entries.forEach(([key, value]) => {
+        if (!key.match(/^on[A-Za-z]/)) {
+          // 对象类型转驼峰，基本类型转kebab
+          let finalKey = key;
+          let finalValue = value;
+          if (isRef(value) || isReactive(value)) {
+            finalValue = deepUnwrap(value);
+          }
+
+          if (finalValue && typeof finalValue === 'object') {
+            finalKey = kebabToCamel(key);
+          } else {
+            finalKey = camelToKebab(key);
+          }
+          result[finalKey] = finalValue;
+        }
+      });
+      unwraped.value = result;
+    },
+    { immediate: true, deep: true },
+  );
+
+  return unwraped;
+};
```

---

### Incident Patch 11: `2b835e6a` (2025-08-21)
**Commit Message**: fix: fix ref/reactive props error & fix event unbind error

**File**: `packages/omi-vueify/src/index.ts` (modified, +20/-7)
```diff
@@ -1,4 +1,4 @@
-import { h, defineComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';
+import { h, defineComponent, ref, onMounted, onBeforeUnmount, computed, isRef, unref, isReactive, toRaw } from 'vue';
 
 export function omiVueify(
   tagName: string,
@@ -35,6 +35,13 @@ export function omiVueify(
             // 仅处理非事件
             .filter(([key]) => !key.match(/^on[A-Za-z]/))
             .map(([key, value]) => {
+              // 处理 ref 和 reactive
+              if (isRef(value)) {
+                value = unref(value);
+              } else if (isReactive(value)) {
+                value = toRaw(value);
+              }
+              
               // 复杂类型 转驼峰
               if (value && typeof value === 'object') {
                 return [kebabToCamel(key), value];
@@ -50,24 +57,30 @@ export function omiVueify(
         .filter(attrKey => attrKey.match(/^on[A-Za-z]/))
         .map(oriEvent => oriEventToOmi(oriEvent));
 
+      // 存储事件处理函数的引用，以便正确移除
+      const eventHandlers = new Map<string, (e: Event) => void>();
+
       onMounted(() => {
         // 添加事件监听
         omiEvents.forEach((omiEvent) => {
           const vueEvent = camelToKebab(omiEvent);
           // 仅处理kebab-case风格
           if (!isKebabString(vueEvent)) return;
 
-          elRef.value?.addEventListener(omiEvent, (e: Event) => {
+          const handler = (e: Event) => {
             emit(vueEvent, e);
-          })
+          };
+          eventHandlers.set(omiEvent, handler);
+          elRef.value?.addEventListener(omiEvent, handler);
         })
       })
 
       // 清理事件监听
       onBeforeUnmount(() => {
-        omiEvents.forEach((omiEvent) => {
-          elRef.value?.removeEventListener(omiEvent, () => {})
-        })
+        eventHandlers.forEach((handler, omiEvent) => {
+          elRef.value?.removeEventListener(omiEvent, handler);
+        });
+        eventHandlers.clear();
       })
 
       return () => {
@@ -145,4 +158,4 @@ const camelToKebab = (omiEvent: string): string => {
  */
 const kebabToCamel = (str: string): string => {
   return str.replace(/-([a-z])/g, (_match, p1) => p1.toUpperCase());
-}
+}
\ No newline at end of file
```

---

### Incident Patch 12: `2ae52c6f` (2025-07-24)
**Commit Message**: fix: 保持vue组件为PascalCase命名 omi组件为kebab-case命名

**File**: `packages/omi-vueify/examples/simple/src/App.vue` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <script setup lang="ts">
 import HelloWorld from './components/HelloWorld.vue'
-import TreeComponent from './components/tree-component.vue'
+import TreeComponent from './components/TreeComponent.vue'
 </script>
 
 <template>
```

---

### Incident Patch 13: `1225322a` (2025-07-24)
**Commit Message**: fix 将experimentalDecorators移至tsconfig.app.json

**File**: `packages/omi-vueify/examples/simple/tsconfig.app.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
   "extends": "@vue/tsconfig/tsconfig.dom.json",
   "compilerOptions": {
     "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
+    "experimentalDecorators": true,
 
     /* Linting */
     "strict": true,
```

**File**: `packages/omi-vueify/examples/simple/vite.config.ts` (modified, +1/-6)
```diff
@@ -7,11 +7,6 @@ export default defineConfig({
   esbuild: {
     jsxFactory: 'h',
     jsxFragment: 'h.f',
-    jsxInject: `import { h } from 'omi'`,
-    tsconfigRaw: `{
-      "compilerOptions": {
-        "experimentalDecorators": true
-      }
-    }`
+    jsxInject: `import { h } from 'omi'`
   },
 })
```

---

### Incident Patch 14: `6c883069` (2025-07-24)
**Commit Message**: fix: 完善

**File**: `packages/omi-vueify/examples/simple/src/App.vue` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 <script setup lang="ts">
 import HelloWorld from './components/HelloWorld.vue'
-import TreeComponent from './components/TreeComponent.vue'
+import TreeComponent from './components/tree-component.vue'
 </script>
 
 <template>
```

**File**: `packages/omi-vueify/examples/simple/src/components/OTree.tsx` (removed, +0/-619)
```diff
@@ -1,619 +0,0 @@
-import { Component, tag, signal } from 'omi'
-
-// 树节点数据结构
-export interface TreeNode {
-  id: string | number
-  label: string
-  expanded?: boolean | ReturnType<typeof signal>
-  children?: TreeNode[]
-  [key: string]: any
-}
-
-// 树组件属性
-export interface TreeProps {
-  data: TreeNode[]
-  expanded?: boolean
-  nodeKey?: string
-}
-
-// 定义放置位置的枚举类型
-export enum DropPosition {
-  BEFORE = 'before',
-  INSIDE = 'inside',
-  AFTER = 'after',
-  NONE = 'none'
-}
-
-interface TreeState {
-  data: TreeNode[];
-  draggedNodeId: string | null;
-  currentDropTarget: HTMLElement | null;
-  currentDropPosition: DropPosition;
-  lastDropPosition: DropPosition;
-  lastUpdateTime: number;
-  highlightedNodeId: string | number | null;
-}
-
-
-@tag('o-tree')
-export class OTree extends Component<TreeProps> {
-  static css = `
-    .o-tree {
-      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
-    }
-    .o-tree-node {
-      padding: 5px 0;
-      position: relative;
-      transition: background-color 0.2s ease, border-color 0.2s ease;
-      box-sizing: border-box;
-      border: 1px solid transparent;
-    }
-    .o-tree-node-content {
-      display: flex;
-      align-items: center;
-      cursor: pointer;
-      height: 26px;
-      line-height: 26px;
-      transition: background-color 0.2s ease;
-    }
-    .o-tree-node-content:hover {
-      background-color: #f5f7fa;
-    }
-    .o-tree-node-content.highlight {
-      background-color: #e6f7ff;
-      border-color: #91d5ff;
-    }
-    .o-tree-node-label {
-      font-size: 14px;
-    }
-    .o-tree-node-expand-icon {
-      margin-right: 4px;
-      width: 16px;
-      height: 16px;
-      display: inline-flex;
-      align-items: center;
-      justify-content: center;
-      color: #606266;
-      transform: rotate(0deg);
-      transition: transform 0.3s ease-in-out;
-    }
-    .o-tree-node-expand-icon.expanded {
-      transform: rotate(90deg);
-    }
-    .o-tree-node-children {
-      padding-left: 18px;
-      overflow: hidden;
-      max-height: 0;
-      transition: max-height 0.3s ease-in-out;
-    }
-    .o-tree-node-children.expanded {
-      max-height: 1000px; 
-    }
-    .o-tree-node-loading {
-      color: #909399;
-      margin-right: 4px;
-    }
-    .drag-over {
-      background-color: #f0f8ff;
-      border: 1px dashed #409eff;
-    }
-    .o-tree-node.drag-over > * {
-      pointer-events: none;
-    }
-    .drop-inside {
-      background-color: rgba(64, 158, 255, 0.1);
-      border-color: #409eff;
-      border-style: dashed;
-    }
-    .drop-before {
-      position: relative;
-    }
-    .drop-before::before {
-      content: '';
-      position: absolute;
-      top: 0;
-      left: 0;
-      right: 0;
-      height: 2px;
-      background-color: #409eff;
-      z-index: 1;
-      transition: all 0.2s ease-in-out;
-    }
-    .drop-after {
-      position: relative;
-    }
-    .drop-after::after {
-      content: '';
-      position: absolute;
-      bottom: 0;
-      left: 0;
-      right: 0;
-      height: 2px;
-      background-color: #409eff;
-      z-index: 1;
-      transition: all 0.2s ease-in-out;
-    }
-  `
-
-  static props = {
-    data: {
-      type: Array,
-      default: []
-    },
-    expanded: {
-      type: Boolean,
-      default: false
-    },
-    nodeKey: {
-      type: String,
-      default: 'id'
-    }
-  }
-
-  
-  store = signal<TreeState>({
-    data: [],
-    draggedNodeId: null,
-    currentDropTarget: null,
-    currentDropPosition: DropPosition.NONE,
-    lastDropPosition: DropPosition.NONE,
-    lastUpdateTime: 0,
-    highlightedNodeId: null,
-  })
-
-  private lastUsedId = 0
-
-  constructor() {
-    super();
-  }
-
-
-  initializeSignals(node: TreeNode): TreeNode {
-    if (typeof node.expanded !== 'object' || !node.expanded?.value) {
-      node.expanded = signal(node.expanded === true);
-    }
-    if (node.children) {
-      node.children = node.children.map(child => this.initializeSignals(child))
-    }
-    return node;
-  }
-
-  private _initializeLastUsedId(nodes: TreeNode[]) {
-    for (const node of nodes) {
-      if (typeof node.id === 'number' && node.id > this.lastUsedId) {
-        this.lastUsedId = node.id;
-      }
-      if (node.children) {
-        this._initializeLastUsedId(node.children);
-      }
-    }
-  }
-
-  install() {
-    this.store.value.data = this.props.data.map(node => this.initializeSignals({ ...node }));
-    this._initializeLastUsedId(this.store.value.data);
-    
-    document.addEventListener('dragover', (e) => {
-      e.preventDefault();
-    });
-  }
-
-
-  nodeClick(node: TreeNode): void {
-    if (typeof node.expanded === 'object') {
-      node.expanded.value = !node.expanded.value;
-    }
-    this.fire('nodeClick', node)
-  }
-
-  nodeExpand(node: TreeNode): void {
-    if (typeof node.expanded === 'object') {
-      node.expanded.value = true;
-    }
-    this.fire('nodeExp
```

**File**: `packages/omi-vueify/examples/simple/src/components/TreeComponent.vue` (removed, +0/-224)
```diff
@@ -1,224 +0,0 @@
-<script setup lang="ts">
-import { ref } from 'vue';
-import { omiVueify } from '../../../../src/index';
-import './OTree';
-import type { TreeNode } from './OTree';
-
-// 使用omiVueify封装o-tree组件
-const OmiTree = omiVueify('o-tree', {
-  methodNames: ['nodeExpand', 'nodeCollapse', 'addNode', 'removeNode', 'updateNode', 'highlightNode']
-});
-
-// 树节点数据
-const treeData = ref<TreeNode[]>([
-  {
-    id: 1,
-    label: '一级节点 1',
-    expanded: true,
-    children: [
-      {
-        id: 11,
-        label: '二级节点 1-1',
-        children: [
-          {
-            id: 111,
-            label: '三级节点 1-1-1'
-          }
-        ]
-      },
-      {
-        id: 12,
-        label: '二级节点 1-2'
-      }
-    ]
-  },
-  {
-    id: 2,
-    label: '一级节点 2',
-    children: [
-      {
-        id: 21,
-        label: '二级节点 2-1'
-      },
-      {
-        id: 22,
-        label: '二级节点 2-2'
-      }
-    ]
-  }
-]);
-
-const treeRef = ref();
-
-const addNodeInput = ref('');
-const addLabelInput = ref('');
-const addPositionInput = ref('');
-
-function performAddNode() {
-  const parentId = addNodeInput.value ? parseInt(addNodeInput.value) : null;
-  const label = addLabelInput.value || 'New Node';
-  const position = addPositionInput.value ? parseInt(addPositionInput.value) : -1;
-
-  const newNode = { label };
-  treeRef.value.addNode(parentId, newNode, position);
-  addNodeInput.value = '';
-  addLabelInput.value = '';
-  addPositionInput.value = '';
-}
-
-const removeNodeInput = ref('');
-
-function performRemoveNode() {
-  const id = parseInt(removeNodeInput.value);
-  if (!isNaN(id)) {
-    treeRef.value.removeNode(id);
-  }
-  removeNodeInput.value = '';
-}
-
-const updateNodeInput = ref('');
-const updateLabelInput = ref('');
-
-function performUpdateNode() {
-  const id = parseInt(updateNodeInput.value);
-  const label = updateLabelInput.value;
-  if (!isNaN(id) && label) {
-    treeRef.value.updateNode(id, { label });
-  }
-  updateNodeInput.value = '';
-  updateLabelInput.value = '';
-}
-
-const findNodeInput = ref('');
-
-function performFindNode() {
-  const id = findNodeInput.value ? parseInt(findNodeInput.value) : null;
-  treeRef.value.highlightNode(id);
-}
-
-</script>
-
-<template>
-  <div class="tree-component">
-    <h3>树组件示例</h3>
-    <div class="container">
-      <div class="tree-container">
-        <OmiTree 
-          ref="treeRef"
-          :data="treeData"
-        >
-        </OmiTree>
-      </div>
-      <div class="operations">
-        <div class="form-group">
-          <h4>添加节点</h4>
-          <input v-model="addNodeInput" placeholder="Parent ID (null for root)" />
-          <input v-model="addLabelInput" placeholder="Label" />
-          <input v-model="addPositionInput" placeholder="Position (-1 for end)" />
-          <button @click="performAddNode">添加</button>
-        </div>
-
-        <div class="form-group">
-          <h4>删除节点</h4>
-          <input v-model="removeNodeInput" placeholder="Node ID" />
-          <button @click="performRemoveNode">删除</button>
-        </div>
-
-        <div class="form-group">
-          <h4>更新节点</h4>
-          <input v-model="updateNodeInput" placeholder="Node ID" />
-          <input v-model="updateLabelInput" placeholder="New Label" />
-          <button @click="performUpdateNode">更新</button>
-        </div>
-
-        <div class="form-group">
-          <h4>查找节点</h4>
-          <input v-model="findNodeInput" placeholder="Node ID" />
-          <button @click="performFindNode">查找</button>
-        </div>
-      </div>
-    </div>
-  </div>
-</template>
-
-<style scoped>
-.tree-component {
-  padding: 20px;
-  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
-  color: #333;
-}
-
-h3, .operations h4 {
-  margin-top: 0;
-  margin-bottom: 1em;
-  font-weight: 600;
-}
-
-.container {
-  display: flex;
-  gap: 30px;
-  align-items: flex-start;
-}
-
-.tree-container {
-  flex: 1;
-}
-
-.operations {
-  width: 200px;
-  display: flex;
-  flex-direction: column;
-  gap: 20px;
-}
-
-.form-group {
-  display: flex;
-  flex-direction: column;
-  gap: 8px;
-}
-
-.operations input,
-.operations button {
-  width: 100%;
-  padding: 8px;
-  border: 1px solid #ddd;
-  border-radius: 4px;
-  box-sizing: border-box;
-  font-size: 14px;
-}
-
-.operations button {
-  background-color: #f0f0f0;
-  border-color: #ccc;
-  cursor: pointer;
-  font-weight: 500;
-}
-.operations button:hover {
-  background-color: #e0e0e0;
-}
-
-.modal {
-  position: fixed;
-  inset: 0;
-  background: rgba(0, 0, 0, 0.5);
-  display: grid;
-  place-items: center;
-}
-.modal-content {
-  background: white;
-  padding: 20px 25px;
-  border-radius: 5px;
-  max-width: 500px;
-  width: calc(100% - 40px);
-}
-.modal-content button {
-    margin-top: 15px;
-}
-pre {
-  white-space: pre-wrap;
-  word-wrap: break-word;
-  background: #f7f7f7;
-  padding: 10px;
-  border-radius: 4px;
-}
-</style> 
\ No newline at end of file
```

---

### Incident Patch 15: `6ab5f7d3` (2025-07-24)
**Commit Message**: fix: 修改文件名为小写中划线

**File**: `packages/omi-vueify/examples/simple/src/components/o-tree.tsx` (added, +619/-0)
```diff
@@ -0,0 +1,619 @@
+import { Component, tag, signal } from 'omi'
+
+// 树节点数据结构
+export interface TreeNode {
+  id: string | number
+  label: string
+  expanded?: boolean | ReturnType<typeof signal>
+  children?: TreeNode[]
+  [key: string]: any
+}
+
+// 树组件属性
+export interface TreeProps {
+  data: TreeNode[]
+  expanded?: boolean
+  nodeKey?: string
+}
+
+// 定义放置位置的枚举类型
+export enum DropPosition {
+  BEFORE = 'before',
+  INSIDE = 'inside',
+  AFTER = 'after',
+  NONE = 'none'
+}
+
+interface TreeState {
+  data: TreeNode[];
+  draggedNodeId: string | null;
+  currentDropTarget: HTMLElement | null;
+  currentDropPosition: DropPosition;
+  lastDropPosition: DropPosition;
+  lastUpdateTime: number;
+  highlightedNodeId: string | number | null;
+}
+
+
+@tag('o-tree')
+export class OTree extends Component<TreeProps> {
+  static css = `
+    .o-tree {
+      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
+    }
+    .o-tree-node {
+      padding: 5px 0;
+      position: relative;
+      transition: background-color 0.2s ease, border-color 0.2s ease;
+      box-sizing: border-box;
+      border: 1px solid transparent;
+    }
+    .o-tree-node-content {
+      display: flex;
+      align-items: center;
+      cursor: pointer;
+      height: 26px;
+      line-height: 26px;
+      transition: background-color 0.2s ease;
+    }
+    .o-tree-node-content:hover {
+      background-color: #f5f7fa;
+    }
+    .o-tree-node-content.highlight {
+      background-color: #e6f7ff;
+      border-color: #91d5ff;
+    }
+    .o-tree-node-label {
+      font-size: 14px;
+    }
+    .o-tree-node-expand-icon {
+      margin-right: 4px;
+      width: 16px;
+      height: 16px;
+      display: inline-flex;
+      align-items: center;
+      justify-content: center;
+      color: #606266;
+      transform: rotate(0deg);
+      transition: transform 0.3s ease-in-out;
+    }
+    .o-tree-node-expand-icon.expanded {
+      transform: rotate(90deg);
+    }
+    .o-tree-node-children {
+      padding-left: 18px;
+      overflow: hidden;
+      max-height: 0;
+      transition: max-height 0.3s ease-in-out;
+    }
+    .o-tree-node-children.expanded {
+      max-height: 1000px; 
+    }
+    .o-tree-node-loading {
+      color: #909399;
+      margin-right: 4px;
+    }
+    .drag-over {
+      background-color: #f0f8ff;
+      border: 1px dashed #409eff;
+    }
+    .o-tree-node.drag-over > * {
+      pointer-events: none;
+    }
+    .drop-inside {
+      background-color: rgba(64, 158, 255, 0.1);
+      border-color: #409eff;
+      border-style: dashed;
+    }
+    .drop-before {
+      position: relative;
+    }
+    .drop-before::before {
+      content: '';
+      position: absolute;
+      top: 0;
+      left: 0;
+      right: 0;
+      height: 2px;
+      background-color: #409eff;
+      z-index: 1;
+      transition: all 0.2s ease-in-out;
+    }
+    .drop-after {
+      position: relative;
+    }
+    .drop-after::after {
+      content: '';
+      position: absolute;
+      bottom: 0;
+      left: 0;
+      right: 0;
+      height: 2px;
+      background-color: #409eff;
+      z-index: 1;
+      transition: all 0.2s ease-in-out;
+    }
+  `
+
+  static props = {
+    data: {
+      type: Array,
+      default: []
+    },
+    expanded: {
+      type: Boolean,
+      default: false
+    },
+    nodeKey: {
+      type: String,
+      default: 'id'
+    }
+  }
+
+  
+  store = signal<TreeState>({
+    data: [],
+    draggedNodeId: null,
+    currentDropTarget: null,
+    currentDropPosition: DropPosition.NONE,
+    lastDropPosition: DropPosition.NONE,
+    lastUpdateTime: 0,
+    highlightedNodeId: null,
+  })
+
+  private lastUsedId = 0
+
+  constructor() {
+    super();
+  }
+
+
+  initializeSignals(node: TreeNode): TreeNode {
+    if (typeof node.expanded !== 'object' || !node.expanded?.value) {
+      node.expanded = signal(node.expanded === true);
+    }
+    if (node.children) {
+      node.children = node.children.map(child => this.initializeSignals(child))
+    }
+    return node;
+  }
+
+  private _initializeLastUsedId(nodes: TreeNode[]) {
+    for (const node of nodes) {
+      if (typeof node.id === 'number' && node.id > this.lastUsedId) {
+        this.lastUsedId = node.id;
+      }
+      if (node.children) {
+        this._initializeLastUsedId(node.children);
+      }
+    }
+  }
+
+  install() {
+    this.store.value.data = this.props.data.map(node => this.initializeSignals({ ...node }));
+    this._initializeLastUsedId(this.store.value.data);
+    
+    document.addEventListener('dragover', (e) => {
+      e.preventDefault();
+    });
+  }
+
+
+  nodeClick(node: TreeNode): void {
+    if (typeof node.expanded === 'object') {
+      node.expanded.value = !node.expanded.value;
+    }
+    this.fire('nodeClick', node)
+  }
+
+  nodeExpand(node: TreeNode): void {
+    if (typeof node.expanded === 'object') {
+      node.expanded.value = true;
+    }
+    this.fire('nodeExp
```

**File**: `packages/omi-vueify/examples/simple/src/components/tree-component.vue` (added, +224/-0)
```diff
@@ -0,0 +1,224 @@
+<script setup lang="ts">
+import { ref } from 'vue';
+import { omiVueify } from '../../../../src/index';
+import './o-tree';
+import type { TreeNode } from './o-tree';
+
+// 使用omiVueify封装o-tree组件
+const OmiTree = omiVueify('o-tree', {
+  methodNames: ['nodeExpand', 'nodeCollapse', 'addNode', 'removeNode', 'updateNode', 'highlightNode']
+});
+
+// 树节点数据
+const treeData = ref<TreeNode[]>([
+  {
+    id: 1,
+    label: '一级节点 1',
+    expanded: true,
+    children: [
+      {
+        id: 11,
+        label: '二级节点 1-1',
+        children: [
+          {
+            id: 111,
+            label: '三级节点 1-1-1'
+          }
+        ]
+      },
+      {
+        id: 12,
+        label: '二级节点 1-2'
+      }
+    ]
+  },
+  {
+    id: 2,
+    label: '一级节点 2',
+    children: [
+      {
+        id: 21,
+        label: '二级节点 2-1'
+      },
+      {
+        id: 22,
+        label: '二级节点 2-2'
+      }
+    ]
+  }
+]);
+
+const treeRef = ref();
+
+const addNodeInput = ref('');
+const addLabelInput = ref('');
+const addPositionInput = ref('');
+
+function performAddNode() {
+  const parentId = addNodeInput.value ? parseInt(addNodeInput.value) : null;
+  const label = addLabelInput.value || 'New Node';
+  const position = addPositionInput.value ? parseInt(addPositionInput.value) : -1;
+
+  const newNode = { label };
+  treeRef.value.addNode(parentId, newNode, position);
+  addNodeInput.value = '';
+  addLabelInput.value = '';
+  addPositionInput.value = '';
+}
+
+const removeNodeInput = ref('');
+
+function performRemoveNode() {
+  const id = parseInt(removeNodeInput.value);
+  if (!isNaN(id)) {
+    treeRef.value.removeNode(id);
+  }
+  removeNodeInput.value = '';
+}
+
+const updateNodeInput = ref('');
+const updateLabelInput = ref('');
+
+function performUpdateNode() {
+  const id = parseInt(updateNodeInput.value);
+  const label = updateLabelInput.value;
+  if (!isNaN(id) && label) {
+    treeRef.value.updateNode(id, { label });
+  }
+  updateNodeInput.value = '';
+  updateLabelInput.value = '';
+}
+
+const findNodeInput = ref('');
+
+function performFindNode() {
+  const id = findNodeInput.value ? parseInt(findNodeInput.value) : null;
+  treeRef.value.highlightNode(id);
+}
+
+</script>
+
+<template>
+  <div class="tree-component">
+    <h3>树组件示例</h3>
+    <div class="container">
+      <div class="tree-container">
+        <OmiTree 
+          ref="treeRef"
+          :data="treeData"
+        >
+        </OmiTree>
+      </div>
+      <div class="operations">
+        <div class="form-group">
+          <h4>添加节点</h4>
+          <input v-model="addNodeInput" placeholder="Parent ID (null for root)" />
+          <input v-model="addLabelInput" placeholder="Label" />
+          <input v-model="addPositionInput" placeholder="Position (-1 for end)" />
+          <button @click="performAddNode">添加</button>
+        </div>
+
+        <div class="form-group">
+          <h4>删除节点</h4>
+          <input v-model="removeNodeInput" placeholder="Node ID" />
+          <button @click="performRemoveNode">删除</button>
+        </div>
+
+        <div class="form-group">
+          <h4>更新节点</h4>
+          <input v-model="updateNodeInput" placeholder="Node ID" />
+          <input v-model="updateLabelInput" placeholder="New Label" />
+          <button @click="performUpdateNode">更新</button>
+        </div>
+
+        <div class="form-group">
+          <h4>查找节点</h4>
+          <input v-model="findNodeInput" placeholder="Node ID" />
+          <button @click="performFindNode">查找</button>
+        </div>
+      </div>
+    </div>
+  </div>
+</template>
+
+<style scoped>
+.tree-component {
+  padding: 20px;
+  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
+  color: #333;
+}
+
+h3, .operations h4 {
+  margin-top: 0;
+  margin-bottom: 1em;
+  font-weight: 600;
+}
+
+.container {
+  display: flex;
+  gap: 30px;
+  align-items: flex-start;
+}
+
+.tree-container {
+  flex: 1;
+}
+
+.operations {
+  width: 200px;
+  display: flex;
+  flex-direction: column;
+  gap: 20px;
+}
+
+.form-group {
+  display: flex;
+  flex-direction: column;
+  gap: 8px;
+}
+
+.operations input,
+.operations button {
+  width: 100%;
+  padding: 8px;
+  border: 1px solid #ddd;
+  border-radius: 4px;
+  box-sizing: border-box;
+  font-size: 14px;
+}
+
+.operations button {
+  background-color: #f0f0f0;
+  border-color: #ccc;
+  cursor: pointer;
+  font-weight: 500;
+}
+.operations button:hover {
+  background-color: #e0e0e0;
+}
+
+.modal {
+  position: fixed;
+  inset: 0;
+  background: rgba(0, 0, 0, 0.5);
+  display: grid;
+  place-items: center;
+}
+.modal-content {
+  background: white;
+  padding: 20px 25px;
+  border-radius: 5px;
+  max-width: 500px;
+  width: calc(100% - 40px);
+}
+.modal-content button {
+    margin-top: 15px;
+}
+pre {
+  white-space: pre-wrap;
+  word-wrap: break-word;
+  background: #f7f7f7;
+  padding: 10px;
+  border-radius: 4px;
+}
+</style> 
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #1000** (2026-09-24): fix(omi-vueify): refresh Omi children after Vue slot updates (@dvd233)
- **PR #999** (closed): fix(omi-vueify): 避免复杂属性被深度代理 (@RSS1102)
- **PR #998** (closed): fix: 定义专属命名空间 OmiJSX, 避免全局污染JSX (@liweijie0812)
- **PR #996** (2026-01-10): [MVP]feat: 新增 omi-vue2ify 包，支持 Vue 2.7 的胶水层 (@zhangpaopao0609)
- **PR #995** (2025-12-18): feat: 从 tdesign-react/chatbot-agui 迁移 reactify (@LeonardoSya)
- **PR #994** (2025-09-02): fix(omi-vueify): event listener (@LzhengH)
- **PR #992** (2025-08-22): fix: 修复vueify中遇到reactive类型参数无法响应式的问题 (@LzhengH)
- **PR #991** (2025-07-29): feat: 补充 omi hooks 子模块单元测试 #961 (@xuecer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
