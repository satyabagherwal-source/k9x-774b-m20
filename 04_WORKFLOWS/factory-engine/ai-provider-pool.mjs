import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const SECRETS_PATH = path.join(BRAIN_ROOT, '.brain-secrets.json');

// Supported Gemini Models (Active 3.x stack)
export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

/**
 * Loads all available AI Provider Keys from .brain-secrets.json and process.env
 */
export function loadAllAiKeys() {
  let fileSecrets = {};
  if (fs.existsSync(SECRETS_PATH)) {
    try {
      fileSecrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf-8'));
    } catch (e) {}
  }

  // 1. Gather all Gemini Keys (Pool of 5+ keys)
  const geminiKeys = new Set();

  // From environment
  if (process.env.GEMINI_API_KEY) geminiKeys.add(process.env.GEMINI_API_KEY.trim());
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_KEY_${i}`];
    if (k) geminiKeys.add(k.trim());
  }

  // From .brain-secrets.json
  if (fileSecrets.GEMINI_API_KEY) geminiKeys.add(fileSecrets.GEMINI_API_KEY.trim());
  if (Array.isArray(fileSecrets.GEMINI_KEYS)) {
    fileSecrets.GEMINI_KEYS.forEach((k) => k && geminiKeys.add(k.trim()));
  }
  for (let i = 1; i <= 10; i++) {
    const k = fileSecrets[`GEMINI_KEY_${i}`];
    if (k) geminiKeys.add(k.trim());
  }

  // 2. Gather Free Secondary Providers (Groq, GitHub Models, Hugging Face)
  const groqKeys = [];
  if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY.trim());
  if (fileSecrets.GROQ_API_KEY) groqKeys.push(fileSecrets.GROQ_API_KEY.trim());
  if (Array.isArray(fileSecrets.GROQ_KEYS)) groqKeys.push(...fileSecrets.GROQ_KEYS);

  const hfTokens = [];
  if (process.env.HF_TOKEN) hfTokens.push(process.env.HF_TOKEN.trim());
  if (fileSecrets.HF_TOKEN) hfTokens.push(fileSecrets.HF_TOKEN.trim());

  return {
    gemini: Array.from(geminiKeys).filter(Boolean),
    groq: Array.from(new Set(groqKeys)).filter(Boolean),
    huggingface: Array.from(new Set(hfTokens)).filter(Boolean),
    githubToken: process.env.GITHUB_TOKEN || fileSecrets.GITHUB_TOKEN || null
  };
}

let geminiKeyIndex = 0;

/**
 * Get next rotating Gemini key with automatic round-robin load balancing
 */
export function getNextGeminiKey() {
  const keys = loadAllAiKeys().gemini;
  if (keys.length === 0) return null;
  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
  return { key, index: (geminiKeyIndex === 0 ? keys.length : geminiKeyIndex), total: keys.length };
}

/**
 * Robust Multi-Key Server-to-Server Gemini Call with Auto-Key Rotation
 * If Key 1 hits 429 or 503, immediately rotates to Key 2, Key 3, etc.
 */
export async function executeWithGeminiPool(prompt, systemInstruction = '') {
  const pool = loadAllAiKeys().gemini;
  if (pool.length === 0) {
    throw new Error('NO_GEMINI_KEYS_AVAILABLE: Please configure at least one Gemini key in .brain-secrets.json or environment.');
  }

  let lastError = null;

  // Try each key in the pool
  for (let kIdx = 0; kIdx < pool.length; kIdx++) {
    const apiKey = pool[(geminiKeyIndex + kIdx) % pool.length];
    const keyLabel = `Key ${(kIdx + 1)}/${pool.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;

    // Try each model with this key
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      };

      if (systemInstruction) {
        requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      try {
        console.log(`🤖 [GEMINI POOL] Sending request via ${keyLabel} to ${model}...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.status === 429) {
          console.warn(`[GEMINI 429: RATE LIMIT] ${keyLabel} rate-limited. Rotating to next subscription key in pool...`);
          lastError = new Error(`Rate limit 429 on ${keyLabel}`);
          break; // Break inner model loop to rotate key immediately
        }

        if (response.status === 503) {
          console.warn(`[GEMINI 503: SPIKE] ${model} on ${keyLabel} overloaded. Trying alternative model...`);
          lastError = new Error(`503 unavailable on ${model}`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = new Error(`Gemini Error (${response.status}): ${errText.slice(0, 100)}`);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          console.log(`✨ [GEMINI POOL SUCCESS] Received intelligence via ${keyLabel} from ${model} (${text.length} chars).`);
          return { text, model, keyUsed: keyLabel };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[GEMINI POOL ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }

  throw lastError || new Error('All Gemini keys and models in pool exhausted.');
}

/**
 * Free Tier Secondary AI: Groq Free Inference (Llama 3.3 70B Versatile)
 */
export async function executeWithGroqFree(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().groq;
  if (keys.length === 0) return null;

  const apiKey = keys[0];
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  try {
    console.log(`⚡ [GROQ FREE AI] Sending request to Llama-3.3-70b-versatile...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.2,
        max_tokens: 8192
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      model: 'llama-3.3-70b-versatile (Groq Free)'
    };
  } catch (e) {
    console.warn(`[GROQ FREE AI ERROR] ${e.message}`);
    return null;
  }
}

/**
 * Universal Zero-Cost AI Dispatcher:
 * Tries Gemini Key Pool (5x accounts) -> Falls back to Groq Free -> Never spends money.
 */
export async function dispatchZeroCostAiSynthesis(prompt, systemInstruction = '') {
  try {
    // 1. Primary: Gemini Multi-Key Pool (5 Subscription / Free Accounts)
    return await executeWithGeminiPool(prompt, systemInstruction);
  } catch (geminiErr) {
    console.warn(`[GEMINI POOL EXHAUSTED] ${geminiErr.message}. Attempting free secondary provider...`);

    // 2. Secondary: Groq Free Tier (Llama 3.3 70B)
    const groqRes = await executeWithGroqFree(prompt, systemInstruction);
    if (groqRes && groqRes.text) return groqRes;

    throw new Error(`Zero-cost AI synthesis failed across all configured free providers: ${geminiErr.message}`);
  }
}
