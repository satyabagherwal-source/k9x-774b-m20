# Forensic Learning Record (Deep Inspection): bytebase/dbhub

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytebase-dbhub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytebase/dbhub](https://github.com/bytebase/dbhub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:34:09.641Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytebase/dbhub`
- **Description**: Token conscious database MCP server for Postgres, MySQL, SQL Server, Oracle, MariaDB, SQLite.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3586 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/src/App.tsx`
```
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomeRedirect from './components/views/HomeRedirect';
import RequestView from './components/views/RequestView';
import SourceDetailView from './components/views/SourceDetailView';
import ToolDetailView from './components/views/ToolDetailView';
import NotFoundView from './components/views/NotFoundView';
import { ToastProvider, toastManager } from './components/ui/toast';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchSources } from './api/sources';
import { ApiError } from './api/errors';
import type { DataSource } from './types/datasource';

function App() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSources()
      .then((data) => {
        setSources(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch sources:', err);
        const message = err instanceof ApiError ? err.message : 'Failed to load data sources';
        toastManager.add({ title: message, type: 'error' });
        setIsLoading(false);
      });
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout sources={sources} isLoading={isLoading} />}>
              <Route index element={<HomeRedirect />} />
              <Route path="requests" element={<RequestView />} />
              <Route path="source/:sourceId" element={<SourceDetailView />} />
              <Route path="source/:sourceId/tool/:toolName" element={<ToolDetailView />} />
              <Route path="*" element={<NotFoundView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App

```

### Core Architecture Module: `frontend/src/api/errors.ts`
```
/**
 * Custom error class for API-related errors with HTTP status codes
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

```

### Core Architecture Module: `frontend/src/api/requests.ts`
```
import type { RequestsResponse } from '../types/request';
import { ApiError } from './errors';

const API_BASE = '/api';

export async function fetchRequests(sourceId?: string): Promise<RequestsResponse> {
  try {
    const url = sourceId
      ? `${API_BASE}/requests?source_id=${encodeURIComponent(sourceId)}`
      : `${API_BASE}/requests`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorMessage = await response
        .json()
        .then((data) => data.error)
        .catch(() => response.statusText);
      throw new ApiError(`Failed to fetch requests: ${errorMessage}`, response.status, response.statusText);
    }

    return response.json();
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0);
  }
}

```

### Core Architecture Module: `frontend/src/api/sources.ts`
```
import type { DataSource } from '../types/datasource';
import { ApiError } from './errors';

const API_BASE = '/api';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  // Fallback to text if not JSON
  const text = await response.text();
  throw new ApiError(text || response.statusText, response.status, response.statusText);
}

export async function fetchSources(): Promise<DataSource[]> {
  try {
    const response = await fetch(`${API_BASE}/sources`);

    if (!response.ok) {
      const errorMessage = await parseJsonResponse<{ error: string }>(response)
        .then((data) => data.error)
        .catch(() => response.statusText);
      throw new ApiError(`Failed to fetch sources: ${errorMessage}`, response.status, response.statusText);
    }

    return response.json();
  } catch (err) {
    // Ensure all errors are ApiError instances
    if (err instanceof ApiError) {
      throw err;
    }
    // Network errors, timeout, etc.
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0);
  }
}

export async function fetchSource(sourceId: string): Promise<DataSource> {
  try {
    // Validate sourceId to prevent path traversal attacks
    if (!sourceId || sourceId.trim() === '') {
      throw new ApiError('Source ID cannot be empty', 400);
    }
    if (sourceId.includes('/') || sourceId.includes('..')) {
      throw new ApiError('Invalid source ID format', 400);
    }

    const response = await fetch(`${API_BASE}/sources/${encodeURIComponent(sourceId)}`);

    if (!response.ok) {
      const errorMessage = await parseJsonResponse<{ error: string }>(response)
        .then((data) => data.error)
        .catch(() => response.statusText);

      throw new ApiError(
        response.status === 404 ? `Source not found: ${sourceId}` : `Failed to fetch source: ${errorMessage}`,
        response.status,
        response.statusText
      );
    }

    return response.json();
  } catch (err) {
    // Ensure all errors are ApiError instances
    if (err instanceof ApiError) {
      throw err;
    }
    // Network errors, timeout, etc.
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0);
  }
}

```

### Core Architecture Module: `frontend/src/api/tools.ts`
```
import { ApiError } from './errors';
import { generateId } from '../lib/utils';

export interface QueryResult {
  /** Source text of the statement that produced this result, when known. */
  sql?: string;
  columns: string[];
  rows: any[][];
  rowCount: number;
}

interface McpResponse {
  jsonrpc: string;
  id: string;
  result?: {
    content: Array<{ type: string; text: string }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface ToolResultData {
  success: boolean;
  data: {
    statements: Array<{
      sql?: string;
      rows: Record<string, any>[];
      count: number;
    }>;
    source_id: string;
  } | null;
  error: string | null;
}

function toQueryResult(statement: { sql?: string; rows: Record<string, any>[]; count: number }): QueryResult {
  if (statement.rows.length === 0) {
    // For INSERT/UPDATE/DELETE, rows is empty but count reflects affected rows
    return { sql: statement.sql, columns: [], rows: [], rowCount: statement.count };
  }

  const columns = Object.keys(statement.rows[0]);
  const rowArrays = statement.rows.map((row) => columns.map((col) => row[col]));

  return { sql: statement.sql, columns, rows: rowArrays, rowCount: statement.count };
}

/**
 * Executes a tool and returns one `QueryResult` per statement in the batch -
 * a single SELECT (the common case) is an array of length 1, rather than
 * different statements' rows being merged together.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>
): Promise<QueryResult[]> {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: generateId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(`HTTP error: ${response.status}`, response.status);
  }

  // The stateless legacy path (2025-era MCP clients) answers spec-standard
  // SSE framing - a single "data: {...}" event per exchange - rather than a
  // plain JSON body, even though this fetch requests both content types.
  const text = await response.text();
  let mcpResponse: McpResponse;
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    if (!dataLine) {
      throw new ApiError('No data event in SSE response', 500);
    }
    mcpResponse = JSON.parse(dataLine.slice('data: '.length));
  } else {
    mcpResponse = JSON.parse(text);
  }

  if (mcpResponse.error) {
    throw new ApiError(mcpResponse.error.message, mcpResponse.error.code);
  }

  if (!mcpResponse.result?.content?.[0]?.text) {
    throw new ApiError('Invalid response format', 500);
  }

  const toolResult: ToolResultData = JSON.parse(mcpResponse.result.content[0].text);

  if (!toolResult.success || toolResult.error) {
    throw new ApiError(toolResult.error || 'Tool execution failed', 500);
  }

  if (!toolResult.data || !toolResult.data.statements) {
    return [{ columns: [], rows: [], rowCount: 0 }];
  }

  return toolResult.data.statements.map(toQueryResult);
}

```

### Core Architecture Module: `frontend/src/components/ErrorBoundary.tsx`
```
import { Component, ReactNode, ErrorInfo } from 'react';
import { ApiError } from '../api/errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary to catch unexpected errors in the component tree
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const error = this.state.error;
      const isApiError = error instanceof ApiError;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <h1 className="text-2xl font-bold text-destructive mb-4">
                Something went wrong
              </h1>
              <p className="text-destructive/90 mb-4">
                {error.message}
              </p>
              {isApiError && (
                <p className="text-sm text-muted-foreground mb-4">
                  Error code: {error.status}
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

```

### Core Architecture Module: `frontend/src/components/Gutter/Gutter.tsx`
```
import { TooltipProvider } from '@/components/ui/tooltip';
import GutterIcon from './GutterIcon';
import GutterSourceItem from './GutterSourceItem';
import ActivityIcon from '../icons/ActivityIcon';
import HelpIcon from '../icons/HelpIcon';
import type { DataSource } from '../../types/datasource';

interface GutterProps {
  sources: DataSource[];
}

export default function Gutter({ sources }: GutterProps) {
  return (
    <TooltipProvider>
      <aside
        className="w-16 h-screen flex flex-col items-center bg-card pl-2 py-4 pt-6"
        aria-label="Main navigation"
      >
        <div className="w-full flex-1 flex flex-col justify-start items-start overflow-auto">
          {sources.map((source) => (
            <GutterSourceItem key={source.id} source={source} />
          ))}
        </div>
        <div className="w-full flex flex-col gap-2 items-center">
          <GutterIcon icon={<ActivityIcon />} to="/requests" tooltip="Requests" />
          <GutterIcon icon={<HelpIcon />} href="https://dbhub.ai" tooltip="Help" />
        </div>
      </aside>
    </TooltipProvider>
  );
}

```

### Core Architecture Module: `frontend/src/components/Gutter/GutterIcon.tsx`
```
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, TooltipTrigger, TooltipPopup } from '@/components/ui/tooltip';
import { cn } from '../../lib/utils';

interface GutterIconProps {
  icon: React.ReactNode;
  tooltip: string;
  to?: string;
  href?: string;
}

export default function GutterIcon({ icon, tooltip, to, href }: GutterIconProps) {
  const location = useLocation();
  const isActive = to ? location.pathname === to : false;

  const iconButton = (
    <div
      className={cn(
        'w-full h-10 rounded-l-lg p-2 flex items-center justify-center transition-colors',
        isActive && 'bg-accent shadow'
      )}
    >
      {icon}
    </div>
  );

  const wrappedIcon = to ? (
    <Link to={to} aria-label={tooltip}>
      {iconButton}
    </Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={tooltip}>
      {iconButton}
    </a>
  ) : (
    iconButton
  );

  return (
    <Tooltip>
      <TooltipTrigger render={wrappedIcon} />
      <TooltipPopup side="right" sideOffset={8}>
        {tooltip}
      </TooltipPopup>
    </Tooltip>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #323** (2026-06-09): **`search_objects` leaks tables from all databases in MySQL/MariaDB when schema is unspecified**
  *Symptoms*: ## Description  When using the `search_objects` tool with `object_type="table"` (or `"view"`) without specifying a `schema` parameter, the results include tables/views from **all databases** on the MySQL/MariaDB instance, not just the database configured in the DSN.  ## Why this matters for MCP clients  MCP clients (e.g. Claude Desktop, Cursor) only see the tool description and its parameters. They **cannot see the DSN or configuration file** — they have no way to know which database was configured. This means:  1. The AI **cannot** specify the correct `schema` because it doesn't know which one the user configured. 2. Calling `search_objects(object_type="schema")` to discover schemas returns **all databases** on the server, not just the configured one — further misleading the AI. 3. The AI may end up querying or referencing tables from databases the user never intended to expose.  ## Expected behavior  When a DSN specifies a database name (e.g. `mysql://user:pass@host:3306/mydb`), `search_objects` without a `schema` parameter should **default to the configured database only**. Explicit `schema` parameter can still be used to target other databases if the caller intends to.  In other words: **the default scope should match the DSN configuration, not the entire server instance.**  ## Root Cause  In `searchTables()` / `searchViews()` (`src/tools/search-objects.ts`), when no `schema` filter is provided, it falls back to `connector.getSchemas()` to enumerate schemas to search.  Th
  **Post-Mortem & Fix Analysis**:
  > I considered fixing this myself but decided against it. The database name (schema) can originate from multiple configuration sources — DSN string, TOML config file, environment variables, or command-line arguments — and each connector parses it differently. I wasn't confident I could cover all cases without potentially breaking multi-database TOML configurations or other existing behavior. I'll leave the fix to maintainers who have a deeper understanding of the configuration layer.
  > ## Update: Further investigation findings  Did some more digging into the configuration and call chain, here's what I found:  1. All config paths (TOML, env vars, CLI) eventually build a DSN string and parse through SafeURL — so the `database` is always available at the connector level.  2. The issue traces back to the template pattern in `src/tools/search-objects.ts` — when no `schema` param is provided, the code calls `getSchemas()` to get a list, then iterates with `getTables(schemaName)` for each one:  ```typescript // src/tools/search-objects.ts (repeated at lines 169-177, 274-282, 373-381, 462-470, 531-539) let schemasToSearch: string[]; if (schemaFilter) {   schemasToSearch = [schemaFilter]; } else {   schemasToSearch = await connector.getSchemas();  // Returns all databases in MySQL/MariaDB }  for (const schemaName of schemasToSearch) {   const tables = await connector.getTables(schemaName);  // Explicit schema → connector default never runs   // ... } ```  For MySQL/MariaDB, `

- **Issue #303** (2026-04-07): **Cannot find module '@azure/core-client'**
  *Symptoms*: When trying to run the dbhub via ` npx -y @bytebase/dbhub`, I encounter the following error:  ``` Skipping PostgreSQL connector: driver package "pg" not installed. Fatal error: Error: Cannot find module '@azure/core-client' Require stack: - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/client/identityClient.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/msal/nodeFlows/msalClient.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/clientCertificateCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/environmentCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/defaultAzureCredentialFunctions.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/credentials/defaultAzureCredential.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/@azure/identity/dist/commonjs/index.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/tedious/lib/connection.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/tedious/lib/tedious.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/mssql/lib/tedious/connection-pool.js - /Users/matth/.npm/_npx/e23b069b9efbbb8f/node_modules/mssql/lib/tedious/index.js     at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)     at defaultResolveImpl (node

- **Issue #287** (2026-03-28): **@bytebase/dbhub crashes on startup with "Dynamic require of 'fs' is not supported" on Node 20**
  *Symptoms*:  When running @bytebase/dbhub (all versions up to and including 0.20.0) via npx on Node.js 20, the process immediately crashes with the following fatal error before accepting any MCP connections:                                                                                                                     ```   Fatal error: Error: Dynamic require of "fs" is not supported          at file://.../@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:15:9                                                           at node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/lib/database.js       at file://.../@bytebase/dbhub/dist/sqlite-5LT56F5B.js:712:14           ```                                                                                                                                                              Root Cause:                                                                                                                                                                                                                             better-sqlite3 is a CommonJS native addon that uses synchronous require("fs") internally. The @bytebase/dbhub       bundle is compiled as ESM (dist/index.js is ESM). When the ESM bundle tries to load better-sqlite3 at startup,   Node 20's ESM loader rejects the dynamic require() call because dynamic require() of built-in Node modules (like    "fs") is not allowed inside ESM module scope.                                               
  **Post-Mortem & Fix Analysis**:
  > Fatal error: Error: Dynamic require of "events" is not supported     at file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:15:9     at node_modules/.pnpm/pg@8.16.0/node_modules/pg/lib/client.js (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:3716:24)     at __require2 (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:21:50)     at node_modules/.pnpm/pg@8.16.0/node_modules/pg/lib/index.js (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:5022:19)     at __require2 (file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/chunk-WWAWV7DQ.js:21:50)     at file:///Users/xiaohao/.npm/_npx/e23b069b9efbbb8f/node_modules/@bytebase/dbhub/dist/postgres-JB3LPXGR.js:5080:26     at ModuleJob.run (node:internal/modules/esm/module_job:430:25)     at async onImport.t
  > Happens on node v24 as well as 20
  > v22 也出现同样问题

- **Issue #280** (2026-03-27): **dbhub MCP process does not exit on Windows after client closes (stdio transport, launched via npx)**
  *Symptoms*: ### Summary  When using `@bytebase/dbhub` as an MCP server on Windows with `--transport stdio`, the dbhub process tree remains alive after the MCP client closes.  In my case the client is the Codex desktop app on Windows. Other MCP servers launched the same way from the same client, such as `chrome-devtools-mcp` and `@upstash/context7-mcp`, exit correctly when the client is closed. Only dbhub remains running.  This looks like a process leak or an issue handling stdio disconnect / shutdown on Windows.  ---  ### Environment  - OS: Windows 10 - Client: OpenAI Codex desktop app - DBHub MCP launch method: `npx -y @bytebase/dbhub@latest --transport stdio --config <path-to-config>` - Node.js installed locally - MCP transport: `stdio`  ---  ### Expected behavior  After the MCP client exits (or the stdio connection is closed), the dbhub process should exit automatically.  ---  ### Actual behavior  After closing Codex, the dbhub process tree remains alive.  Observed process tree:  - `node.exe` running `npx-cli.js -y @bytebase/dbhub@latest ...` - `cmd.exe /d /s /c dbhub --transport stdio --config ...` - child `node` process running `@bytebase/dbhub/dist/...`  Example:  ```powershell Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'codex' } | Select-Object ProcessId, ParentProcessId, CommandLine  ProcessId ParentProcessId CommandLine --------- --------------- -----------     37628           21580 "C:\Program Files\WindowsApps\OpenAI.Codex_26.313.5234.0_x64__2p2nqsd0c76g0\ap

- **Issue #279** (2026-03-24): **DBHub MCP loses precision for MySQL BIGINT values**
  *Symptoms*: ### Problem  DBHub MCP loses precision when returning large MySQL `BIGINT` values in JSON.  This makes primary keys and related IDs unreliable when they are larger than the JavaScript safe integer range.  ### Reproduction  Run a query that returns 19-digit integer values, for example:  ```sql SELECT id, related_id FROM some_table; ```  Example actual database values: ``` text 2033735037361704962 2033732940612358146 2033732769774161921 ``` DBHub returns values like: ```json [   { "id": 2033735037361705000, "related_id": 2033732940532666400 },   { "id": 2033732940612358100, "related_id": 2033732940532666400 },   { "id": 2033732769774162000, "related_id": 2033732769715441700 } ] ``` ### Expected BIGINT values should be returned exactly, without precision loss.  ### Likely Cause Large MySQL integers appear to be serialized as JavaScript number, which cannot safely represent values beyond Number.MAX_SAFE_INTEGER.

- **Issue #97** (2025-09-29): **Issue with multiple cursor projects open**
  *Symptoms*: **Title:** `dbhub-mssql-stdio` does not allow multiple open cursor instances – only first retains access  **Description:** When attempting to use multiple open cursors with `dbhub-mssql-stdio`, only the first cursor instance retains access to the database. Subsequent cursor instances fail to interact as expected, making it impossible to work with multiple concurrent cursors.  **Steps to Reproduce:**  1. Open a connection via `dbhub-mssql-stdio`. 2. Initialize a cursor and successfully execute queries. 3. Open a second cursor on the same connection. 4. Attempt to execute queries with the second cursor.  **Expected Behavior:** Each open cursor instance should have independent access to the connection, allowing concurrent queries/operations without interference.  **Actual Behavior:** Only the first cursor retains access. Subsequent cursors either fail silently or cannot execute queries.  **Impact:** This limitation prevents applications from managing multiple concurrent queries via cursors, reducing usability in multi-query workflows.  **Environment:**  * `dbhub-mssql-stdio` version: latest * OS: Windows 10 and 11 * SQL Server version: MSSQL  **Additional Context:** If this is a design limitation, documentation should clarify cursor constraints. If unintended, it may require internal state handling fixes to allow multiple concurrent cursor access. 
  **Post-Mortem & Fix Analysis**:
  > I haven't been able to reproduce the issue. Could you please paste the related code?
  > BTW, have you tried to run multiple dbhub instead sharding the same dbhub with multiple cursor instance?
  > this seems to be stable thanks!

- **Issue #14** (2025-04-23): **Azure SQL Database error**
  *Symptoms*: Hey, i am trying to run the docker on windows and trying to connect to an azure sql database using the sqlserver:// dsn but i keep getting this error: ``` Connecting with DSN: sqlserver://sql_db_user:db_user_password@db_server.database.windows.net:1433/db DSN source: command line argument Fatal error: ConnectionError: Login failed for user 'sql_db_user'.     at /app/node_modules/.pnpm/mssql@11.0.1/node_modules/mssql/lib/tedious/connection-pool.js:85:17     at Connection.onConnect (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:849:9)     at Object.onceWrapper (node:events:633:26)     at Connection.emit (node:events:518:28)     at Connection.emit (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:970:18)     at /app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/connection.js:2369:18     at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {   code: 'ELOGIN',   originalError: ConnectionError: Login failed for user 'sql_db_user'.       at Login7TokenHandler.onErrorMessage (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/token/handler.js:186:19)       at Readable.<anonymous> (/app/node_modules/.pnpm/tedious@18.6.1/node_modules/tedious/lib/token/token-stream-parser.js:19:33)       at Readable.emit (node:events:518:28)       at addChunk (node:internal/streams/readable:561:12)       at readableAddChunkPushObjectMode (node:internal/streams/readable:538:3)       at Readabl
  **Post-Mortem & Fix Analysis**:
  > I am experiencing an identical issue. However, If I don't pass through the dbname and only server, then the connection works, the only issue afterwards is to figure out how to traverse available DB's in sqlserver.   2025-04-08 14:32:17.302 [info] cker: Starting new stdio process with command: docker run -i --rm bytebase/dbhub --transport stdio --dsn sqlserver://user******:pass*********@*********.database.windows.net:1433 2025-04-08 14:32:19.973 [info] cker: Successfully connected to stdio server 2025-04-08 14:32:19.973 [info] cker: Storing stdio client 2025-04-08 14:32:19.973 [info] cker: Successfully reloaded client 2025-04-08 14:32:19.974 [info] cker: Handling ListOfferings action 2025-04-08 14:32:19.974 [info] cker: Listing offerings 2025-04-08 14:32:19.974 [info] cker: getOrCreateClient for stdio server.  process.platform: win32 isElectron: true 2025-04-08 14:32:19.975 [info] cker: Reusing existing stdio client 2025-04-08 14:32:19.975 [info] cker: Connected to stdio server, fetchin
  > Fix encrypt conversion in https://github.com/bytebase/dbhub/commit/b2984d312193a8a03692e318880c317eeaa90fc3

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

### Incident Patch 1: `ca14e7a8` (2026-09-21)
**Commit Message**: fix: reload AWS credentials from disk on every RDS IAM token refresh (#438)

The AWS SDK caches the contents of ~/.aws/credentials and ~/.aws/config
in a module-level map for the lifetime of the process. DBHub regenerates
the RDS IAM auth token every ~14 minutes with a fresh fromIni() call, but
that call hits the cache, so credentials rotated externally (e.g. refreshed
STS credentials written by a sidecar) were never picked up and auth
eventually failed with "PAM authentication failed" until restart.

Pass ignoreCache: true to fromIni() and, when no aws_profile is set, to an
explicit fromNodeProviderChain() so the default chain's ini step also
re-reads the files.

Fixes #437


Claude-Session: https://claude.ai/code/session_01FyVzpWXWC2fW5FK3PjtNXJ

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `src/utils/__tests__/aws-rds-signer.test.ts` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@ const signerMocks = vi.hoisted(() => ({
 }));
 const credentialProviderMocks = vi.hoisted(() => ({
   fromIni: vi.fn(),
+  fromNodeProviderChain: vi.fn(),
 }));
 
 vi.mock('@aws-sdk/rds-signer', () => {
@@ -25,6 +26,7 @@ vi.mock('@aws-sdk/rds-signer', () => {
 
 vi.mock('@aws-sdk/credential-providers', () => ({
   fromIni: credentialProviderMocks.fromIni,
+  fromNodeProviderChain: credentialProviderMocks.fromNodeProviderChain,
 }));
 
 describe('generateRdsAuthToken', () => {
@@ -47,7 +49,9 @@ describe('generateRdsAuthToken', () => {
 
     expect(credentialProviderMocks.fromIni).toHaveBeenCalledWith({
       profile: 'ngqa',
+      ignoreCache: true,
     });
+    expect(credentialProviderMocks.fromNodeProviderChain).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.us-east-1.rds.amazonaws.com',
       port: 5432,
@@ -57,7 +61,9 @@ describe('generateRdsAuthToken', () => {
     });
   });
 
-  it('should create signer with expected params and return token', async () => {
+  it('should use the default provider chain with the file cache disabled when no profile is set', async () => {
+    const chainCredentials = vi.fn();
+    credentialProviderMocks.fromNodeProviderChain.mockReturnValue(chainCredentials);
     signerMocks.getAuthToken.mockResolvedValue('iam-token');
 
     const token = await generateRdsAuthToken({
@@ -67,11 +73,16 @@ describe('generateRdsAuthToken', () => {
       region: 'eu-west-1',
     });
 
+    expect(credentialProviderMocks.fromNodeProviderChain).toHaveBeenCalledWith({
+      ignoreCache: true,
+    });
+    expect(credentialProviderMocks.fromIni).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.eu-west-1.rds.amazonaws.com',
       port: 3306,
       username: 'dbuser@example.com',
       region: 'eu-west-1',
+      credentials: chainCredentials,
     });
     expect(signerMocks.getAuthToken).toHaveBeenCalledTimes(1);
     expect(token).toBe('iam-token');
```

**File**: `src/utils/aws-rds-signer.ts` (modified, +12/-5)
```diff
@@ -11,7 +11,14 @@ export interface RdsAuthTokenParams {
 /**
  * Generate an AWS RDS IAM auth token for database authentication.
  * Uses the named shared-config profile when provided; otherwise the AWS SDK
- * uses its default credential provider chain.
+ * default credential provider chain.
+ *
+ * Both providers are created with `ignoreCache: true`. The SDK caches the
+ * contents of `~/.aws/credentials` and `~/.aws/config` in a module-level map
+ * for the lifetime of the process, so a long-running DBHub would otherwise keep
+ * signing with the credentials it read at startup and never notice that the
+ * files were rotated externally (e.g. refreshed STS credentials). Tokens are
+ * regenerated every ~14 minutes, so the extra file read is negligible.
  */
 export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<string> {
   let Signer: typeof import("@aws-sdk/rds-signer")["Signer"];
@@ -33,10 +40,10 @@ export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<
     region: params.region,
   };
 
-  if (params.profile) {
-    const { fromIni } = await import("@aws-sdk/credential-providers");
-    signerConfig.credentials = fromIni({ profile: params.profile });
-  }
+  const { fromIni, fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
+  signerConfig.credentials = params.profile
+    ? fromIni({ profile: params.profile, ignoreCache: true })
+    : fromNodeProviderChain({ ignoreCache: true });
 
   const signer = new Signer(signerConfig);
 
```

---

### Incident Patch 2: `9a0fe437` (2026-09-21)
**Commit Message**: fix: reload AWS credentials from disk on every RDS IAM token refresh

The AWS SDK caches the contents of ~/.aws/credentials and ~/.aws/config
in a module-level map for the lifetime of the process. DBHub regenerates
the RDS IAM auth token every ~14 minutes with a fresh fromIni() call, but
that call hits the cache, so credentials rotated externally (e.g. refreshed
STS credentials written by a sidecar) were never picked up and auth
eventually failed with "PAM authentication failed" until restart.

Pass ignoreCache: true to fromIni() and, when no aws_profile is set, to an
explicit fromNodeProviderChain() so the default chain's ini step also
re-reads the files.

Fixes #437

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FyVzpWXWC2fW5FK3PjtNXJ

**File**: `src/utils/__tests__/aws-rds-signer.test.ts` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@ const signerMocks = vi.hoisted(() => ({
 }));
 const credentialProviderMocks = vi.hoisted(() => ({
   fromIni: vi.fn(),
+  fromNodeProviderChain: vi.fn(),
 }));
 
 vi.mock('@aws-sdk/rds-signer', () => {
@@ -25,6 +26,7 @@ vi.mock('@aws-sdk/rds-signer', () => {
 
 vi.mock('@aws-sdk/credential-providers', () => ({
   fromIni: credentialProviderMocks.fromIni,
+  fromNodeProviderChain: credentialProviderMocks.fromNodeProviderChain,
 }));
 
 describe('generateRdsAuthToken', () => {
@@ -47,7 +49,9 @@ describe('generateRdsAuthToken', () => {
 
     expect(credentialProviderMocks.fromIni).toHaveBeenCalledWith({
       profile: 'ngqa',
+      ignoreCache: true,
     });
+    expect(credentialProviderMocks.fromNodeProviderChain).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.us-east-1.rds.amazonaws.com',
       port: 5432,
@@ -57,7 +61,9 @@ describe('generateRdsAuthToken', () => {
     });
   });
 
-  it('should create signer with expected params and return token', async () => {
+  it('should use the default provider chain with the file cache disabled when no profile is set', async () => {
+    const chainCredentials = vi.fn();
+    credentialProviderMocks.fromNodeProviderChain.mockReturnValue(chainCredentials);
     signerMocks.getAuthToken.mockResolvedValue('iam-token');
 
     const token = await generateRdsAuthToken({
@@ -67,11 +73,16 @@ describe('generateRdsAuthToken', () => {
       region: 'eu-west-1',
     });
 
+    expect(credentialProviderMocks.fromNodeProviderChain).toHaveBeenCalledWith({
+      ignoreCache: true,
+    });
+    expect(credentialProviderMocks.fromIni).not.toHaveBeenCalled();
     expect(signerMocks.constructor).toHaveBeenCalledWith({
       hostname: 'mydb.abc123.eu-west-1.rds.amazonaws.com',
       port: 3306,
       username: 'dbuser@example.com',
       region: 'eu-west-1',
+      credentials: chainCredentials,
     });
     expect(signerMocks.getAuthToken).toHaveBeenCalledTimes(1);
     expect(token).toBe('iam-token');
```

**File**: `src/utils/aws-rds-signer.ts` (modified, +12/-5)
```diff
@@ -11,7 +11,14 @@ export interface RdsAuthTokenParams {
 /**
  * Generate an AWS RDS IAM auth token for database authentication.
  * Uses the named shared-config profile when provided; otherwise the AWS SDK
- * uses its default credential provider chain.
+ * default credential provider chain.
+ *
+ * Both providers are created with `ignoreCache: true`. The SDK caches the
+ * contents of `~/.aws/credentials` and `~/.aws/config` in a module-level map
+ * for the lifetime of the process, so a long-running DBHub would otherwise keep
+ * signing with the credentials it read at startup and never notice that the
+ * files were rotated externally (e.g. refreshed STS credentials). Tokens are
+ * regenerated every ~14 minutes, so the extra file read is negligible.
  */
 export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<string> {
   let Signer: typeof import("@aws-sdk/rds-signer")["Signer"];
@@ -33,10 +40,10 @@ export async function generateRdsAuthToken(params: RdsAuthTokenParams): Promise<
     region: params.region,
   };
 
-  if (params.profile) {
-    const { fromIni } = await import("@aws-sdk/credential-providers");
-    signerConfig.credentials = fromIni({ profile: params.profile });
-  }
+  const { fromIni, fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
+  signerConfig.credentials = params.profile
+    ? fromIni({ profile: params.profile, ignoreCache: true })
+    : fromNodeProviderChain({ ignoreCache: true });
 
   const signer = new Signer(signerConfig);
 
```

---

### Incident Patch 3: `8cbf8798` (2026-09-19)
**Commit Message**: fix: keep server.json description within the MCP Registry's 100-char limit

Adding Oracle pushed the description to 103 characters and the
registry rejected the 1.3.0 publish (HTTP 422, "expected length <=
100"); npm had already published. Shorten to 94 characters in
server.json and package.json, and add a consistency test so the limit
is checked in CI rather than discovered post-merge by the release job.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0189BHv585xi8iqEp9JvmgKY

**File**: `package.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "name": "dbhub",
   "version": "1.3.0",
   "mcpName": "io.github.bytebase/dbhub",
-  "description": "Minimal, token-efficient Database MCP Server for PostgreSQL, MySQL, SQL Server, Oracle, SQLite, MariaDB",
+  "description": "Token-efficient database MCP server for PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite",
   "repository": {
     "type": "git",
     "url": "https://github.com/bytebase/dbhub.git"
```

**File**: `server.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
   "name": "io.github.bytebase/dbhub",
   "title": "DBHub",
-  "description": "Minimal, token-efficient Database MCP Server for PostgreSQL, MySQL, SQL Server, Oracle, SQLite, MariaDB",
+  "description": "Token-efficient database MCP server for PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite",
   "repository": {
     "url": "https://github.com/bytebase/dbhub",
     "source": "github"
```

**File**: `src/__tests__/plugin-consistency.test.ts` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ describe("Claude Code plugin consistency", () => {
     expect(mcp.mcpServers.dbhub.args).toContain(`@bytebase/dbhub@${pkg.version}`);
   });
 
+  it("server.json description fits the MCP Registry's 100-character limit", () => {
+    // The registry rejects the publish (HTTP 422) when the description is
+    // longer than 100 characters, which is only discovered post-merge when
+    // the release workflow runs.
+    const server = readJson("server.json");
+    expect(server.description.length).toBeLessThanOrEqual(100);
+  });
+
   it("server.json version matches package.json", () => {
     const server = readJson("server.json");
     expect(server.version).toBe(pkg.version);
```

---

### Incident Patch 4: `54255bd8` (2026-09-19)
**Commit Message**: fix: never echo a raw DSN in redaction fallbacks or the invalid-DSN error (#431)

* fix: never echo a raw DSN in redaction fallbacks or the invalid-DSN error

resolveSourceConfigs() interpolated the raw DSN into the "Invalid DSN
format" error, so a scheme-less value such as user:secret@host/db printed
its password to stderr at startup. redactDSN() and obfuscateDSNPassword()
also returned the original string whenever parsing failed, leaking the
same way through connector-manager startup logs and the missing-database
error.

obfuscateDSNPassword() now fails closed and returns a constant
"<redacted DSN>" placeholder when the DSN cannot be parsed. redactDSN()
delegates to it instead of using the native URL parser plus a regex
fallback, and the invalid-DSN error goes through redactDSN(). Tests cover
scheme-less input and passwords containing "@" and "#".

Fixes #430

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NkRzQr9wiSyESV8F8j8ja9

* fix: withhold DSNs whose authority parses a credential into the port

SafeURL only treats the authority as credentials when it contains an
'@'. Without one, "postgres://user:secret/db" parses a

**File**: `src/config/__tests__/env.test.ts` (modified, +44/-1)
```diff
@@ -2,7 +2,7 @@ import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 import fs from 'fs';
 import os from 'os';
 import path from 'path';
-import { buildDSNFromEnvParams, resolveDSN, resolveHost, resolveId } from '../env.js';
+import { buildDSNFromEnvParams, redactDSN, resolveDSN, resolveHost, resolveId } from '../env.js';
 import { loadTomlConfig } from '../toml-loader.js';
 
 // Mock toml-loader to prevent it from loading dbhub.toml during tests
@@ -353,6 +353,49 @@ describe('Environment Configuration Tests', () => {
       expect(result!.sources[0].type).toBe('postgres');
       expect(result!.sources[0].dsn).toBe('postgres://user:my@pass:word@localhost:5432/testdb');
     });
+
+    it('should not leak the password when the DSN is malformed', async () => {
+      // A scheme-less DSN fails SafeURL parsing; the resulting fatal error is
+      // printed to stderr, so the raw value must never be interpolated into it.
+      process.argv = ['node', 'script.js', '--dsn=user:hunter2@localhost/db'];
+
+      const { resolveSourceConfigs } = await import('../env.js');
+      let message = '';
+      try {
+        await resolveSourceConfigs();
+      } catch (error) {
+        message = (error as Error).message;
+      }
+
+      expect(message).toMatch(/Invalid DSN format/);
+      expect(message).toContain('<redacted DSN>');
+      expect(message).not.toContain('hunter2');
+    });
+  });
+
+  describe('redactDSN', () => {
+    it('should replace the password with asterisks', () => {
+      const result = redactDSN('postgres://user:hunter2@localhost:5432/db');
+      expect(result).not.toContain('hunter2');
+      expect(result).toMatch(/^postgres:\/\/user:\*+@localhost:5432\/db$/);
+    });
+
+    it('should redact passwords containing @ or #', () => {
+      for (const password of ['p@ss', 'pa#ss', 'p@s#s@']) {
+        const result = redactDSN(`postgres://user:${password}@localhost:5432/db`);
+        expect(result).not.toContain(password);
+        expect(result).toMatch(/^postgres:\/\/user:\*+@localhost:5432\/db$/);
+      }
+    });
+
+    it('should fail closed on a scheme-less DSN', () => {
+      const result = redactDSN('user:hunter2@localhost/db');
+      expect(result).toBe('<redacted DSN>');
+    });
+
+    it('should leave SQLite DSNs untouched', () => {
+      expect(redactDSN('sqlite:///path/to/db.sqlite')).toBe('sqlite:///path/to/db.sqlite');
+    });
   });
 
   describe('resolveId', () => {
```

**File**: `src/config/env.ts` (modified, +5/-18)
```diff
@@ -7,7 +7,7 @@ import type { SSHTunnelConfig } from "../types/ssh.js";
 import { parseSSHConfig, looksLikeSSHAlias, getDefaultSSHConfigPath } from "../utils/ssh-config-parser.js";
 import type { SourceConfig } from "../types/config.js";
 import { loadTomlConfig } from "./toml-loader.js";
-import { parseConnectionInfoFromDSN } from "../utils/dsn-obfuscate.js";
+import { obfuscateDSNPassword, parseConnectionInfoFromDSN } from "../utils/dsn-obfuscate.js";
 import { SafeURL } from "../utils/safe-url.js";
 
 // Create __dirname equivalent for ES modules
@@ -509,26 +509,13 @@ function splitTokenList(value: string): string[] {
 
 /**
  * Redact sensitive information from a DSN string
- * Replaces the password with asterisks
+ * Replaces the password with asterisks; returns a constant placeholder if the
+ * DSN cannot be parsed, so a malformed DSN never leaks its password.
  * @param dsn - The DSN string to redact
  * @returns The sanitized DSN string
  */
 export function redactDSN(dsn: string): string {
-  try {
-    // Create a URL object to parse the DSN
-    const url = new URL(dsn);
-
-    // Replace the password with asterisks
-    if (url.password) {
-      url.password = "*******";
-    }
-
-    // Return the sanitized DSN
-    return url.toString();
-  } catch (error) {
-    // If parsing fails, do basic redaction with regex
-    return dsn.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
-  }
+  return obfuscateDSNPassword(dsn);
 }
 
 /**
@@ -763,7 +750,7 @@ export async function resolveSourceConfigs(): Promise<{ sources: SourceConfig[];
       dsnUrl = new SafeURL(dsnResult.dsn);
     } catch (error) {
       throw new Error(
-        `Invalid DSN format: ${dsnResult.dsn}. Expected format: protocol://[user[:password]@]host[:port]/database`
+        `Invalid DSN format: ${redactDSN(dsnResult.dsn)}. Expected format: protocol://[user[:password]@]host[:port]/database`
       );
     }
 
```

**File**: `src/utils/__tests__/dsn-obfuscate.test.ts` (modified, +39/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, it, expect } from 'vitest';
 import {
   obfuscateDSNPassword,
+  REDACTED_DSN,
   obfuscateSSHConfig,
   getDatabaseTypeFromDSN,
   parseConnectionInfoFromDSN,
@@ -78,6 +79,44 @@ describe('DSN Obfuscation Utilities', () => {
       expect(result).toBe('postgres://user:*****@localhost:5432/db');
       expect(result).not.toContain('ss@');
     });
+
+    it('should obfuscate the whole password when it contains a #', () => {
+      const dsn = 'postgres://user:pa#ss@localhost:5432/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe('postgres://user:*****@localhost:5432/db');
+      expect(result).not.toContain('pa#ss');
+    });
+
+    it('should fail closed on a scheme-less DSN instead of echoing it', () => {
+      // SafeURL rejects input without "://", so nothing can be parsed out of
+      // it — but it may still carry a password, so the original must not
+      // be returned.
+      const dsn = 'user:hunter2@localhost/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe(REDACTED_DSN);
+      expect(result).not.toContain('hunter2');
+    });
+
+    it('should fail closed when the authority has no @ and a credential lands in the port', () => {
+      // "user:secret" without a host parses as host "user", port "secret",
+      // so there is no password field to mask — the whole string must be
+      // withheld instead.
+      for (const dsn of ['postgres://user:secret/db', 'postgres://user:secret?sslmode=require']) {
+        const result = obfuscateDSNPassword(dsn);
+
+        expect(result).toBe(REDACTED_DSN);
+        expect(result).not.toContain('secret');
+      }
+    });
+
+    it('should still obfuscate a DSN with an unknown scheme', () => {
+      const dsn = 'oracle://user:hunter2@localhost:1521/db';
+      const result = obfuscateDSNPassword(dsn);
+
+      expect(result).toBe('oracle://user:*******@localhost:1521/db');
+    });
   });
 
   describe('obfuscateSSHConfig', () => {
```

**File**: `src/utils/dsn-obfuscate.ts` (modified, +20/-3)
```diff
@@ -84,7 +84,16 @@ export function parseConnectionInfoFromDSN(dsn: string): ParsedConnectionInfo |
 }
 
 /**
- * Obfuscates the password in a DSN string for logging purposes
+ * Placeholder returned in place of a DSN that could not be parsed.
+ * Unparseable input (e.g. a scheme-less "user:pass@host/db") may still carry a
+ * password, so the original string is never echoed back.
+ */
+export const REDACTED_DSN = '<redacted DSN>';
+
+/**
+ * Obfuscates the password in a DSN string for logging purposes.
+ * Fails closed: if the DSN cannot be parsed, returns REDACTED_DSN rather than
+ * the original string.
  * @param dsn The original DSN string
  * @returns DSN string with password replaced by asterisks
  */
@@ -104,6 +113,14 @@ export function obfuscateDSNPassword(dsn: string): string {
     // Parse DSN using SafeURL
     const url = new SafeURL(dsn);
 
+    // A DSN whose authority lacks an '@' (e.g. "postgres://user:secret/db")
+    // parses with "user" as the host and "secret" as the port. A real port is
+    // always numeric, so treat anything else as unparseable rather than
+    // echoing what is likely a credential.
+    if (url.port && !/^\d+$/.test(url.port)) {
+      return REDACTED_DSN;
+    }
+
     // No password to obfuscate
     if (!url.password) {
       return dsn;
@@ -135,8 +152,8 @@ export function obfuscateDSNPassword(dsn: string): string {
 
     return result;
   } catch {
-    // If parsing fails, return original DSN
-    return dsn;
+    // Fail closed: an unparseable DSN may still contain a password
+    return REDACTED_DSN;
   }
 }
 
```

---

### Incident Patch 5: `80b87cb7` (2026-09-18)
**Commit Message**: docs: fix Docker Compose example Postgres user and bump image to 18

The Compose snippet's DSN logs in as role `user`, but the database
service never set POSTGRES_USER, so the official image created
`postgres` instead and the connection failed with "role user does not
exist". Set POSTGRES_USER to match the DSN, add ?sslmode=disable to
align with the docker run examples on the same page, and bump the image
to postgres:18-alpine (no volume is mounted, so the PG18 data path
change does not apply).

Fixes #428

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014B59SV2cafS1ptCTyBxGey

**File**: `docs/installation.mdx` (modified, +3/-2)
```diff
@@ -118,13 +118,14 @@ The [Claude Code Plugin](/claude-code-plugin) registers the DBHub MCP server in
           - --port
           - "8080"
           - --dsn
-          - "postgres://user:password@database:5432/dbname"
+          - "postgres://user:password@database:5432/dbname?sslmode=disable"
         depends_on:
           - database
 
       database:
-        image: postgres:15-alpine
+        image: postgres:18-alpine
         environment:
+          POSTGRES_USER: user
           POSTGRES_PASSWORD: password
           POSTGRES_DB: dbname
     ```
```

---

### Incident Patch 6: `2a0f0657` (2026-09-18)
**Commit Message**: fix: apply max_rows to comment-prefixed and CTE queries (#429)

* fix: apply max_rows to comment-prefixed and CTE queries

isSelectQuery classified on the raw text, so any statement not opening
with a bare SELECT (a leading `--` or `/* */` comment, a WITH ... SELECT
CTE, a parenthesised set operation) got no LIMIT at all, while the
read-only classifier strips comments first and let those statements
through. Classify on the comment-blanked text and treat a leading WITH
as row-returning unless it embeds a data-modifying CTE, reusing the
read-only classifier's mutating-keyword heuristic.

Enabling CTEs exposed that every LIMIT/TOP helper matched the first
clause found textually, which on a CTE is the inner one: the CTE's own
LIMIT would be tightened and the statement left uncapped. The helpers
now scan with the existing parenthesis-depth tracking and reason only
about the statement's own clause, which also fixes the same hole for
plain subqueries and keeps the truncation probe from mistaking a nested
LIMIT/TOP for a user cap already within max_rows. On SQL Server, TOP
lands on the statement's own SELECT, and a leading CTE stays outside
the derived table when a set operation forces the

**File**: `src/connectors/__tests__/mysql.integration.test.ts` (modified, +16/-18)
```diff
@@ -396,24 +396,22 @@ describe('MySQL Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
-      try {
-        const result = await mysqlTest.connector.executeSQL(`
-          WITH user_summary AS (
-            SELECT name, age FROM users WHERE age IS NOT NULL
-          )
-          SELECT * FROM user_summary ORDER BY age
-        `, { maxRows: 2 });
-        
-        // Should return all rows since WITH queries are not limited
-        expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
-        expect(result.resultSets[0].rows[0]).toHaveProperty('name');
-        expect(result.resultSets[0].rows[0]).toHaveProperty('age');
-      } catch (error) {
-        // Some MySQL versions might not support CTE, that's okay
-        console.log('CTE not supported in this MySQL version, skipping test');
-      }
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
+      // No try/catch: the test container runs MySQL 8, which supports CTEs,
+      // and a catch-all would swallow the assertions too.
+      const result = await mysqlTest.connector.executeSQL(`
+        WITH user_summary AS (
+          SELECT name, age FROM users WHERE age IS NOT NULL
+        )
+        SELECT * FROM user_summary ORDER BY age
+      `, { maxRows: 2 });
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+      expect(result.resultSets[0].rows[0]).toHaveProperty('name');
+      expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
 
     it('should handle maxRows with multiple SELECT statements', async () => {
```

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +47/-4)
```diff
@@ -580,21 +580,64 @@ describe('PostgreSQL Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
       const result = await postgresTest.connector.executeSQL(`
         WITH user_summary AS (
           SELECT name, age FROM users WHERE age IS NOT NULL
         )
         SELECT * FROM user_summary ORDER BY age
       `, { maxRows: 2 });
       
-      // Should return all rows since WITH queries are not limited anymore
-      expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
       expect(result.resultSets[0].rows[0]).toHaveProperty('name');
       expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
 
+    it('should apply maxRows to a query introduced by a comment', async () => {
+      const result = await postgresTest.connector.executeSQL(
+        '-- dbhub attribution tag\nSELECT name FROM users ORDER BY name',
+        { maxRows: 2 }
+      );
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it("should cap the statement itself rather than tightening a CTE's own LIMIT", async () => {
+      // The inner LIMIT caps only the CTE; the statement can still return more
+      // rows than that, so it needs a cap of its own.
+      const result = await postgresTest.connector.executeSQL(`
+        WITH first_three AS (
+          SELECT name FROM users ORDER BY name LIMIT 3
+        )
+        SELECT * FROM first_three
+      `, { maxRows: 2 });
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it('should not apply maxRows to a data-modifying CTE', async () => {
+      const result = await postgresTest.connector.executeSQL(`
+        WITH inserted AS (
+          INSERT INTO users (name, email, age)
+          VALUES ('dm1', 'dm1@dm.com', 41), ('dm2', 'dm2@dm.com', 42), ('dm3', 'dm3@dm.com', 43)
+          RETURNING id, name
+        )
+        SELECT * FROM inserted
+      `, { maxRows: 2 });
+
+      // A LIMIT here would cap the rows handed back while all three rows were
+      // still written: a cap that isn't one.
+      expect(result.resultSets[0].rows).toHaveLength(3);
+      expect(result.resultSets[0].truncated).toBeFalsy();
+
+      await postgresTest.connector.executeSQL("DELETE FROM users WHERE email LIKE '%@dm.com'", {});
+    });
+
     it('should handle maxRows in multi-statement execution with transactions', async () => {
       // Test maxRows with multiple statements where some are SELECT
       const result = await postgresTest.connector.executeSQL(`
```

**File**: `src/connectors/__tests__/sqlite.integration.test.ts` (modified, +17/-4)
```diff
@@ -440,17 +440,30 @@ describe('SQLite Connector Integration Tests', () => {
       expect(result.resultSets[0].rows[0]).toHaveProperty('total');
     });
 
-    it('should not apply maxRows to CTE queries (WITH clause)', async () => {
-      // Test that maxRows is not applied to CTE queries (WITH clause)
+    it('should return rows and apply maxRows to a query introduced by a comment', async () => {
+      // SQLite picks all() vs run() by leading keyword; a leading comment
+      // used to send a SELECT down the run() path and discard its rows.
+      const result = await sqliteTest.connector.executeSQL(
+        '-- dbhub attribution tag\nSELECT name FROM users ORDER BY name',
+        { maxRows: 2 }
+      );
+
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
+    });
+
+    it('should apply maxRows to CTE queries (WITH clause)', async () => {
+      // A CTE is the ordinary shape of an analytical query, so leaving it
+      // uncapped left max_rows silently inert for most real queries.
       const result = await sqliteTest.connector.executeSQL(`
         WITH user_summary AS (
           SELECT name, age FROM users WHERE age IS NOT NULL
         )
         SELECT * FROM user_summary ORDER BY age
       `, { maxRows: 2 });
       
-      // Should return all rows since WITH queries are not limited anymore
-      expect(result.resultSets[0].rows.length).toBeGreaterThan(2);
+      expect(result.resultSets[0].rows).toHaveLength(2);
+      expect(result.resultSets[0].truncated).toBe(true);
       expect(result.resultSets[0].rows[0]).toHaveProperty('name');
       expect(result.resultSets[0].rows[0]).toHaveProperty('age');
     });
```

**File**: `src/connectors/mariadb/index.ts` (modified, +1/-1)
```diff
@@ -671,7 +671,7 @@ export class MariaDBConnector implements Connector {
           let probes: boolean[] = [];
           if (options.maxRows) {
             const rewrites = statements.map(statement =>
-              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows)
+              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows, "mariadb")
             );
             probes = rewrites.map(rewrite => rewrite.probeApplied);
 
```

**File**: `src/connectors/mysql/index.ts` (modified, +1/-1)
```diff
@@ -687,7 +687,7 @@ export class MySQLConnector implements Connector {
           let probes: boolean[] = [];
           if (options.maxRows) {
             const rewrites = statements.map(statement =>
-              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows)
+              SQLRowLimiter.applyMaxRowsWithTruncationProbe(statement, options.maxRows, "mysql")
             );
             probes = rewrites.map(rewrite => rewrite.probeApplied);
 
```

---

### Incident Patch 7: `6a62a634` (2026-09-15)
**Commit Message**: Fix: close the SSH tunnel when a source's database connection fails

connectSource stored the tunnel before connecting the database. When that
connect failed, the tunnel stayed open and in sshTunnels, and each retry
(lazy connection, or a source handed back for reconnection after a failed
IAM refresh) opened a new tunnel and orphaned the previous one's SSH
clients and local listener. Close and drop the tunnel created in the
failed attempt before rethrowing.

Also assert in the IAM refresh test that no timer is left armed after a
failed refresh, which is what distinguishes the fixed behavior from the
old guard-and-re-arm loop.

Addresses review feedback on #425.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013UHUe6p1FxKHamwpDjyfoM

**File**: `src/connectors/__tests__/manager.test.ts` (modified, +46/-2)
```diff
@@ -293,14 +293,58 @@ describe("ConnectorManager IAM refresh recovery", () => {
     await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
     expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
 
-    // No further ticks: reconnection is driven by the next tool call, not a timer that
-    // would otherwise fire every 14 minutes and return at the guard.
+    // The timer must not be re-armed for a source that is no longer connected. (The
+    // previous implementation re-armed here and then returned at the guard on every
+    // later tick, so the token call count alone cannot tell the two apart.)
+    expect(vi.getTimerCount()).toBe(0);
+
+    // No further ticks: reconnection is driven by the next tool call.
     await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS * 3);
     expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
 
     await manager.disconnect();
   });
 
+  it("should close the SSH tunnel when the database connection fails so a retry does not leak it", async () => {
+    const instances = stubConnectorRegistry();
+    mocks.looksLikeSSHAlias.mockReturnValue(false);
+    const establishSpy = vi
+      .spyOn(SSHTunnel.prototype, "establish")
+      .mockResolvedValue({ localPort: 55555, targetHost: "db.internal", targetPort: 5432 });
+    const closeSpy = vi.spyOn(SSHTunnel.prototype, "close").mockResolvedValue(undefined);
+    const prototype = ConnectorRegistry.getConnectorForDSN("postgres://x") as any;
+    const originalClone = prototype.clone;
+    prototype.clone = () => {
+      const instance = originalClone();
+      instance.connect.mockRejectedValue(new Error("password authentication failed"));
+      return instance;
+    };
+
+    const manager = new ConnectorManager();
+    const source: SourceConfig = {
+      id: "pg_ssh",
+      type: "postgres",
+      dsn: "postgres://user:pass@db.internal:5432/mydb",
+      ssh_host: "bastion.example.com",
+      ssh_user: "ubuntu",
+      ssh_password: "secret",
+      lazy: true,
+    };
+    await manager.connectWithSources([source]);
+
+    await expect(manager.ensureConnected("pg_ssh")).rejects.toThrow("password authentication failed");
+    expect(establishSpy).toHaveBeenCalledTimes(1);
+    expect(closeSpy).toHaveBeenCalledTimes(1);
+    expect((manager as any).sshTunnels.size).toBe(0);
+
+    // A retry opens exactly one new tunnel and, on failure, closes that one too.
+    await expect(manager.ensureConnected("pg_ssh")).rejects.toThrow("password authentication failed");
+    expect(establishSpy).toHaveBeenCalledTimes(2);
+    expect(closeSpy).toHaveBeenCalledTimes(2);
+    expect((manager as any).sshTunnels.size).toBe(0);
+    expect(instances).toHaveLength(2);
+  });
+
   it("should not list a source as available when it can neither serve nor reconnect", () => {
     const manager = new ConnectorManager();
     (manager as any).sourceIds = ["alive", "dead"];
```

**File**: `src/connectors/manager.ts` (modified, +19/-3)
```diff
@@ -148,6 +148,7 @@ export class ConnectorManager {
 
     // Setup SSH tunnel if needed
     let actualDSN = dsn;
+    let tunnel: SSHTunnel | undefined;
     if (source.ssh_host) {
       const sshConfigPath = getDefaultSSHConfigPath();
       // If ssh_host looks like an SSH config alias, resolve from ~/.ssh/config
@@ -208,7 +209,7 @@ export class ConnectorManager {
       const targetPort = parseInt(url.port) || this.getDefaultPort(dsn);
 
       // Create and establish SSH tunnel
-      const tunnel = new SSHTunnel();
+      tunnel = new SSHTunnel();
       let tunnelInfo: SSHTunnelInfo;
       try {
         tunnelInfo = await tunnel.establish(sshConfig, {
@@ -281,8 +282,23 @@ export class ConnectorManager {
       config.collation = source.collation;
     }
 
-    // Connect to the database with config and optional init script
-    await connector.connect(actualDSN, source.init_script, config);
+    // Connect to the database with config and optional init script. If this fails,
+    // close the tunnel established for this attempt: the source may be retried (lazy
+    // connection or a failed IAM refresh), and each retry would otherwise open a new
+    // tunnel and orphan this one's SSH clients and local listener.
+    try {
+      await connector.connect(actualDSN, source.init_script, config);
+    } catch (error) {
+      if (tunnel) {
+        this.sshTunnels.delete(sourceId);
+        try {
+          await tunnel.close();
+        } catch (closeError) {
+          console.error(`Error closing SSH tunnel for source '${sourceId}':`, closeError);
+        }
+      }
+      throw error;
+    }
 
     // Store connector
     this.connectors.set(sourceId, connector);
```

---

### Incident Patch 8: `efe096d0` (2026-09-15)
**Commit Message**: Fix: make a failed AWS IAM refresh recoverable instead of losing the source (#425)

refreshIamSourceConnection tore down a source's connector before
reconnecting. When the reconnect threw (an expired SSO session is the
common trigger), the connector was gone, the refresh guard skipped every
later tick, and each tool call failed with "Source 'x' not found.
Available sources: ..., x, ..." until the process restarted.

- On a failed reconnect, hand the source back to lazySources so the next
  tool call retries the connection (and surfaces the real error while
  credentials are still bad).
- Re-arm the refresh timer only while the source is still connected; a
  successful reconnect re-arms it via connectSource.
- Derive the "Available sources" list in error messages from sources
  that are connected or registered for lazy connection, so a source that
  cannot serve a query is not reported as available.

Closes #424


Claude-Session: https://claude.ai/code/session_013UHUe6p1FxKHamwpDjyfoM

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `src/connectors/__tests__/manager.test.ts` (modified, +118/-1)
```diff
@@ -1,5 +1,6 @@
-import { beforeEach, describe, expect, it, vi } from "vitest";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { ConnectorManager } from "../manager.js";
+import { ConnectorRegistry } from "../interface.js";
 import { SSHTunnel } from "../../utils/ssh-tunnel.js";
 import type { SourceConfig } from "../../types/config.js";
 import { homedir } from "os";
@@ -194,3 +195,119 @@ describe("ConnectorManager IAM DSN rewrite", () => {
     expect(dsn).not.toContain("sslmode=disable");
   });
 });
+
+describe("ConnectorManager IAM refresh recovery", () => {
+  const AWS_IAM_TOKEN_REFRESH_MS = 14 * 60 * 1000;
+
+  function makeIamSource(): SourceConfig {
+    return {
+      id: "mysql_iam",
+      type: "mysql",
+      dsn: "mysql://dbuser:ignored@mydb.abc123.eu-west-1.rds.amazonaws.com:3306/mydb",
+      aws_iam_auth: true,
+      aws_region: "eu-west-1",
+    };
+  }
+
+  function stubConnectorRegistry() {
+    const instances: Array<{ connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
+    const prototype = {
+      id: "mysql",
+      clone: () => {
+        const instance = {
+          id: "mysql",
+          connect: vi.fn().mockResolvedValue(undefined),
+          disconnect: vi.fn().mockResolvedValue(undefined),
+        };
+        instances.push(instance);
+        return instance;
+      },
+    };
+    vi.spyOn(ConnectorRegistry, "getConnectorForDSN").mockReturnValue(prototype as any);
+    return instances;
+  }
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.useFakeTimers();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  it("should recover a source whose IAM refresh failed once credentials are valid again", async () => {
+    const instances = stubConnectorRegistry();
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-1");
+
+    const manager = new ConnectorManager();
+    await manager.connectWithSources([makeIamSource()]);
+    expect(instances).toHaveLength(1);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[0]);
+
+    // Refresh tick fires while the SSO session is expired: minting the token throws.
+    mocks.generateRdsAuthToken.mockRejectedValueOnce(new Error("SSO session expired"));
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
+    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
+    expect(mocks.generateRdsAuthToken).toHaveBeenCalledTimes(2);
+
+    // The source stays known and is still listed as available, because a tool call
+    // will retry the connection. Before the fix this threw "Source 'mysql_iam' not
+    // found. Available sources: mysql_iam" and there was no way back.
+    expect(manager.getSourceIds()).toEqual(["mysql_iam"]);
+
+    // Still broken: the next tool call surfaces the real cause, not "not found".
+    mocks.generateRdsAuthToken.mockRejectedValueOnce(new Error("SSO session expired"));
+    await expect(manager.ensureConnected("mysql_iam")).rejects.toThrow("SSO session expired");
+
+    // User re-authenticates: the next tool call reconnects transparently.
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-2");
+    await manager.ensureConnected("mysql_iam");
+    expect(instances).toHaveLength(2);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[1]);
+    expect(instances[1].connect).toHaveBeenCalledWith(
+      expect.stringContaining("token-2"),
+      undefined,
+      expect.any(Object)
+    );
+
+    // Refresh rotation resumes for the recovered connection.
+    mocks.generateRdsAuthToken.mockResolvedValueOnce("token-3");
+    await vi.advanceTimersByTimeAsync(AWS_IAM_TOKEN_REFRESH_MS);
+    expect(instances).toHaveLength(3);
+    expect(instances[1].disconnect).toHaveBeenCalledTimes(1);
+    expect(manager.getConnector("mysql_iam")).toBe(instances[2]);
+
+    await manager.disconnect();
+  });
+
+  it("should stop re-arming the refresh timer for a source that is no lo
```

**File**: `src/connectors/manager.ts` (modified, +26/-5)
```diff
@@ -97,7 +97,7 @@ export class ConnectorManager {
     if (!lazySource) {
       if (sourceId) {
         throw new Error(
-          `Source '${sourceId}' not found. Available sources: ${this.sourceIds.join(", ")}`
+          `Source '${sourceId}' not found. Available sources: ${this.getAvailableSourceIds().join(", ")}`
         );
       } else {
         throw new Error("No sources configured. Call connectWithSources() first.");
@@ -352,7 +352,7 @@ export class ConnectorManager {
     if (!connector) {
       if (sourceId) {
         throw new Error(
-          `Source '${sourceId}' not found. Available sources: ${this.sourceIds.join(", ")}`
+          `Source '${sourceId}' not found. Available sources: ${this.getAvailableSourceIds().join(", ")}`
         );
       } else {
         throw new Error("No sources connected. Call connectWithSources() first.");
@@ -396,6 +396,15 @@ export class ConnectorManager {
     return [...this.sourceIds];
   }
 
+  /**
+   * Source IDs that can actually serve a request: connected, or registered for
+   * lazy (re)connection on first use. Used for error messages so a source that
+   * is neither is not reported as available.
+   */
+  private getAvailableSourceIds(): string[] {
+    return this.sourceIds.filter(id => this.connectors.has(id) || this.lazySources.has(id));
+  }
+
   /** Get all available source IDs */
   static getAvailableSourceIds(): string[] {
     if (!managerInstance) {
@@ -481,8 +490,10 @@ export class ConnectorManager {
           error
         );
       } finally {
-        // Continue rotating as long as source remains configured and not shutting down.
-        if (!this.isDisconnecting && this.sourceConfigs.has(sourceId)) {
+        // Continue rotating only while the source is still connected and not shutting
+        // down. A source whose refresh failed has been handed back to lazySources, and
+        // its next successful connectSource() re-arms the timer.
+        if (!this.isDisconnecting && this.connectors.has(sourceId)) {
           this.scheduleIamRefresh(source);
         }
       }
@@ -515,7 +526,17 @@ export class ConnectorManager {
       return;
     }
 
-    await this.connectSource(source);
+    try {
+      await this.connectSource(source);
+    } catch (error) {
+      // The old connector is already gone. Register the source for lazy reconnection so
+      // the next tool call retries (e.g. after the user re-authenticates) instead of
+      // failing forever with "Source not found".
+      if (!this.isDisconnecting && this.sourceConfigs.has(sourceId)) {
+        this.lazySources.set(sourceId, source);
+      }
+      throw error;
+    }
   }
 
   /**
```

---

### Incident Patch 9: `0fd4c7a3` (2026-09-14)
**Commit Message**: fix(postgres,mariadb): attach pool 'error' listeners so a dropped idle connection no longer crashes the process (#423)

pg-pool re-emits an idle client's error (server restart, failover,
idle-timeout close) as an 'error' event on the pool. The PostgreSQL
connector never attached a listener, so Node reported an unhandled
'error' event and exited the whole DBHub process. Over stdio, MCP
clients do not restart the server, so the database tools were gone
until the user reconnected manually.

The mariadb pool has the same shape: it keeps `minimumIdle`
connections (default: connectionLimit) open in the background and
emits 'error' on the pool when a background reconnect attempt fails,
e.g. while the server is restarting.

Both pools have already discarded or will retry the affected
connection by the time the event fires, so the listener only logs the
error (with the source id) and lets the next query pick up a fresh
connection.

Tests: a new unit test drives each connector with an EventEmitter-based
fake pool, where emit('error') throws exactly as it would without a
listener, and asserts the connector survives and logs. Existing fake
pools gain an `on` stub.

Fixes #422


Claude-Session:

**File**: `src/connectors/__tests__/connect-failure-cleanup.test.ts` (modified, +2/-0)
```diff
@@ -84,6 +84,7 @@ describe("connect() failure cleanup", () => {
     mariadbCreatePool.mockReturnValue({
       query: vi.fn().mockRejectedValue(PROBE_FAILURE),
       end,
+      on: vi.fn(),
     });
 
     const connector = new MariaDBConnector();
@@ -98,6 +99,7 @@ describe("connect() failure cleanup", () => {
     pgPoolCtor.mockReturnValue({
       connect: vi.fn().mockRejectedValue(PROBE_FAILURE),
       end,
+      on: vi.fn(),
     });
 
     const connector = new PostgresConnector();
```

**File**: `src/connectors/__tests__/pool-error-listener.test.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+import { EventEmitter } from "events";
+
+/**
+ * Pools must carry an 'error' listener (bytebase/dbhub#422).
+ *
+ * pg-pool re-emits an idle client's error (server restart, failover,
+ * idle-timeout close) as an 'error' event on the pool, and the mariadb pool
+ * emits 'error' when a background reconnect attempt fails. An EventEmitter
+ * with no 'error' listener throws on emit, which Node reports as an
+ * unhandled 'error' event and exits the process. Over stdio, MCP clients do
+ * not restart the server, so the crash takes the database tools away until
+ * the user reconnects manually.
+ *
+ * The fake pools below are real EventEmitters, so `emit("error")` throws
+ * exactly like the drivers' pools would if the connector forgot the listener.
+ */
+
+class FakePgPool extends EventEmitter {
+  connect = vi.fn().mockResolvedValue({ release: vi.fn() });
+  end = vi.fn().mockResolvedValue(undefined);
+}
+
+class FakeMariadbPool extends EventEmitter {
+  query = vi.fn().mockResolvedValue([{ version: "11.4.0-MariaDB" }]);
+  end = vi.fn().mockResolvedValue(undefined);
+}
+
+let pgPool: FakePgPool;
+let mariadbPool: FakeMariadbPool;
+
+vi.mock("pg", () => ({
+  default: {
+    Pool: function (this: any) {
+      return pgPool;
+    },
+  },
+}));
+
+vi.mock("mariadb", () => ({
+  createPool: () => mariadbPool,
+}));
+
+const { PostgresConnector } = await import("../postgres/index.js");
+const { MariaDBConnector } = await import("../mariadb/index.js");
+
+const IDLE_DROP = new Error("terminating connection due to administrator command");
+
+const spyConsoleError = () => vi.spyOn(console, "error").mockImplementation(() => {});
+
+describe("pool 'error' listener", () => {
+  let consoleError: ReturnType<typeof spyConsoleError>;
+
+  beforeEach(() => {
+    pgPool = new FakePgPool();
+    mariadbPool = new FakeMariadbPool();
+    consoleError = spyConsoleError();
+  });
+
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it("an unlistened pool would crash the process (sanity check of the fake)", () => {
+    expect(() => pgPool.emit("error", IDLE_DROP)).toThrow(IDLE_DROP);
+  });
+
+  it("PostgreSQL survives an idle connection being dropped", async () => {
+    const connector = new PostgresConnector();
+    await connector.connect("postgres://u:p@localhost:5432/db");
+
+    expect(pgPool.listenerCount("error")).toBe(1);
+    // Mirrors pg-pool's idleListener: the client is already purged, then the
+    // pool re-emits. With no listener this emit would throw.
+    expect(() => pgPool.emit("error", IDLE_DROP, {})).not.toThrow();
+
+    expect(consoleError).toHaveBeenCalledTimes(1);
+    expect(consoleError.mock.calls[0].join(" ")).toContain("PostgreSQL pool");
+    expect(consoleError.mock.calls[0].join(" ")).toContain(IDLE_DROP.message);
+
+    await connector.disconnect();
+  });
+
+  it("PostgreSQL log line names the source", async () => {
+    const connector = new PostgresConnector();
+    (connector as any).sourceId = "prod_pg";
+    await connector.connect("postgres://u:p@localhost:5432/db");
+
+    pgPool.emit("error", IDLE_DROP, {});
+    expect(consoleError.mock.calls[0][0]).toContain('source "prod_pg"');
+  });
+
+  it("MariaDB survives a background reconnect failure", async () => {
+    const connector = new MariaDBConnector();
+    await connector.connect("mariadb://u:p@localhost:3306/db");
+
+    expect(mariadbPool.listenerCount("error")).toBe(1);
+    const reconnectFailure = new Error("Pool fails to create connection: ECONNREFUSED");
+    expect(() => mariadbPool.emit("error", reconnectFailure)).not.toThrow();
+
+    expect(consoleError).toHaveBeenCalledTimes(1);
+    expect(consoleError.mock.calls[0].join(" ")).toContain("MariaDB pool");
+    expect(consoleError.mock.calls[0].join(" ")).toContain(reconnectFailure.message);
+
+    await connector.disconnect();
+  });
+
+  it("does not stack listeners across reconnec
```

**File**: `src/connectors/__tests__/readonly-transaction-strategy.test.ts` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ function makeFakePool(version: string, wrapResults: (rows: any[]) => any) {
     query: vi.fn(async () => wrapResults([{ version }])),
     getConnection: vi.fn(async () => conn),
     end: vi.fn(),
+    // Connectors attach a pool 'error' listener at connect time.
+    on: vi.fn(),
   };
   return { pool, conn, statements };
 }
```

**File**: `src/connectors/mariadb/index.ts` (modified, +14/-0)
```diff
@@ -162,6 +162,20 @@ export class MariaDBConnector implements Connector {
 
       this.pool = mariadb.createPool(connectionConfig);
 
+      // The mariadb pool keeps `minimumIdle` connections open in the background
+      // (defaults to connectionLimit) and emits an 'error' event on the pool when
+      // one of those background reconnect attempts fails, e.g. while the server
+      // is restarting. Without a listener Node treats it as unhandled and exits
+      // the whole process. The pool retries with backoff on its own, so logging
+      // is all that is needed here. The typings omit this event, but the runtime
+      // Pool is an EventEmitter.
+      (this.pool as unknown as NodeJS.EventEmitter).on("error", (err: Error) => {
+        console.error(
+          `MariaDB pool (source "${this.sourceId}"): background connection error, pool will retry:`,
+          err.message
+        );
+      });
+
       // Test the connection and detect the server flavor in the same round trip.
       const rows = await this.pool.query("SELECT VERSION() AS version");
       this.supportsReadOnlyTransaction = !isTiDBVersion(rows?.[0]?.version);
```

**File**: `src/connectors/postgres/index.ts` (modified, +12/-0)
```diff
@@ -206,6 +206,18 @@ export class PostgresConnector implements Connector {
 
       this.pool = new Pool(poolConfig);
 
+      // pg-pool re-emits an idle client's error (server restart, failover,
+      // idle-timeout close) as an 'error' event on the pool. Without a listener
+      // Node treats it as unhandled and exits the whole process. The client has
+      // already been purged from the pool by the time this fires, so logging is
+      // all that is needed; the next query checks out a fresh connection.
+      this.pool.on("error", (err: Error) => {
+        console.error(
+          `PostgreSQL pool (source "${this.sourceId}"): idle connection dropped, will reconnect on next query:`,
+          err.message
+        );
+      });
+
       // Test the connection
       const client = await this.pool.connect();
       client.release();
```

---

### Incident Patch 10: `cca7b67d` (2026-09-08)
**Commit Message**: fix(postgres): include foreign tables in getTables so search_objects can discover them (#419)

Postgres reports foreign tables (postgres_fdw, file_fdw, ...) in
information_schema.tables with table_type = 'FOREIGN', so the
'BASE TABLE' filter hid them from search_objects even though every
per-table detail query (columns, comment, row count, tableExists)
already handled them. Widen the filter to include 'FOREIGN'.

Also let getTableIndexes see partitioned tables (relkind 'p'), which
carry their own index entries since PG11 but were filtered out.

Adds integration coverage using a handler-less FDW so the foreign
table can be enumerated and described without a remote server.

Closes #418


Claude-Session: https://claude.ai/code/session_01Yc1YYa3jHCEW7FDxC66R9Z

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `src/connectors/__tests__/postgres.integration.test.ts` (modified, +37/-0)
```diff
@@ -173,6 +173,21 @@ class PostgreSQLIntegrationTest extends IntegrationTestBase<PostgreSQLTestContai
     `, {});
     await connector.executeSQL(`COMMENT ON VIEW active_users IS 'Users aged 25 or older'`, {});
 
+    // Create a foreign table (for foreign table discovery tests, #418). A
+    // handler-less FDW is enough: the catalog entries exist and can be
+    // enumerated/described, the table just can't be scanned.
+    await connector.executeSQL('CREATE FOREIGN DATA WRAPPER dummy_fdw', {});
+    await connector.executeSQL('CREATE SERVER IF NOT EXISTS dummy_server FOREIGN DATA WRAPPER dummy_fdw', {});
+    await connector.executeSQL(`
+      CREATE FOREIGN TABLE IF NOT EXISTS remote_users (
+        id INTEGER,
+        name VARCHAR(100),
+        email VARCHAR(100),
+        age INTEGER
+      ) SERVER dummy_server
+    `, {});
+    await connector.executeSQL(`COMMENT ON FOREIGN TABLE remote_users IS 'Users on a remote server'`, {});
+
     // Create test stored procedures using SQL language to avoid dollar quoting
     await connector.executeSQL(`
       CREATE OR REPLACE FUNCTION get_user_count()
@@ -346,6 +361,28 @@ describe('PostgreSQL Connector Integration Tests', () => {
       expect(comment).toBe('Users aged 25 or older');
     });
 
+    it('should list foreign tables as tables, not views', async () => {
+      const tables = await postgresTest.connector.getTables();
+      expect(tables).toContain('remote_users');
+
+      const views = await postgresTest.connector.getViews();
+      expect(views).not.toContain('remote_users');
+
+      expect(await postgresTest.connector.tableExists('remote_users')).toBe(true);
+    });
+
+    it('should describe foreign tables like regular tables', async () => {
+      const columns = await postgresTest.connector.getTableSchema('remote_users');
+      expect(columns.map((c) => c.column_name)).toEqual(['id', 'name', 'email', 'age']);
+
+      const comment = await postgresTest.connector.getTableComment!('remote_users');
+      expect(comment).toBe('Users on a remote server');
+
+      // Foreign tables cannot have indexes; this must return empty rather than throw.
+      const indexes = await postgresTest.connector.getTableIndexes('remote_users');
+      expect(indexes).toEqual([]);
+    });
+
     it('should report connection pool state and buffer cache hit ratio via getHealthCheck', async () => {
       const health = await postgresTest.connector.getHealthCheck!();
 
```

**File**: `src/connectors/__tests__/shared/integration-test-base.ts` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ export abstract class IntegrationTestBase<TContainer extends TestContainer> {
 
       it('should list views without overlapping tables', async () => {
         // Verifies getViews() is wired and its query executes against the real
-        // database. getTables() (BASE TABLE only) and getViews() must be disjoint.
+        // database. getTables() (tables, never views) and getViews() must be disjoint.
         const tables = await this.connector.getTables();
         const views = await this.connector.getViews();
         expect(Array.isArray(views)).toBe(true);
```

**File**: `src/connectors/postgres/index.ts` (modified, +5/-2)
```diff
@@ -259,12 +259,15 @@ export class PostgresConnector implements Connector {
       // Use the configured default schema (from search_path config, defaults to 'public')
       const schemaToUse = schema || this.defaultSchema;
 
+      // 'FOREIGN' covers foreign tables (postgres_fdw, file_fdw, ...). They are
+      // queryable like base tables and information_schema.columns already
+      // describes them, so they must be discoverable here too (#418).
       const result = await client.query(
         `
         SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
-        AND table_type = 'BASE TABLE'
+        AND table_type IN ('BASE TABLE', 'FOREIGN')
         ORDER BY table_name
       `,
         [schemaToUse]
@@ -358,7 +361,7 @@ export class PostgresConnector implements Connector {
           AND i.oid = ix.indexrelid
           AND a.attrelid = t.oid
           AND a.attnum = ANY(ix.indkey)
-          AND t.relkind = 'r'
+          AND t.relkind IN ('r','p')
           AND t.relname = $1
           AND ns.oid = t.relnamespace
           AND ns.nspname = $2
```

#### Recent Merged Pull Requests:
- **PR #444** (closed): fix: cap the row count of LIMIT offset, count instead of its offset (@serhiizghama)
- **PR #442** (2026-09-28): Reject sslrootcert and unknown sslmode values in PostgreSQL DSNs (@tianzhou)
- **PR #441** (2026-09-28): Support sslcert/sslkey client certificate authentication for PostgreSQL (@tianzhou)
- **PR #440** (2026-09-28): Add glama.json to enable claiming the Glama listing (@adela-bytebase)
- **PR #438** (2026-09-21): fix: reload AWS credentials from disk on every RDS IAM token refresh (@tianzhou)
- **PR #436** (closed): fix: disable AWS credential cache for RDS IAM auth (@li-chaogang)
- **PR #435** (2026-09-19): feat: implement health_check for Oracle (@tianzhou)
- **PR #434** (2026-09-19): docs: add Oracle to README and docs (@tianzhou)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
