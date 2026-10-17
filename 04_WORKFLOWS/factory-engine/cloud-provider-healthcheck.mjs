import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAllAiKeys, classifyCredential, GEMINI_MODELS } from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

async function testGeminiSlot(key, slotNum, model = 'gemini-3.8-flash') {
  const meta = classifyCredential(key, 'gemini');
  const isBearer = meta.format === 'GOOGLE_OAUTH_ACCESS_TOKEN';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent${isBearer ? '' : `?key=${key}`}`;
  
  const headers = { 'Content-Type': 'application/json' };
  if (isBearer) headers['Authorization'] = `Bearer ${key}`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: PING_OK' }] }],
        generationConfig: { maxOutputTokens: 100 }
      })
    });
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return {
        slot: `Gemini Slot ${slotNum}`,
        provider: 'Google AI Studio',
        model,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: text.includes('PING_OK'),
        category: 'HEALTHY',
        error: null
      };
    } else {
      const errText = await res.text();
      let errJson = null;
      try { errJson = JSON.parse(errText); } catch (e) {}
      const rawMsg = errJson?.error?.message || errText;
      let category = 'UPSTREAM_ERROR';
      if (res.status === 401) category = 'AUTH_INVALID';
      else if (res.status === 429) {
        const isDaily = /GenerateRequestsPerDay|free_tier_requests_per_day|daily_limit/i.test(rawMsg);
        category = isDaily ? 'DAILY_QUOTA_EXHAUSTED' : 'RATE_LIMITED_65S';
      }
      else if (res.status === 503) category = 'SERVICE_OVERLOADED';

      return {
        slot: `Gemini Slot ${slotNum}`,
        provider: 'Google AI Studio',
        model,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: false,
        category,
        error: rawMsg.slice(0, 100)
      };
    }
  } catch (err) {
    return {
      slot: `Gemini Slot ${slotNum}`,
      provider: 'Google AI Studio',
      model,
      masked: meta.masked,
      httpStatus: 0,
      latencyMs: Date.now() - start,
      inferenceSuccess: false,
      category: 'NETWORK_TIMEOUT',
      error: err.message
    };
  }
}

async function testGroqSlot(key, slotNum, model = 'qwen/qwen3.8-27b') {
  const meta = classifyCredential(key, 'groq');
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Respond with exactly: PING_OK' }],
        max_tokens: 50
      })
    });
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        slot: `Groq Slot ${slotNum}`,
        provider: 'Groq Cloud',
        model,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: text.includes('PING_OK'),
        category: 'HEALTHY',
        error: null
      };
    } else {
      let category = 'UPSTREAM_ERROR';
      if (res.status === 401) category = 'AUTH_INVALID';
      else if (res.status === 429) category = 'RATE_LIMITED';
      return {
        slot: `Groq Slot ${slotNum}`,
        provider: 'Groq Cloud',
        model,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: false,
        category,
        error: `HTTP ${res.status}`
      };
    }
  } catch (err) {
    return {
      slot: `Groq Slot ${slotNum}`,
      provider: 'Groq Cloud',
      model,
      masked: meta.masked,
      httpStatus: 0,
      latencyMs: Date.now() - start,
      inferenceSuccess: false,
      category: 'NETWORK_TIMEOUT',
      error: err.message
    };
  }
}

export async function runCloudProviderHealthCheck() {
  console.log('======================================================================');
  console.log('🚀 AI-BUILDER-BRAIN CLOUD-STARTUP PROVIDER HEALTH CHECK');
  console.log(`   Canonical Root: ${BRAIN_ROOT}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('======================================================================\n');

  const keys = loadAllAiKeys();
  const results = [];

  console.log(`Discovered Credential Slots: ${keys.gemini.length} Gemini slot(s), ${keys.groq.length} Groq slot(s).\n`);

  for (let i = 0; i < keys.gemini.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
    const key = keys.gemini[i];
    let res = await testGeminiSlot(key, i + 1, 'gemini-3.8-flash');
    if (!res.inferenceSuccess && res.httpStatus !== 200 && res.category !== 'AUTH_INVALID') {
      await new Promise((r) => setTimeout(r, 500));
      const fallbackRes = await testGeminiSlot(key, i + 1, 'gemini-flash-latest');
      if (fallbackRes.inferenceSuccess) res = fallbackRes;
    }
    results.push(res);
  }

  for (let i = 0; i < keys.groq.length; i++) {
    const key = keys.groq[i];
    const res = await testGroqSlot(key, i + 1, 'qwen/qwen3.8-27b');
    results.push(res);
  }

  // Print Clean Markdown Table (No API Keys Displayed)
  console.log('| Slot Identifier | Provider | Model | HTTP Status | Latency | Status | Category |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const statusIcon = r.inferenceSuccess ? '✅ LIVE_OK' : '⚠️ UNAVAILABLE';
    console.log(`| ${r.slot} (${r.masked}) | ${r.provider} | ${r.model} | ${r.httpStatus || 'N/A'} | ${r.latencyMs}ms | ${statusIcon} | ${r.category} |`);
  }
  console.log('');

  const healthyCount = results.filter(r => r.inferenceSuccess).length;
  console.log(`Provider Health Summary: ${healthyCount}/${results.length} active inference slots verified.`);

  if (healthyCount > 0) {
    console.log('✨ Live AI provider pool is READY for autonomous intelligence extraction.\n');
  } else {
    console.warn('⚠️ No live AI providers verified. Pipeline will safely use zero-clone structural synthesizer fallback.\n');
  }

  return { total: results.length, healthy: healthyCount, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCloudProviderHealthCheck().catch(err => {
    console.error('Provider health check error:', err);
    process.exit(0); // non-fatal to allow fallback
  });
}
