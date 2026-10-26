> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `25308324`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T13:15:20.525Z  
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
> **Harvest Timestamp**: 2026-10-26T13:15:19.237Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2048 stars

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
- **Issue #1628** (2026-10-21): **cli: memory migrate still stops at migration 008 on a pre-v8.7 database**
  *Symptoms*: ## What happens  #1626 fixed #1622 for the service: `SqliteVecMemoryStorage.initialize()` now creates the `metadata` table before it runs the schema migrations. The `memory migrate` command does not go through `initialize()`, so on a sqlite-vec database from before v8.7.0 it still fails the same way: migration 008 stops with `no such table: metadata`, and nothing after it applies.  ## Why  `memory migrate` (`cli/main.py:411`) opens the file with a plain `sqlite3.connect(db_path)` (`:429`) and calls `MigrationRunner.run_pending(conn)` directly (`:431`). `run_pending()` (`storage/migration_runner.py:211`) creates its own registry table (`_ensure_registry_table`, `:37`) but not `metadata`, where it keeps `schema_version`. Credit to @Clannad47, who pointed this out in the #1626 description.  ## Suggested fix  Create `metadata` inside `MigrationRunner` itself, next to `_ensure_registry_table()` and with the same definition the storage uses (`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`). Then every caller of `run_pending()` is covered, the CLI and `initialize()` alike, and the separate guard from #1626 becomes redundant but harmless. Keep the `--dry-run` path read-only: with `dry_run=True` nothing may be created.  ## For whoever picks this up  - The test goes in `tests/storage/`, next to `test_1622_legacy_metadata_table.py`, whose pre-v8.7 database setup you can reuse. Drive it through the real code path: build that database under `temp_db_path`

- **Issue #1622** (2026-10-21): **storage: a pre-v8.7 sqlite-vec database never finishes its schema upgrade, so search returns nothing**
  *Symptoms*: ## What happens  A sqlite-vec database created before v8.7.0, and not opened by any version since, does not upgrade when a current release opens it. The service starts and `count` is right, but semantic search and tag search fail:  ``` Schema migration warning: Migration 008_add_graph_table failed: no such table: metadata Failed to retrieve memories: no such column: m.embedding_pending Failed to search by tags: no such column: embedding_pending ```  The data is intact, but every search comes back empty, and the only sign in the log is a warning.  ## Why  `SqliteVecMemoryStorage.initialize()` in `storage/mixins/migrations.py` has two paths. For a new database, `_apply_pragmas_and_create_tables` creates the `metadata` table (`:395`) before the schema migrations run (`:515`). For an existing database, the branch starting at `:119` calls `_run_schema_migrations` (`:333`) without creating it. `MigrationRunner` keeps `schema_version` in `metadata`, so on a database that predates the table, the first pending migration fails, the runner stops, and everything after it (017 adds `embedding_pending`) never applies.  The table has been created since v8.7.0 (66152de5, 2025-10-26), so this hits only databases from before that, and only when they skip every version in between. In practice that means installs left untouched for a year, and anyone migrating off ChromaDB with v7.6.0 (tag `chromadb-legacy-final`, see #1621).  ## Reproduced  1. Install v7.6.0 from the tag in a throwaway venv, cr

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

### Incident Patch 1: `fb7c041e` (2026-10-26)
**Commit Message**: fix(oauth): confine per-store grants to calls that stay in the store (#1690)

* fix(oauth): confine per-store grants to calls that stay in the store

A read:<store>/write:<store> grant authorized every MCP tool call that
named the store, but only some tools confine themselves to it.
memory_quality, memory_cleanup, memory_resolve, memory_consolidate and the
mistake-note tools ignore store, so write:projectA plus store="projectA"
reached every partition. memory_search with include_beliefs or fallback
read across partitions as well. On cloudflare, milvus and remote_http,
get_by_hash ignores store, so GET /api/memories/{hash} returned another
store's memory to a read:projectA token.

MemoryServer.store_grant_target now decides which store a per-store
grant may authorize: only for the eight tools whose handlers confine,
without the two cross-store arguments, and only on a backend whose
get_by_hash honours store. The SDK dispatch gate and the /mcp shim both
use it. On REST, require_store_scope refuses a grant that holds only
through operation:<store> on a backend that cannot confine. Global
grants are unchanged. Storage-layer enforcement remains #1683.

The scope check in mcp_endpoint mo

**File**: `changelog.d/1690.fixed.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+- **Per-store scopes no longer reach outside their store (#1690).** A `read:<store>` /
+  `write:<store>` grant authorized any MCP tool call that named the store, including tools
+  that ignore `store` (`memory_quality`, `memory_cleanup`, `memory_resolve`,
+  `memory_consolidate`, the mistake-note tools) and `memory_search` with `include_beliefs` or
+  `fallback`, which read every partition. A per-store grant now covers only the tools that
+  confine themselves to the store (`memory_store`, `memory_store_session`, `memory_search`,
+  `memory_list`, `memory_delete`, `memory_update`) and only without those two arguments;
+  everything else needs the global scope, including `memory_explore` and `memory_detail`,
+  whose entity names come from a graph that has no store partition. The SDK
+  transports and the `/mcp` shim share one rule. Store-restricted credentials are also
+  refused, over MCP and REST, on backends whose `get_by_hash` ignores `store` (cloudflare,
+  milvus, remote_http), where `GET /api/memories/{hash}` returned another store's memory.
+  They work on sqlite_vec and hybrid until the storage layer enforces `store` (#1683).
```

**File**: `src/mcp_memory_service/server_impl.py` (modified, +37/-4)
```diff
@@ -1613,6 +1613,40 @@ def _rate_limit_error(
             isError=True,
         )
 
+    # Tools whose handlers keep reads and writes inside the claimed ``store``
+    # on a backend whose get_by_hash honours it. A per-store grant
+    # (read:<s>/write:<s>) authorizes only these: every other tool acts on all
+    # partitions, so naming a store there must not unlock it. memory_explore
+    # and memory_detail are left out: the entity graph is not partitioned, so
+    # their entity names and related entities span every store (#1683).
+    STORE_CONFINED_TOOLS = frozenset({
+        "memory_store", "memory_store_session", "memory_search", "memory_list",
+        "memory_delete", "memory_update",
+    })
+    # memory_search arguments that read outside the claimed store: beliefs are
+    # not partitioned, and the exact/tag fallback queries ignore ``store``.
+    CROSS_STORE_ARGUMENTS = ("include_beliefs", "fallback")
+
+    async def store_grant_target(self, name: Optional[str], arguments: Optional[dict] = None) -> Optional[str]:
+        """Return the store a per-store grant may authorize this call for.
+
+        ``None`` means only the global grant will do: the call names no store
+        (or ``all``), the tool ignores ``store``, the call reaches across
+        partitions, or the backend's get_by_hash ignores ``store`` and so cannot
+        prove confinement (storage-layer enforcement is #1683). The SDK dispatch
+        gate and the /mcp shim both ask this, so the transports cannot disagree.
+        """
+        arguments = arguments or {}
+        store = arguments.get("store")
+        if store in (None, "all") or name not in self.STORE_CONFINED_TOOLS:
+            return None
+        if any(arguments.get(key) for key in self.CROSS_STORE_ARGUMENTS):
+            return None
+        storage = await self._ensure_storage_initialized()
+        if not getattr(storage, "get_by_hash_is_store_scoped", False):
+            return None
+        return store
+
     async def tool_requires_write(self, name: Optional[str], arguments: Optional[dict] = None) -> bool:
         """Return True if calling this tool requires the 'write' scope.
 
@@ -1738,16 +1772,15 @@ async def call_tool(
         scope_str = self._caller_scope_str()
         if scope_str is not None:
             operation = "write" if await self.tool_requires_write(name, arguments) else "read"
-            store_arg = (arguments or {}).get("store")
-            target = None if store_arg in (None, "all") else store_arg
+            target = await self.store_grant_target(name, arguments)
             if not self._scope_grants(scope_str, operation, target):
                 logger.warning(
                     "Refused %s tool for a scope lacking the store grant: %s",
                     operation, _sanitize_log_value(name),
                 )
+                required = "'%s' (global)" % operation if target is None else "'%s:%s'" % (operation, target)
                 raise PermissionError(
-                    "insufficient_scope: tool '%s' requires '%s%s' access"
-                    % (name, operation, "" if target is None else ":" + target)
+                    "insufficient_scope: tool '%s' requires %s access" % (name, required)
                 )
 
         # Resolve handler from routing table
```

**File**: `src/mcp_memory_service/web/api/mcp.py` (modified, +33/-32)
```diff
@@ -47,6 +47,36 @@ async def _requires_write(server, tool_name: Optional[str], arguments: Optional[
     """
     return await server.tool_requires_write(tool_name, arguments)
 
+
+async def _scope_refusal(server, user, request_id, tool_name: str, arguments: dict) -> Optional[JSONResponse]:
+    """Return the 403 for a tool call the caller's scope does not cover, else None.
+
+    Mutating tools require 'write', read-only tools require 'read'
+    (GHSA-2r68-g678-7qr3). A global 'read'/'write' grants every store.
+    'read:<store>'/'write:<store>' grants exactly that store, and only where
+    MemoryServer.store_grant_target says the call stays inside it (the same rule
+    the SDK transports apply); anything else, including a call with no `store`,
+    requires the global operation scope.
+    """
+    operation = "write" if await _requires_write(server, tool_name, arguments) else "read"
+    target = await server.store_grant_target(tool_name, arguments)
+    if user.has_store_scope(operation, target):
+        return None
+    required = (
+        f"'{operation}' (global)" if target is None
+        else f"'{operation}' or '{operation}:{target}'"
+    )
+    response = MCPResponse(
+        id=request_id,
+        error={
+            "code": -32003,
+            "message": f"Insufficient scope: tool requires {required} access",
+            "data": {"required_scope": operation, "tool": tool_name, "store": arguments.get("store")},
+        },
+    )
+    return JSONResponse(content=response.model_dump(exclude_none=True), status_code=403)
+
+
 router = APIRouter(prefix="/mcp", tags=["mcp"])
 
 
@@ -235,38 +265,9 @@ async def mcp_endpoint(
                 )
                 return JSONResponse(content=response.model_dump(exclude_none=True))
 
-            # Scope enforcement, per tool call. Mutating tools require 'write',
-            # read-only tools require 'read' (GHSA-2r68-g678-7qr3). When the
-            # call names a `store`, the check is per-store: a global
-            # 'read'/'write' grants every store, else 'read:<store>'/
-            # 'write:<store>' grants exactly that store ('all' -> global). A
-            # call with no `store` targets the implicit default and requires
-            # the global operation scope.
-            operation = "write" if await _requires_write(server, tool_name, arguments) else "read"
-            store_arg = arguments.get("store")
-            if store_arg is not None:
-                resolved_store = None if store_arg == "all" else store_arg
-                authorized = user.has_store_scope(operation, resolved_store)
-                required = (
-                    f"'{operation}' (global)" if resolved_store is None
-                    else f"'{operation}' or '{operation}:{store_arg}'"
-                )
-            else:
-                authorized = user.has_scope(operation)
-                required = f"'{operation}'"
-            if not authorized:
-                response = MCPResponse(
-                    id=request.id,
-                    error={
-                        "code": -32003,
-                        "message": f"Insufficient scope: tool requires {required} access",
-                        "data": {"required_scope": operation, "tool": tool_name, "store": store_arg},
-                    },
-                )
-                return JSONResponse(
-                    content=response.model_dump(exclude_none=True),
-                    status_code=403,
-                )
+            refusal = await _scope_refusal(server, user, request.id, tool_name, arguments)
+            if refusal is not None:
+                return refusal
 
             # Resolve the rate-limit identity from the transport BEFORE the
             # arguments rewrite below: the shim copies X-Agent-ID into
```

**File**: `src/mcp_memory_service/web/oauth/middleware.py` (modified, +34/-1)
```diff
@@ -109,7 +109,27 @@ def has_store_scope(self, operation: str, store: Optional[str]) -> bool:
         return f"{operation}:{store}" in scopes
 
     def require_store_scope(self, operation: str, store: Optional[str]) -> None:
-        """Raise 403 if ``operation`` on ``store`` is not permitted."""
+        """Raise 403 if ``operation`` on ``store`` is not permitted.
+
+        A grant that holds only through ``operation:<store>`` additionally needs
+        a backend that confines hash lookups to the store. cloudflare, milvus
+        and remote_http accept ``store`` on get_by_hash and ignore it, so there
+        a store-restricted credential would read or delete another partition's
+        memory by hash; it is refused until the storage layer enforces
+        ``store`` (#1683). Global grants are unaffected.
+        """
+        if self.has_store_scope(operation, store) and not self.has_scope(operation):
+            if not _storage_confines_store():
+                raise HTTPException(
+                    status_code=status.HTTP_403_FORBIDDEN,
+                    detail={
+                        "error": "insufficient_scope",
+                        "error_description": (
+                            "Store-restricted credentials are not supported on this "
+                            f"storage backend; use a global '{operation}' scope"
+                        ),
+                    }
+                )
         if not self.has_store_scope(operation, store):
             if store is None:
                 needed = f"'{operation}' (global, for cross-store access)"
@@ -124,6 +144,19 @@ def require_store_scope(self, operation: str, store: Optional[str]) -> None:
             )
 
 
+def _storage_confines_store() -> bool:
+    """Whether the active backend's get_by_hash honours ``store``.
+
+    Fails closed: no initialized storage counts as not confining.
+    """
+    from ..dependencies import get_storage  # inline import: keeps the storage stack out of OAuth module import
+    try:
+        storage = get_storage()
+    except HTTPException:
+        return False
+    return bool(getattr(storage, "get_by_hash_is_store_scoped", False))
+
+
 def scope_within_ceiling(requested: Optional[str], ceiling: Optional[str]) -> bool:
     """Return True if every token in ``requested`` is permitted by ``ceiling``.
 
```

**File**: `tests/unit/test_store_grant_gate.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Per-store grants on the native MCP transports (SSE, Streamable HTTP).
+
+The SDK dispatch gate must apply the same rule as the /mcp shim: a
+read:<store>/write:<store> grant authorizes a call only when the tool confines
+itself to that store, the call does not reach across partitions, and the
+backend can prove confinement. Everything else needs the global grant.
+"""
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+from mcp import types
+from mcp.server.lowlevel.server import request_ctx
+from mcp.shared.context import RequestContext
+
+# Via the package: the direct server_impl import races the package __init__.
+from mcp_memory_service.server import MemoryServer
+
+
+@pytest.fixture
+def server(monkeypatch):
+    srv = MemoryServer()
+    srv.remote_transport = True
+    srv.storage = AsyncMock()
+    srv.storage.get_by_hash_is_store_scoped = True
+    monkeypatch.setattr(srv, "_ensure_storage_initialized", AsyncMock(return_value=srv.storage))
+    srv.handled = []
+
+    async def handler(_server, arguments):
+        srv.handled.append(arguments)
+        return [types.TextContent(type="text", text="handled")]
+
+    monkeypatch.setattr("mcp_memory_service.tools.routing.resolve_handler", lambda name: handler)
+    return srv
+
+
+async def _call(server, name, arguments, scope):
+    ctx = RequestContext(
+        request_id=1, meta=None, session=None, lifespan_context=None,
+        request=SimpleNamespace(scope={"mcp_auth_scope": scope}, headers={}, client=None),
+    )
+    token = request_ctx.set(ctx)
+    try:
+        handler = server.server.request_handlers[types.CallToolRequest]
+        req = types.CallToolRequest(
+            method="tools/call",
+            params=types.CallToolRequestParams(name=name, arguments=arguments),
+        )
+        return (await handler(req)).root
+    finally:
+        request_ctx.reset(token)
+
+
+@pytest.mark.asyncio
+async def test_store_grant_cannot_reach_a_tool_that_ignores_store(server):
+    result = await _call(server, "memory_quality",
+                         {"action": "rate", "content_hash": "h", "rating": "-1", "store": "projectA"},
+                         "read:projectA write:projectA")
+    assert result.isError
+    assert server.handled == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("flag", ["include_beliefs", "fallback"])
+async def test_store_grant_cannot_search_across_partitions(server, flag):
+    result = await _call(server, "memory_search", {"query": "x", "store": "projectA", flag: True},
+                         "read:projectA")
+    assert result.isError
+    assert server.handled == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("tool, arguments", [
+    ("memory_explore", {"query": "x", "store": "projectA"}),
+    ("memory_detail", {"entity_id": "e", "store": "projectA"}),
+])
+async def test_store_grant_cannot_read_the_unpartitioned_graph(server, tool, arguments):
+    """Entity names and related entities come from a graph with no store, so
+    a per-store grant would see other stores' entities."""
+    result = await _call(server, tool, arguments, "read:projectA")
+    assert result.isError
+    assert server.handled == []
+
+
+@pytest.mark.asyncio
+async def test_store_grant_refused_on_a_backend_that_cannot_confine(server):
+    server.storage.get_by_hash_is_store_scoped = False
+    result = await _call(server, "memory_delete", {"content_hash": "h", "store": "projectA"},
+                         "read:projectA write:projectA")
+    assert result.isError
+    assert server.handled == []
+
+
+@pytest.mark.asyncio
+async def test_store_grant_still_works_for_a_confined_tool(server):
+    result = await _call(server, "memory_delete", {"content_hash": "h", "store": "projectA"},
+                         "read:projectA write:projectA")
+    assert not result.isError
+    assert server.handled == [{"content_hash": "h", "store": "projectA"}]
+
+
+@pytest.mark.asyncio
+async def test_global_grant_is_unchanged(server):
+    server.storage.get_by_hash_is_store_scoped = False
+    result = await _call(server, "memory_quality",
+                         {"action": "rate", "content_hash": "h", "rating": "-1", "store": "projectA"},
+                         "read write")
+    assert not result.isError
+    assert len(server.handled) == 1
```

**File**: `tests/web/api/test_store_grant_confinement.py` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+"""
+A per-store grant (read:<store> / write:<store>) authorizes only calls that
+really stay inside that store.
+
+#1682 introduced per-store scopes and gated every request on the store the
+caller *claims*. Three holes were left behind it:
+
+- tools that ignore ``store`` (memory_quality, memory_cleanup, memory_resolve,
+  ...) accepted a claimed store and then acted on every partition;
+- memory_search's ``include_beliefs`` and ``fallback`` read across partitions
+  even when the main search is store-scoped;
+- on backends whose ``get_by_hash`` ignores ``store`` (cloudflare, milvus,
+  remote_http), hash-addressed REST routes returned another store's memory.
+
+These drive the real /mcp shim and the real REST routes against sqlite-vec,
+with the authenticated user replaced by one holding exactly the given scope.
+"""
+
+import os
+import tempfile
+
+import pytest
+import pytest_asyncio
+from fastapi.testclient import TestClient
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.utils.hashing import generate_content_hash
+from mcp_memory_service.web.dependencies import set_storage
+
+
+@pytest.fixture
+def temp_db():
+    with tempfile.TemporaryDirectory() as tmpdir:
+        yield os.path.join(tmpdir, "test.db")
+
+
+@pytest_asyncio.fixture
+async def storage(temp_db, monkeypatch):
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    s = SqliteVecMemoryStorage(temp_db)
+    await s.initialize()
+    yield s
+    await s.close()
+
+
+@pytest_asyncio.fixture
+async def other_store_hash(storage):
+    """A memory that lives in projectB, which a projectA credential must not reach."""
+    content = "belongs to projectB only"
+    memory = Memory(content=content, content_hash=generate_content_hash(content), tags=["b"])
+    ok, _ = await storage.store(memory, store="projectB")
+    assert ok
+    return memory.content_hash
+
+
+@pytest.fixture
+def make_client(storage, monkeypatch):
+    from mcp_memory_service.web.app import app
+    from mcp_memory_service.web.oauth import middleware
+    from mcp_memory_service.web.api import mcp
+
+    monkeypatch.setattr(middleware, "API_KEY", None)
+    monkeypatch.setattr(middleware, "OAUTH_ENABLED", False)
+    monkeypatch.setattr(middleware, "ALLOW_ANONYMOUS_ACCESS", True)
+    from mcp_memory_service.web import dependencies
+    # Restored on teardown, so this storage cannot answer later tests' lookups.
+    monkeypatch.setattr(dependencies, "_storage", None)
+    set_storage(storage)
+    monkeypatch.setattr(mcp, "_memory_server", None)
+
+    def _make(scope):
+        async def mock_user():
+            return middleware.AuthenticationResult(
+                authenticated=True, client_id="c", scope=scope, auth_method="test",
+            )
+
+        app.dependency_overrides[middleware.get_current_user] = mock_user
+        app.dependency_overrides[middleware.require_read_access] = mock_user
+        return TestClient(app)
+
+    yield _make
+    app.dependency_overrides.clear()
+
+
+def _ignore_store_like_cloudflare(storage, monkeypatch):
+    """Make the sqlite backend behave like cloudflare/milvus/remote_http:
+    get_by_hash accepts ``store`` and ignores it, and says so."""
+    original = storage.get_by_hash
+
+    async def get_by_hash(content_hash, store=None):
+        return await original(content_hash)
+
+    monkeypatch.setattr(storage, "get_by_hash", get_by_hash)
+    monkeypatch.setattr(storage, "get_by_hash_is_store_scoped", False)
+
+
+def _call(client, name, arguments):
+    return client.post("/mcp", json={
+        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
+        "params": {"name": name, "arguments": arguments},
+    })
+
+
+def _refused(response):
+    return response.status_code == 403 and response.json()["error"]["code"] == -32003
+
+
+# --------------------------------------------------------------------------
+# /mcp shim: tool allowlist and cross-store arguments
+# --------------------------------------------------------------------------
+
+@pytest.mark.integration
+def test_store_grant_cannot_reach_a_tool_that_ignores_store(make_client, other_store_hash):
+    """memory_quality has no store parameter: claiming one must not unlock it."""
+    client = make_client("read:projectA write:projectA")
+    response = _call(client, "memory_quality", {
+        "action": "rate", "content_hash": other_store_hash, "rating": "-1", "store": "projectA",
+    })
+    assert _refused(response)
+
+
+@pytest.mark.integration
+@pytest.mark.parametrize("flag", ["include_beliefs", "fallback"])
+def test_store_grant_cannot_search_across_partitions(make_client, flag):
+    client = make_client("read:projectA")
+    response = _call(client, "memory_search", {"query": "x", "store": "projectA", flag: True})
+    assert _refused(response)
+
+
+@pytest.mark.integration
+def test_store_grant_still_searches_its_own_store
```

**File**: `tests/web/test_anonymous_scope.py` (modified, +9/-0)
```diff
@@ -29,6 +29,15 @@
 from mcp_memory_service.web.oauth.middleware import AuthenticationResult
 
 
+@pytest.fixture(autouse=True)
+def _confining_backend(monkeypatch):
+    """The commons store only works on a backend that confines get_by_hash to a
+    store; the refusal elsewhere is covered in
+    tests/web/api/test_store_grant_confinement.py."""
+    from mcp_memory_service.web.oauth import middleware
+    monkeypatch.setattr(middleware, "_storage_confines_store", lambda: True)
+
+
 # --------------------------------------------------------------------------
 # config resolution: unset -> full default, set-empty -> nothing, value kept
 # --------------------------------------------------------------------------
```

**File**: `tests/web/test_oauth_store_scopes.py` (modified, +9/-0)
```diff
@@ -30,6 +30,15 @@
 )
 
 
+@pytest.fixture(autouse=True)
+def _confining_backend(monkeypatch):
+    """These test the scope grammar, so the backend counts as one that confines
+    get_by_hash to a store. The refusal on a backend that cannot is covered in
+    tests/web/api/test_store_grant_confinement.py."""
+    from mcp_memory_service.web.oauth import middleware
+    monkeypatch.setattr(middleware, "_storage_confines_store", lambda: True)
+
+
 def _auth(scope):
     return AuthenticationResult(authenticated=True, client_id="c", scope=scope, auth_method="oauth")
 
```

---

### Incident Patch 2: `e15728d6` (2026-10-26)
**Commit Message**: fix(web): save the dashboard's Quality tab settings (#1671) (#1676)

* fix(web): save the dashboard's Quality tab settings (#1671)

The provider dropdown and the boost toggle on the Quality tab were never
read, the toggle rendered checked although boosting is off by default,
and the Current Provider box was hardcoded.

Add an admin-only POST /api/config/quality that writes
MCP_QUALITY_AI_PROVIDER and MCP_QUALITY_BOOST_ENABLED to .env and
restarts the server, and wire the tab to it: it now loads both values
from /api/config/env and has a Save & Restart button.

Values are checked against the choices ENV_CATEGORIES already lists. A
provider whose key is missing is refused before anything is written,
since QualityConfig.validate() would stop the restarted server from
starting. The saved values also go into os.environ: load_dotenv copied
the old .env values there, and the restarted process inherits them.

* fix(web): address review on the Quality tab save (#1671)

Keep the tab's controls and Save disabled until /config/env has answered,
so a slow or failed load can no longer write the HTML defaults over the
configured values; a failed load says so and reopening the tab retries.

Read t

**File**: `changelog.d/1671.fixed.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+- **The dashboard's Quality tab now saves its settings (#1671).**
+  The AI provider dropdown and the quality-boost toggle were never read by anything, the
+  toggle rendered checked although the boost is off by default, and the "Current Provider"
+  box was hardcoded. A new admin-only `POST /api/config/quality` writes
+  `MCP_QUALITY_AI_PROVIDER` and `MCP_QUALITY_BOOST_ENABLED` to `.env` and restarts the
+  server; the tab loads both from `/api/config/env` and gets a "Save & Restart" button.
+  Values are checked against the choices the Environment tab already lists, and a provider
+  whose API key is missing (groq, gemini) is refused up front, because
+  `QualityConfig.validate()` would otherwise stop the server from coming back. Saved values
+  also apply after the restart when the old value had already been loaded from `.env`.
```

**File**: `src/mcp_memory_service/web/api/configuration.py` (modified, +113/-3)
```diff
@@ -16,7 +16,8 @@
 Configuration API endpoint for exposing .env parameters.
 
 Provides read-only access to environment configuration with sensitive value masking,
-plus write access for Cloudflare credentials with connection validation.
+plus write access for Cloudflare credentials with connection validation and for the
+quality settings shown in the dashboard's Quality tab.
 """
 
 import os
@@ -512,8 +513,8 @@ async def get_env_configuration(user = Depends(require_read_access)):
             choices = param_def[2] if len(param_def) > 2 else None
             sensitive = param_def[3] if len(param_def) > 3 else False
 
-            # Get current value (environment > .env)
-            value = os.getenv(key) or env_vars.get(key)
+            # Get current value (environment > .env, even when empty, as at startup)
+            value = os.environ[key] if key in os.environ else env_vars.get(key)
 
             # Determine source
             source = "default"
@@ -642,6 +643,9 @@ def _write_credential_to_env(env_path: Path, key: str, value: str) -> None:
             new_lines.append(line)
 
     if not found:
+        # A file that ends without a newline would otherwise get the key glued to its last line
+        if new_lines and not new_lines[-1].endswith("\n"):
+            new_lines[-1] += "\n"
         new_lines.append(f"{key}={value}\n")
 
     with open(env_path, 'w', encoding='utf-8') as f:
@@ -799,3 +803,109 @@ def _sanitize(v: str) -> str:
         message="Credentials saved. Server restarting...",
         restart_scheduled=True,
     )
+
+
+# ---------------------------------------------------------------------------
+# Quality settings
+# ---------------------------------------------------------------------------
+
+# Keys the Quality tab may write. Each one is also listed in the "quality"
+# category of ENV_CATEGORIES, which supplies its type and allowed choices.
+QUALITY_WRITABLE_KEYS = ("MCP_QUALITY_AI_PROVIDER", "MCP_QUALITY_BOOST_ENABLED")
+
+# Variables a provider needs before QualityConfig.validate() lets the server start.
+QUALITY_PROVIDER_REQUIREMENTS = {
+    "groq": ("GROQ_API_KEY",),
+    "gemini": ("GEMINI_API_KEY",),
+}
+
+
+class SaveQualitySettingsRequest(BaseModel):
+    settings: dict[str, str]
+
+
+def _normalize_quality_value(key: str, raw: str) -> str:
+    """Strip control characters and check the value against the key's type and choices."""
+    param_type, choices = next(
+        (param_type, choices)
+        for param_key, param_type, choices, _ in ENV_CATEGORIES["quality"]["params"]
+        if param_key == key
+    )
+    value = re.sub(r"[\x00-\x1f\x7f]", "", raw).strip()
+
+    if param_type == "boolean":
+        value = value.lower()
+        if value not in ("true", "false"):
+            raise HTTPException(status_code=400, detail=f"{key} must be true or false")
+    elif param_type == "choice":
+        value = value.lower()
+        if value not in choices:
+            raise HTTPException(
+                status_code=400,
+                detail=f"{key} must be one of: {', '.join(choices)}"
+            )
+    return value
+
+
+def _check_quality_provider_requirements(provider: Optional[str], env_path: Path) -> None:
+    """Refuse a provider whose required variables are not set."""
+    env_vars = _read_env_file_dict(env_path)
+    # Same precedence as load_dotenv(override=False) at startup: a variable present in
+    # the process environment wins over .env even when it is empty.
+    missing = [
+        key for key in QUALITY_PROVIDER_REQUIREMENTS.get(provider, ())
+        if not (os.environ[key] if key in os.environ else env_vars.get(key))
+    ]
+    if missing:
+        raise HTTPException(
+            status_code=400,
+            detail=f"The {provider} provider needs {', '.join(missing)} to be set first"
+        )
+
+
+@router.post("/quality", response_model=SaveCredentialsResponse)
+async def save_quality_settings(
+    request: SaveQualitySettingsRequest,
+    background_tasks: BackgroundTasks,
+    user=Depends(require_admin_access)
+):
+    """
+    Persist the Quality tab settings to .env and schedule a server restart.
+    Only keys in QUALITY_WRITABLE_KEYS are accepted. Requires admin access.
+    """
+    if not request.settings:
+        raise HTTPException(status_code=400, detail="No settings to save")
+
+    unknown = sorted(set(request.settings) - set(QUALITY_WRITABLE_KEYS))
+    if unknown:
+        raise HTTPException(status_code=400, detail=f"Unsupported setting: {', '.join(unknown)}")
+
+    values = {key: _normalize_quality_value(key, raw) for key, raw in request.settings.items()}
+
+    env_path = _find_env_path()
+    _check_quality_provider_requirements(values.get("MCP_QUALITY_AI_PROVIDER"), env_path)
+
+    try:
+        for key, value in values.items():
+            _write_credential_to_env(env_path, key, value)
+    except Exception as e:
+        logger.error("Failed to write quality settings to .env: %s", _sanitize_log_va
```

**File**: `src/mcp_memory_service/web/static/app.js` (modified, +101/-0)
```diff
@@ -4630,6 +4630,11 @@ class MemoryDashboard {
             this.loadCredentials();
         }
 
+        // Load the configured quality settings when switching to quality tab
+        if (tabName === 'quality') {
+            this.loadQualitySettings();
+        }
+
         // Load server status + auto-check for updates when switching to server tab
         // (runs once per modal open to avoid repeated git fetches)
         if (tabName === 'server') {
@@ -4734,6 +4739,11 @@ class MemoryDashboard {
         if (saveBtn) {
             saveBtn.addEventListener('click', () => this.saveCloudflareCredentials());
         }
+
+        // Quality tab Save & Restart button
+        document.getElementById('qualitySaveBtn')?.addEventListener('click', () => {
+            this.saveQualitySettings();
+        });
     }
 
     /**
@@ -4829,6 +4839,97 @@ class MemoryDashboard {
         el.style.display = 'block';
     }
 
+    /**
+     * Load the configured quality provider and boost flag into the Quality tab.
+     * Values come from GET /api/config/env, so the tab shows what the server runs with.
+     */
+    async loadQualitySettings() {
+        const resultEl = document.getElementById('qualitySaveResult');
+        if (resultEl) resultEl.style.display = 'none';
+
+        // Nothing can be edited or saved until the configured values are in,
+        // otherwise Save would write the HTML defaults over them
+        const providerSelect = document.getElementById('quality-provider');
+        const boostCheckbox = document.getElementById('quality-boost-enabled');
+        const saveBtn = document.getElementById('qualitySaveBtn');
+        [providerSelect, boostCheckbox, saveBtn].forEach(el => { if (el) el.disabled = true; });
+
+        try {
+            const config = await this.apiCall('/config/env');
+            const params = Object.fromEntries(
+                config.categories.flatMap(category => category.parameters).map(param => [param.key, param])
+            );
+            const provider = params.MCP_QUALITY_AI_PROVIDER;
+            const boost = params.MCP_QUALITY_BOOST_ENABLED;
+
+            const providerValue = (provider?.value || 'local').toLowerCase();
+            const option = Array.from(providerSelect?.options || []).find(opt => opt.value === providerValue);
+            if (providerSelect) {
+                // A provider the dropdown does not offer (e.g. openai-compatible) is left as it is on save
+                providerSelect.disabled = !option;
+                providerSelect.value = providerValue;
+            }
+
+            // Same spellings as safe_get_bool_env(); unset means off, the server default
+            if (boostCheckbox) {
+                boostCheckbox.checked = ['true', '1', 'yes', 'on', 'enabled']
+                    .includes((boost?.value || '').toLowerCase().trim());
+                boostCheckbox.disabled = false;
+            }
+            if (saveBtn) saveBtn.disabled = false;
+
+            const info = document.getElementById('current-provider-info');
+            if (info) info.textContent = option ? option.textContent : providerValue;
+        } catch (e) {
+            console.warn('Failed to load quality settings:', e);
+            this._showQualityResult('error', this.t(
+                'settings.quality.loadFailed',
+                '✗ Could not load the current settings: {error}. Reopen this tab to retry.',
+                { error: e.message }
+            ));
+        }
+    }
+
+    /**
+     * POST /api/config/quality — persist the Quality tab and restart.
+     */
+    async saveQualitySettings() {
+        const saveBtn = document.getElementById('qualitySaveBtn');
+        const providerSelect = document.getElementById('quality-provider');
+        const settings = {
+            MCP_QUALITY_BOOST_ENABLED: document.getElementById('quality-boost-enabled')?.checked ? 'true' : 'false',
+        };
+        if (providerSelect && !providerSelect.disabled) {
+            settings.MCP_QUALITY_AI_PROVIDER = providerSelect.value || 'local';
+        }
+
+        saveBtn.disabled = true;
+        saveBtn.textContent = this.t('settings.quality.saving', 'Saving…');
+
+        try {
+            await this.apiCall('/config/quality', 'POST', { settings });
+            this.closeModal(document.getElementById('settingsModal'));
+            this.showRestartOverlay();
+        } catch (e) {
+            this._showQualityResult('error', this.t(
+                'settings.quality.saveFailed',
+                '✗ Save failed: {error}',
+                { error: e.message }
+            ));
+        } finally {
+            saveBtn.disabled = false;
+            saveBtn.textContent = this.t('settings.quality.save', 'Save & Restart');
+        }
+    }
+
+    _showQualityResult(type, message) {
+        const el = document.getElementById('qualitySaveResult');
+        if (!el) return;
+        el.className = `cred-test-result cred-test-${type}`;
+        el
```

**File**: `src/mcp_memory_service/web/static/i18n/de.json` (modified, +5/-0)
```diff
@@ -326,13 +326,18 @@
   "settings.quality.boost.help": "Ordnet Suchergebnisse neu, um hochwertige Speicher zu priorisieren",
   "settings.quality.boost.label": "Qualitätsverbesserte Suche Aktivieren",
   "settings.quality.current.label": "Aktueller Anbieter:",
+  "settings.quality.loadFailed": "✗ Aktuelle Einstellungen konnten nicht geladen werden: {error}. Tab erneut öffnen, um es noch einmal zu versuchen.",
   "settings.quality.provider.auto": "Automatisch (Alle Verfügbaren)",
   "settings.quality.provider.gemini": "Gemini API",
   "settings.quality.provider.groq": "Groq API",
   "settings.quality.provider.help": "Lokales SLM bietet kostenlose, datenschutzwahrende Qualitätsbewertung",
   "settings.quality.provider.label": "KI-Anbieter",
   "settings.quality.provider.local": "Lokales SLM (Datenschutzmodus)",
   "settings.quality.provider.none": "Nur Implizit (Ohne KI)",
+  "settings.quality.save": "Speichern & Neustarten",
+  "settings.quality.saveFailed": "✗ Speichern fehlgeschlagen: {error}",
+  "settings.quality.saveHint": "Wird in .env gespeichert. Der Server startet neu, um die Änderung zu übernehmen.",
+  "settings.quality.saving": "Speichern…",
   "stats.tags": "Tags",
   "stats.thisWeek": "Diese Woche",
   "stats.total": "Erinnerungen gesamt",
```

**File**: `src/mcp_memory_service/web/static/i18n/en.json` (modified, +6/-1)
```diff
@@ -414,5 +414,10 @@
   "settings.quality.provider.help": "Local SLM provides zero-cost, privacy-preserving quality scoring",
   "settings.quality.boost.label": "Enable Quality-Boosted Search",
   "settings.quality.boost.help": "Rerank search results to prioritize high-quality memories",
-  "settings.quality.current.label": "Current Provider:"
+  "settings.quality.current.label": "Current Provider:",
+  "settings.quality.save": "Save & Restart",
+  "settings.quality.saving": "Saving…",
+  "settings.quality.saveFailed": "✗ Save failed: {error}",
+  "settings.quality.loadFailed": "✗ Could not load the current settings: {error}. Reopen this tab to retry.",
+  "settings.quality.saveHint": "Saved to .env. The server restarts to apply the change."
 }
```

**File**: `src/mcp_memory_service/web/static/i18n/es.json` (modified, +5/-0)
```diff
@@ -326,13 +326,18 @@
   "settings.quality.boost.help": "Reordena los resultados de búsqueda para priorizar memorias de alta calidad",
   "settings.quality.boost.label": "Habilitar Búsqueda con Mejora de Calidad",
   "settings.quality.current.label": "Proveedor Actual:",
+  "settings.quality.loadFailed": "✗ No se pudo cargar la configuración actual: {error}. Vuelve a abrir esta pestaña para reintentarlo.",
   "settings.quality.provider.auto": "Automático (Todos Disponibles)",
   "settings.quality.provider.gemini": "API Gemini",
   "settings.quality.provider.groq": "API Groq",
   "settings.quality.provider.help": "El SLM local proporciona puntuación de calidad sin costo y preservando la privacidad",
   "settings.quality.provider.label": "Proveedor de IA",
   "settings.quality.provider.local": "SLM Local (Modo Privacidad)",
   "settings.quality.provider.none": "Solo Implícito (Sin IA)",
+  "settings.quality.save": "Guardar y reiniciar",
+  "settings.quality.saveFailed": "✗ Error al guardar: {error}",
+  "settings.quality.saveHint": "Se guarda en .env. El servidor se reinicia para aplicar el cambio.",
+  "settings.quality.saving": "Guardando…",
   "stats.tags": "Etiquetas",
   "stats.thisWeek": "Esta Semana",
   "stats.total": "Total de Memorias",
```

**File**: `src/mcp_memory_service/web/static/i18n/fr.json` (modified, +5/-0)
```diff
@@ -326,13 +326,18 @@
   "settings.quality.boost.help": "Reclasse les résultats de recherche pour prioriser les mémoires de haute qualité",
   "settings.quality.boost.label": "Activer la Recherche Améliorée par Qualité",
   "settings.quality.current.label": "Fournisseur Actuel :",
+  "settings.quality.loadFailed": "✗ Impossible de charger les paramètres actuels : {error}. Rouvrez cet onglet pour réessayer.",
   "settings.quality.provider.auto": "Automatique (Tous Disponibles)",
   "settings.quality.provider.gemini": "API Gemini",
   "settings.quality.provider.groq": "API Groq",
   "settings.quality.provider.help": "Le SLM local offre une notation de qualité sans coût et préservant la confidentialité",
   "settings.quality.provider.label": "Fournisseur IA",
   "settings.quality.provider.local": "SLM Local (Mode Confidentialité)",
   "settings.quality.provider.none": "Implicite Uniquement (Sans IA)",
+  "settings.quality.save": "Enregistrer et redémarrer",
+  "settings.quality.saveFailed": "✗ Échec de l'enregistrement : {error}",
+  "settings.quality.saveHint": "Enregistré dans .env. Le serveur redémarre pour appliquer la modification.",
+  "settings.quality.saving": "Enregistrement…",
   "stats.tags": "Tags",
   "stats.thisWeek": "Cette Semaine",
   "stats.total": "Total des Mémoires",
```

**File**: `src/mcp_memory_service/web/static/i18n/ja.json` (modified, +5/-0)
```diff
@@ -326,13 +326,18 @@
   "settings.quality.boost.help": "検索結果を再ランク付けして高品質メモリを優先表示",
   "settings.quality.boost.label": "品質ブースト検索を有効化",
   "settings.quality.current.label": "現在のプロバイダー:",
+  "settings.quality.loadFailed": "✗ 現在の設定を読み込めませんでした: {error}。このタブを開き直して再試行してください。",
   "settings.quality.provider.auto": "自動 (利用可能なすべて)",
   "settings.quality.provider.gemini": "Gemini API",
   "settings.quality.provider.groq": "Groq API",
   "settings.quality.provider.help": "ローカルSLMはゼロコストでプライバシーを保護した品質スコアリングを提供",
   "settings.quality.provider.label": "AIプロバイダー",
   "settings.quality.provider.local": "ローカルSLM (プライバシーモード)",
   "settings.quality.provider.none": "暗黙のみ (AIなし)",
+  "settings.quality.save": "保存して再起動",
+  "settings.quality.saveFailed": "✗ 保存に失敗しました: {error}",
+  "settings.quality.saveHint": ".env に保存されます。変更を反映するためにサーバーが再起動します。",
+  "settings.quality.saving": "保存中…",
   "stats.tags": "タグ",
   "stats.thisWeek": "今週",
   "stats.total": "総メモリー数",
```

---

### Incident Patch 3: `c36145f5` (2026-10-25)
**Commit Message**: fix(ingestion): clear the five document loaders of unsanitised log calls (#1146) (#1677)

* fix(ingestion): clear the five document loaders of unsanitised log calls (#1146)

semtools_loader.py, json_loader.py, csv_loader.py, text_loader.py and
pdf_loader.py logged the caller-provided file path, the parser's error text,
the semtools stderr and the semtools binary location through f-strings.
Those go through _sanitize_log_value; the character count and the PDF
backend name become lazy %-style. The five modules join GUARDED_MODULES,
file_path joins EXTERNAL_NAMES, and a caplog test per loader forges the
path and the subprocess error without touching the disk.

* changelog: fragment for #1677

* test(ingestion): build the expected log path from str(forged_path), not a hardcoded '/'

On Windows Path renders the separator as a backslash, so the five tests
compared the escaped log line against 'docs/report...' and failed even
when the escaping was right (Greptile P2 on #1677).

---------

Co-authored-by: massimiliano1991 <[REDACTED_EMAIL]>

**File**: `changelog.d/1677.fixed.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+- **Document loaders logged caller-provided paths and parser errors unsanitised (#1146, #1677, massimiliano1991).**
+  `ingestion/semtools_loader.py`, `json_loader.py`, `csv_loader.py`, `text_loader.py` and
+  `pdf_loader.py` put the path of the file being ingested, the parser's error text and the
+  `semtools` stderr into the log through f-strings, so a newline in any of them forged a log
+  line. They go through `_sanitize_log_value` now; the five modules are in the guard's
+  `GUARDED_MODULES` list and a test per loader fails if the newline comes back.
```

**File**: `src/mcp_memory_service/ingestion/csv_loader.py` (modified, +4/-3)
```diff
@@ -25,6 +25,7 @@
 
 from .base import DocumentLoader, DocumentChunk
 from .chunker import TextChunker, ChunkingStrategy
+from ..compat import _sanitize_log_value
 
 logger = logging.getLogger(__name__)
 
@@ -105,7 +106,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
         max_rows_per_chunk = kwargs.get('max_rows_per_chunk', 50)
         include_row_numbers = kwargs.get('include_row_numbers', True)
 
-        logger.info(f"Extracting chunks from CSV file: {file_path}")
+        logger.info("Extracting chunks from CSV file: %s", _sanitize_log_value(file_path))
 
         try:
             # Read CSV data
@@ -114,7 +115,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
             )
 
             if not rows:
-                logger.warning(f"CSV file {file_path} appears to be empty")
+                logger.warning("CSV file %s appears to be empty", _sanitize_log_value(file_path))
                 return
 
             # Prepare headers
@@ -152,7 +153,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                 )
 
         except Exception as e:
-            logger.error(f"Error extracting from CSV file {file_path}: {type(e).__name__} - {str(e)}")
+            logger.error("Error extracting from CSV file %s: %s - %s", _sanitize_log_value(file_path), _sanitize_log_value(type(e).__name__), _sanitize_log_value(e))
             raise ValueError(f"Failed to extract CSV content: {str(e)}") from e
 
     async def _read_csv_file(
```

**File**: `src/mcp_memory_service/ingestion/json_loader.py` (modified, +4/-3)
```diff
@@ -24,6 +24,7 @@
 
 from .base import DocumentLoader, DocumentChunk
 from .chunker import TextChunker, ChunkingStrategy
+from ..compat import _sanitize_log_value
 
 logger = logging.getLogger(__name__)
 
@@ -100,7 +101,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
         include_types = kwargs.get('include_types', False)
         array_handling = kwargs.get('array_handling', 'expand')
 
-        logger.info(f"Extracting chunks from JSON file: {file_path}")
+        logger.info("Extracting chunks from JSON file: %s", _sanitize_log_value(file_path))
 
         try:
             # Read and parse JSON
@@ -140,10 +141,10 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                 )
 
         except json.JSONDecodeError as e:
-            logger.error(f"Invalid JSON in file {file_path}: {str(e)}")
+            logger.error("Invalid JSON in file %s: %s", _sanitize_log_value(file_path), _sanitize_log_value(e))
             raise ValueError(f"Invalid JSON format: {str(e)}") from e
         except Exception as e:
-            logger.error(f"Error extracting from JSON file {file_path}: {type(e).__name__} - {str(e)}")
+            logger.error("Error extracting from JSON file %s: %s - %s", _sanitize_log_value(file_path), _sanitize_log_value(type(e).__name__), _sanitize_log_value(e))
             raise ValueError(f"Failed to extract JSON content: {str(e)}") from e
 
     async def _read_json_file(self, file_path: Path) -> tuple:
```

**File**: `src/mcp_memory_service/ingestion/pdf_loader.py` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@
 
 from .base import DocumentLoader, DocumentChunk
 from .chunker import TextChunker, ChunkingStrategy
+from ..compat import _sanitize_log_value
 
 logger = logging.getLogger(__name__)
 
@@ -103,7 +104,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
         extract_tables = kwargs.get('extract_tables', False)
         page_range = kwargs.get('page_range', None)
 
-        logger.info(f"Extracting chunks from PDF: {file_path} using {self.backend}")
+        logger.info("Extracting chunks from PDF: %s using %s", _sanitize_log_value(file_path), self.backend)
 
         try:
             if self.backend == 'pdfplumber':
@@ -118,7 +119,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                     yield chunk
 
         except Exception as e:
-            logger.error(f"Error extracting from PDF {file_path}: {str(e)}")
+            logger.error("Error extracting from PDF %s: %s", _sanitize_log_value(file_path), _sanitize_log_value(e))
             raise ValueError(f"Failed to extract PDF content: {str(e)}") from e
 
     async def _extract_with_pdfplumber(
```

**File**: `src/mcp_memory_service/ingestion/semtools_loader.py` (modified, +9/-8)
```diff
@@ -28,6 +28,7 @@
 
 from .base import DocumentLoader, DocumentChunk
 from .chunker import TextChunker, ChunkingStrategy
+from ..compat import _sanitize_log_value
 
 logger = logging.getLogger(__name__)
 
@@ -80,7 +81,7 @@ def _check_semtools_availability(self) -> bool:
         """
         semtools_path = shutil.which('semtools')
         if semtools_path:
-            logger.info(f"Semtools found at: {semtools_path}")
+            logger.info("Semtools found at: %s", _sanitize_log_value(semtools_path))
             return True
         else:
             logger.debug(
@@ -128,7 +129,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                 "Semtools is not available. Install with: npm i -g @llamaindex/semtools"
             )
 
-        logger.info(f"Extracting chunks from {file_path} using semtools")
+        logger.info("Extracting chunks from %s using semtools", _sanitize_log_value(file_path))
 
         try:
             # Parse document to markdown using semtools
@@ -157,7 +158,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                 chunk_index += 1
 
         except Exception as e:
-            logger.error(f"Error processing {file_path} with semtools: {e}")
+            logger.error("Error processing %s with semtools: %s", _sanitize_log_value(file_path), _sanitize_log_value(e))
             raise ValueError(f"Failed to parse document: {str(e)}") from e
 
     async def _parse_with_semtools(self, file_path: Path) -> str:
@@ -198,24 +199,24 @@ async def _parse_with_semtools(self, file_path: Path) -> str:
 
             if process.returncode != 0:
                 error_msg = stderr.decode('utf-8', errors='replace')
-                logger.error(f"Semtools parsing failed: {error_msg}")
+                logger.error("Semtools parsing failed: %s", _sanitize_log_value(error_msg))
                 raise RuntimeError(f"Semtools returned error: {error_msg}")
 
             # Parse markdown output
             markdown_content = stdout.decode('utf-8', errors='replace')
 
             if not markdown_content.strip():
-                logger.warning(f"Semtools returned empty content for {file_path}")
+                logger.warning("Semtools returned empty content for %s", _sanitize_log_value(file_path))
                 raise RuntimeError("Semtools returned empty content")
 
-            logger.debug(f"Successfully parsed {file_path}, extracted {len(markdown_content)} characters")
+            logger.debug("Successfully parsed %s, extracted %d characters", _sanitize_log_value(file_path), len(markdown_content))
             return markdown_content
 
         except asyncio.TimeoutError:
-            logger.error(f"Semtools parsing timed out for {file_path}")
+            logger.error("Semtools parsing timed out for %s", _sanitize_log_value(file_path))
             raise RuntimeError("Document parsing timed out after 5 minutes")
         except Exception as e:
-            logger.error(f"Error running semtools: {e}")
+            logger.error("Error running semtools: %s", _sanitize_log_value(e))
             raise
 
 
```

**File**: `src/mcp_memory_service/ingestion/text_loader.py` (modified, +3/-2)
```diff
@@ -25,6 +25,7 @@
 
 from .base import DocumentLoader, DocumentChunk
 from .chunker import TextChunker, ChunkingStrategy
+from ..compat import _sanitize_log_value
 
 logger = logging.getLogger(__name__)
 
@@ -103,7 +104,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
         preserve_structure = kwargs.get('preserve_structure', True)
         extract_links = kwargs.get('extract_links', False)
         
-        logger.info(f"Extracting chunks from text file: {file_path}")
+        logger.info("Extracting chunks from text file: %s", _sanitize_log_value(file_path))
         
         try:
             # Read file content
@@ -125,7 +126,7 @@ async def extract_chunks(self, file_path: Path, **kwargs) -> AsyncGenerator[Docu
                     yield chunk
                     
         except Exception as e:
-            logger.error(f"Error extracting from text file {file_path}: {str(e)}")
+            logger.error("Error extracting from text file %s: %s", _sanitize_log_value(file_path), _sanitize_log_value(e))
             raise ValueError(f"Failed to extract text content: {str(e)}") from e
     
     async def _read_file_content(self, file_path: Path, encoding: Optional[str]) -> tuple:
```

**File**: `tests/unit/test_ingestion_loaders_logging.py` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+"""
+Log-injection tests for the ingestion/ document loaders (#1146).
+
+Each loader logs the path of the document it is asked to read when it starts
+and again, with the parser's error text, when it fails; the semtools loader
+also logs where the ``semtools`` binary was found and what it wrote to stderr.
+A newline in any of those must not reach the log as a line break.
+
+Nothing is written to disk and ``semtools`` is not run: ``validate_file`` and
+the per-loader read step are stubbed, and the subprocess is a fake whose
+``communicate`` returns a forged stderr.
+"""
+
+import asyncio
+import logging
+import shutil
+from pathlib import Path
+
+import pytest
+
+from mcp_memory_service.ingestion import pdf_loader as pdf_module
+from mcp_memory_service.ingestion.csv_loader import CSVLoader
+from mcp_memory_service.ingestion.json_loader import JSONLoader
+from mcp_memory_service.ingestion.pdf_loader import PDFLoader
+from mcp_memory_service.ingestion.semtools_loader import SemtoolsLoader
+from mcp_memory_service.ingestion.text_loader import TextLoader
+
+FORGED = "FORGED ingestion verified"
+LOGGERS = "mcp_memory_service.ingestion"
+
+
+def _messages(caplog):
+    return [record.getMessage() for record in caplog.records]
+
+
+def _assert_clean(caplog, *expected):
+    messages = _messages(caplog)
+    for text in expected:
+        assert any(text in m for m in messages), (text, messages)
+    assert not any(f"\n{FORGED}" in m for m in messages), messages
+
+
+async def _no_validation(_file_path):
+    return None
+
+
+async def _failing_read(*_args, **_kwargs):
+    raise ValueError(f"parser said\n{FORGED}")
+
+
+async def _drain(loader, file_path):
+    with pytest.raises(ValueError):
+        async for _chunk in loader.extract_chunks(file_path):
+            pass
+
+
+@pytest.fixture
+def forged_path():
+    return Path("docs", f"report\n{FORGED}.ext")
+
+
+def _shown(path):
+    """The path as the sanitised log line shows it: the OS separator, the newline escaped."""
+    return str(path).replace("\n", "\\n")
+
+
+@pytest.mark.asyncio
+async def test_json_loader_logs_do_not_carry_newlines(monkeypatch, caplog, forged_path):
+    loader = JSONLoader()
+    monkeypatch.setattr(loader, "validate_file", _no_validation)
+    monkeypatch.setattr(loader, "_read_json_file", _failing_read)
+
+    with caplog.at_level(logging.INFO, logger=LOGGERS):
+        await _drain(loader, forged_path)
+
+    _assert_clean(
+        caplog,
+        f"Extracting chunks from JSON file: {_shown(forged_path)}",
+        f"Error extracting from JSON file {_shown(forged_path)}: ValueError - parser said\\n{FORGED}",
+    )
+
+
+@pytest.mark.asyncio
+async def test_csv_loader_logs_do_not_carry_newlines(monkeypatch, caplog, forged_path):
+    loader = CSVLoader()
+    monkeypatch.setattr(loader, "validate_file", _no_validation)
+    monkeypatch.setattr(loader, "_read_csv_file", _failing_read)
+
+    with caplog.at_level(logging.INFO, logger=LOGGERS):
+        await _drain(loader, forged_path)
+
+    _assert_clean(
+        caplog,
+        f"Extracting chunks from CSV file: {_shown(forged_path)}",
+        f"Error extracting from CSV file {_shown(forged_path)}: ValueError - parser said\\n{FORGED}",
+    )
+
+
+@pytest.mark.asyncio
+async def test_text_loader_logs_do_not_carry_newlines(monkeypatch, caplog, forged_path):
+    loader = TextLoader()
+    monkeypatch.setattr(loader, "validate_file", _no_validation)
+    monkeypatch.setattr(loader, "_read_file_content", _failing_read)
+
+    with caplog.at_level(logging.INFO, logger=LOGGERS):
+        await _drain(loader, forged_path)
+
+    _assert_clean(
+        caplog,
+        f"Extracting chunks from text file: {_shown(forged_path)}",
+        f"Error extracting from text file {_shown(forged_path)}: parser said\\n{FORGED}",
+    )
+
+
+@pytest.mark.asyncio
+async def test_pdf_loader_logs_do_not_carry_newlines(monkeypatch, caplog, forged_path):
+    # Pin the backend so the test does not depend on which PDF library is installed.
+    monkeypatch.setattr(pdf_module, "HAS_PDFPLUMBER", True)
+    loader = PDFLoader()
+
+    async def _failing_pages(*_args, **_kwargs):
+        raise ValueError(f"parser said\n{FORGED}")
+        yield  # pragma: no cover - makes this an async generator
+
+    monkeypatch.setattr(loader, "validate_file", _no_validation)
+    monkeypatch.setattr(loader, "_extract_with_pdfplumber", _failing_pages)
+
+    with caplog.at_level(logging.INFO, logger=LOGGERS):
+        await _drain(loader, forged_path)
+
+    _assert_clean(
+        caplog,
+        f"Extracting chunks from PDF: {_shown(forged_path)} using pdfplumber",
+        f"Error extracting from PDF {_shown(forged_path)}: parser said\\n{FORGED}",
+    )
+
+
+class _FailingProcess:
+    returncode = 1
+
+    async def communicate(self):
+        return b"", f"semtools said\n{FORGED}".encode()
+
+
+@pytest.mark.asyncio
+async def test_semtools_loader_logs_do_not_carry_newlines(monkeypatch, ca
```

**File**: `tests/unit/test_log_injection_guard.py` (modified, +26/-0)
```diff
@@ -84,6 +84,11 @@
     "mcp_memory_service/config/search.py",
     "mcp_memory_service/config/quality.py",
     "mcp_memory_service/config/backup.py",
+    "mcp_memory_service/ingestion/semtools_loader.py",
+    "mcp_memory_service/ingestion/json_loader.py",
+    "mcp_memory_service/ingestion/csv_loader.py",
+    "mcp_memory_service/ingestion/text_loader.py",
+    "mcp_memory_service/ingestion/pdf_loader.py",
 ]
 
 # The levels check 6.5 looks at, verbatim.
@@ -178,6 +183,11 @@
     "MCP_HYBRID_FUSION_METHOD",
     "MCP_QUALITY_AI_PROVIDER",
     "BACKUP_INTERVAL",
+    # The document a caller asks the ingestion/ loaders to read: every loader
+    # logs it when it starts and when the parser fails. No guarded module logs
+    # the name bare in a %-style call, so listing it decides for nobody else.
+    # `error_msg` above already covers the stderr of the semtools subprocess.
+    "file_path",
 })
 
 # Fields of an outside object that cannot carry injectable text. An HTTP status
@@ -584,3 +594,19 @@ def test_lazy_scan_flags_config_environment_strings():
         assert _lazy_findings(bare)
         assert not _lazy_findings(wrapped)
     assert not _lazy_findings('logger.info("Backup configuration: retention=%s days", BACKUP_RETENTION)\n')
+
+
+@pytest.mark.unit
+def test_lazy_scan_flags_ingestion_file_path():
+    """The path the ingestion/ loaders are handed, logged at start and on failure.
+
+    Every guarded logger call in the five loaders already wraps it, so the module
+    scans stay green whether or not the name is listed. This is the sample that
+    fails if `file_path` is dropped from EXTERNAL_NAMES; the character count and
+    the PDF backend name logged next to it stay unlisted on purpose.
+    """
+    bare = 'logger.info("Extracting chunks from JSON file: %s", file_path)\n'
+    wrapped = 'logger.info("Extracting chunks from JSON file: %s", _sanitize_log_value(file_path))\n'
+    assert _lazy_findings(bare)
+    assert not _lazy_findings(wrapped)
+    assert not _lazy_findings('logger.debug("Successfully parsed %s, extracted %d characters", _sanitize_log_value(file_path), len(markdown_content))\n')
```

#### Recent Merged Pull Requests:
- **PR #1691** (2026-10-26): chore(release): v12.4.0 (@doobidoo)
- **PR #1690** (2026-10-26): fix(oauth): confine per-store grants to calls that stay in the store (@doobidoo)
- **PR #1689** (2026-10-26): chore(deps): bump pypdf from 6.21.1 to 6.21.2 (@dependabot[bot])
- **PR #1688** (2026-10-26): chore(deps-dev): bump the npm_and_yarn group across 2 directories with 1 update (@dependabot[bot])
- **PR #1687** (2026-10-26): ci: count .github/CODEOWNERS as a docs-only change (@doobidoo)
- **PR #1686** (2026-10-26): chore(codeowners): restore henry201605 on the Milvus graph backend (@doobidoo)

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

## X. oauth): confine per-store grants to calls that stay in the store (#1690)

**RULE**:
When implementing operations in `changelog.d/1690.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb7c041e`: oauth): confine per-store grants to calls that stay in the store (#1690). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1690.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Per-store scopes no longer reach outside their store (#1690).** A `read:<store>` /
  `write:<store>` grant authorized any MCP tool call that named the store, including tools
  that ignore `store` (`memory_quality`, `memory_cleanup`, `memory_resolve`,
  `memory_consolidate`, the mistake-note tools) and `memory_search` with `include_beliefs` or
  `fallback`, which read every partition. A per-store grant now covers only the tools that
  confine themselves to the store (`memory_store`, `memory_store_session`, `memory_search`,
  `memory_list`, `memory_delete`, `memory_update`) and only without those two arguments;
  everything else needs the global scope, including `memory_explore` and `memory_detail`,
  whose entity names come from a graph that has no store partition. The SDK
  transports and the `/mcp` shim share one rule. Store-restricted credentials are also
  refused, over MCP and REST, on backends whose `get_by_hash` ignores `store` (cloudflare,
  milvus, remote_http), where `GET /api/memories/{hash}` returned another store's memory.
  They work on sqlite_vec and hybrid until the storage layer enforces `store` (#1683).
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb7c041e` are properly handled with clean fallback behavior.
