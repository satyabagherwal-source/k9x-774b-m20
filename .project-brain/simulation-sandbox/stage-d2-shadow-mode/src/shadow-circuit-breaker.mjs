/**
 * Shadow Mode Circuit Breaker & Resource Limiter
 *
 * Enforces strict safety limits on shadow pipeline execution:
 * 1. Timeout protection: Aborts shadow execution if it exceeds timeoutMs (default 3000ms).
 * 2. Concurrency / Batch limit: Rejects batches exceeding maxBatchSize (default 5).
 * 3. Circuit breaker: Trips after maxConsecutiveFailures (default 3) and enters cooldown.
 * 4. Zero exception leak: Never allows shadow execution exceptions to escape to caller.
 */

export class ShadowCircuitBreaker {
  constructor(options = {}) {
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.cooldownMs = options.cooldownMs || 60000;
    this.timeoutMs = options.timeoutMs || 3000;
    this.maxBatchSize = options.maxBatchSize || 5;

    this.consecutiveFailures = 0;
    this.state = 'CLOSED'; // 'CLOSED' (normal), 'OPEN' (tripped), 'HALF_OPEN'
    this.trippedAt = null;
    this.totalExecutions = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.totalTimeouts = 0;
    this.totalTrips = 0;
  }

  isOpen() {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.trippedAt > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.totalSuccesses++;
  }

  recordFailure(reason = 'execution_failure') {
    this.consecutiveFailures++;
    this.totalFailures++;
    if (reason === 'timeout') {
      this.totalTimeouts++;
    }
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.state = 'OPEN';
      this.trippedAt = Date.now();
      this.totalTrips++;
    }
  }

  reset() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.trippedAt = null;
  }

  /**
   * Validates if a batch exceeds resource limit.
   */
  validateBatchSize(items) {
    const count = Array.isArray(items) ? items.length : 1;
    if (count > this.maxBatchSize) {
      return {
        allowed: false,
        reason: `Batch size ${count} exceeds shadow limit of ${this.maxBatchSize}`
      };
    }
    return { allowed: true };
  }

  /**
   * Executes an async operation with timeout and circuit breaker protection.
   * If circuit is open or timeout occurs, fails safely without throwing.
   */
  async execute(fn, customTimeoutMs = null) {
    this.totalExecutions++;
    const timeout = customTimeoutMs || this.timeoutMs;

    if (this.isOpen()) {
      return {
        executed: false,
        error: 'CIRCUIT_OPEN',
        details: `Shadow circuit breaker is OPEN (tripped at ${new Date(this.trippedAt).toISOString()})`,
        consecutiveFailures: this.consecutiveFailures
      };
    }

    let timer = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`Shadow execution timed out after ${timeout}ms`);
          err.code = 'TIMEOUT';
          reject(err);
        }, timeout);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timer);
      this.recordSuccess();
      return {
        executed: true,
        success: true,
        result
      };
    } catch (err) {
      if (timer) clearTimeout(timer);
      const isTimeout = err.code === 'TIMEOUT';
      this.recordFailure(isTimeout ? 'timeout' : 'error');
      return {
        executed: true,
        success: false,
        error: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
        message: err.message,
        circuitState: this.state
      };
    }
  }

  getMetrics() {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalExecutions: this.totalExecutions,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalTimeouts: this.totalTimeouts,
      totalTrips: this.totalTrips,
      trippedAt: this.trippedAt ? new Date(this.trippedAt).toISOString() : null
    };
  }
}

