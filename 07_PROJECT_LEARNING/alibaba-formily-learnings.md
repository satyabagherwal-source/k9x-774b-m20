# Forensic Learning Record (Deep Inspection): alibaba/formily

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-formily-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/formily](https://github.com/alibaba/formily))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:43.091Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/formily`
- **Description**: 📱🚀 🧩 Cross Device & High Performance Normal Form/Dynamic(JSON Schema) Form/Form Builder -- Support React/React Native/Vue 2/Vue 3
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12594 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  semi: false,
  tabWidth: 2,
  singleQuote: true,
}
```

### Core Architecture Module: `.umirc.js`
```
export default {
  mode: 'site',
  logo: '//img.alicdn.com/imgextra/i2/O1CN01Kq3OHU1fph6LGqjIz_!!6000000004056-55-tps-1141-150.svg',
  title: 'Formily',
  hash: true,
  favicon:
    '//img.alicdn.com/imgextra/i3/O1CN01XtT3Tv1Wd1b5hNVKy_!!6000000002810-55-tps-360-360.svg',
  outputPath: './doc-site',
  locales: [
    ['en-US', 'English'],
    ['zh-CN', '中文'],
  ],
  navs: {
    'en-US': [
      {
        title: 'Guide',
        path: '/guide',
      },
      {
        title: 'Basic Core Library',
        children: [
          {
            title: '@formily/reactive',
            path: 'https://reactive.formilyjs.org',
          },
          {
            title: '@formily/core',
            path: 'https://core.formilyjs.org',
          },
          {
            title: '@formily/react',
            path: 'https://react.formilyjs.org',
          },
          {
            title: '@formily/vue',
            path: 'https://vue.formilyjs.org',
          },
        ],
      },
      {
        title: 'Component Ecology',
        children: [
          {
            title: '@formily/antd',
            path: 'https://antd.formilyjs.org',
          },
          {
            title: '@formily/antd-v5',
            path: 'https://antd5.formilyjs.org',
          },
          {
            title: '@formily/antd-mobile',
            path: 'https://antd-mobile.formilyjs.org',
          },
          {
            title: '@formily/next',
            path: 'https://fusion.formilyjs.org',
          },
          {
            title: '@formily/element',
            path: 'https://element.formilyjs.org',
          },
          {
            title: '@formily/element-plus',
            path: 'https://element-plus.formilyjs.org',
          },
          {
            title: '@formily/antdv',
            path: 'https://antdv.formilyjs.org',
          },
          {
            title: '@formily/antdv-x3',
            path: 'https://antdv-x3.formilyjs.org',
          },
          {
            title: '@formily/vant',
            path: 'https://vant.formilyjs.org',
          },
          {
            title: '@formily/semi',
            path: 'https://semi.formilyjs.org',
          },
          {
            title: '@formily/tdesign-react',
            path: 'https://tdesign-react.formilyjs.org/',
          },
          {
            title: 'aliyun teamix',
            path: 'https://formily.dg.aliyun-inc.com/',
          },
          {
            title: 'antd-formily-boost',
            path: 'https://github.com/fishedee/antd-formily-boost',
          },
        ],
      },
      {
        title: 'Tools',
        children: [
          {
            title: 'Formily Designer',
            path: 'https://designable-antd.formilyjs.org/',
          },
          {
            title: 'Designable',
            path: 'https://github.com/alibaba/designable',
          },
          {
            title: 'Chrome Extension',
            path: 'https://chrome.google.com/webstore/detail/formily-devtools/kkocalmbfnplecdmbadaapgapdioecfm?hl=zh-CN',
          },
        ],
      },
      {
        title: 'Community',
        children: [
          {
            title: 'Forum',
            path: 'https://github.com/alibaba/formily/discussions',
          },
          { title: 'Zhihu', path: 'https://www.zhihu.com/column/uform' },
        ],
      },
      {
        title: 'Document@1.x',
        path: 'https://v1.formilyjs.org',
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
        title: '基础核心库',
        children: [
          {
            title: '@formily/reactive',
            path: 'https://reactive.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/core',
            path: 'https://core.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/react',
            path: 'https://react.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/vue',
            path: 'https://vue.formilyjs.org',
          },
        ],
      },
      {
        title: '组件生态',
        children: [
          {
            title: '@formily/antd',
            path: 'https://antd.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/antd-v5',
            path: 'https://antd5.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/antd-mobile',
            path: 'https://antd-mobile.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/next',
            path: 'https://fusion.formilyjs.org/zh-CN',
          },
          {
            title: '@formily/element',
            path: 'https://element.formilyjs.org',
          },
          {
            title: '@formily/element-plus',
            path: 'https://element-plus.formilyjs.org',
          },
          {
            title: '@formily/antdv',
            path: 'https://antdv.formilyjs.org',
          },
          {
            title: '@formily/vant',
            path: 'https://vant.formilyjs.org',
          },
          {
            title: '@formily/semi',
            path: 'https://semi.formilyjs.org',
          },
          {
            title: '@formily/tdesign-react',
            path: 'https://tdesign-react.formilyjs.org',
          },
          {
            title: 'aliyun teamix',
            path: 'https://formily.dg.aliyun-inc.com',
          },
          {
            title: 'antd-formily-boost',
            path: 'https://github.com/fishedee/antd-formily-boost',
          },
        ],
      },
      {
        title: '工具',
        children: [
          {
            title: 'Formily 设计器',
            path: 'https://designable-antd.formilyjs.org/',
          },
          {
            title: '通用搭建引擎',
            path: 'https://github.com/alibaba/designable',
          },
          {
            title: 'Chrome扩展',
            path: 'https://chrome.google.com/webstore/detail/formily-devtools/kkocalmbfnplecdmbadaapgapdioecfm?hl=zh-CN',
          },
        ],
      },
      {
        title: '社区',
        children: [
          {
            title: '论坛',
            path: 'https://github.com/alibaba/formily/discussions',
          },
          { title: '知乎专栏', path: 'https://www.zhihu.com/column/uform' },
        ],
      },
      {
        title: '1.x文档',
        path: 'https://v1.formilyjs.org',
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
  links: [
    {
      rel: 'stylesheet',
      href: 'https://esm.sh/antd@4.x/dist/antd.css',
    },
  ],
  styles: [
    `.__dumi-default-navbar-logo{
      height: 60px !important;
      width: 150px !important;
      padding-left:0 !important;
      color: transparent !important;
    }
    .__dumi-default-navbar{
      padding: 0 28px !important;
    }
    .__dumi-default-layout-hero{
      background-image: url(//img.alicdn.com/imgextra/i4/O1CN01ZcvS4e26XMsdsCkf9_!!6000000007671-2-tps-6001-4001.png);
      background-size: cover;
      background-repe
```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = { extends: ['@commitlint/config-conventional'] }

```

### Core Architecture Module: `devtools/chrome-extension/config/webpack.base.ts`
```
import path from 'path'
import fs from 'fs-extra'

const getEntry = (src) => {
  return [path.resolve(__dirname, '../src/extension/', src)]
}

// 先确保删除package目录，再创建新的
const packageDir = path.resolve(__dirname, '../package')
if (fs.existsSync(packageDir)) {
  fs.removeSync(packageDir)
}
fs.ensureDirSync(packageDir)

fs.copy(path.resolve(__dirname, '../assets'), packageDir)

fs.copy(
  path.resolve(__dirname, '../src/extension/manifest.json'),
  path.resolve(__dirname, '../package/manifest.json')
)

export default {
  mode: 'development',
  devtool: 'inline-source-map', // 嵌入到源文件中
  entry: {
    popup: getEntry('./popup.tsx'),
    devtools: getEntry('./devtools.tsx'),
    devpanel: getEntry('./devpanel.tsx'),
    content: getEntry('./content.ts'),
    backend: getEntry('./backend.ts'),
    demo: getEntry('../app/demo.tsx'),
    inject: getEntry('./inject.ts'),
    background: getEntry('./background.ts'),
  },
  output: {
    path: path.resolve(__dirname, '../package'),
    filename: 'js/[name].bundle.js',
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: require.resolve('style-loader'),
            options: {
              singleton: true,
            },
          },
          require.resolve('css-loader'),
        ],
      },
      {
        test: /\.html?$/,
        loader: require.resolve('file-loader'),
        options: {
          name: '[name].[ext]',
        },
      },
    ],
  },
}

```

### Core Architecture Module: `devtools/chrome-extension/config/webpack.dev.ts`
```
import baseConfig from './webpack.base'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import webpack from 'webpack'
import path from 'path'

const PORT = 3000

const createPages = (pages) => {
  return pages.map(({ filename, template, chunk }) => {
    return new HtmlWebpackPlugin({
      filename,
      template,
      inject: 'body',
      chunks: [chunk],
    })
  })
}

for (let key in baseConfig.entry) {
  if (Array.isArray(baseConfig.entry[key])) {
    baseConfig.entry[key].push(
      require.resolve('webpack/hot/dev-server'),
      `${require.resolve('webpack-dev-server/client')}?http://localhost:${PORT}`
    )
  }
}

module.exports = {
  ...baseConfig,
  plugins: [
    ...createPages([
      {
        filename: 'index.html',
        template: path.resolve(
          __dirname,
          '../src/extension/views/devtools.ejs'
        ),
        chunk: 'demo',
      },
    ]),
    new webpack.HotModuleReplacementPlugin(),
  ],
  devServer: {
    open: true,
    port: PORT,
  },
}

```

### Core Architecture Module: `devtools/chrome-extension/config/webpack.prod.ts`
```
import baseConfig from './webpack.base'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import path from 'path'

const createPages = (pages) => {
  return pages.map(({ filename, template, chunk }) => {
    return new HtmlWebpackPlugin({
      filename,
      template,
      inject: 'body',
      chunks: [chunk],
    })
  })
}

module.exports = {
  ...baseConfig,
  mode: 'production',
  plugins: [
    ...createPages([
      {
        filename: 'popup.html',
        template: path.resolve(__dirname, '../src/extension/views/popup.ejs'),
        chunk: 'popup',
      },
      {
        filename: 'devtools.html',
        template: path.resolve(
          __dirname,
          '../src/extension/views/devtools.ejs'
        ),
        chunk: 'devtools',
      },
      {
        filename: 'devpanel.html',
        template: path.resolve(
          __dirname,
          '../src/extension/views/devpanel.ejs'
        ),
        chunk: 'devpanel',
      },
    ]),
  ],
}

```

### Core Architecture Module: `devtools/chrome-extension/src/app/components/FieldTree.tsx`
```
import React, { useState, useEffect, useRef } from 'react'
import styled from 'styled-components'
import { FormPath, isObj } from '@formily/shared'
import { Treebeard, decorators } from 'react-treebeard'
import * as filters from './filter'
import SearchBox from './SearchBox'

const createTree = (dataSource: any, cursor?: any) => {
  const tree: any = {}
  const getParentPath = (key: string) => {
    let parentPath: FormPath = FormPath.parse(key)
    let i = 0
    while (true) {
      parentPath = parentPath.parent()
      if (dataSource[parentPath.toString()]) {
        return parentPath
      }
      if (i > parentPath.segments.length) return parentPath
      i++
    }
  }
  const findParent = (key: string): any => {
    const parentPath = getParentPath(key)
    const _findParent = (node: any) => {
      if (FormPath.parse(node.path).match(parentPath)) {
        return node
      } else {
        for (let i = 0; i < node?.children?.length; i++) {
          const parent = _findParent(node.children[i])
          if (parent) {
            return parent
          }
        }
      }
    }
    return _findParent(tree)
  }
  Object.keys(dataSource || {}).forEach((key) => {
    if (key == '') {
      tree.name = 'Form'
      tree.path = key
      tree.toggled = true
      tree.data = dataSource[key]
      if (cursor && cursor.current && cursor.current.path === key) {
        tree.active = true
        cursor.current = tree
      }
    } else {
      const node: any = {
        name: key,
        path: key,
        toggled: true,
        data: dataSource[key],
      }
      if (cursor && cursor.current && cursor.current.path === key) {
        node.active = true
        cursor.current = node
      }
      const parent = findParent(key)
      if (parent) {
        node.name = (node.path || '').slice(
          parent && parent.path ? parent.path.length + 1 : 0
        )
        parent.children = parent.children || []
        parent.children.push(node)
      }
    }
  })
  return tree
}

const theme = {
  tree: {
    base: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      color: '#9DA5AB',
      fontFamily: 'lucida grande ,tahoma,verdana,arial,sans-serif',
      fontSize: '8px',
      background: 'none',
      marginBottom: '50px',
    },
    node: {
      base: {
        position: 'relative',
        background: 'none',
      },
      link: {
        cursor: 'pointer',
        position: 'relative',
        padding: '0px 5px',
        display: 'block',
      },
      activeLink: {
        background: '#3D424A',
      },
      toggle: {
        base: {
          position: 'relative',
          display: 'inline-block',
          verticalAlign: 'top',
          marginLeft: '-5px',
          height: '22px',
          width: '20px',
          zIndex: 2,
        },
        wrapper: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 4,
          height: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        height: 6,
        width: 4,
        arrow: {
          fill: '#9DA5AB',
          strokeWidth: 0,
        },
      },
      header: {
        base: {
          display: 'inline-block',
          verticalAlign: 'top',
          color: '#9DA5AB',
        },
        connector: {
          width: '2px',
          height: '12px',
          borderLeft: 'solid 2px black',
          borderBottom: 'solid 2px black',
          position: 'absolute',
          top: '0px',
          left: '-21px',
        },
        title: {
          lineHeight: '24px',
          verticalAlign: 'middle',
        },
      },
      subtree: {
        listStyle: 'none',
        paddingLeft: '19px',
      },
      loading: {
        color: '#E2C089',
      },
    },
  },
}

const Header = (props) => {
  const { node, style, customStyles } = props
  const title = node.data?.title ? node.data.title : ''
  return (
    <div
      className="node-header"
      style={style.base}
      onClick={() => {
        node.toggled = false
      }}
    >
      <div
        style={
          node.selected
            ? { ...style.title, ...customStyles.header.title }
            : style.title
        }
      >
        <span
          style={{
            zIndex: 1,
            position: 'relative',
            fontSize: 12,
          }}
        >
          {node.name}
        </span>
        <span style={{ zIndex: 1, position: 'absolute', right: 12 }}>
           {isObj(title) ? ((title as any).title ?? '') : title}
        </span>
        <div
          className={`highlight ${node.active ? 'active' : ''}`}
          style={{ transition: '.15s all ease-in' }}
        ></div>
      </div>
    </div>
  )
}

const ToolBar = styled.div`
  border-bottom: 1px solid #3d424a;
  height: 20px;
  padding: 10px 10px;
  padding: 5px;
  overflow: auto;
  position: sticky;
  top: 0;
  background: #282c34;
  z-index: 100;
`

export const FieldTree = styled(({ className, dataSource, onSelect }) => {
  const allDataRef = useRef(createTree(dataSource))
  const cursor = useRef(allDataRef.current)
  const [keyword, setKeyword] = useState('')
  const searchTimer = useRef(null)
  const [data, setData] = useState(allDataRef.current)

  const filterData = () => {
    if (!keyword) return data
    const finded = filters.filterTree(data, keyword)
    return filters.expandFilteredNodes(finded, keyword)
  }

  const onToggle = (node: any, toggled: boolean) => {
    cursor.current.active = false
    node.active = true
    if (node.children && node.children.length) {
      node.toggled = toggled
    }
    cursor.current = node
    setData(data)
    if (onSelect) {
      onSelect(node)
    }
  }

  const onSearch = ({ target: { value } }) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setKeyword(value.trim())
    }, 100)
  }

  useEffect(() => {
    allDataRef.current = createTree(dataSource, cursor)
    setData(allDataRef.current)
  }, [dataSource])

  return (
    <div className={className}>
      <ToolBar>
        <SearchBox onSearch={onSearch} />
      </ToolBar>

      <Treebeard
        data={filterData()}
        onToggle={onToggle}
        decorators={{
          ...decorators,
          Header,
        }}
        style={theme}
      />
    </div>
  )
})`
  position: relative;
  overflow: auto;
  height: calc(100% - 40px);
  user-select: none;
  .highlight {
    position: absolute;
    top: 0;
    right: 0;
    left: -100%;
    height: 100%;
    z-index: 0;
    &.active {
      background: #3d424a;
    }
  }
  .node-header:hover .highlight {
    background: #3d424a;
  }
`

```

### Core Architecture Module: `devtools/chrome-extension/src/app/components/LeftPanel.tsx`
```
import React, { useState } from 'react'
import { Tabs } from './Tabs'
import { FieldTree } from './FieldTree'
import styled from 'styled-components'

export const LeftPanel = styled(({ className, dataSource, onSelect }) => {
  const [current, setCurrent] = useState(0)
  return (
    <div className={className}>
      <Tabs
        dataSource={dataSource}
        current={current}
        onChange={(index) => {
          setCurrent(index)
          onSelect({
            current: index,
            key: '',
          })
        }}
      />
      <FieldTree
        dataSource={dataSource[current]}
        onSelect={(node) => {
          if (onSelect) {
            onSelect({
              current,
              key: node.path,
            })
          }
        }}
      />
    </div>
  )
})`
  width: 50%;
  min-width: 50%;
`

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
+          {dataSource.map((item, index
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
