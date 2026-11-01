/**
 * AI-Builder-Brain — Private Vault Authenticated Encryption Module
 * Standard: AES-256-GCM + PBKDF2-SHA512 (100,000 iterations)
 * Zero Plaintext Leakage Invariant
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits for AES-GCM
const SALT_LENGTH = 32; // 256 bits

/**
 * Resolves vault passphrase through a structured hierarchy:
 * 1. Explicit argument
 * 2. process.env.BRAIN_VAULT_PASSPHRASE
 * 3. Out-of-band file: %USERPROFILE%/.brain-vault-passphrase
 * 4. System default fallback key
 */
export function resolveVaultPassphrase(explicitPassphrase = null) {
  if (explicitPassphrase && typeof explicitPassphrase === 'string' && explicitPassphrase.trim().length > 0) {
    return explicitPassphrase.trim();
  }
  if (process.env.BRAIN_VAULT_PASSPHRASE && process.env.BRAIN_VAULT_PASSPHRASE.trim().length > 0) {
    return process.env.BRAIN_VAULT_PASSPHRASE.trim();
  }
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  if (homeDir) {
    const keyfilePath = path.join(homeDir, '.brain-vault-passphrase');
    if (fs.existsSync(keyfilePath)) {
      try {
        const fileContent = fs.readFileSync(keyfilePath, 'utf8').trim();
        if (fileContent.length > 0) return fileContent;
      } catch (_) {}
    }
  }
  return 'AI-Builder-Brain-Vault-Recovery-Key-2026';
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a PBKDF2-derived key.
 * @param {string} plaintext - Plaintext secrets (e.g. JSON string)
 * @param {string} passphrase - Encryption passphrase
 * @returns {object} Encrypted payload container
 */
export function encryptSecrets(plaintext, passphrase) {
  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length === 0) {
    throw new Error('[VAULT-CRYPTO-ERR] Passphrase must be a non-empty string');
  }
  if (typeof plaintext !== 'string') {
    throw new Error('[VAULT-CRYPTO-ERR] Plaintext must be a string');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    kdf: 'PBKDF2-SHA512',
    iterations: PBKDF2_ITERATIONS,
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextHex: ciphertext,
    createdAt: new Date().toISOString()
  };
}

/**
 * Decrypts an encrypted payload container using AES-256-GCM.
 * @param {object} payload - Encrypted payload container
 * @param {string} passphrase - Decryption passphrase
 * @returns {string} Decrypted plaintext
 */
export function decryptSecrets(payload, passphrase) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[VAULT-CRYPTO-ERR] Invalid encrypted payload structure');
  }
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('[VAULT-CRYPTO-ERR] Passphrase must be provided');
  }
  if (payload.algorithm !== 'aes-256-gcm') {
    throw new Error(`[VAULT-CRYPTO-ERR] Unsupported algorithm: ${payload.algorithm}`);
  }

  const salt = Buffer.from(payload.saltHex, 'hex');
  const iv = Buffer.from(payload.ivHex, 'hex');
  const authTag = Buffer.from(payload.authTagHex, 'hex');
  const ciphertext = Buffer.from(payload.ciphertextHex, 'hex');

  const key = crypto.pbkdf2Sync(
    passphrase,
    salt,
    payload.iterations || PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error('[VAULT-CRYPTO-ERR] Authentication tag verification failed: incorrect passphrase or corrupted payload');
  }
}

/**
 * Encrypts a secrets file and writes to target file.
 */
export function encryptSecretsFile(sourceFilePath, targetEncryptedPath, passphrase) {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`[VAULT-CRYPTO-ERR] Source secrets file does not exist: ${sourceFilePath}`);
  }
  const plaintext = fs.readFileSync(sourceFilePath, 'utf8');
  const payload = encryptSecrets(plaintext, passphrase);
  fs.mkdirSync(path.dirname(targetEncryptedPath), { recursive: true });
  fs.writeFileSync(targetEncryptedPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

/**
 * Decrypts an encrypted payload file and writes to target file.
 */
export function decryptSecretsFile(sourceEncryptedPath, targetDecryptedPath, passphrase) {
  if (!fs.existsSync(sourceEncryptedPath)) {
    throw new Error(`[VAULT-CRYPTO-ERR] Encrypted file does not exist: ${sourceEncryptedPath}`);
  }
  const payload = JSON.parse(fs.readFileSync(sourceEncryptedPath, 'utf8'));
  const plaintext = decryptSecrets(payload, passphrase);
  fs.mkdirSync(path.dirname(targetDecryptedPath), { recursive: true });
  fs.writeFileSync(targetDecryptedPath, plaintext, 'utf8');
  return plaintext;
}

