/**
 * Test Suite: Rule 319 - Resilient Saga Compensation, Durable Idempotency & Transactional Outbox
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-rule-319-resilient-saga.mjs
 * Purpose: Empirically verifies the 7 core invariants of Rule 319:
 *          1. Duplicate compensation requests
 *          2. Process restart after recording or initiating a compensation
 *          3. Timeout after the external provider may have completed the refund
 *          4. Concurrent duplicate requests
 *          5. Durable idempotency-key reuse and conflicting payloads
 *          6. Transactional outbox recovery and duplicate event delivery
 *          7. Failure between local state changes and external side effects
 * 
 * NOTE: Deterministic Simulation Harness. All external dependencies (Stripe/Bank, DB, Broker)
 *       are simulated via deterministic in-process mocks. Real payment provider was NOT invoked.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import crypto from 'crypto';
import {
  IdempotentCompensationHandler,
  DurableIdempotentCompensationStore
} from './gap-closure-verifier.mjs';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Deterministic Simulation: External Payment Provider (e.g. Stripe API)
 */
class SimulatedExternalPaymentProvider {
  constructor() {
    this.refundCallCount = 0;
    this.statusQueryCount = 0;
    this.ledger = new Map(); // idempotencyKey -> receipt
    this.shouldTimeoutOnNextCall = false;
    this.timeoutExecutedInternally = false;
  }

  refund(amountOrPayload, options = {}) {
    this.refundCallCount++;
    const idempotencyKey = options.idempotencyKey || `auto-${Date.now()}`;

    // If key was already processed by provider, return existing receipt (provider idempotency)
    if (this.ledger.has(idempotencyKey)) {
      return this.ledger.get(idempotencyKey);
    }

    if (this.shouldTimeoutOnNextCall) {
      this.shouldTimeoutOnNextCall = false;
      if (this.timeoutExecutedInternally) {
        // Provider executed mutation, but response timed out over the wire
        const receipt = {
          stripeRefundId: `re_sim_${Date.now()}`,
          amount: typeof amountOrPayload === 'number' ? amountOrPayload : amountOrPayload.amount,
          currency: 'usd',
          status: 'succeeded',
          timestamp: new Date().toISOString()
        };
        this.ledger.set(idempotencyKey, receipt);
      }
      const timeoutErr = new Error('ETIMEDOUT: Connection to payment provider timed out after 5000ms');
      timeoutErr.code = 'ETIMEDOUT';
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    const receipt = {
      stripeRefundId: `re_sim_${Date.now()}`,
      amount: typeof amountOrPayload === 'number' ? amountOrPayload : amountOrPayload.amount,
      currency: 'usd',
      status: 'succeeded',
      timestamp: new Date().toISOString()
    };
    this.ledger.set(idempotencyKey, receipt);
    return receipt;
  }

  queryRefundStatus(idempotencyKey) {
    this.statusQueryCount++;
    if (this.ledger.has(idempotencyKey)) {
      return {
        completed: true,
        receipt: this.ledger.get(idempotencyKey)
      };
    }
    return { completed: false, receipt: null };
  }
}

/**
 * Deterministic Simulation: Downstream Event Consumer with Idempotent Deduplication
 */
class SimulatedDownstreamEventConsumer {
  constructor() {
    this.processedEvents = new Set();
    this.processedCount = 0;
    this.duplicateSuppressedCount = 0;
    this.deallocatedSeats = 0;
  }

  handleEvent(event) {
    if (this.processedEvents.has(event.eventId)) {
      this.duplicateSuppressedCount++;
      return { status: 'EVENT_ALREADY_PROCESSED', eventId: event.eventId };
    }
    this.processedEvents.add(event.eventId);
    this.processedCount++;
    this.deallocatedSeats += 1; // Perform business mutation
    return { status: 'EVENT_COMMITTED', eventId: event.eventId };
  }
}

async function runRule319TestSuite() {
  console.log('='.repeat(70));
  console.log('🧪 TEST SUITE: RULE 319 - RESILIENT SAGA COMPENSATION & OUTBOX INVARIANTS');
  console.log('   Simulation Notice: Deterministic Mock Harness (No real payment network invoked)');
  console.log('='.repeat(70));

  // =========================================================================
  // [TEST 1] Duplicate Compensation Requests
  // =========================================================================
  console.log('\n[TEST 1] Scenario 1: Duplicate Compensation Retransmissions...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    const mockProvider = new SimulatedExternalPaymentProvider();

    const sagaId = 'saga-order-cancellation-001';
    const stepId = 'step-prorated-refund';

    // Attempt 1: Normal initial execution
    const out1 = handler.executeCompensation(sagaId, stepId, 45, mockProvider);
    assert(out1.status === 'COMPENSATION_COMMITTED', 'Initial compensation returned COMPENSATION_COMMITTED');
    assert(out1.retransmitted === false, 'Initial compensation flagged as not retransmitted');
    assert(mockProvider.refundCallCount === 1, 'Provider refund invoked exactly once on first attempt');

    // Attempt 2: Duplicate retransmission with identical parameters
    const out2 = handler.executeCompensation(sagaId, stepId, 45, mockProvider);
    assert(out2.status === 'ALREADY_COMPENSATED', 'Retransmission caught by idempotency barrier and returned ALREADY_COMPENSATED');
    assert(out2.retransmitted === true, 'Flagged as retransmission');
    assert(mockProvider.refundCallCount === 1, 'Provider refund call count remains exactly 1 (Zero duplicate refund)');
    assert(out2.result.stripeRefundId === out1.result.stripeRefundId, 'Returned identical deterministic receipt');
  }

  // =========================================================================
  // [TEST 2] Process Restart Simulation After Recording Compensation
  // =========================================================================
  console.log('\n[TEST 2] Scenario 2: Process Restart & Crash Recovery...');
  {
    const primaryStore = new DurableIdempotentCompensationStore();
    const primaryHandler = new IdempotentCompensationHandler(primaryStore);
    const mockProvider = new SimulatedExternalPaymentProvider();

    const sagaId = 'saga-sub-cancel-002';
    const stepId = 'step-charge-refund';

    // Step 2A: Commit on primary process instance
    primaryHandler.executeCompensation(sagaId, stepId, 80, mockProvider);
    assert(mockProvider.refundCallCount === 1, 'Primary process committed compensation');

    // Step 2B: Simulate crash & process restart (new memory space, restored from durable store)
    const restartedStore = primaryStore.simulateRestart();
    const restartedHandler = new IdempotentCompensationHandler(restartedStore);

    // Step 2C: Retransmission arrives at newly restarted process
    const outRestart = restartedHandler.executeCompensation(sagaId, stepId, 80, mockProvider);
    assert(outRestart.status === 'ALREADY_COMPENSATED', 'Restarted process safely recognized compensation from durable storage');
    assert(outRestart.retransmitted === true, 'Flagged as retransmission after restart');
    assert(mockProvider.refundCallCount === 1, 'CRITICAL: Zero duplicate refund across simulated process crash and restart');
  }

  // =========================================================================
  // [TEST 3] External Provider Timeout Reconciliation
  // =========================================================================
  console.log('\n[TEST 3] Scenario 3: External Provider Timeout with Status Reconciliation...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    const mockProvider = new SimulatedExternalPaymentProvider();

    const sagaId = 'saga-sub-cancel-003';
    const stepId = 'step-stripe-timeout-recovery';

    // Configure simulation: provider completes refund, but response times out over wire
    mockProvider.shouldTimeoutOnNextCall = true;
    mockProvider.timeoutExecutedInternally = true;

    // Handler executes compensation and automatically enters timeout recovery reconciliation
    const outTimeout = handler.executeCompensation(sagaId, stepId, 120, mockProvider);
    assert(outTimeout.status === 'COMPENSATION_COMMITTED', 'Status recovered to COMPENSATION_COMMITTED via provider query');
    assert(outTimeout.reconciled === true, 'Flagged as reconciled through provider query');
    assert(mockProvider.refundCallCount === 1, 'Provider refund was called exactly once');
    assert(mockProvider.statusQueryCount === 1, 'Recovery sweeper queried provider status using deterministic idempotency key');

    // Subsequent retransmission is safely caught
    const outSubsequent = handler.executeCompensation(sagaId, stepId, 120, mockProvider);
    assert(outSubsequent.status === 'ALREADY_COMPENSATED', 'Subsequent retry returns ALREADY_COMPENSATED');
    assert(mockProvider.refundCallCount === 1, 'Provider refund count remains exactly 1 after timeout reconciliation');
  }

  // =========================================================================
  // [TEST 4] Concurrent Duplicate Requests
  // =========================================================================
  console.log('\n[TEST 4] Scenario 4: Concurrent Duplicate Request Protection...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    const mockProvider = new SimulatedExternalPaymentProvider();

    const sagaId = 'saga-concurrent-004';
    const stepId = 'step-refund';

    // Simulate two concurrent requests arriving in parallel
    // We simulate by setting the lease in PENDING state before second call executes
    const idempotencyKey = `saga:${sagaId}:step:${stepId}:compensate`;
    store.records.set(idempotencyKey, {
      idempotencyKey,
      sagaId,
      stepId,
      payloadHash: handler.computePayloadHash({ amount: 50, currency: 'USD', sagaId, stepId }),
      status: 'PENDING',
      leaseExpiresAt: Date.now() + 10000,
      updatedAt: new Date().toISOString()
    });

    // Concurrent request arrives while lease is PENDING
    const concurrentResult = handler.executeCompensation(sagaId, stepId, 50, mockProvider);
    assert(concurrentResult.status === 'CONCURRENT_IN_PROGRESS', 'Concurrent request returned CONCURRENT_IN_PROGRESS');
    assert(concurrentResult.retransmitted === true, 'Concurrent request flagged as retransmission');
    assert(mockProvider.refundCallCount === 0, 'Zero provider mutations executed while active lease is held');
  }

  // =========================================================================
  // [TEST 5] Idempotency Key Reuse with Conflicting Payloads
  // =========================================================================
  console.log('\n[TEST 5] Scenario 5: Conflicting Payload Detection on Key Reuse...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    const mockProvider = new SimulatedExternalPaymentProvider();

    const sagaId = 'saga-conflict-005';
    const stepId = 'step-refund';

    // Request 1: $45 USD
    handler.executeCompensation(sagaId, stepId, 45, mockProvider);
    assert(mockProvider.refundCallCount === 1, 'Initial $45 compensation committed');

    // Request 2: Reusing SAME sagaId & stepId but conflicting payload ($90 USD)
    let errorCaught = null;
    try {
      handler.executeCompensation(sagaId, stepId, 90, mockProvider);
    } catch (err) {
      errorCaught = err;
    }

    assert(Boolean(errorCaught), 'Conflicting payload reuse threw error');
    assert(errorCaught.name === 'ConflictingPayloadError', 'Error name is ConflictingPayloadError');
    assert(errorCaught.message.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'), 'Error message specifies IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
    assert(mockProvider.refundCallCount === 1, 'Provider refund was NOT called with conflicting payload (Count remains 1)');
  }

  // =========================================================================
  // [TEST 6] Transactional Outbox Recovery & Duplicate Event Delivery
  // =========================================================================
  console.log('\n[TEST 6] Scenario 6: Transactional Outbox & Duplicate Event Delivery Deduplication...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    const mockProvider = new SimulatedExternalPaymentProvider();
    const downstreamConsumer = new SimulatedDownstreamEventConsumer();

    const sagaId = 'saga-outbox-006';
    const stepId = 'step-refund';

    // Step 6A: Execute compensation; verifies event staged in outbox
    handler.executeCompensation(sagaId, stepId, 30, mockProvider);
    assert(store.outbox.length === 1, 'Transactional outbox staged exactly 1 event in local database transaction');
    const outboxEvent = store.outbox[0];
    assert(outboxEvent.topic === 'OrderCompensationCompleted', 'Outbox event topic matches OrderCompensationCompleted');
    assert(Boolean(outboxEvent.eventId), `Generated unique outbox event ID: ${outboxEvent.eventId}`);

    // Step 6B: Downstream consumer receives event (Delivery 1)
    const delivery1 = downstreamConsumer.handleEvent(outboxEvent);
    assert(delivery1.status === 'EVENT_COMMITTED', 'Delivery 1 committed by downstream consumer');
    assert(downstreamConsumer.deallocatedSeats === 1, 'Downstream seat deallocated (Count: 1)');

    // Step 6C: Message broker re-delivers duplicate event due to network ACK failure (Delivery 2)
    const delivery2 = downstreamConsumer.handleEvent(outboxEvent);
    assert(delivery2.status === 'EVENT_ALREADY_PROCESSED', 'Delivery 2 detected as duplicate by consumer idempotency ledger');
    assert(downstreamConsumer.deallocatedSeats === 1, 'Downstream seat deallocation count NOT duplicated (Remains: 1)');
    assert(downstreamConsumer.duplicateSuppressedCount === 1, 'Duplicate event suppression recorded');
  }

  // =========================================================================
  // [TEST 7] Failure Between Local State Changes & External Side Effects
  // =========================================================================
  console.log('\n[TEST 7] Scenario 7: Partial Failure Between Local State & External Side Effects...');
  {
    const store = new DurableIdempotentCompensationStore();
    const handler = new IdempotentCompensationHandler(store);
    
    // Simulating external provider failure (e.g. Card Expired / Account Closed)
    const failingProvider = {
      refund: () => {
        const err = new Error('PAYMENT_GATEWAY_REJECTED: Account closed or refund window expired');
        err.isTimeout = false;
        throw err;
      }
    };

    const sagaId = 'saga-partial-failure-007';
    const stepId = 'step-refund';
    const idempotencyKey = `saga:${sagaId}:step:${stepId}:compensate`;

    let callFailed = false;
    try {
      handler.executeCompensation(sagaId, stepId, 100, failingProvider);
    } catch (err) {
      callFailed = true;
    }

    assert(callFailed === true, 'External provider rejection caused compensation execution to throw');
    const record = store.records.get(idempotencyKey);
    assert(record.status === 'FAILED', 'Local idempotency ledger transitioned status to FAILED');
    assert(record.error.includes('PAYMENT_GATEWAY_REJECTED'), 'Error details recorded in durable ledger for audit');
    assert(store.outbox.length === 0, 'No outbox completion event staged on failed compensation');
  }

  // =========================================================================
  // Final Evaluation
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log(`🏁 RULE 319 VERIFICATION COMPLETE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('='.repeat(70));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRule319TestSuite().catch(err => {
  console.error('Fatal error in Rule 319 test suite:', err);
  process.exit(1);
});
