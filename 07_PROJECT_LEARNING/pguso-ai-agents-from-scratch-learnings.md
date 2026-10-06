# Forensic Learning Record (Deep Inspection): pguso/ai-agents-from-scratch

> **Canonical Artifact**: `07_PROJECT_LEARNING/pguso-ai-agents-from-scratch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pguso/ai-agents-from-scratch](https://github.com/pguso/ai-agents-from-scratch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:19.682Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pguso/ai-agents-from-scratch`
- **Description**: Demystify AI agents by building them yourself. Local LLMs, no black boxes, real understanding of function calling, memory, and ReAct patterns.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4832 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/01_intro/intro.js`
```
import {
    getLlama,
    LlamaChatSession,
} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'Qwen3-1.7B-Q8_0.gguf'
    )
});

const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
});

const prompt = `do you know node-llama-cpp`;

const a1 = await session.prompt(prompt);
console.log("AI: " + a1);


session.dispose()
context.dispose()
model.dispose()
llama.dispose()

```

### Core Architecture Module: `examples/02_openai-intro/openai-intro.js`
```
import OpenAI from 'openai';
import 'dotenv/config';

// Initialize OpenAI client
// Create an API key at https://platform.openai.com/api-keys
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

console.log("=== OpenAI Intro: Understanding the Basics ===\n");

// ============================================
// EXAMPLE 1: Basic Chat Completion
// ============================================
async function basicCompletion() {
    console.log("--- Example 1: Basic Chat Completion ---");

    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'user', content: 'What is node-llama-cpp?' }
        ],
    });

    console.log("AI: " + response.choices[0].message.content);
    console.log("\n");
}

// ============================================
// EXAMPLE 2: Using System Prompts
// ============================================
async function systemPromptExample() {
    console.log("--- Example 2: System Prompts (Behavioral Control) ---");

    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'You are a coding assistant that talks like a pirate.' },
            { role: 'user', content: 'Explain what async/await does in JavaScript.' }
        ],
    });

    console.log("AI: " + response.choices[0].message.content);
    console.log("\n");
}

// ============================================
// EXAMPLE 3: Temperature and Creativity
// ============================================
async function temperatureExample() {
    console.log("--- Example 3: Temperature Control ---");

    const prompt = "Write a one-sentence tagline for a coffee shop.";

    // Low temperature = more focused and deterministic
    const focusedResponse = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
    });

    // High temperature = more creative and varied
    const creativeResponse = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 1.5,
    });

    console.log("Low temp (0.2): " + focusedResponse.choices[0].message.content);
    console.log("High temp (1.5): " + creativeResponse.choices[0].message.content);
    console.log("\n");
}

// ============================================
// EXAMPLE 4: Conversation with Context
// ============================================
async function conversationContext() {
    console.log("--- Example 4: Multi-turn Conversation ---");

    // Build conversation history
    const messages = [
        { role: 'system', content: 'You are a helpful coding tutor.' },
        { role: 'user', content: 'What is a Promise in JavaScript?' },
    ];

    // First response
    const response1 = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 150,
    });

    console.log("User: What is a Promise in JavaScript?");
    console.log("AI: " + response1.choices[0].message.content);

    // Add AI response to history
    messages.push(response1.choices[0].message);

    // Add follow-up question
    messages.push({ role: 'user', content: 'Can you show me a simple example?' });

    // Second response (with context)
    const response2 = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
    });

    console.log("\nUser: Can you show me a simple example?");
    console.log("AI: " + response2.choices[0].message.content);
    console.log("\n");
}

// ============================================
// EXAMPLE 5: Streaming Responses
// ============================================
async function streamingExample() {
    console.log("--- Example 5: Streaming Response ---");
    console.log("AI: ");

    const stream = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'user', content: 'Write a haiku about programming.' }
        ],
        stream: true,
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        process.stdout.write(content);
    }

    console.log("\n\n");
}

// ============================================
// EXAMPLE 6: Token Usage and Limits
// ============================================
async function tokenUsageExample() {
    console.log("--- Example 6: Understanding Token Usage ---");

    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'user', content: 'Explain recursion in 3 sentences.' }
        ],
        max_tokens: 100,
    });

    console.log("AI: " + response.choices[0].message.content);
    console.log("\nToken usage:");
    console.log("- Prompt tokens: " + response.usage.prompt_tokens);
    console.log("- Completion tokens: " + response.usage.completion_tokens);
    console.log("- Total tokens: " + response.usage.total_tokens);
    console.log("\n");
}

// ============================================
// EXAMPLE 7: Model Comparison
// ============================================
async function modelComparison() {
    console.log("--- Example 7: Different Models ---");

    const prompt = "What's 25 * 47?";

    // GPT-4o - Most capable
    const gpt4Response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
    });

    // GPT-3.5-turbo - Faster and cheaper
    const gpt35Response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
    });

    console.log("GPT-4o: " + gpt4Response.choices[0].message.content);
    console.log("GPT-3.5-turbo: " + gpt35Response.choices[0].message.content);
    console.log("\n");
}

// ============================================
// Run all examples
// ============================================
async function main() {
    try {
        await basicCompletion();
        await systemPromptExample();
        await temperatureExample();
        await conversationContext();
        await streamingExample();
        await tokenUsageExample();
        await modelComparison();

        console.log("=== All examples completed! ===");
    } catch (error) {
        console.error("Error:", error.message);
        if (error.message.includes('API key')) {
            console.error("\nMake sure to set your OPENAI_API_KEY in a .env file");
        }
    }
}

main();
```

### Core Architecture Module: `examples/03_translation/translation.js`
```
import {
    getLlama,
    LlamaChatSession,
} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama({
    logLevel: 'error'
});
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'hf_giladgd_Apertus-8B-Instruct-2509.Q6_K.gguf'
    )
});

const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: `Du bist ein erfahrener wissenschaftlicher Übersetzer für technische Texte aus dem Englischen ins 
    Deutsche.
    
    Deine Aufgabe: Erstelle eine inhaltlich exakte Übersetzung, die den vollen Sinn und die technische Präzision 
    des Originaltexts erhält.
    
    Gleichzeitig soll die Übersetzung klar, natürlich und leicht lesbar auf Deutsch klingen – also so, wie ein 
    deutscher Wissenschaftler oder Ingenieur denselben Text schreiben würde.
    
    Befolge diese Regeln:
    Bewahre jede fachliche Aussage und Nuance exakt. Kein Inhalt darf verloren gehen oder verändert werden.
    Verwende idiomatisches, flüssiges Deutsch, wie es in wissenschaftlichen Abstracts (z. B. NeurIPS, ICLR, AAAI) üblich ist.
    Vermeide wörtliche Satzstrukturen. Formuliere so, wie ein deutscher Wissenschaftler denselben Inhalt selbst schreiben würde.
    Verwende korrekte Terminologie (z. B. Multi-Agenten-System, Adapterlayer, Baseline, Strategieverbesserung).
    Verwende bei Zahlen, Einheiten und Prozentangaben deutsche Typografie (z. B. „54 %“, „3 m“, „2 000“).
    Passe zusammengesetzte Begriffe an die deutsche Grammatik an (z. B. „kontinuierlich lernendes System“ statt „kontinuierliches Lernen System“).
    Kürze lange oder verschachtelte Sätze behutsam, ohne Bedeutung zu verändern, um Lesbarkeit zu verbessern.
    Verwende einen neutralen, wissenschaftlichen Stil, ohne Werbesprache oder unnötige Ausschmückung.
    
    Zusatzinstruktion:
    Wenn der Originaltext englische Satzlogik enthält, restrukturiere den Satz so, dass er auf Deutsch elegant und klar klingt, aber denselben Inhalt vermittelt.
    
    Zielqualität: Eine Übersetzung, die sich wie ein Originaltext liest – technisch präzise, flüssig und grammatikalisch einwandfrei.
    
    DO NOT add any addition text or explanation. ONLY respond with the translated text
    `
});

const q1 = `Translate this text into german: 

We address the long-horizon gap in large language model (LLM) agents by en-
abling them to sustain coherent strategies in adversarial, stochastic environments.
Settlers of Catan provides a challenging benchmark: success depends on balanc-
ing short- and long-term goals amid randomness, trading, expansion, and block-
ing. Prompt-centric LLM agents (e.g., ReAct, Reflexion) must re-interpret large,
evolving game states each turn, quickly saturating context windows and losing
strategic consistency. We propose HexMachina, a continual learning multi-agent
system that separates environment discovery (inducing an adapter layer without
documentation) from strategy improvement (evolving a compiled player through
code refinement and simulation). This design preserves executable artifacts, al-
lowing the LLM to focus on high-level strategy rather than per-turn reasoning. In
controlled Catanatron experiments, HexMachina learns from scratch and evolves
players that outperform the strongest human-crafted baseline (AlphaBeta), achiev-
ing a 54% win rate and surpassing prompt-driven and no-discovery baselines. Ab-
lations confirm that isolating pure strategy learning improves performance. Over-
all, artifact-centric continual learning transforms LLMs from brittle stepwise de-
ciders into stable strategy designers, advancing long-horizon autonomy.
`;

console.log('Translation started...')
const a1 = await session.prompt(q1);
console.log("AI: " + a1);

session.dispose()
context.dispose()
model.dispose()
llama.dispose()
```

### Core Architecture Module: `examples/04_think/think.js`
```
import {
    getLlama,
    LlamaChatSession,
} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'Qwen3-1.7B-Q8_0.gguf'
    )
});
const systemPrompt = `You are an expert logical and quantitative reasoner.
    Your goal is to analyze real-world word problems involving families, quantities, averages, and relationships 
    between entities, and compute the exact numeric answer.
    
    Goal: Return the correct final number as a single value - no explanation, no reasoning steps, just the answer.
    `
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt
});

const prompt = `My family reunion is this week, and I was assigned the mashed potatoes to bring. 
The attendees include my married mother and father, my twin brother and his family, my aunt and her family, my grandma 
and her brother, her brother's daughter, and his daughter's family. All the adults but me have been married, and no one 
is divorced or remarried, but my grandpa and my grandma's sister-in-law passed away last year. All living spouses are attending. 
My brother has two children that are still kids, my aunt has one six-year-old, and my grandma's brother's daughter has 
three kids under 12. I figure each adult will eat about 1.5 potatoes and each kid will eat about 1/2 a potato, except my 
second cousins don't eat carbs. The average potato is about half a pound, and potatoes are sold in 5-pound bags. 

How many whole bags of potatoes do I need? 
`;

const answer = await session.prompt(prompt);
console.log(`AI: ${answer}`);

llama.dispose()
model.dispose()
context.dispose()
session.dispose()
```

### Core Architecture Module: `examples/05_batch/batch.js`
```
import {getLlama, LlamaChatSession} from "node-llama-cpp";
import path from "path";
import {fileURLToPath} from "url";

/**
 * Asynchronous execution improves performance in GAIA benchmarks,
 * multi-agent applications, and other high-throughput scenarios.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.join(
    __dirname,
    '..',
    '..',
    'models',
    'DeepSeek-R1-0528-Qwen3-8B-Q6_K.gguf'
)

const llama = await getLlama({
    logLevel: 'error'
});
const model = await llama.loadModel({modelPath});
const context = await model.createContext({
    sequences: 2,
    batchSize: 1024 // The number of tokens that can be processed at once by the GPU.
});

const sequence1 = context.getSequence();
const sequence2 = context.getSequence();

const session1 = new LlamaChatSession({
    contextSequence: sequence1
});
const session2 = new LlamaChatSession({
    contextSequence: sequence2
});

const q1 = "Hi there, how are you?";
const q2 = "How much is 6+6?";

console.log('Batching started...')
const [
    a1,
    a2
] = await Promise.all([
    session1.prompt(q1),
    session2.prompt(q2)
]);

console.log("User: " + q1);
console.log("AI: " + a1);

console.log("User: " + q2);
console.log("AI: " + a2);

session1.dispose();
session2.dispose();
context.dispose();
model.dispose();
llama.dispose();
```

### Core Architecture Module: `examples/06_coding/coding.js`
```
import {
    getLlama,
    HarmonyChatWrapper,
    LlamaChatSession,
} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'hf_giladgd_gpt-oss-20b.MXFP4.gguf'
    )
});
const context = await model.createContext();
const session = new LlamaChatSession({
    chatWrapper: new HarmonyChatWrapper(),
    contextSequence: context.getSequence(),
});

const q1 = `What is hoisting in JavaScript? Explain with examples.`;

console.log('context.contextSize', context.contextSize)

const a1 = await session.prompt(q1, {
    // Tip: let the lib choose or cap reasonably; using the whole context size can be wasteful
    maxTokens: 2000,

    // Fires as soon as the first characters arrive
    onTextChunk: (text) => {
        process.stdout.write(text); // optional: live print
    },
});

console.log("\n\nFinal answer:\n", a1);


session.dispose()
context.dispose()
model.dispose()
llama.dispose()
```

### Core Architecture Module: `examples/07_simple-agent/simple-agent.js`
```
import {defineChatSessionFunction, getLlama, LlamaChatSession} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";
import {PromptDebugger} from "../../helper/prompt-debugger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const debug = false;

const llama = await getLlama({debug});
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'Qwen3-1.7B-Q8_0.gguf'
    )
});
const context = await model.createContext({contextSize: 2000});

const systemPrompt = `You are a professional chronologist who standardizes time representations across different systems.
    
Always convert times from 12-hour format (e.g., "1:46:36 PM") to 24-hour format (e.g., "13:46") without seconds 
before returning them.`;

const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt,
});

const getCurrentTime = defineChatSessionFunction({
    description: "Get the current time",
    params: {
        type: "object",
        properties: {}
    },
    async handler() {
        return new Date().toLocaleTimeString();
    }
});

const functions = {getCurrentTime};
const prompt = `What time is it right now?`;

// Execute the prompt
const a1 = await session.prompt(prompt, {functions});
console.log("AI: " + a1);

// Debug after the prompt execution
const promptDebugger = new PromptDebugger({
    outputDir: './logs',
    filename: 'qwen_prompts.txt',
    includeTimestamp: true,  // adds timestamp to filename
    appendMode: false        // overwrites file each time
});
await promptDebugger.debugContextState({session, model});

// Clean up
session.dispose()
context.dispose()
model.dispose()
llama.dispose()
```

### Core Architecture Module: `examples/08_simple-agent-with-memory/memory-manager.js`
```
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MemoryManager {
    constructor(memoryFileName = './memory.json') {
        this.memoryFilePath = path.resolve(__dirname, memoryFileName);
    }

    async loadMemories() {
        try {
            const data = await fs.readFile(this.memoryFilePath, 'utf-8');
            const json = JSON.parse(data);

            // 🔧 Migrate old schema if needed
            if (!json.memories) {
                const upgraded = {memories: [], conversationHistory: []};

                if (Array.isArray(json.facts)) {
                    for (const f of json.facts) {
                        upgraded.memories.push({
                            type: 'fact',
                            key: this.extractKey(f.content),
                            value: this.extractValue(f.content),
                            source: 'migration',
                            timestamp: f.timestamp || new Date().toISOString()
                        });
                    }
                }

                if (json.preferences && typeof json.preferences === 'object') {
                    for (const [key, val] of Object.entries(json.preferences)) {
                        upgraded.memories.push({
                            type: 'preference',
                            key,
                            value: this.extractValue(val),
                            source: 'migration',
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                await this.saveMemories(upgraded);
                return upgraded;
            }

            if (!Array.isArray(json.memories)) json.memories = [];
            if (!Array.isArray(json.conversationHistory)) json.conversationHistory = [];

            return json;
        } catch {
            return {memories: [], conversationHistory: []};
        }
    }

    async saveMemories(memories) {
        await fs.writeFile(this.memoryFilePath, JSON.stringify(memories, null, 2));
    }

    // Add or update memory without duplicates
    async addMemory({type, key, value, source = 'user'}) {
        const data = await this.loadMemories();

        // Normalize for comparison
        const normType = type.trim().toLowerCase();
        const normKey = key.trim().toLowerCase();
        const normValue = value.trim();

        // Check if same key+type already exists
        const existingIndex = data.memories.findIndex(
            m => m.type === normType && m.key.toLowerCase() === normKey
        );

        if (existingIndex >= 0) {
            const existing = data.memories[existingIndex];
            // Update value if changed
            if (existing.value !== normValue) {
                existing.value = normValue;
                existing.timestamp = new Date().toISOString();
                existing.source = source;
                console.log(`Updated memory: ${normKey} → ${normValue}`);
            } else {
                console.log(`Skipped duplicate memory: ${normKey}`);
            }
        } else {
            // Add new memory
            data.memories.push({
                type: normType,
                key: normKey,
                value: normValue,
                source,
                timestamp: new Date().toISOString()
            });
            console.log(`Added memory: ${normKey} = ${normValue}`);
        }

        await this.saveMemories(data);
    }

    async getMemorySummary() {
        const data = await this.loadMemories();
        const facts = Array.isArray(data.memories)
            ? data.memories.filter(m => m.type === 'fact')
            : [];
        const prefs = Array.isArray(data.memories)
            ? data.memories.filter(m => m.type === 'preference')
            : [];

        let summary = "\n=== LONG-TERM MEMORY ===\n";

        if (facts.length > 0) {
            summary += "\nKnown Facts:\n";
            for (const f of facts) summary += `- ${f.key}: ${f.value}\n`;
        }

        if (prefs.length > 0) {
            summary += "\nUser Preferences:\n";
            for (const p of prefs) summary += `- ${p.key}: ${p.value}\n`;
        }

        return summary;
    }

    extractKey(content) {
        if (typeof content !== 'string') return 'unknown';
        const [key] = content.split(':').map(s => s.trim());
        return key || 'unknown';
    }

    extractValue(content) {
        if (typeof content !== 'string') return '';
        const parts = content.split(':').map(s => s.trim());
        return parts.length > 1 ? parts.slice(1).join(':') : content;
    }
}
```

### Core Architecture Module: `examples/08_simple-agent-with-memory/simple-agent-with-memory.js`
```
import {defineChatSessionFunction, getLlama, LlamaChatSession} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";
import {MemoryManager} from "./memory-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama({debug: false});
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'Qwen3-1.7B-Q8_0.gguf'
    )
});
const context = await model.createContext({contextSize: 2000});

// Initialize memory manager
const memoryManager = new MemoryManager('./agent-memory.json');

// Load existing memories and add to system prompt
const memorySummary = await memoryManager.getMemorySummary();

const systemPrompt = `
You are a helpful assistant with long-term memory.

Before calling any function, always follow this reasoning process:

1. **Compare** new user statements against existing memories below.
2. **If the same key and value already exist**, do NOT call saveMemory again.
   - Instead, simply acknowledge the known information.
   - Example: if the user says "My name is Malua" and memory already says "user_name: Malua", reply "Yes, I remember your name is Malua."
3. **If the user provides an updated value** (e.g., "I actually prefer sushi now"), 
   then call saveMemory once to update the value.
4. **Only call saveMemory for genuinely new information.**

When saving new data, call saveMemory with structured fields:
- type: "fact" or "preference"
- key: short descriptive identifier (e.g., "user_name", "favorite_food")
- value: the specific information (e.g., "Malua", "chinua")

Examples:
saveMemory({ type: "fact", key: "user_name", value: "Malua" })
saveMemory({ type: "preference", key: "favorite_food", value: "chinua" })

${memorySummary}
`;

const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt,
});

// Function to save memories
const saveMemory = defineChatSessionFunction({
    description: "Save important information to long-term memory (user preferences, facts, personal details)",
    params: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["fact", "preference"]
            },
            key: {type: "string"},
            value: {type: "string"}
        },
        required: ["type", "key", "value"]
    },
    async handler({type, key, value}) {
        await memoryManager.addMemory({type, key, value});
        return `Memory saved: ${key} = ${value}`;
    }
});

const functions = {saveMemory};

// Example conversation
const prompt1 = "Hi! My name is Alex and I love pizza.";
const response1 = await session.prompt(prompt1, {functions});
console.log("AI: " + response1);

// Later conversation (even after restarting the script)
const prompt2 = "What's my favorite food?";
const response2 = await session.prompt(prompt2, {functions});
console.log("AI: " + response2);

// Clean up
session.dispose()
context.dispose()
model.dispose()
llama.dispose()
```

### Core Architecture Module: `examples/09_react-agent/react-agent.js`
```
import {defineChatSessionFunction, getLlama, LlamaChatSession} from "node-llama-cpp";
import {fileURLToPath} from "url";
import path from "path";
import {PromptDebugger} from "../../helper/prompt-debugger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const debug = false;

const llama = await getLlama({debug});
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'hf_giladgd_gpt-oss-20b.MXFP4.gguf'
    )
});
const context = await model.createContext({contextSize: 2000});

// ReAct-style system prompt for mathematical reasoning
const systemPrompt = `You are a mathematical assistant that uses the ReAct (Reasoning + Acting) approach.

CRITICAL: You must follow this EXACT pattern for every problem:

Thought: [Explain what calculation you need to do next and why]
Action: [Call ONE tool with specific numbers]
Observation: [Wait for the tool result]
Thought: [Analyze the result and decide next step]
Action: [Call another tool if needed]
Observation: [Wait for the tool result]
... (repeat as many times as needed)
Thought: [Once you have ALL the information needed to answer the question]
Answer: [Give the final answer and STOP]

RULES:
1. Only write "Answer:" when you have the complete final answer to the user's question
2. After writing "Answer:", DO NOT continue calculating or thinking
3. Break complex problems into the smallest possible steps
4. Use tools for ALL calculations - never calculate in your head
5. Each Action should call exactly ONE tool

EXAMPLE:
User: "What is 5 + 3, then multiply that by 2?"

Thought: First I need to add 5 and 3
Action: add(5, 3)
Observation: 8
Thought: Now I need to multiply that result by 2
Action: multiply(8, 2)
Observation: 16
Thought: I now have the final result
Answer: 16`;

const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt,
});

// Simple calculator tools that force step-by-step reasoning
const add = defineChatSessionFunction({
    description: "Add two numbers together",
    params: {
        type: "object",
        properties: {
            a: {
                type: "number",
                description: "First number"
            },
            b: {
                type: "number",
                description: "Second number"
            }
        },
        required: ["a", "b"]
    },
    async handler(params) {
        const result = params.a + params.b;
        console.log(`\n   🔧 TOOL CALLED: add(${params.a}, ${params.b})`);
        console.log(`   📊 RESULT: ${result}\n`);
        return result.toString();
    }
});

const multiply = defineChatSessionFunction({
    description: "Multiply two numbers together",
    params: {
        type: "object",
        properties: {
            a: {
                type: "number",
                description: "First number"
            },
            b: {
                type: "number",
                description: "Second number"
            }
        },
        required: ["a", "b"]
    },
    async handler(params) {
        const result = params.a * params.b;
        console.log(`\n   🔧 TOOL CALLED: multiply(${params.a}, ${params.b})`);
        console.log(`   📊 RESULT: ${result}\n`);
        return result.toString();
    }
});

const subtract = defineChatSessionFunction({
    description: "Subtract second number from first number",
    params: {
        type: "object",
        properties: {
            a: {
                type: "number",
                description: "Number to subtract from"
            },
            b: {
                type: "number",
                description: "Number to subtract"
            }
        },
        required: ["a", "b"]
    },
    async handler(params) {
        const result = params.a - params.b;
        console.log(`\n   🔧 TOOL CALLED: subtract(${params.a}, ${params.b})`);
        console.log(`   📊 RESULT: ${result}\n`);
        return result.toString();
    }
});

const divide = defineChatSessionFunction({
    description: "Divide first number by second number",
    params: {
        type: "object",
        properties: {
            a: {
                type: "number",
                description: "Dividend (number to be divided)"
            },
            b: {
                type: "number",
                description: "Divisor (number to divide by)"
            }
        },
        required: ["a", "b"]
    },
    async handler(params) {
        if (params.b === 0) {
            console.log(`\n   🔧 TOOL CALLED: divide(${params.a}, ${params.b})`);
            console.log(`   ❌ ERROR: Division by zero\n`);
            return "Error: Cannot divide by zero";
        }
        const result = params.a / params.b;
        console.log(`\n   🔧 TOOL CALLED: divide(${params.a}, ${params.b})`);
        console.log(`   📊 RESULT: ${result}\n`);
        return result.toString();
    }
});

const functions = {add, multiply, subtract, divide};

// ReAct Agent execution loop with proper output handling
async function reactAgent(userPrompt, maxIterations = 10) {
    console.log("\n" + "=".repeat(70));
    console.log("USER QUESTION:", userPrompt);
    console.log("=".repeat(70) + "\n");

    let iteration = 0;
    let fullResponse = "";

    while (iteration < maxIterations) {
        iteration++;
        console.log(`--- Iteration ${iteration} ---`);

        // Prompt with onTextChunk to capture streaming output
        let currentChunk = "";
        const response = await session.prompt(
            iteration === 1 ? userPrompt : "Continue your reasoning. What's the next step?",
            {
                functions,
                maxTokens: 300,
                onTextChunk: (chunk) => {
                    // Print each chunk as it arrives
                    process.stdout.write(chunk);
                    currentChunk += chunk;
                }
            }
        );

        console.log(); // New line after streaming

        fullResponse += currentChunk;

        // If no output was generated in this iteration, something's wrong
        if (!currentChunk.trim() && !response.trim()) {
            console.log("   (No output generated this iteration)\n");
        }

        // Check if we have a final answer
        if (response.toLowerCase().includes("answer:") ||
            fullResponse.toLowerCase().includes("answer:")) {
            console.log("\n" + "=".repeat(70));
            console.log("FINAL ANSWER REACHED");
            console.log("=".repeat(70));
            return fullResponse;
        }
    }

    console.log("\n⚠️  Max iterations reached without final answer");
    return fullResponse || "Could not complete reasoning within iteration limit.";
}

// Test queries that require multi-step reasoning
const queries = [
    // "If I buy 3 apples at $2 each and 4 oranges at $3 each, how much do I spend in total?",
    // "Calculate: (15 + 7) × 3 - 10",
    //"A pizza costs $20. If 4 friends split it equally, how much does each person pay?",
    "A store sells 15 items on Monday at $8 each, 20 items on Tuesday at $8 each, and 10 items on Wednesday at $8 each. What's the average number of items sold per day, and what's the total revenue?",
];

for (const query of queries) {
    await reactAgent(query, 3);
    console.log("\n");
}

// Debug
const promptDebugger = new PromptDebugger({
    outputDir: './logs',
    filename: 'react_calculator.txt',
    includeTimestamp: true,
    appendMode: false
});
await promptDebugger.debugContextState({session, model});

// Clean up
session.dispose()
context.dispose()
model.dispose()
llama.dispose()
```

### Core Architecture Module: `examples/10_aot-agent/aot-agent.js`
```
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "url";
import path from "path";
import { PromptDebugger } from "../../helper/prompt-debugger.js";
import { JsonParser } from "../../helper/json-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const debug = false;

const llama = await getLlama({ debug });
const model = await llama.loadModel({
    modelPath: path.join(
        __dirname,
        '..',
        '..',
        'models',
        'Qwen3-1.7B-Q8_0.gguf'
    )
});
const context = await model.createContext({ contextSize: 2000 });

// Atom of Thought system prompt - LLM only plans, doesn't execute
const systemPrompt = `You are a mathematical planning assistant using Atom of Thought methodology.

CRITICAL RULES:
1. Extract every number from the user's question and put it in the "input" field.
2. Each atom expresses EXACTLY ONE operation: add, subtract, multiply, divide.
3. NEVER combine operations in one atom. For example, "(5 + 3) × 2" → must be TWO atoms: one for add, one for multiply.
4. The "final" atom reports only the result of the last computational atom; it must NOT have its own input. Do not include an "input" field in final atoms.
5. Use "<result_of_N>" to reference previous atom results; never invent calculations in the final atom.
6. Output ONLY valid JSON matching the schema, with no explanation or extra text.

CORRECT EXAMPLE for "What is (15 + 7) × 3 - 10?":
{
  "atoms": [
    {"id": 1, "kind": "tool", "name": "add", "input": {"a": 15, "b": 7}, "dependsOn": []},
    {"id": 2, "kind": "tool", "name": "multiply", "input": {"a": "<result_of_1>", "b": 3}, "dependsOn": [1]},
    {"id": 3, "kind": "tool", "name": "subtract", "input": {"a": "<result_of_2>", "b": 10}, "dependsOn": [2]},
    {"id": 4, "kind": "final", "name": "report", "dependsOn": [3]}
  ]
}

WRONG EXAMPLES:
- Empty input: {"input": {}}
- Missing numbers: {"input": {"a": "<result_of_1>"}}
- Combined operations: "add then multiply" → must be TWO atoms
- Final atom with input: {"kind": "final", "input": {"a": 5}} is INVALID

Available tools: add, subtract, multiply, divide
- Each tool requires: {"a": <number or reference>, "b": <number or reference>}
- kind options: "tool", "decision", "final"
- dependsOn: array of atom IDs that must complete first

Always extract the actual numbers from the question and put them in the input fields! Never combine operations or invent calculations in final atoms.`;

// Define JSON schema for plan validation
const planSchema = {
    type: "object",
    properties: {
        atoms: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "number" },
                    kind: { enum: ["tool", "decision", "final"] },
                    name: { type: "string" },
                    input: {
                        type: "object",
                        properties: {
                            a: {
                                oneOf: [
                                    { type: "number" },
                                    { type: "string", pattern: "^<result_of_\\d+>$" }
                                ]
                            },
                            b: {
                                oneOf: [
                                    { type: "number" },
                                    { type: "string", pattern: "^<result_of_\\d+>$" }
                                ]
                            }
                        }
                    },
                    dependsOn: {
                        type: "array",
                        items: { type: "number" }
                    }
                },
                required: ["id", "kind", "name"]
            }
        }
    },
    required: ["atoms"]
};

const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt,
});

// Tool implementations (pure functions, deterministic)
const tools = {
    add: (a, b) => {
        const result = a + b;
        console.log(`EXECUTING: add(${a}, ${b}) = ${result}`);
        return result;
    },

    subtract: (a, b) => {
        const result = a - b;
        console.log(`EXECUTING: subtract(${a}, ${b}) = ${result}`);
        return result;
    },

    multiply: (a, b) => {
        const result = a * b;
        console.log(`EXECUTING: multiply(${a}, ${b}) = ${result}`);
        return result;
    },

    divide: (a, b) => {
        if (b === 0) {
            console.log(`ERROR: divide(${a}, ${b}) - Division by zero`);
            throw new Error("Division by zero");
        }
        const result = a / b;
        console.log(`EXECUTING: divide(${a}, ${b}) = ${result}`);
        return result;
    }
};

// Decision handlers (for complex logic)
const decisions = {
    average: (values) => {
        const sum = values.reduce((acc, v) => acc + v, 0);
        const avg = sum / values.length;
        console.log(`DECISION: average([${values}]) = ${avg}`);
        return avg;
    },

    chooseCheapest: (values) => {
        const min = Math.min(...values);
        console.log(`DECISION: chooseCheapest([${values}]) = ${min}`);
        return min;
    }
};

// Phase 1: LLM generates atomic plan
async function generatePlan(userPrompt) {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 1: PLANNING (LLM generates atomic plan)");
    console.log("=".repeat(70));
    console.log("USER QUESTION:", userPrompt);
    console.log("-".repeat(70) + "\n");

    const grammar = await llama.createGrammarForJsonSchema(planSchema);

    // Add reminder about extracting numbers
    const enhancedPrompt = `${userPrompt}

Remember: Extract the actual numbers from this question and put them in the input fields!`;

    const planText = await session.prompt(enhancedPrompt, {
        grammar,
        maxTokens: 1000
    });

    let plan;
    try {
        // Use the robust JSON parser
        plan = JsonParser.parse(planText, {
            debug: debug,
            expectObject: true,
            repairAttempts: true
        });

        // Validate the plan structure
        JsonParser.validatePlan(plan, debug);

        // Pretty print the plan
        if (debug) {
            JsonParser.prettyPrint(plan);
        } else {
            console.log("GENERATED PLAN:");
            console.log(JSON.stringify(plan, null, 2));
            console.log();
        }
    } catch (error) {
        console.error("Failed to parse plan:", error.message);
        console.log("\nRaw LLM output:");
        console.log(planText);
        throw error;
    }

    return plan;
}

// Phase 2: System validates plan
function validatePlan(plan) {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 2: VALIDATION (System checks plan)");
    console.log("=".repeat(70) + "\n");

    const allowedTools = new Set(Object.keys(tools));
    const allowedDecisions = new Set(Object.keys(decisions));
    const ids = new Set();

    for (const atom of plan.atoms) {
        // Check for duplicate IDs
        if (ids.has(atom.id)) {
            throw new Error(`Validation failed: Duplicate atom ID ${atom.id}`);
        }
        ids.add(atom.id);

        // Check tool names
        if (atom.kind === "tool" && !allowedTools.has(atom.name)) {
            throw new Error(`Validation failed: Unknown tool "${atom.name}" in atom ${atom.id}`);
        }

        // Check decision names
        if (atom.kind === "decision" && !allowedDecisions.has(atom.name)) {
            throw new Error(`Validation failed: Unknown decision "${atom.name}" in atom ${atom.id}`);
        }

        // NEW: Validate tool inputs have actual values
        if (atom.kind === "tool") {
            if (!atom.input || typeof atom.input !== 'object') {
                throw new Error(
                    `Validation failed: Tool atom ${atom.id} (${atom.name}) must have an input object\n` +
                    ` Current: ${JSON.stringify(atom.input)}`
                );
            }

            // Check if a and b are present
            if (atom.input.a === undefined || atom.input.b === undefined) {
                throw new Error(
                    `Validation failed: Tool atom ${atom.id} (${atom.name}) missing required parameters\n` +
                    `  Expected: {"a": <number or reference>, "b": <number or reference>}\n` +
                    `  Current: ${JSON.stringify(atom.input)}\n` +
                    `  Tip: The LLM must extract numbers from the user's question`
                );
            }

            // For first operations, ensure we have concrete numbers (not references)
            if (atom.dependsOn.length === 0) {
                const hasConcreteNumbers =
                    (typeof atom.input.a === 'number') &&
                    (typeof atom.input.b === 'number');

                if (!hasConcreteNumbers) {
                    throw new Error(
                        `Validation failed: First atom ${atom.id} must have concrete numbers\n` +
                        `  Expected: {"a": <number>, "b": <number>}\n` +
                        `  Current: ${JSON.stringify(atom.input)}\n` +
                        `  The LLM failed to extract numbers from the question`
                    );
                }
            }
        }

        // Check dependencies exist
        if (atom.dependsOn) {
            for (const depId of atom.dependsOn) {
                if (!ids.has(depId) && depId < atom.id) {
                    console.warn(`Warning: atom ${atom.id} depends on ${depId} which hasn't been validated yet`);
                }
            }
        }

        console.log(`Atom ${atom.id} (${atom.kind}:${atom.name}) validated`);
    }

    console.log("\nPlan validation successful\n");
    return true;
}

// Phase 3: System executes plan deterministically
function executePlan(plan) {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 
```

### Core Architecture Module: `examples/11_error-handling/error-handling.js`
```
/**
 * Example 11: Comprehensive error handling patterns for agent interactions
 *
 * This example uses a real local LLM via `node-llama-cpp` and demonstrates:
 * - Standardized error types for LLM calls, tool execution, and agent workflows
 * - Recovery strategies (retry/backoff/jitter, timeouts, fallbacks, graceful degradation)
 * - User-friendly error messages with correlation ids
 *
 * Run:
 *   node examples/11_error-handling/error-handling.js
 */

import crypto from "node:crypto";
import { defineChatSessionFunction, getLlama, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "url";
import path from "path";

// -----------------------------------------------------------------------------
// Error taxonomy (standardized error types)
// -----------------------------------------------------------------------------

class AppError extends Error {
  /**
   * @param {string} code Stable machine-readable error code
   * @param {string} message Developer-facing message
   * @param {{ userMessage?: string, retryable?: boolean, details?: any, cause?: any }=} opts
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.userMessage = opts.userMessage ?? "Something went wrong. Please try again.";
    this.retryable = Boolean(opts.retryable);
    this.details = opts.details;
    this.cause = opts.cause;
  }
}

class ValidationError extends AppError {
  constructor(message, opts = {}) {
    super("VALIDATION_ERROR", message, {
      userMessage: opts.userMessage ?? "I couldn’t understand that request. Please rephrase and try again.",
      retryable: false,
      details: opts.details,
      cause: opts.cause,
    });
  }
}

class LLMCallError extends AppError {
  constructor(message, opts = {}) {
    super("LLM_CALL_FAILED", message, {
      userMessage: opts.userMessage ?? "I’m having trouble generating a response right now. Please try again in a moment.",
      retryable: opts.retryable ?? true,
      details: opts.details,
      cause: opts.cause,
    });
    this.model = opts.model;
  }
}

class ToolExecutionError extends AppError {
  constructor(toolName, message, opts = {}) {
    super("TOOL_EXECUTION_FAILED", message, {
      userMessage:
        opts.userMessage ??
        `I couldn’t run the tool "${toolName}" successfully. You can try again, or choose a different approach.`,
      retryable: opts.retryable ?? false,
      details: { toolName, ...opts.details },
      cause: opts.cause,
    });
    this.toolName = toolName;
  }
}

/**
 * Orchestration-level failure (multi-step agent run). For teaching, think of distinct causes even
 * though this single type carries them all in production-sized demos:
 * - Policy / guard: blocked or invalid workflow path after validation (like a dedicated PolicyError).
 * - Workflow: multi-step tool chain exhausted retries and fallback (like WorkflowError).
 * - System: LLM and all recovery tools failed (like SystemFailureError).
 */
class AgentWorkflowError extends AppError {
  constructor(step, message, opts = {}) {
    super("AGENT_WORKFLOW_FAILED", message, {
      userMessage:
        opts.userMessage ??
        "I ran into a problem while completing your request. Please try again, or provide a bit more detail.",
      retryable: opts.retryable ?? false,
      details: { step, ...opts.details },
      cause: opts.cause,
    });
    this.step = step;
  }
}

// -----------------------------------------------------------------------------
// Recovery utilities (timeouts, retries, classification)
// -----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label = "operation") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(
          new AppError("TIMEOUT", `${label} timed out after ${ms}ms`, {
            userMessage: "This is taking too long. Please try again.",
            retryable: true,
            details: { label, ms },
          }),
        );
      });
    }),
  ]).finally(() => clearTimeout(timeout));
}

function normalizeUnknownError(err) {
  if (err instanceof AppError) return err;

  return new AppError("UNKNOWN_ERROR", "Unknown error", {
    userMessage: "Something went wrong. Please try again.",
    retryable: false,
    details: { originalName: err?.name, originalMessage: err?.message },
    cause: err,
  });
}

function classifyError(err) {
  const error = normalizeUnknownError(err);
  return {
    error,
    retryable: error instanceof AppError && error.retryable,
    type: error.code,
  };
}

function isRetryable(err) {
  return classifyError(err).retryable;
}

function jitteredBackoffDelay(attempt, { baseDelayMs = 200, maxDelayMs = 3000 } = {}) {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jitter = crypto.randomInt(0, Math.max(1, Math.floor(exp * 0.25)));
  return exp + jitter;
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   retries?: number,
 *   baseDelayMs?: number,
 *   maxDelayMs?: number,
 *   label?: string,
 *   retryOn?: (err: any) => boolean
 * }} opts
 */
async function withRetries(fn, opts = {}) {
  const {
    retries = 2,
    baseDelayMs = 200,
    maxDelayMs = 3000,
    label = "operation",
    retryOn = isRetryable,
  } = opts;

  const maxAttempts = retries + 1;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !retryOn(err)) break;

      const delay = jitteredBackoffDelay(attempt, { baseDelayMs, maxDelayMs });
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }

  throw lastErr;
}

function formatUserFacingError(err, correlationId) {
  if (err instanceof AppError) {
    return `${err.userMessage}\n\n(Reference: ${correlationId})`;
  }

  return `Something went wrong. Please try again.\n\n(Reference: ${correlationId})`;
}

/**
 * Structured console output for workflow orchestration failures (easy to scan when debugging demos).
 * @param {AgentWorkflowError} err
 * @param {string} correlationId
 */
function printAgentWorkflowErrorBanner(err, correlationId) {
  const divider = "═".repeat(72);
  const rule = "─".repeat(72);
  const cause =
    err.cause instanceof Error
      ? `${err.cause.name}: ${err.cause.message}`
      : err.cause != null
        ? String(err.cause)
        : "(none)";

  console.error(`\n${divider}`);
  console.error(" AGENT WORKFLOW FAILED");
  console.error(divider);
  console.error(` Step:           ${err.step}`);
  console.error(` Code:           ${err.code}`);
  console.error(` Correlation ID: ${correlationId}`);
  console.error(` User-facing:    ${err.userMessage}`);
  console.error(rule);
  console.error(` Developer msg:  ${err.message}`);
  if (err.details && Object.keys(err.details).length > 0) {
    console.error(" Details:", err.details);
  }
  console.error(` Cause:          ${cause}`);
  console.error(`${divider}\n`);
}

// -----------------------------------------------------------------------------
// Tooling (simulate realistic tool failures + fallback)
// -----------------------------------------------------------------------------

/** Centralized deterministic demo rules (readable triggers for learners + tests). */
const SIMULATION = {
  forceNotFound: new Set(["u_999"]),
  /** Primary fails retryably; paired with fallback failure to surface AgentWorkflowError. */
  forcePrimaryAndFallbackFail: new Set(["u_777"]),
};

async function fetchUserFromPrimary({ userId }) {
  const r = Math.random();
  const id = String(userId);
  await sleep(80);

  if (SIMULATION.forceNotFound.has(id)) {
    throw new ToolExecutionError("fetchUserFromPrimary", "User not found", {
      retryable: false,
      userMessage: `I couldn’t find a user with id "${userId}". Check the id and try again.`,
      details: { userId },
    });
  }

  // Deterministic demo: primary always fails transiently so degraded mode can exercise fallback + AgentWorkflowError
  if (SIMULATION.forcePrimaryAndFallbackFail.has(id)) {
    throw new ToolExecutionError("fetchUserFromPrimary", "Primary service temporarily overloaded", {
      retryable: true,
      userMessage: "I couldn’t reach the user service just now. I’ll retry.",
      details: { userId, demo: true },
    });
  }

  if (r < 0.2) {
    throw new ToolExecutionError("fetchUserFromPrimary", "Network error while fetching user profile", {
      retryable: true,
      userMessage: "I couldn’t reach the user service just now. I’ll retry.",
      details: { userId },
    });
  }

  return {
    userId,
    name: "Alex Developer",
    role: "Software Engineer",
    lastLoginIso: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    source: "primary",
  };
}

async function fetchUserFromFallback({ userId }) {
  // Fallback tool: more reliable but lower fidelity
  const id = String(userId);
  await sleep(60);
  // Pairs with forcePrimaryAndFallbackFail: proves AgentWorkflowError when both paths fail
  if (SIMULATION.forcePrimaryAndFallbackFail.has(id)) {
    throw new ToolExecutionError("fetchUserFromFallback", "Fallback service unavailable", {
      retryable: false,
      userMessage: "The backup profile service is down. Try again later.",
      details: { userId, demo: true },
    });
  }
  return {
    userId,
    name: "Alex Developer",
    role: "Engineer",
    lastLoginIso: null,
    source: "fallback",
  };
}

// -----------------------------------------------------------------------------
// LLM + agent workflow (LLM -> tool -> response) with graceful ha
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16** (2025-11-03): **Resource cleanup order mentioned incorrectly in the Code Explanation Readme**
  *Symptoms*: <img width="1021" height="303" alt="Image" src="https://github.com/user-attachments/assets/6da7cdea-68f6-48b9-992f-717d378d2263" />  Hi! It seems the order mentioned [here](https://github.com/pguso/ai-agents-from-scratch/blob/main/intro/CODE.md#9-clean-up-resources) is the opposite what is being done in the code.
  **Post-Mortem & Fix Analysis**:
  > Hi! Thank you very much for reporting this issue. I fixed it in the mentioned example and also in oder code examples.

- **Issue #13** (2025-10-29): **Memory issues with simple-agent-with-memory.js**
  *Symptoms*: This is writing memory to ./agent-memory.json rather than ./simple-agent-with-memory/agent-memory.json (which is where the repo file is). maybe this is ok though?  It also doesn't appear to write facts with enough context: ``` "facts": [    {      "content": "Alex",      "timestamp": "2025-10-26T21:31:56.008Z"    }, ```  should probably be "content": "user_name: Alex"? I didn't have a chance to investigate why it's not giving context to the content it's writing there yet.  
  **Post-Mortem & Fix Analysis**:
  > Made some updates to this. Thank you some much for your detailed review! If you have time you could review my changes.

- **Issue #12** (2025-10-29): **Include the logs directory in the repo**
  *Symptoms*: Without the logs directory simple-agent.js will fail to run. Would probably be good to include it in the repo.
  **Post-Mortem & Fix Analysis**:
  > Fixed in commit https://github.com/pguso/ai-agents-from-scratch/commit/622a5036ba4c47975a776cd582305be848b7c93d

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

### Incident Patch 1: `757507c1` (2026-01-08)
**Commit Message**: fix download name

**File**: `.gitignore` (modified, +4/-1)
```diff
@@ -5,4 +5,7 @@ node_modules
 internal
 ui
 *.txt
-node-llama-docs
\ No newline at end of file
+node-llama-docs
+
+frontend*
+VIDEO_SCRIPT.md
\ No newline at end of file
```

**File**: `DOWNLOAD.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ Use `:Q6_K` for a good balance between size and accuracy (recommended default).
 Use `:Q5_K_S` for a smaller model that loads faster and uses less memory, but with slightly lower precision.
 
 ```
-npx --no node-llama-cpp pull --dir ./models hf:Qwen/Qwen3-1.7B-GGUF:Q8_0
+npx --no node-llama-cpp pull --dir ./models hf:Qwen/Qwen3-1.7B-GGUF:Q8_0 --filename Qwen3-1.7B-Q8_0.gguf
 ```
 
 ```
```

---

### Incident Patch 2: `9bb80b8f` (2025-11-20)
**Commit Message**: first capstone project - email classifier - fix

**File**: `tutorial/projects/01-smart-email-classifier/solution.js` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
  * Difficulty: ⭐⭐☆☆☆
  */
 
-import { SystemMessage, HumanMessage, AIMessage, Runnable, LlamaCppLLM } from '../../../src/index.js';
+import { SystemMessage, HumanMessage, Runnable, LlamaCppLLM } from '../../../src/index.js';
 import { BaseCallback } from '../../../src/utils/callbacks.js';
 import { readFileSync } from 'fs';
 
```

**File**: `tutorial/projects/01-smart-email-classifier/starter.js` (modified, +1/-1)
```diff
@@ -42,8 +42,8 @@ const CATEGORIES = {
 class EmailParserRunnable extends Runnable {
     async _call(input, config) {
         // TODO: Parse and structure the email
-        // Add timestamp
         // Validate required fields (subject, body, from)
+        // Add timestamp
         // Return structured email object
 
         return null; // Replace with your implementation
```

---

### Incident Patch 3: `59c04f56` (2025-11-06)
**Commit Message**: New: Build Your Own Agent Framework (Tutorial + Code)

**File**: `README.md` (modified, +152/-8)
```diff
@@ -15,7 +15,23 @@ This repository teaches you to build AI agents from first principles using **loc
 
 **Philosophy**: Learn by building. Understand deeply, then use frameworks wisely.
 
-## Getting Started
+## Next Phase: Build LangChain & LangGraph Concepts From Scratch
+
+After mastering the fundamentals, the next stage of this project walks you through **re-implementing the core parts of LangChain and LangGraph** in plain JavaScript using local models.
+
+You’ll learn how frameworks structure, compose, and orchestrate LLMs by building their internal ideas yourself, step by step:
+
+- **Runnable abstraction**, understand why everything revolves around it
+- **Message types**, structure and track conversations like real frameworks
+- **Chains and composition**, connect multiple Runnables
+- **Memory and context**, manage state across calls
+- **Tools and ReAct loops**, add reasoning and action-taking
+- **Graph logic**, explore how LangGraph handles stateful workflows
+
+This is **not** about building a new framework, it’s about understanding *how frameworks think*.  
+By the end, you’ll be able to read, debug, and extend LangChain or LangGraph code with confidence because you’ve built their building blocks yourself.
+
+## Phase 1: Agent Fundamentals - From LLMs to ReAct
 
 ### Prerequisites
 - Node.js 18+
@@ -235,7 +251,7 @@ Utility for debugging prompts sent to the LLM. Shows exactly what the model sees
 
 Usage example in `simple-agent/simple-agent.js`
 
-## ️ Project Structure
+## ️ Project Structure - Fundamentals
 
 ```
 ai-agents/
@@ -284,27 +300,155 @@ ai-agents/
 └── logs/                               ← Debug outputs
 ```
 
+## Phase 2: Building a Production Framework (Tutorial)
+
+After mastering the fundamentals above, **Phase 2** takes you from scratch examples to production-grade framework design. You'll rebuild core concepts from **LangChain** and **LangGraph** to understand how real frameworks work internally.
+
+### What You'll Build
+
+A lightweight but complete agent framework with:
+- **Runnable Interface**, The composability pattern that powers everything
+- **Message System**, Typed conversation structures (Human, AI, System, Tool)
+- **Chains**, Composing multiple operations into pipelines
+- **Memory**, Persistent state across conversations
+- **Tools**, Function calling and external integrations
+- **Agents**, Decision-making loops (ReAct, Tool-calling)
+- **Graphs**, State machines for complex workflows (LangGraph concepts)
+
+### Learning Approach
+
+**Tutorial-first**: Step-by-step lessons with exercises  
+**Implementation-driven**: Build each component yourself  
+**Framework-compatible**: Learn patterns used in LangChain.js
+
+### Structure Overview
+
+```
+tutorial/
+├── 01-foundation/              # 1. Core Abstractions
+│   ├── 01-runnable/
+│   │   ├── lesson.md           # Why Runnable matters
+│   │   ├── exercises/          # Hands-on practice
+│   │   └── solutions/          # Reference implementations
+│   ├── 02-messages/            # Structuring conversations
+│   ├── 03-llm-wrapper/         # Wrapping node-llama-cpp
+│   └── 04-context/             # Configuration & callbacks
+│
+├── 02-composition/             # 2. Building Chains
+│   ├── 01-prompts/             # Template system
+│   ├── 02-parsers/             # Structured outputs
+│   ├── 03-llm-chain/           # Your first chain
+│   ├── 04-piping/              # Composition patterns
+│   └── 05-memory/              # Conversation state
+│
+├── 03-agency/                  # 3. Tools & Agents
+│   ├── 01-tools/               # Function definitions
+│   ├── 02-tool-executor/       # Safe execution
+│   ├── 03-simple-agent/        # Basic agent loop
+│   ├── 04-react-agent/         # Reasoning + Acting
+│   └── 05-structured-agent/    # JSON mode
+│
+└── 04-graphs/                  # 4. State Machines
+    ├── 01-state-basics/        # Nodes & edges
+    ├── 02-channels/            # State management
+    ├── 03-conditional-edges/   # Dynamic routing
+    ├── 04-executor/            # Running workflows
+    ├── 05-checkpointing/       # Persistence
+    └── 06-agent-graph/         # Agents as graphs
+
+src/
+├── core/                       # Runnable, Messages, Context
+├── llm/                        # LlamaCppLLM wrapper
+├── prompts/                    # Template system
+├── chains/                     # LLMChain, SequentialChain
+├── tools/                      # BaseTool, built-in tools
+├── agents/                     # AgentExecutor, ReActAgent
+├── memory/                     # BufferMemory, WindowMemory
+└── graph/                      # StateGraph, CompiledGraph
+```
+
+### Why This Matters
+
+**Understanding beats using**: When you know how frameworks work internally, you can:
+- Debug issues faster
+- Customize behavior confidently
+- Make architectural decisions wisely
+- Build your own extensions
+- Read framework source code fluently
+
+**Learn once, use everywhere**: The patterns you'll learn 
```

**File**: `src/agents/agent-executor.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * AgentExecutor
+ *
+ * Main agent execution loop
+ *
+ * @module src/agents/agent-executor.js
+ */
+
+export class AgentExecutor {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('AgentExecutor not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default AgentExecutor;
```

**File**: `src/agents/base-agent.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * BaseAgent
+ *
+ * Abstract agent class
+ *
+ * @module src/agents/base-agent.js
+ */
+
+export class BaseAgent {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('BaseAgent not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default BaseAgent;
```

**File**: `src/agents/conversational-agent.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * ConversationalAgent
+ *
+ * Chat-optimized agent
+ *
+ * @module src/agents/conversational-agent.js
+ */
+
+export class ConversationalAgent {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('ConversationalAgent not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default ConversationalAgent;
```

**File**: `src/agents/index.js` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+/**
+ * Module exports
+ *
+ * @module src/agents/index.js
+ */
+
+export { BaseAgent } from './base-agent.js';
+export { AgentExecutor } from './agent-executor.js';
+export { ToolCallingAgent } from './tool-calling-agent.js';
+export { ReActAgent } from './react-agent.js';
+export { StructuredChatAgent } from './structured-chat-agent.js';
+export { ConversationalAgent } from './conversational-agent.js';
+
```

**File**: `src/agents/react-agent.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * ReActAgent
+ *
+ * Agent implementing ReAct pattern
+ *
+ * @module src/agents/react-agent.js
+ */
+
+export class ReActAgent {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('ReActAgent not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default ReActAgent;
```

**File**: `src/agents/structured-chat-agent.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * StructuredChatAgent
+ *
+ * Agent with structured JSON output
+ *
+ * @module src/agents/structured-chat-agent.js
+ */
+
+export class StructuredChatAgent {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('StructuredChatAgent not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default StructuredChatAgent;
```

**File**: `src/agents/tool-calling-agent.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * ToolCallingAgent
+ *
+ * Agent using function calling
+ *
+ * @module src/agents/tool-calling-agent.js
+ */
+
+export class ToolCallingAgent {
+  constructor(options = {}) {
+    // TODO: Implement constructor
+    throw new Error('ToolCallingAgent not yet implemented');
+  }
+
+  // TODO: Add methods
+}
+
+export default ToolCallingAgent;
```

---

### Incident Patch 4: `9937e7da` (2025-10-29)
**Commit Message**: Memory issues with simple-agent-with-memory.js #13

**File**: `simple-agent-with-memory/CODE.md` (modified, +152/-59)
```diff
@@ -1,68 +1,100 @@
 # Code Explanation: simple-agent-with-memory.js
 
-This example extends the simple agent with **persistent memory**, enabling it to remember information across sessions.
+This example extends the simple agent with **persistent memory**, enabling it to remember information across sessions while intelligently avoiding duplicate saves.
 
 ## Key Components
 
 ### 1. MemoryManager Import
 ```javascript
 import {MemoryManager} from "./memory-manager.js";
 ```
-Custom class for persisting agent memories to JSON files.
+Custom class for persisting agent memories to JSON files with unified memory storage.
 
 ### 2. Initialize Memory Manager
 ```javascript
 const memoryManager = new MemoryManager('./agent-memory.json');
 const memorySummary = await memoryManager.getMemorySummary();
 ```
 - Loads existing memories from file
-- Generates summary for system prompt
+- Generates formatted summary for system prompt
+- Handles migration from old memory schemas
 
-### 3. Memory-Aware System Prompt
+### 3. Memory-Aware System Prompt with Reasoning
 ```javascript
-const systemPrompt = `You are a helpful assistant with long-term memory.
-${memorySummary}
+const systemPrompt = `
+You are a helpful assistant with long-term memory.
+
+Before calling any function, always follow this reasoning process:
+
+1. **Compare** new user statements against existing memories below.
+2. **If the same key and value already exist**, do NOT call saveMemory again.
+   - Instead, simply acknowledge the known information.
+   - Example: if the user says "My name is Malua" and memory already says "user_name: Malua", reply "Yes, I remember your name is Malua."
+3. **If the user provides an updated value** (e.g., "I actually prefer sushi now"), 
+   then call saveMemory once to update the value.
+4. **Only call saveMemory for genuinely new information.**
+
+When saving new data, call saveMemory with structured fields:
+- type: "fact" or "preference"
+- key: short descriptive identifier (e.g., "user_name", "favorite_food")
+- value: the specific information (e.g., "Malua", "chinua")
+
+Examples:
+saveMemory({ type: "fact", key: "user_name", value: "Malua" })
+saveMemory({ type: "preference", key: "favorite_food", value: "chinua" })
 
-When the user shares important information about themselves, their preferences, or facts 
-they want you to remember, use the saveMemory function to store it.`;
+${memorySummary}
+`;
 ```
-- Includes existing memories in prompt
-- Instructs agent when to save new memories
+
+**What this does:**
+- Includes existing memories in the prompt
+- Provides explicit reasoning guidelines to prevent duplicate saves
+- Teaches the agent to compare before saving
+- Instructs when to update vs. acknowledge existing data
 
 ### 4. saveMemory Function
 ```javascript
 const saveMemory = defineChatSessionFunction({
-    description: "Save important information to long-term memory",
+    description: "Save important information to long-term memory (user preferences, facts, personal details)",
     params: {
         type: "object",
         properties: {
-            type: { type: "string", enum: ["fact", "preference"] },
-            content: { type: "string" },
-            key: { type: "string" }
+            type: {
+                type: "string",
+                enum: ["fact", "preference"]
+            },
+            key: { type: "string" },
+            value: { type: "string" }
         },
-        required: ["type", "content"]
+        required: ["type", "key", "value"]
     },
-    async handler(params) {
-        if (params.type === "fact") {
-            await memoryManager.addFact(params.content);
-        } else if (params.type === "preference") {
-            await memoryManager.addPreference(params.key, params.content);
-        }
-        return "Memory saved";
+    async handler({ type, key, value }) {
+        await memoryManager.addMemory({ type, key, value });
+        return `Memory saved: ${key} = ${value}`;
     }
 });
 ```
 
 **What it does:**
-- Saves facts (general information)
-- Saves preferences (key-value pairs)
+- Uses structured key-value format for all memories
+- Saves both facts and preferences with the same method
+- Automatically handles duplicates (updates if value changes)
 - Persists to JSON file
+- Returns confirmation message
+
+**Parameter Structure:**
+- `type`: Either "fact" or "preference"
+- `key`: Short identifier (e.g., "user_name", "favorite_food")
+- `value`: The actual information (e.g., "Alex", "pizza")
 
 ### 5. Example Conversation
 ```javascript
 const prompt1 = "Hi! My name is Alex and I love pizza.";
 const response1 = await session.prompt(prompt1, {functions});
-// Agent calls saveMemory to store this information
+// Agent calls saveMemory twice:
+// - saveMemory({ type: "fact", key: "user_name", value: "Alex" })
+// - saveMemory({ type: "preference", key: "favorite_food", value: "pizza" })
 
 const prompt2 = "What's my favorite food?";
 const response2 = aw
```

**File**: `simple-agent-with-memory/CONCEPT.md` (modified, +19/-9)
```diff
@@ -73,20 +73,30 @@ Available in future sessions
 **Facts**: General information
 ```json
 {
-  "facts": [
-    {"content": "User's name is Alex", "timestamp": "..."},
-    {"content": "User lives in Paris", "timestamp": "..."}
+  "memories": [
+    {
+      "type": "fact",
+      "key": "user_name",
+      "value": "Alex",
+      "source": "user",
+      "timestamp": "2025-10-29T11:22:57.372Z"
+    }
   ]
 }
 ```
 
-**Preferences**: Key-value pairs
+**Preferences**: 
 ```json
 {
-  "preferences": {
-    "favorite_color": "blue",
-    "favorite_food": "pizza"
-  }
+  "memories": [
+    {
+      "type": "preference",
+      "key": "favorite_food",
+      "value": "pizza",
+      "source": "user",
+      "timestamp": "2025-10-29T11:22:58.022Z"
+    }
+  ]
 }
 ```
 
@@ -98,7 +108,7 @@ Base Prompt:
 "You are a helpful assistant."
 
 Enhanced with Memory:
-"You are a helpful assistant.
+"You are a helpful assistant with long-term memory.
 
 === LONG-TERM MEMORY ===
 Known Facts:
```

**File**: `simple-agent-with-memory/agent-memory.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "memories": [],
+  "conversationHistory": []
+}
\ No newline at end of file
```

**File**: `simple-agent-with-memory/memory-manager.js` (modified, +103/-39)
```diff
@@ -1,6 +1,6 @@
 import fs from 'fs/promises';
 import path from 'path';
-import { fileURLToPath } from 'url';
+import {fileURLToPath} from 'url';
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
@@ -9,65 +9,129 @@ export class MemoryManager {
         this.memoryFilePath = path.resolve(__dirname, memoryFileName);
     }
 
-    // Load memories from the JSON file
     async loadMemories() {
         try {
             const data = await fs.readFile(this.memoryFilePath, 'utf-8');
-            return JSON.parse(data);
-        } catch (error) {
-            // If file doesn't exist, return empty memory
-            return {
-                facts: [],
-                preferences: {},
-                conversations: []
-            };
+            const json = JSON.parse(data);
+
+            // 🔧 Migrate old schema if needed
+            if (!json.memories) {
+                const upgraded = {memories: [], conversationHistory: []};
+
+                if (Array.isArray(json.facts)) {
+                    for (const f of json.facts) {
+                        upgraded.memories.push({
+                            type: 'fact',
+                            key: this.extractKey(f.content),
+                            value: this.extractValue(f.content),
+                            source: 'migration',
+                            timestamp: f.timestamp || new Date().toISOString()
+                        });
+                    }
+                }
+
+                if (json.preferences && typeof json.preferences === 'object') {
+                    for (const [key, val] of Object.entries(json.preferences)) {
+                        upgraded.memories.push({
+                            type: 'preference',
+                            key,
+                            value: this.extractValue(val),
+                            source: 'migration',
+                            timestamp: new Date().toISOString()
+                        });
+                    }
+                }
+
+                await this.saveMemories(upgraded);
+                return upgraded;
+            }
+
+            if (!Array.isArray(json.memories)) json.memories = [];
+            if (!Array.isArray(json.conversationHistory)) json.conversationHistory = [];
+
+            return json;
+        } catch {
+            return {memories: [], conversationHistory: []};
         }
     }
 
-    // Save new memories to the JSON file
     async saveMemories(memories) {
-        await fs.writeFile(
-            this.memoryFilePath,
-            JSON.stringify(memories, null, 2)
-        );
+        await fs.writeFile(this.memoryFilePath, JSON.stringify(memories, null, 2));
     }
 
-    // Add a specific fact
-    async addFact(fact) {
-        const memories = await this.loadMemories();
-        memories.facts.push({
-            content: fact,
-            timestamp: new Date().toISOString()
-        });
-        await this.saveMemories(memories);
-    }
+    // Add or update memory without duplicates
+    async addMemory({type, key, value, source = 'user'}) {
+        const data = await this.loadMemories();
+
+        // Normalize for comparison
+        const normType = type.trim().toLowerCase();
+        const normKey = key.trim().toLowerCase();
+        const normValue = value.trim();
+
+        // Check if same key+type already exists
+        const existingIndex = data.memories.findIndex(
+            m => m.type === normType && m.key.toLowerCase() === normKey
+        );
 
-    // Add a user preference
-    async addPreference(key, value) {
-        const memories = await this.loadMemories();
-        memories.preferences[key] = value;
-        await this.saveMemories(memories);
+        if (existingIndex >= 0) {
+            const existing = data.memories[existingIndex];
+            // Update value if changed
+            if (existing.value !== normValue) {
+                existing.value = normValue;
+                existing.timestamp = new Date().toISOString();
+                existing.source = source;
+                console.log(`Updated memory: ${normKey} → ${normValue}`);
+            } else {
+                console.log(`Skipped duplicate memory: ${normKey}`);
+            }
+        } else {
+            // Add new memory
+            data.memories.push({
+                type: normType,
+                key: normKey,
+                value: normValue,
+                source,
+                timestamp: new Date().toISOString()
+            });
+            console.log(`Added memory: ${normKey} = ${normValue}`);
+        }
+
+        await this.saveMemories(data);
     }
 
-    // Get a summary of all memories for the system prompt
     async getMemorySummary() {
-        const memories = await this.loadMemories();
+        const data = await this.loadMemories();
+        const facts = Array.isArray(data.memories)
+            ? data.memories.filter(m => m.type === 'fact')
+            : [];
+
```

**File**: `simple-agent-with-memory/simple-agent-with-memory.js` (modified, +30/-24)
```diff
@@ -17,11 +17,30 @@ const memoryManager = new MemoryManager('./agent-memory.json');
 // Load existing memories and add to system prompt
 const memorySummary = await memoryManager.getMemorySummary();
 
-const systemPrompt = `You are a helpful assistant with long-term memory.
-${memorySummary}
+const systemPrompt = `
+You are a helpful assistant with long-term memory.
+
+Before calling any function, always follow this reasoning process:
+
+1. **Compare** new user statements against existing memories below.
+2. **If the same key and value already exist**, do NOT call saveMemory again.
+   - Instead, simply acknowledge the known information.
+   - Example: if the user says "My name is Malua" and memory already says "user_name: Malua", reply "Yes, I remember your name is Malua."
+3. **If the user provides an updated value** (e.g., "I actually prefer sushi now"), 
+   then call saveMemory once to update the value.
+4. **Only call saveMemory for genuinely new information.**
 
-When the user shares important information about themselves, their preferences, or facts 
-they want you to remember, use the saveMemory function to store it.`;
+When saving new data, call saveMemory with structured fields:
+- type: "fact" or "preference"
+- key: short descriptive identifier (e.g., "user_name", "favorite_food")
+- value: the specific information (e.g., "Malua", "chinua")
+
+Examples:
+saveMemory({ type: "fact", key: "user_name", value: "Malua" })
+saveMemory({ type: "preference", key: "favorite_food", value: "chinua" })
+
+${memorySummary}
+`;
 
 const session = new LlamaChatSession({
     contextSequence: context.getSequence(),
@@ -36,29 +55,16 @@ const saveMemory = defineChatSessionFunction({
         properties: {
             type: {
                 type: "string",
-                enum: ["fact", "preference"],
-                description: "Type of memory to save"
-            },
-            content: {
-                type: "string",
-                description: "The information to remember"
+                enum: ["fact", "preference"]
             },
-            key: {
-                type: "string",
-                description: "For preferences: the preference key (e.g., 'favorite_color')"
-            }
+            key: { type: "string" },
+            value: { type: "string" }
         },
-        required: ["type", "content"]
+        required: ["type", "key", "value"]
     },
-    async handler(params) {
-        if (params.type === "fact") {
-            await memoryManager.addFact(params.content);
-            return "Fact saved to memory";
-        } else if (params.type === "preference") {
-            const key = params.key || params.content.split(' ')[0];
-            await memoryManager.addPreference(key, params.content);
-            return "Preference saved to memory";
-        }
+    async handler({ type, key, value }) {
+        await memoryManager.addMemory({ type, key, value });
+        return `Memory saved: ${key} = ${value}`;
     }
 });
 
```

---

### Incident Patch 5: `fdfb6114` (2025-10-29)
**Commit Message**: Memory issues with simple-agent-with-memory.js #13

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 models
 node_modules
 .idea
-.env
\ No newline at end of file
+.env
+internal
\ No newline at end of file
```

**File**: `simple-agent-with-memory/agent-memory.json` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-{
-  "facts": [],
-  "preferences": {
-    "favorite_food": "pizza"
-  },
-  "conversations": []
-}
\ No newline at end of file
```

**File**: `simple-agent-with-memory/memory-manager.js` (modified, +5/-2)
```diff
@@ -1,9 +1,12 @@
 import fs from 'fs/promises';
 import path from 'path';
+import { fileURLToPath } from 'url';
+
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
 export class MemoryManager {
-    constructor(memoryFilePath = './memory.json') {
-        this.memoryFilePath = memoryFilePath;
+    constructor(memoryFileName = './memory.json') {
+        this.memoryFilePath = path.resolve(__dirname, memoryFileName);
     }
 
     // Load memories from the JSON file
```

---

### Incident Patch 6: `1b57bb2f` (2025-10-27)
**Commit Message**: minor fix

**File**: `.env.example` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+OPENAI_API_KEY=your_api_key_here
\ No newline at end of file
```

**File**: `openai-intro/CODE.md` (modified, +7/-0)
```diff
@@ -14,6 +14,13 @@ https://platform.openai.com/api-keys
 
 https://platform.openai.com/settings/organization/billing/overview
 
+### Configure environment variables
+
+```bash
+   cp .env.example .env
+```
+Then edit `.env` and add your actual API key.
+
 ## Setup and Initialization
 
 ```javascript
```

---

### Incident Patch 7: `6a911891` (2025-10-27)
**Commit Message**: fix sorting

**File**: `README.md` (modified, +7/-7)
```diff
@@ -61,7 +61,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 2. **Translation** - System Prompts & Specialization
+### 3. **Translation** - System Prompts & Specialization
 `translation/` | [Code Explanation](translation/CODE.md) | [Concepts](translation/CONCEPT.md)
 
 **What you'll learn:**
@@ -74,7 +74,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 3. **Think** - Reasoning & Problem Solving
+### 4. **Think** - Reasoning & Problem Solving
 `think/` | [Code Explanation](think/CODE.md) | [Concepts](think/CONCEPT.md)
 
 **What you'll learn:**
@@ -87,7 +87,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 4. **Batch** - Parallel Processing
+### 5. **Batch** - Parallel Processing
 `batch/` | [Code Explanation](batch/CODE.md) | [Concepts](batch/CONCEPT.md)
 
 **What you'll learn:**
@@ -100,7 +100,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 5. **Coding** - Streaming & Response Control
+### 6. **Coding** - Streaming & Response Control
 `coding/` | [Code Explanation](coding/CODE.md) | [Concepts](coding/CONCEPT.md)
 
 **What you'll learn:**
@@ -113,7 +113,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 6. **Simple Agent** - Function Calling (Tools)
+### 7. **Simple Agent** - Function Calling (Tools)
 `simple-agent/` | [Code Explanation](simple-agent/CODE.md) | [Concepts](simple-agent/CONCEPT.md)
 
 **What you'll learn:**
@@ -128,7 +128,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 7. **Simple Agent with Memory** - Persistent State
+### 8. **Simple Agent with Memory** - Persistent State
 `simple-agent-with-memory/` | [Code Explanation](simple-agent-with-memory/CODE.md) | [Concepts](simple-agent-with-memory/CONCEPT.md)
 
 **What you'll learn:**
@@ -141,7 +141,7 @@ Follow these examples in order to build understanding progressively:
 
 ---
 
-### 8. **ReAct Agent** - Reasoning + Acting
+### 9. **ReAct Agent** - Reasoning + Acting
 `react-agent/` | [Code Explanation](react-agent/CODE.md) | [Concepts](react-agent/CONCEPT.md)
 
 **What you'll learn:**
```

---

### Incident Patch 8: `621799ea` (2025-10-23)
**Commit Message**: minor fix

**File**: `NOTE.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-restructure everything into seperate folders, each javascript file gets its own folder with two markdown
-files. one that explains the code and one that has some conceptional information like diagrams or a high level
-overview
\ No newline at end of file
```

---

### Incident Patch 9: `4436852b` (2025-10-23)
**Commit Message**: minor fix

**File**: `batch/CODE.md` (modified, +0/-23)
```diff
@@ -140,17 +140,6 @@ console.log("AI: " + a2);
 - Outputs both question-answer pairs
 - Results appear in order despite parallel processing
 
-### Why No Cleanup?
-
-Notice there's no `dispose()` calls at the end. In a production system, you should add:
-```javascript
-llama.dispose();
-model.dispose();
-context.dispose();
-session1.dispose();
-session2.dispose();
-```
-
 ## Key Concepts Demonstrated
 
 ### 1. Parallel Processing
@@ -188,18 +177,6 @@ A context can hold multiple independent sequences:
 └─────────────────────────────────────┘
 ```
 
-### 3. Batch Processing
-The `batchSize` parameter optimizes GPU usage:
-
-```
-Without batching:      With batching (1024 tokens):
-Token → GPU           Tokens 1-1024 → GPU
-Token → GPU           (Single batch)
-Token → GPU           
-...                   Much faster!
-(Inefficient)
-```
-
 ## Performance Comparison
 
 ### Sequential Execution
```

**File**: `batch/batch.js` (modified, +7/-1)
```diff
@@ -47,4 +47,10 @@ console.log("User: " + q1);
 console.log("AI: " + a1);
 
 console.log("User: " + q2);
-console.log("AI: " + a2);
\ No newline at end of file
+console.log("AI: " + a2);
+
+llama.dispose();
+model.dispose();
+context.dispose();
+session1.dispose();
+session2.dispose();
\ No newline at end of file
```

**File**: `react-agent/CONCEPT.md` (modified, +372/-0)
```diff
@@ -0,0 +1,372 @@
+# Concept: ReAct Pattern for AI Agents
+
+## What is ReAct?
+
+**ReAct** (Reasoning + Acting) is a framework that combines:
+- **Reasoning**: Thinking through problems step-by-step
+- **Acting**: Using tools to accomplish subtasks
+- **Observing**: Learning from tool results
+
+This creates agents that can solve complex, multi-step problems reliably.
+
+## The Core Pattern
+
+```
+┌─────────────┐
+│   Problem   │
+└──────┬──────┘
+       │
+       ▼
+┌─────────────────────────────────────┐
+│          ReAct Loop                 │
+│                                     │
+│  ┌──────────────────────────────┐  │
+│  │  1. THOUGHT                  │  │
+│  │  "What do I need to do?"     │  │
+│  └─────────────┬────────────────┘  │
+│                ▼                    │
+│  ┌──────────────────────────────┐  │
+│  │  2. ACTION                   │  │
+│  │  Call tool with parameters   │  │
+│  └─────────────┬────────────────┘  │
+│                ▼                    │
+│  ┌──────────────────────────────┐  │
+│  │  3. OBSERVATION              │  │
+│  │  Receive tool result         │  │
+│  └─────────────┬────────────────┘  │
+│                │                    │
+│                └──► Repeat or      │
+│                     Final Answer   │
+└─────────────────────────────────────┘
+```
+
+## Why ReAct Matters
+
+### Traditional LLMs Struggle With:
+1. **Complex calculations** - arithmetic errors
+2. **Multi-step problems** - lose track of progress
+3. **Using tools** - don't know when/how
+4. **Explaining decisions** - black box reasoning
+
+### ReAct Solves This:
+1. **Reliable calculations** - delegates to tools
+2. **Structured progress** - explicit steps
+3. **Tool orchestration** - knows when to use what
+4. **Transparent reasoning** - visible thought process
+
+## The Three Components
+
+### 1. Thought (Reasoning)
+
+The agent reasons about:
+- What information is needed
+- Which tool to use
+- Whether the result makes sense
+- What to do next
+
+Example:
+```
+Thought: I need to calculate 15 × 8 to find revenue
+```
+
+### 2. Action (Tool Use)
+
+The agent calls a tool with specific parameters:
+
+Example:
+```
+Action: multiply(15, 8)
+```
+
+### 3. Observation (Learning)
+
+The agent receives and interprets the tool result:
+
+Example:
+```
+Observation: 120
+```
+
+## Complete Example
+
+```
+Problem: "If 15 items cost $8 each and 20 items cost $8 each, 
+          what's the total revenue?"
+
+Thought: First I need to calculate revenue from 15 items
+Action: multiply(15, 8)
+Observation: 120
+
+Thought: Now I need revenue from 20 items
+Action: multiply(20, 8)
+Observation: 160
+
+Thought: Now I add both revenues
+Action: add(120, 160)
+Observation: 280
+
+Thought: I have the final answer
+Answer: The total revenue is $280
+```
+
+## Key Benefits
+
+### 1. Reliability
+- Tools provide accurate results
+- No arithmetic mistakes
+- Verifiable calculations
+
+### 2. Transparency
+- See each reasoning step
+- Understand decision-making
+- Debug easily
+
+### 3. Scalability
+- Handle complex problems
+- Break into manageable steps
+- Add more tools as needed
+
+### 4. Flexibility
+- Works with any tools
+- Adapts to problem complexity
+- Self-corrects when needed
+
+## Comparison with Other Approaches
+
+### Zero-Shot Prompting
+```
+User: "Calculate 15×8 + 20×8"
+LLM: "The answer is 279"  ❌ Wrong!
+```
+**Problem**: LLM calculates in head, makes errors
+
+### Chain-of-Thought
+```
+User: "Calculate 15×8 + 20×8"
+LLM: "Let me think step by step:
+     15×8 = 120
+     20×8 = 160
+     120+160 = 279"  ❌ Still wrong!
+```
+**Problem**: Shows work but still miscalculates
+
+### ReAct (This Implementation)
+```
+User: "Calculate 15×8 + 20×8"
+Agent:
+  Thought: Calculate 15×8
+  Action: multiply(15, 8)
+  Observation: 120
+  
+  Thought: Calculate 20×8
+  Action: multiply(20, 8)
+  Observation: 160
+  
+  Thought: Add results
+  Action: add(120, 160)
+  Observation: 280
+  
+  Answer: 280  ✅ Correct!
+```
+**Success**: Uses tools, gets accurate results
+
+## Architecture Diagram
+
+```
+┌──────────────────────────────────────┐
+│          User Question               │
+└──────────────┬───────────────────────┘
+               │
+               ▼
+┌──────────────────────────────────────┐
+│      LLM with ReAct Prompt           │
+│                                      │
+│  "Think, Act, Observe pattern"       │
+└──────┬───────────────────────────────┘
+       │
+       ├──► Generates: "Thought: ..."
+       │
+       ├──► Generates: "Action: tool(params)"
+       │         │
+       │         ▼
+       │    ┌─────────────────┐
+       │    │  Tool Executor  │
+       │    │                 │
+       │    │  - multiply()   │
+       │    │  - add()        │
+       │    │  - divide()     │
+       │    │  - subtract()   │
+       │    └─────────┬───────┘
+       │              │
+       │              ▼
+       └───────── "Observation: result"
+       │
+       ├──► Next iteration or Final
```

---

### Incident Patch 10: `478e1b5b` (2025-10-23)
**Commit Message**: minor fix

**File**: `README.md` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+# AI Agents From Scratch
+
+Learn to build AI agents locally without frameworks. Understand what happens under the hood before using production frameworks.
+
+## 🎯 Purpose
+
+This repository teaches you to build AI agents from first principles using **local LLMs** and **node-llama-cpp**. By working through these examples, you'll understand:
+
+- How LLMs work at a fundamental level
+- What agents really are (LLM + tools + patterns)
+- How different agent architectures function
+- Why frameworks make certain design choices
+
+**Philosophy**: Learn by building. Understand deeply, then use frameworks wisely.
+
+## 🚀 Getting Started
+
+### Prerequisites
+- Node.js 18+
+- At least 8GB RAM (16GB recommended)
+- Download models and place in `./models/` folder, details in [DOWNLOAD.md](DOWNLOAD.md)
+
+### Installation
+```bash
+npm install
+```
+
+### Run Examples
+```bash
+node intro/intro.js
+node simple-agent/simple-agent.js
+node react-agent/react-agent.js
+```
+
+## 📚 Learning Path
+
+Follow these examples in order to build understanding progressively:
+
+### 1. **Introduction** - Basic LLM Interaction
+📁 `intro/` | [Code Explanation](intro/CODE.md) | [Concepts](intro/CONCEPT.md)
+
+**What you'll learn:**
+- Loading and running a local LLM
+- Basic prompt/response cycle
+
+**Key concepts**: Model loading, context, inference pipeline, token generation
+
+---
+
+### 2. **Translation** - System Prompts & Specialization
+📁 `translation/` | [Code Explanation](translation/CODE.md) | [Concepts](translation/CONCEPT.md)
+
+**What you'll learn:**
+- Using system prompts to specialize agents
+- Output format control
+- Role-based behavior
+- Chat wrappers for different models
+
+**Key concepts**: System prompts, agent specialization, behavioral constraints, prompt engineering
+
+---
+
+### 3. **Think** - Reasoning & Problem Solving
+📁 `think/` | [Code Explanation](think/CODE.md) | [Concepts](think/CONCEPT.md)
+
+**What you'll learn:**
+- Configuring LLMs for logical reasoning
+- Complex quantitative problems
+- Limitations of pure LLM reasoning
+- When to use external tools
+
+**Key concepts**: Reasoning agents, problem decomposition, cognitive tasks, reasoning limitations
+
+---
+
+### 4. **Batch** - Parallel Processing
+📁 `batch/` | [Code Explanation](batch/CODE.md) | [Concepts](batch/CONCEPT.md)
+
+**What you'll learn:**
+- Processing multiple requests concurrently
+- Context sequences for parallelism
+- GPU batch processing
+- Performance optimization
+
+**Key concepts**: Parallel execution, sequences, batch size, throughput optimization
+
+---
+
+### 5. **Coding** - Streaming & Response Control
+📁 `coding/` | [Code Explanation](coding/CODE.md) | [Concepts](coding/CONCEPT.md)
+
+**What you'll learn:**
+- Real-time streaming responses
+- Token limits and budget management
+- Progressive output display
+- User experience optimization
+
+**Key concepts**: Streaming, token-by-token generation, response control, real-time feedback
+
+---
+
+### 6. **Simple Agent** - Function Calling (Tools)
+📁 `simple-agent/` | [Code Explanation](simple-agent/CODE.md) | [Concepts](simple-agent/CONCEPT.md)
+
+**What you'll learn:**
+- Function calling / tool use fundamentals
+- Defining tools the LLM can use
+- JSON Schema for parameters
+- How LLMs decide when to use tools
+
+**Key concepts**: Function calling, tool definitions, agent decision making, action-taking
+
+**⭐ This is where text generation becomes agency!**
+
+---
+
+### 7. **Simple Agent with Memory** - Persistent State
+📁 `simple-agent-with-memory/` | [Code Explanation](simple-agent-with-memory/CODE.md) | [Concepts](simple-agent-with-memory/CONCEPT.md)
+
+**What you'll learn:**
+- Persisting information across sessions
+- Long-term memory management
+- Facts and preferences storage
+- Memory retrieval strategies
+
+**Key concepts**: Persistent memory, state management, memory systems, context augmentation
+
+---
+
+### 8. **ReAct Agent** - Reasoning + Acting
+📁 `react-agent/` | [Code Explanation](react-agent/CODE.md) | [Concepts](react-agent/CONCEPT.md)
+
+**What you'll learn:**
+- ReAct pattern (Reason → Act → Observe)
+- Iterative problem solving
+- Step-by-step tool use
+- Self-correction loops
+
+**Key concepts**: ReAct pattern, iterative reasoning, observation-action cycles, multi-step agents
+
+**⭐ This is the foundation of modern agent frameworks!**
+
+---
+
+## 📖 Documentation Structure
+
+Each example folder contains:
+
+- **`<name>.js`** - The working code example
+- **`CODE.md`** - Step-by-step code explanation
+  - Line-by-line breakdowns
+  - What each part does
+  - How it works
+- **`CONCEPT.md`** - High-level concepts
+  - Why it matters for agents
+  - Architectural patterns
+  - Real-world applications
+  - Simple diagrams
+
+## 🧠 Core Concepts
+
+### What is an AI Agent?
+
+```
+AI Agent = LLM + System Prompt + Tools + Memory + Reasoning Pattern
+           ─┬─   ──────┬──────   ──┬──   ──┬───   ────────┬────────
+          
```

**File**: `batch/CODE.md` (added, +346/-0)
```diff
@@ -0,0 +1,346 @@
+# Code Explanation: batch.js
+
+This file demonstrates **parallel execution** of multiple LLM prompts using separate context sequences, enabling concurrent processing for better performance.
+
+## Step-by-Step Code Breakdown
+
+### 1. Import and Setup (Lines 1-10)
+```javascript
+import {getLlama, LlamaChatSession} from "node-llama-cpp";
+import path from "path";
+import {fileURLToPath} from "url";
+
+/**
+ * Asynchronous execution improves performance in GAIA benchmarks,
+ * multi-agent applications, and other high-throughput scenarios.
+ */
+
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
+```
+- Standard imports for LLM interaction
+- Comment explains the performance benefit
+- **GAIA benchmark**: A standard for testing AI agent performance
+- Useful for multi-agent systems that need to handle many requests
+
+### 2. Model Path Configuration (Lines 11-16)
+```javascript
+const modelPath = path.join(
+    __dirname,
+    "../",
+    "models",
+    "DeepSeek-R1-0528-Qwen3-8B-Q6_K.gguf"
+)
+```
+- Uses **DeepSeek-R1**: An 8B parameter model optimized for reasoning
+- **Q6_K quantization**: Balance between quality and size
+- Model is loaded once and shared between sequences
+
+### 3. Initialize Llama and Load Model (Lines 18-19)
+```javascript
+const llama = await getLlama();
+const model = await llama.loadModel({modelPath});
+```
+- Standard initialization
+- Model is loaded into memory once
+- Will be used by multiple sequences simultaneously
+
+### 4. Create Context with Multiple Sequences (Lines 20-23)
+```javascript
+const context = await model.createContext({
+    sequences: 2,
+    batchSize: 1024 // The number of tokens that can be processed at once by the GPU.
+});
+```
+
+**Key parameters:**
+
+- **sequences: 2**: Creates 2 independent conversation sequences
+  - Each sequence has its own conversation history
+  - Both share the same model and context memory pool
+  - Can be processed in parallel
+
+- **batchSize: 1024**: Maximum tokens processed per GPU batch
+  - Larger = better GPU utilization
+  - Smaller = lower memory usage
+  - 1024 is a good balance for most GPUs
+
+### Why Multiple Sequences?
+
+```
+Single Sequence (Sequential)     Multiple Sequences (Parallel)
+─────────────────────────       ──────────────────────────────
+Process Prompt 1 → Response 1    Process Prompt 1 ──┐
+Wait...                                              ├→ Both responses
+Process Prompt 2 → Response 2    Process Prompt 2 ──┘   in parallel!
+
+Total Time: T1 + T2              Total Time: max(T1, T2)
+```
+
+### 5. Get Individual Sequences (Lines 25-26)
+```javascript
+const sequence1 = context.getSequence();
+const sequence2 = context.getSequence();
+```
+- Retrieves two separate sequence objects from the context
+- Each sequence maintains its own state
+- They can be used independently for different conversations
+
+### 6. Create Separate Sessions (Lines 28-33)
+```javascript
+const session1 = new LlamaChatSession({
+    contextSequence: sequence1
+});
+const session2 = new LlamaChatSession({
+    contextSequence: sequence2
+});
+```
+- Creates a chat session for each sequence
+- Each session has its own conversation history
+- Sessions are completely independent
+- No system prompts in this example (could be added)
+
+### 7. Define Questions (Lines 35-36)
+```javascript
+const q1 = "Hi there, how are you?";
+const q2 = "How much is 6+6?";
+```
+- Two completely different questions
+- Will be processed simultaneously
+- Different types: conversational vs. computational
+
+### 8. Parallel Execution with Promise.all (Lines 38-44)
+```javascript
+const [
+    a1,
+    a2
+] = await Promise.all([
+    session1.prompt(q1),
+    session2.prompt(q2)
+]);
+```
+
+**How this works:**
+
+1. `session1.prompt(q1)` starts asynchronously
+2. `session2.prompt(q2)` starts asynchronously (doesn't wait for #1)
+3. `Promise.all()` waits for BOTH to complete
+4. Returns results in array: [response1, response2]
+5. Destructures into `a1` and `a2`
+
+**Key benefit**: Both prompts are processed at the same time, not one after another!
+
+### 9. Display Results (Lines 46-50)
+```javascript
+console.log("User: " + q1);
+console.log("AI: " + a1);
+
+console.log("User: " + q2);
+console.log("AI: " + a2);
+```
+- Outputs both question-answer pairs
+- Results appear in order despite parallel processing
+
+### Why No Cleanup?
+
+Notice there's no `dispose()` calls at the end. In a production system, you should add:
+```javascript
+llama.dispose();
+model.dispose();
+context.dispose();
+session1.dispose();
+session2.dispose();
+```
+
+## Key Concepts Demonstrated
+
+### 1. Parallel Processing
+Instead of:
+```javascript
+// Sequential (slow)
+const a1 = await session1.prompt(q1);  // Wait
+const a2 = await session2.prompt(q2);  // Wait again
+```
+
+We use:
+```javascript
+// Parallel (fast)
+const [a1, a2] = await Promise.all([
+    session1.prompt(q1),
+    session2.prompt(q2)
+]);
+```
+
+### 2. Conte
```

**File**: `batch/CONCEPT.md` (added, +365/-0)
```diff
@@ -0,0 +1,365 @@
+# Concept: Parallel Processing & Performance Optimization
+
+## Overview
+
+This example demonstrates **concurrent execution** of multiple LLM requests using separate context sequences, a critical technique for building scalable AI agent systems.
+
+## The Performance Problem
+
+### Sequential Processing (Slow)
+
+Traditional approach processes one request at a time:
+
+```
+Request 1 ────────→ Response 1 (2s)
+                        ↓
+                    Request 2 ────────→ Response 2 (2s)
+                                            ↓
+                                        Total: 4 seconds
+```
+
+### Parallel Processing (Fast)
+
+This example processes multiple requests simultaneously:
+
+```
+Request 1 ────────→ Response 1 (2s) ──┐
+                                       ├→ Total: 2 seconds
+Request 2 ────────→ Response 2 (2s) ──┘
+     (Both running at the same time)
+```
+
+**Performance gain: 2x speedup!**
+
+## Core Concept: Context Sequences
+
+### Single vs. Multiple Sequences
+
+```
+┌────────────────────────────────────────────────┐
+│              Model (Loaded Once)               │
+├────────────────────────────────────────────────┤
+│                   Context                      │
+│  ┌──────────────┐          ┌──────────────┐   │
+│  │  Sequence 1  │          │  Sequence 2  │   │
+│  │              │          │              │   │
+│  │ Conversation │          │ Conversation │   │
+│  │  History A   │          │  History B   │   │
+│  └──────────────┘          └──────────────┘   │
+└────────────────────────────────────────────────┘
+```
+
+**Key insights:**
+- Model weights are shared (memory efficient)
+- Each sequence has independent history
+- Sequences can process in parallel
+- Both use the same underlying model
+
+## How Parallel Processing Works
+
+### Promise.all Pattern
+
+JavaScript's `Promise.all()` enables concurrent execution:
+
+```
+Sequential:
+────────────────────────────────────
+await fn1();  // Wait 2s
+await fn2();  // Wait 2s more
+Total: 4s
+
+Parallel:
+────────────────────────────────────
+await Promise.all([
+    fn1(),    // Start immediately
+    fn2()     // Start immediately (don't wait!)
+]);
+Total: 2s (whichever finishes last)
+```
+
+### Execution Timeline
+
+```
+Time →  0s      1s      2s      3s      4s
+        │       │       │       │       │
+Seq 1:  ├───────Processing───────┤
+        │                        └─ Response 1
+        │
+Seq 2:  ├───────Processing───────┤
+                                 └─ Response 2
+                                 
+        Both complete at ~2s instead of 4s!
+```
+
+## GPU Batch Processing
+
+### Why Batching Matters
+
+Modern GPUs process multiple operations efficiently:
+
+```
+Without Batching (Inefficient)
+──────────────────────────────
+GPU: [Token 1] ... wait ...
+GPU: [Token 2] ... wait ...
+GPU: [Token 3] ... wait ...
+     └─ GPU underutilized
+
+With Batching (Efficient)
+─────────────────────────
+GPU: [Tokens 1-1024]  ← Full batch
+     └─ GPU fully utilized!
+```
+
+**batchSize parameter**: Controls how many tokens process together.
+
+### Trade-offs
+
+```
+Small Batch (e.g., 128)     Large Batch (e.g., 2048)
+───────────────────────     ────────────────────────
+✓ Lower memory              ✓ Better GPU utilization
+✓ More flexible             ✓ Faster throughput
+✗ Slower throughput         ✗ Higher memory usage
+✗ GPU underutilized         ✗ May exceed VRAM
+```
+
+**Sweet spot**: Usually 512-1024 for consumer GPUs.
+
+## Architecture Patterns
+
+### Pattern 1: Multi-User Service
+
+```
+┌─────────┐  ┌─────────┐  ┌─────────┐
+│ User A  │  │ User B  │  │ User C  │
+└────┬────┘  └────┬────┘  └────┬────┘
+     │            │            │
+     └────────────┼────────────┘
+                  ↓
+         ┌────────────────┐
+         │  Load Balancer │
+         └────────────────┘
+                  ↓
+     ┌────────────┼────────────┐
+     ↓            ↓            ↓
+┌─────────┐  ┌─────────┐  ┌─────────┐
+│  Seq 1  │  │  Seq 2  │  │  Seq 3  │
+└─────────┘  └─────────┘  └─────────┘
+     └────────────┼────────────┘
+                  ↓
+         ┌────────────────┐
+         │  Shared Model  │
+         └────────────────┘
+```
+
+### Pattern 2: Multi-Agent System
+
+```
+         ┌──────────────┐
+         │     Task     │
+         └──────┬───────┘
+                │
+       ┌────────┼────────┐
+       ↓        ↓        ↓
+  ┌────────┐ ┌──────┐ ┌──────────┐
+  │Planner │ │Critic│ │ Executor │
+  │ Agent  │ │Agent │ │  Agent   │
+  └───┬────┘ └──┬───┘ └────┬─────┘
+      │         │          │
+      └─────────┼──────────┘
+                ↓
+       (All run in parallel)
+```
+
+### Pattern 3: Pipeline Processing
+
+```
+Input Queue: [Task1, Task2, Task3, ...]
+                    ↓
+            ┌───────────────┐
+            │  Dispatcher   │
+            └───────────────┘
+                    ↓
+        ┌───────────┼───────────┐
+        ↓           ↓           ↓
+    Sequence 1
```

**File**: `batch/batch.js` (renamed, +3/-2)
```diff
@@ -3,13 +3,14 @@ import path from "path";
 import {fileURLToPath} from "url";
 
 /**
- * asynchronous execution is used in GAIA benchmark testing, multi-agent application,
- * and other scenarios where efficiency and throughput are important
+ * Asynchronous execution improves performance in GAIA benchmarks,
+ * multi-agent applications, and other high-throughput scenarios.
  */
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 const modelPath = path.join(
     __dirname,
+    "../",
     "models",
     "DeepSeek-R1-0528-Qwen3-8B-Q6_K.gguf"
 )
```

**File**: `coding/CODE.md` (added, +327/-0)
```diff
@@ -0,0 +1,327 @@
+# Code Explanation: coding.js
+
+This file demonstrates **streaming responses** with token limits and real-time output, showing how to get immediate feedback from the LLM as it generates text.
+
+## Step-by-Step Code Breakdown
+
+### 1. Import and Setup (Lines 1-8)
+```javascript
+import {
+    getLlama,
+    LlamaChatSession,
+} from "node-llama-cpp";
+import {fileURLToPath} from "url";
+import path from "path";
+
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
+```
+Standard setup for LLM interaction.
+
+### 2. Load Model (Lines 10-18)
+```javascript
+const llama = await getLlama();
+const model = await llama.loadModel({
+    modelPath: path.join(
+        __dirname,
+        "../",
+        "models",
+        "hf_giladgd_gpt-oss-20b.MXFP4.gguf"
+    )
+});
+```
+- Uses **gpt-oss-20b**: A 20 billion parameter model
+- **MXFP4**: Mixed precision 4-bit quantization for smaller size
+- Larger model = better code explanations
+
+### 3. Create Context and Session (Lines 19-22)
+```javascript
+const context = await model.createContext();
+const session = new LlamaChatSession({
+    contextSequence: context.getSequence(),
+});
+```
+Basic session setup with no system prompt.
+
+### 4. Define the Question (Line 24)
+```javascript
+const q1 = `What is hoisting in JavaScript? Explain with examples.`;
+```
+A technical programming question that requires detailed explanation.
+
+### 5. Display Context Size (Line 26)
+```javascript
+console.log('context.contextSize', context.contextSize)
+```
+- Shows the maximum context window size
+- Helps understand memory limitations
+- Useful for debugging
+
+### 6. Streaming Prompt Execution (Lines 28-36)
+```javascript
+const a1 = await session.prompt(q1, {
+    // Tip: let the lib choose or cap reasonably; using the whole context size can be wasteful
+    maxTokens: 2000,
+
+    // Fires as soon as the first characters arrive
+    onTextChunk: (text) => {
+        process.stdout.write(text); // optional: live print
+    },
+});
+```
+
+**Key parameters:**
+
+**maxTokens: 2000**
+- Limits response length to 2000 tokens (~1500 words)
+- Prevents runaway generation
+- Saves time and compute
+- Without limit: model uses entire context
+
+**onTextChunk callback**
+- Fires **as each token is generated**
+- Receives text as it's produced
+- `process.stdout.write()`: Prints without newlines
+- Creates real-time "typing" effect
+
+### How Streaming Works
+
+```
+Without streaming:
+User → [Wait 10 seconds...] → Complete response appears
+
+With streaming:
+User → [Token 1] → [Token 2] → [Token 3] → ... → Complete
+       "What"      "is"        "hoisting"
+       (Immediate feedback!)
+```
+
+### 7. Display Final Answer (Line 38)
+```javascript
+console.log("\n\nFinal answer:\n", a1);
+```
+- Prints the complete response again
+- Useful for logging or verification
+- Shows full text after streaming
+
+### 8. Cleanup (Lines 41-44)
+```javascript
+llama.dispose()
+model.dispose()
+context.dispose()
+session.dispose()
+```
+Standard resource cleanup.
+
+## Key Concepts Demonstrated
+
+### 1. Streaming Responses
+
+**Why streaming matters:**
+- **Better UX**: Users see progress immediately
+- **Early termination**: Can stop if response is off-track
+- **Perceived speed**: Feels faster than waiting
+- **Debugging**: See generation in real-time
+
+**Comparison:**
+```
+Non-streaming:           Streaming:
+═══════════════         ═══════════════
+Request sent            Request sent
+[10s wait...]           "What" (0.1s)
+Complete response       "is" (0.2s)
+                        "hoisting" (0.3s)
+                        ... continues
+                        (Same total time, better experience!)
+```
+
+### 2. Token Limits
+
+**maxTokens controls generation length:**
+
+```
+No limit:               With limit (2000):
+─────────             ─────────────────
+May generate forever   Stops at 2000 tokens
+Uses entire context    Saves computation
+Unpredictable cost     Predictable cost
+```
+
+**Token approximation:**
+- 1 token ≈ 0.75 words (English)
+- 2000 tokens ≈ 1500 words
+- 4-5 paragraphs of detailed explanation
+
+### 3. Real-Time Feedback Pattern
+
+The `onTextChunk` callback enables:
+```javascript
+onTextChunk: (text) => {
+    // Do anything with each chunk:
+    process.stdout.write(text);      // Console output
+    // socket.emit('chunk', text);   // WebSocket to client
+    // buffer += text;               // Accumulate for processing
+    // analyzePartial(text);         // Real-time analysis
+}
+```
+
+### 4. Context Size Awareness
+
+```javascript
+console.log('context.contextSize', context.contextSize)
+```
+
+Shows model's memory capacity:
+- Small models: 2048-4096 tokens
+- Medium models: 8192-16384 tokens  
+- Large models: 32768+ tokens
+
+**Why it matters:**
+```
+Context Size: 4096 tokens
+Prompt: 100 tokens
+Max response: 2000 tokens
+History: Up to 1996 tokens
+```
+
+## Use Cases
+
+### 1. Code Explanations (This Example)
+``
```

**File**: `coding/CONCEPT.md` (added, +400/-0)
```diff
@@ -0,0 +1,400 @@
+# Concept: Streaming & Response Control
+
+## Overview
+
+This example demonstrates **streaming responses** and **token limits**, two essential techniques for building responsive AI agents with controlled output.
+
+## The Streaming Problem
+
+### Traditional (Non-Streaming) Approach
+
+```
+User sends prompt
+       ↓
+   [Wait 10 seconds...]
+       ↓
+Complete response appears all at once
+```
+
+**Problems:**
+- Poor user experience (long wait)
+- No progress indication
+- Can't interrupt bad responses
+- Feels unresponsive
+
+### Streaming Approach (This Example)
+
+```
+User sends prompt
+       ↓
+"Hoisting" (0.1s) → User sees first word!
+       ↓
+"is a" (0.2s) → More text appears
+       ↓
+"JavaScript" (0.3s) → Continuous feedback
+       ↓
+[Continues token by token...]
+```
+
+**Benefits:**
+- Immediate feedback
+- Progress visible
+- Can interrupt early
+- Feels interactive
+
+## How Streaming Works
+
+### Token-by-Token Generation
+
+LLMs generate one token at a time internally. Streaming exposes this:
+
+```
+Internal LLM Process:
+┌─────────────────────────────────────┐
+│  Token 1: "Hoisting"                │
+│  Token 2: "is"                      │
+│  Token 3: "a"                       │
+│  Token 4: "JavaScript"              │
+│  Token 5: "mechanism"               │
+│  ...                                │
+└─────────────────────────────────────┘
+
+Without Streaming:        With Streaming:
+Wait for all tokens       Emit each token immediately
+└─→ Buffer → Return      └─→ Callback → Display
+```
+
+### The onTextChunk Callback
+
+```
+┌────────────────────────────────────┐
+│        Model Generation            │
+└────────────┬───────────────────────┘
+             │
+    ┌────────┴─────────┐
+    │  Each new token  │
+    └────────┬─────────┘
+             ↓
+    ┌────────────────────┐
+    │ onTextChunk(text)  │  ← Your callback
+    └────────┬───────────┘
+             ↓
+    Your code processes it:
+    • Display to user
+    • Send over network
+    • Log to file
+    • Analyze content
+```
+
+## Token Limits: maxTokens
+
+### Why Limit Output?
+
+Without limits, models might generate:
+```
+User: "Explain hoisting"
+Model: [Generates 10,000 words including:
+        - Complete JavaScript history
+        - Every edge case
+        - Unrelated examples
+        - Never stops...]
+```
+
+With limits:
+```
+User: "Explain hoisting"
+Model: [Generates ~1500 words
+        - Core concept
+        - Key examples
+        - Stops at 2000 tokens]
+```
+
+### Token Budgeting
+
+```
+Context Window: 4096 tokens
+├─ System Prompt: 200 tokens
+├─ User Message: 100 tokens
+├─ Response (maxTokens): 2000 tokens
+└─ Remaining for history: 1796 tokens
+
+Total used: 2300 tokens
+Available: 1796 tokens for future conversation
+```
+
+### Cost vs Quality
+
+```
+Token Limit        Output Quality      Use Case
+───────────       ───────────────     ─────────────────
+100               Brief, may be cut   Quick answers
+500               Concise but complete Short explanations
+2000 (example)    Detailed            Full explanations
+No limit          Risk of rambling    When length unknown
+```
+
+## Real-Time Applications
+
+### Pattern 1: Interactive CLI
+
+```
+User: "Explain closures"
+       ↓
+Terminal: "A closure is a function..."
+         (Appears word by word, like typing)
+       ↓
+User sees progress, knows it's working
+```
+
+### Pattern 2: Web Application
+
+```
+Browser                    Server
+   │                         │
+   ├─── Send prompt ────────→│
+   │                         │
+   │←── Chunk 1: "Closures"──┤
+   │    (Display immediately) │
+   │                         │
+   │←── Chunk 2: "are"───────┤
+   │    (Append to display)  │
+   │                         │
+   │←── Chunk 3: "functions"─┤
+   │    (Keep appending...)  │
+```
+
+Implementation:
+- Server-Sent Events (SSE)
+- WebSockets
+- HTTP streaming
+
+### Pattern 3: Multi-Consumer
+
+```
+         onTextChunk(text)
+                │
+        ┌───────┼───────┐
+        ↓       ↓       ↓
+    Console  WebSocket  Log File
+    Display  → Client   → Storage
+```
+
+## Performance Characteristics
+
+### Latency vs Throughput
+
+```
+Time to First Token (TTFT):
+├─ Small model (1.7B): ~100ms
+├─ Medium model (8B): ~200ms
+└─ Large model (20B): ~500ms
+
+Tokens Per Second:
+├─ Small model: 50-80 tok/s
+├─ Medium model: 20-35 tok/s
+└─ Large model: 10-15 tok/s
+
+User Experience:
+TTFT < 500ms → Feels instant
+Tok/s > 20 → Reads naturally
+```
+
+### Resource Trade-offs
+
+```
+Model Size      Memory    Speed     Quality
+──────────     ────────   ─────     ───────
+1.7B           ~2GB       Fast      Good
+8B             ~6GB       Medium    Better
+20B            ~12GB      Slower    Best
+```
+
+## Advanced Concepts
+
+### Buffering Strategies
+
+**No Buffer (Immediate)**
+```
+Every token → callback → display
+└─ Smoothest UX but more overhead
+```
+
+**Line Buffer**
+```
+Accumulate until 
```

**File**: `coding/coding.js` (renamed, +2/-26)
```diff
@@ -4,16 +4,15 @@ import {
 } from "node-llama-cpp";
 import {fileURLToPath} from "url";
 import path from "path";
-import { performance } from "node:perf_hooks";
 
 const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
 const llama = await getLlama();
 const model = await llama.loadModel({
     modelPath: path.join(
         __dirname,
+        "../",
         "models",
-        //"DeepSeek-R1-0528-Qwen3-8B-Q6_K.gguf"
         "hf_giladgd_gpt-oss-20b.MXFP4.gguf"
     )
 });
@@ -26,40 +25,17 @@ const q1 = `What is hoisting in JavaScript? Explain with examples.`;
 
 console.log('context.contextSize', context.contextSize)
 
-// metrics
-let ttftMs;
-let tokensOut = 0;
-const tStart = performance.now();
-
 const a1 = await session.prompt(q1, {
     // Tip: let the lib choose or cap reasonably; using the whole context size can be wasteful
-    maxTokens: Math.min(512, context.contextSize),
+    maxTokens: 2000,
 
     // Fires as soon as the first characters arrive
     onTextChunk: (text) => {
-        if (ttftMs === undefined) {
-            ttftMs = performance.now() - tStart;
-            console.log(`\nTTFT: ${ttftMs.toFixed(0)} ms`);
-        }
         process.stdout.write(text); // optional: live print
     },
-
-    // If you prefer counting actual tokens:
-    onToken: (tokens) => {
-        tokensOut += tokens.length;
-    },
 });
 
-const tEnd = performance.now();
-const totalMs = tEnd - tStart;
-const genMs = ttftMs !== undefined ? totalMs - ttftMs : totalMs;
-const tps = genMs > 0 ? (tokensOut / (genMs / 1000)) : 0;
-
 console.log("\n\nFinal answer:\n", a1);
-console.log(`Total time: ${totalMs.toFixed(0)} ms`);
-if (ttftMs !== undefined) console.log(`TTFT: ${ttftMs.toFixed(0)} ms`);
-console.log(`Tokens generated: ${tokensOut}`);
-console.log(`Throughput (approx): ${tps.toFixed(2)} tok/s`);
 
 
 llama.dispose()
```

**File**: `gpt-oss-20b.js` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-import {
-    getLlama, resolveModelFile, LlamaChatSession,
-    HarmonyChatWrapper
-} from "node-llama-cpp";
-import {fileURLToPath} from "url";
-import path from "path";
-
-const __dirname = path.dirname(fileURLToPath(import.meta.url));
-
-// const modelUri = "hf:giladgd/gpt-oss-20b-GGUF/gpt-oss-20b.MXFP4.gguf";
-// hf:mradermacher/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
-
-const llama = await getLlama();
-const model = await llama.loadModel({
-    modelPath: path.join(
-        __dirname,
-        "models",
-        "hf_giladgd_gpt-oss-20b.MXFP4.gguf"
-    )
-});
-
-/*
-const model = await llama.loadModel({
-    modelPath: await resolveModelFile(
-        modelUri,
-        path.join(__dirname, "models")
-    )
-});
- */
-
-const context = await model.createContext();
-const session = new LlamaChatSession({
-    contextSequence: context.getSequence(),
-    chatWrapper: new HarmonyChatWrapper({
-        modelIdentity: "You are ChatGPT, a large language model trained by OpenAI.",
-        reasoningEffort: "high"
-    })
-});
-
-const q1 = "My name is Jungjun";
-console.log("User: " + q1);
-
-const a1 = await session.prompt(q1);
-console.log("AI: " + a1);
-
-const q2 = "What is my name?";
-console.log("User: " + q2);
-
-const a2 = await session.prompt(q2);
-console.log("AI: " + a2);
-
-// console.log(session.getChatHistory())
-// session.setChatHistory(chatHistory: ChatHistoryItem[])
-// session.resetChatHistory()
-
-llama.dispose()
-model.dispose()
-context.dispose()
-session.dispose()
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #20** (closed): Added retry logic example (@LifeHashed)
- **PR #18** (closed): Added retry and backoff logic (@LifeHashed)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
