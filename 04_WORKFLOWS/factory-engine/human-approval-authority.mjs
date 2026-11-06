/**
 * HUMAN APPROVAL AUTHORITY & ASYMMETRIC ED25519 VERIFICATION
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\human-approval-authority.mjs
 * Purpose: Enforces genuine, independently verifiable cryptographic human authorization
 *          for canonical knowledge promotion in high-impact domains:
 *          - Domain A: Human Need & Intent
 *          - Domain G: Architecture & Structural Boundaries
 *          - Domain M: Governance, Feedback & Evolution Invariants
 * 
 * Specifications: PAB-001, PAB-002, PAB-003
 * Authority: AI-Builder-Brain Governance Protocol
 * 
 * Invariants:
 * 1. Asymmetric Cryptography: The Brain possesses ONLY the human public key (Ed25519).
 *    The Brain runtime NEVER possesses, generates, or exports the private signing key.
 * 2. Automated Signing Elimination: There is zero automated signing capability in this module.
 *    Only the out-of-band human signer CLI (13_GOVERNANCE/human-signer/) possesses the private key.
 * 3. Final Persistence Authority: Direct calls to storage without a valid human token fail closed.
 * 4. Safe Concurrency: Stale locks are broken ONLY when the owning PID is confirmed dead.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// High-Impact Domains requiring mandatory cryptographic human authorization
export const HIGH_IMPACT_DOMAINS = ['A', 'G', 'M'];

// Default token validity: 24 hours (86,400 seconds)
export const DEFAULT_TOKEN_VALIDITY_SECONDS = 86400;

/**
 * Resolves the trusted Human Authority Ed25519 Public Key.
 * Read-only public verification key: safe to store on disk or in environment.
 */
export function getHumanAuthorityPublicKey(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const pubKeyPath = path.join(root, '.project-brain', 'human-authority-ed25519.pub');
  if (fs.existsSync(pubKeyPath)) {
    try {
      const stored = fs.readFileSync(pubKeyPath, 'utf8').trim();
      if (stored && stored.includes('PUBLIC KEY')) {
        return stored;
      }
    } catch (e) {}
  }

  if (process.env.AI_BUILDER_BRAIN_HUMAN_PUBLIC_KEY) {
    const envKey = process.env.AI_BUILDER_BRAIN_HUMAN_PUBLIC_KEY.trim();
    if (envKey.includes('PUBLIC KEY')) {
      return envKey;
    }
  }

  return null;
}

/**
 * Computes canonical subject payload string for Ed25519 signing and verification.
 * Format: candidate_id|content_hash|domain_letter|human_operator_id|approval_timestamp|expires_at|nonce
 */
export function computeApprovalCanonicalPayload(params) {
  const candidateId = String(params.candidate_id || '').trim();
  const contentHash = String(params.content_hash || '').trim();
  const domainLetter = String(params.domain_letter || '').trim().toUpperCase();
  const operatorId = String(params.human_operator_id || '').trim();
  const timestamp = String(params.approval_timestamp || '').trim();
  const expiresAt = String(params.expires_at || '').trim();
  const nonce = String(params.nonce || '').trim();

  return `${candidateId}|${contentHash}|${domainLetter}|${operatorId}|${timestamp}|${expiresAt}|${nonce}`;
}

/**
 * Path helper for the consumed nonce replay ledger.
 */
function getNonceLedgerPath(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const pbDir = path.join(root, '.project-brain');
  if (!fs.existsSync(pbDir)) fs.mkdirSync(pbDir, { recursive: true });
  return path.join(pbDir, 'consumed-approval-nonces.json');
}

/**
 * Loads the consumed nonces set.
 */
export function loadConsumedNonces(customRoot = null) {
  const ledgerPath = getNonceLedgerPath(customRoot);
  if (!fs.existsSync(ledgerPath)) return new Set();
  try {
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed.nonces) ? parsed.nonces : []);
  } catch (e) {
    return new Set();
  }
}

/**
 * Persists a consumed nonce atomically.
 */
export function recordConsumedNonce(nonce, customRoot = null) {
  const ledgerPath = getNonceLedgerPath(customRoot);
  const noncesSet = loadConsumedNonces(customRoot);
  noncesSet.add(nonce);

  const payload = {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    total_consumed: noncesSet.size,
    nonces: Array.from(noncesSet)
  };

  const tmpPath = `${ledgerPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  try {
    fs.renameSync(tmpPath, ledgerPath);
  } catch (err) {
    fs.copyFileSync(tmpPath, ledgerPath);
    try { fs.unlinkSync(tmpPath); } catch (e) {}
  }
}

/**
 * Verifies a Human Approval Token against the candidate record and human public key.
 * Enforces:
 * 1. Well-formed token structure.
 * 2. Exact domain matching.
 * 3. Exact content hash binding.
 * 4. Token expiration barrier.
 * 5. Replay protection (consumed nonces ledger).
 * 6. Asymmetric Ed25519 signature verification against human public key.
 */
export function verifyHumanApprovalToken(recordOrCandidate, token, customRoot = null, options = {}) {
  if (!token || typeof token !== 'object') {
    return {
      valid: false,
      code: 'TOKEN_MISSING_OR_MALFORMED',
      reason: 'Human approval token is missing or not an object.'
    };
  }

  // 1. Mandatory Fields Inspection
  const requiredFields = ['candidate_id', 'content_hash', 'domain_letter', 'human_operator_id', 'approval_timestamp', 'expires_at', 'nonce', 'signature'];
  for (const field of requiredFields) {
    if (!token[field] || typeof token[field] !== 'string') {
      return {
        valid: false,
        code: 'TOKEN_FIELD_MISSING',
        reason: `Human approval token missing required field: ${field}`
      };
    }
  }

  // 2. Domain Binding
  const recordDomain = String(
    recordOrCandidate.domain_letter || recordOrCandidate.primary_domain?.letter || ''
  ).trim().toUpperCase();
  const tokenDomain = String(token.domain_letter).trim().toUpperCase();

  if (recordDomain && tokenDomain !== recordDomain) {
    return {
      valid: false,
      code: 'DOMAIN_MISMATCH',
      reason: `Token domain (${tokenDomain}) does not match candidate domain (${recordDomain}).`
    };
  }

  // 3. Content Hash Binding
  let recordContentHash = recordOrCandidate.content_hash;
  if (!recordContentHash) {
    const substantive = recordOrCandidate.universal_invariant || recordOrCandidate.content || '';
    recordContentHash = crypto.createHash('sha256').update(substantive).digest('hex');
  }

  if (token.content_hash !== recordContentHash) {
    return {
      valid: false,
      code: 'CONTENT_HASH_MISMATCH',
      reason: `Token content hash (${token.content_hash}) does not match candidate content hash (${recordContentHash}). Tampering detected.`
    };
  }

  // 4. Expiration Barrier
  const now = Date.now();
  const expiryTime = Date.parse(token.expires_at);
  if (isNaN(expiryTime) || now > expiryTime) {
    return {
      valid: false,
      code: 'TOKEN_EXPIRED',
      reason: `Human approval token expired at ${token.expires_at} (current time: ${new Date(now).toISOString()}).`
    };
  }

  // 5. Replay Attack Barrier
  const consumedNonces = loadConsumedNonces(customRoot);
  if (consumedNonces.has(token.nonce)) {
    return {
      valid: false,
      code: 'REPLAY_ATTACK_DETECTED',
      reason: `Nonce (${token.nonce}) has already been consumed. Replay attack blocked.`
    };
  }

  // 6. Asymmetric Ed25519 Cryptographic Signature Barrier
  const publicKeyPem = options.publicKeyOverride || getHumanAuthorityPublicKey(customRoot);
  if (!publicKeyPem) {
    return {
      valid: false,
      code: 'HUMAN_PUBLIC_KEY_UNAVAILABLE',
      reason: 'Human authority Ed25519 public key not configured in .project-brain/human-authority-ed25519.pub or environment.'
    };
  }

  const canonicalPayload = computeApprovalCanonicalPayload(token);
  const payloadBuf = Buffer.from(canonicalPayload, 'utf8');

  try {
    const signatureBuf = Buffer.from(String(token.signature).trim(), 'hex');
    const isVerified = crypto.verify(null, payloadBuf, publicKeyPem, signatureBuf);

    if (!isVerified) {
      return {
        valid: false,
        code: 'SIGNATURE_INVALID',
        reason: 'Cryptographic Ed25519 signature verification failed. Forged, mismatched, or corrupted signature.'
      };
    }
  } catch (err) {
    return {
      valid: false,
      code: 'SIGNATURE_INVALID',
      reason: `Cryptographic verification error: ${err.message}`
    };
  }

  // If consumeNonce is explicitly true, mark the nonce as consumed immediately
  if (options.consumeNonce === true) {
    recordConsumedNonce(token.nonce, customRoot);
  }

  return {
    valid: true,
    code: 'APPROVAL_VERIFIED',
    human_operator_id: token.human_operator_id,
    approval_timestamp: token.approval_timestamp,
    nonce: token.nonce,
    domain_letter: token.domain_letter
  };
}

/**
 * Records verified human approval event in durable audit ledger.
 */
export function recordHumanApprovalAudit(entry, customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const auditPath = path.join(root, '11_INBOX', 'human-approval-audit-ledger.json');
  let ledger = { version: '1.0.0', last_updated: new Date().toISOString(), total_approvals: 0, approvals: [] };

  try {
    if (fs.existsSync(auditPath)) {
      ledger = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }
  } catch (e) {}

  const auditRecord = {
    approval_id: `APPR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    candidate_id: entry.candidate_id,
    record_id: entry.record_id,
    domain_letter: entry.domain_letter,
    human_operator_id: entry.human_operator_id,
    content_hash: entry.content_hash,
    approval_timestamp: entry.approval_timestamp,
    verified_at: new Date().toISOString(),
    signature_fingerprint: crypto.createHash('sha256').update(entry.signature || '').digest('hex').slice(0, 16),
    nonce: entry.nonce,
    promotion_result: entry.promotion_result || 'CANONICAL_PERSISTED'
  };

  ledger.approvals.push(auditRecord);
  ledger.total_approvals = ledger.approvals.length;
  ledger.last_updated = new Date().toISOString();

  const tmpPath = `${auditPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2), 'utf8');
  try {
    fs.renameSync(tmpPath, auditPath);
  } catch (err) {
    fs.copyFileSync(tmpPath, auditPath);
    try { fs.unlinkSync(tmpPath); } catch (e) {}
  }

  return auditRecord;
}

// ---------------------------------------------------------------------------
// Concurrency & Mutex Lock Infrastructure with Process Liveness Checking
// ---------------------------------------------------------------------------

/**
 * Checks whether a process PID is currently alive on the host operating system.
 */
export function isProcessPidAlive(pid) {
  if (!pid || typeof pid !== 'number' || pid <= 0) return false;
  try {
    // In Node.js, process.kill(pid, 0) tests process existence without terminating it
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH indicates process does not exist
    return false;
  }
}

/**
 * Acquires exclusive atomic file lock for domain registry writes.
 * Defends against concurrent process race conditions and lost updates.
 * Implements PID liveness verification: a lock held by a live process is NEVER stolen,
 * preventing race conditions on slow disks or CPU pauses.
 */
export function acquireRegistryLock(customRoot = null, options = {}) {
  const root = customRoot || BRAIN_ROOT;
  const pbDir = path.join(root, '.project-brain');
  if (!fs.existsSync(pbDir)) fs.mkdirSync(pbDir, { recursive: true });

  const lockFile = path.join(pbDir, 'domain-registry.lock');
  const timeoutMs = options.timeoutMs || 4000;
  const staleMs = options.staleMs || 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Atomic creation using 'wx' flag
      const fd = fs.openSync(lockFile, 'wx');
      const payload = JSON.stringify({
        pid: process.pid,
        acquired_at: new Date().toISOString(),
        host: process.env.COMPUTERNAME || 'localhost'
      });
      fs.writeSync(fd, payload);
      fs.closeSync(fd);
      return { acquired: true, lockFile };
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Probe lock staleness and PID liveness
        try {
          const stats = fs.statSync(lockFile);
          const raw = fs.readFileSync(lockFile, 'utf8');
          let lockOwnerPid = null;
          try {
            const parsed = JSON.parse(raw);
            lockOwnerPid = parsed.pid;
          } catch (pErr) {}

          const isOwnerAlive = isProcessPidAlive(lockOwnerPid);

          // If the lock owner process is STILL RUNNING, the lock is active. NEVER steal it!
          if (!isOwnerAlive && (Date.now() - stats.mtimeMs > staleMs)) {
            // Owner is confirmed dead AND lock duration exceeded staleMs -> safely break orphaned lock
            try { fs.unlinkSync(lockFile); } catch (uErr) {}
            continue;
          }
        } catch (sErr) {}

        // Sleep synchronously briefly before retry
        const sleepUntil = Date.now() + 40;
        while (Date.now() < sleepUntil) {}
      } else {
        throw err;
      }
    }
  }

  throw new Error(`REGISTRY_LOCK_TIMEOUT: Failed to acquire domain-registry.lock within ${timeoutMs}ms.`);
}

/**
 * Releases domain registry lock.
 */
export function releaseRegistryLock(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const lockFile = path.join(root, '.project-brain', 'domain-registry.lock');
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (err) {}
}
