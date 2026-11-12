/**
 * IncidentLens — Domain Models & Schema Validation
 * Enforces strict RFC 7807 compliance, field bounds, and state transitions.
 */

export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

export const SEVERITY_LEVELS = Object.freeze({
  SEV1: { id: 'SEV-1', label: 'Critical Outage', color: '#ff4d4f', slaMinutes: 15 },
  SEV2: { id: 'SEV-2', label: 'Major Degradation', color: '#ffa940', slaMinutes: 60 },
  SEV3: { id: 'SEV-3', label: 'Minor Defect', color: '#fadb14', slaMinutes: 240 },
  SEV4: { id: 'SEV-4', label: 'Informational', color: '#52c41a', slaMinutes: 1440 }
});

export const INCIDENT_STATUS = Object.freeze({
  INVESTIGATING: 'INVESTIGATING',
  IDENTIFIED: 'IDENTIFIED',
  MONITORING: 'MONITORING',
  RESOLVED: 'RESOLVED'
});

const ALLOWED_TRANSITIONS = {
  [INCIDENT_STATUS.INVESTIGATING]: [INCIDENT_STATUS.IDENTIFIED, INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.IDENTIFIED]: [INCIDENT_STATUS.MONITORING, INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.MONITORING]: [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.INVESTIGATING],
  [INCIDENT_STATUS.RESOLVED]: [INCIDENT_STATUS.INVESTIGATING] // Re-opening allowed
};

export function validateIncidentInput(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Incident payload must be a non-null object.');
  }

  const title = String(data.title || '').trim();
  if (title.length < 5 || title.length > 140) {
    throw new ValidationError('Title must be between 5 and 140 characters.');
  }

  const severity = String(data.severity || '').toUpperCase().trim();
  const validSeverities = ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'];
  if (!validSeverities.includes(severity)) {
    throw new ValidationError(`Invalid severity '${severity}'. Allowed: ${validSeverities.join(', ')}.`);
  }

  const service = String(data.service || data.affected_service || '').trim();
  if (service.length < 2 || service.length > 60) {
    throw new ValidationError('Affected service must be between 2 and 60 characters.');
  }

  const summary = String(data.summary || '').trim();
  if (summary.length < 10 || summary.length > 2000) {
    throw new ValidationError('Summary must be between 10 and 2000 characters.');
  }

  const runbookId = data.runbookId ? String(data.runbookId).trim() : null;

  return {
    title,
    severity,
    service,
    summary,
    runbookId,
    commander: data.commander ? String(data.commander).trim() : 'On-Call SRE'
  };
}

export function validateStatusTransition(currentStatus, newStatus) {
  if (!INCIDENT_STATUS[newStatus]) {
    throw new ValidationError(`Unknown target status '${newStatus}'. Allowed: ${Object.keys(INCIDENT_STATUS).join(', ')}.`);
  }

  if (currentStatus === newStatus) return true;

  const validNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!validNext.includes(newStatus)) {
    throw new ValidationError(`Illegal status transition from '${currentStatus}' to '${newStatus}'. Allowed: ${validNext.join(', ')}.`);
  }

  return true;
}

