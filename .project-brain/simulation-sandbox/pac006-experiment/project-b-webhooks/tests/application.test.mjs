
import test from 'node:test';
import assert from 'node:assert/strict';
import { TenantWebhookDeliveryEngine } from '../src/core/engine.mjs';

test('TenantWebhookDeliveryEngine - Enqueue with HMAC-SHA256 Signature', () => {
  const engine = new TenantWebhookDeliveryEngine();
  const res = engine.enqueueWebhook({
    tenantId: 'tenant-acme',
    endpointId: 'ep_orders',
    payload: { orderId: 'ord_123', amount: 99.50 }
  });
  assert.equal(res.enqueued, true);
  assert.equal(res.queueKey, 'tenant-acme:ep_orders');
  assert.equal(res.currentQueueDepth, 1);

  const queue = engine.getTenantQueue('tenant-acme', 'ep_orders');
  assert.equal(queue.length, 1);
  assert.ok(queue[0].signature.startsWith('sha256='));
});

test('TenantWebhookDeliveryEngine - Rule 1721 Bounded Queue Capacity & FIFO Eviction', () => {
  const engine = new TenantWebhookDeliveryEngine({ maxQueueDepthPerEndpoint: 3 });
  for (let i = 1; i <= 5; i++) {
    engine.enqueueWebhook({
      tenantId: 'tenant-acme',
      endpointId: 'ep_inventory',
      payload: { item: 'widget', seq: i }
    });
  }

  const queue = engine.getTenantQueue('tenant-acme', 'ep_inventory');
  assert.equal(queue.length, 3, 'Queue should strictly honor max capacity limit of 3');
  assert.equal(queue[0].payload.seq, 3, 'Oldest events (seq 1, 2) should be evicted');
  assert.equal(queue[2].payload.seq, 5, 'Latest event should be present');

  const dlq = engine.getDeadLetterQueue('tenant-acme', 'ep_inventory');
  assert.equal(dlq.length, 2, 'Evicted events routed safely to Dead-Letter Queue');
  assert.equal(dlq[0].failureReason, 'QUEUE_CAPACITY_EXCEEDED');
});

test('TenantWebhookDeliveryEngine - Cross-Tenant Queue Isolation (Rule 1721)', () => {
  const engine = new TenantWebhookDeliveryEngine();
  engine.enqueueWebhook({ tenantId: 'tenant-alpha', endpointId: 'ep_shared', payload: { secret: 'alpha_secret' } });
  engine.enqueueWebhook({ tenantId: 'tenant-beta', endpointId: 'ep_shared', payload: { secret: 'beta_secret' } });

  const queueAlpha = engine.getTenantQueue('tenant-alpha', 'ep_shared');
  const queueBeta = engine.getTenantQueue('tenant-beta', 'ep_shared');

  assert.equal(queueAlpha.length, 1);
  assert.equal(queueAlpha[0].payload.secret, 'alpha_secret');

  assert.equal(queueBeta.length, 1);
  assert.equal(queueBeta[0].payload.secret, 'beta_secret');

  // Verify Alpha cannot access or starve Beta
  const crossLeak = queueAlpha.some(e => e.tenantId === 'tenant-beta');
  assert.equal(crossLeak, false, 'Zero cross-tenant webhook queue leakage');
});

test('TenantWebhookDeliveryEngine - Retry Lifecycle & Dead-Letter Transition', () => {
  const engine = new TenantWebhookDeliveryEngine({ maxDeliveryAttempts: 2 });
  engine.enqueueWebhook({ tenantId: 'tenant-charlie', endpointId: 'ep_pay', payload: { paymentId: 'pay_999' } });

  // Attempt 1: Fails
  const res1 = engine.processNextDelivery('tenant-charlie', 'ep_pay', () => false);
  assert.equal(res1.delivered, false);
  assert.equal(res1.retrying, true);
  assert.equal(res1.attempts, 1);

  // Attempt 2: Fails (max attempts = 2 reached)
  const res2 = engine.processNextDelivery('tenant-charlie', 'ep_pay', () => false);
  assert.equal(res2.delivered, false);
  assert.equal(res2.movedToDLQ, true);
  assert.equal(res2.reason, 'MAX_RETRIES_EXHAUSTED');

  const queue = engine.getTenantQueue('tenant-charlie', 'ep_pay');
  assert.equal(queue.length, 0, 'Exhausted event removed from active queue');

  const dlq = engine.getDeadLetterQueue('tenant-charlie', 'ep_pay');
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].failureReason, 'MAX_RETRIES_EXHAUSTED');
});

test('TenantWebhookDeliveryEngine - Multi-Tenant Quota Fairness & Starvation Defense', () => {
  const engine = new TenantWebhookDeliveryEngine();
  // Flooding Tenant 1
  for (let i = 0; i < 20; i++) {
    engine.enqueueWebhook({ tenantId: 'flood-tenant', endpointId: 'ep_1', payload: { burst: i } });
  }
  // Normal Tenant 2
  engine.enqueueWebhook({ tenantId: 'normal-tenant', endpointId: 'ep_1', payload: { normal: true } });

  // Delivering Tenant 2 must proceed immediately regardless of Tenant 1 backlog
  const delRes = engine.processNextDelivery('normal-tenant', 'ep_1', () => true);
  assert.equal(delRes.delivered, true);
  assert.equal(engine.getTenantQueue('normal-tenant', 'ep_1').length, 0);
  assert.equal(engine.getTenantQueue('flood-tenant', 'ep_1').length, 20);
});
