/**
 * IncidentLens — Responsive High-Contrast SRE Operations Dashboard
 * WCAG 2.1 AA Compliant (>4.5:1 contrast), zero-network self-contained HTML/CSS/JS.
 */

export function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IncidentLens — Real-Time Incident Diagnostic Workstation</title>
  <meta name="description" content="Mission-critical incident triage and forensic analysis workstation for Site Reliability Engineers.">
  <style>
    :root {
      --bg-canvas: #090d13;
      --bg-surface: #111822;
      --bg-card: #16202e;
      --border-subtle: #243447;
      --border-focus: #3b82f6;
      --btn-primary-bg: #2563eb;
      --btn-primary-hover: #1d4ed8;
      --btn-primary-active: #1e40af;
      --btn-primary-focus: #60a5fa;
      --btn-disabled-bg: #334155;
      --btn-disabled-text: #94a3b8;
      --text-main: #f0f6fc;
      --text-muted: #94a3b8;
      --sev1-color: #ef4444;
      --sev2-color: #f97316;
      --sev3-color: #eab308;
      --sev4-color: #10b981;
      --accent-blue: #38bdf8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-canvas);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 1.5rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--text-main);
    }

    .brand span {
      background: #1e293b;
      color: var(--accent-blue);
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
      border: 1px solid var(--border-subtle);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .workspace {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      .workspace { grid-template-columns: 1fr; }
    }

    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .panel-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    input, select, textarea {
      width: 100%;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 0.6rem 0.75rem;
      color: var(--text-main);
      font-size: 0.9rem;
      font-family: inherit;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--border-focus);
      box-shadow: 0 0 0 1px var(--border-focus);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--btn-primary-bg);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.65rem 1.25rem;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.15s ease, opacity 0.15s ease;
    }

    .btn:hover {
      background: var(--btn-primary-hover);
    }

    .btn:focus-visible {
      outline: 2px solid var(--btn-primary-focus);
      outline-offset: 2px;
    }

    .btn:active {
      background: var(--btn-primary-active);
    }

    .btn:disabled {
      background: var(--btn-disabled-bg);
      color: var(--btn-disabled-text);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .btn-secondary {
      background: #1e293b;
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      width: auto;
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
    }

    .incident-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .incident-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-left: 4px solid var(--border-subtle);
      border-radius: 6px;
      padding: 1.25rem;
      transition: transform 0.1s ease;
    }

    .incident-card.SEV-1 { border-left-color: var(--sev1-color); }
    .incident-card.SEV-2 { border-left-color: var(--sev2-color); }
    .incident-card.SEV-3 { border-left-color: var(--sev3-color); }
    .incident-card.SEV-4 { border-left-color: var(--sev4-color); }

    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .incident-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-main);
    }

    .badges {
      display: flex;
      gap: 0.5rem;
    }

    .badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .badge-sev {
      background: #1f1b24;
      color: #fff;
    }

    .badge-status {
      background: #1e293b;
      color: var(--accent-blue);
      border: 1px solid var(--border-subtle);
    }

    .incident-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .incident-summary {
      font-size: 0.9rem;
      color: #cbd5e1;
      margin-bottom: 1rem;
    }

    .incident-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    /* Modal styles */
    .modal-backdrop {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      justify-content: center;
      align-items: center;
      z-index: 100;
    }

    .modal-backdrop.open { display: flex; }

    .modal-dialog {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-body {
      padding: 1.25rem;
      overflow-y: auto;
    }

    pre {
      background: #090d13;
      padding: 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      color: #38bdf8;
      overflow-x: auto;
      border: 1px solid var(--border-subtle);
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <h1>IncidentLens</h1>
      <span>SRE WORKSTATION</span>
    </div>
    <div id="system-health">
      <span class="badge" style="background: #064e3b; color: #34d399; border: 1px solid #059669;">SYSTEM HEALTHY (Uptime: <span id="uptime-val">0s</span>)</span>
    </div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Incidents</div>
      <div class="stat-value" id="stat-total">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Outages (SEV-1/2)</div>
      <div class="stat-value" id="stat-active" style="color: var(--sev1-color);">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Investigating</div>
      <div class="stat-value" id="stat-investigating" style="color: var(--sev2-color);">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Resolved</div>
      <div class="stat-value" id="stat-resolved" style="color: var(--sev4-color);">0</div>
    </div>
  </div>

  <div class="workspace">
    <!-- Quick Report Panel -->
    <div class="panel">
      <div class="panel-title">Triage New Incident</div>
      <form id="incident-form">
        <div class="form-group">
          <label for="inc-title">Incident Title *</label>
          <input type="text" id="inc-title" required placeholder="e.g. Database connection pool exhausted">
        </div>
        <div class="form-group">
          <label for="inc-severity">Severity Level *</label>
          <select id="inc-severity" required>
            <option value="SEV-1">SEV-1: Critical Outage (15m SLA)</option>
            <option value="SEV-2">SEV-2: Major Degradation (60m SLA)</option>
            <option value="SEV-3" selected>SEV-3: Minor Defect (4h SLA)</option>
            <option value="SEV-4">SEV-4: Informational / Advisory</option>
          </select>
        </div>
        <div class="form-group">
          <label for="inc-service">Affected Service *</label>
          <input type="text" id="inc-service" required placeholder="e.g. auth-service, billing-db">
        </div>
        <div class="form-group">
          <label for="inc-runbook">Actionable SRE Runbook</label>
          <select id="inc-runbook">
            <option value="">-- None Selected --</option>
            <option value="RB-DB-01">RB-DB-01: Database Connection Pool Exhaustion</option>
            <option value="RB-MEM-02">RB-MEM-02: Node.js Heap Memory Leak</option>
            <option value="RB-AUTH-03">RB-AUTH-03: Token Authorization & Key Rotation</option>
            <option value="RB-NET-04">RB-NET-04: Third-Party Webhook Egress Latency</option>
          </select>
        </div>
        <div class="form-group">
          <label for="inc-summary">Technical Summary & Impact *</label>
          <textarea id="inc-summary" rows="3" required placeholder="Describe observed failure symptoms, error codes, and customer impact."></textarea>
        </div>
        <button type="submit" class="btn" id="btn-submit">Dispatch Incident</button>
      </form>
    </div>

    <!-- Live Incidents Stream -->
    <div class="panel">
      <div class="panel-title">
        <span>Active Incident Stream</span>
        <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);" id="incident-count-badge">0 records</span>
      </div>
      <div class="incident-list" id="incident-container">
        <!-- Incidents rendered via client script -->
      </div>
    </div>
  </div>

  <!-- Runbook / Autopsy Modal -->
  <div class="modal-backdrop" id="modal">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 id="modal-title">Modal Title</h3>
        <button class="btn-secondary" onclick="closeModal()">Close (Esc)</button>
      </div>
      <div class="modal-body" id="modal-content"></div>
    </div>
  </div>

  <script>
    let incidents = [];

    async function loadData() {
      try {
        const [incRes, healthRes] = await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/health')
        ]);
        if (incRes.ok) {
          incidents = await incRes.json();
          renderIncidents();
          updateStats();
        }
        if (healthRes.ok) {
          const h = await healthRes.json();
          document.getElementById('uptime-val').innerText = Math.round(h.uptime) + 's';
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    function updateStats() {
      document.getElementById('stat-total').innerText = incidents.length;
      document.getElementById('stat-active').innerText = incidents.filter(i => (i.severity === 'SEV-1' || i.severity === 'SEV-2') && i.status !== 'RESOLVED').length;
      document.getElementById('stat-investigating').innerText = incidents.filter(i => i.status === 'INVESTIGATING').length;
      document.getElementById('stat-resolved').innerText = incidents.filter(i => i.status === 'RESOLVED').length;
      document.getElementById('incident-count-badge').innerText = incidents.length + ' incident(s)';
    }

    function renderIncidents() {
      const container = document.getElementById('incident-container');
      if (incidents.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 3rem 0;">Zero active incidents. Systems fully operational.</div>';
        return;
      }

      container.innerHTML = incidents.map(inc => {
        const dateStr = new Date(inc.created_at).toLocaleTimeString();
        return \`
          <div class="incident-card \${inc.severity}">
            <div class="incident-header">
              <div class="incident-title">\${escapeHtml(inc.title)}</div>
              <div class="badges">
                <span class="badge badge-sev" style="background: \${getSevColor(inc.severity)}">\${inc.severity}</span>
                <span class="badge badge-status">\${inc.status}</span>
              </div>
            </div>
            <div class="incident-meta">
              ID: <code>\${inc.id}</code> &bull; Service: <strong>\${escapeHtml(inc.service)}</strong> &bull; Opened: \${dateStr} &bull; Commander: \${escapeHtml(inc.commander)}
            </div>
            <div class="incident-summary">\${escapeHtml(inc.summary)}</div>
            <div class="incident-actions">
              \${inc.status === 'INVESTIGATING' ? \`<button class="btn btn-secondary" onclick="transitionStatus('\${inc.id}', 'IDENTIFIED')">Mark Identified</button>\` : ''}
              \${inc.status === 'IDENTIFIED' ? \`<button class="btn btn-secondary" onclick="transitionStatus('\${inc.id}', 'MONITORING')">Mark Monitoring</button>\` : ''}
              \${inc.status !== 'RESOLVED' ? \`<button class="btn btn-secondary" style="color: #34d399;" onclick="transitionStatus('\${inc.id}', 'RESOLVED')">Resolve</button>\` : ''}
              \${inc.runbookId ? \`<button class="btn btn-secondary" onclick="viewRunbook('\${inc.runbookId}')">View Runbook</button>\` : ''}
              <button class="btn btn-secondary" style="color: var(--accent-blue);" onclick="openAutopsyModal('\${inc.id}')">Autopsy / Postmortem</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function getSevColor(sev) {
      if (sev === 'SEV-1') return '#ef4444';
      if (sev === 'SEV-2') return '#f97316';
      if (sev === 'SEV-3') return '#eab308';
      return '#10b981';
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    document.getElementById('incident-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('inc-title').value,
        severity: document.getElementById('inc-severity').value,
        service: document.getElementById('inc-service').value,
        runbookId: document.getElementById('inc-runbook').value || null,
        summary: document.getElementById('inc-summary').value
      };

      try {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          document.getElementById('inc-title').value = '';
          document.getElementById('inc-service').value = '';
          document.getElementById('inc-summary').value = '';
          await loadData();
        } else {
          const err = await res.json();
          alert('Failed to dispatch incident: ' + (err.detail || err.title));
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    });

    async function transitionStatus(id, newStatus) {
      try {
        const res = await fetch('/api/incidents/' + id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, note: 'Status updated by on-call engineer' })
        });
        if (res.ok) {
          await loadData();
        } else {
          const err = await res.json();
          alert('Error: ' + err.detail);
        }
      } catch (err) {
        alert('Request failed: ' + err.message);
      }
    }

    async function viewRunbook(id) {
      try {
        const res = await fetch('/api/runbooks/' + id);
        if (res.ok) {
          const rb = await res.json();
          document.getElementById('modal-title').innerText = '[' + rb.id + '] ' + rb.title;
          document.getElementById('modal-content').innerHTML = \`
            <div style="margin-bottom: 1rem;">
              <strong style="color: var(--accent-blue);">Category:</strong> \${rb.serviceCategory}
            </div>
            <h4 style="margin-bottom: 0.5rem; color: #f87171;">Symptoms:</h4>
            <ul style="margin-left: 1.5rem; margin-bottom: 1rem; color: #cbd5e1;">
              \${rb.symptoms.map(s => '<li>' + escapeHtml(s) + '</li>').join('')}
            </ul>
            <h4 style="margin-bottom: 0.5rem; color: #facc15;">Triage Steps:</h4>
            <ol style="margin-left: 1.5rem; margin-bottom: 1rem; color: #cbd5e1;">
              \${rb.triageSteps.map(s => '<li>' + escapeHtml(s) + '</li>').join('')}
            </ol>
            <h4 style="margin-bottom: 0.5rem; color: #34d399;">Mitigation Actions:</h4>
            <ul style="margin-left: 1.5rem; margin-bottom: 1rem; color: #cbd5e1;">
              \${rb.mitigationActions.map(s => '<li>' + escapeHtml(s) + '</li>').join('')}
            </ul>
            <div style="background: #0f172a; border-left: 3px solid var(--accent-blue); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;">
              <strong>Invariant:</strong> \${escapeHtml(rb.preventionInvariant)}
            </div>
          \`;
          document.getElementById('modal').classList.add('open');
        }
      } catch (err) {
        alert('Failed to load runbook: ' + err.message);
      }
    }

    async function openAutopsyModal(id) {
      const inc = incidents.find(i => i.id === id);
      if (!inc) return;

      document.getElementById('modal-title').innerText = 'Forensic Autopsy: ' + inc.id;
      document.getElementById('modal-content').innerHTML = \`
        <div style="margin-bottom: 1rem;">
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">
            Generate forensic postmortem and Master Brain candidate invariant.
          </p>
          <div class="form-group">
            <label>Root Cause Analysis</label>
            <textarea id="autopsy-rootcause" rows="2" placeholder="e.g. Unbounded memory growth due to missing eviction ceiling in websocket subscription cache."></textarea>
          </div>
          <div class="form-group">
            <label>Universal Architectural Invariant</label>
            <input type="text" id="autopsy-invariant" value="Never allocate unbounded collections; enforce ring buffers with deterministic FIFO eviction.">
          </div>
          <button class="btn btn-secondary" style="background: var(--border-focus); margin-bottom: 1rem;" onclick="generateAutopsy('\${inc.id}')">Export Autopsy Report</button>
          <div id="autopsy-result" style="display: none;">
            <h4 style="margin-bottom: 0.5rem; color: var(--accent-blue);">Generated Autopsy Document:</h4>
            <pre id="autopsy-markdown"></pre>
          </div>
        </div>
      \`;
      document.getElementById('modal').classList.add('open');
    }

    async function generateAutopsy(id) {
      const rootCause = document.getElementById('autopsy-rootcause').value;
      const invariant = document.getElementById('autopsy-invariant').value;

      try {
        const res = await fetch('/api/incidents/' + id + '/autopsy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootCause, invariant })
        });
        if (res.ok) {
          const data = await res.json();
          document.getElementById('autopsy-result').style.display = 'block';
          document.getElementById('autopsy-markdown').innerText = data.markdown_report;
        } else {
          alert('Failed to generate autopsy.');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    loadData();
    setInterval(loadData, 5000);
  </script>
</body>
</html>`;
}

