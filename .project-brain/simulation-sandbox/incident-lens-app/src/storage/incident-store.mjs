/**
 * IncidentLens — Atomic Persistent Incident Store
 * File-backed persistence using atomic temp-file replace and in-memory indexing.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class IncidentStore {
  constructor(storageDir) {
    this.storageDir = path.resolve(storageDir);
    this.dbFile = path.join(this.storageDir, 'incidents.json');
    this.incidents = new Map();
    this.init();
  }

  init() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.incidents)) {
          for (const inc of data.incidents) {
            this.incidents.set(inc.id, inc);
          }
        }
      } catch (err) {
        console.warn(`[WARN] Corrupted db file, starting fresh: ${err.message}`);
      }
    }
  }

  persist() {
    const list = Array.from(this.incidents.values());
    const payload = JSON.stringify({
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      count: list.length,
      incidents: list
    }, null, 2);

    const tmpFile = `${this.dbFile}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, payload, 'utf-8');
    fs.renameSync(tmpFile, this.dbFile);
  }

  create(data) {
    const id = `INC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const record = {
      id,
      title: data.title,
      severity: data.severity,
      service: data.service,
      summary: data.summary,
      status: 'INVESTIGATING',
      commander: data.commander || 'On-Call SRE',
      runbookId: data.runbookId || null,
      created_at: now,
      updated_at: now,
      timeline: [
        {
          timestamp: now,
          status: 'INVESTIGATING',
          note: `Incident opened with severity ${data.severity} on service ${data.service}.`
        }
      ],
      resolution_notes: null,
      autopsy: null
    };

    this.incidents.set(id, record);
    this.persist();
    return record;
  }

  get(id) {
    return this.incidents.get(id) || null;
  }

  list(filters = {}) {
    let list = Array.from(this.incidents.values());

    if (filters.status) {
      list = list.filter(i => i.status === filters.status);
    }
    if (filters.severity) {
      list = list.filter(i => i.severity === filters.severity);
    }
    if (filters.service) {
      list = list.filter(i => i.service.toLowerCase().includes(filters.service.toLowerCase()));
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }

  updateStatus(id, newStatus, note = '') {
    const record = this.get(id);
    if (!record) return null;

    const now = new Date().toISOString();
    record.status = newStatus;
    record.updated_at = now;
    record.timeline.push({
      timestamp: now,
      status: newStatus,
      note: note || `Status transitioned to ${newStatus}`
    });

    if (newStatus === 'RESOLVED' && !record.resolved_at) {
      record.resolved_at = now;
      record.resolution_notes = note;
    }

    this.persist();
    return record;
  }

  saveAutopsy(id, autopsyData) {
    const record = this.get(id);
    if (!record) return null;

    record.autopsy = {
      ...autopsyData,
      generated_at: new Date().toISOString()
    };
    this.persist();
    return record;
  }

  clear() {
    this.incidents.clear();
    this.persist();
  }
}

