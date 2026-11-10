
import crypto from 'crypto';
import { validateWebhookPayload } from '../models/schema.mjs';

/**
 * TenantWebhookDeliveryEngine
 * 
 * DIRECT APPLICATION OF MASTER BRAIN RULE 1721:
 * Enforces composite namespace keys (`${tenantId}:${endpointId}`) and capacity-bounded
 * per-tenant FIFO queues to guarantee zero cross-tenant queue starvation and zero data leakage.
 */
export class TenantWebhookDeliveryEngine {
  constructor(options = {}) {
    this.maxQueueDepthPerEndpoint = options.maxQueueDepthPerEndpoint || 50;
    this.maxDeliveryAttempts = options.maxDeliveryAttempts || 3;
    this.sharedSecret = options.sharedSecret || 'brain-webhook-secret-key';

    // Rule 1721 Composite Queues: Map of "${tenantId}:${endpointId}" -> Array of events
    this.queues = new Map();
    // Dead-Letter Queue: Map of "${tenantId}:${endpointId}" -> Array of failed events
    this.deadLetterQueues = new Map();
  }

  getQueueKey(tenantId, endpointId) {
    // Rule 1721 Composite Namespace Invariant
    return `${tenantId}:${endpointId}`;
  }

  computeHmacSignature(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return 'sha256=' + crypto.createHmac('sha256', this.sharedSecret).update(raw).digest('hex');
  }

  enqueueWebhook(rawEvent) {
    const event = validateWebhookPayload(rawEvent);
    const key = this.getQueueKey(event.tenantId, event.endpointId);

    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    const queue = this.queues.get(key);

    // Rule 1721 Bounded Buffer Invariant: FIFO eviction on capacity overflow
    if (queue.length >= this.maxQueueDepthPerEndpoint) {
      // Evict oldest queued event to protect memory boundary
      const dropped = queue.shift();
      this.routeToDeadLetter(dropped, 'QUEUE_CAPACITY_EXCEEDED');
    }

    const enrichedEvent = {
      ...event,
      attempts: 0,
      signature: this.computeHmacSignature(event.payload),
      enqueuedAt: Date.now()
    };

    queue.push(enrichedEvent);
    return { enqueued: true, queueKey: key, currentQueueDepth: queue.length };
  }

  getTenantQueue(tenantId, endpointId) {
    const key = this.getQueueKey(tenantId, endpointId);
    const queue = this.queues.get(key) || [];
    return queue.map(e => ({ ...e }));
  }

  routeToDeadLetter(event, reason) {
    const key = this.getQueueKey(event.tenantId, event.endpointId);
    if (!this.deadLetterQueues.has(key)) {
      this.deadLetterQueues.set(key, []);
    }
    this.deadLetterQueues.get(key).push({
      ...event,
      failedAt: Date.now(),
      failureReason: reason
    });
  }

  getDeadLetterQueue(tenantId, endpointId) {
    const key = this.getQueueKey(tenantId, endpointId);
    return (this.deadLetterQueues.get(key) || []).map(e => ({ ...e }));
  }

  processNextDelivery(tenantId, endpointId, mockDestinationFn) {
    const key = this.getQueueKey(tenantId, endpointId);
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) return { delivered: false, reason: 'QUEUE_EMPTY' };

    const event = queue[0];
    event.attempts++;

    try {
      const success = mockDestinationFn(event);
      if (success) {
        queue.shift(); // Successfully delivered, remove from queue
        return { delivered: true, eventId: event.eventId, attempts: event.attempts };
      } else {
        throw new Error('Destination responded with 500 error');
      }
    } catch (err) {
      if (event.attempts >= this.maxDeliveryAttempts) {
        queue.shift(); // Max retries exhausted
        this.routeToDeadLetter(event, 'MAX_RETRIES_EXHAUSTED');
        return { delivered: false, movedToDLQ: true, reason: 'MAX_RETRIES_EXHAUSTED' };
      }
      return { delivered: false, retrying: true, attempts: event.attempts };
    }
  }
}
