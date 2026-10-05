# Forensic Learning Record (Deep Inspection): kdchang/reactjs101

> **Canonical Artifact**: `07_PROJECT_LEARNING/kdchang-reactjs101-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kdchang/reactjs101](https://github.com/kdchang/reactjs101))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:18:54.265Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kdchang/reactjs101`
- **Description**: 從零開始學 ReactJS（ReactJS 101）是一本希望讓初學者一看就懂的 React 中文入門教學書，由淺入深學習 React.js 生態系 (Flux, Redux, React Router, ImmutableJS, React Native, Relay/GraphQL etc.)。
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4341 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Ch10/react-redux-server-rendering/client/index.js`
```
import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import CounterContainer from '../common/containers/CounterContainer';
import configureStore from '../common/store/configureStore'
import { fromJS } from 'immutable';

// get initial state from server side
const initialState = window.__PRELOADED_STATE__;

// use initial state to create store and pass to provider
const store = configureStore(fromJS(initialState))

ReactDOM.render(
  <Provider store={store}>
    <CounterContainer />
  </Provider>,
  document.getElementById('app')
);


```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/actions/counterActions.js`
```
import { createAction } from 'redux-actions';
import {
  INCREMENT_COUNT,
  DECREMENT_COUNT,
} from '../constants/actionTypes';

export const incrementCount = createAction(INCREMENT_COUNT);
export const decrementCount = createAction(DECREMENT_COUNT);



```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/actions/index.js`
```
export * from './counterActions';

```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/api/counter.js`
```
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

export function fetchCounter(callback) {
  setTimeout(() => {
    callback(getRandomInt(1, 100))
  }, 500)
}

```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/components/Counter/Counter.js`
```
import React, { Component, PropTypes } from 'react'

const Counter = ({
  count,
  onIncrement,
  onDecrement,
}) => (
  <p>
    Clicked: {count} times
    {' '}
    <button onClick={onIncrement}>
      +
    </button>
    {' '}
    <button onClick={onDecrement}>
      -
    </button>
    {' '}
  </p>
);

Counter.propTypes = {
  count: PropTypes.number.isRequired,
  onIncrement: PropTypes.func.isRequired,
  onDecrement: PropTypes.func.isRequired
}

Counter.defaultProps = {
  count: 0,
  onIncrement: () => {},
  onDecrement: () => {}
}

export default Counter;
```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/components/Counter/index.js`
```
export { default } from './Counter';
```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/constants/actionTypes.js`
```
export const INCREMENT_COUNT = 'INCREMENT_COUNT';  
export const DECREMENT_COUNT = 'DECREMENT_COUNT';  

```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/constants/models.js`
```
import Immutable from 'immutable';

// initstate model
export const CounterState = Immutable.Record({
  count: 0,
});


```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/containers/CounterContainer/CounterContainer.js`
```
import 'babel-polyfill';
import { connect } from 'react-redux';
import Counter from '../../components/Counter';

import {
  incrementCount,
  decrementCount,
} from '../../actions';

export default connect(
  (state) => ({
    count: state.get('counterReducers').get('count'),
  }),
  (dispatch) => ({ 
    onIncrement: () => (
      dispatch(incrementCount())
    ),
    onDecrement: () => (
      dispatch(decrementCount())
    ),
  })
)(Counter);
```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/containers/CounterContainer/index.js`
```
export { default } from './CounterContainer';
```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/reducers/counterReducers.js`
```
import { fromJS } from 'immutable';
import { handleActions } from 'redux-actions';
import { CounterState } from '../constants/models';

import {
  INCREMENT_COUNT,
  DECREMENT_COUNT,
} from '../constants/actionTypes';

const counterReducers = handleActions({
  INCREMENT_COUNT: (state) => (
    state.set(
      'count',
      state.get('count') + 1
    )
  ),
  DECREMENT_COUNT: (state) => (
    state.set(
      'count',
      state.get('count') - 1
    )
  ),
}, CounterState);

export default counterReducers;

```

### Core Architecture Module: `Ch10/react-redux-server-rendering/common/reducers/index.js`
```
import { combineReducers } from 'redux-immutable';
import counterReducers from './counterReducers'

const rootReducer = combineReducers({
  counterReducers
});

export default rootReducer;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #125** (2025-05-23): **I've updated the README.md with setup prerequisites.**
  *Symptoms*: I added a new "安裝準備（Setup Prerequisites）" section to the main README.md. This section informs you about the general need for Node.js and npm, and advises checking individual chapters for specific setup instructions.  I also verified the existing Table of Contents for accuracy and completeness.
  **Post-Mortem & Fix Analysis**:
  > 这是来自QQ邮箱的假期自动回复邮件。你好，我最近正在休假中，无法亲自回复你的邮件。我将在假期结束后，尽快给你回复。
  > 您好，您的邮件已收到，谢谢~~~

- **Issue #123** (2023-09-18): **學習 React**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 您好，您的邮件已收到，谢谢~~~

- **Issue #117** (2021-05-10): **remove outdated link**
  *Symptoms*: 

- **Issue #111** (2020-01-21): **模板template和组件component具体有什么差别呢？**
  *Symptoms*: 如题： template具体是指什么？ 组件化和模板具体有什么差别呢？

- **Issue #110** (2019-11-22): **CH10. 食譜網站實作疑問**
  *Symptoms*: 請問 getRecipes 這個 action creator是如何觸發的呢? 我搜尋了 GET_RECIPES 與 getRecipes  但是都沒有看見有被dispatch 謝謝

- **Issue #105** (2018-10-30): **1**
  *Symptoms*: 1
  **Post-Mortem & Fix Analysis**:
  > > 1  

- **Issue #98** (2018-05-26): **Update Webpack's setting**
  *Symptoms*: 

- **Issue #94** (2018-04-03): **CH02 NPM Install 指令疑問**
  *Symptoms*: 您好，先感謝您為大眾翻譯此系列教學文，我在讀的過程中發現一個小小的問題。   在 CH02 中，教學透過 NPM 來安裝 Webpack 許多相關的套件，其中有提到 Webpack-loader，   但我看下方指令的部分似乎沒有輸入到 Webpack-loader ， 想請問指令中跳過 loader 的原因。    教學文內指令如下： `$ npm install --save-dev babel-core babel-eslint babel-loader babel-preset-es2015 babel-preset-react html-webpack-plugin webpack webpack-dev-server `
  **Post-Mortem & Fix Analysis**:
  > 接著我做到 npm run dev 的階段，終端機跳出警告說還需要安裝 webpack-cli ，不知道是不是哪邊版本不同才導致的問題，但在安裝 cli 之後，問題似乎更嚴重了。 `✖ ｢wds｣: Invalid configuration object. Webpack has been initialised using a configuration object that does not match the API schema.  - configuration.module has an unknown property 'loaders'. These properties are valid:    object { exprContextCritical?, exprContextRecursive?, exprContextRegExp?, exprContextRequest?, noParse?, rules?, defaultRules?, unknownContextCritical?, unknownContextRecursive?, unknownContextRegExp?, unknownContextRequest?, unsafeCache?, wrappedContextCritical?, wrappedContextRecursive?, wrappedContextRegExp?, strictExportPresence?, strictThisContextOnImports? }    -> Options affecting the normal modules (`NormalModuleFactory`). npm ERR! code ELIFECYCLE npm ERR! errno 1 npm ERR! reactpractice@1.0.0 dev: `webpack-dev-server --devtool eval --progress --colors --content-base build` npm ERR! Exit status 1 npm ERR! npm ERR! Failed at the reactpractice@1.0.0 dev script. 
  > 嗨，您好。  我猜想會不會是因為 webpack 版本更新所造成的問題  前幾日在嘗試運作範例時也碰到一些問題，回憶我當時除了安裝 webpack-cli 之外還將 webpack.config.js 的檔案做了些修改，下面是我修改後的檔案內容：  ```js // 這邊使用 HtmlWebpackPlugin，將 bundle 好的 <script> 插入到 body。${__dirname} 為 ES6 語法對應到 __dirname   const HtmlWebpackPlugin = require('html-webpack-plugin');  const HTMLWebpackPluginConfig = new HtmlWebpackPlugin({   template: `${__dirname}/app/index.html`,   filename: 'index.html',   inject: 'body', });  module.exports = {   // 檔案起始點從 entry 進入，因為是陣列所以也可以是多個檔案   entry: [     './app/index.js',   ],   // output 是放入產生出來的結果的相關參數   output: {     path: `${__dirname}/dist`,     filename: 'index_bundle.js',   },   module: {       // loaders 則是放欲使用的 loaders，在這邊是使用 babel-loader 將所有 .js（這邊用到正則式）相關檔案       // （排除了 npm 安裝的套件位置 node_modules）轉譯成瀏覽器可以閱讀的 JavaScript。preset 則是使用的 babel 轉譯規則，這邊使用 react、es2015。       // 若是已經單獨使用 .babelrc 作為 presets 設定的話，則可以省略 query        // webpack 版本更新導致schema結構改變: https://webpack.js.org/guides/migrating/#module-prelo
  > 確實幫助到我了，感謝你細心觀察發現這個問題!

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

### Incident Patch 1: `14e50f6f` (2018-02-21)
**Commit Message**: fix type in ch.01
close #60

**File**: `Ch01/front-end-introduction.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 ![Web 前端工程入門簡介](./images/frameworks.png "Web 前端工程入門簡介")
 
 ## 前言
-隨著現代化網頁（Modern Web）開發專業和複雜性的提昇以及對於使用者體驗的要求下，網頁開發已從過去的 Web Develpoer 一夫當關，轉向專業分工，更加細分成網頁前端（Web Front End）、網頁後端（Web Back End）等職位。此外，由於跨平台、跨瀏覽器的需求日益增加，技術變化更迭快速，市場上對於前端工程師（Web Front End Engineer）的需求也與日俱增，前端工程的（Front End Engineering）所要面對的挑戰也越來越多。
+隨著現代化網頁（Modern Web）開發專業和複雜性的提昇以及對於使用者體驗的要求下，網頁開發已從過去的 Web Developer 一夫當關，轉向專業分工，更加細分成網頁前端（Web Front End）、網頁後端（Web Back End）等職位。此外，由於跨平台、跨瀏覽器的需求日益增加，技術變化更迭快速，市場上對於前端工程師（Web Front End Engineer）的需求也與日俱增，前端工程的（Front End Engineering）所要面對的挑戰也越來越多。
 
 ![Web 前端工程入門簡介](./images/html-css-js.png "Web 前端工程入門簡介")
 
```

**File**: `Ch01/react-ecosystem-introduction.md` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ NPM（Node Package Manager）是 Node.js 下的主流套件管理工具。在 NP
 [React Router](https://github.com/reactjs/react-router) 是 React 中主流使用的 Routing 函式庫，透過 URL 的變化來管理對應的狀態和元件。若開發不刷頁的單頁式（single page application）的 React 應用程式通常都會需要用到。
 
 ## Flux/Redux
-[Flux](https://facebook.github.io/flux/) 是一個實現單項流的應用程式資料架構（architecture），同樣是由 Facebook 推出，並和 React 專注於 View 的部份形成互補。而由 Dan Abramov 所開發的 [Redux](https://github.com/reactjs/redux) 被 React 開發社群認為是 Flux-like 更優雅的作法，也是目前主流搭配 React 的狀態（State）管理工具。讓你在開發複雜的應用程式時可以更方便管理你的狀態（state）。
+[Flux](https://facebook.github.io/flux/) 是一個實現單向流的應用程式資料架構（architecture），同樣是由 Facebook 推出，並和 React 專注於 View 的部份形成互補。而由 Dan Abramov 所開發的 [Redux](https://github.com/reactjs/redux) 被 React 開發社群認為是 Flux-like 更優雅的作法，也是目前主流搭配 React 的狀態（State）管理工具。讓你在開發複雜的應用程式時可以更方便管理你的狀態（state）。
 
 ## ImmutableJS
 [ImmutableJS](https://facebook.github.io/immutable-js/)，是一個能讓開發者建立不可變資料結構的函式庫。建立不可變（immutable）資料結構不僅可以讓狀態可預測性更高，也可以提昇程式的效能。
```

---

### Incident Patch 2: `d8fec0b9` (2017-12-02)
**Commit Message**: Fix typo in Ch.4

Fix typo in Ch.4

**File**: `Ch04/react-component-life-cycle.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@
 	}
 
 	// 將 <MyComponent /> 元件插入 id 為 app 的 DOM 元素中
-	ReactDOM.render(<MyComponent name="Mark"/>, document.getElmentById('app'));
+	ReactDOM.render(<MyComponent name="Mark"/>, document.getElementById('app'));
 	```
 
 2. 使用 Functional Component 寫法（單純地 render UI 的 stateless components，沒有內部狀態、沒有實作物件和 ref，沒有生命週期函數。若非需要控制生命週期的話建議多使用 stateless components 獲得比較好的效能）
@@ -52,7 +52,7 @@
 	}
 
 	// 將 <MyComponent /> 元件插入 id 為 app 的 DOM 元素中
-	ReactDOM.render(<MyComponent name="Mark"/>, document.getElmentById('app'));
+	ReactDOM.render(<MyComponent name="Mark"/>, document.getElementById('app'));
 	```
 
 值得留意的是在 ES6 Class 中 `render()` 是唯一必要的方法（但要注意的是請保持 `render()` 的純粹，不要在裡面進行 `state` 修改或是使用非同步方法和瀏覽器互動，若需非同步互動請於 `componentDidMount()` 操作），而 Functional Component 目前允許 `return null` 值。 喔對了，在 ES6 中也不支援 `mixins` 複用其他元件的方法了。
```

---

### Incident Patch 3: `6a8029cd` (2017-08-12)
**Commit Message**: fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 2. [前端圈简体中文版本 by @blueflylin]( https://github.com/blueflylin/reactjs101) [特別感謝前端圈小夥伴！](http://fequan.com/)
 
 
-若需翻譯成其他語言版本，請先 `fork` 一份 `repo` 到自己的 Guthub 並另外開新的 `branch`。最後將翻譯版本連結更新在 `master` 分支中 `README.md` 的 `相關連結（Links）` 後發送 `Pull Request`，謝謝您。
+若需翻譯成其他語言版本，請先 `fork` 一份 `repo` 到自己的 GitHub 並另外開新的 `branch`。最後將翻譯版本連結更新在 `master` 分支中 `README.md` 的 `相關連結（Links）` 後發送 `Pull Request`，謝謝您。
 
 ## 目錄（Table of Contents）
 
```

---

### Incident Patch 4: `3b5d913d` (2017-04-18)
**Commit Message**: Fix indentation

**File**: `Appendix03/README.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@
 
 	```
 	$ npm install --save-dev babel-core babel-loader babel-eslint babel-preset-react babel-preset-es2015 eslint eslint-config-airbnb eslint-loader eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-react webpack webpack-dev-server html-webpack-plugin chai mocha
-```
+	```
 
 2. 測試程式碼
 	1. describe（test suite）：表示一組相關的測試。`describe` 為一個函數，第一個參數為 `test suite`的名稱，第二個參數為實際執行的函數。
```

---

### Incident Patch 5: `0714e95f` (2017-04-15)
**Commit Message**: fix typo

**File**: `Ch01/react-ecosystem-introduction.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ NPM（Node Package Manager）是 Node.js 下的主流套件管理工具。在 NP
 [ES6+](https://babeljs.io/blog/2015/06/07/react-on-es6-plus) 係指 ES6（ES2015）和 ES7 的聯集，在 ES6+ 新的標準當中引入許多新的特性和功能，彌補了過去 JavaScript 被詬病的一些特性。由於未來 React 將以支援 ES6+ 為主，因此直接學習 ES6+ 用法是相對好的選擇，本書的所有範例也將會以 ES6+ 撰寫。
 
 ## Babel
-由於並非所有瀏覽器都支援 ES6+ 語法，所以透過 [Babel](https://babeljs.io/) 這個 JavaScript 編譯器（可以想成是翻譯機或是翻譯蒟篛）可以讓你的 ES6+ 、JSX 等程式碼轉換成瀏覽器可以看的懂得語法。通常會在資料夾的 root 位置加入 `.babelrc` 進行轉譯規則 `preset` 和引用外掛（plugin）的設定。
+由於並非所有瀏覽器都支援 ES6+ 語法，所以透過 [Babel](https://babeljs.io/) 這個 JavaScript 編譯器（可以想成是翻譯機或是翻譯蒟篛）可以讓你的 ES6+ 、JSX 等程式碼轉換成瀏覽器可以看得懂的語法。通常會在資料夾的 root 位置加入 `.babelrc` 進行轉譯規則 `preset` 和引用外掛（plugin）的設定。
 
 ## JavaScript 模組化開發
 隨著 Web 應用程式的複雜性提高，JavaScript 模組化開發已經成為必然的趨勢，以下簡單介紹 JavaScript 模組化的相關規範。事實上，在一開始沒有官方定義的標準時出現了各種社群自行定義的規範和實踐。
```

---

### Incident Patch 6: `4dc6dff8` (2017-02-13)
**Commit Message**: fix .babelrc typo

**File**: `Ch01/react-ecosystem-introduction.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ NPM（Node Package Manager）是 Node.js 下的主流套件管理工具。在 NP
 [ES6+](https://babeljs.io/blog/2015/06/07/react-on-es6-plus) 係指 ES6（ES2015）和 ES7 的聯集，在 ES6+ 新的標準當中引入許多新的特性和功能，彌補了過去 JavaScript 被詬病的一些特性。由於未來 React 將以支援 ES6+ 為主，因此直接學習 ES6+ 用法是相對好的選擇，本書的所有範例也將會以 ES6+ 撰寫。
 
 ## Babel
-由於並非所有瀏覽器都支援 ES6+ 語法，所以透過 [Babel](https://babeljs.io/) 這個 JavaScript 編譯器（可以想成是翻譯機或是翻譯蒟篛）可以讓你的 ES6+ 、JSX 等程式碼轉換成瀏覽器可以看的懂得語法。通常會在資料夾的 root 位置加入 `.bablerc` 進行轉譯規則 `preset` 和引用外掛（plugin）的設定。
+由於並非所有瀏覽器都支援 ES6+ 語法，所以透過 [Babel](https://babeljs.io/) 這個 JavaScript 編譯器（可以想成是翻譯機或是翻譯蒟篛）可以讓你的 ES6+ 、JSX 等程式碼轉換成瀏覽器可以看的懂得語法。通常會在資料夾的 root 位置加入 `.babelrc` 進行轉譯規則 `preset` 和引用外掛（plugin）的設定。
 
 ## JavaScript 模組化開發
 隨著 Web 應用程式的複雜性提高，JavaScript 模組化開發已經成為必然的趨勢，以下簡單介紹 JavaScript 模組化的相關規範。事實上，在一開始沒有官方定義的標準時出現了各種社群自行定義的規範和實踐。
```

---

### Incident Patch 7: `cd5e94de` (2016-12-05)
**Commit Message**: fix format bugs

**File**: `Ch04/README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Ch04 Props/State 基礎與 Component 生命週期 
+# Ch04 Props/State 基礎與 Component 生命週期
 
 1. [Props、State、Refs 與表單處理](https://github.com/kdchang/reactjs101/blob/master/Ch04/props-state-introduction.md)
 2. [React Component 規格與生命週期（Life Cycle）](https://github.com/kdchang/reactjs101/blob/master/Ch04/react-component-life-cycle.md)
```

**File**: `Ch04/props-state-introduction.md` (modified, +12/-12)
```diff
@@ -32,7 +32,7 @@ app.js，使用 ES6 Class Component 寫法：
 class HelloMessage extends React.Component {
 	// 若是需要綁定 this.方法或是需要在 constructor 使用 props，定義 state，就需要 constructor。若是在其他方法（如 render）使用 this.props 則不用一定要定義 constructor
 	constructor(props) {
-		// 對於 OOP 物件導向程式設計熟悉的讀者應該對於 constructor 建構子的使用不陌生，事實上它是 ES6 的語法糖，骨子裡還是 portotype based 物件導向程式語言。透過 extends 可以繼承 React.Component 父類別。super 方法可以呼叫繼承父類別的建構子
+		// 對於 OOP 物件導向程式設計熟悉的讀者應該對於 constructor 建構子的使用不陌生，事實上它是 ES6 的語法糖，骨子裡還是 prototype based 物件導向程式語言。透過 extends 可以繼承 React.Component 父類別。super 方法可以呼叫繼承父類別的建構子
 		super(props);
 		this.state = {}
 	}
@@ -51,7 +51,7 @@ HelloMessage.propTypes = {
 
 // Prop 預設值，若對應 props 沒傳入值將會使用 default 值 Zuck
 HelloMessage.defaultProps = {
- name: 'Zuck', 
+ name: 'Zuck',
 }
 
 ReactDOM.render(<HelloMessage name="Mark" />, document.getElementById('app'));
@@ -62,7 +62,7 @@ ReactDOM.render(<HelloMessage name="Mark" />, document.getElementById('app'));
 使用 Functional Component 寫法：
 
 ```javascript
-// Functional Component 可以視為 f(d) => UI，根據傳進去的 props 繪出對應的 UI。注意這邊 props 是傳入函式的參數。因此取用 props 不用加 this
+// Functional Component 可以視為 f(d) => UI，根據傳進去的 props 繪出對應的 UI。注意這邊 props 是傳入函式的參數，因此取用 props 不用加 this
 const HelloMessage = (props) => (
 	<div>Hello {props.name}</div>
 );
@@ -74,7 +74,7 @@ HelloMessage.propTypes = {
 
 // Prop 預設值，若對應 props 沒傳入值將會使用 default 值 Zuck。用法等於 ES5 的 getDefaultProps
 HelloMessage.defaultProps = {
- name: 'Zuck', 
+ name: 'Zuck',
 }
 
 ReactDOM.render(<HelloMessage name="Mark" />, document.getElementById('app'));
@@ -112,7 +112,7 @@ app.js：
 class Timer extends React.Component {
 	constructor(props) {
 		super(props);
-		// 與 ES5 React.createClass({}) 不同的是 component 內自定義的方法需要自行綁定 this context，或是使用 arrow function 
+		// 與 ES5 React.createClass({}) 不同的是 component 內自定義的方法需要自行綁定 this context，或是使用 arrow function
         this.tick = this.tick.bind(this);
 		// 初始 state，等於 ES5 中的 getInitialState
 		this.state = {
@@ -127,15 +127,15 @@ class Timer extends React.Component {
 	componentDidMount() {
 	    this.interval = setInterval(this.tick, 1000);
 	}
-	// componentWillUnmount 為 component 生命週期中 component 即將移出插入的節點的階段。這邊移除了 setInterval 效力 
+	// componentWillUnmount 為 component 生命週期中 component 即將移出插入的節點的階段。這邊移除了 setInterval 效力
 	componentWillUnmount() {
 		clearInterval(this.interval);
 	}
 	// render 為 class Component 中唯一需要定義的方法，其回傳 component 欲顯示的內容
 	render() {
 	    return (
 	      <div>Seconds Elapsed: {this.state.secondsElapsed}</div>
-	    );		
+	    );
 	}
 }
 
@@ -192,7 +192,7 @@ class TodoApp extends React.Component {
 		}
 	}
 	onChange(e) {
-    	this.setState({text: e.target.value});		
+    	this.setState({text: e.target.value});
 	}
 	handleSubmit(e) {
     	e.preventDefault();
@@ -257,11 +257,11 @@ class MarkdownEditor extends React.Component {
 	}
 	handleChange() {
 	    this.setState({value: this.refs.textarea.value});
-		}
-		// 將使用者輸入的 Markdown 語法 parse 成 HTML 放入 DOM 中，React 通常使用 virtual DOM 作為和 DOM 溝通的中介，不建議直接由操作 DOM。故使用時的屬性為 dangerouslySetInnerHTML
+	}
+	// 將使用者輸入的 Markdown 語法 parse 成 HTML 放入 DOM 中，React 通常使用 virtual DOM 作為和 DOM 溝通的中介，不建議直接由操作 DOM。故使用時的屬性為 dangerouslySetInnerHTML
 	rawMarkup() {
 	    const md = new Remarkable();
-	    return { __html: md.render(this.state.value) };		
+	    return { __html: md.render(this.state.value) };
 	}
 	render() {
 	    return (
@@ -277,7 +277,7 @@ class MarkdownEditor extends React.Component {
 	          dangerouslySetInnerHTML={this.rawMarkup()}
 	        />
 	      </div>
-	    );	
+	    );
 	}
 }
 
```

**File**: `Ch04/react-component-life-cycle.md` (modified, +5/-5)
```diff
@@ -26,7 +26,7 @@
 
 	// Prop 預設值，若對應 props 沒傳入值將會使用 default 值，為每個實例化 Component 共用的值
 	MyComponent.defaultProps = {
-	 	name: '', 
+	 	name: '',
 	}
 
 	// 將 <MyComponent /> 元件插入 id 為 app 的 DOM 元素中
@@ -48,14 +48,14 @@
 
 	// Prop 預設值，若對應 props 沒傳入值將會使用 default 值
 	MyComponent.defaultProps = {
-		name: '', 
+		name: '',
 	}
-	
+
 	// 將 <MyComponent /> 元件插入 id 為 app 的 DOM 元素中
 	ReactDOM.render(<MyComponent name="Mark"/>, document.getElmentById('app'));
 	```
 
-值得留意的是在 ES6 Class 中 `render()` 是唯一必要的方法（但要注意的是請保持 `redner()` 的純粹，不要在裡面進行 `state` 修改或是使用非同步方法和瀏覽器互動，若需非同步互動請於 `componentDidMount()` 操作），而 Functional Component 目前允許 `return null` 值。 喔對了，在 ES6 中也不支援 `mixins` 複用其他元件的方法了。
+值得留意的是在 ES6 Class 中 `render()` 是唯一必要的方法（但要注意的是請保持 `render()` 的純粹，不要在裡面進行 `state` 修改或是使用非同步方法和瀏覽器互動，若需非同步互動請於 `componentDidMount()` 操作），而 Functional Component 目前允許 `return null` 值。 喔對了，在 ES6 中也不支援 `mixins` 複用其他元件的方法了。
 
 ## React Component 生命週期
 React Component，就像人會有生老病死一樣有生命週期。一般而言 Component 有以下三種生命週期的狀態：
@@ -77,7 +77,7 @@ React Component，就像人會有生老病死一樣有生命週期。一般而
 3. Unmounting
 	- componentWillUnmount()
 
-很多讀者一開始學習 Component 生命週期時會覺得很抽象，所以接下來用一個簡單範例讓大家感受一下 Component 的生命週期。讀者可以發現當一開始載入元件時第一個會觸發 `console.log('constructor');`，依序執行 `componentWillMount`、`componentDidMount` ，而當點擊文字觸發 `handleClick()` 更新 `state` 時則會依序執行 `componentWillUpdate`、`componentDidUpdate`：  
+很多讀者一開始學習 Component 生命週期時會覺得很抽象，所以接下來用一個簡單範例讓大家感受一下 Component 的生命週期。讀者可以發現當一開始載入元件時第一個會觸發 `console.log('constructor');`，依序執行 `componentWillMount`、`componentDidMount` ，而當點擊文字觸發 `handleClick()` 更新 `state` 時則會依序執行 `componentWillUpdate`、`componentDidUpdate`：
 
 HTML Markup：
 ```html
```

---

### Incident Patch 8: `1b7c9729` (2016-12-05)
**Commit Message**: fix bugs

**File**: `Ch04/props-state-introduction.md` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ class MarkdownEditor extends React.Component {
 	    this.setState({value: this.refs.textarea.value});
 		}
 		// 將使用者輸入的 Markdown 語法 parse 成 HTML 放入 DOM 中，React 通常使用 virtual DOM 作為和 DOM 溝通的中介，不建議直接由操作 DOM。故使用時的屬性為 dangerouslySetInnerHTML
-		rawMarkup() {
+	rawMarkup() {
 	    const md = new Remarkable();
 	    return { __html: md.render(this.state.value) };		
 	}
```

**File**: `Ch07/react-flux-example/webpack.config.js` (modified, +3/-3)
```diff
@@ -20,8 +20,8 @@ module.exports = {
         test: /\.jsx$|\.js$/,
         loader: 'eslint-loader',
         include: `${__dirname}/src`,
-        exclude: /bundle\.js$/
-      }
+        exclude: /bundle\.js$/,
+      },
     ],
     loaders: [{
       test: /\.js$/,
@@ -34,4 +34,4 @@ module.exports = {
     port: 8008,
   },
   plugins: [HTMLWebpackPluginConfig],
-};
\ No newline at end of file
+};
```

**File**: `Ch07/react-redux-example/webpack.config.js` (modified, +3/-3)
```diff
@@ -20,8 +20,8 @@ module.exports = {
         test: /\.jsx$\\.js$/,
         loader: 'eslint-loader',
         include: `${__dirname}/src`,
-        exclude: /bundle\.js$/
-      }
+        exclude: /bundle\.js$/,
+      },
     ],
     loaders: [{
       test: /\.js$/,
@@ -34,4 +34,4 @@ module.exports = {
     port: 8008,
   },
   plugins: [HTMLWebpackPluginConfig],
-}
+};
```

**File**: `Ch09/react-router-redux-github-finder/src/actions/githubActions.js` (modified, +4/-5)
```diff
@@ -11,9 +11,8 @@ import {
   hideSpinner,
 } from './uiActions';
 
-export const getGithub = (userId = 'torvalds') => {
-  console.log('github action');
-  return (dispatch) => {
+export const getGithub = (userId = 'torvalds') => (
+  (dispatch) => {
     dispatch({ type: GET_GITHUB_INITIATE });
     dispatch(showSpinner());
     fetch(`https://api.github.com/users/${userId}`)
@@ -23,7 +22,7 @@ export const getGithub = (userId = 'torvalds') => {
         dispatch(hideSpinner());
       })
       .catch(() => dispatch({ type: GET_GITHUB_FAIL }));
-  };
-};
+  }
+);
 
 export const changeUserId = text => ({ type: CHAGE_USER_ID, payload: { userId: text } });
```

**File**: `Ch09/react-router-redux-github-finder/src/actions/index.js` (modified, +0/-2)
```diff
@@ -1,4 +1,2 @@
 export * from './uiActions';
 export * from './githubActions';
-
-
```

---

### Incident Patch 9: `69ea71f8` (2016-11-21)
**Commit Message**: Fix punctuation

**File**: `Ch04/props-state-introduction.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ ReactDOM.render(<HelloMessage name="Mark" />, document.getElementById('app'));
 使用 Functional Component 寫法：
 
 ```javascript
-// Functional Component 可以視為 f(d) => UI，根據傳進去的 props 繪出對應的 UI。注意這邊 props 是傳入函式的參數。因此取用 props 不用加 this
+// Functional Component 可以視為 f(d) => UI，根據傳進去的 props 繪出對應的 UI。注意這邊 props 是傳入函式的參數，因此取用 props 不用加 this
 const HelloMessage = (props) => (
 	<div>Hello {props.name}</div>
 );
```

---

### Incident Patch 10: `a4e6ce9b` (2016-11-21)
**Commit Message**: Fix typo

**File**: `Ch04/props-state-introduction.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ app.js，使用 ES6 Class Component 寫法：
 class HelloMessage extends React.Component {
 	// 若是需要綁定 this.方法或是需要在 constructor 使用 props，定義 state，就需要 constructor。若是在其他方法（如 render）使用 this.props 則不用一定要定義 constructor
 	constructor(props) {
-		// 對於 OOP 物件導向程式設計熟悉的讀者應該對於 constructor 建構子的使用不陌生，事實上它是 ES6 的語法糖，骨子裡還是 portotype based 物件導向程式語言。透過 extends 可以繼承 React.Component 父類別。super 方法可以呼叫繼承父類別的建構子
+		// 對於 OOP 物件導向程式設計熟悉的讀者應該對於 constructor 建構子的使用不陌生，事實上它是 ES6 的語法糖，骨子裡還是 prototype based 物件導向程式語言。透過 extends 可以繼承 React.Component 父類別。super 方法可以呼叫繼承父類別的建構子
 		super(props);
 		this.state = {}
 	}
```

---

### Incident Patch 11: `71b09c61` (2016-11-17)
**Commit Message**: fix babel-standalone

**File**: `Ch02/webpack-dev-enviroment.md` (modified, +2/-2)
```diff
@@ -22,7 +22,7 @@
 以下是 React [官方首頁的範例](https://facebook.github.io/react/index.html)，以下使用 `React v15.2.1`：
 
 1. 理解 `React` 是 `Component` 導向的應用程式設計
-2. 引入 `react.js`、`react-dom.js`（react 0.14 後將 react-dom 從 react 核心分離，更符合 react 跨平台抽象化的定位）以及 `babel-core-browser` 版 script（可以想成 `babel` 是翻譯機，翻譯瀏覽器看不懂的 `JSX` 或 `ES6+` 語法成為瀏覽器看的懂得的 `JavaScript`。為了提昇效率，通常我們都會在伺服器端做轉譯，這點在 production 環境尤為重要）
+2. 引入 `react.js`、`react-dom.js`（react 0.14 後將 react-dom 從 react 核心分離，更符合 react 跨平台抽象化的定位）以及 `babel-standalone` 版 script（可以想成 `babel` 是翻譯機，翻譯瀏覽器看不懂的 `JSX` 或 `ES6+` 語法成為瀏覽器看的懂得的 `JavaScript`。為了提昇效率，通常我們都會在伺服器端做轉譯，這點在 production 環境尤為重要）
 3. 在 `<body>` 撰寫 React Component 要插入（mount）指定節點的地方：`<div id="example"></div>`
 4. 透過 `babel` 進行語言翻譯 `React JSX` 語法，`babel` 會將其轉為瀏覽器看的懂得 `JavaScript`。其代表意義是：`ReactDOM.render(欲 render 的 Component 或 HTML 元素, 欲插入的位置)`。所以我們可以在瀏覽器上打開我們的 `hello.html`，就可以看到 `Hello, world!` 。That's it，我們第一個 `React` 應用程式就算完成了！
 
@@ -35,7 +35,7 @@
     <!-- 以下引入 react.js, react-dom.js（react 0.14 後將 react-dom 從 react 核心分離，更符合 react 跨平台抽象化的定位）以及 babel-core browser 版 -->
     <script src="https://cdnjs.cloudflare.com/ajax/libs/react/15.2.1/react.min.js"></script>
     <script src="https://cdnjs.cloudflare.com/ajax/libs/react/15.2.1/react-dom.min.js"></script>
-    <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-core/5.8.34/browser.min.js"></script>
+	<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.18.1/babel.min.js"></script>
   </head>
   <body>
     <!-- 這邊的 id="example" 的 <div> 為 React Component 要插入的地方 -->
```

**File**: `Ch04/props-state-introduction.md` (modified, +13/-12)
```diff
@@ -201,16 +201,16 @@ class TodoApp extends React.Component {
     	this.setState({items: nextItems, text: nextText});
 	}
 	render() {
-    return (
-      <div>
-        <h3>TODO</h3>
-        <TodoList items={this.state.items} />
-        <form onSubmit={this.handleSubmit}>
-          <input onChange={this.onChange} value={this.state.text} />
-          <button>{'Add #' + (this.state.items.length + 1)}</button>
-        </form>
-      </div>
-    );
+	    return (
+	      <div>
+	        <h3>TODO</h3>
+	        <TodoList items={this.state.items} />
+	        <form onSubmit={this.handleSubmit}>
+	          <input onChange={this.onChange} value={this.state.text} />
+	          <button>{'Add #' + (this.state.items.length + 1)}</button>
+	        </form>
+	      </div>
+	    );
 	}
 }
 
@@ -222,7 +222,7 @@ ReactDOM.render(<TodoApp />, document.getElementById('app'));
 ## Refs 與表單處理
 上面介紹了 props（傳入後就不能修改）、state（隨著使用者互動而改變）和事件處理機制後，我們將接續介紹如何在 React 中進行表單處理。同樣我們使用 React 官網範例 A Component Using External Plugins 進行介紹。由於 React 可以容易整合外部的 libraries（例如：jQuery），本範例將使用 `remarkable` 結合 `ref` 屬性取出 DOM Value 值（另外比較常用的作法是使用 `onChange` 事件處理方式處理表單內容），讓使用者可以使用 Markdown 語法的所見即所得編輯器（editor）。
 
-HTML Markup（記得除了引入 `react` 和 `react-dom` 外還要用 `CDN` 方式引入 `remarkable` 這個 `Markdown` 語法 parser 套件）：
+HTML Markup（除了引入 `react` 、 `react-dom` 還要用 `CDN` 方式引入 `remarkable` 這個 `Markdown` 語法 parser 套件，記得如果沒有使用 Webpack 或是 browserify + babelify 等工具需要引入 `babel-standalone` 瀏覽器解析 ES6 語法並於引入 script 加上 type="text/babel"）：
 
 ```html
 <!DOCTYPE html>
@@ -235,9 +235,10 @@ HTML Markup（記得除了引入 `react` 和 `react-dom` 外還要用 `CDN` 方
 <body>
 <script src="https://fb.me/react-15.1.0.js"></script>
 <script src="https://fb.me/react-dom-15.1.0.js"></script>
+<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.18.1/babel.min.js"></script>
 <script src="https://cdn.jsdelivr.net/remarkable/1.6.2/remarkable.min.js"></script>
   <div id="app"></div>
-	<script src="./app.js"></script>
+	<script type="text/babel" src="./app.js"></script>
 </body>
 </html>
 ```
```

**File**: `Ch05/react-router-example/src/components/Repos/Repos.js` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ const Repos = (props) => (
 );
 
 Repos.propTypes = {
-  params: React.PropTypes.object,
+  params: React.PropTypes.Object,
 };
 
 export default Repos;
```

---

### Incident Patch 12: `adc95f3b` (2016-10-05)
**Commit Message**: fix typo

**File**: `Ch03/react-jsx-introduction.md` (modified, +5/-5)
```diff
@@ -3,7 +3,7 @@
 ![JSX 簡明入門教學指南](./images/reactjs.png)
 
 ## 前言
-根據 [React](https://facebook.github.io/react/) 官方定義，React 是一個構建使用者介面的 JavaScritp Library。以 MVC 模式來說，ReactJS 主要是負責 View 的部份。過去一段時間，我們被灌輸了許多前端分離的觀念，在前端三兄弟中（或三姊妹、三劍客）：HTML 掌管內容結構、CSS 負責外觀樣式，JavaScript 主管邏輯互動，千萬不要混在一塊。然而，在 React 世界裡，所有事物都是 以 Component 為基礎，將同一個 Compoent 相關的程式和資源都放在一起，而在撰寫 React Component 時我們通常會使用 [JSX](https://facebook.github.io/jsx/) 的方式來提升程式撰寫效率。事實上，JSX 並非一種全新的語言，而是一種語法糖（[Syntatic Sugar](https://en.wikipedia.org/wiki/Syntactic_sugar)），一種語法類似 [XML](https://zh.wikipedia.org/wiki/XML) 的 ECMAScript 語法擴充。在 JSX 中 HTML 和組建這些元素標籤的程式碼有緊密的關係。因此你可能要熟悉一下以 Component 為單位的思考方式（本文主要使用 ES6 語法）。
+根據 [React](https://facebook.github.io/react/) 官方定義，React 是一個構建使用者介面的 JavaScritp Library。以 MVC 模式來說，ReactJS 主要是負責 View 的部份。過去一段時間，我們被灌輸了許多前端分離的觀念，在前端三兄弟中（或三姊妹、三劍客）：HTML 掌管內容結構、CSS 負責外觀樣式，JavaScript 主管邏輯互動，千萬不要混在一塊。然而，在 React 世界裡，所有事物都是 以 Component 為基礎，將同一個 Component 相關的程式和資源都放在一起，而在撰寫 React Component 時我們通常會使用 [JSX](https://facebook.github.io/jsx/) 的方式來提升程式撰寫效率。事實上，JSX 並非一種全新的語言，而是一種語法糖（[Syntatic Sugar](https://en.wikipedia.org/wiki/Syntactic_sugar)），一種語法類似 [XML](https://zh.wikipedia.org/wiki/XML) 的 ECMAScript 語法擴充。在 JSX 中 HTML 和組建這些元素標籤的程式碼有緊密的關係。因此你可能要熟悉一下以 Component 為單位的思考方式（本文主要使用 ES6 語法）。
 
 此外，React 和 JSX 的思維在於善用 JavaScript 的強大能力，放棄蹩腳的模版語言，這和 [Angular](https://angularjs.org/) 強化 HTML 的理念也有所不同。當然 JSX 並非強制使用，你也可以選擇不用，因為最終 JSX 的內容會轉化成 JavaScript（瀏覽器只看的懂 JavaScript）。不過等你閱讀完接下來的內容，你或許會開始發現 JSX 的好，認真考慮使用 JSX 的語法。
 
@@ -80,7 +80,7 @@ JSX 並非一種全新的語言，而是一種語法糖（Syntatic Sugar），
 // const 為常數
 const lists = ['JavaScript', 'Java', 'Node', 'Python'];
 
-class HelloMessage extends React.Compoent {
+class HelloMessage extends React.Component {
   render() {
     return (
     <ul>
@@ -147,7 +147,7 @@ class HelloMessage extends React.Compoent {
 JSX 標籤非常類似 XML ，可以直接書寫。一般 Component 命名首字大寫，HTML Tags 小寫。以下是一個建立 Component 的 class：
 
 ```js
-class HelloMessage extends React.Compoent {
+class HelloMessage extends React.Component {
   render() {
     return (
       <div>
@@ -215,7 +215,7 @@ var content = (
 在 HTML 中，我們可以透過標籤上的屬性來改變標籤外觀樣式，在 JSX 中也可以，但要注意 `class` 和 `for` 由於為 JavaScript 保留關鍵字用法，因此在 JSX 中使用 `className` 和 `htmlFor` 替代。
 
 ```js
-class HelloMessage extends React.Compoent {
+class HelloMessage extends React.Component {
   render() {
     return (
       <div className="message">
@@ -287,7 +287,7 @@ React.createElement("h1", React._spread({}, props, {value: "yo"}), "Hello React!
 ```
 
 ## 總結
-以上就是 JSX 簡明入門教學，希望透過以上介紹，讓讀者了解在 React 中為何要使用 JSX，以及 JSX 基本概念和用法。最後為大家複習一下：在 React 世界裡，所有事物都是以 Component 為基礎，通常會將同一個 Compoent 相關的程式和資源都放在一起，而在撰寫 React Component 時我們常會使用 [JSX](https://facebook.github.io/jsx/) 的方式來提升程式撰寫效率。JSX 是一種語法類似 XML 的 ECMAScript 語法擴充，可以善用 JavaScript 的強大能力，放棄蹩腳的模版語言。當然 JSX 並非強制使用，你也可以選擇不用，因為最終 JSX 的內容會轉化成 JavaScript。當相信閱讀完上述的內容後，你會開始認真考慮使用 JSX 的語法。
+以上就是 JSX 簡明入門教學，希望透過以上介紹，讓讀者了解在 React 中為何要使用 JSX，以及 JSX 基本概念和用法。最後為大家複習一下：在 React 世界裡，所有事物都是以 Component 為基礎，通常會將同一個 Component 相關的程式和資源都放在一起，而在撰寫 React Component 時我們常會使用 [JSX](https://facebook.github.io/jsx/) 的方式來提升程式撰寫效率。JSX 是一種語法類似 XML 的 ECMAScript 語法擴充，可以善用 JavaScript 的強大能力，放棄蹩腳的模版語言。當然 JSX 並非強制使用，你也可以選擇不用，因為最終 JSX 的內容會轉化成 JavaScript。當相信閱讀完上述的內容後，你會開始認真考慮使用 JSX 的語法。
 
 ## 延伸閱讀
 1. [Imperative programming or declarative programming](http://www.puritys.me/docs-blog/article-320-Imperative-programming-or-declarative-programming.html)
```

---

### Incident Patch 13: `e5d958b3` (2016-09-27)
**Commit Message**: fix Ch07/react-redux-introduction.md typo

**File**: `Ch07/react-redux-introduction.md` (modified, +2/-2)
```diff
@@ -91,7 +91,7 @@ store.dispatch({ type: 'DECREMENT' });
 
 1. createStore：`createStore(reducer, [preloadedState], [enhancer])`
 
-	我們知道在 Redux 中只會有一個 store。在產生 store 時我們會使用 `createStore` 這個 API 來創建 store。第一個參數放入我們的 `reducer` 或是有多個 `reducers` combine（使用 `combineReducers`）在一起的 `rootRuducers`。第二個參數我們會放入希望預先載入的 `state` 例如：user session 等。第三個參數通常會放入我們想要使用用來增強 Redux 功能的 `middlewares`，若有多個 `middlewares` 的話，通常會使用 `applyMiddleware` 來整合。
+	我們知道在 Redux 中只會有一個 store。在產生 store 時我們會使用 `createStore` 這個 API 來創建 store。第一個參數放入我們的 `reducer` 或是有多個 `reducers` combine（使用 `combineReducers`）在一起的 `rootReducers`。第二個參數我們會放入希望預先載入的 `state` 例如：user session 等。第三個參數通常會放入我們想要使用用來增強 Redux 功能的 `middlewares`，若有多個 `middlewares` 的話，通常會使用 `applyMiddleware` 來整合。
 
 2. Store
 
@@ -102,7 +102,7 @@ store.dispatch({ type: 'DECREMENT' });
 	- subscribe(listener)
 	- replaceReducer(nextReducer)
 
-	關於 Store 重點是要知道 Redux 只有一個 Sotre 負責存放整個 App 的 State，而唯一能改變 State 的方法只有發送 action。
+	關於 Store 重點是要知道 Redux 只有一個 Store 負責存放整個 App 的 State，而唯一能改變 State 的方法只有發送 action。
 
 3. combineReducers：`combineReducers(reducers)`
 
```

---

### Incident Patch 14: `4cd09696` (2016-09-27)
**Commit Message**: fix typo

**File**: `Ch09/react-router-redux-github-finder.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 6. Fetch
 7. [Material UI](http://www.material-ui.com/#/)
 8. Roboto Font from Google Font
-9. Github API（https://api.github.com/users/torvalds） 
+9. Github API（https://api.github.com/users/torvalds）
 
 不過要注意的是 Github API 若沒有使用 App key 的話可以呼叫 API 的次數會受限
 
```

---

### Incident Patch 15: `a6ca2621` (2016-09-27)
**Commit Message**: fix eslint

**File**: `Ch09/react-router-redux-github-finder/.eslintrc` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
   "extends": "airbnb",
   "rules": {
     "react/jsx-filename-extension": [1, { "extensions": [".js", ".jsx"] }],
+    "import/no-extraneous-dependencies": [0],
+    "linebreak-style": ["error", "unix"],
+    "react/prop-types": ["error", {"ignore": ["children", "route"]}],
+    "new-cap": [0],
   },
   "env" :{
     "browser": true,
```

**File**: `Ch09/react-router-redux-github-finder/src/actions/githubActions.js` (modified, +8/-7)
```diff
@@ -12,17 +12,18 @@ import {
 } from './uiActions';
 
 export const getGithub = (userId = 'torvalds') => {
+  console.log('github action');
   return (dispatch) => {
     dispatch({ type: GET_GITHUB_INITIATE });
     dispatch(showSpinner());
-    fetch('https://api.github.com/users/' + userId)
-      .then(function(response) { return response.json() })
-      .then(function(json) { 
+    fetch(`https://api.github.com/users/${userId}`)
+      .then(response => response.json())
+      .then((json) => {
         dispatch({ type: GET_GITHUB_SUCCESS, payload: { data: json } });
         dispatch(hideSpinner());
       })
-      .catch(function(response) { dispatch({ type: GET_GITHUB_FAIL }) });
-  } 
-}
+      .catch(() => dispatch({ type: GET_GITHUB_FAIL }));
+  };
+};
 
-export const changeUserId = (text) => ({ type: CHAGE_USER_ID, payload: { userId: text } });
\ No newline at end of file
+export const changeUserId = text => ({ type: CHAGE_USER_ID, payload: { userId: text } });
```

**File**: `Ch09/react-router-redux-github-finder/src/actions/uiActions.js` (modified, +2/-2)
```diff
@@ -4,5 +4,5 @@ import {
   HIDE_SPINNER,
 } from '../constants/actionTypes';
 
-export const showSpinner = () => ({ type: SHOW_SPINNER});
-export const hideSpinner = () => ({ type: HIDE_SPINNER});
+export const showSpinner = createAction(SHOW_SPINNER);
+export const hideSpinner = createAction(HIDE_SPINNER);
```

**File**: `Ch09/react-router-redux-github-finder/src/components/GithubBox/GithubBox.js` (modified, +8/-7)
```diff
@@ -4,7 +4,7 @@ import { Card, CardActions, CardHeader, CardText } from 'material-ui/Card';
 import RaisedButton from 'material-ui/RaisedButton';
 import ActionHome from 'material-ui/svg-icons/action/home';
 
-const GithubBox = (props) => (
+const GithubBox = props => (
   <div>
     <Card>
       <CardHeader
@@ -14,25 +14,26 @@ const GithubBox = (props) => (
       />
       <CardText>
         Followers : {props.data.get('followers')}
-      </CardText>      
+      </CardText>
       <CardText>
         Following : {props.data.get('following')}
       </CardText>
       <CardActions>
         <Link to="/">
-          <RaisedButton 
-            label="Back" 
+          <RaisedButton
+            label="Back"
             icon={<ActionHome />}
-            secondary={true} 
+            secondary
           />
         </Link>
       </CardActions>
-    </Card> 
+    </Card>
   </div>
 );
 
 GithubBox.propTypes = {
-  props: React.PropTypes.Object
+  data: React.PropTypes.Object,
+  userId: React.PropTypes.string,
 };
 
 export default GithubBox;
```

**File**: `Ch09/react-router-redux-github-finder/src/components/HomePage/HomePage.js` (modified, +12/-6)
```diff
@@ -2,8 +2,6 @@ import React from 'react';
 import { Link } from 'react-router';
 import RaisedButton from 'material-ui/RaisedButton';
 import TextField from 'material-ui/TextField';
-import IconButton from 'material-ui/IconButton';
-import FontIcon from 'material-ui/FontIcon';
 
 const HomePage = ({
   userId,
@@ -15,13 +13,21 @@ const HomePage = ({
       hintText="Please Key in your Github User Id."
       onChange={onChangeUserId}
     />
-    <Link to={{ 
-      pathname: '/result',
-      query: { userId: userId }
-    }}>
+    <Link
+      to={{
+        pathname: '/result',
+        query: { userId },
+      }}
+    >
       <RaisedButton label="Submit" onClick={onSubmitUserId(userId)} primary />
     </Link>
   </div>
 );
 
+HomePage.propTypes = {
+  onSubmitUserId: React.PropTypes.Object,
+  onChangeUserId: React.PropTypes.Object,
+  userId: React.PropTypes.string,
+};
+
 export default HomePage;
```

**File**: `Ch09/react-router-redux-github-finder/src/components/Main/Main.js` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import React from 'react';
 import AppBar from 'material-ui/AppBar';
 
-const Main = (props) => (
+const Main = props => (
   <div>
     <AppBar
       title="Github Finder"
@@ -14,7 +14,7 @@ const Main = (props) => (
 );
 
 Main.propTypes = {
-  children: React.PropTypes.object,
+  children: React.PropTypes.Object,
 };
 
 export default Main;
```

**File**: `Ch09/react-router-redux-github-finder/src/components/ResultPage/ResultPage.js` (modified, +8/-3)
```diff
@@ -1,10 +1,15 @@
 import React from 'react';
 import GithubBox from '../../components/GithubBox';
 
-const ResultPage = (props) => (
-  <div> 
-    <GithubBox data={props.data} userId={props.location.query.userId} />  
+const ResultPage = props => (
+  <div>
+    <GithubBox data={props.data} userId={props.location.query.userId} />
   </div>
 );
 
+ResultPage.propTypes = {
+  data: React.PropTypes.string,
+  location: React.PropTypes.Object,
+};
+
 export default ResultPage;
```

**File**: `Ch09/react-router-redux-github-finder/src/containers/HomePageContainer/HomePageContainer.js` (modified, +4/-4)
```diff
@@ -7,14 +7,14 @@ import {
 } from '../../actions';
 
 export default connect(
-  (state) => ({
+  state => ({
     userId: state.getIn(['github', 'userId']),
   }),
-  (dispatch) => ({
-    onChangeUserId: (event) => (
+  dispatch => ({
+    onChangeUserId: event => (
       dispatch(changeUserId(event.target.value))
     ),
-    onSubmitUserId: (userId) => () => (
+    onSubmitUserId: userId => () => (
       dispatch(getGithub(userId))
     ),
   }),
```

#### Recent Merged Pull Requests:
- **PR #125** (closed): I've updated the README.md with setup prerequisites. (@KerwinJhong)
- **PR #117** (closed): remove outdated link (@whwu10)
- **PR #105** (closed): 1 (@niguangfly)
- **PR #98** (closed): Update Webpack's setting (@sos418)
- **PR #87** (closed): Update for redux-logger v3 (@trust2065)
- **PR #84** (2018-02-21): fix type in ch.01 (@TroyCode)
- **PR #83** (closed): Update react-flux-introduction.md (@ghost)
- **PR #82** (2017-12-13): Fix typo in Ch.4 (@HsiehMinChien)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
