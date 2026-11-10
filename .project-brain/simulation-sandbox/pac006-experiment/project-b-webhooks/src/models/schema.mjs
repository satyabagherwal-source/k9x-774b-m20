
export function validateWebhookPayload(event) {
  if (!event || typeof event !== 'object') throw new Error('Event must be an object');
  if (!event.tenantId || typeof event.tenantId !== 'string') throw new Error('Missing or invalid tenantId');
  if (!event.endpointId || typeof event.endpointId !== 'string') throw new Error('Missing or invalid endpointId');
  if (!event.payload || typeof event.payload !== 'object') throw new Error('Missing or invalid payload object');
  return {
    eventId: event.eventId || 'evt_' + Math.random().toString(36).substring(2, 9),
    tenantId: event.tenantId.trim(),
    endpointId: event.endpointId.trim(),
    payload: event.payload,
    timestamp: event.timestamp || Date.now()
  };
}
