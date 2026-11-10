
export function validateTenantMetricPoint(point) {
  if (!point || typeof point !== 'object') throw new Error('Metric point must be an object');
  if (!point.tenantId || typeof point.tenantId !== 'string') throw new Error('Missing or invalid tenantId');
  if (!point.metric || typeof point.metric !== 'string') throw new Error('Missing or invalid metric name');
  if (typeof point.value !== 'number' || Number.isNaN(point.value)) throw new Error('Metric value must be a valid number');
  const timestamp = point.timestamp || Date.now();
  return { tenantId: point.tenantId.trim(), metric: point.metric.trim(), value: point.value, timestamp };
}
