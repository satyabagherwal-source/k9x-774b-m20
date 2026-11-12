/**
 * Sandbox Brain Root Setup Helper
 * 
 * Creates an isolated sandbox filesystem tree for executing the actual production
 * submitToBrainGateway() function with ZERO risk to production repositories.
 */

import fs from 'fs';
import path from 'path';

export function setupSandboxBrainRoot(targetDir) {
  const dirs = [
    '05_KNOWLEDGE',
    '07_PROJECT_LEARNING',
    '08_VERIFICATION',
    '09_SOURCES',
    '11_INBOX',
    '14_EVOLUTION',
    '.project-brain'
  ];

  for (const d of dirs) {
    const fullPath = path.join(targetDir, d);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // Seed minimal canonical files required by submitToBrainGateway()
  const patternsPath = path.join(targetDir, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (!fs.existsSync(patternsPath)) {
    fs.writeFileSync(patternsPath, '# Canonical Engineering Patterns\n\nRule 1: Base Pattern\n', 'utf8');
  }

  const indexPath = path.join(targetDir, '05_KNOWLEDGE', 'knowledge-index.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ version: '2.0.0', items: {} }, null, 2), 'utf8');
  }

  const checkpointsPath = path.join(targetDir, '.project-brain', 'harvest-checkpoints.json');
  if (!fs.existsSync(checkpointsPath)) {
    fs.writeFileSync(checkpointsPath, JSON.stringify({}, null, 2), 'utf8');
  }

  const verMatrixPath = path.join(targetDir, '08_VERIFICATION', 'harvest-verification-matrix.md');
  if (!fs.existsSync(verMatrixPath)) {
    fs.writeFileSync(verMatrixPath, '# Harvest Verification Matrix\n', 'utf8');
  }

  const provPath = path.join(targetDir, '09_SOURCES', 'harvest-provenance-ledger.md');
  if (!fs.existsSync(provPath)) {
    fs.writeFileSync(provPath, '# Harvest Provenance Ledger\n', 'utf8');
  }

  const evoMetricsPath = path.join(targetDir, '14_EVOLUTION', 'harvest-yield-metrics.json');
  if (!fs.existsSync(evoMetricsPath)) {
    fs.writeFileSync(evoMetricsPath, JSON.stringify({ metrics: [] }, null, 2), 'utf8');
  }

  return targetDir;
}

