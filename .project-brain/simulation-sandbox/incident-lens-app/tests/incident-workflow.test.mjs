/**
 * IncidentLens — Comprehensive End-to-End Test Suite
 * Evaluates startup, user journeys, REST CRUD, state machine transitions,
 * RFC 7807 problem details, atomic persistence, runbooks, autopsies, and security boundaries.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { createServer } from '../src/server.mjs';
import { IncidentStore } from '../src/storage/incident-store.mjs';

// Helper functions for WCAG 2.1 AA Contrast calculation
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getContrastRatio(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function makeRequest(port, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, res => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch (e) { }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          json
        });
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

describe('IncidentLens Universal Construction Verification Suite', () => {
  let serverInstance;
  let testPort;
  let tempStorageDir;
  let createdIncidentId;

  before(async () => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'incidentlens-test-'));
    const { server } = createServer({ storageDir: tempStorageDir });
    serverInstance = server;

    await new Promise((resolve, reject) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        testPort = serverInstance.address().port;
        resolve();
      });
      serverInstance.on('error', reject);
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise(resolve => serverInstance.close(resolve));
    }
    if (tempStorageDir && fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  // 1. Health Probe & System Telemetry
  it('Phase 1: Startup & Telemetry Health Probe', async () => {
    const res = await makeRequest(testPort, 'GET', '/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'healthy');
    assert(typeof res.json.uptime === 'number');
    assert(typeof res.json.memory_rss_mb === 'number');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
  });

  // 2. High-Contrast Dashboard Delivery & WCAG AA Contrast Verification
  it('Phase 2: Accessible WCAG AA Dashboard HTML Delivery', async () => {
    const res = await makeRequest(testPort, 'GET', '/');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['content-type'].includes('text/html'));
    assert(res.body.includes('IncidentLens'));
    assert(res.body.includes('--bg-canvas: #090d13;')); // High-contrast dark palette
    assert(res.body.includes('--btn-primary-bg: #2563eb;')); // Blue 600 accessible contrast token
    assert(res.body.includes('--btn-primary-hover: #1d4ed8;'));
    assert(res.body.includes('--btn-primary-active: #1e40af;'));
    assert(res.body.includes('SRE WORKSTATION'));
    assert(!res.body.includes('<script src="http')); // Zero external CDN tracker scripts

    // Empirical WCAG 2.1 AA Contrast Ratios (Minimum 4.5:1 for normal text)
    const defaultContrast = getContrastRatio('#ffffff', '#2563eb');
    assert(defaultContrast >= 4.5, `Default button contrast must be >= 4.5:1, got ${defaultContrast.toFixed(2)}:1`);

    const hoverContrast = getContrastRatio('#ffffff', '#1d4ed8');
    assert(hoverContrast >= 4.5, `Hover button contrast must be >= 4.5:1, got ${hoverContrast.toFixed(2)}:1`);

    const activeContrast = getContrastRatio('#ffffff', '#1e40af');
    assert(activeContrast >= 4.5, `Active button contrast must be >= 4.5:1, got ${activeContrast.toFixed(2)}:1`);
  });

  // 3. Incident Lifecycle CRUD & State Machine
  it('Phase 3.1: Create Incident with Valid Attributes (SEV-1)', async () => {
    const payload = {
      title: 'Database connection pool exhausted under spike',
      severity: 'SEV-1',
      service: 'payment-gateway',
      runbookId: 'RB-DB-01',
      summary: 'API connection timeouts spiking to 80% on checkout endpoint due to pool starvation.'
    };

    const res = await makeRequest(testPort, 'POST', '/api/incidents', payload);
    assert.strictEqual(res.statusCode, 201);
    assert(res.json.id && res.json.id.startsWith('INC-'));
    assert.strictEqual(res.json.status, 'INVESTIGATING');
    assert.strictEqual(res.json.severity, 'SEV-1');
    assert.strictEqual(res.json.service, 'payment-gateway');
    assert.strictEqual(res.json.timeline.length, 1);
    createdIncidentId = res.json.id;
  });

  it('Phase 3.2: List Incidents & Filter by Severity', async () => {
    const res = await makeRequest(testPort, 'GET', '/api/incidents?severity=SEV-1');
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.json));
    assert(res.json.length >= 1);
    assert.strictEqual(res.json[0].id, createdIncidentId);
  });

  it('Phase 3.3: Retrieve Single Incident by ID', async () => {
    const res = await makeRequest(testPort, 'GET', `/api/incidents/${createdIncidentId}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.id, createdIncidentId);
    assert.strictEqual(res.json.runbookId, 'RB-DB-01');
  });

  it('Phase 3.4: Valid Status Transition (INVESTIGATING -> IDENTIFIED)', async () => {
    const res = await makeRequest(testPort, 'PATCH', `/api/incidents/${createdIncidentId}/status`, {
      status: 'IDENTIFIED',
      note: 'Identified unindexed batch job holding 50 connections open.'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'IDENTIFIED');
    assert.strictEqual(res.json.timeline.length, 2);
  });

  it('Phase 3.5: Valid Status Transition (IDENTIFIED -> MONITORING)', async () => {
    const res = await makeRequest(testPort, 'PATCH', `/api/incidents/${createdIncidentId}/status`, {
      status: 'MONITORING',
      note: 'Terminated rogue worker, pool latency dropped to 12ms.'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'MONITORING');
    assert.strictEqual(res.json.timeline.length, 3);
  });

  it('Phase 3.6: Valid Status Transition (MONITORING -> RESOLVED)', async () => {
    const res = await makeRequest(testPort, 'PATCH', `/api/incidents/${createdIncidentId}/status`, {
      status: 'RESOLVED',
      note: 'Normal traffic sustained for 30 minutes without error recurrence.'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'RESOLVED');
    assert(res.json.resolved_at !== null);
    assert.strictEqual(res.json.timeline.length, 4);
  });

  // 4. RFC 7807 Error Boundaries & Input Validation
  it('Phase 4.1: Rejects Short Title with RFC 7807 Problem Details (400)', async () => {
    const res = await makeRequest(testPort, 'POST', '/api/incidents', {
      title: 'Err',
      severity: 'SEV-1',
      service: 'api',
      summary: 'Too short title test'
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers['content-type'], 'application/problem+json');
    assert.strictEqual(res.json.type, 'https://tools.ietf.org/html/rfc7807');
    assert.strictEqual(res.json.title, 'Bad Request');
    assert(res.json.detail.includes('between 5 and 140'));
  });

  it('Phase 4.2: Rejects Invalid Severity with RFC 7807 Problem Details (400)', async () => {
    const res = await makeRequest(testPort, 'POST', '/api/incidents', {
      title: 'Valid Title Here',
      severity: 'SEV-99',
      service: 'api',
      summary: 'Valid summary describing the problem'
    });
    assert.strictEqual(res.statusCode, 400);
    assert(res.json.detail.includes("Invalid severity 'SEV-99'"));
  });

  it('Phase 4.3: Rejects Illegal Status Transition with RFC 7807 Details (400)', async () => {
    // RESOLVED cannot transition directly to MONITORING (only INVESTIGATING)
    const res = await makeRequest(testPort, 'PATCH', `/api/incidents/${createdIncidentId}/status`, {
      status: 'MONITORING'
    });
    assert.strictEqual(res.statusCode, 400);
    assert(res.json.detail.includes('Illegal status transition'));
  });

  it('Phase 4.4: Returns 404 Problem Details on Non-Existent Incident', async () => {
    const res = await makeRequest(testPort, 'GET', '/api/incidents/INC-NONEXISTENT-999');
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.json.title, 'Not Found');
    assert(res.json.detail.includes('was not found'));
  });

  // 5. Runbook Library
  it('Phase 5: SRE Runbook Catalog & Detail Access', async () => {
    const listRes = await makeRequest(testPort, 'GET', '/api/runbooks');
    assert.strictEqual(listRes.statusCode, 200);
    assert(Array.isArray(listRes.json));
    assert(listRes.json.length >= 4);

    const detailRes = await makeRequest(testPort, 'GET', '/api/runbooks/RB-DB-01');
    assert.strictEqual(detailRes.statusCode, 200);
    assert.strictEqual(detailRes.json.id, 'RB-DB-01');
    assert(detailRes.json.symptoms.length > 0);
    assert(detailRes.json.triageSteps.length > 0);
    assert(detailRes.json.mitigationActions.length > 0);
    assert(detailRes.json.preventionInvariant.includes('try/finally'));
  });

  // 6. Forensic Autopsy & Continuous Learning Export
  it('Phase 6: Forensic Autopsy Synthesis & Master Brain Candidate', async () => {
    const autopsyRes = await makeRequest(testPort, 'POST', `/api/incidents/${createdIncidentId}/autopsy`, {
      rootCause: 'Leaked database connection in unhandled promise rejection branch.',
      blastRadius: 'Payment checkout failures affecting 3.4% of users.',
      invariant: 'Always acquire database client connections within scoped try/finally or using-statements.',
      actionItems: [
        'Add static eslint rule forbidding un-returned pool clients.',
        'Configure connection pool max lifetime to 15 minutes.'
      ]
    });

    assert.strictEqual(autopsyRes.statusCode, 200);
    assert.strictEqual(autopsyRes.json.incident_id, createdIncidentId);
    assert(autopsyRes.json.markdown_report.includes('## 1. Incident Metadata & Impact'));
    assert(autopsyRes.json.markdown_report.includes('## 4. Universal Invariant & Master Brain Candidate'));
    assert(autopsyRes.json.markdown_report.includes('Always acquire database client connections'));
  });

  // 7. Atomic Persistence & Safe Process Restart
  it('Phase 7: Atomic File Persistence Across Store Reloads', () => {
    // Instantiate new store pointing to same temp directory
    const reloadedStore = new IncidentStore(tempStorageDir);
    const reloaded = reloadedStore.get(createdIncidentId);
    assert(reloaded !== null);
    assert.strictEqual(reloaded.id, createdIncidentId);
    assert.strictEqual(reloaded.status, 'RESOLVED');
    assert.strictEqual(reloaded.timeline.length, 4);
    assert(reloaded.autopsy !== null);
    assert(reloaded.autopsy.universal_invariant.includes('Always acquire database client connections'));
  });

  // 8. Security & Negative Scope Guardrails
  it('Phase 8: Negative Scope (Rejects oversized payload > 1MB)', async () => {
    const bigString = 'x'.repeat(1024 * 1024 + 100);
    try {
      const res = await makeRequest(testPort, 'POST', '/api/incidents', {
        title: 'Valid Title',
        severity: 'SEV-1',
        service: 'api',
        summary: bigString
      });
      assert(res.statusCode === 413 || res.statusCode === 400);
    } catch (err) {
      assert(err.code === 'ECONNRESET' || err.message.includes('hang up'));
    }
  });
});
