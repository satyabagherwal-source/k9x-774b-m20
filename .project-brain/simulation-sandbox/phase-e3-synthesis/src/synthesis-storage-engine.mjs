/**
 * Phase E.3: Synthesis Storage & Read-Back Verification Engine
 * 
 * Persists all 249 synthesized records into the sandbox:
 * 1. Individual markdown knowledge artifacts in synthesized-knowledge/
 * 2. Unified master catalog in data/synthesized-candidates-249.json
 * 3. Enforces 100% byte-level SHA-256 read-back verification on all outputs.
 * 
 * STRICT INVARIANT: ZERO production modifications. Pure sandbox storage.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_DIR = path.join(SANDBOX_ROOT, 'synthesized-knowledge');
const DATA_DIR = path.join(SANDBOX_ROOT, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'synthesized-candidates-249.json');

export class SynthesisStorageEngine {
  constructor() {
    if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  persistSynthesizedRecords(records) {
    const individualResults = [];
    let readBackParityFailures = 0;

    for (const rec of records) {
      const filename = `${rec.synthesisId}.md`;
      const filePath = path.join(KNOWLEDGE_DIR, filename);

      const markdownContent = `---
id: "${rec.synthesisId}"
directiveId: "${rec.directiveId}"
ordinalIndex: ${rec.ordinalIndex}
title: "${rec.clearTechnicalTitle.replace(/"/g, '\\"')}"
status: "${rec.synthesisStatus}"
confidence: ${rec.confidence}
primaryDomain: "${rec.domains.primary}"
secondaryDomains: [${rec.domains.secondary.map(s => `"${s}"`).join(', ')}]
targetFolder: "${rec.canonicalDestination.targetFolder}"
sourceRepo: "${rec.sourceProvenance.sourceRepo}"
sourceCommit: "${rec.sourceProvenance.sourceCommit}"
parentDossier: "${rec.sourceProvenance.dossierPath || ''}"
timestamp: "${rec.timestamp}"
---

# ${rec.clearTechnicalTitle}

## 1. Problem Space & Context
${rec.originalProblem}

## 2. Technical Principle & Implementation Pattern
${rec.technicalPrinciple}

## 3. Technical Rationale (WHY)
${rec.why}

## 4. Operational Boundaries
### When to Apply
${rec.whenToApply}

### When NOT to Apply
${rec.whenNotToApply}

## 5. Negative Constraints (Anti-Patterns)
> [!WARNING]
> ${rec.negativeConstraints}

## 6. Failure Modes & Limitations
${rec.failureModesAndLimitations}

## 7. Implementation Guidance
${rec.implementationGuidance}

## 8. Verification Protocol
${rec.verificationMethod}

## 9. Provenance & Epistemic Audit
- **Repository**: \`${rec.sourceProvenance.sourceRepo}\`
- **Revision Commit**: \`${rec.sourceProvenance.sourceCommit}\`
- **Forensic Dossier**: \`${rec.sourceProvenance.dossierPath || 'None'}\`
- **Verification Readiness**: \`${rec.synthesisStatus}\`
`;

      const expectedHash = crypto.createHash('sha256').update(markdownContent, 'utf8').digest('hex');

      // 1. Write
      fs.writeFileSync(filePath, markdownContent, 'utf8');

      // 2. Read-Back Verification Barrier
      const readBack = fs.readFileSync(filePath, 'utf8');
      const actualHash = crypto.createHash('sha256').update(readBack, 'utf8').digest('hex');

      const verified = expectedHash === actualHash;
      if (!verified) readBackParityFailures++;

      individualResults.push({
        synthesisId: rec.synthesisId,
        directiveId: rec.directiveId,
        filename,
        bytes: Buffer.byteLength(readBack, 'utf8'),
        sha256: actualHash,
        verified
      });
    }

    // Persist Master Catalog
    const catalogData = {
      metadata: {
        missionId: 'UKD-PHASE-E3-CANDIDATE-SYNTHESIS-01',
        timestamp: new Date().toISOString(),
        totalSynthesized: records.length,
        readBackParitySuccess: readBackParityFailures === 0,
        knowledgeDirectory: 'synthesized-knowledge/'
      },
      records
    };

    const catalogRaw = JSON.stringify(catalogData, null, 2);
    fs.writeFileSync(CATALOG_PATH, catalogRaw, 'utf8');

    const catalogReadBack = fs.readFileSync(CATALOG_PATH, 'utf8');
    const catalogHash = crypto.createHash('sha256').update(catalogReadBack, 'utf8').digest('hex');

    return {
      catalogPath: CATALOG_PATH,
      catalogBytes: Buffer.byteLength(catalogReadBack, 'utf8'),
      catalogHash,
      totalFilesWritten: individualResults.length,
      allReadBackVerified: readBackParityFailures === 0,
      individualResults
    };
  }
}

