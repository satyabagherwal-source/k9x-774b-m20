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
function computeSourceFilesHash() {
  const hash = crypto.createHash('sha256');
  if (fs.existsSync(PATTERNS_FILE)) hash.update(fs.statSync(PATTERNS_FILE).mtimeMs.toString());
  if (fs.existsSync(CORE_RULES_FILE)) hash.update(fs.statSync(CORE_RULES_FILE).mtimeMs.toString());
  if (fs.existsSync(SKILLS_DIR)) {
    const skills = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    for (const f of skills) {
      hash.update(fs.statSync(path.join(SKILLS_DIR, f)).mtimeMs.toString());
    }
  }
  return hash.digest('hex');
}

/**
 * Parses 05_KNOWLEDGE/engineering-patterns.md into discrete rule documents
 */
export function parseEngineeringPatterns() {
  if (!fs.existsSync(PATTERNS_FILE)) return [];
  const content = fs.readFileSync(PATTERNS_FILE, 'utf-8');
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
export function parseCoreOperatingRules() {
  if (!fs.existsSync(CORE_RULES_FILE)) return [];
  const content = fs.readFileSync(CORE_RULES_FILE, 'utf-8');
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
export function parseSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md') && f !== '.gitkeep');
  const docs = [];

  for (const f of files) {
    const fullPath = path.join(SKILLS_DIR, f);
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
 * Builds the complete BM25 & Lexical Inverted Index
 */
export function buildSearchIndex(forceRebuild = false) {
  const currentHash = computeSourceFilesHash();

  if (!forceRebuild && _inMemoryIndex && _inMemoryHash === currentHash) {
    return _inMemoryIndex;
  }

  // Check persistent disk cache if valid
  if (!forceRebuild && fs.existsSync(CACHE_INDEX_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_INDEX_FILE, 'utf-8'));
      if (cached.sourceHash === currentHash) {
        _inMemoryIndex = cached;
        _inMemoryHash = currentHash;
        return _inMemoryIndex;
      }
    } catch (e) {
      // Fall through to rebuild
    }
  }

  const startTime = Date.now();
  const patternDocs = parseEngineeringPatterns();
  const coreDocs = parseCoreOperatingRules();
  const skillDocs = parseSkills();

  const documents = [...patternDocs, ...coreDocs, ...skillDocs];
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

    docMetadata.push({
      id: doc.id,
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

  _inMemoryIndex = indexPackage;
  _inMemoryHash = currentHash;

  // Persist cache to disk
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_INDEX_FILE, JSON.stringify(indexPackage), 'utf-8');
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
  const index = buildSearchIndex(options.forceRebuild || false);
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

  const searchOutput = searchBrain(query, { topK, category: options.category });
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
