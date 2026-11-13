/**
 * 04_WORKFLOWS/factory-engine/test-canary-live-distribution.mjs
 *
 * Canary Verification Script for Live Universal Multi-Artifact Distribution
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { submitWithUniversalDistribution } from './universal-distribution-gateway-adapter.mjs';
import { DISTRIBUTION_MODES, calculateContentHash } from './universal-multi-artifact-distributor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

async function runCanary() {
  console.log('======================================================================');
  console.log('🐥 EXECUTING CANARY LIVE MULTI-ARTIFACT DISTRIBUTION');
  console.log(`   Brain Root: ${BRAIN_ROOT}`);
  console.log('======================================================================');

  const canaryPackage = {
    repository: 'canary-enterprise-vault-sentinel',
    source_url: 'https://github.com/AI-Builder-Brain/canary-sentinel',
    source_version: 'commit-canary-live-01',
    license: 'MIT',
    learning_id: `learn-canary-${Date.now()}`,
    slug: 'canary-enterprise-vault-sentinel',
    dossier_content: `# Canary Enterprise Vault Sentinel Learnings

## Overview
This component implements enterprise cross-tenant encryption isolation, bounded token bucket rate limiting, and an autonomous supervisory agent contract.

### Architectural Boundary & Decoupling Invariant
We chose an asynchronous transactional outbox pattern to decouple domain write models from downstream notification pipelines. This eliminates distributed locking and guarantees zero latency spikes under high write volume.

### Operational Setup & Integration Playbook
Step-by-step setup procedure for deploying the Vault Sentinel:
1. Initialize tenant keystore in encrypted memory segment.
2. Bind the sentinel middleware to the primary gateway router.
3. Establish heartbeat healthcheck on port 9443.

### Agent Fleet Contract & Orchestration
The Sentinel Fleet Agent operates as an autonomous security verifier with strict non-interactive sandboxing and continuous token refresh capabilities.

### Defect Shield & Verification Method
Empirical defect trap: Verify zero token leakage during abrupt network partitioning using property-based chaos injection.
`,
    candidate_rules: [
      {
        title: 'Asynchronous Transactional Outbox Decoupling',
        body: `**RULE**: Microservice architectures must decouple primary transactional writes from event publishing via local durable outbox tables.\n\n**WHY**: Eliminates two-phase commit latency and network partition deadlocks.\n\n**WHEN TO APPLY**: In all multi-tenant messaging pipelines.`
      }
    ]
  };

  const result = await submitWithUniversalDistribution(canaryPackage, {
    brainRoot: BRAIN_ROOT,
    enableLiveMultiDistribution: true,
    mode: DISTRIBUTION_MODES.CANONICAL_LIVE
  });

  console.log('\n[CANARY RESULT SUMMARY]:');
  console.log('Success:', result.success);
  console.log('Mode:', result.mode);
  console.log('Primary Gateway Success:', result.primaryGatewayResult?.success);
  console.log('Distribution Persisted Count:', result.distributionResult?.persistence?.persistedCount);
  console.log('Distribution Skipped Count:', result.distributionResult?.persistence?.skippedCount);
  console.log('Distribution Failed Count:', result.distributionResult?.persistence?.failCount);

  if (result.distributionResult?.persistence?.failed?.length > 0) {
    console.error('Failed items:', JSON.stringify(result.distributionResult.persistence.failed, null, 2));
    process.exit(1);
  }

  // Verify all written files on disk
  console.log('\n[READ-BACK VERIFICATION OF PERSISTED ARTIFACTS]:');
  let verifiedCount = 0;
  for (const item of (result.distributionResult?.persistence?.successful || [])) {
    const full = item.fullPath;
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf-8');
      const hash = calculateContentHash(content);
      console.log(`✅ VERIFIED: ${path.relative(BRAIN_ROOT, full)} (${content.length} bytes, SHA: ${hash.slice(0, 16)}...)`);
      verifiedCount++;
    } else {
      console.error(`❌ MISSING FILE: ${full}`);
      process.exit(1);
    }
  }

  console.log(`\n🎉 CANARY DISTRIBUTION COMPLETED & VERIFIED: ${verifiedCount} artifacts written and confirmed.`);
}

runCanary().catch(err => {
  console.error('Canary fatal error:', err);
  process.exit(1);
});

