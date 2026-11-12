/**
 * IncidentLens — Forensic Incident Autopsy & Postmortem Generator
 * Synthesizes timeline, root cause, blast radius, and prevention invariants
 * in standard format suitable for SRE learning and Master Brain evolution.
 */

import { getRunbook } from './runbook-library.mjs';

export function generateIncidentAutopsy(incident, analysisInput = {}) {
  const rootCause = String(analysisInput.rootCause || 'Root cause under active investigation.').trim();
  const blastRadius = String(analysisInput.blastRadius || `${incident.service} degradation`).trim();
  const invariant = String(analysisInput.invariant || 'Enforce defensive error boundaries and bounded timeouts.').trim();
  const actionItems = Array.isArray(analysisInput.actionItems) && analysisInput.actionItems.length > 0
    ? analysisInput.actionItems
    : ['Implement automated regression test for identified failure mode.'];

  const runbook = incident.runbookId ? getRunbook(incident.runbookId) : null;
  const startTime = new Date(incident.created_at).getTime();
  const endTime = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / (60 * 1000)));

  const autopsyMarkdown = [
    `# Forensic Incident Autopsy: [${incident.id}] ${incident.title}`,
    ``,
    `## 1. Incident Metadata & Impact`,
    `- **Incident ID**: \`${incident.id}\``,
    `- **Severity**: \`${incident.severity}\``,
    `- **Affected Service**: \`${incident.service}\``,
    `- **Incident Commander**: ${incident.commander}`,
    `- **Status**: \`${incident.status}\``,
    `- **Duration**: ~${durationMinutes} minutes`,
    `- **Triage Runbook**: ${runbook ? `[${runbook.id}] ${runbook.title}` : 'None'}`,
    `- **Blast Radius**: ${blastRadius}`,
    ``,
    `## 2. Root Cause Analysis`,
    `${rootCause}`,
    ``,
    `## 3. Incident Timeline`,
    ...(incident.timeline || []).map(t => `- **${t.timestamp}** [${t.status}]: ${t.note}`),
    ``,
    `## 4. Universal Invariant & Master Brain Candidate`,
    `> **RULE**: ${invariant}`,
    `> **WHY**: Prevents identical failure modes and unhandled latency cascades in production.`,
    `> **WHEN TO APPLY**: All services interacting with ${incident.service}.`,
    ``,
    `## 5. Preventative Action Items`,
    ...actionItems.map((item, idx) => `${idx + 1}. ${item}`)
  ].join('\n');

  return {
    incident_id: incident.id,
    title: incident.title,
    severity: incident.severity,
    service: incident.service,
    duration_minutes: durationMinutes,
    root_cause: rootCause,
    blast_radius: blastRadius,
    universal_invariant: invariant,
    action_items: actionItems,
    markdown_report: autopsyMarkdown
  };
}

