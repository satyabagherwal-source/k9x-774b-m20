> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `e0f224ec`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T15:57:29.419Z  
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
> **Harvest Timestamp**: 2026-11-02T15:57:28.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2062 stars

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
- **Issue #1785** (2026-11-02): **[Bug]: Milvus full reads stop at 16384 rows (get_all_memories, time range, tags, export)**
  *Symptoms*: ### Bug Description  On the Milvus backend, reads that mean "every match" stop at 16384 rows without any error. Once a collection holds more than 16384 memories, `get_all_memories()`, `get_memories_by_time_range()`, tag search, tag counts, timestamps and the JSON export all return 16384.  There are two causes:  1. **The caller slices after draining.** `_query_memories` ([milvus.py#L4575](https://github.com/doobidoo/mcp-memory-service/blob/06e2f786/src/mcp_memory_service/storage/milvus.py#L4575)) already drains the whole match set with QueryIterator; its docstring says that is to avoid the 16384 truncation. But the callers that mean "all" pass `limit=_MILVUS_MAX_LIMIT`, so it returns `memories[:16384]` anyway ([L4621](https://github.com/doobidoo/mcp-memory-service/blob/06e2f786/src/mcp_memory_service/storage/milvus.py#L4621)). Affected: `get_all_memories` with no limit ([L3834](https://github.com/doobidoo/mcp-memory-service/blob/06e2f786/src/mcp_memory_service/storage/milvus.py#L3834)), `get_memories_by_time_range`, `search_by_tag`, `search_by_tags`, `search_by_tag_chronological` with no limit, `get_by_exact_content`, `get_largest_memories`, and the exact and time/tag-only branches of `search_memories`. 2. **A single `query()` call.** `_scan_tags` (behind `get_all_tags` and `get_all_tags_with_counts`), `get_memory_timestamps`, `purge_deleted` and `get_conflicts` call `client.query(limit=16384)` once, which Milvus caps at 16384.  The sort is newest first, so the rows dropped ar

- **Issue #1782** (2026-11-02): **[Bug]: Milvus memory_search without a query returns the oldest matches, not the newest**
  *Symptoms*: ### Bug Description  On the Milvus backend, `memory_search` without a `query` (only `time_expr`, `after`/`before`, or `tags`) returns the **oldest** matching memories instead of the newest. sqlite_vec returns the newest.  The time/tag-only branch of `MilvusMemoryStorage.search_memories` ([milvus.py#L2983-L2997](https://github.com/doobidoo/mcp-memory-service/blob/815ca45b/src/mcp_memory_service/storage/milvus.py#L2983-L2997)) issues one `client.query(filter=..., limit=limit * 3)` and keeps the first `limit` rows. Milvus has no server-side `ORDER BY`, so those are the rows scanned first, which for memories written over time are the oldest. Nothing sorts them afterwards; the MCP handler does not either.  The same branch serves the `fallback=true` tag stage (`_search_tag_fallback` in `server/handlers/memory.py`). REST `/api/search*` is not affected: it does not call `search_memories`.  ### Steps to Reproduce  Through the real MCP handler, on Milvus Lite and sqlite_vec, write 30 memories one hour apart, oldest first, then call `memory_search`:  | call | sqlite_vec (hours old) | Milvus (hours old) | |---|---|---| | `{"time_expr": "last 7 days", "limit": 5}` | `[0, 1, 2, 3, 4]` | `[29, 28, 27, 26, 25]` | | `{"tags": ["timeline"], "limit": 5}` | `[0, 1, 2, 3, 4]` | `[29, 28, 27, 26, 25]` |  ### Expected Behavior  The newest matches first, as on sqlite_vec, so the tool's own example `{"time_expr": "last week", "limit": 20}` returns the last 20 memories of the week.  ### Actual Behavio

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

### Incident Patch 1: `ce80cb53` (2026-11-02)
**Commit Message**: fix: memory_search point-in-time queries with as_of and status flags (fixes #1724) (#1726)

* fix: memory_search point-in-time queries with as_of and status flags

Implements issue #1724: memory_search (MCP + REST) accepts as_of for
point-in-time queries (knowledge-time semantics), include_superseded
results carry current/superseded status flags with superseded_by and
superseded_at, a new superseded_at column records the replacement moment,
and reasoning/temporal.py is wired into the graph layer instead of dead code.

Tests: tests/storage/test_1724_point_in_time.py (9 tests)

* fix: memory_search point-in-time queries with as_of and status flags

Implements issue #1724: memory_search (MCP + REST) accepts as_of for
point-in-time queries (knowledge-time semantics), include_superseded
results carry current/superseded status flags with superseded_by and
superseded_at, a new superseded_at column records the replacement moment,
and reasoning/temporal.py is wired into the graph layer instead of dead code.

Rebased onto current upstream main; no upstream changes reverted.

Tests: tests/storage/test_1724_point_in_time.py (9 tests)

* fix: address review feedback on point-in-time as_of queri

**File**: `changelog.d/1724.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- **Point-in-time `as_of` searches no longer leak present-day fallback results (#1724).**
+  With `fallback=true`, an `as_of` search returning fewer than three matches could
+  append present-day exact or tag matches. The cascading fallback stages now forward
+  `as_of`, so historical queries only return memories that were current at the
+  requested date.
```

**File**: `src/mcp_memory_service/models/memory.py` (modified, +8/-2)
```diff
@@ -460,12 +460,18 @@ class MemoryQueryResult:
     memory: Memory
     relevance_score: float
     debug_info: Dict[str, Any] = field(default_factory=dict)
-    
+    # Issue #1724: supersession lineage, populated by backends that track it
+    # (sqlite_vec / hybrid). superseded_at is the exact replacement moment for
+    # rows superseded after migration 021; for older rows it is approximated
+    # with the successor's created_at (see RetrieveMixin.retrieve).
+    superseded_by: Optional[str] = None
+    superseded_at: Optional[float] = None
+
     @property
     def similarity_score(self) -> float:
         """Alias for relevance_score for backward compatibility."""
         return self.relevance_score
-    
+
     def to_dict(self) -> Dict[str, Any]:
         """Convert to dictionary representation."""
         return {
```

**File**: `src/mcp_memory_service/server/handlers/graph.py` (modified, +27/-2)
```diff
@@ -99,7 +99,10 @@ async def handle_memory_graph(server, arguments: dict) -> List[types.TextContent
 
             return await handle_find_connected_memories(server, {
                 "hash": hash_val,
-                "max_hops": arguments.get("max_hops", 2)
+                "max_hops": arguments.get("max_hops", 2),
+                # Issue #1724: forward the point-in-time bound — dropping it
+                # here silently disabled as_of for the memory_graph tool.
+                "as_of": arguments.get("as_of"),
             })
 
         elif action == "path":
@@ -373,10 +376,32 @@ async def handle_find_connected_memories(
 
     # Get optional parameters
     max_hops = arguments.get("max_hops", 2)
+    as_of = arguments.get("as_of")
 
     try:
+        # Parse as_of (issue #1724): point-in-time traversal. Invalid values
+        # fail the call rather than silently ignoring the bound.
+        as_of_ts = None
+        if as_of is not None:
+            from ...utils.time_parser import parse_as_of
+            try:
+                as_of_ts = parse_as_of(as_of)
+            except ValueError as e:
+                result = {
+                    "success": False,
+                    "error": f"Invalid as_of value: {e}",
+                    "connected": [],
+                    "count": 0,
+                }
+                return [types.TextContent(
+                    type="text",
+                    text=json.dumps(result, indent=2)
+                )]
+
         # Perform graph traversal
-        connected = await graph.find_connected(memory_hash, max_hops=max_hops)
+        connected = await graph.find_connected(
+            memory_hash, max_hops=max_hops, as_of=as_of_ts
+        )
 
         # Format results
         result = {
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +20/-5)
```diff
@@ -1152,15 +1152,16 @@ async def _collect_cascading_fallback_memories(
     """Combine exact and tag fallback results while preserving their labels."""
     seen_hashes = {memory.get("content_hash") for memory in memories}
     include_superseded = arguments.get("include_superseded", False)
+    as_of = arguments.get("as_of")
     exact_memories = await _search_exact_fallback(
-        storage, query, limit, include_superseded
+        storage, query, limit, include_superseded, as_of
     )
     _append_unique_fallback_memories(
         memories, exact_memories, seen_hashes, "exact_fallback"
     )
     if len(memories) < limit:
         tag_memories = await _search_tag_fallback(
-            storage, query, limit, include_superseded
+            storage, query, limit, include_superseded, as_of
         )
         _append_unique_fallback_memories(
             memories, tag_memories, seen_hashes, "tag_fallback"
@@ -1173,22 +1174,23 @@ async def _collect_cascading_fallback_memories(
 
 
 async def _search_exact_fallback(
-    storage, query: str, limit: int, include_superseded: bool
+    storage, query: str, limit: int, include_superseded: bool, as_of=None
 ) -> list[dict]:
     """Return exact-search candidates, treating a backend error as no matches."""
     result = await storage.search_memories(
         query=query,
         mode="exact",
         limit=limit,
         include_superseded=include_superseded,
+        as_of=as_of,
     )
     if "error" in result:
         return []
     return result.get("memories", [])
 
 
 async def _search_tag_fallback(
-    storage, query: str, limit: int, include_superseded: bool
+    storage, query: str, limit: int, include_superseded: bool, as_of=None
 ) -> list[dict]:
     """Return tag-search candidates for tokens extracted from the query."""
     query_tokens = [
@@ -1204,6 +1206,7 @@ async def _search_tag_fallback(
         tags=query_tokens,
         limit=limit,
         include_superseded=include_superseded,
+        as_of=as_of,
     )
     if "error" in result:
         return []
@@ -1243,6 +1246,7 @@ async def _retrieve_search_results(storage, arguments: dict, normalize_tags):
         ranking_weights=arguments.get("ranking_weights"),
         store=store,
         agent_id=arguments.get("agent_id"),
+        as_of=arguments.get("as_of"),
     )
     if "error" in result:
         return result, None
@@ -1487,10 +1491,21 @@ def _format_search_memory(memory: dict, index: int, fallback_used: bool) -> str:
     match_info = ""
     if fallback_used and memory.get("match_method"):
         match_info = f" (via {memory['match_method']})"
+    # Issue #1724: surface the point-in-time status flag when the backend
+    # attached one (include_superseded=true).
+    status_info = ""
+    if memory.get("status"):
+        status_info = f"   Status: {memory['status']}"
+        if memory.get("superseded_by"):
+            status_info += f" by {memory['superseded_by'][:12]}"
+            if memory.get("superseded_at_iso"):
+                status_info += f" at {memory['superseded_at_iso']}"
+        status_info += "\n"
     return (
         f"{index}. {memory.get('content', '')}\n"
         f"   Hash: {content_hash}\n"
-        f"   Created: {created_at}{tags_display}{match_info}"
+        f"   Created: {created_at}{tags_display}{match_info}\n"
+        f"{status_info}".rstrip("\n")
     )
 
 
```

**File**: `src/mcp_memory_service/storage/base.py` (modified, +137/-9)
```diff
@@ -19,6 +19,7 @@
 """
 import asyncio
 import logging
+import time
 from abc import ABC, abstractmethod
 from typing import List, Optional, Dict, Any, Sequence, Tuple, Set
 from datetime import datetime, timezone, timedelta, date
@@ -209,7 +210,7 @@ async def store_batch(self, memories: List[Memory], recreate: Optional[bool] = N
         return final_results
 
     @abstractmethod
-    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: Optional[str] = None) -> List[MemoryQueryResult]:
+    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: Optional[str] = None, as_of: Optional[float] = None) -> List[MemoryQueryResult]:
         """Retrieve memories by semantic search.
 
         Args:
@@ -221,6 +222,9 @@ async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str
             min_confidence: Minimum effective confidence score (0.0-1.0).
                   When > 0, stale memories below threshold are filtered out.
                   Default 0.0 disables filtering (backward compatible).
+            as_of: Optional epoch seconds for a point-in-time query (issue
+                  #1724): only memories with created_at <= as_of that had not
+                  yet been superseded at as_of are returned. None disables.
         """
         pass
 
@@ -240,7 +244,8 @@ async def retrieve_with_quality_boost(
         quality_boost: Optional[bool] = None,
         quality_weight: Optional[float] = None,
         include_superseded: bool = False,
-        store: Optional[str] = "default"
+        store: Optional[str] = "default",
+        as_of: Optional[float] = None,
     ) -> List[MemoryQueryResult]:
         """
         Retrieve memories with optional quality-based reranking.
@@ -285,12 +290,12 @@ async def retrieve_with_quality_boost(
 
         if not quality_boost:
             # Standard retrieval, no reranking
-            return await self.retrieve(query, n_results, tags=tags, include_superseded=include_superseded, store=store)
+            return await self.retrieve(query, n_results, tags=tags, include_superseded=include_superseded, store=store, as_of=as_of)
 
         # Quality-boosted retrieval
         # Step 1: Over-fetch (3x) to have pool for reranking
         oversample_factor = 3
-        candidates = await self.retrieve(query, n_results * oversample_factor, tags=tags, include_superseded=include_superseded, store=store)
+        candidates = await self.retrieve(query, n_results * oversample_factor, tags=tags, include_superseded=include_superseded, store=store, as_of=as_of)
 
         if not candidates:
             return []
@@ -1219,6 +1224,74 @@ async def get_graph_visualization_data(
             },
         }
 
+    @staticmethod
+    def _post_filter_as_of(
+        results: List[MemoryQueryResult], as_of_ts: float
+    ) -> List[MemoryQueryResult]:
+        """Best-effort point-in-time post-filter (issue #1724).
+
+        For backends without SQL-level as_of support (cloudflare, milvus,
+        remote_http): drop memories created after as_of, and drop memories
+        that are superseded without a known replacement moment (their
+        supersede time cannot be proven to be after as_of, so they cannot be
+        shown as current at as_of). Backends with native support (sqlite_vec,
+        hybrid via primary) already filtered; this is a no-op for them.
+        """
+        filtered = []
+        for r in results:
+            created = r.memory.created_at
+            if created is not None and created > as_of_ts:
+                continue
+            sup_by = r.superseded_by
+            sup_at = r.superseded_at
+            if sup_by and (sup_at is None or sup_at <= as_of_ts):
+                continue
+            filtered.append(r)
+        return filtered
+
+    async def _get_supersession_map(
+        self, content_hashes: List[str], store: Optional[str] = None
+    ) -> Dict[str, Tuple[Optional[str], Optional[float]]]:
+        """Batch supersession-lineage lookup: content_hash -> (superseded_by, superseded_at).
+
+        Issue #1724 follow-up: exact / time-only / tag-only search paths build
+        results from raw Memory objects that never flow through retrieve(), so
+        their lineage fields are empty. The base implementation returns {}
+        (backend cannot provide it — those paths then get only the created_at
+        bound); SQLite overrides with a single batched query.
+        """
+        return {}
+
+    async def _enrich_supersession(
+        self, results: List[MemoryQueryResult], store: Optional[str] = None
+    ) -> List[MemoryQueryResult]:
+        """Backfill supersession lineag
```

**File**: `src/mcp_memory_service/storage/cloudflare.py` (modified, +54/-3)
```diff
@@ -1039,7 +1039,7 @@ async def _store_r2_content(self, key: str, content: str) -> None:
         if response.status_code not in [200, 201]:
             raise ValueError(f"Failed to store content in R2: {response.status_code}")
     
-    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: str = "default") -> List[MemoryQueryResult]:
+    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: str = "default", as_of: Optional[float] = None) -> List[MemoryQueryResult]:
         """Retrieve memories by semantic search."""
         try:
             # Generate query embedding
@@ -1126,13 +1126,64 @@ async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str
                 except Exception as e:
                     logger.warning("Failed to persist access metadata: %s", _sanitize_log_value(e))
 
+            # Issue #1724 follow-up: always load the replacement lineage, not
+            # only when as_of is set — include_superseded status flags need it
+            # too. Cloudflare tracks superseded_by in metadata_json but not
+            # the replacement moment, so superseded_at stays None
+            # (conservative in as_of queries).
+            results = self._copy_supersession_from_metadata(results)
+
+            # Issue #1724: best-effort point-in-time filter. The Cloudflare
+            # backend has no superseded_at; superseded rows are conservatively
+            # excluded from as_of queries.
+            if as_of is not None:
+                results = self._post_filter_as_of(results, as_of)
+
             logger.info("Retrieved %s memories for query", len(results))
             return results
-            
+
         except Exception as e:
             logger.error("Failed to retrieve memories: %s", _sanitize_log_value(e))
             return []
-    
+
+    @staticmethod
+    def _copy_supersession_from_metadata(
+        results: List[MemoryQueryResult],
+    ) -> List[MemoryQueryResult]:
+        """Copy the superseded_by pointer from each result's loaded metadata.
+
+        Issue #1724 follow-up: Cloudflare's D1 schema has no superseded_by /
+        superseded_at columns, so MemoryQueryResult lineage is never populated
+        by the query itself. The replacement pointer, when present, lives in
+        the memory's metadata_json (same convention as the SQLite metadata
+        mirror and the Milvus backend). superseded_at is not tracked, so it
+        stays None and _post_filter_as_of conservatively excludes such rows
+        from as_of queries instead of silently returning them as current.
+        """
+        for r in results:
+            if r.superseded_by is None:
+                r.superseded_by = (r.memory.metadata or {}).get("superseded_by") or None
+        return results
+
+    async def _enrich_supersession(
+        self, results: List[MemoryQueryResult], store: Optional[str] = None
+    ) -> List[MemoryQueryResult]:
+        """Backfill supersession lineage from loaded metadata (issue #1724).
+
+        The exact / tag-only / time-only paths in search_memories() never flow
+        through retrieve(), so they rely on this hook. The base implementation
+        does a batched DB lookup that this backend cannot provide; copy the
+        pointer from the already-loaded metadata instead. Never raises.
+        """
+        try:
+            return self._copy_supersession_from_metadata(results)
+        except Exception as e:
+            logger.warning(
+                "Supersession enrichment failed, continuing without lineage: %s",
+                _sanitize_log_value(str(e)),
+            )
+            return results
+
     async def _load_memory_from_match(self, match: Dict[str, Any]) -> Optional[Memory]:
         """Load full memory from a Vectorize match id."""
         try:
```

**File**: `src/mcp_memory_service/storage/graph.py` (modified, +67/-2)
```diff
@@ -79,6 +79,7 @@ def normalize_entity_id(name: str) -> str:
         cm.distance < ?  -- Limit recursion depth
         AND instr(cm.path, ',' || {selected_hash} || ',') = 0  -- Prevent cycles (exact match)
         {relationship_filter}
+        {temporal_filter}
 )
 SELECT DISTINCT hash, distance
 FROM connected_memories
@@ -268,7 +269,8 @@ async def find_connected(
         memory_hash: str,
         max_hops: int = 2,
         relationship_type: Optional[str] = None,
-        direction: str = "both"
+        direction: str = "both",
+        as_of: Optional[float] = None,
     ) -> List[Tuple[str, int]]:
         """
         Find all memories connected within N hops using recursive CTE.
@@ -281,6 +283,11 @@ async def find_connected(
             max_hops: Maximum number of hops to traverse (default: 2)
             relationship_type: Optional filter for specific relationship type
             direction: Direction to traverse ("outgoing", "incoming", "both")
+            as_of: Optional point-in-time filter (Unix epoch, issue #1724).
+                Edges whose metadata carries valid_from/valid_until
+                (see reasoning.temporal.store_temporal_association) are only
+                traversed when valid at as_of; edges without temporal bounds
+                are always traversed.
 
         Returns:
             List of (memory_hash, distance) tuples, sorted by distance
@@ -313,6 +320,18 @@ async def find_connected(
                 relationship_filter = "AND mg.relationship_type = ?"
                 params.append(relationship_type)
 
+            # Issue #1724: point-in-time traversal. Temporal edges carry
+            # valid_from/valid_until in metadata JSON; untimed edges pass.
+            temporal_filter = ""
+            if as_of is not None:
+                temporal_filter = (
+                    "AND (json_extract(mg.metadata, '$.valid_from') IS NULL "
+                    "OR json_extract(mg.metadata, '$.valid_from') <= ?) "
+                    "AND (json_extract(mg.metadata, '$.valid_until') IS NULL "
+                    "OR json_extract(mg.metadata, '$.valid_until') >= ?)"
+                )
+                params.extend([as_of, as_of])
+
             # Build join condition and selected hash based on direction
             if direction == "outgoing":
                 join_condition = "JOIN memory_graph mg ON cm.hash = mg.source_hash"
@@ -329,7 +348,8 @@ async def find_connected(
             query = _QUERY_TEMPLATE_FIND_CONNECTED.format(
                 selected_hash=selected_hash,
                 join_condition=join_condition,
-                relationship_filter=relationship_filter
+                relationship_filter=relationship_filter,
+                temporal_filter=temporal_filter,
             )
 
             cursor = conn.cursor()
@@ -348,6 +368,51 @@ async def find_connected(
             logger.error(f"Failed to find connected memories: {_sanitize_log_value(e)}")
             return []
 
+    async def get_temporal_edges(
+        self,
+        memory_hash: str,
+        as_of: Optional[float] = None,
+    ) -> List["TemporalEdge"]:
+        """Return temporal edges incident to a memory, filtered by as_of.
+
+        Issue #1724: this wires up reasoning/temporal.py (previously dead
+        code). Edges are built from memory_graph rows — valid_from/valid_until
+        come from the metadata JSON written by
+        reasoning.temporal.store_temporal_association — and passed through
+        filter_temporal_edges.
+        """
+        from ..reasoning.temporal import TemporalEdge, filter_temporal_edges
+
+        edges: List[TemporalEdge] = []
+        try:
+            conn = await self._get_connection()
+            cursor = conn.cursor()
+            try:
+                cursor.execute(
+                    "SELECT source_hash, target_hash, metadata FROM memory_graph "
+                    "WHERE source_hash = ? OR target_hash = ?",
+                    (memory_hash, memory_hash),
+                )
+                for row in cursor.fetchall():
+                    try:
+                        meta = json.loads(row["metadata"]) if row["metadata"] else {}
+                    except (json.JSONDecodeError, TypeError):
+                        meta = {}
+                    edges.append(
+                        TemporalEdge(
+                            source=row["source_hash"],
+                            target=row["target_hash"],
+                            valid_from=meta.get("valid_from"),
+                            valid_until=meta.get("valid_until"),
+                        )
+                    )
+            finally:
+                cursor.close()
+        except sqlite3.Error as e:
+            logger.error(f"Failed to get temporal edges: {_sanitize_log_value(e)}")
+            return []
+        return filter_temporal_edges(edges, as_of)
+
     async def get_relationship_types(self, memory_hash: str) -> Dict[str, int]:
         """
 
```

**File**: `src/mcp_memory_service/storage/hybrid.py` (modified, +11/-1)
```diff
@@ -2200,7 +2200,7 @@ async def store(self, memory: Memory, skip_semantic_dedup: bool = False, store:
 
         return success, message
 
-    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: str = "default") -> List[MemoryQueryResult]:
+    async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str]] = None, min_confidence: float = 0.0, include_superseded: bool = False, start_time: Optional[float] = None, end_time: Optional[float] = None, store: str = "default", as_of: Optional[float] = None) -> List[MemoryQueryResult]:
         """Retrieve memories from primary storage (fast)."""
         return await self.primary.retrieve(
             query,
@@ -2211,6 +2211,7 @@ async def retrieve(self, query: str, n_results: int = 5, tags: Optional[List[str
             start_time=start_time,
             end_time=end_time,
             store=store,
+            as_of=as_of,
         )
 
     async def retrieve_hybrid(
@@ -2221,6 +2222,7 @@ async def retrieve_hybrid(
         semantic_weight: Optional[float] = None,
         include_superseded: bool = False,
         store: Optional[str] = "default",
+        as_of: Optional[float] = None,
     ) -> List[MemoryQueryResult]:
         """BM25 + vector search on primary storage (#1576).
 
@@ -2235,6 +2237,7 @@ async def retrieve_hybrid(
             semantic_weight=semantic_weight,
             include_superseded=include_superseded,
             store=store,
+            as_of=as_of,
         )
 
     async def search(self, query: str, n_results: int = 5, min_similarity: float = 0.0) -> List[MemoryQueryResult]:
@@ -2335,6 +2338,13 @@ async def get_by_exact_content(self, content: str, store: Optional[str] = None)
         """Retrieve memories by exact content match from primary storage."""
         return await self.primary.get_by_exact_content(content, store=store)
 
+    async def _get_supersession_map(self, content_hashes, store=None):
+        """Delegate the issue-#1724 lineage lookup to the primary SQLite storage."""
+        delegate = getattr(self.primary, "_get_supersession_map", None)
+        if delegate is not None:
+            return await delegate(content_hashes, store=store)
+        return {}
+
     async def delete_by_timeframe(self, start_date: date, end_date: date, tag: Optional[str] = None) -> Tuple[int, str]:
         """Delete memories within a specific date range in primary storage and queue for secondary sync."""
         count, message = await self.primary.delete_by_timeframe(start_date, end_date, tag)
```

---

### Incident Patch 2: `b9cdb17c` (2026-11-02)
**Commit Message**: fix(sync): propagate a supersede made after the first sync (#1773) (#1788)

* fix(sync): propagate a supersede made after the first sync (#1773)

mark_superseded_batch, resolve_conflict and update_memory_versioned changed
superseded_by / superseded_at without logging a sync event, and the
receiver dropped superseded_by from update_metadata events, so a memory
replaced after it was first synced stayed current on every other peer.

- All three writers log the supersede as an update_metadata event inside
  the same savepoint or transaction as the UPDATE (fail-closed, ADR-0008).
  A retry that changes nothing logs no event.
- updates carries only superseded_by, which peers without this change
  already treat as protected; the origin's superseded_at travels at the
  payload top level, where those peers never read it.
- The receiver resolves both columns with the existing field-level LWW by
  _winner_key and writes the origin's superseded_at instead of
  re-stamping it. update_memory_metadata now carries superseded_at too.

Closes #1773

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(sync): roll back a failed resolve_conflict as a whole; mirror legacy superseded_by

Review fol

**File**: `changelog.d/1773.fixed.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+- **A supersede made after a memory was first synced never reached the other delta-sync peers (#1773, ppcvote).**
+  `mark_superseded_batch`, `resolve_conflict` and `update_memory_versioned` changed
+  `superseded_by` / `superseded_at` without logging a sync event, and the receiver dropped
+  `superseded_by` from `update_metadata` events, so a replaced memory stayed current on every
+  other peer, in default search and in `as_of` queries. All three writers now log the
+  supersede inside the same savepoint or transaction as the UPDATE, and the receiver writes both columns
+  with the existing field-level last-writer-wins order, taking `superseded_at` from the
+  origin instead of re-stamping it. Peers that supersede the same memory with different
+  winners converge regardless of arrival order; a peer without this change keeps its
+  current behaviour.
```

**File**: `src/mcp_memory_service/storage/mixins/metadata.py` (modified, +110/-38)
```diff
@@ -199,6 +199,10 @@ def _do_update():
                             'updates': updates,
                             'updated_at': updated_at,
                         }
+                        if update_superseded_by:
+                            # Issue #1773: carry the origin's superseded_at (the CASE above
+                            # may have kept an earlier instant) so receivers never re-stamp it.
+                            payload['superseded_at'] = self._read_superseded_at(content_hash)
                         self._append_sync_event(self.conn, 'update_metadata', content_hash, payload)
                     self.conn.execute(f"RELEASE SAVEPOINT {sp}")
                 except Exception:
@@ -337,25 +341,84 @@ def _batch_update():
             logger.error("Batch update failed: %s\n%s", _sanitize_log_value(str(e)), traceback.format_exc())
             return [False] * len(memories)
 
+    def _read_superseded_at(self, content_hash: str) -> float | None:
+        """Return the row's superseded_at as written by the current transaction."""
+        row = self.conn.execute(
+            "SELECT superseded_at FROM memories WHERE content_hash = ? AND deleted_at IS NULL",
+            (content_hash,),
+        ).fetchone()
+        return row[0] if row else None
+
+    def _append_supersede_event(self, content_hash: str) -> None:
+        """Log a supersede of ``content_hash`` for delta-sync peers (issue #1773).
+
+        Runs inside the caller's transaction/savepoint, so the UPDATE and the event
+        commit or roll back together (ADR-0008). The event is an ``update_metadata``
+        whose ``updates`` holds only ``superseded_by``, a field peers already treat as
+        protected, and whose ``superseded_at`` sits at the payload top level, where a
+        peer without #1773 never reads it. Both values and ``updated_at`` are read back
+        from the row, so receivers write the origin's values instead of re-stamping.
+        """
+        if not hasattr(self, '_append_sync_event'):
+            return
+        row = self.conn.execute(
+            "SELECT superseded_by, superseded_at, updated_at FROM memories "
+            "WHERE content_hash = ? AND deleted_at IS NULL",
+            (content_hash,),
+        ).fetchone()
+        if row is None:
+            return
+        superseded_by, superseded_at, updated_at = row
+        payload = {
+            'content_hash': content_hash,
+            'updates': {'superseded_by': superseded_by},
+            'superseded_at': superseded_at,
+            'updated_at': updated_at,
+        }
+        self._append_sync_event(self.conn, 'update_metadata', content_hash, payload)
+
+    def _supersede_with_event(self, winner_hash: str, loser_hash: str, now: float) -> None:
+        """Point ``loser_hash`` at ``winner_hash`` and log the change for sync peers.
+
+        Issue #1724 / follow-up review: stamp superseded_at only on the actual
+        current -> superseded transition. A retried call (same winner) or a re-point
+        keeps the ORIGINAL replacement moment — re-stamping would corrupt the
+        historical instant that point-in-time queries rely on. (CASE sees pre-update
+        values.) A retry that changes nothing logs no event.
+        """
+        before = self.conn.execute(
+            "SELECT superseded_by FROM memories WHERE content_hash = ? AND deleted_at IS NULL",
+            (loser_hash,),
+        ).fetchone()
+        cur = self.conn.execute(
+            "UPDATE memories SET superseded_by = ?, "
+            "superseded_at = CASE WHEN superseded_by IS NULL OR superseded_by = '' "
+            "THEN ? ELSE superseded_at END "
+            "WHERE content_hash = ? AND deleted_at IS NULL",
+            (winner_hash, now, loser_hash),
+        )
+        if cur.rowcount > 0 and before is not None and before[0] != winner_hash:
+            self._append_supersede_event(loser_hash)
+
     async def mark_superseded_batch(self, pairs: list[tuple[str, str]]) -> int:
         """Mark memories as superseded in a single transaction."""
         if not pairs or not self.conn:
             return 0
 
         def _batch_mark():
-            # Issue #1724 / follow-up review: stamp superseded_at only on the
-            # actual current -> superseded transition. A retried batch (same
-            # winner) or a re-point keeps the ORIGINAL replacement moment —
-            # re-stamping would corrupt the historical instant that
-            # point-in-time queries rely on. (CASE sees pre-update values.)
             now = time.time()
-            self.conn.executemany(
-                "UPDATE memories SET superseded_by = ?, "
-                "superseded_at = CASE WHEN superseded_by IS NULL OR superseded_by = '' "
-                "THEN ? ELSE superseded_at END "
-                "WHERE content_hash = ? AND deleted_at IS NULL",
-                [(winner, now, loser) for winner, loser in pairs],
-            )
+            # SAVEPOINT: the UPDAT
```

**File**: `src/mcp_memory_service/storage/sync/apply.py` (modified, +30/-2)
```diff
@@ -472,8 +472,29 @@ def _top_level_fields(ev_op, pl):
                 if vv is not None}
     # update_metadata
     upd = (pl.get("updates", {}) or {})
-    return {kk: vv for kk, vv in upd.items()
-            if kk in ("tags", "memory_type") and vv is not None}
+    fields = {kk: vv for kk, vv in upd.items()
+              if kk in ("tags", "memory_type") and vv is not None}
+    fields.update(_supersede_fields(upd, pl))
+    return fields
+
+
+def _supersede_fields(upd, pl):
+    """Supersede columns carried by an update_metadata event (issue #1773).
+
+    ``superseded_by`` lives in ``updates`` ("" or None clears it). ``superseded_at`` is the
+    origin's instant at the payload top level, written as-is and never re-stamped here; a
+    clear without one clears it too. An event from a peer without #1773 has no top-level
+    ``superseded_at``, so only ``superseded_by`` is taken from it.
+    """
+    if "superseded_by" not in upd:
+        return {}
+    superseded_by = upd["superseded_by"] or None
+    fields = {"superseded_by": superseded_by}
+    if "superseded_at" in pl:
+        fields["superseded_at"] = pl["superseded_at"]
+    elif superseded_by is None:
+        fields["superseded_at"] = None
+    return fields
 
 
 def _take_if_winner(best, best_key, k, key, value):
@@ -563,6 +584,13 @@ def _write_merged_metadata(s, content_hash, best, meta_best, create_md_keys, lat
     event_owned = set(meta_best) | create_md_keys
     merged_md = {kk: vv for kk, vv in current_md.items() if kk not in event_owned}
     merged_md.update(meta_best)
+    if "superseded_by" in best:
+        # Keep the legacy JSON mirror in step with the column, as update_memory_metadata
+        # does on the origin (#1773): readers such as the contradiction scan check it.
+        if best["superseded_by"] is None:
+            merged_md.pop("superseded_by", None)
+        else:
+            merged_md["superseded_by"] = best["superseded_by"]
     best = dict(best)
     best["metadata"] = merged_md
 
```

**File**: `tests/sync/test_1773_supersede_propagation.py` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+"""
+Issue #1773: a supersede that happens after the first sync must reach the other peers.
+
+#1726 made the baseline snapshot and the create path carry ``superseded_by`` /
+``superseded_at``, which covers rows that were already superseded when first synced.
+These tests cover a supersede made later through each of the three writers, and two
+peers superseding the same memory with different winners.
+"""
+
+import json
+import os
+import tempfile
+
+import pytest
+import pytest_asyncio
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.storage.sync.apply import apply_remote_event
+from mcp_memory_service.storage.sync.orchestrator import _read_local_events_since
+from mcp_memory_service.utils.hashing import generate_content_hash
+
+
+@pytest_asyncio.fixture
+async def peers(monkeypatch):
+    """Two empty sqlite-vec stores with the event log on."""
+    monkeypatch.setenv("MCP_SYNC_EVENTLOG", "true")
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    with tempfile.TemporaryDirectory() as tmp:
+        a = SqliteVecMemoryStorage(os.path.join(tmp, "a.db"))
+        b = SqliteVecMemoryStorage(os.path.join(tmp, "b.db"))
+        await a.initialize()
+        await b.initialize()
+        yield a, b
+        await a.close()
+        await b.close()
+
+
+async def _store(storage, content):
+    h = generate_content_hash(content)
+    ok, msg = await storage.store(Memory(content=content, content_hash=h, tags=["t"], memory_type="note"))
+    assert ok, msg
+    return h
+
+
+def _sync(src, dst):
+    """Apply every event src has logged to dst (duplicates are idempotent no-ops)."""
+    for event in _read_local_events_since(src, 0, 10_000):
+        result = apply_remote_event(dst, event)
+        assert result.applied or "Duplicate" in result.reason, result.reason
+
+
+def _supersede_state(storage, content_hash):
+    return storage.conn.execute(
+        "SELECT superseded_by, superseded_at FROM memories WHERE content_hash = ?",
+        (content_hash,),
+    ).fetchone()
+
+
+async def _supersede(writer, storage, loser, winner_content):
+    """Supersede ``loser`` on ``storage`` through ``writer``; return the winner's hash."""
+    if writer == "versioned":
+        ok, msg, new_hash = await storage.update_memory_versioned(loser, winner_content)
+        assert ok, msg
+        return new_hash
+    winner = await _store(storage, winner_content)
+    if writer == "batch":
+        assert await storage.mark_superseded_batch([(winner, loser)]) == 1
+    else:
+        ok, msg = await storage.resolve_conflict(winner, loser)
+        assert ok, msg
+    return winner
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("writer", ["batch", "resolve_conflict", "versioned"])
+async def test_supersede_after_initial_sync_reaches_peer(peers, monkeypatch, writer):
+    a, b = peers
+    monkeypatch.setenv("MCP_AGENT_ID", "alpha")
+    x = await _store(a, "Memory X: the deploy target is staging")
+    _sync(a, b)
+    assert _supersede_state(b, x) == (None, None)
+
+    monkeypatch.setenv("MCP_AGENT_ID", "alpha")
+    winner = await _supersede(writer, a, x, "Memory Y: the deploy target is production")
+    superseded_by, superseded_at = _supersede_state(a, x)
+    assert superseded_by == winner and superseded_at is not None
+
+    # The event keeps superseded_at out of ``updates``: a peer without #1773 treats
+    # superseded_by there as protected and never reads the top-level field.
+    row = a.conn.execute(
+        "SELECT payload FROM sync_events WHERE content_hash = ? AND op = 'update_metadata'",
+        (x,),
+    ).fetchone()
+    payload = json.loads(row[0])
+    assert payload["updates"] == {"superseded_by": winner}
+    assert payload["superseded_at"] == superseded_at
+
+    monkeypatch.setenv("MCP_AGENT_ID", "beta")
+    _sync(a, b)
+    # Same value on both peers: the receiver writes the origin's instant, not its own.
+    assert _supersede_state(b, x) == (winner, superseded_at)
+
+
+@pytest.mark.asyncio
+async def test_retried_supersede_logs_no_second_event(peers, monkeypatch):
+    a, _ = peers
+    monkeypatch.setenv("MCP_AGENT_ID", "alpha")
+    x = await _store(a, "Memory X: retry target")
+    y = await _store(a, "Memory Y: retry winner")
+    assert await a.mark_superseded_batch([(y, x)]) == 1
+    assert await a.mark_superseded_batch([(y, x)]) == 1
+    count = a.conn.execute(
+        "SELECT COUNT(*) FROM sync_events WHERE content_hash = ? AND op = 'update_metadata'",
+        (x,),
+    ).fetchone()[0]
+    assert count == 1
+
+
+@pytest.mark.asyncio
+async def test_conflicting_supersedes_converge_in_both_orders(monkeypatch):
+    """Two peers supersede X with different winners; every arrival order ends the same."""
+    monkeypatch.setenv("MCP_SYNC_EVENTLOG", "true")
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    with tempfile.TemporaryDirecto
```

---

### Incident Patch 3: `6e8f5f15` (2026-11-01)
**Commit Message**: fix(deps): patch minimatch in bridge test dependencies (#1767)

* fix(deps): patch minimatch in bridge test dependencies

* docs(changelog): record bridge dependency security fixes

---------

Co-authored-by: Henry Krupp <[REDACTED_EMAIL]>

**File**: `changelog.d/1767.internal.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **Patch minimatch in the bridge test dependencies (#1767).** Both JavaScript test projects now lock minimatch 11.0.3 to address GHSA-g3hv-75wg-m249. Update glob alongside it so Mocha can still discover tests through wildcard paths.
```

**File**: `tests/bridge/package-lock.json` (modified, +57/-58)
```diff
@@ -13,6 +13,13 @@
         "sinon": "^17.0.0"
       }
     },
+    "node_modules/@isaacs/nonrecursive-glob-match": {
+      "version": "1.0.3",
+      "resolved": "https://registry.npmjs.org/@isaacs/nonrecursive-glob-match/-/nonrecursive-glob-match-1.0.3.tgz",
+      "integrity": "sha512-SI7kyKHq4XXDRozw+r9GlRZkia1ZkFrpLW98r2IC2Bpr8YkFGE3fvjzmxCG0x78A++69HmDNrDvSMYBZmHGpKA==",
+      "dev": true,
+      "license": "BlueOak-1.0.0"
+    },
     "node_modules/@sinonjs/commons": {
       "version": "3.0.1",
       "resolved": "https://registry.npmjs.org/@sinonjs/commons/-/commons-3.0.1.tgz",
@@ -385,13 +392,6 @@
         "flat": "cli.js"
       }
     },
-    "node_modules/fs.realpath": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
-      "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==",
-      "dev": true,
-      "license": "ISC"
-    },
     "node_modules/fsevents": {
       "version": "2.3.3",
       "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
@@ -418,21 +418,18 @@
       }
     },
     "node_modules/glob": {
-      "version": "8.1.0",
-      "resolved": "https://registry.npmjs.org/glob/-/glob-8.1.0.tgz",
-      "integrity": "sha512-r8hpEjiQEYlF2QU0df3dS+nxxSIreXQS1qRhMJM0Q5NDdR386C7jb7Hwwod8Fgiuex+k0GFjgft18yvxm5XoCQ==",
-      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
+      "version": "14.0.3",
+      "resolved": "https://registry.npmjs.org/glob/-/glob-14.0.3.tgz",
+      "integrity": "sha512-A1vjIwC3qpdCso45Iw127gnp7sPhqgY8lUQhDrArIs+GbmfaaVPFuoyy7WyLT9EPZCRZ7j7aLdwUhQmHWesEow==",
       "dev": true,
-      "license": "ISC",
+      "license": "BlueOak-1.0.0",
       "dependencies": {
-        "fs.realpath": "^1.0.0",
-        "inflight": "^1.0.4",
-        "inherits": "2",
-        "minimatch": "^5.0.1",
-        "once": "^1.3.0"
+        "minimatch": "^11.0.2",
+        "minipass": "^7.1.3",
+        "path-scurry": "^3.0.0"
       },
       "engines": {
-        "node": ">=12"
+        "node": "18 || 20 || >=22"
       },
       "funding": {
         "url": "https://github.com/sponsors/isaacs"
@@ -471,25 +468,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/inflight": {
-      "version": "1.0.6",
-      "resolved": "https://registry.npmjs.org/inflight/-/inflight-1.0.6.tgz",
-      "integrity": "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA==",
-      "deprecated": "This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",
-      "dev": true,
-      "license": "ISC",
-      "dependencies": {
-        "once": "^1.3.0",
-        "wrappy": "1"
-      }
-    },
-    "node_modules/inherits": {
-      "version": "2.0.4",
-      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
-      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
-      "dev": true,
-      "license": "ISC"
-    },
     "node_modules/is-binary-path": {
       "version": "2.1.0",
       "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
@@ -632,14 +610,25 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/lru-cache": {
+      "version": "11.5.3",
+      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.3.tgz",
+      "integrity": "sha512-U4N8FgzmWxc8k1VH8Kr6lQg18U7Fjvby6wXHVRX/ZZ7IwWbRMgrRbP0Wrb5q5NVinryp4SQampHKdvtecItxUg==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": "20 || >=22"
+      }
+    },
     "node_modules/minimatch": {
-      "version": "10.2.4",
-      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-10.2.4.tgz",
-      "integrity": "sha512-oRjTw/97aTBN0RHbYCdtF1MQfvusSIBQM0IZEgzl6426+8jSC0nF1a/GmnVLpfB9yyr6g6FTqWqiZVbxrtaCIg==",
+      "version": "11.0.3",
+      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-11.0.3.tgz",
+      "integrity": "sha512-iny/40PEGkNJQ5/Pv6z3nm6FbRAby32GeZRjCUJk2WnNDbgPSTcdI+DDvLqsgBdD4cD5sMtMheqPPnehCCa8Nw==",
       "dev": true,
       "license": "BlueOak-1.0.0",
       "dependencies": {
-        "brace-expansion": "^5.0.2"
+        "@isaacs/nonrecursive-glob-match": "^1.0.3",
+        "brace-expansion": "^5.0.12"
       },
       "engines": {
         "node": "18 || 20 || >=22"
@@ -648,6 +637,16 @@
         "url": "https://github.com/sponsors/isaacs"
       }
     },
+    "node_modules/minipass": {
+      "version": "7.1.3",
+      "resolved": "https://registry.n
```

**File**: `tests/bridge/package.json` (modified, +2/-1)
```diff
@@ -13,7 +13,8 @@
   },
   "overrides": {
     "brace-expansion": "^5.0.12",
-    "minimatch": "^10.2.3",
+    "glob": "^14.0.3",
+    "minimatch": "^11.0.1",
     "serialize-javascript": "^7.0.3"
   },
   "keywords": ["mcp", "bridge", "testing"],
```

**File**: `tests/integration/package-lock.json` (modified, +57/-58)
```diff
@@ -13,6 +13,13 @@
         "sinon": "^17.0.0"
       }
     },
+    "node_modules/@isaacs/nonrecursive-glob-match": {
+      "version": "1.0.3",
+      "resolved": "https://registry.npmjs.org/@isaacs/nonrecursive-glob-match/-/nonrecursive-glob-match-1.0.3.tgz",
+      "integrity": "sha512-SI7kyKHq4XXDRozw+r9GlRZkia1ZkFrpLW98r2IC2Bpr8YkFGE3fvjzmxCG0x78A++69HmDNrDvSMYBZmHGpKA==",
+      "dev": true,
+      "license": "BlueOak-1.0.0"
+    },
     "node_modules/@sinonjs/commons": {
       "version": "3.0.1",
       "resolved": "https://registry.npmjs.org/@sinonjs/commons/-/commons-3.0.1.tgz",
@@ -385,13 +392,6 @@
         "flat": "cli.js"
       }
     },
-    "node_modules/fs.realpath": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
-      "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==",
-      "dev": true,
-      "license": "ISC"
-    },
     "node_modules/fsevents": {
       "version": "2.3.3",
       "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
@@ -418,21 +418,18 @@
       }
     },
     "node_modules/glob": {
-      "version": "8.1.0",
-      "resolved": "https://registry.npmjs.org/glob/-/glob-8.1.0.tgz",
-      "integrity": "sha512-r8hpEjiQEYlF2QU0df3dS+nxxSIreXQS1qRhMJM0Q5NDdR386C7jb7Hwwod8Fgiuex+k0GFjgft18yvxm5XoCQ==",
-      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
+      "version": "14.0.3",
+      "resolved": "https://registry.npmjs.org/glob/-/glob-14.0.3.tgz",
+      "integrity": "sha512-A1vjIwC3qpdCso45Iw127gnp7sPhqgY8lUQhDrArIs+GbmfaaVPFuoyy7WyLT9EPZCRZ7j7aLdwUhQmHWesEow==",
       "dev": true,
-      "license": "ISC",
+      "license": "BlueOak-1.0.0",
       "dependencies": {
-        "fs.realpath": "^1.0.0",
-        "inflight": "^1.0.4",
-        "inherits": "2",
-        "minimatch": "^5.0.1",
-        "once": "^1.3.0"
+        "minimatch": "^11.0.2",
+        "minipass": "^7.1.3",
+        "path-scurry": "^3.0.0"
       },
       "engines": {
-        "node": ">=12"
+        "node": "18 || 20 || >=22"
       },
       "funding": {
         "url": "https://github.com/sponsors/isaacs"
@@ -471,25 +468,6 @@
         "he": "bin/he"
       }
     },
-    "node_modules/inflight": {
-      "version": "1.0.6",
-      "resolved": "https://registry.npmjs.org/inflight/-/inflight-1.0.6.tgz",
-      "integrity": "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA==",
-      "deprecated": "This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",
-      "dev": true,
-      "license": "ISC",
-      "dependencies": {
-        "once": "^1.3.0",
-        "wrappy": "1"
-      }
-    },
-    "node_modules/inherits": {
-      "version": "2.0.4",
-      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
-      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
-      "dev": true,
-      "license": "ISC"
-    },
     "node_modules/is-binary-path": {
       "version": "2.1.0",
       "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
@@ -632,14 +610,25 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/lru-cache": {
+      "version": "11.5.3",
+      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.3.tgz",
+      "integrity": "sha512-U4N8FgzmWxc8k1VH8Kr6lQg18U7Fjvby6wXHVRX/ZZ7IwWbRMgrRbP0Wrb5q5NVinryp4SQampHKdvtecItxUg==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": "20 || >=22"
+      }
+    },
     "node_modules/minimatch": {
-      "version": "10.2.4",
-      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-10.2.4.tgz",
-      "integrity": "sha512-oRjTw/97aTBN0RHbYCdtF1MQfvusSIBQM0IZEgzl6426+8jSC0nF1a/GmnVLpfB9yyr6g6FTqWqiZVbxrtaCIg==",
+      "version": "11.0.3",
+      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-11.0.3.tgz",
+      "integrity": "sha512-iny/40PEGkNJQ5/Pv6z3nm6FbRAby32GeZRjCUJk2WnNDbgPSTcdI+DDvLqsgBdD4cD5sMtMheqPPnehCCa8Nw==",
       "dev": true,
       "license": "BlueOak-1.0.0",
       "dependencies": {
-        "brace-expansion": "^5.0.2"
+        "@isaacs/nonrecursive-glob-match": "^1.0.3",
+        "brace-expansion": "^5.0.12"
       },
       "engines": {
         "node": "18 || 20 || >=22"
@@ -648,6 +637,16 @@
         "url": "https://github.com/sponsors/isaacs"
       }
     },
+    "node_modules/minipass": {
+      "version": "7.1.3",
+      "resolved": "https://registry.n
```

**File**: `tests/integration/package.json` (modified, +2/-1)
```diff
@@ -13,7 +13,8 @@
   },
   "overrides": {
     "brace-expansion": "^5.0.12",
-    "minimatch": "^10.2.3",
+    "glob": "^14.0.3",
+    "minimatch": "^11.0.1",
     "serialize-javascript": "^7.0.3"
   },
   "keywords": ["mcp", "bridge", "integration", "testing"],
```

#### Recent Merged Pull Requests:
- **PR #1795** (closed): fix(harvest): _try_evolve returns the evolved hash, so capture() can unpack it (@Esmail-sarhadi)
- **PR #1792** (2026-11-02): fix(web): reject blank memory content and guard NULL cosine distance (#1791) (@10RZC22)
- **PR #1790** (2026-11-02): fix(migrations): read migration files as UTF-8 (#1789) (@ppcvote)
- **PR #1788** (2026-11-02): fix(sync): propagate a supersede made after the first sync (#1773) (@ppcvote)
- **PR #1787** (2026-11-02): feat(i18n): add Brazilian Portuguese dashboard translation (#1755) (@shyam1017)
- **PR #1786** (2026-11-02): fix(storage): stop capping Milvus full reads at 16384 rows (#1785) (@henry201605)

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

## X. memory_search point-in-time queries with as_of and status flags (fixes #1724) (#

**RULE**:
When implementing operations in `changelog.d/1724.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ce80cb53`: memory_search point-in-time queries with as_of and status flags (fixes #1724) (#1726). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1724.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Point-in-time `as_of` searches no longer leak present-day fallback results (#1724).**
  With `fallback=true`, an `as_of` search returning fewer than three matches could
  append present-day exact or tag matches. The cascading fallback stages now forward
  `as_of`, so historical queries only return memories that were current at the
  requested date.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ce80cb53` are properly handled with clean fallback behavior.
