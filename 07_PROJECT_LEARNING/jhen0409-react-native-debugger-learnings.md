# Forensic Learning Record (Deep Inspection): jhen0409/react-native-debugger

> **Canonical Artifact**: `07_PROJECT_LEARNING/jhen0409-react-native-debugger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jhen0409/react-native-debugger](https://github.com/jhen0409/react-native-debugger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:48:49.507Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jhen0409/react-native-debugger`
- **Description**: The standalone app based on official debugger of React Native, and includes React Inspector / Redux DevTools
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10439 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/utils/adb.js`
```
import adb from 'adbkit'

export const client = adb.createClient({ host: '127.0.0.1' })

const reverse = (device, port) => client.reverse(device, `tcp:${port}`, `tcp:${port}`)

export const tryADBReverse = async (port) => {
  const devices = await client.listDevices().filter((device) => device.type === 'device')
  return Promise.all(devices.map((device) => reverse(device.id, port)))
}

```

### Core Architecture Module: `app/utils/config.js`
```
import { getCurrentWindow } from '@electron/remote'

export default getCurrentWindow().debuggerConfig || {}

```

### Core Architecture Module: `app/utils/devMenu.js`
```
import { TouchBar, nativeImage, getCurrentWindow } from '@electron/remote'

import { ipcRenderer } from 'electron'
import config from './config'

const { TouchBarButton, TouchBarSlider } = TouchBar || {}
const currentWindow = getCurrentWindow()

let worker
let availableMethods = []

/* reload, toggleElementInspector, networkInspect */
let leftBar = {}

let isSliderEnabled
let storeLiftedState
/* slider, prev, next */
let rightBar = {}

const getBarItems = (bar) => Object.keys(bar)
  .map((key) => bar[key])
  .filter((barItem) => !!barItem)
const setTouchBar = () => currentWindow.setTouchBar(
  new TouchBar({
    items: [
      ...getBarItems(leftBar),
      ...(isSliderEnabled ? getBarItems(rightBar) : []),
    ],
  }),
)

const invokeDevMenuMethod = ({ name, args }) => worker && worker.postMessage({ method: 'invokeDevMenuMethod', name, args })

let networkInspectEnabled = !!config.networkInspect
const sendContextMenuUpdate = () => {
  ipcRenderer.send(`context-menu-available-methods-update-${currentWindow.id}`, {
    availableMethods,
    networkInspectEnabled,
  })
}

export const networkInspect = {
  isEnabled: () => !!networkInspectEnabled,
  getHighlightColor: () => (networkInspectEnabled ? '#7A7A7A' : '#363636'),
  toggle() {
    networkInspectEnabled = !networkInspectEnabled
    sendContextMenuUpdate()
  },
}

const devMenuMethods = {
  reload: () => invokeDevMenuMethod({ name: 'reload' }),
  toggleElementInspector: () => invokeDevMenuMethod({ name: 'toggleElementInspector' }),
  show: () => invokeDevMenuMethod({ name: 'show' }),
  networkInspect: () => {
    networkInspect.toggle()
    if (leftBar.networkInspect) {
      leftBar.networkInspect.backgroundColor = networkInspect.getHighlightColor()
    }
    invokeDevMenuMethod({
      name: 'networkInspect',
      args: [networkInspectEnabled],
    })
  },
  showAsyncStorage: () => {
    invokeDevMenuMethod({ name: 'showAsyncStorage' })
  },
  clearAsyncStorage: () => {
    if (
      window.confirm(
        'Call `AsyncStorage.clear()` in current React Native debug session?',
      )
    ) {
      invokeDevMenuMethod({ name: 'clearAsyncStorage' })
    }
  },
}

export const invokeDevMethod = (name) => () => {
  if (availableMethods.includes(name)) {
    return devMenuMethods[name]()
  }
}

const hslShift = [0.5, 0.2, 0.8]
const icon = (name, resizeOpts) => {
  const image = nativeImage.createFromNamedImage(name, hslShift)
  return image.resize(resizeOpts)
}

let namedImages
const initNamedImages = () => {
  if (process.platform !== 'darwin' || namedImages) return
  namedImages = {
    reload: icon('NSTouchBarRefreshTemplate', { height: 20 }),
    toggleElementInspector: icon('NSTouchBarQuickLookTemplate', { height: 18 }),
    networkInspect: icon('NSTouchBarRecordStartTemplate', { height: 20 }),
    prev: icon('NSTouchBarGoBackTemplate', { height: 20 }),
    next: icon('NSTouchBarGoForwardTemplate', { height: 20 }),
  }
}

const setDevMenuMethodsForTouchBar = () => {
  if (process.platform !== 'darwin') return
  initNamedImages()

  leftBar = {
    // Default items
    networkInspect: new TouchBarButton({
      icon: namedImages.networkInspect,
      click: devMenuMethods.networkInspect,
      backgroundColor: networkInspect.getHighlightColor(),
    }),
  }
  if (availableMethods.includes('reload')) {
    leftBar.reload = new TouchBarButton({
      icon: namedImages.reload,
      click: devMenuMethods.reload,
    })
  }
  if (availableMethods.includes('toggleElementInspector')) {
    leftBar.toggleElementInspector = new TouchBarButton({
      icon: namedImages.toggleElementInspector,
      click: devMenuMethods.toggleElementInspector,
    })
  }
  setTouchBar()
}

// Reset TouchBar when reload the app
setDevMenuMethodsForTouchBar([])

export const setDevMenuMethods = (list, wkr) => {
  worker = wkr
  availableMethods = list
  sendContextMenuUpdate()
  setDevMenuMethodsForTouchBar()
}

export const setReduxDevToolsMethods = (enabled, dispatch) => {
  if (process.platform !== 'darwin') return
  initNamedImages()

  // Already setup
  if (enabled && isSliderEnabled) return

  const handleSliderChange = (nextIndex, dontUpdateTouchBarSlider = false) => dispatch({
    type: 'JUMP_TO_STATE',
    actionId: storeLiftedState.stagedActionIds[nextIndex],
    index: nextIndex,
    dontUpdateTouchBarSlider,
  })

  rightBar = {
    slider: new TouchBarSlider({
      value: 0,
      minValue: 0,
      maxValue: 0,
      change(nextIndex) {
        if (nextIndex !== storeLiftedState.currentStateIndex) {
          // Set `dontUpdateTouchBarSlider` true for keep slide experience
          handleSliderChange(nextIndex, true)
        }
      },
    }),
    prev: new TouchBarButton({
      icon: namedImages.prev,
      click() {
        const nextIndex = storeLiftedState.currentStateIndex - 1
        if (nextIndex >= 0) {
          handleSliderChange(nextIndex)
        }
      },
    }),
    next: new TouchBarButton({
      icon: namedImages.next,
      click() {
        const nextIndex = storeLiftedState.currentStateIndex + 1
        if (nextIndex < storeLiftedState.computedStates.length) {
          handleSliderChange(nextIndex)
        }
      },
    }),
  }
  isSliderEnabled = enabled
  setTouchBar()
}

export const updateSliderContent = (liftedState, dontUpdateTouchBarSlider) => {
  if (process.platform !== 'darwin') return

  storeLiftedState = liftedState
  if (isSliderEnabled && !dontUpdateTouchBarSlider) {
    const { currentStateIndex, computedStates } = liftedState
    rightBar.slider.maxValue = computedStates.length - 1
    rightBar.slider.value = currentStateIndex
  }
}

```

### Core Architecture Module: `app/utils/devtools.js`
```
import { getCatchConsoleLogScript } from '../../electron/devtools'

let enabled = false
export const toggleOpenInEditor = (win, port) => {
  if (win.devToolsWebContents) {
    enabled = !enabled
    return win.devToolsWebContents.executeJavaScript(`(() => {
      ${getCatchConsoleLogScript(port)}
      window.__IS_OPEN_IN_EDITOR_ENABLED__ = ${enabled};
    })()`)
  }
}

export const isOpenInEditorEnabled = () => enabled

export const clearNetworkLogs = (win) => {
  if (win.devToolsWebContents) {
    return win.devToolsWebContents.executeJavaScript(`setTimeout(() => {
      const { network } = UI.panels;
      if (network && network.networkLogView && network.networkLogView.reset) {
        network.networkLogView.reset()
      }
    }, 100)`)
  }
}

export const selectRNDebuggerWorkerContext = (win) => {
  if (win.devToolsWebContents) {
    return win.devToolsWebContents.executeJavaScript(`setTimeout(() => {
      const { console } = UI.panels;
      if (console && console.view && console.view.consoleContextSelector) {
        const selector = console.view.consoleContextSelector;
        const item = selector.items.items.find(
          item => item.label() === 'RNDebuggerWorker.js'
        );
        if (item) {
          selector.itemSelected(item);
        }
      }
    }, 100)`)
  }
}

```

### Core Architecture Module: `app/worker/apollo.js`
```

export function handleApolloClient() {
  // eslint-disable-next-line global-require
  require('apollo-client-devtools/build/hook')
}

```

### Core Architecture Module: `app/worker/asyncStorage.js`
```
export const getClearAsyncStorageFn = (AsyncStorage) => {
  if (!AsyncStorage.clear) return
  return () => AsyncStorage.clear().catch((f) => f)
}

function convertError(error) {
  if (!error) {
    return null
  }
  const out = new Error(error.message)
  out.key = error.key
  return out
}

function convertErrors(errs) {
  if (!errs) {
    return null
  }
  return (Array.isArray(errs) ? errs : [errs]).map((e) => convertError(e))
}

export const getSafeAsyncStorage = (NativeModules) => {
  const RCTAsyncStorage = NativeModules
    && (NativeModules.RNC_AsyncSQLiteDBStorage
      || NativeModules.RNCAsyncStorage
      || NativeModules.PlatformLocalStorage
      || NativeModules.AsyncRocksDBStorage
      || NativeModules.AsyncSQLiteDBStorage
      || NativeModules.AsyncLocalStorage)

  return {
    getItem(key) {
      if (!RCTAsyncStorage) return Promise.resolve(null)
      return new Promise((resolve, reject) => {
        RCTAsyncStorage.multiGet([key], (errors, result) => {
          // Unpack result to get value from [[key,value]]
          const value = result && result[0] && result[0][1] ? result[0][1] : null
          const errs = convertErrors(errors)
          if (errs) {
            reject(errs[0])
          } else {
            resolve(value)
          }
        })
      })
    },
    async setItem(key, value) {
      if (!RCTAsyncStorage) return Promise.resolve(null)
      return new Promise((resolve, reject) => {
        RCTAsyncStorage.multiSet([[key, value]], (errors) => {
          const errs = convertErrors(errors)
          if (errs) {
            reject(errs[0])
          } else {
            resolve(null)
          }
        })
      })
    },
    clear() {
      if (!RCTAsyncStorage) return Promise.resolve(null)
      return new Promise((resolve, reject) => {
        RCTAsyncStorage.clear((error) => {
          if (error && convertError(error)) {
            reject(convertError(error))
          } else {
            resolve(null)
          }
        })
      })
    },
    getAllKeys() {
      if (!RCTAsyncStorage) return Promise.resolve(null)
      return new Promise((resolve, reject) => {
        RCTAsyncStorage.getAllKeys((error, keys) => {
          if (error) {
            reject(convertError(error))
          } else {
            resolve(keys)
          }
        })
      })
    },
  }
}

export const getShowAsyncStorageFn = (AsyncStorage) => {
  if (!AsyncStorage.getAllKeys || !AsyncStorage.getItem) return
  return async () => {
    const keys = await AsyncStorage.getAllKeys()
    if (keys && keys.length) {
      const items = await Promise.all(
        keys.map((key) => AsyncStorage.getItem(key)),
      )
      const table = {}
      keys.forEach((key, index) => {
        table[key] = { content: items[index] }
      })
      console.table(table)
    } else {
      console.log('[RNDebugger] No AsyncStorage content.')
    }
  }
}

```

### Core Architecture Module: `app/worker/devMenu.js`
```
/* eslint-disable no-underscore-dangle */

import { toggleNetworkInspect } from './networkInspect'
import { getClearAsyncStorageFn, getShowAsyncStorageFn, getSafeAsyncStorage } from './asyncStorage'

let availableDevMenuMethods = {}

export const checkAvailableDevMenuMethods = ({ NativeModules }) => {
  // RN 0.43 use DevSettings, DevMenu will be deprecated
  const DevSettings = NativeModules.DevSettings || NativeModules.DevMenu
  // Currently `show dev menu` is only on DevMenu
  const showDevMenu = (DevSettings && DevSettings.show)
    || (NativeModules.DevMenu && NativeModules.DevMenu.show)
    || undefined

  const AsyncStorage = getSafeAsyncStorage(NativeModules)
  const methods = {
    ...DevSettings,
    show: showDevMenu,
    networkInspect: toggleNetworkInspect,
    showAsyncStorage: getShowAsyncStorageFn(AsyncStorage),
    clearAsyncStorage: getClearAsyncStorageFn(AsyncStorage),
  }
  if (methods.showAsyncStorage) {
    window.showAsyncStorageContentInDev = methods.showAsyncStorage
  }
  const result = Object.keys(methods).filter((key) => !!methods[key])
  availableDevMenuMethods = methods

  postMessage({ __AVAILABLE_METHODS_CAN_CALL_BY_RNDEBUGGER__: result })
}

export const invokeDevMenuMethodIfAvailable = (name, args = []) => {
  const method = availableDevMenuMethods[name]
  if (method) method(...args)
}

```

### Core Architecture Module: `app/worker/index.js`
```
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/* global __fbBatchedBridge, importScripts: true */

// Edit from https://github.com/facebook/react-native/blob/master/local-cli/server/util/debuggerWorker.js

import './setup'
import { checkAvailableDevMenuMethods, invokeDevMenuMethodIfAvailable } from './devMenu'
import { reportDefaultReactDevToolsPort } from './reactDevTools'
import devToolsEnhancer, { composeWithDevTools } from './reduxAPI'
import * as RemoteDev from './remotedev'
import { getRequiredModules } from './utils'
import { toggleNetworkInspect } from './networkInspect'
import { handleApolloClient } from './apollo'

/* eslint-disable no-underscore-dangle */
self.__REMOTEDEV__ = RemoteDev

devToolsEnhancer.send = RemoteDev.send
devToolsEnhancer.connect = RemoteDev.connect
devToolsEnhancer.disconnect = RemoteDev.disconnect

// Deprecated API, these may removed when redux-devtools-extension 3.0 release
self.devToolsExtension = devToolsEnhancer
self.reduxNativeDevTools = devToolsEnhancer
self.reduxNativeDevToolsCompose = composeWithDevTools

self.__REDUX_DEVTOOLS_EXTENSION__ = devToolsEnhancer
self.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeWithDevTools

const setupRNDebuggerBeforeImportScript = (message) => {
  self.__REACT_DEVTOOLS_PORT__ = message.reactDevToolsPort
  if (message.networkInspect) {
    self.__NETWORK_INSPECT__ = toggleNetworkInspect
  }
}

const noop = (f) => f
const setupRNDebugger = async (message) => {
  // We need to regularly update JS runtime
  // because the changes of worker message (Redux DevTools, DevMenu)
  // doesn't notify to the remote JS runtime
  self.__RND_INTERVAL__ = setInterval(noop, 100); // eslint-disable-line

  handleApolloClient()
  toggleNetworkInspect(message.networkInspect)
  const modules = await getRequiredModules(message.moduleSize)
  if (modules) {
    checkAvailableDevMenuMethods(modules)
    reportDefaultReactDevToolsPort(modules)
  }
}

const messageHandlers = {
  executeApplicationScript(message, sendReply) {
    setupRNDebuggerBeforeImportScript(message)

    Object.keys(message.inject).forEach((key) => {
      self[key] = JSON.parse(message.inject[key])
    })
    let error
    try {
      importScripts(message.url)
    } catch (err) {
      error = err.message
    }

    if (!error) {
      setupRNDebugger(message)
    }

    sendReply(null /* result */, error)

    return false
  },
  emitReduxMessage() {
    // pass to other listeners
    return true
  },
  emitApolloMessage() {
    // pass to other listeners
    return true
  },
  invokeDevMenuMethod({ name, args }) {
    invokeDevMenuMethodIfAvailable(name, args)
    return false
  },
  beforeTerminate() {
    // Clean for notify native bridge
    if (window.__RND_INTERVAL__) {
      clearInterval(window.__RND_INTERVAL__)
      window.__RND_INTERVAL__ = null
    }
    return false
  },
}

addEventListener('message', (message) => {
  const object = message.data

  const sendReply = (result, error) => {
    postMessage({ replyID: object.id, result, error })
  }

  const handler = messageHandlers[object.method]
  if (handler) {
    // Special cased handlers
    return handler(object, sendReply)
  }
  // Other methods get called on the bridge
  let returnValue = [[], [], [], 0]
  let error
  try {
    if (typeof __fbBatchedBridge === 'object') {
      returnValue = __fbBatchedBridge[object.method].apply(null, object.arguments)
    } else {
      error = 'Failed to call function, __fbBatchedBridge is undefined'
    }
  } catch (err) {
    error = err.message
  } finally {
    sendReply(JSON.stringify(returnValue), error)
  }
  return false
})

```

### Core Architecture Module: `app/worker/polyfills/fetch.js`
```
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-new */
/* eslint-disable no-restricted-syntax */
/* eslint-disable func-names */

export default function getRNDebuggerFetchPolyfills() {
  const support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: false, // NOTE: Default for RNDebugger
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self,
  }

  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  }

  let isArrayBufferView
  if (support.arrayBuffer) {
    const viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]',
    ]

    isArrayBufferView = ArrayBuffer.isView
      || function (obj) {
        return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
      }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name) || name === '') {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    const iterator = {
      next() {
        const value = items.shift()
        return { done: value === undefined, value }
      },
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function () {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function (value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function (header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function (name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function (name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    const oldValue = this.map[name]
    this.map[name] = oldValue ? `${oldValue}, ${value}` : value
  }

  Headers.prototype.delete = function (name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function (name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function (name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function (name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function (callback, thisArg) {
    for (const name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function () {
    const items = []
    this.forEach((value, name) => {
      items.push(name)
    })
    return iteratorFor(items)
  }

  Headers.prototype.values = function () {
    const items = []
    this.forEach((value) => {
      items.push(value)
    })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function () {
    const items = []
    this.forEach((value, name) => {
      items.push([name, value])
    })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise((resolve, reject) => {
      reader.onload = function () {
        resolve(reader.result)
      }
      reader.onerror = function () {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    const reader = new FileReader()
    const promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    const reader = new FileReader()
    const promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    const view = new Uint8Array(buf)
    const chars = new Array(view.length)

    for (let i = 0; i < view.length; i += 1) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    }
    const view = new Uint8Array(buf.byteLength)
    view.set(new Uint8Array(buf))
    return view.buffer
  }

  function decode(body) {
    const form = new FormData()
    body
      .trim()
      .split('&')
      .forEach((bytes) => {
        if (bytes) {
          const split = bytes.split('=')
          const name = split.shift().replace(/\+/g, ' ')
          const value = split.join('=').replace(/\+/g, ' ')
          form.append(decodeURIComponent(name), decodeURIComponent(value))
        }
      })
    return form
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function (body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (
        support.arrayBuffer
        && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))
      ) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        const bodyText = Object.prototype.toString.call(body)
        body = bodyText
        this._bodyText = bodyText
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function () {
        const rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function () {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        }
        return this.blob().then(readBlobAsArrayBuffer)
      }
    }

    this.text = function () {
      const rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function () {
        return this.text().then(decode)
      }
    }

    this.json = function () {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    const upcased = method.toUpperCase()
    return methods.indexOf(upcased) > -1 ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    let { body } = options

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      this.signal = input.signal
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'same-origin'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.signal = options.signal || this.signal
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed fo
```

### Core Architecture Module: `app/worker/reactDevTools.js`
```
/* eslint-disable no-underscore-dangle */

const methodGlobalName = '__REPORT_REACT_DEVTOOLS_PORT__'

const reportReactDevToolsPort = (port, platform) => postMessage({
  [methodGlobalName]: port,
  platform,
})

export const reportDefaultReactDevToolsPort = async ({ setupDevtools, Platform }) => {
  if (Platform.__empty) return
  /*
   * [Fallback] React Native version under 0.39 can't specified the port
   */
  if (
    typeof setupDevtools === 'function'
    && setupDevtools.toString().indexOf('window.__REACT_DEVTOOLS_PORT__') === -1
  ) {
    reportReactDevToolsPort(8097, Platform.OS)
  } else {
    // React Inspector will keep the last reported port even if reload JS,
    // because we don't want to icrease the user waiting time for reload JS.
    // We need back to use the random port if we don't need fallback
    reportReactDevToolsPort(window.__REACT_DEVTOOLS_PORT__, Platform.OS)
  }
}

```

### Core Architecture Module: `app/worker/reduxAPI.js`
```
import { instrument } from '@redux-devtools/instrument'
import {
  evalAction,
  getActionsArray,
  generateId,
  stringify,
  getSeralizeParameter,
  importState,
  getLocalFilter,
  isFiltered,
  filterStagedActions,
  filterState,
} from '@redux-devtools/utils'
import { updateStackWithSourceMap } from './utils'

function configureStore(next, subscriber, options) {
  return instrument(subscriber, options)(next)
}

const instances = {
  /* [id]: { name, store, ... } */
}

let lastAction
let isExcess
let listenerAdded
let locked
let paused

function getStackTrace(config, toExcludeFromTrace) {
  if (!config.trace) return undefined
  if (typeof config.trace === 'function') return config.trace()

  let stack
  let extraFrames = 0
  let prevStackTraceLimit
  const { traceLimit } = config
  const error = Error()
  if (Error.captureStackTrace) {
    if (Error.stackTraceLimit < traceLimit) {
      prevStackTraceLimit = Error.stackTraceLimit
      Error.stackTraceLimit = traceLimit
    }
    Error.captureStackTrace(error, toExcludeFromTrace)
  } else {
    extraFrames = 3
  }
  stack = error.stack
  if (prevStackTraceLimit) Error.stackTraceLimit = prevStackTraceLimit
  if (
    extraFrames
    || typeof Error.stackTraceLimit !== 'number'
    || Error.stackTraceLimit > traceLimit
  ) {
    const frames = stack.split('\n')
    if (frames.length > traceLimit) {
      stack = frames
        .slice(0, traceLimit + extraFrames + (frames[0] === 'Error' ? 1 : 0))
        .join('\n')
    }
  }
  return updateStackWithSourceMap(stack)
}

function getLiftedState(store, filters) {
  return filterStagedActions(store.liftedStore.getState(), filters)
}

function relay(type, state, instance, action, nextActionId) {
  const {
    filters,
    predicate,
    stateSanitizer,
    actionSanitizer,
    serializeState,
    serializeAction,
  } = instance

  const message = {
    type,
    id: instance.id,
    name: instance.name,
  }
  if (state) {
    message.payload = type === 'ERROR'
      ? state
      : stringify(
        filterState(
          state,
          type,
          filters,
          stateSanitizer,
          actionSanitizer,
          nextActionId,
          predicate,
        ),
        serializeState,
      )
  }
  if (type === 'ACTION') {
    action.stack = getStackTrace(instance, true)
    message.action = stringify(
      !actionSanitizer ? action : actionSanitizer(action.action, nextActionId - 1),
      serializeAction,
    )
    message.isExcess = isExcess
    message.nextActionId = nextActionId
  } else if (instance) {
    message.libConfig = {
      type: 'redux',
      actionCreators: stringify(instance.actionCreators),
      serialize: !!instance.serialize,
    }
  }
  postMessage({ __IS_REDUX_NATIVE_MESSAGE__: true, content: message })
}

function dispatchRemotely(action, instance) {
  try {
    const { store, actionCreators } = instance
    const result = evalAction(action, actionCreators)
    store.dispatch(result)
  } catch (e) {
    relay('ERROR', e.message, instance)
  }
}

function importPayloadFrom(store, state, instance) {
  try {
    const nextLiftedState = importState(state, instance)
    if (!nextLiftedState) return
    store.liftedStore.dispatch({ type: 'IMPORT_STATE', ...nextLiftedState })
    relay('STATE', getLiftedState(store, instance.filters), instance)
  } catch (e) {
    relay('ERROR', e.message, instance)
  }
}

function exportState({ id: instanceId, store, serializeState }) {
  const liftedState = store.liftedStore.getState()
  const { actionsById } = liftedState
  const payload = []
  liftedState.stagedActionIds.slice(1).forEach((id) => {
    payload.push(actionsById[id].action)
  })
  postMessage({
    __IS_REDUX_NATIVE_MESSAGE__: true,
    content: {
      type: 'EXPORT',
      payload: stringify(payload, serializeState),
      committedState:
        typeof liftedState.committedState !== 'undefined'
          ? stringify(liftedState.committedState, serializeState)
          : undefined,
      instanceId,
    },
  })
}

function handleMessages(message) {
  const {
    id, instanceId, type, action, state, toAll,
  } = message
  if (toAll) {
    Object.keys(instances).forEach((key) => {
      handleMessages({ ...message, id: key, toAll: false })
    })
    return false
  }

  const instance = instances[id || instanceId]
  if (!instance) return true
  const { store, filters } = instance
  if (!store) return false

  switch (type) {
    case 'DISPATCH':
      store.liftedStore.dispatch(action)
      break
    case 'ACTION':
      dispatchRemotely(action, instance)
      break
    case 'IMPORT':
      importPayloadFrom(store, state, instance)
      break
    case 'EXPORT':
      exportState(instance)
      break
    case 'UPDATE':
      relay('STATE', getLiftedState(store, filters), instance)
      break
    default:
      break
  }
  return false
}

function start(instance) {
  if (!listenerAdded) {
    self.addEventListener('message', (message) => {
      const { method, content } = message.data
      if (method === 'emitReduxMessage') {
        handleMessages(content)
      }
    })
    listenerAdded = true
  }
  const { store, actionCreators, filters } = instance
  if (typeof actionCreators === 'function') {
    instance.actionCreators = actionCreators()
  }
  relay('STATE', getLiftedState(store, filters), instance)
}

function checkForReducerErrors(liftedState, instance) {
  if (liftedState.computedStates[liftedState.currentStateIndex].error) {
    relay('STATE', filterStagedActions(liftedState, instance.filters), instance)
    return true
  }
  return false
}

function monitorReducer(state = {}, action = {}) {
  lastAction = action.type
  return state
}

function handleChange(state, liftedState, maxAge, instance) {
  if (checkForReducerErrors(liftedState, instance)) return

  const { filters, predicate } = instance
  if (lastAction === 'PERFORM_ACTION') {
    const { nextActionId } = liftedState
    const liftedAction = liftedState.actionsById[nextActionId - 1]
    if (isFiltered(liftedAction.action, filters)) return
    if (predicate && !predicate(state, liftedAction.action)) return
    relay('ACTION', state, instance, liftedAction, nextActionId)
    if (!isExcess && maxAge) isExcess = liftedState.stagedActionIds.length >= maxAge
  } else {
    if (lastAction === 'JUMP_TO_STATE') return
    if (lastAction === 'PAUSE_RECORDING') {
      paused = liftedState.isPaused
    } else if (lastAction === 'LOCK_CHANGES') {
      locked = liftedState.isLocked
    }
    if (paused || locked) {
      if (lastAction) lastAction = undefined
      else return
    }
    relay('STATE', filterStagedActions(liftedState, filters), instance)
  }
}

export default function devToolsEnhancer(options = {}) {
  const {
    name,
    maxAge = 30,
    shouldCatchErrors = !!global.shouldCatchErrors,
    shouldHotReload,
    shouldRecordChanges,
    shouldStartLocked,
    pauseActionType = '@@PAUSED',
    actionCreators,
    filters,
    actionsBlacklist,
    actionsWhitelist,
    actionSanitizer,
    stateSanitizer,
    deserializeState,
    deserializeAction,
    serialize,
    predicate,
    trace,
    traceLimit,
  } = options
  const id = generateId(options.instanceId)

  const serializeState = getSeralizeParameter(options, 'serializeState')
  const serializeAction = getSeralizeParameter(options, 'serializeAction')

  return (next) => (reducer, initialState) => {
    const store = configureStore(next, monitorReducer, {
      maxAge,
      shouldCatchErrors,
      shouldHotReload,
      shouldRecordChanges,
      shouldStartLocked,
      pauseActionType,
    })(reducer, initialState)

    instances[id] = {
      name: name || id,
      id,
      store,
      filters: getLocalFilter({
        actionsWhitelist: (filters && filters.whitelist) || actionsWhitelist,
        actionsBlacklist: (filters && filters.blacklist) || actionsBlacklist,
      }),
      actionCreators: actionCreators && (() => getActionsArray(actionCreators)),
      stateSanitizer,
      actionSanitizer,
      deserializeState,
      deserializeAction,
      serializeState,
      serializeAction,
      serialize,
      predicate,
      trace,
      traceLimit,
    }

    start(instances[id])
    store.subscribe(() => {
      handleChange(store.getState(), store.liftedStore.getState(), maxAge, instances[id])
    })
    return store
  }
}

const preEnhancer = (instanceId) => (next) => (reducer, initialState, enhancer) => {
  const store = next(reducer, initialState, enhancer)

  if (instances[instanceId]) {
    instances[instanceId].store = store
  }
  return {
    ...store,
    dispatch: (action) => (locked ? action : store.dispatch(action)),
  }
}

devToolsEnhancer.updateStore = (newStore, instanceId) => {
  console.warn(
    '[RNDebugger]',
    '`updateStore` is deprecated use `window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__` instead:',
    'https://github.com/jhen0409/react-native-debugger/blob/master/docs/redux-devtools-integration.md',
  )

  const keys = Object.keys(instances)
  if (!keys.length) return

  if (keys.length > 1 && !instanceId) {
    console.warn(
      'You have multiple stores,',
      'please provide `instanceId` argument (`updateStore(store, instanceId)`)',
    )
  }
  if (instanceId) {
    const instance = instances[instanceId]
    if (!instance) return
    instance.store = newStore
  } else {
    instances[keys[0]].store = newStore
  }
}

const compose = (options) => (...funcs) => (...args) => {
  const instanceId = generateId(options.instanceId)
  return [preEnhancer(instanceId), ...funcs].reduceRight(
    (composed, f) => f(composed),
    devToolsEnhancer({ ...options, instanceId })(...args),
  )
}

export function composeWithDevTools(...funcs) {
  if (funcs.length === 0) {
    return devToolsEnhancer()
  }
  if (funcs.length === 1 && typeof funcs[0] === 'object') {
    return compose(funcs[0])
  }
  return compose({})(...funcs)
}

```

### Core Architecture Module: `app/worker/remotedev.js`
```
// Edit from https://github.com/zalmoxisus/remotedev/blob/master/src/devTools.js

import { stringify, parse } from 'jsan'
import { generateId, getActionsArray } from '@redux-devtools/utils'

let listenerAdded
const listeners = {}

export function extractState(message) {
  if (!message || !message.state) return undefined
  if (typeof message.state === 'string') return parse(message.state)
  return message.state
}

function handleMessages(message) {
  if (!message.payload) {
    message.payload = message.action
  }
  const fn = listeners[message.instanceId]
  if (!fn) return true

  if (typeof fn === 'function') {
    fn(message)
  } else {
    fn.forEach((func) => func(message))
  }
  return false
}

export function start() {
  if (!listenerAdded) {
    self.addEventListener('message', (message) => {
      const { method, content } = message.data
      if (method === 'emitReduxMessage') {
        return handleMessages(content)
      }
    })
    listenerAdded = true
  }
}

function transformAction(action, config) {
  if (action.action) return action
  const liftedAction = { timestamp: Date.now() }
  if (action) {
    if (config.getActionType) {
      liftedAction.action = config.getActionType(action)
    } else if (typeof action === 'string') {
      liftedAction.action = { type: action }
    } else if (!action.type) {
      liftedAction.action = { type: 'update' }
    } else {
      liftedAction.action = action
    }
  } else {
    liftedAction.action = { type: action }
  }
  return liftedAction
}

export function send(action, state, type, options) {
  start()
  setTimeout(() => {
    const message = {
      payload: state ? stringify(state) : '',
      action: type === 'ACTION' ? stringify(transformAction(action, options)) : action,
      type: type || 'ACTION',
      id: options.instanceId,
      instanceId: options.instanceId,
      name: options.name,
    }
    message.libConfig = {
      type: options.type,
      name: options.name,
      serialize: !!options.serialize,
      actionCreators: options.actionCreators,
    }
    postMessage({ __IS_REDUX_NATIVE_MESSAGE__: true, content: message })
  }, 0)
}

export function connect(options = {}) {
  const id = generateId(options.instanceId)
  const opts = {
    ...options,
    instanceId: id,
    name: options.name || id,
    actionCreators: JSON.stringify(getActionsArray(options.actionCreators || {})),
  }
  start()
  return {
    init(state, action) {
      send(action || {}, state, 'INIT', opts)
    },
    subscribe(listener) {
      if (!listener) return undefined
      if (!listeners[id]) listeners[id] = []
      listeners[id].push(listener)

      return function unsubscribe() {
        const index = listeners[id].indexOf(listener)
        listeners[id].splice(index, 1)
      }
    },
    unsubscribe() {
      delete listeners[id]
    },
    send(action, payload) {
      if (action) {
        send(action, payload, 'ACTION', opts)
      } else {
        send(undefined, payload, 'STATE', opts)
      }
    },
    error(payload) {
      send(undefined, payload, 'Error', opts)
    },
  }
}

// Not implemented
export function disconnect() {}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #565** (2021-01-13): **Apollo Dev Tools don't refresh data**
  *Symptoms*: I'm not able to see whats in my cache via apollo dev tools. ![image](https://user-images.githubusercontent.com/7379922/103500627-b8ac5380-4e9f-11eb-81ec-7b6a27cd9255.png)  However I can see the cache if I run __APOLLO_CLIENT__.cache.data.data in the console, so the data is there. ![image](https://user-images.githubusercontent.com/7379922/103500651-d24d9b00-4e9f-11eb-805f-3259e507d6b1.png)  I found a similar issue in apollo-client-devtools repo: https://github.com/apollographql/apollo-client-devtools/issues/294  The above issue is resolved in v2.3.4 https://github.com/apollographql/apollo-client-devtools/pull/321  I think we need to bump up the Apollo dev tool to the latest. 

- **Issue #564** (2023-07-21): **`rndebugger-open` makes no action on RN 0.63.3**
  *Symptoms*: React Native Debugger app version: 0.11.6 react-native-debugger-open: 0.3.25 react-native: 0.63.3 @react-native-community/cli: 4.13.0 @react-native-community/cli-server-api: 4.13.0 Platform: iOS Is real device of platform: No Operating System: macOS  This is bit similar to #328, however in this case`rndebugger-open` command silently passes without making any patch.  Latest `0.3.25` version doesn't seem to support latest `@react-native-community` version as its structure has changed and apparently patch script should now target `cli-server-api` package rather than `cli`, meanwhile none of the `rnFlags` point to new location.  Also, I think result of this line https://github.com/jhen0409/react-native-debugger/blob/master/npm-package/src/injectDevToolsMiddleware.js#L183 should be returned (as well as the other branch of the same condition). Otherwise, as in described scenario, it returns `false`, however inject function returns `true` even though patch wasn't successful:  ```javascript return (Array.isArray(flagList) ? flagList : [flagList]).some(flag => injectCode(modulePath, flag)); ```

- **Issue #507** (2020-05-05): **ReactInspector: Fix layout update issue if backend try to reconnect**
  *Symptoms*: Related #494.  NOTE: This just fixed the inspector UI update issue, but not for the console errors. (it's upstream issue)

- **Issue #506** (2020-05-05): **Check module isn't null on lookupForRNModules**
  *Symptoms*: Closes #500.

- **Issue #505** (2020-05-05): **Fix setTouchBar due to API change**
  *Symptoms*: Closes #495.

- **Issue #503** (2020-05-05): **Fix inspector style issue on Electron >= v8.0**
  *Symptoms*: Closes #502.

- **Issue #502** (2020-05-05): **[UI chaos]  ui layer error**
  *Symptoms*:  ![image](https://user-images.githubusercontent.com/29938227/80173125-73056e80-8621-11ea-90b6-b0185881a5d2.png)   React Native Debugger app version: [0.11.1] React Native version: [0.62.2] Operating System: [macOs]  <!-- Love react-native-debugger? Please consider supporting our collective: 👉  https://opencollective.com/react-native-debugger/donate --> 
  **Post-Mortem & Fix Analysis**:
  > Same here

- **Issue #500** (2020-05-05): **React-native app with polyfills limits debug functionalities**
  *Symptoms*: <!-- Before submitting the issue:  - You're using the latest version of react-native-debugger - You have read the documentation - For the feature requests / issues of devtools integration like React / Redux / Apollo, you should submit an issue to that repo   - https://github.com/facebook/react-devtools/issues   - https://github.com/reduxjs/redux-devtools/issues   - https://github.com/apollographql/apollo-client-devtools/issues -->  <!-- Please provide the following information for bug report or question, if you can provide a minimal example project or screenshot or even video would be helpful for reproduce the problem. You can just removed these if you want to submit a feature request: -->  React Native Debugger app version: 0.10.7 React Native version: 0.61.4 Platform: android (need to test on iOS) Is real device of platform: yes Operating System: macOS (need to test on other OS)  In a react-native app, adding this (requiring core-js polyfills) to the start of the entrypoint index.js: ```javascript import 'core-js/stable'; import 'regenerator-runtime/runtime'; ```  Will limit some of the functionalities of React Native Debugger such as: - reloading the app from the debugger - see react-native native modules from the js console of the debugger - toggle the inspector from the debugger  Expected: React Native Debugger should detect this case and handle it in order not to lose the functionalities described above.  <!-- Love react-native-debugge
  **Post-Mortem & Fix Analysis**:
  > In comparison, debugging using `http://localhost:8081/debugger-ui/` on Chrome works as intended (reload the app button works).

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

### Incident Patch 1: `988fae8c` (2023-07-30)
**Commit Message**: Revert patch of apollo-client-devtools in dist/

**File**: `dist/patches/apollo-client-devtools+4.1.4.patch` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+diff --git a/node_modules/apollo-client-devtools/build/background.js b/node_modules/apollo-client-devtools/build/background.js
+index 1b46d15..5767881 100644
+--- a/node_modules/apollo-client-devtools/build/background.js
++++ b/node_modules/apollo-client-devtools/build/background.js
+@@ -171,21 +171,21 @@ chrome.runtime.onConnect.addListener(port => {
+ 
+ Object.defineProperty(exports, "__esModule", ({ value: true }));
+ exports.RELOAD_TAB_COMPLETE = exports.RELOADING_TAB = exports.EXPLORER_RESPONSE = exports.EXPLORER_REQUEST = exports.PANEL_CLOSED = exports.PANEL_OPEN = exports.UPDATE = exports.REQUEST_DATA = exports.ACTION_HOOK_FIRED = exports.CREATE_DEVTOOLS_PANEL = exports.APOLLO_CLIENT_FOUND = exports.FIND_APOLLO_CLIENT = exports.DEVTOOLS_INITIALIZED = exports.REQUEST_TAB_ID = exports.CLIENT_FOUND = void 0;
+-exports.CLIENT_FOUND = "client-found";
+-exports.REQUEST_TAB_ID = "request-tab-id";
+-exports.DEVTOOLS_INITIALIZED = "devtools-initialized";
+-exports.FIND_APOLLO_CLIENT = "find-apollo-client";
+-exports.APOLLO_CLIENT_FOUND = "apollo-client-found";
+-exports.CREATE_DEVTOOLS_PANEL = "create-devtools-panel";
+-exports.ACTION_HOOK_FIRED = "action-hook-fired";
+-exports.REQUEST_DATA = "request-data";
+-exports.UPDATE = "update";
+-exports.PANEL_OPEN = "panel-open";
+-exports.PANEL_CLOSED = "panel-closed";
+-exports.EXPLORER_REQUEST = "explorer-request";
+-exports.EXPLORER_RESPONSE = "explorer-response";
+-exports.RELOADING_TAB = "reloading-tab";
+-exports.RELOAD_TAB_COMPLETE = "reload-tab-complete";
++exports.CLIENT_FOUND = "ac-devtools:client-found";
++exports.REQUEST_TAB_ID = "ac-devtools:request-tab-id";
++exports.DEVTOOLS_INITIALIZED = "ac-devtools:devtools-initialized";
++exports.FIND_APOLLO_CLIENT = "ac-devtools:find-apollo-client";
++exports.APOLLO_CLIENT_FOUND = "ac-devtools:apollo-client-found";
++exports.CREATE_DEVTOOLS_PANEL = "ac-devtools:create-devtools-panel";
++exports.ACTION_HOOK_FIRED = "ac-devtools:action-hook-fired";
++exports.REQUEST_DATA = "ac-devtools:request-data";
++exports.UPDATE = "ac-devtools:update";
++exports.PANEL_OPEN = "ac-devtools:panel-open";
++exports.PANEL_CLOSED = "ac-devtools:panel-closed";
++exports.EXPLORER_REQUEST = "ac-devtools:explorer-request";
++exports.EXPLORER_RESPONSE = "ac-devtools:explorer-response";
++exports.RELOADING_TAB = "ac-devtools:reloading-tab";
++exports.RELOAD_TAB_COMPLETE = "ac-devtools:reload-tab-complete";
+ 
+ 
+ /***/ })
+diff --git a/node_modules/apollo-client-devtools/build/devtools.js b/node_modules/apollo-client-devtools/build/devtools.js
+index 165495f..8290715 100644
+--- a/node_modules/apollo-client-devtools/build/devtools.js
++++ b/node_modules/apollo-client-devtools/build/devtools.js
+@@ -165,22 +165,21 @@ exports["default"] = EventTarget;
+ 
+ Object.defineProperty(exports, "__esModule", ({ value: true }));
+ exports.RELOAD_TAB_COMPLETE = exports.RELOADING_TAB = exports.EXPLORER_RESPONSE = exports.EXPLORER_REQUEST = exports.PANEL_CLOSED = exports.PANEL_OPEN = exports.UPDATE = exports.REQUEST_DATA = exports.ACTION_HOOK_FIRED = exports.CREATE_DEVTOOLS_PANEL = exports.APOLLO_CLIENT_FOUND = exports.FIND_APOLLO_CLIENT = exports.DEVTOOLS_INITIALIZED = exports.REQUEST_TAB_ID = exports.CLIENT_FOUND = void 0;
+-exports.CLIENT_FOUND = "client-found";
+-exports.REQUEST_TAB_ID = "request-tab-id";
+-exports.DEVTOOLS_INITIALIZED = "devtools-initialized";
+-exports.FIND_APOLLO_CLIENT = "find-apollo-client";
+-exports.APOLLO_CLIENT_FOUND = "apollo-client-found";
+-exports.CREATE_DEVTOOLS_PANEL = "create-devtools-panel";
+-exports.ACTION_HOOK_FIRED = "action-hook-fired";
+-exports.REQUEST_DATA = "request-data";
+-exports.UPDATE = "update";
+-exports.PANEL_OPEN = "panel-open";
+-exports.PANEL_CLOSED = "panel-closed";
+-exports.EXPLORER_REQUEST = "explorer-request";
+-exports.EXPLORER_RESPONSE = "explorer-response";
+-exports.RELOADING_TAB = "reloading-tab";
+-exports.RELOAD_TAB_COMPLETE = "reload-tab-complete";
+-
++exports.CLIENT_FOUND = "ac-devtools:client-found";
++exports.REQUEST_TAB_ID = "ac-devtools:request-tab-id";
++exports.DEVTOOLS_INITIALIZED = "ac-devtools:devtools-initialized";
++exports.FIND_APOLLO_CLIENT = "ac-devtools:find-apollo-client";
++exports.APOLLO_CLIENT_FOUND = "ac-devtools:apollo-client-found";
++exports.CREATE_DEVTOOLS_PANEL = "ac-devtools:create-devtools-panel";
++exports.ACTION_HOOK_FIRED = "ac-devtools:action-hook-fired";
++exports.REQUEST_DATA = "ac-devtools:request-data";
++exports.UPDATE = "ac-devtools:update";
++exports.PANEL_OPEN = "ac-devtools:panel-open";
++exports.PANEL_CLOSED = "ac-devtools:panel-closed";
++exports.EXPLORER_REQUEST = "ac-devtools:explorer-request";
++exports.EXPLORER_RESPONSE = "ac-devtools:explorer-response";
++exports.RELOADING_TAB = "ac-devtools:reloading-tab";
++exports.RELOAD_TAB_COMPLETE = "ac-devtools:reload-tab-complete";
+ 
+ /***/ }),
+ 
+diff --git a/node_modules/apollo-client-devtools/build/hook.js b/node_modules/apollo-client-devtools/build/hook.js
+index 63
```

---

### Incident Patch 2: `f6333cdf` (2023-07-30)
**Commit Message**: Update README.md (Add `Build from source` section)

**File**: `README.md` (modified, +4/-0)
```diff
@@ -69,6 +69,10 @@ makepkg -si
 paru -S react-native-debugger-bin
 ```
 
+## Build from source
+
+Please read [Development section](docs/contributing.md#development) in docs/contributing.md for how to build the app from source.
+
 ## Documentation
 
 - [Getting Started](docs/getting-started.md)
```

---

### Incident Patch 3: `7a01a43e` (2023-07-30)
**Commit Message**: Fix host of adb client on electron 25 (node 18)

**File**: `app/utils/adb.js` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import adb from 'adbkit'
 
-export const client = adb.createClient()
+export const client = adb.createClient({ host: '127.0.0.1' })
 
 const reverse = (device, port) => client.reverse(device, `tcp:${port}`, `tcp:${port}`)
 
```

---

### Incident Patch 4: `9146b413` (2023-07-30)
**Commit Message**: Revert "Use styled-components for global styles"

**File**: `app/globalStyles.js` (modified, +1/-45)
```diff
@@ -1,50 +1,6 @@
 import { css, createGlobalStyle } from 'styled-components'
 
-const commonStyles = css`
-  html,
-  body {
-    font-family: monaco, Consolas, Lucida Console, monospace;
-    overflow: hidden;
-    font-size: 100%;
-    margin: 0;
-    padding: 0;
-    width: 100%;
-    height: 100%;
-    background-color: rgb(53, 59, 70);
-  }
-
-  #root {
-    width: 100%;
-    height: 100%;
-  }
-  #logs {
-    position: fixed;
-    top: 0;
-    left: 0;
-    white-space: pre;
-  }
-  #loading {
-    color: #aaa;
-    font-size: 30px;
-    display: flex;
-    height: 100%;
-    justify-content: center;
-    align-items: center;
-  }
-
-  @media print {
-    @page {
-      size: auto;
-      margin: 0;
-    }
-    body {
-      position: static;
-    }
-  }
-  .CodeMirror {
-    font-family: monaco, Consolas, Lucida Console, monospace !important;
-  }
-`
+const commonStyles = css``
 
 export const GlobalStyle =
   process.platform !== 'darwin'
```

**File**: `dist/app.html` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
   <head>
     <meta charset=utf-8>
     <title>React Native Debugger</title>
+    <link href='css/style.css' rel="stylesheet" />
   </head>
   <body>
     <div id="root">
```

**File**: `dist/css/style.css` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+html,
+body {
+  font-family: monaco, Consolas, Lucida Console, monospace;
+  overflow: hidden;
+  font-size: 100%;
+  margin: 0;
+  padding: 0;
+  width: 100%;
+  height: 100%;
+  background-color: rgb(53, 59, 70);
+}
+
+#root {
+  width: 100%;
+  height: 100%;
+}
+#logs {
+  position: fixed;
+  top: 0;
+  left: 0;
+  white-space: pre;
+}
+#loading {
+  color: #aaa;
+  font-size: 30px;
+  display: flex;
+  height: 100%;
+  justify-content: center;
+  align-items: center;
+}
+
+::-webkit-scrollbar {
+  width: 8px;
+  height: 8px;
+  background-color: #555;
+}
+::-webkit-scrollbar-thumb {
+  background-color: #333;
+}
+::-webkit-scrollbar-corner {
+  background-color: #333;
+}
+
+@media print {
+  @page {
+    size: auto;
+    margin: 0;
+  }
+  body {
+    position: static;
+  }
+}
+.CodeMirror {
+  font-family: monaco, Consolas, Lucida Console, monospace !important;
+}
```

**File**: `electron/app.html` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
   <head>
     <meta charset=utf-8>
     <title>React Native Debugger</title>
+    <link href='../dist/css/style.css' rel="stylesheet" />
   </head>
   <body>
     <div id="root">
```

---

### Incident Patch 5: `fe185790` (2023-07-29)
**Commit Message**: Redux DevTools: Fix overflow

**File**: `app/containers/redux/DevTools.js` (modified, +5/-2)
```diff
@@ -1,11 +1,14 @@
 import React from 'react'
 import { useSelector, useDispatch } from 'react-redux'
+import styled from 'styled-components'
 import { Container, Notification } from '@redux-devtools/ui'
 import { clearNotification } from '@redux-devtools/app/lib/esm/actions'
 import Actions from '@redux-devtools/app/lib/esm/containers/Actions'
 import Settings from './Settings'
 import Header from './Header'
 
+const StyledContainer = styled(Container)`overflow: hidden;`
+
 function App() {
   const section = useSelector((state) => state.section)
   const theme = useSelector((state) => state.theme)
@@ -23,7 +26,7 @@ function App() {
   }
 
   return (
-    <Container themeData={theme}>
+    <StyledContainer themeData={theme}>
       <Header section={section} />
       {body}
       {notification && (
@@ -34,7 +37,7 @@ function App() {
           {notification.message}
         </Notification>
       )}
-    </Container>
+    </StyledContainer>
   )
 }
 
```

---

### Incident Patch 6: `a3eacd67` (2023-07-28)
**Commit Message**: Fix source map warning from react-devtools

**File**: `scripts/patch-modules.js` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+const shell = require('shelljs')
+const path = require('path')
+
+console.log('Patch react-devtools-core')
+
+const rdStandalone = path.join(
+  __dirname,
+  '../dist/node_modules/react-devtools-core/dist/standalone.js',
+)
+
+// Avoid source map not found war
+shell.sed(
+  '-i',
+  /sourceMappingURL=importFile\.worker\.worker\.js\.map'\]\)\),\{name:"\[name\]\.worker\.js/g,
+  `sourceMappingURL_NotUsed=importFile.worker.worker.js.map'])),{name:"ReactDevToolsImportFile.worker.js`,
+  rdStandalone,
+)
```

**File**: `scripts/postinstall.js` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}',
   )
+  // eslint-disable-next-line
+  require('./patch-modules')
 }
 
 run()
```

---

### Incident Patch 7: `569b3c74` (2023-07-26)
**Commit Message**: Fix react root render

**File**: `app/index.js` (modified, +0/-1)
```diff
@@ -43,7 +43,6 @@ const handleReady = () => {
           <App />
         </PersistGate>
       </Provider>,
-      document.getElementById('root'),
     )
   })
 };
```

---

### Incident Patch 8: `a1c272ca` (2023-07-25)
**Commit Message**: Upgrade redux-devtools to latest version (#781)

* Initial work of @redux-devtools/app upgrade

* Add missing PersistGate

* Fix lint errors

* Add patches/@redux-devtools+inspector-monitor-trace-tab+1.0.0.patch

* Add window dragable in header & custom buttons

* Custom Settings (Remove connection tab)

* Fix tabs style

* Update docs/redux-devtools-integration.md

* Update default instances state

* Update E2E tests

* Remove socketcluster-client alias

* Cleanup

**File**: `__e2e__/app.spec.js` (modified, +30/-26)
```diff
@@ -202,72 +202,76 @@ describe('Application launch', () => {
     });
 
     it('should have @@INIT action on Redux DevTools', async () => {
-      expect(
-        await mainWindow.textContent('//div[contains(@class, "actionListRows-")]')
-      ).toMatch(/@@redux\/INIT/); // Last store is `RemoteDev store instance 1`
+      const el = await mainWindow.locator('div').filter({ hasText: '@@redux/INIT' }).first();
+      expect(await el.isVisible()).toBeTruthy(); // Last store is `RemoteDev store instance 1`
     });
 
     let currentInstance = 'Autoselect instances'; // Default instance
     const wait = () => delay(750);
     const selectInstance = async (instance) => {
-      await mainWindow.click(`//div[text()="${currentInstance}"]`);
+      let el = mainWindow.locator(`//div[text()="${currentInstance}"]`);
+      expect(await el.isVisible()).toBeTruthy();
+      await el.click({ force: true });
       await wait();
       currentInstance = instance;
-      await mainWindow.click(`//div[text()="${instance}"]`);
+      el = mainWindow.locator(`//div[text()="${instance}"]`);
+      expect(await el.isVisible()).toBeTruthy();
+      await el.click({ force: true });
       await wait();
     };
     const commit = async () => {
-      await mainWindow.click('//div[text()="Commit"]');
+      await mainWindow.click('//button[text()="Commit"]', { force: true });
       await wait();
     };
 
     const expectActions = {
       'Redux store instance 1': {
         expt: [
-          /@@INIT/,
-          /TEST_PASS_FOR_REDUX_STORE_1/,
-          /SHOW_FOR_REDUX_STORE_1/,
+          '@@INIT',
+          'TEST_PASS_FOR_REDUX_STORE_1',
+          'SHOW_FOR_REDUX_STORE_1',
         ],
-        notExpt: [/NOT_SHOW_FOR_REDUX_STORE_1/, /TEST_PASS_FOR_REDUX_STORE_2/],
+        notExpt: ['NOT_SHOW_FOR_REDUX_STORE_1', 'TEST_PASS_FOR_REDUX_STORE_2'],
       },
       'Redux store instance 2': {
-        expt: [/@@INIT/, /TEST_PASS_FOR_REDUX_STORE_2/],
+        expt: ['@@INIT', 'TEST_PASS_FOR_REDUX_STORE_2'],
         notExpt: [
-          /TEST_PASS_FOR_REDUX_STORE_1/,
-          /NOT_SHOW_1_FOR_REDUX_STORE_2/,
-          /NOT_SHOW_2_FOR_REDUX_STORE_2/,
-          /NOT_SHOW_3_FOR_REDUX_STORE_2/,
+          'TEST_PASS_FOR_REDUX_STORE_1',
+          'NOT_SHOW_1_FOR_REDUX_STORE_2',
+          'NOT_SHOW_2_FOR_REDUX_STORE_2',
+          'NOT_SHOW_3_FOR_REDUX_STORE_2',
         ],
       },
       'MobX store instance 1': {
-        expt: [/@@INIT/, /testPassForMobXStore1/],
-        notExpt: [/TEST_PASS_FOR_REDUX_STORE_2/],
+        expt: ['@@INIT', 'testPassForMobXStore1'],
+        notExpt: ['TEST_PASS_FOR_REDUX_STORE_2'],
       },
       'MobX store instance 2': {
-        expt: [/@@INIT/, /testPassForMobXStore2/],
-        notExpt: [/testPassForMobXStore1/],
+        expt: ['@@INIT', 'testPassForMobXStore2'],
+        notExpt: ['testPassForMobXStore1'],
       },
       'RemoteDev store instance 1': {
-        expt: [/@@redux\/INIT/, /TEST_PASS_FOR_REMOTEDEV_STORE_1/],
-        notExpt: [/testPassForMobXStore2/],
+        expt: ['@@redux/INIT', 'TEST_PASS_FOR_REMOTEDEV_STORE_1'],
+        notExpt: ['testPassForMobXStore2'],
       },
     };
 
-    const runExpectActions = (name, val) => {
+    const runExpectActions = async (name) => {
       const { expt, notExpt } = expectActions[name];
 
       for (const action of expt) {
-        expect(val).toMatch(action);
+        const el = await mainWindow.locator('div').filter({ hasText: action }).first();
+        expect(await el.isVisible()).toBeTruthy();
       }
       for (const action of notExpt) {
-        expect(val).not.toMatch(action);
+        const el = await mainWindow.locator('div').filter({ hasText: action }).first();
+        expect(await el.isVisible()).toBeFalsy();
       }
     };
 
     const checkInstance = async (name) => {
       await selectInstance(name);
-      const val = await mainWindow.textContent('//div[contains(@class, "actionListRows-")]');
-      runExpectActions(name, val);
+      await runExpectActions(name);
       await commit();
     };
 
```

**File**: `app/containers/App.js` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { bindActionCreators } from 'redux';
 import { connect } from 'react-redux';
 import * as debuggerActions from '../actions/debugger';
 import * as settingActions from '../actions/setting';
-import ReduxDevTools from './ReduxDevTools';
+import ReduxDevTools from './redux/DevTools';
 import ReactInspector from './ReactInspector';
 import FormInput from '../components/FormInput';
 import Draggable from '../components/Draggable';
```

**File**: `app/containers/ReactInspector.js` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ const styles = {
   waiting: {
     height: '100%',
     display: 'flex',
-    webkitUserSelect: 'none',
+    WebkitUserSelect: 'none',
     textAlign: 'center',
     color: '#aaa',
     justifyContent: 'center',
```

**File**: `app/containers/ReduxDevTools.js` (removed, +0/-143)
```diff
@@ -1,143 +0,0 @@
-import 'remotedev-monitor-components/lib/presets';
-
-import React, { Component } from 'react';
-import { shell } from 'electron';
-import PropTypes from 'prop-types';
-import { bindActionCreators } from 'redux';
-import { connect } from 'react-redux';
-
-import SliderMonitor from 'remotedev-slider/lib/Slider';
-
-import enhance from 'remotedev-app/lib/hoc';
-import styles from 'remotedev-app/lib/styles';
-import { liftedDispatch as liftedDispatchAction } from 'remotedev-app/lib/actions';
-import { getActiveInstance } from 'remotedev-app/lib/reducers/instances';
-
-import DevTools from 'remotedev-app/lib/containers/DevTools';
-import Dispatcher from 'remotedev-app/lib/containers/monitors/Dispatcher';
-import Notification from 'remotedev-app/lib/components/Notification';
-import Instances from 'remotedev-app/lib/components/Instances';
-import MonitorSelector from 'remotedev-app/lib/components/MonitorSelector';
-
-// Button bar
-import DispatcherButton from 'remotedev-app/lib/components/buttons/DispatcherButton';
-import ImportButton from 'remotedev-app/lib/components/buttons/ImportButton';
-import ExportButton from 'remotedev-app/lib/components/buttons/ExportButton';
-import SliderButton from 'remotedev-app/lib/components/buttons/SliderButton';
-import LockButton from 'remotedev-app/lib/components/buttons/LockButton';
-import RecordButton from 'remotedev-app/lib/components/buttons/RecordButton';
-import PrintButton from 'remotedev-app/lib/components/buttons/PrintButton';
-import Button from 'remotedev-app/lib/components/Button';
-// eslint-disable-next-line
-import HelpIcon from 'react-icons/lib/fa/lightbulb-o';
-
-const sliderStyle = {
-  padding: '15px 5px',
-  backgroundColor: 'rgb(53, 59, 70)',
-  color: 'white',
-};
-const containerStyle = {
-  ...styles.container,
-  fontSize: 12,
-};
-
-const devtoolsStyle = {
-  height: '100%', overflow: 'auto',
-};
-
-class ReduxDevTools extends Component {
-  static propTypes = {
-    style: PropTypes.object,
-    debugger: PropTypes.object,
-    liftedDispatch: PropTypes.func.isRequired,
-    selected: PropTypes.string,
-    liftedState: PropTypes.object.isRequired,
-    monitorState: PropTypes.object,
-    options: PropTypes.object.isRequired,
-    monitor: PropTypes.string,
-    dispatcherIsOpen: PropTypes.bool,
-    sliderIsOpen: PropTypes.bool,
-  };
-
-  openHelp = () => shell.openExternal('https://goo.gl/SHU4yL');
-
-  render() {
-    const {
-      selected,
-      monitor,
-      dispatcherIsOpen,
-      sliderIsOpen,
-      liftedState,
-      liftedDispatch,
-      monitorState,
-      options,
-    } = this.props;
-    const isRedux = options.lib === 'redux';
-    const isConnected = !!options.connectionId;
-    const isSliderOpen = sliderIsOpen && isConnected;
-    const isDispathcerOpen = dispatcherIsOpen && isConnected;
-    return (
-      <div className="redux-container" style={containerStyle}>
-        <div style={styles.buttonBar}>
-          <MonitorSelector selected={monitor} />
-          <Instances selected={selected} />
-        </div>
-        <div style={devtoolsStyle}>
-          <DevTools
-            monitor={monitor}
-            liftedState={liftedState}
-            monitorState={monitorState}
-            dispatch={liftedDispatch}
-            lib={options.lib}
-          />
-        </div>
-        <Notification />
-        {isSliderOpen && (
-          <SliderMonitor
-            monitor="SliderMonitor"
-            liftedState={liftedState}
-            dispatch={liftedDispatch}
-            showActions={monitor === 'ChartMonitor'}
-            style={sliderStyle}
-            fillColor="rgb(120, 144, 156)"
-          />
-        )}
-        {isDispathcerOpen && <Dispatcher options={options} />}
-        <div className="redux-buttonbar" style={styles.buttonBar}>
-          {isRedux && <RecordButton paused={liftedState.isPaused} />}
-          {isRedux && <LockButton locked={liftedState.isLocked} />}
-          <DispatcherButton dispatcherIsOpen={dispatcherIsOpen} />
-          <SliderButton isOpen={sliderIsOpen} />
-          <ImportButton />
-          <ExportButton liftedState={liftedState} />
-          <PrintButton />
-          {!isConnected && (
-            <Button Icon={HelpIcon} onClick={this.openHelp}>
-              How to use
-            </Button>
-          )}
-        </div>
-      </div>
-    );
-  }
-}
-
-export default connect(
-  state => {
-    const instances = state.instances;
-    const id = getActiveInstance(instances);
-    return {
-      selected: instances.selected,
-      liftedState: instances.states[id],
-      monitorState: state.monitor.monitorState,
-      options: instances.options[id],
-      monitor: state.monitor.selected,
-      dispatcherIsOpen: state.monitor.dispatcherIsOpen,
-      sliderIsOpen: state.monitor.sliderIsOpen,
-    };
-  },
-  dispatch => ({
-    liftedDispatch: bindActionCreators(liftedDispatchAction, dispatch),
-    dispatch,
-  })
-)(enhance(ReduxDevTool
```

**File**: `app/containers/redux/DevTools.js` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import React from 'react';
+import { useSelector, useDispatch } from 'react-redux';
+import { Container, Notification } from '@redux-devtools/ui';
+import { clearNotification } from '@redux-devtools/app/lib/esm/actions';
+import Actions from '@redux-devtools/app/lib/esm/containers/Actions';
+import Settings from './Settings';
+import Header from './Header';
+
+const App = () => {
+  const section = useSelector(state => state.section);
+  const theme = useSelector(state => state.theme);
+  const notification = useSelector(state => state.notification);
+
+  const dispatch = useDispatch();
+
+  let body;
+  switch (section) {
+    case 'Settings':
+      body = <Settings />;
+      break;
+    default:
+      body = <Actions />;
+  }
+
+  return (
+    <Container themeData={theme}>
+      <Header section={section} />
+      {body}
+      {notification && (
+        <Notification
+          type={notification.type}
+          onClose={() => dispatch(clearNotification())}
+        >
+          {notification.message}
+        </Notification>
+      )}
+    </Container>
+  );
+};
+
+export default App;
```

**File**: `app/containers/redux/Header.js` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+import React, { useCallback } from 'react';
+import PropTypes from 'prop-types';
+import { useDispatch } from 'react-redux';
+import { Tabs, Toolbar, Button, Divider } from '@redux-devtools/ui';
+import { GoBook } from 'react-icons/go';
+import styled from 'styled-components';
+import { changeSection } from '@redux-devtools/app/lib/esm/actions';
+import { shell } from 'electron';
+
+const WindowDraggable = styled.div`
+  display: flex;
+  flex: 1;
+  height: 100%;
+  -webkit-app-region: drag;
+  -webkit-user-select: none;
+`;
+
+const tabs = [{ name: 'Actions' }, { name: 'Settings' }];
+
+const Header = (props) => {
+  const { section } = props;
+
+  const dispatch = useDispatch();
+
+  const handleChangeSection = useCallback(
+    (sec) => dispatch(changeSection(sec)),
+    [dispatch, changeSection],
+  );
+
+  const openHelp = useCallback(() => shell.openExternal('https://goo.gl/SHU4yL'), []);
+
+  return (
+    <Toolbar compact noBorder borderPosition="bottom">
+      <Tabs
+        main
+        collapsible
+        tabs={tabs}
+        onClick={handleChangeSection}
+        selected={section || 'Actions'}
+        style={{ flex: 'unset' }}
+      />
+      <WindowDraggable />
+      <Divider />
+      <Button
+        title="Documentation"
+        tooltipPosition="bottom"
+        onClick={openHelp}
+      >
+        <GoBook />
+      </Button>
+    </Toolbar>
+  );
+};
+
+Header.propTypes = {
+  section: PropTypes.string,
+};
+
+export default Header;
```

**File**: `app/containers/redux/Settings.js` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+/* eslint-disable import/no-named-as-default */
+import React, { Component } from 'react';
+import Tabs from '@redux-devtools/ui/lib/esm/Tabs/Tabs';
+import Themes from '@redux-devtools/app/lib/esm/components/Settings/Themes';
+
+export default class Settings extends Component {
+  state = { selected: 'Themes' };
+
+  tabs = [
+    { name: 'Themes', component: Themes },
+  ];
+
+  handleSelect = (selected) => {
+    this.setState({ selected });
+  };
+
+  render() {
+    return (
+      <Tabs
+        tabs={this.tabs}
+        selected={this.state.selected}
+        onClick={this.handleSelect}
+      />
+    );
+  }
+}
```

**File**: `app/index.js` (modified, +19/-12)
```diff
@@ -5,6 +5,7 @@ import React from 'react';
 import { render } from 'react-dom';
 import { Provider } from 'react-redux';
 import launchEditor from 'react-dev-utils/launchEditor';
+import { PersistGate } from 'redux-persist/integration/react';
 import './setup';
 import App from './containers/App';
 import configureStore from './store/configureStore';
@@ -29,7 +30,24 @@ document.addEventListener('dragover', e => {
   e.stopPropagation();
 });
 
-const store = configureStore();
+let store;
+let persistor;
+const handleReady = () => {
+  const { defaultReactDevToolsPort = 19567 } = config;
+  findAPortNotInUse(Number(defaultReactDevToolsPort)).then(port => {
+    window.reactDevToolsPort = port;
+    render(
+      <Provider store={store}>
+        <PersistGate loading={null} persistor={persistor}>
+          <App />
+        </PersistGate>
+      </Provider>,
+      document.getElementById('root')
+    );
+  });
+};
+
+({ store, persistor } = configureStore(handleReady));
 
 // Provide for user
 window.adb = client;
@@ -77,14 +95,3 @@ if (
 ) {
   process.env.PATH = `${process.env.PATH}:/usr/local/bin`;
 }
-
-const { defaultReactDevToolsPort = 19567 } = config;
-findAPortNotInUse(Number(defaultReactDevToolsPort)).then(port => {
-  window.reactDevToolsPort = port;
-  render(
-    <Provider store={store}>
-      <App />
-    </Provider>,
-    document.getElementById('root')
-  );
-});
```

---

### Incident Patch 9: `4345db48` (2023-07-23)
**Commit Message**: Fix react-devtools projectRoots parse

**File**: `electron/url-handle/handleURL.js` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ export const parseUrl = _url => {
   const query = {
     host: resolveHost(host),
     port: Number(port) || 8081,
-    projectRoots: Array.isArray(projectRoots) ? filterPaths(projectRoots.split(',')) : undefined,
+    projectRoots: filterPaths(Array.isArray(projectRoots) ? projectRoots : [projectRoots]),
   };
   return query;
 };
```

**File**: `npm-package/src/injectDevToolsMiddleware.js` (modified, +2/-1)
```diff
@@ -91,7 +91,8 @@ const rnFlags = {
       replaceFunc:
         "function launchDefaultDebugger(host, port, args = '', skipRNDebugger) {",
       funcCall: '(host, port, args, true)',
-      args: "(host || 'localhost') + '&port=' + port + '&args=' + args",
+      args: "(host || 'localhost') + '&port=' + port + '&projectRoots=' + process.cwd() + " +
+        "'&args=' + args",
     },
   ],
 };
```

---

### Incident Patch 10: `05f42b59` (2023-07-23)
**Commit Message**: Revert "Fix react-devtools not auto detect system theme"

This reverts commit 98ed518bdc5e365a3e8ed812842ce4f747a15f3b.

**File**: `scripts/patch-modules.js` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-const shell = require('shelljs');
-const path = require('path');
-
-console.log('Patch react-devtools-core');
-
-const rdStandalone = path.join(
-  __dirname,
-  '../dist/node_modules/react-devtools-core/dist/standalone.js'
-);
-
-// Make react-devtools-core to auto detect theme
-// We still use this patch because patch-package to patch js bundle is not very ideal
-shell.sed(
-  '-i',
-  // eslint-disable-next-line
-  /bridge:e,browserTheme:t="light"/,
-  'bridge:e,browserTheme:t="auto"',
-  rdStandalone
-);
```

**File**: `scripts/postinstall.js` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}'
   );
-  // eslint-disable-next-line
-  require('./patch-modules');
 }
 
 run();
```

---

### Incident Patch 11: `98ed518b` (2023-07-23)
**Commit Message**: Fix react-devtools not auto detect system theme

**File**: `scripts/patch-modules.js` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+const shell = require('shelljs');
+const path = require('path');
+
+console.log('Patch react-devtools-core');
+
+const rdStandalone = path.join(
+  __dirname,
+  '../dist/node_modules/react-devtools-core/dist/standalone.js'
+);
+
+// Make react-devtools-core to auto detect theme
+// We still use this patch because patch-package to patch js bundle is not very ideal
+shell.sed(
+  '-i',
+  // eslint-disable-next-line
+  /bridge:e,browserTheme:t="light"/,
+  'bridge:e,browserTheme:t="auto"',
+  rdStandalone
+);
```

**File**: `scripts/postinstall.js` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}'
   );
+  // eslint-disable-next-line
+  require('./patch-modules');
 }
 
 run();
```

---

### Incident Patch 12: `8cc850b6` (2023-07-22)
**Commit Message**: Fix devtools left toolbar not removed

**File**: `electron/devtools.js` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ export const removeUnecessaryTabs = win => {
         tabbedPane.closeTab('audits2');
         tabbedPane.closeTab('lighthouse');
 
-        tabbedPane._leftToolbar._contentElement.remove();
+        tabbedPane.leftToolbar().element.remove();
       }
     })()`);
   }
```

---

### Incident Patch 13: `e4ee909a` (2023-07-22)
**Commit Message**: [NPM package] Fix babel build

**File**: `npm-package/babel.config.js` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module.exports = (api) => {
   api.cache(true);
   return {
-    presets: [['env', { targets: { node: '12' } }]],
+    presets: [['@babel/preset-env', { targets: { node: '12' } }]],
   };
 };
```

**File**: `npm-package/package.json` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
     "semver": "^5.4.1"
   },
   "devDependencies": {
-    "babel-cli": "^6.24.0",
+    "@babel/cli": "^7.22.9",
     "fs-extra": "^4.0.2",
     "node-fetch": "^2.6.1"
   }
```

**File**: `npm-package/yarn.lock` (modified, +152/-1247)
```diff
@@ -2,18 +2,44 @@
 # yarn lockfile v1
 
 
-abbrev@1:
-  version "1.1.0"
-  resolved "https://registry.yarnpkg.com/abbrev/-/abbrev-1.1.0.tgz#d0554c2256636e2f56e7c2e5ad183f859428d81f"
-  integrity sha1-0FVMIlZjbi9W58LlrRg/hZQo2B8=
+"@babel/cli@^7.22.9":
+  version "7.22.9"
+  resolved "https://registry.yarnpkg.com/@babel/cli/-/cli-7.22.9.tgz#501b3614aeda7399371f6d5991404f069b059986"
+  integrity sha512-nb2O7AThqRo7/E53EGiuAkMaRbb7J5Qp3RvN+dmua1U+kydm0oznkhqbTEG15yk26G/C3yL6OdZjzgl+DMXVVA==
+  dependencies:
+    "@jridgewell/trace-mapping" "^0.3.17"
+    commander "^4.0.1"
+    convert-source-map "^1.1.0"
+    fs-readdir-recursive "^1.1.0"
+    glob "^7.2.0"
+    make-dir "^2.1.0"
+    slash "^2.0.0"
+  optionalDependencies:
+    "@nicolo-ribaudo/chokidar-2" "2.1.8-no-fsevents.3"
+    chokidar "^3.4.0"
+
+"@jridgewell/resolve-uri@3.1.0":
+  version "3.1.0"
+  resolved "https://registry.yarnpkg.com/@jridgewell/resolve-uri/-/resolve-uri-3.1.0.tgz#2203b118c157721addfe69d47b70465463066d78"
+  integrity sha512-F2msla3tad+Mfht5cJq7LSXcdudKTWCVYUgw6pLFOOHSTtZlj6SWNYAp+AhuqLmWdBO2X5hPrLcu8cVP8fy28w==
 
-ajv@^4.9.1:
-  version "4.11.8"
-  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.8.tgz#82ffb02b29e662ae53bdc20af15947706739c536"
-  integrity sha1-gv+wKynmYq5TvcIK8VlHcGc5xTY=
+"@jridgewell/sourcemap-codec@1.4.14":
+  version "1.4.14"
+  resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.4.14.tgz#add4c98d341472a289190b424efbdb096991bb24"
+  integrity sha512-XPSJHWmi394fuUuzDnGz1wiKqWfo1yXecHQMRf2l6hztTO+nPru658AyDngaBe7isIxEkRsPR3FZh+s7iVa4Uw==
+
+"@jridgewell/trace-mapping@^0.3.17":
+  version "0.3.18"
+  resolved "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.18.tgz#25783b2086daf6ff1dcb53c9249ae480e4dd4cd6"
+  integrity sha512-w+niJYzMHdd7USdiH2U6869nqhD2nbfZXND5Yp93qIbEmnDNk7PD48o+YchRVpzMU7M6jVCbenTR7PA1FLQ9pA==
   dependencies:
-    co "^4.6.0"
-    json-stable-stringify "^1.0.1"
+    "@jridgewell/resolve-uri" "3.1.0"
+    "@jridgewell/sourcemap-codec" "1.4.14"
+
+"@nicolo-ribaudo/chokidar-2@2.1.8-no-fsevents.3":
+  version "2.1.8-no-fsevents.3"
+  resolved "https://registry.yarnpkg.com/@nicolo-ribaudo/chokidar-2/-/chokidar-2-2.1.8-no-fsevents.3.tgz#323d72dd25103d0c4fbdce89dadf574a787b1f9b"
+  integrity sha512-s88O1aVtXftvp5bCPB7WnmXc5IwOZZ7YPuwNPt+GtOOXpPvad1LfbmjYv+qII7zP6RU2QGnqve27dnLycEnyEQ==
 
 ansi-regex@^2.0.0:
   version "2.1.1"
@@ -25,272 +51,23 @@ ansi-styles@^2.2.1:
   resolved "https://registry.yarnpkg.com/ansi-styles/-/ansi-styles-2.2.1.tgz#b432dd3358b634cf75e1e4664368240533c1ddbe"
   integrity sha1-tDLdM1i2NM914eRmQ2gkBTPB3b4=
 
-anymatch@^1.3.0:
-  version "1.3.0"
-  resolved "https://registry.yarnpkg.com/anymatch/-/anymatch-1.3.0.tgz#a3e52fa39168c825ff57b0248126ce5a8ff95507"
-  integrity sha1-o+Uvo5FoyCX/V7AkgSbOWo/5VQc=
-  dependencies:
-    arrify "^1.0.0"
-    micromatch "^2.1.5"
-
-aproba@^1.0.3:
-  version "1.1.2"
-  resolved "https://registry.yarnpkg.com/aproba/-/aproba-1.1.2.tgz#45c6629094de4e96f693ef7eab74ae079c240fc1"
-  integrity sha512-ZpYajIfO0j2cOFTO955KUMIKNmj6zhX8kVztMAxFsDaMwz+9Z9SV0uou2pC9HJqcfpffOsjnbrDMvkNy+9RXPw==
-
-are-we-there-yet@~1.1.2:
-  version "1.1.4"
-  resolved "https://registry.yarnpkg.com/are-we-there-yet/-/are-we-there-yet-1.1.4.tgz#bb5dca382bb94f05e15194373d16fd3ba1ca110d"
-  integrity sha1-u13KOCu5TwXhUZQ3PRb9O6HKEQ0=
-  dependencies:
-    delegates "^1.0.0"
-    readable-stream "^2.0.6"
-
-arr-diff@^2.0.0:
-  version "2.0.0"
-  resolved "https://registry.yarnpkg.com/arr-diff/-/arr-diff-2.0.0.tgz#8f3b827f955a8bd669697e4a4256ac3ceae356cf"
-  integrity sha1-jzuCf5Vai9ZpaX5KQlasPOrjVs8=
-  dependencies:
-    arr-flatten "^1.0.1"
-
-arr-flatten@^1.0.1:
-  version "1.1.0"
-  resolved "https://registry.yarnpkg.com/arr-flatten/-/arr-flatten-1.1.0.tgz#36048bbff4e7b47e136644316c99669ea5ae91f1"
-  integrity sha512-L3hKV5R/p5o81R7O02IGnwpDmkp6E982XhtbuwSe3O4qOtMMMtodicASA1Cny2U+aCXcNpml+m4dPsvsJ3jatg==
-
-array-unique@^0.2.1:
-  version "0.2.1"
-  resolved "https://registry.yarnpkg.com/array-unique/-/array-unique-0.2.1.tgz#a1d97ccafcbc2625cc70fadceb36a50c58b01a53"
-  integrity sha1-odl8yvy8JiXMcPrc6zalDFiwGlM=
-
-arrify@^1.0.0:
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/arrify/-/arrify-1.0.1.tgz#898508da2226f380df904728456849c1501a4b0d"
-  integrity sha1-iYUI2iIm84DfkEcoRWhJwVAaSw0=
-
-asn1@~0.2.3:
-  version "0.2.4"
-  resolved "https://registry.yarnpkg.com/asn1/-/asn1-0.2.4.tgz#8d2475dfab553bb33e77b54e59e880bb8ce23136"
-  integrity sha512-jxwzQpLQjSmWXgwaCZE9Nz+glAG01yF1QnWgbhGwHI5A6FRIEY6IVqtHhIepHqI7/kyEyQEagBC5mBEFlIYvdg==
-  dependencies:
-    safer-buffer "~2.1.0"
-
-assert-plus@1.0.0, assert-plus@^1.0.0:
-  version "1.0.0"
-  resolved "https://registry.yarnpkg.com/assert-plus/-/assert-plus-1.0.0.tgz#f12e0f3c5d77b0b1cdd9146942e4e96c1e4dd525"
-  integrity sha1-8S4PPF13sLHN2RRpQuTpbB5N1SU=
-
-assert-plus@^0.2.0:
-  version "0.2.0"
-  resolved "https://registry.yarnpkg.com/assert
```

---

### Incident Patch 14: `ff480dd6` (2023-07-22)
**Commit Message**: [NPM package] Set fixed host for net.createConnection

**File**: `npm-package/lib/injectDevToolsMiddleware.tmpl.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ function __connectToRND(rndPath, log, cb) {
     );
     return cb(false);
   }
-  var __c = __net.createConnection({ port: __port }, () => {
+  var __c = __net.createConnection({ host: '127.0.0.1', port: __port }, () => {
     let pass = false;
     __c.setEncoding('utf-8');
     __c.write(JSON.stringify({ path: rndPath }));
```

**File**: `npm-package/src/open.js` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ function connectToRND(rndPath, log, cb) {
     }
     return cb(false);
   }
-  const connection = net.createConnection({ port }, () => {
+  const connection = net.createConnection({ host: '127.0.0.1', port }, () => {
     let pass = false;
     connection.setEncoding('utf-8');
     connection.write(JSON.stringify({ path: rndPath }));
```

---

### Incident Patch 15: `0fd14db1` (2023-07-21)
**Commit Message**: Support RN ^0.62 for react-native-debugger-open (#777)

* rndebugger-open: Support inject script for RN ^0.62

* handleURL: Resolve host for undefined or null string

* Update tests

* E2E: Use wait-for-expect to wait title change

**File**: `__e2e__/app.spec.js` (modified, +5/-3)
```diff
@@ -90,9 +90,11 @@ describe('Application launch', () => {
     const url = await getURLFromConnection(wss);
     expect(url).toBe('/debugger-proxy?role=debugger&name=Chrome');
 
-    expect(await mainWindow.title()).toBe(
-      'React Native Debugger - Waiting for client connection (port 8081)',
-    );
+    await waitForExpect(async () => {
+      expect(await mainWindow.title()).toBe(
+        'React Native Debugger - Waiting for client connection (port 8081)',
+      );
+    });
     server.close();
     wss.close();
   });
```

**File**: `electron/url-handle/handleURL.js` (modified, +5/-1)
```diff
@@ -19,12 +19,16 @@ const filterPaths = list => {
   return filteredList;
 };
 
+const resolveHost = (host) => (
+  !host || host === 'undefined' || host === 'null' ? 'localhost' : host
+);
+
 export const parseUrl = _url => {
   const route = url.parse(_url);
   if (route.host !== 'set-debugger-loc') return;
   const { host, port, projectRoots } = qs.parse(route.query);
   const query = {
-    host: host || 'localhost',
+    host: resolveHost(host),
     port: Number(port) || 8081,
     projectRoots: Array.isArray(projectRoots) ? filterPaths(projectRoots.split(',')) : undefined,
   };
```

**File**: `npm-package/src/__tests__/__snapshots__/injectDevToolsMiddleware.test.js.snap` (modified, +234/-0)
```diff
@@ -1895,6 +1895,240 @@ function getDevToolsMiddleware(options, isDebuggerConnected) {
 }"
 `;
 
+exports[`Inject to devtoolsMiddleware of React Native packager inject / revert in @react-native-community/cli-server-api (0.71.8 - v10.1.1) 1`] = `
+"\\"use strict\\";
+
+Object.defineProperty(exports, \\"__esModule\\", {
+  value: true
+});
+exports.default = getDevToolsMiddleware;
+function _cliTools() {
+  const data = require(\\"@react-native-community/cli-tools\\");
+  _cliTools = function () {
+    return data;
+  };
+  return data;
+}
+function _child_process() {
+  const data = require(\\"child_process\\");
+  _child_process = function () {
+    return data;
+  };
+  return data;
+}
+/**
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+function launchDefaultDebugger(host, port, args = '') {
+  const hostname = host || 'localhost';
+  const debuggerURL = \`http://\${hostname}:\${port}/debugger-ui\${args}\`;
+  _cliTools().logger.info('Launching Dev Tools...');
+  (0, _cliTools().launchDebugger)(debuggerURL);
+}
+function escapePath(pathname) {
+  // \\" Can escape paths with spaces in OS X, Windows, and *nix
+  return \`\\"\${pathname}\\"\`;
+}
+function launchDevTools({
+  host,
+  port,
+  watchFolders
+}, isDebuggerConnected) {
+  // Explicit config always wins
+  const customDebugger = process.env.REACT_DEBUGGER;
+  if (customDebugger) {
+    startCustomDebugger({
+      watchFolders,
+      customDebugger
+    });
+  } else if (!isDebuggerConnected()) {
+    // Debugger is not yet open; we need to open a session
+    launchDefaultDebugger(host, port);
+  }
+}
+function startCustomDebugger({
+  watchFolders,
+  customDebugger
+}) {
+  const folders = watchFolders.map(escapePath).join(' ');
+  const command = \`\${customDebugger} \${folders}\`;
+  _cliTools().logger.info('Starting custom debugger by executing:', command);
+  (0, _child_process().exec)(command, function (error) {
+    if (error !== null) {
+      _cliTools().logger.error('Error while starting custom debugger:', error.stack || '');
+    }
+  });
+}
+function getDevToolsMiddleware(options, isDebuggerConnected) {
+  return function devToolsMiddleware(_req, res) {
+    launchDevTools(options, isDebuggerConnected);
+    res.end('OK');
+  };
+}
+
+//# sourceMappingURL=devToolsMiddleware.js.map"
+`;
+
+exports[`Inject to devtoolsMiddleware of React Native packager inject / revert in @react-native-community/cli-server-api (0.71.8 - v10.1.1) 2`] = `
+"\\"use strict\\";
+
+Object.defineProperty(exports, \\"__esModule\\", {
+  value: true
+});
+exports.default = getDevToolsMiddleware;
+function _cliTools() {
+  const data = require(\\"@react-native-community/cli-tools\\");
+  _cliTools = function () {
+    return data;
+  };
+  return data;
+}
+function _child_process() {
+  const data = require(\\"child_process\\");
+  _child_process = function () {
+    return data;
+  };
+  return data;
+}
+/**
+ * Copyright (c) Facebook, Inc. and its affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+function launchDefaultDebugger(host, port, args = '') {
+  const hostname = host || 'localhost';
+  const debuggerURL = \`http://\${hostname}:\${port}/debugger-ui\${args}\`;
+  _cliTools().logger.info('Launching Dev Tools...');
+  (0, _cliTools().launchDebugger)(debuggerURL);
+}
+function escapePath(pathname) {
+  // \\" Can escape paths with spaces in OS X, Windows, and *nix
+  return \`\\"\${pathname}\\"\`;
+}
+function launchDevTools({
+  host,
+  port,
+  watchFolders
+}, isDebuggerConnected) {
+  // Explicit config always wins
+  const customDebugger = process.env.REACT_DEBUGGER;
+  if (customDebugger) {
+    startCustomDebugger({
+      watchFolders,
+      customDebugger
+    });
+  } else if (!isDebuggerConnected()) {
+    // Debugger is not yet open; we need to open a session
+    launchDefaultDebugger(host, port);
+  }
+}
+function startCustomDebugger({
+  watchFolders,
+  customDebugger
+}) {
+  const folders = watchFolders.map(escapePath).join(' ');
+  const command = \`\${customDebugger} \${folders}\`;
+  _cliTools().logger.info('Starting custom debugger by executing:', command);
+  (0, _child_process().exec)(command, function (error) {
+    if (error !== null) {
+      _cliTools().logger.error('Error while starting custom debugger:', error.stack || '');
+    }
+  });
+}
+function getDevToolsMiddleware(options, isDebuggerConnected) {
+  return function devToolsMiddleware(_req, res) {
+    launchDevTools(options, isDebuggerConnected);
+    res.end('OK');
+  };
+}
+
+//# sourceMappingURL=devToolsMiddleware.js.map"
+`;
+
+exports[`Inject to devtoolsMiddleware of React Native packager inject / revert in @react-native-community/cli-server-api (0.71.8 - v10.1.1) 3`] = `
+"\\"use strict\\";
+
+Object.defineProperty(e
```

**File**: `npm-package/src/__tests__/injectDevToolsMiddleware.test.js` (modified, +118/-25)
```diff
@@ -3,70 +3,94 @@ import path from 'path';
 import fetch from 'node-fetch';
 import { inject, revert } from '../injectDevToolsMiddleware';
 
-const getRemoteMiddlewarePath = version =>
+const getRemoteMiddlewarePath = (version) =>
   `https://raw.githubusercontent.com/facebook/react-native/${version}-stable/local-cli/server/middleware/getDevToolsMiddleware.js`;
 
 const modulePath = path.join(__dirname, 'tmp');
 
 const middlewareDir = 'local-cli/server/middleware';
 const middlewarePath = path.join(middlewareDir, 'getDevToolsMiddleware.js');
 
+jest.setTimeout(30000);
+
 describe('Inject to devtoolsMiddleware of React Native packager', () => {
   afterEach(() => {
     fs.removeSync(path.join(__dirname, 'tmp'));
   });
   const oldVersions = ['0.49', '0.50'];
-  oldVersions.forEach(version => {
+  oldVersions.forEach((version) => {
     test(`inject / revert in react-native ${version}`, async () => {
-      const code = await fetch(getRemoteMiddlewarePath(version)).then(res => res.text());
+      const code = await fetch(getRemoteMiddlewarePath(version)).then((res) =>
+        res.text(),
+      );
       fs.ensureDirSync(path.join(modulePath, 'react-native', middlewareDir));
-      fs.outputFileSync(path.join(modulePath, 'react-native', middlewarePath), code);
+      fs.outputFileSync(
+        path.join(modulePath, 'react-native', middlewarePath),
+        code,
+      );
       fs.outputFileSync(
         path.join(modulePath, 'react-native', 'package.json'),
         JSON.stringify({
           version: `${version}.0`,
           name: 'react-native',
-        })
+        }),
       );
 
       expect(code).toMatchSnapshot();
       inject(modulePath, 'react-native');
       expect(
-        fs.readFileSync(path.join(modulePath, 'react-native', middlewarePath), 'utf-8')
+        fs.readFileSync(
+          path.join(modulePath, 'react-native', middlewarePath),
+          'utf-8',
+        ),
       ).toMatchSnapshot();
       revert(modulePath, 'react-native');
       expect(
-        fs.readFileSync(path.join(modulePath, 'react-native', middlewarePath), 'utf-8')
+        fs.readFileSync(
+          path.join(modulePath, 'react-native', middlewarePath),
+          'utf-8',
+        ),
       ).toMatchSnapshot();
     });
   });
 
   test('inject / revert in react-native-macos', async () => {
     const code = await fetch(
-      'https://raw.githubusercontent.com/ptmt/react-native-macos/merge-0.44.0/local-cli/server/middleware/getDevToolsMiddleware.js'
-    ).then(res => res.text());
-    fs.ensureDirSync(path.join(modulePath, 'react-native-macos', middlewareDir));
-    fs.outputFileSync(path.join(modulePath, 'react-native-macos', middlewarePath), code);
+      'https://raw.githubusercontent.com/ptmt/react-native-macos/merge-0.44.0/local-cli/server/middleware/getDevToolsMiddleware.js',
+    ).then((res) => res.text());
+    fs.ensureDirSync(
+      path.join(modulePath, 'react-native-macos', middlewareDir),
+    );
+    fs.outputFileSync(
+      path.join(modulePath, 'react-native-macos', middlewarePath),
+      code,
+    );
     fs.outputFileSync(
       path.join(modulePath, 'react-native-macos', 'package.json'),
       JSON.stringify({
         version: '0.8.7',
         name: 'react-native-macos',
-      })
+      }),
     );
 
     expect(code).toMatchSnapshot();
     inject(modulePath, 'react-native-macos');
     expect(
-      fs.readFileSync(path.join(modulePath, 'react-native-macos', middlewarePath), 'utf-8')
+      fs.readFileSync(
+        path.join(modulePath, 'react-native-macos', middlewarePath),
+        'utf-8',
+      ),
     ).toMatchSnapshot();
     revert(modulePath, 'react-native-macos');
     expect(
-      fs.readFileSync(path.join(modulePath, 'react-native-macos', middlewarePath), 'utf-8')
+      fs.readFileSync(
+        path.join(modulePath, 'react-native-macos', middlewarePath),
+        'utf-8',
+      ),
     ).toMatchSnapshot();
   });
 
-  const cliVersions = [
+  const oldCliVersions = [
     {
       rn: '0.59.0-rc.0',
       cli: ['1.5.0'],
@@ -80,32 +104,101 @@ describe('Inject to devtoolsMiddleware of React Native packager', () => {
       cli: ['3.0.0-alpha.7', '3.0.1'],
     },
   ];
-  cliVersions.forEach(({ rn, cli }) => {
-    cli.forEach(version => {
-      test(`inject / revert in @react-native-community/cli (${rn} - v${version})`, async () => {
+  const oldPkgName = '@react-native-community/cli';
+  oldCliVersions.forEach(({ rn, cli }) => {
+    cli.forEach((version) => {
+      test(`inject / revert in ${oldPkgName} (${rn} - v${version})`, async () => {
         const mDir = 'build/commands/server/middleware';
         const mPath = path.join(mDir, 'getDevToolsMiddleware.js');
         const code = await fetch(
-          `https://unpkg.com/@react-native-community/cli@${version}/build/commands/server/middleware/getDevToolsMiddleware.js`
-        ).then(res => res.text());
-        fs.ensureDirSync(path.join(modulePath, '@react-native-community/cli', mDir));
```

**File**: `npm-package/src/injectDevToolsMiddleware.js` (modified, +13/-0)
```diff
@@ -81,6 +81,19 @@ const rnFlags = {
       args: "host + '&port=' + port + '&args=' + args",
     },
   ],
+  '0.62.0-rc.0': [ // Tested ~ 0.71.x
+    {
+      target: '@react-native-community/cli-server-api',
+      dir: 'build',
+      file: 'devToolsMiddleware.js',
+      keyFunc: 'launchDefaultDebugger',
+      func: "function launchDefaultDebugger(host, port, args = '') {",
+      replaceFunc:
+        "function launchDefaultDebugger(host, port, args = '', skipRNDebugger) {",
+      funcCall: '(host, port, args, true)',
+      args: "host + '&port=' + port + '&args=' + args",
+    },
+  ],
 };
 
 const flags = {
```

#### Recent Merged Pull Requests:
- **PR #791** (closed): Bump electron from 25.3.0 to 25.8.1 (@dependabot[bot])
- **PR #790** (closed): Bump electron from 25.3.0 to 25.5.0 (@dependabot[bot])
- **PR #783** (2023-07-28): Upgrade apollo-client-devtools to v4 (@jhen0409)
- **PR #782** (2023-07-25): Bump ESLint & related deps (@jhen0409)
- **PR #781** (2023-07-25): Upgrade @redux-devtools/app (previously remotedev-app) to latest version (@jhen0409)
- **PR #780** (closed): Bump json5 and expo in /examples/test-old-bridge (@dependabot[bot])
- **PR #779** (closed): Bump xml2js and expo in /examples/test-old-bridge (@dependabot[bot])
- **PR #778** (2023-07-22): Upgrade dev dependencies (@jhen0409)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
