> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `5a8e9037`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T00:25:35.032Z  
> **Learning ID**: `learn-github-doobidoo-mcp-memory-service`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): doobidoo/mcp-memory-service

> **Canonical Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T00:25:35.023Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2023 stars

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
            input = JSON.parse(stdinData);
        } catch {
            // No valid input, might be empty
            if (config.autoCapture.debugMode) {
                console.log('[auto-capture] No valid stdin input');
            }
            process.exit(0);
        }

        // Extract transcript path and cwd
        const transcriptPath = input.transcript_path || input.transcriptPath;
        const cwd = input.cwd || process.cwd();

        if (!transcriptPath) {
            if (config.autoCapture.debugMode) {
                console.log('[auto-capture] No transcript path provided');
            }
            process.exit(0);
        }

        // Parse transcript
        const transcript = await parseTranscript(transcriptPath);
        if (!transcript) {
            process.exit(0);
        }

        // Check user overrides
        const overrides = hasUserOverride(transcript.userMessage);

        if (overrides.forceSkip) {
            if (config.autoCapture.debugMode) {
                console.log('[auto-capture] Skipped by user override (#skip)');
            }
            process.exit(0);
        }

        const content = transcript.combined;

        // Detect patterns (unless force remember)
        let detection;
        if (overrides.forceRemember) {
            detection = {
                isValuable: true,
                // Canonical ontology type; 'Context' was coerced away on store (#177)
                memoryType: 'note',
                matchedPattern: 'user-override',
                confidence: 1.0
            };
            if (config.autoCapture.debugMode) {
                console.log('[auto-capture] Force remember by user override (#remember)');
            }
        } else {
            detection = detectPatterns(content, {
                minLength: config.autoCapture.minLength,
                enabledPatterns: config.autoCapture.patterns,
                debugMode: config.autoCapture.debugMode
            });
        }

        if 
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
        const errorMessage = `## ❌ Memory Retrieval Error\n\n${error.message}\n\nCheck your memory service configuration and connection.`;
        
        if (context.displayResult) {
            await context.displayResult(errorMessage);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Hook metadata for Claude Code
 */
module.exports = {
    name: 'on-demand-memory-retrieval',
    version: '1.0.0',
    description: 'Retrieve relevant memories on user request',
    trigger: 'manual', // This hook is triggered manually
    handler: retrieveMemories,
    config: {
        async: true,
        timeout: 10000,
        priority: 'normal'
    },
    // Exported for testing
    _internal: {
        queryMemoryService
    }
};

// Direct execution support for testing
if (require.main === module) {
    // Test the retrieval with mock context
    const mockContext = {
        workingDirectory: process.cwd(),
        query: 'architecture decisions',
        displayResult: async (message) => {
            console.log('=== MOCK DISPLAY RESULT ===');
            console.log(message);
            console.log('=== END MOCK DISPLAY ===');
        }
    };
    
    retrieveMemories(mockContext)
        .then(result => console.log('Retrieval test completed:', result))
        .catch(error => console.error('Retrieval test failed:', error));
}
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
        const reasons = [];

        // Weight pattern detection heavily for explicit requests
        if (patternResults.triggerRecommendation) {
            confidence += patternResults.confidence * this.TRIGGER_WEIGHTS.PATTERN_CONFIDENCE;
            reasons.push(`Pattern detection: ${patternResults.confidence.toFixed(2)} confidence`);
        }

        // Add conversation context weighting
        if (conversationAnalysis.triggerProbability > this.THRESHOLD_VALUES.CONVERSATION_PROBABILITY_MIN) {
            confidence += conversationAnalysis.triggerProbability * this.TRIGGER_WEIGHTS.CONVERSATION_CONTEXT;
            reasons.push(`Conversation analysis: ${conversationAnalysis.triggerProbability.toFixed(2)} probability`);
        }

        // Boost for semantic shift (topic change)
        if (conversationAnalysis.semanticShift > this.THRESHOLD_VALUES.SEMANTIC_SHIFT_MIN) {
            confidence += this.TRIGGER_WEIGHTS.SEMANTIC_SHIFT_BOOST;
            reasons.push(`Semantic shift detected: ${conversationAnalysis.semanticShift.toFixed(2)}`);
        }

        // Context-specific adjustments
        if (context.isQuestionPattern) {
            confidence += this.TRIGGER_WEIGHTS.QUESTION_PATTERN_BOOST;
            reasons.push('Question pattern detected');
        }

        if (context.mentionsPastWork) {
            confidence += this.TRIGGER_WEIGHTS.PAST_WORK_BOOST;
            reasons.push('References past work');
        }

        // Apply performance profile considerations
        const profile = this.performanceManager.performanceBudget;
        if (profile.maxLatency < 200 && confidence < this.THRESHOLD_VALUES.SPEED_MODE_CONFIDENCE_MIN) {
            // In speed-focused mode, require higher confidence
            confidence *= this.THRESHOLD_VALUES.SPEED_MODE_REDUCTION;
            reasons.push('Speed mode: increased confidence threshold');
        }

        // Final decision threshold
        const threshold = this.config.naturalTriggers?.triggerThreshold || 0.6;
        con
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
    const withSeparators = toolName.replace(/([a-z])([A-Z])/g, '$1_$2');
    const parts = withSeparators.toLowerCase().split(/[_-]/);

    // First check: Does any part match a destructive pattern exactly?
    for (const pattern of config.destructivePatterns) {
        if (parts.includes(pattern)) {
            return false; // Destructive - require confirmation
        }
    }

    // Second check: Does any part match a safe pattern exactly?
    for (const pattern of config.safePatterns) {
        if (parts.includes(pattern)) {
            return true; // Safe - auto-approve
        }
    }

    // Unknown pattern - require confirmation (safer default)
    return false;
}

/**
 * Output the decision in Claude Code hook format
 */
function outputDecision(behavior, metadata = {}) {
    const decision = {
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: {
                behavior: behavior  // 'allow', 'deny', or 'prompt'
            }
        }
    };

    // Add metadata if provided (for logging/debugging)
    if (Object.keys(metadata).length > 0 && behavior !== 'prompt') {
        decision.hookSpecificOutput.metadata = metadata;
    }

    console.log(JSON.stringify(decision));
}

/**
 * Read all data from stdin
 */
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';

        process.stdin.setEncoding('utf8');

        process.stdin.on('readable', () => {
            let chunk;
            while ((chunk = process.stdin.read()) !== null) {
                data += chunk;
            }
        });

        process.stdin.on('end', () => {
            resolve(data);
        });

        process.stdin.on('error', (error) => {
            reject(error);
        });

        // Timeout after 1 second
        setTimeout(() => {
            if (data.length === 0) {
                reject(new Error('Timeout reading stdin'));
            }
        }, 1000);
    });
}

// Run main
main().catch(error => {
    console.error('[PermissionRequest Hook] Fatal e
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
            dry_run: dryRun,
            min_confidence: Number.isFinite(cfg.minConfidence) ? cfg.minConfidence : 0.6,
            types: Array.isArray(cfg.types) && cfg.types.length > 0
                ? cfg.types
                : ['decision', 'bug', 'convention', 'learning', 'context'],
            project_path: projectName
        };

        const timeoutMs = Number.isFinite(cfg.timeoutMs) ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;

        console.log(`[Memory Hook] Harvest: POST ${endpoint}/api/harvest (project=${projectName}, dry_run=${dryRun})`);

        const resp = await postHarvest(endpoint, apiKey, payload, timeoutMs, {
            allowSelfSignedCerts: cfg.allowSelfSignedCerts === true
        });

        if (!resp.ok) {
            const detail = resp.error
                || `HTTP ${resp.status}${resp.raw ? ' ' + String(resp.raw).slice(0, 200) : ''}`;
            console.warn(`[Memory Hook] Harvest: request failed (non-fatal): ${detail}`);
            return;
        }

        const { found, stored, dryRun: respDryRun } = summarizeResponse(resp);
        console.log(`[Memory Hook] Session harvest: ${found} candidates found, ${stored} stored (dry_run=${respDryRun})`);

        if (forcedDryRun) {
            await writeFirstRunFlag();
        }
    } catch (error) {
        // Absolute belt-and-braces: never let a harvest failure surface.
        console.warn('[Memory Hook] Harvest: unexpected error (non-fatal):', error.message);
    }
}

module.exports = sessionEndHarvest;

// Also expose internals for testing.
module.exports.sessionEndHarvest = sessionEndHarvest;
module.exports._internal = {
    loadConfig,
    deriveProjectName,
    firstRunFlagPath,
    firstRunFlagExists,
    writeFirstRunFlag,
    postHarvest,
    summarizeResponse,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_MIN_MESSAGES
};

/**
 * Read JSON context from stdin (Claude Code provides this to hook processes).
 * Resolves to null if stdin is empty within 100ms (manual test / no pipe).
 */
function 
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
        analysis.codeChanges = analysis.codeChanges.slice(0, 4);
        analysis.nextSteps = analysis.nextSteps.slice(0, 4);
        
        return analysis;
        
    } catch (error) {
        console.error('[Memory Hook] Error analyzing conversation:', error.message);
        return {
            topics: [],
            decisions: [],
            insights: [],
            codeChanges: [],
            nextSteps: [],
            sessionLength: 0,
            confidence: 0,
            error: error.message
        };
    }
}

/**
 * Decide whether an analyzed session is substantive enough to store.
 *
 * Topics and next-steps are keyword-matched on generic vocabulary
 * ("debugging", "testing", "should", "will") and fire on almost any
 * conversation, so they are NOT counted as evidence. Only decisions,
 * insights, and code changes indicate a session worth remembering.
 * This prevents trivial sessions from producing generic "Session Summary"
 * memories that score 0.0 on quality.
 *
 * The #remember override (forceRemember) bypasses the gate.
 */
function isSessionMeaningful(analysis, { forceRemember = false } = {}) {
    if (forceRemember) return true;
    if (!analysis) return false;
    const substantive = (analysis.decisions?.length || 0)
        + (analysis.insights?.length || 0)
        + (analysis.codeChanges?.length || 0);
    return substantive > 0;
}

/**
 * Trigger quality evaluation for a stored memory (async, non-blocking)
 * This calls the backend's quality scoring system to pre-score the memory
 */
function triggerQualityEvaluation(endpoint, apiKey, contentHash, allowSelfSignedCerts = false) {
    return new Promise((resolve, reject) => {
        const url = new URL(`/api/quality/memories/${contentHash}/evaluate`, endpoint);
        const isHttps = url.protocol === 'https:';
        const requestModule = isHttps ? https : http;

        const postData = JSON.stringify({});

        const options = {
            hostname: url.hostname,
            port: url.p
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
        const envBackend = process.env.MCP_MEMORY_STORAGE_BACKEND?.toLowerCase();
        const endpoint = config.memoryService?.http?.endpoint || 'http://127.0.0.1:8889';
        
        // Parse endpoint to determine if local or remote
        const url = new URL(endpoint);
        const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.local');
        
        let storageInfo = {
            backend: 'unknown',
            type: 'unknown',
            location: endpoint,
            description: 'Unknown Storage',
            icon: '💾',
            health: { status: 'unknown', totalMemories: 0 }
        };
        
        if (envBackend) {
            switch (envBackend) {
                case 'sqlite_vec':
                    storageInfo = {
                        backend: 'sqlite_vec',
                        type: 'local',
                        location: process.env.MCP_MEMORY_SQLITE_PATH || '~/.mcp-memory/memories.db',
                        description: 'SQLite-vec (Config)',
                        icon: '🪶',
                        health: { status: 'unknown', totalMemories: 0 }
                    };
                    break;
                    
                case 'chromadb':
                case 'chroma':
                    const chromaHost = process.env.MCP_MEMORY_CHROMADB_HOST;
                    const chromaPath = process.env.MCP_MEMORY_CHROMA_PATH;
                    
                    if (chromaHost) {
                        // Remote ChromaDB
                        const chromaPort = process.env.MCP_MEMORY_CHROMADB_PORT || '8000';
                        const ssl = process.env.MCP_MEMORY_CHROMADB_SSL === 'true';
                        const protocol = ssl ? 'https' : 'http';
                        storageInfo = {
                            backend: 'chromadb',
                            type: 'remote',
                            location: `${protocol}://${chromaHost}:${chromaPort}`,
                            description: 'ChromaDB (Re
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
    console.log('[Topic Change Hook] Analyzing conversation for topic changes...');

    try {
        const config = await loadConfig();
        
        // Check if topic change hook is enabled
        if (!config.hooks?.topicChange?.enabled) {
            console.log('[Topic Change Hook] Hook is disabled, skipping');
            return;
        }

        const {
            minSignificanceScore = 0.3,
            maxMemoriesPerUpdate = 3
        } = config.hooks.topicChange;

        // Analyze current conversation
        const currentAnalysis = analyzeConversation(context.conversationText || '', {
            extractTopics: true,
            extractEntities: true,
            detectIntent: true,
            minTopicConfidence: 0.3
        });

        // Detect topic changes
        const changes = detectTopicChanges(conversationState.previousAnalysis, currentAnalysis);

        // Only proceed if significant topic change detected
        if (!changes.hasTopicShift || changes.significanceScore < minSignificanceScore) {
            console.log(`[Topic Change Hook] No significant topic change detected (score: ${changes.significanceScore.toFixed(2)})`);
            conversationState.previousAnalysis = currentAnalysis;
            return;
        }

        console.log(`[Topic Change Hook] Significant topic change detected (score: ${changes.significanceScore.toFixed(2)})`);
        console.log(`[Topic Change Hook] New topics: ${changes.newTopics.map(t => t.name).join(', ')}`);

        // Generate search queries for new topics
        const queries = generateTopicQueries(currentAnalysis, changes);
        
        if (queries.length === 0) {
            console.log('[Topic Change Hook] No actionable queries generated');
            conversationState.previousAnalysis = currentAnalysis;
            return;
        }

        // Query memory service for each topic
        const allMemories = [];
        for (const queryObj of queries) {
            const memories = await queryMemoryService(
                config.memoryService.e
```

### Core Architecture Module: `claude-hooks/install_hooks.py`
```
#!/usr/bin/env python3
"""
Unified Claude Code Memory Awareness Hooks Installer
====================================================

Cross-platform installer for Claude Code memory awareness hooks with support for:
- Basic memory awareness hooks (session-start, session-end)
- Natural Memory Triggers v7.1.3 (intelligent automatic memory awareness)
- Mid-conversation hooks for real-time memory injection
- Performance optimization and CLI management tools
- Smart MCP detection and DRY configuration

Replaces multiple platform-specific installers with a single Python solution.
Implements DRY principle by detecting and reusing existing Claude Code MCP configurations.

Version: Dynamically synced with main project version
"""

import os
import sys
import json
import shutil
import platform
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Fix Windows console encoding for Unicode output (emojis, checkmarks)
if sys.platform == 'win32':
    try:
        # Set console to UTF-8 mode
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleOutputCP(65001)
        kernel32.SetConsoleCP(65001)
        # Reconfigure stdout/stderr to use UTF-8
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass  # Fallback: some terminals may not support this

# Dynamic version detection from main project
def get_project_version() -> str:
    """Get version dynamically from main project (reads pyproject.toml to avoid import warnings)."""
    try:
        # Read version from pyproject.toml to avoid importing storage modules
        pyproject_path = Path(__file__).parent.parent / "pyproject.toml"
        if pyproject_path.exists():
            with open(pyproject_path, 'r') as f:
                for line in f:
                    if line.startswith('version = '):
                        # Extract version from: version = "X.Y.Z"
                        return line.split('"')[1]

        # Fallback: try importing (may show warnings)
        src_path = Path(__file__).parent.parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))
        from mcp_memory_service._version import __version__
        return __version__
    except Exception:
        # Fallback for standalone installations
        return "7.2.0"


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


class HookInstaller:
    """Unified hook installer for all platforms and feature levels."""

    # Environment type constants
    CLAUDE_CODE_ENV = "claude-code"
    STANDALONE_ENV = "standalone"

    # Memory server name constants
    MEMORY_SERVER_NAMES = ['memory-service', 'memory', 'mcp-memory-service', 'extended-memory']

    def __init__(self):
        self.script_dir = Path(__file__).parent.absolute()
        self.platform_name = platform.system().lower()
        self.claude_hooks_dir = self._detect_claude_hooks_directory()
        self.backup_dir = None

    def _detect_claude_hooks_directory(self) -> Path:
        """Detect the Claude Code hooks directory across platforms."""
        home = Path.home()

        # Primary paths by platform
        primary_paths = {
            'windows': [
                home / 'AppData' / 'Roaming' / 'Claude' / 'hooks',
                home / '.claude' / 'hooks'
            ],
            'darwin': [  # macOS
                home / '.claude' / 'hooks',
                home / 'Library' / 'Application Support' / 'Claude' / 'hooks'
            ],
            'linux': [
                home / '.claude' / 'hooks',
                home / '.config' / 'claude' / 'hooks'
            ]
        }

        # Check platform-specific paths first
        platform_paths = primary_paths.get(self.platform_name, primary_paths['linux'])

        for path in platform_paths:
            if path.exists():
                return path

        # Check if Claude Code CLI can tell us the location
        try:
            result = subprocess.run(['claude', '--help'],
                                  capture_output=True, text=True, timeout=5)
            # Look for hooks directory info in help output
            # This is a placeholder - actual Claude CLI might not provide this
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Default to standard location
        return home / '.claude' / 'hooks'

    def info(self, message: str) -> None:
        """Print info message."""
        print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")

    def warn(self, message: str) -> None:
        """Print warning message."""
        print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")

    def error(self, message: str) -> None:
        """Print error message."""
        print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")

    def success(self, message: str) -> None:
        """Print success message."""
        print(f"{Colors.BLUE}[SUCCESS]{Colors.NC} {message}")

    def header(self, message: str) -> None:
        """Print header message."""
        print(f"\n{Colors.CYAN}{'=' * 60}{Colors.NC}")
        print(f"{Colors.CYAN} {message}{Colors.NC}")
        print(f"{Colors.CYAN}{'=' * 60}{Colors.NC}\n")

    def check_prerequisites(self) -> bool:
        """Check system prerequisites for hook installation."""
        self.info("Checking prerequisites...")

        all_good = True

        # Check Claude Code CLI
        try:
            result = subprocess.run(['claude', '--version'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                self.success(f"Claude Code CLI found: {result.stdout.strip()}")
            else:
                self.warn("Claude Code CLI found but version check failed")
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            self.warn("Claude Code CLI not found in PATH")
            self.info("You can still install hooks, but some features may not work")

        # Check Node.js
        try:
            result = subprocess.run(['node', '--version'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                version = result.stdout.strip()
                major_version = int(version.replace('v', '').split('.')[0])
                if major_version >= 14:
                    self.success(f"Node.js found: {version} (compatible)")
                else:
                    self.error(f"Node.js {version} found, but version 14+ required")
                    all_good = False
            else:
                self.error("Node.js found but version check failed")
                all_good = False
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            self.error("Node.js not found - required for hook execution")
            self.info("Please install Node.js 14+ from https://nodejs.org/")
            all_good = False

        # Check Python version
        if sys.version_info < (3, 7):
            self.error(f"Python {sys.version} found, but Python 3.7+ required")
            all_good = False
        else:
            self.success(f"Python {sys.version_info.major}.{sys.version_info.minor} found (compatible)")

        return all_good

    def detect_claude_mcp_configuration(self) -> Optional[Dict]:
        """Detect existing Claude Code MCP memory server configuration."""
        self.info("Detecting existing Claude Code MCP configuration...")

        try:
            # Try specific server names first
            config_info = self._try_detect_server()
            if config_info:
                return config_info

            # Fallback: try listing all servers
            config_info = self._try_fallback_detection()
            if config_info:
                return config_info

            self.info("No existing memory server found in Claude Code MCP configuration")

        except subprocess.TimeoutExpired:
            self.warn("Claude MCP command timed out")
        except FileNotFoundError:
            self.warn("Claude Code CLI not found - cannot detect existing MCP configuration")
        except Exception as e:
            self.warn(f"Failed to detect MCP configuration: {e}")

        return None

    def _try_detect_server(self) -> Optional[Dict]:
        """Try to detect memory server by name."""
        for server_name in self.MEMORY_SERVER_NAMES:
            result = subprocess.run(['claude', 'mcp', 'get', server_name],
                                  capture_output=True, text=True, timeout=10)

            if result.returncode != 0:
                continue

            config_info = self._parse_mcp_get_output(result.stdout)
            if not config_info:
                continue

            self.success(f"Found existing memory server '{server_name}': {config_info.get('command', 'Unknown')}")
            self.success(f"Status: {config_info.get('status', 'Unknown')}")
            self.success(f"Type: {config_info.get('type', 'Unknown')}")
            return config_info

        return None

    def _try_fallback_detection(self) -> Optional[Dict]:
        """Fallback detection using mcp list command."""
        result = subprocess.run(['claude', 'mcp', 'list'],
                              capture_output=True, text=True, timeout=10)

        if result.returncode != 0:
            return None

        if 'memory' not in result.stdout.lower():
            return None

        self.success("Found memory-related MCP server in configuration")
        return {'status': 'Connected', 'type': 'detected', 'command': 'See claude mcp list'}

    def _parse_
```

### Core Architecture Module: `claude-hooks/memory-mode-controller.js`
```
#!/usr/bin/env node

/**
 * Memory Mode Controller
 * Command-line utility for managing memory hook performance profiles
 */

const fs = require('fs').promises;
const path = require('path');

class MemoryModeController {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, 'config.json');
    }

    /**
     * Load current configuration
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            throw new Error(`Failed to load config: ${error.message}`);
        }
    }

    /**
     * Save configuration
     */
    async saveConfig(config) {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    /**
     * Switch to a performance profile
     */
    async switchProfile(profileName) {
        const config = await this.loadConfig();

        if (!config.performance?.profiles[profileName]) {
            throw new Error(`Unknown profile: ${profileName}. Available profiles: ${Object.keys(config.performance?.profiles || {}).join(', ')}`);
        }

        config.performance.defaultProfile = profileName;
        await this.saveConfig(config);

        const profile = config.performance.profiles[profileName];
        console.log(`✅ Switched to profile: ${profileName}`);
        console.log(`📊 Description: ${profile.description}`);
        console.log(`⚡ Max Latency: ${profile.maxLatency || 'adaptive'}ms`);
        console.log(`🎯 Enabled Tiers: ${profile.enabledTiers?.join(', ') || 'adaptive'}`);
        console.log(`🔄 Background Processing: ${profile.backgroundProcessing ? 'enabled' : 'disabled'}`);

        return profile;
    }

    /**
     * Get current status
     */
    async getStatus() {
        const config = await this.loadConfig();
        const currentProfile = config.performance?.defaultProfile || 'balanced';
        const profile = config.performance?.profiles[currentProfile];

        console.log('📊 Memory Hook Status');
        console.log('═'.repeat(50));
        console.log(`Current Profile: ${currentProfile}`);
        console.log(`Description: ${profile?.description || 'No description'}`);
        console.log(`Natural Triggers: ${config.naturalTriggers?.enabled ? 'enabled' : 'disabled'}`);
        console.log(`Sensitivity: ${config.patternDetector?.sensitivity || 0.7}`);
        console.log(`Trigger Threshold: ${config.naturalTriggers?.triggerThreshold || 0.6}`);
        console.log(`Cooldown Period: ${(config.naturalTriggers?.cooldownPeriod || 30000) / 1000}s`);

        if (profile) {
            console.log('\n🎯 Performance Settings');
            console.log('─'.repeat(30));
            console.log(`Max Latency: ${profile.maxLatency || 'adaptive'}ms`);
            console.log(`Enabled Tiers: ${profile.enabledTiers?.join(', ') || 'adaptive'}`);
            console.log(`Background Processing: ${profile.backgroundProcessing ? 'enabled' : 'disabled'}`);
            console.log(`Degrade Threshold: ${profile.degradeThreshold || 'adaptive'}ms`);
        }

        console.log('\n🔧 Available Profiles');
        console.log('─'.repeat(30));
        for (const [name, prof] of Object.entries(config.performance?.profiles || {})) {
            const current = name === currentProfile ? ' (current)' : '';
            console.log(`${name}${current}: ${prof.description}`);
        }

        return {
            currentProfile,
            config: config.performance,
            naturalTriggers: config.naturalTriggers
        };
    }

    /**
     * Update sensitivity
     */
    async updateSensitivity(sensitivity) {
        const config = await this.loadConfig();

        if (sensitivity < 0 || sensitivity > 1) {
            throw new Error('Sensitivity must be between 0 and 1');
        }

        if (!config.patternDetector) {
            config.patternDetector = {};
        }

        config.patternDetector.sensitivity = sensitivity;
        await this.saveConfig(config);

        console.log(`✅ Updated sensitivity to ${sensitivity}`);
        return sensitivity;
    }

    /**
     * Update trigger threshold
     */
    async updateThreshold(threshold) {
        const config = await this.loadConfig();

        if (threshold < 0 || threshold > 1) {
            throw new Error('Threshold must be between 0 and 1');
        }

        if (!config.naturalTriggers) {
            config.naturalTriggers = {};
        }

        config.naturalTriggers.triggerThreshold = threshold;
        await this.saveConfig(config);

        console.log(`✅ Updated trigger threshold to ${threshold}`);
        return threshold;
    }

    /**
     * Enable or disable natural triggers
     */
    async toggleNaturalTriggers(enabled = null) {
        const config = await this.loadConfig();

        if (!config.naturalTriggers) {
            config.naturalTriggers = {};
        }

        if (enabled === null) {
            enabled = !config.naturalTriggers.enabled;
        }

        config.naturalTriggers.enabled = enabled;
        await this.saveConfig(config);

        console.log(`✅ Natural triggers ${enabled ? 'enabled' : 'disabled'}`);
        return enabled;
    }

    /**
     * Reset to default configuration
     */
    async resetToDefaults() {
        const config = await this.loadConfig();

        config.performance.defaultProfile = 'balanced';
        config.naturalTriggers = {
            enabled: true,
            triggerThreshold: 0.6,
            cooldownPeriod: 30000,
            maxMemoriesPerTrigger: 5
        };

        // Pattern detector defaults
        if (!config.patternDetector) {
            config.patternDetector = {};
        }
        config.patternDetector.sensitivity = 0.7;
        config.patternDetector.adaptiveLearning = true;

        await this.saveConfig(config);
        console.log('✅ Reset to default configuration');
        return config;
    }

    /**
     * Get performance profiles information
     */
    async listProfiles() {
        const config = await this.loadConfig();
        const profiles = config.performance?.profiles || {};

        console.log('📋 Available Performance Profiles');
        console.log('═'.repeat(60));

        for (const [name, profile] of Object.entries(profiles)) {
            const current = name === config.performance?.defaultProfile ? ' ⭐' : '';
            console.log(`\n${name}${current}`);
            console.log(`  Description: ${profile.description}`);
            console.log(`  Max Latency: ${profile.maxLatency || 'adaptive'}ms`);
            console.log(`  Enabled Tiers: ${profile.enabledTiers?.join(', ') || 'adaptive'}`);
            console.log(`  Background Processing: ${profile.backgroundProcessing ? 'yes' : 'no'}`);
        }

        return profiles;
    }
}

/**
 * Command-line interface
 */
async function main() {
    const args = process.argv.slice(2);
    const controller = new MemoryModeController();

    try {
        if (args.length === 0 || args[0] === 'status') {
            await controller.getStatus();
            return;
        }

        const command = args[0];

        switch (command) {
            case 'switch':
            case 'profile':
                if (!args[1]) {
                    console.error('❌ Please specify a profile name');
                    console.log('Available profiles: speed_focused, balanced, memory_aware, adaptive');
                    process.exit(1);
                }
                await controller.switchProfile(args[1]);
                break;

            case 'sensitivity':
                if (!args[1]) {
                    console.error('❌ Please specify sensitivity value (0-1)');
                    process.exit(1);
                }
                const sensitivity = parseFloat(args[1]);
                await controller.updateSensitivity(sensitivity);
                break;

            case 'threshold':
                if (!args[1]) {
                    console.error('❌ Please specify threshold value (0-1)');
                    process.exit(1);
                }
                const threshold = parseFloat(args[1]);
                await controller.updateThreshold(threshold);
                break;

            case 'enable':
                await controller.toggleNaturalTriggers(true);
                break;

            case 'disable':
                await controller.toggleNaturalTriggers(false);
                break;

            case 'toggle':
                await controller.toggleNaturalTriggers();
                break;

            case 'reset':
                await controller.resetToDefaults();
                break;

            case 'list':
            case 'profiles':
                await controller.listProfiles();
                break;

            case 'help':
            case '-h':
            case '--help':
                showHelp();
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
🧠 Memory Mode Controller

Usage: node memory-mode-controller.js <command> [options]

Commands:
  status                    Show current configuration and status
  profile <name>           Switch to performance profile
  sensitivity <0-1>        Set pattern detection sensitivity
  threshold <0-1>          Set trigger threshold
  enable                   Enable natural triggers
  disable                  Disable natural triggers
  toggle                   Toggle natural triggers on/off
  reset                    Reset to default configuration
  list          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1597** (2026-10-19): **[Bug]: X-Agent-ID is ignored on the streamable-http transport, so memory author falls back to MCP_AGENT_ID**
  *Symptoms*: **What happens**  `X-Agent-ID` is only read in `web/api/mcp.py` (L259-263), which is the Web API path. When the service runs in streamable-http mode (`MCP_STREAMABLE_HTTP_MODE=1`), `ServerRunManager.run_streamable_http` creates a `StreamableHTTPSessionManager` that never inspects request headers. Any client relying on the header is silently attributed to the `MCP_AGENT_ID` env var instead.  **Evidence**  Two consecutive writes on the same server:  | record | how it was written | `metadata.agent_id` | |---|---|---| | id 82179 | header `X-Agent-ID: tpol`, no argument | `zero` | | id 82180 | explicit `agent_id` argument | `tpol` |  **Expected**  Precedence should be: explicit `agent_id` argument > `X-Agent-ID` header > `MCP_AGENT_ID` > metadata > unset — on every write path (`memory_store`, `evolve_memory`, harvest `auto_commit`).  **Root cause**  There is no per-request bridge from HTTP headers down to the tool-call path in the streamable transport.  **Proposed fix**  An ASGI middleware around the session manager reads `X-Agent-ID` into a `contextvars.ContextVar` and resets it in `finally`; a single `resolve_agent_id()` helper implements the precedence chain and is called by all three write paths. The header remains attribution-only and grants no permission.  **Tests**  Integration tests against a real streamable transport, with no transport mock: two concurrent clients with different headers and 20 interleaved writes (zero crossing); header without argument; no header falling 

- **Issue #1564** (2026-10-17): **[delta-sync] purge of tombstone row breaks later intentional re-create (known gap from #1562)**
  *Symptoms*: ## Context Split out from #1562 (fix for #1522) as a known, bounded gap.  ## Problem `store.py:92` `purge_deleted()` removes the tombstone row, and `_recreate_of_for()` then returns `None` without checking the delete still present in `sync_events`. A later **intentional re-create** emits `recreate_of=""`, so the origin records it live while peers keep it dead — a convergence gap.  ## Root cause The `recreate_of`-by-`event_id` model references a physical row that purge can delete. The canonical fix is an OR-Set/DVV dot-ledger (see RFC, forthcoming) where liveness does not depend on the tombstone row existing.  ## Scope Edge case: requires purge to run between a delete and a later re-create of the same key. Direct sync-path (the #1522 symptom) is fixed in #1562.  ## Acceptance Either: (a) `_recreate_of_for()` consults the recorded delete in `sync_events` even when the tombstone row is purged, or (b) resolved structurally by the DVV redesign.

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

### Incident Patch 1: `b29d353f` (2026-10-19)
**Commit Message**: fix(web): stop putting the long-lived API key in SSE URLs (#1117) (#1539)

* fix(web): stop putting the long-lived API key in SSE URLs (#1117)

EventSource cannot set an Authorization header, so the dashboard authenticated
every live-update connection as GET /api/events?api_key=<key>. uvicorn's access
log records the whole request line, so each connection and each automatic
reconnect wrote the key in cleartext into the log. TLS protects the wire, not
the log, and the file outlives the session and gets pasted into bug reports.
Redacting the log hid this without closing it.

POST /api/events/ticket now exchanges real credentials (Bearer or X-API-Key
header) for a ticket that is single-use and expires in 60 seconds, and the
browser connects with ?ticket=. A pasted log line holds something dead within a
minute and unusable twice.

?api_key= is no longer accepted. A request using it gets a warning naming the
migration rather than a silent 401, so a stale client is diagnosable. X-API-Key
as a header is unchanged — headers never reach the access log.

The ticket store is in-memory only, capped, and compares tokens in constant
time. A ticket is consumed even when refused, so a probe cannot

**File**: `changelog.d/1117.fixed.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+- **The dashboard stopped putting the long-lived API key in SSE URLs (#1117).**
+  `EventSource` cannot set an `Authorization` header, so the web UI authenticated
+  every live-update connection with `GET /api/events?api_key=<key>`. uvicorn's
+  access log records the whole request line, so each SSE connection — and every
+  automatic reconnect — wrote the key in cleartext into
+  `~/.local/share/mcp-memory/logs/server.log`. TLS does not help there: it
+  protects the wire, not the log. The file outlives the session and gets pasted
+  into bug reports. Access-log redaction had already landed, which hid the leak
+  without closing it.
+
+  `POST /api/events/ticket` now exchanges real credentials (Bearer or
+  `X-API-Key` header) for a ticket that is single-use and expires in 60 seconds,
+  and the browser connects with `?ticket=…`. A pasted log line now holds
+  something that is dead within a minute and cannot be replayed. The
+  `?api_key=` query parameter is **no longer accepted** — requests using it get
+  a warning naming the migration rather than a silent 401. `X-API-Key` as a
+  header is unchanged, since headers do not reach the access log.
+
+  The OAuth `?token=` query fallback still exists and has the same shape of
+  exposure; it is left alone here because those tokens are already short-lived
+  and revocable.
```

**File**: `docs/oauth-setup.md` (modified, +20/-4)
```diff
@@ -199,14 +199,30 @@ memory launch
 curl -H "X-API-Key: your-secret-key" \
      http://localhost:8000/api/memories
 
-# Option 2: Query parameter (convenient, less secure - avoid in production)
-curl "http://localhost:8000/api/memories?api_key=your-secret-key"
-
-# Option 3: Bearer token (backward compatible)
+# Option 2: Bearer token (backward compatible)
 curl -H "Authorization: Bearer your-secret-key" \
      http://localhost:8000/api/memories
 ```
 
+> **`?api_key=` is no longer accepted.** It used to be a "convenient, less
+> secure" option; it was worse than that. uvicorn logs the whole request line,
+> so every request wrote the long-lived key in cleartext into the access log —
+> under HTTPS too, since TLS protects the wire and not the log. Send the key in
+> the `X-API-Key` header instead.
+>
+> `EventSource` is the one case with an excuse: it cannot set headers. For it,
+> exchange a real credential for a short-lived ticket and put **that** on the URL:
+>
+> ```
+> curl -X POST -H "X-API-Key: your-secret-key" \
+>      http://localhost:8000/api/events/ticket
+> # -> {"ticket": "...", "expires_in_seconds": 60, "param_name": "ticket"}
+> # then connect to /api/events?ticket=<ticket>
+> ```
+>
+> The ticket is single-use and expires in 60 seconds, so a pasted log line holds
+> nothing reusable.
+
 **When to use API Key vs OAuth:**
 - **API Key**: Single-user deployments, scripts, local development
 - **OAuth**: Team collaboration, Claude Code HTTP transport, multi-user access
```

**File**: `src/mcp_memory_service/web/api/events.py` (modified, +49/-4)
```diff
@@ -2,15 +2,20 @@
 Server-Sent Events endpoints for real-time updates.
 """
 
-from fastapi import APIRouter, Request, Depends, Query
+from fastapi import APIRouter, Request, Depends, HTTPException, Query
+from fastapi import status
 from pydantic import BaseModel
+import logging
 from typing import List, Optional
 
+from mcp_memory_service.compat import _sanitize_log_value
+
 # OAuth config no longer needed - auth is always enabled
 from ..sse import create_event_stream, sse_manager
+from ..sse_ticket import sse_tickets
 
 # OAuth authentication imports
-from ..oauth.middleware import require_read_access, AuthenticationResult
+from ..oauth.middleware import require_read_access, require_real_credential, AuthenticationResult
 
 router = APIRouter()
 
@@ -31,6 +36,47 @@ class SSEStatsResponse(BaseModel):
     connections: List[ConnectionInfo]
 
 
+class TicketResponse(BaseModel):
+    """A single-use SSE ticket."""
+    ticket: str
+    expires_in_seconds: float
+    # Named so the client does not hardcode the TTL and then be surprised.
+    param_name: str = "ticket"
+
+
+@router.post("/events/ticket")
+async def issue_event_ticket(
+    user: AuthenticationResult = Depends(require_real_credential),
+) -> TicketResponse:
+    """Exchange real credentials for a short-lived, single-use SSE ticket.
+
+    Why this exists (issue #1117): `EventSource` cannot set an Authorization
+    header, so the dashboard used to carry the long-lived API key in the URL
+    query (``GET /api/events?api_key=<key>``). uvicorn's access log records the
+    whole request line, so every SSE connection wrote the key in cleartext into
+    a file that outlives the session. Redacting the log treats the symptom;
+    this removes the cause.
+
+    The browser calls this **once, over POST**, so the secret travels in a body
+    TLS already protects and that no access log line contains, and then opens
+    ``EventSource('/api/events?ticket=<ticket>')``. A leaked log line holds a
+    token that is single-use and dead within a minute.
+    """
+    try:
+        ticket = sse_tickets.issue(scope="read")
+    except RuntimeError:
+        # Saturation is a client problem, not a server fault, and must not
+        # look like an auth failure.
+        raise HTTPException(
+            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
+            detail="too many pending SSE tickets; retry shortly",
+        )
+    return TicketResponse(
+        ticket=ticket.token,
+        expires_in_seconds=sse_tickets.ttl_seconds,
+    )
+
+
 @router.get("/events")
 async def events_endpoint(
     request: Request,
@@ -100,8 +146,7 @@ async def get_sse_stats(
             "connections": connections
         }
     except Exception as e:
-        import logging
-        logging.getLogger(__name__).error(f"Error getting SSE stats: {str(e)}")
+        logging.getLogger(__name__).error(f"Error getting SSE stats: {_sanitize_log_value(str(e))}")
         # Return safe default stats if there's an error
         return {
             "total_connections": 0,
```

**File**: `src/mcp_memory_service/web/oauth/middleware.py` (modified, +69/-7)
```diff
@@ -380,13 +380,48 @@ async def get_current_user(
                 logger.debug("Authenticated via X-API-Key header")
                 return api_key_result
 
-        # Try query parameter as fallback (less secure, but convenient)
-        api_key_param = request.query_params.get("api_key")
-        if api_key_param:
-            api_key_result = authenticate_api_key(api_key_param)
-            if api_key_result.authenticated:
-                logger.debug("Authenticated via api_key query parameter")
-                return api_key_result
+        # `api_key` as a query parameter used to be accepted here for the same
+        # reason `token` still is below: EventSource cannot set headers. It is
+        # gone deliberately (issue #1117). uvicorn logs the whole request line,
+        # so `?api_key=...` wrote the long-lived key in cleartext into
+        # ~/.local/share/mcp-memory/logs/server.log on every reconnect — under
+        # HTTPS too, since TLS protects the wire and not the log. That file
+        # outlives the session and gets pasted into bug reports.
+        #
+        # The replacement is a single-use, short-TTL ticket issued over POST
+        # (see /api/events/ticket). Kept as a distinct check rather than folded
+        # into the Bearer fallback so the failure message can name the migration.
+        if request.query_params.get("api_key"):
+            logger.warning(
+                "api_key query parameter is no longer accepted; "
+                "fetch a short-lived ticket from POST /api/events/ticket "
+                "and connect with ?ticket= (issue #1117)"
+            )
+
+    # Ticket redemption sits OUTSIDE the `if API_KEY` block on purpose.
+    # Greptile caught it: issuance accepts OAuth credentials, so in an
+    # OAuth-only deployment a client could get a ticket and then 401 on
+    # redemption. The ticket path must work whenever a ticket can be issued.
+    ticket_param = request.query_params.get("ticket")
+    if ticket_param:
+        from ..sse_ticket import sse_tickets
+
+        # hmac.compare_digest raises TypeError on non-ASCII strings, which
+        # would surface as 500 instead of 401. Refuse before comparing.
+        try:
+            ticket_param.encode("ascii")
+        except UnicodeEncodeError:
+            logger.warning("Rejected an SSE ticket: non-ASCII")
+        else:
+            if sse_tickets.redeem(ticket_param, scope="read"):
+                logger.debug("Authenticated via single-use SSE ticket")
+                return AuthenticationResult(
+                    authenticated=True,
+                    client_id="sse-ticket",
+                    scope="read",
+                    auth_method="ticket",
+                )
+            logger.warning("Rejected an SSE ticket: expired, used, or unknown")
 
     # Try OAuth token as query parameter (EventSource API doesn't support headers)
     if OAUTH_ENABLED:
@@ -446,6 +481,33 @@ async def scope_dependency(user: AuthenticationResult = Depends(get_current_user
 
 
 # Convenience dependencies for common access patterns
+async def require_real_credential(user: AuthenticationResult = Depends(get_current_user)) -> AuthenticationResult:
+    """Require a real credential — Bearer token or API key, **not** an SSE ticket.
+
+    Ticket issuance must be gated on something the ticket cannot itself supply.
+    Greptile caught this: `POST /api/events/ticket` used `require_read_access`,
+    which accepts a ticket, so anyone holding one unused ticket could exchange
+    it for another and repeat — the 60-second TTL bounded nothing.
+
+    A ticket is a bearer credential minted *from* a real one; letting it mint
+    more turns a single leak into an indefinite one.
+    """
+    if user.auth_method == "ticket":
+        raise HTTPException(
+            status_code=status.HTTP_401_UNAUTHORIZED,
+            detail={
+                "error": "invalid_token",
+                "error_description": (
+                    "An SSE ticket cannot be used to mint another ticket; "
+                    "authenticate with a Bearer token or an API key."
+                ),
+            },
+            headers={"WWW-Authenticate": _www_authenticate_header()},
+        )
+    user.require_scope("read")
+    return user
+
+
 async def require_read_access(user: AuthenticationResult = Depends(get_current_user)) -> AuthenticationResult:
     """Require read access to the resource."""
     user.require_scope("read")
```

**File**: `src/mcp_memory_service/web/sse_ticket.py` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+"""Short-lived, single-use tickets for EventSource connections.
+
+Why this exists (issue doobidoo/mcp-memory-service#1117):
+
+`EventSource` cannot set an ``Authorization`` header, so the dashboard used to
+carry the long-lived API key in the URL query instead::
+
+    GET /api/events?api_key=<full key> HTTP/1.1
+
+uvicorn's access log records the whole request line, so every SSE connection
+wrote that key in cleartext into the log file. TLS does not help — it protects
+the wire, not the log. The file then outlives the session and gets pasted into
+bug reports.
+
+Access-log redaction already landed (``web/log_redaction.py``), but that treats
+the symptom. This module removes the cause: the browser exchanges its real
+credentials **once, in a POST body**, for a ticket that is worthless a minute
+later. A leaked log line then contains nothing of value.
+
+Design constraints, in order of how badly each one bites:
+
+* **Single-use.** A ticket that survives replay is just a shorter-lived key.
+* **Short TTL.** Long enough for the browser to open the connection and for
+  EventSource's first reconnect to succeed if the network hiccups; short enough
+  that a captured URL is useless almost immediately. 60 seconds is the balance
+  — reconnects beyond that re-fetch a ticket, which is cheap.
+* **In-memory only.** These are session-scoped credentials. Persisting them
+  would recreate the exact store of secrets this change is meant to delete.
+* **Constant-time comparison.** The ticket is a bearer credential; compare it
+  the way one.
+* **Bounded.** The table must not grow without limit if a client loops on
+  ``POST /ticket`` — see ``_MAX_PENDING``.
+"""
+
+from __future__ import annotations
+
+import hmac
+import secrets
+import threading
+import time
+from dataclasses import dataclass
+
+# 60s: survives EventSource's first automatic reconnect, expires before a
+# pasted log line has any useful life.
+DEFAULT_TTL_SECONDS = 60.0
+
+# A client that abandons tickets faster than they expire must not pin memory.
+# 4096 is far above any real dashboard's concurrent-connection count.
+_MAX_PENDING = 4096
+
+
+@dataclass(frozen=True)
+class Ticket:
+    """A single issued ticket and its expiry."""
+
+    token: str
+    expires_at: float
+    scope: str
+
+
+class TicketStore:
+    """In-memory store of issued SSE tickets.
+
+    Thread-safe: the web app may issue from an async context while a request
+    handler redeems on a worker thread.
+    """
+
+    def __init__(self, ttl_seconds: float = DEFAULT_TTL_SECONDS) -> None:
+        self._ttl = ttl_seconds
+        self._lock = threading.Lock()
+        self._pending: dict[str, Ticket] = {}
+
+    @property
+    def ttl_seconds(self) -> float:
+        return self._ttl
+
+    def issue(self, scope: str = "read") -> Ticket:
+        """Mint a ticket. Raises if the table is saturated.
+
+        The lock spans purge, size check and insert — Greptile caught that it
+        did not, which let two concurrent callers both pass the limit or both
+        delete the same expired entry. Thread-safety is only real if the
+        check-then-act is inside the critical section.
+        """
+        # 32 bytes = 256 bits. This is a bearer credential — do not skimp.
+        token = secrets.token_urlsafe(32)
+        now = time.monotonic()
+        with self._lock:
+            self._purge_locked(now)
+            if len(self._pending) >= _MAX_PENDING:
+                # Refuse rather than grow unbounded: a client hammering this
+                # endpoint must not become a memory leak.
+                raise RuntimeError("too many pending SSE tickets; retry shortly")
+            ticket = Ticket(token=token, expires_at=now + self._ttl, scope=scope)
+            self._pending[token] = ticket
+        return ticket
+
+    def redeem(self, token: str, scope: str = "read") -> bool:
+        """Consume a ticket. True only for an unexpired ticket of the right scope.
+
+        Always consumes on a miss too, so a brute-force loop cannot distinguish
+        "wrong scope" from "already used" by whether the ticket still exists.
+        """
+        if not token or not isinstance(token, str):
+            return False
+        # hmac.compare_digest raises TypeError on non-ASCII strings; refuse
+        # before comparing so the caller sees a clean False, not a 500.
+        try:
+            token.encode("ascii")
+        except UnicodeEncodeError:
+            return False
+        now = time.monotonic()
+        with self._lock:
+            self._purge_locked(now)
+            # hmac.compare_digest wants bytes; the keys are urlsafe-base64 text.
+            match = None
+            for candidate in list(self._pending):
+                if hmac.compare_digest(candidate, token):
+                    match = candidate
+                    break
+            if match is None:
+                return False
+            ticket = self._pending.pop(match)
+            r
```

**File**: `src/mcp_memory_service/web/static/app.js` (modified, +128/-56)
```diff
@@ -726,6 +726,9 @@ class MemoryDashboard {
      * Set up Server-Sent Events for real-time updates
      */
     setupSSE() {
+        // Bump first: any in-flight ticket exchange from a previous call is now
+        // stale and will refuse to open a stream (see _openSSEWithTicket).
+        this._sseSetupGeneration = (this._sseSetupGeneration || 0) + 1;
         // Close any existing connection to prevent connection multiplication.
         // Without this, each failed reconnect spawns a new EventSource while
         // the old one may still be retrying, leading to exponential 401 spam.
@@ -741,75 +744,144 @@ class MemoryDashboard {
         }
 
         try {
-            // Build SSE URL with query parameter auth (EventSource API doesn't support custom headers)
+            // EventSource cannot set an Authorization header. It used to carry
+            // `?api_key=<long-lived key>`, which uvicorn wrote verbatim into the
+            // access log on every reconnect (issue #1117) — TLS protects the wire,
+            // not the log. Now we ask for a single-use ticket over POST: the real
+            // credential travels in a body no access-log line contains, and the
+            // ticket is dead within a minute and cannot be replayed.
             const sseUrl = new URL(`${this.apiBase}/events`, document.baseURI);
             if (this.authState.apiKey) {
-                sseUrl.searchParams.set('api_key', this.authState.apiKey);
-            } else if (this.authState.oauthToken) {
+                this._openSSEWithTicket(sseUrl);
+                return;
+            }
+            if (this.authState.oauthToken) {
+                // OAuth tokens are short-lived and revocable, so a URL carries far
+                // less risk here. Unchanged by this fix.
                 sseUrl.searchParams.set('token', this.authState.oauthToken);
             }
-            this.eventSource = new EventSource(sseUrl.toString());
+            this._connectSSE(sseUrl);
+        } catch (error) {
+            console.error('Failed to establish SSE connection:', error);
+            this.updateConnectionStatus('disconnected');
+        }
+    }
 
-            this.eventSource.onopen = () => {
-                // Reset backoff on successful connection
-                this._sseReconnectAttempts = 0;
-                this.updateConnectionStatus('connected');
-            };
+    /**
+     * Open the EventSource and bind handlers. One connection path so a retry
+     * cannot leave a second socket behind (see the close() at the top of setupSSE).
+     */
+    _connectSSE(sseUrl) {
+        this.eventSource = new EventSource(sseUrl.toString());
 
-            this.eventSource.onmessage = (event) => {
-                try {
-                    const data = JSON.parse(event.data);
-                    this.handleRealtimeUpdate(data);
-                } catch (error) {
-                    console.error('Error parsing SSE data:', error);
-                }
-            };
+        this.eventSource.onopen = () => {
+            // Reset backoff on successful connection
+            this._sseReconnectAttempts = 0;
+            this.updateConnectionStatus('connected');
+        };
 
-            // Add specific event listeners for sync progress
-            this.eventSource.addEventListener('sync_progress', (event) => {
-                try {
-                    const data = JSON.parse(event.data);
-                    this.handleSyncProgress(data);
-                } catch (error) {
-                    console.error('Error parsing sync_progress event:', error);
-                }
-            });
+        this.eventSource.onmessage = (event) => {
+            try {
+                const data = JSON.parse(event.data);
+                this.handleRealtimeUpdate(data);
+            } catch (error) {
+                console.error('Error parsing SSE data:', error);
+            }
+        };
 
-            this.eventSource.addEventListener('sync_completed', (event) => {
-                try {
-                    const data = JSON.parse(event.data);
-                    this.handleSyncCompleted(data);
-                } catch (error) {
-                    console.error('Error parsing sync_completed event:', error);
-                }
-            });
+        // Add specific event listeners for sync progress
+        this.eventSource.addEventListener('sync_progress', (event) => {
+            try {
+                const data = JSON.parse(event.data);
+                this.handleSyncProgress(data);
+            } catch (error) {
+                console.error('Error parsing sync_progress event:', error);
+            }
+        });
 
-            this.eventSource.onerror = (error) => {
-                console.error('SSE connection error:', error);
-                this.updateConnectionStatus('disconnected');
+        this.eventSource.addEventListener('sync_completed', (event) => {
+            try {
+                const d
```

**File**: `tests/unit/test_sse_ticket.py` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+"""Single-use SSE tickets (issue #1117).
+
+The bug these tests pin down: `EventSource` cannot set headers, so the web UI
+authenticated live updates with `GET /api/events?api_key=<long-lived key>`, and
+uvicorn wrote that URL into the access log on every reconnect. The fix is a
+ticket issued over POST, so the secret never appears in a URL.
+
+What matters and is asserted here:
+
+* a ticket can be redeemed **exactly once** — a replayable ticket is just a
+  shorter-lived key;
+* it stops working when its TTL expires, even if it was never used;
+* `?api_key=` is refused, so the leak cannot come back through a stale client;
+* a ticket is consumed even when it is refused (wrong scope / expired), so a
+  probe cannot learn from which failures leave the ticket behind.
+"""
+
+from __future__ import annotations
+
+import inspect
+import threading
+import time
+
+import pytest
+
+from mcp_memory_service.web.sse_ticket import (
+    DEFAULT_TTL_SECONDS,
+    TicketStore,
+    sse_tickets,
+)
+
+
+class TestTicketStore:
+    def test_issue_returns_a_usable_ticket(self):
+        store = TicketStore()
+        t = store.issue()
+        assert len(t.token) >= 32, "a bearer credential must not be short"
+        assert store.redeem(t.token) is True
+
+    def test_a_ticket_is_single_use(self):
+        store = TicketStore()
+        t = store.issue()
+        assert store.redeem(t.token) is True
+        assert store.redeem(t.token) is False, "replay must fail — a ticket that survives replay is a shorter-lived key"
+
+    def test_expired_ticket_is_refused(self):
+        # TTL of zero: anything issued is already stale.
+        store = TicketStore(ttl_seconds=0.0)
+        t = store.issue()
+        time.sleep(0.01)
+        assert store.redeem(t.token) is False
+
+    def test_expiry_cleans_the_table(self):
+        store = TicketStore(ttl_seconds=0.0)
+        store.issue()
+        time.sleep(0.01)
+        assert len(store) == 0, "expired tickets must not accumulate"
+
+    def test_scope_mismatch_is_refused_and_consumed(self):
+        store = TicketStore()
+        t = store.issue(scope="read")
+        assert store.redeem(t.token, scope="write") is False
+        # Consumed on the miss too: a wrong-scope probe must not leave the
+        # ticket alive for a second attempt with the right scope.
+        assert store.redeem(t.token, scope="read") is False
+
+    def test_unknown_ticket_is_refused(self):
+        store = TicketStore()
+        assert store.redeem("not-a-real-ticket") is False
+
+    def test_empty_and_non_string_tokens_are_refused(self):
+        store = TicketStore()
+        assert store.redeem("") is False
+        assert store.redeem(None) is False  # type: ignore[arg-type]
+
+    def test_saturated_store_refuses_rather_than_growing(self):
+        store = TicketStore()
+        # Force the table to its ceiling without minting 4096 secrets.
+        store._pending.clear()
+        from mcp_memory_service.web.sse_ticket import _MAX_PENDING, Ticket
+
+        now = time.monotonic()
+        for i in range(_MAX_PENDING):
+            store._pending[f"k{i}"] = Ticket(token=f"k{i}", expires_at=now + 60, scope="read")
+        with pytest.raises(RuntimeError):
+            store.issue()
+
+    def test_default_ttl_is_short(self):
+        # A leaked URL must be worthless almost immediately. If someone raises
+        # this into minutes, the whole point of the change is gone.
+        assert DEFAULT_TTL_SECONDS <= 60.0
+
+    def test_module_level_store_exists(self):
+        assert isinstance(sse_tickets, TicketStore)
+
+
+class TestTicketHardening:
+    """Regressions Greptile found in review. Each one names the failure."""
+
+    def test_non_ascii_token_is_refused_not_raised(self):
+        # hmac.compare_digest raises TypeError on non-ASCII, which escaped
+        # authentication as a 500 instead of a 401.
+        store = TicketStore()
+        store.issue()  # a pending ticket must be present for this to matter
+        assert store.redeem("é") is False
+        assert store.redeem("\u00e9\u00e9") is False
+
+    def test_issue_holds_the_lock_across_check_and_insert(self):
+        # The purge, size check and insert must be one critical section.
+        # Before, two concurrent callers could both pass the limit.
+        src = inspect.getsource(TicketStore.issue)
+        lock_idx = src.find("self._lock")
+        purge_idx = src.find("_purge_locked")
+        insert_idx = src.find("self._pending[token] = ticket")
+        assert lock_idx != -1 and purge_idx != -1 and insert_idx != -1
+        assert lock_idx < purge_idx < insert_idx, (
+            "issue() must acquire the lock before purging and hold it through the insert"
+        )
+
+    def test_capacity_is_enforced_under_concurrency(self):
+        # A direct check of the property the lock is there for: never exceed
+        # the ceiling, no matter how many callers arrive at once.
+        from mcp_memory_se
```

**File**: `tests/web/test_middleware.py` (modified, +59/-5)
```diff
@@ -22,6 +22,7 @@
 import pytest_asyncio
 from fastapi import Request
 from fastapi.testclient import TestClient
+import importlib
 import os
 
 @pytest_asyncio.fixture
@@ -41,7 +42,6 @@ async def temp_storage(temp_db_path):
 @pytest.fixture
 def client(temp_storage):
     """Create FastAPI test client with initialized storage and auth config."""
-    import importlib
     from mcp_memory_service import config
     from mcp_memory_service.web.app import app
 
@@ -122,12 +122,52 @@ async def test_x_api_key_header_wrong_key(self, client):
 
     @pytest.mark.asyncio
     async def test_query_parameter_success(self, client):
-        """Test successful authentication with query parameter."""
+        """`api_key` as a query parameter is refused (issue #1117).
+
+        This used to return 200 and is why the key ended up in the access log:
+        uvicorn logs the whole request line, so `?api_key=<key>` wrote the
+        long-lived secret in cleartext into the log on every reconnect. The
+        query-parameter name is kept in the test title deliberately — a reader
+        looking for "why did query auth stop working" finds the answer here.
+
+        Use the `X-API-Key` header, or a single-use ticket from
+        `POST /api/events/ticket`.
+        """
         response = client.get("/api/memories?api_key=test-secret-key-12345")
+        assert response.status_code == 401, (
+            "api_key in the query string must no longer authenticate — it is the leak"
+        )
+
+    @pytest.mark.asyncio
+    async def test_ticket_query_parameter_authenticates(self, client):
+        """The single-use ticket is the supported query-parameter credential."""
+        issued = client.post(
+            "/api/events/ticket",
+            headers={"X-API-Key": "test-secret-key-12345"},
+            json={},
+        )
+        assert issued.status_code == 200, issued.text
+        ticket = issued.json()["ticket"]
+
+        response = client.get(f"/api/memories?ticket={ticket}")
         assert response.status_code == 200
         data = response.json()
         assert "memories" in data or "total" in data
 
+    @pytest.mark.asyncio
+    async def test_ticket_cannot_be_replayed(self, client):
+        """A ticket that survives replay is just a shorter-lived key."""
+        issued = client.post(
+            "/api/events/ticket",
+            headers={"X-API-Key": "test-secret-key-12345"},
+            json={},
+        )
+        ticket = issued.json()["ticket"]
+        assert client.get(f"/api/memories?ticket={ticket}").status_code == 200
+        assert client.get(f"/api/memories?ticket={ticket}").status_code == 401, (
+            "second use of the same ticket must fail"
+        )
+
     @pytest.mark.asyncio
     async def test_query_parameter_wrong_key(self, client):
         """Test that wrong query parameter returns 401."""
@@ -259,7 +299,21 @@ async def test_api_only_deployment(self, client):
 
     @pytest.mark.asyncio
     async def test_script_access_with_query_param(self, client):
-        """Test convenient query parameter access for scripts."""
-        # Useful for quick scripts, though less secure
+        """Script-style query-param access: ticket, not api_key (issue #1117).
+
+        The old form here was `?api_key=...`, described as "convenient, though
+        less secure". It was worse than less secure: the convenience put the
+        long-lived key into a log file on every request. Scripts should send
+        `X-API-Key` as a header; only `EventSource` has an excuse to use the
+        URL, and it gets a short-lived ticket instead.
+        """
         response = client.get("/api/memories?api_key=test-secret-key-12345")
-        assert response.status_code == 200
+        assert response.status_code == 401
+
+        issued = client.post(
+            "/api/events/ticket",
+            headers={"X-API-Key": "test-secret-key-12345"},
+            json={},
+        )
+        ticket = issued.json()["ticket"]
+        assert client.get(f"/api/memories?ticket={ticket}").status_code == 200
```

---

### Incident Patch 2: `5a8e9037` (2026-10-19)
**Commit Message**: fix(mcp): propagate tool exceptions so failures reach the client as isError (#1601) (#1603)

* fix(mcp): propagar excecao de tool para o envelope sair com isError=True (#1601)

O dispatcher de tools capturava qualquer excecao e devolvia o erro como TextContent
dentro de um resultado bem-sucedido: isError ficava False e automacao (colheita,
importacao, sondas) contava como gravado o que nunca foi para o banco.

- dispatcher (server_impl.call_tool): loga e re-levanta em vez de formatar texto
- handle_store_memory / handle_store_session: recusa de escrita levanta, nao retorna
- testes de integracao no transporte real: recusa -> isError=True; aceite -> False

* changelog: fragmento do fix de isError (#1601)

* fix(mcp): atende achados do Greptile no envelope de erro (#1601)

- content vazio (memory_store) e sessao sem turno util levantam em vez de retornar texto
- recusa parcial de chunks (failed_chunks > 0) conta como falha de escrita
- endpoint FastAPI /mcp converte excecao de tool em result com isError=true (antes virava -32603)
- testes: 6 casos novos + ajuste dos que congelavam o contrato antigo de retorno-texto
- suite integracao+web: 507 passed (base limpa: 501)

**File**: `changelog.d/1601.fixed.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+- **A failed tool call now answers with `isError: true` instead of a successful
+  envelope carrying error text (#1601).** The tool dispatcher caught every
+  exception, formatted it as `{"error": ...}` and returned it as ordinary content,
+  so `isError` stayed `false` for writes that were actually refused — a duplicate
+  rejected by semantic dedup, for instance. Automation that trusts `isError`
+  (harvesters, importers, integration probes) counted those writes as stored while
+  nothing reached the database. The dispatcher now logs and re-raises, which the
+  SDK maps to `isError: true`; `memory_store` and `memory_store_session` likewise
+  raise on a refused write instead of returning the error as text.
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +31/-10)
```diff
@@ -208,7 +208,8 @@ async def handle_store_memory(server, arguments: dict) -> List[types.TextContent
     metadata = arguments.get("metadata", {})
 
     if not content:
-        return [types.TextContent(type="text", text="Error: Content is required")]
+        # Nothing to store: must not look like success (#1601).
+        raise ValueError("Content is required")
 
     try:
         # Initialize storage lazily when needed (also initializes memory_service)
@@ -244,7 +245,19 @@ async def handle_store_memory(server, arguments: dict) -> List[types.TextContent
         # Convert MemoryService result to MCP response format
         if not result.get("success"):
             error_msg = result.get("error", "Unknown error")
-            return [types.TextContent(type="text", text=f"Error storing memory: {error_msg}")]
+            # A refused write is a failure. Return-as-text made the MCP envelope
+            # report isError=False while nothing was stored, so automation counted
+            # it as success (#1601). Raise: the SDK answers isError=True.
+            raise RuntimeError(f"Error storing memory: {error_msg}")
+
+        # Partial writes are failures too: some chunks never reached the database,
+        # so reporting success lets a harvester skip them permanently (#1601).
+        failed_chunks = result.get("failed_chunks") or 0
+        if failed_chunks:
+            raise RuntimeError(
+                f"Error storing memory: {failed_chunks} of "
+                f"{result.get('total_chunks', '?')} chunks failed to store"
+            )
 
         if "memories" in result:
             # Chunked response - multiple memories created
@@ -377,7 +390,8 @@ async def handle_store_memory(server, arguments: dict) -> List[types.TextContent
 
     except Exception as e:
         logger.error("Error storing memory: %s\n%s", _sanitize_log_value(e), traceback.format_exc())
-        return [types.TextContent(type="text", text=f"Error storing memory: {str(e)}")]
+        # Re-raise: a failed write must reach the caller as isError=True (#1601).
+        raise
 
 
 async def handle_memory_observe(server, arguments: dict) -> List[types.TextContent]:
@@ -464,7 +478,8 @@ async def handle_store_session(server, arguments: dict) -> List[types.TextConten
         if content:
             lines.append(f"[{role}] {content}")
     if not lines:
-        return [types.TextContent(type="text", text="Error: all turns have empty content")]
+        # Nothing to store: raise so the envelope reports a failure (#1601).
+        raise ValueError("all turns have empty content")
 
     full_content = "\n".join(lines)
     base_tags = [f"session:{session_id}"] + extra_tags
@@ -491,7 +506,10 @@ async def handle_store_session(server, arguments: dict) -> List[types.TextConten
                 store=store,
             )
             if not result.get("success"):
-                return [types.TextContent(type="text", text=f"Error storing session: {result.get('error', 'Unknown error')}")]
+                # Refused write = failure; raise so the SDK sets isError=True (#1601).
+                raise RuntimeError(
+                    f"Error storing session: {result.get('error', 'Unknown error')}"
+                )
             memory_hash = result["memory"]["content_hash"]
             return [types.TextContent(
                 type="text",
@@ -516,10 +534,11 @@ async def handle_store_session(server, arguments: dict) -> List[types.TextConten
             )
             if not result.get("success"):
                 error = result.get("error", "Unknown error")
-                return [types.TextContent(
-                    type="text",
-                    text=f"Error storing session chunk {i+1}/{len(chunks)}: {error} (stored {stored}/{len(chunks)} before failure)"
-                )]
+                # Partial chunk failure is still a failure for the caller: raise (#1601).
+                raise RuntimeError(
+                    f"Error storing session chunk {i+1}/{len(chunks)}: {error} "
+                    f"(stored {stored}/{len(chunks)} before failure)"
+                )
             stored += 1
 
         return [types.TextContent(
@@ -528,7 +547,9 @@ async def handle_store_session(server, arguments: dict) -> List[types.TextConten
         )]
     except Exception as e:
         logger.error("Error storing session: %s\n%s", _sanitize_log_value(e), traceback.format_exc())
-        return [types.TextContent(type="text", text=f"Error storing session: {str(e)}")]
+        # Re-raise: a failed write must reach the client as isError=True (#1601),
+        # not as a successful envelope carrying error text.
+        raise
 
 
 def _chunk_session_lines(lines: List[str], chunk_size: int) -> List[List[str]]:
```

**File**: `src/mcp_memory_service/server_impl.py` (modified, +5/-2)
```diff
@@ -1629,8 +1629,11 @@ async def call_tool(self, name: str, arguments: dict | None) -> List[types.TextC
             return [types.TextContent(type="text", text=str(result))]
         except Exception as e:
             logger.error("Error in tool %s: %s", _sanitize_log_value(name), _sanitize_log_value(e), exc_info=True)
-            error_response = json.dumps({"error": str(e)})
-            return [types.TextContent(type="text", text=error_response)]
+            # Propagate instead of returning the error as text: the SDK maps an
+            # exception to isError=True, which is the only signal automation can
+            # trust. Returning TextContent made every failed tool look successful
+            # (#1601), so harvesters advanced their cursors over lost payloads.
+            raise
 
     async def handle_call_tool(self, name: str, arguments: dict | None) -> List[types.TextContent]:
         """Public alias for call_tool (used by tests)."""
```

**File**: `src/mcp_memory_service/web/api/mcp.py` (modified, +24/-3)
```diff
@@ -12,6 +12,7 @@
 
 from fastapi import APIRouter, Depends, Response, Request
 from fastapi.responses import JSONResponse
+import mcp.types as types
 from pydantic import BaseModel, ConfigDict
 
 from ..._version import __version__
@@ -124,14 +125,17 @@ def _tool_to_dict(tool) -> Dict[str, Any]:
     }
 
 
-def _wrap_tool_result(text_contents) -> Dict[str, Any]:
+def _wrap_tool_result(text_contents, is_error: bool = False) -> Dict[str, Any]:
     """Pack a `list[mcp.types.TextContent]` into an MCP `tools/call` result."""
-    return {
+    result: Dict[str, Any] = {
         "content": [
             {"type": "text", "text": tc.text}
             for tc in text_contents
         ]
     }
+    if is_error:
+        result["isError"] = True
+    return result
 
 
 @router.post("/")
@@ -234,7 +238,24 @@ async def mcp_endpoint(
                 if header_agent_id:
                     arguments["agent_id"] = header_agent_id.strip()
 
-            text_contents = await server.call_tool(tool_name, arguments)
+            # This path bypasses the SDK wrapper, so a tool exception would surface
+            # as JSON-RPC -32603 (a request error) instead of the tool result with
+            # isError=true that MCP promises. Convert it here (#1601).
+            try:
+                text_contents = await server.call_tool(tool_name, arguments)
+            except Exception as tool_error:
+                logger.warning(
+                    "Tool %s failed: %s",
+                    _sanitize_log_value(tool_name),
+                    _sanitize_log_value(tool_error),
+                )
+                text_contents = [types.TextContent(type="text", text=str(tool_error))]
+                response = MCPResponse(
+                    id=request.id,
+                    result=_wrap_tool_result(text_contents, is_error=True),
+                )
+                return JSONResponse(content=response.model_dump(exclude_none=True))
+
             response = MCPResponse(
                 id=request.id,
                 result=_wrap_tool_result(text_contents),
```

**File**: `tests/integration/test_server_handlers.py` (modified, +12/-34)
```diff
@@ -65,35 +65,19 @@ async def test_store_memory_chunked(self, unique_content):
 
     @pytest.mark.asyncio
     async def test_store_memory_empty_content(self):
-        """Test storing empty content returns error."""
+        """Empty content is rejected by raising, so the envelope reports isError (#1601)."""
         server = MemoryServer()
 
-        result = await server.handle_store_memory({
-            "content": "",
-            "metadata": {}
-        })
-
-        # Verify error message
-        assert isinstance(result, list)
-        assert len(result) == 1
-        text = result[0].text
-        assert "error" in text.lower()
-        assert "required" in text.lower()
+        with pytest.raises(ValueError, match="[Cc]ontent is required"):
+            await server.handle_store_memory({"content": "", "metadata": {}})
 
     @pytest.mark.asyncio
     async def test_store_memory_missing_content(self):
-        """Test storing without content parameter returns error."""
+        """Missing content is rejected by raising (#1601)."""
         server = MemoryServer()
 
-        result = await server.handle_store_memory({
-            "metadata": {"tags": ["test"]}
-        })
-
-        # Verify error message
-        assert isinstance(result, list)
-        assert len(result) == 1
-        text = result[0].text
-        assert "error" in text.lower()
+        with pytest.raises(ValueError, match="[Cc]ontent is required"):
+            await server.handle_store_memory({"metadata": {"tags": ["test"]}})
 
     @pytest.mark.asyncio
     async def test_store_memory_with_tags_string(self, unique_content):
@@ -279,18 +263,12 @@ async def test_error_handling_without_keyerror(self):
         """Verify fix for issue #198: Errors handled without KeyError."""
         server = MemoryServer()
 
-        # Store with empty content (triggers error path)
-        result = await server.handle_store_memory({
-            "content": "",
-            "metadata": {}
-        })
-
-        # Should return error message without KeyError
-        assert isinstance(result, list)
-        assert len(result) == 1
-        assert "error" in result[0].text.lower()
-        # Should NOT be KeyError message
-        assert "'message'" not in result[0].text
+        # Empty content now raises (isError path); the guarantee under test is that
+        # the failure never surfaces as a KeyError (#198).
+        with pytest.raises(ValueError) as excinfo:
+            await server.handle_store_memory({"content": "", "metadata": {}})
+        assert not isinstance(excinfo.value, KeyError)
+        assert "'message'" not in str(excinfo.value)
 
 
 class TestGetCacheStats:
```

**File**: `tests/integration/test_store_error_envelope.py` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+"""Envelope de erro do MCP: gravação recusada tem de sair com ``isError=True``.
+
+Defeito (#1601): ``handle_store_memory`` devolvia ``TextContent`` com o texto
+"Error storing memory: ..." dentro de um resultado bem-sucedido. O ``isError``
+do envelope ficava ``False``, então automação (colheita, importação, sondas de
+teste) contava como gravado algo que nunca foi para o banco.
+
+O padrão do repo já está documentado no dispatch de ``server_impl``: levantar
+exceção faz o SDK responder ``isError=True``.
+"""
+
+import uuid
+
+import pytest
+from mcp import ClientSession
+from mcp.client.streamable_http import streamablehttp_client
+
+from tests.integration.test_agent_id_streamable_header import StreamableService
+
+
+@pytest.fixture
+async def service(tmp_path):
+    svc = StreamableService(str(tmp_path / "store_error.db"))
+    await svc.start()
+    try:
+        yield svc
+    finally:
+        await svc.stop()
+
+
+async def _store(mcp_url: str, content: str):
+    async with streamablehttp_client(mcp_url) as (read, write, _):
+        async with ClientSession(read, write) as session:
+            await session.initialize()
+            return await session.call_tool("memory_store", {"content": content})
+
+
+@pytest.mark.asyncio
+async def test_refused_write_reports_iserror(service):
+    """Segunda gravação do mesmo conteúdo é recusada e o envelope diz isError."""
+    content = f"envelope probe {uuid.uuid4()}"
+
+    first = await _store(service.mcp_url, content)
+    assert not first.isError, "a primeira gravação deveria ser aceita"
+
+    second = await _store(service.mcp_url, content)
+    assert second.isError is True, (
+        "gravação recusada deve sair com isError=True; "
+        f"recebido isError={second.isError!r}"
+    )
+    text = " ".join(getattr(c, "text", "") for c in second.content)
+    assert "Error" in text or "Duplicate" in text, "a mensagem do erro deve chegar ao cliente"
+
+
+@pytest.mark.asyncio
+async def test_accepted_write_keeps_iserror_false(service):
+    """Guarda: gravação aceita continua com isError=False."""
+    result = await _store(service.mcp_url, f"envelope ok {uuid.uuid4()}")
+    assert not result.isError
+
+
+@pytest.mark.asyncio
+async def test_empty_content_reports_iserror(service):
+    """Payload vazio não grava nada, então não pode parecer sucesso (Greptile P1)."""
+    async with streamablehttp_client(service.mcp_url) as (read, write, _):
+        async with ClientSession(read, write) as session:
+            await session.initialize()
+            result = await session.call_tool("memory_store", {"content": ""})
+    assert result.isError is True
+
+
+@pytest.mark.asyncio
+async def test_empty_session_reports_iserror(service):
+    """Sessão cujos turnos são só espaço não grava nada — e deve falhar (Greptile P1)."""
+    async with streamablehttp_client(service.mcp_url) as (read, write, _):
+        async with ClientSession(read, write) as session:
+            await session.initialize()
+            result = await session.call_tool(
+                "memory_store_session",
+                {"turns": [{"role": "user", "content": "   "}]},
+            )
+    assert result.isError is True
+
+
+def test_wrap_tool_result_marks_error():
+    """O caminho HTTP (sem wrapper do SDK) precisa poder marcar isError (Greptile P1)."""
+    import mcp.types as types
+
+    from mcp_memory_service.web.api.mcp import _wrap_tool_result
+
+    ok = _wrap_tool_result([types.TextContent(type="text", text="stored")])
+    assert "isError" not in ok or ok["isError"] is False
+
+    failed = _wrap_tool_result([types.TextContent(type="text", text="boom")], is_error=True)
+    assert failed["isError"] is True
+    assert failed["content"][0]["text"] == "boom"
+
+
+@pytest.mark.asyncio
+async def test_partial_chunks_report_iserror():
+    """Chunks que falharam não podem sair como sucesso (Greptile P1).
+
+    ``MemoryService.store_memory`` devolve ``success: True`` com ``failed_chunks``
+    positivo quando parte dos chunks não entrou; o handler precisa tratar isso
+    como falha, senão a colheita pula conteúdo que nunca foi salvo.
+    """
+    from mcp_memory_service.server.handlers.memory import handle_store_memory
+
+    class _FakeService:
+        async def store_memory(self, **kwargs):
+            return {"success": True, "memories": [], "total_chunks": 3, "failed_chunks": 1}
+
+    class _FakeServer:
+        memory_service = _FakeService()
+
+        async def _ensure_storage_initialized(self):
+            return None
+
+    with pytest.raises(RuntimeError, match="chunks failed to store"):
+        await handle_store_memory(_FakeServer(), {"content": "conteudo com chunks"})
```

**File**: `tests/integration/test_unified_handlers.py` (modified, +23/-16)
```diff
@@ -16,6 +16,21 @@
 from mcp_memory_service.server import MemoryServer
 
 
+async def _store_fixture(server, content: str, tags: list[str]) -> None:
+    """Store a fixture memory, tolerating a semantic-dedup refusal.
+
+    These tests exercise delete/list, not the write path. Since #1601 a refused
+    write raises instead of returning text, so an already-similar fixture would
+    abort the test for a reason it does not care about. Any other error still
+    propagates.
+    """
+    try:
+        await server.handle_store_memory({"content": content, "metadata": {"tags": tags}})
+    except RuntimeError as exc:
+        if "Duplicate content" not in str(exc):
+            raise
+
+
 class TestHandleMemorySearch:
     """Tests for unified handle_memory_search handler."""
 
@@ -176,14 +191,8 @@ async def test_delete_by_tags_any_match(self, unique_content):
         server = MemoryServer()
 
         # Store memories with different tags
-        await server.handle_store_memory({
-            "content": unique_content("Delete tag any 1"),
-            "metadata": {"tags": ["delete-any-a", "common"]}
-        })
-        await server.handle_store_memory({
-            "content": unique_content("Delete tag any 2"),
-            "metadata": {"tags": ["delete-any-b", "common"]}
-        })
+        await _store_fixture(server, unique_content("Delete tag any 1"), ["delete-any-a", "common"])
+        await _store_fixture(server, unique_content("Delete tag any 2"), ["delete-any-b", "common"])
 
         # Delete with ANY match (matches either tag)
         result = await server.handle_memory_delete({
@@ -269,10 +278,9 @@ async def test_list_with_pagination(self, unique_content):
 
         # Store some test memories
         for i in range(5):
-            await server.handle_store_memory({
-                "content": unique_content(f"List pagination test {i}"),
-                "metadata": {"tags": ["list-pagination-test"]}
-            })
+            await _store_fixture(
+                server, unique_content(f"List pagination test {i}"), ["list-pagination-test"]
+            )
 
         # List with pagination
         result = await server.handle_memory_list({
@@ -290,10 +298,9 @@ async def test_list_filtered_by_tags(self, unique_content):
         server = MemoryServer()
 
         # Store with specific tag
-        await server.handle_store_memory({
-            "content": unique_content("Tagged memory for list filter"),
-            "metadata": {"tags": ["list-filter-tag"]}
-        })
+        await _store_fixture(
+            server, unique_content("Tagged memory for list filter"), ["list-filter-tag"]
+        )
 
         # List filtered by tag
         result = await server.handle_memory_list({
```

---

### Incident Patch 3: `4cafa14e` (2026-10-19)
**Commit Message**: fix(oauth): raise and make configurable the OAuth state length limit (#1554)

* fix(oauth): raise and make configurable the OAuth state length limit

Google Gemini custom apps send an opaque state of ~2400 characters,
which exceeded the hardcoded MAX_STATE_LEN=1024 and caused /oauth/authorize
to reject the request before the login page was shown.

Make MAX_STATE_LEN (and the related scope/redirect caps) read from the
environment via safe_get_int_env with a raised default of 4096, matching
the pattern used by other OAuth settings. Operators can now accommodate
longer clients without patching source.

Fixes #1553

Signed-off-by: Om Patil <[REDACTED_EMAIL]>

* fix(oauth): address review feedback on state length limit

- Restore MAX_SCOPE_LEN default to 1024 (still configurable)
- Make test_max_state_len_is_env_configurable reload the limits module
  and assert boundary behaviour with reject_if_too_long
- Add changelog.d/1554.fixed.md describing the Gemini 400 and the new env vars

* test(oauth): isolate MAX_STATE_LEN tests in fresh processes

Addresses Greptile review comments:
- Default test now runs with MCP_OAUTH_MAX_STATE_LEN unset in a
  subprocess so local developer env cannot c

**File**: `changelog.d/1554.fixed.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- **Gemini custom apps rejected with HTTP 400 at /oauth/authorize due to OAuth state length limit (#1554, #1553).**
+  The hard-coded 1024-character cap on the OAuth `state` parameter was too low for some clients (Gemini custom apps send ~2400 characters). `MCP_OAUTH_MAX_STATE_LEN`, `MCP_OAUTH_MAX_SCOPE_LEN` and `MCP_OAUTH_MAX_REDIRECT_URI_LEN` are now configurable via environment variables (defaults: 4096 / 1024 / 2048). These limits are read at process startup; changing them requires a restart.
```

**File**: `src/mcp_memory_service/web/oauth/limits.py` (modified, +9/-3)
```diff
@@ -26,6 +26,8 @@
 
 from fastapi import HTTPException, status
 
+from mcp_memory_service.config.base import safe_get_int_env
+
 # RFC 7636 §4.1: code_verifier is 43-128 unreserved characters.
 PKCE_CODE_VERIFIER_MIN_LEN = 43
 PKCE_CODE_VERIFIER_MAX_LEN = 128
@@ -43,9 +45,13 @@
 MAX_CLIENT_SECRET_LEN = 512
 MAX_AUTHORIZATION_CODE_LEN = 512
 MAX_REFRESH_TOKEN_LEN = 1024
-MAX_SCOPE_LEN = 1024
-MAX_STATE_LEN = 1024
-MAX_REDIRECT_URI_LEN = 2048
+# Configurable upper bounds so operators can accommodate clients with
+# unusually long opaque parameters (e.g. Google Gemini's ~2400-char OAuth
+# state) without patching source. Defaults raised from the previous hard
+# 1024 to give headroom while still bounding abusive input.
+MAX_SCOPE_LEN = safe_get_int_env("MCP_OAUTH_MAX_SCOPE_LEN", 1024, min_value=256, max_value=8192)
+MAX_STATE_LEN = safe_get_int_env("MCP_OAUTH_MAX_STATE_LEN", 4096, min_value=256, max_value=16384)
+MAX_REDIRECT_URI_LEN = safe_get_int_env("MCP_OAUTH_MAX_REDIRECT_URI_LEN", 2048, min_value=256, max_value=8192)
 
 # Bearer/JWT tokens and API keys arriving via header or query string.
 MAX_JWT_LEN = 8192
```

**File**: `tests/web/test_oauth_hardening.py` (modified, +88/-0)
```diff
@@ -608,3 +608,91 @@ async def test_full_reported_chain_is_broken_end_to_end(gated_dcr):
                 reg.client_id, stored.client_secret or "anything"
             )
     assert exc.value.status_code == 401
+
+
+# ---------------------------------------------------------------------------
+# OAuth state length (issue #1553 — Google Gemini custom apps)
+# ---------------------------------------------------------------------------
+
+def test_max_state_len_default_accommodates_long_clients():
+    """Default MAX_STATE_LEN must accept ~2400-char state values used by Gemini.
+
+    Runs in a fresh process with MCP_OAUTH_MAX_STATE_LEN unset so local
+    developer settings cannot cause false failures.
+    """
+    import os
+    import subprocess
+    import sys
+
+    code = """
+import os
+os.environ.pop("MCP_OAUTH_MAX_STATE_LEN", None)
+from fastapi import HTTPException
+from mcp_memory_service.web.oauth import limits
+assert limits.MAX_STATE_LEN == 4096, f"got {limits.MAX_STATE_LEN}"
+limits.reject_if_too_long("s" * 2500, limits.MAX_STATE_LEN, "state")
+try:
+    limits.reject_if_too_long("s" * (limits.MAX_STATE_LEN + 1), limits.MAX_STATE_LEN, "state")
+except HTTPException as e:
+    assert e.status_code == 400, e.status_code
+    assert e.detail["error"] == "invalid_request", e.detail
+    assert e.detail["error_description"] == (
+        f"state exceeds maximum length of {limits.MAX_STATE_LEN} characters"
+    ), e.detail
+else:
+    raise SystemExit("should have raised")
+print("ok")
+"""
+    env = os.environ.copy()
+    env.pop("MCP_OAUTH_MAX_STATE_LEN", None)
+    result = subprocess.run(
+        [sys.executable, "-c", code],
+        env=env,
+        capture_output=True,
+        text=True,
+        timeout=30,
+    )
+    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
+    assert "ok" in result.stdout
+
+
+def test_max_state_len_is_env_configurable():
+    """Operators can raise the cap via MCP_OAUTH_MAX_STATE_LEN without code changes.
+
+    Uses an isolated subprocess so the module is imported with the env var
+    already set (avoids relying on reload of an already-imported module).
+    """
+    import os
+    import subprocess
+    import sys
+
+    code = """
+import os
+os.environ["MCP_OAUTH_MAX_STATE_LEN"] = "8000"
+from fastapi import HTTPException
+from mcp_memory_service.web.oauth import limits
+assert limits.MAX_STATE_LEN == 8000, f"got {limits.MAX_STATE_LEN}"
+limits.reject_if_too_long("x" * 8000, limits.MAX_STATE_LEN, "state")
+try:
+    limits.reject_if_too_long("x" * 8001, limits.MAX_STATE_LEN, "state")
+except HTTPException as e:
+    assert e.status_code == 400, e.status_code
+    assert e.detail["error"] == "invalid_request", e.detail
+    assert e.detail["error_description"] == (
+        "state exceeds maximum length of 8000 characters"
+    ), e.detail
+else:
+    raise SystemExit("should have raised")
+print("ok")
+"""
+    env = os.environ.copy()
+    env["MCP_OAUTH_MAX_STATE_LEN"] = "8000"
+    result = subprocess.run(
+        [sys.executable, "-c", code],
+        env=env,
+        capture_output=True,
+        text=True,
+        timeout=30,
+    )
+    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
+    assert "ok" in result.stdout
```

#### Recent Merged Pull Requests:
- **PR #1603** (2026-10-19): fix(mcp): propagate tool exceptions so failures reach the client as isError (#1601) (@filhocf)
- **PR #1600** (2026-10-19): docs: point docker build at tools/docker/Dockerfile (@doobidoo)
- **PR #1598** (2026-10-19): fix(mcp): honour X-Agent-ID on the streamable-http transport (#1597) (@filhocf)
- **PR #1595** (2026-10-19): fix(consolidation): key SQLite memory connections by content hash so decay boosts linked memories (@debashishthakur)
- **PR #1591** (2026-10-19): docs(sqlite-vec): document store scoping across search modes (@filhocf)
- **PR #1590** (2026-10-19): fix(services): over-fetch before filtering by tags/memory_type in retrieve_memories (@filhocf)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. web): stop putting the long-lived API key in SSE URLs (#1117) (#1539)

**RULE**:
When implementing operations in `changelog.d/1117.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b29d353f`: web): stop putting the long-lived API key in SSE URLs (#1117) (#1539). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1117.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **The dashboard stopped putting the long-lived API key in SSE URLs (#1117).**
  `EventSource` cannot set an `Authorization` header, so the web UI authenticated
  every live-update connection with `GET /api/events?api_key=<key>`. uvicorn's
  access log records the whole request line, so each SSE connection — and every
  automatic reconnect — wrote the key in cleartext into
  `~/.local/share/mcp-memory/logs/server.log`. TLS does not help there: it
  protects the wire, not the log. The file outlives the session and gets pasted
  into bug reports. Access-log redaction had already landed, which hid the leak
  without closing it.

  `POST /api/events/ticket` now exchanges real credentials (Bearer or
  `X-API-Key` header) for a ticket that is single-use and expires in 60 seconds,
  and the browser connects with `?ticket=…`. A pasted log line now holds
  something that is dead within a minute and cannot be replayed. The
  `?api_key=` query parameter is **no longer accepted** — requests using it get
  a warning naming the migration rather than a silent 401. `X-API-Key` as a
  header is unchanged, since headers do not reach the access log.

  The OAuth `?token=` query fallback still exists
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b29d353f` are properly handled with clean fallback behavior.
