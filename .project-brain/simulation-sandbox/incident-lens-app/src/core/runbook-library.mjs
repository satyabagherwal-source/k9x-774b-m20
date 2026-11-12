/**
 * IncidentLens — Authoritative SRE Runbook Library
 * Immediate actionable diagnostic and mitigation checklists for incident responders.
 */

export const RUNBOOKS = Object.freeze([
  {
    id: 'RB-DB-01',
    title: 'Database Connection Pool Exhaustion',
    serviceCategory: 'Database',
    symptoms: [
      'HTTP 500 error spikes on write paths',
      'High connection latency (>5000ms)',
      'Pool wait queue timeout errors'
    ],
    triageSteps: [
      'Check active client connection count against max_connections threshold',
      'Inspect slow query log for unindexed table scans or lock deadlocks',
      'Identify orphaned client worker processes holding idle connections'
    ],
    mitigationActions: [
      'Enable aggressive connection pool reap timeout (30s -> 5s)',
      'Temporarily scale read replica pool routing for read-only queries',
      'Restart stalled worker pool pods with rolling update'
    ],
    preventionInvariant: 'Always wrap database connections in scoped try/finally or using-blocks with bounded connection timeouts.'
  },
  {
    id: 'RB-MEM-02',
    title: 'Node.js Heap Memory Leak & Event Loop Lag',
    serviceCategory: 'Backend Services',
    symptoms: [
      'Process memory (RSS) growing monotonically without garbage collection drops',
      'Event loop delay exceeding 200ms threshold',
      'Health probe timeouts or intermittent container restarts (OOMKilled)'
    ],
    triageSteps: [
      'Inspect heap snapshot for detached DOM nodes or unbounded Map/Array caches',
      'Check active unclosed streaming responses or WebSocket subscriptions',
      'Analyze telemetry metric ring buffers for missing eviction ceilings'
    ],
    mitigationActions: [
      'Trigger soft restart of worker processes in round-robin fashion',
      'Apply bounded LRU capacity constraint to unbounded in-memory caches',
      'Set Node --max-old-space-size to 80% of container memory limit'
    ],
    preventionInvariant: 'Never instantiate unbounded collections; enforce ring buffers with deterministic FIFO eviction.'
  },
  {
    id: 'RB-AUTH-03',
    title: 'Token Authorization & Key Rotation Failure',
    serviceCategory: 'Security & Identity',
    symptoms: [
      'HTTP 401 Unauthorized errors on cross-service calls',
      'Cryptographic signature validation failures',
      'Replay attack detection tripwires firing'
    ],
    triageSteps: [
      'Verify clock skew across distributed cluster nodes (NTP drift < 500ms)',
      'Inspect public key JWKS cache freshness and TTL expiry',
      'Confirm service account identity and non-revocation status'
    ],
    mitigationActions: [
      'Force synchronous cache invalidation of public key rotation registry',
      'Enable emergency token grace period (max 5 minutes) during key transitions',
      'Regenerate compromised service credentials using automated vault'
    ],
    preventionInvariant: 'Tokens must use asymmetric cryptography with cryptographic nonce single-use and expiration enforcement.'
  },
  {
    id: 'RB-NET-04',
    title: 'Third-Party Webhook Egress Latency / Cascade',
    serviceCategory: 'Integrations & Network',
    symptoms: [
      'Outbound HTTP request timeout spikes (>10s)',
      'Worker thread pool saturation waiting on external endpoints',
      'Upstream circuit breaker tripped into OPEN state'
    ],
    triageSteps: [
      'Check upstream status page or latency dashboard for partner API outage',
      'Inspect network egress metrics for packet drops or DNS lookup delays',
      'Verify exponential backoff retry counts are bounded'
    ],
    mitigationActions: [
      'Trip circuit breaker manually to fallback queue immediately',
      'Enqueue pending notifications to local dead-letter queue (DLQ)',
      'Throttle egress concurrency to external partner endpoint to 2 requests/sec'
    ],
    preventionInvariant: 'All external network calls must enforce hard circuit breakers and zero-wait timeouts.'
  }
]);

export function getRunbook(id) {
  return RUNBOOKS.find(r => r.id === id) || null;
}

export function listRunbooks() {
  return RUNBOOKS.map(r => ({
    id: r.id,
    title: r.title,
    serviceCategory: r.serviceCategory,
    symptomsCount: r.symptoms.length
  }));
}

