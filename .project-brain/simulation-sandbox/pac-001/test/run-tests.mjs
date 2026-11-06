/**
 * PAC-001 Demonstrator Independent Automated Test Suite
 * 
 * Location: .project-brain/simulation-sandbox/pac-001/test/run-tests.mjs
 * Purpose: Verifies all functional, security, accessibility, performance,
 *          and privacy requirements for the SVG-to-WebP Converter.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

import { sanitizeSvg } from '../src/lib/svg-sanitizer.js';
import { convertSvgToWebp } from '../src/lib/converter-engine.js';
import { formatBytes } from '../src/lib/accessibility.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
  console.log('🧪 PAC-001 DEMONSTRATOR INDEPENDENT VERIFICATION SUITE');
  console.log('   Product: SVG-to-WebP Client-Side Converter');
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: SVG Sanitization & Security Barriers (Domain I)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] SVG Sanitization, Safe XML Parsing & Security Barriers...');

  // 1A: Clean valid SVG with viewBox
  const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
    <rect width="200" height="100" fill="#4f46e5"/>
    <circle cx="100" cy="50" r="40" fill="#ffffff"/>
  </svg>`;
  const resValid = sanitizeSvg(validSvg);
  assert(resValid.isValid === true, 'Valid SVG parses successfully');
  assert(resValid.width === 200 && resValid.height === 100, 'Dimensions correctly extracted (200x100)');
  assert(resValid.viewBox === '0 0 200 100', 'viewBox accurately extracted');

  // 1B: Malicious embedded script tag stripping
  const xssSvg = `<svg viewBox="0 0 100 100">
    <script>alert("XSS Payload")</script>
    <rect width="100" height="100" fill="red"/>
  </svg>`;
  const resXss = sanitizeSvg(xssSvg);
  assert(resXss.isValid === true, 'SVG with script parses with script stripped');
  assert(!resXss.sanitizedSvg.includes('<script>'), '<script> tag strictly stripped');
  assert(!resXss.sanitizedSvg.includes('alert('), 'Script payload content strictly purged');

  // 1C: Inline event handlers stripping
  const eventSvg = `<svg viewBox="0 0 100 100" onload="stealCookies()" onclick="maliciousClick()">
    <circle cx="50" cy="50" r="30" onerror="alert(1)"/>
  </svg>`;
  const resEvent = sanitizeSvg(eventSvg);
  assert(resEvent.isValid === true, 'SVG with event handlers parses with handlers stripped');
  assert(!resEvent.sanitizedSvg.includes('onload'), 'onload handler removed');
  assert(!resEvent.sanitizedSvg.includes('onclick'), 'onclick handler removed');
  assert(!resEvent.sanitizedSvg.includes('onerror'), 'onerror handler removed');

  // 1D: Javascript: pseudo-protocol URI stripping
  const jsUriSvg = `<svg viewBox="0 0 100 100">
    <a href="javascript:alert(1)"><text y="20">Click</text></a>
    <a xlink:href="javascript:doEvil()"><text y="40">Click2</text></a>
  </svg>`;
  const resJsUri = sanitizeSvg(jsUriSvg);
  assert(!resJsUri.sanitizedSvg.includes('javascript:'), 'javascript: URI stripped from href and xlink:href');

  // 1D-2: SMIL Animation Element Pruning (SEC-01)
  const smilSvg = `<svg viewBox="0 0 100 100">
    <set attributeName="href" to="javascript:alert(1)"/>
    <animate attributeName="xlink:href" values="javascript:alert(2)"/>
    <animateTransform attributeName="transform" type="rotate" from="0" to="360"/>
    <animateMotion path="M10,20 C30,40 50,60 70,80"/>
    <discard begin="5s"/>
    <circle cx="50" cy="50" r="20"/>
  </svg>`;
  const resSmil = sanitizeSvg(smilSvg);
  assert(resSmil.isValid === true, 'SVG with SMIL animation parses safely');
  assert(!resSmil.sanitizedSvg.includes('<set'), '<set> SMIL tag stripped');
  assert(!resSmil.sanitizedSvg.includes('<animate'), '<animate> SMIL tag stripped');
  assert(!resSmil.sanitizedSvg.includes('<animateTransform'), '<animateTransform> SMIL tag stripped');
  assert(!resSmil.sanitizedSvg.includes('<animateMotion'), '<animateMotion> SMIL tag stripped');
  assert(!resSmil.sanitizedSvg.includes('<discard'), '<discard> SMIL tag stripped');

  // 1D-3: Nested SVG Data URI and External Resource Stripping (SEC-03)
  const nestedUriSvg = `<svg viewBox="0 0 100 100">
    <image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" width="50" height="50"/>
    <image xlink:href="data:text/html;base64,PGh0bWw+PC9odG1sPg==" width="50" height="50"/>
    <image href="https://evil-tracker.example/beacon.png" width="50" height="50"/>
  </svg>`;
  const resNested = sanitizeSvg(nestedUriSvg);
  assert(resNested.isValid === true, 'Nested SVG data URI payload parses safely');
  assert(!resNested.sanitizedSvg.includes('data:image/svg'), 'data:image/svg nested vector URI stripped');
  assert(!resNested.sanitizedSvg.includes('data:text/html'), 'data:text/html URI stripped');
  assert(!resNested.sanitizedSvg.includes('evil-tracker.example'), 'External tracker HTTP/HTTPS URI stripped');

  // 1D-4: Linear-Time ReDoS Immunity Verification (SEC-02)
  const redosPayload = '<svg viewBox="0 0 100 100">' + ' '.repeat(5 * 1024 * 1024 - 100) + ' onload="evil()"></svg>';
  const t0 = performance.now();
  const resRedos = sanitizeSvg(redosPayload);
  const redosDuration = performance.now() - t0;
  assert(resRedos.isValid === true, '5MB whitespace SVG successfully sanitized');
  assert(!resRedos.sanitizedSvg.includes('onload'), 'Trailing onload stripped in 5MB whitespace payload');
  assert(redosDuration < 200, `ReDoS immunity verified: 5MB scan completed in ${redosDuration.toFixed(2)}ms (< 200ms)`);

  // 1E: XML Entity Expansion / XXE attack rejection
  const xxeSvg = `<?xml version="1.0"?>
  <!DOCTYPE lolz [
   <!ENTITY lol "lol">
   <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  ]>
  <svg viewBox="0 0 100 100"><text>&lol2;</text></svg>`;
  const resXxe = sanitizeSvg(xxeSvg);
  assert(resXxe.isValid === false, 'XXE entity expansion rejected fail-closed');
  assert(resXxe.error.includes('SECURITY_VIOLATION'), 'Error code specifies SECURITY_VIOLATION');

  // 1F: Empty input handling
  const resEmpty = sanitizeSvg('');
  assert(resEmpty.isValid === false && resEmpty.error.includes('EMPTY_INPUT'), 'Empty SVG string rejected with EMPTY_INPUT');

  // 1G: Malformed non-SVG input handling
  const resMalformed = sanitizeSvg('<html><body>Not an SVG file</body></html>');
  assert(resMalformed.isValid === false && resMalformed.error.includes('MALFORMED_SVG'), 'Non-SVG text rejected with MALFORMED_SVG');

  // 1H: Oversized input rejection (>5MB)
  const hugeSvg = '<svg viewBox="0 0 100 100">' + ' '.repeat(5 * 1024 * 1024 + 10) + '</svg>';
  const resOversized = sanitizeSvg(hugeSvg);
  assert(resOversized.isValid === false && resOversized.error.includes('OVERSIZED_INPUT'), 'Oversized input (>5MB) rejected fail-closed');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Core Conversion Engine & Quality Control (Domain H)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Core Conversion Engine, Quality Control & Dimension Scaling...');

  // 2A: Standard conversion 1x
  const convResult1x = await convertSvgToWebp(resValid.sanitizedSvg, { quality: 0.85, scale: 1.0 });
  assert(convResult1x.width === 200 && convResult1x.height === 100, 'Converted 1x dimensions match base SVG (200x100)');
  assert(convResult1x.sizeBytes > 0, `Output WebP generated with non-zero size (${convResult1x.sizeBytes} bytes)`);
  assert(Buffer.isBuffer(convResult1x.blob), 'Output payload is a valid byte container');

  // 2B: High-DPI Scaling (2x and 4x)
  const convResult2x = await convertSvgToWebp(resValid.sanitizedSvg, { scale: 2.0 });
  assert(convResult2x.width === 400 && convResult2x.height === 200, '2x resolution scaling produces 400x200 canvas');

  const convResult4x = await convertSvgToWebp(resValid.sanitizedSvg, { scale: 4.0 });
  assert(convResult4x.width === 800 && convResult4x.height === 400, '4x resolution scaling produces 800x400 canvas');

  // 2C: Container Format Validation (RIFF and WEBP signatures)
  const isRiffHeader = convResult1x.blob.slice(0, 4).toString('ascii') === 'RIFF';
  const isWebpHeader = convResult1x.blob.slice(8, 12).toString('ascii') === 'WEBP';
  assert(isRiffHeader, 'Container starts with RIFF identifier');
  assert(isWebpHeader, 'Container includes WEBP format identifier');

  // 2D: Resource Cleanup Callback
  let cleanupThrew = false;
  try {
    convResult1x.cleanup();
  } catch (err) {
    cleanupThrew = true;
  }
  assert(!cleanupThrew, 'Resource cleanup callback executes cleanly without error');

  // -------------------------------------------------------------------------
  // TEST SUITE 3: Zero Outbound Network Requests Verification (Domain K & A)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Zero Outbound Network Requests Verification (Privacy Sovereignty Barrier)...');

  let networkCallAttempted = false;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;

  // Intercept any outbound network calls
  http.request = function(...args) {
    networkCallAttempted = true;
    throw new Error('NETWORK_VIOLATION: Outbound HTTP request intercepted during client-side processing.');
  };
  https.request = function(...args) {
    networkCallAttempted = true;
    throw new Error('NETWORK_VIOLATION: Outbound HTTPS request intercepted during client-side processing.');
  };

  try {
    // Execute multiple full sanitization and conversion cycles
    for (let i = 0; i < 5; i++) {
      const sanitized = sanitizeSvg(validSvg);
      await convertSvgToWebp(sanitized.sanitizedSvg, { quality: 0.9, scale: 2.0 });
    }
  } finally {
    // Restore original request handlers
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
  }

  assert(!networkCallAttempted, 'Zero outbound network requests initiated during file processing (100% Client-Side Verified)');

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Accessibility & Helper Utilities (Domain E)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Accessibility & UI Helper Utilities...');

  assert(formatBytes(0) === '0 Bytes', 'formatBytes handles 0 bytes cleanly');
  assert(formatBytes(1024) === '1 KB', 'formatBytes formats 1024 as 1 KB');
  assert(formatBytes(1048576) === '1 MB', 'formatBytes formats 1048576 as 1 MB');
  assert(formatBytes(2560000) === '2.44 MB', 'formatBytes handles multi-megabyte fractional values (2.44 MB)');

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Static Distribution & HTML5 Entry Point (Domain L)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Static HTML5 Entry Point & Semantic Document Integrity...');

  const htmlPath = path.join(PROJECT_ROOT, 'src', 'index.html');
  assert(fs.existsSync(htmlPath), 'src/index.html entry point exists on disk');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert(htmlContent.includes('<main class="container">'), 'Document contains semantic <main> container');
  assert(htmlContent.includes('id="aria-live-announcer"'), 'Document contains ARIA live announcer element');
  assert(htmlContent.includes('role="button"'), 'Dropzone defines explicit button role');
  assert(htmlContent.includes('tabindex="0"'), 'Dropzone defines explicit keyboard tabindex="0"');
  assert(htmlContent.includes('id="quality-slider"'), 'Quality slider control exists with semantic ID');
  assert(htmlContent.includes('id="scale-select"'), 'Scale selector dropdown exists with semantic ID');
  assert(htmlContent.includes('application/ld+json'), 'Structured JSON-LD metadata schema present for SEO (Domain J)');

  const cssPath = path.join(PROJECT_ROOT, 'src', 'styles', 'main.css');
  assert(fs.existsSync(cssPath), 'src/styles/main.css design token layer exists on disk');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert(cssContent.includes(':root'), 'CSS file contains :root design tokens (Tailwind v4 compatible)');
  assert(cssContent.includes(':focus-visible'), 'CSS file contains focus-visible keyboard navigation ring rules');

  console.log('\n============================================================');
  console.log(`🏁 PAC-001 INDEPENDENT TEST SUITE: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log('============================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});

