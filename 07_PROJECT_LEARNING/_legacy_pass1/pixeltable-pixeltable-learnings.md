# Forensic Learning Record (Deep Inspection): pixeltable/pixeltable

> **Canonical Artifact**: `07_PROJECT_LEARNING/pixeltable-pixeltable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pixeltable/pixeltable](https://github.com/pixeltable/pixeltable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:07.465Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pixeltable/pixeltable`
- **Description**: The backend agents build with - Multimodal database, orchestration, and serving in one file
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1631 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dashboard/postcss.config.js`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

### Core Architecture Module: `dashboard/src/App.tsx`
```
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import { DirectoryTreePanel } from '@/components/DirectoryTree'
import { CatalogSwitcher } from '@/components/CatalogSwitcher'
import { TableDetailView } from '@/components/TableDetailView'
import { SearchPanel } from '@/components/SearchPanel'
import { PipelineInspector } from '@/components/PipelineInspector'
import { getDirectoryTree, getStatus } from '@/api/client'
import type { SystemStatus } from '@/api/client'
import type { TableNode, TreeNode } from '@/types'
import {
  cn,
  tableHref,
  dirHref,
  loadActiveCatalog,
  saveActiveCatalog,
  loadExtraCatalogs,
  saveExtraCatalogs,
  catalogRootFromPath,
} from '@/lib/utils'
import {
  Search,
  GitBranch,
  Table2,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  BookOpen,
  CircleDot,
  FolderOpen,
  AlertTriangle,
  MessageSquare,
  Sun,
  Moon,
  Eye,
  Camera,
  Copy,
} from 'lucide-react'

function DirectoryKindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'view':
      return <Eye className="h-3.5 w-3.5 text-purple-400 shrink-0" />
    case 'snapshot':
      return <Camera className="h-3.5 w-3.5 text-orange-400 shrink-0" />
    case 'replica':
      return <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    default:
      return <Table2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
  }
}

// ── Table View ──────────────────────────────────────────────────────────────

function TableView() {
  const { '*': tablePath } = useParams()

  if (!tablePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Table2 className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Select a table</p>
          <p className="text-xs text-muted-foreground mt-1">
            Browse from the sidebar to inspect schema and data
          </p>
        </div>
      </div>
    )
  }

  return <TableDetailView tablePath={tablePath} />
}

// ── Directory View ──────────────────────────────────────────────────────────

function collectTables(nodes: TreeNode[]): TableNode[] {
  const tables: TableNode[] = []
  for (const n of nodes) {
    if (n.kind === 'directory') tables.push(...collectTables(n.entries ?? []))
    else tables.push(n)
  }
  return tables
}

function DirectoryView() {
  const { '*': dirPath } = useParams()
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<TreeNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Resolve the directory by fetching its contents by path, so a directory in any catalog (local or
  // hosted) is listed the same way; the daemon re-roots each node's path to its catalog.
  useEffect(() => {
    if (!dirPath) return
    setNodes(null)
    setError(null)
    getDirectoryTree(dirPath)
      .then(setNodes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load directory'))
  }, [dirPath])

  if (!dirPath) return null

  if (error !== null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <FolderOpen className="h-8 w-8 opacity-20" />
        <p className="text-sm">Directory not found</p>
        <p className="text-[11px] text-muted-foreground/60 font-mono">{error}</p>
      </div>
    )
  }

  if (nodes === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-k-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const name = dirPath.split('/').pop() || dirPath
  const objects = collectTables(nodes)
  const totalErrors = objects.reduce((s, t) => s + t.error_count, 0)
  const tableCount = objects.filter(t => t.kind === 'table').length
  const viewCount = objects.filter(t => t.kind === 'view').length
  const snapshotCount = objects.filter(t => t.kind === 'snapshot').length
  const replicaCount = objects.filter(t => t.kind === 'replica').length
  const kindBreakdown = [
    tableCount > 0 && `${tableCount} table${tableCount === 1 ? '' : 's'}`,
    viewCount > 0 && `${viewCount} view${viewCount === 1 ? '' : 's'}`,
    snapshotCount > 0 && `${snapshotCount} snapshot${snapshotCount === 1 ? '' : 's'}`,
    replicaCount > 0 && `${replicaCount} replica${replicaCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col h-full p-6 animate-fade-in bg-card">
      <div className="flex items-center gap-3 mb-6">
        <FolderOpen className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        <span className="text-xs text-muted-foreground font-mono">{dirPath}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-border/40 bg-background/40 p-4">
          <div className="text-2xl font-semibold tabular-nums">{objects.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Objects</div>
          {kindBreakdown && (
            <div className="text-[11px] text-muted-foreground mt-1">{kindBreakdown}</div>
          )}
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-4">
          <div className={cn('text-2xl font-semibold tabular-nums', totalErrors > 0 && 'text-destructive')}>
            {totalErrors}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Errors</div>
        </div>
      </div>

      {objects.length > 0 && (
        <div className="rounded-lg border border-border/40 overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Errors</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Version</th>
              </tr>
            </thead>
            <tbody>
              {objects.map(t => (
                <tr key={t.path} className="border-b border-border/20 hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => navigate(tableHref(t.path))}>
                  <td className="py-2 px-3 font-mono text-xs font-medium">{t.name}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <DirectoryKindIcon kind={t.kind} />
                      <span className="capitalize">{t.kind}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs tabular-nums text-right">
                    {t.error_count > 0 ? (
                      <span className="text-destructive flex items-center justify-end gap-1">
                        <AlertTriangle className="h-3 w-3" />{t.error_count}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 text-xs tabular-nums text-right text-muted-foreground">
                    {t.version != null ? `v${t.version}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Welcome View ───────────────────────
```

### Core Architecture Module: `dashboard/src/api/client.ts`
```
import type {
  TreeNode,
  TableMetadata,
  TableData,
  SearchResults,
  PipelineResponse,
} from '@/types';

const API_BASE = '/api';

/** Daemon errors are `{ detail, error_code }` (see pixeltable_cli/server/http_server.py). */
const ERROR_LABELS: Record<string, string> = {
  MISSING_CREDENTIALS:
    'No Pixeltable API key. Set PIXELTABLE_API_KEY or add api_key under [pixeltable] in your Pixeltable config file.',
  INSUFFICIENT_PRIVILEGES: 'Not allowed to open this catalog.',
  INVALID_PATH: 'Invalid path.',
  PATH_NOT_FOUND: 'Not found.',
  DIRECTORY_NOT_FOUND: 'Not found.',
  TABLE_NOT_FOUND: 'Not found.',
};

function apiErrorMessage(body: { detail?: unknown; error?: unknown; error_code?: unknown }, status: number): string {
  const code = typeof body.error_code === 'string' ? body.error_code : '';
  const detail = typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : '';
  const label = ERROR_LABELS[code];
  if (label) return label;
  return detail || `HTTP ${status}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(apiErrorMessage(error, response.status));
  }
  return response.json();
}

// GET /api/dirs returns an LsResponse object (see LsResponse in pixeltable_cli/models.py), not a
// bare array. With tree=true the recursive DirectoryNode/TableNode list the UI renders lives under
// tree.entries; the flat entries field is empty in that mode.
interface LsResponse {
  entries: unknown[];
  tree: { path: string; entries: TreeNode[] } | null;
}

// List a directory's contents as a tree. Omit path (or pass 'local') for the in-process catalog root;
// pass a hosted catalog uri (e.g. 'pxt://org:db'), or any directory path in either catalog, to list that
// directory. The daemon reports each node's path relative to the queried directory, re-rooted so a hosted
// path carries its pxt:// prefix.
export async function getDirectoryTree(path?: string): Promise<TreeNode[]> {
  const params = new URLSearchParams({ tree: 'true' });
  if (path !== undefined && path !== '' && path !== 'local') params.set('path', path);
  const res = await fetchJson<LsResponse>(`${API_BASE}/dirs?${params}`);
  return res.tree?.entries ?? [];
}

export async function getTableMetadata(path: string): Promise<TableMetadata> {
  return fetchJson<TableMetadata>(`${API_BASE}/dashboard/tables/meta?path=${encodeURIComponent(path)}`);
}

export async function getTableData(
  path: string,
  options: {
    offset?: number;
    limit?: number;
    orderBy?: string;
    orderDesc?: boolean;
    errorsOnly?: boolean;
  } = {}
): Promise<TableData> {
  const params = new URLSearchParams({ path });
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.orderBy) params.set('order_by', options.orderBy);
  if (options.orderDesc) params.set('order_desc', 'true');
  if (options.errorsOnly) params.set('errors_only', 'true');

  return fetchJson<TableData>(`${API_BASE}/dashboard/tables/data?${params.toString()}`);
}

// Search the local catalog plus any additional (hosted) catalogs; the daemon always includes the local
// catalog and returns full, resolvable paths.
export async function search(query: string, additionalCatalogs?: string[]): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query });
  for (const c of additionalCatalogs ?? []) params.append('catalogs', c);
  return fetchJson<SearchResults>(`${API_BASE}/dashboard/search?${params}`);
}

export async function getPipeline(tablePath?: string): Promise<PipelineResponse> {
  if (tablePath === undefined || tablePath === '' || tablePath === 'local') {
    return fetchJson<PipelineResponse>(`${API_BASE}/dashboard/pipeline`);
  }
  // Catalog root only (pxt://org:db) → full DAG; a table path → connected component.
  const url = /^pxt:\/\/[^/]+$/.test(tablePath)
    ? `${API_BASE}/dashboard/pipeline?path=${encodeURIComponent(tablePath)}`
    : `${API_BASE}/dashboard/tables/pipeline?path=${encodeURIComponent(tablePath)}`;
  return fetchJson<PipelineResponse>(url);
}

interface SystemConfig {
  home: string;
  db_url: string;
  media_dir: string;
  file_cache_dir: string;
}

export interface SystemStatus {
  version: string;
  total_tables: number;
  total_errors: number;
  config?: SystemConfig;
}

// Flat shape returned by GET /api/status (see StatusResponse in pixeltable_cli/models.py). The UI
// consumes the nested {version, config} shape below, so map the response rather than asserting it.
interface StatusResponse {
  pxt_version: string;
  home: string | null;
  db_url: string | null;
  media_dir: string | null;
  file_cache_dir: string | null;
  total_tables: number;
  total_errors: number;
}

export async function getStatus(): Promise<SystemStatus> {
  const s = await fetchJson<StatusResponse>(`${API_BASE}/status`);
  return {
    version: s.pxt_version,
    total_tables: s.total_tables,
    total_errors: s.total_errors,
    config: {
      home: s.home ?? '',
      db_url: s.db_url ?? '',
      media_dir: s.media_dir ?? '',
      file_cache_dir: s.file_cache_dir ?? '',
    },
  };
}

```

### Core Architecture Module: `dashboard/src/components/CatalogSwitcher.tsx`
```
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  cn,
  LOCAL_CATALOG,
  catalogLabel,
  loadExtraCatalogs,
  normalizeCloudCatalogUri,
  saveExtraCatalogs,
} from '@/lib/utils'
import { getDirectoryTree } from '@/api/client'
import {
  Check,
  ChevronDown,
  Cloud,
  HardDrive,
  Loader2,
  Plus,
  X,
} from 'lucide-react'

const URI_HINT = 'Use a hosted URI like pxt://org:db'

interface CatalogSwitcherProps {
  activeCatalog: string
  onSelect: (uri: string) => void
  collapsed?: boolean
  /** When collapsed, trigger expands the sidebar instead of opening a cramped menu. */
  onExpandRequest?: () => void
}

export function CatalogSwitcher({
  activeCatalog,
  onSelect,
  collapsed = false,
  onExpandRequest,
}: CatalogSwitcherProps) {
  const [catalogs, setCatalogs] = useState<string[]>(loadExtraCatalogs)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addingBusy, setAddingBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveExtraCatalogs(catalogs)
  }, [catalogs])

  // Keep the switcher list in sync when the parent activates a hosted catalog (e.g. from search).
  useEffect(() => {
    if (activeCatalog === LOCAL_CATALOG || catalogs.includes(activeCatalog)) return
    setCatalogs(prev => (prev.includes(activeCatalog) ? prev : [...prev, activeCatalog]))
  }, [activeCatalog, catalogs])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        cancelAdd()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const cancelAdd = () => {
    setAdding(false)
    setDraft('')
    setAddError(null)
    setAddingBusy(false)
  }

  useEffect(() => {
    if (!collapsed) return
    setOpen(false)
    setAdding(false)
    setDraft('')
    setAddError(null)
    setAddingBusy(false)
  }, [collapsed])

  const commitAdd = async () => {
    if (addingBusy) return
    const raw = draft.trim()
    if (raw === '') {
      cancelAdd()
      return
    }
    const uri = normalizeCloudCatalogUri(raw)
    if (uri === null) {
      setAddError(URI_HINT)
      return
    }
    setAddingBusy(true)
    setAddError(null)
    try {
      await getDirectoryTree(uri)
      if (!catalogs.includes(uri)) setCatalogs(prev => [...prev, uri])
      onSelect(uri)
      setOpen(false)
      cancelAdd()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Could not open catalog')
      setAddingBusy(false)
    }
  }

  const select = (uri: string) => {
    onSelect(uri)
    setOpen(false)
    cancelAdd()
  }

  const removeCatalog = (uri: string) => {
    setCatalogs(prev => prev.filter(c => c !== uri))
    if (activeCatalog === uri) onSelect(LOCAL_CATALOG)
  }

  const isCloud = activeCatalog !== LOCAL_CATALOG
  const Icon = isCloud ? Cloud : HardDrive
  const invalidDraft = addError !== null || (draft.trim() !== '' && normalizeCloudCatalogUri(draft) === null)

  return (
    <div ref={rootRef} className={cn('relative mb-1 shrink-0', collapsed && 'flex justify-center')}>
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            onExpandRequest?.()
            return
          }
          setOpen(o => !o)
        }}
        title={collapsed ? `Expand sidebar · ${catalogLabel(activeCatalog)}` : (activeCatalog === LOCAL_CATALOG ? 'Local catalog' : activeCatalog)}
        className={cn(
          'flex items-center rounded-lg transition-colors',
          collapsed
            ? 'justify-center px-2.5 py-[7px] text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            : cn(
                'w-full gap-2 border bg-background/40 px-2.5 py-[7px] text-[13px] font-medium text-foreground hover:bg-accent/50',
                open ? 'border-k-yellow/40 bg-accent/60 ring-1 ring-k-yellow/30' : 'border-border/40',
              ),
        )}
      >
        <Icon className={cn(
          'shrink-0',
          collapsed ? 'h-[15px] w-[15px]' : cn('h-3.5 w-3.5', isCloud ? 'text-sky-400' : 'text-k-yellow'),
        )} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{catalogLabel(activeCatalog)}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <Dropdown
          activeCatalog={activeCatalog}
          catalogs={catalogs}
          adding={adding}
          draft={draft}
          addError={addError}
          addingBusy={addingBusy}
          invalidDraft={invalidDraft}
          inputRef={inputRef}
          onSelect={select}
          onRemove={removeCatalog}
          onStartAdd={() => { setAdding(true); setAddError(null) }}
          onDraftChange={v => { setDraft(v); if (addError) setAddError(null) }}
          onCommitAdd={() => { void commitAdd() }}
          onCancelAdd={cancelAdd}
        />
      )}
    </div>
  )
}

function Dropdown({
  activeCatalog,
  catalogs,
  adding,
  draft,
  addError,
  addingBusy,
  invalidDraft,
  inputRef,
  onSelect,
  onRemove,
  onStartAdd,
  onDraftChange,
  onCommitAdd,
  onCancelAdd,
}: {
  activeCatalog: string
  catalogs: string[]
  adding: boolean
  draft: string
  addError: string | null
  addingBusy: boolean
  invalidDraft: boolean
  inputRef: RefObject<HTMLInputElement>
  onSelect: (uri: string) => void
  onRemove: (uri: string) => void
  onStartAdd: () => void
  onDraftChange: (v: string) => void
  onCommitAdd: () => void
  onCancelAdd: () => void
}) {
  return (
    <div className="absolute z-50 mt-1 left-0 right-0 rounded-lg border border-border/60 bg-card shadow-lg py-1">
      <CatalogRow
        label="Local"
        icon={<HardDrive className="h-3.5 w-3.5 text-k-yellow shrink-0" />}
        active={activeCatalog === LOCAL_CATALOG}
        onSelect={() => onSelect(LOCAL_CATALOG)}
      />
      {catalogs.map(uri => (
        <CatalogRow
          key={uri}
          label={catalogLabel(uri)}
          title={uri}
          icon={<Cloud className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
          active={activeCatalog === uri}
          removable
          onSelect={() => onSelect(uri)}
          onRemove={() => onRemove(uri)}
        />
      ))}
      <div className="my-1 mx-2 h-px bg-border/40" />
      {adding ? (
        <div className="px-2 py-1.5 space-y-1">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              disabled={addingBusy}
              onChange={e => onDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onCommitAdd()
                if (e.key === 'Escape') onCancelAdd()
              }}
              placeholder="pxt://org:db"
              aria-invalid={invalidDraft}
              className={cn(
                'h-7 flex-1 rounded border bg-background/50 px-1.5 text-[11px] text-foreground',
                'placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 disabled:opacity-60',
                invalidDraft
                  ? 'border-destructive/50 focus:ring-destructive/30'
                  : 'border-border/40 focus:ring-ring/30',
              )}
            />
            <button
              type="button"
              disabled={addingBusy}
              onMouseDown={e => { e.preventDefault(); onCommitAdd() }}
              title="Add cloud catalog"
              className={cn(
                'shrink-0 p-1 
```

### Core Architecture Module: `dashboard/src/components/ColumnFlowDiagram.tsx`
```
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Zap,
  GitBranch,
  ChevronRight,
  Copy,
  Check,
  X,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineColumn } from '@/types'
import { getColumnTypeMeta } from '@/lib/column-types'
import { FUNC_STYLES } from '@/lib/func-styles'
import {
  type ColumnNodeData,
  buildLineageGraph,
  applyDagreLayout,
  applyEdgeHighlights,
} from '@/lib/column-lineage'

function formatType(type: string): string {
  if (type.startsWith('Required[') && type.endsWith(']')) {
    type = type.slice('Required['.length, -1)
  }
  return type.split('[')[0]
}

// ── Custom Edge ──────────────────────────────────────────────────────────────

function ColumnEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  const highlight = (data as Record<string, unknown> | undefined)?.highlight as string | undefined

  const isDimmed = highlight === 'dimmed'

  const style = useMemo(() => {
    if (highlight === 'active') return { stroke: 'hsl(42 98% 48% / 0.7)', strokeWidth: 2.5, strokeDasharray: '6 4' }
    if (isDimmed) return { stroke: 'rgba(100, 100, 100, 0.12)', strokeWidth: 1 }
    return { stroke: 'rgba(100, 100, 100, 0.35)', strokeWidth: 1.5, strokeDasharray: '6 4' }
  }, [highlight, isDimmed])

  return <BaseEdge id={id} path={edgePath} style={style} className={isDimmed ? undefined : 'react-flow__edge-path-animated'} />
}

const edgeTypes = { columnEdge: ColumnEdge }

// ── Custom Node ──────────────────────────────────────────────────────────────

function ColumnNodeComponent({ data, selected }: { data: ColumnNodeData; selected?: boolean }) {
  const { icon: Icon } = getColumnTypeMeta(data.type)
  const funcStyle = data.funcType ? FUNC_STYLES[data.funcType] : null
  const inherited = !data.definedInSelf

  return (
    <div className={cn(
      'min-w-[200px] max-w-[240px] transition-all duration-150',
      selected && 'scale-[1.02]',
    )}>
      {data.upstreamColumns.length > 0 && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn(
            '!w-2 !h-2 !border-2 !border-background transition-colors',
            data.isComputed ? '!bg-k-yellow' : '!bg-muted-foreground/50',
          )}
        />
      )}

      {data.downstreamColumns.length > 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-muted-foreground/50 !border-2 !border-background"
        />
      )}

      <div className={cn(
        'border rounded-lg shadow-sm overflow-hidden transition-all duration-150',
        inherited
          ? 'border-dashed border-border/50 bg-card/60 opacity-80'
          : cn(
              'bg-card',
              data.isComputed ? 'border-k-yellow/30' : 'border-border/60',
            ),
        selected && 'ring-1 ring-k-yellow/50 shadow-md border-k-yellow/50 opacity-100',
      )}>
        {/* Origin tag for inherited columns */}
        {inherited && data.definedIn && (
          <div className="px-3 py-1 bg-muted/20 border-b border-border/20">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-medium">
              from {data.definedIn}
            </span>
          </div>
        )}

        {/* Header */}
        <div className={cn(
          'px-3 py-2 flex items-center gap-2',
          !inherited && data.isComputed ? 'bg-k-yellow/5' : '',
        )}>
          <div className={cn(
            'w-5 h-5 rounded flex items-center justify-center shrink-0',
            !inherited && data.isComputed ? 'bg-k-yellow/15' : 'bg-muted/40',
          )}>
            <Icon className={cn(
              'h-3 w-3',
              !inherited && data.isComputed ? 'text-foreground' : 'text-muted-foreground',
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <span className={cn(
              'text-[11px] font-semibold truncate block leading-tight',
              inherited ? 'text-foreground' : 'text-foreground',
            )}>
              {data.name}
            </span>
            <span className={cn(
              'text-[9px] font-mono leading-tight',
              !inherited && data.isComputed ? 'text-foreground' : 'text-muted-foreground',
            )}>
              {formatType(data.type)}
            </span>
          </div>
          {data.isComputed && (
            <Zap className={cn('h-2.5 w-2.5 shrink-0', inherited ? 'text-muted-foreground' : 'text-k-yellow')} />
          )}
        </div>

        {/* Function badge */}
        {data.isComputed && (data.funcName || funcStyle) && (
          <div className="px-3 py-1 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              {funcStyle && (
                <span className={cn(
                  'text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded',
                  funcStyle.bg, funcStyle.text,
                )}>
                  {funcStyle.label}
                </span>
              )}
              {data.funcName && (
                <code className="text-[9px] font-mono text-muted-foreground truncate">
                  {data.funcName.length > 24 ? `${data.funcName.slice(0, 22)}…` : data.funcName}()
                </code>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { columnNode: ColumnNodeComponent }

// ── Detail Sidebar ───────────────────────────────────────────────────────────

function ColumnDetailPanel({
  node,
  onClose,
  onNavigate,
}: {
  node: ColumnNodeData
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const { icon: Icon } = getColumnTypeMeta(node.type)
  const funcStyle = node.funcType ? FUNC_STYLES[node.funcType] : null

  const handleCopy = useCallback(async () => {
    if (!node.computeExpression) return
    try {
      await navigator.clipboard.writeText(node.computeExpression)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [node.computeExpression])

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-[280px] bg-card border-l border-border overflow-y-auto shadow-xl z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-sm px-4 py-3 border-b border-border z-[51]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              'w-6 h-6 rounded flex items-center justify-center shrink-0',
              node.isComputed ? 'bg-k-yellow/15' : 'bg-muted/40',
            )}>
              <Icon className={cn(
                'h-3.5 w-3.5',
                node.isComputed ? 'text-foreground' : 'text-muted-foreground',
              )} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold truncate">{node.name}</h3>
              <div className="text-[10px] font-mono text-muted-foreground">{node.type}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent transition-colors -mr-1 -mt-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
     
```

### Core Architecture Module: `dashboard/src/components/DirectoryTree.tsx`
```
import { useState, useMemo, useEffect } from 'react'
import type { TreeNode } from '@/types'
import { cn } from '@/lib/utils'
import {
  Folder,
  FolderOpen,
  Table2,
  Eye,
  Camera,
  Copy,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ChevronsDownUp,
  AlertTriangle,
} from 'lucide-react'

interface DirectoryTreeProps {
  nodes: TreeNode[]
  selectedPath: string | null
  onSelect: (path: string, type: string) => void
}

function getNodeIcon(type: string, isOpen: boolean = false) {
  switch (type) {
    case 'directory':
      return isOpen
        ? <FolderOpen className="h-3.5 w-3.5 text-k-yellow shrink-0" />
        : <Folder className="h-3.5 w-3.5 text-k-yellow shrink-0" />
    case 'table':
      return <Table2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
    case 'view':
      return <Eye className="h-3.5 w-3.5 text-purple-400 shrink-0" />
    case 'snapshot':
      return <Camera className="h-3.5 w-3.5 text-orange-400 shrink-0" />
    case 'replica':
      return <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    default:
      return <Table2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  }
}

function countDescendants(node: TreeNode): number {
  if (node.kind !== 'directory') return 0
  const entries = node.entries ?? []
  if (entries.length === 0) return 0
  return entries.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}

function countAllNodes(nodes: TreeNode[]): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + (n.kind === 'directory' ? countAllNodes(n.entries ?? []) : 0),
    0,
  )
}

function nodeMatchesFilter(node: TreeNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true
  if (node.kind === 'directory') return (node.entries ?? []).some(c => nodeMatchesFilter(c, q))
  return false
}

function TreeItem({ node, level, selectedPath, onSelect, filter, collapsedAll }: {
  node: TreeNode; level: number; selectedPath: string | null
  onSelect: (path: string, type: string) => void; filter: string; collapsedAll: number
}) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const isDirectory = node.kind === 'directory'
  const entries = isDirectory ? (node.entries ?? []) : []
  const hasChildren = isDirectory && entries.length > 0
  const descendantCount = useMemo(() => countDescendants(node), [node])
  const hasErrors = !isDirectory && node.error_count > 0

  useEffect(() => {
    if (collapsedAll > 0) setManualOpen(false)
  }, [collapsedAll])

  const isOpen = filter
    ? true
    : manualOpen !== null
      ? manualOpen
      : level === 0

  const isSelected = selectedPath === node.path
  if (filter && !nodeMatchesFilter(node, filter)) return null

  const handleClick = () => {
    if (isDirectory && hasChildren) setManualOpen(!isOpen)
    onSelect(node.path, node.kind)
  }

  return (
    <div>
      <button
        className={cn(
          'group flex items-center gap-1.5 w-full rounded-md py-1 px-2 text-left transition-colors',
          isSelected
            ? 'bg-primary/10 text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        title={`${node.kind}: ${node.path}`}
      >
        {isDirectory && hasChildren ? (
          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
            {isOpen
              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </span>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}

        {getNodeIcon(node.kind, isOpen)}
        <span className="flex-1 text-[13px] truncate">{node.name}</span>

        {hasErrors && !isDirectory && (
          <span className="flex items-center gap-0.5 text-[10px] text-destructive shrink-0" title={`${node.error_count} errors`}>
            <AlertTriangle className="h-2.5 w-2.5" />
          </span>
        )}

        {isDirectory && descendantCount > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {descendantCount}
          </span>
        )}

        {!isDirectory && node.version !== null && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            v{node.version}
          </span>
        )}
      </button>

      {isDirectory && hasChildren && isOpen && (
        <div>
          {entries.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              filter={filter}
              collapsedAll={collapsedAll}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Sticky Filter + Collapse-all under the catalog switcher; tree scrolls below. */
export function DirectoryTreePanel({ nodes, selectedPath, onSelect }: DirectoryTreeProps) {
  const [filter, setFilter] = useState('')
  const [collapsedAll, setCollapsedAll] = useState(0)
  const totalCount = useMemo(() => countAllNodes(nodes), [nodes])
  const showFilter = totalCount >= 10
  const q = filter.toLowerCase()

  if (nodes.length === 0) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="text-center py-8 text-muted-foreground">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50 text-k-yellow" />
            <p className="text-xs">No directories or tables found</p>
            <p className="text-[11px] mt-1 text-muted-foreground">
              Create tables using the Python SDK
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {showFilter && (
        <div className="flex shrink-0 items-center gap-1 px-0.5 pb-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="h-7 w-full rounded-md border border-border/40 bg-background/40 pl-7 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsedAll(c => c + 1)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/40 hover:bg-background/40 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            title="Collapse all"
            aria-label="Collapse all"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-px overflow-y-auto">
        {nodes.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            filter={q}
            collapsedAll={collapsedAll}
          />
        ))}
      </div>
    </div>
  )
}

/** @deprecated Prefer DirectoryTre
```

### Core Architecture Module: `dashboard/src/components/SearchPanel.tsx`
```
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { search } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { cn, loadExtraCatalogs } from '@/lib/utils'
import type { SearchResults } from '@/types'
import {
  Search,
  Folder,
  Table2,
  Eye,
  Camera,
  Copy,
  Hash,
  X,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Zap,
  Loader2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (path: string, type: string) => void
}

type ResultType = 'directory' | 'table' | 'column'

interface SearchResultItem {
  type: ResultType
  name: string
  path: string
  subtype?: string
  extra?: string
}

// ── Icon + color mapping ─────────────────────────────────────────────────────

const RESULT_META: Record<string, {
  icon: typeof Table2
  color: string
  bg: string
}> = {
  directory:  { icon: Folder,  color: 'text-k-yellow',         bg: 'bg-k-yellow/10' },
  table:      { icon: Table2,  color: 'text-blue-400',         bg: 'bg-blue-400/10' },
  view:       { icon: Eye,     color: 'text-purple-400',       bg: 'bg-purple-400/10' },
  snapshot:   { icon: Camera,  color: 'text-orange-400',       bg: 'bg-orange-400/10' },
  replica:    { icon: Copy,    color: 'text-muted-foreground', bg: 'bg-muted' },
  column:     { icon: Hash,    color: 'text-emerald-400',      bg: 'bg-emerald-400/10' },
  computed:   { icon: Zap,     color: 'text-k-yellow',         bg: 'bg-k-yellow/10' },
}

function getResultMeta(item: SearchResultItem) {
  if (item.type === 'column') return RESULT_META.column
  if (item.type === 'directory') return RESULT_META.directory
  return RESULT_META[item.subtype ?? 'table'] ?? RESULT_META.table
}

// ── Result item ──────────────────────────────────────────────────────────────

function ResultItem({
  item,
  isSelected,
  onClick,
  onHover,
}: {
  item: SearchResultItem
  isSelected: boolean
  onClick: () => void
  onHover: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const meta = getResultMeta(item)
  const Icon = meta.icon

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [isSelected])

  return (
    <button
      ref={ref}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-100',
        isSelected
          ? 'bg-accent/80 ring-1 ring-border/60'
          : 'hover:bg-accent/40',
      )}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      {/* Icon badge */}
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
        meta.bg,
      )}>
        <Icon className={cn('h-3.5 w-3.5', meta.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[13px] font-medium truncate',
            isSelected ? 'text-foreground' : 'text-foreground',
          )}>
            {item.name}
          </span>
          {item.subtype && item.type === 'table' && item.subtype !== 'table' && (
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded',
              meta.bg,
              meta.color,
            )}>
              {item.subtype}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
          {item.type === 'column' ? (
            <>
              <span className="text-muted-foreground">in</span>{' '}
              <span className="text-foreground">{item.path}</span>
              {item.extra && (
                <span className="text-muted-foreground ml-1.5">· {item.extra}</span>
              )}
            </>
          ) : (
            item.path
          )}
        </div>
      </div>

      {/* Type label */}
      <span className={cn(
        'text-[11px] font-medium capitalize shrink-0 transition-opacity',
        isSelected ? 'text-muted-foreground' : 'text-muted-foreground',
      )}>
        {item.type}
      </span>
    </button>
  )
}

// ── Section header ───────────────────────────────────────────────────────────

// A catalog and a table fail differently, so they read differently; both mean results are missing.
function unavailableSummary(unavailable: SearchResults['unavailable']): string {
  const catalogs = unavailable.filter(u => u.kind === 'catalog').map(u => u.path)
  const tables = unavailable.filter(u => u.kind === 'table')
  const parts: string[] = []
  if (catalogs.length > 0) {
    parts.push(
      catalogs.length === 1
        ? `1 catalog skipped (${catalogs[0]})`
        : `${catalogs.length} catalogs skipped`,
    )
  }
  if (tables.length > 0) {
    parts.push(
      `${tables.length} table${tables.length === 1 ? '' : 's'} skipped (couldn’t load metadata)`,
    )
  }
  return parts.join(' · ')
}

/** Short UI label; full exception stays in title / expand detail. */
function shortUnavailableReason(error: string): string {
  const e = error.toLowerCase()
  if (e.includes('embedding') && (e.includes('requesterror') || e.includes('not a valid'))) {
    return 'Invalid embedding function'
  }
  if (e.includes('sentencetransformer') || e.includes('get_embedding_dimension') || e.includes('embedding')) {
    return 'Embedding / model error'
  }
  if (e.includes('modulenotfound') || e.includes('no module named')) {
    return 'Missing dependency'
  }
  const typeMatch = error.match(/^([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception|Warning)?)\b/)
  if (typeMatch) return typeMatch[1]
  const first = error.split(/[:\n]/)[0]?.trim()
  return first && first.length <= 48 ? first : 'Could not load metadata'
}

function UnavailableBanner({
  unavailable,
  expanded,
  onToggle,
}: {
  unavailable: SearchResults['unavailable']
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="my-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 min-w-0">{unavailableSummary(unavailable)}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {expanded ? 'Hide details' : 'Show details'}
        </span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5 pl-5.5 max-h-40 overflow-y-auto">
          {unavailable.map(u => (
            <li key={`${u.kind}:${u.path}`} className="text-xs text-muted-foreground/80 min-w-0" title={u.error}>
              <span className="font-mono text-foreground/80 break-all">{u.path}</span>
              <span className="text-muted-foreground"> — {shortUnavailableReason(u.error)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {count}
      </span>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function SearchPanel({ isOpen, onClose, onSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults]
```

### Core Architecture Module: `dashboard/src/components/TableDetailView.tsx`
```
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelGroupHandle,
} from 'react-resizable-panels'
import { getTableMetadata, getTableData, getPipeline } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import type {
  PipelineColumn, CellError, DataRow,
  TableMetadata, TableData, DataColumn, ColumnInfo, IndexInfo,
  PipelineNode as PipelineNodeType, PipelineEdge, PipelineVersion,
} from '@/types'
import { cn, tableHref } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown,
  ImageIcon, Film, Music, FileText,
  Rows3, Table2, Filter, X, Search,
  RefreshCw, Key, Download, SquareFunction,
  Copy, Eye, Camera,
  GitBranch, ArrowRight, ExternalLink,
  AlertTriangle, Clock,
} from 'lucide-react'
import { ColumnFlowDiagram } from './ColumnFlowDiagram'
import { ColumnTypeBadge, formatColumnTypeDisplay, getColumnTypeMeta } from '@/lib/column-types'
import { formatPythonExpr, PythonExpr } from '@/lib/python-highlight'

function KindIcon({ kind, className = 'h-4 w-4' }: { kind: string; className?: string }) {
  switch (kind) {
    case 'view':
      return <Eye className={`${className} text-purple-400 shrink-0`} />
    case 'snapshot':
      return <Camera className={`${className} text-orange-400 shrink-0`} />
    case 'replica':
      return <Copy className={`${className} text-muted-foreground shrink-0`} />
    default:
      return <Table2 className={`${className} text-blue-400 shrink-0`} />
  }
}

function kindWord(kind: string): string {
  switch (kind) {
    case 'view':
      return 'View'
    case 'snapshot':
      return 'Snapshot'
    case 'replica':
      return 'Replica'
    default:
      return 'Table'
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'gallery'
type MediaType = 'image' | 'video' | 'audio' | 'document'
type FilterValue = string | number | boolean | null
type ColumnFilter =
  | { type: 'contains'; value: string }
  | { type: 'values'; selected: FilterValue[] }
  | { type: 'range'; min: string; max: string }
  | { type: 'dateRange'; from: string; to: string }
type Filters = Record<string, ColumnFilter>

const getMediaType = (colType: string): MediaType => {
  const t = (colType || '').toLowerCase()
  if (t.includes('image')) return 'image'
  if (t.includes('video')) return 'video'
  if (t.includes('audio')) return 'audio'
  return 'document'
}

// ── Media Thumbnail (inline cell) ─────────────────────────────────────────

function MediaPreview({ url, type, onExpand }: { url: string; type: MediaType; onExpand?: () => void }) {
  const [error, setError] = useState(false)

  if (error || !url) {
    const Icon = { image: ImageIcon, video: Film, audio: Music, document: FileText }[type]
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate max-w-24">{url?.split('/').pop() || 'N/A'}</span>
      </div>
    )
  }

  if (type === 'image') return (
    <img src={url} alt="" className="max-h-16 max-w-32 rounded cursor-pointer hover:ring-2 ring-k-yellow object-cover" onError={() => setError(true)} onClick={onExpand} />
  )

  if (type === 'video') return (
    <div className="relative group cursor-pointer" onClick={onExpand}>
      <video src={url} className="max-h-16 max-w-32 rounded object-cover hover:ring-2 ring-k-yellow" muted preload="metadata" onError={() => setError(true)} />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-7 h-7 bg-k-yellow/90 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    </div>
  )

  if (type === 'audio') return <audio controls className="h-8 w-32"><source src={url} /></audio>

  const isExternal = /^https?:\/\//i.test(url)
  if (isExternal) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-foreground hover:underline cursor-pointer">
        <ExternalLink className="h-3 w-3" />
        <span className="truncate max-w-24">{url.split('/').pop()}</span>
      </a>
    )
  }

  return (
    <button onClick={onExpand} className="flex items-center gap-1 text-[11px] text-foreground hover:underline cursor-pointer">
      <FileText className="h-3.5 w-3.5" />
      <span className="truncate max-w-24">{url.split('/').pop()}</span>
    </button>
  )
}

// ── Media Lightbox (table-level, with row navigation) ─────────────────────

function MediaLightbox({ url, type, index, total, onClose, onPrev, onNext }: {
  url: string; type: MediaType; index: number; total: number
  onClose: () => void; onPrev: () => void; onNext: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onPrev() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const isPdf = /\.pdf(\?|$)/i.test(url)

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={onClose}>
      {/* Close */}
      <button className="absolute top-4 right-4 text-white/70 hover:text-foreground transition-colors z-10" onClick={onClose}>
        <X className="h-7 w-7" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] text-white/50 tabular-nums z-10">
        {index + 1} / {total}
      </div>

      {/* Prev */}
      <button
        onClick={e => { e.stopPropagation(); onPrev() }}
        disabled={index === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 disabled:cursor-default transition-all z-10"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Next */}
      <button
        onClick={e => { e.stopPropagation(); onNext() }}
        disabled={index >= total - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 disabled:cursor-default transition-all z-10"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Content */}
      <div onClick={e => e.stopPropagation()}>
        {type === 'image' && <img src={url} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg" />}
        {type === 'video' && <video src={url} controls autoPlay className="max-h-[85vh] max-w-[90vw] rounded-lg" />}
        {type === 'document' && (/^https?:\/\//i.test(url) ? (
          <div className="flex flex-col items-center gap-4 bg-card rounded-lg p-10 border border-border/60">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">External documents cannot be previewed inline</p>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-foreground hover:underline">
              <ExternalLink className="h-4 w-4" />Open in new tab
            </a>
          </div>
        ) : (
          <iframe src={url} className="w-[85vw] h-[85vh] rounded-lg bg-white" title="Document preview" sandbox={isPdf ? undefined : 'allow-same-origin allow-scripts'} />
        ))}
      </div>
    </div>
  )
}

// ──
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1353** (2026-07-08): **Need to manually type cast JSON/Dict values to do downstream computations**
  *Symptoms*: From PyCon US 2026 @mkornacker asked me to post this issue.  When parsing existing JSON data, the resulting computing column remains a JSON column, even when the JSON value is an integer (in this example). This means that downstream arithmetic calculations will fail with a postgres error.  Reprex below:  ## Setup  ```python import pixeltable as pxt  pxt.create_dir('quickstart', if_exists='replace_force') t = pxt.create_table('quickstart/images', {'image': pxt.Image}, if_exists='replace_force')  t.insert([   {'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/release/docs/resources/images/000000000001.jpg'},   {'image': 'https://raw.githubusercontent.com/pixeltable/pixeltable/release/docs/resources/images/000000000025.jpg'} ])  t.add_computed_column(metadata=t.image.get_metadata())  ```  ## SQL Error  ```python # errors t.add_computed_column(width=t.metadata.width, if_exists='replace') t.add_computed_column(height=t.metadata.height, if_exists='replace') t.add_computed_column(area=(t.height * t.width), if_exists='replace') ```  error message  ``` Error: Unexpected SQL error during execution of computed column 'area': (psycopg.errors.UndefinedFunction) operator does not exist: jsonb * jsonb LINE 1: SELECT tbl_2833fb8a909b41eba4dadc04d33558ad.col_5 * tbl_2833...                                                           ^ HINT:  No operator matches the given name and argument types. You might need to add explicit type casts. [SQL: SELECT tbl_2833fb8a909b41eba4dadc04
  **Post-Mortem & Fix Analysis**:
  > @chendaniely We fixed this a little while ago (and forgot to update this issue...).  https://github.com/pixeltable/pixeltable/pull/1393

- **Issue #874** (2025-11-11): **Can't drop a FrameIterator View after having tried to create one with FPS > Video FPS.**
  *Symptoms*: Reproduction: ```python  import pixeltable as pxt  pxt.drop_dir('fps_bug', force=True) pxt.create_dir('fps_bug')  t = pxt.create_table(     'fps_bug.videos',     {         'video': pxt.Required[pxt.Video]     })  t.insert([     {         'video':'video.mp4'     }])  from pixeltable.iterators import FrameIterator  v = pxt.create_view(     'fps_bug.frames',     t,     iterator=FrameIterator.create(video=t.video, fps=30) # use fps > video fps ) ``` --> Encounter first error when creating the view, then use drop_director or try to replace the view: same error.  ```python `--------------------------------------------------------------------------- Error                                     Traceback (most recent call last) Cell In[32], [line 3](vscode-notebook-cell:?execution_count=32&line=3)       [1](vscode-notebook-cell:?execution_count=32&line=1) from pixeltable.iterators import FrameIterator ----> [3](vscode-notebook-cell:?execution_count=32&line=3) v = pxt.create_view(       [4](vscode-notebook-cell:?execution_count=32&line=4)     'fps_bug.frames',       [5](vscode-notebook-cell:?execution_count=32&line=5)     t,       [6](vscode-notebook-cell:?execution_count=32&line=6)     iterator=FrameIterator.create(video=t.video, fps=30)       [7](vscode-notebook-cell:?execution_count=32&line=7) )  File /opt/miniconda3/envs/pxt/lib/python3.10/site-packages/pixeltable/globals.py:303, in create_view(path, base, additional_columns, is_snapshot, iterator, num_retained_versions, comment, med

- **Issue #763** (2026-09-22): **udf not robust to dependency change**
  *Symptoms*: If there is a udf used in a computed column, and if that udf uses an external library (dspy 3.0.0b2 vs dspy 3.0.0b4) changing the library cause the whole table to not load/connect anymore.  for instance: ```python t = pxt.get_table("tuto.invoices") ```  result in that: ``` ----> [4](vscode-notebook-cell:?execution_count=5&line=4) t = pxt.get_table("tuto.invoices")  File ~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/globals.py:454, in get_table(path)     425 """Get a handle to an existing table, view, or snapshot.     426      427 Args:    (...)    451     >>> tbl = pxt.get_table('my_table:722')     452 """     453 path_obj = catalog.Path.parse(path, allow_versioned_path=True) --> [454](https://file+.vscode-resource.vscode-cdn.net/home/maxime/Projects/maximerivest-blog/~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/globals.py:454) tbl = Catalog.get().get_table(path_obj)     455 return tbl  File ~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pixeltable/catalog/catalog.py:102, in retry_loop.<locals>.decorator.<locals>.loop(*args, **kwargs)      94     assert not Env.get().in_xact      95     with Catalog.get().begin_xact(      96         tbl=tbl,      97         for_write=for_write,    (...)    100         finalize_pending_ops=True,     101     ): --> [102](https://file+.vscode-resource.vscode-cdn.net/home/maxime/Projects/maximerivest-blog/~/Projects/maximerivest-blog/.venv/lib/python3.12/site-packages/pix
  **Post-Mortem & Fix Analysis**:
  > It looks like you defined the udf in a notebook. Is that correct?  If so, could you please put this udf into a module and try this again? Having udfs defined in notebooks is mostly just a feature useful for tutorials and demos, and discouraged for longer-lived use cases.
  > This is fixed: a stored UDF that fails to unpickle now degrades to an InvalidFunction with a clear message instead of breaking `get_table()`. Still a good idea to keep long-lived UDFs in modules rather than notebooks. Closing.

- **Issue #704** (2025-08-19): **Rate limit error when using openai gpt4o-mini**
  *Symptoms*: RateLimitError: Error code: 429 - {'error': {'message': 'Rate limit reached for gpt-4o-mini in organization org-XXXXXXXXXXXXX on tokens per min (TPM): Limit 200000, Used 200000, Requested 775. Please try again in 232ms. Visit https://platform.openai.com/account/rate-limits to learn more.', 'type': 'tokens', 'param': None, 'code': 'rate_limit_exceeded'}}  The above exception was the direct cause of the following exception:  Error Traceback (most recent call last)  /usr/local/lib/python3.11/dist-packages/pixeltable/[store.py](http://store.py/) in load_column(self, col, exec_plan, abort_on_exc)  263 if abort_on_exc and row.has_exc():  264 exc = row.get_first_exc()  --> 265 raise excs.Error(f'Error while evaluating computed column {[col.name](http://col.name/)!r}:\n{exc}') from exc  266 table_row, num_row_exc = row_builder.create_table_row(row, None, [row.pk](http://row.pk/))  267 if col.col_type.is_media_type():  ```python  frames_view.add_computed_column(  im_caption=vision(  prompt="Describe this image in detail",  image=frames_view.resized_frame,  model="gpt-4o-mini",  )  ) ``` FYI : its only 61 frames to be captioned
  **Post-Mortem & Fix Analysis**:
  > Hi Mohamed, could you give us some more info: - what are your account rate limits for 4o-mini? (TPM, RPM, TPD) - what's the width/height of your video frames?
  > Hello , sure   1. using the TPM (200,000 tokens per minute) and TPD (2,000,000 tokens per day) limit  1.  width=1280 2.  height=720
  > @mohamedsheded Thanks for the info - we are looking into it more today and tomorrow. Our rate limit for our account is 10x/100x what you have so it's harder for us to reproduce.  Let us know if anything else comes up.

- **Issue #647** (2025-06-06): **fiftyone integration does not allow to visualize images in fifty one when the pixeltable is filled from PIL image directly**
  *Symptoms*: I am loading data to pixeltable from preexisting torch datasets, thus I might not have to urls or local path for the images I want to add in my tables. Thus I am adding them directly as PIL.Image object.  In such case, the importing in the table is working as expected. However, the images (pixel values) are not visible in FiftyOne while the metadata are well imported.  ``` import fiftyone as fo import pixeltable as pxt import requests from io import BytesIO from PIL import Image  pxt.drop_dir('fo_demo', force=True) pxt.create_dir('fo_demo')  url_prefix = 'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images'  urls = [     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000019.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000025.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000030.jpg',     'https://raw.githubusercontent.com/pixeltable/pixeltable/main/docs/resources/images/000000000034.jpg', ]  imgs = [Image.open(BytesIO(requests.get(url).content)) for url in urls]  t = pxt.create_table('fo_demo.images', {'image': pxt.Image})  t.insert({'image': img} for img in imgs) t.head()  fo_dataset = pxt.io.export_images_as_fo_dataset(t, t.image) session = fo.launch_app(fo_dataset) session.wait() ```  Here what I am obtaining in FiftyOne:  ![Image](https://github.com/user-attachments/assets/b50baf09-ac99-4444-8
  **Post-Mortem & Fix Analysis**:
  > When debugging, I spotted that images inserted directly as PIL image are not saved with the jpeg extension 
  > I was right about the jpeg issue, if I add an extension `.jpeg` [here](https://github.com/pixeltable/pixeltable/blob/6d0b2b050ed1ba66f5f21275260187906fe0feb1/pixeltable/exprs/row_builder.py#L451), it solves the issue
  > I am wondering if this is something we wanna add for the full pixeltable implementation or if we should fix the fiftyone integration

- **Issue #495** (2025-03-19): **can't import image file with # in the filename**
  *Symptoms*: I have no idea why this is the file name, but one of my students generated a file like  '#_3857_55775.0_84172.0.png'   <img width="926" alt="Image" src="https://github.com/user-attachments/assets/29487a48-47e6-4553-a8a9-122e4d9aa65e" />   Error: Error in column image: file not found: /scr/arosado/output/regions/0 Row: {'image': '/scr/arosado/output/regions/0/#_3857_55775.0_84172.0.png'}  It seems that the parser is not properly dealing with arguably very poorly named files.  When I renamed the same image "image1.png" not surprisingly it uploaded fine. 
  **Post-Mortem & Fix Analysis**:
  > This issue has been fixed.

- **Issue #473** (2025-12-17): **Inserting new records throws error on optional audio field**
  *Symptoms*: File ~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:426, in ColumnType.create_literal(self, val)     [424](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:424)     val = self._create_literal(val) --> [426](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:426) self.validate_literal(val)     [427](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e6575726f6c6f67792e656d6f72792e656475222c2275736572223a2264616775746d616e227d.vscode-resource.vscode-cdn.net/home/dagutman/devel/pt_messageAnalytics/~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:427) return val  File ~/devel/pt_messageAnalytics/.pyenv/lib/python3.10/site-packages/pixeltable/type_system.py:387, in ColumnType.validate_literal(self, val)     [386](https://vscode-remote+ssh-002dremote-002b7b22686f73744e616d65223a226f7070656e6865696d65722e6e65
  **Post-Mortem & Fix Analysis**:
  > Hi @dgutman , can you post a repro of this issue (the code that triggered it)? Thanks!  Aaron

- **Issue #469** (2025-02-12): **Video Indexing fails ...**
  *Symptoms*: Using the example code from **text-and-image-similarity-search-nextjs-fastapi** I run into this error:  **>>> REBUILD NEW PXT Data Structures ...  Connected to Pixeltable database at: postgresql+psycopg://postgres:@/pixeltable?host=/Users/kamir/.pixeltable/pgdata Created directory `video_search`. Created table `videos`.**  Process SpawnProcess-1: Traceback (most recent call last):   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 314, in _bootstrap     self.run()   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 108, in run     self._target(*self._args, **self._kwargs)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/_subprocess.py", line 80, in subprocess_started     target(sockets=sockets)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/server.py", line 66, in run     return asyncio.run(self.serve(sockets=sockets))            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/asyncio/runners.py", line 190, in run     return runner.run(main)            ^^^^^^^^^^^^^^^^   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/asyncio/runners.py", line 118, in run     return self._loop.run_until_complete(task)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "uvloop/loop.pyx", line 1518, in uvloop.loop.Loop.run_until_complete   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/se
  **Post-Mortem & Fix Analysis**:
  > When using version 0.3.0 I get a different error at the same place:  All I want to do is uploading an example video. Last week, I tested this code ca. 100 times to see how fast it is. But now, I am lost.  Created table `videos`. Created view `frames` with 0 rows, 0 exceptions. Inserting rows into `videos`: 1 rows [00:00, 1281.88 rows/s]              | 0/2 [00:00<?, ? cells/s] Computing cells: 100%|████████████████████████████████████████████| 2/2 [00:00<00:00, 29.95 cells/s] Process SpawnProcess-1: Traceback (most recent call last):   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 314, in _bootstrap     self.run()   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/multiprocessing/process.py", line 108, in run     self._target(*self._args, **self._kwargs)   File "/opt/anaconda3/envs/pixeltable/lib/python3.11/site-packages/uvicorn/_subprocess.py", line 80, in subprocess_started     target(sockets=sockets)   File "/opt/anaconda3/envs/pixeltable/li
  > Regarding the "can't patch ..." error: are you running this inside a notebook? If so, could you please try to run it inside a script?  Also, you seem to be running uvloop instead of the standard asyncio event loop. The call to nest_asyncio.apply() (which should only happen when you're running in a notebook, btw) won't work for that package. Did you install uvloop intentionally or are you pulling that in as part of something else?
  > Thanks Marcel.  This code is in a FastAPI app, based on the example code. Regarding **uvloop**, I did not add it by intention.  I will try to avoid using it:  ** Force asyncio to use the default event loop policy _asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())  uvicorn.run("app:app", ...... , loop="asyncio")_

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

### Incident Patch 1: `c4cfb1a3` (2026-09-30)
**Commit Message**: [PXT-1446] Fix Variable handling in aggregate queries (#1689)

Fix aggregate queries that use bound `@pxt.query` parameters (they show
up as `Variable` type expressions). The planner now treats parameters as
valid inputs to aggregate expressions and avoids computing aggregate
outputs in the inner table scan. This prevents crashes in queries such
as `sum(column + parameter)` and
`mean(column.similarity(string=parameter))`.

**File**: `pixeltable/plan.py` (modified, +15/-8)
```diff
@@ -199,19 +199,17 @@ def _determine_agg_status(self, e: exprs.Expr, grouping_expr_ids: set[int]) -> t
                 if not is_input:
                     raise excs.RequestError(excs.ErrorCode.INVALID_EXPRESSION, f'Invalid nested aggregates: {e}')
             return True, False
-        elif isinstance(e, exprs.Literal):
+        elif isinstance(e, (exprs.Literal, exprs.Variable)):
             return True, True
         elif isinstance(e, (exprs.ColumnRef, exprs.RowidRef)):
             # we already know that this isn't a grouping expr
             return False, True
         else:
             # an expression such as <grouping expr 1> + <grouping expr 2> can both be the output and input of agg
             assert len(e.components) > 0
-            component_is_output, component_is_input = zip(
-                *[self._determine_agg_status(c, grouping_expr_ids) for c in e.components]
-            )
-            is_output = component_is_output.count(True) == len(e.components)
-            is_input = component_is_input.count(True) == len(e.components)
+            statuses: list[tuple[bool, bool]] = [self._determine_agg_status(c, grouping_expr_ids) for c in e.components]
+            is_output = all(out for out, _ in statuses)
+            is_input = all(inp for _, inp in statuses)
             if not is_output and not is_input:
                 raise excs.RequestError(
                     excs.ErrorCode.INVALID_EXPRESSION, f'Invalid expression, mixes aggregate with non-aggregate: {e}'
@@ -1111,14 +1109,23 @@ def _create_query_plan(
         cls._verify_join_clauses(analyzer)
 
         # materialized with SQL table scans (ie, single-table SELECT statements):
-        # - select list subexprs that aren't aggregates
+        # - Select list subexprs that aren't aggregates. In a grouping aggregation, only the args of aggregate and
+        # window function calls; the rest of the analyzer's select list is aggregate output, which is not allowed to be
+        # materialized in the inner scan.
         # - join clause subexprs
         # - subexprs of Where clause conjuncts that can't be run in SQL
         # - all grouping exprs
         # - all stratify exprs
+        select_list_inputs: list[exprs.Expr]
+        if analyzer.group_by_clause is None:
+            select_list_inputs = analyzer.select_list
+        else:
+            select_list_inputs = []
+            for fn_call in analyzer.agg_fn_calls + analyzer.window_fn_calls:
+                select_list_inputs.extend(fn_call.components)
         candidates = list(
             exprs.Expr.list_subexprs(
-                analyzer.select_list,
+                select_list_inputs,
                 filter=lambda e: (
                     sql_elements.contains(e)
                     and not e.contains_(cls=exprs.FunctionCall, filter=lambda e: bool(e.is_agg_fn_call))
```

**File**: `tests/test_exprs.py` (modified, +12/-0)
```diff
@@ -1803,6 +1803,18 @@ def series_to_list(series: pd.Series) -> list[int | None]:
         r4 = t.group_by(t.c_bool, t.c_string).select(two='2').collect()
         assert len(r1) == len(r4)
 
+        # an output derived from a grouping expr is computed from the grouped value
+        grouped = t.where(t.c_int != None).group_by(t.c_int)
+        for i, res in enumerate(
+            (
+                grouped.select(t.c_int, succ=t.c_int + 1, out=int_sum).order_by(t.c_int).collect(),
+                grouped.select(t.c_int, succ=t.c_int + 1, out=pxtf.sum(_add_one(t.c_int))).order_by(t.c_int).collect(),
+                grouped.select(t.c_int, succ=t.c_int + 1).order_by(t.c_int).collect(),
+            )
+        ):
+            assert len(res) > 0, i
+            assert res['succ'] == [x + 1 for x in res['c_int']], i
+
         # we correctly apply a limit to the agg output
         r5 = t.group_by(t.c_bool).select(s=pxtf.sum(t.c_int)).collect()['s']
         r6 = (
```

**File**: `tests/test_function.py` (modified, +38/-0)
```diff
@@ -592,6 +592,44 @@ def skipped(off: int) -> pxt.Query:
         with pxt_raises(pxt.ErrorCode.UNSUPPORTED_OPERATION, match="'offset'"):
             neg.add_computed_column(c=skipped(neg.n), on_error='abort')
 
+    def test_query_param_in_aggregate(self, db_root: DatabaseRoot) -> None:
+        p = db_root.make_catalog_path
+        t = pxt.create_table(p('test'), {'x': pxt.Int})
+        t.insert({'x': i} for i in range(4))
+        params = pxt.create_table(p('params'), {'k': pxt.Int})
+        params.insert([{'k': 1}, {'k': 2}])
+
+        @pxt.query(return_scalar=True)
+        def shifted_sum(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x + k))
+
+        res = params.order_by(params.k).select(r=shifted_sum(params.k)).collect()
+        assert res['r'] == [[10], [14]]
+
+        @pxt.query
+        def sum_with_param(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x), k=k)
+
+        res = params.order_by(params.k).select(r=sum_with_param(params.k)).collect()
+        assert res['r'] == [[{'s': 6, 'k': 1}], [{'s': 6, 'k': 2}]]
+
+        @pxt.query
+        def sum_with_param_expr(k: int) -> pxt.Query:
+            return t.select(s=pxtf.sum(t.x), adjusted=k + 1)
+
+        res = params.order_by(params.k).select(r=sum_with_param_expr(params.k)).collect()
+        assert res['r'] == [[{'s': 6, 'adjusted': 2}], [{'s': 6, 'adjusted': 3}]]
+
+        @pxt.query
+        def grouped_sum_with_param_expr(k: int) -> pxt.Query:
+            return t.group_by(t.x % 2).select(g=t.x % 2, s=pxtf.sum(t.x), scaled=k * 10).order_by(t.x % 2)
+
+        res = params.order_by(params.k).select(r=grouped_sum_with_param_expr(params.k)).collect()
+        assert res['r'] == [
+            [{'g': 0, 's': 2, 'scaled': 10}, {'g': 1, 's': 4, 'scaled': 10}],
+            [{'g': 0, 's': 2, 'scaled': 20}, {'g': 1, 's': 4, 'scaled': 20}],
+        ]
+
     def test_query2(self, db_root: DatabaseRoot) -> None:
         p = db_root.make_catalog_path
         schema: dict[str, Any] = {'query_text': pxt.String | None, 'i': pxt.Int | None}
```

**File**: `tests/test_index.py` (modified, +26/-0)
```diff
@@ -272,6 +272,32 @@ def top_k_chunks_deprecated(query_text: str) -> pxt.Query:
         # insert more rows in order to run the query function
         validate_update_status(queries.insert(query_rows))
 
+    def test_query_similarity_in_aggregate(self, db_root: DatabaseRoot, local_embed: pxt.Function) -> None:
+        p = db_root.make_catalog_path
+        chunks = pxt.create_table(p('chunks'), {'text': pxt.String})
+        chunks.insert(
+            [
+                {'text': 'the stock of artificial intelligence companies is up 1000%'},
+                {'text': 'machine learning is a subset of artificial intelligence'},
+                {'text': 'gas car companies are in danger of being left behind by electric car companies'},
+            ]
+        )
+        chunks.add_embedding_index(column='text', string_embed=local_embed)
+        query_texts = ['artificial intelligence', 'electric cars']
+        queries = pxt.create_table(p('queries'), {'query_text': pxt.String})
+        queries.insert({'query_text': q} for q in query_texts)
+
+        @pxt.query
+        def sim_stats(q: str) -> pxt.Query:
+            sim = chunks.text.similarity(string=q)
+            return chunks.select(mean=pxtf.mean(sim), mean_sq=pxtf.mean(sim * sim), n=pxtf.count(sim))
+
+        res = queries.order_by(queries.query_text).select(r=sim_stats(queries.query_text)).collect()
+        for q, r in zip(query_texts, res['r'], strict=True):
+            sim = chunks.text.similarity(string=q)
+            expected = chunks.select(mean=pxtf.mean(sim), mean_sq=pxtf.mean(sim * sim), n=pxtf.count(sim)).collect()
+            assert r == [expected[0]]
+
     def test_search_fn(self, small_img_tbl: pxt.Table, local_embed: pxt.Function) -> None:
         t = small_img_tbl
         sample_img = t.select(t.img).head(1)[0, 'img']
```

---

### Incident Patch 2: `f1f51533` (2026-09-30)
**Commit Message**: [PXT-1413] Fix for serving routes with @pxt.query (#1694)

Fixes [PXT-1413](https://pixeltable.atlassian.net/browse/PXT-1413).

`TableModelMeta.table_path()` failed for a model whose computed column
calls a `@pxt.query` over another model: building the column serializes
its value, and `ModelQuery.as_dict()` refuses. Every use of the model's
defined shape before binding raised `INTERNAL_ERROR`, not only DML
routes: `Model.where()` / `select()`, a `@pxt.query` or query route over
the model, a view model based on it, and a column invoking a
query-backed tool.

`table_path()` now rebinds each query udf to its model's defined shape
(`ModelQuery.to_defined_query()`) before `prepare_model()`. The value
serialized into this metadata is never deserialized:
`ColumnVersionMd.is_computed` only checks it against `None`.
`bind_query_templates()` takes `catalog_dir=None` for this case;
`_create()` and `update_all()` are unchanged.

Tests:
- `test_query_udf_column_target`: insert, compute, delete, and query
routes on such a model, served end to end.
- `test_view_over_query_udf_model`: a view model over such a model, with
a query udf column and a query-backed tool column.

🤖 Generated with [Claude

**File**: `pixeltable/catalog/model/base.py` (modified, +7/-4)
```diff
@@ -32,10 +32,13 @@ def _queried_models(col_spec: ColumnSpec) -> set[TableModelMeta]:
     if not isinstance(value, exprs.Expr):
         return set()
     result: set[TableModelMeta] = set()
-    for fn_call in value.subexprs(exprs.FunctionCall):
-        fn = fn_call.fn
-        if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
-            result.add(fn.template_query.model_cls)
+    pending = [value]
+    while len(pending) > 0:
+        for fn_call in pending.pop().subexprs(exprs.FunctionCall):
+            fn = fn_call.fn
+            if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
+                result.add(fn.template_query.model_cls)
+                pending.extend(fn.template_query._component_exprs())
     return result
 
 
```

**File**: `pixeltable/catalog/model/definition.py` (modified, +7/-4)
```diff
@@ -449,8 +449,11 @@ def apply_decl_order(self) -> None:
         self.known_cols = ordered
 
 
-def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
-    """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model."""
+def bind_query_templates(e: exprs.Expr, catalog_dir: str | None) -> exprs.Expr:
+    """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model.
+
+    With `catalog_dir=None`, each Query is over its model's defined shape rather than over a table.
+    """
     from .query import ModelQuery
 
     subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
@@ -460,7 +463,7 @@ def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
             continue
         assert fn_call.group_by_start_idx == fn_call.group_by_stop_idx  # a query udf takes no window clause
         rebound = func.QueryTemplateFunction(
-            fn.template_query.bind(catalog_dir),
+            fn.template_query.to_defined_query() if catalog_dir is None else fn.template_query.bind(catalog_dir),
             list(fn.signature.parameters.values()),
             return_scalar=fn.return_scalar,
             path=fn.self_path,
@@ -885,7 +888,7 @@ def table_path(cls) -> catalog.TableMdPath:
         for col_name, col_spec in cls.__columns__.items():
             copied = col_spec.copy()
             if 'value' in copied:
-                copied['value'] = copied['value'].copy()
+                copied['value'] = bind_query_templates(copied['value'].copy(), None)
             columns[col_name] = copied
         iterator, cols, idxs = prepare_model(
             handle, columns, spec['display_name'], spec['iterator'], base, cls.__indexes__, spec['is_data_versioned']
```

**File**: `pixeltable/catalog/model/query.py` (modified, +7/-5)
```diff
@@ -11,7 +11,7 @@
 from pixeltable.exprs import ColumnRefByName
 from pixeltable.query_clauses import FromClause
 
-from .definition import MODEL_BY_DEFINED_TBL_ID, TableModelMeta
+from .definition import MODEL_BY_DEFINED_TBL_ID, TableModelMeta, bind_query_templates
 
 
 class ModelQuery(QueryBase):
@@ -99,7 +99,7 @@ def to_defined_query(self) -> pxt.Query:
         for col_md in defined_path.column_md():
             if col_md.name is not None:
                 subst[ColumnRefByName(col_md.name)] = exprs.ColumnRef(col_md)
-        return self._substituted(defined_path, subst)
+        return self._substituted(defined_path, subst, None)
 
     def bind(self, catalog_dir: str) -> pxt.Query:
         """The equivalent query over the table this query's model resolves to under catalog_dir."""
@@ -110,9 +110,11 @@ def bind(self, catalog_dir: str) -> pxt.Query:
         subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
         for col_name in tbl.columns():
             subst[ColumnRefByName(col_name)] = getattr(tbl, col_name)
-        return self._substituted(tbl._tbl_path, subst)
+        return self._substituted(tbl._tbl_path, subst, catalog_dir)
 
-    def _substituted(self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr]) -> pxt.Query:
+    def _substituted(
+        self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr], catalog_dir: str | None
+    ) -> pxt.Query:
         """A plain Query over path, with this query's clauses rewritten by subst."""
         # a similarity expression names its indexed column and the table version holding the index, neither of
         # which a substitution by column name reaches
@@ -137,7 +139,7 @@ def _substituted(self, path: catalog.TablePath, subst: exprs.ExprDict[exprs.Expr
             )
 
         def rebound(e: exprs.Expr) -> exprs.Expr:
-            return e.copy().substitute(subst)
+            return bind_query_templates(e.copy().substitute(subst), catalog_dir)
 
         return pxt.Query(
             from_clause=FromClause(tbls=[path]),
```

**File**: `tests/serving/test_fastapi_models.py` (modified, +53/-0)
```diff
@@ -263,6 +263,59 @@ class Halved(TableModel, name='halved', base=Notes.where(Notes.val > 10).select(
         assert client.post('/half', json={'note_id': 3, 'val': 20}).json() == {'half': 10.0, 'plus': 11.0}
         assert client.post('/half', json={'note_id': 4, 'val': 5}).json() is None
 
+    def test_query_udf_column_target(self, db_root: DatabaseRoot) -> None:
+        """Routes can be declared against a model whose computed column calls a @pxt.query over another model."""
+        p = db_root.make_catalog_path
+        skip_test_if_not_installed('fastapi')
+        from pixeltable.serving import FastAPIRouter
+
+        TableModel = pxt.model_base()  # noqa: N806
+
+        class Docs(TableModel, name='docs'):
+            body: pxt.String
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs.where(Docs.body == q).select(Docs.body)  # type: ignore[arg-type]
+
+        class Asks(TableModel, name='asks'):
+            question = pxt.Column(type=pxt.String, primary_key=True)
+            hits = find(question)
+
+        @pxt.query
+        def asked(question: str) -> pxt.Query:
+            return Asks.where(Asks.question == question).select(Asks.hits)  # type: ignore[arg-type]
+
+        router = FastAPIRouter()
+        router.add_insert_route(
+            Asks,
+            path='/ins',
+            inputs=[Asks.question],  # type: ignore[arg-type]
+            outputs=[Asks.hits],  # type: ignore[arg-type]
+        )
+        router.add_compute_route(
+            Asks,
+            path='/comp',
+            inputs=[Asks.question],  # type: ignore[arg-type]
+            outputs=[Asks.hits],  # type: ignore[arg-type]
+        )
+        router.add_delete_route(
+            Asks,
+            path='/del',
+            match_columns=[Asks.question],  # type: ignore[arg-type]
+        )
+        router.add_query_route(path='/asked', query=asked)
+        client = make_test_client(router)
+
+        TableModel.create_all(p(''))
+        router.bind(p(''))
+        Docs.table.insert([{'body': 'alpha'}, {'body': 'beta'}])
+
+        assert client.post('/ins', json={'question': 'alpha'}).json() == {'hits': [{'body': 'alpha'}]}
+        assert client.post('/comp', json={'question': 'beta'}).json() == {'hits': [{'body': 'beta'}]}
+        assert client.post('/asked', json={'question': 'alpha'}).json() == {'rows': [{'hits': [{'body': 'alpha'}]}]}
+        assert client.post('/del', json={'question': 'alpha'}).json() == {'num_rows': 1}
+
     def test_bind(self, db_root: DatabaseRoot) -> None:
         """bind() resolves model targets, refuses what the tables cannot serve, and rejects a second target."""
         p = db_root.make_catalog_path
```

**File**: `tests/test_table_model.py` (modified, +120/-0)
```diff
@@ -2661,6 +2661,126 @@ class ProbeV2(TableModelV2, name='probe'):
         rows = probe.order_by(probe.cutoff).select(probe.matches).collect()
         assert [r['matches'] for r in rows] == [[{'title': 'beta'}], [{'title': 'beta'}]]
 
+    def test_view_over_query_udf_model(self, db_root: DatabaseRoot) -> None:
+        """A view model can be based on a model whose computed columns call a query udf over another model."""
+        from pixeltable.functions import anthropic
+
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            doc_id: pxt.Int
+            title: pxt.String
+
+        @pxt.query
+        def titles_after(cutoff: int) -> pxt.Query:
+            return Docs.where(Docs.doc_id > cutoff).order_by(Docs.doc_id).select(Docs.title)  # type: ignore[arg-type]
+
+        class Probe(TableModel, name='probe'):
+            cutoff: pxt.Int
+            response: pxt.Json
+            matches = titles_after(cutoff)
+            tool_matches = anthropic.invoke_tools(pxt.tools(titles_after), response)
+
+        class ProbeView(TableModel, name='probe_view', base=Probe.where(Probe.cutoff > 0)):
+            match_count = pxtf.json.len(Probe.matches)
+
+        target = db_root.make_catalog_path('qudf_view')
+        pxt.create_dir(target, parents=True)
+        TableModel.create_all(target)
+        pxt.get_table(f'{target}/docs').insert([{'doc_id': 1, 'title': 'alpha'}, {'doc_id': 5, 'title': 'beta'}])
+        tool_use = {'type': 'tool_use', 'name': 'titles_after', 'input': {'cutoff': 1}}
+        pxt.get_table(f'{target}/probe').insert(
+            [{'cutoff': 0, 'response': {'content': [tool_use]}}, {'cutoff': 1, 'response': {'content': [tool_use]}}]
+        )
+
+        view = pxt.get_table(f'{target}/probe_view')
+        rows = view.select(view.matches, view.tool_matches, view.match_count).collect()
+        assert list(rows) == [
+            {'matches': [{'title': 'beta'}], 'tool_matches': {'titles_after': [[{'title': 'beta'}]]}, 'match_count': 1}
+        ]
+
+    def test_nested_query_udf_over_model(self, db_root: DatabaseRoot) -> None:
+        """A query udf over a model can select a query udf over another model."""
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            topic: pxt.String
+            title: pxt.String
+
+        @pxt.query
+        def titles_for(topic: str) -> pxt.Query:
+            return Docs.where(Docs.topic == topic).order_by(Docs.title).select(Docs.title)  # type: ignore[arg-type]
+
+        class Topics(TableModel, name='topics'):
+            topic: pxt.String
+
+        @pxt.query
+        def topics_like(prefix: str) -> pxt.Query:
+            matching = Topics.where(Topics.topic.startswith(prefix))  # type: ignore[arg-type]
+            return matching.order_by(Topics.topic).select(Topics.topic, titles=titles_for(Topics.topic))  # type: ignore[arg-type]
+
+        class Probe(TableModel, name='probe'):
+            prefix: pxt.String
+            matches = topics_like(prefix)
+
+        class ProbeView(TableModel, name='probe_view', base=Probe.where(Probe.prefix != '')):
+            pass
+
+        target = db_root.make_catalog_path('qudf_nested')
+        pxt.create_dir(target, parents=True)
+        TableModel.create_all(target)
+        pxt.get_table(f'{target}/docs').insert(
+            [{'topic': 'cats', 'title': 'b'}, {'topic': 'cats', 'title': 'a'}, {'topic': 'dogs', 'title': 'c'}]
+        )
+        pxt.get_table(f'{target}/topics').insert([{'topic': 'cats'}, {'topic': 'cows'}, {'topic': 'dogs'}])
+        pxt.get_table(f'{target}/probe').insert([{'prefix': 'c'}, {'prefix': ''}])
+
+        view = pxt.get_table(f'{target}/probe_view')
+        assert view.select(view.matches).collect()['matches'] == [
+            [{'topic': 'cats', 'titles': [{'title': 'a'}, {'title': 'b'}]}, {'topic': 'cows', 'titles': []}]
+        ]
+
+    def test_update_all_nested_query_udf_over_model(self, db
```

---

### Incident Patch 3: `a9f42fd4` (2026-09-28)
**Commit Message**: run hosted_environment fixture before others (#1671)

This should fix `No such file or directory: 'uv'` in nightly.

`TestDb` pulls in `project`, which pulls in `pixeltable_wheel`, which
fails because there's no `uv` and no pixeltable source to build from.
But `TestDb` is not even supposed to run because there's no pixeltable
API key.

Fix: make `hosted_environment` (that skips tests when there's no api
key) a session-scoped fixture, which moves it to before `project`.

**File**: `tests/pixeltable_cli/conftest.py` (modified, +7/-1)
```diff
@@ -24,7 +24,7 @@
 from pixeltable.config import Config
 from pixeltable_cli.client.utils import is_running
 
-from ..utils import CLOUD_DB_ROOT_URIS, DatabaseRoot, cloud_env_configured, home_bucket_uri
+from ..utils import CLOUD_DB_ROOT_URIS, DatabaseRoot, cloud_env_configured, home_bucket_uri, skip_test_if_no_config
 
 _REPO_ROOT = pathlib.Path(__file__).parents[2]
 _CORPUS_DIR = pathlib.Path(__file__).parent
@@ -246,6 +246,12 @@ def copy_app_corpus(session_project: pathlib.Path) -> pathlib.Path:
     return directory
 
 
+@pytest.fixture(scope='session')  # session scope makes it run before the session-scoped pixeltable_wheel
+def hosted_environment() -> None:
+    """Skip unless a control plane is configured."""
+    skip_test_if_no_config('api_key')
+
+
 @pytest.fixture(scope='session')
 def pixeltable_wheel(tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
     """A wheel built from this working tree, for a project to install in place of the released pixeltable."""
```

**File**: `tests/pixeltable_cli/test_db.py` (modified, +1/-7)
```diff
@@ -15,7 +15,7 @@
 import pytest
 
 from pixeltable.service import proxy_daemon
-from tests.utils import DatabaseRoot, new_db_uri, skip_test_if_no_config
+from tests.utils import DatabaseRoot, new_db_uri
 
 from .conftest import (
     APPLY_TIMEOUT,
@@ -52,12 +52,6 @@ def get_target_ops(plan: dict[str, Any], target: str) -> list[dict[str, Any]]:
     return [op for op in plan['ops'] if op['target'] == target]
 
 
-@pytest.fixture
-def hosted_environment() -> None:
-    """Skip the test unless a control plane is configured to create the database against."""
-    skip_test_if_no_config('api_key')
-
-
 @pytest.fixture(scope='module')
 def test_db_uri(session_cli: PxtRunner, session_project: pathlib.Path) -> Iterator[str]:
     """A database URI of this module's own, naming nothing until a test creates it, deleted when it ends.
```

**File**: `tests/pixeltable_cli/test_key.py` (modified, +0/-8)
```diff
@@ -11,19 +11,11 @@
 
 import pytest
 
-from tests.utils import skip_test_if_no_config
-
 from .conftest import PxtRunner
 
 _ORG_URI = 'pxt://{org}:main'
 
 
-@pytest.fixture
-def hosted_environment() -> None:
-    """Skip unless a control plane is configured to create keys against."""
-    skip_test_if_no_config('api_key')
-
-
 @pytest.fixture
 def key_name(cli: PxtRunner) -> Iterator[str]:
     """A name no other run uses, deleted afterwards whether or not the test got that far."""
```

**File**: `tests/pixeltable_cli/test_service.py` (modified, +1/-0)
```diff
@@ -1146,6 +1146,7 @@ def test_example(self, cli: PxtRunner, db_root: DatabaseRoot, project_dir: pathl
 @pytest.mark.remote_api
 @pytest.mark.expensive
 @pytest.mark.db_roots('local', reason='pxt service acts on a hosted database, not on the catalog a test runs against')
+@pytest.mark.usefixtures('hosted_environment')
 class TestHostedService:
     """`pxt service` against a hosted database."""
 
```

---

### Incident Patch 4: `085dab34` (2026-09-24)
**Commit Message**: [PXT-1451] Fix missing * and / in UDF signatures (#1659)

**File**: `pixeltable/func/signature.py` (modified, +15/-0)
```diff
@@ -235,13 +235,28 @@ def __hash__(self) -> int:
     def params_str(self) -> str:
         """Generates a user friendly string describing this signature's input parameters"""
         param_strs: list[str] = []
+        pending_pos_only_marker = False
+        needs_kw_only_marker = True
         for p in self.parameters.values():
+            if p.kind == inspect.Parameter.POSITIONAL_ONLY:
+                pending_pos_only_marker = True
+            elif pending_pos_only_marker:
+                param_strs.append('/')
+                pending_pos_only_marker = False
+            if p.kind == inspect.Parameter.VAR_POSITIONAL:
+                needs_kw_only_marker = False
+            elif p.kind == inspect.Parameter.KEYWORD_ONLY and needs_kw_only_marker:
+                param_strs.append('*')
+                needs_kw_only_marker = False
+
             if p.kind == inspect.Parameter.VAR_POSITIONAL:
                 param_strs.append(f'*{p.name}')
             elif p.kind == inspect.Parameter.VAR_KEYWORD:
                 param_strs.append(f'**{p.name}')
             else:
                 param_strs.append(f'{p.name}: pxt.{p.col_type}')
+        if pending_pos_only_marker:
+            param_strs.append('/')
         return ', '.join(param_strs)
 
     def return_str(self, pretty_print_json: bool = False) -> str:
```

**File**: `tests/test_function.py` (modified, +18/-16)
```diff
@@ -322,29 +322,31 @@ def test_invalid_call(self, test_tbl: pxt.Table) -> None:
         multi_a = r"multiple values for argument 'a'"
         too_many_pos = r'too many positional arguments'
         exp_ab = r'expected \(a: pxt\.Int, b: pxt\.Int\)'
+        exp_ab_pos_only = r'expected \(a: pxt\.Int, b: pxt\.Int, /\)'
+        exp_ab_kw_only = r'expected \(\*, a: pxt\.Int, b: pxt\.Int\)'
 
         # udf with positional params only
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_pos_only}, got \(\)'):
             _ = t.select(self.udf_pos_only_params()).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(x=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_pos_only}, got \(x=Int\)'):
             _ = t.select(self.udf_pos_only_params(x=0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int\)'):
             _ = t.select(self.udf_pos_only_params(0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_a}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_a}; {exp_ab_pos_only}, got \(a=Int\)'):
             _ = t.select(self.udf_pos_only_params(a=1)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int, a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int, a=Int\)'):
             _ = t.select(self.udf_pos_only_params(1, a=1)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_b}; {exp_ab}, got \(Int, b=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{pos_only_b}; {exp_ab_pos_only}, got \(Int, b=Int\)'):
             _ = t.select(self.udf_pos_only_params(1, b=1)).collect()
 
         # udf with keyword params only
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_kw_only}, got \(\)'):
             _ = t.select(self.udf_kw_only_params()).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{too_many_pos}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{too_many_pos}; {exp_ab_kw_only}, got \(Int\)'):
             _ = t.select(self.udf_kw_only_params(0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab}, got \(x=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_a}; {exp_ab_kw_only}, got \(x=Int\)'):
             _ = t.select(self.udf_kw_only_params(x=0)).collect()
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(a=Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_kw_only}, got \(a=Int\)'):
             _ = t.select(self.udf_kw_only_params(a=0)).collect()
 
         # udf with positional or kw params
@@ -392,21 +394,21 @@ def test_invalid_call(self, test_tbl: pxt.Table) -> None:
             _ = t.select(self.udf_variadic_kw(1, x=0)).collect()
 
         # column ref as an argument for udf
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab}, got \(Int\)'):
+        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp_ab_pos_only}, got \(Int\)'):
             _ = t.select(self.udf_pos_only_params(t.c2)).collect()
 
         # arbitrary expr as an argument
-        with pxt_raises(pxt.ErrorCode.INVALID_ARGUMENT, match=rf'{missing_b}; {exp
```

---

### Incident Patch 5: `7d9af87e` (2026-09-22)
**Commit Message**: [PXT-1414] Fix for @query references in update_all() (#1651)

**File**: `pixeltable/catalog/model/base.py` (modified, +52/-13)
```diff
@@ -9,7 +9,7 @@
 from pixeltable.runtime import get_runtime
 from pixeltable.types import ColumnSpec
 
-from .definition import BtreeIndex, EmbeddingIndex, IndexDefinition, TableModelMeta
+from .definition import BtreeIndex, EmbeddingIndex, IndexDefinition, TableModelMeta, bind_query_templates
 from .diff import (
     _PY_MISMATCH_HINT,
     PY_DESTRUCTIVE_HINT,
@@ -22,28 +22,37 @@
 from .resolution import TableSchemaChangeSet
 
 
+def _queried_models(col_spec: ColumnSpec) -> set[TableModelMeta]:
+    """The models a column's value queries through a @pxt.query UDF."""
+    from pixeltable import exprs, func
+
+    from .query import ModelQuery
+
+    value = col_spec.get('value')
+    if not isinstance(value, exprs.Expr):
+        return set()
+    result: set[TableModelMeta] = set()
+    for fn_call in value.subexprs(exprs.FunctionCall):
+        fn = fn_call.fn
+        if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
+            result.add(fn.template_query.model_cls)
+    return result
+
+
 def _referenced_models(model: TableModelMeta) -> set[TableModelMeta]:
     """The models that have to be tables before `model` can be created.
 
     Its base, and every model a computed column queries through a @pxt.query UDF: both are recorded against
     the table the model resolves to, so that table has to exist first.
     """
-    from pixeltable import exprs, func
-
     from .query import ModelQuery
 
     result: set[TableModelMeta] = set()
     base = model.__table_spec__['base']
     if isinstance(base, ModelQuery):
         result.add(base.model_cls)
     for col_spec in model.__columns__.values():
-        value = col_spec.get('value')
-        if not isinstance(value, exprs.Expr):
-            continue
-        for fn_call in value.subexprs(exprs.FunctionCall):
-            fn = fn_call.fn
-            if isinstance(fn, func.QueryTemplateFunction) and isinstance(fn.template_query, ModelQuery):
-                result.add(fn.template_query.model_cls)
+        result |= _queried_models(col_spec)
     return result
 
 
@@ -171,12 +180,40 @@ def _update_all(catalog_dir: str = '', *, allow_destructive: bool = False) -> di
             (name, d) for name, d in diffs.items() if d.resolution in ('update_additive', 'update_destructive')
         ]
 
+        pending_creates = {name for name, d in diffs.items() if d.resolution == 'create'}
+
         if len(update_diffs) > 0:
             catalog_dir = catalog.Path.dir_prefix(catalog_dir)
+
+            added_cols = {
+                name: {c.name for c in d.ops if c.target == 'column' and c.op == 'add'} for name, d in update_diffs
+            }
+
+            # A new column may query a model this same call creates. Binding the column's query needs that
+            # table, so create it, and whatever it references in turn, ahead of the migrations below.
+            queried: set[TableModelMeta] = set()
+            for name, added in added_cols.items():
+                for col_name, col_spec in user_columns(registered_models[name]).items():
+                    if col_name in added:
+                        queried |= _queried_models(col_spec)
+            prerequisites: set[TableModelMeta] = set()
+            while len(queried) > 0:
+                queried_model = queried.pop()
+                if queried_model in prerequisites:
+                    continue
+                prerequisites.add(queried_model)
+                queried |= _referenced_models(queried_model)
+            # only the ones that don't exist yet: _create() also binds the model, and binding it before the
+            # migrations below would fix its columns to the pre-migration schema
+            for create_name, create_model in _creation_order(registered_models):
+                if create_model in prerequisites and create_name in pending_creates:
+                    _, was_created = create_model._create(catalog_dir)
+                    if was_created:
+ 
```

**File**: `pixeltable/catalog/model/definition.py` (modified, +2/-2)
```diff
@@ -449,7 +449,7 @@ def apply_decl_order(self) -> None:
         self.known_cols = ordered
 
 
-def _bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
+def bind_query_templates(e: exprs.Expr, catalog_dir: str) -> exprs.Expr:
     """Rebind QueryTemplateFunction calls of ModelQuery instances to the equivalent Query of the bound model."""
     from .query import ModelQuery
 
@@ -823,7 +823,7 @@ def _create(cls, catalog_dir: str = '') -> tuple[Table, bool]:
                     spec['type'], allow_builtin_types=False
                 )
             if 'value' in spec:
-                spec['value'] = _bind_query_templates(spec['value'].copy(), catalog_dir)
+                spec['value'] = bind_query_templates(spec['value'].copy(), catalog_dir)
             columns[name] = spec
 
         bound_path = f'{catalog_dir}{table_spec["name"]}'
```

**File**: `pixeltable/catalog/model/query.py` (modified, +4/-1)
```diff
@@ -103,7 +103,10 @@ def to_defined_query(self) -> pxt.Query:
 
     def bind(self, catalog_dir: str) -> pxt.Query:
         """The equivalent query over the table this query's model resolves to under catalog_dir."""
-        tbl = self.model_cls._bind(catalog_dir)
+        # _resolve_tbl() rather than _bind(): binding the model here would fix its columns to the schema the
+        # table has now, and update_all() may still be about to migrate it.
+        tbl = self.model_cls._resolve_tbl(catalog.Path.dir_prefix(catalog_dir), if_not_exists='error')
+        assert tbl is not None
         subst: exprs.ExprDict[exprs.Expr] = exprs.ExprDict()
         for col_name in tbl.columns():
             subst[ColumnRefByName(col_name)] = getattr(tbl, col_name)
```

**File**: `pixeltable/functions/string.py` (modified, +1/-1)
```diff
@@ -764,7 +764,7 @@ def splitlines(self: str, keepends: bool = False) -> list[str]:
 
 
 @pxt.udf(is_method=True)
-def startswith(self: str, substr: str) -> int:
+def startswith(self: str, substr: str) -> bool:
     """
     Return `True` if string starts with `substr`, otherwise return `False`.
 
```

**File**: `tests/test_table_model.py` (modified, +68/-0)
```diff
@@ -1118,6 +1118,74 @@ class ExampleViewModelFromQuery(
             view_from_query2.order_by(view_from_query2.id, view_from_query2.pos).collect(),
         )
 
+    def test_update_all_creates_queried_table(self, db_root: DatabaseRoot) -> None:
+        """The table a @pxt.query reads is created by the same update_all() that adds the column calling it."""
+        p = db_root.make_catalog_path
+        TableModel = pxt.model_base()
+
+        class Asks(TableModel, name='asks'):
+            question: pxt.String
+
+        TableModel.update_all(p(''))
+
+        TableModel2 = pxt.model_base()
+
+        class Docs(TableModel2, name='docs'):
+            body: pxt.String
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs.where(Docs.body.startswith(q)).select(body=Docs.body).limit(3)  # type: ignore[arg-type]
+
+        class Asks2(TableModel2, name='asks'):
+            question: pxt.String
+            hits = find(question)
+
+        TableModel2.update_all(p(''))
+
+        Docs.insert(body='A sample doc body that has a bunch of text')
+        Asks2.insert(question='A sample doc body')
+        res = Asks2.table.order_by(Asks2.question).collect()  # type: ignore[arg-type]
+        assert res[0] == {
+            'question': 'A sample doc body',
+            'hits': [{'body': 'A sample doc body that has a bunch of text'}],
+        }
+
+    def test_update_all_migrates_queried_model(self, db_root: DatabaseRoot) -> None:
+        """A @pxt.query reads a model that the same update_all() also migrates."""
+        p = db_root.make_catalog_path
+        TableModel = pxt.model_base()
+
+        class Docs(TableModel, name='docs'):
+            body: pxt.String
+
+        class Asks(TableModel, name='asks'):
+            question: pxt.String
+
+        TableModel.update_all(p(''))
+
+        TableModel2 = pxt.model_base()
+
+        class Docs2(TableModel2, name='docs'):
+            body: pxt.String
+            title: pxt.String | None  # added to the table that find() reads
+
+        @pxt.query
+        def find(q: str) -> pxt.Query:
+            return Docs2.where(Docs2.body == q).select(body=Docs2.body).limit(3)  # type: ignore[arg-type]
+
+        class Asks2(TableModel2, name='asks'):
+            question: pxt.String
+            hits = find(question)
+
+        TableModel2.update_all(p(''))
+
+        # binding find() must not leave Docs2 bound to the schema it had before its own column was added
+        Docs2.insert(body='alpha', title='A')
+        assert Docs2.table.select(Docs2.title).collect()['title'] == ['A']
+        Asks2.insert(question='alpha')
+        assert Asks2.table.select(Asks2.hits).collect()['hits'] == [[{'body': 'alpha'}]]
+
     def test_diff_all(self, db_root: DatabaseRoot) -> None:
         """diff_all() reports added/dropped columns and an iterator mismatch against already-created tables."""
         skip_test_if_not_installed('imagehash')
```

---

### Incident Patch 6: `f88e65f2` (2026-09-22)
**Commit Message**: [PXT-1386] Fix for cross-device move (#1652)

**File**: `pixeltable/utils/local_store.py` (modified, +7/-1)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import errno
 import glob
 import logging
 import os
@@ -152,7 +153,12 @@ def resolve_destination(
 
     def move_local_file(self, src_path: Path, dest: FileDestination) -> str | None:
         assert dest.local_path is not None
-        src_path.rename(dest.local_path)
+        try:
+            src_path.rename(dest.local_path)
+        except OSError as e:
+            if e.errno != errno.EXDEV:
+                raise
+            return None
         _logger.debug(f'Media Storage: moved {src_path} to {dest.url}')
         return dest.url
 
```

**File**: `tests/test_destination.py` (modified, +22/-0)
```diff
@@ -1,10 +1,12 @@
 from __future__ import annotations
 
+import errno
 import io
 import os
 import re
 import urllib.error
 import urllib.request
+import uuid
 from pathlib import Path
 from typing import ClassVar
 
@@ -382,6 +384,26 @@ def test_dest_local_copy(self, uses_db: None) -> None:
         # Ensure that local file is copied to a specified destination
         assert ObjectOps.count(t._id, dest=dest1_uri) == len(r)
 
+    @pytest.mark.db_roots('local', reason='media destination/object-store internals')
+    def test_dest_cross_device_move(self, monkeypatch: pytest.MonkeyPatch, uses_db: None) -> None:
+        """A destination on another filesystem than the TempStore falls back from rename to copy."""
+        dest_uri = self.resolve_destination_uri(StorageTarget.LOCAL_STORE)
+        store = ObjectOps.get_store(f'{dest_uri}/bucket1', False)
+
+        src_path = TempStore.create_path(extension='.bin')
+        src_path.write_bytes(b'cross-device payload')
+        dest = store.resolve_destination(uuid.uuid4(), 0, 0, ext=src_path.suffix)
+
+        def rename_exdev(self: Path, target: object) -> None:
+            raise OSError(errno.EXDEV, 'Invalid cross-device link')
+
+        monkeypatch.setattr(Path, 'rename', rename_exdev)
+        url = ObjectOps.put_file_resolved(store, src_path, dest, relocate_or_delete=True)
+
+        assert url == dest.url
+        assert dest.local_path.read_bytes() == b'cross-device payload'
+        assert not src_path.exists()
+
     @pytest.mark.very_expensive
     def test_dest_all(self, db_root: DatabaseRoot) -> None:
         """Test destination with all available storage targets"""
```

---

### Incident Patch 7: `851b0d0b` (2026-09-22)
**Commit Message**: Fix nightly MCP and optional notebook dependencies (#1598)

## Summary

Nightly installs MCP 2.x even though the example server uses its v1 API,
and sparse dependency configurations run tests without required optional
packages. Cap MCP at `>=1.27.2,<2`, report child-server startup failures
immediately with stderr, guard the mistune/spaCy-dependent tests, and
install spaCy in the primary transformers configuration.

Fix isolated notebook dependencies with torchvision for SAM3 and
`setuptools<82` for TensorFlow Hub's `pkg_resources` import. Skip
observability only in pip-install notebook mode; retain source-based
coverage using the workspace instrumentation package.

Clarify the public-API testing rule in AGENTS.md and GitHub agent
instructions. Claude inherits AGENTS.md. Internal access is limited to
focused internal unit tests or fixture setup unsupported by public APIs;
the instructions do not require explanatory comments. This guidance-only
follow-up passed diff checks; CI must rerun on the new head.

---------

Co-authored-by: Cursor <cursoragent@cursor.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `.github/instructions/tests.instructions.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ applyTo: "tests/**"
 - A test using `uses_db` needs `@pytest.mark.db_roots('local', reason='...')`; `tests/conftest.py` raises a `UsageError` at collection without it. The reason names a PXT ticket, not a bare TODO. Delete the exclusion when the ticket lands.
 - Any test for `pxt.Error` or a subclass uses `pxt_raises()`, not `pytest.raises()`. Both always take `match=` to verify error text.
 - Assert on user-visible behavior through the public API, not `col.stored`, `ColumnRef`, or `TableVersion` internals. Use `Table.get_metadata()`, `t.describe()`, or queries.
+- Avoid using the internal API as much as possible. Only use it to test behaviors that are very difficult or impossible to reproduce using only the public API.
 - AI provider tests go in `tests/functions/test_<provider>.py`, marked `remote_api`. Anything hitting a third-party model or service also needs `very_expensive`.
 - Never dodge one backend with a bare `@pytest.mark.skip`. Scope it with `db_roots`. Register any new marker in `pyproject.toml`.
 - No `http://` or `https://` literals. Use the `sample_file_server` fixture, which serves the repo tree over localhost and still exercises the download path.
```

**File**: `.github/workflows/nightly.yml` (modified, +3/-2)
```diff
@@ -47,7 +47,8 @@ jobs:
         python-version: ["3.11", "3.13"]
         package-configs:
           - ""
-          - "lancedb pylance mcp opencv-python scenedetect"
+          # TODO(PXT-1452): drop the mcp<2 cap once pixeltable/func/mcp.py targets the MCP 2.x client API
+          - "lancedb pylance 'mcp>=1.27.2,<2' opencv-python scenedetect"
           - "anthropic fireworks-ai 'google-genai<1.72.0' groq jina mistralai openai replicate together"
           - "fal-client runwayml twelvelabs voyageai"
           - "huggingface-hub llama-cpp-python openai-whisper"
@@ -57,7 +58,7 @@ jobs:
         include:
           # transformers-based tests need to run on a larger runner.
           - python-version: "3.11"
-            package-configs: "pyarrow sentence-transformers sentencepiece soundfile 'torch<2.11' 'torchaudio<2.11' torchvision 'torchcodec<0.11' transformers timm"
+            package-configs: "pyarrow sentence-transformers sentencepiece soundfile 'torch<2.11' 'torchaudio<2.11' torchvision 'torchcodec<0.11' transformers timm spacy"
             os: ubuntu-large
           - python-version: "3.11"
             package-configs: "whisperx transformers timm"
```

**File**: `AGENTS.md` (modified, +5/-0)
```diff
@@ -111,6 +111,11 @@ make formatcheck  # ruff format --check
 
 ### Testing
 
+Exercise behavior through public SDK, CLI, or HTTP APIs and assert on public results, metadata, or errors:
+use `Table.get_metadata()`, `t.describe()`, or queries rather than `col.stored`, `ColumnRef`, or
+`TableVersion` internals. Avoid using the internal API as much as possible. Only use it to test behaviors that
+are very difficult or impossible to reproduce using only the public API.
+
 ```bash
 # Run pytest (excludes expensive/remote_api tests)
 make pytest
```

**File**: `docs/release/howto/cookbooks/images/img-promptable-segmentation.ipynb` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "%pip install -qU pixeltable torch transformers"
+    "%pip install -qU pixeltable torch torchvision transformers"
    ]
   },
   {
```

**File**: `docs/release/platform/embedding-indexes.ipynb` (modified, +1/-1)
```diff
@@ -811,7 +811,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "%pip install -qU tensorflow tensorflow-hub tensorflow-text"
+    "%pip install -qU tensorflow tensorflow-hub tensorflow-text 'setuptools<82'"
    ]
   },
   {
```

---

### Incident Patch 8: `90bba6ef` (2026-09-21)
**Commit Message**: Docs: fix what executing every page's code found (#1647)

Docs only. Third documentation pass; the first to **execute the code in
the pages** rather than check that symbols exist.

---------

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `.github/copilot-instructions.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ Roughly 18 of the last 100 PRs drew a maintainer comment about this. It outranks
 | `pixeltable/metadata/` | Migration tests + `tests/data/` + `tool/create_test_db_dump.py` |
 | `tests/data/dbdumps/*-info.toml` | Regenerate the matching `.dump.gz` in the same commit |
 | `pyproject.toml` (deps) | `uv.lock` |
-| The `app.py` example | Its copies in `README.md`, `AGENTS.md`, `docs/release/skill.md`, `quick-start.mdx`, `cloud.mdx` |
+| The `app.py` example | Its copies in `README.md`, `AGENTS.md`, `quick-start.mdx`, `cloud.mdx` |
 
 ## Current API (Citing a Stale One Wastes Review Time)
 
```

**File**: `.github/instructions/docs.instructions.md` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ No CI job checks prose, so review is the only place these are caught.
 
 ## Notebooks
 
-- Exactly one title source: either a raw cell with YAML frontmatter, or a leading H1 that Quarto converts. Flag a notebook carrying both, which renders a double title. Do not flag a leading H1 on its own; 93 of 100 notebooks use one.
+- Exactly one title source: either a raw cell with YAML frontmatter, or a leading H1 that Quarto converts. Flag a notebook carrying both, which renders a double title. Do not flag a leading H1 on its own.
 - Code cells format at line length **74**, not the 120 that applies to `.py` files (`scripts/check-notebooks.sh`).
 - At least 50% of code cells must have outputs (`tool/check_notebooks.py`). Never advise clearing all outputs.
 - Markdown cells must be `nbqa mdformat` clean. Use `raw.githubusercontent.com`, never `raw.github.com`.
-- No badge images in markdown cells. Kaggle/Colab/download links belong in the frontmatter `description`.
+- No hand-written badges or open-in links in notebook cells or frontmatter. The docs build generates Kaggle, Colab, and download links from the notebook path.
 - Schema ops in examples must use `if_exists='ignore'` / `if_not_exists=True`.
 
 ## Accuracy traps
```

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@ guide; `CLAUDE.md` imports it.
 | `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md` | Notebook structure and conversion | Touching `docs/release/**/*.ipynb` |
 | `docs/_guidelines/GUIDELINES_FOR_COOKBOOKS.md` | Cookbook recipe structure | Adding a recipe |
 | `dashboard/DESIGN.md`, `dashboard/ARCHITECTURE.md` | The local dashboard UI | Touching `dashboard/` or its server APIs |
-| `docs/release/skill.md` | The user-facing agent skill | Changing what app builders are told |
+| `docs/release/skill.md` | Pointer to the canonical skill in `pixeltable/pixeltable-skill` | Changing what app builders are told: edit the skill repo, not this file |
 | `CONTRIBUTING.md` | Branching, review, merge process | Opening or merging a PR |
 
 ## Protected Configuration
@@ -375,8 +375,8 @@ order on every sentence added or edited:
 
 Documentation notebooks are in `docs/release/`. Follow `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md`:
 
-- Start with YAML frontmatter in a **Raw cell** (not Markdown)
-- No H1 headers in markdown (title comes from frontmatter)
+- Use one title source: a leading markdown H1, or a first **Raw cell** with YAML `title`
+- Do not include an H1 when using a raw frontmatter title
 - Use `##` for main sections, `###` for subsections
 - Clear outputs before committing unless output is instructive
 - Use `raw.githubusercontent.com` for GitHub raw links
```

**File**: `docs/_guidelines/GUIDELINES_FOR_NOTEBOOKS.md` (modified, +50/-116)
```diff
@@ -6,96 +6,39 @@
 
 ## Overview
 
-These guidelines ensure that Jupyter notebooks convert properly to Mintlify MDX format using Quarto. The conversion process preserves YAML frontmatter and converts markdown/code cells to MDX.
+The docs build converts each notebook to a Mintlify page with Quarto. The page title comes from a
+leading H1 or a raw YAML frontmatter cell. The build adds Kaggle, Colab, and notebook download links;
+do not hand-write them in cells.
 
-## Required: YAML Frontmatter
+## Required: Title in the first cell
 
-Every notebook MUST start with a **raw cell** (not markdown) containing YAML frontmatter.
+Use one title source. By default, start with a **markdown** cell whose first line is the notebook's
+only H1. Quarto converts that H1 to the page title:
 
-### How to Add YAML Frontmatter in Jupyter
-
-1. Insert a new cell at the **very top** of the notebook
-2. Change cell type to **Raw** (not Markdown, not Code)
-   - In Jupyter: Cell → Cell Type → Raw
-   - In JupyterLab: Click cell type dropdown and select "Raw"
-3. Add the YAML frontmatter block
-
-### Exact Frontmatter Template
-
-**This is the exact format to use for every notebook.** Simply replace:
-- `Your Notebook Title` with your notebook's title
-- `path/to/your-notebook.ipynb` with the actual path (e.g., `use-cases/rag-operations.ipynb`)
-
-```yaml
----
-title: "Your Notebook Title"
-icon: "notebook"
-description: "[Open in Kaggle](https://kaggle.com/kernels/welcome?src=https://github.com/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb) | [Open in Colab](https://colab.research.google.com/github/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb) | [View on GitHub](https://github.com/pixeltable/pixeltable/blob/release/docs/release/path/to/your-notebook.ipynb)"
----
-```
-
-**Example for a notebook at `docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb`:**
-
-```yaml
----
-title: "RAG Operations"
-icon: "notebook"
-description: "[Open in Kaggle](https://kaggle.com/kernels/welcome?src=https://github.com/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb) | [Open in Colab](https://colab.research.google.com/github/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb) | [View on GitHub](https://github.com/pixeltable/pixeltable/blob/release/docs/release/howto/cookbooks/agents/pattern-rag-pipeline.ipynb)"
----
-```
-
-### Frontmatter Fields
-
-- **title**: The display title for the notebook page (required)
-  - Use title case (e.g., "Working with OpenAI")
-  - This becomes the H1 heading in the rendered documentation
-- **icon**: Always use `"notebook"` for consistency across all notebooks
-- **description**: Contains three links separated by ` | ` (space-pipe-space)
-  - **Kaggle link**: Opens notebook in Kaggle kernel
-  - **Colab link**: Opens notebook in Google Colab
-  - **GitHub link**: Views notebook source on GitHub
-  - All three links use the `release` branch for stability
-  - Path must be relative to `docs/release/` directory
-
-## Required: Remove H1 Headers from Markdown
-
-**Do NOT use H1 headers (`#`) in markdown cells.** The title comes from the YAML frontmatter.
-
-### ❌ Wrong
-```markdown
-# Pixeltable Basics
-
-Welcome to this tutorial...
-```
-
-### ✅ Correct
 ```markdown
-Welcome to this tutorial...
+# Build a RAG pipeline
 
-## Section Title
-
-Content here...
+Create a retrieval-augmented generation system that answers questions using your documents as context.
 ```
 
-### Header Hierarchy
+Use `##` for sections and `###` for subsections below it. Do not add a second `#` anywhere in the
+notebook.
 
-- **Frontmatter `title`**: Acts as the H1 (page title)
-- **`##` (H2)**: Main sections
-- **`###` (H3)**: Subsections
-- **`####` (H4)**: Sub-subsections
+Alternatively, start with a **raw** cell containing YAML frontmatter with a `title` field, enclosed
+by `---` lines. In that f
```

**File**: `docs/release/howto/cookbooks/text/doc-ingest-website.mdx` (modified, +3/-1)
```diff
@@ -49,7 +49,9 @@ paragraphs produces chunks too small to carry context. `char_limit` gives you pr
 predictable embedding cost, and cuts mid-sentence.
 
 Valid separators are `heading`, `paragraph`, `sentence`, `token_limit`, `char_limit`, and `page`.
-Combine them with a comma, most structural first:
+`sentence` needs `spacy` and its default English model: run `pip install spacy`, then
+`python -m spacy download en_core_web_sm`. `token_limit` needs `pip install tiktoken`.
+Combine separators with a comma, most structural first:
 
 ```python
 iterator=document_splitter(sites.url, separators='heading,token_limit', limit=300)
```

---

### Incident Patch 9: `8a87df74` (2026-09-17)
**Commit Message**: Fix the daemon hijack issue in our cli tests (#1633)

1. Some CLI tests (e.g. `TestShell`) ran pxt from the pytest worker's
working directory, thus restarting the daemon to serve the checkout
instead of the test project. Fixed.
2. Framework hardening: check the identity and root of the daemon on
every health response, regardless of when it runs.

This should fix
https://github.com/pixeltable/pixeltable/actions/runs/35025943378/job/104572953558

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ slimpytest: install
 	    tests/test_{exceptions,exprs,fault_injection,file_cache,function,history,index,iterator,mcp,path}.py \
 	    tests/test_{primary_key_index,query,sample,snapshot,table,table_model,table_model_2,types,view}.py \
 	    tests/serving/test_fastapi.py tests/serving/test_fastapi_models.py \
-	    tests/pixeltable_cli/test_{bridge,schema,service,smoke}.py
+	    tests/pixeltable_cli/test_{bridge,daemon,schema,service,smoke}.py
 
 .PHONY: nbtest
 nbtest: install
```

**File**: `pixeltable_cli/client/utils.py` (modified, +64/-54)
```diff
@@ -75,11 +75,13 @@ def _daemon_log_path() -> str:
 
 
 def read_pidfile() -> int | None:
+    """The PID the daemon recorded, or None if the file is missing or holds no usable one."""
     try:
         with open(pidfile_path(), encoding='utf-8') as f:
-            return int(f.read().strip())
+            pid = int(f.read().strip())
     except (OSError, ValueError):
         return None
+    return pid if pid > 0 else None
 
 
 def fetch_health(timeout: float = 0.3) -> dict[str, Any] | None:
@@ -178,14 +180,15 @@ def _tail_daemon_log(n_lines: int = 10) -> str:
     return '\n'.join(lines[-n_lines:]).rstrip()
 
 
-def _await_health(timeout: float) -> bool:
-    """Poll /api/health until it responds or the timeout elapses. Returns whether it came up."""
+def _await_health(timeout: float) -> dict[str, Any] | None:
+    """Poll /api/health until it responds or the timeout elapses. Returns what it reported, if anything."""
     deadline = time.time() + timeout
     while time.time() < deadline:
-        if is_running():
-            return True
+        health = fetch_health()
+        if health is not None:
+            return health
         time.sleep(0.1)
-    return False
+    return None
 
 
 # A freshly-spawned daemon doesn't serve /api/health until it finishes importing pixeltable, which on a
@@ -195,9 +198,11 @@ def _await_health(timeout: float) -> bool:
 _STARTUP_HEALTH_TIMEOUT_SECS = 45.0
 
 
-def wait_for_health(timeout: float = _STARTUP_HEALTH_TIMEOUT_SECS) -> None:
-    if _await_health(timeout):
-        return
+def wait_for_health(timeout: float = _STARTUP_HEALTH_TIMEOUT_SECS) -> dict[str, Any]:
+    """Wait for the daemon to serve /api/health, and return what it reported. Raises if it never answers."""
+    health = _await_health(timeout)
+    if health is not None:
+        return health
     tail = _tail_daemon_log()
     msg = f'pxt daemon did not come up within {timeout}s'
     if tail != '':
@@ -249,6 +254,7 @@ def _pid_is_our_daemon(pid: int) -> bool:
 
 
 def _pid_alive(pid: int) -> bool:
+    assert pid > 0, pid
     try:
         # signal 0 is the 'are you there?' probe (doesn't kill, just raises if the PID is gone)
         os.kill(pid, 0)
@@ -265,6 +271,7 @@ def _pid_alive(pid: int) -> bool:
 
 
 def kill_and_wait(pid: int, timeout: float = 5.0) -> None:
+    assert pid > 0, pid
     # Wait on the PID itself (not /health) so a hung-but-alive daemon that still holds the
     # listen socket is detected and SIGKILLed; otherwise the next spawn would fail with
     # 'address already in use' because we returned early on the health probe.
@@ -286,60 +293,63 @@ def kill_and_wait(pid: int, timeout: float = 5.0) -> None:
         pass
 
 
+def _restart_if_mismatched(health: dict[str, Any]) -> None:
+    """Replace the daemon that reported health if it belongs to another install, environment or project."""
+    client_identity = identity()
+    diff = _identity_diff(client_identity, health)
+    if _serves_another_project(health):
+        diff = [*diff, 'project_root']
+    if len(diff) == 0:
+        return
+    # Identity mismatch: the daemon was launched against a different install or env snapshot than the
+    # client now sees (eg, after pip install -U pixeltable). Restart it ourselves rather than making
+    # the user do it: a non-None health response means fetch_health() already verified the responder is
+    # our daemon.
+    reported_pid = health.get('pid')
+    # Refuse to target the process if its pid doesn't look real
+    if not isinstance(reported_pid, int) or isinstance(reported_pid, bool) or reported_pid <= 0:
+        raise RuntimeError(f'daemon on port {get_port()} reported an invalid pid ({reported_pid!r}); not restarting it')
+    kill_and_wait(reported_pid)
+    spawn_detached()
+    new_health = wait_for_health()
+    # Cross-verify: the new responder must have a fresh PID and an identity that fully matches the client.
+    # Anything else means the restart did not actually swap in a d
```

**File**: `tests/pixeltable_cli/conftest.py` (modified, +4/-2)
```diff
@@ -156,8 +156,9 @@ def pxt_daemon(
         # The client reports the interpreter behind the pxt script, which need not be spelled the way
         # sys.executable is (python vs python3 in the same environment). ensure_running() restarts a daemon
         # whose identity differs from the caller's and the replacement inherits the caller's environment, so
-        # provoke that restart here, with the environment this fixture started the daemon with.
-        subprocess.run(['pxt', 'ls', '/'], env=env, capture_output=True, check=False, timeout=60)
+        # provoke that restart here, with the environment this fixture started the daemon with, and from the
+        # project this daemon serves: the replacement takes its project from the caller's working directory.
+        subprocess.run(['pxt', 'ls', '/'], env=env, cwd=session_project, capture_output=True, check=False, timeout=60)
         assert is_running()
         print(f'Test daemon is up on port {port}; log at {log_path}', flush=True)
         yield port
@@ -167,6 +168,7 @@ def pxt_daemon(
         subprocess.run(
             ['pxt', 'daemon', 'stop', '-f'],
             env={**os.environ, 'PXT_PORT': str(port)},
+            cwd=session_project,
             capture_output=True,
             check=False,
             timeout=60,
```

**File**: `tests/pixeltable_cli/test_daemon.py` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+"""Tests for how a cli client spawns or adopts its daemon."""
+
+import contextlib
+import json
+import os
+import pathlib
+import signal
+import socket
+import subprocess
+import sys
+from collections.abc import Iterator
+from typing import Any
+
+import psutil
+import pytest
+
+from pixeltable_cli.utils import pidfile_path
+
+_HEALTH_TIMEOUT_SECS = 180.0
+
+
+@pytest.fixture
+def daemon_port(init_env: None) -> Iterator[int]:
+    """Picks an available port to use for a daemon. Runs pxt daemon stop after the test."""
+    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
+        s.bind(('127.0.0.1', 0))
+        port = s.getsockname()[1]
+    yield port
+    subprocess.run(
+        ['pxt', 'daemon', 'stop', '-f'],
+        env={**os.environ, 'PXT_PORT': str(port)},
+        capture_output=True,
+        check=False,
+        timeout=60,
+    )
+
+
+def _create_pxt_project(root: pathlib.Path) -> None:
+    """Creates an empty project at root by placing an empty marker file in it."""
+    root.mkdir()
+    (root / 'pixeltable.toml').write_text('', encoding='utf-8')
+
+
+def _pxt_health(port: int, cwd: pathlib.Path, env_overrides: dict[str, str] | None = None) -> dict[str, Any]:
+    """Runs `pxt health` and returns its parsed json output. If the daemon is not yet running, `pxt health` will start
+    one, and it inherits this environment."""
+    r = subprocess.run(
+        ['pxt', 'health'],
+        env={**os.environ, 'PXT_PORT': str(port), **(env_overrides or {})},
+        cwd=cwd,
+        capture_output=True,
+        text=True,
+        check=False,
+        stdin=subprocess.DEVNULL,
+        timeout=_HEALTH_TIMEOUT_SECS,
+    )
+    assert r.returncode == 0, r.stderr
+    return json.loads(r.stdout)
+
+
+class TestDaemon:
+    def test_replace_another_projects_daemon(self, daemon_port: int, tmp_path: pathlib.Path) -> None:
+        """A client working in one project does not talk to a daemon serving another: it takes that daemon
+        down and starts up the replacement."""
+        project1 = tmp_path / 'first'
+        project2 = tmp_path / 'second'
+        _create_pxt_project(project1)
+        _create_pxt_project(project2)
+
+        health1 = _pxt_health(daemon_port, cwd=project1)
+        assert health1['project_root'] == str(project1)
+        assert psutil.pid_exists(health1['pid'])
+
+        health2 = _pxt_health(daemon_port, cwd=project2)
+        assert health2['project_root'] == str(project2)
+        assert health2['pid'] != health1['pid']
+        assert psutil.pid_exists(health2['pid'])
+        assert not psutil.pid_exists(health1['pid'])
+
+    def test_replace_drifted_identity_daemon(self, daemon_port: int, tmp_path: pathlib.Path) -> None:
+        """A client does not talk to a daemon built from a different environment."""
+        project = tmp_path / 'project'
+        _create_pxt_project(project)
+        drift_env_var = 'PIXELTABLE_TEST_DRIFT'
+
+        health1 = _pxt_health(daemon_port, cwd=project, env_overrides={drift_env_var: '1'})
+        assert drift_env_var in health1['pixeltable_env']
+        assert psutil.pid_exists(health1['pid'])
+
+        health2 = _pxt_health(daemon_port, cwd=project)
+        assert drift_env_var not in health2['pixeltable_env']
+        assert health2['pid'] != health1['pid']
+        assert psutil.pid_exists(health2['pid'])
+        assert not psutil.pid_exists(health1['pid'])
+
+    @pytest.mark.skipif(sys.platform == 'win32', reason='Windows has no SIGSTOP')
+    def test_replace_hung_daemon(self, daemon_port: int, tmp_path: pathlib.Path) -> None:
+        project = tmp_path / 'project'
+        _create_pxt_project(project)
+
+        pid1 = _pxt_health(daemon_port, cwd=project)['pid']
+        pidfile = pathlib.Path(pidfile_path(daemon_port))
+        assert pidfile.read_text(encoding='utf-8').strip() == str(pid1)
+        # SIGSTOP holds the current daemon. The daemon continues to hold the port but doesn't respond on it.
```

**File**: `tests/pixeltable_cli/test_smoke.py` (modified, +4/-1)
```diff
@@ -1371,7 +1371,9 @@ class TestColdStartBudget:
     budget and defeating the daemon split. The `-X importtime` log is authoritative.
     """
 
-    def test_pixeltable_not_imported_by_pxt_ls(self, cli: PxtRunner, pxt_daemon: int) -> None:
+    def test_pixeltable_not_imported_by_pxt_ls(
+        self, cli: PxtRunner, pxt_daemon: int, session_project: pathlib.Path
+    ) -> None:
         # Use sys.executable so the subprocess runs under the same interpreter as the test,
         # not whatever python resolves to on PATH.
         env = {**os.environ, 'PXT_PORT': str(pxt_daemon)}
@@ -1382,6 +1384,7 @@ def test_pixeltable_not_imported_by_pxt_ls(self, cli: PxtRunner, pxt_daemon: int
             env=env,
             check=False,
             stdin=subprocess.DEVNULL,
+            cwd=session_project,
         )
         # We only inspect the import log; the underlying ls call may pass or fail
         # depending on catalog state, which is irrelevant here.
```

---

### Incident Patch 10: `d2ea938b` (2026-09-16)
**Commit Message**: Fix LLM tells in CLI output. (#1636)

**File**: `pixeltable_cli/client/commands/config.py` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 Notes:
   Source 'env' means an environment variable supplies the value.
   A file path means the value came from the config file of this Pixeltable instance.
-  Source 'unset' means neither carries the value; pixeltable falls back to its own default.
+  Source 'unset' means neither supplies the value; pixeltable falls back to its own default.
   Credential values (api_key, api_token, api_secret, auth_token) show '<redacted>' when set;
   use the source field to tell set from unset for sensitive keys.
   The daemon resolves values from the environment it was started with, so credentials in your shell
```

**File**: `pixeltable_cli/client/commands/db.py` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@
   [[pixeltable.database]]
   name = 'pxt://org:db'      # what 'pxt db update pxt://org:db' looks for
 
-The entry says which of the project's files the database gets (include/exclude), what the image
-holds (system_dependencies, python_version), and what the database runs on (cpu, memory_mb,
+The entry says which of the project's files the database gets (include/exclude), what goes into
+the image (system_dependencies, python_version), and what the database runs on (cpu, memory_mb,
 disk_gb, workers). 'diff' compares the entry against the database; 'update' applies the difference.
 
 Exit status of diff and update: 0 in agreement, 2 changes pending, 3 refused, 1 error.
```

**File**: `pixeltable_cli/client/commands/drop.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 Notes:
   Refuses directories; use 'pxt drop-dir' for those.
-  Without --cascade, will fail if dependent views exist (the error names them).
+  Without --cascade, will fail if dependent views exist (the error lists them).
   Without -f, confirmation is read from the terminal; non-interactive callers must pass -f."""
 
 
```

**File**: `pixeltable_cli/client/commands/init.py` (modified, +5/-5)
```diff
@@ -23,10 +23,10 @@
     secrets.openai_api_key = '...'
 
   vars and secrets bind the config vars of a schema. A hosted database is a second entry,
-  named by its uri, which also carries what goes into its image ('pxt db update').
-  In a directory that already holds a pyproject.toml, the same entry is appended there as
+  identified by its uri, which also records what goes into its image ('pxt db update').
+  In a directory with a pyproject.toml, the same entry is appended there as
   [[tool.pixeltable.database]] rather than writing a second file.
-  A directory that already holds a project configuration is reported, and left as it is.
+  A directory that already has a project configuration is reported, and left as it is.
 
 The project root:
   The directory holding the project configuration. Every local module path is relative to it:
@@ -74,7 +74,7 @@ def run(argv: list[str]) -> None:
         return
     if existing is not None:
         print(
-            f'pxt init: {existing.parent} already holds a project configuration ({existing.name}), and '
+            f'pxt init: {existing.parent} already has a project configuration ({existing.name}), and '
             f'{root} sits under it.\nA project has one root, which every module path under it is relative '
             f'to: work under {existing.parent}, or remove {existing.name} to make this directory a root.',
             file=sys.stderr,
@@ -145,7 +145,7 @@ def _report(root: pathlib.Path, config_file: pathlib.Path, *, created: bool, as_
         print(f'project root: {root}\nalready configured by {config_file.name}')
     for name in unusable:
         print(
-            f"pxt init: '{name}' holds Python files, but its name is not a Python identifier, so nothing "
+            f"pxt init: '{name}' contains Python files, but its name is not a Python identifier, so nothing "
             'under it can be imported; rename the directory to use it in this project.',
             file=sys.stderr,
         )
```

**File**: `pixeltable_cli/client/commands/schema.py` (modified, +4/-4)
```diff
@@ -46,7 +46,7 @@ class Titled(TableModel, name='titled', base=Docs.where(Docs.title != '')):
 
 A udf defined here is referenced by this file's path, so moving or renaming the file leaves the columns that
 call it unable to compute.
-Building an application with Pixeltable? The agent skill carries the full API:
+Building an application with Pixeltable? The agent skill covers the full API:
     npx skills add pixeltable/pixeltable-skill
 """
 
@@ -225,10 +225,10 @@ class Sentences(
 
 Notes:
   Checks what the file says on its own: it imports without modifying the catalog, it defines a
-  model base, and every udf its columns call is named by a module path another process resolves.
-  Takes no TARGET and reads no catalog, so it says nothing about what a target already holds;
+  model base, and every udf its columns call has a module path another process resolves.
+  Takes no TARGET and reads no catalog, so it says nothing about what a target already contains;
   'pxt schema diff' answers that.
-  A warning names a project module whose name an installed distribution also answers to: the
+  A warning reports a project module whose name an installed distribution also answers to: the
   project root goes on sys.path after the installed packages, so an import reads the installed one.
 
 {_SCHEMA_FILE}"""
```

#### Recent Merged Pull Requests:
- **PR #1694** (2026-09-30): [PXT-1413] Fix for serving routes with @pxt.query (@aaron-siegel)
- **PR #1693** (2026-09-29): [PXT-1405] Give whisper.transcribe() a TypedDict return type (@aaron-siegel)
- **PR #1692** (2026-09-29): [PXT-1475] Require OpenAI SDK version >= 3 (@aaron-siegel)
- **PR #1689** (2026-09-30): [PXT-1446] Fix Variable handling in aggregate queries (@sergey-mkhitaryan)
- **PR #1685** (closed): [PXT-1446] Fix Variable handling in aggregate queries (@sergey-mkhitaryan)
- **PR #1684** (2026-09-29): [PXT-1438] pxt cli changes that implement a better pxt secret list experience (@sergey-mkhitaryan)
- **PR #1682** (closed): Fetch the project archive of the release a pod was started for (@pierrebrunelle)
- **PR #1681** (closed): Check a route's table schema under the write lock and answer a retryable 409 (@pierrebrunelle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
