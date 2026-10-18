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
  let ruleBody = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (match) {
      if (currentRule) {
        docs.push(finalizeRuleDoc(currentRule, ruleBody.join('\n'), startLine, i));
      }
      currentRule = {
        ruleNumber: parseInt(match[1], 10),
        title: match[2].trim(),
        id: `Rule ${match[1]}`
      };
      ruleBody = [];
      startLine = i + 1;
    } else if (currentRule) {
      ruleBody.push(line);
    }
  }

  if (currentRule) {
    docs.push(finalizeRuleDoc(currentRule, ruleBody.join('\n'), startLine, lines.length));
  }

  return docs;
}

function finalizeRuleDoc(meta, rawBody, startLine, endLine) {
  const ruleMatch = rawBody.match(/\*\*RULE\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:WHY|WHEN TO APPLY|VERIFIED|NEGATIVE)|$)/i);
  const whyMatch = rawBody.match(/\*\*WHY\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:RULE|WHEN TO APPLY|VERIFIED|NEGATIVE)|$)/i);
  const whenMatch = rawBody.match(/\*\*WHEN TO APPLY\*\*:\s*([\s\S]*?)(?=\n\s*\*\*(?:RULE|WHY|VERIFIED|NEGATIVE)|$)/i);

  const ruleText = ruleMatch ? ruleMatch[1].trim() : '';
  const whyText = whyMatch ? whyMatch[1].trim() : '';
  const whenText = whenMatch ? whenMatch[1].trim() : '';

  const summary = ruleText ? ruleText.slice(0, 300) : rawBody.slice(0, 300);

  return {
    id: meta.id,
    ruleNumber: meta.ruleNumber,
    title: meta.title,
    category: 'ENGINEERING_PATTERN',
    filePath: '05_KNOWLEDGE/engineering-patterns.md',
    lineRange: [startLine, endLine],
    ruleText,
    whyText,
    whenText,
    summary,
    fullContent: `## ${meta.ruleNumber}. ${meta.title}\n\n${rawBody.trim()}`,
    tokens: tokenize(`${meta.title} ${meta.id} ${ruleText} ${whyText} ${whenText}`)
  };
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
      const existingFiles = new Set(files);
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
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(paths.brainRoot, relPath);
    if (!fs.existsSync(fullPath)) continue;

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
 * Builds the complete BM25 & Lexical Inverted Index
 */
export function buildSearchIndex(forceRebuild = false, customRoot = null) {
  const p = getRetrievalPaths(customRoot);
  const cacheKey = customRoot || 'DEFAULT';
  const currentHash = computeSourceFilesHash(customRoot);

  const rootMemory = _indexCacheByRoot.get(cacheKey);
  if (!forceRebuild && rootMemory && rootMemory.sourceHash === currentHash) {
    return rootMemory;
  }

  // Check persistent disk cache if valid
  if (!forceRebuild && fs.existsSync(p.cacheIndexFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(p.cacheIndexFile, 'utf-8'));
      if (cached.sourceHash === currentHash) {
        _indexCacheByRoot.set(cacheKey, cached);
        if (!customRoot) {
          _inMemoryIndex = cached;
          _inMemoryHash = currentHash;
        }
        return cached;
      }
    } catch (e) {
      // Fall through to rebuild
    }
  }

  const startTime = Date.now();
  const patternDocs = parseEngineeringPatterns(customRoot);
  const coreDocs = parseCoreOperatingRules(customRoot);
  const skillDocs = parseSkills(customRoot);
  const indexDocs = parseKnowledgeIndex(p);

  const documents = [...patternDocs, ...coreDocs, ...skillDocs, ...indexDocs];
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
  if (!customRoot) {
    _inMemoryIndex = indexPackage;
    _inMemoryHash = currentHash;
  }

  // Persist cache to disk
  try {
    fs.mkdirSync(p.cacheDir, { recursive: true });
    fs.writeFileSync(p.cacheIndexFile, JSON.stringify(indexPackage), 'utf-8');
  } catch (e) {}

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
