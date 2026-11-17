> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `30f9eb40`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T01:54:47.008Z  
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
> **Harvest Timestamp**: 2026-11-17T01:54:47.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2133 stars

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
const { collectInboxBlock } = require('../utilities/inbox');

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
                            location: `${protocol}://${chromaHost}:${chromaP
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
- **Issue #2030** (2026-11-16): **[Bug]: time_expr "between november and january" returns an inverted range and matches nothing**
  *Symptoms*: ### Bug Description  A `between` range over month names that crosses New Year comes back with the start after the end, so `memory_search(time_expr=...)` returns no memories at all, with no error.  `between november and january` (run on 2026-11-15) resolves to 2026-11-01 .. 2026-01-31. Each month rolls back to its most recent occurrence on its own, and the start is never moved to the previous year. This happens for every cross-year month range whose first month is the current month or earlier (e.g. "between october and march" today), so for most of the year these searches are always empty. Yearless M/D ranges were fixed for the same problem in #1347; month names were not.  ### Steps to Reproduce  1. Clone main and install: `pip install -e .` 2. Save the script below as `repro_between_months.py` 3. Run `python repro_between_months.py`  ```python import asyncio, hashlib, logging, os, tempfile from datetime import datetime, timezone  tmp = tempfile.mkdtemp(prefix="mcp-repro-") os.environ["MCP_MEMORY_BASE_DIR"] = tmp os.environ["MCP_MEMORY_ALLOW_HASH_EMBEDDINGS"] = "1" logging.disable(logging.CRITICAL)  from mcp_memory_service.models.memory import Memory from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage from mcp_memory_service.utils.time_parser import parse_time_expression   def memory(content, when):     m = Memory(content=content, content_hash=hashlib.sha256(content.encode()).hexdigest(),                tags=["repro"], memory_type="note")     m.created_at 

- **Issue #2029** (2026-11-16): **[Bug]: time_expr "day before yesterday" selects yesterday**
  *Symptoms*: ### Bug Description  `parse_time_expression("day before yesterday")` returns yesterday's window, so `memory_search(time_expr="day before yesterday")` silently returns the wrong day's memories, with no error. The parser matches the word "yesterday" inside the phrase and ignores "day before". `extract_time_expression` has the same problem and leaves "day before" in the search text.  ### Steps to Reproduce  1. Clone main and install: `pip install -e .` 2. Save the script below as `repro_day_before_yesterday.py` 3. Run `python repro_day_before_yesterday.py`  ```python import asyncio, hashlib, logging, os, tempfile from datetime import datetime, timedelta, timezone  tmp = tempfile.mkdtemp(prefix="mcp-repro-") os.environ["MCP_MEMORY_BASE_DIR"] = tmp os.environ["MCP_MEMORY_ALLOW_HASH_EMBEDDINGS"] = "1" logging.disable(logging.CRITICAL)  from mcp_memory_service.models.memory import Memory from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage from mcp_memory_service.utils.time_parser import parse_time_expression   def memory(content, when):     m = Memory(content=content, content_hash=hashlib.sha256(content.encode()).hexdigest(),                tags=["repro"], memory_type="note")     m.created_at = when.timestamp()     m.created_at_iso = datetime.fromtimestamp(m.created_at, tz=timezone.utc).isoformat()     return m   async def main():     noon = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)     storage = SqliteVecMemoryStorage(os.path.join(tmp, 

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

### Incident Patch 1: `15a9e9a9` (2026-11-16)
**Commit Message**: fix(security): keep memory_store side effects inside the granted store (GHSA-989p-hfjf-q97q) (#2036)

* fix(security): keep auto-capture and the NLI check inside the granted store (GHSA-989p-hfjf-q97q)

A client holding only write:<store> could overwrite the default store
through memory_store. handle_store_memory wrote the memory to the granted
store but ran auto-capture without it: capture(), _try_evolve() and
evolve_memory() took no store, so extracted candidates were compared with
"default", replaced a similar memory there or were inserted there.

The NLI contradiction check on store had the same gap, inline and in the
background task: it searched "default" whatever store the memory went to,
linked the two with a contradicts edge and reported the hit count. For the
same reason it missed contradictions inside a named store.

store is now passed down all of these paths, and evolve_memory() refuses a
hash from another store on its own. The handler forwards the store the
caller named rather than its "default" fallback: forwarding the fallback
would have switched evolution off for every caller on a backend whose
get_by_hash ignores store (Cloudflare, Milvus).

The auto-capture and NL

**File**: `changelog.d/ghsa-989p.fixed.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- **A per-store write grant could write to and supersede memories in another store through `memory_store` (GHSA-989p-hfjf-q97q, reported by [RISCON Labs](https://www.risconlabs.com), @RISCON-Labs).**
+  With `auto_extract=true`, `handle_store_memory` stored the memory in the granted store but ran auto-capture without it. `AutoCaptureService.capture()`, `SessionHarvester._try_evolve()` and `MemoryService.evolve_memory()` took no `store`, so the extracted candidates were compared with the `default` store, replaced a similar memory there, or were inserted there. A client holding only `write:projectA` could overwrite `default`. The NLI contradiction check on store (`MCP_NLI_ON_STORE`, inline and background) had the same gap: it compared a memory with the `default` store whatever store it was written to, linked the two with a `contradicts` edge and reported the hit count to the caller. It also missed contradictions inside a named store for the same reason. Conflict detection on store, which runs on every write without any flag, compared the new memory with every store as well and tagged a near-identical memory in another store `conflict:unresolved`, with `contradicts` edges between the two; it is confined to the store of the write now. `store` is now passed down all of these paths, and `evolve_memory()` refuses a hash from another store by itself. Setting `MCP_AUTO_EXTRACT_DEFAULT=false` was never a mitigation: an explicit `auto_extract` argument wins. Affected: 12.4.0 to 12.10.0, on backends that confine by store (sqlite-vec, hybrid). On Cloudflare and Milvus a per-store grant never authorized these calls; there, auto-capture for a named store now stores candidates in that store without evolving existing ones.
```

**File**: `src/mcp_memory_service/consolidation/quarantine.py` (modified, +2/-1)
```diff
@@ -357,8 +357,9 @@ async def _run_on_store_checks(
         try:
             from ..reasoning.nli import detect_contradictions_nli
 
+            nli_store_kw = {"store": store} if store is not None else {}
             result = await detect_contradictions_nli(
-                storage, memory_hash=content_hash, dry_run=False
+                storage, memory_hash=content_hash, dry_run=False, **nli_store_kw
             )
             pairs_detected = result.get("pairs_detected", 0)
             logger.info(
```

**File**: `src/mcp_memory_service/harvest/auto_capture.py` (modified, +31/-16)
```diff
@@ -76,6 +76,32 @@ def extract_from_text(self, text: str, role: str = "assistant") -> List[HarvestC
             if c.confidence >= self.min_confidence and c.memory_type in self.types
         ]
 
+    async def _store_candidate(
+        self,
+        candidate,
+        parent_hash: Optional[str],
+        conversation_id: Optional[str],
+        store: Optional[str],
+    ) -> Dict[str, Any]:
+        """Store one candidate as its own memory, in ``store`` when one is named."""
+        tags = ["auto-capture"] + candidate.tags
+        if parent_hash:
+            tags.append(f"source:{parent_hash[:12]}")
+        # An unnamed store is left to store_memory()'s default.
+        store_kw: Dict[str, Any] = {"store": store} if store is not None else {}
+        return await self.memory_service.store_memory(
+            content=candidate.content,
+            tags=tags,
+            memory_type=candidate.memory_type,
+            metadata={
+                "confidence": candidate.confidence,
+                "source": "auto_capture",
+                "extracted_from": parent_hash,
+            },
+            conversation_id=conversation_id,
+            **store_kw,
+        )
+
     async def capture(
         self,
         text: str,
@@ -86,6 +112,7 @@ async def capture(
         dry_run: bool = True,
         link_parent: bool = True,
         harvest_config: Optional[HarvestConfig] = None,
+        store: Optional[str] = None,
     ) -> AutoCaptureResult:
         """Extract candidates and optionally store them with graph links."""
         candidates = self.extract_from_text(text, role=role)
@@ -106,7 +133,9 @@ async def capture(
 
         for candidate in candidates:
             try:
-                evolved, child_hash = await self._harvester._try_evolve(candidate, config)
+                evolved, child_hash = await self._harvester._try_evolve(
+                    candidate, config, store=store
+                )
                 if evolved:
                     result.evolved += 1
                     result.stored += 1
@@ -119,21 +148,7 @@ async def capture(
                         )
                     continue
 
-                tags = ["auto-capture"] + candidate.tags
-                if parent_hash:
-                    tags.append(f"source:{parent_hash[:12]}")
-
-                resp = await self.memory_service.store_memory(
-                    content=candidate.content,
-                    tags=tags,
-                    memory_type=candidate.memory_type,
-                    metadata={
-                        "confidence": candidate.confidence,
-                        "source": "auto_capture",
-                        "extracted_from": parent_hash,
-                    },
-                    conversation_id=conversation_id,
-                )
+                resp = await self._store_candidate(candidate, parent_hash, conversation_id, store)
 
                 if not (isinstance(resp, dict) and resp.get("success")):
                     if isinstance(resp, dict) and resp.get("refused_recreate"):
```

**File**: `src/mcp_memory_service/harvest/harvester.py` (modified, +14/-1)
```diff
@@ -342,7 +342,9 @@ def _is_older_statement(candidate, existing) -> bool:
         existing_time = memory_statement_time(existing)
         return existing_time is not None and candidate_time < existing_time
 
-    async def _try_evolve(self, candidate, config: "HarvestConfig", metadata=None):
+    async def _try_evolve(
+        self, candidate, config: "HarvestConfig", metadata=None, store: Optional[str] = None
+    ):
         """Check for similar active memory; if found, evolve it.
 
         Returns ``(evolved, new_hash)``. ``evolved`` is True when an existing
@@ -357,11 +359,21 @@ async def _try_evolve(self, candidate, config: "HarvestConfig", metadata=None):
         if not hasattr(self.memory_service, "storage") or not self.memory_service.storage:
             return False, None
 
+        # A caller confined to one store may only evolve a memory of that store.
+        # Where get_by_hash ignores ``store`` that cannot be guaranteed, so the
+        # candidate is stored as its own memory instead (as memory_update refuses).
+        store_kw = {}
+        if store not in (None, "all"):
+            if not getattr(self.memory_service.storage, "get_by_hash_is_store_scoped", False):
+                return False, None
+            store_kw = {"store": store}
+
         try:
             similar = await self.memory_service.storage.retrieve(
                 candidate.content,
                 n_results=1,
                 min_confidence=config.min_confidence_to_evolve,
+                **store_kw,
             )
         except Exception as e:
             logger.debug("Similarity check failed, falling back to store: %s", _sanitize_log_value(str(e)))
@@ -390,6 +402,7 @@ async def _try_evolve(self, candidate, config: "HarvestConfig", metadata=None):
                 memory_type=candidate.memory_type,
                 metadata=metadata if metadata is not None else default_metadata,
                 reason=f"Session harvest: {datetime.now(timezone.utc).isoformat()}",
+                **store_kw,
             )
             if ok:
                 logger.info("Evolved memory %s→%s", existing_hash[:8], new_hash[:8] if new_hash else "?")
```

**File**: `src/mcp_memory_service/reasoning/nli.py` (modified, +24/-14)
```diff
@@ -21,7 +21,7 @@
 import os
 import re
 from dataclasses import dataclass
-from typing import List, Tuple
+from typing import Any, Dict, List, Optional, Tuple
 
 from .nli_patterns import load_nli_patterns
 from ..config.locale import get_active_locales
@@ -439,8 +439,22 @@ async def _classify_band(
     return contradictions
 
 
+async def _entity_candidates(graph, entities, memory_hash: str) -> set:
+    """Hashes of the other memories that share an entity with ``memory_hash``."""
+    candidate_hashes = set()
+    for entity in entities:
+        try:
+            hashes = await graph.find_memories_by_entity(entity)
+            if hashes:
+                candidate_hashes.update(hashes)
+        except Exception:
+            continue
+    candidate_hashes.discard(memory_hash)
+    return candidate_hashes
+
+
 async def detect_contradictions_nli(
-    storage, memory_hash: str = None, dry_run: bool = True
+    storage, memory_hash: str = None, dry_run: bool = True, store: Optional[str] = None
 ) -> dict:
     """
     NLI-enhanced contradiction detection — 4-stage pipeline.
@@ -466,8 +480,13 @@ async def detect_contradictions_nli(
     if memory_hash is None:
         return result
 
+    # Compare only inside the store the memory was written to. Omitted, the
+    # search below falls back to "default" and a memory in another store gets
+    # compared with, and linked to, the default store's memories.
+    store_kw: Dict[str, Any] = {} if store in (None, "all") else {"store": store}
+
     # Get the source memory
-    mem_a = await storage.get_by_hash(memory_hash)
+    mem_a = await storage.get_by_hash(memory_hash, **store_kw)
     if mem_a is None:
         return result
 
@@ -486,22 +505,13 @@ async def detect_contradictions_nli(
         return result
 
     # Stage 1: Entity overlap gate
-    candidate_hashes = set()
-    for entity in entities_a:
-        try:
-            hashes = await graph.find_memories_by_entity(entity)
-            if hashes:
-                candidate_hashes.update(hashes)
-        except Exception:
-            continue
-    candidate_hashes.discard(memory_hash)
-
+    candidate_hashes = await _entity_candidates(graph, entities_a, memory_hash)
     if not candidate_hashes:
         return result
 
     # Stage 2: Embedding pre-filter — get candidates in similarity band
     try:
-        search_result = await storage.search_memories(query=mem_a.content, limit=20)
+        search_result = await storage.search_memories(query=mem_a.content, limit=20, **store_kw)
     except Exception:
         search_result = {}
 
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +74/-51)
```diff
@@ -222,6 +222,78 @@ def _dedup_outcome_note(result: dict) -> str:
     return _one_dedup_note(result)
 
 
+async def _nli_note_after_store(server, result: dict, store: str) -> str:
+    """Run the inline NLI contradiction check for the memory just stored.
+
+    The check compares within ``store``, the partition the memory was written
+    to (GHSA-989p-hfjf-q97q). Returns the line to append to the response.
+    """
+    try:
+        from ...reasoning.nli import detect_contradictions_nli
+        mem_hash = result["memory"].get("content_hash")
+        if mem_hash:
+            nli_result = await detect_contradictions_nli(
+                server.storage, memory_hash=mem_hash, dry_run=False, store=store
+            )
+            if nli_result.get("pairs_detected", 0) > 0:
+                return f"\n⚠️ Contradiction detected: {nli_result['pairs_detected']} conflict(s) registered."
+    except Exception as e:
+        logger.debug("NLI on-store check failed: %s", _sanitize_log_value(e))
+    return ""
+
+
+async def _auto_capture_note(server, arguments: dict, content, result: dict, conversation_id) -> str:
+    """RFC #1008 §3: optional inline auto-capture from the stored content.
+
+    Returns the line to append to the response, empty when nothing ran.
+    """
+    from ...config import MCP_AUTO_EXTRACT_DEFAULT, MCP_AUTO_EXTRACT_MIN_CONFIDENCE
+    from ...harvest.auto_capture import (
+        AutoCaptureService,
+        parent_hash_from_store_result,
+    )
+
+    auto_extract = arguments.get("auto_extract")
+    if auto_extract is None:
+        auto_extract = MCP_AUTO_EXTRACT_DEFAULT
+
+    # Recursion guard: skip auto-extract for memories produced by auto-capture itself
+    metadata_arg = arguments.get("metadata") or {}
+    if isinstance(metadata_arg, dict) and metadata_arg.get("source") == "auto_capture":
+        auto_extract = False
+
+    if not (auto_extract and content):
+        return ""
+    try:
+        min_conf = arguments.get("min_extract_confidence")
+        if min_conf is None:
+            min_conf = MCP_AUTO_EXTRACT_MIN_CONFIDENCE
+        capture_service = AutoCaptureService(
+            memory_service=server.memory_service,
+            min_confidence=min_conf,
+            types=arguments.get("extract_types"),
+        )
+        capture = await capture_service.capture(
+            content,
+            role=arguments.get("role") or "assistant",
+            parent_hash=parent_hash_from_store_result(result),
+            conversation_id=conversation_id,
+            dry_run=False,
+            # The store the caller named, not the handler's "default" fallback:
+            # capture() leaves an unnamed store to the storage defaults, and a
+            # named one is enforced (GHSA-989p-hfjf-q97q).
+            store=arguments.get("store"),
+        )
+        if capture.candidates:
+            return (
+                f"\nAuto-capture: {capture.stored} stored, {capture.evolved} evolved "
+                f"from {len(capture.candidates)} candidate(s)."
+            )
+    except Exception as cap_err:
+        logger.warning("auto-capture failed: %s", _sanitize_log_value(cap_err))
+    return ""
+
+
 async def handle_store_memory(server, arguments: dict) -> List[types.TextContent]:
     content = arguments.get("content")
     metadata = arguments.get("metadata", {})
@@ -378,15 +450,7 @@ async def handle_store_memory(server, arguments: dict) -> List[types.TextContent
                 logger.debug("Could not schedule background NLI checks: %s", _sanitize_log_value(e))
 
         if nli_on_store and result.get("success") and "memory" in result:
-            try:
-                from ...reasoning.nli import detect_contradictions_nli
-                mem_hash = result["memory"].get("content_hash")
-                if mem_hash:
-                    nli_result = await detect_contradictions_nli(server.storage, memory_hash=mem_hash, dry_run=False)
-                    if nli_result.get("pairs_detected", 0) > 0:
-                        message += f"\n⚠️ Contradiction detected: {nli_result['pairs_detected']} conflict(s) registered."
-            except Exception as e:
-                logger.debug("NLI on-store check failed: %s", _sanitize_log_value(e))
+            message += await _nli_note_after_store(server, result, store)
 
         # §6: Check against active beliefs (if belief service available)
         if nli_on_store and result.get("success") and "memory" in result:
@@ -405,48 +469,7 @@ async def handle_store_memory(server, arguments: dict) -> List[types.TextContent
             except Exception as e:
                 logger.debug("Belief quarantine check failed: %s", _sanitize_log_value(e))
 
-        # RFC #1008 §3: optional inline auto-capture from stored content
-        from ...config import MCP_AUTO_EXTRACT_DEFAULT, MCP_AUTO_EXTRACT_MIN_CONFIDENCE
-        from ...harvest.auto_capture import (
-            AutoCaptureService,
-            parent_hash_from_store_re
```

**File**: `src/mcp_memory_service/services/memory_service.py` (modified, +16/-3)
```diff
@@ -717,6 +717,7 @@ async def evolve_memory(
         memory_type: Optional[str] = None,
         metadata: Optional[Dict[str, Any]] = None,
         reason: Optional[str] = None,
+        store: Optional[str] = None,
     ) -> Tuple[bool, str, Optional[str]]:
         """Versioned update that gets the same post-store steps as store_memory().
 
@@ -731,17 +732,29 @@ async def evolve_memory(
         """
         if not hasattr(self.storage, "update_memory_versioned"):
             return False, "Storage backend does not support versioned updates", None
+
+        store_kw: Dict[str, Any] = {}
+        if store not in (None, "all"):
+            if not getattr(self.storage, "get_by_hash_is_store_scoped", False):
+                return (
+                    False,
+                    "Store-scoped memory evolution is not supported by the active storage backend",
+                    None,
+                )
+            store_kw = {"store": store}
+
         # Storage inherits omitted tags/type from the old version; keep that
         # version around so the re-read fallback below can do the same.
         previous = None
         if tags is None or memory_type is None:
-            previous = await self.storage.get_by_hash(existing_hash)
+            previous = await self.storage.get_by_hash(existing_hash, **store_kw)
         ok, msg, new_hash = await self.storage.update_memory_versioned(
             existing_hash,
             content,
             new_tags=tags,
             new_memory_type=memory_type,
             reason=reason,
+            **store_kw,
         )
         if not ok or not new_hash:
             return ok, msg, new_hash
@@ -761,7 +774,7 @@ async def evolve_memory(
         # is reported and worked around rather than turned into a failed evolve.
         if final_metadata:
             meta_ok, meta_msg = await self.storage.update_memory_metadata(
-                new_hash, {"metadata": final_metadata}, preserve_timestamps=True
+                new_hash, {"metadata": final_metadata}, preserve_timestamps=True, **store_kw
             )
             if not meta_ok:
                 logger.warning(
@@ -770,7 +783,7 @@ async def evolve_memory(
                 )
                 msg = f"{msg} (metadata update failed: {meta_msg})"
 
-        memory = await self.storage.get_by_hash(new_hash)
+        memory = await self.storage.get_by_hash(new_hash, **store_kw)
         if memory is None:
             # Re-read failed; score the version as written instead of skipping it.
             memory = self._as_written(new_hash, content, tags, memory_type, final_metadata, previous)
```

**File**: `src/mcp_memory_service/storage/mixins/metadata.py` (modified, +17/-5)
```diff
@@ -642,9 +642,16 @@ def _effective_confidence(
         return round((confidence if confidence is not None else 1.0) * decay, 4)
 
     def _detect_conflicts(
-        self, new_hash: str, new_content: str, embedding, exclude_hash: Optional[str] = None
+        self, new_hash: str, new_content: str, embedding, exclude_hash: Optional[str] = None,
+        store: Optional[str] = None,
     ) -> list:
-        """Detect conflicting active memories for a newly stored memory."""
+        """Detect conflicting active memories for a newly stored memory.
+
+        With ``store`` set (other than ``"all"``) only memories of that store are
+        compared: _record_conflicts() tags the other memory and links the pair,
+        which a caller confined to one store must not do to another
+        (GHSA-989p-hfjf-q97q).
+        """
         from difflib import SequenceMatcher
 
         SIMILARITY_THRESHOLD = 0.95
@@ -653,21 +660,26 @@ def _detect_conflicts(
         if not self.conn or embedding is None:
             return []
 
+        # Qualified: memory_embeddings has a store column as well.
+        confined = store not in (None, "all")
+        store_sql = " AND m.store = ?" if confined else ""
+        store_params = (store,) if confined else ()
         try:
             cursor = self.conn.execute(
-                """SELECT m.content_hash, m.content,
+                f"""SELECT m.content_hash, m.content,
                           vec_distance_cosine(me.content_embedding, ?) as distance
                    FROM memories m
                    JOIN memory_embeddings me ON m.rowid = me.rowid
                    WHERE m.deleted_at IS NULL
                      AND (m.superseded_by IS NULL OR m.superseded_by = '')
-                     AND m.content_hash NOT IN (?, ?)
+                     AND m.content_hash NOT IN (?, ?){store_sql}
                    ORDER BY distance ASC
                    LIMIT 5""",
                 (
                     serialize_float32(embedding),
                     new_hash,
                     exclude_hash if exclude_hash is not None else new_hash,
+                    *store_params,
                 ),
             )
             candidates = cursor.fetchall()
@@ -697,7 +709,7 @@ def _detect_conflicts(
 
     async def _record_conflicts(self, new_hash: str, conflicts: list) -> None:
         """Tag conflicting memories and create graph edges."""
-        import json as _json
+        import json as _json  # inline import
 
         def _record_all_conflicts():
             for c in conflicts:
```

---

### Incident Patch 2: `6a321767` (2026-11-16)
**Commit Message**: fix: prevent dashboard overflow at tablet widths (#2047)

**File**: `changelog.d/2012.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **The dashboard stays within the viewport on tablet widths (#2012).** The localized navigation could exceed the available row width between the mobile and desktop breakpoints; it now wraps at tablet widths, while the header keeps its compact icon controls so long translations do not force horizontal scrolling.
```

**File**: `src/mcp_memory_service/web/static/style.css` (modified, +8/-0)
```diff
@@ -1912,6 +1912,14 @@ body.dark-mode .form-group label {
 }
 
 @media (min-width: 769px) and (max-width: 1024px) {
+    .nav-container {
+        flex-wrap: wrap;
+    }
+
+    .btn-text {
+        display: none;
+    }
+
     .dashboard-grid {
         grid-template-columns: 1fr 300px;
     }
```

**File**: `tests/web/test_dashboard_style_guard.py` (modified, +13/-0)
```diff
@@ -106,3 +106,16 @@ def test_weights_stay_at_or_below_600():
         if not sel.startswith("@font-face") and re.search(r"font-weight:\s*(700|800|900|bold)\b", body)
     ]
     assert offenders == []
+
+
+def test_tablet_navigation_wraps_for_translated_labels():
+    tablet = re.search(
+        r"@media\s*\(min-width:\s*769px\)\s*and\s*\(max-width:\s*1024px\)\s*\{(.*?)\n\}",
+        CSS,
+        flags=re.S,
+    )
+    assert tablet is not None
+    nav = re.search(r"\.nav-container\s*\{([^}]*)\}", tablet.group(1))
+    assert nav is not None
+    assert re.search(r"flex-wrap:\s*wrap\s*;", nav.group(1))
+    assert re.search(r"\.btn-text\s*\{[^}]*display:\s*none\s*;", tablet.group(1))
```

---

### Incident Patch 3: `30f9eb40` (2026-11-16)
**Commit Message**: docs(readme): add downloads, Docker, CI, contributors and Glama badges, fix DeepWiki badge (#2048)

deepwiki.com/badge.svg answers 429 to GitHub's image proxy, so the badge rendered as a broken image. It is now a static shields.io badge with the same link target.

**File**: `README.md` (modified, +6/-1)
```diff
@@ -14,10 +14,15 @@ context in 5ms — without cloud lock-in or API costs.
 [![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
 [![PyPI version](https://img.shields.io/pypi/v/mcp-memory-service?color=blue&logo=pypi&logoColor=white)](https://pypi.org/project/mcp-memory-service/)
 [![Python](https://img.shields.io/pypi/pyversions/mcp-memory-service?logo=python&logoColor=white)](https://pypi.org/project/mcp-memory-service/)
+[![PyPI Downloads](https://static.pepy.tech/personalized-badge/mcp-memory-service?period=total&units=INTERNATIONAL_SYSTEM&left_color=BLACK&right_color=GREEN&left_text=downloads)](https://pepy.tech/projects/mcp-memory-service)
+[![Docker Pulls](https://img.shields.io/docker/pulls/doobidoo/mcp-memory-service?logo=docker&logoColor=white)](https://hub.docker.com/r/doobidoo/mcp-memory-service)
+[![CI](https://img.shields.io/github/actions/workflow/status/doobidoo/mcp-memory-service/ci.yml?branch=main&logo=github&label=CI)](https://github.com/doobidoo/mcp-memory-service/actions/workflows/ci.yml)
 [![GitHub stars](https://img.shields.io/github/stars/doobidoo/mcp-memory-service?logo=github&label=stars)](https://github.com/doobidoo/mcp-memory-service)
+[![Contributors](https://img.shields.io/github/contributors/doobidoo/mcp-memory-service)](https://github.com/doobidoo/mcp-memory-service/graphs/contributors)
 [![Remote MCP](https://img.shields.io/badge/MCP-Remote%20Support-blue?logo=anthropic)](https://github.com/doobidoo/mcp-memory-service/blob/main/docs/remote-mcp-setup.md)
 [![OAuth 2.0](https://img.shields.io/badge/Auth-OAuth%202.0%20%2B%20DCR-green)](https://github.com/doobidoo/mcp-memory-service/blob/main/docs/oauth-setup.md)
-[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/doobidoo/mcp-memory-service)
+[![Ask DeepWiki](https://img.shields.io/badge/DeepWiki-Ask-0969da)](https://deepwiki.com/doobidoo/mcp-memory-service)
+[![Glama score](https://glama.ai/mcp/servers/doobidoo/mcp-memory-service/badges/score.svg)](https://glama.ai/mcp/servers/doobidoo/mcp-memory-service)
 
 Getting started: [English](https://mcpmemory.services/) · [Deutsch](https://mcpmemory.services/de/) · [Español](https://mcpmemory.services/es/) · [日本語](https://mcpmemory.services/ja/) · [简体中文](https://mcpmemory.services/zh-cn/) · [繁體中文](https://mcpmemory.services/zh-tw/) · [Français](https://mcpmemory.services/fr/) · [Português (Brasil)](https://mcpmemory.services/pt-br/) · [한국어](https://mcpmemory.services/ko/)
 
```

#### Recent Merged Pull Requests:
- **PR #2048** (2026-11-16): docs(readme): add downloads, Docker, CI, contributors and Glama badges, fix DeepWiki badge (@doobidoo)
- **PR #2047** (2026-11-16): fix: prevent dashboard overflow at tablet widths (@jay23606)
- **PR #2043** (2026-11-16): fix(dashboard): report a finished consolidation on the status island (#2006) (@dodoshell)
- **PR #2042** (2026-11-16): feat(dashboard): report document imports to the status island (#2004) (@jilsnshah)
- **PR #2039** (2026-11-16): Semantic dedup reads its one row through the KNN pushdown (#2032) (@Yoel-qin)
- **PR #2038** (2026-11-16): refactor(logging): guard the six remaining handler, web/api, quality and sync modules (#1146) (@massimiliano1991)

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

## X. security): keep memory_store side effects inside the granted store (GHSA-989p-hf

**RULE**:
When implementing operations in `changelog.d/ghsa-989p.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `15a9e9a9`: security): keep memory_store side effects inside the granted store (GHSA-989p-hfjf-q97q). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/ghsa-989p.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **A per-store write grant could write to and supersede memories in another store through `memory_store` (GHSA-989p-hfjf-q97q, reported by [RISCON Labs](https://www.risconlabs.com), @RISCON-Labs).**
  With `auto_extract=true`, `handle_store_memory` stored the memory in the granted store but ran auto-capture without it. `AutoCaptureService.capture()`, `SessionHarvester._try_evolve()` and `MemoryService.evolve_memory()` took no `store`, so the extracted candidates were compared with the `default` store, replaced a similar memory there, or were inserted there. A client holding only `write:projectA` could overwrite `default`. The NLI contradiction check on store (`MCP_NLI_ON_STORE`, inline and background) had the same gap: it compared a memory with the `default` store whatever store it was written to, linked the two with a `contradicts` edge and reported the hit count to the caller. It also missed contradictions inside a named store for the same reason. Conflict detection on store, which runs on every write without any flag, compared the new memory with every store as well and tagged a near-identical memory in another store `conflict:unresolved`, with `contradicts` edges between the t
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `15a9e9a9` are properly handled with clean fallback behavior.
