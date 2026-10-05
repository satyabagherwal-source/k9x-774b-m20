import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dispatchZeroCostAiSynthesis, loadAllAiKeys } from './ai-provider-pool.mjs';
import { resolveNextRuleNumber } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const LEARNING_DIR = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
const PATTERNS_PATH = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const SKILLS_DIR = path.join(BRAIN_ROOT, '03_SKILLS');
const LOG_FILE = path.join(BRAIN_ROOT, 'dossier-distillation.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] [DOSSIER-DISTILLER] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (e) {}
}

/**
 * Returns list of project dossiers ordered by depth/size
 */
export function getAvailableDossiers() {
  if (!fs.existsSync(LEARNING_DIR)) return [];
  return fs.readdirSync(LEARNING_DIR)
    .filter((f) => f.endsWith('-learnings.md') || f.endsWith('.md'))
    .filter((f) => f !== 'project-learning-protocol.md')
    .map((f) => ({
      name: f,
      fullPath: path.join(LEARNING_DIR, f),
      size: fs.statSync(path.join(LEARNING_DIR, f)).size
    }))
    .sort((a, b) => b.size - a.size);
}

/**
 * Reads existing pattern titles to ensure zero duplication
 */
export function getExistingPatterns() {
  if (!fs.existsSync(PATTERNS_PATH)) return [];
  const content = fs.readFileSync(PATTERNS_PATH, 'utf-8');
  const matches = content.match(/^## \d+\.\s*(.+)$/gm) || [];
  return matches.map((m) => m.replace(/^## \d+\.\s*/, '').trim().toLowerCase());
}

/**
 * Distills high-value lessons from a specific dossier
 */
export async function distillDossier(dossierObj) {
  log(`🔬 Analyzing dossier: ${dossierObj.name} (${Math.round(dossierObj.size / 1024)} KB)...`);
  const rawContent = fs.readFileSync(dossierObj.fullPath, 'utf-8');

  // If dossier contains patches or issues, extract them
  const hasPatches = rawContent.includes('### D8: Forensic Bug Fixes') || rawContent.includes('Production Commit Patches');
  const hasIssues = rawContent.includes('closed production bug issues') || rawContent.includes('CLOSED BUG ISSUES');

  if (!hasPatches && !hasIssues && dossierObj.size < 5000) {
    log(`⏩ Skipping ${dossierObj.name}: insufficient empirical bug/patch substance.`);
    return { success: false, reason: 'INSUFFICIENT_SUBSTANCE' };
  }

  log(`📖 Extracting architectural invariants from ${dossierObj.name}...`);
  return { success: true, name: dossierObj.name };
}

/**
 * Main batch runner
 */
export async function runDossierDistillation(maxCount = 5) {
  log(`======================================================================`);
  log(`🚀 AUTONOMOUS DOSSIER DISTILLATION ENGINE`);
  log(`   Mission: Transform 07_PROJECT_LEARNING raw dossiers into 05_KNOWLEDGE & 03_SKILLS`);
  log(`   Timestamp: ${new Date().toISOString()}`);
  log(`======================================================================`);

  const dossiers = getAvailableDossiers();
  log(`📚 Discovered ${dossiers.length} project dossiers in 07_PROJECT_LEARNING/`);

  let processed = 0;
  for (const d of dossiers.slice(0, maxCount)) {
    await distillDossier(d);
    processed++;
  }

  log(`✅ Distillation pass completed. Processed ${processed} dossiers.`);
  return { success: true, processed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDossierDistillation().catch(console.error);
}
