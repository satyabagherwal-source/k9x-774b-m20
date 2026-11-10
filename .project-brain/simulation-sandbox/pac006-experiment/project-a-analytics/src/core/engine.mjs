
import { validateTenantMetricPoint } from '../models/schema.mjs';

export class TenantDataAnalyticsEngine {
  constructor(options = {}) {
    this.maxPointsPerMetric = options.maxPointsPerMetric || 100;
    // Composite Partition Store: Map of "${tenantId}:${metric}" -> Array of points
    this.partitions = new Map();
  }

  getPartitionKey(tenantId, metric) {
    return `${tenantId}:${metric}`;
  }

  ingestMetric(rawPoint) {
    const point = validateTenantMetricPoint(rawPoint);
    const key = this.getPartitionKey(point.tenantId, point.metric);

    if (!this.partitions.has(key)) {
      this.partitions.set(key, []);
    }

    const buffer = this.partitions.get(key);

    // FIFO Bounded Memory Protection
    if (buffer.length >= this.maxPointsPerMetric) {
      buffer.shift(); // Evict oldest point to protect memory boundary
    }

    buffer.push(point);
    return { ingested: true, partitionKey: key, currentBufferSize: buffer.length };
  }

  getTenantMetrics(tenantId, metric) {
    const key = this.getPartitionKey(tenantId, metric);
    const buffer = this.partitions.get(key) || [];
    // Return cloned array to prevent external mutations
    return buffer.map(p => ({ ...p }));
  }

  computeAggregateStats(tenantId, metric) {
    const points = this.getTenantMetrics(tenantId, metric);
    if (points.length === 0) {
      return { count: 0, min: null, max: null, avg: null, p95: null, anomalies: [] };
    }

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / count;

    // Percentile 95 calculation
    const p95Index = Math.min(Math.floor(count * 0.95), count - 1);
    const p95 = values[p95Index];

    // Standard deviation and anomaly detection (> 2 std devs from mean)
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const anomalies = [];

    if (stdDev > 0) {
      for (const p of points) {
        const zScore = Math.abs(p.value - avg) / stdDev;
        if (zScore >= 2.0) {
          anomalies.push({ point: p, zScore });
        }
      }
    }

    return { count, min, max, avg, p95, stdDev, anomalies };
  }
}
