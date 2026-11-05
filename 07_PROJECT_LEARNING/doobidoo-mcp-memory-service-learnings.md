> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `a2ee57d3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T01:47:46.853Z  
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
> **Harvest Timestamp**: 2026-11-05T01:47:46.846Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2082 stars

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
- **Issue #1858** (2026-11-04): **harvest: an older session can evolve a newer memory, because the statement time is never kept**
  *Symptoms*: A harvest over several sessions processes them newest first, and evolution does not compare times. So within one run, a statement from an older session can replace the current version of a memory that a newer session just wrote.  How it happens on `9ad9b7ac`:  1. `TranscriptParser.find_sessions` sorts the session files by mtime, newest first, and returns the first `count` (`harvest/parser.py:190-191`). `harvest_and_store` loops over them in that order (`harvest/harvester.py:211-219`). 2. For every candidate, `_try_evolve` (`harvester.py:307`) retrieves the single most similar memory and, above `similarity_threshold` (0.85), calls `evolve_memory` with the candidate's content. The candidate becomes the new current version. Nothing compares when either statement was made. 3. The time is available but dropped. `ParsedMessage` carries the transcript `timestamp` (`parser.py:22`), but `HarvestCandidate` has no time field (`harvest/models.py:15-25`), `_provenance` records none (`harvester.py:284-305`), and `store_memory` takes no time argument. A harvested memory's `created_at` is the time of the harvest.  Scenario: `memory_harvest` with `{"sessions": 2, "dry_run": false}`. The newer session says "the sync hub runs on port 8020", the older one says "the sync hub runs on port 8010". The newer one is processed first and stored. Then the older one comes along, matches it above 0.85, and evolves it. The current version now says 8010. The same applies to `session_ids` backfills and `force

- **Issue #1852** (2026-11-04): **memory_graph is annotated readOnlyHint although extract_entities writes**
  *Symptoms*: `memory_graph` is annotated `readOnlyHint: True` in `tools/registry.py`, but one of its actions writes: `extract_entities` stores entity links, which is why `tool_requires_write` in `server_impl.py` keeps it out of the read-only exemption (GHSA-2mw6-h564-86wv).  The server side is fine. A token without write scope still cannot run `extract_entities`. The hint itself is wrong, though, and since #1849 the HTTP transport serves it as well as stdio. A client that auto-approves tools marked read-only will run `extract_entities` without asking the user.  The fix is to drop the hint, setting `readOnlyHint` to `False` on `memory_graph`. The annotation is per tool, not per action, so a tool with any writing action cannot claim to be read-only. The action-level write-scope check in `server_impl.py` stays as it is.  For a contributor picking this up:  1. The test goes in `tests/web/api/test_transport_consistency.py` from #1849: assert that no tool whose actions include a write is annotated read-only, on both stdio and HTTP. 2. It must fail on `main` and pass on your branch. Paste both runs into the PR under "How it was verified". 3. Running `bash scripts/pr/pre_pr_check.sh` is welcome but not required from outside.  Comment on this issue to claim it before you start. 

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

### Incident Patch 1: `56ba922e` (2026-11-04)
**Commit Message**: fix(oauth): enforce foreign keys in the SQLite OAuth store (#1862)

* fix(oauth): enforce foreign keys in the SQLite OAuth store

The schema declares ON DELETE CASCADE from authorization codes, access
tokens and refresh tokens to oauth_clients, but the backend never turned
on PRAGMA foreign_keys. Deleting a client left its codes and tokens
behind, and a code or token could be stored for a client that did not
exist.

- Set PRAGMA foreign_keys=ON in _init_db next to the other pragmas.
  close() resets _initialized, so a reconnect applies it again.
- store_client: INSERT OR REPLACE -> INSERT ... ON CONFLICT DO UPDATE.
  REPLACE deletes the existing row first; with enforcement on, that
  delete cascades. authenticate_client re-stores a client to upgrade a
  legacy plaintext secret to a hash, which would have wiped the client's
  codes and tokens, including the one being redeemed.
- Every product write path (authorize POST, authorization_code,
  refresh_token and client_credentials grants) already checks the client
  before storing a code or token. Only test fixtures stored them for
  unregistered clients; those now register the client.
- docs/oauth-storage-backends.md: the foreign-key 

**File**: `changelog.d/1804.fixed.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+- **The SQLite OAuth store never enforced its foreign keys (#1804, timkjr).**
+  The schema declares `ON DELETE CASCADE` from authorization codes, access
+  tokens and refresh tokens to `oauth_clients`, but the backend never turned on
+  `PRAGMA foreign_keys`, so deleting a client left its codes and tokens behind
+  and a code or token could be stored for a client that did not exist. The
+  pragma is now set on the connection. `store_client` switched from
+  `INSERT OR REPLACE` to an upsert: REPLACE deletes the row first, and with
+  enforcement on, that delete would have wiped the client's tokens whenever
+  `authenticate_client` upgraded a legacy plaintext secret to a hash.
```

**File**: `docs/oauth-storage-backends.md` (modified, +3/-1)
```diff
@@ -63,7 +63,9 @@ MCP_OAUTH_SQLITE_PATH=./data/oauth.db
 - WAL (Write-Ahead Logging) mode for concurrent access
 - Atomic `UPDATE WHERE consumed=0` for replay attack prevention
 - Indexes on `expires_at` and `consumed` columns for fast queries
-- Foreign key constraints for referential integrity
+- Foreign keys enforced (`PRAGMA foreign_keys=ON`): a code or token can only be
+  stored for a registered client, and deleting a client deletes its
+  authorization codes, access tokens and refresh tokens
 
 ## Programmatic Usage
 
```

**File**: `src/mcp_memory_service/web/oauth/storage/sqlite.py` (modified, +26/-2)
```diff
@@ -119,7 +119,15 @@ async def _execute(self, query: str, params: tuple = ()):
             Exception: If query execution fails
         """
         conn = await self._get_connection()
-        return await conn.execute(query, params)
+        try:
+            return await conn.execute(query, params)
+        except Exception:
+            # A failed write (e.g. a rejected foreign key) leaves its implicit
+            # transaction open, holding the write lock and blocking every
+            # other process on this file until the next commit. Roll it back.
+            if conn.in_transaction:
+                await conn.rollback()
+            raise
 
     async def _commit(self):
         """
@@ -145,6 +153,9 @@ async def _init_db(self):
         await self._execute("PRAGMA journal_mode=WAL")
         await self._execute("PRAGMA synchronous=NORMAL")
         await self._execute("PRAGMA busy_timeout=5000")
+        # SQLite enforces FOREIGN KEY constraints (and ON DELETE CASCADE) only
+        # when this is on for the connection; it is off by default.
+        await self._execute("PRAGMA foreign_keys=ON")
 
         # Create oauth_clients table
         await self._execute("""
@@ -288,12 +299,25 @@ async def store_client(self, client: RegisteredClient) -> None:
                 else hash_client_secret(client.client_secret)
             )
 
+            # Upsert in place. INSERT OR REPLACE would delete the existing row
+            # first, and with foreign keys on that delete cascades to the
+            # client's authorization codes and tokens.
             await self._execute(
                 """
-                INSERT OR REPLACE INTO oauth_clients
+                INSERT INTO oauth_clients
                 (client_id, client_secret, client_name, redirect_uris, response_types,
                  grant_types, scope, token_endpoint_auth_method, created_at, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+                ON CONFLICT(client_id) DO UPDATE SET
+                    client_secret = excluded.client_secret,
+                    client_name = excluded.client_name,
+                    redirect_uris = excluded.redirect_uris,
+                    response_types = excluded.response_types,
+                    grant_types = excluded.grant_types,
+                    scope = excluded.scope,
+                    token_endpoint_auth_method = excluded.token_endpoint_auth_method,
+                    created_at = excluded.created_at,
+                    metadata = excluded.metadata
                 """,
                 (
                     client.client_id,
```

**File**: `tests/unit/test_oauth_sqlite_foreign_keys.py` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+#!/usr/bin/env python3
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
+"""
+Foreign-key enforcement in the SQLite OAuth backend (#1804).
+
+The schema declares ``client_id`` foreign keys with ``ON DELETE CASCADE`` on
+the authorization-code, access-token and refresh-token tables. SQLite enforces
+them only when ``PRAGMA foreign_keys`` is on for the connection. These tests
+run against a real ``oauth.db`` in a temporary directory.
+"""
+
+import sqlite3
+import time
+
+import pytest
+
+from mcp_memory_service.web.oauth.models import RegisteredClient
+from mcp_memory_service.web.oauth.storage import create_oauth_storage
+
+CHILD_TABLES = (
+    "oauth_authorization_codes",
+    "oauth_access_tokens",
+    "oauth_refresh_tokens",
+)
+
+
+def _client(client_id: str, secret: str = "s3cret") -> RegisteredClient:
+    return RegisteredClient(
+        client_id=client_id,
+        client_secret=secret,
+        client_name="FK test client",
+        redirect_uris=["http://localhost/callback"],
+        grant_types=["authorization_code", "refresh_token"],
+        response_types=["code"],
+        token_endpoint_auth_method="client_secret_basic",
+        created_at=time.time(),
+    )
+
+
+@pytest.fixture
+async def storage(tmp_path):
+    store = create_oauth_storage("sqlite", db_path=str(tmp_path / "oauth.db"))
+    yield store
+    await store.close()
+
+
+async def _issue_everything(storage, client_id: str) -> None:
+    await storage.store_authorization_code(
+        code=f"code-{client_id}", client_id=client_id, expires_in=300
+    )
+    await storage.store_access_token(
+        token=f"at-{client_id}", client_id=client_id, expires_in=3600
+    )
+    await storage.store_refresh_token(
+        token=f"rt-{client_id}", client_id=client_id, expires_in=3600
+    )
+
+
+async def _child_counts(storage, client_id: str) -> dict:
+    counts = {}
+    for table in CHILD_TABLES:
+        cursor = await storage._execute(
+            f"SELECT COUNT(*) FROM {table} WHERE client_id = ?", (client_id,)
+        )
+        counts[table] = (await cursor.fetchone())[0]
+    return counts
+
+
+@pytest.mark.asyncio
+async def test_deleting_a_client_removes_its_codes_and_tokens(storage):
+    await storage.store_client(_client("doomed"))
+    await storage.store_client(_client("bystander"))
+    await _issue_everything(storage, "doomed")
+    await _issue_everything(storage, "bystander")
+    assert await _child_counts(storage, "doomed") == dict.fromkeys(CHILD_TABLES, 1)
+
+    await storage._execute("DELETE FROM oauth_clients WHERE client_id = ?", ("doomed",))
+    await storage._commit()
+
+    assert await _child_counts(storage, "doomed") == dict.fromkeys(CHILD_TABLES, 0)
+    assert await _child_counts(storage, "bystander") == dict.fromkeys(CHILD_TABLES, 1)
+
+
+@pytest.mark.asyncio
+async def test_code_for_unknown_client_is_rejected(storage):
+    with pytest.raises(sqlite3.IntegrityError):
+        await storage.store_authorization_code(
+            code="orphan-code", client_id="no-such-client", expires_in=300
+        )
+
+
+@pytest.mark.asyncio
+async def test_foreign_keys_stay_on_after_reconnect(storage):
+    cursor = await storage._execute("PRAGMA foreign_keys")
+    assert (await cursor.fetchone())[0] == 1
+
+    await storage.close()
+
+    cursor = await storage._execute("PRAGMA foreign_keys")
+    assert (await cursor.fetchone())[0] == 1
+
+
+@pytest.mark.asyncio
+async def test_rejected_insert_does_not_block_later_writes(tmp_path):
+    db_path = str(tmp_path / "oauth.db")
+    storage = create_oauth_storage("sqlite", db_path=db_path)
+    try:
+        await storage.store_client(_client("real"))
+        with pytest.raises(sqlite3.IntegrityError):
+            await storage.store_authorization_code(
+                code="orphan-code", client_id="no-such-client", expires_in=300
+            )
+        await storage.store_authorization_code(
+            code="good-code", client_id="real", expires_in=300
+        )
+    finally:
+        await storage.close()
+
+    reopened = create_oauth_storage("sqlite", db_path=db_path)
+    try:
+        assert await _child_counts(reopened, "real") == {
+            "oauth_authorization_codes": 1,
+            "oauth_access_tokens": 0,
+            "oauth_refresh_tokens": 0,
+        }
+        assert await _child_counts(reopened, "no-such-client") == dict.fromkeys(
+            CHILD_TABLES, 0
+        )
+    fi
```

**File**: `tests/unit/test_oauth_storage_backends.py` (modified, +19/-4)
```diff
@@ -64,6 +64,21 @@ async def storage(request):
     else:
         storage = create_oauth_storage("memory")
 
+    # Most tests store codes and tokens for "client_1". The SQLite backend
+    # enforces the client_id foreign key, so the client has to exist.
+    await storage.store_client(
+        RegisteredClient(
+            client_id="client_1",
+            client_secret="client_1_secret",
+            client_name="Fixture Client",
+            redirect_uris=["http://localhost/callback"],
+            grant_types=["authorization_code", "refresh_token"],
+            response_types=["code"],
+            token_endpoint_auth_method="client_secret_basic",
+            created_at=time.time(),
+        )
+    )
+
     yield storage
 
     # Cleanup
@@ -675,7 +690,7 @@ async def test_store_and_get_authorization_code_with_pkce(self, storage):
 
         await storage.store_authorization_code(
             code="pkce_code_123",
-            client_id="pkce_client",
+            client_id="client_1",
             redirect_uri="http://localhost/callback",
             scope="read write",
             expires_in=300,
@@ -686,7 +701,7 @@ async def test_store_and_get_authorization_code_with_pkce(self, storage):
         code_data = await storage.get_authorization_code("pkce_code_123")
 
         assert code_data is not None
-        assert code_data["client_id"] == "pkce_client"
+        assert code_data["client_id"] == "client_1"
         assert code_data["code_challenge"] == challenge
         assert code_data["code_challenge_method"] == method
 
@@ -695,7 +710,7 @@ async def test_authorization_code_without_pkce(self, storage):
         """Test that codes without PKCE still work (backward compat)."""
         await storage.store_authorization_code(
             code="no_pkce_code",
-            client_id="plain_client",
+            client_id="client_1",
             redirect_uri="http://localhost/callback",
             scope="read",
             expires_in=300,
@@ -704,7 +719,7 @@ async def test_authorization_code_without_pkce(self, storage):
         code_data = await storage.get_authorization_code("no_pkce_code")
 
         assert code_data is not None
-        assert code_data["client_id"] == "plain_client"
+        assert code_data["client_id"] == "client_1"
         assert code_data.get("code_challenge") is None
         assert code_data.get("code_challenge_method") is None
 
```

---

### Incident Patch 2: `e0e2d895` (2026-11-04)
**Commit Message**: fix(mcp): serve annotations and ping on HTTP, align memory_graph schema with the handler (#1849)

* fix(mcp): serve annotations and ping on HTTP, align memory_graph schema with the handler

* docs: changelog fragment for #1847

* fix(mcp): derive the graph action enum from GRAPH_ACTIONS; restore globals in test teardown

**File**: `changelog.d/1847.fixed.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+- **The HTTP /mcp shim served a weaker protocol than stdio (#1847).**
+  `tools/list` over HTTP dropped every tool's `annotations` (0/26 carried
+  readOnlyHint/destructiveHint vs 28/28 on stdio), `ping` answered
+  `-32601`, and the `memory_graph` schema enum advertised 5 of the 9 actions
+  the handler accepts — `abduct`, `list_entities` and `entity_profile` were
+  unreachable for schema-respecting clients. The shim now serializes
+  annotations, answers `ping` with an empty result, the enum lists all nine
+  actions, and the write-scope exemption derives from a single
+  `GRAPH_ACTIONS` constant so the three lists cannot drift (`extract_entities`
+  stays write-only, GHSA-2mw6-h564-86wv behavior unchanged).
```

**File**: `src/mcp_memory_service/server/handlers/graph.py` (modified, +15/-1)
```diff
@@ -74,6 +74,20 @@ async def get_graph_storage() -> Optional[GraphStorage]:
     return None
 
 
+# Every action handle_memory_graph accepts. The tool schema enum in
+# tools/registry.py and the write-scope exemption in server_impl.py both
+# derive from this list — tests/web/api/test_mcp_transport_consistency.py
+# pins the three against each other so they cannot drift again.
+GRAPH_ACTIONS = [
+    "connected", "path", "subgraph", "extract_entities", "infer",
+    "suggest", "abduct", "list_entities", "entity_profile",
+]
+
+# Actions that only read the graph. extract_entities stores entity links,
+# so it is deliberately absent (GHSA-2mw6-h564-86wv).
+GRAPH_READ_ACTIONS = tuple(a for a in GRAPH_ACTIONS if a != "extract_entities")
+
+
 async def handle_memory_graph(server, arguments: dict) -> List[types.TextContent]:
     """Unified handler for graph operations."""
     action = arguments.get("action")
@@ -82,7 +96,7 @@ async def handle_memory_graph(server, arguments: dict) -> List[types.TextContent
         return [types.TextContent(type="text", text="Error: action parameter is required")]
 
     # Validate action
-    valid_actions = ["connected", "path", "subgraph", "extract_entities", "infer", "suggest", "abduct", "list_entities", "entity_profile"]
+    valid_actions = GRAPH_ACTIONS
     if action not in valid_actions:
         return [types.TextContent(
             type="text",
```

**File**: `src/mcp_memory_service/server_impl.py` (modified, +5/-4)
```diff
@@ -1670,10 +1670,11 @@ async def tool_requires_write(self, name: Optional[str], arguments: Optional[dic
         if not name:
             return False
         if name == "memory_graph":
-            return not (arguments and arguments.get("action") in (
-                "connected", "path", "subgraph", "infer", "suggest", "abduct",
-                "list_entities", "entity_profile",
-            ))
+            # Derived from the handler's action table so the two lists cannot
+            # drift apart (GHSA-2mw6-h564-86wv); extract_entities writes entity
+            # links and stays out of the read set.
+            from mcp_memory_service.server.handlers.graph import GRAPH_READ_ACTIONS
+            return not (arguments and arguments.get("action") in GRAPH_READ_ACTIONS)
         try:
             tools = await self.list_tools()
         except Exception:
```

**File**: `src/mcp_memory_service/tools/registry.py` (modified, +20/-1)
```diff
@@ -10,6 +10,12 @@
 from dataclasses import dataclass, field
 from typing import Any
 
+# The single source of truth for memory_graph actions. The schema enum below
+# and the write-scope exemption in server_impl both build on this list, so an
+# action added here is everywhere; tests/web/api/test_transport_consistency.py
+# pins the derivation.
+from ..server.handlers.graph import GRAPH_ACTIONS
+
 
 @dataclass(frozen=True)
 class ToolDef:
@@ -1008,8 +1014,12 @@ class ToolDef:
 - connected: Find memories connected via associations (BFS traversal)
 - path: Find shortest path between two memories
 - subgraph: Get graph structure around a memory for visualization
+- extract_entities: Manually extract and store entities for a memory (write). Params: hash (string)
 - infer: Find transitive relationships (A→B→C implies A→C). Params: rel_type (string), max_hops (int, default 2)
 - suggest: Suggest potential relationships for a memory based on shared neighbors. Params: hash (string)
+- abduct: Find plausible common-cause explanations for a memory's relationships. Params: hash (string)
+- list_entities: List known entities. Params: limit (int, default 50)
+- entity_profile: Show memories linked to one entity. Params: entity_name (string)
 
 Examples:
 {"action": "connected", "hash": "abc123", "max_hops": 2}
@@ -1023,7 +1033,7 @@ class ToolDef:
             "properties": {
                 "action": {
                     "type": "string",
-                    "enum": ["connected", "path", "subgraph", "infer", "suggest"],
+                    "enum": list(GRAPH_ACTIONS),
                     "description": "Graph operation to perform",
                 },
                 "hash": {
@@ -1057,6 +1067,15 @@ class ToolDef:
                     "type": "string",
                     "description": "For 'infer': relationship type to traverse",
                 },
+                "entity_name": {
+                    "type": "string",
+                    "description": "For 'entity_profile': entity to profile",
+                },
+                "limit": {
+                    "type": "integer",
+                    "default": 50,
+                    "description": "For 'list_entities': max entities to return",
+                },
                 "as_of": {
                     "type": "string",
                     "description": (
```

**File**: `src/mcp_memory_service/web/api/mcp.py` (modified, +16/-1)
```diff
@@ -149,11 +149,21 @@ def _get_memory_server():
 
 def _tool_to_dict(tool) -> Dict[str, Any]:
     """Convert an `mcp.types.Tool` to the wire shape MCP-over-HTTP returns."""
-    return {
+    out: Dict[str, Any] = {
         "name": tool.name,
         "description": tool.description,
         "inputSchema": tool.inputSchema,
     }
+    # The stdio transport serializes annotations through the SDK; this shim
+    # used to drop them, so remote clients never saw readOnlyHint /
+    # destructiveHint and could not pre-classify write tools the way stdio
+    # clients can.
+    if tool.annotations is not None:
+        if hasattr(tool.annotations, "model_dump"):
+            out["annotations"] = tool.annotations.model_dump(exclude_none=True)
+        else:
+            out["annotations"] = dict(tool.annotations)
+    return out
 
 
 def _wrap_tool_result(result, is_error: bool = False) -> Dict[str, Any]:
@@ -219,6 +229,11 @@ async def mcp_endpoint(
             )
             return JSONResponse(content=response.model_dump(exclude_none=True))
 
+        elif request.method == "ping":
+            # MCP liveness check: the spec requires an empty result object.
+            response = MCPResponse(id=request.id, result={})
+            return JSONResponse(content=response.model_dump(exclude_none=True))
+
         elif request.method == "tools/list":
             tools = await server.list_tools()
             local_only = server.local_only_tools()
```

**File**: `tests/web/api/test_transport_consistency.py` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+"""MCP transport consistency: the /mcp shim must not serve a weaker protocol
+than stdio.
+
+Pins three lists that used to drift independently (the memory_graph schema
+enum, the handler's accepted actions and the write-scope exemption), and
+checks the HTTP shim carries tool annotations and answers ``ping``.
+"""
+
+import pytest
+import pytest_asyncio
+import tempfile
+import os
+from fastapi.testclient import TestClient
+
+from mcp_memory_service.web.dependencies import set_storage
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.tools.registry import TOOL_REGISTRY
+from mcp_memory_service.server.handlers.graph import (
+    GRAPH_ACTIONS,
+    GRAPH_READ_ACTIONS,
+)
+
+
+@pytest.fixture
+def temp_db():
+    with tempfile.TemporaryDirectory() as tmpdir:
+        yield os.path.join(tmpdir, "test.db")
+
+
+@pytest_asyncio.fixture
+async def initialized_storage(temp_db, monkeypatch):
+    monkeypatch.setenv("MCP_SEMANTIC_DEDUP_ENABLED", "false")
+    storage = SqliteVecMemoryStorage(temp_db)
+    await storage.initialize()
+    yield storage
+    await storage.close()
+
+
+@pytest.fixture
+def test_app(initialized_storage, monkeypatch):
+    from mcp_memory_service.web import dependencies as web_dependencies
+    from mcp_memory_service.web.api import mcp as mcp_api
+    from mcp_memory_service.web.oauth import middleware
+    monkeypatch.setattr(middleware, "API_KEY", None)
+    monkeypatch.setattr(middleware, "OAUTH_ENABLED", False)
+    monkeypatch.setattr(middleware, "ALLOW_ANONYMOUS_ACCESS", True)
+
+    from mcp_memory_service.web.app import app
+    from mcp_memory_service.web.oauth.middleware import (
+        get_current_user, require_read_access, AuthenticationResult,
+    )
+
+    # The shim caches a MemoryServer against the module-global storage; save
+    # both so teardown leaves other tests' globals intact instead of pointing
+    # at this fixture's closed storage.
+    prev_storage = web_dependencies._storage
+    prev_server = mcp_api._memory_server
+    set_storage(initialized_storage)
+
+    async def mock_user():
+        return AuthenticationResult(
+            authenticated=True, client_id="test", scope="read write admin", auth_method="test",
+        )
+
+    app.dependency_overrides[get_current_user] = mock_user
+    app.dependency_overrides[require_read_access] = mock_user
+    yield app
+    app.dependency_overrides.clear()
+    web_dependencies._storage = prev_storage
+    mcp_api._memory_server = prev_server
+
+
+def _graph_tool_def():
+    return next(td for td in TOOL_REGISTRY if td.name == "memory_graph")
+
+
+def test_graph_schema_enum_lists_every_handler_action():
+    schema = _graph_tool_def().input_schema
+    enum = schema["properties"]["action"]["enum"]
+    assert enum == GRAPH_ACTIONS
+    # the advertised description covers every action too
+    description = _graph_tool_def().description
+    for action in GRAPH_ACTIONS:
+        assert action in description, f"{action} missing from the tool description"
+
+
+def test_read_actions_exclude_only_entity_extraction():
+    # extract_entities stores entity links (GHSA-2mw6-h564-86wv)
+    assert set(GRAPH_READ_ACTIONS) == set(GRAPH_ACTIONS) - {"extract_entities"}
+
+
+@pytest.mark.asyncio
+async def test_write_scope_follows_the_action_table(initialized_storage):
+    from mcp_memory_service.server_impl import MemoryServer
+
+    server = MemoryServer(
+        storage=initialized_storage, consolidator=None, consolidation_scheduler=None
+    )
+    for action in GRAPH_READ_ACTIONS:
+        requires_write = await server.tool_requires_write(
+            "memory_graph", {"action": action}
+        )
+        assert not requires_write, f"{action} is read-only but required write scope"
+
+    assert await server.tool_requires_write(
+        "memory_graph", {"action": "extract_entities"}
+    )
+    assert await server.tool_requires_write("memory_graph", {"action": "bogus"})
+    assert await server.tool_requires_write("memory_graph", None)
+
+
+def test_http_tools_list_carries_annotations(test_app):
+    client = TestClient(test_app)
+    response = client.post(
+        "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
+    )
+    tools = response.json()["result"]["tools"]
+
+    assert tools, "tools/list returned no tools"
+    missing = [t["name"] for t in tools if not t.get("annotations")]
+    assert not missing, f"HTTP tools/list dropped annotations for: {missing}"
+
+    by_name = {t["name"]: t for t in tools}
+    assert by_name["memory_search"]["annotations"].get("readOnlyHint") is True
+    assert by_name["memory_delete"]["annotations"].get("destructiveHint") is True
+    assert by_name["memory_graph"]["annotations"].get("readOnlyHint") is True
+
+
+def test_http_ping_answers_empty_result(test_app):
+    client = TestClient(test_app)
+    response = client.post(
+        "/mcp", json={"jsonrpc": "2.0", "id": 7, "method": "ping"}

```

---

### Incident Patch 3: `a2ee57d3` (2026-11-04)
**Commit Message**: feat(entities): rebuild existing entity graphs (#1860)

* feat(entities): rebuild existing entity graphs (#1722)

Add memory_quality(action="rebuild_entities") to preview or replace entity
edges for all live memories on SQLite, Hybrid, and Milvus. Use current
extraction settings and EntityLinker, preserving other relationships and
memory data. Bind the graph to the active storage and stop on read errors
before deleting edges. Remove the broken SQLite-only backfill script.

Validation: 44 rebuild tests passed, 1 skipped; the related suite passed
314 tests with 7 skips. The full pre-PR gate still fails on existing auth,
date-filter, and missing sentence-transformers failures. The local model
analysis was skipped because its endpoint was unavailable.

Fixes #1722

* fix(entities): abort graph rebuilds on extractor failures

**File**: `.env.example` (modified, +4/-3)
```diff
@@ -165,7 +165,8 @@ MCP_SEMANTIC_DEDUP_THRESHOLD=0.85            # Similarity threshold 0.0-1.0 (def
 # docs/guides/token-efficient-retrieval.md
 #
 # Link entities at store time, for memories stored from then on. Existing memories are
-# untouched — use memory_quality {"action":"maintain","dry_run":false} for those.
+# untouched — preview memory_quality {"action":"rebuild_entities"} for those,
+# then back up and use dry_run=false to rebuild their entity graph.
 # MCP_ENTITY_LINKING_ENABLED=1
 #
 # Memories scanned per maintain run. Takes the FIRST N in storage order, so repeated runs
@@ -180,8 +181,8 @@ MCP_SEMANTIC_DEDUP_THRESHOLD=0.85            # Similarity threshold 0.0-1.0 (def
 #
 # Which memory tags become entities: comma-separated fnmatch patterns, case-insensitive.
 # Include is applied first, then exclude; unset keeps every tag. Entities found in the
-# content (#hashtags, @mentions, URLs, paths) are not filtered. Existing graph edges are
-# not rebuilt.
+# content (#hashtags, @mentions, URLs, paths) are not filtered. Existing graph edges
+# change only when memory_quality {"action":"rebuild_entities","dry_run":false} runs.
 # MCP_ENTITY_TAG_INCLUDE=task:*
 # MCP_ENTITY_TAG_EXCLUDE=bugfix,project:*
 #
```

**File**: `changelog.d/1722.added.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Rebuild existing entity graphs with `memory_quality(action="rebuild_entities")`, previewing changes by default and applying current extraction settings across all live memories on SQLite, Hybrid, and Milvus.
```

**File**: `docs/guides/token-efficient-retrieval.md` (modified, +58/-4)
```diff
@@ -163,8 +163,10 @@ via `memory_graph`. If that returns `{"entities": [], "total": 0}`, the two-phas
 have nothing to work with, and the fix is one of:
 
 - **Batch, for memories you already have** — `memory_quality` with
-  `{"action": "maintain", "dry_run": false}`. The `dry_run` default is `true`, which counts
-  candidate entities and stores none, so a default call looks like it did nothing.
+  `{"action": "rebuild_entities"}` previews a full entity-graph rebuild. Review the
+  report, then use `{"action": "rebuild_entities", "dry_run": false}` to apply it.
+  See [Rebuilding the entity graph](#rebuilding-the-entity-graph) before applying.
+  `maintain` can also populate `has_entity`, but does not create `shares_entity`.
 - **Ongoing, for memories stored from now on** — set `MCP_ENTITY_LINKING_ENABLED=1`. This
   links at store time and does not touch existing memories.
 - **A single memory** — `memory_graph` with
@@ -207,8 +209,8 @@ each a comma-separated list of `fnmatch` patterns matched case-insensitively:
 - `MCP_ENTITY_TAG_EXCLUDE` — matching tags never do.
 
 When both are set, include is applied first, then exclude. Unset keeps every tag. Entities
-found in the content (`#hashtags`, `@mentions`, URLs, paths) are not filtered. Existing
-graph edges are not rebuilt: the filter applies to extraction from then on.
+found in the content (`#hashtags`, `@mentions`, URLs, paths) are not filtered. The filter
+applies to extraction from then on; use `rebuild_entities` to update existing edges.
 
 ```bash
 MCP_ENTITY_TAG_INCLUDE=task:*
@@ -222,6 +224,58 @@ of the patterns above, tags do most of the work — which is why tags being drop
 For domain-specific extraction, `MCP_ENTITY_EXTRACTOR_MODULES` accepts comma-separated
 `module.path:ClassName` entries implementing the `DomainExtractor` protocol.
 
+### Rebuilding the entity graph
+
+After changing entity filters or custom terms, correcting old extraction errors, or
+enabling linking on an existing store, preview a complete rebuild with `memory_quality`:
+
+```json
+{"action": "rebuild_entities"}
+```
+
+This defaults to `dry_run: true` and changes no memories or edges. `edges_before` counts
+the rows that would be deleted, and `edges_after` counts the replacement rows. Both
+contain `has_entity` and `shares_entity`. A `shares_entity` pair uses two directed rows;
+`shares_entity_pairs_before` and `shares_entity_pairs_after` count pairs instead.
+`memories_scanned` counts all live memories across all named stores, including
+superseded versions, in creation order. `MCP_MAINTAIN_SCAN_LIMIT` does not apply.
+The graph is selected from the server's active storage, including Hybrid's primary,
+and a Milvus preview leaves a missing graph collection absent. A read failure stops
+the operation before deleting any edges. Rebuilds load configured domain extractors
+afresh and stop before deletion if a plugin fails to load or extract entities.
+
+Back up the database first and pause other writers and consolidation jobs for the
+entire preview/apply window. Restart the server to load changed extraction settings,
+then review the preview and apply:
+
+```json
+{"action": "rebuild_entities", "dry_run": false}
+```
+
+The operation deletes only `has_entity` and `shares_entity` edges, then recreates them
+using the current extractor and `EntityLinker`. Other relationships and their metadata
+and timestamps are preserved. If a pair already has a non-entity relationship, the
+rebuild skips a `shares_entity` pair that would overwrite it; `protected_edges` reports
+the number of non-entity rows retained. Memory contents, hashes, timestamps, tags, and
+store assignments are unchanged. Rebuilding explicitly does not require
+`MCP_ENTITY_LINKING_ENABLED` to be enabled; that flag controls future store-time linking.
+
+The newest-first entity lookup window and linking cap are the same as at store time.
+Equal creation timestamps are ordered by content hash for repeatable results. The
+result reproduces linking with today's settings, rather than preserving historical
+entity edges. The old SQLite-only backfill script has been replaced by this action.
+
+SQLite, Hybrid (its local graph), and Milvus are supported. Cloudflare reports an
+unsupported graph backend and does nothing. This is a write operation requiring OAuth
+write scope, even for a preview. Only a boolean `dry_run: false` applies changes.
+
+The full memory scan, graph snapshot, and replacement plan are held in memory before
+any deletion. Large stores require proportionally more RAM, and Milvus performs an RPC
+per edge write, so a rebuild can take a while. Pause other writers: the process-local
+rebuild lock does not coordinate separate servers, and this is not a cross-backend
+transaction. A write failure returns `success: false`, errors and progress counters;
+the graph may be partially rebuilt. Fix the failure and rerun, or restore the backup.
+
 ### What `summary` actually is
 
 The `summary` field on each entity
```

**File**: `docs/mastery/api-reference.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ these twelve (`grep -c 'ToolDef(' src/mcp_memory_service/tools/registry.py`):
 | `memory_update` | Update memory metadata (replaces `update_memory_metadata`) |
 | `memory_cleanup` | Remove duplicates / orphans (replaces `cleanup_duplicates`) |
 | `memory_consolidate` | Run/manage consolidation (replaces `trigger_consolidation`, `scheduler_status`) |
-| `memory_quality` | Rate / get / analyze quality (replaces `rate_memory`, `get_memory_quality`, `analyze_quality_distribution`) |
+| `memory_quality` | Rate / get / analyze quality (replaces `rate_memory`, `get_memory_quality`, `analyze_quality_distribution`); maintain or rebuild all entity edges (`rebuild_entities`, dry-run by default) |
 | `memory_ingest` | Ingest documents (PDF/DOCX/TXT/JSON) |
 | `memory_graph` | Knowledge-graph queries (`connected`, `path`, `subgraph`, `extract_entities`, `infer`, `suggest`, `abduct`, `list_entities`, `entity_profile`) |
 | `memory_explore` | Knowledge map of entities for a query, with ranked chunks per entity |
```

**File**: `scripts/maintenance/backfill_has_entity.py` (removed, +0/-127)
```diff
@@ -1,127 +0,0 @@
-#!/usr/bin/env python3
-"""
-backfill_has_entity.py — Rebuild has_entity edges from existing memories.
-
-Use after applying the prune fix (#150) to repopulate has_entity edges
-that were incorrectly deleted by previous consolidation cycles.
-
-Usage:
-    python scripts/maintenance/backfill_has_entity.py [--dry-run] [--db PATH]
-
-Options:
-    --dry-run   Show what would be inserted without writing
-    --db PATH   Path to sqlite_vec.db (default: ~/.local/share/mcp-memory/sqlite_vec.db)
-"""
-
-import argparse
-import json
-import os
-import sqlite3
-import sys
-import time
-
-# Add src to path for imports
-sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
-
-
-def get_default_db_path():
-    """Resolve default DB path from env or standard location."""
-    return os.environ.get(
-        "MCP_MEMORY_SQLITE_PATH",
-        os.path.expanduser("~/.local/share/mcp-memory/sqlite_vec.db"),
-    )
-
-
-def main():
-    parser = argparse.ArgumentParser(description="Backfill has_entity edges")
-    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
-    parser.add_argument("--db", default=get_default_db_path(), help="Path to sqlite_vec.db")
-    args = parser.parse_args()
-
-    if not os.path.exists(args.db):
-        print(f"Error: database not found at {args.db}")
-        sys.exit(1)
-
-    try:
-        from mcp_memory_service.extraction.entity_extractor import EntityExtractor
-    except ImportError:
-        print("Error: cannot import EntityExtractor. Run from repo root or install package.")
-        sys.exit(1)
-
-    conn = sqlite3.connect(args.db)
-    conn.row_factory = sqlite3.Row
-
-    # Count existing has_entity edges
-    before = conn.execute(
-        "SELECT COUNT(*) FROM memory_graph WHERE relationship_type = 'has_entity'"
-    ).fetchone()[0]
-    print(f"has_entity edges before: {before}")
-
-    # Get all non-deleted memories
-    cursor = conn.execute(
-        "SELECT content_hash, content, metadata FROM memories WHERE deleted_at IS NULL"
-    )
-
-    extractor = EntityExtractor()
-    inserted = 0
-    processed = 0
-    now = time.time()
-
-    for row in cursor:
-        processed += 1
-        if processed % 1000 == 0:
-            print(f"  processed {processed} memories...")
-
-        content = row["content"] or ""
-        if len(content) < 20:
-            continue
-
-        metadata = {}
-        if row["metadata"]:
-            try:
-                metadata = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
-            except (json.JSONDecodeError, TypeError):
-                pass
-
-        try:
-            entities = extractor.extract_entities(content, metadata)
-        except Exception:
-            continue
-
-        for ent in entities:
-            if args.dry_run:
-                inserted += 1
-            else:
-                try:
-                    conn.execute(
-                        """INSERT OR IGNORE INTO memory_graph
-                           (source_hash, target_hash, similarity, connection_types, metadata, created_at, relationship_type)
-                           VALUES (?, ?, 1.0, '["entity"]', ?, ?, 'has_entity')""",
-                        (
-                            row["content_hash"],
-                            ent.name,
-                            json.dumps({"entity_type": getattr(ent, 'entity_type', 'unknown')}),
-                            now,
-                        ),
-                    )
-                    inserted += 1
-                except sqlite3.Error:
-                    pass
-
-    if not args.dry_run:
-        conn.commit()
-
-    after = conn.execute(
-        "SELECT COUNT(*) FROM memory_graph WHERE relationship_type = 'has_entity'"
-    ).fetchone()[0]
-    conn.close()
-
-    mode = "DRY-RUN" if args.dry_run else "LIVE"
-    print(f"\nResults ({mode}):")
-    print(f"  Memories processed: {processed}")
-    print(f"  Edges {'would be' if args.dry_run else ''} inserted: {inserted}")
-    print(f"  has_entity edges after: {after if not args.dry_run else before + inserted}")
-
-
-if __name__ == "__main__":
-    main()
```

**File**: `src/mcp_memory_service/reasoning/entities.py` (modified, +57/-35)
```diff
@@ -7,10 +7,18 @@
 Supports pluggable domain-specific extractors via MCP_ENTITY_EXTRACTOR_MODULES env var.
 """
 
+import importlib
+import logging
+import os
 import re
 from dataclasses import dataclass
 from fnmatch import fnmatchcase
-from typing import List, Dict, Any, Protocol, runtime_checkable
+from typing import Any, Callable, Dict, List, Protocol, runtime_checkable
+
+from ..compat import _sanitize_log_value
+
+logger = logging.getLogger(__name__)
+
 
 @dataclass
 class Entity:
@@ -51,16 +59,31 @@ def _tag_allowed(tag: str, include: list[str], exclude: list[str]) -> bool:
 _DOMAIN_EXTRACTOR_CACHE: list | None = None
 
 
+def _load_domain_extractor(spec: str) -> DomainExtractor:
+    """Instantiate one configured plugin and validate its protocol."""
+    module_path, class_name = spec.rsplit(":" if ":" in spec else ".", 1)
+    module = importlib.import_module(module_path)
+    instance = getattr(module, class_name)()
+    if not isinstance(instance, DomainExtractor):
+        raise TypeError("does not implement DomainExtractor protocol")
+    return instance
+
+
 class EntityExtractor:
     """Extract entities from memory content and metadata.
 
     Uses high-precision patterns only (@mentions, #tags, URLs, paths).
     CamelCase/ALLCAPS removed per review feedback (too many false positives).
     Supports pluggable domain extractors via constructor or env var.
+    Strict mode raises on plugin errors instead of returning partial results.
     """
 
-    def __init__(self, domain_extractors: list[DomainExtractor] | None = None):
+    def __init__(
+        self, domain_extractors: list[DomainExtractor] | None = None,
+        *, strict: bool = False,
+    ):
         self._domain_extractors = domain_extractors or []
+        self._strict = strict
 
     def extract_entities(self, content: str, metadata: Dict[str, Any] | None = None) -> List[Entity]:
         metadata = metadata or {}
@@ -92,44 +115,53 @@ def _add(name: str, etype: str, source: str):
         tags = metadata.get('tags', [])
         if isinstance(tags, str):
             tags = [t.strip() for t in tags.split(',') if t.strip()]
-        from ..config import MCP_ENTITY_TAG_INCLUDE, MCP_ENTITY_TAG_EXCLUDE
+        from ..config import (  # inline import: read current config
+            MCP_ENTITY_TAG_INCLUDE, MCP_ENTITY_TAG_EXCLUDE,
+        )
         include = _tag_patterns(MCP_ENTITY_TAG_INCLUDE)
         exclude = _tag_patterns(MCP_ENTITY_TAG_EXCLUDE)
         for tag in tags:
             if _tag_allowed(tag, include, exclude):
                 _add(tag, 'tag', 'metadata')
 
         # Custom terms matching from config
-        from ..config import MCP_ENTITY_CUSTOM_TERMS
+        from ..config import MCP_ENTITY_CUSTOM_TERMS  # inline import: read current config
         if MCP_ENTITY_CUSTOM_TERMS:
             custom_terms = [t.strip() for t in MCP_ENTITY_CUSTOM_TERMS.split(',') if t.strip()]
             for term in custom_terms:
                 # Word boundary match to avoid false positives (e.g., "roma" in "aroma")
                 if re.search(r'(?<![a-zA-Z0-9_-])' + re.escape(term) + r'(?![a-zA-Z0-9_-])', content, re.IGNORECASE):
                     _add(term, 'custom', 'config')
 
-        # Domain-specific extractors (pluggable)
+        self._add_domain_entities(content, metadata, _add)
+        return entities
+
+    def _add_domain_entities(
+        self, content: str, metadata: dict,
+        add: Callable[[str, str, str], None],
+    ) -> None:
+        """Keep ordinary extraction fail-soft; rebuilds require complete results."""
         for ext in self._domain_extractors:
             try:
                 domain_entities = ext.extract(content, metadata)
                 for ent in domain_entities:
-                    _add(ent.name, ent.entity_type, 'domain')
+                    add(ent.name, ent.entity_type, 'domain')
             except Exception as e:
-                import logging
-                logging.getLogger(__name__).debug(f"Domain extractor failed: {e}")
-
-        return entities
+                if self._strict:
+                    raise RuntimeError(
+                        f"Domain extractor '{type(ext).__module__}."
+                        f"{type(ext).__qualname__}' failed: {e}"
+                    ) from e
+                logger.debug("Domain extractor failed: %s", _sanitize_log_value(e))
 
     @staticmethod
-    def load_domain_extractors() -> list['DomainExtractor']:
+    def load_domain_extractors(*, strict: bool = False) -> list['DomainExtractor']:
         """Load domain extractors from MCP_ENTITY_EXTRACTOR_MODULES env var.
 
         Format: comma-separated dotted paths to classes.
         Example: MCP_ENTITY_EXTRACTOR_MODULES=mypackage.ner:MedicalExtractor,other.mod:LegalExtractor
+        With strict=True, any loading or protocol error aborts the entire load.
         """
-        import os
-        import importlib
-
         modules_str = os.environ.get('MCP_ENTITY_EXTRAC
```

**File**: `src/mcp_memory_service/reasoning/entity_rebuild.py` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+"""Plan entity-graph replacement before making any destructive writes."""
+
+from collections import Counter, defaultdict, deque
+from typing import Any, Callable
+
+from .entities import Entity, EntityExtractor
+from .entity_linker import EntityLinker, MAX_LINKS_PER_ENTITY
+
+ENTITY_RELATIONSHIPS = ("has_entity", "shares_entity")
+
+
+def _tags(value: object) -> list[str]:
+    """Accept current list tags and legacy comma-separated metadata tags."""
+    if isinstance(value, str):
+        return [tag.strip() for tag in value.split(",") if tag.strip()]
+    return list(value or [])
+
+
+def _extraction_metadata(memory: Any) -> dict:
+    metadata = dict(memory.metadata or {})
+    metadata["tags"] = list(dict.fromkeys([
+        *_tags(metadata.get("tags")), *_tags(memory.tags),
+    ]))
+    return metadata
+
+
+class EntityRebuildPlan:
+    """An in-memory graph sink for the real EntityLinker.
+
+    Entity lookups reproduce the graph stores' newest-first 20-row window,
+    including the just-inserted memory. Protected pairs cannot be overwritten
+    by symmetric shares_entity writes. Counts are physical edge rows; pairs
+    are reported separately.
+    """
+
+    def __init__(
+        self, snapshot: list[dict], entity_key: Callable[[str], str]
+    ) -> None:
+        self.entity_key = entity_key
+        self.protected = {
+            (row["source_hash"], row["target_hash"])
+            for row in snapshot
+            if row["relationship_type"] not in ENTITY_RELATIONSHIPS
+        }
+        counts = Counter(row["relationship_type"] for row in snapshot)
+        self.before = {kind: counts[kind] for kind in ENTITY_RELATIONSHIPS}
+        self.pairs_before = len({
+            tuple(sorted((row["source_hash"], row["target_hash"])))
+            for row in snapshot if row["relationship_type"] == "shares_entity"
+        })
+        self.entity_links: dict[tuple[str, str], Entity] = {}
+        self.associations: dict[tuple[str, str], dict] = {}
+        self.recent: dict[str, deque] = defaultdict(
+            lambda: deque(maxlen=MAX_LINKS_PER_ENTITY)
+        )
+        self.memories_scanned = 0
+
+    def _add_entity(self, memory_hash: str, entity: Entity) -> None:
+        key = self.entity_key(entity.name)
+        pair = (memory_hash, key)
+        if pair in self.protected:
+            return
+        if pair in self.entity_links:
+            # Milvus upserts normalized names; preserve its last surface form.
+            self.entity_links[pair] = entity
+            return
+        if tuple(sorted(pair)) in self.associations:
+            return
+        self.entity_links[pair] = entity
+        self.recent[key].appendleft(memory_hash)
+
+    async def find_memories_by_entity(self, entity_name: str) -> list[str]:
+        """Return the same capped candidate window used at store time."""
+        return list(self.recent[self.entity_key(entity_name)])
+
+    async def store_association(
+        self, source_hash: str, target_hash: str, **edge: Any
+    ) -> bool:
+        """Record a symmetric pair only when both endpoints are writable."""
+        forward, reverse = (source_hash, target_hash), (target_hash, source_hash)
+        if any(
+            pair in self.protected or pair in self.entity_links
+            for pair in (forward, reverse)
+        ):
+            return False
+        pair = tuple(sorted(forward))
+        self.associations[pair] = {
+            "source_hash": source_hash, "target_hash": target_hash, **edge,
+        }
+        return True
+
+    async def build(self, memories: list) -> None:
+        """Replay all live memories oldest first with current extraction settings."""
+        # Reload strictly: the fail-soft cache may omit failed plugins.
+        extractor = EntityExtractor(
+            domain_extractors=EntityExtractor.load_domain_extractors(strict=True),
+            strict=True,
+        )
+        linker = EntityLinker()
+        memories.sort(key=lambda m: (m.created_at or 0, m.content_hash))
+        for memory in memories:
+            entities = extractor.extract_entities(
+                memory.content or "", _extraction_metadata(memory)
+            )
+            for entity in entities:
+                self._add_entity(memory.content_hash, entity)
+            await linker.link_by_entities(
+                memory.content_hash, [e.name for e in entities], self
+            )
+            self.memories_scanned += 1
+
+    def describe(self) -> dict:
+        """Return the preview without exposing memory contents."""
+        return {
+            "memories_scanned": self.memories_scanned,
+            "edges_before": self.before,
+            "edges_after": {
+                "has_entity": len(self.entity_links),
+                "shares_entity": 2 * len(self.associations),
+            },
+            "shares_entity_pairs_before": self.pairs_before,
+            "shares_entity_pairs_after": len(self.associations),
+   
```

**File**: `src/mcp_memory_service/server/handlers/entity_rebuild.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+"""Explicit, write-scoped entity maintenance, separate from maintain's scan cap."""
+
+import asyncio
+import json
+import logging
+import time
+from contextlib import asynccontextmanager
+from typing import Any, AsyncIterator
+
+from mcp import types
+
+from ...compat import _sanitize_log_value
+from ...reasoning.entity_rebuild import EntityRebuildPlan
+from ...storage.graph import GraphStorage
+from ...storage.hybrid import HybridMemoryStorage
+from ...storage.milvus import MilvusMemoryStorage
+from ...storage.milvus_graph import MilvusGraphStorage, _entity_key
+from ...storage.read_policy import strict_reads
+from ...storage.sqlite_vec import SqliteVecMemoryStorage
+
+logger = logging.getLogger(__name__)
+_rebuild_lock = asyncio.Lock()
+
+
+@asynccontextmanager
+async def _open_graph(
+    primary: Any, dry_run: bool
+) -> AsyncIterator[GraphStorage | MilvusGraphStorage]:
+    """Open the graph belonging to this server, without mutating a preview."""
+    if isinstance(primary, SqliteVecMemoryStorage):
+        graph = GraphStorage(primary.db_path)
+    elif isinstance(primary, MilvusMemoryStorage):
+        graph = MilvusGraphStorage(
+            uri=primary.uri, token=primary.token,
+            collection_name=primary.collection_name,
+        )
+    else:
+        raise RuntimeError(
+            "Entity rebuild requires graph storage (sqlite_vec, hybrid, or milvus)"
+        )
+    try:
+        if isinstance(graph, MilvusGraphStorage):
+            await graph.initialize(create_if_missing=not dry_run)
+        yield graph
+    finally:
+        await graph.close()
+
+
+async def _rebuild(server: Any, dry_run: bool, report: dict) -> None:
+    storage = await server._ensure_storage_initialized()
+    primary = storage.primary if isinstance(storage, HybridMemoryStorage) else storage
+    async with _open_graph(primary, dry_run) as graph:
+        # None means every named store; limit=None drains Milvus's full iterator.
+        with strict_reads():
+            memories = await primary.get_all_memories(limit=None, store=None)
+            expected = await primary.count_all_memories(store=None)
+        if len(memories) != expected:
+            raise RuntimeError(
+                "Memory scan was incomplete or the store changed; no edges deleted"
+            )
+        # Milvus listings include tombstones stored inside metadata, unlike
+        # SQLite's deleted_at SQL filter. Verify the raw count before filtering.
+        if isinstance(graph, MilvusGraphStorage):
+            memories = [
+                m for m in memories if m.metadata.get("deleted_at") is None
+            ]
+        snapshot = await graph.get_edge_snapshot()
+        key = (lambda name: name) if isinstance(graph, GraphStorage) else _entity_key
+        plan = EntityRebuildPlan(snapshot, entity_key=key)
+        await plan.build(memories)
+        report.update(plan.describe())
+        if not dry_run:
+            await plan.apply(graph, report)
+        report["success"] = True
+
+
+async def handle_rebuild_entities(
+    server: Any, arguments: dict
+) -> list[types.TextContent]:
+    """Preview by default; only a literal false permits destructive replacement."""
+    dry_run = arguments.get("dry_run", True)
+    started = time.monotonic()
+    report = {
+        "action": "rebuild_entities", "dry_run": dry_run, "success": False,
+        "edges_deleted": 0, "edges_created": {"has_entity": 0, "shares_entity": 0},
+        "errors": [],
+    }
+    try:
+        if not isinstance(dry_run, bool):
+            raise ValueError("dry_run must be a boolean")
+        if _rebuild_lock.locked():
+            raise RuntimeError("An entity rebuild is already running in this process")
+        async with _rebuild_lock:
+            await _rebuild(server, dry_run, report)
+    except Exception as exc:
+        report["success"] = False
+        report["errors"].append(str(exc))
+        logger.error("Entity rebuild failed: %s", _sanitize_log_value(exc))
+    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
+    return [types.TextContent(type="text", text=json.dumps(report, indent=2))]
```

#### Recent Merged Pull Requests:
- **PR #1862** (2026-11-04): fix(oauth): enforce foreign keys in the SQLite OAuth store (@timkjr)
- **PR #1860** (2026-11-04): feat(entities): rebuild existing entity graphs (@andrunio)
- **PR #1859** (2026-11-04): fix(harvest): keep the newer statement current when sessions arrive out of order (#1858) (@doobidoo)
- **PR #1854** (2026-11-04): feat(i18n): add Russian web interface translations (@coughlmao)
- **PR #1853** (2026-11-04): fix(registry): mark memory_graph as read-write in tool annotations (#1852) (@hamid-digitalmarketer)
- **PR #1851** (2026-11-04): fix(dashboard): translate the manage tag table and the search counts (@ZYZ666-RGB)

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

## X. oauth): enforce foreign keys in the SQLite OAuth store (#1862)

**RULE**:
When implementing operations in `changelog.d/1804.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `56ba922e`: oauth): enforce foreign keys in the SQLite OAuth store (#1862). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1804.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **The SQLite OAuth store never enforced its foreign keys (#1804, timkjr).**
  The schema declares `ON DELETE CASCADE` from authorization codes, access
  tokens and refresh tokens to `oauth_clients`, but the backend never turned on
  `PRAGMA foreign_keys`, so deleting a client left its codes and tokens behind
  and a code or token could be stored for a client that did not exist. The
  pragma is now set on the connection. `store_client` switched from
  `INSERT OR REPLACE` to an upsert: REPLACE deletes the row first, and with
  enforcement on, that delete would have wiped the client's tokens whenever
  `authenticate_client` upgraded a legacy plaintext secret to a hash.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `56ba922e` are properly handled with clean fallback behavior.
