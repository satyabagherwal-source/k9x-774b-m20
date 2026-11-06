/**
 * Static Build & Distribution Packager
 * 
 * Location: .project-brain/simulation-sandbox/pac-001/scripts/build.js
 * Domain Governance: Domain L (Deployment & Operations)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');

console.log('============================================================');
console.log('🏗️  PAC-001 DEMONSTRATOR BUILD & DISTRIBUTION PIPELINE');
console.log('   Product: SVG to WebP Client-Side Converter');
console.log(`   Timestamp: ${new Date().toISOString()}`);
console.log('============================================================\n');

// 1. Mandatory Source Files Check
console.log('[1/4] 🔍 Verifying source files...');
const requiredFiles = [
  'src/index.html',
  'src/styles/main.css',
  'src/lib/svg-sanitizer.js',
  'src/lib/converter-engine.js',
  'src/lib/accessibility.js',
  'src/lib/app.js'
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
console.log('\n[2/4] 🧪 Checking JavaScript syntax across all source modules...');
const jsFiles = [
  'src/lib/svg-sanitizer.js',
  'src/lib/converter-engine.js',
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
console.log('\n[3/4] 📦 Packaging distribution files to dist/...');
if (fs.existsSync(DIST_ROOT)) {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(path.join(DIST_ROOT, 'styles'), { recursive: true });
fs.mkdirSync(path.join(DIST_ROOT, 'lib'), { recursive: true });

fs.copyFileSync(path.join(PROJECT_ROOT, 'src/index.html'), path.join(DIST_ROOT, 'index.html'));
fs.copyFileSync(path.join(PROJECT_ROOT, 'src/styles/main.css'), path.join(DIST_ROOT, 'styles/main.css'));

for (const jsFile of jsFiles) {
  const baseName = path.basename(jsFile);
  fs.copyFileSync(path.join(PROJECT_ROOT, jsFile), path.join(DIST_ROOT, 'lib', baseName));
}
console.log('   ✅ Copied clean static distribution bundle into dist/');

// 4. Distribution Integrity Audit
console.log('\n[4/4] 🛡️ Auditing distribution package...');
const distHtml = fs.readFileSync(path.join(DIST_ROOT, 'index.html'), 'utf8');
if (!distHtml.includes('SVG to WebP Converter') || !distHtml.includes('type="module"')) {
  console.error('❌ Distribution Error: index.html malformed or incomplete.');
  process.exit(1);
}
console.log('   ✅ Validated index.html entry point.');
console.log(`   ✅ Total distribution bundle size: ${fs.readdirSync(DIST_ROOT, { recursive: true }).length} items.`);

console.log('\n============================================================');
console.log('🏁 BUILD SUCCESS: Distribution package ready at dist/ (Exit Code: 0)');
console.log('============================================================\n');

