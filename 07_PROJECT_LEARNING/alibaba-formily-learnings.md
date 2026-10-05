# Forensic Learning Record (Deep Inspection): alibaba/formily

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-formily-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/formily](https://github.com/alibaba/formily))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:43.742Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/formily`
- **Description**: 📱🚀 🧩 Cross Device & High Performance Normal Form/Dynamic(JSON Schema) Form/Form Builder -- Support React/React Native/Vue 2/Vue 3
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12589 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/antd/src/__builtins__/hooks/index.ts`
```
export * from './useClickAway'
export * from './usePrefixCls'

```

### Core Architecture Module: `packages/antd/src/__builtins__/hooks/useClickAway.ts`
```
import { useRef, useEffect, MutableRefObject } from 'react'

const defaultEvent = 'click'

type EventType = MouseEvent | TouchEvent

type BasicTarget<T = HTMLElement> =
  | (() => T | null)
  | T
  | null
  | MutableRefObject<T | null | undefined>

type TargetElement = HTMLElement | Element | Document | Window

function getTargetElement(
  target?: BasicTarget<TargetElement>,
  defaultElement?: TargetElement
): TargetElement | undefined | null {
  if (!target) {
    return defaultElement
  }

  let targetElement: TargetElement | undefined | null

  if (typeof target === 'function') {
    targetElement = target()
  } else if ('current' in target) {
    targetElement = target.current
  } else {
    targetElement = target
  }

  return targetElement
}

export const useClickAway = (
  onClickAway: (event: EventType) => void,
  target: BasicTarget | BasicTarget[],
  eventName: string = defaultEvent
) => {
  const onClickAwayRef = useRef(onClickAway)
  onClickAwayRef.current = onClickAway

  useEffect(() => {
    const handler = (event: any) => {
      const targets = Array.isArray(target) ? target : [target]
      if (
        targets.some((targetItem) => {
          const targetElement = getTargetElement(targetItem) as HTMLElement
          return !targetElement || targetElement?.contains(event.target)
        })
      ) {
        return
      }
      onClickAwayRef.current(event)
    }

    document.addEventListener(eventName, handler)

    return () => {
      document.removeEventListener(eventName, handler)
    }
  }, [target, eventName])
}

```

### Core Architecture Module: `packages/antd/src/__builtins__/hooks/usePrefixCls.ts`
```
import { useContext } from 'react'
import { ConfigProvider } from 'antd'

export const usePrefixCls = (
  tag?: string,
  props?: {
    prefixCls?: string
  }
) => {
  if ('ConfigContext' in ConfigProvider) {
    const { getPrefixCls } = useContext(ConfigProvider.ConfigContext)
    return getPrefixCls(tag, props?.prefixCls)
  } else {
    const prefix = props?.prefixCls ?? 'ant-'
    return `${prefix}${tag ?? ''}`
  }
}

```

### Core Architecture Module: `packages/antd/src/__builtins__/render.ts`
```
import { ReactElement } from 'react'
import * as ReactDOM from 'react-dom'
import type { Root } from 'react-dom/client'

// 移植自rc-util: https://github.com/react-component/util/blob/master/src/React/render.ts

type CreateRoot = (container: ContainerType) => Root

// Let compiler not to search module usage
const fullClone = {
  ...ReactDOM,
} as typeof ReactDOM & {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
    usingClientEntryPoint?: boolean
  }
  createRoot?: CreateRoot
}

const { version, render: reactRender, unmountComponentAtNode } = fullClone

let createRoot: CreateRoot
try {
  const mainVersion = Number((version || '').split('.')[0])
  if (mainVersion >= 18 && fullClone.createRoot) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    createRoot = fullClone.createRoot
  }
} catch (e) {
  // Do nothing;
}

function toggleWarning(skip: boolean) {
  const { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED } = fullClone

  if (
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED &&
    typeof __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED === 'object'
  ) {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.usingClientEntryPoint =
      skip
  }
}

const MARK = '__antd_mobile_root__'

// ========================== Render ==========================
type ContainerType = (Element | DocumentFragment) & {
  [MARK]?: Root
}

function legacyRender(node: ReactElement, container: ContainerType) {
  reactRender(node, container)
}

function concurrentRender(node: ReactElement, container: ContainerType) {
  toggleWarning(true)
  const root = container[MARK] || createRoot(container)
  toggleWarning(false)
  root.render(node)
  container[MARK] = root
}

export function render(node: ReactElement, container: ContainerType) {
  if (createRoot as unknown) {
    concurrentRender(node, container)
    return
  }
  legacyRender(node, container)
}

// ========================== Unmount =========================
function legacyUnmount(container: ContainerType) {
  return unmountComponentAtNode(container)
}

async function concurrentUnmount(container: ContainerType) {
  // Delay to unmount to avoid React 18 sync warning
  return Promise.resolve().then(() => {
    container[MARK]?.unmount()
    delete container[MARK]
  })
}

export function unmount(container: ContainerType) {
  if (createRoot as unknown) {
    return concurrentUnmount(container)
  }

  return legacyUnmount(container)
}
```

### Core Architecture Module: `packages/antd/src/select-table/utils.ts`
```
import { isArr, isFn } from '@formily/shared'
import { useFlatOptions } from './useFlatOptions'

/**
 * 获取树列表某个键值的集合
 * @param tree 树列表
 * @param primaryKey 键名称
 * @returns 键值数组集合
 */
const getTreeKeys = (tree: any[], primaryKey: string) =>
  isArr(tree)
    ? tree.reduce((prev, current) => {
        if (current?.disabled) {
          return prev
        }
        return [
          ...prev,
          current[primaryKey],
          ...getTreeKeys(current?.children, primaryKey),
        ]
      }, [])
    : []

/**
 * 判断树列表中是否有任一 key 被选中
 * @param tree 树列表
 * @param selected 已选中的 keys
 * @param primaryKey 键名
 * @returns
 */
const hasSelectedKey = (tree: any[], selected: any[], primaryKey: string) => {
  const keys = getTreeKeys(tree, primaryKey)
  const mergedKeys = [...keys, ...selected]
  const validKeys = [...new Set(mergedKeys)]
  return validKeys.length !== mergedKeys.length
}

/**
 * 判断列表项是否全部被选中
 * @param list 一阶列表
 * @param selected 当前选中的字段值集合
 * @param primaryKey 键名称
 * @returns 是否全部被选中
 */
const isAllSelected = (list: any[], selected: any[], primaryKey: string) => {
  const validList = list.filter((item) => !item?.disabled)
  const selectedList = validList.filter((item) =>
    selected?.includes(item[primaryKey])
  )
  return selectedList.length === validList.length
}

/**
 * 完善TableUI Keys（添加选中所有子元素的父元素，或移除未选中所有子元素的父元素）
 * @param flatDataSource 完整数据平铺列表
 * @param selected 当前选中的字段值集合
 * @param primaryKey 键名称
 * @returns 完整的字段值集合
 */
const completedKeys = (
  flatDataSource: any[] = [],
  selected: any[],
  primaryKey: string
) => {
  let allSelectedKeys = [...selected]
  flatDataSource.forEach((item) => {
    if (item.children?.length) {
      // 优先递归子元素
      allSelectedKeys = completedKeys(
        item.children,
        allSelectedKeys,
        primaryKey
      )
      if (isAllSelected(item.children, allSelectedKeys, primaryKey)) {
        // 如果该元素的子元素全部选中，且该元素未禁用，则也选中该项（即包含全选子元素的父元素）
        if (!item?.disabled) {
          allSelectedKeys = [...new Set([...allSelectedKeys, item[primaryKey]])]
        }
      } else {
        // 如果该元素的子元素未全部选中，则移除该项
        allSelectedKeys = allSelectedKeys.filter(
          (key) => key !== item[primaryKey]
        )
      }
    }
  })
  return allSelectedKeys
}

/**
 * 获取数列表中被选中的有效路径
 * @param tree 数列表
 * @param selected 当前选中的字段值集合
 * @param primaryKey 键名称
 * @returns 有效的树路径
 */
const getSelectedPath = (tree = [], selected, primaryKey) => {
  const pathData = []

  tree.forEach((item) => {
    const validChildren = getSelectedPath(item.children, selected, primaryKey)
    if (validChildren.length || selected?.includes(item[primaryKey])) {
      pathData.push({
        ...item,
        ...(validChildren.length ? { children: validChildren } : {}),
      })
    }
  })

  return pathData
}

/**
 * 删除树列表的某个 key/value 键值对
 * @param tree
 * @param key
 * @returns
 */
const deleteTreeItem = (tree: any[], key: string) =>
  tree.map((item) => {
    const validItem = { ...item }
    delete validItem[key]
    if (validItem.children?.length) {
      validItem.children = deleteTreeItem(validItem.children, key)
    }
    return validItem
  })

/**
 * 根据 valueType 获取最终输出值
 * @param keys 当前选中的 key 集合（all完整类型）
 * @param records 当前选中的 option 集合
 * @param dataSource 数据源集合
 * @param primaryKey 键名
 * @param originalValueType 值输出类型
 * @param originalOptionAsValue
 * @param mode
 * @param checkStrictly
 * @returns 最终输出的 keys 和 options
 */
const getOutputData = (
  keys, // selected
  options,
  dataSource,
  primaryKey,
  originalValueType,
  originalOptionAsValue,
  mode,
  checkStrictly
) => {
  const valueType = checkStrictly !== false ? 'all' : originalValueType // valueType 在 Strictly 为 false 时生效
  const optionAsValue = valueType === 'path' ? false : originalOptionAsValue // optionAsValue 在 path 模式不生效
  let outputValue = []
  let outputOptions = []

  if (valueType === 'parent') {
    // 移除所有选中值的子值
    let childrenKeys = []
    options.forEach((option) => {
      childrenKeys = [
        ...childrenKeys,
        ...getTreeKeys(option.children, primaryKey),
      ]
    })
    outputValue = keys.filter((key) => !childrenKeys.includes(key))
    outputOptions = options.filter((options) =>
      outputValue.includes(options[primaryKey])
    )
  } else if (valueType === 'child') {
    outputValue = [...keys]
    outputOptions = [...options]
    outputOptions.forEach((option) => {
      // 移除当前有子值被选中的父值
      if (hasSelectedKey(option.children, keys, primaryKey)) {
        outputValue = outputValue.filter((key) => key !== option[primaryKey])
        outputOptions = outputOptions.filter(
          (options) => options[primaryKey] !== option[primaryKey]
        )
      }
    })
  } else if (valueType === 'path') {
    outputValue = getSelectedPath(dataSource, keys, primaryKey)
    outputOptions = [...options]
  } else {
    // valueType === 'all'
    outputValue = [...keys]
    outputOptions = [...options]
  }

  outputOptions = deleteTreeItem(outputOptions, '__formily_key__')
  outputValue =
    optionAsValue && valueType !== 'path' ? outputOptions : outputValue
  if (mode === 'single') {
    outputValue = outputValue[0]
    outputOptions = outputOptions[0]
  }

  return { outputValue, outputOptions }
}

/**
 * 根据 valueType 获取 TableUI 显示值
 * @param keys 回填的数据（输出的）keys 集合
 * @param flatDataSource 平铺的数据源集合
 * @param primaryKey 键名称
 * @param originalValueType 值输出类型
 * @param originalOptionAsValue
 * @param mode
 * @param checkStrictly
 * @param rowKey
 * @returns [] TableUI keys 集合
 */
const getUISelected = (
  value,
  flatDataSource,
  primaryKey,
  originalValueType,
  originalOptionAsValue,
  mode,
  checkStrictly,
  rowKey
) => {
  const valueType = checkStrictly !== false ? 'all' : originalValueType // valueType 在 Strictly 为 false 时生效
  const optionAsValue = valueType === 'path' ? false : originalOptionAsValue // optionAsValue 在 path 模式不生效

  let keys = mode === 'single' ? [value] : isArr(value) ? value : []
  keys =
    optionAsValue && valueType !== 'path'
      ? keys.map((record: any) =>
          isFn(rowKey) ? rowKey(record) : record?.[primaryKey]
        )
      : keys

  let newKeys = []
  if (valueType === 'parent') {
    const options = flatDataSource.filter((item) =>
      keys.includes(item[primaryKey])
    )
    let childrenKeys = []
    options.forEach((option) => {
      childrenKeys = [
        ...childrenKeys,
        ...getTreeKeys(option.children, primaryKey),
      ]
    })
    newKeys = [...new Set([...keys, ...childrenKeys])]
  } else if (valueType === 'child') {
    newKeys = completedKeys(flatDataSource, keys, primaryKey)
  } else if (valueType === 'path') {
    const pathKeys = useFlatOptions(keys).map((item) => item[primaryKey])
    newKeys = completedKeys(flatDataSource, pathKeys, primaryKey)
  } else {
    // valueType === 'all'
    newKeys = [...keys]
  }

  return newKeys
}

/**
 * 获取兼容筛选模式下是否全部选中子元素
 * @param selected 已选中项
 * @param dataSource 当前数据结构
 * @param usableKeys 当前数据结构的可执行项
 * @param checkStrictly
 * @param primaryKey
 * @returns 是否全部选中
 */
const getCompatibleAllSelected = (
  selected,
  dataSource,
  usableKeys,
  checkStrictly,
  primaryKey
) => {
  if (!usableKeys.length) {
    return false
  }
  // 当前模式下已选中的项
  const currentSelected = selected.filter((item) => usableKeys.includes(item))
  // 获取有效选中（父子模式或非父子模式）
  const validSelected =
    checkStrictly !== false
      ? currentSelected // 非父子模式选中项
      : completedKeys(dataSource, currentSelected, primaryKey) // 父子模式选中项
  // 有效选中项数量等于可执行项数量则全部选中子元素
  return validSelected.length === usableKeys.length
}

export {
  hasSelectedKey,
  getTreeKeys,
  deleteTreeItem,
  isAllSelected,
  getUISelected,
  getOutputData,
  completedKeys,
  getCompatibleAllSelected,
}

```

### Core Architecture Module: `packages/core/.umirc.js`
```
import { resolve } from 'path'
export default {
  mode: 'site',
  logo: 'https://img.alicdn.com/imgextra/i2/O1CN01Kq3OHU1fph6LGqjIz_!!6000000004056-55-tps-1141-150.svg',
  title: 'Core',
  hash: true,
  favicon:
    'https://img.alicdn.com/imgextra/i3/O1CN01XtT3Tv1Wd1b5hNVKy_!!6000000002810-55-tps-360-360.svg',
  outputPath: './doc-site',
  navs: {
    'en-US': [
      {
        title: 'Guide',
        path: '/guide',
      },
      {
        title: 'API',
        path: '/api',
      },
      {
        title: 'Home Site',
        path: 'https://formilyjs.org',
      },
      {
        title: 'GITHUB',
        path: 'https://github.com/alibaba/formily',
      },
    ],
    'zh-CN': [
      {
        title: '指南',
        path: '/zh-CN/guide',
      },
      {
        title: 'API',
        path: '/zh-CN/api',
      },
      {
        title: '主站',
        path: 'https://formilyjs.org',
      },
      {
        title: 'GITHUB',
        path: 'https://github.com/alibaba/formily',
      },
    ],
  },
  headScripts: [
    `
    function loadAd(){
      var header = document.querySelector('.__dumi-default-layout-content .markdown h1')
      if(header && !header.querySelector('#_carbonads_js')){
        var script = document.createElement('script')
        script.src = '//cdn.carbonads.com/carbon.js?serve=CEAICK3M&placement=formilyjsorg'
        script.id = '_carbonads_js'
        script.classList.add('head-ad')
        header.appendChild(script)
      }
    }
    var request = null
    var observer = new MutationObserver(function(){
      cancelIdleCallback(request)
      request = requestIdleCallback(loadAd)
    })
    document.addEventListener('DOMContentLoaded',function(){
      loadAd()
      observer.observe(
        document.body,
        {
          childList:true,
          subtree:true
        }
      )
    })
    `,
  ],
  styles: [
    `.__dumi-default-navbar-logo{
      background-size: 140px!important;
      background-position: center left!important;
      background-repeat: no-repeat!important;
      padding-left: 150px!important;/*可根据title的宽度调整*/
      font-size: 22px!important;
      color: #000!important;
      font-weight: lighter!important;
    }
    .__dumi-default-navbar{
      padding: 0 28px !important;
    }
    .__dumi-default-layout-hero{
      background-image: url(//img.alicdn.com/imgextra/i4/O1CN01ZcvS4e26XMsdsCkf9_!!6000000007671-2-tps-6001-4001.png);
      background-size: cover;
      background-repeat: no-repeat;
      padding: 120px 0 !important;
    }
    .__dumi-default-layout-hero h1{
      color:#45124e !important;
      font-size:80px !important;
      padding-bottom: 30px !important;
    }
    .__dumi-default-dark-switch {
      display:none
    }
    nav a{
      text-decoration: none !important;
    }
    #carbonads * {
      margin: initial;
      padding: initial;
    }
    #carbonads {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial,
        sans-serif;
    }
    #carbonads {
      display: flex;
      max-width: 330px;
      background-color: hsl(0, 0%, 98%);
      box-shadow: 0 1px 4px 1px hsla(0, 0%, 0%, 0.1);
      z-index: 100;
      float:right;
    }
    #carbonads a {
      color: inherit;
      text-decoration: none;
    }
    #carbonads a:hover {
      color: inherit;
    }
    #carbonads span {
      position: relative;
      display: block;
      overflow: hidden;
    }
    #carbonads .carbon-wrap {
      display: flex;
    }
    #carbonads .carbon-img {
      display: block;
      margin: 0;
      line-height: 1;
    }
    #carbonads .carbon-img img {
      display: block;
    }
    #carbonads .carbon-text {
      font-size: 13px;
      padding: 10px;
      margin-bottom: 16px;
      line-height: 1.5;
      text-align: left;
    }
    #carbonads .carbon-poweredby {
      display: block;
      padding: 6px 8px;
      background: #f1f1f2;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      font-size: 8px;
      line-height: 1;
      border-top-left-radius: 3px;
      position: absolute;
      bottom: 0;
      right: 0;
    }
    `,
  ],
  menus: {
    '/guide': [
      {
        title: 'Introduction',
        children: [
          {
            title: 'Introduction',
            path: '/guide',
          },
          { title: 'Architecture', path: '/guide/architecture' },
        ],
      },
      {
        title: 'Concept',
        children: [
          {
            title: 'MVVM',
            path: '/guide/mvvm',
          },
          {
            title: 'Form Model',
            path: '/guide/form',
          },
          {
            title: 'Field Model',
            path: '/guide/field',
          },
        ],
      },
    ],

    '/zh-CN/guide': [
      {
        title: '概览',
        children: [
          {
            title: '介绍',
            path: '/zh-CN/guide',
          },
          { title: '核心架构', path: '/zh-CN/guide/architecture' },
        ],
      },
      {
        title: '概念',
        children: [
          {
            title: 'MVVM',
            path: '/zh-CN/guide/mvvm',
          },
          {
            title: '表单模型',
            path: '/zh-CN/guide/form',
          },
          {
            title: '字段模型',
            path: '/zh-CN/guide/field',
          },
        ],
      },
    ],
  },
}

```

### Core Architecture Module: `packages/core/rollup.config.js`
```
import baseConfig from '../../scripts/rollup.base.js'

export default baseConfig('formily.core', 'Formily.Core')

```

### Core Architecture Module: `packages/core/src/effects/index.ts`
```
export * from './onFormEffects'
export * from './onFieldEffects'

```

### Core Architecture Module: `packages/core/src/effects/onFieldEffects.ts`
```
import { FormPath, isFn, toArr } from '@formily/shared'
import { autorun, reaction, batch } from '@formily/reactive'
import { Form } from '../models'
import {
  LifeCycleTypes,
  FormPathPattern,
  GeneralField,
  DataField,
  IFieldState,
} from '../types'
import { createEffectHook, useEffectForm } from '../shared/effective'

function createFieldEffect<Result extends GeneralField = GeneralField>(
  type: LifeCycleTypes
) {
  return createEffectHook(
    type,
    (field: Result, form: Form) =>
      (
        pattern: FormPathPattern,
        callback: (field: Result, form: Form) => void
      ) => {
        if (
          FormPath.parse(pattern).matchAliasGroup(field.address, field.path)
        ) {
          batch(() => {
            callback(field, form)
          })
        }
      }
  )
}
const _onFieldInit = createFieldEffect(LifeCycleTypes.ON_FIELD_INIT)
export const onFieldMount = createFieldEffect(LifeCycleTypes.ON_FIELD_MOUNT)
export const onFieldUnmount = createFieldEffect(LifeCycleTypes.ON_FIELD_UNMOUNT)
export const onFieldValueChange = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALUE_CHANGE
)
export const onFieldInitialValueChange = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_INITIAL_VALUE_CHANGE
)
export const onFieldInputValueChange = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_INPUT_VALUE_CHANGE
)
export const onFieldValidateStart = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALIDATE_START
)
export const onFieldValidateEnd = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALIDATE_END
)
export const onFieldValidating = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALIDATING
)
export const onFieldValidateFailed = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALIDATE_FAILED
)
export const onFieldValidateSuccess = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_VALIDATE_SUCCESS
)
export const onFieldSubmit = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT
)
export const onFieldSubmitStart = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_START
)
export const onFieldSubmitEnd = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_END
)
export const onFieldSubmitValidateStart = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_VALIDATE_START
)
export const onFieldSubmitValidateEnd = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_VALIDATE_END
)
export const onFieldSubmitSuccess = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_SUCCESS
)
export const onFieldSubmitFailed = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_FAILED
)
export const onFieldSubmitValidateSuccess = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_VALIDATE_SUCCESS
)
export const onFieldSubmitValidateFailed = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_SUBMIT_VALIDATE_FAILED
)
export const onFieldReset = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_RESET
)
export const onFieldLoading = createFieldEffect<DataField>(
  LifeCycleTypes.ON_FIELD_LOADING
)

export function onFieldInit(
  pattern: FormPathPattern,
  callback?: (field: GeneralField, form: Form) => void
) {
  const form = useEffectForm()
  const count = form.query(pattern).reduce((count, field) => {
    callback(field, form)
    return count + 1
  }, 0)
  if (count === 0) {
    _onFieldInit(pattern, callback)
  }
}

export function onFieldReact(
  pattern: FormPathPattern,
  callback?: (field: GeneralField, form: Form) => void
) {
  onFieldInit(pattern, (field, form) => {
    field.disposers.push(
      autorun(() => {
        if (isFn(callback)) callback(field, form)
      })
    )
  })
}
export function onFieldChange(
  pattern: FormPathPattern,
  callback?: (field: GeneralField, form: Form) => void
): void
export function onFieldChange(
  pattern: FormPathPattern,
  watches: (keyof IFieldState)[],
  callback?: (field: GeneralField, form: Form) => void
): void
export function onFieldChange(
  pattern: FormPathPattern,
  watches: any,
  callback?: (field: GeneralField, form: Form) => void
): void {
  if (isFn(watches)) {
    callback = watches
    watches = ['value']
  } else {
    watches = watches || ['value']
  }
  onFieldInit(pattern, (field, form) => {
    if (isFn(callback)) callback(field, form)
    const dispose = reaction(
      () => {
        return toArr(watches).map((key) => {
          return field[key]
        })
      },
      () => {
        if (isFn(callback)) callback(field, form)
      }
    )
    field.disposers.push(dispose)
  })
}

```

### Core Architecture Module: `packages/core/src/effects/onFormEffects.ts`
```
import { isFn } from '@formily/shared'
import { autorun, batch } from '@formily/reactive'
import { Form } from '../models'
import { LifeCycleTypes } from '../types'
import { createEffectHook } from '../shared/effective'

function createFormEffect(type: LifeCycleTypes) {
  return createEffectHook(
    type,
    (form: Form) => (callback: (form: Form) => void) => {
      batch(() => {
        callback(form)
      })
    }
  )
}

export const onFormInit = createFormEffect(LifeCycleTypes.ON_FORM_INIT)
export const onFormMount = createFormEffect(LifeCycleTypes.ON_FORM_MOUNT)
export const onFormUnmount = createFormEffect(LifeCycleTypes.ON_FORM_UNMOUNT)
export const onFormValuesChange = createFormEffect(
  LifeCycleTypes.ON_FORM_VALUES_CHANGE
)
export const onFormInitialValuesChange = createFormEffect(
  LifeCycleTypes.ON_FORM_INITIAL_VALUES_CHANGE
)
export const onFormInputChange = createFormEffect(
  LifeCycleTypes.ON_FORM_INPUT_CHANGE
)
export const onFormSubmit = createFormEffect(LifeCycleTypes.ON_FORM_SUBMIT)
export const onFormReset = createFormEffect(LifeCycleTypes.ON_FORM_RESET)
export const onFormSubmitStart = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_START
)
export const onFormSubmitEnd = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_END
)
export const onFormSubmitSuccess = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_SUCCESS
)
export const onFormSubmitFailed = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_FAILED
)
export const onFormSubmitValidateStart = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_START
)
export const onFormSubmitValidateSuccess = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_SUCCESS
)
export const onFormSubmitValidateFailed = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_FAILED
)
export const onFormSubmitValidateEnd = createFormEffect(
  LifeCycleTypes.ON_FORM_SUBMIT_VALIDATE_END
)
export const onFormValidateStart = createFormEffect(
  LifeCycleTypes.ON_FORM_VALIDATE_START
)
export const onFormValidateSuccess = createFormEffect(
  LifeCycleTypes.ON_FORM_VALIDATE_SUCCESS
)
export const onFormValidateFailed = createFormEffect(
  LifeCycleTypes.ON_FORM_VALIDATE_FAILED
)
export const onFormValidateEnd = createFormEffect(
  LifeCycleTypes.ON_FORM_VALIDATE_END
)
export const onFormGraphChange = createFormEffect(
  LifeCycleTypes.ON_FORM_GRAPH_CHANGE
)
export const onFormLoading = createFormEffect(LifeCycleTypes.ON_FORM_LOADING)
export function onFormReact(callback?: (form: Form) => void) {
  let dispose = null
  onFormInit((form) => {
    dispose = autorun(() => {
      if (isFn(callback)) callback(form)
    })
  })
  onFormUnmount(() => {
    dispose()
  })
}

```

### Core Architecture Module: `packages/core/src/global.d.ts`
```
import * as Types from './types'
import * as Models from './models'

declare global {
  namespace Formily.Core {
    export { Types, Models }
  }
}

```

### Core Architecture Module: `packages/core/src/index.ts`
```
export * from './shared/externals'
export * from './models/types'
export * from './effects'
export * from './types'

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3989** (2023-10-18): **[Bug Report] @formily/antd中FormItem的label重复了，官网也是**
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/c44mdh)  ### Steps to reproduce formily官网的demo任何一个带有FormItem的label都是重复  ### What is expected? label不重复  ### What is actually happening? label重复  ### Package @formily/antd@2.2.29  ---    <!-- generated by formily-issue-helper. DO NOT REMOVE --> 

- **Issue #3941** (2023-10-18): **[Bug Report]  Incorrect mounted Property State in Array Items After Removal**
  *Symptoms*: - [x] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/array-delete-issue-vy55s8?file=/App.tsx)  ### Steps to reproduce 1. Remove an item from the array. 2. Observe the mounted property of the remaining array items.  ![array-problem](https://github.com/alibaba/formily/assets/4041334/5948ea6a-9127-4092-a3ce-1bcd08898ac6)  ### What is expected? After removing an item from the array, the mounted property of the remaining items should remain `true`.  ### What is actually happening? After removing an item from the array, the mounted property of the remaining items incorrectly becomes `false`.  ### Package @formily/core@2.2.29  ---  This issue impacts the accurate tracking of the mounted state of array items, potentially leading to incorrect behaviours or rendering inconsistencies in complex forms.  <!-- generated by formily-issue-helper. DO NOT REMOVE --> 
  **Post-Mortem & Fix Analysis**:
  > ~~补充一个 jest 测试用例, 很奇怪, 跟 demo 表现并不一致~~  破案了, 在上述demo中,  line: 44-48  ```jsx   {props.value?.map((item, index) => {     return (       <div key={index} style={{ marginBottom: 10, display: "flex" }}>         <RecursionField name={index} schema={schema.items} />         <button onClick={() => field.remove(index)}>Delete</button>       </div>     );   })} ```  这里的数组 key 给了个 index, 事件经过如下  1. 删除第二条数据 remove(1), 经过下面一系列方法调用, 最终触发了 field.dispose 方法调用链: (packages/core) ArrayField.ts#remove -> internals.ts#spliceArrayState -> internals.ts#patchFieldStates -> internals.ts#destroy -> field?.dispose(); 这几个响应式数据模型操作没有任何问题 2. **在 react 环境下**, mouted 状态是 `packages/react/hooks/useAttach.ts` -> `onMount/onUnmount` 来修改的, 而 `index` 作为列表项的 `key` 这个 [经典问题](https://legacy.reactjs.org/docs/lists-and-keys.html#keys), 又在这里得到了验证: 第二条数据删除触发了 `unMount`, 但第三条来补位并没有触发 `onMount` 这里就不展开了(~~因为我也不太明白~~) 3. 在 jest 环境中, mount 则是通过 内部的 `packages/core/src/__test__/shared.ts` 简单的手动执行, 所以在 jest 环境中没有复现 ``

- **Issue #3937** (2023-09-21): **[Bug Report] [@formily/antd-v5][ArrayTable] 内部Input的校验信息浮层的zIndex不正确**
  *Symptoms*: - [x] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/formily-antdv5-preview-text-forked-jxwdxq)  ### Steps to reproduce 在复现链接中：  1. 点击Addition添加几项 2. 点击提交触发验证  ### What is expected? 在输入框未被聚焦时，校验信息浮层应当显示在输入框之上  ### What is actually happening? 校验信息浮层时刻被输入框遮盖  ### Package @formily/antd-v5@1.1.1  ---  不受antd版本影响，仅在特定的@formily/antd-v5版本中出现。（如1.0.1-rc.2就没有这个问题）  <!-- generated by formily-issue-helper. DO NOT REMOVE --> 
  **Post-Mortem & Fix Analysis**:
  > 而且fixed的column也不好用了，固定不了，可能跟这个有关。
  > element也发现类似问题
  > 已修复https://github.com/formilyjs/antd/pull/26

- **Issue #3932** (2023-10-17): **[Bug Report] ArrayField method will throw error and break **
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/loving-wind-ylyc4y?file=/App.tsx)  ### Steps to reproduce 第一步：加载10w数据 第二步：点到最后一页 第三步：点回第一页点击下面Insert键，就会崩溃    ### What is expected? 无论怎么翻页，调用ArrayField的method可以正常的添加数据  ### What is actually happening? 跳过中间的页面翻页，会导致前面的页面添加数据失败  ### Package @formily/core@2.2.29  ---  数据的量不重要，中间跳过的页面没有加载过可能是导致错误的原因 if (field.match(_this.pattern))  这里报错 TypeError: Cannot read properties of undefined (reading 'match')  var Query = /** @class */function () {   function Query(props) {     var _this = this;     this.addresses = [];     this.pattern = _formily_shared__WEBPACK_IMPORTED_MODULE_0__.FormPath.parse(props.pattern, props.base);     this.form = props.form;     if (!this.pattern.isMatchPattern) {       var matched = takeMatchPattern(this.form, this.pattern.haveRelativePattern ? (0,_shared_internals__WEBPACK_IMPORTED_MODULE_1__.buildDataPath)(props.form.fields, this.pattern) : this.pattern);       if (matched) {         this.addresses = [matched];       }     } else {       (0,_formily_shared__WEBPACK_IMPORTED_MODULE_0__.each)(this.form.fields, function (field, address) {         if (field.match(_this.pattern)) {           _this.addresses.push(address);         }       });     }   }   Q

- **Issue #3931** (2023-10-06): **[Bug Report] FormDialog组件 每次调用FormDialog函数创建新的Dialog，关闭销毁时，并没有把创建的Dialog元素从body中移除**
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/vibrant-sanne-3cxgps?file=%2FDialogForm.vue%3A41%2C58-41%2C74)  ### Steps to reproduce 1.打开官网链接  https://element.formilyjs.org/guide/form-dialog.html#markup-schema-%E6%A1%88%E4%BE%8B   或者上面的链接  2. 点击3次打开表单按钮  3. f12进入调试控制台，会发现body下会插入3个类名el-dialog__wrapper formily-element-form-dialog的div块元素   ### What is expected? 1. 关闭dialog弹窗时，希望把多余的dom元素从body下移除  ### What is actually happening? 1. 每次打开关闭弹窗后，body下多一个dialog弹窗dom  ### Package @formily/element@2.2.22  ---  原因:  部分源代码  ```js env.instance.$mount(env.root) ``` env.root 是创建的空div元素，instance实例安装到env.root后，仅仅把env.instance的$el元素挂载到body下，最后关闭时 ```js onClosed: () => {       props.onClosed?.()       env.instance.$destroy()       env.instance = null       env.root?.parentNode?.removeChild(env.root)       env.root = undefined     }, ``` 移除的仅仅是当时创建的空div元素。  解决方案:  ```js env.instance.$mount(env.root) env.root = env.instance.$el  ``` 可以加一句赋值语句，关闭时就能移除弹窗dom元素。   以上想法，仅供参考，希望官网可以关注下，虽然不是什么bug,但是每次打开关闭，就会有多余的dom，还是很不愉快。  <!-- generated by formily-issue-helper. DO NOT REMOVE --> 
  **Post-Mortem & Fix Analysis**:
  > 可以提一个 PR 吗？真的感谢🙏

- **Issue #3930** (2023-10-06): **[Bug Report] FormDialog组件 cancelButtonProps 属性设置不生效**
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/vibrant-sanne-3cxgps?file=%2FDialogForm.vue%3A41%2C58-41%2C74)  ### Steps to reproduce 1.打卡链接  https://codesandbox.io/p/sandbox/vibrant-sanne-3cxgps?file=%2FDialogForm.vue%3A41%2C58-41%2C74  2. 点击打开表单按钮  3. 取消按钮设置的属性不生效  ### What is expected? 1. 使用 cancelButtonProps: {             disabled: true,             size: "small",           } 属性，能使取消按钮生效  ### What is actually happening? 取消按钮未生效  ### Package @formily/element@2.2.22  ---  原因: 传入的cancelButtonProps是引用类型，创建 Button 组件实例时，Vue内部可能对其进行了属性操作。导致render重新渲染时 cancelButtonProps 就变成的空对象，所以不生效。  1. 源代码 ```js h(   Button,   {     attrs: cancelButtonProps,     on: {       click: (e) => {         onCancel?.(e);         reject();       },     },   },   {     default: () =>       resolveComponent(cancelText || t("el.popconfirm.cancelButtonText")),   } ); ```  可以把cancelButtonProps 进行浅拷贝传入  ```js h(   Button,   {     attrs: {       ...cancelButtonProps,     },     on: {       click: (e) => {         onCancel?.(e);         reject();       },     },   },   {     default: () =>       resolveComponent(cancelText || t("el.popconfirm.cancelButtonText")),   } ); ```  以上原因仅供参考，希望官网可以解决  <!-- generated by f

- **Issue #3221** (2022-06-26): **[Bug Report] ArrayItems下使用onFieldReact订阅联动，会因为重复添加、删除操作，导致副作用重复收集、执行**
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/bold-tesla-7vniy6?file=/App.tsx)  ### Steps to reproduce 1. 多次操作添加、删除子项  2. 查看log日志，发现副作用累积执行  ### What is expected? 每个子项的对应联动只执行一次  ### What is actually happening? 回调累积执行  ### Package @formily/antd@2.1.6  ---    <!-- generated by formily-issue-helper. DO NOT REMOVE --> 

- **Issue #3219** (2022-06-26): **[Bug Report] update react18 formily not work**
  *Symptoms*: - [ ] I have searched the [issues](https://github.com/alibaba/formily/issues) of this repository and believe that this is not a duplicate.  ### Reproduction link [![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/late-mountain-359j2d?file=/src/index.js)  ### Steps to reproduce 1. click add button  ### What is expected? click add data show correct  ### What is actually happening? show input add other button  ### Package @formily/core@2.1.6  ---    <!-- generated by formily-issue-helper. DO NOT REMOVE --> 
  **Post-Mortem & Fix Analysis**:
  > +1;

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

### Incident Patch 1: `d9a46442` (2025-06-21)
**Commit Message**: Revert "fix(json-schema): schema 的 title 等属性在 react19 production 环境中无法传递组件 close #4307 (#4308)"

This reverts commit 2a474a6d32b685b3a4721bfee4964ae6d0c747d7.

**File**: `packages/json-schema/src/__tests__/shared.spec.ts` (modified, +0/-7)
```diff
@@ -1,17 +1,10 @@
 import { isNoNeedCompileObject, createDataSource } from '../shared'
 import { observable } from '@formily/reactive'
 import { Schema } from '../schema'
-import React from 'react'
 
 test('isNoNeedCompileObject', () => {
-  function Test() {
-    return null
-  }
   expect(isNoNeedCompileObject({})).toBeFalsy()
   expect(isNoNeedCompileObject({ $$typeof: null, _owner: null })).toBeTruthy()
-  expect(
-    isNoNeedCompileObject(React.createElement(Test, {}, null))
-  ).toBeTruthy()
   expect(isNoNeedCompileObject({ _isAMomentObject: true })).toBeTruthy()
   expect(
     isNoNeedCompileObject({ [Symbol.for('__REVA_ACTIONS')]: true })
```

**File**: `packages/json-schema/src/shared.ts` (modified, +2/-10)
```diff
@@ -1,12 +1,4 @@
-import {
-  isFn,
-  each,
-  isPlainObj,
-  isArr,
-  toArr,
-  FormPath,
-  isReactElement,
-} from '@formily/shared'
+import { isFn, each, isPlainObj, isArr, toArr, FormPath } from '@formily/shared'
 import { isObservable, untracked } from '@formily/reactive'
 import { Schema } from './schema'
 import { ISchema } from './types'
@@ -158,7 +150,7 @@ export const traverseSchema = (
 }
 
 export const isNoNeedCompileObject = (source: any) => {
-  if (isReactElement(source)) {
+  if ('$$typeof' in source && '_owner' in source) {
     return true
   }
   if (source['_isAMomentObject']) {
```

**File**: `packages/shared/src/checkers.ts` (modified, +2/-9)
```diff
@@ -21,15 +21,8 @@ export const isNumberLike = (index: any): index is number =>
   isNum(index) || /^\d+$/.test(index)
 export const isObj = (val: unknown): val is object => typeof val === 'object'
 export const isRegExp = isType<RegExp>('RegExp')
-export const isReactElement = (obj: any): boolean => {
-  // react19 production 环境中没有 _owner 属性
-  return (
-    isPlainObj(obj) &&
-    '$$typeof' in obj &&
-    ('_owner' in obj || isFn(obj['type']))
-  )
-}
-
+export const isReactElement = (obj: any): boolean =>
+  obj && obj['$$typeof'] && obj['_owner']
 export const isHTMLElement = (target: any): target is EventTarget => {
   return Object.prototype.toString.call(target).indexOf('HTML') > -1
 }
```

---

### Incident Patch 2: `2a474a6d` (2025-06-05)
**Commit Message**: fix(json-schema): schema 的 title 等属性在 react19 production 环境中无法传递组件 close #4307 (#4308)

**File**: `packages/json-schema/src/__tests__/shared.spec.ts` (modified, +7/-0)
```diff
@@ -1,10 +1,17 @@
 import { isNoNeedCompileObject, createDataSource } from '../shared'
 import { observable } from '@formily/reactive'
 import { Schema } from '../schema'
+import React from 'react'
 
 test('isNoNeedCompileObject', () => {
+  function Test() {
+    return null
+  }
   expect(isNoNeedCompileObject({})).toBeFalsy()
   expect(isNoNeedCompileObject({ $$typeof: null, _owner: null })).toBeTruthy()
+  expect(
+    isNoNeedCompileObject(React.createElement(Test, {}, null))
+  ).toBeTruthy()
   expect(isNoNeedCompileObject({ _isAMomentObject: true })).toBeTruthy()
   expect(
     isNoNeedCompileObject({ [Symbol.for('__REVA_ACTIONS')]: true })
```

**File**: `packages/json-schema/src/shared.ts` (modified, +10/-2)
```diff
@@ -1,4 +1,12 @@
-import { isFn, each, isPlainObj, isArr, toArr, FormPath } from '@formily/shared'
+import {
+  isFn,
+  each,
+  isPlainObj,
+  isArr,
+  toArr,
+  FormPath,
+  isReactElement,
+} from '@formily/shared'
 import { isObservable, untracked } from '@formily/reactive'
 import { Schema } from './schema'
 import { ISchema } from './types'
@@ -150,7 +158,7 @@ export const traverseSchema = (
 }
 
 export const isNoNeedCompileObject = (source: any) => {
-  if ('$$typeof' in source && '_owner' in source) {
+  if (isReactElement(source)) {
     return true
   }
   if (source['_isAMomentObject']) {
```

**File**: `packages/shared/src/checkers.ts` (modified, +9/-2)
```diff
@@ -21,8 +21,15 @@ export const isNumberLike = (index: any): index is number =>
   isNum(index) || /^\d+$/.test(index)
 export const isObj = (val: unknown): val is object => typeof val === 'object'
 export const isRegExp = isType<RegExp>('RegExp')
-export const isReactElement = (obj: any): boolean =>
-  obj && obj['$$typeof'] && obj['_owner']
+export const isReactElement = (obj: any): boolean => {
+  // react19 production 环境中没有 _owner 属性
+  return (
+    isPlainObj(obj) &&
+    '$$typeof' in obj &&
+    ('_owner' in obj || isFn(obj['type']))
+  )
+}
+
 export const isHTMLElement = (target: any): target is EventTarget => {
   return Object.prototype.toString.call(target).indexOf('HTML') > -1
 }
```

---

### Incident Patch 3: `5cfabaf7` (2025-05-15)
**Commit Message**: fix(validator): required 规则只认 true，保持与 Schema/UI 层一致 (#4297)

**File**: `packages/validator/src/rules.ts` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ const RULES: IRegistryRules = {
     return ''
   },
   required(value, rule) {
-    if (rule.required === false) return ''
+    if (rule.required !== true) return ''
     return isValidateEmpty(value) ? rule.message : ''
   },
   max(value, rule) {
```

---

### Incident Patch 4: `70475f77` (2025-05-07)
**Commit Message**: fix(formily grid): add requestAnimationFrame to smooth grid digest (#4281)

**File**: `packages/grid/src/index.ts` (modified, +7/-1)
```diff
@@ -440,7 +440,13 @@ export class Grid<Container extends HTMLElement> {
         }
       })
       const mutationObserver = new ChildListMutationObserver(digest)
-      const resizeObserver = new ResizeObserver(digest)
+      // add requestAnimationFrame to smooth digest
+      const smoothDigest = () => {
+        requestAnimationFrame(() => {
+          digest()
+        })
+      }
+      const resizeObserver = new ResizeObserver(smoothDigest)
       const dispose = reaction(() => ({ ...this.options }), digest)
       resizeObserver.observe(this.container)
       mutationObserver.observe(this.container, {
```

---

### Incident Patch 5: `cabecfea` (2025-03-31)
**Commit Message**: fix: fix doc cdn link

**File**: `packages/antd/.umirc.js` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/antd@4.x/dist/antd.css',
+      href: 'https://esm.sh/antd@4.x/dist/antd.css',
     },
   ],
   headScripts: [
```

**File**: `packages/benchmark/.umirc.js` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/antd@4.x/dist/antd.css',
+      href: 'https://esm.sh/antd@4.x/dist/antd.css',
     },
   ],
   styles: [
```

**File**: `packages/benchmark/template.ejs` (modified, +5/-5)
```diff
@@ -11,14 +11,14 @@
       -webkit-user-select: none;
     }
   </style>
-  <link type="text/css" rel="stylesheet" href="https://unpkg.com/antd@4.x/dist/antd.css"/>
+  <link type="text/css" rel="stylesheet" href="https://esm.sh/antd@4.x/dist/antd.css"/>
 </head>
 
 <body>
   <div id="root">
   </div>
-  <script src="https://unpkg.com/moment/min/moment-with-locales.js"></script>
-  <script src="https://unpkg.com/react@next/umd/react.production.min.js"></script>
-  <script src="https://unpkg.com/react-dom@next/umd/react-dom.production.min.js"></script>
-  <script src="https://unpkg.com/antd@4.x/dist/antd-with-locales.min.js"></script>
+  <script src="https://esm.sh/moment/min/moment-with-locales.js"></script>
+  <script src="https://esm.sh/react@next/umd/react.production.min.js"></script>
+  <script src="https://esm.sh/react-dom@next/umd/react-dom.production.min.js"></script>
+  <script src="https://esm.sh/antd@4.x/dist/antd-with-locales.min.js"></script>
 </body>
\ No newline at end of file
```

**File**: `packages/element/docs/.vuepress/config.js` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ module.exports = {
       'link',
       {
         rel: 'stylesheet',
-        href: 'https://unpkg.com/element-ui/lib/theme-chalk/index.css',
+        href: 'https://esm.sh/element-ui/lib/theme-chalk/index.css',
       },
     ],
   ],
```

**File**: `packages/next/.umirc.js` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/@alifd/next/dist/next-noreset.css',
+      href: 'https://esm.sh/@alifd/next/dist/next-noreset.css',
     },
   ],
   headScripts: [
```

**File**: `packages/react/.umirc.js` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/antd@4.x/dist/antd.css',
+      href: 'https://esm.sh/antd@4.x/dist/antd.css',
     },
   ],
   headScripts: [
```

**File**: `packages/reactive-test-cases-for-react18/.umirc.js` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/antd@4.x/dist/antd.css',
+      href: 'https://esm.sh/antd@4.x/dist/antd.css',
     },
   ],
   styles: [
```

**File**: `packages/reactive-test-cases-for-react18/template.ejs` (modified, +2/-2)
```diff
@@ -16,6 +16,6 @@
 <body>
   <div id="root">
   </div>
-  <script src="https://unpkg.com/react@next/umd/react.production.min.js"></script>
-  <script src="https://unpkg.com/react-dom@next/umd/react-dom.production.min.js"></script>
+  <script src="https://esm.sh/react@next/umd/react.production.min.js"></script>
+  <script src="https://esm.sh/react-dom@next/umd/react-dom.production.min.js"></script>
 </body>
\ No newline at end of file
```

---

### Incident Patch 6: `cffde793` (2025-03-31)
**Commit Message**: fix: fix doc cdn link

**File**: `.umirc.js` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ export default {
   links: [
     {
       rel: 'stylesheet',
-      href: 'https://unpkg.com/antd@4.x/dist/antd.css',
+      href: 'https://esm.sh/antd@4.x/dist/antd.css',
     },
   ],
   styles: [
```

---

### Incident Patch 7: `96161943` (2025-01-22)
**Commit Message**: Revert "fix(antd): fix form item overflow tooltip abnormal show when containe…" (#4265)

This reverts commit 30167e175bb8d1efd8b322ec6235ec44c7abc502.

**File**: `packages/antd/src/form-item/index.tsx` (modified, +2/-13)
```diff
@@ -107,7 +107,7 @@ function useOverflow<
   const labelCol = JSON.stringify(layout.labelCol)
 
   useEffect(() => {
-    const checkOverflow = () => {
+    requestAnimationFrame(() => {
       if (containerRef.current && contentRef.current) {
         const contentWidth = contentRef.current.getBoundingClientRect().width
         const containerWidth =
@@ -118,18 +118,7 @@ function useOverflow<
           if (overflow) setOverflow(false)
         }
       }
-    }
-
-    requestAnimationFrame(checkOverflow)
-
-    const resizeObserver = new ResizeObserver(() =>
-      requestAnimationFrame(checkOverflow)
-    )
-    resizeObserver.observe(containerRef.current)
-    resizeObserver.observe(contentRef.current)
-    return () => {
-      resizeObserver.disconnect()
-    }
+    })
   }, [labelCol])
 
   return {
```

---

### Incident Patch 8: `a0f3169a` (2025-01-21)
**Commit Message**: fix(antd): fix antd/next render error at React 19 (#4262)

* fix(antd,next): 🩹 replace defaultProps by default parameters

Form 组件 component 无法获取到 form, 造成渲染失败

* fix(antd): 🩹 fix next portalId and antd typo

**File**: `packages/antd/src/__builtins__/portal.tsx` (modified, +5/-7)
```diff
@@ -11,27 +11,25 @@ const PortalMap = observable(new Map<string | symbol, React.ReactNode>())
 
 export const createPortalProvider = (id: string | symbol) => {
   const Portal = (props: React.PropsWithChildren<IPortalProps>) => {
-    if (props.id && !PortalMap.has(props.id)) {
-      PortalMap.set(props.id, null)
+    const portalId = props.id ?? id
+    if (portalId && !PortalMap.has(portalId)) {
+      PortalMap.set(portalId, null)
     }
 
     return (
       <Fragment>
         {props.children}
         <Observer>
           {() => {
-            if (!props.id) return null
-            const portal = PortalMap.get(props.id)
+            if (!portalId) return null
+            const portal = PortalMap.get(portalId)
             if (portal) return createPortal(portal, document.body)
             return null
           }}
         </Observer>
       </Fragment>
     )
   }
-  Portal.defaultProps = {
-    id,
-  }
   return Portal
 }
 
```

**File**: `packages/antd/src/array-collapse/index.tsx` (modified, +128/-126)
```diff
@@ -78,152 +78,157 @@ const insertActiveKeys = (activeKeys: number[], index: number) => {
   }, [])
 }
 
-export const ArrayCollapse: ComposedArrayCollapse = observer((props) => {
-  const field = useField<ArrayField>()
-  const dataSource = Array.isArray(field.value) ? field.value : []
-  const [activeKeys, setActiveKeys] = useState<number[]>(
-    takeDefaultActiveKeys(dataSource.length, props.defaultOpenPanelCount)
-  )
-  const schema = useFieldSchema()
-  const prefixCls = usePrefixCls('formily-array-collapse', props)
-  useEffect(() => {
-    if (!field.modified && dataSource.length) {
-      setActiveKeys(
-        takeDefaultActiveKeys(dataSource.length, props.defaultOpenPanelCount)
+export const ArrayCollapse: ComposedArrayCollapse = observer(
+  ({ defaultOpenPanelCount = 5, ...props }) => {
+    const field = useField<ArrayField>()
+    const dataSource = Array.isArray(field.value) ? field.value : []
+    const [activeKeys, setActiveKeys] = useState<number[]>(
+      takeDefaultActiveKeys(dataSource.length, defaultOpenPanelCount)
+    )
+    const schema = useFieldSchema()
+    const prefixCls = usePrefixCls('formily-array-collapse', props)
+    useEffect(() => {
+      if (!field.modified && dataSource.length) {
+        setActiveKeys(
+          takeDefaultActiveKeys(dataSource.length, defaultOpenPanelCount)
+        )
+      }
+    }, [dataSource.length, field])
+    if (!schema) throw new Error('can not found schema object')
+    const { onAdd, onCopy, onRemove, onMoveDown, onMoveUp } = props
+
+    const renderAddition = () => {
+      return schema.reduceProperties((addition, schema, key) => {
+        if (isAdditionComponent(schema)) {
+          return <RecursionField schema={schema} name={key} />
+        }
+        return addition
+      }, null)
+    }
+    const renderEmpty = () => {
+      if (dataSource.length) return
+      return (
+        <Card className={cls(`${prefixCls}-item`, props.className)}>
+          <Empty />
+        </Card>
       )
     }
-  }, [dataSource.length, field])
-  if (!schema) throw new Error('can not found schema object')
-  const { onAdd, onCopy, onRemove, onMoveDown, onMoveUp } = props
-
-  const renderAddition = () => {
-    return schema.reduceProperties((addition, schema, key) => {
-      if (isAdditionComponent(schema)) {
-        return <RecursionField schema={schema} name={key} />
-      }
-      return addition
-    }, null)
-  }
-  const renderEmpty = () => {
-    if (dataSource.length) return
-    return (
-      <Card className={cls(`${prefixCls}-item`, props.className)}>
-        <Empty />
-      </Card>
-    )
-  }
 
-  const renderItems = () => {
-    return (
-      <Collapse
-        {...props}
-        activeKey={activeKeys}
-        onChange={(keys: string[]) => setActiveKeys(toArr(keys).map(Number))}
-        className={cls(`${prefixCls}-item`, props.className)}
-      >
-        {dataSource.map((item, index) => {
-          const items = Array.isArray(schema.items)
-            ? schema.items[index] || schema.items[0]
-            : schema.items
-
-          const panelProps = field
-            .query(`${field.address}.${index}`)
-            .get('componentProps')
-          const props: CollapsePanelProps = items['x-component-props']
-          const header = () => {
-            const header = panelProps?.header || props.header || field.title
-            const path = field.address.concat(index)
-            const errors = field.form.queryFeedbacks({
-              type: 'error',
-              address: `${path}.**`,
-            })
-            return (
-              <ArrayBase.Item index={index} record={() => field.value?.[index]}>
+    const renderItems = () => {
+      return (
+        <Collapse
+          {...props}
+          activeKey={activeKeys}
+          onChange={(keys: string[]) => setActiveKeys(toArr(keys).map(Number))}
+          className={cls(`${prefixCls}-item`, props.className)}
+        >
+          {dataSource.map((item, index) => {
+            const items = Array.isArray(schema.items)
+              ? schema.items[index] || schema.items[0]
+              : schema.items
+
+            const panelProps = field
+              .query(`${field.address}.${index}`)
+              .get('componentProps')
+            const props: CollapsePanelProps = items['x-component-props']
+            const header = () => {
+              const header = panelProps?.header || props.header || field.title
+              const path = field.address.concat(index)
+              const errors = field.form.queryFeedbacks({
+                type: 'error',
+                address: `${path}.**`,
+              })
+              return (
+                <ArrayBase.Item
+                  index={index}
+                  record={() => field.value?.[index]}
+                >
+                  <RecursionField
+                    schema={items}
+                    name={index}
+                    filterProperties={(schema) => {
+      
```

**File**: `packages/antd/src/form-button-group/index.tsx` (modified, +2/-10)
```diff
@@ -57,7 +57,7 @@ function getDefaultBackground() {
 }
 
 export const FormButtonGroup: ComposedButtonGroup = ({
-  align,
+  align = 'left',
   gutter,
   ...props
 }) => {
@@ -83,10 +83,6 @@ export const FormButtonGroup: ComposedButtonGroup = ({
   )
 }
 
-FormButtonGroup.defaultProps = {
-  align: 'left',
-}
-
 FormButtonGroup.FormItem = ({ gutter, ...props }) => {
   return (
     <BaseItem
@@ -109,7 +105,7 @@ FormButtonGroup.FormItem = ({ gutter, ...props }) => {
   )
 }
 
-FormButtonGroup.Sticky = ({ align, ...props }) => {
+FormButtonGroup.Sticky = ({ align = 'left', ...props }) => {
   const ref = useRef()
   const [color, setColor] = useState('transparent')
   const prefixCls = usePrefixCls('formily-button-group')
@@ -151,8 +147,4 @@ FormButtonGroup.Sticky = ({ align, ...props }) => {
   )
 }
 
-FormButtonGroup.Sticky.defaultProps = {
-  align: 'left',
-}
-
 export default FormButtonGroup
```

**File**: `packages/antd/src/form-grid/index.tsx` (modified, +1/-5)
```diff
@@ -101,18 +101,14 @@ export const FormGrid: ComposedFormGrid = observer(
 ) as any
 
 export const GridColumn: React.FC<React.PropsWithChildren<IGridColumnProps>> =
-  observer(({ gridSpan, children, ...props }) => {
+  observer(({ gridSpan = 1, children, ...props }) => {
     return (
       <div {...props} style={props.style} data-grid-span={gridSpan}>
         {children}
       </div>
     )
   })
 
-GridColumn.defaultProps = {
-  gridSpan: 1,
-}
-
 FormGrid.createFormGrid = createFormGrid
 FormGrid.useGridSpan = useGridSpan
 FormGrid.useGridColumn = useGridColumn
```

**File**: `packages/antd/src/form-layout/index.tsx` (modified, +8/-5)
```diff
@@ -66,7 +66,14 @@ export const FormLayout: React.FC<React.PropsWithChildren<IFormLayoutProps>> & {
   useFormLayout: () => IFormLayoutContext
   useFormDeepLayout: () => IFormLayoutContext
   useFormShallowLayout: () => IFormLayoutContext
-} = ({ shallow, children, prefixCls, className, style, ...otherProps }) => {
+} = ({
+  shallow = true,
+  children,
+  prefixCls,
+  className,
+  style,
+  ...otherProps
+}) => {
   const { ref, props } = useResponsiveFormLayout(otherProps)
   const deepLayout = useFormDeepLayout()
   const formPrefixCls = usePrefixCls('form', { prefixCls })
@@ -109,10 +116,6 @@ export const FormLayout: React.FC<React.PropsWithChildren<IFormLayoutProps>> & {
   )
 }
 
-FormLayout.defaultProps = {
-  shallow: true,
-}
-
 FormLayout.useFormDeepLayout = useFormDeepLayout
 FormLayout.useFormShallowLayout = useFormShallowLayout
 FormLayout.useFormLayout = useFormLayout
```

**File**: `packages/antd/src/form/index.tsx` (modified, +1/-5)
```diff
@@ -13,7 +13,7 @@ export interface FormProps extends IFormLayoutProps {
 
 export const Form: React.FC<React.PropsWithChildren<FormProps>> = ({
   form,
-  component,
+  component = 'form',
   onAutoSubmit,
   onAutoSubmitFailed,
   previewTextPlaceholder,
@@ -43,8 +43,4 @@ export const Form: React.FC<React.PropsWithChildren<FormProps>> = ({
   return renderContent(top)
 }
 
-Form.defaultProps = {
-  component: 'form',
-}
-
 export default Form
```

**File**: `packages/antd/src/select-table/index.tsx` (modified, +4/-11)
```diff
@@ -142,11 +142,11 @@ const addPrimaryKey = (dataSource, rowKey, primaryKey) =>
 
 export const SelectTable: ComposedSelectTable = observer((props) => {
   const {
-    mode,
+    mode = 'multiple',
     dataSource: propsDataSource,
     optionAsValue,
-    valueType,
-    showSearch,
+    valueType = 'all',
+    showSearch = false,
     filterOption,
     filterSort,
     onSearch,
@@ -155,7 +155,7 @@ export const SelectTable: ComposedSelectTable = observer((props) => {
     value,
     onChange,
     rowSelection,
-    primaryKey: rowKey,
+    primaryKey: rowKey = 'key',
     ...otherTableProps
   } = props
   const prefixCls = usePrefixCls('formily-select-table', props)
@@ -409,11 +409,4 @@ const TableColumn: React.FC<
 
 SelectTable.Column = TableColumn
 
-SelectTable.defaultProps = {
-  showSearch: false,
-  valueType: 'all',
-  primaryKey: 'key',
-  mode: 'multiple',
-}
-
 export default SelectTable
```

**File**: `packages/antd/src/transfer/index.tsx` (modified, +3/-4)
```diff
@@ -2,6 +2,8 @@ import { connect, mapProps } from '@formily/react'
 import { Transfer as AntdTransfer } from 'antd'
 import { isVoidField } from '@formily/core'
 
+const renderTitle = (item: any) => item.title
+
 export const Transfer = connect(
   AntdTransfer,
   mapProps(
@@ -12,6 +14,7 @@ export const Transfer = connect(
       if (isVoidField(field)) return props
       return {
         ...props,
+        render: props.render || renderTitle,
         dataSource:
           field.dataSource?.map((item) => {
             return {
@@ -25,8 +28,4 @@ export const Transfer = connect(
   )
 )
 
-Transfer.defaultProps = {
-  render: (item) => item.title,
-}
-
 export default Transfer
```

---

### Incident Patch 9: `30167e17` (2025-01-21)
**Commit Message**: fix(antd): fix form item overflow tooltip abnormal show when container zoom (#4190)

**File**: `packages/antd/src/form-item/index.tsx` (modified, +13/-2)
```diff
@@ -107,7 +107,7 @@ function useOverflow<
   const labelCol = JSON.stringify(layout.labelCol)
 
   useEffect(() => {
-    requestAnimationFrame(() => {
+    const checkOverflow = () => {
       if (containerRef.current && contentRef.current) {
         const contentWidth = contentRef.current.getBoundingClientRect().width
         const containerWidth =
@@ -118,7 +118,18 @@ function useOverflow<
           if (overflow) setOverflow(false)
         }
       }
-    })
+    }
+
+    requestAnimationFrame(checkOverflow)
+
+    const resizeObserver = new ResizeObserver(() =>
+      requestAnimationFrame(checkOverflow)
+    )
+    resizeObserver.observe(containerRef.current)
+    resizeObserver.observe(contentRef.current)
+    return () => {
+      resizeObserver.disconnect()
+    }
   }, [labelCol])
 
   return {
```

---

### Incident Patch 10: `d60f12db` (2025-01-21)
**Commit Message**: fix: array-table/main.scss mixed-decls Deprecation warning on sass@1.77.7 + (#4195)

see: 
https://sass-lang.com/documentation/breaking-changes/mixed-decls/#example-mixed-declarations-opt-in-scss

warning report：

```shell
Deprecation Warning: Sass's behavior for declarations that appear after nested
rules will be changing to match the behavior specified by CSS in an upcoming
version. To keep the existing behavior, move the declaration above the nested
rule. To opt into the new behavior, wrap the declaration in `& {}`.

More info: https://sass-lang.com/d/mixed-decls

    ╷
47  │ ┌           &.#{$css-prefix}formily-item-warning-help {
48  │ │             color: $form-warning-color;
49  │ │           }
    │ └─── nested rule
... │
54  │             top: 100%;
    │             ^^^^^^^^^ declaration
    ╵
    stdin 54:11  root stylesheet
```

## issues
- https://github.com/sass/dart-sass/issues/2280
- https://github.com/vitejs/vite/issues/7116

**File**: `packages/next/src/array-table/main.scss` (modified, +15/-13)
```diff
@@ -48,19 +48,21 @@ $array-table-prefix-cls: '#{$css-prefix}formily-array-table';
             color: $form-warning-color;
           }
 
-          min-width: 30px;
-          position: absolute;
-          font-size: 12px;
-          top: 100%;
-          width: 100%;
-          z-index: 1;
-          border-radius: 3px;
-          background-color: #fff;
-          border: 1px solid #eee;
-          padding: 6px 8px;
-          margin-top: 6px;
-          transform: translateY(0);
-          opacity: 1;
+          & {
+            min-width: 30px;
+            position: absolute;
+            font-size: 12px;
+            top: 100%;
+            width: 100%;
+            z-index: 1;
+            border-radius: 3px;
+            background-color: #fff;
+            border: 1px solid #eee;
+            padding: 6px 8px;
+            margin-top: 6px;
+            transform: translateY(0);
+            opacity: 1;
+          }
           &:after {
             content: ' ';
             background-color: #fff;
```

---

### Incident Patch 11: `7d43e923` (2024-07-17)
**Commit Message**: build(deps): bump axios from 0.18.1 to 1.7.2 (#4185)

Bumps [axios](https://github.com/axios/axios) from 0.18.1 to 1.7.2.
- [Release notes](https://github.com/axios/axios/releases)
- [Changelog](https://github.com/axios/axios/blob/v1.x/CHANGELOG.md)
- [Commits](https://github.com/axios/axios/compare/v0.18.1...v1.7.2)

---
updated-dependencies:
- dependency-name: axios
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +10/-5)
```diff
@@ -5408,11 +5408,11 @@ axios@^0.18.1:
     is-buffer "^2.0.2"
 
 axios@^1.6.0:
-  version "1.6.0"
-  resolved "https://registry.yarnpkg.com/axios/-/axios-1.6.0.tgz#f1e5292f26b2fd5c2e66876adc5b06cdbd7d2102"
-  integrity sha512-EZ1DYihju9pwVB+jg67ogm+Tmqc6JmhamRN6I4Zt8DfZu5lbcQGw3ozH9lFejSJgs/ibaef3A9PMXPLeefFGJg==
+  version "1.7.2"
+  resolved "https://registry.yarnpkg.com/axios/-/axios-1.7.2.tgz#b625db8a7051fbea61c35a3cbb3a1daa7b9c7621"
+  integrity sha512-2A8QhOMrbomlDuiLeK9XibIBzuHeRcqqNOHp0Cyp5EoJ1IFDh+XZH3A6BkXtv0K4gFGCI0Y4BM7B1wOEi0Rmgw==
   dependencies:
-    follow-redirects "^1.15.0"
+    follow-redirects "^1.15.6"
     form-data "^4.0.0"
     proxy-from-env "^1.1.0"
 
@@ -9599,11 +9599,16 @@ follow-redirects@1.5.10:
   dependencies:
     debug "=3.1.0"
 
-follow-redirects@^1.0.0, follow-redirects@^1.15.0:
+follow-redirects@^1.0.0:
   version "1.15.3"
   resolved "https://registry.yarnpkg.com/follow-redirects/-/follow-redirects-1.15.3.tgz#fe2f3ef2690afce7e82ed0b44db08165b207123a"
   integrity sha512-1VzOtuEM8pC9SFU1E+8KfTjZyMztRsgEfwQl44z8A25uy13jSzTj6dyK2Df52iV0vgHCfBwLhDWevLn95w5v6Q==
 
+follow-redirects@^1.15.6:
+  version "1.15.6"
+  resolved "https://registry.yarnpkg.com/follow-redirects/-/follow-redirects-1.15.6.tgz#7f815c0cda4249c74ff09e95ef97c23b5fd0399b"
+  integrity sha512-wWN62YITEaOpSK584EZXJafH1AGpO8RVgElfkuXbTOrPX4fIfOyEpW/CsiNd8JdYrAoOvafRTOEnvsO++qCqFA==
+
 for-in@^1.0.2:
   version "1.0.2"
   resolved "https://registry.yarnpkg.com/for-in/-/for-in-1.0.2.tgz#81068d295a8142ec0ac726c6e2200c30fb6d5e80"
```

---

### Incident Patch 12: `f0b37de8` (2024-07-16)
**Commit Message**: build(deps): bump express from 4.18.1 to 4.19.2 (#4120)

Bumps [express](https://github.com/expressjs/express) from 4.18.1 to 4.19.2.
- [Release notes](https://github.com/expressjs/express/releases)
- [Changelog](https://github.com/expressjs/express/blob/master/History.md)
- [Commits](https://github.com/expressjs/express/compare/4.18.1...4.19.2)

---
updated-dependencies:
- dependency-name: express
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +27/-29)
```diff
@@ -5741,21 +5741,21 @@ bn.js@^5.2.1:
   resolved "https://registry.yarnpkg.com/bn.js/-/bn.js-5.2.1.tgz#0bc527a6a0d18d0aa8d5b0538ce4a77dccfa7b70"
   integrity sha512-eXRvHzWyYPBuB4NBy0cmYQjGitUrtqwbvlzP3G6VFnNRbsZQIxQ10PbKKHt8gZ/HW/D/747aDl+QkDqg3KQLMQ==
 
-body-parser@1.20.0:
-  version "1.20.0"
-  resolved "https://registry.yarnpkg.com/body-parser/-/body-parser-1.20.0.tgz#3de69bd89011c11573d7bfee6a64f11b6bd27cc5"
-  integrity sha512-DfJ+q6EPcGKZD1QWUjSpqp+Q7bDQTsQIF4zfUAtZ6qk+H/3/QRhg9CEp39ss+/T2vw0+HaidC0ecJj/DRLIaKg==
+body-parser@1.20.2:
+  version "1.20.2"
+  resolved "https://registry.yarnpkg.com/body-parser/-/body-parser-1.20.2.tgz#6feb0e21c4724d06de7ff38da36dad4f57a747fd"
+  integrity sha512-ml9pReCu3M61kGlqoTm2umSXTlRTuGTx0bfYj+uIUKKYycG5NtSbeetV3faSU6R7ajOPw0g/J1PvK4qNy7s5bA==
   dependencies:
     bytes "3.1.2"
-    content-type "~1.0.4"
+    content-type "~1.0.5"
     debug "2.6.9"
     depd "2.0.0"
     destroy "1.2.0"
     http-errors "2.0.0"
     iconv-lite "0.4.24"
     on-finished "2.4.1"
-    qs "6.10.3"
-    raw-body "2.5.1"
+    qs "6.11.0"
+    raw-body "2.5.2"
     type-is "~1.6.18"
     unpipe "1.0.0"
 
@@ -6945,6 +6945,11 @@ content-type@~1.0.4:
   resolved "https://registry.yarnpkg.com/content-type/-/content-type-1.0.4.tgz#e138cc75e040c727b1966fe5e5f8c9aee256fe3b"
   integrity sha512-hIP3EEPs8tB9AT1L+NUqtwOAps4mk2Zob89MWXMHjHWg9milF/j4osnnQLXBCBFBk/tvIG/tUc9mOUJiPBhPXA==
 
+content-type@~1.0.5:
+  version "1.0.5"
+  resolved "https://registry.yarnpkg.com/content-type/-/content-type-1.0.5.tgz#8b773162656d1d1086784c8f23a54ce6d73d7918"
+  integrity sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==
+
 conventional-changelog-angular@^5.0.11, conventional-changelog-angular@^5.0.12:
   version "5.0.13"
   resolved "https://registry.yarnpkg.com/conventional-changelog-angular/-/conventional-changelog-angular-5.0.13.tgz#896885d63b914a70d4934b59d2fe7bde1832b28c"
@@ -7053,10 +7058,10 @@ cookie-signature@1.0.6:
   resolved "https://registry.yarnpkg.com/cookie-signature/-/cookie-signature-1.0.6.tgz#e303a882b342cc3ee8ca513a79999734dab3ae2c"
   integrity sha1-4wOogrNCzD7oylE6eZmXNNqzriw=
 
-cookie@0.5.0:
-  version "0.5.0"
-  resolved "https://registry.yarnpkg.com/cookie/-/cookie-0.5.0.tgz#d1f5d71adec6558c58f389987c366aa47e994f8b"
-  integrity sha512-YZ3GUyn/o8gfKJlnlX7g7xq4gyO6OSuhGPKaaGssGB2qgDUS0gPgtTvoyZLTt9Ab6dC4hfc9dV5arkvc/OCmrw==
+cookie@0.6.0:
+  version "0.6.0"
+  resolved "https://registry.yarnpkg.com/cookie/-/cookie-0.6.0.tgz#2798b04b071b0ecbff0dbb62a505a8efa4e19051"
+  integrity sha512-U71cyTamuh1CRNCfpGY6to28lxvNwPG4Guz/EVjgf3Jmzv0vlDp1atT9eS5dDjMYHucpHbWns6Lwf3BKz6svdw==
 
 cool-path@^1.0.6:
   version "1.1.2"
@@ -9142,16 +9147,16 @@ expect@^26.6.2:
     jest-regex-util "^26.0.0"
 
 express@^4.16.3, express@^4.17.1:
-  version "4.18.1"
-  resolved "https://registry.yarnpkg.com/express/-/express-4.18.1.tgz#7797de8b9c72c857b9cd0e14a5eea80666267caf"
-  integrity sha512-zZBcOX9TfehHQhtupq57OF8lFZ3UZi08Y97dwFCkD8p9d/d2Y3M+ykKcwaMDEL+4qyUolgBDX6AblpR3fL212Q==
+  version "4.19.2"
+  resolved "https://registry.yarnpkg.com/express/-/express-4.19.2.tgz#e25437827a3aa7f2a827bc8171bbbb664a356465"
+  integrity sha512-5T6nhjsT+EOMzuck8JjBHARTHfMht0POzlA60WV2pMD3gyXw2LZnZ+ueGdNxG+0calOJcWKbpFcuzLZ91YWq9Q==
   dependencies:
     accepts "~1.3.8"
     array-flatten "1.1.1"
-    body-parser "1.20.0"
+    body-parser "1.20.2"
     content-disposition "0.5.4"
     content-type "~1.0.4"
-    cookie "0.5.0"
+    cookie "0.6.0"
     cookie-signature "1.0.6"
     debug "2.6.9"
     depd "2.0.0"
@@ -9167,7 +9172,7 @@ express@^4.16.3, express@^4.17.1:
     parseurl "~1.3.3"
     path-to-regexp "0.1.7"
     proxy-addr "~2.0.7"
-    qs "6.10.3"
+    qs "6.11.0"
     range-parser "~1.2.1"
     safe-buffer "5.2.1"
     send "0.18.0"
@@ -16844,14 +16849,7 @@ q@^1.1.2, q@^1.5.1:
   resolved "https://registry.yarnpkg.com/q/-/q-1.5.1.tgz#7e32f75b41381291d04611f1bf14109ac00651d7"
   integrity sha1-fjL3W0E4EpHQRhHxvxQQmsAGUdc=
 
-qs@6.10.3:
-  version "6.10.3"
-  resolved "https://registry.yarnpkg.com/qs/-/qs-6.10.3.tgz#d6cde1b2ffca87b5aa57889816c5f81535e22e8e"
-  integrity sha512-wr7M2E0OFRfIfJZjKGieI8lBKb7fRCH4Fv5KNPEs7gJ8jadvotdsS08PzOKR7opXhZ/Xkjtt3WF9g38drmyRqQ==
-  dependencies:
-    side-channel "^1.0.4"
-
-qs@^6.9.4:
+qs@6.11.0, qs@^6.9.4:
   version "6.11.0"
   resolved "https://registry.yarnpkg.com/qs/-/qs-6.11.0.tgz#fd0d963446f7a65e1367e01abd85429453f0c37a"
   integrity sha512-MvjoMCJwEarSbUYk5O+nmoSzSutSsTwF85zcHPQ9OrlFoZOYIjaqBAJIqIXjptyD5vThxGq52Xu/MaJzRkIk4Q==
@@ -16954,10 +16952,10 @@ range-parser@^1.2.1, range-parser@~1.2.1:
   resolved "https://registry.yarnpkg.com/range-parser/-/range-parser-1.2.1.tgz#3cf37023d199e1c24d1a55b84800c2f3e6468031"
   integrity sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==
 
-raw-body@2.5.1:
-  version "2.5.1"
-  resolved "https://registry.yarnpkg.com/raw-body/-/raw-body-2.5.1.t
```

---

### Incident Patch 13: `adf6b686` (2024-07-16)
**Commit Message**: build(deps): bump ws from 6.2.2 to 6.2.3 (#4157)

Bumps [ws](https://github.com/websockets/ws) from 6.2.2 to 6.2.3.
- [Release notes](https://github.com/websockets/ws/releases)
- [Commits](https://github.com/websockets/ws/compare/6.2.2...6.2.3)

---
updated-dependencies:
- dependency-name: ws
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `yarn.lock` (modified, +6/-6)
```diff
@@ -21534,16 +21534,16 @@ write-pkg@^4.0.0:
     write-json-file "^3.2.0"
 
 ws@^6.0.0, ws@^6.2.1:
-  version "6.2.2"
-  resolved "https://registry.yarnpkg.com/ws/-/ws-6.2.2.tgz#dd5cdbd57a9979916097652d78f1cc5faea0c32e"
-  integrity sha512-zmhltoSR8u1cnDsD43TX59mzoMZsLKqUweyYBAIvTngR3shc0W6aOZylZmq/7hqyVxPdi+5Ud2QInblgyE72fw==
+  version "6.2.3"
+  resolved "https://registry.yarnpkg.com/ws/-/ws-6.2.3.tgz#ccc96e4add5fd6fedbc491903075c85c5a11d9ee"
+  integrity sha512-jmTjYU0j60B+vHey6TfR3Z7RD61z/hmxBS3VMSGIrroOWXQEneK1zNuotOUrGyBHQj0yrpsLHPWtigEFd13ndA==
   dependencies:
     async-limiter "~1.0.0"
 
 ws@^7.4.6:
-  version "7.5.7"
-  resolved "https://registry.yarnpkg.com/ws/-/ws-7.5.7.tgz#9e0ac77ee50af70d58326ecff7e85eb3fa375e67"
-  integrity sha512-KMvVuFzpKBuiIXW3E4u3mySRO2/mCHSyZDJQM5NQ9Q9KHWHWh0NHgfbRMLLrceUK5qAL4ytALJbpRMjixFZh8A==
+  version "7.5.10"
+  resolved "https://registry.yarnpkg.com/ws/-/ws-7.5.10.tgz#58b5c20dc281633f6c19113f39b349bd8bd558d9"
+  integrity sha512-+dbF1tHwZpXcbOJdVOkzLDxZP1ailvSxM6ZweXTegylPny803bFhA+vqBYw4s31NSAk4S2Qz+AKXK9a4wkdjcQ==
 
 xdg-basedir@^3.0.0:
   version "3.0.0"
```

---

### Incident Patch 14: `37d437d6` (2024-07-16)
**Commit Message**: fix(chrome devtool): graph has symbol value, but devtool dont show (#4113)

**File**: `devtools/chrome-extension/src/extension/backend.ts` (modified, +8/-1)
```diff
@@ -49,7 +49,14 @@ const send = ({
       source: '@formily-devtools-inject-script',
       type,
       id,
-      graph: form && JSON.stringify(graph),
+      graph:
+        form &&
+        JSON.stringify(graph, (key, value) => {
+          if (typeof value === 'symbol') {
+            return value.toString()
+          }
+          return value
+        }),
     },
     '*'
   )
```

---

### Incident Patch 15: `0932a11b` (2024-07-16)
**Commit Message**: docs: fix deps (#4096)

**File**: `docs/guide/advanced/calculator.md` (modified, +2/-2)
```diff
@@ -139,7 +139,7 @@ export default () => {
           x-pattern="readPretty"
           x-reactions={{
             dependencies: ['.projects'],
-            when: '{{$deps.length > 0}}',
+            when: '{{$deps[0].length > 0}}',
             fulfill: {
               state: {
                 value:
@@ -338,7 +338,7 @@ const schema = {
       'x-pattern': 'readPretty',
       'x-reactions': {
         dependencies: ['.projects'],
-        when: '{{$deps.length > 0}}',
+        when: '{{$deps[0].length > 0}}',
         fulfill: {
           state: {
             value:
```

**File**: `docs/guide/advanced/calculator.zh-CN.md` (modified, +2/-2)
```diff
@@ -139,7 +139,7 @@ export default () => {
           x-pattern="readPretty"
           x-reactions={{
             dependencies: ['.projects'],
-            when: '{{$deps.length > 0}}',
+            when: '{{$deps[0].length > 0}}',
             fulfill: {
               state: {
                 value:
@@ -338,7 +338,7 @@ const schema = {
       'x-pattern': 'readPretty',
       'x-reactions': {
         dependencies: ['.projects'],
-        when: '{{$deps.length > 0}}',
+        when: '{{$deps[0].length > 0}}',
         fulfill: {
           state: {
             value:
```

#### Recent Merged Pull Requests:
- **PR #4333** (closed): Test Merge (@skyfore)
- **PR #4331** (closed): fix(core): reset when field display is none should be keep value (@njzydark)
- **PR #4308** (2025-06-05): fix(json-schema): schema 的 title 等属性在 react19 production 环境中无法传递组件 cl… (@liuweiGL)
- **PR #4297** (2025-05-15): fix(validator): required 规则只认 true，保持与 Schema/UI 层一致 (@FoundDream)
- **PR #4281** (2025-05-07): fix(formily grid): add requestAnimationFrame to smooth grid digest and avoid frequent observer triggering (@Hyperionlucky)
- **PR #4277** (closed): fix(grid): fix frequent observer triggering (@Hyperionlucky)
- **PR #4265** (2025-01-22): Revert "fix(antd): fix form item overflow tooltip abnormal show with container zoomed" (@janryWang)
- **PR #4262** (2025-01-21): fix(antd): fix antd/next render error at React 19 (@charlzyx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
