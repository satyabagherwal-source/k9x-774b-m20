# Forensic Learning Record (Deep Inspection): volcengine/MineContext

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-minecontext-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/MineContext](https://github.com/volcengine/MineContext))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:19.714Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/MineContext`
- **Description**: MineContext is your proactive context-aware AI partner（Context-Engineering+ChatGPT Pulse）
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 5535 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/packages/shared/logger/renderer.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import Logger from 'electron-log/renderer'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silly'

/**
 * Gets a logger instance with a scope.
 * @param scope - The scope name, usually the component name.
 */
export const getLogger = (scope?: string) => {
  return Logger.scope(scope ? `renderer - ${scope}` : '[renderer]')
}

/**
 * The default logger for the renderer process.
 */
export const rendererLog = getLogger()

```

### Core Architecture Module: `frontend/resources/js/utils.js`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

export function getQueryParam(paramName) {
  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.search)
  return params.get(paramName)
}

```

### Core Architecture Module: `frontend/src/main/background/utils/task-queue.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

// electron/main/taskQueueManager.ts
import Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'
import { Worker } from 'worker_threads'
import path from 'path'

export class TaskQueueManager {
  private db: Database.Database
  private win: BrowserWindow
  private workers: Record<string, Worker> = {}

  constructor(dbPath: string, win: BrowserWindow) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.win = win
    this.initSchema()

    // Start two Workers
    this.workers['dbQuery'] = this.createWorker('dbWorker.js')
    this.workers['fetchApi'] = this.createWorker('apiWorker.js')
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload JSON NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retries INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        cron TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  private createWorker(file: string) {
    const worker = new Worker(path.join(__dirname, file), {
      env: { DB_PATH: this.db.name } // Pass DB path to Worker
    })

    worker.on('message', (msg) => {
      if (msg.channel && this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(msg.channel, msg.data)
      }
    })

    return worker
  }

  /** Add a task */
  addTask(type: string, payload: any, maxRetries = 3, cronExp?: string) {
    const info = this.db
      .prepare('INSERT INTO tasks (type, payload, max_retries, cron) VALUES (@type, @payload, @max_retries, @cron)')
      .run({
        type,
        payload: JSON.stringify(payload),
        max_retries: maxRetries,
        cron: cronExp || null
      })

    const id = info.lastInsertRowid as number

    // Distribute to the corresponding Worker
    if (this.workers[type]) {
      this.workers[type].postMessage({ action: 'addTask', id, type, cron: cronExp })
    }

    return id
  }

  /** Delete a task */
  deleteTask(id: number, type: string) {
    if (this.workers[type]) {
      this.workers[type].postMessage({ action: 'deleteTask', id })
    }
    this.db.prepare('DELETE FROM tasks WHERE id=?').run(id)
  }

  getAllTasks() {
    return this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
  }
}

```

### Core Architecture Module: `frontend/src/main/utils/env.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { isDev } from '@main/constant'
import { app } from 'electron'
import path from 'path'

export const isPackaged = app.isPackaged
export const actuallyDev = isDev && !isPackaged
export const serverRunInFrontend = true // true means the python server is packaged into the frontend and can be started and debugged like in a real environment

// Dynamically get the resources path
export function getResourcesPath(): string {
  if (actuallyDev) {
    if (serverRunInFrontend) {
      // Development environment: use the backend directory under the frontend directory
      return path.join(__dirname, '..', '..')
    }
    // Development environment: start the packaged server from the backend
    return path.join(__dirname, '..', '..', '..', 'MineContext')

    // TODO: Development environment: do not package the python server, connect directly for debugging, not implemented
  } else {
    // Production environment: use process.resourcesPath (including extraResources)
    // process.resourcesPath points to the resources/ directory
    // app.getAppPath() points to inside app.asar
    return process.resourcesPath
  }
}

```

### Core Architecture Module: `frontend/src/main/utils/file.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getLogger } from '@shared/logger/main'
import { audioExts, documentExts, imageExts, MB, textExts, videoExts } from '@shared/config/constant'
import { FileMetadata, FileTypes } from '@types'
import chardet from 'chardet'
import { app } from 'electron'
import iconv from 'iconv-lite'
import { v4 as uuidv4 } from 'uuid'

const logger = getLogger('Utils:File')

// Create a file type map to improve lookup efficiency
const fileTypeMap = new Map<string, FileTypes>()

// Initialize the map
function initFileTypeMap() {
  imageExts.forEach((ext) => fileTypeMap.set(ext, FileTypes.IMAGE))
  videoExts.forEach((ext) => fileTypeMap.set(ext, FileTypes.VIDEO))
  audioExts.forEach((ext) => fileTypeMap.set(ext, FileTypes.AUDIO))
  textExts.forEach((ext) => fileTypeMap.set(ext, FileTypes.TEXT))
  documentExts.forEach((ext) => fileTypeMap.set(ext, FileTypes.DOCUMENT))
}

// Initialize the map
initFileTypeMap()

export function untildify(pathWithTilde: string) {
  if (pathWithTilde.startsWith('~')) {
    const homeDirectory = os.homedir()
    return pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
  }
  return pathWithTilde
}

export async function hasWritePermission(dir: string) {
  try {
    logger.info(`Checking write permission for ${dir}`)
    await fs.promises.access(dir, fs.constants.W_OK)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Check if a path is inside another path (proper parent-child relationship)
 * This function correctly handles edge cases that string.startsWith() cannot handle,
 * such as distinguishing between '/root/test' and '/root/test aaa'
 *
 * @param childPath - The path that might be inside the parent path
 * @param parentPath - The path that might contain the child path
 * @returns true if childPath is inside parentPath, false otherwise
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  try {
    const resolvedChild = path.resolve(childPath)
    const resolvedParent = path.resolve(parentPath)

    // Normalize paths to handle different separators
    const normalizedChild = path.normalize(resolvedChild)
    const normalizedParent = path.normalize(resolvedParent)

    // Check if they are the same path
    if (normalizedChild === normalizedParent) {
      return true
    }

    // Get relative path from parent to child
    const relativePath = path.relative(normalizedParent, normalizedChild)

    // If relative path is empty, they are the same
    // If relative path starts with '..', child is not inside parent
    // If relative path is absolute, child is not inside parent
    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
  } catch (error) {
    logger.error('Failed to check path relationship:', error as Error)
    return false
  }
}

export function getFileType(ext: string): FileTypes {
  ext = ext.toLowerCase()
  return fileTypeMap.get(ext) || FileTypes.OTHER
}

export function getFileDir(filePath: string) {
  return path.dirname(filePath)
}

export function getFileName(filePath: string) {
  return path.basename(filePath)
}

export function getFileExt(filePath: string) {
  return path.extname(filePath)
}

export function getAllFiles(dirPath: string, arrayOfFiles: FileMetadata[] = []): FileMetadata[] {
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    if (file.startsWith('.')) {
      return
    }

    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
    } else {
      const ext = path.extname(file)
      const fileType = getFileType(ext)

      if ([FileTypes.OTHER, FileTypes.IMAGE, FileTypes.VIDEO, FileTypes.AUDIO].includes(fileType)) {
        return
      }

      const name = path.basename(file)
      const size = fs.statSync(fullPath).size

      const fileItem: FileMetadata = {
        id: uuidv4(),
        name,
        path: fullPath,
        size,
        ext,
        count: 1,
        origin_name: name,
        type: fileType,
        created_at: new Date().toISOString()
      }

      arrayOfFiles.push(fileItem)
    }
  })

  return arrayOfFiles
}

export function getTempDir() {
  return path.join(app.getPath('temp'), 'MineContext')
}

export function getFilesDir() {
  return path.join(app.getPath('userData'), 'Data', 'files')
}

export function getConfigDir() {
  return path.join(os.homedir(), '.minecontext', 'config')
}

export function getCacheDir() {
  return path.join(app.getPath('userData'), 'Cache')
}

export function getAppConfigDir(name: string) {
  return path.join(getConfigDir(), name)
}

export function getMcpDir() {
  return path.join(os.homedir(), '.minecontext', 'mcp')
}

/**
 * Read the file content and automatically detect the encoding format for decoding
 * @param filePath - The file path
 * @returns The decoded file content
 */
export async function readTextFileWithAutoEncoding(filePath: string): Promise<string> {
  const encoding = (await chardet.detectFile(filePath, { sampleSize: MB })) || 'UTF-8'
  logger.debug(`File ${filePath} detected encoding: ${encoding}`)

  const encodings = [encoding, 'UTF-8']
  const data = await readFile(filePath)

  for (const encoding of encodings) {
    try {
      const content = iconv.decode(data, encoding)
      if (!content.includes('\uFFFD')) {
        return content
      } else {
        logger.warn(
          `File ${filePath} was auto-detected as ${encoding} encoding, but contains invalid characters. Trying other encodings`
        )
      }
    } catch (error) {
      logger.error(`Failed to decode file ${filePath} with encoding ${encoding}: ${error}`)
    }
  }

  logger.error(`File ${filePath} failed to decode with all possible encodings, trying UTF-8 encoding`)
  return iconv.decode(data, 'UTF-8')
}

```

### Core Architecture Module: `frontend/src/main/utils/get-capture-sources.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { app, desktopCapturer, DesktopCapturerSource, systemPreferences } from 'electron'
import screenshot from 'screenshot-desktop'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { getLogger } from '@shared/logger/main'
import { FinalWindowInfo, getAllWindows } from './mac-window-manager'
import { NativeCaptureHelper } from './native-capture-helper'
import path from 'node:path'
const logger = getLogger('ScreenshotService')

/**
 * @interface CaptureSource
 * @description The final, unified structure for a capture source sent to the frontend.
 */
export interface CaptureSource {
  id: string
  name: string
  type: 'screen' | 'window'
  thumbnail: string | null
  appIcon: string | null
  isVisible: boolean
  // Optional properties for windows added from the native module
  isVirtual?: boolean
  appName?: string
  windowTitle?: string
  windowId?: number
}

class CaptureSourcesTools {
  private nativeCaptureHelper: NativeCaptureHelper | null = null
  constructor() {
    if (process.platform === 'darwin') {
      try {
        this.nativeCaptureHelper = new NativeCaptureHelper()
        this.nativeCaptureHelper.initialize()
        logger.info('✅ Native capture helper initialized')
      } catch (error: any) {
        logger.warn(`⚠️ Native capture helper failed to initialize: ${error.message}`)
        this.nativeCaptureHelper = null // Clear the helper so fallback logic works
      }
    }
  }

  async getCaptureSourcesTools() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 256, height: 144 },
        fetchWindowIcons: true
      })

      const formattedSources: CaptureSource[] = sources.map((source) => {
        let displayName = source.name

        return {
          id: source.id,
          name: displayName,
          type: source.display_id ? 'screen' : 'window',
          thumbnail: source.thumbnail.toDataURL(),
          appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
          isVisible: true // desktopCapturer only returns visible windows
        }
      })

      if (process.platform === 'darwin') {
        try {
          let allWindows: FinalWindowInfo[] = []

          logger.info('Using macWindowManager for cross-space window detection')
          allWindows = await getAllWindows()

          const windowsByApp = new Map()

          const realAppNames = new Map()

          for (const macWindow of allWindows) {
            const macTitle = macWindow.windowTitle.toLowerCase()
            const macApp = macWindow.appName

            const matchingDesktopSource = formattedSources.find((source) => {
              if (source.type === 'screen') return false
              const sourceTitle = source.name.toLowerCase()

              if (sourceTitle === macTitle) return true

              if (macApp === 'Cursor' && sourceTitle.includes('—') && macTitle.includes('—')) {
                return sourceTitle === macTitle
              }

              if (sourceTitle.includes(macTitle) || macTitle.includes(sourceTitle)) {
                return true
              }

              return false
            })

            if (matchingDesktopSource) {
              realAppNames.set(matchingDesktopSource.name, macApp)
              logger.info(`🔗 Matched: "${matchingDesktopSource.name}" -> App: ${macApp}`)
            }
          }

          // Second pass: add all desktopCapturer windows to the map with correct app names
          formattedSources
            .filter((s) => s.type === 'window')
            .forEach((source) => {
              // Use real app name if available, otherwise fall back to parsing window title
              const realApp = realAppNames.get(source.name)
              let appName = realApp || source.name.split(' - ')[0]

              // Apply Cursor-specific formatting if we know it's actually Cursor
              let displayName = source.name
              if (realApp === 'Cursor') {
                if (source.name.includes(' — ')) {
                  const parts = source.name.split(' — ')
                  if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1]
                    if (!lastPart.includes('.') && lastPart.length < 30) {
                      displayName = `Cursor - ${lastPart}`
                    }
                  }
                }
              }

              if (!windowsByApp.has(appName)) {
                windowsByApp.set(appName, [])
              }
              windowsByApp.get(appName).push({
                ...source,
                name: displayName, // Use the corrected display name
                appName: appName, // Store the real app name
                fromDesktopCapturer: true
              })
            })

          // Process windows from native API
          for (const window of allWindows) {
            const appName = window.appName

            // Skip Electron's own windows
            if (appName === 'MineContext' || appName === 'Electron') continue

            // Check if we already have windows from this app
            const existingWindows = windowsByApp.get(appName) || []

            // For important apps, always include minimized windows
            const importantApps = [
              'Zoom',
              'zoom.us',
              'Slack',
              'Microsoft Teams',
              'MSTeams',
              'Teams',
              'Discord',
              'Skype',
              'Microsoft PowerPoint',
              'PowerPoint',
              'Keynote',
              'Presentation',
              'Notion',
              'Obsidian',
              'Roam Research',
              'Logseq',
              'Visual Studio Code',
              'Code',
              'Xcode',
              'IntelliJ IDEA',
              'PyCharm',
              'Google Chrome',
              'Safari',
              'Firefox',
              'Microsoft Edge',
              'Figma',
              'Sketch',
              'Adobe Photoshop',
              'Adobe Illustrator',
              'Finder',
              'System Preferences',
              'Activity Monitor'
            ]
            const isImportantApp = window.isImportantApp || importantApps.includes(appName)

            // Check if this specific window already exists
            const windowExists = existingWindows.some((existing) => {
              const existingTitle = existing.name.toLowerCase()
              const currentTitle = `${appName} - ${window.windowTitle}`.toLowerCase()
              return existingTitle === currentTitle
            })

            // Add the window if it doesn't exist or if it's an important app that might be minimized
            if (!windowExists || (isImportantApp && !window.isOnScreen)) {
              // Debug logging for Teams
              if (window.appName.includes('Teams')) {
                logger.info(
                  `🔍 Teams window detection: ${window.appName} - ${window.windowTitle}, isOnScreen: ${window.isOnScreen}, windowExists: ${windowExists}, isImportantApp: ${isImportantApp}`
                )
              }

              // Check if this window was already found by desktopCapturer (meaning it's visible)
              const foundByDesktopCapturer = formattedSources.some((source) => {
                const sourceName = source.name.toLowerCase()
                const windowName = window.appName.toLowerCase()
                return sourceName.includes(windowName) || sourceName.includes('teams')
              })

              // Create a virtual source for this window
              const virtualSource = {
                id: `virtual-window:${window.windowId || Date.now()}-${encodeURIComponent(window.appName)}`,
                name: `${window.appName} - ${window.windowTitle}`,
                type: 'window',
                thumbnail: null, // Will be captured when selected
                appIcon: null,
                isVisible: foundByDesktopCapturer || window.isOnScreen || false,
                isVirtual: true,
                appName: window.appName,
                windowTitle: window.windowTitle,
                windowId: window.windowId
              } as CaptureSource

              // Try to get a real thumbnail using desktopCapturer
              try {
                const electronSources = await desktopCapturer.getSources({
                  types: ['window'],
                  thumbnailSize: { width: 512, height: 288 },
                  fetchWindowIcons: true
                })

                // Try multiple matching strategies to find the window
                let matchingSource: DesktopCapturerSource | undefined = undefined

                // Strategy 1: Exact app name match
                matchingSource = electronSources.find((source) =>
                  source.name.toLowerCase().includes(window.appName.toLowerCase())
                )

                // Strategy 2: Partial match
                if (!matchingSource) {
                  matchingSource = electronSources.find(
                    (source) =>
                      window.appName.toLowerCase().includes(source.name.toLowerCase().split(' ')[0]) ||
                      source.name.toLowerCase().split(' ')[0].includes(window.appName.toLowerCase())
                  )
                }

                // Strategy 3: For specific known apps, try common variations
                if (!matchingSource && window.appName.includes('zoom')) {
                  matchingSource = electronSources.find((source) => source.name.toLowerCase().includes('zoom'))
                }

                if (matchingSource && matchingSource.thumbnail) {
                  virtualSource.thumbnail = matchingSource.thumbnail.toDataURL()
                  virtualSource.appIcon = matchingSource.app
```

### Core Architecture Module: `frontend/src/main/utils/get-visible-source.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { desktopCapturer } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getLogger } from '@shared/logger/main'

const logger = getLogger('getVisibleSource')
interface SourceVisibilityInfo {
  id: string
  isVisible: boolean
  name: string
}

export interface GetVisibleSourceResult {
  success: boolean
  sources?: SourceVisibilityInfo[]
  error?: string
}

const getVisibleSource: (sourceIds: string[]) => Promise<GetVisibleSourceResult> = async (sourceIds) => {
  try {
    if (sourceIds && sourceIds.length > 0) {
      logger.info('Checking active/focused apps for source IDs:', sourceIds)

      // Enhanced multi-space/multi-screen visibility detection
      let activeAppsOnAllSpaces: string[] = []
      if (process.platform === 'darwin') {
        try {
          const execAsync = promisify(exec)

          // Get apps that have visible windows on ANY space (not just current)
          const { stdout: visibleAppsStdout } = await execAsync(`osascript -e '
            tell application "System Events"
              set visibleApps to {}
              repeat with p in (every application process)
                try
                  -- Check if app has any windows
                  if (count of windows of p) > 0 then
                    set end of visibleApps to (name of p as string)
                  end if
                end try
              end repeat
              return my list_to_string(visibleApps, ",")
            end tell
            
            on list_to_string(lst, delim)
              set AppleScript's text item delimiters to delim
              set str to lst as string
              set AppleScript's text item delimiters to ""
              return str
            end list_to_string
          '`)

          if (visibleAppsStdout && visibleAppsStdout.trim()) {
            activeAppsOnAllSpaces = visibleAppsStdout
              .trim()
              .toLowerCase()
              .split(',')
              .map((app) => app.trim())
            logger.info(`Apps with windows on all spaces: [${activeAppsOnAllSpaces.join(', ')}]`)
          }

          // Also get the frontmost app on current space for additional context
          const { stdout: frontmostStdout } = await execAsync(
            `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
          )
          const frontmostApp = frontmostStdout.trim().toLowerCase()
          logger.info(`Frontmost app on current space: "${frontmostApp}"`)
        } catch (error: any) {
          logger.info('Could not get apps with windows:', error.message)
          // Fallback to assume all apps are visible
          activeAppsOnAllSpaces = []
        }
      }

      // Also get visible sources for fallback
      const visibleSources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1, height: 1 },
        fetchWindowIcons: false
      })

      const results = sourceIds.map((id) => {
        let isVisible = false
        let name = 'Unknown'

        if (id.startsWith('virtual-window:')) {
          const appNameMatch = id.match(/virtual-window:\d+-(.+)$/)
          if (appNameMatch) {
            name = decodeURIComponent(appNameMatch[1])

            // Enhanced visibility check: app is visible if it has windows on ANY space
            if (activeAppsOnAllSpaces.length > 0) {
              const appNameLower = name.toLowerCase()
              const hasWindowsOnAnySpace = activeAppsOnAllSpaces.some((activeApp) => {
                return (
                  activeApp.includes(appNameLower) ||
                  appNameLower.includes(activeApp) ||
                  (appNameLower === 'msteams' && activeApp.includes('teams')) ||
                  (appNameLower === 'microsoft teams' && activeApp.includes('teams')) ||
                  (appNameLower === 'wechat' && (activeApp.includes('wechat') || activeApp.includes('weixin'))) ||
                  (appNameLower === 'google chrome' && activeApp.includes('chrome')) ||
                  (appNameLower === 'visual studio code' &&
                    (activeApp.includes('code') || activeApp.includes('visual studio'))) ||
                  (appNameLower === 'microsoft powerpoint' &&
                    (activeApp.includes('powerpoint') || activeApp.includes('microsoft powerpoint'))) ||
                  (appNameLower === 'microsoft word' &&
                    (activeApp.includes('word') || activeApp.includes('microsoft word'))) ||
                  (appNameLower === 'microsoft excel' &&
                    (activeApp.includes('excel') || activeApp.includes('microsoft excel')))
                )
              })

              if (hasWindowsOnAnySpace) {
                isVisible = true
                logger.info(`Virtual window has windows on some space: ${id} -> ${name}`)
              } else {
                logger.info(`Virtual window has no windows on any space: ${id} -> ${name}`)
              }
            } else {
              // Fallback: if we can't detect apps with windows, assume visible
              isVisible = true
              logger.info(`Virtual window assumed visible (no space detection): ${id} -> ${name}`)
            }
          }
        } else {
          // For regular window IDs, check if they're actually visible
          const visibleSource = visibleSources.find((s) => s.id === id)
          if (visibleSource) {
            isVisible = true
            name = visibleSource.name
            logger.info(`Regular window found visible: ${id} -> ${name}`)
          } else {
            logger.info(`Regular window NOT visible: ${id}`)
          }
        }

        return { id, isVisible, name }
      })

      return { success: true, sources: results }
    } else {
      // Return all available sources
      const visibleSources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1, height: 1 },
        fetchWindowIcons: false
      })

      const allVisible = visibleSources.map((s) => ({
        id: s.id,
        name: s.name,
        isVisible: true
      }))

      return { success: true, sources: allVisible }
    }
  } catch (error: any) {
    logger.error('Error checking source visibility:', error)
    return { success: false, error: error.message }
  }
}

export { getVisibleSource }

```

### Core Architecture Module: `frontend/src/main/utils/index.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs'
import fsAsync from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

/**
 * Gets the absolute path to the 'resources' directory within the app.
 * ✨ Pro Tip: In a packaged app, `process.resourcesPath` is often a more reliable
 * way to get the root of the resources directory than `app.getAppPath()`.
 */
export const getResourcePath = (): string => {
  return path.join(app.getAppPath(), 'resources')
}

/**
 * Gets the path to the application's 'Data' directory, creating it if it doesn't exist.
 * ✨ Optimization: Removed the redundant `fs.existsSync` check. `mkdirSync` with the
 * `recursive: true` option handles this internally and won't throw an error if the path already exists.
 */
export const getDataPath = (): string => {
  const dataPath = path.join(app.getPath('userData'), 'Data')
  fs.mkdirSync(dataPath, { recursive: true })
  return dataPath
}

/**
 * Asynchronously calculates the total size of a directory and all its contents.
 * @param directoryPath The path to the directory.
 * @returns A promise that resolves to the total size in bytes.
 */
export const calculateDirectorySize = async (directoryPath: string): Promise<number> => {
  try {
    const items = await fsAsync.readdir(directoryPath)

    // ✨ Performance: Process all directory items in parallel instead of sequentially.
    const sizePromises = items.map(async (item) => {
      const itemPath = path.join(directoryPath, item)

      try {
        const stats = await fsAsync.stat(itemPath)

        if (stats.isFile()) {
          return stats.size
        }
        if (stats.isDirectory()) {
          // Recurse into subdirectory
          return await calculateDirectorySize(itemPath)
        }
      } catch (err) {
        // ✨ Robustness: Ignore files/directories that can't be accessed (e.g., permissions).
        console.error(`Could not stat path ${itemPath}:`, err)
        return 0
      }

      return 0 // Return 0 for other types like symlinks, etc.
    })

    const sizes = await Promise.all(sizePromises)

    // Sum up all the resolved sizes
    return sizes.reduce((acc, size) => acc + (size ?? 0), 0)
  } catch (err) {
    // ✨ Robustness: Handle cases where the top-level directory can't be read.
    console.error(`Could not read directory ${directoryPath}:`, err)
    return 0
  }
}

```

### Core Architecture Module: `frontend/src/main/utils/init.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { isLinux, isPortable, isWin } from '@main/constant'
import { app } from 'electron'
import { execSync } from 'node:child_process'

// Please don't import any other modules which is not node/electron built-in modules

function hasWritePermission(path: string) {
  try {
    fs.accessSync(path, fs.constants.W_OK)
    return true
  } catch (error) {
    return false
  }
}

function getConfigDir() {
  return path.join(os.homedir(), '.vikingdb', 'config')
}

function getDataDirFromRegistry() {
  if (!isWin) return null

  try {
    // Read data directory from Windows Registry with timeout protection
    const result = execSync('reg query "HKCU\\Software\\MineContext" /v DataDirectory', {
      encoding: 'utf8',
      timeout: 3000, // 3 second timeout to prevent hanging
      windowsHide: true
    })

    // Parse the registry output
    // Format: "DataDirectory    REG_SZ    C:\Users\...\AppData\Local\MineContext"
    const match = result.match(/DataDirectory\s+REG_SZ\s+(.+)/)
    if (match && match[1]) {
      const dataDir = match[1].trim()
      if (fs.existsSync(dataDir) && hasWritePermission(dataDir)) {
        return dataDir
      }
    }
  } catch (error) {
    // Registry key doesn't exist, timeout, or other error - ignore and use default
    console.warn('Failed to read data directory from registry:', error)
  }

  return null
}

export function initAppDataDir() {
  const appDataPath = getAppDataPathFromConfig()
  if (appDataPath) {
    app.setPath('userData', appDataPath)
    return
  }

  if (isPortable) {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
    app.setPath('userData', path.join(portableDir || app.getPath('exe'), 'data'))
    return
  }

  // For Windows installer version, check registry for custom data directory
  if (isWin && !isPortable) {
    // Try to get data directory from registry (set by installer)
    const registryDataDir = getDataDirFromRegistry()
    if (registryDataDir) {
      app.setPath('userData', registryDataDir)
      return
    }

    // If no registry setting, use the default AppData location
    // (e.g., %LOCALAPPDATA%\MineContext)
    // This is the correct fallback behavior
  }
}

function getAppDataPathFromConfig() {
  try {
    const configPath = path.join(getConfigDir(), 'config.json')
    if (!fs.existsSync(configPath)) {
      return null
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

    if (!config.appDataPath) {
      return null
    }

    let executablePath = app.getPath('exe')
    if (isLinux && process.env.APPIMAGE) {
      // 如果是 AppImage 打包的应用，直接使用 APPIMAGE 环境变量
      // 这样可以确保获取到正确的可执行文件路径
      executablePath = path.join(path.dirname(process.env.APPIMAGE), 'vikingdb.appimage')
    }

    if (isWin && isPortable) {
      executablePath = path.join(process.env.PORTABLE_EXECUTABLE_DIR || '', 'vikingdb-portable.exe')
    }

    let appDataPath = null
    // 兼容旧版本
    if (config.appDataPath && typeof config.appDataPath === 'string') {
      appDataPath = config.appDataPath
      // 将旧版本数据迁移到新版本
      appDataPath && updateAppDataConfig(appDataPath)
    } else {
      appDataPath = config.appDataPath.find(
        (item: { executablePath: string }) => item.executablePath === executablePath
      )?.dataPath
    }

    if (appDataPath && fs.existsSync(appDataPath) && hasWritePermission(appDataPath)) {
      return appDataPath
    }

    return null
  } catch (error) {
    return null
  }
}

export function updateAppDataConfig(appDataPath: string) {
  const configDir = getConfigDir()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  // config.json
  // appDataPath: [{ executablePath: string, dataPath: string }]
  const configPath = path.join(configDir, 'config.json')
  let executablePath = app.getPath('exe')
  if (isLinux && process.env.APPIMAGE) {
    executablePath = path.join(path.dirname(process.env.APPIMAGE), 'vikingdb.appimage')
  }

  // If it is a Windows portable version, use the PORTABLE_EXECUTABLE_FILE environment variable
  if (isWin && isPortable) {
    executablePath = path.join(process.env.PORTABLE_EXECUTABLE_DIR || '', 'vikingdb-portable.exe')
  }

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ appDataPath: [{ executablePath, dataPath: appDataPath }] }, null, 2))
    return
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  if (!config.appDataPath || (config.appDataPath && typeof config.appDataPath !== 'object')) {
    config.appDataPath = []
  }

  const existingPath = config.appDataPath.find(
    (item: { executablePath: string }) => item.executablePath === executablePath
  )

  if (existingPath) {
    existingPath.dataPath = appDataPath
  } else {
    config.appDataPath.push({ executablePath, dataPath: appDataPath })
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

```

### Core Architecture Module: `frontend/src/main/utils/mac-window-manager.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from 'child_process'
import { app } from 'electron'

import * as path from 'path'
import { getLogger } from '@shared/logger/main'
const logger = getLogger('mac-window-manager')
// --- Type Definitions ---

/**
 * @interface WindowBounds
 * @description Defines the structure for a window's geometric bounds.
 */
interface WindowBounds {
  X: number
  Y: number
  Width: number
  Height: number
}

/**
 * @interface QuartzWindowInfo
 * @description Represents the detailed window information parsed from the Python/Quartz script output.
 */
interface QuartzWindowInfo {
  windowId: number
  appName: string
  windowTitle: string
  bounds: WindowBounds
  isOnScreen: boolean
  layer: number
  isImportant: boolean
  area: number
}

/**
 * @interface FinalWindowInfo
 * @description The final, processed window information object returned by the module.
 */
export interface FinalWindowInfo {
  windowId: number
  appName: string
  windowTitle: string
  isOnScreen: boolean
  isImportantApp: boolean
  bounds?: WindowBounds
  layer?: number
}

// --- Private Helper Functions ---

/**
 * Executes a Python script that uses the Quartz framework to get detailed information
 * about all windows, including those on other spaces or minimized.
 * @returns A promise that resolves to an array of detailed window information objects.
 */
const getWindowsWithRealIds = (): Promise<QuartzWindowInfo[]> => {
  return new Promise((resolve, reject) => {
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, 'bin', 'window_inspector')
      : path.join(__dirname, '../..', 'externals/python/window_inspector/dist', 'window_inspector')
    const exePath = path.join(basePath, 'window_inspector')
    const py = spawn(exePath)

    let output = ''
    let error = ''

    py.stdout.on('data', (data) => (output += data.toString()))
    py.stderr.on('data', (data) => (error += data.toString()))

    py.on('close', (code) => {
      if (code === 0 && output) {
        try {
          resolve(JSON.parse(output))
        } catch (err) {
          reject(err)
        }
      } else {
        reject(new Error(error || 'Python script failed'))
      }
    })
  })
}

// --- Exported Functions ---

/**
 * Gets a list of all relevant application windows. It first attempts to use a detailed
 * method via Python/Quartz for accuracy and falls back to a simpler AppleScript method.
 * @returns A promise that resolves to an array of processed window information.
 */
export const getAllWindows = async (): Promise<FinalWindowInfo[]> => {
  try {
    const windowsWithIds = await getWindowsWithRealIds()

    if (windowsWithIds.length > 0) {
      const allWindows: FinalWindowInfo[] = []
      const importantApps = [
        'zoom.us',
        'Zoom',
        'Microsoft PowerPoint',
        'Notion',
        'Slack',
        'Microsoft Teams',
        'MSTeams',
        'Teams',
        'Discord',
        'Google Chrome',
        'Microsoft Word',
        'Microsoft Excel',
        'Keynote',
        'Figma',
        'Sketch',
        'Adobe Photoshop',
        'Visual Studio Code',
        'Cursor',
        'Safari',
        'Firefox',
        'WeChat',
        'Obsidian',
        'Roam Research'
      ]

      const systemApps = [
        'MineContext',
        'Electron',
        'SystemUIServer',
        'Dock',
        'ControlCenter',
        'WindowManager',
        'NotificationCenter',
        'Spotlight'
      ]

      for (const window of windowsWithIds) {
        if (systemApps.includes(window.appName)) {
          continue
        }

        const isImportant = importantApps.some((app) => window.appName.toLowerCase().includes(app.toLowerCase()))

        if (window.windowTitle || isImportant) {
          let finalTitle = window.windowTitle

          if (!finalTitle.trim()) {
            if (window.appName.includes('zoom')) finalTitle = 'Zoom Meeting'
            else if (window.appName.includes('PowerPoint')) finalTitle = 'PowerPoint Presentation'
            else if (window.appName.includes('Notion')) finalTitle = 'Notion Workspace'
            else if (window.appName.includes('Teams')) finalTitle = 'Teams Meeting'
            else finalTitle = `${window.appName} Window`
          }

          allWindows.push({
            windowId: window.windowId,
            appName: window.appName,
            windowTitle: finalTitle,
            isOnScreen: window.isOnScreen,
            bounds: window.bounds,
            isImportantApp: isImportant,
            layer: window.layer
          })
        }
      }

      // Sort to prioritize important apps
      allWindows.sort((a, b) => {
        if (a.isImportantApp && !b.isImportantApp) return -1
        if (!a.isImportantApp && b.isImportantApp) return 1
        return a.appName.localeCompare(b.appName)
      })

      return allWindows
    }

    // Fallback logic is removed for simplicity, as the Python method is the primary strategy.
    // If needed, the AppleScript fallback could be implemented here.
    return []
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error in getAllWindows:', error.message)
    }
    return []
  }
}

```

### Core Architecture Module: `frontend/src/main/utils/native-capture-helper.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import * as nodeScreenshots from 'node-screenshots'
import { getLogger } from '@shared/logger/main'

const logger = getLogger('NativeCaptureHelper')

class NativeCaptureHelper {
  public isRunning: boolean = false
  public screenshots: typeof nodeScreenshots | null = null

  constructor() {}

  async initialize(): Promise<void> {
    logger.info('Initializing Native Capture Helper (Pure JavaScript)...')

    try {
      // Import node-screenshots dynamically
      this.screenshots = nodeScreenshots

      // Test that the module works
      if (!this.screenshots) {
        throw new Error('Failed to load node-screenshots module.')
      }
      const monitors = this.screenshots.Monitor.all()
      logger.info(`[Native Helper] Found ${monitors.length} monitor(s)`)

      this.isRunning = true
      logger.info('✅ Native Capture Helper initialized successfully (Python-free!)')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.'
      throw new Error(`Native capture helper failed to initialize: ${message}`)
    }
  }

  // High-level methods using pure JavaScript

  async getAllWindows(): Promise<any[]> {
    if (!this.isRunning) {
      throw new Error('Helper not initialized')
    }

    try {
      // This is a simplified implementation. For full window management,
      // a native addon or a different approach would be needed.
      logger.info('[Native Helper] Using simplified window detection (visible windows only)')

      // Return empty for now. The main focus is screen capture.
      // Individual window capture will fall back to desktopCapturer in electron.js
      return []
    } catch (error: unknown) {
      logger.error('Failed to get windows from native helper:', error)
      return []
    }
  }

  async captureWindow(windowId: string | number): Promise<{ success: boolean; error: string }> {
    if (!this.isRunning) {
      throw new Error('Helper not initialized')
    }

    try {
      logger.info(`[Native Helper] Pure JS window capture not supported for windowId ${windowId}`)

      // For a pure JavaScript solution, we can't capture specific windows by ID.
      // This will gracefully fail and let the caller fall back to other methods.
      return {
        success: false,
        error: 'Pure JavaScript helper does not support individual window capture by ID'
      }
    } catch (error: unknown) {
      logger.error(`Failed to capture window ${windowId}:`, error)
      const message = error instanceof Error ? error.message : 'An unknown error occurred.'
      return {
        success: false,
        error: message
      }
    }
  }

  async captureScreen(
    monitorIndex: number = 0
  ): Promise<{ success: boolean; data?: Buffer; size?: number; error?: string }> {
    if (!this.isRunning || !this.screenshots) {
      throw new Error('Helper not initialized or screenshots module not loaded')
    }

    try {
      logger.info(`[Native Helper] Capturing screen ${monitorIndex} using node-screenshots`)

      const monitors = this.screenshots.Monitor.all()
      if (monitorIndex >= monitors.length) {
        return {
          success: false,
          error: `Monitor ${monitorIndex} not found. Available monitors: ${monitors.length}`
        }
      }

      const monitor = monitors[monitorIndex]
      const image = monitor.captureImageSync()
      const pngBuffer = image.toPngSync()

      logger.info(`[Native Helper] Screen capture successful, size: ${pngBuffer.length} bytes`)

      return {
        success: true,
        data: pngBuffer,
        size: pngBuffer.length
      }
    } catch (error: unknown) {
      logger.error(`Failed to capture screen ${monitorIndex}:`, error)
      const message = error instanceof Error ? error.message : 'An unknown error occurred.'
      return {
        success: false,
        error: message
      }
    }
  }

  async captureApp(appName: string): Promise<{ success: boolean; data?: Buffer; size?: number; error?: string }> {
    if (!this.isRunning) {
      throw new Error('Helper not initialized')
    }

    try {
      logger.info(`[Native Helper] Pure JS app capture for: ${appName}`)
      logger.info(`[Native Helper] Note: Individual app capture not supported, falling back to screen capture`)

      // Since we can't capture individual apps with node-screenshots,
      // we'll capture the primary screen as a fallback.
      // The main Electron code will handle specific window capture via desktopCapturer.

      return await this.captureScreen(0) // Capture primary monitor
    } catch (error: unknown) {
      logger.error(`Failed to capture app ${appName}:`, error)
      const message = error instanceof Error ? error.message : 'An unknown error occurred.'
      return {
        success: false,
        error: message
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.isRunning) {
      logger.info('Shutting down native capture helper')
      this.isRunning = false
    }
  }
}

export { NativeCaptureHelper }

```

### Core Architecture Module: `frontend/src/main/utils/time.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

// Store to SQLite (always store in UTC)
export const toSqliteDatetime = (date: Date | string | number): string => {
  return dayjs(date).utc().format('YYYY-MM-DD HH:mm:ss')
}
export const isValidIsoString = (isoString: string): boolean => {
  // 第二个参数 true 表示启用严格模式，要求格式和 ISO 8601 完全匹配
  return dayjs(isoString).isValid()
}
// Read from SQLite (convert to local time zone)
export const fromSqliteDatetime = (sqliteDate: string, tz: string = dayjs.tz.guess()): string => {
  return dayjs.utc(sqliteDate).tz(tz).format('YYYY-MM-DD HH:mm:ss')
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #345** (2026-03-04): **[BUG]: 1.8 version加载 custom 模型失败**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  1.7版本可以正确连接加载，1.8出现如下错误  <img width="1724" height="961" alt="Image" src="https://github.com/user-attachments/assets/ee9cc0a3-9d32-4b87-8aff-fa31e8a6700c" />  ### 🧑‍💻 Step to reproduce  1.下载minecontext 和lemonade server（https://[zhuanlan.zhihu.com/p/1899781032246490811](https://zhuanlan.zhihu.com/p/1899781032246490811)）服务器 2.安装 3.lemonade server启动，连接相应的url及填写对应模型名字 http://127.0.0.1:8000/api/v1  ### 👾 Expected result  实现正确连接，同样的方式在1.7上可以正确连接，1.8报错  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  1.8  ### 💻 Platform Details  windows 11

- **Issue #335** (2026-01-30): **[BUG]: 处理屏幕截图失败**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  Screen Monitor下报错：n screenshots failed: Failed during concurrent VLM processing: 'str' object has no attribute 'value'.  ### 🧑‍💻 Step to reproduce  1.README_zh.md中下载MineContext-0.1.8-setup.exe 2.模型doubao-seeding-1.6-flash 3.开启屏幕录制 4.设置录制间隔60s  ### 👾 Expected result  如README中的描述正常工作  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.8  ### 💻 Platform Details  W11 24H2 26100.7462
  **Post-Mortem & Fix Analysis**:
  > 是偶发的吗，应该是大模型的输出幻觉
  > same to #326
  > > 是偶发的吗，应该是大模型的输出幻觉 1.昨日中午和下午都存在此BUG 2.刚刚尝试，没有bug消息，但是半个小时过去，也没见总结生成的activity、tips或者其他的什么。home页还是空空如也 3.token是被正常消耗了的，昨天的总计300w左右，调用了477次（这个APIKEY只配给了MineContext) 

- **Issue #330** (2026-01-26): **[BUG]: 修改日报定时生成时间后不生效，仍按照默认时间生成**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  在 MineContext 后台设置页面修改定时生成日报的时间（例如从默认的 08:00 改为 14:00）后，保存并显示配置已更新。但第二天生成的日报依然按照默认的早上 8 点生成，未按照新设置的时间 14:00 生成。需重启服务后设置才会生效。此问题影响每日自动日报的灵活性和准确性。  ### 🧑‍💻 Step to reproduce  1. 打开 MineContext 系统设置页面。 2. 在"内容生成"标签页，找到"日报生成"部分。 3. 勾选启用日报生成，并将生成时间从 08:00 修改为 14:00。 4. 点击保存设置。 5. 等待第二天，发现日报仍于 08:00 生成，而不是设置的 14:00。  ### 👾 Expected result  期望系统能在设置的日报生成时间（如 14:00）自动生成日报，而不是始终按照默认的 08:00。更改日报生成时间后无须重启服务即可即时生效。  ### 🚑 Any additional information  - 手动重启后端服务后，新的时间才会生效。 - 猜测可能为后端运行时配置未同步更新，需将配置变更后通知 ConsumptionManager 实例。  ---  **代码引用：**  - `opencontext/server/routes/settings.py` [`update_general_settings`](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/server/routes/settings.py#L330-L367) - `opencontext/managers/consumption_manager.py` [`update_task_config`](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/managers/consumption_manager.py#L452-L481) - 参考 `/api/content_generation/config` 的处理逻辑：[content_generation.py#L114-L133](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/server/routes/content_generation.py#L114-L133)  ---  **建议修改代码（直接可用 patch）：**  在 `opencontext/server/routes/settings.py` 的 `update_general_settings()` 方法保存、reload 配置后，补充后端配置热更新逻辑，如下（插入到 reload config 之后）：  ```python # ... 已有配置保存与 reload 逻辑 config_mgr.load_config(config_mgr.get_config_path())  # 新增：同

- **Issue #328** (2026-01-28): **[BUG]: 火山接口无法使用**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it   ### 🧑‍💻 Step to reproduce  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it  ### 👾 Expected result  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.17  ### 💻 Platform Details  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it
  **Post-Mortem & Fix Analysis**:
  > me too  <img width="2360" height="1320" alt="Image" src="https://github.com/user-attachments/assets/b0340bca-1232-46c1-a799-5d486c0a27d4" />
  > > me too >  > <img alt="Image" width="2000" height="1320" src="https://private-user-images.githubusercontent.com/26535864/540511638-b0340bca-1232-46c1-a799-5d486c0a27d4.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Njk0MzM5NzYsIm5iZiI6MTc2OTQzMzY3NiwicGF0aCI6Ii8yNjUzNTg2NC81NDA1MTE2MzgtYjAzNDBiY2EtMTIzMi00NmMxLWE3OTktNWQ0ODZjMGEyN2Q0LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAxMjYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMTI2VDEzMjExNlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTgxNjlmMjYyNDA4ODE4NDBhYjgyYmJlNGRkNmFmODQ0ZjhhZTZiOTBjNDNjNDdjNTg2ZWNiNDE2YTM4NGRlOGQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.DImDAgx9llug4Djng48fqBXaVrNbs9h5x1KtM2NDMRI">  一样
  > https://github.com/volcengine/MineContext/releases/tag/v0.1.8 试下这个

- **Issue #324** (2026-01-30): **[BUG]: doubao-embedding-large-text-240915似乎已下线**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  <img width="1079" height="922" alt="Image" src="https://github.com/user-attachments/assets/230c3296-e352-409c-872a-5917e7362557" />  ### 🧑‍💻 Step to reproduce  启动时填写api就会发生这个问题  ### 👾 Expected result  希望修改默认的embedding模型  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.7  ### 💻 Platform Details  Windows
  **Post-Mortem & Fix Analysis**:
  > 是的，在输入APK的时候也碰到了同样问题
  > 我也遇见了这个问题 
  > Mac遇到问题加一

- **Issue #316** (2025-12-25): **[BUG]: 前端设置60s截图一次，实际截图1分钟16，17一次**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  前端设置60s截图一次，实际截图1分钟16，17次。 The frontend is set to take screenshots every 60 seconds, but in reality, it captures screenshots 16 to 17 times per minute.  ### 🧑‍💻 Step to reproduce  1. In GUI, In ScreenMonitor -> Settings 2. configure interval to 60s and save 3. Click "Start Recording" 4. Check recording folders (frontend/backend/screenshot/activity/2025/12-16). 5. There are 16 or 17 folders every minute.  ### 👾 Expected result  I expected that the screenshot folder should be generated every minutes.  ### 🚑 Any additional information  Rootcause is found:  原因：单位换算错误  - 现象 ：在 GUI 设置了 60s，但系统每分钟生成约 17 个目录（约每 3.5 秒一个）。 - 代码逻辑 ：   - 前端 ScreenSettings 中存储的 recordInterval 单位是 秒 （例如 60 ）。   - 后端任务调度器 ScheduleNextTask 期望的单位是 毫秒 。   - 在 ScreenMonitorTask.ts 中，直接将 60 传给了调度器： this.updateInterval(config.recordInterval) 。   - 结果：调度器试图每 60毫秒 执行一次截图。   - 实际频率 ：由于截图操作本身（获取源、转换图片、写入磁盘）大约需要 3-4 秒，所以实际上变成了“尽可能快地截图”，导致每分钟约 16-17 次（60秒 / 3.5秒 ≈ 17）。  Reason: Unit conversion error    - Symptom: set 60s in the GUI, but the system generates about 17 directories per minute (approximately one every 3.5 seconds).   - Code logic:     - The recordInterval stored in the frontend ScreenSettings is in seconds (e.g., 60).     - The backend task scheduler ScheduleNextTask expects the unit to be milliseconds.     - In ScreenMonitorTask.ts, the value 60 is directly passed to the scheduler: this.updateInterval(config.recordInterval).     - Result: 
  **Post-Mortem & Fix Analysis**:
  > i also meet this issue

- **Issue #304** (2025-12-05): **[BUG]: MineContext 使用 Qwen3 模型时 Token 消耗异常高**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  **问题描述**   MineContext 在调用阿里云 Qwen3 系列模型（如 `qwen3-vl-plus` 和 `qwen3-max`）时，Token 消耗量远超合理范围，导致用户成本激增。    **关键数据记录**   - **模型版本**：`qwen3-vl-plus-2025-09-23`    - 调用总次数：325 次     - 失败总次数：114 次     - 限流错误次数：95 次     - 总 Token 量：1,403.1 千 Token     - 输入 Token 总量：1,298.5 千 Token     - 输出 Token 总量：104.7 千 Token    - **对比模型**：`text-embedding-v3`     - 调用总次数：526 次     - 总 Token 量：21.5 千 Token    **现象说明**   - 使用 `qwen3-vl-plus` 等旗舰视觉模型时，单日消耗约 200 万 Token。   - 与 `text-embedding-v3` 相比，消耗量高出 **65 倍以上**（1,403.1K vs 21.5K），且失败率与限流错误率显著偏高（失败率 35.1%，限流率 29.2%）。  ### 🧑‍💻 Step to reproduce  ...  ### 👾 Expected result  ...  ### 🚑 Any additional information  ...  ### 🛠️ MineContext Version  ..  ### 💻 Platform Details  ...
  **Post-Mortem & Fix Analysis**:
  > 这个是正常的，vlm分析截图使用的token比较高。embedding 模型输入的是文本
  > 可以调大截图的间隔或者减少截图的范围

- **Issue #301** (2025-12-05): **[BUG]:**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  MineContext 请求失败，都是显示超时，0 成功，LM Studio 显示不少成功日志 已知：配置正确，截图正确、LM 接收正确、模型处理正确 未知：超时原因是否是设置的 超时判断过短，还是其他原因 结果：用不起来，希望排查解决  ### 🧑‍💻 Step to reproduce  MineContext 请求失败， 0 成功 <img width="638" height="278" alt="Image" src="https://github.com/user-attachments/assets/694e6720-7c33-45d1-93f2-7ed30a5930ad" />  <img width="1576" height="538" alt="Image" src="https://github.com/user-attachments/assets/bd5640df-8904-4928-8065-01a9530fd47b" />  LM  studio 产生了结果：  <img width="2242" height="1116" alt="Image" src="https://github.com/user-attachments/assets/e716a855-1a4c-42d0-b80f-1b7f186d710d" />  ### 👾 Expected result  可能是本地模型的耗时引起，单图片处理 1 分多钟，建议将超时的判断延长到更长，如3分钟或者 5 分  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.6  ### 💻 Platform Details  MineConetext 安装在 macbook pro M1 version ： Sequoia Version 15.1
  **Post-Mortem & Fix Analysis**:
  > 可以改下 /Users/bytedance/Library/Application Support/MineContext/config/user_setting.yaml 里的模型配置，加个 timeout 参数就可以了，单位是s

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

### Incident Patch 1: `171c7a9e` (2026-05-07)
**Commit Message**: fix(security): sandbox vikingdb:// protocol to userData directory (#363)

The renderer-loadable `vikingdb://` protocol read any local file the
main-process had access to: the handler ran `path.resolve(filePath)` and
passed the result straight to `fs.readFileSync` with no allow-list. A
markdown image such as `![](vikingdb:///Users/<u>/.ssh/id_rsa)` rendered
in any vault note, chat reply, or LLM response would have caused the main
process to read that file and stream the bytes back into the renderer.

This is amplified by two adjacent settings:

  * `webPreferences.webSecurity` is `false`, so the renderer can `fetch()`
    a custom-protocol URL and read the response body in JS.
  * `renderer/index.html`'s CSP allows `connect-src *` and
    `script-src 'unsafe-inline' 'unsafe-eval' *`, so any future renderer
    XSS — including a stored one in vault content — has unrestricted
    network egress.

Combined, the original handler turned even a minor renderer XSS into a
full local-file exfiltration primitive.

Fix: constrain the resolved path to the directory the backend writes its
data into. In production this is `app.getPath('userData')`, which mirrors
`CONTEXT_PATH` in `backend.ts` (th

**File**: `frontend/src/main/index.ts` (modified, +40/-18)
```diff
@@ -198,28 +198,50 @@ app.whenReady().then(() => {
       let filePath = request.url.replace('vikingdb://', '')
       filePath = decodeURIComponent(filePath)
 
-      const fullPath = path.resolve(filePath)
+      const resolved = path.resolve(filePath)
 
-      console.log('Reading file:', fullPath)
+      if (!fs.existsSync(resolved)) {
+        callback({ error: -6 /* net::ERR_FILE_NOT_FOUND */ })
+        return
+      }
 
-      if (fs.existsSync(fullPath)) {
-        const data = fs.readFileSync(fullPath)
-        const extension = path.extname(fullPath).toLowerCase()
+      // Constrain reads to the directory the backend writes its data into
+      // (mirrors `CONTEXT_PATH` in backend.ts). Without this, the renderer
+      // can read arbitrary local files via e.g. `vikingdb:///Users/<u>/.ssh/id_rsa`,
+      // which combined with `webSecurity: false` and the permissive CSP
+      // (`connect-src *`) makes any future renderer XSS a full local-file
+      // exfiltration primitive. We also realpath() the resolved path so a
+      // symlink planted inside userData cannot be used to escape the sandbox.
+      const allowedRoot =
+        !app.isPackaged && is.dev
+          ? path.resolve('.')
+          : path.resolve(app.getPath('userData'))
+      const realPath = fs.realpathSync(resolved)
+      const isUnderRoot =
+        realPath === allowedRoot || realPath.startsWith(allowedRoot + path.sep)
+
+      if (!isUnderRoot) {
+        console.error(
+          `vikingdb:// blocked path outside allowed root: ${realPath} (root: ${allowedRoot})`
+        )
+        callback({ error: -10 /* net::ERR_ACCESS_DENIED */ })
+        return
+      }
 
-        // Set MIME type based on file extension
-        let mimeType = 'application/octet-stream'
-        if (extension === '.png') mimeType = 'image/png'
-        else if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg'
-        else if (extension === '.gif') mimeType = 'image/gif'
-        else if (extension === '.svg') mimeType = 'image/svg+xml'
+      const data = fs.readFileSync(realPath)
+      const extension = path.extname(realPath).toLowerCase()
 
-        callback({
-          mimeType: mimeType,
-          data: data
-        })
-      } else {
-        callback({ error: -6 })
-      }
+      // Set MIME type based on file extension
+      let mimeType = 'application/octet-stream'
+      if (extension === '.png') mimeType = 'image/png'
+      else if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg'
+      else if (extension === '.gif') mimeType = 'image/gif'
+      else if (extension === '.svg') mimeType = 'image/svg+xml'
+
+      callback({
+        mimeType: mimeType,
+        data: data
+      })
     } catch (error) {
       console.error('Error reading file:', error)
       callback({ error: -2 })
```

---

### Incident Patch 2: `e7824081` (2026-05-06)
**Commit Message**: Create SECURITY.md (#364)

**File**: `SECURITY.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+## Security and privacy
+
+If you discover potential security issues in the project, or believe you may have found a security issue, please notify the ByteDance security team through our [security center](https://security.bytedance.com/src/) or [vulnerability reporting email](mailto:src@bytedance.com). Please do not create public GitHub Issues.
+
+We will assess the vulnerability based on the Common Vulnerability Scoring System (CVSS 3.1). The security team will keep you updated on key progress and may request further information or guidance from you. You are welcome to contact us via the email or website mentioned above to ask questions or discuss disclosure matters.
+
+To protect the security of our customers, ByteDance requests that you do not publish or share information regarding the vulnerability in any public forum, nor publish or share data involving users, until the vulnerability has been remediated and our users have been notified. Please understand that the time required for remediation depends on the severity of the vulnerability and the scope of the impact.
+
+Individuals, companies, and security teams may wish to publish security advisories on their own websites or other forums. Please contact us via the email or website mentioned above prior to publication to discuss the information that can be disclosed and to coordinate the disclosure timeline.
+
+## Bug Bounty Reward
+
+[For the policy of bug bounty reward](https://bytedance.larkoffice.com/docx/ZstQd7bbooDctqxBCAmcFasOngd), if you have any questions about the rules, please contact [https://src.bytedance.com/home](https://src.bytedance.com/home) for consultation.
```

---

### Incident Patch 3: `fc2ddb1d` (2026-03-10)
**Commit Message**: fix(llm): Fix when use custom embedding providers. (#339)

* fix(llm): Fix when use custom embedding providers.

* fix validate.

* fix validate.

**File**: `opencontext/llm/llm_client.py` (modified, +5/-4)
```diff
@@ -266,14 +266,14 @@ async def _openai_chat_completion_stream_async(self, messages: List[Dict[str, An
 
     def _request_embedding(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.DOUBAO.value:
+            if self.provider != LLMProvider.DOUBAO.value:
+                response = self.client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
+            else:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
-            else:
-                response = self.client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -314,6 +314,7 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
     async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
         try:
             if self.provider == LLMProvider.DOUBAO.value:
+                # Only ark has multimodal_embeddings
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
```

---

### Incident Patch 4: `1bdaee94` (2026-03-05)
**Commit Message**: fix: replace bare except clauses with except Exception (#344)

Bare `except:` catches BaseException including KeyboardInterrupt and
SystemExit. This replaces 9 bare except clauses with
`except Exception:` to only catch application-level exceptions.

Co-authored-by: haosenwang1018 <[REDACTED_EMAIL]>

**File**: `opencontext/context_consumption/generation/smart_todo_manager.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def generate_todo_tasks(self, start_time: int, end_time: int) -> Optional[str]:
                             deadline = datetime.datetime.strptime(deadline_str, "%Y-%m-%d %H:%M")
                         else:
                             deadline = datetime.datetime.strptime(task["due_date"], "%Y-%m-%d")
-                    except:
+                    except Exception:
                         pass
 
                 todo_id = get_storage().insert_todo(
```

**File**: `opencontext/llm/llm_client.py` (modified, +1/-1)
```diff
@@ -439,7 +439,7 @@ def _extract_error_summary(error: Any) -> str:
                                         if ". Request id:" in actual_msg:
                                             actual_msg = actual_msg.split(". Request id:")[0]
                                         return actual_msg
-                            except:
+                            except Exception:
                                 pass
                         return f"Error {code}"
 
```

**File**: `opencontext/monitoring/metrics_collector.py` (modified, +2/-2)
```diff
@@ -48,7 +48,7 @@ def wrapper(*args, **kwargs):
                     if hasattr(result, "__len__") and not isinstance(result, str):
                         try:
                             context_count = len(result)
-                        except:
+                        except Exception:
                             context_count = 1
 
                     monitor.record_processing_metrics(
@@ -94,7 +94,7 @@ def wrapper(*args, **kwargs):
                     elif hasattr(result, "__len__") and not isinstance(result, str):
                         try:
                             snippets_count = len(result)
-                        except:
+                        except Exception:
                             snippets_count = 0
 
                     # 尝试从参数中获取query
```

**File**: `opencontext/storage/backends/sqlite_backend.py` (modified, +4/-4)
```diff
@@ -951,7 +951,7 @@ def save_monitoring_token_usage(
             logger.error(f"Failed to save token usage: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1047,7 +1047,7 @@ def save_monitoring_stage_timing(
             logger.error(f"Failed to save stage timing: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1087,7 +1087,7 @@ def save_monitoring_data_stats(
             logger.error(f"Failed to save data stats: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1313,7 +1313,7 @@ def cleanup_old_monitoring_data(self, days: int = 7) -> bool:
             logger.error(f"Failed to cleanup old monitoring data: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
```

**File**: `opencontext/utils/json_parser.py` (modified, +1/-1)
```diff
@@ -101,5 +101,5 @@ def fix_quotes_in_match(match):
     try:
         fixed = re.sub(pattern, fix_quotes_in_match, json_str)
         return fixed
-    except:
+    except Exception:
         return json_str
```

---

### Incident Patch 5: `d13818b8` (2026-03-04)
**Commit Message**: fix: resolve AttributeError crash in ScreenshotCapture._get_statistics_impl

**File**: `opencontext/context_capture/screenshot.py` (modified, +9/-12)
```diff
@@ -481,27 +481,24 @@ def _get_statistics_impl(self) -> Dict[str, Any]:
         Returns:
             Dict[str, Any]: Statistics information
         """
-        active_contexts_info = {}
-        for monitor_id, history in self._active_screenshots.items():
-            active_contexts_info[monitor_id] = [
-                {
-                    "uuid": ctx.uuid,
-                    "duration_count": ctx.metadata.get("duration_count"),
-                    "timestamp": ctx.metadata.get("timestamp"),
-                }
-                for img, ctx in history
-            ]
+        last_screenshots_info = {}
+        for monitor_id, (img, ctx) in self._last_screenshots.items():
+            last_screenshots_info[monitor_id] = {
+                "uuid": ctx.uuid,
+                "duration_count": ctx.additional_info.get("duration_count"),
+                "timestamp": ctx.additional_info.get("timestamp"),
+            }
 
         return {
             "screenshot_count": self._screenshot_count,
-            "active_screenshots": active_contexts_info,
+            "last_screenshots": last_screenshots_info,
         }
 
     def _reset_statistics_impl(self) -> None:
         """
         Reset statistics implementation
         """
         self._screenshot_count = 0
-        self._active_screenshots = {}
+        self._last_screenshots.clear()
         self._last_screenshot_time = None
         self._last_screenshot_path = None
```

---

### Incident Patch 6: `f758087d` (2026-03-04)
**Commit Message**: fix: correct embedding provider detection for non-Doubao providers (#347)

**File**: `opencontext/llm/llm_client.py` (modified, +15/-15)
```diff
@@ -266,14 +266,14 @@ async def _openai_chat_completion_stream_async(self, messages: List[Dict[str, An
 
     def _request_embedding(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.OPENAI.value:
-                response = self.client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
-            else:
+            if self.provider == LLMProvider.DOUBAO.value:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
+            else:
+                response = self.client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -313,14 +313,14 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
 
     async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.OPENAI.value:
-                response = await self.async_client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
-            else:
+            if self.provider == LLMProvider.DOUBAO.value:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
+            else:
+                response = await self.async_client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -476,20 +476,20 @@ def _extract_error_summary(error: Any) -> str:
 
             elif self.llm_type == LLMType.EMBEDDING:
                 # Test with a simple text
-                if self.provider == LLMProvider.OPENAI.value:
-                    response = self.client.embeddings.create(model=self.model, input=["test"])
-                    if response.data and len(response.data) > 0 and response.data[0].embedding:
-                        return True, "Embedding model validation successful"
-                    else:
-                        return False, "Embedding model returned empty response"
-                else:
+                if self.provider == LLMProvider.DOUBAO.value:
                     response = self.client.multimodal_embeddings.create(
                         model=self.model, input=[{"type": "text", "text": "test"}]
                     )
                     if response.data and response.data.embedding:
                         return True, "Embedding model validation successful"
                     else:
                         return False, "Embedding model returned empty response"
+                else:
+                    response = self.client.embeddings.create(model=self.model, input=["test"])
+                    if response.data and len(response.data) > 0 and response.data[0].embedding:
+                        return True, "Embedding model validation successful"
+                    else:
+                        return False, "Embedding model returned empty response"
             else:
                 return False, f"Unsupported LLM type: {self.llm_type}"
 
```

---

### Incident Patch 7: `e3d39bb2` (2026-01-28)
**Commit Message**: Fix tokens (#334)

* fix

* fix: context type

* Update download links to version 0.1.8

* Update download links in README_zh.md

Updated download links for Mac and Windows to version 0.1.8.

---------

Co-authored-by: qin-ctx <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ An open-source, proactive context-aware AI partner, dedicated to bringing clarit
 
 🌍 Join our [Discord Group](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Download for Windows</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8-setup.exe">💻 Download for Windows</a>
 
 </div>
 
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 🌍 加入我们的 [Discord 社区](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Windows 版下载</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8-setup.exe">💻 Windows 版下载</a>
 
 </div>
   
```

**File**: `opencontext/llm/llm_client.py` (modified, +38/-30)
```diff
@@ -14,8 +14,8 @@
 from volcenginesdkarkruntime import Ark
 
 from opencontext.models.context import Vectorize
-from opencontext.utils.logging_utils import get_logger
 from opencontext.monitoring import record_processing_stage
+from opencontext.utils.logging_utils import get_logger
 
 logger = get_logger(__name__)
 
@@ -42,7 +42,9 @@ def __init__(self, llm_type: LLMType, config: Dict[str, Any]):
         if not self.api_key or not self.base_url or not self.model:
             raise ValueError("API key, base URL, and model must be provided")
         self.client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
-        self.async_client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
+        self.async_client = AsyncOpenAI(
+            api_key=self.api_key, base_url=self.base_url, timeout=self.timeout
+        )
         if self.provider == LLMProvider.DOUBAO.value and self.llm_type == LLMType.EMBEDDING:
             self.client = Ark(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
             self.async_client = None
@@ -268,24 +270,29 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
                 response = self.client.embeddings.create(model=self.model, input=[text])
                 embedding = response.data[0].embedding
             else:
-                response = self.client.multimodal_embeddings.create(model=self.model, input=[
-                    {
-                        "type": "text",
-                        "text": text
-                    }
-                ])
+                response = self.client.multimodal_embeddings.create(
+                    model=self.model, input=[{"type": "text", "text": text}]
+                )
                 embedding = response.data.embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
                 try:
                     from opencontext.monitoring import record_token_usage
 
+                    usage = response.usage
+                    if isinstance(usage, dict):
+                        prompt_tokens = usage.get("prompt_tokens", 0)
+                        total_tokens = usage.get("total_tokens", 0)
+                    else:
+                        prompt_tokens = usage.prompt_tokens
+                        total_tokens = usage.total_tokens
+
                     record_token_usage(
                         model=self.model,
-                        prompt_tokens=response.usage.prompt_tokens,
+                        prompt_tokens=prompt_tokens,
                         completion_tokens=0,  # embedding has no completion tokens
-                        total_tokens=response.usage.total_tokens,
+                        total_tokens=total_tokens,
                     )
                 except ImportError:
                     pass  # Monitoring module not installed or initialized
@@ -310,24 +317,29 @@ async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
                 response = await self.async_client.embeddings.create(model=self.model, input=[text])
                 embedding = response.data[0].embedding
             else:
-                response = self.client.multimodal_embeddings.create(model=self.model, input=[
-                    {
-                        "type": "text",
-                        "text": text
-                    }
-                ])
+                response = self.client.multimodal_embeddings.create(
+                    model=self.model, input=[{"type": "text", "text": text}]
+                )
                 embedding = response.data.embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
                 try:
                     from opencontext.monitoring import record_token_usage
 
+                    usage = response.usage
+                    if isinstance(usage, dict):
+                        prompt_tokens = usage.get("prompt_tokens", 0)
+                        total_tokens = usage.get("total_tokens", 0)
+                    else:
+                        prompt_tokens = usage.prompt_tokens
+                        total_tokens = usage.total_tokens
+
                     record_token_usage(
                         model=self.model,
-                        prompt_tokens=response.usage.prompt_tokens,
+                        prompt_tokens=prompt_tokens,
                         completion_tokens=0,  # embedding has no completion tokens
-                        total_tokens=response.usage.total_tokens,
+                        total_tokens=total_tokens,
                     )
                 except ImportError:
                     pass  # Monitoring module not installed or initialized
@@ -346,20 +358,19 @@ async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
             logger.error(f"OpenAI API error during embedding: {e}")
           
```

**File**: `opencontext/server/context_operations.py` (modified, +8/-2)
```diff
@@ -14,7 +14,12 @@
 from typing import Any, Dict, List, Optional
 
 from opencontext.models.context import ProcessedContext, RawContextProperties, Vectorize
-from opencontext.models.enums import ContentFormat, ContextSource, ContextType
+from opencontext.models.enums import (
+    ContentFormat,
+    ContextSource,
+    ContextType,
+    get_context_type_options,
+)
 from opencontext.storage.global_storage import get_storage
 from opencontext.utils.logging_utils import get_logger
 
@@ -217,7 +222,8 @@ def get_context_types(self) -> List[str]:
 
         try:
             collection_names = self.storage.get_vector_collection_names()
-            return [name for name in collection_names if name in ContextType]
+            valid_types = get_context_type_options()
+            return [name for name in collection_names if name in valid_types]
         except Exception as e:
             logger.exception(f"Failed to get context types: {e}")
             raise RuntimeError(f"Failed to get context types: {str(e)}") from e
```

---

### Incident Patch 8: `ea2fb536` (2026-01-05)
**Commit Message**: docs: fix download lonk for 0.1.7 vserion in readme (#320)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ An open-source, proactive context-aware AI partner, dedicated to bringing clarit
 
 🌍 Join our [Discord Group](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5-setup.exe">💻 Download for Windows</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Download for Windows</a>
 
 </div>
 
```

---

### Incident Patch 9: `f2dcffab` (2026-01-05)
**Commit Message**: docs: fix download link for 0.1.7 version in readme zh (#321)

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 🌍 加入我们的 [Discord 社区](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5-setup.exe">💻 Windows 版下载</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Windows 版下载</a>
 
 </div>
   
```

---

### Incident Patch 10: `fecace9a` (2025-12-18)
**Commit Message**: fix: correct screen monitor interval unit from seconds to milliseconds (#317)

**File**: `frontend/src/main/background/task/screen-monitor-task.ts` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ class ScreenMonitorTask extends ScheduleNextTask {
     })
     ipcMain.handle(IpcChannel.Task_Update_Model_Config, (_, config: ScreenSettings) => {
       this.modelConfig = config
-      this.updateInterval(config.recordInterval)
+      this.updateInterval(config.recordInterval * 1000)
     })
     ipcMain.handle(IpcChannel.Task_Start, () => {
       logger.info('render notify ScreenMonitorTask start')
```

---

### Incident Patch 11: `13296294` (2025-12-10)
**Commit Message**: fix(settings): Change the API Key input on settings page to password type and keep it hidden by default for better security (#312)

**File**: `frontend/src/renderer/src/pages/settings/settings.tsx` (modified, +11/-3)
```diff
@@ -65,11 +65,12 @@ const CustomFormItems: FC<CustomFormItemsProps> = (props) => {
             className="!mb-0"
             rules={[{ required: true, message: 'Cannot be empty' }]}
             requiredSymbol={false}>
-            <Input
+            <Input.Password
               addBefore={<InputPrefix label="API Key" />}
               placeholder="Enter your API Key"
               allowClear
               className="!w-[574px]"
+              defaultVisibility={false}
             />
           </FormItem>
         </div>
@@ -104,11 +105,12 @@ const CustomFormItems: FC<CustomFormItemsProps> = (props) => {
             className="!mb-0"
             rules={[{ required: true, message: 'Cannot be empty' }]}
             requiredSymbol={false}>
-            <Input
+            <Input.Password
               addBefore={<InputPrefix label="API Key" />}
               placeholder="Enter your API Key"
               allowClear
               className="!w-[574px]"
+              defaultVisibility={false}
             />
           </FormItem>
         </div>
@@ -177,7 +179,13 @@ const StandardFormItems: FC<StandardFormItemsProps> = (props) => {
             }
           }
         ]}>
-        <Input autoFocus placeholder="Enter your API key" allowClear className="!w-[574px]" />
+        <Input.Password
+          autoFocus
+          placeholder="Enter your API key"
+          allowClear
+          className="!w-[574px]"
+          defaultVisibility={false}
+        />
       </FormItem>
     </>
   )
```

---

### Incident Patch 12: `e6f0c13f` (2025-11-30)
**Commit Message**: fix: screensettingmodel value update (#296)

* fix: updateInterval pick config.recordInterval value, export ScreenSettings type by default value

* feat: update screenSettings data used value ts type

* chore: add ts file check in tsconfig, screen-monitor-task file import ScreenSettings from  "renderer/src/store/setting.ts"

* refactor: update applyToDays type usage

**File**: `frontend/src/main/background/task/screen-monitor-task.ts` (modified, +6/-3)
```diff
@@ -1,3 +1,4 @@
+import { ScreenSettings } from './../../../renderer/src/store/setting';
 import { CaptureSource } from '@interface/common/source'
 import { IpcServerPushChannel } from '@shared/ipc-server-push-channel'
 import { BrowserWindow, ipcMain } from 'electron'
@@ -16,6 +17,7 @@ import customParseFormat from 'dayjs/plugin/customParseFormat'
 import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
 import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
 import { ScheduleNextTask } from './schedule-next-task'
+
 dayjs.extend(isBetween)
 dayjs.extend(customParseFormat)
 dayjs.extend(isSameOrAfter)
@@ -29,7 +31,8 @@ class ScreenMonitorTask extends ScheduleNextTask {
   private status: 'running' | 'stopped' = 'stopped'
   private appInfo: CaptureSource[] = []
   private configCache: AutoRefreshCache<CaptureSource[]> | null = null
-  private modelConfig: Record<string, unknown> = {}
+  private modelConfig: Partial<ScreenSettings> = {}
+
   constructor() {
     super()
   }
@@ -53,9 +56,9 @@ class ScreenMonitorTask extends ScheduleNextTask {
       this.appInfo = uniqBy([...this.appInfo, ...appInfo], 'id')
       this.configCache?.triggerUpdate(true)
     })
-    ipcMain.handle(IpcChannel.Task_Update_Model_Config, (_, config: Record<string, unknown>) => {
+    ipcMain.handle(IpcChannel.Task_Update_Model_Config, (_, config: ScreenSettings) => {
       this.modelConfig = config
-      this.updateInterval(config.interval as number)
+      this.updateInterval(config.recordInterval)
     })
     ipcMain.handle(IpcChannel.Task_Start, () => {
       logger.info('render notify ScreenMonitorTask start')
```

**File**: `frontend/src/preload/index.ts` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@ import type { Vault } from 'src/renderer/src/types/vault'
 import { Notification } from 'src/renderer/src/types/notification'
 import { serverPushAPI } from './server-push-api'
 import { CaptureSource } from '@interface/common/source'
+
 import { VaultDocumentType } from '@shared/enums/global-enum'
+import { ScreenSettings } from '@renderer/store/setting'
 
 // Custom APIs for renderer
 const api = {
@@ -96,7 +98,7 @@ const screenMonitorAPI = {
   setSettings: (key: string, value: unknown) => ipcRenderer.invoke(IpcChannel.Screen_Monitor_Set_Settings, key, value),
   clearSettings: (key: string) => ipcRenderer.invoke(IpcChannel.Screen_Monitor_Clear_Settings, key),
   getRecordingStats: () => ipcRenderer.invoke(IpcChannel.Screen_Monitor_Get_Recording_Stats),
-  updateModelConfig: (config: Record<string, unknown>) =>
+  updateModelConfig: (config: ScreenSettings) =>
     ipcRenderer.invoke(IpcChannel.Task_Update_Model_Config, config),
   startTask: () => ipcRenderer.invoke(IpcChannel.Task_Start),
   stopTask: () => ipcRenderer.invoke(IpcChannel.Task_Stop),
```

**File**: `frontend/src/renderer/src/hooks/use-setting.ts` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
 import { useCallback } from 'react'
 import { useSelector } from 'react-redux'
 import { RootState, useAppDispatch } from '@renderer/store'
-import { setScreenSettings as setScreenSettingsAction } from '@renderer/store/setting'
+import { ApplyToDays, setScreenSettings as setScreenSettingsAction } from '@renderer/store/setting'
 
 export const useSetting = () => {
   const dispatch = useAppDispatch()
@@ -34,7 +34,7 @@ export const useSetting = () => {
   )
 
   const setApplyToDays = useCallback(
-    (days: 'weekday' | 'everyday') => {
+    (days: ApplyToDays) => {
       dispatch(setScreenSettingsAction({ applyToDays: days }))
     },
     [dispatch]
```

**File**: `frontend/src/renderer/src/pages/screen-monitor/components/settings-modal.tsx` (modified, +3/-1)
```diff
@@ -3,6 +3,8 @@ import { Button, Modal, Slider, TimePicker, Radio, Form, Checkbox, Spin, Switch
 import clsx from 'clsx'
 import { Application } from './application'
 import screenIcon from '@renderer/assets/icons/screen.svg'
+import { ApplyToDays } from '@renderer/store/setting'
+
 interface SettingsModalProps {
   visible: boolean
   form: any
@@ -20,7 +22,7 @@ interface SettingsModalProps {
   onSetTempRecordInterval: (value: number) => void
   onSetTempEnableRecordingHours: (value: boolean) => void
   onSetTempRecordingHours: (value: [string, string]) => void
-  onSetTempApplyToDays: (value: string) => void
+  onSetTempApplyToDays: (value: ApplyToDays) => void
 }
 
 const SettingsModal: React.FC<SettingsModalProps> = ({
```

**File**: `frontend/src/renderer/src/pages/screen-monitor/hooks/useRecordingTimeValidation.tsx` (modified, +3/-1)
```diff
@@ -1,10 +1,12 @@
 import { useState, useEffect } from 'react'
 import { useMemoizedFn } from 'ahooks'
 import dayjs from 'dayjs'
+import { ApplyToDays } from '@renderer/store/setting'
+
 export const useRecordingTimeValidation = (
   enableRecordingHours: boolean,
   recordingHours: [string, string],
-  applyToDays: 'weekday' | 'everyday',
+  applyToDays: ApplyToDays,
   isMonitoring: boolean
 ) => {
   const [canRecord, setCanRecord] = useState(false)
```

**File**: `frontend/src/renderer/src/pages/screen-monitor/screen-monitor.tsx` (modified, +1/-1)
```diff
@@ -386,7 +386,7 @@ const ScreenMonitor: React.FC = () => {
     setRecordInterval(tempRecordInterval)
     setEnableRecordingHours(tempEnableRecordingHours)
     setRecordingHours(tempRecordingHours as [string, string])
-    setApplyToDays(tempApplyToDays as 'weekday' | 'everyday')
+    setApplyToDays(tempApplyToDays)
     setSettingsVisible(false)
   })
 
```

**File**: `frontend/src/renderer/src/store/setting.ts` (modified, +11/-12)
```diff
@@ -3,20 +3,19 @@
 
 import { createSlice, PayloadAction } from '@reduxjs/toolkit'
 
-export interface ScreenSettings {
-  recordInterval: number
-  enableRecordingHours: boolean
-  recordingHours: [string, string]
-  applyToDays: 'weekday' | 'everyday'
-}
+export type ApplyToDays = 'weekday' | 'everyday'
+
+export const defaultScreenSettings = {
+  recordInterval: 15,
+  enableRecordingHours: false,
+  recordingHours: ['08:00:00', '20:00:00'] as [string, string],
+  applyToDays: 'weekday' as ApplyToDays
+};
+
+export type ScreenSettings = typeof defaultScreenSettings;
 
 const initialState = {
-  screenSettings: {
-    recordInterval: 15,
-    enableRecordingHours: false,
-    recordingHours: ['08:00:00', '20:00:00'],
-    applyToDays: 'weekday'
-  }
+  screenSettings: defaultScreenSettings
   // other settings...
 }
 
```

**File**: `frontend/src/renderer/src/types/electron.d.ts` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ interface ScreenMonitorAPI {
     success: boolean
     error?: string
   }>
-  updateModelConfig: (config: Record<string, unknown>) => Promise<{
+  updateModelConfig: (config: ScreenSettings) => Promise<{
     success: boolean
     error?: string
   }>
```

---

### Incident Patch 13: `4e789e6d` (2025-11-27)
**Commit Message**: feat: Optimize initial API key validation UX (timeout & error messages) / 优化初始化 API Key 验证体验（超时控制与错误提示） (#292)

* feat: optimize API key validation with timeout and friendly error messages
优化 API 密钥验证体验，增加超时控制和友好报错

- Set a 15s timeout for model validation requests to prevent UI hanging.
- Added error code mapping for Volcengine (Doubao) and OpenAI to provide human-readable error messages (e.g., AccessDenied, QuotaExceeded).
- 设置模型验证请求的超时时间为 15 秒，防止界面长时间卡顿。
- 增加火山引擎（豆包）和 OpenAI 的错误码映射，提供可读的错误提示（如：服务未开通、余额不足等）。

* feat: update model settings configuration without timeout limit

- Refactored the saving of model settings to remove the timeout limit.
- Introduced new configuration building functions for both VLM and embedding models.
- Ensured that the new settings are saved correctly with updated configurations.

---------

Co-authored-by: lujia <[REDACTED_EMAIL]>

**File**: `opencontext/llm/llm_client.py` (modified, +34/-7)
```diff
@@ -349,14 +349,43 @@ def validate(self) -> tuple[bool, str]:
             tuple[bool, str]: (success, message)
         """
 
-        def _extract_error_summary(error_msg: str) -> str:
+        def _extract_error_summary(error: Any) -> str:
             """
             Extract a concise error summary from API error messages.
             Removes verbose API error details and keeps only the essential information.
             """
+            error_msg = str(error)
             if not error_msg:
                 return "Unknown error"
 
+            # 1. Check for specific Volcengine/Doubao error codes
+            volcengine_errors = {
+                "AccessDenied": "Access denied. Please ensure the model is enabled in the Volcengine console.",
+                "QuotaExceeded": "Quota exceeded. Please check your Volcengine account balance.",
+                "ModelAccountIpmRateLimitExceeded": "Model rate limit (IPM) exceeded.",
+                "AccountRateLimitExceeded": "Account rate limit exceeded.",
+                "RateLimitExceeded": "Rate limit exceeded.",
+                "InternalServiceError": "Volcengine internal service error.",
+                "ServiceUnavailable": "Service unavailable.",
+                "MethodNotAllowed": "Method not allowed. Check your configuration.",
+            }
+            
+            for code, msg in volcengine_errors.items():
+                if code in error_msg:
+                    return msg
+
+            # 2. Check for OpenAI specific errors
+            openai_errors = {
+                "insufficient_quota": "Insufficient quota. Check your plan and billing details.",
+                "invalid_api_key": "Invalid API key provided.",
+                "model_not_found": "The model does not exist or you do not have access to it.",
+                "context_length_exceeded": "Context length exceeded.",
+            }
+
+            for code, msg in openai_errors.items():
+                if code in error_msg:
+                    return msg
+
             # If it's an API error with detailed JSON response, extract key info
             if "Error code:" in error_msg:
                 parts = error_msg.split("Error code:", 1)
@@ -425,14 +454,12 @@ def _extract_error_summary(error_msg: str) -> str:
                 return False, f"Unsupported LLM type: {self.llm_type}"
 
         except APIError as e:
-            error_msg = str(e)
-            logger.error(f"LLM validation failed with API error: {error_msg}")
+            logger.error(f"LLM validation failed with API error: {e}")
             # Extract concise error summary before returning
-            concise_error = _extract_error_summary(error_msg)
+            concise_error = _extract_error_summary(e)
             return False, concise_error
         except Exception as e:
-            error_msg = str(e)
-            logger.error(f"LLM validation failed with unexpected error: {error_msg}")
+            logger.error(f"LLM validation failed with unexpected error: {e}")
             # Extract concise error summary before returning
-            concise_error = _extract_error_summary(error_msg)
+            concise_error = _extract_error_summary(e)
             return False, concise_error
```

**File**: `opencontext/server/routes/settings.py` (modified, +18/-6)
```diff
@@ -62,6 +62,11 @@ def _build_llm_config(
 ) -> dict:
     """Build LLM config dict"""
     config = {"base_url": base_url, "api_key": api_key, "model": model, "provider": provider}
+    
+    # Add optional parameters
+    if "timeout" in kwargs:
+        config["timeout"] = kwargs["timeout"]
+
     if llm_type == LLMType.EMBEDDING:
         config["output_dim"] = kwargs.get("output_dim", 2048)
     return config
@@ -130,7 +135,7 @@ async def update_model_settings(request: UpdateModelSettingsRequest, _auth: str
 
             # Validate VLM
             vlm_config = _build_llm_config(
-                cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT
+                cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT, timeout=15
             )
             vlm_valid, vlm_msg = LLMClient(llm_type=LLMType.CHAT, config=vlm_config).validate()
             if not vlm_valid:
@@ -140,16 +145,23 @@ async def update_model_settings(request: UpdateModelSettingsRequest, _auth: str
 
             # Validate Embedding
             emb_config = _build_llm_config(
-                emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING
+                emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING, timeout=15
             )
             emb_valid, emb_msg = LLMClient(llm_type=LLMType.EMBEDDING, config=emb_config).validate()
             if not emb_valid:
                 return convert_resp(
                     code=400, status=400, message=f"Embedding validation failed: {emb_msg}"
                 )
 
-            # Save configuration
-            new_settings = {"vlm_model": vlm_config, "embedding_model": emb_config}
+            # Save configuration (without timeout limit)
+            vlm_config_save = _build_llm_config(
+                cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT
+            )
+            emb_config_save = _build_llm_config(
+                emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING
+            )
+            
+            new_settings = {"vlm_model": vlm_config_save, "embedding_model": emb_config_save}
 
             config_mgr = GlobalConfig.get_instance().get_config_manager()
             if not config_mgr:
@@ -210,10 +222,10 @@ async def validate_llm_config(request: UpdateModelSettingsRequest, _auth: str =
 
         # Build configs for validation (without saving)
         vlm_config = _build_llm_config(
-            cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT
+            cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT, timeout=15
         )
         emb_config = _build_llm_config(
-            emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING
+            emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING, timeout=15
         )
 
         # Validate VLM
```

---

### Incident Patch 14: `2ec17445` (2025-11-26)
**Commit Message**: fix: model_setting (#290)

**File**: `opencontext/server/routes/settings.py` (modified, +39/-57)
```diff
@@ -55,36 +55,8 @@ class UpdateModelSettingsResponse(BaseModel):
     message: str
 
 
-class ValidateLLMRequest(BaseModel):
-    baseUrl: str
-    apiKey: str
-    modelId: str
-    provider: str
-    embeddingModelId: str
-    embeddingBaseUrl: str | None = None
-    embeddingApiKey: str | None = None
-    embeddingProvider: str | None = None
-
-
 # ==================== Helper Functions ====================
 
-
-def _mask_api_key(raw: str) -> str:
-    """Mask API key: keep first 4 and last 2 chars"""
-    if not raw:
-        return ""
-    if len(raw) <= 6:
-        return raw[0] + "***" if len(raw) > 1 else "***"
-    return f"{raw[:4]}***{raw[-2:]}"
-
-
-def _is_masked_api_key(val: str) -> bool:
-    """Check if API key is already masked"""
-    if not val:
-        return False
-    return ("***" in val) and not val.endswith("***") and len(val) >= 6
-
-
 def _build_llm_config(
     base_url: str, api_key: str, model: str, provider: str, llm_type: LLMType, **kwargs
 ) -> dict:
@@ -113,10 +85,10 @@ async def get_model_settings(_auth: str = auth_dependency):
             modelPlatform=vlm_cfg.get("provider", ""),
             modelId=vlm_cfg.get("model", ""),
             baseUrl=vlm_cfg.get("base_url", ""),
-            apiKey=_mask_api_key(vlm_cfg.get("api_key", "")),
+            apiKey=vlm_cfg.get("api_key", ""),
             embeddingModelId=emb_cfg.get("model", ""),
             embeddingBaseUrl=emb_cfg.get("base_url", ""),
-            embeddingApiKey=_mask_api_key(emb_cfg.get("api_key", "")),
+            embeddingApiKey=emb_cfg.get("api_key", ""),
             embeddingModelPlatform=emb_cfg.get("provider", ""),
         )
 
@@ -133,22 +105,10 @@ async def update_model_settings(request: UpdateModelSettingsRequest, _auth: str
     with _config_lock:
         try:
             cfg = request.config
-            current_cfg = GlobalConfig.get_instance().get_config() or {}
-            current_vlm_key = (current_cfg.get("vlm_model") or {}).get("api_key", "")
-            current_emb_key = (current_cfg.get("embedding_model") or {}).get("api_key", "")
-
-            # Resolve VLM API key
-            vlm_key = current_vlm_key if _is_masked_api_key(cfg.apiKey) else cfg.apiKey
-
-            # Resolve Embedding API key
-            if cfg.embeddingApiKey:
-                emb_key = (
-                    current_emb_key
-                    if _is_masked_api_key(cfg.embeddingApiKey)
-                    else cfg.embeddingApiKey
-                )
-            else:
-                emb_key = vlm_key
+
+            # Use API keys directly from frontend
+            vlm_key = cfg.apiKey
+            emb_key = cfg.embeddingApiKey or vlm_key
 
             # Resolve embedding URL and provider
             emb_url = cfg.embeddingBaseUrl or cfg.baseUrl
@@ -222,23 +182,45 @@ async def update_model_settings(request: UpdateModelSettingsRequest, _auth: str
             return convert_resp(code=500, status=500, message="Failed to update model settings")
 
 
-@router.get("/api/model_settings/validate")
-async def validate_llm_config(_auth: str = auth_dependency):
-    """Validate current LLM configuration from backend"""
+@router.post("/api/model_settings/validate")
+async def validate_llm_config(request: UpdateModelSettingsRequest, _auth: str = auth_dependency):
+    """Validate LLM configuration from frontend (without saving)"""
     try:
-        # Get current configuration from backend
-        config = GlobalConfig.get_instance().get_config()
-        if not config:
-            return convert_resp(code=500, status=500, message="配置未初始化")
+        cfg = request.config
+
+        # Use API keys directly from frontend
+        vlm_key = cfg.apiKey
+        emb_key = cfg.embeddingApiKey or vlm_key
+
+        # Resolve embedding URL and provider
+        emb_url = cfg.embeddingBaseUrl or cfg.baseUrl
+        emb_provider = cfg.embeddingModelPlatform or cfg.modelPlatform
+
+        # Validation
+        if not vlm_key:
+            return convert_resp(code=400, status=400, message="VLM API key cannot be empty")
+        if not emb_key:
+            return convert_resp(code=400, status=400, message="Embedding API key cannot be empty")
+        if not cfg.modelId:
+            return convert_resp(code=400, status=400, message="VLM model ID cannot be empty")
+        if not cfg.embeddingModelId:
+            return convert_resp(
+                code=400, status=400, message="Embedding model ID cannot be empty"
+            )
 
-        vlm_cfg = config.get("vlm_model", {})
-        emb_cfg = config.get("embedding_model", {})
+        # Build configs for validation (without saving)
+        vlm_config = _build_llm_config(
+            cfg.baseUrl, vlm_key, cfg.modelId, cfg.modelPlatform, LLMType.CHAT
+        )
+        emb_config = _build_llm_config(
+            emb_url, emb_key, cfg.embeddingModelId, emb_provider, LLMType.EMBEDDING
+        )
 
         # Validate VLM
-        vlm_valid, vlm_msg = LLMClient(llm_type=
```

**File**: `opencontext/web/static/js/settings.js` (modified, +21/-1)
```diff
@@ -493,7 +493,27 @@ async function validateModelConfig() {
     try {
         showToast('正在测试连接...', false);
 
-        const response = await fetch('/api/model_settings/validate');
+        // Collect current configuration from the form
+        const useSeparate = document.getElementById('separateEmbedding').checked;
+
+        const settings = {
+            config: {
+                modelPlatform: document.getElementById('modelPlatform').value,
+                modelId: document.getElementById('modelId').value,
+                baseUrl: document.getElementById('baseUrl').value,
+                apiKey: document.getElementById('apiKey').value,
+                embeddingModelId: document.getElementById('embeddingModelId').value,
+                embeddingBaseUrl: useSeparate ? document.getElementById('embeddingBaseUrl').value : null,
+                embeddingApiKey: useSeparate ? document.getElementById('embeddingApiKey').value : null,
+                embeddingModelPlatform: useSeparate ? document.getElementById('embeddingModelPlatform').value : null
+            }
+        };
+
+        const response = await fetch('/api/model_settings/validate', {
+            method: 'POST',
+            headers: { 'Content-Type': 'application/json' },
+            body: JSON.stringify(settings)
+        });
 
         const data = await response.json();
 
```

---

### Incident Patch 15: `c2a24834` (2025-11-25)
**Commit Message**: fix: message show problem (#280)

**File**: `frontend/package.json` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@
     "@radix-ui/react-slot": "^1.2.3",
     "@radix-ui/react-tooltip": "^1.2.8",
     "@radix-ui/react-use-controllable-state": "^1.2.2",
-    "@zhongyao/heatmap": "^0.0.4",
+    "@zhongyao/heatmap": "^0.0.6",
     "ahooks": "^3.9.5",
     "ai": "^5.0.30",
     "allotment": "^1.20.4",
```

**File**: `frontend/pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -48,8 +48,8 @@ importers:
         specifier: ^1.2.2
         version: 1.2.2(@types/react@19.1.10)(react@19.1.1)
       '@zhongyao/heatmap':
-        specifier: ^0.0.4
-        version: 0.0.4(dayjs@1.11.18)(react@19.1.1)
+        specifier: ^0.0.6
+        version: 0.0.6(dayjs@1.11.18)(react@19.1.1)
       ahooks:
         specifier: ^3.9.5
         version: 3.9.5(react-dom@19.1.1(react@19.1.1))(react@19.1.1)
@@ -2107,8 +2107,8 @@ packages:
     resolution: {integrity: sha512-cQzWCtO6C8TQiYl1ruKNn2U6Ao4o4WBBcbL61yJl84x+j5sOWWFU9X7DpND8XZG3daDppSsigMdfAIl2upQBRw==}
     engines: {node: '>=10.0.0'}
 
-  '@zhongyao/heatmap@0.0.4':
-    resolution: {integrity: sha512-tFEF+SjjtyKV2v5xNBLdSgAEQuPuduO6j8yZcs/X7jKK40WPRdNKPl8q/msSadjRJtr92/gazANQxt4JU6ZKvw==}
+  '@zhongyao/heatmap@0.0.6':
+    resolution: {integrity: sha512-AXQFk4f8CkPSUSi4qasTZtwWPABkSVv6zSMlmlFXtCqYug0tie/pHc81DYkx51lvluQycaX4l40z7m1EHrtSCQ==}
     peerDependencies:
       dayjs: ^1.11.19
       react: ^16.18.0
@@ -8508,7 +8508,7 @@ snapshots:
 
   '@xmldom/xmldom@0.8.11': {}
 
-  '@zhongyao/heatmap@0.0.4(dayjs@1.11.18)(react@19.1.1)':
+  '@zhongyao/heatmap@0.0.6(dayjs@1.11.18)(react@19.1.1)':
     dependencies:
       '@types/react': 19.2.3
       dayjs: 1.11.18
```

**File**: `frontend/src/renderer/src/App.tsx` (modified, +0/-1)
```diff
@@ -52,7 +52,6 @@ function AppContent(): React.ReactElement {
   })
   const scheduleNextCheck = useMemoizedFn(() => {
     statusCheckIntervalRef.current = setTimeout(() => {
-      console.log('scheduleNextCheck', backendStatus)
       if (backendStatus !== 'running') {
         checkInitialStatus()
       } else {
```

**File**: `frontend/src/renderer/src/pages/home/components/heatmap/heatmap.tsx` (modified, +13/-0)
```diff
@@ -241,6 +241,19 @@ const HeatmapEntry: FC<HeatmapEntryProps> = (props) => {
               selectedDate={selectedDays}
             />
           )}
+          renderWeekday={(props) => {
+            const { label, cellSize, index } = props
+            return (
+              <div
+                style={{
+                  height: cellSize,
+                  justifyContent: 'space-around'
+                }} // 使用 cellSize
+                className="flex items-center text-xs text-gray-500">
+                {index % 2 === 0 ? '' : label}
+              </div>
+            )
+          }}
         />
         <div className="grid grid-cols-4 gap-[8px] mt-[10px]">
           {currentDetailData.map((item) => {
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-05-06): Create SECURITY.md (@qin-ptr)
- **PR #363** (2026-05-07): fix(security): sandbox vikingdb:// protocol to userData directory (@Chen17-sq)
- **PR #354** (2026-03-12): Update release.yml (@qin-ptr)
- **PR #352** (2026-03-06): fix: resolve AttributeError crash in ScreenshotCapture._get_statistic… (@aritra0342)
- **PR #347** (2026-03-04): fix: correct embedding provider detection for non-Doubao providers (@Xiao-ao-jiang-hu)
- **PR #344** (2026-03-05): fix: replace 9 bare excepts with except Exception across 5 files (@haosenwang1018)
- **PR #343** (2026-03-05): 大幅优化启动性能，热启动加速16x，冷启动加速8x。 (@ZhuYizhou2333)
- **PR #339** (2026-03-10): fix(llm): Fix when use custom embedding providers. (@lx200916)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
