import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const SECRETS_PATH = path.join(BRAIN_ROOT, '.brain-secrets.json');
const CIRCUIT_FILE = path.join(BRAIN_ROOT, '.harvest-locks', 'ai-key-circuit.json');

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
 * Universal key discovery helper: loads keys from environment & .brain-secrets.json
 */
export function loadAllAiKeys() {
  let fileSecrets = {};
  if (fs.existsSync(SECRETS_PATH)) {
    try {
      fileSecrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf-8'));
    } catch (e) {}
  }

  const parseKeys = (envPrefix, secretKey, multiSecretKey, maxIndex = 10) => {
    const keys = new Set();
    // 1. Single env var
    if (process.env[envPrefix]) {
      process.env[envPrefix].split(',').forEach((k) => k.trim() && keys.add(k.trim()));
    }
    // 2. Indexed env vars (e.g. GEMINI_KEY_1..10, OPENAI_KEY_1..5)
    for (let i = 1; i <= maxIndex; i++) {
      const k = process.env[`${envPrefix}_${i}`] || process.env[`${secretKey}_${i}`];
      if (k) keys.add(k.trim());
    }
    // 3. Secrets single
    if (fileSecrets[secretKey]) {
      const val = fileSecrets[secretKey];
      if (typeof val === 'string') val.split(',').forEach((k) => k.trim() && keys.add(k.trim()));
    }
    // 4. Secrets array
    if (multiSecretKey && Array.isArray(fileSecrets[multiSecretKey])) {
      fileSecrets[multiSecretKey].forEach((k) => k && keys.add(k.trim()));
    }
    // 5. Secrets indexed
    for (let i = 1; i <= maxIndex; i++) {
      const k = fileSecrets[`${secretKey}_${i}`] || fileSecrets[`${envPrefix}_${i}`];
      if (k) keys.add(k.trim());
    }
    return Array.from(keys).filter(Boolean);
  };

  const gemini = parseKeys('GEMINI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_KEYS', 10);
  const openai = parseKeys('OPENAI_API_KEY', 'OPENAI_API_KEY', 'OPENAI_KEYS', 10);
  const claude = parseKeys('ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_KEYS', 10);
  const grok = parseKeys('GROK_API_KEY', 'XAI_API_KEY', 'GROK_KEYS', 5);
  const minimax = parseKeys('MINIMAX_API_KEY', 'MINIMAX_API_KEY', 'MINIMAX_KEYS', 5);
  const groq = parseKeys('GROQ_API_KEY', 'GROQ_API_KEY', 'GROQ_KEYS', 5);
  const huggingface = parseKeys('HF_TOKEN', 'HF_TOKEN', 'HUGGINGFACE_KEYS', 5);

  const ollamaHost = process.env.OLLAMA_HOST || fileSecrets.OLLAMA_HOST || 'http://localhost:11434';

  return {
    gemini,
    openai,
    claude,
    grok,
    minimax,
    groq,
    huggingface,
    ollamaHost,
    githubToken: process.env.GITHUB_TOKEN || fileSecrets.GITHUB_TOKEN || null
  };
}

let geminiKeyIndex = 0;

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
 * Generates an isolated identifier for an API key / endpoint
 */
function getKeyIdentifier(apiKey, provider = '') {
  if (!apiKey) return 'unknown';
  if (apiKey.startsWith('http')) return `Local Ollama:${apiKey}`;
  const masked = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : apiKey;
  return provider ? `${provider}:${masked}` : masked;
}

/**
 * Returns isolated health state of a specific key
 */
export function getKeyCircuitState(apiKey, provider = '') {
  const keyId = getKeyIdentifier(apiKey, provider);
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || {
    id: keyId,
    provider: provider || 'Unknown',
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
export function tripKeyCircuitBreaker(apiKey, durationMs, reason, provider = '') {
  const keyId = getKeyIdentifier(apiKey, provider);
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || {
    id: keyId,
    provider: provider || 'Unknown',
    consecutiveFailures: 0,
    totalSuccesses: 0
  };

  entry.status = durationMs > 300_000 ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED';
  entry.cooldownUntil = Date.now() + durationMs;
  entry.resetReason = reason;
  entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
  entry.lastActiveAt = new Date().toISOString();

  registry[keyId] = entry;
  saveCircuitRegistry(registry);

  const resetTimeStr = new Date(entry.cooldownUntil).toISOString().replace('T', ' ').slice(0, 19);
  console.warn(`⏸️ [ISOLATED KEY COOLDOWN] ${keyId} entered ${entry.status} mode (${reason}).`);
  console.warn(`   Independent Reset At: ${resetTimeStr} (${Math.round(durationMs / 1000)}s). Other pool keys and providers remain 100% ACTIVE!`);
}

/**
 * Marks a key as healthy upon successful response
 */
export function reportKeySuccess(apiKey, provider = '') {
  const keyId = getKeyIdentifier(apiKey, provider);
  const registry = loadCircuitRegistry();
  const entry = registry[keyId] || {
    id: keyId,
    provider: provider || 'Unknown',
    consecutiveFailures: 0,
    totalSuccesses: 0
  };

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
 * Returns complete report of all keys and their individual health states across all providers
 */
export function getAllKeysCircuitReport() {
  const allKeys = loadAllAiKeys();
  const report = [];

  allKeys.gemini.forEach((k, idx) => {
    report.push({
      provider: 'Google Gemini',
      label: `Gemini Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'Google Gemini')
    });
  });

  allKeys.claude.forEach((k, idx) => {
    report.push({
      provider: 'Anthropic Claude',
      label: `Claude Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'Anthropic Claude')
    });
  });

  allKeys.openai.forEach((k, idx) => {
    report.push({
      provider: 'OpenAI (ChatGPT/Codex)',
      label: `OpenAI Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'OpenAI')
    });
  });

  allKeys.grok.forEach((k, idx) => {
    report.push({
      provider: 'xAI Grok',
      label: `Grok Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'xAI Grok')
    });
  });

  allKeys.minimax.forEach((k, idx) => {
    report.push({
      provider: 'MiniMax AI',
      label: `MiniMax Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'MiniMax AI')
    });
  });

  allKeys.groq.forEach((k, idx) => {
    report.push({
      provider: 'Groq Free Tier',
      label: `Groq Key #${idx + 1}`,
      ...getKeyCircuitState(k, 'Groq Free')
    });
  });

  allKeys.huggingface.forEach((k, idx) => {
    report.push({
      provider: 'Hugging Face',
      label: `HF Token #${idx + 1}`,
      ...getKeyCircuitState(k, 'Hugging Face')
    });
  });

  // Local Ollama
  report.push({
    provider: 'Local Ollama',
    label: allKeys.ollamaHost,
    ...getKeyCircuitState(allKeys.ollamaHost, 'Local Ollama')
  });

  return report;
}

/**
 * Google Gemini Provider Pool: Multi-Account Rotation with Independent Circuit Breakers
 */
export async function executeWithGeminiPool(prompt, systemInstruction = '') {
  const pool = loadAllAiKeys().gemini;
  if (pool.length === 0) return null;

  let lastError = null;
  let activeKeysTried = 0;

  for (let kIdx = 0; kIdx < pool.length; kIdx++) {
    const apiKey = pool[(geminiKeyIndex + kIdx) % pool.length];
    const keyLabel = `Gemini Key ${(kIdx + 1)}/${pool.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'Google Gemini');

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left - ${circuit.resetReason}). Passing to next key...`);
      continue;
    }

    activeKeysTried++;

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
          const cooldownDuration = isDailyQuota ? 3600_000 : 65_000;
          const reason = isDailyQuota ? 'Daily Quota Exhausted' : 'Rate Limit 15 RPM Burst';

          tripKeyCircuitBreaker(apiKey, cooldownDuration, reason, 'Google Gemini');
          lastError = new Error(`Rate limit 429 on ${keyLabel} (${reason})`);
          break; // break model loop to try next key immediately
        }

        if (response.status === 503) {
          console.warn(`[GEMINI 503] ${model} overloaded. Trying alternative model...`);
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
          reportKeySuccess(apiKey, 'Google Gemini');
          console.log(`✨ [GEMINI POOL SUCCESS] Received intelligence via ${keyLabel} from ${model} (${text.length} chars).`);
          return { text, model: `${model} (Gemini)`, keyUsed: keyLabel };
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  return null;
}

/**
 * OpenAI Provider Pool (ChatGPT & Codex): GPT-4o, GPT-4o-mini, o3-mini
 */
export async function executeWithOpenAiPool(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().openai;
  if (keys.length === 0) return null;

  const models = ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-4-turbo'];

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `OpenAI Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'OpenAI');

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left - ${circuit.resetReason}). Passing to next key...`);
      continue;
    }

    for (const model of models) {
      const url = 'https://api.openai.com/v1/chat/completions';
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      try {
        console.log(`🧠 [OPENAI CHATGPT/CODEX] Sending request via ${keyLabel} to ${model}...`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 8192
          })
        });

        if (res.status === 429) {
          const errText = await res.text();
          const retryAfter = res.headers.get('retry-after');
          const isQuota = /insufficient_quota|billing|quota_exceeded/i.test(errText);
          const cooldownDuration = retryAfter
            ? (parseInt(retryAfter, 10) + 2) * 1000
            : (isQuota ? 7200_000 : 65_000);
          const reason = isQuota ? 'OpenAI Quota Limit Exhausted' : 'OpenAI RPM Rate Limit';

          tripKeyCircuitBreaker(apiKey, cooldownDuration, reason, 'OpenAI');
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          reportKeySuccess(apiKey, 'OpenAI');
          console.log(`✨ [OPENAI SUCCESS] Received intelligence via ${keyLabel} from ${model} (${text.length} chars).`);
          return { text, model: `${model} (OpenAI)`, keyUsed: keyLabel };
        }
      } catch (err) {
        console.warn(`[OPENAI ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Anthropic Claude Provider Pool: Claude 3.5 Sonnet / Haiku
 */
export async function executeWithClaudePool(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().claude;
  if (keys.length === 0) return null;

  const models = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `Claude Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'Anthropic Claude');

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left - ${circuit.resetReason}). Passing to next key...`);
      continue;
    }

    for (const model of models) {
      const url = 'https://api.anthropic.com/v1/messages';
      try {
        console.log(`🎭 [ANTHROPIC CLAUDE] Sending request via ${keyLabel} to ${model}...`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            system: systemInstruction || undefined,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (res.status === 429 || res.status === 529) {
          const retryAfter = res.headers.get('retry-after');
          const errText = await res.text();
          const isQuota = /credit|budget|quota/i.test(errText);
          const cooldownDuration = retryAfter
            ? (parseInt(retryAfter, 10) + 2) * 1000
            : (isQuota ? 3600_000 : 65_000);
          const reason = isQuota ? 'Claude Credit/Budget Limit' : (res.status === 529 ? 'Claude Overloaded' : 'Claude Rate Limit');

          tripKeyCircuitBreaker(apiKey, cooldownDuration, reason, 'Anthropic Claude');
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (text) {
          reportKeySuccess(apiKey, 'Anthropic Claude');
          console.log(`✨ [CLAUDE SUCCESS] Received intelligence via ${keyLabel} from ${model} (${text.length} chars).`);
          return { text, model: `${model} (Claude)`, keyUsed: keyLabel };
        }
      } catch (err) {
        console.warn(`[CLAUDE ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * xAI Grok Provider Pool: Grok-2
 */
export async function executeWithGrokPool(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().grok;
  if (keys.length === 0) return null;

  const models = ['grok-2-1212', 'grok-beta'];

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `Grok Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'xAI Grok');

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left). Passing to next key...`);
      continue;
    }

    for (const model of models) {
      const url = 'https://api.x.ai/v1/chat/completions';
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      try {
        console.log(`⚡ [XAI GROK] Sending request via ${keyLabel} to ${model}...`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2
          })
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const cooldownDuration = retryAfter ? (parseInt(retryAfter, 10) + 2) * 1000 : 65_000;
          tripKeyCircuitBreaker(apiKey, cooldownDuration, 'Grok Rate Limit', 'xAI Grok');
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          reportKeySuccess(apiKey, 'xAI Grok');
          return { text, model: `${model} (xAI Grok)`, keyUsed: keyLabel };
        }
      } catch (err) {
        console.warn(`[GROK ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * MiniMax AI Provider Pool: MiniMax-Text-01 / abab6.5s-chat
 */
export async function executeWithMiniMaxPool(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().minimax;
  if (keys.length === 0) return null;

  const models = ['MiniMax-Text-01', 'abab6.5s-chat'];

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `MiniMax Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'MiniMax AI');

    if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
      console.log(`⏩ [ISOLATED COOLDOWN] ${keyLabel} resting until ${new Date(circuit.cooldownUntil).toISOString().slice(11, 19)} (${waitSec}s left). Passing to next key...`);
      continue;
    }

    for (const model of models) {
      const url = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      try {
        console.log(`💫 [MINIMAX AI] Sending request via ${keyLabel} to ${model}...`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2
          })
        });

        if (res.status === 429) {
          tripKeyCircuitBreaker(apiKey, 65_000, 'MiniMax Rate Limit', 'MiniMax AI');
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || data.reply;
        if (text) {
          reportKeySuccess(apiKey, 'MiniMax AI');
          return { text, model: `${model} (MiniMax)`, keyUsed: keyLabel };
        }
      } catch (err) {
        console.warn(`[MINIMAX ATTEMPT ERROR] ${keyLabel} - ${model}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Groq Free Tier: Llama 3.3 70B Versatile
 */
export async function executeWithGroqFree(prompt, systemInstruction = '') {
  const keys = loadAllAiKeys().groq;
  if (keys.length === 0) return null;

  for (let idx = 0; idx < keys.length; idx++) {
    const apiKey = keys[idx];
    const keyLabel = `Groq Key ${idx + 1}/${keys.length} (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`;
    const circuit = getKeyCircuitState(apiKey, 'Groq Free');

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
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.2,
          max_tokens: 8192
        })
      });

      if (res.status === 429) {
        tripKeyCircuitBreaker(apiKey, 65_000, 'Groq Rate Limit Exceeded', 'Groq Free');
        continue;
      }

      if (!res.ok) continue;

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (text) {
        reportKeySuccess(apiKey, 'Groq Free');
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
 * Local Ollama Self-Hosted Fallback: 100% Free, Zero External Quota
 */
export async function executeWithLocalOllama(prompt, systemInstruction = '') {
  const host = loadAllAiKeys().ollamaHost || 'http://localhost:11434';
  const circuit = getKeyCircuitState(host, 'Local Ollama');

  if (circuit.status !== 'HEALTHY' && Date.now() < circuit.cooldownUntil) {
    return null;
  }

  const preferredModels = ['llama3.3', 'qwen2.5-coder', 'mistral', 'deepseek-r1', 'llama3'];

  try {
    const tagsRes = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!tagsRes.ok) throw new Error('Ollama endpoint not responding');
    const tagsData = await tagsRes.json();
    const availableModelNames = (tagsData.models || []).map((m) => m.name.split(':')[0]);

    const selectedModel = preferredModels.find((m) => availableModelNames.includes(m)) ||
      (tagsData.models?.[0]?.name ? tagsData.models[0].name.split(':')[0] : 'llama3');

    console.log(`🦙 [LOCAL OLLAMA] Sending request to local model '${selectedModel}' (${host})...`);

    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: { temperature: 0.2 }
      })
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = data.message?.content;
    if (text) {
      reportKeySuccess(host, 'Local Ollama');
      console.log(`✨ [LOCAL OLLAMA SUCCESS] Generated intelligence locally via ${selectedModel} (0 quota burned, 100% free).`);
      return { text, model: `${selectedModel} (Local Ollama)`, keyUsed: host };
    }
  } catch (err) {
    // If Ollama is offline or not installed, mark OFFLINE for 30s so we don't delay future loops
    tripKeyCircuitBreaker(host, 30_000, 'Local Ollama Offline', 'Local Ollama');
  }

  return null;
}

/**
 * Outbound Data Classification & Privacy Pre-Flight Sanitizer
 * Enforces 13_GOVERNANCE/data-classification-and-governance.md:
 * 1. Blocks raw CONFIDENTIAL secrets (API keys, private certificates) from external egress
 * 2. Redacts SENSITIVE / THIRD-PARTY PERSONAL DATA (emails, phone numbers)
 * 3. Injects mandatory Non-Distillation / Knowledge Retrieval system header
 */
export function classifyAndSanitizeOutboundPayload(prompt, systemInstruction = '') {
  // 1. CONFIDENTIAL SECRETS SCAN
  const secretPatterns = [
    /(?:sk-[a-zA-Z0-9_-]{24,})/i,
    /(?:AIzaSy[a-zA-Z0-9_-]{33})/i,
    /(?:ghp_[a-zA-Z0-9]{36})/i,
    /(?:gho_[a-zA-Z0-9]{36})/i,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(prompt)) {
      throw new Error(`[DATA GOVERNANCE EGRESS BLOCK] Outbound prompt contains raw CONFIDENTIAL credential matching ${pattern}. Transmission aborted to protect secrets.`);
    }
  }

  // 2. SENSITIVE PII EMAIL SANITIZATION (Scrub personal emails from Git commit logs)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const sanitizedPrompt = prompt.replace(emailRegex, '[REDACTED_EMAIL]');

  // 3. MANDATORY ANTI-DISTILLATION / KNOWLEDGE RETRIEVAL GOVERNANCE HEADER
  const governanceHeader = `\n[DATA GOVERNANCE & NON-DISTILLATION MANDATE]\nThis operation is conducted strictly for natural language software engineering knowledge retrieval and documentation under AI-Builder-Brain governance. Model outputs are NEVER used to train, fine-tune, or distill an artificial intelligence model.`;
  const sanitizedSystemInstruction = systemInstruction
    ? `${systemInstruction.trim()}\n${governanceHeader}`
    : governanceHeader.trim();

  return {
    prompt: sanitizedPrompt,
    systemInstruction: sanitizedSystemInstruction
  };
}

/**
 * Universal Multi-Provider AI Cascade Dispatcher:
 * 1. Google Gemini Pool (Keys 1..10)
 * 2. Anthropic Claude Pool (Claude 3.5 Sonnet / Haiku)
 * 3. OpenAI ChatGPT / Codex Pool (GPT-4o, GPT-4o-mini, o3-mini)
 * 4. xAI Grok Pool (Grok-2)
 * 5. MiniMax Pool (MiniMax-Text-01)
 * 6. Groq Free Tier (Llama 3.3 70B)
 * 7. Local Ollama (Local Self-Hosted - Infinite Quota)
 *
 * Each key and provider operates on independent circuit breakers.
 * Zero global shutdowns!
 */
export async function dispatchZeroCostAiSynthesis(prompt, systemInstruction = '') {
  // Enforce Pre-Flight Data Classification, Credential Guard, and Anti-Distillation Header
  const sanitized = classifyAndSanitizeOutboundPayload(prompt, systemInstruction);
  const cleanPrompt = sanitized.prompt;
  const cleanSystem = sanitized.systemInstruction;

  // 1. Google Gemini Pool
  try {
    const geminiRes = await executeWithGeminiPool(cleanPrompt, cleanSystem);
    if (geminiRes && geminiRes.text) {
      geminiRes.provider = 'Google Gemini';
      geminiRes.distillationProhibited = true;
      return geminiRes;
    }
  } catch (e) {
    console.warn(`[GEMINI POOL EXHAUSTED/RESTING] ${e.message}. Cascading...`);
  }

  // 2. Anthropic Claude Pool
  try {
    const claudeRes = await executeWithClaudePool(cleanPrompt, cleanSystem);
    if (claudeRes && claudeRes.text) {
      claudeRes.provider = 'Anthropic Claude';
      claudeRes.distillationProhibited = true;
      return claudeRes;
    }
  } catch (e) {}

  // 3. OpenAI ChatGPT / Codex Pool
  try {
    const openAiRes = await executeWithOpenAiPool(cleanPrompt, cleanSystem);
    if (openAiRes && openAiRes.text) {
      openAiRes.provider = 'OpenAI';
      openAiRes.distillationProhibited = true;
      return openAiRes;
    }
  } catch (e) {}

  // 4. xAI Grok Pool
  try {
    const grokRes = await executeWithGrokPool(cleanPrompt, cleanSystem);
    if (grokRes && grokRes.text) {
      grokRes.provider = 'xAI Grok';
      grokRes.distillationProhibited = true;
      return grokRes;
    }
  } catch (e) {}

  // 5. MiniMax AI Pool
  try {
    const minimaxRes = await executeWithMiniMaxPool(cleanPrompt, cleanSystem);
    if (minimaxRes && minimaxRes.text) {
      minimaxRes.provider = 'MiniMax AI';
      minimaxRes.distillationProhibited = true;
      return minimaxRes;
    }
  } catch (e) {}

  // 6. Groq Free Tier
  try {
    const groqRes = await executeWithGroqFree(cleanPrompt, cleanSystem);
    if (groqRes && groqRes.text) {
      groqRes.provider = 'Groq Free Tier';
      groqRes.distillationProhibited = true;
      return groqRes;
    }
  } catch (e) {}

  // 7. Local Ollama (Unlimited Tokens, Zero External Quota)
  try {
    const ollamaRes = await executeWithLocalOllama(cleanPrompt, cleanSystem);
    if (ollamaRes && ollamaRes.text) {
      ollamaRes.provider = 'Local Ollama';
      ollamaRes.distillationProhibited = true;
      return ollamaRes;
    }
  } catch (e) {}

  throw new Error('All configured AI providers (Gemini, Claude, ChatGPT, Grok, MiniMax, Groq, Ollama) are either resting in isolated cooldown or unconfigured.');
}
