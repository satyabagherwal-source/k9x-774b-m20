/**
 * 04_WORKFLOWS/factory-engine/continuous-coverage-monitor.mjs
 *
 * Continuous Knowledge Coverage & Persistence Health Monitor
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Measures destination coverage, distribution rates, index consistency,
 * inbox backlog, stale destinations, and domain intelligence depth.
 * Emits actionable health alerts and diagnostic metrics.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverCanonicalDestinations, INTELLIGENCE_DOMAINS } from './universal-destination-discovery.mjs';
import { auditAndSynchronizeRegistries } from './knowledge-registry-synchronizer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export function runContinuousCoverageAudit(brainRoot = DEFAULT_BRAIN_ROOT) {
  const root = path.resolve(brainRoot);
  const discovery = discoverCanonicalDestinations(root);
  const regAudit = auditAndSynchronizeRegistries(root);

  const timestamp = new Date().toISOString();
  const alerts = [];

  // 1. Evaluate Stale Destinations
  const staleDestinations = [];
  const activeDestinations = [];

  for (const [relPath, dest] of Object.entries(discovery.destinations)) {
    if (dest.routing_eligibility === 'AUTOMATED_DIRECT_WRITE') {
      if (dest.files_count === 0 && dest.is_directory) {
        staleDestinations.push({
          path: relPath,
          domain: dest.domain,
          filesCount: 0,
          reason: 'AUTOMATED_DESTINATION_HAS_ZERO_FILES'
        });
      } else {
        activeDestinations.push({
          path: relPath,
          filesCount: dest.files_count,
          bytes: dest.total_bytes
        });
      }
    }
  }

  // 2. Evaluate Domain Intelligence Depth (Domains A–M)
  const domainCoverage = {};
  const domRegPath = path.join(root, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
  let domReg = { domains: {}, records: {} };
  if (fs.existsSync(domRegPath)) {
    try { domReg = JSON.parse(fs.readFileSync(domRegPath, 'utf-8')); } catch (e) {}
  }

  for (const [letter, info] of Object.entries(INTELLIGENCE_DOMAINS)) {
    const domainRecordCount = domReg.domains[letter]?.total || 0;
    domainCoverage[letter] = {
      letter,
      id: info.id,
      name: info.name,
      registeredRecords: domainRecordCount,
      status: domainRecordCount > 0 ? 'ACTIVE' : 'EMPTY_AWAITING_DISTRIBUTION'
    };
  }

  // 3. Evaluate Inbox Backlog (Candidate Directives)
  const inboxBacklog = {
    totalDirectives: regAudit.registryStats.inboxDirectives,
    stagedForVerification: 0,
    stagedForHumanReview: 0,
    promotedCount: 0
  };

  const inboxRegPath = path.join(root, '11_INBOX', 'candidate-directives-registry.json');
  if (fs.existsSync(inboxRegPath)) {
    try {
      const inboxData = JSON.parse(fs.readFileSync(inboxRegPath, 'utf-8'));
      const directives = inboxData.directives || [];
      for (const d of directives) {
        if (d.status === 'STAGED_FOR_VERIFICATION') inboxBacklog.stagedForVerification++;
        else if (d.status === 'STAGED_FOR_HUMAN_REVIEW') inboxBacklog.stagedForHumanReview++;
        else if (d.status === 'PROMOTED_CANONICAL_ACTIVE') inboxBacklog.promotedCount++;
      }
    } catch (e) {}
  }

  // 4. Generate Actionable Alerts
  if (staleDestinations.some(d => d.path.includes('domain-intelligence'))) {
    alerts.push({
      severity: 'WARNING',
      code: 'DOMAIN_INTELLIGENCE_DISCONNECTED',
      message: '05_KNOWLEDGE/domain-intelligence has 0 markdown files on disk. Live multi-artifact distribution is required.'
    });
  }

  if (inboxBacklog.stagedForVerification > 100) {
    alerts.push({
      severity: 'INFO',
      code: 'LARGE_INBOX_BACKLOG',
      message: `${inboxBacklog.stagedForVerification} candidates staged in 11_INBOX. Automated triage/graduation recommended.`
    });
  }

  if (regAudit.danglingPointers.length > 0) {
    alerts.push({
      severity: 'WARNING',
      code: 'DANGLING_REGISTRY_POINTERS',
      message: `${regAudit.danglingPointers.length} dangling pointers detected in canonical registries. Reconciliation available.`
    });
  }

  const metrics = {
    timestamp,
    brainRoot: root,
    total_destinations_discovered: discovery.total_destinations_discovered,
    canonical_top_level_count: discovery.canonical_top_level_folders.length,
    active_automated_destinations: activeDestinations.length,
    stale_automated_destinations: staleDestinations.length,
    stale_destinations: staleDestinations,
    domain_coverage: domainCoverage,
    inbox_backlog: inboxBacklog,
    registry_consistency: {
      status: regAudit.status,
      dangling_pointers_count: regAudit.danglingPointers.length
    },
    alerts_count: alerts.length,
    alerts
  };

  // Write Metrics JSON & Markdown Report
  const metricsPath = path.join(root, '08_VERIFICATION', 'CONTINUOUS-COVERAGE-METRICS.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');

  const reportPath = path.join(root, '08_VERIFICATION', 'CONTINUOUS-COVERAGE-REPORT.md');
  const reportContent = `# CONTINUOUS KNOWLEDGE COVERAGE & HEALTH REPORT
**Generated At:** ${timestamp}  
**Status:** ${alerts.length === 0 ? 'HEALTHY' : 'ATTENTION_REQUIRED'}  

## 1. Destination Coverage Summary
- Total Discovered Destinations: **${metrics.total_destinations_discovered}**
- Active Automated Destinations: **${activeDestinations.length}**
- Stale Automated Destinations: **${staleDestinations.length}**

## 2. 13 Intelligence Domains Health (Domains A–M)
${Object.values(domainCoverage).map(d => `- **Domain ${d.letter}** (${d.name}): \`${d.status}\` (${d.registeredRecords} records)`).join('\n')}

## 3. Inbox & Quarantine Health
- Total Directives in 11_INBOX: **${inboxBacklog.totalDirectives}**
- Staged for Verification: **${inboxBacklog.stagedForVerification}**
- Staged for Human Review: **${inboxBacklog.stagedForHumanReview}**
- Promoted to Canonical: **${inboxBacklog.promotedCount}**

## 4. Active Health Alerts (${alerts.length})
${alerts.length === 0 ? 'Zero alerts. All monitored systems healthy.' : alerts.map(a => `- **[${a.severity}] ${a.code}**: ${a.message}`).join('\n')}
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  return metrics;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const m = runContinuousCoverageAudit();
  console.log(`Coverage Audit Complete. Destinations: ${m.total_destinations_discovered}, Alerts: ${m.alerts_count}`);
}

