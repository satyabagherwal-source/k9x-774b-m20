# Forensic Learning Record (Deep Inspection): pguso/ai-agents-from-scratch

> **Canonical Artifact**: `07_PROJECT_LEARNING/pguso-ai-agents-from-scratch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pguso/ai-agents-from-scratch](https://github.com/pguso/ai-agents-from-scratch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:38:15.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pguso/ai-agents-from-scratch`
- **Description**: Demystify AI agents by building them yourself. Local LLMs, no black boxes, real understanding of function calling, memory, and ReAct patterns.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4823 stars

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

### Incident Patch 3: `9937e7da` (2025-10-29)
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
+                existi
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

### Incident Patch 4: `fdfb6114` (2025-10-29)
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

### Incident Patch 5: `1b57bb2f` (2025-10-27)
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

### Incident Patch 6: `6a911891` (2025-10-27)
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

### Incident Patch 7: `621799ea` (2025-10-23)
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

### Incident Patch 8: `4436852b` (2025-10-23)
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
+
```

---

### Incident Patch 9: `478e1b5b` (2025-10-23)
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
+📁 `re
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
+5
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
+┌─────────┐  ┌─────────┐  ┌────
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
+Unpredictable cost     Predic
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
