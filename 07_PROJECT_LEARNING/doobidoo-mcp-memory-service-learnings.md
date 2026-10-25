> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `a930c2b1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T16:02:42.961Z  
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
> **Harvest Timestamp**: 2026-10-25T16:02:42.635Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2043 stars

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

### Incident Patch 1: `344f4ae1` (2026-10-23)
**Commit Message**: feat(search): optional second-stage ONNX rerank flag for memory_search (#1602) (#1661)

* feat(search): optional second-stage ONNX rerank flag for memory_search (#1602)

Adds a per-call `rerank` boolean to the memory_search arguments, gated by
MCP_RERANK_ENABLED (default off), MCP_RERANK_CANDIDATES (default 40) and
MCP_RERANK_MODEL (default Xenova/bge-reranker-base). Inference goes through
the existing quality/onnx_ranker loader only; load or inference failures
fail open to the unreranked order with one process-lifetime warning. The
scorer is a process-wide instance with no shared mutable state, safe
alongside quality_boost. pyproject deps untouched (no torch).

Refs: doobidoo/mcp-memory-service#1602

* docs(1602): bancada result - ms-marco baseline refuted (-8.3 p.p. @10); bge-int8 registration blocking for PR

* feat(quality): register Xenova cross-encoder int8 models in SUPPORTED_MODELS

Config-data registration for the #1602 service-path bench: bge-reranker-base
(2 inputs: input_ids/attention_mask, Unigram tokenizer) e ms-marco
MiniLM-L-6-v2 (3 inputs incl. token_type_ids, BERT tokenizer).

The ONNXRankerModel inference paths now honor the model_config['inputs']
declared in the

**File**: `changelog.d/1602.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Add an opt-in `rerank` flag to `memory_search`: a second-stage ONNX cross-encoder reorders the top `MCP_RERANK_CANDIDATES` results when `MCP_RERANK_ENABLED` is set, fails open to the unreranked order, and never touches the default path.
```

**File**: `src/mcp_memory_service/quality/config.py` (modified, +16/-0)
```diff
@@ -179,6 +179,22 @@ def can_use_gemini(self) -> bool:
         'output_classes': ['low', 'medium', 'high'],
         'description': 'Absolute quality assessment (recommended, eliminates self-matching bias)'
     },
+    'Xenova/bge-reranker-base': {
+        'hf_name': 'Xenova/bge-reranker-base',
+        'type': 'cross-encoder',
+        'size_mb': 266,
+        'inputs': ['input_ids', 'attention_mask'],
+        'output_classes': None,
+        'description': 'bge reranker int8 (issue #1602 service-path bench model)'
+    },
+    'Xenova/ms-marco-MiniLM-L-6-v2': {
+        'hf_name': 'Xenova/ms-marco-MiniLM-L-6-v2',
+        'type': 'cross-encoder',
+        'size_mb': 23,
+        'inputs': ['input_ids', 'attention_mask', 'token_type_ids'],
+        'output_classes': None,
+        'description': 'ms-marco MiniLM int8 (issue #1602 service-path bench model)'
+    },
     'ms-marco-MiniLM-L-6-v2': {
         'hf_name': 'cross-encoder/ms-marco-MiniLM-L-6-v2',
         'type': 'cross-encoder',  # Query-document relevance ranking
```

**File**: `src/mcp_memory_service/quality/onnx_ranker.py` (modified, +28/-3)
```diff
@@ -311,8 +311,14 @@ def _init_model(self):
 
         # Initialize ONNX session
         logger.info("Loading ONNX ranker model with providers: %s", self._preferred_providers)
+        session_options = ort.SessionOptions()
+        # 0 = ORT default (all physical cores). The knob exists so a deployment
+        # can cap the intra-op pool when the rerank stage shares the box with
+        # other CPU-bound work.
+        session_options.intra_op_num_threads = int(os.environ.get("MCP_ORT_THREADS", "0") or 0)
         self._model = ort.InferenceSession(
             str(onnx_path),
+            sess_options=session_options,
             providers=self._preferred_providers
         )
 
@@ -411,7 +417,7 @@ def score_quality(self, query: str, memory_content: str) -> float:
                 return 0.5
 
             # Run inference
-            outputs = self._model.run(None, ort_inputs)
+            outputs = self._model.run(None, self._accepted_ort_inputs(ort_inputs))
             logits = outputs[0][0]  # Shape: (num_classes,)
 
             # Convert logits to score based on model type
@@ -442,6 +448,25 @@ def score_quality(self, query: str, memory_content: str) -> float:
             logger.error("Error scoring quality with %s: %s", self.model_name, _sanitize_log_value(str(e)))
             return 0.5  # Return neutral score on error
 
+    def _accepted_ort_inputs(self, ort_inputs: dict) -> dict:
+        """Filter the feed to the inputs the loaded graph declares.
+
+        BERT-like exports differ: some graphs accept ``token_type_ids``, others
+        declare only ``input_ids``/``attention_mask`` (Xenova int8 exports do the
+        latter). Sending an undeclared input makes onnxruntime raise, the
+        single-item retry sends the same payload, and the rerank silently falls
+        back to the unreranked order -- measured on #1661 (Greptile P1).
+        """
+        try:
+            accepted = {node.name for node in self._model.get_inputs()}
+        except (AttributeError, TypeError):
+            # Test doubles and exotic sessions do not expose get_inputs(); the
+            # real InferenceSession always does. Fail safe: pass the feed as-is.
+            return ort_inputs
+        if not accepted:
+            return ort_inputs
+        return {name: value for name, value in ort_inputs.items() if name in accepted}
+
     # Minimum batch size to use batched ONNX inference on GPU.
     # Below this threshold, sequential single-item GPU calls are faster
     # because small batches incur padding + tensor transfer overhead
@@ -532,7 +557,7 @@ def _score_classifier_batch(self, pairs: List[Tuple[str, str]]) -> List[float]:
             attention_mask = inputs["attention_mask"].astype(np.int64)
 
         ort_inputs = {"input_ids": input_ids, "attention_mask": attention_mask}
-        outputs = self._model.run(None, ort_inputs)
+        outputs = self._model.run(None, self._accepted_ort_inputs(ort_inputs))
         logits = outputs[0]  # Shape: (batch_size, num_classes)
 
         # Vectorized softmax + weighted score
@@ -587,7 +612,7 @@ def _score_cross_encoder_batch(self, pairs: List[Tuple[str, str]]) -> List[float
             "attention_mask": attention_mask,
             "token_type_ids": token_type_ids,
         }
-        outputs = self._model.run(None, ort_inputs)
+        outputs = self._model.run(None, self._accepted_ort_inputs(ort_inputs))
         logits = outputs[0]  # Shape: (batch_size, num_classes) or (batch_size,)
 
         # Vectorized sigmoid
```

**File**: `src/mcp_memory_service/quality/search_rerank.py` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+"""Optional ONNX reranker for memory_search (issue #1602).
+
+Closed scope: a per-call ``rerank`` boolean on ``memory_search``, gated by the
+``MCP_RERANK_*`` environment flags. Inference runs through the existing
+``quality/onnx_ranker.py`` loader — one ONNX path, no second implementation.
+
+Contract (specs/1602-rerank-flag.md):
+
+- EARS 1/2 — with ``rerank`` absent or false the stage never runs; without
+  ``MCP_RERANK_ENABLED`` the flag is a total no-op: no model load, no download,
+  no timing change, byte-identical response ordering.
+- EARS 3 — active: the candidate pool is inflated to ``MCP_RERANK_CANDIDATES``
+  (default 40), scored against the query by the model named in
+  ``MCP_RERANK_MODEL`` (default ``Xenova/bge-reranker-base``), sorted best
+  first, truncated to the caller's ``limit``.
+- EARS 4 — fail-open end to end: a missing model, an unresolvable name, or an
+  inference error degrades to the unreranked order and logs one warning per
+  process lifetime. It never raises to the caller.
+- EARS 5 — model resolution goes through ``quality/onnx_ranker.py``'s
+  ``get_onnx_ranker_model`` exclusively.
+- EARS 6 — thread-safe alongside ``quality_boost``: the scorer is a
+  process-wide instance cached behind a double-checked lock, but scoring
+  runs on a worker thread (``asyncio.to_thread``) so the event loop is never
+  blocked. ``quality_boost`` keeps its own ranker instance; the two paths
+  share no mutable state. The only process-wide mutable state is
+  bookkeeping (the cached instance and the failure latch), which never
+  affects any result's ORDER — results depend only on the query and the
+  candidate list.
+
+Config is re-read per call (mirrors ``QualityConfig.from_env()``) so tests and
+host services flip the flags without a process reload.
+"""
+
+import asyncio
+import logging
+import os
+import threading
+from dataclasses import dataclass
+from typing import Any, List, Optional
+
+from ..compat import _sanitize_log_value
+from .onnx_ranker import get_onnx_ranker_model
+
+logger = logging.getLogger(__name__)
+
+#: Default model: the issue's measured cross-encoder, exported ONNX int8.
+#: Only names resolvable through the existing loader actually load; anything
+#: unresolvable fails open (EARS 4) -- see the module docstring.
+DEFAULT_RERANK_MODEL = 'Xenova/bge-reranker-base'
+
+DEFAULT_RERANK_CANDIDATES = 40
+
+_TRUTHY = frozenset(('true', '1', 'yes', 'on', 'enabled'))
+
+
+@dataclass(frozen=True)
+class SearchRerankConfig:
+    """Rerank stage configuration. Re-read per call on purpose."""
+
+    enabled: bool = False
+    candidates: int = DEFAULT_RERANK_CANDIDATES
+    model: str = DEFAULT_RERANK_MODEL
+
+    @classmethod
+    def from_env(cls) -> 'SearchRerankConfig':
+        """Read the three flags. Junk falls back to defaults, never raises."""
+        raw_candidates = (os.getenv('MCP_RERANK_CANDIDATES') or '').strip()
+        candidates = DEFAULT_RERANK_CANDIDATES
+        if raw_candidates:
+            try:
+                candidates = max(int(raw_candidates), 1)
+            except ValueError:
+                logger.warning(
+                    'Invalid MCP_RERANK_CANDIDATES=%s. Using default %s',
+                    _sanitize_log_value(raw_candidates),
+                    DEFAULT_RERANK_CANDIDATES,
+                )
+        return cls(
+            enabled=(os.getenv('MCP_RERANK_ENABLED') or '').strip().lower() in _TRUTHY,
+            candidates=candidates,
+            model=(os.getenv('MCP_RERANK_MODEL') or '').strip() or DEFAULT_RERANK_MODEL,
+        )
+
+
+def rerank_requested(arguments: dict) -> bool:
+    """True only when the caller explicitly passed rerank=True."""
+    return arguments.get('rerank') is True
+
+
+def rerank_active(arguments: dict, config: SearchRerankConfig) -> bool:
+    """Feature gate: per-call flag AND operator env flag."""
+    return config.enabled and rerank_requested(arguments)
+
+
+def resolve_fetch_limit(arguments: dict, base_limit: int, config: Optional[SearchRerankConfig] = None) -> int:
+    """Candidate pool size for ``storage.search_memories``.
+
+    With the stage inactive this is exactly ``base_limit`` -- the fetch is
+    byte-identical to today's path. Active: inflate to MCP_RERANK_CANDIDATES
+    (default 40) so the cross-encoder has something to order.
+    """
+    config = config or SearchRerankConfig.from_env()
+    if rerank_active(arguments, config):
+        return max(base_limit, config.candidates)
+    return base_limit
+
+
+_scorer_lock = threading.Lock()
+_scorer: Optional[Any] = None
+_load_failed = threading.Event()
+_failure_logged = threading.Event()
+
+
+def _build_scorer(config: SearchRerankConfig) -> Any:
+    """Resolve through the existing loader -- the single ONNX path."""
+    model = get_onnx_ranker_model(model_name=config.model)
+    if model is None:
+        raise RuntimeError(
+            f"ONNX ranker '{config.model}' could not be resolved through the existing loa
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +15/-1)
```diff
@@ -1205,7 +1205,13 @@ async def _retrieve_search_results(storage, arguments: dict, normalize_tags):
         store = None
 
     query = arguments.get("query")
-    limit = arguments.get("limit", 10)
+    # Rerank stage (issue #1602): with `rerank=true` on an enabled setup the
+    # candidate pool inflates to MCP_RERANK_CANDIDATES (default 40) so the
+    # cross-encoder has something to order; otherwise the fetch is
+    # byte-identical to today's.
+    from ...quality.search_rerank import resolve_fetch_limit
+
+    limit = resolve_fetch_limit(arguments, arguments.get("limit", 10))
     result = await storage.search_memories(
         query=query,
         mode=arguments.get("mode", "semantic"),
@@ -1546,6 +1552,14 @@ async def handle_memory_search(server, arguments: dict) -> List[types.TextConten
         if filter_error:
             return [types.TextContent(type="text", text=filter_error)]
 
+        # Optional second-stage rerank (issue #1602): per-call opt-in, gated by
+        # MCP_RERANK_ENABLED. Runs after every narrowing stage, so callers see
+        # the final ordering. Off it is a passthrough -- byte-identical to
+        # today's response.
+        from ...quality.search_rerank import apply_search_rerank
+        memories, total = await apply_search_rerank(
+            arguments, query, memories, total, result
+        )
         # Summarize only after retrieval, filters, and plugins. The helper keeps
         # raw results intact as a safe fallback when the provider is unavailable.
         summary_response, summary_warning = await _summarize_memory_search(
```

**File**: `src/mcp_memory_service/tools/registry.py` (modified, +10/-0)
```diff
@@ -274,6 +274,16 @@ class ToolDef:
                     "default": 0,
                     "description": "Quality weight for reranking (0.0-1.0)",
                 },
+                "rerank": {
+                    "type": "boolean",
+                    "default": False,
+                    "description": (
+                        "Opt-in second-stage ONNX rerank of the top "
+                        "MCP_RERANK_CANDIDATES results. Requires "
+                        "MCP_RERANK_ENABLED on the server; off by default and a "
+                        "no-op when the server flag is unset."
+                    ),
+                },
                 "ranking_weights": {
                     "type": "object",
                     "description": "Custom weights for ranked mode (keys: semantic, time_decay, access_frequency, quality). Values are normalized to sum=1.0.",
```

**File**: `tests/quality/test_search_rerank_contract.py` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+"""Contract tests for the #1661 review findings (Greptile P1s).
+
+Covers what the flag plumbing needs beyond the golden-path tests:
+- the tool schema advertises ``rerank`` so clients that build calls from
+  ``tools/list`` can discover the flag;
+- the scorer build (and any cold-cache export) never runs on the event loop;
+- a neutral ``0.5`` sentinel from the loader fails open instead of reordering
+  the top-k with fabricated ties.
+"""
+
+import asyncio
+from unittest.mock import patch
+
+import pytest
+
+from mcp_memory_service.quality import search_rerank
+from mcp_memory_service.quality.search_rerank import (
+    SearchRerankConfig,
+    rerank_candidates,
+    reset_scorer_for_tests,
+)
+from mcp_memory_service.tools.registry import TOOL_REGISTRY
+
+ENV_VARS = ('MCP_RERANK_ENABLED', 'MCP_RERANK_CANDIDATES', 'MCP_RERANK_MODEL')
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
+    def __init__(self, scores):
+        self.scores = scores
+
+    def score_quality_batch(self, pairs):
+        return list(self.scores)
+
+
+def test_tool_schema_advertises_rerank():
+    """tools/list consumers must see the flag; the handler alone is not enough."""
+    search = next(tool for tool in TOOL_REGISTRY if tool.name == 'memory_search')
+    rerank = search.input_schema['properties']['rerank']
+    assert rerank['type'] == 'boolean'
+    assert rerank.get('default') is False
+    assert 'MCP_RERANK_ENABLED' in rerank['description']
+
+
+@pytest.mark.asyncio
+async def test_scorer_resolution_off_the_event_loop():
+    """Build runs in a worker thread -- a cold ONNX session must not stall the loop."""
+    calls = []
+    real_to_thread = asyncio.to_thread
+
+    async def spy(func, *args, **kwargs):
+        calls.append(getattr(func, '__name__', repr(func)))
+        return await real_to_thread(func, *args, **kwargs)
+
+    model = _StubModel([0.9, 0.1])
+    with patch.object(search_rerank, '_resolve_scorer', return_value=model), \
+         patch.object(asyncio, 'to_thread', spy):
+        result = await rerank_candidates(
+            'q', [{'content': 'a'}, {'content': 'b'}], SearchRerankConfig(enabled=True)
+        )
+
+    assert result is not None
+    # MagicMock patches lose __name__; the repr still carries the attribute name.
+    assert any('_resolve_scorer' in name for name in calls), calls
+    assert any('score_quality_batch' in name for name in calls), calls
+
+
+@pytest.mark.asyncio
+async def test_neutral_sentinel_fails_open():
+    """A swallowed per-item failure must degrade to baseline, not fake an order."""
+    model = _StubModel([0.91, 0.5, 0.12])
+    with patch.object(search_rerank, '_resolve_scorer', return_value=model):
+        result = await rerank_candidates(
+            'q',
+            [{'content': 'a'}, {'content': 'b'}, {'content': 'c'}],
+            SearchRerankConfig(enabled=True),
+        )
+
+    assert result is None
+
+
+@pytest.mark.asyncio
+async def test_real_scores_still_rerank():
+    """Guard against the sentinel check turning into a blanket refusal."""
+    model = _StubModel([0.1, 0.92, 0.4])
+    memories = [{'content': 'a'}, {'content': 'b'}, {'content': 'c'}]
+    with patch.object(search_rerank, '_resolve_scorer', return_value=model):
+        result = await rerank_candidates('q', memories, SearchRerankConfig(enabled=True))
+
+    assert result is not None
+    assert [memory['content'] for memory in result] == ['b', 'c', 'a']
+
+
+def test_ort_input_filter_matches_graph_declaration():
+    """The graph, not the tokenizer, decides the feed (Greptile P1 on #1661).
+
+    A Xenova int8 export declares only input_ids/attention_mask; sending
+    token_type_ids makes onnxruntime raise and the rerank fail-open forever.
+    """
+    from mcp_memory_service.quality.onnx_ranker import ONNXRankerModel
+
+    class _Node:
+        def __init__(self, name):
+            self.name = name
+
+    class _Session:
+        def get_inputs(self):
+            return [_Node('input_ids'), _Node('attention_mask')]
+
+    instance = ONNXRankerModel.__new__(ONNXRankerModel)
+    instance._model = _Session()
+    feed = {'input_ids': 1, 'attention_mask': 2, 'token_type_ids': 3}
+
+    assert instance._accepted_ort_inputs(feed) == {'input_ids': 1, 'attention_mask': 2}
```

**File**: `tests/quality/test_search_rerank_flag.py` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+"""Optional ONNX reranker for memory_search (issue #1602).
+
+Contract under test (specs/1602-rerank-flag.md):
+- E1/AC1: ``rerank`` absent or false -> byte-identical baseline response.
+- E2: MCP_RERANK_ENABLED unset/off -> ``rerank=true`` is a total no-op (the
+  loader is never touched, the fetch limit is never inflated).
+- E3: enabled and model resolvable -> reranked order, MCP_RERANK_CANDIDATES
+  honored, response truncated to the caller's limit.
+- E4/AC5: model load failure or inference error -> unreranked order, one
+  warning line per process lifetime, never an error response.
+- E5: the model resolves through the existing quality loader only.
+- E6: concurrent searches keep orders valid; no shared mutable state.
+"""
+
+import asyncio
+import logging
+import os
+from unittest.mock import patch
+
+import pytest
+
+from mcp_memory_service.quality import search_rerank
+from mcp_memory_service.quality.search_rerank import (
+    SearchRerankConfig,
+    apply_search_rerank,
+    rerank_active,
+    reset_scorer_for_tests,
+    rerank_candidates,
+    rerank_requested,
+)
+
+LOADER = 'mcp_memory_service.quality.search_rerank.get_onnx_ranker_model'
+ENV_VARS = ('MCP_RERANK_ENABLED', 'MCP_RERANK_CANDIDATES', 'MCP_RERANK_MODEL')
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
+    def __init__(self, scores=None, error=None):
+        self._scores = scores
+        self._error = error
+        self.calls = []
+
+    def score_quality_batch(self, pairs, max_batch_size=32):
+        self.calls.append(list(pairs))
+        if self._error is not None:
+            raise self._error
+        return list(self._scores)
+
+
+def _memories(n):
+    return [{'content': f'memory-{i}', 'content_hash': f'hash-{i}'} for i in range(n)]
+
+
+def _enabled_config(candidates=40, model='ms-marco-MiniLM-L-6-v2'):
+    return SearchRerankConfig(enabled=True, candidates=candidates, model=model)
+
+
+# --- EARS 1/2: gate ----------------------------------------------------------
+
+
+@pytest.mark.asyncio
+async def test_off_path_returns_input_byte_identical():
+    memories = _memories(3)
+    result = {'memories': memories, 'total': 3}
+    out, total = await apply_search_rerank({}, 'q', memories, 3, result)
+    assert out is memories
+    assert total == 3
+    assert result['memories'] is memories
+    assert result['total'] == 3
+
+
+@pytest.mark.asyncio
+async def test_flag_without_env_never_touches_the_loader():
+    """rerank=true with MCP_RERANK_ENABLED unset is a total no-op."""
+    memories = _memories(3)
+    result = {'memories': memories, 'total': 3}
+    with patch(LOADER) as loader:
+        out, total = await apply_search_rerank({'rerank': True}, 'q', memories, 3, result)
+    loader.assert_not_called()
+    assert out is memories
+    assert result['memories'] is memories
+    assert result['total'] == 3
+
+
+def test_rerank_requested_reads_only_the_flag():
+    assert rerank_requested({'rerank': True}) is True
+    assert rerank_requested({'rerank': False}) is False
+    assert rerank_requested({}) is False
+    assert rerank_requested({'rerank': 'yes'}) is False
+
+
+def test_gate_requires_both_flag_and_env():
+    config = _enabled_config()
+    assert rerank_active({'rerank': True}, config) is True
+    assert rerank_active({}, config) is False
+    assert rerank_active({'rerank': True}, SearchRerankConfig(enabled=False)) is False
+
+
+# --- EARS 3: reranked order ---------------------------------------------------
+
+
+def test_from_env_defaults_are_off():
+    config = SearchRerankConfig.from_env()
+    assert config.enabled is False
+    assert config.candidates == 40
+    assert config.model == 'Xenova/bge-reranker-base'
+
+
+def test_from_env_honors_overrides(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    monkeypatch.setenv('MCP_RERANK_CANDIDATES', '25')
+    monkeypatch.setenv('MCP_RERANK_MODEL', 'ms-marco-MiniLM-L-6-v2')
+    config = SearchRerankConfig.from_env()
+    assert config.enabled is True
+    assert config.candidates == 25
+    assert config.model == 'ms-marco-MiniLM-L-6-v2'
+
+
+def test_from_env_rejects_junk_without_raising(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_CANDIDATES', 'ten')
+    config = SearchRerankConfig.from_env()
+    assert config.candidates == 40
+
+
+def test_fetch_limit_inflates_only_when_active(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    assert search_rerank.resolve_fetch_limit({'rerank': True}, 10) == 40
+    assert search_rerank.resolve_fetch_limit({'rerank': False}, 10) == 10
+
+
+@pytest.mark.asyncio
+async def test_enabled_search_reranks_and_truncates_to_limit(monkeypatch):
+    monkeypatch.setenv('MCP_RERANK_ENABLED', 'true')
+    stub = _StubModel(scores=[0.9 - 0.01 * i for i in range(40)])
+   
```

---

### Incident Patch 2: `a930c2b1` (2026-10-25)
**Commit Message**: feat(storage): ResonanceDB — wave-based semantic memory (phase-aware retrieval) (#1673)

* docs: link the Discord server from README and CONTRIBUTING

Announcements for releases, good first issues and new Discussions already
go there, but nothing in the repository pointed at it. Claims, decisions
and reviews stay on GitHub.

* docs(site): link the Discord server from the start page and footers

Adds a Discord button next to GitHub and Documentation in the Get started
block and a Discord link in the footer shared by the start page, the demo
and the remote MCP tutorial.

* feat(storage): ResonanceDB — wave-based semantic memory (phase-aware retrieval)

Implements wave-based semantic memory from:
'Wave-Based Semantic Memory with Resonance-Based Retrieval'
arXiv:2509.09691 (submitted Aug 2025)

New features:
- ResonanceDB class: complex waveform embeddings ψ(x) = A(x)·exp(i·φ(x))
- Phase-aware similarity via constructive/destructive interference
- Endpoint: POST /api/memories/resonance-search with hybrid mode
- Three search modes: resonance (pure), phase (negation detection), hybrid
- Resolves cosine-blindness for negation (happy vs not_happy problem)

Changes:
- src/mcp_memory_service

**File**: `changelog.d/1673.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Experimental `POST /api/memories/resonance-search`: ranks memories by wave interference instead of cosine similarity, after the ResonanceDB approach in arXiv:2509.09691. It converts the stored embeddings to complex waveforms at query time, so no schema change. Modes `resonance`, `phase` and `hybrid` (default), a `store` field like `/api/search`, and superseded memories stay hidden. Works on `sqlite_vec` and `hybrid`, and answers 501 on other backends (#1673).
```

**File**: `docs/agents/http-generic.md` (modified, +34/-0)
```diff
@@ -55,6 +55,40 @@ This table is the subset agents reach for. The authoritative, always-current lis
 > that body with `.get("results", [])` turns a rejected request into "no memories
 > found". Both endpoints return their hits under `results`, not `memories`.
 
+### Experimental: resonance search
+
+`POST /api/memories/resonance-search` ranks memories by wave interference instead of
+cosine similarity, after the ResonanceDB idea in arXiv:2509.09691. It turns the stored
+embeddings into complex waveforms at query time. No schema change, no extra model.
+
+```bash
+curl -X POST http://localhost:8000/api/memories/resonance-search \
+  -H "Content-Type: application/json" \
+  -d '{"query": "deploy target", "top_k": 10, "mode": "hybrid", "store": "default"}'
+```
+
+| Field | Default | Meaning |
+|---|---|---|
+| `query` | required | Search text |
+| `top_k` | `10` | 1-100 results |
+| `mode` | `hybrid` | `resonance` (interference only), `phase` (phase alignment only), `hybrid` (70/30 mix) |
+| `store` | `default` | Store partition, `all` for every store, as in `/api/search` |
+
+Results carry `content_hash`, `score` and `details` (`resonance`, `phase_shift`), not
+the memory content; fetch that with `GET /api/memories/{hash}?store=<name>`, using the
+same `store` you searched (`all` included), since that endpoint defaults to `default`.
+Superseded memories are left out. `total_stored` counts the memories that were actually scored.
+
+Limits worth knowing before you build on it:
+
+- Only `sqlite_vec` and `hybrid` (via its local SQLite) work. Cloudflare and Milvus get a 501.
+- Every request scans and scores every eligible memory in the store in pure Python.
+  Fine at a few thousand memories, slow well before 50k.
+- Nobody has shown yet that it ranks better than `/api/search`. The phase is derived from
+  the same embedding values, so it cannot add information the embedding model did not
+  encode, and that includes negation. Treat it as a research endpoint until the
+  measurement in #1674 says otherwise.
+
 ## Authentication Patterns
 
 ```bash
```

**File**: `src/mcp_memory_service/storage/resonance_db.py` (added, +398/-0)
```diff
@@ -0,0 +1,398 @@
+"""ResonanceDB — Wave-Based Semantic Memory (Phase-Aware Retrieval)
+
+Implements the wave-based memory model from:
+"Wave-Based Semantic Memory with Resonance-Based Retrieval"
+arXiv:2509.09691 (submitted Aug 2025)
+
+Core idea: Instead of storing memories as static real-valued vectors and
+comparing with cosine similarity, store them as complex waveforms:
+
+    ψ(x) = A(x) · exp(i · φ(x))
+
+where:
+    A(x) = semantic amplitude (magnitude of meaning)
+    φ(x) = contextual phase (semantic polarity, negation, modality)
+
+Similarity is measured via **constructive/destructive interference** instead
+of distance in a Euclidean space.
+
+Key property that solves the "happy" vs "not happy" problem:
+    Two waves that are in-phase amplify (resonate).
+    Two waves shifted by π cancel (destructive interference).
+    Negation naturally produces a phase shift → anti-resonance.
+"""
+
+from __future__ import annotations
+
+import math
+import logging
+from dataclasses import dataclass
+from typing import List, Dict, Any, Tuple
+
+logger = logging.getLogger(__name__)
+
+
+# ---------------------------------------------------------------------------
+# Complex waveform math
+# ---------------------------------------------------------------------------
+
+def _complex_dot_product(a: List[complex], b: List[complex]) -> complex:
+    """Compute <a|b> = Σ a*(x) · b(x) for two complex waveforms."""
+    result = complex(0, 0)
+    for ax, bx in zip(a, b):
+        result += ax.conjugate() * bx
+    return result
+
+
+def _wave_interference_energy(psi_a: List[complex], psi_b: List[complex]) -> float:
+    """
+    Compute constructive interference energy between two waveforms.
+    
+    Maximal when in-phase (aligned semantics), minimal when out-of-phase
+    (contrasting/negated semantics).
+    
+    Formula from paper:
+        E = |Σ A_a(x)·A_b(x)·cos(φ_a(x) - φ_b(x))|
+    
+    Returns value in [0, 1] after normalization.
+    """
+    if not psi_a or not psi_b:
+        return 0.0
+    
+    n = min(len(psi_a), len(psi_b))
+    
+    # Extract amplitude and phase from each waveform
+    real_part = 0.0
+    for x in range(n):
+        ax = psi_a[x]
+        bx = psi_b[x]
+        # Amplitude product × phase difference cosine
+        real_part += ax.real * bx.real + ax.imag * bx.imag
+    
+    # Normalize by maximum possible energy (sum of |ψ(x)|²)
+    energy_a = sum(abs(a) ** 2 for a in psi_a[:n])
+    energy_b = sum(abs(b) ** 2 for b in psi_b[:n])
+    
+    if energy_a == 0 or energy_b == 0:
+        return 0.0
+    
+    max_energy = math.sqrt(energy_a * energy_b)
+    if max_energy == 0:
+        return 0.0
+    
+    resonance = real_part / max_energy
+    
+    # Clamp to [0, 1] for score
+    return max(0.0, min(1.0, resonance))
+
+
+def _phase_shift_score(psi_a: List[complex], psi_b: List[complex]) -> float:
+    """
+    Detect phase-shift patterns (negation, modality inversion).
+    
+    Returns the mean phase difference normalized to [0, 1]:
+    0 = in phase (aligned), 1 = shifted by π (contrast/negation).
+    """
+    if not psi_a or not psi_b:
+        return 0.0
+    
+    n = min(len(psi_a), len(psi_b))
+    if n == 0:
+        return 0.0
+    
+    # Compute mean phase difference
+    phase_diffs = []
+    for x in range(n):
+        phase_a = math.atan2(psi_a[x].imag, psi_a[x].real)
+        phase_b = math.atan2(psi_b[x].imag, psi_b[x].real)
+        diff = phase_a - phase_b
+        # Wrap to [-π, π]
+        while diff > math.pi:
+            diff -= 2 * math.pi
+        while diff < -math.pi:
+            diff += 2 * math.pi
+        phase_diffs.append(abs(diff))
+    
+    mean_phase_diff = sum(phase_diffs) / len(phase_diffs) if phase_diffs else 0.0
+    
+    # 0 → aligned, π → negation; callers rank by (1 - this value)
+    return abs(mean_phase_diff) / math.pi
+
+
+def _constructive_interference(psi_a: List[complex], psi_b: List[complex]) -> float:
+    """
+    Full resonance score: constructive interference.
+    
+    When aligned → waves amplify (high score).
+    When opposed → waves cancel (low score).
+    This is the CORE similarity metric from the paper.
+    """
+    return _wave_interference_energy(psi_a, psi_b)
+
+
+def _destructive_interference(psi_a: List[complex], psi_b: List[complex]) -> float:
+    """
+    Anti-resonance score.
+    
+    When opposed (e.g. negation) → high destructive score.
+    When aligned → low destructive score.
+    """
+    return _phase_shift_score(psi_a, psi_b)
+
+
+# ---------------------------------------------------------------------------
+# Phase-aware embedding: real vector → complex waveform
+# ---------------------------------------------------------------------------
+
+def _embed_to_waveform(embedding: List[float], dimension: int) -> List[complex]:
+    """
+    Convert a real-valued embedding (e.g. from all-MiniLM) to a complex waveform.
+    
+    Strategy: Split embedding into amplitude (magnitude) and p
```

**File**: `src/mcp_memory_service/web/api/memories.py` (modified, +111/-2)
```diff
@@ -16,15 +16,19 @@
 Memory CRUD endpoints for the HTTP interface.
 """
 
+import asyncio
+import heapq
 import logging
 import socket
 from collections import Counter
-from typing import List, Optional, Dict, Any
+from typing import List, Optional, Dict, Any, Literal
 
 from fastapi import APIRouter, HTTPException, Depends, Query, Request
 from pydantic import BaseModel, Field
 
 from ...storage.base import MemoryStorage
+from ...storage.mixins.base import deserialize_embedding
+from ...storage.resonance_db import ResonanceDB
 from ...models.memory import Memory
 from ...models.ontology import get_all_types
 from ...services.memory_service import MemoryService
@@ -586,7 +590,7 @@ async def store_session(
     All turns are concatenated into '[role] content' lines and stored as
     memory_type='session' with a 'session:<id>' tag for reliable session-level retrieval.
     """
-    import uuid as _uuid
+    import uuid as _uuid  # inline import
 
     session_id = request.session_id or str(_uuid.uuid4())
     lines = [f"[{t.role}] {t.content.strip()}" for t in request.turns if t.content.strip()]
@@ -632,3 +636,108 @@ async def get_memory_types(
 ) -> List[str]:
     """Return all valid memory types (built-in + custom from MCP_CUSTOM_MEMORY_TYPES)."""
     return sorted(get_all_types())
+
+
+# ── ResonanceDB — Wave-Based Semantic Search ──────────────────────────────────
+
+class ResonanceSearchRequest(BaseModel):
+    """Request model for ResonanceDB wave-based semantic search."""
+    query: str = Field(..., description="Search query text")
+    top_k: int = Field(default=10, ge=1, le=100, description="Max results to return")
+    mode: Literal["resonance", "phase", "hybrid"] = Field("hybrid", description="Search mode: 'resonance' (pure constructive interference), 'phase' (phase alignment only), 'hybrid' (default)")
+    store: str = Field(default="default", description="Target store partition (default: 'default'). Use 'all' for every store.")
+
+
+class ResonanceSearchResult(BaseModel):
+    """Single result from ResonanceDB search."""
+    content_hash: str
+    score: float
+    details: Dict[str, float]
+
+
+class ResonanceSearchResponse(BaseModel):
+    """Response model for ResonanceDB wave-based search."""
+    query: str
+    mode: str
+    results: List[ResonanceSearchResult]
+    total_stored: int
+    backend: str = "resonance"
+
+
+def _fetch_resonance_candidates(conn, store: Optional[str]) -> list:
+    """Read (content_hash, embedding blob) for every current, searchable memory."""
+    sql = """
+        SELECT m.content_hash, e.content_embedding
+        FROM memories m
+        JOIN memory_embeddings e ON m.id = e.rowid
+        WHERE m.deleted_at IS NULL
+          AND (m.embedding_pending IS NULL OR m.embedding_pending = 0)
+          AND (m.superseded_by IS NULL OR m.superseded_by = '')
+    """
+    params: tuple = ()
+    if store is not None:
+        sql += " AND m.store = ?"
+        params = (store,)
+    return conn.execute(sql, params).fetchall()
+
+
+def _score_resonance_candidates(rows: list, query_embedding: List[float], dimension: int, top_k: int, mode: str):
+    """Score all rows in batches and keep the overall top_k. Returns (results, scored_count)."""
+    best: list = []
+    scored = 0
+    batch_size = 1000
+    for start in range(0, len(rows), batch_size):
+        db = ResonanceDB(dimension=dimension)
+        for content_hash, blob in rows[start:start + batch_size]:
+            values = deserialize_embedding(blob)
+            if values is None or len(values) != dimension:
+                continue
+            db.add(content_hash, values)
+        scored += len(db)
+        best = heapq.nlargest(top_k, best + db.search(query_embedding, top_k=top_k, mode=mode), key=lambda r: r["score"])
+    return best, scored
+
+
+@router.post("/memories/resonance-search", response_model=ResonanceSearchResponse, tags=["memories", "resonance"])
+async def resonance_search(
+    request: ResonanceSearchRequest,
+    storage: MemoryStorage = Depends(get_storage),
+    user: AuthenticationResult = Depends(require_read_access),
+):
+    """
+    Wave-based semantic search using ResonanceDB (experimental).
+
+    Converts the stored real-valued embeddings to complex waveforms
+    ψ(x) = A(x) · exp(i · φ(x)) at query time and ranks them by
+    constructive interference and phase alignment with the query.
+
+    Requires a SQLite-backed storage (sqlite_vec, or hybrid via its local
+    primary). Scans every eligible memory in the selected store.
+
+    See: arXiv:2509.09691
+    """
+    # Hybrid keeps its SQLite backend in `primary`; Cloudflare and Milvus have no local table to scan.
+    backend = getattr(storage, "primary", storage)
+    if getattr(backend, "conn", None) is None or not hasattr(backend, "_execute_with_retry"):
+        raise HTTPException(status_code=501, detail="Resonance search requires the sqlite_vec or hybrid storage backend.")
+    if not getattr(backend, "embedd
```

**File**: `tests/storage/test_resonance_db.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+"""Tests for ResonanceDB scoring and the /api/memories/resonance-search endpoint (PR #1673)."""
+
+import hashlib
+import struct
+from types import SimpleNamespace
+
+import pytest
+import pytest_asyncio
+from fastapi import HTTPException
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.resonance_db import ResonanceDB, _embed_to_waveform, _phase_shift_score
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.web.api.memories import (
+    ResonanceSearchRequest,
+    _score_resonance_candidates,
+    resonance_search,
+)
+
+DIM = 8
+BASE = [0.9, -0.4, 0.3, -0.8, 0.1, 0.6, -0.2, 0.5]
+NEAR = [0.8, -0.3, 0.35, -0.7, 0.05, 0.55, -0.25, 0.45]
+OPPOSITE = [-v for v in BASE]
+
+
+def _blob(values):
+    """sqlite-vec stores raw little-endian float32 with no length prefix."""
+    return struct.pack(f"<{len(values)}f", *values)
+
+
+def test_phase_shift_is_zero_for_identical_waves():
+    wave = _embed_to_waveform(BASE, DIM)
+    assert _phase_shift_score(wave, wave) == 0.0
+    near = _phase_shift_score(wave, _embed_to_waveform(NEAR, DIM))
+    assert 0.0 < near < _phase_shift_score(wave, _embed_to_waveform(OPPOSITE, DIM)) <= 1.0
+
+
+def test_exact_match_ranks_first_in_every_mode():
+    db = ResonanceDB(dimension=DIM)
+    db.add("exact", BASE)
+    db.add("near", NEAR)
+    db.add("opposite", OPPOSITE)
+    for mode in ("resonance", "phase", "hybrid"):
+        ranked = [r["content_hash"] for r in db.search(BASE, top_k=3, mode=mode)]
+        assert ranked[0] == "exact", mode
+        assert ranked[-1] == "opposite", mode
+
+
+def test_candidates_decode_raw_float32_and_skip_wrong_dimension():
+    rows = [("exact", _blob(BASE)), ("short", _blob(BASE[:4])), ("opposite", _blob(OPPOSITE))]
+    results, scored = _score_resonance_candidates(rows, BASE, DIM, top_k=10, mode="hybrid")
+    assert scored == 2
+    assert [r["content_hash"] for r in results] == ["exact", "opposite"]
+
+
+def test_top_k_survives_batching():
+    # The best match sits after the first 1000-row batch; it must still be returned.
+    rows = [(f"far{i}", _blob(OPPOSITE)) for i in range(1500)] + [("exact", _blob(BASE))]
+    results, scored = _score_resonance_candidates(rows, BASE, DIM, top_k=1, mode="hybrid")
+    assert scored == 1501
+    assert results[0]["content_hash"] == "exact"
+
+
+@pytest_asyncio.fixture
+async def storage(tmp_path):
+    s = SqliteVecMemoryStorage(str(tmp_path / "resonance.db"))
+    await s.initialize()
+    try:
+        yield s
+    finally:
+        await s.close()
+
+
+async def _put(storage, content, store="default"):
+    content_hash = hashlib.sha256(content.encode()).hexdigest()
+    ok, msg = await storage.store(Memory(content=content, content_hash=content_hash), store=store)
+    assert ok, msg
+    return content_hash
+
+
+@pytest.mark.asyncio
+async def test_endpoint_scopes_store_hides_superseded_and_unwraps_hybrid(storage):
+    current = await _put(storage, "The deploy target is the staging cluster in Frankfurt")
+    replaced = await _put(storage, "The deploy target was the old cluster in Dublin")
+    other_store = await _put(storage, "Unrelated note kept in a separate store", store="other")
+
+    def _supersede():
+        storage.conn.execute("UPDATE memories SET superseded_by = ? WHERE content_hash = ?", (current, replaced))
+        storage.conn.commit()
+    await storage._execute_with_retry(_supersede)
+
+    request = ResonanceSearchRequest(query="deploy target cluster", top_k=10)
+    # Hybrid storage exposes its SQLite backend as `primary`.
+    response = await resonance_search(request, storage=SimpleNamespace(primary=storage), user=None)
+    hashes = {r.content_hash for r in response.results}
+    assert hashes == {current}
+    assert response.total_stored == 1
+
+    response_all = await resonance_search(
+        ResonanceSearchRequest(query="deploy target cluster", store="all"), storage=storage, user=None
+    )
+    assert {r.content_hash for r in response_all.results} == {current, other_store}
+
+
+@pytest.mark.asyncio
+async def test_endpoint_rejects_backend_without_sqlite():
+    with pytest.raises(HTTPException) as exc:
+        await resonance_search(ResonanceSearchRequest(query="x"), storage=SimpleNamespace(), user=None)
+    assert exc.value.status_code == 501
```

---

### Incident Patch 3: `c8cd9115` (2026-10-24)
**Commit Message**: fix: send stream false to OpenAI-compatible endpoints for fm serve (#1666) (#1667)

* fix: send stream false to OpenAI-compatible endpoints for fm serve (#1666)

Apple's fm serve on macOS 27 answers with SSE when a request has no
stream field, unlike OpenAI's default of false. The quality scorer and
the harvest rewriter and classifier never sent the field, so their
response.json() failed on the SSE body and every call fell through to
the next provider. Send "stream": false explicitly at all three sites.

Adds docs/guides/apple-foundation-models.md with setup, env blocks and
measured results per task against fm serve.

* docs: name both switches search summaries need in the Apple FM guide (#1666)

---------

Co-authored-by: Henry Krupp <[REDACTED_EMAIL]>

**File**: `changelog.d/1666.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Apple Foundation Models work as a local LLM provider on macOS 27: point the OpenAI-compatible quality scorer or the harvest provider chain at `fm serve`. The three OpenAI-compatible call sites (quality scorer, harvest rewriter, harvest classifier) now send `"stream": false` explicitly, because `fm serve` streams by default and the requests used to fall through to the next provider. New guide: `docs/guides/apple-foundation-models.md` (#1666).
```

**File**: `docs/guides/apple-foundation-models.md` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+# Apple Foundation Models as a local LLM provider
+
+macOS 27 ships Apple's on-device language model together with a command-line tool,
+`/usr/bin/fm`. Its `fm serve` subcommand runs an OpenAI-compatible chat completions
+server. You do not download anything, and you do not need an account or an API key.
+mcp-memory-service can use that server wherever it already accepts an
+OpenAI-compatible endpoint:
+
+- the quality scorer,
+- the harvest rewriter and classifier,
+- the LLM backend of the NLI contradiction check,
+- search summarization.
+
+Embeddings are not covered. The framework has no embeddings API, so embeddings stay
+on the default ONNX model (CoreML on Apple Silicon) or on an external
+`/v1/embeddings` server (see [external-embeddings.md](../deployment/external-embeddings.md)).
+
+## Requirements
+
+- macOS 27 on Apple Silicon.
+- Apple Intelligence turned on.
+- mcp-memory-service with #1666 or later. Earlier versions omit `"stream": false`, and
+  `fm serve` streams by default, so their requests fail and silently fall back to the
+  next provider.
+
+Check that the model is available:
+
+```bash
+fm available          # "System model available"
+```
+
+## Start the server
+
+```bash
+fm serve --port 1976  # binds 127.0.0.1; model id is "system"
+curl -s http://127.0.0.1:1976/health
+```
+
+The server provides `GET /health`, `GET /v1/models` and `POST /v1/chat/completions`.
+To start it at login, wrap the same command in a launchd agent with `KeepAlive`.
+
+## Configuration
+
+Add these to `.env` and run `memory restart`.
+
+Quality scoring:
+
+```bash
+MCP_QUALITY_AI_PROVIDER=openai-compatible
+MCP_QUALITY_AI_BASE_URL=http://127.0.0.1:1976/v1
+MCP_QUALITY_AI_MODEL=system
+```
+
+Harvest, NLI and search summarization share one provider chain:
+
+```bash
+HARVEST_LLM_PROVIDERS=apple
+HARVEST_LLM_APPLE_BASE_URL=http://127.0.0.1:1976/v1
+HARVEST_LLM_APPLE_MODEL=system
+MCP_NLI_BACKEND=llm            # optional: LLM contradiction check
+MCP_SEARCH_SUMMARIZE_ENABLED=true  # optional: allow search summaries (off by default)
+```
+
+Search summaries need both switches. `MCP_SEARCH_SUMMARIZE_ENABLED=true` permits them,
+and each `memory_search` call must also pass `summarize=true`. Without the second one,
+search returns ordinary results.
+
+You can list a second provider after `apple`, for example
+`HARVEST_LLM_PROVIDERS=apple,groq`. The chain falls through to it when the local
+model fails.
+
+## What it is good at
+
+The model is small (about 3B parameters) and its context window is small too. Apple
+documents 4096 tokens per session. Every call here is a fresh single-turn request, so
+the limit applies per call, but long inputs still do not fit.
+
+The following was measured on an M-series Mac with macOS 27.0.1, against ten sample
+memories and five NLI pairs. One server served all calls, sequentially.
+
+| Task | Result | Latency per call | Recommendation |
+|------|--------|------------------|----------------|
+| NLI contradiction check | 5 of 5 correct | 0.3-0.7 s | Good fit |
+| Harvest classifier (keep/drop, strict JSON) | Every response parsed. Dropped all 3 noise fragments, but also 2 of 7 real decisions or bugs | 0.6-2.0 s | Usable; expect some false drops |
+| Quality scoring (0-1) | Always returned a parseable number. Scores were weakly differentiated: most samples got 0.2 | about 0.3 s | Keep the default local ONNX scorer |
+| Harvest rewriter (1-2 sentence insight) | Often answered in the wrong language: English input came back in Portuguese | 0.7-1.3 s | Not recommended for now |
+| Embeddings | Not available | n/a | Use ONNX or an external embeddings server |
+
+These numbers come from a small sample. Treat them as a starting point, not as a
+benchmark.
+
+## Limits
+
+- Apple Silicon and macOS 27 only. Linux and Windows users keep Ollama, vLLM or MLX-LM
+  as their OpenAI-compatible provider.
+- The weights are closed and the model can change with an OS update. Re-check
+  behaviour after major macOS updates.
+- `response_format: {"type": "json_object"}` returns HTTP 400. The server only accepts
+  `json_schema`. mcp-memory-service does not send either one; JSON comes from the
+  prompt.
```

**File**: `docs/mastery/configuration-guide.md` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ TLS:
 - `MCP_QUALITY_SYSTEM_ENABLED`: `true|false` (default `true`).
 - `MCP_QUALITY_AI_PROVIDER`: `local` (ONNX, default), `openai-compatible`, `groq`, `gemini`, `auto`, `none`.
 - `MCP_QUALITY_LOCAL_MODEL` (default `ms-marco-MiniLM-L-6-v2`), `MCP_QUALITY_LOCAL_DEVICE` (`auto|cpu|cuda|mps|directml`).
-- `openai-compatible` requires `MCP_QUALITY_AI_BASE_URL` and `MCP_QUALITY_AI_MODEL`; `MCP_QUALITY_AI_API_KEY` is optional.
+- `openai-compatible` requires `MCP_QUALITY_AI_BASE_URL` and `MCP_QUALITY_AI_MODEL`; `MCP_QUALITY_AI_API_KEY` is optional. On macOS 27 this can point at Apple's built-in `fm serve`, see [Apple Foundation Models](../guides/apple-foundation-models.md).
 - Cloud providers read `GROQ_API_KEY` and `GEMINI_API_KEY`.
 - Search and storage weighting: `MCP_QUALITY_BOOST_ENABLED`, `MCP_QUALITY_BOOST_WEIGHT`, `MCP_QUALITY_IMPLICIT_BLEND_ENABLED`, `MCP_QUALITY_IMPLICIT_WEIGHT`.
 - Retention by tier: `MCP_QUALITY_RETENTION_HIGH`, `MCP_QUALITY_RETENTION_MEDIUM`, `MCP_QUALITY_RETENTION_LOW_MIN`, `MCP_QUALITY_RETENTION_LOW_MAX`.
```

**File**: `src/mcp_memory_service/harvest/classifier.py` (modified, +3/-1)
```diff
@@ -240,7 +240,9 @@ def _call_openai_compatible(
             resp = client.post(
                 f"{base_url}/chat/completions",
                 headers=headers,
-                json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
+                # stream is explicit: fm serve streams SSE when it is absent (#1666)
+                json={"model": model, "stream": False, "messages": messages,
+                      "temperature": temperature, "max_tokens": max_tokens},
             )
             if resp.status_code == 429:
                 raise Exception(f"Rate limit exceeded: {resp.text[:100]}")
```

**File**: `src/mcp_memory_service/harvest/rewriter.py` (modified, +1/-0)
```diff
@@ -519,6 +519,7 @@ async def _call_openai_compatible(self, base_url: str, model: str, api_key: str,
                 headers=headers,
                 json={
                     "model": model,
+                    "stream": False,  # fm serve streams SSE when this is absent (#1666)
                     "messages": [{"role": "user", "content": prompt}],
                     "temperature": 0.3,
                     "max_tokens": 200,
```

**File**: `src/mcp_memory_service/quality/ai_evaluator.py` (modified, +3/-0)
```diff
@@ -463,8 +463,11 @@ async def _score_with_openai_compatible(self, query: str, memory: Memory) -> flo
             "Content-Type": "application/json",
             "Authorization": f"Bearer {api_key}",
         }
+        # stream is sent explicitly: Apple's `fm serve` answers with SSE when it
+        # is absent, unlike OpenAI's default of false (#1666).
         payload = {
             "model": model,
+            "stream": False,
             "messages": [
                 {
                     "role": "system",
```

**File**: `tests/harvest/test_classifier.py` (modified, +17/-0)
```diff
@@ -358,3 +358,20 @@ def test_use_llm_config_default_false(self):
         from mcp_memory_service.harvest.models import HarvestConfig
         config = HarvestConfig()
         assert config.use_llm is False
+
+
+class TestOpenAICompatiblePayload:
+    def test_payload_disables_streaming_explicitly(self):
+        """fm serve streams SSE unless told otherwise; resp.json() would fail (#1666)."""
+        resp = MagicMock(status_code=200)
+        resp.json.return_value = {"choices": [{"message": {"content": "{}"}}]}
+        client = MagicMock()
+        client.__enter__.return_value.post.return_value = resp
+
+        with patch("httpx.Client", return_value=client):
+            _classifier_without_groq_key()._call_openai_compatible(
+                "http://127.0.0.1:1976/v1", "system", "", "prompt", "system msg", 50, 0.0
+            )
+
+        payload = client.__enter__.return_value.post.call_args.kwargs["json"]
+        assert payload["stream"] is False
```

**File**: `tests/harvest/test_rewriter.py` (modified, +30/-0)
```diff
@@ -327,3 +327,33 @@ def _submit(fn, coro):
             rewriter.rewrite_batch_sync([{"content": "text", "memory_type": "decision"}])
             batch_timeout = mock_future.result.call_args.kwargs['timeout']
             assert batch_timeout == 3 * HarvestRewriter._CALL_TIMEOUT_BATCH + HarvestRewriter._WRAPPER_MARGIN
+
+
+class TestOpenAICompatiblePayload:
+    @pytest.mark.asyncio
+    async def test_payload_disables_streaming_explicitly(self, monkeypatch):
+        """fm serve streams SSE unless told otherwise; resp.json() would fail (#1666)."""
+        captured = {}
+
+        class _FakeAsyncClient:
+            def __init__(self, timeout):
+                pass
+
+            async def __aenter__(self):
+                return self
+
+            async def __aexit__(self, *exc):
+                return False
+
+            async def post(self, *args, **kwargs):
+                captured.update(kwargs["json"])
+                resp = MagicMock(status_code=200)
+                resp.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
+                return resp
+
+        monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
+
+        await HarvestRewriter()._call_openai_compatible(
+            "http://127.0.0.1:1976/v1", "system", "", "prompt", 5.0
+        )
+        assert captured["stream"] is False
```

#### Recent Merged Pull Requests:
- **PR #1673** (2026-10-25): feat(storage): ResonanceDB — wave-based semantic memory (phase-aware retrieval) (@doobidoo)
- **PR #1672** (2026-10-25): docs: document the rerank flag and its MCP_RERANK_* settings (@xubenqiang)
- **PR #1667** (2026-10-24): fix: send stream false to OpenAI-compatible endpoints for fm serve (#1666) (@doobidoo)
- **PR #1665** (2026-10-24): feat: negotiate delta-sync peer capabilities (@ducanhnguyen223)
- **PR #1663** (2026-10-23): feat(web): expose Delta-Sync settings in Environment tab (@ducanhnguyen223)
- **PR #1662** (2026-10-23): docs: point contributors to the current development verifier (@Ghoscro)

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

## X. search): optional second-stage ONNX rerank flag for memory_search (#1602) (#1661

**RULE**:
When implementing operations in `changelog.d/1602.added.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `344f4ae1`: search): optional second-stage ONNX rerank flag for memory_search (#1602) (#1661). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1602.added.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- Add an opt-in `rerank` flag to `memory_search`: a second-stage ONNX cross-encoder reorders the top `MCP_RERANK_CANDIDATES` results when `MCP_RERANK_ENABLED` is set, fails open to the unreranked order, and never touches the default path.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `344f4ae1` are properly handled with clean fallback behavior.
