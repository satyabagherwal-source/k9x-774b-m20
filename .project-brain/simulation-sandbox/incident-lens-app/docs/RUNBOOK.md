# IncidentLens — Operations Runbook & Maintenance Manual

## 1. System Overview
IncidentLens is a zero-dependency, self-contained SRE incident triage and forensic analysis workstation. It provides live incident tracking, runbook lookups, status transitions, RFC 7807 problem details, and forensic postmortem autopsy generation.

## 2. Health Monitoring & Verification
- **Liveness & Readiness Endpoint**: `GET /api/health`
- **Expected Status**: `200 OK`
- **Payload Schema**:
  ```json
  {
    "status": "healthy",
    "uptime": 3600,
    "version": "1.0.0",
    "memory_rss_mb": 24.5,
    "active_incidents": 2
  }
  ```
- **Alerting Threshold**: If `memory_rss_mb > 50` or `uptime` resets unexpectedly, inspect heap allocations.

## 3. Data Persistence & Backup Procedures
- **Data File**: `data/incidents.json`
- **Persistence Mechanism**: Atomic write via temporary file replace (`incidents.json.tmp.<ts>` $\to$ `incidents.json`), preventing file corruption during power failure.
- **Cold Backup Procedure**:
  ```bash
  cp data/incidents.json data/backups/incidents-$(date +%Y%m%d%H%M%S).json
  ```
- **Restore Procedure**: Stop server, replace `data/incidents.json`, restart server.

## 4. Emergency Incident Triage Flow
1. **Access Workstation**: Navigate to `http://localhost:3456/`.
2. **Dispatch Incident**: Enter Title, Severity (SEV-1 through SEV-4), Affected Service, and Summary.
3. **Attach Runbook**: Select corresponding SRE runbook (e.g. `RB-DB-01` for Database Exhaustion).
4. **Transition Lifecycle**:
   - `INVESTIGATING` $\to$ `IDENTIFIED`
   - `IDENTIFIED` $\to$ `MONITORING`
   - `MONITORING` $\to$ `RESOLVED`
5. **Generate Forensic Autopsy**: Click "Autopsy / Postmortem", supply root cause and universal invariant, click "Export Autopsy Report".

