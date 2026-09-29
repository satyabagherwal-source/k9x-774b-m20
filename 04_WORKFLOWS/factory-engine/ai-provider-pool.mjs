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
  if (process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY.split(',').forEach((k) => k.trim() && geminiKeys.add(k.trim()));
  }
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

  const geminiArr = Array.from(geminiKeys).filter(Boolean);
  if (geminiArr.length > 0 && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = geminiArr[0];
  }

  return {
    gemini: geminiArr,
    groq: Array.from(new Set(groqKeys)).filter(Boolean),
    huggingface: Array.from(new Set(hfTokens)).filter(Boolean),
    githubToken: process.env.GITHUB_TOKEN || fileSecrets.GITHUB_TOKEN || null
  };
}

let geminiKeyIndex = 0;

/**
const CIRCUIT_FILE = path.join(BRAIN_ROOT, '.harvest-locks', 'ai-key-circuit.json');

/**
 * Loads shared circuit breaker registry across processes
 */
function loadCircuitRegistry() {
  try {
    if (fs.existsSync(CIRCUIT_FILE)) {
      return JSON.parse(fs.readFileSync(CIRCUIT_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

/**
 * Saves shared circuit breaker registry
 */
function saveCircuitRegistry(registry) {
  try {
    const dir = path.dirname(CIRCUIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CIRCUIT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (e) {}
}

/**
 * Returns isolated health state of a specific key
 */
export function getKeyCircuitState(apiKey) {
  const keyId = apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : 'unknown';
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || {
    id: keyId,
    status: 'HEALTHY',
    cooldownUntil: 0,
    resetReason: null,
    consecutiveFailures: 0,
    totalSuccesses: 0,
    lastActiveAt: null
  };

  // Auto-recovery: If cooldown timestamp has expired, restore key to HEALTHY automatically
  if (entry.status !== 'HEALTHY' && Date.now() >= entry.cooldownUntil) {
    entry.status = 'HEALTHY';
    entry.resetReason = null;
    entry.consecutiveFailures = 0;
    registry[keyId] = entry;
    saveCircuitRegistry(registry);
  }
  return entry;
}

/**
 * Marks ONLY this specific key as cooling down with its own independent timer
 */
export function tripKeyCircuitBreaker(apiKey, durationMs, reason) {
  const keyId = apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : 'unknown';
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || { id: keyId, consecutiveFailures: 0, totalSuccesses: 0 };

  entry.status = durationMs > 300_000 ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED';
  entry.cooldownUntil = Date.now() + durationMs;
  entry.resetReason = reason;
  entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
  entry.lastActiveAt = new Date().toISOString();

  registry[keyId] = entry;
  saveCircuitRegistry(registry);

  const resetTimeStr = new Date(entry.cooldownUntil).toISOString().replace('T', ' ').slice(0, 19);
  console.warn(`⏸️ [ISOLATED KEY COOLDOWN] ${keyId} entered ${entry.status} mode (${reason}).`);
  console.warn(`   Independent Reset At: ${resetTimeStr} (${Math.round(durationMs / 1000)}s). Other pool keys remain 100% ACTIVE!`);
}

/**
 * Marks a key as healthy upon successful response
 */
export function reportKeySuccess(apiKey) {
  const keyId = apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : 'unknown';
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || { id: keyId, consecutiveFailures: 0, totalSuccesses: 0 };

  entry.status = 'HEALTHY';
  entry.cooldownUntil = 0;
  entry.resetReason = null;
  entry.consecutiveFailures = 0;
  entry.totalSuccesses = (entry.totalSuccesses || 0) + 1;
  entry.lastActiveAt = new Date().toISOString();

  registry[keyId] = entry;
  saveCircuitRegistry(registry);
}

/**
 * Returns complete report of all keys and their individual health states across providers
 */
export function getAllKeysCircuitReport() {
  const allKeys = loadAllAiKeys();
  const report = [];
  allKeys.gemini.forEach((k, idx) => {
    report.push({
      provider: 'Google Gemini',
      label: `Gemini Key #${idx + 1}`,
      ...getKeyCircuitState(k)
    });
  });
  allKeys.groq.forEach((k, idx) => {
    report.push({
      provider: 'Groq Free',
      label: `Groq Key #${idx + 1}`,
      ...getKeyCircuitState(k)
    });
  });
  return report;
}

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
 * Robust Multi-Key Server-to-Server Gemini Call with Independent Per-Key Circuit Breakers
 * If Key 1 hits its quota limit, ONLY Key 1 cools down until its reset time.
 * All other keys in the pool CONTINUE SERVING without stopping or global pause!
 */
export async function executeWithGeminiPool(prompt, systemInstruction = '') {
  const pool = loadAllAiKeys().gemini;
  if (pool.length === 0) {
    throw new Error('NO_GEMINI_KEYS_AVAILABLE: Please configure at least one Gemini key in .brain-secrets.json or environment.');
  }

  let lastError = null;
  let activeKeysTried = 0;

  // Try each key in the pool independently
  for (let kIdx = 0; kIdx < pool.length; kIdx++) {
    const apiKey = pool[(geminiKeyIndex + kIdx) % pool.length];
    const keyLabel = `Key ${(kIdx + 1)}/${pool.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey);

    // If this specific key is currently in isolated cooldown, skip it without network call
    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} is resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left - ${circuit.resetReason}). Passing to next key...`);
      continue;
    }

    activeKeysTried++;

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
          const errText = await response.text();
          const isDailyQuota = /quota|RESOURCE_EXHAUSTED|free_tier_requests_per_day/i.test(errText);
          const cooldownDuration = isDailyQuota ? 3600_000 : 65_000; // 1 hour for daily quota, 65s for RPM limit
          const reason = isDailyQuota ? 'Daily/Hourly Quota Exhausted' : 'Rate Limit 15 RPM Burst';

          // Trip ONLY this key's circuit breaker
          tripKeyCircuitBreaker(apiKey, cooldownDuration, reason);
          lastError = new Error(`Rate limit 429 on ${keyLabel} (${reason})`);
          break; // Break model loop to rotate to next key immediately
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
          reportKeySuccess(apiKey);
          console.log(`✨ [GEMINI POOL SUCCESS] Received intelligence via ${keyLabel} from ${model} (${text.length} chars).`);
          return { text, model, keyUsed: keyLabel };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[GEMINI POOL ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }

  if (activeKeysTried === 0) {
    const report = getAllKeysCircuitReport().filter((r) => r.provider === 'Google Gemini');
    const minWaitSec = Math.min(...report.map((r) => Math.max(1, Math.round((r.cooldownUntil - Date.now()) / 1000))));
    throw new Error(`All ${pool.length} Gemini keys are in isolated cooldown (earliest resets in ${minWaitSec}s).`);
  }

  throw lastError || new Error('All active Gemini keys and models in pool exhausted.');
}

/**
 * Free Tier Secondary AI: Groq Free Inference (Llama 3.3 70B Versatile)
 * Also protected with independent per-key circuit breakers!
 */
export async function executeWithGroqFree(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().groq;
  if (keys.length === 0) return null;

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `Groq Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey);

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left). Trying next Groq key...`);
      continue;
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });

    try {
      console.log(`⚡ [GROQ FREE AI] Sending request via ${keyLabel} to Llama-3.3-70b-versatile...`);
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

      if (res.status === 429) {
        tripKeyCircuitBreaker(apiKey, 65_000, 'Groq Rate Limit Exceeded');
        continue;
      }

      if (!res.ok) {
        console.warn(`[GROQ HTTP ERROR] Status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (text) {
        reportKeySuccess(apiKey);
        return {
          text,
          model: 'llama-3.3-70b-versatile (Groq Free)',
          keyUsed: keyLabel
        };
      }
    } catch (e) {
      console.warn(`[GROQ FREE AI ERROR] ${keyLabel}: ${e.message}`);
    }
  }

  return null;
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
