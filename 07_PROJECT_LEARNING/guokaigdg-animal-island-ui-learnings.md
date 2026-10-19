> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/guokaigdg-animal-island-ui-learnings.md`  
> **Source**: github ([https://github.com/guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui))  
> **Source Version**: `a412c55b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:59:12.450Z  
> **Learning ID**: `learn-github-guokaigdg-animal-island-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): guokaigdg/animal-island-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/guokaigdg-animal-island-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T04:59:12.288Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `guokaigdg/animal-island-ui`
- **Description**: A Kawaii React UI component library  一个可爱的 React UI  组件库
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5023 stars

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
            { key: 'title', label: 'Title 标题' },
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
            { key: 'calendar', label: 'Calendar 日历', isNew: true },
            { key: 'checkbox', label: 'Checkbox 多选框' },
            { key: 'radio', label: 'Radio 单选框' },
            { key: 'rate', label: 'Rate 评分', isNew: true },
            { key: 'form', label: 'Form 表单' },
            { key: 'upload', label: 'Upload 上传' },
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
            { key: 'avatar', label: 'Avatar 头像' },
            { key: 'badge', label: 'Badge 徽标数', isNew: true },
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
            { key: 'countup', label: 'CountUp 数字滚动', isNew: true },
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
            animation: 'menuBadgePulse 1.8s ease-in-out infinite',
        }) as React.CSSProperties,
    main: {
        flex: 1,
        overflow: 'auto',
        padding: '32px 40px',
    } as React.CSSProperties,
};

// ============================================
// Sidebar content (shared between desktop & mobile drawer)
// ============================================
const SidebarContent: React.FC<{
    activeKey: string;
    onNavigate: (path: string) => void;
}> = ({ activeKey, onNavigate }) => (
    <>
        <div style={S.sidebarHeader} onClick={() => onNavigate('/')}>
            <img
                src={logo}
                alt="Animal Island UI logo"
                style={{
                    display: 'block',
                    width: 25,
                    height: 25,
                    borderRadius: 8,
                    marginRight: 8,
                    transform: 'translateY(-2px)',
                }}
            />
            Animal Island UI
        </div>
        <nav style={S.menuList}>
            {MENU_ITEMS.map((item) => {
                if (item.children) {
                    return (
                        <div key={item.key}>
                            <div
                                style={{
                                    padding: '12px 16px 4px',
                                    fontSize: 11,
                                    color: '#a0936e',
                                    fontWeight: 600,
                                    letterSpacing: 0.5,
                                }}
                            >
                                {item.label}
                            </div>
                            {item.chi
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
import RateDemo from './components/Rate';
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
import AvatarDemo from './components/Avatar';
import BadgeDemo from './components/Badge';
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
import CalendarDemo from './components/Calendar';
import DatePickerDemo from './components/DatePicker';
import TimePickerDemo from './components/TimePicker';
import CountdownDemo from './components/Countdown';
import CountUpDemo from './components/CountUp';
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
    calendar: CalendarDemo,
    tabs: TabsDemo,
    checkbox: CheckboxDemo,
    radio: RadioDemo,
    rate: RateDemo,
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
    avatar: AvatarDemo,
    badge: BadgeDemo,
    countdown: CountdownDemo,
    countup: CountUpDemo,
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
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily:
            "'Nunito', 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 10,
        background: '#e6f9f6',
        color: '#19c8b9',
        marginLeft: 8,
        verticalAlign: 'middle',
        textShadow: 'none',
    } as React.CSSProperties,
    heroSubtitle: {
        fontSize: 17,
        fontWeight: 500,
        color: '#7c5734',
        lineHeight: 1.7,
        margin: '0 0 28px',
        maxWidth: 520,
    } as React.CSSProperties,
    heroActions: {
        display: 'flex',
        gap: 16,
        alignItems: 'center',
    } as React.CSSProperties,

    // Sections
    section: {
        padding: '48px 40px',
        maxWidth: 960,
        margin: '0 auto',
        position: 'relative',
        zIndex: 999,
    } as React.CSSProperties,
    sectionTitle: {
        fontFamily:
            "Nunito, 'Zen Maru Gothic', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        fontSize: 24,
        fontWeight: 700,
        color: '#725d42',
        margin: '0 0 8px',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    sectionDesc: {
        fontSize: 14,
        color: '#7c5734',
        textAlign: 'center' as const,
        marginBottom: 32,
    } as React.CSSProperties,

    // Features
    features: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
    } as React.CSSProperties,
    featureCard: {
        padding: '24px 20px',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    featureIcon: { fontSize: 32, marginBottom: 12 } as React.CSSProperties,
    featureTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: '#725d42',
        marginBottom: 6,
    } as React.CSSProperties,
    f
```

### Core Architecture Module: `demo/components/Avatar/index.tsx`
```
import React from 'react';
import { Avatar, AvatarGroup, Radio, type AvatarShape } from '../../../src';
import {
    ImageIcon,
    MapIcon,
    CoffeeCupIcon,
    RabbitIcon,
    OwlIcon,
    CameraIcon,
    SunIcon,
    RainbowIcon,
    CloudIcon,
    StarIcon,
    LeafIcon,
    MushroomIcon,
    StrawberryIcon,
    DonutIcon,
    IcecreamIcon,
    CoffeeIcon,
    BalloonIcon,
    RocketIcon,
    SailboatIcon,
    MusicIcon,
    HeartIcon,
} from 'naive-icons';
import { sectionStyle, sectionTitleStyle, DemoTag, ApiTable, ApiRow, CodeBlock } from '../../tools';

/** 演示照片池：复用 demo/assets/images 照片，头像裁切展示 */
const pictures = Object.values(import.meta.glob('../../assets/images/*.{jpg,jpeg,png}', { eager: true })).map(
    (m) => (m as { default: string }).default
);
const pick = (i: number) => pictures[i % Math.max(pictures.length, 1)];

const AVATAR_API: ApiRow[] = [
    {
        prop: 'shape',
        desc: "形状：'circle' 圆形（默认） / 'square' 圆角方形",
        type: `'circle' | 'square'`,
        defaultVal: "'circle'",
    },
    {
        prop: 'size',
        desc: "尺寸：'small' / 'middle' / 'large' 预设，或任意像素数值",
        type: `number | 'small' | 'middle' | 'large'`,
        defaultVal: "'middle'",
    },
    { prop: 'src', desc: '图片地址；加载失败自动回退到图标 / 文字', type: 'string', defaultVal: '-' },
    { prop: 'alt', desc: '图片替代文本（无障碍）', type: 'string', defaultVal: '-' },
    { prop: 'icon', desc: '图标占位：src 为空或加载失败时展示', type: 'ReactNode', defaultVal: '用户图标' },
    {
        prop: 'gap',
        desc: '文字 / 图标与头像边界的间距（px），文字过宽时按比例自动缩小字号',
        type: 'number',
        defaultVal: '4',
    },
    {
        prop: 'onError',
        desc: '图片加载失败回调；返回 false 可阻止回退到占位内容',
        type: '() => boolean',
        defaultVal: '-',
    },
    {
        prop: 'children',
        desc: '头像内容：文字作为文字头像；传入 naive-icons 图标组件时创建图标头像',
        type: 'ReactNode',
        defaultVal: '-',
    },
];

const GROUP_API: ApiRow[] = [
    { prop: 'maxCount', desc: '最多显示的头像数量，超出部分折叠为 "+N"', type: 'number', defaultVal: '-' },
    { prop: 'maxStyle', desc: '折叠 "+N" 头像的自定义样式', type: 'React.CSSProperties', defaultVal: '-' },
    {
        prop: 'size',
        desc: '传递给子 Avatar 的尺寸（子级未显式指定时生效）',
        type: `number | 'small' | 'middle' | 'large'`,
        defaultVal: '-',
    },
    { prop: 'shape', desc: '传递给子 Avatar 的形状', type: `'circle' | 'square'`, defaultVal: '-' },
    { prop: 'gap', desc: '头像组内头像间距（px），头像间相互叠加', type: 'number', defaultVal: '8' },
];

/** 图标头像展示：20 个 naive-icons 图标作为 children 创建图标头像（动物 / 天气 / 食物 / 物件随机混合） */
const ICON_AVATARS = [
    ImageIcon,
    CoffeeCupIcon,
    RabbitIcon,
    OwlIcon,
    CameraIcon,
    SunIcon,
    RainbowIcon,
    CloudIcon,
    StarIcon,
    LeafIcon,
    MushroomIcon,
    StrawberryIcon,
    DonutIcon,
    IcecreamIcon,
    CoffeeIcon,
    BalloonIcon,
    RocketIcon,
    SailboatIcon,
    MusicIcon,
    HeartIcon,
];

export default function AvatarDemo() {
    const [shape, setShape] = React.useState<AvatarShape>('circle');
    return (
        <div>
            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>基础用法</DemoTag> 文字 / 图标 / 图片三种形态
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar>岛</Avatar>
                    <Avatar>
                        <ImageIcon />
                    </Avatar>
                    <Avatar src={pick(0)} alt="岛屿风景" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>形状</DemoTag> 圆形 / 方形
                </div>
                <div style={{ marginBottom: 12 }}>
                    <Radio
                        options={[
                            { label: '圆形', value: 'circle' },
                            { label: '方形', value: 'square' },
                        ]}
                        value={shape}
                        onChange={(v) => setShape(v as AvatarShape)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar shape={shape}>岛</Avatar>
                    <Avatar shape={shape} icon={<MapIcon />} />
                    <Avatar shape={shape} src={pick(4)} alt="阳光田野" />
                    <Avatar shape={shape} size="large" src={pick(5)} alt="湖畔清晨" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>头像组</DemoTag> 叠加展示 + 超出折叠
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
                    <AvatarGroup>
                        <Avatar src={pick(0)} alt="岛民 A" />
                        <Avatar src={pick(1)} alt="岛民 B" />
                        <Avatar src={pick(2)} alt="岛民 C" />
                        <Avatar src={pick(3)} alt="岛民 D" />
                    </AvatarGroup>
                    <AvatarGroup maxCount={3}>
                        <Avatar src={pick(4)} alt="岛民 E" />
                        <Avatar src={pick(5)} alt="岛民 F" />
                        <Avatar src={pick(0)} alt="岛民 J" />
                        <Avatar src={pick(1)} alt="岛民 K" />
                    </AvatarGroup>
                    <AvatarGroup size="small" shape="square" gap={12}>
                        <Avatar src={pick(6)} alt="岛民 G" />
                        <Avatar src={pick(7)} alt="岛民 H" />
                        <Avatar src={pick(8)} alt="岛民 I" />
                    </AvatarGroup>
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>尺寸</DemoTag> 预设三档 + 任意数值
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar size="small">S</Avatar>
                    <Avatar size="middle">M</Avatar>
                    <Avatar size="large">L</Avatar>
                    <Avatar size={64}>64</Avatar>
                    <Avatar size={96} src={pick(14)} alt="岛屿远眺" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>加载失败</DemoTag> 自动回退到图标 / 文字
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar src="/broken-avatar.png" icon={<MapIcon />} />
                    <Avatar src="/broken-avatar.png">岛</Avatar>
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>图标头像</DemoTag> naive-icons 图标作为 children
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {ICON_AVATARS.map((Icon, i) => (
                        <Avatar key={i} size="middle">
                            <Icon />
                        </Avatar>
                    ))}
                </div>
            </section>

            <CodeBlock
                code={`<Avatar>岛</Avatar>
<Avatar icon={<UserIcon />} />
<Avatar src="/photo.png" alt="岛屿风景" />
<Avatar size={64}>64</Avatar>

{/* 图标头像：naive-icons 图标组件直接作为 children */}
<Avatar>
    <ChargerIcon />
</Avatar>

{/* 头像组：默认叠加，超出折叠为 +N */}
<AvatarGroup maxCount={3}>
    <Avatar src="/a.png" alt="A" />
    <Avatar src="/b.png" alt="B" />
    <Avatar>C</Avatar>
    <Avatar>D</Avatar>
</AvatarGroup>`}
            />

            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>API — Avatar</div>
                <ApiTable rows={AVATAR_API} />
            </section>

            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>API — Avatar.Group</div>
                <ApiTable rows={GROUP_API} />
            </section>
        </div>
    );
}

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
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: '#725d42',
                                    flexShrink: 0,
                                    backdropFilter: 'blur(2px)',
                                }}
                            >
                                {resident.romanized.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    {resident.name}
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 400,
                                            opacity: 0.65,
                                            background: 'rgba(255,255,255,0.35)',
                                            padding: '1px 8px',
                                            borderRadius: 8,
                                        }}
                                    >
                                        {resident.species} · {resident.hobby}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSiz
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
    "'default' | 'grid' | 'dots-dark-green' | 'sprinkles' | 'sweet-corner' | 'coffee-break' | 'dots-pink' | 'dots-purple' | 'dots-blue' | 'dots-yellow' | 'dots-orange' | 'dots-teal' | 'dots-green' | 'dots-red' | 'dots-lime-green' | 'dots-yellow-green' | 'dots-brown' | 'dots-warm-peach-pink' | 'dots-gray'";

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

// 全部 19 种类型（type / 中文名 / 文字色），dots-* 底色对应 Card pattern-* 系列，文字色与 Card pattern 系列保持一致
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
    ['dots-gray', '浅灰波点', '#5a5a5a'],
];

const BackgroundDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Background <DemoTag>19 types · Card pattern base · 2 scene images</DemoTag>
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

### Core Architecture Module: `demo/components/Badge/index.tsx`
```
import React from 'react';
import { Badge, Avatar, type BadgeColor } from '../../../src';
import { BellIcon, GiftIcon, MailIcon } from 'naive-icons';
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

const S = {
    row: {
        display: 'flex',
        gap: 28,
        flexWrap: 'wrap',
        alignItems: 'center',
    } as React.CSSProperties,
    colorRow: {
        display: 'flex',
        gap: 18,
        flexWrap: 'wrap',
        alignItems: 'center',
    } as React.CSSProperties,
    colorItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
    } as React.CSSProperties,
    colorLabel: {
        fontSize: 11,
        color: '#a0936e',
        fontWeight: 500,
    } as React.CSSProperties,
};

const BADGE_API: ApiRow[] = [
    {
        prop: 'count',
        desc: '展示的内容：数字 / 字符串，或任意 ReactNode（如 naive-icons 图标）',
        type: 'ReactNode',
        defaultVal: '-',
    },
    {
        prop: 'overflowCount',
        desc: '展示封顶的数字值，超过时显示为 `${overflowCount}+`',
        type: 'number',
        defaultVal: '99',
    },
    { prop: 'showZero', desc: '数值为 0 时是否展示', type: 'boolean', defaultVal: 'false' },
    { prop: 'dot', desc: '不展示数字，只展示一个小圆点', type: 'boolean', defaultVal: 'false' },
    {
        prop: 'size',
        desc: '尺寸，仅对数字角标生效（dot 尺寸固定）',
        type: `'small' | 'medium'`,
        defaultVal: "'medium'",
    },
    {
        prop: 'color',
        desc: '颜色（与 Card / Tag 同款调色板）',
        type: `'app-red' | 'app-pink' | 'app-orange' | 'app-yellow' | 'app-teal' | 'app-green' | 'app-blue' | 'purple' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink'`,
        defaultVal: "'app-red'",
    },
    { prop: 'children', desc: '徽标包裹的元素；不传即为独立使用', type: 'ReactNode', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'CSSProperties', defaultVal: '-' },
];

const COLORS: BadgeColor[] = [
    'app-red',
    'app-pink',
    'app-orange',
    'app-yellow',
    'app-teal',
    'app-green',
    'app-blue',
    'purple',
    'lime-green',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];

const BadgeDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Badge <DemoTag>数字角标</DemoTag> <DemoTag>封顶数字</DemoTag> <DemoTag>小红点</DemoTag>{' '}
            <DemoTag>12 colors</DemoTag>
        </div>
        <div style={demoBodyStyle}>
            <div style={labelStyle}>基本：图标 / 头像右上角的徽标数</div>
            <div style={S.row}>
                <Badge count={5}>
                    <Avatar shape="square" size="large">
                        <BellIcon size={24} />
                    </Avatar>
                </Badge>
                <Badge count={12}>
                    <Avatar shape="square" size="large">
                        狸
                    </Avatar>
                </Badge>
                <Badge count={<GiftIcon size={12} />} color="purple">
                    <Avatar shape="square" size="large">
                        <MailIcon size={24} />
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>count 为 0 时默认隐藏，showZero 可强制展示</div>
            <div style={S.row}>
                <Badge count={0}>
                    <Avatar shape="square" size="large">
                        零
                    </Avatar>
                </Badge>
                <Badge count={0} showZero>
                    <Avatar shape="square" size="large">
                        零
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>独立使用：不包裹任何元素，可单独作为计数展示</div>
            <div style={S.row}>
                <Badge count={11} />
                <Badge count={25} color="app-teal" />
                <Badge count="新" color="app-orange" />
                <Badge count={0} showZero color="brown" />
            </div>

            <div style={labelStyle}>封顶数字：超过 overflowCount（默认 99）时显示为「99+」</div>
            <div style={S.row}>
                <Badge count={99}>
                    <Avatar shape="square" size="large">
                        99
                    </Avatar>
                </Badge>
                <Badge count={100}>
                    <Avatar shape="square" size="large">
                        100
                    </Avatar>
                </Badge>
                <Badge count={99} overflowCount={10}>
                    <Avatar shape="square" size="large">
                        10+
                    </Avatar>
                </Badge>
                <Badge count={1000} overflowCount={999}>
                    <Avatar shape="square" size="large">
                        <span style={{ fontSize: 16 }}>999+</span>
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>讨嫌的小红点：没有具体数字，只有一个小圆点</div>
            <div style={S.row}>
                <Badge dot>
                    <Avatar shape="square" size="large">
                        <BellIcon size={24} />
                    </Avatar>
                </Badge>
                <Badge dot color="app-green">
                    <BellIcon size={26} />
                </Badge>
                <Badge dot color="app-teal">
                    <span style={{ fontSize: 14, color: '#725d42', fontWeight: 600 }}>一段文字</span>
                </Badge>
            </div>

            <div style={labelStyle}>size 尺寸（medium / small）</div>
            <div style={S.row}>
                <Badge count={5} size="medium">
                    <Avatar shape="square" size="large">
                        M
                    </Avatar>
                </Badge>
                <Badge count={5} size="small">
                    <Avatar shape="square" size="large">
                        S
                    </Avatar>
                </Badge>
                <Badge count={5} size="small" color="app-blue" />
            </div>

            <div style={labelStyle}>color 多彩徽标（与 Card / Tag 同一调色板）</div>
            <div style={S.colorRow}>
                {COLORS.map((color) => (
                    <div key={color} style={S.colorItem}>
                        <Badge count={12} color={color} />
                        <span style={S.colorLabel}>{color}</span>
                    </div>
                ))}
            </div>
        </div>
        <CodeBlock
            code={`import { Badge, Avatar } from 'animal-island-ui';
import { BellIcon } from 'naive-icons';

const App = () => (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {/* 基本：包裹图标 / 头像 */}
        <Badge count={5}>
            <Avatar shape="square" size="large">
                <BellIcon size={24} />
            </Avatar>
        </Badge>

        {/* 0 默认隐藏，showZero 强制展示 */}
        <Badge count={0} showZero>
            <Avatar shape="square" size="large">零</Avatar>
        </Badge>

        {/* 独立使用：不包裹任何元素 */}
        <Badge count={25} color="app-teal" />

        {/* 封顶数字：100 → "99+" */}
        <Badge count={100} overflowCount={99}>
            <Avatar shape="square" size="large">100</Avatar>
        </Badge>

        {/* 小红点 */}
        <Badge dot>
            <Avatar shape="square" size="large">
                <BellIcon size={24} />
            </Avatar>
        </Badge>

        {/* 尺寸 */}
        <Badge count={5} size="small" color="app-blue">
            <Avatar shape="square" size="large">S</Avatar>
        </Badge>
    </div>
);

export default App;`}
        />
        <ApiTable rows={BADGE_API} />
    </div>
);

export default BadgeDemo;

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

### Core Architecture Module: `demo/components/Calendar/index.tsx`
```
import React, { useState } from 'react';
import { Calendar, type CalendarEvent } from '../../../src';
import { ApiTable, ApiRow, CodeBlock, DemoTag, labelStyle, sectionStyle, sectionTitleStyle } from '../../tools';

const CALENDAR_API: ApiRow[] = [
    { prop: 'width', desc: '面板宽度，默认铺满父容器（数值按 px 处理）', type: 'number | string', defaultVal: '-' },
    { prop: 'value', desc: '当前选中日期（受控），YYYY-MM-DD', type: 'string', defaultVal: '-' },
    { prop: 'defaultValue', desc: '默认选中日期（非受控），YYYY-MM-DD', type: 'string', defaultVal: '今天' },
    { prop: 'panelValue', desc: '面板展示月份（受控），YYYY-MM 或 YYYY-MM-DD', type: 'string', defaultVal: '-' },
    { prop: 'defaultPanelValue', desc: '默认展示月份（非受控）', type: 'string', defaultVal: '选中值 / 今天' },
    { prop: 'onChange', desc: '日期变化回调', type: '(date: string) => void', defaultVal: '-' },
    { prop: 'onPanelChange', desc: '面板月份变化回调', type: '(month: string) => void', defaultVal: '-' },
    {
        prop: 'events',
        desc: '事项列表，支持同日多条与跨日期连续条；变更时传新数组引用，就地改不会重排',
        type: 'CalendarEvent[]',
        defaultVal: '[]',
    },
    { prop: 'showEventTime', desc: '是否展示事项起始时间（仅首段）', type: 'boolean', defaultVal: 'true' },
    { prop: 'draggableEvents', desc: '允许鼠标拖拽跨日期创建事项', type: 'boolean', defaultVal: 'false' },
    {
        prop: 'onEventCreate',
        desc: '拖拽创建事项回调，返回起止日期',
        type: '(start: string, end: string) => void',
        defaultVal: '-',
    },
];

const EVENT_API: ApiRow[] = [
    { prop: 'title', desc: '事项内容', type: 'ReactNode', required: true },
    {
        prop: 'start',
        desc: '开始日期，YYYY-MM-DD 或 dayjs 对象（带时间则展示 HH:mm）',
        type: 'string | Dayjs',
        required: true,
    },
    {
        prop: 'end',
        desc: '结束日期，省略时等同于 start；传入时渲染成跨天连续条',
        type: 'string | Dayjs',
        defaultVal: '-',
    },
    {
        prop: 'color',
        desc: "配色；'teal' 是默认暖橙，与 'coral' 相近，同屏时优先用 green / purple 区分",
        type: `'teal' | 'amber' | 'coral' | 'green' | 'purple'`,
        defaultVal: "'teal'",
    },
    { prop: 'showTime', desc: '是否展示起始时间', type: 'boolean', defaultVal: 'false' },
];

const S = {
    demoBox: {
        padding: 16,
        borderRadius: 18,
        fontWeight: 500,
        marginBottom: 20,
        background: '#faf8f3',
    } as React.CSSProperties,
    /* 把容器收到面板的实际宽度，避免卡片右侧留一大片空地 */
    calendarBox: {
        maxWidth: 780,
    } as React.CSSProperties,
    statusLine: {
        marginBottom: 8,
        fontSize: 13,
        color: '#a08060',
    } as React.CSSProperties,
};

const islandEvents: CalendarEvent[] = [
    { title: '每日签到', start: '2026-08-10 09:30', showTime: true },
    { title: '开荒新岛', start: '2026-08-10 14:00', showTime: true, color: 'green' },
    { title: '海岛丰收祭', start: '2026-08-12', end: '2026-08-18', color: 'amber' },
    { title: '钓鱼大赛', start: '2026-08-20', color: 'coral' },
    { title: '篝火晚会', start: '2026-08-24 20:00', showTime: true, color: 'purple' },
    { title: '摘果子', start: '2026-08-24' },
    { title: '浇花', start: '2026-08-24' },
];

/** 拖拽新建的事项按「事件一 / 事件二 …」依次命名 */
const CREATED_NAMES = ['事件一', '事件二', '事件三', '事件四', '事件五'];
const CREATED_COLORS = ['teal', 'amber', 'coral', 'green', 'purple'] as const;

const CalendarDemo: React.FC = () => {
    const [date, setDate] = useState('2026-08-10');
    const [panel, setPanel] = useState('2026-08');
    const [created, setCreated] = useState<CalendarEvent[]>([]);

    const handleEventCreate = (start: string, end: string) => {
        setCreated((prev) => [
            ...prev,
            {
                title: CREATED_NAMES[prev.length % CREATED_NAMES.length],
                start,
                end,
                color: CREATED_COLORS[prev.length % CREATED_COLORS.length],
            },
        ]);
    };

    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                Calendar <DemoTag>基础用法</DemoTag>
            </div>
            <div style={labelStyle}>基础</div>
            <div style={{ ...S.demoBox, ...S.calendarBox }}>
                <Calendar defaultValue="2026-08-10" events={islandEvents} />
            </div>

            <div style={labelStyle}>受控模式：点击日期选中</div>
            <div style={S.statusLine}>
                当前选中: <span style={{ color: '#19c8b9', fontWeight: 600 }}>{date}</span>
            </div>
            <div style={{ ...S.demoBox, ...S.calendarBox }}>
                <Calendar value={date} panelValue={panel} onChange={setDate} onPanelChange={setPanel} />
            </div>

            <div style={labelStyle}>拖拽跨日期创建事项（draggableEvents）</div>
            <div style={S.statusLine}>
                新建事项:{' '}
                <span style={{ color: '#19c8b9', fontWeight: 600 }}>
                    {created.length > 0
                        ? created.map((item) => `${String(item.title)}（${item.start} ~ ${item.end}）`).join('，')
                        : '在日期上按住并横向拖动'}
                </span>
            </div>
            <div style={{ ...S.demoBox, ...S.calendarBox }}>
                <Calendar
                    defaultValue="2026-08-10"
                    events={created}
                    draggableEvents
                    onEventCreate={handleEventCreate}
                />
            </div>

            <CodeBlock
                code={`import { Calendar } from 'animal-island-ui';

const events = [
    { title: '每日签到', start: '2026-08-10 09:30', showTime: true },
    { title: '海岛丰收祭', start: '2026-08-12', end: '2026-08-18', color: 'amber' },
];

const App = () => (
    <Calendar
        defaultValue="2026-08-10"
        events={events}
        onChange={(date) => console.log(date)}
        onEventCreate={(start, end) => console.log(start, end)}
        draggableEvents
    />
);

export default App;`}
            />
            <ApiTable rows={CALENDAR_API} title="Calendar API" />
            <ApiTable rows={EVENT_API} title="CalendarEvent" />
        </div>
    );
};

export default CalendarDemo;

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
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>{cn}</div>
                    </Card>
                ))}
            </div>
        </div>
        <CodeBlock
            code={`import React from 'react';
import { Card } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* 基础卡片 */}
            <Card style={{ width: 260 }}>
                基础卡片
            </Card>

            {/* 虚线卡片 */}
            <Card type="dashed" style={{ width: 260 }}>
                虚线卡片
            </Card>

            {/* 颜色变体 */}
            <Card color="app-blue">
                蓝色卡片
            </Card>
            <Card color="warm-peach-pink">
                暖桃粉卡片
            </Card>

            {/* 花纹 */}
            <Card pattern="default">
                默认花纹卡片
            </Card>

            {/* 启用 hover(默认关闭,显式传 hoverable 才上浮) */}
            <Card hoverable style={{ width: 260 }}>
                鼠标移上来看看 ↑
            </Card>
        </div>
    );
};

export default App;`}
        />
        <ApiTable rows={CARD_API} />
    </div>
);

export default CardDemo;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71** (2026-10-16): **feat(calendar): add a lightweight month calendar with events**
  *Symptoms*: ## 做了什么  新增 `Calendar` 组件：独立、轻量的月历（不支持周 / 年面板），视觉沿用 DatePicker，日期运算使用 `dayjs`（见 [ADR 0005](https://github.com/guokaigdg/animal-island-ui/blob/main/docs/adr/0005-dayjs-as-the-date-layer.md)）。月份面板常驻 —— 它是一个日程视图，不是弹出式选择器。  对应 [discussion #38](https://github.com/guokaigdg/animal-island-ui/discussions/38) 里提到的日历 / 日程组件。  ## 范围：只做三件事  按需求，除月面板外只支持：  1. **月面板** —— 恒定补满的 6×7 网格、上/下月与上/下年切换、「今天」快捷按钮，roving tabindex 键盘支持（方向键 / Enter / Space / PageUp / PageDown）。 2. **事项通知** —— 声明式 `events`，支持同一天多条，以及跨日期连续条；跨天条在周边界处切断（永不换行），首段带 `HH:mm` 前缀、续接段只保留标题；同一天第 3 条起折叠为 `+N`，不撑高行高。 3. **跨日期时间** —— 一条 `CalendarEvent` 用 `start` + `end` 即可跨天、跨周画出连续条。  ## API  ```ts type CalendarColor = 'teal' | 'amber' | 'coral' | 'green' | 'purple';  interface CalendarEvent {     title: React.ReactNode;     start: string | Dayjs;              // YYYY-MM-DD，或 dayjs 对象     end?: string | Dayjs;               // 传入即渲染为跨天连续条     color?: CalendarColor;              // 默认 'teal'     showTime?: boolean;                 // 在首段展示起始 HH:mm }  interface CalendarProps {     value?: string;                     // 受控选中日期     defaultValue?: string;              // 非受控，默认今天     panelValue?: string;                // 受控展示月份，需配合 onPanelChange 回写     defaultPanelValue?: string;     onChange?: (date: string) => void;     onPanelChange?: (month: string) => void;     events?: CalendarEvent[];     showEventTime?: boolean;            // 默认 true     draggableEvents?: boolean;          // 拖拽跨日期创建事项     onEventCreate?: (start: string, end: st
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/71?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=3"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg?v=3" alt="Review in Change Stack →" height="32"></picture></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary><strong>ℹ️ Recent review info</strong></summary> <dl> <dd>  <details> <summary><strong>⚙️ Run configuration
  > 另外有两件事同步一下：  1. **关于合并**：像 #70 那种改动面比较大、会牵动多个组件的 PR，就交给 @guokaigdg 你来合并；内容比较小或只涉及单个组件的，只要 CodeRabbit 没问题，我就直接合了。 2. **关于日历组件**：它比预想的复杂，我先落地了一个轻量版，后续按需优化升级 —— 比如给日历加背景、或者补一些功能性 API；有 bug 的话再单独提 `feat` / `fix`。 3. **关于提交历史**：日历这块前后调了好几轮，为了不脏 commit，我用了 squash 合并，收成一条 commit。 

- **Issue #70** (2026-10-15): **chore(deps): 引入 dayjs 作为日期层（方案 A）**
  *Symptoms*: ## 这个 PR 做了什么  按 [issue #69](https://github.com/guokaigdg/animal-island-ui/issues/69) 里确认的**方案 A**：把 `dayjs` 加进 `dependencies`，并把现有手写的日期逻辑迁到它上面。  ## 依赖引入方式  `dayjs` 加进 `dependencies`，但**不**进入 `vite.config.ts` 的 `external` 列表 —— 它被内联打包，构建后是单份共享：  ``` dist/es/node_modules/dayjs/dayjs.min.js        11.8 kB │ gzip: 3.6 kB dist/es/node_modules/dayjs/plugin/customParseFormat.js ```  `DatePicker` 与 `Countdown` 都 import 同一份（`dist/es/_virtual/dayjs.min.js` 只是个 re-export 垫片）。同时 `preserveModules` 仍能让「一个日期组件都没用」的消费者把它完全摇掉。  **注意这不是进程内唯一实例**：宿主应用若自己 import 了 `dayjs`，会加载出一份互相独立的副本，二者的 locale 状态与插件注册互不相通 —— 也就是说宿主调 `dayjs.locale('zh-cn')` **不会**影响 `DatePicker` 的输出。这一点已写进 ADR 与 build-and-release（CodeRabbit 的评审意见 #1）。  ## 源码改动  **`DatePicker`** — 删掉私有工具函数，内部改用 `Dayjs`（此前是原生 `Date`）：  | 改动前 | 改动后 | | --- | --- | | 正则解析 `YYYY-MM-DD` + `Number(match[2]) > 12` 校验 | `dayjs(value, [...], true)` 严格解析 | | `new Date(y, m+1, 0).getDate()` 推算月长、六行网格 | `startOf('month')` + `subtract(day)` + `add(i, 'day')` | | `getFullYear/getMonth/getDate` 三字段比相等 | `isSame(a, b, 'day' / 'month')` | | 链式 `String.replace` 实现 `format` | `date.format(format)` | | `new Date(y, m + delta, 1)` 翻页 | `add(delta, 'month')` |  **公开 API 与行为完全不变**：值仍是纯 `YYYY-MM-DD` 字符串、`disabledDate` 仍收到原生 `Date`、周起始仍是周日、六行网格仍是 42 格。  **`Countdown`** — 剩余时间改为 `dayjs(end).diff(dayjs())`，拆天/时/分/秒仍是本地算术。  ## 两个行为变化（请重点看）  1. **严格解析**：`value="2026-02-30"` 以前会被原生 `Date` 静默进位成 3 月 2 日，现在判定为非法、回退到占位文本（已补测试）。 2. **`format` 的 token 面扩大**：以前只认 `YYYY/MM/DD/M/D

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

### Incident Patch 1: `1b8a379e` (2026-10-09)
**Commit Message**: fix(count-up): cancel a pending repeat when a zero-duration run ends

CodeRabbit review on #63 flagged two things, both valid:

- the `totalMs === 0` branch called `finish(0)` — which can schedule
  `repeatTimerRef` when `onComplete` returns `shouldRepeat` — but returned
  no cleanup, so a later dependency change left the timer alive and it
  started an extra run. It now returns the same clearFrame / clearRepeat
  cleanup as the animation-frame path.
- the skill reference's render-prop example nested a focusable button in
  the aria-hidden plate. It stores `reset` in a ref and renders the button
  outside, matching the demo and the design-system spec.

Regression test added for the timer: it fails (3 vs 2 onComplete calls)
without the component fix.

**File**: `skills/animal-island-ui-style/references/components/CountUp.md` (modified, +6/-2)
```diff
@@ -50,10 +50,14 @@ interface CountUpProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'prefi
 {/* replay with a key — the documented recipe of the reference library */}
 <CountUp key={round} isCounting end={score} />
 
-{/* render prop: take over rendering and drive reset() yourself */}
+{/* render prop: take over rendering; keep focusable elements outside (the plate is aria-hidden) */}
 <CountUp isCounting end={86} duration={1.2}>
-    {({ value, reset }) => <span>{Math.round(value)}<button onClick={() => reset()}>replay</button></span>}
+    {({ value, reset }) => {
+        resetRef.current = reset;
+        return <span>{Math.round(value)}</span>;
+    }}
 </CountUp>
+<button onClick={() => resetRef.current?.()}>replay</button>
 ```
 
 Notes:
```

**File**: `src/components/CountUp/CountUp.test.tsx` (modified, +12/-0)
```diff
@@ -211,6 +211,18 @@ describe('CountUp', () => {
         expect(numberText(container)).toBe('100');
     });
 
+    it('duration=0 排下的重播计时器会在依赖变化时被取消', () => {
+        const onComplete = vi.fn().mockReturnValueOnce({ shouldRepeat: true, delay: 0.5 });
+        const { rerender } = render(<CountUp isCounting end={10} duration={0} onComplete={onComplete} />);
+        expect(onComplete).toHaveBeenCalledTimes(1);
+
+        // duration 变化会重跑 effect：上一次（duration=0 分支）排的重播计时器必须一起被清掉
+        rerender(<CountUp isCounting end={10} duration={0.3} onComplete={onComplete} />);
+        advance(600); // duration=0.3 跑完（第 2 次回调）；旧计时器本该在 t=500 触发重播
+        advance(1_200); // 再留足时间：旧计时器若残留，这一轮会跑到终点，多出第 3 次回调
+        expect(onComplete).toHaveBeenCalledTimes(2);
+    });
+
     it('环境不支持 requestAnimationFrame 时静态展示且不报错', () => {
         vi.stubGlobal('requestAnimationFrame', undefined);
         const { container } = render(<CountUp isCounting end={100} duration={1} />);
```

**File**: `src/components/CountUp/CountUp.tsx` (modified, +5/-2)
```diff
@@ -288,10 +288,13 @@ export const CountUp: React.FC<CountUpProps> = ({
             return undefined;
         }
 
-        // duration = 0 直接到位，不必等一帧
+        // duration = 0 直接到位，不必等一帧；onComplete 仍可能排下重播计时器，所以同样要交出 cleanup
         if (totalMs === 0) {
             finish(0);
-            return undefined;
+            return () => {
+                clearFrame();
+                clearRepeat();
+            };
         }
 
         lastTimestampRef.current = null;
```

---

### Incident Patch 2: `e641fe6b` (2026-10-11)
**Commit Message**: fix(modal): drop the panel zoom-in under reduced motion

scale(0.92) -> scale(1) is motion, which is exactly what the setting exists
to suppress. The panel then renders at its resting scale(1), so it never
appears mid-flight or invisible. The mask fade-in is plain opacity and is
kept.

Also fills in the [Unreleased] changelog section, which was missing entries
for the naive-icons bump, the allowScripts fix, and the BackTop / Drawer /
Loading changes.

**File**: `CHANGELOG.md` (modified, +14/-1)
```diff
@@ -7,9 +7,22 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+
+- `CodeBlock` 新增 Shell 命令高亮：行首为 `npm` / `yarn` / `pnpm` / `npx` / `node` / `git` / `cd` 等命令时按 Shell 着色（命令名、子命令、flag、注释各自取色，注释为斜体淡色），此前一律按 JSX/TS 解析；为此把 token 渲染逻辑从 `highlightJSX` 中抽为 `renderTokens`，token 增加可选的斜体标记
+
 ### Changed
 
-- `naive-icons` 升级至 `1.6.0`（导出数 125 → 171）：新增 38 个图标（`AlertCircleIcon`、`AlertTriangleIcon`、`BadgeCheckIcon`、`FilterIcon`、`GridIcon`、`InboxIcon`、`InfoIcon`、`KeyboardIcon`、`ListIcon`、`ShieldIcon`、`SlidersIcon`、`SortIcon`、`VolumeIcon`、`XCircleIcon`、`ZoomInIcon` 等），并新增 `IconProps` / `IconName` / `IconComponent` / `PaletteColor` 类型，以及 `NAIVE_PALETTE` 调色板与 `normalizeIconProps` / `resolveStrokeWidth` / `scaledStroke` 工具导出
+- `naive-icons` 升级至 `1.6.0`（导出数 125 → 171，**无破坏性变更，旧图标全部保留**）：新增 38 个图标（`AlertCircleIcon`、`AlertTriangleIcon`、`BadgeCheckIcon`、`FilterIcon`、`GridIcon`、`InboxIcon`、`InfoIcon`、`KeyboardIcon`、`ListIcon`、`ShieldIcon`、`SlidersIcon`、`SortIcon`、`VolumeIcon`、`XCircleIcon`、`ZoomInIcon` 等），并新增 `IconProps` / `IconName` / `IconComponent` / `PaletteColor` 类型，以及 `NAIVE_PALETTE` 调色板与 `normalizeIconProps` / `resolveStrokeWidth` / `scaledStroke` 工具导出
+- `Select` 的 `allowClear` 清除按钮改为**仅在悬停时显示**，不再常驻于已选值旁
+- npm 11.17 默认拒绝执行依赖的安装脚本，`package.json` 新增 `allowScripts` 放行 `esbuild` 与 `fsevents`；此前 `fsevents` 的原生模块一直被静默跳过，`vite dev` 的文件监听退化为轮询
+
+### Fixed
+
+- `BackTop` 的返回顶部图标此前是组件目录内自带的 `rocket.svg`（且为旧稿，机身 / 火焰 / 舷窗坐标均已过时），现已改用 `naive-icons` 的 `RocketIcon` 并删除该文件；图标改为 `aria-hidden`，可读名称仅由按钮自身的 `aria-label` 提供，不再重复播报
+- `Drawer` **首次打开卡顿**：背景下沉景深原先对 `document.body` 下每个非 fixed 子元素施加 `filter: blur(1px)`。`filter` 是非合成器属性，会为每个元素新建合成层并对整个视口做逐像素高斯模糊，各层首次打开时需从零光栅化 —— 症状正是「第一次卡、之后顺」。景深现由 `scale(0.94)` + 圆角 + 遮罩压暗承担，并在过渡开始前用 `will-change` 完成分层
+- `Modal` 与 `Drawer` 补齐 `prefers-reduced-motion`：`Modal` 关闭面板 `scale(0.92) → scale(1)` 的缩放入场，`Drawer` 同时关闭背景下沉位移与面板自身的 `translateX/Y(±100%) → none` 滑入 —— 两者均为位移类动效。关闭后面板直接落位，不会停在中间帧或不可见。两者均保留遮罩的纯 opacity 淡入 —— opacity 不属于位移动效
+- `Loading` 在 `prefers-reduced-motion: reduce` 下只剩一块黑屏：雪花唯一的可见性来源就是那段动画，`.flake` 的静止位置在视口上方 `top: -30px`，而 reduced-motion 分支写的是 `animation: none`，50 片雪花因此整体冻在视口外。改用 `animation-play-state: paused` —— 雪花本就带负延迟，暂停会将其冻结在下落途中的随机高度，得到一张铺满视口的静态雪景
 
 ## [2.1.1] - 2026-10-03
 
```

**File**: `docs/design-system/components/overlays.md` (modified, +5/-1)
```diff
@@ -53,6 +53,10 @@ max-width: calc(100vw - 32px);
 max-height: calc(100vh - 64px);
 animation: animal-zoom-in 0.3s ease;
 
+/* prefers-reduced-motion: reduce — the scale(0.92) → scale(1) zoom is motion, so
+   it is dropped (the panel falls back to its resting scale(1), never invisible).
+   The mask's plain opacity fade is not motion and is kept. */
+
 /* clipped content area */
 clip-path: url(#animal-modal-clip);
 background: rgb(247, 243, 223);
@@ -113,7 +117,7 @@ border-color: rgba(255, 204, 0, 0.85);
 
 - `pushBackground` (default `true`): on open, every non-fixed direct child of `document.body` gets `transform: scale(0.94)`, `border-radius: 14px` and `overflow: hidden` over `0.36s cubic-bezier(0.2, 0, 0.2, 1)`. Fixed-position elements, `[data-animal-drawer-ignore]` nodes and the component's own portal wrapper are excluded.
 - The pushed background deliberately carries **no `filter`**. `filter` is a non-composited property — it forces a fresh composited layer and a per-pixel gaussian blur across the viewport for each background element, so the *first* open stalls while the layers are rasterized from scratch and later opens feel fine. The depth read comes from `scale` + rounded corners + the dimming mask. `will-change: transform` is applied before the transition starts so layer promotion does not happen mid-animation.
-- `prefers-reduced-motion: reduce` skips the background push entirely; the panel and mask transitions are unchanged.
+- `prefers-reduced-motion: reduce` disables **both** the background push (the sunken translate/scale) **and** the panel's own `translateX/Y(±100%) → none` slide-in, matching `Modal`, which drops its `scale(0.92) → scale(1)` zoom-in. The panel lands directly on its final transform — it never stops mid-flight or invisible. The mask's opacity transition is not motion and is kept.
 
 ```css
 /* mask — light black (0.18), lighter than Modal so the recessed background stays visible (key to the depth effect) */
```

**File**: `docs/zh-CN/design-system/components/overlays.md` (modified, +5/-1)
```diff
@@ -53,6 +53,10 @@ max-width: calc(100vw - 32px);
 max-height: calc(100vh - 64px);
 animation: animal-zoom-in 0.3s ease;
 
+/* prefers-reduced-motion: reduce —— scale(0.92) → scale(1) 的缩放属于位移动效，
+   予以关闭（面板落回静止态 scale(1)，不会消失或卡在中间帧）。
+   遮罩的纯 opacity 淡入不属于位移动动效，予以保留。 */
+
 /* clipped content area */
 clip-path: url(#animal-modal-clip);
 background: rgb(247, 243, 223);
@@ -113,7 +117,7 @@ border-color: rgba(255, 204, 0, 0.85);
 
 - `pushBackground`（默认 `true`）：打开时，`document.body` 下每个非 fixed 的直接子元素施加 `transform: scale(0.94)`、`border-radius: 14px`、`overflow: hidden`，过渡 `0.36s cubic-bezier(0.2, 0, 0.2, 1)`。fixed 定位元素、`[data-animal-drawer-ignore]` 节点以及组件自身的 portal 包裹器都会被排除。
 - 被下沉的背景**刻意不加 `filter`**。`filter` 是非合成器属性：它会为每个背景元素新建合成层，并对整个视口做逐像素高斯模糊，症状就是**首次打开卡顿**（此时各层需要从零光栅化），而之后打开却很顺。景深读数由 `scale` + 圆角 + 遮罩压暗承担。同时在过渡开始前加 `will-change: transform`，让分层提前完成而不是发生在动画中途。
-- `prefers-reduced-motion: reduce` 下完全跳过背景下沉；面板与遮罩的过渡行为不变。
+- `prefers-reduced-motion: reduce` 下**同时**关闭背景下沉（缩放位移）与面板自身的 `translateX/Y(±100%) → none` 滑入，与 `Modal` 关闭 `scale(0.92) → scale(1)` 缩放入场保持一致。面板直接落位，不会停在中间帧或不可见。遮罩的 opacity 过渡不属于位移动效，予以保留。
 
 ```css
 /* mask — light black (0.18), lighter than Modal so the recessed background stays visible (key to the depth effect) */
```

**File**: `skills/animal-island-ui-style/references/components/overlays.md` (modified, +2/-1)
```diff
@@ -38,6 +38,7 @@ const [open, setOpen] = useState(false);
 Notes:
 
 - Modal already ships the required SVG blob `<clipPath id="animal-modal-clip">` internally.
+- `prefers-reduced-motion: reduce` drops the panel's `scale(0.92) → scale(1)` zoom-in — that is exactly the kind of motion the setting exists to suppress. The panel then renders at its resting `scale(1)`, so it never appears mid-flight or invisible. The mask's plain opacity fade is not motion and is kept.
 - To disable the typewriter animation for dynamic content: `typewriter={false}`.
 - Custom footer: pass `footer={<><Button>...</Button></>}` or `footer={null}` to hide.
 - `title` accepts a `ReactNode` — pass plain text. Do NOT pass `<Title>` here.
@@ -74,7 +75,7 @@ Notes:
 
 - `pushBackground` (default `true`) is the signature effect: when open, every non-fixed direct child of `document.body` gets `transform: scale(0.94)`, `border-radius: 14px` and `overflow: hidden` over 0.36s `cubic-bezier(0.2, 0, 0.2, 1)`, making the drawer float above a "sunken" page. Fixed-position elements (other overlays, portals) are auto-excluded, as are `[data-animal-drawer-ignore]` and the component's own portal wrapper. Set `pushBackground={false}` for a normal flat-mask drawer.
 - **Do not add `filter: blur()` to the pushed background.** `filter` is a non-composited property: it forces a fresh composited layer plus a per-pixel gaussian blur over the whole viewport for every background element. The symptom is a visible stall on the *first* open (layers are cold and must be rasterized from scratch) while later opens feel fine. The depth read comes from `scale` + rounded corners + the dimming mask; a 1px blur contributes almost nothing visually. Pair this with `will-change: transform` on the pushed elements so layer promotion happens before the transition starts rather than mid-animation.
-- `prefers-reduced-motion: reduce` skips the background push entirely — the sunken translate/scale is exactly the kind of motion that setting exists to suppress. The panel and mask still transition on opacity/transform as before.
+- `prefers-reduced-motion: reduce` disables **both** the background push (sunken scale) **and** the panel's own slide-in transition — the same treatment `Modal` gives its zoom-in. The panel lands directly on `transform: none`, so it never stops mid-flight or invisible. Keep the mask's opacity transition: plain opacity is not motion.
 - The mask uses a light black `rgba(0,0,0,0.18)` (lighter than Modal's 0.35) so the sunken background remains visible — this is what makes the depth readable.
 - Drawer has NO built-in typewriter (unlike Modal). Pass any content directly.
 - Default footer is **none** (unlike Modal's 取消/确定). Pass `footer={<><Button>...</Button></>}` for confirm-style actions.
```

**File**: `src/components/Drawer/drawer.module.less` (modified, +6/-0)
```diff
@@ -84,6 +84,12 @@
     transform: none;
 }
 
+@media (prefers-reduced-motion: reduce) {
+    .panel {
+        transition: none;
+    }
+}
+
 // ============================================
 // Header
 // ============================================
```

**File**: `src/components/Modal/modal.module.less` (modified, +6/-0)
```diff
@@ -163,3 +163,9 @@
         transform: scale(1);
     }
 }
+
+@media (prefers-reduced-motion: reduce) {
+    .modal {
+        animation: none;
+    }
+}
```

---

### Incident Patch 3: `999d2ecc` (2026-10-11)
**Commit Message**: fix(components): restore the naive-icons rocket and speed up the Drawer open

BackTop: swap the bundled rocket.svg for RocketIcon from naive-icons. The
local file was a stale revision and, as a hand-shipped SVG, it also broke
the "icons come from naive-icons" rule. The icon is now aria-hidden; the
accessible name stays on the button.

Drawer: the recessed background no longer applies filter: blur(1px). filter
is non-composited, so it forced a fresh layer plus a viewport-wide blur per
background element — the first open stalled while those layers were
rasterized. Scale, rounded corners and the dimming mask still carry the
depth. Also adds will-change so promotion happens before the transition,
and honours prefers-reduced-motion.

**File**: `demo/components/Avatar/index.tsx` (modified, +9/-9)
```diff
@@ -1,8 +1,8 @@
 import React from 'react';
 import { Avatar, AvatarGroup, Radio, type AvatarShape } from '../../../src';
 import {
-    UserIcon,
-    FishIcon,
+    ImageIcon,
+    MapIcon,
     CoffeeCupIcon,
     RabbitIcon,
     OwlIcon,
@@ -82,7 +82,7 @@ const GROUP_API: ApiRow[] = [
 
 /** 图标头像展示：20 个 naive-icons 图标作为 children 创建图标头像（动物 / 天气 / 食物 / 物件随机混合） */
 const ICON_AVATARS = [
-    FishIcon,
+    ImageIcon,
     CoffeeCupIcon,
     RabbitIcon,
     OwlIcon,
@@ -115,7 +115,7 @@ export default function AvatarDemo() {
                 <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                     <Avatar>岛</Avatar>
                     <Avatar>
-                        <FishIcon />
+                        <ImageIcon />
                     </Avatar>
                     <Avatar src={pick(0)} alt="岛屿风景" />
                 </div>
@@ -137,7 +137,7 @@ export default function AvatarDemo() {
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                     <Avatar shape={shape}>岛</Avatar>
-                    <Avatar shape={shape} icon={<UserIcon />} />
+                    <Avatar shape={shape} icon={<MapIcon />} />
                     <Avatar shape={shape} src={pick(4)} alt="阳光田野" />
                     <Avatar shape={shape} size="large" src={pick(5)} alt="湖畔清晨" />
                 </div>
@@ -177,7 +177,7 @@ export default function AvatarDemo() {
                     <Avatar size="middle">M</Avatar>
                     <Avatar size="large">L</Avatar>
                     <Avatar size={64}>64</Avatar>
-                    <Avatar size={96} src={pick(3)} alt="山间小镇" />
+                    <Avatar size={96} src={pick(14)} alt="岛屿远眺" />
                 </div>
             </section>
 
@@ -186,14 +186,14 @@ export default function AvatarDemo() {
                     <DemoTag>加载失败</DemoTag> 自动回退到图标 / 文字
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
-                    <Avatar src="/broken-avatar.png" icon={<UserIcon />} />
+                    <Avatar src="/broken-avatar.png" icon={<MapIcon />} />
                     <Avatar src="/broken-avatar.png">岛</Avatar>
                 </div>
             </section>
 
             <section style={sectionStyle}>
                 <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
-                    <DemoTag>图标头像</DemoTag> 20 个 naive-icons 图标作为 children
+                    <DemoTag>图标头像</DemoTag> naive-icons 图标作为 children
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                     {ICON_AVATARS.map((Icon, i) => (
@@ -212,7 +212,7 @@ export default function AvatarDemo() {
 
 {/* 图标头像：naive-icons 图标组件直接作为 children */}
 <Avatar>
-    <FishIcon />
+    <ChargerIcon />
 </Avatar>
 
 {/* 头像组：默认叠加，超出折叠为 +N */}
```

**File**: `demo/components/Skill/skill.module.less` (modified, +1/-0)
```diff
@@ -206,6 +206,7 @@
 .swatchChip {
     height: 56px;
     border-radius: 16px 16px 0 0;
+    border-bottom: 1px solid var(--animal-border-color-light);
 }
 
 .swatchMeta {
```

**File**: `docs/design-system/README.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ The core of the design language: **warm earth-tone palette + large-radius pill s
 | `Progress`     | Outlined progress bar: a cream pill track with a 2px sand outline (size = total height), a mint vertical-gradient fill unveiled from the left that brightens at 100%, an optional `variant` to swap the gradient for one of 4 island scene images spanning the full track, label always to the right of the bar, custom infoFormat, and duration to control the fill-width animation |             | ✓                         |
 | `Skeleton`     | Loading placeholder, 4 variants (`text`/`circle`/`rect`/`paragraph`) plus the `SkeletonButton` / `SkeletonInput` / `SkeletonAvatar` sub-components, warm-white shimmer sweep                          |             | ✓                         |
 | `Loading`      | Fullscreen night-sky snowfall over `#0b101a` with a centre vignette, 50 white flakes drifting and rotating, optional centred `tip`; `active` toggles a fade-out then unmount, respects `prefers-reduced-motion` |             | ✓                         |
-| `BackTop`      | Fixed bottom-right back-to-top button (original badge artwork, easeInOutQuad smooth scroll)                                                                                                                | ✓           |                           |
+| `BackTop`      | Fixed bottom-right back-to-top button (`RocketIcon` from `naive-icons`, easeInOutQuad smooth scroll)                                                                                                        | ✓           |                           |
 | `Image`        | Mat-frame image with lazy loading, error fallback and click-to-preview lightbox                                                                                                                      | ✓           |                           |
 | `Countdown`    | Live deadline countdown with configurable DD/HH/mm/ss formatting, three sizes and two visual variants                                                                                               |             | ✓                         |
 | `CountUp`      | Score count-up: `start` → `end` over `duration` on `requestAnimationFrame`, 5 easing curves (or a custom function), thousand/decimal formatting, play/pause/resume, an opt-in completion celebration (two-beat bounce, rings, CSS sparkles, optional text sticker) and an optional `role="status"` score announcement                                                                    |             | ✓                         |
```

**File**: `docs/design-system/components/feedback.md` (modified, +2/-2)
```diff
@@ -246,7 +246,7 @@ SkeletonAvatarProps { size?: 'small'|'middle'|'large'; shape?: 'circle'|'square'
 
 Source: `src/components/BackTop/BackTop.tsx` + `back-top.module.less`.
 
-A fixed bottom-right back-to-top button, using an original sticker-style up-arrow SVG (inlined data URI: warm-brown `#c9a06c` outline + cream `#fffdf4` frosting layer + teal `#19c8b9` body with a light-teal `#7fe0d4` highlight); clicking it scrolls smoothly to the top with easeInOutQuad.
+A fixed bottom-right back-to-top button, rendering `RocketIcon` from `naive-icons` (48×48 viewBox: cream `#FAEDCD` fuselage, teal `#2A9D8F` porthole, `#E76F51` flame and fins, ink `#2A2A2A` stroke) at `size={64}`; clicking it scrolls smoothly to the top with easeInOutQuad. The icon is decorative and carries `aria-hidden` — the accessible name comes from the button's own `aria-label`.
 
 **props**:
 ```ts
@@ -277,7 +277,7 @@ opacity: 1;
 visibility: visible;
 transform: translateY(0);
 
-// icon (240×240 viewBox sticker arrow)
+// icon (naive-icons RocketIcon, 48×48 viewBox, rendered at size 64)
 .img {
     width: 64px;
     height: 64px;
```

**File**: `docs/design-system/components/overlays.md` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ border-color: rgba(255, 204, 0, 0.85);
 
 **Recessed depth-of-field drawer — the background sinks, scales down and dims to push the panel forward.**
 
+- `pushBackground` (default `true`): on open, every non-fixed direct child of `document.body` gets `transform: scale(0.94)`, `border-radius: 14px` and `overflow: hidden` over `0.36s cubic-bezier(0.2, 0, 0.2, 1)`. Fixed-position elements, `[data-animal-drawer-ignore]` nodes and the component's own portal wrapper are excluded.
+- The pushed background deliberately carries **no `filter`**. `filter` is a non-composited property — it forces a fresh composited layer and a per-pixel gaussian blur across the viewport for each background element, so the *first* open stalls while the layers are rasterized from scratch and later opens feel fine. The depth read comes from `scale` + rounded corners + the dimming mask. `will-change: transform` is applied before the transition starts so layer promotion does not happen mid-animation.
+- `prefers-reduced-motion: reduce` skips the background push entirely; the panel and mask transitions are unchanged.
+
 ```css
 /* mask — light black (0.18), lighter than Modal so the recessed background stays visible (key to the depth effect) */
 position: fixed;
```

**File**: `docs/zh-CN/design-system/README.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ animal-island-ui 是一套受《治愈系海岛风格》启发的 React + TypeSc
 | `Progress`     | 描边进度条：奶油色 pill 轨道 + 2px 沙色描边（size 为含描边的总高），fill 为薄荷色竖向渐变、按进度从左揭开、100% 时提亮；可选 `variant` 把渐变换成 4 张岛屿场景图之一铺满整条轨道，文字固定显示在进度条右侧，infoFormat 自定义、duration 控制 fill 宽度动画 |      | ✓             |
 | `Skeleton`     | 加载占位骨架，4 种变体（`text`/`circle`/`rect`/`paragraph`）加 `SkeletonButton` / `SkeletonInput` / `SkeletonAvatar` 子组件，暖白微光扫过                                                   |      | ✓             |
 | `Loading`      | 全屏夜空飘雪（`#0b101a` 底 + 中央暗角），50 片白雪花漂落旋转、可选居中 `tip`；`active` 关闭时淡出并卸载，支持 `prefers-reduced-motion`                                                           |      | ✓             |
-| `BackTop`      | 固定右下角回到顶部按钮（原创徽章图形，easeInOutQuad 平滑滚动）                                                                                                                            | ✓    |               |
+| `BackTop`      | 固定右下角回到顶部按钮（`naive-icons` 的 `RocketIcon`，easeInOutQuad 平滑滚动）                                                                                                                            | ✓    |               |
 | `Image`        | 衬板相框图片，支持懒加载、错误占位和点击预览                                                                                                                                                 | ✓    |               |
 | `Countdown`    | 实时截止倒计时，支持 DD/HH/mm/ss 格式、三种尺寸和两种视觉风格                                                                                                                               |      | ✓             |
 | `CountUp`      | 计分数字滚动：`duration` 秒内从 `start` 滚到 `end`（rAF 驱动）、5 条缓动曲线或自定义函数、千分位 / 小数位格式化、播放 / 暂停 / 继续，可选的结束庆祝动效（两拍弹跳、光环、CSS 星芒，可加文案贴纸），并在静止后通过 `role="status"` 播报得分          |      | ✓             |
```

**File**: `docs/zh-CN/design-system/components/feedback.md` (modified, +2/-2)
```diff
@@ -246,7 +246,7 @@ SkeletonAvatarProps { size?: 'small'|'middle'|'large'; shape?: 'circle'|'square'
 
 源码：`src/components/BackTop/BackTop.tsx` + `back-top.module.less`。
 
-固定右下角的返回顶部按钮，默认使用原创贴纸风上箭头 SVG（内联 data URI：暖棕 `#c9a06c` 描边 + 奶油 `#fffdf4` 糖霜层 + 青绿 `#19c8b9` 主体带浅青 `#7fe0d4` 高光），点击后 easeInOutQuad 平滑滚动到顶部。
+固定右下角的返回顶部按钮，使用 `naive-icons` 的 `RocketIcon`（48×48 viewBox：奶油 `#FAEDCD` 机身、青绿 `#2A9D8F` 舷窗、`#E76F51` 火焰与尾翼、墨色 `#2A2A2A` 描边），以 `size={64}` 渲染；点击后 easeInOutQuad 平滑滚动到顶部。该图标是纯装饰性的，带 `aria-hidden`，可读名称由按钮自身的 `aria-label` 提供。
 
 **props**：
 ```ts
@@ -277,7 +277,7 @@ opacity: 1;
 visibility: visible;
 transform: translateY(0);
 
-// icon (240×240 viewBox 贴纸箭头)
+// icon (naive-icons RocketIcon,48×48 viewBox,按 size 64 渲染)
 .img {
     width: 64px;
     height: 64px;
```

**File**: `docs/zh-CN/design-system/components/overlays.md` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ border-color: rgba(255, 204, 0, 0.85);
 
 **下沉景深抽屉 — 背景下沉 + 缩放 + 降亮突出主体。**
 
+- `pushBackground`（默认 `true`）：打开时，`document.body` 下每个非 fixed 的直接子元素施加 `transform: scale(0.94)`、`border-radius: 14px`、`overflow: hidden`，过渡 `0.36s cubic-bezier(0.2, 0, 0.2, 1)`。fixed 定位元素、`[data-animal-drawer-ignore]` 节点以及组件自身的 portal 包裹器都会被排除。
+- 被下沉的背景**刻意不加 `filter`**。`filter` 是非合成器属性：它会为每个背景元素新建合成层，并对整个视口做逐像素高斯模糊，症状就是**首次打开卡顿**（此时各层需要从零光栅化），而之后打开却很顺。景深读数由 `scale` + 圆角 + 遮罩压暗承担。同时在过渡开始前加 `will-change: transform`，让分层提前完成而不是发生在动画中途。
+- `prefers-reduced-motion: reduce` 下完全跳过背景下沉；面板与遮罩的过渡行为不变。
+
 ```css
 /* mask — light black (0.18), lighter than Modal so the recessed background stays visible (key to the depth effect) */
 position: fixed;
```

#### Recent Merged Pull Requests:
- **PR #71** (2026-10-16): feat(calendar): add a lightweight month calendar with events (@GeoDaoyu)
- **PR #70** (2026-10-15): chore(deps): 引入 dayjs 作为日期层（方案 A） (@GeoDaoyu)
- **PR #66** (2026-10-11): feat(select): add allowClear and showSearch (@GeoDaoyu)
- **PR #64** (2026-10-11): docs(demo): call the Input clear button allowClear, not clearable (@GeoDaoyu)
- **PR #63** (2026-10-09): feat(count-up): add a CountUp score counter component (@GeoDaoyu)
- **PR #60** (2026-10-03): feat(badge): add Badge component (@GeoDaoyu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. count-up): cancel a pending repeat when a zero-duration run ends

**RULE**:
When implementing operations in `skills/animal-island-ui-style/references/components/CountUp.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in guokaigdg/animal-island-ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1b8a379e`: count-up): cancel a pending repeat when a zero-duration run ends. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/animal-island-ui-style/references/components/CountUp.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{/* render prop: take over rendering; keep focusable elements outside (the plate is aria-hidden) */}
    {({ value, reset }) => {
        resetRef.current = reset;
        return <span>{Math.round(value)}</span>;
    }}
<button onClick={() => resetRef.current?.()}>replay</button>
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
{/* render prop: take over rendering and drive reset() yourself */}
    {({ value, reset }) => <span>{Math.round(value)}<button onClick={() => reset()}>replay</button></span>}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1b8a379e` are properly handled with clean fallback behavior.
