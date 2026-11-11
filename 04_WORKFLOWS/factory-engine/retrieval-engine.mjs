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
import { INTELLIGENCE_DOMAINS, resolveDomain } from './domain-intelligence-engine.mjs';
import { getExpandedContextForRecords } from './knowledge-relationship-graph.mjs';

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
    cacheIndexFile: path.join(root, '.project-brain', 'cache', 'retrieval-index.json'),
    domainRegistryFile: path.join(root, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json')
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

// Generic dossier template headings that repeat across project dossiers
export const TEMPLATE_HEADING_REGEX = /^(##?\s*\d+\.\s*(Context|Multi-Dimensional|Empirical|Promotion|Forensic|Candidate|Net-New|8-Axis)|(###?\s*)?D\d+:|(###?\s*)?Incident Patches?$|(###?\s*)?Core Architecture$|\d+\.\s*(Context|Multi-Dimensional|Empirical|Promotion|Forensic|Candidate|Net-New|8-Axis)|Multi-Dimensional 8-Axis Investigation)/i;

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

// Precomputed token keyword sets for ultra-fast domain classification (<1ms)
const _domainKeywordSets = Object.entries(INTELLIGENCE_DOMAINS).map(([l, d]) => ({
  letter: l,
  id: d.id,
  name: d.name,
  keywords: new Set((d.keywords || []).map(k => k.toLowerCase()))
}));

/**
 * Fast in-memory token-based domain classifier for indexing and cache normalization.
 */
export function fastClassifyDomain(text, defaultLetter = 'H') {
  if (!text || typeof text !== 'string') {
    const d = INTELLIGENCE_DOMAINS[defaultLetter] || INTELLIGENCE_DOMAINS['H'];
    return { letter: d.letter, id: d.id, name: d.name };
  }
  const tokens = tokenize(text);
  let bestDomain = null;
  let maxScore = 0;
  for (const d of _domainKeywordSets) {
    let score = 0;
    for (const t of tokens) {
      if (d.keywords.has(t)) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      bestDomain = d;
    }
  }
  if (bestDomain && maxScore > 0) {
    return { letter: bestDomain.letter, id: bestDomain.id, name: bestDomain.name };
  }
  const fallback = INTELLIGENCE_DOMAINS[defaultLetter] || INTELLIGENCE_DOMAINS['H'];
  return { letter: fallback.letter, id: fallback.id, name: fallback.name };
}

// Dossier Directory Hash Cache to avoid redundant file stats during in-process query bursts
let _cachedDossierHash = null;
let _lastDossierHashCheck = 0;
const DOSSIER_HASH_TTL_MS = 1000;

export function computeDossierDirHash(learningDir, forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && _cachedDossierHash && (now - _lastDossierHashCheck < DOSSIER_HASH_TTL_MS)) {
    return _cachedDossierHash;
  }
  if (!learningDir || !fs.existsSync(learningDir)) return 'missing';

  const hash = crypto.createHash('sha256');
  try {
    const files = fs.readdirSync(learningDir);
    let maxMtime = 0;
    let totalSize = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.endsWith('.md') && !f.startsWith('.')) {
        const fullPath = path.join(learningDir, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
        totalSize += stat.size;
        hash.update(`${f}:${stat.mtimeMs}:${stat.size};`);
      }
    }
    hash.update(`count:${files.length};maxMtime:${maxMtime};totalSize:${totalSize}`);
  } catch (e) {
    hash.update('error');
  }

  _cachedDossierHash = hash.digest('hex');
  _lastDossierHashCheck = now;
  return _cachedDossierHash;
}

/**
 * Calculates deterministic SHA-256 hash of source files to determine cache staleness
 */
export function computeSourceFilesHash(customRoot = null, forceFresh = false) {
  const p = getRetrievalPaths(customRoot);
  const hash = crypto.createHash('sha256');
  hash.update('v2.1.0-pac004-complete-indexing');
  if (fs.existsSync(p.patternsFile)) {
    const s = fs.statSync(p.patternsFile);
    hash.update(`${s.mtimeMs}:${s.size}`);
  }
  if (fs.existsSync(p.coreRulesFile)) {
    const s = fs.statSync(p.coreRulesFile);
    hash.update(`${s.mtimeMs}:${s.size}`);
  }
  if (fs.existsSync(p.knowledgeIndexFile)) {
    const s = fs.statSync(p.knowledgeIndexFile);
    hash.update(`${s.mtimeMs}:${s.size}`);
  }
  if (p.capabilityRegistryFile && fs.existsSync(p.capabilityRegistryFile)) {
    const s = fs.statSync(p.capabilityRegistryFile);
    hash.update(`${s.mtimeMs}:${s.size}`);
  }
  if (p.domainRegistryFile && fs.existsSync(p.domainRegistryFile)) {
    const s = fs.statSync(p.domainRegistryFile);
    hash.update(`${s.mtimeMs}:${s.size}`);
  }
  if (p.learningDir && fs.existsSync(p.learningDir)) {
    hash.update(computeDossierDirHash(p.learningDir, forceFresh));
  }
  if (fs.existsSync(p.skillsDir)) {
    try {
      const skills = fs.readdirSync(p.skillsDir).filter(f => f.endsWith('.md'));
      for (const f of skills) {
        const s = fs.statSync(path.join(p.skillsDir, f));
        hash.update(`${f}:${s.mtimeMs}:${s.size}`);
      }
    } catch (e) { }
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
          const resolvedDom = fastClassifyDomain(`${currentRule.title} ${ruleText} ${whyText}`, 'H');
          docs.push({
            id: currentRule.id,
            ruleNumber: currentRule.ruleNumber,
            title: currentRule.title,
            category: 'ENGINEERING_PATTERN',
            domainLetter: resolvedDom.letter,
            domainId: resolvedDom.id,
            domainName: resolvedDom.name,
            filePath: '05_KNOWLEDGE/engineering-patterns.md',
            lineRange: [startLine, i],
            ruleText,
            whyText,
            whenText,
            summary,
            fullContent: `## ${currentRule.ruleNumber}. ${currentRule.title}\n\n${rawBody.trim()}`,
            tokens: tokenize(`${currentRule.title} ${currentRule.id} ${ruleText} ${whyText} ${whenText} ${resolvedDom.name}`)
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
    const resolvedDom = fastClassifyDomain(`${currentRule.title} ${ruleText} ${whyText}`, 'H');
    docs.push({
      id: currentRule.id,
      ruleNumber: currentRule.ruleNumber,
      title: currentRule.title,
      category: 'ENGINEERING_PATTERN',
      domainLetter: resolvedDom.letter,
      domainId: resolvedDom.id,
      domainName: resolvedDom.name,
      filePath: '05_KNOWLEDGE/engineering-patterns.md',
      lineRange: [startLine, lines.length],
      ruleText,
      whyText,
      whenText,
      summary,
      fullContent: `## ${currentRule.ruleNumber}. ${currentRule.title}\n\n${rawBody.trim()}`,
      tokens: tokenize(`${currentRule.title} ${currentRule.id} ${ruleText} ${whyText} ${whenText} ${resolvedDom.name}`)
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
  const resolvedDom = fastClassifyDomain(`${meta.title} ${rawBody}`, 'G');
  return {
    id: meta.id,
    ruleNumber: meta.ruleNumber,
    title: meta.title,
    category: 'CORE_OPERATING_RULE',
    domainLetter: resolvedDom.letter,
    domainId: resolvedDom.id,
    domainName: resolvedDom.name,
    filePath: '01_CORE/operating-rules.md',
    lineRange: [startLine, endLine],
    ruleText: rawBody.trim(),
    summary,
    fullContent: `## Rule ${meta.ruleNumber} — ${meta.title}\n\n${rawBody.trim()}`,
    tokens: tokenize(`${meta.title} ${meta.id} ${rawBody} ${resolvedDom.name}`)
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
    const resolvedDom = fastClassifyDomain(`${title} ${summary}`, 'H');

    docs.push({
      id: `Skill: ${f.replace('.md', '')}`,
      title,
      category: 'SKILL',
      domainLetter: resolvedDom.letter,
      domainId: resolvedDom.id,
      domainName: resolvedDom.name,
      filePath: `03_SKILLS/${f}`,
      lineRange: [1, content.split(/\r?\n/).length],
      summary,
      fullContent: content.trim(),
      tokens: tokenize(`${title} ${f} ${content} ${resolvedDom.name}`)
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
    } catch (e) { }
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
    } catch (e) { }
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
    } catch (err) { }
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
    } catch (e) { }
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
      const resolvedDom = resolveDomain(c.domain) || fastClassifyDomain(`${c.name} ${c.purpose}`);
      docs.push({
        id: c.id,
        title: `${c.id}: ${c.name}`,
        category: 'CAPABILITY',
        domainLetter: resolvedDom.letter,
        domainId: resolvedDom.id,
        domainName: resolvedDom.name,
        filePath: '15_METADATA/capability-registry.json',
        lineRange: [1, 100],
        summary,
        fullContent,
        tokens: tokenize(`${c.id} ${c.name} ${c.domain} ${c.purpose} ${(c.scope?.inScope || []).join(' ')} ${c.status} capability ${resolvedDom.name}`)
      });
    }
    return docs;
  } catch (e) {
    return [];
  }
}

/**
 * Parses 05_KNOWLEDGE/domain-intelligence/domain-registry.json into discrete domain documents
 */
export function parseDomainIntelligenceRecords(customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  if (!p.domainRegistryFile || !fs.existsSync(p.domainRegistryFile)) return [];
  try {
    const raw = fs.readFileSync(p.domainRegistryFile, 'utf-8');
    const data = JSON.parse(raw);
    const records = Object.values(data.records || {});
    return records.map(r => ({
      id: r.record_id,
      title: r.title,
      category: 'DOMAIN_INTELLIGENCE',
      domainLetter: r.domain_letter,
      domainId: r.domain_id,
      domainName: r.domain_name,
      secondaryDomains: (r.secondary_domains || []).map(d => d.letter),
      filePath: '05_KNOWLEDGE/domain-intelligence/domain-registry.json',
      lineRange: [1, 100],
      summary: r.summary,
      fullContent: `## ${r.record_id} [Domain ${r.domain_letter}: ${r.domain_name}] — ${r.title}\n\n${r.content}\n\n- Provenance: ${r.provenance?.source_uri || 'internal'}\n- Evidence: ${r.evidence?.evidence_type || 'EMPIRICAL'} (${r.evidence?.verification_status || 'VERIFIED'})`,
      tokens: tokenize(`${r.title} ${r.domain_letter} ${r.domain_id} ${r.domain_name} ${r.summary} ${r.content} domain intelligence`)
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Extracts a concise, evidence-grounded excerpt surrounding matched search terms
 */
export function extractEvidenceExcerpt(text, matchedTerms = [], maxLen = 220) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!matchedTerms || matchedTerms.length === 0) {
    return clean.slice(0, maxLen);
  }
  const lower = clean.toLowerCase();
  let firstPos = -1;
  for (const t of matchedTerms) {
    const pos = lower.indexOf(t.toLowerCase());
    if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
      firstPos = pos;
    }
  }
  if (firstPos === -1) {
    return clean.slice(0, maxLen);
  }
  const start = Math.max(0, firstPos - 40);
  const end = Math.min(clean.length, start + maxLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

/**
 * Extracts substantive markdown sections/chunks from a single dossier file.
 * Preserves 1-based startLine and endLine for exact source location.
 * Sub-chunks long sections sequentially to guarantee zero silent content truncation.
 */
export function extractDossierChunksFromFile(filePath, options = {}) {
  const maxChunkChars = options.maxChunkChars || 2500;
  const maxChunksPerFile = options.maxChunksPerFile || 60;
  if (!filePath || !fs.existsSync(filePath)) return [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const rawSections = [];
  let currentSection = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    const isHeading = !inCodeBlock && /^#{2,3}\s+/.test(line);

    if (isHeading) {
      if (currentSection && currentSection.lines.length > 0) {
        currentSection.endLine = i; // 1-based index of preceding line
        rawSections.push(currentSection);
      }
      const title = line.replace(/^#{2,3}\s+/, '').trim();
      currentSection = {
        title,
        headingLine: line,
        startLine: i + 1,
        endLine: i + 1,
        lines: [line]
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
      currentSection.endLine = i + 1;
    }
  }

  if (currentSection && currentSection.lines.length > 0) {
    rawSections.push(currentSection);
  }

  const chunks = [];
  let isTruncated = false;

  for (const sec of rawSections) {
    const fullSectionText = sec.lines.join('\n').trim();
    if (fullSectionText.length < 30) continue; // skip trivial empty headings

    if (fullSectionText.length <= maxChunkChars) {
      chunks.push({
        title: sec.title,
        startLine: sec.startLine,
        endLine: sec.endLine,
        text: fullSectionText,
        part: 1,
        totalParts: 1
      });
      if (chunks.length >= maxChunksPerFile) {
        isTruncated = true;
        break;
      }
    } else {
      // Long section: split into sequential sub-chunks with exact line boundaries
      let subChunkLines = [];
      let subChunkChars = 0;
      let subStartLine = sec.startLine;
      const subChunksForSec = [];

      for (let j = 0; j < sec.lines.length; j++) {
        const l = sec.lines[j];
        const currentLineNum = sec.startLine + j;
        subChunkLines.push(l);
        subChunkChars += l.length + 1;

        if (subChunkChars >= maxChunkChars || j === sec.lines.length - 1) {
          const subText = subChunkLines.join('\n').trim();
          if (subText.length > 30) {
            subChunksForSec.push({
              title: sec.title,
              startLine: subStartLine,
              endLine: currentLineNum,
              text: subText
            });
          }
          subChunkLines = [];
          subChunkChars = 0;
          subStartLine = currentLineNum + 1;
        }
      }

      const totalParts = subChunksForSec.length;
      for (let pIdx = 0; pIdx < totalParts; pIdx++) {
        const sc = subChunksForSec[pIdx];
        chunks.push({
          title: totalParts > 1 ? `${sc.title} (Part ${pIdx + 1}/${totalParts})` : sc.title,
          startLine: sc.startLine,
          endLine: sc.endLine,
          text: sc.text,
          part: pIdx + 1,
          totalParts
        });
        if (chunks.length >= maxChunksPerFile) {
          isTruncated = true;
          break;
        }
      }
      if (chunks.length >= maxChunksPerFile) {
        isTruncated = true;
        break;
      }
    }
  }

  const fileIndexingStatus = isTruncated ? 'PARTIAL' : 'COMPLETE';
  for (const chunk of chunks) {
    chunk.indexingStatus = fileIndexingStatus;
    chunk.rawHeading = chunk.title;
  }
  chunks.indexingStatus = fileIndexingStatus;
  return chunks;
}

/**
 * Parses dossiers in 07_PROJECT_LEARNING into searchable chunk documents
 * with text-hash deduplication, occurrence tracking, and corroboration verification.
 */
export function parseDossierChunks(customPathsOrRoot = null, options = {}) {
  const paths = (typeof customPathsOrRoot === 'string' || !customPathsOrRoot)
    ? getRetrievalPaths(customPathsOrRoot)
    : customPathsOrRoot;
  const learningDir = paths.learningDir || path.join(paths.brainRoot, '07_PROJECT_LEARNING');
  if (!fs.existsSync(learningDir)) return [];

  let files = [];
  try {
    files = fs.readdirSync(learningDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
  } catch (e) {
    return [];
  }

  const seenHashes = new Map();
  const docs = [];

  const maxChunksPerFile = options.maxChunksPerFile || 60;
  const maxChunkChars = options.maxChunkChars || 2500;

  for (const f of files) {
    const fullPath = path.join(learningDir, f);
    const relPath = `07_PROJECT_LEARNING/${f}`;
    const slug = f.replace(/-learnings\.md$/, '').replace(/\.md$/, '');
    const fileChunks = extractDossierChunksFromFile(fullPath, {
      maxChunksPerFile,
      maxChunkChars
    });

    for (const c of fileChunks) {
      const cleanBody = c.text.trim();
      if (cleanBody.length < 35) continue;

      const chunkHash = crypto.createHash('sha256').update(cleanBody).digest('hex').slice(0, 16);

      if (seenHashes.has(chunkHash)) {
        const existing = seenHashes.get(chunkHash);
        // Record exact occurrence with file and lineRange
        existing.sourceOccurrences.push({
          filePath: relPath,
          lineRange: [c.startLine, c.endLine]
        });
        if (!existing.corroborationSources.includes(f)) {
          existing.corroborationSources.push(f);
        }
        existing.occurrenceCount = existing.sourceOccurrences.length;
        if (c.indexingStatus === 'PARTIAL' || fileChunks.indexingStatus === 'PARTIAL') {
          existing.indexingStatus = 'PARTIAL';
        }
        continue;
      }

      const chunkId = `DossierChunk: ${slug}#L${c.startLine}-L${c.endLine}`;
      const title = `${slug} — ${c.title}`;
      const summary = cleanBody.slice(0, 300).replace(/\s+/g, ' ');

      const doc = {
        id: chunkId,
        slug,
        title,
        headingTitle: c.title,
        rawHeading: c.title,
        category: 'HARVESTED_DOSSIER_CHUNK',
        sourceTier: 'FORENSIC_DOSSIER',
        epistemicState: 'EXTRACTED',
        confidence: 0.75,
        confidenceCalibrated: false,
        confidenceType: 'HEURISTIC_CATEGORY_WEIGHT',
        filePath: relPath,
        lineRange: [c.startLine, c.endLine],
        summary,
        fullContent: cleanBody,
        sourceOccurrences: [{ filePath: relPath, lineRange: [c.startLine, c.endLine] }],
        occurrenceCount: 1,
        corroborationSources: [f],
        isBoilerplate: false,
        isIndependentCorroboration: false,
        independentCorroborationCount: 0,
        sourceIndependence: 'SINGLE_SOURCE',
        indexingStatus: c.indexingStatus || fileChunks.indexingStatus || 'UNKNOWN',
        tokens: tokenize(`${slug} ${c.title} ${cleanBody}`)
      };

      seenHashes.set(chunkHash, doc);
      docs.push(doc);
    }
  }

  // Evaluate Occurrence vs Independent Corroboration & Template Boilerplate
  for (const doc of docs) {
    const count = doc.occurrenceCount || doc.sourceOccurrences.length;
    doc.occurrenceCount = count;

    // Detect generic template boilerplate vs substantive technical claim
    // Inspect actual heading rather than slug-prefixed display title
    const headingToCheck = doc.rawHeading || doc.headingTitle || (doc.title ? doc.title.replace(/^[^—]+—\s*/, '').trim() : '');
    const isTemplateHeading = TEMPLATE_HEADING_REGEX.test(headingToCheck) || TEMPLATE_HEADING_REGEX.test(doc.title);
    const isRepetitiveOccurrences = count > 10;

    if (isTemplateHeading || isRepetitiveOccurrences) {
      doc.isBoilerplate = true;
      doc.isIndependentCorroboration = false;
      doc.independentCorroborationCount = 0;
      doc.sourceIndependence = 'BOILERPLATE';
    } else if (count > 1) {
      // Do not infer source independence from occurrence count alone
      // Represent as UNKNOWN independence rather than claiming independent corroboration
      doc.isBoilerplate = false;
      doc.isIndependentCorroboration = false;
      doc.independentCorroborationCount = 0;
      doc.sourceIndependence = 'UNKNOWN';
    } else {
      doc.isBoilerplate = false;
      doc.isIndependentCorroboration = false;
      doc.independentCorroborationCount = 0;
      doc.sourceIndependence = 'SINGLE_SOURCE';
    }
  }

  return docs;
}

/**
 * Grounded query expansion using the canonical 13-Domain taxonomy
 */
export function expandQueryWithTaxonomy(query, targetDomains = []) {
  const queryTokens = new Set(tokenize(query));
  const expansionTerms = [];
  const matchedDomainLetters = new Set();

  if (Array.isArray(targetDomains) && targetDomains.length > 0) {
    for (const d of targetDomains) {
      const letter = String(d).trim().toUpperCase().replace(/^DOMAIN[_-]/i, '');
      if (INTELLIGENCE_DOMAINS[letter]) {
        matchedDomainLetters.add(letter);
      }
    }
  }

  for (const [letter, domain] of Object.entries(INTELLIGENCE_DOMAINS)) {
    if (!domain || !Array.isArray(domain.keywords)) continue;
    for (const kw of domain.keywords) {
      if (queryTokens.has(kw)) {
        matchedDomainLetters.add(letter);
        break;
      }
    }
  }

  for (const letter of matchedDomainLetters) {
    const domain = INTELLIGENCE_DOMAINS[letter];
    if (!domain) continue;
    let addedForDomain = 0;
    for (const kw of domain.keywords) {
      if (!queryTokens.has(kw) && !expansionTerms.includes(kw)) {
        expansionTerms.push(kw);
        addedForDomain++;
        if (addedForDomain >= 2) break;
      }
    }
  }

  return {
    matchedDomains: Array.from(matchedDomainLetters),
    expansionTerms
  };
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
      const tDiskStart = performance.now();
      await fs.promises.mkdir(dir, { recursive: true });

      const ws = fs.createWriteStream(tmpFile, { encoding: 'utf-8' });
      const writeAsync = chunk => new Promise((res, rej) => {
        if (!ws.write(chunk)) ws.once('drain', res);
        else res();
      });

      await writeAsync('{\n');
      await writeAsync(`"sourceHash":${JSON.stringify(indexPackage.sourceHash)},\n`);
      await writeAsync(`"builtAt":${JSON.stringify(indexPackage.builtAt)},\n`);
      await writeAsync(`"buildDurationMs":${indexPackage.buildDurationMs},\n`);
      await writeAsync(`"totalDocuments":${indexPackage.totalDocuments},\n`);
      await writeAsync(`"avgdl":${indexPackage.avgdl},\n`);
      await writeAsync('"idf":' + JSON.stringify(indexPackage.idf) + ',\n');

      await writeAsync('"invertedIndex":{\n');
      const idxKeys = Object.keys(indexPackage.invertedIndex);
      for (let i = 0; i < idxKeys.length; i++) {
        const k = idxKeys[i];
        const comma = i === idxKeys.length - 1 ? '' : ',\n';
        await writeAsync(`${JSON.stringify(k)}:${JSON.stringify(indexPackage.invertedIndex[k])}${comma}`);
      }
      await writeAsync('\n},\n');

      await writeAsync('"documents":[\n');
      for (let i = 0; i < indexPackage.documents.length; i++) {
        const comma = i === indexPackage.documents.length - 1 ? '' : ',\n';
        await writeAsync(JSON.stringify(indexPackage.documents[i]) + comma);
      }
      await writeAsync('\n]\n}');

      await new Promise((res, rej) => {
        ws.end(res);
        ws.on('error', rej);
      });

      // Atomic rename/replace to final destination
      try {
        await fs.promises.rename(tmpFile, p.cacheIndexFile);
      } catch (renameErr) {
        if (fs.existsSync(p.cacheIndexFile)) {
          try { fs.unlinkSync(p.cacheIndexFile); } catch (uErr) { }
        }
        try {
          await fs.promises.rename(tmpFile, p.cacheIndexFile);
        } catch (r2Err) {
          try {
            await fs.promises.copyFile(tmpFile, p.cacheIndexFile);
            try { await fs.promises.unlink(tmpFile); } catch (u2Err) { }
          } catch (cErr) {
            await new Promise(res => setTimeout(res, 50));
            try {
              await fs.promises.copyFile(tmpFile, p.cacheIndexFile);
              try { await fs.promises.unlink(tmpFile); } catch (u3Err) { }
            } catch (c2Err) { }
          }
        }
      }
      const diskWriteMs = performance.now() - tDiskStart;
      const stat = fs.existsSync(p.cacheIndexFile) ? fs.statSync(p.cacheIndexFile) : { size: 0 };
      const payloadSizeBytes = stat.size;
      const totalReadinessMs = indexPackage.buildDurationMs + diskWriteMs;

      const completionStats = {
        computationMs: indexPackage.buildDurationMs,
        serializationMs: 0,
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
      } catch (cleanErr) { }

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
      const tDiskStart = performance.now();
      fs.mkdirSync(dir, { recursive: true });
      const fd = fs.openSync(tmpFile, 'w');
      fs.writeSync(fd, '{\n');
      fs.writeSync(fd, `"sourceHash":${JSON.stringify(indexPackage.sourceHash)},\n`);
      fs.writeSync(fd, `"builtAt":${JSON.stringify(indexPackage.builtAt)},\n`);
      fs.writeSync(fd, `"buildDurationMs":${indexPackage.buildDurationMs},\n`);
      fs.writeSync(fd, `"totalDocuments":${indexPackage.totalDocuments},\n`);
      fs.writeSync(fd, `"avgdl":${indexPackage.avgdl},\n`);
      fs.writeSync(fd, '"idf":' + JSON.stringify(indexPackage.idf) + ',\n');

      fs.writeSync(fd, '"invertedIndex":{\n');
      const idxKeys = Object.keys(indexPackage.invertedIndex);
      for (let i = 0; i < idxKeys.length; i++) {
        const k = idxKeys[i];
        const comma = i === idxKeys.length - 1 ? '' : ',\n';
        fs.writeSync(fd, `${JSON.stringify(k)}:${JSON.stringify(indexPackage.invertedIndex[k])}${comma}`);
      }
      fs.writeSync(fd, '\n},\n');

      fs.writeSync(fd, '"documents":[\n');
      for (let i = 0; i < indexPackage.documents.length; i++) {
        const comma = i === indexPackage.documents.length - 1 ? '' : ',\n';
        fs.writeSync(fd, JSON.stringify(indexPackage.documents[i]) + comma);
      }
      fs.writeSync(fd, '\n]\n}');
      fs.closeSync(fd);

      try {
        fs.renameSync(tmpFile, p.cacheIndexFile);
      } catch (renameErr) {
        if (fs.existsSync(p.cacheIndexFile)) {
          try { fs.unlinkSync(p.cacheIndexFile); } catch (uErr) { }
        }
        try {
          fs.renameSync(tmpFile, p.cacheIndexFile);
        } catch (r2Err) {
          try {
            fs.copyFileSync(tmpFile, p.cacheIndexFile);
            try { fs.unlinkSync(tmpFile); } catch (u2Err) { }
          } catch (cErr) { }
        }
      }
      const diskWriteMs = performance.now() - tDiskStart;
      const stat = fs.existsSync(p.cacheIndexFile) ? fs.statSync(p.cacheIndexFile) : { size: 0 };
      const payloadSizeBytes = stat.size;
      const totalReadinessMs = indexPackage.buildDurationMs + diskWriteMs;

      const completionStats = {
        computationMs: indexPackage.buildDurationMs,
        serializationMs: 0,
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
      } catch (cleanErr) { }

      state.status = 'failed';
      state.error = err;
      state.promise = null;

      rejectPromise(err);
      throw err;
    }
  }

  // Non-blocking async persistence scheduled via setImmediate
  setImmediate(() => {
    executePersistence().catch(() => { });
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
    } catch (e) { }
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
 * Normalizes legacy cached documents by backfilling indexingStatus and sourceIndependence
 * @param {Array<object>} documents - Document array from cached index
 * @returns {Array<object>} Normalized document array
 */
export function normalizeCachedDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  for (const doc of documents) {
    if (!doc.indexingStatus) {
      if (doc.category === 'CORE_OPERATING_RULE' || doc.category === 'ENGINEERING_PATTERN' || doc.category === 'SKILL' || doc.category === 'CAPABILITY' || doc.category === 'DOMAIN_INTELLIGENCE') {
        doc.indexingStatus = 'COMPLETE';
      } else if (doc.category === 'HARVESTED_DOSSIER_CHUNK') {
        doc.indexingStatus = 'UNKNOWN';
      } else {
        doc.indexingStatus = 'UNKNOWN';
      }
    }

    if (!doc.sourceIndependence) {
      const headingToCheck = doc.rawHeading || doc.headingTitle || (doc.title ? doc.title.replace(/^[^—]+—\s*/, '').trim() : '');
      const isTemplateHeading = TEMPLATE_HEADING_REGEX.test(headingToCheck) || TEMPLATE_HEADING_REGEX.test(doc.title);

      if (isTemplateHeading || doc.occurrenceCount > 10) {
        doc.isBoilerplate = true;
        doc.isIndependentCorroboration = false;
        doc.independentCorroborationCount = 0;
        doc.sourceIndependence = 'BOILERPLATE';
      } else if (doc.occurrenceCount > 1) {
        doc.isBoilerplate = false;
        doc.isIndependentCorroboration = false;
        doc.independentCorroborationCount = 0;
        doc.sourceIndependence = 'UNKNOWN';
      } else {
        doc.isBoilerplate = false;
        doc.isIndependentCorroboration = false;
        doc.independentCorroborationCount = 0;
        doc.sourceIndependence = 'SINGLE_SOURCE';
      }
    }

    // Backfill 13-Domain classification on cached documents if missing
    if (!doc.domainLetter) {
      if (doc.category === 'CAPABILITY') {
        const domainMatch = (doc.fullContent || doc.summary || '').match(/Domain:\s*([a-zA-Z0-9_-]+)/i);
        const resolved = domainMatch ? resolveDomain(domainMatch[1]) : null;
        const dom = resolved || fastClassifyDomain(`${doc.title} ${doc.summary}`);
        doc.domainLetter = dom.letter;
        doc.domainId = dom.id;
        doc.domainName = dom.name;
      } else if (doc.category === 'CORE_OPERATING_RULE') {
        const dom = fastClassifyDomain(`${doc.title} ${doc.ruleText || ''} ${doc.summary || ''}`, 'G');
        doc.domainLetter = dom.letter;
        doc.domainId = dom.id;
        doc.domainName = dom.name;
      } else if (doc.category === 'ENGINEERING_PATTERN') {
        const dom = fastClassifyDomain(`${doc.title} ${doc.ruleText || ''} ${doc.whyText || ''} ${doc.summary || ''}`, 'H');
        doc.domainLetter = dom.letter;
        doc.domainId = dom.id;
        doc.domainName = dom.name;
      } else if (doc.category === 'SKILL') {
        const dom = fastClassifyDomain(`${doc.title} ${doc.summary || ''}`, 'H');
        doc.domainLetter = dom.letter;
        doc.domainId = dom.id;
        doc.domainName = dom.name;
      } else if (doc.category === 'HARVESTED_DOSSIER_CHUNK') {
        const dom = fastClassifyDomain(`${doc.title} ${doc.summary || ''}`, 'H');
        doc.domainLetter = dom.letter;
        doc.domainId = dom.id;
        doc.domainName = dom.name;
      }
    }
  }
  return documents;
}

/**
 * Builds the complete BM25 & Lexical Inverted Index
 */
/**
 * Clears in-memory retrieval index cache for a custom root or globally
 * @param {string|null} customRoot - Target root path or null for all
 */
export function clearInMemoryIndexCache(customRoot = null) {
  if (customRoot) {
    const normalizedRoot = path.resolve(customRoot);
    _indexCacheByRoot.delete(normalizedRoot);
    _indexCacheByRoot.delete(customRoot);
    _persistenceStateByRoot.delete(customRoot);
    _persistenceStateByRoot.delete(normalizedRoot);
  } else {
    _indexCacheByRoot.clear();
    _persistenceStateByRoot.clear();
    _inMemoryIndex = null;
    _inMemoryHash = null;
  }
}

/**
 * Invalidates both in-memory cache and cached directory hashes to force fresh re-evaluation
 * @param {string|null} customRoot - Target root path or null for all
 */
export function invalidateRetrievalCache(customRoot = null) {
  clearInMemoryIndexCache(customRoot);
  _cachedDossierHash = null;
  _lastDossierHashCheck = 0;
}

export function buildSearchIndex(forceRebuild = false, customRoot = null, options = {}) {
  // Support options object as 2nd argument: buildSearchIndex(forceRebuild, options)
  let resolvedRoot = customRoot;
  let resolvedOpts = options;
  if (customRoot && typeof customRoot === 'object' && !Array.isArray(customRoot)) {
    resolvedOpts = customRoot;
    resolvedRoot = resolvedOpts.brainRoot || null;
  }

  const p = getRetrievalPaths(resolvedRoot);
  const normalizedRoot = resolvedRoot ? path.resolve(resolvedRoot) : BRAIN_ROOT;
  const isDefaultRoot = normalizedRoot.toLowerCase() === BRAIN_ROOT.toLowerCase();
  const cacheKey = isDefaultRoot ? 'DEFAULT' : normalizedRoot;
  const currentHash = computeSourceFilesHash(resolvedRoot, forceRebuild);

  const rootMemory = _indexCacheByRoot.get(cacheKey);
  if (!forceRebuild && rootMemory && rootMemory.sourceHash === currentHash) {
    return rootMemory;
  }

  // Check persistent disk cache if valid
  if (!forceRebuild && fs.existsSync(p.cacheIndexFile)) {
    try {
      const raw = fs.readFileSync(p.cacheIndexFile, 'utf-8');
      const cached = JSON.parse(raw);
      const isStructurallyValid = cached &&
        cached.sourceHash === currentHash &&
        Array.isArray(cached.documents) &&
        cached.documents.length > 0 &&
        typeof cached.invertedIndex === 'object' &&
        typeof cached.idf === 'object';

      if (isStructurallyValid) {
        // Enforce Fix A (indexingStatus) and Fix B (template detection/source independence) on cached docs
        normalizeCachedDocuments(cached.documents);

        _indexCacheByRoot.set(cacheKey, cached);
        if (isDefaultRoot) {
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
      } catch (rmErr) { }
      // Fall through to rebuild
    }
  }

  const startTime = Date.now();
  const patternDocs = parseEngineeringPatterns(resolvedRoot);
  const coreDocs = parseCoreOperatingRules(resolvedRoot);
  const skillDocs = parseSkills(resolvedRoot);
  const indexDocs = parseKnowledgeIndex(p);

  const capabilityDocs = parseCapabilities(resolvedRoot);
  const domainDocs = parseDomainIntelligenceRecords(resolvedRoot);
  const dossierChunkDocs = parseDossierChunks(p, resolvedOpts);
  const documents = [...patternDocs, ...coreDocs, ...skillDocs, ...indexDocs, ...capabilityDocs, ...domainDocs, ...dossierChunkDocs];
  const N = documents.length;

  let totalDocLength = 0;
  const invertedIndex = Object.create(null); // term -> [{ docIdx, freq }]
  const docMetadata = [];

  for (let i = 0; i < N; i++) {
    const doc = documents[i];
    documents[i] = null; // Allow GC of raw input array elements
    const tokens = doc.tokens || [];
    const docLen = tokens.length;
    totalDocLength += docLen;

    const termFreqs = Object.create(null);
    for (const term of tokens) {
      termFreqs[term] = (termFreqs[term] || 0) + 1;
    }

    for (const term of Object.keys(termFreqs)) {
      const freq = termFreqs[term];
      if (!invertedIndex[term]) invertedIndex[term] = [];
      invertedIndex[term].push({ docIdx: i, freq });
    }

    doc.tokens = null; // Release token string references immediately to minimize heap footprint

    const resolvedRuleNum = doc.ruleNumber ?? (typeof doc.id === 'string' && doc.id.startsWith('Rule ') ? parseInt(doc.id.replace('Rule ', ''), 10) : null);

    // Epistemic calibration & source tiers
    let sourceTier = doc.sourceTier;
    let epistemicState = doc.epistemicState;
    let confidence = doc.confidence;
    let confidenceCalibrated = false; // Strictly false: heuristic category weight, uncalibrated
    let confidenceType = doc.confidenceType;

    if (!sourceTier) {
      if (doc.category === 'CORE_OPERATING_RULE' || doc.category === 'ENGINEERING_PATTERN') {
        sourceTier = 'CANONICAL';
        epistemicState = 'CANONICAL';
        confidence = doc.category === 'CORE_OPERATING_RULE' ? 1.0 : 0.95;
        confidenceType = 'CANONICAL_RULE_AUTHORITY';
      } else if (doc.category === 'SKILL' || doc.category === 'CAPABILITY' || doc.category === 'DOMAIN_INTELLIGENCE') {
        sourceTier = 'EMPIRICAL';
        epistemicState = 'VALIDATED';
        confidence = doc.category === 'CAPABILITY' ? 0.85 : 0.90;
        confidenceType = 'EMPIRICAL_VALIDATED_WEIGHT';
      } else {
        sourceTier = 'FORENSIC_DOSSIER';
        epistemicState = 'EXTRACTED';
        confidence = 0.75;
        confidenceType = 'HEURISTIC_CATEGORY_WEIGHT';
      }
    } else if (!confidenceType) {
      confidenceType = 'HEURISTIC_CATEGORY_WEIGHT';
    }

    let indexingStatus = doc.indexingStatus;
    if (!indexingStatus) {
      if (doc.category === 'CORE_OPERATING_RULE' || doc.category === 'ENGINEERING_PATTERN' || doc.category === 'SKILL' || doc.category === 'CAPABILITY' || doc.category === 'DOMAIN_INTELLIGENCE') {
        indexingStatus = 'COMPLETE';
      } else {
        indexingStatus = 'UNKNOWN';
      }
    }

    docMetadata.push({
      id: doc.id,
      ruleNumber: resolvedRuleNum,
      rule_number: resolvedRuleNum,
      title: doc.title,
      headingTitle: doc.headingTitle || null,
      rawHeading: doc.rawHeading || null,
      category: doc.category,
      sourceTier,
      epistemicState,
      confidence,
      confidenceCalibrated,
      confidenceType,
      domainLetter: doc.domainLetter || null,
      domainId: doc.domainId || null,
      domainName: doc.domainName || null,
      secondaryDomains: doc.secondaryDomains || [],
      filePath: doc.filePath,
      lineRange: doc.lineRange,
      summary: doc.summary,
      ruleText: doc.ruleText || '',
      whyText: doc.whyText || '',
      whenText: doc.whenText || '',
      fullContent: doc.fullContent,
      sourceOccurrences: doc.sourceOccurrences || [{ filePath: doc.filePath, lineRange: doc.lineRange }],
      occurrenceCount: doc.occurrenceCount || (doc.sourceOccurrences ? doc.sourceOccurrences.length : 1),
      corroborationSources: doc.corroborationSources || [],
      isBoilerplate: doc.isBoilerplate ?? false,
      isIndependentCorroboration: doc.isIndependentCorroboration ?? false,
      independentCorroborationCount: doc.independentCorroborationCount ?? 0,
      sourceIndependence: doc.sourceIndependence || (doc.isBoilerplate ? 'BOILERPLATE' : (doc.occurrenceCount > 1 ? 'UNKNOWN' : 'SINGLE_SOURCE')),
      indexingStatus,
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
  if (isDefaultRoot) {
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
  const matchedDocIndices = new Set();

  // Check for specific rule number intent (e.g. "Rule 15", "15", "rule24")
  const ruleNumMatch = query.match(/(?:rule\s*|#)(\d+)/i);
  const targetRuleNum = ruleNumMatch ? parseInt(ruleNumMatch[1], 10) : null;

  for (const term of queryTokens) {
    const postings = index.invertedIndex[term];
    if (!postings) continue;

    const termIdf = index.idf[term] || 0.1;

    for (const posting of postings) {
      const docIdx = posting.docIdx;
      matchedDocIndices.add(docIdx);
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
    }
  }

  // Grounded expansion terms scoring with 0.4x discount
  let additionalTerms = [];
  if (Array.isArray(options.expansionTerms) && options.expansionTerms.length > 0) {
    additionalTerms = options.expansionTerms;
  } else if (options.expandQuery === true) {
    const exp = expandQueryWithTaxonomy(query, options.domains || (options.domain ? [options.domain] : []));
    additionalTerms = exp.expansionTerms;
  }

  for (const term of additionalTerms) {
    const postings = index.invertedIndex[term];
    if (!postings) continue;
    const termIdf = index.idf[term] || 0.1;
    for (const posting of postings) {
      const docIdx = posting.docIdx;
      matchedDocIndices.add(docIdx);
      const freq = posting.freq;
      const doc = index.documents[docIdx];
      const docLen = doc.docLength;
      const numerator = freq * (k1 + 1);
      const denominator = freq + k1 * (1 - b + b * (docLen / index.avgdl));
      const termScore = (termIdf * (numerator / denominator)) * 0.4;
      scores[docIdx] += termScore;
    }
  }

  // Resolve target domains if options.domain or options.domains is specified
  const targetDomains = [];
  if (options.domain) {
    const d = String(options.domain).trim().toUpperCase().replace(/^DOMAIN[_-]/i, '');
    targetDomains.push(d);
  }
  if (Array.isArray(options.domains)) {
    for (const dom of options.domains) {
      const d = String(dom).trim().toUpperCase().replace(/^DOMAIN[_-]/i, '');
      targetDomains.push(d);
    }
  }

  // Domain relevance boosting (2.5x multiplier for primary matching domain)
  if (targetDomains.length > 0) {
    for (const i of matchedDocIndices) {
      if (scores[i] > 0) {
        const doc = index.documents[i];
        const docDomain = (doc.domainLetter || '').toUpperCase();
        const matchesPrimary = targetDomains.includes(docDomain);
        const matchesSecondary = (doc.secondaryDomains || []).some(s => targetDomains.includes(String(s).toUpperCase()));
        if (matchesPrimary) {
          scores[i] *= 2.5;
        } else if (matchesSecondary) {
          scores[i] *= 1.5;
        }
      }
    }
  }

  // Filter category and strictDomain if specified
  const filteredIndices = [];
  for (const i of matchedDocIndices) {
    if (scores[i] > 0) {
      if (options.category && index.documents[i].category !== options.category) {
        continue;
      }
      if (options.strictDomain && targetDomains.length > 0) {
        const docDomain = (index.documents[i].domainLetter || '').toUpperCase();
        if (!targetDomains.includes(docDomain)) {
          continue;
        }
      }
      filteredIndices.push(i);
    }
  }

  // Sort descending by score
  filteredIndices.sort((a, b) => scores[b] - scores[a]);

  // Deduplicate near-identical results by title to suppress redundant sub-chunks
  // Enforce cross-domain diversity if multiple target domains are requested
  const targetTopK = options.topK || 5;
  const deduplicatedIndices = [];
  const seenTitles = new Set();
  const domainCounts = new Map();
  const maxPerDomain = (Array.isArray(options.domains) && options.domains.length > 1)
    ? Math.max(1, Math.floor(targetTopK / 2))
    : targetTopK;

  for (const idx of filteredIndices) {
    const doc = index.documents[idx];
    const normalizedTitle = (doc.title || doc.id).toLowerCase().replace(/\s*\(part\s+\d+\/\d+\)/i, '').trim();
    const docDomain = doc.domainLetter || 'UNKNOWN';
    const currentDomainCount = domainCounts.get(docDomain) || 0;

    if (!seenTitles.has(normalizedTitle) && currentDomainCount < maxPerDomain) {
      seenTitles.add(normalizedTitle);
      domainCounts.set(docDomain, currentDomainCount + 1);
      deduplicatedIndices.push(idx);
      if (deduplicatedIndices.length >= targetTopK) break;
    }
  }

  // If diversity cap left slots open, backfill from remaining filtered results
  if (deduplicatedIndices.length < targetTopK) {
    for (const idx of filteredIndices) {
      if (!deduplicatedIndices.includes(idx)) {
        const doc = index.documents[idx];
        const normalizedTitle = (doc.title || doc.id).toLowerCase().replace(/\s*\(part\s+\d+\/\d+\)/i, '').trim();
        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          deduplicatedIndices.push(idx);
          if (deduplicatedIndices.length >= targetTopK) break;
        }
      }
    }
  }

  const allSearchTerms = queryTokens.concat(additionalTerms);
  const results = deduplicatedIndices.map(docIdx => {
    const doc = index.documents[docIdx];
    const docText = `${doc.title || ''} ${doc.summary || ''} ${doc.ruleText || ''} ${doc.whyText || ''} ${doc.fullContent || ''}`.toLowerCase();
    const matchedTerms = allSearchTerms.filter(t => docText.includes(t));
    const evidenceExcerpt = extractEvidenceExcerpt(doc.fullContent || doc.summary, matchedTerms);

    return {
      id: doc.id,
      ruleNumber: doc.ruleNumber ?? null,
      rule_number: doc.ruleNumber ?? null,
      title: doc.title,
      category: doc.category,
      sourceTier: doc.sourceTier,
      epistemicState: doc.epistemicState,
      confidence: doc.confidence,
      confidenceCalibrated: doc.confidenceCalibrated ?? false,
      confidenceType: doc.confidenceType || 'HEURISTIC_CATEGORY_WEIGHT',
      domainLetter: doc.domainLetter ?? null,
      domainName: doc.domainName ?? null,
      score: parseFloat(scores[docIdx].toFixed(4)),
      filePath: doc.filePath,
      lineRange: doc.lineRange,
      summary: doc.summary,
      evidenceExcerpt,
      ruleText: doc.ruleText,
      whyText: doc.whyText,
      whenText: doc.whenText,
      fullContent: doc.fullContent,
      corroborationSources: doc.corroborationSources || [],
      sourceOccurrences: doc.sourceOccurrences || [{ filePath: doc.filePath, lineRange: doc.lineRange }],
      occurrenceCount: doc.occurrenceCount || (doc.sourceOccurrences ? doc.sourceOccurrences.length : 1),
      isBoilerplate: doc.isBoilerplate ?? false,
      isIndependentCorroboration: doc.isIndependentCorroboration ?? false,
      independentCorroborationCount: doc.independentCorroborationCount ?? 0,
      sourceIndependence: doc.sourceIndependence || (doc.isBoilerplate ? 'BOILERPLATE' : (doc.occurrenceCount > 1 ? 'UNKNOWN' : 'SINGLE_SOURCE')),
      indexingStatus: doc.indexingStatus || 'UNKNOWN',
      matchedTerms
    };
  });

  let graphContext = null;
  if (options.expandGraph === true && results.length > 0) {
    try {
      const seedIds = results.map(r => r.id).filter(Boolean);
      graphContext = getExpandedContextForRecords(seedIds, {
        customRoot: options.brainRoot || options.customRoot || null,
        maxHops: options.graphMaxHops || 1
      });
    } catch (graphErr) { }
  }

  return {
    query,
    results: graphContext ? results.map(r => ({
      ...r,
      graphRelationships: graphContext.relationshipPaths?.filter(p => p.includes(r.id)) || []
    })) : results,
    graphExpandedContext: graphContext,
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
      sourceTier: r.sourceTier,
      epistemicState: r.epistemicState,
      confidence: r.confidence,
      confidenceCalibrated: r.confidenceCalibrated ?? false,
      confidenceType: r.confidenceType || 'HEURISTIC_CATEGORY_WEIGHT',
      score: r.score,
      filePath: r.filePath,
      lineRange: r.lineRange,
      summary: r.summary,
      evidenceExcerpt: r.evidenceExcerpt,
      corroborationSources: r.corroborationSources || [],
      sourceOccurrences: r.sourceOccurrences || [{ filePath: r.filePath, lineRange: r.lineRange }],
      occurrenceCount: r.occurrenceCount || 1,
      isBoilerplate: r.isBoilerplate ?? false,
      isIndependentCorroboration: r.isIndependentCorroboration ?? false,
      independentCorroborationCount: r.independentCorroborationCount ?? 0,
      sourceIndependence: r.sourceIndependence || (r.isBoilerplate ? 'BOILERPLATE' : (r.occurrenceCount > 1 ? 'UNKNOWN' : 'SINGLE_SOURCE')),
      indexingStatus: r.indexingStatus || 'UNKNOWN'
    }))
  };
}

/**
 * Universal Structured Knowledge Retrieval
 * Provides formal status outcomes:
 *   - 'FOUND': Matches discovered within token budget
 *   - 'GENUINELY_EMPTY': Zero matching evidence in the knowledge index
 *   - 'INDEX_UNAVAILABLE': Index storage unreadable or corrupt
 *   - 'BUDGET_EXHAUSTED': Matches exist but exceed the token budget constraint
 *   - 'RETRIEVAL_ERROR': Error thrown during parsing or search execution
 * 
 * @param {string} query - Natural language search phrase or keywords
 * @param {object} options - Search options { maxTokens, topK, domains, domain, category, brainRoot, expandQuery }
 * @returns {object} Structured retrieval outcome package
 */
export function searchBrainDetailed(query, options = {}) {
  const startTime = Date.now();
  const customRoot = options.brainRoot || null;
  const maxTokens = options.maxTokens !== undefined ? options.maxTokens : 2400;
  const topK = options.topK || 10;

  // 1. Error boundary for invalid query types
  if (query === null || query === undefined || typeof query !== 'string') {
    return {
      status: 'RETRIEVAL_ERROR',
      query: String(query),
      results: [],
      totalDocuments: 0,
      matchedCount: 0,
      durationMs: Date.now() - startTime,
      diagnostics: { error: 'Invalid query input: expected non-null string' },
      limitations: ['Query must be a valid non-null string']
    };
  }

  // 2. Index availability check
  let index;
  try {
    const p = getRetrievalPaths(customRoot);
    if (customRoot && !fs.existsSync(p.brainRoot)) {
      return {
        status: 'INDEX_UNAVAILABLE',
        query,
        results: [],
        totalDocuments: 0,
        matchedCount: 0,
        durationMs: Date.now() - startTime,
        diagnostics: { error: `Brain root does not exist: ${customRoot}` },
        limitations: ['Knowledge index unavailable on target storage path']
      };
    }
    index = buildSearchIndex(options.forceRebuild || false, customRoot, options);
  } catch (err) {
    return {
      status: 'INDEX_UNAVAILABLE',
      query,
      results: [],
      totalDocuments: 0,
      matchedCount: 0,
      durationMs: Date.now() - startTime,
      diagnostics: { error: err.message },
      limitations: ['Search index could not be initialized']
    };
  }

  // 3. Grounded Query Expansion
  let expansionDiagnostics = { matchedDomains: [], expansionTerms: [] };
  let effectiveOptions = { ...options };
  if (options.expandQuery === true || (options.domains && options.domains.length > 0) || options.domain) {
    const targetDoms = options.domains || (options.domain ? [options.domain] : []);
    expansionDiagnostics = expandQueryWithTaxonomy(query, targetDoms);
    if (options.expandQuery && expansionDiagnostics.expansionTerms.length > 0) {
      effectiveOptions.expansionTerms = expansionDiagnostics.expansionTerms;
    }
  }

  // 4. Base search execution
  let baseSearch;
  try {
    baseSearch = searchBrain(query, effectiveOptions);
  } catch (searchErr) {
    return {
      status: 'RETRIEVAL_ERROR',
      query,
      results: [],
      totalDocuments: index ? index.totalDocuments : 0,
      matchedCount: 0,
      durationMs: Date.now() - startTime,
      diagnostics: { error: searchErr.message },
      limitations: ['Exception encountered during BM25 search evaluation']
    };
  }

  const rawResults = baseSearch.results || [];
  const matchedCount = baseSearch.matchedCount !== undefined ? baseSearch.matchedCount : rawResults.length;

  // 5. Genuinely Empty outcome
  if (matchedCount === 0 || rawResults.length === 0) {
    return {
      status: 'GENUINELY_EMPTY',
      query,
      results: [],
      totalDocuments: index.totalDocuments,
      matchedCount: 0,
      durationMs: Date.now() - startTime,
      diagnostics: {
        expandedQueryTerms: expansionDiagnostics.expansionTerms,
        matchedDomains: expansionDiagnostics.matchedDomains,
        tokensUsed: 0,
        maxTokens
      },
      limitations: ['Zero evidence matches found across canonical rules, patterns, skills, and dossiers']
    };
  }

  // 6. Context Budgeting & Packing
  let currentTokens = 0;
  const budgetedResults = [];
  let budgetExhausted = false;

  for (const item of rawResults) {
    const itemContent = item.fullContent || item.summary || '';
    const estTokens = Math.ceil(itemContent.length / 4);

    if (currentTokens + estTokens <= maxTokens) {
      currentTokens += estTokens;
      budgetedResults.push(item);
    } else if (budgetedResults.length === 0 && maxTokens > 100) {
      const maxChars = maxTokens * 4;
      const truncatedExcerpt = itemContent.slice(0, maxChars - 100) + '... [Truncated by Budgeter]';
      budgetedResults.push({
        ...item,
        fullContent: truncatedExcerpt,
        evidenceExcerpt: extractEvidenceExcerpt(truncatedExcerpt, item.matchedTerms)
      });
      currentTokens = maxTokens;
      budgetExhausted = true;
      break;
    } else {
      budgetExhausted = true;
      break;
    }
  }

  // If budget was strictly exceeded before packing any item
  if (budgetedResults.length === 0) {
    return {
      status: 'BUDGET_EXHAUSTED',
      query,
      results: [],
      totalDocuments: index.totalDocuments,
      matchedCount,
      durationMs: Date.now() - startTime,
      diagnostics: {
        budgetExhausted: true,
        tokensUsed: 0,
        maxTokens,
        droppedMatchesCount: rawResults.length
      },
      limitations: [`Context budget constraint (${maxTokens} tokens) was exhausted before packing matched results`]
    };
  }

  // 7. Limitations & Epistemic Warnings
  const limitations = [];
  const hasExtracted = budgetedResults.some(r => r.epistemicState === 'EXTRACTED');
  if (hasExtracted) {
    limitations.push('Contains EXTRACTED findings from forensic learning dossiers; independently verify against target codebase before production deployment');
  }
  if (budgetExhausted) {
    limitations.push(`Result set truncated: ${rawResults.length - budgetedResults.length} additional matches omitted due to maxTokens budget (${maxTokens})`);
  }

  // Graph-Aware Knowledge Context Enrichment (System B <-> System C Integration)
  let graphContext = null;
  if (options.expandGraph !== false && budgetedResults.length > 0) {
    try {
      const seedIds = budgetedResults.map(r => r.id).filter(Boolean);
      graphContext = getExpandedContextForRecords(seedIds, {
        customRoot,
        brainRoot: customRoot,
        maxHops: options.graphMaxHops || 1
      });
    } catch (graphErr) { }
  }

  const finalResults = graphContext ? budgetedResults.map(r => ({
    ...r,
    graphRelationships: graphContext.relationshipPaths?.filter(p => p.includes(r.id)) || []
  })) : budgetedResults;

  return {
    status: 'FOUND',
    query,
    results: finalResults,
    graphExpandedContext: graphContext,
    totalDocuments: index.totalDocuments,
    matchedCount,
    durationMs: Date.now() - startTime,
    diagnostics: {
      expandedQueryTerms: expansionDiagnostics.expansionTerms,
      matchedDomains: expansionDiagnostics.matchedDomains,
      budgetExhausted,
      tokensUsed: currentTokens,
      maxTokens
    },
    limitations
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
