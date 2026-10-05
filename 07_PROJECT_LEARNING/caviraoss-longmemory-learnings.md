# Forensic Learning Record (Deep Inspection): CaviraOSS/LongMemory

> **Canonical Artifact**: `07_PROJECT_LEARNING/caviraoss-longmemory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CaviraOSS/LongMemory](https://github.com/CaviraOSS/LongMemory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:31.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CaviraOSS/LongMemory`
- **Description**: Local persistent memory store for LLM applications including claude desktop, github copilot, codex, antigravity, etc.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4516 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/src/scorecard.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : benchmarks/src/scorecard.ts
 *  usage : supports LongMemory benchmark scorecard
 */


import type { case_checkpoint, longmemory_scorecard, provider_report, run_manifest, scorecard_metric } from "./types";

const unavailable = (unit: scorecard_metric["unit"], reason: string): scorecard_metric => ({
    value: null, unit, numerator: null, denominator: null, reason,
});

const ratio = (numerator: number, denominator: number, reason = ""): scorecard_metric => denominator > 0
    ? { value: numerator / denominator, unit: "ratio", numerator, denominator, ...(reason ? { reason } : {}) }
    : unavailable("ratio", reason || "no eligible questions");

const scalar = (value: number, unit: scorecard_metric["unit"], denominator: number): scorecard_metric => ({
    value, unit, numerator: null, denominator,
});

const terminal_cases = (provider: provider_report, manifest: run_manifest): case_checkpoint[] => provider.cases.filter((item) =>
    item.phases[manifest.ai.enabled ? "judge" : "evaluate"].status === "completed",
);

const judged = (cases: case_checkpoint[], cutoff: number): scorecard_metric => {
    const values = cases.flatMap((item) => item.cutoff_results?.[`top_${cutoff}`]?.score ?? []);
    return values.length ? ratio(values.reduce((sum, value) => sum + value, 0), values.length) : unavailable("ratio", "AI answer evaluation was not completed");
};

const category_accuracy = (cases: case_checkpoint[], cutoff: number, categories: Set<string>, label: string): scorecard_metric => {
    const selected = cases.filter((item) => categories.has(item.category));
    return selected.length ? judged(selected, cutoff) : unavailable("ratio", `no ${label} cases in the selected datasets`);
};

const dataset_accuracy = (provider: provider_report, dataset: "longmemeval" | "locomo" | "beam-1m" | "beam-10m", cutoff: number): scorecard_metric => {
    const result = provider.datasets.find((item) => item.dataset === dataset);
    if (!result) return unavailable("ratio", `${dataset} was not selected`);
    if (result.failed_questions > 0) return unavailable("ratio", `${dataset} run incomplete: ${result.failed_questions} question(s) failed`);
    const value = result.answer_accuracy[`top_${cutoff}`];
    return value === undefined ? unavailable("ratio", `${dataset} requires answerer and judge evaluation`) : ratio(value * result.questions, result.questions);
};

const rank_weighted_precision = (item: case_checkpoint, cutoff: number): number | null => {
    const evidence = new Set(item.evidence_ids ?? []);
    if (!evidence.size || !item.hits?.length) return null;
    let relevant_seen = 0;
    let weighted = 0;
    for (const [index, hit] of item.hits.slice(0, cutoff).entries()) {
        if (!hit.evidence_id || !evidence.has(hit.evidence_id)) continue;
        relevant_seen++;
        weighted += relevant_seen / (index + 1);
    }
    return weighted / evidence.size;
};

export function build_longmemory_scorecard(manifest: run_manifest, provider?: provider_report): longmemory_scorecard {
    const cutoff = manifest.cutoffs.includes(5) ? 5 : Math.max(...manifest.cutoffs);
    if (!provider) {
        const missing = (unit: scorecard_metric["unit"]) => unavailable(unit, "LongMemory provider did not produce a report");
        return {
            cutoff,
            memory_quality: { longmemeval: missing("ratio"), locomo: missing("ratio"), beam_1m: missing("ratio"), beam_10m: missing("ratio") },
            retrieval: { context_recall: missing("ratio"), context_precision: missing("ratio"), evidence_completeness: missing("ratio") },
            temporal_memory: { current_fact_accuracy: missing("ratio"), historical_fact_accuracy: missing("ratio"), update_accuracy: missing("ratio"), event_order_accuracy: missing("ratio") },
            reliability: { abstention_accuracy: missing("ratio"), contradiction_resolution: missing("ratio") },
            efficiency: { p50_retrieval: missing("milliseconds"), p95_retrieval: missing("milliseconds"), mean_tokens_retrieved: missing("tokens"), write_cost_per_1k_input_tokens: missing("usd"), read_cost_per_query: missing("usd") },
        };
    }

    const cases = terminal_cases(provider, manifest);
    const retrieval_cases = cases.flatMap((item) => {
        const metric = item.metrics?.find((value) => value.k === cutoff);
        return metric?.queries ? [{ item, metric }] : [];
    });
    const recall_sum = retrieval_cases.reduce((sum, value) => sum + value.metric.recall, 0);
    const precision_values = retrieval_cases.map((value) => rank_weighted_precision(value.item, cutoff)).filter((value): value is number => value !== null);
    const precision_sum = precision_values.reduce((sum, value) => sum + value, 0);
    const complete = retrieval_cases.filter((value) => value.metric.recall === 1).length;
    const update_cases = cases.filter((item) => item.category === "knowledge-update");
    const update_contradictions = update_cases.flatMap((item) => {
        const score = item.cutoff_results?.[`top_${cutoff}`]?.score;
        return score === undefined ? [] : [score === 1 && !item.stale_leakage ? 1 : 0];
    });
    const judged_contradictions = judged(cases.filter((item) => item.category === "contradiction-resolution"), cutoff);
    const contradiction_numerator = update_contradictions.reduce((sum, value) => sum + value, 0) + (judged_contradictions.numerator ?? 0);
    const contradiction_denominator = update_contradictions.length + (judged_contradictions.denominator ?? 0);
    const read_tokens = cases.flatMap((item) => item.read_input_tokens ?? []);
    const semantic_active = manifest.providers.find((item) => item.name === "longmemory")?.profile === "semantic";
    const price = semantic_active ? manifest.longmemory_embedding?.input_cost_per_million_usd ?? null : null;
    const cost_reason = semantic_active ? "set BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD to calculate embedding cost" : "semantic embedding profile was not active";
    const mean_read_tokens = read_tokens.length ? read_tokens.reduce((sum, value) => sum + value, 0) / read_tokens.length : 0;

    return {
        cutoff,
        memory_quality: {
            longmemeval: dataset_accuracy(provider, "longmemeval", cutoff),
            locomo: dataset_accuracy(provider, "locomo", cutoff),
            beam_1m: dataset_accuracy(provider, "beam-1m", cutoff),
            beam_10m: dataset_accuracy(provider, "beam-10m", cutoff),
        },
        retrieval: {
            context_recall: ratio(recall_sum, retrieval_cases.length, `macro-average evidence recall at K=${cutoff}`),
            context_precision: ratio(precision_sum, precision_values.length, `rank-weighted evidence precision at K=${cutoff}`),
            evidence_completeness: ratio(complete, retrieval_cases.length, `questions retrieving all required evidence at K=${cutoff}`),
        },
        temporal_memory: {
            current_fact_accuracy: category_accuracy(cases, cutoff, new Set(["information-extraction", "single-hop"]), "direct current-fact"),
            historical_fact_accuracy: unavailable("ratio", "no dedicated historical-fact dataset is implemented"),
            update_accuracy: category_accuracy(cases, cutoff, new Set(["knowledge-update"]), "knowledge-update"),
            event_order_accuracy: category_accuracy(cases, cutoff, new Set(["temporal-reasoning", "event-ordering"]), "temporal/event-order"),
        },
        reliability: {
            abstention_accuracy: category_accuracy(cases, cutoff, new Set(["abstention", "adversarial"]), "abstention"),
            contradiction_resolution: contradiction_denominator
                ? ratio(contradiction_numerator, contradiction_denominator, "judged contradiction handling plus correct updates with no forbidden stale evidence")
                : unavailable("ratio", "no judged contradiction or knowledge-update cases with stale-evidence annotations"),
        },
        efficiency: {
            p50_retrieval: provider.latency.search.count ? scalar(provider.latency.search.p50, "milliseconds", provider.latency.search.count) : unavailable("milliseconds", "no completed retrievals"),
            p95_retrieval: provider.latency.search.count ? scalar(provider.latency.search.p95, "milliseconds", provider.latency.search.count) : unavailable("milliseconds", "no completed retrievals"),
            mean_tokens_retrieved: cases.length ? scalar(provider.average_context_tokens, "tokens", cases.length) : unavailable("tokens", "no completed retrievals"),
            write_cost_per_1k_input_tokens: price === null
                ? unavailable("usd", cost_reason)
                : scalar(price / 1_000, "usd", 1_000),
            read_cost_per_query: price === null
                ? unavailable("usd", cost_reason)
                : scalar(mean_read_tokens * price / 1_000_000, "usd", read_tokens.length),
        },
    };
}
```

### Core Architecture Module: `dashboard/lib/memory-ai-engine.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/lib/memory-ai-engine.ts
 *  usage : supports the LongMemory dashboard memory ai engine
 */


interface MemoryReference {
    id: string
    sector: "semantic" | "episodic" | "procedural" | "emotional" | "reflective"
    content: string
    salience: number
    title: string
    last_seen_at?: number
    score?: number
}

interface QueryContext {
    query: string
    queryType: string
    intent: string
    keywords: string[]
    entities: string[]
    complexity: 'simple' | 'moderate' | 'complex'
    temporalContext?: {
        hasTimeReference: boolean
        timeExpressions: string[]
        temporalScope: 'past' | 'present' | 'future' | 'general'
    }
    sentiment?: {
        polarity: 'positive' | 'negative' | 'neutral'
        intensity: number
    }
}

interface MemoryCluster {
    id: string
    centroid: string
    members: MemoryReference[]
    coherence: number
    sector: string
    keywords: string[]
    semanticDensity: number
    importance: number
}

interface AnswerSegment {
    type: 'direct' | 'context' | 'elaboration' | 'reflection' | 'synthesis' | 'transition'
    content: string
    sources: string[]
    confidence: number
    relevance: number
    coherenceScore: number
}

interface GeneratedAnswer {
    segments: AnswerSegment[]
    finalText: string
    confidence: number
    memoryCount: number
    sectorBreakdown: Record<string, number>
    citations: Array<{ id: string; snippet: string; sector: string }>
    reasoning?: string
    alternatives?: string[]
    qualityMetrics: {
        coherence: number
        completeness: number
        relevance: number
        diversity: number
    }
}

interface TextSpan {
    text: string
    start: number
    end: number
    type: 'sentence' | 'phrase' | 'clause'
}

interface SemanticGraph {
    nodes: Map<string, SemanticNode>
    edges: SemanticEdge[]
}

interface SemanticNode {
    id: string
    text: string
    importance: number
    keywords: string[]
    linkedMemories: string[]
}

interface SemanticEdge {
    source: string
    target: string
    weight: number
    type: 'causal' | 'temporal' | 'associative' | 'contrasting'
}

interface ContextWindow {
    memories: MemoryReference[]
    totalTokens: number
    priorityScores: Map<string, number>
    temporalRelevance: Map<string, number>
}

type StopWord = string

const STOP_WORDS: StopWord[] = [
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'you', 'me', 'my', 'we', 'our',
    'this', 'these', 'those', 'can', 'do', 'have', 'had', 'been', 'being',
    'but', 'or', 'if', 'than', 'because', 'while', 'where', 'after', 'so',
    'though', 'since', 'until', 'whether', 'before', 'although', 'nor',
    'like', 'once', 'unless', 'now', 'except', 'also', 'into', 'over',
    'such', 'then', 'them', 'same', 'only', 'may', 'must', 'shall'
]

const TEMPORAL_EXPRESSIONS = [
    'yesterday', 'today', 'tomorrow', 'last week', 'next week', 'last month',
    'next month', 'last year', 'next year', 'ago', 'later', 'soon', 'recently',
    'earlier', 'before', 'after', 'during', 'while', 'when', 'now', 'currently',
    'previously', 'formerly', 'future', 'past', 'present', 'meanwhile'
]

const SENTIMENT_POSITIVE = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love',
    'happy', 'joy', 'pleased', 'satisfied', 'excited', 'delighted', 'brilliant',
    'perfect', 'best', 'awesome', 'terrific', 'superb', 'outstanding'
]

const SENTIMENT_NEGATIVE = [
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'hate', 'sad',
    'angry', 'frustrated', 'disappointed', 'upset', 'annoyed', 'irritated',
    'concerned', 'worried', 'anxious', 'stressed', 'unhappy', 'displeased'
]

const DISCOURSE_MARKERS = {
    causal: ['because', 'therefore', 'thus', 'hence', 'consequently', 'as a result', 'due to'],
    temporal: ['then', 'next', 'after', 'before', 'while', 'during', 'meanwhile', 'subsequently'],
    additive: ['also', 'furthermore', 'moreover', 'additionally', 'besides', 'in addition'],
    contrastive: ['but', 'however', 'although', 'despite', 'yet', 'nevertheless', 'on the other hand'],
    exemplification: ['for example', 'for instance', 'such as', 'like', 'specifically', 'particularly']
}

const COMPLEXITY_INDICATORS = {
    simple: ['what', 'who', 'when', 'where', 'yes', 'no'],
    moderate: ['how', 'why', 'explain', 'describe', 'compare'],
    complex: ['analyze', 'evaluate', 'synthesize', 'critique', 'justify', 'hypothesize']
}

const QUESTION_STARTERS = [
    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose',
    'can', 'could', 'should', 'would', 'is', 'are', 'do', 'does', 'did'
]

const INTENT_PATTERNS: Record<string, RegExp> = {
    procedural: /how\s+(do|to|can)|steps|process|procedure|guide|tutorial|instructions|method|way to/i,
    episodic: /remember|recall|when did|last time|previous|earlier|before|history|experience|happened/i,
    emotional: /feel|feeling|emotion|mood|sentiment|happy|sad|anxious|stressed|excited|worried/i,
    reflective: /why|reason|insight|analysis|summary|reflect|think|believe|opinion|lesson|learning/i,
    factual: /what is|define|explain|describe|tell me about|information on|details|fact/i,
    comparative: /compare|difference|better|worse|versus|vs|which one|best|prefer/i,
    actionable: /recommend|suggest|advise|should i|what to|help me|looking for/i
}

const SECTOR_AFFINITIES: Record<string, string[]> = {
    semantic: ['factual', 'comparative', 'actionable'],
    episodic: ['episodic', 'emotional'],
    procedural: ['procedural', 'actionable'],
    emotional: ['emotional', 'reflective'],
    reflective: ['reflective', 'comparative']
}

/**
 * Advanced text processing utilities with NLP capabilities
 */
class TextProcessor {
    /**
     * Tokenize text with stop word filtering
     */
    static tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !STOP_WORDS.includes(t))
    }

    /**
     * Tokenize text while preserving position information
     */
    static tokenizeWithPosition(text: string): Array<{ token: string; position: number }> {
        const normalized = text.toLowerCase()
        const tokens: Array<{ token: string; position: number }> = []
        let currentPos = 0

        for (const word of normalized.split(/\s+/)) {
            const cleaned = word.replace(/[^\w]/g, '')
            if (cleaned.length > 2 && !STOP_WORDS.includes(cleaned)) {
                tokens.push({ token: cleaned, position: currentPos })
            }
            currentPos++
        }
        return tokens
    }

    /**
     * Extract n-grams from text
     */
    static extractNgrams(text: string, n: number = 2): string[] {
        const tokens = this.tokenize(text)
        if (tokens.length < n) return []

        const ngrams: string[] = []
        for (let i = 0; i <= tokens.length - n; i++) {
            ngrams.push(tokens.slice(i, i + n).join(' '))
        }
        return ngrams
    }

    /**
     * Extract keywords with frequency-based scoring including n-grams
     */
    static extractKeywords(text: string, topN: number = 10): string[] {
        const tokens = this.tokenize(text)
        const bigrams = this.extractNgrams(text, 2)
        const trigrams = this.extractNgrams(text, 3)

        const freq: Record<string, number> = {}

        for (const t of tokens) {
            freq[t] = (freq[t] || 0) + 1.0
        }

        for (const bg of bigrams) {
            freq[bg] = (freq[bg] || 0) + 1.5
        }

        for (const tg of trigrams) {
            freq[tg] = (freq[tg] || 0) + 2.0
        }

        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([word]) => word)
    }

    /**
     * Extract meaningful key phrases from text
     */
    static extractKeyPhrases(text: string, topN: number = 5): string[] {
        const sentences = this.sentenceSplit(text)
        const phrases: Map<string, number> = new Map()

        for (const sentence of sentences) {
            const bigrams = this.extractNgrams(sentence, 2)
            const trigrams = this.extractNgrams(sentence, 3)

            for (const phrase of [...bigrams, ...trigrams]) {
                const tokens = phrase.split(' ')
                const hasCapital = /[A-Z]/.test(text.substring(
                    Math.max(0, text.toLowerCase().indexOf(phrase) - 1),
                    text.toLowerCase().indexOf(phrase) + phrase.length + 1
                ))

                const score = tokens.length * (hasCapital ? 1.5 : 1.0)
                phrases.set(phrase, (phrases.get(phrase) || 0) + score)
            }
        }

        return Array.from(phrases.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([phrase]) => phrase)
    }

    /**
     * Extract named entities and important terms
     */
    static extractEntities(text: string): string[] {
        const capitalized = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
        const quoted = text.match(/"([^"]+)"/g)?.map(q => q.replace(/"/g, '')) || []
        const patterns = [
            /\b[A-Z]{2,}\b/g,
            /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
            /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
        ]

 
```

### Core Architecture Module: `dashboard/lib/utils.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/lib/utils.ts
 *  usage : supports the LongMemory dashboard utils
 */


import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `src/cli/output/empty_state.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/cli/output/empty_state.ts
 *  usage : implements the LongMemory empty state component
 */


import type { cli_colors } from '../theme/colors.js';
import { panel } from './panel.js';

const states = {
    project: ['No project initialized', 'Run longmemory project init'],
    memories: ['No memories found', 'Run longmemory ingest "something worth remembering"'],
    connectors: ['No connectors configured', 'Run longmemory connectors list'],
    conflicts: ['No unresolved conflicts', 'Project memory is consistent.'],
    tasks: ['No open tasks', 'Record work with longmemory agent after-run'],
    decisions: ['No decisions recorded', 'Use project memory to preserve architectural choices.'],
} as const;
export type empty_state_kind = keyof typeof states;

export const empty_state = (kind: empty_state_kind, colors: cli_colors, width: number) => panel(states[kind][1], colors, { title: states[kind][0], kind: 'muted', width });
```

### Core Architecture Module: `src/cli/output/utility_window.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/cli/output/utility_window.ts
 *  usage : implements the LongMemory utility window component
 */


import type { cli_colors } from '../theme/colors.js';
import { pad, repeat, truncate, visible_length, wrap_text } from '../theme/layout.js';
import { traffic_dots } from './panel.js';

export type utility_window_options = {
    title?: string;
    phase?: number;
    phases?: string[];
    width?: number;
    rows?: Array<[string, unknown]>;
    list?: string;
    footer?: string;
};

export function utility_window(content: string | string[], colors: cli_colors, options: utility_window_options = {}): string {
    const width = Math.max(36, options.width ?? 80);
    const inner = width - 4;
    const title = truncate(options.title ?? 'LongMemory Transfer', inner - 10);
    const titlebar = `${traffic_dots(colors)}  ${colors.title(title)}`;
    const phases = options.phases ?? ['Library', 'Review', 'Transfer'];
    const active = Math.max(0, Math.min(options.phase ?? 0, phases.length - 1));
    const phasebar = phases.map((label, index) => {
        const marker = index < active ? colors.success('✓') : index === active ? colors.info('●') : colors.dim('○');
        const text = index === active ? colors.title(label) : colors.muted(label);
        return `${marker} ${text}`;
    }).join(colors.dim('  ›  '));
    const mark = [
        `${colors.brand('╭┬╮')}  ${colors.title('LongMemory')}`,
        `${colors.brand('├┼┤')}  ${colors.subtitle('Conversation Transfer')}`,
        `${colors.brand('╰┴╯')}  ${colors.muted('Local-first memory for agents')}`,
    ];
    const lines = Array.isArray(content) ? content : wrap_text(content, inner);
    const rows = options.rows ?? [];
    const key_width = rows.length ? Math.min(14, Math.max(...rows.map(([key]) => key.length))) : 0;
    const body = [
        ...mark,
        '',
        phasebar,
        '',
        ...lines,
        ...rows.map(([key, value]) => `${colors.muted(pad(key, key_width))}  ${truncate(String(value ?? '—'), inner - key_width - 2)}`),
    ];
    if (options.list) body.push('', colors.border(repeat('─', inner)), ...options.list.split('\n'));
    if (options.footer) body.push('', colors.dim(truncate(options.footer, inner)));
    const top = `${colors.border('╭')}${colors.border(repeat('─', width - 2))}${colors.border('╮')}`;
    const rule = `${colors.border('├')}${colors.border(repeat('─', width - 2))}${colors.border('┤')}`;
    const line = (value: string) => `${colors.border('│')} ${pad(truncate(value, inner), inner)} ${colors.border('│')}`;
    return [top, line(titlebar), rule, ...body.map(line), `${colors.border('╰')}${colors.border(repeat('─', width - 2))}${colors.border('╯')}`].join('\n');
}
```

### Core Architecture Module: `src/core/connectors/connector.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/connector.ts
 *  usage : implements the LongMemory connector component
 */


import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan, connector_fetch_result } from './source_event.js';
import type { SourceRef } from './source_document.js';
import type { SyncCursor } from './sync_cursor.js';

export type connector_config = Record<string, unknown>;
export type connector_list_params = { limit?: number; cursor?: string | null; since?: number; kinds?: SourceRef['kind'][]; signal?: AbortSignal };
export type connector_sync_params = Omit<connector_list_params, 'cursor'> & { mode: 'full' | 'incremental'; cursor: SyncCursor | null };

export interface Connector {
    readonly id: string;
    readonly name: string;
    readonly source_type: string;
    connect(config: connector_config): Promise<void>;
    testConnection(): Promise<boolean>;
    listSources(params?: connector_list_params): Promise<SourceRef[]>;
    fetchSource(ref: SourceRef): Promise<connector_fetch_result>;
    sync(params: connector_sync_params): AsyncIterable<ConnectorSyncItem>;
    getCursor(): Promise<SyncCursor | null>;
    setCursor(cursor: SyncCursor): Promise<void>;
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan>;
}

export type connector_factory = (config?: connector_config) => Connector;
```

### Core Architecture Module: `src/core/connectors/connector_ingest.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/connector_ingest.ts
 *  usage : implements the LongMemory connector ingest component
 */


import type { long_memory } from '../create_memory.js';
import type { Connector } from './connector.js';
import { public_permission, type connector_permission } from './permission.js';
import { empty_cursor, type SyncCursor } from './sync_cursor.js';
import type { ConnectorSyncItem, HydrographImportPlan } from './source_event.js';

export type connector_sync_options = {
    mode?: 'full' | 'incremental';
    dry_run?: boolean;
    retry_failed?: number;
    default_permission?: connector_permission;
    signal?: AbortSignal;
    now?: () => number;
    transform_plan?: (plan: HydrographImportPlan, item: ConnectorSyncItem) => HydrographImportPlan | Promise<HydrographImportPlan>;
};

export type connector_sync_report = {
    connector_id: string;
    mode: 'full' | 'incremental';
    dry_run: boolean;
    discovered: number;
    created: number;
    updated: number;
    deleted: number;
    unchanged: number;
    permission_changed: number;
    moved: number;
    renamed: number;
    applied_plans: number;
    node_ids: string[];
    edge_ids: string[];
    world_ids: string[];
    plans: HydrographImportPlan[];
    failures: Array<{ item_id: string; attempts: number; message: string }>;
    cursor: SyncCursor;
    started_at: number;
    completed_at: number;
};

export async function sync_connector(connector: Connector, memory: long_memory, options: connector_sync_options = {}): Promise<connector_sync_report> {
    const now = options.now ?? Date.now;
    const started_at = now();
    const mode = options.mode ?? 'incremental';
    const cursor = mode === 'full' ? empty_cursor(connector.id, started_at) : await connector.getCursor() ?? empty_cursor(connector.id, started_at);
    const report: connector_sync_report = {
        connector_id: connector.id, mode, dry_run: options.dry_run ?? false, discovered: 0,
        created: 0, updated: 0, deleted: 0, unchanged: 0, permission_changed: 0, moved: 0, renamed: 0,
        applied_plans: 0, node_ids: [], edge_ids: [], world_ids: [], plans: [], failures: [], cursor,
        started_at, completed_at: started_at,
    };
    const retries = Math.max(0, options.retry_failed ?? 2);
    for await (const item of connector.sync({ mode, cursor, signal: options.signal })) {
        options.signal?.throwIfAborted();
        report.discovered++;
        report[item.event]++;
        if (item.event === 'unchanged') continue;
        const previous = cursor.items[item.external_id] ?? null;
        let last: unknown;
        let plan: HydrographImportPlan | null = null;
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                if (!plan) {
                    const mapped = await connector.mapToHydrograph(item, {
                        connector_id: connector.id,
                        source_type: connector.source_type,
                        now: now(),
                        previous: previous ? { checksum: previous.checksum, node_ids: previous.node_ids, version: previous.version } : null,
                        default_permission: options.default_permission ?? public_permission(),
                    });
                    plan = options.transform_plan ? await options.transform_plan(mapped, item) : mapped;
                    report.plans.push(plan);
                }
                if (!report.dry_run) {
                    const applied = await memory.applyImportPlan(plan);
                    report.applied_plans++;
                    report.node_ids.push(...applied.node_ids);
                    report.edge_ids.push(...applied.edge_ids);
                    report.world_ids.push(...applied.world_ids);
                    cursor.items[item.external_id] = {
                        checksum: plan.checksum,
                        version: item.document?.version ?? item.ref.version ?? plan.checksum,
                        node_ids: applied.node_ids,
                        synced_at: now(),
                        deleted: item.event === 'deleted',
                    };
                    cursor.position = item.id;
                    cursor.updated_at = now();
                    await connector.setCursor(cursor);
                }
                last = null;
                break;
            } catch (error) {
                last = error;
            }
        }
        if (last) report.failures.push({ item_id: item.id, attempts: retries + 1, message: last instanceof Error ? last.message : String(last) });
    }
    report.completed_at = now();
    return report;
}
```

### Core Architecture Module: `src/core/connectors/connector_registry.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/connector_registry.ts
 *  usage : implements the LongMemory connector registry component
 */


import type { Connector, connector_config, connector_factory } from './connector.js';

export class ConnectorRegistry {
    private readonly factories = new Map<string, connector_factory>();

    register(id: string, factory: connector_factory): this {
        if (this.factories.has(id)) throw new Error(`connector already registered: ${id}`);
        this.factories.set(id, factory);
        return this;
    }

    has(id: string): boolean {
        return this.factories.has(id);
    }

    list(): string[] {
        return [...this.factories.keys()].sort();
    }

    load(id: string, config: connector_config = {}): Connector {
        const factory = this.factories.get(id);
        if (!factory) throw new Error(`unknown connector: ${id}`);
        return factory(config);
    }
}
```

### Core Architecture Module: `src/core/connectors/index.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/index.ts
 *  usage : implements the LongMemory index component
 */


export * from './connector.js';
export * from './connector_registry.js';
export * from './sync_cursor.js';
export * from './source_document.js';
export * from './source_event.js';
export * from './permission.js';
export * from './rate_limit.js';
export * from './connector_ingest.js';
export * from './provenance_mapper.js';
```

### Core Architecture Module: `src/core/connectors/permission.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/permission.ts
 *  usage : implements the LongMemory permission component
 */


import type { Contract, SourcePermission } from '../types/contract.js';

export type connector_permission = SourcePermission & {
    inherited: boolean;
    raw: Record<string, unknown>;
};

export const public_permission = (): connector_permission => ({
    scope: 'public', user_ids: [], team_ids: [], project_ids: [], source_id: null, inherited: false, raw: {},
});

export function permission_contract(permission: connector_permission): Partial<Contract> {
    return {
        privacy_level: permission.scope === 'public' ? 'public' : 'private',
        source_permission: {
            scope: permission.scope,
            user_ids: [...permission.user_ids],
            team_ids: [...permission.team_ids],
            project_ids: [...permission.project_ids],
            source_id: permission.source_id,
        },
    };
}
```

### Core Architecture Module: `src/core/connectors/provenance_mapper.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/provenance_mapper.ts
 *  usage : implements the LongMemory provenance mapper component
 */


import type { Provenance } from '../types/provenance.js';
import type { SourceDocument } from './source_document.js';

export function map_connector_provenance(connector_id: string, document: SourceDocument): Provenance {
    return {
        created_by: `connector:${connector_id}`,
        extraction_method: 'import',
        source_trace: [{ source_id: `${document.source_type}:${document.external_id}`, ref: document.url, at: document.fetched_at }],
    };
}

export function citation_metadata(document: SourceDocument, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        source_type: document.source_type,
        external_id: document.external_id,
        url: document.url,
        author: document.author,
        version: document.version,
        checksum: document.checksum,
        fetched_at: document.fetched_at,
        ...extra,
    };
}
```

### Core Architecture Module: `src/core/connectors/rate_limit.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/rate_limit.ts
 *  usage : implements the LongMemory rate limit component
 */


export class connector_rate_limiter {
    private tokens: number;
    private updated_at = Date.now();

    constructor(readonly requests_per_second = 5, readonly burst = requests_per_second) {
        this.tokens = burst;
    }

    async acquire(signal?: AbortSignal): Promise<void> {
        signal?.throwIfAborted();
        const now = Date.now();
        this.tokens = Math.min(this.burst, this.tokens + (now - this.updated_at) / 1_000 * this.requests_per_second);
        this.updated_at = now;
        if (this.tokens >= 1) {
            this.tokens--;
            return;
        }
        const delay = Math.ceil((1 - this.tokens) / this.requests_per_second * 1_000);
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(signal.reason);
            }, { once: true });
        });
        this.tokens = 0;
        this.updated_at = Date.now();
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #147** (2026-04-04): **[BUG] Chinese text is incorrectly deduplicated in openmemory_store due to ASCII-only tokenization**
  *Symptoms*: ### What happened?  Chinese text is incorrectly deduplicated in openmemory_store due to ASCII-only tokenization  ### Steps to Reproduce  ## Bug description  `openmemory_store` incorrectly deduplicates different Chinese memories into the same record.  For example, these two different inputs may resolve to the same memory id:  - `我喜欢健身` - `我喜欢普洱茶`  This causes unrelated Chinese memories to be treated as duplicates.  ## Environment  - OpenMemory: latest (observed on 2026-03-03) - MCP tool: `openmemory_store` - Language: Chinese (zh-CN)  ## Steps to reproduce  1. Store memory A:    - content: `我喜欢健身` 2. Store memory B:    - content: `我喜欢普洱茶` 3. Check returned IDs / list memories.  ## Actual behavior  Different Chinese texts are often deduplicated to the same memory id (or old memory is reused), so no independent record is created.  ## Expected behavior  Semantically different Chinese memories should not be collapsed into one by default.  ## Suspected root cause  The tokenizer used by simhash appears ASCII-only:  - JS: `packages/openmemory-js/src/utils/text.ts`   - `tok_pat = /[a-z0-9]+/gi` - Similar logic exists in Python implementation as well.  For Chinese text, token set can become empty, producing near-constant simhash and causing false deduplication.  ## Suggested fix  1. Guardrail: if token set is empty, skip simhash dedup for that input. 2. Improve tokenizer to support Unicode letters/numbers (`\p{L}\p{N}` with `u` flag). 3. Add CJK-specific n-gram tokenization (e.g., bi-g

- **Issue #142** (2026-04-10): **[BUG] render deploy doesn't work**
  *Symptoms*: ### What happened?  tried to deploy to render and the build failed  ### Steps to Reproduce  - click the deploy to render link in the readme - continue in the render dashboard, deploy - deploy/build error  ### Component  Other  ### Environment  render  ### Relevant log output  ```shell 2026-02-24T08:23:49.602591478Z ==> It looks like we don't have access to your repo, but we'll try to clone it anyway. 2026-02-24T08:23:49.602611859Z ==> Cloning from https://github.com/CaviraOSS/OpenMemory 2026-02-24T08:23:51.109539755Z ==> Checking out commit afc7db127ecca7c214a23729d625f0a6966a07e3 in branch main 2026-02-24T08:23:52.635669903Z ==> Using Node.js version 22.22.0 (default) 2026-02-24T08:23:52.662486934Z ==> Docs on specifying a Node.js version: https://render.com/docs/node-version 2026-02-24T08:23:57.027758092Z ==> Running build command 'npm install && npm run build'... 2026-02-24T08:24:06.733856607Z  2026-02-24T08:24:06.733887438Z added 441 packages, and audited 442 packages in 9s 2026-02-24T08:24:06.733894618Z  2026-02-24T08:24:06.733909059Z 57 packages are looking for funding 2026-02-24T08:24:06.733913759Z   run `npm fund` for details 2026-02-24T08:24:06.794674807Z  2026-02-24T08:24:06.794696647Z 30 vulnerabilities (3 moderate, 26 high, 1 critical) 2026-02-24T08:24:06.794702318Z  2026-02-24T08:24:06.794708118Z To address issues that do not require attention, run: 2026-02-24T08:24:06.794713838Z   npm audit fix 2026-02-24T08:24:06.794719168Z  2026-02-24T08:24:06.794724688Z To ad
  **Post-Mortem & Fix Analysis**:
  > also the railway link in the readme is invalid
  > Hey Mirsella, We have moved to an independent JS/PY package, so the deployment links are obsolete. They will be removed in the upcoming update.

- **Issue #140** (2026-02-22): **[BUG] Docker Compose fails && No Backend Folder**
  *Symptoms*: ### What happened?  oot@tmi-radio:/opt/openmemory# ls app.json  ARCHITECTURE.md  CODE_OF_CONDUCT.md  dashboard           docs      GOVERNANCE.md  Makefile      models.yml  railway.json  render.yaml  tools        Why.md apps      CHANGELOG.md     CONTRIBUTING.md     docker-compose.yml  examples  LICENSE        MIGRATION.md  packages    README.md     SECURITY.md  vercel.json root@tmi-radio:/opt/openmemory# docker compose --profile ui up --build -d [+] Building 1.3s (16/33)  => [internal] load local bake definitions                                                                                                                                          0.0s  => => reading from stdin 983B                                                                                                                                                      0.0s  => [openmemory internal] load build definition from Dockerfile                                                                                                                     0.0s  => => transferring dockerfile: 1.53kB                                                                                                                                              0.0s  => [dashboard internal] load build definition from Dockerfile                                                                                                                      0.0s  => => transferring dockerfile: 915B                                                               

- **Issue #136** (2026-02-16): **[BUG] Official Docs Deployment Down**
  *Symptoms*: ### What happened?  The official docs is down how are we supposed to integrate it   ### Steps to Reproduce  1. Open officail Docs  ### Component  Frontend (React/UI)  ### Environment  _No response_  ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > A new and better documentation site is in the works!
  > Docs back up

- **Issue #135** (2026-02-24): **[BUG] sqlite datafile is not stored on docker volume**
  *Symptoms*: ### What happened?  When spinning up the latest release docker container with .env settings ``` # -------------------------------------------- # Metadata Store # -------------------------------------------- # sqlite (default) | postgres OM_METADATA_BACKEND=sqlite OM_DB_PATH=./data/openmemory.sqlite ```  the data file is not stored on the docker volume. When you restart your container all your stored memories are lost.  The root cause is the ./data part -> must be /data to match the provided path in docker compose      ### Steps to Reproduce  1. start up container 2. store memory 3. restart container 4. fetch memory => emoty  ### Component  Frontend (React/UI)  ### Environment  - Ubuntu   ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting the bug, we are working on it!

- **Issue #134** (2026-04-10): **[BUG] docker compose up not working**
  *Symptoms*: ### What happened?  Running  `sudo docker compose up --build -d`  failed with error  => ERROR [dashboard production 4/8] RUN npm install --omit=dev    ### Steps to Reproduce  Run  ` git clone https://github.com/CaviraOSS/OpenMemory.git cd OpenMemory/ sudo docker compose up --build -d `  ### Component  Frontend (React/UI)  ### Environment  Linux (ubuntu 24.04) Docker version 29.2.0, build 0b9d198   ### Relevant log output  ```shell [+] Building 1.5s (17/33)  => [internal] load local bake definitions                                                                                                                                                                                              0.0s  => => reading from stdin 1.06kB                                                                                                                                                                                                        0.0s  => [openmemory internal] load build definition from Dockerfile                                                                                                                                                                         0.0s  => => transferring dockerfile: 2.19kB                                                                                                                                                                                                  0.0s  => [dashboard internal] load build definition from Dockerfile                             
  **Post-Mortem & Fix Analysis**:
  > Downloaded the latest release files -> docker compose does startup the container
  > Hye, please us the latest release
  > The package.json is missing. Just ran into this issue today for the Dashboard. 

- **Issue #129** (2026-01-25): **[BUG] openmemory-py wheel built from git contains syntax errors (truncated strings) — import fails**
  *Symptoms*: ### What happened?  When building openmemory-py from the current git repository, the wheel (openmemory_py-1.3.1-py2.py3-none-any.whl) is produced successfully, but the resulting wheel contains syntactically invalid Python.  Multiple modules inside the wheel have truncated string literals or mismatched braces. As a result:  python -m compileall fails on the extracted wheel  import openmemory fails at runtime  Expected behavior: The wheel produced from git should contain syntactically valid Python, and import openmemory should succeed.  ### Steps to Reproduce  Clone the OpenMemory repository from git.  Build the Python wheel using:  python -m build --wheel --no-isolation   Extract the generated wheel:  python -m zipfile -e openmemory_py-1.3.1-py2.py3-none-any.whl /tmp/omwheel   Compile the extracted package:  python -m compileall -q /tmp/omwheel/openmemory   Observe syntax errors in multiple files.  ### Component  Backend (API/Server)  ### Environment  Component  Python SDK (openmemory-py)  Wheel build / packaging pipeline  Environment  OS: Arch Linux / CachyOS  Python: 3.14.2  Build method: python -m build --wheel --no-isolation  Installation context: AUR-style python-openmemory-git packaging  ### Relevant log output  ```shell Relevant log output *** Error compiling '/tmp/omwheel/openmemory/ai/mcp.py'... SyntaxError: closing parenthesis '}' does not match opening parenthesis '(' on line 56  *** Error compiling '/tmp/omwheel/openmemory/connectors/google_slides.py'... SyntaxErro
  **Post-Mortem & Fix Analysis**:
  > Doing a bit of bisecting, this error was introduced by:  ae737a3e4aad103ec4550ca6266ce424f8e17590
  > While it is better, there still seems to be an issue: ``` * Building wheel... Successfully built openmemory_py-1.3.1-py2.py3-none-any.whl ==> Entering fakeroot environment... ==> Starting package()... *** Error compiling '/home/evert/Aur/python-openmemory-git/pkg/python-openmemory-git/usr/lib/python3.14/site-packages/openmemory/connectors/google_slides.py'...   File "/usr/lib/python3.14/site-packages/openmemory/connectors/google_slides.py", line 77     "id": f"{presentation_id},           ^ SyntaxError: unterminated f-string literal (detected at line 77) ```
  > Perfectly fixed and working for me now. 

- **Issue #125** (2026-02-15): **[BUG] examples/python/integrations/langchain_agent.py does not work**
  *Symptoms*: ### What happened?  The example at `examples/python/integrations/langchain_agent.py` does not work.    Forgive me if I am missing something obvious, but there seem to be a number of problems with this code.  - The `OpenMemoryChatMessageHistory` constructor requires a `Memory` object.  (I am now creating and passing it an `openmemory.client.Memory` object) - The `OpenMemoryChatMessageHistory` constructor requires a `user_id` parameter. (I am now passing a new user_id variable)  Getting past those issues gets me to the `await chain_with_history.ainvoke` call which fails with `TypeError: object list can't be used in 'await' expression`.  If I remove the await, and call `invoke` instead of `ainvoke`, there are no errors, but the second call to `chain_with_history.invoke` returns a response from the LLM saying it has no idea who I am (so the memory clearly did not work).  What am I missing?  If I am not missing anything, then something is broken.  ### Steps to Reproduce  Run `examples/python/integrations/langchain_agent.py`.  ### Component  Other  ### Environment  WIndows 11 Python 3.12 langchain 1.2.3 langgraph 1.0.6 openmemory-py 1.3.1  ### Relevant log output  ```shell Starting chat session: user_langchain_01  User: Hi, I'm Bob and I like Python. Traceback (most recent call last):   File "C:\Users\user\AppData\Local\Programs\Python\Python312\Lib\runpy.py", line 198, in _run_module_as_main     return _run_code(code, main_globals, None,            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/CaviraOSS/OpenMemory/commit/30daf7804d54ca57d15e3d5b4880165af1e99386

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

### Incident Patch 1: `9ee2c8e1` (2026-09-20)
**Commit Message**: feat(recall): enhance associative recall and context building for improved query handling

**File**: `benchmarks/src/check.ts` (modified, +24/-0)
```diff
@@ -198,6 +198,13 @@ try {
     const dated = associative_recall({ text: 'What did Mira attend in March 2024?', now: Date.UTC(2024, 7, 1), k: 5, vector: [1, 0] }, { index: ranking_engine.index });
     assert.deepEqual(dated.context.items.map((node) => node.id), dated.items.map((item) => item.node.id));
     assert.ok(dated.items.some((item) => (item.breakdown.calendar_adjustment ?? 0) > 0));
+    const qa_memory = create_memory({ store: 'memory', embedding_dimension: 2 });
+    const qa_scope = { user_id: 'evan', conversation_id: 'chat', world: 'qa-bundle', vector: [1, 0] as number[] };
+    await qa_memory.ingest({ ...qa_scope, speaker: 'Evan', text: 'Hey Sam, what helps you relieve stress these days?', at: 1, observed_at: 1 });
+    const sam_reply = await qa_memory.ingest({ ...qa_scope, speaker: 'Sam', text: 'Honestly, yoga and long walks with unhealthy snacks after.', at: 2, observed_at: 2 });
+    const qa_result = await qa_memory.recall({ text: 'What helps Sam relieve stress?', mode: 'associative', world_id: sam_reply.node.world.world_id, k: 5, token_budget: Number.POSITIVE_INFINITY });
+    assert.ok('context' in qa_result && qa_result.context.text.includes('unhealthy snacks'));
+    await qa_memory.close();
     const nvidia = load_embedding_environment({ LONGMEMORY_EMBEDDING_PROVIDER: 'nvidia', NVIDIA_API_KEY: 'mock-nvidia-key', LONGMEMORY_EMBEDDING_MAX_RETRIES: '0' })!;
     assert.equal(nvidia.dimension, 2048);
     assert.equal(nvidia.nvidia_model, 'nvidia/nemotron-3-embed-1b');
@@ -370,6 +377,17 @@ try {
     const after_explicit = history.ingest({ user_id: 'temporal', text: 'I prefer milk.', vector: [1, 0], at: 700 });
     assert.equal(after_explicit.edges.find((edge) => edge.type === 'supersedes')?.to, explicit.node.id);
 
+    // a turn's later clauses must reconcile too, not just its first extracted claim.
+    const multi_clause = new ingest_engine();
+    const clause_first = multi_clause.ingest({ user_id: 'loc', text: 'Mira is in Oslo.', vector: [1, 0], at: 1 });
+    const clause_second = multi_clause.ingest({ user_id: 'loc', text: 'The weather is nice. Mira is in Rome.', vector: [1, 0], at: 2, conflict_behavior: 'supersede' });
+    assert.equal(clause_second.edges.find((edge) => edge.type === 'supersedes')?.to, clause_first.node.id);
+    const clause_third = multi_clause.ingest({ user_id: 'loc', text: 'Mira is in Berlin.', vector: [1, 0], at: 3, conflict_behavior: 'supersede' });
+    assert.equal(clause_third.edges.find((edge) => edge.type === 'supersedes')?.to, clause_second.node.id);
+    assert.equal(multi_clause.graph.get_node(clause_first.node.id)?.state.status, 'superseded');
+    assert.equal(multi_clause.graph.get_node(clause_second.node.id)?.state.status, 'superseded');
+    assert.equal(multi_clause.graph.get_node(clause_third.node.id)?.state.status, 'active');
+
     let render_passes = 0;
     const tracked = { ...later.node, content: { ...later.node.content, get claims() { render_passes++; return later.node.content.claims; } } };
     const rendered = build_context_packet([{ node: tracked }], 1000);
@@ -384,6 +402,12 @@ try {
     assert.deepEqual(isolated.evidence[0].sources?.map((source) => source.id), [recorded.node.id, later.node.id]);
     assert.ok(!isolated.text.includes('Other session'));
     assert.ok(!isolated.text.includes('Future source'));
+    // a future node is only admitted when the caller explicitly vouches for it as a verified reply.
+    const allowed_forward = build_context_packet([{ node: later.node }], 1000, {
+        bundles: new Map([[later.node.id, [future_source]]]),
+        forward_bundle_ids: new Set([future_source.id]),
+    });
+    assert.ok(allowed_forward.text.includes('Future source'));
     const historical_owner = { ...recorded.node, metadata: { ...recorded.node.metadata, user_id: undefined }, provenance: { ...recorded.node.provenance, created_by: 'different-owner' } };
     assert.equal(build_context_packet([{ node: later.node }], 1000, { bundles: new Map([[later.node.id, [historical_owner]]]) }).bundled_items, 0);
 
```

**File**: `src/core/engine/ingest_engine.ts` (modified, +38/-23)
```diff
@@ -95,8 +95,14 @@ function relation_edge(type: string, from: string, to: string, at: number): Hydr
     });
 }
 
-function latest_claim(node: HydroNode): ExtractedClaim | undefined {
-    return node.content.claims?.[0] ?? extract_claims(node.content.raw)[0];
+function node_claims(node: HydroNode): readonly ExtractedClaim[] {
+    return node.content.claims ?? extract_claims(node.content.raw);
+}
+
+// unlike claims[0], resolves the specific claim a topic key was registered from,
+// so a turn with several clauses reconciles each one against its own history.
+function claim_by_topic(node: HydroNode, topic: string): ExtractedClaim | undefined {
+    return node_claims(node).find((claim) => claim.topic === topic);
 }
 
 function relationship_key(world_id: string, user_id: unknown, value: string): string {
@@ -401,19 +407,25 @@ export class IngestEngine {
     ): HydroEdge[] {
         this.ensure_relationship_indexes();
         const edges: HydroEdge[] = [];
-        const incoming = parsed.claims[0];
         const behavior = parsed.event.conflict_behavior ?? 'auto';
-        if (incoming && behavior !== 'none') {
-            const related_id = this.current_claim_nodes.get(relationship_key(draft.world.world_id, parsed.event.user_id, incoming.topic));
-            const related_node = related_id ? this.graph.get_node(related_id) : undefined;
-            const related_claim = related_node ? latest_claim(related_node) : undefined;
-            if (related_node && related_claim && related_node.state.status === 'active' && related_node.temporal.superseded_at === null
-                && (behavior !== 'auto' || parsed.valid_from >= related_node.temporal.valid_from)
-                && claims_conflict(incoming, related_claim)) {
-                const type = behavior === 'supersede' ? 'supersedes'
-                    : behavior === 'contradict' ? 'contradicts'
-                        : incoming.kind === 'preference' || parsed.zone === 'exocortex' ? 'supersedes' : 'contradicts';
-                edges.push(relation_edge(type, draft.id, related_node.id, parsed.at));
+        if (behavior !== 'none') {
+            // check every claim extracted from the turn, not just the first one, so a
+            // clause after the opening sentence still reconciles against prior history.
+            const conflicted_targets = new Set<string>();
+            for (const incoming of parsed.claims) {
+                const related_id = this.current_claim_nodes.get(relationship_key(draft.world.world_id, parsed.event.user_id, incoming.topic));
+                if (!related_id || conflicted_targets.has(related_id)) continue;
+                const related_node = this.graph.get_node(related_id);
+                const related_claim = related_node ? claim_by_topic(related_node, incoming.topic) : undefined;
+                if (related_node && related_claim && related_node.state.status === 'active' && related_node.temporal.superseded_at === null
+                    && (behavior !== 'auto' || parsed.valid_from >= related_node.temporal.valid_from)
+                    && claims_conflict(incoming, related_claim)) {
+                    const type = behavior === 'supersede' ? 'supersedes'
+                        : behavior === 'contradict' ? 'contradicts'
+                            : incoming.kind === 'preference' || parsed.zone === 'exocortex' ? 'supersedes' : 'contradicts';
+                    edges.push(relation_edge(type, draft.id, related_node.id, parsed.at));
+                    conflicted_targets.add(related_id);
+                }
             }
         }
         if (parsed.zone === 'endocortex' && grounding) {
@@ -430,15 +442,18 @@ export class IngestEngine {
     }
 
     private register_relationship_node(node: HydroNode): void {
-        const claim = latest_claim(node);
-        if (claim && node.state.status === 'active' && node.temporal.superseded_at === null) {
-            const key = relationship_key(node.world.world_id, node.metadata.user_id ?? node.provenance.created_by, claim.topic);
-            const prior_id = this.current_claim_nodes.get(key);
-            const prior = prior_id ? this.graph.get_node(prior_id) : undefined;
-            if (!prior || prior.state.status !== 'active' || prior.temporal.superseded_at !== null
-                || prior.temporal.valid_from < node.temporal.valid_from
-                || (prior.temporal.valid_from === node.temporal.valid_from && prior.temporal.observed_at <= node.temporal.observed_at)) {
-                this.current_claim_nodes.set(key, node.id);
+        // register every claim the node carries as the "current" pointer for its topic,
+        // not just the first one, so later clauses remain reachable for future reconciliation.
+        if (node.state.status === 'active' && node.temporal.superseded_at === null) {
+            for (const claim of node_claims(node)) {
+                const key = relationship_key(node.world.world_id, node.metadata.user_id ?? no
```

**File**: `src/core/recall/associative_recall.ts` (modified, +49/-17)
```diff
@@ -38,6 +38,9 @@ import { matrix_fusion, select_sparse_seeds } from './matrix_fusion.js';
 import { default_rerank_depth, prepare_rerank_query, rerank_features, rerank_score, prepare_evidence_query, evidence_support, evidence_adjustment, order_evidence, query_calendar_window, calendar_relevance } from './rerank.js';
 
 const day_ms = 86_400_000;
+// aggregate/list questions ("besides X, what else", "how many") need a wider candidate
+// window than point queries: the omitted facts rarely share the query's dominant terms.
+const aggregate_rerank_depth = 200;
 const length_prior_saturation = 8;
 // pseudo-relevance feedback drifts the query when the top-10 are wrong; opt in with OM_RM3=1
 const rm3_enabled = process.env.OM_RM3 === '1';
@@ -244,6 +247,7 @@ function polarity_relevance(node: HydroNode, enabled: boolean, query_terms: read
 
 const referential_turn_re = /\b(?:did it|did that|just did it|just did that|that one|this one|the same (?:thing|place|one)|so did i|me too)\b/i;
 const pronoun_turn_re = /^(?:[^:\n]{1,32}:\s+)?(?:it|he|she|they|this|that|those|these)\b/i;
+const question_turn_re = /\?\s*$/;
 const aggregate_query_re = /\b(?:how many|total|list|which (?:items|events|activities|places)|what activities|all (?:the |of )?(?:items|events|activities|places))\b/i;
 
 function conversation_bundles(
@@ -252,27 +256,49 @@ function conversation_bundles(
     edges: readonly HydroEdge[],
     anchor_limit = 8,
     max_depth = 2,
-): Map<string, readonly HydroNode[]> {
+): { bundles: Map<string, readonly HydroNode[]>; forward_ids: Set<string> } {
     const by_id = new Map(nodes.map((node) => [node.id, node]));
     const predecessor = new Map<string, string>();
-    for (const edge of edges) if (edge.type === 'refers_to') predecessor.set(edge.from, edge.to);
+    const successor = new Map<string, string>();
+    for (const edge of edges) if (edge.type === 'refers_to') {
+        predecessor.set(edge.from, edge.to);
+        // a ranked turn that is itself the question, not the reply, needs its answer pulled
+        // forward: the reply is whichever later turn's refers_to edge points back at it.
+        if (!successor.has(edge.to)) successor.set(edge.to, edge.from);
+    }
     const bundles = new Map<string, readonly HydroNode[]>();
+    const forward_ids = new Set<string>();
     for (const anchor of anchors.slice(0, anchor_limit)) {
         const explicit = referential_turn_re.test(anchor.node.content.raw);
-        if (!explicit && !(anchor.node.content.raw.length <= 512 && pronoun_turn_re.test(anchor.node.content.raw))) continue;
+        const is_question = question_turn_re.test(anchor.node.content.raw);
+        if (!explicit && !is_question && !(anchor.node.content.raw.length <= 512 && pronoun_turn_re.test(anchor.node.content.raw))) continue;
         const conversation = conversation_of(anchor.node);
         if (!conversation) continue;
         const neighbours: HydroNode[] = [];
         const visited = new Set([anchor.node.id]);
         let tokens = 0;
+        const same_scope = (candidate: HydroNode) => conversation_of(candidate) === conversation
+            && candidate.world.world_id === anchor.node.world.world_id
+            && candidate.metadata.user_id === anchor.node.metadata.user_id;
+        if (is_question) {
+            let current = anchor.node.id;
+            for (let depth = 0; depth < max_depth; depth++) {
+                const next_id = successor.get(current);
+                const next = next_id ? by_id.get(next_id) : undefined;
+                if (!next || visited.has(next.id) || !same_scope(next) || next.temporal.observed_at < anchor.node.temporal.observed_at) break;
+                visited.add(next.id);
+                tokens += count_tokens(memory_evidence_text(next, { prefer_raw: true }));
+                if (tokens > 256) break;
+                neighbours.push(next);
+                forward_ids.add(next.id);
+                current = next.id;
+            }
+        }
         let current = anchor.node.id;
         for (let depth = 0; depth < max_depth; depth++) {
             const previous_id = predecessor.get(current);
             const previous = previous_id ? by_id.get(previous_id) : undefined;
-            if (!previous || visited.has(previous.id) || conversation_of(previous) !== conversation
-                || previous.world.world_id !== anchor.node.world.world_id
-                || previous.metadata.user_id !== anchor.node.metadata.user_id
-                || previous.temporal.observed_at > anchor.node.temporal.observed_at) break;
+            if (!previous || visited.has(previous.id) || !same_scope(previous) || previous.temporal.observed_at > anchor.node.temporal.observed_at) break;
             visited.add(previous.id);
             tokens += count_tokens(memory_evidence_text(previous, { prefer_raw: true }));
             if (!explicit && tokens > 256) break;
@@ -281,7 +307,7 @@ function conversation_bundles(
         }
         if (neig
```

**File**: `src/core/recall/context_builder.ts` (modified, +4/-1)
```diff
@@ -49,6 +49,9 @@ export type ContextPacket = {
 export type context_packet_options = {
     query_terms?: readonly string[];
     bundles?: ReadonlyMap<string, readonly HydroNode[]>;
+    // bundle members normally must precede their anchor; this allow-lists the specific
+    // node ids a caller has already verified as an immediate, same-exchange reply.
+    forward_bundle_ids?: ReadonlySet<string>;
 };
 
 
@@ -78,7 +81,7 @@ export function build_context_packet(
             .filter((node) => node.id !== candidate.node.id && node.world.world_id === candidate.node.world.world_id
                 && (node.metadata.user_id ?? node.provenance.created_by) === (candidate.node.metadata.user_id ?? candidate.node.provenance.created_by)
                 && node.metadata.conversation_id === candidate.node.metadata.conversation_id
-                && node.temporal.observed_at <= candidate.node.temporal.observed_at)
+                && (node.temporal.observed_at <= candidate.node.temporal.observed_at || options.forward_bundle_ids?.has(node.id)))
             .map((node) => [node.id, node])).values()];
         let item_evidence = render(candidate.node, bundle.length > 0);
         let evidence_items = [...bundle.map((node) => render(node, true)), item_evidence];
```

**File**: `src/core/recall/rerank.ts` (modified, +6/-1)
```diff
@@ -175,12 +175,17 @@ export function prepare_evidence_query(text: string, nodes: readonly HydroNode[]
     const subject_terms = new Set(subject ? evidence_tokens(subject) : []);
     const terms = new Set(evidence_tokens(exclusion ? text.slice(0, exclusion.index) : text)
         .filter((term) => !subject_terms.has(term) && !generic_terms.has(term)));
+    // a named third party's history is scattered across many turns; searching it narrowly
+    // and keeping only the single closest lexical match misses the other facts a real
+    // question about that person needs, so treat it the same as an explicit list/count query.
+    const named_subject_query = subject !== null && subject !== 'user';
     return {
         subject, terms, excluded,
-        aggregate: /\b(?:how many|list|which (?:items|events|activities|places)|what activities)\b/i.test(text),
+        aggregate: named_subject_query || /\b(?:how many|list|which (?:items|events|activities|places)|what activities)\b/i.test(text),
     };
 }
 
+
 export function evidence_support(query: evidence_query, node: HydroNode): evidence_features {
     const document = evidence_document_of(node);
     const assertions = document.assertions;
```

---

### Incident Patch 2: `188a1dec` (2026-09-12)
**Commit Message**: feat(sdk): add longmemory-sdk Python HTTP client and openmemory-py bridge

- zero-dependency sync/async Python client for the self-hosted API
- openmemory-py 2.0 forwards imports to longmemory-sdk
- PyPI publish jobs via trusted publishing in publish-sdks workflow
- changelog, migration, and readme updates for package rename

**File**: `.github/workflows/publish-sdks.yml` (modified, +54/-0)
```diff
@@ -58,6 +58,60 @@ jobs:
               env:
                   NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
+    npm-legacy-bridge:
+        needs: [validate, npm]
+        runs-on: ubuntu-latest
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-node@v4
+              with:
+                  node-version: 22
+                  registry-url: https://registry.npmjs.org
+            - run: npm publish ./packages/openmemory-js --access public --provenance
+              env:
+                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+            - run: npm deprecate "openmemory-js@<2.0.0" "Package renamed to longmemory. Install longmemory instead."
+              env:
+                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+
+    pypi-longmemory-sdk:
+        needs: validate
+        runs-on: ubuntu-latest
+        environment:
+            name: pypi-longmemory-sdk
+            url: https://pypi.org/p/longmemory-sdk
+        permissions:
+            id-token: write
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-python@v5
+              with:
+                  python-version: '3.13'
+            - run: python -m pip install build
+            - run: python -m build packages/longmemory-py
+            - uses: pypa/gh-action-pypi-publish@release/v1
+              with:
+                  packages-dir: packages/longmemory-py/dist
+
+    pypi-legacy-bridge:
+        needs: [validate, pypi-longmemory-sdk]
+        runs-on: ubuntu-latest
+        environment:
+            name: pypi-openmemory-py
+            url: https://pypi.org/p/openmemory-py
+        permissions:
+            id-token: write
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-python@v5
+              with:
+                  python-version: '3.13'
+            - run: python -m pip install build
+            - run: python -m build packages/openmemory-py
+            - uses: pypa/gh-action-pypi-publish@release/v1
+              with:
+                  packages-dir: packages/openmemory-py/dist
+
     n8n:
         needs: validate
         runs-on: ubuntu-latest
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ node_modules/
 dist/
 __pycache__/
 *.py[cod]
+*.egg-info/
+*.egg-info
 .env
 *.log
 tmp
```

**File**: `CHANGELOG.md` (modified, +493/-12)
```diff
@@ -7,22 +7,503 @@
                      /____/                                 /____/
 
  cavira oss (c) 2026  -  nullure (c) 2026
- ==========================================================
+ ----------------------------------------------------------
  file  : CHANGELOG.md
- usage : supports LongMemory changelog
+ usage : records the complete OpenMemory-to-LongMemory project history
 -->
 
 # Changelog
 
-All notable changes are documented here. LongMemory follows Semantic Versioning.
+All notable changes to LongMemory are documented here. The current project
+follows Semantic Versioning. The archived pre-rewrite releases are retained at
+the end of this file for historical context.
 
-## 1.0.0 - 2026-08-31
+## [Unreleased]
 
-- Renamed the product, npm package, CLI, environment namespace, integrations, and editor extension to LongMemory.
-- Shipped the immutable Hydrograph engine with temporal, strict, historical, associative, grounded, and multilingual recall.
-- Added SQLite persistence, deterministic decay and reinforcement, consolidation, compression, reconsolidation, and governed project assets.
-- Added authenticated HTTP and MCP servers, a production dashboard, CLI session porter, AI Wiki generation, and a VS Code extension.
-- Added native n8n, Claude Code, Codex, Gemini CLI, Agent Plugins, Cline, Continue, LibreChat, CrewAI, AutoGen, LangGraph, OpenAI Agents, and PydanticAI integrations.
-- Added official benchmark tooling for LongMemEval, LoCoMo, BEAM, comparative providers, scorecards, and release gates.
-- Added Docker, Compose, Heroku, Railway, Render, DigitalOcean, and Vercel deployment manifests.
-- Licensed the project under Apache License 2.0.
+### Python SDK and package registry migration
+
+- Added `packages/longmemory-py`, a zero-runtime-dependency Python HTTP client
+  for the self-hosted LongMemory service.
+- Added synchronous `LongMemory` and asynchronous `AsyncLongMemory` clients.
+- Added typed convenience methods for health, ingest, recall, explain, worlds,
+  entities, timeline, statistics, runtime information, and arbitrary API calls.
+- Added structured `LongMemoryError` and `LongMemoryConnectionError` failures
+  that preserve API status, error code, and response metadata.
+- Kept the Hydrograph engine in TypeScript. The Python package is intentionally
+  a transport client and does not duplicate persistence, retrieval, temporal,
+  lifecycle, or governance logic.
+- Selected the PyPI distribution name `longmemory-sdk` because the unrelated
+  `longmemory` project name is already registered by another organization. The
+  Python import remains `from longmemory import LongMemory`.
+- Added a deprecated `openmemory-py` compatibility distribution that depends on
+  `longmemory-sdk` and forwards the former Python import namespace.
+- Added a deprecated `openmemory-js` npm bridge that depends on and re-exports
+  `longmemory`, while forwarding the former `opm` command to the new CLI.
+- Added migration documentation for npm and PyPI users moving from the former
+  package names.
+- Expanded package publication automation for npm, PyPI, n8n, VS Code, and
+  compatibility bridge releases.
+
+### Registry status
+
+- Reserved `longmemory` as the primary npm package name.
+- Preserved the existing `openmemory-js` npm channel as a migration bridge for
+  users of the former JavaScript package.
+- Preserved the existing `openmemory-py` PyPI channel as a migration bridge for
+  users of the former Python package.
+- Did not claim the unrelated `longmemory` PyPI project. New Python installs use
+  `longmemory-sdk`.
+
+## [1.0.0] - 2026-08-31
+
+LongMemory 1.0 is a ground-up architecture rewrite rather than an incremental
+rename of the archived OpenMemory implementation. It consolidates the product
+around one immutable TypeScript Hydrograph engine shared by every supported
+surface.
+
+### Product rename and release identity
+
+- Renamed the product from OpenMemory to LongMemory.
+- Renamed the npm package and executable to `longmemory`.
+- Renamed public environment variables to the `LONGMEMORY_*` namespace.
+- Renamed workspace state from `.openmemory/` to `.longmemory/`.
+- Renamed dashboard routes, VS Code command IDs, MCP names, plugin IDs,
+  integration folders, package metadata, assets, and documentation.
+- Moved the canonical repository to
+  `https://github.com/CaviraOSS/LongMemory`.
+- Added an idempotent branding and file-header migration/checking tool.
+- Added canonical CaviraOSS file headers to every comment-capable active file,
+  with explicit exceptions for strict JSON, binary assets, generated metadata,
+  license texts, and host-owned byte-exact files.
+- Licensed the repository and primary packages under Apache License 2.0.
+- Retained MIT only for the separately published n8n community package because
+  n8n's strict validator requires it.
+
+### Architecture: pre-phase HSG to immutable Hydrograph
+
+#### Before the rewrite
+
+The archived pre-phase implementati
```

**File**: `MIGRATION.md` (modified, +13/-1)
```diff
@@ -24,7 +24,19 @@ The package, CLI, environment prefix, extension namespace, routes, and integrati
 - dashboard proxy: `/api/longmemory`
 - repository: `https://github.com/CaviraOSS/LongMemory`
 
-Compatibility aliases for the previous product name are intentionally not shipped.
+Application identifiers do not retain runtime aliases; registry migration is handled by temporary compatibility packages.
+
+Package registry migration uses temporary compatibility bridges:
+
+```bash
+npm uninstall openmemory-js
+npm install longmemory
+
+pip uninstall openmemory-py
+pip install longmemory-sdk
+```
+
+The npm bridge re-exports `longmemory` and forwards the legacy CLI names. The PyPI bridge depends on `longmemory-sdk` and forwards the legacy Python import namespace. The unrelated `longmemory` distribution on PyPI is not part of CaviraOSS.
 
 ## Import legacy memory data
 
```

**File**: `README.md` (modified, +32/-1)
```diff
@@ -17,11 +17,12 @@
 > **Durable, temporal, governed memory for AI agents. Not just RAG. Not just a vector database. Local-first and self-hosted.**
 
 [![npm](https://img.shields.io/npm/v/longmemory.svg)](https://www.npmjs.com/package/longmemory)
+[![PyPI](https://img.shields.io/pypi/v/longmemory-sdk.svg)](https://pypi.org/project/longmemory-sdk/)
 [![VS Code](https://img.shields.io/badge/VS%20Code-LongMemory-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=CaviraOSS.longmemory-vscode)
 [![Container](https://img.shields.io/badge/GHCR-longmemory-2496ED?logo=docker)](https://github.com/CaviraOSS/LongMemory/pkgs/container/longmemory)
 [![License](https://img.shields.io/github/license/CaviraOSS/LongMemory)](LICENSE)
 
-![LongMemory dashboard](.github/longmemory.png)
+![LongMemory dashboard](.github/longmemory.gif)
 
 LongMemory is a cognitive memory engine for LLM applications and autonomous agents.
 
@@ -86,6 +87,27 @@ longmemory init
 longmemory recall "current project priorities" --mode associative
 ```
 
+### Call a self-hosted server from Python
+
+```bash
+pip install longmemory-sdk
+```
+
+```python
+from longmemory import LongMemory
+
+memory = LongMemory(
+    "http://127.0.0.1:7331",
+    api_key="change-me",
+    user_id="alice",
+)
+
+memory.ingest("I prefer TypeScript")
+result = memory.recall("What language do I prefer?", mode="strict")
+```
+
+The Python package is a zero-dependency HTTP client. The Hydrograph engine remains in the self-hosted TypeScript service. See [docs/python-sdk.md](docs/python-sdk.md).
+
 ---
 
 ## 2. Run as a Service
@@ -375,6 +397,15 @@ longmemory port --from codex --to longmemory --all
 
 See [MIGRATION.md](MIGRATION.md) and [docs/migration.md](docs/migration.md).
 
+Legacy package migration:
+
+```bash
+npm uninstall openmemory-js && npm install longmemory
+pip uninstall openmemory-py && pip install longmemory-sdk
+```
+
+`openmemory-js@2` and `openmemory-py@2` are forwarding bridges for existing installations. New applications should use `longmemory` and `longmemory-sdk` directly. PyPI's unrelated `longmemory` name is owned by another project, so the official distribution is `longmemory-sdk` while the import remains `longmemory`.
+
 ---
 
 ## 14. Release and Operations
```

**File**: `header.txt` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+/*
+*      __                      __  ___
+*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
+*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
+*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
+*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
+                     /____/                                 /____/
+ *
+ *  cavira oss (c) 2026  -  nullure (c) 2026
+ *  ----------------------------------------------------------
+ *  file  : {{file}}
+ *  usage : {{usage}}
+ */
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -58,6 +58,7 @@
         "extension:build": "pnpm --dir apps/vscode-extension compile",
         "extension:package": "pnpm --dir apps/vscode-extension package",
         "dashboard:audit": "npm --prefix dashboard audit --audit-level=moderate",
+        "sdk:python:check": "node tools/check-python-sdk.mjs",
         "integration:n8n:lint": "pnpm --dir integrations/n8n-nodes-longmemory lint",
         "integration:n8n:build": "pnpm --dir integrations/n8n-nodes-longmemory build",
         "integration:claude:validate": "claude plugin validate ./integrations/claude-code-longmemory --strict",
@@ -66,7 +67,7 @@
         "branding:apply": "node tools/branding.mjs --apply",
         "branding:check": "node tools/branding.mjs",
         "typecheck": "tsc --noEmit -p tsconfig.json",
-        "release:check": "pnpm branding:check && pnpm release:files && pnpm dashboard:audit && pnpm typecheck && pnpm extension:check && pnpm integration:check && pnpm bench:typecheck && pnpm bench:ci && pnpm build && pnpm extension:build && npm --prefix dashboard run build"
+        "release:check": "pnpm branding:check && pnpm release:files && pnpm sdk:python:check && pnpm dashboard:audit && pnpm typecheck && pnpm extension:check && pnpm integration:check && pnpm bench:typecheck && pnpm bench:ci && pnpm build && pnpm extension:build && npm --prefix dashboard run build"
     },
     "devDependencies": {
         "@types/better-sqlite3": "^7.6.13",
```

**File**: `packages/longmemory-py/LICENSE` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+Apache License
+Version 2.0, January 2004
+http://www.apache.org/licenses/
+
+Copyright 2026 CaviraOSS and nullure
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+       http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+
+The complete Apache License 2.0 terms are available in the LongMemory repository:
+https://github.com/CaviraOSS/LongMemory/blob/main/LICENSE
```

---

### Incident Patch 3: `6ae0c95d` (2026-08-31)
**Commit Message**: Merge remote main history into LongMemory 1.0 release



---

### Incident Patch 4: `f3853fdb` (2026-08-24)
**Commit Message**: Merge pull request #208 from mameikagou/fix/non-empty-long-summary

fix(memory): preserve long single-sentence summaries

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +7/-1)
```diff
@@ -455,7 +455,13 @@ export function extract_essence(
 
     selected.sort((a, b) => a.idx - b.idx);
 
-    return selected.map((s) => s.text).join(" ");
+    const essence = selected.map((s) => s.text).join(" ");
+
+    // A single sentence can be longer than max_len, especially for text that
+    // does not put whitespace after punctuation. In that case no sentence is
+    // selected, but summary mode must never replace the source with an empty
+    // string.
+    return essence || raw.slice(0, max_len);
 }
 export function compute_token_overlap(
     q_toks: Set<string>,
```

**File**: `packages/openmemory-js/tests/extract_essence.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from "vitest";
+import { extract_essence } from "../src/memory/hsg";
+
+describe("extract_essence", () => {
+    it("falls back to a prefix when a single sentence exceeds the limit", () => {
+        const raw =
+            "This sentence has no terminator and is intentionally longer than the configured summary length";
+
+        expect(extract_essence(raw, "semantic", 40)).toBe(raw.slice(0, 40));
+    });
+
+    it("does not return an empty summary for Chinese text without spaces", () => {
+        const raw =
+            "这是一条没有空格的长中文记忆，它包含多个短句。但是分句后仍可能被当成一个整体，因此摘要不能变成空字符串。";
+
+        expect(extract_essence(raw, "semantic", 30)).toBe(raw.slice(0, 30));
+    });
+});
```

---

### Incident Patch 5: `dc1d4a09` (2026-08-24)
**Commit Message**: Merge pull request #209 from mameikagou/fix/honor-embedding-fallback-chain

fix(embeddings): honor an empty fallback chain

**File**: `packages/openmemory-js/src/core/cfg.ts` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export const env = {
         | "auto",
     compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
     emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
-    embedding_fallback: str(process.env.OM_EMBEDDING_FALLBACK, "synthetic")
+    embedding_fallback: (process.env.OM_EMBEDDING_FALLBACK ?? "synthetic")
         .split(",")
         .map((s) => s.trim())
         .filter(Boolean),
```

**File**: `packages/openmemory-js/src/memory/embed.ts` (modified, +10/-15)
```diff
@@ -155,6 +155,7 @@ async function embed_with_provider(
 
 async function get_sem_emb(t: string, s: string): Promise<number[]> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -167,6 +168,7 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -176,20 +178,21 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}.`,
                 );
-                return gen_syn_emb(t, s);
+                throw e;
             }
         }
     }
 
-    return gen_syn_emb(t, s);
+    throw lastError;
 }
 
 async function emb_batch_with_fallback(
     txts: Record<string, string>,
 ): Promise<Record<string, number[]>> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -218,6 +221,7 @@ async function emb_batch_with_fallback(
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -227,23 +231,14 @@ async function emb_batch_with_fallback(
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}.`,
                 );
-
-                const result: Record<string, number[]> = {};
-                for (const [s, t] of Object.entries(txts)) {
-                    result[s] = gen_syn_emb(t, s);
-                }
-                return result;
+                throw e;
             }
         }
     }
 
-    const result: Record<string, number[]> = {};
-    for (const [s, t] of Object.entries(txts)) {
-        result[s] = gen_syn_emb(t, s);
-    }
-    return result;
+    throw lastError;
 }
 
 async function emb_openai(t: string, s: string): Promise<number[]> {
```

**File**: `packages/openmemory-js/tests/embedding_fallback.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+async function loadEmbed(fallback: string) {
+    vi.resetModules();
+    vi.stubEnv("OM_TIER", "deep");
+    vi.stubEnv("OM_EMBEDDINGS", "openai");
+    vi.stubEnv("OM_EMBEDDING_FALLBACK", fallback);
+    vi.stubEnv("OPENAI_API_KEY", "");
+    vi.stubEnv("OM_OPENAI_API_KEY", "");
+    return await import("../src/memory/embed");
+}
+
+describe("embedding fallback chain", () => {
+    afterEach(() => {
+        vi.unstubAllEnvs();
+        vi.resetModules();
+    });
+
+    it("throws after the configured providers fail", async () => {
+        const { embedForSector } = await loadEmbed("");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).rejects.toThrow("OpenAI key missing");
+    });
+
+    it("still uses synthetic vectors when explicitly configured", async () => {
+        const { embedForSector } = await loadEmbed("synthetic");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).resolves.toHaveLength(1536);
+    });
+});
```

---

### Incident Patch 6: `03aeba3c` (2026-08-24)
**Commit Message**: fix(embeddings): honor an empty fallback chain

**File**: `packages/openmemory-js/src/core/cfg.ts` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export const env = {
         | "auto",
     compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
     emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
-    embedding_fallback: str(process.env.OM_EMBEDDING_FALLBACK, "synthetic")
+    embedding_fallback: (process.env.OM_EMBEDDING_FALLBACK ?? "synthetic")
         .split(",")
         .map((s) => s.trim())
         .filter(Boolean),
```

**File**: `packages/openmemory-js/src/memory/embed.ts` (modified, +10/-15)
```diff
@@ -155,6 +155,7 @@ async function embed_with_provider(
 
 async function get_sem_emb(t: string, s: string): Promise<number[]> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -167,6 +168,7 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -176,20 +178,21 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}.`,
                 );
-                return gen_syn_emb(t, s);
+                throw e;
             }
         }
     }
 
-    return gen_syn_emb(t, s);
+    throw lastError;
 }
 
 async function emb_batch_with_fallback(
     txts: Record<string, string>,
 ): Promise<Record<string, number[]>> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -218,6 +221,7 @@ async function emb_batch_with_fallback(
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -227,23 +231,14 @@ async function emb_batch_with_fallback(
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}.`,
                 );
-
-                const result: Record<string, number[]> = {};
-                for (const [s, t] of Object.entries(txts)) {
-                    result[s] = gen_syn_emb(t, s);
-                }
-                return result;
+                throw e;
             }
         }
     }
 
-    const result: Record<string, number[]> = {};
-    for (const [s, t] of Object.entries(txts)) {
-        result[s] = gen_syn_emb(t, s);
-    }
-    return result;
+    throw lastError;
 }
 
 async function emb_openai(t: string, s: string): Promise<number[]> {
```

**File**: `packages/openmemory-js/tests/embedding_fallback.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+async function loadEmbed(fallback: string) {
+    vi.resetModules();
+    vi.stubEnv("OM_TIER", "deep");
+    vi.stubEnv("OM_EMBEDDINGS", "openai");
+    vi.stubEnv("OM_EMBEDDING_FALLBACK", fallback);
+    vi.stubEnv("OPENAI_API_KEY", "");
+    vi.stubEnv("OM_OPENAI_API_KEY", "");
+    return await import("../src/memory/embed");
+}
+
+describe("embedding fallback chain", () => {
+    afterEach(() => {
+        vi.unstubAllEnvs();
+        vi.resetModules();
+    });
+
+    it("throws after the configured providers fail", async () => {
+        const { embedForSector } = await loadEmbed("");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).rejects.toThrow("OpenAI key missing");
+    });
+
+    it("still uses synthetic vectors when explicitly configured", async () => {
+        const { embedForSector } = await loadEmbed("synthetic");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).resolves.toHaveLength(1536);
+    });
+});
```

---

### Incident Patch 7: `9fb37e41` (2026-08-24)
**Commit Message**: fix(memory): preserve long single-sentence summaries

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +7/-1)
```diff
@@ -455,7 +455,13 @@ export function extract_essence(
 
     selected.sort((a, b) => a.idx - b.idx);
 
-    return selected.map((s) => s.text).join(" ");
+    const essence = selected.map((s) => s.text).join(" ");
+
+    // A single sentence can be longer than max_len, especially for text that
+    // does not put whitespace after punctuation. In that case no sentence is
+    // selected, but summary mode must never replace the source with an empty
+    // string.
+    return essence || raw.slice(0, max_len);
 }
 export function compute_token_overlap(
     q_toks: Set<string>,
```

**File**: `packages/openmemory-js/tests/extract_essence.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from "vitest";
+import { extract_essence } from "../src/memory/hsg";
+
+describe("extract_essence", () => {
+    it("falls back to a prefix when a single sentence exceeds the limit", () => {
+        const raw =
+            "This sentence has no terminator and is intentionally longer than the configured summary length";
+
+        expect(extract_essence(raw, "semantic", 40)).toBe(raw.slice(0, 40));
+    });
+
+    it("does not return an empty summary for Chinese text without spaces", () => {
+        const raw =
+            "这是一条没有空格的长中文记忆，它包含多个短句。但是分句后仍可能被当成一个整体，因此摘要不能变成空字符串。";
+
+        expect(extract_essence(raw, "semantic", 30)).toBe(raw.slice(0, 30));
+    });
+});
```

---

### Incident Patch 8: `117a1d89` (2026-08-19)
**Commit Message**: fix(dashboard): keep rewrite API credentials server-side

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

**File**: `dashboard/tests/auth-config.test.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+const test = require('node:test')
+const assert = require('node:assert/strict')
+const fs = require('node:fs')
+const path = require('node:path')
+
+const root = path.resolve(__dirname, '..', '..')
+const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8')
+
+test('dashboard falls back to the server proxy without baking public API config', () => {
+  const context = read('dashboard/lib/project-context.tsx')
+  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
+  const dockerfile = read('dashboard/Dockerfile')
+
+  assert.match(context, /process\.env\.NEXT_PUBLIC_API_URL \|\| '\/api\/openmemory'/)
+  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:7331'/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_URL/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
+})
```

---

### Incident Patch 9: `172aad43` (2026-08-19)
**Commit Message**: fix(dashboard): remove immutable memory controls

**File**: `dashboard/CHAT_SETUP.md` (modified, +6/-10)
```diff
@@ -6,9 +6,8 @@ The chat interface is now connected to the OpenMemory backend and can query memo
 
 ✅ **Memory Querying**: Searches your memory database for relevant content
 ✅ **Salience-based Results**: Shows top memories ranked by relevance
-✅ **Memory Reinforcement**: Click the + button to boost memory importance
+✅ **Read-only Memory References**: Shows the memories used to generate each response
 ✅ **Real-time Updates**: Live connection to backend API
-✅ **Action Buttons**: Quick actions after assistant responses
 
 ## Setup Instructions
 
@@ -99,19 +98,17 @@ curl -X POST http://localhost:8080/memory/ingest \
 4. **Results**: Top 5 memories returned with salience scores
 5. **Response**: Chat generates answer based on retrieved memories
 
-### Memory Reinforcement
+### Memory References
 
-Clicking the **+** button on a memory card:
-
-- Sends POST to `/memory/reinforce`
-- Increases memory salience by 0.1
-- Makes it more likely to appear in future queries
+Memory cards shown beside a chat response are read-only references. Their salience is
+updated by the backend from observed evidence, so the dashboard does not expose
+manual reinforcement controls.
 
 ## Current Features
 
 ✅ Real-time memory querying
 ✅ Salience-based ranking
-✅ Memory reinforcement (boost)
+✅ Read-only memory references
 ✅ Sector classification display
 ✅ Error handling with backend status
 
@@ -149,7 +146,6 @@ Clicking the **+** button on a memory card:
 ```typescript
 POST /memory/query      // Search memories
 POST /memory/add        // Add new memory
-POST /memory/reinforce  // Boost memory salience
 GET  /memory/all        // List all memories
 GET  /memory/:id        // Get specific memory
 ```
```

**File**: `dashboard/app/chat/page.tsx` (modified, +0/-26)
```diff
@@ -118,22 +118,6 @@ export default function ChatPage() {
         }
     }
 
-    const addMemoryToBag = async (memory: MemoryReference) => {
-        try {
-            await fetch(`${API_BASE_URL}/memory/reinforce`, {
-                method: "POST",
-                headers: getHeaders(),
-                body: JSON.stringify({
-                    id: memory.id,
-                    boost: 0.1
-                })
-            })
-            console.log("Memory reinforced:", memory.id)
-        } catch (error) {
-            console.error("Error reinforcing memory:", error)
-        }
-    }
-
     return (
         <div className="flex flex-col min-h-screen w-full" suppressHydrationWarning>
             <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6 mb-16" suppressHydrationWarning>
@@ -253,16 +237,6 @@ export default function ChatPage() {
                                                         {memory.content}
                                                     </p>
                                                 </div>
-                                                <button
-                                                    onClick={() => addMemoryToBag(memory)}
-                                                    className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-xl bg-stone-900/70 border border-zinc-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
-                                                    aria-label="Add to bag"
-                                                    title="Add to bag"
-                                                >
-                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
-                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12H5" />
-                                                    </svg>
-                                                </button>
                                             </div>
                                         </div>
                                     </div>
```

**File**: `dashboard/app/decay/page.tsx` (modified, +4/-26)
```diff
@@ -101,20 +101,6 @@ export default function decay() {
         }
     }
 
-    async function boostmemory(id: string) {
-        try {
-            const res = await fetch(`${API_BASE_URL}/memory/${id}`, {
-                method: 'PATCH',
-                headers: getHeaders(),
-                body: JSON.stringify({ salience: 0.8 })
-            })
-            if (!res.ok) throw new Error('failed to boost memory')
-            fetchdata()
-        } catch (e: any) {
-            alert(`Error: ${e.message}`)
-        }
-    }
-
     useEffect(() => {
         if (!chartref.current || stats.length === 0) return
 
@@ -333,6 +319,9 @@ export default function decay() {
                             </svg>
                             Memories At Risk
                         </legend>
+                        <p className="mb-4 text-sm text-stone-500">
+                            Salience is updated from observed evidence; this view is for monitoring only.
+                        </p>
                         <div className="space-y-3" suppressHydrationWarning>
                             {riskmems.length === 0 ? (
                                 <div className="text-center py-8 text-stone-500" suppressHydrationWarning>
@@ -341,7 +330,7 @@ export default function decay() {
                             ) : (
                                 riskmems.map(mem => (
                                     <div key={mem.id} className="rounded-xl border border-rose-500/15 bg-rose-500/10 p-4 hover:bg-rose-500/15 transition-colors" suppressHydrationWarning>
-                                        <div className="flex items-center justify-between gap-4" suppressHydrationWarning>
+                                        <div className="flex items-center gap-4" suppressHydrationWarning>
                                             <div className="flex-1" suppressHydrationWarning>
                                                 <div className="flex items-center gap-2 mb-2" suppressHydrationWarning>
                                                     <span className="text-xs px-2 py-1 rounded-lg bg-stone-900 text-stone-300 uppercase tracking-wide">
@@ -351,15 +340,6 @@ export default function decay() {
                                                 </div>
                                                 <p className="text-sm text-stone-300">{mem.content}</p>
                                             </div>
-                                            <button
-                                                onClick={() => boostmemory(mem.id)}
-                                                className="rounded-xl p-2 pl-4 bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-white font-medium"
-                                            >
-                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
-                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
-                                                </svg>
-                                                Boost
-                                            </button>
                                         </div>
                                     </div>
                                 ))
@@ -371,5 +351,3 @@ export default function decay() {
         </div>
     )
 }
-
-
```

**File**: `dashboard/tests/mutation-controls.test.js` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+const assert = require("node:assert/strict")
+const fs = require("node:fs")
+const path = require("node:path")
+const test = require("node:test")
+
+const readDashboardFile = (relativePath) =>
+    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8")
+
+test("dashboard pages do not offer immutable memory mutations", () => {
+    const decayPage = readDashboardFile("app/decay/page.tsx")
+    const chatPage = readDashboardFile("app/chat/page.tsx")
+
+    assert.doesNotMatch(decayPage, /memory\/\$\{id\}/)
+    assert.doesNotMatch(decayPage, /method:\s*["']PATCH["']/)
+    assert.doesNotMatch(decayPage, /boostmemory|>\s*Boost\s*</)
+    assert.doesNotMatch(chatPage, /memory\/reinforce|addMemoryToBag|Add to bag/)
+})
+
+test("chat setup documents memory references as read-only", () => {
+    const setup = readDashboardFile("CHAT_SETUP.md")
+
+    assert.match(setup, /Read-only Memory References/)
+    assert.doesNotMatch(setup, /memory\/reinforce|Memory Reinforcement|boost memory importance/i)
+})
```

---

### Incident Patch 10: `ac9c2a58` (2026-08-18)
**Commit Message**: Merge pull request #202 from mikemikimike/fix/dashboard-server-side-api-key

fix(dashboard): keep API keys server-side

**File**: `dashboard/CHAT_SETUP.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps backend API keys server-side. For local development only, you can set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` to make the browser call the backend directly, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps backend API keys server-side. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ### 3. Start the Dashboard
 
```

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/README.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps authenticated backend API keys on the server. For local development only, you can still use browser-direct configuration with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps authenticated backend API keys on the server. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ## Run the dashboard locally
 
```

**File**: `dashboard/app/api/openmemory/[...path]/route.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { NextRequest } from 'next/server'
 export const runtime = 'nodejs'
 export const dynamic = 'force-dynamic'
 
-const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:9432').replace(/\/+$/, '')
+const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
 const API_KEY = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || ''
 
 async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

**File**: `dashboard/tests/auth-config.test.js` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+const test = require('node:test')
+const assert = require('node:assert/strict')
+const fs = require('node:fs')
+
+const read = (path) => fs.readFileSync(path, 'utf8')
+
+test('dashboard proxy defaults to the backend port and compose keeps the API key server-side', () => {
+  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
+  const compose = read('docker-compose.yml')
+  const dockerfile = read('dashboard/Dockerfile')
+
+  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:8080'/)
+  assert.match(compose, /OPENMEMORY_API_URL=\$\{OPENMEMORY_API_URL:-http:\/\/openmemory:8080\}/)
+  assert.match(compose, /OPENMEMORY_API_KEY=\$\{OM_API_KEY:-\}/)
+  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_KEY/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
+})
```

**File**: `docker-compose.yml` (modified, +2/-5)
```diff
@@ -139,14 +139,11 @@ services:
     build:
       context: ./dashboard
       dockerfile: Dockerfile
-      args:
-        - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
-        - NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY:-}
     ports:
       - '3000:3000'
     environment:
-      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
-      - NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY:-}
+      - OPENMEMORY_API_URL=${OPENMEMORY_API_URL:-http://openmemory:8080}
+      - OPENMEMORY_API_KEY=${OM_API_KEY:-}
     depends_on:
       openmemory:
         condition: service_healthy
```

---

### Incident Patch 11: `2a8c9708` (2026-08-18)
**Commit Message**: fix(dashboard): keep API keys server-side

**File**: `dashboard/CHAT_SETUP.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps backend API keys server-side. For local development only, you can set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` to make the browser call the backend directly, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps backend API keys server-side. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ### 3. Start the Dashboard
 
```

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/README.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps authenticated backend API keys on the server. For local development only, you can still use browser-direct configuration with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps authenticated backend API keys on the server. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ## Run the dashboard locally
 
```

**File**: `dashboard/app/api/openmemory/[...path]/route.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { NextRequest } from 'next/server'
 export const runtime = 'nodejs'
 export const dynamic = 'force-dynamic'
 
-const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:9432').replace(/\/+$/, '')
+const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
 const API_KEY = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || ''
 
 async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

**File**: `dashboard/tests/auth-config.test.js` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+const test = require('node:test')
+const assert = require('node:assert/strict')
+const fs = require('node:fs')
+
+const read = (path) => fs.readFileSync(path, 'utf8')
+
+test('dashboard proxy defaults to the backend port and compose keeps the API key server-side', () => {
+  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
+  const compose = read('docker-compose.yml')
+  const dockerfile = read('dashboard/Dockerfile')
+
+  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:8080'/)
+  assert.match(compose, /OPENMEMORY_API_URL=\$\{OPENMEMORY_API_URL:-http:\/\/openmemory:8080\}/)
+  assert.match(compose, /OPENMEMORY_API_KEY=\$\{OM_API_KEY:-\}/)
+  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_KEY/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
+})
```

**File**: `docker-compose.yml` (modified, +2/-5)
```diff
@@ -139,14 +139,11 @@ services:
     build:
       context: ./dashboard
       dockerfile: Dockerfile
-      args:
-        - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
-        - NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY:-}
     ports:
       - '3000:3000'
     environment:
-      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}
-      - NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY:-}
+      - OPENMEMORY_API_URL=${OPENMEMORY_API_URL:-http://openmemory:8080}
+      - OPENMEMORY_API_KEY=${OM_API_KEY:-}
     depends_on:
       openmemory:
         condition: service_healthy
```

---

### Incident Patch 12: `9dc9b443` (2026-08-13)
**Commit Message**: Merge pull request #201 from mameikagou/agent/fix-migration-completion-checks

Fix migration completion checks

**File**: `packages/openmemory-js/src/core/migrate.ts` (modified, +59/-27)
```diff
@@ -21,6 +21,7 @@ const LEGACY_SQLITE_VECTOR_TABLE = "vectors";
 interface Migration {
     version: string;
     desc: string;
+    completionColumn: string;
     sqlite: (vectorTable: string) => string[];
     postgres: string[];
 }
@@ -29,6 +30,7 @@ const migrations: Migration[] = [
     {
         version: "1.2.0",
         desc: "Multi-user tenant support",
+        completionColumn: "user_id",
         sqlite: (vectorTable: string) => [
             `ALTER TABLE memories ADD COLUMN user_id TEXT`,
             `CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`,
@@ -76,6 +78,7 @@ const migrations: Migration[] = [
     {
         version: "1.3.0",
         desc: "Project-level isolation support",
+        completionColumn: "project_id",
         sqlite: (vectorTable: string) => [
             `ALTER TABLE memories ADD COLUMN project_id TEXT`,
             `CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`,
@@ -193,14 +196,14 @@ async function run_sqlite_migration(
 ): Promise<void> {
     log(`Running migration: ${m.version} - ${m.desc}`);
 
-    const has_user_id = await check_column_exists_sqlite(
+    const is_complete = await check_column_exists_sqlite(
         db,
         "memories",
-        "user_id",
+        m.completionColumn,
     );
-    if (has_user_id) {
+    if (is_complete) {
         log(
-            `Migration ${m.version} already applied (user_id exists), skipping`,
+            `Migration ${m.version} already applied (${m.completionColumn} exists), skipping`,
         );
         await set_db_version_sqlite(db, m.version);
         return;
@@ -296,11 +299,15 @@ async function run_pg_migration(pool: Pool, m: Migration): Promise<void> {
         process.env.OM_VECTOR_TABLE || DEFAULT_VECTOR_TABLE,
         "OM_VECTOR_TABLE",
     );
-    const has_user_id = await check_column_exists_pg(pool, mt, "user_id");
+    const is_complete = await check_column_exists_pg(
+        pool,
+        mt,
+        m.completionColumn,
+    );
 
-    if (has_user_id) {
+    if (is_complete) {
         log(
-            `Migration ${m.version} already applied (user_id exists), skipping`,
+            `Migration ${m.version} already applied (${m.completionColumn} exists), skipping`,
         );
         await set_db_version_pg(pool, m.version);
         return;
@@ -392,6 +399,49 @@ async function quarantine_orphan_temporal_facts_pg(pool: Pool): Promise<void> {
     }
 }
 
+export async function run_sqlite_migrations(
+    db: sqlite3.Database,
+): Promise<void> {
+    const current = await get_db_version_sqlite(db);
+    log(`Current database version: ${current || "none"}`);
+
+    for (const m of migrations) {
+        const is_complete = await check_column_exists_sqlite(
+            db,
+            "memories",
+            m.completionColumn,
+        );
+        if (!is_complete || !current || m.version > current) {
+            await run_sqlite_migration(db, m);
+        }
+    }
+
+    await quarantine_orphan_temporal_facts_sqlite(db);
+}
+
+async function run_pg_migrations(pool: Pool): Promise<void> {
+    const current = await get_db_version_pg(pool);
+    log(`Current database version: ${current || "none"}`);
+
+    const mt = assertSafeIdentifier(
+        process.env.OM_PG_TABLE || "openmemory_memories",
+        "OM_PG_TABLE",
+    );
+
+    for (const m of migrations) {
+        const is_complete = await check_column_exists_pg(
+            pool,
+            mt,
+            m.completionColumn,
+        );
+        if (!is_complete || !current || m.version > current) {
+            await run_pg_migration(pool, m);
+        }
+    }
+
+    await quarantine_orphan_temporal_facts_pg(pool);
+}
+
 export async function run_migrations() {
     log("Checking for pending migrations...");
 
@@ -411,32 +461,14 @@ export async function run_migrations() {
             ssl,
         });
 
-        const current = await get_db_version_pg(pool);
-        log(`Current database version: ${current || "none"}`);
-
-        for (const m of migrations) {
-            if (!current || m.version > current) {
-                await run_pg_migration(pool, m);
-            }
-        }
-
-        await quarantine_orphan_temporal_facts_pg(pool);
+        await run_pg_migrations(pool);
 
         await pool.end();
     } else {
         const db_path = process.env.OM_DB_PATH || "./data/openmemory.sqlite";
         const db = new sqlite3.Database(db_path);
 
-        const current = await get_db_version_sqlite(db);
-        log(`Current database version: ${current || "none"}`);
-
-        for (const m of migrations) {
-            if (!current || m.version > current) {
-                await run_sqlite_migration(db, m);
-            }
-        }
-
-        await quarantine_orphan_temporal_facts_sqlite(db);
+        await run_sqlite_migrations(db);
 
         await new Promise<void>((ok) => db.close(() => ok()));
     }
```

**File**: `packages/openmemory-js/tests/migrate.test.ts` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import sqlite3 from "sqlite3";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { run_sqlite_migrations } from "../src/core/migrate";
+
+const exec = (db: sqlite3.Database, sql: string): Promise<void> =>
+    new Promise((resolve, reject) => {
+        db.exec(sql, (err) => (err ? reject(err) : resolve()));
+    });
+
+const all = <T>(db: sqlite3.Database, sql: string): Promise<T[]> =>
+    new Promise((resolve, reject) => {
+        db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
+    });
+
+const columns = async (db: sqlite3.Database, table: string) => {
+    const rows = await all<{ name: string }>(db, `PRAGMA table_info(${table})`);
+    return rows.map((row) => row.name);
+};
+
+const create_corrupted_v130_schema = async (db: sqlite3.Database) => {
+    await exec(
+        db,
+        `
+        CREATE TABLE memories (id TEXT PRIMARY KEY, user_id TEXT, content TEXT);
+        CREATE TABLE vectors (id TEXT, sector TEXT, user_id TEXT);
+        CREATE TABLE waypoints (src_id TEXT, dst_id TEXT, user_id TEXT);
+        CREATE TABLE temporal_facts (id TEXT PRIMARY KEY, user_id TEXT);
+        CREATE TABLE schema_version (version TEXT PRIMARY KEY, applied_at INTEGER);
+
+        INSERT INTO memories VALUES ('memory-1', 'user-1', 'keep me');
+        INSERT INTO vectors VALUES ('memory-1', 'semantic', 'user-1');
+        INSERT INTO waypoints VALUES ('memory-1', 'memory-1', 'user-1');
+        INSERT INTO temporal_facts VALUES ('fact-1', 'user-1');
+        INSERT INTO schema_version VALUES ('1.3.0', 1);
+        `,
+    );
+};
+
+describe("SQLite schema migrations", () => {
+    let db: sqlite3.Database;
+
+    beforeEach(async () => {
+        db = new sqlite3.Database(":memory:");
+        await create_corrupted_v130_schema(db);
+    });
+
+    afterEach(async () => {
+        await new Promise<void>((resolve, reject) => {
+            db.close((err) => (err ? reject(err) : resolve()));
+        });
+    });
+
+    it("repairs a database marked 1.3.0 when project_id columns are missing", async () => {
+        await run_sqlite_migrations(db);
+
+        for (const table of [
+            "memories",
+            "vectors",
+            "waypoints",
+            "temporal_facts",
+        ]) {
+            expect(await columns(db, table)).toContain("project_id");
+        }
+
+        const memories = await all<{ content: string }>(
+            db,
+            "SELECT content FROM memories",
+        );
+        expect(memories).toEqual([{ content: "keep me" }]);
+    });
+
+    it("is idempotent after repairing the missing 1.3.0 columns", async () => {
+        await run_sqlite_migrations(db);
+        await run_sqlite_migrations(db);
+
+        const versions = await all<{ version: string }>(
+            db,
+            "SELECT version FROM schema_version ORDER BY version",
+        );
+        expect(versions).toEqual([{ version: "1.3.0" }]);
+
+        for (const table of [
+            "memories",
+            "vectors",
+            "waypoints",
+            "temporal_facts",
+        ]) {
+            const projectColumns = (await columns(db, table)).filter(
+                (column) => column === "project_id",
+            );
+            expect(projectColumns).toHaveLength(1);
+        }
+    });
+});
```

---

### Incident Patch 13: `2d080270` (2026-08-13)
**Commit Message**: fix migration completion checks

**File**: `packages/openmemory-js/src/core/migrate.ts` (modified, +59/-27)
```diff
@@ -21,6 +21,7 @@ const LEGACY_SQLITE_VECTOR_TABLE = "vectors";
 interface Migration {
     version: string;
     desc: string;
+    completionColumn: string;
     sqlite: (vectorTable: string) => string[];
     postgres: string[];
 }
@@ -29,6 +30,7 @@ const migrations: Migration[] = [
     {
         version: "1.2.0",
         desc: "Multi-user tenant support",
+        completionColumn: "user_id",
         sqlite: (vectorTable: string) => [
             `ALTER TABLE memories ADD COLUMN user_id TEXT`,
             `CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`,
@@ -76,6 +78,7 @@ const migrations: Migration[] = [
     {
         version: "1.3.0",
         desc: "Project-level isolation support",
+        completionColumn: "project_id",
         sqlite: (vectorTable: string) => [
             `ALTER TABLE memories ADD COLUMN project_id TEXT`,
             `CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`,
@@ -193,14 +196,14 @@ async function run_sqlite_migration(
 ): Promise<void> {
     log(`Running migration: ${m.version} - ${m.desc}`);
 
-    const has_user_id = await check_column_exists_sqlite(
+    const is_complete = await check_column_exists_sqlite(
         db,
         "memories",
-        "user_id",
+        m.completionColumn,
     );
-    if (has_user_id) {
+    if (is_complete) {
         log(
-            `Migration ${m.version} already applied (user_id exists), skipping`,
+            `Migration ${m.version} already applied (${m.completionColumn} exists), skipping`,
         );
         await set_db_version_sqlite(db, m.version);
         return;
@@ -296,11 +299,15 @@ async function run_pg_migration(pool: Pool, m: Migration): Promise<void> {
         process.env.OM_VECTOR_TABLE || DEFAULT_VECTOR_TABLE,
         "OM_VECTOR_TABLE",
     );
-    const has_user_id = await check_column_exists_pg(pool, mt, "user_id");
+    const is_complete = await check_column_exists_pg(
+        pool,
+        mt,
+        m.completionColumn,
+    );
 
-    if (has_user_id) {
+    if (is_complete) {
         log(
-            `Migration ${m.version} already applied (user_id exists), skipping`,
+            `Migration ${m.version} already applied (${m.completionColumn} exists), skipping`,
         );
         await set_db_version_pg(pool, m.version);
         return;
@@ -392,6 +399,49 @@ async function quarantine_orphan_temporal_facts_pg(pool: Pool): Promise<void> {
     }
 }
 
+export async function run_sqlite_migrations(
+    db: sqlite3.Database,
+): Promise<void> {
+    const current = await get_db_version_sqlite(db);
+    log(`Current database version: ${current || "none"}`);
+
+    for (const m of migrations) {
+        const is_complete = await check_column_exists_sqlite(
+            db,
+            "memories",
+            m.completionColumn,
+        );
+        if (!is_complete || !current || m.version > current) {
+            await run_sqlite_migration(db, m);
+        }
+    }
+
+    await quarantine_orphan_temporal_facts_sqlite(db);
+}
+
+async function run_pg_migrations(pool: Pool): Promise<void> {
+    const current = await get_db_version_pg(pool);
+    log(`Current database version: ${current || "none"}`);
+
+    const mt = assertSafeIdentifier(
+        process.env.OM_PG_TABLE || "openmemory_memories",
+        "OM_PG_TABLE",
+    );
+
+    for (const m of migrations) {
+        const is_complete = await check_column_exists_pg(
+            pool,
+            mt,
+            m.completionColumn,
+        );
+        if (!is_complete || !current || m.version > current) {
+            await run_pg_migration(pool, m);
+        }
+    }
+
+    await quarantine_orphan_temporal_facts_pg(pool);
+}
+
 export async function run_migrations() {
     log("Checking for pending migrations...");
 
@@ -411,32 +461,14 @@ export async function run_migrations() {
             ssl,
         });
 
-        const current = await get_db_version_pg(pool);
-        log(`Current database version: ${current || "none"}`);
-
-        for (const m of migrations) {
-            if (!current || m.version > current) {
-                await run_pg_migration(pool, m);
-            }
-        }
-
-        await quarantine_orphan_temporal_facts_pg(pool);
+        await run_pg_migrations(pool);
 
         await pool.end();
     } else {
         const db_path = process.env.OM_DB_PATH || "./data/openmemory.sqlite";
         const db = new sqlite3.Database(db_path);
 
-        const current = await get_db_version_sqlite(db);
-        log(`Current database version: ${current || "none"}`);
-
-        for (const m of migrations) {
-            if (!current || m.version > current) {
-                await run_sqlite_migration(db, m);
-            }
-        }
-
-        await quarantine_orphan_temporal_facts_sqlite(db);
+        await run_sqlite_migrations(db);
 
         await new Promise<void>((ok) => db.close(() => ok()));
     }
```

**File**: `packages/openmemory-js/tests/migrate.test.ts` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import sqlite3 from "sqlite3";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { run_sqlite_migrations } from "../src/core/migrate";
+
+const exec = (db: sqlite3.Database, sql: string): Promise<void> =>
+    new Promise((resolve, reject) => {
+        db.exec(sql, (err) => (err ? reject(err) : resolve()));
+    });
+
+const all = <T>(db: sqlite3.Database, sql: string): Promise<T[]> =>
+    new Promise((resolve, reject) => {
+        db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
+    });
+
+const columns = async (db: sqlite3.Database, table: string) => {
+    const rows = await all<{ name: string }>(db, `PRAGMA table_info(${table})`);
+    return rows.map((row) => row.name);
+};
+
+const create_corrupted_v130_schema = async (db: sqlite3.Database) => {
+    await exec(
+        db,
+        `
+        CREATE TABLE memories (id TEXT PRIMARY KEY, user_id TEXT, content TEXT);
+        CREATE TABLE vectors (id TEXT, sector TEXT, user_id TEXT);
+        CREATE TABLE waypoints (src_id TEXT, dst_id TEXT, user_id TEXT);
+        CREATE TABLE temporal_facts (id TEXT PRIMARY KEY, user_id TEXT);
+        CREATE TABLE schema_version (version TEXT PRIMARY KEY, applied_at INTEGER);
+
+        INSERT INTO memories VALUES ('memory-1', 'user-1', 'keep me');
+        INSERT INTO vectors VALUES ('memory-1', 'semantic', 'user-1');
+        INSERT INTO waypoints VALUES ('memory-1', 'memory-1', 'user-1');
+        INSERT INTO temporal_facts VALUES ('fact-1', 'user-1');
+        INSERT INTO schema_version VALUES ('1.3.0', 1);
+        `,
+    );
+};
+
+describe("SQLite schema migrations", () => {
+    let db: sqlite3.Database;
+
+    beforeEach(async () => {
+        db = new sqlite3.Database(":memory:");
+        await create_corrupted_v130_schema(db);
+    });
+
+    afterEach(async () => {
+        await new Promise<void>((resolve, reject) => {
+            db.close((err) => (err ? reject(err) : resolve()));
+        });
+    });
+
+    it("repairs a database marked 1.3.0 when project_id columns are missing", async () => {
+        await run_sqlite_migrations(db);
+
+        for (const table of [
+            "memories",
+            "vectors",
+            "waypoints",
+            "temporal_facts",
+        ]) {
+            expect(await columns(db, table)).toContain("project_id");
+        }
+
+        const memories = await all<{ content: string }>(
+            db,
+            "SELECT content FROM memories",
+        );
+        expect(memories).toEqual([{ content: "keep me" }]);
+    });
+
+    it("is idempotent after repairing the missing 1.3.0 columns", async () => {
+        await run_sqlite_migrations(db);
+        await run_sqlite_migrations(db);
+
+        const versions = await all<{ version: string }>(
+            db,
+            "SELECT version FROM schema_version ORDER BY version",
+        );
+        expect(versions).toEqual([{ version: "1.3.0" }]);
+
+        for (const table of [
+            "memories",
+            "vectors",
+            "waypoints",
+            "temporal_facts",
+        ]) {
+            const projectColumns = (await columns(db, table)).filter(
+                (column) => column === "project_id",
+            );
+            expect(projectColumns).toHaveLength(1);
+        }
+    });
+});
```

---

### Incident Patch 14: `7b6141c6` (2026-07-28)
**Commit Message**: Merge pull request #194 from mameikagou/agent/add-chinese-memory-classification

Add Chinese memory sector classification

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +20/-0)
```diff
@@ -59,6 +59,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(at\s+\d{1,2}:\d{2}|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
             /\b(event|moment|experience|incident|occurrence|happened)\b/i,
             /\bI\s+'?m\s+going\s+to\b/i,
+            /(?:今天|昨天|明天|前天|后天|本周|上周|下周|上个月|下个月|去年|明年|刚才|当时|那天|这次)/,
+            /(?:我|我们).{0,12}(?:去了|看到|见到|遇到|参加|经历|发生|做了|完成了)/,
+            /(?:\d{4}年)?\d{1,2}月\d{1,2}日/,
+            /(?:周|星期)[一二三四五六日天]/,
         ],
     },
     semantic: {
@@ -72,6 +76,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(capital|population|distance|weight|height|width|depth)\b/i,
             /\b(history|science|geography|math|physics|biology|chemistry)\b/i,
             /\b(know|understand|learn|read|write|speak)\b/i,
+            /(?:是|指的是|意味着|代表|定义为|属于)/,
+            /(?:概念|理论|原理|定律|假设|定义|知识)/,
+            /(?:事实|数据|证据|研究|报告)/,
+            /(?:历史|科学|地理|数学|物理|生物|化学)/,
         ],
     },
     procedural: {
@@ -85,6 +93,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(click|press|type|enter|select|drag|drop|scroll)\b/i,
             /\b(method|function|class|algorithm|routine|recipie)\b/i,
             /\b(to\s+do|to\s+make|to\s+build|to\s+create)\b/i,
+            /(?:怎么|如何|怎样).{0,12}(?:做|操作|安装|运行|配置|部署|创建|实现)/,
+            /(?:第一步|第二步|然后|接着|下一步|最后|依次)/,
+            /(?:安装|运行|执行|编译|构建|部署|配置|设置|点击|输入|选择|按下)/,
+            /(?:步骤|教程|指南|操作方法|流程|做法)/,
         ],
     },
     emotional: {
@@ -99,6 +111,9 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(frustrated|confused|overwhelmed|stressed|relaxed|calm)\b/i,
             /\b(wow|omg|yay|nooo|ugh|sigh)\b/i,
             /[!]{2,}/,
+            /(?:感觉|感到|心情|情绪)/,
+            /(?:开心|高兴|难过|伤心|生气|愤怒|兴奋|害怕|焦虑|紧张|沮丧|郁闷|烦躁|压力|放松|平静)/,
+            /(?:喜欢|讨厌|热爱|厌恶|满意|失望|尴尬|痛苦|幸福)/,
         ],
     },
     reflective: {
@@ -113,6 +128,11 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(lesson|moral|takeaway|conclusion|summary|implication)\b/i,
             /\b(feedback|review|analysis|evaluation|assessment)\b/i,
             /\b(improve|grow|change|adapt|evolve)\b/i,
+            /(?:意识到|明白了|想通了|发现|领悟|反思|复盘)/,
+            /(?:我觉得|我认为|在我看来|回头看|仔细想想)/,
+            /(?:规律|趋势|联系|关系|相关性|模式)/,
+            /(?:教训|启发|心得|体会|收获|总结|结论|反省)/,
+            /(?:改进|成长|改变|适应|优化)/,
         ],
     },
 };
```

**File**: `packages/openmemory-js/tests/chinese_classifier.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { describe, expect, it } from "vitest";
+import { classify_content } from "../src/memory/hsg";
+
+describe("Chinese memory sector classifier", () => {
+    const samples = [
+        ["昨天我参加了项目复盘会。", "episodic"],
+        ["北京是中国的首都。", "semantic"],
+        ["部署流程：第一步安装依赖，然后运行测试。", "procedural"],
+        ["我最近很焦虑，也有点烦躁。", "emotional"],
+        ["复盘后我意识到，沟通前应该先明确目标。", "reflective"],
+    ] as const;
+
+    it.each(samples)("classifies '%s' as %s", (text, primary) => {
+        expect(classify_content(text).primary).toBe(primary);
+    });
+
+    it("keeps secondary sectors for mixed Chinese memories", () => {
+        const result = classify_content(
+            "今天我被老板表扬了，感觉特别开心。",
+        );
+
+        expect(result.primary).toBe("emotional");
+        expect(result.additional).toContain("episodic");
+    });
+
+    it("still honors an explicit sector override", () => {
+        expect(
+            classify_content("这段文字不依赖关键词。", {
+                sector: "procedural",
+            }),
+        ).toEqual({
+            primary: "procedural",
+            additional: [],
+            confidence: 1,
+        });
+    });
+});
```

---

### Incident Patch 15: `ec1a8bdc` (2026-07-28)
**Commit Message**: add Chinese memory sector classification

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +20/-0)
```diff
@@ -59,6 +59,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(at\s+\d{1,2}:\d{2}|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
             /\b(event|moment|experience|incident|occurrence|happened)\b/i,
             /\bI\s+'?m\s+going\s+to\b/i,
+            /(?:今天|昨天|明天|前天|后天|本周|上周|下周|上个月|下个月|去年|明年|刚才|当时|那天|这次)/,
+            /(?:我|我们).{0,12}(?:去了|看到|见到|遇到|参加|经历|发生|做了|完成了)/,
+            /(?:\d{4}年)?\d{1,2}月\d{1,2}日/,
+            /(?:周|星期)[一二三四五六日天]/,
         ],
     },
     semantic: {
@@ -72,6 +76,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(capital|population|distance|weight|height|width|depth)\b/i,
             /\b(history|science|geography|math|physics|biology|chemistry)\b/i,
             /\b(know|understand|learn|read|write|speak)\b/i,
+            /(?:是|指的是|意味着|代表|定义为|属于)/,
+            /(?:概念|理论|原理|定律|假设|定义|知识)/,
+            /(?:事实|数据|证据|研究|报告)/,
+            /(?:历史|科学|地理|数学|物理|生物|化学)/,
         ],
     },
     procedural: {
@@ -85,6 +93,10 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(click|press|type|enter|select|drag|drop|scroll)\b/i,
             /\b(method|function|class|algorithm|routine|recipie)\b/i,
             /\b(to\s+do|to\s+make|to\s+build|to\s+create)\b/i,
+            /(?:怎么|如何|怎样).{0,12}(?:做|操作|安装|运行|配置|部署|创建|实现)/,
+            /(?:第一步|第二步|然后|接着|下一步|最后|依次)/,
+            /(?:安装|运行|执行|编译|构建|部署|配置|设置|点击|输入|选择|按下)/,
+            /(?:步骤|教程|指南|操作方法|流程|做法)/,
         ],
     },
     emotional: {
@@ -99,6 +111,9 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(frustrated|confused|overwhelmed|stressed|relaxed|calm)\b/i,
             /\b(wow|omg|yay|nooo|ugh|sigh)\b/i,
             /[!]{2,}/,
+            /(?:感觉|感到|心情|情绪)/,
+            /(?:开心|高兴|难过|伤心|生气|愤怒|兴奋|害怕|焦虑|紧张|沮丧|郁闷|烦躁|压力|放松|平静)/,
+            /(?:喜欢|讨厌|热爱|厌恶|满意|失望|尴尬|痛苦|幸福)/,
         ],
     },
     reflective: {
@@ -113,6 +128,11 @@ export const sector_configs: Record<string, sector_cfg> = {
             /\b(lesson|moral|takeaway|conclusion|summary|implication)\b/i,
             /\b(feedback|review|analysis|evaluation|assessment)\b/i,
             /\b(improve|grow|change|adapt|evolve)\b/i,
+            /(?:意识到|明白了|想通了|发现|领悟|反思|复盘)/,
+            /(?:我觉得|我认为|在我看来|回头看|仔细想想)/,
+            /(?:规律|趋势|联系|关系|相关性|模式)/,
+            /(?:教训|启发|心得|体会|收获|总结|结论|反省)/,
+            /(?:改进|成长|改变|适应|优化)/,
         ],
     },
 };
```

**File**: `packages/openmemory-js/tests/chinese_classifier.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { describe, expect, it } from "vitest";
+import { classify_content } from "../src/memory/hsg";
+
+describe("Chinese memory sector classifier", () => {
+    const samples = [
+        ["昨天我参加了项目复盘会。", "episodic"],
+        ["北京是中国的首都。", "semantic"],
+        ["部署流程：第一步安装依赖，然后运行测试。", "procedural"],
+        ["我最近很焦虑，也有点烦躁。", "emotional"],
+        ["复盘后我意识到，沟通前应该先明确目标。", "reflective"],
+    ] as const;
+
+    it.each(samples)("classifies '%s' as %s", (text, primary) => {
+        expect(classify_content(text).primary).toBe(primary);
+    });
+
+    it("keeps secondary sectors for mixed Chinese memories", () => {
+        const result = classify_content(
+            "今天我被老板表扬了，感觉特别开心。",
+        );
+
+        expect(result.primary).toBe("emotional");
+        expect(result.additional).toContain("episodic");
+    });
+
+    it("still honors an explicit sector override", () => {
+        expect(
+            classify_content("这段文字不依赖关键词。", {
+                sector: "procedural",
+            }),
+        ).toEqual({
+            primary: "procedural",
+            additional: [],
+            confidence: 1,
+        });
+    });
+});
```

#### Recent Merged Pull Requests:
- **PR #211** (2026-08-24): feat(embeddings): accept DashScope API keys (@mameikagou)
- **PR #210** (2026-08-25): feat(embeddings): add OpenRouter provider (@mameikagou)
- **PR #209** (2026-08-24): fix(embeddings): honor an empty fallback chain (@mameikagou)
- **PR #208** (2026-08-24): fix(memory): preserve long single-sentence summaries (@mameikagou)
- **PR #207** (2026-08-24): feat: Add support for vector search with Qdrant (@anush008)
- **PR #205** (2026-08-20): feat: add OrcaRouter as a named embedding provider (@JinhaoSong322)
- **PR #204** (2026-08-23): fix(dashboard): remove immutable memory controls (@mameikagou)
- **PR #203** (2026-08-24): fix(dashboard): keep rewrite API credentials server-side (@mameikagou)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
