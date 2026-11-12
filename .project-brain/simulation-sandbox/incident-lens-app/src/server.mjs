/**
 * IncidentLens — Mission-Critical Production REST Server
 * Native Node.js HTTP server with zero runtime bloat, RFC 7807 problem details,
 * and integrated high-contrast SRE operations dashboard.
 */

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { IncidentStore } from './storage/incident-store.mjs';
import { validateIncidentInput, validateStatusTransition, ValidationError } from './models/incident-schema.mjs';
import { getRunbook, listRunbooks } from './core/runbook-library.mjs';
import { generateIncidentAutopsy } from './core/autopsy-generator.mjs';
import { renderDashboardHtml } from './ui/dashboard-html.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const START_TIME = Date.now();

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large; maximum 1MB allowed.') {
    super(message);
    this.name = 'PayloadTooLargeError';
    this.statusCode = 413;
  }
}

function sendProblemDetails(res, status, title, detail) {
  res.writeHead(status, { 'Content-Type': 'application/problem+json' });
  res.end(JSON.stringify({
    type: 'https://tools.ietf.org/html/rfc7807',
    title,
    status,
    detail,
    timestamp: new Date().toISOString()
  }));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let rejected = false;
    const MAX_SIZE = 1024 * 1024; // 1MB limit
    req.on('data', chunk => {
      if (rejected) return;
      body += chunk;
      if (body.length > MAX_SIZE) {
        rejected = true;
        reject(new PayloadTooLargeError());
      }
    });
    req.on('end', () => {
      if (rejected) return;
      if (!body.trim()) return resolve({});
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new ValidationError('Invalid JSON syntax: ' + err.message));
      }
    });
    req.on('error', err => reject(err));
  });
}

export function createServer(options = {}) {
  const storageDir = options.storageDir || path.resolve(__dirname, '..', 'data');
  const store = new IncidentStore(storageDir);

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline';");

    try {
      // 1. Dashboard UI
      if (method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml());
        return;
      }

      // 2. Health & Telemetry Probe
      if (method === 'GET' && pathname === '/api/health') {
        const memory = process.memoryUsage();
        sendJson(res, 200, {
          status: 'healthy',
          uptime: (Date.now() - START_TIME) / 1000,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          memory_rss_mb: Math.round(memory.rss / (1024 * 1024) * 100) / 100,
          active_incidents: store.list({ status: 'INVESTIGATING' }).length
        });
        return;
      }

      // 3. List & Filter Incidents
      if (method === 'GET' && pathname === '/api/incidents') {
        const filters = {
          status: parsedUrl.searchParams.get('status') || null,
          severity: parsedUrl.searchParams.get('severity') || null,
          service: parsedUrl.searchParams.get('service') || null
        };
        const list = store.list(filters);
        sendJson(res, 200, list);
        return;
      }

      // 4. Create Incident
      if (method === 'POST' && pathname === '/api/incidents') {
        const body = await parseBody(req);
        const validated = validateIncidentInput(body);
        const record = store.create(validated);
        sendJson(res, 201, record);
        return;
      }

      // 5. Get Single Incident
      const incidentMatch = pathname.match(/^\/api\/incidents\/([A-Za-z0-9_-]+)$/);
      if (method === 'GET' && incidentMatch) {
        const id = incidentMatch[1];
        const record = store.get(id);
        if (!record) {
          sendProblemDetails(res, 404, 'Not Found', `Incident with ID '${id}' was not found.`);
          return;
        }
        sendJson(res, 200, record);
        return;
      }

      // 6. Transition Incident Status
      const statusMatch = pathname.match(/^\/api\/incidents\/([A-Za-z0-9_-]+)\/status$/);
      if (method === 'PATCH' && statusMatch) {
        const id = statusMatch[1];
        const record = store.get(id);
        if (!record) {
          sendProblemDetails(res, 404, 'Not Found', `Incident with ID '${id}' was not found.`);
          return;
        }

        const body = await parseBody(req);
        const newStatus = String(body.status || '').toUpperCase();
        validateStatusTransition(record.status, newStatus);

        const updated = store.updateStatus(id, newStatus, body.note || '');
        sendJson(res, 200, updated);
        return;
      }

      // 7. Generate & Export Autopsy
      const autopsyMatch = pathname.match(/^\/api\/incidents\/([A-Za-z0-9_-]+)\/autopsy$/);
      if (method === 'POST' && autopsyMatch) {
        const id = autopsyMatch[1];
        const record = store.get(id);
        if (!record) {
          sendProblemDetails(res, 404, 'Not Found', `Incident with ID '${id}' was not found.`);
          return;
        }

        const body = await parseBody(req);
        const autopsy = generateIncidentAutopsy(record, body);
        store.saveAutopsy(id, autopsy);
        sendJson(res, 200, autopsy);
        return;
      }

      // 8. Runbooks Catalog
      if (method === 'GET' && pathname === '/api/runbooks') {
        sendJson(res, 200, listRunbooks());
        return;
      }

      // 9. Single Runbook
      const runbookMatch = pathname.match(/^\/api\/runbooks\/([A-Za-z0-9_-]+)$/);
      if (method === 'GET' && runbookMatch) {
        const id = runbookMatch[1];
        const rb = getRunbook(id);
        if (!rb) {
          sendProblemDetails(res, 404, 'Not Found', `Runbook '${id}' not found in library.`);
          return;
        }
        sendJson(res, 200, rb);
        return;
      }

      // 404 Catch-All
      sendProblemDetails(res, 404, 'Not Found', `No endpoint matched ${method} ${pathname}`);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        sendProblemDetails(res, 413, 'Payload Too Large', err.message);
      } else if (err instanceof ValidationError) {
        sendProblemDetails(res, 400, 'Bad Request', err.message);
      } else {
        console.error('[CRITICAL] Unhandled server error:', err);
        sendProblemDetails(res, 500, 'Internal Server Error', 'An unexpected error occurred.');
      }
    }
  });

  return { server, store };
}

// Standalone execution entry
if (process.argv[1] === __filename) {
  const PORT = process.env.PORT || 3456;
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🛡️ IncidentLens Workstation running at http://localhost:${PORT}`);
    console.log(`📡 Health Probe: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}
