/**
 * Cross-Session Agent Memory Consolidation Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\cross-session-memory.mjs
 * Purpose: Persists episodic session learning, human critiques, and defect corrections
 *          across multi-agent sessions, actively warning models against repeating past mistakes.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_FILE = path.join(BRAIN_ROOT, '.project-brain', 'session-memory.json');

/**
 * Ensures session memory storage exists
 */
function ensureMemoryStorage() {
  const dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_FILE)) {
    const initial = { version: '1.0.0', last_updated: new Date().toISOString(), memories: [] };
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

/**
 * Loads all recorded session memories
 * 
 * @returns {object} Stored memories database
 */
export function loadAllMemories() {
  ensureMemoryStorage();
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch (e) {
    return { version: '1.0.0', last_updated: new Date().toISOString(), memories: [] };
  }
}

/**
 * Records an episodic session learning, defect correction, or user critique
 * 
 * @param {object} item - Memory item configuration
 * @returns {object} Recorded memory record with unique memory_id
 */
export function recordSessionMemory(item = {}) {
  ensureMemoryStorage();
  const db = loadAllMemories();

  const memId = `mem-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const memoryRecord = {
    memory_id: memId,
    timestamp: new Date().toISOString(),
    task_context: item.task_context || 'General Task Execution',
    defect_observed: item.defect_observed || null,
    user_critique: item.user_critique || null, // e.g. "Same mistake happening again"
    invariant_lesson: (item.invariant_lesson || item.lesson || '').trim(),
    negative_warning: (item.negative_warning || '').trim(),
    keywords: item.keywords || []
  };

  if (!memoryRecord.invariant_lesson && !memoryRecord.negative_warning) {
    throw new Error('Memory record must contain an invariant_lesson or negative_warning.');
  }

  db.memories.push(memoryRecord);
  db.last_updated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(db, null, 2), 'utf-8');

  return memoryRecord;
}

/**
 * Queries past session memories relevant to a task objective or error symptom
 * 
 * @param {string} queryText - Task objective or error message
 * @returns {Array<object>} Matching memory warnings
 */
export function querySessionMemories(queryText = '') {
  const db = loadAllMemories();
  if (!queryText || db.memories.length === 0) return [];

  const tokens = queryText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  const matched = [];

  for (const mem of db.memories) {
    let score = 0;
    const corpus = `${mem.task_context} ${mem.defect_observed || ''} ${mem.invariant_lesson} ${mem.negative_warning} ${mem.keywords.join(' ')}`.toLowerCase();

    for (const t of tokens) {
      if (corpus.includes(t)) {
        score += 1;
      }
    }

    if (score > 0) {
      matched.push({ score, memory: mem });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 3).map(m => m.memory);
}

/**
 * Actively injects past session warnings into a Task Contract's negative constraints
 * 
 * @param {object} contract - The task contract to protect against repeating past bugs
 * @returns {object} Updated contract with injected memory shields
 */
export function injectSessionMemoryIntoContract(contract) {
  if (!contract || !contract.objective) return contract;

  const relevantMemories = querySessionMemories(contract.objective);
  if (relevantMemories.length === 0) return contract;

  for (const mem of relevantMemories) {
    const warning = mem.negative_warning 
      ? `🛑 [PAST FAILURE SHIELD]: ${mem.negative_warning}`
      : `⚠️ [PAST LESSON]: ${mem.invariant_lesson}`;

    if (!contract.constraints.negative_constraints.includes(warning)) {
      contract.constraints.negative_constraints.push(warning);
    }
  }

  return contract;
}
