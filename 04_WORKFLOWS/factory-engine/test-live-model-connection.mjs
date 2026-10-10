/**
 * Live AI Model Connection & Integration Verification Suite (Milestone 7)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-live-model-connection.mjs
 * Purpose: Verifies Milestone 7: Live model connection probe, real API authentication audit,
 *          cold model execution, and comparative evaluation with empirical evidence.
 * 
 * Protocol: Strict Evidence-Backed Protocol:
 *          - If no valid credentials, reports explicit blocker (NO fake responses).
 *          - If credentials active, executes live model calls and records latency & request ID.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  loadAllAiKeys, 
  classifyCredential, 
  resolveGeminiCredentialDiagnostics, 
  GEMINI_MODELS, 
  tripKeyCircuitBreaker, 
  getKeyCircuitState 
} from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🔌 LIVE AI MODEL CONNECTION & INTEGRATION VERIFICATION (MILESTONE 7)');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? `(${details})` : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

/**
 * Validates model generation text output
 */
export function validateModelOutput(output) {
  if (!output || typeof output !== 'string' || output.trim().length === 0) {
    return { valid: false, reason: 'Output is null, empty, or whitespace-only' };
  }
  return { valid: true, length: output.trim().length };
}

async function runMilestone7Audit() {
  // ---------------------------------------------------------------------------
  // TEST 1: Missing-Key Resolution & Actionable Error Guard
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Testing Missing-Key Resolution & Actionable Error Guard...');
  const missingResult = classifyCredential(null, 'gemini');
  assert(!missingResult.present, 'Correctly flags null key as missing');
  assert(!missingResult.validFormat, 'Flags format as invalid when missing');
  assert(missingResult.authMethod === 'NONE', 'Auth method set to NONE for missing key');
  assert(missingResult.error !== null && missingResult.error.length > 0, 'Actionable error generated for missing key');

  const emptyStringResult = classifyCredential('', 'gemini');
  assert(!emptyStringResult.present, 'Correctly flags empty string as missing');

  // ---------------------------------------------------------------------------
  // TEST 2: Credential Diagnosis & Authentication Format Recognition
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing Credential Diagnosis & Authentication Format Recognition...');
  const diag = resolveGeminiCredentialDiagnostics();

  console.log(`  - Credential Present      : ${diag.present ? 'YES' : 'NO'}`);
  console.log(`  - Resolved Source         : ${diag.source} (${diag.keyName})`);
  console.log(`  - Format Classification   : ${diag.classification.format}`);
  console.log(`  - Redacted Masked Value   : ${diag.classification.masked}`);
  console.log(`  - Raw Key Length          : ${diag.classification.length} chars`);

  assert(diag.present, 'Credential present in configured store', diag.source);
  assert(
    diag.classification.format === 'GOOGLE_AI_STUDIO_API_KEY_V2' || diag.classification.format === 'GOOGLE_AI_STUDIO_API_KEY', 
    'Correctly diagnosed official Google AI Studio API key format', 
    diag.classification.format
  );
  assert(diag.classification.validFormat === true, 'Flagged validFormat = true for Google AI Studio API key');
  assert(diag.classification.authMethod === 'HEADER_X_GOOG_API_KEY', 'Uses official x-goog-api-key header authentication');

  // Verify that an invalid token is correctly rejected by provider gate
  const dummyInvalidKey = 'AQ.INVALID_MALFORMED_PROBE_TEST_KEY_REJECT_401';
  try {
    const probeRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': dummyInvalidKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'PONG' }] }] })
    });
    assert(probeRes.status === 400 || probeRes.status === 401 || probeRes.status === 403, 
      'Provider gateway rejects invalid/malformed token', `HTTP ${probeRes.status}`);
  } catch (e) {}

  // ---------------------------------------------------------------------------
  // TEST 3: Real Live Model Execution with Valid Credential
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Real Live Model Execution with Valid Credential...');
  let liveModelConnected = false;
  let modelIdentifier = null;
  let actualModelCallsCompleted = 0;
  let probeLatencyMs = 0;
  let modelOutputText = '';

  if (diag.classification.validFormat && diag.activeKey) {
    const targetModel = GEMINI_MODELS[0] || 'gemini-3.8-flash';
    console.log(`  - Sending live model request to ${targetModel}...`);
    const startTime = Date.now();

    try {
      const liveRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': diag.activeKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with "PONG"' }] }]
        })
      });

      probeLatencyMs = Date.now() - startTime;
      console.log(`  - HTTP Status: ${liveRes.status} ${liveRes.statusText} (${probeLatencyMs}ms)`);

      if (liveRes.status === 200) {
        const liveData = await liveRes.json();
        const text = liveData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          liveModelConnected = true;
          modelIdentifier = targetModel;
          actualModelCallsCompleted = 1;
          modelOutputText = text.trim();
          console.log(`  ✨ [LIVE MODEL CONFIRMED] Model responded: "${modelOutputText}" in ${probeLatencyMs}ms`);
        }
      } else {
        const errBody = await liveRes.text();
        console.warn(`  ❌ [PROVIDER ERROR] HTTP ${liveRes.status}: ${errBody.slice(0, 160)}`);
      }
    } catch (e) {
      console.error(`  ❌ [NETWORK ERROR] ${e.message}`);
    }
  }

  assert(liveModelConnected === true, 'Live AI Model successfully connected and executed', modelIdentifier);
  assert(actualModelCallsCompleted === 1, 'Actual model calls completed recorded', `Completed: ${actualModelCallsCompleted}`);
  assert(modelOutputText.length > 0, 'Model returned verified non-empty intelligence text', modelOutputText);

  // ---------------------------------------------------------------------------
  // TEST 4: Response Content Non-Empty Validation Guard
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Non-Empty Model Content Validation Guard...');
  assert(!validateModelOutput(null).valid, 'Rejects null model output');
  assert(!validateModelOutput('').valid, 'Rejects empty model output');
  assert(!validateModelOutput('   ').valid, 'Rejects whitespace-only model output');
  assert(validateModelOutput(modelOutputText).valid, 'Accepts verified live model response content');

  // ---------------------------------------------------------------------------
  // TEST 5: Provider Failure & Isolated Circuit Breaker
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Provider Failure & Isolated Circuit Breaker...');
  const testKey = 'test-probe-key-xyz-1234';
  tripKeyCircuitBreaker(testKey, 120_000, 'Provider Rate Limit Probe Test', 'Google Gemini');
  const trippedState = getKeyCircuitState(testKey, 'Google Gemini');
  assert(trippedState.status === 'RATE_LIMITED' || trippedState.status === 'QUOTA_EXHAUSTED', 
    'Failing key entered isolated cooldown state', trippedState.status);

  const ollamaState = getKeyCircuitState('http://localhost:11434', 'Local Ollama');
  assert(ollamaState.status === 'HEALTHY', 
    'Other providers remain HEALTHY and unaffected by Gemini cooldown');

  // ---------------------------------------------------------------------------
  // TEST 6: Verification of Real MCP Client & Live Model Connection
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Decoupling & Verification of MCP Client and Live Model...');
  const mcpGlobalPath = 'C:\\Users\\Admin\\.gemini\\config\\mcp_config.json';
  let realMcpClientConnected = false;

  if (fs.existsSync(mcpGlobalPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(mcpGlobalPath, 'utf-8'));
      if (cfg.mcpServers?.['ai-builder-brain']) {
        realMcpClientConnected = true;
      }
    } catch (e) {}
  }

  assert(realMcpClientConnected === true, 
    'Real MCP Client Connected: YES (Registered in Antigravity IDE global config)');
  assert(liveModelConnected === true, 
    'Live Model Connected: YES (Verified via live HTTP 200 response)');

  // ---------------------------------------------------------------------------
  // FINAL SCORECARD
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('📊 MILESTONE 7 FINAL VERIFICATION SCORECARD');
  console.log('======================================================================');
  console.log(`Live Model Connected     : ${liveModelConnected ? 'YES' : 'NO'}`);
  console.log(`Active Model             : ${modelIdentifier}`);
  console.log(`Latency                  : ${probeLatencyMs}ms`);
  console.log(`Actual Model Calls Done  : ${actualModelCallsCompleted}`);
  console.log(`Real MCP Client Connected: ${realMcpClientConnected ? 'YES' : 'NO'}`);
  console.log(`Resolved Source          : ${diag.source} (${diag.keyName})`);
  console.log(`Key Format               : ${diag.classification.format} (${diag.classification.masked})`);
  console.log(`Authentication Method    : ${diag.classification.authMethod}`);
  console.log(`Live Output Received     : "${modelOutputText}"`);
  console.log('======================================================================');
  console.log(`🏁 LIVE MODEL VERIFICATION SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) process.exit(1);
  else process.exit(0);
}

runMilestone7Audit();
