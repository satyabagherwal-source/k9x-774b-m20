/**
 * Stage D.4 Secret Sanitizer & Redaction Engine
 * 
 * Scans objects, strings, arrays, and error traces to ensure no sensitive credentials,
 * API keys, or authorization tokens are persisted to shadow traces or logs.
 */

const REDACTION_PATTERNS = [
  // GitHub PATs and OAuth tokens
  { pattern: /ghp_[A-Za-z0-9_]{36,255}/g, replacement: '[REDACTED_GITHUB_PAT]' },
  { pattern: /gho_[A-Za-z0-9_]{36,255}/g, replacement: '[REDACTED_GITHUB_OAUTH]' },
  { pattern: /github_pat_[A-Za-z0-9_]{22,255}/g, replacement: '[REDACTED_GITHUB_PAT_FINE_GRAINED]' },

  // Hugging Face Tokens
  { pattern: /hf_[A-Za-z0-9]{34,255}/g, replacement: '[REDACTED_HF_TOKEN]' },

  // Google API Keys
  { pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, replacement: '[REDACTED_GOOGLE_API_KEY]' },

  // Bearer tokens in headers
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },

  // Private Keys (RSA, EC, OpenSSH, PGP)
  { pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },

  // AWS Access Keys
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_ACCESS_KEY]' }
];

const SENSITIVE_KEY_NAMES = new Set([
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'secret',
  'client_secret',
  'password',
  'authorization',
  'auth',
  'privatekey',
  'private_key'
]);

export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  let sanitized = str;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function sanitizeData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeString(data.message),
      stack: sanitizeString(data.stack || '')
    };
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
        cleaned[key] = '[REDACTED_SENSITIVE_FIELD]';
      } else {
        cleaned[key] = sanitizeData(value);
      }
    }
    return cleaned;
  }

  return data;
}

