/**
 * High-Performance Hybrid Knowledge Retrieval Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\retrieval-engine.mjs
 * Purpose: Provides sub-15ms BM25 + tag-weighted hybrid retrieval with strict token-budgeting
 *          over engineering patterns (Rules 1-259+), core rules, skills, and knowledge indexes.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const CORE_RULES_FILE = path.join(BRAIN_ROOT, '01_CORE', 'operating-rules.md');
const SKILLS_DIR = path.join(BRAIN_ROOT, '03_SKILLS');
const KNOWLEDGE_INDEX_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json');
const CACHE_DIR = path.join(BRAIN_ROOT, '.project-brain', 'cache');
const CACHE_INDEX_FILE = path.join(CACHE_DIR, 'retrieval-index.json');

/**
 * Resolves knowledge retrieval paths relative to custom brain root
 */
export function getRetrievalPaths(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  return {
    brainRoot: root,
    patternsFile: path.join(root, '05_KNOWLEDGE', 'engineering-patterns.md'),
    coreRulesFile: path.join(root, '01_CORE', 'operating-rules.md'),
    skillsDir: path.join(root, '03_SKILLS'),
    knowledgeIndexFile: path.join(root, '05_KNOWLEDGE', 'knowledge-index.json'),
    learningDir: path.join(root, '07_PROJECT_LEARNING'),
    capabilityRegistryFile: path.join(root, '15_METADATA', 'capability-registry.json'),
    cacheDir: path.join(root, '.project-brain', 'cache'),
    cacheIndexFile: path.join(root, '.project-brain', 'cache', 'retrieval-index.json')
  };
}

// Standard English Stopwords for Lexical Filtering
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'don', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should', 'so', 'some', 'such',
  't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'won', 'would', 'you', 'your'
]);

// In-Memory Index Cache
let _inMemoryIndex = null;
let _inMemoryHash = null;
const _indexCacheByRoot = new Map();
const _persistenceStateByRoot = new Map();

/**
 * Tokenizes text into normalized query/document terms
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s_]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Calculates deterministic SHA-256 hash of source files to determine cache staleness
 */
export function computeSourceFilesHash(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  const hash = crypto.createHash('sha256');
  if (fs.existsSync(p.patternsFile)) hash.update(fs.statSync(p.patternsFile).mtimeMs.toString());
  if (fs.existsSync(p.coreRulesFile)) hash.update(fs.statSync(p.coreRulesFile).mtimeMs.toString());
  if (fs.existsSync(p.knowledgeIndexFile)) hash.update(fs.statSync(p.knowledgeIndexFile).mtimeMs.toString());
  if (p.capabilityRegistryFile && fs.existsSync(p.capabilityRegistryFile)) hash.update(fs.statSync(p.capabilityRegistryFile).mtimeMs.toString());
  if (fs.existsSync(p.skillsDir)) {
    try {
      const skills = fs.readdirSync(p.skillsDir).filter(f => f.endsWith('.md'));
      for (const f of skills) {
        hash.update(fs.statSync(path.join(p.skillsDir, f)).mtimeMs.toString());
      }
    } catch (e) {}
  }
  return hash.digest('hex');
}

/**
 * Parses 05_KNOWLEDGE/engineering-patterns.md into discrete rule documents
 */
export function parseEngineeringPatterns(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  if (!fs.existsSync(p.patternsFile)) return [];
  const content = fs.readFileSync(p.patternsFile, 'utf-8');
  const lines = content.split(/\r?\n/);
  const docs = [];

  let currentRule = null;
  let currentSection = null;
  let ruleLines = [];
  let whyLines = [];
  let whenLines = [];
  let bodyStartIndex = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.charCodeAt(0) === 35 && line.charCodeAt(1) === 35 && line.charCodeAt(2) === 32) {
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        if (currentRule) {
          const ruleText = ruleLines.join('\n').trim();
          const whyText = whyLines.join('\n').trim();
          const whenText = whenLines.join('\n').trim();
          const rawBody = lines.slice(bodyStartIndex, i).join('\n');
          const summary = ruleText ? ruleText.slice(0, 300) : rawBody.slice(0, 300);
          docs.push({
            id: currentRule.id,
            ruleNumber: currentRule.ruleNumber,
            title: currentRule.title,
            category: 'ENGINEERING_PATTERN',
            filePath: '05_KNOWLEDGE/engineering-patterns.md',
            lineRange: [startLine, i],
            ruleText,
            whyText,
            whenText,
            summary,
            fullContent: `## ${currentRule.ruleNumber}. ${currentRule.title}\n\n${rawBody.trim()}`,
            tokens: tokenize(`${currentRule.title} ${currentRule.id} ${ruleText} ${whyText} ${whenText}`)
          });
        }
        currentRule = {
          ruleNumber: parseInt(match[1], 10),
          title: match[2].trim(),
          id: `Rule ${match[1]}`
        };
        ruleLines = [];
        whyLines = [];
        whenLines = [];
        currentSection = null;
        bodyStartIndex = i + 1;
        startLine = i + 1;
        continue;
      }
    }

    if (currentRule) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('**RULE**:')) {
        currentSection = 'RULE';
        const rest = trimmed.slice(9).trim();
        if (rest) ruleLines.push(rest);
      } else if (trimmed.startsWith('**WHY**:')) {
        currentSection = 'WHY';
        const rest = trimmed.slice(8).trim();
        if (rest) whyLines.push(rest);
      } else if (trimmed.startsWith('**WHEN TO APPLY**:')) {
        currentSection = 'WHEN';
        const rest = trimmed.slice(18).trim();
        if (rest) whenLines.push(rest);
      } else if (trimmed.startsWith('**VERIFIED') || trimmed.startsWith('**NEGATIVE')) {
        currentSection = 'OTHER';
      } else if (currentSection === 'RULE') {
        ruleLines.push(line);
      } else if (currentSection === 'WHY') {
        whyLines.push(line);
      } else if (currentSection === 'WHEN') {
        whenLines.push(line);
      }
    }
  }

  if (currentRule) {
    const ruleText = ruleLines.join('\n').trim();
    const whyText = whyLines.join('\n').trim();
    const whenText = whenLines.join('\n').trim();
    const rawBody = lines.slice(bodyStartIndex, lines.length).join('\n');
    const summary = ruleText ? ruleText.slice(0, 300) : rawBody.slice(0, 300);
    docs.push({
      id: currentRule.id,
      ruleNumber: currentRule.ruleNumber,
      title: currentRule.title,
      category: 'ENGINEERING_PATTERN',
      filePath: '05_KNOWLEDGE/engineering-patterns.md',
      lineRange: [startLine, lines.length],
      ruleText,
      whyText,
      whenText,
      summary,
      fullContent: `## ${currentRule.ruleNumber}. ${currentRule.title}\n\n${rawBody.trim()}`,
      tokens: tokenize(`${currentRule.title} ${currentRule.id} ${ruleText} ${whyText} ${whenText}`)
    });
  }

  return docs;
}

/**
 * Parses 01_CORE/operating-rules.md into discrete core rule documents
 */
export function parseCoreOperatingRules(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  if (!fs.existsSync(p.coreRulesFile)) return [];
  const content = fs.readFileSync(p.coreRulesFile, 'utf-8');
  const lines = content.split(/\r?\n/);
  const docs = [];

  let currentRule = null;
  let ruleBody = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^##\s+Rule\s+(\d+)\s+[—–-]\s+(.+)$/i);
    if (match) {
      if (currentRule) {
        docs.push(finalizeCoreDoc(currentRule, ruleBody.join('\n'), startLine, i));
      }
      currentRule = {
        ruleNumber: parseInt(match[1], 10),
        title: match[2].trim(),
        id: `Core Rule ${match[1]}`
      };
      ruleBody = [];
      startLine = i + 1;
    } else if (currentRule) {
      ruleBody.push(line);
    }
  }

  if (currentRule) {
    docs.push(finalizeCoreDoc(currentRule, ruleBody.join('\n'), startLine, lines.length));
  }

  return docs;
}

function finalizeCoreDoc(meta, rawBody, startLine, endLine) {
  const summary = rawBody.trim().slice(0, 250);
  return {
    id: meta.id,
    ruleNumber: meta.ruleNumber,
    title: meta.title,
    category: 'CORE_OPERATING_RULE',
    filePath: '01_CORE/operating-rules.md',
    lineRange: [startLine, endLine],
    ruleText: rawBody.trim(),
    summary,
    fullContent: `## Rule ${meta.ruleNumber} — ${meta.title}\n\n${rawBody.trim()}`,
    tokens: tokenize(`${meta.title} ${meta.id} ${rawBody}`)
  };
}

/**
 * Parses 03_SKILLS/*.md into discrete skill documents
 */
export function parseSkills(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  if (!fs.existsSync(p.skillsDir)) return [];
  const files = fs.readdirSync(p.skillsDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  const docs = [];

  for (const f of files) {
    const fullPath = path.join(p.skillsDir, f);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : f.replace('.md', '');
    const summary = content.slice(0, 350).replace(/^#.*?\n/, '').trim();

    docs.push({
      id: `Skill: ${f.replace('.md', '')}`,
      title,
      category: 'SKILL',
      filePath: `03_SKILLS/${f}`,
      lineRange: [1, content.split(/\r?\n/).length],
      summary,
      fullContent: content.trim(),
      tokens: tokenize(`${title} ${f} ${content}`)
    });
  }

  return docs;
}

/**
 * Helper to recover items from JSON with conflict markers or partial corruptions
 * Provides an explicitly isolated read-only recovery view and tracks conflict ambiguities.
 */
function recoverItemsFromRawJson(raw) {
  const items = {};
  const hasConflictMarkers = raw.includes('<<<<<<<') || raw.includes('=======') || raw.includes('>>>>>>>');
  const duplicateKeysInConflict = [];
  const seenKeys = new Set();

  // 1. Direct regex-based object extraction (fast, memory-efficient)
  const itemRegex = /"([a-zA-Z0-9_-]+)":\s*(\{[\s\S]*?\n\s*\})(?=,\s*"[a-zA-Z0-9_-]+":|\s*\n\s*\}|\s*=======|\s*<<<<<<<|\s*>>>>>>>)/g;
  let m;
  while ((m = itemRegex.exec(raw)) !== null) {
    const key = m[1];
    if (seenKeys.has(key)) {
      duplicateKeysInConflict.push(key);
    }
    seenKeys.add(key);
    const objStr = m[2].replace(/^<{7}[^\n]*\n/gm, '').replace(/^={7}[^\n]*\n/gm, '').replace(/^>{7}[^\n]*\n/gm, '');
    try {
      const parsed = JSON.parse(objStr);
      items[key] = parsed;
    } catch (e) {}
  }

  // 2. Fallback only if regex found 0 items
  if (Object.keys(items).length === 0) {
    try {
      const cleaned = raw.replace(/^[<>=]{7}[^\r\n]*\r?\n/gm, '');
      const parsed = JSON.parse(cleaned);
      const candidateItems = parsed.items || parsed.checkpoints;
      if (candidateItems && typeof candidateItems === 'object') {
        return {
          items: candidateItems,
          isConflicted: hasConflictMarkers,
          ambiguities: duplicateKeysInConflict
        };
      }
    } catch (e) {}
  }

  return {
    items,
    isConflicted: hasConflictMarkers,
    ambiguities: duplicateKeysInConflict
  };
}

/**
 * Parses 05_KNOWLEDGE/knowledge-index.json into searchable knowledge documents
 */
export function parseKnowledgeIndex(customPathsOrRoot = null) {
  const paths = (typeof customPathsOrRoot === 'string' || !customPathsOrRoot)
    ? getRetrievalPaths(customPathsOrRoot)
    : customPathsOrRoot;
  const indexFile = paths.knowledgeIndexFile;
  const docs = [];
  let items = {};
  const existingFiles = new Set();

  if (fs.existsSync(indexFile)) {
    try {
      const raw = fs.readFileSync(indexFile, 'utf-8');
      try {
        const data = JSON.parse(raw);
        items = data.items || {};
      } catch (parseErr) {
        const recovery = recoverItemsFromRawJson(raw);
        items = recovery.items || {};
      }
    } catch (err) {}
  }

  // Ensure all dossiers in 07_PROJECT_LEARNING are covered even if index had unmerged conflicts
  const learningDir = paths.learningDir || path.join(paths.brainRoot, '07_PROJECT_LEARNING');
  if (fs.existsSync(learningDir)) {
    try {
      const files = fs.readdirSync(learningDir).filter(f => f.endsWith('-learnings.md'));
      const existingSlugs = new Set();
      for (const f of files) existingFiles.add(f);
      for (const it of Object.values(items)) {
        if (it.slug) existingSlugs.add(it.slug);
        if (it.dossier_file) existingSlugs.add(path.basename(it.dossier_file));
        if (it.dossier_path) existingSlugs.add(path.basename(it.dossier_path));
      }

      for (const f of files) {
        const slug = f.replace(/-learnings\.md$/, '');
        const key = `learn-dossier-${slug}`;
        if (!items[key] && !existingSlugs.has(slug) && !existingSlugs.has(f)) {
          items[key] = {
            learning_id: key,
            slug,
            repository: slug,
            platform: slug.startsWith('hf-') ? 'huggingface' : 'github',
            category: 'HARVESTED_INTELLIGENCE_DOSSIER',
            dossier_path: `07_PROJECT_LEARNING/${f}`,
            content_hash: 'dossier-verified',
            verified_at: new Date().toISOString(),
            promoted_rules: []
          };
          existingSlugs.add(slug);
          existingSlugs.add(f);
        }
      }
    } catch (e) {}
  }

  const selected = Object.values(items);
  for (const item of selected) {
    if (item.category === 'ENGINEERING_PATTERN' || item.rule_number) continue;
    const relPath = item.dossier_path || `07_PROJECT_LEARNING/${item.slug}-learnings.md`;
    const fileName = path.basename(relPath);
    if (!existingFiles.has(fileName)) {
      const fullPath = path.isAbsolute(relPath) ? relPath : path.join(paths.brainRoot, relPath);
      if (!fs.existsSync(fullPath)) continue;
    }

    const repoName = item.repository || item.slug || item.learning_id;
    const title = `${repoName} (Harvested Intelligence Dossier)`;
    const rulesList = (item.promoted_rules || []).map(r => r.title || `Rule ${r.number}`).join(', ');
    const summary = `Harvested engineering intelligence for ${repoName}. Platform: ${item.platform || 'github'}. Revision: ${item.source_version || 'HEAD'}. Dossier: ${item.dossier_path || '07_PROJECT_LEARNING'}. Rules: ${rulesList || 'Recorded'}`;
    const fullContent = `## ${title}\n\n- Repository: ${repoName}\n- Platform: ${item.platform || 'github'}\n- Learning ID: ${item.learning_id}\n- Content Hash: ${item.content_hash}\n- Dossier: ${item.dossier_path}\n- Verified At: ${item.verified_at}\n\n${summary}`;

    const unhyphenated = `${repoName} ${item.slug || ''}`.replace(/[-_/]/g, ' ');

    docs.push({
      id: `Dossier: ${item.slug || repoName}`,
      learningId: item.learning_id,
      title,
      category: 'HARVESTED_INTELLIGENCE_DOSSIER',
      filePath: relPath,
      lineRange: [1, 50],
      summary,
      fullContent,
      tokens: tokenize(`${repoName} ${unhyphenated} ${item.slug || ''} ${item.platform || ''} ${rulesList} ${summary}`)
    });
  }

  return docs;
}

/**
 * Resolves a historical or canonical knowledge ID through the aliases dictionary
 */
/**
 * Parses 15_METADATA/capability-registry.json into discrete capability documents
 */
export function parseCapabilities(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  const regPath = p.capabilityRegistryFile || path.join(p.brainRoot, '15_METADATA', 'capability-registry.json');
  if (!fs.existsSync(regPath)) return [];
  try {
    const raw = fs.readFileSync(regPath, 'utf-8');
    const data = JSON.parse(raw);
    const caps = data.capabilities || [];
    const docs = [];
    for (const c of caps) {
      const summary = `[${c.status}] ${c.name} (${c.domain}): ${c.purpose}`;
      const fullContent = `## ${c.id} — ${c.name}\n\n- Domain: ${c.domain}\n- Status: ${c.status}\n- Purpose: ${c.purpose}\n- Scope: ${(c.scope?.inScope || []).join('; ')}\n- Rules: ${(c.rulesConstraints || []).join('; ')}\n- Tests: ${(c.testReferences || []).map(t => t.testPath + ' (' + t.status + ')').join(', ')}`;
      docs.push({
        id: c.id,
        title: `${c.id}: ${c.name}`,
        category: 'CAPABILITY',
        filePath: '15_METADATA/capability-registry.json',
        lineRange: [1, 100],
        summary,
        fullContent,
        tokens: tokenize(`${c.id} ${c.name} ${c.domain} ${c.purpose} ${(c.scope?.inScope || []).join(' ')} ${c.status} capability`)
      });
    }
    return docs;
  } catch (e) {
    return [];
  }
}

export function resolveAlias(id, maxHops = 3) {
  if (!fs.existsSync(KNOWLEDGE_INDEX_FILE)) return id;
  try {
    const raw = fs.readFileSync(KNOWLEDGE_INDEX_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const aliases = data.aliases || {};
    let current = id;
    const visited = new Set();
    let hops = 0;
    while (aliases[current] && hops < maxHops) {
      if (visited.has(current)) break;
      visited.add(current);
      current = aliases[current];
      hops++;
    }
    return current;
  } catch (e) {
    return id;
  }
}


/**
 * Schedules or executes atomic, observable disk cache persistence
 */
function scheduleCachePersistence(indexPackage, p, cacheKey, options = {}) {
  // If already persisting this exact sourceHash, return existing in-flight promise
  const existing = _persistenceStateByRoot.get(cacheKey);
  if (existing && existing.status === 'persisting' && existing.sourceHash === indexPackage.sourceHash && existing.promise) {
    return existing.promise;
  }

  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const state = {
    status: 'persisting',
    sourceHash: indexPackage.sourceHash,
    lastPersistedAt: null,
    filePath: p.cacheIndexFile,
    error: null,
    promise,
    stats: null
  };
  _persistenceStateByRoot.set(cacheKey, state);

  const executePersistence = async () => {
    const dir = p.cacheDir;
    const randSuffix = Math.random().toString(36).slice(2, 7);
    const tmpFile = path.join(dir, `retrieval-index.tmp.${process.pid}.${Date.now()}.${randSuffix}`);

    try {
      // Step B: JSON Serialization
      const tSerStart = performance.now();
      const serialized = JSON.stringify(indexPackage);
      const serializationMs = performance.now() - tSerStart;
      const payloadSizeBytes = Buffer.byteLength(serialized, 'utf-8');

      // Step C: Disk Persistence to temporary file
      const tDiskStart = performance.now();
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(tmpFile, serialized, 'utf-8');

      // Atomic rename/replace to final destination
      try {
        await fs.promises.rename(tmpFile, p.cacheIndexFile);
      } catch (renameErr) {
        // Fallback for Windows file locks or cross-drive quirks
        if (fs.existsSync(p.cacheIndexFile)) {
          try { fs.unlinkSync(p.cacheIndexFile); } catch (uErr) {}
        }
        try {
          await fs.promises.rename(tmpFile, p.cacheIndexFile);
        } catch (r2Err) {
          try {
            await fs.promises.copyFile(tmpFile, p.cacheIndexFile);
            try { await fs.promises.unlink(tmpFile); } catch (u2Err) {}
          } catch (cErr) {
            await new Promise(res => setTimeout(res, 50));
            try {
              await fs.promises.copyFile(tmpFile, p.cacheIndexFile);
              try { await fs.promises.unlink(tmpFile); } catch (u3Err) {}
            } catch (c2Err) {}
          }
        }
      }
      const diskWriteMs = performance.now() - tDiskStart;
      const totalReadinessMs = indexPackage.buildDurationMs + serializationMs + diskWriteMs;

      const completionStats = {
        computationMs: indexPackage.buildDurationMs,
        serializationMs: Math.round(serializationMs * 100) / 100,
        diskWriteMs: Math.round(diskWriteMs * 100) / 100,
        totalReadinessMs: Math.round(totalReadinessMs * 100) / 100,
        payloadSizeBytes
      };

      state.status = 'persisted';
      state.lastPersistedAt = new Date().toISOString();
      state.stats = completionStats;
      state.promise = null;

      const result = {
        success: true,
        filePath: p.cacheIndexFile,
        persistedAt: state.lastPersistedAt,
        stats: completionStats
      };

      resolvePromise(result);
      return result;
    } catch (err) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch (cleanErr) {}

      state.status = 'failed';
      state.error = err;
      state.promise = null;

      rejectPromise(err);
      throw err;
    }
  };

  // Synchronous execution mode when explicitly requested
  if (options.sync === true || options.syncPersist === true) {
    const dir = p.cacheDir;
    const randSuffix = Math.random().toString(36).slice(2, 7);
    const tmpFile = path.join(dir, `retrieval-index.tmp.${process.pid}.${Date.now()}.${randSuffix}`);
    try {
      const tSerStart = performance.now();
      const serialized = JSON.stringify(indexPackage);
      const serializationMs = performance.now() - tSerStart;
      const payloadSizeBytes = Buffer.byteLength(serialized, 'utf-8');

      const tDiskStart = performance.now();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmpFile, serialized, 'utf-8');

      try {
        fs.renameSync(tmpFile, p.cacheIndexFile);
      } catch (renameErr) {
        if (fs.existsSync(p.cacheIndexFile)) {
          try { fs.unlinkSync(p.cacheIndexFile); } catch (uErr) {}
        }
        try {
          fs.renameSync(tmpFile, p.cacheIndexFile);
        } catch (r2Err) {
          try {
            fs.copyFileSync(tmpFile, p.cacheIndexFile);
            try { fs.unlinkSync(tmpFile); } catch (u2Err) {}
          } catch (cErr) {}
        }
      }
      const diskWriteMs = performance.now() - tDiskStart;
      const totalReadinessMs = indexPackage.buildDurationMs + serializationMs + diskWriteMs;

      const completionStats = {
        computationMs: indexPackage.buildDurationMs,
        serializationMs: Math.round(serializationMs * 100) / 100,
        diskWriteMs: Math.round(diskWriteMs * 100) / 100,
        totalReadinessMs: Math.round(totalReadinessMs * 100) / 100,
        payloadSizeBytes
      };

      state.status = 'persisted';
      state.lastPersistedAt = new Date().toISOString();
      state.stats = completionStats;
      state.promise = null;

      resolvePromise({
        success: true,
        filePath: p.cacheIndexFile,
        persistedAt: state.lastPersistedAt,
        stats: completionStats
      });
      return promise;
    } catch (err) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch (cleanErr) {}

      state.status = 'failed';
      state.error = err;
      state.promise = null;

      rejectPromise(err);
      throw err;
    }
  }

  // Non-blocking async persistence scheduled via setImmediate
  setImmediate(() => {
    executePersistence().catch(() => {});
  });

  return promise;
}

/**
 * Returns observable cache persistence status and timing metrics
 */
export function getCachePersistenceStatus(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  const cacheKey = customRoot || 'DEFAULT';
  const state = _persistenceStateByRoot.get(cacheKey);

  if (state) {
    return {
      status: state.status,
      sourceHash: state.sourceHash,
      lastPersistedAt: state.lastPersistedAt,
      filePath: state.filePath,
      error: state.error ? state.error.message : null,
      stats: state.stats ? { ...state.stats } : null
    };
  }

  // If no in-flight state, probe disk cache existence
  if (fs.existsSync(p.cacheIndexFile)) {
    try {
      const stat = fs.statSync(p.cacheIndexFile);
      return {
        status: 'persisted',
        sourceHash: null,
        lastPersistedAt: stat.mtime.toISOString(),
        filePath: p.cacheIndexFile,
        error: null,
        stats: {
          payloadSizeBytes: stat.size
        }
      };
    } catch (e) {}
  }

  return {
    status: 'idle',
    sourceHash: null,
    lastPersistedAt: null,
    filePath: p.cacheIndexFile,
    error: null,
    stats: null
  };
}

/**
 * Waits for active cache persistence to complete safely
 */
export async function waitForCachePersistence(customRoot = null, timeoutMs = 15000) {
  const p = getRetrievalPaths(customRoot);
  const cacheKey = customRoot || 'DEFAULT';
  const state = _persistenceStateByRoot.get(cacheKey);

  if (!state || state.status === 'idle') {
    if (fs.existsSync(p.cacheIndexFile)) {
      return { success: true, filePath: p.cacheIndexFile, status: 'persisted' };
    }
    return { success: true, filePath: p.cacheIndexFile, status: 'idle' };
  }

  if (state.status === 'persisted') {
    return {
      success: true,
      filePath: p.cacheIndexFile,
      persistedAt: state.lastPersistedAt,
      stats: state.stats
    };
  }

  if (state.status === 'failed') {
    throw state.error || new Error('Cache persistence failed');
  }

  if (state.promise) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Cache persistence timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([state.promise, timeoutPromise]);
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  return { success: true, filePath: p.cacheIndexFile, status: state.status };
}

/**
 * Builds the complete BM25 & Lexical Inverted Index
 */
export function buildSearchIndex(forceRebuild = false, customRoot = null, options = {}) {
  // Support options object as 2nd argument: buildSearchIndex(forceRebuild, options)
  let resolvedRoot = customRoot;
  let resolvedOpts = options;
  if (customRoot && typeof customRoot === 'object' && !Array.isArray(customRoot)) {
    resolvedOpts = customRoot;
    resolvedRoot = resolvedOpts.brainRoot || null;
  }

  const p = getRetrievalPaths(resolvedRoot);
  const cacheKey = resolvedRoot || 'DEFAULT';
  const currentHash = computeSourceFilesHash(resolvedRoot);

  const rootMemory = _indexCacheByRoot.get(cacheKey);
  if (!forceRebuild && rootMemory && rootMemory.sourceHash === currentHash) {
    return rootMemory;
  }

  // Check persistent disk cache if valid
  if (!forceRebuild && fs.existsSync(p.cacheIndexFile)) {
    try {
      const raw = fs.readFileSync(p.cacheIndexFile, 'utf-8');
      const cached = JSON.parse(raw);
      if (cached && cached.sourceHash === currentHash && Array.isArray(cached.documents) && cached.invertedIndex) {
        _indexCacheByRoot.set(cacheKey, cached);
        if (!resolvedRoot) {
          _inMemoryIndex = cached;
          _inMemoryHash = currentHash;
        }
        return cached;
      }
    } catch (e) {
      // Incomplete or corrupted cache on disk: quarantine to allow clean self-healing
      try {
        const corruptBackup = `${p.cacheIndexFile}.corrupt.${Date.now()}`;
        fs.renameSync(p.cacheIndexFile, corruptBackup);
      } catch (rmErr) {}
      // Fall through to rebuild
    }
  }

  const startTime = Date.now();
  const patternDocs = parseEngineeringPatterns(resolvedRoot);
  const coreDocs = parseCoreOperatingRules(resolvedRoot);
  const skillDocs = parseSkills(resolvedRoot);
  const indexDocs = parseKnowledgeIndex(p);

  const capabilityDocs = parseCapabilities(resolvedRoot);
  const documents = [...patternDocs, ...coreDocs, ...skillDocs, ...indexDocs, ...capabilityDocs];
  const N = documents.length;

  let totalDocLength = 0;
  const invertedIndex = Object.create(null); // term -> [{ docIdx, freq }]
  const docMetadata = [];

  for (let i = 0; i < N; i++) {
    const doc = documents[i];
    const docLen = doc.tokens.length;
    totalDocLength += docLen;

    const termFreqs = Object.create(null);
    for (const term of doc.tokens) {
      termFreqs[term] = (termFreqs[term] || 0) + 1;
    }

    for (const term of Object.keys(termFreqs)) {
      const freq = termFreqs[term];
      if (!invertedIndex[term]) invertedIndex[term] = [];
      invertedIndex[term].push({ docIdx: i, freq });
    }

    const resolvedRuleNum = doc.ruleNumber ?? (typeof doc.id === 'string' && doc.id.startsWith('Rule ') ? parseInt(doc.id.replace('Rule ', ''), 10) : null);
    docMetadata.push({
      id: doc.id,
      ruleNumber: resolvedRuleNum,
      rule_number: resolvedRuleNum,
      title: doc.title,
      category: doc.category,
      filePath: doc.filePath,
      lineRange: doc.lineRange,
      summary: doc.summary,
      ruleText: doc.ruleText || '',
      whyText: doc.whyText || '',
      whenText: doc.whenText || '',
      fullContent: doc.fullContent,
      docLength: docLen
    });
  }

  const avgdl = N > 0 ? totalDocLength / N : 1;

  // Compute BM25 IDF for each term: IDF = ln(1 + (N - df + 0.5) / (df + 0.5))
  const idf = Object.create(null);
  for (const term of Object.keys(invertedIndex)) {
    const postings = invertedIndex[term];
    const df = postings.length;
    idf[term] = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  const indexPackage = {
    sourceHash: currentHash,
    builtAt: new Date().toISOString(),
    buildDurationMs: Date.now() - startTime,
    totalDocuments: N,
    avgdl,
    invertedIndex,
    idf,
    documents: docMetadata
  };

  _indexCacheByRoot.set(cacheKey, indexPackage);
  if (!resolvedRoot) {
    _inMemoryIndex = indexPackage;
    _inMemoryHash = currentHash;
  }

  // Schedule atomic, observable persistence to disk
  const persistencePromise = scheduleCachePersistence(indexPackage, p, cacheKey, resolvedOpts);
  indexPackage.persistencePromise = persistencePromise;

  return indexPackage;
}

/**
 * Searches the Knowledge Base using BM25 + Field Weighting
 * 
 * @param {string} query - Natural language search phrase or keywords
 * @param {object} options - Search configuration
 * @returns {Array<object>} Ranked results with scores
 */
export function searchBrain(query, options = {}) {
  const startTime = Date.now();
  const customRoot = options.brainRoot || null;
  const index = buildSearchIndex(options.forceRebuild || false, customRoot);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return {
      query,
      results: [],
      totalDocuments: index.totalDocuments,
      durationMs: Date.now() - startTime
    };
  }

  const k1 = 1.5;
  const b = 0.75;
  const scores = new Float64Array(index.totalDocuments);
  const matchDetails = Array.from({ length: index.totalDocuments }, () => []);

  // Check for specific rule number intent (e.g. "Rule 15", "15", "rule24")
  const ruleNumMatch = query.match(/(?:rule\s*|#)(\d+)/i);
  const targetRuleNum = ruleNumMatch ? parseInt(ruleNumMatch[1], 10) : null;

  for (const term of queryTokens) {
    const postings = index.invertedIndex[term];
    if (!postings) continue;

    const termIdf = index.idf[term] || 0.1;

    for (const posting of postings) {
      const docIdx = posting.docIdx;
      const freq = posting.freq;
      const doc = index.documents[docIdx];
      const docLen = doc.docLength;

      // BM25 standard formula
      const numerator = freq * (k1 + 1);
      const denominator = freq + k1 * (1 - b + b * (docLen / index.avgdl));
      let termScore = termIdf * (numerator / denominator);

      // Title Boost: 3.5x multiplier
      const titleLower = doc.title.toLowerCase();
      if (titleLower.includes(term)) {
        termScore *= 3.5;
      }

      // Exact Rule Number Boost: 50.0 boost
      if (targetRuleNum !== null && (doc.id === `Rule ${targetRuleNum}` || doc.id === `Core Rule ${targetRuleNum}`)) {
        termScore += 50.0;
      }

      scores[docIdx] += termScore;
      matchDetails[docIdx].push({ term, termScore });
    }
  }

  // Filter category if specified
  const filteredIndices = [];
  for (let i = 0; i < index.totalDocuments; i++) {
    if (scores[i] > 0) {
      if (!options.category || index.documents[i].category === options.category) {
        filteredIndices.push(i);
      }
    }
  }

  // Sort descending by score
  filteredIndices.sort((a, b) => scores[b] - scores[a]);

  const topK = options.topK || 5;
  const sliced = filteredIndices.slice(0, topK);

  const results = sliced.map(docIdx => {
    const doc = index.documents[docIdx];
    return {
      id: doc.id,
      ruleNumber: doc.ruleNumber ?? null,
      rule_number: doc.ruleNumber ?? null,
      title: doc.title,
      category: doc.category,
      score: parseFloat(scores[docIdx].toFixed(4)),
      filePath: doc.filePath,
      lineRange: doc.lineRange,
      summary: doc.summary,
      ruleText: doc.ruleText,
      whyText: doc.whyText,
      whenText: doc.whenText,
      fullContent: doc.fullContent,
      matchedTerms: matchDetails[docIdx].map(m => m.term)
    };
  });

  return {
    query,
    results,
    totalDocuments: index.totalDocuments,
    matchedCount: filteredIndices.length,
    durationMs: Date.now() - startTime
  };
}

/**
 * Universal Token-Budgeted Knowledge Retrieval
 * Guarantees zero context bloat by packing top results strictly within maxTokens.
 * 
 * @param {string} query - Query string
 * @param {object} options - { maxTokens: 1200, topK: 3, format: 'compact' | 'full' | 'json' }
 * @returns {object} Token-budgeted context package
 */
export function retrieveKnowledge(query, options = {}) {
  const maxTokens = options.maxTokens || 1200;
  const topK = options.topK || 3;
  const format = options.format || 'compact';

  const searchOutput = searchBrain(query, { topK, category: options.category, brainRoot: options.brainRoot || null });
  const rawResults = searchOutput.results;

  let currentTokens = 0;
  const budgetedResults = [];
  const packedEntries = [];

  for (const item of rawResults) {
    let contentToPack = '';

    if (format === 'compact') {
      contentToPack = `### [${item.id}] ${item.title}\n` +
        `*File*: [${item.filePath}](file:///c:/AI-Builder-Brain/${item.filePath}#L${item.lineRange[0]}-L${item.lineRange[1]})\n` +
        (item.ruleText ? `**RULE**: ${item.ruleText}\n` : `**SUMMARY**: ${item.summary}\n`) +
        (item.whyText ? `**WHY**: ${item.whyText}\n` : '') +
        (item.whenText ? `**WHEN TO APPLY**: ${item.whenText}\n` : '');
    } else {
      contentToPack = item.fullContent;
    }

    // Token estimation (~4 characters per token)
    const itemTokens = Math.ceil(contentToPack.length / 4);

    if (currentTokens + itemTokens <= maxTokens) {
      currentTokens += itemTokens;
      budgetedResults.push(item);
      packedEntries.push(contentToPack);
    } else if (budgetedResults.length === 0) {
      // If even the first item is larger than budget, truncate it to fit budget
      const maxChars = maxTokens * 4;
      const truncated = contentToPack.slice(0, maxChars - 100) + '\n\n... [Content Truncated by Token Budgeter]';
      currentTokens = maxTokens;
      budgetedResults.push(item);
      packedEntries.push(truncated);
      break;
    } else {
      // Budget limit reached, cannot pack more items
      break;
    }
  }

  const promptBlock = packedEntries.length > 0
    ? `\n<!-- === AI-BUILDER-BRAIN RETRIEVED INTELLIGENCE (${budgetedResults.length} ITEMS | ~${currentTokens} TOKENS) === -->\n` +
      packedEntries.join('\n\n---\n\n') +
      `\n<!-- === END RETRIEVED INTELLIGENCE === -->\n`
    : '';

  return {
    query,
    durationMs: searchOutput.durationMs,
    totalIndexed: searchOutput.totalDocuments,
    returnedCount: budgetedResults.length,
    estimatedTokens: currentTokens,
    maxTokensBudget: maxTokens,
    promptBlock,
    items: budgetedResults.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      score: r.score,
      filePath: r.filePath,
      lineRange: r.lineRange,
      summary: r.summary
    }))
  };
}

// CLI Execution Helper
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const query = process.argv[2] || 'CRLF regex line endings Windows';
  const tokensArg = process.argv.indexOf('--tokens');
  const maxTokens = tokensArg !== -1 && process.argv[tokensArg + 1] ? parseInt(process.argv[tokensArg + 1], 10) : 1200;

  console.log(`\n🔍 Searching AI-Builder-Brain for: "${query}" (Budget: ${maxTokens} tokens)...\n`);
  const result = retrieveKnowledge(query, { maxTokens, topK: 3 });
  console.log(`⚡ Retreival complete in ${result.durationMs}ms`);
  console.log(`📚 Indexed: ${result.totalIndexed} docs | Retrieved: ${result.returnedCount} items | Estimated Tokens: ${result.estimatedTokens}/${result.maxTokensBudget}\n`);
  console.log(result.promptBlock);
}
