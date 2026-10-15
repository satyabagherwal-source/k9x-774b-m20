/**
 * Autonomous Quota Router & Provider Switch Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\quota-router.mjs
 * Purpose: Proactive quota tracking, rate limit monitoring, error classification,
 *          circuit-breaking, and cascade switching across AI models/providers.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FAILURE_CLASSES, createAgentHandoffPayload, validateAgentHandoffContract } from './task-contract.mjs';
import { loadAllAiKeys } from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// Default safe operational envelopes (RPM, TPM, RPD)
export const DEFAULT_PROVIDER_LIMITS = {
  'groq': {
    maxRpm: 30,
    maxTpm: 6000,
    maxRpd: 14400,
    resetIntervalMs: 60 * 1000
  },
  'gemini-flash': {
    maxRpm: 15,
    maxTpm: 1000000,
    maxRpd: 1500,
    resetIntervalMs: 60 * 1000
  },
  'gemini-pro': {
    maxRpm: 5,
    maxTpm: 250000,
    maxRpd: 50,
    resetIntervalMs: 60 * 1000
  },
  'claude': {
    maxRpm: 50,
    maxTpm: 40000,
    maxRpd: 10000,
    resetIntervalMs: 60 * 1000
  },
  'ollama': {
    maxRpm: 1000,
    maxTpm: 10000000,
    maxRpd: 1000000,
    resetIntervalMs: 60 * 1000
  }
};

/**
 * Tracks usage, rate-limits, error rates, and quota consumption across providers
 */
export class QuotaTracker {
  constructor(options = {}) {
    this.switchThreshold = options.switchThreshold || 0.85; // 85% default switch threshold
    this.safetyMargin = options.safetyMargin || 0.10; // 10% safety margin
    this.providerLimits = { ...DEFAULT_PROVIDER_LIMITS, ...(options.limits || {}) };
    
    // In-memory sliding window usage state
    this.usage = new Map();
    // Circuit breaker state
    this.circuits = new Map();
    // Mock signals for deterministic testing
    this.mockSignals = new Map();
    // Recorded switch history
    this.switchHistory = [];
  }

  _getProviderState(provider) {
    if (!this.usage.has(provider)) {
      this.usage.set(provider, {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        requestsToday: 0,
        windowStartMs: Date.now(),
        consecutiveErrors: 0,
        lastError: null,
        lastErrorAt: null,
        circuitOpenUntil: 0
      });
    }
    const state = this.usage.get(provider);
    const now = Date.now();
    // Reset minute window if elapsed
    if (now - state.windowStartMs > 60000) {
      state.requestsThisMinute = 0;
      state.tokensThisMinute = 0;
      state.windowStartMs = now;
    }
    return state;
  }

  /**
   * Set mock quota signals for testing
   */
  setMockQuota(provider, mockConfig = {}) {
    this.mockSignals.set(provider, {
      remainingPct: mockConfig.remainingPct !== undefined ? mockConfig.remainingPct : 1.0,
      isExhausted: !!mockConfig.isExhausted,
      forceSwitch: !!mockConfig.forceSwitch,
      rateLimitActive: !!mockConfig.rateLimitActive,
      simulatedError: mockConfig.simulatedError || null
    });
  }

  clearMockQuota(provider = null) {
    if (provider) {
      this.mockSignals.delete(provider);
    } else {
      this.mockSignals.clear();
    }
  }

  /**
   * Records usage metrics after an API call
   */
  recordUsage(provider, { tokens = 0, responseHeaders = null } = {}) {
    const state = this._getProviderState(provider);
    state.requestsThisMinute += 1;
    state.requestsToday += 1;
    state.tokensThisMinute += tokens;
    state.consecutiveErrors = 0;

    // Ingest live rate-limit headers if available (standard x-ratelimit headers)
    if (responseHeaders && typeof responseHeaders === 'object') {
      const remainingTokens = parseInt(responseHeaders['x-ratelimit-remaining-tokens'] || responseHeaders['ratelimit-remaining-tokens'], 10);
      const limitTokens = parseInt(responseHeaders['x-ratelimit-limit-tokens'] || responseHeaders['ratelimit-limit-tokens'], 10);
      if (!isNaN(remainingTokens) && !isNaN(limitTokens) && limitTokens > 0) {
        state.headerRemainingTokensPct = remainingTokens / limitTokens;
      }
      const remainingRequests = parseInt(responseHeaders['x-ratelimit-remaining-requests'] || responseHeaders['ratelimit-remaining-requests'], 10);
      const limitRequests = parseInt(responseHeaders['x-ratelimit-limit-requests'] || responseHeaders['ratelimit-limit-requests'], 10);
      if (!isNaN(remainingRequests) && !isNaN(limitRequests) && limitRequests > 0) {
        state.headerRemainingRequestsPct = remainingRequests / limitRequests;
      }
    }
  }

  /**
   * Classify error into a standard FAILURE_CLASS
   */
  classifyProviderError(err) {
    if (!err) return FAILURE_CLASSES.RUNTIME_EXCEPTION;
    const msg = (err.message || String(err)).toLowerCase();
    const status = err.status || err.statusCode || (err.response && err.response.status);

    if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('api key not valid') || msg.includes('forbidden')) {
      return FAILURE_CLASSES.AUTH_FAILURE;
    }
    if (status === 429 || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('exceeded your current quota')) {
      return FAILURE_CLASSES.QUOTA_EXHAUSTED;
    }
    if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('too many requests')) {
      return FAILURE_CLASSES.RATE_LIMIT;
    }
    if (msg.includes('context length') || msg.includes('maximum context') || msg.includes('token limit exceeded') || msg.includes('prompt too long')) {
      return FAILURE_CLASSES.CONTEXT_EXHAUSTION;
    }
    if (status >= 500 || msg.includes('bad gateway') || msg.includes('service unavailable') || msg.includes('econnrefused') || msg.includes('gateway timeout')) {
      return FAILURE_CLASSES.PROVIDER_OUTAGE;
    }
    if (msg.includes('timeout') || msg.includes('etimedout')) {
      return FAILURE_CLASSES.TIMEOUT;
    }
    if (msg.includes('safety') || msg.includes('blocked by policy') || msg.includes('harmful content')) {
      return FAILURE_CLASSES.SAFETY_BOUNDARY_BLOCKED;
    }
    return FAILURE_CLASSES.RUNTIME_EXCEPTION;
  }

  /**
   * Records a provider failure and adjusts circuit breaker
   */
  recordError(provider, err) {
    const state = this._getProviderState(provider);
    const failureClass = this.classifyProviderError(err);
    state.consecutiveErrors += 1;
    state.lastError = { message: err.message || String(err), failureClass };
    state.lastErrorAt = Date.now();

    // Circuit breaker trip logic:
    // Quota exhausted or Auth failure trips circuit for 10 minutes
    // Rate limit trips circuit for 60 seconds
    // 3 consecutive 5xx errors trips circuit for 2 minutes
    const now = Date.now();
    if (failureClass === FAILURE_CLASSES.QUOTA_EXHAUSTED || failureClass === FAILURE_CLASSES.AUTH_FAILURE) {
      state.circuitOpenUntil = now + (10 * 60 * 1000);
    } else if (failureClass === FAILURE_CLASSES.RATE_LIMIT) {
      state.circuitOpenUntil = now + (60 * 1000);
    } else if (state.consecutiveErrors >= 3) {
      state.circuitOpenUntil = now + (2 * 60 * 1000);
    }

    return failureClass;
  }

  /**
   * Evaluates if the current provider should be switched BEFORE exhausting quota
   */
  shouldSwitch(provider) {
    // 1. Check mock signals first (for deterministic unit/integration testing)
    const mock = this.mockSignals.get(provider);
    if (mock) {
      if (mock.forceSwitch) {
        return { switchRequired: true, reason: 'MOCK_FORCED_SWITCH', currentUsagePct: 1.0, failureClass: null };
      }
      if (mock.isExhausted) {
        return { switchRequired: true, reason: 'MOCK_QUOTA_EXHAUSTED', currentUsagePct: 1.0, failureClass: FAILURE_CLASSES.QUOTA_EXHAUSTED };
      }
      if (mock.rateLimitActive) {
        return { switchRequired: true, reason: 'MOCK_RATE_LIMIT_TRIGGERED', currentUsagePct: 0.95, failureClass: FAILURE_CLASSES.RATE_LIMIT };
      }
      if (mock.simulatedError) {
        const failureClass = this.classifyProviderError(new Error(mock.simulatedError));
        return { switchRequired: true, reason: `MOCK_ERROR: ${mock.simulatedError}`, currentUsagePct: 1.0, failureClass };
      }
      if (mock.remainingPct !== undefined && mock.remainingPct <= (1.0 - this.switchThreshold)) {
        const usagePct = 1.0 - mock.remainingPct;
        return {
          switchRequired: true,
          reason: `MOCK_PREEMPTIVE_THRESHOLD: Usage ${(usagePct * 100).toFixed(1)}% exceeds ${(this.switchThreshold * 100)}% threshold`,
          currentUsagePct: usagePct,
          failureClass: null
        };
      }
    }

    const state = this._getProviderState(provider);
    const now = Date.now();

    // 2. Check circuit breaker
    if (state.circuitOpenUntil > now) {
      const remainingSec = Math.ceil((state.circuitOpenUntil - now) / 1000);
      return {
        switchRequired: true,
        reason: `CIRCUIT_OPEN: Provider resting for ${remainingSec}s (${state.lastError?.failureClass || 'ERROR'})`,
        currentUsagePct: 1.0,
        failureClass: state.lastError?.failureClass || FAILURE_CLASSES.PROVIDER_OUTAGE
      };
    }

    // 3. Check header-reported limits if available
    if (state.headerRemainingTokensPct !== undefined && state.headerRemainingTokensPct < (1.0 - this.switchThreshold)) {
      const usagePct = 1.0 - state.headerRemainingTokensPct;
      return {
        switchRequired: true,
        reason: `HEADER_PREEMPTIVE_TOKEN_THRESHOLD: ${(usagePct * 100).toFixed(1)}% consumed (threshold ${(this.switchThreshold * 100)}%)`,
        currentUsagePct: usagePct,
        failureClass: null
      };
    }

    if (state.headerRemainingRequestsPct !== undefined && state.headerRemainingRequestsPct < (1.0 - this.switchThreshold)) {
      const usagePct = 1.0 - state.headerRemainingRequestsPct;
      return {
        switchRequired: true,
        reason: `HEADER_PREEMPTIVE_REQUEST_THRESHOLD: ${(usagePct * 100).toFixed(1)}% consumed (threshold ${(this.switchThreshold * 100)}%)`,
        currentUsagePct: usagePct,
        failureClass: null
      };
    }

    // 4. Check envelope tracking (sliding window RPM and RPD)
    const limits = this.providerLimits[provider] || this.providerLimits['gemini-flash'] || {};
    if (limits.maxRpm && limits.maxRpm > 0) {
      const rpmUsage = state.requestsThisMinute / limits.maxRpm;
      if (rpmUsage >= this.switchThreshold) {
        return {
          switchRequired: true,
          reason: `SLIDING_RPM_THRESHOLD: ${state.requestsThisMinute}/${limits.maxRpm} req/min (${(rpmUsage * 100).toFixed(1)}% >= ${(this.switchThreshold * 100)}%)`,
          currentUsagePct: rpmUsage,
          failureClass: FAILURE_CLASSES.RATE_LIMIT
        };
      }
    }

    if (limits.maxRpd && limits.maxRpd > 0) {
      const rpdUsage = state.requestsToday / limits.maxRpd;
      if (rpdUsage >= this.switchThreshold) {
        return {
          switchRequired: true,
          reason: `DAILY_RPD_THRESHOLD: ${state.requestsToday}/${limits.maxRpd} req/day (${(rpdUsage * 100).toFixed(1)}% >= ${(this.switchThreshold * 100)}%)`,
          currentUsagePct: rpdUsage,
          failureClass: FAILURE_CLASSES.QUOTA_EXHAUSTED
        };
      }
    }

    return { switchRequired: false, reason: 'HEALTHY', currentUsagePct: 0.0, failureClass: null };
  }

  /**
   * Log an agent/provider switch in durable task history
   */
  recordSwitch(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      from_provider: entry.from_provider,
      to_provider: entry.to_provider,
      reason: entry.reason,
      task_id: entry.task_id,
      step_id: entry.step_id,
      handoff_id: entry.handoff_id || null,
      success: entry.success !== false
    };
    this.switchHistory.push(record);
    return record;
  }
}

/**
 * Provider Cascade Router: selects healthy, authenticated models according to
 * tiered effort cascade rules (Groq -> Gemini Flash -> Gemini Pro -> Claude -> Local Ollama)
 */
export class ProviderCascadeRouter {
  constructor(options = {}) {
    this.quotaTracker = options.quotaTracker || new QuotaTracker(options);
    this.configuredKeys = loadAllAiKeys();
    
    // Configurable cascade sequence
    this.cascadeSequence = options.cascadeSequence || [
      'groq',
      'gemini-flash',
      'gemini-pro',
      'claude',
      'ollama'
    ];
  }

  /**
   * Inspects credentials and returns all eligible, authenticated providers
   */
  getEligibleProviders() {
    const eligible = [];
    for (const provider of this.cascadeSequence) {
      if (provider === 'groq' && this.configuredKeys.groq.length > 0) {
        eligible.push({ provider: 'groq', model: 'llama-3.3-70b-versatile', keyCount: this.configuredKeys.groq.length });
      } else if (provider === 'gemini-flash' && this.configuredKeys.gemini.length > 0) {
        eligible.push({ provider: 'gemini-flash', model: 'gemini-3.8-flash', keyCount: this.configuredKeys.gemini.length });
      } else if (provider === 'gemini-pro' && this.configuredKeys.gemini.length > 0) {
        eligible.push({ provider: 'gemini-pro', model: 'gemini-flash-latest', keyCount: this.configuredKeys.gemini.length });
      } else if (provider === 'claude' && this.configuredKeys.claude.length > 0) {
        eligible.push({ provider: 'claude', model: 'claude-3-5-sonnet', keyCount: this.configuredKeys.claude.length });
      } else if (provider === 'ollama') {
        // Ollama is always eligible as local zero-quota fallback
        eligible.push({ provider: 'ollama', model: 'local-ollama', keyCount: 1 });
      }
    }
    return eligible;
  }

  /**
   * Selects the next eligible provider when the current provider triggers a switch
   */
  selectNextEligibleProvider(currentProvider = null) {
    const eligible = this.getEligibleProviders();
    if (eligible.length === 0) {
      throw new Error('Zero eligible or authenticated AI providers found.');
    }

    // Try providers after currentProvider in sequence
    let startIndex = 0;
    if (currentProvider) {
      const currIdx = eligible.findIndex(p => p.provider === currentProvider);
      if (currIdx >= 0) {
        startIndex = (currIdx + 1) % eligible.length;
      }
    }

    for (let i = 0; i < eligible.length; i++) {
      const idx = (startIndex + i) % eligible.length;
      const candidate = eligible[idx];
      const check = this.quotaTracker.shouldSwitch(candidate.provider);
      if (!check.switchRequired) {
        return candidate;
      }
    }

    // If all cloud providers are switching, return Ollama if available
    const ollama = eligible.find(p => p.provider === 'ollama');
    if (ollama) return ollama;

    // If literally everything is exhausted, return first eligible with warning
    return eligible[0];
  }

  /**
   * Conducts a safe, durable handoff from current provider to next eligible provider
   */
  performPreemptiveHandoff(contract, currentProvider, switchReason, options = {}) {
    const nextCandidate = this.selectNextEligibleProvider(currentProvider);
    
    // 1. Build standardized agent handoff payload
    const handoff = createAgentHandoffPayload(contract, {
      from_provider: currentProvider,
      to_provider: nextCandidate.provider,
      switch_reason: switchReason,
      project_root: options.project_root,
      git_branch: options.git_branch,
      git_commit: options.git_commit,
      changed_files: options.changed_files,
      artifact_references: options.artifact_references,
      test_evidence: options.test_evidence,
      known_failures: options.known_failures
    });

    const validation = validateAgentHandoffContract(handoff);
    if (!validation.valid) {
      throw new Error(`Agent handoff payload validation failed: ${validation.errors.join(', ')}`);
    }

    // 2. Record switch history
    this.quotaTracker.recordSwitch({
      from_provider: currentProvider,
      to_provider: nextCandidate.provider,
      reason: switchReason,
      task_id: contract.task_id,
      step_id: contract.checkpoint?.current_step || 0,
      handoff_id: handoff.handoff_id
    });

    return {
      handoff,
      nextProvider: nextCandidate.provider,
      nextModel: nextCandidate.model
    };
  }
}
