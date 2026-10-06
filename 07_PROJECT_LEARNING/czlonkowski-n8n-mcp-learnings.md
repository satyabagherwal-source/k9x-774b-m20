# Forensic Learning Record (Deep Inspection): czlonkowski/n8n-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/czlonkowski-n8n-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:42.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `czlonkowski/n8n-mcp`
- **Description**: A MCP for Claude Desktop / Claude Code / Windsurf / Cursor to build n8n workflows for you 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 23040 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/export-webhook-workflows.ts`
```
#!/usr/bin/env tsx

/**
 * Export Webhook Workflow JSONs
 *
 * Generates the 4 webhook workflow JSON files needed for integration testing.
 * These workflows must be imported into n8n and activated manually.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { exportAllWebhookWorkflows } from '../tests/integration/n8n-api/utils/webhook-workflows';

const OUTPUT_DIR = join(process.cwd(), 'workflows-for-import');

// Create output directory
mkdirSync(OUTPUT_DIR, { recursive: true });

// Generate all workflow JSONs
const workflows = exportAllWebhookWorkflows();

// Write each workflow to a separate file
Object.entries(workflows).forEach(([method, workflow]) => {
  const filename = `webhook-${method.toLowerCase()}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  writeFileSync(filepath, JSON.stringify(workflow, null, 2), 'utf-8');

  console.log(`✓ Generated: ${filename}`);
});

console.log(`\n✓ All workflow JSONs written to: ${OUTPUT_DIR}`);
console.log('\nNext steps:');
console.log('1. Import each JSON file into your n8n instance');
console.log('2. Activate each workflow in the n8n UI');
console.log('3. Copy the webhook URLs from each workflow (open workflow → Webhook node → copy URL)');
console.log('4. Add them to your .env file:');
console.log('   N8N_TEST_WEBHOOK_GET_URL=https://your-n8n.com/webhook/mcp-test-get');
console.log('   N8N_TEST_WEBHOOK_POST_URL=https://your-n8n.com/webhook/mcp-test-post');
console.log('   N8N_TEST_WEBHOOK_PUT_URL=https://your-n8n.com/webhook/mcp-test-put');
console.log('   N8N_TEST_WEBHOOK_DELETE_URL=https://your-n8n.com/webhook/mcp-test-delete');

```

### Core Architecture Module: `src/mcp-engine.ts`
```
/**
 * N8N MCP Engine - Clean interface for service integration
 *
 * This class provides a simple API for integrating the n8n-MCP server
 * into larger services. The wrapping service handles authentication,
 * multi-tenancy, rate limiting, etc.
 */
import { Request, Response } from 'express';
import { SingleSessionHTTPServer } from './http-server-single-session';
import { logger } from './utils/logger';
import { PROJECT_VERSION } from './utils/version';
import { InstanceContext } from './types/instance-context';
import { SessionState } from './types/session-state';
import type { AdditionalTool } from './types/additional-tools';

export { probeOfficialMcp } from './services/n8n-official-mcp-client';
export type { OfficialMcpCapabilities, OfficialMcpErrorCode } from './services/n8n-official-mcp-client';

export interface EngineHealth {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  sessionActive: boolean;
  memoryUsage: {
    used: number;
    total: number;
    unit: string;
  };
  version: string;
}

export interface EngineOptions {
  sessionTimeout?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  additionalTools?: AdditionalTool[];
}

export class N8NMCPEngine {
  private server: SingleSessionHTTPServer;
  private startTime: Date;
  
  constructor(options: EngineOptions = {}) {
    this.server = new SingleSessionHTTPServer({
      additionalTools: options.additionalTools,
    });
    this.startTime = new Date();

    if (options.logLevel) {
      process.env.LOG_LEVEL = options.logLevel;
    }
  }
  
  /**
   * Process a single MCP request with optional instance context
   * The wrapping service handles authentication, multi-tenancy, etc.
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param instanceContext - Optional instance-specific configuration
   *
   * @example
   * // Basic usage (backward compatible)
   * await engine.processRequest(req, res);
   *
   * @example
   * // With instance context
   * const context: InstanceContext = {
   *   n8nApiUrl: 'https://instance1.n8n.cloud',
   *   n8nApiKey: 'instance1-key',
   *   instanceId: 'tenant-123'
   * };
   * await engine.processRequest(req, res, context);
   */
  async processRequest(
    req: Request,
    res: Response,
    instanceContext?: InstanceContext
  ): Promise<void> {
    try {
      await this.server.handleRequest(req, res, instanceContext);
    } catch (error) {
      logger.error('Engine processRequest error:', error);
      throw error;
    }
  }
  
  /**
   * Health check for service monitoring
   * 
   * @example
   * app.get('/health', async (req, res) => {
   *   const health = await engine.healthCheck();
   *   res.status(health.status === 'healthy' ? 200 : 503).json(health);
   * });
   */
  async healthCheck(): Promise<EngineHealth> {
    try {
      const sessionInfo = this.server.getSessionInfo();
      const memoryUsage = process.memoryUsage();
      
      return {
        status: 'healthy',
        uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        sessionActive: sessionInfo.active,
        memoryUsage: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        version: PROJECT_VERSION
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        uptime: 0,
        sessionActive: false,
        memoryUsage: { used: 0, total: 0, unit: 'MB' },
        version: PROJECT_VERSION
      };
    }
  }
  
  /**
   * Get current session information
   * Useful for monitoring and debugging
   */
  getSessionInfo(): { active: boolean; sessionId?: string; age?: number } {
    return this.server.getSessionInfo();
  }

  /**
   * Export all active session state for persistence
   *
   * Used by multi-tenant backends to dump sessions before container restart.
   * Returns an array of session state objects containing metadata and credentials.
   *
   * SECURITY WARNING: Exported data contains plaintext n8n API keys.
   * Encrypt before persisting to disk.
   *
   * @returns Array of session state objects
   *
   * @example
   * // Before shutdown
   * const sessions = engine.exportSessionState();
   * await saveToEncryptedStorage(sessions);
   */
  exportSessionState(): SessionState[] {
    if (!this.server) {
      logger.warn('Cannot export sessions: server not initialized');
      return [];
    }
    return this.server.exportSessionState();
  }

  /**
   * Restore session state from previously exported data
   *
   * Used by multi-tenant backends to restore sessions after container restart.
   * Restores session metadata and instance context. Transports/servers are
   * recreated on first request.
   *
   * @param sessions - Array of session state objects from exportSessionState()
   * @returns Number of sessions successfully restored
   *
   * @example
   * // After startup
   * const sessions = await loadFromEncryptedStorage();
   * const count = engine.restoreSessionState(sessions);
   * console.log(`Restored ${count} sessions`);
   */
  restoreSessionState(sessions: SessionState[]): number {
    if (!this.server) {
      logger.warn('Cannot restore sessions: server not initialized');
      return 0;
    }
    return this.server.restoreSessionState(sessions);
  }

  /**
   * Graceful shutdown for service lifecycle
   *
   * @example
   * process.on('SIGTERM', async () => {
   *   await engine.shutdown();
   *   process.exit(0);
   * });
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down N8N MCP Engine...');
    await this.server.shutdown();
  }
  
  /**
   * Start the engine (if using standalone mode)
   * For embedded use, this is not necessary
   */
  async start(): Promise<void> {
    await this.server.start();
  }
}

/**
 * Example usage with flexible instance configuration:
 *
 * ```typescript
 * import { N8NMCPEngine, InstanceContext } from 'n8n-mcp';
 * import express from 'express';
 *
 * const app = express();
 * const engine = new N8NMCPEngine();
 *
 * // Middleware for authentication
 * const authenticate = (req, res, next) => {
 *   // Your auth logic
 *   req.userId = 'user123';
 *   next();
 * };
 *
 * // MCP endpoint with flexible instance support
 * app.post('/api/instances/:instanceId/mcp', authenticate, async (req, res) => {
 *   // Get instance configuration from your database
 *   const instance = await getInstanceConfig(req.params.instanceId);
 *
 *   // Create instance context
 *   const context: InstanceContext = {
 *     n8nApiUrl: instance.n8nUrl,
 *     n8nApiKey: instance.apiKey,
 *     instanceId: instance.id,
 *     metadata: { userId: req.userId }
 *   };
 *
 *   // Process request with instance context
 *   await engine.processRequest(req, res, context);
 * });
 *
 * // Health endpoint
 * app.get('/health', async (req, res) => {
 *   const health = await engine.healthCheck();
 *   res.json(health);
 * });
 * ```
 */
export default N8NMCPEngine;
```

### Core Architecture Module: `src/mcp-tools-engine.ts`
```
/**
 * MCPEngine - A simplified interface for benchmarking MCP tool execution
 * This directly implements the MCP tool functionality without server dependencies
 */
import { NodeRepository } from './database/node-repository';
import { PropertyFilter } from './services/property-filter';
import { TaskTemplates } from './services/task-templates';
import { ConfigValidator } from './services/config-validator';
import { EnhancedConfigValidator } from './services/enhanced-config-validator';
import { WorkflowValidator, WorkflowValidationResult } from './services/workflow-validator';

export class MCPEngine {
  private workflowValidator: WorkflowValidator;

  constructor(private repository: NodeRepository) {
    this.workflowValidator = new WorkflowValidator(repository, EnhancedConfigValidator);
  }

  async listNodes(args: any = {}) {
    return this.repository.getAllNodes(args.limit);
  }

  async searchNodes(args: any) {
    return this.repository.searchNodes(args.query, args.mode || 'OR', args.limit || 20);
  }

  async getNodeInfo(args: any) {
    return this.repository.getNodeByType(args.nodeType);
  }

  async getNodeEssentials(args: any) {
    const node = await this.repository.getNodeByType(args.nodeType);
    if (!node) return null;
    
    // Filter to essentials using static method
    const essentials = PropertyFilter.getEssentials(node.properties || [], args.nodeType);
    return {
      nodeType: node.nodeType,
      displayName: node.displayName,
      description: node.description,
      category: node.category,
      required: essentials.required,
      common: essentials.common
    };
  }

  async getNodeDocumentation(args: any) {
    const node = await this.repository.getNodeByType(args.nodeType);
    return node?.documentation || null;
  }

  async validateNodeOperation(args: any) {
    // Get node properties and validate
    const node = await this.repository.getNodeByType(args.nodeType);
    if (!node) {
      return {
        valid: false,
        errors: [{ type: 'invalid_configuration', property: '', message: 'Node type not found' }],
        warnings: [],
        suggestions: [],
        visibleProperties: [],
        hiddenProperties: []
      };
    }

    // Routed through the enhanced validator so the embedding API sees the same
    // node-specific checks as validate_node and workflow validation - it also
    // derives the user-provided keys itself, which keeps default values from
    // raising false warnings. The result is a superset of ValidationResult.
    return EnhancedConfigValidator.validateWithMode(
      args.nodeType,
      args.config || {},
      node.properties || [],
      args.mode ?? 'operation',
      args.profile ?? 'ai-friendly'
    );
  }

  async validateNodeMinimal(args: any) {
    // Get node and check minimal requirements
    const node = await this.repository.getNodeByType(args.nodeType);
    if (!node) {
      return { missingFields: [], error: 'Node type not found' };
    }
    
    const missingFields: string[] = [];
    const requiredFields = PropertyFilter.getEssentials(node.properties || [], args.nodeType).required;
    
    for (const field of requiredFields) {
      if (!args.config[field.name]) {
        missingFields.push(field.name);
      }
    }
    
    return { missingFields };
  }

  async searchNodeProperties(args: any) {
    return this.repository.searchNodeProperties(args.nodeType, args.query, args.maxResults || 20);
  }

  async listAITools(args: any) {
    return this.repository.getAIToolNodes();
  }

  async getDatabaseStatistics(args: any) {
    const count = await this.repository.getNodeCount();
    const aiTools = await this.repository.getAIToolNodes();
    return {
      totalNodes: count,
      aiToolsCount: aiTools.length,
      categories: ['trigger', 'transform', 'output', 'input']
    };
  }

  async validateWorkflow(args: any): Promise<WorkflowValidationResult> {
    return this.workflowValidator.validateWorkflow(args.workflow, args.options);
  }
}
```

### Core Architecture Module: `src/scripts/core-node-check.ts`
```
/**
 * Post-rebuild completeness check for canonical core nodes.
 *
 * The shipped database once lacked nodes-base.extractFromFile, so the
 * validator hard-errored ("Unknown node type") on workflows using a valid
 * core node. Any of these missing after a rebuild means the build silently
 * dropped a core node and the database must not be shipped.
 */
export const CANONICAL_CORE_NODES: readonly string[] = [
  'nodes-base.code',
  'nodes-base.convertToFile',
  'nodes-base.evaluation',
  'nodes-base.evaluationTrigger',
  'nodes-base.executeWorkflow',
  'nodes-base.extractFromFile',
  'nodes-base.httpRequest',
  'nodes-base.if',
  'nodes-base.manualTrigger',
  'nodes-base.merge',
  'nodes-base.readWriteFile',
  'nodes-base.respondToWebhook',
  'nodes-base.scheduleTrigger',
  'nodes-base.set',
  'nodes-base.splitInBatches',
  'nodes-base.switch',
  'nodes-base.webhook'
];

export interface CoreNodeLookup {
  /** Returns a truthy value when the node type exists in the database. */
  getNode(nodeType: string): unknown;
}

export function findMissingCoreNodes(lookup: CoreNodeLookup): string[] {
  return CANONICAL_CORE_NODES.filter(nodeType => !lookup.getNode(nodeType));
}

export function assertCoreNodesPresent(lookup: CoreNodeLookup): void {
  const missing = findMissingCoreNodes(lookup);
  if (missing.length > 0) {
    throw new Error(
      `Core node completeness check failed - missing from database: ${missing.join(', ')}. ` +
      'The rebuild dropped canonical core nodes; do not ship this database.'
    );
  }
}

```

### Core Architecture Module: `src/services/confidence-scorer.ts`
```
/**
 * Confidence Scorer for node-specific validations
 *
 * Provides confidence scores for node-specific recommendations,
 * allowing users to understand the reliability of suggestions.
 */

export interface ConfidenceScore {
  value: number; // 0.0 to 1.0
  reason: string;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  weight: number;
  matched: boolean;
  description: string;
}

export class ConfidenceScorer {
  /**
   * Calculate confidence score for resource locator recommendation
   */
  static scoreResourceLocatorRecommendation(
    fieldName: string,
    nodeType: string,
    value: string
  ): ConfidenceScore {
    const factors: ConfidenceFactor[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // Factor 1: Exact field name match (highest confidence)
    const exactFieldMatch = this.checkExactFieldMatch(fieldName, nodeType);
    factors.push({
      name: 'exact-field-match',
      weight: 0.5,
      matched: exactFieldMatch,
      description: `Field name '${fieldName}' is known to use resource locator in ${nodeType}`
    });

    // Factor 2: Field name pattern (medium confidence)
    const patternMatch = this.checkFieldPattern(fieldName);
    factors.push({
      name: 'field-pattern',
      weight: 0.3,
      matched: patternMatch,
      description: `Field name '${fieldName}' matches common resource locator patterns`
    });

    // Factor 3: Value pattern (low confidence)
    const valuePattern = this.checkValuePattern(value);
    factors.push({
      name: 'value-pattern',
      weight: 0.1,
      matched: valuePattern,
      description: 'Value contains patterns typical of resource identifiers'
    });

    // Factor 4: Node type category (medium confidence)
    const nodeCategory = this.checkNodeCategory(nodeType);
    factors.push({
      name: 'node-category',
      weight: 0.1,
      matched: nodeCategory,
      description: `Node type '${nodeType}' typically uses resource locators`
    });

    // Calculate final score
    for (const factor of factors) {
      totalWeight += factor.weight;
      if (factor.matched) {
        matchedWeight += factor.weight;
      }
    }

    const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

    // Determine reason based on score
    let reason: string;
    if (score >= 0.8) {
      reason = 'High confidence: Multiple strong indicators suggest resource locator format';
    } else if (score >= 0.5) {
      reason = 'Medium confidence: Some indicators suggest resource locator format';
    } else if (score >= 0.3) {
      reason = 'Low confidence: Weak indicators for resource locator format';
    } else {
      reason = 'Very low confidence: Minimal evidence for resource locator format';
    }

    return {
      value: score,
      reason,
      factors
    };
  }

  /**
   * Known field mappings with exact matches
   */
  private static readonly EXACT_FIELD_MAPPINGS: Record<string, string[]> = {
    'github': ['owner', 'repository', 'user', 'organization'],
    'googlesheets': ['sheetId', 'documentId', 'spreadsheetId'],
    'googledrive': ['fileId', 'folderId', 'driveId'],
    'slack': ['channel', 'user', 'channelId', 'userId'],
    'notion': ['databaseId', 'pageId', 'blockId'],
    'airtable': ['baseId', 'tableId', 'viewId']
  };

  private static checkExactFieldMatch(fieldName: string, nodeType: string): boolean {
    const nodeBase = nodeType.split('.').pop()?.toLowerCase() || '';

    for (const [pattern, fields] of Object.entries(this.EXACT_FIELD_MAPPINGS)) {
      if (nodeBase === pattern || nodeBase.startsWith(`${pattern}-`)) {
        return fields.includes(fieldName);
      }
    }

    return false;
  }

  /**
   * Common patterns in field names that suggest resource locators
   */
  private static readonly FIELD_PATTERNS = [
    /^.*Id$/i,           // ends with Id
    /^.*Ids$/i,          // ends with Ids
    /^.*Key$/i,          // ends with Key
    /^.*Name$/i,         // ends with Name
    /^.*Path$/i,         // ends with Path
    /^.*Url$/i,          // ends with Url
    /^.*Uri$/i,          // ends with Uri
    /^(table|database|collection|bucket|folder|file|document|sheet|board|project|issue|user|channel|team|organization|repository|owner)$/i
  ];

  private static checkFieldPattern(fieldName: string): boolean {
    return this.FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  /**
   * Check if the value looks like it contains identifiers
   */
  private static checkValuePattern(value: string): boolean {
    // Remove = prefix if present for analysis
    const content = value.startsWith('=') ? value.substring(1) : value;

    // Skip if not an expression
    if (!content.includes('{{') || !content.includes('}}')) {
      return false;
    }

    // Check for patterns that suggest IDs or resource references
    const patterns = [
      /\{\{.*\.(id|Id|ID|key|Key|name|Name|path|Path|url|Url|uri|Uri).*\}\}/i,
      /\{\{.*_(id|Id|ID|key|Key|name|Name|path|Path|url|Url|uri|Uri).*\}\}/i,
      /\{\{.*(id|Id|ID|key|Key|name|Name|path|Path|url|Url|uri|Uri).*\}\}/i
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * Node categories that commonly use resource locators
   */
  private static readonly RESOURCE_HEAVY_NODES = [
    'github', 'gitlab', 'bitbucket',           // Version control
    'googlesheets', 'googledrive', 'dropbox',  // Cloud storage
    'slack', 'discord', 'telegram',            // Communication
    'notion', 'airtable', 'baserow',          // Databases
    'jira', 'asana', 'trello', 'monday',      // Project management
    'salesforce', 'hubspot', 'pipedrive',     // CRM
    'stripe', 'paypal', 'square',             // Payment
    'aws', 'gcp', 'azure',                    // Cloud providers
    'mysql', 'postgres', 'mongodb', 'redis'   // Databases
  ];

  private static checkNodeCategory(nodeType: string): boolean {
    const nodeBase = nodeType.split('.').pop()?.toLowerCase() || '';

    return this.RESOURCE_HEAVY_NODES.some(category =>
      nodeBase.includes(category)
    );
  }

  /**
   * Get confidence level as a string
   */
  static getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very-low' {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very-low';
  }

  /**
   * Should apply recommendation based on confidence and threshold
   */
  static shouldApplyRecommendation(
    score: number,
    threshold: 'strict' | 'normal' | 'relaxed' = 'normal'
  ): boolean {
    const thresholds = {
      strict: 0.8,   // Only apply high confidence recommendations
      normal: 0.5,   // Apply medium and high confidence
      relaxed: 0.3   // Apply low, medium, and high confidence
    };

    return score >= thresholds[threshold];
  }
}
```

### Core Architecture Module: `src/services/workflow-diff-engine.ts`
```
/**
 * Workflow Diff Engine
 * Applies diff operations to n8n workflows
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowDiffOperation,
  WorkflowDiffRequest,
  WorkflowDiffResult,
  WorkflowDiffValidationError,
  isNodeOperation,
  isConnectionOperation,
  isMetadataOperation,
  AddNodeOperation,
  RemoveNodeOperation,
  UpdateNodeOperation,
  MoveNodeOperation,
  EnableNodeOperation,
  DisableNodeOperation,
  AddConnectionOperation,
  RemoveConnectionOperation,
  RewireConnectionOperation,
  UpdateSettingsOperation,
  UpdateNameOperation,
  SetNodeGroupsOperation,
  AddTagOperation,
  RemoveTagOperation,
  ActivateWorkflowOperation,
  DeactivateWorkflowOperation,
  CleanStaleConnectionsOperation,
  ReplaceConnectionsOperation,
  TransferWorkflowOperation,
  MoveToFolderOperation,
  PatchNodeFieldOperation
} from '../types/workflow-diff';
import { Workflow, WorkflowNode, WorkflowConnection, WorkflowNodeGroup } from '../types/n8n-api';
import { Logger } from '../utils/logger';
import { GROUP_DESCRIPTION_MAX_LENGTH, repairNodeGroups, toWorkflowNodeGroup } from './node-groups';
import { sanitizeNode, sanitizeWorkflowNodes } from './node-sanitizer';
import { isActivatableTrigger } from '../utils/node-type-utils';

const logger = new Logger({ prefix: '[WorkflowDiffEngine]' });

// Safety limits for patchNodeField operations
const PATCH_LIMITS = {
  MAX_PATCHES: 50,           // Max patches per operation
  MAX_REGEX_LENGTH: 500,     // Max regex pattern length (chars)
  MAX_FIELD_SIZE_REGEX: 512 * 1024, // Max field size for regex operations (512KB)
};

// Keys that must never appear in property paths (prototype pollution prevention)
const DANGEROUS_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check if a regex pattern contains constructs known to cause catastrophic backtracking.
 * Detects nested quantifiers like (a+)+, (a*)+, (a+)*, (a|b+)+ etc.
 */
function isUnsafeRegex(pattern: string): boolean {
  // Detect nested quantifiers: a quantifier applied to a group that itself contains a quantifier
  // Examples: (a+)+, (a+)*, (.*)+, (\w+)*, (a|b+)+
  // This catches the most common ReDoS patterns
  const nestedQuantifier = /\([^)]*[+*][^)]*\)[+*{]/;
  if (nestedQuantifier.test(pattern)) return true;

  // Detect overlapping alternations with quantifiers: (a|a)+, (\w|\d)+
  const overlappingAlternation = /\([^)]*\|[^)]*\)[+*{]/;
  // Only flag if alternation branches share characters (heuristic: both contain \w, ., or same literal)
  if (overlappingAlternation.test(pattern)) {
    const match = pattern.match(/\(([^)]*)\|([^)]*)\)[+*{]/);
    if (match) {
      const [, left, right] = match;
      // Flag if both branches use broad character classes
      const broadClasses = ['.', '\\w', '\\d', '\\s', '\\S', '\\W', '\\D', '[^'];
      const leftHasBroad = broadClasses.some(c => left.includes(c));
      const rightHasBroad = broadClasses.some(c => right.includes(c));
      if (leftHasBroad && rightHasBroad) return true;
    }
  }

  return false;
}

interface PathSegment {
  key: string;
  /** Segment came from bracket syntax (`items[0]`), which only an array can satisfy. */
  bracket: boolean;
}

/**
 * Split a property path into segments, understanding dot notation and bracket
 * indices: "assignments[0].value" → ["assignments", "0", "value"].
 *
 * Bracket indices must be non-negative integers. Anything else is malformed and
 * throws — treating "assignments[0]" as a literal key silently wrote a junk
 * sibling property instead of updating the array element (#950).
 */
function parsePropertyPath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];

  for (const part of path.split('.')) {
    if (!part.includes('[') && !part.includes(']')) {
      if (part === '') {
        throw new Error(
          `Invalid property path "${path}": empty path segment. ` +
          `Write "parameters.url" without leading, trailing or repeated dots.`
        );
      }
      segments.push({ key: part, bracket: false });
      continue;
    }

    const match = /^([^[\]]*)((?:\[\d+\])+)$/.exec(part);
    if (!match) {
      throw new Error(
        `Invalid property path "${path}": malformed bracket index in "${part}". ` +
        `Use "items[0].name" with a non-negative integer, or the equivalent "items.0.name".`
      );
    }

    const [, base, indices] = match;
    if (base) segments.push({ key: base, bracket: false });
    for (const [, index] of indices.matchAll(/\[(\d+)\]/g)) {
      segments.push({ key: index, bracket: true });
    }
  }

  return segments;
}

/**
 * Resolve a path segment against its container, returning the key to read or
 * write. Numeric segments address array elements by index; a bracket segment
 * that does not land on an array is a caller mistake, not a new property.
 *
 * Writes additionally refuse non-index segments on arrays: keys like "-1" or
 * "length" would either be dropped on serialization or truncate the array,
 * which is the same silent corruption bracket parsing fixes (#950). Reads stay
 * permissive so an unresolvable path simply reads as undefined.
 */
function resolveSegment(
  container: any,
  segment: PathSegment,
  path: string,
  forWrite: boolean
): string | number {
  if (Array.isArray(container)) {
    if (/^\d+$/.test(segment.key)) {
      const index = Number(segment.key);
      if (index >= container.length) {
        throw new Error(
          `Invalid property path "${path}": index ${index} is out of range for an array of ${container.length} item(s).`
        );
      }
      return index;
    }

    if (forWrite) {
      throw new Error(
        `Invalid property path "${path}": "${segment.key}" is not an array index. ` +
        `Address array elements by position, e.g. "items[0].name".`
      );
    }
  }

  if (segment.bracket) {
    throw new Error(
      `Invalid property path "${path}": "[${segment.key}]" expects an array but found ${container === null ? 'null' : typeof container}.`
    );
  }

  return segment.key;
}

function countOccurrences(str: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

/** Names the type of a rejected value for an error message: "a string", "null", "an array". */
function describeValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'nothing';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** The connections at one output index, or null when nothing is wired to that output (#1096). */
type ConnectionBranch = WorkflowConnection[string][string][number];

/**
 * Read a branch's connections. A null branch is legal n8n data that any workflow read back can
 * carry (#1096), so the walks below go through this to stay off `null.some` and `null.length` -
 * which surfaced as an internal error rather than a diff-engine message.
 */
function branchConnections(branch: unknown): any[] {
  return Array.isArray(branch) ? branch : [];
}

/**
 * Filter a branch's connections, leaving a null branch exactly as it arrived: rewriting it to
 * `[]` would edit an output the operation was never asked to touch.
 */
function filterBranch(
  branch: ConnectionBranch,
  keep: (conn: NonNullable<ConnectionBranch>[number]) => boolean
): ConnectionBranch {
  return Array.isArray(branch) ? branch.filter(keep) : branch;
}

/**
 * Drop the trailing branches with nothing wired to them. Intermediate ones stay: a branch's
 * position in the array is its output index, so dropping one rewires every output after it.
 */
function trimTrailingEmptyBranches(branches: ConnectionBranch[]): void {
  while (branches.length > 0 && branchConnections(branches[branches.length - 1]).length === 0) {
    branches.pop();
  }
}

/**
 * The addNode payload arrives as `z.any()` - the request schema cannot type it, because the
 * operation's contract is looser than n8n's node schema (applyAddNode fills in `id`,
 * `typeVersion` and `parameters`). Check the two fields the validator and the appliers
 * dereference, so a malformed payload becomes an operation error instead of a TypeError (#1092).
 */
function validateAddNodeShape(node: unknown): string | null {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return `addNode requires a node object, received ${describeValueType(node)}`;
  }

  const candidate = node as Record<string, unknown>;

  if (typeof candidate.name !== 'string') {
    return `addNode requires a string "name" on the node, received ${describeValueType(candidate.name)}`;
  }

  if (typeof candidate.type !== 'string') {
    return `addNode requires a string "type" on the node, received ${describeValueType(candidate.type)}`;
  }

  // `position` is deliberately NOT required here even though applyAddNode does not default
  // it: a batch may legitimately add a node and place it with a later moveNode operation.
  // The post-apply structure check is where a position that never arrives is reported.
  return null;
}

// Fields that hold plain JavaScript: the Code node's jsCode and the legacy
// Function/FunctionItem nodes' functionCode. Python lives in pythonCode.
const JS_CODE_FIELD_NAMES = new Set(['jsCode', 'functionCode']);

// Parses (never executes) code as an async function body, matching n8n's own
// wrapping of Code-node JS — so top-level return/await are valid.
const AsyncFunctionCtor = (async () => {}).constructor as new (...args: string[]) => unknown;

// Parsing is synchronous on the event loop; a 60 MiB body costs ~1s. Real
// Code-node sources are kilobytes — beyond this the code is never parsed,
// so oversized input cannot become a DoS lever (Codex review on #1014).
const MAX_SYNTAX_CHECKED_LENGTH = 1_000_000;

type JsSyntaxCheck =
  | { status: 'valid' }
  | { status: 'invalid'; message: string }
  // Could not judge the code e
```

### Core Architecture Module: `src/telemetry/error-sanitization-utils.ts`
```
/**
 * Shared Error Sanitization Utilities
 * Used by both error-sanitizer.ts and event-tracker.ts to avoid code duplication
 *
 * Security patterns from v2.15.3 with ReDoS fix from v2.18.3
 */

import { logger } from '../utils/logger';

/**
 * Core error message sanitization with security-focused patterns
 *
 * Sanitization order (critical for preventing leakage):
 * 1. Early truncation (ReDoS prevention)
 * 2. Stack trace limitation
 * 3. URLs (most encompassing) - fully redact
 * 4. Specific credentials (AWS, GitHub, JWT, Bearer)
 * 5. Emails (after URLs)
 * 6. Long keys and tokens
 * 7. Generic credential patterns
 * 8. Final truncation
 *
 * @param errorMessage - Raw error message to sanitize
 * @returns Sanitized error message safe for telemetry
 */
export function sanitizeErrorMessageCore(errorMessage: string): string {
  try {
    // Early truncate to prevent ReDoS and performance issues
    const maxLength = 1500;
    const trimmed = errorMessage.length > maxLength
      ? errorMessage.substring(0, maxLength)
      : errorMessage;

    // Handle stack traces - keep only first 3 lines (message + top stack frames)
    const lines = trimmed.split('\n');
    let sanitized = lines.slice(0, 3).join('\n');

    // Sanitize sensitive data in correct order to prevent leakage

    // 1. URLs first (most encompassing) - fully redact to prevent path leakage
    sanitized = sanitized.replace(/https?:\/\/\S+/gi, '[URL]');

    // 2. Specific credential patterns (before generic patterns)
    sanitized = sanitized
      .replace(/AKIA[A-Z0-9]{16}/g, '[AWS_KEY]')
      .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN]')
      .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT]')
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [TOKEN]');

    // 3. Emails (after URLs to avoid partial matches)
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

    // 4. Long keys and quoted tokens
    sanitized = sanitized
      .replace(/\b[a-zA-Z0-9_-]{32,}\b/g, '[KEY]')
      .replace(/(['"])[a-zA-Z0-9_-]{16,}\1/g, '$1[TOKEN]$1');

    // 5. Generic credential patterns (after specific ones to avoid conflicts)
    // FIX (v2.18.3): Replaced negative lookbehind with simpler regex to prevent ReDoS
    sanitized = sanitized
      .replace(/password\s*[=:]\s*\S+/gi, 'password=[REDACTED]')
      .replace(/api[_-]?key\s*[=:]\s*\S+/gi, 'api_key=[REDACTED]')
      .replace(/\btoken\s*[=:]\s*[^\s;,)]+/gi, 'token=[REDACTED]'); // Simplified regex (no negative lookbehind)

    // Final truncate to 500 chars
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + '...';
    }

    return sanitized;
  } catch (error) {
    logger.debug('Error message sanitization failed:', error);
    return '[SANITIZATION_FAILED]';
  }
}

```

### Core Architecture Module: `src/triggers/handlers/webhook-handler.ts`
```
/**
 * Webhook trigger handler
 *
 * Handles webhook-based workflow triggers:
 * - Supports GET, POST, PUT, DELETE methods
 * - Passes data as body (POST/PUT/DELETE) or query params (GET)
 * - Includes SSRF protection
 */

import { z } from 'zod';
import { Workflow, WebhookRequest } from '../../types/n8n-api';
import {
  TriggerType,
  TriggerResponse,
  TriggerHandlerCapabilities,
  DetectedTrigger,
  WebhookTriggerInput,
} from '../types';
import { BaseTriggerHandler } from './base-handler';
import { buildTriggerUrl } from '../trigger-detector';

/**
 * Zod schema for webhook input validation
 */
const webhookInputSchema = z.object({
  workflowId: z.string(),
  triggerType: z.literal('webhook'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  webhookPath: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().optional(),
  waitForResponse: z.boolean().optional(),
});

/**
 * Webhook trigger handler
 */
export class WebhookHandler extends BaseTriggerHandler<WebhookTriggerInput> {
  readonly triggerType: TriggerType = 'webhook';

  readonly capabilities: TriggerHandlerCapabilities = {
    requiresActiveWorkflow: true,
    supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    canPassInputData: true,
  };

  readonly inputSchema = webhookInputSchema;

  async execute(
    input: WebhookTriggerInput,
    workflow: Workflow,
    triggerInfo?: DetectedTrigger
  ): Promise<TriggerResponse> {
    const startTime = Date.now();

    try {
      // Build webhook URL
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        return this.errorResponse(input, 'Cannot determine n8n base URL', startTime);
      }

      // Use provided webhook path or extract from trigger info
      let webhookUrl: string;
      if (input.webhookPath) {
        // User provided explicit path
        webhookUrl = `${baseUrl.replace(/\/+$/, '')}/webhook/${input.webhookPath}`;
      } else if (triggerInfo?.webhookPath) {
        // Use detected path from workflow
        webhookUrl = buildTriggerUrl(baseUrl, triggerInfo, 'production');
      } else {
        return this.errorResponse(
          input,
          'No webhook path available. Provide webhookPath parameter or ensure workflow has a webhook trigger.',
          startTime
        );
      }

      // Determine HTTP method
      const httpMethod = input.httpMethod || triggerInfo?.httpMethod || 'POST';

      // SSRF protection - validate the webhook URL before making the request
      const { SSRFProtection } = await import('../../utils/ssrf-protection');
      const validation = await SSRFProtection.validateWebhookUrl(webhookUrl);
      if (!validation.valid) {
        return this.errorResponse(input, `SSRF protection: ${validation.reason}`, startTime);
      }

      // Build webhook request
      const webhookRequest: WebhookRequest = {
        webhookUrl,
        httpMethod: httpMethod as 'GET' | 'POST' | 'PUT' | 'DELETE',
        data: input.data,
        headers: input.headers,
        waitForResponse: input.waitForResponse ?? true,
      };

      // Trigger the webhook
      const response = await this.client.triggerWebhook(webhookRequest);

      return this.normalizeResponse(response, input, startTime, {
        status: response.status,
        statusText: response.statusText,
        metadata: {
          duration: Date.now() - startTime,
          webhookPath: input.webhookPath || triggerInfo?.webhookPath,
          httpMethod,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Try to extract execution ID from error if available
      const errorDetails = (error as any)?.details;
      const executionId = errorDetails?.executionId || errorDetails?.id;

      return this.errorResponse(input, errorMessage, startTime, {
        executionId,
        code: (error as any)?.code,
        details: errorDetails,
      });
    }
  }
}

```

### Core Architecture Module: `src/types/session-state.ts`
```
/**
 * Session persistence types for multi-tenant deployments
 *
 * These types support exporting and restoring MCP session state across
 * container restarts, enabling seamless session persistence in production.
 */

import { InstanceContext } from './instance-context.js';

/**
 * Serializable session state for persistence across restarts
 *
 * This interface represents the minimal state needed to restore an MCP session
 * after a container restart. Only the session metadata and instance context are
 * persisted - transport and server objects are recreated on the first request.
 *
 * @example
 * // Export sessions before shutdown
 * const sessions = server.exportSessionState();
 * await saveToEncryptedStorage(sessions);
 *
 * @example
 * // Restore sessions on startup
 * const sessions = await loadFromEncryptedStorage();
 * const count = server.restoreSessionState(sessions);
 * console.log(`Restored ${count} sessions`);
 */
export interface SessionState {
  /**
   * Unique session identifier
   * Format: UUID v4 or custom format from MCP proxy
   */
  sessionId: string;

  /**
   * Session timing metadata for expiration tracking
   */
  metadata: {
    /**
     * When the session was created (ISO 8601 timestamp)
     * Used to track total session age
     */
    createdAt: string;

    /**
     * When the session was last accessed (ISO 8601 timestamp)
     * Used to determine if session has expired based on timeout
     */
    lastAccess: string;
  };

  /**
   * n8n instance context (credentials and configuration)
   *
   * Contains the n8n API credentials and instance-specific settings.
   * This is the critical data needed to reconnect to the correct n8n instance.
   *
   * Derived from {@link InstanceContext} so every field the live context carries —
   * including `n8nMcpAccessToken` and any field added later — is part of the
   * persistence contract instead of being silently dropped on export/restore
   * (#1045). Only `n8nApiUrl` and `n8nApiKey` are narrowed to required: a session
   * without both cannot be restored (GHSA-2cf7-hpwf-47h9 hardening, #844).
   *
   * Note: API keys and access tokens are stored in plaintext. The downstream
   * application MUST encrypt this data before persisting to disk.
   */
  context: Omit<InstanceContext, 'n8nApiUrl' | 'n8nApiKey'> & {
    /**
     * n8n instance API URL
     * Example: "https://n8n.example.com"
     */
    n8nApiUrl: string;

    /**
     * n8n instance API key (plaintext - encrypt before storage!)
     * Example: "n8n_api_1234567890abcdef"
     */
    n8nApiKey: string;
  };
}

```

### Core Architecture Module: `src/utils/auth.ts`
```
import crypto from 'crypto';

export type AuthFailureReason = 'no_auth_header' | 'invalid_auth_format' | 'invalid_token';

/**
 * Build an RFC 6750-compliant WWW-Authenticate challenge for Bearer auth.
 *
 * Per RFC 6750 §3, when the request lacks any authentication information
 * the resource server SHOULD NOT include an error code (the client may not
 * have known auth was required). Errors are signalled only when credentials
 * were sent but rejected.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6750#section-3
 */
export function buildBearerChallenge(
  reason: AuthFailureReason,
  realm: string = 'n8n-mcp'
): string {
  // realm is a quoted-string per RFC 7235 §2.2; escape backslash and double-quote.
  const escapedRealm = realm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (reason === 'no_auth_header') {
    return `Bearer realm="${escapedRealm}"`;
  }
  if (reason === 'invalid_auth_format') {
    return `Bearer realm="${escapedRealm}", error="invalid_request", error_description="Bearer token required"`;
  }
  return `Bearer realm="${escapedRealm}", error="invalid_token", error_description="Invalid bearer token"`;
}

export class AuthManager {
  private validTokens: Set<string>;
  private tokenExpiry: Map<string, number>;

  constructor() {
    this.validTokens = new Set();
    this.tokenExpiry = new Map();
  }

  /**
   * Validate an authentication token
   */
  validateToken(token: string | undefined, expectedToken?: string): boolean {
    if (!expectedToken) {
      // No authentication required
      return true;
    }

    if (!token) {
      return false;
    }

    // SECURITY: Use timing-safe comparison for static token
    // See: https://github.com/czlonkowski/n8n-mcp/issues/265 (CRITICAL-02)
    if (AuthManager.timingSafeCompare(token, expectedToken)) {
      return true;
    }

    // Check dynamic tokens
    if (this.validTokens.has(token)) {
      const expiry = this.tokenExpiry.get(token);
      if (expiry && expiry > Date.now()) {
        return true;
      } else {
        // Token expired
        this.validTokens.delete(token);
        this.tokenExpiry.delete(token);
        return false;
      }
    }

    return false;
  }

  /**
   * Generate a new authentication token
   */
  generateToken(expiryHours: number = 24): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiryTime = Date.now() + (expiryHours * 60 * 60 * 1000);

    this.validTokens.add(token);
    this.tokenExpiry.set(token, expiryTime);

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): void {
    this.validTokens.delete(token);
    this.tokenExpiry.delete(token);
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, expiry] of this.tokenExpiry.entries()) {
      if (expiry <= now) {
        this.validTokens.delete(token);
        this.tokenExpiry.delete(token);
      }
    }
  }

  /**
   * Hash a password or token for secure storage
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compare a plain token with a hashed token
   */
  static compareTokens(plainToken: string, hashedToken: string): boolean {
    const hashedPlainToken = AuthManager.hashToken(plainToken);
    return crypto.timingSafeEqual(
      Buffer.from(hashedPlainToken),
      Buffer.from(hashedToken)
    );
  }

  /**
   * Compare two tokens using constant-time algorithm to prevent timing attacks
   *
   * @param plainToken - Token from request
   * @param expectedToken - Expected token value
   * @returns true if tokens match, false otherwise
   *
   * @security This uses crypto.timingSafeEqual to prevent timing attack vulnerabilities.
   * Never use === or !== for token comparison as it allows attackers to discover
   * tokens character-by-character through timing analysis.
   *
   * @example
   * const isValid = AuthManager.timingSafeCompare(requestToken, serverToken);
   * if (!isValid) {
   *   return res.status(401).json({ error: 'Unauthorized' });
   * }
   *
   * @see https://github.com/czlonkowski/n8n-mcp/issues/265 (CRITICAL-02)
   */
  static timingSafeCompare(plainToken: string, expectedToken: string): boolean {
    try {
      // Tokens must be non-empty
      if (!plainToken || !expectedToken) {
        return false;
      }

      // Convert to buffers
      const plainBuffer = Buffer.from(plainToken, 'utf8');
      const expectedBuffer = Buffer.from(expectedToken, 'utf8');

      // Check length first (constant time not needed for length comparison)
      if (plainBuffer.length !== expectedBuffer.length) {
        return false;
      }

      // Constant-time comparison
      return crypto.timingSafeEqual(plainBuffer, expectedBuffer);
    } catch (error) {
      // Buffer conversion or comparison failed
      return false;
    }
  }
}
```

### Core Architecture Module: `src/utils/bridge.ts`
```
import { INodeExecutionData, IDataObject } from 'n8n-workflow';

export class N8NMCPBridge {
  /**
   * Convert n8n workflow data to MCP tool arguments
   */
  static n8nToMCPToolArgs(data: IDataObject): any {
    // Handle different data formats from n8n
    if (data.json) {
      return data.json;
    }
    
    // Remove n8n-specific metadata
    const { pairedItem, ...cleanData } = data;
    return cleanData;
  }

  /**
   * Convert MCP tool response to n8n execution data
   */
  static mcpToN8NExecutionData(mcpResponse: any, itemIndex: number = 0): INodeExecutionData {
    // Handle MCP content array format
    if (mcpResponse.content && Array.isArray(mcpResponse.content)) {
      const textContent = mcpResponse.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      
      try {
        // Try to parse as JSON if possible
        const parsed = JSON.parse(textContent);
        return {
          json: parsed,
          pairedItem: itemIndex,
        };
      } catch {
        // Return as text if not JSON
        return {
          json: { result: textContent },
          pairedItem: itemIndex,
        };
      }
    }

    // Handle direct object response
    return {
      json: mcpResponse,
      pairedItem: itemIndex,
    };
  }

  /**
   * Convert n8n workflow definition to MCP-compatible format
   */
  static n8nWorkflowToMCP(workflow: any): any {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      nodes: workflow.nodes?.map((node: any) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        parameters: node.parameters,
        position: node.position,
      })),
      connections: workflow.connections,
      settings: workflow.settings,
      metadata: {
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        active: workflow.active,
      },
    };
  }

  /**
   * Convert MCP workflow format to n8n-compatible format
   */
  static mcpToN8NWorkflow(mcpWorkflow: any): any {
    return {
      name: mcpWorkflow.name,
      nodes: mcpWorkflow.nodes || [],
      connections: mcpWorkflow.connections || {},
      settings: mcpWorkflow.settings || {
        executionOrder: 'v1',
      },
      staticData: null,
      pinData: {},
    };
  }

  /**
   * Convert n8n execution data to MCP resource format
   */
  static n8nExecutionToMCPResource(execution: any): any {
    return {
      uri: `execution://${execution.id}`,
      name: `Execution ${execution.id}`,
      description: `Workflow: ${execution.workflowData?.name || 'Unknown'}`,
      mimeType: 'application/json',
      data: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.finished ? 'completed' : execution.stoppedAt ? 'stopped' : 'running',
        mode: execution.mode,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt,
        error: execution.data?.resultData?.error,
        executionData: execution.data,
      },
    };
  }

  /**
   * Convert MCP prompt arguments to n8n-compatible format
   */
  static mcpPromptArgsToN8N(promptArgs: any): IDataObject {
    return {
      prompt: promptArgs.name || '',
      arguments: promptArgs.arguments || {},
      messages: promptArgs.messages || [],
    };
  }

  /**
   * Validate and sanitize data before conversion
   */
  static sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return {};
    }

    if (typeof data !== 'object') {
      return { value: data };
    }

    // Remove circular references
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(data, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }));
  }

  /**
   * Extract error information for both n8n and MCP formats
   */
  static formatError(error: any): any {
    return {
      message: error.message || 'Unknown error',
      type: error.name || 'Error',
      stack: error.stack,
      details: {
        code: error.code,
        statusCode: error.statusCode,
        data: error.data,
      },
    };
  }
}
```

### Core Architecture Module: `src/utils/cache-utils.ts`
```
/**
 * Cache utilities for flexible instance configuration
 * Provides hash creation, metrics tracking, and cache configuration
 */

import { scryptSync, randomBytes } from 'crypto';
import { LRUCache } from 'lru-cache';
import { logger } from './logger';

/**
 * Per-process random salt for the cache-key KDF. Generated once at module
 * load, never persisted, rotates on process restart (the in-memory cache
 * rotates with it, so that's fine).
 */
const CACHE_KEY_SALT = randomBytes(16);

/**
 * scrypt cost parameters. Kept intentionally low: this KDF runs on cache
 * miss during request handling, and we care more about not blocking the
 * event loop than about brute-force resistance. The aggressive
 * memoization (`hashMemoCache`) means each unique input pays the cost
 * exactly once per process lifetime.
 *
 * N=1024, r=8, p=1 is roughly 2–5 ms on modern hardware. bcrypt/argon2
 * at default parameters would be 50–100 ms — too slow for a cache miss
 * path.
 */
const CACHE_KEY_SCRYPT_OPTS = { N: 1024, r: 8, p: 1 } as const;

/**
 * Cache metrics for monitoring and optimization
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  deletes: number;
  clears: number;
  size: number;
  maxSize: number;
  avgHitRate: number;
  createdAt: Date;
  lastResetAt: Date;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  max: number;
  ttlMinutes: number;
}

/**
 * Simple memoization cache for hash results
 * Limited size to prevent memory growth
 */
const hashMemoCache = new Map<string, string>();
const MAX_MEMO_SIZE = 1000;

/**
 * Metrics tracking for cache operations
 */
class CacheMetricsTracker {
  private metrics!: CacheMetrics;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    this.reset();
  }

  /**
   * Reset all metrics to initial state
   */
  reset(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      size: 0,
      maxSize: 0,
      avgHitRate: 0,
      createdAt: this.startTime,
      lastResetAt: new Date()
    };
  }

  /**
   * Record a cache hit
   */
  recordHit(): void {
    this.metrics.hits++;
    this.updateHitRate();
  }

  /**
   * Record a cache miss
   */
  recordMiss(): void {
    this.metrics.misses++;
    this.updateHitRate();
  }

  /**
   * Record a cache eviction
   */
  recordEviction(): void {
    this.metrics.evictions++;
  }

  /**
   * Record a cache set operation
   */
  recordSet(): void {
    this.metrics.sets++;
  }

  /**
   * Record a cache delete operation
   */
  recordDelete(): void {
    this.metrics.deletes++;
  }

  /**
   * Record a cache clear operation
   */
  recordClear(): void {
    this.metrics.clears++;
  }

  /**
   * Update cache size metrics
   */
  updateSize(current: number, max: number): void {
    this.metrics.size = current;
    this.metrics.maxSize = max;
  }

  /**
   * Update average hit rate
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    if (total > 0) {
      this.metrics.avgHitRate = this.metrics.hits / total;
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get formatted metrics for logging
   */
  getFormattedMetrics(): string {
    const { hits, misses, evictions, avgHitRate, size, maxSize } = this.metrics;
    return `Cache Metrics: Hits=${hits}, Misses=${misses}, HitRate=${(avgHitRate * 100).toFixed(2)}%, Size=${size}/${maxSize}, Evictions=${evictions}`;
  }
}

// Global metrics tracker instance
export const cacheMetrics = new CacheMetricsTracker();

/**
 * Get cache configuration from environment variables or defaults
 * @returns Cache configuration with max size and TTL
 */
export function getCacheConfig(): CacheConfig {
  const max = parseInt(process.env.INSTANCE_CACHE_MAX || '100', 10);
  const ttlMinutes = parseInt(process.env.INSTANCE_CACHE_TTL_MINUTES || '30', 10);

  // Validate configuration bounds
  const validatedMax = Math.max(1, Math.min(10000, max)) || 100;
  const validatedTtl = Math.max(1, Math.min(1440, ttlMinutes)) || 30; // Max 24 hours

  if (validatedMax !== max || validatedTtl !== ttlMinutes) {
    logger.warn('Cache configuration adjusted to valid bounds', {
      requestedMax: max,
      requestedTtl: ttlMinutes,
      actualMax: validatedMax,
      actualTtl: validatedTtl
    });
  }

  return {
    max: validatedMax,
    ttlMinutes: validatedTtl
  };
}

/**
 * Derive a cache key from a composite input string using scrypt, a key
 * derivation function on CodeQL's `js/insufficient-password-hash`
 * allowlist. Memoized for the lifetime of the process so repeated
 * lookups are O(1) — each unique input pays the KDF cost exactly once.
 *
 * Why scrypt rather than a plain hash:
 *   - The composite input contains the n8n API key, so we don't want
 *     cache-key values to be trivially reversible if they end up in
 *     logs or memory dumps.
 *   - scrypt is memory-hard and has a per-process random salt, so two
 *     server instances produce different cache keys for the same tenant.
 *   - Cost params are intentionally low (`N=1024`, ~2–5 ms) because the
 *     threat model is "don't leak credentials via cache keys", not
 *     "resist offline brute force", and the memoization layer means
 *     we only pay the cost on cache miss.
 *
 * @param input - The composite input string to derive a key from
 * @returns A 64-character hex-encoded 32-byte key
 */
export function createCacheKey(input: string): string {
  // Check memoization cache first
  if (hashMemoCache.has(input)) {
    return hashMemoCache.get(input)!;
  }

  // Derive a 32-byte key from the input using scrypt with a
  // per-process random salt. scryptSync blocks the event loop for a
  // few ms, which is acceptable because (a) it only runs on cache miss
  // and (b) memoization means each unique input runs it exactly once.
  const hash = scryptSync(input, CACHE_KEY_SALT, 32, CACHE_KEY_SCRYPT_OPTS).toString('hex');

  // Add to memoization cache with size limit
  if (hashMemoCache.size >= MAX_MEMO_SIZE) {
    // Remove oldest entries (simple FIFO)
    const firstKey = hashMemoCache.keys().next().value;
    if (firstKey) {
      hashMemoCache.delete(firstKey);
    }
  }
  hashMemoCache.set(input, hash);

  return hash;
}

/**
 * Create LRU cache with metrics tracking
 * @param onDispose - Optional callback for when items are evicted
 * @returns Configured LRU cache instance
 */
export function createInstanceCache<T extends {}>(
  onDispose?: (value: T, key: string) => void
): LRUCache<string, T> {
  const config = getCacheConfig();

  return new LRUCache<string, T>({
    max: config.max,
    ttl: config.ttlMinutes * 60 * 1000, // Convert to milliseconds
    updateAgeOnGet: true,
    dispose: (value, key) => {
      cacheMetrics.recordEviction();
      if (onDispose) {
        onDispose(value, key);
      }
      logger.debug('Cache eviction', {
        cacheKey: key.substring(0, 8) + '...',
        metrics: cacheMetrics.getFormattedMetrics()
      });
    }
  });
}

/**
 * Mutex implementation for cache operations
 * Prevents race conditions during concurrent access
 */
export class CacheMutex {
  private locks: Map<string, Promise<void>> = new Map();
  private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly timeout: number = 5000; // 5 second timeout

  /**
   * Acquire a lock for the given key
   * @param key - The cache key to lock
   * @returns Promise that resolves when lock is acquired
   */
  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // Previous lock failed, we can proceed
      }
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        resolve();
        this.locks.delete(key);
        const timeout = this.lockTimeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.lockTimeouts.delete(key);
        }
      };
    });

    this.locks.set(key, lockPromise);

    // Set timeout to prevent stuck locks
    const timeout = setTimeout(() => {
      logger.warn('Cache lock timeout, forcefully releasing', { key: key.substring(0, 8) + '...' });
      releaseLock!();
    }, this.timeout);
    this.lockTimeouts.set(key, timeout);

    return releaseLock!;
  }

  /**
   * Check if a key is currently locked
   * @param key - The cache key to check
   * @returns True if the key is locked
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAll(): void {
    this.lockTimeouts.forEach(timeout => clearTimeout(timeout));
    this.locks.clear();
    this.lockTimeouts.clear();
  }
}

/**
 * Retry configuration for API operations
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.3
};

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt - Current attempt number (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const exponentialDelay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt),
    config.maxDelayMs
  );

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * config.jitterFactor * Math.random();

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Execute function with retry logic
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @param co
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1119** (2026-09-16): **N8nApiClient source control methods do not match the n8n 2.39 Public API**
  *Symptoms*: ## Problem  n8n 2.39 added `GET /source-control/status` and `POST /source-control/push` to the Public API; neither is in the 2.38.5 spec. `N8nApiClient` already has methods for both, but their requests do not match the new contract.  **`getSourceControlStatus()`** ([n8n-api-client.ts:1474](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/n8n-api-client.ts#L1474)) sends no query parameters. The 2.39.6 spec requires `direction`:  ```yaml parameters:   - name: direction     in: query     required: true     schema: { type: string, enum: [push, pull] } ```  **`pushSourceControl(message, fileNames?: string[])`** ([n8n-api-client.ts:1492](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/n8n-api-client.ts#L1492)) sends `{ message, fileNames }`. The 2.39.6 spec requires this body:  ```yaml required: [commitMessage, fileNames] properties:   commitMessage: string   force: boolean   fileNames:     type: array     items:       required: [id, type]       properties:         id: { type: string, minLength: 1 }         type: { enum: [credential, workflow, tags, variables, file, folders, project, datatable] } ```  Both calls would answer 400. The `SourceControlStatus` and `SourceControlPushResult` types in `src/types/n8n-api.ts` should be checked against the 2.39 response DTOs as well.  `pullSourceControl(force)` sends `{ force }`, which is still valid. The 2.39 pull body also accepts `autoPublish

- **Issue #1118** (2026-09-16): **n8n_update_partial_workflow: misleading error after n8n 2.39 refuses to publish on save**
  *Symptoms*: ## Problem  Since n8n 2.39, saving a published workflow through `PUT /workflows/{id}` re-publishes it only if the caller may publish. The caller needs both:  - the `workflow:activate` API key scope - the `workflow:publish` permission on the workflow  Without either, n8n saves the change as a draft, keeps the published version live, and returns **403**:  ```json {   "message": "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",   "reason": "insufficient_api_key_scope",   "versionId": "<id of the draft just saved>" } ```  `reason` can also be `insufficient_permissions`. On the n8n side this comes from `WorkflowService.assertMayPublishOnSave` and `WorkflowPublishForbiddenError`, both added in 2.39.  ## What n8n-mcp does today  This is from reading the code, not from a live run. A test needs a key with narrowed scopes or a user who may edit but not publish.  **`n8n_update_partial_workflow`** ([handlers-workflow-diff.ts:417-535](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/mcp/handlers-workflow-diff.ts#L417-L535)):  1. The PUT fails with 403. 2. The follow-up GET shows a new `versionId` (the draft), so `compareVersions` returns `changed` and the handler rolls back. 3. The rollback PUT also re-publishes, so n8n answers 403 again after persisting it. `sameWritableContent` then confirms the restore, which sets `rollbackPerformed: true` and `rollbackVerifiedAfterError: true

- **Issue #1115** (2026-09-16): **"Possible missing $ prefix" warning fires on words inside string literals, e.g. JMESPath queries over .all() items**
  *Symptoms*: ## Summary  The expression warning **"Possible missing $ prefix for variable (e.g., use $json instead of json)"** fires on the words `json`/`node`/`input`/`items`/`workflow`/`execution` inside **string literals**. The idiomatic case is a JMESPath query over `.all()` items, which must say `json.` because each item is a `{json: …}` wrapper.  ## Reproduction  ``` {{ $jmespath($('Split Customers').all(), "[?json.country=='PL'].json.name") }} ```  → `Expression warning: … Possible missing $ prefix for variable (e.g., use $json instead of json)`  The expression is correct (verified on n8n 2.38.5 → `["Acme","Bar"]`). Following the hint (`$json.country`) or dropping the prefix returns `[]` silently.  ## Where  [`src/services/expression-validator.ts#L221`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/expression-validator.ts#L221):  ```ts const missingPrefixPattern = /(?<![.$\w['])\b(json|node|input|items|workflow|execution)\b(?!\s*[:''])/; ```  The pattern runs on the raw expression, including string literal contents (a `.` before `json` is excluded, but `[?json` inside a string is not).  ## Suggested fix  Strip string and template-literal contents before this check (the Code-node validator already has a stripped view for similar checks), or skip the check when the match sits inside quotes. 

- **Issue #1113** (2026-09-16): **Python Code-node validation still models Pyodide: legacy _input/_json/_now, blocked imports and classes pass; a valid single-dict return errors**
  *Symptoms*: ## Summary  The Python Code-node checks still model the removed **Pyodide "Python (Beta)"** runtime. On n8n 2.x (`language: "pythonNative"`, task-runner native Python) several patterns that always fail at runtime pass validation, and one valid return shape is rejected. Everything below was verified by execution on n8n 2.38.5 with the `n8nio/runners` sidecar.  ## Not flagged, but fail at runtime  | Code | Runtime result | |---|---| | `_input.all()`, `_input.first()`, `_json`, `_node["X"]`, `_now`, `_today`, `_jmespath(...)` | `NameError` (native Python exposes only `_items` in all-items mode and `_item` in each-item mode) | | `_items` in each-item mode / `_item` in all-items mode | `NameError` | | `item.json.field` | `AttributeError: 'dict' object has no attribute 'json'` | | **any** `import` not on the instance allowlist, e.g. `import json` | `Security violations detected` / `Import of standard library module 'json' is disallowed. Allowed stdlib modules: none` (default allowlist is empty; n8n Cloud allows none). Only `requests`/`pandas`/`numpy`/`pip` are flagged today. | | `class Foo: ...` | `__build_class__ not found` | | `type(x)`, `getattr`, `hasattr`, `setattr`, `vars`, `dir`, `globals`, `locals`, `open`, `input`, `compile` | `NameError` (default `N8N_RUNNERS_BUILTINS_DENY`). Only `eval(`/`exec(` get a warning. | | `x.__class__`, `"{0.__class__}".format(x)`, `__import__("json")` | `Security violations detected` (static rejection before execution) | | `global counter` insi

- **Issue #1112** (2026-09-16): **validate_node reports "Code cannot be empty" for every Python Code node using language pythonNative**
  *Symptoms*: ## Summary  `validate_node` reports **"Code cannot be empty"** (property `jsCode`) for every Code node that uses `language: "pythonNative"`, even when `pythonCode` has content. `pythonNative` is the only Python option n8n 2.x offers (`get_node` lists `javaScript` | `pythonNative`), so `validate_node` is effectively unusable for Python Code nodes. Workflow-level validation handles it correctly (it normalizes `pythonNative` → `python`).  ## Reproduction  ```js validate_node({   nodeType: "nodes-base.code",   profile: "runtime",   config: { language: "pythonNative", mode: "runOnceForEachItem",             pythonCode: "row = _item[\"json\"]\nreturn {\"json\": row}" } }) // → valid: false, errors: [{ property: "jsCode", message: "Code cannot be empty" }] ```  ## Where  [`src/services/config-validator.ts#L603`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/config-validator.ts#L603):  ```ts const codeField = config.language === 'python' ? 'pythonCode' : 'jsCode'; ```  Compare [`node-specific-validators.ts#L1266`](https://github.com/czlonkowski/n8n-mcp/blob/aef47e2f5f9dd7ac4ae0dd18cb9d2fddd58b3983/src/services/node-specific-validators.ts#L1266), which already maps `pythonNative` → `python`.  ## Suggested fix  Apply the same normalization in `ConfigValidator.validateCode` (`language === 'python' || language === 'pythonNative'`), and add a `validate_node` test with `pythonNative`. 

- **Issue #1111** (2026-09-16): **Error-output heuristic turns a Respond to Webhook fan-out into a hard error and prescribes a fix that breaks the success path**
  *Symptoms*: ## Summary  `validate_workflow` raises a **hard error** (`valid: false`) whenever a node's `main[0]` fans out to more than one node and one of the targets *looks like* an error handler by **name** (`error`, `fail`, `catch`, `exception`) or **type** (`respondToWebhook`, `emailSend`). The suggested "fix" moves that node onto the error output and adds `onError: "continueErrorOutput"`. For the most common real case, a Respond to Webhook next to a side-effect node, following the fix breaks the workflow: the webhook would only ever answer when the upstream node **fails**.  ## Reproduction (validate_workflow, profile `runtime`)  Webhook (`responseMode: responseNode`) → Set "Prepare Order" → [**Respond to Webhook**, Set "Save Order"]  ```json {"connections": {"Webhook": {"main": [[{"node": "Prepare Order", "type": "main", "index": 0}]]},  "Prepare Order": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0},                              {"node": "Save Order", "type": "main", "index": 0}]]}}} ```  Result:  ``` valid: false Incorrect error output configuration. Nodes "Respond to Webhook" appear to be error handlers but are in main[0] (success output) along with other nodes. ... CORRECT (should be): main[1] = [Respond to Webhook] ... Also add: "onError": "continueErrorOutput" to the "Prepare Order" node. ```  The name heuristic fires the same way on ordinary fan-outs to nodes named e.g. "Log failed logins", "Catch-all router" or "Handle error (real error)".  ## Where  [

- **Issue #1103** (2026-09-16): **validate_node never checks IF/Switch operator structure, so it passes configs that validate_workflow and n8n_create_workflow reject**
  *Symptoms*: Spotted during the live testing on #1099 and confirmed to be broader than it first looked. Pre-existing; nothing in that PR caused it.  ## The divergence  `validate_node` never runs operator-structure validation. `validateConditionNodeStructure` is called from `validateWorkflowStructure` (the `n8n_create_workflow` / `n8n_update_full_workflow` path) and from `WorkflowValidator` (`validate_workflow`), but not from `EnhancedConfigValidator`, which is what `validate_node` uses.  So every operator defect class passes `validate_node` and fails the other two. Measured against the built code, for both node types:  | node | operator | `validate_node` | `validate_workflow` | |---|---|---|---| | IF v2.2 | `{type: "string"}` — no `operation` | clean | error | | IF v2.2 | `{operation: "equals"}` — no `type` | clean | error | | IF v2.2 | `{type: "equals", operation: "equals"}` — operation name in the type field | clean | error | | IF v2.2 | `"equals"` — a string | clean | error | | IF v2.2 | `null` | clean | error | | Switch v3.2 | all five of the same | clean | error |  Ten for ten. `EnhancedConfigValidator` is not unaware of these nodes — `validateSwitchNodeStructure` checks `rules.values` entries for `conditions` and `outputKey` — it just stops short of the operators inside them.  ## Why it matters  This is the same shape as #1096, the divergence that prompted that PR: an agent validates, is told the config is fine, then the write is refused with no way to tell which validator to believ

- **Issue #1102** (2026-09-16): **cleanupOrphanedWorkflows deletes other test files' in-flight workflows, making local integration runs non-deterministic**
  *Symptoms*: Found while running the full suite repeatedly during #1099. Test infrastructure only — no effect on shipped code, and CI is not affected.  ## The race  `cleanupOrphanedWorkflows` (`tests/integration/n8n-api/utils/cleanup-helpers.ts:25`) deletes **every** workflow on the instance whose name starts with the shared cleanup prefix or that carries the cleanup tag:  ```ts const testWorkflows = allWorkflows.filter(w => {   const isTestWorkflow = w.tags?.includes(creds.cleanup.tag) || w.name?.startsWith(creds.cleanup.namePrefix);   const isPreserved = preservedWorkflowNames.has(w.name);   return isTestWorkflow && !isPreserved; }); ```  The scope is the whole instance, not the calling file's own resources. 18 test files call it from `afterAll`:  ```ts afterAll(async () => {   if (!process.env.CI) {     await cleanupOrphanedWorkflows();   } }); ```  Vitest runs test files in parallel, so the first file to finish deletes the in-flight workflows of every file still running. Each file already has `afterEach(() => context.cleanup())`, which deletes its own tracked resources correctly — the instance-wide sweep is belt-and-braces for leaks from crashed runs, and it is the part that does the damage.  ## Observed  Three consecutive `npm test` runs on the same commit, failing in three different files, every failure a 404 on a workflow the test had just created:  | run | failures | |---|---| | 1 | `integration/database/performance.test.ts` (timing ratio — unrelated, separately flaky) | | 2 | `sm

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

### Incident Patch 1: `4cc0efda` (2026-09-23)
**Commit Message**: Merge pull request #1132 from czlonkowski/fix/agents-default-personal-project

feat(agents): default projectId to the caller's personal project (v2.89.0)

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -7,6 +7,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.89.0] - 2026-09-23
+
+### Changed
+
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also on failure responses (n8n rejecting another argument, or a timeout or transport error on the call itself). The action then takes a second round trip, the lookup before the call. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description, the `args` schema description and `tools_documentation` describe the default; they no longer say that arguments are forwarded verbatim.
+
 ## [2.88.0] - 2026-09-23
 
 ### Changed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.88.0",
+  "version": "2.89.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.88.0",
+      "version": "2.89.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.88.0",
+  "version": "2.89.0",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.87.0",
+  "version": "2.89.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/agents-action-map.ts` (modified, +9/-3)
```diff
@@ -41,6 +41,12 @@ export interface AgentActionSpec {
    * create/mutate/call could run it a second time.
    */
   idempotent: boolean;
+  /**
+   * The official tool requires `projectId`. When `args.projectId` is omitted
+   * or is the alias `personal`, the handler fills in the personal project of
+   * the MCP token's user.
+   */
+  defaultsToPersonalProject?: boolean;
 }
 
 export const DEFAULT_TIMEOUT_MS = 30_000;
@@ -58,7 +64,7 @@ export const AGENT_ACTION_MAP: Record<AgentAction, AgentActionSpec> = {
   reference: { tools: ['get_agent_builder_reference'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   search: { tools: ['search_agents'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   get: { tools: ['get_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
-  create: { tools: ['create_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
+  create: { tools: ['create_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false, defaultsToPersonalProject: true },
   mutate: { tools: ['mutate_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
   validate: { tools: ['validate_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   call: { tools: ['call_agent'], defaultTimeoutMs: CALL_TIMEOUT_MS, destructive: true, idempotent: false },
@@ -67,8 +73,8 @@ export const AGENT_ACTION_MAP: Record<AgentAction, AgentActionSpec> = {
   revert: { tools: ['revert_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
   versions: { tools: ['list_agent_versions'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
   delete: { tools: ['delete_agent'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
-  discover_assets: { tools: ['discover_agent_assets'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
-  verify_mcp_server: { tools: ['verify_agent_mcp_server'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true },
+  discover_assets: { tools: ['discover_agent_assets'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true, defaultsToPersonalProject: true },
+  verify_mcp_server: { tools: ['verify_agent_mcp_server'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: false, idempotent: true, defaultsToPersonalProject: true },
   update_integration: { tools: ['update_agent_integration'], defaultTimeoutMs: DEFAULT_TIMEOUT_MS, destructive: true, idempotent: false },
 };
 
```

**File**: `src/mcp/handlers-agents.ts` (modified, +61/-6)
```diff
@@ -3,7 +3,8 @@
  *
  * Validates the action/timeout envelope, resolves the current alias for the
  * requested action against the connected instance's tool list, forwards
- * `args` verbatim to the official tool, and maps the official response
+ * `args` to the official tool (filling in a default projectId where the
+ * action needs one), and maps the official response
  * shapes onto this server's response envelope. All business logic for
  * *what* an action does lives in n8n's own MCP server; this file only
  * translates between the two contracts.
@@ -56,6 +57,31 @@ function invalid(action: string | undefined, message: string): McpToolResponse {
   return { success: false, action, code: 'INVALID_ARGS', error: message };
 }
 
+const PERSONAL_PROJECT_ALIAS = 'personal';
+const PROJECT_ID_HINT = "projectId could not be defaulted to your personal project. List the projects with n8n_list_catalog({kind: 'projects'}) and pass one as args.projectId.";
+
+/**
+ * The personal project of the MCP token's user, read with the official
+ * `search_projects` tool. That tool lists only projects the caller has a
+ * relation to, so `type: personal` returns the caller's own project and never
+ * another user's, even for an instance owner. Returns undefined when the tool
+ * is missing, the call fails, or the answer is not exactly one project
+ * (`limit: 2` plus `count` keep a truncated answer from passing as unique).
+ */
+async function personalProjectId(client: N8nOfficialMcpClient, toolNames: string[], timeoutMs: number): Promise<string | undefined> {
+  if (!toolNames.includes('search_projects')) return undefined;
+  try {
+    const result = await client.callTool('search_projects', { type: 'personal', limit: 2 }, { timeoutMs, idempotent: true });
+    const json = result.json as any;
+    if (result.isError || json?.ok === false) return undefined;
+    if (typeof json?.count === 'number' && json.count !== 1) return undefined;
+    const projects = (Array.isArray(json?.data) ? json.data : []).filter((p: any) => p?.type === 'personal' && typeof p.id === 'string');
+    return projects.length === 1 ? projects[0].id : undefined;
+  } catch {
+    return undefined;
+  }
+}
+
 /**
  * Resolves the credential id implicated by a "missing credential" outcome,
  * from the official result alone — `args` never carries a credential id for
@@ -128,6 +154,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
   if (!client) return notConfiguredResponse(context, action);
 
   const spec = AGENT_ACTION_MAP[action];
+  // Outside the try so a call that throws after the lookup still reports it.
+  let defaultedProjectId: string | undefined;
   try {
     const caps = await client.capabilities();
     if (!caps.reachable) {
@@ -149,7 +177,26 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
       return { success: true, action, officialTool: tool, data: await client.reference(tool) };
     }
 
-    const result: OfficialToolResult = await client.callTool(tool, toolArgs, { timeoutMs: timeoutMs ?? spec.defaultTimeoutMs, idempotent: spec.idempotent });
+    const callTimeoutMs = timeoutMs ?? spec.defaultTimeoutMs;
+    let callArgs = toolArgs;
+    // null and "" count as omitted: LLM callers send them for "unset".
+    const requested = toolArgs.projectId;
+    const wantsPersonalProject = spec.defaultsToPersonalProject
+      && (requested === undefined || requested === null || requested === '' || requested === PERSONAL_PROJECT_ALIAS);
+    if (wantsPersonalProject) {
+      defaultedProjectId = await personalProjectId(client, caps.toolNames, Math.min(callTimeoutMs, DEFAULT_TIMEOUT_MS));
+      if (defaultedProjectId) {
+        callArgs = { ...toolArgs, projectId: defaultedProjectId };
+      } else if (requested === PERSONAL_PROJECT_ALIAS) {
+        // n8n would take the alias as a literal project ID and answer not-found.
+        return { ...invalid(action, 'projectId "personal" could not be resolved to your personal project.'), hint: PROJECT_ID_HINT };
+      } else if (requested !== undefined) {
+        const { projectId: _omit, ...rest } = toolArgs;
+        callArgs = rest;
+      }
+    }
+
+    const result: OfficialToolResult = await client.callTool(tool, callArgs, { timeoutMs: callTimeoutMs, idempotent: spec.idempotent });
     const data = result.json ?? result.text;
 
     // "Input validation error" is the literal prefix n8n's MCP server puts on
@@ -158,7 +205,12 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
     // that wording, invalid args stop mapping to INVALID_ARGS and degrade to
     // OFFICIAL_MCP_ERROR; nothing else breaks.
     // Error text is capped at 2000 chars — n8n's error text is untrusted output.
-    if (result.text.startsWith('Input validation error')) return invalid(action, result.text.slice(0, 2000));
+    if (result.text.startsWith('Input validation error')) {
+      const response = invalid
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-list-catalog.ts` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ query filters items by a case-insensitive substring match on name; limit caps th
       'n8n_list_catalog({kind: "tags", query: "prod", limit: 20})',
     ],
     useCases: [
-      'Resolve a projectId before n8n_manage_agents create or n8n_manage_datatable create',
+      'Resolve a team projectId for n8n_manage_agents (which defaults to the personal project) or before n8n_manage_datatable create',
       'Find the caller\'s personal project on an instance without team projects',
       'Look up a tag id by name before filtering workflows',
     ],
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-manage-agents.ts` (modified, +12/-9)
```diff
@@ -6,19 +6,22 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
   essentials: {
     description: 'Create, configure, validate, run and publish n8n Agents (persisted assistants) through n8n\'s instance-level MCP server. Needs N8N_MCP_ACCESS_TOKEN and n8n >= 2.34 with the agents module.',
     keyParameters: ['action', 'args', 'timeoutMs'],
-    example: 'n8n_manage_agents({action: "reference"}) → n8n_manage_agents({action: "create", args: {projectId, name, config: {model: "openai/gpt-4o-mini", instructions: "..."}}})',
-    performance: '150-400 ms per action; call: 5-60 s per turn (one n8n execution each)',
+    example: 'n8n_manage_agents({action: "reference"}) → n8n_manage_agents({action: "create", args: {name, config: {model: "openai/gpt-4o-mini", instructions: "..."}}})',
+    performance: '150-400 ms per action (a second round trip when projectId is defaulted); call: 5-60 s per turn (one n8n execution each)',
     tips: [
       'Always read action=reference first: it returns the config schema and the exact mutate operations.',
       'Every mutate needs the configHash from the last get/create/mutate response; STALE_CONFIG means re-read it.',
+      'create, discover_assets and verify_mcp_server default projectId to your personal project; pass a team project ID from n8n_list_catalog({kind: "projects"}) to use another one.',
       'publish only on explicit user request; call uses real credentials and tools.',
       'approvals[] in a call result are for the human to decide — resume with {type: "approval", approved, continuation} only after they say so.',
     ],
   },
   full: {
-    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded verbatim, results are returned verbatim under data with our envelope and error codes.
+    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded unchanged apart from the projectId default described below, and results are returned verbatim under data with our envelope and error codes.
 
-Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (projectId, name, config) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
+Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (name, config, projectId?) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
+
+projectId: create, discover_assets and verify_mcp_server need a project. When args.projectId is omitted, null, empty or "personal", the personal project of the MCP access token's user is filled in (read with n8n's search_projects) and returned as defaultedProjectId. If it cannot be resolved, "personal" is refused with INVALID_ARGS before anything is sent, and an omitted projectId is left for n8n to report; both responses carry a hint to pass projectId. search takes projectId only as an optional filter and is never defaulted.
 
 Gates: reference and search work for every agent; all other actions need the agent exposed to MCP (agents created here are exposed automatically).
 
@@ -27,20 +30,20 @@ Custom tools are TypeScript with only @n8n/agents and zod imports; errors from n
 Credentials: on this n8n generation the agents runtime rejects azureOpenAiApi and aws credentials as incompatible (reported as missing: ["credential"]); the response hint names the accepted credential types.`,
     parameters: {
       action: { type: 'string', required: true, description: 'reference | search | get | create | mutate | validate | call | publish | unpublish | revert | versions | delete | discover_assets | verify_mcp_server | update_integration' },
-      args: { type: 'object', description: 'Per action — search: projectId?, query?, excludeAgentId?, limit?; get: agentId, versionId?; create: projectId, name, config?; mutate: agentId, baseConfigHash, operation; validate: agentId; call: agentId, request ({type:"message", message, sessionId?} | {type:"approval", approved, continuation}); publish/revert: agentId, versionId?; unpublish/delete: agentId; versions: agentId, limit?, offset?; discover_assets: projectId, kind (models|integrations|workflows|subagents|mcpServers), provider?, credentialId?, query?; verify_mcp_server: projectId, name, url, transport?, authentication?, credential?; update_integration: agentId, action (connect|disconnect), type, credentialId, settings?, replacesCredentialId?' },
+      args: { type: 'object', description: 'Per action — search: projectId?, query?, excludeAgentId?, limit?; get: agentId, versionId?; create: name, config?, projectId? (defaults to your personal project); mutate: agentId, 
```

---

### Incident Patch 2: `d877d391` (2026-09-23)
**Commit Message**: fix(agents): address Copilot review on the projectId default

- keep defaultedProjectId when the action call throws after the lookup
- stop describing args as forwarded verbatim; document the extra
  search_projects round trip
- sync package.runtime.json to 2.89.0

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also when n8n then rejects another argument. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also on failure responses (n8n rejecting another argument, or a timeout or transport error on the call itself). The action then takes a second round trip, the lookup before the call. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description, the `args` schema description and `tools_documentation` describe the default; they no longer say that arguments are forwarded verbatim.
 
 ## [2.88.0] - 2026-09-23
 
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.87.0",
+  "version": "2.89.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/handlers-agents.ts` (modified, +6/-3)
```diff
@@ -3,7 +3,8 @@
  *
  * Validates the action/timeout envelope, resolves the current alias for the
  * requested action against the connected instance's tool list, forwards
- * `args` verbatim to the official tool, and maps the official response
+ * `args` to the official tool (filling in a default projectId where the
+ * action needs one), and maps the official response
  * shapes onto this server's response envelope. All business logic for
  * *what* an action does lives in n8n's own MCP server; this file only
  * translates between the two contracts.
@@ -153,6 +154,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
   if (!client) return notConfiguredResponse(context, action);
 
   const spec = AGENT_ACTION_MAP[action];
+  // Outside the try so a call that throws after the lookup still reports it.
+  let defaultedProjectId: string | undefined;
   try {
     const caps = await client.capabilities();
     if (!caps.reachable) {
@@ -176,7 +179,6 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
 
     const callTimeoutMs = timeoutMs ?? spec.defaultTimeoutMs;
     let callArgs = toolArgs;
-    let defaultedProjectId: string | undefined;
     // null and "" count as omitted: LLM callers send them for "unset".
     const requested = toolArgs.projectId;
     const wantsPersonalProject = spec.defaultsToPersonalProject
@@ -237,7 +239,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
     if (hint) response.hint = hint;
     return response;
   } catch (err) {
-    const failure = officialFailure(err, action);
+    const failure: McpToolResponse = officialFailure(err, action);
+    if (defaultedProjectId) failure.defaultedProjectId = defaultedProjectId;
     if (failure.code === 'OFFICIAL_MCP_TIMEOUT' && action === 'call') {
       failure.hint = OFFICIAL_MCP_HINTS.OFFICIAL_MCP_TIMEOUT + ' Each agent turn is one n8n execution; the executionId appears in n8n_executions once the turn finishes.';
     }
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-manage-agents.ts` (modified, +4/-4)
```diff
@@ -7,7 +7,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
     description: 'Create, configure, validate, run and publish n8n Agents (persisted assistants) through n8n\'s instance-level MCP server. Needs N8N_MCP_ACCESS_TOKEN and n8n >= 2.34 with the agents module.',
     keyParameters: ['action', 'args', 'timeoutMs'],
     example: 'n8n_manage_agents({action: "reference"}) → n8n_manage_agents({action: "create", args: {name, config: {model: "openai/gpt-4o-mini", instructions: "..."}}})',
-    performance: '150-400 ms per action; call: 5-60 s per turn (one n8n execution each)',
+    performance: '150-400 ms per action (a second round trip when projectId is defaulted); call: 5-60 s per turn (one n8n execution each)',
     tips: [
       'Always read action=reference first: it returns the config schema and the exact mutate operations.',
       'Every mutate needs the configHash from the last get/create/mutate response; STALE_CONFIG means re-read it.',
@@ -17,7 +17,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
     ],
   },
   full: {
-    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded verbatim, results are returned verbatim under data with our envelope and error codes.
+    description: `Thin adapter over n8n's official MCP agent tools. The action selects the official tool, args are forwarded unchanged apart from the projectId default described below, and results are returned verbatim under data with our envelope and error codes.
 
 Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (name, config, projectId?) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
 
@@ -40,10 +40,10 @@ Credentials: on this n8n generation the agents runtime rejects azureOpenAiApi an
       'n8n_manage_agents({action: "call", args: {agentId: "a1", request: {type: "message", message: "Summarise yesterday\'s tickets"}}, timeoutMs: 300000})',
     ],
     useCases: ['Build a persisted n8n Agent from a spec', 'Add skills, tasks and custom tools to an existing agent', 'Validate and test-run an agent before the user publishes it', 'Inspect agent versions and revert'],
-    performance: 'Each action is one HTTP round trip to the instance; call adds the model latency.',
+    performance: 'Each action is one HTTP round trip to the instance, plus a search_projects lookup first when create, discover_assets or verify_mcp_server defaults projectId; call adds the model latency.',
     errorHandling: 'STALE_CONFIG → get and retry with the new configHash. AGENT_NOT_RUNNABLE → validate and fix errors/missing. OFFICIAL_MCP_TIMEOUT on call → the turn continues in n8n; reuse sessionId instead of re-sending.',
     bestPractices: ['One mutate per resource, re-reading configHash between them', 'Validate before call and before publish', 'Name test agents "[TEST] …" and delete them afterwards', 'Never publish, delete or approve without the user saying so'],
-    pitfalls: ['args are forwarded verbatim — a misspelled field is reported by n8n as INVALID_ARGS', 'timeoutMs belongs at the top level, not inside args', 'The MCP access token is separate from the Public API key'],
+    pitfalls: ['args are forwarded unchanged apart from the projectId default — a misspelled field is reported by n8n as INVALID_ARGS', 'timeoutMs belongs at the top level, not inside args', 'The MCP access token is separate from the Public API key'],
     relatedTools: ['n8n_manage_credentials', 'n8n_list_catalog', 'n8n_executions', 'n8n_health_check'],
   },
 };
```

**File**: `src/mcp/tools-n8n-manager.ts` (modified, +1/-1)
```diff
@@ -933,7 +933,7 @@ Two sources:
       type: 'object',
       properties: {
         action: { type: 'string', enum: AGENT_ACTIONS, description: 'Operation to perform' },
-        args: { type: 'object', description: 'Arguments for the action, forwarded to n8n verbatim. See tools_documentation("n8n_manage_agents", "full") for the per-action fields.' },
+        args: { type: 'object', description: 'Arguments for the action, forwarded to n8n unchanged except that an omitted, null, empty or "personal" projectId on create, discover_assets and verify_mcp_server is replaced with your personal project ID. See tools_documentation("n8n_manage_agents", "full") for the per-action fields.' },
         timeoutMs: { type: 'integer', minimum: 5000, maximum: 600000, description: 'Request timeout in ms. Default 30000; 180000 for action=call. The agent run continues in n8n even if this expires.' },
       },
       required: ['action'],
```

**File**: `tests/unit/mcp/handlers-agents.test.ts` (modified, +11/-0)
```diff
@@ -308,6 +308,17 @@ describe('handleManageAgents projectId default', () => {
     expect(r.hint).toBeUndefined();
   });
 
+  it('keeps defaultedProjectId when the action call itself throws after the lookup', async () => {
+    const client = fakeClient(TOOLS);
+    client.callTool.mockImplementation(async (name: string) => {
+      if (name === 'search_projects') return { isError: false, text: JSON.stringify(PERSONAL), json: PERSONAL, sizeBytes: 10, truncated: false };
+      throw new OfficialMcpError('OFFICIAL_MCP_TIMEOUT', 'timed out');
+    });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'discover_assets', args: { kind: 'models' } });
+    expect(r).toMatchObject({ success: false, code: 'OFFICIAL_MCP_TIMEOUT', defaultedProjectId: 'pp1' });
+  });
+
   it('forwards unchanged when the personal-project lookup throws', async () => {
     const client = fakeClient(TOOLS);
     client.callTool.mockImplementation(async (name: string) => {
```

---

### Incident Patch 3: `2d0d7a67` (2026-09-23)
**Commit Message**: fix(agents): harden the personal-project default after review

- refuse an unresolved "personal" alias instead of sending it to n8n
- treat projectId null and "" as omitted
- keep defaultedProjectId on INVALID_ARGS responses
- cap the lookup at the caller's timeoutMs
- ask search_projects for limit 2 and require count 1; ignore error results

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted or is the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. n8n lists only projects the caller belongs to, so an instance owner never gets another user's personal project. The response reports the filled-in ID as `defaultedProjectId`. If the lookup fails or does not return exactly one personal project, the request goes to n8n unchanged, and the resulting `INVALID_ARGS` carries a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
+- **`n8n_manage_agents` defaults `projectId` to your personal project.** n8n's `create_agent`, `discover_agent_assets` and `verify_agent_mcp_server` require a `projectId`, and the tool did not say so or offer a way around it, so `discover_assets` without one failed with `projectId: Required`. When `args.projectId` is omitted, `null`, empty or the alias `personal` (the alias `n8n_manage_folders` already accepts), the tool now reads the personal project of the MCP access token's user with n8n's `search_projects` and fills it in. In n8n's implementation that tool lists only projects the caller belongs to, so an instance owner does not get another user's personal project. The response reports the filled-in ID as `defaultedProjectId`, also when n8n then rejects another argument. The lookup uses the caller's `timeoutMs` when it is shorter than 30 seconds. If the lookup fails or does not return exactly one personal project, `personal` is refused with `INVALID_ARGS` before anything is sent, and an omitted `projectId` is left for n8n to report; both responses carry a hint to pass `projectId` from `n8n_list_catalog({kind: 'projects'})`. An explicit `projectId` is never replaced, and `search`, where `projectId` is an optional filter, is not defaulted. The tool description and `tools_documentation` describe the default.
 
 ## [2.88.0] - 2026-09-23
 
```

**File**: `src/mcp/handlers-agents.ts` (modified, +25/-10)
```diff
@@ -64,14 +64,17 @@ const PROJECT_ID_HINT = "projectId could not be defaulted to your personal proje
  * `search_projects` tool. That tool lists only projects the caller has a
  * relation to, so `type: personal` returns the caller's own project and never
  * another user's, even for an instance owner. Returns undefined when the tool
- * is missing, the call fails, or the answer is not exactly one project; the
- * request then goes to n8n unchanged and n8n reports the missing projectId.
+ * is missing, the call fails, or the answer is not exactly one project
+ * (`limit: 2` plus `count` keep a truncated answer from passing as unique).
  */
-async function personalProjectId(client: N8nOfficialMcpClient, toolNames: string[]): Promise<string | undefined> {
+async function personalProjectId(client: N8nOfficialMcpClient, toolNames: string[], timeoutMs: number): Promise<string | undefined> {
   if (!toolNames.includes('search_projects')) return undefined;
   try {
-    const result = await client.callTool('search_projects', { type: 'personal' }, { timeoutMs: DEFAULT_TIMEOUT_MS, idempotent: true });
-    const projects = ((result.json as any)?.data ?? []).filter((p: any) => p?.type === 'personal' && typeof p.id === 'string');
+    const result = await client.callTool('search_projects', { type: 'personal', limit: 2 }, { timeoutMs, idempotent: true });
+    const json = result.json as any;
+    if (result.isError || json?.ok === false) return undefined;
+    if (typeof json?.count === 'number' && json.count !== 1) return undefined;
+    const projects = (Array.isArray(json?.data) ? json.data : []).filter((p: any) => p?.type === 'personal' && typeof p.id === 'string');
     return projects.length === 1 ? projects[0].id : undefined;
   } catch {
     return undefined;
@@ -171,16 +174,27 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
       return { success: true, action, officialTool: tool, data: await client.reference(tool) };
     }
 
+    const callTimeoutMs = timeoutMs ?? spec.defaultTimeoutMs;
     let callArgs = toolArgs;
     let defaultedProjectId: string | undefined;
+    // null and "" count as omitted: LLM callers send them for "unset".
+    const requested = toolArgs.projectId;
     const wantsPersonalProject = spec.defaultsToPersonalProject
-      && (toolArgs.projectId === undefined || toolArgs.projectId === PERSONAL_PROJECT_ALIAS);
+      && (requested === undefined || requested === null || requested === '' || requested === PERSONAL_PROJECT_ALIAS);
     if (wantsPersonalProject) {
-      defaultedProjectId = await personalProjectId(client, caps.toolNames);
-      if (defaultedProjectId) callArgs = { ...toolArgs, projectId: defaultedProjectId };
+      defaultedProjectId = await personalProjectId(client, caps.toolNames, Math.min(callTimeoutMs, DEFAULT_TIMEOUT_MS));
+      if (defaultedProjectId) {
+        callArgs = { ...toolArgs, projectId: defaultedProjectId };
+      } else if (requested === PERSONAL_PROJECT_ALIAS) {
+        // n8n would take the alias as a literal project ID and answer not-found.
+        return { ...invalid(action, 'projectId "personal" could not be resolved to your personal project.'), hint: PROJECT_ID_HINT };
+      } else if (requested !== undefined) {
+        const { projectId: _omit, ...rest } = toolArgs;
+        callArgs = rest;
+      }
     }
 
-    const result: OfficialToolResult = await client.callTool(tool, callArgs, { timeoutMs: timeoutMs ?? spec.defaultTimeoutMs, idempotent: spec.idempotent });
+    const result: OfficialToolResult = await client.callTool(tool, callArgs, { timeoutMs: callTimeoutMs, idempotent: spec.idempotent });
     const data = result.json ?? result.text;
 
     // "Input validation error" is the literal prefix n8n's MCP server puts on
@@ -191,7 +205,8 @@ export async function handleManageAgents(args: unknown, context?: InstanceContex
     // Error text is capped at 2000 chars — n8n's error text is untrusted output.
     if (result.text.startsWith('Input validation error')) {
       const response = invalid(action, result.text.slice(0, 2000));
-      if (wantsPersonalProject && !defaultedProjectId) response.hint = PROJECT_ID_HINT;
+      if (defaultedProjectId) response.defaultedProjectId = defaultedProjectId;
+      else if (wantsPersonalProject) response.hint = PROJECT_ID_HINT;
       return response;
     }
 
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-manage-agents.ts` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export const n8nManageAgentsDoc: ToolDocumentation = {
 
 Build sequence: reference → discover_assets (kind=models with provider, kind=integrations/workflows/subagents/mcpServers) → create (name, config, projectId?) → mutate per resource (config.patch is RFC 6902; skill.upsert/delete, task.upsert/delete, customTool.upsert/delete) → validate → call (test) → publish (only when asked).
 
-projectId: create, discover_assets and verify_mcp_server need a project. When args.projectId is omitted or is "personal", the personal project of the MCP access token's user is filled in (read with n8n's search_projects) and returned as defaultedProjectId. If it cannot be resolved, the request goes to n8n unchanged and the INVALID_ARGS response carries a hint to pass projectId. search takes projectId only as an optional filter and is never defaulted.
+projectId: create, discover_assets and verify_mcp_server need a project. When args.projectId is omitted, null, empty or "personal", the personal project of the MCP access token's user is filled in (read with n8n's search_projects) and returned as defaultedProjectId. If it cannot be resolved, "personal" is refused with INVALID_ARGS before anything is sent, and an omitted projectId is left for n8n to report; both responses carry a hint to pass projectId. search takes projectId only as an optional filter and is never defaulted.
 
 Gates: reference and search work for every agent; all other actions need the agent exposed to MCP (agents created here are exposed automatically).
 
```

**File**: `tests/unit/mcp/handlers-agents.test.ts` (modified, +53/-1)
```diff
@@ -207,7 +207,7 @@ describe('handleManageAgents projectId default', () => {
     const client = fakeClient(TOOLS, { search_projects: PERSONAL, discover_agent_assets: { ok: true, models: [] } });
     access.getOfficialMcpClient.mockReturnValue(client);
     const r = await handleManageAgents({ action: 'discover_assets', args: { kind: 'models', provider: 'minimax' } });
-    expect(client.callTool).toHaveBeenCalledWith('search_projects', { type: 'personal' }, { timeoutMs: 30_000, idempotent: true });
+    expect(client.callTool).toHaveBeenCalledWith('search_projects', { type: 'personal', limit: 2 }, { timeoutMs: 30_000, idempotent: true });
     expect(client.callTool).toHaveBeenLastCalledWith('discover_agent_assets', { kind: 'models', provider: 'minimax', projectId: 'pp1' }, { timeoutMs: 30_000, idempotent: true });
     expect(r).toMatchObject({ success: true, action: 'discover_assets', defaultedProjectId: 'pp1' });
   });
@@ -256,6 +256,58 @@ describe('handleManageAgents projectId default', () => {
     expect(client.callTool).toHaveBeenCalledWith('discover_agent_assets', { kind: 'models' }, expect.anything());
   });
 
+  it('treats null and "" as omitted, and drops them when the lookup fails', async () => {
+    const client = fakeClient(TOOLS, { search_projects: PERSONAL });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { projectId: null, name: 'x' } });
+    expect(client.callTool).toHaveBeenLastCalledWith('create_agent', { projectId: 'pp1', name: 'x' }, expect.anything());
+    expect(r.defaultedProjectId).toBe('pp1');
+
+    const noLookup = fakeClient(ALL);
+    access.getOfficialMcpClient.mockReturnValue(noLookup);
+    await handleManageAgents({ action: 'create', args: { projectId: '', name: 'x' } });
+    expect(noLookup.callTool).toHaveBeenLastCalledWith('create_agent', { name: 'x' }, expect.anything());
+  });
+
+  it('refuses an unresolved "personal" alias instead of sending it to n8n as a project ID', async () => {
+    const client = fakeClient(ALL);
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { projectId: 'personal', name: 'x' } });
+    expect(r).toMatchObject({ success: false, action: 'create', code: 'INVALID_ARGS' });
+    expect(r.hint).toContain('n8n_list_catalog');
+    expect(client.callTool).not.toHaveBeenCalled();
+  });
+
+  it.each([
+    ['an error result', { ok: false, code: 'forbidden' }],
+    ['a count above one on a truncated page', { ok: true, data: [{ id: 'a', type: 'personal' }], count: 3 }],
+  ])('does not default from %s', async (_label, projects) => {
+    const client = fakeClient(TOOLS, { search_projects: projects });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { name: 'x' } });
+    expect(client.callTool).toHaveBeenLastCalledWith('create_agent', { name: 'x' }, expect.anything());
+    expect(r.defaultedProjectId).toBeUndefined();
+  });
+
+  it('picks the personal entry and ignores team projects in the answer', async () => {
+    const client = fakeClient(TOOLS, { search_projects: { ok: true, data: [{ id: 't1', type: 'team' }, { id: 'pp1', type: 'personal' }] } });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'create', args: { name: 'x' } });
+    expect(r.defaultedProjectId).toBe('pp1');
+  });
+
+  it('reports defaultedProjectId when n8n rejects another argument, and caps the lookup at the caller timeout', async () => {
+    const client = fakeClient(TOOLS);
+    client.callTool.mockImplementation(async (name: string) => name === 'search_projects'
+      ? { isError: false, text: JSON.stringify(PERSONAL), json: PERSONAL, sizeBytes: 10, truncated: false }
+      : { isError: true, text: 'Input validation error: kind: Required', json: undefined, sizeBytes: 10, truncated: false });
+    access.getOfficialMcpClient.mockReturnValue(client);
+    const r = await handleManageAgents({ action: 'discover_assets', args: {}, timeoutMs: 5_000 });
+    expect(client.callTool).toHaveBeenCalledWith('search_projects', expect.anything(), { timeoutMs: 5_000, idempotent: true });
+    expect(r).toMatchObject({ success: false, code: 'INVALID_ARGS', defaultedProjectId: 'pp1' });
+    expect(r.hint).toBeUndefined();
+  });
+
   it('forwards unchanged when the personal-project lookup throws', async () => {
     const client = fakeClient(TOOLS);
     client.callTool.mockImplementation(async (name: string) => {
```

---

### Incident Patch 4: `ec903687` (2026-09-23)
**Commit Message**: docs: document the Node 22 workaround for fetch:community aborts

Conceived by Romuald Członkowski - https://aiadvisors.pl/en

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `MEMORY_N8N_UPDATE.md` (modified, +10/-0)
```diff
@@ -117,6 +117,16 @@ gh release list | head -1
 **Cause**: npm 11 skips the install scripts of packages not covered by `allowScripts`, so `npm install` does not recompile better-sqlite3 for the current Node.js and the rebuild falls back to sql.js, which has no FTS5
 **Solution**: `npm rebuild better-sqlite3`, then `npm run build && npm run rebuild && npm run validate`
 
+**Problem**: `npm run fetch:community` aborts (exit 134) with `Assertion failed: (env) != nullptr` in `RemoveEnvironmentCleanupHook`, while fetching or saving nodes
+**Cause**: better-sqlite3 11.10 crashes in a statement destructor during garbage collection under Node.js 24.21. Forcing sql.js does not help: the community fetch writes to FTS5-indexed tables, which sql.js lacks
+**Solution**: run the community fetch and the docs generators under Node.js 22, then recompile for the default Node.js. The fetch upserts, so re-running it after an abort is safe; check `sqlite3 data/nodes.db 'pragma integrity_check'` first
+```bash
+PATH=/opt/homebrew/opt/node@22/bin:$PATH npm rebuild better-sqlite3
+PATH=/opt/homebrew/opt/node@22/bin:$PATH node dist/scripts/fetch-community-nodes.js
+# generate-community-docs.js runs the same way
+npm rebuild better-sqlite3   # back to the default Node.js
+```
+
 **Problem**: `generate:docs:readme-only` exits with code 1
 **Reason**: Some packages have no README anywhere (the fetch reads the tarball when the registry metadata has none) or are no longer on npm
 **Normal**: A few failed fetches are expected; check the "With README" count instead of the exit code
```

---

### Incident Patch 5: `2fef0563` (2026-09-16)
**Commit Message**: Merge pull request #1126 from czlonkowski/test/all-fixes-0916

chore: release v2.87.0 (issues #1100–#1119)

**File**: `.github/workflows/docker-build-fast.yml` (modified, +4/-1)
```diff
@@ -22,14 +22,17 @@ jobs:
     permissions:
       contents: read
       packages: write
-      
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
+
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
         with:
           lfs: true
         
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `.github/workflows/docker-build-n8n.yml` (modified, +3/-0)
```diff
@@ -47,6 +47,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -56,6 +58,7 @@ jobs:
         uses: docker/setup-qemu-action@v4
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `.github/workflows/docker-build.yml` (modified, +6/-0)
```diff
@@ -53,6 +53,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -72,6 +74,7 @@ jobs:
           echo "✅ Synced package.runtime.json to version $VERSION"
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
@@ -161,6 +164,8 @@ jobs:
     permissions:
       contents: read
       packages: write
+    env:
+      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
 
     steps:
       - name: Checkout repository
@@ -180,6 +185,7 @@ jobs:
           echo "✅ Synced package.runtime.json to version $VERSION"
 
       - name: Log in to Docker Hub
+        if: env.DOCKERHUB_USERNAME != ''
         uses: docker/login-action@v4
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
```

**File**: `CHANGELOG.md` (modified, +28/-0)
```diff
@@ -7,6 +7,34 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.87.0] - 2026-09-16
+
+### Added
+
+- **`$jmespath()` queries inside `{{ }}` expressions are checked** ([#1114](https://github.com/czlonkowski/n8n-mcp/issues/1114)). n8n swallows JMESPath parse errors inside an expression, so the field resolves to `null` while the node reports success, and in a Filter or IF condition every item silently fails the check. `validate_workflow` now reads the query when it is a string literal and reports as errors a bare number in a comparison (`[?revenue > 100000]`; JMESPath literals are backtick-quoted), `and`/`or` in place of `&&`/`||`, a single `=` in place of `==`, and reversed arguments (`$jmespath("query", data)`). A double-quoted right-hand side (`== "PL"`, which JMESPath reads as an identifier) and a bare `true`/`false`/`null` (read as a field name) are warnings. Queries held in a variable or built with `${}` are not followed. The JavaScript Code-node checks use the same module, including for nested calls; Python `_jmespath` is no longer checked there because n8n 2.x native Python does not have it.
+
+### Changed
+
+- **Python Code-node validation models n8n 2.x native Python** ([#1113](https://github.com/czlonkowski/n8n-mcp/issues/1113)). The checks still described the Pyodide "Python (Beta)" runtime that n8n 2.0 removed. On the native task runner only `_items` (all-items mode) and `_item` (each-item mode) exist, items are plain dicts, imports are blocked unless the instance allowlists the module (none on n8n Cloud), and the sandbox denies `class` definitions, a set of builtins (`type`, `getattr`, `open`, `eval` and the rest), dunder attribute access and `global` inside a function. The validator now reports as errors the removed globals `_input`, `_json`, `_node`, `_now`, `_today`, `_jmespath` and the JavaScript habit `items` (with the native replacement), `_items` or `_item` used in the wrong mode, `.json` attribute access on an item, `class`, denied builtins, dunder access (including inside format strings), `global` inside a function, and a list returned in each-item mode; every `import` is a warning that survives the `runtime` and `minimal` profiles. A single dict returned in all-items mode, which native Python wraps into one item, is accepted, and the "return must be a list of dicts" error is gone. References are resolved per scope, so a parameter or local named like a removed global does not fire inside its function, f-string fields count as code, and every scan stays linear on adversarial input. `_jmespath` is reported as a removed global instead of getting JMESPath advice. The Python samples in the task templates and `get_node` examples are native too.
+- **Validation errors are de-duplicated by message, not by property** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103) follow-up). `validate_node` and `validate_workflow` kept one error per property, so six Python defects, or five malformed IF operators, surfaced as one, chosen by message length. Only exact repeats collapse now; `missing_required` still collapses per property and keeps the more specific wording. The two validators that reported the same defect twice under the old rule (fixedCollection pattern prefixes, MongoDB collection) report it once, and a null value for a required property no longer adds a type error to the required-property error. Over the bundled templates this changed nothing for non-Python nodes apart from removing one false enum error on a null optional value.
+
+### Fixed
+
+- **`validate_node` no longer reports "Code cannot be empty" for `language: pythonNative`** ([#1112](https://github.com/czlonkowski/n8n-mcp/issues/1112)). The base validator compared the language against `python` only and read `jsCode`; it now treats `pythonNative` the same way the node-specific checks already did.
+- **`python_code_node_guide` documents native Python** ([#1116](https://github.com/czlonkowski/n8n-mcp/issues/1116)). Both the essentials and the full guide described `_input.all()`, `_json` and stdlib imports that fail on every n8n 2.x instance. They now cover `pythonNative`, `_items`/`_item`, dict access, the import allowlist (none on Cloud, a custom runner image self-hosted), the sandbox limits, `nonlocal` instead of `global` inside functions, the accepted return shapes per mode, a Pyodide-to-native migration table, `pairedItem`, `onError: continueErrorOutput`, and the `n8nio/runners` sidecar that self-hosted Docker needs ("Python runner unavailable" otherwise).
+- **An n8n 2.39 refusal to publish on save is reported as what it is** ([#1118](https://github.com/czlonkowski/n8n-mcp/issues/1118)). Since n8n 2.39, saving a published workflow re-publishes it, and without the `workflow:activate` API key scope or the `workflow:publish` permission n8n keeps the published version, saves the change as a draft and answers 403 with a `reason` and the draft's `versionId`. That re
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.0",
+  "version": "2.87.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.0",
+      "version": "2.87.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.0",
+  "version": "2.87.0",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.0",
+  "version": "2.87.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp-tools-engine.ts` (modified, +11/-5)
```diff
@@ -63,11 +63,17 @@ export class MCPEngine {
       };
     }
 
-    // CRITICAL FIX: Extract user-provided keys before validation
-    // This prevents false warnings about default values
-    const userProvidedKeys = new Set(Object.keys(args.config || {}));
-
-    return ConfigValidator.validate(args.nodeType, args.config, node.properties || [], userProvidedKeys);
+    // Routed through the enhanced validator so the embedding API sees the same
+    // node-specific checks as validate_node and workflow validation - it also
+    // derives the user-provided keys itself, which keeps default values from
+    // raising false warnings. The result is a superset of ValidationResult.
+    return EnhancedConfigValidator.validateWithMode(
+      args.nodeType,
+      args.config || {},
+      node.properties || [],
+      args.mode ?? 'operation',
+      args.profile ?? 'ai-friendly'
+    );
   }
 
   async validateNodeMinimal(args: any) {
```

---

### Incident Patch 6: `d348f3d7` (2026-09-16)
**Commit Message**: merge fix/python-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.87.0] - 2026-09-16
+
+### Changed
+
+- **Python Code-node validation models n8n 2.x native Python** ([#1113](https://github.com/czlonkowski/n8n-mcp/issues/1113)). The checks still described the Pyodide "Python (Beta)" runtime that n8n 2.0 removed. On the native task runner only `_items` (all-items mode) and `_item` (each-item mode) exist, items are plain dicts, imports are blocked unless the instance allowlists the module (none on n8n Cloud), and the sandbox denies `class` definitions, a set of builtins (`type`, `getattr`, `open`, `eval` and the rest), dunder attribute access and `global` inside a function. The validator now reports as errors the removed globals `_input`, `_json`, `_node`, `_now`, `_today`, `_jmespath` and the JavaScript habit `items` (with the native replacement), `_items` or `_item` used in the wrong mode, `.json` attribute access on an item, `class`, denied builtins, dunder access (including inside format strings), `global` inside a function, and a list returned in each-item mode; every `import` is a warning that survives the `runtime` and `minimal` profiles. A single dict returned in all-items mode, which native Python wraps into one item, is accepted, and the "return must be a list of dicts" error is gone. References are resolved per scope, so a parameter or local named like a removed global does not fire inside its function, f-string fields count as code, and every scan stays linear on adversarial input. `_jmespath` is reported as a removed global instead of getting JMESPath advice. The Python samples in the task templates and `get_node` examples are native too.
+- **Validation errors are de-duplicated by message, not by property** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103) follow-up). `validate_node` and `validate_workflow` kept one error per property, so six Python defects, or five malformed IF operators, surfaced as one, chosen by message length. Only exact repeats collapse now; `missing_required` still collapses per property and keeps the more specific wording. The two validators that reported the same defect twice under the old rule (fixedCollection pattern prefixes, MongoDB collection) report it once, and a null value for a required property no longer adds a type error to the required-property error. Over the bundled templates this changed nothing for non-Python nodes apart from removing one false enum error on a null optional value.
+
+### Fixed
+
+- **`validate_node` no longer reports "Code cannot be empty" for `language: pythonNative`** ([#1112](https://github.com/czlonkowski/n8n-mcp/issues/1112)). The base validator compared the language against `python` only and read `jsCode`; it now treats `pythonNative` the same way the node-specific checks already did.
+- **`python_code_node_guide` documents native Python** ([#1116](https://github.com/czlonkowski/n8n-mcp/issues/1116)). Both the essentials and the full guide described `_input.all()`, `_json` and stdlib imports that fail on every n8n 2.x instance. They now cover `pythonNative`, `_items`/`_item`, dict access, the import allowlist (none on Cloud, a custom runner image self-hosted), the sandbox limits, `nonlocal` instead of `global` inside functions, the accepted return shapes per mode, a Pyodide-to-native migration table, `pairedItem`, `onError: continueErrorOutput`, and the `n8nio/runners` sidecar that self-hosted Docker needs ("Python runner unavailable" otherwise).
 ## [2.86.4] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.4",
+      "version": "2.87.0",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.4",
+  "version": "2.87.0",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp-tools-engine.ts` (modified, +11/-5)
```diff
@@ -63,11 +63,17 @@ export class MCPEngine {
       };
     }
 
-    // CRITICAL FIX: Extract user-provided keys before validation
-    // This prevents false warnings about default values
-    const userProvidedKeys = new Set(Object.keys(args.config || {}));
-
-    return ConfigValidator.validate(args.nodeType, args.config, node.properties || [], userProvidedKeys);
+    // Routed through the enhanced validator so the embedding API sees the same
+    // node-specific checks as validate_node and workflow validation - it also
+    // derives the user-provided keys itself, which keeps default values from
+    // raising false warnings. The result is a superset of ValidationResult.
+    return EnhancedConfigValidator.validateWithMode(
+      args.nodeType,
+      args.config || {},
+      node.properties || [],
+      args.mode ?? 'operation',
+      args.profile ?? 'ai-friendly'
+    );
   }
 
   async validateNodeMinimal(args: any) {
```

**File**: `src/mcp/tools-documentation.ts` (modified, +128/-231)
```diff
@@ -463,264 +463,161 @@ function getPythonCodeNodeGuide(depth: 'essentials' | 'full' = 'essentials'): st
   if (depth === 'essentials') {
     return `# Python Code Node Guide
 
-Essential patterns for Python in n8n Code nodes.
+n8n 2.x runs Python natively in a task runner: \`language: "pythonNative"\`.
+JavaScript is recommended for most cases - every n8n helper is JS-only.
 
-**Key Concepts**:
-- Access all items: \`_input.all()\` (not items[0])
-- Current item data: \`_json\`
-- Return format: \`[{"json": {...}}]\` (list of dicts)
-
-**Limitations**:
-- No external libraries (no requests, pandas, numpy)
-- Use built-in functions only
-- No pip install available
-
-**Common Patterns**:
-\`\`\`python
-# Process all items
-all_items = _input.all()
-return [{
-    "json": {
-        "processed": True,
-        "count": len(all_items),
-        "first_item": all_items[0]["json"] if all_items else None
-    }
-}]
-\`\`\`
-
-**Tips**:
-- Webhook data is under ["body"] key
-- Use json module for parsing
-- datetime for date handling
+**Two variables, one per mode**:
+- \`runOnceForAllItems\` (default): \`_items\`, a list of \`{"json": {...}}\` dicts
+- \`runOnceForEachItem\`: \`_item\`, one such dict
+- Dict access only. \`it.json.field\` raises AttributeError.
+- \`_input\`, \`_json\`, \`_node\`, \`_now\`, \`_today\`, \`_jmespath\` are gone (NameError).
 
-For full guide: tools_documentation({topic: "python_code_node_guide", depth: "full"})`;
-  }
-
-  // Full documentation
-  return `# Python Code Node Complete Guide
+**Blocked**: every \`import\` unless this instance allowlists it (Cloud: none);
+\`class\`; \`type\`/\`getattr\`/\`hasattr\`/\`setattr\`/\`vars\`/\`dir\`/\`globals\`/\`locals\`/
+\`open\`/\`input\`/\`eval\`/\`exec\`; dunders; \`global\` inside a function (use \`nonlocal\`).
 
-Comprehensive guide for using Python in n8n Code nodes.
+**Returns**: all items - list of \`{"json": ...}\`, list of plain dicts, or one
+dict. Each item - a dict; \`None\` drops the item; a list errors.
 
-## Data Access Patterns
-
-### Accessing Input Data
 \`\`\`python
-# Get all items from previous node
-all_items = _input.all()
-
-# Get specific node's output (use _node)
-webhook_data = _node["Webhook"]["json"]
-
-# Current item in loop
-current_item = _json
-
-# First item only
-first_item = _input.first()["json"]
-\`\`\`
-
-### Webhook Data Structure
-**CRITICAL**: Webhook data is nested under ["body"]:
-\`\`\`python
-# WRONG - Won't work
-data = _json["name"]
-
-# CORRECT - Webhook data is under body
-data = _json["body"]["name"]
+# runOnceForAllItems
+return [{"json": {"name": it["json"]["name"]}} for it in _items if it["json"].get("active")]
 \`\`\`
 
-## Available Built-in Modules
-
-### Standard Library Only
 \`\`\`python
-import json
-import datetime
-import base64
-import hashlib
-import urllib.parse
-import re
-import math
-import random
+# runOnceForEachItem
+row = _item["json"]
+return {"json": {**row, "upper": (row.get("name") or "").upper()}}
 \`\`\`
 
-### Date/Time Handling
-\`\`\`python
-from datetime import datetime, timedelta
-
-# Current time
-now = datetime.now()
-iso_format = now.isoformat()
+**Tips**: webhook payloads are under ["body"]; use \`.get(key, default)\`;
+self-hosted Docker needs the \`n8nio/runners\` sidecar or every Python node
+fails with "Python runner unavailable".
 
-# Date arithmetic
-future = now + timedelta(days=5)
-formatted = now.strftime("%Y-%m-%d")
-\`\`\`
-
-### JSON Operations
-\`\`\`python
-# Parse JSON string
-data = json.loads(json_string)
-
-# Convert to JSON
-json_output = json.dumps({"key": "value"})
-\`\`\`
-
-## Return Format Requirements
-
-### Correct Format
-\`\`\`python
-# MUST return list of dictionaries with "json" key
-return [{
-    "json": {
-        "result": "success",
-        "data": processed_data
-    }
-}]
-
-# Multiple items
-return [
-    {"json": {"id": item["json"]["id"], "processed": True}}
-    for item in all_items
-]
-\`\`\`
-
-### Binary Data
-\`\`\`python
-# Return with binary data
-import base64
-
-return [{
-    "json": {"filename": "report.pdf"},
-    "binary": {
-        "data": base64.b64encode(pdf_content).decode()
-    }
-}]
-\`\`\`
-
-## Common Patterns
-
-### Processing Webhook Data
-\`\`\`python
-# Extract webhook payload
-webhook_body = _json["body"]
-username = webhook_body.get("username")
-email = webhook_body.get("email")
-items = webhook_body.get("items", [])
-
-# Process and return
-return [{
-    "json": {
-        "username": username,
-        "email": email,
-        "item_count": len(items),
-        "processed_at": datetime.now().isoformat()
-    }
-}]
-\`\`\`
+For full guide: tools_documentation({topic: "python_code_node_guide", depth: "full"})`;
+  }
 
-### Aggregating Data
-\`\`\`python
-# Sum values across all items
-all_items = _input.all()
-total = sum(item["json"].get("amount", 0) for item in all_items)
+  // Full documentation
+  return `# Python Code Node Complete Guide
 
-return [{
-    "json": {
-       
```

**File**: `src/services/config-validator.ts` (modified, +29/-72)
```diff
@@ -292,6 +292,11 @@ export class ConfigValidator {
       const candidates = properties.filter(p => p && p.name === key);
       if (candidates.length === 0) continue;
 
+      // A null/undefined value is the required check's business. Reporting it
+      // here as well ("must be a string, got object") describes the same defect
+      // a second time.
+      if (value === null || value === undefined) continue;
+
       // Several definitions can share a name (one per resource/operation);
       // validate against the one visible for the current config rather than
       // whichever happens to come first in the schema array.
@@ -600,9 +605,13 @@ export class ConfigValidator {
     errors: ValidationError[],
     warnings: ValidationWarning[]
   ): void {
-    const codeField = config.language === 'python' ? 'pythonCode' : 'jsCode';
+    // n8n 2.x names the Python option 'pythonNative'; the legacy 'python' value
+    // still executes. Both store their code in pythonCode.
+    const rawLanguage = config.language || 'javascript';
+    const language = rawLanguage === 'pythonNative' ? 'python' : rawLanguage;
+    const codeField = language === 'python' ? 'pythonCode' : 'jsCode';
     const code = config[codeField];
-    
+
     if (!code || code.trim() === '') {
       errors.push({
         type: 'missing_required',
@@ -612,25 +621,27 @@ export class ConfigValidator {
       });
       return;
     }
-    
-    // Security checks
-    if (code?.includes('eval(') || code?.includes('exec(')) {
+
+    // Security checks. Python eval/exec are denied builtins in the native
+    // runtime and are reported as errors by NodeSpecificValidators, so this
+    // softer warning stays JavaScript-only to avoid a duplicate message.
+    if (language !== 'python' && (code?.includes('eval(') || code?.includes('exec('))) {
       warnings.push({
         type: 'security',
         message: 'Code contains eval/exec which can be a security risk',
         suggestion: 'Avoid using eval/exec with untrusted input'
       });
     }
-    
+
     // Basic syntax validation
-    if (config.language === 'python') {
+    if (language === 'python') {
       this.validatePythonSyntax(code, errors, warnings);
     } else {
       this.validateJavaScriptSyntax(code, errors, warnings);
     }
-    
+
     // n8n-specific patterns
-    this.validateN8nCodePatterns(code, config.language || 'javascript', errors, warnings);
+    this.validateN8nCodePatterns(code, language, errors, warnings);
   }
   
   /**
@@ -933,51 +944,11 @@ export class ConfigValidator {
       }
     }
     
-    // Check return format for Python
-    if (language === 'python' && hasReturn) {
-      // Check for common incorrect patterns
-      if (/return\s+items\s*$/.test(code) && !code.includes('json') && !code.includes('dict')) {
-        warnings.push({
-          type: 'best_practice',
-          message: 'Returning items directly - ensure each item is a dict with "json" key',
-          suggestion: 'Use: return [{"json": item.json} for item in items]'
-        });
-      }
-      
-      // Check for dict return without list
-      if (/return\s+{['"]/.test(code) && !code.includes('[') && !code.includes(']')) {
-        warnings.push({
-          type: 'invalid_value',
-          message: 'Return value must be a list',
-          suggestion: 'Wrap your return dict in a list: return [{"json": {"your": "data"}}]'
-        });
-      }
-      
-      // Check for returning objects without json key
-      if (/return\s+(?!.*\[).*{(?!.*["']json["'])/.test(code)) {
-        warnings.push({
-          type: 'invalid_value',
-          message: 'Must return array of objects with json key',
-          suggestion: 'Use format: return [{"json": {"data": "value"}}]'
-        });
-      }
-      
-      // Check for returning variable that might contain invalid format
-      const returnMatch = code.match(/return\s+(\w+)\s*(?:#|$)/m);
-      if (returnMatch) {
-        const varName = returnMatch[1];
-        // Check if this variable is assigned a dict without being in a list
-        const assignmentRegex = new RegExp(`${varName}\\s*=\\s*{[^}]+}`, 'm');
-        if (assignmentRegex.test(code) && !new RegExp(`${varName}\\s*=\\s*\\[`).test(code)) {
-          warnings.push({
-            type: 'invalid_value',
-            message: 'Must return array of objects with json key',
-            suggestion: `Wrap ${varName} in a list with json key: return [{"json": ${varName}}]`
-          });
-        }
-      }
-    }
-    
+    // Python return shapes are validated by NodeSpecificValidators, which knows
+    // the node's mode. Native Python auto-wraps a single dict and a list of plain
+    // dicts, so the old "must be a list of dicts with a json key" warnings here
+    // reported valid code.
+
     // Check for common n8n variables and patterns
     if (language === 'javascript') {
       // Check if accessing items/input
@@ -1057,15 +1028,10 @@ export class ConfigValidat
```

**File**: `src/services/enhanced-config-validator.ts` (modified, +30/-11)
```diff
@@ -523,7 +523,8 @@ export class EnhancedConfigValidator extends ConfigValidator {
     const valueErrors = result.errors.filter(e => e.type === 'invalid_value');
     
     if (requiredErrors.length > 0) {
-      steps.push(`Add required fields: ${requiredErrors.map(e => e.property).join(', ')}`);
+      const properties = [...new Set(requiredErrors.map(e => e.property))];
+      steps.push(`Add required fields: ${properties.join(', ')}`);
     }
     
     if (typeErrors.length > 0) {
@@ -554,19 +555,28 @@ export class EnhancedConfigValidator extends ConfigValidator {
     const seen = new Map<string, ValidationError>();
     
     for (const error of errors) {
-      const key = `${error.property}-${error.type}`;
+      // Includes the message: two distinct findings on the same property (e.g.
+      // several native-Python rules on pythonCode) are different defects and the
+      // user needs to see all of them. Only exact repeats collapse.
+      //
+      // Except for missing_required: "the property is missing" is one defect
+      // however many validators phrase it, so those still collapse per property.
+      const key = error.type === 'missing_required'
+        ? `${error.property}-${error.type}`
+        : `${error.property}-${error.type}-${error.message}`;
       const existing = seen.get(key);
-      
+
       if (!existing) {
         seen.set(key, error);
-      } else {
-        // Keep the error with more specific message or fix
+        continue;
+      }
+
+      // Only missing_required can collapse two differently worded errors, so
+      // only there is there a choice to make: keep the most specific wording.
+      if (error.type === 'missing_required') {
         const existingLength = (existing.message?.length || 0) + (existing.fix?.length || 0);
         const newLength = (error.message?.length || 0) + (error.fix?.length || 0);
-        
-        if (newLength > existingLength) {
-          seen.set(key, error);
-        }
+        if (newLength > existingLength) seen.set(key, error);
       }
     }
     
@@ -750,16 +760,25 @@ export class EnhancedConfigValidator extends ConfigValidator {
     const validationResult = FixedCollectionValidator.validate(nodeType, config);
     
     if (!validationResult.isValid) {
+      // Nested patterns describe one defect at different depths: a config with
+      // `rules.conditions.values` matches both "rules.conditions" and
+      // "rules.conditions.values". Report only the most specific match so the
+      // user sees the defect once, with the more informative message.
+      const patterns = validationResult.errors.map(e => e.pattern);
+      const specificErrors = validationResult.errors.filter(error =>
+        !patterns.some(other => other !== error.pattern && other.startsWith(`${error.pattern}.`))
+      );
+
       // Add errors to the result
-      for (const error of validationResult.errors) {
+      for (const error of specificErrors) {
         result.errors.push({
           type: 'invalid_value',
           property: error.pattern.split('.')[0], // Get the root property
           message: error.message,
           fix: error.fix
         });
       }
-      
+
       // Apply autofix if available
       if (validationResult.autofix) {
         // For nodes like If/Filter where the entire config might be replaced,
```

---

### Incident Patch 7: `21b3ee4f` (2026-09-16)
**Commit Message**: merge fix/api-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -7,6 +7,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.4] - 2026-09-16
+
+### Fixed
+
+- **An n8n 2.39 refusal to publish on save is reported as what it is** ([#1118](https://github.com/czlonkowski/n8n-mcp/issues/1118)). Since n8n 2.39, saving a published workflow re-publishes it, and without the `workflow:activate` API key scope or the `workflow:publish` permission n8n keeps the published version, saves the change as a draft and answers 403 with a `reason` and the draft's `versionId`. That response now maps to its own error code, `PUBLISH_FORBIDDEN`, wherever a workflow is written. `n8n_update_full_workflow` says the published version is unchanged, the change was saved as draft `draftVersionId`, and retrying with the same credentials will not publish it. `n8n_update_partial_workflow` keeps rolling back, decides whether anything persisted by content rather than by `versionId` (a name or settings change does not bump it), and reports one of: rolled back, with `supersededDraftVersionId` and `restoredDraftVersionId`; the change retained as an unpublished draft (`draftVersionId`); an incomplete restore (`observedDraftVersionId`); or a rollback that could not be confirmed (`attemptedDraftVersionId`), each pointing to `n8n_workflow_versions`. It no longer appends "workflow restored to prior state" to n8n's "saved as a draft" sentence. `n8n_autofix_workflow` passes the code through, `n8n_workflow_versions` restore says the draft holds the restored snapshot, and `n8n_test_workflow` reads the workflow back after the exposure write: when `availableInMCP` persisted on the draft the test proceeds with a warning, otherwise it fails and says whether the state was confirmed. Failure telemetry records the content that actually persisted. This has not been run against a key with narrowed scopes.
+
+### Removed
+
+- **Source-control client methods** ([#1119](https://github.com/czlonkowski/n8n-mcp/issues/1119)). `getSourceControlStatus`, `pullSourceControl` and `pushSourceControl` in `N8nApiClient`, and their types, no longer matched the n8n 2.39 Public API (`direction` query parameter, `commitMessage` and typed `fileNames`) and no tool used them; they are deleted rather than aligned. The never-set `CredentialListParams.filter` is gone too. The 2.86.0 entry's description of the partial-update behaviour on this 403, and of these endpoints as merely unused, is superseded by this entry.
 ## [2.86.3] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.3",
+      "version": "2.86.4",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.3",
+  "version": "2.86.4",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/handlers-n8n-manager.ts` (modified, +46/-3)
```diff
@@ -1107,6 +1107,10 @@ export async function handleUpdateWorkflow(
   // persisted the folder move (write-only in n8n, so it can be neither read back nor
   // rolled back), and the error path below must say so.
   let sentParentFolderId = false;
+  // The merged payload sent to the failed PUT. On PUBLISH_FORBIDDEN, n8n saves this as a
+  // draft — the failure telemetry should reflect that content, not silently claim
+  // "no change" by reusing workflowBefore.
+  let attemptedWorkflow: any = null;
 
   try {
     const client = ensureApiConfigured(context);
@@ -1181,6 +1185,7 @@ export async function handleUpdateWorkflow(
     if (nodeGroupsUpdate !== undefined) {
       fullWorkflow.nodeGroups = nodeGroupsUpdate;
     }
+    attemptedWorkflow = fullWorkflow;
 
     // Backup + structure validation when the graph or its grouping changed.
     if (updateData.nodes || updateData.connections || nodeGroupsUpdate !== undefined) {
@@ -1257,13 +1262,20 @@ export async function handleUpdateWorkflow(
   } catch (error) {
     // Track failed mutation
     if (workflowBefore) {
+      // PUBLISH_FORBIDDEN means n8n persisted the attempted payload as a draft even
+      // though the PUT threw — workflowBefore would misreport "no change". Use the
+      // attempted payload when we have one; otherwise omit workflowAfter rather than
+      // claim an unchanged state we cannot confirm.
+      const isPublishForbidden = error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN';
       void trackWorkflowMutationForFullUpdate({
         sessionId,
         toolName: 'n8n_update_full_workflow',
         userIntent,
         operations: [],
         workflowBefore,
-        workflowAfter: workflowBefore, // No change since it failed
+        ...(isPublishForbidden
+          ? (attemptedWorkflow ? { workflowAfter: attemptedWorkflow } : {})
+          : { workflowAfter: workflowBefore }), // No change since it failed
         mutationSuccess: false,
         mutationError: error instanceof Error ? error.message : 'Unknown error',
         durationMs: Date.now() - startTime,
@@ -1280,6 +1292,24 @@ export async function handleUpdateWorkflow(
       };
     }
 
+    if (error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN') {
+      const body = error.details as { reason?: string; versionId?: string } | undefined;
+      return {
+        success: false,
+        error: 'n8n did not publish this change. The published version is unchanged; ' +
+          `the change was saved as a draft${body?.versionId ? ` (id: ${body.versionId})` : ''}. ` +
+          'Retrying with the same credentials will save another draft without publishing it. ' +
+          'The API key needs the workflow:activate scope, and the user needs workflow:publish permission on this workflow.',
+        code: error.code,
+        details: {
+          reason: body?.reason,
+          draftVersionId: body?.versionId,
+          publishedVersionUnchanged: true,
+          ...(sentParentFolderId ? { folderMoveMayHavePersisted: true } : {})
+        }
+      };
+    }
+
     if (error instanceof N8nApiError) {
       const baseDetails = error.details as Record<string, unknown> | undefined;
       return {
@@ -1633,9 +1663,17 @@ export async function handleAutofixWorkflow(
         return {
           success: false,
           error: 'Failed to apply fixes',
+          // Pass the partial-update failure's code through (e.g. PUBLISH_FORBIDDEN) so
+          // callers can tell a publish refusal apart from a generic update failure
+          // instead of having to parse updateError.
+          ...(updateResult.code ? { code: updateResult.code } : {}),
           details: {
             fixes: fixResult.fixes,
-            updateError: updateResult.error
+            updateError: updateResult.error,
+            // The partial-update failure's own details (e.g. PUBLISH_FORBIDDEN's
+            // draftVersionId/rollbackPerformed) — dropped before, leaving callers
+            // nothing to act on beyond the flattened error text.
+            ...(updateResult.details ? { updateDetails: updateResult.details } : {})
           }
         };
       }
@@ -3389,8 +3427,13 @@ async function handleLocalWorkflowVersions(
         success: result.success,
         data: result.success ? result : undefined,
         error: result.success ? undefined : result.message,
+        // Pass the machine-readable code through (e.g. PUBLISH_FORBIDDEN) so callers
+        // can branch on it instead of parsing `message`, and name the draft the
+        // restored content actually landed on when it wasn't published.
+        code: result.success ? undefined : result.code,
         details: result.success ? undefined : {
-          validationErrors: result.validationErrors
+          validationErrors: result.validationErrors,
+          ...(result.draftVersionId ? { draftVersionId: result.draftVersionId } : {})
         }
       };
     }
```

**File**: `src/mcp/handlers-workflow-diff.ts` (modified, +211/-13)
```diff
@@ -177,6 +177,11 @@ export async function handleUpdatePartialWorkflow(
   let workflowBefore: any = null;
   let validationBefore: any = null;
   let validationAfter: any = null;
+  // Set only for the "restore incomplete" (partialRestoration) rollback outcome, deep
+  // inside the update-workflow catch below — hoisted here so the telemetry catch at the
+  // bottom of this function (a sibling of that nested scope, not a descendant of it) can
+  // read it too.
+  let partialRestorationObservedWorkflow: unknown;
 
   try {
     // Debug logging (only in debug mode)
@@ -434,12 +439,55 @@ export async function handleUpdatePartialWorkflow(
             ? compareVersions(serverState, workflowBefore)
             : 'unknown';
 
-          if (versionState === 'same') {
+          const isPublishForbidden = updateError instanceof N8nApiError && updateError.code === 'PUBLISH_FORBIDDEN';
+          // n8n 2.39 does not bump versionId for name/settings-only changes, so a
+          // PUBLISH_FORBIDDEN 403 reporting the same versionId does not guarantee
+          // nothing persisted. For this error, decide with content instead of version:
+          // only treat it as "nothing persisted" when the content also matches. A
+          // content mismatch here means the change persisted despite the unchanged
+          // versionId, so it falls through to the rollback attempt below like any
+          // other persist-then-fail case.
+          const nothingPersisted = versionState === 'same'
+            && (!isPublishForbidden || sameWritableContent(serverState, workflowBefore));
+
+          if (nothingPersisted) {
             // Pre-save rejection: nothing to roll back.
             logger.debug('PUT failed before persisting; skipping rollback', {
               workflowId: input.id,
             });
             if (updateError instanceof N8nApiError) {
+              if (updateError.code === 'PUBLISH_FORBIDDEN') {
+                // n8n reports a persisted draft, but the version we can observe is
+                // unchanged and the content matches what was there before — the two
+                // signals disagree, so state that plainly instead of resolving it
+                // either way (e.g. by claiming there was nothing to roll back).
+                const body = updateError.details as { reason?: string; versionId?: string } | undefined;
+                // sameWritableContent (above, in `nothingPersisted`) cannot see a folder
+                // move: workflowBefore comes from a GET, and n8n never returns
+                // parentFolderId (write-only). A folder move in this payload could have
+                // persisted despite the content otherwise matching, so don't let the
+                // "could not be confirmed" framing quietly cover that gap too.
+                const folderMoveInPayload = (diffResult.workflow as any)?.parentFolderId !== undefined;
+                const message = [
+                  `n8n reports it saved draft ${body?.versionId}, but the workflow's version is unchanged, so what persisted could not be confirmed.`,
+                  'The published version is unchanged.',
+                  folderMoveInPayload
+                    ? 'A folder move in this update may have persisted regardless — n8n cannot report or restore folder placement.'
+                    : '',
+                  'Retrying with the same credentials will not publish it — the API key needs the workflow:activate scope, and the user needs workflow:publish permission on this workflow.',
+                ].filter(Boolean).join(' ');
+                throw new N8nApiError(
+                  message,
+                  updateError.statusCode,
+                  updateError.code,
+                  {
+                    reason: body?.reason,
+                    draftVersionId: body?.versionId,
+                    rollbackPerformed: false,
+                    ...(folderMoveInPayload ? { folderMoveMayHavePersisted: true } : {}),
+                  },
+                );
+              }
               throw new N8nApiError(
                 updateError.message,
                 updateError.statusCode,
@@ -457,13 +505,30 @@ export async function handleUpdatePartialWorkflow(
           let rollbackPerformed = false;
           let rollbackVerifiedAfterError = false;
           let rollbackErrorMessage: string | undefined;
+          // The versionId n8n reports on the verification GET taken after a
+          // rollback PUT errors (used only for the PUBLISH_FORBIDDEN path,
+          // where the rollback PUT itself is expected to 403 too).
+          let restoredDraftVersionId: string | undefined;
+          // True only when the rollback PUT failed AND the follow-up verification GET
+          // also failed — the draft's actual content (attempted change vs. restored) is
+          // genuinely unknown, as opposed to the verification GET succeeding and
+          // confirming the change is still the
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-autofix-workflow.ts` (modified, +2/-1)
```diff
@@ -148,7 +148,8 @@ Requires N8N_API_URL and N8N_API_KEY environment variables to be configured.`,
       'NEW: Auto-migrated properties use sensible defaults which may not match your use case',
       'NEW: Execute Workflow v1.1+ requires explicit inputFieldMapping - automatic mapping uses empty array',
       'NEW: Some breaking changes cannot be auto-migrated and require manual intervention',
-      'NEW: Version history is based on registry - unknown nodes cannot be upgraded'
+      'NEW: Version history is based on registry - unknown nodes cannot be upgraded',
+      '**code: "PUBLISH_FORBIDDEN"** (n8n 2.39+): applying fixes uses n8n_update_partial_workflow internally, so a caller who may edit but not publish gets this code back here too - check code, not just the error text'
     ],
     relatedTools: [
       'n8n_validate_workflow',
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-update-full-workflow.ts` (modified, +2/-1)
```diff
@@ -53,7 +53,8 @@ export const n8nUpdateFullWorkflowDoc: ToolDocumentation = {
       'Must include ALL nodes/connections',
       'Missing nodes will be deleted',
       'Can break active workflows',
-      'No partial updates - use update_partial instead'
+      'No partial updates - use update_partial instead',
+      '**code: "PUBLISH_FORBIDDEN"** (n8n 2.39+): the API key or user may edit a published workflow but not publish it. n8n saves the change as a draft and returns 403 with the published version left unchanged (this tool does not roll back a full update). Retrying with the same credentials saves another draft without publishing - the API key needs the workflow:activate scope and the user needs workflow:publish permission on the workflow'
     ],
     relatedTools: ['n8n_get_workflow', 'n8n_update_partial_workflow', 'validate_workflow', 'n8n_create_workflow']
   }
```

---

### Incident Patch 8: `8601e18a` (2026-09-16)
**Commit Message**: merge fix/structure-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -7,6 +7,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.3] - 2026-09-16
+
+### Fixed
+
+- **Switch branch-count validation reads the rules n8n reads** ([#1100](https://github.com/czlonkowski/n8n-mcp/issues/1100)). The check on the write path (`n8n_create_workflow`, `n8n_update_full_workflow`, `n8n_update_partial_workflow`) read only the legacy `rules.rules`, so it never ran on a current Switch, and pointing it at `rules.values` as written would have flagged 51 bundled templates. It now reads `rules.values` (typeVersion 3.2 and later) as well as the legacy key, counts one extra output for `options.fallbackOutput: "extra"` and one for `onError: "continueErrorOutput"`, reports only more branches than the node has outputs (n8n omits trailing branches that route nowhere), skips Switch v1 (four fixed outputs), and no longer reports an unconnected rule output, which 13 published templates use on purpose. `validate_workflow` computes the same output count for its error-output warnings, so a Switch, whose bundled metadata carries its outputs as an expression, gets those warnings at all, a 2-rule Switch is told its error output is main[2] rather than main[3], and a Filter, which has one output, no longer gets the "no connections on the unmatched branch" warning (16 templates).
+- **A connection key with no targets no longer counts as a connection** ([#1101](https://github.com/czlonkowski/n8n-mcp/issues/1101)). n8n keeps `"A": {"main": [[]]}` or `[null]` after a node's last edge is removed, and both the write-path disconnected-node check and the `validate_workflow` orphan warning treated the key as proof of an outgoing connection, so two isolated nodes passed. A source counts once it names a target; triggers follow the same rule (an mcpTrigger reached only by an inbound `ai_tool` connection still counts). Over the bundled templates this reports 22 more workflows with a disconnected node, all real (unwired alternative model nodes, leftover triggers). The suggested fix never proposes a self-loop.
+- **`validate_node` checks IF, Switch and Filter operator structure** ([#1103](https://github.com/czlonkowski/n8n-mcp/issues/1103)). The operator checks ran on the workflow paths only, so `validate_node` passed `{type: "string"}` without an operation, an operation name in the type field, a string or `null` operator, while `n8n_create_workflow` refused the same config. `EnhancedConfigValidator` now runs `validateConditionNodeStructure` with the `@version` the handler merges into the config (IF and Filter from version 2, Switch from 3.2 in rules mode); a malformed `@version` value is treated as version 1 rather than throwing. Because the enhanced validator keeps one error per property, `validate_workflow` also keeps its direct call and skips only the message already reported, so every operator is still listed once.
+- **A fan-out to a node named like an error handler is no longer a hard error** ([#1111](https://github.com/czlonkowski/n8n-mcp/issues/1111)). `validate_workflow` reported `valid: false` whenever `main[0]` fanned out and one target was named error/fail/catch/exception or was a Respond to Webhook or Email Send node, and prescribed moving it to the error output, which for the common Respond to Webhook beside a side-effect node makes the webhook answer only on failure. The name is now only a hint appended to the existing warning for a node whose `onError: "continueErrorOutput"` error output has nothing connected; node type is not a signal. This removed 46 false errors across the bundled templates and added one hint.
 ## [2.86.2] - 2026-09-16
 
 ### Added
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.2",
+      "version": "2.86.3",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.2",
+  "version": "2.86.3",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/server.ts` (modified, +20/-6)
```diff
@@ -3940,6 +3940,18 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     return result;
   }
   
+  /**
+   * The typeVersion the validators see for a single-node config: the caller's `@version` when
+   * it is a finite number (or numeric string), else the node's version from the database.
+   */
+  private resolveConfigVersion(requested: unknown, nodeVersion: unknown): number {
+    const numeric = typeof requested === 'number' ? requested
+      : typeof requested === 'string' && requested.trim() !== '' ? Number(requested) : NaN;
+    if (Number.isFinite(numeric)) return numeric;
+    const fallback = Number(nodeVersion);
+    return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
+  }
+
   private async validateNodeConfig(
     nodeType: string, 
     config: Record<string, any>, 
@@ -3979,10 +3991,11 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     // Get properties
     const properties = node.properties || [];
 
-    // Add @version to config for displayOptions evaluation (supports _cnd operators)
+    // Add @version to config for displayOptions evaluation (supports _cnd operators). A
+    // caller may pin a version, but only a real one; anything else keeps the node's version.
     const configWithVersion = {
-      '@version': node.version || 1,
-      ...config
+      ...config,
+      '@version': this.resolveConfigVersion(config['@version'], node.version)
     };
 
     // Use enhanced validator with operation mode by default
@@ -4237,10 +4250,11 @@ Full documentation is being prepared. For now, use get_node_essentials for confi
     // Get properties
     const properties = node.properties || [];
 
-    // Add @version to config for displayOptions evaluation (supports _cnd operators)
+    // Add @version to config for displayOptions evaluation (supports _cnd operators). A
+    // caller may pin a version, but only a real one; anything else keeps the node's version.
     const configWithVersion = {
-      '@version': node.version || 1,
-      ...(config || {})
+      ...(config || {}),
+      '@version': this.resolveConfigVersion(config?.['@version'], node.version)
     };
 
     // Find missing required fields
```

**File**: `src/services/enhanced-config-validator.ts` (modified, +58/-6)
```diff
@@ -15,6 +15,7 @@ import { DatabaseAdapter } from '../database/database-adapter';
 import { NodeTypeNormalizer } from '../utils/node-type-normalizer';
 import { TypeStructureService } from './type-structure-service';
 import type { NodePropertyTypes } from 'n8n-workflow';
+import { validateConditionNodeStructure } from './n8n-validation';
 
 export type ValidationMode = 'full' | 'operation' | 'minimal';
 export type ValidationProfile = 'strict' | 'runtime' | 'ai-friendly' | 'minimal';
@@ -76,7 +77,18 @@ export class EnhancedConfigValidator extends ConfigValidator {
     if (!Array.isArray(properties)) {
       throw new Error(`Invalid properties: expected array, got ${typeof properties}`);
     }
-    
+
+    // `@version` is caller-supplied and reaches displayOptions comparisons (`>=`) before any
+    // other check; an object there throws "Cannot convert object to primitive value"
+    // (#1094). Only a number or numeric string is a version; anything else means version 1.
+    const rawVersion = config['@version'];
+    if (rawVersion !== undefined) {
+      const numeric = typeof rawVersion === 'number' ? rawVersion
+        : typeof rawVersion === 'string' && rawVersion.trim() !== '' ? Number(rawVersion) : NaN;
+      // Stored as a number so every version gate below compares numerically.
+      config = { ...config, '@version': Number.isFinite(numeric) ? numeric : 1 };
+    }
+
     // Extract operation context from config
     const operationContext = this.extractOperationContext(config);
 
@@ -788,7 +800,9 @@ export class EnhancedConfigValidator extends ConfigValidator {
     );
     
     if (hasFixedCollectionError) return;
-    
+
+    this.validateConditionOperators('n8n-nodes-base.switch', config, result);
+
     // Validate rules.values structure if present
     if (config.rules.values && Array.isArray(config.rules.values)) {
       config.rules.values.forEach((rule: any, index: number) => {
@@ -833,8 +847,8 @@ export class EnhancedConfigValidator extends ConfigValidator {
     );
     
     if (hasFixedCollectionError) return;
-    
-    // Add any If-node-specific validation here in the future
+
+    this.validateConditionOperators('n8n-nodes-base.if', config, result);
   }
   
   /**
@@ -852,8 +866,46 @@ export class EnhancedConfigValidator extends ConfigValidator {
     );
     
     if (hasFixedCollectionError) return;
-    
-    // Add any Filter-node-specific validation here in the future
+
+    this.validateConditionOperators('n8n-nodes-base.filter', config, result);
+  }
+
+  /**
+   * Run the operator-structure checks the workflow paths run (validateWorkflowStructure for
+   * the write tools, WorkflowValidator for validate_workflow) on a single node config, so
+   * validate_node stops passing operators those paths reject (#1103). The config carries
+   * `@version` from the validate_node handler; without it the version gates in
+   * validateConditionNodeStructure see version 1 and skip the checks.
+   */
+  private static validateConditionOperators(
+    nodeType: string,
+    config: Record<string, any>,
+    result: EnhancedValidationResult
+  ): void {
+    const rawVersion = config['@version'];
+    // Caller-supplied: an object can throw on coercion (#1094), so only a number or string counts.
+    const typeVersion = typeof rawVersion === 'number' || typeof rawVersion === 'string' ? Number(rawVersion) : NaN;
+    const messages = validateConditionNodeStructure({
+      id: 'node',
+      name: 'node',
+      type: nodeType,
+      typeVersion: Number.isFinite(typeVersion) ? typeVersion : 1,
+      parameters: config,
+      position: [0, 0]
+    });
+
+    for (const message of messages) {
+      const property = message.split(/[.[:]/, 1)[0];
+      if (result.errors.some(e => e.message === message)) continue;
+      result.errors.push({
+        type: 'invalid_value',
+        property,
+        message,
+        ...(message.includes('operator')
+          ? { fix: 'Each condition needs an operator object with "type" (string, number, boolean, dateTime, array, object, any) and "operation" (for example equals, contains, exists).' }
+          : {})
+      });
+    }
   }
 
   /**
```

**File**: `src/services/n8n-validation.ts` (modified, +56/-50)
```diff
@@ -1,7 +1,7 @@
 import crypto from 'crypto';
 import { z } from 'zod';
 import { WorkflowNode, WorkflowConnection, Workflow } from '../types/n8n-api';
-import { isTriggerNode, isActivatableTrigger } from '../utils/node-type-utils';
+import { isActivatableTrigger } from '../utils/node-type-utils';
 import { DERIVED_SETTINGS_PROPERTIES } from '../constants/workflow-settings';
 import { isNonExecutableNode } from '../utils/node-classification';
 import {
@@ -399,7 +399,10 @@ export function validateWorkflowStructure(workflow: Partial<Workflow>): string[]
       // so that every AI connection type (ai_outputParser, ai_document, ai_textSplitter,
       // ai_agent, ai_chain, ai_retriever, etc.) is covered automatically.
       Object.entries(workflow.connections).forEach(([sourceName, connection]) => {
-        connectedNodes.add(sourceName); // Node has outgoing connection
+        // A source key counts as an outgoing connection only once it names a target. n8n keeps
+        // the key with empty branches (`main: [[]]`, `main: [null]`) after the last edge is
+        // removed, and an empty key vouching for its own node let two isolated nodes pass (#1101).
+        let hasTarget = false;
 
         // Check every connection type key present on this source node
         const connectionRecord = connection as Record<string, unknown>;
@@ -410,12 +413,15 @@ export function validateWorkflowStructure(workflow: Partial<Workflow>): string[]
                 outputs.forEach((target: { node: string }) => {
                   if (target?.node) {
                     connectedNodes.add(target.node); // Node has incoming connection
+                    hasTarget = true;
                   }
                 });
               }
             });
           }
         });
+
+        if (hasTarget) connectedNodes.add(sourceName); // Node has outgoing connection
       });
 
       // Find disconnected nodes (excluding non-executable nodes and triggers)
@@ -427,27 +433,23 @@ export function validateWorkflowStructure(workflow: Partial<Workflow>): string[]
           return false;
         }
 
-        const isConnected = connectedNodes.has(node.name);
-        const isNodeTrigger = isTriggerNode(node.type);
-
-        // Trigger nodes need outgoing connections OR inbound connections (for mcpTrigger)
-        // mcpTrigger is special: it has "trigger" in its name but only receives inbound ai_tool connections
-        if (isNodeTrigger) {
-          const hasOutgoingConnections = !!workflow.connections?.[node.name];
-          const hasInboundConnections = isConnected;
-          return !hasOutgoingConnections && !hasInboundConnections; // Disconnected if NEITHER
-        }
-
-        // Regular nodes need at least one connection (incoming or outgoing)
-        return !isConnected;
+        // Every node, trigger or not, needs one edge in either direction. mcpTrigger only
+        // receives inbound ai_tool connections, and those count like any other target.
+        return !connectedNodes.has(node.name);
       });
 
       if (disconnectedNodes.length > 0) {
         const disconnectedList = disconnectedNodes.map(n => `"${n.name}" (${n.type})`).join(', ');
         const firstDisconnected = disconnectedNodes[0];
-        const suggestedSource = workflow.nodes.find(n => connectedNodes.has(n.name))?.name || workflow.nodes[0].name;
-
-        errors.push(`Disconnected nodes detected: ${disconnectedList}. Each node must have at least one connection. Add a connection: {type: 'addConnection', source: '${suggestedSource}', target: '${firstDisconnected.name}', sourcePort: 'main', targetPort: 'main'}`);
+        // Suggest a connected executable node as the source; a sticky note is never one, and
+        // with no other executable node there is nothing to suggest.
+        const suggestedSource = workflow.nodes.find(n => connectedNodes.has(n.name) && !isNonExecutableNode(n.type))?.name
+          || workflow.nodes.find(n => n.name !== firstDisconnected.name && !isNonExecutableNode(n.type))?.name;
+        const hint = suggestedSource
+          ? ` Add a connection: {type: 'addConnection', source: '${suggestedSource}', target: '${firstDisconnected.name}', sourcePort: 'main', targetPort: 'main'}`
+          : '';
+
+        errors.push(`Disconnected nodes detected: ${disconnectedList}. Each node must have at least one connection.${hint}`);
       }
     }
   }
@@ -490,53 +492,56 @@ export function validateWorkflowStructure(workflow: Partial<Workflow>): string[]
 
   // Validate Switch and IF node connection structures match their rules
   if (workflow.nodes && workflow.connections) {
-    const switchNodes = workflow.nodes.filter(isRulesModeSwitch);
+    // Switch v1 has four fixed outputs whatever its rules say; from v2 on the outputs follow
+    // the rules, so only those versions can be checked against them.
+    const switchNodes = workflow.nodes.filter(node => isRulesModeSwitch(node) && (node.typeVersion || 1) >= 2);
 
     c
```

**File**: `src/services/workflow-validator.ts` (modified, +88/-74)
```diff
@@ -552,7 +552,15 @@ export class WorkflowValidator {
     // Check for empty connections in multi-node workflows
     if (workflow.nodes.length > 1) {
       const hasEnabledNodes = workflow.nodes.some(n => !n.disabled);
-      const hasConnections = Object.keys(workflow.connections).length > 0;
+      // A key with empty branches (`main: [[]]`, `main: [null]`) is not a connection (#1101).
+      // A malformed output value counts, so its shape error speaks instead of this one.
+      const hasConnections = Object.values(workflow.connections).some(outputs =>
+        Object.values(outputs || {}).some(branches =>
+          !Array.isArray(branches) || branches.some(branch => !Array.isArray(branch)
+            ? branch != null
+            : branch.some(target => typeof target?.node === 'string' && target.node.length > 0))
+        )
+      );
       
       if (hasEnabledNodes && !hasConnections) {
         result.errors.push({
@@ -870,10 +878,12 @@ export class WorkflowValidator {
           });
         });
 
-        // Validate If/Switch conditions structure (version-conditional)
-        if (node.type === 'n8n-nodes-base.if' || node.type === 'n8n-nodes-base.switch') {
-          const conditionErrors = validateConditionNodeStructure(node as any);
-          for (const err of conditionErrors) {
+        // The config validator above already runs the operator checks, but it keeps one
+        // error per property; this direct call reports every operator, skipping the one the
+        // config validator already surfaced so nothing appears twice.
+        if (node.type === 'n8n-nodes-base.if' || node.type === 'n8n-nodes-base.switch' || node.type === 'n8n-nodes-base.filter') {
+          for (const err of validateConditionNodeStructure(node as any)) {
+            if (result.errors.some(e => e.nodeName === node.name && e.message === err)) continue;
             result.errors.push({
               type: 'error',
               nodeId: node.id,
@@ -1106,6 +1116,31 @@ export class WorkflowValidator {
     });
   }
 
+  /**
+   * A fan-out from main[0] that includes a node named like an error handler says nothing by
+   * itself: the name is a naming choice, and Respond to Webhook or Email Send beside a
+   * side-effect node is an ordinary success path; moving such a node to the error output would
+   * make it run only on failure (#1111). It is worth a note only when the source routes
+   * failures to an error output that nothing consumes, as a hint appended to that warning.
+   */
+  private describeHandlersOnSuccessOutput(
+    outputs: ConnectionBranch[],
+    nodeMap: Map<string, WorkflowNode>,
+    errorOutputIndex: number
+  ): string {
+    if (!outputs[0] || outputs[0].length < 2) return '';
+    const namedLikeHandlers = outputs[0].filter(conn => {
+      const targetNode = nodeMap.get(conn.node);
+      return !!targetNode && /error|fail|catch|exception/.test(targetNode.name.toLowerCase());
+    });
+    if (namedLikeHandlers.length === 0) return '';
+    const isSingle = namedLikeHandlers.length === 1;
+    const names = namedLikeHandlers.map(conn => `"${conn.node}"`).join(', ');
+    return ` ${names} in main[0] ${isSingle ? 'is' : 'are'} named like an error handler: ` +
+           `if ${isSingle ? 'it handles' : 'they handle'} failed items, connect ${isSingle ? 'it' : 'them'} to main[${errorOutputIndex}] instead; ` +
+           `if ${isSingle ? 'it runs' : 'they run'} on success, leave the connection as it is.`;
+  }
+
   /**
    * Validate error output configuration
    */
@@ -1124,20 +1159,22 @@ export class WorkflowValidator {
     // outputs (index = natural count) — main[1] is a normal branch on IF/Switch/
     // SplitInBatches. Skip the mismatch checks when the count is unknown.
     const errorOutputIndex = this.getMainOutputCount(sourceNode);
-    if (errorOutputIndex !== null) {
-      const hasErrorConnections =
-        outputs.length > errorOutputIndex &&
-        outputs[errorOutputIndex] &&
-        outputs[errorOutputIndex].length > 0;
+    const hasErrorConnections =
+      errorOutputIndex !== null &&
+      outputs.length > errorOutputIndex &&
+      !!outputs[errorOutputIndex] &&
+      outputs[errorOutputIndex].length > 0;
 
+    if (errorOutputIndex !== null) {
       // Both mismatch checks are lint, not validity: n8n runs either config.
       // An unwired error output just drops failed items (live-verified).
       if (hasErrorOutputSetting && !hasErrorConnections && profile !== 'minimal') {
         result.warnings.push({
           type: 'warning',
           nodeId: sourceNode.id,
           nodeName: sourceNode.name,
-          message: `Node has onError: 'continueErrorOutput' but the error output (main[${errorOutputIndex}]) is not connected — failed items are silently dropped. Connect an error handler to main[${errorOutputIndex}] or change onError to 'continueRegularOutput' or 'stopWorkflow'.`
+          message: `Node has onError: 'continueErrorOutput' but th
```

---

### Incident Patch 9: `b0ec17cf` (2026-09-16)
**Commit Message**: merge fix/expr-0916 into integration branch

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -7,6 +7,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.86.2] - 2026-09-16
+
+### Added
+
+- **`$jmespath()` queries inside `{{ }}` expressions are checked** ([#1114](https://github.com/czlonkowski/n8n-mcp/issues/1114)). n8n swallows JMESPath parse errors inside an expression, so the field resolves to `null` while the node reports success, and in a Filter or IF condition every item silently fails the check. `validate_workflow` now reads the query when it is a string literal and reports as errors a bare number in a comparison (`[?revenue > 100000]`; JMESPath literals are backtick-quoted), `and`/`or` in place of `&&`/`||`, a single `=` in place of `==`, and reversed arguments (`$jmespath("query", data)`). A double-quoted right-hand side (`== "PL"`, which JMESPath reads as an identifier) and a bare `true`/`false`/`null` (read as a field name) are warnings. Queries held in a variable or built with `${}` are not followed. The JavaScript Code-node checks use the same module, including for nested calls; Python `_jmespath` is no longer checked there because n8n 2.x native Python does not have it.
+
+### Fixed
+
+- **The "Possible missing $ prefix" warning no longer fires on words inside string literals** ([#1115](https://github.com/czlonkowski/n8n-mcp/issues/1115)). A JMESPath query over `.all()` items has to say `json.` because each item is a `{json: …}` wrapper, and the warning read that as a missing `$`. String, template and regex literal contents are blanked before the check; the bare words outside literals still warn. Over the 2,352 bundled templates this removed 60 of 73 such warnings and added no new finding.
 ## [2.86.1] - 2026-09-16
 
 ### Fixed
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "n8n-mcp",
-      "version": "2.86.1",
+      "version": "2.86.2",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.30.0",
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "description": "Integration between n8n workflow automation and Model Context Protocol (MCP)",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -44,7 +44,7 @@
     "test:unit": "vitest run tests/unit",
     "test:cjs-runtime": "node scripts/smoke-cjs-runtime.js",
     "test:integration": "vitest run --config vitest.config.integration.ts",
-    "test:integration:n8n": "vitest run --config vitest.config.integration.ts tests/integration/n8n-api",
+    "test:integration:n8n": "vitest run tests/integration/n8n-api",
     "test:cleanup:orphans": "tsx tests/integration/n8n-api/scripts/cleanup-orphans.ts",
     "test:e2e": "vitest run tests/e2e",
     "lint": "tsc --noEmit",
```

**File**: `package.runtime.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "n8n-mcp-runtime",
-  "version": "2.86.1",
+  "version": "2.86.2",
   "description": "n8n MCP Server Runtime Dependencies Only",
   "private": true,
   "dependencies": {
```

**File**: `src/mcp/tools-documentation.ts` (modified, +1/-1)
```diff
@@ -339,7 +339,7 @@ const plus5Days = now.plus({ days: 5 });
 ### JSON Querying
 \`\`\`javascript
 // JMESPath queries
-const result = $jmespath($json, "users[?age > 30].name");
+const result = $jmespath($json, "users[?age > \`30\`].name"); // numbers are backtick literals
 \`\`\`
 
 ## Return Format Requirements
```

**File**: `src/services/example-generator.ts` (modified, +2/-2)
```diff
@@ -267,8 +267,8 @@ const highPriority = $jmespath(allItems, '[?priority == \`1\`]');
 // Combine multiple conditions
 const urgentExpensive = $jmespath(allItems, '[?price >= \`100\` && priority == \`1\`]');
 
-// String comparisons don't need backticks
-const activeItems = $jmespath(allItems, '[?status == "active"]');
+// Raw strings use single quotes; double quotes name a field
+const activeItems = $jmespath(allItems, "[?status == 'active']");
 
 // Return filtered results
 return expensiveItems.map(item => ({json: item}));`
```

**File**: `src/services/expression-validator.ts` (modified, +35/-1)
```diff
@@ -3,6 +3,7 @@
  * Validates expression syntax, variable references, and context availability
  */
 
+import { blankStringLiterals, checkJmespathQuery, findJmespathCalls } from '../utils/jmespath-checks';
 import { extractBracketExpressions, hasDanglingOpenBracket } from '../utils/expression-utils';
 
 interface ExpressionValidationResult {
@@ -35,6 +36,9 @@ export class ExpressionValidator {
 
   // Expression extraction is now handled by the linear-time
   // `extractBracketExpressions` helper in utils/expression-utils.
+  /** Expressions longer than this skip the JMESPath scan; the scan is linear but bounded anyway. */
+  private static readonly MAX_JMESPATH_SCAN_LENGTH = 50_000;
+
   private static readonly VARIABLE_PATTERNS = {
     json: /\$json(\.[a-zA-Z_][\w]*|\["[^"]+"\]|\['[^']+'\]|\[\d+\])*/g,
     node: /\$node\["([^"]+)"\]\.json/g,
@@ -202,6 +206,34 @@ export class ExpressionValidator {
 
     // Check for common mistakes
     this.checkCommonMistakes(expr, result);
+    this.checkJmespathCalls(expr, result);
+  }
+
+  /**
+   * `$jmespath()` inside `{{ }}`: n8n swallows JMESPath parse errors there and the field
+   * resolves to null while the node reports success (#1114), so the query string gets the
+   * same static checks the Code-node validator applies.
+   */
+  private static checkJmespathCalls(expr: string, result: ExpressionValidationResult): void {
+    if (expr.length > this.MAX_JMESPATH_SCAN_LENGTH) return;
+    const seen = new Set<string>();
+    const report = (severity: 'error' | 'warning', text: string) => {
+      if (seen.has(text)) return;
+      seen.add(text);
+      (severity === 'error' ? result.errors : result.warnings).push(text);
+    };
+    for (const call of findJmespathCalls(expr)) {
+      if (call.queryIsFirstArgument) {
+        report('error', '$jmespath arguments are reversed: use $jmespath(data, "query"); n8n resolves the expression to null');
+        continue;
+      }
+      if (call.query === undefined) continue;
+      for (const finding of checkJmespathQuery(call.query)) {
+        // The silent null is expression-specific; a Code node surfaces the parse error.
+        const consequence = finding.severity === 'error' ? '; n8n resolves the expression to null instead of reporting the parse error' : '';
+        report(finding.severity, `${finding.message}${consequence}. ${finding.fix}`);
+      }
+    }
   }
 
   /**
@@ -218,8 +250,10 @@ export class ExpressionValidator {
     // - Inside word characters (e.g., myJson) - handled by (?<!\w)
     // - Inside bracket notation (e.g., ['json']) - handled by (?<![)
     // - After opening bracket or quote (e.g., "json" or ['json'])
+    // The words are checked outside string literals only: a JMESPath query over .all() items
+    // has to say `json.` because each item is a {json: …} wrapper (#1115).
     const missingPrefixPattern = /(?<![.$\w['])\b(json|node|input|items|workflow|execution)\b(?!\s*[:''])/;
-    if (expr.match(missingPrefixPattern)) {
+    if (blankStringLiterals(expr).match(missingPrefixPattern)) {
       result.warnings.push(
         'Possible missing $ prefix for variable (e.g., use $json instead of json)'
       );
```

**File**: `src/services/node-specific-validators.ts` (modified, +30/-36)
```diff
@@ -5,6 +5,7 @@
  * Each validator understands the specific requirements and patterns of its node.
  */
 
+import { checkJmespathQuery, findJmespathCalls } from '../utils/jmespath-checks';
 import { ValidationError, ValidationWarning } from './config-validator';
 
 /**
@@ -1977,16 +1978,6 @@ export class NodeSpecificValidators {
         });
       }
       
-      // Check for wrong JMESPath parameter order
-      if (code.includes('$jmespath(') && /\$jmespath\s*\(\s*['"`]/.test(code)) {
-        warnings.push({
-          type: 'invalid_value',
-          property: 'jsCode',
-          message: 'Code node $jmespath has reversed parameter order: $jmespath(data, query)',
-          suggestion: 'Use: $jmespath(dataObject, "query.path") not $jmespath("query.path", dataObject)'
-        });
-      }
-      
       // Check for webhook data access patterns
       if (code.includes('items[0].json') && !code.includes('.json.body')) {
         // Check if previous node reference suggests webhook
@@ -2010,36 +2001,39 @@ export class NodeSpecificValidators {
       }
     }
     
-    // Check for JMESPath filters with unquoted numeric literals (both JS and Python).
-    // Length guard: this scans the full Code-node body, which is bounded.
-    // Prevents CodeQL polynomial-ReDoS on crafted input with many unmatched
-    // `[` / `]` brackets around the filter pattern.
-    const jmespathFunction = language === 'javaScript' ? '$jmespath' : '_jmespath';
-    if (code.length <= MAX_CODE_LENGTH && code.includes(jmespathFunction + '(')) {
-      // Look for filter expressions with comparison operators and numbers
-      const filterPattern = /\[?\?[^[\]]*(?:>=?|<=?|==|!=)\s*(\d+(?:\.\d+)?)\s*\]/g;
-      let match;
-
-      while ((match = filterPattern.exec(code)) !== null) {
-        const number = match[1];
-        // Check if the number is NOT wrapped in backticks
-        const beforeNumber = code.substring(match.index, match.index + match[0].indexOf(number));
-        const afterNumber = code.substring(match.index + match[0].indexOf(number) + number.length);
-        
-        if (!beforeNumber.includes('`') || !afterNumber.startsWith('`')) {
-          errors.push({
+    // JMESPath queries passed as string literals get the same static checks as `$jmespath()`
+    // inside `{{ }}` expressions (src/utils/jmespath-checks.ts); calls inside strings or comments
+    // are not read, and a query held in a variable is not followed. Reversed arguments stay a
+    // warning here: a Code node surfaces the runtime failure, unlike an expression, which
+    // resolves to null. Python has no `_jmespath` on n8n 2.x; the Python rules report it as a
+    // removed global.
+    if (language === 'javaScript' && code.length <= MAX_CODE_LENGTH && code.includes('$jmespath')) {
+      const calls = findJmespathCalls(code);
+      for (const call of calls) {
+        if (call.queryIsFirstArgument) {
+          warnings.push({
             type: 'invalid_value',
-            property: language === 'python' ? 'pythonCode' : 'jsCode',
-            message: `JMESPath numeric literal ${number} must be wrapped in backticks`,
-            fix: `Change [?field >= ${number}] to [?field >= \`${number}\`]`
+            property: 'jsCode',
+            message: 'Code node $jmespath has reversed parameter order: $jmespath(data, query)',
+            suggestion: 'Use: $jmespath(dataObject, "query.path") not $jmespath("query.path", dataObject)'
           });
+          continue;
+        }
+        if (call.query === undefined) continue;
+        for (const finding of checkJmespathQuery(call.query)) {
+          if (finding.severity === 'error') {
+            errors.push({ type: 'invalid_value', property: 'jsCode', message: finding.message, fix: finding.fix });
+          } else {
+            warnings.push({ type: 'invalid_value', property: 'jsCode', message: finding.message, suggestion: finding.fix });
+          }
         }
       }
-      
-      // Also provide a general suggestion if JMESPath is used
-      suggestions.push(
-        'JMESPath in n8n requires backticks around numeric literals in filters: [?age >= `18`]'
-      );
+
+      if (calls.length > 0) {
+        suggestions.push(
+          'JMESPath in n8n requires backticks around numeric literals in filters: [?age >= `18`]'
+        );
+      }
     }
   }
   
```

---

### Incident Patch 10: `6aa07d92` (2026-09-16)
**Commit Message**: fix(api): folder-move caveat on every rollback outcome; partial restoration telemetry

Conceived by Romuald Członkowski - https://aiadvisors.pl/en
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/mcp/handlers-workflow-diff.ts` (modified, +31/-9)
```diff
@@ -177,6 +177,11 @@ export async function handleUpdatePartialWorkflow(
   let workflowBefore: any = null;
   let validationBefore: any = null;
   let validationAfter: any = null;
+  // Set only for the "restore incomplete" (partialRestoration) rollback outcome, deep
+  // inside the update-workflow catch below — hoisted here so the telemetry catch at the
+  // bottom of this function (a sibling of that nested scope, not a descendant of it) can
+  // read it too.
+  let partialRestorationObservedWorkflow: unknown;
 
   try {
     // Debug logging (only in debug mode)
@@ -553,6 +558,10 @@ export async function handleUpdatePartialWorkflow(
                 // observed rather than guessing which of the two known states it's in.
                 partialRestoration = true;
                 observedDraftVersionId = (afterRollback as any)?.versionId;
+                // The verification GET succeeded here — afterRollback IS the real
+                // persisted state, unlike the other non-retained outcomes where we only
+                // know what the server ISN'T holding. Telemetry uses this as workflowAfter.
+                partialRestorationObservedWorkflow = afterRollback;
                 logger.warn('rollback PUT errored and the readback matches neither the prior nor the attempted content', {
                   workflowId: input.id,
                   rollbackError: rollbackErrorMessage,
@@ -646,7 +655,13 @@ export async function handleUpdatePartialWorkflow(
                 'The published version is unchanged.',
                 outcomeSentence,
                 'Retrying with the same credentials will not publish it — the API key needs the workflow:activate scope, and the user needs workflow:publish permission on this workflow.',
-                folderMoveInPayload && rollbackPerformed
+                // A folder move on the first PUT is never rolled back regardless of
+                // outcome (rolled back, retained, incomplete or unconfirmed) — n8n never
+                // returns parentFolderId, so there is nothing to restore it from and no
+                // way to confirm it either way. Gate on the payload alone, not on
+                // rollbackPerformed, or this caveat silently disappears for every
+                // outcome except the clean rollback.
+                folderMoveInPayload
                   ? 'A folder move in the failed update may have persisted — n8n cannot report or restore folder placement.'
                   : '',
               ].filter(Boolean).join(' ');
@@ -657,7 +672,7 @@ export async function handleUpdatePartialWorkflow(
                 ...priorVersionDetail,
                 rollbackPerformed,
                 ...(rollbackVerifiedAfterError ? { rollbackVerifiedAfterError: true } : {}),
-                ...folderMoveDetail,
+                ...(folderMoveInPayload ? { folderMoveMayHavePersisted: true } : {}),
                 ...rollbackErrorDetail,
                 ...warningsDetail,
               };
@@ -875,18 +890,25 @@ export async function handleUpdatePartialWorkflow(
         // `rollbackPerformed: false` in its details — never persisted anything, so
         // workflowBefore remains accurate; do not key this off the presence of a
         // `rollbackPerformed` field, or those cases wrongly fall through to "unknown".
-        // For PUBLISH_FORBIDDEN, report the attempted content only when it's confirmed
-        // still retained (changeRetained). Every other outcome — rolled back, restore
-        // incomplete, or unconfirmed — falls back to workflowBefore: the best known
-        // content, even where it isn't certain (restore incomplete/unconfirmed). Always
-        // recording SOME workflowAfter matters more than precision here — MutationTracker
-        // rejects an event with none, so omitting it here dropped these failures entirely.
+        // For PUBLISH_FORBIDDEN, report the attempted content when it's confirmed still
+        // retained (changeRetained), or the actually-observed content when the restore
+        // was confirmed incomplete (partialRestoration — the verification GET succeeded,
+        // so we know the real state, unlike the unconfirmed outcome where it didn't).
+        // Every other outcome — rolled back, or unconfirmed — falls back to
+        // workflowBefore: the best known content, even where it isn't certain
+        // (unconfirmed). Always recording SOME workflowAfter matters more than precision
+        // here — MutationTracker rejects an event with none, so omitting it here dropped
+        // these failures entirely. (MutationTracker also drops an event whose before/after
+        // are identical — pre-existing behavior for every failed update, unrelated to this
+        // fallback, and unchanged here.)
         const details = error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN'
           ? (error.details as Record<string, unknown> | undefined)
           : undefined;
         const 
```

**File**: `tests/unit/mcp/handlers-workflow-diff.test.ts` (modified, +84/-5)
```diff
@@ -1534,12 +1534,12 @@ describe('handlers-workflow-diff', () => {
       expect(result.details).not.toHaveProperty('supersededDraftVersionId');
       expect(result.details).not.toHaveProperty('restoredDraftVersionId');
       expect(result.details).not.toHaveProperty('changeRetained');
-      // Telemetry: a partial restore is neither known state, so workflowAfter falls
-      // back to workflowBefore (the best known content) rather than being omitted.
+      // Telemetry: the verification GET succeeded here, so it IS the real persisted
+      // state — workflowAfter should be that observed content, not workflowBefore.
       await vi.waitFor(() => expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalled());
-      const [telemetryArgs] = telemetryMocks.trackWorkflowMutation.mock.calls.at(-1)!;
-      expect(telemetryArgs).toHaveProperty('workflowAfter');
-      expect(telemetryArgs.workflowAfter).toEqual(telemetryArgs.workflowBefore);
+      expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalledWith(
+        expect.objectContaining({ workflowAfter: expect.objectContaining({ name: 'Partially Restored Workflow' }) }),
+      );
     });
 
     it('reports that what persisted could not be confirmed when both the version and content are unchanged after the failed PUT', async () => {
@@ -1630,6 +1630,85 @@ describe('handlers-workflow-diff', () => {
       });
     });
 
+    it('flags folder-move uncertainty when the restore is incomplete (#1124)', async () => {
+      const before = createTestWorkflow({ name: 'Original Workflow', versionId: 'v1' });
+      const attempted = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'v1', parentFolderId: 'folder-2' });
+      const afterPersist = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'draft-1' });
+      const partiallyRestored = createTestWorkflow({ name: 'Partially Restored Workflow', versionId: 'draft-3' });
+
+      const publishForbidden = new N8nApiError(
+        "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",
+        403,
+        'PUBLISH_FORBIDDEN',
+        { reason: 'insufficient_api_key_scope', versionId: 'draft-1' },
+      );
+      const rollbackRejection = new N8nValidationError('Bad request', { field: 'connections' });
+
+      mockApiClient.getWorkflow
+        .mockResolvedValueOnce(before)
+        .mockResolvedValueOnce(afterPersist)
+        .mockResolvedValueOnce(partiallyRestored);
+      mockDiffEngine.applyDiff.mockResolvedValue({
+        success: true,
+        workflow: attempted,
+        operationsApplied: 1,
+        message: 'Success',
+        errors: [],
+      });
+      mockApiClient.updateWorkflow
+        .mockRejectedValueOnce(publishForbidden)
+        .mockRejectedValueOnce(rollbackRejection);
+
+      const result = await handleUpdatePartialWorkflow({
+        id: 'test-id',
+        operations: [{ type: 'updateName', name: 'Renamed Workflow' }, { type: 'moveToFolder', parentFolderId: 'folder-2' }],
+      }, mockRepository);
+
+      expect(result.code).toBe('PUBLISH_FORBIDDEN');
+      expect(result.details).toMatchObject({ observedDraftVersionId: 'draft-3', folderMoveMayHavePersisted: true });
+      expect(result.error).toContain('restore did not complete');
+      expect(result.error).toContain('folder move');
+    });
+
+    it('flags folder-move uncertainty on the unconfirmed (verification-GET-failed) outcome (#1124)', async () => {
+      const before = createTestWorkflow({ name: 'Original Workflow', versionId: 'v1' });
+      const attempted = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'v1', parentFolderId: 'folder-2' });
+      const afterPersist = createTestWorkflow({ name: 'Renamed Workflow', versionId: 'draft-1' });
+
+      const publishForbidden = new N8nApiError(
+        "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",
+        403,
+        'PUBLISH_FORBIDDEN',
+        { reason: 'insufficient_api_key_scope', versionId: 'draft-1' },
+      );
+      const rollbackRejection = new N8nValidationError('Bad request', { field: 'connections' });
+
+      mockApiClient.getWorkflow
+        .mockResolvedValueOnce(before)
+        .mockResolvedValueOnce(afterPersist)
+        .mockRejectedValueOnce(new Error('GET failed'));
+      mockDiffEngine.applyDiff.mockResolvedValue({
+        success: true,
+        workflow: attempted,
+        operationsApplied: 1,
+        message: 'Success',
+        errors: [],
+      });
+      mockApiClient.updateWorkflow
+        .mockRejectedValueOnce(publishForbidden)
+        .mockRejectedValueOnce(rollbackRejection);
+
+      const result = await handleUpdatePartialWorkflow({
+        id: 'test-id',
+        operations: [{ type: 'updateName', name: 'Renamed Workflow' }, { type: 'moveToFolder', parentFolderId: 'folder-2' }],
+      }, mockRepository);
+
+      expect(result.code).t
```

---

### Incident Patch 11: `b8084d10` (2026-09-16)
**Commit Message**: fix(validation): attribute access, signed primitives, one-line def suites, engine path

Conceived by Romuald Członkowski - https://aiadvisors.pl/en
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/mcp-tools-engine.ts` (modified, +11/-5)
```diff
@@ -63,11 +63,17 @@ export class MCPEngine {
       };
     }
 
-    // CRITICAL FIX: Extract user-provided keys before validation
-    // This prevents false warnings about default values
-    const userProvidedKeys = new Set(Object.keys(args.config || {}));
-
-    return ConfigValidator.validate(args.nodeType, args.config, node.properties || [], userProvidedKeys);
+    // Routed through the enhanced validator so the embedding API sees the same
+    // node-specific checks as validate_node and workflow validation - it also
+    // derives the user-provided keys itself, which keeps default values from
+    // raising false warnings. The result is a superset of ValidationResult.
+    return EnhancedConfigValidator.validateWithMode(
+      args.nodeType,
+      args.config || {},
+      node.properties || [],
+      args.mode ?? 'operation',
+      args.profile ?? 'ai-friendly'
+    );
   }
 
   async validateNodeMinimal(args: any) {
```

**File**: `src/services/node-specific-validators.ts` (modified, +133/-37)
```diff
@@ -44,12 +44,19 @@ const MAX_HEADER_LINES = 50;
 const MAX_RETURN_LOOKAHEAD = 5_000;
 const MAX_RETURN_TOTAL_SCAN = 200_000;
 
+/** A name bound only across a range of one line (comprehension or lambda). */
+interface PythonLocalBinding {
+  name: string;
+  start: number;
+  end: number;
+}
+
 /** One pass over a Python Code node: every line's scope and what it binds. */
 interface PythonScopeIndex {
   lines: string[];
   lineScope: number[];
   scopes: { parent: number; names: Set<string> }[];
-  lineLocal: Set<string>[];
+  lineLocal: PythonLocalBinding[][];
   referenceText: string[];
 }
 
@@ -1638,30 +1645,84 @@ export class NodeSpecificValidators {
   }
 
   /**
-   * Names bound only for the line they appear on: comprehension `for` targets
-   * and `lambda` parameters, both of which have their own scope.
+   * True when a replacement field reaching a dunder belongs to a string that is
+   * actually passed to `.format(...)`. A plain literal such as
+   * `label = "{obj.__class__}"` never evaluates the attribute. f-string fields
+   * are real code and are already visible in the ordinary scan view.
    */
-  private static pythonLineLocalBindings(line: string): string[] {
-    const names: string[] = [];
+  private static pythonFormatsDunder(formatFields: string): boolean {
+    const field = /\{[^{}\n]{0,200}\.__\w+__[^{}\n]{0,200}\}/g;
+    let match: RegExpExecArray | null;
+
+    while ((match = field.exec(formatFields)) !== null) {
+      const after = formatFields.slice(match.index + match[0].length, match.index + match[0].length + 200);
+      if (/['"][ \t]*\.[ \t]*format[ \t]*\(/.test(after)) return true;
+    }
+
+    return false;
+  }
+
+  /**
+   * The bracket group that encloses `index`, or null when the position is not
+   * inside one. Used to bound a comprehension or lambda to its own expression.
+   */
+  private static pythonEnclosingGroup(line: string, index: number): { start: number; end: number } | null {
+    let closers = 0;
+    let start = -1;
+
+    for (let i = index - 1; i >= 0; i--) {
+      const char = line[i];
+      if (char === ')' || char === ']' || char === '}') closers++;
+      else if (char === '(' || char === '[' || char === '{') {
+        if (closers === 0) { start = i; break; }
+        closers--;
+      }
+    }
+    if (start === -1) return null;
+
+    let depth = 0;
+    for (let i = start; i < line.length; i++) {
+      const char = line[i];
+      if (char === '(' || char === '[' || char === '{') depth++;
+      else if (char === ')' || char === ']' || char === '}') {
+        depth--;
+        if (depth === 0) return { start, end: i };
+      }
+    }
+    return { start, end: line.length };
+  }
+
+  /**
+   * Names bound by a comprehension `for` target or a `lambda` parameter, each
+   * with the character range it covers. The range matters: in
+   * `_json + [_json for _json in _items]` only the reference inside the
+   * comprehension is bound - the first one is still the removed global.
+   */
+  private static pythonLineLocalBindings(line: string): PythonLocalBinding[] {
+    const bindings: PythonLocalBinding[] = [];
+    const add = (targets: string, range: { start: number; end: number }) => {
+      this.pythonSplitTopLevel(targets).forEach(target => {
+        const name = this.pythonTargetName(target);
+        if (name) bindings.push({ name, ...range });
+      });
+    };
 
     const forTargets = /\bfor[ \t]+(.+?)[ \t]+in\b/g;
     let match: RegExpExecArray | null;
     while ((match = forTargets.exec(line)) !== null) {
-      this.pythonSplitTopLevel(match[1]).forEach(target => {
-        const name = this.pythonTargetName(target);
-        if (name) names.push(name);
-      });
+      // A comprehension binds across the whole bracket group, including the
+      // output expression written before the `for`.
+      add(match[1], this.pythonEnclosingGroup(line, match.index) ?? { start: match.index, end: line.length });
     }
 
     const lambdas = /\blambda\b([^:\n]*):/g;
     while ((match = lambdas.exec(line)) !== null) {
-      this.pythonSplitTopLevel(match[1]).forEach(target => {
-        const name = this.pythonTargetName(target);
-        if (name) names.push(name);
-      });
+      // A lambda binds from its keyword onward, never before it.
+      const group = this.pythonEnclosingGroup(line, match.index);
+      add(match[1], { start: match.index, end: group ? group.end : line.length });
     }
 
-    return names;
+    return bindings;
   }
 
   /**
@@ -1719,7 +1780,7 @@ export class NodeSpecificValidators {
     const logical = logicalLines ?? this.pythonLogicalLines(lines);
     const scopes: { parent: number; names: Set<string> }[] = [{ parent: -1, names: new Set() }];
     const lineScope = new Array(lines.length).fill(0);
-    const lineLocal = lines.map(() => new Set<string>());
+    const lineLocal: PythonLocalBinding[][] = lines.map(() => []);
     const referenceText = [...lines];
     const stack: { scope: numbe
```

**File**: `src/services/task-templates.ts` (modified, +8/-1)
```diff
@@ -1420,6 +1420,12 @@ elif count % 2:
 else:
     median = (ordered[count // 2 - 1] + ordered[count // 2]) / 2
 
+# Sample standard deviation, the same value statistics.stdev returned
+if count > 1:
+    stdev = (sum((x - mean) ** 2 for x in ordered) / (count - 1)) ** 0.5
+else:
+    stdev = 0
+
 result = {
     "itemCount": len(_items),
     "values": {
@@ -1428,7 +1434,8 @@ result = {
         "mean": mean,
         "median": median,
         "min": ordered[0] if ordered else 0,
-        "max": ordered[-1] if ordered else 0
+        "max": ordered[-1] if ordered else 0,
+        "stdev": stdev
     },
     "categories": categories,
     "dateRange": {
```

**File**: `tests/unit/services/enhanced-config-validator-python.test.ts` (modified, +59/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, it, expect } from 'vitest';
 import { EnhancedConfigValidator } from '@/services/enhanced-config-validator';
 import { NodeSpecificValidators } from '@/services/node-specific-validators';
+import { MCPEngine } from '@/mcp-tools-engine';
 
 /**
  * These run the real validation chain (base ConfigValidator +
@@ -228,3 +229,61 @@ describe('EnhancedConfigValidator - required-field reporting', () => {
     expect(result.errors.filter(e => e.property === property && e.type === 'missing_required')).toHaveLength(1);
   });
 });
+
+/**
+ * The embedding API (MCPEngine) must see the same Python checks as validate_node
+ * and workflow validation - it used to call the base ConfigValidator directly.
+ */
+describe('MCPEngine.validateNodeOperation - Python Code node', () => {
+  const codeNode = {
+    nodeType: 'nodes-base.code',
+    properties: [
+      { name: 'language', type: 'options', options: [{ value: 'javaScript' }, { value: 'pythonNative' }] },
+      { name: 'mode', type: 'options', options: [{ value: 'runOnceForAllItems' }, { value: 'runOnceForEachItem' }] },
+      { name: 'pythonCode', type: 'string' },
+      { name: 'jsCode', type: 'string' }
+    ]
+  };
+
+  const engine = new MCPEngine({
+    getNodeByType: async () => codeNode
+  } as any);
+
+  it('should run the native-Python rules', async () => {
+    const result: any = await engine.validateNodeOperation({
+      nodeType: 'nodes-base.code',
+      config: {
+        language: 'pythonNative',
+        mode: 'runOnceForAllItems',
+        pythonCode: 'rows = _input.all()\nreturn [{"json": {"n": len(rows)}}]'
+      }
+    });
+
+    expect(result.errors).toContainEqual(expect.objectContaining({
+      property: 'pythonCode',
+      message: '_input does not exist in native Python - it was removed with the Pyodide runtime'
+    }));
+  });
+
+  it('should warn about a blocked import', async () => {
+    const result: any = await engine.validateNodeOperation({
+      nodeType: 'nodes-base.code',
+      config: {
+        language: 'pythonNative',
+        mode: 'runOnceForAllItems',
+        pythonCode: 'import json\nreturn [{"json": {"n": len(_items)}}]'
+      }
+    });
+
+    expect(result.warnings.some((w: any) => w.message.includes('import json is blocked'))).toBe(true);
+  });
+
+  it('should not report empty code for pythonNative', async () => {
+    const result: any = await engine.validateNodeOperation({
+      nodeType: 'nodes-base.code',
+      config: { language: 'pythonNative', mode: 'runOnceForEachItem', pythonCode: 'return {"json": _item["json"]}' }
+    });
+
+    expect(result.valid).toBe(true);
+  });
+});
```

**File**: `tests/unit/services/node-specific-validators.test.ts` (modified, +96/-0)
```diff
@@ -2002,6 +2002,46 @@ return [{"json": {"result": result}}]
           expect(errorMessages().filter(m => m.includes('_input'))).toHaveLength(0);
         });
 
+        it('should not fire on attribute access with a removed-global name', () => {
+          context.config = pythonConfig('return [{"json": {"a": state._json, "b": record._now}} for state, record in zip(_items, _items)]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.includes('does not exist in native Python'))).toHaveLength(0);
+        });
+
+        it('should still fire on a reference outside the comprehension that shadows it', () => {
+          context.config = pythonConfig('return _json + [_json for _json in _items]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages()).toContain('_json does not exist in native Python - it was removed with the Pyodide runtime');
+        });
+
+        it('should not fire on a comprehension output expression bound by its own for', () => {
+          context.config = pythonConfig('return [_json for _json in _items]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.includes('_json'))).toHaveLength(0);
+        });
+
+        it('should not fire on a parameter used in a one-line def suite', () => {
+          context.config = pythonConfig('def helper(_json): return _json\n\nreturn [{"json": helper(it["json"])} for it in _items]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.includes('_json'))).toHaveLength(0);
+        });
+
+        it('should warn about a relative import', () => {
+          context.config = pythonConfig('from . import helper\nreturn [{"json": {"n": len(_items)}}]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(context.warnings.some((w: any) => w.message.includes('import helper is blocked'))).toBe(true);
+        });
+
         it('should not fire when the name is imported into scope', () => {
           context.config = pythonConfig('from mod import _json\nreturn [{"json": {"v": _json, "n": len(_items)}}]');
 
@@ -2155,6 +2195,14 @@ return [{"json": {"result": result}}]
           }));
         });
 
+        it('should not fire on attribute access named like a mode variable', () => {
+          context.config = pythonConfig('return {"json": {"n": len(record._items)}}', 'runOnceForEachItem');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.includes('_items does not exist'))).toHaveLength(0);
+        });
+
         it('should still fire when _items is only a comprehension iterable', () => {
           context.config = pythonConfig('return {"json": {"n": sum(1 for it in _items)}}', 'runOnceForEachItem');
 
@@ -2408,6 +2456,14 @@ return [{"json": {"result": result}}]
           expect(errorMessages()).toContain('Dunder access is rejected before the code runs: Security violations detected');
         });
 
+        it('should not error on a dunder in a string that is never formatted', () => {
+          context.config = pythonConfig('label = "{obj.__class__}"\nreturn [{"json": {"label": label, "n": len(_items)}}]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.startsWith('Dunder access'))).toHaveLength(0);
+        });
+
         it('should not error on a dunder mentioned in a comment', () => {
           context.config = pythonConfig('# never use {0.__class__} here\nreturn [{"json": {"n": len(_items)}}]');
 
@@ -2525,6 +2581,38 @@ return [{"json": {"result": result}}]
           expect(errorMessages()).toContain('Cannot return primitive values directly');
         });
 
+        it.each(['-1', '+1', '.5'])('should error on a signed or leading-dot primitive return (%s)', (literal) => {
+          context.config = pythonConfig(`return ${literal}`);
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages()).toContain('Cannot return primitive values directly');
+        });
+
+        it('should not error on a negated identifier return', () => {
+          context.config = pythonConfig('total = len(_items)\nreturn [{"json": {"t": -total}}]');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages().filter(m => m.includes('Cannot return primitive values'))).toHaveLength(0);
+        });
+
+        it('should flag a parenthesised list return in each-item mode', () => {
+          context.config = pythonConfig('return ([{"json": _item["json"]}])', 'runOnceForEachItem');
+
+          NodeSpecificValidators.validateCode(context);
+
+          expect(errorMessages()).toContain('Returning a list in "Run Once for Each Item" mode fails: a \'json\' property isn\'t a dictionary');
+        });
+
+        it('should not flag a parenthesised dic
```

**File**: `tests/unit/services/task-templates.test.ts` (modified, +2/-0)
```diff
@@ -356,6 +356,8 @@ describe('TaskTemplates', () => {
       expect(template?.configuration.pythonCode).toContain('_items');
       expect(template?.configuration.pythonCode).not.toContain('_input');
       expect(template?.configuration.pythonCode).not.toContain('import ');
+      // The output contract still carries stdev, computed without statistics
+      expect(template?.configuration.pythonCode).toContain('"stdev": stdev');
     });
   });
 
```

---

### Incident Patch 12: `1aabc86c` (2026-09-16)
**Commit Message**: fix(validation): any in the operator hint, empty targets are not connections, zero-output bounds message

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/services/enhanced-config-validator.ts` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ export class EnhancedConfigValidator extends ConfigValidator {
         property,
         message,
         ...(message.includes('operator')
-          ? { fix: 'Each condition needs an operator object with "type" (string, number, boolean, dateTime, array, object) and "operation" (for example equals, contains, exists).' }
+          ? { fix: 'Each condition needs an operator object with "type" (string, number, boolean, dateTime, array, object, any) and "operation" (for example equals, contains, exists).' }
           : {})
       });
     }
```

**File**: `src/services/workflow-validator.ts` (modified, +6/-2)
```diff
@@ -556,7 +556,9 @@ export class WorkflowValidator {
       // A malformed output value counts, so its shape error speaks instead of this one.
       const hasConnections = Object.values(workflow.connections).some(outputs =>
         Object.values(outputs || {}).some(branches =>
-          !Array.isArray(branches) || branches.some(branch => !Array.isArray(branch) ? branch != null : branch.some(Boolean))
+          !Array.isArray(branches) || branches.some(branch => !Array.isArray(branch)
+            ? branch != null
+            : branch.some(target => typeof target?.node === 'string' && target.node.length > 0))
         )
       );
       
@@ -1549,7 +1551,9 @@ export class WorkflowValidator {
             nodeId: sourceNode.id,
             nodeName: sourceNode.name,
             message: `Output index ${i} on node "${sourceNode.name}" exceeds its output count (${mainOutputCount}). ` +
-              `This node has ${mainOutputCount} main output(s) (indices 0-${mainOutputCount - 1}).`,
+              (mainOutputCount > 0
+                ? `This node has ${mainOutputCount} main output(s) (indices 0-${mainOutputCount - 1}).`
+                : 'This node has no main outputs; add rules or a fallback output before connecting it.'),
             code: 'OUTPUT_INDEX_OUT_OF_BOUNDS'
           });
           result.statistics.invalidConnections++;
```

**File**: `tests/unit/services/workflow-validator.test.ts` (modified, +24/-0)
```diff
@@ -902,6 +902,30 @@ describe('WorkflowValidator', () => {
     // A conditional node's error output sits after its RULE outputs, not after a flat "main"
     // count - getConditionalOutputInfo supplies that count, and fallbackOutput: 'extra' shifts
     // it by one more.
+    it('describes a Switch with no outputs when a connection is out of bounds', async () => {
+      const result = await validator.validateWorkflow({
+        nodes: [
+          { id: '1', name: 'Switch', type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: [0, 0], parameters: { rules: { values: [] } } },
+          { id: '2', name: 'Next', type: 'n8n-nodes-base.set', position: [200, 0], parameters: {} },
+        ],
+        connections: { 'Switch': { main: [[{ node: 'Next', type: 'main', index: 0 }]] } },
+      } as any);
+      const error = result.errors.find(e => e.message.includes('exceeds its output count'));
+      expect(error?.message).toContain('no main outputs');
+      expect(error?.message).not.toContain('0--1');
+    });
+
+    it('does not count a connection with an empty target as a connection', async () => {
+      const result = await validator.validateWorkflow({
+        nodes: [
+          { id: '1', name: 'A', type: 'n8n-nodes-base.set', position: [0, 0], parameters: {} },
+          { id: '2', name: 'B', type: 'n8n-nodes-base.set', position: [200, 0], parameters: {} },
+        ],
+        connections: { A: { main: [[{ node: '', type: 'main', index: 0 }]] } },
+      } as any);
+      expect(result.errors.some(e => e.message.includes('Multi-node workflow has no connections'))).toBe(true);
+    });
+
     it('leaves a Switch in an unknown mode without an output count', async () => {
       const result = await validator.validateWorkflow({
         nodes: [
```

---

### Incident Patch 13: `88657646` (2026-09-16)
**Commit Message**: fix(validation): a double slash without comment blanking is an operator pair, not a regex

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/utils/jmespath-checks.ts` (modified, +10/-2)
```diff
@@ -132,8 +132,16 @@ export function blankStringLiterals(source: string, options: { comments?: boolea
       while (i < end) out[i++] = ' ';
       continue;
     }
-    // A regex literal cannot be empty or start with `*`, so `//` and `/*` are never one.
-    if (ch === '/' && source[i + 1] !== '/' && source[i + 1] !== '*' && (lastCode === '' || REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord))) {
+    // A regex literal cannot be empty or start with `*`, so `//` and `/*` are never one;
+    // without comment blanking they pass through as operators.
+    if (ch === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
+      out[i] = ch;
+      lastCode = ch;
+      lastWord = '';
+      i += 2;
+      continue;
+    }
+    if (ch === '/' && (lastCode === '' || REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord))) {
       i = blankRegexLiteral(source, out, i);
       lastCode = '/';
       lastWord = '';
```

---

### Incident Patch 14: `1034d601` (2026-09-16)
**Commit Message**: fix(validation): regex after a division, backticks in the JSON-literal fix, operator-specific fixes kept

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/utils/jmespath-checks.ts` (modified, +7/-5)
```diff
@@ -44,7 +44,7 @@ const MAX_TEMPLATE_DEPTH = 64;
  * `}` are read as division: in an expression an object literal or a call result before `/`
  * is far more common than a regex after a block.
  */
-const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
+const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '/', '%', '<', '>', '~', '^']);
 
 /** Keywords after which a `/` starts a regex literal. */
 const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
@@ -132,7 +132,8 @@ export function blankStringLiterals(source: string, options: { comments?: boolea
       while (i < end) out[i++] = ' ';
       continue;
     }
-    if (ch === '/' && (lastCode === '' || REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord))) {
+    // A regex literal cannot be empty or start with `*`, so `//` and `/*` are never one.
+    if (ch === '/' && source[i + 1] !== '/' && source[i + 1] !== '*' && (lastCode === '' || REGEX_PRECEDERS.has(lastCode) || REGEX_KEYWORDS.has(lastWord))) {
       i = blankRegexLiteral(source, out, i);
       lastCode = '/';
       lastWord = '';
@@ -334,8 +335,9 @@ export function checkJmespathQuery(query: string): JmespathQueryFinding[] {
   if (query.length > MAX_QUERY_LENGTH) return findings;
   const seen = new Set<string>();
   const add = (finding: JmespathQueryFinding) => {
-    if (!seen.has(finding.message)) {
-      seen.add(finding.message);
+    const key = `${finding.message}\n${finding.fix}`;
+    if (!seen.has(key)) {
+      seen.add(key);
       findings.push(finding);
     }
   };
@@ -394,7 +396,7 @@ export function checkJmespathQuery(query: string): JmespathQueryFinding[] {
     const text = query.slice(bodyStart, bodyStart + match[2].length);
     // A raw string is single-quoted; when the text holds a quote or a backslash, a JSON
     // literal in backticks is the form that needs no escaping rules of its own.
-    const literal = /['\\]/.test(text) ? `\`${JSON.stringify(text)}\`` : `'${text}'`;
+    const literal = /['\\]/.test(text) ? `\`${JSON.stringify(text).replace(/`/g, '\\`')}\`` : `'${text}'`;
     add({
       severity: 'warning',
       message: `JMESPath treats "${text}" as an identifier, so this compares against the field named ${text} rather than the string; that usually matches nothing`,
```

**File**: `tests/unit/utils/jmespath-checks.test.ts` (modified, +7/-1)
```diff
@@ -19,6 +19,10 @@ describe('blankStringLiterals', () => {
     expect(blankStringLiterals(source).length).toBe(source.length);
   });
 
+  it('reads a regex that follows a division operator', () => {
+    expect(findJmespathCalls('1 / /$jmespath($json, "[?age > 1]")/.test(x)')).toEqual([]);
+  });
+
   it('reads a division after a closed string literal', () => {
     expect(findJmespathCalls('"x" / $jmespath($json, "[?age > 18]")')[0].query).toBe('[?age > 18]');
   });
@@ -149,8 +153,9 @@ describe('checkJmespathQuery', () => {
     expect(checkJmespathQuery('[?active == `true`]')).toEqual([]);
   });
 
-  it('reports each distinct mistake once', () => {
+  it('reports each distinct mistake once, keeping fixes that differ by operator', () => {
     expect(checkJmespathQuery('[?a == 1 && b == 1 && c == 2]').map(f => f.message)).toHaveLength(2);
+    expect(checkJmespathQuery('[?a == 1 && b != 1]').map(f => f.fix)).toEqual(['Write == `1`', 'Write != `1`']);
   });
 
   it('errors on and / or and on a single =', () => {
@@ -182,6 +187,7 @@ describe('checkJmespathQuery', () => {
   it('suggests a JSON literal when the text holds a quote or backslash', () => {
     expect(checkJmespathQuery(`[?name == "O'Reilly"]`)[0].fix).toBe('Use a string literal: == `"O\'Reilly"`');
     expect(checkJmespathQuery('[?name == "a\\b"]')[0].fix).toBe('Use a string literal: == `"a\\\\b"`');
+    expect(checkJmespathQuery('[?name == "a`b\'"]')[0].fix).toBe('Use a string literal: == `"a\\`b\'"`');
     expect(checkJmespathQuery('[?country == "PL"]')[0].fix).toBe("Use a string literal: == 'PL'");
   });
 
```

---

### Incident Patch 15: `69350af5` (2026-09-16)
**Commit Message**: fix(api): autofix passes update details through; telemetry always records an after-state; document the unconfirmed no-rollback outcome

Conceived by Romuald Członkowski - https://aiadvisors.pl/en
Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `src/mcp/handlers-n8n-manager.ts` (modified, +5/-1)
```diff
@@ -1669,7 +1669,11 @@ export async function handleAutofixWorkflow(
           ...(updateResult.code ? { code: updateResult.code } : {}),
           details: {
             fixes: fixResult.fixes,
-            updateError: updateResult.error
+            updateError: updateResult.error,
+            // The partial-update failure's own details (e.g. PUBLISH_FORBIDDEN's
+            // draftVersionId/rollbackPerformed) — dropped before, leaving callers
+            // nothing to act on beyond the flattened error text.
+            ...(updateResult.details ? { updateDetails: updateResult.details } : {})
           }
         };
       }
```

**File**: `src/mcp/handlers-workflow-diff.ts` (modified, +12/-11)
```diff
@@ -875,17 +875,18 @@ export async function handleUpdatePartialWorkflow(
         // `rollbackPerformed: false` in its details — never persisted anything, so
         // workflowBefore remains accurate; do not key this off the presence of a
         // `rollbackPerformed` field, or those cases wrongly fall through to "unknown".
-        // For PUBLISH_FORBIDDEN: report the restored content when the rollback is
-        // confirmed (or direct) performed, the attempted content only when it's
-        // confirmed still retained, and omit workflowAfter when the outcome is
-        // unconfirmed or partial.
-        const isPublishForbidden = error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN';
-        const details = isPublishForbidden ? (error.details as Record<string, unknown> | undefined) : undefined;
-        const workflowAfterOverride: Record<string, unknown> = !isPublishForbidden || details?.rollbackPerformed === true
-          ? { workflowAfter: workflowBefore }
-          : details?.changeRetained === true && diffResult?.workflow
-            ? { workflowAfter: diffResult.workflow }
-            : {};
+        // For PUBLISH_FORBIDDEN, report the attempted content only when it's confirmed
+        // still retained (changeRetained). Every other outcome — rolled back, restore
+        // incomplete, or unconfirmed — falls back to workflowBefore: the best known
+        // content, even where it isn't certain (restore incomplete/unconfirmed). Always
+        // recording SOME workflowAfter matters more than precision here — MutationTracker
+        // rejects an event with none, so omitting it here dropped these failures entirely.
+        const details = error instanceof N8nApiError && error.code === 'PUBLISH_FORBIDDEN'
+          ? (error.details as Record<string, unknown> | undefined)
+          : undefined;
+        const workflowAfterOverride: Record<string, unknown> = details?.changeRetained === true && diffResult?.workflow
+          ? { workflowAfter: diffResult.workflow }
+          : { workflowAfter: workflowBefore };
         void trackWorkflowMutation({
           sessionId,
           toolName: 'n8n_update_partial_workflow',
```

**File**: `src/mcp/tool-docs/workflow_management/n8n-update-partial-workflow.ts` (modified, +1/-1)
```diff
@@ -469,7 +469,7 @@ n8n_update_partial_workflow({
       'Removing a required property may cause validation errors - check node documentation first',
       'Nested property removal with dot notation only removes the specific nested field, not the entire parent object',
       'Array elements are addressed by index in bracket or dot form (e.g., "parameters.assignments.assignments[0].value" or "parameters.assignments.assignments.0.value") - out-of-range indices are rejected, so new elements cannot be appended this way',
-      '**code: "PUBLISH_FORBIDDEN"** (n8n 2.39+): the API key or user may edit a published workflow but not publish it. n8n rejects the save with 403 and this tool decides what to do by content, not by n8n\'s reported version (2.39 does not bump versionId for name/settings-only changes): if the content on the server still matches what was there before, nothing is rolled back; otherwise a rollback is attempted. There are four outcomes: (1) rolled back - the draft now matches the content from before this update, details.rollbackPerformed=true, details.supersededDraftVersionId names the draft the restore replaced; (2) change retained - the rollback failed and a read-back confirms the attempted change is still there, details.rollbackPerformed=false, details.changeRetained=true, details.draftVersionId names the current draft; (3) restore incomplete - the rollback failed and the read-back matches neither the attempted change nor the prior content, details.rollbackPerformed=false, details.observedDraftVersionId names what was actually found; (4) unconfirmed - the rollback failed and the read-back itself failed too, details.rollbackPerformed=false, details.attemptedDraftVersionId names the draft n8n first reported (which the rollback attempt may since have superseded - it is NOT necessarily current). details.rollbackVerifiedAfterError is set only when outcome (1) was confirmed by a read-back after the rollback PUT itself errored (a rollback PUT that returns 200 is just as clean but won\'t set it). A folder move cannot be rolled back or reliably ruled out (parentFolderId is write-only) - when the request moved the workflow, details.folderMoveMayHavePersisted flags that uncertainty regardless of which of the four outcomes applies. Retrying with the same credentials will not publish - the API key needs the workflow:activate scope and the user needs workflow:publish permission on the workflow'
+      '**code: "PUBLISH_FORBIDDEN"** (n8n 2.39+): the API key or user may edit a published workflow but not publish it. n8n rejects the save with 403 and this tool decides what to do by content, not by n8n\'s reported version (2.39 does not bump versionId for name/settings-only changes): a rollback is attempted only when the content on the server no longer matches what was there before. There are five outcomes: (1) version and content both unchanged after the 403 - n8n reports a draft was saved, but nothing on the server shows it, so nothing is rolled back and the outcome is reported as unconfirmed: details.rollbackPerformed=false, details.draftVersionId names the draft n8n reported; (2) rolled back - a rollback was attempted and the draft now matches the content from before this update, details.rollbackPerformed=true, details.supersededDraftVersionId names the draft the restore replaced; (3) change retained - the rollback failed and a read-back confirms the attempted change is still there, details.rollbackPerformed=false, details.changeRetained=true, details.draftVersionId names the current draft; (4) restore incomplete - the rollback failed and the read-back matches neither the attempted change nor the prior content, details.rollbackPerformed=false, details.observedDraftVersionId names what was actually found; (5) unconfirmed (read-back failed) - the rollback failed and the read-back itself failed too, details.rollbackPerformed=false, details.attemptedDraftVersionId names the draft n8n first reported (which the rollback attempt may since have superseded - it is NOT necessarily current). Outcomes (1) and (5) are both reported as "unconfirmed" but are distinguishable: (1) never attempted a rollback at all (no second PUT), while (5) did attempt one and only the verification read-back failed. details.rollbackVerifiedAfterError is set only when outcome (2) was confirmed by a read-back after the rollback PUT itself errored (a rollback PUT that returns 200 is just as clean but won\'t set it). A folder move cannot be rolled back or reliably ruled out (parentFolderId is write-only) - when the request moved the workflow, details.folderMoveMayHavePersisted flags that uncertainty regardless of which of the five outcomes applies. Retrying with the same credentials will not publish - the API key needs the workflow:activate scope and the user needs workflow:publish permission on the workflow'
     ],
     relatedTools: ['n8n_update_full_workflow', 'n8n_get_workflow', 'validate_workflow', 'tools_documentation']
   }
```

**File**: `tests/unit/mcp/handlers-n8n-manager.test.ts` (modified, +83/-5)
```diff
@@ -11,6 +11,8 @@ import {
   N8nServerError,
 } from '@/utils/n8n-errors';
 import { ExecutionStatus } from '@/types/n8n-api';
+import { WorkflowAutoFixer } from '@/services/workflow-auto-fixer';
+import { WorkflowDiffEngine } from '@/services/workflow-diff-engine';
 
 const telemetryMocks = vi.hoisted(() => ({
   trackEvent: vi.fn(),
@@ -36,11 +38,19 @@ vi.mock('@/config/n8n-api', () => ({
   getOfficialMcpConfig: vi.fn().mockReturnValue(null),
   getOfficialMcpConfigFromContext: vi.fn().mockReturnValue(null),
 }));
-vi.mock('@/services/n8n-validation', () => ({
-  validateWorkflowStructure: vi.fn(),
-  hasWebhookTrigger: vi.fn(),
-  getWebhookUrl: vi.fn(),
-}));
+vi.mock('@/services/n8n-validation', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@/services/n8n-validation')>();
+  return {
+    ...actual,
+    validateWorkflowStructure: vi.fn(),
+    hasWebhookTrigger: vi.fn(),
+    getWebhookUrl: vi.fn(),
+    // cleanWorkflowForUpdate is left real: handlers-workflow-diff.ts (reached indirectly
+    // through handleAutofixWorkflow) needs the genuine implementation for its
+    // sameWritableContent rollback comparisons, which silently return false — not throw —
+    // when this is missing, masking the gap as a spurious "restore incomplete" outcome.
+  };
+});
 vi.mock('@/utils/logger', () => ({
   logger: {
     info: vi.fn(),
@@ -68,6 +78,16 @@ vi.mock('@/telemetry/telemetry-manager', () => ({
     trackWorkflowMutation: telemetryMocks.trackWorkflowMutation,
   },
 }));
+// Only handleAutofixWorkflow's own "applying fixes failed" pass-through test overrides
+// these; nothing else in this file calls WorkflowAutoFixer or reaches WorkflowDiffEngine.
+vi.mock('@/services/workflow-auto-fixer', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@/services/workflow-auto-fixer')>();
+  return { ...actual, WorkflowAutoFixer: vi.fn() };
+});
+vi.mock('@/services/workflow-diff-engine', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@/services/workflow-diff-engine')>();
+  return { ...actual, WorkflowDiffEngine: vi.fn() };
+});
 
 describe('handlers-n8n-manager', () => {
   let mockApiClient: any;
@@ -2461,6 +2481,64 @@ describe('handlers-n8n-manager', () => {
     });
   });
 
+  describe('handleAutofixWorkflow - update failure pass-through (#1124)', () => {
+    it('passes the partial-update failure\'s details through under updateDetails', async () => {
+      // Drive the failure through the real handleUpdatePartialWorkflow (its PUBLISH_FORBIDDEN
+      // outcomes are already covered in depth in handlers-workflow-diff.test.ts) rather than
+      // mocking it away, since that module and this one import each other
+      // (handleUpdatePartialWorkflow calls back into getN8nApiClient here) and module-mocking
+      // one from the other's test file does not reliably override the live binding the source
+      // actually calls. WorkflowDiffEngine is mocked to return the workflow completely
+      // unchanged, so the outcome is deterministic: version AND content both come back
+      // unchanged after the failed PUT, landing in the simplest PUBLISH_FORBIDDEN state.
+      const testWorkflow = createTestWorkflow();
+      mockApiClient.getWorkflow.mockResolvedValue(testWorkflow);
+      mockApiClient.updateWorkflow.mockRejectedValue(
+        new N8nApiError(
+          "Your change was saved as a draft. It wasn't published because this API key does not have the workflow:activate scope.",
+          403,
+          'PUBLISH_FORBIDDEN',
+          { reason: 'insufficient_api_key_scope', versionId: 'draft-1' },
+        )
+      );
+      mockValidator.validateWorkflow.mockResolvedValue({ errors: [], warnings: [] });
+      vi.mocked(WorkflowAutoFixer).mockImplementation(() => ({
+        generateFixes: vi.fn().mockResolvedValue({
+          fixes: [{ nodeId: 'node1', nodeName: 'Start', field: 'typeVersion', type: 'typeversion-correction', description: 'Upgrade typeVersion', confidence: 'high' }],
+          operations: [{ type: 'updateNode', nodeId: 'node1', updates: { typeVersion: 1 } }],
+          summary: 'Applied 1 fix',
+          stats: { totalFixes: 1 },
+        }),
+      }) as any);
+      vi.mocked(WorkflowDiffEngine).mockImplementation(() => ({
+        applyDiff: vi.fn().mockResolvedValue({
+          success: true,
+          workflow: testWorkflow,
+          operationsApplied: 1,
+          message: 'ok',
+          errors: [],
+        }),
+      }) as any);
+
+      const result = await handlers.handleAutofixWorkflow(
+        { id: 'test-workflow-id', applyFixes: true },
+        mockRepository
+      );
+
+      expect(result.success).toBe(false);
+      expect(result.error).toBe('Failed to apply fixes');
+      expect(result.code).toBe('PUBLISH_FORBIDDEN');
+      expect((result.details as any).updateError).toContain('could not be confirmed');
+      // The regression this test guards: th
```

**File**: `tests/unit/mcp/handlers-workflow-diff.test.ts` (modified, +9/-5)
```diff
@@ -1472,11 +1472,13 @@ describe('handlers-workflow-diff', () => {
       expect(result.details).not.toHaveProperty('supersededDraftVersionId');
       expect(result.details).not.toHaveProperty('restoredDraftVersionId');
       expect(result.details).not.toHaveProperty('rollbackVerifiedAfterError');
-      // Telemetry: the outcome is unconfirmed, so workflowAfter must be omitted rather
-      // than guessed.
+      // Telemetry: the outcome is unconfirmed, so workflowAfter falls back to
+      // workflowBefore (the best known content) rather than being omitted —
+      // MutationTracker rejects an event with no workflowAfter at all.
       await vi.waitFor(() => expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalled());
       const [telemetryArgs] = telemetryMocks.trackWorkflowMutation.mock.calls.at(-1)!;
-      expect(telemetryArgs).not.toHaveProperty('workflowAfter');
+      expect(telemetryArgs).toHaveProperty('workflowAfter');
+      expect(telemetryArgs.workflowAfter).toEqual(telemetryArgs.workflowBefore);
     });
 
     it('reports an incomplete restore when the verification GET matches neither the prior nor the attempted content', async () => {
@@ -1532,10 +1534,12 @@ describe('handlers-workflow-diff', () => {
       expect(result.details).not.toHaveProperty('supersededDraftVersionId');
       expect(result.details).not.toHaveProperty('restoredDraftVersionId');
       expect(result.details).not.toHaveProperty('changeRetained');
-      // Telemetry: a partial restore is neither state, so workflowAfter must be omitted.
+      // Telemetry: a partial restore is neither known state, so workflowAfter falls
+      // back to workflowBefore (the best known content) rather than being omitted.
       await vi.waitFor(() => expect(telemetryMocks.trackWorkflowMutation).toHaveBeenCalled());
       const [telemetryArgs] = telemetryMocks.trackWorkflowMutation.mock.calls.at(-1)!;
-      expect(telemetryArgs).not.toHaveProperty('workflowAfter');
+      expect(telemetryArgs).toHaveProperty('workflowAfter');
+      expect(telemetryArgs.workflowAfter).toEqual(telemetryArgs.workflowBefore);
     });
 
     it('reports that what persisted could not be confirmed when both the version and content are unchanged after the failed PUT', async () => {
```

#### Recent Merged Pull Requests:
- **PR #1145** (closed): deps(deps): bump the production-dependencies group across 1 directory with 80 updates (@dependabot[bot])
- **PR #1144** (closed): deps-dev(deps-dev): bump the development-dependencies group across 1 directory with 12 updates (@dependabot[bot])
- **PR #1143** (2026-10-01): chore: update n8n to 2.41.x (v2.91.0) (@czlonkowski)
- **PR #1142** (closed): deps(deps): bump the production-dependencies group across 1 directory with 86 updates (@dependabot[bot])
- **PR #1141** (closed): ci(deps): bump github/gh-aw-actions/setup from 0.68.3 to 0.89.21 (@dependabot[bot])
- **PR #1138** (closed): deps(deps): bump the production-dependencies group across 1 directory with 85 updates (@dependabot[bot])
- **PR #1137** (2026-09-27): Telemetry: move to telemetry.n8n-mcp.com (2.90.0) (@czlonkowski)
- **PR #1134** (closed): deps(deps): bump the production-dependencies group across 1 directory with 90 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
