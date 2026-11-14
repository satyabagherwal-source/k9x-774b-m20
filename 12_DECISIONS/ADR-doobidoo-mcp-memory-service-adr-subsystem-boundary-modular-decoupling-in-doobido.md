# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in doobidoo/mcp-memory-service

<!-- PROVENANCE_START
{
  "source_repository": "doobidoo/mcp-memory-service",
  "source_url": "https://github.com/doobidoo/mcp-memory-service",
  "source_version": "356ceb16",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T03:49:19.730Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-doobidoo-mcp-memory-service",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) (Revision: `356ceb16`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T03:49:19.730Z`  
> **Learning ID**: `learn-github-doobidoo-mcp-memory-service`


## Status
**ACCEPTED** (Empirically verified from doobidoo/mcp-memory-service)

## Context
During deep inspection of doobidoo/mcp-memory-service, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
# Forensic Learning Record (Deep Inspection): doobidoo/mcp-memory-service

> **Canonical Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T03:49:18.483Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2125 stars

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
- **Issue #1975** (2026-11-13): **[Bug]: split_content can split in the middle of a URL, version or decimal when "." is the last character of the chunk window**
  *Symptoms*: ### Bug Description  `_find_best_split_point()` in `src/mcp_memory_service/utils/content_splitter.py` detects sentence ends with `r'[.!?](?=\s|$)'`, applied to `text[:max_length]`. In that window `$` matches the end of the *window*, not the end of the text. So a `.` that happens to be the last character of the window is treated as a sentence end, and the split happens right after it, even when the dot is inside a token such as `example.com`, `3.14159` or `v2.10.4`.  Because only the last regex match is used, this window-end dot also wins over an earlier, genuine sentence end.  This path is used by `MemoryService.store_memory` whenever auto-split is on (the default) and content is longer than the backend limit, so the chunks that are stored and later searched contain broken URLs/versions/numbers.  ### Steps to Reproduce  Run from a source checkout (no server needed):  ```python from mcp_memory_service.utils.content_splitter import split_content  t = "Docs live at https://example.com/guide and the version is 3.14159 today" print(split_content(t, max_length=29, preserve_boundaries=True, overlap=0))  t2 = "Pi is 3.14159. The release is v2.10.4 and the host is api.example.com." print(split_content(t2, max_length=18, preserve_boundaries=True, overlap=0)) print(split_content(t2, max_length=21, preserve_boundaries=True, overlap=0)) ```  ### Expected Behavior  Splits happen at real boundaries (newline, a sentence end followed by whitespace or the end of the text, or a space). A token 

- **Issue #1971** (2026-11-13): **dashboard: type-only search filter is a 422 (page_size=1000 against a cap of 100)**
  *Symptoms*: In the dashboard's Search tab, filtering by content type alone (no query, no tag, no date) always fails with the toast "Filter search failed", for built-in types as well as custom ones.  `handleFilterChange()` in `web/static/app.js` (line 2948 on `main` at 9e69dab1) takes the type-only branch and asks for every memory:  ``` const allMemoriesResponse = await this.apiCall('/memories?page=1&page_size=1000'); ```  `GET /api/memories` caps `page_size` at 100 (`web/api/memories.py:321`, `Query(10, ge=1, le=100)`), so the request is a 422 before anything is filtered. Server log from a run against a scratch database:  ``` "GET /api/memories?page=1&page_size=1000 HTTP/1.1" 422 Unprocessable Entity ```  The call came in with f739d746. Raising the cap is not the fix: even under it, the branch fetches one page and filters it in the browser, so on a store with more memories than one page it silently misses matches.  ## What has to change  The route already filters server-side: `list_memories` takes `memory_type`. The type-only branch should pass the selected type there instead of fetching everything and filtering client-side, keep `page_size` within the cap, and page through the result (or reuse the paging the Browse view already does at line 3391) so a type with more than 100 memories is complete.  Done when: choosing a type with no query, tag or date returns that type's memories without an error, including a type with more than 100 memories, and the other three filter branches behave as

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

### Incident Patch 1: `bea66063` (2026-11-13)
**Commit Message**: fix(quality-gate): bound model calls by wall clock and skip, not pass, on failure (#1982)

* fix(quality-gate): bound model calls by wall clock and skip, not pass, on failure

MCP_QUALITY_LLM_TIMEOUT never fired against omlx: the server sends a
whitespace keepalive while a request waits in its queue, and the
urlopen timeout only limits each socket read. Calls blocked for as
long as the queue was, measured at 2-11 minutes behind agent traffic.
llm_prompt.py now bounds the whole request with SIGALRM; the default
goes from 180 to 600 seconds to match what a busy shared server needs.

analyze() turned any failed call into empty output, which both the
complexity and the security check read as clean, so an unreachable
or overloaded model passed the gate. Failed calls are now counted and
a run without findings ends as skipped (exit 3).

Answered calls are cached by model and prompt in the shared git dir,
so rerunning the gate on unchanged files makes no model call.

* fix(quality-gate): write cache entries atomically and key them by reviewer

Greptile on #1982:
- an entry is written to a temp file and renamed, so a gate in another
  worktree never reads a half-written answer; an empty ent

**File**: `scripts/pr/lib/llm_prompt.py` (modified, +21/-4)
```diff
@@ -24,7 +24,7 @@
     MCP_QUALITY_LLM_URL      base URL, default http://127.0.0.1:11437/v1
     MCP_QUALITY_LLM_MODEL    model id; prompt mode defaults to first listed model
     MCP_QUALITY_LLM_API_KEY  optional bearer token
-    MCP_QUALITY_LLM_TIMEOUT  seconds per request, default 180
+    MCP_QUALITY_LLM_TIMEOUT  wall-clock seconds per request, default 600
 
 Exit codes:
     0  reply printed on stdout
@@ -41,11 +41,15 @@
 import json
 import os
 import re
+import signal
 import sys
 import urllib.error
 import urllib.request
 
 DEFAULT_URL = "http://127.0.0.1:11437/v1"
+# Measured on a shared omlx server: gate prompts of 3-12k tokens waited 2-11
+# minutes behind agent traffic, so 180s skipped most calls on a busy machine.
+DEFAULT_TIMEOUT = "600"
 EXIT_NO_BACKEND = 3
 THINK_BLOCK = re.compile(r"<think>.*?</think>\s*", re.DOTALL)
 
@@ -65,10 +69,23 @@ def _headers() -> dict:
 def _request(path: str, payload=None):
     """POST payload (or GET when payload is None) and return the parsed body."""
     data = json.dumps(payload).encode() if payload is not None else None
-    timeout = float(os.environ.get("MCP_QUALITY_LLM_TIMEOUT", "180"))
+    timeout = float(os.environ.get("MCP_QUALITY_LLM_TIMEOUT", DEFAULT_TIMEOUT))
     req = urllib.request.Request(_base_url() + path, data=data, headers=_headers())
-    with urllib.request.urlopen(req, timeout=timeout) as response:
-        return json.load(response)
+    # The urlopen timeout limits each socket read, not the request. omlx sends a
+    # whitespace keepalive while a request waits in its queue, so that limit
+    # never fired and a call could block for as long as the queue was. SIGALRM
+    # bounds the whole request.
+    def on_deadline(signum, frame):
+        raise TimeoutError(f"no reply within {timeout:g}s")
+
+    previous = signal.signal(signal.SIGALRM, on_deadline)
+    signal.setitimer(signal.ITIMER_REAL, timeout)
+    try:
+        with urllib.request.urlopen(req, timeout=timeout) as response:
+            return json.load(response)
+    finally:
+        signal.setitimer(signal.ITIMER_REAL, 0)
+        signal.signal(signal.SIGALRM, previous)
 
 
 def model_candidates() -> list[str]:
```

**File**: `scripts/pr/quality_gate.sh` (modified, +49/-3)
```diff
@@ -82,13 +82,50 @@ else
     LLM_BACKEND="local ($RESOLVED_MODEL)"
 fi
 
-# analyze <prompt> - one model call, empty output on failure so callers stay simple.
+# A failed call used to print nothing, and every check read nothing as clean, so
+# an unreachable or overloaded model passed the gate. Failures are counted here
+# and turn a clean run into SKIPPED (see the summary).
+LLM_FAILURES=$(mktemp)
+trap 'rm -f "$LLM_FAILURES"' EXIT
+# Replies are cached by model and prompt; the prompt holds the whole file, so a
+# rerun on unchanged files makes no model call. Lives in the shared git dir, so
+# all worktrees of a checkout use it.
+# ponytail: never pruned; entries are a few hundred bytes. Prune by age if it grows.
+CACHE_DIR=""
+if git_dir=$(git rev-parse --git-common-dir 2>/dev/null); then
+    CACHE_DIR="$git_dir/quality-gate-cache"
+fi
+
+# analyze <prompt> - one model call; prints the reply, or nothing on failure.
 analyze() {
+    local key="" reply=""
+    if [ -n "$CACHE_DIR" ]; then
+        # The reviewer is backend + endpoint + model: "local (<model>)" or "gemini",
+        # plus the URL, since one model name can be served by different endpoints.
+        key=$(printf '%s\n%s\n%s' "$LLM_BACKEND" "${MCP_QUALITY_LLM_URL:-}" "$1" \
+            | git hash-object --stdin)
+        # -s, not -f: an empty entry is not an answer.
+        if [ -s "$CACHE_DIR/$key" ]; then
+            cat "$CACHE_DIR/$key"
+            return
+        fi
+    fi
     if [ "$LLM_BACKEND" = "gemini" ]; then
-        gemini "$1" 2>&1 || echo ""
+        reply=$(gemini "$1" 2>/dev/null) || reply=""
     else
-        printf '%s' "$1" | python3 "$LLM_HELPER" 2>/dev/null || echo ""
+        reply=$(printf '%s' "$1" | python3 "$LLM_HELPER") || reply=""
+    fi
+    if [ -z "$reply" ]; then
+        echo "failed" >> "$LLM_FAILURES"
+        return
     fi
+    # Write aside and rename: a gate in another worktree must never read a
+    # half-written entry, and an interrupted write must not leave one behind.
+    if [ -n "$key" ] && mkdir -p "$CACHE_DIR"; then
+        printf '%s\n' "$reply" > "$CACHE_DIR/$key.tmp.$$" \
+            && mv -f "$CACHE_DIR/$key.tmp.$$" "$CACHE_DIR/$key"
+    fi
+    printf '%s\n' "$reply"
 }
 
 if [ "$MODE" = "staged" ]; then
@@ -342,6 +379,15 @@ fi
 echo "=== Quality Gate Summary ==="
 echo ""
 
+llm_failed=$(wc -l < "$LLM_FAILURES" | tr -d ' ')
+if [ "$llm_failed" -gt 0 ] && [ $exit_code -eq 0 ]; then
+    echo "WARNING: $llm_failed model call(s) got no usable reply (error above, or no reply"
+    echo "   within MCP_QUALITY_LLM_TIMEOUT=${MCP_QUALITY_LLM_TIMEOUT:-600}s)."
+    echo "   Skipped, NOT passed: complexity and security were not fully evaluated."
+    echo "   Rerun when the endpoint is less busy; answered calls are cached."
+    exit $EXIT_SKIPPED
+fi
+
 if [ $exit_code -eq 0 ]; then
     echo "ALL CHECKS PASSED"
     echo ""
```

**File**: `tests/ci/test_llm_prompt.py` (modified, +159/-0)
```diff
@@ -7,6 +7,7 @@
 import subprocess
 import sys
 import threading
+import time
 from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
 from pathlib import Path
 
@@ -136,3 +137,161 @@ def test_quality_gate_preserves_model_failure(
     assert "Skipped, NOT passed" in result.stdout
     assert "no local analysis model reachable" not in result.stdout
     assert "Start the local endpoint" not in result.stdout
+
+
+class _KeepaliveHandler(BaseHTTPRequestHandler):
+    """Answer like a busy omlx: headers at once, then a space every 0.2s, no body."""
+
+    def do_POST(self) -> None:
+        self.send_response(200)
+        self.send_header("Content-Type", "application/json")
+        self.end_headers()
+        try:
+            for _ in range(200):
+                self.wfile.write(b" ")
+                self.wfile.flush()
+                time.sleep(0.2)
+        except OSError:
+            pass
+
+    def log_message(self, format: str, *args: object) -> None:
+        pass
+
+
+class _GateHandler(_ModelHandler):
+    """One model; answers the readiness probe, then the analysis prompts per `mode`."""
+
+    models = ("m",)
+    mode = "clean"
+    analysis_calls = 0
+
+    def do_POST(self) -> None:
+        length = int(self.headers.get("Content-Length", "0"))
+        prompt = json.loads(self.rfile.read(length))["messages"][0]["content"]
+        if prompt == "reply with READY":
+            self._send_json(200, {"choices": [{"message": {"content": "READY"}}]})
+            return
+        type(self).analysis_calls += 1
+        if self.mode == "fail":
+            self._send_json(500, {"error": "busy"})
+            return
+        self._send_json(200, {"choices": [{"message": {"content": "SECURITY_CLEAN"}}]})
+
+
+def _serve(handler: type[BaseHTTPRequestHandler]):
+    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
+    server.daemon_threads = True
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    return server, f"http://127.0.0.1:{server.server_port}/v1"
+
+
+def test_deadline_is_wall_clock_despite_keepalive_bytes() -> None:
+    """omlx streams whitespace while a request waits, so a socket read timeout never fires."""
+    server, url = _serve(_KeepaliveHandler)
+    env = os.environ | {"MCP_QUALITY_LLM_URL": url, "MCP_QUALITY_LLM_MODEL": "m",
+                        "MCP_QUALITY_LLM_TIMEOUT": "1"}
+    try:
+        started = time.monotonic()
+        result = subprocess.run([sys.executable, str(HELPER)], input="hi", env=env,
+                                capture_output=True, text=True, check=False, timeout=20)
+        elapsed = time.monotonic() - started
+    finally:
+        server.shutdown()
+        server.server_close()
+    assert result.returncode == 3, result.stderr
+    assert "no reply within 1s" in result.stderr
+    assert elapsed < 10
+
+
+def _staged_repo(path: Path) -> None:
+    subprocess.run(["git", "init", "-q", str(path)], check=True)
+    (path / "tests").mkdir()
+    (path / "tests" / "test_mod.py").write_text("def test_one():\n    assert 1\n")
+    subprocess.run(["git", "-C", str(path), "add", "tests/test_mod.py"], check=True)
+
+
+def _run_gate(path: Path, url: str) -> subprocess.CompletedProcess:
+    env = os.environ | {"MCP_QUALITY_LLM": "local", "MCP_QUALITY_LLM_URL": url,
+                        "MCP_QUALITY_LLM_TIMEOUT": "5"}
+    env.pop("MCP_QUALITY_LLM_MODEL", None)
+    return subprocess.run(["bash", str(GATE), "--staged"], cwd=path, env=env,
+                          capture_output=True, text=True, check=False, timeout=60)
+
+
+def test_failed_analysis_call_is_skipped_not_passed(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr(_GateHandler, "mode", "fail")
+    _staged_repo(tmp_path)
+    server, url = _serve(_GateHandler)
+    try:
+        result = _run_gate(tmp_path, url)
+    finally:
+        server.shutdown()
+        server.server_close()
+    assert result.returncode == 3, result.stdout + result.stderr
+    assert "Skipped, NOT passed" in result.stdout
+    assert "ALL CHECKS PASSED" not in result.stdout
+
+
+def test_rerun_on_unchanged_files_reuses_cached_replies(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr(_GateHandler, "mode", "clean")
+    monkeypatch.setattr(_GateHandler, "analysis_calls", 0)
+    _staged_repo(tmp_path)
+    server, url = _serve(_GateHandler)
+    try:
+        first = _run_gate(tmp_path, url)
+        calls_after_first = _GateHandler.analysis_calls
+        second = _run_gate(tmp_path, url)
+    finally:
+        server.shutdown()
+        server.server_close()
+    assert first.returncode == 0, first.stdout + first.stderr
+    assert second.returncode == 0, second.stdout + second.stderr
+    assert calls_after_first > 0
+    assert _GateHandler.analysis_calls == calls_after_first
+
+
+def _cache_files(path: Path) -> list[Path]:
+    return [p for p in (path / ".git" / "q
```

---

### Incident Patch 2: `9349b8ac` (2026-11-13)
**Commit Message**: fix(search): parse a from/to recall range as the whole window (#1935)

* fix(search): parse a from/to recall range as the whole window

"from January to March" and "from 2024-01-01 to 2024-03-31" were read
as the first month or the first day. They now span the whole window,
matching "between ... and ...". A from/to phrase that is not a date
still falls through.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* chore: rename changelog fragment for #1935

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(search): validate from/to range endpoints

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(search): accept dayparts in range endpoints

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* refactor(search): match range endpoints directly

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(search): keep from/to ranges for month years, now, and inverted months

A month name followed by a year keeps that year ("from January 2024 to
March 2024"), "to now" ends today, and a window whose start comes after
its end ("from march to january") falls back to the single-expression
parse instead of returning start > end.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* test(search): pin the from/to edge test to fi

**File**: `changelog.d/1935.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **A "from … to …" recall range kept only the start (GPT-AGI).** `from January to March` and `from 2024-01-01 to 2024-03-31` were read as the first month or the first day. They now cover the whole window, the same way `between … and …` already did. A from/to phrase that is not a date still falls through, so `from Alice to Bob yesterday` stays yesterday. A month name with a year keeps that year (`from January 2024 to March 2024`), `to now` ends today, and a window whose start comes after its end (`from march to january`) keeps the previous single-month reading.
```

**File**: `src/mcp_memory_service/utils/time_parser.py` (modified, +63/-8)
```diff
@@ -78,6 +78,28 @@
 }
 
 _MAX_TIME_QUERY_LEN = 500  # guard against ReDoS on user-supplied input
+_RANGE_ENDPOINT_PATTERNS = (
+    "relative_days", "relative_weeks", "relative_months", "relative_years",
+    "last_n_periods", "last_period", "this_period", "month_name", "recent",
+    "specific_date", "full_date", "named_period", "half_year", "quarter",
+)
+_RANGE_DAYPART_ENDPOINT = re.compile(
+    rf"(?:{PATTERNS['relative_days'].pattern})\s+(?:in\s+the\s+)?"
+    rf"(?:{PATTERNS['time_of_day'].pattern})|"
+    rf"(?:{PATTERNS['time_of_day'].pattern})\s+(?:yesterday|today)"
+)
+_RANGE_ENDPOINT = "|".join(
+    f"(?:{PATTERNS[name].pattern})" for name in _RANGE_ENDPOINT_PATTERNS
+)
+_RANGE_MONTH_YEAR = re.compile(rf"{PATTERNS['month_name'].pattern}\s+(\d{{4}})")
+PATTERNS["from_to"] = re.compile(
+    rf"from\s+(\S[^&]{{0,50}}?)\s+to\s+"
+    rf"({_RANGE_DAYPART_ENDPOINT.pattern}|{_RANGE_MONTH_YEAR.pattern}|{_RANGE_ENDPOINT}|now)"
+    # Sentence punctuation may follow a complete endpoint; only "\s|$" made
+    # "march 2024." fall back to "march" and dropped "2024-03-31." entirely.
+    rf"(?=[\s.,;:!?]|$)"
+)
+
 
 def _resolve_yearless_date(
     month: int, day: int, today: date, anchor_year: Optional[int] = None
@@ -157,6 +179,21 @@ def _anchor_yearless_range(
     )
 
 
+def _parse_range_side(expr: str) -> Tuple[Optional[float], Optional[float]]:
+    """Parse one end of a ``from X to Y`` range.
+
+    ``now`` means today, and a month name with a year ("march 2024") keeps
+    that year instead of resolving to the most recent such month.
+    """
+    expr = expr.strip()
+    if expr == "now":
+        expr = "today"
+    month_year = _RANGE_MONTH_YEAR.fullmatch(expr)
+    if month_year:
+        return get_month_range(month_year.group(1), int(month_year.group(2)))
+    return parse_time_expression(expr)
+
+
 def _calculate_season_date_range(
     period: str,
     season_info: Dict[str, int],
@@ -231,7 +268,24 @@ def parse_time_expression(
                 start_expr, end_expr, start_ts, end_ts
             )
             return start_ts, end_ts
-        
+
+        # Documented recall example. Ends that are not times fall through
+        # ("from Alice to Bob yesterday" is still yesterday).
+        from_to_match = PATTERNS["from_to"].search(query)
+        if from_to_match:
+            start_expr = from_to_match.group(1)
+            end_expr = from_to_match.group(2)
+            start_ts, _ = _parse_range_side(start_expr)
+            _, end_ts = _parse_range_side(end_expr)
+            if start_ts is not None and end_ts is not None:
+                start_ts, end_ts = _anchor_yearless_range(
+                    start_expr, end_expr, start_ts, end_ts
+                )
+                # An inverted window ("from march to january") falls through
+                # to the single-expression parse, as before this pattern.
+                if start_ts <= end_ts:
+                    return start_ts, end_ts
+
         # Check for full ISO dates (YYYY-MM-DD) FIRST
         full_date_match = PATTERNS["full_date"].search(query)
         if full_date_match:
@@ -619,8 +673,8 @@ def get_this_period_range(period: str) -> Tuple[float, float]:
         
     return start_dt.timestamp(), end_dt.timestamp()
 
-def get_month_range(month_name: str) -> Tuple[float, float]:
-    """Get timestamp range for a named month."""
+def get_month_range(month_name: str, year: Optional[int] = None) -> Tuple[float, float]:
+    """Get timestamp range for a named month (the most recent one unless ``year`` is given)."""
     # Map month name to number
     month_map = {
         "january": 1, "february": 2, "march": 3, "april": 4,
@@ -630,11 +684,12 @@ def get_month_range(month_name: str) -> Tuple[float, float]:
     
     if month_name in month_map:
         month_num = month_map[month_name]
-        current_year = datetime.now().year
-        
-        # If the month is in the future for this year, use last year
-        current_month = datetime.now().month
-        year = current_year if month_num <= current_month else current_year - 1
+        if year is None:
+            current_year = datetime.now().year
+
+            # If the month is in the future for this year, use last year
+            current_month = datetime.now().month
+            year = current_year if month_num <= current_month else current_year - 1
         
         # Get first and last day of the month
         first_day = date(year, month_num, 1)
```

**File**: `tests/test_time_parser.py` (modified, +88/-1)
```diff
@@ -255,7 +255,94 @@ def test_date_ranges(self):
         
         assert start_dt.month == 1
         assert end_dt.month == 3
-    
+
+    def test_from_to_covers_the_whole_window(self, monkeypatch):
+        """`from X to Y` is a range, the same window `between X and Y` already is.
+
+        The recall handler documents "from January to March". Without a from/to
+        pattern the first date or month was returned alone, so an ISO range
+        collapsed to its first day.
+        """
+        # In January and February "march" resolves to last year, which would
+        # invert the month window; pin the clock after March.
+        _freeze_clock(monkeypatch, date(2026, 11, 10))
+        start_ts, end_ts = parse_time_expression("from 2024-01-01 to 2024-03-31")
+        assert datetime.fromtimestamp(start_ts) == datetime(2024, 1, 1, 0, 0, 0)
+        end_dt = datetime.fromtimestamp(end_ts)
+        assert (end_dt.year, end_dt.month, end_dt.day) == (2024, 3, 31)
+
+        month_start, month_end = parse_time_expression("from january to march")
+        between_start, between_end = parse_time_expression("between january and march")
+        assert (month_start, month_end) == (between_start, between_end)
+        assert datetime.fromtimestamp(month_end).month == 3
+
+        _, (recall_start, recall_end) = extract_time_expression("from January to March")
+        assert datetime.fromtimestamp(recall_start).month == 1
+        assert datetime.fromtimestamp(recall_end).month == 3
+
+        relative_start, relative_end = parse_time_expression(
+            "from 3 days ago to 1 day ago"
+        )
+        expected_start, _ = parse_time_expression("3 days ago")
+        _, expected_end = parse_time_expression("1 day ago")
+        assert (relative_start, relative_end) == (expected_start, expected_end)
+
+        daypart_start, daypart_end = parse_time_expression(
+            "from yesterday morning to today"
+        )
+        expected_start, _ = parse_time_expression("yesterday morning")
+        _, expected_end = parse_time_expression("today")
+        assert (daypart_start, daypart_end) == (expected_start, expected_end)
+
+        # "today in the morning" is a supported expression on its own, so the
+        # range end keeps the daypart instead of widening to the whole day.
+        for query, end_expr in (
+            ("from yesterday to today in the morning", "today in the morning"),
+            ("from yesterday to today morning", "today morning"),
+        ):
+            range_start, range_end = parse_time_expression(query)
+            expected_start, _ = parse_time_expression("yesterday")
+            _, expected_end = parse_time_expression(end_expr)
+            assert (range_start, range_end) == (expected_start, expected_end)
+
+    def test_from_to_that_is_not_a_date_keeps_a_later_expression(self):
+        """`from Alice to Bob yesterday` is not a date range."""
+        yesterday_start, yesterday_end = parse_time_expression("yesterday")
+        for query in ("from Alice to Bob yesterday", "from May to Bob yesterday"):
+            start_ts, end_ts = parse_time_expression(query)
+            assert (start_ts, end_ts) == (yesterday_start, yesterday_end)
+
+    def test_from_to_edge_endpoints(self, monkeypatch):
+        """Inverted month windows fall back, month-name years are kept, `now` is today."""
+        _freeze_clock(monkeypatch, date(2026, 1, 10))
+        march_start, _ = parse_time_expression("march")
+        _, january_end = parse_time_expression("january")
+        assert parse_time_expression("from march to january") == (march_start, january_end)
+
+        _freeze_clock(monkeypatch, date(2026, 11, 10))
+        assert parse_time_expression("from march to january") == parse_time_expression("march")
+
+        start_ts, end_ts = parse_time_expression("from January 2024 to March 2024")
+        assert datetime.fromtimestamp(start_ts) == datetime(2024, 1, 1, 0, 0, 0)
+        end_dt = datetime.fromtimestamp(end_ts)
+        assert (end_dt.year, end_dt.month, end_dt.day) == (2024, 3, 31)
+
+        now_start, now_end = parse_time_expression("from 2024-01-01 to now")
+        _, today_end = parse_time_expression("today")
+        assert datetime.fromtimestamp(now_start) == datetime(2024, 1, 1, 0, 0, 0)
+        assert now_end == today_end
+
+        # Sentence punctuation after the end must not shorten the endpoint
+        # ("march 2024." falling back to "march") or drop the range.
+        for query in (
+            "from January 2024 to March 2024",
+            "from 2024-01-01 to 2024-03-31",
+            "from yesterday to today in the morning",
+        ):
+            expected = parse_time_expression(query)
+            for punct in (".", ",", "?", "!", ";", ":"):
+                assert parse_time_expression(query + punct) == expected, query + punct
+
     def test_quarters(self):
         """Test quarter expressions"""
         start_ts, end_ts = parse_time_expression(
```

---

### Incident Patch 3: `314452aa` (2026-11-13)
**Commit Message**: fix(milvus): keep the embedding call out of the read-upsert window (#1966) (#1978)

* fix(milvus): keep the embedding call out of the read-upsert window (#1966)

update_memory_metadata and update_memories_batch read the stored vector
with the row and write it back, as mark_superseded_batch does; only a
row whose vector did not come back is re-embedded. update_memory_versioned
embeds the new content before it reads the old row and hands the vector
to store() through a ContextVar, next to _exclude_versioned_parent.

The window between the read and the whole-row upsert is now a get and an
upsert with no embedding call in it. It is not closed: pymilvus has no
conditional upsert and _write_lock is per instance. That limit stays
documented in the changelog fragment.

Refs #1966

* fix(milvus): the legacy vector read drops a tombstoned row (#1966)

On a collection without the store field the vector is read with a second
get. That get now returns metadata too and goes through _row_is_live, so
a row soft-deleted between the two reads is not found and nothing is
written back, as every other read of a memory here treats a tombstone.

Refs #1966

---------

Co-authored-by: massimiliano1991 <[R

**File**: `changelog.d/1966.fixed.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+- **Milvus updates no longer embed the content between the read and the upsert**
+  (#1966). `update_memory_metadata` (and so `update_memory`) and
+  `update_memories_batch` read the stored vector with the row and write it back,
+  as `mark_superseded_batch` already did; only a row whose vector does not come
+  back is re-embedded. `update_memory_versioned` embeds the new content before it
+  reads the old row. The window between the read and the whole-row upsert is now
+  two round-trips with no embedding call in it; it is not closed, since pymilvus
+  has no conditional upsert, and that limit stays documented.
```

**File**: `src/mcp_memory_service/storage/milvus.py` (modified, +124/-33)
```diff
@@ -97,6 +97,7 @@
     _exclude_versioned_parent,
     _escape_like, _tags_to_string, _string_to_tags,
     _safe_json_loads, _versioned_conflict_exclusion,
+    _precomputed_store_vector, _store_with_vector,
 )
 from ..compat import _sanitize_log_value
 from ..models.memory import Memory, MemoryQueryResult
@@ -890,14 +891,24 @@ def _row_fields(self, base: Tuple[str, ...]) -> List[str]:
     def _row_store(row: Dict[str, Any]) -> str:
         return row.get("store") or "default"
 
-    async def _fetch_live_row(self, content_hash: str) -> Optional[Tuple[Memory, str]]:
-        """Return the live memory under ``content_hash`` and the store it is in."""
+    async def _fetch_live_row(
+        self, content_hash: str, include_embedding: bool = False
+    ) -> Optional[Tuple[Memory, str]]:
+        """Return the live memory under ``content_hash`` and the store it is in.
+
+        With ``include_embedding`` the stored vector comes back on
+        ``Memory.embedding``, so a write that keeps the content can write it
+        back instead of embedding the content again (#1966).
+        """
+        fields = self._OUTPUT_FIELDS
+        if include_embedding:
+            fields = self._OUTPUT_FIELDS_WITH_VECTOR
         try:
             rows = await self._call_client(
                 "get",
                 collection_name=self.collection_name,
                 ids=[content_hash],
-                output_fields=self._row_fields(self._OUTPUT_FIELDS),
+                output_fields=self._row_fields(fields),
             )
         except Exception as exc:  # noqa: BLE001
             logger.error(
@@ -908,7 +919,7 @@ async def _fetch_live_row(self, content_hash: str) -> Optional[Tuple[Memory, str
 
         if not rows:
             return None
-        memory = self._entity_to_memory(rows[0])
+        memory = self._entity_to_memory(rows[0], include_embedding=include_embedding)
         # Soft-deleted rows carry ``metadata.deleted_at``. Milvus can't filter a
         # JSON sub-field in the ``get`` expression, so drop the tombstone here to
         # match the other backends (sqlite_vec at mixins/retrieve.py, cloudflare
@@ -918,19 +929,61 @@ async def _fetch_live_row(self, content_hash: str) -> Optional[Tuple[Memory, str
             return None
         return memory, self._row_store(rows[0])
 
+    async def _stored_vector(
+        self, content_hash: str
+    ) -> Tuple[bool, Optional[List[float]]]:
+        """Read the vector stored under ``content_hash`` on a legacy collection.
+
+        Returns ``(live, vector)``. ``live`` is False when the row is gone or
+        carries a soft-delete tombstone, as every other read of a memory
+        here treats it (``_fetch_live_row``). A failed read is reported as
+        live with no vector, so the caller embeds the content again, as it
+        did before #1966. Never raises.
+        """
+        try:
+            rows = await self._call_client(
+                "get",
+                collection_name=self.collection_name,
+                ids=[content_hash],
+                output_fields=["vector", "metadata"],
+            )
+        except Exception as exc:  # noqa: BLE001
+            logger.warning(
+                "Failed to read the vector of %s: %s",
+                _sanitize_log_value(content_hash), _sanitize_log_value(exc),
+            )
+            return True, None
+        if not rows or not self._row_is_live(rows[0]):
+            return False, None
+        return True, self._coerce_vector(rows[0])
+
     async def _get_for_write(
-        self, content_hash: str, store: Optional[str]
+        self, content_hash: str, store: Optional[str], include_embedding: bool = False
     ) -> Tuple[Optional[Memory], str]:
         """Read the row a hash-addressed write will replace, with its store.
 
         Milvus ``upsert`` replaces the whole row, so the row's own store is
         written back with it and an update never moves a memory between
         stores. A legacy collection has no store to carry.
+
+        With ``include_embedding`` the row's vector is read too (on a legacy
+        collection with a second ``get``, since ``get_by_hash`` does not
+        carry it; a row tombstoned by then reads as not found), so the
+        caller can write it back without an embedding call between the read
+        and the upsert (#1966).
         """
         if not self._has_store:
-            return await self.get_by_hash(content_hash, store), "default"
+            memory = await self.get_by_hash(content_hash, store)
+            if memory is not None and include_embedding and not memory.embedding:
+                live, vector = await self._stored_vector(content_hash)
+                if not live:
+                    return None, "default"
+                memory.embedding = vector
+            return memory, "default"
         refused, confine = self._store_scope(store)
-        found = None if refused else await self._fetch_live_row(content_hash)
```

**File**: `src/mcp_memory_service/storage/shared.py` (modified, +18/-0)
```diff
@@ -28,6 +28,24 @@ def _exclude_versioned_parent(content_hash: str) -> Iterator[None]:
     finally:
         _versioned_conflict_exclusion.reset(token)
 
+
+# A vector computed before the row was read, for ``store()`` to write instead
+# of embedding the content again. ``update_memory_versioned`` embeds the new
+# content ahead of its read so that no embedding call sits between the read
+# and the write (#1966).
+_precomputed_store_vector: ContextVar[Optional[List[float]]] = ContextVar(
+    "precomputed_store_vector", default=None
+)
+
+
+@contextmanager
+def _store_with_vector(embedding: List[float]) -> Iterator[None]:
+    token = _precomputed_store_vector.set(embedding)
+    try:
+        yield
+    finally:
+        _precomputed_store_vector.reset(token)
+
 # ---------------------------------------------------------------------------
 # Bounded LRU embedding cache
 # ---------------------------------------------------------------------------
```

**File**: `tests/storage/test_milvus_update_memory.py` (modified, +6/-4)
```diff
@@ -97,10 +97,12 @@ async def test_successful_update(self):
         result = await storage.update_memory(updated)
 
         assert result is True
-        # Verify upsert was called (through update_memory_metadata)
-        storage._call_client.assert_called_once()
-        call_args = storage._call_client.call_args
-        assert call_args[0][0] == "upsert"
+        # Verify upsert was called (through update_memory_metadata). The
+        # mocked get_by_hash carries no vector, so the row's vector is read
+        # with a second client call before the upsert (#1966).
+        upserts = [c for c in storage._call_client.call_args_list if c[0][0] == "upsert"]
+        assert len(upserts) == 1
+        assert storage._call_client.call_args[0][0] == "upsert"
 
     @pytest.mark.asyncio
     async def test_not_found_returns_false(self):
```

**File**: `tests/storage/test_milvus_update_stored_vector.py` (added, +352/-0)
```diff
@@ -0,0 +1,352 @@
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
+"""Milvus updates keep the embedding call out of the read-upsert window (#1966).
+
+Every Milvus update is a read followed by a whole-row ``upsert``, and two
+clients on one collection share no lock. An update that keeps the content
+keeps its vector too, so ``update_memory_metadata`` and
+``update_memories_batch`` read the stored vector with the row and write it
+back, as ``mark_superseded_batch`` already did, instead of embedding the
+content between the read and the upsert. ``update_memory_versioned`` stores
+new content, so it embeds that content before it reads the old row.
+
+Mocked-client style of test_milvus_store_scope.py: these run on CI runners
+without pymilvus or a model.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import re
+import threading
+import time
+from typing import Any
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.milvus import MilvusMemoryStorage
+from mcp_memory_service.storage.shared import _string_to_tags
+from mcp_memory_service.utils.hashing import generate_content_hash
+
+_HASH = "a" * 64
+_OTHER = "c" * 64
+_STORED = [0.5, 0.5, 0.5, 0.5]
+_FRESH = [0.1, 0.2, 0.3, 0.4]
+
+
+def _make_storage(has_store: bool) -> MilvusMemoryStorage:
+    """A MilvusMemoryStorage with __init__ skipped and the client mocked."""
+    storage = MilvusMemoryStorage.__new__(MilvusMemoryStorage)
+    storage.uri = "./milvus.db"
+    storage.collection_name = "unit_test_collection"
+    storage.embedding_dimension = 4
+    storage.embedding_model_name = "test-model"
+    storage.embedding_model = MagicMock()
+    storage.embedding_model.encode = MagicMock(
+        side_effect=lambda texts, **_: [list(_FRESH) for _ in texts]
+    )
+    storage._initialized = True
+    storage.client = MagicMock()
+    storage._has_content_lower = True
+    storage._has_bm25 = False
+    storage._has_access_collection = False
+    storage._has_store = has_store
+    storage.semantic_dedup_enabled = False
+    storage._generate_embedding = MagicMock(return_value=list(_FRESH))
+    storage._detect_conflicts = AsyncMock(return_value=[])
+    storage._delete_graph_edges = AsyncMock()
+    return storage
+
+
+def _row(
+    content_hash: str = _HASH,
+    store: str | None = "team",
+    vector: list[float] | None = _STORED,
+    content: str = "body",
+    **extra: Any,
+) -> dict[str, Any]:
+    now = time.time()
+    row: dict[str, Any] = {
+        "id": content_hash,
+        "content": content,
+        "content_lower": content.lower(),
+        "tags": "t",
+        "memory_type": "note",
+        "metadata": "{}",
+        "created_at": now,
+        "updated_at": now,
+        "created_at_iso": "2026-11-12T00:00:00Z",
+        "updated_at_iso": "2026-11-12T00:00:00Z",
+    }
+    if store is not None:
+        row["store"] = store
+    if vector is not None:
+        row["vector"] = list(vector)
+    row.update(extra)
+    return row
+
+
+class _Collection:
+    """An in-memory collection behind ``_call_client``.
+
+    ``get`` returns only the requested ``output_fields`` (plus ``id``), as
+    Milvus does, so a test can tell whether the vector was asked for.
+    """
+
+    def __init__(self, rows: list[dict[str, Any]]) -> None:
+        self.rows: dict[str, dict[str, Any]] = {r["id"]: dict(r) for r in rows}
+        self.calls: list[tuple[str, dict[str, Any]]] = []
+
+    def client(self) -> AsyncMock:
+        return AsyncMock(side_effect=self._call)
+
+    async def _call(self, method: str, **kwargs: Any) -> Any:
+        self.calls.append((method, kwargs))
+        if method == "get":
+            fields = kwargs.get("output_fields") or []
+            out = []
+            for content_hash in kwargs.get("ids") or []:
+                row = self.rows.get(content_hash)
+                if row is not None:
+                    picked = {f: row[f] for f in fields if f in row}
+                    out.append({"id": row["id"], **picked})
+            return out
+        if method in ("insert", "upsert"):
+            for entity in kwargs["data"]:
+                self.rows[entity["id"]] = dict(entity)
+            return {"insert_count": len(kwargs["data"])}
+        if method == "delete":
+            if "ids" in kwargs:
+                gone = [h for h in kwargs["ids"] if self.r
```

#### Recent Merged Pull Requests:
- **PR #1988** (2026-11-13): refactor(logging): lazy %-style logger calls in config/oauth.py and config/ontology.py (#1146) (@massimiliano1991)
- **PR #1987** (2026-11-13): feat(dashboard): split the Manage tab into sub-tabs (#1973) (@shu-chen-dot-ca)
- **PR #1986** (2026-11-13): chore(release): v12.9.0 (@doobidoo)
- **PR #1985** (2026-11-13): feat(site): offer a trial prompt for coding agents on the demo page (@doobidoo)
- **PR #1984** (2026-11-13): fix(dashboard): page the type-only search filter through the server-side type filter (@shu-chen-dot-ca)
- **PR #1983** (2026-11-13): docs(site): correct claims, fix mobile navigation, add structured data (@doobidoo)

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

## X. quality-gate): bound model calls by wall clock and skip, not pass, on failure

**RULE**:
When implementing operations in `scripts/pr/lib/llm_prompt.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bea66063`: quality-gate): bound model calls by wall clock and skip, not pass, on failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/pr/lib/llm_prompt.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    MCP_QUALITY_LLM_TIMEOUT  wall-clock seconds per request, default 600
import signal
# Measured on a shared omlx server: gate prompts of 3-12k tokens waited 2-11
# minutes behind agent traffic, so 180s skipped most calls on a busy machine.
DEFAULT_TIMEOUT = "600"
    timeout = float(os.environ.get("MCP_QUALITY_LLM_TIMEOUT", DEFAULT_TIMEOUT))
    # The urlopen timeout limits each socket read, not the request. omlx sends a
    # whitespace keepalive while a request waits in its queue, so that limit
    # never fired and a call could block for as long as the queue was. SIGALRM
    # bounds the whole request.
    def on_deadline(signum, frame):
        raise TimeoutError(f"no reply within {timeout:g}s")

    previous = signal.signal(signal.SIGALRM, on_deadline)
    signal.setitimer(signal.ITIMER_REAL, timeout)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
    MCP_QUALITY_LLM_TIMEOUT  seconds per request, default 180
    timeout = float(os.environ.get("MCP_QUALITY_LLM_TIMEOUT", "180"))
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bea66063` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
