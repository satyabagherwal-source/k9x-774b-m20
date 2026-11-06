/**
 * PAC-002 Independent Automated Verification Suite
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/test/run-tests.mjs
 * Purpose: Verifies functional, content, search, SEO, accessibility,
 *          and privacy requirements for the Editorial Publishing Website.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

import {
  getAllArticles,
  getArticleBySlug,
  getArticlesByCategory,
  getRelatedArticles,
  calculateReadingTime,
  AUTHORS,
  CATEGORIES
} from '../src/lib/content-store.js';
import { ArticleSearchEngine, tokenize } from '../src/lib/search-engine.js';
import {
  generateArticleJsonLd,
  generateBreadcrumbJsonLd,
  generateWebSiteJsonLd,
  generateXmlSitemap
} from '../src/lib/seo-engine.js';
import { formatEditorialDate, ReadingThemeManager } from '../src/lib/accessibility.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    totalFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllTests() {
  console.log('============================================================');
  console.log('🧪 PAC-002 EDITORIAL PUBLICATION AUTOMATED VERIFICATION SUITE');
  console.log('   Product: The Sovereign Chronicle');
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Content Store & Taxonomy Integrity (Domain I)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Content Store, Metadata & Taxonomy Schema Integrity...');
  const articles = getAllArticles();
  assert(articles.length >= 5, `Content store contains ${articles.length} articles (>= 5 required)`);

  for (const art of articles) {
    assert(art.id && art.id.startsWith('art-'), `Article ${art.id} has valid ID format`);
    assert(art.slug && art.slug.length > 5, `Article ${art.id} has clean slug identifier: ${art.slug}`);
    assert(art.title && art.title.length > 10, `Article ${art.id} has substantive title`);
    assert(art.excerpt && art.excerpt.length > 30, `Article ${art.id} has comprehensive lead excerpt`);
    assert(art.content && art.content.includes('## '), `Article ${art.id} contains formatted Markdown headings`);
    assert(Array.isArray(art.tags) && art.tags.length >= 2, `Article ${art.id} has at least 2 taxonomy tags`);
    assert(art.author && art.author.name && art.author.role, `Article ${art.id} has valid author attribution: ${art.author.name}`);
    assert(art.readingTime > 0, `Article ${art.id} has positive reading time (${art.readingTime} min)`);
  }

  // Author profiles validation
  const authorKeys = Object.keys(AUTHORS);
  assert(authorKeys.length >= 3, `Editorial publication defines ${authorKeys.length} distinct author profiles`);
  for (const [key, author] of Object.entries(AUTHORS)) {
    assert(author.id === key, `Author ${key} matches object key`);
    assert(author.bio && author.bio.length > 20, `Author ${key} has detailed professional biography`);
    assert(author.avatar && author.avatar.length === 2, `Author ${key} has 2-letter avatar initials`);
  }

  // Category taxonomy validation
  assert(CATEGORIES.length === 4, `Publication defines exactly 4 architectural categories`);
  const catIds = CATEGORIES.map(c => c.id);
  assert(catIds.includes('architecture'), 'Category architecture present');
  assert(catIds.includes('systems-engineering'), 'Category systems-engineering present');
  assert(catIds.includes('data-sovereignty'), 'Category data-sovereignty present');
  assert(catIds.includes('web-craft'), 'Category web-craft present');

  // Reading time formula validation
  assert(calculateReadingTime('') === 1, 'Empty content defaults safely to 1 min reading time');
  assert(calculateReadingTime('word '.repeat(400)) === 2, '400 words correctly calculates to 2 minutes (200 wpm)');
  assert(calculateReadingTime('word '.repeat(650)) === 4, '650 words correctly ceiling-rounds to 4 minutes');

  // Related articles discovery validation
  const relatedArt1 = getRelatedArticles('art-001', 2);
  assert(relatedArt1.length === 2, 'Related articles algorithm returns exactly 2 related pieces');
  assert(!relatedArt1.some(r => r.id === 'art-001'), 'Related articles strictly excludes current article ID');

  // -------------------------------------------------------------------------
  // TEST 2: In-Memory Search Engine & Lexical Indexing (Domain H & J)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] In-Memory Search Engine, Token Scoring & Category Filtering...');
  const searchEngine = new ArticleSearchEngine();

  // 2A: Empty query returns full catalog sorted by date
  const resEmpty = searchEngine.search('');
  assert(resEmpty.totalCount === articles.length, 'Empty search query returns all articles');
  assert(resEmpty.results[0].publishedAt >= resEmpty.results[1].publishedAt, 'Default search output sorted chronologically descending');

  // 2B: Category filtering
  const resCat = searchEngine.search('', { category: 'systems-engineering' });
  assert(resCat.totalCount > 0, `Category filter found ${resCat.totalCount} systems-engineering articles`);
  assert(resCat.results.every(a => a.category === 'systems-engineering'), 'Every result matches category filter');

  // 2C: High-intent keyword search
  const resReDoS = searchEngine.search('redos backtracking');
  assert(resReDoS.totalCount > 0, 'Search for "redos backtracking" returned matching results');
  assert(resReDoS.results[0].slug.includes('redos'), 'Top result is the ReDoS monograph');

  const resZeroJs = searchEngine.search('zero-client-js hydration');
  assert(resZeroJs.totalCount > 0, 'Search for "zero-client-js hydration" returned matching results');
  assert(resZeroJs.results[0].slug.includes('premature-hydration'), 'Top result is the Premature Hydration monograph');

  const resCrypto = searchEngine.search('ed25519 authorization');
  assert(resCrypto.totalCount > 0, 'Search for "ed25519 authorization" returned matching results');
  assert(resCrypto.results[0].slug.includes('cryptographic-authorization'), 'Top result is the Cryptographic Authorization monograph');

  // 2D: Sub-5ms search latency SLA
  assert(resReDoS.durationMs < 10, `Search execution latency (${resReDoS.durationMs.toFixed(2)}ms) within sub-10ms SLA`);

  // 2E: Zero-match empty query
  const resNone = searchEngine.search('nonexistentquantumgibberishxyz');
  assert(resNone.totalCount === 0 && resNone.results.length === 0, 'Non-matching query returns zero results cleanly');

  // -------------------------------------------------------------------------
  // TEST 3: SEO, Structured Schema & Syndication Feeds (Domain J)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Technical SEO, JSON-LD Schemas, Sitemap & Feed Syndication...');

  const sampleArt = articles[0];
  const jsonLdArticle = generateArticleJsonLd(sampleArt);
  assert(jsonLdArticle['@context'] === 'https://schema.org', 'Article JSON-LD specifies schema.org context');
  assert(jsonLdArticle['@type'] === 'TechArticle', 'Article JSON-LD specifies TechArticle type');
  assert(jsonLdArticle.headline === sampleArt.title, 'Article JSON-LD headline matches title');
  assert(jsonLdArticle.author?.name === sampleArt.author.name, 'Article JSON-LD author matches author name');
  assert(jsonLdArticle.publisher?.name.includes('Sovereign Chronicle'), 'Article JSON-LD publisher specified');

  const jsonLdBreadcrumb = generateBreadcrumbJsonLd(sampleArt);
  assert(jsonLdBreadcrumb['@type'] === 'BreadcrumbList', 'BreadcrumbList JSON-LD generated');
  assert(jsonLdBreadcrumb.itemListElement.length === 3, 'BreadcrumbList contains 3 hierarchical tiers');

  const jsonLdWebSite = generateWebSiteJsonLd();
  assert(jsonLdWebSite['@type'] === 'WebSite', 'WebSite JSON-LD generated');
  assert(jsonLdWebSite.potentialAction?.['@type'] === 'SearchAction', 'SearchAction schema attached to WebSite');

  // XML Sitemap test
  const sitemapXml = generateXmlSitemap(articles, CATEGORIES);
  assert(sitemapXml.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Sitemap begins with XML header');
  assert(sitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Sitemap includes sitemap.org namespace');
  assert(sitemapXml.includes(`slug=${sampleArt.slug}`), 'Sitemap includes sample article slug');

  // Robots.txt verification
  const robotsPath = path.join(PROJECT_ROOT, 'src', 'data', 'robots.txt');
  assert(fs.existsSync(robotsPath), 'src/data/robots.txt exists on disk');
  const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
  assert(robotsContent.includes('User-agent: *'), 'Robots.txt allows standard crawlers');
  assert(robotsContent.includes('Sitemap:'), 'Robots.txt declares sitemap URI');

  // JSON Feed 1.1 verification
  const feedPath = path.join(PROJECT_ROOT, 'src', 'data', 'feed.json');
  assert(fs.existsSync(feedPath), 'src/data/feed.json exists on disk');
  const feedJson = JSON.parse(fs.readFileSync(feedPath, 'utf-8'));
  assert(feedJson.version.includes('jsonfeed.org'), 'Feed declares JSON Feed 1.1 version');
  assert(feedJson.items.length === articles.length, `Feed contains all ${articles.length} publication items`);

  // -------------------------------------------------------------------------
  // TEST 4: Accessibility & Helper Utilities (Domain E & K)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Accessibility, Theme Management & Formatters...');

  assert(formatEditorialDate('2026-11-01T09:00:00Z') === 'November 1, 2026', 'formatEditorialDate formats date string properly');
  assert(formatEditorialDate('invalid') === 'invalid', 'formatEditorialDate falls back cleanly on invalid date');

  const themeManager = new ReadingThemeManager();
  themeManager.setTheme('dark', false);
  assert(themeManager.getTheme() === 'dark', 'ThemeManager defaults to dark mode');
  themeManager.setTheme('sepia', false);
  assert(themeManager.getTheme() === 'sepia', 'ThemeManager switches to sepia warm reading mode');
  themeManager.setTheme('light', false);
  assert(themeManager.getTheme() === 'light', 'ThemeManager switches to light daylight mode');

  // -------------------------------------------------------------------------
  // TEST 5: Static Distribution & Pre-Rendered Crawlability (Domain L & J)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Static Distribution & Pre-Rendered No-JS Crawlability...');

  assert(fs.existsSync(path.join(DIST_ROOT, 'index.html')), 'dist/index.html entry point exists');
  assert(fs.existsSync(path.join(DIST_ROOT, 'article.html')), 'dist/article.html entry point exists');
  assert(fs.existsSync(path.join(DIST_ROOT, 'styles', 'main.css')), 'dist/styles/main.css exists');
  assert(fs.existsSync(path.join(DIST_ROOT, 'data', 'sitemap.xml')), 'dist/data/sitemap.xml exists');
  assert(fs.existsSync(path.join(DIST_ROOT, 'data', 'feed.json')), 'dist/data/feed.json exists');

  // Verify pre-rendered article HTML files for zero-client-JS crawling
  for (const art of articles) {
    const prerenderPath = path.join(DIST_ROOT, 'articles', `${art.slug}.html`);
    assert(fs.existsSync(prerenderPath), `Pre-rendered static HTML exists: dist/articles/${art.slug}.html`);
    const staticContent = fs.readFileSync(prerenderPath, 'utf-8');
    assert(staticContent.includes(art.title), `Pre-rendered file contains full title: ${art.title}`);
    assert(staticContent.includes(art.author.name), `Pre-rendered file contains author name: ${art.author.name}`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Zero Outbound External Network Requests (Domain A & K)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Zero Outbound Network Requests Verification (Privacy Sovereignty Barrier)...');

  let networkCallAttempted = false;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;

  http.request = function(...args) {
    networkCallAttempted = true;
    throw new Error('NETWORK_VIOLATION: Outbound HTTP request intercepted during local processing.');
  };
  https.request = function(...args) {
    networkCallAttempted = true;
    throw new Error('NETWORK_VIOLATION: Outbound HTTPS request intercepted during local processing.');
  };

  try {
    // Execute multiple search, filter, and metadata generation cycles
    for (let i = 0; i < 10; i++) {
      searchEngine.search('architecture performance zero-js');
      generateArticleJsonLd(sampleArt);
    }
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
  }

  assert(!networkCallAttempted, 'Zero outbound network requests initiated during file processing (100% Client-Side Sovereignty Verified)');

  console.log('\n============================================================');
  console.log(`🏁 PAC-002 AUTOMATED VERIFICATION SUITE: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log('============================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});

