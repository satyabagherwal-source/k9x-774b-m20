
import test from 'node:test';
import assert from 'node:assert/strict';
import { TenantDataAnalyticsEngine } from '../src/core/engine.mjs';

test('TenantDataAnalyticsEngine - Ingestion & Schema Validation', () => {
  const engine = new TenantDataAnalyticsEngine();
  const res = engine.ingestMetric({ tenantId: 'tenant-alpha', metric: 'latency_ms', value: 45.2 });
  assert.equal(res.ingested, true);
  assert.equal(res.partitionKey, 'tenant-alpha:latency_ms');
  assert.equal(res.currentBufferSize, 1);
});

test('TenantDataAnalyticsEngine - FIFO Bounded Memory Protection', () => {
  const engine = new TenantDataAnalyticsEngine({ maxPointsPerMetric: 5 });
  for (let i = 1; i <= 8; i++) {
    engine.ingestMetric({ tenantId: 'tenant-beta', metric: 'rps', value: i * 10 });
  }
  const points = engine.getTenantMetrics('tenant-beta', 'rps');
  assert.equal(points.length, 5, 'Buffer should strictly maintain capacity of 5');
  assert.equal(points[0].value, 40, 'Oldest points (10, 20, 30) should be evicted');
  assert.equal(points[4].value, 80, 'Latest point should be preserved');
});

test('TenantDataAnalyticsEngine - Statistical Aggregates & Anomaly Detection', () => {
  const engine = new TenantDataAnalyticsEngine();
  const values = [10, 12, 11, 13, 10, 12, 11, 100]; // 100 is an anomaly
  for (const v of values) {
    engine.ingestMetric({ tenantId: 'tenant-gamma', metric: 'response_time', value: v });
  }
  const stats = engine.computeAggregateStats('tenant-gamma', 'response_time');
  assert.equal(stats.count, 8);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 100);
  assert.ok(stats.p95 >= 13, 'p95 should be at or near top distribution');
  assert.equal(stats.anomalies.length, 1, 'Should detect exactly 1 outlier anomaly');
  assert.equal(stats.anomalies[0].point.value, 100);
});

test('TenantDataAnalyticsEngine - Multi-Tenant Data Isolation & Leakage Defense', () => {
  const engine = new TenantDataAnalyticsEngine();
  engine.ingestMetric({ tenantId: 'tenant-100', metric: 'active_sessions', value: 42 });
  engine.ingestMetric({ tenantId: 'tenant-200', metric: 'active_sessions', value: 999 });

  const metricsT1 = engine.getTenantMetrics('tenant-100', 'active_sessions');
  const metricsT2 = engine.getTenantMetrics('tenant-200', 'active_sessions');

  assert.equal(metricsT1.length, 1);
  assert.equal(metricsT1[0].value, 42);

  assert.equal(metricsT2.length, 1);
  assert.equal(metricsT2[0].value, 999);

  // Assert Tenant 1 cannot access Tenant 2 data
  const crossQuery = engine.getTenantMetrics('tenant-100', 'active_sessions');
  const hasCrossData = crossQuery.some(p => p.tenantId === 'tenant-200');
  assert.equal(hasCrossData, false, 'Zero cross-tenant data leakage');
});

test('TenantDataAnalyticsEngine - Empty or Missing Tenant Partitions', () => {
  const engine = new TenantDataAnalyticsEngine();
  const points = engine.getTenantMetrics('tenant-nonexistent', 'cpu');
  assert.deepEqual(points, []);
  const stats = engine.computeAggregateStats('tenant-nonexistent', 'cpu');
  assert.equal(stats.count, 0);
  assert.equal(stats.min, null);
});
