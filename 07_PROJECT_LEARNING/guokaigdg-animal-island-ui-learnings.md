# Forensic Learning Record (Deep Inspection): guokaigdg/animal-island-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/guokaigdg-animal-island-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:58:44.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `guokaigdg/animal-island-ui`
- **Description**: A Kawaii React UI component library  一个可爱的 React UI 组件库
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4739 stars

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
            { key: 'rate', label: 'Rate 评分', isNew: true },
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
            { key: 'avatar', label: 'Avatar 头像', isNew: true },
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
                style={{ width: 25, height: 25, borderRadius: 8, marginRight: 8 }}
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
                            {item.children.map((child) => (
                                <div
                                    key={child.key}
                                    className={child.key === 'cursor' ? 'demo-raindrop-hover' : undefined}
                                    style={S.menuItem(activeKey 
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
    featureDesc: {
        fon
```

### Core Architecture Module: `demo/components/Avatar/index.tsx`
```
import React from 'react';
import { Avatar, AvatarGroup, Radio, type AvatarShape } from '../../../src';
import {
    UserIcon,
    FishIcon,
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
    FishIcon,
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
                        <FishIcon />
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
                    <Avatar shape={shape} icon={<UserIcon />} />
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
                    <Avatar size={96} src={pick(3)} alt="山间小镇" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>加载失败</DemoTag> 自动回退到图标 / 文字
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar src="/broken-avatar.png" icon={<UserIcon />} />
                    <Avatar src="/broken-avatar.png">岛</Avatar>
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>图标头像</DemoTag> 20 个 naive-icons 图标作为 children
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
    <FishIcon />
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

### Core Architecture Module: `demo/components/Checkbox/index.tsx`
```
import React, { useState } from 'react';
import { Checkbox } from '../../../src';
import {
    labelStyle,
    ApiTable,
    CodeBlock,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBoxStyle,
} from '../../tools';

const CHECKBOX_API: ApiRow[] = [
    { prop: 'options', desc: '选项列表', type: 'CheckboxOption[]', defaultVal: '-', required: true },
    { prop: 'value', desc: '受控选中值列表', type: 'Array<string | number>', defaultVal: '-' },
    { prop: 'defaultValue', desc: '默认选中值列表', type: 'Array<string | number>', defaultVal: '[]' },
    { prop: 'size', desc: '尺寸', type: "'small' | 'middle' | 'large'", defaultVal: "'middle'" },
    { prop: 'disabled', desc: '禁用全部选项', type: 'boolean', defaultVal: 'false' },
    { prop: 'direction', desc: '排列方向', type: "'horizontal' | 'vertical'", defaultVal: "'horizontal'" },
    { prop: 'onChange', desc: '选中值变化回调', type: '(values: Array<string | number>) => void', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'React.CSSProperties', defaultVal: '-' },
];

const islandOptions = [
    { label: '海滩', value: 'beach' },
    { label: '森林', value: 'forest' },
    { label: '花园', value: 'garden' },
    { label: '村庄', value: 'village' },
];

const critterOptions = [
    { label: '蝴蝶', value: 'butterfly' },
    { label: '鲈鱼', value: 'bass' },
    { label: '螃蟹', value: 'crab', disabled: true },
    { label: '毛毛虫', value: 'caterpillar' },
    { label: '水母', value: 'jellyfish' },
];

const CheckboxDemo: React.FC = () => {
    const [selected1, setSelected1] = useState<Array<string | number>>(['beach', 'garden']);
    const [selected2, setSelected2] = useState<Array<string | number>>([]);

    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                Checkbox <DemoTag>基础用法</DemoTag>
            </div>

            <div style={labelStyle}>默认水平排列（受控）</div>
            <div style={{ marginBottom: 8, fontSize: 13, color: '#a08060' }}>
                已选中:{' '}
                <span style={{ color: '#19c8b9', fontWeight: 600 }}>
                    {selected1.length > 0
                        ? islandOptions
                              .filter((o) => selected1.includes(o.value))
                              .map((o) => o.label)
                              .join('、')
                        : '无'}
                </span>
            </div>
            <div style={demoBoxStyle}>
                <Checkbox options={islandOptions} value={selected1} onChange={setSelected1} style={{ gap: 20 }} />
            </div>

            <div style={labelStyle}>垂直排列 + 含禁用选项</div>
            <div style={demoBoxStyle}>
                <Checkbox
                    options={critterOptions}
                    value={selected2}
                    onChange={setSelected2}
                    direction="vertical"
                    style={{ gap: 12 }}
                />
            </div>

            <div style={labelStyle}>小尺寸</div>
            <div style={demoBoxStyle}>
                <Checkbox options={islandOptions} defaultValue={['forest']} size="small" />
            </div>

            <div style={labelStyle}>中尺寸（默认）</div>
            <div style={demoBoxStyle}>
                <Checkbox options={islandOptions} defaultValue={['beach']} size="middle" />
            </div>

            <div style={labelStyle}>大尺寸</div>
            <div style={demoBoxStyle}>
                <Checkbox options={islandOptions.slice(0, 3)} defaultValue={['beach']} size="large" />
            </div>

            <div style={labelStyle}>全部禁用</div>
            <div style={demoBoxStyle}>
                <Checkbox options={islandOptions} defaultValue={['garden', 'village']} disabled />
            </div>

            <CodeBlock
                code={`import React, { useState } from 'react';
import { Checkbox } from 'animal-island-ui';

const options = [
    { label: '海滩', value: 'beach' },
    { label: '森林', value: 'forest' },
    { label: '花园', value: 'garden' },
];

const App = () => {
    return (
        <div>
            {/* 非受控 */}
            <Checkbox options={options} defaultValue={['beach']} />
            {/* 受控 */}
            <Checkbox options={options} value={values} onChange={setValues} />
            {/* 垂直排列 */}
            <Checkbox options={options} direction="vertical" />
        </div>
    );
};

export default App;`}
            />
            <ApiTable rows={CHECKBOX_API} />
        </div>
    );
};

export default CheckboxDemo;

```

### Core Architecture Module: `demo/components/CodeBlock/index.tsx`
```
import React from 'react';
import { CodeBlock } from '../../../src';
import {
    labelStyle,
    ApiTable,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBoxStyle,
    CodeBlock as CodeBlockBase,
} from '../../tools';

const CODEBLOCK_API: ApiRow[] = [
    { prop: 'code', desc: '代码字符串', type: 'string', defaultVal: '-', required: true },
    { prop: 'style', desc: '自定义样式', type: 'CSSProperties', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'copyable', desc: '是否显示复制按钮', type: 'boolean', defaultVal: 'true' },
    { prop: 'onCopy', desc: '复制成功回调', type: '(code: string) => void', defaultVal: '-' },
];

const CodeBlockDemo: React.FC = () => {
    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                CodeBlock <DemoTag>代码高亮</DemoTag>
            </div>
            <div style={labelStyle}>基础用法</div>
            <div style={demoBoxStyle}>
                <CodeBlock
                    code={`import React from 'react';
import { Button } from 'animal-island-ui';

const App = () => (
    <Button type="primary">按钮</Button>
);

export default App;`}
                />
            </div>

            <div style={labelStyle}>关闭复制功能</div>
            <div style={demoBoxStyle}>
                <CodeBlock code="const copyButton = false;" copyable={false} />
            </div>

            <div style={labelStyle}>自定义样式</div>
            <div style={demoBoxStyle}>
                <CodeBlock
                    code={`import React from 'react';
import { CodeBlock } from 'animal-island-ui';

<CodeBlock
    code={codeString}
    style={{ borderRadius: 5, backgroundColor: '#242c46ff' }}
    className="custom-code"
/>`}
                    style={{ borderRadius: 5, backgroundColor: '#242c46ff' }}
                />
            </div>
            <CodeBlockBase
                code={`import React from 'react';
import { CodeBlock } from 'animal-island-ui';

const App = () => {
    return (
        <div>
            {/* 基础用法 */}
            <CodeBlock code={'
                import React from 'react';
                import { Footer } from 'animal-island-ui';

                const App = () => {
                    return (
                        <div>
                            {/* 默认 © 2026 All Rights Reserved. */}
                            <Footer />
                            {/* 自定义文案 */}
                            <Footer text="Acme Ltd." />
                        </div>
                    );
                };

                export default App;'}
            />
            {/* 自定义样式 */}
            <CodeBlock
                code={codeString}
                style={{ borderRadius: 5, backgroundColor: '#242c46ff' }}
                className="custom-code"
            />
        </div>
    );
};

export default App;`}
            />

            <ApiTable rows={CODEBLOCK_API} />
        </div>
    );
};

export default CodeBlockDemo;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #60** (2026-10-03): **feat(badge): add Badge component**
  *Symptoms*: Adds a `Badge` component — the circular count badge that sits on the top-right corner of an icon or avatar.  ## Scope  Kept (per the request): 基本, 独立使用, 封顶数字, 讨嫌的小红点, 大小, 多彩徽标.  Deliberately dropped from antd's Badge: `Badge.Ribbon`, the `classNames` / `styles` semantic slots, `offset`, the `status` / `text` status dot, and the clickable demo.  ## API  ```ts type BadgeSize = 'small' | 'medium'; type BadgeColor = 'app-red' | 'app-pink' | 'app-orange' | 'app-yellow' | 'app-teal'     | 'app-green' | 'app-blue' | 'purple' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink';  interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {     count?: React.ReactNode;      // number / string, or any ReactNode (e.g. a naive-icons glyph)     overflowCount?: number;       // default 99 -> 100 renders "99+"     showZero?: boolean;           // default false     dot?: boolean;                // default false     size?: BadgeSize;             // default 'medium'     color?: BadgeColor;           // default 'app-red'     children?: React.ReactNode;   // omit for standalone use } ```  ```tsx <Badge count={5}>     <Avatar shape="square" size="large"><BellIcon size={24} /></Avatar> </Badge>  <Badge count={100} />                    {/* standalone -> "99+" */} <Badge count="新" color="app-orange" />  {/* non-numeric renders verbatim */} <Badge dot color="app-green"><BellIcon size={26} /></Badge> ```  ## Design notes  - The indicator is a `<sup>` pinned to the wrapped element's t
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/60?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` AGENTS.md — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `32d297c9-3f2f-4f1b-aa5
  > 已按 CodeRabbit 的两条意见跟进，改动见 8cfe41a。  **1. `count` 为空字符串时会渲染出空心胶囊** —— 已在 `8cfe41a` 修复。`isEmpty` 现在把空字符串（`''` 与纯空白）也视为空，与 `toNumeric` 现有的 trim 逻辑保持一致；零值规则与 `dot` 的行为不变。新增 3 个用例，Badge 测试套件共 41 个。  **2. 浅色角标底上的文字对比度** —— 已核算，但这属于调色板层面的问题、而非 `Badge` 自身的问题，因此本次 PR 有意不做修改。  对照 `docs/design-system/design-tokens.md` 中由 `Card` / `Title` / `Tag` / `Image` 共用的 "Island app-tile palette" 实测，**12 组前景/背景里有 10 组低于 WCAG 对 11–12px 文字要求的 4.5:1 —— 包括默认色 `app-red`（2.69:1）**，最差的是 `app-teal` 1.72、`app-pink` 1.89、`app-green` 2.00。`Tag` 的 `soft` 配色同样不达标（8/12）。能在这些底色上真正达到 4.5:1 的同色系前景色都接近纯黑（`#6e0500`、`#9a0118`、`#195a46`……），数字会完全失去色相。  如果在这里改，`Badge` 会成为唯一合规的组件，同时它的配色会脱离已记录在案的设计语言，而另外四个组件依旧不合规。因此建议单开一个 PR：一次性为这 12 个色定好符合 AA 的前景/背景组合，同步更新 `design-tokens.md` 及其 `zh-CN` 镜像，并统一应用到 `Card` / `Title` / `Tag` / `Image` / `Badge`。这属于设计语言的视觉变更，应由 @guokaigdg 定夺 —— 需要的话我可以来开这个 PR。  （供那个 PR 参考：`test/a11y.test.tsx` 关闭了 `color-contrast` 规则，因为 jsdom 不计算样式，所以目前 CI 抓不到这类问题。）  **修复后的验证：** `npm run ci` 全绿 —— `format:check`、`check:do

- **Issue #59** (2026-10-02): **feat: 新增 Rate 评分组件**
  *Symptoms*: ## 做了什么  新增 `Rate` 评分组件：参考 antd Rate 的基础设计（只取基本 / 尺寸 / 只读三类能力），按仓库现有的组件规范、设计规则与文档约定实现。  ### 组件能力  | 能力 | 说明 | | --- | --- | | 基本 | `value` / `defaultValue` / `count` / `allowClear` / `onChange`；悬停预览；再次点击同一颗星清空评分 | | 尺寸 | `small` 20px / `middle` 26px / `large` 34px | | 只读 | `readonly` 保留金色星级，去掉悬停与点击；input 禁用并带 `aria-readonly` |  - 星级复用 `naive-icons` 的 `StarIcon`：未选中只留描边，选中时金色填充淡入、描边转深金 - 无障碍：`role="radiogroup"` + 视觉隐藏的原生 radio，roving tabindex，方向键 ±1 星、Home/End 跳首尾；容器默认 `aria-label="评分"`，可被外部覆盖 - 受控值会夹取到 `[0, count]` 并就近取整（例如展示平均分 4.6 → 点亮 5 颗并选中第 5 颗），保证任何输入下都恰好有一颗星可被 Tab 到达  ### 改动清单  - 新增组件：`src/components/Rate/{Rate.tsx, rate.module.less, index.ts, Rate.test.tsx}` - 导出：`src/index.ts` - Demo：新增 `demo/components/Rate/index.tsx`，并在 `demo/App.tsx`、`demo/pageInfo.ts`、`demo/ComponentPage.tsx`、`demo/HomePage.tsx` 四处注册 - 无障碍用例：`test/a11y.test.tsx` 增加「可交互」「只读」两个 case - 文档：`docs/design-system/components/form-controls.md`（+ `docs/zh-CN` 镜像）新增 `## Rate` 像素规范；`docs/design-system/README.md`（+ 镜像）组件表与类型导出；`skills/animal-island-ui-style/references/components/form-controls.md` props 参考；`README.md` / `docs/README.zh-CN.md` 徽章（`npm run badges`）  ### 与 Rate 无关的改动（仅文档，未改任何其他组件的代码、样式或测试）  1. **拆分 skill 组件参考**：把 `DatePicker`、`TimePicker` 从 `skills/animal-island-ui-style/references/components/form-controls.md` 拆到新建的 `date-time.md`。    原因：`npm run check:docs` 限制每个 skill 参考文件 ≤ 200 行，而 `form-controls.md` 原本已经 199 行，Rate 一节放不下；拆分后两个文件分别为 155 / 72 行。顺带修掉了英文 `SKILL.md` 目录表漏列 DatePicker / TimePicker 的问题
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/guokaigdg/animal-island-ui/pull/59?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `3bc5668c-9250-4134-9278-4dc2abb6e2ac`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between febefb1cf6bf45622daf0b79a4b33264b12
  > <img width="1280" height="1500" alt="image" src="https://github.com/user-attachments/assets/07172d93-abfa-40aa-b138-127ab2c0cbfd" /> 
  > 已按 review 意见处理，见 commit `9baa9be`（本地 `npm run ci` 全绿：637 单测 / 36 条 a11y / build）。  **已修复**  1. **方向键改为基于归一化后的星级计算**（`Rate.tsx`）    `value={4.6}` 时按 ← 会发出 `3.6`，并去聚焦一个不存在的 input；`count={3} value={5}` 时可能发出 `4`（超出 count）。现在两个方向都从夹取后的 `checkedValue` 出发，结果始终落在 `[1, count]`。 2. **键盘选择时收起悬停预览**（`Rate.tsx`）    鼠标停在第 3 颗上时按 → 选中第 4 颗，此前悬停预览会继续盖住新评分；现在按键提交前先 `setHoverValue(0)`。  上面两条都补了单测：小数受控值、超出 `count` 的受控值、悬停预览与键盘组合三种场景。  **未改动，附理由**  3. **焦点环对比度**（`rate.module.less`）    `docs/design-system/design-rules.md` 的硬规则 2 / 规则 6 规定输入类控件的焦点色为黄色（`#ffcc00` / `#f5c31c`），Radio、Checkbox 用的是同一个 token；单独给 Rate 换色会造成组件间不一致。若要满足 WCAG 2.2 1.4.11 的 3:1，建议作为**全库统一调整**单独开 issue（例如统一补一圈深色外环），我可以跟进。 4. **`useId` 与 React 17 peer 范围**    仓库中已有 12 个组件在使用 `useId`（Checkbox、Radio、Select、Modal、Drawer、Tabs 等），React 18 实际是既有前提，`package.json` 里的 `react: ">=17.0.0"` 属历史遗留。调整 peer 范围会影响整个库，不适合放在这个组件 PR 内，建议单独提 issue。 

- **Issue #58** (2026-10-02): **移植一份Solid的版本/A Port for SolidJS**
  *Symptoms*: Hi, this component library looks really nice!  I've been working with SolidJS recently and would love to see a Solid port of it. Solid shares many similarities with React, so I plan to try porting this library to Solid. May I ask if it's okay to host this Solid version under your account/organization?  --- 你好，这套组件库的设计很棒。 我最近在使用 SolidJS，希望能有对应的 Solid 移植版本。 Solid 和 React 的开发模型比较接近，我计划尝试移植一份。 想咨询下，是否可以将这个 Solid 版本放到你的账号 / 组织下维护？
  **Post-Mortem & Fix Analysis**:
  > 关于 Solid 移植，我的想法是这样的：  1. 先在你的账号下做。 建议先放在你自己的仓库，把功能跑通、补齐测试、发布几个稳定版本后，我们再讨论是否并入组织/我的账号作为官方关联移植版。 2. License 一致。 请沿用本仓库的 License，并在 README 中注明本项目来源与原作者。 3. 命名约定。 用`animal-island-ui-solid` 比较合适，方便大家识别。 4. 互相链接。 等有可用版本后，把链接发我，我会把它加到主仓库 README 的社区移植列表里，方便 Solid 用户发现。
  > okay, WIP~~

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

### Incident Patch 1: `8cfe41a5` (2026-10-02)
**Commit Message**: fix(badge): hide the indicator for a blank count

Addresses a CodeRabbit finding on #60: `isEmpty` only covered `null` and
`undefined`, so `count=""` rendered an empty pill - the cream ring and
shadow with no content inside.

Treat a blank string (`''` and whitespace-only) as empty, matching
`toNumeric`, which already trims. The zero rules are untouched: `0` /
`"0"` still hide unless `showZero`, and `dot` with a blank count still
renders a dot.

Docs: the design-system pixel spec + zh mirror and the skill props
reference now spell out that a blank string counts as empty.

Tests: 3 cases added (blank string, whitespace-only, dot with a blank
count); the Badge suite is 41 cases.

**File**: `docs/design-system/components/data-display.md` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@ Source: `src/components/Badge/Badge.tsx` + `badge.module.less`. **Corner count b
 > - The indicator is a `<sup>` (same element antd uses); `position: absolute` + `translate(50%, -50%)` pins it exactly on the wrapped element's top-right corner, and `transform-origin: 100% 0` makes the pop grow out of that corner.
 > - The 2px cream ring (`--animal-bg-color`) reuses Avatar's sticker ring, so a badge overlapping an image or icon separates cleanly instead of floating on the artwork. A standalone badge covers nothing, so it drops ring, shadow and offset.
 > - Capping applies to numbers and numeric strings only (`100` → `99+`); a ReactNode `count` (e.g. a naive-icons glyph) renders verbatim. The true value stays in the native `title` even when the visible text is capped — pass `title` explicitly to override it.
-> - Visibility: hidden when `count` is empty, when the value is `0` / `"0"` without `showZero`, and for `dot` when the value is zero; `dot` without a `count` still shows. `size` only affects the numeric pill — the dot box wins over it.
+> - Visibility: hidden when `count` is empty (`null`, `undefined` or a blank string), when the value is `0` / `"0"` without `showZero`, and for `dot` when the value is zero; `dot` without a `count` still shows. `size` only affects the numeric pill — the dot box wins over it.
 > - `color` is the shared island palette rather than antd's free-form CSS colour, so a badge cannot drift outside the Card / Tag colour language.
 
 ## Image (mat frame)
```

**File**: `docs/zh-CN/design-system/components/data-display.md` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@ tab-size: 4;
 > - 角标是 `<sup>`（与 antd 同款元素）；`position: absolute` + `translate(50%, -50%)` 让它精确钉在被包裹元素的右上角，`transform-origin: 100% 0` 让弹出动画从该角生长。
 > - 2px 奶油描边（`--animal-bg-color`）复用 Avatar 的贴纸描边，角标压在图片 / 图标上时能干净分离，而不是浮在画面上。独立使用时没有需要分离的目标，因此去掉描边、投影与位移。
 > - 封顶只对数字与数字字符串生效（`100` → `99+`）；ReactNode 类型的 `count`（如 naive-icons 图标）原样展示。可见文字被封顶时，真实数值仍保留在原生 `title` 中 —— 显式传入 `title` 可覆盖它。
-> - 显隐规则：`count` 为空、数值为 `0` / `"0"` 且未开启 `showZero` 时隐藏；`dot` 且数值为 0 时同样隐藏，但 `dot` 未传 `count` 仍会展示。`size` 只作用于数字胶囊 —— 小圆点的盒子尺寸优先。
+> - 显隐规则：`count` 为空（`null`、`undefined` 或空 / 纯空白字符串）、数值为 `0` / `"0"` 且未开启 `showZero` 时隐藏；`dot` 且数值为 0 时同样隐藏，但 `dot` 未传 `count` 仍会展示。`size` 只作用于数字胶囊 —— 小圆点的盒子尺寸优先。
 > - `color` 使用共享的海岛调色板而非 antd 的自由 CSS 颜色，角标不会脱离 Card / Tag 的色彩语言。
 
 ## Image（衬板相框）
```

**File**: `skills/animal-island-ui-style/references/components/data-display.md` (modified, +1/-1)
```diff
@@ -158,5 +158,5 @@ interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
 <Badge count={5} size="small" color="app-blue" />
 ```
 
-Notes: colours are the shared Card / Tag palette — there is **no** free-form CSS colour prop. The indicator is a `<sup>` pinned to the wrapped element's top-right corner over a 2px cream ring; omit `children` for a standalone badge (ring, shadow and offset are dropped). Hidden when `count` is empty or `0` / `"0"` without `showZero`; `dot` with a zero value is hidden too, but `dot` without a `count` still shows. Numbers and numeric strings are capped at `overflowCount` (default 99 → `99+`); the true value stays in the native `title` (an explicit `title` prop overrides it) and a ReactNode `count` is never capped. Sizes: `medium` 20px pill / `small` 16px pill; `dot` is a fixed 10px box. It is a passive display element (`<span>` wrapper) — no `onClick`, no interactive states.
+Notes: colours are the shared Card / Tag palette — there is **no** free-form CSS colour prop. The indicator is a `<sup>` pinned to the wrapped element's top-right corner over a 2px cream ring; omit `children` for a standalone badge (ring, shadow and offset are dropped). Hidden when `count` is empty (`null` / `undefined` / blank string) or `0` / `"0"` without `showZero`; `dot` with a zero value is hidden too, but `dot` without a `count` still shows. Numbers and numeric strings are capped at `overflowCount` (default 99 → `99+`); the true value stays in the native `title` (an explicit `title` prop overrides it) and a ReactNode `count` is never capped. Sizes: `medium` 20px pill / `small` 16px pill; `dot` is a fixed 10px box. It is a passive display element (`<span>` wrapper) — no `onClick`, no interactive states.
 
```

**File**: `src/components/Badge/Badge.test.tsx` (modified, +27/-0)
```diff
@@ -75,6 +75,33 @@ describe('Badge', () => {
             expect(queryIndicator(container)).toBeNull();
         });
 
+        it('空字符串 count 不渲染角标', () => {
+            const { container } = render(
+                <Badge count="">
+                    <span>头像</span>
+                </Badge>
+            );
+            expect(queryIndicator(container)).toBeNull();
+        });
+
+        it('纯空白字符串 count 不渲染角标', () => {
+            const { container } = render(
+                <Badge count="   ">
+                    <span>头像</span>
+                </Badge>
+            );
+            expect(queryIndicator(container)).toBeNull();
+        });
+
+        it('空字符串 count 在 dot 模式下仍展示小圆点', () => {
+            const { container } = render(
+                <Badge count="" dot>
+                    <span>头像</span>
+                </Badge>
+            );
+            expect(queryIndicator(container)).toHaveClass(styles.dot);
+        });
+
         it('支持 ReactNode 作为 count', () => {
             render(
                 <Badge count={<span data-testid="icon">icon</span>}>
```

**File**: `src/components/Badge/Badge.tsx` (modified, +2/-1)
```diff
@@ -64,7 +64,8 @@ export const Badge: React.FC<BadgeProps> = ({
     const displayCount = numeric !== null && numeric > overflowCount ? `${overflowCount}+` : count;
     const isZero = displayCount === 0 || displayCount === '0';
     const showAsDot = dot && !isZero;
-    const isEmpty = count === null || count === undefined;
+    // 空字符串（含纯空白）与 null / undefined 一样视为无内容，避免渲染出空心胶囊
+    const isEmpty = count === null || count === undefined || (typeof count === 'string' && count.trim() === '');
     // 无内容，或数值为 0 且未开启 showZero，且不是小圆点时整体隐藏
     const isHidden = !showAsDot && (isEmpty || (isZero && !showZero));
     // 不传 children 即独立使用：角标不再相对某元素定位
```

---

### Incident Patch 2: `c1ac6c4a` (2026-10-02)
**Commit Message**: fix(types): clear all tsc --noEmit errors

- lib ES2020 -> ES2022 for Array.prototype.at, which alone accounted
  for 33 of the 44 errors
- Avatar.Group was erased from the public type by an as unknown as cast
- DatePicker onChange handlers narrowed to DatePickerValue; Upload test
  mock was missing response; Carousel mock needed a DOM signature because
  @types/node shadows jsdom's setInterval
- Wired tsc --noEmit into ci, which nothing was running — that is how 44
  type errors accumulated unnoticed

**File**: `demo/components/DatePicker/index.tsx` (modified, +7/-2)
```diff
@@ -71,7 +71,7 @@ const DatePickerDemo: React.FC = () => {
                 当前选中: <span style={{ color: '#19c8b9', fontWeight: 600 }}>{value ?? '未选择'}</span>
             </div>
             <div style={S.demoBox}>
-                <DatePicker value={value ?? undefined} onChange={setValue} />
+                <DatePicker value={value ?? undefined} onChange={(v) => setValue(typeof v === 'string' ? v : null)} />
             </div>
             <div style={labelStyle}>非受控默认值 + 自定义格式</div>
             <div style={S.demoBox}>
@@ -110,7 +110,12 @@ const DatePickerDemo: React.FC = () => {
                 <span style={{ color: '#19c8b9', fontWeight: 600 }}>{rangeValue?.join(' ~ ') ?? '未选择'}</span>
             </div>
             <div style={S.demoBox}>
-                <DatePicker range value={rangeValue ?? undefined} onChange={setRangeValue} style={{ width: 300 }} />
+                <DatePicker
+                    range
+                    value={rangeValue ?? undefined}
+                    onChange={(v) => setRangeValue(Array.isArray(v) ? v : null)}
+                    style={{ width: 300 }}
+                />
             </div>
             <div style={labelStyle}>范围 + 清空 + 禁用周末</div>
             <div style={S.demoBox}>
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -46,9 +46,10 @@
         "check:docs": "node scripts/check-docs-sync.mjs",
         "lint": "eslint .",
         "lint:fix": "eslint . --fix",
+        "typecheck": "tsc --noEmit",
         "format": "prettier --write .",
         "format:check": "prettier --check .",
-        "ci": "npm run format:check && npm run check:docs && npm run lint && npm run test:run && npm run build",
+        "ci": "npm run format:check && npm run check:docs && npm run lint && npm run typecheck && npm run test:run && npm run build",
         "setup:hooks": "git config core.hooksPath .githooks",
         "prepare": "npm run setup:hooks"
     },
```

**File**: `src/components/Avatar/Avatar.test.tsx` (modified, +3/-3)
```diff
@@ -80,8 +80,8 @@ describe('Avatar', () => {
     it('does not apply the placeholder class when an image is loaded', () => {
         const { container } = render(<Avatar src="/ok.png" />);
         const root = rootOf(container.querySelector('img'));
-        expect(root.className).toContain('avatar');
-        expect(root.className).not.toContain('placeholder');
+        expect(root?.className).toContain('avatar');
+        expect(root?.className).not.toContain('placeholder');
     });
 
     it('renders custom className and spreads HTML attributes', () => {
@@ -129,7 +129,7 @@ describe('AvatarGroup', () => {
         );
         const avatar = rootOf(screen.getByText('A'));
         expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
-        expect(avatar.className).toContain('shape-square');
+        expect(avatar?.className).toContain('shape-square');
     });
 
     it('does not override a child Avatar that sets its own size', () => {
```

**File**: `src/components/Avatar/Avatar.tsx` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@ export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>,
     children?: React.ReactNode;
 }
 
-export const Avatar: React.FC<AvatarProps> = ({
+export const Avatar: React.FC<AvatarProps> & { Group: React.FC<AvatarGroupProps> } = ({
     shape = 'circle',
     size = 'middle',
     src,
@@ -203,4 +203,4 @@ export const AvatarGroup: React.FC<AvatarGroupProps> = ({
 AvatarGroup.displayName = 'AvatarGroup';
 
 // 兼容用法：Avatar.Group 也可经静态属性访问
-(Avatar as unknown as { Group: typeof AvatarGroup }).Group = AvatarGroup;
+Avatar.Group = AvatarGroup;
```

**File**: `src/components/Carousel/Carousel.test.tsx` (modified, +4/-2)
```diff
@@ -72,10 +72,12 @@ describe('Carousel', () => {
     it('焦点进入后暂停，并可从播放控制显式恢复', async () => {
         const onChange = vi.fn();
         let latestTimer: TimerHandler | undefined;
-        vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler) => {
+        // jsdom 的 window.setInterval 返回 number，但 @types/node 的同名签名（返回 Timeout）
+        // 会遮蔽 DOM 版本，所以这里显式断言回 DOM 签名
+        vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler) => {
             latestTimer = handler;
             return 1;
-        });
+        }) as unknown as typeof window.setInterval);
         vi.spyOn(window, 'clearInterval').mockImplementation(() => {
             latestTimer = undefined;
         });
```

**File**: `src/components/DatePicker/DatePicker.test.tsx` (modified, +6/-1)
```diff
@@ -87,7 +87,12 @@ describe('DatePicker', () => {
             const onChange = vi.fn();
             render(
                 <ControlledHost<string | null, string | null> initial="2026-08-10" onChange={onChange}>
-                    {({ value, onChange: set }) => <DatePicker value={value ?? undefined} onChange={(v) => set(v)} />}
+                    {({ value, onChange: set }) => (
+                        <DatePicker
+                            value={value ?? undefined}
+                            onChange={(v) => set(typeof v === 'string' ? v : null)}
+                        />
+                    )}
                 </ControlledHost>
             );
             await user.click(screen.getByRole('combobox'));
```

**File**: `src/components/Upload/Upload.test.tsx` (modified, +4/-1)
```diff
@@ -383,6 +383,7 @@ describe('Upload', () => {
             setRequestHeader: ReturnType<typeof vi.fn>;
             withCredentials?: boolean;
             status: number;
+            response: unknown;
             onload: (() => void) | null;
             onerror: (() => void) | null;
             onabort: (() => void) | null;
@@ -397,6 +398,7 @@ describe('Upload', () => {
             abort = vi.fn();
             setRequestHeader = vi.fn();
             status = 200;
+            response: unknown = '';
             onload: (() => void) | null = null;
             onerror: (() => void) | null = null;
             onabort: (() => void) | null = null;
@@ -547,7 +549,8 @@ describe('Upload', () => {
                 xhr.status = 200;
                 xhr.onload!();
             });
-            list = (onChange.mock.calls.at(-1)![0] as { fileList: Array<{ status: string }> }).fileList;
+            list = (onChange.mock.calls.at(-1)![0] as { fileList: Array<{ percent: number; status: string }> })
+                .fileList;
             expect(list[0].status).toBe('done');
             expect(screen.getByLabelText('上传完成')).toBeInTheDocument();
         });
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
     "compilerOptions": {
         "target": "ES2020",
         "module": "ESNext",
-        "lib": ["ES2020", "DOM", "DOM.Iterable"],
+        "lib": ["ES2022", "DOM", "DOM.Iterable"],
         "jsx": "react-jsx",
         "moduleResolution": "bundler",
         "strict": true,
```

---

### Incident Patch 3: `3cd49887` (2026-10-02)
**Commit Message**: fix(demo): restore skill page icons and sync its data

- resolveIcon checked typeof === 'function', but naive-icons exports
  ForwardRefExoticComponent — an object at runtime — so all 10 icons
  resolved to null and the page rendered no icons at all
- Catalog re-synced with SKILL.md: 37 components, 8 missing category rows
  added, and the Decorative row no longer lists Phone/Wallet, which
  never existed in src/components/
- Icon rules still taught the built-in <Icon />, deleted back in 9129495;
  they now point at the naive-icons package
- IconName was imported from src/index.ts where it no longer exists

**File**: `demo/components/Skill/data.ts` (modified, +23/-13)
```diff
@@ -1,12 +1,12 @@
-import type { CardColor, CardProps, IconName, TagColor } from '../../../src';
+import type { CardColor, CardProps, TagColor } from '../../../src';
 
 // ============================================
 // Skill 介绍页数据 —— 事实来源：
 //   skills/animal-island-ui-style/SKILL.md、README.md
 // 改技能内容时同步此处
 // ============================================
 
-export const INTRO_TAGS = ['React + TypeScript', '30 个组件', '唯一依赖 naive-icons', 'MIT License'];
+export const INTRO_TAGS = ['React + TypeScript', '37 个组件', '唯一依赖 naive-icons', 'MIT License'];
 
 export interface QuickStep {
     title: string;
@@ -28,12 +28,13 @@ export const QUICK_STEPS: QuickStep[] = [
     },
     {
         title: '按规则验收',
-        desc: '产出必须满足技能里的硬性规则：只用库组件与 var(--animal-*) 令牌、无纯黑文字、无冷蓝焦点环、图标只用 <Icon />。不满足即视为 bug，可直接让代理按规则自查。',
+        desc: '产出必须满足技能里的硬性规则：只用库组件与 var(--animal-*) 令牌、无纯黑文字、无冷蓝焦点环、图标只用 naive-icons。不满足即视为 bug，可直接让代理按规则自查。',
     },
 ];
 
 export interface WorkflowStep {
-    icon: IconName;
+    /** naive-icons 导出名（不含 Icon 后缀），由 parts.tsx 的 resolveIcon 解析 */
+    icon: string;
     pattern: CardProps['pattern'];
     title: string;
     desc: string;
@@ -75,7 +76,8 @@ export const WORKFLOW: WorkflowStep[] = [
 
 export interface Scenario {
     title: string;
-    icon: IconName;
+    /** naive-icons 导出名（不含 Icon 后缀） */
+    icon: string;
     color: CardColor;
     agents: string[];
     desc: string;
@@ -132,9 +134,16 @@ export const CATALOG: CatalogRow[] = [
     {
         category: 'Form controls',
         color: 'app-blue',
-        components: ['Input', 'Switch', 'Checkbox', 'Radio', 'Select'],
+        components: ['Input', 'Switch', 'Checkbox', 'Radio', 'Rate', 'Select'],
         reference: 'form-controls.md',
     },
+    { category: 'Upload', color: 'warm-peach-pink', components: ['Upload'], reference: 'upload.md' },
+    {
+        category: 'Date & time pickers',
+        color: 'yellow-green',
+        components: ['DatePicker', 'TimePicker'],
+        reference: 'date-time.md',
+    },
     {
         category: 'Form container',
         color: 'app-pink',
@@ -145,14 +154,14 @@ export const CATALOG: CatalogRow[] = [
     {
         category: 'Feedback',
         color: 'app-orange',
-        components: ['Progress', 'Skeleton', 'BackTop'],
+        components: ['Progress', 'Skeleton', 'BackTop', 'Loading', 'Countdown', 'Time'],
         reference: 'feedback.md',
     },
     { category: 'Notification', color: 'app-red', components: ['Notification'], reference: 'Notification.md' },
     {
         category: 'Data displays',
         color: 'app-green',
-        components: ['Table', 'CodeBlock', 'Tag'],
+        components: ['Table', 'CodeBlock', 'Tag', 'Pagination'],
         reference: 'data-display.md',
     },
     {
@@ -164,14 +173,15 @@ export const CATALOG: CatalogRow[] = [
     {
         category: 'Decorative',
         color: 'brown',
-        components: ['Time', 'Phone', 'Footer', 'Wallet'],
+        components: ['Footer', 'Divider', 'Cursor', 'Typewriter', 'Background'],
         reference: 'decorative.md',
     },
 ];
 
 export interface RuleGroup {
     title: string;
-    icon: IconName;
+    /** naive-icons 导出名（不含 Icon 后缀） */
+    icon: string;
     color: TagColor;
     rules: string[];
 }
@@ -183,7 +193,7 @@ export const RULE_GROUPS: RuleGroup[] = [
         color: 'app-red',
         rules: [
             '绝不编造 props —— 每个 prop 必须出现在组件参考或包内 TS 声明中。',
-            'Select 仅受控（options + value + onChange 全必填）；受控 Input / Switch / Checkbox / Radio 也必须带 onChange。',
+            'Select 仅受控（options + value + onChange 全必填）；受控 Input / Switch / Checkbox / Radio / Rate 也必须带 onChange。',
             '优先库组件而非裸 HTML：不出现可见的原生 button / input / select / checkbox / radio。',
         ],
     },
@@ -213,7 +223,7 @@ export const RULE_GROUPS: RuleGroup[] = [
         color: 'app-yellow',
         rules: [
             '可交互元素圆角不得小于 12px；按钮与输入框为 50px 胶囊。',
-            '3D 像素堆叠阴影只属于 primary / danger-primary 按钮；Card 无 box-shadow，Switch 无外阴影。',
+            '3D 像素堆叠阴影只属于 primary / danger-primary 按钮；Card 无 box-shadow，Switch 无外阴影，Input 阴影需显式 shadow={true}。',
             'Modal 必须保留 SVG 有机 blob 裁切；Title 是燕尾丝带，不是 blob / 胶囊 / 方块。',
         ],
     },
@@ -222,7 +232,7 @@ export const RULE_GROUPS: RuleGroup[] = [
         icon: 'Camera',
         color: 'app-teal',
         rules: [
-            '图标一律用 <Icon name="..." />（内置可爱图标集，共 101 个）或 <Icon icon={...} />（内置图标组件）—— 禁止 emoji、Unicode 符号、手写 SVG、第三方图标库。',
+            "图标一律用外部 naive-icons 包（如 import { FlowerIcon } from 'naive-icons'）—— 禁止 emoji、Unicode 符号、手写 SVG、第三方图标库。",
             '动效使用 cubic-bezier(0.4, 0, 0.2, 1)，时长 0.15–0.35s。',
         ],
     },
```

**File**: `demo/components/Skill/parts.tsx` (modified, +10/-2)
```diff
@@ -7,10 +7,18 @@ import styles from './skill.module.less';
 
 type NaiveIcon = React.FC<{ size?: number | string }>;
 
-/** 按图标名解析 naive-icons 图标组件（如 'Book' → BookIcon） */
+/** forwardRef 组件在运行时是带 $$typeof / render 的对象，不是函数 */
+const isComponent = (v: unknown): v is React.FC<{ size?: number | string }> =>
+    typeof v === 'function' || (typeof v === 'object' && v !== null && '$$typeof' in v);
+
+/**
+ * 按图标名解析 naive-icons 图标组件（如 'Book' → BookIcon）
+ * 注意：naive-icons 导出的是 ForwardRefExoticComponent，不能用 typeof === 'function' 判断，
+ * 否则所有图标都会解析失败（Skill 页会一个图标都渲染不出来）。
+ */
 function resolveIcon(name: string): NaiveIcon | null {
     const Cmp = (Icons as Record<string, unknown>)[`${name}Icon`];
-    return typeof Cmp === 'function' ? (Cmp as NaiveIcon) : null;
+    return isComponent(Cmp) ? Cmp : null;
 }
 
 // ============================================
```

---

### Incident Patch 4: `76a0b699` (2026-10-02)
**Commit Message**: fix(test): make test:run cover the a11y suite

test/a11y.test.tsx sits outside the main config's include, so a mixed
filter list could drop it and still report green. test:run now chains the
a11y config; ci drops its duplicate test:a11y step.

**File**: `package.json` (modified, +2/-2)
```diff
@@ -39,7 +39,7 @@
         "prepublishOnly": "npm run build",
         "deploy": "npm run build:demo && gh-pages -d demo-dist",
         "test": "vitest",
-        "test:run": "vitest run",
+        "test:run": "vitest run && vitest run --config vitest.a11y.config.ts",
         "test:cov": "vitest run --coverage --reporter=json --outputFile=coverage/vitest-results.json",
         "test:a11y": "vitest run --config vitest.a11y.config.ts",
         "badges": "node scripts/generate-coverage-badges.mjs",
@@ -48,7 +48,7 @@
         "lint:fix": "eslint . --fix",
         "format": "prettier --write .",
         "format:check": "prettier --check .",
-        "ci": "npm run format:check && npm run check:docs && npm run lint && npm run test:run && npm run test:a11y && npm run build",
+        "ci": "npm run format:check && npm run check:docs && npm run lint && npm run test:run && npm run build",
         "setup:hooks": "git config core.hooksPath .githooks",
         "prepare": "npm run setup:hooks"
     },
```

**File**: `vitest.a11y.config.ts` (modified, +8/-1)
```diff
@@ -8,7 +8,14 @@ const __dirname = dirname(fileURLToPath(import.meta.url));
 
 /**
  * a11y 烟雾测试专用配置
- * 独立于 vitest.config.ts，避免把 test/a11y.test.tsx 纳入 npm run test:run / ci
+ * 独立于 vitest.config.ts：主配置的 include 只覆盖 src/**，a11y 测试放在 test/ 下，
+ * 因此需要单独的 include 才能被收集。test/a11y.test.tsx 是跨组件集成测试，不归属任何单个组件。
+ *
+ * 为什么单独一个 config（而不是把 test/** 塞进主配置的 include）：
+ *   - test:cov 的覆盖率口径保持只统计 src/ 下的单测，a11y 不参与阈值计算
+ *   - 日常跑单测时 a11y 仍是独立的一档，可单独调试
+ * 注意：npm run test:run 会串联本 config，所以「全绿」= 单测 + a11y 都跑过了，
+ *      不要用 npx vitest run 直接指向 test/a11y.test.tsx（会被主配置的 include 过滤掉）。
  *
  * 与主配置唯一差异：
  *   - include 只指向 test/a11y.test.tsx
```

---

### Incident Patch 5: `9baa9be5` (2026-10-01)
**Commit Message**: fix(rate): address review feedback on keyboard navigation

- Arrow keys now step from the normalized star count instead of the raw
  value: `value={4.6}` used to emit 3.6 and focus a non-existent input,
  and `count={3} value={5}` could emit 4
- Reset the hover preview when a navigation key commits a rating, so a
  pointer resting on an earlier star no longer masks the new selection
- Both cases covered by unit tests

**File**: `src/components/Rate/Rate.test.tsx` (modified, +26/-0)
```diff
@@ -214,6 +214,32 @@ describe('Rate', () => {
             expect(onChange).toHaveBeenLastCalledWith(1);
         });
 
+        it('受控值为小数时按取整后的星级移动并聚焦', async () => {
+            const { user, onChange, getInputs } = setup({ value: 4.6 });
+            getInputs()[4].focus();
+            await user.keyboard('{ArrowLeft}');
+            expect(onChange).toHaveBeenLastCalledWith(4);
+            expect(document.activeElement).toBe(getInputs()[3]);
+        });
+
+        it('受控值超出 count 时方向键仍落在范围内', async () => {
+            const { user, onChange, getInputs } = setup({ count: 3, value: 5 });
+            getInputs()[2].focus();
+            await user.keyboard('{ArrowLeft}');
+            expect(onChange).toHaveBeenLastCalledWith(2);
+            expect(document.activeElement).toBe(getInputs()[1]);
+        });
+
+        it('键盘选择时收起悬停预览', async () => {
+            const { user, getInputs, getLabels, activeCount } = setup({ defaultValue: 2 });
+            await user.hover(getLabels()[4]);
+            expect(activeCount()).toBe(5);
+
+            getInputs()[1].focus();
+            await user.keyboard('{ArrowRight}');
+            expect(activeCount()).toBe(3);
+        });
+
         it('ArrowRight 到最大值后保持不变', async () => {
             const { user, onChange, getInputs } = setup({ defaultValue: 5 });
             getInputs()[4].focus();
```

**File**: `src/components/Rate/Rate.tsx` (modified, +6/-3)
```diff
@@ -86,11 +86,12 @@ export const Rate: React.FC<RateProps> = ({
             switch (e.key) {
                 case 'ArrowRight':
                 case 'ArrowUp':
-                    next = Math.min(count, rateValue + 1);
+                    // 从夹取后的整数值出发：受控值可能是小数或超出 count
+                    next = Math.min(count, checkedValue + 1);
                     break;
                 case 'ArrowLeft':
                 case 'ArrowDown':
-                    next = Math.max(1, rateValue - 1);
+                    next = Math.max(1, checkedValue - 1);
                     break;
                 case 'Home':
                     next = 1;
@@ -103,10 +104,12 @@ export const Rate: React.FC<RateProps> = ({
             }
 
             e.preventDefault();
+            // 键盘选择同样要收起悬停预览，否则停在旧星星上的鼠标会盖住新评分
+            setHoverValue(0);
             inputRefs.current[next - 1]?.focus();
             commit(next);
         },
-        [onKeyDown, readonly, rateValue, count, commit]
+        [onKeyDown, readonly, checkedValue, count, commit]
     );
 
     const handleMouseLeave = useCallback(
```

---

### Incident Patch 6: `29051196` (2026-09-24)
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
 - This is an independently created open-source project. It is not an official product of any game company and has no association, authorization, or cooperation with any company or its products.
 - All visual assets (icons, illustrations, animations) in this repository are original works created for this project.
-- If the copyright holder believes that related content is suspected of infringement, they can contact via email, and I will make rectifications or deletions immediately.
 
 ## Contact
 
-For any questions or copyright-related communications, please contact via Issue or email.
+For any questions, please open a GitHub [Issue](https://github.com/guokaigdg/animal-island-ui/issues).
 
 ## Keep the Island Running
 
 If this project has been helpful to you, consider buying the developer's cat a can of tuna — meowsters are the real fuel that keeps the island running.
 
 [Sponsor this Island](https://guokaigdg.github.io/home/payment.html)
-
-## License
-
-**MIT License** — see the [LICENSE](LICENSE) file for the full text.
-
-- **Permission granted**: to use, copy, modify, merge, publish, distribute, sublic
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

### Incident Patch 7: `aaf3ea98` (2026-09-24)
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

**File**: `src/components/Progress/types.ts` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ export interface ProgressProps {
     size?: ProgressSize;
     /** 是否显示百分比文字（显示在进度条右侧） */
     showInfo?: boolean;
-    /** fill 背景场景图（默认 sweet-corner） */
+    /** fill 背景场景图；不传时为纯色 fill（`#19c8b9`） */
     variant?: ProgressVariant;
     /** 自定义文字格式化（默认 `${percent}%`） */
     infoFormat?: (percent: number) => React.ReactNode;
```

---

### Incident Patch 8: `91294956` (2026-09-15)
**Commit Message**: feat(icon): migrate to naive-icons and drop built-in Icon

**File**: `AGENTS.md` (modified, +4/-3)
```diff
@@ -2,7 +2,8 @@
 
 animal-island-ui is a React 18 + TypeScript 5.7 component library (30 components, Less
 Modules, Vite 7 library build, Vitest 4) inspired by a cozy island-style UI.
-Zero runtime dependencies (`dependencies: {}`); CC BY-NC 4.0 (non-commercial).
+One runtime dependency: `naive-icons` (the icon set); everything else is a peerDependency
+or devDependency. CC BY-NC 4.0 (non-commercial).
 
 This file is the entry point for coding agents. It routes; the referenced docs hold the
 detail. Keep it lean — add new rules to the docs below, not here.
@@ -66,8 +67,8 @@ check `ComponentPage.tsx`'s internal `PAGE_INFO` first.
 
 - Never invent component APIs — read the source or declarations first.
 - Visual changes must satisfy [docs/design-system/design-rules.md](docs/design-system/design-rules.md).
-- No new runtime dependencies; never disable `preserveModules` / `cssCodeSplit`
-  (rationale in [docs/adr/](docs/adr/README.md)).
+- Keep runtime dependencies to a minimum — the only one is `naive-icons`
+  (rationale in [docs/adr/](docs/adr/README.md)); never disable `preserveModules` / `cssCodeSplit`.
 - Conventional Commits; branch from `main`.
 - Docs are English-primary with Chinese mirrors under `docs/zh-CN/`.
 - For audit/optimization requests: report P0 (must-fix) vs suggestions and let the user
```

**File**: `README.md` (modified, +5/-1)
```diff
@@ -19,7 +19,7 @@ A React UI component library with a cute style
     <br/>
     <a href="./coverage/badges/coverage.json"><img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/guokaigdg/animal-island-ui/main/coverage/badges/coverage.json&style=flat-square" alt="Coverage"></a>
     <img src="https://img.shields.io/badge/tests-516%20✓-brightgreen?style=flat-square" alt="Tests">
-    <img src="https://img.shields.io/badge/components-35-blue?style=flat-square" alt="Components">
+    <img src="https://img.shields.io/badge/components-34-blue?style=flat-square" alt="Components">
     <img src="https://img.shields.io/badge/a11y-WAI--ARIA%20APG-brightgreen?style=flat-square" alt="Accessibility">
 </div>
 <br/>
@@ -42,6 +42,10 @@ This project is a lightweight UI component library built with React + TypeScript
 - Online Preview (PC) [animal-island-ui-pc](https://guokaigdg.github.io/animal-island-ui/#/)
 - Online Preview (Mobile) [animal-island-ui-mobile](https://guokaigdg.github.io/animal-island-ui/#/)
 
+## Icons
+
+Need icons? The recommended set is **naive-icons**: <https://github.com/guokaigdg/naive-icons>
+
 ## 🚀 Use AI to Generate animal-island-ui Pages (No Coding Needed)
 
 Non-developer and don't want to write code yourself? Use the
```

**File**: `demo/HomePage.tsx` (modified, +37/-24)
```diff
@@ -1,9 +1,17 @@
 import React, { useState } from 'react';
-import { Card, Button, Typewriter, Icon } from '../src';
-import type { IconName } from '../src';
+import { Card, Button, Typewriter } from '../src';
+import * as Icons from 'naive-icons';
 import { islandGradient } from './gradients';
 import { useIsMobile } from './tools';
 
+type NaiveIcon = React.FC<{ size?: number | string; color?: string; style?: React.CSSProperties }>;
+
+/** 按图标名解析 naive-icons 图标组件（如 'Heart' → HeartIcon） */
+function resolveIcon(name: string): NaiveIcon | null {
+    const Cmp = (Icons as Record<string, unknown>)[`${name}Icon`];
+    return typeof Cmp === 'function' ? (Cmp as NaiveIcon) : null;
+}
+
 // ============================================
 // Syntax highlighting
 // ============================================
@@ -73,6 +81,7 @@ const CodeBlock: React.FC<{ code: string }> = ({ code }) => <pre style={S.codeBo
 
 const FeatureCard: React.FC<{ feature: (typeof features)[0] }> = ({ feature }) => {
     const [hovered, setHovered] = useState(false);
+    const IconCmp = resolveIcon(feature.icon);
     return (
         <Card
             style={{
@@ -99,7 +108,7 @@ const FeatureCard: React.FC<{ feature: (typeof features)[0] }> = ({ feature }) =
                     animation: hovered ? 'iconBounce 0.4s ease forwards' : 'none',
                 }}
             >
-                <Icon name={feature.icon} size={42} />
+                {IconCmp && <IconCmp size={42} />}
             </div>
             <style>
                 {`
@@ -120,7 +129,7 @@ const FeatureCard: React.FC<{ feature: (typeof features)[0] }> = ({ feature }) =
 // Styles
 // ============================================
 // 首页背景装饰：低透明度 Icon 平铺壁纸
-const BG_ICONS: IconName[] = [
+const BG_ICONS: string[] = [
     'Heart',
     'Star',
     'Sun',
@@ -389,7 +398,7 @@ const S = {
 // ============================================
 // Data
 // ============================================
-const features: Array<{ icon: IconName; title: string; desc: string }> = [
+const features: Array<{ icon: string; title: string; desc: string }> = [
     {
         icon: 'Heart',
         title: '治愈系风格',
@@ -526,27 +535,31 @@ const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
             `}</style>
             <div aria-hidden style={S.bgIcons}>
                 {/* 超大 Icon：每次进入随机几个、超级大，作为背景装饰 */}
-                {giants.map((g, i) => (
-                    <div
-                        key={`giant-${i}`}
-                        style={{
-                            position: 'absolute',
-                            left: `${g.left}%`,
-                            top: `${g.top}%`,
-                            transform: `translate(-50%, -50%) rotate(${g.rotate}deg)`,
-                        }}
-                    >
-                        <Icon
-                            name={g.name}
-                            size={g.size}
-                            color="#ffffff"
+                {giants.map((g, i) => {
+                    const GiantCmp = resolveIcon(g.name);
+                    return (
+                        <div
+                            key={`giant-${i}`}
                             style={{
-                                opacity: 0.68, // Home Icon 透明度
-                                animation: `iconFloat ${5.5 + (i % 3)}s ease-in-out ${-i * 1.2}s infinite`,
+                                position: 'absolute',
+                                left: `${g.left}%`,
+                                top: `${g.top}%`,
+                                transform: `translate(-50%, -50%) rotate(${g.rotate}deg)`,
                             }}
-                        />
-                    </div>
-                ))}
+                        >
+                            {GiantCmp && (
+                                <GiantCmp
+                                    size={g.size}
+                                    color="#ffffff"
+                                    style={{
+                                        opacity: 0.68, // Home Icon 透明度
+                                        animation: `iconFloat ${5.5 + (i % 3)}s ease-in-out ${-i * 1.2}s infinite`,
+                                    }}
+                                />
+                            )}
+                        </div>
+                    );
+                })}
             </div>
             {/* Hero */}
             <div style={{ ...S.hero }}>
```

**File**: `demo/components/Divider/index.tsx` (modified, +32/-19)
```diff
@@ -1,5 +1,17 @@
 import React from 'react';
 import { Divider } from '../../../src';
+import {
+    BeeIcon,
+    FishIcon,
+    FlowerIcon,
+    WatermelonIcon,
+    StarIcon,
+    RainbowIcon,
+    CloudIcon,
+    CactusIcon,
+    CakeIcon,
+    CoffeeIcon,
+} from 'naive-icons';
 import { labelStyle, sectionStyle, sectionTitleStyle, DemoTag, ApiTable, ApiRow, CodeBlock } from '../../tools';
 
 const DIVIDER_API: ApiRow[] = [
@@ -11,8 +23,8 @@ const DIVIDER_API: ApiRow[] = [
     },
     {
         prop: 'icon',
-        desc: '指定单一图标名，渲染「图标 + 连接线」相连分割线（与 type 二选一，icon 优先）',
-        type: `IconName（如 'Fish'）`,
+        desc: '指定单一图标元素，渲染「图标 + 连接线」相连分割线（与 type 二选一，icon 优先）',
+        type: `ReactNode（如 <FishIcon size={24} />）`,
         defaultVal: '-',
     },
     { prop: 'iconSize', desc: '图标大小（px）', type: 'number', defaultVal: '24' },
@@ -26,17 +38,17 @@ const DIVIDER_API: ApiRow[] = [
     },
 ];
 
-const ICON_DEMO_NAMES = [
-    'Bee',
-    'Fish',
-    'Flower',
-    'Watermelon',
-    'Star',
-    'Rainbow',
-    'Cloud',
-    'Cactus',
-    'Cake',
-    'Coffee',
+const ICON_DEMO_ICONS = [
+    <BeeIcon size={24} />,
+    <FishIcon size={24} />,
+    <FlowerIcon size={24} />,
+    <WatermelonIcon size={24} />,
+    <StarIcon size={24} />,
+    <RainbowIcon size={24} />,
+    <CloudIcon size={24} />,
+    <CactusIcon size={24} />,
+    <CakeIcon size={24} />,
+    <CoffeeIcon size={24} />,
 ] as const;
 
 const DividerDemo: React.FC = () => (
@@ -55,14 +67,15 @@ const DividerDemo: React.FC = () => (
         <div style={labelStyle}>squiggle（主题青色波浪线）</div>
         <Divider type="squiggle" />
         <div style={labelStyle}>icon（单图标相连分割线）</div>
-        {ICON_DEMO_NAMES.map((name) => (
-            <div key={name} style={{ marginBottom: 16 }}>
-                <Divider icon={name} />
+        {ICON_DEMO_ICONS.map((IconCmp, i) => (
+            <div key={i} style={{ marginBottom: 16 }}>
+                <Divider icon={IconCmp} />
             </div>
         ))}
         <CodeBlock
             code={`import React from 'react';
 import { Divider } from 'animal-island-ui';
+import { FishIcon, StarIcon } from 'naive-icons';
 
 const App = () => {
     return (
@@ -80,9 +93,9 @@ const App = () => {
             {/* 主题青色波浪线 */}
             <Divider type="squiggle" />
 
-            {/* 单图标相连：图标 + 居中短连接线循环铺满 */}
-            <Divider icon="Fish" />
-            <Divider icon="Star" />
+            {/* 单图标相连：图标元素 + 居中短连接线循环铺满 */}
+            <Divider icon={<FishIcon size={24} />} />
+            <Divider icon={<StarIcon size={24} />} />
         </div>
     );
 };
```

**File**: `demo/components/Icon/IconDemo.tsx` (modified, +132/-146)
```diff
@@ -1,64 +1,12 @@
 import React from 'react';
-import { Icon, ICON_LIST, CoffeeIcon, ChatIcon, PlayIcon, CherryIcon, ImageIcon } from '../../../src';
-import { ApiTable, ApiRow, sectionStyle, sectionTitleStyle, DemoTag, CodeBlock, labelStyle } from '../../tools';
-import { islandGradient as customImage } from '../../gradients';
+import * as Icons from 'naive-icons';
+import type { IconComponent } from 'naive-icons';
+import { CodeBlock, sectionStyle, sectionTitleStyle, DemoTag, labelStyle, ApiTable } from '../../tools';
 
-const ICON_API: ApiRow[] = [
-    {
-        prop: 'name',
-        desc: '内置可爱图标名（共 101 个，如 Flower / Heart），与 icon / src 三选一',
-        type: 'IconName',
-        defaultVal: '-',
-    },
-    {
-        prop: 'icon',
-        desc: '任意内置图标组件（import { HeartIcon } from "..."）。与 name / src 三选一，优先级高于 name',
-        type: 'IconComponent',
-        defaultVal: '-',
-    },
-    {
-        prop: 'src',
-        desc: '自定义图片资源 URL（与 name / icon 三选一），用于彩色位图素材',
-        type: 'string',
-        defaultVal: '-',
-    },
-    {
-        prop: 'size',
-        desc: '图标尺寸',
-        type: 'number | string',
-        defaultVal: '24',
-    },
-    {
-        prop: 'color',
-        desc: '描边颜色（svg 模式）',
-        type: 'string',
-        defaultVal: 'currentColor',
-    },
-    {
-        prop: 'strokeWidth',
-        desc: '描边粗细（svg 模式）',
-        type: 'number | string',
-        defaultVal: '3.5',
-    },
-    {
-        prop: 'bounce',
-        desc: '弹跳动画',
-        type: 'boolean',
-        defaultVal: 'false',
-    },
-    {
-        prop: 'className',
-        desc: '自定义类名',
-        type: 'string',
-        defaultVal: '-',
-    },
-    {
-        prop: 'style',
-        desc: '自定义样式',
-        type: 'CSSProperties',
-        defaultVal: '-',
-    },
-];
+/** naive-icons 所有图标组件，按导出顺序排列（共 101 个） */
+const ALL_ICONS: IconComponent[] = (Object.entries(Icons) as Array<[string, unknown]>)
+    .filter(([, value]) => typeof value === 'function')
+    .map(([, value]) => value as IconComponent);
 
 const ZH_NAMES: Record<string, string> = {
     Airplane: '飞机',
@@ -164,44 +112,87 @@ const ZH_NAMES: Record<string, string> = {
     Wifi: '无线',
 };
 
+const fetchIconName = (IconCmp: IconComponent): string =>
+    IconCmp.displayName?.replace(/Icon$/, '') ?? (IconCmp.name as string)?.replace(/Icon$/, '') ?? 'Unknown';
+
+const INSTALL_CODE = `npm install naive-icons
+yarn add naive-icons
+pnpm add naive-icons`;
+
+const USAGE_CODE = `import React from 'react';
+import { FlowerIcon, HeartIcon } from 'naive-icons';
+
+export default function App() {
+    return (
+        <>
+            <FlowerIcon size={32} color="#e05260" strokeWidth={3} />
+            <HeartIcon size={32} />
+        </>
+    );
+}`;
+
 const IconDemo: React.FC = () => (
     <div style={sectionStyle}>
         <div style={sectionTitleStyle}>
-            Icon <DemoTag>built-in icons</DemoTag>
+            Icon <DemoTag>naive-icons</DemoTag>
         </div>
-        <div style={labelStyle}>基础用法（name 内置可爱图标）</div>
-        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'center' }}>
-            <Icon name="Flower" size={32} />
-            <Icon name="Mic" size={32} />
-            <Icon name="Star" size={32} />
-            <Icon name="Sun" size={32} />
-            <Icon name="Umbrella" size={32} />
-            <Icon name="Wifi" size={32} />
-            <Icon name="Map" size={32} />
-            <Icon name="Camera" size={32} />
+        <div style={labelStyle}>
+            图标为独立 npm 包{' '}
+            <a
+                href="https://github.com/guokaigdg/naive-icons"
+                target="_blank"
+                rel="noreferrer"
+                style={{ color: '#725d42' }}
+            >
+                naive-icons
+            </a>
+            —— 手绘 naive folk art 风格的 SVG 图标库，105 个原创图标，为 React 与 TypeScript 打造。请先安装依赖：
+        </div>
+
+        <div style={{ marginBottom: 12 }}>
+            <CodeBlock code={INSTALL_CODE} label="安装" />
         </div>
-        <div style={labelStyle}>icon 模式：库根导出的任意内置图标组件</div>
+
+        <div style={labelStyle}>
+            文档与完整示例参考{' '}
+            <a
+                href="https://github.com/guokaigdg/naive-icons"
+                target="_blank"
+                rel="noreferrer"
+                style={{ color: '#725d42' }}
+            >
+                https://github.com/guokaigdg/naive-icons
+            </a>
+        </div>
+
+        <div style={labelStyle}>基础用法</div>
         <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'center' }}>
-            <Icon icon={CoffeeIcon} size={32} />
-            <Icon icon={PlayIcon} size={32} />
-            <Icon icon={CherryIcon} size={32} />
-            <Icon icon={ImageIcon} size={32} />
-            <Icon icon={ChatIcon} size={32} strokeWidth={3} />
+            <Icons.FlowerIcon size={32} />
+            <Icons.MicIcon size={32} />
+            <Icons.StarIcon size={
```

**File**: `demo/components/Input/index.tsx` (modified, +5/-7)
```diff
@@ -1,5 +1,6 @@
 import React, { useState } from 'react';
-import { Input, Icon } from '../../../src';
+import { Input } from '../../../src';
+import { PhoneIcon } from 'naive-icons';
 import {
     labelStyle,
     sectionStyle,
@@ -84,11 +85,7 @@ const InputDemo: React.FC = () => {
                         onChange={(e) => setInputValue(e.target.value)}
                         onClear={() => setInputValue('')}
                     />
-                    <Input
-                        placeholder="Please enter your phone number"
-                        prefix={<Icon name="Phone" size={20} />}
-                        suffix="⏎"
-                    />
+                    <Input placeholder="Please enter your phone number" prefix={<PhoneIcon size={20} />} suffix="⏎" />
                 </div>
                 <div style={labelStyle}>size 尺寸</div>
                 <div style={{ ...(S.col as any), maxWidth: 360, gap: 12 }}>
@@ -109,6 +106,7 @@ const InputDemo: React.FC = () => {
             <CodeBlock
                 code={`import React, { useState } from 'react';
 import { Input } from 'animal-island-ui';
+import { PhoneIcon, LocationIcon } from 'naive-icons';
 
 const App = () => {
     const [val, setVal] = useState('');
@@ -119,7 +117,7 @@ const App = () => {
             {/* 带清除按钮 */}
             <Input placeholder="With clear" allowClear value={val} onChange={e => setVal(e.target.value)} />
             {/* 前后缀 */}
-            <Input placeholder="Prefix" prefix={<Icon name="Location" size={25} />} suffix="⏎" />
+            <Input placeholder="Prefix" prefix={<LocationIcon size={20} />} suffix="⏎" />
             {/* 小尺寸 */}
             <Input placeholder="Small" size="small" />
             {/* 大尺寸 */}
```

**File**: `demo/components/Skill/data.ts` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ import type { CardColor, CardProps, IconName, TagColor } from '../../../src';
 // 改技能内容时同步此处
 // ============================================
 
-export const INTRO_TAGS = ['React + TypeScript', '30 个组件', '零运行时依赖', 'CC BY-NC 4.0'];
+export const INTRO_TAGS = ['React + TypeScript', '30 个组件', '唯一依赖 naive-icons', 'CC BY-NC 4.0'];
 
 export interface QuickStep {
     title: string;
@@ -120,7 +120,7 @@ export const CATALOG: CatalogRow[] = [
     {
         category: 'General',
         color: 'app-teal',
-        components: ['Button', 'Icon', 'Typewriter', 'Cursor'],
+        components: ['Button', 'Typewriter', 'Cursor'],
         reference: 'general.md',
     },
     {
```

**File**: `demo/components/Skill/index.tsx` (modified, +2/-2)
```diff
@@ -56,8 +56,8 @@ const SkillDemo: React.FC = () => (
                 技能是一个纯文本知识包，没有可执行代码，也不会常驻上下文 —— 代理按下面五步按需消费它：
             </p>
             <div className={styles.stepGrid}>
-                {WORKFLOW.map((step, i) => (
-                    <StepCard key={step.title} step={step} index={i} />
+                {WORKFLOW.map((step) => (
+                    <StepCard key={step.title} step={step} />
                 ))}
             </div>
         </Section>
```

---

### Incident Patch 9: `d14755f3` (2026-09-13)
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

**File**: `skills/animal-island-ui-style/SKILL.md` (modified, +3/-2)
```diff
@@ -12,7 +12,7 @@ description: >
 # animal-island-ui style
 
 animal-island-ui is a React + TypeScript component library with an original
-cozy island-style design — 31 components, zero runtime dependencies,
+cozy island-style design — 35 components, zero runtime dependencies,
 CC BY-NC 4.0 (non-commercial use only).
 
 Source & canonical design definition: https://github.com/guokaigdg/animal-island-ui
@@ -93,7 +93,8 @@ values, defaults — copied from source):
    (CodeBlock excepted).
 9. Motion uses `cubic-bezier(0.4, 0, 0.2, 1)` over 0.15–0.35s.
 10. Icons come from `<Icon name="..." />` (101 built-in cute icon names) — never emoji, Unicode
-    symbols (✓ ✕ →), hand-rolled SVG, or third-party icon libraries.
+    symbols (✓ ✕ →), hand-rolled SVG, or third-party icon libraries. In generated projects prefer
+    the built-in `<Icon />` components over emoji everywhere you can.
 11. Select is controlled-only (`options` + `value` + `onChange` all required). Controlled
     `Input`/`Switch`/`Checkbox`/`Radio` need `onChange` too.
 12. Prefer library components over raw HTML: no visible native `<button>`, `<input>`,
```

**File**: `skills/animal-island-ui-style/SKILL.zh-CN.md` (modified, +6/-6)
```diff
@@ -49,13 +49,13 @@ props 参考按大类分组在 `references/components/` 下（props、合法取
 | 大类 | 组件 | 参考文件 |
 | --- | --- | --- |
 | 通用 | Button, Icon, Typewriter, Cursor | [general.md](references/components/general.md) |
-| 布局 | Card, Title, Divider, Collapse, Tabs | [layout.md](references/components/layout.md) |
-| 表单控件 | Input, Switch, Checkbox, Radio, Select | [form-controls.md](references/components/form-controls.md) |
+| 布局 | Card, Title, Divider, Collapse, Tabs, Background, Carousel | [layout.md](references/components/layout.md) |
+| 表单控件 | Input, Switch, Checkbox, Radio, Select, DatePicker, TimePicker | [form-controls.md](references/components/form-controls.md) |
 | 表单容器 | Form (+ FormItem, useForm) | [Form.md](references/components/Form.md) |
 | 浮层 | Modal, Drawer, Tooltip | [overlays.md](references/components/overlays.md) |
-| 反馈 | Progress, Skeleton, BackTop | [feedback.md](references/components/feedback.md) |
+| 反馈 | Progress, Skeleton, BackTop, Loading, Countdown, Time | [feedback.md](references/components/feedback.md) |
 | 通知 | Notification（命令式 API） | [Notification.md](references/components/Notification.md) |
-| 数据展示 | Table, CodeBlock, Tag | [data-display.md](references/components/data-display.md) |
+| 数据展示 | Table, CodeBlock, Tag, Pagination, Image | [data-display.md](references/components/data-display.md) |
 | 装饰 | Footer, Divider, Cursor, Typewriter | [decorative.md](references/components/decorative.md) |
 
 ### 硬规则（违反即 bug）
@@ -66,10 +66,10 @@ props 参考按大类分组在 `references/components/` 下（props、合法取
 4. 不用冷蓝焦点环。焦点色是黄色（输入类 `#ffcc00`）或薄荷主色（按钮）
 5. 交互元素圆角不小于 12px；按钮和输入框是 50px pill
 6. 3D 堆叠阴影仅属于 primary / danger-primary 按钮。Card 无 box-shadow，Switch 无外阴影，Input 阴影是 opt-in（`shadow={true}`）
-7. Modal 必须保留 SVG blob clip-path，不可换圆角矩形；Title 是燕尾飘带，不是 blob/pill/普通块（`Card type="title"` 已不存在）
+7. Modal 必须保留 SVG blob clip-path，不可换圆角矩形；Title 是燕尾飘带，不是 blob/pill/普通块（`Card type="title"` 已不存在）。**Title 默认用 `variant="ribbon"`**（燕尾横幅），不用缺省的 `layer`
 8. 字体 Nunito + Noto Sans SC；字重不低于 400；UI 文字不用等宽字体（CodeBlock 除外）
 9. 动效统一 `cubic-bezier(0.4, 0, 0.2, 1)`，时长 0.15–0.35s
-10. 图标只用 `<Icon name="..." />`（101 个内置可爱图标名）—— 不用 emoji、Unicode 符号（✓ ✕ →）、手写 SVG 或第三方图标库
+10. 图标只用 `<Icon name="..." />`（101 个内置可爱图标名）—— 不用 emoji、Unicode 符号（✓ ✕ →）、手写 SVG 或第三方图标库。生成项目中能用到图标的地方优先用内置 `<Icon />` 组件，而非 emoji
 11. Select 仅受控（`options` + `value` + `onChange` 都必填）；受控的 `Input`/`Switch`/`Checkbox`/`Radio` 也要配 `onChange`
 12. 优先用库组件而非裸 HTML：可见 UI 不允许原生 `<button>`、`<input>`、`<select>`、原生 checkbox/radio
 13. 只从包根和 `animal-island-ui/style` 导入，不做深路径导入
```

---

### Incident Patch 10: `a4b2e248` (2026-09-13)
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

### Incident Patch 11: `8dd63560` (2026-09-12)
**Commit Message**: feat(divider): add hairline, wave-yellow, squiggle types and icon-connected divider

Extend DividerType with 'hairline', 'wave-yellow' and 'squiggle' (dashed-teal/
white/yellow removed), and support a single-icon connected divider via the
`icon` prop (Footer-style tiling with a centered connector, `iconSize`/
`iconGap`). Keep design-system and skill docs in sync.

**File**: `demo/components/Divider/index.tsx` (modified, +51/-13)
```diff
@@ -6,9 +6,17 @@ const DIVIDER_API: ApiRow[] = [
     {
         prop: 'type',
         desc: '分隔线类型',
-        type: `'dashed-brown' | 'dashed-teal' | 'dashed-white' | 'dashed-yellow'`,
+        type: `'dashed-brown' | 'thin' | 'hairline' | 'wave-yellow' | 'squiggle'`,
         defaultVal: "'dashed-brown'",
     },
+    {
+        prop: 'icon',
+        desc: '指定单一图标名，渲染「图标 + 连接线」相连分割线（与 type 二选一，icon 优先）',
+        type: `IconName（如 'Fish'）`,
+        defaultVal: '-',
+    },
+    { prop: 'iconSize', desc: '图标大小（px）', type: 'number', defaultVal: '24' },
+    { prop: 'iconGap', desc: '图标间距（px），即连接线长度', type: 'number', defaultVal: '8' },
     { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
     {
         prop: 'style',
@@ -18,21 +26,40 @@ const DIVIDER_API: ApiRow[] = [
     },
 ];
 
+const ICON_DEMO_NAMES = [
+    'Bee',
+    'Fish',
+    'Flower',
+    'Watermelon',
+    'Star',
+    'Rainbow',
+    'Cloud',
+    'Cactus',
+    'Cake',
+    'Coffee',
+] as const;
+
 const DividerDemo: React.FC = () => (
     <div style={sectionStyle}>
         <div style={sectionTitleStyle}>
-            Divider <DemoTag>4 types · pure CSS</DemoTag>
+            Divider <DemoTag>5 types + icon divider · pure CSS</DemoTag>
         </div>
         <div style={labelStyle}>dashed-brown（虚线棕色，默认）</div>
         <Divider type="dashed-brown" />
-        <div style={labelStyle}>dashed-teal（虚线青色）</div>
-        <Divider type="dashed-teal" />
-        <div style={labelStyle}>dashed-white（虚线白色）</div>
-        <div style={{ background: '#333', padding: 10 }}>
-            <Divider type="dashed-white" />
-        </div>
-        <div style={labelStyle}>dashed-yellow（虚线黄色）</div>
-        <Divider type="dashed-yellow" />
+        <div style={labelStyle}>thin（1px 细线）</div>
+        <Divider type="thin" />
+        <div style={labelStyle}>hairline（1px 细密虚线）</div>
+        <Divider type="hairline" />
+        <div style={labelStyle}>wave-yellow（黄色波浪线）</div>
+        <Divider type="wave-yellow" />
+        <div style={labelStyle}>squiggle（主题青色波浪线）</div>
+        <Divider type="squiggle" />
+        <div style={labelStyle}>icon（单图标相连分割线）</div>
+        {ICON_DEMO_NAMES.map((name) => (
+            <div key={name} style={{ marginBottom: 16 }}>
+                <Divider icon={name} />
+            </div>
+        ))}
         <CodeBlock
             code={`import React from 'react';
 import { Divider } from 'animal-island-ui';
@@ -42,9 +69,20 @@ const App = () => {
         <div>
             {/* 虚线（linear-gradient 绘制） */}
             <Divider type="dashed-brown" />
-            <Divider type="dashed-teal" />
-            <Divider type="dashed-white" />
-            <Divider type="dashed-yellow" />
+
+            {/* 1px 细线 */}
+            <Divider type="thin" />
+            <Divider type="hairline" />
+
+            {/* 黄色波浪线 */}
+            <Divider type="wave-yellow" />
+
+            {/* 主题青色波浪线 */}
+            <Divider type="squiggle" />
+
+            {/* 单图标相连：图标 + 居中短连接线循环铺满 */}
+            <Divider icon="Fish" />
+            <Divider icon="Star" />
         </div>
     );
 };
```

**File**: `docs/design-system/components/layout.md` (modified, +7/-21)
```diff
@@ -204,30 +204,16 @@ Example:
 
 ```tsx
 <Divider type="dashed-brown" />  // default
-<Divider type="dashed-teal" />
-<Divider type="dashed-white" />
-<Divider type="dashed-yellow" />
+<Divider type="thin" />        // 1px solid #e8dec7
+<Divider type="hairline" />    // 1px dense-dashed #d5c3a2
+<Divider type="wave-yellow" /> // yellow wavy line, #f5d04a
+<Divider type="squiggle" />    // theme-teal seamless squiggle, #19c8b9
+<Divider icon="Fish" />        // single-icon connected divider
 ```
 
-```less
-.divider {
-    width: 100%;
-    height: 12px;
-    /* default type=dashed-brown */
-    background: linear-gradient(to right, #c4b89e 50%, transparent 50%) center / 12px 2px repeat-x;
-}
-.dashed-teal {
-    background: linear-gradient(to right, #19c8b9 50%, transparent 50%) center / 12px 2px repeat-x;
-}
-.dashed-white {
-    background: linear-gradient(to right, #ffffff 50%, transparent 50%) center / 12px 2px repeat-x;
-}
-.dashed-yellow {
-    background: linear-gradient(to right, #f5d04a 50%, transparent 50%) center / 12px 2px repeat-x;
-}
-```
+Pure CSS, no image assets: `dashed-*` types draw a 2px dashed rule via `linear-gradient` (12px rhythm, 50% on / 50% off); `thin` is a 1px solid hairline in `#e8dec7`; `hairline` is a 1px dense dashed rule in `#d5c3a2` (6px rhythm); `wave-yellow` draws a yellow (#f5d04a) repeating wavy line via an inline SVG data-URI (40px period, ±7px amplitude, round line-cap); `squiggle` draws a theme-teal (#19c8b9) squiggle tiled at a fixed 120px width (`repeat-x`, viewBox 0 0 120 10). Its ends meet at the same height with a horizontal tangent, so tiles join seamlessly without stretching as the container widens.
 
-Pure CSS, no image assets: `dashed-*` types draw a 2px dashed rule via `linear-gradient` (12px rhythm, 50% on / 50% off).
+When `icon` is set (an `IconName`, e.g. `'Fish'`), the divider switches to icon-connected mode (same tiling idea as Footer's single-icon chain): a `flex` row repeats `[icon][gap]` units to fill the width, controlled by `iconSize` (default 24) and `iconGap` (default 8). Each gap holds a short 4×2px brown connector bar, horizontally centered so it sits visually between the two neighboring icons; the last icon ends the row without a trailing connector, so both ends of the divider are icons. Cycle count is recalculated on resize via `ResizeObserver`.
 
 ## Background (pattern wallpaper)
 
```

**File**: `docs/zh-CN/design-system/components/layout.md` (modified, +27/-10)
```diff
@@ -204,9 +204,11 @@ interface CarouselProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
 
 ```tsx
 <Divider type="dashed-brown" />  // 默认
-<Divider type="dashed-teal" />
-<Divider type="dashed-white" />
-<Divider type="dashed-yellow" />
+<Divider type="thin" />        // 1px 实线 #e8dec7
+<Divider type="hairline" />    // 1px 细密虚线 #d5c3a2
+<Divider type="wave-yellow" /> // 黄色波浪线 #f5d04a
+<Divider type="squiggle" />    // 主题青色无缝波浪线 #19c8b9
+<Divider icon="Fish" />        // 单图标相连分割线
 ```
 
 ```less
@@ -216,18 +218,33 @@ interface CarouselProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
     /* 默认 type=dashed-brown */
     background: linear-gradient(to right, #c4b89e 50%, transparent 50%) center / 12px 2px repeat-x;
 }
-.dashed-teal {
-    background: linear-gradient(to right, #19c8b9 50%, transparent 50%) center / 12px 2px repeat-x;
+.thin {
+    height: 1px;
+    background: #e8dec7;
 }
-.dashed-white {
-    background: linear-gradient(to right, #ffffff 50%, transparent 50%) center / 12px 2px repeat-x;
+.hairline {
+    height: 1px;
+    background: linear-gradient(to right, #d5c3a2 50%, transparent 50%) center / 6px 1px repeat-x;
 }
-.dashed-yellow {
-    background: linear-gradient(to right, #f5d04a 50%, transparent 50%) center / 12px 2px repeat-x;
+.wave-yellow {
+    height: 14px;
+    background-image: url("data:image/svg+xml,...波浪路径...");
+    background-repeat: repeat-x;
+    background-size: 40px 14px;
+    background-position: center;
+}
+.squiggle {
+    height: 10px;
+    background-image: url("data:image/svg+xml,...波浪路径...");
+    background-repeat: repeat-x;
+    background-size: 120px 10px;
+    background-position: center;
 }
 ```
 
-纯 CSS 实现，无图片资源：`dashed-*` 用 `linear-gradient` 画 2px 破折线（12px 节奏，50% 实 / 50% 空）。
+纯 CSS 实现，无图片资源：`dashed-*` 用 `linear-gradient` 画 2px 破折线（12px 节奏，50% 实 / 50% 空）；`thin` 为 `#e8dec7` 的 1px 实心细线；`hairline` 为 `#d5c3a2` 的 1px 细密虚线（6px 节奏）；`wave-yellow` 用内联 SVG data-URI 画黄色（#f5d04a）重复波浪线（40px 周期，±7px 振幅，圆头线帽）；`squiggle` 用内联 SVG data-URI 画主题青色（#19c8b9）波浪线，固定 120px 宽度平铺（`repeat-x`，viewport 0 0 120 10），首尾同高且切线水平，随容器变宽无缝衔接、不拉伸变形。
+
+传入 `icon`（IconName，如 `'Fish'`）时切换为图标相连模式（与 Footer 单图标链同思路）：flex 行重复 `[图标][空隙]` 单元铺满整行，由 `iconSize`（默认 24）与 `iconGap`（默认 8）控制。每个空隙内放一根 4×2px 棕色短连接条，水平居中，视觉上正好位于相邻两图标中间；最后一个图标不跟连接条，分割线两端都以图标收尾；周期数通过 ResizeObserver 随宽度变化实时重算。
 
 ## Background（图案壁纸）
 
```

**File**: `skills/animal-island-ui-style/references/components/layout.md` (modified, +13/-9)
```diff
@@ -1,7 +1,6 @@
 # Layout components — props reference
 
 Props/types below are copied from the library source. In an npm-installed project, the installed package's TypeScript declarations (`dist/types/index.d.ts`) are the ground truth — prefer exploring them when in doubt.
-
 ## Card
 
 ```ts
@@ -68,26 +67,31 @@ Renders an island-style ribbon banner (swallowtail clip-path ends + fold-shadow
 ```ts
 type DividerType =
     | 'dashed-brown'
-    | 'dashed-teal'
-    | 'dashed-white'
-    | 'dashed-yellow';
+    | 'thin'
+    | 'hairline'
+    | 'wave-yellow'
+    | 'squiggle';
 
 interface DividerProps {
     type?: DividerType; // default 'dashed-brown'
+    icon?: IconName;    // single-icon connected divider (wins over type)
+    iconSize?: number;  // default 24
+    iconGap?: number;   // gap width holding a centered 4x2px connector, default 8
     className?: string;
     style?: React.CSSProperties;
 }
 ```
-
 ```tsx
 <Divider />
-<Divider type="dashed-teal" />
+<Divider type="thin" />      // 1px solid hairline, #e8dec7
+<Divider type="hairline" />  // 1px dense dashed, #d5c3a2
+<Divider type="wave-yellow" /> // yellow wavy line, #f5d04a
+<Divider type="squiggle" />    // theme-teal squiggle, seamless tiled, #19c8b9
+<Divider icon="Fish" />        // icon + centered connector, tiled to fill width
 ```
-
-Height fixed at 12px. Purely decorative dashed rule drawn with `linear-gradient` (12px rhythm, 50% on / 50% off) — no image assets. No `orientation` / `dashed` / `plain` / children — for a vertical separator, use a CSS `border-left` on adjacent elements.
+Height 12px. Purely decorative dashed rule drawn with `linear-gradient` (12px rhythm, 50% on / 50% off) — no image assets. `thin` is a 1px solid rule in `#e8dec7` (height 1px); `hairline` is a 1px dense dashed rule in `#d5c3a2` (6px rhythm); `wave-yellow` is a yellow (#f5d04a) repeating wavy line (40px period, ±7px amplitude, round line-cap); `squiggle` is a theme-teal (#19c8b9) squiggle tiled at a fixed 120px width (`repeat-x`, viewBox 0 0 120 10) whose ends meet at the same height with a horizontal tangent, so tiles join seamlessly without stretching. When `icon` is set, renders a single-icon connected divider (Footer-style tiling, `aria-hidden`): `[icon][gap]` units repeat to fill the width, sized by `iconSize` (default 24) / `iconGap` (default 8), each gap holding a short 4×2px brown connector centered between the two icons; the last icon ends the row without a trailing connector, so both ends are icons. Cycle count recalculated on resize via `ResizeObserver`. No `orientation` / `dashed` / `plain` / children — for a vertical separator, use a CSS `border-left` on adjacent elements.
 
 ## Background
-
 ```ts
 type BackgroundType = 'default' | 'dots-dark-green' | 'sprinkles'
     | 'dots-pink' | 'dots-purple' | 'dots-blue' | 'dots-yellow' | 'dots-orange' | 'dots-teal'
```

**File**: `src/components/Divider/Divider.test.tsx` (modified, +33/-3)
```diff
@@ -10,9 +10,24 @@ describe('Divider', () => {
         expect(root).toHaveClass(styles.divider);
     });
 
-    it('支持自定义 type', () => {
-        const { container } = render(<Divider type="dashed-teal" />);
-        expect(container.firstChild).toHaveClass(styles['dashed-teal']);
+    it('支持 thin 细线 type', () => {
+        const { container } = render(<Divider type="thin" />);
+        expect(container.firstChild).toHaveClass(styles['thin']);
+    });
+
+    it('支持 hairline 1px 虚线 type', () => {
+        const { container } = render(<Divider type="hairline" />);
+        expect(container.firstChild).toHaveClass(styles['hairline']);
+    });
+
+    it('支持 wave-yellow 波浪线 type', () => {
+        const { container } = render(<Divider type="wave-yellow" />);
+        expect(container.firstChild).toHaveClass(styles['wave-yellow']);
+    });
+
+    it('支持 squiggle 波浪线 type', () => {
+        const { container } = render(<Divider type="squiggle" />);
+        expect(container.firstChild).toHaveClass(styles['squiggle']);
     });
 
     it('应用 className 与 style', () => {
@@ -21,4 +36,19 @@ describe('Divider', () => {
         expect(root).toHaveClass('x');
         expect(root).toHaveStyle({ width: '100px' });
     });
+
+    it('icon 模式下渲染图标相连分割线', () => {
+        // jsdom 中容器宽度为 0，mock clientWidth 让 cycles > 1，出现居中连接线
+        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
+        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
+            configurable: true,
+            get: () => 400,
+        });
+        const { container } = render(<Divider icon="Fish" />);
+        const root = container.firstChild as HTMLElement;
+        expect(root).toHaveClass(styles.iconDivider);
+        expect(root.querySelector('svg')).toBeTruthy();
+        expect(container.querySelector(`.${styles.iconLine}`)).toBeTruthy();
+        if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
+    });
 });
```

**File**: `src/components/Divider/Divider.tsx` (modified, +61/-4)
```diff
@@ -1,18 +1,75 @@
-import React from 'react';
+import React, { useEffect, useRef, useState } from 'react';
+import classNames from 'classnames';
+import { Icon } from '../Icon';
+import type { IconName } from '../Icon';
 import styles from './divider.module.less';
 
-export type DividerType = 'dashed-brown' | 'dashed-teal' | 'dashed-white' | 'dashed-yellow';
+export type DividerType = 'dashed-brown' | 'thin' | 'hairline' | 'wave-yellow' | 'squiggle';
+
+/** 单图标相连分割线可用的图标名（复用内置 101 图标） */
+export type DividerIconName = IconName;
 
 export interface DividerProps {
-    /** 分隔线类型 */
+    /** 分隔线类型（type 与 icon 二选一，icon 优先） */
     type?: DividerType;
+    /** 指定单一图标名；传入时渲染「图标 + 连接线」循环相连的装饰分割线，铺满整行 */
+    icon?: DividerIconName;
+    /** 图标大小（px），同 Icon 默认 24 */
+    iconSize?: number;
+    /** 图标间距（px），即相邻图标之间的连接线长度，默认 8（紧密相连） */
+    iconGap?: number;
     /** 自定义类名 */
     className?: string;
     /** 自定义样式 */
     style?: React.CSSProperties;
 }
 
-export const Divider: React.FC<DividerProps> = ({ type = 'dashed-brown', className, style }) => {
+export const Divider: React.FC<DividerProps> = ({
+    type = 'dashed-brown',
+    icon,
+    iconSize = 24,
+    iconGap = 8,
+    className,
+    style,
+}) => {
+    const ref = useRef<HTMLDivElement>(null);
+    const [cycles, setCycles] = useState(1);
+    // 单个周期 = 图标 + 连接线宽度，按容器宽度重复拼接铺满
+    const cycleWidth = iconSize + iconGap;
+
+    useEffect(() => {
+        if (!icon) return undefined;
+        const el = ref.current;
+        if (!el) return undefined;
+        const update = () => {
+            setCycles(Math.max(1, Math.floor(el.clientWidth / cycleWidth)));
+        };
+        update();
+        if (typeof ResizeObserver !== 'undefined') {
+            const ro = new ResizeObserver(update);
+            ro.observe(el);
+            return () => ro.disconnect();
+        }
+        return undefined;
+    }, [icon, cycleWidth]);
+
+    if (icon) {
+        return (
+            <div ref={ref} className={classNames(styles.iconDivider, className)} style={style} aria-hidden="true">
+                {Array.from({ length: cycles }).map((_, c) => (
+                    <div key={c} className={styles.iconCycle} {...(c > 0 ? { 'aria-hidden': true } : {})}>
+                        <Icon name={icon} size={iconSize} />
+                        {c < cycles - 1 && (
+                            <span className={styles.iconGap} style={{ width: iconGap }}>
+                                <span className={styles.iconLine} />
+                            </span>
+                        )}
+                    </div>
+                ))}
+            </div>
+        );
+    }
+
     const cls = [styles.divider, styles[type], className].filter(Boolean).join(' ');
     return <div className={cls} style={style} />;
 };
```

**File**: `src/components/Divider/divider.module.less` (modified, +54/-6)
```diff
@@ -8,14 +8,62 @@
     background: linear-gradient(to right, #c4b89e 50%, transparent 50%) center / 12px 2px repeat-x;
 }
 
-.dashed-teal {
-    background: linear-gradient(to right, #19c8b9 50%, transparent 50%) center / 12px 2px repeat-x;
+// thin — 1px 实心细线
+.thin {
+    height: 1px;
+    background: #e8dec7;
 }
 
-.dashed-white {
-    background: linear-gradient(to right, #ffffff 50%, transparent 50%) center / 12px 2px repeat-x;
+// hairline — 1px 细密虚线（6px 节奏）
+.hairline {
+    height: 1px;
+    background: linear-gradient(to right, #d5c3a2 50%, transparent 50%) center / 6px 1px repeat-x;
 }
 
-.dashed-yellow {
-    background: linear-gradient(to right, #f5d04a 50%, transparent 50%) center / 12px 2px repeat-x;
+// wave-yellow — 黄色波浪线（内联 SVG data-URI，40px 周期，round 线帽）
+.wave-yellow {
+    height: 14px;
+    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 14' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q10 0 20 7 T40 7' fill='none' stroke='%23f5d04a' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
+    background-repeat: repeat-x;
+    background-size: 40px 14px;
+    background-position: center;
+}
+
+// squiggle — 主题青色波浪线（内联 SVG data-URI，120px 固定宽度平铺，首尾水平衔接无缝）
+.squiggle {
+    height: 10px;
+    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 10'%3E%3Cpath d='M0 2.5 C 30 2.5, 30 7.5, 60 7.5 C 90 7.5, 90 2.5, 120 2.5' fill='none' stroke='%2319c8b9' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E");
+    background-repeat: repeat-x;
+    background-size: 120px 10px;
+    background-position: center;
+}
+
+// iconDivider — 单图标相连分割线：图标 + 连接线循环铺满（复用 Footer 循环拼接思路）
+.iconDivider {
+    display: flex;
+    width: 100%;
+    overflow: hidden;
+    align-items: center;
+    min-height: 20px;
+}
+
+.iconCycle {
+    display: flex;
+    flex: 0 0 auto;
+    align-items: center;
+}
+
+// 图标间距：容纳连接线的空隙，连接线在其中水平居中（两侧留白，视觉位于两图标中间）
+.iconGap {
+    flex: 0 0 auto;
+    display: flex;
+    align-items: center;
+    justify-content: center;
+}
+
+.iconLine {
+    flex: 0 0 auto;
+    width: 4px;
+    height: 2px;
+    background: #c4b89e;
 }
```

---

### Incident Patch 12: `75d0a745` (2026-09-09)
**Commit Message**: feat(icon): replace lucide-react with a built-in 101-icon registry

**File**: `.trae/documents/icon-refactor.md` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+# Icon 组件重构：用内置 Naive 图标集全替换 lucide-react
+
+## Context（背景）
+
+当前主 `Icon` 组件基于 **lucide-react**（`name` 13 个语义名 + `icon` 接收 `LucideIcon`），
+并把 `lucide-react` 列为运行时依赖，违反项目「零运行时依赖」的定位（AGENTS.md）。
+
+仓库里已存在一套与 lucide 等价的完整可爱图标集：
+
+- `src/components/Icon/src/` —— 101 个 React 组件（如 `FlowerIcon`），由 `src/index.ts` 聚合导出，
+  共享类型在 `src/types.ts`（`IconName` 101 联合、`IconComponent`、`NAIVE_PALETTE`、`ICON_CATEGORIES`）。
+- `src/components/Icon/svg/` —— 同名 101 个原始 `.svg` 文件。
+
+目标：主 `Icon` 组件改用它，**彻底移除 lucide-react 依赖**（运行时依赖归零）。
+
+已与用户确认的 API 形态：
+
+1. `name` 用 **帕斯卡命名**（`<Icon name="HeartIcon" />`），复用 `src/types.ts` 的 `IconName` 联合类型。
+2. 库根 `src/index.ts` **导出全部 101 个独立图标组件**（替换 lucide 的等价能力，`import { HeartIcon } from '...'`）。
+
+## 现有 lucide 依赖点
+
+- `src/components/Icon/Icon.tsx`（主组件）
+- `src/components/DatePicker/DatePicker.tsx`（`ChevronLeft`/`ChevronRight`，6 处：L623/638/658/673/709/773）
+- `src/components/Icon/Icon.test.tsx`
+- `demo/components/Icon/IconDemo.tsx`
+- `vite.config.ts` L318 `external` 数组
+- `package.json` `dependencies.lucide-react`
+
+## 改动方案
+
+### 1. 重写 `src/components/Icon/Icon.tsx`
+
+- 删除 lucide 相关 import 与 `BUILTIN_ICONS`（13 语义名）。
+- 用一句话注册表替代显式 101 import：
+
+    ```ts
+    import * as NAIVE from './src';
+    import type { IconName, IconComponent } from './src/types';
+
+    const ICONS: Record<IconName, IconComponent> = Object.fromEntries(
+        Object.entries(NAIVE).filter(([, v]) => typeof v === 'function')
+    ) as Record<IconName, IconComponent>;
+    ```
+
+    （`export * from './types'` 在运行时是对象/常量，被 `typeof === 'function'` 过滤；key = 帕斯卡组件名。）
+
+- `IconProps`：
+    - `name?: IconName`
+    - `icon?: IconComponent`（改为接受 Naive 组件，如 `IconComponent`）
+    - 保留 `src?: string`（span 背景模式）、`size`、`color`、`strokeWidth`、`bounce`。
+- 渲染：`IconCmp = icon ?? (name ? ICONS[name] : undefined)`；svg 模式把 `color` 映射为 **`stroke=`**（Naive 组件把 props 散布到 svg 根，`color` 直接传上去只会变 svg `color` 而非描边），`size` 通过内联 `width/height`，保留 `aria-hidden`/`role` 逻辑。`src` 模式仍渲染 span。
+- className 改为 `[styles.icon, bounce && styles['icon-bounce'], className].filter(Boolean).join(' ')`（去掉按旧语义名的 `styles[name]`）。
+- `ICON_LIST` 由 `Object.entries(ICONS)` 派生 → `{ name, label }`（label 由帕斯卡名去 `Icon` 后缀即可，如 `HeartIcon → Heart`），供 demo/文档展示。
+
+### 2. 库根 `src/index.ts` 导出全部 101 组件
+
+- 保留 `export * from './components/Icon';`（含 `Icon`、`ICON_LIST`、`IconProps`、`IconName`）。
+- 追加**显式具名**导出 101 个 `*Icon` 组件：
+  `export { AirplaneIcon, ... WifiIcon } from './components/Icon/src';`
+  （只导出组件名，避开 `src/types.ts` 的 `IconProps`/`IconName` 与主组件同名冲突。101 个名字以 `src/components/Icon/src/index.ts` 的导出列表与 `src/types.ts::IconName` 联合为准。）
+
+### 3. DatePicker：切掉 lucide 箭头
+
+- 删除 `import { ChevronLeft, ChevronRight } from 'lucide-react';`。
+- 6 处箭头全部换成**内联 svg**（复用文件内已有的月份按钮内联样式，见 L719-727/755-763）。
+  年份箭头尺寸 16 + `styles.navIcon`，月份箭头尺寸 12：`<svg className={styles.navIcon} width="16" height="16" viewBox="0 0 12 12" fill="none" aria-hidden>...</svg>`。
+
+### 4. Image 占位图标
+
+- `src/components/Image/Image.tsx` L138 `<Icon name="page" />` → `<Icon name="ImageIcon" />`。
+
+### 5. demo Skill 文案图标重映射（`demo/components/Skill/data.ts`）
+
+`IconName` 已从库根导入，改字符串即可：
+
+- WORKFLOW：`icon-shopping→ShoppingBagIcon`、`icon-chat→ChatIcon`、`icon-variant→GlobeIcon`、`icon-encyclopedia→BookIcon`、`icon-design→PaintbrushIcon`
+- SCENARIOS：`icon-design→CodeIcon`、`icon-map→FileIcon`
+- RULE_GROUPS：`icon-encyclopedia→BookIcon`、`icon-map→MapIcon`、`icon-design→PaintbrushIcon`、`icon-diy→PencilIcon`、`icon-camera→CameraIcon`
+- 顺带把 data.ts L219 文案「内置 13 个」/「任一 lucide 图标」改为「内置全量图标」表述。
+- `parts.tsx` 无硬编码名，自动跟随。
+
+### 6. demo IconDemo（`demo/components/Icon/IconDemo.tsx`）
+
+- 删除 `import { Heart, Star, Sun, Umbrella } from 'lucide-react'`。
+- name 区改用帕斯卡名示例（如 `HeartIcon/StarIcon/SunIcon/UmbrellaIcon/CameraIcon/WifiIcon/MapIcon/FlowerIcon`）。
+- icon 区：从库根 `import { HeartIcon, StarIcon, SunIcon, UmbrellaIcon } from '../../../src'`，`<Icon icon={HeartIcon} color="#e05260" />`。
+- 更新 API 表 `ICON_API`：`name` 描述为内置可爱图标（101）；`icon` 类型改 `IconComponent`；
+  `color/strokeWidth` 文案去掉「lucide 模式」字样。
+- 更新 `CodeBlock` 示例：去掉 `import { Heart } from 'lucide-react'`，改用内置图标。
+
+### 7. 测试
+
+- `src/components/Icon/Icon.test.tsx` 重写为 Naive 断言：
+    - `<Icon name="HeartIcon" />` → 渲染 svg、有 `styles.icon`、无 backgroundImage。
+    - `<Icon icon={HeartIcon} />`（从 `./src` import）→ svg + path。
+    - size（数字/字符串）、bounce、className/style 沿用。
+    - `color` 映射为 `stroke` 属性、`strokeWidth` 映射为 `stroke-width`。
+    - `src` 模式仍渲染 span + backgroundImage。
+    - `ICON_LIST`：长度 = 101、无重复、每项有非空 label。
+    - 保留 aria-hidden/role/可访问名契约用例。
+    - 移除所有 lucide import。
+- `test/a11y.test.tsx` L152 `<Icon name="page" />` → `<Icon name="HeartIcon" />`。
+
+### 8. 构建/依赖
+
+- `vite.config.ts` L318 `external` 数组移除 `'lucide-react'`。
+- `package.json` 删除 `dependencies.lucide-react`，`npm install` 更新 `package-lock.json`（并确认 `dependencies` 变为空 → 满足文档「零运行时依赖」）。
+
+### 9. 文档同步（en + zh-CN 成对）
+
+开发计划：`check:docs` 强制每个组件在 design-syst
```

**File**: `demo/components/Skill/data.ts` (modified, +13/-13)
```diff
@@ -42,31 +42,31 @@ export interface WorkflowStep {
 /** 工作原理 —— 代理视角的五步 */
 export const WORKFLOW: WorkflowStep[] = [
     {
-        icon: 'icon-shopping',
+        icon: 'ShoppingBag',
         pattern: 'app-blue',
         title: '装载',
         desc: '技能是纯文本知识包，没有可执行代码，安装后躺在代理的 skills 目录里',
     },
     {
-        icon: 'icon-chat',
+        icon: 'Chat',
         pattern: 'app-orange',
         title: '触发',
         desc: '代理按 SKILL.md 的 description 匹配当前对话，命中才加载正文，不占用日常上下文',
     },
     {
-        icon: 'icon-variant',
+        icon: 'Globe',
         pattern: 'app-yellow',
         title: '路由',
         desc: 'React 项目读 react-project.md，单文件 HTML 读 standalone-html.md',
     },
     {
-        icon: 'icon-encyclopedia',
+        icon: 'Book',
         pattern: 'app-teal',
         title: '对照 API',
         desc: 'props、合法取值、默认值逐个查 references/components/，杜绝凭印象编造',
     },
     {
-        icon: 'icon-design',
+        icon: 'Paintbrush',
         pattern: 'brown',
         title: '产出',
         desc: '按令牌与硬性规则落地：暖色羊皮纸、薄荷主色、胶囊形状与 3D 按钮质感',
@@ -85,15 +85,15 @@ export interface Scenario {
 export const SCENARIOS: Scenario[] = [
     {
         title: 'React 项目',
-        icon: 'icon-design',
+        icon: 'Code',
         color: 'app-teal',
         agents: ['Claude Code', 'Codex', 'Cursor'],
         desc: '已安装 animal-island-ui npm 包的工程：代理以包内 TypeScript 声明为准搭页面，并用 --animal-* 令牌做主题。',
         entry: 'references/react-project.md',
     },
     {
         title: '独立 HTML',
-        icon: 'icon-map',
+        icon: 'File',
         color: 'app-yellow',
         agents: ['任意兼容代理'],
         desc: '无 npm、无打包器：React 走 CDN + Babel 运行时，手写组件但镜像真实 API，产出单个 index.html。',
@@ -173,7 +173,7 @@ export interface RuleGroup {
 export const RULE_GROUPS: RuleGroup[] = [
     {
         title: 'API 纪律',
-        icon: 'icon-encyclopedia',
+        icon: 'Book',
         color: 'app-red',
         rules: [
             '绝不编造 props —— 每个 prop 必须出现在组件参考或包内 TS 声明中。',
@@ -183,7 +183,7 @@ export const RULE_GROUPS: RuleGroup[] = [
     },
     {
         title: '导入与工程',
-        icon: 'icon-map',
+        icon: 'Map',
         color: 'app-blue',
         rules: [
             "样式只导入一次：应用入口 `import 'animal-island-ui/style'`，否则组件无样式。",
@@ -193,7 +193,7 @@ export const RULE_GROUPS: RuleGroup[] = [
     },
     {
         title: '色彩与字体',
-        icon: 'icon-design',
+        icon: 'Paintbrush',
         color: 'app-pink',
         rules: [
             '禁用纯黑（#000 / #111）文字与冷灰（#fafafa / #f5f5f5）背景。',
@@ -203,7 +203,7 @@ export const RULE_GROUPS: RuleGroup[] = [
     },
     {
         title: '形状与质感',
-        icon: 'icon-diy',
+        icon: 'Pencil',
         color: 'app-yellow',
         rules: [
             '可交互元素圆角不得小于 12px；按钮与输入框为 50px 胶囊。',
@@ -213,10 +213,10 @@ export const RULE_GROUPS: RuleGroup[] = [
     },
     {
         title: '图标与动效',
-        icon: 'icon-camera',
+        icon: 'Camera',
         color: 'app-teal',
         rules: [
-            '图标一律用 <Icon name="..." />（内置 13 个）或 <Icon icon={...} />（任一 lucide 图标）—— 禁止 emoji、Unicode 符号、手写 SVG、第三方图标字体。',
+            '图标一律用 <Icon name="..." />（内置可爱图标集，共 101 个）或 <Icon icon={...} />（内置图标组件）—— 禁止 emoji、Unicode 符号、手写 SVG、第三方图标库。',
             '动效使用 cubic-bezier(0.4, 0, 0.2, 1)，时长 0.15–0.35s。',
         ],
     },
```

**File**: `package-lock.json` (modified, +5/-14)
```diff
@@ -1,16 +1,13 @@
 {
     "name": "animal-island-ui",
-    "version": "1.9.0",
+    "version": "1.10.0",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "animal-island-ui",
-            "version": "1.9.0",
+            "version": "1.10.0",
             "license": "CC-BY-NC-4.0",
-            "dependencies": {
-                "lucide-react": "^1.40.0"
-            },
             "devDependencies": {
                 "@eslint/js": "^9.0.0",
                 "@fontsource/noto-sans-sc": "^5.2.9",
@@ -4385,6 +4382,7 @@
             "version": "4.0.0",
             "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
             "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
+            "dev": true,
             "license": "MIT"
         },
         "node_modules/js-yaml": {
@@ -4654,6 +4652,7 @@
             "version": "1.4.0",
             "resolved": "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz",
             "integrity": "sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==",
+            "dev": true,
             "license": "MIT",
             "dependencies": {
                 "js-tokens": "^3.0.0 || ^4.0.0"
@@ -4672,15 +4671,6 @@
                 "yallist": "^3.0.2"
             }
         },
-        "node_modules/lucide-react": {
-            "version": "1.40.0",
-            "resolved": "https://registry.npmmirror.com/lucide-react/-/lucide-react-1.40.0.tgz",
-            "integrity": "sha512-MaG+8WnOXkDWz9XeElj7TnQ890tTZUB0a36i03aRRCKGWE6e7jJpmdCvtxxuxcjjdqyN6m4sL6qlHVuSUDtYgg==",
-            "license": "ISC",
-            "peerDependencies": {
-                "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0"
-            }
-        },
         "node_modules/lz-string": {
             "version": "1.5.0",
             "resolved": "https://registry.npmjs.org/lz-string/-/lz-string-1.5.0.tgz",
@@ -5332,6 +5322,7 @@
             "version": "18.3.1",
             "resolved": "https://registry.npmjs.org/react/-/react-18.3.1.tgz",
             "integrity": "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==",
+            "dev": true,
             "license": "MIT",
             "dependencies": {
                 "loose-envify": "^1.1.0"
```

**File**: `package.json` (modified, +2/-5)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "animal-island-ui",
-    "version": "1.9.0",
+    "version": "1.10.0",
     "description": "A nature-inspired React component library",
     "type": "module",
     "main": "dist/cjs/index.cjs",
@@ -101,8 +101,5 @@
         "animal-island-ui",
         "nature"
     ],
-    "license": "CC-BY-NC-4.0",
-    "dependencies": {
-        "lucide-react": "^1.40.0"
-    }
+    "license": "CC-BY-NC-4.0"
 }
```

**File**: `src/components/DatePicker/DatePicker.tsx` (modified, +74/-21)
```diff
@@ -1,6 +1,5 @@
 import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
 import styles from './date-picker.module.less';
-import { ChevronLeft, ChevronRight } from 'lucide-react';
 
 export type DatePickerSize = 'small' | 'middle' | 'large';
 
@@ -620,11 +619,20 @@ export const DatePicker: React.FC<DatePickerProps> = ({
                                                             onClick={() => shiftView(-1, 0)}
                                                             onMouseDown={(e) => e.preventDefault()}
                                                         >
-                                                            <ChevronLeft
+                                                            <svg
                                                                 className={styles.navIcon}
-                                                                size={16}
-                                                                aria-hidden="true"
-                                                            />
+                                                                viewBox="0 0 12 12"
+                                                                fill="none"
+                                                                aria-hidden
+                                                            >
+                                                                <path
+                                                                    d="M7.5 2.5L4 6l3.5 3.5"
+                                                                    stroke="currentColor"
+                                                                    strokeWidth="1.5"
+                                                                    strokeLinecap="round"
+                                                                    strokeLinejoin="round"
+                                                                />
+                                                            </svg>
                                                         </button>
                                                     )}
                                                     {idx === 0 && (
@@ -635,11 +643,21 @@ export const DatePicker: React.FC<DatePickerProps> = ({
                                                             onClick={() => shiftView(0, -1)}
                                                             onMouseDown={(e) => e.preventDefault()}
                                                         >
-                                                            <ChevronLeft
-                                                                size={12}
-                                                                strokeWidth={1.5}
-                                                                aria-hidden="true"
-                                                            />
+                                                            <svg
+                                                                width="12"
+                                                                height="12"
+                                                                viewBox="0 0 12 12"
+                                                                fill="none"
+                                                                aria-hidden
+                                                            >
+                                                                <path
+                                                                    d="M7.5 2.5L4 6l3.5 3.5"
+                                                                    stroke="currentColor"
+                                                                    strokeWidth="1.5"
+                                                                    strokeLinecap="round"
+                                                                    strokeLinejoin="round"
+                                                                />
+                                                            </svg>
                                                         </button>
                                                     )}
                                                 </div>
@@ -655,11 +673,21 @@ export const DatePicker: React.FC<DatePickerProps> = ({
                                                             onClick={() => shiftView(0, 1)}
                                                             onMouseDown={(e) => e.preventDefault()}
                                                         >
-                                                            <ChevronRight
-                                                                size={12}
-                                                                strokeWidth={1.5}
-                                                                aria-hidden="true"
-                                                            />
+ 
```

**File**: `src/components/Icon/Icon.test.tsx` (modified, +31/-44)
```diff
@@ -1,56 +1,62 @@
 import { describe, it, expect } from 'vitest';
 import { render } from '@testing-library/react';
-import { Heart } from 'lucide-react';
+import { HeartIcon } from './src';
 import { Icon, ICON_LIST } from './Icon';
 import styles from './icon.module.less';
 
 describe('Icon', () => {
-    it('name 模式渲染 lucide svg 并应用对应 className', () => {
-        const { container } = render(<Icon name="wifi" />);
+    it('name 模式渲染内置 svg 图标并应用 base 类名', () => {
+        const { container } = render(<Icon name="Heart" />);
         const root = container.firstChild as HTMLElement;
         expect(root.tagName).toBe('svg');
         expect(root).toHaveClass(styles.icon);
-        expect(root).toHaveClass(styles.wifi);
     });
 
-    it('icon 模式渲染传入的任意 lucide 图标', () => {
-        const { container } = render(<Icon icon={Heart} />);
+    it('icon 模式渲染传入的内置图标组件', () => {
+        const { container } = render(<Icon icon={HeartIcon} />);
         const root = container.firstChild as HTMLElement;
         expect(root.tagName).toBe('svg');
         expect(root.querySelector('path')).toBeTruthy();
     });
 
     it('size 应用为内联 width/height', () => {
-        const { container } = render(<Icon name="page" size={32} />);
+        const { container } = render(<Icon name="Heart" size={32} />);
         const root = container.firstChild as HTMLElement;
         expect(root).toHaveStyle({ width: '32px', height: '32px' });
     });
 
     it('支持字符串 size（如 100%）', () => {
-        const { container } = render(<Icon name="page" size="100%" />);
+        const { container } = render(<Icon name="Heart" size="100%" />);
         const root = container.firstChild as HTMLElement;
         expect(root).toHaveStyle({ width: '100%' });
     });
 
     it('bounce=true 应用 icon-bounce', () => {
-        const { container } = render(<Icon name="page" bounce />);
+        const { container } = render(<Icon name="Heart" bounce />);
         expect(container.firstChild).toHaveClass(styles['icon-bounce']);
     });
 
     it('应用自定义 className 与 style', () => {
-        const { container } = render(<Icon name="page" className="extra" style={{ opacity: 0.5 }} />);
+        const { container } = render(<Icon name="Heart" className="extra" style={{ opacity: 0.5 }} />);
         const root = container.firstChild as HTMLElement;
         expect(root).toHaveClass('extra');
         expect(root).toHaveStyle({ opacity: '0.5' });
     });
 
-    it('color 与 strokeWidth 透传给 lucide 图标', () => {
-        const { container } = render(<Icon name="wifi" color="#ff0000" strokeWidth={3} />);
+    it('color 映射为 stroke、strokeWidth 映射为 stroke-width', () => {
+        const { container } = render(<Icon name="Heart" color="#ff0000" strokeWidth={3} />);
         const root = container.firstChild as HTMLElement;
         expect(root).toHaveAttribute('stroke', '#ff0000');
         expect(root).toHaveAttribute('stroke-width', '3');
     });
 
+    it('未传 color / strokeWidth 时不覆盖内置默认值', () => {
+        const { container } = render(<Icon name="Heart" />);
+        const root = container.firstChild as HTMLElement;
+        expect(root).toHaveAttribute('stroke', '#2A2A2A');
+        expect(root).toHaveAttribute('stroke-width', '3.5');
+    });
+
     it('src 模式渲染 span 并设置 backgroundImage', () => {
         const { container } = render(<Icon src="/foo/custom-001.png" />);
         const root = container.firstChild as HTMLElement;
@@ -59,7 +65,7 @@ describe('Icon', () => {
     });
 
     it('未传 size 时默认 24px', () => {
-        const { container } = render(<Icon name="wifi" />);
+        const { container } = render(<Icon name="Heart" />);
         expect(container.firstChild).toHaveStyle({ width: '24px', height: '24px' });
     });
 
@@ -72,67 +78,48 @@ describe('Icon', () => {
     });
 
     it('name 模式（非 src）不设置 backgroundImage', () => {
-        const { container } = render(<Icon name="page" />);
+        const { container } = render(<Icon name="Heart" />);
         const root = container.firstChild as HTMLElement;
         expect(root.style.backgroundImage).toBe('');
     });
 
     it('bounce 默认 false，不应用 icon-bounce', () => {
-        const { container } = render(<Icon name="page" />);
+        const { container } = render(<Icon name="Heart" />);
         expect(container.firstChild).not.toHaveClass(styles['icon-bounce']);
     });
 
     it('icon 优先级高于 name', () => {
-        const { container } = render(<Icon name="wifi" icon={Heart} />);
+        const { container } = render(<Icon name="Heart" icon={HeartIcon} />);
         const root = container.firstChild as HTMLElement;
         expect(root.tagName).toBe('svg');
     });
 
     it('透传未知属性到根节点（如 data-* / aria-label）', () => {
-        const { container } = render(<Icon name="wifi" data-testid="my-icon" aria-label="信号" />);
+        const { container } = render(<Icon name="Heart" data-testid="my-icon" aria-label="爱心" />);
         const root = container.firstChild as HTMLElement;
         expect(root).toH
```

**File**: `src/components/Icon/Icon.tsx` (modified, +30/-77)
```diff
@@ -1,65 +1,26 @@
 import React from 'react';
-import {
-    BookOpen,
-    Camera,
-    ChevronLeft,
-    ChevronRight,
-    FileText,
-    Hammer,
-    Map,
-    MapPin,
-    MessageCircle,
-    Palette,
-    Shuffle,
-    ShoppingCart,
-    Wifi,
-    type LucideIcon,
-} from 'lucide-react';
+import * as NAIVE from './src';
+import type { IconName, IconComponent } from './src/types';
 import styles from './icon.module.less';
 
-export type IconName =
-    | 'icon-left'
-    | 'icon-right'
-    | 'location'
-    | 'page'
-    | 'wifi'
-    | 'icon-shopping'
-    | 'icon-chat'
-    | 'icon-variant'
-    | 'icon-encyclopedia'
-    | 'icon-design'
-    | 'icon-map'
-    | 'icon-diy'
-    | 'icon-camera';
-
-/** 内置语义图标：均渲染 lucide-react 图标（https://lucide.dev/icons/） */
-const BUILTIN_ICONS: Record<IconName, LucideIcon> = {
-    'icon-left': ChevronLeft,
-    'icon-right': ChevronRight,
-    location: MapPin,
-    page: FileText,
-    wifi: Wifi,
-    'icon-shopping': ShoppingCart,
-    'icon-chat': MessageCircle,
-    'icon-variant': Shuffle,
-    'icon-encyclopedia': BookOpen,
-    'icon-design': Palette,
-    'icon-map': Map,
-    'icon-diy': Hammer,
-    'icon-camera': Camera,
-};
+/** 内置可爱图标注册表：key 为去掉 Icon 后缀的名字（如 Flower），来自 src/components/Icon/src 的全部 101 个 *Icon 组件 */
+const ICONS: Record<IconName, IconComponent> = Object.fromEntries(
+    Object.entries(NAIVE)
+        .filter(([, value]) => typeof value === 'function')
+        .map(([cmpName, value]) => [cmpName.replace(/Icon$/, ''), value])
+) as Record<IconName, IconComponent>;
 
 export interface IconProps extends Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
-    /** 内置具名图标。与 icon / src 二选一 */
+    /** 内置可爱图标名（共 101 个，如 Heart / Flower）。与 icon / src 三选一 */
     name?: IconName;
-    /** 任意 lucide-react 图标组件（import { Heart } from 'lucide-react'）。与 name / src 二选一 */
-    icon?: LucideIcon;
-    /** 自定义图标资源 URL。与 name / icon 二选一，用于彩色位图等非矢量场景 */
+    /** 任意内置图标组件（import { HeartIcon } from 'animal-island-ui'）。与 name / src 三选一，优先级高于 name */
+    icon?: IconComponent;
+    /** 自定义图标资源 URL。与 name / icon 三选一，用于彩色位图等非矢量场景 */
     src?: string;
     size?: number | string;
-    /** 描边颜色（lucide 模式），默认继承 currentColor */
+    /** 描边颜色（svg 模式），默认继承 currentColor */
     color?: string;
-    /** 描边粗细（lucide 模式），默认 2 */
+    /** 描边粗细（svg 模式），默认 3.5 */
     strokeWidth?: number | string;
     bounce?: boolean;
 }
@@ -76,23 +37,23 @@ export const Icon: React.FC<IconProps> = ({
     bounce = false,
     ...rest
 }) => {
-    const cls = [styles.icon, name ? styles[name] : '', bounce ? styles['icon-bounce'] : '', className || '']
-        .filter(Boolean)
-        .join(' ');
+    const cls = [styles.icon, bounce ? styles['icon-bounce'] : '', className || ''].filter(Boolean).join(' ');
 
-    const LucideCmp = icon ?? (name ? BUILTIN_ICONS[name] : undefined);
+    const IconCmp = icon ?? (name ? ICONS[name] : undefined);
 
-    if (LucideCmp) {
+    if (IconCmp) {
         const labeled = Boolean(rest['aria-label']);
+        const passthrough: Record<string, unknown> = { ...(rest as object) };
+        // Naive 组件默认 stroke="#2A2A2A" strokeWidth={3.5}；仅当显式传入时才覆盖，避免 undefined 把默认值冲掉
+        if (color !== undefined) passthrough.stroke = color;
+        if (strokeWidth !== undefined) passthrough.strokeWidth = strokeWidth;
         return (
-            <LucideCmp
+            <IconCmp
                 className={cls}
-                color={color}
-                strokeWidth={strokeWidth}
                 style={{ width: size, height: size, ...style }}
                 aria-hidden={labeled ? undefined : true}
                 role={labeled ? 'img' : undefined}
-                {...(rest as React.SVGProps<SVGSVGElement>)}
+                {...(passthrough as React.SVGProps<SVGSVGElement>)}
             />
         );
     }
@@ -111,18 +72,10 @@ export const Icon: React.FC<IconProps> = ({
     );
 };
 
-export const ICON_LIST = [
-    { name: 'icon-left', label: 'Left' },
-    { name: 'icon-right', label: 'Right' },
-    { name: 'location', label: 'Location' },
-    { name: 'page', label: 'Page' },
-    { name: 'wifi', label: 'WiFi' },
-    { name: 'icon-shopping', label: 'Shopping' },
-    { name: 'icon-chat', label: 'Chat' },
-    { name: 'icon-variant', label: 'Variant' },
-    { name: 'icon-encyclopedia', label: 'Encyclopedia' },
-    { name: 'icon-design', label: 'Design' },
-    { name: 'icon-map', label: 'Map' },
-    { name: 'icon-diy', label: 'DIY' },
-    { name: 'icon-camera', label: 'Camera' },
-] as const satisfies ReadonlyArray<{ name: IconName; label: string }>;
+export type { IconName, IconComponent } from './src/types';
+
+/** 全部内置图标清单，供展示使用 */
+export const ICON_LIST = (Object.entries(ICONS) as Array<[IconName, IconComponent]>).map(([name]) => ({
+    name,
+    label: name.replace(/Icon$/, ''),
+})) as ReadonlyArray<{ name: IconName; label: string }>;
```

**File**: `src/components/Icon/icon.module.less` (modified, +2/-19)
```diff
@@ -1,5 +1,5 @@
-// Icon — 基于 lucide-react 的矢量图标（https://lucide.dev/icons/）
-// name / icon 模式渲染 lucide SVG 组件；src 模式渲染 backgroundImage span
+// Icon — 内置可爱图标（src/components/Icon/src 的 101 个 SVG 组件）
+// name / icon 模式渲染 SVG 组件；src 模式渲染 backgroundImage span
 
 .icon {
     display: inline-block;
@@ -27,23 +27,6 @@
     }
 }
 
-/* 具名图标的语义挂载点：默认继承 currentColor，供消费者按名定制样式 */
-.icon-left,
-.icon-right,
-.location,
-.page,
-.wifi,
-.icon-shopping,
-.icon-chat,
-.icon-variant,
-.icon-encyclopedia,
-.icon-design,
-.icon-map,
-.icon-diy,
-.icon-camera {
-    color: currentColor;
-}
-
 .iconList {
     display: grid;
     grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
```

---

### Incident Patch 13: `7c60b540` (2026-09-08)
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

### Incident Patch 14: `6ec4ea80` (2026-09-04)
**Commit Message**: Remove Phone, Wallet, InvitationCard, Time; replace remaining art with CSS

- Delete the four game-themed components (source, demos, tests, exports)
  and scrub every reference: index exports, a11y suite, demo pages/menu,
  design-system docs, skill references
- Divider line styles now draw a conic-gradient zigzag band in pure CSS;
  drop the four divider SVG assets
- Cursor pointer SVG inlined as a data URI; drop the asset file
- Rename the "IslandPhone palette" wording to island app-tile palette;
  rewire docs that cited Wallet capsules / Time digits to surviving
  equivalents (Countdown digit tiles)
- Fix stale wave-yellow Divider type references in demo and skill docs
- Repo now ships zero image files; dist/files contains fonts only

**File**: `demo/App.tsx` (modified, +2/-8)
```diff
@@ -46,7 +46,7 @@ interface MenuItem {
 //   表单      → 数据录入/校验 (Input, Switch, Select, Checkbox, Radio, Form)
 //   反馈      → 浮层/状态/异步反馈 (Notification, Modal, Drawer, Tooltip, Loading, Progress)
 //   数据展示  → 容器/列表/排版 (Card, Collapse, Tabs, Table, Typewriter)
-//   主题  → 业务复合/主题专属 (Wallet, Time, Phone, Wedding)
+//   主题  → 业务复合/主题专属 (Countdown)
 // ============================================
 const MENU_ITEMS: MenuItem[] = [
     {
@@ -113,13 +113,7 @@ const MENU_ITEMS: MenuItem[] = [
     {
         key: 'cat-animal',
         label: '── 主题 ──',
-        children: [
-            { key: 'wallet', label: 'Wallet 钱包', isNew: true },
-            { key: 'time', label: 'Time 时间' },
-            { key: 'countdown', label: 'Countdown 倒计时', isNew: true },
-            { key: 'phone', label: 'Phone 手机' },
-            { key: 'wedding-invitation', label: 'Wedding 婚礼请柬', isNew: true },
-        ],
+        children: [{ key: 'countdown', label: 'Countdown 倒计时', isNew: true }],
     },
 ];
 
```

**File**: `demo/ComponentPage.tsx` (modified, +0/-8)
```diff
@@ -1,7 +1,5 @@
 import React from 'react';
 import { Title, TitleColor, Typewriter } from '../src';
-import TimeDemo from './components/Time';
-import PhoneDemo from './components/Phone';
 import FooterDemo from './components/Footer';
 import IconDemo from './components/Icon/IconDemo';
 import TabsDemo from './components/Tabs';
@@ -13,8 +11,6 @@ import CodeBlockDemo from './components/CodeBlock';
 import LoadingDemo from './components/Loading/LoadingDemo';
 import TableDemo from './components/Table/TableDemo';
 import PaginationDemo from './components/Pagination';
-import InvitationCardDemo from './components/InvitationCard/InvitationCardDemo';
-import WalletDemo from './components/Wallet/WalletDemo';
 import DrawerDemo from './components/Drawer/DrawerDemo';
 import FormDemo from './components/Form';
 import TagDemo from './components/Tag';
@@ -56,8 +52,6 @@ const PAGES: Record<string, React.FC> = {
     card: CardDemo,
     collapse: CollapseDemo,
     cursor: CursorDemo,
-    time: TimeDemo,
-    phone: PhoneDemo,
     footer: FooterDemo,
     modal: ModalDemo,
     drawer: DrawerDemo,
@@ -76,8 +70,6 @@ const PAGES: Record<string, React.FC> = {
     loading: LoadingDemo,
     table: TableDemo,
     pagination: PaginationDemo,
-    'wedding-invitation': InvitationCardDemo,
-    wallet: WalletDemo,
     tag: TagDemo,
     notification: NotificationDemo,
     progress: ProgressDemo,
```

**File**: `demo/HomePage.tsx` (modified, +1/-3)
```diff
@@ -317,7 +317,7 @@ const features = [
     {
         icon: 'placeholder-flowers.svg',
         title: '30+ 个组件',
-        desc: 'Button / Input / Switch / Modal / Form / Table / Title / Tooltip / Typewriter / Card / Collapse / Cursor / Divider / Time / Phone / Footer / Icon / Checkbox / Select / DatePicker / TimePicker / Tabs / CodeBlock / Loading / Radio / InvitationCard / Wallet / Tag / Notification / Progress',
+        desc: 'Button / Input / Switch / Modal / Form / Table / Title / Tooltip / Typewriter / Card / Collapse / Cursor / Divider / Footer / Icon / Checkbox / Select / DatePicker / TimePicker / Tabs / CodeBlock / Loading / Radio / Tag / Notification / Progress',
     },
     {
         icon: 'placeholder-scenery.svg',
@@ -385,9 +385,7 @@ const components = [
     { key: 'divider-comp', name: 'Divider', desc: '装饰性水平分割线' },
     { key: 'icon', name: 'Icon', desc: 'SVG 图标库' },
     { key: 'footer', name: 'Footer', desc: '页脚组件' },
-    { key: 'time', name: 'Time', desc: '可爱风格时间显示' },
     { key: 'countdown', name: 'Countdown', desc: '活动与任务倒计时，支持天/时/分/秒' },
-    { key: 'phone', name: 'Phone', desc: 'Phone 模拟器' },
     { key: 'codeblock', name: 'CodeBlock', desc: '代码语法高亮组件' },
     { key: 'loading', name: 'Loading', desc: '动物主题小岛加载动画' },
     { key: 'image', name: 'Image', desc: '白色衬板图片，支持懒加载 / 点击预览' },
```

**File**: `demo/components/Divider/index.tsx` (modified, +8/-12)
```diff
@@ -6,7 +6,7 @@ const DIVIDER_API: ApiRow[] = [
     {
         prop: 'type',
         desc: '分隔线类型',
-        type: `'line-brown' | 'line-teal' | 'line-white' | 'line-yellow' | 'wave-yellow'`,
+        type: `'line-brown' | 'line-teal' | 'line-white' | 'line-yellow' | 'dashed-brown' | 'dashed-teal' | 'dashed-white' | 'dashed-yellow'`,
         defaultVal: "'line-brown'",
     },
     { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
@@ -21,20 +21,18 @@ const DIVIDER_API: ApiRow[] = [
 const DividerDemo: React.FC = () => (
     <div style={sectionStyle}>
         <div style={sectionTitleStyle}>
-            Divider <DemoTag>9 types</DemoTag>
+            Divider <DemoTag>8 types · pure CSS</DemoTag>
         </div>
-        <div style={labelStyle}>line-brown（实线棕色）</div>
+        <div style={labelStyle}>line-brown（锯齿线棕色）</div>
         <Divider type="line-brown" />
-        <div style={labelStyle}>line-teal（实线青色）</div>
+        <div style={labelStyle}>line-teal（锯齿线青色）</div>
         <Divider type="line-teal" />
-        <div style={labelStyle}>line-white（实线白色）</div>
+        <div style={labelStyle}>line-white（锯齿线白色）</div>
         <div style={{ background: '#333', padding: 10 }}>
             <Divider type="line-white" />
         </div>
-        <div style={labelStyle}>line-yellow（实线黄色）</div>
+        <div style={labelStyle}>line-yellow（锯齿线黄色）</div>
         <Divider type="line-yellow" />
-        <div style={labelStyle}>wave-yellow（波浪线黄色）</div>
-        <Divider type="wave-yellow" />
         <div style={labelStyle}>dashed-brown（虚线棕色）</div>
         <Divider type="dashed-brown" />
         <div style={labelStyle}>dashed-teal（虚线青色）</div>
@@ -52,14 +50,12 @@ import { Divider } from 'animal-island-ui';
 const App = () => {
     return (
         <div>
-            {/* 实线类型 */}
+            {/* 锯齿线（conic-gradient 绘制） */}
             <Divider type="line-brown" />
             <Divider type="line-teal" />
             <Divider type="line-white" />
             <Divider type="line-yellow" />
-            {/* 波浪线 */}
-            <Divider type="wave-yellow" />
-            {/* 虚线类型 */}
+            {/* 虚线（linear-gradient 绘制） */}
             <Divider type="dashed-brown" />
             <Divider type="dashed-teal" />
             <Divider type="dashed-white" />
```

**File**: `demo/pageInfo.ts` (modified, +0/-16)
```diff
@@ -24,14 +24,6 @@ export const PAGE_INFO: Record<string, { title: string; desc: string }> = {
         title: 'Cursor 光标',
         desc: '光标组件 — 自定义手指光标，支持自定义尺寸、点击动画',
     },
-    time: {
-        title: 'Time 时间',
-        desc: '经典 HUD 风格的时间显示组件，实时更新时间',
-    },
-    phone: {
-        title: 'Phone 手机',
-        desc: '主题手机界面，包含对话框和背包功能',
-    },
     footer: {
         title: 'Footer 底部装饰',
         desc: '页面底部装饰图片，支持树和海两种类型',
@@ -104,14 +96,6 @@ export const PAGE_INFO: Record<string, { title: string; desc: string }> = {
         title: 'Pagination 分页',
         desc: '分页组件 — 支持受控/非受控、每页条数切换、快速跳转、总条数展示，可配合 Table 使用',
     },
-    'wedding-invitation': {
-        title: 'InvitationCard 婚礼请柬',
-        desc: '动物主题婚礼请柬，叶子边角、飘散花瓣、心跳爱心、吉祥物头像，所有装饰均为内联 SVG，无需外部素材',
-    },
-    wallet: {
-        title: 'Wallet 钱包',
-        desc: '动物主题金币展示 — 奶油描边胶囊 + 上凸钱袋图标，支持千分位、自定义图标与三种尺寸',
-    },
     tag: {
         title: 'Tag 标签',
         desc: '标签组件 — 支持 solid / outlined / dashed 三种风格，16 种颜色，三种尺寸，可关闭、可点击、自定义图标',
```

**File**: `docs/design-prompts.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@ inputs are full pills, nothing has a sharp right angle. Primary buttons sit on a
 3D bottom shadow and press down like a physical game button, while secondary buttons stay
 flat with only a soft warm elevation shadow. Shapes mix geometric and organic: section
 headings are flat swallowtail ribbons with a folded-corner shadow, dialogs are clipped to
-an irregular organic blob, cards are pastel IslandPhone app tiles or polka-dot wallpaper.
+an irregular organic blob, cards are pastel island app tiles or polka-dot wallpaper.
 Type is Nunito rounded, never lighter than weight 400, chunky and friendly. Focus states
 are warm yellow, never blue. Motion is short and soft — small lifts on hover, a press-down
 on active, nothing snappy or mechanical.
@@ -51,9 +51,9 @@ Interface details:
 - Organic blob-shaped modal dialog with irregular soft SVG silhouette
 - Ribbon-banner section headings (Title component): swallowtail clip-path ends like a
   flat heraldic ribbon, with darker fold-shadow triangles tucked behind, and a slightly
-  3D-tilted front face — comes in 13 IslandPhone color schemes (green/pink/purple/blue/
+  3D-tilted front face — comes in 13 island color schemes (green/pink/purple/blue/
   yellow/orange/teal/red/brown etc.). NOT a blob, NOT a Card.
-- Pastel IslandPhone app icon color cards: pink #f8a6b2, lavender #b77dee, sky blue #889df0,
+- Pastel island app-tile color cards: pink #f8a6b2, lavender #b77dee, sky blue #889df0,
   sunshine yellow #f7cd67, coral #e59266, seafoam #82d5bb, sage green #8ac68a
 - Polka-dot pastel "wallpaper" Card variants: light tinted bg with two layered radial-gradient
   dot grids (28px and 14px) and a 1.5px solid colored border in the matching palette hue
@@ -64,7 +64,7 @@ Interface details:
 - Yellow focus highlight #ffcc00 on focused inputs (NOT blue)
 - Switch toggle with a flat circular handle (thin border, no outer shadow; the track carries an inset shadow only), track green #86d67a when ON
 - Collapse accordion with teal circle icon, leaf SVG decoration
-- Time widget showing weekday in green #6fba2c, large 48px clock digits
+- Countdown digit tiles: 900-weight tabular numerals on a cream gradient face, DD/HH/mm/ss tiles rolling odometer-style
 - Pastel parchment Table with dashed dotted row dividers and diagonal teal stripe hover
 - Soft warm Tooltip bubble with 8px diamond arrow, OR transparent island-bubble variant
 - Nature decorations: leaf SVG icons, illustrated ocean wave footer, forest tree silhouette
```

**File**: `docs/design-system/README.md` (modified, +5/-8)
```diff
@@ -6,7 +6,7 @@ This directory is the single source of truth for the animal-island-ui design lan
 
 animal-island-ui is a React + TypeScript UI component library inspired by *a cozy island-style UI*.
 
-The core of the design language: **warm earth-tone palette + large-radius pill shapes + game-button 3D depth + soft motion + geometric and organic shapes coexisting**. Geometric examples: the swallowtail clip-path of the Title ribbon, the olive-yellow capsule of Wallet. Organic example: the SVG blob of Modal.
+The core of the design language: **warm earth-tone palette + large-radius pill shapes + game-button 3D depth + soft motion + geometric and organic shapes coexisting**. Geometric examples: the swallowtail clip-path of the Title ribbon, the 12px-radius digit tiles of Countdown. Organic example: the SVG blob of Modal.
 
 - Source: `src/components/<ComponentName>/`
 - Demo site: `demo/`
@@ -15,7 +15,7 @@ The core of the design language: **warm earth-tone palette + large-radius pill s
 
 ## Full export inventory
 
-35 components plus 3 companion exports (`FormItem` / `useForm` / `ICON_LIST`), all exported from `src/index.ts`:
+32 components plus 3 companion exports (`FormItem` / `useForm` / `ICON_LIST`), all exported from `src/index.ts`:
 
 | Component      | Responsibility                                                                                                                                                                                    | Interactive | Decorative / display-only |
 | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------- |
@@ -24,7 +24,7 @@ The core of the design language: **warm earth-tone palette + large-radius pill s
 | `Switch`       | Toggle, default/small                                                                                                                                                                               | ✓           |                           |
 | `Modal`        | Dialog clipped by an SVG blob                                                                                                                                                                       | ✓           |                           |
 | `Drawer`       | Depth-of-field drawer (background sinks, scales down and dims; left/right/top/bottom)                                                                                                               | ✓           |                           |
-| `Card`         | Container, `default`/`dashed`, 13 IslandPhone solid colors + 13 `pattern` polka-dot wallpapers (CSS radial-gradient, not images)                                                                       |             | ✓                         |
+| `Card`         | Container, `default`/`dashed`, 13 island solid colors + 13 `pattern` polka-dot wallpapers (CSS radial-gradient, not images)                                                                       |             | ✓                         |
 | `Title`        | Section heading, ribbon banner (swallowtail clip-path + fold shadow + slight front-face perspective), 13 color schemes (replaces the removed `Card type="title"`)                                    |             | ✓                         |
 | `Collapse`     | Accordion (animated with CSS Grid 0fr↔1fr, no JS animation)                                                                                                                                         | ✓           |                           |
 | `Select`       | Dropdown selector (controlled)                                                                                                                                                                      | ✓           |                           |
@@ -33,9 +33,7 @@ The core of the design language: **warm earth-tone palette + large-radius pill s
 | `Checkbox`     | Checkbox group, horizontal/vertical, 3 sizes                                                                                                                                                        | ✓           |                           |
 | `Radio`        | Radio group, 3 sizes, keyboard roving tabindex                                                                                                                                                      | ✓           |                           |
 | `Tooltip`      | 12 placements, `hover`/`focus`/`click` triggers, `default`/`island` shapes                                                                                                                          | ✓           |                           |
-| `Icon`         | SVG icon set (10 icons)                                                                                                                         
```

**File**: `docs/design-system/components/decorative.md` (modified, +0/-369)
```diff
@@ -2,277 +2,6 @@
 
 Exact values for the scene-setting pieces that carry the island theme: Time, Phone, Footer and Wallet.
 
-## Time
-
-Two layouts via the `type` prop: `hud` (horizontal) and `game` (vertical, default).
-
-**hud（左右结构）:**
-
-```css
-/* container */
-display: flex; align-items: center;
-gap: 20px;
-padding: 16px 36px;
-background: linear-gradient(180deg, #fff 0%, #f8f8f0 100%);
-border: 3px solid #d4cfc3;
-border-radius: 18px;
-animation: ac-fade-up 0.5s ease-out;
-
-/* date block (separator on the right) */
-padding-right: 24px;
-border-right: 3px solid rgba(159, 146, 125, 0.35);
-
-/* weekday */
-color: #6fba2c;
-font-weight: 900; font-size: 14px;
-letter-spacing: 1.5px;
-
-/* month / day */
-color: #8b7355;
-font-weight: 800; font-size: 22px;
-
-/* time digits */
-color: #8b7355;
-font-weight: 900; font-size: 48px;
-letter-spacing: 2px;
-
-/* colon (blinking) */
-font-size: 48px; color: #8b7355;
-position: relative; top: -0.08em;
-margin: 0 1px;
-animation: blink 1s step-end infinite;
-
-@keyframes blink { 50% { opacity: 0; } }
-
-/* responsive 768px */
-padding: 12px 20px; gap: 12px;
-.acWeekday → font-size: 11px;
-.acMonthday → font-size: 16px;
-.acTime / .acColon → font-size: 32px;
-```
-
-**game（上下结构，默认）:**
-
-```css
-/* container — bare text HUD: no padding, no border, no background */
-display: flex; flex-direction: column; align-items: center;
-gap: 12px;
-animation: ac-fade-up 0.5s ease-out;
-
-/* time digits (top) */
-color: #8b7355;
-font-weight: 900; font-size: 40px;
-letter-spacing: 2px;
-
-/* colon (blinking) */
-font-size: 40px; color: #8b7355;
-position: relative; top: -0.08em;
-margin: 0 1px;
-animation: blink 1s step-end infinite;
-
-/* divider (horizontal separator) */
-width: 100%;
-height: 3px;
-background: rgba(159, 146, 125, 0.35);
-border-radius: 2px;
-
-/* date row (month/day + weekday, bottom) */
-display: flex; align-items: center;
-gap: 16px;
-margin-top: 5px;
-
-/* month / day (6月8日) */
-color: #8b7355;
-font-weight: 800; font-size: 22px;
-
-/* weekday (single Chinese char: 一 … 日) — pill badge with #fffbe7 background */
-display: inline-flex; align-items: center; justify-content: center;
-padding: 0 16px;
-height: 27px;
-border-radius: 999px;
-background: #fffbe7;
-color: #8b7355;
-font-weight: 900; font-size: 18px;
-line-height: 1;
-letter-spacing: 1px;
-
-/* responsive 768px */
-.gameTime / .gameColon → font-size: 32px;
-.gameMonthday → font-size: 14px;
-```
-
-## Phone (IslandPhone)
-
-**Shell (fixed size, not responsive):**
-
-```css
-.phone {
-    width: 527px;
-    height: 788px;
-    background: #f8f4e8; /* cream beige */
-    border-radius: 136px; /* oversized radius, close to a capsule */
-    overflow: hidden;
-}
-.homeScreen {
-    height: 100%;
-    padding-top: 40px;
-    background: #f8f4e8;
-    background-size: 100% 200%;
-    animation: grasswave 8s ease-in-out infinite;
-    display: flex;
-    flex-direction: column;
-    align-items: center;
-}
-@keyframes grasswave {
-    0%,
-    100% {
-        background-position: 0% 0%;
-    }
-    50% {
-        background-position: 0% 100%;
-    }
-}
-```
-
-**Top time bar:**
-
-```css
-.dateDisplay {
-    padding: 0 70px 31px 70px;
-    text-align: center;
-}
-.dateDisplayHeader {
-    display: flex;
-    justify-content: space-between;
-    align-items: center;
-    font-size: 32px;
-    font-weight: 800;
-    letter-spacing: 2px;
-    color: #dddbcc;
-}
-.blink {
-    font-size: 32px;
-    font-weight: 800;
-    color: #dddbcc;
-    animation: blink 1s steps(1) infinite;
-    vertical-align: text-bottom;
-}
-@keyframes blink {
-    0%,
-    50% {
-        opacity: 1;
-    }
-    51%,
-    100% {
-        opacity: 0;
-    }
-}
-.dayText {
-    font-size: 48px;
-    font-weight: 800;
-    color: #725c4e;
-    letter-spacing: 2px;
-    height: 56px;
-    margin-top: 20px;
-}
-```
-
-**3×3 app grid:**
-
-```css
-.appsGrid {
-    display: grid;
-    grid-template-columns: repeat(3, 1fr);
-    gap: 32px;
-    padding: 8px;
-    flex: 1;
-    align-content: center;
-    justify-content: center;
-}
-.appItem {
-    width: 123px;
-    height: 123px;
-    border-radius: 45px; /* rounded square */
-    position: relative;
-    display: flex;
-    justify-content: center;
-    align-items: center;
-}
-.appItem:hover .appIcon {
-    animation: iconBounce 0.3s ease-in-out forwards;
-}
-.appIcon {
-    width: 100%;
-    height: 100%;
-    background-repeat: no-repeat;
-    background-position: center;
-    background-size: 70% auto;
-}
-.appItemOffset {
-    overflow: hidden;
-}
-.appIconOffset {
-    transform: translateY(10px);
-}
-
-@keyframes iconBounce {
-    0% {
-        transform: scale(1) rotate(0deg);
-    }
-    50% {
-        transform: scale(1.2) rotate(-5deg);
-    }
-    100% {
-        transform: scale(1.1) rotate(-4deg);
-    }
-}
-```
-
-**App data structure (`src/components/Phone/Phone.tsx`):**
-
-| id       | iconName    | background | offset | hasNewMessage |
-| -------- | ----------- | ----
```

---

### Incident Patch 15: `c1dbf1b6` (2026-09-01)
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

#### Recent Merged Pull Requests:
- **PR #60** (2026-10-03): feat(badge): add Badge component (@GeoDaoyu)
- **PR #59** (2026-10-02): feat: 新增 Rate 评分组件 (@GeoDaoyu)
- **PR #53** (2026-08-26): fix: 修复倒计时归零后 setInterval 仍在运行的问题 (@resinya)
- **PR #52** (2026-08-21): feat: 新增倒计时和轮播图组件，并为 CodeBlock 添加复制功能 (@resinya)
- **PR #51** (2026-08-01): docs: 增加 animal-island-uniapp 使用案例 (@leepule)
- **PR #50** (2026-07-30): docs: add contribution leaderboard badge to README (@guokaigdg)
- **PR #48** (2026-07-28): docs: fix stale component specs surfaced by CodeRabbit review on #47 (@zthxxx)
- **PR #47** (2026-07-28): docs: restructure documentation into design-system / skill / development layers (@zthxxx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
