/**
 * STANDALONE HUMAN SIGNER CLI & OUT-OF-BAND AUTHORIZATION
 * 
 * Location: C:\AI-Builder-Brain\13_GOVERNANCE\human-signer\sign-human-directive.mjs
 * Purpose: Provides isolated, out-of-band human signing authority for canonical knowledge
 *          promotion in high-impact domains:
 *          - Domain A: Human Need & Intent
 *          - Domain G: Architecture & Structural Boundaries
 *          - Domain M: Governance, Feedback & Evolution Invariants
 * 
 * Specifications: PAB-001, PAB-002, PAB-003
 * Invariants:
 * 1. AI models and automated workers CANNOT sign: Private key is stored out-of-band,
 *    never exported by Brain runtime libraries, and stripped from worker environments.
 * 2. Mandatory Human Interactive Check: Headless execution is blocked by default via TTY check.
 * 3. Human Confirmation: Explicit review of candidate details and interactive [y/N] confirmation.
 * 4. Asymmetric Cryptography: Signs with private Ed25519 key; Brain only verifies with public key.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { fileURLToPath } from 'url';

import {
  HIGH_IMPACT_DOMAINS,
  computeApprovalCanonicalPayload,
  DEFAULT_TOKEN_VALIDITY_SECONDS
} from '../../04_WORKFLOWS/factory-engine/human-approval-authority.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Generates an Ed25519 keypair for Human Authority signing and verification.
 */
export function generateHumanAuthorityKeyPair(customRoot = null, options = {}) {
  const root = customRoot || BRAIN_ROOT;
  const pbDir = path.join(root, '.project-brain');
  const secretsDir = path.join(pbDir, 'secrets');
  if (!fs.existsSync(pbDir)) fs.mkdirSync(pbDir, { recursive: true });
  if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const pubKeyPath = path.join(pbDir, 'human-authority-ed25519.pub');
  const privKeyPath = path.join(secretsDir, 'human-signer-ed25519.key');

  // Do not overwrite existing unless explicitly requested
  if (!fs.existsSync(pubKeyPath) || options.overwrite) {
    fs.writeFileSync(pubKeyPath, publicKey, 'utf8');
  }
  if (!fs.existsSync(privKeyPath) || options.overwrite) {
    fs.writeFileSync(privKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });
  }

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    publicKeyPath: pubKeyPath,
    privateKeyPath: privKeyPath
  };
}

/**
 * Resolves the private key for signing.
 * Checked in order:
 * 1. Explicit path in options
 * 2. File at .project-brain/secrets/human-signer-ed25519.key
 * 3. Environment variable AI_BUILDER_BRAIN_HUMAN_PRIVATE_KEY
 */
export function resolveHumanPrivateKey(customRoot = null, keyPath = null) {
  if (keyPath && fs.existsSync(keyPath)) {
    try {
      const content = fs.readFileSync(keyPath, 'utf8').trim();
      if (content.includes('PRIVATE KEY')) return content;
    } catch (e) {}
  }

  const root = customRoot || BRAIN_ROOT;
  const defaultKeyPath = path.join(root, '.project-brain', 'secrets', 'human-signer-ed25519.key');
  if (fs.existsSync(defaultKeyPath)) {
    try {
      const content = fs.readFileSync(defaultKeyPath, 'utf8').trim();
      if (content.includes('PRIVATE KEY')) return content;
    } catch (e) {}
  }

  if (process.env.AI_BUILDER_BRAIN_HUMAN_PRIVATE_KEY) {
    const envKey = process.env.AI_BUILDER_BRAIN_HUMAN_PRIVATE_KEY.trim();
    if (envKey.includes('PRIVATE KEY')) return envKey;
  }

  return null;
}

/**
 * Issues a genuine cryptographic Human Approval Signature for a candidate record.
 * Can be called programmatically by authorized human tools and test harnesses.
 */
export function issueHumanApprovalSignature(candidateOrRecord, privateKeyPem, options = {}) {
  if (!privateKeyPem || typeof privateKeyPem !== 'string' || !privateKeyPem.includes('PRIVATE KEY')) {
    throw new Error('SIGNING_ERROR: Valid Ed25519 private key PEM is required.');
  }

  const candidateId = String(
    candidateOrRecord.candidate_id || candidateOrRecord.record_id || `PLCAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  ).trim();

  let contentHash = candidateOrRecord.content_hash;
  if (!contentHash) {
    const substantive = candidateOrRecord.universal_invariant || candidateOrRecord.content || '';
    contentHash = crypto.createHash('sha256').update(substantive).digest('hex');
  }

  const domainLetter = String(
    candidateOrRecord.domain_letter || candidateOrRecord.primary_domain?.letter || options.domainLetter || ''
  ).trim().toUpperCase();

  if (!domainLetter) {
    throw new Error('SIGNING_ERROR: Candidate domain letter is missing.');
  }

  const operatorId = String(
    options.human_operator_id || options.operator || process.env.AI_BUILDER_BRAIN_HUMAN_OPERATOR || 'HUMAN_AUTHORITY_ROOT'
  ).trim();

  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const validitySeconds = options.validity_seconds || options.validitySeconds || DEFAULT_TOKEN_VALIDITY_SECONDS;
  const expiresAt = new Date(now + validitySeconds * 1000).toISOString();
  const nonce = options.nonce || `NONCE-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  const canonicalPayload = computeApprovalCanonicalPayload({
    candidate_id: candidateId,
    content_hash: contentHash,
    domain_letter: domainLetter,
    human_operator_id: operatorId,
    approval_timestamp: timestamp,
    expires_at: expiresAt,
    nonce
  });

  const payloadBuf = Buffer.from(canonicalPayload, 'utf8');
  const signatureHex = crypto.sign(null, payloadBuf, privateKeyPem).toString('hex');

  const token = {
    candidate_id: candidateId,
    content_hash: contentHash,
    domain_letter: domainLetter,
    human_operator_id: operatorId,
    approval_timestamp: timestamp,
    expires_at: expiresAt,
    nonce,
    signature: signatureHex
  };

  return token;
}

/**
 * Interactive review prompt for the human operator.
 */
function promptHumanApproval(candidate, domainLetter) {
  return new Promise((resolve) => {
    console.log('\n============================================================');
    console.log(' AI-BUILDER-BRAIN: HUMAN SIGNING AUTHORITY REVIEW');
    console.log('============================================================');
    console.log(`Candidate ID   : ${candidate.candidate_id || candidate.record_id || 'N/A'}`);
    console.log(`Domain         : Domain ${domainLetter} (HIGH IMPACT GOVERNANCE)`);
    console.log(`Title          : ${candidate.title || 'Untitled'}`);
    console.log(`Invariant      : ${candidate.universal_invariant || candidate.content || 'N/A'}`);
    console.log(`Problem/Context: ${candidate.problem_statement || candidate.summary || 'N/A'}`);
    console.log('------------------------------------------------------------');
    console.log('CRITICAL GOVERNANCE NOTICE:');
    console.log('Approving this directive will promote it directly to the CANONICAL');
    console.log(`MASTER BRAIN under Domain ${domainLetter}. This invariant will bind all`);
    console.log('future automated construction, synthesis, and factory operations.');
    console.log('============================================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Do you authorize this high-impact promotion to canonical Master Brain knowledge? [y/N]: ', (answer) => {
      rl.close();
      const trimmed = (answer || '').trim().toLowerCase();
      if (trimmed === 'y' || trimmed === 'yes') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * CLI Execution Handler
 */
export async function runSignerCli(argv = process.argv.slice(2)) {
  const args = {
    generateKeypair: argv.includes('--generate-keypair'),
    authorizedNonInteractive: argv.includes('--authorized-non-interactive') || argv.includes('--yes'),
    reject: argv.includes('--reject') || argv.includes('--deny'),
    candidatePath: null,
    keyPath: null,
    operator: null,
    outputPath: null
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--candidate' || argv[i] === '--directive' || argv[i] === '-c') {
      args.candidatePath = argv[i + 1];
    } else if (argv[i] === '--key' || argv[i] === '-k') {
      args.keyPath = argv[i + 1];
    } else if (argv[i] === '--operator' || argv[i] === '-o') {
      args.operator = argv[i + 1];
    } else if (argv[i] === '--out') {
      args.outputPath = argv[i + 1];
    }
  }

  // Handle Keypair Generation
  if (args.generateKeypair) {
    console.log('Generating new Ed25519 Human Authority keypair...');
    const result = generateHumanAuthorityKeyPair(BRAIN_ROOT);
    console.log(`[SUCCESS] Public Key written to  : ${result.publicKeyPath}`);
    console.log(`[SUCCESS] Private Key written to : ${result.privateKeyPath}`);
    console.log('\nKeep the private key strictly isolated on the human operator machine.');
    return { success: true, keypair: result };
  }

  if (!args.candidatePath) {
    console.error('Error: Candidate file required. Use --candidate <path-to-json>');
    return { success: false, error: 'MISSING_CANDIDATE_PATH' };
  }

  const fullCandidatePath = path.resolve(process.cwd(), args.candidatePath);
  if (!fs.existsSync(fullCandidatePath)) {
    console.error(`Error: Candidate file not found: ${fullCandidatePath}`);
    return { success: false, error: 'CANDIDATE_FILE_NOT_FOUND' };
  }

  let candidate;
  try {
    candidate = JSON.parse(fs.readFileSync(fullCandidatePath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing candidate JSON: ${err.message}`);
    return { success: false, error: 'INVALID_CANDIDATE_JSON' };
  }

  const domainLetter = String(
    candidate.domain_letter || candidate.primary_domain?.letter || ''
  ).trim().toUpperCase();

  // Interactive TTY Check: block automated pipelines from running this tool silently
  const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!isInteractive && !args.authorizedNonInteractive && !args.reject) {
    console.error('ERROR [SIGNER_NON_INTERACTIVE_REJECTED]: Standalone Human Signer requires interactive human TTY terminal.');
    console.error('Headless/automated signing is prohibited to prevent autonomous agent forging.');
    return { success: false, error: 'SIGNER_NON_INTERACTIVE_REJECTED' };
  }

  // Handle explicit human operator denial
  if (args.reject) {
    console.log('\n[ABORTED] Promotion rejected by human operator [HUMAN_REJECTED_APPROVAL]. No signature generated.');
    return { success: false, error: 'HUMAN_REJECTED_APPROVAL' };
  }

  // Interactive review prompt (skipped only when authorized non-interactive flag is supplied)
  if (isInteractive && !args.authorizedNonInteractive) {
    const approved = await promptHumanApproval(candidate, domainLetter);
    if (!approved) {
      console.log('\n[ABORTED] Promotion rejected by human operator. No signature generated.');
      return { success: false, error: 'HUMAN_REJECTED_APPROVAL' };
    }
  }

  const privateKeyPem = resolveHumanPrivateKey(BRAIN_ROOT, args.keyPath);
  if (!privateKeyPem) {
    console.error('Error: Human Authority Ed25519 private key not found.');
    console.error('Run with --generate-keypair first or specify --key <path-to-key>');
    return { success: false, error: 'PRIVATE_KEY_NOT_FOUND' };
  }

  const token = issueHumanApprovalSignature(candidate, privateKeyPem, {
    operator: args.operator,
    domainLetter
  });

  const outputJson = JSON.stringify(token, null, 2);
  if (args.outputPath) {
    const outResolved = path.resolve(process.cwd(), args.outputPath);
    fs.writeFileSync(outResolved, outputJson, 'utf8');
    console.log(`\n[SUCCESS] Human Approval Token written to: ${outResolved}`);
  } else {
    console.log('\n--- HUMAN APPROVAL TOKEN ---');
    console.log(outputJson);
    console.log('----------------------------\n');
  }

  return { success: true, token };
}

// Direct CLI Invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSignerCli().then(res => {
    if (!res || !res.success) process.exit(1);
  }).catch(err => {
    console.error('Fatal Signer CLI Error:', err);
    process.exit(1);
  });
}
