import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAllAiKeys, classifyCredential } from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

async function testGeminiSlot(key, slotNum, model = 'gemini-3.8-flash') {
  const meta = classifyCredential(key, 'gemini');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        keyClassification: meta.format,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: text.includes('PING_OK'),
        responseSnippet: text,
        error: null
      };
    } else {
      const errText = await res.text();
      let errJson = null;
      try { errJson = JSON.parse(errText); } catch (e) {}
      return {
        slot: `Gemini Slot ${slotNum}`,
        provider: 'Google AI Studio',
        model,
        keyClassification: meta.format,
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: false,
        responseSnippet: null,
        error: errJson?.error?.message || `HTTP ${res.status}: ${errText.slice(0, 100)}`
      };
    }
  } catch (err) {
    return {
      slot: `Gemini Slot ${slotNum}`,
      provider: 'Google AI Studio',
      model,
      keyClassification: meta.format,
      masked: meta.masked,
      httpStatus: 0,
      latencyMs: Date.now() - start,
      inferenceSuccess: false,
      responseSnippet: null,
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
        max_tokens: 10
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
        keyClassification: 'GROQ_API_KEY',
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: text.includes('PING_OK'),
        responseSnippet: text,
        error: null
      };
    } else {
      const errText = await res.text();
      let errJson = null;
      try { errJson = JSON.parse(errText); } catch (e) {}
      return {
        slot: `Groq Slot ${slotNum}`,
        provider: 'Groq Cloud',
        model,
        keyClassification: 'GROQ_API_KEY',
        masked: meta.masked,
        httpStatus: res.status,
        latencyMs: latency,
        inferenceSuccess: false,
        responseSnippet: null,
        error: errJson?.error?.message || `HTTP ${res.status}: ${errText.slice(0, 100)}`
      };
    }
  } catch (err) {
    return {
      slot: `Groq Slot ${slotNum}`,
      provider: 'Groq Cloud',
      model,
      keyClassification: 'GROQ_API_KEY',
      masked: meta.masked,
      httpStatus: 0,
      latencyMs: Date.now() - start,
      inferenceSuccess: false,
      responseSnippet: null,
      error: err.message
    };
  }
}

async function runAudit() {
  console.log('======================================================================');
  console.log('🔬 POST-REPAIR PRODUCTION AUDIT: LIVE AI PROVIDER VERIFICATION');
  console.log('======================================================================\n');

  const keys = loadAllAiKeys();
  const results = [];

  // Test all Gemini keys
  for (let i = 0; i < keys.gemini.length; i++) {
    const key = keys.gemini[i];
    // Test with gemini-3.8-flash first, then gemini-flash-latest if needed
    let res = await testGeminiSlot(key, i + 1, 'gemini-3.8-flash');
    if (!res.inferenceSuccess && res.httpStatus !== 200) {
      // Test fallback model
      const fallbackRes = await testGeminiSlot(key, i + 1, 'gemini-flash-latest');
      if (fallbackRes.inferenceSuccess) {
        res = fallbackRes;
      }
    }
    results.push(res);
  }

  // Test Groq keys
  for (let i = 0; i < keys.groq.length; i++) {
    const key = keys.groq[i];
    const res = await testGroqSlot(key, i + 1, 'qwen/qwen3.8-27b');
    results.push(res);
  }

  console.log(JSON.stringify(results, null, 2));
}

runAudit();
