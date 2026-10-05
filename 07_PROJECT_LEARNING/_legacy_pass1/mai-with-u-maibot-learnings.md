# Forensic Learning Record (Deep Inspection): Mai-with-u/MaiBot

> **Canonical Artifact**: `07_PROJECT_LEARNING/mai-with-u-maibot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mai-with-u/MaiBot](https://github.com/Mai-with-u/MaiBot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:19:50.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mai-with-u/MaiBot`
- **Description**: MaiSaka, an LLM-based intelligent agent, is a digital lifeform devoted to understanding you and interacting in the style of a real human. She does not pursue perfection, nor does she seek efficiency; instead, she values warmth, authenticity, and genuine connection.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 6084 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bot.py`
```
# raise RuntimeError("System Not Ready")
from pathlib import Path
from rich.traceback import install
from typing import TypeVar

import asyncio
import hashlib
import os
import platform
# import shutil
import signal
import subprocess
import sys
import time
import traceback

from src.common.i18n import set_locale, t, tn
from src.common.logger import get_logger, initialize_logging, shutdown_logging
from src.common.runtime_loop import set_main_loop
from src.common.shutdown import request_shutdown
from src.common.update_notice import emit_terminal_update_notice_if_needed
from src.config.legacy_upgrade_confirmation import require_legacy_upgrade_confirmation

# 设置工作目录为脚本所在目录
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)
set_locale(os.getenv("MAIBOT_LOCALE", "zh-CN"))

# 检查是否是 Worker 进程，只在 Worker 进程中输出详细的初始化信息
# Runner 进程只需要基本的日志功能，不需要详细的初始化日志
is_worker = os.environ.get("MAIBOT_WORKER_PROCESS") == "1"
initialize_logging(verbose=is_worker)
install(extra_lines=3)
logger = get_logger("main")

# 定义重启退出码
RESTART_EXIT_CODE = 42
_active_main_loop: asyncio.AbstractEventLoop | None = None
_active_main_task: asyncio.Task[None] | None = None
_shutdown_signal_count: int = 0
_RunResultT = TypeVar("_RunResultT")
# print("-----------------------------------------")
# print("\n\n\n\n\n")
# print(t("startup.dev_branch_warning"))
# print("\n\n\n\n\n")
# print("-----------------------------------------")


def _print_interrupt_exit_notice() -> None:
    """在日志系统不可用或正在退出时，用最小输出提示 Ctrl+C 退出。"""

    print("\n收到 Ctrl+C，中断退出。")


def _mark_shutdown_and_interrupt(_signum: int, _frame: object) -> None:
    """收到中断信号时标记关停，并请求主任务取消。"""

    global _shutdown_signal_count
    _shutdown_signal_count += 1
    request_shutdown("signal")
    main_loop = _active_main_loop
    if main_loop is None or main_loop.is_closed():
        return

    try:
        main_loop.call_soon_threadsafe(_cancel_active_main_task_from_signal)
    except RuntimeError:
        return


def _cancel_active_main_task_from_signal() -> None:
    """在事件循环线程中取消当前主任务。"""

    if _active_main_task is None or _active_main_task.done():
        return
    _active_main_task.cancel()


def run_runner_process():
    """
    Runner 进程逻辑：作为守护进程运行，负责启动和监控 Worker 进程。
    处理重启请求 (退出码 42) 和 Ctrl+C 信号。
    """
    script_file = sys.argv[0]
    python_executable = sys.executable

    # 设置环境变量，标记子进程为 Worker 进程
    env = os.environ.copy()
    env["MAIBOT_WORKER_PROCESS"] = "1"

    while True:
        logger.info(t("startup.launching_script", script_file=script_file))

        # 启动子进程 (Worker)
        # 使用 sys.executable 确保使用相同的 Python 解释器
        cmd = [python_executable, script_file] + sys.argv[1:]

        process = subprocess.Popen(cmd, env=env)

        try:
            # 等待子进程结束
            return_code = process.wait()

            if return_code == RESTART_EXIT_CODE:
                logger.info(t("startup.restart_requested", exit_code=RESTART_EXIT_CODE))
                time.sleep(1)  # 稍作等待
                continue
            else:
                logger.info(t("startup.program_exited", return_code=return_code))
                sys.exit(return_code)

        except KeyboardInterrupt:
            # 向子进程发送终止信号
            if process.poll() is None:
                # 在 Windows 上，Ctrl+C 通常已经发送给了子进程（如果它们共享控制台）
                # 但为了保险，我们可以尝试 terminate
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning(t("startup.child_process_force_kill"))
                    process.kill()
            sys.exit(0)


# 检查是否是 Worker 进程
# 如果没有设置 MAIBOT_WORKER_PROCESS 环境变量，说明是直接运行的脚本，
# 此时应该作为 Runner 运行。
if os.environ.get("MAIBOT_WORKER_PROCESS") != "1":
    if __name__ == "__main__":
        require_legacy_upgrade_confirmation(Path(script_dir))
        run_runner_process()
    # 如果作为模块导入，不执行 Runner 逻辑，但也不应该执行下面的 Worker 逻辑
    sys.exit(0)

# 以下是 Worker 进程的逻辑

# 最早期初始化日志系统，确保所有后续模块都使用正确的日志格式
# 注意：Runner 进程已经在第 37 行初始化了日志系统，但 Worker 进程是独立进程，需要重新初始化
# 由于 Runner 和 Worker 是不同进程，它们有独立的内存空间，所以都会初始化一次
# 这是正常的，但为了避免重复的初始化日志，我们在 initialize_logging() 中添加了防重复机制
# 不过由于是不同进程，每个进程仍会初始化一次，这是预期的行为

require_legacy_upgrade_confirmation(Path(script_dir))
asyncio.run(emit_terminal_update_notice_if_needed())

logger.info(t("startup.worker_dir_set", script_dir=script_dir))

from src.main import MainSystem  # noqa
from src.manager.async_task_manager import async_task_manager  # noqa


# logger = get_logger("main")


# install(extra_lines=3)

# 设置工作目录为脚本所在目录
# script_dir = os.path.dirname(os.path.abspath(__file__))
# os.chdir(script_dir)
confirm_logger = get_logger("confirm")
# 获取没有加载env时的环境变量
env_mask = {key: os.getenv(key) for key in os.environ}

uvicorn_server = None
driver = None
app = None
loop = None


def print_opensource_notice():
    """打印开源项目提示，防止倒卖"""
    from colorama import init, Fore, Style

    init()

    notice_lines = [
        "",
        f"{Fore.CYAN}{'═' * 70}{Style.RESET_ALL}",
        f"{Fore.GREEN}{t('startup.opensource_title')}{Style.RESET_ALL}",
        f"{Fore.CYAN}{'─' * 70}{Style.RESET_ALL}",
        f"{Fore.YELLOW}{t('startup.opensource_free_notice')}{Style.RESET_ALL}",
        f"{Fore.WHITE}{t('startup.opensource_scamming_notice')}{Style.RESET_ALL}",
        "",
        f"{Fore.WHITE}{t('startup.opensource_repo')}{Fore.BLUE}{t('startup.opensource_repo_value')} {Style.RESET_ALL}",
        f"{Fore.WHITE}{t('startup.opensource_docs')}{Fore.BLUE}{t('startup.opensource_docs_value')} {Style.RESET_ALL}",
        f"{Fore.WHITE}{t('startup.opensource_group')}{Fore.BLUE}{t('startup.opensource_group_value')}{Style.RESET_ALL}",
        f"{Fore.CYAN}{'─' * 70}{Style.RESET_ALL}",
        f"{Fore.RED}  ⚠ {t('startup.opensource_resale_warning').strip()}{Style.RESET_ALL}",
        f"{Fore.CYAN}{'═' * 70}{Style.RESET_ALL}",
        "",
    ]

    for line in notice_lines:
        print(line)


def easter_egg():
    # 彩蛋
    from colorama import init, Fore

    init()
    text = t("startup.easter_egg")
    rainbow_colors = [Fore.RED, Fore.YELLOW, Fore.GREEN, Fore.CYAN, Fore.BLUE, Fore.MAGENTA]
    rainbow_text = ""
    for i, char in enumerate(text):
        rainbow_text += rainbow_colors[i % len(rainbow_colors)] + char
    print(rainbow_text)


async def graceful_shutdown(main_system: MainSystem | None = None):  # sourcery skip: use-named-expression
    try:
        request_shutdown("graceful_shutdown")
        logger.info(t("startup.shutdown_started"))

        # 关闭 WebUI 服务器
        try:
            if main_system is not None and main_system.webui_server is not None:
                await main_system.webui_server.shutdown()
        except Exception as e:
            logger.warning(f"关闭 WebUI 服务器时出错: {e}")

        from src.core.event_bus import event_bus
        from src.core.types import EventType

        # 触发 ON_STOP 事件
        await _await_shutdown_step(
            event_bus.emit(event_type=EventType.ON_STOP),
            timeout=5.0,
            step_name="触发 ON_STOP 事件",
        )

        # 停止新版本插件运行时
        from src.plugin_runtime.integration import get_plugin_runtime_manager

        await _await_shutdown_step(
            get_plugin_runtime_manager().stop(),
            timeout=8.0,
            step_name="停止插件运行时",
        )

        # 先等待图片描述写回，再关闭记忆内核，避免未完成同步被统一取消。
        from src.chat.image_system.image_manager import image_manager

        await _await_shutdown_step(image_manager.shutdown(), timeout=120.0, step_name="等待图片描述同步")

        # 停止所有异步任务
        await _await_shutdown_step(
            async_task_manager.stop_and_wait_all_tasks(),
            timeout=5.0,
            step_name="停止异步任务管理器任务",
        )

        # 获取所有剩余任务，排除当前任务
        remaining_tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]

        if remaining_tasks:
            logger.info(tn("startup.remaining_tasks_cancelling", len(remaining_tasks)))

            # 取消所有剩余任务
    
```

### Core Architecture Module: `dashboard/app-version.ts`
```
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as { version?: unknown }

if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
  throw new Error('dashboard/package.json 缺少有效的 version 字段')
}

export const DASHBOARD_APP_VERSION = packageJson.version.trim()
export const dashboardVersionDefine = {
  __APP_VERSION__: JSON.stringify(DASHBOARD_APP_VERSION),
}

```

### Core Architecture Module: `dashboard/electron.vite.config.ts`
```
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import path from 'path'

import { dashboardVersionDefine } from './app-version'

export default defineConfig({
  main: {
    build: {
      target: 'node18',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main/index.ts'),
        },
        output: {
          format: 'cjs',
        },
        // electron-store 是 ESM-only 且位于 devDependencies，必须打进主进程产物。
        // 只保留 Electron 运行时本身为 external，避免 CJS require ESM 及打包后缺包。
        external: ['electron'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
  preload: {
    build: {
      target: 'node18',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    define: dashboardVersionDefine,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [tailwindcss(), react()],
    server: {
      port: 7999,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          ws: true,
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
        },
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],

            router: ['@tanstack/react-router', '@tanstack/react-virtual'],

            radix: [
              '@radix-ui/react-dialog',
              '@radix-ui/react-select',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-avatar',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
            ],

            icons: ['lucide-react'],

            charts: ['recharts'],

            codemirror: [
              '@uiw/react-codemirror',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/lang-python',
              '@codemirror/lint',
              '@codemirror/theme-one-dark',
            ],

            reactflow: ['reactflow', 'dagre'],

            markdown: [
              'react-markdown',
              'remark-gfm',
              'remark-math',
              'rehype-katex',
              'katex',
            ],

            uppy: [
              '@uppy/core',
              '@uppy/dashboard',
              '@uppy/react',
              '@uppy/xhr-upload',
            ],

            dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],

            utils: [
              'date-fns',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
            ],

            misc: ['react-joyride', 'react-day-picker', 'cmdk'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  },
})

```

### Core Architecture Module: `dashboard/electron/main/index.ts`
```
import { app, BrowserWindow, ipcMain, protocol, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { registerAppProtocol } from './protocol'
import {
  addBackend,
  getActiveBackend,
  getBackends,
  getWindowBounds,
  isFirstLaunch,
  markFirstLaunchComplete,
  removeBackend,
  setActiveBackend,
  setWindowBounds,
  updateBackend,
} from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

/**
 * Register app:// custom protocol BEFORE app.whenReady()
 * This is critical for electron-vite to work correctly
 */
function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        corsEnabled: true,
        secure: true,
        allowServiceWorkers: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ])
}

/**
 * Register all IPC handlers for window control and store CRUD
 */
function registerIpcHandlers() {
  // ── Window control ───────────────────────────────────────────────────────
  ipcMain.handle('electron:minimize-window', () => mainWindow?.minimize())
  ipcMain.handle('electron:maximize-window', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('electron:close-window', () => mainWindow?.close())
  ipcMain.handle('electron:is-maximized', () => mainWindow?.isMaximized() ?? false)

  // ── Backend CRUD ─────────────────────────────────────────────────────────
  ipcMain.handle('electron:get-backends', () => getBackends())
  ipcMain.handle('electron:add-backend', (_e, conn) => addBackend(conn))
  ipcMain.handle('electron:update-backend', (_e, id, patch) => updateBackend(id, patch))
  ipcMain.handle('electron:remove-backend', (_e, id) => removeBackend(id))
  ipcMain.handle('electron:set-active-backend', (_e, id) => {
    setActiveBackend(id)
    const backend = getActiveBackend()
    mainWindow?.webContents.send('electron:backend-changed', backend)
  })
  ipcMain.handle('electron:get-active-backend', () => getActiveBackend())
  ipcMain.handle('electron:get-active-url', () => getActiveBackend()?.url ?? null)

  // ── App state ────────────────────────────────────────────────────────────
  ipcMain.handle('electron:is-first-launch', () => isFirstLaunch())
  ipcMain.handle('electron:mark-first-launch-complete', () => markFirstLaunchComplete())
  ipcMain.handle('electron:get-app-version', () => app.getVersion())
}

/**
 * Create the main application window
 */
function createWindow() {
  const isMac = process.platform === 'darwin'

  // Restore window bounds from store
  const bounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    // macOS: hide native title bar but keep traffic light buttons
    ...(isMac
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 12, y: 8 },
        }
      : {}),
    // Windows/Linux: overlay title bar (custom title bar integrated)
    ...(!isMac
      ? {
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#ffffff',
            height: 32,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // Load the app using app:// protocol
  // electron-vite will handle serving the renderer from app://host/index.html
  if (process.env.ELECTRON_RENDERER_URL) {
    // Development: load from electron-vite dev server
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    // Production: load from bundled renderer
    mainWindow.loadURL('app://host/index.html')
  }

  // Persist window size/position on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const { x, y, width, height } = mainWindow.getBounds()
      setWindowBounds({ x, y, width, height })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Push maximize/unmaximize events to renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('electron:window-maximized')
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('electron:window-unmaximized')
  })

  // 窗口获得焦点时确保焦点传递到 webContents，支持屏幕阅读器正确工作
  mainWindow.on('focus', () => {
    mainWindow?.webContents.focus()
  })
}

/**
 * App event: when app is ready
 */
app.whenReady().then(() => {
  // 确保 Chromium a11y tree 始终激活（供屏幕阅读器使用）
  app.setAccessibilitySupportEnabled(true)

  registerAppProtocol()

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' app:; " +
          "script-src 'self' 'unsafe-inline' app:; " +
          "style-src 'self' 'unsafe-inline' app:; " +
          "img-src 'self' app: data: blob:; " +
          "font-src 'self' app: data:; " +
          "connect-src 'self' app: ws: wss: http: https:; " +
          "worker-src 'self' blob:;"
        ],
      },
    })
  })

  registerIpcHandlers()
  createWindow()
})

/**
 * App event: when all windows are closed (non-macOS behavior)
 */
app.on('window-all-closed', () => {
  // On macOS, applications typically stay open until the user quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * App event: when app is activated (macOS)
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

registerAppScheme()

```

### Core Architecture Module: `dashboard/electron/main/protocol.ts`
```
import { net, protocol } from 'electron'
import { readFile } from 'fs/promises'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'

import { getActiveBackend } from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
}

function shouldProxyToBackend(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname === '/maibot_statistics.html'
}

export function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (shouldProxyToBackend(pathname)) {
      const backend = getActiveBackend()
      const targetUrl = backend
        ? `${backend.url.replace(/\/$/, '')}${pathname}${url.search}`
        : null

      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'No backend configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const headers = new Headers(request.headers)
      headers.delete('host')

      return net.fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        duplex: 'half',
      })
    }

    // Dev mode: renderer is served by vite dev server, not app:// protocol
    if (process.env.ELECTRON_RENDERER_URL) {
      return new Response(null, { status: 204 })
    }

    const rendererDir = join(__dirname, '../renderer')
    const safePath = decodeURIComponent(pathname)
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')

    const resolvedPath = safePath === '' ? 'index.html' : safePath
    const filePath = resolvedPath.endsWith('/')
      ? join(rendererDir, resolvedPath, 'index.html')
      : join(rendererDir, resolvedPath)

    const tryReadFile = async (path: string) => {
      const ext = extname(path)
      const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
      const data = await readFile(path)
      return new Response(data, { headers: { 'Content-Type': mimeType } })
    }

    try {
      return await tryReadFile(filePath)
    } catch {
      const indexPath = join(rendererDir, 'index.html')
      return tryReadFile(indexPath)
    }
  })
}

```

### Core Architecture Module: `dashboard/electron/main/store.ts`
```
import { randomUUID } from 'crypto'

import Store, { type Schema } from 'electron-store'

/**
 * Backend connection data model
 */
export interface BackendConnection {
  id: string
  name: string
  url: string
  isDefault: boolean
  lastConnected?: number
}

/**
 * Application settings data model
 */
export interface AppSettings {
  backends: BackendConnection[]
  activeBackendId: string | null
  windowBounds: {
    x: number
    y: number
    width: number
    height: number
  }
  firstLaunchComplete: boolean
}

/**
 * JSON Schema for validating store contents
 */
const SCHEMA: Schema<AppSettings> = {
  backends: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string' },
        isDefault: { type: 'boolean' },
        lastConnected: { type: 'number' },
      },
      required: ['id', 'name', 'url', 'isDefault'],
    },
  },
  activeBackendId: { type: ['string', 'null'] },
  windowBounds: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
    },
    required: ['x', 'y', 'width', 'height'],
  },
  firstLaunchComplete: { type: 'boolean' },
}

/**
 * Default settings
 */
const DEFAULTS: AppSettings = {
  backends: [],
  activeBackendId: null,
  windowBounds: {
    x: 100,
    y: 100,
    width: 1280,
    height: 800,
  },
  firstLaunchComplete: false,
}

/**
 * Initialize electron-store with encryption and schema validation
 */
const store = new Store<AppSettings>({
  schema: SCHEMA,
  defaults: DEFAULTS,
  encryptionKey: process.env.MAIBOT_STORE_KEY,
})

/**
 * Get all backends
 */
export function getBackends(): BackendConnection[] {
  return store.get('backends', [])
}

/**
 * Add a new backend connection
 * Generates UUID for new backend
 */
export function addBackend(
  conn: Omit<BackendConnection, 'id'>,
): BackendConnection {
  const newBackend: BackendConnection = {
    ...conn,
    id: randomUUID(),
  }

  const backends = getBackends()
  backends.push(newBackend)
  store.set('backends', backends)

  return newBackend
}

/**
 * Update an existing backend connection
 */
export function updateBackend(
  id: string,
  patch: Partial<Omit<BackendConnection, 'id'>>,
): void {
  const backends = getBackends()
  const index = backends.findIndex((b) => b.id === id)

  if (index === -1) {
    throw new Error(`Backend with id ${id} not found`)
  }

  backends[index] = {
    ...backends[index],
    ...patch,
  }

  store.set('backends', backends)
}

/**
 * Remove a backend connection by id
 */
export function removeBackend(id: string): void {
  const backends = getBackends()
  const filtered = backends.filter((b) => b.id !== id)

  store.set('backends', filtered)

  // Clear active backend if it was the removed one
  if (store.get('activeBackendId') === id) {
    store.set('activeBackendId', null)
  }
}

/**
 * Set the active backend
 */
export function setActiveBackend(id: string): void {
  const backends = getBackends()

  if (!backends.find((b) => b.id === id)) {
    throw new Error(`Backend with id ${id} not found`)
  }

  store.set('activeBackendId', id)
}

/**
 * Get the currently active backend connection
 */
export function getActiveBackend(): BackendConnection | null {
  const activeId = store.get('activeBackendId')

  if (!activeId) {
    return null
  }

  const backends = getBackends()
  return backends.find((b) => b.id === activeId) || null
}

/**
 * Get window bounds
 */
export function getWindowBounds(): AppSettings['windowBounds'] {
  return store.get('windowBounds', DEFAULTS.windowBounds)
}

/**
 * Set window bounds
 */
export function setWindowBounds(bounds: AppSettings['windowBounds']): void {
  store.set('windowBounds', bounds)
}

/**
 * Check if this is the first launch
 */
export function isFirstLaunch(): boolean {
  return !store.get('firstLaunchComplete', false)
}

/**
 * Mark first launch as complete
 */
export function markFirstLaunchComplete(): void {
  store.set('firstLaunchComplete', true)
}

/**
 * Get complete app settings
 */
export function getSettings(): AppSettings {
  return {
    backends: getBackends(),
    activeBackendId: store.get('activeBackendId', null),
    windowBounds: getWindowBounds(),
    firstLaunchComplete: store.get('firstLaunchComplete', false),
  }
}

```

### Core Architecture Module: `dashboard/electron/preload/index.ts`
```
import { contextBridge, ipcRenderer } from 'electron'

// Write __RUNTIME__ tag into the isolated world so renderer can detect Electron
contextBridge.exposeInMainWorld('__RUNTIME__', {
  kind: 'electron' as const,
  versions: process.versions as unknown as Record<string, string>,
  source: 'tag' as const,
})

// Expose the full ElectronAPI surface to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Platform detection ──────────────────────────────────────────────────
  getPlatform: () => process.platform,

  // ── Window control ──────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.invoke('electron:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('electron:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('electron:close-window'),
  isMaximized: () => ipcRenderer.invoke('electron:is-maximized'),

  // ── Window event listeners ───────────────────────────────────────────────
  onWindowMaximized: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('electron:window-maximized', listener)
    return () => ipcRenderer.removeListener('electron:window-maximized', listener)
  },
  onWindowUnmaximized: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('electron:window-unmaximized', listener)
    return () => ipcRenderer.removeListener('electron:window-unmaximized', listener)
  },

  // ── Backend CRUD ─────────────────────────────────────────────────────────
  getBackends: () => ipcRenderer.invoke('electron:get-backends'),
  addBackend: (conn: object) => ipcRenderer.invoke('electron:add-backend', conn),
  updateBackend: (id: string, patch: object) =>
    ipcRenderer.invoke('electron:update-backend', id, patch),
  removeBackend: (id: string) => ipcRenderer.invoke('electron:remove-backend', id),
  setActiveBackend: (id: string) =>
    ipcRenderer.invoke('electron:set-active-backend', id),
  getActiveBackend: () => ipcRenderer.invoke('electron:get-active-backend'),
  getActiveBackendUrl: () => ipcRenderer.invoke('electron:get-active-url'),

  // ── App state ───────────────────────────────────────────────────────────
  isFirstLaunch: () => ipcRenderer.invoke('electron:is-first-launch'),
  markFirstLaunchComplete: () =>
    ipcRenderer.invoke('electron:mark-first-launch-complete'),
  getAppVersion: () => ipcRenderer.invoke('electron:get-app-version'),

  // ── Backend event listener ──────────────────────────────────────────────
  onBackendChanged: (callback: (backend: { id: string; name: string; url: string; isDefault: boolean; lastConnected?: number } | null) => void) => {
    const listener = (_event: unknown, backend: { id: string; name: string; url: string; isDefault: boolean; lastConnected?: number } | null) => callback(backend)
    ipcRenderer.on('electron:backend-changed', listener)
    return () => ipcRenderer.removeListener('electron:backend-changed', listener)
  },
})

```

### Core Architecture Module: `dashboard/eslint.config.js`
```
import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 构建产物与依赖目录不参与检查：coverage 是 v8 覆盖率报告的产物目录，
  // 其中的 HTML/JS 资源会被误当作源码扫描并产生无意义告警
  { ignores: ['coverage', 'dist', 'dist-electron', 'node_modules', 'out'] },
  jsxA11y.flatConfigs.recommended,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // 将所有 React Hooks 推荐规则降级为警告
      ...Object.keys(reactHooks.configs.recommended.rules).reduce((acc, key) => {
        acc[key] = 'warn'
        return acc
      }, {}),
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 关闭或降级其他规则
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许以下划线前缀显式标记的未使用变量/参数/捕获错误（代码中已有 _storageKey/_legacyMemory 等约定）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // jsx-a11y: 降级为 warn 避免阻塞构建，后续 Task 17 逐步修复
      'jsx-a11y/anchor-ambiguous-text': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      // Ambient global declarations use `var` in TypeScript declaration files.
      'no-var': 'off',
    },
  }
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2056** (2026-09-23): **[BUG] 回复后处理时，bot回复分割后重新硬拼接导致丢标点**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.5  ### 遇到的问题  bot 偶发把回复发成“多句粘连、句与句之间既无标点也无空格”的一条消息，读起来是一整坨字。 部署时群友反馈“说话不断句，不打标点符号”。 回复较短时无此现象，回复越长、逗号越多越容易触发。  ### 报错信息  无日志报错，属于行为缺陷，程序运行无异常。  ### 如何重现此问题？  1. 保持 `response_splitter` 默认配置（`enable=true`、`max_split_num=3`）。 2. 诱导 bot 生成一个含 4 个及以上逗号分句的回复（问一个开放性问题即可，如「你今天都做了什么呀？」）。 3. 观察实际发出的消息。  期望（设计意图）：4+ 条消息，每条一个短句，句间无标点。  实际（bug）：  原始回复： > 今天去上课了，然后回来睡觉，睡醒吃了饭，现在有点无聊，你呢？  分段后（5 段，去标点）： > ['今天去上课了', '然后回来睡觉', '睡醒吃了饭', '现在有点无聊', '你呢？']  压缩为 max_split_num=3 条后实际发出： > 消息1：今天去上课了然后回来睡觉 > 消息2：睡醒吃了饭现在有点无聊 > 消息3：你呢？  前两条内部多句粘连，无标点、无空格。  ### 可能造成问题的原因  两个环节组合（文件 `src/chat/utils/utils.py`，行号基于 1.2.5 / main 与 dev 一致）：  1. `split_into_sentences_w_remove_punctuation`（L279）：    - 按 `，,。; 空格 换行` 分割为 `(内容, 分隔符)` 元组；    - 相邻段**概率合并**时保留分隔符（L434 `current_content + current_sep + next_content`）；    - 但未合并的段在提取结果时只保留内容（L446），**分隔符信息在此永久丢失**。  2. `_merge_processed_segments_to_max_count`（L481-523）：    - 分段数超过 `max_split_num` 时均匀分组压缩；    - L518 用 `"".join(segment.text for segment in group)` 硬拼接——      由于第 1 步已丢失分隔符，拼接处无法恢复任何标点或空格。  即：分段函数丢弃分隔符时隐含「各段将独立发送」的假设，而压缩函数在违背该假设拼接时没有任何补偿。  旧链路中的 `merge_sentences_to_max_count`（L462-478，同样 `"".join` 硬拼接）也存在相同问题（当前 main/dev 未见调用，顺带提请确认）。  ### 修复思路（供参考）  1. 分隔符随段传递（如 `ProcessedResponseSegment` 增加 `separator` 字段），压缩拼接时补回：逗号→空格或原样保留，即「未被拆开的句子之间保留停顿」； 2. 或退一步：拼接处至少插入一个空格； 3. 或放宽/动态化 `max_split_num`，减少触发拼接的场景。  具体取舍涉及拟人化风格与防刷屏的平衡，交由维护者
  **Post-Mortem & Fix Analysis**:
  > 本issue提到的问题已于 3a3c356 修复，故关闭。感谢修复。

- **Issue #2034** (2026-09-15): **docker最新镜像里面是旧的core**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  latest  ### 遇到的问题  docker最新镜像里面是旧的core 我已硬性清空浏览器缓存  <img width="1709" height="678" alt="Image" src="https://github.com/user-attachments/assets/828df418-b479-42d3-9efc-8488ef6142dd" />  <img width="332" height="117" alt="Image" src="https://github.com/user-attachments/assets/e2a042bd-dee7-4055-870f-1cefda160cfd" />   ### 报错信息  docker最新镜像里面是旧的core  ### 如何重现此问题？  _No response_  ### 可能造成问题的原因  _No response_  ### 系统环境  docker  ### Python 版本  docker  ### 补充信息  _No response_
  **Post-Mortem & Fix Analysis**:
  > I'll work on this. Could you assign it to me?  I'll fix the docs to match the current code and add a short note so this does not rot again. 
  > I am still working on this. I will update the documentation to reflect the current code. Let me know if there are any specific areas you want me to focus on. 
  > I am making progress on updating the documentation. If there are any particular sections you think need more attention, please let me know. 

- **Issue #2031** (2026-09-13): **[bug] llm.generate 的 model_name 参数被 host 端吞入任务名解析，无法按模型名直达调用**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.3  ### 遇到的问题  在编写插件时，插件通过 `llm.generate(prompt, model_name="<某模型名>")` 计划按model_config.toml中已配置的指定模型名直达调用（绕过任务选择策略），但请求抛 `ValueError: 未找到名为 '<模型名>' 的模型配置`。  ### 报错信息  ValueError: 未找到名为 '<模型名>' 的模型配置  ### 如何重现此问题？  ```python # 插件内 await ctx.llm.generate("hi", model="<任意已注册模型名>")  # 期望按模型名直达，实际 ValueError ```  ### 可能造成问题的原因  - host 端 `src/plugin_runtime/capabilities/core.py:575`（`_cap_llm_generate`）：    ```python   task_name = llm_api.resolve_task_name(str(args.get("model", "") or args.get("model_name", "")))   ```    将 `model_name` 一并喂给 `resolve_task_name`（只认任务名，service_task_resolver.py:37-59），且构造 `LLMServiceRequest` 时**未传入 `model_name` 字段**。  - 服务层 `src/common/data_models/llm_service_data_models.py:48`：`LLMServiceRequest` 已有 `model_name: str | None` 字段； - 底层 `src/llm_models/utils_model.py:785-802`：`requested_model_name = str(model_name or "")` 非空时**直接选中该模型**，绕过选择策略——能力已实现。  **结论**：`model_name` 的底层能力与字段均存在，但 host RPC 通道在 `_cap_llm_generate` / `_cap_llm_generate_with_tools` 两处未透传，属于"接口有、管道缺"的断链。非设计意图（服务层注释明文支持指定模型）。  ### 系统环境  Alibaba Cloud Linux 3 (x86_64)，使用Docker部署  ### Python 版本  Python 3.13.15  ### 补充信息  建议修复方式（两处各加一行，向后兼容）： ```python # capabilities/core.py，_cap_llm_generate 与 _cap_llm_generate_with_tools 中 result = await llm_api.generate(     llm_api.LLMServiceRequest(         task_name=task_name,         request_type=f"plugin.{plugin_id}",   
  **Post-Mortem & Fix Analysis**:
  > I will take this issue. Please assign it to me.  The problem seems to be in `src/plugin_runtime/capabilities/core.py` at line 575. The `model_name` parameter is not being passed correctly to the `LLMServiceRequest`. I would first inspect the `_cap_llm_generate` function to confirm that `model_name` is indeed missing in the request construction. The fix would involve adding `model_name=args.get("model_name")` to the `LLMServiceRequest` call. This should allow the model name to be used directly as intended. I will test this change to ensure it resolves the `ValueError`. 
  > Thanks for picking this up. I verified the full call chain against `main` first — the change as proposed won't fix the reported `ValueError`, so I'd rather flag it before a patch is written.  ## 1. The exception is raised *before* the line you'd modify  `resolve_task_name()` raises for any name that isn't a key of `model_task_config`:  `src/services/service_task_resolver.py:58` ```python raise ValueError(f"未找到名为 `{normalized_task_name}` 的模型配置") ```  In `_cap_llm_generate` that happens on **line 575**, while the `LLMServiceRequest` constructor is on 577–583:  ```python 575: task_name = llm_api.resolve_task_name(str(args.get("model", "") or args.get("model_name", ""))) 576: result = await llm_api.generate( 577:     llm_api.LLMServiceRequest( 578:         task_name=task_name, ... 583:     ) 584: ) ```  So the `ValueError` fires on 575 and is caught by the `except Exception` on 586, returning `{"success": False, ...}`. Adding `model_name=` inside the constructor on 577–583 is unreachable i
  > 此 issue 所提及的bug已于提交 008019c2 修复，请在确认后关闭此 issue 。

- **Issue #2029** (2026-09-15): **【BUG】query_memory 工具的时间参数仅接受 YYYY/MM/DD，LLM 按通用 ISO 格式 YYYY-MM-DD 传参必然报错，且工具声明未说明任何格式要求**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  v1.2.3  ### 遇到的问题  Maisaka 内置工具 `query_memory`（长期记忆检索）收到模型（deepseek-v4-flash-vision-exp）传入的 `time_start: "2026-08-31"`、`time_end: "2026-09-01"`（`mode=time`）时，工具执行直接失败，报「时间参数错误: 时间格式错误: 2026-08-31。仅支持 YYYY/MM/DD 或 YYYY/MM/DD HH:mm」。  工具声明（`get_tool_spec`）中 `time_start`/`time_end` 的描述仅为「起始时间。」「结束时间。」，没有格式要求、没有示例，模型按全球通用的 ISO 8601 连字符格式传参是完全合理的行为，却必然触发失败，导致 `mode=time` 的时间段检索完全不可用（每次调用必失败，模型只能在重试时靠错误信息猜格式）。  ### 报错信息  ``` 执行结果 - query_memory [推理中调用] [失败]: "时间参数错误: 时间格式错误: 2026-08-31。仅支持 YYYY/MM/DD 或 YYYY/MM/DD HH:mm" ```  <img width="2123" height="308" alt="Image" src="https://github.com/user-attachments/assets/565dd188-8b70-428b-bc0d-3024bc184e87" />  结构性结果（structured_content）关键字段：  ```json {   "success": false,   "query": "最近讨论",   "mode": "time",   "time_start": "2026-08-31",   "time_end": "2026-09-01",   "error": "时间参数错误: 时间格式错误: 2026-08-31。仅支持 YYYY/MM/DD 或 YYYY/MM/DD HH:mm" } ```  ### 如何重现此问题？  1. 启用 A_Memorix 长期记忆与 `query_memory` 内置工具； 2. 在 `mode=time` 下调用工具并传入 `time_start="2026-08-31"`（连字符格式，任意合法日期均可）； 3. 工具返回失败，错误为「时间格式错误: 2026-08-31。仅支持 YYYY/MM/DD 或 YYYY/MM/DD HH:mm」。  把 `time_start` 改为 `2026/08/31`（斜杠格式）即可成功，证明问题只与格式白名单有关。  ### 可能造成问题的原因  这是「工具声明契约」与「底层解析实现」不一致导致的：  1. **工具声明侧（`src/maisaka/builtin_tool/query_memory.py` L49-56）**：`time_start`/`time_end` 只有 `type: string` 与一句描述，未声明支持的格式，也没有 `format`/`pattern`/`examples`； 2. **参数归一化侧（`query_memor
  **Post-Mortem & Fix Analysis**:
  > 补充一点，观察到LLM调用query_memory时，如果因为时间参数格式错误连续失败两次，会重新丢给planner处理，但这个时候会触发另外一个问题——planner获得的提示词不包含群聊上下文，这使得planner会胡乱回复“请问有什么事吗”或者选择继续wait
  > > planner获得的提示词不包含群聊上下文  这指的是什么情况？
  >  指的是当问题出现时，planner只拿到了系统提示词，而没有群聊内容，planner会返回说“当前上下文中没有展示具体的群聊消息内容，也没有任何群友发言可供xx回应。” 我在下面提供了出错时的planner返回结果，以及导出json日志（planner返回在352行） <img width="1655" height="117" alt="Image" src="https://github.com/user-attachments/assets/e41d5a4e-159d-4f9b-a035-9ef8d9088d93" />  [reasoning-planner-匿名.json](https://github.com/user-attachments/files/32155781/reasoning-planner-.json)    > > planner获得的提示词不包含群聊上下文 >  > 这指的是什么情况？  

- **Issue #2024** (2026-09-01): **[Bug] OpenAI GPT-5.6 Responses API 无法使用：请求始终携带不支持的 temperature 参数**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.3 Docker image: sengokucola/maibot:latest Image ID: sha256:f4afec6ac4a8c77d8642827f930d38a73aa4c2254be3ad0878e10b96ea4b0359 创建时间: 2026-08-23T08:34:33.173271851Z Digest: ["sengokucola/maibot@sha256:79bb84671a617ba11327c910f847348490573e39bc06f50a528e2b1ca185d129"]  ### 遇到的问题  OpenAI GPT-5.6 系列模型无法在 MaiBot 中正常使用。  在 Responses API 下，MaiBot 当前请求始终携带 temperature 参数，而 GPT-5.6 模型不支持该参数，因此 API 始终返回 HTTP 400： Error code: 400 - {'error': {'message': "Unsupported parameter: 'temperature' is not supported with this model.", 'type': 'invalid_request_error', 'param': 'temperature', 'code': None}}  在 Chat Completions API 下，GPT-5.6 的 reasoning_effort 与函数工具组合也存在限制： 当启用函数工具并设置 reasoning_effort=low 时，API 返回： rror code: 400 - {'error': {'message': "Function tools with reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.", 'type': 'invalid_request_error', 'param': 'reasoning_effort', 'code': None}}  目前 MaiBot 没有提供跳过 temperature 参数的配置方式，因此无法使用 Responses API 的 reasoning.effort=low；而 Chat Completions 路径也无法满足 工具调用和低推理强度同时启用的需求。 ### 报错信息  08-30 17:17:28 [WebUI] 模型测试失败: model=gpt-5.6-luna-low, error=参数不正确 Traceback (most recent call last):   File "/MaiMBot/src/llm_models/model_client/openai_responses_client.py", line 739, in get_response     raw_response = await await_task_w
  **Post-Mortem & Fix Analysis**:
  > 已经在dev分支实现 关闭传递temperature功能，将在1.2.4更新

- **Issue #1995** (2026-08-20): **[BUG] WebUI 命令管理保存“仅为此命令放行用户”后写出非法 TOML，导致主配置无法读取**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  1.2.0（Docker 镜像：sengokucola/maibot:latest）  ### 遇到的问题  在 WebUI 的「麦麦设置 → 命令管理」中，为受保护命令配置“仅为此命令放行用户”并保存后，WebUI 会把 `bot_config.toml` 写成非法 TOML。  以 `/clear`（`core.clear`）为例，在“仅为此命令放行用户”中填写多个用户 ID，例如：  ```text qq:111111111, qq:222222222 ```  点击保存后，`bot_config.toml` 中的 `plugin.command_permissions` 被写成类似下面的内容：  ```toml command_permissions = {"core.clear" = allow_users = [     "qq:111111111",     "qq:222222222", ] allow_chats = [] } ```  其中 `"core.clear" = allow_users = [...]` 不是合法 TOML：命令名等号右侧应是一个对象值，而不是继续直接写 `allow_users =`。  配置文件因此无法解析。之后 WebUI 重新加载配置失败，并在前端错误页显示“核心设置缺少 bot 配置节”；但 `[bot]` 节实际仍存在，真正原因是整份 TOML 已无法解析。  期望 WebUI 保存后生成合法结构，例如：  ```toml command_permissions = { "core.clear" = { allow_users = ["qq:111111111", "qq:222222222"], allow_chats = [] } } ```  ### 报错信息  <img width="514" height="554" alt="Image" src="https://github.com/user-attachments/assets/35cb2d71-eb8e-43b1-9b2f-a51d56000f1e" />  ```text [config] 检测到配置文件变更，触发热重载 [webui] 读取配置文件失败: Unexpected character: 'a' at line 500 col 64 [config] 配置重载失败: Unexpected character: 'a' at line 500 col 64 ```  前端错误页显示：  ```text Error: 核心设置缺少 bot 配置节 ```  ### 如何重现此问题？  1. 使用 Docker 启动 MaiBot，并进入 WebUI。 2. 打开「麦麦设置 → 命令管理」。 3. 选择受保护命令 `/clear`。 4. 在“仅为此命令放行用户”输入多个用户 ID，例如：     ```text    qq:111111111, qq:222222222    ```  5. 点击右上角保存。 6. WebUI 随后报“核心设置缺少 bot 配置节”或无法再读取配置。 7. 检查 `docker-config/mmc/bot_config.to

- **Issue #1993** (2026-08-23): **规划器提示词bug**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [ ] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  maibot版本：1.2.0  ### 遇到的问题  老大，目前的规划器提示词maisaka_chat.prompt容易造成模型混乱，比如：minimax-m3偶尔生成自然语言文本回复且不调用reply工具、以及使用自然语言调用工具，导致规划分析和实际回复不一致；另外deepseek也有极少概率出现。以下是我自己修改提示词的地方。  <img width="1363" height="747" alt="Image" src="https://github.com/user-attachments/assets/fb12380f-a910-457e-b6f5-76f0805e81b5" />  ### 报错信息  希望能增强提示词边界  ### 如何重现此问题？  _No response_  ### 可能造成问题的原因  _No response_  ### 系统环境  Windows 11 专业版、25H2、26200.9168  ### Python 版本  Python 3.12.10 (64-bit)  ### 补充信息  _No response_

- **Issue #1992** (2026-08-20): **[BUG] 经 NewAPI 反代调用火山方舟 Responses API 时，Planner 尾部 assistant 与非 Prefill 模型不兼容**
  *Symptoms*: ### 检查项  - [x] 我确认此问题在所有分支的最新版本中依旧存在 - [x] 我确认在 Issues 列表中并无其他人已经提出过与此问题相同或相似的问题 - [x] 我使用了 Docker  ### 使用的分支  main  ### 具体版本号  MaiBot 1.2.0（同时核对了最新 dev，相关 Planner 和 Responses 请求构造代码与 main 一致）  ### 遇到的问题  当前部署通过 NewAPI 反向代理调用火山方舟，完整链路为：  ```text MaiBot   -> NewAPI OpenAI 兼容接口 /v1/responses   -> NewAPI 火山方舟渠道   -> https://ark.cn-beijing.volces.com/api/v3/responses ```  MaiBot 中对应 Provider 使用：  ```toml client_type = "openai_responses" base_url = "http://127.0.0.1:3000/v1" ```  Planner 使用的火山方舟模型为：  ```text glm-5-2-260617 ```  Maisaka 在构造 `planner` 请求时，会在正常 user 输入后固定追加一条 `AssistantMessageItem`，用于引导 Planner 的输出方向。经过 `openai_responses` 客户端序列化后，请求最后一项类似：  ```json {   "role": "assistant",   "content": "我需要分析 <bot_name> 收到的最新消息，并判断是否需要调用工具" } ```  MaiBot 原始请求中没有 `partial` 字段。  火山方舟 Responses API 将“最后一条 assistant 消息”用于 Prefill/续写场景。对于不支持 Prefill 的 `glm-5-2-260617`：  - 原样转发末尾 assistant 时，火山方舟拒绝该请求； - 为该 assistant 添加 `partial: true` 时，火山方舟同样拒绝请求，因为该模型不支持 Prefill。  因此，问题并不是 NewAPI 无法转发 Responses API，而是 MaiBot Planner 固定使用 assistant 尾消息表达输出引导，无法兼容支持 Responses API但不支持 Prefill 的模型。  该问题目前只确认发生在 `request_kind="planner"` 的请求构造路径中，不代表其他 MaiBot LLM 任务也会追加相同尾消息。  ### 报错信息  当末尾 assistant 被标记为 Prefill 时：  ```text BadRequestError: Error code: 400  The parameter `partial` specified in the request are not valid: partial (prefill) is not supported by current model. ```  当 NewAPI 不添加 `partial`、原样转发末尾 assistant 时：  ```text BadRequestError: Error code: 400  The parameter `input[...].role` specified in th
  **Post-Mortem & Fix Analysis**:
  > 为dev加入了模型可配置项 但是考虑到对这种情况特殊替换prompt可能增加不必要的复杂度，目前仅将role替换为user

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

### Incident Patch 1: `4701fae5` (2026-09-28)
**Commit Message**: Update MemoryRecordsTab.tsx

**File**: `dashboard/src/routes/resource/knowledge-base/tabs/MemoryRecordsTab.tsx` (modified, +10/-2)
```diff
@@ -642,8 +642,12 @@ export function MemoryRecordsTab({ onAction, onCorrectionPlan }: MemoryRecordsTa
           className="flex-row flex-wrap items-center space-y-0 gap-x-3 gap-y-1 border-b"
           aria-label="记忆多选操作"
         >
-          <label className="flex cursor-pointer items-center gap-2 text-sm">
+          <label
+            htmlFor="memory-record-select-all"
+            className="flex cursor-pointer items-center gap-2 text-sm"
+          >
             <Checkbox
+              id="memory-record-select-all"
               aria-label="全选当前结果"
               checked={allChecked ? true : checkedRecords.length > 0 ? 'indeterminate' : false}
               disabled={!records.length || searchQuery.isFetching}
@@ -722,8 +726,12 @@ export function MemoryRecordsTab({ onAction, onCorrectionPlan }: MemoryRecordsTa
                       checked && 'border-primary bg-primary/5'
                     )}
                   >
-                    <label className="flex shrink-0 cursor-pointer items-start py-3 pr-1 pl-3">
+                    <label
+                      htmlFor={`memory-record-select-${key}`}
+                      className="flex shrink-0 cursor-pointer items-start py-3 pr-1 pl-3"
+                    >
                       <Checkbox
+                        id={`memory-record-select-${key}`}
                         aria-label={`选择${RECORD_LABELS[record.type]}：${record.title || record.id}`}
                         checked={checked}
                         onCheckedChange={(next) =>
```

---

### Incident Patch 2: `02b25594` (2026-09-27)
**Commit Message**: fix(dashboard): 优化移动端响应式布局细节

首页显示纵向滚动条；日志页移动端标签切换器单独置顶，避免挤压工具栏按钮；
推理过程页移动端筛选栏与详情区高度、宽度、滚动行为调整；统计表格首列在
移动端收窄。

**File**: `dashboard/src/routes/index.tsx` (modified, +1/-1)
```diff
@@ -928,7 +928,7 @@ function IndexPageContent() {
   const versionsMismatch =
     versionCompatibility?.status !== undefined && versionCompatibility.status !== 'compatible'
   return (
-    <ScrollArea className="h-full">
+    <ScrollArea className="h-full" scrollbars="vertical">
       <div data-home-page="true" className="space-y-2 p-4 sm:space-y-4 sm:p-6">
         {dashboardError && (
           <Card className="border-destructive/50 bg-destructive/5">
```

**File**: `dashboard/src/routes/logs.tsx` (modified, +10/-4)
```diff
@@ -1080,7 +1080,7 @@ export function LogViewerPage({ defaultTab }: LogViewerPageProps) {
   }
 
   const renderTabSwitcher = (includeTopbarActions = false, compact = false) => {
-    const labelClassName = includeTopbarActions && compact ? 'sr-only' : undefined
+    const labelClassName = compact ? 'sr-only' : undefined
 
     return (
       <div className="flex min-w-0 items-center gap-2">
@@ -1128,14 +1128,20 @@ export function LogViewerPage({ defaultTab }: LogViewerPageProps) {
       className="flex h-full min-h-0 flex-col overflow-hidden"
     >
       {topbarTabsPortal}
+      {/* 移动端：页签单独置顶并只显示图标，避免挤压下方工具栏按钮 */}
+      <div
+        data-log-viewer-mobile-switcher="true"
+        className="flex shrink-0 items-center border-b px-3 py-1 sm:hidden"
+      >
+        {renderTabSwitcher(false, true)}
+      </div>
       <div
         className={cn(
-          'flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-1 lg:px-4',
+          'flex shrink-0 items-center gap-2 border-b px-3 py-1 lg:px-4',
           ((activeTab === 'reasoning' && !reasoningToolbarVisible) || activeTab === 'statistics') &&
-            'sm:hidden'
+            'hidden'
         )}
       >
-        <div className="sm:hidden">{renderTabSwitcher()}</div>
         <div id={toolbarContainerId} className="flex min-w-0 flex-1 justify-end" />
       </div>
       {showSwitchHint && (
```

**File**: `dashboard/src/routes/reasoning-process.tsx` (modified, +18/-11)
```diff
@@ -1036,7 +1036,7 @@ export function ReasoningProcessPage({
 
     return (
       <>
-        <div className={cn('relative', inToolbar ? 'w-full sm:w-[140px]' : undefined)}>
+        <div className={cn('relative', inToolbar ? 'w-full sm:w-[140px]' : 'w-24 shrink-0')}>
           <Input
             value={actionFilter}
             onChange={(event) => resetToFirstPage(() => setActionFilter(event.target.value))}
@@ -1048,15 +1048,17 @@ export function ReasoningProcessPage({
         <div
           className={cn(
             'relative',
-            inToolbar ? 'min-w-0 flex-[1_1_220px] sm:max-w-[520px] sm:min-w-[260px]' : undefined
+            inToolbar
+              ? 'min-w-0 flex-[1_1_220px] sm:max-w-[520px] sm:min-w-[260px]'
+              : 'min-w-0 flex-1'
           )}
         >
           <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
           <Input
             value={search}
             onChange={(event) => resetToFirstPage(() => setSearch(event.target.value))}
             className={cn(controlClassName, 'pl-9')}
-            placeholder="搜索会话、文件名、模型或记录摘要"
+            placeholder={inToolbar ? '搜索会话、文件名、模型或记录摘要' : '搜索会话、模型或摘要'}
           />
         </div>
       </>
@@ -1280,13 +1282,14 @@ export function ReasoningProcessPage({
       ) : (
         <div
           className={cn(
-            'grid min-h-0 flex-1 grid-cols-1 gap-2 transition-[gap,grid-template-columns] duration-300 ease-out lg:gap-3',
+            // 移动端列表与详情纵向堆叠，整体可上下滚动；桌面端各栏各自滚动
+            'grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto transition-[gap,grid-template-columns] duration-300 ease-out lg:gap-3 lg:overflow-visible',
             replayPanelOpen
-              ? 'lg:grid-cols-[280px_minmax(0,1fr)_420px] xl:grid-cols-[300px_minmax(0,1fr)_460px]'
-              : 'lg:grid-cols-[280px_minmax(0,1fr)]'
+              ? 'lg:grid-cols-[320px_minmax(0,1fr)_420px] xl:grid-cols-[360px_minmax(0,1fr)_460px]'
+              : 'lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]'
           )}
         >
-          <div className="bg-background flex h-[32vh] min-h-[180px] flex-col overflow-hidden rounded-md border transition-[height,min-height,opacity,transform,border-width] duration-300 ease-out lg:h-auto lg:min-h-0 lg:transition-[opacity,transform,border-width]">
+          <div className="bg-background flex h-[50vh] min-h-[320px] flex-col overflow-hidden rounded-md border transition-[height,min-height,opacity,transform,border-width] duration-300 ease-out lg:h-auto lg:min-h-0 lg:transition-[opacity,transform,border-width]">
             <div className="text-muted-foreground flex h-8 flex-shrink-0 items-center justify-between border-b px-2.5 text-xs">
               <span>{total} 条记录</span>
               <span>
@@ -1300,7 +1303,7 @@ export function ReasoningProcessPage({
                   <div className="min-w-0 flex-1">{renderSessionSelect('sidebarRow')}</div>
                   {renderRefreshButton('toolbar')}
                 </div>
-                {renderBrowsingFilters('sidebar')}
+                <div className="flex items-center gap-2">{renderBrowsingFilters('sidebar')}</div>
               </div>
             )}
             <ScrollArea className="min-h-0 flex-1">
@@ -1414,7 +1417,7 @@ export function ReasoningProcessPage({
             </div>
           </div>
 
-          <div className="bg-background flex min-h-0 flex-col overflow-hidden rounded-md border">
+          <div className="bg-background flex h-[calc(100dvh-7rem)] min-h-[360px] flex-col overflow-hidden rounded-md border lg:h-auto lg:min-h-0">
             {replayPanelOpen ? (
               <ReplayItemEditorColumn
                 selectedTitle={selectedTitle}
@@ -1431,8 +1434,12 @@ export function ReasoningProcessPage({
                 className="flex min-h-0 flex-1 flex-col"
               >
                 <div className="relative min-h-0 flex-1 ove
```

**File**: `dashboard/src/routes/statistics/index.tsx` (modified, +6/-2)
```diff
@@ -279,7 +279,10 @@ function BreakdownTable({ rows, locale }: { rows: DetailedStatisticsBreakdown[];
       <Table className="min-w-[1520px]">
         <TableHeader className="bg-muted/60">
           <TableRow>
-            <TableHead className="bg-muted sticky left-0 z-10 min-w-52 font-semibold">
+            <TableHead
+              data-statistics-sticky-cell="true"
+              className="bg-muted sticky left-0 z-10 min-w-32 font-semibold sm:min-w-52"
+            >
               {t('statisticsPage.table.name')}
             </TableHead>
             <TableHead>{t('statisticsPage.table.requests')}</TableHead>
@@ -301,7 +304,8 @@ function BreakdownTable({ rows, locale }: { rows: DetailedStatisticsBreakdown[];
           {rows.map((row) => (
             <TableRow key={row.name}>
               <TableCell
-                className="bg-card sticky left-0 z-10 max-w-64 truncate font-medium"
+                data-statistics-sticky-cell="true"
+                className="bg-card sticky left-0 z-10 max-w-40 truncate font-medium sm:max-w-64"
                 title={row.name}
               >
                 {row.name}
```

---

### Incident Patch 3: `3298d5a6` (2026-09-26)
**Commit Message**: fix: 不再对视觉嵌入fallback

**File**: `pytests/test_utils_model_task_fallback.py` (modified, +9/-8)
```diff
@@ -1,5 +1,7 @@
 from types import SimpleNamespace
 
+import pytest
+
 from src.config.model_configs import TaskConfig
 from src.llm_models import utils_model
 from src.llm_models.utils_model import LLMOrchestrator
@@ -23,16 +25,15 @@ def _resolve_task_config(
     return orchestrator.model_for_task
 
 
-def test_image_embedding_reuses_embedding_task_when_dedicated_task_is_empty(monkeypatch) -> None:
+def test_image_embedding_does_not_reuse_text_embedding_when_dedicated_task_is_empty(monkeypatch) -> None:
     embedding = TaskConfig(model_list=["shared-embedding"], hard_timeout=120.0)
 
-    resolved = _resolve_task_config(
-        monkeypatch,
-        embedding=embedding,
-        image_embedding=TaskConfig(),
-    )
-
-    assert resolved is embedding
+    with pytest.raises(ValueError, match="图片嵌入任务未配置模型"):
+        _resolve_task_config(
+            monkeypatch,
+            embedding=embedding,
+            image_embedding=TaskConfig(),
+        )
 
 
 def test_image_embedding_prefers_dedicated_task_when_configured(monkeypatch) -> None:
```

**File**: `src/config/model_configs.py` (modified, +1/-1)
```diff
@@ -540,4 +540,4 @@ class ModelTaskConfig(ConfigBase):
             "advanced": True,
         },
     )
-    """图片嵌入模型；留空时复用 embedding 任务，所选模型必须实现图片输入到向量的协议"""
+    """图片嵌入模型；留空时不启用图片嵌入，所选模型必须实现图片输入到向量的协议"""
```

**File**: `src/llm_models/utils_model.py` (modified, +2/-1)
```diff
@@ -77,7 +77,6 @@
 MIN_COMPRESSED_IMAGE_TARGET_SIZE_BYTES = 512 * 1024
 EMPTY_TASK_FALLBACKS = {
     "expression_use": "utils",
-    "image_embedding": "embedding",
     "learner": "utils",
     "mid_memory": "planner",
 }
@@ -150,6 +149,8 @@ def _get_task_config_or_raise(self) -> TaskConfig:
                 fallback_task_config = getattr(model_task_config, fallback_task_name, None)
                 if isinstance(fallback_task_config, TaskConfig):
                     return fallback_task_config
+            if self.task_name == "image_embedding":
+                raise ValueError("图片嵌入任务未配置模型，请在 image_embedding 中指定支持图片嵌入的模型")
         return task_config
 
     def _refresh_task_config(self) -> TaskConfig:
```

---

### Incident Patch 4: `bd0a4dfb` (2026-09-26)
**Commit Message**: fix: 无法更换嵌入模型

**File**: `dashboard/src/routes/config/model.tsx` (modified, +2/-10)
```diff
@@ -2352,20 +2352,12 @@ function ModelConfigPageContent() {
       <AlertDialog open={embeddingWarning.isOpen} onOpenChange={embeddingWarning.setOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
-            <AlertDialogTitle className="flex items-center gap-2">
-              <AlertTriangle className="h-5 w-5 text-amber-500" />
-              更换嵌入模型警告
-            </AlertDialogTitle>
+            <AlertDialogTitle className="sr-only">更换嵌入模型警告</AlertDialogTitle>
             <AlertDialogDescription asChild>
               <div className="space-y-3 text-sm">
                 <p>
-                  <strong className="text-foreground">注意：</strong>更换嵌入模型可能会影响知识库的匹配精度！
+                  <strong className="text-foreground">注意：</strong>更换嵌入模型可能需要一定时间来重建记忆和表达库，此过程完全自动，但是需要在后台耗费一定时间
                 </p>
-                <ul className="space-y-2 ml-4 list-disc text-muted-foreground">
-                  <li>不同的嵌入模型会产生不同的向量表示</li>
-                  <li>这可能导致现有知识库的检索结果不准确</li>
-                  <li>建议更换嵌入模型后重新生成所有知识库的向量</li>
-                </ul>
                 <p className="text-foreground font-medium">
                   确定要更换嵌入模型吗？
                 </p>
```

**File**: `dashboard/src/routes/config/model/hooks/useEmbeddingWarning.test.ts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ describe('useEmbeddingWarning', () => {
     expect(applyUpdate).toHaveBeenCalledWith({ field: 'model_list', value: ['new'] })
     expect(toastMock).toHaveBeenCalledWith({
       title: '嵌入模型已选择',
-      description: '配置将在 2 秒后自动保存；保存后建议重新生成知识库向量',
+      description: '配置将在 2 秒后自动保存',
     })
     expect(result.current.isOpen).toBe(false)
 
```

**File**: `dashboard/src/routes/config/model/hooks/useEmbeddingWarning.ts` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ export function useEmbeddingWarning(
       }
       toast({
         title: '嵌入模型已选择',
-        description: '配置将在 2 秒后自动保存；保存后建议重新生成知识库向量',
+        description: '配置将在 2 秒后自动保存',
       })
     },
   })
```

**File**: `pytests/chat_test/test_expression_vector_index.py` (modified, +54/-0)
```diff
@@ -688,6 +688,60 @@ def test_corrupt_generated_index_is_treated_as_missing(tmp_path) -> None:
     assert vector_index._load_snapshot(index_path) is None
 
 
+@pytest.mark.parametrize("changed_field", ["name", "identifier", "provider"])
+@pytest.mark.asyncio
+async def test_embedding_profile_cache_invalidates_when_model_config_changes(tmp_path, monkeypatch, changed_field) -> None:
+    """热切换 embedding 后应立即探测新模型，不再复用旧向量空间标定。"""
+
+    from src.services import embedding_service
+
+    configured_model = {"name": "old-embedding", "identifier": "old-id", "provider": "old-provider"}
+    probe_calls = []
+
+    def get_model_config():
+        model = SimpleNamespace(
+            name=configured_model["name"],
+            model_identifier=configured_model["identifier"],
+            api_provider=configured_model["provider"],
+        )
+        return SimpleNamespace(
+            models=[model],
+            model_task_config=SimpleNamespace(embedding=SimpleNamespace(model_list=[model.name])),
+        )
+
+    class FakeEmbeddingServiceClient:
+        def __init__(self, **_kwargs):
+            pass
+
+        async def embed_texts(self, _texts, **_kwargs):
+            probe_calls.append(configured_model["name"])
+            return [
+                SimpleNamespace(
+                    embedding=embedding,
+                    model_name=configured_model["name"],
+                    model_identifier=configured_model["identifier"],
+                    api_provider=configured_model["provider"],
+                )
+                for embedding in ([1.0, 0.0], [0.0, 1.0], [-1.0, 0.0])
+            ]
+
+    monkeypatch.setattr(vector_index_module.config_manager, "get_model_config", get_model_config)
+    monkeypatch.setattr(embedding_service, "EmbeddingServiceClient", FakeEmbeddingServiceClient)
+    vector_index = ExpressionVectorIndex()
+    index_path = str(tmp_path / "expression_vector_index.json")
+
+    old_profile = await vector_index.get_current_embedding_profile(index_path=index_path)
+    assert await vector_index.get_current_embedding_profile(index_path=index_path) is old_profile
+    assert probe_calls == ["old-embedding"]
+
+    configured_model[changed_field] = f"new-{changed_field}"
+    new_profile = await vector_index.get_current_embedding_profile(index_path=index_path)
+
+    assert new_profile.model_name == configured_model["name"]
+    assert new_profile.marker != old_profile.marker
+    assert probe_calls == ["old-embedding", configured_model["name"]]
+
+
 def test_atomic_write_text_replaces_content_without_leaving_temporary_file(tmp_path) -> None:
     """JSON 索引写入应使用唯一临时文件，并且只暴露完整的新内容。"""
 
```

**File**: `src/chat/replyer/expression_vector_index.py` (modified, +23/-6)
```diff
@@ -17,6 +17,7 @@
 import numpy as np
 
 from src.common.logger import get_logger
+from src.config.config import config_manager
 
 logger = get_logger("expression_vector_index")
 PROJECT_ROOT = Path(__file__).resolve().parents[3]
@@ -565,7 +566,9 @@ def __init__(self) -> None:
         self._snapshot: ExpressionVectorIndexSnapshot | None = None
         self._update_lock = asyncio.Lock()
         self._profile_lock = asyncio.Lock()
-        self._profile_cache: tuple[float, ExpressionEmbeddingProfile] | None = None
+        self._profile_cache: Tuple[
+            float, ExpressionEmbeddingProfile, Tuple[Tuple[str, str, str], ...]
+        ] | None = None
         self._profile_drift_candidate: ExpressionEmbeddingProfile | None = None
         self._profile_drift_confirmations = 0
         self._history_backfill_task: asyncio.Task[None] | None = None
@@ -592,6 +595,18 @@ def _reset_profile_drift_candidate(self) -> None:
         self._profile_drift_candidate = None
         self._profile_drift_confirmations = 0
 
+    @staticmethod
+    def _configured_embedding_identity() -> Tuple[Tuple[str, str, str], ...]:
+        """读取当前 embedding 任务实际配置，用于在热重载后立刻淘汰旧 profile。"""
+
+        model_config = config_manager.get_model_config()
+        models_by_name = {model.name: model for model in model_config.models}
+        identity: List[Tuple[str, str, str]] = []
+        for model_name in model_config.model_task_config.embedding.model_list:
+            model = models_by_name[model_name]
+            identity.append((model.name, model.model_identifier, model.api_provider))
+        return tuple(identity)
+
     def _resolve_embedding_profile_candidate(
         self,
         *,
@@ -655,16 +670,18 @@ async def get_current_embedding_profile(
         """用固定探针解析当前 embedding 后端 profile，并做短时缓存。"""
 
         now = time.monotonic()
+        configured_identity = self._configured_embedding_identity()
         if self._profile_cache is not None:
-            cached_at, cached_profile = self._profile_cache
-            if now - cached_at <= EMBEDDING_PROFILE_CACHE_SECONDS:
+            cached_at, cached_profile, cached_identity = self._profile_cache
+            if cached_identity == configured_identity and now - cached_at <= EMBEDDING_PROFILE_CACHE_SECONDS:
                 return cached_profile
 
         async with self._profile_lock:
             now = time.monotonic()
+            configured_identity = self._configured_embedding_identity()
             if self._profile_cache is not None:
-                cached_at, cached_profile = self._profile_cache
-                if now - cached_at <= EMBEDDING_PROFILE_CACHE_SECONDS:
+                cached_at, cached_profile, cached_identity = self._profile_cache
+                if cached_identity == configured_identity and now - cached_at <= EMBEDDING_PROFILE_CACHE_SECONDS:
                     return cached_profile
 
             from src.services.embedding_service import EmbeddingServiceClient
@@ -685,7 +702,7 @@ async def get_current_embedding_profile(
                 persisted_profile=persisted_profile,
                 candidate_profile=candidate_profile,
             )
-            self._profile_cache = (time.monotonic(), profile)
+            self._profile_cache = (time.monotonic(), profile, configured_identity)
             logger.info(
                 f"表达向量 embedding profile 已标定: marker={profile.marker[:12]} "
                 f"model={profile.model_name} identifier={profile.model_identifier} "
```

---

### Incident Patch 5: `6dd37df8` (2026-09-26)
**Commit Message**: fix: 嵌入模型无法直接更换

**File**: `dashboard/src/routes/config/__tests__/model.test.tsx` (modified, +13/-0)
```diff
@@ -470,6 +470,19 @@ describe('ModelConfigPage 特征化', () => {
   })
 
   describe('embedding 换模型警告', () => {
+    it('确认后应用选中的模型', async () => {
+      const user = userEvent.setup()
+      await renderModelPage()
+      await user.click(screen.getByRole('tab', { name: '功能分配' }))
+      await user.click(await screen.findByText('change-embedding'))
+      expect(await screen.findByText('更换嵌入模型警告')).toBeInTheDocument()
+
+      await user.click(screen.getByRole('button', { name: '确认更换' }))
+      await waitFor(() =>
+        expect(screen.getByTestId('task-models')).toHaveTextContent('new-embed-model')
+      )
+    })
+
     it('取消则不应用变更', async () => {
       const user = userEvent.setup()
       await renderModelPage()
```

**File**: `dashboard/src/routes/config/model.tsx` (modified, +1/-1)
```diff
@@ -2375,7 +2375,7 @@ function ModelConfigPageContent() {
           <AlertDialogFooter>
             <AlertDialogCancel onClick={embeddingWarning.cancel}>取消</AlertDialogCancel>
             <AlertDialogAction
-              onClick={embeddingWarning.confirm}
+              onClick={() => void embeddingWarning.confirm()}
               className="bg-amber-600 hover:bg-amber-700"
             >
               确认更换
```

**File**: `dashboard/src/routes/config/model/hooks/useEmbeddingWarning.test.ts` (modified, +2/-2)
```diff
@@ -79,8 +79,8 @@ describe('useEmbeddingWarning', () => {
 
     expect(applyUpdate).toHaveBeenCalledWith({ field: 'model_list', value: ['new'] })
     expect(toastMock).toHaveBeenCalledWith({
-      title: '嵌入模型已更新',
-      description: '建议重新生成知识库向量以确保最佳匹配精度',
+      title: '嵌入模型已选择',
+      description: '配置将在 2 秒后自动保存；保存后建议重新生成知识库向量',
     })
     expect(result.current.isOpen).toBe(false)
 
```

**File**: `dashboard/src/routes/config/model/hooks/useEmbeddingWarning.ts` (modified, +2/-2)
```diff
@@ -68,8 +68,8 @@ export function useEmbeddingWarning(
         previousEmbeddingModelsRef.current = [...update.value]
       }
       toast({
-        title: '嵌入模型已更新',
-        description: '建议重新生成知识库向量以确保最佳匹配精度',
+        title: '嵌入模型已选择',
+        description: '配置将在 2 秒后自动保存；保存后建议重新生成知识库向量',
       })
     },
   })
```

**File**: `dashboard/src/routes/config/model/hooks/useModelAutoSave.ts` (modified, +7/-2)
```diff
@@ -24,6 +24,8 @@ interface UseModelAutoSaveOptions {
   onSavingChange?: (saving: boolean) => void
   /** 未保存变更回调 */
   onUnsavedChange?: (hasUnsaved: boolean) => void
+  /** 自动保存失败时通知页面 */
+  onSaveError?: (domain: 'models' | 'taskConfig', error: unknown) => void
 }
 
 export interface ModelSaveBarrierCheckpoint {
@@ -78,6 +80,7 @@ export function useModelAutoSave(options: UseModelAutoSaveOptions): UseModelAuto
     debounceMs = 2000,
     onSavingChange,
     onUnsavedChange,
+    onSaveError,
   } = options
 
   const modelsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
@@ -251,6 +254,7 @@ export function useModelAutoSave(options: UseModelAutoSaveOptions): UseModelAuto
           }
         } catch (error) {
           console.error('自动保存模型列表失败:', error)
+          onSaveError?.('models', error)
           if (generation === generationsRef.current.models) {
             setDomainDirty('models', true)
           }
@@ -260,7 +264,7 @@ export function useModelAutoSave(options: UseModelAutoSaveOptions): UseModelAuto
         }
       })
     },
-    [cleanModelForSave, enqueueWrite, setDomainDirty, updateSavingCount]
+    [cleanModelForSave, enqueueWrite, onSaveError, setDomainDirty, updateSavingCount]
   )
 
   const queueTaskConfigSave = useCallback(
@@ -280,6 +284,7 @@ export function useModelAutoSave(options: UseModelAutoSaveOptions): UseModelAuto
           }
         } catch (error) {
           console.error('自动保存任务配置失败:', error)
+          onSaveError?.('taskConfig', error)
           if (generation === generationsRef.current.taskConfig) {
             setDomainDirty('taskConfig', true)
           }
@@ -289,7 +294,7 @@ export function useModelAutoSave(options: UseModelAutoSaveOptions): UseModelAuto
         }
       })
     },
-    [enqueueWrite, setDomainDirty, updateSavingCount]
+    [enqueueWrite, onSaveError, setDomainDirty, updateSavingCount]
   )
 
   // 监听 models 变化。
```

---

### Incident Patch 6: `78acea5c` (2026-09-26)
**Commit Message**: fix: 构建问题

**File**: `changelogs/changelog.md` (modified, +18/-39)
```diff
@@ -1,61 +1,40 @@
 # 更新日志
 
-# [1.3.0] - 2026-9-19
+# [1.3.0] - 2026-9-26
 
-## 主程序
-
-- 修复回复分割数超过 `max_split_num` 被压缩合并回一条消息时丢失分隔符，导致多句粘连成无标点长文本的问题，拼接时补回句间分隔符。
-- 修复统计任务的指标趋势与图表数据全量加载消息实体导致内存周期性暴增的问题，消息查询改为仅投影统计所需的 6 列。
-- 修复 Prompt 缓存统计被计价配置牵连的问题：缓存命中/未命中 token 的展示改由供应商响应行为自动探测（响应中返回缓存用量字段即纳入统计，首次命中后该模型的全部调用计入），与 `cache_price_in` 是否为 0、模型 `cache` 字段彻底解耦；此前把缓存价留空的模型（如 StepFun 系列）即使服务商正常返回缓存用量，统计页也全部显示 0。
-- 缓存命中单价语义调整：`cache_price_in` 为 `0` 现在表示缓存命中免费（此前 0 被隐式当作“与输入价一致”），未命中部分仍按 `price_in` 计费，供应商未返回缓存用量时全部按 `price_in` 计费；配置里显式填写 `0` 的模型如存在缓存命中，费用会相应下降。
+此版本可能需要更新到最新版本的Snowluma适配器以使用，最新版本适配器已合并NapCat适配器，并且需要重新设置黑白名单。
 
-## Maisaka
+## 主程序
 
-- `query_image_memory` 图片记忆查询工具取消 `message_id` 与 `component_path` 的留空兜底，两个参数改为必填，缺参时直接返回明确错误，不再回退到「最近图片」或「消息内第一张图片」。
+- 修复回复分割导致的无标点长文本的问题，拼接时补回句间分隔符。
+- 修复统计任务导致的内存异常问题。
+- 修复 Prompt 缓存统计错误显示的问题，现在会默认填入与输入一致的缓存价格，过往配置可能需要手动更新缓存价格。
+- 插件市场现在支持安装不同版本的插件
+- 优化了对适配器插件的兼容，适配器插件支持直接使用Maibot内置黑白名单
 
 ## Webui [1.7.5]
 
-- 插件市场统一兼容内置和自定义 HTTPS 域名的 Fake-IP 解析，覆盖镜像保存、Raw 下载和 Git 克隆、更新；保留其他私网地址检查及 Git 原有网络行为。
+- 大幅优化 Webui 插件市场的加载速度
 - 优化长期记忆的交互体验
-- 插件市场支持发布版本选择、最新兼容版本推荐和版本锁定；安装前校验固定 commit、manifest 与依赖，切换版本时保留配置数据并备份旧目录。
-- 长期记忆页新增图片记忆管理，可查看图片资产、真实聊天来源、索引状态、认知及关联记忆，并支持历史回填、认知确认与修正、错误关联和出现记录删除。
-- 优化麦麦观察页面的体验，麦麦聊天与麦麦观察的聊天流时间线新增「查找上条」，向上定位并高亮最近一条麦麦自己发送的消息。统计浮层扩展为上下文容量面板，展示最近一轮请求的上下文分段占比、会话累计 token 与平均缓存命中率
-- 聊天流设置弹窗抽为共享组件：麦麦聊天中打开观察聊天流的设置改为页内弹窗直接展示，不再跳转到聊天管理页。
-- 聊天管理详情弹窗：Session ID 与平台、类型、ID 合并为一行；「适配器放行」更名为「适配器规则」并移除冗余说明；已允许聊天的重复提示文案不再展示；适配器路由描述（已/未接入当前聊天、负责收消息发消息）整句移除，仅保留账号信息；适配器被单独放行时不再展示「已允许当前聊天」标签，该状态由高亮的「允许」按钮与放行说明文案表达，选中态「允许」按钮改为绿色（与选中态「阻止」的红色对称）；适配器卡片收紧行距与间距（内边距、网格 gap、行间距、按钮间距整体缩小一档）。
-- 适配器设置：群聊/私聊的麦麦默认策略改为与标题同一行展示，卡片整体移至插件加载情况下方统一编辑，聊天流设置内改为只读一行展示；侧边栏「适配器管理」更名为「适配器设置」。
-- 适配器黑白名单规则页签：群聊与私聊规则改为左右并排，编辑后 2 秒自动保存（与主程序配置页一致，卸载时提交防抖期内草稿），并保留手动保存按钮。
-- 发言频率规则：「新增规则」改为一键写入一条频率 1.0 的全天规则，移除待编辑的预备条，更省空间。
-- 发言频率规则详情：移除无可读意义的优先级数字展示；「生效中」不再使用标签，改为生效规则保持正常字体颜色、未生效规则置灰区分。
-- 发言频率数值统一改为两位小数展示（规则栈、摘要、时间轴滑块与输入框，含 bot 配置页动态发言频率规则），同步将聊天管理弹窗内滑块与输入框步进从 0.001 调整为 0.01，避免展示值与保存值不一致。
-- 表情包管理页筛选区合并为一行（搜索 tag、排序方式、格式、表情包状态）；卡片操作按钮改为悬停时悬浮在图片下方，节省竖向空间。
-- 图片记忆页改版：图片详情改为点击弹窗查看，相似图片检索移入详情弹窗，主页仅保留图片列表与维护区；图片列表占满整行并加高，支持按聊天筛选浏览（列表接口新增 chat_id 过滤与聊天聚合端点）；卡片精简为缩略图加尺寸/大小小字；统计数字改为紧凑展示，移除冗余描述、探测提示文案与状态徽章。
-- 修复模型设置页窗口宽度不足时，模型表格每行右侧的测试、编辑、删除按钮被横向滚动内容推出可视区而无法点击的问题：操作列（含表头「添加」）固定于表格右缘，任何宽度下均可见可点。
-- 模型设置的价格区：填写输入价格时缓存价格自动跟随填入，手动修改（包括清空）后不再跟随；缓存价格留空按输入价格解析并保存，填写 `0` 表示缓存命中免费，两种状态在配置中可区分。
-- 首页新增「资讯」卡片，展示服务器 Markdown 内容源中的新闻动态，与统计概览、Prompt 缓存在同一行并列展示（统计概览默认宽度收窄一档），支持置顶标记、正文 Markdown 阅读、原文链接、手动刷新与失败重试，并可通过编辑模式调整宽度或隐藏。
-- 修复插件市场每个请求都白等数秒的问题：httpx.AsyncClient 每次构造都会重建 3 个 SSLContext 并重新加载整套 CA 证书（实测单次约 5s，且在 async 端点内同步执行会阻塞 WebUI 事件循环）。新增 `src/webui/utils/http_client.py` 将 SSLContext 收敛为进程内共享一份，插件统计代理、Git 镜像源、模型列表获取、AI 搜索文档下载同步改为复用；前端统计摘要改为与市场清单并发请求。实测插件统计接口从约 5s/个降至 0.06s/个，并发 3 个请求时其他端点延迟从约 19s 降至 20ms。
-- 插件详情的统计区域将「最近评价」拆分为「最近评论」与「最近评分」两个分区：有评论内容的条目归入「最近评论」并保留星级（无评分时标注「仅评论」），仅有评分的条目归入「最近评分」，避免纯评分记录挤占评论区。
-- 优化插件安装版本选择的可读性：版本索引把同步工具的 assert 断言 diff 原样写进「未通过校验」列表（如 `Tag 与 manifest.version 不一致 + actual - expected + '1.4.6' - '0.11.0'`），现转换为「Git Tag 1.4.6 与插件清单声明的版本 0.11.0 不一致」「该发布版本把插件 ID 从 A 改成了 B」「该版本对应的 commit（53dbbbd）里找不到插件清单」等可读文案（识别不了的原文取首行透传，不掩盖问题）；版本下拉框中 `Host 版本不兼容: 版本 1.3.0 高于最大支持 1.0.0 (当前 Host: 1.3.0)` 等长原因压缩为「仅支持麦麦 ≤ 1.0.0」「需要 SDK ≥ 2.9.0」等短标签。
-- 插件市场新增「仅显示当前版本」筛选开关，位于筛选栏「显示已安装」左侧，可直接切换并即时生效（偏好写回 localStorage，与插件商店设置页共用），避免用户因老插件全部消失而误以为插件已下架（例如搜索「联网」时只剩支持当前版本的现代插件）。
+- 长期记忆页新增图片记忆管理，可查看图片资产、认知及关联记忆，并支持确认与修正、记录删除。
+- 优化麦麦观察页面的体验，新增「查找上条」。展示上下文分段占比、会话累计 token 与平均缓存命中率。可以在聊天界面直接打开聊天流设置
 
-
-## 插件 SDK/API
+## 调试开发
 
 - 新增「强制插件兼容」调试开关。
+- 插件市场修复 Fake-IP 解析。
 
-## A_Memorix
+## 记忆
 
-- 修复启动时图片资产核对阻塞主循环、导致插件 Runner 握手超时的问题；核对改由工作线程执行，完成后才开放记忆，关机和重载时等待核对结束再释放资源。
-- 新增图片记忆功能，需要配置图片嵌入模型。新增静态图片资产、出现记录、图片认知和独立视觉向量池，支持精确同图、视觉相似匹配及关联段落、实体、关系和Episode召回。支持纯图片和混合包、图片向量兼容复用或本地重建、逐成员流式校验、失败清理和共享图片安全卸载。
+- 新增图片记忆功能，需要配置图片嵌入模型。新增图片独立视觉向量池，支持多种方式查询图片记忆。
 - 新增 `.amembundle` 导出、校验和无 LLM 安装能力，支持 LPMM 同语义知识包与包含人物画像、Episode、事实账本、外部引用和生命周期
```

**File**: `dashboard/vite.config.ts` (modified, +2/-91)
```diff
@@ -65,97 +65,8 @@ export default defineConfig({
     include: ['react', 'react-dom'],
   },
   build: {
-    rollupOptions: {
-      output: {
-        manualChunks: {
-          // React 核心库
-          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
-          
-          // TanStack Router
-          'router': ['@tanstack/react-router', '@tanstack/react-virtual'],
-          
-          // Radix UI 组件库
-          radix: [
-            '@radix-ui/react-dialog',
-            '@radix-ui/react-select',
-            '@radix-ui/react-checkbox',
-            '@radix-ui/react-label',
-            '@radix-ui/react-slot',
-            '@radix-ui/react-toast',
-            '@radix-ui/react-tooltip',
-            '@radix-ui/react-alert-dialog',
-            '@radix-ui/react-avatar',
-            '@radix-ui/react-collapsible',
-            '@radix-ui/react-context-menu',
-            '@radix-ui/react-popover',
-            '@radix-ui/react-progress',
-            '@radix-ui/react-scroll-area',
-            '@radix-ui/react-separator',
-            '@radix-ui/react-slider',
-            '@radix-ui/react-switch',
-            '@radix-ui/react-tabs',
-          ],
-          
-          // 图标库
-          'icons': ['lucide-react'],
-          
-          // 图表库
-          'charts': ['recharts'],
-          
-          // CodeMirror 编辑器（较大，单独分包）
-          'codemirror': [
-            '@uiw/react-codemirror',
-            '@codemirror/lang-javascript',
-            '@codemirror/lang-json',
-            '@codemirror/lang-python',
-            '@codemirror/lint',
-            '@codemirror/theme-one-dark',
-          ],
-          
-          // ReactFlow 流程图（较大，单独分包）
-          'reactflow': ['reactflow', 'dagre'],
-          
-          // Markdown 渲染（较大，单独分包）
-          'markdown': [
-            'react-markdown',
-            'remark-gfm',
-            'remark-math',
-            'rehype-katex',
-            'katex',
-          ],
-          
-          // 文件上传（Uppy）
-          'uppy': [
-            '@uppy/core',
-            '@uppy/dashboard',
-            '@uppy/react',
-            '@uppy/xhr-upload',
-          ],
-          
-          // 拖拽功能
-          'dnd': [
-            '@dnd-kit/core',
-            '@dnd-kit/sortable',
-            '@dnd-kit/utilities',
-          ],
-          
-          // 工具库
-          'utils': [
-            'date-fns',
-            'clsx',
-            'tailwind-merge',
-            'class-variance-authority',
-          ],
-          
-          // 其他
-          'misc': [
-            'react-joyride',
-            'react-day-picker',
-            'cmdk',
-          ],
-        },
-      },
-    },
+    // 让 Rollup 按实际依赖关系分包，避免手动拆分的 Router/Radix 包互相导入，
+    // 导致生产版在 React 初始化前访问 forwardRef 而白屏。
     chunkSizeWarningLimit: 500, // 降低警告阈值，便于发现大块
   },
 })
```

---

### Incident Patch 7: `6845aafa` (2026-09-26)
**Commit Message**: fix: 模型页面和供应商问题

**File**: `dashboard/src/index.css` (modified, +34/-4)
```diff
@@ -1573,14 +1573,34 @@
   box-shadow: none !important;
 }
 
+/* 未选中为描边凹陷方块，选中/半选才填充锈红，避免未选中看起来像已选中 */
 :root[data-dashboard-style='future-retro'] [data-dashboard-checkbox='true'] {
-  border: 0 !important;
+  border: var(--retro-stroke) solid var(--retro-line) !important;
   border-radius: 0 !important;
-  background: var(--retro-rust) !important;
+  background: var(--retro-recessed) !important;
   box-shadow: none !important;
   color: var(--retro-paper) !important;
 }
 
+:root[data-dashboard-style='future-retro']
+  [data-dashboard-checkbox='true']:is([data-state='checked'], [data-state='indeterminate']) {
+  border-color: var(--retro-rust) !important;
+  background: var(--retro-rust) !important;
+}
+
+:root[data-dashboard-style='future-retro']
+  [data-dashboard-checkbox='true'][data-state='indeterminate']
+  [data-dashboard-checkbox-indicator='true']::before {
+  content: '';
+  position: absolute;
+  left: 50%;
+  top: 50%;
+  width: 8px;
+  height: 3px;
+  background: var(--retro-paper);
+  transform: translate(-50%, -50%);
+}
+
 :root[data-dashboard-style='future-retro'] [data-dashboard-checkbox='true']:focus-visible {
   outline: var(--retro-stroke) solid var(--retro-ink) !important;
   outline-offset: 2px;
@@ -2237,6 +2257,16 @@
   background: var(--retro-paper);
 }
 
+/* 记忆记录行勾选后用锈红描边标出，需压过上面 .border 的统一线色 */
+:root[data-dashboard-style='future-retro'] [data-memory-record-row='true'] {
+  border-radius: 0 !important;
+}
+
+:root[data-dashboard-style='future-retro'] [data-memory-record-row='true'][data-checked='true'] {
+  border-color: var(--retro-rust) !important;
+  background: color-mix(in srgb, var(--retro-rust) 7%, transparent) !important;
+}
+
 /* Card carries Tailwind's border class, so keep its retro frame color after the generic border override. */
 :root[data-dashboard-style='future-retro'] [data-dashboard-card='true'].border {
   border-color: var(--retro-ink) !important;
@@ -2630,8 +2660,8 @@
   padding-bottom: 0.625rem;
 }
 
-/* 记忆查询结果头部：单行「标题 + 计数徽标 + 刷新」，收紧纵向留白，
-   让头部高度由这一行控件决定而不是被内边距撑高 */
+/* 记忆查询结果头部：单行「多选操作 + 计数小字」，收紧纵向留白，
+   让头部高度由控件决定而不是被内边距撑高 */
 .memory-console-density
   [data-dashboard-card-header='true'][data-memory-records-result-header='true'] {
   padding: 0.5rem 0.75rem;
```

**File**: `dashboard/src/routes/config/__tests__/providerTemplates.test.ts` (modified, +17/-1)
```diff
@@ -1,6 +1,7 @@
 import { describe, expect, it } from 'vitest'
 
-import { findTemplateByBaseUrl, resolveModelFetcherTemplate } from '../providerTemplates'
+import { validateThinkingParams } from '../model/thinkingFormats'
+import { findTemplateByBaseUrl, resolveModelFetcherTemplate, resolveThinkingFormatForModel } from '../providerTemplates'
 
 describe('providerTemplates', () => {
   it('为未知自定义 OpenAI 兼容端点启用模型列表获取', () => {
@@ -50,4 +51,19 @@ describe('providerTemplates', () => {
   it('直接按 URL 查找模板时不把未知 URL 识别为内置模板', () => {
     expect(findTemplateByBaseUrl('https://example.com/v1')).toBeNull()
   })
+
+  it('普通智谱 GLM-5.3 限制关闭与力度，但 Coding 套餐仍允许关闭', () => {
+    const apiTemplate = findTemplateByBaseUrl('https://open.bigmodel.cn/api/paas/v4')
+    const codingTemplate = findTemplateByBaseUrl('https://open.bigmodel.cn/api/coding/paas/v4')
+    const apiThinking = resolveThinkingFormatForModel(apiTemplate, 'glm-5.3-flash')!
+    const codingThinking = resolveThinkingFormatForModel(codingTemplate, 'glm-5.3-flash')!
+
+    expect(apiThinking.canDisable).toBe(false)
+    expect(apiThinking.efforts).toEqual(['low', 'high', 'max'])
+    expect(validateThinkingParams({ thinking: { type: 'disabled' } }, apiThinking)).toBe('当前模型不支持关闭思考')
+    expect(validateThinkingParams({ reasoning_effort: 'minimal' }, apiThinking)).toContain('reasoning_effort 只能是')
+    expect(codingThinking.canDisable).toBe(true)
+    expect(validateThinkingParams({ thinking: { type: 'disabled' } }, codingThinking)).toBeNull()
+    expect(resolveThinkingFormatForModel(apiTemplate, 'glm-4.7')?.canDisable).toBe(true)
+  })
 })
```

**File**: `dashboard/src/routes/config/model.tsx` (modified, +22/-18)
```diff
@@ -93,6 +93,7 @@ import {
   validateThinkingParams,
   type ThinkingFormatConfig,
 } from './model/thinkingFormats'
+import { resolveThinkingFormatForModel } from './providerTemplates'
 import {
   getDeepSeekReasoningEffort,
   isDeepSeekThinkingEnabled,
@@ -497,12 +498,14 @@ function ModelConfigPageContent() {
   // 思考开关格式由命中的服务商模板元数据决定，未命中则不显示思考开关
   // DeepSeek 有专用段（含 Responses 客户端的 reasoning.effort 与联网搜索），不走通用开关
   const thinkingFormatActive: ThinkingFormatConfig | null =
-    matchedTemplate?.id !== 'deepseek' ? (matchedTemplate?.thinking ?? null) : null
+    matchedTemplate?.id !== 'deepseek'
+      ? resolveThinkingFormatForModel(matchedTemplate, editingModel?.model_identifier ?? '')
+      : null
   const modelExtraParams = editingModel?.extra_params || {}
   const thinkingEnabled = thinkingFormatActive
     ? isThinkingEnabled(modelExtraParams, thinkingFormatActive)
     : false
-  // 思考力度仅在配置了力度参数时显示；思考关闭且格式不支持关闭时置灰
+  // 思考力度仅在配置了力度参数时显示；思考关闭时置灰
   const thinkingEffortOptions: string[] =
     thinkingFormatActive?.kind === 'reasoning_effort'
       ? (thinkingFormatActive.efforts ?? [])
@@ -511,8 +514,9 @@ function ModelConfigPageContent() {
         : []
   const thinkingEffort = thinkingFormatActive ? getThinkingEffort(modelExtraParams, thinkingFormatActive) : ''
   const thinkingCanDisable =
-    thinkingFormatActive !== null &&
-    (thinkingFormatActive.kind !== 'thinking_type' || thinkingFormatActive.canDisable === true)
+    thinkingFormatActive?.kind === 'enable_thinking' ||
+    (thinkingFormatActive?.kind === 'thinking_type' && thinkingFormatActive.canDisable === true)
+  const thinkingSwitchInteractive = thinkingFormatActive !== null && (thinkingCanDisable || !thinkingEnabled)
   const thinkingBudget = thinkingFormatActive ? getThinkingBudget(modelExtraParams, thinkingFormatActive) : null
   const thinkingExtraParamsError = thinkingFormatActive
     ? validateThinkingParams(modelExtraParams, thinkingFormatActive)
@@ -1206,7 +1210,7 @@ function ModelConfigPageContent() {
           if (!open) setSelectedModelTestResult(null)
         }}
       >
-        <DialogContent className="max-w-[95vw] gap-3 p-4 sm:max-w-3xl sm:gap-4 sm:p-6">
+        <DialogContent className="max-w-[95vw] gap-3 p-4 sm:gap-4 sm:p-6 sm:[--dialog-width:38rem]">
           <DialogHeader>
             <DialogTitle>模型测试详情</DialogTitle>
             <DialogDescription>
@@ -1271,6 +1275,15 @@ function ModelConfigPageContent() {
                         </div>
                       )}
 
+                      {selectedModelTestResult.reasoning && (
+                        <div>
+                          <h4 className="mb-2 text-sm font-semibold">推理内容</h4>
+                          <pre className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
+                            {selectedModelTestResult.reasoning}
+                          </pre>
+                        </div>
+                      )}
+
                       {isEmbeddingTest && (selectedModelTestResult.embedding_pairs?.length ?? 0) > 0 && (
                         <div>
                           <h4 className="mb-2 text-sm font-semibold">
@@ -1305,15 +1318,6 @@ function ModelConfigPageContent() {
                           {selectedModelTestResult.response || '（无文本返回）'}
                         </pre>
                       </div>
-
-                      {selectedModelTestResult.reasoning && (
-                        <div>
-                          <h4 className="mb-2 text-sm font-semibold">推理内容</h4>
-                          <pre className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
-                            {selectedModelTestResult.reasoning}
-                          </pre>
-                        </div>
-                      )}
                     </>
                   )
                 })()}
@@ -1942,12 +1946,12 @@ function ModelConfigPageContent() {
 
             {!deepSeekClientType &&
```

**File**: `dashboard/src/routes/config/model/thinkingFormats.ts` (modified, +3/-0)
```diff
@@ -177,6 +177,9 @@ export function validateThinkingParams(
     if (params.thinking.type !== undefined && typeof params.thinking.type !== 'string') {
       return 'thinking.type 必须是字符串'
     }
+    if (config.canDisable !== true && params.thinking.type === 'disabled') {
+      return '当前模型不支持关闭思考'
+    }
   }
 
   const effortParam = getEffortParam(config)
```

**File**: `dashboard/src/routes/config/providerTemplates.ts` (modified, +21/-3)
```diff
@@ -55,8 +55,6 @@ export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
       effortParam: 'reasoning_effort',
       efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none'],
       defaultEffort: 'max',
-      // GLM-5.3 / GLM-5.3-Flash 仅支持开启思考，力度档位只接受 low/high/max
-      disableNote: 'GLM-5.3 系列仅支持开启思考，力度档位只接受 low/high/max',
     },
   },
   {
@@ -73,7 +71,6 @@ export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
       effortParam: 'reasoning_effort',
       efforts: ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none'],
       defaultEffort: 'max',
-      disableNote: 'GLM-5.3 系列仅支持开启思考，力度档位只接受 low/high/max',
     },
   },
   {
@@ -312,6 +309,27 @@ export function findTemplateByBaseUrl(baseUrl: string): ProviderTemplate | null
   )
 }
 
+export function resolveThinkingFormatForModel(
+  template: ProviderTemplate | null,
+  modelIdentifier: string
+): ThinkingFormatConfig | null {
+  const thinking = template?.thinking
+  if (!thinking) return null
+
+  // 普通智谱 API 的 GLM-5.3 系列拒绝关闭思考；Coding 套餐使用独立模板，不受此限制。
+  if (template?.id === 'zhipu' && /^glm-5\.3(?:$|-)/i.test(modelIdentifier.trim())) {
+    return {
+      ...thinking,
+      canDisable: false,
+      efforts: ['low', 'high', 'max'],
+      defaultEffort: 'max',
+      disableNote: '此模型不支持关闭思考',
+    }
+  }
+
+  return thinking
+}
+
 /**
  * 按客户端类型推导默认的模型列表获取器。
  * 所有提供商统一乐观尝试 /models：端点不支持时由调用方提示手动填写。
```

---

### Incident Patch 8: `05b2070b` (2026-09-26)
**Commit Message**: Update memory_flow_service.py

**File**: `src/services/memory_flow_service.py` (modified, +593/-593)
```diff
@@ -1,57 +1,57 @@
-from __future__ import annotations
-
-from dataclasses import dataclass
-from datetime import datetime
+from __future__ import annotations
+
+from dataclasses import dataclass
+from datetime import datetime
 from pathlib import Path
 from typing import Any, Dict, List, Optional
-
-import asyncio
+
+import asyncio
 import json
 import os
 import time
 
 from json_repair import repair_json
-
+
 from src.common.logger import get_logger
 from src.common.database.database import ROOT_PATH
 from src.common.message_repository import count_messages, find_messages
 from src.common.data_models.message_component_data_model import TextComponent
 from src.chat.utils.utils import is_bot_self
-from src.config.config import global_config
-from src.person_info.person_info import Person, get_person_id, store_person_memory_from_answer
-from src.services import memory_service as memory_service_module
+from src.config.config import global_config
+from src.person_info.person_info import Person, get_person_id, store_person_memory_from_answer
+from src.services import memory_service as memory_service_module
 from src.services.memory_service import memory_service
 from src.A_memorix.core.image.component_paths import build_chat_external_ref, iter_message_image_components
 from src.A_memorix.host_service import a_memorix_host_service
 
 from .image_writeback_journal import ImageWritebackJournal
 from .person_fact_verifier import verify_direct_person_fact
 from .person_fact_reverification import reverify_historical_person_facts
-
-logger = get_logger("memory_flow_service")
-
-
-@dataclass
-class PersonFactEvidence:
-    target_messages: List[Any]
-    context_messages: List[Any]
-
-
+
+logger = get_logger("memory_flow_service")
+
+
+@dataclass
+class PersonFactEvidence:
+    target_messages: List[Any]
+    context_messages: List[Any]
+
+
 class PersonFactWritebackService:
     def __init__(self) -> None:
         self._queue: asyncio.Queue[Any] = asyncio.Queue(maxsize=256)
         self._worker_task: Optional[asyncio.Task] = None
         self._reverify_task: Optional[asyncio.Task] = None
-        self._stopping = False
-        self._extractor: Any | None = None
-
+        self._stopping = False
+        self._extractor: Any | None = None
+
     async def start(self) -> None:
         if self._worker_task is not None and not self._worker_task.done():
             return
         self._stopping = False
         self._worker_task = asyncio.create_task(self._worker_loop(), name="A_Memorix.person_fact_writeback")
         self._reverify_task = asyncio.create_task(self._historical_reverify_loop(), name="A_Memorix.person_fact_reverify")
-
+
     async def shutdown(self) -> None:
         self._stopping = True
         worker = self._worker_task
@@ -66,11 +66,11 @@ async def shutdown(self) -> None:
                 pass
         if worker is None:
             return
-        worker.cancel()
-        try:
-            await worker
-        except asyncio.CancelledError:
-            pass
+        worker.cancel()
+        try:
+            await worker
+        except asyncio.CancelledError:
+            pass
         except Exception as exc:
             logger.warning(f"关闭人物事实写回 worker 失败: {exc}")
 
@@ -114,67 +114,67 @@ async def _historical_reverify_loop(self) -> None:
             except Exception as exc:
                 logger.error(f"历史人物事实重验失败: {exc}", exc_info=True)
                 await asyncio.sleep(60)
-
-    async def enqueue(self, message: Any) -> None:
-        if not bool(global_config.a_memorix.integration.person_fact_writeback_enabled):
-            return
-        if self._stopping:
-            return
-        try:
-            self._queue.put_nowait(message)
-        except asyncio.QueueFull:
-            logger.warning("人物事实写回队列已满，跳过本次回复")
-
-    async def _worker_loop(self) -> None:
-        try:
-            while not self._stopping:
-                message = await self._qu
```

---

### Incident Patch 9: `26936fcc` (2026-09-25)
**Commit Message**: fix(memory): 修复 PR 2073 审查发现的记忆问题

修正人物事实历史重验路径、开关和证据边界，独立加载 Episode 状态与列表，并限制画像候选读取。

修复相关 CI 的格式、lint 与画像分类测试。A_memorix core 变更仅用于解除当前 MaiBot PR 的集成阻塞，后续同步至上游 MaiBot_branch。

**File**: `dashboard/src/components/memory/MemoryEpisodeManager.tsx` (modified, +27/-8)
```diff
@@ -183,19 +183,38 @@ export function MemoryEpisodeManager({
   const failedItems = Array.isArray(status?.failed) ? status.failed : []
 
   const loadStatus = useCallback(async () => {
-    const [statusPayload, migrationPayload] = await Promise.all([
+    const [statusResult, migrationResult] = await Promise.allSettled([
       getMemoryEpisodeStatus(parsePositiveInt(limit) ?? 20),
       getMemoryEpisodeMigrationBackfill(),
     ])
-    if (!migrationPayload.success) {
-      throw new Error(migrationPayload.error || '读取 Episode 迁移历史任务失败')
+    if (statusResult.status === 'fulfilled' && statusResult.value.success) {
+      setStatus(statusResult.value)
+    } else {
+      setStatus(null)
+      toast({
+        title: '加载 Episode 状态失败',
+        description: statusResult.status === 'rejected'
+          ? statusResult.reason instanceof Error ? statusResult.reason.message : String(statusResult.reason)
+          : statusResult.value.error || 'Episode 状态接口返回失败',
+        variant: 'destructive',
+      })
     }
-    if (!migrationPayload.by_status || !Array.isArray(migrationPayload.sample_sources)) {
-      throw new Error('Episode 迁移历史任务接口返回的数据不完整')
+    const migrationPayload = migrationResult.status === 'fulfilled' ? migrationResult.value : null
+    if (migrationPayload?.success && migrationPayload.by_status && Array.isArray(migrationPayload.sample_sources)) {
+      setMigrationBackfill(migrationPayload)
+    } else {
+      setMigrationBackfill(null)
+      let description = migrationPayload?.error || 'Episode 迁移历史任务接口返回的数据不完整'
+      if (migrationResult.status === 'rejected') {
+        description = migrationResult.reason instanceof Error ? migrationResult.reason.message : String(migrationResult.reason)
+      }
+      toast({
+        title: '加载迁移任务失败',
+        description,
+        variant: 'destructive',
+      })
     }
-    setStatus(statusPayload)
-    setMigrationBackfill(migrationPayload)
-  }, [limit])
+  }, [limit, toast])
 
   const loadEpisodes = useCallback(async () => {
     setLoading(true)
```

**File**: `dashboard/src/components/memory/__tests__/MemoryEpisodeManager.test.tsx` (modified, +16/-3)
```diff
@@ -75,7 +75,7 @@ beforeEach(() => {
 })
 
 describe('MemoryEpisodeManager', () => {
-  it('迁移任务接口返回失败时展示错误，不读取缺失的状态字段', async () => {
+  it('迁移任务接口返回失败时仍展示 Episode 列表和状态', async () => {
     vi.mocked(getMemoryEpisodeMigrationBackfill).mockResolvedValue({
       success: false,
       error: '不支持的 memory_episode_admin action',
@@ -86,13 +86,26 @@ describe('MemoryEpisodeManager', () => {
     await waitFor(() => {
       expect(toastMock).toHaveBeenCalledWith(
         expect.objectContaining({
-          title: '加载情节记忆失败',
+          title: '加载迁移任务失败',
           description: '不支持的 memory_episode_admin action',
           variant: 'destructive',
         })
       )
     })
-    expect(screen.queryByText(/待重建 .*已完成 .*失败/)).not.toBeInTheDocument()
+    expect(await screen.findByText('默认情景')).toBeInTheDocument()
+    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: '加载情节记忆失败' }))
+  })
+
+  it('状态接口返回失败时仍展示 Episode 列表和迁移任务', async () => {
+    statusMock.mockResolvedValue({ success: false, error: '状态服务不可用' })
+
+    render(<MemoryEpisodeManager />)
+
+    expect(await screen.findByText('默认情景')).toBeInTheDocument()
+    expect(await screen.findByText(/待重建 0、已完成 0、失败 0/)).toBeInTheDocument()
+    expect(toastMock).toHaveBeenCalledWith(
+      expect.objectContaining({ title: '加载 Episode 状态失败', description: '状态服务不可用' })
+    )
   })
 
   it('迁移任务操作位于页面末尾，使用项目确认框和 Toast 反馈', async () => {
```

**File**: `dashboard/src/routes/resource/knowledge-base/tabs/MemoryRecordsTab.tsx` (modified, +2/-2)
```diff
@@ -620,7 +620,7 @@ export function MemoryRecordsTab({ onAction, onCorrectionPlan }: MemoryRecordsTa
         className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
         aria-label="记忆多选操作"
       >
-        <label className="flex items-center gap-2 text-sm">
+        <div className="flex items-center gap-2 text-sm">
           <Checkbox
             aria-label="全选当前结果"
             checked={allChecked ? true : checkedRecords.length > 0 ? 'indeterminate' : false}
@@ -634,7 +634,7 @@ export function MemoryRecordsTab({ onAction, onCorrectionPlan }: MemoryRecordsTa
             }
           />
           全选当前结果
-        </label>
+        </div>
         <span className="text-muted-foreground text-sm" aria-live="polite">
           已选 {checkedRecords.length} 条
         </span>
```

**File**: `pytests/A_memorix_test/test_episode_source_outbox.py` (modified, +26/-0)
```diff
@@ -1,13 +1,17 @@
 from collections import Counter
 from pathlib import Path
+from threading import Event
+from types import SimpleNamespace
 from typing import Any, Dict, List
 
+import asyncio
 import importlib
 import sys
 import time
 
 import pytest
 
+from src.A_memorix.core.runtime.services.episode_admin_service import MemoryEpisodeAdminService
 from src.A_memorix.core.storage.metadata_store import MetadataStore
 from src.A_memorix.core.utils.episode_service import EpisodeService
 
@@ -75,6 +79,28 @@ def _payload(source: str, paragraph_hash: str) -> Dict[str, Any]:
     }
 
 
+@pytest.mark.asyncio
+async def test_discard_migration_preview_does_not_block_event_loop() -> None:
+    release = Event()
+
+    def slow_preview(*, dry_run: bool) -> Dict[str, Any]:
+        release.wait(timeout=1)
+        return {"dry_run": dry_run, "candidates": 0}
+
+    async def initialize() -> None:
+        return None
+
+    store = SimpleNamespace(discard_migration_episode_rebuilds=slow_preview)
+    service = MemoryEpisodeAdminService(SimpleNamespace(metadata_store=store, initialize=initialize))
+    task = asyncio.create_task(service.memory_episode_admin(action="discard_migration_backfill"))
+    try:
+        await asyncio.sleep(0.02)
+        assert not task.done()
+    finally:
+        release.set()
+    assert (await task)["dry_run"] is True
+
+
 def test_discard_migration_backfill_preserves_new_writes_and_active_lease(tmp_path) -> None:
     store = MetadataStore(data_dir=tmp_path)
     store.connect()
```

**File**: `pytests/A_memorix_test/test_person_fact_verification.py` (modified, +12/-4)
```diff
@@ -30,9 +30,11 @@ def test_direct_person_fact_requires_same_sender_stream_and_quote(monkeypatch: p
     monkeypatch.setattr(
         person_fact_verifier,
         "find_messages",
-        lambda **kwargs: [messages[kwargs["message_id"]]]
-        if kwargs["session_id"] == "stream-1" and kwargs["message_id"] in messages
-        else [],
+        lambda **kwargs: (
+            [messages[kwargs["message_id"]]]
+            if kwargs["session_id"] == "stream-1" and kwargs["message_id"] in messages
+            else []
+        ),
     )
 
     common = dict(fact="她喜欢猫。", evidence_quote="我喜欢猫。", person_id="test:alice", person_name="Alice")
@@ -52,6 +54,11 @@ def test_direct_person_fact_requires_same_sender_stream_and_quote(monkeypatch: p
     )
     messages["m1"].processed_plain_text = "朋友转述说：我喜欢猫。"
     assert not person_fact_verifier.verify_direct_person_fact(**common, evidence_message_id="m1", session_id="stream-1")
+    for text in ("我喜欢猫吗？", "我喜欢猫。才怪", "我喜欢猫，但现在不喜欢了。"):
+        messages["m1"].processed_plain_text = text
+        assert not person_fact_verifier.verify_direct_person_fact(
+            **{**common, "evidence_quote": "我喜欢猫"}, evidence_message_id="m1", session_id="stream-1"
+        )
     monkeypatch.setattr(person_fact_verifier, "is_bot_self", lambda platform, user_id: True)
     assert not person_fact_verifier.verify_direct_person_fact(**common, evidence_message_id="m1", session_id="stream-1")
 
@@ -106,7 +113,7 @@ def test_relevant_uncertain_facts_are_labeled_beside_stable_profile() -> None:
 async def test_257_uncertain_facts_remain_searchable_and_historical_recheck_is_idempotent(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch
 ) -> None:
-    store = MetadataStore(data_dir=tmp_path)
+    store = MetadataStore(data_dir=tmp_path / "metadata")
     store.connect()
     writer = MemoryIngestService(SimpleNamespace(metadata_store=store))
     try:
@@ -133,6 +140,7 @@ async def test_257_uncertain_facts_remain_searchable_and_historical_recheck_is_i
         candidates = service._uncertain_profile_candidates("test:alice", "你还收藏藏品256吗")
         assert candidates["uncertain_fact_count"] == 257
         assert any("藏品256" in item["text"] for item in candidates["uncertain_candidates"])
+        assert len(store.list_uncertain_person_fact_claims("test:alice", limit=10)) == 10
 
         async def initialize() -> None:
             return None
```

---

### Incident Patch 10: `237bc96c` (2026-09-25)
**Commit Message**: feat(memory): 完善人物事实核验与记忆控制台运维

人物事实按原始消息核验，后台重验旧事实，并按当前对话限制未确认事实的画像引用。记忆查询支持多选修正预览；Episode 运维支持预览、确认并丢弃升级迁移留下的来源任务。

验证：相关 Python 测试 36 项、Dashboard 测试 125 项通过，所选文件 Ruff 与 git diff --check 通过。

归属说明：src/A_memorix/core 下的改动作为当前 MaiBot 集成和 WebUI 阻塞的临时补丁提交；需将同等改动同步到 A_memorix 上游 MaiBot_branch。

**File**: `dashboard/src/components/memory/MemoryEpisodeManager.tsx` (modified, +111/-3)
```diff
@@ -1,7 +1,17 @@
 import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
-import { ChevronDown, Play, RefreshCw, RotateCcw, Search } from 'lucide-react'
+import { ChevronDown, Play, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react'
 
 import { Alert, AlertDescription } from '@/components/ui/alert'
+import {
+  AlertDialog,
+  AlertDialogAction,
+  AlertDialogCancel,
+  AlertDialogContent,
+  AlertDialogDescription,
+  AlertDialogFooter,
+  AlertDialogHeader,
+  AlertDialogTitle,
+} from '@/components/ui/alert-dialog'
 import { Badge } from '@/components/ui/badge'
 import { Button } from '@/components/ui/button'
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
@@ -14,14 +24,17 @@ import { Textarea } from '@/components/ui/textarea'
 import { ThinkingIllustration } from '@/components/ui/thinking-illustration'
 import { useToast } from '@/hooks/use-toast'
 import {
+  discardMemoryEpisodeMigrationBackfill,
   getMemoryEpisode,
   getMemoryEpisodes,
+  getMemoryEpisodeMigrationBackfill,
   getMemoryEpisodeStatus,
   processMemoryEpisodePending,
   rebuildMemoryEpisodes,
   type MemoryEpisodeActionPayload,
   type MemoryEpisodeDetailPayload,
   type MemoryEpisodeItemPayload,
+  type MemoryEpisodeMigrationBackfillPayload,
   type MemoryEpisodeParagraphPayload,
   type MemoryEpisodeStatusPayload,
 } from '@/lib/memory-api'
@@ -148,6 +161,8 @@ export function MemoryEpisodeManager({
   const [limit, setLimit] = useState('20')
   const [items, setItems] = useState<MemoryEpisodeItemPayload[]>([])
   const [status, setStatus] = useState<MemoryEpisodeStatusPayload | null>(null)
+  const [migrationBackfill, setMigrationBackfill] = useState<MemoryEpisodeMigrationBackfillPayload | null>(null)
+  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
   const [selectedId, setSelectedId] = useState('')
   const [detail, setDetail] = useState<MemoryEpisodeDetailPayload | null>(null)
   const [loading, setLoading] = useState(false)
@@ -168,8 +183,18 @@ export function MemoryEpisodeManager({
   const failedItems = Array.isArray(status?.failed) ? status.failed : []
 
   const loadStatus = useCallback(async () => {
-    const payload = await getMemoryEpisodeStatus(parsePositiveInt(limit) ?? 20)
-    setStatus(payload)
+    const [statusPayload, migrationPayload] = await Promise.all([
+      getMemoryEpisodeStatus(parsePositiveInt(limit) ?? 20),
+      getMemoryEpisodeMigrationBackfill(),
+    ])
+    if (!migrationPayload.success) {
+      throw new Error(migrationPayload.error || '读取 Episode 迁移历史任务失败')
+    }
+    if (!migrationPayload.by_status || !Array.isArray(migrationPayload.sample_sources)) {
+      throw new Error('Episode 迁移历史任务接口返回的数据不完整')
+    }
+    setStatus(statusPayload)
+    setMigrationBackfill(migrationPayload)
   }, [limit])
 
   const loadEpisodes = useCallback(async () => {
@@ -361,6 +386,33 @@ export function MemoryEpisodeManager({
     }
   }, [loadEpisodes, pendingLimit, pendingMaxRetry, toast])
 
+  const submitDiscardMigrationBackfill = useCallback(async () => {
+    const count = migrationBackfill?.candidates ?? 0
+    if (count === 0) {
+      return
+    }
+    setActionLoading(true)
+    try {
+      const result = await discardMemoryEpisodeMigrationBackfill()
+      if (!result.success) {
+        throw new Error(result.error || '丢弃 Episode 迁移历史任务失败')
+      }
+      toast({
+        title: '已丢弃历史 Episode 任务',
+        description: `已丢弃 ${result.discarded} 条迁移任务；${result.active_skipped} 条运行中的任务仍需等待完成后再次处理。`,
+      })
+      await loadEpisodes()
+    } catch (error) {
+      toast({
+        title: '丢弃历史 Episode 任务失败',
+        description: error instanceof Error ? error.message : String(error),
+        variant: 'destructive',
+      })
+    } finally {
+      setActionLoading(false)
+    }
+  }, [loadEpisodes, migrationBackfill?.candidates, toast])
+
   return (
     <div className="space-y-4">
       <div className="grid gap-4 xl:
```

**File**: `dashboard/src/components/memory/MemoryProfileManager.tsx` (modified, +12/-1)
```diff
@@ -155,12 +155,13 @@ function formatEvidenceScore(item: MemoryProfileEvidenceItemPayload): string {
 
 export interface MemoryProfileManagerProps {
   initialPersonId?: string
+  onOpenFactRecords?: () => void
 }
 
 type ProfileQueryMode = 'exact' | 'fuzzy'
 type AccountMatchStatus = 'idle' | 'loading' | 'matched' | 'unmatched' | 'error'
 
-export function MemoryProfileManager({ initialPersonId = '' }: MemoryProfileManagerProps) {
+export function MemoryProfileManager({ initialPersonId = '', onOpenFactRecords }: MemoryProfileManagerProps) {
   const { toast } = useToast()
   const [profiles, setProfiles] = useState<MemoryProfileItemPayload[]>([])
   const [profileListMode, setProfileListMode] = useState<'library' | 'search'>('library')
@@ -1063,6 +1064,16 @@ export function MemoryProfileManager({ initialPersonId = '' }: MemoryProfileMana
                   className="min-h-[180px]"
                   placeholder="当前没有画像文本"
                 />
+                <div className="flex items-center justify-between gap-2 text-sm">
+                  <span className="text-muted-foreground">
+                    待确认事实 {currentProfileEvidence?.uncertain_fact_count ?? queryResult?.uncertain_fact_count ?? 0} 条；画像正文只展示摘要。
+                  </span>
+                  {onOpenFactRecords ? (
+                    <Button type="button" variant="outline" size="sm" onClick={onOpenFactRecords}>
+                      查看事实记录
+                    </Button>
+                  ) : null}
+                </div>
 
                 <div className="rounded-lg border">
                   <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
```

**File**: `dashboard/src/components/memory/__tests__/MemoryEpisodeManager.test.tsx` (modified, +82/-2)
```diff
@@ -1,22 +1,28 @@
-import { render, screen, waitFor } from '@testing-library/react'
+import { fireEvent, render, screen, waitFor } from '@testing-library/react'
 import { beforeEach, describe, expect, it, vi } from 'vitest'
 
 import {
+  discardMemoryEpisodeMigrationBackfill,
   getMemoryEpisode,
   getMemoryEpisodes,
+  getMemoryEpisodeMigrationBackfill,
   getMemoryEpisodeStatus,
   processMemoryEpisodePending,
   rebuildMemoryEpisodes,
 } from '@/lib/memory-api'
 
 import { MemoryEpisodeManager } from '../MemoryEpisodeManager'
 
-vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
+const toastMock = vi.hoisted(() => vi.fn())
+
+vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
 
 vi.mock('@/lib/memory-api', () => ({
   getMemoryEpisode: vi.fn(),
   getMemoryEpisodes: vi.fn(),
+  getMemoryEpisodeMigrationBackfill: vi.fn(),
   getMemoryEpisodeStatus: vi.fn(),
+  discardMemoryEpisodeMigrationBackfill: vi.fn(),
   processMemoryEpisodePending: vi.fn(),
   rebuildMemoryEpisodes: vi.fn(),
 }))
@@ -28,6 +34,15 @@ const statusMock = vi.mocked(getMemoryEpisodeStatus)
 beforeEach(() => {
   vi.clearAllMocks()
   statusMock.mockResolvedValue({ success: true, counts: {} })
+  vi.mocked(getMemoryEpisodeMigrationBackfill).mockResolvedValue({
+    success: true,
+    dry_run: true,
+    candidates: 0,
+    discarded: 0,
+    active_skipped: 0,
+    by_status: {},
+    sample_sources: [],
+  })
   vi.mocked(processMemoryEpisodePending).mockResolvedValue({ success: true })
   vi.mocked(rebuildMemoryEpisodes).mockResolvedValue({ success: true })
   episodesMock.mockImplementation(async (params) => ({
@@ -60,6 +75,71 @@ beforeEach(() => {
 })
 
 describe('MemoryEpisodeManager', () => {
+  it('迁移任务接口返回失败时展示错误，不读取缺失的状态字段', async () => {
+    vi.mocked(getMemoryEpisodeMigrationBackfill).mockResolvedValue({
+      success: false,
+      error: '不支持的 memory_episode_admin action',
+    } as Awaited<ReturnType<typeof getMemoryEpisodeMigrationBackfill>>)
+
+    render(<MemoryEpisodeManager />)
+
+    await waitFor(() => {
+      expect(toastMock).toHaveBeenCalledWith(
+        expect.objectContaining({
+          title: '加载情节记忆失败',
+          description: '不支持的 memory_episode_admin action',
+          variant: 'destructive',
+        })
+      )
+    })
+    expect(screen.queryByText(/待重建 .*已完成 .*失败/)).not.toBeInTheDocument()
+  })
+
+  it('迁移任务操作位于页面末尾，使用项目确认框和 Toast 反馈', async () => {
+    vi.mocked(getMemoryEpisodeMigrationBackfill).mockResolvedValue({
+      success: true,
+      dry_run: true,
+      candidates: 2,
+      discarded: 0,
+      active_skipped: 0,
+      by_status: { done: 2 },
+      sample_sources: ['source-a'],
+    })
+    vi.mocked(discardMemoryEpisodeMigrationBackfill).mockResolvedValue({
+      success: true,
+      dry_run: false,
+      candidates: 2,
+      discarded: 2,
+      active_skipped: 0,
+      by_status: { done: 2 },
+      sample_sources: ['source-a'],
+    })
+
+    render(<MemoryEpisodeManager />)
+
+    const discardHeading = await screen.findByText('丢弃升级迁移的历史任务')
+    const maintenanceHeading = screen.getByText('Episode 运维')
+    expect(maintenanceHeading.compareDocumentPosition(discardHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
+
+    fireEvent.click(screen.getByRole('button', { name: '丢弃历史任务' }))
+    expect(screen.getByText('确认丢弃历史 Episode 任务')).toBeInTheDocument()
+    fireEvent.click(screen.getByRole('button', { name: '取消' }))
+    expect(discardMemoryEpisodeMigrationBackfill).not.toHaveBeenCalled()
+
+    fireEvent.click(screen.getByRole('button', { name: '丢弃历史任务' }))
+    fireEvent.click(screen.getByRole('button', { name: '确认丢弃' }))
+
+    await waitFor(() => expect(discardMemoryEpisodeMigrationBackfill).toHaveBeenCalledOnce())
+    await waitFor(() => {
+      expect(toastMock).toHaveBeenCalledWith(
+        expect.objectContaining({
+          title: '已丢弃历史 Episode 任务',
+          description: expect.stringContaining('已丢弃 2 条迁移
```

**File**: `dashboard/src/components/memory/__tests__/MemoryProfileManager.test.tsx` (modified, +15/-0)
```diff
@@ -165,6 +165,21 @@ async function renderManager(initialPersonId?: string) {
 }
 
 describe('MemoryProfileManager 画像库加载', () => {
+  it('展示后端返回的待确认事实总数并提供事实记录入口', async () => {
+    const onOpenFactRecords = vi.fn()
+    vi.mocked(memoryApi.getMemoryProfileEvidence).mockResolvedValue({
+      success: true,
+      person_id: 'p1',
+      profile_text: '画像摘要',
+      uncertain_fact_count: 257,
+      evidence: [],
+    })
+    render(<MemoryProfileManager onOpenFactRecords={onOpenFactRecords} />)
+    expect(await screen.findByText(/待确认事实 257 条/)).toBeInTheDocument()
+    fireEvent.click(screen.getByRole('button', { name: '查看事实记录' }))
+    expect(onOpenFactRecords).toHaveBeenCalledOnce()
+  })
+
   it('两列高度不一致时，画像查询卡片不跟随详情列拉伸', async () => {
     await renderManager()
 
```

**File**: `dashboard/src/components/memory/__tests__/memory-managers.test.tsx` (modified, +11/-0)
```diff
@@ -25,7 +25,9 @@ vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
 vi.mock('@/lib/memory-api', () => ({
   getMemoryEpisode: vi.fn(),
   getMemoryEpisodes: vi.fn(),
+  getMemoryEpisodeMigrationBackfill: vi.fn(),
   getMemoryEpisodeStatus: vi.fn(),
+  discardMemoryEpisodeMigrationBackfill: vi.fn(),
   getMemoryTimeline: vi.fn(),
   processMemoryEpisodePending: vi.fn(),
   rebuildMemoryEpisodes: vi.fn(),
@@ -244,6 +246,15 @@ beforeEach(() => {
   patchPointerCapture()
   vi.mocked(memoryApi.getMemoryEpisodes).mockResolvedValue({ success: true, items: [] })
   vi.mocked(memoryApi.getMemoryEpisodeStatus).mockResolvedValue(makeEpisodeStatus())
+  vi.mocked(memoryApi.getMemoryEpisodeMigrationBackfill).mockResolvedValue({
+    success: true,
+    dry_run: true,
+    candidates: 0,
+    discarded: 0,
+    active_skipped: 0,
+    by_status: {},
+    sample_sources: [],
+  })
   vi.mocked(memoryApi.getMemoryEpisode).mockResolvedValue(makeEpisodeDetail(makeEpisode()))
   vi.mocked(memoryApi.rebuildMemoryEpisodes).mockResolvedValue(makeAction())
   vi.mocked(memoryApi.processMemoryEpisodePending).mockResolvedValue(makeAction({ rebuilt: undefined, processed: 4 }))
```

#### Recent Merged Pull Requests:
- **PR #2077** (2026-09-28): Dev (@SengokuCola)
- **PR #2073** (2026-09-25): feat(A_memorix)：修复已知问题并优化用户体验 (@A-Dawn)
- **PR #2072** (2026-09-26): Dev (@SengokuCola)
- **PR #2065** (closed): fix(statistics): 统计任务查询消息只投影实际消费的6列，不再整行加载大字段 (@xiechimon)
- **PR #2062** (closed): fix(replyer): 回复分割压缩拼接处补回停顿，不再多句粘连 (#2056) (@xiechimon)
- **PR #2060** (closed): fix(webui): 修复日志页面移动端响应式布局崩溃（Tab 悬空与视口挤压） (@MorphieEndless)
- **PR #2055** (2026-09-25): fix(webui): 修复插件市场 HTTPS 地址在 Fake-IP 环境下被拦截 (@Rvosy)
- **PR #2054** (closed): docs: 重写 README 并新增新手 Runbook (@destiny520537work-lab)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
