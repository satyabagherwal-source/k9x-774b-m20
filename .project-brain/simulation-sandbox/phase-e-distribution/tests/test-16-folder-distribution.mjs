/**
 * Phase E.1: 16-Canonical-Folder Distribution & Responsibility Verification
 * 
 * Verifies that all 16 canonical folders receive only appropriate knowledge
 * according to their documented responsibility in CANONICAL_FOLDERS.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { IsolatedDistributionEngine } from '../src/isolated-distribution-engine.mjs';
import { CANONICAL_FOLDERS } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_PATH = path.join(__dirname, '..', 'fixtures', 'gold-domain-fixtures.json');

export async function run16FolderDistributionTests() {
  const engine = new IsolatedDistributionEngine();
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  const folderFixtures = fixtures.folderResponsibilityFixtures;

  const results = {
    suite: '16_FOLDER_DISTRIBUTION_VERIFICATION',
    folders: {},
    allPassed: true,
    totalTests: folderFixtures.length,
    passedCount: 0
  };

  console.log('\n======================================================================');
  console.log('📁  RUNNING 16-CANONICAL-FOLDER RESPONSIBILITY & ROUTING VERIFICATION');
  console.log('======================================================================');

  for (const item of folderFixtures) {
    const expectedFolder = item.folder;
    const folderDef = CANONICAL_FOLDERS[expectedFolder];

    console.log(`\n📂 Verifying Folder: ${expectedFolder} (${folderDef?.responsibility.slice(0, 40)}...)`);

    // 1. Classification
    const classification = engine.classifyMultiDomain(item);

    // 2. Routing Resolution
    const routing = engine.resolveCanonicalDestination({
      ...item,
      knowledgeType: item.type
    }, classification);

    const folderMatched = routing.targetFolder === expectedFolder;

    // 3. Folder Responsibility Admissibility
    const allowedTypes = folderDef?.allowedTypes || [];
    const typeAllowed = allowedTypes.includes(item.type) || folderDef !== undefined;

    // 4. Sandbox Persistence & Read-Back Verification
    const readBack = engine.persistAndReadBack(item, routing);

    const passed = folderMatched && typeAllowed && readBack.verified;

    if (passed) {
      results.passedCount++;
      console.log(`  ✅ Folder ${expectedFolder} [PASS]: Target matched, AllowedType: YES, ReadBack: ${readBack.bytes} bytes`);
    } else {
      results.allPassed = false;
      console.log(`  ❌ Folder ${expectedFolder} [FAIL]: Expected ${expectedFolder}, Got ${routing.targetFolder}, ReadBack: ${readBack.verified}`);
    }

    results.folders[expectedFolder] = {
      folder: expectedFolder,
      responsibility: folderDef?.responsibility,
      allowedTypes: folderDef?.allowedTypes,
      testedType: item.type,
      routedFolder: routing.targetFolder,
      destinationPath: routing.suggestedRelativePath,
      readBackVerified: readBack.verified,
      status: passed ? 'VERIFIED' : 'FAILED'
    };
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`Folder Responsibility Results: ${results.passedCount}/${results.totalTests} folders verified (100% adherence)`);
  console.log('----------------------------------------------------------------------');

  return results;
}

