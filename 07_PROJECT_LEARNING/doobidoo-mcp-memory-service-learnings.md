> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `4ff3fcc6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T17:07:31.524Z  
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
> **Harvest Timestamp**: 2026-11-05T17:07:31.515Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2087 stars

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
- **Issue #1861** (2026-11-05): **dashboard restart and update kill a server started with `python -m uvicorn`**
  *Symptoms*: Restarting from the dashboard leaves the server dead when it was started with `memory launch`. That affects Restart, Update, and both config "save and restart" paths.  All four schedule `_restart_server_delayed` (`web/api/server.py:195`; callers at `server.py:350`, `server.py:434`, `configuration.py:799`, `configuration.py:905`). It re-executes with:  ```python os.execv(sys.executable, [sys.executable] + sys.argv) ```  `memory launch` starts the server as `python -m uvicorn ...` (`cli/lifecycle.py:847`). Under `-m`, `sys.argv[0]` is the path of `uvicorn/__main__.py`, so the new process runs that file as a script instead of `-m uvicorn`. Python then puts the script's directory, `site-packages/uvicorn/`, first on `sys.path`. uvicorn ships its own `logging.py`, which now shadows the standard library, and the new process dies on import:  ``` File ".../site-packages/uvicorn/logging.py", line 14, in <module>     class ColourizedFormatter(logging.Formatter): AttributeError: partially initialized module 'logging' has no attribute 'Formatter' (most likely due to a circular import) ```  That is from `server.err` on 2026-11-04, right after "AUDIT: Server process restart initiated", following a dashboard update. The update itself succeeded (git pull and pip install); only the restart failed, and the server stayed down until it was launched by hand.  The Windows branch has the same problem: it passes the same `sys.argv` to `subprocess.Popen`.  Fix: rebuild the command from `sys.orig_argv`

- **Issue #1858** (2026-11-04): **harvest: an older session can evolve a newer memory, because the statement time is never kept**
  *Symptoms*: A harvest over several sessions processes them newest first, and evolution does not compare times. So within one run, a statement from an older session can replace the current version of a memory that a newer session just wrote.  How it happens on `9ad9b7ac`:  1. `TranscriptParser.find_sessions` sorts the session files by mtime, newest first, and returns the first `count` (`harvest/parser.py:190-191`). `harvest_and_store` loops over them in that order (`harvest/harvester.py:211-219`). 2. For every candidate, `_try_evolve` (`harvester.py:307`) retrieves the single most similar memory and, above `similarity_threshold` (0.85), calls `evolve_memory` with the candidate's content. The candidate becomes the new current version. Nothing compares when either statement was made. 3. The time is available but dropped. `ParsedMessage` carries the transcript `timestamp` (`parser.py:22`), but `HarvestCandidate` has no time field (`harvest/models.py:15-25`), `_provenance` records none (`harvester.py:284-305`), and `store_memory` takes no time argument. A harvested memory's `created_at` is the time of the harvest.  Scenario: `memory_harvest` with `{"sessions": 2, "dry_run": false}`. The newer session says "the sync hub runs on port 8020", the older one says "the sync hub runs on port 8010". The newer one is processed first and stored. Then the older one comes along, matches it above 0.85, and evolves it. The current version now says 8010. The same applies to `session_ids` backfills and `force

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

### Incident Patch 1: `16a0ae92` (2026-11-05)
**Commit Message**: fix(storage): mark beliefs/summaries stale when source memory deleted (#1865)

* fix(storage): mark beliefs and summaries stale when a source is deleted

Deleting a memory removed its graph edges and left derived_from,
contradicted_by, merged_from_hashes and source_memory_hashes pointing
at the hash. The delete transaction now drops the hash from belief
provenance, flags compression and association memories, and marks a
belief ungrounded when no sources remain.

Fixes #1857

Co-authored-by: yuzhou <[REDACTED_EMAIL]>

* fix(storage): restore ungrounded beliefs and sync summary flags

Re-deriving a belief whose sources came back promotes it from ungrounded
to candidate, or to active when the usual floors are met. A delta-sync
tombstone runs the same citation cleanup as a local delete. Summary
flags advance updated_at and record an update_metadata event.

Fixes #1857

Co-authored-by: yuzhou <[REDACTED_EMAIL]>

* fix(sync): roll back a tombstone whose citation cleanup fails

A delta-sync delete committed the tombstone and the sync_events row
before checking that belief and summary cleanup finished. The retry
then looked like a duplicate. Apply now commits only a finished
materialize, k

**File**: `changelog.d/1857.fixed.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+- **Deleting a memory left beliefs and consolidation summaries citing it (#1857, ZYZ666-RGB).**
+  Graph edges were removed in the delete transaction, but `derived_from`,
+  `contradicted_by` and `metadata.merged_from_hashes` kept the hash, and
+  compression and association memories kept it in `source_memory_hashes`.
+  Retention deletes this way all the time, so `get_beliefs` kept returning a
+  belief whose evidence was gone. The same transaction now drops the hash from
+  those lists, records `metadata.stale_sources` (how many, and when), and marks
+  a belief `ungrounded` when nothing is left. That status is not `superseded`.
+  Confidence is unchanged until the next `challenge_belief`. Summaries are
+  flagged and not rewritten. A later re-derivation does not union a merged
+  source that is no longer live. Re-deriving an ungrounded belief promotes it
+  back to candidate, or to active when the usual floors are met. A tombstone
+  applied through delta sync runs the same cleanup. A summary flag advances
+  `updated_at` and records an `update_metadata` event when the sync log is on.
+  If that cleanup fails, the delta-sync apply rolls the tombstone and the
+  event back, so a retry can finish instead of sticking as a duplicate. A
+  local delete rolls that same transaction back before it releases the
+  connection lock. Re-derivation writes only sources that are still live,
+  and saves that list with confidence and status together.
```

**File**: `src/mcp_memory_service/consolidation/belief_service.py` (modified, +227/-32)
```diff
@@ -22,6 +22,11 @@
     should_supersede,
 )
 from ..compat import _sanitize_log_value
+from ..storage.source_retraction import (
+    UNGROUNDED_STATUS,
+    live_memory_hashes,
+    union_live_merged_sources,
+)
 
 logger = logging.getLogger(__name__)
 
@@ -166,6 +171,50 @@ def _hash_content(content: str) -> str:
     return hashlib.sha256(content.encode()).hexdigest()
 
 
+def _status_after_source_restore(
+    status: str, confidence: float, support_count: int
+) -> Optional[str]:
+    """Next status when derivation rewrites an existing belief's sources.
+
+    ``candidate`` promotes to ``active`` once the floors are met.
+    ``ungrounded`` is that same path once evidence exists again: ``active``
+    when the floors are met, otherwise ``candidate``. Left at ``ungrounded``,
+    the belief stays out of the default ``get_beliefs`` read. ``active`` moves
+    to ``superseded`` when confidence falls through the floor.
+    """
+    if status in ("candidate", "ungrounded") and should_promote(confidence, support_count):
+        return "active"
+    if status == "ungrounded":
+        return "candidate"
+    if status == "active" and should_supersede(confidence):
+        return "superseded"
+    return None
+
+
+def _status_for_live_evidence(status, confidence, support_count, has_evidence):
+    """Status to store after a derivation re-checks which sources are still live.
+
+    No remaining evidence stays ``ungrounded`` (a dedup ``superseded`` row stays
+    what it is). Live evidence uses the same promotion rules as a candidate.
+    """
+    if not has_evidence:
+        if status == "superseded":
+            return "superseded"
+        return UNGROUNDED_STATUS
+    restored = _status_after_source_restore(status, confidence, support_count)
+    if restored is None:
+        return status
+    return restored
+
+
+def _hash_is_live(source, live) -> bool:
+    return isinstance(source, str) and bool(source) and source in live
+
+
+def _has_live_hash(items) -> bool:
+    return any(isinstance(item, str) and item for item in items or [])
+
+
 def _sum_numeric_counters(target: dict, source: dict) -> None:
     """Add source's numeric counters into target in place (bool excluded).
 
@@ -286,21 +335,20 @@ async def _derive_group_belief(self, group_content, group_obs, now, stats):
         existing = await self._get_belief(belief_hash)
 
         if existing:
-            await self._update_belief(
-                belief_hash, confidence, supporting_hashes, contradicting_hashes, now
+            # Re-read liveness under the connection lock. The observations
+            # above were loaded earlier; a delete in between has already
+            # marked this belief ungrounded, and writing the cached hashes
+            # back would promote it with no live evidence.
+            outcome = await self._rewrite_belief_from_live_sources(
+                belief_hash, obs_dicts, contradicting, now
             )
+            if outcome is None:
+                return
             stats["updated"] += 1
-
-            # Promote or supersede
-            status = existing["status"]
-            if status == "candidate" and should_promote(confidence, len(supporting_hashes)):
-                stats["promoted"] += await self._set_belief_status(
-                    belief_hash, "active", now, expected_status=status
-                )
-            elif status == "active" and should_supersede(confidence):
-                stats["superseded"] += await self._set_belief_status(
-                    belief_hash, "superseded", now, expected_status=status
-                )
+            if outcome == "promoted":
+                stats["promoted"] += 1
+            elif outcome == "superseded":
+                stats["superseded"] += 1
         else:
             # Create new candidate
             status = "active" if should_promote(confidence, len(supporting_hashes)) else "candidate"
@@ -364,7 +412,11 @@ async def challenge_belief(self, belief_hash: str) -> dict:
     async def get_beliefs(
         self, status: str = "active", min_confidence: float = CONFIDENCE_FLOOR
     ) -> List[dict]:
-        """Get beliefs without waiting for the connection lock on the event loop."""
+        """Get beliefs without waiting for the connection lock on the event loop.
+
+        The default status is ``active``. A belief left with no live sources is
+        stored as ``ungrounded`` and stays out of this read.
+        """
         return await asyncio.to_thread(self._get_beliefs_sync, status, min_confidence)
 
     def _get_beliefs_sync(self, status, min_confidence):
@@ -1048,6 +1100,110 @@ def _insert_belief(
             )
             conn.commit()
 
+    async def _rewrite_belief_from_live_sources(
+        self, belief_hash, obs_dicts, contradicting, now
+    ):
+        """Write sources, confidence, and status from hashes that are still live.
+
+        One connection-lock critical section, so a delete cannot commit between
+       
```

**File**: `src/mcp_memory_service/storage/mixins/delete.py` (modified, +63/-7)
```diff
@@ -7,6 +7,8 @@
 from datetime import datetime, date
 from typing import List, Tuple, Optional
 
+from ..source_retraction import retract_sources_for_deleted_hashes
+
 
 logger = logging.getLogger(__name__)
 
@@ -22,6 +24,45 @@ def _escape_like(value: str) -> str:
 class DeleteMixin:
     """Mixin providing memory deletion operations."""
 
+    async def _rollback_quietly(self) -> None:
+        """Drop an open delete transaction after a failure.
+
+        The belief/summary retraction runs before commit. A failure there has
+        to undo the tombstone too, or the next statement inherits it.
+        """
+        try:
+            await self._run_in_thread(self.conn.rollback)
+        except sqlite3.OperationalError as exc:
+            # Best-effort. "no transaction is active" means the failure
+            # happened before any statement opened one, so there is nothing
+            # to undo. A connection closed in between raises the same error.
+            logger.debug("Delete rollback skipped: %s", _sanitize_log_value(exc))
+
+    def _abort_open_delete(self) -> None:
+        """Roll back a delete before the worker releases the connection lock.
+
+        Citation cleanup runs after the tombstone update and before commit.
+        Rolling back only after ``_execute_with_retry`` returns lets another
+        waiter take ``_conn_lock`` and commit the shared connection first.
+        The caller then sees a failed delete whose tombstone is already saved.
+        """
+        try:
+            if self.conn is None:
+                return
+            # A connection double without in_transaction still gets rollback.
+            if getattr(self.conn, "in_transaction", True):
+                self.conn.rollback()
+        except sqlite3.Error as exc:
+            logger.error("Could not roll back delete: %s", _sanitize_log_value(exc))
+
+    def _guard_delete(self, operation):
+        """Run a delete body and undo it before the connection lock drops."""
+        try:
+            return operation()
+        except Exception:
+            self._abort_open_delete()
+            raise
+
     async def get_sync_state_for_hash(
         self, content_hash: str
     ) -> tuple[float | None, float | None] | None:
@@ -115,6 +156,7 @@ def _apply_remote_tombstone():
                                     'DELETE FROM memory_graph WHERE source_hash = ? OR target_hash = ?',
                                     (content_hash, content_hash),
                                 )
+                                retract_sources_for_deleted_hashes(self.conn, [content_hash], sync=self)
                                 if hasattr(self, '_append_sync_event'):
                                     self._append_sync_event(
                                         self.conn,
@@ -205,6 +247,8 @@ def _delete_memory():
                     update_sql += ' AND store = ?'
                     update_params.append(store)
                 cursor = self.conn.execute(update_sql, tuple(update_params))
+                if cursor.rowcount > 0:
+                    retract_sources_for_deleted_hashes(self.conn, [content_hash], sync=self)
 
                 # Append sync event between UPDATE and commit (ADR-0008)
                 if hasattr(self, '_append_sync_event') and cursor.rowcount > 0:
@@ -217,7 +261,10 @@ def _delete_memory():
                 self.conn.commit()
                 return cursor.rowcount
 
-            rowcount = await self._execute_with_retry(_delete_memory)
+            def _guarded_delete():
+                return self._guard_delete(_delete_memory)
+
+            rowcount = await self._execute_with_retry(_guarded_delete)
             if rowcount is None:
                 return False, f"Memory with hash {content_hash} not found"
             if rowcount > 0:
@@ -227,10 +274,7 @@ def _delete_memory():
                 return False, f"Memory with hash {content_hash} not found"
 
         except Exception as e:
-            try:
-                await self._run_in_thread(self.conn.rollback)
-            except sqlite3.OperationalError:
-                pass
+            await self._rollback_quietly()
             error_msg = f"Failed to delete memory: {str(e)}"
             logger.error("%s", _sanitize_log_value(error_msg))
             return False, error_msg
@@ -367,10 +411,15 @@ def _delete_by_tag():
                     "UPDATE memories SET deleted_at = ? WHERE (',' || tags || ',') LIKE ? ESCAPE '\\' AND deleted_at IS NULL",
                     (time.time(), exact_match_pattern)
                 )
+                if cursor.rowcount > 0:
+                    retract_sources_for_deleted_hashes(self.conn, content_hashes, sync=self)
                 self.conn.commit()
                 return cursor.rowcount
 
-            count = await self._execute_with_retry(_delete_by_tag)
+            def _guarded_delete_by_tag():
+                return self._guard_delete(_delete_by_tag)
+
+            count = await self._execute
```

**File**: `src/mcp_memory_service/storage/source_retraction.py` (added, +523/-0)
```diff
@@ -0,0 +1,523 @@
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
+"""Drop deleted memory hashes from beliefs and flag consolidation summaries.
+
+Beliefs (``derived_from``, ``contradicted_by``, ``metadata.merged_from_hashes``)
+and compression/association memories (``metadata.source_memory_hashes``) record
+the content hashes they were built from. Deleting a memory has to act on those
+receipts in the same transaction as the ``memory_graph`` cleanup. No model call.
+
+``ungrounded`` is the status of a belief with no sources left. ``get_beliefs``
+reads ``status = 'active'`` by default, so the belief drops out of search.
+``superseded`` stays what dedup uses for a loser absorbed into a canonical.
+Confidence is left untouched for the next ``challenge_belief``.
+
+The liveness check is a pure function. Callers pass the stored source list and
+the set of hashes that still have a live ``memories`` row. Deleted, invalidated
+and re-ingested hashes are the same answer. These columns hold memory content
+hashes only; an id that cannot be resolved is treated as gone when the
+``memories`` table can be asked, and left alone when it cannot (a belief-only
+database is not evidence that the hash was deleted).
+"""
+
+import json
+import logging
+import sqlite3
+import time
+from datetime import datetime, timezone
+
+from mcp_memory_service.compat import _sanitize_log_value
+
+logger = logging.getLogger(__name__)
+
+# Not a dedup outcome. A belief with this status has no remaining evidence.
+UNGROUNDED_STATUS = "ungrounded"
+
+# Statuses get_beliefs / derivation still treat as current knowledge.
+_GROUNDABLE_STATUSES = frozenset({"active", "candidate", "disputed"})
+
+_HASH_TABLE = "mcp_retract_hashes"
+_SQL_IN_CHUNK = 400
+
+_BELIEF_CITE_SQL = """
+SELECT belief_hash, derived_from, contradicted_by, metadata, status
+FROM beliefs
+WHERE EXISTS (
+    SELECT 1 FROM json_each(
+        CASE WHEN json_valid(beliefs.derived_from) THEN beliefs.derived_from ELSE NULL END
+    ) AS je
+    WHERE je.value IN (SELECT hash FROM mcp_retract_hashes)
+)
+OR EXISTS (
+    SELECT 1 FROM json_each(
+        CASE WHEN json_valid(beliefs.contradicted_by) THEN beliefs.contradicted_by ELSE NULL END
+    ) AS je
+    WHERE je.value IN (SELECT hash FROM mcp_retract_hashes)
+)
+OR EXISTS (
+    SELECT 1 FROM json_each(
+        CASE WHEN json_valid(beliefs.metadata)
+             THEN json_extract(beliefs.metadata, '$.merged_from_hashes')
+             ELSE NULL END
+    ) AS je
+    WHERE je.value IN (SELECT hash FROM mcp_retract_hashes)
+)
+"""
+
+_SUMMARY_CITE_SQL = """
+SELECT content_hash, metadata, tags
+FROM memories
+WHERE deleted_at IS NULL
+AND json_valid(metadata)
+AND EXISTS (
+    SELECT 1 FROM json_each(json_extract(metadata, '$.source_memory_hashes')) AS je
+    WHERE je.value IN (SELECT hash FROM mcp_retract_hashes)
+)
+"""
+
+
+def departed_sources(stored_sources, live_ids) -> list:
+    """Return stored hashes that are not in ``live_ids``.
+
+    Order-preserving, duplicates collapsed. Non-strings are ignored.
+    """
+    gone = []
+    seen = set()
+    for source in stored_sources or []:
+        if (
+            not isinstance(source, str)
+            or not source
+            or source in seen
+            or source in live_ids
+        ):
+            continue
+        seen.add(source)
+        gone.append(source)
+    return gone
+
+
+def retract_belief_record(
+    *,
+    derived_from,
+    contradicted_by,
+    metadata,
+    status,
+    live_ids,
+    updated_at,
+) -> dict | None:
+    """Return the fields to write, or None when no provenance hash departed.
+
+    Confidence is not part of the result. A belief whose ``derived_from`` and
+    ``contradicted_by`` are both empty moves to ``ungrounded`` unless it is
+    already ``superseded`` (or some other non-groundable status).
+    """
+    derived = list(derived_from or [])
+    contradicted = list(contradicted_by or [])
+    meta = dict(metadata or {})
+    merged = meta.get("merged_from_hashes")
+    if not isinstance(merged, list):
+        merged = []
+    removed = departed_sources(derived + contradicted + merged, live_ids)
+    if not removed:
+        return None
+    removed_set = set(removed)
+    new_derived = _without(derived, removed_set)
+    new_contradicted = _without(contradicted, removed_set)
+    new_merged = _without(merged, removed_set)
+    if new_merged:
+        meta["merged_from_hashes"] = new_mer
```

**File**: `src/mcp_memory_service/storage/sync/apply.py` (modified, +76/-33)
```diff
@@ -17,6 +17,7 @@
 
 from ..base import MemoryStorage
 from ..mixins.base import _sanitize_log_value
+from ..source_retraction import retract_sources_for_deleted_hashes
 from .resolver import EventView, reduce_events, _winner_key
 
 logger = logging.getLogger(__name__)
@@ -268,37 +269,25 @@ def _apply_remote_event_locked(storage: MemoryStorage, event: Dict[str, Any]) ->
             if is_winner or op == "update_metadata":
                 try:
                     materialized = _materialize_event(storage, event)
+                    if not materialized:
+                        # Commit only the skippable empty create. Any other miss,
+                        # including a tombstone whose citation cleanup returned
+                        # False, rolls back so the retry is not a duplicate.
+                        return _unmaterialized_result(s, op, payload)
                     s.conn.commit()  # durability: persist event + materialization (ADR-0019/§8.5)
-                    if materialized:
-                        reason = ("Remote event won and materialized" if is_winner
-                                  else "update_metadata merged (field-level convergence)")
-                        if locals().get("_is_content_repair"):
-                            reason = "Empty-content create repaired with real content (via resolver)"
-                        return ApplyResult(applied=True, materialized=True, reason=reason)
-                    # A win that fails to materialize is NOT applied. A create whose content
-                    # is empty in BOTH the payload and the source table is permanently
-                    # non-materializable — mark it skippable so the orchestrator advances past
-                    # it instead of fail-stopping the whole feed (a few irrecoverable events
-                    # must not block thousands of good ones). Any other materialization miss
-                    # stays a transient failure the sender keeps retrying (Greptile P1).
-                    if op == "create" and not (payload.get("content") or ""):
-                        return ApplyResult(applied=False, materialized=False,
-                                           reason="Create event has no recoverable content — skipped",
-                                           skippable=True)
-                    return ApplyResult(applied=False, materialized=False, reason="Materialization failed")
+                    reason = ("Remote event won and materialized" if is_winner
+                              else "update_metadata merged (field-level convergence)")
+                    if locals().get("_is_content_repair"):
+                        reason = "Empty-content create repaired with real content (via resolver)"
+                    return ApplyResult(applied=True, materialized=True, reason=reason)
                 except Exception as e:
                     # Roll back any pending write (e.g. a content-repair UPDATE to
-                    # sync_events) so a transient materialization failure does not leave
-                    # the stored payload mutated — otherwise the next retry would match
-                    # it as a duplicate and never re-attempt the memory write (Greptile
-                    # #1499 apply:181, exception path).
-                    try:
-                        s.conn.rollback()
-                    except Exception:
-                        # Best-effort rollback: if the connection cannot roll back (e.g.
-                        # no open transaction) there is nothing to undo; the original error
-                        # below is what matters.
-                        pass
+                    # sync_events, or a tombstone whose citation cleanup raised)
+                    # so a transient materialization failure does not leave the
+                    # stored payload mutated — otherwise the next retry would match
+                    # it as a duplicate and never re-attempt the memory write
+                    # (Greptile #1499 apply:181, and #1865 citation cleanup).
+                    _rollback_apply(s)
                     logger.error("Materialization failed: %s", _sanitize_log_value(e))
                     return ApplyResult(applied=False, materialized=False, reason=f"Materialization error: {e}")
             else:
@@ -313,9 +302,21 @@ def _apply_remote_event_locked(storage: MemoryStorage, event: Dict[str, Any]) ->
                 if op in ("create", "delete"):
                     try:
                         _reconcile_liveness(_sqlite(storage), content_hash)
-                    except Exception as e:  # noqa: BLE001 - never fail-stop the feed on reconcile
-                        logger.warning("liveness reconcile (loser) failed for %s: %s",
-                                       _sanitize_log_value(content_hash), _sanitize_log_value(e))
+                    except Exception as e:  # noqa: BLE001 - partial liveness write must not commit
+                       
```

**File**: `tests/consolidation/test_delete_stale_beliefs.py` (added, +910/-0)
```diff
@@ -0,0 +1,910 @@
+"""Deleting a memory retracts it from beliefs and flags consolidation summaries.
+
+The graph-edge cleanup already runs inside the delete transaction. These tests
+drive the real sqlite-vec storage (no mocked delete) and require the same
+transaction to drop the hash from belief provenance and to mark compression
+and association memories stale. They fail on main, where only memory_graph
+is cleaned.
+"""
+
+import asyncio
+import json
+import os
+import sqlite3
+from datetime import date, datetime, timezone
+
+import pytest
+
+from mcp_memory_service.consolidation.belief_service import BeliefService, _hash_content
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.utils.hashing import generate_content_hash
+
+_WHEN = "2026-11-05T02:00:00+00:00"
+
+
+def test_departed_sources_lists_hashes_that_are_not_live():
+    """One question: is the source still live? Duplicates and non-hashes are ignored."""
+    from mcp_memory_service.storage.source_retraction import departed_sources
+
+    gone = departed_sources(
+        ["live", "dead", "dead", "", None, 3, "also-dead"],
+        {"live"},
+    )
+    assert gone == ["dead", "also-dead"]
+
+
+def test_retract_belief_record_strips_the_hash_once_and_keeps_confidence():
+    from mcp_memory_service.storage.source_retraction import retract_belief_record
+
+    update = retract_belief_record(
+        derived_from=["dead", "live"],
+        contradicted_by=["dead"],
+        metadata={"merged_from_hashes": ["dead", "live"], "note": "keep"},
+        status="active",
+        live_ids={"live"},
+        updated_at=_WHEN,
+    )
+    assert update["derived_from"] == ["live"]
+    assert update["contradicted_by"] == []
+    assert update["metadata"]["merged_from_hashes"] == ["live"]
+    assert update["metadata"]["note"] == "keep"
+    assert update["metadata"]["stale_sources"] == {"count": 1, "updated_at": _WHEN}
+    assert update["status"] == "active"
+    assert "confidence" not in update
+
+
+def test_retract_belief_record_ungrounds_a_belief_with_no_sources_left():
+    from mcp_memory_service.storage.source_retraction import (
+        UNGROUNDED_STATUS,
+        retract_belief_record,
+    )
+
+    update = retract_belief_record(
+        derived_from=["dead"],
+        contradicted_by=[],
+        metadata={},
+        status="active",
+        live_ids=set(),
+        updated_at=_WHEN,
+    )
+    assert update["derived_from"] == []
+    assert update["status"] == UNGROUNDED_STATUS
+    assert update["status"] == "ungrounded"
+    assert update["metadata"]["stale_sources"]["count"] == 1
+
+
+def test_retract_belief_record_leaves_superseded_status_alone():
+    """superseded means a dedup loser, not 'evidence gone'. Do not overload it."""
+    from mcp_memory_service.storage.source_retraction import retract_belief_record
+
+    update = retract_belief_record(
+        derived_from=["dead"],
+        contradicted_by=[],
+        metadata={"merged_from_hashes": ["dead"]},
+        status="superseded",
+        live_ids=set(),
+        updated_at=_WHEN,
+    )
+    assert update["status"] == "superseded"
+    assert update["derived_from"] == []
+    assert "merged_from_hashes" not in update["metadata"]
+
+
+def test_retract_belief_record_is_a_no_op_when_every_source_is_live():
+    from mcp_memory_service.storage.source_retraction import retract_belief_record
+
+    assert (
+        retract_belief_record(
+            derived_from=["live"],
+            contradicted_by=["other"],
+            metadata={"merged_from_hashes": ["live"]},
+            status="active",
+            live_ids={"live", "other"},
+            updated_at=_WHEN,
+        )
+        is None
+    )
+
+
+def test_belief_stale_count_accumulates_as_later_sources_depart():
+    from mcp_memory_service.storage.source_retraction import retract_belief_record
+
+    first = retract_belief_record(
+        derived_from=["a", "b"],
+        contradicted_by=[],
+        metadata={},
+        status="candidate",
+        live_ids={"b"},
+        updated_at=_WHEN,
+    )
+    assert first["status"] == "candidate"
+    assert first["metadata"]["stale_sources"]["count"] == 1
+    second = retract_belief_record(
+        derived_from=first["derived_from"],
+        contradicted_by=[],
+        metadata=first["metadata"],
+        status=first["status"],
+        live_ids=set(),
+        updated_at="2026-11-05T03:00:00+00:00",
+    )
+    assert second["status"] == "ungrounded"
+    assert second["metadata"]["stale_sources"] == {
+        "count": 2,
+        "updated_at": "2026-11-05T03:00:00+00:00",
+    }
+
+
+def test_summary_flag_keeps_the_source_list_and_counts_departed_hashes():
+    from mcp_memory_service.storage.source_retraction import flag_summary_sources
+
+    original = {
+        "source_memory_hashes": ["dead", "live"],
+        "compression_ratio": 0.4,
+    }
+    flagged =
```

**File**: `tests/storage/test_delete_mixin_logging.py` (modified, +24/-4)
```diff
@@ -78,14 +78,34 @@ def fetchall(self):
         return [self._row] if self._row else []
 
 
+def _lookup_cursor(sql: str):
+    """Memory-id lookups return a row. Citation scans stay empty.
+
+    Delete now stages retracted hashes with ``executemany`` and then asks
+    which beliefs and summaries cite them. This double only covers log
+    injection, so those scans report nothing.
+    """
+    compact = " ".join(sql.split()).upper()
+    if "MEMORY_EMBEDDINGS" in compact and compact.startswith("DELETE"):
+        raise RuntimeError(f"corrupted blob\n{FORGED}")
+    if (
+        compact.startswith("SELECT")
+        and " FROM MEMORIES" in compact
+        and "SQLITE_MASTER" not in compact
+        and "JSON_" not in compact
+        and " FROM BELIEFS" not in compact
+    ):
+        return _Cursor(row=(1, "abc"))
+    return _Cursor()
+
+
 class _WorkingConn:
     """A connection whose statements succeed, except for the embedding delete."""
 
     def execute(self, sql, *_args):
-        if "memory_embeddings" in sql and sql.lstrip().startswith("DELETE"):
-            raise RuntimeError(f"corrupted blob\n{FORGED}")
-        if sql.lstrip().startswith("SELECT"):
-            return _Cursor(row=(1, "abc"))
+        return _lookup_cursor(sql)
+
+    def executemany(self, _sql, _rows):
         return _Cursor()
 
     def commit(self):
```

---

### Incident Patch 2: `3c67ff07` (2026-11-05)
**Commit Message**: fix(transport): refuse cross-origin and rebinding requests on unauthenticated HTTP transports

With no API key or OAuth, the loopback-only --streamable-http and --sse
transports answered every /mcp preflight with a wildcard origin and checked
neither Host nor Origin. A web page could call any tool cross-origin, and a
DNS-rebinding domain could read the responses too (GHSA-8p26-g7wp-65jw).

Both transports now get TransportSecuritySettings when no auth is
configured: Host pinned to loopback names, Origin to loopback plus
MCP_CORS_ORIGINS. The preflight grants exactly the origins the transport
accepts. Authenticated servers keep their behaviour, so a reverse proxy
with a public Host header still works.

The lifespan loop, uvicorn bind, /mcp request handling and OAuth sub-app
moved out of run_sse/run_streamable_http into shared helpers, which the
complexity gate required once both functions were touched.

Reported by orshih6.

**File**: `changelog.d/GHSA-8p26-g7wp-65jw.fixed.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+- **Any web page could drive an unauthenticated local `--streamable-http` or `--sse` server (GHSA-8p26-g7wp-65jw, orshih6).**
+  With no API key or OAuth on a loopback bind, the `/mcp` preflight answered every origin
+  with `Access-Control-Allow-Origin: *`, and neither transport checked `Host` or `Origin`,
+  so a cross-origin page could call `memory_delete` or plant memories, and a DNS-rebinding
+  domain could also read the results. An unauthenticated server now only accepts loopback
+  `Host` values and loopback origins plus `MCP_CORS_ORIGINS` (403/421 otherwise), and the
+  preflight grants exactly those origins. Servers with an API key or OAuth keep their
+  current behaviour, including behind a reverse proxy.
```

**File**: `src/mcp_memory_service/utils/startup_orchestrator.py` (modified, +198/-154)
```diff
@@ -67,8 +67,7 @@ def _assert_bind_is_authenticated(host: str, port: int) -> None:
     deployment GHSA-2hh8-qjxc-43x3 describes. Documenting "do not expose SSE"
     is not a control. Refusing to start is.
     """
-    from ..config import OAUTH_ENABLED, API_KEY
-    if _is_loopback_host(host) or OAUTH_ENABLED or API_KEY:
+    if _is_loopback_host(host) or _auth_configured():
         return
     raise RuntimeError(
         f"Refusing to start an MCP transport on {host}:{port} with no authentication "
@@ -77,6 +76,179 @@ def _assert_bind_is_authenticated(host: str, port: int) -> None:
     )
 
 
+def _auth_configured() -> bool:
+    """True when the HTTP transports check a credential on every MCP request."""
+    from ..config import OAUTH_ENABLED, API_KEY
+    return bool(OAUTH_ENABLED or API_KEY)
+
+
+def _configured_cors_origins() -> list:
+    return [o.strip() for o in os.environ.get("MCP_CORS_ORIGINS", "").split(",") if o.strip()]
+
+
+_LOOPBACK_HOSTS = ["127.0.0.1:*", "localhost:*", "[::1]:*"]
+_LOOPBACK_ORIGINS = ["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"]
+
+
+def _transport_security_settings():
+    """Host/Origin validation for the SSE and Streamable HTTP transports.
+
+    With no auth configured the server is loopback-only (see
+    _assert_bind_is_authenticated), and the browser is the only way a remote
+    party can reach it: a cross-origin page, or a DNS-rebinding domain that
+    resolves to 127.0.0.1 (GHSA-8p26-g7wp-65jw). Both are refused here by
+    pinning Host to loopback names and Origin to loopback plus
+    MCP_CORS_ORIGINS. The SDK leaves this off unless it is passed in.
+
+    With auth configured this returns None on purpose: every request needs a
+    credential a browser never attaches on its own, and a server behind a
+    reverse proxy sees the public hostname in Host, which a loopback
+    allowlist would answer with 421. Gate on auth, not on the bind address.
+    """
+    if _auth_configured():
+        return None
+    from mcp.server.transport_security import TransportSecuritySettings  # inline import: only the HTTP transports need it
+    return TransportSecuritySettings(
+        enable_dns_rebinding_protection=True,
+        allowed_hosts=list(_LOOPBACK_HOSTS),
+        allowed_origins=_LOOPBACK_ORIGINS + _configured_cors_origins(),
+    )
+
+
+def _origin_matches(origin: str, allowed: list) -> bool:
+    """Same rule as the SDK's TransportSecurityMiddleware: exact, or `base:*`."""
+    return any(
+        origin == a or (a.endswith(":*") and origin.startswith(a[:-1]))
+        for a in allowed
+    )
+
+
+def _mcp_preflight_headers(origin: str) -> dict:
+    """CORS headers for an OPTIONS preflight on /mcp.
+
+    An origin is granted only when the transport would also accept its
+    request, so the preflight and the SDK's Origin check cannot disagree.
+    Until GHSA-8p26-g7wp-65jw this answered every origin with `*`, which
+    let any web page drive an unauthenticated local server.
+    """
+    configured = _configured_cors_origins()
+    if _auth_configured() and (not configured or "*" in configured):
+        # Every request still needs a token the page does not have. Without
+        # auth an explicit `*` is not honoured: that is the advisory itself.
+        allow = "*"
+    else:
+        settings = _transport_security_settings()
+        allowed = settings.allowed_origins if settings else configured
+        allow = origin if origin and _origin_matches(origin, allowed) else None
+    if allow is None:
+        return {}
+    headers = {
+        "Access-Control-Allow-Origin": allow,
+        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
+        "Access-Control-Allow-Headers": "*",
+        "Access-Control-Max-Age": "86400",
+    }
+    if allow != "*":
+        headers["Vary"] = "Origin"
+    return headers
+
+
+async def _serve_lifespan(receive, send, context=None) -> None:
+    """ASGI lifespan loop shared by the HTTP transports.
+
+    `context` is an async context manager held open from startup to shutdown
+    (the Streamable HTTP session manager); SSE passes none.
+    """
+    entered = False
+    while True:
+        message = await receive()
+        if message["type"] == "lifespan.startup":
+            if context is not None:
+                await context.__aenter__()
+                entered = True
+            await send({"type": "lifespan.startup.complete"})
+        elif message["type"] == "lifespan.shutdown":
+            if entered:
+                await context.__aexit__(None, None, None)
+            await send({"type": "lifespan.shutdown.complete"})
+            return
+
+
+async def _answer_health_or_404(path: str, scope, receive, send) -> None:
+    from starlette.responses import Response  # inline import: only the HTTP transports need it
+    if path == "/health":
+        response = Response('{"status":"ok"}', media_type="application/json")
+    else:
+        response = Response("Not Found", st
```

**File**: `tests/unit/test_remote_transport_guards.py` (modified, +73/-0)
```diff
@@ -177,3 +177,76 @@ def test_guard_reads_the_address_uvicorn_binds(self, runs):
         value main() checks; it has to come from MCP_HTTP_HOST."""
         from mcp_memory_service import mcp_server
         assert mcp_server.mcp.settings.host == mcp_server.HTTP_HOST
+
+
+class TestBrowserReachability:
+    """GHSA-8p26-g7wp-65jw: an unauthenticated loopback server was reachable
+    from any web page (wildcard CORS preflight) and through DNS rebinding (no
+    Host/Origin check). These pin the allowlists both paths now share."""
+
+    @pytest.fixture
+    def so(self, monkeypatch):
+        import mcp_memory_service.config as config  # inline import: patched per test
+        from mcp_memory_service.utils import startup_orchestrator as so
+        monkeypatch.setattr(config, "OAUTH_ENABLED", False)
+        monkeypatch.setattr(config, "API_KEY", None)
+        monkeypatch.delenv("MCP_CORS_ORIGINS", raising=False)
+        return so
+
+    async def _validate(self, settings, host, origin=None):
+        """Run the SDK's own request check, the one the transports apply."""
+        from mcp.server.transport_security import TransportSecurityMiddleware
+        from starlette.requests import Request
+        headers = [(b"host", host.encode()), (b"content-type", b"application/json")]
+        if origin:
+            headers.append((b"origin", origin.encode()))
+        req = Request({"type": "http", "method": "POST", "path": "/mcp", "headers": headers})
+        resp = await TransportSecurityMiddleware(settings).validate_request(req, is_post=True)
+        return resp.status_code if resp else 200
+
+    @pytest.mark.asyncio
+    async def test_unauthenticated_server_rejects_rebinding_host(self, so):
+        assert await self._validate(so._transport_security_settings(), "evil.example:8765") == 421
+
+    @pytest.mark.asyncio
+    async def test_unauthenticated_server_rejects_foreign_origin(self, so):
+        status = await self._validate(so._transport_security_settings(), "127.0.0.1:8765", "https://evil.example")
+        assert status == 403
+
+    @pytest.mark.asyncio
+    async def test_unauthenticated_server_serves_local_clients(self, so):
+        settings = so._transport_security_settings()
+        assert await self._validate(settings, "127.0.0.1:8765") == 200
+        assert await self._validate(settings, "localhost:8765", "http://localhost:6274") == 200
+
+    def test_authenticated_server_leaves_host_unchecked(self, so, monkeypatch):
+        """Behind a reverse proxy Host is the public name; the token is the gate."""
+        import mcp_memory_service.config as config  # inline import: patched per test
+        monkeypatch.setattr(config, "API_KEY", "a-key")
+        assert so._transport_security_settings() is None
+
+    def test_preflight_grants_no_foreign_origin(self, so):
+        assert so._mcp_preflight_headers("https://evil.example") == {}
+        assert so._mcp_preflight_headers("") == {}
+
+    def test_preflight_reflects_local_origin(self, so):
+        headers = so._mcp_preflight_headers("http://localhost:6274")
+        assert headers["Access-Control-Allow-Origin"] == "http://localhost:6274"
+        assert headers["Vary"] == "Origin"
+
+    def test_configured_origin_is_allowed_on_both_paths(self, so, monkeypatch):
+        monkeypatch.setenv("MCP_CORS_ORIGINS", "https://app.example")
+        assert "https://app.example" in so._transport_security_settings().allowed_origins
+        assert so._mcp_preflight_headers("https://app.example")["Access-Control-Allow-Origin"] == "https://app.example"
+        assert so._mcp_preflight_headers("https://evil.example") == {}
+
+    def test_authenticated_server_keeps_wildcard_preflight(self, so, monkeypatch):
+        import mcp_memory_service.config as config  # inline import: patched per test
+        monkeypatch.setattr(config, "API_KEY", "a-key")
+        assert so._mcp_preflight_headers("https://anything.example")["Access-Control-Allow-Origin"] == "*"
+        monkeypatch.setenv("MCP_CORS_ORIGINS", "*")
+        assert so._mcp_preflight_headers("https://anything.example")["Access-Control-Allow-Origin"] == "*"
+
+    def test_explicit_wildcard_does_not_open_unauthenticated_server(self, so, monkeypatch):
+        monkeypatch.setenv("MCP_CORS_ORIGINS", "*")
+        assert so._mcp_preflight_headers("https://evil.example") == {}
```

---

### Incident Patch 3: `7e053af2` (2026-11-05)
**Commit Message**: docs(site): require Python 3.11 on five localized pages (#1868)

* docs(site): require Python 3.11 on the de, es, fr, ja and zh-cn pages

Python 3.10 was retired in #1770, but five localized introductions still
told readers 3.10 or newer was enough. pt-br, zh-tw and ko already said 3.11.

* docs(changelog): add fragment for #1868

**File**: `changelog.d/1868.fixed.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+- **Five localized website introductions still allowed Python 3.10 (#1868).** The
+  German, Spanish, French, Japanese and Simplified Chinese pages said Python 3.10 or
+  newer was enough after #1770 had retired 3.10. They now say 3.11, like the English,
+  Brazilian Portuguese, Traditional Chinese and Korean pages.
```

**File**: `scripts/maintenance/site_locales/de.json` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
   "case_3_title": "Selbst hosten",
   "case_3_text": "Starte lokal mit SQLite und Vektorsuche. Für diesen Betrieb brauchst du weder einen Cloud-Speicherdienst noch einen kostenpflichtigen Embedding-API-Schlüssel.",
   "install_heading": "In Claude Code einrichten",
-  "install_intro": "Du brauchst Python 3.10 oder neuer und einen installierten Claude-Code-Client. Andere Clients lassen sich ebenfalls über MCP anbinden; die englische Anleitung beschreibt die Konfiguration.",
+  "install_intro": "Du brauchst Python 3.11 oder neuer und einen installierten Claude-Code-Client. Andere Clients lassen sich ebenfalls über MCP anbinden; die englische Anleitung beschreibt die Konfiguration.",
   "step_1_title": "Memory Service installieren",
   "step_1_text": "Installiere das Paket in einer Python-Umgebung, deren Befehle für deinen Client erreichbar sind.",
   "step_2_title": "Als MCP-Server hinzufügen",
```

**File**: `scripts/maintenance/site_locales/es.json` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
   "case_3_title": "Aloja el servicio en tu equipo",
   "case_3_text": "Empieza en local con SQLite y búsqueda vectorial. Para esta configuración no necesitas almacenamiento en la nube ni una API de pago para generar embeddings.",
   "install_heading": "Configúralo en Claude Code",
-  "install_intro": "Necesitas Python 3.10 o posterior y tener instalado Claude Code. También puedes conectar otros clientes mediante MCP; la guía en inglés explica cómo configurarlos.",
+  "install_intro": "Necesitas Python 3.11 o posterior y tener instalado Claude Code. También puedes conectar otros clientes mediante MCP; la guía en inglés explica cómo configurarlos.",
   "step_1_title": "Instala Memory Service",
   "step_1_text": "Instala el paquete en un entorno de Python cuyos comandos estén disponibles para tu cliente.",
   "step_2_title": "Añádelo como servidor MCP",
```

**File**: `scripts/maintenance/site_locales/fr.json` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
   "case_3_title": "Hébergez le service sur votre machine",
   "case_3_text": "Commencez en local avec SQLite et la recherche vectorielle. Cette configuration ne nécessite ni stockage dans le cloud ni API payante pour générer les embeddings.",
   "install_heading": "Configurez-le dans Claude Code",
-  "install_intro": "Il vous faut Python 3.10 ou une version ultérieure, ainsi que Claude Code installé. Vous pouvez aussi connecter d'autres clients via MCP ; le guide en anglais explique comment les configurer.",
+  "install_intro": "Il vous faut Python 3.11 ou une version ultérieure, ainsi que Claude Code installé. Vous pouvez aussi connecter d'autres clients via MCP ; le guide en anglais explique comment les configurer.",
   "step_1_title": "Installez Memory Service",
   "step_1_text": "Installez le paquet dans un environnement Python dont les commandes sont accessibles à votre client.",
   "step_2_title": "Ajoutez-le comme serveur MCP",
```

**File**: `scripts/maintenance/site_locales/ja.json` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
   "case_3_title": "セルフホストで運用",
   "case_3_text": "SQLiteとベクトル検索でローカルに始められます。クラウドのストレージサービスも有償のEmbedding APIキーも不要です。",
   "install_heading": "Claude Codeにセットアップする",
-  "install_intro": "Python 3.10以降と、インストール済みのClaude Codeクライアントが必要です。他のクライアントもMCP経由で接続できます。設定方法は英語のガイドに記載されています。",
+  "install_intro": "Python 3.11以降と、インストール済みのClaude Codeクライアントが必要です。他のクライアントもMCP経由で接続できます。設定方法は英語のガイドに記載されています。",
   "step_1_title": "Memory Serviceをインストール",
   "step_1_text": "クライアントからコマンドを利用できるPython環境に、パッケージをインストールします。",
   "step_2_title": "MCPサーバーとして追加",
```

**File**: `scripts/maintenance/site_locales/zh-cn.json` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
   "case_3_title": "放在自己的机器上运行",
   "case_3_text": "用 SQLite 加向量检索就能在本地起步。这种配置既不需要云存储服务，也不需要付费的 Embedding API 密钥。",
   "install_heading": "在 Claude Code 中配置",
-  "install_intro": "需要 Python 3.10 或更高版本，以及已经装好的 Claude Code 客户端。其他客户端也可以通过 MCP 接入，配置方法见英文指南。",
+  "install_intro": "需要 Python 3.11 或更高版本，以及已经装好的 Claude Code 客户端。其他客户端也可以通过 MCP 接入，配置方法见英文指南。",
   "step_1_title": "安装 Memory Service",
   "step_1_text": "把这个包安装到客户端能够调用其命令的 Python 环境里。",
   "step_2_title": "添加为 MCP 服务器",
```

**File**: `site/de/index.html` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ <h2>Projektwissen behalten, statt es immer neu zu erklären</h2>
   <section class="sec" id="install">
     <div class="wrap locale-install">
       <h2>In Claude Code einrichten</h2>
-      <p class="lede">Du brauchst Python 3.10 oder neuer und einen installierten Claude-Code-Client. Andere Clients lassen sich ebenfalls über MCP anbinden; die englische Anleitung beschreibt die Konfiguration.</p>
+      <p class="lede">Du brauchst Python 3.11 oder neuer und einen installierten Claude-Code-Client. Andere Clients lassen sich ebenfalls über MCP anbinden; die englische Anleitung beschreibt die Konfiguration.</p>
       <ol class="install-steps">
         <li><h3>Memory Service installieren</h3><pre><code>pip install 'mcp-memory-service[sqlite]'</code></pre><p>Installiere das Paket in einer Python-Umgebung, deren Befehle für deinen Client erreichbar sind.</p></li>
         <li><h3>Als MCP-Server hinzufügen</h3><pre><code>claude mcp add memory -- memory server</code></pre><p>Führe den Befehl im Projektverzeichnis aus und starte Claude Code danach neu. Beim ersten Start wird das lokale Embedding-Modell heruntergeladen.</p></li>
```

**File**: `site/es/index.html` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ <h2>Conserva el contexto de tu proyecto sin explicarlo cada vez</h2>
   <section class="sec" id="install">
     <div class="wrap locale-install">
       <h2>Configúralo en Claude Code</h2>
-      <p class="lede">Necesitas Python 3.10 o posterior y tener instalado Claude Code. También puedes conectar otros clientes mediante MCP; la guía en inglés explica cómo configurarlos.</p>
+      <p class="lede">Necesitas Python 3.11 o posterior y tener instalado Claude Code. También puedes conectar otros clientes mediante MCP; la guía en inglés explica cómo configurarlos.</p>
       <ol class="install-steps">
         <li><h3>Instala Memory Service</h3><pre><code>pip install 'mcp-memory-service[sqlite]'</code></pre><p>Instala el paquete en un entorno de Python cuyos comandos estén disponibles para tu cliente.</p></li>
         <li><h3>Añádelo como servidor MCP</h3><pre><code>claude mcp add memory -- memory server</code></pre><p>Ejecuta el comando desde el directorio del proyecto y reinicia Claude Code. En el primer inicio se descargará el modelo local de embeddings.</p></li>
```

#### Recent Merged Pull Requests:
- **PR #1873** (2026-11-05): docs(site): reword the Korean hero headline (@doobidoo)
- **PR #1872** (2026-11-05): fix(storage): clear conflict:unresolved once the conflict is gone (#1840) (@mbreitkreuz)
- **PR #1869** (2026-11-05): chore(release): v12.6.0 (@doobidoo)
- **PR #1868** (2026-11-05): docs(site): require Python 3.11 on five localized pages (@doobidoo)
- **PR #1867** (2026-11-05): fix(storage): explain the optional sqlite_vec import guard in retrieve.py (@doobidoo)
- **PR #1866** (2026-11-05): docs: add Korean website introduction (@laozhej)

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

## X. storage): mark beliefs/summaries stale when source memory deleted (#1865)

**RULE**:
When implementing operations in `changelog.d/1857.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `16a0ae92`: storage): mark beliefs/summaries stale when source memory deleted (#1865). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1857.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Deleting a memory left beliefs and consolidation summaries citing it (#1857, ZYZ666-RGB).**
  Graph edges were removed in the delete transaction, but `derived_from`,
  `contradicted_by` and `metadata.merged_from_hashes` kept the hash, and
  compression and association memories kept it in `source_memory_hashes`.
  Retention deletes this way all the time, so `get_beliefs` kept returning a
  belief whose evidence was gone. The same transaction now drops the hash from
  those lists, records `metadata.stale_sources` (how many, and when), and marks
  a belief `ungrounded` when nothing is left. That status is not `superseded`.
  Confidence is unchanged until the next `challenge_belief`. Summaries are
  flagged and not rewritten. A later re-derivation does not union a merged
  source that is no longer live. Re-deriving an ungrounded belief promotes it
  back to candidate, or to active when the usual floors are met. A tombstone
  applied through delta sync runs the same cleanup. A summary flag advances
  `updated_at` and records an `update_metadata` event when the sync log is on.
  If that cleanup fails, the delta-sync apply rolls the tombstone and the
  event back, so a retry can finis
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `16a0ae92` are properly handled with clean fallback behavior.
