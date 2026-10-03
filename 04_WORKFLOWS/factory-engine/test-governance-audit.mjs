import path from 'path';
import { fileURLToPath } from 'url';
import { classifyAndSanitizeOutboundPayload } from './ai-provider-pool.mjs';
import { validateRuleCandidate } from './gemini-brain-agent.mjs';
import { inspectMasterBrain, resolveMasterBrainPath } from './brain-bridge.mjs';
import { parseSourceUrl } from './zero-clone-harvester.mjs';
import { checkServiceAvailability, MASTER_SERVICES } from './master-circuit-breaker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 AI-BUILDER-BRAIN MULTI-AI GOVERNANCE & ARCHITECTURE VERIFICATION');
console.log('======================================================================\n');

let allPassed = true;

// Test 1: Brain Bridge & 16 Locked Master Folders
try {
  const brainPath = resolveMasterBrainPath();
  const inspection = inspectMasterBrain(brainPath);
  if (!inspection.connected || !inspection.allFoldersPresent) {
    throw new Error(`Master Brain inspection failed: present ${inspection.presentFolders}/${inspection.totalFolders}`);
  }
  console.log(`✅ [TEST 1 PASS] Master Brain Bridge verified connected with all ${inspection.totalFolders} canonical folders intact.`);
} catch (e) {
  console.error(`❌ [TEST 1 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 2: Outbound Data Classification & Confidential Credential Guard
try {
  const secretPayload = 'Authorization: Bearer sk-proj-1234567890abcdef1234567890abcdef';
  try {
    classifyAndSanitizeOutboundPayload(secretPayload, '');
    throw new Error('Confidential secret failed to trigger egress block!');
  } catch (err) {
    if (err.message.includes('DATA GOVERNANCE EGRESS BLOCK')) {
      console.log(`✅ [TEST 2 PASS] Confidential secrets are hard-blocked from outbound transmission: ${err.message.slice(0, 75)}...`);
    } else {
      throw err;
    }
  }
} catch (e) {
  console.error(`❌ [TEST 2 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 3: SENSITIVE PII Developer Email Scrubbing
try {
  const piiPayload = 'Commit by Alice <alice@example.com> and Signed-off-by: Bob <bob.developer@gmail.com>';
  const sanitized = classifyAndSanitizeOutboundPayload(piiPayload, 'Initial prompt');
  if (sanitized.prompt.includes('@example.com') || sanitized.prompt.includes('@gmail.com') || !sanitized.prompt.includes('[REDACTED_EMAIL]')) {
    throw new Error('PII scrubbing failed to mask email addresses!');
  }
  console.log(`✅ [TEST 3 PASS] PII email scrubbing verified: "${sanitized.prompt}"`);
} catch (e) {
  console.error(`❌ [TEST 3 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 4: Anti-Distillation Governance Header Injection
try {
  const sanitized = classifyAndSanitizeOutboundPayload('Analyze this code', 'Base instruction');
  if (!sanitized.systemInstruction.includes('NON-DISTILLATION MANDATE') || !sanitized.systemInstruction.includes('NEVER used to train, fine-tune, or distill')) {
    throw new Error('Anti-distillation governance header missing from outbound prompt!');
  }
  console.log(`✅ [TEST 4 PASS] Mandatory Non-Distillation governance header injected into system instruction.`);
} catch (e) {
  console.error(`❌ [TEST 4 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 5: Rule Candidate Validation & Quality Gate
try {
  const sampleTitle = 'Atomic File Replacement Barrier';
  const sampleBody = [
    '**RULE**:',
    'Always write content to a sibling .tmp file before atomic renaming.',
    '**WHY**:',
    'Prevents readers from observing truncated files during concurrency crashes.',
    '**WHEN TO APPLY**:',
    'All filesystem write routines in backend node scripts.',
    '**VERIFIED IMPLEMENTATION PATTERN**:',
    '```javascript',
    'const temp = target + ".tmp";',
    'fs.writeFileSync(temp, data, "utf-8");',
    'fs.renameSync(temp, target);',
    '```',
    '**NEGATIVE CONSTRAINT**:',
    '```javascript',
    'fs.writeFileSync(target, data, "utf-8"); // Vulnerable to torn writes',
    '```',
    '**VERIFICATION METHOD**:',
    'Automated integration check with concurrent reader thread.'
  ].join('\n');

  const res = validateRuleCandidate(sampleTitle, sampleBody);
  if (!res.valid) {
    throw new Error(`Valid rule failed validation: ${res.reason}`);
  }
  console.log(`✅ [TEST 5 PASS] Rule candidate validation and quality gate functioning correctly.`);
} catch (e) {
  console.error(`❌ [TEST 5 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 6: Zero-Clone Harvester Source & License Parser
try {
  const target = parseSourceUrl('https://github.com/astral-sh/uv');
  if (!target || target.owner !== 'astral-sh' || target.repo !== 'uv' || target.slug !== 'astral-sh-uv') {
    throw new Error('Source URL parser returned invalid target structure!');
  }
  console.log(`✅ [TEST 6 PASS] Source discovery and target normalization verified (${target.slug}).`);
} catch (e) {
  console.error(`❌ [TEST 6 FAIL] ${e.message}`);
  allPassed = false;
}

// Test 7: Master Circuit Breaker Pre-Flight Check
try {
  const ghAvail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
  console.log(`✅ [TEST 7 PASS] Master Circuit Breaker availability check operational (GitHub API Status: ${ghAvail.status}).`);
} catch (e) {
  console.error(`❌ [TEST 7 FAIL] ${e.message}`);
  allPassed = false;
}

console.log('\n======================================================================');
if (allPassed) {
  console.log('🎉 ALL 7 GOVERNANCE & ARCHITECTURE VERIFICATION TESTS PASSED!');
} else {
  console.log('❌ SOME TESTS FAILED. Inspect error logs above.');
  process.exit(1);
}
console.log('======================================================================');
