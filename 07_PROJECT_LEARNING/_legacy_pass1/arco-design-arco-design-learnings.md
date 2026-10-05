# Forensic Learning Record (Deep Inspection): arco-design/arco-design

> **Canonical Artifact**: `07_PROJECT_LEARNING/arco-design-arco-design-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arco-design/arco-design](https://github.com/arco-design/arco-design))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:21.712Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arco-design/arco-design`
- **Description**: A comprehensive React UI components library based on Arco Design
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5709 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.config/docgen.config.js`
```
module.exports = (config) => {
  config.entry = process.env.DOC_ENTRY || config.entry;
  config.languages = ['zh-CN', 'en-US'];
  config.template = '__template__/index.[language].md';
  config.outputFileName = 'README.[language].md';
  config.tsParseTool = [
    'ts-document',
    {
      strictComment: true,
      linkFormatter: ({ typeName, jsDocTitle, fullPath }) => {
        const toId = (title) => {
          return title.toLowerCase().replace(/\W/g, '');
        };

        const toHyphen = (str) => {
          return str
            .replace(/^\w/, (g) => g.toLowerCase())
            .replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`);
        };
        if (!jsDocTitle) {
          return `#${toId(typeName)}`;
        }
        const componentName = (fullPath || '').match(/components\/([^/]*)/)?.[1];
        if (componentName) {
          return `${toHyphen(componentName)}#${toId(jsDocTitle)}`;
        }
      },
      propertySorter: ({ type: typeA, name: nameA }, { type: typeB, name: nameB }) => {
        const computeTypeLevel = (type) => {
          let level = 10;

          if (type === 'boolean') {
            level *= 1;
          } else if (type === 'number') {
            level *= 2;
          } else if (type === 'string') {
            level *= 3;
          } else if (/('[^']+'\|?)+/.test(type)) {
            // enum type like ['mini' | 'default' | 'large']
            level *= 4;
          } else if (/(^|\|\s*)(React\.)?ReactNode($|\s*\|)/.test(type)) {
            // type include ReactNode
            level *= 5;
          } else if (/\)\s*=>\s*/.test(type)) {
            // function type
            level *= 7;
          } else {
            level *= 6;
          }

          return level;
        };

        const typeLevelA = computeTypeLevel(typeA);
        const typeLevelB = computeTypeLevel(typeB);

        if (typeLevelA !== typeLevelB) {
          return typeLevelA - typeLevelB;
        }

        return nameA.toLowerCase() > nameB.toLowerCase() ? 1 : -1;
      },
    },
  ];
};

```

### Core Architecture Module: `.config/jest.config.js`
```
// Custom Jest config

const BASE_JEST_CONFIG = {
  // Find component demos' dependencies from /site/node_modules
  modulePaths: ['<rootDir>/site/node_modules'],
  moduleNameMapper: {
    '^@arco-design/web-react/hooks$': '<rootDir>/hooks/lib',
    '^@arco-design/web-react/(.+)$': '<rootDir>/$1',
    '^@arco-design/web-react$': '<rootDir>',
    '^test-utils$': '<rootDir>/tests/util',
  },
  transformIgnorePatterns: ['node_modules/(?!@?react-dnd|dnd-core)'],
};

exports.node = (config) => {
  Object.assign(config, BASE_JEST_CONFIG);
};

exports.client = (config) => {
  Object.assign(config, BASE_JEST_CONFIG);

  config.setupFilesAfterEnv = ['<rootDir>/tests/jest-dom-setup.js'];

  config.collectCoverageFrom = [
    'components/**/*.{ts,tsx}',
    '!components/**/style/*',
    '!components/**/api/*',
  ];

  config.coveragePathIgnorePatterns = [
    '/node_modules/',
    '/lib/',
    '/es/',
    '/dist/',
    '/icon/',
    '/components/index.tsx',
    '/components/locale/',
  ];
};

```

### Core Architecture Module: `.config/style.config.js`
```
module.exports = function StyleConfig(config) {
  config.less.cssJsEntry = ['components/**/style/index.ts'];
  config.less.output.dist.cssFileName = 'arco.min.css';
  config.less.watch = [
    'components/**/*.{less,woff,woff2,png,jpg}',
    'components/style/theme/color/*.js',
  ];
  config.less.watchBase = {
    ['components/**/*.{less,woff,woff2,png,jpg}']: 'components',
    ['components/style/theme/color/*.js']: 'components',
  };
  config.jsEntry.autoInjectArcoDep = false;
};

```

### Core Architecture Module: `.config/webpack.config.js`
```
// 自定义 webpack 构建配置
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const { version } = require('../package.json');
// const { getPWAConfig } = require('../site/config/pwa');

// 组件 dist 打包
exports.component = (config) => {
  if (process.env.BUILD_TYPE === 'hooks') {
    config.entry = path.resolve(__dirname, '../hooks/src-es/index.ts');
    config.output.filename = 'arco-hooks.min.js';
    config.output.library = 'arcohooks';
  } else {
    config.entry = path.resolve(__dirname, '../components/index.tsx');
  }

  config.plugins.pop();
  config.plugins.push(
    new webpack.BannerPlugin({
      banner: `ArcoDesign v${version}\n\nCopyright 2019-present, Bytedance, Inc.\nAll rights reserved.\n`,
    })
  );
};

// 图标 dist 打包
exports.icon = (config) => {
  config.plugins.pop();
  config.plugins.push(
    new webpack.BannerPlugin({
      banner: `ArcoDesign v${version}\n\nCopyright 2019-present, Bytedance, Inc.\nAll rights reserved.\n`,
    })
  );
};

// 官网
exports.site = (config, env) => {
  const isProd = env === 'prod';
  if (isProd) {
    config.output.publicPath = '/';
  }

  config.entry = {
    react: path.resolve(__dirname, '../site/src/index.js'),
    'react-en': path.resolve(__dirname, '../site/src/index-en.js'),
  };

  config.module.rules[1].use[1].options.demoDir = '__demo__';

  config.module.rules[1].use[1].options.autoHelmet = {
    formatTitle: (value) => `${value} | ArcoDesign`,
  };

  config.plugins[0] = new HtmlWebpackPlugin({
    template: path.resolve(__dirname, '../site/public/index.ejs'),
    templateParameters: {
      title: 'Arco Design - 企业级产品的完整设计和开发解决方案',
      lang: 'zh',
    },
    chunks: ['react'],
  });

  config.plugins.push(
    new HtmlWebpackPlugin({
      filename: 'react-en.html',
      template: path.resolve(__dirname, '../site/public/index.ejs'),
      templateParameters: {
        title:
          'Arco Design - Complete design and development solutions for enterprise-level products',
        lang: 'en',
      },
      chunks: ['react-en'],
    })
  );

  config.resolve.alias['@arco-design/web-react'] = path.resolve(__dirname, '..');
  // config.resolve.alias['dayjs$'] = 'moment-timezone';
  // update the react-dnd, with issue: https://github.com/facebook/react/issues/20235
  config.resolve.alias['react/jsx-runtime'] = require.resolve('react/jsx-runtime.js');
  config.resolve.alias['react/jsx-dev-runtime'] = require.resolve('react/jsx-dev-runtime.js');
  delete config.resolve.alias['react'];

  if (env === 'dev') {
    config.devServer.historyApiFallback = {
      rewrites: [
        { from: /^(\/(react|docs|showcase)){0,1}\/en-US/, to: '/react-en.html' },
        { from: /^\/$/, to: '/index.html' },
      ],
    };
  }

  try {
    const { getPWAConfig } = require('../site/config/pwa');

    getPWAConfig(config, env);
  } catch (_) {
    console.error('[Arco React]: site/config/pwa not exists');
  }
};

```

### Core Architecture Module: `.storybook/main.js`
```
const path = require('path');

const lessRegex = /\.less$/;
const lessModuleRegex = /\.module\.less$/;

function getLoaderForStyle(isCssModule) {
  return [
    {
      loader: 'style-loader',
    },
    {
      loader: 'css-loader',
      options: isCssModule ? { modules: true } : {},
    },
    {
      loader: 'less-loader',
      options: {
        javascriptEnabled: true,
      },
    },
  ];
}

module.exports = {
  stories: ['../stories/**/*.story.tsx', '../stories/**/*.story.jsx'],
  webpackFinal: (config) => {
    const dirIcon = path.resolve(__dirname, '../icon');
    const dirHooks = path.resolve(__dirname, '../hooks');
    const dirComponent = path.resolve(__dirname, '../es');

    config.resolve.alias['@self/icon'] = dirIcon;
    config.resolve.alias['@self/hooks'] = dirHooks;
    config.resolve.alias['@self'] = dirComponent;
    config.resolve.alias['@arco-design/web-react/icon'] = dirIcon;
    config.resolve.alias['@arco-design/web-react'] = dirComponent;
    config.resolve.extensions.push('.tsx');

    config.resolve.modules = ['node_modules', path.resolve(__dirname, '../site/node_modules')];
    // 解决 webpack 编译警告
    config.module.rules[0].use[0].options.plugins.push([
      '@babel/plugin-proposal-private-property-in-object',
      { loose: true },
    ]);

    // 支持 import less
    config.module.rules.push({
      test: lessRegex,
      exclude: lessModuleRegex,
      use: getLoaderForStyle(),
    });

    // less css modules
    config.module.rules.push({
      test: lessModuleRegex,
      use: getLoaderForStyle(true),
    });

    // 支持 import svg
    const fileLoaderRule = config.module.rules.find((rule) => rule.test && rule.test.test('.svg'));
    fileLoaderRule.exclude = /\.svg$/;
    config.module.rules.push({
      test: /\.svg$/,
      loader: ['@svgr/webpack'],
    });

    return config;
  },
};

```

### Core Architecture Module: `.storybook/preview.js`
```
import '../dist/css/index.less';
import './index.less';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
};

```

### Core Architecture Module: `components/Affix/index.tsx`
```
import React, {
  CSSProperties,
  forwardRef,
  useRef,
  useImperativeHandle,
  useContext,
  PropsWithChildren,
  useState,
  useEffect,
  useCallback,
} from 'react';
import throttleByRaf from '../_util/throttleByRaf';
import cs from '../_util/classNames';
import { ConfigContext } from '../ConfigProvider';
import { on, off } from '../_util/dom';
import ResizeObserver from '../_util/resizeObserver';
import { isWindow, isUndefined, isFunction, isObject } from '../_util/is';
import useIsomorphicLayoutEffect from '../_util/hooks/useIsomorphicLayoutEffect';
import { AffixProps } from './interface';
import useMergeProps from '../_util/hooks/useMergeProps';

const EVENT_NAMES: (keyof WindowEventMap)[] = ['scroll', 'resize'];

function getTargetRect(target: HTMLElement | Window) {
  return isWindow(target)
    ? {
        top: 0,
        bottom: window.innerHeight,
      }
    : target.getBoundingClientRect();
}

type AffixHandle = {
  updatePosition: () => void;
};

const defaultProps = {
  offsetTop: 0,
  target: () => window,
};

const Affix: React.ForwardRefRenderFunction<AffixHandle, React.PropsWithChildren<AffixProps>> = (
  baseProps,
  ref
) => {
  const { getPrefixCls, componentConfig, rtl } = useContext(ConfigContext);
  const props = useMergeProps<PropsWithChildren<AffixProps>>(
    baseProps,
    defaultProps,
    componentConfig?.Affix
  );
  const {
    className,
    style,
    affixClassName,
    affixStyle,
    offsetTop,
    offsetBottom,
    target,
    targetContainer,
    children,
    onChange,
    ...rest
  } = props;

  const [state, setState] = useState<{
    status: 'MEASURE_DONE' | 'MEASURE_START';
    isFixed: boolean;
    sizeStyles: CSSProperties;
    fixedStyles: CSSProperties;
  }>({
    status: 'MEASURE_DONE',
    isFixed: false,
    sizeStyles: {},
    fixedStyles: {},
  });
  const { isFixed, sizeStyles, fixedStyles } = state;
  const lastIsFixed = useRef(isFixed);

  const prefixCls = getPrefixCls('affix');
  const classNames = cs({ [prefixCls]: isFixed, [`${prefixCls}-rtl`]: rtl }, affixClassName);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | Window>(null);

  const updatePosition = useCallback(
    throttleByRaf(() => {
      setState({
        status: 'MEASURE_START',
        isFixed: false,
        fixedStyles: {},
        sizeStyles: {},
      });
    }),
    []
  );

  useIsomorphicLayoutEffect(() => {
    const { status } = state;
    if (status !== 'MEASURE_START' || !wrapperRef.current || !targetRef.current) return;

    const offsetType = isUndefined(offsetBottom) ? 'top' : 'bottom';
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const targetRect = getTargetRect(targetRef.current);

    let newIsFixed = false;
    let newFixedStyles = {};
    if (offsetType === 'top') {
      newIsFixed = wrapperRect.top - targetRect.top < (offsetTop || 0);
      newFixedStyles = newIsFixed
        ? {
            position: 'fixed',
            top: targetRect.top + (offsetTop || 0),
          }
        : {};
    } else {
      newIsFixed = targetRect.bottom - wrapperRect.bottom < (offsetBottom || 0);
      newFixedStyles = newIsFixed
        ? {
            position: 'fixed',
            bottom: window.innerHeight - targetRect.bottom + (offsetBottom || 0),
          }
        : {};
    }
    const newSizeStyles = newIsFixed
      ? {
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight,
        }
      : {};

    setState({
      status: 'MEASURE_DONE',
      isFixed: newIsFixed,
      sizeStyles: newSizeStyles,
      fixedStyles: { ...newFixedStyles, ...newSizeStyles },
    });

    if (newIsFixed !== lastIsFixed.current) {
      lastIsFixed.current = newIsFixed;
      isFunction(onChange) && onChange(newIsFixed);
    }
  }, [state, offsetBottom, offsetTop, onChange]);

  useEffect(() => {
    updatePosition();

    return () => {
      updatePosition?.cancel?.();
    };
  }, [target, targetContainer, offsetBottom, offsetTop, updatePosition]);

  // listen to scroll and resize event of target and update position correspondingly
  useEffect(() => {
    targetRef.current = target && isFunction(target) ? target() : null;
    if (targetRef.current) {
      for (const eventName of EVENT_NAMES) {
        on(targetRef.current, eventName, updatePosition);
      }
      return () => {
        for (const eventName of EVENT_NAMES) {
          off(targetRef.current, eventName, updatePosition);
        }
      };
    }
  }, [target, updatePosition]);

  useEffect(() => {
    const container = targetContainer && isFunction(targetContainer) ? targetContainer() : null;
    // listen to scroll event of container if target is not window
    if (targetRef.current !== window && container) {
      on(container, 'scroll', updatePosition);
      return () => {
        off(container, 'scroll', updatePosition);
      };
    }
  }, [targetContainer, updatePosition]);

  useImperativeHandle<any, AffixHandle>(ref, () => ({
    updatePosition,
    getRootDOMNode: () => {
      return wrapperRef.current;
    },
  }));

  return (
    <ResizeObserver onResize={updatePosition} getTargetDOMNode={() => wrapperRef.current}>
      <div className={cs(className)} style={style} ref={wrapperRef} {...rest}>
        {isFixed && <div style={sizeStyles} />}
        <div
          className={classNames}
          style={{ ...fixedStyles, ...(isObject(affixStyle) ? affixStyle : {}) }}
        >
          <ResizeObserver onResize={updatePosition}>{children || <span />}</ResizeObserver>
        </div>
      </div>
    </ResizeObserver>
  );
};

const AffixComponent = forwardRef<AffixHandle, PropsWithChildren<AffixProps>>(Affix);

AffixComponent.displayName = 'Affix';

export default AffixComponent;

export { AffixProps };

```

### Core Architecture Module: `components/Affix/interface.ts`
```
import { CSSProperties } from 'react';

/**
 * @title Affix
 */
export interface AffixProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onChange'> {
  /**
   * @zh 自定义类名
   * @en Custom className
   */
  className?: string | string[];
  /**
   * @zh 给 `fixed` 的元素设置 className。
   * @en ClassName of the fixed element.
   * @version 2.8.0
   */
  affixClassName?: string | string[];
  /**
   * @zh
   * 给 `fixed` 的元素设置 style，注意不要设置 `position` `top` `width` `height`， 因为这几个属性是在元素 fixed 时候用于定位的。
   * @en Style of the fixed elements. Don't set `position` `top` `width` `height` attributes as they are used for positioning when the element is fixed.
   * @version 2.8.0
   */
  affixStyle?: CSSProperties;
  /**
   * @zh 距离窗口顶部达到指定偏移量后触发
   * @en Offset from the top of the viewport (in pixels)
   * @defaultValue 0
   */
  offsetTop?: number;
  /**
   * @zh 距离窗口底部达到指定偏移量后触发
   * @en Offset from the bottom of the viewport (in pixels)
   */
  offsetBottom?: number;
  /**
   * @zh 滚动容器
   * @en Specifies the scrollable area DOM Element
   * @defaultValue () => window
   */
  target?: () => HTMLElement | null | Window;
  /**
   * @zh
   * `target` 的外层滚动元素。`Affix` 将会监听该元素的滚动事件，并实时更新固钉的位置。
   * 主要是为了解决 `target` 属性指定为非 `window` 元素时，如果外层元素滚动，可能会导致固钉跑出容器问题。
   * @en
   * Outer scrollable DOM element of `target`. `Affix` will listen to the container's scroll event and update the its position correspondingly.
   * It's to solve the problem that Affix may escape the container when the container is not `window`.
   */
  targetContainer?: () => HTMLElement | null | Window;
  /**
   * @zh 固定状态发生改变时触发
   * @en Callback fired when Affix state is changed
   */
  onChange?: (affixed: boolean) => void;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3199** (2026-08-24): **fix: prevent redundant OverflowEllipsis updates**
  *Symptoms*: <!--   非常感谢你的 PR 和贡献。    提交前请确认已阅读贡献指南：https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- 请在对应的 "[ ]" 中填写 "x" -->  ## Types of changes  <!-- 这个 PR 包含哪种类型的变更 --> <!-- 这里只选择一种类型。如果包含多种类型，可以在 Changelog 中增加 Type 列。 -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others  ## Background and context  当 `Select` 以多选模式使用响应式 `maxTagCount` 时，已选标签会通过 `InputTag` 和 `OverflowEllipsis` 进行渲染。  ```tsx <Select   mode="multiple"   maxTagCount={{ count: 'responsive', showPopover: true }}   options={options} /> ```  在部分嵌入式页面或微前端宿主环境中，`ResizeObserver` 可能会重复上报相同元素和相同宽度。  此前，`OverflowEllipsis` 每次收到通知后都会生成一个新的 `suffixOverflowItems` 状态对象。同时，即使重新计算出的 `maxCount` 没有变化，也仍然会触发状态更新。  这些更新可能形成“渲染—尺寸监听—状态更新”的循环。用户选择一项内容后，React 最终会报错：  ```text Maximum update depth exceeded ```  该问题与页面的布局和尺寸监听触发时机有关，因此在普通独立页面中不一定能够稳定复现，在嵌入式或微前端宿主环境中更容易出现。  ### 复现步骤  1. 使用多选模式的 `Select`，并设置响应式 `maxTagCount`。 2. 将组件渲染在会重复触发 `ResizeObserver` 的布局环境中。 3. 选择任意一个选项。 4. `OverflowEllipsis` 持续触发状态更新，最终出现 `Maximum update depth exceeded`。  ## Solution  将 `OverflowEllipsis` 中的状态更新改为幂等更新：  - 当重新计算得到的 `maxCount` 与当前值一致时，不再调用 `setMaxCount`。 - 当 `ResizeObserver` 上报的节点和宽度均未发生变化时，直接返回原来的 `suffixOverflowItems` 状态。  这样可以避免无效的重复渲染，打断“渲染—尺寸监听—状态更新”的循
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/yzylin0/arco-design/fix-overflow-ellipsis-update-loop?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=yzylin0&repo=arco-design&branch=fix-overflow-ellipsis-update-loop&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=yzylin0&repo=arco-design&branch=fix-overflow-ellipsis-update-loop&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/yzylin0/arco-design/fix-overflow-ellipsis-update-loop?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3199/builds/690900) or the icon next to each commit SHA.

- **Issue #3198** (2026-08-24): **主题包无法发布，请问后续会修复吗？或者后续会下架主题包吗？**
  *Symptoms*: 现状：arco主题包只能预览和编辑，点击发布时提示400无法上传，请问后续规划会下架主题包吗？  <img width="1236" height="1572" alt="Image" src="https://github.com/user-attachments/assets/8b8122fe-f0db-4fce-b0d2-0944ed6608c2" />
  **Post-Mortem & Fix Analysis**:
  > 该问题已修复，目前可以正常发布了

- **Issue #3197** (2026-08-07): **fix(Cascader): 修复级联面板宽度变化导致页面抖动**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an x in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the Type column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others  ## Background and context  Cascader 靠近视口边缘且选项文本较长时，展开、同层切换或选择选项会使弹层宽度发生变化。弹层位置更新晚于浏览器布局，页面会短暂产生横向滚动条并出现抖动。  ## Solution  ### 缺陷摘要  - **问题现象**：Cascader 位于页面右侧时，长文本级联菜单在展开层级、同深度切换和选择叶子项的瞬间出现横向滚动条，导致页面抖动。 - **预期结果**：级联面板内容和宽度变化时，弹层在浏览器绘制前完成定位，页面不产生瞬时横向滚动条，同时保留原有动画和自定义列样式。  ### 复现与验证路径  创建靠右布局且包含多级长文本选项的 Cascader。 1. 打开 Cascader，依次展开不同层级。 2. 在相同深度的父选项间切换。 3. 选择末级叶子项并观察弹层退出动画。 4. 在窄视口下重复展开第一项。 5. **验证点**：逐帧检查弹层 `getBoundingClientRect().right` 不超过视口边界，页面无横向滚动条闪烁，选中值与退出动画正常。  ### 问题诊断  - **根因分析**：Cascader 使用 `margin-left` 执行列进入动画，动画持续改变弹层布局宽度；Trigger 的 ResizeObserver 在布局后一帧才重新定位，产生瞬时越界。 - **详细诊断**：     * 激活项的 `transition: all` 会让 `font-weight` 变化持续改变列宽，导致弹层定位完成后继续扩宽。     * 同深度切换、搜索结果、自定义渲染及退出阶段都可能在列数不变时改变面板宽度，单纯监听列数量无法覆盖。     * Trigger 使用整数 `offsetWidth` 参与定位，在缩放和亚像素布局下可能产生小于 1px 的边界误差。     
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/sync-arco/fix-cascader-popup-jitter?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-cascader-popup-jitter&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-cascader-popup-jitter&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/sync-arco/fix-cascader-popup-jitter?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3197/builds/690005) or the icon next to each commit SHA.

- **Issue #3194** (2026-07-16): **Form表单setFieldsValue后getFields拿不到最新修改的值**
  *Symptoms*: - [ ] I'm sure this does not appear in [the issue list of the repository](https://github.com/arco-design/arco-design/issues)  ## Basic Info  - **Package Name And Version:** @arco-design/web-react@2.66.15 - **Framework version:** react18 - **Browser:** chrome150.0.0.0  ## What is expected? getFields应该返回所有表单项修改后的最新值  ## Steps to reproduce 场景：更新数据的分步表单 1. 使用setFieldsValue回填表单数据 2. 使用getFields获取所有表单项的值 3. getFields返回的是setFieldsValue时传递的值  <!--- Disclaimer: Submitting offensive issues will result in being blocked from arco-design organization. --> <!-- generated by arco-issue. DO NOT REMOVE -->

- **Issue #3193** (2026-07-14): **fix(Table): 修复操作列左边线判断**
  *Symptoms*: - 表体操作列不再基于写死的索引添加 col-first，避免操作列不在首列时错误绘制左边线 - 表头操作列按真实 colIndex 补充 col-first，与表体列位置判断保持一致  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  <!-- Describe how the problem is fixed in detail -->  ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicable --> <!-- Please describe how you tested the change. E.g. Creating/updating unit tests or attaching a screenshot of how it works with your change -->  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | Table          | 修复操作列左边线判断，帮忙边线缺失或者多余         
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/fix-table-border?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-table-border&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-table-border&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/fix-table-border?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3193/builds/688128) or the icon next to each commit SHA.

- **Issue #3192** (2026-07-14): **fix(Trigger): 修复弹层横向边界计算**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  - [x] Bug fix  ## Background and context  When `Trigger` is rendered inside a custom `popupContainer`, the horizontal boundary calculation may use `mountContainer.scrollWidth`. Because the absolutely positioned popup itself can expand the container scroll width, the computed max left value becomes larger than the actual visible area, which causes incorrect popup positioning.  ## Solution  Use the visible parent container width to calculate the horizontal available area instead of directly relying on `mountContainer.scrollWidth`.  Fallback order: 1. parent `clientWidth` 2. mount container `clientWidth` 3. mount container `scrollWidth`  ## How is the change tested?  Code inspection only in current workspace.  Local test was not completed because project dependencies are not installed in this environment (`arco-scripts: command not found`).  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | Trigger | 修复 Trigger 在自定义容器中计算横向边界时，因弹层撑大容器宽度导致定位异常的问题。 | Fix a Trigger positioning issue where horizontal bounds inside a custom container could be miscalculated because the popup itself inflated the
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/wsm972774037/arco-design/fix/trigger-popup-visible-area?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=wsm972774037&repo=arco-design&branch=fix/trigger-popup-visible-area&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=wsm972774037&repo=arco-design&branch=fix/trigger-popup-visible-area&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/wsm972774037/arco-design/fix/trigger-popup-visible-area?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3192/builds/688114) or the icon next to each commit SHA.

- **Issue #3178** (2026-05-06): **fix(Image): 修复Image.Preview 弹出层关闭按钮点击事件冒泡，导致误触发父元素的click事件的问题**
  *Symptoms*:  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an x in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the Type column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context   <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  ### 缺陷摘要  - **问题现象**：点击 `Image.Preview` 右上角关闭按钮时会冒泡到外层容器，误触发父元素 `onClick`。 - **预期结果**：点击预览关闭按钮只关闭预览，不触发父元素事件。  ### 复现与验证路径  1. 点击“查看图片”按钮打开 `Image.Preview` 2. 点击预览右上角关闭按钮 3. **验证点**：预览关闭且控制台不打印父元素点击日志  ### 问题诊断  - **根因分析**：关闭按钮点击事件未拦截冒泡，Portal 内点击继续冒泡到触发预览的父节点。 - **详细诊断**：     * `components/Image/image-preview.tsx` 中：`onCloseClick` 只调用 `close()`，未执行 `stopPropagation`，关闭按钮事件会继续向上冒泡。     * `components/Image/__test__/preview.test.tsx` 中：现有关闭测试只校验 `onVisibleChange`，未覆盖父元素点击误触发场景。  ### 修复方案  - **解决思路**：在关闭按钮点击链路拦截冒泡，并补充回归测试锁定父元素点击场景。 - **代码变更**：     1. `components/Image/image-preview.tsx`    
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/sync-arco/fix-preview-0427-065604?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-preview-0427-065604&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-preview-0427-065604&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/sync-arco/fix-preview-0427-065604?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3178/builds/678432) or the icon next to each commit SHA.

- **Issue #3177** (2026-05-06): **fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题**
  *Symptoms*: …List 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution ## 复现步骤 1. 创建Modal，内部包含Tree组件，开启虚拟滚动 virtualListProps 2. Tree包含多层级节点，节点数量较多，包含loadMore 3. 滚动Tree到任意位置 4. 展开某个节点，等子节点加载完成 5. 继续滚动，观察到滚动条上下跳动，位置不稳定 6. 向下滚动很长距离，展开某个节点，等子节点加载完成，向上可能滚动很短距离就到顶了  ## 根因 Tree 虚拟滚动底层使用 `components/_class/VirtualList`。节点展开/收起或 `loadMore` 完成后，Tree 的可见节点列表会发生插入/删除，`VirtualList` 会在 `data.length` 变化时主动校准滚动位置。  原逻辑存在以下问题：  1. 校准条件过宽：只要虚拟列表数据长度变化且 diff index 非空，就会调用 `internalScrollTo` 重新设置 `scrollTop`。Tree 展开当前视口内节点时，首屏内容本身没有跳动，只有列表中部的内部定位项受到插入影响；此时继续校准会额外拨动滚动条，所以表现为“元素位置是对的，但滚动条抽搐”。 2. 视口内数据变
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/fix-tree-virtualist-debonce?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-tree-virtualist-debonce&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-tree-virtualist-debonce&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/fix-tree-virtualist-debonce?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3177/builds/678429) or the icon next to each commit SHA.

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

### Incident Patch 1: `c2b050d9` (2026-08-24)
**Commit Message**: fix: prevent redundant OverflowEllipsis updates (#3199)

**File**: `components/_class/OverflowEllipsis/__test__/index.test.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import React from 'react';
+import { render } from '../../../../tests/util';
+import OverflowEllipsis from '..';
+
+jest.mock('../../../_util/resizeObserver', () => {
+  const ReactModule = require('react') as typeof React;
+
+  return function MockResizeObserver(props: {
+    children: React.ReactNode;
+    onResize?: (entries: ResizeObserverEntry[]) => void;
+  }) {
+    const targetRef = ReactModule.useRef<HTMLDivElement>();
+    const child = props.children as React.ReactElement<{ className?: string }>;
+    const isSuffixItem = child.props.className?.includes('arco-overflow-suffix-item');
+
+    ReactModule.useLayoutEffect(() => {
+      if (targetRef.current && isSuffixItem) {
+        props.onResize?.([{ target: targetRef.current } as unknown as ResizeObserverEntry]);
+      }
+    });
+
+    return ReactModule.createElement('div', { ref: targetRef }, props.children);
+  };
+});
+
+describe('OverflowEllipsis', () => {
+  it('does not loop when the suffix resize observer repeatedly reports the same size', () => {
+    expect(() => {
+      render(
+        <OverflowEllipsis
+          items={[<span key="tag">tag</span>]}
+          suffixItems={[<span key="input">input</span>]}
+        />
+      );
+    }).not.toThrow();
+  });
+});
```

**File**: `components/_class/OverflowEllipsis/index.tsx` (modified, +11/-3)
```diff
@@ -58,8 +58,11 @@ export default function OverflowEllipsis(props: OverflowEllipsisProps) {
       totalWidth += target?.width || 0;
     });
 
-    setMaxCount(Math.max(newMaxCount, 0));
-  }, [overflowItems, containerWidth, suffixOverflowItems]);
+    const nextMaxCount = Math.max(newMaxCount, 0);
+    if (maxCount !== nextMaxCount) {
+      setMaxCount(nextMaxCount);
+    }
+  }, [overflowItems, containerWidth, suffixOverflowItems, maxCount]);
 
   return (
     <ResizeObserver
@@ -102,9 +105,14 @@ export default function OverflowEllipsis(props: OverflowEllipsisProps) {
               className={`${prefixCls}-suffix-item`}
               onResize={(node) => {
                 setSuffixOverflowItems((suffixOverflowItems) => {
+                  const width = node.clientWidth;
+                  const currentItem = suffixOverflowItems[key];
+                  if (currentItem?.node === node && currentItem.width === width) {
+                    return suffixOverflowItems;
+                  }
                   return {
                     ...suffixOverflowItems,
-                    [`${key}`]: { node, width: node.clientWidth },
+                    [`${key}`]: { node, width },
                   };
                 });
               }}
```

---

### Incident Patch 2: `8b3ae75b` (2026-08-07)
**Commit Message**: fix(Cascader): 修复级联面板宽度变化导致页面抖动 (#3197)

在级联面板内容变化和退出动画绘制前同步更新弹层位置，并使用不影响布局宽度的列动画，避免靠近视口边缘时产生瞬时横向滚动条。保留自定义列 transform，并覆盖搜索、同层切换和叶子选择等动态宽度场景。

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusCode <genius_ai@bytedance.com>

**File**: `components/Cascader/__test__/index.test.tsx` (modified, +72/-0)
```diff
@@ -3,6 +3,8 @@ import { act } from 'react-test-renderer';
 import mountTest from '../../../tests/mountTest';
 import componentConfigTest from '../../../tests/componentConfigTest';
 import Cascader from '../cascader';
+import CascaderPanel from '../panel/list';
+import Store from '../base/store';
 import { fireEvent, render } from '../../../tests/util';
 
 mountTest(Cascader);
@@ -105,6 +107,76 @@ describe('Cascader basic test', () => {
     );
     expect(wrapper.querySelector('.arco-cascader-view-value')).toHaveTextContent('上海');
   });
+
+  it('preserves custom column transform after enter animation', () => {
+    const store = new Store(options);
+    const wrapper = render(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible
+        dropdownMenuColumnStyle={{ transform: 'scale(0.9)' }}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[0]);
+    act(() => {
+      jest.runAllTimers();
+    });
+
+    expect(wrapper.find(`${prefixCls}-list-column`)[1]).toHaveStyle({ transform: 'scale(0.9)' });
+  });
+
+  it('updates popup position synchronously when panel content changes', () => {
+    const updatePopupPosition = jest.fn();
+    const store = new Store([
+      ...options,
+      {
+        value: 'beijing',
+        label: '北京',
+        children: [{ value: 'beijingshi', label: '北京市' }],
+      },
+    ]);
+    const wrapper = render(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible
+        updatePopupPosition={updatePopupPosition}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+
+    updatePopupPosition.mockClear();
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[0]);
+
+    expect(wrapper.find(`${prefixCls}-list-column`)).toHaveLength(2);
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+
+    updatePopupPosition.mockClear();
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[1]);
+    expect(wrapper.find(`${prefixCls}-list-column`)).toHaveLength(2);
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+
+    updatePopupPosition.mockClear();
+    wrapper.rerender(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible={false}
+        updatePopupPosition={updatePopupPosition}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+  });
 });
 
 let wrapper;
```

**File**: `components/Cascader/cascader.tsx` (modified, +5/-0)
```diff
@@ -115,6 +115,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
   const refOnInputChangeCallbackReason = useRef<InputValueChangeReason>(null);
 
   const selectRef = useRef(null);
+  const triggerRef = useRef<Trigger>();
   // 暂存被选中的值对应的节点。仅在onSearch的时候用到
   // 避免出现下拉列表改变，之前选中的option找不到对应的节点，展示上会出问题。
   const stashNodes = useRef<Store<T>['nodes']>(store?.getCheckedNodes() || []);
@@ -359,6 +360,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
                 }
                 // TODO 组件重构，解耦面板选择和输入框，面板可独立使用
                 getTriggerElement={() => selectRef.current?.dom}
+                updatePopupPosition={() => triggerRef.current?.updatePopupPositionSync()}
                 value={mergeValue}
                 virtualListProps={props.virtualListProps}
                 defaultActiveFirstOption={props.defaultActiveFirstOption}
@@ -382,6 +384,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
                 prefixCls={prefixCls}
                 rtl={rtl}
                 getTriggerElement={() => selectRef.current?.dom}
+                updatePopupPosition={() => triggerRef.current?.updatePopupPositionSync()}
                 renderEmpty={renderEmptyEle}
                 popupVisible={popupVisible}
                 value={mergeValue}
@@ -410,13 +413,15 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
   const renderView = (eleView: ReactElement | ReactNode) => {
     return (
       <Trigger
+        ref={triggerRef}
         popup={renderPopup}
         trigger={props.trigger}
         disabled={disabled}
         getPopupContainer={getPopupContainer}
         position={rtl ? 'br' : 'bl'}
         classNames="slideDynamicOrigin"
         popupAlign={triggerPopupAlign}
+        boundaryDistance={rtl ? { left: 1 } : { right: 1 }}
         // 动态加载时，unmountOnExit 默认为false。
         unmountOnExit={'unmountOnExit' in props ? props.unmountOnExit : !isFunction(props.loadMore)}
         popupVisible={popupVisible}
```

**File**: `components/Cascader/interface.ts` (modified, +1/-0)
```diff
@@ -316,6 +316,7 @@ export interface CascaderPanelProps<T> {
   dropdownColumnRender?: CascaderProps<T>['dropdownColumnRender'];
   dropdownMenuColumnStyle?: CascaderProps<T>['dropdownMenuColumnStyle'];
   getTriggerElement: () => HTMLElement;
+  updatePopupPosition?: () => void;
   icons?: {
     loading?: ReactNode;
     checked?: ReactNode;
```

**File**: `components/Cascader/panel/list.tsx` (modified, +10/-3)
```diff
@@ -9,6 +9,7 @@ import useRefs from '../../_util/hooks/useRefs';
 import useForceUpdate from '../../_util/hooks/useForceUpdate';
 import { ArrowDown, Esc, Enter, ArrowUp, ArrowRight, ArrowLeft } from '../../_util/keycode';
 import useUpdate from '../../_util/hooks/useUpdate';
+import useIsomorphicLayoutEffect from '../../_util/hooks/useIsomorphicLayoutEffect';
 import Node from '../base/node';
 import { getMultipleCheckValue } from '../util';
 import VirtualList, { VirtualListHandle } from '../../_class/VirtualList';
@@ -262,6 +263,10 @@ const ListPanel = <T extends OptionProps>(props: CascaderPanelProps<T>) => {
     ? props.dropdownColumnRender
     : (menu) => menu;
 
+  useIsomorphicLayoutEffect(() => {
+    props.updatePopupPosition?.();
+  });
+
   return !menus.length || !menus[0]?.length ? (
     <>{renderEmpty()}</>
   ) : (
@@ -279,15 +284,17 @@ const ListPanel = <T extends OptionProps>(props: CascaderPanelProps<T>) => {
             classNames="cascaderSlide"
             onEnter={(e: HTMLDivElement) => {
               if (!e) return;
-              e.style.marginLeft = `-${e.scrollWidth}px`;
+              const columnTransform = props.dropdownMenuColumnStyle?.transform || '';
+              e.style.transform = `translateX(-${e.scrollWidth}px) ${columnTransform}`.trim();
             }}
             onEntering={(e: HTMLDivElement) => {
               if (!e) return;
-              e.style.marginLeft = `0px`;
+              const columnTransform = props.dropdownMenuColumnStyle?.transform || '';
+              e.style.transform = `translateX(0) ${columnTransform}`.trim();
             }}
             onEntered={(e) => {
               if (!e) return;
-              e.style.marginLeft = '';
+              e.style.transform = props.dropdownMenuColumnStyle?.transform || '';
             }}
           >
             <div
```

**File**: `components/Cascader/panel/search-panel.tsx` (modified, +6/-0)
```diff
@@ -13,6 +13,7 @@ import { isString, isObject, isFunction } from '../../_util/is';
 import { getMultipleCheckValue } from '../util';
 import VirtualList from '../../_class/VirtualList';
 import { on, off } from '../../_util/dom';
+import useIsomorphicLayoutEffect from '../../_util/hooks/useIsomorphicLayoutEffect';
 
 export const getLegalIndex = (currentIndex, maxIndex) => {
   if (currentIndex < 0) {
@@ -39,6 +40,7 @@ export type SearchPanelProps<T> = {
   defaultActiveFirstOption: boolean;
   renderOption?: (inputValue: string, node: NodeProps<T>, options: extraOptions) => ReactNode;
   getTriggerElement: () => HTMLElement;
+  updatePopupPosition?: () => void;
   icons?: {
     loading?: ReactNode;
     checked?: ReactNode;
@@ -186,6 +188,10 @@ const SearchPanel = <T extends OptionProps>(props: SearchPanelProps<T>) => {
 
   refActiveItem.current = null;
 
+  useIsomorphicLayoutEffect(() => {
+    props.updatePopupPosition?.();
+  });
+
   return options.length ? (
     <div className={`${prefixCls}-list-wrapper`}>
       <VirtualList
```

---

### Incident Patch 3: `dccbaceb` (2026-07-14)
**Commit Message**: fix(Table): 修复操作列左边线判断

- 表体操作列不再基于写死的索引添加 col-first，避免操作列不在首列时错误绘制左边线
- 表头操作列按真实 colIndex 补充 col-first，与表体列位置判断保持一致

**File**: `components/Table/__test__/__snapshots__/demo.test.ts.snap` (modified, +65/-65)
```diff
@@ -609,7 +609,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <th
-                        class="arco-table-th arco-table-operation arco-table-checkbox"
+                        class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <div
                           class="arco-table-th-item"
@@ -705,7 +705,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -795,7 +795,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -885,7 +885,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -975,7 +975,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -1065,7 +1065,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -1714,7 +1714,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <th
-                      class="arco-table-th arco-table-operation arco-table-checkbox"
+                      class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                     >
                       <div
                         class="arco-table-th-item"
@@ -1810,7 +1810,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <td
-                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                     >
         
```

**File**: `components/Table/__test__/components.test.tsx` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ describe('Table components', () => {
     jest.runAllTimers();
 
     expect(component.find('tbody .arco-table-checkbox').item(0).className).toBe(
-      'arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-tooltip-open'
+      'arco-table-td arco-table-operation arco-table-checkbox arco-tooltip-open'
     );
   });
 
```

**File**: `components/Table/__test__/fixed-columns.test.tsx` (modified, +2/-2)
```diff
@@ -87,7 +87,7 @@ describe('Table fixed columns', () => {
     }
 
     expect(getHeadCell(0).className).toBe(
-      'arco-table-th arco-table-operation arco-table-expand arco-table-col-fixed-left'
+      'arco-table-th arco-table-operation arco-table-expand arco-table-col-fixed-left arco-table-col-first'
     );
     expect(getHeadCell(0).getAttribute('style')).toEqual('left: 0px;');
 
@@ -97,7 +97,7 @@ describe('Table fixed columns', () => {
     expect(getHeadCell(1).getAttribute('style')).toEqual('left: 40px;');
 
     expect(getBodyCell(0).className).toBe(
-      'arco-table-td arco-table-operation arco-table-expand-icon-cell arco-table-col-first arco-table-col-fixed-left arco-table-col-first'
+      'arco-table-td arco-table-operation arco-table-expand-icon-cell arco-table-col-fixed-left arco-table-col-first'
     );
     expect(getBodyCell(0).getAttribute('style')).toEqual('left: 0px;');
 
```

**File**: `components/Table/__test__/group-columns.test.tsx` (modified, +3/-1)
```diff
@@ -53,7 +53,9 @@ describe('Table group columns', () => {
     function getRowCell(rowIndex, colIndex) {
       return component.find('tr').item(rowIndex).querySelectorAll('th').item(colIndex);
     }
-    expect(getRowCell(0, 0).className).toBe('arco-table-th arco-table-operation arco-table-expand');
+    expect(getRowCell(0, 0).className).toBe(
+      'arco-table-th arco-table-operation arco-table-expand arco-table-col-first'
+    );
     expect(getRowCell(0, 0).getAttribute('rowSpan')).toBe('2');
 
     expect(getRowCell(0, 1).className).toBe(
```

**File**: `components/Table/tbody/tr.tsx` (modified, +6/-5)
```diff
@@ -75,11 +75,12 @@ function Tr<T>(props: TrType<T>, ref) {
       ? rowSelection.checkboxProps(originRecord)
       : {};
   const operationClassName = cs(`${prefixCls}-td`, `${prefixCls}-operation`);
-  const getPrefixColClassName = (name, index) => {
+  // col-first 由外层 columns.map 中的 cloneElement 按真实 colIndex 统一判定，
+  // 此处不再根据写死的 index 添加，避免操作列不在首列时错误地画出左边线。
+  const getPrefixColClassName = (name) => {
     return cs(operationClassName, `${prefixCls}-${name}`, {
       [`${prefixCls}-selection-col`]: (virtualized && type === 'checkbox') || type === 'radio',
       [`${prefixCls}-expand-icon-col`]: virtualized && expandedRowRender,
-      [`${prefixCls}-col-first`]: index === 0,
     });
   };
 
@@ -146,7 +147,7 @@ function Tr<T>(props: TrType<T>, ref) {
   }
 
   const expandNode = expandedRowRender && (
-    <InnerComponentTd className={getPrefixColClassName('expand-icon-cell', 0)}>
+    <InnerComponentTd className={getPrefixColClassName('expand-icon-cell')}>
       {shouldRenderExpandRow && renderExpandIcon(record, rowK)}
     </InnerComponentTd>
   );
@@ -175,7 +176,7 @@ function Tr<T>(props: TrType<T>, ref) {
 
   if (type === 'checkbox') {
     selectionNode = (
-      <InnerComponentTd className={getPrefixColClassName('checkbox', expandNode ? 1 : 0)}>
+      <InnerComponentTd className={getPrefixColClassName('checkbox')}>
         {renderSelectionCell
           ? renderSelectionCell(checkboxNode, checked, originRecord)
           : checkboxNode}
@@ -184,7 +185,7 @@ function Tr<T>(props: TrType<T>, ref) {
   }
   if (type === 'radio') {
     selectionNode = (
-      <InnerComponentTd className={getPrefixColClassName('radio', expandNode ? 1 : 0)}>
+      <InnerComponentTd className={getPrefixColClassName('radio')}>
         {renderSelectionCell ? renderSelectionCell(radioNode, checked, originRecord) : radioNode}
       </InnerComponentTd>
     );
```

---

### Incident Patch 4: `70611973` (2026-07-14)
**Commit Message**: fix(Trigger): 修复弹层横向边界计算

**File**: `components/Trigger/getPopupStyle.ts` (modified, +29/-2)
```diff
@@ -213,6 +213,29 @@ const getViewportSize = (_boundaryDistance: TriggerProps['boundaryDistance']) =>
   };
 };
 
+const getContainerVisibleArea = (
+  mountContainer: Element,
+  viewportWidth: number,
+  boundaryLeft: number
+): { left: number; width: number } => {
+  const parent = mountContainer.parentNode as HTMLElement | null;
+
+  if (!parent || parent === document.body || parent === document.documentElement) {
+    return {
+      left: boundaryLeft,
+      width: viewportWidth,
+    };
+  }
+
+  return {
+    left: 0,
+    width:
+      parent.clientWidth ||
+      (mountContainer as HTMLElement).clientWidth ||
+      mountContainer.scrollWidth,
+  };
+};
+
 export default (
   props: TriggerProps,
   content: HTMLElement,
@@ -359,8 +382,12 @@ export default (
     if (style.left < 0) {
       style.left = 0;
     } else {
-      // 限制在popupContainer中，左侧最大为 mountContainer.scrollWidth - contentSize.width，保证弹出层在container内部
-      const maxLeft = mountContainer.scrollWidth - contentSize.width;
+      // 限制在可见容器中。不能直接使用 mountContainer.scrollWidth，它可能已被绝对定位弹层自身撑大。
+      const visibleArea = getContainerVisibleArea(mountContainer, windowWidth, boundary.left);
+      const maxLeft = Math.max(
+        0,
+        visibleArea.left + visibleArea.width - contentSize.width
+      );
       style.left = Math.min(maxLeft, style.left);
     }
 
```

---

### Incident Patch 5: `a970723b` (2026-05-06)
**Commit Message**: fix(Form): 修复Form组件中form.scrollToField 命中数字开头或含特殊字符的字段 id 时抛出非法选择器错误，滚动失败问题 (#3175)

* fix(Form): 修复 scrollToField 在字段名包含特殊字符时无法工作的问题

Co-authored-by: GeniusAI <genius_ai@bytedance.com>

* fix: 修复测试用例问题

---------

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusAI <genius_ai@bytedance.com>

**File**: `components/Form/__test__/useform.test.tsx` (modified, +44/-0)
```diff
@@ -549,6 +549,50 @@ describe('UseForm', () => {
     expect(form.scrollToField).toBeInstanceOf(Function);
   });
 
+  it('scrollToField should support special character field', async () => {
+    const DemoWithSpecialField = () => {
+      const [specialForm] = Form.useForm();
+      useEffect(() => {
+        expect(() => {
+          specialForm.scrollToField('1-2-3');
+        }).not.toThrow();
+      }, [specialForm]);
+
+      return (
+        <Form form={specialForm} id="special-form" scrollToFirstError>
+          <Form.Item
+            label="字段1"
+            field="1-2-3"
+            rules={[
+              {
+                required: true,
+              },
+            ]}
+          >
+            <Input />
+          </Form.Item>
+          <Button className="submit-button" htmlType="submit">
+            提交
+          </Button>
+        </Form>
+      );
+    };
+
+    const specialWrapper = render(<DemoWithSpecialField />);
+    const specialFormElement = specialWrapper.querySelector('form');
+    const targetId = 'special-form-1-2-3';
+    const targetFieldNode = document.getElementById(targetId);
+
+    expect(targetFieldNode).toBeTruthy();
+    expect(targetFieldNode?.id).toBe(targetId);
+    expect(() => {
+      fireEvent.submit(specialFormElement as Element);
+    }).not.toThrow();
+
+    await sleep(20);
+    specialWrapper.unmount();
+  });
+
   it('getfieldsError', async () => {
     let e;
     try {
```

**File**: `components/Form/form.tsx` (modified, +10/-2)
```diff
@@ -31,6 +31,13 @@ function getFormElementId<FieldKey extends KeyType = string>(
   return prefix ? `${prefix}-${id}` : `${id}`;
 }
 
+function getFieldElement(node: HTMLElement, elementId: string) {
+  const target = document.getElementById(elementId);
+  if (target && node.contains(target)) {
+    return target;
+  }
+}
+
 const defaultProps = {
   layout: 'horizontal' as const,
   labelCol: { span: 5, offset: 0 },
@@ -100,10 +107,11 @@ const Form = <
     if (!node) {
       return;
     }
-    let fieldNode = node.querySelector(`#${getFormElementId(id, field as string)}`);
+    const fieldElementId = getFormElementId(id, field as string);
+    let fieldNode = getFieldElement(node, fieldElementId);
     if (!fieldNode) {
       // 如果设置了nostyle， fieldNode不存在，尝试直接查询表单控件
-      fieldNode = node.querySelector(`#${getFormElementId(id, field as string)}${ID_SUFFIX}`);
+      fieldNode = getFieldElement(node, `${fieldElementId}${ID_SUFFIX}`);
     }
     fieldNode &&
       scrollIntoView(fieldNode, {
```

---

### Incident Patch 6: `5f4cc226` (2026-05-06)
**Commit Message**: fix(Image): 修复关闭预览时触发父元素点击事件的问题 (#3178)

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusAI <genius_ai@bytedance.com>

**File**: `components/Image/__test__/preview.test.tsx` (modified, +19/-0)
```diff
@@ -197,6 +197,25 @@ describe('Image', () => {
     expect(mockVisibleChange.mock.calls[0]).toEqual([false, true]);
   });
 
+  it('should not trigger parent click event when click close button', () => {
+    const mockParentClick = jest.fn();
+    const mockVisibleChange = jest.fn();
+    const wrapper = render(
+      <div onClick={mockParentClick}>
+        <Image.Preview src={imgSrc} onVisibleChange={mockVisibleChange} defaultVisible />
+      </div>
+    );
+
+    jest.runAllTimers();
+
+    act(() => {
+      fireEvent.click(wrapper.find('.arco-image-preview-close-btn')[0]);
+    });
+
+    expect(mockVisibleChange.mock.calls[0]).toEqual([false, true]);
+    expect(mockParentClick).toHaveBeenCalledTimes(0);
+  });
+
   it('handle maskClosable prop correctly', () => {
     const mockVisibleChange = jest.fn();
     const wrapper = render(
```

**File**: `components/Image/image-preview.tsx` (modified, +3/-1)
```diff
@@ -8,6 +8,7 @@ import React, {
   useCallback,
   useMemo,
   WheelEvent,
+  MouseEvent,
 } from 'react';
 import ArcoCSSTransition from '../_util/CSSTransition';
 import { findDOMNode } from '../_util/react-dom';
@@ -255,7 +256,8 @@ function Preview(baseProps: ImagePreviewProps, ref) {
   }
 
   // Close button is clicked.
-  function onCloseClick() {
+  function onCloseClick(e: MouseEvent<HTMLDivElement>) {
+    e.stopPropagation();
     close();
   }
 
```

---

### Incident Patch 7: `032b8da1` (2026-05-06)
**Commit Message**: fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题 (#3177)

**File**: `components/List/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -2592,10 +2592,10 @@ Array [
         style="overflow-y:auto;overflow-anchor:none;max-height:560px"
       >
         <div
-          style="height:320000px;position:relative;overflow:hidden;z-index:0"
+          style="height:320000px;position:relative;overflow:hidden;overflow-anchor:none;z-index:0"
         >
           <div
-            style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
+            style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
           >
             <div
               class="arco-list-item"
```

**File**: `components/Table/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -16095,10 +16095,10 @@ exports[`renders Table/demo/virtualized.md correctly 1`] = `
                 style="overflow-y:auto;overflow-anchor:none;max-height:500px"
               >
                 <div
-                  style="height:3200000px;position:relative;overflow:visible;z-index:0;width:1000px;min-width:100%"
+                  style="height:3200000px;position:relative;overflow:visible;overflow-anchor:none;z-index:0;width:1000px;min-width:100%"
                 >
                   <div
-                    style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:auto;top:0;min-width:100%"
+                    style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:auto;top:0;min-width:100%"
                   >
                     <div
                       class="arco-table-tr"
```

**File**: `components/Tree/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -7592,10 +7592,10 @@ exports[`renders Tree/demo/virtual.md correctly 1`] = `
     tabindex="0"
   >
     <div
-      style="height:35520px;position:relative;overflow:hidden;z-index:0"
+      style="height:35520px;position:relative;overflow:hidden;overflow-anchor:none;z-index:0"
     >
       <div
-        style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
+        style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
       >
         <div
           aria-expanded="true"
```

**File**: `components/Tree/__test__/case.test.tsx` (modified, +7/-0)
```diff
@@ -69,6 +69,13 @@ describe('Tree case', () => {
     expect(firstNode.textContent).toBe('+');
   });
 
+  it('does not focus switcher when clicking by mouse', () => {
+    const wrapper = render(<Tree treeData={TreeData} />);
+    const firstNode = wrapper.find(`.arco-tree-node-switcher-icon`).item(0);
+
+    expect(fireEvent.mouseDown(firstNode)).toBe(false);
+  });
+
   it('show child correctly', async () => {
     const data = [
       {
```

**File**: `components/Tree/node.tsx` (modified, +1/-0)
```diff
@@ -128,6 +128,7 @@ function TreeNode(props: PropsWithChildren<NodeProps>, ref) {
           aria-label={expanded ? 'fold button' : 'expand button'}
           role="button"
           tabIndex={0}
+          onMouseDown={(e) => e.preventDefault()}
           onClick={switchExpandStatus}
         >
           {icon}
```

---

### Incident Patch 8: `6a9ac892` (2026-05-06)
**Commit Message**: fix(Menu):  修复ResizeObserver 回调内同步测量并更新 Menu 溢出状态，触发连续布局抖动，浏览器上报 loop error问题 (#3176)

* perf(Menu): 使用 raf 优化 resize 事件处理性能

Co-authored-by: GeniusAI <genius_ai@bytedance.com>

* fix: 优化抖动逻辑

---------

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusAI <genius_ai@bytedance.com>

**File**: `components/Menu/overflow-wrap.tsx` (modified, +22/-5)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useRef, useContext, ReactElement, ReactNode } from 'react';
+import React, { useState, useRef, useContext, ReactElement, ReactNode, useCallback } from 'react';
 import SubMenu from './sub-menu';
 import { getStyle } from '../_util/style';
 import MenuContext from './context';
@@ -7,6 +7,7 @@ import type { MenuProps } from './interface';
 import cs from '../_util/classNames';
 
 const OVERFLOW_THRESHOLD = 5;
+const WIDTH_CHANGE_THRESHOLD = 1;
 
 function getNodeWidth(node) {
   // getBoundingClientRect will get a result like 20.45
@@ -30,6 +31,7 @@ const OverflowWrap = (props: OverflowWrapProps) => {
   const { prefixCls } = useContext(MenuContext);
 
   const refUl = useRef(null);
+  const lastMeasuredWidthRef = useRef<number>(0);
   const [lastVisibleIndex, setLastVisibleIndex] = useState(null);
 
   const overflowSubMenuClass = `${prefixCls}-overflow-sub-menu`;
@@ -48,13 +50,24 @@ const OverflowWrap = (props: OverflowWrapProps) => {
     }
   };
 
-  function computeLastVisibleIndex() {
+  const computeLastVisibleIndex = useCallback(() => {
     if (!refUl.current) {
       return;
     }
 
     const ulElement = refUl.current;
-    const maxWidth = getNodeWidth(ulElement) - OVERFLOW_THRESHOLD;
+    const currentWidth = getNodeWidth(ulElement);
+
+    if (
+      lastMeasuredWidthRef.current &&
+      Math.abs(currentWidth - lastMeasuredWidthRef.current) < WIDTH_CHANGE_THRESHOLD
+    ) {
+      return;
+    }
+
+    lastMeasuredWidthRef.current = currentWidth;
+
+    const maxWidth = currentWidth - OVERFLOW_THRESHOLD;
     const childNodeList = [].slice.call(ulElement.children);
 
     let menuItemIndex = 0;
@@ -100,7 +113,7 @@ const OverflowWrap = (props: OverflowWrapProps) => {
 
     // 全部可见
     tryUpdateEllipsisStatus(null);
-  }
+  }, [children, lastVisibleIndex]);
 
   const renderOverflowSubMenu = (children, isMirror = false) => {
     return (
@@ -144,7 +157,11 @@ const OverflowWrap = (props: OverflowWrapProps) => {
   };
 
   return (
-    <ResizeObserver onResize={computeLastVisibleIndex} getTargetDOMNode={() => refUl.current}>
+    <ResizeObserver
+      onResize={computeLastVisibleIndex}
+      delayOnResizeByRaf
+      getTargetDOMNode={() => refUl.current}
+    >
       <div className={`${prefixCls}-overflow-wrap`} ref={refUl}>
         {renderChildren()}
       </div>
```

**File**: `components/_util/resizeObserver.tsx` (modified, +23/-1)
```diff
@@ -9,13 +9,18 @@ export interface ResizeProps {
   onResize?: (entry: ResizeObserverEntry[]) => void;
   children?: React.ReactNode;
   getTargetDOMNode?: () => any;
+  delayOnResizeByRaf?: boolean;
 }
 
 class ResizeObserverComponent extends React.Component<ResizeProps> {
   resizeObserver: ResizeObserver;
 
   rootDOMRef: any;
 
+  resizeFrameId: number;
+
+  latestEntry: ResizeObserverEntry[];
+
   getRootElement = () => {
     const { getTargetDOMNode } = this.props;
     return findDOMNode(getTargetDOMNode?.() || this.rootDOMRef, this);
@@ -40,13 +45,17 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
   }
 
   componentWillUnmount = () => {
+    if (this.resizeFrameId) {
+      cancelAnimationFrame(this.resizeFrameId);
+      this.resizeFrameId = null;
+    }
     if (this.resizeObserver) {
       this.destroyResizeObserver();
     }
   };
 
   createResizeObserver = () => {
-    const { throttle = true } = this.props;
+    const { throttle = true, delayOnResizeByRaf = false } = this.props;
     const onResize = (entry) => {
       this.props.onResize?.(entry);
     };
@@ -59,6 +68,18 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
         firstExec = false;
         onResize(entry);
       }
+
+      if (delayOnResizeByRaf) {
+        this.latestEntry = entry;
+        if (!this.resizeFrameId) {
+          this.resizeFrameId = requestAnimationFrame(() => {
+            this.resizeFrameId = null;
+            resizeHandler(this.latestEntry);
+          });
+        }
+        return;
+      }
+
       resizeHandler(entry);
     });
     const targetNode = this.getRootElement();
@@ -68,6 +89,7 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
   destroyResizeObserver = () => {
     this.resizeObserver && this.resizeObserver.disconnect();
     this.resizeObserver = null;
+    this.latestEntry = null;
   };
 
   render() {
```

---

### Incident Patch 9: `19493ab3` (2026-05-06)
**Commit Message**: fix(InputTag):  修复InputTag组件，当开启拖拽排序能力dragToSort后，在输入时，输入部分还未按enter保存为tag时，就可以拖拽为保存为tag的输入，拖拽完成后会报错问题 (#3174)

* fix(input-tag): 修复拖拽排序时输入框也参与拖拽的问题

Co-authored-by: GeniusAI <genius_ai@bytedance.com>

* fix: 更新测试用例快照

---------

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusAI <genius_ai@bytedance.com>

**File**: `components/Cascader/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -1038,22 +1038,16 @@ exports[`renders Cascader/demo/draggable.md correctly 1`] = `
                 </span>
               </div>
             </li>
-            <li
-              class="arco-draggable-item"
-              draggable="true"
-              style="display:inline-block"
-            >
-              <input
-                autocomplete="off"
-                class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-                placeholder=""
-                value=""
-              />
-              <span
-                class="arco-input-tag-input-mirror"
-              />
-            </li>
           </div>
+          <input
+            autocomplete="off"
+            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+            placeholder=""
+            value=""
+          />
+          <span
+            class="arco-input-tag-input-mirror"
+          />
         </div>
       </div>
     </div>
```

**File**: `components/InputTag/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -323,22 +323,16 @@ exports[`renders InputTag/demo/draggable.md correctly 1`] = `
             </span>
           </div>
         </li>
-        <li
-          class="arco-draggable-item"
-          draggable="true"
-          style="display:inline-block"
-        >
-          <input
-            autocomplete="off"
-            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-            placeholder=""
-            value=""
-          />
-          <span
-            class="arco-input-tag-input-mirror"
-          />
-        </li>
       </div>
+      <input
+        autocomplete="off"
+        class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+        placeholder=""
+        value=""
+      />
+      <span
+        class="arco-input-tag-input-mirror"
+      />
     </div>
     <div
       class="arco-input-tag-suffix"
```

**File**: `components/InputTag/__test__/index.test.tsx` (modified, +10/-0)
```diff
@@ -153,4 +153,14 @@ describe('InputTag', () => {
     expect(wrapper.querySelectorAll('.arco-tag')).toHaveLength(3);
     expect(wrapper.querySelector('input').getAttribute('value')).toBe('');
   });
+
+  it('should not make input area draggable when dragToSort is enabled', async () => {
+    const wrapper = render(<InputTag dragToSort defaultValue={['a', 'b', 'c', 'd']} />);
+    const eleInput = wrapper.querySelector('input') as HTMLElement;
+
+    fireEvent.change(eleInput, { target: { value: 'draft' } });
+    await sleep(10);
+
+    expect(wrapper.querySelectorAll('[draggable="true"]')).toHaveLength(4);
+  });
 });
```

**File**: `components/InputTag/input-tag.tsx` (modified, +10/-1)
```diff
@@ -529,11 +529,20 @@ function InputTag(baseProps: InputTagProps<string | ObjectValueType>, ref) {
                   arr.splice(isMoveLeft ? toIndex : toIndex - 1, 0, item);
                   return arr;
                 };
+                if (
+                  prevIndex < 0 ||
+                  index < 0 ||
+                  prevIndex >= value.length ||
+                  index > value.length
+                ) {
+                  return;
+                }
                 valueChangeHandler(moveItem(value, prevIndex, index), 'sort');
               }}
             >
-              {childrenTagWithAnimation.concat(suffixInput)}
+              {childrenTagWithAnimation}
             </Draggable>
+            {suffixInput}
           </UsedTransitionGroup>
         ) : (
           <UsedTransitionGroup
```

**File**: `components/Select/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -1484,22 +1484,16 @@ exports[`renders Select/demo/darggable.md correctly 1`] = `
                 </span>
               </div>
             </li>
-            <li
-              class="arco-draggable-item"
-              draggable="true"
-              style="display:inline-block"
-            >
-              <input
-                autocomplete="off"
-                class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-                placeholder=""
-                value=""
-              />
-              <span
-                class="arco-input-tag-input-mirror"
-              />
-            </li>
           </div>
+          <input
+            autocomplete="off"
+            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+            placeholder=""
+            value=""
+          />
+          <span
+            class="arco-input-tag-input-mirror"
+          />
         </div>
       </div>
     </div>
```

---

### Incident Patch 10: `c4e73328` (2026-05-06)
**Commit Message**: fix(Select): 修复 `retainInputValue` 在 `Option` 子节点为 React 节点时无效的问题 (#3173)

Co-authored-by: lingyunsong <lingyunsong@bytedance.com>
Co-authored-by: GeniusAI <genius_ai@bytedance.com>

**File**: `components/Select/__test__/index.test.tsx` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@ import { sleep, render } from '../../../tests/util';
 import mountTest from '../../../tests/mountTest';
 import componentConfigTest from '../../../tests/componentConfigTest';
 import Button from '../../Button';
+import Tooltip from '../../Tooltip';
 import Select from '../select';
 import { Enter, Tab } from '../../_util/keycode';
 import { LabeledValue, SelectProps } from '../interface';
@@ -207,6 +208,42 @@ describe('Select', () => {
     expect(onSearch.mock.calls[0][0]).toBe('A');
   });
 
+  it('retainInputValue works with Tooltip wrapped option children', async () => {
+    wrapper = render(
+      <Select showSearch={{ retainInputValue: true }} defaultValue="1">
+        <Option value="1">
+          <Tooltip content="tooltip content">content1</Tooltip>
+        </Option>
+      </Select>
+    );
+
+    const select = wrapper.querySelector('.arco-select');
+    const input = wrapper.querySelector('input') as HTMLInputElement;
+
+    fireEvent.click(select);
+    await sleep(100);
+    expect(input.value).toBe('content1');
+  });
+
+  it('retainInputValue works with div wrapped option children', async () => {
+    wrapper = render(
+      <Select showSearch={{ retainInputValue: true }} defaultValue="1">
+        <Option value="1">
+          <div>content1</div>
+        </Option>
+      </Select>
+    );
+
+    expect(wrapper.querySelector('.arco-select-view-value')).toHaveTextContent('content1');
+
+    const select = wrapper.querySelector('.arco-select');
+    const input = wrapper.querySelector('input') as HTMLInputElement;
+
+    fireEvent.click(select);
+    await sleep(100);
+    expect(input.value).toBe('content1');
+  });
+
   it('popup with correct position', async () => {
     wrapper = render(
       <Select
```

**File**: `components/Select/select.tsx` (modified, +23/-1)
```diff
@@ -45,6 +45,22 @@ import useMergeProps from '../_util/hooks/useMergeProps';
 import { SelectOptionProps } from '../index';
 import useId from '../_util/hooks/useId';
 
+const nodeToText = (node: ReactNode): string => {
+  if (typeof node === 'string' || typeof node === 'number') {
+    return String(node);
+  }
+
+  if (Array.isArray(node)) {
+    return node.map((item) => nodeToText(item)).join('');
+  }
+
+  if (React.isValidElement(node)) {
+    return nodeToText(node.props?.children);
+  }
+
+  return '';
+};
+
 // 用户创建中的option的origin标识
 const USER_CREATING_OPTION_ORIGIN = 'userCreatingOption';
 
@@ -838,13 +854,15 @@ function Select(baseProps: SelectProps, ref) {
           onSort={tryUpdateSelectValue}
           renderText={(value) => {
             const option = getOptionInfoByValue(value);
-            let text = value;
+            let text: ReactNode = value;
+            let textInput = String(value);
             if (isFunction(renderFormat)) {
               const paramsForCallback = getValueAndOptionForCallback(value, false);
               text = renderFormat(
                 (paramsForCallback.option as OptionInfo) || null,
                 paramsForCallback.value as ReactText | LabeledValue
               );
+              textInput = nodeToText(text);
             } else {
               let foundLabelFromProps = false;
               if (labelInValue) {
@@ -855,21 +873,25 @@ function Select(baseProps: SelectProps, ref) {
                   );
                   if (targetLabeledValue) {
                     text = targetLabeledValue.label;
+                    textInput = nodeToText(targetLabeledValue.label);
                     foundLabelFromProps = true;
                   }
                 } else if (isObject(propValue)) {
                   text = (propValue as LabeledValue).label;
+                  textInput = nodeToText((propValue as LabeledValue).label);
                   foundLabelFromProps = true;
                 }
               }
 
               if (!foundLabelFromProps && option && 'children' in option) {
                 text = option.children;
+                textInput = nodeToText(option.children);
               }
             }
 
             return {
               text,
+              textInput,
               disabled: option && option.disabled,
             };
           }}
```

**File**: `components/_class/select-view.tsx` (modified, +8/-4)
```diff
@@ -191,7 +191,7 @@ export interface SelectViewProps extends SelectViewCommonProps {
   prefixCls: string;
   rtl?: boolean;
   ariaControls?: string;
-  renderText: (value) => { text; disabled };
+  renderText: (value) => { text; textInput?: string; disabled };
   renderView?: (eleView: ReactElement) => ReactElement;
   onSort?: (value) => void;
   onRemoveCheckedItem?: (item, index: number, e) => void;
@@ -279,9 +279,13 @@ const CoreSelectView = React.forwardRef(
     const mergedFocused = focused || popupVisible;
     const isRetainInputValueSearch = isObject(showSearch) && showSearch.retainInputValue;
     // the formatted text of value.
-    const renderedValue = !isMultiple && value !== undefined ? renderText(value).text : '';
+    const renderedTextResult = !isMultiple && value !== undefined ? renderText(value) : null;
+    const renderedValue = renderedTextResult?.text ?? '';
+    const renderedValueInput = renderedTextResult?.textInput;
     const renderedValuePlain =
-      typeof renderedValue === 'string' || typeof renderedValue === 'number'
+      renderedValueInput !== undefined
+        ? renderedValueInput
+        : typeof renderedValue === 'string' || typeof renderedValue === 'number'
         ? String(renderedValue)
         : nodeToText(renderedValue);
 
@@ -401,7 +405,7 @@ const CoreSelectView = React.forwardRef(
 
       switch (searchStatus) {
         case SearchStatus.BEFORE:
-          _inputValue = inputValue || (isRetainInputValueSearch ? renderedValue : '');
+          _inputValue = inputValue || (isRetainInputValueSearch ? renderedValuePlain : '');
           break;
         case SearchStatus.EDITING:
           _inputValue = inputValue || '';
```

#### Recent Merged Pull Requests:
- **PR #3199** (2026-08-24): fix: prevent redundant OverflowEllipsis updates (@yzylin0)
- **PR #3197** (2026-08-07): fix(Cascader): 修复级联面板宽度变化导致页面抖动 (@lyspro)
- **PR #3193** (2026-07-14): fix(Table): 修复操作列左边线判断 (@lyspro)
- **PR #3192** (2026-07-14): fix(Trigger): 修复弹层横向边界计算 (@wsm972774037)
- **PR #3178** (2026-05-06): fix(Image): 修复Image.Preview 弹出层关闭按钮点击事件冒泡，导致误触发父元素的click事件的问题 (@lyspro)
- **PR #3177** (2026-05-06): fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题 (@lyspro)
- **PR #3176** (2026-05-06): fix(Menu):  修复ResizeObserver 回调内同步测量并更新 Menu 溢出状态，触发连续布局抖动，浏览器上报 loop error问题 (@lyspro)
- **PR #3175** (2026-05-06): fix(Form): 修复Form组件中form.scrollToField 命中数字开头或含特殊字符的字段 id 时抛出非法选择器错误，滚动失败问题 (@lyspro)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
