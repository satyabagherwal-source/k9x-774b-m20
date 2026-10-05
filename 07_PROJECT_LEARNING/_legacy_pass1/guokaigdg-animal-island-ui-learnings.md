# Forensic Learning Record (Deep Inspection): guokaigdg/animal-island-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/guokaigdg-animal-island-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:57.203Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `guokaigdg/animal-island-ui`
- **Description**: A Kawaii React UI component library  一个可爱的 React UI 组件库
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4725 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/App.tsx`
```
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Cursor } from '../src';
import '../src/styles/index.less';
import backgroundStyles from '../src/components/Background/background.module.less';
import bgSweetCorner from '../src/assets/image/sweet-corner.svg';
import bgCoffeeBreak from '../src/assets/image/coffee-break.svg';
import './fonts.css';
import HomePage from './HomePage';
import { PAGE_INFO } from './pageInfo';
import { useIsMobile } from './tools';
import logo from './assets/logo.png';

// Lazy-load ComponentPage so homepage does not pull in every demo on initial load
const ComponentPage = lazy(() => import('./ComponentPage'));

// ============================================
// Simple hash router
// ============================================
const useHash = () => {
    const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');

    useEffect(() => {
        const onHashChange = () => setHash(window.location.hash.slice(1) || '/');
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const navigate = useCallback((path: string) => {
        window.location.hash = path;
    }, []);

    return { hash, navigate };
};

interface MenuItemChild {
    key: string;
    label: string;
    isNew?: boolean;
}

interface MenuItem {
    key: string;
    label: string;
    children?: MenuItemChild[];
}

// ============================================
// Menu config — 5 categories by function:
//   基础      → 无状态/纯展示 (Title, Button, Divider, Icon, Tag, Cursor, CodeBlock, Footer)
//   表单      → 数据录入/校验 (Input, Switch, Select, Checkbox, Radio, Form)
//   反馈      → 浮层/状态/异步反馈 (Notification, Modal, Drawer, Tooltip, Progress)
//   数据展示  → 容器/列表/排版 (Card, Collapse, Tabs, Table, Typewriter)
//   主题  → 业务复合/主题专属 (Countdown)
// ============================================
const MENU_ITEMS: MenuItem[] = [
    // 隐藏：暂不展示，恢复时取消注释
    {
        key: 'cat-guide',
        label: '── 指南 ──',
        children: [{ key: 'skill', label: 'Skill 介绍', isNew: true }],
    },
    {
        key: 'cat-basic',
        label: '── 基础 ──',
        children: [
            // 隐藏：暂不展示，恢复时取消注释
            { key: 'title', label: 'Title 标题', isNew: true },
            { key: 'button', label: 'Button 按钮' },
            { key: 'divider-comp', label: 'Divider 分割线' },
            { key: 'icon', label: 'Icon 图标', isNew: true },
            { key: 'tag', label: 'Tag 标签' },
            { key: 'cursor', label: 'Cursor 光标' },
            { key: 'codeblock', label: 'CodeBlock 代码高亮' },
            { key: 'background', label: 'Background 背景', isNew: true },
            { key: 'footer', label: 'Footer 页脚' },
        ],
    },
    {
        key: 'cat-form',
        label: '── 表单 ──',
        children: [
            { key: 'input', label: 'Input 输入框' },
            { key: 'switch', label: 'Switch 开关' },
            // 隐藏：暂不展示，恢复时取消注释
            { key: 'select', label: 'Select 选择器' },
            { key: 'date-picker', label: 'DatePicker 日期选择' },
            { key: 'time-picker', label: 'TimePicker 时间选择' },
            { key: 'checkbox', label: 'Checkbox 多选框' },
            { key: 'radio', label: 'Radio 单选框' },
            { key: 'form', label: 'Form 表单' },
            { key: 'upload', label: 'Upload 上传', isNew: true },
        ],
    },
    {
        key: 'cat-feedback',
        label: '── 反馈 ──',
        children: [
            { key: 'notification', label: 'Notification 通知' },
            // 隐藏：暂不展示，恢复时取消注释
            { key: 'modal', label: 'Modal 弹窗' },
            { key: 'drawer', label: 'Drawer 抽屉' },
            { key: 'loading', label: 'Loading 加载' },
            { key: 'tooltip', label: 'Tooltip 气泡提示' },
            { key: 'progress', label: 'Progress 进度条' },
            { key: 'skeleton', label: 'Skeleton 骨架屏' },
            { key: 'backtop', label: 'BackTop 返回顶部' },
        ],
    },
    {
        key: 'cat-data-display',
        label: '── 数据展示 ──',
        children: [
            { key: 'card', label: 'Card 卡片' },
            // 隐藏：暂不展示，恢复时取消注释
            { key: 'collapse', label: 'Collapse 折叠面板' },
            { key: 'tabs', label: 'Tabs 标签页' },
            { key: 'table', label: 'Table 表格' },
            { key: 'pagination', label: 'Pagination 分页' },
            { key: 'typewriter', label: 'Typewriter 打字机' },
            { key: 'image', label: 'Image 图片' },
            { key: 'carousel', label: 'Carousel 轮播图' },
            { key: 'time', label: 'Time 时钟' },
            { key: 'countdown', label: 'Countdown 倒计时' },
        ],
    },
];

// ============================================
// Shared styles
// ============================================
const S = {
    layout: {
        display: 'flex',
        height: '100dvh',
        overflow: 'hidden',
        fontFamily:
            "Nunito, 'Noto Sans SC', 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        // 波点壁纸（与首页 page 容器一致）：两层错位绿点 + 底色 #88c9a1
        background: `
            radial-gradient(circle, rgba(90, 160, 105, 0.4) 1.5px, transparent 1.5px) 0 0 / 28px 28px,
            radial-gradient(circle, rgba(110, 180, 125, 0.3) 1px, transparent 1px) 7px 7px / 14px 14px,
            #88c9a1
        `,
    } as React.CSSProperties,
    sidebar: {
        width: 220,
        minWidth: 220,
        // 拼色底部：雾蓝 #a2b0e7ff 色块，顶部为平滑正弦曲线（谷峰高 75px、谷底高 60px，较上版整体上移 20px），上部保持奶油色
        background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='130' viewBox='0 0 220 130'%3E%3Cpath fill='%23a2b0e7ff' d='M0 70 Q55 40 110 70 T220 70 V130 H0 Z'/%3E%3C/svg%3E\") left bottom / 220px 130px no-repeat",
        backgroundColor: '#faf8f3',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        margin: '12px 0 12px 12px',
        borderRadius: 16,
        border: '2px solid rgba(250, 250, 250, 1)',
        boxShadow: '0 4px 16px rgba(61, 52, 40, 0.10)',
        height: 'calc(100dvh - 20px)',
    } as React.CSSProperties,
    sidebarHeader: {
        padding: '20px 20px 12px',
        borderBottom: '1px solid #e8e2d6',
        fontFamily:
            "'GROBOLD', Nunito, 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        fontWeight: 700,
        fontSize: 15,
        color: '#725d42',
        letterSpacing: 0,
        display: 'flex',
        alignItems: 'center',
    } as React.CSSProperties,
    menuList: {
        flex: 1,
        overflow: 'auto',
        // 底部留白避开拼色曲线区（谷峰高约 75px）
        padding: '8px 0 82px',
    } as React.CSSProperties,
    menuItem: (active: boolean) =>
        ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            margin: '1px 5px',
            height: 40,
            padding: '0 12px',
            fontFamily:
                "Nunito, 'Noto Sans SC', 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: 14,
            paddingLeft: 26,
            color: active ? '#fff' : '#8a7b66',
            background: active ? '#B7C6E5' : 'transparent',
            borderRadius: 12,
            borderRight: 'none',
            transition: 'all 0.15s',
        }) as React.CSSProperties,
    menuBadge: (active: boolean) =>
        ({
            flexShrink: 0,
            padding: '1px 7px',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.6,
            color: active ? '#fc736d' : '#fff',
            background: active ? '#fff' : 'linear-gradient(135deg, #fc736d, #f7825a)',
            borderRadius: 8,
            lineHeight: '14px',
            boxShadow: active ? '0 1px 0 rgba(114, 93, 66, 0.15)' : '0 1px 0 rgba(114, 93, 66, 0.25)',
   
```

### Core Architecture Module: `demo/ComponentPage.tsx`
```
import React from 'react';
import { Title, TitleColor, Typewriter } from '../src';
import FooterDemo from './components/Footer';
import IconDemo from './components/Icon/IconDemo';
import TabsDemo from './components/Tabs';
import CheckboxDemo from './components/Checkbox';
import RadioDemo from './components/Radio';
import TooltipDemo from './components/Tooltip';
import TitleDemo from './components/Title';
import CodeBlockDemo from './components/CodeBlock';
import TableDemo from './components/Table/TableDemo';
import PaginationDemo from './components/Pagination';
import DrawerDemo from './components/Drawer/DrawerDemo';
import FormDemo from './components/Form';
import UploadDemo from './components/Upload';
import TagDemo from './components/Tag';
import NotificationDemo from './components/Notification';
import ProgressDemo from './components/Progress';
import LoadingDemo from './components/Loading';
import SkeletonDemo from './components/Skeleton';
import BackTopDemo from './components/BackTop';
import ImageDemo from './components/Image';
import ButtonDemo from './components/Button';
import InputDemo from './components/Input';
import SwitchDemo from './components/Switch';
import CardDemo from './components/Card';
import CollapseDemo from './components/Collapse';
import CursorDemo from './components/Cursor';
import ModalDemo from './components/Modal';
import TypewriterDemo from './components/Typewriter';
import DividerDemo from './components/Divider';
import BackgroundDemo from './components/Background';
import SelectDemo from './components/Select';
import DatePickerDemo from './components/DatePicker';
import TimePickerDemo from './components/TimePicker';
import CountdownDemo from './components/Countdown';
import TimeDemo from './components/Time';
import CarouselDemo from './components/Carousel';
import SkillDemo from './components/Skill';
import { PAGE_INFO } from './pageInfo';
const pageDescStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#794f27',
    marginBottom: 20,
};

// ============================================
// Page info & mapping
// ============================================

const PAGES: Record<string, React.FC> = {
    button: ButtonDemo,
    input: InputDemo,
    switch: SwitchDemo,
    card: CardDemo,
    collapse: CollapseDemo,
    cursor: CursorDemo,
    footer: FooterDemo,
    modal: ModalDemo,
    drawer: DrawerDemo,
    typewriter: TypewriterDemo,
    'divider-comp': DividerDemo,
    background: BackgroundDemo,
    icon: IconDemo,
    select: SelectDemo,
    'date-picker': DatePickerDemo,
    'time-picker': TimePickerDemo,
    tabs: TabsDemo,
    checkbox: CheckboxDemo,
    radio: RadioDemo,
    tooltip: TooltipDemo,
    title: TitleDemo,
    codeblock: CodeBlockDemo,
    table: TableDemo,
    pagination: PaginationDemo,
    tag: TagDemo,
    notification: NotificationDemo,
    progress: ProgressDemo,
    loading: LoadingDemo,
    form: FormDemo,
    upload: UploadDemo,
    skeleton: SkeletonDemo,
    backtop: BackTopDemo,
    image: ImageDemo,
    countdown: CountdownDemo,
    time: TimeDemo,
    carousel: CarouselDemo,
    skill: SkillDemo,
};

// ============================================
// ComponentPage
// ============================================
const TITLE_COLORS: TitleColor[] = [
    'lime-green',
    'default',
    'app-pink',
    'purple',
    'app-blue',
    'app-yellow',
    'app-orange',
    'app-red',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];

interface ComponentPageProps {
    activeKey: string;
}

const ComponentPage: React.FC<ComponentPageProps> = ({ activeKey }) => {
    const Page = PAGES[activeKey];
    const info = PAGE_INFO[activeKey];

    // 根据 activeKey 固定映射一种颜色，切换页面时变色但同一页面不随机抖动
    const titleColor =
        TITLE_COLORS[Math.abs(activeKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % TITLE_COLORS.length];

    if (!Page || !info) return null;

    return (
        <>
            <Title size="large" color={titleColor} style={{ marginBottom: 30, marginLeft: 18 }}>
                {info.title}
            </Title>
            <div style={{ ...pageDescStyle, minHeight: 40 }}>
                <Typewriter key={activeKey} trigger={activeKey} speed={30}>
                    {info.desc}
                </Typewriter>
            </div>
            <Page />
        </>
    );
};

export default ComponentPage;

```

### Core Architecture Module: `demo/HomePage.tsx`
```
import React, { useState } from 'react';
import { Card, Button, Typewriter } from '../src';
import * as Icons from 'naive-icons';
import { islandGradient } from './gradients';
import { useIsMobile } from './tools';

type NaiveIcon = React.FC<{ size?: number | string; color?: string; style?: React.CSSProperties }>;

/** 按图标名解析 naive-icons 图标组件（如 'Heart' → HeartIcon） */
function resolveIcon(name: string): NaiveIcon | null {
    const Cmp = (Icons as Record<string, unknown>)[`${name}Icon`];
    // naive-icons 1.1.0 起组件由 forwardRef 创建（返回 {$$typeof, render} 对象而非函数）；
    // 兼容两种形态，避免 `typeof === 'function'` 判定失败导致图标不渲染
    return Cmp !== null && Cmp !== undefined ? (Cmp as NaiveIcon) : null;
}

// ============================================
// Syntax highlighting
// ============================================
const HL_TOKENS: { pattern: RegExp; style: React.CSSProperties }[] = [
    {
        pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
        style: { color: '#6b5e50', fontStyle: 'italic', fontWeight: 400 },
    },
    {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        style: { color: '#a8d4a0' },
    },
    { pattern: /(<\/?[\w.]+|\/?>)/g, style: { color: '#f0a870' } },
    {
        pattern: /\b(import|from|const|let|var|function|return|export|default|true|false|null|undefined)\b/g,
        style: { color: '#d4a0e0' },
    },
    { pattern: /\b(npm|yarn|pnpm)\b/g, style: { color: '#f0a870' } },
    {
        pattern: /(install|uninstall|run|add|remove)\b/g,
        style: { color: '#a8d4a0' },
    },
    { pattern: /(\{|\})/g, style: { color: '#d4b896' } },
    { pattern: /(=>)/g, style: { color: '#d4a0e0' } },
    { pattern: /(--[\w-]+)(?=\s*:)/g, style: { color: '#e8c87a' } },
    { pattern: /(:root)/g, style: { color: '#f0a870' } },
    { pattern: /(#[0-9a-fA-F]{3,8})\b/g, style: { color: '#8ab8e0' } },
];

const highlightCode = (code: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const lines = code.split('\n');
    lines.forEach((line, li) => {
        type Seg = { start: number; end: number; style: React.CSSProperties };
        const segs: Seg[] = [];
        for (const t of HL_TOKENS) {
            const re = new RegExp(t.pattern.source, t.pattern.flags);
            let m: RegExpExecArray | null;
            while ((m = re.exec(line)) !== null) {
                const s = m.index + (m[0] !== m[1] && m[1] ? m[0].indexOf(m[1]) : 0);
                const text = m[1] || m[0];
                segs.push({ start: s, end: s + text.length, style: t.style });
            }
        }
        segs.sort((a, b) => a.start - b.start);
        const merged: Seg[] = [];
        for (const seg of segs) {
            if (merged.length === 0 || seg.start >= merged[merged.length - 1].end) merged.push(seg);
        }
        let idx = 0;
        for (const seg of merged) {
            if (seg.start > idx) parts.push(line.slice(idx, seg.start));
            parts.push(
                <span key={`${li}-${seg.start}`} style={seg.style}>
                    {line.slice(seg.start, seg.end)}
                </span>
            );
            idx = seg.end;
        }
        if (idx < line.length) parts.push(line.slice(idx));
        if (li < lines.length - 1) parts.push('\n');
    });
    return parts;
};

const CodeBlock: React.FC<{ code: string }> = ({ code }) => <pre style={S.codeBox}>{highlightCode(code)}</pre>;

const FeatureCard: React.FC<{ feature: (typeof features)[0] }> = ({ feature }) => {
    const [hovered, setHovered] = useState(false);
    const IconCmp = resolveIcon(feature.icon);
    return (
        <Card
            style={{
                ...S.featureCard,
                position: 'relative',
                zIndex: 999,
                transform: hovered ? 'translateY(-4px)' : 'none',
                boxShadow: hovered ? '0 8px 24px rgba(114, 93, 66, 0.15)' : 'none',
                transition: 'all 0.3s ease',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 42,
                    height: 42,
                    margin: '0 auto',
                    transform: hovered ? 'scale(1.1) rotate(-4deg)' : 'scale(1) rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    animation: hovered ? 'iconBounce 0.4s ease forwards' : 'none',
                }}
            >
                {IconCmp && <IconCmp size={42} />}
            </div>
            <style>
                {`
                    @keyframes iconBounce {
                        0% { transform: scale(1) rotate(0deg); }
                        50% { transform: scale(1.2) rotate(-5deg); }
                        100% { transform: scale(1.1) rotate(-4deg); }
                    }
                `}
            </style>
            <div style={S.featureTitle}>{feature.title}</div>
            <div style={S.featureDesc}>{feature.desc}</div>
        </Card>
    );
};

// ============================================
// Styles
// ============================================
// 首页背景装饰：低透明度 Icon 平铺壁纸
const BG_ICONS: string[] = [
    'Heart',
    'Star',
    'Sun',
    'Moon',
    'Cloud',
    'Rainbow',
    'Flower',
    'Butterfly',
    'Leaf',
    'Tree',
    'Mushroom',
    'Bird',
    'Fish',
    'Sailboat',
    'Balloon',
    'Icecream',
    'Coffee',
    'Music',
    'Snowflake',
    'Gift',
    'Rocket',
    'Bear',
    'Cat',
    'Rabbit',
    'Frog',
    'Owl',
    'Penguin',
    'Apple',
    'Cherry',
    'Lemon',
    'Cactus',
    'Home',
    'Camera',
    'Bell',
    'Globe',
    'Key',
    'Search',
    'Settings',
    'Mail',
    'Phone',
    'Umbrella',
    'Download',
    'Wifi',
    'Headphones',
    'Donut',
    'Strawberry',
    'Watermelon',
    'Ladybug',
    'Bee',
    'Snail',
    'Dog',
    'Fox',
    'Bicycle',
    'Car',
    'Train',
];
const S = {
    page: {
        width: '100%',
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        // 首页壁纸：图案由低透明度 Icon 背景层提供，此处置纯色底
        background: '#88c9a1',
    } as React.CSSProperties,

    // 背景装饰层：各种 Icon 随机散落（固定种子定位 + 轻微旋转，漂浮动画在图标上）；fixed 铺满全屏，滚动时保持不动
    bgIcons: {
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
    } as React.CSSProperties,

    // Hero（背景由 page 容器统一提供）
    hero: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '60px 40px 40px',
        position: 'relative',
        zIndex: 1,
    } as React.CSSProperties,
    heroContent: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 150,
        alignItems: 'center',
        maxWidth: 880,
        width: '100%',
    } as React.CSSProperties,
    heroContentMobile: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 32,
        alignItems: 'center',
        maxWidth: 880,
        width: '100%',
    } as React.CSSProperties,
    heroText: {
        textAlign: 'left' as const,
    } as React.CSSProperties,
    heroLogo: {
        fontSize: 72,
        lineHeight: 1,
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    } as React.CSSProperties,
    heroTitle: {
        fontFamily:
            "'GROBOLD', Nunito, 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        fontSize: 55,
        fontWeight: 800,
        lineHeight: 1.1,
        color: '#FFF9E6',
        textShadow: '0px 4px 1px rgba(0, 0, 0, 0.4)',
        margin: '0 0 12px',
    } as React.CSSProperties,
    heroVersion: {
  
```

### Core Architecture Module: `demo/components/BackTop/index.tsx`
```
import React, { useEffect, useCallback } from 'react';
import { BackTop, Card } from '../../../src';
import type { CardPattern } from '../../../src/components/Card';
import {
    CodeBlock,
    ApiTable,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBodyStyle,
    labelStyle,
} from '../../tools';

const BACKTOP_API: ApiRow[] = [
    { prop: 'visibilityHeight', desc: '滚动多少 px 后显示', type: 'number', defaultVal: '400' },
    {
        prop: 'target',
        desc: '滚动容器函数，默认 window',
        type: '() => HTMLElement | Window',
        defaultVal: '() => window',
    },
    { prop: 'duration', desc: '滚动动画时长(ms)', type: 'number', defaultVal: '300' },
    { prop: 'onClick', desc: '点击回调', type: '(e) => void', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'CSSProperties', defaultVal: '-' },
];

// 50 位动物岛民数据
const PATTERNS: CardPattern[] = [
    'default',
    'app-pink',
    'purple',
    'app-blue',
    'app-yellow',
    'app-orange',
    'app-teal',
    'app-green',
    'app-red',
    'lime-green',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];

const RESIDENTS = [
    { name: '小润', romanized: 'Xiaorun', species: '松鼠', hobby: '园艺', desc: '热爱园艺的小松鼠，每天在广场上唱歌' },
    { name: '阿诚', romanized: 'Acheng', species: '猫', hobby: '钓鱼', desc: '喜欢钓鱼的蓝色猫，经常在河边发呆' },
    { name: '莉莉安', romanized: 'Lilian', species: '兔子', hobby: '烹饪', desc: '性格开朗的小兔子，总是带着胡萝卜' },
    { name: '熊大叔', romanized: 'Xiongda', species: '熊', hobby: '阅读', desc: '爱读书的棕熊，知识渊博但有点害羞' },
    { name: '茉莉', romanized: 'Moli', species: '猫', hobby: '捉虫', desc: '最喜欢的活动是捉虫和收集贝壳' },
    { name: '茶茶', romanized: 'Chacha', species: '鸭子', hobby: '唱歌', desc: '嗓音甜美的小鸭子，岛上的明星歌手' },
    { name: '铁蛋', romanized: 'Tiedan', species: '鸡', hobby: '健身', desc: '热爱运动的公鸡，每天早晨第一个起床' },
    { name: '雪花', romanized: 'Xuehua', species: '企鹅', hobby: '滑雪', desc: '从南极来的小企鹅，喜欢在雪地里打滚' },
    { name: '小八', romanized: 'Xiaoba', species: '章鱼', hobby: '绘画', desc: '多才多艺的小章鱼，触手就是画笔' },
    { name: '胖胖', romanized: 'Pangpang', species: '猪', hobby: '美食', desc: '岛上的美食家，知道每一种水果的味道' },
    { name: '鹿鹿', romanized: 'Lulu', species: '鹿', hobby: '花卉', desc: '优雅的小鹿，头上总是别着一朵花' },
    { name: '米米', romanized: 'Mimi', species: '老鼠', hobby: '收集', desc: '喜欢收集各种坚果的小老鼠' },
    { name: '弗雷德', romanized: 'Frede', species: '狼', hobby: '天文', desc: '夜晚观测星空的狼，知道每颗星星的名字' },
    { name: '贝蒂', romanized: 'Beidi', species: '绵羊', hobby: '编织', desc: '心灵手巧的小绵羊，用羊毛织围巾' },
    { name: '大壮', romanized: 'Dazhuang', species: '牛', hobby: '农耕', desc: '勤劳的奶牛，经营岛上最大的菜园' },
    { name: '跳跳', romanized: 'Tiaotiao', species: '青蛙', hobby: '跳跃', desc: '蹦蹦跳跳的小青蛙，雨后最爱唱歌' },
    { name: '妮妮', romanized: 'Nini', species: '仓鼠', hobby: '园艺', desc: '在花丛中安家的小仓鼠，笑容超治愈' },
    { name: '船长', romanized: 'Chuanzhang', species: '狗', hobby: '航海', desc: '梦想成为航海家的狗狗，每天都在看海' },
    { name: '小霞', romanized: 'Xiaoxia', species: '火烈鸟', hobby: '跳舞', desc: '舞姿优美的火烈鸟，岛上舞蹈老师' },
    { name: '墨墨', romanized: 'Momo', species: '乌贼', hobby: '书法', desc: '爱好书法的乌贼，墨水从不缺' },
    { name: '糖糖', romanized: 'Tangtang', species: '猫熊', hobby: '甜品', desc: '爱做甜品的小熊猫，竹叶蛋糕是招牌' },
    { name: '小武', romanized: 'Xiaowu', species: '猴子', hobby: '探险', desc: '身手敏捷的小猴子，岛上探险队长' },
    { name: '艾琳', romanized: 'Ailin', species: '考拉', hobby: '睡觉', desc: '总是在树上打盹的考拉，懒洋洋的很可爱' },
    { name: '尖尖', romanized: 'Jianjian', species: '刺猬', hobby: '缝纫', desc: '背着小针线的刺猬，缝补一切破洞' },
    { name: '泡泡', romanized: 'Paopao', species: '河马', hobby: '游泳', desc: '爱吹泡泡的河马，泳池里的开心果' },
    { name: '弯弯', romanized: 'Wanwan', species: '鸵鸟', hobby: '跑步', desc: '跑得飞快的鸵鸟，岛上快递员' },
    { name: '胡胡', romanized: 'Huhu', species: '狐狸', hobby: '魔术', desc: '会变魔术的小狐狸，口袋里总有惊喜' },
    { name: '雪莉', romanized: 'Xueli', species: '北极熊', hobby: '冰雕', desc: '擅长冰雕的北极熊，作品栩栩如生' },
    { name: '雷雷', romanized: 'Leilei', species: '大象', hobby: '音乐', desc: '用长鼻子吹口琴的大象，岛上的音乐家' },
    {
        name: '小花',
        romanized: 'Xiaohua',
        species: '长颈鹿',
        hobby: '摄影',
        desc: '个子最高的长颈鹿，拍日出最美的角度',
    },
    { name: '冲儿', romanized: 'Chonger', species: '鲨鱼', hobby: '冲浪', desc: '爱冲浪的鲨鱼，浪花上的舞者' },
    { name: '妮可', romanized: 'Nike', species: '猫', hobby: '时尚', desc: '爱打扮的猫咪，每天换不同的蝴蝶结' },
    { name: '帕克', romanized: 'Pake', species: '企鹅', hobby: '钓鱼', desc: '很会钓鱼的企鹅，冰钓冠军' },
    { name: '春春', romanized: 'Chunchun', species: '鸟', hobby: '园艺', desc: '把鸟巢装饰成花园的小鸟，很有品味' },
    { name: '憨憨', romanized: 'Hanhan', species: '熊', hobby: '蜂蜜', desc: '最喜欢蜂蜜的憨熊，笑容让人安心' },
    { name: '悠悠', romanized: 'Youyou', species: '水獭', hobby: '游泳', desc: '在水面画圈圈的水獭，优雅又悠闲' },
    { name: '小桔', romanized: 'Xiaoju', species: '猫', hobby: '烘焙', desc: '橙黄色的橘子猫，做的曲奇超好吃' },
    { name: '蹦蹦', romanized: 'Bengbeng', species: '袋鼠', hobby: '拳击', desc: '跳得最高的袋鼠，拳击高手' },
    { name: '梦梦', romanized: 'Mengmeng', species: '羊驼', hobby: '绘画', desc: '毛茸茸的羊驼，画风软萌可爱' },
    { name: '达达', romanized: 'Dada', species: '马', hobby: '赛跑', desc: '跑起来像风的马，岛上运动健将' },
    { name: '贝拉', romanized: 'Beila', species: '蝴蝶', hobby: '采蜜', desc: '翅膀像彩虹的蝴蝶，岛上最受欢迎的访客' },
    { name: '鼓鼓', romanized: 'Gugu', species: '河豚', hobby: '气球', desc: '生气就鼓成球的河豚，可爱又好笑' },
    { name: '云云', romanized: 'Yunyun', species: '羊', hobby: '观云', desc: '喜欢躺在山坡上看云的绵羊' },
    { name: '叮叮', romanized: 'Dingding', species: '蜜蜂', hobby: '酿造', desc: '勤劳的小蜜蜂，酿的蜂蜜甜到心里' },
    { name: '洛奇', romanized: 'Luoqi', species: '狮子', hobby: '雕塑', desc: '用爪子雕塑的狮子，作品充满力量' },
    { name: '点点', romanized: 'Diandian', species: '瓢虫', hobby: '旅行', desc: '背着斑点壳旅行的瓢虫，见过很多岛' },
    { name: '圆圆', romanized: 'Yuanyuan', species: '海豹', hobby: '顶球', desc: '圆滚滚的小海豹，顶球是拿手好戏' },
    { name: '叶子', romanized: 'Yezi', species: '树懒', hobby: '瑜伽', desc: '做瑜伽都慢吞吞的树懒，治愈人心' },
    { name: '派派', romanized: 'Paipai', species: '土拨鼠', hobby: '挖洞', desc: '喜欢挖地道的小土拨鼠，地下迷宫大师' },
    { name: '晴天', romanized: 'Qingtian', species: '天竺鼠', hobby: '种花', desc: '头顶一朵向日葵的天竺鼠，微笑天使' },
];

const BackTopDemo: React.FC = () => {
    const getTarget = useCallback(() => {
        return document.querySelector('main') || window;
    }, []);

    useEffect(() => {
        // 延迟到 DOM 渲染完成后自动滚动到底部
        const timer = setTimeout(() => {
            const el = document.querySelector('main');
            if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                BackTop <DemoTag>返回顶部</DemoTag> <DemoTag>上箭头</DemoTag>
            </div>
            <div style={demoBodyStyle}>
                <div style={{ fontSize: 14, color: '#9f927d', marginBottom: 16, lineHeight: 1.6 }}>
                    页面已自动滚动到底部，点击右下角的上箭头返回顶部。
                    <br />
                    <code style={{ background: '#f0e8d8', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
                        visibilityHeight=400
                    </code>{' '}
                    意味着滚动超过 400px 后图标出现。
                </div>

                {/* ---- 动物岛民列表 ---- */}
                <div style={labelStyle}>动物岛民列表 — 共 50 位</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {RESIDENTS.map((resident, i) => (
                        <Card
                            key={resident.name}
                            pattern={PATTERNS[i % PATTERNS.length]}
                            style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 14 }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.45)',
                                    display: 'flex',
                           
```

### Core Architecture Module: `demo/components/Background/index.tsx`
```
import React from 'react';
import { Background } from '../../../src';
import type { BackgroundType } from '../../../src';
import { labelStyle, sectionStyle, sectionTitleStyle, DemoTag, ApiTable, ApiRow, CodeBlock } from '../../tools';

// 彩蛋：hover 预览块 → 整个 demo 站点壁纸同步切换为该图案；移开还原
const dispatchPageBg = (type: BackgroundType | 'reset') => () =>
    window.dispatchEvent(new CustomEvent('demo-bg-easter-egg', { detail: type }));

const BACKGROUND_TYPE_UNION =
    "'default' | 'grid' | 'dots-dark-green' | 'sprinkles' | 'sweet-corner' | 'coffee-break' | 'dots-pink' | 'dots-purple' | 'dots-blue' | 'dots-yellow' | 'dots-orange' | 'dots-teal' | 'dots-green' | 'dots-red' | 'dots-lime-green' | 'dots-yellow-green' | 'dots-brown' | 'dots-warm-peach-pink'";

const BACKGROUND_API: ApiRow[] = [
    {
        prop: 'type',
        desc: '背景图案类型（dots-* 底色与 Card pattern-* 系列一致）',
        type: BACKGROUND_TYPE_UNION,
        defaultVal: "'default'",
    },
    { prop: 'children', desc: '子内容，渲染在图案背景之上', type: 'ReactNode', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    {
        prop: 'style',
        desc: '自定义样式',
        type: 'CSSProperties',
        defaultVal: '-',
    },
    { prop: '...rest', desc: '透传其余 div 原生属性', type: 'HTMLAttributes', defaultVal: '-' },
];

const previewBox: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    color: '#725d42',
    fontWeight: 600,
    fontSize: 15,
};

// 全部 18 种类型（type / 中文名 / 文字色），dots-* 底色对应 Card pattern-* 系列，文字色与 Card pattern 系列保持一致
const CARD_COLORS: ReadonlyArray<[BackgroundType, string, string]> = [
    ['default', '奶油色波点（默认）', '#725d42'],
    ['grid', '网格', '#725d42'],
    ['dots-dark-green', '深绿波点', '#3a6b3a'],
    ['sprinkles', '彩色针糖', '#725d42'],
    ['sweet-corner', '甜点街角', '#725d42'],
    ['coffee-break', '咖啡时光', '#725d42'],
    ['dots-pink', '应用粉', '#a85565'],
    ['dots-purple', '紫色', '#6a3a9a'],
    ['dots-blue', '应用蓝', '#4a5a8a'],
    ['dots-yellow', '应用黄', '#7a6528'],
    ['dots-orange', '应用橙', '#8a4a2a'],
    ['dots-teal', '应用青', '#2a6b5a'],
    ['dots-green', '应用绿', '#3a6b3a'],
    ['dots-red', '应用红', '#9a3a3a'],
    ['dots-lime-green', '青柠绿', '#5a6b28'],
    ['dots-yellow-green', '黄绿色', '#6a5a28'],
    ['dots-brown', '棕色', '#5a4a2a'],
    ['dots-warm-peach-pink', '暖桃粉', '#8a4a2a'],
];

const BackgroundDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Background <DemoTag>18 types · Card pattern base · 2 scene images</DemoTag>
        </div>
        <div style={labelStyle}>全部类型（dots-* 底色对应 Card pattern-* 系列，hover 预览整站壁纸）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {CARD_COLORS.map(([type, cn, color]) => {
                const isScene = type === 'sweet-corner' || type === 'coffee-break';
                return (
                    <Background
                        key={type}
                        type={type}
                        style={{
                            width: type === 'sprinkles' || isScene ? 348 : 168,
                            height: 120,
                            ...(isScene ? { backgroundSize: '240% auto' } : null),
                            borderRadius: 14,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 600,
                            color,
                        }}
                        onMouseEnter={dispatchPageBg(type)}
                        onMouseLeave={dispatchPageBg('reset')}
                    >
                        <span style={{ textAlign: 'center', lineHeight: 1.5 }}>
                            <span style={{ display: 'block', fontSize: 14 }}>{type}</span>
                            <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{cn}</span>
                        </span>
                    </Background>
                );
            })}
        </div>
        <div style={{ ...labelStyle, marginTop: 24 }}>承载内容（children 渲染在图案之上）</div>
        <Background type="sprinkles" style={{ ...previewBox, padding: 24 }}>
            <span>卡片内容、表单、图表都可以放在这里</span>
        </Background>
        <CodeBlock
            code={`import React from 'react';
import { Background } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* 奶油色波点壁纸（默认） */}
            <Background style={{ height: 200 }} />

            {/* 网格壁纸 */}
            <Background type="grid" style={{ height: 200 }} />

            {/* 深绿波点壁纸 */}
            <Background type="dots-dark-green" style={{ height: 200 }} />

            {/* 彩色针糖壁纸 */}
            <Background type="sprinkles" style={{ height: 200 }} />

            {/* 场景背景图（cover 铺满） */}
            <Background type="sweet-corner" style={{ height: 200 }} />
            <Background type="coffee-break" style={{ height: 200 }} />

            {/* 底色对应 Card pattern-* 系列壁纸 */}
            <Background type="dots-blue" style={{ height: 200 }} />

            {/* 作为内容区块的背景容器 */}
            <Background type="sprinkles" style={{ minHeight: 200, padding: 24 }}>
                <p>内容渲染在图案背景之上</p>
            </Background>
        </div>
    );
};

export default App;`}
        />
        <ApiTable rows={BACKGROUND_API} />
    </div>
);

export default BackgroundDemo;

```

### Core Architecture Module: `demo/components/Button/index.tsx`
```
import React from 'react';
import { SearchIcon, StarIcon } from 'naive-icons';
import { Button } from '../../../src';
import {
    labelStyle,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBodyStyle,
    ApiTable,
    ApiRow,
    CodeBlock,
} from '../../tools';

const BUTTON_API: ApiRow[] = [
    {
        prop: 'type',
        desc: '按钮类型',
        type: `'primary' | 'default' | 'dashed' | 'text' | 'link'`,
        defaultVal: "'default'",
    },
    {
        prop: 'size',
        desc: '按钮尺寸',
        type: `'small' | 'middle' | 'large'`,
        defaultVal: "'middle'",
    },
    {
        prop: 'danger',
        desc: '是否危险按钮',
        type: 'boolean',
        defaultVal: 'false',
    },
    {
        prop: 'ghost',
        desc: '是否幽灵按钮（透明背景）',
        type: 'boolean',
        defaultVal: 'false',
    },
    {
        prop: 'block',
        desc: '是否块级按钮',
        type: 'boolean',
        defaultVal: 'false',
    },
    { prop: 'loading', desc: '加载状态', type: 'boolean', defaultVal: 'false' },
    {
        prop: 'disabled',
        desc: '禁用状态',
        type: 'boolean',
        defaultVal: 'false',
    },
    { prop: 'icon', desc: '图标', type: 'ReactNode', defaultVal: '-' },
    {
        prop: 'htmlType',
        desc: '原生 button type',
        type: `'submit' | 'reset' | 'button'`,
        defaultVal: "'button'",
    },
    { prop: 'children', desc: '按钮内容', type: 'ReactNode', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    {
        prop: '...',
        desc: '继承 React.ButtonHTMLAttributes',
        type: 'HTMLButtonElement',
        defaultVal: '-',
    },
];

const S = {
    row: {
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    } as React.CSSProperties,
};

const ButtonDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Button <DemoTag>6 types</DemoTag>
        </div>
        <div style={demoBodyStyle}>
            <div style={labelStyle}>type 按钮类型</div>
            <div style={S.row}>
                <Button type="primary">Primary</Button>
                <Button>Default</Button>
                <Button type="dashed">Dashed</Button>
                <Button type="text">Text</Button>
                <Button type="link">Link</Button>
            </div>
            <div style={labelStyle}>danger / ghost / loading / disabled 状态</div>
            <div style={S.row}>
                <Button type="primary" danger>
                    Danger
                </Button>
                <Button type="primary" ghost>
                    Ghost
                </Button>
                <Button type="primary" loading>
                    Loading
                </Button>
                <Button type="primary" disabled>
                    Disabled
                </Button>
            </div>
            <div style={labelStyle}>size 尺寸</div>
            <div style={S.row}>
                <Button type="primary" size="small">
                    Small
                </Button>
                <Button type="primary" size="middle">
                    Middle
                </Button>
                <Button type="primary" size="large">
                    Large
                </Button>
            </div>
            <div style={labelStyle}>icon 图标按钮</div>
            <div style={S.row}>
                <Button type="primary" icon={<SearchIcon />}>
                    搜索
                </Button>
                <Button icon={<StarIcon />}>收藏</Button>
                <Button type="dashed" icon={<span>＋</span>}>
                    新增
                </Button>
            </div>
            <div style={labelStyle}>block 块级按钮</div>
            <div style={{ maxWidth: 360 }}>
                <Button type="primary" block>
                    Block Button
                </Button>
            </div>
            <div style={labelStyle}>danger 组合</div>
            <div style={S.row}>
                <Button type="primary" danger>
                    Primary Danger
                </Button>
                <Button danger>Default Danger</Button>
                <Button type="dashed" danger>
                    Dashed Danger
                </Button>
                <Button type="text" danger>
                    Text Danger
                </Button>
                <Button type="link" danger>
                    Link Danger
                </Button>
            </div>
        </div>
        <CodeBlock
            code={`import React from 'react';
import { Button } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* Primary */}
            <Button type="primary">Primary</Button>
            {/* Default */}
            <Button>Default</Button>
            {/* Dashed */}
            <Button type="dashed">Dashed</Button>
            {/* Text */}
            <Button type="text">Text</Button>
            {/* Link */}
            <Button type="link">Link</Button>
            {/* Danger */}
            <Button type="primary" danger>Danger</Button>
            {/* Ghost */}
            <Button type="primary" ghost>Ghost</Button>
            {/* Loading */}
            <Button type="primary" loading>Loading</Button>
            {/* Large */}
            <Button type="primary" size="large">Large</Button>
            {/* Icon */}
            <Button type="primary" icon={<SearchIcon />}>搜索</Button>
            {/* Block */}
            <Button type="primary" block>Block</Button>
        </div>
    );
};

export default App;`}
        />
        <ApiTable rows={BUTTON_API} />
    </div>
);

export default ButtonDemo;

```

### Core Architecture Module: `demo/components/Card/index.tsx`
```
import React from 'react';
import { Card } from '../../../src';
import {
    labelStyle,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBodyStyle,
    ApiTable,
    ApiRow,
    CodeBlock,
} from '../../tools';

const CARD_API: ApiRow[] = [
    {
        prop: 'type',
        desc: '卡片类型',
        type: `'default' | 'dashed'`,
        defaultVal: "'default'",
    },
    {
        prop: 'color',
        desc: '背景颜色类型',
        type: `'default' | 'app-pink' | 'purple' | 'app-blue' | 'app-yellow' | 'app-orange' | 'app-teal' | 'app-green' | 'app-red' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink'`,
        defaultVal: "'default'",
    },
    {
        prop: 'pattern',
        desc: '背景花纹类型',
        type: `'none' | 'default' | 'app-pink' | 'purple' | 'app-blue' | 'app-yellow' | 'app-orange' | 'app-teal' | 'app-green' | 'app-red' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink'`,
        defaultVal: "'none'",
    },
    {
        prop: 'children',
        desc: '自定义内容',
        type: 'ReactNode',
        defaultVal: '-',
    },
    {
        prop: '...',
        desc: '继承 React.HTMLAttributes',
        type: 'HTMLDivElement',
        defaultVal: '-',
    },
];

const S = {
    row: {
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    } as React.CSSProperties,
};

const CardDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Card <DemoTag>2 types</DemoTag> <DemoTag>13 colors</DemoTag> <DemoTag>14 patterns</DemoTag>
        </div>

        {/* ---- type ---- */}
        <div style={demoBodyStyle}>
            <div style={labelStyle}>type="default"</div>
            <div style={S.row}>
                <Card>
                    <p>基础卡片</p>
                </Card>
                <Card style={{ maxWidth: 560, width: '100%' }}>
                    <p>
                        长文本卡片示例：卡片组件适合展示一段介绍文字、列表内容或图文混排信息，内容过长时会自动换行并保持内边距一致。
                    </p>
                </Card>
            </div>
            <div style={labelStyle}>type="dashed"</div>
            <div style={S.row}>
                <Card type="dashed">
                    <p>虚线边框卡片</p>
                </Card>
                <Card type="dashed" style={{ maxWidth: 360, width: '100%' }}>
                    <p>欢迎来到小岛！虚线边框适合用于轻量提示或次要信息展示。</p>
                </Card>
            </div>
            <div style={labelStyle}>hoverable 启用 hover(默认关闭)</div>
            <div style={S.row}>
                <Card hoverable style={{ width: 260 }}>
                    <p>鼠标移上来看看 ↑</p>
                </Card>
            </div>
        </div>
        {/* ---- pattern ---- */}
        <div style={{ ...demoBodyStyle, gap: 24 }}>
            <div style={labelStyle}>pattern — 风格花纹</div>
            <div style={S.row}>
                <Card pattern="default" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>default</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>默认奶油色</div>
                </Card>
                <Card pattern="app-pink" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-pink</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用粉</div>
                </Card>
                <Card pattern="purple" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>purple</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>紫色</div>
                </Card>
                <Card pattern="app-blue" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-blue</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用蓝</div>
                </Card>
                <Card pattern="app-yellow" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-yellow</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用黄</div>
                </Card>
                <Card pattern="app-orange" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-orange</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用橙</div>
                </Card>
                <Card pattern="app-teal" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-teal</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用青</div>
                </Card>
                <Card pattern="app-green" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-green</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用绿</div>
                </Card>
                <Card pattern="app-red" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>app-red</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>应用红</div>
                </Card>
                <Card pattern="lime-green" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>lime-green</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>青柠绿</div>
                </Card>
                <Card pattern="yellow-green" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>yellow-green</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>黄绿色</div>
                </Card>
                <Card pattern="brown" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>brown</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>棕色</div>
                </Card>
                <Card pattern="warm-peach-pink" style={{ width: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>warm-peach-pink</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>暖桃粉</div>
                </Card>
            </div>
        </div>

        {/* ---- color variants ---- */}
        <div style={demoBodyStyle}>
            <div style={labelStyle}>color</div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                {(
                    [
                        ['default', 'Default', '默认奶油色'],
                        ['app-pink', 'App Pink', '应用粉'],
                        ['purple', 'Purple', '紫色'],
                        ['app-blue', 'App Blue', '应用蓝'],
                        ['app-yellow', 'App Yellow', '应用黄'],
                        ['app-orange', 'App Orange', '应用橙'],
                        ['app-teal', 'App Teal', '应用青'],
                        ['app-green', 'App Green', '应用绿'],
                        ['app-red', 'App Red', '应用红'],
                        ['lime-green', 'Lime Green', '青柠绿'],
                        ['yellow-green', 'Yellow-Green', '黄绿色'],
                        ['brown', 'Brown', '棕色'],
                        ['warm-peach-pink', 'Warm Peach Pink', '暖桃粉'],
                    ] as const
                ).map(([color, en, cn]) => (
                    <Card key={color} color={color as any} style={{ padding: '16px 20px' }}>
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: 14,
                                marginBottom: 4,
                            }}
                        >
                            {en}
         
```

### Core Architecture Module: `demo/components/Carousel/index.tsx`
```
import React from 'react';
import { Carousel } from '../../../src';
import { ApiRow, ApiTable, CodeBlock, DemoTag, labelStyle, sectionStyle, sectionTitleStyle } from '../../tools';
import hillsideTown from '../../assets/images/hillside-town.jpg';
import sunnyField from '../../assets/images/sunny-field.jpg';
import lakeMorning from '../../assets/images/lake-morning.jpg';

const CAROUSEL_API: ApiRow[] = [
    { prop: 'children', desc: '每个直接子元素为一张', type: 'ReactNode', defaultVal: '-', required: true },
    { prop: 'activeIndex', desc: '当前索引（受控）', type: 'number', defaultVal: '-' },
    { prop: 'defaultActiveIndex', desc: '初始索引', type: 'number', defaultVal: '0' },
    { prop: 'onChange', desc: '切换回调', type: '(index: number) => void', defaultVal: '-' },
    { prop: 'autoplay', desc: '自动播放', type: 'boolean', defaultVal: 'false' },
    { prop: 'interval', desc: '自动播放间隔（ms）', type: 'number', defaultVal: '3000' },
    { prop: 'loop', desc: '首尾循环', type: 'boolean', defaultVal: 'true' },
    { prop: 'showArrows', desc: '显示箭头', type: 'boolean', defaultVal: 'true' },
    { prop: 'showDots', desc: '显示圆点', type: 'boolean', defaultVal: 'true' },
    { prop: 'pauseOnHover', desc: '悬停或聚焦时暂停', type: 'boolean', defaultVal: 'true' },
];

const slides = [
    { src: hillsideTown, title: '山坡小筑', desc: '沿坡而建的小镇，屋顶连成一片暖色。' },
    { src: sunnyField, title: '阳光田野', desc: '风掠过田野，草浪一层层推向天边。' },
    { src: lakeMorning, title: '晨光湖面', desc: '湖面倒映天光，晨雾如薄纱浮在水上。' },
];

const CarouselDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Carousel <DemoTag>轮播图</DemoTag> <DemoTag>键盘可用</DemoTag>
        </div>

        <div style={labelStyle}>自动播放（悬停或聚焦时暂停）</div>
        <Carousel autoplay interval={3500} aria-label="岛屿风景" style={{ maxWidth: 760 }}>
            {slides.map((slide) => (
                <div
                    key={slide.title}
                    style={{
                        minHeight: 360,
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: 28,
                        boxSizing: 'border-box',
                        color: '#fff9e3',
                        background: `linear-gradient(0deg, rgba(43,33,24,.72), transparent 62%), url(${slide.src}) center / cover`,
                    }}
                >
                    <div style={{ paddingBottom: 30 }}>
                        <div style={{ fontSize: 26, fontWeight: 900 }}>{slide.title}</div>
                        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>{slide.desc}</div>
                    </div>
                </div>
            ))}
        </Carousel>

        <CodeBlock
            code={`import { Carousel } from 'animal-island-ui';

<Carousel autoplay interval={3500} aria-label="岛屿照片">
    <img src="/beach.jpg" alt="海滩" />
    <img src="/plaza.jpg" alt="广场" />
    <img src="/museum.jpg" alt="博物馆" />
</Carousel>`}
        />
        <ApiTable rows={CAROUSEL_API} />
    </div>
);

export default CarouselDemo;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #55** (2026-09-04): **Question: Why animal‑island‑vue has more components in demo than animal‑island‑ui, and WeddingInvitation component missing in export of v1.0.0**
  *Symptoms*: ## Question  According to the readme of [animal-island-vue](https://github.com/guokaigdg/animal-island-vue): > This project is a lightweight UI component library built with Vue 3 + TypeScript + Less. It is the Vue port of [animal-island-ui](https://github.com/guokaigdg/animal-island-ui), with a design style inspired by Nintendo's "Animal Crossing: New Horizons" game interface, created for personal front-end technical practice and component development learning. > All visual elements, layouts, icons, and animations are independently designed and implemented, without directly using any official Nintendo art materials, code, or resource files.  It describes animal‑island‑vue as the Vue port of animal‑island‑ui (React version). But I found two confusing points:  1. The online demo of animal‑island‑vue (PC): https://guokaigdg.github.io/animal-island-vue shows **more components** than the React version demo: https://guokaigdg.github.io/animal-island-ui/#/. Why does the Vue port contain more components than the original React version?  2. I installed the latest `animal-island-vue@1.0.0` package. The `WeddingInvitation` component exists in the online documentation demo, but I cannot find its export in the installed package. Is this component not yet published or exported?  Thanks. 
  **Post-Mortem & Fix Analysis**:
  > Sorry, the WeddingInvitation component has been removed for now. It is only present in the historical demo page and is not exported or included in the published npm package.

- **Issue #54** (2026-09-05): **feat: Proposal to add ananimated prop to the Footer component for dynamic sea elements**
  *Symptoms*: ### Is your feature request related to a problem? Please describe. Currently, the `<Footer type="sea" />` component renders a static SVG background. While it looks great, it lacks the lively, cozy, and dynamic vibe that is characteristic of the cozy island aesthetic. Users (including myself) often want to make elements like the sailboat, whale, geese, and漂流瓶 (drift bottle) move subtly to bring the page to life.  ### Describe the solution you'd like I propose adding an `animated` boolean prop to the `Footer` component. When `animated={true}` (or as a new type like `type="sea-animated"`), the component would render an inline SVG instead of a background image. This allows us to attach lightweight CSS `@keyframes` to specific SVG elements (e.g., `<path className="whale">`) to create subtle, looping animations: - 🚢 **Sailboat**: Gentle bobbing and slight rocking. - 🐋 **Whale**: Slow, smooth vertical floating. - 🕊️ **Geese**: Subtle horizontal gliding. - 🍾 **Bottle**: Light swaying with the "waves".  ### Describe alternatives you've considered 1. Developers manually inlining the SVG and adding CSS animations themselves (which is tedious and hard to maintain if the base SVG updates). 2. Using Lottie or GIFs (which would significantly increase the bundle size and hurt performance).  ### Additional context This approach keeps the bundle size minimal (no new image assets needed, just a few bytes of CSS) while greatly enhancing the user experience. I would love to hear the maintaine
  **Post-Mortem & Fix Analysis**:
  > Awesome idea! PR is welcome. Please maintain backward‑compatibility for the existing static sea footer.

- **Issue #53** (2026-08-26): **fix: 修复倒计时归零后 setInterval 仍在运行的问题**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Improved countdown timer behavior when reaching zero.   * Prevented unnecessary interval activity after the countdown finishes.   * Ensured timer cleanup occurs reliably when the countdown is stopped or reset.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/53?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The pull request permits `esbuild` build scripts in pnpm and updates the countdown effect to stop at zero and clean up intervals.  ### Changes  **Countdown lifecycle**  |Layer / File(s)|Summary| |---|---| |**Countdown interval lifecycle** <br> `src/components/Countdown/Countdown.tsx`|The effect starts polling only when time remains, stops the interval at zero, and clears active intervals during cleanup. A comment documents zero-padding behavior.|  **Build permissions**  |Layer / File(s)|Summary| |---|-

- **Issue #52** (2026-08-21): **feat: 新增倒计时和轮播图组件，并为 CodeBlock 添加复制功能**
  *Symptoms*: ## 变更说明  本次 PR 新增了 `Countdown` 倒计时组件和 `Carousel` 轮播图组件，同时完善了 `CodeBlock` 的代码复制能力，并同步更新 Demo、组件导出、测试与中英文文档。  ## 新增 Countdown 组件  新增一个可直接使用的倒计时组件，支持：  - 使用时间戳或 `Date` 对象设置目标时间 - 通过 `format` 自定义显示格式 - 支持 `DD`、`HH`、`mm`、`ss` 时间占位符 - 提供 `small`、`middle`、`large` 三种尺寸 - 提供 `default` 和 `island` 两种视觉样式 - 支持自定义前缀内容 - 通过 `onChange` 获取剩余毫秒数 - 倒计时结束时触发一次 `onFinish` - 提供 `role="timer"` 等无障碍语义  ## 新增 Carousel 组件  新增轮播图组件，支持：  - 受控和非受控索引 - 自动播放及自定义播放间隔 - 显式暂停和继续播放控制 - 鼠标悬停时暂停播放 - 键盘焦点进入时暂停播放 - 左右箭头切换 - 圆点指示器切换 - 循环和非循环模式 - 隐藏箭头或指示器 - `ArrowLeft`、`ArrowRight`、`Home`、`End` 键盘导航 - 完整的 Carousel、Slide 及位置数量无障碍语义 - `prefers-reduced-motion` 减少动画支持  自动播放控制会根据实际播放状态显示准确的“暂停”或“播放”状态。用户通过键盘进入轮播区域后，自动播放会暂停，也可以使用播放控制显式恢复。  ## 完善 CodeBlock 复制功能  为现有 `CodeBlock` 增加代码复制能力：  - 默认显示复制按钮 - 点击后将完整代码写入剪贴板 - 提供复制成功和失败状态反馈 - 支持通过 `copyable={false}` 隐藏复制按钮 - 提供 `onCopy` 回调 - 在 Clipboard API 不可用时使用兼容降级方案 - 降级复制失败或发生异常时也会清理临时 DOM 节点 - 兼容自定义宽度、最小/最大宽度及外边距，确保复制按钮始终附着在代码块上  ## Demo 与文档  本次变更同步完成了：  - 注册 Countdown 和 Carousel Demo 页面 - 更新 CodeBlock Demo - 更新组件首页和侧边导航 - 更新统一组件导出 - 更新英文设计系统文档 - 更新中文设计系统文档 - 更新组件使用 Skill 引用 - 更新组件数量、测试数量及覆盖率徽章  ## 测试  新增和完善了以下测试：  - Countdown 格式化、归零及回调测试 - Carousel 切换、自动播放、暂停恢复、键盘导航及受控模式测试 - CodeBlock Clipboard API、兼容复制、失败反馈及异常清理测试 - Countdown 和 Carousel 无障碍测试  验证结果：  - 493 条单元测试全部通过 - 36 条无障碍测试全部通过 - 行覆盖率：92.84% - 文档同步检查通过 - ESLint 检查通过，无错误 - TypeScript 声明构建通过 - Vite 生产构建通过  ## 兼容性与依赖  - 没有增加新的运行时依赖 - 保持现有 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/52?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The PR adds Countdown and Carousel components, adds copy-to-clipboard support to CodeBlock, and updates public exports, demos, accessibility tests, badges, and design-system references.  ### Changes  **Component features**  |Layer / File(s)|Summary| |---|---| |**CodeBlock copy behavior** <br> `src/components/CodeBlock/...`, `demo/components/CodeBlock/...`, `docs/.../data-display.md`, `skills/.../data-display.md`|CodeBlock adds clipboard copying, fallback handling, status feedback, optional controls, st

- **Issue #51** (2026-08-01): **docs: 增加 animal-island-uniapp 使用案例**
  *Symptoms*: 增加了 animal-island-uniapp（动森风格 uni-app 组件库）的使用案例展示，并在主库的 README.md 与中文版 README.zh-CN.md 中补充了入口，同时上传了 3:2 格式的预览图。  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added the `animal-island-uniapp` project to the usage cases list.   * Included its preview image, project link, and description in both English and Chinese documentation.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/51?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `e918baf1-a773-4082-a5e0-ace4ccd13a8c`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 58eb8fe839ccf6dc4db170b57a90a647b2c93609 and 3c164fd7ac0f2894e5e13282ec784f9844bdc4d2.  </details>  <details> <summary>⛔ Files ignored due to path filters (1)</summary>  * `docs/

- **Issue #50** (2026-07-30): **docs: add contribution leaderboard badge to README**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added new featured usage examples to the showcase sections.   * Included preview images and direct links for the newly added “无人岛性格测试” case.   * Updated both the English and Chinese documentation pages.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/50?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `61ee5d49-acf4-439b-a8d1-31e72c0aa482`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between dbde5e746d86881b5577999285a173ac25a3c297

- **Issue #49** (2026-07-30): **分享：把项目移植成了 uni-app (Vue3 + TS) 版本**
  *Symptoms*: 作者你好，非常喜欢你设计的动森风格 UI。  我最近把这个项目移植成了 uni-app 版本（基于 Vue3 + TS），适配了小程序、H5 和 App，目前已经移植了 20 个组件，并配好了对应的 Demo 演示。  项目地址：https://github.com/leepule/animal-island-uniapp  发个 Issue 给有需要的小伙伴分享一下。如果合适的话，也欢迎作者把链接挂在 README 的相关项目里，感谢！ 
  **Post-Mortem & Fix Analysis**:
  >  自行添加提个PR，封面尺寸3；2，注意中英双板同步添加。

- **Issue #48** (2026-07-28): **docs: fix stale component specs surfaced by CodeRabbit review on #47**
  *Symptoms*: ## Why  Follow-up to #47. CodeRabbit left 17 review findings on that PR; #47 was merged before the fix commit landed on its branch, so the fixes ship here. Every finding was verified against the component source (`src/components/**`) first: 11 were real — almost all legacy spec text that already contradicted the current source and was carried over verbatim by the restructure — and 6 were incorrect and rejected with evidence in [this PR comment](https://github.com/guokaigdg/animal-island-ui/pull/47#issuecomment-5105128511).  接续 #47。CodeRabbit 在该 PR 上留下 17 条 review 意见；#47 在修复 commit 推上分支之前就已合并，因此修复由本 PR 补交。 所有意见先逐条对照组件源码（`src/components/**`）核实：11 条属实 —— 基本都是旧规范文档里早已与源码矛盾、被重构原样搬运的内容；6 条不成立，驳回理由与证据见 [PR 评论](https://github.com/guokaigdg/animal-island-ui/pull/47#issuecomment-5105128511)。   ### Expected gains  The design-system documents were introduced in #47 as the single source of truth; this PR removes the places where they still disagreed with the source code, so agents and contributors reading them no longer inherit stale values (wrong icon names, wrong radii, wrong animation directions). The rejected findings are recorded with evidence, so the same review points don't resurface unanswered on future PRs.  design-system 文档在 #47 中被确立为 single source of truth；本 PR 消除了其中仍与源码相悖的残留，读文档的 Agent 与贡献者不会再继承过时取值（错误图标名、错误圆角、反向动画）。被驳回的意见连同证据留档，后续 PR 再遇到同类评论时有据可查。   ## What's fixed  Each fix is applied to both the English document and its `docs/zh-CN/` mirror, with source as 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/48?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  Documentation was updated to align synchronization rules, English and Chinese design-system references, component behavior specifications, Cursor API guidance, typography loading instructions, and switch-toggle visual prompts.  ### Changes  **Documentation alignment**  | Layer / File(s) | Summary | |---|---| | **Documentation synchronization contract** <br> `AGENTS.md`, `docs/adr/0004-docs-sync-automation.md`, `docs/zh-CN/adr/0004-docs-sync-automation.md` | Cross-file reference rules and docs-sync vali
  > @coderabbitai All three round-2 findings verified against source and addressed in 0dcd768:  1. **ADR 0004 parity consequence** — valid: the earlier fix corrected the Decision section but the Consequences bullet still claimed "same component sections". Both mirrors now state file-level parity only, with the explicit caveat that mirror contents are not inspected. 2. **Checkbox SVG markup vs selector** — valid, but the correct direction is the opposite of the suggested selector change: `Checkbox.tsx` renders `<svg className={styles.check}><path d="M2 8.36364L6.23077 12L13 2" /></svg>`, so `.check path` is the accurate selector and the loose word "polyline" in the prose was the defect. Prose fixed in both mirrors; selector untouched. 3. **Scoped Cursor selectors** — valid: the block sampled one selector per group with the full list in comments, which invites literal copy-paste that drops button/input semantics. Expanded to the complete selector groups verbatim from `cursor.css` in both mir
  > <!-- This is an auto-generated reply by CodeRabbit --> > [!TIP] > For best results, initiate chat on the files or code changes.  `@zthxxx` Thanks for the thorough verification and corrections. The three round-2 findings are addressed in `0dcd768`, including the corrected file-level-only parity wording, the accurate Checkbox `<path>` terminology, and complete scoped Cursor selector groups in both documentation mirrors.  <!-- <review_comment_addressed> -->     ---  <details> <summary>✏️ Learnings added</summary>  ``` Learnt from: zthxxx URL: https://github.com/guokaigdg/animal-island-ui/pull/48  Timestamp: 2026-07-28T14:32:35.765Z Learning: For `Checkbox.tsx`, the checkmark markup is `<svg className={styles.check}><path ... /></svg>`. Documentation should describe it as an SVG path, and the matching CSS selector is `.check path`; it is not a polyline. ```  ---  ``` Learnt from: zthxxx URL: https://github.com/guokaigdg/animal-island-ui/pull/48  Timestamp: 2026-07-28T14:32:35.765Z Learning

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

### Incident Patch 1: `29051196` (2026-09-24)
**Commit Message**: chore(release): fix version to 2.0.0 and align README intro copy

- package.json version was left at 1.14.0 while lockfile/CHANGELOG
  already read 2.0.0; sync it so the published package matches
- Trim README and zh-CN intro to drop the personal-learning tagline

**File**: `README.md` (modified, +9/-24)
```diff
@@ -13,13 +13,12 @@ A React UI component library with a cute style
 <div align="center">
     <a href="https://github.com/guokaigdg/animal-island-ui/stargazers"><img src="https://img.shields.io/github/stars/guokaigdg/animal-island-ui?style=flat-square" alt="Stars"></a>
     <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange.svg?style=flat-square" alt="License: MIT"></a>
-    <a href="LICENSE"><img src="https://img.shields.io/npm/dm/animal-island-ui.svg?style=flat-square" alt=""></a>
-    <a href="https://github.com/guokaigdg/animal-island-ui/releases"><img src="https://img.shields.io/github/v/tag/guokaigdg/animal-island-ui?label=version&style=flat-square" alt="Version"></a>
+    <a href="https://www.npmjs.com/package/animal-island-ui"><img src="https://img.shields.io/npm/dm/animal-island-ui.svg?style=flat-square" alt="Weekly downloads"></a>
+    <a href="https://www.npmjs.com/package/animal-island-ui"><img src="https://img.shields.io/npm/v/animal-island-ui?label=version&style=flat-square" alt="Version"></a>
     <a href="https://atomgit.com/guokaigdg/animal-island-ui"><img alt="AtomGit Star" src="https://atomgit.com/guokaigdg/animal-island-ui/star/badge.svg"></a>
     <br/>
     <a href="./coverage/badges/coverage.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/guokaigdg/animal-island-ui/main/coverage/badges/coverage.json&style=flat-square" alt="Coverage"></a>
-    <img src="https://img.shields.io/badge/tests-516%20✓-brightgreen?style=flat-square" alt="Tests">
-    <img src="https://img.shields.io/badge/components-34-blue?style=flat-square" alt="Components">
+    <img src="https://img.shields.io/badge/components-35-blue?style=flat-square" alt="Components">
     <img src="https://img.shields.io/badge/a11y-WAI--ARIA%20APG-brightgreen?style=flat-square" alt="Accessibility">
 </div>
 <br/>
@@ -36,12 +35,11 @@ A React UI component library with a cute style
 
 ## Introduction
 
-This project is a lightweight UI component library built with React + TypeScript. It features an original, cozy island-style design language, created for personal front-end technical practice and component development learning.All visual elements, layouts, icons, and animations are independently designed and implemented from scratch.
+This project is a lightweight UI component library built with React + TypeScript. It features an original, cozy island-style design language. All visual elements, layouts, icons, and animations are independently designed and implemented from scratch.
 
 ## Preview
 
-- Online Preview (PC) [animal-island-ui-pc](https://guokaigdg.github.io/animal-island-ui/#/)
-- Online Preview (Mobile) [animal-island-ui-mobile](https://guokaigdg.github.io/animal-island-ui/#/)
+- Online Preview: [animal-island-ui](https://guokaigdg.github.io/animal-island-ui/#/)
 
 ## Icons
 
@@ -129,32 +127,19 @@ npm run build
 npm run build:demo
 ```
 
-## Notes
-
-- This project is open-source and distributed under the MIT License — free to use, modify, and distribute, including for commercial purposes (see the [LICENSE](LICENSE) file).
-- Users are solely responsible for any risks arising from the use of this component library.
-
-## Copyright and Disclaimer
+## License & Disclaimer
 
+- Distributed under the **MIT License** — free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the Software, including in commercial products (see the [LICENSE](LICENSE) file for the full text). The copyright notice and this permission notice must be included in all copies or substantial portions of the Software.
+- The Software is provided "AS IS", without warranty of any kind; the authors are not liable for any claims, damages, or other liability arising from its use. Users are solely responsible for any risks arising from the use of this component library.
 - This is an independently created open-source project. It is not an official product of any game company and has no associat
```

**File**: `docs/README.zh-CN.md` (modified, +9/-30)
```diff
@@ -6,25 +6,19 @@
 </div>
 <br/>
 
-<div align="center">
-需要图标？使用 **naive-icons** → <a href="https://github.com/guokaigdg/naive-icons">github.com/guokaigdg/naive-icons</a>
-</div>
-<br/>
-
 <div align="center">
 一款可爱风格的 React UI 组件库
 </div>
 <br/>
 <div align="center">
     <a href="https://github.com/guokaigdg/animal-island-ui/stargazers"><img src="https://img.shields.io/github/stars/guokaigdg/animal-island-ui?style=flat-square" alt="Stars"></a>
     <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange.svg?style=flat-square" alt="License: MIT"></a>
-    <a href="LICENSE"><img src="https://img.shields.io/npm/dm/animal-island-ui.svg?style=flat-square" alt=""></a>
-    <a href="https://github.com/guokaigdg/animal-island-ui/releases"><img src="https://img.shields.io/github/v/tag/guokaigdg/animal-island-ui?label=version&style=flat-square" alt="Version"></a>
+    <a href="https://www.npmjs.com/package/animal-island-ui"><img src="https://img.shields.io/npm/dm/animal-island-ui.svg?style=flat-square" alt="Weekly downloads"></a>
+    <a href="https://www.npmjs.com/package/animal-island-ui"><img src="https://img.shields.io/npm/v/animal-island-ui?label=version&style=flat-square" alt="Version"></a>
     <a href="https://atomgit.com/guokaigdg/animal-island-ui"><img alt="AtomGit Star" src="https://atomgit.com/guokaigdg/animal-island-ui/star/badge.svg"></a>
     <br/>
     <a href="../coverage/badges/coverage.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/guokaigdg/animal-island-ui/main/coverage/badges/coverage.json&style=flat-square" alt="Coverage"></a>
-    <img src="https://img.shields.io/badge/tests-516%20✓-brightgreen?style=flat-square" alt="Tests">
-    <img src="https://img.shields.io/badge/components-34-blue?style=flat-square" alt="Components">
+    <img src="https://img.shields.io/badge/components-35-blue?style=flat-square" alt="Components">
     <img src="https://img.shields.io/badge/a11y-WAI--ARIA%20APG-brightgreen?style=flat-square" alt="Accessibility">
 </div>
 <br/>
@@ -40,12 +34,11 @@
 
 ## 介绍
 
-本项目是基于 React + TypeScript 实现的轻量 UI 组件库，采用原创的治愈系海岛风格设计语言，用于个人前端技术练习与组件化开发学习。所有视觉元素、布局、图标、动画均为本项目独立设计实现。
+本项目是基于 React + TypeScript 实现的轻量 UI 组件库，采用原创的治愈系海岛风格设计语言。所有视觉元素、布局、图标、动画均为本项目独立设计实现。
 
 ## 预览
 
-- 在线预览 (PC 端) [animal-island-ui-pc](https://guokaigdg.github.io/animal-island-ui/#/)
-- 在线预览（移动端）[animal-island-ui-mobile](https://guokaigdg.github.io/animal-island-ui/#/)
+- 在线预览：[animal-island-ui](https://guokaigdg.github.io/animal-island-ui/#/)
 
 ## 图标
 
@@ -132,33 +125,19 @@ npm run build
 npm run build:demo
 ```
 
-## 注意事项
-
-- 本项目为开源项目，采用 MIT 协议发布 —— 可自由使用、修改与分发，包括商业用途（见 [LICENSE](../LICENSE) 文件）。
-- 与任何游戏公司及其产品无关联、授权或合作关系。
-- 使用本组件库产生的任何风险由使用者自行承担。
-
-## 版权与免责声明
+## 许可与免责声明
 
+- 本项目基于 **MIT 协议**发布 —— 可自由使用、复制、修改、合并、发布、分发、再许可及出售本软件副本，包括商业用途（完整文本见 [LICENSE](../LICENSE) 文件）。须在所有副本或实质部分中保留上述版权声明与本许可声明。
+- 本软件按「原样」提供，不附带任何担保；作者不对其使用产生的任何索赔、损失或其他责任负责，使用本组件库产生的任何风险由使用者自行承担。
 - 本项目为独立创作的开源项目，并非任何游戏公司的官方产品，与任何公司及其产品无关联、授权或合作关系。
 - 本仓库内所有视觉素材（图标、插画、动画）均为本项目原创作品。
-- 若版权方认为相关内容存在侵权嫌疑，可通过邮箱联系，本人将在第一时间进行整改或删除处理。
 
 ## 联系方式
 
-如有问题或版权相关沟通，请通过 Issue 或邮件联系。
+如有问题，欢迎提交 GitHub [Issue](https://github.com/guokaigdg/animal-island-ui/issues)。
 
 ## 给小岛续续航
 
 如果这个项目对你有帮助，不妨请开发者的猫吃个罐罐——喵星人才是小岛运转的真正燃料
 
 [赞助小岛](https://guokaigdg.github.io/home/payment.html)
-
-## License
-
-**MIT License** — 完整文本见 [LICENSE](../LICENSE) 文件。
-
-- **授权范围**：可自由使用、复制、修改、合并、发布、分发、再许可及出售本软件副本。
-- **无限制**：包括商业产品中的使用。
-- **保留要求**：须在所有副本或实质部分中保留上述版权声明与本许可声明。
-- 本软件按「原样」提供，不附带任何担保；作者不对其使用产生的任何索赔、损失或其他责任负责。
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "animal-island-ui",
-    "version": "1.14.0",
+    "version": "2.0.0",
     "description": "A nature-inspired React component library",
     "type": "module",
     "main": "dist/cjs/index.cjs",
```

---

### Incident Patch 2: `aaf3ea98` (2026-09-24)
**Commit Message**: fix(progress): make variant optional, default to solid fill

- Remove the default value so an unspecified variant renders a solid
  teal fill (#19c8b9) instead of the sweet-corner scene
- Provide the scene image only when variant is passed
- Sync types and EN/zh/skill feedback docs

**File**: `demo/components/Progress/index.tsx` (modified, +3/-3)
```diff
@@ -59,9 +59,9 @@ const PROGRESS_API: ApiRow[] = [
     { prop: 'showInfo', desc: '是否显示百分比文字（显示在进度条右侧）', type: 'boolean', defaultVal: 'true' },
     {
         prop: 'variant',
-        desc: 'fill 背景场景图（当前进度区域显示该场景，从左揭开）',
+        desc: 'fill 背景场景图（传时当前进度区域显示该场景，从左揭开；不传为纯色 #19c8b9）',
         type: `'sweet-corner' | 'forest-grove' | 'starry-camp' | 'coffee-break'`,
-        defaultVal: "'sweet-corner'",
+        defaultVal: '-（不传纯色 fill）',
     },
     { prop: 'infoFormat', desc: '自定义文字格式化', type: '(percent: number) => ReactNode', defaultVal: '${percent}%' },
     { prop: 'duration', desc: 'fill 宽度动画时长(秒),0 = 不动画', type: 'number', defaultVal: '0.6' },
@@ -224,7 +224,7 @@ const App = () => {
             <Progress percent={50} size="small" />
             <Progress percent={50} size="large" />
 
-            {/* fill 背景场景图（sweet-corner 默认） */}
+            {/* fill 背景场景图（传 variant 时生效；不传为纯色） */}
             <Progress percent={50} variant="forest-grove" />
 
             {/* 自定义格式化 (例如: 5/10 任务) */}
```

**File**: `docs/design-system/components/feedback.md` (modified, +3/-3)
```diff
@@ -2,10 +2,10 @@
 
 Exact values for the components that report progress or pending state: Progress, Skeleton and BackTop.
 
-## Progress (scene-image fill on dotted track)
+## Progress (scene or solid fill on dotted track)
 
 Source: `src/components/Progress/Progress.tsx` (controlled rendering + aria wiring) + `types.ts` (type definitions) + `progress.module.less`.
-**A JSX component** (not imperative): `percent` is passed in controlled and animates smoothly from 0 to the target value. The track is a cream dotted pill with an inner shadow; the fill is a scene image (`sweet-corner.svg` by default) injected inline at `background-size` equal to the full track width so the scene spans the whole bar. The label always sits right of the bar.
+**A JSX component** (not imperative): `percent` is passed in controlled and animates smoothly from 0 to the target value. The track is a cream dotted pill with an inner shadow; when a `variant` is passed the fill is a scene image (`sweet-corner.svg`, `forest-grove.svg`, …) injected inline at `background-size` equal to the full track width so the scene spans the whole bar, while omitting `variant` falls back to a solid teal fill (`#19c8b9`). The label always sits right of the bar.
 
 **props**:
 ```ts
@@ -16,7 +16,7 @@ interface ProgressProps {
     percent: number;            // required, 0-100, auto-clamped; non-integers are rounded for aria
     size?: ProgressSize;        // small=14px / middle=24px / large=32px
     showInfo?: boolean;         // default true; label sits right of the bar
-    variant?: ProgressVariant;  // scene image for the fill; default 'sweet-corner'
+    variant?: ProgressVariant;  // scene image for the fill; omit to use solid #19c8b9
     infoFormat?: (p: number) => ReactNode; // default `${p}%`
     duration?: number;          // seconds; 0 disables the fill width animation; default 0.6
     className?: string;
```

**File**: `docs/zh-CN/design-system/components/feedback.md` (modified, +3/-3)
```diff
@@ -2,10 +2,10 @@
 
 反馈进度与等待状态的组件：Progress、Skeleton、BackTop 的精确取值
 
-## Progress（场景图 fill + 波点 track）
+## Progress（场景图或纯色 fill + 波点 track）
 
 源码：`src/components/Progress/Progress.tsx`（受控渲染 + aria 适配）+ `types.ts`（类型定义）+ `progress.module.less`。
-**JSX 组件**（非命令式）：`percent` 受控传入，从 0 平滑动画到目标值。track 是奶油色波点 pill 带内阴影、无边框；fill 是场景图（默认 `sweet-corner.svg`）由组件内联注入，`background-size` 等于整条轨道宽度，场景铺满整条轨道。百分比文字固定显示在进度条右侧。
+**JSX 组件**（非命令式）：`percent` 受控传入，从 0 平滑动画到目标值。track 是奶油色波点 pill 带内阴影、无边框；传 `variant` 时 fill 是场景图（`sweet-corner.svg`、`forest-grove.svg` …）由组件内联注入，`background-size` 等于整条轨道宽度，场景铺满整条轨道；未传 `variant` 时 fill 回退为纯青色（`#19c8b9`）。百分比文字固定显示在进度条右侧。
 
 **props**：
 ```ts
@@ -16,7 +16,7 @@ interface ProgressProps {
     percent: number;            // required, 0-100, auto-clamped; non-integers are rounded for aria
     size?: ProgressSize;        // small=14px / middle=24px / large=32px
     showInfo?: boolean;         // default true；文字显示在进度条右侧
-    variant?: ProgressVariant;  // fill 场景图；default 'sweet-corner'
+    variant?: ProgressVariant;  // fill 场景图；不传时用纯青色 #19c8b9
     infoFormat?: (p: number) => ReactNode; // default `${p}%`
     duration?: number;          // seconds; 0 disables the fill width animation; default 0.6
     className?: string;
```

**File**: `skills/animal-island-ui-style/references/components/feedback.md` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@ Props/types below are copied from the library source. In an npm-installed projec
 
 ## Progress
 
-Horizontal bar whose fill is a **scene image** (`sweet-corner.svg` default) injected inline at `background-size` equal to the full track width, so the scene spans the whole bar; the fill is clipped from the left by progress width ("unveils from the left"). The track is a **cream dotted** pill (`#f8f8f0` + two cream radial-dot layers, same as Background default / Card pattern-default) with a soft inner dent and no border. The percent label always sits **right of the bar**.
+Horizontal bar whose fill defaults to a **solid teal** (`#19c8b9`); when a `variant` is passed it becomes a **scene image** (`sweet-corner.svg`, `forest-grove.svg`, …) injected inline at `background-size` equal to the full track width, so the scene spans the whole bar; the fill is clipped from the left by progress width ("unveils from the left"). The track is a **cream dotted** pill (`#f8f8f0` + two cream radial-dot layers, same as Background default / Card pattern-default) with a soft inner dent and no border. The percent label always sits **right of the bar**.
 
 ```ts
 type ProgressSize = 'small' | 'middle' | 'large';
@@ -14,7 +14,7 @@ interface ProgressProps {
     percent: number; // REQUIRED, 0-100, clamped; non-integer rounded for aria
     size?: ProgressSize; // default 'middle' (small=14px, middle=24px, large=32px)
     showInfo?: boolean; // default true; label sits right of the bar
-    variant?: ProgressVariant; // fill scene image; default 'sweet-corner'
+    variant?: ProgressVariant; // fill scene image; omit to use solid #19c8b9
     infoFormat?: (percent: number) => React.ReactNode; // default `${percent}%`
     duration?: number; // fill WIDTH transition in seconds; 0 disables; default 0.6
     className?: string;
@@ -24,7 +24,7 @@ interface ProgressProps {
 
 ```tsx
 <Progress percent={50} size="large" />
-<Progress percent={45} variant="forest-grove" />          {/* default variant 'sweet-corner' */}
+<Progress percent={45} variant="forest-grove" />          {/* no variant = solid #19c8b9 fill */}
 <Progress percent={50} infoFormat={(p) => `${Math.round(p / 10)} / 10`} />
 <Progress percent={pct} duration={0} />                   {/* no fill-width animation */}
 <Progress percent={66} showInfo={false} />
```

**File**: `src/components/Progress/Progress.tsx` (modified, +10/-6)
```diff
@@ -23,7 +23,7 @@ const SIZE_CLASS: Record<ProgressSize, string> = {
 export const Progress: React.FC<ProgressProps> = ({
     percent,
     size = 'middle',
-    variant = 'sweet-corner',
+    variant,
     showInfo = true,
     infoFormat,
     duration = 0.6,
@@ -63,11 +63,15 @@ export const Progress: React.FC<ProgressProps> = ({
     const inlineFillStyle: React.CSSProperties = {
         width: `${safePercent}%`,
         transitionDuration: `${duration}s`,
-        // 图片宽度固定为整条轨道宽度（取上部，不拉伸变形）；fill 自身 overflow hidden 按进度宽度裁剪左侧 = 从左揭开
-        backgroundImage: `url(${VARIANT_BG[variant]})`,
-        backgroundRepeat: 'no-repeat',
-        backgroundPosition: 'left top',
-        backgroundSize: trackW > 0 ? `${trackW}px auto` : '100% auto',
+        // 传入 variant 时用场景图铺满（从左揭开）；未传时用纯色 fill
+        ...(variant
+            ? {
+                  backgroundImage: `url(${VARIANT_BG[variant]})`,
+                  backgroundRepeat: 'no-repeat',
+                  backgroundPosition: 'left top',
+                  backgroundSize: trackW > 0 ? `${trackW}px auto` : '100% auto',
+              }
+            : { backgroundColor: '#19c8b9' }),
     };
 
     // 百分比文字固定显示在进度条右侧
```

---

### Incident Patch 3: `d14755f3` (2026-09-13)
**Commit Message**: docs(skill): complete catalog, fix counts, Title default and Icon rules

**File**: `docs/design-system/README.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ The core of the design language: **warm earth-tone palette + large-radius pill s
 | `Form`         | Form container + validation (ships the `FormItem` / `useForm` companion exports, API modeled on mainstream form libraries)                                                                           | ✓           |                           |
 | `Tag`          | Capsule tag, 3 sizes × 3 variants (solid/outlined/dashed) × 12 colors (fully aligned with the Card palette), supports closable / onClick / disabled                                                  | ✓           |                           |
 | `Notification` | Imperative global notifications (antd-style): 4 types × 6 positions, supports description / btn / onClick / key reuse for in-place updates / destroy all                                             | ✓           |                           |
-| `Progress`     | Scene-image progress bar: the fill shows one of 4 island scene images (sweet-corner default) unveiled from the left at 80% background-size, 3 sizes, label always to the right of the bar, custom infoFormat, and duration to control the fill-width animation                  |             | ✓                         |
+| `Progress`     | Scene-image progress bar: the fill shows one of 4 island scene images (sweet-corner default) spanning the full track, unveiled from the left with no border, 3 sizes, label always to the right of the bar, custom infoFormat, and duration to control the fill-width animation                  |             | ✓                         |
 | `Skeleton`     | Loading placeholder, 4 variants (`text`/`circle`/`rect`/`paragraph`) plus the `SkeletonButton` / `SkeletonInput` / `SkeletonAvatar` sub-components, warm-white shimmer sweep                          |             | ✓                         |
 | `BackTop`      | Fixed bottom-right back-to-top button (original badge artwork, easeInOutQuad smooth scroll)                                                                                                                | ✓           |                           |
 | `Image`        | Mat-frame image with lazy loading, error fallback and click-to-preview lightbox                                                                                                                      | ✓           |                           |
```

**File**: `docs/design-system/components/feedback.md` (modified, +3/-4)
```diff
@@ -5,7 +5,7 @@ Exact values for the components that report progress or pending state: Progress,
 ## Progress (scene-image fill on dotted track)
 
 Source: `src/components/Progress/Progress.tsx` (controlled rendering + aria wiring) + `types.ts` (type definitions) + `progress.module.less`.
-**A JSX component** (not imperative): `percent` is passed in controlled and animates smoothly from 0 to the target value. The track is a cream dotted pill with an inner shadow; the fill is a scene image (`sweet-corner.svg` by default) injected inline at `background-size: 80%` of the track width so more of the scene is visible. The label always sits right of the bar.
+**A JSX component** (not imperative): `percent` is passed in controlled and animates smoothly from 0 to the target value. The track is a cream dotted pill with an inner shadow; the fill is a scene image (`sweet-corner.svg` by default) injected inline at `background-size` equal to the full track width so the scene spans the whole bar. The label always sits right of the bar.
 
 **props**:
 ```ts
@@ -35,12 +35,11 @@ interface ProgressProps {
         radial-gradient(circle, rgba(196, 184, 158, 0.15) 1.5px, transparent 1.5px) 0 0 / 28px 28px,
         radial-gradient(circle, rgba(196, 184, 158, 0.1) 1px, transparent 1px) 7px 7px / 14px 14px,
         #f8f8f0;               /* cream dots (same as Background default / Card pattern-default) */
-    border: 2px solid #e8dcc8; /* very light stroke, one step lighter than #c4b89e, softer overall */
     box-shadow: inset 0 2px 4px rgba(114, 93, 66, 0.08); /* inner recess (very subtle) */
     border-radius: 999px;      /* pill */
     overflow: hidden;
 }
-.track.size-small  { height: 14px; border-width: 1.5px; }
+.track.size-small  { height: 14px; }
 .track.size-middle { height: 24px; }
 .track.size-large  { height: 32px; }
 ```
@@ -56,7 +55,7 @@ interface ProgressProps {
        background-image: url(<variant svg>);
        background-repeat: no-repeat;
        background-position: left top;
-       background-size: <trackWidth * 0.8>px auto;  (0.8 → more of the scene visible) */
+       background-size: <trackWidth>px auto;  (image spans the full track, clipped left by progress) */
     transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
     overflow: hidden;
     display: flex; align-items: center; justify-content: flex-end; padding-right: 4px;
```

**File**: `docs/zh-CN/design-system/README.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ animal-island-ui 是一套受《治愈系海岛风格》启发的 React + TypeSc
 | `Form`         | 表单容器 + 校验（含 `FormItem` / `useForm` 伴生导出，类主流表单库 API）                                                                                                                    | ✓    |               |
 | `Tag`          | 胶囊标签，3 尺寸 × 3 变体（solid/outlined/dashed）× 12 配色（与 Card 调色板完全对齐），支持 closable / onClick / disabled                                                                   | ✓    |               |
 | `Notification` | 命令式全局通知（antd 风格）：4 种 type × 6 个 position，支持 description / btn / onClick / key 复用更新 / destroy 全部                                                                      | ✓    |               |
-| `Progress`     | 场景图进度条：fill 显示 4 张岛屿场景图之一（默认 sweet-corner），按进度从左揭开，背景图 80% 缩放展示更多细节，3 档 size，文字固定显示在进度条右侧，infoFormat 自定义、duration 控制 fill 宽度动画 |      | ✓             |
+| `Progress`     | 场景图进度条：fill 显示 4 张岛屿场景图之一（默认 sweet-corner），背景图铺满整条轨道、无边框，按进度从左揭开，3 档 size，文字固定显示在进度条右侧，infoFormat 自定义、duration 控制 fill 宽度动画 |      | ✓             |
 | `Skeleton`     | 加载占位骨架，4 种变体（`text`/`circle`/`rect`/`paragraph`）加 `SkeletonButton` / `SkeletonInput` / `SkeletonAvatar` 子组件，暖白微光扫过                                                   |      | ✓             |
 | `BackTop`      | 固定右下角回到顶部按钮（原创徽章图形，easeInOutQuad 平滑滚动）                                                                                                                            | ✓    |               |
 | `Image`        | 衬板相框图片，支持懒加载、错误占位和点击预览                                                                                                                                                 | ✓    |               |
```

**File**: `docs/zh-CN/design-system/components/feedback.md` (modified, +3/-4)
```diff
@@ -5,7 +5,7 @@
 ## Progress（场景图 fill + 波点 track）
 
 源码：`src/components/Progress/Progress.tsx`（受控渲染 + aria 适配）+ `types.ts`（类型定义）+ `progress.module.less`。
-**JSX 组件**（非命令式）：`percent` 受控传入，从 0 平滑动画到目标值。track 是奶油色波点 pill 带内阴影，fill 是场景图（默认 `sweet-corner.svg`）由组件内联注入，`background-size` 为轨道宽度的 80%，让更多场景细节可见。百分比文字固定显示在进度条右侧。
+**JSX 组件**（非命令式）：`percent` 受控传入，从 0 平滑动画到目标值。track 是奶油色波点 pill 带内阴影、无边框；fill 是场景图（默认 `sweet-corner.svg`）由组件内联注入，`background-size` 等于整条轨道宽度，场景铺满整条轨道。百分比文字固定显示在进度条右侧。
 
 **props**：
 ```ts
@@ -35,12 +35,11 @@ interface ProgressProps {
         radial-gradient(circle, rgba(196, 184, 158, 0.15) 1.5px, transparent 1.5px) 0 0 / 28px 28px,
         radial-gradient(circle, rgba(196, 184, 158, 0.1) 1px, transparent 1px) 7px 7px / 14px 14px,
         #f8f8f0;               /* 奶油色波点（与 Background default / Card pattern-default 一致） */
-    border: 2px solid #e8dcc8; /* 比 #c4b89e 更浅一档的细描边 */
     box-shadow: inset 0 2px 4px rgba(114, 93, 66, 0.08); /* 内凹阴影（很淡） */
     border-radius: 999px;      /* pill */
     overflow: hidden;
 }
-.track.size-small  { height: 14px; border-width: 1.5px; }
+.track.size-small  { height: 14px; }
 .track.size-middle { height: 24px; }
 .track.size-large  { height: 32px; }
 ```
@@ -56,7 +55,7 @@ interface ProgressProps {
        background-image: url(<variant svg>);
        background-repeat: no-repeat;
        background-position: left top;
-       background-size: <trackWidth * 0.8>px auto;  (0.8 → 场景显示更多内容) */
+       background-size: <trackWidth>px auto;  (图片铺满整条轨道，按进度从左裁剪) */
     transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
     overflow: hidden;
     display: flex; align-items: center; justify-content: flex-end; padding-right: 4px;
```

**File**: `skills/animal-island-ui-style/README.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ animal-island-ui-style/
 └── references/
     ├── react-project.md         # scenario: React project with the npm package
     ├── standalone-html.md       # scenario: single-file HTML, no build step
-    └── components/              # props references by category (9 files, 30 components)
+    └── components/              # props references by category (9 files, 35 components)
 ```
 
 Exact design values (every hex/px/keyframe) are deliberately not duplicated into the
```

---

### Incident Patch 4: `a4b2e248` (2026-09-13)
**Commit Message**: fix(time): align HH:MM colon, bump clock to 44/900

**File**: `demo/App.tsx` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ const MENU_ITEMS: MenuItem[] = [
             { key: 'image', label: 'Image 图片' },
             { key: 'carousel', label: 'Carousel 轮播图', isNew: true },
             { key: 'time', label: 'Time 时钟' },
-            { key: 'countdown', label: 'Countdown 倒计时', isNew: true },
+            { key: 'countdown', label: 'Countdown 倒计时' },
         ],
     },
 ];
```

**File**: `demo/components/Countdown/index.tsx` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const CountdownDemo: React.FC = () => {
                 Countdown <DemoTag>倒计时</DemoTag> <DemoTag>实时更新</DemoTag>
             </div>
 
-            <div style={labelStyle}>活动倒计时（island 风格）</div>
+            <div style={labelStyle}>活动倒计时</div>
             <Countdown value={deadline} format="DD 天 HH:mm:ss" prefix="烟火大会开始还有" variant="island" />
             <div style={{ marginTop: 16 }}>
                 <Button size="small" onClick={reset}>
```

**File**: `skills/animal-island-ui-style/references/components/feedback.md` (modified, +1/-1)
```diff
@@ -176,4 +176,4 @@ type TimeProps = React.HTMLAttributes<HTMLDivElement>;
 <Time className="island-clock" aria-label="岛屿时间" />
 ```
 
-Zero-config live clock card: a large `HH:MM` readout on top refreshed from `new Date()` every second, weekday + `Mon DD` in a date capsule below. Borderless panel on `var(--animal-bg-color)` with 20px radius and `--animal-shadow-sm` elevation, fading in on mount; clock 40px 800 tabular in `var(--animal-text-color)` with a blinking colon; the capsule is a 999px pill on `var(--animal-primary-color-bg)` with an uppercase `var(--animal-primary-color)` weekday. The root is `role="timer"` with `aria-live="off"` so the per-second refresh stays silent to screen readers.
+Zero-config live clock card: a large `HH:MM` readout on top refreshed from `new Date()` every second, weekday + `Mon DD` in a date capsule below. Borderless panel on `var(--animal-bg-color)` with 20px radius and `--animal-shadow-sm` elevation, fading in on mount; clock 44px 900 tabular in `var(--animal-text-color)` with a blinking colon; the capsule is a 999px pill on `var(--animal-primary-color-bg)` with an uppercase `var(--animal-primary-color)` weekday. The root is `role="timer"` with `aria-live="off"` so the per-second refresh stays silent to screen readers.
```

**File**: `src/components/Time/time.module.less` (modified, +7/-7)
```diff
@@ -6,7 +6,7 @@
     gap: var(--animal-spacing-md, 12px);
     box-sizing: border-box;
     width: fit-content;
-    padding: 20px 32px;
+    padding: 20px 32px 15px 32px;
     border-radius: 20px;
     background: var(--animal-bg-color, #fff);
     box-shadow: var(--animal-shadow-sm, 0 2px 4px rgba(61, 52, 40, 0.06));
@@ -15,22 +15,22 @@
         var(--animal-motion-ease, cubic-bezier(0.4, 0, 0.2, 1));
 }
 
-// 上方时钟：HH:MM，等宽数字
+// 上方时钟：HH:MM，等宽数字；数字与冒号处于同一文本行，由字体基线统一渲染
 .clock {
-    display: flex;
-    align-items: center;
     color: var(--animal-text-color, #794f27);
-    font-weight: 800;
-    font-size: 40px;
+    font-weight: 900;
+    font-size: 44px;
     font-variant-numeric: tabular-nums;
     letter-spacing: 1px;
     line-height: 1;
     white-space: nowrap;
 }
 
-// 冒号：按秒闪烁
+// 冒号：按秒闪烁；该字体下冒号视觉中心略低于数字，上移对齐
 .colon {
+    display: inline-block;
     margin: 0 2px;
+    transform: translateY(-0.11em);
     animation: animal-time-blink 1s step-end infinite;
 }
 
```

---

### Incident Patch 5: `7c60b540` (2026-09-08)
**Commit Message**: docs(readme): add logo, refresh tagline, fix favicon path

**File**: `README.md` (modified, +9/-23)
```diff
@@ -1,19 +1,22 @@
-# 🏝 Animal-Island-UI
+# Animal-Island-UI
 
 <div align="center">
-A React UI component library with a cozy island-style design
+    <img src="./docs/img/readme-logo.png" alt="animal-island-ui" style="border-radius: 24px; width: 125px; display: block; margin: 0 auto 24px;" />
+</div>
+<div align="center">
+A React UI component library with a cute style
 </div>
 <br/>
 <div align="center">
     <a href="https://github.com/guokaigdg/animal-island-ui/stargazers"><img src="https://img.shields.io/github/stars/guokaigdg/animal-island-ui?style=flat-square" alt="Stars"></a>
     <a href="LICENSE"><img src="https://img.shields.io/badge/license-CC--BY--NC--4.0-orange.svg?style=flat-square" alt="License: CC BY-NC 4.0"></a>
     <a href="LICENSE"><img src="https://img.shields.io/npm/dm/animal-island-ui.svg?style=flat-square" alt=""></a>
     <a href="https://github.com/guokaigdg/animal-island-ui/releases"><img src="https://img.shields.io/github/v/tag/guokaigdg/animal-island-ui?label=version&style=flat-square" alt="Version"></a>
-    <a href="https://gitcode.com/guokaigdg/animal-island-ui"><img src="https://gitcode.com/guokaigdg/animal-island-ui/star/badge.svg" alt="Stars"></a>
+    <!-- <a href="https://gitcode.com/guokaigdg/animal-island-ui"><img src="https://gitcode.com/guokaigdg/animal-island-ui/star/badge.svg" alt="Stars"></a> -->
     <br/>
     <a href="./coverage/badges/coverage.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/guokaigdg/animal-island-ui/main/coverage/badges/coverage.json&style=flat-square" alt="Coverage"></a>
-    <img src="https://img.shields.io/badge/tests-496%20✓-brightgreen?style=flat-square" alt="Tests">
-    <img src="https://img.shields.io/badge/components-33-blue?style=flat-square" alt="Components">
+    <img src="https://img.shields.io/badge/tests-516%20✓-brightgreen?style=flat-square" alt="Tests">
+    <img src="https://img.shields.io/badge/components-35-blue?style=flat-square" alt="Components">
     <img src="https://img.shields.io/badge/a11y-WAI--ARIA%20APG-brightgreen?style=flat-square" alt="Accessibility">
 </div>
 <br/>
@@ -29,24 +32,7 @@ A React UI component library with a cozy island-style design
 
 ## Introduction
 
-This project is a lightweight UI component library built with React + TypeScript. It features an original, cozy island-style design language, created for personal front-end technical practice and component development learning.
-
-All visual elements, layouts, icons, and animations are independently designed and implemented from scratch.
-
-## ⚠️ Git History Rewritten — Re-clone Required
-
-In September 2026, the entire git history of this repository was rewritten to remove content that infringed Nintendo's copyright (per a DMCA takedown notice). All previous commits, tags, and releases were replaced with a clean history.
-
-**If you cloned or forked this repository before the rewrite:**
-
-- Do NOT pull or merge — doing so would reintroduce the removed content into your copy.
-- Delete your old clone/fork, then re-clone or re-fork from this repository.
-- Only pull requests based on the new history can be accepted.
-
-## Preview
-
-- Online Preview (PC) [animal-island-ui-pc](https://guokaigdg.github.io/animal-island-ui/#/)
-- Online Preview (Mobile) [animal-island-ui-mobile](https://guokaigdg.github.io/animal-island-ui/#/)
+This project is a lightweight UI component library built with React + TypeScript. It features an original, cozy island-style design language, created for personal front-end technical practice and component development learning.All visual elements, layouts, icons, and animations are independently designed and implemented from scratch.
 
 ## 🚀 Use AI to Generate animal-island-ui Pages (No Coding Needed)
 
```

**File**: `docs/README.zh-CN.md` (modified, +6/-23)
```diff
@@ -1,10 +1,10 @@
-# 🏝 Animal-Island-UI
+# Animal-Island-UI
 
 <div align="center">
-    <img src="img/readme-home.png" alt="animal-island-ui" style="border-radius: 12px; width: 40%; display: block; margin: 0 auto;" />    
+    <img src="img/readme-logo.png" alt="animal-island-ui" style="border-radius: 24px; width: 125px; display: block; margin: 0 auto 24px;" />    
 </div>
 <div align="center">
-一款参考《治愈系海岛》风格的 React UI 组件库
+一款可爱风格的 React UI 组件库
 </div>
 <br/>
 <div align="center">
@@ -15,8 +15,8 @@
     <a href="https://gitcode.com/guokaigdg/animal-island-ui"><img src="https://gitcode.com/guokaigdg/animal-island-ui/star/badge.svg" alt="Stars"></a>
     <br/>
     <a href="../coverage/badges/coverage.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/guokaigdg/animal-island-ui/main/coverage/badges/coverage.json&style=flat-square" alt="Coverage"></a>
-    <img src="https://img.shields.io/badge/tests-496%20✓-brightgreen?style=flat-square" alt="Tests">
-    <img src="https://img.shields.io/badge/components-33-blue?style=flat-square" alt="Components">
+    <img src="https://img.shields.io/badge/tests-516%20✓-brightgreen?style=flat-square" alt="Tests">
+    <img src="https://img.shields.io/badge/components-35-blue?style=flat-square" alt="Components">
     <img src="https://img.shields.io/badge/a11y-WAI--ARIA%20APG-brightgreen?style=flat-square" alt="Accessibility">
 </div>
 <br/>
@@ -31,24 +31,7 @@
 
 ## 介绍
 
-本项目是基于 React + TypeScript 实现的轻量 UI 组件库，采用原创的治愈系海岛风格设计语言，用于个人前端技术练习与组件化开发学习。
-
-所有视觉元素、布局、图标、动画均为本项目从零独立设计实现。
-
-## ⚠️ Git 历史已重写 — 请重新克隆
-
-2026 年 9 月，本仓库的全部 git 历史已重写，以移除侵犯任天堂版权的内容（依据 DMCA 下架通知）。此前所有提交、标签与发行版均已替换为清洁历史。
-
-**如果你在历史重写前克隆或 fork 过本仓库：**
-
-- 请勿 pull 或 merge —— 这会把已移除的内容重新带回你的副本。
-- 请删除旧的克隆/fork，然后从本仓库重新克隆或重新 fork。
-- 仅接受基于新历史的 Pull Request。
-
-## 预览
-
-- 在线预览 (PC 端) [animal-island-ui-pc](https://guokaigdg.github.io/animal-island-ui/#/)
-- 在线预览（移动端）[animal-island-ui-mobile](https://guokaigdg.github.io/animal-island-ui/#/)
+本项目是基于 React + TypeScript 实现的轻量 UI 组件库，采用原创的治愈系海岛风格设计语言，用于个人前端技术练习与组件化开发学习。所有视觉元素、布局、图标、动画均为本项目独立设计实现。
 
 ## 🚀 用 AI 工具一键生成 animal-island-ui 风格页面（无需写代码）
 
```

**File**: `index.html` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
     <head>
         <meta charset="UTF-8" />
         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-        <link rel="icon" href="/demo/html/favicon.ico" />
+        <link rel="icon" href="demo/favicon.ico" />
         <link rel="preconnect" href="https://fonts.googleapis.com" />
         <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
         <title>Animal Island UI</title>
```

---

### Incident Patch 6: `c1dbf1b6` (2026-09-01)
**Commit Message**: fix(demo): forward style prop on DemoTag

The Pagination demo already passes style to DemoTag for CJK font
fallback; the prop was not accepted before, so it had no effect.

**File**: `demo/tools/index.tsx` (modified, +2/-2)
```diff
@@ -37,8 +37,8 @@ export const sectionTitleStyle: React.CSSProperties = {
 };
 
 /** Demo 标题旁的语义标签，用 Tag 组件渲染，替代原来手写 tagStyle 的 span */
-export const DemoTag: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
-    <Tag size="small" variant="soft">
+export const DemoTag: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
+    <Tag size="small" variant="soft" style={style}>
         {children}
     </Tag>
 );
```

---

### Incident Patch 7: `51220fed` (2026-08-29)
**Commit Message**: fix(table): resolve hover flicker and improve hover contrast

**File**: `demo/components/Table/TableDemo.tsx` (modified, +8/-8)
```diff
@@ -41,13 +41,13 @@ const TableDemo: React.FC = () => {
             render: (value: unknown) => {
                 const hobby = value as string;
                 const tagStyles: Record<string, { bg: string; color: string }> = {
-                    音乐: { bg: 'rgba(147, 112, 219, 0.15)', color: '#9370db' },
-                    运动: { bg: 'rgba(255, 140, 0, 0.15)', color: '#ff8c00' },
-                    唱歌: { bg: 'rgba(255, 99, 71, 0.15)', color: '#ff6347' },
-                    钓鱼: { bg: 'rgba(30, 144, 255, 0.15)', color: '#1e90ff' },
-                    画画: { bg: 'rgba(255, 105, 180, 0.15)', color: '#ff69b4' },
+                    音乐: { bg: '#ece7f8', color: '#7b5cd6' },
+                    运动: { bg: '#fff0dc', color: '#d97a00' },
+                    唱歌: { bg: '#ffe8e4', color: '#dd5040' },
+                    钓鱼: { bg: '#e2effd', color: '#1d7fd6' },
+                    画画: { bg: '#ffe8f1', color: '#dd5096' },
                 };
-                const style = tagStyles[hobby] || { bg: 'rgba(25, 200, 185, 0.15)', color: '#19c8b9' };
+                const style = tagStyles[hobby] || { bg: '#e0f7f4', color: '#129a8e' };
                 return (
                     <span
                         style={{
@@ -165,9 +165,9 @@ const columns = [
         render: (value) => (
             <span style={{
                 padding: '4px 12px',
-                background: 'rgba(25, 200, 185, 0.15)',
+                background: '#e0f7f4',
                 borderRadius: 20,
-                color: '#19c8b9',
+                color: '#129a8e',
             }}>
                 {value}
             </span>
```

**File**: `src/components/Table/table.module.less` (modified, +19/-19)
```diff
@@ -65,9 +65,10 @@
 }
 
 .row {
-    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
     position: relative;
 
+    // 注意：tr 上的伪元素会被 Chrome 包进匿名单元格（行首伪元素会导致整行列错位），
+    // 因此 hover 背景直接绘制在 tr 上，圆角用 border-radius（不影响命中区域，无闪烁）
     &::after {
         content: '';
         position: absolute;
@@ -84,24 +85,21 @@
         );
     }
 
+    // hover 条纹保持半透明（透明度 0.5），深棕文字无需换色即可读，避免字色切换闪烁
     &:hover {
         background-image: repeating-linear-gradient(
             -45deg,
-            rgba(25, 200, 185, 0.6),
-            rgba(25, 200, 185, 0.6) 10px,
-            rgba(14, 196, 182, 0.6) 10px,
-            rgba(14, 196, 182, 0.6) 20px
+            rgba(25, 200, 185, 0.5),
+            rgba(25, 200, 185, 0.5) 10px,
+            rgba(14, 196, 182, 0.5) 10px,
+            rgba(14, 196, 182, 0.5) 20px
         );
         background-size: 28.28px 28.28px;
-        clip-path: inset(0 0 0 0 round 30px);
+        border-radius: 30px;
 
         &::after {
             opacity: 0;
         }
-
-        .cell {
-            color: #3d2e1e;
-        }
     }
 
     &:last-child {
@@ -117,21 +115,17 @@
     &:hover {
         background-image: repeating-linear-gradient(
             -45deg,
-            rgba(25, 200, 185, 0.65),
-            rgba(25, 200, 185, 0.65) 10px,
-            rgba(14, 196, 182, 0.65) 10px,
-            rgba(14, 196, 182, 0.65) 20px
+            rgba(25, 200, 185, 0.5),
+            rgba(25, 200, 185, 0.5) 10px,
+            rgba(14, 196, 182, 0.5) 10px,
+            rgba(14, 196, 182, 0.5) 20px
         );
         background-size: 28.28px 28.28px;
-        clip-path: inset(0 0 0 0 round 30px);
+        border-radius: 30px;
 
         &::after {
             opacity: 0;
         }
-
-        .cell {
-            color: #3d2e1e;
-        }
     }
 }
 
@@ -167,6 +161,12 @@
     opacity: 0.5;
 }
 
+.paginationWrapper {
+    display: flex;
+    justify-content: flex-end;
+    padding: 10px 16px 8px;
+}
+
 .loading {
     opacity: 0.7;
     pointer-events: none;
```

---

### Incident Patch 8: `3c723f56` (2026-08-26)
**Commit Message**: fix: 修复倒计时归零后 setInterval 仍在运行的问题

**File**: `pnpm-workspace.yaml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+allowBuilds:
+    esbuild: true
```

**File**: `src/components/Countdown/Countdown.tsx` (modified, +22/-8)
```diff
@@ -24,7 +24,7 @@ export interface CountdownProps extends Omit<React.HTMLAttributes<HTMLDivElement
 const toTimestamp = (value: number | Date) => (value instanceof Date ? value.getTime() : value);
 
 const pad = (value: number) => String(value).padStart(2, '0');
-
+//5-->05
 const formatRemaining = (remaining: number, format: string) => {
     const totalSeconds = Math.ceil(remaining / 1_000);
     const days = Math.floor(totalSeconds / 86_400);
@@ -61,23 +61,37 @@ export const Countdown: React.FC<CountdownProps> = ({
     onFinishRef.current = onFinish;
 
     useEffect(() => {
-        finishedRef.current = false;
+        let timer: number | undefined;
 
         const update = () => {
             const next = getRemaining();
+
             setRemaining(next);
             onChangeRef.current?.(next);
 
-            if (next === 0 && !finishedRef.current) {
-                finishedRef.current = true;
-                onFinishRef.current?.();
+            if (next === 0) {
+                if (!finishedRef.current) {
+                    finishedRef.current = true;
+                    onFinishRef.current?.();
+                }
+
+                if (timer !== undefined) {
+                    window.clearInterval(timer);
+                }
             }
+
             return next;
         };
 
-        if (update() === 0) return;
-        const timer = window.setInterval(update, 250);
-        return () => window.clearInterval(timer);
+        if (update() > 0) {
+            timer = window.setInterval(update, 250);
+        }
+
+        return () => {
+            if (timer !== undefined) {
+                window.clearInterval(timer);
+            }
+        };
     }, [getRemaining]);
 
     const classNames = [styles.countdown, styles[size], styles[variant], className].filter(Boolean).join(' ');
```

---

### Incident Patch 9: `4305a223` (2026-08-07)
**Commit Message**: fix(tag): correct vertical centering and normalize size scale

- Remove forced font-size/line-height from [class^='animal-'] reset
  to restore style inheritance inside components (root cause of
  mis-centered Chinese text in Tag)
- Tag size classes no longer override line-height; vertical centering
  is handled by inline-flex + align-items: center, line-height stays
  at 1 from the root
- Normalize Tag sizes to 24/32/40 (8px steps) with font-size 12/14/16
- Sync docs (EN/zh-CN/skill): size values + add missing `soft` variant
  to TagVariant type, variant classes, and 12-color palette

**File**: `docs/design-system/components/data-display.md` (modified, +22/-4)
```diff
@@ -104,7 +104,7 @@ tab-size: 4;
 
 ## Tag (pill, 12-colour palette)
 
-Source: `src/components/Tag/Tag.tsx` + `tag.module.less`. **Pill-shaped tag**: perfectly aligned with the Card palette (12 brand colours + 1 default), 3 sizes × 3 variants (solid / outlined / dashed), supporting closable / onClick / disabled.
+Source: `src/components/Tag/Tag.tsx` + `tag.module.less`. **Pill-shaped tag**: perfectly aligned with the Card palette (12 brand colours + 1 default), 3 sizes × 4 variants (solid / outlined / dashed / soft), supporting closable / onClick / disabled.
 
 ```less
 // root — full pill, 1.5px transparent border (reserves space for the variants so nothing jitters)
@@ -124,14 +124,18 @@ Source: `src/components/Tag/Tag.tsx` + `tag.module.less`. **Pill-shaped tag**: p
 }
 
 // ---------- Size ----------
-.size-small  { height: 24px; line-height: 21px; padding: 0 10px; font-size: 12px; }
-.size-medium { height: 29px; line-height: 26px; padding: 0 12px; font-size: 13px; } /* default */
-.size-large  { height: 34px; line-height: 31px; padding: 0 16px; font-size: 15px; }
+// line-height stays at 1 (inherited from .tag root); vertical centering is handled
+// by inline-flex + align-items: center, so size classes only set height / padding / font-size.
+// height uses 8px steps (24/32/40); font-size uses 12/14/16.
+.size-small  { height: 24px; padding: 0 10px; font-size: 12px; }
+.size-medium { height: 32px; padding: 0 12px; font-size: 14px; } /* default */
+.size-large  { height: 40px; padding: 0 16px; font-size: 16px; }
 
 // ---------- Variant ----------
 .variant-solid    { background: rgb(247, 243, 223); color: #8f734f; border-color: #d4c4a8; }
 .variant-outlined { background: transparent;    color: #8f734f; border-color: #c4b89e; }
 .variant-dashed   { background: transparent;    color: #8f734f; border-color: #c4b89e; border-style: dashed; }
+.variant-soft     { background: #f5f0e6; color: #8f734f; border-color: transparent; }
 
 // ---------- Colour (identical to Card's .pattern-{color} border colours) ----------
 // solid variant: background = saturated colour, text #fff
@@ -174,6 +178,20 @@ Source: `src/components/Tag/Tag.tsx` + `tag.module.less`. **Pill-shaped tag**: p
 .color-warm-peach-pink-outlined,
 .color-warm-peach-pink-dashed  { color: #e18c6f; border-color: #e18c6f; }
 
+// soft variant: light pastel background + deeper same-hue text, no border
+.color-app-pink-soft         { background: #fce4ec; color: #c2185b; }
+.color-purple-soft           { background: #f3e5f5; color: #7b1fa2; }
+.color-app-blue-soft         { background: #e6f0ff; color: #1565c0; }
+.color-app-yellow-soft       { background: #fff8e1; color: #f9a825; }
+.color-app-orange-soft       { background: #fff3e0; color: #e65100; }
+.color-app-teal-soft         { background: #e0f2f1; color: #00695c; }
+.color-app-green-soft        { background: #e8f5e9; color: #2e7d32; }
+.color-app-red-soft          { background: #ffebee; color: #c62828; }
+.color-lime-green-soft       { background: #f1f8e9; color: #558b2f; }
+.color-yellow-green-soft     { background: #f9fbe7; color: #827717; }
+.color-brown-soft            { background: #efebe9; color: #4e342e; }
+.color-warm-peach-pink-soft  { background: #fbe9e7; color: #bf360c; }
+
 // ---------- Close button ----------
 .close {
     display: inline-flex;
```

**File**: `docs/zh-CN/design-system/components/data-display.md` (modified, +22/-4)
```diff
@@ -104,7 +104,7 @@ tab-size: 4;
 
 ## Tag（胶囊标签，12 色调色板）
 
-源码：`src/components/Tag/Tag.tsx` + `tag.module.less`。**胶囊标签**：与 Card 调色板完全对齐（12 品牌色 + 1 默认），3 种尺寸 × 3 种变体（solid / outlined / dashed），支持 closable / onClick / disabled。
+源码：`src/components/Tag/Tag.tsx` + `tag.module.less`。**胶囊标签**：与 Card 调色板完全对齐（12 品牌色 + 1 默认），3 种尺寸 × 4 种变体（solid / outlined / dashed / soft），支持 closable / onClick / disabled。
 
 ```less
 // root — full pill, 1.5px transparent border (reserves space for the variants so nothing jitters)
@@ -124,14 +124,18 @@ tab-size: 4;
 }
 
 // ---------- Size ----------
-.size-small  { height: 24px; line-height: 21px; padding: 0 10px; font-size: 12px; }
-.size-medium { height: 29px; line-height: 26px; padding: 0 12px; font-size: 13px; } /* default */
-.size-large  { height: 34px; line-height: 31px; padding: 0 16px; font-size: 15px; }
+// line-height stays at 1 (inherited from .tag root); vertical centering is handled
+// by inline-flex + align-items: center, so size classes only set height / padding / font-size.
+// height uses 8px steps (24/32/40); font-size uses 12/14/16.
+.size-small  { height: 24px; padding: 0 10px; font-size: 12px; }
+.size-medium { height: 32px; padding: 0 12px; font-size: 14px; } /* default */
+.size-large  { height: 40px; padding: 0 16px; font-size: 16px; }
 
 // ---------- Variant ----------
 .variant-solid    { background: rgb(247, 243, 223); color: #8f734f; border-color: #d4c4a8; }
 .variant-outlined { background: transparent;    color: #8f734f; border-color: #c4b89e; }
 .variant-dashed   { background: transparent;    color: #8f734f; border-color: #c4b89e; border-style: dashed; }
+.variant-soft     { background: #f5f0e6; color: #8f734f; border-color: transparent; }
 
 // ---------- Colour (identical to Card's .pattern-{color} border colours) ----------
 // solid variant: background = saturated colour, text #fff
@@ -174,6 +178,20 @@ tab-size: 4;
 .color-warm-peach-pink-outlined,
 .color-warm-peach-pink-dashed  { color: #e18c6f; border-color: #e18c6f; }
 
+// soft variant: light pastel background + deeper same-hue text, no border
+.color-app-pink-soft         { background: #fce4ec; color: #c2185b; }
+.color-purple-soft           { background: #f3e5f5; color: #7b1fa2; }
+.color-app-blue-soft         { background: #e6f0ff; color: #1565c0; }
+.color-app-yellow-soft       { background: #fff8e1; color: #f9a825; }
+.color-app-orange-soft       { background: #fff3e0; color: #e65100; }
+.color-app-teal-soft         { background: #e0f2f1; color: #00695c; }
+.color-app-green-soft        { background: #e8f5e9; color: #2e7d32; }
+.color-app-red-soft          { background: #ffebee; color: #c62828; }
+.color-lime-green-soft       { background: #f1f8e9; color: #558b2f; }
+.color-yellow-green-soft     { background: #f9fbe7; color: #827717; }
+.color-brown-soft            { background: #efebe9; color: #4e342e; }
+.color-warm-peach-pink-soft  { background: #fbe9e7; color: #bf360c; }
+
 // ---------- Close button ----------
 .close {
     display: inline-flex;
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
     "name": "animal-island-ui",
-    "version": "1.4.0",
+    "version": "1.5.1",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "animal-island-ui",
-            "version": "1.4.0",
+            "version": "1.5.1",
             "license": "CC-BY-NC-4.0",
             "devDependencies": {
                 "@eslint/js": "^9.0.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "animal-island-ui",
-    "version": "1.4.0",
+    "version": "1.5.1",
     "description": "A nature-inspired React component library",
     "type": "module",
     "main": "dist/cjs/index.cjs",
```

**File**: `skills/animal-island-ui-style/references/components/data-display.md` (modified, +4/-4)
```diff
@@ -68,7 +68,7 @@ interface CodeBlockProps {
 
 ```ts
 type TagSize = 'small' | 'medium' | 'large';
-type TagVariant = 'solid' | 'outlined' | 'dashed';
+type TagVariant = 'solid' | 'outlined' | 'dashed' | 'soft';
 type TagColor =
     | 'default'
     | 'app-pink'
@@ -87,7 +87,7 @@ type TagColor =
 interface TagProps {
     children?: React.ReactNode;
     size?: TagSize; // default 'medium'
-    variant?: TagVariant; // default 'solid'
+    variant?: TagVariant; // default 'soft'
     color?: TagColor; // default 'default'
     closable?: boolean; // default false
     onClose?: (e: React.MouseEvent<HTMLElement>) => void;
@@ -110,8 +110,8 @@ interface TagProps {
 
 Notes:
 
-- **Color palette exactly matches `Card`** — 12 brand colors + 1 default. `solid` uses the saturated color as background with white text; `outlined` and `dashed` use the same color for text + border on a transparent background. `color="default"` renders the parchment-pill neutral (`rgb(247,243,223)` bg, `#8f734f` text) — use it for plain chips.
-- **3 sizes** (driven by CSS class `size-{size}`): small 24px / medium 29px / large 34px. All have `border-radius: 999px` (full capsule), `font-weight: 600`, and 1.5px transparent border (reserves space so outlined/dashed don't shift layout).
+- **Color palette exactly matches `Card`** — 12 brand colors + 1 default. `solid` uses the saturated color as background with white text; `outlined` and `dashed` use the same color for text + border on a transparent background; `soft` uses a light pastel background with a deeper same-hue text color and no border. `color="default"` renders the parchment-pill neutral (`rgb(247,243,223)` bg, `#8f734f` text) — use it for plain chips.
+- **3 sizes** (driven by CSS class `size-{size}`): small 24px / medium 32px / large 40px (8px steps), with font-size 12 / 14 / 16. All have `border-radius: 999px` (full capsule), `font-weight: 600`, and 1.5px transparent border (reserves space so outlined/dashed don't shift layout). Vertical centering is handled by `inline-flex + align-items: center`; `line-height: 1` on the root keeps the line box tight to the glyph — size classes do not override it.
 - **`closable` renders a × button** with `aria-label="close"` and a 16×16 circle background `rgba(0,0,0,0.08)` (hover `0.18`). Close click is `stopPropagation`'d, so it will NOT trigger the parent `onClick`.
 - **`onClick` upgrades the tag to a button** (`role="button"`, `tabIndex={0}`) — supports Enter and Space keys. Without `onClick` the tag is a plain `<span>`. Hover/active states add `translateY(-1px)` lift + `box-shadow 0 2px 6px rgba(61,52,40,0.12)`. Focus ring is `2px solid var(--animal-focus-yellow, #f5c31c)`.
 - **`disabled`** sets `opacity: 0.5` and `pointer-events: none` on the whole tag, AND disables the close button (which gets a separate `cursor: not-allowed`).
```

---

### Incident Patch 10: `c4382692` (2026-07-28)
**Commit Message**: Merge pull request #48 from zthxxx/docs/coderabbit-review-fixes

docs: fix stale component specs surfaced by CodeRabbit review on #47

**File**: `AGENTS.md` (modified, +4/-2)
```diff
@@ -49,8 +49,10 @@ intentional duplication — when you touch one side, update the other in the sam
 
 Everything else is single-source: the design system ([docs/design-system/](docs/design-system/README.md))
 defines the design language and depends on nothing; code implements it; all other docs
-link instead of restating. The skill directory is self-contained — it never references
-repo files by relative path, only GitHub URLs.
+link instead of restating. The skill directory is self-contained — links between files
+inside the skill stay relative (they must resolve after the skill is installed on its
+own), while anything outside the skill directory is referenced only by GitHub URL, never
+by repo-relative path.
 
 `npm run check:docs` enforces: every component in `src/components/` is covered in both
 `docs/design-system/components/` and the skill's `references/components/` (which are also
```

**File**: `docs/adr/0004-docs-sync-automation.md` (modified, +7/-6)
```diff
@@ -14,15 +14,16 @@ The set of components changes, and every change fans out across several document
 
 Treat documentation coverage as a build-time invariant and enforce it mechanically.
 
-`scripts/check-docs-sync.mjs` discovers the component set from the source tree rather than from a maintained list: it scans `src/components/` for directories containing a matching `<ComponentName>.tsx`. Every discovered component must then appear as a section in each required document:
+`scripts/check-docs-sync.mjs` discovers the component set from the source tree rather than from a maintained list: it scans `src/components/` for directories containing a matching `<ComponentName>.tsx`. Every discovered component must then appear as a section in each required document group:
 
 - `docs/design-system/components/*.md` — the canonical English design-system reference.
-- `skills/animal-island-ui-style/references/components/*.md` — the reference material shipped with the external style skill.
-- `docs/zh-CN/**` — the Chinese mirrors of the above, kept at parity.
+- `skills/animal-island-ui-style/references/components/*.md` — the reference material shipped with the external style skill; each file here is additionally capped at 200 lines.
 
-Coverage is asserted by heading match: the component name must appear as a Markdown section heading in each required document, not merely somewhere in the prose. A passing mention inside a table or an example does not satisfy the check, because the intent is that every component has a place of its own to document.
+Coverage is asserted by heading match per group: the component name must appear as a Markdown section heading somewhere within each group's files, not merely in the prose. A passing mention inside a table or an example does not satisfy the check, because the intent is that every component has a place of its own to document.
 
-The script reports a per-component matrix and exits non-zero when any component is missing from any required document, naming the component and the documents it is missing from.
+The Chinese mirrors under `docs/zh-CN/**` are checked for file-path parity with `docs/**` (every English document must have a mirror and vice versa), and `SKILL.zh-CN.md` must exist and be non-empty; heading-level coverage inside the mirrors is not re-asserted.
+
+The script exits non-zero when anything drifts, listing each missing component heading, each missing or orphaned mirror file, and each oversized skill reference.
 
 Enforcement runs in two places. `npm run check:docs` invokes it directly; `npm run ci` chains it between format checking and linting, so it gates the pipeline. The pre-commit hook in `.githooks/` runs the full `npm run ci`, installed automatically by `npm run setup:hooks` from the `prepare` lifecycle script. Drift therefore fails locally before it can be committed, and fails CI if the hook was bypassed.
 
@@ -34,6 +35,6 @@ Enforcement runs in two places. `npm run check:docs` invokes it directly; `npm r
 - The pre-commit hook runs the entire CI pipeline — formatting, docs, lint, unit tests, accessibility tests, and the build — so commits are slow. `git commit --no-verify` bypasses it for emergencies; CI still enforces the same checks.
 - The check verifies **presence, not accuracy**. A section heading with wrong or empty content passes. Correctness of props, values, and prose remains a review responsibility.
 - Adding a new required document means updating the script's document list, otherwise the new document drifts unchecked.
-- Parity is enforced structurally, not semantically: the Chinese mirrors must contain the same component sections, but nothing detects an English section that has been revised while its translation was left behind. Substantive edits must be carried to both languages by hand.
+- Parity is enforced at the file level, not semantically: every English document must have a Chinese mirror file and vice versa, but nothing inspects the mirrors' contents — a missing
```

**File**: `docs/design-prompts.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ Interface details:
   light blue #B7C6E5
 - Nunito rounded font family (Google Fonts), weight 600-700, friendly chubby letterforms
 - Yellow focus highlight #ffcc00 on focused inputs (NOT blue)
-- Switch toggle with floating 3D handle, green #86d67a when ON
+- Switch toggle with a flat circular handle (thin border, no outer shadow; the track carries an inset shadow only), track green #86d67a when ON
 - Collapse accordion with teal circle icon, leaf SVG decoration
 - Time widget showing weekday in green #6fba2c, large 48px clock digits
 - Pastel parchment Table with dashed dotted row dividers and diagonal teal stripe hover
```

**File**: `docs/design-system/components/Form.md` (modified, +3/-3)
```diff
@@ -85,9 +85,9 @@ Pixel-level styling for the Form container together with its companion exports `
     margin-top: 4px;
 }
 /* status colors (neutral gray + mainstream status colors, not parchment tokens) */
-.island-form-item-has-error  .island-form-item-explain { color: #ff4d4f; }
-.island-form-item-has-warning.island-form-item-explain { color: #faad14; }
-.island-form-item-has-success.island-form-item-explain { color: #52c41a; }
+.island-form-item-has-error .island-form-item-explain { color: #ff4d4f; }
+.island-form-item-has-warning .island-form-item-explain { color: #faad14; }
+.island-form-item-has-success .island-form-item-explain { color: #52c41a; }
 .island-form-item-is-validating .island-form-item-explain { color: #1677ff; }
 
 /* global disabled */
```

**File**: `docs/design-system/components/Notification.md` (modified, +16/-6)
```diff
@@ -112,19 +112,29 @@ Notification.destroy('upload'); // close a specific key
 ## Enter / leave animation (direction follows placement)
 
 ```css
-.placement-top    { animation: animal-notification-slide-down 0.25s cubic-bezier(0.4,0,0.2,1) both; }
-.placement-top.leaving    { animation: animal-notification-slide-up 0.25s cubic-bezier(0.4,0,0.2,1) both; }
-.placement-bottom { animation: animal-notification-slide-up   0.25s cubic-bezier(0.4,0,0.2,1) both; }
-.placement-bottom.leaving { animation: animal-notification-slide-down 0.25s cubic-bezier(0.4,0,0.2,1) both; }
+.placement-top    { animation: animal-notification-slide-from-top 0.25s cubic-bezier(0.4,0,0.2,1) both; }
+.placement-top.leaving    { animation: animal-notification-slide-out-top 0.25s cubic-bezier(0.4,0,0.2,1) both; }
+.placement-bottom { animation: animal-notification-rise-from-bottom 0.25s cubic-bezier(0.4,0,0.2,1) both; }
+.placement-bottom.leaving { animation: animal-notification-sink-out-bottom 0.25s cubic-bezier(0.4,0,0.2,1) both; }
 
-@keyframes animal-notification-slide-down {
+/* top: enter sliding down from -16px, leave sliding back up */
+@keyframes animal-notification-slide-from-top {
     from { opacity: 0; transform: translateY(-16px); }
     to   { opacity: 1; transform: translateY(0); }
 }
-@keyframes animal-notification-slide-up {
+@keyframes animal-notification-slide-out-top {
     from { opacity: 1; transform: translateY(0); }
     to   { opacity: 0; transform: translateY(-16px); }
 }
+/* bottom: enter rising up from +16px, leave sinking back down */
+@keyframes animal-notification-rise-from-bottom {
+    from { opacity: 0; transform: translateY(16px); }
+    to   { opacity: 1; transform: translateY(0); }
+}
+@keyframes animal-notification-sink-out-bottom {
+    from { opacity: 1; transform: translateY(0); }
+    to   { opacity: 0; transform: translateY(16px); }
+}
 
 /* reduced motion */
 @media (prefers-reduced-motion: reduce) {
```

#### Recent Merged Pull Requests:
- **PR #53** (2026-08-26): fix: 修复倒计时归零后 setInterval 仍在运行的问题 (@resinya)
- **PR #52** (2026-08-21): feat: 新增倒计时和轮播图组件，并为 CodeBlock 添加复制功能 (@resinya)
- **PR #51** (2026-08-01): docs: 增加 animal-island-uniapp 使用案例 (@leepule)
- **PR #50** (2026-07-30): docs: add contribution leaderboard badge to README (@guokaigdg)
- **PR #48** (2026-07-28): docs: fix stale component specs surfaced by CodeRabbit review on #47 (@zthxxx)
- **PR #47** (2026-07-28): docs: restructure documentation into design-system / skill / development layers (@zthxxx)
- **PR #46** (2026-07-12): docs: add Acorn Astro Theme introduction to README (@Mystic-Stars)
- **PR #45** (2026-07-12): docs: add callai to Usage Cases (@YuniqueUnic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
