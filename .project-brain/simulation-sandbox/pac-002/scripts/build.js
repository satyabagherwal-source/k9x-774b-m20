/**
 * Static Build & Distribution Packager
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/scripts/build.js
 * Domain Governance: Domain L (Deployment & Operations Intelligence)
 * Provenance: 11ty zero-JS static default performance & clean permalinks
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { getAllArticles, CATEGORIES } from '../src/lib/content-store.js';
import { generateXmlSitemap } from '../src/lib/seo-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');

console.log('============================================================');
console.log('🏗️  PAC-002 EDITORIAL PUBLICATION BUILD & PACKAGING PIPELINE');
console.log('   Product: The Sovereign Chronicle (Editorial Publication)');
console.log(`   Timestamp: ${new Date().toISOString()}`);
console.log('============================================================\n');

// 1. Mandatory Source Files Check
console.log('[1/5] 🔍 Verifying mandatory source files...');
const requiredFiles = [
  'src/index.html',
  'src/article.html',
  'src/styles/main.css',
  'src/lib/content-store.js',
  'src/lib/search-engine.js',
  'src/lib/router.js',
  'src/lib/seo-engine.js',
  'src/lib/accessibility.js',
  'src/lib/app.js',
  'src/data/robots.txt',
  'src/data/sitemap.xml',
  'src/data/feed.json'
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Build Failure: Missing source file ${relPath}`);
    process.exit(1);
  }
  console.log(`   ✅ Verified: ${relPath}`);
}

// 2. Syntax Verification
console.log('\n[2/5] 🧪 Checking JavaScript syntax across all source modules...');
const jsFiles = [
  'src/lib/content-store.js',
  'src/lib/search-engine.js',
  'src/lib/router.js',
  'src/lib/seo-engine.js',
  'src/lib/accessibility.js',
  'src/lib/app.js'
];

for (const jsFile of jsFiles) {
  const fullPath = path.join(PROJECT_ROOT, jsFile);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
    console.log(`   ✅ Syntax clean: ${jsFile}`);
  } catch (err) {
    console.error(`❌ Syntax Error in ${jsFile}: ${err.message}`);
    process.exit(1);
  }
}

// 3. Clean and Populate dist/
console.log('\n[3/5] 📦 Packaging distribution files to dist/...');
if (fs.existsSync(DIST_ROOT)) {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(path.join(DIST_ROOT, 'styles'), { recursive: true });
fs.mkdirSync(path.join(DIST_ROOT, 'lib'), { recursive: true });
fs.mkdirSync(path.join(DIST_ROOT, 'data'), { recursive: true });
fs.mkdirSync(path.join(DIST_ROOT, 'articles'), { recursive: true });

// Copy base HTML & CSS
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/index.html'), path.join(DIST_ROOT, 'index.html'));
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/article.html'), path.join(DIST_ROOT, 'article.html'));
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/styles/main.css'), path.join(DIST_ROOT, 'styles/main.css'));

// Copy JS Libs
for (const jsFile of jsFiles) {
  const baseName = path.basename(jsFile);
  fs.copyFileSync(path.join(PROJECT_ROOT, jsFile), path.join(DIST_ROOT, 'lib', baseName));
}

// Copy Data files
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/data/robots.txt'), path.join(DIST_ROOT, 'data/robots.txt'));
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/data/feed.json'), path.join(DIST_ROOT, 'data/feed.json'));

// Generate fresh Sitemap
const articles = getAllArticles();
const sitemapXml = generateXmlSitemap(articles, CATEGORIES);
fs.writeFileSync(path.join(DIST_ROOT, 'data/sitemap.xml'), sitemapXml, 'utf-8');
console.log(`   ✅ Generated XML sitemap with ${articles.length} articles and ${CATEGORIES.length} categories.`);

// 4. Pre-Render Static HTML for Each Article (11ty Zero-Client-JS Invariant)
console.log('\n[4/5] 📄 Generating pre-rendered static HTML article pages for no-JS crawlers...');
const articleTemplate = fs.readFileSync(path.join(PROJECT_ROOT, 'src/article.html'), 'utf-8');

for (const art of articles) {
  let staticHtml = articleTemplate;
  // Inject article title and description
  staticHtml = staticHtml.replace(/<title>.*?<\/title>/, `<title>${art.title} | The Sovereign Chronicle</title>`);
  staticHtml = staticHtml.replace(/content="Read full technical monograph.*?"/, `content="${art.excerpt}"`);
  
  // Pre-fill static article content for crawlers
  const prerenderedArticleBox = `
    <article class="longform-article">
      <header class="article-header">
        <span class="category-pill active">${art.categoryDetails?.name || art.category}</span>
        <h1 class="longform-title">${art.title}</h1>
        <p class="longform-lead">${art.excerpt}</p>
        <div class="article-byline">
          <div>By <strong>${art.author?.name}</strong> (${art.author?.role})</div>
          <div>Published: <time datetime="${art.publishedAt}">${art.publishedAt.split('T')[0]}</time></div>
        </div>
      </header>
      <div class="article-prose">
        <p>${art.excerpt}</p>
        <div style="background-color: var(--color-bg-subtle); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
          <p><em>Full interactive reading experience and typography enhancements available in browser client runtime.</em></p>
        </div>
      </div>
    </article>
  `;

  staticHtml = staticHtml.replace(
    /<div id="article-container">[\s\S]*?<\/div>/,
    `<div id="article-container">${prerenderedArticleBox}</div>`
  );

  const outFilePath = path.join(DIST_ROOT, 'articles', `${art.slug}.html`);
  fs.writeFileSync(outFilePath, staticHtml, 'utf-8');
  console.log(`   ✅ Pre-rendered: dist/articles/${art.slug}.html`);
}

// 5. Distribution Audit
console.log('\n[5/5] 🛡️ Auditing distribution package...');
const distHtml = fs.readFileSync(path.join(DIST_ROOT, 'index.html'), 'utf8');
if (!distHtml.includes('The Sovereign Chronicle') || !distHtml.includes('type="module"')) {
  console.error('❌ Distribution Error: index.html malformed or incomplete.');
  process.exit(1);
}
console.log('   ✅ Validated index.html entry point.');
const distCount = fs.readdirSync(DIST_ROOT, { recursive: true }).length;
console.log(`   ✅ Total distribution bundle size: ${distCount} items.`);

console.log('\n============================================================');
console.log('🏁 BUILD SUCCESS: Distribution package ready at dist/ (Exit Code: 0)');
console.log('============================================================\n');

