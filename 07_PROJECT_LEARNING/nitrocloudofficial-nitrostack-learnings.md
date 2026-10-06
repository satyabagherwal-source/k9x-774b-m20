# Forensic Learning Record (Deep Inspection): nitrocloudofficial/nitrostack

> **Canonical Artifact**: `07_PROJECT_LEARNING/nitrocloudofficial-nitrostack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nitrocloudofficial/nitrostack](https://github.com/nitrocloudofficial/nitrostack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:45.968Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nitrocloudofficial/nitrostack`
- **Description**: The full-stack TypeScript framework to build, test, and deploy production-ready MCP servers and AI-native apps.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2467 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sample-apps/Agent-Nexus/src/modules/decision-twin/decision-twin.state.ts`
```
export interface SubGoal {
  id: string;
  description: string;
  requiredAgent: string;
  priority: number;
}

export interface Proposal {
  source: string;
  action: string;
  reason: string;
  confidence: number;
}

export interface Veto {
  source: string;
  vetoed_action: string;
  reason: string;
  sop_reference?: string;
  round?: number;
}

export interface Challenge {
  source: string;
  challenged_proposal: string;
  challenge: string;
  requested_evidence: string;
  severity: string;
  round?: number;
}

export interface WorkOrder {
  type: string;
  machine_id: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assigned_to: string;
  notes: string;
}

export interface SupervisorNotification {
  type: string;
  machine_id: string;
  summary: string;
  requires_approval: boolean;
}

export interface FieldConflict {
  field: string;
  user_value: any;
  live_sensor_value: any;
  selected_source: 'user_input' | 'live_sensor' | 'merge';
  selected_value: any;
  reason: string;
}

export interface DataSourceDetail {
  field: string;
  value: any;
  source: 'user_input' | 'live_sensor' | 'merge';
  has_conflict: boolean;
  conflict_detail?: string;
}

export interface FinalDecision {
  chosen_action: string;
  confidence: number;
  reason: string;
  supporting_evidence: Record<string, string>;
  data_sources_summary?: Record<string, DataSourceDetail>;
  conflicts_resolved?: FieldConflict[];
  data_source_policy_applied?: string;
  vetoes: Veto[];
  challenges_addressed: Challenge[];
  agents_consulted: string[];
  machine_id: string;
  negotiation_rounds: number;
}

export interface DecisionTwinState {
  event: Record<string, any>;
  event_type: 'sensor_anomaly' | 'maintenance_alert' | 'quality_deviation' | string;
  data_source_priority?: 'user_input' | 'live_sensor' | 'merge';

  sub_goals: SubGoal[];

  phase: 'planning' | 'evidence' | 'reflection' | 'simulation' | 'convergence' | string;
  active_agents: string[];
  agents_completed: string[];
  current_agent: string;

  // Tracks how many Devil's Advocate / Safety negotiation rounds have run (reflection pillar).
  negotiation_round: number;

  blackboard: Record<string, any>;

  proposals: Proposal[];
  vetoes: Veto[];
  challenges: Challenge[];
  final_decision?: FinalDecision;
  conflicts?: FieldConflict[];
  data_sources?: Record<string, DataSourceDetail>;

  work_orders: WorkOrder[];
  notifications: SupervisorNotification[];

  trace: string[];
}

```

### Core Architecture Module: `sample-apps/ClinicaMind/src/services/ocr-engine.service.ts`
```
import fs from 'fs';
import path from 'path';

export interface OcrDocumentResult {
  success: boolean;
  documentName: string;
  fileType: string;
  pagesProcessed: number;
  characterCount: number;
  confidence: string;
  rawText: string;
  error?: string;
}

export interface CombinedOcrResult {
  status: string;
  processingStatus: string;
  pagesProcessed: number;
  characterCount: number;
  confidence: string;
  rawText: string;
  documentsProcessed: number;
  results: OcrDocumentResult[];
}

export class OcrEngineService {
  /**
   * PDF & Image Text Extraction Pipeline.
   * - PDF: Attempts direct text extraction using pdf-parse.
   *        If pdf-parse succeeds, logs debug metrics and returns pdfData.text exactly.
   *        If pdf-parse throws, logs full exception and falls back to Tesseract OCR.
   * - PNG / JPG / JPEG: Always runs Tesseract OCR.
   * - No manual buffer parsing, no regex extraction, no placeholder text.
   */
  static async processDocument(filePath: string, fileName: string, fileType: string): Promise<OcrDocumentResult> {
    const sanitizedName = path.basename(fileName);
    const ext = fileType.toUpperCase();

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`File not found on server at path "${filePath}". Cannot process missing file.`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log(`✓ File received: ${sanitizedName}`);
    console.log(`✓ File type: ${ext}`);
    console.log(`✓ File size: ${fileBuffer.length} bytes`);

    let extractedText = '';
    let pagesProcessed = 1;
    let confidenceStr = '98.5%';

    const isPdf = ext === 'PDF' || sanitizedName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      console.log(`✓ PDF text extraction started for ${sanitizedName}`);

      let pdfParseError: any = null;

      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const pdfData = await pdfParse(fileBuffer);

        if (pdfData && typeof pdfData.text === 'string') {
          pagesProcessed = pdfData.numpages || 1;
          extractedText = pdfData.text;
          confidenceStr = '99.0% (pdf-parse)';

          // Debug logging required when pdf-parse succeeds
          console.log(`--- [pdf-parse Success Metrics] ---`);
          console.log(`pdf-parse version: ${pdfData.version || 'default'}`);
          console.log(`pdfData.numpages: ${pdfData.numpages}`);
          console.log(`pdfData.info: ${JSON.stringify(pdfData.info || {})}`);
          console.log(`pdfData.metadata: ${JSON.stringify(pdfData.metadata || {})}`);
          console.log(`pdfData.text.length: ${pdfData.text.length}`);
          console.log(`First 200 characters of pdfData.text:\n${pdfData.text.substring(0, 200)}`);
          console.log(`-----------------------------------`);
          console.log(`✓ Extraction complete for ${sanitizedName}`);
        }
      } catch (pdfErr: any) {
        pdfParseError = pdfErr;
        console.error(`[OcrEngineService] pdf-parse failed for ${sanitizedName}:`, pdfErr);
      }

      // If pdf-parse threw an error or returned empty text, run Tesseract OCR fallback
      if (!extractedText || extractedText.trim().length === 0) {
        console.log(`✓ OCR fallback started (Tesseract.js) for ${sanitizedName}`);
        try {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('eng');
          const { data } = await worker.recognize(fileBuffer);
          await worker.terminate();

          if (data && data.text && data.text.trim().length > 0) {
            extractedText = data.text;
            confidenceStr = data.confidence ? `${data.confidence.toFixed(1)}% (Tesseract OCR)` : '90.0%';
            console.log(`✓ Extraction complete for ${sanitizedName} via Tesseract OCR`);
          } else {
            throw new Error(`Tesseract OCR returned empty text for "${sanitizedName}".`);
          }
        } catch (tessErr: any) {
          console.error(`[OcrEngineService] Tesseract OCR failed for ${sanitizedName}:`, tessErr);
          const combinedMsg = pdfParseError
            ? `pdf-parse error: ${pdfParseError?.message || pdfParseError}; Tesseract error: ${tessErr?.message || tessErr}`
            : `Tesseract error: ${tessErr?.message || tessErr}`;
          throw new Error(`Text extraction failed for "${sanitizedName}": ${combinedMsg}`);
        }
      }
    } else {
      // PNG / JPG / JPEG / Image files
      console.log(`✓ OCR fallback started (Tesseract.js) for image file ${sanitizedName}`);
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const { data } = await worker.recognize(fileBuffer);
        await worker.terminate();

        if (data && data.text && data.text.trim().length > 0) {
          extractedText = data.text;
          confidenceStr = data.confidence ? `${data.confidence.toFixed(1)}% (Tesseract OCR)` : '95.0%';
          console.log(`✓ Extraction complete for ${sanitizedName} via Tesseract OCR`);
        } else {
          throw new Error(`Tesseract OCR returned empty text for image "${sanitizedName}".`);
        }
      } catch (imgErr: any) {
        console.error(`[OcrEngineService] Image Tesseract failed for ${sanitizedName}:`, imgErr);
        throw new Error(`Image OCR extraction failed for "${sanitizedName}": ${imgErr?.message || imgErr}`);
      }
    }

    return {
      success: true,
      documentName: sanitizedName,
      fileType: ext,
      pagesProcessed,
      characterCount: extractedText.length,
      confidence: confidenceStr,
      rawText: extractedText
    };
  }

  /**
   * Processes all selected session documents.
   */
  static async processSessionDocuments(
    documents: Array<{ fileName: string; fileType?: string; localPath?: string }>
  ): Promise<CombinedOcrResult> {
    const tempDir = path.resolve(process.cwd(), 'data', 'temp_attachments');
    const results: OcrDocumentResult[] = [];
    let totalPages = 0;
    let totalChars = 0;
    const mergedTexts: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      let targetPath = doc.localPath || '';

      if (!targetPath || !fs.existsSync(targetPath)) {
        const cleanName = path.basename(doc.fileName);
        const direct = path.join(tempDir, cleanName);
        if (fs.existsSync(direct)) {
          targetPath = direct;
        } else if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          const match = files.find(f => f === cleanName || f.endsWith(`_${cleanName}`) || f.toLowerCase().includes(cleanName.toLowerCase()));
          if (match) {
            targetPath = path.join(tempDir, match);
          }
        }
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error(`Document "${doc.fileName}" not found in server storage directory (${tempDir}).`);
      }

      const docResult = await this.processDocument(targetPath, doc.fileName, doc.fileType || 'PDF');
      results.push(docResult);

      if (docResult.success) {
        totalPages += docResult.pagesProcessed;
        totalChars += docResult.characterCount;
        mergedTexts.push(docResult.rawText);
      }
    }

    const combinedRawText = mergedTexts.join('\n\n' + '='.repeat(60) + '\n\n');
    const avgConfidence = results.length > 0 ? results[0].confidence : '98.5%';

    return {
      status: 'success',
      processingStatus: 'OCR Complete ✓',
      pagesProcessed: totalPages,
      characterCount: totalChars,
      confidence: avgConfidence,
      rawText: combinedRawText,
      documentsProcessed: results.length,
      results
    };
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/services/NotificationEngine.service.ts`
```
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'meeting' | 'task' | 'connector' | 'auth';
  timestamp: Date;
  isRead: boolean;
}

export class NotificationEngineService {
  private static instance: NotificationEngineService;
  private notifications: NotificationItem[];

  constructor() {
    this.notifications = [];
    this.initializeDefaultAlerts();
  }

  public static getInstance(): NotificationEngineService {
    if (!NotificationEngineService.instance) {
      NotificationEngineService.instance = new NotificationEngineService();
    }
    return NotificationEngineService.instance;
  }

  private initializeDefaultAlerts(): void {
    this.notifications = [
      {
        id: 'notif-01',
        title: 'Urgent Message Received',
        message: 'Dr. Evelyn Vance sent urgent project architecture feedback.',
        type: 'urgent',
        timestamp: new Date(),
        isRead: false
      },
      {
        id: 'notif-02',
        title: 'Upcoming Meeting Reminder',
        message: 'CS340 Review Call starting in 15 minutes.',
        type: 'meeting',
        timestamp: new Date(),
        isRead: false
      }
    ];
  }

  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public addNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>): void {
    this.notifications.unshift({
      ...item,
      id: `notif-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      isRead: false
    });
  }

  public markAsRead(id: string): void {
    const item = this.notifications.find(n => n.id === id);
    if (item) item.isRead = true;
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/interfaces/Webhook.interface.ts`
```
import { PlatformType } from '../enums/platform.enum.js';

export interface WebhookEvent<TPayload = Record<string, unknown>> {
  id: string;
  platform: PlatformType;
  eventType: string;
  payload: TPayload;
  timestamp: Date;
  signature?: string;
}

export interface WebhookHandler {
  platform: PlatformType;
  handleEvent(event: WebhookEvent): Promise<boolean>;
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/ConfigManager.utility.ts`
```
import { appConfig } from '../config/app.config.js';
import { env } from '../config/env.config.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private configData: Record<string, unknown>;

  private constructor() {
    this.configData = {
      app: appConfig,
      env: env
    };
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public get<T>(key: string): T | undefined {
    const keys = key.split('.');
    let val: any = this.configData;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return undefined;
      }
    }
    return val as T;
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/DateUtilities.utility.ts`
```
export class DateUtilities {
  public static formatIso(date: Date): string {
    return date.toISOString();
  }

  public static formatRelative(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  public static isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/EnvironmentLoader.utility.ts`
```
import { env } from '../config/env.config.js';
import { Logger } from './Logger.utility.js';

export class EnvironmentLoader {
  public static validateEnvironment(): boolean {
    Logger.info('Validating environment configuration...');
    const requiredKeys: (keyof typeof env)[] = ['NODE_ENV', 'PORT'];
    for (const key of requiredKeys) {
      if (!env[key]) {
        Logger.warn(`Environment variable key ${String(key)} missing`);
      }
    }
    return true;
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/ErrorHandler.utility.ts`
```
import { Logger } from './Logger.utility.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class ErrorHandler {
  public static handle(error: unknown, contextMsg: string = 'An error occurred'): ApplicationError {
    if (error instanceof ApplicationError) {
      Logger.error(`${contextMsg}: ${error.message}`, error, { code: error.code, details: error.details });
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const appErr = new ApplicationError(`${contextMsg}: ${message}`);
    Logger.error(appErr.message, error);
    return appErr;
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/Logger.utility.ts`
```
import { loggerConfig } from '../config/logger.config.js';

export class Logger {
  public static info(message: string, context?: Record<string, unknown>): void {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context ? JSON.stringify(context) : '');
  }

  public static warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, context ? JSON.stringify(context) : '');
  }

  public static error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error, context ? JSON.stringify(context) : '');
  }

  public static debug(message: string, context?: Record<string, unknown>): void {
    if (loggerConfig.level === 'debug') {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, context ? JSON.stringify(context) : '');
    }
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/MessageUtilities.utility.ts`
```
import { Message } from '../interfaces/Message.interface.js';

export class MessageUtilities {
  public static truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  public static extractKeywords(content: string): string[] {
    const words = content.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'for']);
    return Array.from(new Set(words.filter(w => w.length > 3 && !stopWords.has(w))));
  }

  public static sanitizeMessage(message: Message): Message {
    return {
      ...message,
      content: message.content.trim()
    };
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/ValidationUtilities.utility.ts`
```
export class ValidationUtilities {
  public static isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  public static isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  public static isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && value > 0;
  }
}

```

### Core Architecture Module: `sample-apps/Converra-One/src/shared/utilities/helpers.ts`
```
import { PriorityLevel } from '../enums/priority.enum.js';

/**
 * UUID v4 Generator helper
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format timestamp into readable ISO string
 */
export function formatTimestamp(date?: Date | string | number): string {
  const d = date ? new Date(date) : new Date();
  return d.toISOString();
}

/**
 * Priority Calculator Placeholder (To be enhanced by AI in Phase 2)
 */
export function calculatePriorityPlaceholder(text: string, isUrgentFlag?: boolean): PriorityLevel {
  if (isUrgentFlag || text.toLowerCase().includes('urgent') || text.toLowerCase().includes('asap')) {
    return PriorityLevel.URGENT;
  }
  if (text.toLowerCase().includes('important') || text.toLowerCase().includes('deadline')) {
    return PriorityLevel.HIGH;
  }
  return PriorityLevel.MEDIUM;
}

/**
 * Validate whether a string is valid JSON
 */
export function isValidJson(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform a clean deep clone of an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safely parse JSON string with fallback default
 */
export function safeParseJson<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #348** (2026-09-24): **fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3**
  *Symptoms*: ## Description  This PR resolves an `ERESOLVE` dependency resolution failure across NitroStack packages and starter templates caused by the release of `@modelcontextprotocol/ext-apps@2.0.0`.  ### Root Cause Previously, `package.json` files specified `@modelcontextprotocol/ext-apps: ">=0.1.0"`. Because this range was unbounded, npm resolved to the newly released `2.0.0`, which declares peer dependencies on `zod: ^4.2.0` and `@modelcontextprotocol/core: ^2.0.0`. Since NitroStack depends on Zod 3, modern npm failed during `npm install` with an unresolvable peer dependency conflict (`ERESOLVE`).  Published `@nitrostack/core@1.0.16` and `@nitrostack/widgets@1.0.9` still declare that unbounded peer. Template roots depend on `@nitrostack/core: "^1"`, so they install the published package. A direct `@modelcontextprotocol/ext-apps: "^1.0.0"` dependency is required on those templates until `1.0.17` / `1.0.10` are published.  ## Type of Change  - [x] fix: Bug fix - [ ] feat: New feature - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  Resolves peer dependency conflict (`ERESOLVE`) on fresh `npm install` for `@nitrostack/core`, `@nitrostack/widgets`, and all CLI starter templates.  ## Changes Made  1. **`@nitrostack/core` (`1.0.17`)**: Removed `@modelcontextprotocol/ext-apps` from `peerDependencies`. Server-side code does not import `ext-apps`. Raised the direct `zod` depende

- **Issue #346** (2026-09-23): **fix(core): attach input to ExecutionContext for middleware and interceptors**
  *Symptoms*: ## Description  Tool arguments were never attached to ExecutionContext, so middleware and interceptors could not inspect the actual input (context.input was always undefined). This contradicts the SDK reference and Interceptor guide, both of which show context.input as the canonical way to read tool arguments in cross-cutting logic.  ## Changes Made  - Add optional `input` field to the `ExecutionContext` interface (types.ts) - Populate `context.input` with the sanitised tool arguments at both call   sites in server.ts (synchronous path and runTaskAsync) - `_meta` is excluded from input as it already lives in context.metadata  ## Type of Change  - [x] fix: Bug fix  ## Related Issues  Closes #328  ## Testing  - [x] npm test — 708 tests pass, 60 suites green - [x] Added test: verifies context.input is populated with tool args   and _meta is correctly excluded

- **Issue #344** (2026-09-07): **feat(core): implement MCP 2026-07-28 stateless protocol, task management, CIMD/OAuth 2.1 hardening, and MRTR support**
  *Symptoms*: ## Description  This PR implements the official **Model Context Protocol (MCP) `2026-07-28` specification** across `@nitrostack/core` while maintaining 100% backward compatibility for existing 2025-era sessionful servers.  It introduces a dual-adapter architecture, a robust task orchestration engine (`TaskManager` / `TaskStore`), multi-channel notification routing, hardened OAuth 2.1 & Client ID Metadata Document (CIMD) resolution, Multi-Round-Trip Requests (MRTR) for interactive elicitation, full JSON Schema 2020-12 translation, W3C trace context propagation, cache hints, and comprehensive configuration support across starter templates (including Pizza and OAuth Flight Booking templates).  ---  ## System Architecture Diagram  ```mermaid flowchart TD     subgraph Clients["MCP Clients"]         C1["Modern MCP Client (2026-07-28)\n(NitroStudio / Claude / Cursor)"]         C2["Legacy MCP Client (2025-06-18)\n(Sessionful SSE / HTTP)"]     end      subgraph Transport["Transport Layer (HTTP / STDIO)"]         TH["Streamable HTTP Transport (/mcp)"]         TS["StdIO Transport"]         SEL{"Protocol Era Selector\n(NITRO_MCP_PROTOCOL_VERSION)"}     end      subgraph Adapters["Protocol Adapters"]         MA["ModernProtocolAdapter (v2)\n(@modelcontextprotocol/server@2.0.0)\nStateless per-request dispatch"]         LA["Legacy Adapter (v1)\n(@modelcontextprotocol/sdk@1.x)\nSessionful SSE / Handshakes"]     end      subgraph Security["Auth & Interception Layer"]         OG["OAuthGuard & T

- **Issue #341** (2026-08-28): **chore(sample-apps): remove non-working and invalid sample applications**
  *Symptoms*: ## Summary Removes 8 non-working sample projects and 2 invalid/incomplete directories from `sample-apps/` that fail installation, build, or startup runtime validation.  An automated validation harness was executed across all 66 sample projects to verify dependency installation, build correctness, process execution, and runtime responsiveness. The remaining 56 sample projects have been tested and verified to be 100% working.  ---  ## Removed Projects (10)  ### Non-Working Projects (8) * **`converge`**: SDK monorepo copy missing type definitions (`jose`). * **`FlowLogix`**: Missing `warehouse-health-summary` HTML route on server start. * **`logic-loop-mcp-server-project`**: SDK monorepo copy missing type definitions (`jose`). * **`project-aegis`**: Missing `next` CLI build dependency. * **`Rightly`**: Hard failure on startup due to missing required `GOOGLE_GEMINI_API_KEY`. * **`seer`**: Fails startup due to Zod schema validation errors. * **`token-slash`**: Build failure due to missing `@types/express`. * **`trade-matcher`**: Hard failure on startup due to missing required OpenAI credentials.  ### Invalid / Incomplete Projects (2) * **`autoboardai`**: Empty directory. * **`process-workload-monitoring`**: Only contained a `readme.md` file without runnable code or configuration.  ---  ## Verification - Validated all 56 remaining sample applications via the test runner. - Every remaining project installs dependencies, compiles/builds successfully, and starts without runtime errors

- **Issue #340** (2026-08-28): **fix(sample-apps): resolve case-collision between README.md and readme.md**
  *Symptoms*: ## Summary Resolves a filename case-collision under `sample-apps/` where both `README.md` (containing stale CrisisMesh project content) and `readme.md` (containing the submission instructions) were tracked simultaneously in git.  This collision causes git clone warnings and checkout/status inconsistencies on case-insensitive filesystems (such as macOS and Windows).  ---  ## Changes - Updated `sample-apps/README.md` to contain the canonical "How to submit your project — step by step" submission guide. - Removed duplicate lowercase `sample-apps/readme.md` from git tracking. - Cleaned up stray CrisisMesh content from `sample-apps/README.md`.  ---  ## Verification - Verified with `git ls-files | tr '[:upper:]' '[:lower:]' | sort | uniq -d` that no case-insensitive collisions remain in the repository. - Verified working tree is clean and git status reports no phantom deleted files.

- **Issue #339** (2026-08-28): **feat(widgets): implement RPC methods in polyfill and enhance sendFollowUpMessage payload support**
  *Symptoms*: ## Description  This PR enhances `@nitrostack/widgets` runtime polyfill and SDK compatibility by: 1. Enabling `sendFollowUpMessage` to accept either plain string prompts or `{ prompt: string }` objects across the SDK, types, runtime, and polyfills. 2. Supporting both `openai` and `data` fields in `NITRO_INJECT_OPENAI` message payloads. 3. Implementing parent RPC messaging (`NITRO_WIDGET_RPC`) for `sendFollowUpMessage`, `openExternal`, and `requestClose` in `widget-polyfill`. 4. Gating the polyfill's ready event dispatch when `WidgetLayout` is active (`__nitroWidgetLayoutActive`) to prevent race conditions before RPC handlers are installed.  ## Type of Change  - [x] feat: New feature - [x] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Changes Made  - **`typescript/packages/widgets/src/types.ts`**: Updated `OpenAiAPI.sendFollowUpMessage` signature to support `(args: { prompt: string } | string) => Promise<void>`. - **`typescript/packages/widgets/src/sdk.ts`**: Normalized prompt argument in `WidgetSDK.prototype.sendFollowUpMessage` to support string or object forms. - **`typescript/packages/widgets/src/runtime/WidgetLayout.tsx`**: Updated `sendFollowUpMessage` parameter parsing and exposed it in `onReady` payload. - **`typescript/packages/widgets/src/runtime/widget-polyfill.ts`**:   - Implemented RPC postMessage dispatch for `sendFollowUpMessage`, `openExternal`, and

- **Issue #337** (2026-08-25): **fix(core): propagate HTTP Authorization header and params._meta into tool ExecutionContext**
  *Symptoms*: ## Description  Remote MCP clients (ChatGPT Apps SDK, Cursor, HTTP/SSE) authenticating with OAuth 2.1 bearer tokens always failed `OAuthGuard` with `OAuth token required`, even after a successful OAuth handshake. Two root causes in `@nitrostack/core`:  1. `StreamableHttpTransport.handleMcpRequest` delegated to the MCP SDK without bridging the HTTP `Authorization` header into the session or execution context. 2. The `tools/call` handler only read `_meta` from `request.params.arguments`, ignoring the spec-compliant `request.params._meta`, so spec-compliant clients had their metadata stripped.  As a result `ExecutionContext.metadata` was always `{}` for HTTP/SSE requests and `OAuthGuard` failed unconditionally when `OAUTH_REQUIRED=true`.  ## Type of Change  - [ ] feat: New feature - [x] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  Bug report: `docs/sdk-bug/oauth-http-headers-and-metadata-loss.md` (internal report, validated against v1.0.14)  ## Changes Made  - `transports/streamable-http.ts`: added exported `SessionContext` (`{ authHeader?: string }`); `McpServerFactory` now receives it; `McpSession` carries it; `handleMcpRequest` refreshes `authHeader` from the HTTP `Authorization` header on every request (mid-session token refreshes work) - `server.ts`: `createConfiguredMcpServer` / `setupHandlersOn` accept the per-session `SessionContext`; the `to

- **Issue #306** (2026-08-06): **[Hackathon] VectorPoint - Autonomous-Medical-Imaging-Diagnosis-Clinical-Decision-Agent**
  *Symptoms*: ## Description  <!-- Explain what this PR changes and why -->  ## Type of Change  - [ ] feat: New feature - [ ] fix: Bug fix - [ ] docs: Documentation update - [ ] refactor: Internal code change - [ ] test: Test-only changes - [ ] chore: Build, CI, or tooling changes  ## Related Issues  <!-- Use closing keywords when appropriate, e.g. Closes #123 -->  ## Changes Made  -  -  -   ## Testing  - [ ] `npm run lint` - [ ] `npm test` - [ ] Manual testing performed (if applicable)  ## Screenshots / Recordings  <!-- Add screenshots or GIFs for UI/UX changes -->  ## Checklist  - [ ] I have read and followed `CONTRIBUTING.md` - [ ] I have added/updated tests where appropriate - [ ] I have updated docs where appropriate - [ ] I have kept this PR focused and scoped - [ ] I have used conventional commits 

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

### Incident Patch 1: `4c1a1c47` (2026-09-24)
**Commit Message**: Merge pull request #348 from nitrocloudofficial/fix/pin-ext-apps-peer-dependency

fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3

**File**: `typescript/packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/cli",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "CLI for NitroStack - Create and manage MCP server projects",
   "type": "module",
   "main": "dist/index.js",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +3/-3)
```diff
@@ -15,12 +15,12 @@
   },
   "dependencies": {
     "@nitrostack/core": "^1",
-    "zod": "^3.22.4",
+    "zod": "^3.25.0",
     "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
-    "date-fns": "^4.1.0",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "date-fns": "^4.1.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
+    "zod": "^3.25.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +2/-2)
```diff
@@ -24,9 +24,9 @@
   "license": "MIT",
   "dependencies": {
     "@nitrostack/core": "^1",
-    "zod": "^3.22.4",
+    "zod": "^3.25.0",
     "dotenv": "^16.3.1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@
         "react": "^18.3.1",
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
-        "@modelcontextprotocol/ext-apps": ">=0.1.0",
+        "@modelcontextprotocol/ext-apps": "^1.0.0",
+        "@modelcontextprotocol/sdk": "^1.29.0",
+        "zod": "^3.25.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
         "lucide-react": "^0.294.0"
```

**File**: `typescript/packages/cli/templates/typescript-starter/package.json` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@
   "dependencies": {
     "dotenv": "^16.3.1",
     "@nitrostack/core": "^1",
-    "zod": "^3.22.4",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "zod": "^3.25.0",
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-starter/src/widgets/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
+    "zod": "^3.25.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/core/package.json` (modified, +2/-5)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/core",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "NitroStack Core - Build powerful MCP servers with TypeScript",
   "type": "module",
   "main": "dist/core/index.js",
@@ -45,9 +45,6 @@
   ],
   "author": "Nitrostack Inc <hello@nitrostack.ai>",
   "license": "Apache-2.0",
-  "peerDependencies": {
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
-  },
   "dependencies": {
     "@modelcontextprotocol/node": "^2.0.0",
     "@modelcontextprotocol/sdk": "^1.0.4",
@@ -62,7 +59,7 @@
     "uuid": "^11.0.5",
     "winston": "^3.17.0",
     "ws": "^8.18.3",
-    "zod": "^3.24.1",
+    "zod": "^3.25.28",
     "zod-to-json-schema": "^3.24.6"
   },
   "devDependencies": {
```

---

### Incident Patch 2: `b91780a2` (2026-09-23)
**Commit Message**: fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3

Published core 1.0.16 still peers ext-apps >=0.1.0, which resolves to 2.0.0 and Zod 4. Pin the templates, mark the widgets peer optional, and bump core, widgets, and CLI.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `typescript/packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/cli",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "CLI for NitroStack - Create and manage MCP server projects",
   "type": "module",
   "main": "dist/index.js",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
     "@nitrostack/core": "^1",
     "zod": "^3.25.0",
     "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0",
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
     "date-fns": "^4.1.0"
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
     "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
     "zod": "^3.25.0"
   },
   "devDependencies": {
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@
   "dependencies": {
     "@nitrostack/core": "^1",
     "zod": "^3.25.0",
-    "dotenv": "^16.3.1"
+    "dotenv": "^16.3.1",
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
         "@modelcontextprotocol/ext-apps": "^1.0.0",
+        "@modelcontextprotocol/sdk": "^1.29.0",
         "zod": "^3.25.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
```

**File**: `typescript/packages/cli/templates/typescript-starter/package.json` (modified, +2/-1)
```diff
@@ -16,7 +16,8 @@
   "dependencies": {
     "dotenv": "^16.3.1",
     "@nitrostack/core": "^1",
-    "zod": "^3.25.0"
+    "zod": "^3.25.0",
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-starter/src/widgets/package.json` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
     "@modelcontextprotocol/ext-apps": "^1.0.0",
+    "@modelcontextprotocol/sdk": "^1.29.0",
     "zod": "^3.25.0"
   },
   "devDependencies": {
```

**File**: `typescript/packages/core/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@nitrostack/core",
-  "version": "1.0.16",
+  "version": "1.0.17",
   "description": "NitroStack Core - Build powerful MCP servers with TypeScript",
   "type": "module",
   "main": "dist/core/index.js",
@@ -59,7 +59,7 @@
     "uuid": "^11.0.5",
     "winston": "^3.17.0",
     "ws": "^8.18.3",
-    "zod": "^3.25.0",
+    "zod": "^3.25.28",
     "zod-to-json-schema": "^3.24.6"
   },
   "devDependencies": {
```

---

### Incident Patch 3: `fdb33d96` (2026-09-23)
**Commit Message**: fix(deps): pin @modelcontextprotocol/ext-apps to 1.x and clean up core peer dependency

- Remove @modelcontextprotocol/ext-apps from @nitrostack/core peerDependencies
- In @nitrostack/widgets, pin @modelcontextprotocol/ext-apps to ^1.0.0 and mark optional in peerDependenciesMeta
- In CLI templates (starter, pizzaz, oauth), pin @modelcontextprotocol/ext-apps to ^1.0.0 to prevent pulling ext-apps 2.0.0 (which requires zod 4 while NitroStack relies on zod 3)

**File**: `typescript/packages/cli/templates/typescript-oauth/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@duffel/api": "^4.21.0",
     "axios": "^1.7.9",
     "date-fns": "^4.1.0",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-oauth/src/widgets/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "@nitrostack/core": "^1",
     "zod": "^3.22.4",
     "dotenv": "^16.3.1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-pizzaz/src/widgets/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
         "react": "^18.3.1",
         "react-dom": "^18.3.1",
         "@nitrostack/widgets": "^1",
-        "@modelcontextprotocol/ext-apps": ">=0.1.0",
+        "@modelcontextprotocol/ext-apps": "^1.0.0",
         "mapbox-gl": "^3.0.1",
         "framer-motion": "^10.16.16",
         "lucide-react": "^0.294.0"
```

**File**: `typescript/packages/cli/templates/typescript-starter/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "dotenv": "^16.3.1",
     "@nitrostack/core": "^1",
     "zod": "^3.22.4",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@nitrostack/cli": "^1",
```

**File**: `typescript/packages/cli/templates/typescript-starter/src/widgets/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
     "@nitrostack/widgets": "^1",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
   },
   "devDependencies": {
     "@types/node": "^20",
```

**File**: `typescript/packages/core/package.json` (modified, +0/-3)
```diff
@@ -45,9 +45,6 @@
   ],
   "author": "Nitrostack Inc <hello@nitrostack.ai>",
   "license": "Apache-2.0",
-  "peerDependencies": {
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
-  },
   "dependencies": {
     "@modelcontextprotocol/node": "^2.0.0",
     "@modelcontextprotocol/sdk": "^1.0.4",
```

**File**: `typescript/packages/widgets/package.json` (modified, +6/-1)
```diff
@@ -43,7 +43,12 @@
   "license": "Apache-2.0",
   "peerDependencies": {
     "react": "^18.0.0 || ^19.0.0",
-    "@modelcontextprotocol/ext-apps": ">=0.1.0"
+    "@modelcontextprotocol/ext-apps": "^1.0.0"
+  },
+  "peerDependenciesMeta": {
+    "@modelcontextprotocol/ext-apps": {
+      "optional": true
+    }
   },
   "devDependencies": {
     "@testing-library/jest-dom": "^6.9.1",
```

---

### Incident Patch 4: `0cca3e07` (2026-09-04)
**Commit Message**: fix: update port resolution logic to prioritize process.env.PORT over oauthConfig resourceUri

**File**: `typescript/packages/core/src/core/app-decorator.ts` (modified, +16/-7)
```diff
@@ -421,13 +421,22 @@ export class McpApplicationFactory {
       // This allows Studio to connect via STDIO while exposing OAuth metadata via HTTP
       transportType = 'dual';
       
-      // Extract port from resourceUri (e.g., http://localhost:3002)
-      let port = 3000;
-      try {
-        const resourceUrl = new URL(oauthConfig.resourceUri);
-        port = resourceUrl.port ? parseInt(resourceUrl.port) : (resourceUrl.protocol === 'https:' ? 443 : 80);
-      } catch (error) {
-        logger.warn(`Failed to parse resourceUri for port, using default 3000`);
+      // Extract port: explicit config > process.env.PORT > resourceUri explicit port > default 3000
+      let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
+      if (oauthConfig.resourceUri) {
+        try {
+          const resourceUrl = new URL(oauthConfig.resourceUri);
+          if (resourceUrl.port) {
+            port = parseInt(resourceUrl.port, 10);
+          }
+        } catch (error) {
+          logger.warn(`Failed to parse resourceUri for port, using default ${port}`);
+        }
+      }
+      
+      // Override with process.env.PORT if set (environment takes precedence over resourceUri URL)
+      if (process.env.PORT) {
+        port = parseInt(process.env.PORT, 10);
       }
       
       // Override with explicit config if provided
```

---

### Incident Patch 5: `568b4f8d` (2026-09-04)
**Commit Message**: feat: add timeout and AbortSignal support to CIMD resolution with corresponding tests

**File**: `typescript/packages/core/src/auth/cimd.ts` (modified, +28/-0)
```diff
@@ -321,6 +321,8 @@ export async function readBoundedJson<T = unknown>(
   throw new Error('Unable to read response body');
 }
 
+export const DEFAULT_CIMD_FETCH_TIMEOUT_MS = 5000;
+
 /**
  * Resolve a client's CIMD by fetching its `client_id` URL and validating it.
  * Authorization servers call this in place of a DCR lookup.
@@ -332,6 +334,8 @@ export async function resolveClientIdMetadataDocument(
     allowLoopback?: boolean;
     dnsLookupImpl?: typeof dns.lookup;
     maxDocumentBytes?: number;
+    timeoutMs?: number;
+    signal?: AbortSignal;
   },
 ): Promise<ClientIdMetadataDocument> {
   const allowLoopback = options?.allowLoopback ?? (process.env.NODE_ENV !== 'production');
@@ -344,11 +348,35 @@ export async function resolveClientIdMetadataDocument(
     }
   }
 
+  const timeoutMs = options?.timeoutMs ?? DEFAULT_CIMD_FETCH_TIMEOUT_MS;
+  const timeoutSignal = typeof AbortSignal.timeout === 'function'
+    ? AbortSignal.timeout(timeoutMs)
+    : (() => {
+        const controller = new AbortController();
+        const timer = setTimeout(() => controller.abort(new Error(`CIMD request timed out after ${timeoutMs}ms`)), timeoutMs);
+        if (typeof (timer as any).unref === 'function') (timer as any).unref();
+        return controller.signal;
+      })();
+
+  let effectiveSignal = timeoutSignal;
+  if (options?.signal) {
+    if (typeof AbortSignal.any === 'function') {
+      effectiveSignal = AbortSignal.any([options.signal, timeoutSignal]);
+    } else {
+      const controller = new AbortController();
+      const onAbort = () => controller.abort();
+      options.signal.addEventListener('abort', onAbort, { once: true });
+      timeoutSignal.addEventListener('abort', onAbort, { once: true });
+      effectiveSignal = controller.signal;
+    }
+  }
+
   const doFetch = options?.fetchImpl ?? fetch;
   const response = await doFetch(clientIdUrl, {
     method: 'GET',
     headers: { Accept: 'application/json' },
     redirect: 'error',
+    signal: effectiveSignal,
   });
   if (response.status !== 200) {
     throw new Error(`Failed to resolve CIMD from ${clientIdUrl}: HTTP ${response.status} (expected 200 OK)`);
```

**File**: `typescript/packages/core/src/auth/index.ts` (modified, +1/-0)
```diff
@@ -117,6 +117,7 @@ export {
   assertSafeFetchTarget,
   readBoundedJson,
   MAX_CIMD_DOCUMENT_BYTES,
+  DEFAULT_CIMD_FETCH_TIMEOUT_MS,
   type ClientIdMetadataDocument,
 } from './cimd.js';
 
```

**File**: `typescript/packages/core/src/core/__tests__/protocol-2026/auth-hardening.test.ts` (modified, +50/-0)
```diff
@@ -285,5 +285,55 @@ describe('CIMD (Client ID Metadata Documents)', () => {
       ).toThrow(/dot/i);
     });
   });
+
+  describe('CIMD Request Timeout & AbortSignal (F-06-02)', () => {
+    it('aborts when document fetch exceeds configured timeout', async () => {
+      const { resolveClientIdMetadataDocument, DEFAULT_CIMD_FETCH_TIMEOUT_MS } = await import('../../../auth/cimd.js');
+      expect(DEFAULT_CIMD_FETCH_TIMEOUT_MS).toBe(5000);
+
+      const slowFetch = (async (_url: string, init?: RequestInit) => {
+        return new Promise<Response>((_, reject) => {
+          init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
+        });
+      }) as unknown as typeof fetch;
+
+      const dnsLookupImpl = (async () => [{ address: '93.184.216.34', family: 4 }]) as any;
+
+      await expect(
+        resolveClientIdMetadataDocument('https://client.example.com/id.json', {
+          fetchImpl: slowFetch,
+          dnsLookupImpl,
+          timeoutMs: 50,
+        })
+      ).rejects.toThrow(/aborted/i);
+    });
+
+    it('propagates caller-supplied AbortSignal', async () => {
+      const { resolveClientIdMetadataDocument } = await import('../../../auth/cimd.js');
+      const controller = new AbortController();
+      controller.abort();
+
+      const mockFetch = (async (_url: string, init?: RequestInit) => {
+        if (init?.signal?.aborted) {
+          throw new Error('This operation was aborted');
+        }
+        return {
+          ok: true,
+          status: 200,
+          json: async () => ({ client_id: 'https://client.example.com/id.json', redirect_uris: [] }),
+        } as unknown as Response;
+      }) as unknown as typeof fetch;
+
+      const dnsLookupImpl = (async () => [{ address: '93.184.216.34', family: 4 }]) as any;
+
+      await expect(
+        resolveClientIdMetadataDocument('https://client.example.com/id.json', {
+          fetchImpl: mockFetch,
+          dnsLookupImpl,
+          signal: controller.signal,
+        })
+      ).rejects.toThrow(/aborted/i);
+    });
+  });
 });
 
```

---

### Incident Patch 6: `0fc0e99c` (2026-09-04)
**Commit Message**: feat: implement strict Client Identifier URL validation for CIMD per OAuth requirements

**File**: `typescript/packages/core/src/auth/cimd.ts` (modified, +52/-7)
```diff
@@ -37,6 +37,56 @@ export interface ClientIdMetadataDocument {
   [key: string]: unknown;
 }
 
+/**
+ * Strict validation of a Client Identifier URL per draft-ietf-oauth-client-id-metadata-document-02 §2.
+ */
+export function validateClientIdentifierUrl(urlStr: string, allowLoopback = true): URL {
+  if (typeof urlStr !== 'string' || !urlStr) {
+    throw new Error(`Invalid Client Identifier URL: "${urlStr}"`);
+  }
+
+  let parsed: URL;
+  try {
+    parsed = new URL(urlStr);
+  } catch {
+    throw new Error(`Invalid Client Identifier URL: "${urlStr}"`);
+  }
+
+  // Scheme check
+  if (parsed.protocol !== 'https:') {
+    const isLoopback = allowLoopback && parsed.protocol === 'http:' &&
+      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]' || parsed.hostname === '::1');
+    if (!isLoopback) {
+      throw new Error(`CIMD client_id must be an HTTPS URL, got: "${urlStr}"`);
+    }
+  }
+
+  // Userinfo check
+  if (parsed.username || parsed.password) {
+    throw new Error(`CIMD client_id URL must not contain userinfo: "${urlStr}"`);
+  }
+
+  // Fragment check
+  if (parsed.hash) {
+    throw new Error(`CIMD client_id URL must not contain a fragment component: "${urlStr}"`);
+  }
+
+  // Path check (must not be bare domain / empty path)
+  const rawPath = urlStr.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+/, '');
+  if (!rawPath || rawPath === '/' || !parsed.pathname || parsed.pathname === '/') {
+    throw new Error(`CIMD client_id URL must contain a path component (cannot be bare domain): "${urlStr}"`);
+  }
+
+  // Dot segments check
+  const pathWithoutQuery = rawPath.split('?')[0].split('#')[0];
+  const segments = pathWithoutQuery.split('/');
+  if (segments.some((seg) => seg === '.' || seg === '..')) {
+    throw new Error(`CIMD client_id URL must not contain single-dot or double-dot path segments: "${urlStr}"`);
+  }
+
+  return parsed;
+}
+
 /**
  * Build a Client ID Metadata Document for this client.
  *
@@ -46,14 +96,9 @@ export interface ClientIdMetadataDocument {
 export function createClientIdMetadataDocument(
   clientIdUrl: string,
   metadata: { redirect_uris: string[] } & Partial<Omit<ClientIdMetadataDocument, 'client_id' | 'redirect_uris'>>,
+  options?: { allowLoopback?: boolean },
 ): ClientIdMetadataDocument {
-  if (!/^https:\/\//i.test(clientIdUrl)) {
-    // CIMD requires HTTPS (loopback http is only tolerated in dev).
-    const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(clientIdUrl);
-    if (!isLoopback) {
-      throw new Error(`CIMD client_id must be an HTTPS URL, got: ${clientIdUrl}`);
-    }
-  }
+  validateClientIdentifierUrl(clientIdUrl, options?.allowLoopback ?? true);
   return { ...metadata, client_id: clientIdUrl };
 }
 
```

**File**: `typescript/packages/core/src/auth/index.ts` (modified, +1/-0)
```diff
@@ -110,6 +110,7 @@ export {
 export {
   createClientIdMetadataDocument,
   validateClientIdMetadataDocument,
+  validateClientIdentifierUrl,
   resolveClientIdMetadataDocument,
   isClientIdMetadataUrl,
   isSpecialUseIp,
```

**File**: `typescript/packages/core/src/core/__tests__/protocol-2026/auth-hardening.test.ts` (modified, +42/-0)
```diff
@@ -243,5 +243,47 @@ describe('CIMD (Client ID Metadata Documents)', () => {
       })
     ).rejects.toThrow(/maximum allowed size/i);
   });
+
+  describe('CIMD URL Component Validation (F-04-01)', () => {
+    it('rejects URLs containing userinfo (username / password)', async () => {
+      const { createClientIdMetadataDocument, validateClientIdentifierUrl } = await import('../../../auth/cimd.js');
+      expect(() =>
+        createClientIdMetadataDocument('https://user:pass@client.example.com/id.json', { redirect_uris: [] })
+      ).toThrow(/userinfo/i);
+      expect(() =>
+        validateClientIdentifierUrl('https://admin@client.example.com/id.json')
+      ).toThrow(/userinfo/i);
+    });
+
+    it('rejects URLs containing a fragment component', async () => {
+      const { createClientIdMetadataDocument, validateClientIdentifierUrl } = await import('../../../auth/cimd.js');
+      expect(() =>
+        createClientIdMetadataDocument('https://client.example.com/id.json#section', { redirect_uris: [] })
+      ).toThrow(/fragment/i);
+      expect(() =>
+        validateClientIdentifierUrl('https://client.example.com/id.json#token')
+      ).toThrow(/fragment/i);
+    });
+
+    it('rejects URLs without a path component (bare origin)', async () => {
+      const { createClientIdMetadataDocument, validateClientIdentifierUrl } = await import('../../../auth/cimd.js');
+      expect(() =>
+        createClientIdMetadataDocument('https://client.example.com', { redirect_uris: [] })
+      ).toThrow(/path component/i);
+      expect(() =>
+        validateClientIdentifierUrl('https://client.example.com/')
+      ).toThrow(/path component/i);
+    });
+
+    it('rejects URLs containing single-dot or double-dot path segments', async () => {
+      const { createClientIdMetadataDocument, validateClientIdentifierUrl } = await import('../../../auth/cimd.js');
+      expect(() =>
+        createClientIdMetadataDocument('https://client.example.com/a/../b/id.json', { redirect_uris: [] })
+      ).toThrow(/dot/i);
+      expect(() =>
+        validateClientIdentifierUrl('https://client.example.com/./id.json')
+      ).toThrow(/dot/i);
+    });
+  });
 });
 
```

---

### Incident Patch 7: `b79ebf31` (2026-09-03)
**Commit Message**: refactor: decouple task storage by introducing a pluggable TaskStore interface and default InMemoryTaskStore implementation

**File**: `typescript/packages/core/src/core/task.ts` (modified, +100/-33)
```diff
@@ -132,51 +132,106 @@ export interface TaskEntry {
     sessionId?: string;
 }
 
+// ============================================================================
+// Pluggable Task Store Abstraction
+// ============================================================================
+
+/**
+ * TaskStore interface for abstracting task state storage.
+ * Defaults to InMemoryTaskStore and allows drop-in distributed backends (Redis, PostgreSQL, DynamoDB)
+ * to support multi-replica horizontally scaled deployments.
+ */
+export interface TaskStore {
+    get(taskId: string): TaskEntry | undefined;
+    set(taskId: string, entry: TaskEntry): void;
+    delete(taskId: string): boolean;
+    has(taskId: string): boolean;
+    list(): TaskEntry[];
+    cleanupExpired?(now: number): number;
+    destroy?(): void;
+}
+
+/**
+ * In-memory implementation of TaskStore.
+ */
+export class InMemoryTaskStore implements TaskStore {
+    private tasks: Map<string, TaskEntry> = new Map();
+
+    get(taskId: string): TaskEntry | undefined {
+        return this.tasks.get(taskId);
+    }
+
+    set(taskId: string, entry: TaskEntry): void {
+        this.tasks.set(taskId, entry);
+    }
+
+    delete(taskId: string): boolean {
+        return this.tasks.delete(taskId);
+    }
+
+    has(taskId: string): boolean {
+        return this.tasks.has(taskId);
+    }
+
+    list(): TaskEntry[] {
+        return Array.from(this.tasks.values());
+    }
+
+    cleanupExpired(now: number): number {
+        let count = 0;
+        for (const [taskId, entry] of this.tasks.entries()) {
+            if (entry.data.ttl === null) continue;
+            if (!isTerminalStatus(entry.data.status)) continue;
+            const terminalTime = new Date(entry.data.lastUpdatedAt).getTime();
+            if (now - terminalTime > entry.data.ttl) {
+                this.tasks.delete(taskId);
+                count++;
+            }
+        }
+        return count;
+    }
+
+    destroy(): void {
+        this.tasks.clear();
+    }
+}
+
 // ============================================================================
 // Task Manager
 // ============================================================================
 
+export interface TaskManagerOptions {
+    logger: Logger;
+    /** Custom pluggable task store (default: InMemoryTaskStore) */
+    store?: TaskStore;
+    /** Default TTL in ms (default: 300000 = 5 minutes) */
+    defaultTtl?: number;
+    /** Default poll interval in ms (default: 2000 = 2 seconds) */
+    defaultPollInterval?: number;
+    /** Callback fired on every status change (for notifications) */
+    onStatusChange?: (taskData: TaskData) => void;
+}
+
 /**
  * TaskManager handles the full lifecycle of MCP tasks.
  * 
  * It provides:
- * - In-memory task storage with TTL-based cleanup
+ * - Pluggable task storage (in-memory or distributed) with TTL cleanup
  * - Task creation, status updates, and result retrieval
  * - Cancellation support
  * - Status change notifications via callbacks
- * 
- * @example
- * ```typescript
- * const taskManager = new TaskManager({ logger, defaultTtl: 60000 });
- * 
- * // Create a task for a long-running operation
- * const task = taskManager.createTask({ ttl: 120000 });
- * 
- * // Update status as work progresses
- * taskManager.updateStatus(task.taskId, 'working', 'Processing step 2 of 5');
- * 
- * // Complete with result
- * taskManager.completeTask(task.taskId, { data: 'result' });
- * ```
  */
 export class TaskManager {
-    private tasks: Map<string, TaskEntry> = new Map();
+    private store: TaskStore;
     private logger: Logger;
     private defaultTtl: number;
     private defaultPollInterval: number;
     private cleanupInterval?: ReturnType<typeof setInterval>;
     private onStatusChange?: (taskData: TaskData) => void;
 
-    constructor(options: {
-        logger: Logger;
-        /** Default TTL in ms (default: 300000 = 5 minutes) */
-        defaultTtl?: number;
-        /** Default poll interval in ms (default: 2000 = 2 seconds) */
-        defaultPollInterval?: number;
-        /** Callback fired on every status change (for notifications) */
-        onStatusChange?: (taskData: TaskData) => void;
-    }) {
+    constructor(options: TaskManagerOptions) {
         this.logger = options.logger;
+        this.store = options.store ?? new InMemoryTaskStore();
         this.defaultTtl = options.defaultTtl ?? 300000; // 5 minutes
         this.defaultPollInterval = options.defaultPollInterval ?? 2000;
         this.onStatusChange = options.onStatusChange;
@@ -185,6 +240,11 @@ export class TaskManager {
         this.cleanupInterval = setInterval(() => this.cleanupExpiredTasks(), 30000);
     }
 
+    /** Access the underlying TaskStore */
+    getStore(): TaskStore {
+        return this.store;
+    }
+
     /**
      * Create a new task
      */
@@ -225,7 +285,7 @@ export class TaskManager {
             sessionId,
         };
 
-        this.tasks.set(taskId, entry);
+        this.store.s
```

---

### Incident Patch 8: `764e5684` (2026-09-03)
**Commit Message**: fix: prevent task status updates for cancelled tasks and add integration suite for MCP tasks protocol

**File**: `typescript/packages/core/src/core/__tests__/protocol-2026/tasks.integration.test.ts` (added, +378/-0)
```diff
@@ -0,0 +1,378 @@
+/**
+ * Modern (2026-07-28) MCP Tasks Protocol Integration Test Suite.
+ *
+ * Verifies end-to-end task lifecycle, multi-tenant isolation, cooperative abort,
+ * and single-step embedded result delivery over the modern protocol adapter.
+ */
+
+import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
+import { NitroStackServer } from '../../server.js';
+import { Tool } from '../../tool.js';
+import { z } from 'zod';
+
+const MODERN = '2026-07-28';
+const META_PROTOCOL = 'io.modelcontextprotocol/protocolVersion';
+const META_CLIENT_CAPS = 'io.modelcontextprotocol/clientCapabilities';
+const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
+
+interface RpcResult {
+  status: number;
+  headers: Headers;
+  body: {
+    jsonrpc?: string;
+    id?: unknown;
+    result?: Record<string, any>;
+    error?: { code: number; message: string; data?: unknown };
+  };
+}
+
+function createModernRequest(
+  method: string,
+  params: Record<string, unknown> = {},
+  options: {
+    id?: number | string;
+    clientName?: string;
+    protocolVersion?: string;
+    toolName?: string;
+    extraHeaders?: Record<string, string>;
+    auth?: { userId?: string; tenantId?: string; sessionId?: string };
+  } = {},
+): Request {
+  const envelope = {
+    [META_PROTOCOL]: options.protocolVersion ?? MODERN,
+    [META_CLIENT_CAPS]: {},
+    [META_CLIENT_INFO]: { name: options.clientName ?? 'jest-modern-task-client', version: '1.0.0' },
+  };
+
+  const body = {
+    jsonrpc: '2.0',
+    id: options.id ?? 1,
+    method,
+    params: {
+      ...params,
+      _meta: envelope,
+    },
+  };
+
+  const headers: Record<string, string> = {
+    'Content-Type': 'application/json',
+    Accept: 'application/json',
+    'MCP-Protocol-Version': options.protocolVersion ?? MODERN,
+    'Mcp-Method': method,
+    ...(options.toolName ? { 'Mcp-Name': options.toolName } : {}),
+    ...(options.auth?.sessionId ? { 'Mcp-Session-Id': options.auth.sessionId } : {}),
+    ...(options.extraHeaders ?? {}),
+  };
+
+  const req = new Request('http://localhost/mcp', {
+    method: 'POST',
+    headers,
+    body: JSON.stringify(body),
+  });
+
+  if (options.auth) {
+    (req as any).auth = {
+      userId: options.auth.userId,
+      tenantId: options.auth.tenantId,
+    };
+  }
+
+  return req;
+}
+
+async function readRpc(res: Response): Promise<RpcResult> {
+  const text = await res.text();
+  try {
+    return { status: res.status, headers: res.headers, body: JSON.parse(text) };
+  } catch {
+    return { status: res.status, headers: res.headers, body: {} };
+  }
+}
+
+describe('Modern MCP 2.0 Tasks Protocol Integration Suite', () => {
+  let server: NitroStackServer;
+  let handler: { fetch: (req: Request) => Promise<Response>; close: () => Promise<void> };
+
+  beforeAll(async () => {
+    server = new NitroStackServer({
+      name: 'modern-task-test-server',
+      version: '1.0.0',
+      protocolVersion: MODERN,
+    });
+
+    // 1. Long running task tool with progress updates
+    server.tool(
+      new Tool({
+        name: 'data_pipeline',
+        description: 'Multi-stage data pipeline',
+        inputSchema: z.object({
+          stages: z.number().default(3),
+          stageDelayMs: z.number().default(30),
+        }),
+        taskSupport: 'optional',
+        handler: async (args: any, ctx) => {
+          const totalStages = args.stages ?? 3;
+          const delay = args.stageDelayMs ?? 30;
+
+          for (let i = 1; i <= totalStages; i++) {
+            if (ctx?.task) {
+              ctx.task.throwIfCancelled();
+              await ctx.task.updateProgress(`Processing stage ${i}/${totalStages}`);
+            }
+            await new Promise((r) => setTimeout(r, delay));
+          }
+
+          return {
+            stagesCompleted: totalStages,
+            outputRecords: 42,
+          };
+        },
+      }),
+    );
+
+    // 2. Mandatory task tool
+    server.tool(
+      new Tool({
+        name: 'mandatory_export',
+        description: 'Export job that strictly requires task augmentation',
+        inputSchema: z.object({ format: z.string() }),
+        taskSupport: 'required',
+        handler: async (args: any) => ({ exported: true, format: args.format }),
+      }),
+    );
+
+    // 3. Forbidden task tool
+    server.tool(
+      new Tool({
+        name: 'instant_lookup',
+        description: 'Instant lookup that strictly forbids task augmentation',
+        inputSchema: z.object({ key: z.string() }),
+        taskSupport: 'forbidden',
+        handler: async (args: any) => ({ value: `val_${args.key}` }),
+      }),
+    );
+
+    const adapter = await (server as unknown as { getModernAdapter: () => Promise<any> }).getModernAdapter();
+    handler = await adapter.getHttpHandler();
+  });
+
+  afterAll(async () => {
+    await handler?.close?.();
+    await server.stop();
+  });
+
+  it('creates task via tools/call returning CreateTaskResult immediately', async 
```

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +12/-2)
```diff
@@ -772,9 +772,19 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
         Promise.resolve().then(async () => {
           try {
             const toolResult = await tool.execute(params.arguments || {}, executionContext);
-            tm.completeTask(taskId, toolResult, undefined, accessContext);
+            if (tm.hasTask(taskId)) {
+              const current = tm.getTask(taskId);
+              if (current.status !== 'cancelled') {
+                tm.completeTask(taskId, toolResult, undefined, accessContext);
+              }
+            }
           } catch (err: any) {
-            tm.failTask(taskId, { code: err.code || -32603, message: err.message || String(err) }, undefined, accessContext);
+            if (tm.hasTask(taskId)) {
+              const current = tm.getTask(taskId);
+              if (current.status !== 'cancelled') {
+                tm.failTask(taskId, { code: err.code || -32603, message: err.message || String(err) }, undefined, accessContext);
+              }
+            }
           }
         });
 
```

---

### Incident Patch 9: `8044d47d` (2026-09-03)
**Commit Message**: feat: enforce tool-level task support requirements in modern-v2 adapter

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +14/-1)
```diff
@@ -34,7 +34,7 @@ import { isInputRequired } from './features/mrtr.js';
 import { isMcpAppMode, isOpenAiMode } from '../app-mode.js';
 import type { Tool } from '../tool.js';
 import type { ExecutionContext, JsonValue } from '../types.js';
-import { TaskManager, TaskContext, type TaskAccessContext } from '../task.js';
+import { TaskManager, TaskContext, TaskAugmentationRequiredError, type TaskAccessContext } from '../task.js';
 
 /* eslint-disable @typescript-eslint/no-explicit-any */
 type AnyRecord = Record<string, any>;
@@ -369,6 +369,19 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
 
   private async runTool(tool: Tool, args: AnyRecord, ctx: AnyRecord, sdk: ServerSdk): Promise<AnyRecord> {
     const context = this.buildContext(ctx, { toolName: tool.name });
+    const isTaskAugmented = ctx?.task !== undefined || ctx?.mcpReq?.params?.task !== undefined;
+
+    // Enforce tool-level task support negotiation
+    if (tool.taskSupport === 'required' && !isTaskAugmented) {
+      throw this.toSdkError(new TaskAugmentationRequiredError(), sdk);
+    }
+    if (tool.taskSupport === 'forbidden' && isTaskAugmented) {
+      throw this.toSdkError({
+        code: -32601,
+        message: `Tool '${tool.name}' does not support task augmentation`,
+      }, sdk);
+    }
+
     try {
       const result = await tool.execute(args, context);
 
```

---

### Incident Patch 10: `a92637db` (2026-09-03)
**Commit Message**: test: add suite validating TTL and eviction protection for active versus terminal task states

**File**: `typescript/packages/core/src/core/__tests__/task.test.ts` (modified, +89/-0)
```diff
@@ -580,3 +580,92 @@ describe('Multi-Tenancy and Authorization Isolation', () => {
         expect(manager.hasTask(task.taskId, tenant2Ctx)).toBe(false);
     });
 });
+
+// ─── TTL and Cleanup Eviction Protection Tests ──────────────────────────────
+describe('TTL and Cleanup Eviction Protection', () => {
+    let manager: TaskManager;
+
+    beforeEach(() => {
+        manager = createManager();
+    });
+
+    afterEach(() => {
+        manager.destroy();
+    });
+
+    it('does NOT evict an active task in working status even if duration exceeds TTL', async () => {
+        // Create task with very small TTL (50ms)
+        const task = manager.createTask({ ttl: 50 }, 'long_working_tool');
+
+        // Wait 80ms (longer than TTL) while task is actively working
+        await new Promise(r => setTimeout(r, 80));
+
+        // Trigger sweeper cleanup
+        (manager as any).cleanupExpiredTasks();
+
+        // Verify task was NOT evicted
+        expect(manager.hasTask(task.taskId)).toBe(true);
+        const current = manager.getTask(task.taskId);
+        expect(current.status).toBe('working');
+    });
+
+    it('does NOT evict an active task in input_required status even if duration exceeds TTL', async () => {
+        const task = manager.createTask({ ttl: 50 }, 'input_tool');
+        manager.updateStatus(task.taskId, 'input_required', 'waiting for user');
+
+        await new Promise(r => setTimeout(r, 80));
+
+        (manager as any).cleanupExpiredTasks();
+
+        expect(manager.hasTask(task.taskId)).toBe(true);
+        const current = manager.getTask(task.taskId);
+        expect(current.status).toBe('input_required');
+    });
+
+    it('evicts completed task only after terminal completion time exceeds TTL', async () => {
+        const task = manager.createTask({ ttl: 50 }, 'complete_tool');
+
+        // Complete the task
+        manager.completeTask(task.taskId, { done: true });
+
+        // Run cleanup immediately: must still exist
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(true);
+
+        // Wait for TTL after completion (80ms)
+        await new Promise(r => setTimeout(r, 80));
+
+        // Run cleanup: must now be evicted
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(false);
+    });
+
+    it('evicts cancelled task only after terminal cancellation time exceeds TTL', async () => {
+        const task = manager.createTask({ ttl: 50 }, 'cancel_tool');
+        manager.cancelTask(task.taskId);
+
+        // Run cleanup immediately: still exists
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(true);
+
+        // Wait past TTL
+        await new Promise(r => setTimeout(r, 80));
+
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(false);
+    });
+
+    it('evicts failed task only after terminal failure time exceeds TTL', async () => {
+        const task = manager.createTask({ ttl: 50 }, 'fail_tool');
+        manager.failTask(task.taskId, { code: -32000, message: 'boom' });
+
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(true);
+
+        await new Promise(r => setTimeout(r, 80));
+
+        (manager as any).cleanupExpiredTasks();
+        expect(manager.hasTask(task.taskId)).toBe(false);
+    });
+});
+
```

---

### Incident Patch 11: `eebfeef3` (2026-09-01)
**Commit Message**: fix(core): match clean widget filename when resolving bundled html files

**File**: `typescript/packages/core/src/core/server.ts` (modified, +27/-32)
```diff
@@ -437,40 +437,35 @@ export class NitroStackServer {
       handler: async (uri: string, context) => {
         context.logger.info(`Serving component: ${uri}`);
 
-        // In production, serve the bundled HTML file if available
-        if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') {
-          try {
-            // Check if we have a bundled file for this component
-            // The component ID usually matches the widget output name
-            const widgetId = component.id;
-            // We need to find where the widgets are located relative to the running server
-            // In production, we expect them in src/widgets/out or dist/widgets/out
-
-            // Try to find the bundled file
-            const fs = await import('fs');
-            const path = await import('path');
-
-            // Possible locations for bundled widgets
-            const possiblePaths = [
-              path.join(process.cwd(), 'src/widgets/out', `${widgetId}.html`),
-              path.join(process.cwd(), 'dist/widgets/out', `${widgetId}.html`),
-              path.join(process.cwd(), 'widgets/out', `${widgetId}.html`)
-            ];
-
-            for (const p of possiblePaths) {
-              if (fs.existsSync(p)) {
-                const html = fs.readFileSync(p, 'utf-8');
-                return {
-                  type: 'text' as const,
-                  data: html
-                };
-              }
+        // Serve the bundled HTML file if available
+        try {
+          const widgetId = component.id;
+          const cleanId = widgetId.replace(/^next-/, '');
+          const fs = await import('fs');
+          const path = await import('path');
+
+          const possiblePaths = [
+            path.join(process.cwd(), 'src/widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'src/widgets/out', `${widgetId}.html`),
+            path.join(process.cwd(), 'dist/widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'dist/widgets/out', `${widgetId}.html`),
+            path.join(process.cwd(), 'widgets/out', `${cleanId}.html`),
+            path.join(process.cwd(), 'widgets/out', `${widgetId}.html`),
+          ];
+
+          for (const p of possiblePaths) {
+            if (fs.existsSync(p)) {
+              const html = fs.readFileSync(p, 'utf-8');
+              return {
+                type: 'text' as const,
+                data: html,
+              };
             }
-
-            context.logger.warn(`Bundled widget not found for ${widgetId}, falling back to default bundle`);
-          } catch (error) {
-            context.logger.error(`Error serving bundled widget: ${error}`);
           }
+
+          context.logger.warn(`Bundled widget not found for ${widgetId} (${cleanId}), falling back to default bundle`);
+        } catch (error) {
+          context.logger.error(`Error serving bundled widget: ${error}`);
         }
 
         return {
```

---

### Incident Patch 12: `bd739c4b` (2026-09-01)
**Commit Message**: fix(core): add ping handler to modern adapter for client heartbeat and connection monitoring

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +35/-1)
```diff
@@ -562,12 +562,35 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
   async getHttpHandler(): Promise<AnyRecord> {
     if (!this.handler) {
       const sdk = await this.loadServerSdk();
-      this.handler = sdk.createMcpHandler(() => this.buildServer(), {
+      const rawHandler = sdk.createMcpHandler(() => this.buildServer(), {
         legacy: this.options.legacyMode,
         onerror: (error: Error) => {
           this.registry.logger.error('Modern MCP handler error', { error: error.message });
         },
       });
+
+      const rawFetch = rawHandler.fetch;
+      this.handler = {
+        ...rawHandler,
+        fetch: async (request: Request, requestOptions?: AnyRecord) => {
+          if (request.headers.get('mcp-method') === 'ping') {
+            try {
+              const clone = request.clone();
+              const json = (await clone.json()) as AnyRecord;
+              return new Response(JSON.stringify({ jsonrpc: '2.0', id: json?.id ?? null, result: {} }), {
+                status: 200,
+                headers: { 'Content-Type': 'application/json' },
+              });
+            } catch {
+              return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, result: {} }), {
+                status: 200,
+                headers: { 'Content-Type': 'application/json' },
+              });
+            }
+          }
+          return rawFetch(request, requestOptions);
+        },
+      };
     }
     return this.handler;
   }
@@ -589,6 +612,17 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
           ? (req as AnyRecord).body
           : undefined;
 
+      // Handle ping directly for studio heartbeat / health monitoring
+      if (parsedBody && parsedBody.method === 'ping') {
+        res.setHeader('Content-Type', 'application/json');
+        res.status(200).json({
+          jsonrpc: '2.0',
+          id: parsedBody.id ?? null,
+          result: {},
+        });
+        return;
+      }
+
       Promise.resolve(nodeHandler(req, res, parsedBody)).catch((err: unknown) => {
         this.registry.logger.error('Modern MCP request failed', {
           error: err instanceof Error ? err.message : String(err),
```

---

### Incident Patch 13: `d6dde4cc` (2026-09-01)
**Commit Message**: fix(core): preserve widget metadata on modern tool registration and support custom widget resource URIs

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +101/-1)
```diff
@@ -126,8 +126,51 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
       if (outputSchema) config.outputSchema = outputSchema;
       if (tool.annotations) config.annotations = tool.annotations;
 
+      const meta: AnyRecord = {};
       const cacheHint = resolveToolCacheHint(tool);
-      if (cacheHint) config._meta = { 'io.modelcontextprotocol/cacheHint': cacheHint };
+      if (cacheHint) meta['io.modelcontextprotocol/cacheHint'] = cacheHint;
+
+      if (tool.hasComponent && tool.hasComponent()) {
+        const component = tool.getComponent()!;
+        const resourceUri = component.getResourceUri();
+        const componentMeta = component.getResourceMetadata() as Record<string, unknown> | undefined;
+
+        meta['ui/template'] = resourceUri;
+        meta['openai/outputTemplate'] = resourceUri;
+        meta['ui'] = { resourceUri };
+        if (componentMeta) {
+          if (componentMeta['openai/widgetCSP'] !== undefined) {
+            meta['openai/widgetCSP'] = componentMeta['openai/widgetCSP'];
+          }
+          if (componentMeta['openai/widgetDescription'] !== undefined) {
+            meta['openai/widgetDescription'] = componentMeta['openai/widgetDescription'];
+          }
+          if (componentMeta['openai/widgetPrefersBorder'] !== undefined) {
+            meta['openai/widgetPrefersBorder'] = componentMeta['openai/widgetPrefersBorder'];
+          }
+          if (componentMeta['openai/widgetDomain'] !== undefined) {
+            meta['openai/widgetDomain'] = componentMeta['openai/widgetDomain'];
+          }
+        }
+      } else if (tool.widget?.route || tool.outputTemplate) {
+        const route = tool.widget?.route || tool.outputTemplate;
+        const normalized = route?.startsWith('/') ? route : `/${route}`;
+        const resourceUri = `/widgets${normalized}`;
+        meta['ui/template'] = resourceUri;
+        meta['openai/outputTemplate'] = resourceUri;
+        meta['ui'] = { resourceUri };
+      }
+
+      if (tool.examples) {
+        meta['tool/examples'] = tool.examples;
+      }
+      if (tool.isInitial) {
+        meta['tool/initial'] = true;
+      }
+
+      if (Object.keys(meta).length > 0) {
+        config._meta = meta;
+      }
 
       server.registerTool(
         tool.name,
@@ -189,6 +232,63 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
         });
       }
     }
+
+    // Modern SDK v2 strictly validates URIs using `new URL(uri)`. To support custom
+    // or relative URI schemes such as `/widgets/*` used by NitroStudio and MCP Apps,
+    // attach a fallback resources/read handler on the underlying MCP server.
+    if (server.server && typeof server.server.setRequestHandler === 'function') {
+      const rawResources = this.registry.getResources();
+      server.server.setRequestHandler('resources/read', async (request: AnyRecord, ctx: AnyRecord) => {
+        const reqUri = String(request?.params?.uri ?? '');
+        // 1. Check exact match in registered resources (including path-based URIs like /widgets/...)
+        const matchingResource = rawResources.get(reqUri);
+        if (matchingResource) {
+          const resResult = await this.readResource(reqUri, matchingResource, sdk);
+          const cacheHint = resolveResourceCacheHint(matchingResource);
+          if (cacheHint) {
+            return { ...resResult, cacheHint };
+          }
+          return resResult;
+        }
+
+        // 2. Try URL parsing for standard schemes (mcp://, ui://, http://)
+        let parsedUrl: URL | undefined;
+        try {
+          parsedUrl = new URL(reqUri);
+        } catch {
+          // If not parseable as standard URL, check if any resource matches
+          for (const [uri, res] of rawResources.entries()) {
+            if (uri === reqUri || uri.endsWith(reqUri) || reqUri.endsWith(uri)) {
+              return this.readResource(reqUri, res, sdk);
+            }
+          }
+        }
+
+        if (parsedUrl) {
+          const registered =
+            server._registeredResources?.[parsedUrl.toString()] ||
+            rawResources.get(parsedUrl.toString());
+          if (registered) {
+            if (typeof registered.readCallback === 'function') {
+              return registered.readCallback(parsedUrl, ctx);
+            }
+            return this.readResource(reqUri, registered, sdk);
+          }
+        }
+
+        // 3. Check template resources
+        if (server._registeredResourceTemplates) {
+          for (const template of Object.values(server._registeredResourceTemplates) as AnyRecord[]) {
+            const variables = template.resourceTemplate?.uriTemplate?.match?.(reqUri);
+            if (variables) {
+              return template.readCallback(reqUri, variables, ctx);
+            }
+          }
+        }
+
+        throw this.toSdkError(new Error(`Resource not found: ${reqUri}`), sdk);
+      });
+    }
   }
 
   private async registerPrompts(server: AnyRecord, sdk: Serv
```

---

### Incident Patch 14: `9e35ad2c` (2026-09-01)
**Commit Message**: fix(core): pass parsed req.body to modern node handler to support Express json middleware

**File**: `typescript/packages/core/src/core/protocol/modern-v2.adapter.ts` (modified, +12/-1)
```diff
@@ -478,7 +478,18 @@ export class ModernProtocolAdapter implements ProtocolAdapter {
 
     const nodeHandler = node.toNodeHandler(handler);
     return (req: ExpressRequest, res: ExpressResponse) => {
-      Promise.resolve(nodeHandler(req, res)).catch((err: unknown) => {
+      // Express bodyParser/json middleware may have already consumed the request
+      // stream and populated `req.body`. Pass `req.body` so `toWebRequest` uses
+      // the parsed body rather than reading an already-drained request stream.
+      const parsedBody =
+        (req as AnyRecord).body !== undefined &&
+        (req as AnyRecord).body !== null &&
+        typeof (req as AnyRecord).body === 'object' &&
+        Object.keys((req as AnyRecord).body).length > 0
+          ? (req as AnyRecord).body
+          : undefined;
+
+      Promise.resolve(nodeHandler(req, res, parsedBody)).catch((err: unknown) => {
         this.registry.logger.error('Modern MCP request failed', {
           error: err instanceof Error ? err.message : String(err),
         });
```

---

### Incident Patch 15: `63baf6b2` (2026-09-01)
**Commit Message**: test: add regression suite for Modern MCP prompt execution and validation

**File**: `typescript/packages/core/src/core/__tests__/protocol-2026/modern-prompt.test.ts` (added, +342/-0)
```diff
@@ -0,0 +1,342 @@
+/**
+ * Comprehensive regression test suite for Modern MCP (2026-07-28) Prompts.
+ *
+ * Exercises the Prompt registration and execution flow through the real Modern v2
+ * SDK boundary (`ModernProtocolAdapter` -> `@modelcontextprotocol/server` -> `fetch`).
+ *
+ * Covers all 12 required scenarios:
+ * 1. Parameterless prompt registration and execution
+ * 2. Prompt with 1 required string argument
+ * 3. Prompt with optional argument omitted
+ * 4. Prompt with optional argument supplied
+ * 5. Prompt with multiple required and optional arguments
+ * 6. Missing required argument rejection
+ * 7. Invalid argument type handling
+ * 8. Separation of Prompt args from SDK extra/request context
+ * 9. Auth info, clientInfo, headers, and ExecutionContext availability
+ * 10. Context logging and execution metadata preservation
+ * 11. Concurrent parameterized prompt calls with isolation
+ * 12. Stateless HTTP execution (no initialize, no Mcp-Session-Id)
+ */
+
+import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
+import { NitroStackServer } from '../../server.js';
+import { Prompt } from '../../prompt.js';
+
+const MODERN = '2026-07-28';
+const META_PROTOCOL = 'io.modelcontextprotocol/protocolVersion';
+const META_CLIENT_CAPS = 'io.modelcontextprotocol/clientCapabilities';
+const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
+
+interface RpcResult {
+  status: number;
+  body: {
+    jsonrpc?: string;
+    id?: unknown;
+    result?: {
+      description?: string;
+      messages?: Array<{ role: string; content: { type: string; text: string } }>;
+      [key: string]: unknown;
+    };
+    error?: { code: number; message: string; data?: unknown };
+  };
+}
+
+function modernPromptRequest(
+  promptName: string,
+  args?: Record<string, unknown>,
+  opts: { id?: number; clientName?: string; authHeader?: string } = {},
+): Request {
+  const envelope = {
+    [META_PROTOCOL]: MODERN,
+    [META_CLIENT_CAPS]: {},
+    [META_CLIENT_INFO]: { name: opts.clientName ?? 'jest-prompt-client', version: '1.0.0' },
+  };
+
+  const params: Record<string, unknown> = {
+    name: promptName,
+    _meta: envelope,
+  };
+  if (args !== undefined) {
+    params.arguments = args;
+  }
+
+  const body = {
+    jsonrpc: '2.0',
+    id: opts.id ?? 1,
+    method: 'prompts/get',
+    params,
+  };
+
+  const headers: Record<string, string> = {
+    'Content-Type': 'application/json',
+    Accept: 'application/json',
+    'MCP-Protocol-Version': MODERN,
+    'Mcp-Method': 'prompts/get',
+    'Mcp-Name': promptName,
+  };
+  if (opts.authHeader) {
+    headers['Authorization'] = opts.authHeader;
+  }
+
+  return new Request('http://localhost/mcp', {
+    method: 'POST',
+    headers,
+    body: JSON.stringify(body),
+  });
+}
+
+async function readRpc(res: Response): Promise<RpcResult> {
+  const text = await res.text();
+  try {
+    return { status: res.status, body: JSON.parse(text) };
+  } catch {
+    return { status: res.status, body: {} };
+  }
+}
+
+describe('Modern (2026-07-28) Parameterized Prompt Regression Suite', () => {
+  let server: NitroStackServer;
+  let handler: { fetch: (req: Request) => Promise<Response>; close: () => Promise<void> };
+
+  // Captured execution contexts for verification
+  const capturedContexts: Record<string, any> = {};
+  const capturedArgs: Record<string, any> = {};
+
+  beforeAll(async () => {
+    server = new NitroStackServer({ name: 'prompt-regression-server', version: '1.0.0', protocolVersion: MODERN });
+
+    // 1. Parameterless prompt
+    server.prompt(
+      new Prompt({
+        name: 'simple-greeting',
+        description: 'A parameterless greeting prompt',
+        handler: async (args, ctx) => {
+          capturedArgs['simple-greeting'] = args;
+          capturedContexts['simple-greeting'] = ctx;
+          return [{ role: 'assistant', content: 'Hello, welcome to NitroStack!' }];
+        },
+      }),
+    );
+
+    // 2. Single required string argument
+    server.prompt(
+      new Prompt({
+        name: 'code-review',
+        description: 'Review code for best practices',
+        arguments: [{ name: 'code', description: 'The source code', required: true }],
+        handler: async (args, ctx) => {
+          capturedArgs['code-review'] = args;
+          capturedContexts['code-review'] = ctx;
+          return [{ role: 'user', content: `Please review this code:\n${args.code}` }];
+        },
+      }),
+    );
+
+    // 3 & 4. Optional argument
+    server.prompt(
+      new Prompt({
+        name: 'greet-user',
+        description: 'Greeting with optional title',
+        arguments: [
+          { name: 'name', description: 'User name', required: true },
+          { name: 'title', description: 'Optional honorific', required: false },
+        ],
+        handler: async (args, ctx) => {
+          capturedArgs['greet-user'] = args;
+          capturedContexts['greet-user'] = ctx;
+          const prefix = args.ti
```

#### Recent Merged Pull Requests:
- **PR #348** (2026-09-24): fix(deps): pin ext-apps to 1.x so template installs stay on Zod 3 (@hemantj-cloud)
- **PR #346** (closed): fix(core): attach input to ExecutionContext for middleware and interceptors (@xiechimon)
- **PR #344** (2026-09-07): feat(core): implement MCP 2026-07-28 stateless protocol, task management, CIMD/OAuth 2.1 hardening, and MRTR support (@hemantj-cloud)
- **PR #341** (2026-08-28): chore(sample-apps): remove non-working and invalid sample applications (@hemantj-cloud)
- **PR #340** (2026-08-28): fix(sample-apps): resolve case-collision between README.md and readme.md (@hemantj-cloud)
- **PR #339** (2026-08-28): feat(widgets): implement RPC methods in polyfill and enhance sendFollowUpMessage payload support (@hemantj-cloud)
- **PR #337** (2026-08-25): fix(core): propagate HTTP Authorization header and params._meta into tool ExecutionContext (@hemantj-cloud)
- **PR #306** (closed): [Hackathon] VectorPoint - Autonomous-Medical-Imaging-Diagnosis-Clinical-Decision-Agent (@SouryaneelPal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
