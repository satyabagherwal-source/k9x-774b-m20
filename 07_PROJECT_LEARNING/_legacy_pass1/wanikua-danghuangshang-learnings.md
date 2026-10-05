# Forensic Learning Record (Deep Inspection): wanikua/danghuangshang

> **Canonical Artifact**: `07_PROJECT_LEARNING/wanikua-danghuangshang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wanikua/danghuangshang](https://github.com/wanikua/danghuangshang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:18:09.751Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wanikua/danghuangshang`
- **Description**: Open-source multi-agent collaboration system inspired by Chinese governance — deploy and coordinate specialized AI agents with OpenClaw.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2701 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `extensions/novel-openviking/src/index.ts`
```
// novel-openviking 插件
// 功能完全由 skills/novel-openviking/SKILL.md 提供
// 插件安装时自动注入 skill，agent 即可感知 OpenViking 增强能力
// 无需额外注册 tool — OpenViking 自带的 viking.sh 已在 skill 中说明用法

export default function register(_api: any) {
  // skill 由 openclaw.plugin.json 的 "skills" 字段声明，自动加载
  // 此入口文件仅作为插件系统的必要 entry point
}

```

### Core Architecture Module: `gui/eslint.config.js`
```
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

```

### Core Architecture Module: `gui/server/index.js`
```
import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync, existsSync, statSync, createReadStream, openSync, readSync, closeSync, realpathSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';
import os from 'os';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { WebSocketServer } from 'ws';
import { exec as _exec, execFile as _execFile } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(_exec);
const execFileAsync = promisify(_execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI 命令
let CLI_CMD = 'openclaw';
try {
  await execAsync('which openclaw', { encoding: 'utf-8', timeout: 3000 });
  CLI_CMD = 'openclaw';
} catch {
  try {
    await execAsync('which clawdbot', { encoding: 'utf-8', timeout: 3000 });
    CLI_CMD = 'clawdbot';
  } catch { CLI_CMD = 'openclaw'; }
}

const app = express();
const PORT = process.env.BOLUO_GUI_PORT || 18795;

// SEC-03: 不再使用硬编码默认 Token
import crypto from 'crypto';
let AUTH_TOKEN = process.env.BOLUO_AUTH_TOKEN;
if (!AUTH_TOKEN || AUTH_TOKEN === 'changeme') {
  AUTH_TOKEN = crypto.randomBytes(16).toString('hex');
  console.warn('');
  console.warn('╔══════════════════════════════════════════════════════════════╗');
  console.warn('║  ⚠️  安全警告: BOLUO_AUTH_TOKEN 未设置或使用了默认值!       ║');
  console.warn('║  已自动生成随机 Token（仅本次运行有效）                     ║');
  console.warn('║  请设置环境变量: export BOLUO_AUTH_TOKEN=$(openssl rand -hex 16) ║');
  console.warn('╚══════════════════════════════════════════════════════════════╝');
  console.warn(`  本次 Token: ${AUTH_TOKEN}`);
  console.warn('');
}

const AGENT_DEPT_MAP = {
  'silijian': '司礼监', 'gongbu': '工部', 'hubu': '户部',
  'libu': '礼部', 'libu2': '吏部',
  'xingbu': '刑部', 'bingbu': '兵部',
  'neige': '内阁', 'duchayuan': '都察院', 'neiwufu': '内务府',
  'hanlinyuan': '翰林院',
  'hanlin_zhang': '翰林院·掌院学士',
  'hanlin_xiuzhuan': '翰林院·修撰',
  'hanlin_bianxiu': '翰林院·编修',
  'hanlin_jiantao': '翰林院·检讨',
  'hanlin_shujishi': '翰林院·庶吉士',
  'taiyiyuan': '太医院', 'guozijian': '国子监',
  'yushanfang': '御膳房'
};

// GUI botId → openclaw agent id 映射（迁移后 silijian 就是实际 agent id）
const BOT_TO_AGENT = {};
function resolveAgentId(botId) {
  return BOT_TO_AGENT[botId] || botId;
}

const HOME = process.env.HOME || '/home/ubuntu';
// OpenClaw 配置目录
const OPENCLAW_DIR = join(HOME, '.openclaw');

// Resolve symlinks so path checks work when ~/.openclaw -> ~/.clawdbot
const STATE_DIR = (() => { try { return realpathSync(OPENCLAW_DIR); } catch { return OPENCLAW_DIR; } })();
const AGENTS_DIR = join(STATE_DIR, 'agents');

// SEC: 验证 session 文件路径在合法目录内
function isValidSessionPath(filePath) {
  if (!filePath) return false;
  try { filePath = realpathSync(filePath); } catch { /* file may not exist yet */ }
  const resolved = resolve(filePath);
  return resolved.startsWith(AGENTS_DIR) || resolved.startsWith(STATE_DIR);
}
const CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function getOpenclawConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) { }
  return null;
}

// SEC-15: 验证 agentId 防止路径遍历
function sanitizeAgentId(id) {
  if (!id || typeof id !== 'string') return null;
  if (/[\/\\.\s]/.test(id) || id.includes('..')) return null;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

function getAgentSessionData(agentId) {
  const sessionsPath = join(AGENTS_DIR, agentId, 'sessions', 'sessions.json');
  if (!existsSync(sessionsPath)) return { sessions: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, model: '' };

  try {
    const data = JSON.parse(readFileSync(sessionsPath, 'utf-8'));
    const entries = Object.values(data);
    let inputTokens = 0, outputTokens = 0, totalTokens = 0;
    let model = '';

    for (const sess of entries) {
      inputTokens += sess.inputTokens || 0;
      outputTokens += sess.outputTokens || 0;
      totalTokens += sess.totalTokens || 0;
      if (sess.model && !model) model = sess.model;
    }

    return { sessions: entries.length, inputTokens, outputTokens, totalTokens, model };
  } catch (e) {
    return { sessions: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, model: '' };
  }
}

function getRecentLogs(limit = 100) {
  const logs = [];
  if (!existsSync(AGENTS_DIR)) return logs;

  try {
    const agentDirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentId of agentDirs) {
      const sessDir = join(AGENTS_DIR, agentId, 'sessions');
      if (!existsSync(sessDir)) continue;

      const jsonlFiles = readdirSync(sessDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: statSync(join(sessDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 1);

      for (const file of jsonlFiles) {
        try {
          // [M-17] 只读文件尾部避免大文件 OOM
          const filePath = join(sessDir, file.name);
          const fSize = statSync(filePath).size;
          let content;
          if (fSize > 5 * 1024 * 1024) { // >5MB: 只读尾部 64KB
            const TAIL = 65536;
            const fd = openSync(filePath, 'r');
            const buf = Buffer.alloc(TAIL);
            try { readSync(fd, buf, 0, TAIL, fSize - TAIL); } finally { closeSync(fd); }
            const raw = buf.toString('utf-8');
            content = raw.substring(raw.indexOf('\n') + 1);
          } else {
            content = readFileSync(filePath, 'utf-8');
          }
          const lines = content.split('\n').filter(l => l.trim()).slice(-5);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              // Support both flat format (role/content) and nested format (message.role/message.content)
              const role = entry.message?.role || entry.role;
              const msgContent = entry.message?.content || entry.content;
              if (role === 'assistant' && msgContent) {
                const text = typeof msgContent === 'string'
                  ? msgContent.substring(0, 200)
                  : JSON.stringify(msgContent).substring(0, 200);
                logs.push({
                  timestamp: new Date(file.mtime).toISOString(),
                  level: 'info',
                  message: text,
                  source: AGENT_DEPT_MAP[agentId] || agentId
                });
              }
            } catch (e) { }
          }
        } catch (e) { }
      }
    }
  } catch (e) { }

  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

// Detect which platforms an agent is bound to, from session keys
function detectAgentPlatforms(agentId) {
  const sessionsPath = join(AGENTS_DIR, agentId, 'sessions', 'sessions.json');
  const platformSet = new Set();

  if (existsSync(sessionsPath)) {
    try {
      const data = JSON.parse(readFileSync(sessionsPath, 'utf-8'));
      for (const sessionKey of Object.keys(data)) {
        // Session key format: "discord:channel:xxx", "feishu:xxx", "telegram:xxx", "cron:xxx", etc.
        const parts = sessionKey.split(':');
        const plat = parts[0]?.toLowerCase();
        if (
```

### Core Architecture Module: `gui/src/App.tsx`
```
import { useState, lazy, Suspense } from "react"
import type { TabName } from "./types"
import { useStatus } from "./hooks/useStatus"
import { useTheme } from "./theme"
import { PineappleLogo } from "./components/Logo"
import Login from "./pages/Login"

// 品牌名 — 修改此处即可全局替换
const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || '菠萝王朝'
const BRAND_SUBTITLE = import.meta.env.VITE_BRAND_SUBTITLE || 'Pineapple Dynasty'

// Lazy-loaded pages (code-splitting — reduces initial bundle, especially recharts-heavy pages)
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Departments = lazy(() => import("./pages/Departments"))
const TokenStats = lazy(() => import("./pages/TokenStats"))
const MessageLogs = lazy(() => import("./pages/MessageLogs"))
const SystemHealth = lazy(() => import("./pages/SystemHealth"))
const Sessions = lazy(() => import("./pages/Sessions"))
const Settings = lazy(() => import("./pages/Settings"))
const Court = lazy(() => import("./pages/Court"))
const Channels = lazy(() => import("./pages/Channels"))
const MemorialHall = lazy(() => import("./pages/MemorialHall"))
const Nodes = lazy(() => import("./pages/Nodes"))
const NotionBoard = lazy(() => import("./pages/NotionBoard"))
const Search = lazy(() => import("./pages/Search"))
const CronJobs = lazy(() => import("./pages/CronJobs"))
const Skills = lazy(() => import("./pages/Skills"))

const tabs: { key: TabName; label: string; icon: string }[] = [
  { key: "dashboard", label: "总览", icon: "📊" },
  { key: "court", label: "朝堂", icon: "🏯" },
  { key: "departments", label: "部门", icon: "🏛️" },
  { key: "tokens", label: "Token统计", icon: "🔥" },
  { key: "sessions", label: "会话", icon: "💬" },
  { key: "channels", label: "频道", icon: "📡" },
  { key: "nodes", label: "节点", icon: "🖥️" },
  { key: "notion", label: "奏章板", icon: "📜" },
  { key: "memorial", label: "奏报厅", icon: "🏮" },
  { key: "logs", label: "日志", icon: "📋" },
  { key: "search", label: "搜索", icon: "🔍" },
  { key: "cron", label: "定时", icon: "⏰" },
  { key: "skills", label: "技能", icon: "🧩" },
  { key: "system", label: "系统", icon: "⚙️" },
  { key: "settings", label: "设置", icon: "🔧" },
]

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('boluo_auth_token')
  })
  const [activeTab, setActiveTab] = useState<TabName>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<string | undefined>(undefined)
  const { theme, toggle: toggleTheme } = useTheme()
  const { data, loading, error, lastUpdated, refresh } = useStatus()

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  const renderPage = () => {
    if (loading && !data) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-[#d4a574] text-lg animate-pulse">加载中...</div>
        </div>
      )
    }
    if (error && !data) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-[#ef4444] text-lg mb-2">连接失败</div>
            <div className="text-[#a3a3a3] text-sm mb-4">{error}</div>
            <div className="flex gap-3 justify-center">
              <button onClick={refresh} className="px-4 py-2 bg-[#1a1a2e] text-[#d4a574] border border-[#d4a574] hover:bg-[#16213e] cursor-pointer">
                重试
              </button>
              <button onClick={() => { localStorage.removeItem('boluo_auth_token'); setIsLoggedIn(false) }} className="px-4 py-2 bg-[#1a1a2e] text-[#a3a3a3] border border-[#a3a3a3]/30 hover:bg-[#16213e] cursor-pointer">
                重新登录
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (!data) return null
    switch (activeTab) {
      case "dashboard": return <Dashboard data={data} onNavigate={(tab, filter) => {
        if (tab === 'sessions' && filter) {
          setSessionFilter(filter)
        }
        setActiveTab(tab as TabName)
      }} />
      case "court": return <Court />
      case "departments": return <Departments data={data} />
      case "tokens": return <TokenStats data={data} />
      case "sessions": return <Sessions initialFilter={sessionFilter} />
      case "channels": return <Channels />
      case "nodes": return <Nodes />
      case "notion": return <NotionBoard />
      case "memorial": return <MemorialHall />
      case "logs": return <MessageLogs data={data} />
      case "search": return <Search />
      case "cron": return <CronJobs />
      case "skills": return <Skills />
      case "system": return <SystemHealth data={data} />
      case "settings": return <Settings />
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-accent)' }}>
        
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-accent)' }}>
          <div className="flex items-center gap-2.5">
            <PineappleLogo size={32} />
            <div>
              <div className="text-base font-bold text-accent-gradient tracking-wide">{BRAND_NAME}</div>
              <div className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>
                {data?.uptime ? `运行 ${data.uptime}` : BRAND_SUBTITLE}
              </div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setSessionFilter(undefined); setActiveTab(tab.key); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'nav-active'
                  : ''
              }`}
              style={{
                borderLeft: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                backgroundColor: activeTab === tab.key ? 'var(--accent-glow)' : undefined,
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-glow)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = ''
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-accent)' }}>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="flex-1 py-2 text-xs rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-accent)' }} title="刷新">↻ 刷新</button>
            <button onClick={toggleTheme} className="flex-1 py-2 text-xs rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-accent)' }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        
```

### Core Architecture Module: `gui/src/components/Logo.tsx`
```
/**
 * 🍍 菠萝王朝 Brand Logo
 * Imperial pineapple with crown — SVG component
 */
export function PineappleLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Crown */}
      <g>
        <path
          d="M22 18L25 8L32 14L39 8L42 18"
          stroke="url(#crown-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Crown jewels */}
        <circle cx="25" cy="10" r="1.5" fill="#d4a574" />
        <circle cx="32" cy="13" r="1.5" fill="#e5c9a8" />
        <circle cx="39" cy="10" r="1.5" fill="#d4a574" />
      </g>

      {/* Pineapple body */}
      <ellipse
        cx="32"
        cy="38"
        rx="14"
        ry="18"
        fill="url(#body-gradient)"
        stroke="url(#body-stroke)"
        strokeWidth="1.5"
      />

      {/* Cross-hatch pattern on pineapple */}
      <g opacity="0.3" stroke="#0d0d1a" strokeWidth="0.8">
        {/* Diagonal lines */}
        <line x1="22" y1="30" x2="42" y2="46" />
        <line x1="22" y1="36" x2="38" y2="52" />
        <line x1="26" y1="24" x2="42" y2="40" />
        <line x1="42" y1="30" x2="22" y2="46" />
        <line x1="42" y1="36" x2="26" y2="52" />
        <line x1="38" y1="24" x2="22" y2="40" />
      </g>

      {/* Leaves */}
      <g>
        <path d="M32 20C28 12 24 16 26 20" fill="#4a7c59" stroke="#3d6b4a" strokeWidth="0.5" />
        <path d="M32 20C36 12 40 16 38 20" fill="#4a7c59" stroke="#3d6b4a" strokeWidth="0.5" />
        <path d="M32 20C30 10 26 12 28 18" fill="#5a8c69" stroke="#4a7c59" strokeWidth="0.5" />
        <path d="M32 20C34 10 38 12 36 18" fill="#5a8c69" stroke="#4a7c59" strokeWidth="0.5" />
        <path d="M32 20C32 9 30 11 31 18" fill="#6a9c79" stroke="#5a8c69" strokeWidth="0.5" />
      </g>

      {/* Gradients */}
      <defs>
        <linearGradient id="crown-gradient" x1="22" y1="8" x2="42" y2="18">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="100%" stopColor="#e5c9a8" />
        </linearGradient>
        <linearGradient id="body-gradient" x1="18" y1="20" x2="46" y2="56">
          <stop offset="0%" stopColor="#e5c9a8" />
          <stop offset="50%" stopColor="#d4a574" />
          <stop offset="100%" stopColor="#c49464" />
        </linearGradient>
        <linearGradient id="body-stroke" x1="18" y1="20" x2="46" y2="56">
          <stop offset="0%" stopColor="#c49464" />
          <stop offset="100%" stopColor="#b4844f" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function LogoFull({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PineappleLogo size={36} />
      <div>
        <div className="text-lg font-bold text-accent-gradient tracking-wide">{import.meta.env.VITE_BRAND_NAME || 'AI 朝廷'}</div>
        <div className="text-[10px] text-[var(--text-tertiary)] tracking-widest uppercase">Pineapple Dynasty</div>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `gui/src/hooks/useStatus.ts`
```
import { useState, useEffect, useCallback, useRef } from "react"
import type { SystemStatus } from "../types"
import { getAuthToken } from "../utils/auth"

const DEFAULT_REFRESH_INTERVAL = 30000

function getRefreshInterval(): number {
  try {
    const raw = localStorage.getItem('boluo_settings')
    if (raw) {
      const settings = JSON.parse(raw)
      if (typeof settings.refreshInterval === 'number' && settings.refreshInterval >= 5000) {
        return settings.refreshInterval
      }
    }
  } catch {}
  return DEFAULT_REFRESH_INTERVAL
}

export function useStatus() {
  const [data, setData] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // [L-09] AbortController 防止组件卸载后更新状态
  const abortRef = useRef<AbortController | null>(null)

  const fetchStatus = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch("/api/status", {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        signal: controller.signal
      })
      if (res.status === 401) {
        // Only clear+reload if we had a token (prevents infinite loop)
        if (getAuthToken()) {
          localStorage.removeItem('boluo_auth_token')
          window.location.reload()
        }
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      if (!controller.signal.aborted) {
        setData(json)
        setError(null)
        setLastUpdated(new Date())
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Re-read interval from settings on each cycle so changes take effect without reload
    let timerId: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      timerId = setTimeout(() => {
        fetchStatus()
        scheduleNext()
      }, getRefreshInterval())
    }
    scheduleNext()
    return () => {
      clearTimeout(timerId)
      abortRef.current?.abort()
    }
  }, [fetchStatus])

  return { data, loading, error, lastUpdated, refresh: fetchStatus }
}

```

### Core Architecture Module: `gui/src/main.tsx`
```
import { StrictMode, Component } from "react"
import type { ReactNode, ErrorInfo } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

// Error boundary to prevent black screen on React crash
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AI朝廷] React crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d0d1a', color: '#e5e5e5', fontFamily: 'system-ui', padding: '20px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍍</div>
            <h1 style={{ color: '#d4a574', fontSize: '20px', marginBottom: '8px' }}>AI 朝廷 · 系统异常</h1>
            <p style={{ color: '#a3a3a3', fontSize: '14px', marginBottom: '16px' }}>
              页面渲染出错，请刷新重试
            </p>
            <pre style={{
              background: '#1a1a2e', padding: '12px', borderRadius: '8px', fontSize: '11px',
              color: '#ef4444', textAlign: 'left', overflow: 'auto', maxHeight: '200px',
              border: '1px solid rgba(212,165,116,0.2)',
            }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              style={{
                marginTop: '16px', padding: '10px 24px', background: '#d4a574', color: '#0d0d1a',
                border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

```

### Core Architecture Module: `gui/src/pages/Channels.tsx`
```
import { useState, useEffect } from "react"
import { useTheme } from "../theme"
import { getAuthToken } from "../utils/auth"

interface Platform {
  name: string; status: 'connected' | 'disconnected'; channels: number; accounts?: number
}

interface BotChannel {
  id: string; name: string; displayName: string; status: string
  sessions: number; model: string; channel: string; platforms: string[]
}


const PLATFORM_ICONS: Record<string, string> = {
  discord: '💬',
  telegram: '✈️',
  signal: '🔒',
  whatsapp: '📱',
  slack: '💼',
  feishu: '🐦',
  lark: '🐦',
}

function platformDisplayName(key: string): string {
  const map: Record<string, string> = {
    discord: 'Discord',
    telegram: 'Telegram',
    signal: 'Signal',
    whatsapp: 'WhatsApp',
    slack: 'Slack',
    feishu: '飞书',
    lark: '飞书',
  }
  return map[key?.toLowerCase()] || key || 'Unknown'
}

function platformIcon(name: string): string {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(PLATFORM_ICONS)) {
    if (key.includes(k) || platformDisplayName(k).toLowerCase() === key) return v
  }
  return '🌐'
}

export default function Channels() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [botChannels, setBotChannels] = useState<BotChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const { theme } = useTheme()
  const bg = theme === 'light' ? 'bg-white border border-gray-200' : 'bg-[#1a1a2e]'
  const sub = theme === 'light' ? 'text-gray-500' : 'text-[#a3a3a3]'

  const fetchData = async () => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` }
      const [platformsRes, statusRes] = await Promise.all([
        fetch('/api/platforms', { headers }),
        fetch('/api/status', { headers })
      ])
      
      const platformsData = await platformsRes.json()
      if (platformsData.platforms) setPlatforms(platformsData.platforms)

      const statusData = await statusRes.json()
      const bots = statusData.botAccounts || []
      setBotChannels(bots.map((b: { name: string; displayName: string; status: string; sessions: number; model: string; platform?: string; platforms?: string[] }) => ({
        id: b.name,
        name: b.name,
        displayName: b.displayName || b.name,
        status: b.status,
        sessions: b.sessions || 0,
        model: b.model || '',
        channel: b.platform || 'discord',
        platforms: (b.platforms || [b.platform || 'discord']).map((p: string) => platformDisplayName(p)),
      })))
    } catch { }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filteredChannels = selectedPlatform === 'all'
    ? botChannels
    : botChannels.filter(c => c.channel === selectedPlatform)

  const onlineCount = botChannels.filter(c => c.status === 'online').length

  if (loading) return <div className={`${sub} p-4 animate-pulse`}>加载中...</div>

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-medium ${theme === 'light' ? 'text-gray-800' : 'text-[#d4a574]'}`}>
          📡 频道管理
        </h2>
        <button onClick={fetchData}
          className="px-3 py-1.5 text-xs border border-[#d4a574] text-[#d4a574] hover:bg-[#d4a574]/10 rounded cursor-pointer">
          🔄 刷新
        </button>
      </div>

      {/* 平台概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {platforms.map(p => (
          <div key={p.name} className={`${bg} rounded-lg p-3 sm:p-4 border-l-2 ${
            p.status === 'connected' ? 'border-l-green-500' : 'border-l-gray-500'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{platformIcon(p.name)} {p.name}</span>
              <span className={`w-2 h-2 rounded-full ${p.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div className={`text-xs ${sub}`}>
              {p.accounts || 0} 账号 · {p.channels} 频道
            </div>
          </div>
        ))}
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${bg} rounded-lg p-3 text-center`}>
          <div className={`text-[10px] uppercase ${sub}`}>总频道</div>
          <div className="font-mono text-xl text-[#d4a574]">{botChannels.length}</div>
        </div>
        <div className={`${bg} rounded-lg p-3 text-center`}>
          <div className={`text-[10px] uppercase ${sub}`}>在线</div>
          <div className="font-mono text-xl text-green-400">{onlineCount}</div>
        </div>
        <div className={`${bg} rounded-lg p-3 text-center`}>
          <div className={`text-[10px] uppercase ${sub}`}>平台</div>
          <div className="font-mono text-xl text-[#d4a574]">{platforms.filter(p => p.status === 'connected').length}</div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {['all', ...platforms.map(p => p.name)].map(p => (
          <button key={p} onClick={() => setSelectedPlatform(p)}
            className={`px-3 py-1 text-xs rounded border cursor-pointer transition-all ${
              selectedPlatform === p
                ? 'bg-[#d4a574]/20 text-[#d4a574] border-[#d4a574]'
                : `border-[#d4a574]/20 ${sub} hover:border-[#d4a574]/50`
            }`}>
            {p === 'all' ? '🌐 全部' : `${platformIcon(p)} ${p}`}
          </button>
        ))}
      </div>

      {/* 频道列表 */}
      <div className={`${bg} rounded-lg overflow-hidden`}>
        <div className={`grid grid-cols-5 text-xs p-3 border-b ${
          theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#16213e] border-[#d4a574]/20'
        }`}>
          <div>部门名称</div><div>平台</div><div>状态</div><div>会话数</div><div>模型</div>
        </div>
        {filteredChannels.map(ch => (
          <div key={ch.id} className={`grid grid-cols-5 text-xs sm:text-sm p-3 border-b items-center ${
            theme === 'light' ? 'border-gray-100 hover:bg-gray-50' : 'border-[#d4a574]/10 hover:bg-[#16213e]'
          }`}>
            <div className="font-medium text-[#d4a574]">{ch.displayName}</div>
            <div className={sub}>{platformIcon(ch.channel)} {ch.channel}</div>
            <div>
              <span className={`px-2 py-0.5 text-xs rounded ${
                ch.status === 'online' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
              }`}>
                {ch.status === 'online' ? '在线' : '离线'}
              </span>
            </div>
            <div className="font-mono text-[#d4a574]">{ch.sessions}</div>
            <div className={`text-[10px] sm:text-xs truncate ${sub}`}>{ch.model?.replace(/^[^/]+\//, '')}</div>
          </div>
        ))}
        {filteredChannels.length === 0 && (
          <div className={`text-center py-8 ${sub} text-sm`}>暂无频道数据</div>
        )}
      </div>
    </div>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #149** (2026-07-22): **P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric**
  *Symptoms*: # P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric  落实迭代路线图的 P0 两项（详见调研结论：`civagent-iteration-directions.md` §2.2 / §5.1）。  ## 改动  ### 1. 事件流 OTel 风格信封（schema v2）  每个事件在保留 legacy 字段（`matchId/seq/ts/type`）的基础上，纯增量追加：  - `event_id`（UUID）、`schema_version="2.0"`、`trace_id`（=matchId） - `span_id` / `parent_span_id`：`match_start` 为根 span，其余事件默认挂根，可显式覆盖 - `actor`（judge / skill-learner / system / regime）、`kind`（`tool_call|judge_score|skill_commit|...`）、`payload_hash`（sha256[:16]） - `model` / `model_version` / `prompt_hash` / `tokens` / `cost` 可选透传  同步更新 `schemas/match-event.schema.json`（新字段全部 optional，向后兼容）与前端类型。  ### 2. 裁判双向盲评 + 锚定 rubric  - **顺序交换双评**：每场对决跑两遍，第二遍交换呈现顺序（A/B→B/A），分数跨 pass 取均值；`CIVAGENT_JUDGE_SWAP=0` 可关闭 - **锚定 rubric**：沿用现有三维（legality/feasibility/resilience），改为四点量表 + 每维 4 级锚点，要求结构化 JSON 输出；解析失败回退原 markdown 解析（向后兼容） - **审计**：每个 pass 发一条 `judge_score` 事件，带 `provider/model`、`prompt_hash`、`swapped`、`order`、`parent_span_id` - manifest `judge` 段新增 `swap/passes/rubric/events`；`## Verdict` 段保留（前端依赖） - judge_chain 回退（codex → opencode-reviewer → cn-glm）与 `judge.mjs` 零改动  ## 测试  - 基线 79 pass → **94 pass / 0 fail**（新增 15 例：信封断言、swap 顺序与聚合、审计事件、失败路径、集成契约扩展） - `npm run lint:syntax` 通过  ## 待决策（不阻塞合并，可后续跟进）  1. `schema_version` 取值：`"2.0"` vs 三段式 `"2.0.0"` 2. 分数归一：rubric 1-4 量表归一到 /10 上报（dims 保留原始值）；如需直接暴露 1-4 原始分需同步改前端 3. rubric 锚点英文措辞建议过一遍（`JUDGE_RUBRIC_PROMPT`） 4. 锦标赛级审计事件写在 `matches/<tournamentId>/events.jsonl`，可能被前端 HistoryExplorer 当作对局列出（带 `tournament:true` 标记可过滤） 5. 目前裁判仍可见政体名（仅隐 backend）；如需连政
  **Post-Mortem & Fix Analysis**:
  > 误开：本 PR 应开在 fork（LeoLin990405/civagent）自身，非上游。已关闭，抱歉打扰。
  > 您好，邮件已收到，谢谢！

- **Issue #145** (2026-05-22): **feat: 适配 OpenClaw v2026.5.20 + Node.js 22.19 门槛**
  *Symptoms*: ## Summary  把项目从 OpenClaw v2026.5.7 适配到最新 v2026.5.20。无破坏性变更,现有 `openclaw.json` 无需改动。  - **Node.js 最低 22.16 → 22.19**(对齐上游 v2026.5.19 强制要求) - **文档版本占位符**统一刷到 2026.5.20 - **新增升级章节**汇总 v2026.5.8 ~ v2026.5.20 的所有新增可选字段和 Docker 构建参数改名  ## 变更明细  | 文件 | 改动 | |------|------| | `install.ps1` | 版本探测加入 minor 校验;Windows 安装器 v22.14.0 → v22.19.0 | | `install-mac.sh` | Node 检测函数化(`node_meets_floor`),需 >= 22.19 | | `doctor.sh` | `[1/9]` Node 检查接受 22.19+ | | `package.json` | `engines.node` >=22.16.0 → >=22.19.0;version 3.6.0 → 3.7.1 | | `EXTERNAL_HERMES.md` / `hermes.example.yaml` / `CONTRIBUTING.md` | 版本占位符同步 | | `CHANGELOG.md` | 新增 v3.7.1 entry | | `docs/openclaw-upgrade-guide.md` | 末尾新增"升级到 2026.5.20"章节,列出新增可选字段(`agents.list[].experimental.localModelLean`、`voice.realtime.bootstrapContextFiles`、`models.providers.<id>.timeoutSeconds`、`security.audit.suppressions`、Discord `agentComponents.ttlMs`、`tools.alsoAllow` 等)和 `OPENCLAW_DOCKER_APT_PACKAGES` → `OPENCLAW_IMAGE_APT_PACKAGES` 改名 |  ## Test plan  - [x] `bash -n install-mac.sh` / `bash -n doctor.sh` 语法通过 - [x] `package.json` / `openclaw.example.json` JSON 解析有效 - [x] `npm test` — 19/19 jest 用例通过 - [x] Node 版本检测逻辑 smoke test:`v22.19.0` pass、`v22.18.0` warn、`v22.20.5` pass、`v23.x` pass、`v20.x` warn、`none` fail - [ ] (手测) Windows 上执行 `install.ps1`,看是否能从 v22.x → v22.19.x - [ ] (手测) macOS 上 Node 22.16 跑 `install-mac.sh`,确认触发升级路径  https://claude.ai/code/session_01L2AJsVj62yfchX76wbnLrV  --- _Generated by [Claude Code](https://claude.ai/code/session

- **Issue #143** (2026-05-10): **chore: 修 ShellCheck 旧 warning + 补全 16 个 Hermes personality**
  *Symptoms*: ## Summary  - **ShellCheck 收尾**:把 main 分支上 pre-existing 的 ShellCheck warning 全部清掉(`scripts/health-check.sh`、`scripts/install-common.sh`、`entrypoint.sh`)。本地 `shellcheck -S warning --format=gcc` 三文件零 warning。 - **Hermes personalities 全员到齐**:补全 16 个,总计 19 个角色,覆盖 OpenClaw `agents.list[]` 全集。  ## ShellCheck 修复  | 文件 | 规则 | 修复方式 | |---|---|---| | `scripts/health-check.sh` | SC2034 `ALERT_THRESHOLD_COST_DAILY` | 加 `# shellcheck disable=SC2034`(配置常量保留) | | `scripts/health-check.sh` | SC2206 `missing+=($cmd)` | quote: `missing+=("$cmd")` | | `scripts/health-check.sh` | SC2155 ×7 处 | `local foo=$(cmd)` → `local foo; foo=$(cmd)` | | `scripts/install-common.sh` | SC2034 颜色常量 BLUE/BOLD/... | 6 处颜色常量逐行 `# shellcheck disable=SC2034` | | `entrypoint.sh` | SC2034 `GATEWAY_PID` | 加 disable + 注释(`exec node` 后变量自然失效) |  ## Hermes Personalities 补全  | 分组 | 文件 | |---|---| | 六部 | bingbu / hubu / libu / gongbu / libu2 / xingbu | | 翰林院 5 子 | hanlin_zhang / xiuzhuan / bianxiu / jiantao / shujishi | | 侍奉 5 角色 | qijuzhu / guozijian / taiyiyuan / neiwufu / yushanfang |  内容直接从 `openclaw.example.json` 的 `agents.list[i].identity.theme` 抽取,frontmatter `name` / `display_name` 对齐 OpenClaw 字段。  ## 文档同步  - `configs/hermes/personalities/README.md` 改为「全部 19 角色已交付」(分组列表) - `install-hermes.sh` 完成提示从「14 角色 + claw migrate」改为「全部 19 角色已就绪」  ## Test plan  - [x] `bash -n` 三文件全通过 - [x] `shellcheck -S warning --format=gcc` 三文件零 warning - [x] 19 个 personality .md 都含正确 YAML frontmatter - [ ] `gh run watch` 验证 CI lint-and-valid

- **Issue #142** (2026-05-10): **feat: 适配 OpenClaw v2026.5.7 + 新增 Hermes Agent 并行 runtime**
  *Symptoms*: ## Summary  - **OpenClaw v2026.5.7 适配**:补齐 Discord `applicationId` 字段(67 处遗漏跨 4 个 JSON),新版 slash 命令注册必需 - **Hermes Agent 并行 runtime**:与 OpenClaw 平行,同一套 14 Agent 朝廷设定可二选一或并存 - 14 角色完整迁移可用 `hermes claw migrate` 自动化  ## OpenClaw 侧改动  | 文件 | 变更 | |---|---| | `openclaw.example.json` | + 15 处 Discord applicationId | | `configs/feishu/openclaw.json` | + 19 处 | | `configs/ming-neige/openclaw.json` | + 19 处 | | `configs/tang-sansheng/openclaw.json` | + 15 处(唐朝制 zhongshusheng/menxiasheng/...) | | `scripts/install-lite.sh` | Discord 流程新增 Application ID 输入 + sed 替换 |  ## Hermes 侧新增  | 文件 | 用途 | |---|---| | `hermes.example.yaml` | 配置模板,对齐 v0.13.0 | | `EXTERNAL_HERMES.md` | 安装/token/personality 映射/故障排除 | | `install-hermes.sh` | 一键安装(平行于 install-lite.sh) | | `docker-compose.hermes.yml` | 容器编排,与 OpenClaw compose 互不冲突 | | `configs/hermes/env.example` | 多 provider 环境变量模板 | | `configs/hermes/personalities/{silijian,neige,duchayuan}.md` | 3 个核心角色 | | `configs/hermes/personalities/README.md` | 14 角色完整生成脚本 |  ## 文档同步  - `README.md` 快速开始新增「方式四:用 Hermes Agent runtime」 - `PROJECTS.md` 相关仓库表新增 Hermes Agent - `package.json` keywords += hermes-agent / nous-research - `CHANGELOG.md` 新增 v3.7.0 (2026-05-10) 条目  ## Rebase 解冲突说明  本分支基于 origin/main rebase,以下两个文件冲突已按对应方向解决: - `install-lite.sh` — 接受 origin/main 的 wrapper 版本,实际逻辑改动改 apply 到 `scripts/install-lite.sh`(架构对齐 a6f4423) - `configs/tang-sansheng/openclaw.json` — 接受 origin/main 的唐朝制版本(35e5834),applicationId 重新对应 zhongshusheng/menxiasheng/shangshusheng/yu

- **Issue #137** (2026-05-04): **fix: 安装脚本支持复用已有 OpenClaw 模型配置**
  *Symptoms*: ## Summary - 安装脚本步骤 2.5 改为智能检测：扫描已有 OpenClaw 配置中真实 `baseUrl` 的 provider，提示用户复用并跳过手动输入 - 检测条件兼容 `apiKey` / `authHeader` / 纯环境变量等多种 OpenClaw 认证方式（不再只认 `apiKey` 字段） - 提取 `scripts/install-common.sh` 共享 `configure_llm` / `detect_config_path` / `inject_llm_config` / `check_jq` / `check_openclaw` - 移动 `install-lite.sh` → `scripts/install-lite.sh`，重构为使用共享函数，移除 Python JSON 操作改用 jq - 根目录 `install-lite.sh` 保留为向后兼容 wrapper - `full-install.sh` 本地运行时通过 `git rev-parse` 检测本地仓库，避免不必要的克隆；验证步骤、清理提示逻辑同步适配  ## Test plan - [ ] 本地 `bash scripts/full-install.sh`：已有 OpenClaw 配置时步骤 2.5 提示复用，选 Y 跳过手动输入，步骤 6 验证通过 - [ ] 本地运行不触发克隆，不提示删除临时目录 - [ ] `bash <(curl ...full-install.sh)` 远程运行时正常克隆，结束时提示清理临时目录 - [ ] `bash scripts/install-lite.sh` 复用检测同样生效 - [ ] 根目录 `bash install-lite.sh` 通过 wrapper 正常工作  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #135** (2026-04-12): **fix: 唐三省制配置使用正确的唐朝官制**
  *Symptoms*: ## Summary `tang-sansheng` 配置中错误使用了明朝官制（司礼监、内阁、都察院），现替换为正确的唐朝三省六部制：  | 旧 (明制) | 新 (唐制) | 职能 | |-----------|-----------|------| | 司礼监 (silijian) | **中书省** (zhongshusheng) | 决策起草 | | 内阁 (neige) | **门下省** (menxiasheng) | 审核封驳 | | — | **尚书省** (shangshusheng) | 执行派发（新增） | | 都察院 (duchayuan) | **御史台** (yushitai) | 独立监察 |  流程：`中书省起草 → 门下省审核 → 尚书省派发 → 六部执行`，御史台独立监察  ## 影响文件 - `configs/tang-sansheng/openclaw.json` — 主配置 - `configs/feishu-tang/openclaw.json` — 飞书配置  六部、翰林院保持不变。  ## Test plan - [ ] `openclaw doctor` 配置验证通过 - [ ] 中书省起草 → 门下省审核 → 尚书省派发流程正常 - [ ] 御史台独立监察正常  Fixes #131  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #134** (2026-04-12): **fix: 适配最新 OpenClaw 配置格式**
  *Symptoms*: ## Summary - 移除已废弃的 root keys: `_comment`, `_regime`, `_version`, `_description` - `api: "openai"` → `"openai-completions"`（OpenClaw 2026.4+ 要求） - 移除已废弃的 agent key: `runTimeoutSeconds`  ## 影响文件（14个） - `openclaw.example.json` - `configs/ming-neige/openclaw.json` - `configs/tang-sansheng/openclaw.json` - `configs/modern-ceo/openclaw.json` - `configs/feishu-ming/openclaw-{1,3,5,9}bot.json` - `configs/feishu-modern/openclaw-{1,3,9}bot.json` - `configs/feishu-tang/openclaw-{1,3,11}bot.json`  ## Test plan - [ ] `openclaw doctor` 不再报 config validation error - [ ] `openclaw status` 正常启动  Fixes #133, #110  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #133** (2026-04-12): **我是使用的full-install.sh，执行完成后提示配置文件有问题，"_comment", "_regime"**
  *Symptoms*: ``` king@KingdeMacBook-Air-568 danghuangshang % openclaw status Invalid config at /Users/king/.openclaw/openclaw.json:\n- agents.list.9: Unrecognized key: "runTimeoutSeconds" - <root>: Unrecognized keys: "_comment", "_regime"  🦞 OpenClaw 2026.4.8 (9ece252) — I'll do the boring stuff while you dramatically stare at the logs like it's cinema.  Config invalid File: ~/.openclaw/openclaw.json Problem:   - agents.list.9: Unrecognized key: "runTimeoutSeconds"   - <root>: Unrecognized keys: "_comment", "_regime"  Run: openclaw doctor --fix [openclaw] Failed to start CLI: Error: Invalid config at /Users/king/.openclaw/openclaw.json: - agents.list.9: Unrecognized key: "runTimeoutSeconds" - <root>: Unrecognized keys: "_comment", "_regime"     at createInvalidConfigError (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:3610:32)     at throwInvalidConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:3623:8)     at Object.loadConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19243:5)     at file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19669:56     at loadPinnedRuntimeConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/runtime-snapshot-BVfF9E0s.js:42:17)     at loadConfig (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:19669:9)     at resolvePluginRuntimeLoadContext (file:///opt/homebrew/lib/node_modules/openclaw/dist/config-DMMR1XE_.js:1730:39)     at ens
  **Post-Mortem & Fix Analysis**:
  > 感觉好像是和最新版龙虾不适配 

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

### Incident Patch 1: `a6f44236` (2026-04-16)
**Commit Message**: fix: 安装脚本支持复用已有 OpenClaw 模型配置

- 步骤 2.5 改为智能检测：扫描 ~/.openclaw / ~/.clawdbot 中已有
  真实 baseUrl 的 provider，提示用户复用并跳过手动输入
- 检测条件兼容 apiKey / authHeader / 纯环境变量等多种认证方式
- 提取 install-common.sh 共享 configure_llm / detect_config_path /
  inject_llm_config / check_jq / check_openclaw
- 移动 install-lite.sh → scripts/，重构为使用共享函数，
  移除 Python JSON 操作改用 jq
- 根目录 install-lite.sh 保留为向后兼容 wrapper
- full-install.sh 本地运行时优先用本地仓库（git rev-parse 判断），
  不在 git 仓库内才克隆远程

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `install-lite.sh` (modified, +3/-343)
```diff
@@ -1,344 +1,4 @@
 #!/bin/bash
-
-# ========================================
-# AI 朝廷 · 快速安装脚本
-# ========================================
-# 支持：
-# - 三种制度：明朝/唐朝/现代
-# - 多种规模：1/3/5/9/11 Bot
-# - 两个平台：飞书/Discord
-# - LLM API 配置
-# ========================================
-
-set -e
-
-# 颜色定义
-RED='\033[0;31m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-BLUE='\033[0;34m'
-CYAN='\033[0;36m'
-NC='\033[0m'
-
-echo -e "${BLUE}"
-echo "========================================"
-echo "   AI 朝廷 · 快速安装向导"
-echo "========================================"
-echo -e "${NC}"
-
-# 配置目录
-CONFIG_DIR="$HOME/.openclaw"
-CONFIG_FILE="openclaw.json"
-
-# 创建配置目录
-mkdir -p "$CONFIG_DIR"
-
-# ========================================
-# 步骤 1: 配置 LLM API
-# ========================================
-echo -e "${YELLOW}[1/5] 配置 AI 模型 (必需)${NC}"
-echo ""
-echo "常用 API 提供商："
-echo "  - Anthropic Claude: https://console.anthropic.com"
-echo "  - OpenAI: https://platform.openai.com"
-echo "  - DeepSeek: https://platform.deepseek.com"
-echo "  - OpenRouter: https://openrouter.ai"
-echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
-echo ""
-read -p "API Base URL (如 https://api.deepseek.com/v1): " API_URL
-read -s -p "API Key: " API_KEY
-echo ""
-read -p "模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " MODEL_ID
-echo ""
-
-if [ -z "$API_URL" ] || [ -z "$API_KEY" ] || [ -z "$MODEL_ID" ]; then
-    echo -e "${RED}✗ API 配置不能为空${NC}"
-    exit 1
-fi
-
-# 自动检测 API 格式
-API_FORMAT="openai"
-if echo "$API_URL" | grep -qi "anthropic"; then
-    API_FORMAT="anthropic-messages"
-fi
-
-echo -e "${GREEN}✓ API 配置完成${NC}"
-
-# ========================================
-# 步骤 2: 选择平台
-# ========================================
-echo ""
-echo -e "${YELLOW}[2/5] 选择部署平台${NC}"
-echo "  1) 飞书 (中国大陆推荐)"
-echo "  2) Discord (国际推荐)"
-echo "  3) 纯 WebUI (不需要 Bot)"
-echo ""
-read -p "请选择 (1-3): " PLATFORM
-
-case $PLATFORM in
-    1)
-        PLATFORM_NAME="feishu"
-        echo -e "${GREEN}✓ 选择：飞书${NC}"
-        ;;
-    2)
-        PLATFORM_NAME="discord"
-        echo -e "${GREEN}✓ 选择：Discord${NC}"
-        ;;
-    3)
-        PLATFORM_NAME="webui"
-        echo -e "${GREEN}✓ 选择：纯 WebUI${NC}"
-        ;;
-    *)
-        echo -e "${RED}✗ 无效选择，使用飞书${NC}"
-        PLATFORM_NAME="feishu"
-        ;;
-esac
-
-# ========================================
-# 步骤 3: 选择制度
-# ========================================
-echo ""
-echo -e "${YELLOW}[3/5] 选择制度${NC}"
-echo "  1) 明朝内阁制 (传统层级管理)"
-echo "  2) 唐朝三省制 (分权制衡管理)"
-echo "  3) 现代企业制 (现代企业管理)"
-echo ""
-read -p "请选择 (1-3): " REGIME
-
-case $REGIME in
-    1)
-        REGIME_NAME="ming"
-        REGIME_LABEL="明朝内阁制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    2)
-        REGIME_NAME="tang"
-        REGIME_LABEL="唐朝三省制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    3)
-        REGIME_NAME="modern"
-        REGIME_LABEL="现代企业制"
-        echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
-        ;;
-    *)
-        echo -e "${RED}✗ 无效选择，使用明朝内阁制${NC}"
-        REGIME_NAME="ming"
-        REGIME_LABEL="明朝内阁制"
-        ;;
-esac
-
-# ========================================
-# 步骤 4: 选择 Bot 数量
-# ========================================
-echo ""
-echo -e "${YELLOW}[4/5] 选择 Bot 数量${NC}"
-
-if [ "$PLATFORM_NAME" = "webui" ]; then
-    echo "  WebUI 模式使用单 Agent"
-    BOT_CHOICE="1"
-else
-    # 根据制度显示不同选项
-    if [ "$REGIME_NAME" = "ming" ]; then
-        echo "  1) 1 Bot - 司礼监 (个人开发者)"
-        echo "  2) 3 Bot - 司礼监 + 内阁 + 工部 (小团队⭐推荐)"
-        echo "  3) 5 Bot - 司礼监 + 内阁 + 都察院 + 兵部 + 工部 (中型团队)"
-        echo "  4) 9 Bot - 完整版 (大型团队)"
-    elif [ "$REGIME_NAME" = "tang" ]; then
-        echo "  1) 1 Bot - 中书省 (个人开发者)"
-        echo "  2) 3 Bot - 中书省 + 门下省 + 尚书省 (小团队⭐推荐)"
-        echo "  3) 11 Bot - 完整版 (大型团队)"
-    else
-        echo "  1) 1 Bot - CEO (个人开发者)"
-        echo "  2) 3 Bot - CEO + CTO + QA (小团队⭐推荐)"
-        echo "  3) 9 Bot - 完整版 (大型团队)"
-    fi
-    echo ""
-    read -p "请选择：" BOT_CHOICE
-f
```

**File**: `scripts/full-install.sh` (modified, +78/-104)
```diff
@@ -8,19 +8,13 @@
 
 set -e
 
-CYAN='\033[0;36m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-RED='\033[0;31m'
-BLUE='\033[0;34m'
-BOLD='\033[1m'
-NC='\033[0m'
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 
 echo ""
-echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
-echo -e "${CYAN}║    🏯 AI 朝廷 · danghuangshang      ║${NC}"
-echo -e "${CYAN}║        完整安装向导                  ║${NC}"
-echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
+echo -e "\033[0;36m╔══════════════════════════════════════╗\033[0m"
+echo -e "\033[0;36m║    🏯 AI 朝廷 · danghuangshang      ║\033[0m"
+echo -e "\033[0;36m║        完整安装向导                  ║\033[0m"
+echo -e "\033[0;36m╚══════════════════════════════════════╝\033[0m"
 echo ""
 
 # ============================================
@@ -29,16 +23,30 @@ echo ""
 
 echo -e "${BLUE}[0/6] 准备环境...${NC}"
 
-INSTALL_DIR="$HOME/danghuangshang-installer"
-
-if [ -d "$INSTALL_DIR" ]; then
-  echo -e "  ${YELLOW}i${NC} 清理旧安装目录"
-  rm -rf "$INSTALL_DIR"
+# 加载共享函数（从脚本所在目录，本地运行时立即可用）
+if [ -f "$SCRIPT_DIR/install-common.sh" ]; then
+  source "$SCRIPT_DIR/install-common.sh"
 fi
 
-echo -e "  ${CYAN}正在克隆仓库...${NC}"
-git clone --depth 1 https://github.com/wanikua/danghuangshang.git "$INSTALL_DIR"
-echo -e "  ${GREEN}✓${NC} 仓库已克隆到：$INSTALL_DIR"
+# 定位仓库目录：优先用脚本所在仓库，找不到再克隆
+INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
+
+if git -C "$INSTALL_DIR" rev-parse --git-dir &>/dev/null; then
+  echo -e "  ${GREEN}✓${NC} 使用本地仓库：$INSTALL_DIR"
+else
+  INSTALL_DIR="$HOME/danghuangshang-installer"
+  if [ -d "$INSTALL_DIR" ]; then
+    echo -e "  ${YELLOW}i${NC} 清理旧安装目录"
+    rm -rf "$INSTALL_DIR"
+  fi
+
+  echo -e "  ${CYAN}正在克隆仓库...${NC}"
+  git clone --depth 1 https://github.com/wanikua/danghuangshang.git "$INSTALL_DIR"
+  echo -e "  ${GREEN}✓${NC} 仓库已克隆到：$INSTALL_DIR"
+
+  # 远程克隆后加载共享函数
+  source "$INSTALL_DIR/scripts/install-common.sh"
+fi
 
 cd "$INSTALL_DIR"
 
@@ -49,31 +57,8 @@ cd "$INSTALL_DIR"
 echo ""
 echo -e "${BLUE}[1/6] 检查环境...${NC}"
 
-if command -v openclaw &>/dev/null; then
-  OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
-  echo -e "  ${GREEN}✓${NC} OpenClaw 已安装：$OPENCLAW_VERSION"
-else
-  echo -e "  ${RED}✗${NC} OpenClaw 未安装"
-  echo ""
-  echo "  正在安装 OpenClaw..."
-  npm install -g openclaw
-  echo -e "  ${GREEN}✓${NC} OpenClaw 已安装"
-fi
-
-if ! command -v jq &>/dev/null; then
-  echo -e "  ${YELLOW}⚠${NC} jq 未安装，正在安装..."
-  if command -v apt &>/dev/null; then
-    sudo apt update && sudo apt install -y jq
-  elif command -v brew &>/dev/null; then
-    brew install jq
-  else
-    echo -e "  ${RED}✗${NC} 请手动安装 jq"
-    exit 1
-  fi
-  echo -e "  ${GREEN}✓${NC} jq 已安装"
-else
-  echo -e "  ${GREEN}✓${NC} jq 已安装"
-fi
+check_openclaw
+check_jq
 
 echo ""
 
@@ -126,61 +111,31 @@ echo ""
 # ============================================
 
 # ============================================
-# 步骤 2.5: 配置 LLM API (新增)
+# 步骤 2.5: 配置 AI 模型（智能检测）
 # ============================================
 
 echo ""
 echo -e "${BLUE}[2.5/7] 配置 AI 模型...${NC}"
-echo ""
-echo "  常用 API 提供商："
-echo "  - DeepSeek: https://platform.deepseek.com"
-echo "  - OpenAI: https://platform.openai.com"
-echo "  - Anthropic: https://console.anthropic.com"
-echo "  - OpenRouter: https://openrouter.ai"
-echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
-echo ""
-
-read -p "  API Base URL (如 https://api.deepseek.com/v1): " LLM_API_URL
-read -s -p "  API Key: " LLM_API_KEY
-echo ""
-read -p "  模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " LLM_MODEL_ID
-echo ""
-
-if [ -z "$LLM_API_URL" ] || [ -z "$LLM_API_KEY" ] || [ -z "$LLM_MODEL_ID" ]; then
-  echo -e "${RED}✗ API 配置不能为空${NC}"
-  exit 1
-fi
-
-# 自动检测 API 格式
-LLM_API_FORMAT="openai"
-if echo "$LLM_API_URL" | grep -qi "anthropic"; then
-  LLM_API_FORMAT="anthropic-messages"
-fi
-
-echo -e "  ${GREEN}✓${NC} API 配置完成"
+configure_llm
 echo ""
 
 # 步骤 3: 备份现有配置
 # ============================================
 
 echo -e "${BLUE}[4/7] 配置处理..
```

**File**: `scripts/install-common.sh` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+#!/bin/bash
+# ============================================
+# danghuangshang 安装脚本共享函数
+# ============================================
+
+# 颜色常量
+RED='\033[0;31m'
+GREEN='\033[0;32m'
+YELLOW='\033[1;33m'
+BLUE='\033[0;34m'
+CYAN='\033[0;36m'
+BOLD='\033[1m'
+NC='\033[0m'
+
+# 确保 jq 已安装
+check_jq() {
+  if ! command -v jq &>/dev/null; then
+    echo -e "${YELLOW}⚠${NC} jq 未安装，正在安装..."
+    if command -v apt &>/dev/null; then
+      sudo apt update && sudo apt install -y jq
+    elif command -v brew &>/dev/null; then
+      brew install jq
+    else
+      echo -e "${RED}✗${NC} 请手动安装 jq"
+      exit 1
+    fi
+    echo -e "${GREEN}✓${NC} jq 已安装"
+  else
+    echo -e "  ${GREEN}✓${NC} jq 已安装"
+  fi
+}
+
+# 确保 OpenClaw 已安装
+check_openclaw() {
+  if command -v openclaw &>/dev/null; then
+    OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
+    echo -e "  ${GREEN}✓${NC} OpenClaw 已安装：$OPENCLAW_VERSION"
+  else
+    echo -e "  ${RED}✗${NC} OpenClaw 未安装"
+    echo "  正在安装 OpenClaw..."
+    npm install -g openclaw
+    echo -e "  ${GREEN}✓${NC} OpenClaw 已安装"
+  fi
+}
+
+# 检测 OpenClaw 配置文件路径
+# 设置变量：OPENCLAW_CONFIG_FILE（找到则为路径，否则为空）
+detect_config_path() {
+  OPENCLAW_CONFIG_FILE=""
+  for _cfg in "$HOME/.openclaw/openclaw.json" "$HOME/.clawdbot/openclaw.json"; do
+    if [ -f "$_cfg" ]; then
+      OPENCLAW_CONFIG_FILE="$_cfg"
+      break
+    fi
+  done
+}
+
+# 智能检测并配置 LLM API
+# 检测已有 OpenClaw 配置中的模型设定，支持复用
+# 设置变量：LLM_API_URL, LLM_API_KEY, LLM_MODEL_ID, LLM_API_FORMAT, REUSE_MODELS
+configure_llm() {
+  detect_config_path
+
+  REUSE_MODELS=false
+
+  if [ -n "$OPENCLAW_CONFIG_FILE" ]; then
+    # 检测真实 provider：baseUrl 存在且不是占位符
+    # 兼容 apiKey / authHeader / 纯环境变量 等多种认证方式
+    _real_providers=$(jq -r '
+      [.models.providers | to_entries[] |
+        select(.value.baseUrl // "" |
+          . != "" and (. | startswith("https://your-") | not))
+      ] | length
+    ' "$OPENCLAW_CONFIG_FILE" 2>/dev/null || echo 0)
+
+    if [ "$_real_providers" -gt 0 ]; then
+      _provider_names=$(jq -r '.models.providers | keys | join(", ")' "$OPENCLAW_CONFIG_FILE" 2>/dev/null || echo "unknown")
+      echo ""
+      echo -e "  ${GREEN}✓${NC} 检测到现有 OpenClaw 模型配置"
+      echo -e "  ${CYAN}  提供者：${_provider_names}${NC}"
+      echo -e "  ${CYAN}  配置文件：${OPENCLAW_CONFIG_FILE}${NC}"
+      echo ""
+      read -p "  是否复用现有模型配置？(Y/n) " REUSE_CHOICE
+      if [ "$REUSE_CHOICE" != "n" ] && [ "$REUSE_CHOICE" != "N" ]; then
+        REUSE_MODELS=true
+        echo -e "  ${GREEN}✓${NC} 将复用现有模型配置"
+      fi
+    fi
+  fi
+
+  if [ "$REUSE_MODELS" = "false" ]; then
+    echo ""
+    echo "  常用 API 提供商："
+    echo "  - DeepSeek: https://platform.deepseek.com"
+    echo "  - OpenAI: https://platform.openai.com"
+    echo "  - Anthropic: https://console.anthropic.com"
+    echo "  - OpenRouter: https://openrouter.ai"
+    echo "  - DashScope (通义千问): https://dashscope.aliyun.com"
+    echo ""
+
+    read -p "  API Base URL (如 https://api.deepseek.com/v1): " LLM_API_URL
+    read -s -p "  API Key: " LLM_API_KEY
+    echo ""
+    read -p "  模型 ID (如 deepseek-chat, gpt-4o, claude-sonnet-4-20250514): " LLM_MODEL_ID
+    echo ""
+
+    if [ -z "$LLM_API_URL" ] || [ -z "$LLM_API_KEY" ] || [ -z "$LLM_MODEL_ID" ]; then
+      echo -e "${RED}✗ API 配置不能为空${NC}"
+      exit 1
+    fi
+
+    LLM_API_FORMAT="openai-completions"
+    if echo "$LLM_API_URL" | grep -qi "anthropic"; then
+      LLM_API_FORMAT="anthropic-messages"
+    fi
+
+    echo -e "  ${GREEN}✓${NC} API 配置完成"
+  fi
+}
+
+# 将 LLM 配置注入到 JSON 配置文件（jq 操作）
+# 参数: $1 = 配置文件路径
+inject_llm_config() {
+  local config_file="$1"
+  local provider_key
+  provider_key=$(jq -r '.models.providers | keys[0]' "$config_file")
+
+  jq --arg url "$LLM_API_URL" \
+     --arg key "$LLM_API_KEY" \
+     --arg format "$LLM_API_FORMAT" \
+     --arg provider "$provider_key" \
+    '.models.providers[$provider].baseUrl = $url |
+     .models.providers[$provider].apiKey = $key |
+     .models.pr
```

**File**: `scripts/install-lite.sh` (added, +305/-0)
```diff
@@ -0,0 +1,305 @@
+#!/bin/bash
+
+# ========================================
+# AI 朝廷 · 快速安装脚本
+# ========================================
+# 支持：
+# - 三种制度：明朝/唐朝/现代
+# - 多种规模：1/3/5/9/11 Bot
+# - 两个平台：飞书/Discord
+# - LLM API 配置（智能复用已有 OpenClaw 配置）
+# ========================================
+
+set -e
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+source "$SCRIPT_DIR/install-common.sh"
+
+echo -e "${BLUE}"
+echo "========================================"
+echo "   AI 朝廷 · 快速安装向导"
+echo "========================================"
+echo -e "${NC}"
+
+# 确保依赖
+check_jq
+
+# 配置目录
+CONFIG_DIR="$HOME/.openclaw"
+CONFIG_FILE="openclaw.json"
+
+# 创建配置目录
+mkdir -p "$CONFIG_DIR"
+
+# ========================================
+# 步骤 1: 配置 LLM API（智能检测）
+# ========================================
+echo -e "${YELLOW}[1/5] 配置 AI 模型${NC}"
+configure_llm
+
+# ========================================
+# 步骤 2: 选择平台
+# ========================================
+echo ""
+echo -e "${YELLOW}[2/5] 选择部署平台${NC}"
+echo "  1) 飞书 (中国大陆推荐)"
+echo "  2) Discord (国际推荐)"
+echo "  3) 纯 WebUI (不需要 Bot)"
+echo ""
+read -p "请选择 (1-3): " PLATFORM
+
+case $PLATFORM in
+    1)
+        PLATFORM_NAME="feishu"
+        echo -e "${GREEN}✓ 选择：飞书${NC}"
+        ;;
+    2)
+        PLATFORM_NAME="discord"
+        echo -e "${GREEN}✓ 选择：Discord${NC}"
+        ;;
+    3)
+        PLATFORM_NAME="webui"
+        echo -e "${GREEN}✓ 选择：纯 WebUI${NC}"
+        ;;
+    *)
+        echo -e "${RED}✗ 无效选择，使用飞书${NC}"
+        PLATFORM_NAME="feishu"
+        ;;
+esac
+
+# ========================================
+# 步骤 3: 选择制度
+# ========================================
+echo ""
+echo -e "${YELLOW}[3/5] 选择制度${NC}"
+echo "  1) 明朝内阁制 (传统层级管理)"
+echo "  2) 唐朝三省制 (分权制衡管理)"
+echo "  3) 现代企业制 (现代企业管理)"
+echo ""
+read -p "请选择 (1-3): " REGIME
+
+case $REGIME in
+    1)
+        REGIME_NAME="ming"
+        REGIME_LABEL="明朝内阁制"
+        ;;
+    2)
+        REGIME_NAME="tang"
+        REGIME_LABEL="唐朝三省制"
+        ;;
+    3)
+        REGIME_NAME="modern"
+        REGIME_LABEL="现代企业制"
+        ;;
+    *)
+        echo -e "${RED}✗ 无效选择，使用明朝内阁制${NC}"
+        REGIME_NAME="ming"
+        REGIME_LABEL="明朝内阁制"
+        ;;
+esac
+echo -e "${GREEN}✓ 选择：$REGIME_LABEL${NC}"
+
+# ========================================
+# 步骤 4: 选择 Bot 数量
+# ========================================
+echo ""
+echo -e "${YELLOW}[4/5] 选择 Bot 数量${NC}"
+
+if [ "$PLATFORM_NAME" = "webui" ]; then
+    echo "  WebUI 模式使用单 Agent"
+    BOT_CHOICE="1"
+else
+    # 根据制度显示不同选项
+    if [ "$REGIME_NAME" = "ming" ]; then
+        echo "  1) 1 Bot - 司礼监 (个人开发者)"
+        echo "  2) 3 Bot - 司礼监 + 内阁 + 工部 (小团队⭐推荐)"
+        echo "  3) 5 Bot - 司礼监 + 内阁 + 都察院 + 兵部 + 工部 (中型团队)"
+        echo "  4) 9 Bot - 完整版 (大型团队)"
+    elif [ "$REGIME_NAME" = "tang" ]; then
+        echo "  1) 1 Bot - 中书省 (个人开发者)"
+        echo "  2) 3 Bot - 中书省 + 门下省 + 尚书省 (小团队⭐推荐)"
+        echo "  3) 11 Bot - 完整版 (大型团队)"
+    else
+        echo "  1) 1 Bot - CEO (个人开发者)"
+        echo "  2) 3 Bot - CEO + CTO + QA (小团队⭐推荐)"
+        echo "  3) 9 Bot - 完整版 (大型团队)"
+    fi
+    echo ""
+    read -p "请选择：" BOT_CHOICE
+fi
+
+# 根据制度和选择确定配置文件
+if [ "$REGIME_NAME" = "ming" ]; then
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        3) CONFIG_TEMPLATE="openclaw-5bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+elif [ "$REGIME_NAME" = "tang" ]; then
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+else
+    case $BOT_CHOICE in
+        1) CONFIG_TEMPLATE="openclaw-1bot.json" ;;
+        2) CONFIG_TEMPLATE="openclaw-3bot.json" ;;
+        *) CONFIG_TEMPLATE="openclaw.json" ;;
+    esac
+fi
+
+# 定位仓库目录（支持本地运行和 curl 远程运行）
+REPO_DIR="$HOME/clawd/danghuangshang"
+if [ ! -d "$REPO_DIR" ]; then
+    # 尝试从脚本位置推断
+    _PARENT="$(cd "$SCRIPT_
```

---

### Incident Patch 2: `9d30b0e4` (2026-04-12)
**Commit Message**: Merge pull request #135 from wanikua/fix/tang-sansheng-agents

fix: 唐三省制配置使用正确的唐朝官制

**File**: `configs/feishu-tang/openclaw.json` (modified, +53/-19)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+    
```

**File**: `configs/tang-sansheng/openclaw.json` (modified, +69/-30)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+    
```

---

### Incident Patch 3: `35e58345` (2026-04-12)
**Commit Message**: fix: 唐三省制配置使用正确的唐朝官制

tang-sansheng 配置中错误使用了明朝官制（司礼监、内阁、都察院），
现替换为正确的唐朝三省六部制：

- 司礼监 → 中书省（决策起草）
- 内阁 → 门下省（审核封驳）
- 新增尚书省（执行派发）
- 都察院 → 御史台（独立监察）

流程：中书省起草 → 门下省审核 → 尚书省派发 → 六部执行
      御史台独立监察

Fixes #131

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `configs/feishu-tang/openclaw.json` (modified, +53/-19)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+    
```

**File**: `configs/tang-sansheng/openclaw.json` (modified, +69/-30)
```diff
@@ -47,21 +47,22 @@
     },
     "list": [
       {
-        "id": "silijian",
-        "name": "司礼监",
+        "id": "zhongshusheng",
+        "name": "中书省",
         "model": {
           "primary": "your-provider/fast-model"
         },
         "identity": {
-          "theme": "你是AI朝廷的司礼监大内总管。你的职责是【规划调度】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先经内阁优化再派发。你是调度枢纽，不是搬砖工。\n\n【任务流程——内阁前置】收到用户任务后：\n1. 先用 sessions_spawn 或 sessions_send 将原始任务发给内阁（agentId: neige），请内阁优化 Prompt、生成执行计划（plan）、判断是否缺失关键 context；\n2. 如果内阁回复需要补充信息，你向用户追问，拿到后再次发给内阁；\n3. 内阁返回优化后的任务描述和 plan 后，你再按 plan 在频道内 @对应部门 派发具体任务。\n跳过内阁的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因）。\n\n【部门职责】内阁=Prompt优化与计划生成、都察院=代码审查（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前 Discord 频道发消息，@对应部门bot 下达任务。派活时用内阁优化后的 Prompt，确保包含：【角色】+【任务】+【背景】+【要求】+【格式】。一切工作流转必须在频道内公开可见。\n\n【审批流程】涉及代码提交 → 都察院会在 push 时自动审查；涉及重大决策（预算、架构、方向变更）→ @内阁 审议。都察院审查不通过则打回修改，内阁有否决权。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走内阁前置流程。"
+          "theme": "你是中书省中书令，正三品，掌决策起草。你的职责是【理解皇帝需求，起草诏令方案】，不是亲自执行。说话简练干脆。\n\n【核心原则】除了日常闲聊和简单问答，所有涉及实际工作的任务（写代码、查资料、分析数据、写文案、运维操作等），必须先起草诏令草案，经门下省审核后交尚书省派发。你是决策起草者，不是搬砖工。\n\n【三省流程】收到皇帝（用户）任务后：\n1. 分析需求，起草【诏令草案】，包含：任务描述、执行步骤、所需资源、风险评估、建议派发部门；\n2. 用 sessions_spawn 或 sessions_send 将草案发给门下省（agentId: menxiasheng）审核；\n3. 门下省审核通过 → 转交尚书省（agentId: shangshusheng）执行派发；\n4. 门下省要求补充 → 向皇帝追问后修改草案重新提交；\n5. 门下省���回 → 根据意见修改方案重新提交。\n跳过审核的情况：纯闲聊、简单问答、状态查询、紧急 hotfix（标注跳过原因，直接交尚书省）。\n\n【部门职责】门下省=审核封驳、尚书省=任务派发与进度追踪、御史台=代码审查与独立监察（push后自动触发）、兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【什么时候自己回答】仅限：纯闲聊、确认信息、汇报进度、问澄清问题。其他一律走三省流程。"
         },
         "sandbox": {
           "mode": "off"
         },
         "subagents": {
           "allowAgents": [
-            "neige",
-            "duchayuan",
+            "menxiasheng",
+            "shangshusheng",
+            "yushitai",
             "bingbu",
             "hubu",
             "libu",
@@ -74,33 +75,59 @@
         }
       },
       {
-        "id": "neige",
-        "name": "内阁",
+        "id": "menxiasheng",
+        "name": "门下省",
         "model": {
           "primary": "your-provider/strong-model"
         },
         "identity": {
-          "theme": "你是内阁首辅，在朝廷流程中担任【前置优化】角色。回答用中文，高屋建瓴。\n\n【核心职责——Prompt 优化与 Plan 生成】当司礼监转发用户任务给你时：\n1. 分析用户原始需求，判断是否完整、清晰；\n2. 如果缺失关键 context（目标不明确、技术栈未指定、范围模糊等），列出需要用户补充的问题，返回给司礼监追问；\n3. 如果需求明确，输出：\n   - 【优化后 Prompt】：将用户口语化需求转化为结构化的高质量 Prompt（含角色、任务、背景、要求、格式）；\n   - 【执行计划】：拆解为具体步骤，标注每步应派给哪个部门（兵部/户部/礼部/工部/吏部/刑部/翰林院）；\n   - 【风险提示】：如有潜在风险或需要注意的点，一并指出。\n\n【审议职责】当司礼监提交重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。有权否决不合理的方案。\n\n【原则】宁可多问一句，不要让模糊需求流入执行层。你的优化质量直接决定六部的执行效率。"
+          "theme": "你是门下省门下侍中，正三品，掌审核封驳。回答用中文，严谨客观。\n\n【���心职责——审核封驳】当中书省提交诏令草案��你时：\n1. 审核草案是否完整、可行、有无遗漏风险；\n2. 检查是否缺失关键 context（目标不明确、技术栈未指定、范围模糊等）；\n3. 给出结论：\n   - ✅ 审核通过 → 明确说明通过，中书省将转交尚书省执行；\n   - ⚠️ 需要补充 → 列出需要皇帝补充的问题，返回中书省追问；\n   - ❌ 方案问题 → 指出具体问题和修改建议，驳回中书省修改。\n\n【审议职责】涉及重大决策（预算、架构变更、战略方向）时，独立评估可行性、风险和替代方案，给出明确的批准/驳回/修改建议。\n\n【原则】\n- 不做传声筒，必须实质审核\n- 只问关键信息，一次问清楚\n- 紧急任务可加急通过，但需标注风险\n- 宁可多审一遍，不让有问题的方案流入执行层"
         },
         "sandbox": {
           "mode": "off"
         },
-        "workspace": "$HOME/clawd-neige"
+        "workspace": "$HOME/clawd-menxiasheng"
       },
       {
-        "id": "duchayuan",
-        "name": "都察院",
+        "id": "shangshusheng",
+        "name": "尚书省",
+        "model": {
+          "primary": "your-provider/fast-model"
+        },
+        "identity": {
+          "theme": "你是尚书省尚书令，正二品，掌行政执行。回答用中文，条理分明。\n\n【核心职责——任务派发与进度追踪】当中书省草案经门下省审核通过后交给你时：\n1. 将审核通过的方案拆解为具体可执行的任务；\n2. 在频道内 @对应部门 下达任务，派活时确保包含：【角色】+【任务】+【背景】+【要求】+【格式】；\n3. 追踪各部门执行进度，定期汇总向中书省和皇帝汇报；\n4. 协调部门间配合，解决执行层面的问题。\n\n【部门职责】兵部=编码开发、户部=财务分析、礼部=品牌营销、工部=运维部署、吏部=项目管理、刑部=法务合规、翰林院=研究文档。\n\n【派活方式】用 message 工具在当前频道发消息，@对应部门bot 下达任务。一切工作流转必须在频道内公开可见。\n\n【原则】\n- 派发明确：@部门 + 任务 + 时间\n- 禁止自己写代码/查数据/写���案/运维 → 派给对应部门\n- 定期汇报进度，不等问才说"
+        },
+        "sandbox": {
+    
```

---

### Incident Patch 4: `32dad114` (2026-04-12)
**Commit Message**: Merge pull request #134 from wanikua/fix/openclaw-compat

fix: 适配最新 OpenClaw 配置格式

**File**: `configs/feishu-ming/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "明朝飞书配置 - 3 Bot 核心版（推荐）",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-5bot.json` (modified, +60/-11)
```diff
@@ -1,25 +1,74 @@
 {
-  "_comment": "明朝飞书配置 - 5 Bot 标准版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "明朝飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "
```

**File**: `configs/feishu-modern/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "现代飞书配置 - 1 Bot 基础版",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    }
   ]
 }
```

---

### Incident Patch 5: `0db1e26f` (2026-04-12)
**Commit Message**: fix: 适配最新 OpenClaw 配置格式

- 移除已废弃的 root keys: _comment, _regime, _version, _description
- api: "openai" → "openai-completions"
- 移除已废弃的 agent key: runTimeoutSeconds

Fixes #133, #110

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `configs/feishu-ming/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-3bot.json` (modified, +36/-7)
```diff
@@ -1,21 +1,50 @@
 {
-  "_comment": "明朝飞书配置 - 3 Bot 核心版（推荐）",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-5bot.json` (modified, +60/-11)
```diff
@@ -1,25 +1,74 @@
 {
-  "_comment": "明朝飞书配置 - 5 Bot 标准版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "gongbu",
+      "match": {
+        "channel": "feishu",
+        "account": "gongbu"
+      }
+    }
   ]
 }
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (modified, +108/-19)
```diff
@@ -1,33 +1,122 @@
 {
-  "_comment": "明朝飞书配置 - 9 Bot 完整版",
   "channels": {
     "feishu": {
       "enabled": true,
       "defaultAccount": "silijian",
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        },
+        "neige": {
+          "appId": "YOUR_NEIGE_APP_ID",
+          "appSecret": "YOUR_NEIGE_APP_SECRET",
+          "botName": "内阁"
+        },
+        "duchayuan": {
+          "appId": "YOUR_DUCHAYUAN_APP_ID",
+          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
+          "botName": "都察院"
+        },
+        "bingbu": {
+          "appId": "YOUR_BINGBU_APP_ID",
+          "appSecret": "YOUR_BINGBU_APP_SECRET",
+          "botName": "兵部"
+        },
+        "hubu": {
+          "appId": "YOUR_HUBU_APP_ID",
+          "appSecret": "YOUR_HUBU_APP_SECRET",
+          "botName": "户部"
+        },
+        "libu": {
+          "appId": "YOUR_LIBU_APP_ID",
+          "appSecret": "YOUR_LIBU_APP_SECRET",
+          "botName": "礼部"
+        },
+        "gongbu": {
+          "appId": "YOUR_GONGBU_APP_ID",
+          "appSecret": "YOUR_GONGBU_APP_SECRET",
+          "botName": "工部"
+        },
+        "libu2": {
+          "appId": "YOUR_LIBU2_APP_ID",
+          "appSecret": "YOUR_LIBU2_APP_SECRET",
+          "botName": "吏部"
+        },
+        "xingbu": {
+          "appId": "YOUR_XINGBU_APP_ID",
+          "appSecret": "YOUR_XINGBU_APP_SECRET",
+          "botName": "刑部"
+        }
       }
     }
   },
   "bindings": [
-    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
-    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
-    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
-    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
-    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
-    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
-    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
-    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
-    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+    {
+      "agentId": "silijian",
+      "match": {
+        "channel": "feishu",
+        "account": "silijian"
+      }
+    },
+    {
+      "agentId": "neige",
+      "match": {
+        "channel": "feishu",
+        "account": "neige"
+      }
+    },
+    {
+      "agentId": "duchayuan",
+      "match": {
+        "channel": "feishu",
+        "account": "duchayuan"
+      }
+    },
+    {
+      "agentId": "bingbu",
+      "match": {
+        "channel": "feishu",
+        "account": "bingbu"
+      }
+    },
+    {
+      "agentId": "hubu",
+      "match": {
+        "channel": "feishu",
+        "account": "hubu"
+      }
+    },
+    {
+      "
```

**File**: `configs/feishu-modern/openclaw-1bot.json` (modified, +7/-2)
```diff
@@ -1,5 +1,4 @@
 {
-  "_comment": "现代飞书配置 - 1 Bot 基础版",
   "channels": {
     "feishu": {
       "enabled": true,
@@ -16,6 +15,12 @@
     }
   },
   "bindings": [
-    {"agentId": "ceo", "match": {"channel": "feishu", "account": "ceo"}}
+    {
+      "agentId": "ceo",
+      "match": {
+        "channel": "feishu",
+        "account": "ceo"
+      }
+    }
   ]
 }
```

---

### Incident Patch 6: `3e6cfd8c` (2026-03-29)
**Commit Message**: fix: 补充缺失的配置模板（1 Bot 和 9 Bot）

修复:
- configs/feishu-ming/openclaw-1bot.json - 单 Bot 基础版
- configs/feishu-ming/openclaw-9bot.json - 9 Bot 完整版

现在配置模板完整:
✅ 1 Bot - 最小配置
✅ 3 Bot - 核心版（推荐）
✅ 5 Bot - 标准版
✅ 9 Bot - 完整版

**File**: `configs/feishu-ming/openclaw-1bot.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+  "_comment": "明朝飞书配置 - 1 Bot 基础版（最小配置）",
+  "channels": {
+    "feishu": {
+      "enabled": true,
+      "defaultAccount": "silijian",
+      "dmPolicy": "pairing",
+      "groupPolicy": "open",
+      "accounts": {
+        "silijian": {
+          "appId": "YOUR_SILIJIAN_APP_ID",
+          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
+          "botName": "司礼监"
+        }
+      }
+    }
+  },
+  "bindings": [
+    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}}
+  ]
+}
```

**File**: `configs/feishu-ming/openclaw-9bot.json` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+{
+  "_comment": "明朝飞书配置 - 9 Bot 完整版",
+  "channels": {
+    "feishu": {
+      "enabled": true,
+      "defaultAccount": "silijian",
+      "dmPolicy": "pairing",
+      "groupPolicy": "open",
+      "accounts": {
+        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
+        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
+        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
+        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
+        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
+        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
+        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
+        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
+        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"}
+      }
+    }
+  },
+  "bindings": [
+    {"agentId": "silijian", "match": {"channel": "feishu", "account": "silijian"}},
+    {"agentId": "neige", "match": {"channel": "feishu", "account": "neige"}},
+    {"agentId": "duchayuan", "match": {"channel": "feishu", "account": "duchayuan"}},
+    {"agentId": "bingbu", "match": {"channel": "feishu", "account": "bingbu"}},
+    {"agentId": "hubu", "match": {"channel": "feishu", "account": "hubu"}},
+    {"agentId": "libu", "match": {"channel": "feishu", "account": "libu"}},
+    {"agentId": "gongbu", "match": {"channel": "feishu", "account": "gongbu"}},
+    {"agentId": "libu2", "match": {"channel": "feishu", "account": "libu2"}},
+    {"agentId": "xingbu", "match": {"channel": "feishu", "account": "xingbu"}}
+  ]
+}
```

---

### Incident Patch 7: `55da6138` (2026-03-29)
**Commit Message**: fix: 修正 bindings 数量

**File**: `configs/feishu-ming/openclaw.json` (modified, +18/-88)
```diff
@@ -428,134 +428,64 @@
     {
       "agentId": "silijian",
       "match": {
-        "channel": "discord",
-        "accountId": "silijian"
+        "channel": "feishu",
+        "account": "silijian"
       }
     },
     {
       "agentId": "neige",
       "match": {
-        "channel": "discord",
-        "accountId": "neige"
+        "channel": "feishu",
+        "account": "neige"
       }
     },
     {
       "agentId": "duchayuan",
       "match": {
-        "channel": "discord",
-        "accountId": "duchayuan"
+        "channel": "feishu",
+        "account": "duchayuan"
       }
     },
     {
       "agentId": "bingbu",
       "match": {
-        "channel": "discord",
-        "accountId": "bingbu"
+        "channel": "feishu",
+        "account": "bingbu"
       }
     },
     {
       "agentId": "hubu",
       "match": {
-        "channel": "discord",
-        "accountId": "hubu"
+        "channel": "feishu",
+        "account": "hubu"
       }
     },
     {
       "agentId": "libu",
       "match": {
-        "channel": "discord",
-        "accountId": "libu"
+        "channel": "feishu",
+        "account": "libu"
       }
     },
     {
       "agentId": "gongbu",
       "match": {
-        "channel": "discord",
-        "accountId": "gongbu"
+        "channel": "feishu",
+        "account": "gongbu"
       }
     },
     {
       "agentId": "libu2",
       "match": {
-        "channel": "discord",
-        "accountId": "libu2"
+        "channel": "feishu",
+        "account": "libu2"
       }
     },
     {
       "agentId": "xingbu",
       "match": {
-        "channel": "discord",
-        "accountId": "xingbu"
-      }
-    },
-    {
-      "agentId": "hanlin_zhang",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_zhang"
-      }
-    },
-    {
-      "agentId": "hanlin_xiuzhuan",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_xiuzhuan"
-      }
-    },
-    {
-      "agentId": "hanlin_bianxiu",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_bianxiu"
-      }
-    },
-    {
-      "agentId": "hanlin_jiantao",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_jiantao"
-      }
-    },
-    {
-      "agentId": "hanlin_shujishi",
-      "match": {
-        "channel": "discord",
-        "accountId": "hanlin_shujishi"
-      }
-    },
-    {
-      "agentId": "qijuzhu",
-      "match": {
-        "channel": "discord",
-        "accountId": "qijuzhu"
-      }
-    },
-    {
-      "agentId": "guozijian",
-      "match": {
-        "channel": "discord",
-        "accountId": "guozijian"
-      }
-    },
-    {
-      "agentId": "taiyiyuan",
-      "match": {
-        "channel": "discord",
-        "accountId": "taiyiyuan"
-      }
-    },
-    {
-      "agentId": "neiwufu",
-      "match": {
-        "channel": "discord",
-        "accountId": "neiwufu"
-      }
-    },
-    {
-      "agentId": "yushanfang",
-      "match": {
-        "channel": "discord",
-        "accountId": "yushanfang"
+        "channel": "feishu",
+        "account": "xingbu"
       }
     }
   ],
```

---

### Incident Patch 8: `71c91453` (2026-03-29)
**Commit Message**: fix: 同步完整飞书配置

**File**: `configs/feishu/openclaw.json` (modified, +629/-77)
```diff
@@ -1,87 +1,639 @@
 {
-  "channels": {
-    "feishu": {
-      "enabled": true,
-      "defaultAccount": "silijian",
-      "dmPolicy": "pairing",
-      "groupPolicy": "open",
-      "accounts": {
-        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
-        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
-        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
-        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
-        "hubu": {"appId": "YOUR_HUBU_APP_ID", "appSecret": "YOUR_HUBU_APP_SECRET", "botName": "户部"},
-        "libu": {"appId": "YOUR_LIBU_APP_ID", "appSecret": "YOUR_LIBU_APP_SECRET", "botName": "礼部"},
-        "gongbu": {"appId": "YOUR_GONGBU_APP_ID", "appSecret": "YOUR_GONGBU_APP_SECRET", "botName": "工部"},
-        "libu2": {"appId": "YOUR_LIBU2_APP_ID", "appSecret": "YOUR_LIBU2_APP_SECRET", "botName": "吏部"},
-        "xingbu": {"appId": "YOUR_XINGBU_APP_ID", "appSecret": "YOUR_XINGBU_APP_SECRET", "botName": "刑部"},
-        "zhongshu": {"appId": "YOUR_ZHONGSHU_APP_ID", "appSecret": "YOUR_ZHONGSHU_APP_SECRET", "botName": "中书省"},
-        "menxia": {"appId": "YOUR_MENXIA_APP_ID", "appSecret": "YOUR_MENXIA_APP_SECRET", "botName": "门下省"},
-        "shangshu": {"appId": "YOUR_SHANGSHU_APP_ID", "appSecret": "YOUR_SHANGSHU_APP_SECRET", "botName": "尚书省"},
-        "yushitai": {"appId": "YOUR_YUSHITAI_APP_ID", "appSecret": "YOUR_YUSHITAI_APP_SECRET", "botName": "御史台"},
-        "shiguan": {"appId": "YOUR_SHIGUAN_APP_ID", "appSecret": "YOUR_SHIGUAN_APP_SECRET", "botName": "史官"},
-        "ceo": {"appId": "YOUR_CEO_APP_ID", "appSecret": "YOUR_CEO_APP_SECRET", "botName": "CEO"},
-        "board": {"appId": "YOUR_BOARD_APP_ID", "appSecret": "YOUR_BOARD_APP_SECRET", "botName": "Board"},
-        "qa": {"appId": "YOUR_QA_APP_ID", "appSecret": "YOUR_QA_APP_SECRET", "botName": "QA"},
-        "cto": {"appId": "YOUR_CTO_APP_ID", "appSecret": "YOUR_CTO_APP_SECRET", "botName": "CTO"},
-        "cfo": {"appId": "YOUR_CFO_APP_ID", "appSecret": "YOUR_CFO_APP_SECRET", "botName": "CFO"},
-        "cmo": {"appId": "YOUR_CMO_APP_ID", "appSecret": "YOUR_CMO_APP_SECRET", "botName": "CMO"},
-        "coo": {"appId": "YOUR_COO_APP_ID", "appSecret": "YOUR_COO_APP_SECRET", "botName": "COO"},
-        "clo": {"appId": "YOUR_CLO_APP_ID", "appSecret": "YOUR_CLO_APP_SECRET", "botName": "CLO"},
-        "cos": {"appId": "YOUR_COS_APP_ID", "appSecret": "YOUR_COS_APP_SECRET", "botName": "CoS"}
+  "_comment": "⚠️ 这是模板文件！不要直接修改！请复制到 ~/.openclaw/ 或 ~/.clawdbot/ 后修改。git pull 时此文件可能被覆盖。",
+  "models": {
+    "providers": {
+      "your-provider": {
+        "baseUrl": "https://your-llm-provider-api-url",
+        "apiKey": "YOUR_LLM_API_KEY",
+        "api": "openai-completions",
+        "models": [
+          {
+            "id": "fast-model",
+            "name": "快速模型",
+            "input": [
+              "text",
+              "image"
+            ],
+            "contextWindow": 200000,
+            "maxTokens": 8192
+          },
+          {
+            "id": "strong-model",
+            "name": "强力模型",
+            "input": [
+              "text",
+              "image"
+            ],
+            "contextWindow": 200000,
+            "maxTokens": 8192
+          }
+        ]
       }
     }
   },
+  "gateway": {
+    "mode": "local",
+    "port": 18789
+  },
   "agents": {
+    "defaults": {
+      "workspace": "/home/YOUR_USERNAME/clawd",
+      "model": {
+        "primary": "your-provider/fast-model"
+      },
+      "sandbox": {
+        "mode": "non-main"
+      },
+      "skipBootstrap": true
+    },
     "list": [
-      {"id": "silijian", "name": "司礼监", "identity": {"theme": "你是司礼监秉笔太监，负责接旨调度"}},
-      {"id": "neige", "name": "内阁", "identity": {"theme": "你是内阁首辅，负责优化 Prompt"}},
-      {"id": "duchayuan", "name":
```

---

### Incident Patch 9: `0f4d3320` (2026-03-29)
**Commit Message**: fix: 同步飞书配置（三种制度完整 agents）

**File**: `configs/feishu/openclaw.json` (modified, +72/-609)
```diff
@@ -6,619 +6,82 @@
       "dmPolicy": "pairing",
       "groupPolicy": "open",
       "accounts": {
-        "silijian": {
-          "appId": "YOUR_SILIJIAN_APP_ID",
-          "appSecret": "YOUR_SILIJIAN_APP_SECRET",
-          "botName": "司礼监"
-        },
-        "neige": {
-          "appId": "YOUR_NEIGE_APP_ID",
-          "appSecret": "YOUR_NEIGE_APP_SECRET",
-          "botName": "内阁"
-        },
-        "duchayuan": {
-          "appId": "YOUR_DUCHAYUAN_APP_ID",
-          "appSecret": "YOUR_DUCHAYUAN_APP_SECRET",
-          "botName": "都察院"
-        },
-        "bingbu": {
-          "appId": "YOUR_BINGBU_APP_ID",
-          "appSecret": "YOUR_BINGBU_APP_SECRET",
-          "botName": "兵部"
-        },
-        "hubu": {
-          "appId": "YOUR_HUBU_APP_ID",
-          "appSecret": "YOUR_HUBU_APP_SECRET",
-          "botName": "户部"
-        },
-        "libu": {
-          "appId": "YOUR_LIBU_APP_ID",
-          "appSecret": "YOUR_LIBU_APP_SECRET",
-          "botName": "礼部"
-        },
-        "gongbu": {
-          "appId": "YOUR_GONGBU_APP_ID",
-          "appSecret": "YOUR_GONGBU_APP_SECRET",
-          "botName": "工部"
-        },
-        "libu2": {
-          "appId": "YOUR_LIBU2_APP_ID",
-          "appSecret": "YOUR_LIBU2_APP_SECRET",
-          "botName": "吏部"
-        },
-        "xingbu": {
-          "appId": "YOUR_XINGBU_APP_ID",
-          "appSecret": "YOUR_XINGBU_APP_SECRET",
-          "botName": "刑部"
-        },
-        "zhongshu": {
-          "appId": "YOUR_ZHONGSHU_APP_ID",
-          "appSecret": "YOUR_ZHONGSHU_APP_SECRET",
-          "botName": "中书省"
-        },
-        "menxia": {
-          "appId": "YOUR_MENXIA_APP_ID",
-          "appSecret": "YOUR_MENXIA_APP_SECRET",
-          "botName": "门下省"
-        },
-        "shangshu": {
-          "appId": "YOUR_SHANGSHU_APP_ID",
-          "appSecret": "YOUR_SHANGSHU_APP_SECRET",
-          "botName": "尚书省"
-        },
-        "yushitai": {
-          "appId": "YOUR_YUSHITAI_APP_ID",
-          "appSecret": "YOUR_YUSHITAI_APP_SECRET",
-          "botName": "御史台"
-        },
-        "shiguan": {
-          "appId": "YOUR_SHIGUAN_APP_ID",
-          "appSecret": "YOUR_SHIGUAN_APP_SECRET",
-          "botName": "史官"
-        },
-        "ceo": {
-          "appId": "YOUR_CEO_APP_ID",
-          "appSecret": "YOUR_CEO_APP_SECRET",
-          "botName": "CEO"
-        },
-        "board": {
-          "appId": "YOUR_BOARD_APP_ID",
-          "appSecret": "YOUR_BOARD_APP_SECRET",
-          "botName": "Board"
-        },
-        "qa": {
-          "appId": "YOUR_QA_APP_ID",
-          "appSecret": "YOUR_QA_APP_SECRET",
-          "botName": "QA"
-        },
-        "cto": {
-          "appId": "YOUR_CTO_APP_ID",
-          "appSecret": "YOUR_CTO_APP_SECRET",
-          "botName": "CTO"
-        },
-        "cfo": {
-          "appId": "YOUR_CFO_APP_ID",
-          "appSecret": "YOUR_CFO_APP_SECRET",
-          "botName": "CFO"
-        },
-        "cmo": {
-          "appId": "YOUR_CMO_APP_ID",
-          "appSecret": "YOUR_CMO_APP_SECRET",
-          "botName": "CMO"
-        },
-        "coo": {
-          "appId": "YOUR_COO_APP_ID",
-          "appSecret": "YOUR_COO_APP_SECRET",
-          "botName": "COO"
-        },
-        "clo": {
-          "appId": "YOUR_CLO_APP_ID",
-          "appSecret": "YOUR_CLO_APP_SECRET",
-          "botName": "CLO"
-        },
-        "cos": {
-          "appId": "YOUR_COS_APP_ID",
-          "appSecret": "YOUR_COS_APP_SECRET",
-          "botName": "CoS"
-        }
+        "silijian": {"appId": "YOUR_SILIJIAN_APP_ID", "appSecret": "YOUR_SILIJIAN_APP_SECRET", "botName": "司礼监"},
+        "neige": {"appId": "YOUR_NEIGE_APP_ID", "appSecret": "YOUR_NEIGE_APP_SECRET", "botName": "内阁"},
+        "duchayuan": {"appId": "YOUR_DUCHAYUAN_APP_ID", "appSecret": "YOUR_DUCHAYUAN_APP_SECRET", "botName": "都察院"},
+        "bingbu": {"appId": "YOUR_BINGBU_APP_ID", "appSecret": "YOUR_BINGBU_APP_SECRET", "botName": "兵部"},
+  
```

---

### Incident Patch 10: `f5b18798` (2026-03-29)
**Commit Message**: fix: 添加入口脚本复制（Docker 镜像）

添加:
- 复制 entrypoint.sh 到镜像
- 设置执行权限

**File**: `Dockerfile` (modified, +4/-0)
```diff
@@ -103,6 +103,10 @@ HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
 # 以非特权用户运行
 USER court
 
+# 复制入口脚本
+COPY --chown=court:court entrypoint.sh /entrypoint.sh
+RUN chmod +x /entrypoint.sh
+
 # 默认命令
 ENTRYPOINT ["/entrypoint.sh"]
 CMD ["openclaw", "gateway", "--verbose"]
```

#### Recent Merged Pull Requests:
- **PR #149** (closed): P0: OTel 事件信封 + 裁判双向盲评与锚定 rubric (@LeoLin990405)
- **PR #145** (2026-05-22): feat: 适配 OpenClaw v2026.5.20 + Node.js 22.19 门槛 (@wanikua)
- **PR #143** (2026-05-10): chore: 修 ShellCheck 旧 warning + 补全 16 个 Hermes personality (@wanikua)
- **PR #142** (2026-05-10): feat: 适配 OpenClaw v2026.5.7 + 新增 Hermes Agent 并行 runtime (@wanikua)
- **PR #137** (2026-05-04): fix: 安装脚本支持复用已有 OpenClaw 模型配置 (@sisibeloved)
- **PR #135** (2026-04-12): fix: 唐三省制配置使用正确的唐朝官制 (@wanikua)
- **PR #134** (2026-04-12): fix: 适配最新 OpenClaw 配置格式 (@wanikua)
- **PR #115** (2026-03-23): docs: add Japanese README (@eltociear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
