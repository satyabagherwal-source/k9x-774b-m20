> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `fef259d7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T13:00:09.845Z  
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
> **Harvest Timestamp**: 2026-10-31T13:00:09.840Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2056 stars

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
- **Issue #1723** (2026-10-31): **[Bug]: harvest provider chain sends max_tokens and temperature to gpt-5.x**
  *Symptoms*: Found while testing LLM provider integrations in agent frameworks: an automated tool flags candidates and each one is reproduced before it is reported. Reproduced on c187ec5.  ### Bug Description With `HARVEST_LLM_PROVIDERS` pointing at OpenAI and a gpt-5.x model, every call from the provider chain is refused, because the request always carries `max_tokens` and `temperature`. #797 fixed exactly this for the quality scorer, where gpt-5.4-mini answered `Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.` The harvest rewriter and classifier build their own payload and did not get that branch.  Harvest rewrite, `memory_distill`, search summaries and the LLM NLI backend all share this chain. For harvest, the whole batch comes back as `None` and nothing is stored. A non dry-run `memory_harvest` still adds the session to the tracker, so those candidates stay skipped until `force_reharvest`.  ### Steps to Reproduce 1. Use the configuration below. 2. Run a rewrite. The endpoint here is a fake that returns the error body from #797 when `max_tokens` is present:  ```python def endpoint(request):     body = json.loads(request.content)     if "max_tokens" in body:         return httpx.Response(400, json={"error": {             "message": "Unsupported parameter: 'max_tokens' is not supported with this model. "                        "Use 'max_completion_tokens' instead.",             "type": "invalid_request_error", "param": "max_token

- **Issue #1708** (2026-10-29): **Milvus: purge_deleted() leaves graph edges of purged memories behind**
  *Symptoms*: Follow-up to #1703 / #1706.  #1706 made all six Milvus delete paths remove the graph edges of the memories they delete, through `MilvusMemoryStorage._delete_graph_edges()`. `purge_deleted()` was left out on purpose, as noted in the PR: it hard-deletes tombstoned rows by id and leaves their rows in `<collection>_graph` behind, the same leak #1703 fixed for the other paths.  On Milvus this is a narrow case. `delete()` is a hard delete, so a tombstone only exists when something set `metadata.deleted_at` explicitly via `update_memory_metadata()` (see the docstrings of `is_deleted()` and `purge_deleted()` in `storage/milvus.py`). When such a row is purged, its edges survive, including `has_entity`, so `find_memories_by_entity()` can still return the purged hash.  Fix: after the successful `delete` call in `purge_deleted()`, call `await self._delete_graph_edges(to_purge)`. Best-effort, same contract as the other paths.  Test: extend `tests/storage/test_milvus_delete_graph_edges.py`: store a memory with entity linking on, set `deleted_at` in its metadata with a `created_at` older than the threshold, run `purge_deleted()`, and assert no edge touches the hash. 

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

### Incident Patch 1: `5ffe3614` (2026-10-30)
**Commit Message**: fix(sync): bound the delta-sync event log by compacting update_metadata chains (#1721)

* fix(sync): bound the delta-sync event log by compacting update_metadata chains

The sync_events log is append-only and never compacted. Periodic local
recomputes (quality/utility) append an update_metadata event per memory
several times a day; on a 3-week-old production DB that was 1.36M events,
97% idempotent update_metadata (~53 per memory, ~half the DB file).

compact_update_metadata collapses, per content_hash, the update_metadata
chain into one consolidated event carrying the LWW-resolved state. It
reuses the apply resolver (_load_live_events + _resolve_md_fields) instead
of re-implementing LWW, so the compacted log re-materializes identically.

Convergence-preserving:
- only update_metadata is compacted; create/delete untouched (recreation anchor)
- nothing above MIN(last_seq_pushed) across peers is touched; cursors left alone
- per live incarnation (never merges across a create-after-delete boundary)
- consolidated event carries the winning event's HLC pair (not per-column max),
  reuses a seq within the collapsed range, deterministic event_id (idempotent)
- single SAVEPOINT, fail-close

**File**: `changelog.d/1721.fixed.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+- **Delta-sync: the `sync_events` log grew without bound from `update_metadata` churn (#1721, filhocf).**
+  The event log is append-only and never compacted, so periodic local recomputes
+  (quality/utility) that rewrite metadata appended an `update_metadata` event per memory
+  several times a day — on a 3-week-old database, 1.36M events, 97% of them idempotent
+  `update_metadata`. A new `compact_update_metadata` job collapses the chain per
+  `content_hash` into one consolidated event carrying the LWW-resolved state (reusing the
+  apply resolver, not re-implementing it). It is convergence-preserving: compaction is
+  all-or-nothing per live incarnation — a hash is only collapsed when its whole live
+  `update_metadata` chain sits at or below the safe watermark `MIN(last_seq_pushed)` across
+  peers, so a field whose winning edit is still above the watermark can never be defeated by
+  a collapsed field carrying an inflated clock. The consolidated event keeps the winning
+  event's HLC pair and a deterministic id that includes the payload hash (so peers that
+  compact divergent chains never reuse an identity). The delete is chunked and the whole
+  batch is fail-closed under a single SAVEPOINT.
```

**File**: `src/mcp_memory_service/storage/sync/compaction.py` (added, +355/-0)
```diff
@@ -0,0 +1,355 @@
+"""
+Delta-sync sync_events LOG COMPACTION (Gate G4 implementation).
+
+Collapses the idempotent op='update_metadata' chain per content_hash into a single
+consolidated event that carries the LWW-resolved state, giving the sync_events log a bound
+without breaking cross-peer convergence.
+
+Design (reuses, never reinvents — G1):
+  - Field-level LWW is NOT re-implemented here: the winning fields are read back through the
+    SAME resolver the apply path uses (``_load_live_events`` + ``_resolve_md_fields`` elect the
+    live incarnation and the per-field winners via ``_winner_key``). The consolidated event is
+    built so that re-resolving the (now shorter) log yields a byte-identical verdict (T1/T5/T7).
+  - The consolidated event carries the WINNING update_metadata event's HLC PAIR (the single
+    smallest ``_winner_key``), never MAX-per-column, so bootstrap._read_snapshot elects the same
+    (hlc_physical, hlc_logical) pair and _seed_last_hlc_on_first_boot cannot regress (T2).
+  - Only op='update_metadata' rows are ever removed; op='create'/op='delete' are untouched (T3).
+  - Watermark frontier: no event with seq > MIN(last_seq_pushed) across push_cursor may be
+    removed/rewritten. When ``watermark`` is None it is computed as that MIN; when there is NO
+    push_cursor row at all, no peer depends on the log tail, so the frontier is MAX(seq) (the
+    whole live chain is collapsible). sync_cursor and push_cursor are never touched (T4).
+  - The consolidated event_id is DETERMINISTIC (content_hash + winning HLC pair), so a second
+    run recognises the already-consolidated chain and is a no-op (T6a/T6b).
+  - Fail-closed: all removals + the insert run inside ONE SAVEPOINT; any error rolls the whole
+    thing back, leaving the log byte-identical (T6c).
+
+SPEC: spec-sync-eventlog-compaction.md.
+"""
+
+import hashlib
+import json
+import logging
+import os
+import time
+from typing import Dict, List, Optional, Tuple
+
+from ..base import MemoryStorage
+from ..mixins.base import _sanitize_log_value
+from .apply import (
+    _sqlite,
+    _sync_lock,
+    _load_live_events,
+    _ev_winner_key,
+    _metadata_items,
+    _top_level_fields,
+)
+
+logger = logging.getLogger(__name__)
+
+# The op of the consolidated event. The protection of free-form vs structured keys is NOT
+# done here — it comes from reusing apply._top_level_fields / apply._metadata_items, which
+# already classify the payload fields. This constant only names the op string.
+_CONSOLIDATED_OP = "update_metadata"
+
+
+def _compaction_agent_id() -> str:
+    """Stable agent id for consolidated events. A dedicated, single-token id (no slash) keeps
+    the row a valid, filterable event and makes the consolidated event visibly synthetic without
+    impersonating a real author."""
+    return "compaction"
+
+
+def _deterministic_consolidated_event_id(content_hash: str, hlc_physical: int, hlc_logical: int,
+                                         updates: Dict) -> str:
+    """Stable id for the consolidated update_metadata event (T6b).
+
+    Keyed on (content_hash, winning HLC pair, op, AND a canonical hash of the consolidated
+    `updates`). Same inputs → same id, so a second run on an unchanged chain produces the
+    identical identity and is recognised as already-consolidated. Including the payload hash
+    (Greptile P1#2) ensures two peers that compact DIVERGENT chains sharing the same winning
+    HLC pair mint DIFFERENT ids — otherwise identical ids with different payloads would be
+    rejected by apply_remote_event as an altered replay, silently dropping the event and
+    stalling the pull. Mirrors bootstrap._deterministic_event_id's shape ('prefix-' + sha256[:32]).
+    """
+    payload_digest = hashlib.sha256(
+        json.dumps(updates, sort_keys=True, separators=(",", ":")).encode("utf-8")
+    ).hexdigest()[:16]
+    raw = f"compact:{_CONSOLIDATED_OP}:{content_hash}:{hlc_physical}:{hlc_logical}:{payload_digest}".encode("utf-8")
+    return "cmp-" + hashlib.sha256(raw).hexdigest()[:32]
+
+
+def _frontier(s, watermark: Optional[int]) -> int:
+    """Compute the compaction frontier (max seq that may be collapsed).
+
+    - explicit watermark → use it verbatim (caller caps how far compaction may reach);
+    - watermark is None  → MIN(last_seq_pushed) across push_cursor; if there is NO push_cursor
+      row, no peer depends on the log tail, so the frontier is MAX(seq) (collapse everything).
+    """
+    if watermark is not None:
+        return int(watermark)
+    row = s.conn.execute("SELECT COUNT(*), MIN(last_seq_pushed) FROM push_cursor").fetchone()
+    has_peers = row is not None and row[0] and row[0] > 0
+    if has_peers and row[1] is not None:
+        return int(row[1])
+    max_row = s.conn.execute("SELECT COALESCE(MAX(seq), 0) FROM sync_events").fetchone()
+    return int(max_row[0]) if max_row and max_row[0] is not None else 0
+
+
+def _live_hashes_with_update_metadata(s) -> List[str]:
+
```

**File**: `tests/sync/test_sync_event_log_compaction.py` (added, +692/-0)
```diff
@@ -0,0 +1,692 @@
+"""
+RED tests (Gate G3 / TDD) for the sync_events LOG COMPACTION job — the fix for the
+unbounded sync_events growth where ~97% of rows are idempotent op='update_metadata'
+recomputes.
+
+Target under test (DOES NOT EXIST YET — collection fails with ImportError, valid RED):
+
+    from mcp_memory_service.storage.sync.compaction import compact_update_metadata
+    result = compact_update_metadata(storage, watermark=None)
+    # -> {"events_removed": int, "bytes_reclaimed": int | None}
+
+API / NAME DECISIONS (documented for G4, see subagent_response too):
+  - Module: mcp_memory_service/storage/sync/compaction.py (sibling of apply.py/bootstrap.py,
+    matches the package convention: resolver/apply/bootstrap/orchestrator/protocol).
+  - Public fn: compact_update_metadata(storage, watermark=None) -> dict. Name kept from the
+    task; it is precise (it compacts ONLY the update_metadata chains, never create/delete).
+  - watermark semantics (T4): optional int. When None the function MUST compute a safe
+    internal watermark = MIN(last_seq_pushed) across push_cursor (and never exceed the
+    live-event frontier). An explicit watermark lets the caller cap how far compaction may
+    touch. NO event with seq > watermark may be removed or rewritten.
+  - Return keys: events_removed (int, count of sync_events rows deleted) and bytes_reclaimed
+    (int | None; None allowed when the backend cannot cheaply measure, e.g. no VACUUM).
+
+WHY EACH TEST IS RED TODAY: compaction.py does not exist, so the module import at the top
+fails at COLLECTION time → every test in the file errors (ImportError). That is a legitimate
+RED for a not-yet-written function. Each test ALSO specifies real post-compaction BEHAVIOR
+(not just "import works") so it stays meaningful and turns GREEN only when G4 implements the
+contract — and would turn RED again on a regression.
+
+Reuses the REAL resolution (never re-implements LWW in the test):
+  - apply._load_live_events + apply._resolve_md_fields  (field-level LWW winners)
+  - apply._materialize_update_metadata                  (materialized row state)
+  - bootstrap._read_snapshot                            (HLC pair election per hash)
+  - store._recreate_of_for / recreate_of SELECT op='delete'  (delete dominance)
+"""
+
+import os
+import json
+import tempfile
+import time
+
+import pytest
+import pytest_asyncio
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.utils.hashing import generate_content_hash
+from mcp_memory_service.storage.sync.apply import (
+    apply_remote_event,
+    advance_sync_cursor,
+    _load_live_events,
+    _resolve_md_fields,
+    _materialize_update_metadata,
+    _sqlite,
+)
+from mcp_memory_service.storage.sync.bootstrap import _read_snapshot
+
+# The module under test — DOES NOT EXIST YET. This import fails at collection → RED.
+from mcp_memory_service.storage.sync.compaction import compact_update_metadata
+
+
+# ─────────────────────────────── fixtures / helpers ───────────────────────────────
+
+@pytest_asyncio.fixture
+async def store(monkeypatch):
+    monkeypatch.setenv("MCP_AGENT_ID", "beta")
+    monkeypatch.setenv("MCP_SYNC_EVENTLOG", "true")
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    with tempfile.TemporaryDirectory() as tmp:
+        s = SqliteVecMemoryStorage(os.path.join(tmp, "c.db"))
+        await s.initialize()
+        yield s
+        await s.close()
+
+
+async def _mk_store(name="x.db"):
+    d = tempfile.mkdtemp()
+    s = SqliteVecMemoryStorage(os.path.join(d, name))
+    await s.initialize()
+    return s
+
+
+def _create_event(content_hash, *, content, tags=None, store="default",
+                  created_at=1000.0, updated_at=1000.0, agent="alpha", event_id="c1",
+                  hlc_physical=10, hlc_logical=0, memory_type="note", metadata=None):
+    return {
+        "agent_id": agent, "event_id": event_id, "op": "create",
+        "content_hash": content_hash, "hlc_physical": hlc_physical, "hlc_logical": hlc_logical,
+        "embedding_model": None, "embedding_dim": None,
+        "payload": {
+            "content_hash": content_hash, "content": content, "memory_type": memory_type,
+            "tags": tags or [], "created_at": created_at, "updated_at": updated_at,
+            "metadata": metadata or {}, "store": store,
+        },
+    }
+
+
+def _update_metadata_event(content_hash, *, updates, event_id, agent="alpha",
+                           hlc_physical, hlc_logical=0, updated_at=2000.0):
+    return {
+        "agent_id": agent, "event_id": event_id, "op": "update_metadata",
+        "content_hash": content_hash, "hlc_physical": hlc_physical, "hlc_logical": hlc_logical,
+        "embedding_model": None, "embedding_dim": None,
+        "payload": {"content_hash": content_hash, "updates": updates, "updated_at": updated_at},
+    }
+
+
+def _delete_event(content_hash, *
```

---

### Incident Patch 2: `0071ab2a` (2026-10-31)
**Commit Message**: feat(rerank): per-stage timing of memory_search rerank under include_debug, and honor MCP_QUALITY_LOCAL_DEVICE (#1669) (#1701)

* feat(rerank): per-stage timing of memory_search rerank under include_debug (#1669)

With rerank=true and include_debug=true, result["debug"]["rerank_timing"]
now carries the wall-clock of each stage of the call: search (and pool
size), filters, scorer resolve (cold or warm, with the to_thread hop),
scoring (with the hop and one entry per ONNX inference chunk: items,
padded length, tokenize and run time) and the rerank stage total. The
debug block prints it; the handler logs one debug line per call.

Without include_debug nothing is measured and the response is unchanged;
scores and ordering are the same with or without timing. The tail of
handle_memory_search moved to _finish_memory_search so the handler can
time the stages before it (behaviour unchanged, complexity budget held).

* fix(rerank): honor MCP_QUALITY_LOCAL_DEVICE for the search reranker (#1669)

The rerank path resolved its scorer with device='auto' no matter what,
while the quality evaluator already passes MCP_QUALITY_LOCAL_DEVICE. On
Apple Silicon 'auto' selects the CoreML provider, which 

**File**: `changelog.d/1701.added.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+- **Per-stage timing of the `memory_search` rerank path (#1669, #1701, massimiliano1991).**
+  With `rerank=true` and `include_debug=true`, `debug.rerank_timing` carries the wall-clock of
+  each stage of the call — search and pool size, filters, scorer resolve (cold or warm, with the
+  `to_thread` hop), scoring with one line per ONNX inference chunk (items, padded length,
+  tokenize and run time) — and the debug block prints it. Without `include_debug` nothing is
+  measured and the response is unchanged.
```

**File**: `changelog.d/1701.fixed.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+- **The search reranker ignored `MCP_QUALITY_LOCAL_DEVICE` (#1669, #1701, massimiliano1991).**
+  It resolved its scorer with `device='auto'` regardless of the setting the quality evaluator
+  already passes to the same loader; on Apple Silicon `auto` selects the CoreML provider, which
+  runs the int8 cross-encoder an order of magnitude slower than the CPU provider. The setting
+  now reaches the reranker; the default (`auto`) is unchanged.
+- **Under `max_response_chars`, the debug block could displace every result; a zero-hit search printed none (#1701, massimiliano1991).**
+  With `include_debug=true` the diagnostics now ride after the results as the optional section
+  of a limited response, so the limiter drops them before it drops a memory; and a search with
+  no matches prints its debug block (filter counts and the search/filter timing) too, and
+  keeps it under the limit whether or not a summarization warning precedes it. The non-empty
+  limited path without a summarization warning budgeted only the memories and appended the
+  header, the truncation notice and the optional section uncounted; every positive
+  `max_response_chars` now goes through the bounded formatter, so a limited non-summary search
+  carries the bounded formatter's truncation notice (result counts, no character counts).
```

**File**: `src/mcp_memory_service/quality/onnx_ranker.py` (modified, +40/-7)
```diff
@@ -9,6 +9,7 @@
 import logging
 import os
 import threading
+import time
 from pathlib import Path
 from typing import List, Optional, Tuple
 import numpy as np
@@ -448,6 +449,19 @@ def score_quality(self, query: str, memory_content: str) -> float:
             logger.error("Error scoring quality with %s: %s", self.model_name, _sanitize_log_value(str(e)))
             return 0.5  # Return neutral score on error
 
+    @staticmethod
+    def _record_chunk_timing(timing, input_ids, t_start: float, t_tokenized: float) -> None:
+        """Append one chunk's split (tokenize vs. ``session.run``) when asked (#1669)."""
+        if timing is None:
+            return
+        t_done = time.perf_counter()
+        timing.append({
+            "items": int(input_ids.shape[0]),
+            "max_len": int(input_ids.shape[1]),
+            "tokenize_ms": round((t_tokenized - t_start) * 1000, 1),
+            "run_ms": round((t_done - t_tokenized) * 1000, 1),
+        })
+
     def _accepted_ort_inputs(self, ort_inputs: dict) -> dict:
         """Filter the feed to the inputs the loaded graph declares.
 
@@ -476,7 +490,8 @@ def _accepted_ort_inputs(self, ort_inputs: dict) -> dict:
     MIN_GPU_BATCH_SIZE = int(os.environ.get("MCP_QUALITY_MIN_GPU_BATCH", "16"))
 
     def score_quality_batch(
-        self, pairs: List[Tuple[str, str]], max_batch_size: int = 32
+        self, pairs: List[Tuple[str, str]], max_batch_size: int = 32,
+        timing: Optional[List[dict]] = None,
     ) -> List[float]:
         """
         Score multiple (query, memory_content) pairs in batched inference calls.
@@ -489,6 +504,12 @@ def score_quality_batch(
         Args:
             pairs: List of (query, memory_content) tuples
             max_batch_size: Maximum items per ONNX inference call
+            timing: Optional list; when given, one dict per inference chunk is
+                appended with ``items``, ``max_len`` (padded sequence length),
+                ``tokenize_ms`` and ``run_ms`` (issue #1669). Scores are not
+                affected. A chunk that fell back to sequential scoring leaves no
+                entry, so the sum of ``run_ms`` under the caller's total is the
+                sign of that fallback.
 
         Returns:
             List of quality scores between 0.0 and 1.0
@@ -512,7 +533,7 @@ def score_quality_batch(
         for chunk_start in range(0, len(pairs), max_batch_size):
             chunk = pairs[chunk_start:chunk_start + max_batch_size]
             try:
-                chunk_scores = self._score_batch_chunk(chunk)
+                chunk_scores = self._score_batch_chunk(chunk, timing)
                 all_scores.extend(chunk_scores)
             except Exception as e:
                 logger.warning(
@@ -523,20 +544,25 @@ def score_quality_batch(
 
         return all_scores
 
-    def _score_batch_chunk(self, pairs: List[Tuple[str, str]]) -> List[float]:
+    def _score_batch_chunk(
+        self, pairs: List[Tuple[str, str]], timing: Optional[List[dict]] = None
+    ) -> List[float]:
         """Score a single chunk of pairs in one ONNX inference call."""
         if self.model_config['type'] == 'classifier':
-            return self._score_classifier_batch(pairs)
+            return self._score_classifier_batch(pairs, timing)
         elif self.model_config['type'] == 'cross-encoder':
-            return self._score_cross_encoder_batch(pairs)
+            return self._score_cross_encoder_batch(pairs, timing)
         else:
             raise ValueError(f"Unsupported model type: {self.model_config['type']}")
 
-    def _score_classifier_batch(self, pairs: List[Tuple[str, str]]) -> List[float]:
+    def _score_classifier_batch(
+        self, pairs: List[Tuple[str, str]], timing: Optional[List[dict]] = None
+    ) -> List[float]:
         """Batch score for classifier models (DeBERTa). Uses memory_content only."""
         texts = [content for _, content in pairs]
         texts = [t if t else " " for t in texts]  # Avoid empty strings
 
+        t_start = time.perf_counter()
         if self._use_fast_tokenizer:
             encoded_list = self._tokenizer.encode_batch(texts)
             max_len = max(len(enc.ids) for enc in encoded_list)
@@ -557,7 +583,9 @@ def _score_classifier_batch(self, pairs: List[Tuple[str, str]]) -> List[float]:
             attention_mask = inputs["attention_mask"].astype(np.int64)
 
         ort_inputs = {"input_ids": input_ids, "attention_mask": attention_mask}
+        t_tokenized = time.perf_counter()
         outputs = self._model.run(None, self._accepted_ort_inputs(ort_inputs))
+        self._record_chunk_timing(timing, input_ids, t_start, t_tokenized)
         logits = outputs[0]  # Shape: (batch_size, num_classes)
 
         # Vectorized softmax + weighted score
@@ -569,8 +597,11 @@ def _score_classifier_batch(self, pairs: List[Tuple[str, str]]) -> List[float]:
         scores = probs @ class_values
         return np.clip(scores, 0.0, 1.0).tolist()
 
-    def 
```

**File**: `src/mcp_memory_service/quality/search_rerank.py` (modified, +89/-13)
```diff
@@ -32,6 +32,7 @@
 """
 
 import asyncio
+import time
 import logging
 import os
 import threading
@@ -51,6 +52,7 @@
 DEFAULT_RERANK_CANDIDATES = 40
 
 _TRUTHY = frozenset(('true', '1', 'yes', 'on', 'enabled'))
+_DEVICES = ('auto', 'cpu', 'cuda', 'mps', 'directml')
 
 
 @dataclass(frozen=True)
@@ -60,10 +62,12 @@ class SearchRerankConfig:
     enabled: bool = False
     candidates: int = DEFAULT_RERANK_CANDIDATES
     model: str = DEFAULT_RERANK_MODEL
+    device: str = 'auto'
 
     @classmethod
     def from_env(cls) -> 'SearchRerankConfig':
-        """Read the three flags. Junk falls back to defaults, never raises."""
+        """Read the three flags and the shared quality device. Junk falls back
+        to defaults, never raises."""
         raw_candidates = (os.getenv('MCP_RERANK_CANDIDATES') or '').strip()
         candidates = DEFAULT_RERANK_CANDIDATES
         if raw_candidates:
@@ -75,10 +79,21 @@ def from_env(cls) -> 'SearchRerankConfig':
                     _sanitize_log_value(raw_candidates),
                     DEFAULT_RERANK_CANDIDATES,
                 )
+        # Same knob as the quality evaluator (MCP_QUALITY_LOCAL_DEVICE): the
+        # reranker went through the loader with device='auto' regardless, so on
+        # Apple Silicon it always took the CoreML provider (issue #1669).
+        device = (os.getenv('MCP_QUALITY_LOCAL_DEVICE') or '').strip().lower() or 'auto'
+        if device not in _DEVICES:
+            logger.warning(
+                'Invalid MCP_QUALITY_LOCAL_DEVICE=%s for the reranker. Using auto',
+                _sanitize_log_value(device),
+            )
+            device = 'auto'
         return cls(
             enabled=(os.getenv('MCP_RERANK_ENABLED') or '').strip().lower() in _TRUTHY,
             candidates=candidates,
             model=(os.getenv('MCP_RERANK_MODEL') or '').strip() or DEFAULT_RERANK_MODEL,
+            device=device,
         )
 
 
@@ -113,7 +128,7 @@ def resolve_fetch_limit(arguments: dict, base_limit: int, config: Optional[Searc
 
 def _build_scorer(config: SearchRerankConfig) -> Any:
     """Resolve through the existing loader -- the single ONNX path."""
-    model = get_onnx_ranker_model(model_name=config.model)
+    model = get_onnx_ranker_model(model_name=config.model, device=config.device)
     if model is None:
         raise RuntimeError(
             f"ONNX ranker '{config.model}' could not be resolved through the existing loader"
@@ -147,48 +162,103 @@ def _log_failure_once(error: Exception) -> None:
 
 def _resolve_scorer(config: SearchRerankConfig) -> Optional[Any]:
     """Build once; a load failure latches for the process lifetime so callers
-    neither pay for a re-download nor re-log (EARS 4).
+    neither pay for a re-download nor re-log (EARS 4)."""
+    return _resolve_scorer_built(config)[0]
+
+
+def _resolve_scorer_built(config: SearchRerankConfig) -> tuple:
+    """``_resolve_scorer`` plus whether THIS call built the scorer, decided
+    inside the lock: of several searches arriving during the first load only
+    the one that ran ``_build_scorer`` reports ``True`` (issue #1669 timing).
 
     The once-log runs OUTSIDE ``_scorer_lock``: ``threading.Lock`` is not
     reentrant, so logging inside the critical section deadlocked every
     first-failure caller.
     """
     global _scorer
+    built = False
     if _load_failed.is_set():
-        return None
+        return None, built
     if _scorer is None:
         failure: Optional[Exception] = None
         with _scorer_lock:
             if _scorer is None:
+                built = True
                 try:
                     _scorer = _build_scorer(config)
                 except Exception as error:
                     _load_failed.set()
                     failure = error
         if failure is not None:
             _log_failure_once(failure)
-            return None
-    return _scorer
+            return None, built
+    return _scorer, built
+
+
+def _on_worker(fn, *args, **kwargs):
+    """Run ``fn`` on the worker and return (started_at, finished_at, result),
+    both clocks taken on the worker itself so the caller can tell the time
+    inside ``fn`` from the time spent waiting for the executor or the loop."""
+    started = time.perf_counter()
+    result = fn(*args, **kwargs)
+    return started, time.perf_counter(), result
+
+
+async def _timed_hop(record: Optional[dict], key: str, fn, *args, **kwargs):
+    """``asyncio.to_thread`` with, when ``record`` is given, ``<key>_ms`` (time
+    inside ``fn``, measured on the worker) and ``<key>_hop_ms`` (everything
+    else: the executor's queueing delay plus the wait for the event loop to
+    resume after ``fn`` returned) written to it. ``kwargs`` go to ``fn``
+    untouched (it may take a ``timing`` of its own)."""
+    if record is None:
+        return await asyncio.to_thread(fn, *args, **kwargs)
+    scheduled = time.perf_counter()
+    started, finished, result = await asyncio.to_thread(_on_w
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +121/-41)
```diff
@@ -1440,6 +1440,41 @@ def _format_memory_search_debug(result: dict) -> str:
                 f"\n  Time range: {time_filter.get('start_timestamp')} - "
                 f"{time_filter.get('end_timestamp')}"
             )
+    text += _format_rerank_timing(debug.get("rerank_timing"))
+    return text
+
+
+def _format_rerank_timing(timing) -> str:
+    """One block per stage of the rerank path (issue #1669); empty when the
+    stage did not run under include_debug."""
+    if not timing:
+        return ""
+    text = "\n  Rerank timing (ms):"
+    if "search_ms" in timing:
+        text += f"\n    search: {timing['search_ms']} (pool {timing.get('pool')})"
+        text += f"\n    filters: {timing['filters_ms']}"
+    if "resolve_ms" in timing:
+        text += (
+            f"\n    scorer resolve: {timing['resolve_ms']}"
+            f" ({'cold' if timing.get('scorer_cold') else 'warm'},"
+            f" hop {timing.get('resolve_hop_ms')})"
+        )
+    if "score_ms" in timing:
+        text += (
+            f"\n    score: {timing['score_ms']} (hop {timing.get('score_hop_ms')},"
+            f" {timing.get('candidates')} candidates)"
+        )
+        for chunk in timing.get("chunks") or ():
+            text += (
+                f"\n      chunk of {chunk.get('items')} x {chunk.get('max_len')} tokens:"
+                f" tokenize {chunk.get('tokenize_ms')}, run {chunk.get('run_ms')}"
+            )
+    if "rerank_ms" in timing:
+        text += f"\n    rerank stage total: {timing['rerank_ms']}"
+        # The fallback note means the scorer was asked and the baseline order
+        # was kept; an empty pool never asked it, so it says nothing.
+        if "candidates" in timing and not timing.get("applied", True):
+            text += " (fell back to the unreranked order)"
     return text
 
 
@@ -1464,11 +1499,7 @@ async def _format_truncated_memory_search(
     fallback_used: bool, max_response_chars: int, summary_warning: str,
 ) -> types.TextContent:
     """Format search results through the configured response-length limiter."""
-    from ..utils.response_limiter import (
-        format_bounded_response,
-        format_truncated_response,
-        truncate_memories,
-    )
+    from ..utils.response_limiter import format_bounded_response
 
     memory_dicts = [
         {
@@ -1480,20 +1511,25 @@ async def _format_truncated_memory_search(
         }
         for memory in memories
     ]
+    # Under a limit the diagnostics asked for with include_debug ride after
+    # the results as the optional section, never in the required header: the
+    # limiter drops an optional section before it drops a memory (Greptile
+    # on #1701: in the header a long debug block could leave only the header).
     header = _build_memory_search_header(result, total, fallback_used) + "\n\n"
-    beliefs_section = await _format_beliefs_section(arguments, storage)
-    if summary_warning:
-        response_text = format_bounded_response(
-            memory_dicts,
-            max_response_chars,
-            header=summary_warning + header,
-            footer=beliefs_section,
-        )
-        return types.TextContent(type="text", text=response_text)
-
-    truncated, meta = truncate_memories(memory_dicts, max_response_chars)
-    response_text = (
-        header + format_truncated_response(truncated, meta) + beliefs_section
+    optional_section = (
+        _format_memory_search_debug(result)
+        + await _format_beliefs_section(arguments, storage)
+    )
+    # Every positive limit goes through the bounded formatter, with or
+    # without a summarization warning in front: the no-warning branch used to
+    # budget only the memories and append the header, the truncation notice
+    # and the optional section uncounted (doobidoo and ducanhnguyen223 on
+    # #1701), so a response could exceed the limit by the whole debug block.
+    response_text = format_bounded_response(
+        memory_dicts,
+        max_response_chars,
+        header=summary_warning + header,
+        footer=optional_section,
     )
     return types.TextContent(type="text", text=response_text)
 
@@ -1508,17 +1544,25 @@ async def _format_empty_memory_search(
     response = "No memories found"
     if result.get("query"):
         response += f" for query: '{result['query']}'"
-    beliefs_section = await _format_beliefs_section(arguments, storage)
-    if summary_warning and max_response_chars > 0:
+    # A zero-hit search still carries the diagnostics the caller asked for
+    # (filter counts, and the search/filter timing of #1669): a slow empty
+    # search is the one that needs them (Greptile on #1701).
+    optional_section = (
+        _format_memory_search_debug(result)
+        + await _format_beliefs_section(arguments, storage)
+    )
+    # Every positive limit goes through the limiter, with or without a
+    # summarization warning in front (doobidoo and ducanhnguyen223 on #1701).
+    if max_response_chars > 0:
  
```

**File**: `tests/quality/test_search_rerank_flag.py` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ async def test_reranker_model_env_is_passed_to_the_loader(monkeypatch):
     monkeypatch.setenv('MCP_RERANK_MODEL', 'ms-marco-MiniLM-L-6-v2')
     with patch(LOADER, return_value=stub) as loader:
         await rerank_candidates('q', _memories(2), _enabled_config())
-    loader.assert_called_once_with(model_name='ms-marco-MiniLM-L-6-v2')
+    loader.assert_called_once_with(model_name='ms-marco-MiniLM-L-6-v2', device='auto')
 
 
 # --- EARS 4: fail-open -------------------------------------------------------
```

**File**: `tests/quality/test_search_rerank_timing.py` (added, +583/-0)
```diff
@@ -0,0 +1,583 @@
+"""Per-stage timing of the rerank path (issue #1669).
+
+Contract:
+- Timing rides on ``include_debug``: with it, ``result["debug"]["rerank_timing"]``
+  carries one wall-clock entry per stage; without it the response is unchanged
+  (no ``debug`` key is added, the scorer is called exactly as before).
+- ``scorer_cold`` is True on the call that built the scorer and False after.
+- The ranker records one entry per ONNX inference call (``items``, ``max_len``,
+  ``tokenize_ms``, ``run_ms``), so a pool of 40 under the default
+  ``max_batch_size`` shows as two chunks of 32 and 8.
+- The handler adds ``search_ms``/``pool``/``filters_ms``/``rerank_ms`` and the
+  debug block prints them.
+- Scores and ordering are the same with or without timing.
+"""
+
+import asyncio
+import logging
+import threading
+import time
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import numpy as np
+import pytest
+
+from mcp_memory_service.quality import search_rerank
+from mcp_memory_service.quality.onnx_ranker import ONNXRankerModel
+from mcp_memory_service.quality.search_rerank import (
+    SearchRerankConfig,
+    apply_search_rerank,
+    rerank_candidates,
+    reset_scorer_for_tests,
+)
+from mcp_memory_service.server.handlers import memory as memory_handlers
+
+LOADER = 'mcp_memory_service.quality.search_rerank.get_onnx_ranker_model'
+ENV_VARS = ('MCP_RERANK_ENABLED', 'MCP_RERANK_CANDIDATES', 'MCP_RERANK_MODEL')
+STAGE_KEYS = {
+    'candidates', 'scorer_cold', 'resolve_hop_ms', 'resolve_ms',
+    'score_hop_ms', 'score_ms', 'chunks', 'applied',
+}
+
+
+@pytest.fixture(autouse=True)
+def _clean_state(monkeypatch):
+    for var in ENV_VARS:
+        monkeypatch.delenv(var, raising=False)
+    reset_scorer_for_tests()
+    yield
+    reset_scorer_for_tests()
+
+
+class _StubModel:
+    """Scorer double that records how it was called, timing included."""
+
+    def __init__(self, scores, error=None):
+        self._scores = scores
+        self._error = error
+        self.calls = []
+
+    def score_quality_batch(self, pairs, max_batch_size=32, timing=None):
+        self.calls.append((list(pairs), timing))
+        if self._error is not None:
+            raise self._error
+        if timing is not None:
+            timing.append({'items': len(pairs), 'max_len': 7,
+                           'tokenize_ms': 0.1, 'run_ms': 0.2})
+        return list(self._scores)
+
+
+def _memories(n):
+    return [{'content': f'memory-{i}', 'content_hash': f'hash-{i}'} for i in range(n)]
+
+
+def _config():
+    return SearchRerankConfig(enabled=True, candidates=40, model='Xenova/bge-reranker-base')
+
+
+# --- timing rides on include_debug ------------------------------------------
+
+
+@pytest.mark.asyncio
+async def test_timing_attached_only_under_include_debug(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    stub = _StubModel(scores=[0.9 - 0.01 * i for i in range(40)])
+    memories = _memories(40)
+    with patch(LOADER, return_value=stub):
+        result = {'memories': memories, 'total': 40}
+        out, total = await apply_search_rerank(
+            {'rerank': True, 'limit': 10, 'include_debug': True}, 'q', memories, 40, result
+        )
+    assert total == 10 and len(out) == 10
+    timing = result['debug']['rerank_timing']
+    assert STAGE_KEYS <= set(timing)
+    assert timing['candidates'] == 40
+    assert timing['applied'] is True
+    assert timing['chunks'] == [{'items': 40, 'max_len': 7, 'tokenize_ms': 0.1, 'run_ms': 0.2}]
+    for key in ('resolve_hop_ms', 'resolve_ms', 'score_hop_ms', 'score_ms'):
+        assert isinstance(timing[key], float) and timing[key] >= 0.0
+    # The scorer received the chunk list it was asked to fill.
+    assert stub.calls[0][1] is timing['chunks']
+
+
+@pytest.mark.asyncio
+async def test_without_include_debug_nothing_is_measured(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    stub = _StubModel(scores=[0.9 - 0.01 * i for i in range(5)])
+    memories = _memories(5)
+    result = {'memories': memories, 'total': 5}
+    with patch(LOADER, return_value=stub):
+        await apply_search_rerank({'rerank': True, 'limit': 3}, 'q', memories, 5, result)
+    assert 'debug' not in result
+    assert stub.calls == [([('q', f'memory-{i}') for i in range(5)], None)]
+
+
+@pytest.mark.asyncio
+async def test_existing_debug_block_is_extended_not_replaced(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    stub = _StubModel(scores=[0.6 + 0.1 * i for i in range(3)])
+    memories = _memories(3)
+    result = {'memories': memories, 'total': 3, 'debug': {'raw_total': 3}}
+    with patch(LOADER, return_value=stub):
+        await apply_search_rerank(
+            {'rerank': True, 'limit': 3, 'include_debug': True}, 'q', memories, 3, result
+        )
+    assert result['debug']['raw_total'] == 3
+    assert result['debug']['rerank_timing']['candidates'] == 3
+
+
+@pytest.mark.asyncio
+async def test_order_i
```

---

### Incident Patch 3: `fef259d7` (2026-10-31)
**Commit Message**: fix(harvest): support GPT-5 completion parameters (#1725)

* fix: use GPT-5 compatible harvest completion parameters

* docs: add changelog entry for harvest GPT-5 fix

* test: cover legacy harvest completion parameters

* docs: fix changelog fragment format

---------

Co-authored-by: Henry Krupp <[REDACTED_EMAIL]>

**File**: `changelog.d/1723.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Fix harvest OpenAI-compatible requests for GPT-5 models by using max_completion_tokens.
```

**File**: `src/mcp_memory_service/harvest/classifier.py` (modified, +2/-3)
```diff
@@ -15,7 +15,7 @@
 
 from ..compat import _sanitize_log_value
 from .models import HarvestCandidate
-from .rewriter import load_llm_providers, is_usable_provider
+from .rewriter import build_openai_compatible_payload, load_llm_providers, is_usable_provider
 
 logger = logging.getLogger(__name__)
 
@@ -241,8 +241,7 @@ def _call_openai_compatible(
                 f"{base_url}/chat/completions",
                 headers=headers,
                 # stream is explicit: fm serve streams SSE when it is absent (#1666)
-                json={"model": model, "stream": False, "messages": messages,
-                      "temperature": temperature, "max_tokens": max_tokens},
+                json=build_openai_compatible_payload(model, messages, max_tokens, temperature),
             )
             if resp.status_code == 429:
                 raise Exception(f"Rate limit exceeded: {resp.text[:100]}")
```

**File**: `src/mcp_memory_service/harvest/rewriter.py` (modified, +14/-7)
```diff
@@ -15,6 +15,17 @@
 
 VALID_TYPES = {"decision", "bug", "convention", "learning", "context"}
 
+
+def build_openai_compatible_payload(model: str, messages: list, max_tokens: int, temperature: float) -> dict:
+    """Build a chat-completions payload compatible with GPT-5 reasoning models."""
+    payload = {"model": model, "stream": False, "messages": messages}
+    if model.startswith("gpt-5"):
+        payload["max_completion_tokens"] = max_tokens + 800
+    else:
+        payload["temperature"] = temperature
+        payload["max_tokens"] = max_tokens
+    return payload
+
 # Models sometimes echo the literal placeholder word "TYPE" or "<type>" from the prompt
 # instead of substituting the real type, e.g. "TYPE: convention — <text>" or "<type>: text".
 # This strips that leaked wrapper and recovers the real type + content.
@@ -517,13 +528,9 @@ async def _call_openai_compatible(self, base_url: str, model: str, api_key: str,
             resp = await client.post(
                 f"{base_url}/chat/completions",
                 headers=headers,
-                json={
-                    "model": model,
-                    "stream": False,  # fm serve streams SSE when this is absent (#1666)
-                    "messages": [{"role": "user", "content": prompt}],
-                    "temperature": 0.3,
-                    "max_tokens": 200,
-                },
+                json=build_openai_compatible_payload(
+                    model, [{"role": "user", "content": prompt}], 200, 0.3
+                ),
             )
             if resp.status_code == 429:
                 raise Exception(f"Rate limit exceeded: {resp.text[:100]}")
```

**File**: `tests/harvest/test_classifier.py` (modified, +19/-0)
```diff
@@ -375,3 +375,22 @@ def test_payload_disables_streaming_explicitly(self):
 
         payload = client.__enter__.return_value.post.call_args.kwargs["json"]
         assert payload["stream"] is False
+        assert payload["max_tokens"] == 50
+        assert payload["temperature"] == 0.0
+        assert "max_completion_tokens" not in payload
+
+    def test_gpt5_uses_completion_tokens_without_temperature(self):
+        resp = MagicMock(status_code=200)
+        resp.json.return_value = {"choices": [{"message": {"content": "{}"}}]}
+        client = MagicMock()
+        client.__enter__.return_value.post.return_value = resp
+
+        with patch("httpx.Client", return_value=client):
+            _classifier_without_groq_key()._call_openai_compatible(
+                "http://127.0.0.1:1976/v1", "gpt-5.4-mini", "", "prompt", "system msg", 200, 0.3
+            )
+
+        payload = client.__enter__.return_value.post.call_args.kwargs["json"]
+        assert payload["max_completion_tokens"] == 1000
+        assert "max_tokens" not in payload
+        assert "temperature" not in payload
```

**File**: `tests/harvest/test_rewriter.py` (modified, +25/-0)
```diff
@@ -357,3 +357,28 @@ async def post(self, *args, **kwargs):
             "http://127.0.0.1:1976/v1", "system", "", "prompt", 5.0
         )
         assert captured["stream"] is False
+        assert captured["max_tokens"] == 200
+        assert captured["temperature"] == 0.3
+        assert "max_completion_tokens" not in captured
+
+    @pytest.mark.asyncio
+    async def test_gpt5_uses_completion_tokens_without_temperature(self, monkeypatch):
+        captured = {}
+
+        class _FakeAsyncClient:
+            def __init__(self, timeout): pass
+            async def __aenter__(self): return self
+            async def __aexit__(self, *exc): return False
+            async def post(self, *args, **kwargs):
+                captured.update(kwargs["json"])
+                resp = MagicMock(status_code=200)
+                resp.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
+                return resp
+
+        monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
+        await HarvestRewriter()._call_openai_compatible(
+            "http://127.0.0.1:1976/v1", "gpt-5.4-mini", "", "prompt", 5.0
+        )
+        assert captured["max_completion_tokens"] == 1000
+        assert "max_tokens" not in captured
+        assert "temperature" not in captured
```

#### Recent Merged Pull Requests:
- **PR #1725** (2026-10-31): fix(harvest): support GPT-5 completion parameters (@mikemikimike)
- **PR #1721** (2026-10-30): fix(sync): bound the delta-sync event log by compacting update_metadata chains (@filhocf)
- **PR #1720** (2026-10-30): test(multi-store): assert the isolated memory is absent, not that search is empty (@timkjr)
- **PR #1719** (2026-10-30): fix(quality): log the async scorer's first-use start at DEBUG, not WARNING (@timkjr)
- **PR #1718** (2026-10-30): fix(storage): stop loading the Milvus backend on every import (@timkjr)
- **PR #1717** (2026-10-29): fix(oauth): omit empty members from the client registration response (#1707) (@djimenezm2)

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

## X. sync): bound the delta-sync event log by compacting update_metadata chains (#172

**RULE**:
When implementing operations in `changelog.d/1721.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ffe3614`: sync): bound the delta-sync event log by compacting update_metadata chains (#1721). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1721.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Delta-sync: the `sync_events` log grew without bound from `update_metadata` churn (#1721, filhocf).**
  The event log is append-only and never compacted, so periodic local recomputes
  (quality/utility) that rewrite metadata appended an `update_metadata` event per memory
  several times a day — on a 3-week-old database, 1.36M events, 97% of them idempotent
  `update_metadata`. A new `compact_update_metadata` job collapses the chain per
  `content_hash` into one consolidated event carrying the LWW-resolved state (reusing the
  apply resolver, not re-implementing it). It is convergence-preserving: compaction is
  all-or-nothing per live incarnation — a hash is only collapsed when its whole live
  `update_metadata` chain sits at or below the safe watermark `MIN(last_seq_pushed)` across
  peers, so a field whose winning edit is still above the watermark can never be defeated by
  a collapsed field carrying an inflated clock. The consolidated event keeps the winning
  event's HLC pair and a deterministic id that includes the payload hash (so peers that
  compact divergent chains never reuse an identity). The delete is chunked and the whole
  batch is fail-closed under a single SAVEP
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ffe3614` are properly handled with clean fallback behavior.
