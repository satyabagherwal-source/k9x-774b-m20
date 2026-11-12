/**
 * audit-logger.mjs
 * 
 * PipelineAuditLogger Contract for Stage D Shared Harvesting Pipeline
 * Preserves structured execution trails for both Cloud and Manual harvesting runs.
 */

import fs from 'fs';
import path from 'path';

export class PipelineAuditLogger {
  constructor(logDir) {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'pipeline-execution-audit.json');
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, JSON.stringify([], null, 2), 'utf8');
    }
  }

  logExecution(entry) {
    let logs = [];
    try {
      logs = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
    } catch (e) {
      logs = [];
    }
    const enrichedEntry = {
      audit_id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      logged_at: new Date().toISOString(),
      ...entry
    };
    logs.push(enrichedEntry);
    fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2), 'utf8');
    return enrichedEntry;
  }

  getLogs() {
    try {
      return JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
    } catch (e) {
      return [];
    }
  }
}

