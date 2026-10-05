# Forensic Learning Record (Deep Inspection): ant-design/pro-components

> **Canonical Artifact**: `07_PROJECT_LEARNING/ant-design-pro-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ant-design/pro-components](https://github.com/ant-design/pro-components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:24.196Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ant-design/pro-components`
- **Description**: 🏆 Use Ant Design like a Pro!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4837 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.dumirc.ts`
```
import path from 'path';

import { defineConfig } from 'dumi';

export default defineConfig({
  title: 'ProComponents',
  exportStatic: {},
  sitemap: { hostname: 'https://procomponents.ant.design' },
  alias: {
    '@ant-design/pro-components': path.resolve(__dirname, 'src'),
  },
  utoopack: {},

  metas: [
    {
      property: 'og:site_name',
      content: 'ProComponents',
    },
    {
      'data-rh': 'keywords',
      property: 'og:image',
      content: 'https://procomponents.ant.design/icon.png',
    },
    {
      property: 'og:description',
      content: '🏆 让中后台开发更简单',
    },
    {
      name: 'keywords',
      content: '中后台,admin,Ant Design,ant design,Table,react,alibaba',
    },
    {
      name: 'description',
      content: '🏆 让中后台开发更简单 包含 table form 等多个组件。',
    },
    {
      name: 'apple-mobile-web-app-capable',
      content: 'yes',
    },
    {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'black-translucent',
    },
    {
      name: 'theme-color',
      content: '#1890ff',
    },
    {
      name: 'google-site-verification',
      content: '9LDp--DeEC-xOggsHl_t1MlR_1_2O972JpSUu8NZKMU',
    },
  ],
  analytics: {
    ga_v2: 'G-RMBLDHGL1N',
  },
  favicons: [
    'https://gw.alipayobjects.com/zos/rmsportal/rlpTLlbMzTNYuZGGCVYM.png',
  ],
  resolve: {
    docDirs: ['site'],
  },
  plugins: [path.join(__dirname, 'site-dumi-plugin')],
  styles: [
    `.markdown table{table-layout: fixed;}`,
    // 组件文档：标题层级与示例块节奏（dumi 默认 previewer 已有 margin，此处补足文内排版）
    `.markdown > h2 { margin-top: 40px; margin-bottom: 16px; font-weight: 600; }`,
    `.markdown > h2:first-child { margin-top: 0; }`,
    `.markdown > h3 { margin-top: 28px; margin-bottom: 12px; font-weight: 600; }`,
    `.markdown > h4 { margin-top: 22px; margin-bottom: 8px; font-weight: 600; }`,
    `.markdown > p { margin: 12px 0; line-height: 1.75; max-width: 960px; }`,
    `.markdown > ul, .markdown > ol { margin: 12px 0 16px; padding-left: 1.25em; line-height: 1.75; }`,
    `.dumi-default-previewer { margin: 28px 0 36px !important; }`,
    `.markdown .dumi-default-previewer:first-of-type { margin-top: 20px !important; }`,
  ],
  locales: [
    { id: 'zh-CN', name: '中文' },
    { id: 'en-US', name: 'English' },
  ],
  // ssr: {},
  themeConfig: {
    name: 'ProComponents',
    footer:
      'Powered by <a href="https://d.umijs.org" target="_blank" rel="noreferrer">dumi</a>',
    logo: 'https://gw.alipayobjects.com/zos/antfincdn/upvrAjAPQX/Logo_Tech%252520UI.svg',
    socialLinks: {
      github: 'https://github.com/ant-design/pro-components',
    },
    lastUpdated: true,
    hero: {
      title: 'ProComponents',
      description: '🏆 让中后台开发更简单',
      actions: {
        text: '🏮🏮 快速开始 →',
        link: '/components',
      },
    },

    hash: true,
    ignoreMomentLocale: true,
    features: {
      'zh-CN': [
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/q48YQ5X4ytAAAAAAAAAAAAAAFl94AQBr',
          title: '简单易用',
          description: '在 Ant Design 上进行了自己的封装，更加易用',
        },
        {
          image:
            'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
          title: 'Ant Design',
          description:
            '与 Ant Design 设计体系一脉相承，无缝对接 Ant Design 项目',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/UKqDTIp55HYAAAAAAAAAAAAAFl94AQBr',
          title: '国际化',
          description: '提供完备的国际化，与 Ant Design 体系打通，无需多余配置',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/Y_NMQKxw7OgAAAAAAAAAAAAAFl94AQBr',
          title: '预设样式',
          description:
            '样式风格与 Ant Design 一脉相承，无需魔改，浑然天成。默认好用的主题系统',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/U3XjS5IA1tUAAAAAAAAAAAAAFl94AQBr',
          title: '预设行为',
          description: '更少的代码，更少的 Bug，更多的功能',
        },
        {
          image:
            'https://gw.alipayobjects.com/zos/antfincdn/Eb8IHpb9jE/Typescript_logo_2020.svg',
          title: 'TypeScript',
          description:
            '使用 TypeScript 开发，提供完整的类型定义文件，无需频繁打开官网',
        },
      ],
      'en-US': [
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/q48YQ5X4ytAAAAAAAAAAAAAAFl94AQBr',
          title: 'Easy to Use',
          description:
            'Built on top of Ant Design with extra encapsulations for better usability',
        },
        {
          image:
            'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
          title: 'Ant Design',
          description:
            'Aligned with Ant Design design system for seamless integration',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/UKqDTIp55HYAAAAAAAAAAAAAFl94AQBr',
          title: 'Internationalization',
          description:
            'Provides full i18n support integrated with Ant Design—no extra config needed',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/Y_NMQKxw7OgAAAAAAAAAAAAAFl94AQBr',
          title: 'Preset Styles',
          description:
            'Styling aligned with Ant Design—ready-to-use themes without heavy customization',
        },
        {
          image:
            'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/U3XjS5IA1tUAAAAAAAAAAAAAFl94AQBr',
          title: 'Preset Behaviors',
          description: 'Less code, fewer bugs, more built-in functionality',
        },
        {
          image:
            'https://gw.alipayobjects.com/zos/antfincdn/Eb8IHpb9jE/Typescript_logo_2020.svg',
          title: 'TypeScript',
          description:
            'Developed with TypeScript and ships full type definitions for a better DX',
        },
      ],
    },
    nav: {
      'zh-CN': [
        { title: '文档', link: '/docs' },
        { title: '组件', link: '/components' },
        { title: 'Changelog', link: '/changelog' },
        { title: 'Playground', link: '/playground' },
        {
          title: '国内镜像',
          link: 'https://pro-components.antdigital.dev',
        },
      ],
      'en-US': [
        { title: 'Docs', link: '/en-US/docs' },
        { title: 'Components', link: '/en-US/components' },
        { title: 'Changelog', link: '/en-US/changelog' },
        { title: 'Playground', link: '/en-US/playground' },
      ],
    },
    sidebar: {
      '/en-US/components': [
        {
          title: 'Architecture Design',
          children: [
            {
              title: 'Component Design',
              link: '/en-US/components',
            },
          ],
        },
        {
          title: 'Layout',
          children: [
            {
              title: 'ProLayout',
              link: '/en-US/components/layout',
            },
            {
              title: 'PageContainer',
              link: '/en-US/components/page-container',
            },
            {
              title: 'ProCard',
              link: '/en-US/components/card',
            },

            {
              title: 'StatisticCard',
              link: '/en-US/components/statistic-card',
            },
            {
              title: 'CheckCard',
              link: '/en-US/components/check-card',
            },
          ],
        },
        {
          title: 'Data Entry',
          children: [
            {
              title: 'ProForm',
              link: '/en-US/components/form',
            },
            {
              title: 'ProFormFields',
              link: '/en-US/components/field-set',
            },
            {
              title: 'ProFormList',
              link: '/en-US/components/group',
            },
            {
              title: 'ProFormDependency',
              link: '/en-US/components/dependency',
            },
            {
              title: 'Schema Form',
             
```

### Core Architecture Module: `.fatherrc.ts`
```
import { defineConfig } from 'father';

const targets = {
  edge: 141,
  firefox: 140,
  chrome: 109,
  safari: 18,
  opera: 124,
  electron: 39,
};

const baseConfig = {
  platform: 'browser', // 默认构建为 Browser 环境的产物
  transformer: 'babel', // 默认使用 babel 以提供更好的兼容性
  parallel: true,
  targets,
} as const;

export default defineConfig({
  esm: {
    output: 'es',
    ...baseConfig,
  },
  cjs: {
    output: 'lib',
    ...baseConfig,
  },
  umd: {
    name: 'ProComponents',
    output: 'dist',
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      '^/antd/.*': 'antd',
      '^/dayjs/.*': 'dayjs',
    },
    targets,
  },
});

```

### Core Architecture Module: `demos/card/CheckCard/avatar.tsx`
```
import { UserOutlined } from '@ant-design/icons';
import { CheckCard } from '@ant-design/pro-components';
import { Avatar } from 'antd';

const Demo = () => (
  <>
    <CheckCard
      title="示例标题"
      avatar={
        <Avatar
          style={{ backgroundColor: '#7265e6' }}
          icon={<UserOutlined />}
          size="large"
        />
      }
    />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard Avatar Props 说明：</h4>
      <ul>
        <li>
          <strong>avatar</strong>: 卡片头像，可以是图片 URL 字符串或 React 节点
        </li>
        <li>
          <strong>title</strong>: 卡片标题
        </li>
      </ul>
      <h4>Avatar 组件 Props：</h4>
      <ul>
        <li>
          <strong>style</strong>: 头像样式对象，可以设置背景色等
        </li>
        <li>
          <strong>icon</strong>: 头像图标，可以是 Ant Design 图标组件
        </li>
        <li>
          <strong>size</strong>: 头像尺寸，可选值：'large' | 'default' | 'small'
        </li>
        <li>
          <strong>src</strong>: 头像图片地址（字符串形式）
        </li>
      </ul>
      <h4>Avatar 使用方式：</h4>
      <ul>
        <li>
          <strong>字符串</strong>: 直接传入图片 URL，如
          avatar="https://example.com/image.jpg"
        </li>
        <li>
          <strong>组件</strong>: 传入 Avatar 组件，可以自定义样式和图标
        </li>
        <li>
          <strong>图标</strong>: 使用 Ant Design 图标作为头像内容
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/card/CheckCard/basic.tsx`
```
/** Title: 基本使用 */
import { CheckCard } from '@ant-design/pro-components';

const Demo = () => (
  <>
    <CheckCard
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
      title="示例一"
      description="选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。"
      onChange={(_checked) => {}}
      defaultChecked
      onClick={() => {}}
    />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard Props 说明：</h4>
      <ul>
        <li>
          <strong>avatar</strong>: 卡片头像，可以是图片 URL 或 React 节点
        </li>
        <li>
          <strong>title</strong>: 卡片标题，可以是字符串或 React 节点
        </li>
        <li>
          <strong>description</strong>: 卡片描述信息，可以是字符串或 React 节点
        </li>
        <li>
          <strong>onChange</strong>: 选中状态改变时的回调函数，参数为
          checked（布尔值）
        </li>
        <li>
          <strong>defaultChecked</strong>: 默认是否选中，布尔值
        </li>
        <li>
          <strong>onClick</strong>: 点击卡片时的回调函数
        </li>
        <li>
          <strong>checked</strong>: 受控的选中状态，布尔值
        </li>
        <li>
          <strong>disabled</strong>: 是否禁用，布尔值
        </li>
        <li>
          <strong>size</strong>: 卡片尺寸，可选值：'default' | 'small' | 'large'
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/card/CheckCard/compose.tsx`
```
import { CheckCard } from '@ant-design/pro-components';

const Demo = () => (
  <>
    <h3>只有图片时</h3>
    <CheckCard avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg" />

    <h3>只有图片和描述时</h3>
    <CheckCard
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
      description="选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。"
    />
    <h3>只有标题和描述时</h3>
    <CheckCard
      title="示例"
      description="选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。"
    />
    <h3>只有标题和图片</h3>
    <CheckCard
      title="示例"
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
    />
    <h3>只有标题</h3>
    <CheckCard title="示例" />
    <h3>只有描述时</h3>
    <CheckCard description="选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。" />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard 属性组合说明：</h4>
      <ul>
        <li>
          <strong>avatar</strong>: 卡片头像，可以是图片 URL 或 React 节点
        </li>
        <li>
          <strong>title</strong>: 卡片标题，可以是字符串或 React 节点
        </li>
        <li>
          <strong>description</strong>: 卡片描述信息，可以是字符串或 React 节点
        </li>
      </ul>
      <h4>属性组合效果：</h4>
      <ul>
        <li>
          <strong>只有 avatar</strong>: 显示头像，适合图标展示
        </li>
        <li>
          <strong>avatar + description</strong>: 头像和描述组合，适合产品介绍
        </li>
        <li>
          <strong>title + description</strong>: 标题和描述组合，适合内容展示
        </li>
        <li>
          <strong>title + avatar</strong>: 标题和头像组合，适合品牌展示
        </li>
        <li>
          <strong>只有 title</strong>: 仅显示标题，适合简单标识
        </li>
        <li>
          <strong>只有 description</strong>: 仅显示描述，适合说明文字
        </li>
      </ul>
      <h4>布局特点：</h4>
      <ul>
        <li>
          <strong>自适应布局</strong>: 根据提供的属性自动调整布局
        </li>
        <li>
          <strong>内容居中</strong>: 单个属性时内容会自动居中显示
        </li>
        <li>
          <strong>响应式</strong>: 在不同屏幕尺寸下保持良好的显示效果
        </li>
        <li>
          <strong>灵活组合</strong>: 支持任意属性的组合使用
        </li>
      </ul>
      <h4>使用建议：</h4>
      <ul>
        <li>
          <strong>图标卡片</strong>: 使用只有 avatar 的组合
        </li>
        <li>
          <strong>产品卡片</strong>: 使用 avatar + title + description 组合
        </li>
        <li>
          <strong>内容卡片</strong>: 使用 title + description 组合
        </li>
        <li>
          <strong>品牌卡片</strong>: 使用 title + avatar 组合
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/card/CheckCard/custom.tsx`
```
import { CheckCard } from '@ant-design/pro-components';

const Demo = () => (
  <>
    <CheckCard
      title="Card title"
      description="This is the description"
      style={{ width: 200, height: 200 }}
    />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard 自定义样式说明：</h4>
      <ul>
        <li>
          <strong>style</strong>: 自定义样式对象，可以覆盖默认样式
        </li>
        <li>
          <strong>title</strong>: 卡片标题
        </li>
        <li>
          <strong>description</strong>: 卡片描述信息
        </li>
      </ul>
      <h4>Style 属性说明：</h4>
      <ul>
        <li>
          <strong>width</strong>: 卡片宽度，可以是数字（像素）或字符串
        </li>
        <li>
          <strong>height</strong>: 卡片高度，可以是数字（像素）或字符串
        </li>
        <li>
          <strong>backgroundColor</strong>: 背景颜色
        </li>
        <li>
          <strong>border</strong>: 边框样式
        </li>
        <li>
          <strong>borderRadius</strong>: 圆角半径
        </li>
        <li>
          <strong>padding</strong>: 内边距
        </li>
        <li>
          <strong>margin</strong>: 外边距
        </li>
      </ul>
      <h4>自定义样式特点：</h4>
      <ul>
        <li>
          <strong>优先级</strong>: style 属性会覆盖组件的默认样式
        </li>
        <li>
          <strong>响应式</strong>: 可以使用媒体查询实现响应式样式
        </li>
        <li>
          <strong>主题适配</strong>: 可以结合 CSS 变量实现主题切换
        </li>
        <li>
          <strong>灵活控制</strong>: 可以精确控制卡片的尺寸和外观
        </li>
      </ul>
      <h4>使用建议：</h4>
      <ul>
        <li>
          <strong>固定尺寸</strong>: 使用 width 和 height 设置固定尺寸
        </li>
        <li>
          <strong>百分比布局</strong>: 使用百分比值实现响应式布局
        </li>
        <li>
          <strong>主题定制</strong>: 结合 CSS 变量实现主题定制
        </li>
        <li>
          <strong>动画效果</strong>: 可以添加 transition 等动画效果
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/card/CheckCard/defaultChecked.tsx`
```
import { CheckCard } from '@ant-design/pro-components';

const Demo = () => (
  <>
    <CheckCard
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
      title="示例二"
      defaultChecked
      onChange={(_checked) => {}}
    />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard DefaultChecked Props 说明：</h4>
      <ul>
        <li>
          <strong>defaultChecked</strong>:
          默认选中状态，布尔值，组件初始化时生效
        </li>
        <li>
          <strong>onChange</strong>: 选中状态改变时的回调函数
        </li>
        <li>
          <strong>avatar</strong>: 卡片头像
        </li>
        <li>
          <strong>title</strong>: 卡片标题
        </li>
      </ul>
      <h4>DefaultChecked 特点：</h4>
      <ul>
        <li>
          <strong>非受控组件</strong>: 使用 defaultChecked
          时，组件内部管理选中状态
        </li>
        <li>
          <strong>初始化生效</strong>:
          只在组件首次渲染时生效，后续状态由组件内部管理
        </li>
        <li>
          <strong>用户可交互</strong>: 用户可以通过点击改变选中状态
        </li>
        <li>
          <strong>状态反馈</strong>: 通过 onChange 回调获取状态变化
        </li>
      </ul>
      <h4>OnChange 回调：</h4>
      <ul>
        <li>
          <strong>参数</strong>: checked（布尔值），表示当前选中状态
        </li>
        <li>
          <strong>触发时机</strong>: 用户点击卡片时触发
        </li>
        <li>
          <strong>用途</strong>: 可以用于记录用户选择、触发其他操作等
        </li>
      </ul>
      <h4>与 Checked 的区别：</h4>
      <ul>
        <li>
          <strong>defaultChecked</strong>: 非受控，组件内部管理状态
        </li>
        <li>
          <strong>checked</strong>: 受控，由外部状态管理
        </li>
        <li>
          <strong>使用场景</strong>: defaultChecked 适合简单场景，checked
          适合复杂状态管理
        </li>
      </ul>
      <h4>使用建议：</h4>
      <ul>
        <li>
          <strong>简单选择</strong>: 使用 defaultChecked 实现简单的选择功能
        </li>
        <li>
          <strong>状态同步</strong>: 使用 onChange 回调同步状态到外部
        </li>
        <li>
          <strong>默认选中</strong>: 设置 defaultChecked={true} 实现默认选中
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```

### Core Architecture Module: `demos/card/CheckCard/description.tsx`
```
import { CheckCard } from '@ant-design/pro-components';
import { Typography } from 'antd';

const { Paragraph } = Typography;

const Demo = () => (
  <>
    <CheckCard
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
      title="默认描述区域不会进行折行"
      description={
        <span>
          选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。
          <a
            href=""
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            查看详情
          </a>
        </span>
      }
    />
    <CheckCard
      avatar="https://gw.alipayobjects.com/zos/bmw-prod/f601048d-61c2-44d0-bf57-ca1afe7fd92e.svg"
      title="你可以通过排版组件进行省略"
      description={
        <Paragraph ellipsis={{ rows: 2 }}>
          选择一个由流程编排提供的典型用户案例，可以从中学习到流程编排很多设计理念。
        </Paragraph>
      }
    />

    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <h4>CheckCard Description Props 说明：</h4>
      <ul>
        <li>
          <strong>description</strong>: 卡片描述信息，可以是字符串或 React 节点
        </li>
        <li>
          <strong>title</strong>: 卡片标题
        </li>
        <li>
          <strong>avatar</strong>: 卡片头像
        </li>
      </ul>
      <h4>Description 使用方式：</h4>
      <ul>
        <li>
          <strong>字符串</strong>: 直接传入字符串，默认不会折行
        </li>
        <li>
          <strong>组件</strong>: 传入 React 节点，可以包含链接、排版组件等
        </li>
      </ul>
      <h4>复杂 Description 示例：</h4>
      <ul>
        <li>
          <strong>链接</strong>: 在描述中添加可点击的链接，使用 stopPropagation
          阻止事件冒泡
        </li>
        <li>
          <strong>排版组件</strong>: 使用 Typography.Paragraph 组件控制文本显示
        </li>
        <li>
          <strong>省略处理</strong>: 使用 ellipsis 属性控制文本省略行数
        </li>
      </ul>
      <h4>Typography.Paragraph Props：</h4>
      <ul>
        <li>
          <strong>ellipsis</strong>: 省略配置，可以设置 rows（行数）等属性
        </li>
        <li>
          <strong>rows</strong>: 显示的行数，超出部分会省略
        </li>
        <li>
          <strong>expandable</strong>: 是否可展开，布尔值
        </li>
      </ul>
      <h4>事件处理：</h4>
      <ul>
        <li>
          <strong>stopPropagation</strong>: 阻止事件冒泡，避免触发卡片的点击事件
        </li>
        <li>
          <strong>preventDefault</strong>: 阻止默认行为，如链接跳转
        </li>
      </ul>
    </div>
  </>
);

export default () => (
  <div style={{ padding: 24 }}>
    <Demo />
  </div>
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9709** (2026-09-28): **🐛[BUG] Form 验证导致表单高度变化**
  *Symptoms*: ### 🐛 bug 描述 Form 验证不通过导致表单高度变化 只要添加了 addonBefore 和 addonAfter 验证失败高度必变化.  https://codesandbox.io/p/sandbox/cha-xun-biao-ge-forked-dk7ngj  ### 📷 复现步骤  <img width="1404" height="940" alt="Image" src="https://github.com/user-attachments/assets/6a3fd011-97cc-42cc-99c4-0987877eba88" />  ### 🏞 期望结果 验证不通过高度不要变化  ### 💻 复现代码 https://codesandbox.io/p/sandbox/cha-xun-biao-ge-forked-dk7ngj  ### © 版本信息  - ProComponents 版本:  3.1.15-1 - umi 版本  - 浏览器环境  版本 153.0.7993.0（正式版本）dev (arm64) - 开发环境 [e.g. mac OS] mac OS 
  **Post-Mortem & Fix Analysis**:
  > 提个pr？
  > 已在 master 修复（6fd248053）：校验错误提示改用 Form.Item 公开 API（函数式 help + additionalDom 常驻占位）渲染，校验出现/消失不再引起表单高度抖动。将随下个版本发布。

- **Issue #9708** (2026-09-26): **feat(table): cell-level editableKeys and onCell editing state (#9643)**
  *Symptoms*: ## Summary  Implements **proposal A + C** of the [#9643](https://github.com/ant-design/pro-components/issues/9643) design (A/B/C options were posted in the issue for maintainer sign-off):  ### A. Cell-level composite keys in `editableKeys` ```tsx <EditableProTable   rowKey=id   editable={{ editableKeys: ['1:name'] }}  // only row 1 name cell edits /> ``` - Format: `` `${rowKey}:${dataIndex}` `` — freely mixable with row keys (`['1', '2:age']`) - **Fully backwards compatible**: plain row keys behave exactly as before - Row-level activation still renders the option column save/cancel buttons; cell-only activation skips them (a cell edit has no row-level confirm affordance — commit timing is left to app-level `onValuesChange`/blur handling, per the proposal decision point)  ### C. `onCell` editing state (#9043) - ProTable wraps user `onCell` callbacks and injects `data-editing` / `data-cell-editing` attributes on the `td`, so apps can style or detect editing cells without re-rendering columns - User `onCell` return values are preserved  ### Implementation - `useEditableArray.isEditable` now also returns `isRowEditable` and `cellEditableKeys` (deduped) - `columnRender` computes per-column edit mode; option column skips action buttons when only cell keys are active - `render` callback config gains `isCellEditable`  ## Test Plan - [x] `tsc --noEmit` clean, `eslint` 0 errors - [x] New `cellEditable.test.tsx` (7 cases): cell-only activation, no save/cancel in cell mode, row-level com
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9708"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  本次更新涉及 ProForm、ProDescriptions、金额字段和表格。新增表单加载渲染与 Select 本地搜索选项，支持 EditableProTable 单元格编辑，并调整金额 locale 格式化、依赖值传递及表格省略和默认参数处理。  ### Changes  **表单与字段处理**  |Layer / File(s)|Summary| |---|---| |**Select 搜索与表单加载** <br> `src/form/components/Select/*`, `src/field/components/Select/*`, `src/form/BaseForm/BaseForm.tsx`, `demos/field/select-local-search.tsx`, `demos/form/loading-render.tsx`, `tests/form/selectLocalSearch.test

- **Issue #9704** (2026-09-25): **This repository is compromised**
  *Symptoms*: The file https://github.com/ant-design/pro-components/blob/a6d9593845a79f0f249578975699e18c4c1c9af0/.claude/index.js contains Shai-Hulud malware and risks infecting any user of this project.   Introduced in [1bc4049d295a4af4da3cef8074e4b5d7312a6858](https://github.com/ant-design/pro-components/commit/1bc4049d295a4af4da3cef8074e4b5d7312a6858). 
  **Post-Mortem & Fix Analysis**:
  > Closing after repository triage: this report is fixed on the current master branch, already resolved upstream, duplicated by a tracked issue, or otherwise confirmed complete. If the problem still reproduces on the latest release, please comment with a minimal reproduction and maintainers can reopen it.

- **Issue #9703** (2026-09-25): **🐛[BUG] ProForm 容器销毁重建后 formRef.current.getFieldsFormatValue() 返回空对象**
  *Symptoms*: # 🐛 [3.1.13-0 起的回归] ProForm 容器销毁重建后 `formRef.current.getFieldsFormatValue()` 返回空对象  ## 🐛 bug 描述  `<ProForm>` 使用 `formRef` + `request` 时，如果承载它的容器（`Modal` / `Drawer`，且 `destroyOnHidden`）关闭后**重新打开并渲染另一条记录**，`formRef.current` 上暴露的格式化取值方法会拿到空值：  - `formRef.current.getFieldsFormatValue()` 返回 `{}`（空对象） - 同一个实例上 `getFieldsValue(true)` 仍能拿到完整数据，但 `getFieldsValue()`（只返回已注册字段）返回 `{}` - 页面上的表单显示、校验都正常，**只有通过 `formRef` 取值拿到空值** → 保存时静默提交 `{}`  实测输出：  ``` open A:               registered=2  all=2  formatted={"id":"A","name":"name-of-A"} open B after close:   registered=0  all=2  formatted={}          ← 复现 save -> {}                                                        ← 提交空对象 ```  ## 📷 复现步骤  1. 页面中常驻渲染 `<Editor item={item} />`，内部为 `<Modal destroyOnHidden open={!!item}>` + `<ProForm formRef={formRef} request={...}>` 2. 点击「open A」打开弹窗，等待 `request` 返回 3. 关闭弹窗，点击「open B」（**关闭后再打开另一条记录**） 4. 在 B 上触发 `formRef.current.getFieldsFormatValue()`  ## 🏞 期望结果  关闭再打开另一条记录后，`formRef.current.getFieldsFormatValue()` 返回当前挂载表单的值（`{"id":"B","name":"name-of-B"}`），且 `getFieldsValue()` 与 `getFieldsValue(true)` 的字段集合一致。  ## 💻 复现代码  ### 最小工程  附件 `proform-repro.zip`（仅 4 个源码文件，无 node_modules）。解压后：  ```bash npm install npm run dev     # http://127.0.0.1:5199/ ```  ``` proform-repro/ ├─ index.html ├─ package.json ├─ vite.config.ts └─ src/main.tsx ```  `src/main.tsx`（完整代码）：  ```tsx import { useRef, useState } from 'react'; import { ProForm, ProFormInstance, ProFormText } from '@ant-design/pro-components'; import 
  **Post-Mortem & Fix Analysis**:
  > [proform-repro.zip](https://github.com/user-attachments/files/32591304/proform-repro.zip)
  > Closing after repository triage: this report is fixed on the current master branch, already resolved upstream, duplicated by a tracked issue, or otherwise confirmed complete. If the problem still reproduces on the latest release, please comment with a minimal reproduction and maintainers can reopen it.

- **Issue #9701** (2026-09-24): **fix(table): respect option column alignment**
  *Symptoms*: ## Summary  Fixes ant-design/ant-design-pro#11958  When an option column's custom `render` returns an array, `columnRender` wraps the actions in a block-level flex container with `justifyContent: 'flex-start'`. This overrides the intended horizontal alignment even though the table header and cell receive `text-align: center`.  - Derive the option container's `justifyContent` from the column's `align`. - Apply the same mapping in read and edit mode, including right alignment. - Preserve the default left alignment, existing spacing, and non-array custom render behavior. - Add eight integration regression cases covering omitted, left, center, and right alignment in both modes, including header/cell alignment assertions.  ## Verification  - Before the source fix: the new suite reproduced three failures (read-center, read-right, edit-right); the other five cases passed. - After the fix: `pnpm test tests/table/option-align.test.tsx tests/table/column.test.tsx tests/table/editor-table.test.tsx tests/table/editor-table-two.test.tsx` passed all 79 tests across four files. - `pnpm run tsc` passed. - `pnpm exec eslint src/table/utils/columnRender.tsx tests/table/option-align.test.tsx` passed. - `pnpm exec prettier --check src/table/utils/columnRender.tsx tests/table/option-align.test.tsx` passed. - Ant Design CLI lint on the changed source file reported no issues. - `pnpm build` passed (browser bundle, ESM, CJS, and declarations).  Tests ran with Node 24 using the repository's frozen pn
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9701#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/ant-design/pro-components/pull/9701#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `b17c02b7-3e0d-4692-a00d-09f36dddc1dd`  <

- **Issue #9699** (2026-09-25): **🐛[BUG] ProTable 默认密度按钮触发 Function components cannot be given refs 警告**
  *Symptoms*: ### 🐛 bug 描述  在 React 18、Ant Design 6 环境中使用 ProTable，启用默认工具栏后，控制台出现以下警告：  ```text Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?  Check the render method of `Trigger`.     at DensityIcon     at Trigger     ...     at ProTable ```  检查当前版本源码发现，工具栏外层 `Tooltip` 直接包裹 `DensityIcon`。`DensityIcon` 是未使用 `forwardRef` 的普通函数组件，无法接收 `Tooltip/Trigger` 注入的 ref。  ### 📷 复现步骤  1. 使用下述版本创建 React 18 项目。 2. 渲染包含默认工具栏的 ProTable。 3. 在开发模式下打开页面，查看浏览器控制台。 4. 观察是否出现指向 `DensityIcon` 的 ref 警告。  以下代码为根据项目场景整理的最小复现代码，尚未在独立沙箱中验证。  ### 🏞 期望结果  默认密度按钮正常展示，提示和密度切换功能正常，控制台不出现 ref 警告。  ### 💻 复现代码  ```tsx import { ProTable } from '@ant-design/pro-components';  export default function App() {   return (     <ProTable<{ id: number; name: string }>       rowKey="id"       search={false}       columns={[{ title: '名称', dataIndex: 'name' }]}       dataSource={[{ id: 1, name: '测试数据' }]}     />   ); } ```  ### © 版本信息  - ProComponents 版本：`3.1.14-7` - Ant Design 版本：`6.6.4` - React / React DOM 版本：`18.3.1` - Umi 版本：`@umijs/max 4.7.17` - 浏览器环境：待补充浏览器名称及版本 - 开发环境：Windows，本地开发模式  ### 🚑 其他信息  相关源码位置：  ```text es/table/components/ToolBar/index.js es/table/components/ToolBar/DensityIcon.js ```  工具栏生成的节点结构相当于：  ```tsx <Tooltip title="表格密度">   <DensityIcon /> </Tooltip> ```  建议由组件库调整该处的 ref 传递，例如增加原生 DOM 宿主，或让组件正确转发 ref 和触发事件。项目侧暂未保留兼容补丁。
  **Post-Mortem & Fix Analysis**:
  > Closing after repository triage: this report is fixed on the current master branch, already resolved upstream, duplicated by a tracked issue, or otherwise confirmed complete. If the problem still reproduces on the latest release, please comment with a minimal reproduction and maintainers can reopen it.

- **Issue #9698** (2026-09-25): **🐛[BUG]开启watermark后，protable的sticky失效了。**
  *Symptoms*: 提问前先看看：  https://github.com/ryanhanwu/How-To-Ask-Questions-The-Smart-Way/blob/main/README-zh_CN.md  ### 🐛 bug 描述  在umi/max下开启waterMarkProps配置，protable表头的吸附固钉失效了  ### 📷 复现步骤  umijs/max项目，使用pro@3，antd@6，在app.tsx内export的Layout内设置水印，protable组件设置sticky，滚动至底部  ### 🏞 期望结果  滚动底部能正常看到protable表头  ### 💻 复现代码  app.tsx内     waterMarkProps: { content: '测试环境', gap: [100, 100] }, protable组件 sticky={{ offsetHeader: 48 }}  ### © 版本信息  - ProComponents 版本: 3.1.14-7 - umi 版本4.7.17 - antd 版本6.6.4 - 浏览器环境 - 开发环境 [e.g. mac OS]  ### 🚑 其他信息  <img width="1045" height="265" alt="Image" src="https://github.com/user-attachments/assets/3bfbff3e-123a-4e09-a951-95634e1b74f4" /> 
  **Post-Mortem & Fix Analysis**:
  > <img width="720" height="141" alt="Image" src="https://github.com/user-attachments/assets/d7894d0f-0c95-446d-8d5d-7f9f00490f66" /> 排查发现，在添加了水印后，会在ant-pro-page-container-children-container外层添加一个div 该div包含overflow: hidden的css属性， 目前我是在waterMarkProps内加一个style: { overflow: 'visible' },即可恢复正常  补充：对比了一下ProComponents3和ProComponents2的layout代码实现，发现ProComponents2使用的是独立的watermark（@ant-design\pro-layout\es\components\PageContainer\index.js 第16行）（@ant-design\pro-layout\es\components\WaterMark\index.js），这里面没有overflow: hidden，ProComponents3转为antd的watermark（@ant-design\pro-components\es\layout\components\PageContainer\index.js 第一行），所以才引发了这个bug
  > Closing after repository triage: this report is fixed on the current master branch, already resolved upstream, duplicated by a tracked issue, or otherwise confirmed complete. If the problem still reproduces on the latest release, please comment with a minimal reproduction and maintainers can reopen it.

- **Issue #9697** (2026-09-25): **🐛[BUG] [ProLayout] 升级 3.1.14-7 后，异步菜单配置 defaultOpenAll 无法默认展开子菜单**
  *Symptoms*: ### 🐛 bug 描述  升级 `@ant-design/pro-components` 后，ProLayout 的侧栏菜单无法按配置默认展开。  项目使用 `layout="mix"`、`splitMenus={true}`，通过 `menu.request` 异步加载菜单。非项目中心页面设置了：  ```tsx menu={{   defaultOpenAll: true,   ignoreFlatMenu: true, }} ```  但菜单加载完成后，包含子菜单的节点仍然处于收起状态，例如截图中的「项目医院申请」「设置」。  上述配置在升级前可以正常使用，目前尚未确定引入问题的具体版本。  ### 📷 复现步骤  1. 使用 ProLayout，设置 `layout="mix"` 和 `splitMenus={true}`。 2. 使用 `menu.request` 异步返回包含多级子菜单的菜单数据。 3. 设置 `menu.defaultOpenAll=true`、`menu.ignoreFlatMenu=true`。 4. 打开或刷新页面，等待菜单加载完成。 5. 观察侧栏：包含子菜单的节点没有默认展开。  ### 🏞 期望结果  异步菜单加载完成后，侧栏所有子菜单默认展开。  用户仍然可以手动展开、收起子菜单。  ### 💻 复现代码  以下是根据业务配置简化的示例，尚未在独立项目中验证：  ```tsx import { ProLayout } from '@ant-design/pro-components';  export default function Demo() {   return (     <ProLayout       title="菜单展开测试"       layout="mix"       splitMenus       location={{ pathname: '/platform/project/workbench' }}       menu={{         locale: false,         defaultOpenAll: true,         ignoreFlatMenu: true,         request: async () => [           {             path: '/platform/project',             name: '项目',             children: [               {                 path: '/platform/project/workbench',                 name: '运营工作台',               },               {                 path: '/platform/project/hospital',                 name: '项目医院申请',                 children: [                   {                     path: '/platform/project/hospital/list',                     name: '申请列表',                   },                 ],               
  **Post-Mortem & Fix Analysis**:
  > Closing after repository triage: this report is fixed on the current master branch, already resolved upstream, duplicated by a tracked issue, or otherwise confirmed complete. If the problem still reproduces on the latest release, please comment with a minimal reproduction and maintainers can reopen it.

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

### Incident Patch 1: `1ee2c494` (2026-09-28)
**Commit Message**: fix(card): support tabs.cardProps.ghost to remove tab content padding (#9052)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/card/components/Card/index.tsx` (modified, +12/-11)
```diff
@@ -275,7 +275,9 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
         role="button"
         tabIndex={collapsible === 'icon' ? 0 : undefined}
         className={clsx(`${prefixCls}-collapsible-icon`, hashId)}
-        onClick={collapsible === 'icon' ? handleCollapsibleIconClick : undefined}
+        onClick={
+          collapsible === 'icon' ? handleCollapsibleIconClick : undefined
+        }
         onKeyDown={
           collapsible === 'icon'
             ? (e) => {
@@ -297,15 +299,10 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
       />
     ));
 
-  const headerCls = clsx(
-    `${prefixCls}-header`,
-    hashId,
-    classNames?.header,
-    {
-      [`${prefixCls}-header-border`]: headerBordered || type === 'inner',
-      [`${prefixCls}-header-collapsible`]: collapsibleButton,
-    },
-  );
+  const headerCls = clsx(`${prefixCls}-header`, hashId, classNames?.header, {
+    [`${prefixCls}-header-border`]: headerBordered || type === 'inner',
+    [`${prefixCls}-header-collapsible`]: collapsibleButton,
+  });
 
   const titleCls = clsx(`${prefixCls}-title`, hashId, classNames?.title);
   const extraCls = clsx(`${prefixCls}-extra`, hashId, classNames?.extra);
@@ -365,7 +362,11 @@ const Card = React.forwardRef((props: CardProps, ref: any) => {
             onChange={tabs.onChange}
             {...omit(tabs, ['cardProps'])}
             items={ModifyTabItemsContent}
-            className={clsx(`${prefixCls}-tabs`, hashId)}
+            className={clsx(`${prefixCls}-tabs`, hashId, {
+              // #9052 tabs.cardProps.ghost：去掉 tab 内容区 padding，
+              // 与顶层 ghost 语义一致（内容区无 padding、透明背景）
+              [`${prefixCls}-tabs-ghost`]: tabs.cardProps?.ghost,
+            })}
           />
         )
       ) : (
```

**File**: `src/card/components/Card/style.ts` (modified, +8/-1)
```diff
@@ -262,10 +262,17 @@ const genProCardStyle: GenerateStyle<ProCardToken> = (token) => {
           paddingBlock: token.paddingXS,
         },
       },
-
     },
 
     [`${componentCls}-tabs`]: {
+      [`&${componentCls}-tabs-ghost`]: {
+        // #9052 ghost 模式下 tab 内容区不再保留 padding
+        [`> ${token.antCls}-tabs-body-holder`]: {
+          [`${token.antCls}-tabs-content`]: {
+            padding: 0,
+          },
+        },
+      },
       [`&${token.antCls}-tabs-top`]: {
         [`> ${token.antCls}-tabs-nav`]: {
           marginBlockEnd: 0,
```

**File**: `tests/card/tabsGhost.test.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { render } from '@testing-library/react';
+import React from 'react';
+import { describe, expect, it } from 'vitest';
+import { ProCard } from '../../src';
+
+// #9052: tabs.cardProps.ghost 应去掉 tab 内容区 padding
+describe('#9052 ProCard tabs cardProps ghost', () => {
+  it('applies ghost class to tabs when tabs.cardProps.ghost is true', () => {
+    const { container } = render(
+      <ProCard
+        tabs={{
+          cardProps: { ghost: true },
+          items: [
+            { key: 'a', label: 'A', children: <div>content-a</div> },
+          ],
+        }}
+      />,
+    );
+
+    const tabs = container.querySelector('.ant-pro-card-tabs');
+    expect(tabs?.classList.contains('ant-pro-card-tabs-ghost')).toBe(true);
+  });
+
+  it('does not apply ghost class by default', () => {
+    const { container } = render(
+      <ProCard
+        tabs={{
+          items: [
+            { key: 'a', label: 'A', children: <div>content-a</div> },
+          ],
+        }}
+      />,
+    );
+
+    const tabs = container.querySelector('.ant-pro-card-tabs');
+    expect(tabs?.classList.contains('ant-pro-card-tabs-ghost')).toBe(false);
+  });
+});
```

---

### Incident Patch 2: `f69b584e` (2026-09-28)
**Commit Message**: fix(form): keep field id on wrapper span for Upload scroll fallback (#8992)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/form/components/UploadButton/index.tsx` (modified, +6/-4)
```diff
@@ -121,10 +121,12 @@ const BaseProFormUploadButton: React.FC<ProFormUploadButtonProps> =
         (max === undefined || !value || value?.length < max) && mode !== 'read';
       const isPictureCard =
         (listType ?? fieldProps?.listType) === 'picture-card';
-      // 参考 antd：不传 id 给 Upload，避免点击 label 触发 file input 打开文件选择器
-      const { id: _id, ...uploadFieldProps } = fieldProps || {};
+      // #9298 不把 id 透传给 Upload（内部 file input 会因 label htmlFor 被点击触发打开文件选择器），
+      // 但 #8992 又需要 id 留在 DOM 上供 form.scrollToField 的 getElementById fallback 定位。
+      // 折中：id 挂到外层包裹 span（不可聚焦，label 点击不会聚焦/触发它）
+      const { id: fieldId, ...uploadFieldProps } = fieldProps || {};
       return (
-        <>
+        <span id={fieldId}>
           <Upload
             action={action}
             accept={accept}
@@ -167,7 +169,7 @@ const BaseProFormUploadButton: React.FC<ProFormUploadButtonProps> =
               src={previewImage}
             />
           )}
-        </>
+        </span>
       );
     },
   );
```

**File**: `src/form/components/UploadDragger/index.tsx` (modified, +42/-38)
```diff
@@ -83,45 +83,49 @@ const BaseProFormUploadDragger: React.FC<ProFormUploadDraggerProps> =
         (max === undefined || !value || value?.length < max) &&
         mode !== 'read' &&
         proFieldProps?.readonly !== true;
-      // 参考 antd：不传 id 给 Upload，避免点击 label 触发 file input 打开文件选择器
-      const { id: _id, ...uploadFieldProps } = fieldProps || {};
+      // #9298 不把 id 透传给 Upload（内部 file input 会因 label htmlFor 被点击触发打开文件选择器），
+      // 但 #8992 又需要 id 留在 DOM 上供 form.scrollToField 的 getElementById fallback 定位。
+      // 折中：id 挂到外层包裹 span（不可聚焦，label 点击不会聚焦/触发它），两种诉求同时满足
+      const { id: fieldId, ...uploadFieldProps } = fieldProps || {};
       return (
-        <Upload.Dragger
-          ref={ref}
-          name="files"
-          action={action}
-          accept={accept}
-          fileList={value}
-          {...uploadFieldProps}
-          onChange={(info) => {
-            onChange?.(info);
-            if (uploadFieldProps?.onChange) {
-              uploadFieldProps?.onChange(info);
-            }
-          }}
-          style={{
-            flexDirection: 'column',
-            alignItems: 'center',
-            ...uploadFieldProps?.style,
-            display: !showUploadButton
-              ? 'none'
-              : uploadFieldProps?.style?.display || 'flex',
-          }}
-        >
-          <p className={`${baseClassName}-drag-icon`}>{icon}</p>
-          <p className={`${baseClassName}-text`}>{title}</p>
-          <p className={`${baseClassName}-hint`}>{description}</p>
-          {children ? (
-            <div
-              className={`${baseClassName}-extra`}
-              style={{
-                padding: 16,
-              }}
-            >
-              {children}
-            </div>
-          ) : null}
-        </Upload.Dragger>
+        <span id={fieldId}>
+          <Upload.Dragger
+            ref={ref}
+            name="files"
+            action={action}
+            accept={accept}
+            fileList={value}
+            {...uploadFieldProps}
+            onChange={(info) => {
+              onChange?.(info);
+              if (uploadFieldProps?.onChange) {
+                uploadFieldProps?.onChange(info);
+              }
+            }}
+            style={{
+              flexDirection: 'column',
+              alignItems: 'center',
+              ...uploadFieldProps?.style,
+              display: !showUploadButton
+                ? 'none'
+                : uploadFieldProps?.style?.display || 'flex',
+            }}
+          >
+            <p className={`${baseClassName}-drag-icon`}>{icon}</p>
+            <p className={`${baseClassName}-text`}>{title}</p>
+            <p className={`${baseClassName}-hint`}>{description}</p>
+            {children ? (
+              <div
+                className={`${baseClassName}-extra`}
+                style={{
+                  padding: 16,
+                }}
+              >
+                {children}
+              </div>
+            ) : null}
+          </Upload.Dragger>
+        </span>
       );
     },
   );
```

**File**: `tests/form/uploadFieldId.test.tsx` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { render } from '@testing-library/react';
+import React from 'react';
+import { describe, expect, it } from 'vitest';
+import { ProForm, ProFormUploadButton, ProFormUploadDragger } from '../../src';
+
+// #8992: scrollToFirstError 的 getElementById fallback 需要 id 存在于 DOM；
+// #9298: id 不能落到 Upload 内部 input（label 点击会打开文件选择器）。
+// 方案：id 挂外层包裹 span。
+describe('#8992 field id on wrapper span', () => {
+  it('ProFormUploadDragger keeps field id in DOM on wrapper', () => {
+    const { container } = render(
+      <ProForm submitter={false}>
+        <ProFormUploadDragger name="files" label="Upload" />
+      </ProForm>,
+    );
+    const el = container.querySelector('[id$="_files"]');
+    expect(el).toBeTruthy();
+    // id 不能在 file input 上（#9298）
+    const fileInput = container.querySelector(
+      'input[type="file"]',
+    ) as HTMLInputElement;
+    console.log(
+      'dragger fileInput id:',
+      fileInput?.id,
+      'tag:',
+      fileInput?.tagName,
+    );
+    expect(fileInput?.id || '').not.toMatch(/_files$/);
+  });
+
+  it('ProFormUploadButton keeps field id in DOM on wrapper', () => {
+    const { container } = render(
+      <ProForm submitter={false}>
+        <ProFormUploadButton name="avatar" label="Avatar" />
+      </ProForm>,
+    );
+    const el = container.querySelector('[id$="_avatar"]');
+    expect(el).toBeTruthy();
+    const fileInput = container.querySelector(
+      'input[type="file"]',
+    ) as HTMLInputElement;
+    console.log(
+      'button fileInput id:',
+      fileInput?.id,
+      'tag:',
+      fileInput?.tagName,
+    );
+    expect(fileInput?.id || '').not.toMatch(/_avatar$/);
+  });
+});
```

---

### Incident Patch 3: `a36b2dae` (2026-09-28)
**Commit Message**: fix(form): defer onOpenChange until form mounted in ModalForm/DrawerForm (#8920)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/form/layouts/DrawerForm/index.tsx` (modified, +3/-0)
```diff
@@ -131,6 +131,7 @@ function DrawerForm<T = Record<string, any>, U = Record<string, any>>({
     contentRender,
     onFinishHandle,
     resetFields,
+    onFormMount,
   } = useOverlayForm<T>({
     propsOpen,
     onOpenChange,
@@ -248,6 +249,8 @@ function DrawerForm<T = Record<string, any>, U = Record<string, any>>({
             }
             rest?.onInit?.(_, form);
             formRef.current = form;
+            // #8920 通知 useOverlayForm form 已挂载，flush 缓冲的 onOpenChange
+            onFormMount();
           }}
           submitter={submitterConfig}
           onFinish={async (values) => {
```

**File**: `src/form/layouts/ModalForm/index.tsx` (modified, +3/-0)
```diff
@@ -79,6 +79,7 @@ function ModalForm<T = Record<string, any>, U = Record<string, any>>({
     contentRender,
     onFinishHandle,
     resetFields,
+    onFormMount,
   } = useOverlayForm<T>({
     propsOpen,
     onOpenChange,
@@ -145,6 +146,8 @@ function ModalForm<T = Record<string, any>, U = Record<string, any>>({
             }
             rest?.onInit?.(_, form);
             formRef.current = form;
+            // #8920 通知 useOverlayForm form 已挂载，flush 缓冲的 onOpenChange
+            onFormMount();
           }}
           submitter={submitterConfig}
           onFinish={async (values) => {
```

**File**: `src/form/layouts/_shared/useOverlayForm.tsx` (modified, +29/-0)
```diff
@@ -57,6 +57,8 @@ export type UseOverlayFormResult<T> = {
   onFinishHandle: (values: T) => Promise<any>;
   /** 关闭时重置表单，仅在 destroyOnHidden=true 时有效 */
   resetFields: () => void;
+  /** form 实例挂载完成回调（传给 BaseForm onInit 中调用），用于缓冲首次 onOpenChange */
+  onFormMount: () => void;
 };
 
 /**
@@ -88,10 +90,36 @@ export function useOverlayForm<T = Record<string, any>>({
 
   const [open, setOpenInner] = useControlledState<boolean>(false, propsOpen);
 
+  /**
+   * form 实例是否已挂载（BaseForm onInit 后置 true）。
+   * Modal/Drawer 懒渲染下，首次打开时 onOpenChange(true) 会在 children
+   * 挂载前触发，此时用户在回调里 setFieldsValue 会静默失败（#8920）。
+   */
+  const formMountedRef = useRef(false);
+
+  /** form 挂载前缓冲的 open 事件，挂载后 flush */
+  const pendingOpenRef = useRef<boolean | null>(null);
+
   const onOpenChangeCallback = useRefFunction((nextOpen: boolean) => {
+    if (!formMountedRef.current) {
+      // form 未挂载：缓冲事件，等 onFormMount 后再通知，
+      // 保证用户回调里 formRef.current 一定可用
+      pendingOpenRef.current = nextOpen;
+      return;
+    }
     onOpenChange?.(nextOpen);
   });
 
+  /** form 挂载完成（由 ModalForm/DrawerForm 的 BaseForm onInit 调用） */
+  const onFormMount = useRefFunction(() => {
+    formMountedRef.current = true;
+    const pending = pendingOpenRef.current;
+    pendingOpenRef.current = null;
+    if (pending !== null) {
+      onOpenChange?.(pending);
+    }
+  });
+
   /**
    * 包一层 queueMicrotask，防止在渲染阶段同步触发外部 setState，
    * 避免 React "Cannot update a component while rendering a different component" 警告
@@ -236,5 +264,6 @@ export function useOverlayForm<T = Record<string, any>>({
     contentRender,
     onFinishHandle,
     resetFields,
+    onFormMount,
   };
 }
```

**File**: `tests/form/overlayFormOpenChange.test.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { act, fireEvent, render } from '@testing-library/react';
+import { Button } from 'antd';
+import React, { useRef } from 'react';
+import { describe, expect, it } from 'vitest';
+import { DrawerForm, ProFormText } from '../../src';
+
+// #8920: DrawerForm onOpenChange 中 setFieldsValue 首次不生效
+describe('#8920 DrawerForm setFieldsValue in onOpenChange', () => {
+  it('applies setFieldsValue on first open', async () => {
+    const Demo = () => {
+      const formRef = useRef<any>();
+      return (
+        <DrawerForm
+          formRef={formRef}
+          onOpenChange={(open) => {
+            if (open) {
+              formRef.current?.setFieldsValue({ name: 'from-open-change' });
+            }
+          }}
+          trigger={<Button id="open-btn">open</Button>}
+        >
+          <ProFormText name="name" label="Name" />
+        </DrawerForm>
+      );
+    };
+    const { container } = render(<Demo />);
+
+    // 首次打开
+    await act(async () => {
+      fireEvent.click(container.querySelector('#open-btn')!);
+    });
+    await act(async () => {
+      await new Promise((r) => setTimeout(r, 100));
+    });
+
+    // Drawer 渲染在 portal，input id 带 form name 前缀（#9144）
+    const input = document.querySelector(
+      'input[id$="_name"]',
+    ) as HTMLInputElement;
+    expect(input?.value).toBe('from-open-change');
+  });
+});
```

---

### Incident Patch 4: `a26aca69` (2026-09-28)
**Commit Message**: fix(form): keep ProFormList containerClassName in readonly mode (#8979)

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/form/components/List/ListContainer.tsx` (modified, +7/-1)
```diff
@@ -170,7 +170,13 @@ const ProFormListContainer: React.FC<ProFormListItemProps> = (props) => {
   }, [children, props, uuidFields, wrapperAction]);
 
   if (readOnlyContext.mode === 'read' || props.readonly === true) {
-    return <>{itemList}</>;
+    // readonly 下仍保留容器 div，containerClassName / containerStyle 不丢失（#8979）。
+    // creator 按钮与 fieldExtraRender 属于编辑态交互，readonly 不渲染。
+    return (
+      <div style={defaultStyle} className={containerClassName}>
+        {itemList}
+      </div>
+    );
   }
 
   return (
```

**File**: `tests/form/formList.test.tsx` (modified, +20/-0)
```diff
@@ -121,6 +121,26 @@ describe('ProForm List', () => {
     ).toBeFalsy();
   });
 
+  // #8979 readonly 模式下 containerClassName 不应丢失
+  it('⛲ ProForm.List keeps containerClassName in readonly mode', async () => {
+    const html = render(
+      <ProForm readonly submitter={false}>
+        <ProFormList
+          name="users"
+          label="用户信息"
+          containerClassName="readonly-container-cls"
+          initialValue={[{ name: '1111' }]}
+        >
+          <ProFormText name="name" label="姓名" />
+        </ProFormList>
+      </ProForm>,
+    );
+
+    expect(
+      html.baseElement.querySelector('.readonly-container-cls'),
+    ).toBeTruthy();
+  });
+
   it('⛲ ProForm.List for deps ProFormDependency', async () => {
     const html = render(
       <StepsForm<{
```

---

### Incident Patch 5: `ffb4026d` (2026-09-28)
**Commit Message**: fix: resolve P3 batch issues (#9023 #9001 #9024) and document search form rules

- fix(field): Cascader read mode resolves labels by hierarchy path so
  duplicate values across levels no longer override each other (#9023)
- fix(field): Cascader readonly mode now respects fieldProps.displayRender
  for custom rendering (#9001)
- docs(table): document form.ignoreRules for enabling search form
  validation, cross-linked from form and formItemProps rows (#9024)

Co-Authored-By: Cursor <noreply@cursor.com>

**File**: `site/components/table.en-US.md` (modified, +16/-2)
```diff
@@ -94,7 +94,7 @@ ProTable puts a layer of wrapping on top of antd's Table, supports some presets,
 | beforeSearchSubmit | Make some changes before searching                                                                                                          | `(params: Partial<U>) => any`                                                                                                                                                                                                       | -                                                                   |
 | onSizeChange       | The table size has changed                                                                                                                  | `(size: DensitySize) => void`                                                                                                                                                                                                       | -                                                                   |
 | type               | pro-table type                                                                                                                              | `ProSchemaComponentTypes`                                                                                                                                                                                                           | -                                                                   |
-| form               | type="form" and Form configuration of search form                                                                                           | `Omit<ProFormProps & QueryFilterProps, 'form'>`                                                                                                                                                                                     | -                                                                   |
+| form               | type="form" and Form configuration of search form. Set `ignoreRules: false` to enable search form validation, [see details](#rules-validation-in-the-search-form)           | `Omit<ProFormProps & QueryFilterProps, 'form'>`                                                                                                                                                                                     | -                                                                   |
 | onSubmit           | Triggered when the form is submitted                                                                                                        | `(params: U) => void`                                                                                                                                                                                                               | -                                                                   |
 | onReset            | Triggered when the form is reset                                                                                                            | `() => void`                                                                                                                                                                                                                        | -                                                                   |
 | columnEmptyText    | Display when it is empty, display `-` when it is not set, false can turn off this function                                                  | `ProFieldEmptyText`                                                                                                                                                                                                                 | `-`                                                                 |
@@ -155,6 +155,20 @@ ProTable puts a layer of wrapping on top of antd's Table, supports some presets,
 
 `optionRender: false` only hides the
```

**File**: `site/components/table.md` (modified, +16/-2)
```diff
@@ -81,7 +81,7 @@ ProTable 在 antd 的 Table 上进行了一层封装，支持了一些预设，
 | debounceTime       | 防抖时间                                                                                           | `number`                                                                                                                                                                                                                 | 20                                                                  | -    |
 | editable           | 可编辑表格的相关配置，支持 `type="multiple"` 等。[配置详情](/components/editable-table)            | `RowEditableConfig<T>`                                                                                                                                                                                                   | -                                                                   | -    |
 | ErrorBoundary      | 自带了错误处理功能，防止白屏，`ErrorBoundary=false` 关闭默认错误边界                               | `React.ComponentClass<any, any> \| false`                                                                                                                                                                                | 内置 ErrorBoundary                                                  | -    |
-| form               | type="form" 和搜索表单的 Form 配置                                                                 | `Omit<ProFormProps & QueryFilterProps, 'form'>`                                                                                                                                                                           | -                                                                   | -    |
+| form               | type="form" 和搜索表单的 Form 配置，`ignoreRules: false` 可开启查询表单校验，[详见此处](#搜索表单的-rules-校验) | `Omit<ProFormProps & QueryFilterProps, 'form'>`                                                                                                                                                                           | -                                                                   | -    |
 | formRef            | 可以获取到查询表单的 form 实例，用于一些灵活的配置                                                 | `TableFormItem<T>['formRef']`                                                                                                                                                                                            | -                                                                   | -    |
 | ghost              | 幽灵模式，即是否取消表格区域的 padding                                                             | `boolean`                                                                                                                                                                                                                | false                                                               | -    |
 | headerTitle        | 左上角的 title                                                                                     | `ReactNode`                                                                                                                                                                                                              | -                                                                   | -    |
@@ -160,6 +160,20 @@ ProTable 在 antd 的 Table 上进行了一层封装，支持了一些预设，
 
 `optionRender: false` 只会隐藏操作按钮。如需在输入或选择后自动查询，可在 `form.onValuesChange` 中调用 `formRef.current?.submit()`；请使用 ProTable 的 `debounceTime` 配置请求防抖。
 
+#### 搜索表单的 rules 校验
+
+查询表单为了不阻塞搜索，默认忽略列配置 `formItemProps.rules` 中的校验规则（ProTable 会为查询表单自动注入 `ignoreRules: true`）。如果希望查询表单也执行校验，需要显式开启：
+
+```tsx | pure
+<ProTable
+  columns={columns}
+  // 开启查询表单校验
+  form={{ ignoreRules: false }}
+/>
+```
+
+开启后列上的 `formItemProps.rules`（如 `required`）会在提交查询时生效；校验不通过将阻止搜索请求。可编辑表格（`editable`）中的行内校验不受此配置影响。
+
 #### ColConfig
 
 ```tsx | pure
@@ -270,7 +284,7 @@ ref.current?.cancelEditable(rowKey);
 | valueType                              
```

**File**: `src/field/components/Cascader/FieldCascaderRead.tsx` (modified, +116/-14)
```diff
@@ -1,24 +1,126 @@
-﻿import { objectToMap, proFieldParsingText } from '../../../utils';
+﻿import type { CascaderProps } from 'antd';
+import { Space } from 'antd';
+import React from 'react';
+import { objectToMap, proFieldParsingText } from '../../../utils';
 import type { ProFieldFC } from '../../types';
 import type { GroupProps } from './types';
 
+type OptionsValueEnum = Map<any, any> | undefined;
+
+/**
+ * #9023 按层级路径取每层的完整 option 对象，
+ * 避免不同层级 value 重复时扁平 Map 相互覆盖
+ */
+function getOptionsByPath(
+  text: unknown[],
+  options: CascaderProps['options'],
+  fieldNames: { value: string; children: string },
+): Record<string, any>[] {
+  const matchedOptions: Record<string, any>[] = [];
+  let currentLevel: CascaderProps['options'] = options;
+
+  for (const value of text) {
+    if (!Array.isArray(currentLevel)) break;
+    const matched = currentLevel.find(
+      (option) => (option as any)?.[fieldNames.value] === value,
+    );
+    if (!matched) break;
+    matchedOptions.push(matched as Record<string, any>);
+    currentLevel = (matched as any)[fieldNames.children];
+  }
+  return matchedOptions;
+}
+
 export function FieldCascaderRead(
-  props: Parameters<ProFieldFC<GroupProps>>[0] & {
-    optionsValueEnum: Map<any, any> | undefined;
+  props: Omit<Parameters<ProFieldFC<GroupProps>>[0], 'options'> & {
+    optionsValueEnum: OptionsValueEnum;
+    /** #9023/#9001 request 拉取的级联选项（read 模式按路径解析的兜底数据源） */
+    fetchOptions?: CascaderProps['options'] | any[];
   },
 ) {
-  const { mode, render, optionsValueEnum, ...rest } = props;
-  const dom = (
-    <>
-      {proFieldParsingText(
-        rest.text,
-        objectToMap(rest.valueEnum || optionsValueEnum),
-      )}
-    </>
-  );
+  const { mode, render, optionsValueEnum, fetchOptions, ...rest } = props;
+
+  // options 优先级：静态 fieldProps.options > request 拉取的 fetchOptions
+  const options = (rest.fieldProps?.options ??
+    fetchOptions) as CascaderProps['options'];
+
+  const fieldNames = {
+    value: 'value',
+    label: 'label',
+    children: 'children',
+    ...(rest.fieldProps?.fieldNames as any),
+  };
+  // 兼容 fieldNames.options 作为 children 键名（与 antd Cascader 历史行为一致）
+  const resolvedFieldNames = {
+    ...fieldNames,
+    children: fieldNames.children ?? (fieldNames as any).options,
+  };
+
+  const valueEnum = objectToMap(rest.valueEnum || optionsValueEnum);
+
+  const renderPath = (path: unknown[]): React.ReactNode => {
+    // #9023 按层级路径取每层的 option（不受跨层同 value 覆盖影响）
+    const pathOptions = getOptionsByPath(path, options, resolvedFieldNames);
+    if (pathOptions.length === 0) return null;
+
+    // #9001 readonly 支持 displayRender 自定义展示
+    if (typeof rest.fieldProps?.displayRender === 'function') {
+      const labels = pathOptions.map(
+        (option) => option[fieldNames.label] ?? option[fieldNames.value],
+      );
+      return rest.fieldProps.displayRender(labels, path);
+    }
+
+    return pathOptions.map((option, index) => (
+      <React.Fragment key={index}>
+        {index > 0 && ','}
+        {/*
+         * #9023/#9001 渲染策略：
+         * - 用户显式传入 valueEnum（含 status/Badge 需求）→ 逐层 value 走
+         *   proFieldParsingText，保留状态徽标语义
+         * - 仅 options（valueEnum 是 options 扁平化而来、无 status）→ 直接按
+         *   路径解析的 label 文本展示，跨层同 value 不再相互覆盖
+         */}
+        {rest.valueEnum
+          ? proFieldParsingText(option[fieldNames.value], valueEnum)
+          : (option[fieldNames.label] ?? option[fieldNames.value])}
+      </React.Fragment>
+    ));
+  };
+
+  let dom: React.ReactNode;
+
+  if (rest.fieldProps?.multiple && Array.isArray(rest.text)) {
+    // 多选：每个选中项是路径数组
+    const paths = rest.text as unknown as unknown[][];
+    const hasPathOptions = Array.isArray(options) && options.length > 0;
+    dom = hasPathOptions ? (
+      <Space size={2} wrap separator="，">
+        {paths.map((path, index) => (
+          <span key={index}>{renderPath(path)}</span>
+        ))}
+      </Space>
+    ) : (
+      // 无 options 时保持原有 valueEn
```

**File**: `src/field/components/Cascader/index.tsx` (modified, +2/-0)
```diff
@@ -85,6 +85,8 @@ const FieldCascader: ProFieldFC<GroupProps> = (
         variant={variant}
         optionsValueEnum={optionsValueEnum}
         {...rest}
+        // 放在 rest 之后：fetch 拉取的 options 作为兜底（fieldProps.options 优先级在组件内部处理）
+        fetchOptions={options}
       />
     );
   }
```

**File**: `tests/field/cascaderRead.test.tsx` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+import { render } from '@testing-library/react';
+import React from 'react';
+import { describe, expect, it } from 'vitest';
+import { ProForm, ProFormCascader } from '../../src';
+
+const options = [
+  {
+    value: 'zhejiang',
+    label: 'Zhejiang',
+    children: [
+      {
+        value: 'hangzhou',
+        label: 'Hangzhou',
+        children: [
+          // #9023 不同层级 value 重复：zhejiang 出现在第一层与第三层
+          { value: 'zhejiang', label: 'West Lake' },
+        ],
+      },
+    ],
+  },
+  {
+    value: 'jiangsu',
+    label: 'Jiangsu',
+    children: [{ value: 'nanjing', label: 'Nanjing' }],
+  },
+];
+
+const renderInForm = (props: Record<string, unknown>) => {
+  const { container } = render(
+    <ProForm submitter={false}>
+      <ProFormCascader name="area" label="区域" {...(props as any)} />
+    </ProForm>,
+  );
+  return container.querySelector('.ant-form-item');
+};
+
+describe('#9023 Cascader 只读跨层级 value 重复', () => {
+  it('按路径解析 label，不被同 value 的其他层级覆盖', () => {
+    const formItem = renderInForm({
+      initialValue: ['zhejiang', 'hangzhou', 'zhejiang'],
+      fieldProps: { options },
+      readonly: true,
+    });
+    // 路径解析：Zhejiang,Hangzhou,West Lake（而非 Zhejiang,Hangzhou,Zhejiang）
+    expect(formItem?.textContent).toContain('West Lake');
+    expect(formItem?.textContent).toContain('Zhejiang,Hangzhou');
+  });
+
+  it('多选模式逐路径解析', () => {
+    const formItem = renderInForm({
+      initialValue: [
+        ['zhejiang', 'hangzhou', 'zhejiang'],
+        ['jiangsu', 'nanjing'],
+      ],
+      fieldProps: { options, multiple: true },
+      readonly: true,
+    });
+    expect(formItem?.textContent).toContain('West Lake');
+    expect(formItem?.textContent).toContain('Nanjing');
+  });
+});
+
+describe('#9001 Cascader readonly 支持 displayRender', () => {
+  it('readonly 模式应用 displayRender 自定义展示', () => {
+    const formItem = renderInForm({
+      initialValue: ['zhejiang', 'hangzhou'],
+      fieldProps: {
+        options,
+        displayRender: (labels: string[]) => labels.join('-'),
+      },
+      readonly: true,
+    });
+    expect(formItem?.textContent).toContain('Zhejiang-Hangzhou');
+  });
+});
```

---

### Incident Patch 6: `2fefd0f0` (2026-09-27)
**Commit Message**: fix: resolve P2 batch issues (#9088 #9167 #9082)

- fix(form): export FormSchema and related SchemaForm type definitions
  for secondary wrapping (#9088)
- fix(form): ProForm.Group and SchemaForm group column now support
  className prop, merged onto group root node (#9167)
- fix(table): ProTable onScroll now fires when scroll.y is not set;
  rc-table only invokes onScroll in fixHeader branch, ProTable attaches
  a capture-phase listener on a display:contents wrapper for horizontal
  scrolling (#9082)

Co-Authored-By: Cursor <noreply@cursor.com>

**File**: `src/form/components/FormItem/Group/index.tsx` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@ const Group: React.FC<ProFormGroupProps> = React.forwardRef(
       collapsible,
       defaultCollapsed,
       style,
+      className: propsClassName,
       labelLayout,
       title = props.label,
       tooltip,
@@ -157,7 +158,7 @@ const Group: React.FC<ProFormGroupProps> = React.forwardRef(
     return wrapSSR(
       <ColWrapper>
         <div
-          className={clsx(className, hashId, {
+          className={clsx(className, propsClassName, hashId, {
             [`${className}-twoLine`]: labelLayout === 'twoLine',
           })}
           style={style}
```

**File**: `src/form/components/SchemaForm/valueType/group.tsx` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ export const group: ProSchemaRenderValueTypeFunction = (item, { genItems }) => {
       <ProFormGroup
         key={item.key}
         label={item.label}
+        className={item.className}
         colProps={item.colProps}
         rowProps={item.rowProps}
         {...item.getFieldProps?.()}
```

**File**: `src/form/components/index.ts` (modified, +12/-1)
```diff
@@ -51,7 +51,18 @@ export { default as ProFormRadio } from './Radio';
 export type { ProFormRadioGroupProps } from './Radio';
 export { default as ProFormRate } from './Rate';
 export { default as BetaSchemaForm } from './SchemaForm';
-export type { ProFormColumnsType, ProFormLayoutType } from './SchemaForm';
+// #9088 导出完整类型定义，支持二次封装时继承
+export type {
+  ProFormColumnsType,
+  ProFormLayoutType,
+  FormSchema,
+  ProFormPropsType,
+  ProSchemaRenderValueTypeFunction,
+  ProFormRenderValueTypeHelpers,
+  ProFormRenderValueTypeItem,
+  ItemType,
+  ExtraProColumnType,
+} from './SchemaForm';
 export { default as ProFormSegmented } from './Segmented';
 export { default as ProFormSelect } from './Select';
 export type { ProFormSelectProps } from './Select';
```

**File**: `src/table/Table.tsx` (modified, +24/-1)
```diff
@@ -328,6 +328,7 @@ const ProTable = <
     tooltip,
     revalidateOnFocus = false,
     searchFormRender,
+    onScroll,
     ...rest
   } = props;
   const { wrapSSR, hashId } = useStyle(props.defaultClassName);
@@ -987,6 +988,14 @@ const ProTable = <
 
   const notNeedCardDom = search === false && hideToolbar;
 
+  /**
+   * #9082 rc-table 仅在 fixHeader（设置了 scroll.y）分支调用用户 onScroll，
+   * 无 scroll.y 时唯一表格容器的原生滚动事件不会透传。
+   * 这里在外层用捕获相监听（scroll 不冒泡但可捕获），仅对水平滚动生效，
+   * 避免与 rc-table 内部的 onBodyScroll 重复触发。
+   */
+  const needsScrollCapture = Boolean(onScroll) && !props.scroll?.y;
+
   const getBaseTableDom = () => (
     <GridContext.Provider
       value={{
@@ -995,7 +1004,21 @@ const ProTable = <
         rowProps: undefined,
       }}
     >
-      <Table<T> {...mergedTableProps} rowKey={rowKey} ref={antTableRef} />
+      {needsScrollCapture ? (
+        <div
+          style={{ display: 'contents' }}
+          onScrollCapture={(e) => {
+            // 只转发水平滚动（rc-table 内部已处理纵向场景）
+            if ((e.target as HTMLElement).scrollWidth > (e.target as HTMLElement).clientWidth) {
+              onScroll?.(e as unknown as React.UIEvent<HTMLDivElement>);
+            }
+          }}
+        >
+          <Table<T> {...mergedTableProps} rowKey={rowKey} ref={antTableRef} />
+        </div>
+      ) : (
+        <Table<T> {...mergedTableProps} rowKey={rowKey} ref={antTableRef} />
+      )}
     </GridContext.Provider>
   );
 
```

**File**: `src/table/typing.ts` (modified, +5/-0)
```diff
@@ -466,6 +466,11 @@ export type ProTableProps<DataSource, U, ValueType = 'text'> = {
    * 错误边界自定义
    */
   ErrorBoundary?: React.ComponentClass<any, any> | false;
+  /**
+   * 表格滚动时触发。rc-table 原生仅在设置 scroll.y 时回调；
+   * 未设置 scroll.y 时 ProTable 通过捕获相补挂（仅水平方向生效）
+   */
+  onScroll?: React.UIEventHandler<HTMLDivElement>;
 } & Omit<TableProps<DataSource>, 'columns' | 'rowSelection'>;
 
 export type ActionType = ProCoreActionType & {
```

---

### Incident Patch 7: `deba59b0` (2026-09-27)
**Commit Message**: fix: resolve P1 batch issues (#9240 #9138 #9101 #9083 #9062 #9131 #9106 #9079 #9616 #9185)

- fix(form): UploadDragger extra moved to native additionalDom to avoid
  overlapping with upload progress bar (#9240)
- fix(form): StepsForm with shared Form.useForm() instance no longer
  blocked by hidden steps' required rules via skipFieldRules (#9101)
- fix(form): ProFormList colProps now works under grid mode by applying
  flex container styles to ListContainer/ListItem (#9083)
- fix(field): light filter date/time/range pickers render in popover via
  popoverOpen propagation from LightWrapper (#9062)
- fix(form): QueryFilter span breakpoints aligned with antd grid tokens
  and XXL config retained beyond xxl width (#9131)
- fix(table): custom searchFormRender no longer forces manual fetch,
  auto submit works (#9106)
- fix(table): LightFilter configs ignore rules designed for editable
  rows to avoid blocking search submit (#9079)
- fix(table): dev warning for tree data combined with expandedRowRender
  which renders empty tr/td (#9616)
- fix(form): import Group/ProFormItem from concrete files to break
  ProForm -> components -> SchemaForm circular dependency (#9185)

Co-Authored-By: Cu

**File**: `src/field/components/DatePicker/FieldDatePickerLightEdit.tsx` (modified, +3/-2)
```diff
@@ -36,6 +36,7 @@ export function FieldDatePickerLightEdit(
     fieldProps,
     picker,
     lightLabel,
+    popoverOpen,
     variant,
     open,
     setOpen,
@@ -64,7 +65,7 @@ export function FieldDatePickerLightEdit(
       }
       disabled={disabled}
       value={
-        dayValue || open ? (
+        dayValue || open || popoverOpen ? (
           <DatePicker
             picker={picker}
             showTime={showTime}
@@ -82,7 +83,7 @@ export function FieldDatePickerLightEdit(
         ) : undefined
       }
       allowClear={false}
-      downIcon={dayValue || open ? false : undefined}
+      downIcon={dayValue || open || popoverOpen ? false : undefined}
       variant={variant}
       ref={lightLabel}
     />
```

**File**: `src/field/components/DatePicker/index.tsx` (modified, +2/-0)
```diff
@@ -37,6 +37,7 @@ const FieldDatePicker: ProFieldFC<
     fieldProps,
     picker,
     lightLabel,
+    popoverOpen,
     variant,
   },
   ref,
@@ -82,6 +83,7 @@ const FieldDatePicker: ProFieldFC<
         {
           ...editProps,
           lightLabel,
+          popoverOpen,
           open,
           setOpen,
         },
```

**File**: `src/field/components/RangePicker/FieldRangePickerLightEdit.tsx` (modified, +3/-2)
```diff
@@ -35,6 +35,7 @@ export function FieldRangePickerLightEdit(
     formItemRender,
     showTime,
     lightLabel,
+    popoverOpen,
     variant: propsVariant,
     fieldProps,
     open,
@@ -70,7 +71,7 @@ export function FieldRangePickerLightEdit(
       }
       disabled={fieldProps.disabled}
       value={
-        dayValue || open ? (
+        dayValue || open || popoverOpen ? (
           <DatePicker.RangePicker
             picker={picker}
             showTime={showTime}
@@ -96,7 +97,7 @@ export function FieldRangePickerLightEdit(
       variant={propsVariant}
       allowClear={false}
       ref={lightLabel}
-      downIcon={dayValue || open ? false : undefined}
+      downIcon={dayValue || open || popoverOpen ? false : undefined}
     />
   );
 
```

**File**: `src/field/components/RangePicker/index.tsx` (modified, +2/-0)
```diff
@@ -33,6 +33,7 @@ const FieldRangePicker: ProFieldFC<
     formItemRender,
     showTime,
     lightLabel,
+    popoverOpen,
     variant: propsVariant,
     fieldProps,
   },
@@ -91,6 +92,7 @@ const FieldRangePicker: ProFieldFC<
         {
           ...editProps,
           lightLabel,
+          popoverOpen,
           open,
           setOpen,
         },
```

**File**: `src/field/components/TimePicker/FieldTimePickerLightEdit.tsx` (modified, +3/-2)
```diff
@@ -33,6 +33,7 @@ export function FieldTimePickerLightEdit(
     formItemRender,
     fieldProps,
     lightLabel,
+    popoverOpen,
     variant,
     finalFormat,
     open,
@@ -62,7 +63,7 @@ export function FieldTimePickerLightEdit(
       disabled={disabled}
       variant={variant ?? fieldProps?.variant}
       value={
-        dayValue || open ? (
+        dayValue || open || popoverOpen ? (
           <TimePicker
             format={format}
             ref={ref as React.Ref<any>}
@@ -81,7 +82,7 @@ export function FieldTimePickerLightEdit(
           />
         ) : null
       }
-      downIcon={dayValue || open ? false : undefined}
+      downIcon={dayValue || open || popoverOpen ? false : undefined}
       allowClear={false}
       ref={lightLabel}
     />
```

---

### Incident Patch 8: `6fd24805` (2026-09-27)
**Commit Message**: fix(form): replace _internalItemRender with public Form.Item APIs to stop validation height jitter

The private _internalItemRender hook skips antd 6 additionalDom entirely,
dropping error messages and the minHeight placeholder that keeps form item
height stable when validation appears/disappears (#9709/#8942/#9066).

- Render addonBefore/addonAfter inside standard Form.Item children via a
  forwardRef shell that forwards injected control props (value/onChange/id/ref)
- Drive function-style help and popover errorType through Form.Item.useStatus()
- Keep help="" so the native explain stays empty while custom content renders

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/form/components/FormItem/index.tsx` (modified, +136/-116)
```diff
@@ -157,6 +157,12 @@ const WithValueFomFiledProps = React.forwardRef<
 });
 WithValueFomFiledProps.displayName = 'WithValueFomFiledProps';
 
+/** 函数式 help：接收字段校验消息，返回自定义的帮助内容 */
+export type ProFormItemHelpFunction = (params: {
+  errors: React.ReactNode[];
+  warnings: React.ReactNode[];
+}) => React.ReactNode;
+
 type WarpFormItemProps = {
   /** @name 前置的dom * */
   addonBefore?: React.ReactNode;
@@ -180,14 +186,111 @@ type WarpFormItemProps = {
    * @example  string => object   convertValue: (value,namePath)=> { return {value,label:value} }
    */
   convertValue?: SearchConvertKeyFn;
-  help?:
-    | React.ReactNode
-    | ((params: {
-        errors: React.ReactNode[];
-        warnings: React.ReactNode[];
-      }) => React.ReactNode);
+  help?: React.ReactNode | ProFormItemHelpFunction;
 };
 
+/**
+ * 读取 Form.Item 校验消息的桥接组件。
+ *
+ * antd 6 会把 { status, errors, warnings } 通过 FormItemInputContext 注入到
+ * Form.Item 的 children 树中（`Form.Item.useStatus` 的数据源），
+ * 函数式 help 借助这个公开 API 拿到校验消息，
+ * 替代旧版 `_internalItemRender` 私有渲染（#9709/#8942/#9066）：
+ * 私有渲染会整体跳过 additionalDom（错误提示 + extra + minHeight 占位），
+ * 导致校验时高度抖动、错误信息丢失。
+ */
+const FieldHelpMessages: React.FC<{
+  help: ProFormItemHelpFunction;
+}> = ({ help }) => {
+  const { errors = [], warnings = [] } = Form.Item.useStatus();
+  // help="" 使原生 explain 只渲染空内容（高度 0），错误显示由此处接管，
+  // additionalDom 常驻保证校验出现/消失时高度稳定（#9709/#8942）
+  return <div>{help({ errors, warnings })}</div>;
+};
+
+interface FormItemChildrenShellProps {
+  addonBefore?: React.ReactNode;
+  addonAfter?: React.ReactNode;
+  addonWarpStyle?: React.CSSProperties;
+  help?: ProFormItemHelpFunction;
+  children?: React.ReactNode;
+}
+
+/**
+ * Form.Item 的 children 壳层：
+ * 1. addonBefore/addonAfter 与控件一起进入 Form.Item 标准 children 插槽，
+ *    错误提示 / extra / minHeight 占位由 antd 原生 additionalDom 管理，
+ *    校验出现与消失时高度稳定（#9709/#8942）；
+ * 2. Form.Item 通过 cloneElement 注入的控制属性（value/onChange/id/ref 等）
+ *    由这里透传给内部真正的字段组件。
+ */
+const FormItemChildrenShell = React.forwardRef<
+  any,
+  FormItemChildrenShellProps & Record<string, any>
+>(
+  (
+    { addonBefore, addonAfter, addonWarpStyle, help: helpFn, children, ...controlProps },
+    ref,
+  ) => {
+    // 只有子组件支持 ref 时才注入（与 antd Form.Item 的 supportRef 判断一致），
+    // 避免给普通函数组件传 ref 触发警告
+    const mergedRef =
+      ref && supportRef(children as React.ReactElement) ? ref : undefined;
+
+    // 与 antd Form.Item 的 cloneElement 语义保持一致：
+    // 控制属性直接覆盖（包括 value: undefined 的受控清空），
+    // ref 仅在子组件支持时注入
+    const fieldChild = React.isValidElement(children)
+      ? React.cloneElement(children, {
+          ...controlProps,
+          ...(mergedRef ? { ref: mergedRef } : {}),
+        } as any)
+      : children;
+
+    return (
+      <>
+        {addonBefore || addonAfter ? (
+          <div
+            style={{
+              display: 'flex',
+              alignItems: 'center',
+              flexWrap: 'wrap',
+              ...addonWarpStyle,
+            }}
+          >
+            {addonBefore ? (
+              <div style={{ marginInlineEnd: 8 }}>{addonBefore}</div>
+            ) : null}
+            {/*
+             * flex:1 包住「控件 + addonAfter」，保证 Text/Select 可收缩，
+             * 同时单位/按钮紧跟控件，避免 Digit 固定宽度时把 addon 顶到行尾。
+             */}
+            <div
+              style={{
+                flex: 1,
+                minWidth: 0,
+                display: 'flex',
+                alignItems: 'center',
+              }}
+            >
+              {fieldChild}
+              {addonAfter ? (
+                <div style={{ marginInlineStart: 8, flexShrink: 0 }}>
+                  {addonAfter}
+                </div>
+              ) : null}
+            </div>
+          </div>
+        ) : (
+          fieldChild
+        )}
+        {helpFn ? <FieldHelpMessages help={helpFn} /> : null}
+      </>
+    );
+  },
+);
+FormItemChildrenShell.displayName = 'FormItemChildrenShell';
+
 /**
  * 支持了一下前置 dom 和后置的 dom 同时包一个provide
  *
@@ -238,119 +341,36 @@ c
```

**File**: `src/utils/components/InlineErrorFormItem/index.tsx` (modified, +52/-45)
```diff
@@ -26,17 +26,22 @@ const FIX_INLINE_STYLE = {
   marginInlineEnd: 0,
 };
 
+/**
+ * 读取 Form.Item 校验状态并渲染 Popover 错误层。
+ *
+ * antd 6 通过 FormItemInputContext 把 { status, errors, warnings } 注入到
+ * Form.Item 的 children 树（`Form.Item.useStatus` 的数据源），
+ * 这里借助该公开 API 获取校验消息，替代旧版 `_internalItemRender` 私有渲染
+ * （#9709/#8942/#9066/#9153）：私有渲染会整体跳过 additionalDom
+ * （错误提示 + extra + minHeight 占位），导致高度抖动、错误丢失。
+ */
 const InlineErrorFormItemPopover: React.FC<{
-  inputProps: FormItemProps & {
-    errors?: React.ReactNode[];
-    warnings?: React.ReactNode[];
-  };
-  input: React.JSX.Element;
-  errorList: React.JSX.Element;
-  extra: React.JSX.Element;
   popoverProps?: PopoverProps;
-}> = ({ inputProps, input, extra, errorList, popoverProps }) => {
+  input: React.ReactNode;
+}> = ({ popoverProps, input }) => {
+  const { status, errors = [], warnings = [] } = Form.Item.useStatus();
   const [open, setOpen] = useState<boolean | undefined>(false);
+  // 校验中保持上一次的消息，避免 loading 抖动
   const [messages, setMessages] = useState<{
     errors: React.ReactNode[];
     warnings: React.ReactNode[];
@@ -47,21 +52,13 @@ const InlineErrorFormItemPopover: React.FC<{
   const token = theme.useToken();
   const { wrapSSR, hashId } = useStyle(`${prefixCls}-form-item-with-help`);
   useEffect(() => {
-    if (inputProps.validateStatus !== 'validating') {
-      setMessages({
-        errors: inputProps.errors ?? [],
-        warnings: inputProps.warnings ?? [],
-      });
+    if (status !== 'validating') {
+      setMessages({ errors, warnings });
     }
-  }, [inputProps.errors, inputProps.warnings, inputProps.validateStatus]);
+  }, [status, errors, warnings]);
 
-  const loading = inputProps.validateStatus === 'validating';
-  const displayedMessages = loading
-    ? messages
-    : {
-        errors: inputProps.errors ?? [],
-        warnings: inputProps.warnings ?? [],
-      };
+  const loading = status === 'validating';
+  const displayedMessages = loading ? messages : { errors, warnings };
   const hasMessages =
     (displayedMessages.errors?.length ?? 0) +
       (displayedMessages.warnings?.length ?? 0) >=
@@ -93,7 +90,7 @@ const InlineErrorFormItemPopover: React.FC<{
       {/* 不能把 Fragment 作为 Popover 的直接 child：rc-trigger 会向 child 注入
           onKeyDown 等事件，Fragment 无法承接，触发
           "Invalid prop `onKeyDown` supplied to `React.Fragment`"（#9153）。
-          这里以 input 本体作为 trigger，extra 渲染在 Popover 之外。 */}
+          这里以 input 本体作为 trigger。 */}
       <Popover
         key="popover"
         open={!hasMessages ? false : open}
@@ -121,19 +118,44 @@ const InlineErrorFormItemPopover: React.FC<{
               )}
             >
               {loading ? <LoadingOutlined /> : null}
-              {hasMessages ? renderMessageContent() : errorList}
+              {hasMessages ? renderMessageContent() : null}
             </div>
           </div>,
         )}
         {...popoverProps}
       >
         {input}
       </Popover>
-      {extra}
     </>
   );
 };
 
+/**
+ * Form.Item 的 children 壳层：接收 Form.Item cloneElement 注入的控制属性
+ * （value/onChange/id/ref 等）透传给真正的字段组件，
+ * 同时在校验子树内通过 Form.Item.useStatus 读取消息驱动 Popover。
+ * extra 由 Form.Item 原生 additionalDom 渲染，无需在此处理。
+ */
+const InlineErrorPopoverShell = React.forwardRef<
+  any,
+  {
+    popoverProps?: PopoverProps;
+    children?: React.ReactNode;
+  } & Record<string, any>
+>(({ popoverProps, children, ...controlProps }, ref) => {
+  const fieldChild = React.isValidElement(children)
+    ? React.cloneElement(children, {
+        ...controlProps,
+        ...(ref ? { ref } : {}),
+      } as any)
+    : children;
+
+  return (
+    <InlineErrorFormItemPopover popoverProps={popoverProps} input={fieldChild} />
+  );
+});
+InlineErrorPopoverShell.displayName = 'InlineErrorPopoverShell';
+
 const InternalFormItemFunction: React.FC<InternalProps & FormItemProps> = ({
   rules,
   name,
@@ -146,6 +168,9 @@ const InternalFormItemFunction: React.FC<InternalProps & FormItemProps> = ({
       name={n
```

**File**: `tests/form/base.test.tsx` (modified, +13/-6)
```diff
@@ -126,12 +126,14 @@ describe('ProForm', () => {
       </ProForm>,
     );
 
+    // addon 布局位于 Form.Item 标准 children 内（control-input-content 中），
+    // 内层 flex:1/minWidth:0 容器保证控件可收缩（#9211）
     const textLayout = wrapper.container
       .querySelector('input[id$="_text"]')
-      ?.closest('.ant-form-item-control-input')?.parentElement;
+      ?.closest('.ant-form-item-control-input-content > div > div');
     const selectLayout = wrapper.container
       .querySelector('[id$="_select"]')
-      ?.closest('.ant-form-item-control-input')?.parentElement;
+      ?.closest('.ant-form-item-control-input-content > div > div');
 
     expect(textLayout).toHaveStyle({ flex: '1', minWidth: '0' });
     expect(selectLayout).toHaveStyle({ flex: '1', minWidth: '0' });
@@ -145,13 +147,18 @@ describe('ProForm', () => {
     );
 
     // ProForm 默认注入唯一 form name，input id 形如 `${formKey}_${name}`（#9144）
-    const controlInput = wrapper.container
+    const controlContent = wrapper.container
       .querySelector('[id$="_sessionValidTime"]')
-      ?.closest('.ant-form-item-control-input');
+      ?.closest('.ant-form-item-control-input-content > div');
     const addon = wrapper.getByText('秒');
 
-    expect(controlInput?.parentElement).toContainElement(addon);
-    expect(controlInput?.nextElementSibling).toContainElement(addon);
+    // addon 与控件同在一个 flex 容器中，紧邻渲染
+    expect(controlContent).toContainElement(addon);
+    expect(
+      wrapper.container
+        .querySelector('[id$="_sessionValidTime"]')
+        ?.closest('.ant-form-item-control-input-content'),
+    ).toContainElement(addon);
   });
 
   // need jsdom support
```

**File**: `tests/form/validationHeightStability.test.tsx` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import { act, render } from '@testing-library/react';
+import React from 'react';
+import { describe, expect, it } from 'vitest';
+import { ProForm, ProFormText } from '../../src';
+import type { ProFormInstance } from '../../src';
+
+/**
+ * #9709/#8942 表单校验时高度抖动：
+ * 旧方案用 `_internalItemRender` 自定义渲染 addon 布局，会整体跳过 antd 6 的
+ * additionalDom（错误提示 + extra + minHeight:marginBottom 占位容器），
+ * 导致校验出现/消失时高度跳变、错误信息丢失。
+ *
+ * 新方案：addon 布局作为 Form.Item 标准 children 渲染，
+ * 错误提示与高度占位由 antd 原生 additionalDom 管理。
+ */
+
+/** antd ErrorList 内部有 useDebounce，校验后需等一帧再断言 */
+const waitForErrorDebounce = () =>
+  act(async () => {
+    await new Promise((r) => setTimeout(r, 100));
+  });
+
+describe('#9709/#8942 校验信息出现/消失时高度稳定', () => {
+  it('addon 字段校验前后 explain 区域结构不变', async () => {
+    const formRef: { current?: ProFormInstance } = {};
+
+    const { container } = render(
+      <ProForm formRef={formRef as any} submitter={false}>
+        <ProFormText
+          name="code"
+          label="代码"
+          addonBefore="http://"
+          addonAfter=".com"
+          rules={[{ required: true, message: '请输入代码' }]}
+        />
+      </ProForm>,
+    );
+
+    const item = container.querySelector('.ant-form-item');
+    expect(item).toBeTruthy();
+
+    // addon 由 Form.Item children 内的布局渲染，与控件同域
+    expect(item!.textContent).toContain('http://');
+    expect(item!.textContent).toContain('.com');
+
+    // 校验前：无错误时不渲染 explain（antd 原生行为）
+    expect(item!.querySelector('.ant-form-item-explain')).toBeNull();
+
+    // 触发校验
+    await act(async () => {
+      formRef.current?.validateFields().catch(() => {});
+    });
+    await waitForErrorDebounce();
+
+    // 校验后：错误渲染在 antd 原生 additional 容器内（非自定义跳过），
+    // minHeight:marginBottom 占位机制生效，高度稳定
+    const additional = item!.querySelector('.ant-form-item-additional');
+    expect(additional).toBeTruthy();
+    const explain = additional!.querySelector('.ant-form-item-explain');
+    expect(explain).toBeTruthy();
+    expect(explain?.textContent).toContain('请输入代码');
+  });
+
+  it('普通字段（无 addon）校验错误正常显示', async () => {
+    const formRef: { current?: ProFormInstance } = {};
+
+    const { container } = render(
+      <ProForm formRef={formRef as any} submitter={false}>
+        <ProFormText
+          name="name"
+          label="名称"
+          rules={[{ required: true, message: '请输入名称' }]}
+        />
+      </ProForm>,
+    );
+
+    await act(async () => {
+      formRef.current?.validateFields().catch(() => {});
+    });
+    await waitForErrorDebounce();
+
+    const explain = container.querySelector('.ant-form-item-explain');
+    expect(explain?.textContent).toContain('请输入名称');
+  });
+
+  it('校验通过后错误消失且不残留布局占位（margin-offset 复位）', async () => {
+    const formRef: { current?: ProFormInstance } = {};
+
+    const { container } = render(
+      <ProForm formRef={formRef as any} submitter={false}>
+        <ProFormText
+          name="code"
+          label="代码"
+          addonBefore="http://"
+          rules={[{ required: true, message: '请输入代码' }]}
+        />
+      </ProForm>,
+    );
+
+    await act(async () => {
+      formRef.current?.validateFields().catch(() => {});
+    });
+    await waitForErrorDebounce();
+    expect(container.querySelector('.ant-form-item-explain')).toBeTruthy();
+
+    // 修复后错误消失
+    await act(async () => {
+      formRef.current?.setFieldsValue({ code: 'abc' });
+      await formRef.current?.validateFields();
+    });
+    await waitForErrorDebounce();
+
+    // ant-form-item-with-help 类已移除：字段恢复无错误状态。
+    // （错误文本的物理移除依赖 CSSMotion 离场动画，happy-dom 中动画不执行，
+    // 这是 antd 原生行为；真实浏览器中动画结束即移除）
+    const item = container.querySelector('.ant-form-item');
+    expect(item?.className).not.toContain('ant-form-item-with-help');
+  });
+});
```

**File**: `tests/utils/index.test.tsx` (modified, +1/-1)
```diff
@@ -679,7 +679,7 @@ describe('utils', () => {
         );
         expect(!!popoverContent).toBeTruthy();
         const warningEl = html.baseElement.querySelector(
-          '.ant-form-item-explain-warning',
+          'div.ant-popover .ant-form-item-explain-warning',
         );
         expect(!!warningEl).toBeTruthy();
         expect(warningEl?.textContent).toContain(warningMessage);
```

---

### Incident Patch 9: `e89bc48f` (2026-09-27)
**Commit Message**: fix: pin @babel/core to 7.x for vitest coverage-istanbul

**File**: `package.json` (modified, +2/-2)
```diff
@@ -85,7 +85,7 @@
   },
   "devDependencies": {
     "@ant-design/antd-theme-variable": "^1.0.0",
-    "@babel/core": "^8.0.6",
+    "@babel/core": "^7.29.7",
     "@babel/eslint-plugin": "^7.29.7",
     "@babel/parser": "^7.29.9",
     "@babel/plugin-transform-object-rest-spread": "^7.29.7",
@@ -191,7 +191,7 @@
       "@tootallnate/once": "2.0.1",
       "lodash": ">=4.18.0",
       "minimatch": ">=3.1.3",
-      "@babel/core": ">=7.29.6",
+      "@babel/core": ">=7.29.6 <8",
       "send": ">=0.19.0",
       "prismjs": ">=1.30.0",
       "braces": ">=3.0.3",
```

---

### Incident Patch 10: `399a1da0` (2026-09-26)
**Commit Message**: fix: resolve 6 issues - valueType priority, select ellipsis, vi-VN locale, onFinish error visibility

- #9002: explicit valueType is no longer overridden by valueEnum/request
  inference. Added isDefaultValueType marker in ProFieldCore; FormRender and
  columnRender now pass valueType: undefined when unset to preserve the
  default marker (4 regression tests)
- #8978: select read-mode enum output wrapped in span so Typography.Text
  ellipsis works with ellipsis+copyable (regression test)
- #9016: empty-string locale messages (e.g. vi-VN pagination range) are now
  respected instead of falling back to zh-CN (2 tests)
- #9019: onFinish errors are no longer silently swallowed; exposed via
  console.error while keeping loading-state behavior (test updated)
- #8973: verified array shape preserved after reset on antd6; locked with
  regression test
- #9033: verified SchemaForm formList renders labels on every row; locked
  with regression test

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/field/AllProField.tsx` (modified, +5/-1)
```diff
@@ -352,7 +352,11 @@ function renderDefaultValueTypeLeaf(
 
   if (
     valueType === 'select' ||
-    (valueType === 'text' && (props.valueEnum || props.request))
+    // #9002 仅缺省 valueType（未显式指定）时才根据 valueEnum/request 推断为 select，
+    // 显式传入 valueType: 'text' 的列即使带 valueEnum 也按文本渲染
+    (valueType === 'text' &&
+      props.isDefaultValueType &&
+      (props.valueEnum || props.request))
   ) {
     return wrapProFieldLight(
       props.light,
```

**File**: `src/field/ProFieldCore.tsx` (modified, +10/-1)
```diff
@@ -66,7 +66,7 @@ export function createProField(
   > = (
     {
       text,
-      valueType = 'text',
+      valueType,
       mode = 'read',
       onChange,
       formItemRender,
@@ -98,6 +98,11 @@ export function createProField(
       options.pickProPropsWithValueTypeMap &&
       Object.keys(context.valueTypeMap || {}).includes(String(valueType));
 
+    // #9002 显式传入的 valueType 不再被 valueEnum/request 智能推断覆盖：
+    // 仅当调用方未设置 valueType（缺省 'text'）时才允许推断为 select 等类型，
+    // 用于区分「用户显式要 text」与「历史默认行为（有 valueEnum 就渲染 select）」
+    const isDefaultValueType = valueType === undefined;
+
     const effectiveMode = readonly ? 'read' : mode;
     /** 取值顺序仍以原始 mode 为准（readonly + mode=edit 时仍按编辑态取 fieldProps.value） */
     const dataValue =
@@ -115,6 +120,10 @@ export function createProField(
       omitUndefined({
         ref,
         ...rest,
+        // #9002 标记 valueType 是否为缺省值（undefined 时补 'text'）。
+        // AllProField / ValueTypeToComponent 依据此标记决定是否做
+        // 「valueEnum/request → select」的智能推断，显式 valueType 优先。
+        isDefaultValueType,
         mode: effectiveMode,
         formItemRender: formItemRender
           ? (
```

**File**: `src/field/ValueTypeToComponent.tsx` (modified, +2/-1)
```diff
@@ -268,7 +268,8 @@ const ValueTypeToComponentMap: Record<
     wrapProFieldLight(props.light, <FieldSelect {...props} text={text} />),
   ),
   text: sameRenderPair((text, props) =>
-    'valueEnum' in props ? (
+    // #9002 仅缺省 valueType 时才根据 valueEnum 推断为 select（与 AllProField 行为一致）
+    'valueEnum' in props && props.isDefaultValueType ? (
       wrapProFieldLight(props.light, <FieldSelect {...props} text={text} />)
     ) : (
       <FieldText {...props} text={text as string} />
```

**File**: `src/field/components/Select/FieldSelectRead.tsx` (modified, +5/-2)
```diff
@@ -19,15 +19,18 @@ type Props = Parameters<
 export function FieldSelectRead(props: Props) {
   const { mode, render, fieldProps, valueEnum, optionsValueEnum, ...rest } =
     props;
+  // #8978 用单个 span 包裹枚举渲染结果（多选时是一串 Badge）：
+  // Typography.Text 的 ellipsis 只对纯文本子节点生效，
+  // Fragment 列表会让省略失效，包一层后省略/复制行为恢复正常
   const dom = (
-    <>
+    <span className="pro-field-select-read">
       {proFieldParsingText(
         rest.text,
         objectToMap(
           valueEnum || optionsValueEnum,
         ) as unknown as ProSchemaValueEnumObj,
       )}
-    </>
+    </span>
   );
 
   if (render) {
```

**File**: `src/field/types.ts` (modified, +6/-0)
```diff
@@ -41,6 +41,12 @@ export type ProFieldRenderProps = Omit<
     emptyText?: React.ReactNode;
     open?: boolean;
     onOpenChange?: (open: boolean) => void;
+    /**
+     * #9002 内部标记：valueType 为缺省值（调用方未显式传入）时为 true。
+     * 渲染函数依据它决定是否做「valueEnum/request → select」智能推断，
+     * 显式传入的 valueType 永远优先。外部无需关心此字段。
+     */
+    isDefaultValueType?: boolean;
     [key: string]: any;
   };
 
```

#### Recent Merged Pull Requests:
- **PR #9708** (closed): feat(table): cell-level editableKeys and onCell editing state (#9643) (@chenshuai2144)
- **PR #9701** (2026-09-24): fix(table): respect option column alignment (@bianxuerui)
- **PR #9696** (closed): fix(LightFilter)label 重复问题 (@KunHuoJ)
- **PR #9693** (2026-08-28): fix(card): apply semantic classNames/styles to actions area (@sunven)
- **PR #9692** (2026-08-27): fix(descriptions): merge user styles with internal defaults instead of overriding (@sunven)
- **PR #9691** (2026-08-27): fix(locale): correct zh-TW line item glyphs (@nrps9909)
- **PR #9690** (closed): fix(table): preserve fixed columns after settings drag (@nrps9909)
- **PR #9689** (closed): fix(select): support showSearch object config (@nrps9909)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
