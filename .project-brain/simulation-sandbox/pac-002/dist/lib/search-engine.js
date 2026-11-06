/**
 * In-Memory Lexical Search & Filtering Engine
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/search-engine.js
 * Domain Governance: Domain H (Technical Construction) & Domain J (Search & Distribution)
 * 
 * Provides:
 * - Sub-5ms in-memory lexical query matching over articles.
 * - Multi-field token scoring (title: 5x, tags: 3x, excerpt: 2x, content: 1x).
 * - Category and tag filtering.
 * - Stopword removal and normalization.
 */

import { getAllArticles } from './content-store.js';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'
]);

/**
 * Tokenizes text into lowercase normalized alphanumeric tokens.
 * 
 * @param {string} text 
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

export class ArticleSearchEngine {
  constructor(articles = null) {
    this.articles = articles || getAllArticles();
    this.index = new Map();
    this.buildIndex();
  }

  /**
   * Builds the inverted index over all article documents.
   */
  buildIndex() {
    this.index.clear();

    for (const art of this.articles) {
      const titleTokens = tokenize(art.title);
      const tagTokens = tokenize(art.tags.join(' '));
      const excerptTokens = tokenize(art.excerpt);
      const contentTokens = tokenize(art.content);
      const authorTokens = tokenize(art.author?.name || '');

      const termWeights = new Map();

      // Title tokens (5x weight)
      for (const t of titleTokens) {
        termWeights.set(t, (termWeights.get(t) || 0) + 5.0);
      }
      // Tag tokens (3x weight)
      for (const t of tagTokens) {
        termWeights.set(t, (termWeights.get(t) || 0) + 3.0);
      }
      // Excerpt tokens (2x weight)
      for (const t of excerptTokens) {
        termWeights.set(t, (termWeights.get(t) || 0) + 2.0);
      }
      // Author tokens (2x weight)
      for (const t of authorTokens) {
        termWeights.set(t, (termWeights.get(t) || 0) + 2.0);
      }
      // Content tokens (1x weight)
      for (const t of contentTokens) {
        termWeights.set(t, (termWeights.get(t) || 0) + 1.0);
      }

      for (const [term, weight] of termWeights.entries()) {
        if (!this.index.has(term)) {
          this.index.set(term, []);
        }
        this.index.get(term).push({
          articleId: art.id,
          weight
        });
      }
    }
  }

  /**
   * Executes search query with optional category filtering.
   * 
   * @param {string} query 
   * @param {{ category?: string, tag?: string }} filterOptions 
   * @returns {{
   *   results: Array<any>,
   *   totalCount: number,
   *   query: string,
   *   categoryFilter: string,
   *   durationMs: number
   * }}
   */
  search(query = '', filterOptions = {}) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const rawQuery = String(query || '').trim();
    const queryTokens = tokenize(rawQuery);
    const categoryFilter = filterOptions.category || 'all';

    // 1. Initial Candidate Selection
    let candidates = this.articles;
    if (categoryFilter && categoryFilter !== 'all') {
      candidates = candidates.filter(a => a.category === categoryFilter);
    }
    if (filterOptions.tag) {
      const tagLower = filterOptions.tag.toLowerCase();
      candidates = candidates.filter(a => a.tags.some(t => t.toLowerCase() === tagLower));
    }

    // 2. If no query text, return candidates sorted by publish date
    if (queryTokens.length === 0) {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      return {
        results: [...candidates].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
        totalCount: candidates.length,
        query: '',
        categoryFilter,
        durationMs
      };
    }

    // 3. Score candidates using inverted index
    const candidateMap = new Map(candidates.map(a => [a.id, a]));
    const scores = new Map();

    for (const token of queryTokens) {
      const postings = this.index.get(token) || [];
      for (const posting of postings) {
        if (candidateMap.has(posting.articleId)) {
          scores.set(posting.articleId, (scores.get(posting.articleId) || 0) + posting.weight);
        }
      }
      // Also check partial substring matches for short prefixes (>= 3 chars)
      if (token.length >= 3) {
        for (const [indexedTerm, postingsList] of this.index.entries()) {
          if (indexedTerm !== token && indexedTerm.startsWith(token)) {
            for (const p of postingsList) {
              if (candidateMap.has(p.articleId)) {
                scores.set(p.articleId, (scores.get(p.articleId) || 0) + (p.weight * 0.5));
              }
            }
          }
        }
      }
    }

    // 4. Rank matched candidates
    const scoredResults = [];
    for (const [id, score] of scores.entries()) {
      const art = candidateMap.get(id);
      if (art) {
        scoredResults.push({
          ...art,
          searchScore: score
        });
      }
    }

    scoredResults.sort((a, b) => b.searchScore - a.searchScore);

    const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return {
      results: scoredResults,
      totalCount: scoredResults.length,
      query: rawQuery,
      categoryFilter,
      durationMs
    };
  }
}
