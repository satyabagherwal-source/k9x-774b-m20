# Forensic Learning Record (Deep Inspection): doobidoo/mcp-memory-service

> **Canonical Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:34:51.838Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1975 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `claude-hooks/core/auto-capture-hook.js`
```
#!/usr/bin/env node
/**
 * Claude Code Auto-Capture Hook
 *
 * Automatically captures valuable conversation content after tool operations.
 * Uses pattern detection to identify decisions, errors, learnings, and implementations.
 *
 * Trigger: PostToolUse (Edit, Write, Bash)
 * Input: JSON via stdin with transcript_path and tool info
 *
 * @module auto-capture-hook
 * @version 1.0.0
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');
const { MemoryClient } = require('../utilities/memory-client');

// Import pattern detection
const {
    detectPatterns,
    hasUserOverride,
    generateTags,
    truncateContent,
    computeContentHash,
    extractProjectName,
    DEFAULT_CONFIG
} = require('../utilities/auto-capture-patterns');

/**
 * Load hook configuration
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);

        return {
            memoryService: config.memoryService || {
                http: {
                    endpoint: 'http://127.0.0.1:8000',
                    apiKey: ''
                }
            },
            autoCapture: config.autoCapture || {
                enabled: true,
                minLength: 300,
                maxLength: 4000,
                patterns: ['decision', 'error', 'learning', 'implementation', 'important', 'code'],
                debugMode: false
            }
        };
    } catch (error) {
        console.warn('[auto-capture] Using default configuration:', error.message);
        return {
            memoryService: {
                http: {
                    endpoint: 'http://127.0.0.1:8000',
                    apiKey: ''
                }
            },
            autoCapture: {
                enabled: true,
                minLength: 300,
                maxLength: 4000,
                patterns: ['decision', 'error', 'learning', 'implementation', 'important', 'code'],
                debugMode: false
            }
        };
    }
}

/**
 * Read input from stdin
 */
async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        const timeout = setTimeout(() => {
            resolve(data || '{}');
        }, 1000);

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => {
            clearTimeout(timeout);
            resolve(data);
        });
        process.stdin.on('error', reject);

        // Resume stdin in case it's paused
        process.stdin.resume();
    });
}

/**
 * Parse transcript file to extract last user and assistant messages
 */
async function parseTranscript(transcriptPath) {
    try {
        const content = await fs.readFile(transcriptPath, 'utf8');

        // Claude Code writes transcripts as JSONL (newline-delimited JSON),
        // one message envelope per line. Tolerate trailing whitespace and skip
        // malformed lines instead of failing the whole hook.
        const transcript = [];
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                for (const item of items) {
                    if (item && typeof item === 'object') transcript.push(item);
                }
            } catch {
                // skip malformed line
            }
        }

        if (transcript.length === 0) {
            return null;
        }

        // Pair the last assistant turn with the user message that precedes it.
        // Two independent backward scans can mis-pair when the user already typed
        // their next prompt before the Stop hook reads the transcript (Q2 + A1).
        let assistantIndex = -1;
        let lastAssistant = null;

        for (let i = transcript.length - 1; i >= 0; i--) {
            const msg = transcript[i];
            // Claude Code envelope nests the actual message under `message`;
            // fall back to flat shape for compatibility with older formats.
            const role = msg.message?.role || msg.role || msg.type;
            const content = msg.message?.content ?? msg.content;

            if (role === 'assistant') {
                const text = extractTextContent(content);
                if (text) {
                    lastAssistant = text;
                    assistantIndex = i;
                    break;
                }
            }
        }

        let lastUser = null;
        if (assistantIndex > 0) {
            for (let i = assistantIndex - 1; i >= 0; i--) {
                const msg = transcript[i];
                const role = msg.message?.role || msg.role || msg.type;
                const content = msg.message?.content ?? msg.content;

                if (role !== 'user') continue;
                // Claude Code stores tool results under the user role; skip those.
                if (isToolResultOnly(content)) continue;

                lastUser = extractTextContent(content);
                if (lastUser) break;
            }
        }

        return {
            userMessage: lastUser || '',
            assistantMessage: lastAssistant || '',
            combined: `User: ${lastUser || '[no message]'}\n\nAssistant: ${lastAssistant || '[no response]'}`
        };
    } catch (error) {
        console.error('[auto-capture] Failed to parse transcript:', error.message);
        return null;
    }
}

/**
 * True when a user-role envelope is only tool_result blocks (no real prompt text).
 */
function isToolResultOnly(content) {
    if (!Array.isArray(content) || content.length === 0) return false;
    return content.every(block => block && block.type === 'tool_result');
}

/**
 * Extract text content from various message formats
 */
function extractTextContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
    }

    return '';
}

/**
 * Store memory via MemoryClient
 */
async function storeMemory(config, content, memoryType, tags) {
    const client = new MemoryClient({
        protocol: 'auto',
        preferredProtocol: 'http',
        http: {
            endpoint: config.memoryService.http.endpoint,
            apiKey: config.memoryService.http.apiKey,
        },
        allowSelfSignedCerts: config.memoryService.allowSelfSignedCerts === true,
    });

    try {
        await client.connect();
    } catch (err) {
        throw new Error(`Connect failed: ${err.message}`);
    }

    let result;
    try {
        result = await client.storeMemory(content, {
            tags,
            memoryType,
            metadata: {
                source: 'auto-capture',
                hook: 'PostToolUse',
                captured_at: new Date().toISOString(),
            },
        });
    } finally {
        await client.disconnect();
    }

    if (!result.success) {
        throw new Error(result.error || 'storeMemory returned success=false');
    }
    return result;
}

/**
 * Main hook execution
 */
async function main() {
    const startTime = Date.now();

    try {
        // Load configuration
        const config = await loadConfig();

        // Check if auto-capture is enabled
        if (!config.autoCapture.enabled) {
            if (config.autoCapture.debugMode) {
                console.log('[auto-capture] Disabled in configuration');
            }
            process.exit(0);
        }

        // Read stdin input
        const stdinData = await readStdin();
        let input = {};

        try {
    
```

### Core Architecture Module: `claude-hooks/core/memory-retrieval.js`
```
/**
 * On-Demand Memory Retrieval Hook
 * Allows users to manually request context refresh when needed
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');
const { applySelfSignedCertsOption } = require('../utilities/tls-options');
const https = require('https');

// Import utilities
const { detectProjectContext } = require('../utilities/project-detector');
const { scoreMemoryRelevance } = require('../utilities/memory-scorer');
const { formatMemoriesForContext } = require('../utilities/context-formatter');

/**
 * Load hook configuration
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.warn('[Memory Retrieval] Using default configuration:', error.message);
        return {
            memoryService: {
                endpoint: 'https://narrowbox.local:8443',
                apiKey: 'test-key-123',
                maxMemoriesPerSession: 5
            }
        };
    }
}

/**
 * Query memory service for relevant memories
 */
async function queryMemoryService(endpoint, apiKey, query, allowSelfSignedCerts = false) {
    return new Promise((resolve, reject) => {
        const url = new URL('/mcp', endpoint);
        const isHttps = url.protocol === 'https:';
        const postData = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'retrieve_memory',
                arguments: {
                    query: query.semanticQuery || '',
                    n_results: query.limit || 5
                }
            }
        });

        const options = {
            hostname: url.hostname,
            port: url.port ? Number(url.port) : (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer ${apiKey}`
            }
        };

        applySelfSignedCertsOption(options, isHttps, allowSelfSignedCerts, '[Memory Retrieval]');

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.result && response.result.content) {
                        let textData = response.result.content[0].text;
                        
                        try {
                            // Convert Python dict format to JSON format safely
                            textData = textData
                                .replace(/'/g, '"')
                                .replace(/True/g, 'true')
                                .replace(/False/g, 'false')
                                .replace(/None/g, 'null');
                            
                            const memories = JSON.parse(textData);
                            resolve(memories.results || memories.memories || []);
                        } catch (conversionError) {
                            console.warn('[Memory Retrieval] Could not parse memory response:', conversionError.message);
                            resolve([]);
                        }
                    } else {
                        resolve([]);
                    }
                } catch (parseError) {
                    console.warn('[Memory Retrieval] Parse error:', parseError.message);
                    resolve([]);
                }
            });
        });

        req.on('error', (error) => {
            console.warn('[Memory Retrieval] Network error:', error.message);
            resolve([]);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * On-demand memory retrieval function
 */
async function retrieveMemories(context) {
    try {
        console.log('[Memory Retrieval] On-demand memory retrieval requested...');
        
        // Load configuration
        const config = await loadConfig();
        
        // Detect project context
        const projectContext = await detectProjectContext(context.workingDirectory || process.cwd());
        console.log(`[Memory Retrieval] Project context: ${projectContext.name} (${projectContext.language})`);
        
        // Parse user query if provided
        const userQuery = context.query || context.message || '';
        
        // Build memory query
        const memoryQuery = {
            tags: [
                projectContext.name,
                `language:${projectContext.language}`,
                'key-decisions',
                'architecture',
                'recent-insights'
            ].filter(Boolean),
            semanticQuery: userQuery.length > 0 ? 
                `${projectContext.name} ${userQuery}` : 
                `${projectContext.name} project context decisions architecture`,
            limit: config.memoryService.maxMemoriesPerSession || 5,
            timeFilter: 'last-month'
        };
        
        // Query memory service
        const memories = await queryMemoryService(
            config.memoryService.endpoint,
            config.memoryService.apiKey,
            memoryQuery,
            config.memoryService.allowSelfSignedCerts === true
        );
        
        if (memories.length > 0) {
            console.log(`[Memory Retrieval] Found ${memories.length} relevant memories`);
            
            // Score memories for relevance
            const scoredMemories = scoreMemoryRelevance(memories, projectContext);
            
            // Take top scored memories
            const topMemories = scoredMemories.slice(0, config.memoryService.maxMemoriesPerSession || 5);
            
            // Format memories for display
            const contextMessage = formatMemoriesForContext(topMemories, projectContext, {
                includeScore: true, // Show scores for manual retrieval
                groupByCategory: topMemories.length > 3,
                maxMemories: config.memoryService.maxMemoriesPerSession || 5,
                includeTimestamp: true
            });
            
            // Output formatted context
            if (context.displayResult) {
                await context.displayResult(contextMessage);
                console.log('[Memory Retrieval] Successfully displayed memory context');
            } else {
                // Fallback: log context
                console.log('\n=== RETRIEVED MEMORY CONTEXT ===');
                console.log(contextMessage);
                console.log('=== END CONTEXT ===\n');
            }
            
            return {
                success: true,
                memoriesFound: memories.length,
                memoriesShown: topMemories.length,
                context: contextMessage
            };
            
        } else {
            const message = `## 📋 Memory Retrieval\n\nNo relevant memories found for query: "${userQuery || 'project context'}"\n\nTry a different search term or check if your memory service is running.`;
            
            if (context.displayResult) {
                await context.displayResult(message);
            } else {
                console.log(message);
            }
            
            return {
                success: false,
                memoriesFound: 0,
                memoriesShown: 0,
                context: message
            };
        }
        
    } catch (error) {
        console.error('[Memory Retrieval] Error retrieving memories:', error.message);
        const errorMessage = `## ❌ Memory Retrieval Error\n\n${error.message}\n\nCheck your memory service configur
```

### Core Architecture Module: `claude-hooks/core/mid-conversation.js`
```
/**
 * Mid-Conversation Memory Hook
 * Intelligently triggers memory awareness during conversations based on natural language patterns
 */

const { TieredConversationMonitor } = require('../utilities/tiered-conversation-monitor');
const { AdaptivePatternDetector } = require('../utilities/adaptive-pattern-detector');
const { PerformanceManager } = require('../utilities/performance-manager');
const { MemoryClient } = require('../utilities/memory-client');
const { scoreMemoryRelevance } = require('../utilities/memory-scorer');
const { formatMemoriesForContext } = require('../utilities/context-formatter');
const { detectUserOverrides, logOverride } = require('../utilities/user-override-detector');

class MidConversationHook {
    constructor(config = {}) {
        this.config = config;

        // Decision weighting constants
        this.TRIGGER_WEIGHTS = {
            PATTERN_CONFIDENCE: 0.6,
            CONVERSATION_CONTEXT: 0.4,
            SEMANTIC_SHIFT_BOOST: 0.2,
            QUESTION_PATTERN_BOOST: 0.1,
            PAST_WORK_BOOST: 0.15
        };

        this.THRESHOLD_VALUES = {
            CONVERSATION_PROBABILITY_MIN: 0.3,
            SEMANTIC_SHIFT_MIN: 0.6,
            SPEED_MODE_CONFIDENCE_MIN: 0.8,
            SPEED_MODE_REDUCTION: 0.8
        };

        // Initialize performance management
        this.performanceManager = new PerformanceManager(config.performance);

        // Initialize components with performance awareness
        this.conversationMonitor = new TieredConversationMonitor(
            config.conversationMonitor,
            this.performanceManager
        );

        this.patternDetector = new AdaptivePatternDetector(
            config.patternDetector,
            this.performanceManager
        );

        // Memory client for queries
        this.memoryClient = null;

        // Hook state - read from correct nested config paths
        const midConversationConfig = config.hooks?.midConversation || {};
        const naturalTriggersConfig = config.naturalTriggers || {};

        this.isEnabled = naturalTriggersConfig.enabled !== false;
        this.lastTriggerTime = 0;
        this.cooldownPeriod = naturalTriggersConfig.cooldownPeriod || 30000; // 30 seconds between triggers

        // Analytics
        this.analytics = {
            totalAnalyses: 0,
            triggersExecuted: 0,
            userAcceptanceRate: 0,
            averageLatency: 0,
            totalFeedback: 0
        };
    }

    /**
     * Analyze user message for memory trigger needs
     */
    async analyzeMessage(userMessage, context = {}) {
        if (!this.isEnabled) return null;

        // Check for user overrides (#skip / #remember)
        const overrides = detectUserOverrides(userMessage);
        if (overrides.forceSkip) {
            logOverride('skip');
            return this.createResult('skipped', 'User override #skip', 0);
        }
        if (overrides.forceRemember) {
            logOverride('remember');
            // Bypass cooldown and force high confidence trigger
            this.lastTriggerTime = 0; // Reset cooldown
            return {
                shouldTrigger: true,
                confidence: 1.0,
                reasoning: 'User requested #remember override',
                forceRemember: true,
                timestamp: Date.now()
            };
        }

        const timing = this.performanceManager.startTiming('mid_conversation_analysis', 'fast');

        try {
            this.analytics.totalAnalyses++;

            // Check cooldown period
            if (Date.now() - this.lastTriggerTime < this.cooldownPeriod) {
                return this.createResult('cooldown', 'Cooldown period active', 0);
            }

            // Phase 1: Conversation monitoring
            const conversationAnalysis = await this.conversationMonitor.analyzeMessage(userMessage, context);

            // Phase 2: Pattern detection
            const patternResults = await this.patternDetector.detectPatterns(userMessage, {
                ...context,
                conversationAnalysis
            });

            // Phase 3: Combined decision making
            const triggerDecision = this.makeTriggerDecision(conversationAnalysis, patternResults, context);

            // Update last trigger time if we're recommending a trigger
            if (triggerDecision.shouldTrigger) {
                this.lastTriggerTime = Date.now();
            }

            // Record performance
            const performanceResult = this.performanceManager.endTiming(timing);
            this.analytics.averageLatency = this.updateAverageLatency(performanceResult.latency);

            return {
                shouldTrigger: triggerDecision.shouldTrigger,
                confidence: triggerDecision.confidence,
                reasoning: triggerDecision.reasoning,
                conversationAnalysis,
                patternResults,
                performance: performanceResult,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[Mid-Conversation Hook] Analysis failed:', error.message);
            this.performanceManager.endTiming(timing);
            return this.createResult('error', `Analysis failed: ${error.message}`, 0);
        }
    }

    /**
     * Execute memory retrieval and context injection
     */
    async executeMemoryTrigger(analysisResult, context = {}) {
        if (!analysisResult.shouldTrigger) return null;

        const timing = this.performanceManager.startTiming('memory_trigger_execution', 'intensive');

        try {
            // Initialize memory client if needed
            if (!this.memoryClient) {
                this.memoryClient = new MemoryClient(this.config.memoryService || {});
                await this.memoryClient.connect();
            }

            // Build enhanced query based on analysis
            const memoryQuery = this.buildMemoryQuery(analysisResult, context);

            // Retrieve relevant memories
            const memories = await this.queryMemories(memoryQuery);

            if (memories.length === 0) {
                return this.createResult('no_memories', 'No relevant memories found', analysisResult.confidence);
            }

            // Score and format memories
            const scoredMemories = scoreMemoryRelevance(memories, context.projectContext, {
                verbose: false,
                enhanceRecency: true
            });

            const contextMessage = formatMemoriesForContext(
                scoredMemories.slice(0, this.config.maxMemoriesPerTrigger || 5),
                context.projectContext,
                {
                    includeScore: false,
                    groupByCategory: scoredMemories.length > 3,
                    maxContentLength: 400,
                    includeTimestamp: true
                }
            );

            // Record successful trigger
            this.analytics.triggersExecuted++;

            const performanceResult = this.performanceManager.endTiming(timing);

            return {
                success: true,
                contextMessage,
                memoriesFound: memories.length,
                memoriesUsed: Math.min(scoredMemories.length, this.config.maxMemoriesPerTrigger || 5),
                confidence: analysisResult.confidence,
                performance: performanceResult,
                triggerType: 'mid_conversation'
            };

        } catch (error) {
            console.error('[Mid-Conversation Hook] Memory trigger failed:', error.message);
            this.performanceManager.endTiming(timing);
            return this.createResult('execution_error', `Memory trigger failed: ${error.message}`, analysisResult.confidence);
        }
    }

    /**
     * Make intelligent trigger decision based on all analyses
     */
    makeTriggerDecision(conversationAnalysis, patternResults, context) {
        let confidence = 0;
        const reasons =
```

### Core Architecture Module: `claude-hooks/core/permission-request.js`
```
#!/usr/bin/env node

/**
 * Claude Code PermissionRequest Hook
 * Auto-approves non-destructive MCP tools from all servers
 *
 * This hook intercepts permission requests and automatically approves
 * read-only operations (tools with readOnlyHint or without destructiveHint),
 * eliminating the need for manual user confirmation on safe operations.
 *
 * Updated: 2026-01-09 - Configuration loading, pattern matching fixes
 * Created: 2026-01-08
 * Related: MCP Tool Annotations (readOnlyHint, destructiveHint)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default destructive patterns (always require confirmation)
const DEFAULT_DESTRUCTIVE_PATTERNS = [
    'delete',
    'remove',
    'destroy',
    'drop',
    'clear',
    'wipe',
    'purge',
    'forget',
    'erase',
    'reset',
    'update',  // Can be destructive
    'modify',
    'edit',
    'change',
    'write',   // Can overwrite
    'create',  // Can create unwanted resources
    'deploy',
    'publish',
    'execute', // Code execution can be dangerous
    'run',
    'eval',
    'consolidate' // Modifies memories
];

// Default safe read-only patterns (can be auto-approved)
const DEFAULT_SAFE_PATTERNS = [
    'get',
    'list',
    'read',
    'retrieve',
    'fetch',
    'search',
    'find',
    'query',
    'recall',
    'check',
    'status',
    'health',
    'stats',
    'analyze',
    'view',
    'show',
    'describe',
    'inspect',
    'store',      // Additive only, doesn't delete
    'remember',   // Additive only
    'ingest',     // Document ingestion (additive)
    'rate',       // Rating memories (non-destructive)
    'proactive',  // Proactive context (read-like)
    'context',    // Context retrieval
    'summary',    // Summary retrieval
    'recommendations' // Recommendations (read-only)
];

// Configuration state (loaded at startup)
let config = {
    enabled: false,
    autoApprove: true,
    logDecisions: false,
    destructivePatterns: DEFAULT_DESTRUCTIVE_PATTERNS,
    safePatterns: DEFAULT_SAFE_PATTERNS
};

/**
 * Load configuration from ~/.claude/hooks/config.json
 * Merges custom patterns with built-in defaults
 */
function loadConfiguration() {
    try {
        const configPath = path.join(os.homedir(), '.claude', 'hooks', 'config.json');

        if (!fs.existsSync(configPath)) {
            // No config file, use defaults
            return;
        }

        const configData = fs.readFileSync(configPath, 'utf8');
        const fullConfig = JSON.parse(configData);

        if (!fullConfig.permissionRequest) {
            // No permissionRequest section, use defaults
            return;
        }

        const hookConfig = fullConfig.permissionRequest;

        // Load flags (with defaults)
        config.enabled = hookConfig.enabled !== undefined ? hookConfig.enabled : false;
        config.autoApprove = hookConfig.autoApprove !== undefined ? hookConfig.autoApprove : true;
        config.logDecisions = hookConfig.logDecisions !== undefined ? hookConfig.logDecisions : false;

        // Merge custom patterns with defaults
        if (hookConfig.customSafePatterns && Array.isArray(hookConfig.customSafePatterns)) {
            config.safePatterns = [...DEFAULT_SAFE_PATTERNS, ...hookConfig.customSafePatterns];
        }

        if (hookConfig.customDestructivePatterns && Array.isArray(hookConfig.customDestructivePatterns)) {
            config.destructivePatterns = [...DEFAULT_DESTRUCTIVE_PATTERNS, ...hookConfig.customDestructivePatterns];
        }

        if (config.logDecisions) {
            console.error('[PermissionRequest] Configuration loaded successfully');
            console.error(`  - Enabled: ${config.enabled}`);
            console.error(`  - Auto-approve: ${config.autoApprove}`);
            console.error(`  - Safe patterns: ${config.safePatterns.length}`);
            console.error(`  - Destructive patterns: ${config.destructivePatterns.length}`);
        }

    } catch (error) {
        // On error, fall back to defaults
        console.error(`[PermissionRequest] Failed to load config: ${error.message}`);
        console.error('[PermissionRequest] Using default patterns');
    }
}

// Load configuration at module initialization
loadConfiguration();

/**
 * Main hook entry point
 * Receives JSON via stdin, processes permission request, returns decision
 */
async function main() {
    try {
        // Check if hook is enabled
        if (!config.enabled) {
            if (config.logDecisions) {
                console.error('[PermissionRequest] Hook disabled, prompting user');
            }
            outputDecision('prompt');
            return;
        }

        // Read stdin input
        const input = await readStdin();
        const payload = JSON.parse(input);

        // Check if this is an MCP tool call
        if (isMCPToolCall(payload)) {
            const toolName = extractToolName(payload);

            // Check if auto-approve is disabled
            if (!config.autoApprove) {
                if (config.logDecisions) {
                    console.error('[PermissionRequest] Auto-approve disabled, prompting user');
                }
                outputDecision('prompt');
                return;
            }

            // Check if tool is safe (non-destructive)
            if (isSafeTool(toolName)) {
                // Auto-approve safe tools
                if (config.logDecisions) {
                    console.error(`[PermissionRequest] Auto-approved: ${toolName}`);
                }
                outputDecision('allow', {
                    reason: `Auto-approved safe tool: ${toolName}`,
                    auto_approved: true,
                    server: payload.server_name,
                    tool_name: toolName
                });
            } else {
                // Require confirmation for potentially destructive tools
                if (config.logDecisions) {
                    console.error(`[PermissionRequest] Prompting for: ${toolName}`);
                }
                outputDecision('prompt');
            }
        } else {
            // Not an MCP tool call, show normal dialog
            outputDecision('prompt');
        }
    } catch (error) {
        // On error, fall back to prompting user
        console.error('[PermissionRequest Hook] Error:', error.message);
        outputDecision('prompt');
    }
}

/**
 * Check if the payload represents an MCP tool call
 */
function isMCPToolCall(payload) {
    return payload && (
        payload.hook_event_name === 'PermissionRequest' ||
        payload.type === 'mcp_tool_call' ||
        (payload.tool_name && payload.server_name)
    );
}

/**
 * Extract clean tool name from payload (strip mcp__ prefix)
 * Preserves case for camelCase detection in isSafeTool()
 */
function extractToolName(payload) {
    let toolName = payload.tool_name || '';

    // Strip mcp__servername__ prefix if present
    // Examples: mcp__memory__retrieve_memory -> retrieve_memory
    //           mcp__shodh-cloudflare__recall -> recall
    //           mcp__my_custom_server__get_data -> get_data
    // Use non-greedy match to handle server names with underscores
    const mcpPrefix = /^mcp__.+?__/;
    toolName = toolName.replace(mcpPrefix, '');

    return toolName; // Preserve case for camelCase detection
}

/**
 * Check if the tool is safe (non-destructive) based on naming patterns
 * Uses word boundary regex to prevent false matches
 * Handles underscores, hyphens, and camelCase as word separators
 * Examples:
 *   - "get_updated_records" → ["get", "updated", "records"]
 *   - "statusCheck" → ["status", "check"]
 *   - "GetData" → ["get", "data"]
 */
function isSafeTool(toolName) {
    if (!toolName) {
        return false;
    }

    // Split tool name by underscores, hyphens, and camelCase boundaries
    // First insert separators before capital letters, then split
    const withSeparators = toolName.replace(/([a-z])([A-Z])/g, '$1_$2
```

### Core Architecture Module: `claude-hooks/core/session-end-harvest.js`
```
/**
 * Claude Code Session End Auto-Harvest Hook
 *
 * Triggers POST /api/harvest on session end to extract learnings from the
 * session transcript. Opt-in, fail-safe, never blocks session end.
 *
 * Issue #631. Depends on PR #710 (v10.37.0+) for the harvest endpoint.
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');
const os = require('os');
const http = require('http');
const https = require('https');

const FIRST_RUN_FLAG_FILENAME = 'mcp-memory-harvest-first-run.done';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MIN_MESSAGES = 10;

/**
 * Load hook configuration (same pattern as session-end.js).
 * Returns a safe default (disabled) when config is missing or unreadable.
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const data = await fsp.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn('[Memory Hook] Harvest: using default configuration:', error.message);
        return {};
    }
}

/**
 * Build the Claude Code project directory name from a working directory.
 * Matches the Python side: str(Path.cwd()).replace(os.sep, '-')
 * Returns the full path identifier (project directory name used by Claude
 * Code under ~/.claude/projects/), with separators replaced by dashes —
 * e.g. "/Users/hkr/foo" -> "-Users-hkr-foo". Not a basename.
 */
function deriveProjectName(cwd) {
    if (!cwd) return null;
    // Python: str(Path.cwd()).replace(os.sep, "-")
    // On POSIX cwd starts with "/", giving "-Users-hkr-..."
    // On Windows cwd like "C:\\foo" becomes "C:-foo" — we mirror Python's behavior.
    const sep = path.sep;
    const joined = cwd.split(sep).join('-');
    // When cwd is absolute on POSIX, split yields ["", "Users", ...] -> "-Users-..."
    // which is already correct. On Windows there's no leading sep so prepend nothing.
    return joined;
}

/**
 * Get the first-run flag file path. Honors HOME env for testability.
 */
function firstRunFlagPath() {
    const home = process.env.HOME || os.homedir();
    return path.join(home, '.claude', FIRST_RUN_FLAG_FILENAME);
}

async function firstRunFlagExists() {
    try {
        await fsp.access(firstRunFlagPath(), fs.constants.F_OK);
        return true;
    } catch (_) {
        return false;
    }
}

async function writeFirstRunFlag() {
    const flagPath = firstRunFlagPath();
    try {
        await fsp.mkdir(path.dirname(flagPath), { recursive: true });
        await fsp.writeFile(flagPath, new Date().toISOString() + '\n', 'utf8');
    } catch (err) {
        console.warn('[Memory Hook] Harvest: could not write first-run flag:', err.message);
    }
}

/**
 * POST to /api/harvest with a hard timeout. Never throws.
 * Returns an object: { ok, status, body, error }.
 */
function postHarvest(endpoint, apiKey, payload, timeoutMs, options = {}) {
    return new Promise((resolve) => {
        let url;
        try {
            url = new URL('/api/harvest', endpoint);
        } catch (err) {
            return resolve({ ok: false, error: `Invalid endpoint: ${err.message}` });
        }

        const isHttps = url.protocol === 'https:';
        const requestModule = isHttps ? https : http;
        const body = JSON.stringify(payload);

        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const requestOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers,
            timeout: timeoutMs
        };
        if (isHttps && options.allowSelfSignedCerts === true) {
            requestOptions.rejectUnauthorized = false;
            console.warn(
                '[Memory Hook] Harvest: TLS certificate validation DISABLED ' +
                '(allowSelfSignedCerts=true). This leaves the hook vulnerable to MITM — ' +
                'use only for local development with self-signed certs.'
            );
        }

        const req = requestModule.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (_) { parsed = null; }
                const ok = res.statusCode >= 200 && res.statusCode < 300;
                resolve({ ok, status: res.statusCode, body: parsed, raw: data });
            });
        });

        req.on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, error: `timeout after ${timeoutMs}ms` });
        });

        req.write(body);
        req.end();
    });
}

/**
 * Summarize a harvest response for logging.
 */
function summarizeResponse(resp) {
    if (!resp || !resp.body || !Array.isArray(resp.body.results)) {
        return { found: 0, stored: 0, dryRun: null };
    }
    let found = 0;
    let stored = 0;
    for (const r of resp.body.results) {
        found += Number(r.found || 0);
        stored += Number(r.stored || 0);
    }
    return { found, stored, dryRun: !!resp.body.dry_run };
}

/**
 * Main hook entry point. Matches the Claude Code hook convention
 * (same shape as session-end.js: async function taking `context`).
 *
 * Never throws; all failures are logged as warnings.
 */
async function sessionEndHarvest(context) {
    try {
        // Read via module.exports._internal so tests can monkeypatch loadConfig.
        const config = await (module.exports._internal
            ? module.exports._internal.loadConfig()
            : loadConfig());
        const cfg = config.sessionHarvest || {};

        if (!cfg.enabled) {
            // Opt-in: do nothing unless user turned it on.
            return;
        }

        // Skip short sessions.
        const minMessages = Number.isFinite(cfg.minSessionMessages)
            ? cfg.minSessionMessages
            : DEFAULT_MIN_MESSAGES;
        const messages = (context && context.conversation && Array.isArray(context.conversation.messages))
            ? context.conversation.messages
            : [];
        if (messages.length < minMessages) {
            console.log(`[Memory Hook] Harvest: session has ${messages.length} messages (< ${minMessages}), skipping`);
            return;
        }

        // Derive project_path.
        const cwd = (context && context.workingDirectory) || process.cwd();
        const projectName = deriveProjectName(cwd);
        if (!projectName) {
            console.warn('[Memory Hook] Harvest: could not derive project name, skipping');
            return;
        }

        // First-run dry-run safety.
        const dryRunOnFirstUse = cfg.dryRunOnFirstUse !== false; // default true
        const isFirstRun = !(await firstRunFlagExists());
        const forcedDryRun = dryRunOnFirstUse && isFirstRun;
        const dryRun = forcedDryRun ? true : !!cfg.dryRun;

        if (forcedDryRun) {
            console.log('[Memory Hook] Harvest: first run detected, forcing dry_run=true');
        }

        // Resolve endpoint + api key.
        const endpoint = cfg.endpoint
            || config.memoryService?.http?.endpoint
            || config.memoryService?.endpoint
            || 'http://127.0.0.1:8000';
        const apiKey = context?.apiKey
            || cfg.apiKey
            || config.memoryService?.http?.apiKey
            || config.memoryService?.apiKey
            || process.env.MCP_API_KEY
            || null;

        const payload = {
            sessions: Number.isFinite(cfg.sessions) ? cfg.sessions : 1,
            use_llm: !!cfg.useLlm,
       
```

### Core Architecture Module: `claude-hooks/core/session-end.js`
```
/**
 * Claude Code Session End Hook
 * Automatically consolidates session outcomes and stores them as memories
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');
const { applySelfSignedCertsOption } = require('../utilities/tls-options');
const https = require('https');
const http = require('http');

// Import utilities
const { detectProjectContext } = require('../utilities/project-detector');
const { formatSessionConsolidation } = require('../utilities/context-formatter');
const { detectUserOverrides, logOverride } = require('../utilities/user-override-detector');
const { MemoryClient } = require('../utilities/memory-client');

/**
 * Load hook configuration
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.warn('[Memory Hook] Using default configuration:', error.message);
        return {
            memoryService: {
                http: {
                    endpoint: 'http://127.0.0.1:8000',
                    apiKey: 'test-key-123'
                },
                defaultTags: ['claude-code', 'auto-generated'],
                enableSessionConsolidation: true
            },
            sessionAnalysis: {
                extractTopics: true,
                extractDecisions: true,
                extractInsights: true,
                extractCodeChanges: true,
                extractNextSteps: true,
                minSessionLength: 100 // Minimum characters for meaningful session
            }
        };
    }
}

/**
 * Analyze conversation to extract key information
 */
function analyzeConversation(conversationData) {
    try {
        const analysis = {
            topics: [],
            decisions: [],
            insights: [],
            codeChanges: [],
            nextSteps: [],
            sessionLength: 0,
            confidence: 0
        };
        
        if (!conversationData || !conversationData.messages) {
            return analysis;
        }
        
        const messages = conversationData.messages;
        const conversationText = messages.map(msg => msg.content || '').join('\n').toLowerCase();
        analysis.sessionLength = conversationText.length;
        
        // Extract topics (simple keyword matching)
        const topicKeywords = {
            'implementation': /implement|implementing|implementation|build|building|create|creating/g,
            'debugging': /debug|debugging|bug|error|fix|fixing|issue|problem/g,
            'architecture': /architecture|design|structure|pattern|framework|system/g,
            'performance': /performance|optimization|speed|memory|efficient|faster/g,
            'testing': /test|testing|unit test|integration|coverage|spec/g,
            'deployment': /deploy|deployment|production|staging|release/g,
            'configuration': /config|configuration|setup|environment|settings/g,
            'database': /database|db|sql|query|schema|migration/g,
            'api': /api|endpoint|rest|graphql|service|interface/g,
            'ui': /ui|interface|frontend|component|styling|css|html/g
        };
        
        Object.entries(topicKeywords).forEach(([topic, regex]) => {
            if (conversationText.match(regex)) {
                analysis.topics.push(topic);
            }
        });

        // Extract decisions (look for decision language)
        const decisionPatterns = [
            /decided to|decision to|chose to|choosing|will use|going with/g,
            /better to|prefer|recommend|should use|opt for/g,
            /concluded that|determined that|agreed to/g
        ];
        
        messages.forEach(msg => {
            const content = (msg.content || '').toLowerCase();
            decisionPatterns.forEach(pattern => {
                const matches = content.match(pattern);
                if (matches) {
                    // Extract sentences containing decisions
                    const sentences = msg.content.split(/[.!?]+/);
                    sentences.forEach(sentence => {
                        if (pattern.test(sentence.toLowerCase()) && sentence.length > 20) {
                            analysis.decisions.push(sentence.trim());
                        }
                    });
                }
            });
        });
        
        // Extract insights (look for learning language)
        const insightPatterns = [
            /learned that|discovered|realized|found out|turns out/g,
            /insight|understanding|conclusion|takeaway|lesson/g,
            /important to note|key finding|observation/g
        ];
        
        messages.forEach(msg => {
            const content = (msg.content || '').toLowerCase();
            insightPatterns.forEach(pattern => {
                if (pattern.test(content)) {
                    const sentences = msg.content.split(/[.!?]+/);
                    sentences.forEach(sentence => {
                        if (pattern.test(sentence.toLowerCase()) && sentence.length > 20) {
                            analysis.insights.push(sentence.trim());
                        }
                    });
                }
            });
        });
        
        // Extract code changes (look for technical implementations)
        const codePatterns = [
            /added|created|implemented|built|wrote/g,
            /modified|updated|changed|refactored|improved/g,
            /fixed|resolved|corrected|patched/g
        ];
        
        messages.forEach(msg => {
            const content = msg.content || '';
            if (content.includes('```') || /\.(js|py|rs|go|java|cpp|c|ts|jsx|tsx)/.test(content)) {
                // This message contains code
                const lowerContent = content.toLowerCase();
                codePatterns.forEach(pattern => {
                    if (pattern.test(lowerContent)) {
                        const sentences = content.split(/[.!?]+/);
                        sentences.forEach(sentence => {
                            if (pattern.test(sentence.toLowerCase()) && sentence.length > 15) {
                                analysis.codeChanges.push(sentence.trim());
                            }
                        });
                    }
                });
            }
        });
        
        // Extract next steps (look for future language)
        const nextStepsPatterns = [
            /next|todo|need to|should|will|plan to|going to/g,
            /follow up|continue|proceed|implement next|work on/g,
            /remaining|still need|outstanding|future/g
        ];
        
        messages.forEach(msg => {
            const content = (msg.content || '').toLowerCase();
            nextStepsPatterns.forEach(pattern => {
                if (pattern.test(content)) {
                    const sentences = msg.content.split(/[.!?]+/);
                    sentences.forEach(sentence => {
                        if (pattern.test(sentence.toLowerCase()) && sentence.length > 15) {
                            analysis.nextSteps.push(sentence.trim());
                        }
                    });
                }
            });
        });
        
        // Calculate confidence based on extracted information
        const totalExtracted = analysis.topics.length + analysis.decisions.length + 
                              analysis.insights.length + analysis.codeChanges.length + 
                              analysis.nextSteps.length;
        
        analysis.confidence = Math.min(1.0, totalExtracted / 10); // Max confidence at 10+ items
        
        // Limit arrays to prevent overwhelming output
        // Topics: no limit needed (max 10 possible keywords)
        analysis.decisions = analysis.decisions.slice(0, 3);
        analysis.insights = analysis.insights.slice(0, 3);
        analy
```

### Core Architecture Module: `claude-hooks/core/session-start.js`
```
/**
 * Claude Code Session Start Hook
 * Automatically injects relevant memories at the beginning of each session
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');

// Import utilities
const { detectProjectContext } = require('../utilities/project-detector');
const { scoreMemoryRelevance, analyzeMemoryAgeDistribution, calculateAdaptiveGitWeight } = require('../utilities/memory-scorer');
const { formatMemoriesForContext } = require('../utilities/context-formatter');
const { detectContextShift, extractCurrentContext, determineRefreshStrategy } = require('../utilities/context-shift-detector');
const { analyzeGitContext, buildGitContextQuery } = require('../utilities/git-analyzer');
const { MemoryClient } = require('../utilities/memory-client');
const { getVersionInfo, formatVersionDisplay } = require('../utilities/version-checker');
const { detectUserOverrides, logOverride } = require('../utilities/user-override-detector');

/**
 * Memory Service Configuration
 *
 * maxMemoriesPerSession: Total memory budget (default: 14)
 * reservedTagSlots: Minimum slots guaranteed for tag-based retrieval (default: 3)
 *
 * Phase slot allocation:
 * - Phase 0 (Git): Up to 3 slots (adaptive)
 * - Phase 1 (Recent): ~60% of remaining slots (min 2)
 * - Phase 2 (Tags): At least `reservedTagSlots` slots, more if available
 * - Phase 3 (Fallback): Only if < 3 total memories
 */

/**
 * Load hook configuration
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.warn('[Memory Hook] Using default configuration:', error.message);
        return {
            memoryService: {
                protocol: 'auto',
                preferredProtocol: 'http',
                fallbackEnabled: true,
                http: {
                    endpoint: 'http://127.0.0.1:8889',
                    apiKey: 'test-key-123',
                    healthCheckTimeout: 3000,
                    useDetailedHealthCheck: false
                },
                mcp: {
                    serverCommand: ['uv', 'run', 'memory', 'server'],
                    serverWorkingDir: null,
                    connectionTimeout: 5000,
                    toolCallTimeout: 10000
                },
                defaultTags: ['claude-code', 'auto-generated'],
                maxMemoriesPerSession: 14,      // Increased from 8 to support session + curated memories
                reservedTagSlots: 3,             // NEW: Minimum slots reserved for Phase 2 tag-based retrieval
                injectAfterCompacting: false
            },
            projectDetection: {
                gitRepository: true,
                packageFiles: ['package.json', 'pyproject.toml', 'Cargo.toml'],
                frameworkDetection: true,
                languageDetection: true
            },
            output: {
                verbose: true, // Default to verbose for backward compatibility
                showMemoryDetails: false, // Hide detailed memory scoring by default
                showProjectDetails: true, // Show project detection by default
                showScoringDetails: false, // Hide detailed scoring breakdown
                cleanMode: false // Default to normal output
            }
        };
    }
}

/**
 * Query memory service for health information (supports both HTTP and MCP)
 */
async function queryMemoryHealth(memoryClient) {
    try {
        const healthResult = await memoryClient.getHealthStatus();
        return healthResult;
    } catch (error) {
        return {
            success: false,
            error: error.message,
            fallback: true
        };
    }
}

/**
 * Parse health data into storage info structure (supports both HTTP and MCP responses)
 */
function parseHealthDataToStorageInfo(healthData) {
    try {
        // Handle MCP tool response format
        if (healthData.content && Array.isArray(healthData.content)) {
            const textContent = healthData.content.find(c => c.type === 'text')?.text;
            if (textContent) {
                try {
                    // Parse JSON from MCP response
                    const parsedData = JSON.parse(textContent.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null'));
                    return parseHealthDataToStorageInfo(parsedData);
                } catch (parseError) {
                    console.warn('[Memory Hook] Could not parse MCP health response:', parseError.message);
                    return getUnknownStorageInfo();
                }
            }
        }

        // Handle direct health data object
        const storage = healthData.storage || healthData || {};
        const system = healthData.system || {};
        const statistics = healthData.statistics || healthData.stats || {};
        
        // Determine icon based on backend
        let icon = '💾';
        switch (storage.backend?.toLowerCase()) {
            case 'sqlite-vec':
            case 'sqlite_vec':
                icon = '🪶';
                break;
            case 'chromadb':
            case 'chroma':
                icon = '📦';
                break;
            case 'cloudflare':
                icon = '☁️';
                break;
        }
        
        // Build description with status
        const backendName = storage.backend ? storage.backend.replace('_', '-') : 'Unknown';
        const statusText = storage.status === 'connected' ? 'Connected' : 
                          storage.status === 'disconnected' ? 'Disconnected' : 
                          storage.status || 'Unknown';
        
        const description = `${backendName} (${statusText})`;
        
        // Build location info (use cwd as better fallback than "Unknown")
        let location = storage.database_path || storage.location || process.cwd();
        if (location.length > 50) {
            location = '...' + location.substring(location.length - 47);
        }
        
        // Determine type (local/remote/cloud)
        let type = 'unknown';
        if (storage.backend === 'cloudflare') {
            type = 'cloud';
        } else if (storage.database_path && storage.database_path.startsWith('/')) {
            type = 'local';
        } else if (location.includes('://')) {
            type = 'remote';
        } else {
            type = 'local';
        }
        
        return {
            backend: storage.backend || 'unknown',
            type: type,
            location: location,
            description: description,
            icon: icon,
            // Rich health data
            health: {
                status: storage.status,
                totalMemories: statistics.total_memories || storage.total_memories || 0,
                databaseSizeMB: statistics.database_size_mb || storage.database_size_mb || 0,
                uniqueTags: statistics.unique_tags || storage.unique_tags || 0,
                embeddingModel: storage.embedding_model || 'Unknown',
                platform: system.platform,
                uptime: healthData.uptime_seconds,
                accessible: storage.accessible
            }
        };
        
    } catch (error) {
        return getUnknownStorageInfo();
    }
}

/**
 * Get unknown storage info structure
 */
function getUnknownStorageInfo() {
    return {
        backend: 'unknown',
        type: 'unknown',
        location: 'Health parse error',
        description: 'Unknown Storage',
        icon: '❓',
        health: { status: 'error', totalMemories: 0 }
    };
}

/**
 * Detect storage backend configuration (fallback method)
 */
function detectStorageBackendFallback(config) {
    try {
        // Check environment variable first
        const envBackend = process.env.MCP_MEMORY_STORAGE_BACK
```

### Core Architecture Module: `claude-hooks/core/topic-change.js`
```
/**
 * Claude Code Topic Change Hook
 * Monitors conversation flow and dynamically loads relevant memories when topics evolve
 * Phase 2: Intelligent Context Updates
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveConfigPath } = require('../utilities/config-loader');
const { applySelfSignedCertsOption } = require('../utilities/tls-options');
const https = require('https');

// Import utilities
const { analyzeConversation, detectTopicChanges } = require('../utilities/conversation-analyzer');
const { scoreMemoryRelevance } = require('../utilities/memory-scorer');
const { formatMemoriesForContext } = require('../utilities/context-formatter');

// Global state for conversation tracking
let conversationState = {
    previousAnalysis: null,
    loadedMemoryHashes: new Set(),
    sessionContext: null,
    topicChangeCount: 0
};

/**
 * Load hook configuration
 */
async function loadConfig() {
    try {
        const configPath = resolveConfigPath(__dirname);
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.warn('[Topic Change Hook] Using default configuration:', error.message);
        return {
            memoryService: {
                endpoint: 'https://10.0.1.30:8443',
                apiKey: 'test-key-123',
                maxMemoriesPerSession: 8
            },
            hooks: {
                topicChange: {
                    enabled: true,
                    timeout: 5000,
                    priority: 'low',
                    minSignificanceScore: 0.3,
                    maxMemoriesPerUpdate: 3
                }
            }
        };
    }
}

/**
 * Query memory service for topic-specific memories
 */
async function queryMemoryService(endpoint, apiKey, query, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            limit = 5,
            excludeHashes = [],
            allowSelfSignedCerts = false
        } = options;

        const url = new URL('/mcp', endpoint);
        const isHttps = url.protocol === 'https:';
        const postData = JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
                name: 'retrieve_memory',
                arguments: {
                    query: query,
                    limit: limit
                }
            }
        });

        const requestOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 5000
        };

        applySelfSignedCertsOption(requestOptions, isHttps, allowSelfSignedCerts);

        const req = https.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.error) {
                        console.error('[Topic Change Hook] Memory service error:', response.error);
                        resolve([]);
                        return;
                    }

                    // Parse memory results from response
                    const memories = parseMemoryResults(response.result);
                    
                    // Filter out already loaded memories
                    const filteredMemories = memories.filter(memory => 
                        !excludeHashes.includes(memory.content_hash)
                    );
                    
                    console.log(`[Topic Change Hook] Retrieved ${filteredMemories.length} new memories for topic query`);
                    resolve(filteredMemories);
                    
                } catch (parseError) {
                    console.error('[Topic Change Hook] Failed to parse memory response:', parseError.message);
                    resolve([]);
                }
            });
        });

        req.on('error', (error) => {
            console.error('[Topic Change Hook] Memory service request failed:', error.message);
            resolve([]);
        });

        req.on('timeout', () => {
            console.error('[Topic Change Hook] Memory service request timed out');
            req.destroy();
            resolve([]);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Parse memory results from MCP response
 */
function parseMemoryResults(result) {
    try {
        if (result && result.content && result.content[0] && result.content[0].text) {
            const text = result.content[0].text;
            
            // Try to extract results array from the response text
            const resultsMatch = text.match(/'results':\s*(\[[\s\S]*?\])/);
            if (resultsMatch) {
                // Use eval carefully on controlled content
                const resultsArray = eval(resultsMatch[1]);
                return resultsArray || [];
            }
        }
        return [];
    } catch (error) {
        console.error('[Topic Change Hook] Error parsing memory results:', error.message);
        return [];
    }
}

/**
 * Generate search queries from conversation analysis
 */
function generateTopicQueries(analysis, changes) {
    const queries = [];

    // Query for new topics
    changes.newTopics.forEach(topic => {
        queries.push({
            query: topic.name,
            weight: topic.confidence,
            type: 'topic'
        });
    });

    // Query for current intent if changed
    if (changes.changedIntents && analysis.intent) {
        queries.push({
            query: analysis.intent.name,
            weight: analysis.intent.confidence,
            type: 'intent'
        });
    }

    // Query for high-confidence entities
    analysis.entities
        .filter(entity => entity.confidence > 0.7)
        .slice(0, 2) // Limit to top 2 entities
        .forEach(entity => {
            queries.push({
                query: entity.name,
                weight: entity.confidence,
                type: 'entity'
            });
        });

    // Sort by weight and return top queries
    return queries
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3); // Limit to top 3 queries
}

/**
 * Format context update message
 */
function formatContextUpdate(memories, analysis, changes) {
    if (memories.length === 0) {
        return null;
    }

    let updateMessage = '\n🧠 **Dynamic Memory Context Update**\n\n';
    
    // Explain why context is being updated
    if (changes.newTopics.length > 0) {
        updateMessage += `**New topics detected:** ${changes.newTopics.map(t => t.name).join(', ')}\n\n`;
    }
    
    if (changes.changedIntents) {
        updateMessage += `**Conversation focus shifted:** ${analysis.intent.name}\n\n`;
    }

    // Add relevant memories
    updateMessage += '**Additional relevant context:**\n';
    
    memories.slice(0, 3).forEach((memory, index) => {
        const content = memory.content.length > 120 ? 
            memory.content.substring(0, 120) + '...' : 
            memory.content;
        
        updateMessage += `${index + 1}. ${content}\n`;
        if (memory.tags && memory.tags.length > 0) {
            updateMessage += `   *Tags: ${memory.tags.slice(0, 3).join(', ')}*\n`;
        }
        updateMessage += '\n';
    });

    updateMessage += '---\n';

    return updateMessage;
}

/**
 * Main topic change detection and processing
 * @param {object} context - Conversation context
 */
async function onTopicChange(context) {
    console.log('[Topic Change Hook] Analyzing conversation for
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1380** (2026-09-30): **harvest and Kiro bootstrap ignore MCP_LOCALE and read HARVEST_LOCALE directly**
  *Symptoms*: `MCP_LOCALE` is supposed to be the single switch for every locale-aware subsystem. The CHANGELOG entry for [Codeberg #54](https://codeberg.org/doobidoo/mcp-memory-service/issues/54) says so: "a single `MCP_LOCALE` env var governs every locale-aware subsystem". It only reaches NER and NLI. Harvest and the Kiro bootstrap formatter never see it.  **Where it goes wrong**  `config/locale.py` has the unified reader:  ```python def get_active_locales() -> list[str]:     """Get active locales from MCP_LOCALE (fallback HARVEST_LOCALE, default 'en')."""     raw = os.environ.get("MCP_LOCALE") or os.environ.get("HARVEST_LOCALE", "en") ```  `extraction/multilingual.py` and `reasoning/nli.py` use it. These four places read `HARVEST_LOCALE` directly instead:  - `harvest/extractor.py:35`: `DEFAULT_LOCALE = os.environ.get("HARVEST_LOCALE", "en")`, which is the default for `PatternExtractor` - `harvest/harvester.py:37`: the meta and temporal filters (`load_filters(locale)`) - `harvest/rewriter.py:184`: the locale instruction for the LLM rewriter - `bootstrap/formatter.py:148`: `KiroFormatter(locale=os.environ.get("HARVEST_LOCALE", "en").split(",")[-1])`  **Effect**  | Set | NER / NLI | Harvest patterns, filters, rewriter, Kiro bootstrap | |---|---|---| | `MCP_LOCALE=en,pt_BR` only | en + pt_BR | en | | `HARVEST_LOCALE=en,pt_BR` only | en + pt_BR (fallback) | en + pt_BR | | both, different values | `MCP_LOCALE` | `HARVEST_LOCALE` |  So anyone who follows the CHANGELOG and sets only `MCP_LOCALE`
  **Post-Mortem & Fix Analysis**:
  > Labelled as a good first issue. The change itself is mechanical, but two things will bite if you don't know about them.  1. `_FORMATTERS` in `bootstrap/formatter.py` is built at import time. If `KiroFormatter` gets its locale from `get_active_locales()` there, the value is cached on first import, and later changes to the environment (including in tests) never reach it. Read the locale when the formatter is used, not when the module loads.  2. `tests/test_harvest_pipeline_v2.py:18` sets `HARVEST_LOCALE=pt_BR` with `monkeypatch` but does not clear the cache, unlike `tests/test_multilingual_ner.py`. Once harvest goes through `get_active_locales()`, that test depends on test order, and it also fails whenever `MCP_LOCALE` is set in the environment, because `MCP_LOCALE` wins. Add `get_active_locales.cache_clear()` and `monkeypatch.delenv("MCP_LOCALE", raising=False)` there, and do the same in the new test. 
  > Fixed by #1382 (965e4ecc).

- **Issue #1355** (2026-09-30): **retention_periods keys don't match real memory_type values; quality has ~no effect on decay**
  *Symptoms*: ## Bug Description  The `retention_periods` dict consolidation actually uses at runtime is keyed by four legacy names (`critical`, `reference`, `standard`, `temporary`), but `memory_type` values in the real ontology are `decision`, `learning`, `pattern`, `error`, `observation`, `note`, `bug`, `insight`, and the rest of the taxonomy in `docs/memory-ontology.md`. `_calculate_memory_relevance`'s lookup (`self.retention_periods.get(memory_type, 30)`) misses on every type except `reference`, so almost every memory falls back to the 30-day default regardless of its actual type. The type-based retention design (decisions kept 365 days, learnings 180, and so on) doesn't run in practice.  ## Steps to Reproduce  On `main` at 2d481553:  ```python from mcp_memory_service.config.consolidation import CONSOLIDATION_CONFIG from mcp_memory_service.consolidation.base import ConsolidationConfig  cfg = ConsolidationConfig(**CONSOLIDATION_CONFIG) print(cfg.retention_periods) # {'critical': 365, 'reference': 180, 'standard': 30, 'temporary': 7} ```  `ConsolidationConfig`'s own dataclass default (`consolidation/base.py`) documents the intended mapping in a comment ("Legacy types for backward compatibility (mapped to new types)") and lists both the ontology keys and the legacy ones:  ```python retention_periods: Dict[str, int] = field(default_factory=lambda: {     'decision': 365, 'learning': 180, 'pattern': 90, 'error': 30, 'observation': 30,     'critical': 365, 'reference': 180, 'standard': 30, '
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one - I'll align the retention_periods keys with the documented memory_type ontology and add a regression test. OK to proceed?
  > Fixed by #1368 (73674e4d).
  > @Anshieee thanks for picking this up, and for the clear write-up and tests in #1389. Closing it had nothing to do with the quality of the work, so here's why it ended up as a duplicate.  This issue already had a fix in progress. #1368 by @rubenmarcus was opened on 29.09 and shows up in the timeline above as a cross-reference. It had been through two review rounds and was close to merging. Your question about taking the issue came in at 10:57, and #1389 was open 15 minutes later, before anyone could answer. The answer would have been "there's already a PR for this". The assignment this afternoon didn't help either; that one's on me.  For next time, two quick checks save the work: look at the linked PRs in the issue timeline or the Development box in the sidebar, and wait for a go-ahead after asking. Issues without a linked PR are up for grabs, and your next PR is welcome. 

- **Issue #1328** (2026-09-27): **storage: three error handlers roll back the shared connection off-lock, wiping an in-flight savepoint**
  *Symptoms*:  ## Summary  `delete()`, `update_memories_batch()` and `mark_superseded_batch()` call `self.conn.rollback()` from their exception handlers on the event-loop thread. Every normal statement goes through `_run_in_thread`, which holds `_conn_lock` for the whole closure (`storage/mixins/base.py:101-110`), but these three handlers bypass both that path and the lock. A failing delete or batch can therefore roll back a write that another closure is in the middle of.  Found by @rubenmarcus while ruling out a different theory on #1225, with a deterministic reproducer: https://github.com/doobidoo/mcp-memory-service/issues/1225#issuecomment-5846371747  ## Sites  - `src/mcp_memory_service/storage/mixins/delete.py:69` -- `delete()` - `src/mcp_memory_service/storage/mixins/metadata.py:267` -- `update_memories_batch()` - `src/mcp_memory_service/storage/mixins/metadata.py:290` -- `mark_superseded_batch()`  ## Observed failure  Park `store()` between its memories INSERT and its embedding INSERT via a connection proxy, then fail a `mark_superseded_batch` closure so its handler runs:  - the handler's `rollback()` executes on the loop thread while the parked closure holds both locks, and discards the open savepoint transaction - `store()` then fails with `no such savepoint`, leaving an implicit transaction open that already contains the embedding INSERT (`in_transaction=True`, 1 embedding row, 0 memory rows) - the next committing writer persists it: an orphaned embedding - a later rollback may in
  **Post-Mortem & Fix Analysis**:
  > I opened PR #1344 with a focused fix: rollback handlers now route through `_run_in_thread`, preserving the shared connection lock. The regression is red on upstream main (3 cases) and green after the fix (3 passed); related storage tests pass as well. Scope is limited to #1328 and does not duplicate #1225.

- **Issue #1301** (2026-09-24): **OAuth 2.1: API-Key auth broken after enabling OAuth**
  *Symptoms*: ## Problem  When OAuth 2.1 is enabled via MCP_OAUTH_ENABLED=true, the API rejects requests with X-API-Key header, even for non-OAuth-protected endpoints.  **Affected:** - HTTP API endpoints (e.g. /api/server/status, /api/health/detailed) now require OAuth Bearer token - MCPlex gateway cannot connect (uses API-Key auth) - Web UI cannot load server status (API-Key rejected) - Backward compatibility broken for existing integrations  ## Expected Behavior  - API-Key auth should still work for standard endpoints - OAuth should only protect sensitive endpoints (if configured) - OR: MCPlex/Web-UI should auto-generate OAuth tokens for local access - OR: Documentation should clarify OAuth breaks API-Key auth  ## Environment - Version: 11.13.0 - OAuth Config: MCP_OAUTH_ENABLED=true, MCP_OAUTH_STORAGE_BACKEND=sqlite - Transport: HTTP (Tailscale VPN)  ## Steps to Reproduce  1. Enable OAuth: MCP_OAUTH_ENABLED=true in .env 2. Restart service 3. Try: 'curl http://localhost:8020/api/health -H X-API-Key: xxx' 4. Result: 401 Authorization required instead of 200 OK  ## Solution Options  - Document that OAuth breaks API-Key auth (add to README) - Support dual-auth: Accept both API-Key AND OAuth Bearer tokens - Auto-issue local OAuth token for MCPlex/UI (without user flow) - Add fallback auth mode for local/internal requests
  **Post-Mortem & Fix Analysis**:
  > I dug into `web/oauth/middleware.py:get_current_user` and I don't think this is a design gap — the dual-auth you're proposing already exists. The resolution order is: (1) OAuth Bearer when `OAUTH_ENABLED`, falling back to API-Key if the Bearer fails; (2) `X-API-Key` header, independent of OAuth state; (3) `api_key` query param; (4) anonymous. So API-Key auth does **not** depend on OAuth being off.  Two things likely explain what you're seeing. First, `/api/health` is public (no `Depends`), but `/health/detailed`, `/server/status` and `/health/sync-status` are gated with `require_read_access` — so a 401 there is by design, not a regression. Second, if the 401 shows up with an API key, the usual causes are: `MCP_API_KEY` not actually set in that environment, or the client (MCPlex/Web-UI) sending the key as `Authorization: Bearer` — with OAuth enabled, that gets validated as a JWT first (fails), and the API-Key fallback only rescues it if `API_KEY` is configured.  I hit exactly this mecha
  > ## Resolved: Configuration Issue, Not a Bug  After further analysis by @filhocf (Claudio), it's clear: this is **not a design gap or bug**, but rather a **configuration issue + documentation gap**.  ### Root Cause Analysis: The dual-auth in `web/oauth/middleware.py:get_current_user()` works correctly:  **Auth Fallback Order:** 1. OAuth Bearer Token (when OAUTH_ENABLED=true) 2. X-API-Key Header (works ALWAYS, regardless of OAuth status) 3. api_key Query Parameter 4. Anonymous  **The actual problem was:** - `MCP_API_KEY` was not set in .env - Gated endpoints (`/api/server/status`, `/api/health/detailed`) require `require_read_access` (by design) - Clients must send the key via `X-API-Key` header, not as Authorization Bearer  ### The Truth: ✅ OAuth does NOT break API-Key auth ✅ Dual-auth already exists in the code ✅ With correct configuration, both work together seamlessly  ### What Would Have Helped: - [ ] **Documentation**: Explain the dual-auth pattern clearly - [ ] **Error Messages**:

- **Issue #1261** (2026-09-19): **milvus: get_by_hash returns soft-deleted memories, and is_deleted depends on that**
  *Symptoms*: Found while reviewing #1255, which fixes the same defect on the Cloudflare backend.  `get_by_hash()` is supposed to behave the same on every backend. Two of the three filter soft-deleted rows, one does not:  | backend | implementation | filters tombstones | |---|---|---| | sqlite_vec | `mixins/retrieve.py:439` | yes — `WHERE content_hash = ? AND deleted_at IS NULL` | | cloudflare | `cloudflare.py:1049` | yes, as of #1255 | | milvus | `milvus.py:1888` | **no** |  Milvus does have soft delete — a deleted memory carries `metadata.deleted_at` (`milvus.py:2756`). `get_by_hash()` calls `_call_client("get", ids=[content_hash])` and returns `_entity_to_memory(rows[0])` without looking at it, so a soft-deleted memory comes back as a live `Memory`.  `Memory` has no `deleted_at` attribute, so a caller that receives one cannot tell. That is the same reason the guard in #1255 could never fire. On Milvus the value survives in `metadata`, so a caller *could* check — but no caller outside `is_deleted()` does, and none should have to.  **This does not take the one-line fix that #1255 applied.** `MilvusStorage.is_deleted()` is built directly on the unfiltered lookup:  ```python async def is_deleted(self, content_hash: str) -> bool:     ...     existing = await self.get_by_hash(content_hash)     if existing is None:         return False     return existing.metadata.get("deleted_at") is not None ```  Adding the filter to `get_by_hash()` makes `is_deleted()` return `False` for every soft-deleted 

- **Issue #1226** (2026-09-14): **scripts: maintenance and testing scripts run main() with no argument parsing against whatever .env they find**
  *Symptoms*: On 2026-09-11 a reviewer ran `scripts/testing/test_cloudflare_backend.py --help` to smoke-test an import change. The script has no argument parsing, so `--help` was ignored, `main()` ran, and it wrote a test memory into the production Cloudflare D1 and Vectorize instances. A second script in the same batch performed an embedding repair on the production sqlite database. Neither asked for confirmation and neither printed which database it was about to touch.  Seven of the twelve scripts in that batch have no argument parsing at all. They pick up whatever `.env` is reachable, and `config/base.py` finds it by walking up from the module path, so neither a different working directory nor unsetting the variables in the environment prevents it.  What these scripts need, in order of how much they buy:  1. **Print the target before acting.** Backend, database path and, for Cloudflare, account and database id. One line, always, before the first write. 2. **`--help` must not act.** An `argparse` parser with no required arguments is enough; the current failure mode is that the safest-looking invocation is a live run. 3. **A confirmation or `--yes` for anything that writes**, at least for the scripts under `maintenance/` and `testing/` that touch a real store. 4. **Consider refusing to run against a non-local backend** unless an explicit flag is passed. A script named `test_*` writing to production Cloudflare is the shape of the problem.  `scripts/testing/test_*.py` sitting in the scripts
  **Post-Mortem & Fix Analysis**:
  > Hi, I’d like to work on this issue.  I’ll start with the safety-critical parts: make sure `--help` never executes the script, print the target/backend before any write, and add an explicit confirmation / `--yes` path for scripts that modify data.  I’ll keep the changes focused and add tests where practical to verify that `--help` exits without performing any operation. I’ll open a PR once the first pass is ready.
  > @VijaySreekar you're welcome. Go for it.

- **Issue #1225** (2026-09-28): **storage: memories are being written without an embedding row, so they are invisible to semantic search**
  *Symptoms*: Found while auditing an accidental run of `scripts/maintenance/repair_missing_embeddings_onnx.py` against the production database on 2026-09-11.  Before the repair, 73 memories had a row in `memories` but no corresponding row in `memory_embeddings`. 71 of them were created between 2026-09-05 and 2026-09-11, so this is not historical damage from an old migration: the current write path is dropping embeddings.  A memory with no embedding row is invisible to semantic search. It still shows up in tag and time queries and in `count_all_memories`, so the loss is silent and the counts look right.  What needs to happen:  1. Find the path that stores a memory without its embedding. Candidates worth checking first: the hybrid sync pulling a row from Cloudflare, and any store path that catches an embedding-generation failure and commits the memory anyway. 2. Make that path either fail the store or record the memory as needing a backfill, rather than committing a half-written row. 3. Add a cheap invariant check. `scripts/database/db_health_check.py` already knows how to count the gap; surfacing it in `/api/health` or in the consolidation health report would have caught this weeks ago.  Repro query against a sqlite-vec store:  ```sql SELECT COUNT(*) FROM memories m WHERE m.deleted_at IS NULL   AND NOT EXISTS (SELECT 1 FROM memory_embeddings e WHERE e.rowid = m.id); ``` 
  **Post-Mortem & Fix Analysis**:
  > Opened #1237 for point 3 (the cheap invariant). The count was already there — `_check_embedding_integrity` computes `missing_embeddings` — but `_apply_embedding_integrity` only downgraded the status on orphaned/collision, so a store missing embeddings reported `healthy` with the number buried in the stats dict. That's the blind spot that let the 73 rows sit for a week. The PR downgrades to `degraded` on `missing_embeddings` too, with a backfill hint.  On points 1–2: I couldn't find a live write path that drops the embedding, and I don't think one exists on `main`. `store()`/`store_batch()` and the hybrid Cloudflare→primary pull all insert the memory and its embedding in one savepoint+commit, and bail before the memory row on an embedding failure. So a committed row always carries its embedding, and the gap most likely came from a `memory_embeddings` rebuild/migration or an out-of-band delete — which is exactly why the invariant is the right guard. Details in the PR.
  > Posting the ruled-out analysis from #1321 as requested, plus what your "where to look next" lead turned up.  **Ruled out: delete/metadata closure interleaving with store's savepoint block.** Three reasons, verified against current main:  1. `insert_memory_and_embedding` is a single closure: SAVEPOINT, both INSERTs, RELEASE, all inside `_run_in_thread`, which holds `_conn_lock` for the whole closure (`storage/mixins/base.py:102-110`). No other closure can run a statement between the two INSERTs. 2. The savepoint is the outermost statement of its transaction, so `RELEASE` commits it; the `conn.commit()` at `storage/mixins/store.py:162` has nothing left to do. There is no post-RELEASE window with uncommitted rows. 3. No `SAVEPOINT ... RELEASE` pair spans an `await` anywhere in the storage package.  So delete/metadata interleaving cannot produce this issue's gap, and the injected-proxy test in #1321 that seemed to show it was exercising a state the public API can't reach.  **The lead paid 
  > This is the analysis I wanted on #1321, and the part I did not expect is the second half. I checked both directions against main at 431aec0c.  The ruling-out holds. `insert_memory_and_embedding` is one closure, `_run_in_thread` holds `_conn_lock` for its whole body (`storage/mixins/base.py:101-110`), so nothing can run a statement between the two INSERTs. Interleaving is not the mechanism here.  The new finding holds too, and it is a real bug independent of this issue. Three error handlers call `self.conn.rollback()` on the event-loop thread, outside `_run_in_thread` and therefore outside `_conn_lock`:  - `storage/mixins/delete.py:69` in `delete()` - `storage/mixins/metadata.py:267` in `update_memories_batch()` - `storage/mixins/metadata.py:290` in `mark_superseded_batch()`  The lock only ever covers the worker-thread closure, so a failing delete or batch can wipe an in-flight savepoint from the loop thread. That is worth fixing on its own terms, and your parked-store reproducer is exa

- **Issue #1224** (2026-09-26): **cli: 'memory stop' kills the recorded PID without checking it owns the port**
  *Symptoms*: `#1213` fixed `_read_pid()`, which had never parsed a JSON PID file, so the managed PID was invisible and `stop` always fell through to the port-based path. That was the right fix, but it re-arms a branch that has been dead since the PID file was introduced:  ```python if pid:     _kill_process(pid) ```  There is no comparison against the port the user asked for. `memory stop --port <some free port>` now kills whatever PID the PID file records, which is a different server. Proven at unit level on the #1213 head: with a recorded PID and a free port, `_kill_process` is called with the recorded PID; on the pre-fix code the same call printed "Server is not running."  `#1219` closed the other half of this, the port-fallback path, which now refuses a process whose command line is not a `mcp_memory_service` uvicorn unless `--force` is passed. The PID-file path was deliberately left untouched there, so it is still open.  Two things to fix:  1. `stop` should only kill the recorded PID when that process actually owns the requested port, and otherwise say so. The check `#1219` added is reusable. 2. `launch()` still frees the port blindly (`lifecycle.py`, the "Freeing port N" branch). It should go through the same ownership check rather than killing whatever answers.  Worth adding as a guard in `conftest.py` at the same time: pin `XDG_DATA_HOME` in the lifecycle safety-net fixture, so a test that reaches the real `_read_pid()` cannot read the developer's own PID file. Nothing does today,
  **Post-Mortem & Fix Analysis**:
  > Updated in [#1229](https://github.com/doobidoo/mcp-memory-service/pull/1229) at commit `a4207f4`.  - `memory stop` now falls back to the PID-file process-command check when port ownership cannot be determined, while still refusing a PID that is known to belong to another listener. - Added regression coverage for the unknown-port-owner case and kept the different-port safety case. - Lifecycle tests now isolate both `XDG_DATA_HOME` and Windows `LOCALAPPDATA`.  Validation: 53 focused lifecycle tests passed in the local validation environment, including the updated stop/launch ownership cases. GitHub Actions CI and CodeQL for the new head are currently `action_required` with no jobs started because this is a fork PR awaiting upstream approval.
  > Updated #1229 with a normal merge commit from the latest `main` (`e66db56`). The PR is now mergeable with no conflicts and still contains only the lifecycle ownership changes. Local validation passed: 2,972 tests passed in the CI-equivalent suite, 101 lifecycle tests passed, compileall passed, and `git diff --check` passed. The GitHub Actions runs for `e66db56` are currently `action_required` with no jobs because this fork PR needs upstream approval.
  > Not a maintainer — one contributor's re-check, because this is marked critical and has been open a while, and the tree has moved under it.  **All three asks in this issue appear to be satisfied on `main` at `24843b1`.** The quoted dead branch is gone. Posting the evidence so it can be closed or corrected quickly rather than re-investigated.  ### The ask: stop should only kill the recorded PID when that process owns the requested port  `cli/lifecycle.py` now gates it twice before any kill:  ```python pid = _read_pid() if _refuse_recorded_port_mismatch(pid, port):     # :982     return False port_pid = _find_process_on_port(port) if pid and port_pid in (None, pid):               # :988     ... elif pid:     click.echo(f"Refusing to stop PID {pid}: it does not own port {port}.") ```  `_refuse_recorded_port_mismatch` (`:571`) rejects when the PID file records a port other than the requested one. The `port_pid in (None, pid)` test covers the case this issue describes — a recorded PID with a

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

### Incident Patch 1: `a95f85f2` (2026-09-30)
**Commit Message**: fix(harvest): discover, id, and resolve Kiro workspace-layout sessions (#1378)

* feat(harvest): discover Kiro workspace-layout sessions in find_sessions (#1346)

find_sessions() globbed only *.jsonl at the root, so Kiro workspace sessions
in {hash}/{uuid}/messages.jsonl were never discovered — find_sessions on the
sessions root returned 0 while the cli/ subdir returned 1104. The v4 parser
(#1366) already reads that content; only discovery was missing.

Adds scoped globs: cli/*.jsonl (the flat mirror when the root is
~/.kiro/sessions) and */*/messages.jsonl (workspace layout, includes the
migrated IDE sessions). Real: find_sessions(~/.kiro/sessions) now 1138
(1105 cli + 33 workspace) vs 0 before. Additive; pointing at cli/ unchanged.

Gate G3(RED)->G4(GREEN 143 passed)->G5(reviewer APPROVED, tightened */*.jsonl
to cli/*.jsonl per P1). Alvo A of RFC harvest-kiro-sessions v2.0.

* fix(harvest): resolve workspace sessions end-to-end (session id + path guard)

Addresses two P1 review findings: discovering workspace sessions was not
enough — the pipeline could not process them.

- session_id: workspace 'messages.jsonl' now keys by {workspace_hash}/{session_dir}
  (two components above t

**File**: `changelog.d/1346-discovery.added.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+- **Harvest discovers Kiro workspace-layout sessions, not just the flat CLI mirror (#1346).**
+  `TranscriptParser.find_sessions()` now globs nested
+  `{workspace_hash}/{session_uuid}/messages.jsonl` (Kiro v4 payload-wrapped
+  workspace sessions, including sessions migrated from the old IDE) and the
+  `cli/*.jsonl` mirror, in addition to flat `*.jsonl` at the root. The v4 parser
+  already reads that content (#1366) — only discovery was missing:
+  `find_sessions(~/.kiro/sessions)` returned 0 while `find_sessions(.../cli)`
+  returned 1104. Now the root sees both layouts. Additive and backward-compatible:
+  pointing directly at `cli/` behaves exactly as before, and the `cli/` glob is
+  scoped rather than a broad `*/*.jsonl` wildcard.
```

**File**: `src/mcp_memory_service/consolidation/scheduler.py` (modified, +2/-2)
```diff
@@ -275,7 +275,7 @@ async def _run_scheduled_harvest(self):
             already = await self._read_harvest_tracker(memory_service)
             all_config = HarvestConfig(sessions=9999, project_path=session_dir)
             all_sessions = harvester._resolve_sessions(all_config)
-            pending = [s for s in all_sessions if s.stem not in already]
+            pending = [s for s in all_sessions if harvester._session_id(s) not in already]
             if not pending:
                 self.logger.info("Scheduled harvest: all %d sessions already harvested", len(all_sessions))
                 return
@@ -285,7 +285,7 @@ async def _run_scheduled_harvest(self):
                 dry_run=False,
                 use_llm=use_llm,
                 project_path=session_dir,
-                session_ids=[s.stem for s in pending[:page_size]],
+                session_ids=[harvester._session_id(s) for s in pending[:page_size]],
             )
             results = await harvester.harvest_and_store(config)
             stored = sum(getattr(r, "stored", 0) or 0 for r in results)
```

**File**: `src/mcp_memory_service/harvest/harvester.py` (modified, +74/-19)
```diff
@@ -7,7 +7,7 @@
 from collections import Counter
 from datetime import datetime, timezone
 from pathlib import Path
-from typing import List
+from typing import List, Optional
 
 from .models import HarvestCandidate, HarvestConfig, HarvestResult
 from .parser import TranscriptParser
@@ -45,6 +45,64 @@ def __init__(self, project_dir: Path, memory_service=None):
             "|".join(filters["generic_filters"]), re.IGNORECASE
         ) if filters["generic_filters"] else None
 
+    def _session_id(self, filepath: Path, base_dir: Path = None) -> str:
+        """Stable, unique session id for a session file.
+
+        A Kiro workspace session is ``messages.jsonl`` nested exactly two
+        directory levels under the sessions root
+        (``{root}/{workspace_hash}/{session_dir}/messages.jsonl``), so its
+        ``stem`` collides at ``"messages"`` and the session-dir name alone
+        recurs across workspaces. Such a file is keyed by
+        ``{workspace_hash}/{session_dir}`` — globally unique and reversible via
+        ``_resolve_session_id``.
+
+        A ``messages.jsonl`` that is not in that two-level nesting (e.g. flat at
+        the sessions root) is not a workspace session and keeps its stem, so the
+        id stays resolvable. Every other layout (CLI ``cli/foo.jsonl``, OpenClaw,
+        Claude) also keeps ``filepath.stem`` — the id already in the harvest
+        tracker for thousands of sessions. Semantic, not positional: the id does
+        not change with the directory harvest is pointed at, keeping dedup intact.
+
+        ``base_dir`` defaults to ``self.project_dir``; it anchors the nesting
+        test so a flat ``messages.jsonl`` is not mistaken for a workspace one.
+        """
+        if filepath.name == "messages.jsonl":
+            root = Path(base_dir) if base_dir is not None else self.project_dir
+            try:
+                rel_parts = filepath.resolve().relative_to(Path(root).resolve()).parts
+            except (ValueError, OSError):
+                rel_parts = filepath.parts
+            # Workspace nesting is exactly {hash}/{session}/messages.jsonl:
+            # two directory components above the file, relative to the root.
+            if len(rel_parts) >= 3:
+                return f"{rel_parts[-3]}/{rel_parts[-2]}"
+        return filepath.stem
+
+    def _resolve_session_id(self, sid: str, base_dir: Path) -> Optional[Path]:
+        """Reverse a session id to its file, or None if it escapes base_dir or
+        does not exist. Shared by _resolve_sessions and verify_session_coverage
+        so both agree on how flat and workspace ids map back to paths.
+
+        - flat id ``foo``            -> ``{base_dir}/foo.jsonl``
+        - workspace id ``hash/sess`` -> ``{base_dir}/hash/sess/messages.jsonl``
+        session_ids are caller-controlled, so both candidates are resolved and
+        containment-checked (reject ``../`` traversal) before any I/O.
+        """
+        base = base_dir.resolve()
+        flat = (base_dir / f"{sid}.jsonl").resolve()
+        nested = (base_dir / sid / "messages.jsonl").resolve()
+        if not (flat.is_relative_to(base) or nested.is_relative_to(base)):
+            logger.warning(
+                "Rejected out-of-directory session id %s",
+                _sanitize_log_value(str(sid)),
+            )
+            return None
+        if flat.is_relative_to(base) and flat.exists():
+            return flat
+        if nested.is_relative_to(base) and nested.exists():
+            return nested
+        return None
+
     def _get_classifier(self):
         """Lazy-init LLM classifier."""
         if self._classifier is None:
@@ -275,20 +333,16 @@ async def verify_session_coverage(self, session_id: str, threshold: float = 0.9,
             )
 
         # The session_id is caller-controlled and is turned into a filesystem
-        # path. Resolve it and confirm it stays under project_dir, rejecting
-        # traversal (e.g. "../other/transcript")
```

**File**: `src/mcp_memory_service/harvest/parser.py` (modified, +15/-1)
```diff
@@ -75,10 +75,24 @@ def coverage_report(self) -> dict:
 
 
     def find_sessions(self, project_dir: Path, count: int = 1) -> List[Path]:
-        """Find the most recent JSONL session files in a project directory."""
+        """Find the most recent session files under a directory.
+
+        Discovers two layouts (RFC harvest-kiro-sessions v2.0, RA.1):
+        - flat *.jsonl / *.trajectory.jsonl at the root (CLI mirror, Claude, OpenClaw);
+        - nested {workspace_hash}/{session_uuid}/messages.jsonl (Kiro v4
+          payload-wrapped workspace sessions, including migrated IDE sessions).
+        The nested content is parsed by the existing v4 parser (#1366); only
+        discovery was missing. Pointing directly at cli/ stays backward-compatible.
+        """
         project_dir = Path(project_dir)
         # Support both .jsonl (Claude/Kiro) and .trajectory.jsonl (OpenClaw)
         all_jsonl = list(project_dir.glob("*.jsonl")) + list(project_dir.glob("*.trajectory.jsonl"))
+        # The flat CLI mirror when the root is ~/.kiro/sessions (not .../cli):
+        # scope to cli/ specifically rather than a wildcard */*.jsonl, so an
+        # unrelated .jsonl in some other subdir is not pulled in.
+        all_jsonl += list(project_dir.glob("cli/*.jsonl"))
+        # Nested Kiro workspace sessions: {hash}/{uuid}/messages.jsonl
+        all_jsonl += list(project_dir.glob("*/*/messages.jsonl"))
         # Deduplicate (*.jsonl already matches *.trajectory.jsonl)
         seen = set()
         unique = []
```

**File**: `tests/harvest/test_multilayout_discovery.py` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+"""Alvo A — multi-layout session discovery (RFC harvest-kiro-sessions v2.0, RA.1-RA.3).
+
+find_sessions() globs *.jsonl at the root, which finds the CLI mirror
+(~/.kiro/sessions/cli/*.jsonl) but NOT the workspace layout
+(~/.kiro/sessions/{hash}/{uuid}/messages.jsonl) used by v4 payload-wrapped
+sessions (including the migrated IDE sessions). The parser already reads that
+content (_parse_kiro_v4_line, #1366); only discovery misses it. These tests
+pin that find_sessions must reach both layouts.
+"""
+
+import json
+
+from mcp_memory_service.harvest.parser import TranscriptParser
+
+
+def _v4(text, ptype="user"):
+    return {"id": "x", "timestamp": "2026-09-29T10:00:00.000Z",
+            "payload": {"type": ptype, "content": text}}
+
+
+def test_find_sessions_discovers_workspace_layout(tmp_path):
+    """find_sessions on a sessions root must find {hash}/{uuid}/messages.jsonl,
+    not just *.jsonl at the root."""
+    root = tmp_path / "sessions"
+    ws = root / "4062cbb97764ea66" / "7f1854f6-c6dd-4838-8a75-131a23b298d2"
+    ws.mkdir(parents=True)
+    (ws / "messages.jsonl").write_text(
+        json.dumps(_v4("uma decisão de arquitetura")) + "\n", encoding="utf-8")
+
+    parser = TranscriptParser()
+    found = parser.find_sessions(root, count=100)
+
+    assert any(p.name == "messages.jsonl" for p in found), \
+        "workspace-layout messages.jsonl not discovered"
+
+
+def test_find_sessions_combines_cli_and_workspace(tmp_path):
+    """Both the flat CLI mirror and the nested workspace sessions are found and
+    combined from a single root."""
+    root = tmp_path / "sessions"
+    cli = root / "cli"
+    cli.mkdir(parents=True)
+    (cli / "aaa.jsonl").write_text(
+        json.dumps({"version": "v1", "kind": "Prompt",
+                    "data": {"content": "cli msg"}}) + "\n", encoding="utf-8")
+    ws = root / "hash1" / "uuid1"
+    ws.mkdir(parents=True)
+    (ws / "messages.jsonl").write_text(
+        json.dumps(_v4("workspace msg")) + "\n", encoding="utf-8")
+
+    parser = TranscriptParser()
+    found = parser.find_sessions(root, count=100)
+    names = [p.name for p in found]
+
+    assert "aaa.jsonl" in names
+    assert "messages.jsonl" in names
+    assert len(found) >= 2
+
+
+def test_find_sessions_cli_dir_still_works(tmp_path):
+    """Regression: pointing directly at cli/ behaves exactly as before."""
+    cli = tmp_path / "sessions" / "cli"
+    cli.mkdir(parents=True)
+    for n in ("a.jsonl", "b.jsonl"):
+        (cli / n).write_text(
+            json.dumps({"version": "v1", "kind": "Prompt",
+                        "data": {"content": "m"}}) + "\n", encoding="utf-8")
+
+    parser = TranscriptParser()
+    found = parser.find_sessions(cli, count=100)
+    assert len(found) == 2
+    assert all(p.suffix == ".jsonl" for p in found)
+
+
+def test_find_sessions_workspace_content_parses_via_v4(tmp_path):
+    """The discovered workspace file parses through the existing v4 parser —
+    discovery is the only gap, not parsing."""
+    root = tmp_path / "sessions"
+    ws = root / "h" / "u"
+    ws.mkdir(parents=True)
+    (ws / "messages.jsonl").write_text(
+        json.dumps(_v4("A análise mostrou a decisão correta.", "assistant")) + "\n",
+        encoding="utf-8")
+
+    parser = TranscriptParser()
+    found = parser.find_sessions(root, count=100)
+    ws_file = next(p for p in found if p.name == "messages.jsonl")
+    msgs = parser.parse_file(ws_file)
+
+    assert len(msgs) == 1
+    assert msgs[0].role == "assistant"
+
+
+# TDD RED tests for session ID collision fix
+def test_harvest_file_nested_session_has_unique_id(tmp_path):
+    """BUG 1: _harvest_file gives each workspace session a unique id (the
+    per-session dir name), not 'messages' for all of them."""
+    from mcp_memory_service.harvest.harvester import SessionHarvester
+    from mcp_memory_service.harvest.models import HarvestConfig
+
+    root = tmp_path / "sessions"
+
+    # Two different workspace sessi
```

---

### Incident Patch 2: `73674e4d` (2026-09-30)
**Commit Message**: Key runtime retention periods on the real memory_type ontology (#1368)

* Key runtime retention periods on ontology memory types

* fix(consolidation): resolve subtype memory types to their base retention period

* fix(consolidation): keep the stored subtype in relevance score metadata

Parent-type resolution overwrote memory_type, so an 'insight' memory was
scored and archived as 'learning'. Resolve the parent into a separate
variable used only for the retention lookup.

---------

Co-authored-by: Henry Krupp <5000709+doobidoo@users.noreply.github.com>
Co-authored-by: Henry Krupp <doobidoo@noreply.codeberg.org>

**File**: `changelog.d/1355.fixed.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+- **Type-based retention never matched the real memory_type ontology (#1355, timkjr).**
+  `CONSOLIDATION_CONFIG['retention_periods']` was keyed only by the legacy names
+  (`critical`, `reference`, `standard`, `temporary`), and passing it to
+  `ConsolidationConfig(**...)` replaces the dataclass default wholesale, so
+  `_calculate_memory_relevance` hit its 30-day fallback for every ontology type:
+  a `decision` memory decayed on the `error` schedule instead of its documented
+  365 days, and with retention stuck at 30 days for almost everything the decay
+  factor dominated the quality multiplier. The runtime dict now carries the
+  ontology keys (`decision` 365, `learning` 180, `pattern` 90, `error` 30,
+  `observation` 30) alongside the legacy four, each with its own
+  `MCP_RETENTION_<TYPE>` environment override.
+  Subtypes (`insight` under `learning`, `architecture` under `decision`, ...)
+  resolve to their base type before the lookup, and the new overrides are
+  listed in the web configuration API.
```

**File**: `docs/mastery/configuration-guide.md` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ measures: [Memory Quality Guide](../guides/memory-quality-guide.md).
 - Archive location:
   - `MCP_CONSOLIDATION_ARCHIVE_PATH` or `MCP_MEMORY_ARCHIVE_PATH` (default `${BASE_DIR}/consolidation_archive`).
 - Config knobs:
-  - Decay: `MCP_DECAY_ENABLED`, retention by type: `MCP_RETENTION_CRITICAL`, `MCP_RETENTION_REFERENCE`, `MCP_RETENTION_STANDARD`, `MCP_RETENTION_TEMPORARY`.
+  - Decay: `MCP_DECAY_ENABLED`, retention by type: `MCP_RETENTION_DECISION`, `MCP_RETENTION_LEARNING`, `MCP_RETENTION_PATTERN`, `MCP_RETENTION_ERROR`, `MCP_RETENTION_OBSERVATION`; for memories stored under legacy type names, use the independently configured `MCP_RETENTION_CRITICAL`, `MCP_RETENTION_REFERENCE`, `MCP_RETENTION_STANDARD`, `MCP_RETENTION_TEMPORARY`. Subtypes inherit their base type's period (e.g. an `insight` memory decays on the `learning` period).
   - Associations: `MCP_ASSOCIATIONS_ENABLED`, `MCP_ASSOCIATION_MIN_SIMILARITY`, `MCP_ASSOCIATION_MAX_SIMILARITY`, `MCP_ASSOCIATION_MAX_PAIRS`.
     - `MCP_CONSOLIDATION_AUTO_SUPERSEDE` (default `true`): when relationship inference labels an association `contradicts` with confidence ≥ 0.75, the older memory is marked superseded and drops out of default retrieval. Set to `false` to keep the `contradicts` edges in the graph and leave both memories visible. The setting only prevents future supersession: memories that are already superseded stay hidden until their `superseded_by` is cleared, which is a separate step.
   - Clustering: `MCP_CLUSTERING_ENABLED`, `MCP_CLUSTERING_MIN_SIZE`, `MCP_CLUSTERING_ALGORITHM`.
```

**File**: `src/mcp_memory_service/config/consolidation.py` (modified, +10/-0)
```diff
@@ -37,6 +37,16 @@
     # Decay settings
     'decay_enabled': os.getenv('MCP_DECAY_ENABLED', 'true').lower() == 'true',
     'retention_periods': {
+        # Base ontology types (from Phase 0 Ontology Foundation): the values
+        # _calculate_memory_relevance looks up by memory_type. Without these
+        # keys every ontology-typed memory hit the 30-day fallback (#1355).
+        'decision': safe_get_int_env('MCP_RETENTION_DECISION', 365, min_value=1, max_value=3650),
+        'learning': safe_get_int_env('MCP_RETENTION_LEARNING', 180, min_value=1, max_value=3650),
+        'pattern': safe_get_int_env('MCP_RETENTION_PATTERN', 90, min_value=1, max_value=3650),
+        'error': safe_get_int_env('MCP_RETENTION_ERROR', 30, min_value=1, max_value=3650),
+        'observation': safe_get_int_env('MCP_RETENTION_OBSERVATION', 30, min_value=1, max_value=3650),
+
+        # Legacy types for backward compatibility (mapped to new types)
         'critical': safe_get_int_env('MCP_RETENTION_CRITICAL', 365, min_value=1, max_value=3650),
         'reference': safe_get_int_env('MCP_RETENTION_REFERENCE', 180, min_value=1, max_value=3650),
         'standard': safe_get_int_env('MCP_RETENTION_STANDARD', 30, min_value=1, max_value=3650),
```

**File**: `src/mcp_memory_service/consolidation/decay.py` (modified, +11/-2)
```diff
@@ -21,6 +21,7 @@
 
 from .base import ConsolidationBase, ConsolidationConfig
 from ..models.memory import Memory
+from ..models.ontology import get_parent_type
 
 @dataclass
 class RelevanceScore:
@@ -92,9 +93,17 @@ async def _calculate_memory_relevance(
         # Extract base importance score
         base_importance = self._get_base_importance(memory)
 
-        # Get retention period for memory type
+        # Get retention period for memory type. Stored types can be subtypes
+        # (e.g. 'insight' under 'learning'): resolve them to their base type
+        # so they inherit the base retention period instead of the 30-day
+        # fallback. Legacy names stay in retention_periods and skip resolution.
+        # The parent only selects the period; memory_type keeps the stored
+        # subtype for the score metadata.
         memory_type = self._extract_memory_type(memory)
-        retention_period = self.retention_periods.get(memory_type, 30)
+        retention_type = memory_type
+        if retention_type not in self.retention_periods:
+            retention_type = get_parent_type(memory_type) or memory_type
+        retention_period = self.retention_periods.get(retention_type, 30)
 
         # Calculate exponential decay factor
         decay_factor = math.exp(-age_days / retention_period)
```

**File**: `src/mcp_memory_service/web/api/configuration.py` (modified, +10/-0)
```diff
@@ -168,6 +168,11 @@ class EnvironmentConfigResponse(BaseModel):
     "MCP_CONSOLIDATION_ENABLED": "Enable dream-inspired memory consolidation",
     "MCP_CONSOLIDATION_ARCHIVE_PATH": "Path for consolidation archive",
     "MCP_DECAY_ENABLED": "Enable quality decay over time",
+    "MCP_RETENTION_DECISION": "Retention for decision memories (days)",
+    "MCP_RETENTION_LEARNING": "Retention for learning memories (days)",
+    "MCP_RETENTION_PATTERN": "Retention for pattern memories (days)",
+    "MCP_RETENTION_ERROR": "Retention for error memories (days)",
+    "MCP_RETENTION_OBSERVATION": "Retention for observation memories (days)",
     "MCP_RETENTION_CRITICAL": "Retention for critical memories (days)",
     "MCP_RETENTION_REFERENCE": "Retention for reference memories (days)",
     "MCP_RETENTION_STANDARD": "Retention for standard memories (days)",
@@ -374,6 +379,11 @@ def get_param_description(key: str) -> str:
             ("MCP_CONSOLIDATION_ENABLED", "boolean", None, False),
             ("MCP_CONSOLIDATION_ARCHIVE_PATH", "string", None, False),
             ("MCP_DECAY_ENABLED", "boolean", None, False),
+            ("MCP_RETENTION_DECISION", "integer", None, False),
+            ("MCP_RETENTION_LEARNING", "integer", None, False),
+            ("MCP_RETENTION_PATTERN", "integer", None, False),
+            ("MCP_RETENTION_ERROR", "integer", None, False),
+            ("MCP_RETENTION_OBSERVATION", "integer", None, False),
             ("MCP_RETENTION_CRITICAL", "integer", None, False),
             ("MCP_RETENTION_REFERENCE", "integer", None, False),
             ("MCP_RETENTION_STANDARD", "integer", None, False),
```

---

### Incident Patch 3: `965e4ecc` (2026-09-30)
**Commit Message**: fix(harvest): honor MCP_LOCALE in harvest, rewriter and Kiro bootstrap (#1382)

* fix(harvest): honor MCP_LOCALE in harvest, rewriter and Kiro bootstrap

Harvest, the rewriter and the Kiro bootstrap formatter read HARVEST_LOCALE
directly, so setting only MCP_LOCALE left them English-only. Route them
through get_active_locales() like NER and NLI, and build the Kiro formatter
when it is requested instead of at import time.

* fix(locale): re-read MCP_LOCALE on every get_active_locales() call

The lru_cache on get_active_locales() froze the first result, so a module that resolved the locale early (NLI does at import) made a later MCP_LOCALE change invisible to the Kiro bootstrap formatter. Read the env vars each call and cache only the parsing.

---------

Co-authored-by: Cestercian <183791452+cestercian@users.noreply.github.com>
Co-authored-by: Henry Krupp <5000709+doobidoo@users.noreply.github.com>

**File**: `.env.example` (modified, +9/-0)
```diff
@@ -462,6 +462,15 @@ MCP_HYBRID_SEMANTIC_WEIGHT=0.7
 #
 # MCP_FORGETTING_MIN_AGE_DAYS=365
 
+# =============================================================================
+# LOCALE
+# =============================================================================
+# Comma-separated locales for every locale-aware subsystem: NER, NLI, harvest
+# patterns and filters, the harvest rewriter and the Kiro bootstrap formatter.
+# HARVEST_LOCALE is the older name and is only used when MCP_LOCALE is unset.
+# Default: en
+# MCP_LOCALE=en,pt_BR
+
 # =============================================================================
 # SCHEDULED SESSION HARVEST
 # =============================================================================
```

**File**: `changelog.d/1380.fixed.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+- **Harvest, the harvest rewriter and the Kiro bootstrap ignored `MCP_LOCALE` (#1380).**
+  These read `HARVEST_LOCALE` directly, so setting only `MCP_LOCALE` gave English-only
+  harvest patterns, filters and rewriter instructions. They now go through
+  `get_active_locales()` like NER and NLI, so `MCP_LOCALE` wins and `HARVEST_LOCALE`
+  stays a fallback. The Kiro bootstrap formatter is built when it is requested
+  instead of at import time, so a locale set after import is honoured.
+  `get_active_locales()` also re-reads the env vars on every call (only the parsing is
+  cached), so a locale set after another module already resolved it is not ignored.
```

**File**: `src/mcp_memory_service/bootstrap/formatter.py` (modified, +14/-5)
```diff
@@ -3,7 +3,9 @@
 import os
 import re
 from datetime import datetime, timezone
-from typing import Dict, Optional
+from typing import Callable, Dict, Optional
+
+from ..config.locale import get_active_locales
 
 
 class BootstrapFormatter:
@@ -143,15 +145,22 @@ def format(self, avoidances: list, preferences: list,
         return "\n".join(lines)
 
 
-_FORMATTERS: Dict[str, BootstrapFormatter] = {
-    "claude": ClaudeFormatter(),
-    "kiro": KiroFormatter(locale=os.environ.get("HARVEST_LOCALE", "en").split(",")[-1]),
+def _kiro_formatter() -> KiroFormatter:
+    # Read the locale when the formatter is asked for, not at import time,
+    # so a later MCP_LOCALE / HARVEST_LOCALE change is not ignored.
+    locales = get_active_locales()
+    return KiroFormatter(locale=locales[-1] if locales else "en")
+
+
+_FORMATTERS: Dict[str, Callable[[], BootstrapFormatter]] = {
+    "claude": ClaudeFormatter,
+    "kiro": _kiro_formatter,
 }
 
 
 def get_formatter(name: str) -> BootstrapFormatter:
     """Get formatter by name. Returns claude (default) if unknown."""
-    return _FORMATTERS.get(name, _FORMATTERS["claude"])
+    return _FORMATTERS.get(name, _FORMATTERS["claude"])()
 
 
 def get_formatter_for_agent(agent_id: str) -> BootstrapFormatter:
```

**File**: `src/mcp_memory_service/config/locale.py` (modified, +15/-3)
```diff
@@ -3,8 +3,20 @@
 from functools import lru_cache
 
 
-@lru_cache(maxsize=1)
+@lru_cache(maxsize=None)
+def _parse_locales(raw: str) -> tuple[str, ...]:
+    return tuple(loc.strip() for loc in raw.split(",") if loc.strip())
+
+
 def get_active_locales() -> list[str]:
-    """Get active locales from MCP_LOCALE (fallback HARVEST_LOCALE, default 'en')."""
+    """Get active locales from MCP_LOCALE (fallback HARVEST_LOCALE, default 'en').
+
+    The env vars are read on every call, so a locale set after another module
+    already asked (NLI does at import) is still honored. Only the parsing is cached.
+    """
     raw = os.environ.get("MCP_LOCALE") or os.environ.get("HARVEST_LOCALE", "en")
-    return [loc.strip() for loc in raw.split(",") if loc.strip()]
+    return list(_parse_locales(raw))
+
+
+# Kept so existing callers/tests that reset the cache keep working.
+get_active_locales.cache_clear = _parse_locales.cache_clear  # type: ignore[attr-defined]
```

**File**: `src/mcp_memory_service/harvest/extractor.py` (modified, +5/-6)
```diff
@@ -6,6 +6,7 @@
 from typing import Dict, List, Optional, Tuple
 
 from ..compat import _sanitize_log_value
+from ..config.locale import get_active_locales
 from .models import HarvestCandidate
 from .parser import ParsedMessage
 from .patterns import load_patterns
@@ -31,9 +32,6 @@
 # Default meta filter from environment
 DEFAULT_META_FILTER = os.environ.get("HARVEST_META_FILTER", "true").lower() in ("true", "1", "yes")
 
-# Default locale from environment, fallback to English
-DEFAULT_LOCALE = os.environ.get("HARVEST_LOCALE", "en")
-
 
 def _split_sentences(text: str) -> List[str]:
     """Split text into sentences."""
@@ -83,16 +81,17 @@ class PatternExtractor:
     """Extracts harvest candidates from parsed messages using regex patterns.
 
     Supports multiple locales via pattern plugin files.
-    Set HARVEST_LOCALE env var to load additional locales (e.g., "en,pt_BR").
+    Set MCP_LOCALE (or the older HARVEST_LOCALE) to load additional locales
+    (e.g., "en,pt_BR").
     """
 
     def __init__(self, locale: str = None):
         """Initialize with locale-specific patterns.
 
         Args:
-            locale: Comma-separated locale codes. Defaults to HARVEST_LOCALE env or "en".
+            locale: Comma-separated locale codes. Defaults to MCP_LOCALE (or HARVEST_LOCALE) or "en".
         """
-        self._locale = locale or DEFAULT_LOCALE
+        self._locale = locale or ",".join(get_active_locales())
         self._patterns: Dict[str, List[Tuple[re.Pattern, float]]] = load_patterns(self._locale)
         if self._patterns:
             total = sum(len(v) for v in self._patterns.values())
```

---

### Incident Patch 4: `ea3e9861` (2026-09-29)
**Commit Message**: fix(triage-digest): count the author of an uncommented issue as last speaker (#1381)

maintainer_spoke_last() treated every issue without comments as unanswered,
so the maintainer's own trackers filled the "awaiting my reply" section.
On 2026-09-29 all six entries there were such trackers.

Refs #1359

Co-authored-by: Henry Krupp <doobidoo@noreply.codeberg.org>

**File**: `changelog.d/1359.internal.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+- **The triage digest listed the maintainer's own trackers as awaiting a reply (#1359).**
+  `maintainer_spoke_last()` in `scripts/maintenance/github_triage_digest.py` treated every
+  issue without comments as unanswered, so the "Quiet 14+ days, awaiting my reply" section
+  filled up with issues the maintainer had opened and nobody had commented on yet. On
+  2026-09-29 all six of its entries were such trackers. An uncommented issue now counts
+  its author as the last speaker; an unanswered report from anyone else is still listed.
```

**File**: `scripts/maintenance/github_triage_digest.py` (modified, +4/-2)
```diff
@@ -102,11 +102,13 @@ def maintainer_spoke_last(item: dict, get: Get) -> bool:
 
     The issue's `user` is the author, not the last commenter, so it answers a
     different question. GitHub returns comments oldest first, so read the last
-    page. An issue with no comments counts as not-spoken-to.
+    page. An issue with no comments has only its author's words on it, so the
+    author counts as the last speaker: a maintainer's own tracker is not
+    waiting on the maintainer.
     """
     count = item.get("comments", 0)
     if not count:
-        return False
+        return (item.get("user") or {}).get("login") in MAINTAINERS
     last_page = (count + PER_PAGE - 1) // PER_PAGE
     comments = get(f"/issues/{item['number']}/comments?per_page={PER_PAGE}&page={last_page}") or []
     if not comments:
```

**File**: `tests/maintenance/test_github_triage_digest.py` (modified, +9/-0)
```diff
@@ -90,6 +90,15 @@ def test_stale_uses_the_last_commenter_not_the_author(digest):
     assert "/issues/4/comments?per_page=100&page=2" in get.calls
 
 
+def test_uncommented_issue_counts_the_author_as_last_speaker(digest):
+    # A maintainer's own tracker with no comments is not waiting on the maintainer.
+    tracker = issue(5, author="doobidoo")
+    # A report nobody has answered still is.
+    report = issue(6)
+    data = digest.collect(fake_get([tracker, report], []), 14, NOW)
+    assert [i["number"] for i in data["stale"]] == [6]
+
+
 def test_lookup_cap_is_reported_not_silent(digest):
     aged = [issue(n) for n in range(1, digest.STALE_LOOKUP_CAP + 4)]
     data = digest.collect(fake_get(aged, []), 14, NOW)
```

---

### Incident Patch 5: `563a898f` (2026-09-29)
**Commit Message**: fix(sync): sanitise outside values in importer.py logging (#1146) (#1374)

* fix(logging): sanitise logger calls in sync/importer.py (#1146)

The importer reads another machine's JSON export, so the values its log
lines carry can be chosen elsewhere: the export's source_machine, the file
path handed in on the command line, and the exception in each except branch
now go through _sanitize_log_value. Counters move to %-style lazy formatting
and the placeholder-less warning becomes a plain string, so every line reads
as before. The module is listed in GUARDED_MODULES; the errors counter is
wrapped because the lazy scan matches the key by name (as web/app.py does
for its route counts).

* docs: changelog fragment for #1374

* test(guard): list json_file and source_machine in EXTERNAL_NAMES with fixing samples

The importer's per-source summary loop is renamed source_machine so the
lazy scan sees the export-supplied name by the same token everywhere in
the module.

---------

Co-authored-by: massimiliano1991 <massimiliano1991@users.noreply.github.com>

**File**: `changelog.d/1374.internal.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+- **`sync/importer.py` cleared of unsanitised logger calls (#1374, massimiliano1991; part of #1146).**
+  The importer reads another machine's JSON export, and its log lines carried 15 f-string logger
+  calls on the gate's pattern, so check 6.5 blocked every unrelated pull request touching the file.
+  Values the export or the command line bring in — the export's `source_machine`, each file's
+  path, and the exception in every `except` branch — now go through `_sanitize_log_value`; the
+  counters use `%`-style lazy formatting, so every line reads as before. The module is in
+  `GUARDED_MODULES` and the ratchet holds it.
```

**File**: `src/mcp_memory_service/sync/importer.py` (modified, +20/-16)
```diff
@@ -22,6 +22,7 @@
 from pathlib import Path
 from typing import List, Dict, Any, Set
 
+from ..compat import _sanitize_log_value
 from ..models.memory import Memory
 from ..storage.base import MemoryStorage
 
@@ -64,7 +65,7 @@ async def import_from_json(
         Returns:
             Import statistics and results
         """
-        logger.info(f"Starting import from {len(json_files)} JSON files")
+        logger.info("Starting import from %s JSON files", len(json_files))
         
         # Get existing content hashes for deduplication
         existing_hashes = await self._get_existing_hashes() if deduplicate else set()
@@ -94,24 +95,27 @@ async def import_from_json(
                 import_stats["duplicates_skipped"] += file_stats["duplicates"]
                 import_stats["sources"].update(file_stats["sources"])
                 
-                logger.info(f"Processed {json_file}: {file_stats['imported']}/{file_stats['processed']} imported")
+                logger.info(
+                    "Processed %s: %s/%s imported",
+                    _sanitize_log_value(json_file), file_stats['imported'], file_stats['processed'],
+                )
                 
             except Exception as e:
-                logger.error(f"Error processing {json_file}: {str(e)}")
+                logger.error("Error processing %s: %s", _sanitize_log_value(json_file), _sanitize_log_value(e))
                 import_stats["errors"] += 1
         
         import_stats["end_time"] = datetime.now().isoformat()
         
         # Log final summary
         logger.info("Import completed:")
-        logger.info(f"  Files processed: {import_stats['files_processed']}")
-        logger.info(f"  Total memories processed: {import_stats['total_processed']}")
-        logger.info(f"  Successfully imported: {import_stats['imported']}")
-        logger.info(f"  Duplicates skipped: {import_stats['duplicates_skipped']}")
-        logger.info(f"  Errors: {import_stats['errors']}")
+        logger.info("  Files processed: %s", import_stats['files_processed'])
+        logger.info("  Total memories processed: %s", import_stats['total_processed'])
+        logger.info("  Successfully imported: %s", import_stats['imported'])
+        logger.info("  Duplicates skipped: %s", import_stats['duplicates_skipped'])
+        logger.info("  Errors: %s", _sanitize_log_value(import_stats['errors']))
         
-        for source, stats in import_stats["sources"].items():
-            logger.info(f"  {source}: {stats['imported']}/{stats['total']} imported")
+        for source_machine, stats in import_stats["sources"].items():
+            logger.info("  %s: %s/%s imported", _sanitize_log_value(source_machine), stats['imported'], stats['total'])
         
         return import_stats
     
@@ -123,7 +127,7 @@ async def _import_single_file(
         dry_run: bool
     ) -> Dict[str, Any]:
         """Import memories from a single JSON file."""
-        logger.info(f"Processing {json_file}")
+        logger.info("Processing %s", _sanitize_log_value(json_file))
         
         # Load and validate JSON
         with open(json_file, 'r', encoding='utf-8') as f:
@@ -155,7 +159,7 @@ async def _import_single_file(
             content_hash = memory_data.get("content_hash")
             
             if not content_hash:
-                logger.warning(f"Memory missing content_hash, skipping")
+                logger.warning("Memory missing content_hash, skipping")
                 continue
             
             # Check for duplicates
@@ -180,7 +184,7 @@ async def _import_single_file(
                 file_stats["sources"][source_machine]["imported"] += 1
                 
             except Exception as e:
-                logger.error(f"Error creating memory from data: {str(e)}")
+                logger.error("Error creating memory from data: %s", _sanitize_log_value(e))
                 continue
         
         return file_stats
@@ -227,7 +231,7 @@ async d
```

**File**: `tests/unit/test_log_injection_guard.py` (modified, +29/-0)
```diff
@@ -54,6 +54,7 @@
     "mcp_memory_service/storage/mixins/migrations.py",
     "mcp_memory_service/storage/mixins/embeddings.py",
     "mcp_memory_service/discovery/mdns_service.py",
+    "mcp_memory_service/sync/importer.py",
 ]
 
 # The levels check 6.5 looks at, verbatim.
@@ -81,6 +82,13 @@
     # object name is listed rather than `name`/`url`, which are ordinary internal
     # identifiers elsewhere in the guarded modules.
     "service_details",
+    # What the importer (sync/importer.py) is handed from outside: the path of
+    # each export file passed on the command line, and the machine name the
+    # export itself declares in its metadata. The per-source summary loop is
+    # named `source_machine` for this reason; a bare `source` stays unlisted,
+    # it is an ordinary internal identifier elsewhere.
+    "json_file",
+    "source_machine",
 })
 
 # Fields of an outside object that cannot carry injectable text. An HTTP status
@@ -260,6 +268,27 @@ def test_lazy_scan_flags_mdns_service_details():
     assert not _lazy_findings('logger.info("Discovered: %s", name)\n')
 
 
+@pytest.mark.unit
+def test_lazy_scan_flags_importer_inputs():
+    """json_file and source_machine reach sync/importer.py from outside.
+
+    The path is whatever the command line passed in; the machine name is
+    read out of the export's own metadata. Every guarded logger call in the
+    importer already wraps both, so the module scan stays green whether or
+    not they are listed. These are the samples that fail if either entry is
+    dropped from EXTERNAL_NAMES; a bare `source` stays unlisted on purpose.
+    """
+    for bare, wrapped in (
+        ('logger.info("Processing %s", json_file)\n',
+         'logger.info("Processing %s", _sanitize_log_value(json_file))\n'),
+        ('logger.info("  %s: done", source_machine)\n',
+         'logger.info("  %s: done", _sanitize_log_value(source_machine))\n'),
+    ):
+        assert _lazy_findings(bare)
+        assert not _lazy_findings(wrapped)
+    assert not _lazy_findings('logger.info("  %s: done", source)\n')
+
+
 @pytest.mark.unit
 def test_detectors_agree_on_a_known_bad_sample():
     """Guards the guard: both scans must flag an obviously unsafe call.
```

---

### Incident Patch 6: `360bcc0a` (2026-09-29)
**Commit Message**: docs(readme): link SPONSORS.md again, fix PayPal link text (#1370)

* docs(readme): link SPONSORS.md again, fix PayPal link text

The sponsor badge left the README with Codeberg #129 because it pointed at
GitHub Sponsors, which has no active listing. Nothing replaced it, so the
funding options were only reachable through the repository's Sponsor button.
A short section at the end of the README now links SPONSORS.md.

SPONSORS.md displayed paypal.me/doobidoo while linking paypal.me/heinrichkrupp1,
the address FUNDING.yml also uses. The link text now matches the target.

* docs(changelog): add fragment for #1370

---------

Co-authored-by: Henry Krupp <doobidoo@noreply.codeberg.org>

**File**: `README.md` (modified, +8/-0)
```diff
@@ -263,3 +263,11 @@ cd mcp-memory-service
 pip install -e .  # Editable install
 pytest tests/      # Run test suite
 ```
+
+---
+
+## Supporting the Project
+
+MCP Memory Service is maintained by one person. If it saves you or your company time,
+you can support its development via Ko-fi, Buy Me a Coffee or PayPal:
+[SPONSORS.md](https://github.com/doobidoo/mcp-memory-service/blob/main/SPONSORS.md).
```

**File**: `SPONSORS.md` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ All development, releases, and discussions happen here:
 ### One-time Donations
 - **Ko-fi**: [ko-fi.com/doobidoo](https://ko-fi.com/doobidoo)
 - **Buy Me a Coffee**: [buymeacoffee.com/doobidoo](https://coff.ee/doobidoo)
-- **PayPal**: [paypal.me/doobidoo](https://paypal.me/heinrichkrupp1)
+- **PayPal**: [paypal.me/heinrichkrupp1](https://paypal.me/heinrichkrupp1)
 
 ### Cryptocurrency
 - **Bitcoin**: `bc1qypcx7m9jl3mkptvc3xrzyd7dywjctpxyvaajgr`
```

**File**: `changelog.d/1370.internal.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- **The README linked to no funding option since the Codeberg migration (#1370).**
+  The sponsor badge was removed in Codeberg #129 because GitHub Sponsors has no active
+  listing, and nothing replaced it. A short section at the end of the README now links
+  SPONSORS.md. SPONSORS.md also displayed `paypal.me/doobidoo` while linking
+  `paypal.me/heinrichkrupp1`; the link text now matches the target.
```

---

### Incident Patch 7: `d0b856bb` (2026-09-29)
**Commit Message**: fix(discovery): sanitise outside values in mdns_service.py logging (#1146) (#1369)

* fix(discovery): sanitise outside values in mdns_service logging (#1146)

Wrap the mDNS-announced service name/url and the exception in each
except branch in _sanitize_log_value; move the configured name/type,
local IP, port and service count to %-style lazy formatting; list the
module in GUARDED_MODULES so the guard test holds it at zero.

* docs: changelog fragment for #1369

* test(guard): list service_details in EXTERNAL_NAMES with a fixing sample

Greptile on #1369: listing the module does not make the lazy scan see a
future bare service_details.name. The object name is listed rather than
name/url, which are ordinary internal identifiers in the guarded modules.

---------

Co-authored-by: massimiliano1991 <massimiliano1991@users.noreply.github.com>
Co-authored-by: Henry Krupp <5000709+doobidoo@users.noreply.github.com>

**File**: `changelog.d/1369.internal.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+- **`discovery/mdns_service.py` cleared of unsanitised logger calls (#1369, massimiliano1991; part of #1146).**
+  The mDNS module carried 16 f-string logger calls on the gate's pattern, so check 6.5 blocked
+  every unrelated pull request touching the file. Values that arrive over the network — the
+  service name another host announces, the name and URL parsed out of its `ServiceInfo`, and the
+  exception in each `except` branch — now go through `_sanitize_log_value`; the configured
+  service name and type, the local IP, the port and the discovered-service count use `%`-style
+  lazy formatting, so every log line reads as before. The module is in `GUARDED_MODULES` and the
+  ratchet holds it.
```

**File**: `src/mcp_memory_service/discovery/mdns_service.py` (modified, +17/-16)
```diff
@@ -27,6 +27,7 @@
 from zeroconf import Zeroconf, ServiceInfo, ServiceListener
 from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser
 
+from ..compat import _sanitize_log_value
 from ..config import (
     MDNS_SERVICE_NAME,
     MDNS_SERVICE_TYPE,
@@ -126,7 +127,7 @@ def _create_service_info(self) -> ServiceInfo:
             server=f"{self.service_name.replace(' ', '-').lower()}.local."
         )
         
-        logger.info(f"Created service info: {full_service_name} at {local_ip}:{self.port}")
+        logger.info("Created service info: %s at %s:%s", full_service_name, local_ip, self.port)
         return service_info
     
     async def start(self) -> bool:
@@ -142,11 +143,11 @@ async def start(self) -> bool:
             await self._zeroconf.async_register_service(self._service_info)
             self._registered = True
             
-            logger.info(f"mDNS service advertisement started for {self.service_name}")
+            logger.info("mDNS service advertisement started for %s", self.service_name)
             return True
             
         except Exception as e:
-            logger.error(f"Failed to start mDNS service advertisement: {e}")
+            logger.error("Failed to start mDNS service advertisement: %s", _sanitize_log_value(e))
             return False
     
     async def stop(self) -> None:
@@ -163,10 +164,10 @@ async def stop(self) -> None:
             self._zeroconf = None
             self._service_info = None
             
-            logger.info(f"mDNS service advertisement stopped for {self.service_name}")
+            logger.info("mDNS service advertisement stopped for %s", self.service_name)
             
         except Exception as e:
-            logger.error(f"Error stopping mDNS service advertisement: {e}")
+            logger.error("Error stopping mDNS service advertisement: %s", _sanitize_log_value(e))
     
     def __del__(self):
         """Cleanup on deletion."""
@@ -190,19 +191,19 @@ def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                 service_details = self._parse_service_info(info)
                 self.services[name] = service_details
                 
-                logger.info(f"Discovered MCP Memory Service: {service_details.name} at {service_details.url}")
+                logger.info("Discovered MCP Memory Service: %s at %s", _sanitize_log_value(service_details.name), _sanitize_log_value(service_details.url))
                 
                 if self.callback:
                     self.callback(service_details)
                     
             except Exception as e:
-                logger.error(f"Error parsing discovered service {name}: {e}")
+                logger.error("Error parsing discovered service %s: %s", _sanitize_log_value(name), _sanitize_log_value(e))
     
     def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
         """Called when a service is removed."""
         if name in self.services:
             service_details = self.services.pop(name)
-            logger.info(f"MCP Memory Service removed: {service_details.name}")
+            logger.info("MCP Memory Service removed: %s", _sanitize_log_value(service_details.name))
     
     def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
         """Called when a service is updated."""
@@ -212,13 +213,13 @@ def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                 service_details = self._parse_service_info(info)
                 self.services[name] = service_details
                 
-                logger.info(f"MCP Memory Service updated: {service_details.name}")
+                logger.info("MCP Memory Service updated: %s", _sanitize_log_value(service_details.name))
                 
                 if self.callback:
                     self.callback(service_details)
                     
             except Exception as e:
-                logger.error(f"Error parsing update
```

**File**: `tests/unit/test_log_injection_guard.py` (modified, +22/-0)
```diff
@@ -53,6 +53,7 @@
     "mcp_memory_service/storage/graph.py",
     "mcp_memory_service/storage/mixins/migrations.py",
     "mcp_memory_service/storage/mixins/embeddings.py",
+    "mcp_memory_service/discovery/mdns_service.py",
 ]
 
 # The levels check 6.5 looks at, verbatim.
@@ -75,6 +76,11 @@
     # guarded logger call (storage/graph.py) is already wrapped; listing the
     # name keeps a later unwrap from passing the ratchet green.
     "max_hops",
+    # The ServiceDetails a mDNS listener builds from another host's announcement
+    # (discovery/mdns_service.py): its name and url are chosen by that host. The
+    # object name is listed rather than `name`/`url`, which are ordinary internal
+    # identifiers elsewhere in the guarded modules.
+    "service_details",
 })
 
 # Fields of an outside object that cannot carry injectable text. An HTTP status
@@ -238,6 +244,22 @@ def test_lazy_scan_flags_caller_controlled_max_hops():
     assert not _lazy_findings(wrapped)
 
 
+@pytest.mark.unit
+def test_lazy_scan_flags_mdns_service_details():
+    """service_details is parsed from a mDNS announcement made by another host.
+
+    Every guarded logger call in discovery/mdns_service.py already wraps its
+    fields, so the module scan stays green whether or not the object is
+    listed. This is the sample that fails if the entry is dropped from
+    EXTERNAL_NAMES; a bare `name` stays unlisted on purpose.
+    """
+    bare = 'logger.info("Discovered: %s", service_details.name)\n'
+    wrapped = 'logger.info("Discovered: %s", _sanitize_log_value(service_details.name))\n'
+    assert _lazy_findings(bare)
+    assert not _lazy_findings(wrapped)
+    assert not _lazy_findings('logger.info("Discovered: %s", name)\n')
+
+
 @pytest.mark.unit
 def test_detectors_agree_on_a_known_bad_sample():
     """Guards the guard: both scans must flag an obviously unsafe call.
```

---

### Incident Patch 8: `83b14ddd` (2026-09-29)
**Commit Message**: fix(storage): sqlite_vec embedding cache uses bounded LRU with stable keys (#1099) (#1367)

* fix(storage): sqlite_vec embedding cache uses bounded LRU with stable keys (#1099)

* docs(changelog): rename fragment to PR number (#1367)

* fix(storage): address Greptile review on #1367 — provider-scoped cache key, test import, LRU recency test

* fix(storage): address Greptile round 2 on #1367 — reserved hash-fallback namespace + explicit model-name segregation test

* fix(storage): recognize __hash_fallback__ namespace in cache lookup, preserving dimension isolation (#1367 Greptile)

* test(storage): fallback dimension isolation uses real 512-d vector and asserts lengths (#1367 Greptile P2)

**File**: `changelog.d/1367.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Fixed sqlite_vec embedding cache to use bounded LRU shared cache with stable `{model}::{text}` keys instead of unbounded local dict with collision-prone `hash(text)` keys (#1099, PR #1367)
\ No newline at end of file
```

**File**: `src/mcp_memory_service/storage/mixins/embeddings.py` (modified, +52/-9)
```diff
@@ -18,13 +18,13 @@
 
 from ...compat import _sanitize_log_value
 from ...utils.system_detection import get_torch_device
+from ..shared import _embedding_cache_get, _embedding_cache_put, _embedding_cache_size, _embedding_cache_clear
 
 logger = logging.getLogger(__name__)
 
 # Module-level caches
 _MODEL_CACHE = {}
 _DIMENSION_CACHE = {}
-_EMBEDDING_CACHE = {}
 
 # Module-level flag: emit hash-fallback warning only once per process
 _HASH_FALLBACK_WARNED = False
@@ -34,14 +34,13 @@ def clear_model_caches() -> dict:
     """Clear embedding model caches to free memory."""
     import gc  # inline import: only needed by this cache-clearing helper
 
-    global _MODEL_CACHE, _EMBEDDING_CACHE, _DIMENSION_CACHE
+    global _MODEL_CACHE, _DIMENSION_CACHE
 
     model_count = len(_MODEL_CACHE)
-    embedding_count = len(_EMBEDDING_CACHE)
+    embedding_count = _embedding_cache_clear()
 
     _MODEL_CACHE.clear()
     _DIMENSION_CACHE.clear()
-    _EMBEDDING_CACHE.clear()
 
     collected = gc.collect()
 
@@ -62,7 +61,7 @@ def get_model_cache_stats() -> dict:
     return {
         "model_count": len(_MODEL_CACHE),
         "model_keys": list(_MODEL_CACHE.keys()),
-        "embedding_count": len(_EMBEDDING_CACHE)
+        "embedding_count": _embedding_cache_size()
     }
 
 
@@ -167,6 +166,8 @@ async def _initialize_embedding_model(self):
                         # name only on a cold start would leave health reporting
                         # wrong almost everywhere.
                         self.embedding_model_name = external_model_name
+                        # Set embedding cache namespace to distinguish different external endpoints
+                        self._embedding_cache_namespace = cache_key
                         if cache_key in _DIMENSION_CACHE:
                             self.embedding_dimension = _DIMENSION_CACHE[cache_key]
                         elif hasattr(self.embedding_model, 'embedding_dimension'):
@@ -181,6 +182,8 @@ async def _initialize_embedding_model(self):
                     # default, and every health surface that reads it reports a
                     # model that is not the one producing the vectors (#254).
                     self.embedding_model_name = external_model_name
+                    # Set embedding cache namespace to distinguish different external endpoints
+                    self._embedding_cache_namespace = cache_key
                     self.embedding_dimension = ext_model.embedding_dimension
                     _MODEL_CACHE[cache_key] = ext_model
                     _DIMENSION_CACHE[cache_key] = self.embedding_dimension
@@ -221,6 +224,8 @@ async def _initialize_embedding_model(self):
                     cache_key = f"onnx_{self.embedding_model_name}"
                     if _onnx_ok and cache_key in _MODEL_CACHE:
                         self.embedding_model = _MODEL_CACHE[cache_key]
+                        # Set embedding cache namespace for ONNX models
+                        self._embedding_cache_namespace = cache_key
                         if cache_key in _DIMENSION_CACHE:
                             self.embedding_dimension = _DIMENSION_CACHE[cache_key]
                         elif hasattr(self.embedding_model, 'embedding_dimension'):
@@ -246,6 +251,8 @@ async def _initialize_embedding_model(self):
                                 _sanitize_log_value(self.embedding_model_name), onnx_model.embedding_dimension,
                             )
                         self.embedding_model = onnx_model
+                        # Set embedding cache namespace for ONNX models
+                        self._embedding_cache_namespace = cache_key
                         self.embedding_dimension = onnx_model.embedding_dimension
                         _MODEL_CACHE[cache_key] = onnx_model
                         _DIMENSION_CACHE[cache_key] = self.embedding_dimension
@@ -281,6 +288,8 @@ async def _initialize_embedding_model(self):
             cache_key = self.embeddin
```

**File**: `src/mcp_memory_service/storage/shared.py` (modified, +8/-0)
```diff
@@ -47,6 +47,14 @@ def _embedding_cache_size() -> int:
         return len(_EMBEDDING_CACHE)
 
 
+def _embedding_cache_clear() -> int:
+    """Clear all entries from the shared embedding cache, returning count cleared."""
+    with _EMBEDDING_CACHE_LOCK:
+        cleared_count = len(_EMBEDDING_CACHE)
+        _EMBEDDING_CACHE.clear()
+        return cleared_count
+
+
 # ---------------------------------------------------------------------------
 # String / sanitisation helpers
 # ---------------------------------------------------------------------------
```

**File**: `src/mcp_memory_service/storage/sqlite_vec.py` (modified, +0/-1)
```diff
@@ -38,7 +38,6 @@
     _HashEmbeddingModel,
     _MODEL_CACHE,
     _DIMENSION_CACHE,
-    _EMBEDDING_CACHE,
     SENTENCE_TRANSFORMERS_AVAILABLE,
 )
 
```

**File**: `tests/conftest.py` (modified, +4/-3)
```diff
@@ -112,16 +112,17 @@ def _clear_embedding_caches():
     """Reset embedding caches after each test for isolation."""
     import mcp_memory_service.storage.mixins.embeddings as emb_mod
     from mcp_memory_service.storage.mixins.embeddings import (
-        _MODEL_CACHE, _DIMENSION_CACHE, _EMBEDDING_CACHE
+        _MODEL_CACHE, _DIMENSION_CACHE
     )
+    from mcp_memory_service.storage.shared import _embedding_cache_clear
     # SETUP: only reset warning flag (allow model reuse like main)
     emb_mod._HASH_FALLBACK_WARNED = False
-    _EMBEDDING_CACHE.clear()
+    _embedding_cache_clear()
     yield
     # TEARDOWN: full cleanup (prevent ONNX/ST leak to next test)
     _MODEL_CACHE.clear()
     _DIMENSION_CACHE.clear()
-    _EMBEDDING_CACHE.clear()
+    _embedding_cache_clear()
     emb_mod._HASH_FALLBACK_WARNED = False
 
 
```

---

### Incident Patch 9: `1e7a12d2` (2026-09-28)
**Commit Message**: fix(harvest): parse the current Kiro CLI payload-wrapped session format (#1346) (#1366)

* fix(harvest): parse the current Kiro CLI payload-wrapped session format (#1346)

The transcript parser detects format by top-level keys (traceSchema/type/kind).
Current Kiro CLI sessions wrap everything under {id, timestamp, payload:{type, content}},
so none matched and every session was dropped as 'Unknown session format' — the harvest
saw zero messages from the current on-disk format.

Add a 'kiro-cli-v4' format: detected when payload is a dict carrying its own type, parsed
by _parse_kiro_v4_line. user/assistant map to roles by payload.type; tool_result is kept
as rich assistant content (the design/analytical data #1346 wants); tool_call and session
metadata are counted in the Phase 0 coverage instrument (#1287) but not extracted. The
three existing parsers (claude/kiro-legacy/openclaw) are untouched.

Regression test drives a payload-wrapped fixture through parse_file and asserts the old
formats still parse. On a real session the parser went from 0 to hundreds of messages,
with coverage_report() now showing user/assistant/tool_result extracted and the metadata
kinds seen+dropped.

* chore(

**File**: `changelog.d/1366.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Add support for Kiro CLI v4 payload-wrapped format in TranscriptParser. The new format uses `{"payload": {"type": "...", "content": "..."}}` structure instead of top-level `type`/`kind` keys. Enables harvesting from current Kiro CLI sessions that were previously skipped as "Unknown session format" (#1346).
\ No newline at end of file
```

**File**: `src/mcp_memory_service/harvest/parser.py` (modified, +76/-7)
```diff
@@ -24,13 +24,15 @@ class TranscriptParser:
     Format is detected from the first message in the file:
     - If "traceSchema" is "openclaw-trajectory" → OpenClaw gateway format
     - If "type" key exists → Claude Code format
-    - If "kind" key exists → Kiro CLI format
+    - If "kind" key exists → Kiro CLI format (legacy)
+    - If "payload" with "type" exists → Kiro CLI v4 format (payload-wrapped)
     - Unknown → warning logged, returns empty
     """
 
     RELEVANT_TYPES = {"user", "assistant"}
     KIRO_KIND_MAP = {"Prompt": "user", "Response": "assistant", "AssistantMessage": "assistant"}
     OPENCLAW_MESSAGE_TYPES = {"prompt.submitted", "model.completed"}
+    PAYLOAD_ROLE_MAP = {"user": "user", "assistant": "assistant"}
 
     # --- Phase 0 coverage instrument (#1287) -------------------------------
     # Counts, per block kind/type, how many were seen vs extracted vs dropped,
@@ -134,6 +136,8 @@ def parse_file(self, filepath: Path) -> List[ParsedMessage]:
                         format_detected = "claude"
                     elif "kind" in obj:
                         format_detected = "kiro"
+                    elif isinstance(obj.get("payload"), dict) and "type" in obj["payload"]:
+                        format_detected = "kiro-cli-v4"
                     else:
                         logger.warning(f"Unknown session format in {filepath.name}, skipping")
                         return messages
@@ -142,6 +146,8 @@ def parse_file(self, filepath: Path) -> List[ParsedMessage]:
                     msgs = self._parse_claude_line(obj)
                 elif format_detected == "kiro":
                     msgs = self._parse_kiro_line(obj)
+                elif format_detected == "kiro-cli-v4":
+                    msgs = self._parse_kiro_v4_line(obj)
                 elif format_detected == "openclaw":
                     msgs = self._parse_openclaw_line(obj)
                 else:
@@ -213,6 +219,59 @@ def _parse_kiro_line(self, obj: dict) -> List[ParsedMessage]:
                 self._record_coverage(block_kind, was_extracted=False)
         return results
 
+    def _parse_kiro_v4_line(self, obj: dict) -> List[ParsedMessage]:
+        """Parse a single Kiro CLI v4 (payload-wrapped) JSONL line.
+        
+        Format: {"id": "...", "timestamp": "...", "payload": {"type": "...", "content": "...", ...}}
+        """
+        pl = obj.get("payload")
+        # Guard against malformed records: a valid JSON line whose payload is null
+        # or not an object, or whose type is unhashable (list/dict), must not abort
+        # the whole run — record it as an unparseable block and move on.
+        if not isinstance(pl, dict):
+            self._record_coverage("kiro-cli-v4:invalid-payload", was_extracted=False)
+            return []
+        ptype = pl.get("type")
+        if not isinstance(ptype, (str, type(None))):
+            self._record_coverage("kiro-cli-v4:invalid-type", was_extracted=False)
+            return []
+        ts = obj.get("timestamp")
+        uid = obj.get("id")
+        
+        # Handle user/assistant messages
+        if ptype in self.PAYLOAD_ROLE_MAP:
+            role = self.PAYLOAD_ROLE_MAP[ptype]
+            content = pl.get("content")
+            if isinstance(content, str) and content.strip() and not self._is_system_content(content):
+                self._record_coverage(ptype, was_extracted=True)
+                return [ParsedMessage(role=role, text=content.strip(), timestamp=ts, uuid=uid)]
+            else:
+                self._record_coverage(ptype, was_extracted=False)
+                return []
+        
+        # Handle tool_result as assistant message with rich content.
+        # Reject injected markers (system-reminder / command / ide) so an injected
+        # payload inside a tool result cannot become a harvested memory — but do NOT
+        # apply the >10k length cutoff that _is_system_content uses: a long tool
+        # result is exactly the rich analy
```

**File**: `tests/storage/test_kiro_cli_v4_parser.py` (added, +430/-0)
```diff
@@ -0,0 +1,430 @@
+"""Tests for Kiro CLI v4 (payload-wrapped) parser support.
+
+These tests ensure the TranscriptParser can handle the new kiro-cli-v4 format
+where messages have the structure:
+{"id": "...", "timestamp": "...", "payload": {"type": "...", "content": "...", ...}}
+
+The new format differs from legacy formats:
+- Legacy Claude: {"type": "...", "message": {...}} (type at top level)
+- Legacy Kiro: {"kind": "...", "data": {...}} (kind at top level)  
+- New Kiro CLI v4: {"payload": {"type": "..."}} (type inside payload)
+"""
+
+import json
+import pytest
+from pathlib import Path
+from mcp_memory_service.harvest.parser import TranscriptParser, ParsedMessage
+
+
+@pytest.fixture
+def kiro_v4_messages_file(tmp_path):
+    """Create a messages.jsonl file with kiro-cli-v4 payload-wrapped format."""
+    messages = [
+        {
+            "id": "msg-001-user",
+            "timestamp": "2026-01-01T10:00:00Z",
+            "payload": {
+                "type": "user",
+                "content": "Hello, can you help me with Python?",
+                "images": [],
+                "documents": [],
+                "_meta": {"source": "cli"}
+            }
+        },
+        {
+            "id": "msg-002-assistant", 
+            "timestamp": "2026-01-01T10:00:05Z",
+            "payload": {
+                "type": "assistant",
+                "content": "Of course! I'd be happy to help you with Python programming.",
+                "operationType": "text_generation",
+                "executionId": "exec-001",
+                "_meta": {"model": "claude-3"}
+            }
+        },
+        {
+            "id": "msg-003-tool-call",
+            "timestamp": "2026-01-01T10:00:10Z", 
+            "payload": {
+                "type": "tool_call",
+                "toolName": "code_execution",
+                "args": {"language": "python", "code": "print('hello')"},
+                "actionType": "execute",
+                "status": "pending",
+                "toolCallId": "tc-001"
+            }
+        },
+        {
+            "id": "msg-004-tool-result",
+            "timestamp": "2026-01-01T10:00:12Z",
+            "payload": {
+                "type": "tool_result", 
+                "content": "hello\n",
+                "success": True,
+                "durationMs": 150,
+                "toolCallId": "tc-001",
+                "executionId": "exec-001"
+            }
+        },
+        {
+            "id": "msg-005-metadata",
+            "timestamp": "2026-01-01T10:00:15Z",
+            "payload": {
+                "type": "session_metadata",
+                "sessionId": "sess-001",
+                "metadata": {"version": "4.0.0"}
+            }
+        },
+        {
+            "id": "msg-006-user-empty",
+            "timestamp": "2026-01-01T10:00:20Z",
+            "payload": {
+                "type": "user",
+                "content": "",  # Empty content should be filtered out
+                "_meta": {}
+            }
+        },
+        {
+            "id": "msg-007-tool-result-rich",
+            "timestamp": "2026-01-01T10:00:25Z",
+            "payload": {
+                "type": "tool_result",
+                "content": '{"status": "success", "files_created": ["test.py"], "output": "File created successfully"}',
+                "success": True,
+                "durationMs": 500,
+                "toolCallId": "tc-002"
+            }
+        }
+    ]
+    
+    jsonl_file = tmp_path / "messages.jsonl"
+    with open(jsonl_file, 'w') as f:
+        for msg in messages:
+            f.write(json.dumps(msg) + '\n')
+    
+    return jsonl_file
+
+
+@pytest.fixture
+def claude_format_file(tmp_path):
+    """Create a messages.jsonl file with legacy Claude format (type at top level)."""
+    messages = [
+        {
+            "type": "user",
+            "timestamp": "2026-01-01T09:00:00Z",
+            "uuid": "claude-user-001",
+            "message": {
+                "co
```

---

### Incident Patch 10: `8803ca22` (2026-09-28)
**Commit Message**: fix(health): run SQLite health checks under the connection lock (#1363) (#1365)

* fix(health): run SQLite health checks under the connection lock (#1363)

The SQLite and Hybrid health checkers read storage.conn directly from the async
handler, off the event loop and outside _conn_lock. This both blocks the loop on a
large store (full-table counts joined against vec0) and can observe a half-written
store between the memory and embedding INSERTs, reporting a false missing_embeddings=1
that #1237 then surfaces as degraded.

Route each checker's SQLite work as one closure through _run_in_thread (padrão #1344):
_collect_sqlite_stats / _collect_hybrid_sqlite_stats gather all queries + the
embedding-integrity check under a single lock acquisition, off the loop. Non-SQLite
work (Cloudflare status, file size, model check) stays out of the closure. Stats keys
and messages unchanged; CloudflareHealthChecker untouched.

Regression test follows test_error_rollback_waits_for_connection_lock: hold _conn_lock
from a worker thread, start the health check, assert it waits.

* chore(changelog): fragment as markdown list item (CI gate)

* fix(health): exclude soft-deleted tombstones from the memory c

**File**: `changelog.d/1363.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Health checks (`memory_health`, hybrid) now run their SQLite work through `_run_in_thread`, so it holds `_conn_lock` and stays off the event loop. Fixes a false `missing_embeddings` reading against an in-flight store and an event-loop stall on large databases (#1363).
```

**File**: `src/mcp_memory_service/utils/health_check.py` (modified, +126/-68)
```diff
@@ -22,7 +22,7 @@
 import os
 import logging
 from abc import ABC, abstractmethod
-from typing import Tuple, Dict, Any
+from typing import Tuple, Dict, Any, Callable
 
 from ..config import SQLITE_VEC_PATH
 
@@ -94,6 +94,109 @@ def _apply_embedding_integrity(conn: Any, stats: Dict[str, Any]) -> None:
         stats["integrity_hint"] = " ".join(hints)
 
 
+def _collect_sqlite_stats(conn: Any, storage: Any) -> Dict[str, Any]:
+    """Collect all SQLite statistics in a single pass (for use within _run_in_thread).
+    
+    This helper performs all SQLite queries atomically within one lock acquisition.
+    Raises LookupError if required tables are missing.
+    """
+    try:
+        # Check for required tables
+        cursor = conn.execute(
+            "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'"
+        )
+        if not cursor.fetchone():
+            raise LookupError("SQLite database is missing required 'memories' table")
+
+        # Count live memories (repo rule: exclude soft-deleted tombstones so the
+        # health count matches the live memory count, not the physical row count).
+        cursor = conn.execute('SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL')
+        memory_count = cursor.fetchone()[0]
+
+        # Check if embedding tables exist
+        cursor = conn.execute(
+            "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'"
+        )
+        has_embeddings = cursor.fetchone() is not None
+
+        # Collect stats
+        stats = {
+            "status": "healthy",
+            "backend": "sqlite-vec",
+            "total_memories": memory_count,
+            "has_embedding_tables": has_embeddings,
+        }
+
+        # Apply embedding integrity check if we have embeddings
+        if has_embeddings:
+            _apply_embedding_integrity(conn, stats)
+
+        return stats
+
+    except Exception as e:
+        if "no such table" in str(e).lower():
+            raise LookupError(f"Required table missing: {e}")
+        raise
+
+
+def _collect_hybrid_sqlite_stats(conn: Any) -> Dict[str, Any]:
+    """Collect SQLite-specific statistics for hybrid storage (for use within _run_in_thread).
+    
+    This is the SQLite-only portion of hybrid health checks.
+    Raises LookupError if required tables are missing.
+    """
+    try:
+        # Check for required tables
+        cursor = conn.execute(
+            "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'"
+        )
+        if not cursor.fetchone():
+            raise LookupError("SQLite database is missing required 'memories' table")
+
+        # Count live memories (repo rule: exclude soft-deleted tombstones so the
+        # health count matches the live memory count, not the physical row count).
+        cursor = conn.execute('SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL')
+        memory_count = cursor.fetchone()[0]
+
+        # Check if embedding tables exist
+        cursor = conn.execute(
+            "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'"
+        )
+        has_embeddings = cursor.fetchone() is not None
+
+        # Collect stats (note: hybrid uses 'has_embeddings', not 'has_embedding_tables')
+        stats = {
+            "status": "healthy",
+            "backend": "hybrid", 
+            "total_memories": memory_count,
+            "has_embeddings": has_embeddings,
+        }
+
+        # Apply embedding integrity check if we have embeddings
+        if has_embeddings:
+            _apply_embedding_integrity(conn, stats)
+
+        return stats
+
+    except Exception as e:
+        if "no such table" in str(e).lower():
+            raise LookupError(f"Required table missing: {e}")
+        raise
+
+
+async def _run_locked(storage: Any, operation: Callable, *args) -> Any:
+    """Run operation through storage._run_in_thread if available, otherwise fallback direct.
+    
+    This provide
```

**File**: `tests/storage/test_health_check_lock.py` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+"""Tests for health checker connection lock compliance (#1363)."""
+
+import asyncio
+import os
+import threading
+from typing import Any, Dict
+
+import pytest
+import pytest_asyncio
+
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.utils.health_check import SqliteHealthChecker, HybridHealthChecker, _collect_sqlite_stats
+
+
+@pytest_asyncio.fixture
+async def storage(temp_db_path):
+    """Empty SQLite storage for health check testing."""
+    storage = SqliteVecMemoryStorage(os.path.join(temp_db_path, "health.db"))
+    await storage.initialize()
+    yield storage
+    await storage.close()
+
+
+@pytest.mark.asyncio
+async def test_sqlite_health_checker_waits_for_connection_lock(storage):
+    """SqliteHealthChecker must wait for _conn_lock before reading the database."""
+    lock_held = threading.Event()
+    release_lock = threading.Event()
+
+    def hold_connection_lock():
+        with storage._conn_lock:
+            lock_held.set()
+            assert release_lock.wait(timeout=2)
+
+    # Hold the connection lock from a worker thread
+    holder = threading.Thread(target=hold_connection_lock)
+    holder.start()
+    assert await asyncio.to_thread(lock_held.wait, 1)
+
+    # Start health check as async task
+    checker = SqliteHealthChecker()
+    health_task = asyncio.create_task(checker.check_health(storage))
+    
+    # Health check should be blocked waiting for the lock
+    await asyncio.sleep(0.05)
+    assert not health_task.done(), "health check bypassed the connection lock"
+
+    # Release lock and verify success
+    release_lock.set()
+    is_valid, message, stats = await asyncio.wait_for(health_task, timeout=2)
+    holder.join(timeout=2)
+    assert not holder.is_alive()
+    
+    # Verify correct health check results
+    assert is_valid is True
+    assert "validation successful" in message
+    assert stats["total_memories"] == 0
+    assert stats["backend"] == "sqlite-vec"
+
+
+@pytest.mark.asyncio
+async def test_sqlite_health_checker_uses_run_in_thread(storage, monkeypatch):
+    """SqliteHealthChecker must route SQLite work through _run_in_thread."""
+    run_in_thread_calls = []
+
+    async def record_run_in_thread(operation, *args):
+        run_in_thread_calls.append((operation, args))
+        # Call the original _run_in_thread to complete the health check
+        return await storage.__class__._run_in_thread(storage, operation, *args)
+
+    monkeypatch.setattr(storage, "_run_in_thread", record_run_in_thread)
+
+    checker = SqliteHealthChecker()
+    is_valid, message, stats = await checker.check_health(storage)
+
+    # Verify health check succeeded
+    assert is_valid is True
+    assert stats["backend"] == "sqlite-vec"
+    
+    # Verify that _run_in_thread was called for SQLite operations
+    assert len(run_in_thread_calls) > 0, "health check did not use _run_in_thread"
+    
+    # At least one call should be for the stats collection
+    operation_names = [call[0].__name__ if callable(call[0]) else str(call[0]) for call in run_in_thread_calls]
+    assert any("collect" in name.lower() for name in operation_names), f"Expected stats collection call, got: {operation_names}"
+
+
+@pytest.mark.asyncio
+async def test_hybrid_health_checker_waits_for_connection_lock(storage):
+    """HybridHealthChecker must wait for primary storage _conn_lock."""
+    # Create a mock hybrid storage with the test SQLite storage as primary
+    class MockHybridStorage:
+        def __init__(self, primary_storage):
+            self.primary = primary_storage
+            self.secondary = None
+            self.sync_service = None
+
+    hybrid_storage = MockHybridStorage(storage)
+    
+    lock_held = threading.Event()
+    release_lock = threading.Event()
+
+    def hold_connection_lock():
+        with storage._conn_lock:
+            lock_held.set()
+            assert release_lock.wait(timeout=2)
+
+    # Hold the connection 
```

#### Recent Merged Pull Requests:
- **PR #1389** (closed): fix(consolidation): align retention_periods with memory_type ontology (@Anshieee)
- **PR #1388** (2026-09-30): chore(deps): bump the npm_and_yarn group across 2 directories with 1 update (@dependabot[bot])
- **PR #1387** (2026-09-30): chore(deps): bump pyjwt from 2.13.0 to 2.14.0 (@dependabot[bot])
- **PR #1386** (2026-09-30): chore(deps): bump the uv group with 3 updates (@dependabot[bot])
- **PR #1385** (2026-09-30): chore(deps): bump the actions group with 2 updates (@dependabot[bot])
- **PR #1384** (2026-09-29): docs(claude-md): hold maintainers and agents to CONTRIBUTING.md (@doobidoo)
- **PR #1383** (2026-09-29): docs(contributing): claim issues first, resolve all review threads (@doobidoo)
- **PR #1382** (2026-09-30): fix(harvest): honor MCP_LOCALE in harvest, rewriter and Kiro bootstrap (@cestercian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
