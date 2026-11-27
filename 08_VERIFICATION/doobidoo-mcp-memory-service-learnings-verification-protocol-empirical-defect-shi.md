# Verification Protocol: Verification Protocol: Empirical Defect Shield for doobidoo-mcp-memory-service-learnings

<!-- PROVENANCE_START
{
  "source_repository": "doobidoo-mcp-memory-service-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T18:08:37.007Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-doobidoo-mcp-memory-service-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [doobidoo-mcp-memory-service-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T18:08:37.007Z`  
> **Learning ID**: `LEARN-EVO-doobidoo-mcp-memory-service-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `doobidoo-mcp-memory-service-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/doobidoo-mcp-memory-service-learnings.md`  
> **Source**: github ([https://github.com/doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service))  
> **Source Version**: `6847d593`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T18:08:28.520Z  
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
> **Harvest Timestamp**: 2026-11-27T18:08:28.513Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `doobidoo/mcp-memory-service`
- **Description**: Open-source persistent memory for AI agent pipelines (LangGraph, CrewAI, AutoGen) and Claude. REST API + knowledge graph + autonomous consolidation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2161 stars

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
- **Issue #2136** (2026-11-26): **Milvus: a purge between the two count reads reports tombstones as live memories**
  *Symptoms*: Greptile raised this on #2133 after the merge: https://github.com/doobidoo/mcp-memory-service/pull/2133#discussion_r4702553083. It is right, and the code is on `main` as of 02f525cb.  ## What happens  `count_all_memories()`, `count_memories_by_tag()` and both figures in `get_stats()` compute a live total as  ``` count(*) over the filter  -  tombstones found by a later scan ```  These are two separate reads. If `purge_deleted()` removes the tombstones between them, the first number still contains them and the second no longer finds them, so deleted rows are reported as live. Two tombstones and no live row give a total of 2 next to an empty listing.  The window is small and the next call is correct again, but `memory_list` shows this total next to a page, and the entity rebuild compares it against `get_all_memories_with_store()`.  ## Reproduction  Against Milvus Lite: store two memories, tombstone both, then run `purge_deleted()` between the count's two reads (a wrapper around `_drain_rows` is enough). `count_all_memories()` returns 2, the listing is empty.  ## Fix  Do not subtract. Count the rows whose metadata never mentions `deleted_at` with `count(*)`, and add the rows that mention it and are live anyway (`"deleted_at": null`) from the narrowed scan. Neither read counts a tombstone, so a purge between them cannot inflate the total, and the count stays a `count(*)` instead of a full scan. 

- **Issue #2100** (2026-11-20): **POST /api/server/update ignores MCP_UPDATE_GIT_REMOTE/BRANCH and takes no backup**
  *Symptoms*: ## What is wrong  `POST /api/server/update` (the "Update" button in the dashboard) does two things an operator would not expect. Both are in `src/mcp_memory_service/web/api/server.py`, line numbers on `main` today.  1. **It ignores the configured remote and branch.** `check_for_updates()` reads `MCP_UPDATE_GIT_REMOTE` and `MCP_UPDATE_GIT_BRANCH` (lines 318-319, documented in `.env.example`), so "update available" is computed against, say, `upstream/stable`. `update_server()` then runs a hardcoded `git pull origin main` (line 481). An install that set those variables is told about one branch and updated from another. 2. **It changes the checkout without a backup.** The update pulls, reinstalls and restarts. A new release can migrate the database on that restart, and nothing was saved before it. The backup service that `POST /api/backup/now` uses is right there.  Found while writing #2098, which left this endpoint alone on purpose.  ## Scope (settled)  1. Resolve remote and branch in one place and use it in both `check_for_updates()` and `update_server()`. Same variables, same defaults (`origin`, `main`). The pull becomes `git pull <remote> <branch>`. 2. Before the `git pull`, call `get_backup_service().create_backup(description=...)` (from `mcp_memory_service.backup.scheduler`, the way `web/api/backup.py` does).    - Backup succeeded: go on. Put the backup's filename into the response message or a new optional field on `UpdateResponse`.    - `BackupService.db_path` is `None` (

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

### Incident Patch 1: `bef18ef5` (2026-11-27)
**Commit Message**: fix(sync): forward delta-sync events a hybrid hub applied to its secondary (#1506, part 1 of 2) (#2135)

* fix(sync): forward delta-sync events a hybrid hub applied to its secondary (#1506)

apply_remote_event writes through the primary's SQLite connection, so a spoke's
create, edit or delete never reached the hybrid queue and Cloudflare held only the
hub's own writes. The scheduled sync cycle now tails sync_events with a persisted
per-secondary cursor (push_cursor and push_to_peer, ADR-0027) and replays each event
to the secondary; the cursor moves only after it acknowledged. Each forwarded event
is recorded in secondary_forwarded (migration 023).

Part 1 of 2: the pull-side echo guard follows separately.

Assisted-by: Claude Code / Claude Sonnet 5.5
Account: tonydzi
Operator: Anton Dziatkovskii

* fix(sync): retry a failed edit, filter tombstones, split the forwarder (#1506)

Review follow-ups on the secondary forwarder:
- a failed update on a row the secondary already holds fell back to a store that was
  refused as a duplicate, and the refusal was swallowed, so the cursor passed the edit.
  The fallback now raises on a duplicate when it stands in for an edit.
- _row_store read 

**File**: `changelog.d/1506.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **A hybrid hub forwards the delta-sync events it applied to its Cloudflare secondary (#1506).** `apply_remote_event` writes through the primary's SQLite connection, so a spoke's create, edit or delete reached the hub and every other spoke but never D1, which silently became a partial copy holding only the hub's own writes. The scheduled sync cycle now tails the hub's `sync_events` with a persisted per-secondary cursor (the `push_cursor` table and `push_to_peer` loop spokes already use) and replays each event to the secondary: a create or edit stores or updates the current row in its store, a delete deletes it. The cursor moves only after the secondary acknowledged, so a restart or a D1 outage between "applied" and "forwarded" re-delivers instead of dropping. A hub that upgrades starts at the end of its log; the drift scan keeps the backlog. Each forwarded event is recorded in the new `secondary_forwarded` table (migration 023), the identity a later pull-side guard can check. Part 1 of 2: the pull-side echo guard follows separately.
```

**File**: `src/mcp_memory_service/consolidation/scheduler.py` (modified, +26/-0)
```diff
@@ -570,6 +570,7 @@ async def _run_sync_cycle(self):
         if storage is None:
             self.logger.warning("Delta-sync cycle skipped: consolidator has no storage")
             return
+        await self._forward_to_secondary(storage)
         peers = self._resolve_sync_peers()
         if not peers:
             self.logger.debug("Delta-sync cycle: no peers configured (MCP_SYNC_PEERS unset)")
@@ -580,6 +581,31 @@ async def _run_sync_cycle(self):
                 storage, peer_id, peer, sync_from_peer, push_to_peer
             )
 
+    async def _forward_to_secondary(self, storage: Any) -> None:
+        """A hybrid hub replays the events it applied to its secondary (#1506).
+
+        No-op for any storage without a secondary. Never raises: the cursor only moves
+        after the secondary acknowledged, so a failed cycle is retried by the next one.
+        """
+        from ..storage.hybrid import HybridMemoryStorage
+        if not isinstance(storage, HybridMemoryStorage) or storage.secondary is None:
+            return
+        try:
+            from ..storage.sync.forwarder import forward_to_secondary
+            result = await forward_to_secondary(storage)
+            if result is not None and (result.events_pushed or result.events_failed):
+                self.logger.info(
+                    "Secondary forward: %s forwarded, %s failed",
+                    _sanitize_log_value(result.events_pushed),
+                    _sanitize_log_value(result.events_failed),
+                )
+        except Exception as exc:
+            self.execution_stats['failed_jobs'] += 1
+            self.logger.error(
+                "Secondary forward failed: %s: %s",
+                _sanitize_log_value(type(exc).__name__), _sanitize_log_value(exc),
+            )
+
     async def _run_sync_peer_cycle(
         self,
         storage: Any,
```

**File**: `src/mcp_memory_service/storage/migrations/023_add_secondary_forwarded.sql` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+-- #1506: identity of every delta-sync event the hub forwarded to a hybrid secondary.
+-- A later pull from the secondary can ask "did I push this (content_hash, op)?" before
+-- it applies a row that is only the echo of the hub's own forward. One row per
+-- (secondary, agent, event). Idempotent: CREATE TABLE IF NOT EXISTS.
+CREATE TABLE IF NOT EXISTS secondary_forwarded (
+    secondary_id TEXT NOT NULL,
+    agent_id TEXT NOT NULL,
+    event_id TEXT NOT NULL,
+    content_hash TEXT NOT NULL,
+    op TEXT NOT NULL,
+    forwarded_at REAL NOT NULL,
+    PRIMARY KEY (secondary_id, agent_id, event_id)
+);
+
+CREATE INDEX IF NOT EXISTS idx_secondary_forwarded_hash
+    ON secondary_forwarded(secondary_id, content_hash, op);
```

**File**: `src/mcp_memory_service/storage/migrations/rollback/023_add_secondary_forwarded.down.sql` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+-- Rollback 023: drop the secondary forwarder identity table (#1506).
+DROP INDEX IF EXISTS idx_secondary_forwarded_hash;
+DROP TABLE IF EXISTS secondary_forwarded;
```

**File**: `src/mcp_memory_service/storage/sync/forwarder.py` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+"""Forward delta-sync events to a hybrid hub's secondary backend (#1506).
+
+``apply_remote_event`` writes through the primary's SQLite connection, so a spoke's
+create, edit or delete never reaches the hybrid queue that feeds Cloudflare. This
+module tails the hub's own ``sync_events`` log with a persisted cursor per secondary
+(the same ``push_cursor`` table and ``push_to_peer`` loop a spoke uses toward a hub,
+ADR-0027) and replays each event to the secondary.
+
+Why not enqueue from the apply path: ``BackgroundSyncService.operation_queue`` is an
+in-memory ``asyncio.Queue``. A restart, or a full queue, between "applied on the hub"
+and "pushed to D1" would lose the change with nothing left to notice it. The event
+log is durable and the cursor only moves after the secondary acknowledged.
+
+Passport
+    in:      a ``HybridMemoryStorage`` (``.primary``, ``.secondary``, ``.sync_service``)
+    out:     ``PushResult`` from ``push_to_peer``; one ``secondary_forwarded`` row per
+             forwarded event (the identity a later pull can use to recognise its echo)
+    callers: ``consolidation/scheduler.py`` ``_run_sync_cycle``
+    breaks:  forwarding stops, Cloudflare keeps only the hub's own writes (#1506)
+"""
+
+from __future__ import annotations
+
+import logging
+import time
+from typing import Any
+
+from ..mixins.base import _sanitize_log_value
+from .apply import _sqlite, _sync_lock
+from .orchestrator import PushResult, advance_push_cursor, push_to_peer
+
+logger = logging.getLogger(__name__)
+
+# Phrases a secondary answers a delete with when the row is already gone: the delete
+# has nothing left to do, so the event counts as delivered.
+_ALREADY_GONE = ("not found", "already deleted", "does not exist")
+
+
+def secondary_id_for(secondary: Any) -> str:
+    """Stable cursor key for a secondary, e.g. ``secondary:cloudflarestorage``."""
+    return "secondary:" + type(secondary).__name__.lower()
+
+
+def _row_store(conn, content_hash: str) -> str | None:
+    row = conn.execute(
+        "SELECT store FROM memories WHERE content_hash = ? AND deleted_at IS NULL", (content_hash,)
+    ).fetchone()
+    return row[0] if row else None
+
+
+class SecondaryForwarder:
+    """``PushPeerAdapter`` whose peer is the hybrid hub's own secondary backend."""
+
+    ontology_sync = False  # memory events only: the secondary has no ontology overlay
+
+    def __init__(self, hybrid: Any):
+        self.hybrid = hybrid
+        self.secondary_id = secondary_id_for(hybrid.secondary)
+
+    async def push_events(self, events: list[dict[str, Any]]) -> dict[str, Any]:
+        results: list[dict[str, Any]] = []
+        failed = 0
+        for event in events:
+            try:
+                status = await self._forward_one(event)
+            except Exception as exc:  # noqa: BLE001  the cursor must stop at the first failure
+                logger.warning(
+                    "Forward to %s failed for event %s: %s: %s",
+                    _sanitize_log_value(self.secondary_id),
+                    _sanitize_log_value(event.get("event_id")),
+                    _sanitize_log_value(type(exc).__name__),
+                    _sanitize_log_value(exc),
+                )
+                results.append({"event_id": event["event_id"], "status": "failed"})
+                failed += 1
+                break
+            results.append({"event_id": event["event_id"], "status": status})
+            self._record(event)
+        return {"results": results, "failed": failed}
+
+    async def _forward_one(self, event: dict[str, Any]) -> str:
+        op = event["op"]
+        content_hash = event["content_hash"]
+        if op == "delete":
+            return await self._forward_delete(content_hash)
+
+        # create / update_metadata: replay the CURRENT primary row, not the event body.
+        # The hub already resolved conflicts when it applied the event, so the row is
+        # the winner; a later event for the same hash will replay it again, harmlessly.
+        primary = self.hybrid.primary
+        state = await primary.get_sync_state_for_hash(content_hash)
+        if state is None or state[1] is not None:
+            return "skipped_gone"  # tombstoned since: its delete event follows in the log
+        memory = await primary.get_by_hash(content_hash)
+        if memory is None:
+            raise RuntimeError("primary row unreadable")
+        if op == "update_metadata":
+            return await self._forward_edit(memory)
+        return await self._forward_create(memory)
+
+    async def _forward_delete(self, content_hash: str) -> str:
+        state = await self.hybrid.primary.get_sync_state_for_hash(content_hash)
+        if state is not None and state[1] is None:
+            # Re-created on the hub after this delete: the delete is stale, and the
+            # create event later in the log carries the live row to the secondary.
+            return "skipped_recreated"
+        ok, me
```

**File**: `tests/unit/test_secondary_forwarder_1506.py` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+"""A hybrid hub forwards delta-sync events it applied to its secondary (#1506).
+
+``apply_remote_event`` writes through the primary's SQLite connection, so a spoke's
+create, edit and delete never reached the hybrid queue and Cloudflare stayed a partial
+copy. These tests run the real pieces: a SQLite-vec primary, a CloudflareStorage whose
+D1 calls run on an in-memory SQLite database, and ``forward_to_secondary`` tailing the
+hub's ``sync_events`` with a persisted cursor.
+"""
+
+import json
+import os
+import shutil
+import tempfile
+import time
+
+import pytest
+import pytest_asyncio
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.hybrid import BackgroundSyncService, HybridMemoryStorage
+from mcp_memory_service.storage.sqlite_vec import SqliteVecMemoryStorage
+from mcp_memory_service.storage.sync.apply import apply_remote_event
+from mcp_memory_service.storage.sync.forwarder import (
+    forward_to_secondary,
+    secondary_id_for,
+)
+from mcp_memory_service.storage.sync.orchestrator import get_push_cursor
+from mcp_memory_service.utils.hashing import generate_content_hash
+from tests.unit.test_cloudflare_store_scope import _FakeD1, cloudflare_storage, d1  # noqa: F401
+
+
+@pytest.fixture(autouse=True)
+def _eventlog_on(monkeypatch):
+    monkeypatch.setenv("MCP_SYNC_EVENTLOG", "on")
+
+
+def _build_hub(tmp, cloudflare_storage):  # noqa: F811
+    hub = HybridMemoryStorage(sqlite_db_path=os.path.join(tmp, "hub.db"))
+    hub.secondary = cloudflare_storage
+    hub.sync_service = BackgroundSyncService(hub.primary, cloudflare_storage)
+    return hub
+
+
+@pytest_asyncio.fixture
+async def hub(cloudflare_storage, d1):  # noqa: F811
+    await cloudflare_storage._initialize_d1_schema()
+    tmp = tempfile.mkdtemp(prefix="mcp-test-forwarder-")
+    hub = _build_hub(tmp, cloudflare_storage)
+    await hub.primary.initialize()
+    # First call pins the cursor at the end of the (empty) log, as it would on upgrade.
+    assert await forward_to_secondary(hub) is not None
+    yield hub
+    await hub.primary.close()
+    shutil.rmtree(tmp, ignore_errors=True)
+
+
+@pytest_asyncio.fixture
+async def spoke():
+    tmp = tempfile.mkdtemp(prefix="mcp-test-forwarder-spoke-")
+    storage = SqliteVecMemoryStorage(os.path.join(tmp, "spoke.db"))
+    await storage.initialize()
+    yield storage
+    await storage.close()
+    shutil.rmtree(tmp, ignore_errors=True)
+
+
+def _memory(content):
+    now = time.time()
+    return Memory(content=content, content_hash=generate_content_hash(content),
+                  tags=["spoke"], created_at=now, updated_at=now)
+
+
+def _events(storage):
+    cur = storage.conn.execute(
+        "SELECT seq, schema_version, event_id, op, content_hash, agent_id, hlc_physical, "
+        "hlc_logical, embedding_model, embedding_dim, payload FROM sync_events ORDER BY seq"
+    )
+    return [
+        {"seq": r[0], "schema_version": r[1] or 1, "event_id": r[2], "op": r[3],
+         "content_hash": r[4], "agent_id": r[5], "hlc_physical": r[6], "hlc_logical": r[7],
+         "embedding_model": r[8], "embedding_dim": r[9],
+         "payload": json.loads(r[10]) if r[10] else {}}
+        for r in cur.fetchall()
+    ]
+
+
+def _hub_applies_spoke_log(spoke, hub):
+    for event in _events(spoke):
+        apply_remote_event(hub, event)
+
+
+async def _spoke_writes_reach_hub(spoke, hub, memory):
+    ok, msg = await spoke.store(memory, skip_semantic_dedup=True)
+    assert ok, msg
+    _hub_applies_spoke_log(spoke, hub)
+
+
+@pytest.mark.asyncio
+async def test_spoke_create_reaches_cloudflare(hub, spoke, d1):  # noqa: F811
+    memory = _memory("A spoke wrote this and the hub applied it.")
+    await _spoke_writes_reach_hub(spoke, hub, memory)
+    assert d1.row(memory.content_hash) is None  # the bug: applied on the hub only
+
+    result = await forward_to_secondary(hub)
+
+    assert result.events_failed == 0 and result.events_pushed >= 1
+    assert d1.row(memory.content_hash)["deleted_at"] is None
+
+
+@pytest.mark.asyncio
+async def test_spoke_delete_reaches_cloudflare(hub, spoke, d1):  # noqa: F811
+    memory = _memory("A spoke wrote this and then deleted it.")
+    await _spoke_writes_reach_hub(spoke, hub, memory)
+    await forward_to_secondary(hub)
+    assert d1.row(memory.content_hash) is not None
+
+    ok, msg = await spoke.delete(memory.content_hash)
+    assert ok, msg
+    _hub_applies_spoke_log(spoke, hub)
+    await forward_to_secondary(hub)
+
+    assert d1.row(memory.content_hash)["deleted_at"] is not None
+
+
+@pytest.mark.asyncio
+async def test_spoke_edit_reaches_cloudflare(hub, spoke, d1):  # noqa: F811
+    memory = _memory("A spoke wrote this and then retagged it.")
+    await _spoke_writes_reach_hub(spoke, hub, memory)
+    await forward_to_secondary(hub)
+
+    ok, msg = await spoke.update_memory_metadata(memory.content_hash, {"tags": ["spoke", "edited"]})
+    assert ok, msg
+    _hub_applies_spoke_log(
```

**File**: `tests/unit/test_secondary_forwarder_retry_1506.py` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+"""Review follow-ups for the secondary forwarder (#1506, #2135).
+
+A failed edit on a row the secondary already holds must be retried, not skipped, and the
+live-store lookup must ignore tombstoned rows.
+"""
+
+import sqlite3
+
+import pytest
+
+from mcp_memory_service.storage.sync.forwarder import (
+    _row_store,
+    forward_to_secondary,
+    secondary_id_for,
+)
+from mcp_memory_service.storage.sync.orchestrator import get_push_cursor
+from tests.unit.test_cloudflare_store_scope import cloudflare_storage, d1  # noqa: F401
+from tests.unit.test_secondary_forwarder_1506 import (  # noqa: F401
+    _eventlog_on,
+    _hub_applies_spoke_log,
+    _memory,
+    _spoke_writes_reach_hub,
+    hub,
+    spoke,
+)
+
+
+@pytest.mark.asyncio
+async def test_failed_edit_on_an_existing_row_is_retried_not_skipped(
+    hub, spoke, d1, cloudflare_storage  # noqa: F811
+):
+    memory = _memory("The secondary has this row but the edit fails once.")
+    await _spoke_writes_reach_hub(spoke, hub, memory)
+    await forward_to_secondary(hub)
+    sid = secondary_id_for(cloudflare_storage)
+
+    ok, msg = await spoke.update_memory_metadata(memory.content_hash, {"tags": ["spoke", "edited"]})
+    assert ok, msg
+    _hub_applies_spoke_log(spoke, hub)
+    before = get_push_cursor(hub, sid)
+
+    async def _down(*args, **kwargs):
+        raise RuntimeError("D1 unavailable")
+
+    original = cloudflare_storage.update_memory_metadata
+    cloudflare_storage.update_memory_metadata = _down
+    try:
+        result = await forward_to_secondary(hub)
+    finally:
+        cloudflare_storage.update_memory_metadata = original
+
+    # The create fallback is refused as a duplicate: that must not count as delivered.
+    assert result.events_failed == 1
+    assert get_push_cursor(hub, sid) == before
+    assert (await forward_to_secondary(hub)).events_failed == 0
+    tags = {r[0] for r in d1.db.execute(
+        "SELECT t.name FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id "
+        "JOIN memories m ON m.id = mt.memory_id WHERE m.content_hash = ?",
+        (memory.content_hash,),
+    ).fetchall()}
+    assert tags == {"spoke", "edited"}
+
+
+def test_row_store_lookup_ignores_a_tombstoned_row():
+    conn = sqlite3.connect(":memory:")
+    conn.execute("CREATE TABLE memories (content_hash TEXT, store TEXT, deleted_at REAL)")
+    conn.execute("INSERT INTO memories VALUES ('live', 'a', NULL), ('gone', 'b', 1.0)")
+    assert _row_store(conn, "live") == "a"
+    assert _row_store(conn, "gone") is None
+
+
+@pytest.mark.asyncio
+async def test_recreated_row_refreshes_tags_on_the_secondary(
+    hub, spoke, d1, cloudflare_storage  # noqa: F811
+):
+    """Delete + re-create with new tags before forwarding: the delete is skipped as
+    stale, the create is refused as a duplicate, and the old tags must still be replaced."""
+    memory = _memory("Recreated on the spoke with different tags.")
+    await _spoke_writes_reach_hub(spoke, hub, memory)
+    await forward_to_secondary(hub)
+
+    ok, msg = await spoke.delete(memory.content_hash)
+    assert ok, msg
+    again = _memory(memory.content)
+    again.tags = ["spoke", "recreated"]
+    ok, msg = await spoke.store(again, skip_semantic_dedup=True)
+    assert ok, msg
+    _hub_applies_spoke_log(spoke, hub)
+
+    result = await forward_to_secondary(hub)
+
+    assert result.events_failed == 0
+    tags = {r[0] for r in d1.db.execute(
+        "SELECT t.name FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id "
+        "JOIN memories m ON m.id = mt.memory_id WHERE m.content_hash = ?",
+        (memory.content_hash,),
+    ).fetchall()}
+    assert tags == {"spoke", "recreated"}
```

---

### Incident Patch 2: `6847d593` (2026-11-27)
**Commit Message**: fix(auth): remove the fail-closed store guards and let per-store grants reach memory_explore and memory_detail (#2120) (#2145)

* fix(auth): remove the fail-closed store guards and let per-store grants reach memory_explore and memory_detail (#2120)

Every backend confines hash-addressed operations to store (sqlite_vec,
hybrid, cloudflare, milvus; remote_http refuses a named store at the
backend until the peer advertises store_scoped_access), so the handler
and service branches that refused on get_by_hash_is_store_scoped are
removed and store is handed to the storage call. store_grant_target and
require_store_scope keep reading the flag on the live storage object.

Closes #2120. Closes #1683.

* fix(graph): read memory_detail chunk rows unscoped for store="all" (#2120)

`all` is the tools' unscoped sentinel, but _hydrate_chunks handed it to
get_by_hash unchanged, and SQLite filters on `store = 'all'`, so every
chunk came back without text. Translate it to None as resolve_store does.

---------

Co-authored-by: massimiliano1991 <[REDACTED_EMAIL]>
Co-authored-by: x <[REDACTED_EMAIL]>

**File**: `changelog.d/2120.removed.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+- **The fail-closed store guards are gone, and a per-store credential reaches
+  `memory_explore` and `memory_detail` (#2120, closes #1683, massimiliano1991).** Every
+  backend now confines hash-addressed operations to `store` (sqlite_vec, hybrid,
+  cloudflare and milvus always; remote_http against a peer that advertises
+  `store_scoped_access`, refusing a named store otherwise), so the branches that refused
+  a store-scoped call by reading `get_by_hash_is_store_scoped` were removed from the
+  `content_hash` lookup in `memory_search`, `memory_update`, `memory_detail`, the REST
+  delete and update routes (including the content-edit helpers from #2129: the
+  replacement lookup, the split-chunk lookup and update, and the versioned path),
+  `evolve_memory` and the harvester's evolution path. The
+  handlers now pass `store` to the storage call and let the backend answer.
+  `memory_detail` also reads each chunk row with the claimed store. The flag is still
+  read in two places, on the live storage object: `store_grant_target` and
+  `require_store_scope` accept a `read:<store>`/`write:<store>` credential only where the
+  backend confines, so remote_http against an older peer still refuses one.
+  `memory_graph` stays on the global grant, because `connected`, `path` and `subgraph`
+  walk association edges that take no `store`.
```

**File**: `src/mcp_memory_service/harvest/harvester.py` (modified, +2/-5)
```diff
@@ -359,13 +359,10 @@ async def _try_evolve(
         if not hasattr(self.memory_service, "storage") or not self.memory_service.storage:
             return False, None
 
-        # A caller confined to one store may only evolve a memory of that store.
-        # Where get_by_hash ignores ``store`` that cannot be guaranteed, so the
-        # candidate is stored as its own memory instead (as memory_update refuses).
+        # A caller confined to one store may only evolve a memory of that store:
+        # the similarity search and the versioned update both take ``store``.
         store_kw = {}
         if store not in (None, "all"):
-            if not getattr(self.memory_service.storage, "get_by_hash_is_store_scoped", False):
-                return False, None
             store_kw = {"store": store}
 
         try:
```

**File**: `src/mcp_memory_service/server/handlers/graph.py` (modified, +11/-12)
```diff
@@ -912,18 +912,23 @@ async def _resolve_entity_name(graph, entity_id: str, store=None):
     )
 
 
-async def _hydrate_chunks(storage, memory_hashes, scoring=None, graph=None, entity_degree=0):
+async def _hydrate_chunks(
+    storage, memory_hashes, scoring=None, graph=None, entity_degree=0, store=None
+):
     """Fetch real chunk content for an entity's linked memories.
 
     Ranks by quality_score when available (simple sort, no composite scoring).
     Returns shape: {hash, content, relevance} where relevance = quality_score or None.
+    ``store`` confines each row read to the caller's partition (``None`` or
+    ``"all"`` is unscoped).
 
     When scoring="composite": enrich with composite_score + score_components,
     re-rank by composite (opt-in, Issue #55).
     """
     chunks = []
     for h in memory_hashes:
-        mem = await storage.get_by_hash(h)
+        # ``all`` is the tools' unscoped sentinel; the storage API spells it None.
+        mem = await storage.get_by_hash(h, store=None if store == "all" else store)
         content = (mem.content or "")[:500] if mem else None
         quality = getattr(mem, "quality_score", None) if mem else None
         chunks.append({
@@ -1015,20 +1020,14 @@ async def get_entity_detail(
 
     # Per-store confinement (read). The entity graph carries no store of its
     # own, so the graph layer confines every entity lookup through the store of
-    # the memory behind each link (#2118); the old `limit * 10` scan-then-filter
-    # window is gone with it. A backend whose get_by_hash ignores ``store``
-    # still cannot honour a store-restricted credential, so that case keeps
-    # failing closed until #2120 removes the guard.
-    if store is not None and store != "all" and not getattr(
-        storage, "get_by_hash_is_store_scoped", False
-    ):
-        raise ValueError("store-scoped memory_detail is not supported on this backend")
-
+    # the memory behind each link (#2118), and the chunk rows are read with the
+    # same ``store`` (#2120).
     memory_hashes = await graph.find_memories_by_entity(name, limit=limit, store=store)
 
     entity_degree = len(memory_hashes)  # proxy for centrality
     chunks = await _hydrate_chunks(
-        storage, memory_hashes, scoring=scoring, graph=graph, entity_degree=entity_degree
+        storage, memory_hashes, scoring=scoring, graph=graph,
+        entity_degree=entity_degree, store=store,
     )
     related_entities = (
         await _discover_related_entities(graph, memory_hashes, max_hops, store=store)
```

**File**: `src/mcp_memory_service/server/handlers/memory.py` (modified, +9/-16)
```diff
@@ -1312,10 +1312,10 @@ async def _search_tag_fallback(
 
 
 async def _retrieve_by_hash(storage, content_hash: str, store):
-    if store is not None and not getattr(storage, "get_by_hash_is_store_scoped", False):
-        return {
-            "error": "store-scoped content_hash lookup is not supported on this storage backend"
-        }, None
+    # Every backend confines get_by_hash to ``store`` (remote_http refuses a
+    # named store against a peer that does not advertise store_scoped_access,
+    # and reports the memory as missing), so a hash from another store comes
+    # back as not found (#2120).
     memory = await storage.get_by_hash(content_hash, store=store)
     memories = [memory.to_dict()] if memory else []
     return {
@@ -1862,15 +1862,13 @@ async def handle_update_memory_metadata(server, arguments: dict) -> List[types.T
         # gate authorizes the *claimed* store, but the update resolves by
         # content_hash and would otherwise ignore it — so a token scoped to one
         # store could update another store's memory. When a store is claimed,
-        # resolve the hash within it first: on backends whose get_by_hash honors
-        # ``store`` a hash from another store comes back missing -> not found;
-        # backends that ignore ``store`` can't prove confinement, so a
-        # store-scoped update fails closed there (real storage-layer enforcement
-        # is the follow-up issue, after which this pre-check can be removed).
+        # resolve the hash within it first: get_by_hash confines to ``store`` on
+        # every backend, so a hash from another store comes back missing -> not
+        # found (remote_http refuses a named store against a peer that does not
+        # advertise store_scoped_access, which reads the same way) (#2120).
         claimed_store = arguments.get("store")
         # Handed to the storage calls below as well, so the lookup and the write
-        # themselves are confined (#1875). Only set after the capability check,
-        # so a backend that would ignore ``store`` never receives it.
+        # themselves are confined (#1875).
         scope: dict = {}
         if claimed_store is not None and claimed_store != "all":
             # Raise rather than return: a refused update must surface as a tool
@@ -1879,11 +1877,6 @@ async def handle_update_memory_metadata(server, arguments: dict) -> List[types.T
             # both map a raised exception to isError; the broad except below
             # re-raises PermissionError so it is not flattened into a
             # success-looking TextContent.
-            if not getattr(storage, "get_by_hash_is_store_scoped", False):
-                raise PermissionError(
-                    "store-scoped updates are not supported on this storage backend; "
-                    "omit 'store' or use a globally-scoped credential"
-                )
             if await storage.get_by_hash(content_hash, store=claimed_store) is None:
                 raise PermissionError("memory not found in the requested store")
             scope = {"store": claimed_store}
```

**File**: `src/mcp_memory_service/server_impl.py` (modified, +10/-6)
```diff
@@ -1633,20 +1633,24 @@ def _rate_limit_error(
     # on a backend whose get_by_hash honours it. A per-store grant
     # (read:<s>/write:<s>) authorizes only these: every other tool acts on all
     # partitions, so naming a store there must not unlock it. memory_explore
-    # and memory_detail are left out: the entity graph is not partitioned, so
-    # their entity names and related entities span every store (#1683).
+    # and memory_detail joined once the entity lookups were confined through
+    # the store of the memory behind each link (#2118, #2119) and the chunk
+    # rows read with ``store`` (#2120). memory_graph stays on the global grant:
+    # its connected/path/subgraph actions walk association edges that take no
+    # ``store`` on either graph backend.
     STORE_CONFINED_TOOLS = frozenset({
         "memory_store", "memory_store_session", "memory_search", "memory_list",
-        "memory_delete", "memory_update",
+        "memory_delete", "memory_update", "memory_explore", "memory_detail",
     })
 
     async def store_grant_target(self, name: Optional[str], arguments: Optional[dict] = None) -> Optional[str]:
         """Return the store a per-store grant may authorize this call for.
 
         ``None`` means only the global grant will do: the call names no store
-        (or ``all``), the tool ignores ``store``, or the backend's get_by_hash
-        ignores ``store`` and so cannot
-        prove confinement (storage-layer enforcement is #1683). The SDK dispatch
+        (or ``all``), the tool ignores ``store``, or the live backend does not
+        confine ``store``. Every local backend does; remote_http does only
+        against a peer that advertises ``store_scoped_access``, so its flag is
+        read here on the storage object rather than assumed. The SDK dispatch
         gate and the /mcp shim both ask this, so the transports cannot disagree.
         """
         arguments = arguments or {}
```

**File**: `src/mcp_memory_service/services/memory_service.py` (modified, +0/-6)
```diff
@@ -735,12 +735,6 @@ async def evolve_memory(
 
         store_kw: Dict[str, Any] = {}
         if store not in (None, "all"):
-            if not getattr(self.storage, "get_by_hash_is_store_scoped", False):
-                return (
-                    False,
-                    "Store-scoped memory evolution is not supported by the active storage backend",
-                    None,
-                )
             store_kw = {"store": store}
 
         # Storage inherits omitted tags/type from the old version; keep that
```

**File**: `src/mcp_memory_service/storage/base.py` (modified, +6/-7)
```diff
@@ -546,11 +546,12 @@ async def get_by_exact_content(self, content: str, store: Optional[str] = None)
         """
         raise NotImplementedError("Subclasses must implement get_by_exact_content")
 
-    # Whether get_by_hash honors ``store`` (confines the lookup to that
-    # partition). Backends that accept ``store`` but ignore it leave this
-    # False, so a store-scoped hash-addressed operation must fail closed on
-    # them until the storage layer enforces ``store`` everywhere (follow-up
-    # issue). Overridden True on sqlite_vec and hybrid.
+    # Whether get_by_hash, delete and update_memory_metadata confine to
+    # ``store``. True on sqlite_vec, hybrid, cloudflare and milvus; remote_http
+    # sets it at runtime from the peer's ``store_scoped_access`` and refuses a
+    # named store until then. A per-store credential is accepted only where
+    # this is True (store_grant_target, require_store_scope). The default stays
+    # False so a backend that has not said it confines is not trusted to.
     get_by_hash_is_store_scoped: bool = False
 
     @abstractmethod
@@ -914,8 +915,6 @@ async def update_memory_metadata(
             preserve_timestamps: Whether to preserve original created_at timestamp
             store: Confine the update to this store; a memory in another store
                 is reported as not found. ``None`` or ``"all"`` is unscoped.
-                Only backends with ``get_by_hash_is_store_scoped`` honor it
-                (#1683); callers pass it only to those.
 
         Returns:
             Tuple of (success, message)
```

**File**: `src/mcp_memory_service/web/api/memories.py` (modified, +8/-36)
```diff
@@ -512,14 +512,8 @@ async def delete_memory(
         if not existing:
             raise HTTPException(status_code=404, detail="Memory not found")
 
-        # Confine the delete itself, not only the lookup before it. Backends
-        # that cannot confine do not accept a named ``store`` yet.
-        scope = (
-            {"store": resolve_store(store)}
-            if getattr(storage, "get_by_hash_is_store_scoped", False)
-            else {}
-        )
-        success, message = await storage.delete(content_hash, **scope)
+        # Confine the delete itself, not only the lookup before it.
+        success, message = await storage.delete(content_hash, store=resolve_store(store))
         
         # Broadcast SSE event for memory deletion
         try:
@@ -598,11 +592,7 @@ async def _store_unversioned_replacement(
     if not success:
         if "Duplicate content detected (exact match)" not in message:
             return False, message, None, False
-        lookup_store = (
-            resolve_store(store)
-            if getattr(storage, "get_by_hash_is_store_scoped", False)
-            else None
-        )
+        lookup_store = resolve_store(store)
         existing = await storage.get_by_hash(replacement.content_hash, store=lookup_store)
         # A previous attempt may have stored the replacement before the
         # original deletion failed. Resume only when every editable field matches;
@@ -659,11 +649,7 @@ async def _store_unversioned_split_replacement(
     max_length: int,
 ) -> Tuple[bool, str, Optional[str], bool]:
     """Split an oversized replacement the same way store_memory() does."""
-    lookup_store = (
-        resolve_store(store)
-        if getattr(storage, "get_by_hash_is_store_scoped", False)
-        else None
-    )
+    lookup_store = resolve_store(store)
     chunks = split_content(
         replacement.content,
         max_length=max_length,
@@ -673,11 +659,6 @@ async def _store_unversioned_split_replacement(
     stored_chunks = []
     claimed_chunk_hashes = set()
     original_reused = False
-    scope = (
-        {"store": resolve_store(store)}
-        if getattr(storage, "get_by_hash_is_store_scoped", False)
-        else {}
-    )
     for index, chunk in enumerate(chunks):
         plain_chunk_hash = generate_content_hash(chunk)
         chunk_hash = plain_chunk_hash
@@ -718,7 +699,7 @@ async def _store_unversioned_split_replacement(
                         "metadata": chunk_metadata,
                     },
                     preserve_timestamps=True,
-                    **scope,
+                    store=resolve_store(store),
                 )
                 if not fields_ok:
                     return False, (
@@ -828,11 +809,7 @@ async def _update_memory_content(
         if success and not new_hash:
             new_hash = content_hash
     elif hasattr(storage, "update_memory_versioned"):
-        version_store = (
-            resolve_store(store)
-            if getattr(storage, "get_by_hash_is_store_scoped", False)
-            else None
-        )
+        version_store = resolve_store(store)
         success, message, new_hash = await memory_service.evolve_memory(
             content_hash,
             request.content,
@@ -890,16 +867,11 @@ async def _update_memory_metadata_fields(
             memory=memory_to_response(existing_memory),
         )
 
-    scope = (
-        {"store": resolve_store(store)}
-        if getattr(storage, "get_by_hash_is_store_scoped", False)
-        else {}
-    )
     success, message = await storage.update_memory_metadata(
         content_hash=content_hash,
         updates=updates,
         preserve_timestamps=True,
-        **scope,
+        store=resolve_store(store),
     )
     if not success:
         return MemoryUpdateResponse(
@@ -908,7 +880,7 @@ async def _update_memory_metadata_fields(
             content_hash=content_hash,
         )
 
-    updated_memory = await storage.get_by_hash(content_hash)
+    updated_memory = await storage.get_by_hash(content_hash, store=resolve_store(store))
     return MemoryUpdateResponse(
         success=True,
         message=message,
```

---

### Incident Patch 3: `d1ead3b2` (2026-11-27)
**Commit Message**: fix: stop dashboard edits from being rejected as duplicates of the original (#2129)

* fix: stop dashboard edits from being rejected as duplicates of the original

Content edits now go through PUT /memories/{hash}: backends with
update_memory_versioned evolve the memory in place, and backends
without it (hybrid, cloudflare) store a replacement with semantic
dedup skipped for that store call, then delete the old hash, instead
of the old create-then-delete flow whose dedup rejected the edit as a
duplicate of the original memory. Oversized replacements split and
reuse matching chunks, SSE events notify other dashboard clients, and
the response only reports success after the replacement is stored.

Also hardens sqlite-vec versioned updates for repeated or same-hash
text: new versions get a unique hash and a monotonic family version,
so restoring earlier text and capitalization-only edits keep their
lineage and point-in-time visibility.

Adds API, storage, sync and dashboard regression tests: 102 pytest
tests pass with the change, 19 of them fail without it; the dashboard
node tests pass.

Fixes #2044

* fix: address Greptile review on dashboard content edits

- Milvus update_memory_ver

**File**: `changelog.d/2044.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **Dashboard edits no longer reject a memory as a duplicate of itself (#2044, zlg-codes).** Content changes now use the original memory's versioned-update endpoint, while tag-only edits ignore outer whitespace instead of creating a new version. Oversized edits split on every backend, Milvus stores restored text as a new version within the selected store, and reused chunks must match the edited text and fields exactly. Repeated chunks keep separate rows and position indexes.
```

**File**: `src/mcp_memory_service/storage/milvus.py` (modified, +50/-16)
```diff
@@ -3047,13 +3047,34 @@ async def update_memory(self, memory: Memory) -> bool:
         )
         return success
 
+    async def _is_current_or_versioned_ancestor(
+        self, candidate_hash: str, current_hash: str, store: str
+    ) -> bool:
+        """Return whether a row is the current version or one of its ancestors."""
+        visited = set()
+        while candidate_hash not in visited:
+            if candidate_hash == current_hash:
+                return True
+            visited.add(candidate_hash)
+            candidate = await self.get_by_hash(candidate_hash, store=store)
+            if candidate is None:
+                return False
+            successor = (candidate.metadata or {}).get("superseded_by")
+            if successor == current_hash:
+                return True
+            if not isinstance(successor, str):
+                return False
+            candidate_hash = successor
+        return False
+
     async def update_memory_versioned(
         self,
         content_hash: str,
         new_content: str,
         new_tags: Optional[List[str]] = None,
         new_memory_type: Optional[str] = None,
         reason: Optional[str] = None,
+        store: Optional[str] = None,
     ) -> Tuple[bool, str, Optional[str]]:
         """Non-destructive versioned update: store a new revision, supersede the old.
 
@@ -3079,7 +3100,7 @@ async def update_memory_versioned(
                 except Exception as exc:  # noqa: BLE001
                     return False, f"Failed to generate embedding: {exc}", None
 
-                existing, row_store = await self._get_for_write(content_hash, None)
+                existing, row_store = await self._get_for_write(content_hash, store)
                 if existing is None:
                     return False, f"Memory {content_hash} not found", None
                 if (existing.metadata or {}).get("superseded_by") is not None:
@@ -3101,22 +3122,34 @@ async def update_memory_versioned(
                 inherited_metadata.pop("evolution_reason", None)
 
                 new_hash = generate_content_hash(new_content)
-                new_memory = Memory(
-                    content=new_content,
-                    content_hash=new_hash,
-                    tags=resolved_tags,
-                    memory_type=resolved_type,
-                    metadata=inherited_metadata,
-                )
-                with (
-                    _exclude_versioned_parent(content_hash),
-                    _store_with_vector(new_embedding),
-                ):
-                    # The new version stays in the old row's store, as on
-                    # sqlite_vec (mixins/metadata.py).
-                    store_ok, store_msg = await self.store(
-                        new_memory, skip_semantic_dedup=True, store=row_store
+                salt = 0
+                while True:
+                    new_memory = Memory(
+                        content=new_content,
+                        content_hash=new_hash,
+                        tags=resolved_tags,
+                        memory_type=resolved_type,
+                        metadata=inherited_metadata,
                     )
+                    with (
+                        _exclude_versioned_parent(content_hash),
+                        _store_with_vector(new_embedding),
+                    ):
+                        # The new version stays in the old row's store, as on
+                        # sqlite_vec (mixins/metadata.py).
+                        store_ok, store_msg = await self.store(
+                            new_memory, skip_semantic_dedup=True, store=row_store
+                        )
+                    if store_ok or store_msg != "Duplicate content detected (exact match)":
+                        break
+                    # Only an earlier row in this version chain may be bypassed.
+                    # An independent memory with the same text stays untouched.
+                    if not await self._is_current_or_versioned_ancestor(
+                        new_hash, content_hash, row_store
+                    ):
+                        break
+                    salt += 1
+                    new_hash = generate_content_hash(f"{new_content}\0{content_hash}\0{salt}")
                 if not store_ok:
                     return False, f"Failed to store new version: {store_msg}", None
 
@@ -3126,6 +3159,7 @@ async def update_memory_versioned(
                 try:
                     linked, link_message = await self.update_memory_metadata(
                         content_hash, meta_updates, preserve_timestamps=True,
+                        store=row_store,
                     )
                 except Exception as link_exc:  # noqa: BLE001
                     cleaned = await self._cleanup_unlinked_version(new_hash)
```

**File**: `src/mcp_memory_service/storage/mixins/metadata.py` (modified, +215/-137)
```diff
@@ -923,6 +923,210 @@ def _touch(hashes=hashes_to_touch, ts=now):
 
         return enriched
 
+    def _version_family_members(self, content_hash: str) -> List[Tuple[str, Optional[int]]]:
+        """Return every hash and version in the bidirectional parent/supersession chain."""
+        return self.conn.execute(
+            """
+            WITH RECURSIVE version_family(content_hash) AS (
+                SELECT ?
+                UNION
+                SELECT m.parent_id FROM memories m
+                JOIN version_family f ON m.content_hash = f.content_hash
+                WHERE m.parent_id IS NOT NULL AND m.deleted_at IS NULL
+                UNION
+                SELECT m.content_hash FROM memories m
+                JOIN version_family f ON m.parent_id = f.content_hash
+                WHERE m.deleted_at IS NULL
+                UNION
+                SELECT m.superseded_by FROM memories m
+                JOIN version_family f ON m.content_hash = f.content_hash
+                WHERE m.superseded_by IS NOT NULL AND m.superseded_by <> ''
+                AND m.deleted_at IS NULL
+                UNION
+                SELECT m.content_hash FROM memories m
+                JOIN version_family f ON m.superseded_by = f.content_hash
+                WHERE m.deleted_at IS NULL
+                AND EXISTS (
+                    SELECT 1 FROM memories current
+                    WHERE current.content_hash = f.content_hash
+                    AND current.deleted_at IS NULL
+                )
+            )
+            SELECT content_hash, version FROM memories
+            WHERE content_hash IN (SELECT content_hash FROM version_family)
+            AND deleted_at IS NULL
+            """,
+            (content_hash,),
+        ).fetchall()
+
+    def _prepare_versioned_update(
+        self, old_hash: str, old_version: Optional[int], new_memory: Memory
+    ) -> int:
+        """Choose the next family version and avoid hashes already in that family."""
+        members = self._version_family_members(old_hash)
+        versions = [version or 1 for _, version in members]
+        new_version = max([old_version or 1, *versions]) + 1
+        if new_memory.content_hash in {content_hash for content_hash, _ in members}:
+            new_memory.content_hash = generate_content_hash(
+                f"{new_memory.content}\0{old_hash}\0{new_version}"
+            )
+        return new_version
+
+    async def _read_versioned_row(self, content_hash: str, store: Optional[str]):
+        """Read the current row and its inherited fields in the requested store."""
+        store_sql, store_params = _store_clause(store)
+
+        def _read():
+            return self.conn.execute(
+                "SELECT content_hash, tags, memory_type, version, metadata, store FROM memories "
+                "WHERE content_hash = ? AND deleted_at IS NULL" + store_sql,
+                (content_hash, *store_params),
+            ).fetchone()
+
+        return await self._execute_with_retry(_read)
+
+    def _build_versioned_memory(
+        self,
+        row,
+        new_content: str,
+        new_tags: Optional[List[str]],
+        new_memory_type: Optional[str],
+    ) -> Memory:
+        """Build a new version with inherited tags, type, and custom metadata."""
+        _, old_tags, old_type, _, old_metadata, _ = row
+        resolved_tags = new_tags if new_tags is not None else (
+            [tag for tag in old_tags.split(",") if tag and tag.strip() != CONFLICT_TAG]
+            if old_tags else []
+        )
+        resolved_type = (
+            coerce_memory_type(new_memory_type)
+            if new_memory_type is not None
+            else old_type
+        )
+        inherited_metadata = (
+            self._safe_json_loads(old_metadata, "update_memory_versioned")
+            if old_metadata else {}
+        )
+        inherited_metadata.pop("superseded_by", None)
+        inherited_metadata.pop("evolution_reason", None)
+        return Memory(
+            content=new_content,
+            content_hash=generate_content_hash(new_content),
+            tags=resolved_tags,
+            memory_type=resolved_type,
+            metadata=inherited_metadata,
+        )
+
+    async def _link_new_version(
+        self,
+        old_hash: str,
+        new_hash: str,
+        new_version: int,
+        reason: Optional[str],
+        store: Optional[str],
+    ) -> None:
+        """Link parent and child and supersede the old row in one transaction."""
+        store_sql, store_params = _store_clause(store)
+
+        def _link():
+            try:
+                self.conn.execute(
+                    "UPDATE memories SET parent_id = ?, version = ? WHERE content_hash = ?",
+                    (old_hash, new_version, new_hash),
+                )
+                row = self.conn.execute(
+                    "SELECT metadata FROM memories WHERE content_hash = ? AND deleted_at IS NULL"
+                    + store_sql,
+ 
```

**File**: `src/mcp_memory_service/web/api/memories.py` (modified, +406/-54)
```diff
@@ -21,7 +21,7 @@
 import logging
 import socket
 from collections import Counter
-from typing import List, Optional, Dict, Any, Literal
+from typing import List, Optional, Dict, Any, Literal, Tuple
 
 from fastapi import APIRouter, HTTPException, Depends, Query, Request
 from pydantic import BaseModel, Field, field_validator
@@ -30,10 +30,17 @@
 from ...storage.mixins.base import deserialize_embedding
 from ...storage.resonance_db import ResonanceDB
 from ...models.memory import Memory
-from ...models.ontology import get_all_types
-from ...services.memory_service import MemoryService
+from ...models.ontology import coerce_memory_type, get_all_types
+from ...services.memory_service import MemoryService, _chunk_metadata
+from ...utils.hashing import generate_content_hash
+from ...utils.content_splitter import split_content
 from ...compat import _sanitize_log_value
-from ...config import INCLUDE_HOSTNAME
+from ...config import (
+    INCLUDE_HOSTNAME,
+    ENABLE_AUTO_SPLIT,
+    CONTENT_PRESERVE_BOUNDARIES,
+    CONTENT_SPLIT_OVERLAP,
+)
 # OAuth config no longer needed - auth is always enabled
 from ..dependencies import get_storage, get_memory_service
 from .store_scope import resolve_store
@@ -74,11 +81,20 @@ def _content_must_not_be_blank(cls, value: str) -> str:
 
 
 class MemoryUpdateRequest(BaseModel):
-    """Request model for updating memory metadata (tags, type, metadata only)."""
+    """Request model for updating memory content, tags, type, and metadata."""
+    content: Optional[str] = Field(None, description="Updated memory content, stored as a new version")
     tags: Optional[List[str]] = Field(None, description="Updated tags to categorize the memory")
     memory_type: Optional[str] = Field(None, description="Updated memory type (e.g., 'note', 'reminder', 'fact')")
     metadata: Optional[Dict[str, Any]] = Field(None, description="Updated metadata for the memory")
 
+    @field_validator("content")
+    @classmethod
+    def _content_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
+        """Reject blank content instead of creating a zero-vector version."""
+        if value is not None and not value.strip():
+            raise ValueError("content must not be empty or whitespace-only")
+        return value
+
 
 class MemoryResponse(BaseModel):
     """Response model for memory data."""
@@ -526,19 +542,395 @@ async def delete_memory(
         raise HTTPException(status_code=500, detail="Failed to delete memory. Please try again.")
 
 
+def _build_memory_replacement(
+    existing_memory: Memory, request: MemoryUpdateRequest
+) -> Memory:
+    """Build a replacement while retaining fields omitted by the caller."""
+    inherited_metadata = dict(existing_memory.metadata or {})
+    inherited_metadata.pop("superseded_by", None)
+    inherited_metadata.pop("evolution_reason", None)
+    final_metadata = inherited_metadata
+    if request.metadata:
+        final_metadata.update(request.metadata)
+    for key in ("tags", "type"):
+        final_metadata.pop(key, None)
+    content_hash = generate_content_hash(request.content)
+    if content_hash == existing_memory.content_hash:
+        content_hash = generate_content_hash(
+            f"{request.content}\0{existing_memory.content_hash}"
+        )
+    return Memory(
+        content=request.content,
+        content_hash=content_hash,
+        tags=(
+            request.tags
+            if request.tags is not None
+            else [tag for tag in existing_memory.tags if tag != "conflict:unresolved"]
+        ),
+        memory_type=(
+            coerce_memory_type(request.memory_type)
+            if request.memory_type is not None
+            else existing_memory.memory_type
+        ),
+        metadata=final_metadata,
+    )
+
+
+async def _store_unversioned_replacement(
+    storage: MemoryStorage,
+    memory_service: MemoryService,
+    content_hash: str,
+    store: str,
+    replacement: Memory,
+) -> Tuple[bool, str, Optional[str], bool]:
+    """Store a replacement and remove its original on unversioned backends."""
+    max_length = getattr(storage, "max_content_length", None)
+    if ENABLE_AUTO_SPLIT and max_length and len(replacement.content) > max_length:
+        return await _store_unversioned_split_replacement(
+            storage, memory_service, content_hash, store, replacement, max_length
+        )
+
+    success, message = await storage.store(
+        replacement,
+        skip_semantic_dedup=True,
+        store=resolve_store(store),
+    )
+    if not success:
+        if "Duplicate content detected (exact match)" not in message:
+            return False, message, None, False
+        lookup_store = (
+            resolve_store(store)
+            if getattr(storage, "get_by_hash_is_store_scoped", False)
+            else None
+        )
+        existing = await storage.get_by_hash(replacement.content_hash, store=lookup_store)
+        # A previous attempt may have stored the replacement befo
```

**File**: `src/mcp_memory_service/web/static/app.js` (modified, +13/-44)
```diff
@@ -3519,53 +3519,22 @@ class MemoryDashboard {
             let successMessage;
 
             if (this.editingMemory) {
-                // Smart update: check if only metadata changed vs content changes
                 const originalContentHash = this.editingMemory.content_hash;
-                const contentChanged = this.editingMemory.content !== payload.content;
-
-
-                if (!contentChanged) {
-                    // Only metadata (tags, type, metadata) changed - use PUT endpoint
-                    const updatePayload = {
-                        tags: payload.tags,
-                        memory_type: payload.memory_type,
-                        metadata: payload.metadata
-                    };
-
-                    response = await this.apiCall(`/memories/${originalContentHash}`, 'PUT', updatePayload);
-                    successMessage = this.t('toast.memoryUpdatedSuccess', 'Memory updated successfully');
-                } else {
-                    // Content changed - use create-delete approach (but with proper error handling)
+                const updatePayload = {
+                    tags: payload.tags,
+                    memory_type: payload.memory_type,
+                    metadata: payload.metadata
+                };
+                // The form trims content, so outer whitespace alone is not an edit.
+                if (this.editingMemory.content.trim() !== payload.content) {
+                    updatePayload.content = payload.content;
+                }
 
-                    try {
-                        // Step 1: Create updated memory first
-                        response = await this.apiCall('/memories', 'POST', payload);
-
-                        // CRITICAL: Only proceed with deletion if creation actually succeeded
-                        if (response.success) {
-                            successMessage = this.t('toast.memoryUpdatedSuccess', 'Memory updated successfully');
-
-                            try {
-                                // Step 2: Delete original memory (only after successful creation)
-                                const deleteResponse = await this.apiCall(`/memories/${originalContentHash}`, 'DELETE');
-                            } catch (deleteError) {
-                                console.error('Failed to delete original memory after creating new version:', deleteError);
-                                this.showToast(
-                                    this.t('toast.duplicateMemoryWarning', 'Memory updated, but original version still exists. You may need to manually delete the duplicate.'),
-                                    'warning'
-                                );
-                            }
-                        } else {
-                            // Creation failed - do NOT delete original memory
-                            console.error('Creation failed:', response.message);
-                            throw new Error(`Failed to create updated memory: ${response.message}`);
-                        }
-                    } catch (createError) {
-                        // CREATE failed - original memory intact, no cleanup needed
-                        console.error('Failed to create updated memory:', createError);
-                        throw new Error(`Failed to update memory: ${createError.message}`);
-                    }
+                response = await this.apiCall(`/memories/${originalContentHash}`, 'PUT', updatePayload);
+                if (!response.success) {
+                    throw new Error(response.message || 'Failed to update memory');
                 }
+                successMessage = this.t('toast.memoryUpdatedSuccess', 'Memory updated successfully');
             } else {
                 // Create new memory
                 response = await this.apiCall('/memories', 'POST', payload);
```

**File**: `tests/storage/test_backend_store_signature_conformance.py` (modified, +1/-0)
```diff
@@ -185,6 +185,7 @@
                 "new_tags": ["updated"],
                 "new_memory_type": "decision",
                 "reason": "source changed",
+                "store": "team",
             },
         ),
     ],
```

**File**: `tests/storage/test_milvus_store_scope.py` (modified, +21/-1)
```diff
@@ -214,12 +214,32 @@ async def test_versioned_update_keeps_the_new_version_in_the_old_store():
     storage = _make_storage(has_store=True)
     storage._call_client = _client([_row(store="team")])
 
-    ok, msg, new_hash = await storage.update_memory_versioned(_HASH, "body, revised")
+    ok, msg, new_hash = await storage.update_memory_versioned(
+        _HASH, "body, revised", store="team"
+    )
 
     assert ok, msg
     (insert,) = _calls(storage._call_client, "insert")
     assert insert["data"][0]["id"] == new_hash
     assert insert["data"][0]["store"] == "team"
+    (upsert,) = _calls(storage._call_client, "upsert")
+    assert upsert["data"][0]["store"] == "team"
+
+
+@pytest.mark.asyncio
+async def test_versioned_update_in_another_store_is_refused_without_a_write():
+    storage = _make_storage(has_store=True)
+    storage._call_client = _client([_row(store="team")])
+
+    ok, msg, new_hash = await storage.update_memory_versioned(
+        _HASH, "body, revised", store="ops"
+    )
+
+    assert ok is False
+    assert "not found" in msg
+    assert new_hash is None
+    assert _calls(storage._call_client, "insert") == []
+    assert _calls(storage._call_client, "upsert") == []
 
 
 # -- Hash-addressed calls are confined ----------------------------------------
```

**File**: `tests/storage/test_milvus_versioned_repeated_text.py` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+"""Milvus versioned updates must give restored text a fresh hash (#2129).
+
+After A→B the superseded row for A is still stored, so restoring A with the
+plain content hash collides with that row and store() rejects it as an exact
+duplicate: the edit can never be undone. These tests use a mocked client, in
+the style of test_milvus_update_stored_vector.py, so they run without pymilvus.
+"""
+
+from __future__ import annotations
+
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+
+from mcp_memory_service.models.memory import Memory
+from mcp_memory_service.storage.milvus import MilvusMemoryStorage
+from mcp_memory_service.utils.hashing import generate_content_hash
+
+_A_TEXT = "Alice works at Acme"
+_A_HASH = generate_content_hash(_A_TEXT)
+_B_HASH = "b" * 64
+
+
+def _memory(content: str, content_hash: str, superseded_by=None) -> Memory:
+    metadata = {} if superseded_by is None else {"superseded_by": superseded_by}
+    return Memory(content=content, content_hash=content_hash, metadata=metadata)
+
+
+def _make_storage(rows: dict) -> MilvusMemoryStorage:
+    rows.setdefault(_B_HASH, _memory("Alice works at Globex", _B_HASH))
+    storage = MilvusMemoryStorage.__new__(MilvusMemoryStorage)
+    storage.uri = "./milvus.db"
+    storage.collection_name = "unit_test_collection"
+    storage.embedding_dimension = 4
+    storage.embedding_model_name = "test-model"
+    storage.embedding_model = MagicMock()
+    storage._initialized = True
+    storage.client = MagicMock()
+    storage._generate_embedding = MagicMock(return_value=[0.1, 0.2, 0.3, 0.4])
+
+    async def call_client(method: str, **kwargs):
+        if method == "get":
+            return [{"id": h} for h in kwargs.get("ids") or [] if h in rows]
+        return None
+
+    async def get_by_hash(content_hash, store=None):
+        return rows.get(content_hash)
+
+    async def get_for_write(content_hash, store, **kwargs):
+        return rows.get(content_hash), "default"
+
+    async def update_memory_metadata(content_hash, updates, **kwargs):
+        rows[content_hash].metadata.update(updates.get("metadata", {}))
+        return True, "ok"
+
+    async def store(memory, skip_semantic_dedup=False, store="default", **kwargs):
+        if memory.content_hash in rows:
+            return False, "Duplicate content detected (exact match)"
+        rows[memory.content_hash] = memory
+        return True, "Memory stored successfully"
+
+    storage._call_client = call_client
+    storage.get_by_hash = get_by_hash
+    storage._get_for_write = get_for_write
+    storage.update_memory_metadata = update_memory_metadata
+    storage.store = store
+    storage._cleanup_unlinked_version = AsyncMock(return_value=True)
+    return storage
+
+
+@pytest.mark.asyncio
+async def test_restoring_earlier_text_stores_a_new_version():
+    rows = {_A_HASH: _memory(_A_TEXT, _A_HASH, superseded_by=_B_HASH)}
+    storage = _make_storage(rows)
+
+    ok, message, new_hash = await storage.update_memory_versioned(_B_HASH, _A_TEXT)
+
+    assert ok, message
+    assert new_hash is not None
+    assert new_hash != _A_HASH
+    assert new_hash in rows
+    assert rows[new_hash].content == _A_TEXT
+
+
+@pytest.mark.asyncio
+async def test_repeated_restores_get_distinct_salted_hashes():
+    rows = {_A_HASH: _memory(_A_TEXT, _A_HASH, superseded_by=_B_HASH)}
+    storage = _make_storage(rows)
+
+    ok1, _, first = await storage.update_memory_versioned(_B_HASH, _A_TEXT)
+    assert ok1
+    ok2, _, second = await storage.update_memory_versioned(first, _A_TEXT)
+
+    assert ok2
+    assert first != second
+    assert first in rows and second in rows
+
+
+@pytest.mark.asyncio
+async def test_independent_duplicate_is_not_recreated_as_a_version():
+    rows = {_A_HASH: _memory(_A_TEXT, _A_HASH)}
+    storage = _make_storage(rows)
+
+    ok, message, new_hash = await storage.update_memory_versioned(_B_HASH, _A_TEXT)
+
+    assert not ok
+    assert "Duplicate content detected" in message
+    assert new_hash is None
+    assert len(rows) == 2
+    assert rows[_A_HASH].metadata == {}
+
+
+@pytest.mark.asyncio
+async def test_unrelated_superseded_duplicate_is_not_in_the_version_chain():
+    rows = {_A_HASH: _memory(_A_TEXT, _A_HASH, superseded_by="c" * 64)}
+    storage = _make_storage(rows)
+
+    ok, message, new_hash = await storage.update_memory_versioned(_B_HASH, _A_TEXT)
+
+    assert not ok
+    assert "Duplicate content detected" in message
+    assert new_hash is None
+    assert len(rows) == 2
+    assert rows[_A_HASH].metadata == {"superseded_by": "c" * 64}
+
+
+@pytest.mark.asyncio
+async def test_capitalization_edit_does_not_collide_with_current_row():
+    original = "hello"
+    original_hash = generate_content_hash(original)
+    rows = {original_hash: _memory(original, original_hash)}
+    storage = _make_storage(rows)
+
+    ok, message, new_hash = await storage.update_memory_versioned(original_hash, "Hello")
+
+    assert ok, message

```

#### Recent Merged Pull Requests:
- **PR #2145** (2026-11-27): fix(auth): remove the fail-closed store guards and let per-store grants reach memory_explore and memory_detail (#2120) (@massimiliano1991)
- **PR #2144** (2026-11-27): chore(release): v13.1.0 (@doobidoo)
- **PR #2142** (2026-11-27): fix(dashboard): move the sync actions onto the island row and retire the compact card (@rise11hx-cmyk)
- **PR #2141** (2026-11-26): docs(claude-md): move detail into directives and cut what the rules already say (@doobidoo)
- **PR #2140** (closed): docs: add Protodex verification badge to README (@manja316)
- **PR #2139** (2026-11-26): fix(milvus): count live rows from one scan (@doobidoo)

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

## X. sync): forward delta-sync events a hybrid hub applied to its secondary (#1506, p

**RULE**:
When implementing operations in `changelog.d/1506.fixed.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in doobidoo/mcp-memory-service. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bef18ef5`: sync): forward delta-sync events a hybrid hub applied to its secondary (#1506, part 1 of 2). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/1506.fixed.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **A hybrid hub forwards the delta-sync events it applied to its Cloudflare secondary (#1506).** `apply_remote_event` writes through the primary's SQLite connection, so a spoke's create, edit or delete reached the hub and every other spoke but never D1, which silently became a partial copy holding only the hub's own writes. The scheduled sync cycle now tails the hub's `sync_events` with a persisted per-secondary cursor (the `push_cursor` table and `push_to_peer` loop spokes already use) and replays each event to the secondary: a create or edit stores or updates the current row in its store, a delete deletes it. The cursor moves only after the secondary acknowledged, so a restart or a D1 outage between "applied" and "forwarded" re-delivers instead of dropping. A hub that upgrades starts at the end of its log; the drift scan keeps the backlog. Each forwarded event is recorded in the new `secondary_forwarded` table (migration 023), the identity a later pull-side guard can check. Part 1 of 2: the pull-side echo guard follows separately.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bef18ef5` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
