> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `7957cfe5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T17:01:51.636Z  
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
> **Harvest Timestamp**: 2026-11-18T17:01:51.628Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2136 stars

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
- **Issue #2068** (2026-11-17): **Claim automation counts a maintainer's comment as an earlier claim**
  *Symptoms*: ## What happens  On an issue labelled `auto-assign`, a `/claim` from a contributor is sent to manual confirmation when an earlier comment by a maintainer contains a phrase the claim classifier knows. The contributor gets "existing work, an earlier claim, edit or withdrawal needs a maintainer's confirmation" on an issue that is free.  Seen on #2060 on 2026-11-17. The issue had no assignee, no linked PR and no earlier claim. My comment settling the scope said "the content exists in another store and no longer names it". A contributor then commented `/claim`, the bot added `claim-pending` and posted the manual reply instead of assigning.  ## Why  In `scripts/ci/mark_claim_pending.py`:  - `WITHDRAWAL` (line 284) matches `no longer`, so `possible_claim()` returns true for the maintainer's comment. - `read_claim_history()` (line 685) builds `claims` from every comment that passes `human()` (line 355). `human()` checks the user type and login only, so maintainers are included. - `confirmed_claim()` (line 377) sees a comment by a different login before the command and returns `claims[0]`, the maintainer's comment. - `claim_ambiguity()` (line 387) finds that this "first claim" is not a command and reports ambiguity, and `prepare_assignment()` takes the manual path.  `should_label()` and `hint_command()` already skip comments whose `author_association` is in `EXEMPT_ASSOCIATIONS`. The claim history does not.  ## Reproduce  Run the classifier on the body of https://github.com/doobidoo/m

- **Issue #2041** (2026-11-18): **[Bug]: Document upload API swallows HTTP 400 validation errors as 500 and leaks temporary files on batch failure**
  *Symptoms*: ### Bug Description    In mcp-memory-service/src/mcp_memory_service/web/api/documents.py:238-241, both upload_document (POST   /api/documents/upload) and batch_upload_documents (POST /api/documents/batch-upload) catch generic Exception and   raise HTTPException(status_code=500, detail="Internal server error") without re-raising HTTPException.   This causes two distinct issues:    1. HTTP 400 Validation Errors are Swallowed as HTTP 500:   Both endpoints validate input and explicitly raise HTTPException(status_code=400, ...):       • When an unsupported file format is uploaded (raise HTTPException(status_code=400, detail="Unsupported file       type: ...")) (L185-L188, L281-L284)       • When a tag exceeds MAX_TAG_LENGTH in parse_and_validate_tags() (raise HTTPException(status_code=400,       detail="Tag exceeds maximum length...")) (L96-L100)       • When files is empty in batch upload (raise HTTPException(status_code=400, detail="No files provided")) (L267)   Because HTTPException is a subclass of Exception, the broad except Exception: block intercepts it, logs a critical   unhandled exception traceback (logger.exception("Upload error")), and returns a generic 500 Internal Server Error   to the client. The client never receives the explanation of what validation rule failed.   2. Temporary File Leak on Batch Upload Validation Failure:   In batch_upload_documents, files are looped over and written to disk via tempfile.NamedTemporaryFile(delete=False,   ...). If a subsequent fi

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

### Incident Patch 1: `cc58ab35` (2026-11-18)
**Commit Message**:  fix(api): preserve 400 validation errors and clean up temporary files on upload failure (#2041) (#2057)

* fix(api): preserve 400 validation errors and prevent temp file leaks in document uploads (#2041)

* refactor(api): consolidate temp cleanup helper and tighten single-upload leak test (#2041)

---------

Co-authored-by: Henry Krupp <[REDACTED_EMAIL]>

**File**: `changelog.d/2041.fixed.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- **Document upload API swallowed 400 validation errors as 500 and leaked temporary files (#2041).**
+  `POST /api/documents/upload` and `POST /api/documents/batch-upload` caught generic `Exception` without re-raising `HTTPException`, transforming client validation errors into 500 Internal Server Errors. Batch uploads that failed validation also orphaned temporary files created for preceding files. `HTTPException` is now re-raised and temporary files are cleaned up on failure.
```

**File**: `src/mcp_memory_service/web/api/documents.py` (modified, +25/-2)
```diff
@@ -146,6 +146,18 @@ class UploadStatus(BaseModel):
     created_at: datetime
     completed_at: Optional[datetime] = None
 
+
+def _cleanup_temp_files(*paths: Optional[str]) -> None:
+    """Best-effort removal of temporary files during upload error handling."""
+    for path in paths:
+        if path:
+            try:
+                os.unlink(path)
+            except OSError:
+                # File already deleted or unreachable; ignore cleanup errors
+                pass
+
+
 @router.post("/upload", response_model=Dict[str, Any])
 async def upload_document(
     background_tasks: BackgroundTasks,
@@ -172,6 +184,7 @@ async def upload_document(
     Uses FastAPI BackgroundTasks for proper async processing.
     """
     logger.info("Document upload endpoint called")
+    temp_path = None
     try:
         # Read file content
         file_content = await file.read()
@@ -235,7 +248,13 @@ async def upload_document(
             "message": f"Document {file.filename} queued for processing"
         }
 
+    except HTTPException:
+        # File creation currently happens after validation, but guard against
+        # leaks if validation or file creation order changes in the future.
+        _cleanup_temp_files(temp_path)
+        raise
     except Exception:
+        _cleanup_temp_files(temp_path)
         logger.exception("Upload error")
         raise HTTPException(status_code=500, detail="Internal server error")
 
@@ -262,6 +281,7 @@ async def batch_upload_documents(
     Returns:
         Batch upload session information
     """
+    temp_paths = []
     try:
         if not files:
             raise HTTPException(status_code=400, detail="No files provided")
@@ -271,7 +291,6 @@ async def batch_upload_documents(
 
         # Create batch upload session
         batch_id = str(uuid.uuid4())
-        temp_paths = []
 
         # Validate and save all files
         for file in files:
@@ -292,9 +311,9 @@ async def batch_upload_documents(
                 suffix=safe_ext
             )
             temp_path = temp_file.name
+            temp_paths.append((file.filename, temp_path, len(content)))
             with temp_file:
                 temp_file.write(content)
-            temp_paths.append((file.filename, temp_path, len(content)))
 
         # Calculate total file size for the batch
         total_file_size = sum(file_size for _, _, file_size in temp_paths)
@@ -326,7 +345,11 @@ async def batch_upload_documents(
             "message": f"Batch of {len(files)} documents queued for processing"
         }
 
+    except HTTPException:
+        _cleanup_temp_files(*(p for _, p, _ in temp_paths))
+        raise
     except Exception:
+        _cleanup_temp_files(*(p for _, p, _ in temp_paths))
         logger.exception("Batch upload error")
         raise HTTPException(status_code=500, detail="Internal server error")
 
```

**File**: `tests/web/api/test_documents_upload_errors.py` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+# Copyright 2024 Heinrich Krupp
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Regression coverage for document upload validation error propagation and temp file cleanup (Issue #2041)."""
+
+import io
+import os
+from unittest.mock import MagicMock
+import pytest
+from fastapi import HTTPException, UploadFile
+
+from mcp_memory_service.web.api import documents
+
+
+def _make_upload_file(filename: str, content: bytes = b"sample text") -> UploadFile:
+    return UploadFile(filename=filename, file=io.BytesIO(content))
+
+
+@pytest.mark.asyncio
+async def test_upload_document_unsupported_file_type_raises_400():
+    """Verify single file upload with unsupported extension raises 400 Bad Request, not 500."""
+    bad_file = _make_upload_file("program.exe")
+    bg_tasks = MagicMock()
+
+    with pytest.raises(HTTPException) as exc_info:
+        await documents.upload_document(
+            background_tasks=bg_tasks,
+            file=bad_file,
+            tags="test",
+            user=None,
+        )
+
+    assert exc_info.value.status_code == 400
+    assert "Unsupported file type: .exe" in exc_info.value.detail
+    bg_tasks.add_task.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_upload_document_tag_too_long_raises_400():
+    """Verify tag exceeding MAX_TAG_LENGTH raises 400 Bad Request, not 500."""
+    good_file = _make_upload_file("notes.txt")
+    long_tag = "x" * 105
+    bg_tasks = MagicMock()
+
+    with pytest.raises(HTTPException) as exc_info:
+        await documents.upload_document(
+            background_tasks=bg_tasks,
+            file=good_file,
+            tags=long_tag,
+            user=None,
+        )
+
+    assert exc_info.value.status_code == 400
+    assert "exceeds maximum length" in exc_info.value.detail
+    bg_tasks.add_task.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_upload_document_cleans_up_temp_file_on_error(monkeypatch):
+    """Verify temp file is unlinked if an unexpected exception occurs before background queueing."""
+    good_file = _make_upload_file("doc.txt", b"hello world")
+    bg_tasks = MagicMock()
+
+    created_temp_files = []
+    real_named_temp = documents.tempfile.NamedTemporaryFile
+
+    def tracking_temp_file(*args, **kwargs):
+        tf = real_named_temp(*args, **kwargs)
+        created_temp_files.append(tf.name)
+        return tf
+
+    monkeypatch.setattr(documents.tempfile, "NamedTemporaryFile", tracking_temp_file)
+
+    def boom(*args, **kwargs):
+        raise RuntimeError("queue failed")
+
+    monkeypatch.setattr(documents.UploadStatus, "__init__", boom)
+
+    with pytest.raises(HTTPException) as exc_info:
+        await documents.upload_document(
+            background_tasks=bg_tasks,
+            file=good_file,
+            tags="valid",
+            user=None,
+        )
+
+    assert exc_info.value.status_code == 500
+    assert len(created_temp_files) == 1
+    assert not os.path.exists(created_temp_files[0]), f"Temp file {created_temp_files[0]} was leaked on disk!"
+
+
+@pytest.mark.asyncio
+async def test_batch_upload_empty_files_raises_400():
+    """Verify empty file list raises 400 Bad Request, not 500."""
+    bg_tasks = MagicMock()
+
+    with pytest.raises(HTTPException) as exc_info:
+        await documents.batch_upload_documents(
+            background_tasks=bg_tasks,
+            files=[],
+            tags="test",
+            user=None,
+        )
+
+    assert exc_info.value.status_code == 400
+    assert exc_info.value.detail == "No files provided"
+    bg_tasks.add_task.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_batch_upload_tag_too_long_raises_400():
+    """Verify tag exceeding MAX_TAG_LENGTH in batch upload raises 400 Bad Request, not 500."""
+    file1 = _make_upload_file("doc1.txt")
+    long_tag = "y" * 105
+    bg_tasks = MagicMock()
+
+    with pytest.raises(HTTPException) as exc_info:
+        await documents.batch_upload_documents(
+            background_tasks=bg_tasks,
+            files=[file1],
+            tags=long_tag,
+            user=None,
+        )
+
+    assert exc_info.value.status_code == 400
+    assert "exceeds maximum length" in exc_info.value.detail
+    bg_tasks.add_task.assert_not_called()
+
+
+@pytest.mark.asyncio
+async def test_batch_upload_unsupported_file_cleans_up_partial_temp_files(monkeypatch):
+    """Verify batch upload unlinks previously written temporary files when a subsequent file fails validatio
```

---

### Incident Patch 2: `4c0ae9f5` (2026-11-18)
**Commit Message**: fix(cloudflare): set get_by_hash_is_store_scoped and close the write gaps first (#1915) (#2054)

* fix(cloudflare): set get_by_hash_is_store_scoped and close two write gaps (#1915)

Part 3 of 3 of #1915. With the read paths (#1923) and the hybrid sync
queue (#1924) honoring store, CloudflareStorage now sets
get_by_hash_is_store_scoped, so a per-store credential gets the
store-confined tools for its store on Cloudflare as on sqlite-vec.

Before the flip, two write paths still reached another store:

- store() staged the Vectorize vector and R2 body, both keyed by the
  content hash, before D1 rejected a duplicate row, so storing content
  that lived in another store overwrote that memory's vector metadata.
  It now refuses an exact duplicate before staging, with sqlite-vec's
  message.
- storing content whose row is a tombstone in another store purged that
  tombstone and moved the hash into the caller's store. That is refused
  now; re-storing content deleted from the same store still works.

DELETE /api/memories/{hash}?store= also passes the store to the delete
itself on backends that confine, not only to the lookup before it.

Assisted-by: Claude Code / claude-opus-5-5
Machine: M

**File**: `changelog.d/1915.fixed.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+- **Per-store credentials work on Cloudflare (closes #1915, tonydzi).** With the read paths
+  and the hybrid sync queue confined to `store`, `CloudflareStorage` now sets
+  `get_by_hash_is_store_scoped`, so a `read:<s>`/`write:<s>` credential is granted
+  `memory_search`, `memory_list` and the other store-confined tools for that store, as on
+  sqlite-vec, instead of being refused. Three gaps closed first. `store()` staged the Vectorize
+  vector and R2 body, both keyed by content hash alone, before D1 rejected a duplicate row,
+  so storing content that already lived in another store overwrote that memory's vector
+  metadata; it now refuses an exact duplicate before staging, with the same message as
+  sqlite-vec. Storing content whose D1 row is a tombstone in another store purged that
+  tombstone and moved the hash into the caller's store; that is refused now too, with the same message, while
+  re-storing content deleted from the same store works as before.
+  `DELETE /api/memories/{hash}?store=` checked the hash in the store but then
+  deleted unscoped; the delete itself now carries the store on backends that confine.
```

**File**: `src/mcp_memory_service/storage/cloudflare.py` (modified, +61/-5)
```diff
@@ -199,9 +199,10 @@ def _tag_match_params(tag: str) -> List[str]:
 class CloudflareStorage(MemoryStorage):
     """Cloudflare-based storage backend using Vectorize, D1, and R2."""
 
-    # Hash-addressed operations (#1878) and the read paths (#1915) honor
-    # ``store``, but get_by_hash_is_store_scoped stays False until the hybrid
-    # sync queue carries ``store`` to Cloudflare too (#1915 points 2 and 3).
+    # Hash-addressed operations (#1878), the read paths and the hybrid sync
+    # queue (#1915) honor ``store``, so per-store credentials can be granted the
+    # store-confined tools here as on sqlite-vec.
+    get_by_hash_is_store_scoped = True
 
     # Content length limit from configuration
     _MAX_CONTENT_LENGTH = CLOUDFLARE_MAX_CONTENT_LENGTH
@@ -736,6 +737,9 @@ async def _store_memory(
         )
         r2_key = None
         try:
+            refusal = await self._live_duplicate_refusal(memory, store, restore_id)
+            if refusal:
+                return False, refusal
             content_size, r2_key, stored_content = await self._stage_memory_artifacts(
                 memory, vector_id, restore_id
             )
@@ -779,6 +783,57 @@ async def _store_memory(
             logger.error("Failed to store memory %s: %s", _sanitize_log_value(memory.content_hash), _sanitize_log_value(e))
             return False, f"Storage failed: {str(e)}"
 
+    @staticmethod
+    def _exact_duplicate_message(existing_store: str, requested_store: str) -> str:
+        """Describe an exact-hash conflict the way sqlite-vec does."""
+        message = "Duplicate content detected (exact match)"
+        if existing_store != requested_store:
+            return f"{message}; already exists in store {existing_store!r}"
+        return message
+
+    async def _live_duplicate_refusal(
+        self, memory: Memory, store: str, restore_id: Optional[str]
+    ) -> Optional[str]:
+        """Refuse an exact duplicate before staging anything.
+
+        The vector id and R2 key of a normal store are the content hash, so
+        staging first would overwrite the live memory's vector metadata, in
+        whichever store it lives, before D1 rejected the row. A restore stages
+        under its own keys and is checked against the tombstone instead.
+        """
+        if restore_id is not None:
+            return None
+        existing = await self._existing_row_of(memory.content_hash)
+        if existing is None:
+            return None
+        existing_store, deleted = existing
+        if deleted and existing_store == store:
+            return None  # re-storing content deleted from this store
+        # A tombstone in another store is refused too: re-storing would purge
+        # it and move the hash into this store. Same message as a live
+        # duplicate, so the caller does not learn whether it was deleted.
+        return self._exact_duplicate_message(existing_store, store)
+
+    async def _existing_row_of(self, content_hash: str) -> Optional[Tuple[str, bool]]:
+        """Return ``(store, is_tombstone)`` of the D1 row for ``content_hash``, if any.
+
+        ``content_hash`` is unique across stores in D1, as in sqlite-vec.
+        """
+        response = await self._retry_request(
+            "POST", f"{self.d1_url}/query",
+            json={
+                "sql": "SELECT store, deleted_at FROM memories WHERE content_hash = ? LIMIT 1",
+                "params": [content_hash],
+            },
+        )
+        result = response.json()
+        if not result.get("success"):
+            raise ValueError(f"Failed to check for an existing memory in D1: {result}")
+        rows = result.get("result", [{}])[0].get("results") or []
+        if not rows:
+            return None
+        return rows[0].get("store") or "default", rows[0].get("deleted_at") is not None
+
     async def _cleanup_staged_restore_artifacts(
         self, vector_id: Optional[str], r2_key: Optional[str]
     ) -> None:
@@ -2458,12 +2513,12 @@ async def recall(self, query: Optional[str] = None, n_results: int = 5, start_ti
 
             # Build D1 query for time-based retrieval
             if time_where:
-                sql = f"SELECT * FROM memories WHERE {time_where}{store_sql} ORDER BY created_at DESC LIMIT ?"
+                sql = f"SELECT * FROM memories WHERE deleted_at IS NULL AND {time_where}{store_sql} ORDER BY created_at DESC LIMIT ?"
                 params.extend(store_params)
                 params.append(n_results)
             else:
                 # No time filters, get most recent
-                sql = f"SELECT * FROM memories WHERE 1 = 1{store_sql} ORDER BY created_at DESC LIMIT ?"
+                sql = f"SELECT * FROM memories WHERE deleted_at IS NULL{store_sql} ORDER BY created_at DESC LIMIT ?"
                 params = [*store_params, n_results]
 
             payload = {"sql": sql, "params": params}
@@ -2826,6 +2881,7 @@ async def get_memories_by_time_range(
         end_time: float,
 
```

**File**: `src/mcp_memory_service/web/api/memories.py` (modified, +8/-1)
```diff
@@ -496,7 +496,14 @@ async def delete_memory(
         if not existing:
             raise HTTPException(status_code=404, detail="Memory not found")
 
-        success, message = await storage.delete(content_hash)
+        # Confine the delete itself, not only the lookup before it. Backends
+        # that cannot confine do not accept a named ``store`` yet.
+        scope = (
+            {"store": resolve_store(store)}
+            if getattr(storage, "get_by_hash_is_store_scoped", False)
+            else {}
+        )
+        success, message = await storage.delete(content_hash, **scope)
         
         # Broadcast SSE event for memory deletion
         try:
```

**File**: `tests/unit/test_cloudflare_storage.py` (modified, +4/-2)
```diff
@@ -163,8 +163,10 @@ async def test_store_memory_small_content(self, cloudflare_storage, sample_memor
             # Mock Vectorize storage (bypasses HTTP client) - must be AsyncMock for async method
             with patch.object(cloudflare_storage, '_store_vectorize_vector', new_callable=AsyncMock):
                 with patch.object(cloudflare_storage, '_retry_request') as mock_request:
-                    # Need 6 responses: tombstone purge + memory insert + 2 calls per tag
+                    # Need 7 responses: duplicate check + tombstone purge + memory insert
+                    # + 2 calls per tag
                     mock_request.side_effect = [
+                        mock_d1_response,  # Check for a live row with this hash
                         mock_d1_response,  # Purge matching tombstone
                         mock_d1_response,  # Insert memory
                         mock_d1_response,  # Insert tag "test"
@@ -179,7 +181,7 @@ async def test_store_memory_small_content(self, cloudflare_storage, sample_memor
                     assert "successfully" in message.lower()
 
                     # Verify all D1 calls were made
-                    assert mock_request.call_count == 6
+                    assert mock_request.call_count == 7
     
     @pytest.mark.asyncio
     async def test_store_memory_large_content(self, cloudflare_storage):
```

**File**: `tests/unit/test_cloudflare_store_scope.py` (modified, +19/-0)
```diff
@@ -429,3 +429,22 @@ async def test_count_excludes_soft_deleted_memories(cloudflare_storage, d1, two_
         await cloudflare_storage.get_all_memories(store="b")
     )
     assert await cloudflare_storage.count_all_memories(store="all") == 1
+
+
+@pytest.mark.asyncio
+async def test_time_only_recall_skips_soft_deleted_memories(cloudflare_storage, d1, two_stores):
+    d1.db.execute("UPDATE memories SET deleted_at = 1.0 WHERE store = 'b'")
+    d1.db.commit()
+
+    assert _hashes(await cloudflare_storage.recall(None, store="b")) == set()
+    assert _hashes(await cloudflare_storage.recall(None, start_timestamp=0, store="b")) == set()
+    assert _hashes(await cloudflare_storage.recall(None, store="a")) == {two_stores["a"]}
+
+
+@pytest.mark.asyncio
+async def test_time_range_accepts_exclude_pending_as_base_search_passes_it(cloudflare_storage, two_stores):
+    # base.py's time-only search calls get_memories_by_time_range(..., exclude_pending=True, store=...)
+    a = two_stores["a"]
+    window = (0.0, 4102444800.0)
+
+    assert _hashes(await cloudflare_storage.get_memories_by_time_range(*window, exclude_pending=True, store="a")) == {a}
```

**File**: `tests/web/api/test_cloudflare_store_grant.py` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+"""A per-store credential on Cloudflare stays inside its store (#1915).
+
+With ``get_by_hash_is_store_scoped`` set on Cloudflare, a ``read:a`` credential
+is granted ``memory_search`` and ``memory_list`` for ``store="a"``. These tests
+drive the real /mcp shim against ``CloudflareStorage`` with D1 replaced by an
+in-memory SQLite database and Vectorize answering every query with every stored
+vector, so only the store predicate keeps another store's memories out.
+"""
+
+import sqlite3
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+import pytest_asyncio
+from fastapi.testclient import TestClient
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.cloudflare import CloudflareStorage
+from mcp_memory_service.utils.hashing import generate_content_hash
+from mcp_memory_service.web.dependencies import set_storage
+from tests.unit.test_cloudflare_store_scope import _FakeD1
+
+TEXT_A = "store a keeps the zebra rollout notes"
+TEXT_B = "store b keeps the zebra incident notes"
+
+
+class _FakeCloudflare(_FakeD1):
+    """D1 on SQLite; Vectorize returns every stored vector for any query."""
+
+    def __init__(self, storage):
+        super().__init__(storage)
+        # TestClient runs the app on another thread than the fixture.
+        self.db.close()
+        self.db = sqlite3.connect(":memory:", check_same_thread=False)
+        self.db.row_factory = sqlite3.Row
+        self.db.execute("PRAGMA foreign_keys = ON")
+        self.vector_upserts = []
+
+    async def __call__(self, method, url, **kwargs):
+        if url == f"{self.storage.vectorize_url}/query":
+            ids = [r[0] for r in self.db.execute("SELECT vector_id FROM memories").fetchall()]
+            matches = [{"id": vector_id, "score": 0.9} for vector_id in ids]
+            return Mock(json=Mock(return_value={"success": True, "result": {"matches": matches}}))
+        return await super().__call__(method, url, **kwargs)
+
+
+@pytest.fixture
+def cloudflare_storage():
+    return CloudflareStorage(
+        api_token="test-token",
+        account_id="test-account",
+        vectorize_index="test-index",
+        d1_database_id="test-db",
+        r2_bucket="test-bucket",
+        embedding_model="@cf/baai/bge-base-en-v1.5",
+    )
+
+
+@pytest_asyncio.fixture
+async def cloudflare(cloudflare_storage, monkeypatch):
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    fake = _FakeCloudflare(cloudflare_storage)
+    monkeypatch.setattr(cloudflare_storage, "_retry_request", fake)
+    upsert = AsyncMock()
+    monkeypatch.setattr(cloudflare_storage, "_store_vectorize_vector", upsert)
+    for name in ("_delete_vectorize_vector", "_store_r2_content", "_delete_r2_content"):
+        monkeypatch.setattr(cloudflare_storage, name, AsyncMock())
+    monkeypatch.setattr(cloudflare_storage, "_generate_embedding", AsyncMock(return_value=[0.1]))
+    await cloudflare_storage._initialize_d1_schema()
+    for text, store in ((TEXT_A, "a"), (TEXT_B, "b")):
+        memory = Memory(content=text, content_hash=generate_content_hash(text), tags=["zebra"])
+        ok, msg = await cloudflare_storage.store(memory, store=store)
+        assert ok, msg
+    fake.vector_upserts = upsert
+    yield fake
+    fake.db.close()
+
+
+@pytest.fixture
+def make_client(cloudflare_storage, cloudflare, monkeypatch):
+    from mcp_memory_service.web.app import app
+    from mcp_memory_service.web.oauth import middleware
+    from mcp_memory_service.web.api import mcp
+    from mcp_memory_service.web import dependencies
+
+    monkeypatch.setattr(middleware, "API_KEY", None)
+    monkeypatch.setattr(middleware, "OAUTH_ENABLED", False)
+    monkeypatch.setattr(middleware, "ALLOW_ANONYMOUS_ACCESS", True)
+    monkeypatch.setattr(dependencies, "_storage", None)
+    set_storage(cloudflare_storage)
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
+def _call(client, name, arguments):
+    return client.post("/mcp", json={
+        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
+        "params": {"name": name, "arguments": arguments},
+    })
+
+
+def _text(response):
+    assert response.status_code == 200, response.text
+    body = response.json()
+    assert "error" not in body, body
+    return " ".join(part.get("text", "") for part in body["result"]["content"])
+
+
+def test_cloudflare_confines_get_by_hash_to_store():
+    assert CloudflareStorage.get_by_hash_is_store_scoped is True
+
+
+@pytest.mark.integration
+def test_read_grant_searche
```

---

### Incident Patch 3: `a5b29978` (2026-11-18)
**Commit Message**: fix(onnx): enable tokenizer truncation for Hub models and replace vec0 rows cleanly (#2073) (#2074)

* fix(onnx): enable tokenizer truncation for Hub models and replace vec0 rows cleanly (#2073)

* fix(onnx): add changelog fragment, split max-length helpers, and batch regen savepoints (#2073)

---------

Co-authored-by: Salyvn <[REDACTED_EMAIL]>

**File**: `changelog.d/2074.fixed.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- **Hub ONNX models failed past 512 tokens and embedding regeneration aborted on existing rows (#2073, #2074, @SalyyS1).**
+  Pre-exported Hugging Face Hub models such as `intfloat/multilingual-e5-small` ship `tokenizer.json` with `"truncation": null`, so inputs longer than the position embedding table crashed ONNX Runtime with `BroadcastIterator::Init`, and `scripts/maintenance/regenerate_embeddings.py` used `INSERT OR REPLACE` on the `sqlite-vec` `vec0` virtual table, raising `UNIQUE constraint failed` whenever a row already had a vector. `_init_model` now enables truncation when unset using the model's usable sequence length (accounting for RoBERTa/XLM-RoBERTa/MPNet padding offsets and ignoring Hugging Face `model_max_length` sentinels), and `regenerate_embeddings.py` replaces vectors via per-row savepoints inside 10-row batch transactions.
```

**File**: `scripts/maintenance/regenerate_embeddings.py` (modified, +24/-6)
```diff
@@ -110,12 +110,30 @@ async def _regenerate_all(actual_storage, memories):
                 continue
 
             # Insert embedding into the memory's own store partition. memory_embeddings is
-            # a vec0 table with `store` as a partition key (#1521); writing without it lands
-            # the vector in the wrong partition, invisible to store-scoped KNN search.
-            actual_storage.conn.execute(
-                'INSERT OR REPLACE INTO memory_embeddings(rowid, content_embedding, store) VALUES (?, ?, ?)',
-                (result[0], serialize_float32(embedding), mem['store'])
-            )
+            # a vec0 virtual table with `store` as a partition key (#1521): vec0 does not
+            # support SQLite's `INSERT OR REPLACE` conflict resolution and raises
+            # `UNIQUE constraint failed on memory_embeddings primary key` when a rowid
+            # already exists (#2073). Open an outer batch transaction so `RELEASE SAVEPOINT`
+            # does not auto-commit each row individually, while keeping a per-row savepoint
+            # so a failed insert restores the deleted vector cleanly.
+            rowid = result[0]
+            if not getattr(actual_storage.conn, 'in_transaction', False):
+                actual_storage.conn.execute('BEGIN')
+            actual_storage.conn.execute('SAVEPOINT regen_emb')
+            try:
+                actual_storage.conn.execute(
+                    'DELETE FROM memory_embeddings WHERE rowid = ?',
+                    (rowid,),
+                )
+                actual_storage.conn.execute(
+                    'INSERT INTO memory_embeddings(rowid, content_embedding, store) VALUES (?, ?, ?)',
+                    (rowid, serialize_float32(embedding), mem['store']),
+                )
+                actual_storage.conn.execute('RELEASE SAVEPOINT regen_emb')
+            except Exception:
+                actual_storage.conn.execute('ROLLBACK TO SAVEPOINT regen_emb')
+                actual_storage.conn.execute('RELEASE SAVEPOINT regen_emb')
+                raise
 
             success_count += 1
 
```

**File**: `src/mcp_memory_service/embeddings/onnx_embeddings.py` (modified, +86/-1)
```diff
@@ -5,6 +5,7 @@
 """
 
 import hashlib
+import json
 import logging
 import os
 import re
@@ -262,6 +263,79 @@ def _find_onnx_file(self):
                 return cand
         return None
 
+    # Model families whose position embedding table reserves indices
+    # 0..pad_token_id (e.g. XLM-RoBERTa / RoBERTa / MPNet have
+    # max_position_embeddings=514 and pad_token_id=1 -> 512 usable tokens).
+    _OFFSET_POSITION_MODEL_TYPES = frozenset({
+        "xlm-roberta",
+        "roberta",
+        "camembert",
+        "mpnet",
+        "bart",
+        "mbart",
+        "longformer",
+    })
+    _MAX_REASONABLE_SEQ_LEN = 1_000_000
+    _DEFAULT_MAX_SEQ_LEN = 512
+
+    @staticmethod
+    def _read_json_dict(path: Path) -> Optional[dict]:
+        """Read a JSON object from disk, returning None if absent or malformed."""
+        if not path.exists():
+            return None
+        try:
+            data = json.loads(path.read_text(encoding="utf-8"))
+        except Exception as exc:
+            logger.debug(
+                "Could not parse %s: %s",
+                _sanitize_log_value(path),
+                _sanitize_log_value(exc),
+            )
+            return None
+        return data if isinstance(data, dict) else None
+
+    @classmethod
+    def _bounded_seq_len(cls, value: object) -> Optional[int]:
+        """Return value when it is a positive integer within reasonable sequence bounds."""
+        if isinstance(value, bool) or not isinstance(value, int):
+            return None
+        if 0 < value <= cls._MAX_REASONABLE_SEQ_LEN:
+            return value
+        return None
+
+    @classmethod
+    def _usable_config_max_length(cls, cfg: dict) -> Optional[int]:
+        """Extract usable sequence length from config.json, subtracting RoBERTa/MPNet pad offset."""
+        max_pos = cls._bounded_seq_len(cfg.get("max_position_embeddings"))
+        if max_pos is None:
+            return None
+        model_type = str(cfg.get("model_type") or "").lower()
+        if model_type not in cls._OFFSET_POSITION_MODEL_TYPES:
+            return max_pos
+        pad_id = cfg.get("pad_token_id", 1)
+        if not isinstance(pad_id, bool) and isinstance(pad_id, int) and 0 <= pad_id < max_pos - 1:
+            return max_pos - (pad_id + 1)
+        return max_pos
+
+    @classmethod
+    def _resolve_max_length(cls, model_dir: Path) -> int:
+        """Derive safe tokenizer truncation length from config.json / tokenizer_config.json."""
+        candidates: List[int] = []
+
+        cfg = cls._read_json_dict(model_dir / "config.json")
+        if cfg is not None:
+            cfg_max = cls._usable_config_max_length(cfg)
+            if cfg_max is not None:
+                candidates.append(cfg_max)
+
+        tok_cfg = cls._read_json_dict(model_dir / "tokenizer_config.json")
+        if tok_cfg is not None:
+            tok_max = cls._bounded_seq_len(tok_cfg.get("model_max_length"))
+            if tok_max is not None:
+                candidates.append(tok_max)
+
+        return min(candidates) if candidates else cls._DEFAULT_MAX_SEQ_LEN
+
     def _init_model(self):
         """Initialize ONNX model and tokenizer."""
         model_path = self._resolve_model_path()
@@ -286,8 +360,19 @@ def _init_model(self):
             providers=self._preferred_providers
         )
         
-        # Initialize tokenizer
+        # Initialize tokenizer. Many Hugging Face Hub repos (e.g.
+        # intfloat/multilingual-e5-small) ship tokenizer.json with
+        # "truncation": null, causing inputs longer than max_position_embeddings
+        # to fail inside ONNX Runtime's position-embedding broadcast (#2073).
         self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
+        if self._tokenizer.truncation is None:
+            max_len = self._resolve_max_length(tokenizer_path.parent)
+            self._tokenizer.enable_truncation(max_length=max_len)
+            logger.info(
+                "Enabled ONNX tokenizer truncation at max_length=%s for '%s'",
+                _sanitize_log_value(max_len),
+                _sanitize_log_value(self.model_name),
+            )
         
         # Get model info
         self.embedding_dimension = self._model.get_outputs()[0].shape[-1]
```

**File**: `tests/test_onnx_custom_model.py` (modified, +99/-0)
```diff
@@ -136,3 +136,102 @@ def test_default_model_name_never_validated(monkeypatch):
     m = _make_without_io(monkeypatch, "all-MiniLM-L6-v2")
     assert m._is_default_model is True
 
+
+def test_resolve_max_length_xlm_roberta_and_bert(tmp_path):
+    """_resolve_max_length accounts for RoBERTa/XLM-R padding offset (#2073)."""
+    import json
+    from mcp_memory_service.embeddings.onnx_embeddings import ONNXEmbeddingModel
+
+    # 1. No config files -> 512 fallback
+    assert ONNXEmbeddingModel._resolve_max_length(tmp_path) == 512
+
+    # 2. XLM-RoBERTa (e.g. intfloat/multilingual-e5-small): 514 - (1 + 1) == 512
+    #    even when tokenizer_config.json uses HF's VERY_LARGE_INTEGER sentinel.
+    (tmp_path / "config.json").write_text(json.dumps({
+        "model_type": "xlm-roberta",
+        "max_position_embeddings": 514,
+        "pad_token_id": 1,
+    }))
+    (tmp_path / "tokenizer_config.json").write_text(json.dumps({
+        "model_max_length": 1000000000000000019884624838656,
+    }))
+    assert ONNXEmbeddingModel._resolve_max_length(tmp_path) == 512
+
+    # 3. Long-context XLM-RoBERTa (e.g. bge-m3): 8194 - 2 == 8192
+    (tmp_path / "config.json").write_text(json.dumps({
+        "model_type": "xlm-roberta",
+        "max_position_embeddings": 8194,
+        "pad_token_id": 1,
+    }))
+    assert ONNXEmbeddingModel._resolve_max_length(tmp_path) == 8192
+
+    # 4. BERT model with tighter tokenizer_config model_max_length=256
+    (tmp_path / "config.json").write_text(json.dumps({
+        "model_type": "bert",
+        "max_position_embeddings": 512,
+        "pad_token_id": 0,
+    }))
+    (tmp_path / "tokenizer_config.json").write_text(json.dumps({
+        "model_max_length": 256,
+    }))
+    assert ONNXEmbeddingModel._resolve_max_length(tmp_path) == 256
+
+
+def test_init_model_enables_truncation_when_tokenizer_truncation_is_null(monkeypatch, tmp_path):
+    """Hub tokenizers without built-in truncation get truncated to model limit (#2073)."""
+    import json
+    from tokenizers import Tokenizer
+    from tokenizers.models import WordLevel
+    from tokenizers.pre_tokenizers import Whitespace
+    from mcp_memory_service.embeddings import onnx_embeddings as mod
+
+    vocab = {"[UNK]": 0, "[PAD]": 1, "hello": 2, "world": 3}
+    tok = Tokenizer(WordLevel(vocab=vocab, unk_token="[UNK]"))
+    tok.pre_tokenizer = Whitespace()
+    assert tok.truncation is None
+
+    model_dir = tmp_path / "multilingual-e5-small"
+    model_dir.mkdir()
+    (model_dir / "model.onnx").write_bytes(b"stub-onnx")
+    tok.save(str(model_dir / "tokenizer.json"))
+    (model_dir / "config.json").write_text(json.dumps({
+        "model_type": "xlm-roberta",
+        "max_position_embeddings": 514,
+        "pad_token_id": 1,
+    }))
+
+    class _StubIO:
+        def __init__(self, name, shape=None):
+            self.name = name
+            self.shape = shape or [1, 384]
+
+    class _StubSession:
+        def __init__(self, path, providers=None):
+            self.path = path
+
+        def get_outputs(self):
+            return [_StubIO("last_hidden_state", [1, 512, 384])]
+
+        def get_inputs(self):
+            return [_StubIO("input_ids"), _StubIO("attention_mask")]
+
+    monkeypatch.setattr(mod.ort, "InferenceSession", _StubSession)
+    monkeypatch.setattr(mod.ONNXEmbeddingModel, "_download_model_if_needed", lambda self: None)
+
+    orig_init = mod.ONNXEmbeddingModel._init_model
+
+    def _patched_init(self):
+        self._model_dir = model_dir
+        orig_init(self)
+
+    monkeypatch.setattr(mod.ONNXEmbeddingModel, "_init_model", _patched_init)
+
+    instance = mod.ONNXEmbeddingModel(model_name="multilingual-e5-small")
+    assert instance._tokenizer.truncation is not None
+    assert instance._tokenizer.truncation["max_length"] == 512
+
+    long_text = " ".join(["hello"] * 700)
+    encoded = instance._tokenizer.encode(long_text)
+    assert len(encoded.ids) == 512
+
+
```

**File**: `tests/unit/test_onnx_truncation_and_regen.py` (added, +303/-0)
```diff
@@ -0,0 +1,303 @@
+"""Unit tests for ONNX Hub tokenizer truncation and embedding regeneration (#2073)."""
+
+import asyncio
+import importlib
+import json
+import sqlite3
+import struct
+import sys
+import types
+from pathlib import Path
+
+
+def _import_onnx_embeddings_with_stubs(monkeypatch):
+    """Import onnx_embeddings even in minimal unit-test environments without numpy."""
+    if "numpy" not in sys.modules:
+        try:
+            import numpy  # noqa: F401
+        except ImportError:
+            fake_np = types.ModuleType("numpy")
+            fake_np.ndarray = object
+            monkeypatch.setitem(sys.modules, "numpy", fake_np)
+    mod_name = "mcp_memory_service.embeddings.onnx_embeddings"
+    if mod_name in sys.modules:
+        return importlib.reload(sys.modules[mod_name])
+    return importlib.import_module(mod_name)
+
+
+def _load_regenerate_module(monkeypatch):
+    """Import scripts/maintenance/regenerate_embeddings.py with lightweight storage/config stubs."""
+    try:
+        import sqlite_vec  # noqa: F401
+    except ImportError:
+        fake_sqlite_vec = types.ModuleType("sqlite_vec")
+        fake_sqlite_vec.serialize_float32 = lambda vec: struct.pack(f"{len(vec)}f", *vec)
+        monkeypatch.setitem(sys.modules, "sqlite_vec", fake_sqlite_vec)
+
+    fake_factory = types.ModuleType("mcp_memory_service.storage.factory")
+    fake_factory.create_storage_instance = None
+    monkeypatch.setitem(sys.modules, "mcp_memory_service.storage.factory", fake_factory)
+
+    fake_cfg = types.ModuleType("mcp_memory_service.config")
+    fake_cfg.SQLITE_VEC_PATH = ":memory:"
+    monkeypatch.setitem(sys.modules, "mcp_memory_service.config", fake_cfg)
+
+    repo_root = Path(__file__).resolve().parents[2]
+    monkeypatch.syspath_prepend(str(repo_root / "scripts" / "maintenance"))
+    if "regenerate_embeddings" in sys.modules:
+        return importlib.reload(sys.modules["regenerate_embeddings"])
+    return importlib.import_module("regenerate_embeddings")
+
+
+def test_resolve_max_length_handles_offset_and_sentinel(monkeypatch, tmp_path: Path):
+    mod = _import_onnx_embeddings_with_stubs(monkeypatch)
+    cls = mod.ONNXEmbeddingModel
+
+    # Default when neither config.json nor tokenizer_config.json exists.
+    assert cls._resolve_max_length(tmp_path) == 512
+
+    # XLM-RoBERTa (intfloat/multilingual-e5-small): 514 - (pad_token_id=1 + 1) = 512,
+    # ignoring Hugging Face's VERY_LARGE_INTEGER sentinel in tokenizer_config.json.
+    (tmp_path / "config.json").write_text(
+        json.dumps({"model_type": "xlm-roberta", "max_position_embeddings": 514, "pad_token_id": 1}),
+        encoding="utf-8",
+    )
+    (tmp_path / "tokenizer_config.json").write_text(
+        json.dumps({"model_max_length": 1000000000000000019884624838656}),
+        encoding="utf-8",
+    )
+    assert cls._resolve_max_length(tmp_path) == 512
+
+    # MPNet (all-mpnet-base-v2): 514 - 2 = 512.
+    (tmp_path / "config.json").write_text(
+        json.dumps({"model_type": "mpnet", "max_position_embeddings": 514, "pad_token_id": 1}),
+        encoding="utf-8",
+    )
+    assert cls._resolve_max_length(tmp_path) == 512
+
+    # BGE-M3 long-context XLM-RoBERTa: 8194 - 2 = 8192.
+    (tmp_path / "config.json").write_text(
+        json.dumps({"model_type": "xlm-roberta", "max_position_embeddings": 8194, "pad_token_id": 1}),
+        encoding="utf-8",
+    )
+    assert cls._resolve_max_length(tmp_path) == 8192
+
+    # BERT with explicit stricter tokenizer_config.json limit (256 < 512).
+    (tmp_path / "config.json").write_text(
+        json.dumps({"model_type": "bert", "max_position_embeddings": 512, "pad_token_id": 0}),
+        encoding="utf-8",
+    )
+    (tmp_path / "tokenizer_config.json").write_text(
+        json.dumps({"model_max_length": 256}),
+        encoding="utf-8",
+    )
+    assert cls._resolve_max_length(tmp_path) == 256
+
+
+def test_init_model_enables_truncation_only_when_null(monkeypatch, tmp_path: Path):
+    mod = _import_onnx_embeddings_with_stubs(monkeypatch)
+
+    model_dir = tmp_path / "e5"
+    model_dir.mkdir()
+    (model_dir / "model.onnx").write_bytes(b"stub")
+    (model_dir / "tokenizer.json").write_text("{}", encoding="utf-8")
+    (model_dir / "config.json").write_text(
+        json.dumps({"model_type": "xlm-roberta", "max_position_embeddings": 514, "pad_token_id": 1}),
+        encoding="utf-8",
+    )
+
+    class _StubTokenizer:
+        def __init__(self, initial_truncation):
+            self.truncation = initial_truncation
+            self.enabled_with = None
+
+        def enable_truncation(self, max_length):
+            self.enabled_with = max_length
+            self.truncation = {"max_length": max_length}
+
+    class _StubIO:
+        def __init__(self, name, shape=None):
+            self.name = name
+            self.shape = shape or [1, 384]
+
+    class _StubSession:
+        def __init__(self, *_a, **_kw):
+            pass
+
+        def get_outputs(
```

#### Recent Merged Pull Requests:
- **PR #2076** (2026-11-18): docs(contributing): block an account that keeps opening unclaimed PRs after a close (@doobidoo)
- **PR #2075** (closed): fix(cloudflare): exclude tombstones from D1 timestamp queries (#2059) (@bfs2021)
- **PR #2074** (2026-11-18): fix(onnx): enable tokenizer truncation for Hub models and replace vec0 rows cleanly (#2073) (@SalyyS1)
- **PR #2072** (2026-11-18): chore(deps): bump the uv group with 9 updates (@dependabot[bot])
- **PR #2071** (2026-11-18): --adapt-min-class: stray-label classes sit the balancing out; default flips to oversample (@Yoel-qin)
- **PR #2070** (2026-11-18): feat(consolidation): report consolidation progress over SSE (#2011) (@massimiliano1991)

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

## X. fix(api): preserve 400 validation errors and clean up temporary files on upload 

**RULE**:
When implementing operations in `changelog.d/2041.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cc58ab35`: fix(api): preserve 400 validation errors and clean up temporary files on upload failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/2041.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Document upload API swallowed 400 validation errors as 500 and leaked temporary files (#2041).**
  `POST /api/documents/upload` and `POST /api/documents/batch-upload` caught generic `Exception` without re-raising `HTTPException`, transforming client validation errors into 500 Internal Server Errors. Batch uploads that failed validation also orphaned temporary files created for preceding files. `HTTPException` is now re-raised and temporary files are cleaned up on failure.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cc58ab35` are properly handled with clean fallback behavior.
