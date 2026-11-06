/**
 * PAC-002 Real Browser End-to-End Test Automation Suite
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/test/browser-e2e.mjs
 * Purpose: Repeatable, evidence-backed browser verification using Google Chrome
 *          via Chrome DevTools Protocol (CDP) over native WebSocket.
 * 
 * Tests the complete 14-step editorial publishing workflow in real Chrome.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const PORT = 8098;
const CDP_PORT = 9228;

const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function runBrowserE2E() {
  console.log('============================================================');
  console.log('🌐 PAC-002 REAL BROWSER END-TO-END AUTOMATED TEST SUITE');
  console.log('   Product: The Sovereign Chronicle (Editorial Publication)');
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('============================================================\n');

  const browserPath = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
  if (!browserPath) {
    console.log('⚠️ [BROWSER VERIFICATION]: NOT RUN (No local Chrome or Edge executable found).');
    process.exit(0);
  }
  console.log(`[DISCOVERY] Using browser executable: ${browserPath}`);

  // Create isolated temp user data directory
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pac002-chrome-'));

  // Start local static HTTP server serving dist/
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(DIST_DIR, reqPath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[LOCAL SERVER] Serving distribution on http://127.0.0.1:${PORT}`);

  // Launch headless browser with CDP
  const browserProc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempUserDataDir}`,
    '--disable-extensions',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:${PORT}/index.html`
  ]);

  // Give browser 2.5s to initialize CDP
  await new Promise(r => setTimeout(r, 2500));

  let pageWs = null;
  const capturedRequests = [];
  const uncaughtExceptions = [];

  try {
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      throw new Error('Failed to discover browser page tab via CDP.');
    }

    pageWs = new WebSocket(pageTab.webSocketDebuggerUrl);
    let msgId = 1;
    const callbacks = new Map();

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(res => { pageWs.onopen = res; });
    pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg.result);
      }
      if (msg.method === 'Network.requestWillBeSent') {
        capturedRequests.push(msg.params.request.url);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        uncaughtExceptions.push(msg.params.exceptionDetails);
      }
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- EXECUTING 14-POINT BROWSER END-TO-END SUITE ---');

    // 1. Initial Page Load & Identity Verification
    const loadCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          hasBrand: !!document.getElementById('brand-link'),
          hasSearch: !!document.getElementById('search-input'),
          hasPills: !!document.getElementById('category-pills'),
          hasGrid: !!document.getElementById('article-grid'),
          theme: document.documentElement.getAttribute('data-theme')
        };
      })()`,
      returnByValue: true
    });
    assert(loadCheck.result.value.title.includes('The Sovereign Chronicle'), 'Step 1: Application loaded with verified editorial HTML title');
    assert(loadCheck.result.value.hasBrand && loadCheck.result.value.hasSearch && loadCheck.result.value.hasGrid, 'Step 1: Core layout nodes (brand, search, grid) present in live DOM');

    // 2. Initial Article Cards Grid Verification
    const gridCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const cards = document.querySelectorAll('.article-card');
        return {
          cardCount: cards.length,
          firstTitle: cards[0]?.querySelector('.article-title')?.textContent.trim()
        };
      })()`,
      returnByValue: true
    });
    assert(gridCheck.result.value.cardCount === 5, 'Step 2: Homepage rendered all 5 technical monographs in the card grid');

    // 3. Tri-Theme Switching Test (Light, Sepia, Dark)
    const themeTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const sepiaBtn = document.querySelector('[data-theme-set="sepia"]');
        sepiaBtn.click();
        const sepiaTheme = document.documentElement.getAttribute('data-theme');

        const lightBtn = document.querySelector('[data-theme-set="light"]');
        lightBtn.click();
        const lightTheme = document.documentElement.getAttribute('data-theme');

        const darkBtn = document.querySelector('[data-theme-set="dark"]');
        darkBtn.click();
        const darkTheme = document.documentElement.getAttribute('data-theme');

        return { sepiaTheme, lightTheme, darkTheme };
      })()`,
      returnByValue: true
    });
    assert(themeTest.result.value.sepiaTheme === 'sepia', 'Step 3: Theme switched to Sepia warm reading mode');
    assert(themeTest.result.value.lightTheme === 'light', 'Step 3: Theme switched to Light daylight mode');
    assert(themeTest.result.value.darkTheme === 'dark', 'Step 3: Theme restored cleanly to Dark obsidian mode');

    // 4. Category Filtering Test
    const categoryFilterTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const pills = Array.from(document.querySelectorAll('.category-pill'));
        const systemsPill = pills.find(p => p.textContent.includes('Systems Engineering'));
        if (systemsPill) systemsPill.click();

        const cards = document.querySelectorAll('.article-card');
        return {
          cardCount: cards.length,
          allMatch: Array.from(cards).every(c => c.querySelector('.category-badge').textContent.includes('Systems Engineering'))
        };
      })()`,
      returnByValue: true
    });
    assert(categoryFilterTest.result.value.cardCount === 2, 'Step 4: Category filter isolated exactly 2 Systems Engineering monographs');
    assert(categoryFilterTest.result.value.allMatch, 'Step 4: All displayed cards verify matching category badge');

    // 5. Restore All Categories
    const restoreCategories = await send('Runtime.evaluate', {
      expression: `(() => {
        const allPill = document.querySelector('.category-pill');
        if (allPill) allPill.click();
        return { cardCount: document.querySelectorAll('.article-card').length };
      })()`,
      returnByValue: true
    });
    assert(restoreCategories.result.value.cardCount === 5, 'Step 5: Clicking "All Essays" restored full 5 monographs');

    // 6. Live In-Memory Search Test
    const searchTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        const input = document.getElementById('search-input');
        input.value = 'ReDoS';
        input.dispatchEvent(new Event('input'));

        await new Promise(r => setTimeout(r, 200));

        const cards = document.querySelectorAll('.article-card');
        const summary = document.getElementById('search-summary').textContent;
        return {
          cardCount: cards.length,
          topTitle: cards[0]?.querySelector('.article-title')?.textContent.trim(),
          summaryText: summary
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    assert(searchTest.result.value.cardCount === 1, 'Step 6: Live search for "ReDoS" filtered grid to exactly 1 article');
    assert(searchTest.result.value.topTitle.includes('Deterministic ReDoS Defense'), 'Step 6: Top match is the ReDoS monograph');
    assert(searchTest.result.value.summaryText.includes('Found 1 article'), 'Step 6: Search summary announced live match count');

    // 7. Clear Search Test
    const clearSearchTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const clearBtn = document.getElementById('clear-search-btn');
        clearBtn.click();
        return {
          cardCount: document.querySelectorAll('.article-card').length,
          inputValue: document.getElementById('search-input').value
        };
      })()`,
      returnByValue: true
    });
    assert(clearSearchTest.result.value.cardCount === 5 && clearSearchTest.result.value.inputValue === '', 'Step 7: Clear search button restored 5 cards and emptied input');

    // 8. Empty Search Result Handling
    const emptySearchTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        const input = document.getElementById('search-input');
        input.value = 'xyznonexistentgibberish';
        input.dispatchEvent(new Event('input'));

        await new Promise(r => setTimeout(r, 200));

        const emptyBox = document.querySelector('.empty-state');
        const resetBtn = document.getElementById('reset-search-btn');
        return {
          hasEmptyState: !!emptyBox,
          emptyTitle: emptyBox?.querySelector('.empty-title')?.textContent.trim(),
          hasResetBtn: !!resetBtn
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    assert(emptySearchTest.result.value.hasEmptyState, 'Step 8: Non-matching search displayed accessible Empty State');
    assert(emptySearchTest.result.value.emptyTitle === 'No Articles Found', 'Step 8: Empty state rendered clear explanatory title');

    // 9. Reset Search from Empty State
    await send('Runtime.evaluate', {
      expression: `(() => {
        const resetBtn = document.getElementById('reset-search-btn');
        if (resetBtn) resetBtn.click();
      })()`
    });

    // 10. Article Detail Navigation Test (Opening Full Long-Form Article)
    const openArticleTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        const targetCard = document.querySelector('[data-slug="fallacy-of-premature-hydration"]') || document.querySelector('.article-card');
        const targetSlug = targetCard.getAttribute('data-slug');
        targetCard.click();

        await new Promise(r => setTimeout(r, 300));

        const homeView = document.getElementById('home-view');
        const articleView = document.getElementById('article-view');
        const longformTitle = document.querySelector('.longform-title')?.textContent.trim();
        const authorName = document.querySelector('.byline-name')?.textContent.trim();
        const proseBody = document.getElementById('article-prose-body')?.innerHTML;
        const breadcrumbCurrent = document.querySelector('.breadcrumb-current')?.textContent.trim();

        return {
          homeHidden: homeView.classList.contains('hidden'),
          articleVisible: !articleView.classList.contains('hidden'),
          longformTitle,
          authorName,
          hasProse: !!proseBody && proseBody.length > 200,
          breadcrumbCurrent,
          url: window.location.href
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    assert(openArticleTest.result.value.homeHidden && openArticleTest.result.value.articleVisible, 'Step 10: Article navigation successfully transitioned views in browser DOM');
    assert(openArticleTest.result.value.longformTitle.includes('Premature Hydration'), 'Step 10: Full article title rendered with editorial hierarchy');
    assert(openArticleTest.result.value.authorName === 'Elena Rostova', 'Step 10: Correct author attribution rendered in byline');
    assert(openArticleTest.result.value.hasProse, 'Step 10: Complete technical prose body rendered with formatting');
    assert(openArticleTest.result.value.url.includes('slug=fallacy-of-premature-hydration'), 'Step 10: Browser URL updated with canonical article slug');

    // 11. Author Profile Box & Related Articles Verification
    const authorAndRelatedTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const authorBox = document.querySelector('.author-profile-box');
        const authorBio = authorBox?.querySelector('.author-bio-text')?.textContent.trim();
        const relatedSection = document.querySelector('.related-section');
        const relatedCards = document.querySelectorAll('.related-card');

        return {
          hasAuthorBox: !!authorBox,
          authorBioValid: !!authorBio && authorBio.length > 20,
          hasRelatedSection: !!relatedSection,
          relatedCount: relatedCards.length
        };
      })()`,
      returnByValue: true
    });
    assert(authorAndRelatedTest.result.value.hasAuthorBox && authorAndRelatedTest.result.value.authorBioValid, 'Step 11: Dedicated Author Profile box rendered with verified biography');
    assert(authorAndRelatedTest.result.value.hasRelatedSection && authorAndRelatedTest.result.value.relatedCount === 2, 'Step 11: Related Articles section rendered exactly 2 cross-referenced monographs');

    // 12. Reader Feedback / Rating Interaction (Domain M)
    const feedbackTest = await send('Runtime.evaluate', {
      expression: `(() => {
        const usefulBtn = document.querySelector('[data-vote="useful"]');
        if (usefulBtn) usefulBtn.click();
        const responseEl = document.getElementById('vote-response');
        return {
          responseVisible: !responseEl.classList.contains('hidden'),
          responseText: responseEl.textContent
        };
      })()`,
      returnByValue: true
    });
    assert(feedbackTest.result.value.responseVisible && feedbackTest.result.value.responseText.includes('Invaluable Insight'), 'Step 12: Reader feedback widget accepted vote and rendered confirmation');

    // 13. Newsletter Demonstration Submission (Domain B & C)
    const newsletterTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        // Return to home first
        const backBtn = document.querySelector('[data-nav-home="true"]');
        if (backBtn) backBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const form = document.getElementById('newsletter-form');
        const input = document.getElementById('newsletter-email');
        input.value = 'architect@sovereign-systems.internal';
        form.dispatchEvent(new Event('submit'));

        const msg = document.getElementById('newsletter-msg');
        return {
          msgVisible: !msg.classList.contains('hidden'),
          msgText: msg.textContent
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    assert(newsletterTest.result.value.msgVisible && newsletterTest.result.value.msgText.includes('[DEMONSTRATION]'), 'Step 13: Newsletter form processed in local memory and clearly flagged [DEMONSTRATION]');

    // 14. Zero Outbound External Network Requests
    console.log(`\n[NETWORK AUDIT] Captured ${capturedRequests.length} browser HTTP/HTTPS network requests.`);
    const externalRequests = capturedRequests.filter(url => {
      return !url.startsWith(`http://127.0.0.1:${PORT}`) && !url.startsWith('blob:') && !url.startsWith('data:');
    });
    assert(externalRequests.length === 0, 'Step 14: ZERO external network requests emitted during complete 14-step workflow (100% Privacy Sovereignty Verified)');

    console.log('\n============================================================');
    console.log(`🏁 REAL BROWSER E2E TEST RESULTS: ${totalPassed} PASSED | ${totalFailed} FAILED`);
    console.log('============================================================\n');

    pageWs.close();
  } catch (err) {
    console.error('Fatal Browser E2E Suite Error:', err);
    totalFailed++;
  } finally {
    browserProc.kill();
    server.close();
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch (_) { }
  }

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runBrowserE2E();
