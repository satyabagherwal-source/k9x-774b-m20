# Forensic Learning Record (Deep Inspection): walkinglabs/learn-harness-engineering

> **Canonical Artifact**: `07_PROJECT_LEARNING/walkinglabs-learn-harness-engineering-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:39.521Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `walkinglabs/learn-harness-engineering`
- **Description**: Harness engineering beginner tutorial, from 0 to 1
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17077 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `get_anthropic_logo.js`
```
const https = require('https');
https.get('https://raw.githubusercontent.com/anthropics/anthropic-cookbook/main/images/logo.svg', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

```

### Core Architecture Module: `projects/project-01/solution/scripts/dev.js`
```
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

console.log('[dev] Building main + preload...');
try {
  execSync('npx tsc -p tsconfig.node.json', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[dev] TypeScript compilation failed');
  process.exit(1);
}

console.log('[dev] Building renderer...');
try {
  execSync('npx vite build', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[dev] Vite build failed');
  process.exit(1);
}

console.log('[dev] Starting Electron...');
try {
  execSync('npx electron .', { cwd: root, stdio: 'inherit' });
} catch {
  // Electron exits with code 0 on normal close
}

```

### Core Architecture Module: `projects/project-01/solution/src/main/ipc-handlers.ts`
```
import { IpcMain } from 'electron';
import { DocumentService } from '../services/document-service';
import { IndexingService } from '../services/indexing-service';
import { QaService } from '../services/qa-service';
import { IPC_CHANNELS } from '../shared/types';

export interface Services {
  documentService: DocumentService;
  indexingService: IndexingService;
  qaService: QaService;
}

export function registerIpcHandlers(ipcMain: IpcMain, services: Services) {
  const { documentService, indexingService, qaService } = services;

  // Document operations
  ipcMain.handle(IPC_CHANNELS.LIST_DOCUMENTS, async () => {
    return documentService.listDocuments();
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_DOCUMENT, async (_event, filePath: string) => {
    return documentService.importDocument(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.GET_DOCUMENT, async (_event, id: string) => {
    return documentService.getDocument(id);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DOCUMENT, async (_event, id: string) => {
    return documentService.deleteDocument(id);
  });

  // Indexing
  ipcMain.handle(IPC_CHANNELS.START_INDEXING, async (_event, documentId?: string) => {
    return indexingService.startIndexing(documentId);
  });

  ipcMain.handle(IPC_CHANNELS.GET_INDEXING_STATUS, async () => {
    return indexingService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.GET_CHUNKS, async (_event, documentId: string) => {
    return indexingService.getChunksForDocument(documentId);
  });

  // Q&A
  ipcMain.handle(IPC_CHANNELS.ASK_QUESTION, async (_event, question: string) => {
    return qaService.ask(question);
  });

  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async () => {
    return qaService.getHistory();
  });
}

```

### Core Architecture Module: `projects/project-01/solution/src/main/main.ts`
```
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { DocumentService } from '../services/document-service';
import { QaService } from '../services/qa-service';
import { IndexingService } from '../services/indexing-service';
import { PersistenceService } from '../services/persistence-service';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Knowledge Base',
  });

  // In development, load from Vite dev server or built renderer
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeServices() {
  const dataDir = path.join(app.getPath('userData'), 'knowledge-base-data');
  const persistence = new PersistenceService(dataDir);
  const documentService = new DocumentService(persistence);
  const indexingService = new IndexingService(persistence);
  const qaService = new QaService(persistence);

  registerIpcHandlers(ipcMain, {
    documentService,
    indexingService,
    qaService,
  });
}

app.whenReady().then(() => {
  initializeServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

```

### Core Architecture Module: `projects/project-01/solution/src/preload/preload.ts`
```
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

const api = {
  documents: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_DOCUMENTS),
    import: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_DOCUMENT, filePath),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_DOCUMENT, id),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_DOCUMENT, id),
  },
  indexing: {
    start: (documentId?: string) => ipcRenderer.invoke(IPC_CHANNELS.START_INDEXING, documentId),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INDEXING_STATUS),
    chunks: (documentId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CHUNKS, documentId),
  },
  qa: {
    ask: (question: string) => ipcRenderer.invoke(IPC_CHANNELS.ASK_QUESTION, question),
    history: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),
  },
};

contextBridge.exposeInMainWorld('knowledgeBase', api);

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/App.tsx`
```
import { useState, useCallback } from 'react';
import { DocumentList } from './components/DocumentList';
import { QuestionPanel } from './components/QuestionPanel';
import { DocumentDetail } from './components/DocumentDetail';
import { StatusBar } from './components/StatusBar';
import { Document, AppStatus, QAResponse } from '../shared/types';

declare global {
  interface Window {
    knowledgeBase: {
      documents: {
        list: () => Promise<Document[]>;
        import: (filePath: string) => Promise<Document>;
        get: (id: string) => Promise<Document | null>;
        delete: (id: string) => Promise<boolean>;
      };
      indexing: {
        start: (documentId?: string) => Promise<{ status: string }>;
        status: () => Promise<AppStatus>;
        chunks: (documentId: string) => Promise<Array<{ id: string; content: string; index: number }>>;
      };
      qa: {
        ask: (question: string) => Promise<QAResponse>;
        history: () => Promise<Array<{ question: string; response: QAResponse }>>;
      };
    };
  }
}

export function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>({
    documentsLoaded: 0,
    indexStatus: 'idle',
    lastActivity: '',
  });
  const [lastResponse, setLastResponse] = useState<QAResponse | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await window.knowledgeBase.documents.list();
      setDocuments(docs);
      const status = await window.knowledgeBase.indexing.status();
      setAppStatus(status);
    } catch (err) {
      console.error('Failed to refresh documents:', err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    // In a real app this would open a file dialog.
    // For the course, we'll trigger import via the dev console or init script.
    console.log('Import triggered - use window.knowledgeBase.documents.import(filePath)');
  }, []);

  const handleSelectDocument = useCallback((doc: Document) => {
    setSelectedDoc(doc);
  }, []);

  const handleAskQuestion = useCallback(async (question: string) => {
    try {
      const response = await window.knowledgeBase.qa.ask(question);
      setLastResponse(response);
    } catch (err) {
      console.error('Q&A failed:', err);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '12px 20px',
        background: '#16213e',
        borderBottom: '1px solid #0f3460',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Knowledge Base</h1>
        <button
          onClick={refreshDocuments}
          style={{
            padding: '6px 14px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Refresh
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: Document list */}
        <div style={{
          width: '280px',
          borderRight: '1px solid #0f3460',
          display: 'flex',
          flexDirection: 'column',
          background: '#16213e',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #0f3460',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#a0a0c0' }}>
              Documents ({documents.length})
            </span>
            <button
              onClick={handleImport}
              style={{
                padding: '4px 10px',
                background: '#533483',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              + Import
            </button>
          </div>
          <DocumentList
            documents={documents}
            onSelect={handleSelectDocument}
            selectedId={selectedDoc?.id ?? null}
          />
        </div>

        {/* Right panel: Document detail + Q&A */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {selectedDoc ? (
              <DocumentDetail document={selectedDoc} />
            ) : (
              <div style={{ color: '#666', textAlign: 'center', paddingTop: '40px' }}>
                Select a document or ask a question to get started
              </div>
            )}
            {lastResponse && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#1a1a3e',
                borderRadius: '6px',
                border: '1px solid #0f3460',
              }}>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{lastResponse.answer}</div>
                {lastResponse.citations.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#8888bb' }}>
                    <strong>Citations:</strong>
                    {lastResponse.citations.map((c, i) => (
                      <div key={i} style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #533483' }}>
                        {c.documentTitle} (chunk {c.chunkIndex}): {c.excerpt.substring(0, 100)}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <QuestionPanel onAsk={handleAskQuestion} />
        </div>
      </div>

      <StatusBar status={appStatus} />
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/DocumentDetail.tsx`
```
import { useEffect, useState } from 'react';
import { Document, Chunk } from '../../shared/types';

interface Props {
  document: Document;
}

export function DocumentDetail({ document }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);

  useEffect(() => {
    window.knowledgeBase.indexing.chunks(document.id).then(setChunks);
  }, [document.id]);

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        {document.title}
      </h2>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
        <div>Filename: {document.filename}</div>
        <div>Imported: {new Date(document.importedAt).toLocaleString()}</div>
        <div>Size: {(document.size / 1024).toFixed(1)} KB</div>
        <div>Status: {document.status}</div>
        {document.chunks !== undefined && <div>Chunks: {document.chunks}</div>}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setShowChunks(!showChunks)}
          style={{
            padding: '6px 12px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {showChunks ? 'Hide' : 'Show'} Chunks ({chunks.length})
        </button>
        {document.status !== 'indexed' && (
          <button
            onClick={() => window.knowledgeBase.indexing.start(document.id)}
            style={{
              padding: '6px 12px',
              background: '#533483',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Index Document
          </button>
        )}
      </div>

      {showChunks && (
        <div>
          {chunks.map(chunk => (
            <div
              key={chunk.id}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: '#1a1a3e',
                borderRadius: '4px',
                borderLeft: '3px solid #533483',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                Chunk {chunk.index} ({chunk.metadata.charCount} chars)
              </div>
              {chunk.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/DocumentList.tsx`
```
import { Document } from '../../shared/types';

interface Props {
  documents: Document[];
  onSelect: (doc: Document) => void;
  selectedId: string | null;
}

export function DocumentList({ documents, onSelect, selectedId }: Props) {
  if (documents.length === 0) {
    return (
      <div style={{ padding: '20px 16px', color: '#666', fontSize: '13px', textAlign: 'center' }}>
        No documents imported yet.
        <br />
        <span style={{ fontSize: '11px', color: '#555' }}>
          Import documents to get started.
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {documents.map(doc => (
        <div
          key={doc.id}
          onClick={() => onSelect(doc)}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #0f3460',
            background: selectedId === doc.id ? '#0f3460' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{doc.title}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {doc.status === 'indexed' ? '✓ ' : ''}
            {(doc.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ))}
    </div>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #80** (2026-09-30): **docs: 用真实量化案例替换第 3–5 讲的无出处数字**
  *Symptoms*: 第 3–5 讲原有匿名案例含有无法追溯的比例。本 PR 替换这些案例，并补入国外原始文章和研究中可核对的实际结果，保留案例的量化信息。  - 第 3 讲：OpenAI 报告五个月约 1,500 个 PR、平均每名工程师每天 3.5 个 PR；明确这些属于整套工程流程，不能单独归因于文档。 - 第 4 讲：Lulla 等人的配对研究使用 gpt-5.2-codex、10 个仓库和 124 个 PR 派生任务；中位耗时 98.57→70.34 秒（降低 28.64%），输出 token 中位数 2,925→2,440（降低 16.58%）。明确这是效率研究，并非文件拆分实验，也未全面评估功能正确性。同时保留 OpenAI 的文件拆分实践和 ETH Zurich 的研究边界。 - 第 5 讲：保留 Anthropic 跨会话交接机制，并加入 LangChain 在固定 GPT-5.2-Codex、89 个任务的 Terminal Bench 2.0 上 52.8%→66.5% 的实际结果（提高 13.7 个百分点）。明确这是多项 harness 调整的总体收益，不能只归因于进度文件。 - 同步 15 种语言，数字段落附原始链接，延伸阅读和资源索引补充研究，更新锚点映射。配套代码继续作为教学模拟。  验证：45 个案例的结果数字与出处检查、15 个资源索引检查、git diff --check、npm run anchors:check、npm run docs:build（33.32 秒完成）。  关联 #73；本次覆盖第 3–5 讲，其他讲义仍需单独核查，因此暂不关闭 Issue。本 PR 在已合入的 #75 基础上，将第 3–5 讲的教学示例进一步替换为有原始出处的真实量化案例。 

- **Issue #79** (2026-09-30): **Fix file path in execution comment**
  *Symptoms*: Small fix to the execution path in the command

- **Issue #78** (2026-09-30): **fix(audit-harness): close two false-PASS checks in Subsystem 1**
  *Symptoms*: ## What  Two checks in `tools/audit-harness.sh` (Subsystem 1: Instructions) report **PASS** on repos that do not meet them.  1. **`Entry file is 50–200 lines [L04]`** only tests the upper bound (`-le 200`), so a 3-line `AGENTS.md` passes. This PR enforces the lower bound as well and rewrites the fix hint so it covers both "too long" and "too short". 2. **`State files are enumerated (PROGRESS.md, feature_list)`** goes through `contains_pattern`, which uses `grep -i`, with the bare words `PROGRESS|DECISIONS`. Any sentence containing "progress" therefore passes, e.g. "This is a work in progress.", even when no state file is named. The pattern now matches the file names: `PROGRESS.md`, `DECISIONS.md`, `docs/decisions`, `feature_list`.  ## How I found it  I ran the audit on a real repo whose `CLAUDE.md` never mentions `PROGRESS.md`. Check 2 still passed, because the file contains the token `hop_progress_only`.  ## Verification  I built four minimal fixture repos, each with a single `AGENTS.md`:  | fixture | check | before | after | |---|---|---|---| | 3-line AGENTS.md | L04 length | PASS ❌ | WARN ✅ | | 100+ lines, mentions PROGRESS.md | L04 length | PASS | PASS | | "This is a work in progress." | state files | PASS ❌ | WARN ✅ | | "State lives in PROGRESS.md and feature_list.json." | state files | PASS | PASS |  `bash -n tools/audit-harness.sh` is clean. Both are RECOMMENDED checks, so the exit code is unaffected.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the contribution and the clear fixture-based verification! Both fixes address real false-PASS cases in the audit. I also checked the 49/50/200/201-line boundaries and the state-file matching. Merged. 

- **Issue #76** (2026-09-30): **Fix language switch losing the section anchor**
  *Symptoms*: ## Summary  Fixes a language switch sending the reader back to the top of the page when the URL has a section anchor. Section ids become the same in every locale, which is what vitepress.dev's own multilingual docs do. The ids get applied at build time, so no markdown file changes.  ## Problem  Open a lecture in any locale, click a section in the outline, then switch language:  ``` zh-TW  .../lecture-04-why-one-giant-instruction-file-fails/#實際案例   <- reader is on 實際案例        switch language via the navbar dropdown en     .../lecture-04-why-one-giant-instruction-file-fails/#實際案例   <- no such id, jumps to top ```  VitePress carries the current hash across a locale switch. `theme-default/composables/langs.js` builds every locale link as `normalizeLink(...) + hash.value`, with no condition on it. There is no built-in anchor translation.  Heading ids, though, get auto-slugged from heading text. No heading in this repo uses an explicit id, so each locale ends up with ids in its own language: `實際案例`, `実際の事例`, `praxisbeispiel`. The carried `#實際案例` has no matching element on the English page, so VitePress skips the hash-scroll path and calls `window.scrollTo(0, 0)`.  The convention this repo was missing is the one VitePress's own docs use. On `vitepress.dev/zh/guide/markdown` the heading is `<h2 id="header-anchors">标题锚点</h2>`. The id is the English slug and the text is translated. Switching that page's language on `#header-anchors` lands on the right section.  ## Approach  Keep headin
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed investigation, implementation, and extensive validation! The canonical-anchor approach is a useful improvement to multilingual navigation. Before merging, I regenerated the map against #74 and added validation of actual localized heading counts, so adding or removing a translated heading cannot silently leave a stale map. The regression check and the full documentation build passed. Merged. 

- **Issue #75** (2026-09-30): **docs: add sources or mark illustrative for Real-World examples (#73)**
  *Symptoms*: ## Summary  Addresses #73. For each "Real-World Example"-style section in lectures 03–05 (English and Chinese), I searched for a verifiable source behind the concrete numbers and found none. Rather than fabricate links, I renamed the sections to **Illustrative Example** and added a one-line disclaimer stating that the scenario is a teaching illustration, not a published case study.  ## Changes by file  ### English (`docs/en/lectures/`)  - **`lecture-03-why-the-repository-must-become-the-system-of-record/index.md`**   - Heading `## A Real Transformation Story` → `## Illustrative Example`   - Added disclaimer: "This example is a teaching illustration, not a published case study — the numbers are illustrative rather than measured from a real project." - **`lecture-04-why-one-giant-instruction-file-fails/index.md`**   - Heading `## Real-World Example` → `## Illustrative Example`   - Added the same disclaimer. - **`lecture-05-why-long-running-tasks-lose-continuity/index.md`**   - Heading `## Real-World Example` → `## Illustrative Example`   - Added the same disclaimer.  ### Chinese (`docs/zh/lectures/`)  - **`lecture-03-why-the-repository-must-become-the-system-of-record/index.md`**   - Heading `## 一个真实的改造故事` → `## 示意性示例`   - Added disclaimer: "本示例为教学示意，并非已发表的真实案例——文中数字仅为让概念更具体，并非来自真实项目的实测数据。" - **`lecture-04-why-one-giant-instruction-file-fails/index.md`**   - Heading `## 实际案例` → `## 示意性示例`   - Added the same Chinese disclaimer. - **`lecture-05-why-long-running-tasks-lose-continu

- **Issue #74** (2026-09-30): **Attribute VILA Lab versioned claims; polish zh-TW harness-designs**
  *Symptoms*: ## What changed  ### 1. Say where the versioned numbers come from  `harness-designs/claude-code` (EN and zh-TW) presents a few architectural details as settled fact. They aren't. They come from VILA Lab's reverse-engineering report, which analyzed Claude Code v2.1.88 specifically, and Claude Code has shipped a lot since then.  I attributed the five-layer compaction pipeline and the seven permission modes to that v2.1.88 analysis and moved both to past tense. The permission-mode section now also says what the current docs list: Manual (renamed from "default" in v2.1.200+), Plan, acceptEdits, Auto, and bypassPermissions.  References are split into official Anthropic documentation and independent research, with a line noting that the second group describes one historical version.  The "In One Sentence" while-loop summary is untouched. It holds up, and Anthropic's own engineering post says the same thing.  ### 2. zh-TW: Simplified characters that survived translation  In claude-code, codex, deepseek, and pi.  ### 3. zh-TW: prose cleanup  Em-dashes removed, padding verbs trimmed, matching the plain-punctuation convention used elsewhere in the repo.  Other locales still carry the same unqualified VILA Lab numbers. Say the word and I'll do those too.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thank you for carefully attributing the architectural details to the analyzed version and cleaning up the Traditional Chinese pages! This makes the source boundaries much clearer. Merged; the integration update in #76 also adds dontAsk to the current permission-mode list. 

- **Issue #73** (2026-09-30): **Add sources or clarify illustrative for "Real-World Example" sections**
  *Symptoms*: I noticed a few lectures have a section called "Real-World Example" or "A Real Transformation Story" that gives concrete numbers, but I could not find anything to verify them against.  For example:  - Lecture 03: a SaaS/e-commerce team on about 30 microservices, with 70% of tasks needing human intervention. - Lecture 04: an AGENTS.md growing from 50 to 600 lines, task success from 45% to 72%, security compliance from 60% to 95%. - Lecture 05: a 12-feature, 5-session experiment, completion from 58% to 100%, hidden defects from 43% to 8%.  I searched for a repo, case study, or experiment description behind these and came up empty.  If these come from real cases, please link the source. If they are teaching examples, please call them "Illustrative Example" or "Hypothetical Example" instead. That distinction would help readers know what is evidence and what is illustration.  Thanks!
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this. Plan: for each `Real-World Example` section in the three English lectures (and their zh counterparts), I will either add a verifiable source link when the text clearly refers to a real, checkable case, or rename the heading to `Illustrative Example` with a one-sentence disclaimer that the scenario is a teaching illustration rather than a published case. I will not fabricate any sources, and I'll verify the docs build before opening a PR.
  > Thanks! One clarification before you start: L03–L05 were intended as examples, rather than the full scope of the issue.  I noticed similar “Real-World Example” / case-study-style sections and quantitative claims in other lectures as well. The same question applies there: is the scenario based on a real, verifiable case, or is it an illustrative example for teaching purposes?  So I think it would be worth checking the other lectures too, rather than limiting the changes to L03–L05 and their zh counterparts.  The approach you proposed makes sense to me: add a source when the case can be verified, or label it as an Illustrative Example when it is intended as a teaching example. In cases where there isn’t a source we can verify, I think the latter would be the better approach.
  > **Update (2026-09-30): all follow-ups below are now addressed in [9fb48af](https://github.com/walkinglabs/learn-harness-engineering/commit/9fb48af904acdf3d56171e5479e2e1101b95d173). The text below preserves the original pre-fix audit; checked items indicate their evidence/labeling corrections are complete.**  Thanks @alecchen for raising this and clarifying that Lectures 03–05 were examples of a broader issue, and thanks @PerryLink for the careful fix in #75 and for avoiding invented sources.  Both fixes are now merged, in this order:  - #75 initially renamed the English and Simplified Chinese examples and made their illustrative status explicit. - #80 then replaced those sections with documented cases and quantitative results, synchronized all 15 locales, added primary-source links next to the numbers and in the reading/reference indexes, and regenerated the anchor map.  The replacement evidence includes OpenAI's reported production throughput, the AGENTS.md efficiency study's paired 

- **Issue #72** (2026-09-30): **fix: zh-TW translation residue in Lecture 04**
  *Symptoms*: - Remove a duplicated sentence in the contradiction section - Replace Simplified Chinese residue with Traditional Chinese ( 明确 / 记住 / 稀释 / 编寫 / 参考 ) - Unify 專題文件 as 主題文件 - Fix punctuation and zh-TW wording (要麼 → 要嘛)

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

### Incident Patch 1: `5316c90a` (2026-09-30)
**Commit Message**: Fix language switch losing the section anchor (#76)

* docs: add Hindi and Urdu translations for skills/README.md

* fix: add missing harness-designs nav item for Spanish locale

The harness-designs section was missing from the Spanish navigation
menu even though all content is translated and available. Added the
harnessDesign label to the Spanish locale configuration.

* Fix zh-TW translation residue in lecture 04

- Remove duplicated sentence in contradiction section
- Fix simplified Chinese residue (明确/记住/稀释/编寫/参考)
- Fix punctuation and Mainland lexicon (要麼->要嘛)

* Unify 專題文件 to 主題文件 in zh-TW lecture 04

* Fix Simplified residue in zh-TW harness-designs

Co-Authored-By: Claude Code <noreply@anthropic.com>

* Refactor zh-TW harness-designs prose: remove em-dashes, trim padding verbs

Co-Authored-By: Claude Code <noreply@anthropic.com>

* Attribute VILA Lab versioned claims in claude-code harness design

Qualify five-layer compaction and seven permission modes as v2.1.88 findings, flag current permission mode names, split references by authority.

Co-Authored-By: Claude Code <noreply@anthropic.com>

* Give headings locale-invariant anchor ids

Switching language on an anchored URL

**File**: `.github/workflows/deploy-pages.yml` (modified, +3/-0)
```diff
@@ -38,6 +38,9 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
+      - name: Check heading anchor map
+        run: npm run anchors:check
+
       - name: Build with VitePress
         run: npm run docs:build
 
```

**File**: `docs/.vitepress/anchor-map.json` (added, +2765/-0)
```diff
@@ -0,0 +1,2765 @@
+{
+  "harness-designs/claude-code/index.md": {
+    "ids": [
+      "breaking-down-claude-code-s-harness-design",
+      "in-one-sentence",
+      "instruction-subsystem-a-layered-memory-system",
+      "context-subsystem-a-five-layer-compaction-pipeline",
+      "tool-subsystem-four-extension-mechanisms",
+      "feedback-and-verification-deterministic-constraints-human-agent-division-of-labor",
+      "observability-and-session-persistence",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references",
+      "official-anthropic-documentation",
+      "independent-community-research"
+    ],
+    "locales": {
+      "ar": 10,
+      "de": 10,
+      "en": 12,
+      "es": 10,
+      "fr": 10,
+      "ja": 10,
+      "ko": 10,
+      "pt-BR": 10,
+      "ru": 10,
+      "tr": 10,
+      "uk": 10,
+      "uz": 10,
+      "vi": 10,
+      "zh": 10,
+      "zh-TW": 12
+    }
+  },
+  "harness-designs/codex/index.md": {
+    "ids": [
+      "breaking-down-codex-s-harness-design",
+      "in-one-sentence",
+      "instruction-subsystem-agents-md-is-a-directory-page-not-an-encyclopedia",
+      "context-subsystem-write-select-compress-isolate",
+      "tools-and-boundaries-worktree-isolation-subagents",
+      "feedback-subsystem-put-verification-commands-in-the-specification",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 9,
+      "de": 9,
+      "en": 9,
+      "es": 9,
+      "fr": 9,
+      "ja": 9,
+      "ko": 9,
+      "pt-BR": 9,
+      "ru": 9,
+      "tr": 9,
+      "uk": 9,
+      "uz": 9,
+      "vi": 9,
+      "zh": 14,
+      "zh-TW": 9
+    }
+  },
+  "harness-designs/deepseek/index.md": {
+    "ids": [
+      "breaking-down-deepseek-harness-s-design",
+      "in-one-sentence",
+      "architectural-core-1-capability-seam",
+      "architectural-core-2-event-pipeline",
+      "architectural-core-3-session-event-log-and-model-visible-means-logged",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 8,
+      "de": 8,
+      "en": 8,
+      "es": 8,
+      "fr": 8,
+      "ja": 8,
+      "ko": 8,
+      "pt-BR": 8,
+      "ru": 8,
+      "tr": 8,
+      "uk": 8,
+      "uz": 8,
+      "vi": 8,
+      "zh": 8,
+      "zh-TW": 8
+    }
+  },
+  "harness-designs/index.md": {
+    "ids": [
+      "frontier-harness-design-breakdowns",
+      "why-these-breakdowns-matter",
+      "articles",
+      "how-to-read-this-section"
+    ],
+    "locales": {
+      "ar": 4,
+      "de": 4,
+      "en": 4,
+      "es": 4,
+      "fr": 4,
+      "ja": 4,
+      "ko": 4,
+      "pt-BR": 4,
+      "ru": 4,
+      "tr": 4,
+      "uk": 4,
+      "uz": 4,
+      "vi": 4,
+      "zh": 4,
+      "zh-TW": 4
+    }
+  },
+  "harness-designs/pi/index.md": {
+    "ids": [
+      "breaking-down-pi-s-harness-design",
+      "in-one-sentence",
+      "core-loop",
+      "instruction-subsystem-agents-md-and-system-md",
+      "state-and-context-where-pi-is-most-granular",
+      "tool-subsystem-skills-and-extensions",
+      "feedback-and-verification-making-learning-part-of-the-harness",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 10,
+      "de": 10,
+      "en": 10,
+      "es": 10,
+      "fr": 10,
+      "ja": 10,
+      "ko": 10,
+      "pt-BR": 10,
+      "ru": 10,
+      "tr": 10,
+      "uk": 10,
+      "uz": 10,
+      "vi": 10,
+      "zh": 10,
+      "zh-TW": 10
+    }
+  },
+  "index.md": {
+    "ids": [
+      "welcome-to-learn-harness-engineering",
+      "get-started",
+      "the-core-mechanism-of-a-harness",
+      "what-you-will-learn",
+      "next-steps"
+    ],
+    "locales": {
+      "ar": 5,
+      "de": 5,
+      "en": 5,
+    
```

**File**: `docs/.vitepress/config.mts` (modified, +24/-0)
```diff
@@ -1,6 +1,8 @@
 /// <reference types="node" />
 import { defineConfig } from "vitepress";
 import { withMermaid } from "vitepress-plugin-mermaid";
+import anchorMap from "./anchor-map.json";
+import { defaultSlugify } from "../../scripts/anchor-map-utils.ts";
 
 const docsBase = "/learn-harness-engineering/";
 const brandLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23D95C41" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12.1" y1="11.9" x2="18.9" y2="8.2" /><line x1="12.1" y1="12.1" x2="20.3" y2="12.9" /><line x1="12.2" y1="12.4" x2="16.6" y2="19.1" /><line x1="11.8" y1="12.4" x2="7.3" y2="19.2" /><line x1="11.9" y1="12.1" x2="3.7" y2="13.3" /><line x1="11.8" y1="11.7" x2="7.8" y2="4.4" /></svg>';
@@ -900,6 +902,28 @@ export default withMermaid(
       socialLinks
     },
     markdown: {
+      anchor: {
+        // Heading ids are auto-slugged from heading text, so each locale would
+        // otherwise get ids in its own language. The language switcher carries
+        // the URL hash across locales, so a shared "#實際案例" link dead-ends
+        // after switching to English. Apply the English ids everywhere, keeping
+        // heading text translated: the same convention vitepress.dev uses.
+        //
+        // Only applied where the locale's heading count matches English; a page
+        // whose structure has drifted keeps its localized ids rather than
+        // getting ids that point at the wrong section.
+        slugifyWithState(source: string, state: any) {
+          const [locale, ...rest] = String(state.env.relativePath ?? '').split('/')
+          const page = (anchorMap as Record<string, { ids: string[]; locales: Record<string, number> }>)[
+            rest.join('/')
+          ]
+          if (page && page.locales[locale] === page.ids.length) {
+            const index = (state.env.__anchorIndex = (state.env.__anchorIndex ?? -1) + 1)
+            if (page.ids[index]) return page.ids[index]
+          }
+          return defaultSlugify(source)
+        },
+      },
       theme: {
         light: 'github-light',
         dark: 'github-dark'
```

**File**: `docs/en/harness-designs/claude-code/index.md` (modified, +2/-2)
```diff
@@ -47,7 +47,7 @@ The key design is **separation of responsibilities**: CLAUDE.md manages "what,"
 
 Lecture 10 explains that "verification only counts when the complete flow works." Claude Code implements this through two tracks:
 
-**1. Permission system (deterministic constraints).** Claude Code's permissions do not simply "ask about everything." According to VILA Lab's analysis of v2.1.88, the system combined seven modes with an ML-based classifier at that time: low-risk operations are allowed, while high-risk operations are either confirmed or denied according to policy (for architectural details, see the [VILA Lab analysis](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)). Note that permission-mode naming has changed since v2.1.88: current Anthropic docs ([permission modes](https://code.claude.com/docs/en/permission-modes)) list Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, and bypassPermissions. This turns "setting clear task boundaries for the agent" (Lecture 7) into runtime enforcement instead of a plea in a prompt.
+**1. Permission system (deterministic constraints).** Claude Code's permissions do not simply "ask about everything." According to VILA Lab's analysis of v2.1.88, the system combined seven modes with an ML-based classifier at that time: low-risk operations are allowed, while high-risk operations are either confirmed or denied according to policy (for architectural details, see the [VILA Lab analysis](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)). Note that permission-mode naming has changed since v2.1.88: current Anthropic docs ([permission modes](https://code.claude.com/docs/en/permission-modes)) list Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, dontAsk, and bypassPermissions. This turns "setting clear task boundaries for the agent" (Lecture 7) into runtime enforcement instead of a plea in a prompt.
 
 **2. Hooks (preventing premature declarations of completion).** `PostToolUse` hooks can force checks to run after tool execution and write the results back into the context; `Stop` hooks intervene when the agent declares completion. This separates "the one doing the work" from "the one checking the work." [Anthropic explicitly observed in its harness article](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) that agents "confidently praised their work," so hooks inject **deterministic** checks instead of trusting the model's self-evaluation.
 
@@ -83,7 +83,7 @@ Every claim can be traced back to the sources below, avoiding secondhand recolle
 
 - **Claude Code · Memory**: A fresh context for every session, the four CLAUDE.md scopes, on-demand loading by subdirectory, auto memory (200 lines / 25KB), and `/init` generation of CLAUDE.md.<br/>https://code.claude.com/docs/en/memory
 - **Claude Code · Skills / MCP / Hooks / Sub-agents**: Definitions of the four extension mechanisms and their events (PreToolUse / PostToolUse / Stop).<br/>https://code.claude.com/docs/en/skills | https://code.claude.com/docs/en/mcp | https://code.claude.com/docs/en/hooks | https://code.claude.com/docs/en/sub-agents
-- **Claude Code · Permission modes**: Current mode names Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, and bypassPermissions.<br/>https://code.claude.com/docs/en/permission-modes
+- **Claude Code · Permission modes**: Current mode names Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, dontAsk, and bypassPermissions.<br/>https://code.claude.com/docs/en/permission-modes
 - **Anthropic, Effective harnesses for long-running agents**: The source for the claims that "reliability comes from the harness rather than the model," that agents "confidently praised their work," and that hooks should be used for verification.<br/>https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 
 ### In
```

**File**: `docs/zh-TW/harness-designs/claude-code/index.md` (modified, +2/-2)
```diff
@@ -47,7 +47,7 @@ Claude Code 把擴充介面分成四類，每一類解決一種問題，這是
 
 課程第十講談「跑通完整流程才算真正驗證」，Claude Code 對應的機制是雙軌制：
 
-**1. permissions 系統（確定性約束）。** Claude Code 的 permissions 不是「全部都詢問一遍」，根據 VILA Lab 對 v2.1.88 的拆解，當時的系統採用七種模式 + 一個基於 ML 的分類器：低風險操作放行，高風險操作則依原則詢問或拒絕（架構細節請參閱 [VILA Lab 拆解](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)）。注意 v2.1.88 之後 permissions 模式命名已有變動：目前官方文件（[permission modes](https://code.claude.com/docs/en/permission-modes)）列出 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto 與 bypassPermissions。這是把「為 agent 劃清邊界」（第七講）做成執行時期的強制機制，而不是靠提示詞懇求。
+**1. permissions 系統（確定性約束）。** Claude Code 的 permissions 不是「全部都詢問一遍」，根據 VILA Lab 對 v2.1.88 的拆解，當時的系統採用七種模式 + 一個基於 ML 的分類器：低風險操作放行，高風險操作則依原則詢問或拒絕（架構細節請參閱 [VILA Lab 拆解](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)）。注意 v2.1.88 之後 permissions 模式命名已有變動：目前官方文件（[permission modes](https://code.claude.com/docs/en/permission-modes)）列出 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto、dontAsk 與 bypassPermissions。這是把「為 agent 劃清邊界」（第七講）做成執行時期的強制機制，而不是靠提示詞懇求。
 
 **2. hooks（防止提前宣告完成）。** `PostToolUse` hooks 可以在工具執行後強制檢查、把結果寫回上下文；`Stop` hooks 則在 agent 宣告完成時介入。這就是「做事的人和檢查的人分開」，[Anthropic 在 harness 文章裡明確觀察到](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)，agent 會自信地稱讚自己的工作（"confidently praised their work"），因此用 hooks 注入**確定性**檢查，而不是信任模型的自我評估。
 
@@ -83,7 +83,7 @@ Claude Code 的日誌是完整的附加式記錄（history.jsonl），加上 `/c
 
 - **Claude Code 官方文件 · Memory**：每次 session 使用全新上下文、CLAUDE.md 四種作用範圍、子目錄隨選載入、auto memory（200 行 / 25KB）、`/init` 產生 CLAUDE.md。<br/>https://code.claude.com/docs/en/memory
 - **Claude Code 官方文件 · Skills / MCP / Hooks / Sub-agents**：四種擴充機制的定義與事件（PreToolUse / PostToolUse / Stop）。<br/>https://code.claude.com/docs/en/skills ｜ https://code.claude.com/docs/en/mcp ｜ https://code.claude.com/docs/en/hooks ｜ https://code.claude.com/docs/en/sub-agents
-- **Claude Code 官方文件 · Permission modes**：目前的模式名稱 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto 與 bypassPermissions。<br/>https://code.claude.com/docs/en/permission-modes
+- **Claude Code 官方文件 · Permission modes**：目前的模式名稱 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto、dontAsk 與 bypassPermissions。<br/>https://code.claude.com/docs/en/permission-modes
 - **Anthropic《Effective harnesses for long-running agents》**：「可靠性來自 harness 而非模型」、agent 會自信地稱讚自己的工作、用 hooks 進行驗證等觀點的出處。<br/>https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 
 ### 獨立研究 / 社群資源
```

---

### Incident Patch 2: `8e9ac238` (2026-09-30)
**Commit Message**: fix: add missing harness-designs nav item for Spanish locale (#71)

The harness-designs section was missing from the Spanish navigation
menu even though all content is translated and available. Added the
harnessDesign label to the Spanish locale configuration.

**File**: `docs/.vitepress/config.mts` (modified, +1/-0)
```diff
@@ -1061,6 +1061,7 @@ export default withMermaid(
           resources: "Biblioteca",
           skills: "Skills",
           resourceLibrary: "Biblioteca de recursos",
+          harnessDesign: "Análisis de los harness más avanzados",
           tryHarness: "Try Harness ↗",
           outline: "En esta página",
           prev: "Anterior",
```

---

### Incident Patch 3: `0aa032d2` (2026-09-30)
**Commit Message**: fix: zh-TW translation residue in Lecture 04 (#72)

* Fix zh-TW translation residue in lecture 04

- Remove duplicated sentence in contradiction section
- Fix simplified Chinese residue (明确/记住/稀释/编寫/参考)
- Fix punctuation and Mainland lexicon (要麼->要嘛)

* Unify 專題文件 to 主題文件 in zh-TW lecture 04

**File**: `docs/zh-TW/lectures/lecture-04-why-one-giant-instruction-file-fails/index.md` (modified, +16/-16)
```diff
@@ -23,7 +23,7 @@
 
 **維護衰減。** 大檔案天生難維護。指令過時了沒人刪，因為刪除的後果不確定（「也許別的地方依賴這條規則？」），但加新指令是無成本的。結果檔案只增不減，信噪比持續下降。這和軟體裡的技術債務積累一模一樣。
 
-**矛盾累積。** 不同時期加的指令之間開始出現矛盾，一條說「用 TypeScript 嚴格模式」，另一條說「某些遺留檔案允許用 any」。Agent 每次隨機選一條遵循。Agent 每次碰到矛盾指令只能隨機選一條遵循。
+**矛盾累積。** 不同時期加的指令之間開始出現矛盾，一條說「用 TypeScript 嚴格模式」，另一條說「某些遺留檔案允許用 any」。Agent 每次隨機選一條遵循。
 
 ## 核心概念
 
@@ -49,17 +49,17 @@ flowchart LR
 flowchart TB
     File["600 行指令檔案"] --> Top["頂部<br/>快速開始 + 硬約束"]
     File --> Mid["中部<br/>第 300 行的安全規則"]
-    File --> Bot["底部<br/>明确的結束檢查清單"]
-    Top --> Seen["高概率被记住"]
+    File --> Bot["底部<br/>明確的結束檢查清單"]
+    Top --> Seen["高機率被記住"]
     Bot --> Seen
-    Mid --> Missed["高概率被稀释或忽略"]
+    Mid --> Missed["高機率被稀釋或忽略"]
 ```
 
 ## 拆分思路
 
 核心原則，常用資訊放手邊，偶爾用的收起來，用不上的別帶。
 
-入口檔案 `AGENTS.md` 控制在 50-200 行，只放最常用的東西，專案概覽（一兩句話說清楚這是什麼）、首次執行命令（`make setup && make test`）、全域硬約束（不超過 15 條不可違反的規則）、指向專題文件的連結（一行描述 + 適用條件）。
+入口檔案 `AGENTS.md` 控制在 50-200 行，只放最常用的東西，專案概覽（一兩句話說清楚這是什麼）、首次執行命令（`make setup && make test`）、全域硬約束（不超過 15 條不可違反的規則）、指向主題文件的連結（一行描述 + 適用條件）。
 
 ```markdown
 # AGENTS.md
@@ -77,19 +77,19 @@ Python 3.11 FastAPI 後端，PostgreSQL 15 資料庫。
 - 所有資料庫查詢必須用 SQLAlchemy 2.0 語法
 - 所有 PR 必須通過 pytest + mypy --strict + ruff check
 
-## 專題文件
+## 主題文件
 - API 設計規範 (`docs/api-patterns.md`) — 添加新端點時必讀
 - 資料庫操作約束 (`docs/database-rules.md`) — 涉及資料庫修改時必讀
-- 測試標準 (`docs/testing-standards.md`) — 编寫測試時参考
+- 測試標準 (`docs/testing-standards.md`) — 編寫測試時參考
 ```
 
-每個專題文件 50-150 行，按主題放在 `docs/` 目錄下或對應模組目錄旁。Agent 只在需要時才去讀。找東西不用翻整份文件。
+每個主題文件 50-150 行，按主題放在 `docs/` 目錄下或對應模組目錄旁。Agent 只在需要時才去讀。找東西不用翻整份文件。
 
 還有些資訊直接放在程式碼裡更合適，類型定義、介面註釋、配置檔案裡的說明。Agent 讀程式碼的時候自然能看到，不用再在指令裡重複一遍。
 
 每條指令都應該標明來源（「為什麼加這條規則？」）、適用條件（「這條規則在什麼時候需要？」）、過期條件（「什麼情況下可以刪掉這條規則？」）。定期審計，刪掉過時的、冗餘的、矛盾的條目。像管理程式碼依賴一樣管理你的指令，用不上的依賴就該刪掉，不然它們只會拖慢系統。
 
-如果某條指令必須在入口檔案裡，放頂部或底部，不要放中間。「中間迷失」效應告訴我們，LLM 對長文字中間部分的資訊利用效率顯著低於兩端。但更好的做法是把指令放到專題文件裡，讓 agent 按需加載。
+如果某條指令必須在入口檔案裡，放頂部或底部，不要放中間。「中間迷失」效應告訴我們，LLM 對長文字中間部分的資訊利用效率顯著低於兩端。但更好的做法是把指令放到主題文件裡，讓 agent 按需加載。
 
 OpenAI 和 Anthropic 都隱性支援拆分的做法。OpenAI 說入口檔案應「短小且以路由為導向」，Anthropic 說長執行 agent 的控制資訊應「簡潔且高優先級」。兩家都在說同一件事，別把什麼都塞進一個檔案裡。
 
@@ -101,17 +101,17 @@ Agent 表現開始明顯下降：簡單 bug 修復任務中 agent 花大量脈
 
 團隊執行了文件重組：
 1. `AGENTS.md` 裁剪到 80 行：只保留專案概覽、執行命令、15 條全域硬約束
-2. 建立專題文件：`docs/api-patterns.md`（120 行）、`docs/database-rules.md`（60 行）、`docs/testing-standards.md`（80 行）
-3. 路由檔案添加指向專題文件的連結
-4. 歷史筆記要麼轉成測試用例，要麼刪除
+2. 建立主題文件：`docs/api-patterns.md`（120 行）、`docs/database-rules.md`（60 行）、`docs/testing-standards.md`（80 行）
+3. 路由檔案添加指向主題文件的連結
+4. 歷史筆記要嘛轉成測試用例，要嘛刪除
 
 重構後：同一任務集的成功率從 45% 提升到 72%。安全約束遵循率從 60% 提升到 95%，因為從檔案中間移到了路由檔案頂部，不再被「中間迷失」了。
 
 ## 關鍵要點
 
-- 「加條規則」是短期的止痛藥，長期的毒藥。每次加規則前想想：這條規則放專題文件是不是更合適？，別把所有規則都堆進入口文件。
+- 「加條規則」是短期的止痛藥，長期的毒藥。每次加規則前想想：這條規則放主題文件是不是更合適。
 - 入口檔案是路由器，不是百科全書。50-200 行，只放概覽、硬約束、和連結。
-- 利用「中間迷失」效應：重要資訊放檔案頂部或底部，不重要的移到專題文件。
+- 利用「中間迷失」效應：重要資訊放檔案頂部或底部，不重要的移到主題文件。
 - 像管理技術債一樣管理指令膨脹。定期審計，每條指令要有來源、適用條件、和過期條件。
 - 拆分之後信噪比提升，agent 把更多脈絡預算花在實際任務上，而不是處理無關指令。
 
@@ -125,8 +125,8 @@ Agent 表現開始明顯下降：簡單 bug 修復任務中 agent 花大量脈
 
 ## 練習
 
-1. **信噪比審計**：拿你目前的入口指令檔案，列出所有指令條目。選 5 個不同的常見任務類型，標註每條指令是否跟該任務相關。計算每個任務類型的 SNR。那些對大多數任務都是噪聲的指令，移到專題文件裡。
+1. **信噪比審計**：拿你目前的入口指令檔案，列出所有指令條目。選 5 個不同的常見任務類型，標註每條指令是否跟該任務相關。計算每個任務類型的 SNR。那些對大多數任務都是噪聲的指令，移到主題文件裡。
 
-2. **漸進式披露重構**：如果你有一個超過 300 行的指令檔案，把它拆成：(a) 不超過 100 行的路由檔案，(b) 3-5 個專題文件。重構前後各跑同一組任務（至少 5 個），對比成功率。
+2. **漸進式披露重構**：如果你有一個超過 300 行的指令檔案，把它拆成：(a) 不超過 100 行的路由檔案，(b) 3-5 個主題文件。重構前後各跑同一組任務（至少 5 個），對比成功率。
 
 3. **中間迷失驗證**：在一個長指令檔案裡，把一條關鍵約束分別放在頂部、中間、底部各跑一組任務（每組至少 5 次），看遵循率有沒有差別。你可能會驚訝於位置效應有多大。
```

---

### Incident Patch 4: `3f85661c` (2026-09-30)
**Commit Message**: fix(audit-harness): close two false-PASS checks in Subsystem 1 (#78)

1. "Entry file is 50-200 lines [L04]" only tested the upper bound, so a
   3-line AGENTS.md passed. Enforce the lower bound too, and make the fix
   hint cover both directions.
2. "State files are enumerated" used contains_pattern (grep -i) with bare
   PROGRESS|DECISIONS, so any prose containing the word "progress" (e.g.
   "work in progress") passed without naming a state file. Match the file
   names (PROGRESS.md, DECISIONS.md, docs/decisions, feature_list).

Repro (4 fixtures): before 2/4 wrong (both bug fixtures PASS), after 4/4
(bug fixtures WARN, controls with 100+ lines / PROGRESS.md still PASS).
Found while auditing a real repo whose CLAUDE.md passed check 2 only via
the token "hop_progress_only".

Co-authored-by: OpenClaw System <openclaw@local.dev>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `tools/audit-harness.sh` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ if [[ "$inst" == "pass" ]]; then
     "$(contains_pattern "$ipath" "(MUST|MUST NOT|must not|must never|constraint|forbidden|never)")" \
     "Add a Constraints section to $ipath with explicit MUST / MUST NOT rules."
   check_recommended "State files are enumerated (PROGRESS.md, feature_list)" \
-    "$(contains_pattern "$ipath" "(PROGRESS|feature_list|DECISIONS)")" \
+    "$(contains_pattern "$ipath" "(PROGRESS\.md|feature_list|DECISIONS\.md|docs/decisions)")" \
     "Reference PROGRESS.md, DECISIONS.md, and feature_list.json in $ipath so agents know where state lives."
   check_recommended "Documentation staleness rule present (update docs with code, no stale docs)" \
     "$(contains_pattern "$ipath" "(stale|staleness|same commit|doc.*update|update.*doc|outdated)")" \
@@ -139,8 +139,8 @@ if [[ "$inst" == "pass" ]]; then
   # L04: Split instructions
   _inst_lines="$(wc -l < "$REPO/$ipath" 2>/dev/null || echo 999)"
   check_recommended "Entry file is 50–200 lines (router, not encyclopedia) [L04]" \
-    "$([[ $_inst_lines -le 200 ]] && echo "pass" || echo "fail")" \
-    "$ipath is $_inst_lines lines — split detailed sections into docs/ topic files and link to them from $ipath."
+    "$([[ $_inst_lines -ge 50 && $_inst_lines -le 200 ]] && echo "pass" || echo "fail")" \
+    "$ipath is $_inst_lines lines (target 50–200) — if longer, split detailed sections into docs/ topic files and link to them; if shorter, add the missing router sections (overview, verification, constraints, state files)."
   check_recommended "Entry file links to topic documents in docs/ [L04]" \
     "$(contains_pattern "$ipath" "(docs/[a-z])")" \
     "Add links in $ipath to topic docs in docs/ (e.g. 'See [Architecture](docs/architecture.md)')."
```

---

### Incident Patch 5: `abdd8e42` (2026-09-30)
**Commit Message**: Fix file path in execution comment (#79)

**File**: `docs/en/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
  * a harness. The harness version adds explicit rules, verification steps,
  * and stop conditions.
  *
- * Run: npx tsx docs/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts
+ * Run: npx tsx docs/en/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts
  */
 
 // ---------------------------------------------------------------------------
```

---

### Incident Patch 6: `77e7a3e2` (2026-08-26)
**Commit Message**: Merge pull request #65 from alecchen/fix/lecture-03-atomicity-analogy

Fix inaccurate git analogy in Lecture 03 (Atomicity, ACID section)

**File**: `docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 This analogy comes from database transaction management. You might feel like this is overcomplicating things, but it actually provides a very practical framework:
 
-- **Atomicity**: Each "logical operation" (e.g., "add new endpoint and update tests") gets one git commit. If it fails midway, `git stash` to roll back. All or nothing — no "half done."
+- **Atomicity**: A "logical operation" (say, adding an endpoint and updating its tests) is committed as a whole only once it's complete and verified. A failed or abandoned attempt gets discarded, not partially merged. All or nothing.
 - **Consistency**: Define "consistent state" verification predicates — all tests pass, lint reports zero errors. The agent runs verification after each operation; inconsistent intermediate states should not be committed. After an operation, the system should be in a verifiably correct state.
 - **Isolation**: When multiple agents work concurrently, design state files to avoid race conditions. Simple approach: each agent uses its own progress file, or use git branches for isolation. Concurrent writes to the same file are a common source of trouble.
 - **Durability**: Critical project knowledge lives in git-tracked files. Temporary state can stay in session memory, but knowledge that must survive across sessions has to be written to files. What's in your head doesn't count — only what's written down counts.
```

**File**: `docs/zh-TW/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 這個類比來自資料庫的事務管理，你可能覺得這是在把簡單的事情搞複雜，但實際上它給了你一個非常實用的框架。
 
-- **原子性**：每次「邏輯操作」（比如「添加新端點並更新測試」）用一個 git commit 原子化。中途掛了就 `git stash` 回溯。要麼全做，要麼不做，沒有「做了一半」。
+- **原子性**：每個「邏輯操作」（例如新增端點並更新測試）要等全部改完、驗證通過，才提交成一個 commit。做到一半失敗或放棄，直接丟掉，別留半成品。要嘛做完，要嘛當作沒發生過。
 - **一致性**：定義「一致狀態」的驗證謂詞，所有測試通過、lint 無報錯。Agent 每次操作後跑驗證，不一致的中間狀態不要 commit。
 - **隔離性**：多個 agent 併發工作時，狀態檔案要避免競爭條件。簡單方案：每個 agent 用獨立的進度檔案，或者用 git 分支隔離。
 - **持久性**：關鍵的專案知識用 git 跟蹤的檔案持久化。臨時狀態可以只在工作階段的記憶體中，但跨工作階段必須的知識必須寫到檔案裡。
```

---

### Incident Patch 7: `f8680b3b` (2026-08-25)
**Commit Message**: Fix inaccurate git analogy in Lecture 03 Atomicity bullet

Reframe the Atomicity bullet (ACID section) so a commit represents completion rather than a checkpoint to roll back from, and describe discarding an abandoned attempt at the principle level instead of naming git stash (a suspend/resume operation, not a rollback). Update the zh-TW translation to match.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

**File**: `docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 This analogy comes from database transaction management. You might feel like this is overcomplicating things, but it actually provides a very practical framework:
 
-- **Atomicity**: Each "logical operation" (e.g., "add new endpoint and update tests") gets one git commit. If it fails midway, `git stash` to roll back. All or nothing — no "half done."
+- **Atomicity**: A "logical operation" (say, adding an endpoint and updating its tests) is committed as a whole only once it's complete and verified. A failed or abandoned attempt gets discarded, not partially merged. All or nothing.
 - **Consistency**: Define "consistent state" verification predicates — all tests pass, lint reports zero errors. The agent runs verification after each operation; inconsistent intermediate states should not be committed. After an operation, the system should be in a verifiably correct state.
 - **Isolation**: When multiple agents work concurrently, design state files to avoid race conditions. Simple approach: each agent uses its own progress file, or use git branches for isolation. Concurrent writes to the same file are a common source of trouble.
 - **Durability**: Critical project knowledge lives in git-tracked files. Temporary state can stay in session memory, but knowledge that must survive across sessions has to be written to files. What's in your head doesn't count — only what's written down counts.
```

**File**: `docs/zh-TW/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 這個類比來自資料庫的事務管理，你可能覺得這是在把簡單的事情搞複雜，但實際上它給了你一個非常實用的框架。
 
-- **原子性**：每次「邏輯操作」（比如「添加新端點並更新測試」）用一個 git commit 原子化。中途掛了就 `git stash` 回溯。要麼全做，要麼不做，沒有「做了一半」。
+- **原子性**：每個「邏輯操作」（例如新增端點並更新測試）要等全部改完、驗證通過，才提交成一個 commit。做到一半失敗或放棄，直接丟掉，別留半成品。要嘛做完，要嘛當作沒發生過。
 - **一致性**：定義「一致狀態」的驗證謂詞，所有測試通過、lint 無報錯。Agent 每次操作後跑驗證，不一致的中間狀態不要 commit。
 - **隔離性**：多個 agent 併發工作時，狀態檔案要避免競爭條件。簡單方案：每個 agent 用獨立的進度檔案，或者用 git 分支隔離。
 - **持久性**：關鍵的專案知識用 git 跟蹤的檔案持久化。臨時狀態可以只在工作階段的記憶體中，但跨工作階段必須的知識必須寫到檔案裡。
```

---

### Incident Patch 8: `a49aa744` (2026-08-19)
**Commit Message**: Fix Chinese text leaked into translated harness-designs pages

- Translate alignment tables and reference source headers into de, es,
  fr, ru, tr via codex (previously left in Chinese)
- Remove Chinese diagram glosses from deepseek code blocks across all
  languages (en, ja, ko, pt-BR, uk, uz, vi, ar, de, es, fr, ru, tr)
- Revert ar 2nd-pass edits to keep clean Arabic translations

**File**: `docs/ar/harness-designs/deepseek/index.md` (modified, +4/-4)
```diff
@@ -17,11 +17,11 @@
 يستخدم DeepSeek Harness مفهوم Service للتعبير عن «القدرة»، ويقسّم كل قدرة تقريبًا إلى ثلاث طبقات:
 
 ```
-Service Definition（能力定义）
+Service Definition
         ↓
-Service Provider（能力提供者）
+Service Provider
         ↓
-Consumer（能力消费者）
+Consumer
 ```
 
 لنأخذ نظام الملفات مثالًا: يندرج تحت `FS Service` عدد من Provider مثل Local FS وE2B FS وRemote FS، وتُعرَض جميعها للأعلى بصورة موحّدة على هيئة file tools. وتتبع Shell وSubprocess وSandbox وWeb وLLM وSubAgent البنية نفسها. وهذه البنية الثلاثية ليست خلاصة من عندنا—بل تذكر [وثيقة البنية · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا: *فاصل القدرة هو قدرة قابلة للاستبدال ذات ثلاثة أدوار: Service Definition يعلن الواجهة، وService Provider ينفذها، وConsumer يستخدمها، وغالبًا ما يكون الأخير أداة ظاهرة للنموذج*.
@@ -37,7 +37,7 @@ turn/start → claim input → assemble（system prompt / context / tools）
   → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
   → assistant/message → tool/call
   → tools/pre-execute（permission / guard / policy / hook）
-  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+  → tools/execute → tools/post-execute → tool/result → step/end → next turn
 ```
 
 (المسار أعلاه إعادة صياغة لقسم [وثيقة البنية · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): تمثل `turn/*` و`step/*` و`user/message` و`assistant/*` و`tool/*` أحداث جلسة دائمة، بينما تمثل `agent/pre-step` و`agent/request` و`llm/stream` و`tools/*` نقاط توسعة يمكن للإضافات الاستماع إليها.)
```

**File**: `docs/de/harness-designs/claude-code/index.md` (modified, +6/-6)
```diff
@@ -59,13 +59,13 @@ Claude Codes Logs sind vollständige append-oriented Aufzeichnungen (history.jso
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | Claude Code 的实现 | 评价 |
+| Subsystem | Umsetzung von Claude Code | Bewertung |
 | --- | --- | --- |
-| 指令 | 作用域分层（组织/用户/项目/本地）+ 自动记忆 | 分层记忆是标杆实现 |
-| 工具 | 技能 + MCP + 钩子 + 子智能体四类扩展 | 职责划分清晰，是核心亮点 |
-| 环境 | 项目内设置 + settings.json | 靠用户在 CLAUDE.md 里自描述 |
-| 状态 | 追加式会话存储 + 五层压缩 + resume/fork | 极强，长任务连续性的参考实现 |
-| 反馈 | 权限分类器 + PostToolUse 钩子强制检查 | 把"防提前宣告完成"变成确定性机制 |
+| Anweisungen | Schichtung nach Geltungsbereich (Organisation/Benutzer/Projekt/lokal) + automatisches Memory | Geschichtetes Memory ist eine Referenzimplementierung |
+| Werkzeuge | Skills + MCP + hooks + subagents als vier Erweiterungstypen | Klare Trennung der Verantwortlichkeiten; ein zentraler Pluspunkt |
+| Umgebung | Projekteinstellungen + settings.json | Basiert auf der Selbstbeschreibung des Benutzers in CLAUDE.md |
+| Zustand | Append-only session-Speicher + fünfstufige compaction + resume/fork | Sehr stark; eine Referenzimplementierung für die Kontinuität lang laufender Aufgaben |
+| Feedback | Permission-Klassifikator + durch PostToolUse-hooks erzwungene Prüfungen | Macht die Verhinderung verfrühter Fertigmeldungen zu einem deterministischen Mechanismus |
 
 ## Übernehmenswerte Designs
 
```

**File**: `docs/de/harness-designs/codex/index.md` (modified, +6/-6)
```diff
@@ -47,13 +47,13 @@ Approval Policies und Plan Mode bilden die andere Seite des Feedbacks: Vor risik
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | Codex 的实现 | 评价 |
+| Subsystem | Umsetzung von Codex | Bewertung |
 | --- | --- | --- |
-| 指令 | AGENTS.md 目录页 + docs/ 拆分 + 执行不变量 | 教科书级，定义了"给地图不给说明书" |
-| 工具 | worktree 隔离 + spawn_agent 子智能体 | 边界靠环境硬隔离，很强 |
-| 环境 | 独立 worktree + 可观测性栈 | worktree 隔离是其招牌 |
-| 状态 | Write 策略（状态写进文件/文档） | 依赖约定而非内建记忆 |
-| 反馈 | 验证命令入规范 + 审批策略 + plan mode | 反馈路径默认化，值得抄 |
+| Anweisungen | AGENTS.md als Verzeichnisseite + Aufteilung in docs/ + Ausführungsinvarianten | Lehrbuchreif; definiert das Prinzip „eine Karte, keine Anleitung“ |
+| Werkzeuge | worktree-Isolation + spawn_agent-subagents | Grenzen werden durch harte Umgebungsisolation durchgesetzt; sehr stark |
+| Umgebung | Eigener worktree + Observability-Stack | worktree-Isolation ist das Markenzeichen |
+| Zustand | Write-Strategie (Zustand wird in Dateien/Dokumente geschrieben) | Beruht auf Konventionen statt auf integriertem Memory |
+| Feedback | Validierungsbefehle in der Spezifikation + Approval Policies + plan mode | Der Feedbackpfad ist standardmäßig vorgesehen; nachahmenswert |
 
 Der Vergleich zwischen Codex und Claude Code ist aufschlussreich: Claude Code verfolgt „Addition“ – Memory, permissions und subagents werden in den Kernel eingebaut. Codex verfolgt „Subtraktion“ – der Kernel bleibt möglichst zurückhaltend, während mehr Verantwortung bei Repository-Konventionen und Context Engineering liegt. Deshalb heißt es in der Community oft: „Die harness-Philosophie von Codex ist wertvoller als sein Code.“
 
```

**File**: `docs/de/harness-designs/deepseek/index.md` (modified, +10/-10)
```diff
@@ -17,11 +17,11 @@ Das ist die konsequenteste Umsetzung des Kurssatzes „Alles außerhalb der Mode
 DeepSeek Harness stellt „Fähigkeiten“ als Services dar; fast jede Fähigkeit ist in drei Ebenen aufgeteilt:
 
 ```
-Service Definition（能力定义）
+Service Definition
         ↓
-Service Provider（能力提供者）
+Service Provider
         ↓
-Consumer（能力消费者）
+Consumer
 ```
 
 Am Beispiel des Dateisystems: Unter dem `FS Service` stehen mehrere Provider wie Local FS, E2B FS und Remote FS, die nach oben einheitlich als file tools exponiert werden. Shell, Subprocess, Sandbox, Web, LLM und SubAgent folgen derselben Struktur. Diese Dreiteilung ist keine Zusammenfassung von uns. Die [Architekturdokumentation · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) sagt: *a seam is a swappable capability with three roles: a Service Definition declaring the interface, a Service Provider implementing it, and a Consumer using it, commonly a model-facing tool* (Ein Capability Seam ist eine austauschbare Fähigkeit mit drei Rollen: einer Service Definition, die das Interface deklariert, einem Service Provider, der es implementiert, und einem Consumer, der es verwendet – üblicherweise ein dem Modell zugängliches Tool).
@@ -37,7 +37,7 @@ turn/start → claim input → assemble（system prompt / context / tools）
   → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
   → assistant/message → tool/call
   → tools/pre-execute（permission / guard / policy / hook）
-  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+  → tools/execute → tools/post-execute → tool/result → step/end → next turn
 ```
 
 (Die obige Pipeline ist eine Wiedergabe des Abschnitts [Architekturdokumentation · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): `turn/*`, `step/*`, `user/message`, `assistant/*` und `tool/*` sind persistierte session-Events; `agent/pre-step`, `agent/request`, `llm/stream` und `tools/*` sind Erweiterungspunkte, die plugins beobachten können.)
@@ -58,13 +58,13 @@ Mit anderen Worten: Observability ist kein nachträglich ergänztes Logging, son
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | DeepSeek Harness 的实现 | 评价 |
+| Subsystem | Umsetzung von DeepSeek Harness | Bewertung |
 | --- | --- | --- |
-| 指令 | 插件化；规则/技能均以插件形态注入 | 极自由，但没有内置的"CLAUDE.md"式惯例 |
-| 工具 | Service Definition → Provider → Consumer 能力接缝 | 工具子系统标准化的极致 |
-| 环境 | 沙箱/FS/Shell 全部可换 Provider（含远程 E2B） | 环境彻底可插拔 |
-| 状态 | append-only Session Event Log + Model-visible means logged | 可观测性是第一性约束 |
-| 反馈 | tools/pre-execute 上的 permission / guard / policy / hook | 反馈机制事件化 |
+| Anweisungen | Pluginbasiert; Regeln und Skills werden als plugins injiziert | Maximale Freiheit, aber keine integrierte Konvention nach Art von CLAUDE.md |
+| Werkzeuge | Service Definition → Provider → Consumer als Capability Seam | Konsequente Standardisierung des Werkzeugsubsystems |
+| Umgebung | Provider für Sandbox/FS/Shell sind vollständig austauschbar (einschließlich Remote-E2B) | Die Umgebung ist vollständig austauschbar |
+| Zustand | append-only Session Event Log + Model-visible means logged | Observability ist ein Constraint erster Ordnung |
+| Feedback | permission / guard / policy / hook auf tools/pre-execute | Der Feedbackmechanismus ist ereignisbasiert |
 
 Der grundlegende Unterschied zwischen DeepSeek Harness und den drei anderen Produkten: Pi, Claude Code und Codex optimieren den harness jeweils „innerhalb eines bestimmten agent“. DeepSeek Harness definiert den harness dagegen als **modellunabhängiges Betriebssystem**; der agent selbst ist nur eine austauschbare Anwendung auf diesem OS. Der Preis ist offensichtlich: Hohe Freiheit verursacht hohen Konfigurationsaufwand. Das ist die unvermeidliche Kehrseite des Designs „harness als OS“ – und in der Developer Preview lautet die Positionierung ohnehin „früh ausprobieren, während sich die Mechanismen noch entwickeln“.
 
```

**File**: `docs/de/harness-designs/pi/index.md` (modified, +6/-6)
```diff
@@ -63,13 +63,13 @@ Dasselbe Community-Repository bestätigt dieses Muster weiter: `VISION.md` (Ziel
 
 Bewertung von Pi anhand der fünf Subsysteme des Kurses (subjektiv, zum Vergleich):
 
-| 子系统 | Pi 的实现 | 评价 |
+| Subsystem | Umsetzung von Pi | Bewertung |
 | --- | --- | --- |
-| 指令 | AGENTS.md 分级加载 + SYSTEM.md | 层级清晰，但规则本身要靠用户写 |
-| 工具 | 技能按需加载 + 扩展全生命周期钩子 | 极强，把工具系统做成了可编程面 |
-| 环境 | SYSTEM.md 做环境自描述；运行时环境靠用户在 AGENTS.md 里声明 | 机制是开放的，但可复现性依赖用户自述 |
-| 状态 | 会话树 + 压缩可定制 + PROGRESS.md | 极强，跨会话与可恢复性是其核心 |
-| 反馈 | 验证命令靠用户定义；session-summary / extract-patterns 机制化 | 机制提供，内容靠用户 |
+| Anweisungen | Abgestuftes Laden von AGENTS.md + SYSTEM.md | Klare Hierarchie, die Regeln selbst müssen jedoch vom Benutzer verfasst werden |
+| Werkzeuge | Laden von Skills bei Bedarf + hooks für den gesamten Lebenszyklus von Extensions | Sehr stark; macht das Werkzeugsystem zu einer programmierbaren Oberfläche |
+| Umgebung | SYSTEM.md zur Selbstbeschreibung der Umgebung; die Runtime-Umgebung wird vom Benutzer in AGENTS.md deklariert | Der Mechanismus ist offen, die Reproduzierbarkeit hängt jedoch von der Selbstbeschreibung des Benutzers ab |
+| Zustand | session tree + anpassbare compaction + PROGRESS.md | Sehr stark; session-übergreifende Kontinuität und Wiederherstellbarkeit bilden den Kern |
+| Feedback | Validierungsbefehle werden vom Benutzer definiert; session-summary / extract-patterns sind als Mechanismen umgesetzt | Der Mechanismus wird bereitgestellt, der Inhalt kommt vom Benutzer |
 
 Pis Trade-offs stehen in scharfem Kontrast zu Claude Code und Codex: Claude Code baut „Memory, permissions und subagents“ gebrauchsfertig in den Kernel ein; Codex macht „Repository-Konventionen und Umgebungsisolation“ zum Standard. Pi entscheidet sich dafür, **nichts an deiner Stelle zu entscheiden** – es macht die Entscheidungshoheit zu Erweiterungspunkten. Der Preis: Du musst Extensions entweder selbst schreiben oder Pakete anderer installieren.
 
```

---

### Incident Patch 9: `260a3993` (2026-08-19)
**Commit Message**: Translate 前沿 Harness 拆解 column to all 15 languages and fix Discord link

- Add harness-designs translation files for ar, de, en, es, fr, ja, ko,
  pt-BR, ru, tr, uk, uz, vi, zh-TW (5 pages each: overview, Pi, Claude
  Code, Codex, DeepSeek)
- Wire harness-designs nav/sidebar in config.mts for all locales
- Add column cards to every language homepage
- Point Discord community link to https://github.com/walkinglabs

**File**: `README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <img src="https://img.shields.io/badge/Projects-8-green?style=flat-square" alt="8 Projects">
   <img src="https://img.shields.io/badge/Languages-15-yellow?style=flat-square" alt="15 Languages">
   <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT License">
-  <a href="https://discord.gg/XU7DQmpqk"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the Discord community"></a>
+  <a href="https://github.com/walkinglabs"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the Discord community"></a>
 </p>
 
 > 🌍 This course is available in **15 languages**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Русский, Deutsch, العربية, Tiếng Việt, Oʻzbekcha, Türkçe, Portuguese (BR), Українська. Choose your language from the badges above.
```

**File**: `docs-readme/uk-UA/README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <img src="https://img.shields.io/badge/Projects-8-green?style=flat-square" alt="8 проєктів">
   <img src="https://img.shields.io/badge/Languages-15-yellow?style=flat-square" alt="15 мов">
   <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="Ліцензія MIT">
-  <a href="https://discord.gg/XU7DQmpqk"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Приєднатися до спільноти в Discord"></a>
+  <a href="https://github.com/walkinglabs"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Приєднатися до спільноти в Discord"></a>
 </p>
 
 > 🌍 Цей курс доступний **15 мовами**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Русский, Deutsch, العربية, Tiếng Việt, Oʻzbekcha, Türkçe, Portuguese (BR), Українська. Оберіть свою мову за допомогою значків вище.
```

**File**: `docs/.vitepress/config.mts` (modified, +168/-14)
```diff
@@ -5,11 +5,12 @@ import { withMermaid } from "vitepress-plugin-mermaid";
 const docsBase = "/learn-harness-engineering/";
 const brandLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23D95C41" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12.1" y1="11.9" x2="18.9" y2="8.2" /><line x1="12.1" y1="12.1" x2="20.3" y2="12.9" /><line x1="12.2" y1="12.4" x2="16.6" y2="19.1" /><line x1="11.8" y1="12.4" x2="7.3" y2="19.2" /><line x1="11.9" y1="12.1" x2="3.7" y2="13.3" /><line x1="11.8" y1="11.7" x2="7.8" y2="4.4" /></svg>';
 const githubRepoTreeLink = "https://github.com/walkinglabs/learn-harness-engineering/tree/main";
-const discordInviteLink = "https://discord.gg/XU7DQmpqk";
-const socialLinks = [
+// Discord 邀请链接会过期，社区入口默认指向组织主页
+const communityLink = "https://github.com/walkinglabs";
+const socialLinks: Array<{ icon: "github" | "discord"; link: string }> = [
   { icon: "github", link: githubRepoTreeLink },
-  { icon: "discord", link: discordInviteLink }
-] as const;
+  { icon: "discord", link: communityLink }
+];
 
 const zhLectureItems = [
   { text: "欢迎", link: "/zh/" },
@@ -60,6 +61,14 @@ const zhHarnessDesignItems = [
   { text: "拆解 DeepSeek Harness 的设计", link: "/zh/harness-designs/deepseek/" }
 ];
 
+const enHarnessDesignItems = [
+  { text: "Frontier Harness Design Breakdowns", link: "/en/harness-designs/" },
+  { text: "Breaking Down Pi's Harness Design", link: "/en/harness-designs/pi/" },
+  { text: "Breaking Down Claude Code's Harness Design", link: "/en/harness-designs/claude-code/" },
+  { text: "Breaking Down Codex's Harness Design", link: "/en/harness-designs/codex/" },
+  { text: "Breaking Down DeepSeek Harness's Design", link: "/en/harness-designs/deepseek/" }
+];
+
 const enLectureItems = [
   { text: "Welcome", link: "/en/" },
   { text: "Why Capable Agents Still Fail", link: "/en/lectures/lecture-01-why-capable-agents-still-fail/" },
@@ -144,6 +153,22 @@ const viSkillItems = [
   { text: "Tổng quan về Kỹ năng", link: "/vi/skills/" },
 ];
 
+const viHarnessDesignItems = [
+  { text: "Phân tích các harness tiên tiến", link: "/vi/harness-designs/" },
+  { text: "Phân tích thiết kế harness của Pi", link: "/vi/harness-designs/pi/" },
+  { text: "Phân tích thiết kế harness của Claude Code", link: "/vi/harness-designs/claude-code/" },
+  { text: "Phân tích thiết kế harness của Codex", link: "/vi/harness-designs/codex/" },
+  { text: "Phân tích thiết kế DeepSeek Harness", link: "/vi/harness-designs/deepseek/" }
+];
+
+const ruHarnessDesignItems = [
+  { text: "Разбор передовых harness", link: "/ru/harness-designs/" },
+  { text: "Разбор дизайна harness в Pi", link: "/ru/harness-designs/pi/" },
+  { text: "Разбор дизайна harness в Claude Code", link: "/ru/harness-designs/claude-code/" },
+  { text: "Разбор дизайна harness в Codex", link: "/ru/harness-designs/codex/" },
+  { text: "Разбор дизайна DeepSeek Harness", link: "/ru/harness-designs/deepseek/" }
+];
+
 const ruLectureItems = [
   { text: "Добро пожаловать", link: "/ru/" },
   { text: "Сильная модель ≠ надёжное исполнение", link: "/ru/lectures/lecture-01-why-capable-agents-still-fail/" },
@@ -230,6 +255,22 @@ const uzSkillItems = [
   { text: "Malakalar umumiy koʻrinishi", link: "/uz/skills/" },
 ];
 
+const uzHarnessDesignItems = [
+  { text: "Ilgʻor harness dizaynlari tahlili", link: "/uz/harness-designs/" },
+  { text: "Pi harness dizayni tahlili", link: "/uz/harness-designs/pi/" },
+  { text: "Claude Code harness dizayni tahlili", link: "/uz/harness-designs/claude-code/" },
+  { text: "Codex harness dizayni tahlili", link: "/uz/harness-designs/codex/" },
+  { text: "DeepSeek Harness dizayni tahlili", link: "/uz/harness-designs/deepseek/" }
+];
+
+const koHarnessDesignItems = [
+  { text: "최전선 Harness 분석", link: "/ko/harness-designs/" },
+  { text: "Pi의 harness 설계 분석", link: "/ko/harness-designs/pi/" },
+  { text: "Claude Code의 harness 설계 분석", link: "/ko/harness-design
```

**File**: `docs/ar/harness-designs/claude-code/index.md` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+# تحليل تصميم harness في Claude Code
+
+توضح Anthropic في مقال [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) أن مصدر الموثوقية هو harness لا النموذج، وأن الـ agent يحتاج إلى قيود «خارج النموذج». ويعد Claude Code التجسيد العملي لهذه الفكرة؛ إذ تصنّفه Anthropic رسميًا ضمن فئة **agentic harness**. وليس ذلك شعارًا تسويقيًا—فلعل Claude Code أكثر harness جرى تحليله علنًا حتى الآن: شيفرته المصدرية مفتوحة، وتقارير المجتمع البحثية عنه مفصلة، كما حوّل معظم الآليات الجوهرية في محاضرات الدورة (الذاكرة الطبقية، وcompaction السياق، وpermissions، وhooks، وsubagents، واستمرارية session) إلى تطبيق متكامل على مستوى المنتج.
+
+نحلل في هذه المقالة Claude Code باستخدام إطار الأنظمة الفرعية الخمسة في الدورة، مع التركيز على كيفية تطبيقه مفاهيم harness الأساسية مثل «إدارة السياق» و«منع إعلان الإنجاز مبكرًا» و«القيود الحتمية».
+
+## التعريف في جملة واحدة
+
+جوهر Claude Code حلقة while بسيطة: استدعاء النموذج، وتنفيذ الأدوات، وملاحظة النتائج، ثم استدعاء النموذج مجددًا. لكن **الغالبية الساحقة من الشيفرة ليست داخل هذه الحلقة، بل في النظام المحيط بها**—نظام permissions، ومسار compaction للسياق، وآليات التوسعة، وتنسيق subagents، وتخزين session. وهذه هي ماهية harness: الحلقة هي الهيكل العظمي، وما يقع خارجها هو ما يحدد الموثوقية.
+
+## النظام الفرعي للتعليمات: منظومة ذاكرة طبقية
+
+يمثل نظام الذاكرة في Claude Code إسهامه الأكثر مباشرة في نظرية harness، وهو يقابل محاضرتي «المستودع هو مصدر الحقيقة» و«استمرارية السياق عبر sessions» في الدورة. توضح [الوثيقة الرسمية «How Claude remembers your project»](https://code.claude.com/docs/en/memory) أن كل session يبدأ بنافذة سياق جديدة تمامًا، وأن المعرفة تنتقل بين sessions بواسطة آليتين: ملفات CLAUDE.md (التعليمات التي تكتبها) وauto memory (الملاحظات التي يكتبها Claude بنفسه).
+
+ومن حيث النطاق، تقسم الوثائق الرسمية ملفات CLAUDE.md إلى أربع فئات (بترتيب التحميل من الأوسع إلى الأضيق):
+
+- **مستوى سياسة المؤسسة**: تديره فرق IT/DevOps مركزيًا (مثل `/etc/claude-code/CLAUDE.md`) لقواعد المؤسسة.
+- **مستوى المستخدم `~/.claude/CLAUDE.md`**: التفضيلات والقواعد الشخصية العابرة للمشروعات.
+- **مستوى المشروع `./CLAUDE.md` أو `./.claude/CLAUDE.md`**: مصدر الحقيقة للمشروع، ويشمل بنية المشروع، والمكدس التقني، وأوامر التحقق، ويُشارك مع المستودع.
+- **المستوى المحلي `./CLAUDE.local.md`**: التفضيلات الشخصية داخل المشروع، ويضاف عادة إلى `.gitignore` ولا يُعتمد.
+
+وتوجد آليتان إضافيتان:
+
+- **التحميل عند الطلب على مستوى الدليل الفرعي**: لا تُحمّل ملفات CLAUDE.md في الأدلة الفرعية عند بدء التشغيل، بل تدخل السياق عندما يقرأ Claude ملفًا في ذلك الدليل.
+- **الذاكرة التلقائية (auto memory)**: يكتب Claude ملاحظات بصورة استباقية بناءً على تصحيحاتك وتفضيلاتك؛ وتُشارك على مستوى المستودع وتعمل عبر worktree، مع تحميل أول 200 سطر أو 25KB كحد أقصى في كل session.
+
+تشكل هذه النطاقات الأربعة **تدرجًا للتعليمات**: تقول الوثائق الرسمية إن «التعليمات الأكثر تحديدًا تدخل السياق في وقت لاحق» (فتظهر تعليمات المشروع بعد تعليمات المستخدم). وتكمن القيمة في ألّا يُجبر النموذج على استيعاب ملف تعليمات ضخم كامل في بداية كل محادثة، بل تُحمّل التعليمات محليًا بحسب نطاقها. وهذا هو الجواب العملي عن سؤال المحاضرة الرابعة: «لماذا يفشل ملف التعليمات العملاق الواحد؟».
+
+## النظام الفرعي للسياق: مسار compaction من خمس طبقات
+
+تدير Claude Code السياق عبر **مسار compaction من خمس طبقات** (five-layer compaction pipeline)، لا بمجرد «التلخيص عند الامتلاء»—وتأتي هذه التفصيلة البنيوية من تحليل الشيفرة المصدرية في تقرير [VILA Lab‏ «Dive into Claude Code»](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf). تشرح المحاضرة الخامسة أن «المهام الطويلة تفقد الاستمرارية»، وحل Claude Code هو قمع متعدد المراحل: يبدأ بالتقليم غير الفاقد (إزالة نتائج الأدوات الزائدة)، ثم الاستخلاص المنظم، ولا يلجأ إلى تلخيص LLM الفاقد إلا في النهاية، مع آلية قاطع دائرة تمنع compaction المفرط.
+
+ويكمل ذلك تصميم تخزين session: **تخزين session موجّه إلى الإلحاق (append-oriented storage)**، تُلحق فيه كل السجلات بـ `history.jsonl`، مع دعم الاستئناف عبر `/resume` والتفرع fork. وهذا يض
```

**File**: `docs/ar/harness-designs/codex/index.md` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# تحليل تصميم harness في Codex
+
+لعل [Codex](https://openai.com/index/harness-engineering/) من OpenAI أكثر المنتجات الأربعة ارتباطًا بـ «أصول harness»—فمقال «Harness Engineering» الذي منح المجال كله اسمه، هو في حد ذاته خلاصة خبرة فريق OpenAI في بناء منتج باستخدام Codex. لذلك فإن تحليل تصميم harness في Codex هو، إلى حد بعيد، تحليل للممارسات الهندسية الكامنة وراء ذلك المقال.
+
+يمكن تلخيص فلسفة Codex في جملة واحدة: **المستودع هو مصدر الحقيقة (repository as the system of record)، وAGENTS.md مجرد صفحة فهرس، وتكمن قيمة الهندسة في تصميم البيئة، والتعبير عن المقصد، وبناء حلقات التغذية الراجعة.**
+
+## التعريف في جملة واحدة
+
+استخدم فريق OpenAI‏ Codex لتسليم منتج بلغ في النهاية أكثر من مليون سطر من الشيفرة خلال بضعة أسابيع، و**كتب Codex كل سطر منها** (راجع قسم «Designing for growth» في [Harness Engineering](https://openai.com/index/harness-engineering/)). وتجيب تجربتهم عن سؤال: كيف ينبغي تنظيم النظام عندما يتحول دور المهندس من «كتابة الشيفرة» إلى «تصميم harness»؟ أما Codex CLI نفسه فهو ملف تنفيذي أحادي مفتوح المصدر (منفذ بلغة Rust، في [github.com/openai/codex](https://github.com/openai/codex))، لكن إسهامه في harness يتمحور أساسًا حول **الأعراف (convention)** و**هندسة السياق**، لا حول نقاط توسعة براقة.
+
+## النظام الفرعي للتعليمات: AGENTS.md صفحة فهرس لا موسوعة
+
+هذه أكثر أفكار Codex تأثيرًا في نظرية harness:
+
+> لا يسهل فحص ملف تعليمات عملاق واحد آليًا (من حيث التغطية، وحالة التحديث، والملكية، والروابط المتقاطعة)، ولا يمكن تجنب ابتعاده عن الواقع. لذلك لم نعد نتعامل مع AGENTS.md بوصفه موسوعة، بل بوصفه **صفحة فهرس**. وتوجد معرفة قاعدة الشيفرة في وثائق منظمة، بينما يشير AGENTS.md إليها.
+
+(ما سبق نقل مباشر بالمعنى لقسم «AGENTS.md should be a directory page» في النص الأصلي لمقال [Harness Engineering](https://openai.com/index/harness-engineering/).)
+
+تقول المحاضرة الرابعة إن «ملف التعليمات العملاق الواحد يفشل»، ويقدم Codex الحل الصحيح مباشرة: أبقِ AGENTS.md في حدود 100 سطر تقريبًا (يوصي النص الأصلي بنحو 100 سطر، وانقله إلى `docs/` عند الاقتراب من الحد)، وقسّم ما لا يتسع له إلى دليل `docs/` ليقرأه الـ agent عند الطلب. وهذا هو المصدر الموثوق لعبارة «قدّم خريطة، لا دليل تعليمات».
+
+ويسمى المبدأ المصاحب **فرض الثوابت بدل الإدارة الدقيقة للتنفيذ** (في النص الأصلي: "don't micromanage the implementation；focus on invariants"): لا يُكتب في AGENTS.md سوى القيود الصلبة التي لا يجوز انتهاكها وأوامر التحقق، ويُترك للنموذج تقرير كيفية التنفيذ. وهذا يقابل مباشرة «القيود لا الإدارة الدقيقة» في المحاضرة الثانية.
+
+## النظام الفرعي للسياق: Write-Select-Compress-Isolate
+
+يمكن تلخيص هندسة السياق في Codex بأربع استراتيجيات. وقد صاغ المجتمع هذا الإطار بعد أن أصبحت «هندسة السياق» مجالًا مستقلًا، ثم واءمه مع Codex (راجع مصدر الإطار [Context Engineering for Codex CLI](https://codex.danielvaughan.com/2026/06/10/context-engineering-codex-cli-write-select-compress-isolate-june-2026/)):
+
+- **Write (الكتابة إلى الخارج)**: حفظ السياق خارج النافذة—تُكتب الاستنتاجات في الوثائق، والحالة في الملفات، بدل إبقائها في المحادثة. ويقابل ذلك «المستودع هو مصدر الحقيقة».
+- **Select (الانتقاء إلى الداخل)**: إدخال الـ token المطلوبة فقط إلى النافذة—يشير AGENTS.md إلى الطريق، وتُقرأ الملفات عند الطلب، بدل حشر المستودع كله فيها.
+- **Compress (compaction)**: الاحتفاظ بما يهم فعلًا—يتضمن Codex compaction تلقائيًا وأمر `/compact` يدويًا، ويمكن تخصيص `compact_prompt` (راجع [Context Engineering for Codex CLI](https://codex.danielvaughan.com/2026/06/10/context-engineering-codex-cli-write-select-compress-isolate-june-2026/)).
+- **Isolate (العزل)**: تقسيم السياق إلى حدود مختلفة—استخدام subagent لعزل سياق كل مهمة، بحيث لا يرى subagent الواجهة الأمامية مخطط قاعدة بيانات الواجهة الخلفية مطلقًا.
+
+ولدى Codex تفصيلة دقيقة في تصميم سياق البيئة: يوضح تحليل المجتمع للشيفرة المصدرية في [codex-harness-internals](https://github.com/AlexKenbo/codex-harness-internals) أن `build_environment_update_item` لا يخرج إلا **الحقول المتغيرة** (CWD، وفرع git، ونظام الملفات) عند تغير البيئة، بدل لصق سياق النظام كاملًا في كل جولة. وهذه تفصيلة هندسية تحقق مبدأ «عدم الاحتفاظ بـ token م
```

---

### Incident Patch 10: `a3042405` (2026-08-06)
**Commit Message**: Merge pull request #61 from alecchen/fix/project-01-docs

docs(project-01): fix harness docs and align en/zh-TW pages

**File**: `docs/en/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +69/-20)
```diff
@@ -9,37 +9,86 @@
 
 Build a minimal Electron knowledge-base app shell — a window with a document list on the left, a Q&A panel on the right, and a local data directory. The task itself is not complex. What's complex is how you get the agent to complete it.
 
-You run it twice. First time: just a prompt, no preparation. Second time: `AGENTS.md`, `init.sh`, `feature_list.json` pre-placed in the repo. Then compare.
+You run it twice. First time: just a prompt, no preparation. Second time: the minimal harness (e.g. `AGENTS.md`, `init.sh`, `feature_list.json`) pre-placed in the repo. Then compare.
 
 This course scenario uses a short rediscovery/preparation interval as an example, not a fixed measured result.
 
+## Use the Checked-In Project
+
+Repository path: [`projects/project-01/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01)
+
+| Directory | What it contains | How to use it |
+|------|------|------|
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | The weak-harness run. It has only [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) as the task description and no `AGENTS.md` or `feature_list.json`. Note: `starter/` also contains a reference implementation of the app — remove the app source (`src/`, `package.json`, configs, `scripts/`) before the run so the agent builds it from scratch. The `data/` sample documents are your call: keep them in both runs or remove them from both, so the two runs stay symmetric. | Give the prompt to your coding agent and measure what it completes without extra structure. |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | The same product slice with explicit harness artifacts: [`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md), [`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md), [`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh), [`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json), [`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md), and [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs) ([`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md), [`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)). | Compare how the same task is made concrete through rules and verification evidence. Before the strong run, reset the checked-in evidence: set every `feature_list.json` status to `not-started` and clear its `evidence`/`testedAt` values (keep the fields), and clear the session log in `claude-progress.md` (keep the title), or the agent will see all four features already passing and have nothing to build. |
+
+The four concrete features are window launch, document list, question panel, and local data directory creation. Inspect `solution/feature_list.json` for the expected evidence for each feature.
+
 ## Tools
 
 - Claude Code or Codex (pick one, use it for both runs)
-- Git (manage branches and compare)
+- Two isolated working directories (one per run; never both present while a run is active)
 - Node.js + Electron (project stack)
 - A timer (record each run's duration)
 
 ## Harness Mechanism
 
-Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json`
+Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
-#
```

**File**: `docs/zh-TW/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +24/-17)
```diff
@@ -7,7 +7,7 @@
 
 用 Electron 搭一個最簡的知識庫應用殼子——能啟動視窗、左側顯示文件清單、右側顯示問答面板、本地有一個資料目錄。任務本身不複雜，複雜的是你如何讓代理完成它。
 
-你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好 `AGENTS.md`、`init.sh`、`feature_list.json`，用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
+你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好最小 harness（例如 `AGENTS.md`、`init.sh`、`feature_list.json`），用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
 
 課程場景使用一小段準備或重新探索時間作為示例，不依賴固定測量值。
 
@@ -17,57 +17,60 @@
 
 | 目錄 | 內容 | 怎麼用 / 比較什麼 |
 |------|------|------|
-| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
-| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。 |
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。注意：`starter/` 同時含有應用程式的參考實作——執行前請刪除應用程式原始碼（`src/`、`package.json`、設定檔、`scripts/`），讓代理從零開始建置。`data/` 的範例文件由你決定：兩輪都保留，或兩輪都刪除，讓兩次執行保持對稱。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)、以及 [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs)（[`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md)、[`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)）。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。執行強 harness 之前，先重置內建的證據：將 `feature_list.json` 每個功能狀態改為 `not-started` 並清空其 `evidence`、`testedAt` 值（保留欄位），且清除 `claude-progress.md` 中的執行記錄（保留標題）——否則代理會看到所有功能已完成而無事可做。 |
 
 四個具體功能是視窗啟動、文件清單、問答面板、本地資料目錄建立。每個功能的預期證據請看 `solution/feature_list.json`。
 
 ## 用什麼工具
 
 - Claude Code 或 Codex（選一個，兩次都用同一個）
-- Git（管理分支和對比）
+- 兩個互相隔離的執行目錄（每輪一個；執行期間不要讓兩份同時存在）
 - Node.js + Electron（專案技術堆疊）
 - 一個計時器（記錄每次執行時期間）
 
 ## Harness 機制
 
-最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json`
+最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
 ## 具體步驟
 
 ### 準備工作
 
-1. 從一個乾淨的 commit 出發，記錄 commit hash。
-2. 建立兩個分支：`p01-baseline` 和 `p01-improved`。
-3. 準備一段相同的任務提示詞，內容為
```

**File**: `projects/project-01/solution/CLAUDE.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # CLAUDE.md -- Quick Reference for Claude Code
 
+@AGENTS.md
+
 ## Project Overview
 
 This is an Electron + TypeScript + React knowledge base application. The codebase is structured into four layers: main process, preload, renderer, and services.
```

#### Recent Merged Pull Requests:
- **PR #80** (2026-09-30): docs: 用真实量化案例替换第 3–5 讲的无出处数字 (@sanbuphy)
- **PR #79** (2026-09-30): Fix file path in execution comment (@zhems)
- **PR #78** (2026-09-30): fix(audit-harness): close two false-PASS checks in Subsystem 1 (@trieuvo-web)
- **PR #76** (2026-09-30): Fix language switch losing the section anchor (@alecchen)
- **PR #75** (2026-09-30): docs: add sources or mark illustrative for Real-World examples (#73) (@PerryLink)
- **PR #74** (2026-09-30): Attribute VILA Lab versioned claims; polish zh-TW harness-designs (@alecchen)
- **PR #72** (2026-09-30): fix: zh-TW translation residue in Lecture 04 (@alecchen)
- **PR #71** (2026-09-30): fix: add missing harness-designs nav item for Spanish locale (@albermoon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
