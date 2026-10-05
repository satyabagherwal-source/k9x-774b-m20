# Forensic Learning Record (Deep Inspection): InsForge/InsForge

> **Canonical Artifact**: `07_PROJECT_LEARNING/insforge-insforge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InsForge/InsForge](https://github.com/InsForge/InsForge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:50.510Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InsForge/InsForge`
- **Description**: The all-in-one, open-source backend platform for agentic coding. InsForge gives your coding agent database, auth, storage, compute, hosting, and AI gateway to ship full-stack apps end-to-end.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 13056 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/scripts/check-migration-duplicates.js`
```
/**
 * Detects migration files that share the same numeric prefix.
 *
 * node-pg-migrate orders migrations by their leading number, so two files with
 * the same prefix (e.g. `047_a.sql` and `047_b.sql`) have an ambiguous order and
 * can apply inconsistently across environments. This guard runs in CI (and as a
 * unit test) to stop new duplicates from landing on main.
 *
 * A small set of historical duplicates already exists on main and is grandfathered
 * in via ALLOWED_DUPLICATES — those are tolerated, anything new is rejected.
 *
 * Exports `findDuplicateMigrations()` for the test suite; runs as a CLI (exit 1 on
 * new duplicates) when executed directly.
 */
/* global console, process */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MIGRATIONS_DIR = join(__dirname, '..', 'src', 'infra', 'database', 'migrations');

// Pre-existing duplicate prefixes on main. Do not add to this list — fix the
// duplicate instead. These remain only because the migrations already shipped.
export const ALLOWED_DUPLICATES = new Set(['033', '047']);

const MIGRATION_FILE = /^(\d+)_.*\.sql$/;

/**
 * @param {string} [dir] migrations directory to scan
 * @returns {{ count: number, newDuplicates: Array<{prefix:string, files:string[]}>,
 *             grandfathered: Array<{prefix:string, files:string[]}>, nextPrefix: string }}
 */
export function findDuplicateMigrations(dir = MIGRATIONS_DIR) {
  const byPrefix = new Map();

  for (const name of readdirSync(dir)) {
    const match = MIGRATION_FILE.exec(name);
    if (!match) continue;
    const prefix = match[1];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(name);
  }

  const newDuplicates = [];
  const grandfathered = [];

  for (const [prefix, files] of byPrefix) {
    if (files.length < 2) continue;
    files.sort();
    (ALLOWED_DUPLICATES.has(prefix) ? grandfathered : newDuplicates).push({ prefix, files });
  }

  const maxPrefix = byPrefix.size
    ? Math.max(...[...byPrefix.keys()].map((p) => parseInt(p, 10)))
    : -1;

  return {
    count: byPrefix.size,
    newDuplicates,
    grandfathered,
    nextPrefix: String(maxPrefix + 1).padStart(3, '0'),
  };
}

function main() {
  const { count, newDuplicates, grandfathered, nextPrefix } = findDuplicateMigrations();

  if (grandfathered.length > 0) {
    console.log('Known (grandfathered) duplicate migration prefixes:');
    for (const { prefix, files } of grandfathered) {
      console.log(`  ${prefix}: ${files.join(', ')}`);
    }
  }

  if (newDuplicates.length > 0) {
    console.error('\nERROR: duplicate migration number(s) detected:');
    for (const { prefix, files } of newDuplicates) {
      console.error(`  ${prefix}: ${files.join(', ')}`);
    }
    console.error(
      `\nEach migration needs a unique number. Renumber the new file to the next ` +
        `available prefix (currently ${nextPrefix}_).`
    );
    process.exit(1);
  }

  console.log(`\nOK: ${count} unique migration number(s), no new duplicates.`);
}

// Run as a CLI only when executed directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

```

### Core Architecture Module: `backend/src/api/middlewares/auth.ts`
```
import { Request, Response, NextFunction } from 'express';
import { TokenManager } from '@/infra/security/token.manager.js';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES, type RoleSchema } from '@insforge/shared-schemas';
import { NEXT_ACTIONS } from '../../utils/next-actions.js';
import { SecretService } from '@/services/secrets/secret.service.js';
import jwt from 'jsonwebtoken';

export type UserContext = {
  /**
   * Always present at the API level: user UUID for authenticated, admin id
   * for project_admin, 'anonymous' for anon. Only the authenticated UUID is
   * a row-ownership identity; database boundaries (claims, owner columns)
   * gate on role === 'authenticated' so admin/anon labels never reach
   * uuid-typed claims or columns.
   */
  id: string;
  email?: string;
  role: RoleSchema;
};

export interface AuthRequest extends Request {
  user?: UserContext;
  authenticated?: boolean;
  hasApiKey?: boolean;
  projectId?: string;
}

const tokenManager = TokenManager.getInstance();
const secretService = SecretService.getInstance();

// Helper function to extract Bearer token (exported for optional auth checks)
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Helper function to extract API key from request
// Checks both Bearer token (if starts with 'ik_') and x-api-key header
export function extractApiKey(req: AuthRequest): string | null {
  const bearerToken = extractBearerToken(req.headers.authorization);
  if (bearerToken && bearerToken.startsWith('ik_')) {
    return bearerToken;
  }

  // Fall back to x-api-key header for backward compatibility
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key'] as string;
  }

  return null;
}

// Helper function to extract the opaque anon key from a request
// The anon key travels in the Authorization header like every other client
// credential (Bearer anon_...); signed-in clients replace it with their JWT.
export function extractAnonKey(req: AuthRequest): string | null {
  const bearerToken = extractBearerToken(req.headers.authorization);
  if (bearerToken && bearerToken.startsWith('anon_')) {
    return bearerToken;
  }

  return null;
}

// Helper function to set user on request
function setRequestUser(
  req: AuthRequest,
  payload: { sub: string; email?: string; role: RoleSchema }
) {
  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

/**
 * Verifies user authentication (accepts API keys, anon keys, and JWT tokens)
 *
 * All credentials travel in the Authorization header; dispatch is by shape,
 * never by falling back on failure:
 * - `ik_...` (Bearer or x-api-key) -> admin API key
 * - Bearer `anon_...` -> opaque anon key, `anon` role
 * - any other Bearer -> JWT (role claim decides admin/authenticated/legacy anon)
 *
 * Signed-out clients send the anon key as their Bearer credential; signing in
 * replaces it with the user JWT. Each branch fails closed: an invalid or
 * expired user JWT must return 401 (so SDK refresh flows trigger) — it must
 * never silently downgrade to anon.
 */
export async function verifyUser(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = extractApiKey(req);
  if (apiKey) {
    return verifyApiKey(req, res, next);
  }

  const bearerToken = extractBearerToken(req.headers.authorization);
  if (bearerToken && bearerToken.startsWith('anon_')) {
    return verifyAnonKey(req, res, next);
  }

  // Anything else (including no credentials) goes through JWT verification,
  // which produces the canonical 401 when the header is missing or invalid
  return verifyToken(req, res, next);
}

/**
 * Verifies admin authentication (requires admin token)
 */
export async function verifyAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = extractApiKey(req);
  if (apiKey) {
    return verifyApiKey(req, res, next);
  }

  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AppError(
        'No admin token provided',
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        NEXT_ACTIONS.CHECK_TOKEN
      );
    }

    // The unverified type claim is used only to choose the verifier. A Cloud
    // project authorization candidate must never fall back to local JWT
    // verification if Cloud verification fails.
    const decoded = jwt.decode(token);
    const tokenType = decoded && typeof decoded === 'object' ? decoded.type : undefined;
    if (tokenType === 'project_authorization') {
      const { projectId, userId } = await tokenManager.verifyCloudProjectAuthorization(token);
      req.projectId = projectId;
      req.authenticated = true;
      setRequestUser(req, { sub: `cloud:${userId}`, role: 'project_admin' });
      return next();
    }

    const payload = tokenManager.verifyToken(token);

    if (payload.role !== 'project_admin') {
      throw new AppError(
        'Admin access required',
        403,
        ERROR_CODES.AUTH_UNAUTHORIZED,
        NEXT_ACTIONS.CHECK_ADMIN_TOKEN
      );
    }

    setRequestUser(req, payload);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(
        new AppError(
          'Invalid admin token',
          401,
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          NEXT_ACTIONS.CHECK_ADMIN_TOKEN
        )
      );
    }
  }
}

/**
 * Verifies API key authentication
 * Accepts API key via Authorization: Bearer header or x-api-key header (backward compatibility)
 */
export async function verifyApiKey(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    // Extract API key from request using helper
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AppError(
        'No API key provided',
        401,
        ERROR_CODES.AUTH_INVALID_API_KEY,
        NEXT_ACTIONS.CHECK_API_KEY
      );
    }

    const isValid = await secretService.verifyApiKey(apiKey);
    if (!isValid) {
      throw new AppError(
        'Invalid API key',
        401,
        ERROR_CODES.AUTH_INVALID_API_KEY,
        NEXT_ACTIONS.CHECK_API_KEY
      );
    }
    req.authenticated = true;
    req.hasApiKey = true;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verifies the opaque anon key (`anon_...`)
 * Maps the request to the `anon` role; RLS policies are the security boundary.
 * The request carries 'anonymous' as its API-level subject, but no sub claim
 * reaches the database (stripped like admin subjects), so auth.uid() is NULL
 * and identity-scoped policies fail closed.
 */
export async function verifyAnonKey(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const anonKey = extractAnonKey(req);

    if (!anonKey) {
      throw new AppError(
        'No anon key provided',
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        NEXT_ACTIONS.CHECK_TOKEN
      );
    }

    const isValid = await secretService.verifyAnonKey(anonKey);
    if (!isValid) {
      throw new AppError(
        'Invalid anon key',
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        NEXT_ACTIONS.CHECK_TOKEN
      );
    }

    setRequestUser(req, { sub: 'anonymous', role: 'anon' });
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Core token verification middleware that handles JWT tokens
 * Sets req.user with the authenticated user information
 */
export function verifyToken(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AppError(
        'No token provided',
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        NEXT_ACTIONS.CHECK_TOKEN
      );
    }

    // Verify JWT token
    const payload = tokenManager.verifyToken(token);

    // Validate token has a
```

### Core Architecture Module: `backend/src/api/middlewares/error.ts`
```
import { Request, Response, NextFunction } from 'express';
import { DatabaseError } from 'pg';
import { errorResponse } from '@/utils/response.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import logger from '@/utils/logger.js';
import { AppError, getDatabaseErrorDetails, isErrorObject } from '@/utils/errors.js';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Only log non-authentication errors or unexpected errors
  if (!(err instanceof AppError && err.statusCode === 401)) {
    logger.error('Error occurred', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  // Handle known AppError instances
  if (err instanceof AppError) {
    return errorResponse(res, err.code, err.message, err.statusCode, err.nextActions);
  }

  // Handle SyntaxError from JSON.parse
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return errorResponse(
      res,
      ERROR_CODES.INVALID_INPUT,
      err.message,
      400,
      'Please ensure your request body contains valid JSON'
    );
  }

  // Handle PostgreSQL database errors
  if (err instanceof DatabaseError) {
    const dbError = getDatabaseErrorDetails(err);
    if (dbError) {
      return errorResponse(
        res,
        dbError.code,
        dbError.message,
        dbError.statusCode,
        dbError.nextActions
      );
    }
  }

  // For all other errors, check if it's an object we can work with
  if (!isErrorObject(err)) {
    return errorResponse(res, ERROR_CODES.INTERNAL_ERROR, 'Internal server error', 500);
  }

  // Handle JSON parsing errors from body-parser
  if (err.type === 'entity.parse.failed' && err.status === 400) {
    return errorResponse(
      res,
      ERROR_CODES.INVALID_INPUT,
      err.message || 'Invalid JSON in request body',
      400,
      'Please ensure your request body contains valid JSON'
    );
  }

  // Default internal error with optional message
  const message = err.message || 'Internal server error';
  return errorResponse(res, ERROR_CODES.INTERNAL_ERROR, message, 500);
}

```

### Core Architecture Module: `backend/src/api/middlewares/rate-limiters.ts`
```
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors.js';
import logger from '@/utils/logger.js';
import { ERROR_CODES } from '@insforge/shared-schemas';

/**
 * Store for tracking per-email cooldowns
 * Maps email -> last request timestamp
 */
const emailCooldowns = new Map<string, number>();

/**
 * Cleanup interval reference for graceful shutdown
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Cleanup old cooldown entries every 5 minutes
 */
cleanupInterval = setInterval(
  () => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    for (const [email, timestamp] of emailCooldowns.entries()) {
      if (now - timestamp > fiveMinutes) {
        emailCooldowns.delete(email);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Clean up resources for graceful shutdown
 */
export function destroyEmailCooldownInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  emailCooldowns.clear();
}

/**
 * Per-IP rate limiter for email otp requests
 * Prevents brute-force attacks, resource exhaustion, and enumeration from single IP
 *
 * Limits: 5 requests per 15 minutes per IP
 * Counts ALL requests (both successful and failed) to prevent abuse
 */
export const sendEmailOTPRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        'Too many send email verification requests from this IP. Please try again in 15 minutes.',
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      )
    );
  },
  // Count all requests (both successes and failures) to prevent resource exhaustion and enumeration
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Per-IP rate limiter for S3 access key management endpoints.
 * These endpoints mint / revoke long-lived credentials, so tight limits
 * prevent credential spraying or key-churn abuse from a single IP.
 *
 * Limits: 20 requests per 15 minutes per IP (shared across POST/GET/DELETE).
 */
export const s3AccessKeyManagementRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        'Too many S3 access key management requests from this IP. Please try again in 15 minutes.',
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      )
    );
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Per-IP rate limiter for the compute logs endpoint.
 * Unlike the write limiters, this is a read endpoint the dashboard polls every
 * ~2s while live-tailing, so the budget is generous — it exists to cap retry
 * storms / abuse, not to throttle normal tailing (≈30 req/min) across a few
 * open tabs.
 *
 * Limits: 120 requests per minute per IP.
 */
export const computeLogsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        'Too many log requests from this IP. Please slow down and try again shortly.',
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      )
    );
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Per-IP rate limiter for email OTP verification attempts
 * Prevents brute-force code guessing
 *
 * Limits: 10 attempts per 15 minutes per IP
 */
export const verifyOTPRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 verification attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        'Too many verification attempts from this IP. Please try again in 15 minutes.',
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      )
    );
  },
  skipSuccessfulRequests: true, // Don't count successful verifications
  skipFailedRequests: false, // Count failed attempts to prevent brute force
});

/**
 * Per-IP rate limiter for native provider ID-token exchanges.
 * These unauthenticated requests perform cryptographic token verification and
 * may fetch provider signing keys, so count both successful and failed calls.
 *
 * Limits: 30 attempts per 15 minutes per IP
 */
export const idTokenSignInRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        'Too many ID token sign-in attempts from this IP. Please try again in 15 minutes.',
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      )
    );
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Per-email cooldown middleware
 * Prevents enumeration attacks by enforcing minimum time between requests for same email
 *
 * Cooldown: 60 seconds between requests for same email
 */
export const perEmailCooldown = (cooldownMs: number = 60000) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const email = req.body?.email?.toLowerCase();

    if (!email) {
      // If no email in body, let it pass (will be caught by validation)
      return next();
    }

    const now = Date.now();
    const lastRequest = emailCooldowns.get(email);

    if (lastRequest && now - lastRequest < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastRequest);
      const remainingSec = Math.ceil(remainingMs / 1000);

      throw new AppError(
        `Please wait ${remainingSec} seconds before requesting another code for this email`,
        429,
        ERROR_CODES.TOO_MANY_REQUESTS
      );
    }

    // Update last request time
    emailCooldowns.set(email, now);
    next();
  };
};

/**
 * Combined rate limiter for sending email otp requests
 * Applies both per-IP and per-email limits
 */
export const sendEmailOTPLimiter = [
  sendEmailOTPRateLimiter,
  perEmailCooldown(60000), // 60 second cooldown per email
];

/**
 * Rate limiter for OTP verification attempts (email OTP verification)
 * Only per-IP limit, no per-email limit (to allow legitimate retries)
 */
export const verifyOTPLimiter = [verifyOTPRateLimiter];

/**
 * Per-IP rate limiters for "write" endpoints that ultimately drive an external
 * provider call.
 *
 * Goal: stop a single admin's runaway script from monopolising the platform's
 * shared upstream provider quotas — Vercel `Token creation 32/hr`, Vercel
 * `Deployments per 5min: 120`, Fly `app deletions: 100/min`, Deno
 * `Deployments per hour: 60`, etc.
 *
 * Each provider category gets its own bucket so a noisy compute deploy loop
 * cannot starve a legitimate function update (and vice versa). The defaults
 * (see DEFAULT_WRITE_ENDPOINT_LIMITS) are generous for human-driven CRUD;
 * CI loops are expected to deploy once per commit and stay well below them.
 *
 * Operators can override per-category budgets at runtime by uploading a JSON
 * file to the AWS_CONFIG_BUCKET at key `resource-rate-limits.json`:
 *   { "functions": 20, "deployments": 40, "compute": 15 }
 * The file is fetched on startup and refreshed on a periodic timer
 * (default 1 hour; tune via INSFORGE_WRITE_RATE_LIMIT_REFRESH_MS, set to 0
 * for startup-only). Any missing or invalid (non-positive-integer) field
 * falls back to the built-in default.
 *
 * Counts ALL requests (skipFailedRequests: false) so a buggy script that
 * loops on a 4xx response can't bypass the cap.
 *
 * Within a category, the budget is shared across every wired endpoint — e.g.
 * a deploy create + an e
```

### Core Architecture Module: `backend/src/api/middlewares/s3-sigv4.ts`
```
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { S3AccessKeyService } from '@/services/storage/s3-access-key.service.js';
import { verifyHeaderSignature } from '@/services/storage/s3-signature.js';
import { sendS3Error } from '@/api/routes/s3-gateway/errors.js';
import logger from '@/utils/logger.js';
import { appConfig } from '@/infra/config/app.config.js';

/**
 * Region used to validate the `Credential=<ak>/<date>/<region>/s3/aws4_request`
 * scope in incoming Authorization headers. Shares `S3_REGION` (fallback
 * `AWS_REGION`) with S3StorageProvider so clients sign with the same region
 * the backing bucket lives in (and so `GET /api/storage/s3/config` surfaces
 * exactly what the middleware will accept). Defaults to `us-east-2`.
 */
const SIGNING_REGION = appConfig.storage.s3Region;
const MAX_CLOCK_SKEW_MS = 15 * 60 * 1000;

/**
 * Return the raw, percent-encoded path as the client sent it, *including* the
 * gateway mount prefix. Express's `req.path` is URL-decoded (so `hello%20x`
 * becomes `hello x`) which breaks SigV4 canonicalization for object keys with
 * percent-encoded chars. SigV4 also requires the canonical URI to match what
 * the client signed, which is the absolute HTTP path — i.e. the prefix is
 * part of the signed bytes and must not be stripped before verification.
 */
function rawRequestPath(req: Request): string {
  const full = req.originalUrl || req.url;
  const qIdx = full.indexOf('?');
  return qIdx === -1 ? full : full.slice(0, qIdx);
}

export interface S3AuthContext {
  accessKeyId: string;
  s3AccessKeyRowId: string;
  signingKey: Buffer;
  datetime: string;
  scope: string;
  seedSignature: string;
  requestId: string;
  payloadHash: string;
}

export interface S3AuthenticatedRequest extends Request {
  s3Auth: S3AuthContext;
}

function parseAmzDate(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) {
    return null;
  }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

export async function s3Sigv4Middleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = crypto.randomUUID();
  (req as Request & { s3RequestId?: string }).s3RequestId = requestId;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('AWS4-HMAC-SHA256')) {
    sendS3Error(res, 'AuthorizationHeaderMalformed', 'Missing or invalid Authorization header', {
      resource: req.path,
      requestId,
    });
    return;
  }

  const amzDate = req.headers['x-amz-date'];
  if (typeof amzDate !== 'string') {
    sendS3Error(res, 'AuthorizationHeaderMalformed', 'Missing x-amz-date header', {
      resource: req.path,
      requestId,
    });
    return;
  }
  const parsed = parseAmzDate(amzDate);
  if (!parsed || Math.abs(Date.now() - parsed.getTime()) > MAX_CLOCK_SKEW_MS) {
    sendS3Error(res, 'RequestTimeTooSkewed', 'Clock skew exceeds 15 minutes', {
      resource: req.path,
      requestId,
    });
    return;
  }

  const payloadHash = (req.headers['x-amz-content-sha256'] as string) ?? 'UNSIGNED-PAYLOAD';

  const credMatch = /Credential=([^/]+)\//.exec(authHeader);
  if (!credMatch) {
    sendS3Error(res, 'AuthorizationHeaderMalformed', 'Missing Credential in Authorization', {
      resource: req.path,
      requestId,
    });
    return;
  }
  const accessKeyId = credMatch[1];

  const svc = S3AccessKeyService.getInstance();
  const resolved = await svc.resolveAccessKeyForVerification(accessKeyId);
  if (!resolved) {
    sendS3Error(res, 'InvalidAccessKeyId', `The access key ${accessKeyId} does not exist`, {
      resource: req.path,
      requestId,
    });
    return;
  }

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') {
      headers[k.toLowerCase()] = v;
    } else if (Array.isArray(v)) {
      headers[k.toLowerCase()] = v.join(',');
    }
  }

  const rawUrl = req.originalUrl || req.url;
  const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const result = verifyHeaderSignature({
    authorization: authHeader,
    secret: resolved.secret,
    method: req.method,
    path: rawRequestPath(req),
    query,
    headers,
    payloadHash,
    expectedRegion: SIGNING_REGION,
  });

  if (!result.ok) {
    sendS3Error(res, result.code, result.reason, {
      resource: req.path,
      requestId,
    });
    return;
  }

  // Fire-and-forget last_used_at update.
  setImmediate(() => {
    svc
      .touchLastUsed(resolved.id)
      .catch((err) => logger.warn('Failed to update last_used_at', { err, accessKeyId }));
  });

  (req as S3AuthenticatedRequest).s3Auth = {
    accessKeyId,
    s3AccessKeyRowId: resolved.id,
    signingKey: result.signingKey,
    datetime: result.datetime,
    scope: result.scope,
    seedSignature: result.seedSignature,
    requestId,
    payloadHash,
  };
  next();
}

```

### Core Architecture Module: `backend/src/api/middlewares/upload.ts`
```
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import { ProcessedFormData } from '@/types/storage.js';
import { StorageConfigService } from '@/services/storage/storage-config.service.js';
import logger from '@/utils/logger.js';
import { appConfig } from '@/infra/config/app.config.js';

// Constants
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Largest numeric array index accepted inside a multipart field name, e.g. the
// 3 in `a[3]`. multer defaults this to Infinity, and the check in
// make-middleware.js only runs when the key is explicitly present, so the
// 2.3.0 upgrade alone does NOT close GHSA-535w-7cp7-47q4 (CVE-2026-82333,
// oversized array index) -- that advisory
// requires the version AND this limit. Without it a crafted field name like
// `a[999999999]` makes body parsing allocate and spin, which is synchronous
// CPU exhaustion. Nothing here uses array-indexed field names (uploads are
// .single()), so this is far above real usage and purely a ceiling.
const MAX_FIELD_ARRAY_INDEX = 100;

/**
 * multer 2.3.0 reads `fieldArrayIndexLimit` at runtime, but @types/multer 2.2.0
 * does not declare it yet (it has fieldNestingDepth and stops there), and
 * multer's Options['limits'] is an inline anonymous type rather than a named
 * interface -- so it cannot be reached with `declare module`. Widening it here
 * and passing the RESULT keeps both call sites type-checked: excess-property
 * checking applies to fresh object literals, not to a typed value.
 *
 * Also makes the two uploaders share one definition, so a limit can no longer
 * be set on one and forgotten on the other.
 */
type UploadLimits = NonNullable<multer.Options['limits']> & {
  fieldArrayIndexLimit?: number;
};

const uploadLimits = (fileSize: number): UploadLimits => ({
  fileSize,
  files: appConfig.server.maxFilesPerField,
  fieldArrayIndexLimit: MAX_FIELD_ARRAY_INDEX,
});

/**
 * Returns the configured max file size in bytes.
 * Uses the MAX_FILE_SIZE environment variable if set, otherwise defaults to 50 MB.
 */
export const getMaxFileSize = (): number => appConfig.server.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

// Create multer instance with memory storage (static, env-based — used by non-storage routes)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits(getMaxFileSize()),
});

/**
 * Creates a per-request multer single-file upload middleware that reads the
 * configured max file size from the storage config table at request time.
 * Falls back to the env-based limit when the database is unreachable.
 */
export const dynamicUploadSingle =
  (fieldName: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let maxSize: number;
    try {
      maxSize = await StorageConfigService.getInstance().getMaxFileSizeBytes();
    } catch (error) {
      // Fall back to env-based limit when the DB is unreachable
      logger.warn('Could not read storage config from DB, falling back to env/default', { error });
      maxSize = getMaxFileSize();
    }

    // Attach the resolved limit to the request so handleUploadError can reference it
    (req as Request & { _maxFileSizeBytes?: number })._maxFileSizeBytes = maxSize;

    const uploader = multer({
      storage: multer.memoryStorage(),
      limits: uploadLimits(maxSize),
    }).single(fieldName);
    uploader(req, res, next);
  };

/**
 * Express error-handling middleware for multer upload errors.
 * Translates multer-specific errors into user-friendly AppError responses,
 * including the configured size limit when a file exceeds the maximum.
 */
export const handleUploadError = (
  err: Error | multer.MulterError,
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxBytes = (req as Request & { _maxFileSizeBytes?: number })._maxFileSizeBytes;
      const limitMb = maxBytes ? Math.round(maxBytes / (1024 * 1024)) : null;
      const message = limitMb
        ? `File too large. Maximum upload size is ${limitMb} MB.`
        : 'File too large. Please check the configured upload size limit.';
      return next(new AppError(message, 413, ERROR_CODES.STORAGE_INVALID_PARAMETER));
    }

    const errorMap: Record<string, { status: number; message: string }> = {
      LIMIT_FILE_COUNT: { status: 400, message: 'Too many files' },
    };

    const error = errorMap[err.code] || { status: 400, message: err.message };
    return next(new AppError(error.message, error.status, ERROR_CODES.STORAGE_INVALID_PARAMETER));
  }

  if (err) {
    return next(new AppError(err.message, 500, ERROR_CODES.INTERNAL_ERROR));
  }

  next();
};

/**
 * Extracts fields and files from a multipart form-data request
 * processed by multer and returns them as a structured object.
 */
export function processFormData(req: Request): ProcessedFormData {
  const fields = req.body || {};
  const files: Record<string, Express.Multer.File[]> = {};

  if (req.files) {
    if (Array.isArray(req.files)) {
      files['files'] = req.files;
    } else {
      Object.assign(files, req.files);
    }
  }

  return { fields, files };
}

```

### Core Architecture Module: `backend/src/api/routes/advisor/index.routes.ts`
```
import { Router, Response, NextFunction } from 'express';
import { verifyAdmin, AuthRequest } from '@/api/middlewares/auth.js';
import { successResponse } from '@/utils/response.js';
import { DatabaseAdvisorService } from '@/services/database/database-advisor.service.js';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import logger from '@/utils/logger.js';
import { SUPPRESSION_SCOPES, SUPPRESSION_REASONS } from '@/types/advisor.js';

const router = Router();
const advisorService = DatabaseAdvisorService.getInstance();

router.post('/scan', verifyAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scanId = await advisorService.triggerScan('manual');
    successResponse(res, { scanId, message: 'Scan started' }, 201);
  } catch (error: unknown) {
    logger.warn('Trigger advisor scan error:', error);
    next(error);
  }
});

/**
 * Get the latest advisor scan summary.
 * GET /api/advisor/latest
 */
router.get('/latest', verifyAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await advisorService.getLatestScan();
    successResponse(res, summary);
  } catch (error: unknown) {
    logger.warn('Get latest advisor scan error:', error);
    next(error);
  }
});

/**
 * Get findings for the latest advisor scan.
 * GET /api/advisor/issues
 */
router.get('/issues', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const severity = req.query.severity as string | undefined;
    if (severity !== undefined && !['critical', 'warning', 'info'].includes(severity)) {
      throw new AppError(
        'Invalid severity parameter: must be one of critical, warning, info',
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }
    const category = req.query.category as string | undefined;
    if (category !== undefined && !['security', 'performance', 'health'].includes(category)) {
      throw new AppError(
        'Invalid category parameter: must be one of security, performance, health',
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    let limit: number | undefined;
    if (req.query.limit !== undefined && req.query.limit !== '') {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new AppError(
          'Invalid limit parameter: must be a positive integer',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
    }

    let offset: number | undefined;
    if (req.query.offset !== undefined && req.query.offset !== '') {
      offset = Number(req.query.offset);
      if (!Number.isInteger(offset) || offset < 0) {
        throw new AppError(
          'Invalid offset parameter: must be a non-negative integer',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
    }

    const result = await advisorService.getLatestScanIssues({
      severity,
      category,
      limit,
      offset,
    });

    successResponse(res, result);
  } catch (error: unknown) {
    logger.warn('Get advisor issues error:', error);
    next(error);
  }
});

/**
 * List all suppressions (the Ignored view).
 * GET /api/advisor/suppressions
 */
router.get(
  '/suppressions',
  verifyAdmin,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const suppressions = await advisorService.listSuppressions();
      successResponse(res, { suppressions });
    } catch (error: unknown) {
      logger.warn('List advisor suppressions error:', error);
      next(error);
    }
  }
);

/**
 * Suppress a finding (instance fingerprint) or a whole rule.
 * POST /api/advisor/suppressions
 */
router.post(
  '/suppressions',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { ruleId, affectedObject, scope, reason, note } = req.body ?? {};
      const trimmedRuleId = typeof ruleId === 'string' ? ruleId.trim() : '';
      if (trimmedRuleId.length === 0 || trimmedRuleId.length > 200) {
        throw new AppError(
          'Invalid ruleId: must be a non-empty string',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      if (!SUPPRESSION_SCOPES.includes(scope)) {
        throw new AppError(
          'Invalid scope: must be one of instance, rule',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      if (!SUPPRESSION_REASONS.includes(reason)) {
        throw new AppError(
          `Invalid reason: must be one of ${SUPPRESSION_REASONS.join(', ')}`,
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      // Reject whitespace-only, but store the value verbatim: advisor findings
      // build affected_object straight from catalog identifiers without
      // trimming, so a stored-trimmed value would never match on re-scan.
      const affectedObjectStr = typeof affectedObject === 'string' ? affectedObject : '';
      if (
        scope === 'instance' &&
        (affectedObjectStr.trim().length === 0 || affectedObjectStr.length > 500)
      ) {
        throw new AppError(
          'Invalid affectedObject: required for instance scope, at most 500 characters',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 1000)) {
        throw new AppError(
          'Invalid note: must be a string of at most 1000 characters',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      if (reason === 'other' && (typeof note !== 'string' || note.trim().length === 0)) {
        throw new AppError(
          'Invalid note: required when reason is "other"',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }
      const suppression = await advisorService.createSuppression({
        ruleId: trimmedRuleId,
        affectedObject: scope === 'instance' ? affectedObjectStr : null,
        scope,
        reason,
        note: note ?? null,
        createdBy: req.user?.id ?? null,
      });
      successResponse(res, suppression, 201);
    } catch (error: unknown) {
      logger.warn('Create advisor suppression error:', error);
      next(error);
    }
  }
);

/**
 * Restore (un-suppress).
 * DELETE /api/advisor/suppressions/:id
 */
router.delete(
  '/suppressions/:id',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(req.params.id)) {
        throw new AppError('Invalid id: must be a valid UUID', 400, ERROR_CODES.INVALID_INPUT);
      }
      const deleted = await advisorService.deleteSuppression(req.params.id);
      if (!deleted) {
        throw new AppError('Suppression not found', 404, ERROR_CODES.NOT_FOUND);
      }
      successResponse(res, { deleted: true });
    } catch (error: unknown) {
      logger.warn('Delete advisor suppression error:', error);
      next(error);
    }
  }
);

export { router as advisorRouter };

```

### Core Architecture Module: `backend/src/api/routes/ai/index.routes.ts`
```
import { Router, Response, NextFunction } from 'express';
import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import { AuthRequest, verifyAdmin, verifyUser } from '../../middlewares/auth.js';
import { ImageGenerationService } from '@/services/ai/image-generation.service.js';
import { EmbeddingService } from '@/services/ai/embedding.service.js';
import { AIModelService } from '@/services/ai/ai-model.service.js';
import { AppError } from '@/utils/errors.js';
import { errorResponse, successResponse } from '@/utils/response.js';
import { OpenRouterProvider } from '@/providers/ai/openrouter.provider.js';
import logger from '@/utils/logger.js';
import {
  ModelGatewayConfigService,
  ModelGatewayConfigUpdateError,
} from '@/services/ai/model-gateway-config.service.js';
import { AuditService } from '@/services/logs/audit.service.js';
import { isCloudEnvironment } from '@/utils/environment.js';
import {
  ERROR_CODES,
  chatCompletionRequestSchema,
  embeddingsRequestSchema,
  imageGenerationRequestSchema,
  updateModelGatewayConfigSchema,
} from '@insforge/shared-schemas';

const router = Router();
const chatService = ChatCompletionService.getInstance();
const modelGatewayConfigService = ModelGatewayConfigService.getInstance();
const auditService = AuditService.getInstance();
type AIProvider = 'openrouter';

/**
 * GET /api/ai/config
 * Get masked self-hosted Model Gateway credential status.
 */
router.get('/config', verifyAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    assertSelfHostedModelGatewayConfig();
    successResponse(res, await modelGatewayConfigService.getConfig());
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/ai/config
 * Store self-hosted Model Gateway credentials encrypted in system.secrets.
 */
router.put('/config', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    assertSelfHostedModelGatewayConfig();
    const validation = updateModelGatewayConfigSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(
        `Validation error: ${validation.error.errors.map((error) => error.message).join(', ')}`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }
    const updatedFields = Object.keys(validation.data);
    let config: Awaited<ReturnType<typeof modelGatewayConfigService.updateConfig>>;
    try {
      config = await modelGatewayConfigService.updateConfig(validation.data);
    } catch (error) {
      const succeededFields =
        error instanceof ModelGatewayConfigUpdateError ? error.succeededFields : [];
      const failedFields =
        error instanceof ModelGatewayConfigUpdateError ? error.failedFields : updatedFields;
      const errorToPropagate =
        error instanceof ModelGatewayConfigUpdateError ? (error.cause ?? error) : error;
      try {
        await auditService.log({
          actor: req.hasApiKey ? 'api-key' : req.user?.id,
          action: 'UPDATE_MODEL_GATEWAY_CONFIG',
          module: 'AI',
          details: {
            updatedFields: succeededFields,
            failedFields,
            outcome:
              failedFields.length === 0
                ? 'succeeded'
                : succeededFields.length > 0
                  ? 'partially_succeeded'
                  : 'failed',
          },
          ip_address: req.ip,
        });
      } catch (auditError) {
        logger.error('Failed to audit a Model Gateway configuration update', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }
      throw errorToPropagate;
    }
    try {
      await auditService.log({
        actor: req.hasApiKey ? 'api-key' : req.user?.id,
        action: 'UPDATE_MODEL_GATEWAY_CONFIG',
        module: 'AI',
        details: { updatedFields, failedFields: [], outcome: 'succeeded' },
        ip_address: req.ip,
      });
    } catch (auditError) {
      logger.error('Failed to audit a successful Model Gateway configuration update', {
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }
    successResponse(res, config);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/models
 * Get all available AI models in ListModelsResponse format
 */
router.get('/models', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const models = await AIModelService.getModels();
    successResponse(res, models);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/overview
 * Get key-level Model Gateway observability from OpenRouter.
 */
router.get(
  '/overview',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const openRouterProvider = OpenRouterProvider.getInstance();
      const overview = await openRouterProvider.getOverview();
      successResponse(res, overview);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai/:provider/api-key
 * Get the active provider API key for Model Gateway display/copy.
 */
router.get(
  '/:provider/api-key',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const provider = parseAIProvider(req.params.provider);
      const openRouterProvider = OpenRouterProvider.getInstance();
      const key = await getProviderApiKey(provider, openRouterProvider);
      successResponse(res, key);
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODES.AI_INVALID_API_KEY) {
        errorResponse(
          res,
          ERROR_CODES.AI_INVALID_API_KEY,
          'OpenRouter API key is not configured.',
          400,
          'Set OPENROUTER_API_KEY or configure it in Model Gateway settings.'
        );
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/ai/:provider/api-key/rotate
 * Rotate the active provider API key for cloud-managed Model Gateway credentials.
 */
router.post(
  '/:provider/api-key/rotate',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const provider = parseAIProvider(req.params.provider);
      const openRouterProvider = OpenRouterProvider.getInstance();
      const key = await rotateProviderApiKey(provider, openRouterProvider);
      successResponse(res, key);
    } catch (error) {
      next(error);
    }
  }
);

function parseAIProvider(value: string | undefined): AIProvider {
  if (value === 'openrouter') {
    return value;
  }

  throw new AppError(
    `Unsupported AI provider: ${value || 'unknown'}`,
    400,
    ERROR_CODES.INVALID_INPUT
  );
}

function assertSelfHostedModelGatewayConfig(): void {
  if (isCloudEnvironment()) {
    throw new AppError(
      'Model Gateway credentials are managed by InsForge Cloud.',
      400,
      ERROR_CODES.INVALID_INPUT
    );
  }
}

function getProviderApiKey(provider: AIProvider, openRouterProvider: OpenRouterProvider) {
  switch (provider) {
    case 'openrouter':
      return openRouterProvider.getMaskedApiKey();
    default: {
      const exhaustiveProvider: never = provider;
      throw new AppError(
        `Unsupported AI provider: ${exhaustiveProvider}`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }
  }
}

function rotateProviderApiKey(provider: AIProvider, openRouterProvider: OpenRouterProvider) {
  switch (provider) {
    case 'openrouter':
      return openRouterProvider.rotateManagedApiKey();
    default: {
      const exhaustiveProvider: never = provider;
      throw new AppError(
        `Unsupported AI provider: ${exhaustiveProvider}`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }
  }
}

/**
 * POST /api/ai/chat/completion
 * Send a chat message to any supported model
 */
router.post(
  '/chat/completion',
  verifyUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const validationResult = chatCompletionRequestSchema.safeParse(req.b
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2049** (2026-09-26): **[Bug]: Outage & Permanent Data Loss Window during Container Updates**
  *Symptoms*: ### What's the bug?  Target file: `backend/src/providers/compute/docker.provider.ts`  ### Architectural Flaw DockerProvider.updateMachine() uses a "Destroy-Before-Create" approach. It stops and deletes the running, healthy container before verifying if the replacement container can pull or start.  If the new build or image pull fails, the original container is already destroyed, causing immediate total service downtime with no rollback capability. Relying on MachineGoneError DB cleanup post-failure is reactive and does not prevent the outage.  Availability & Disaster Recovery Impact: If container creation or startup fails during updateMachine() (e.g., corrupt image tag, missing registry credentials, host port collision, or container exit code 1), the original container has ALREADY been deleted. The service drops completely offline without an active container, destroying availability promises.  ### Implemented (current code) ``` const name = (current.Name ?? '').replace(/^\//, '') || params.appId;       await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(         () => undefined       );       await dockerRequest(         'DELETE',         `/containers/${encodeURIComponent(params.machineId)}?force=true`       );        const launched = await this.launchMachine({         appId: name,         image: params.image,         port: params.port,         cpu: params.cpu,         memory: params.memory,         envVars: params.envVars,         re
  **Post-Mortem & Fix Analysis**:
  > i would like to work on this issue 
  > Assigned to @prakharsingh-74. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#2049](https://github.com/InsForge/InsForge/issues/2049) — Outage & Permanent Data Loss Window during Container Updates
  > hey @Fermionic-Lyu @jwfing and @CarmenDou what do you think about this bug?

- **Issue #2015** (2026-08-29): **[Bug]: Streaming token usage double-counts due to accumulation instead of replacement**
  *Symptoms*: ### What's the bug?  There is a token accounting bug in `**ChatCompletionService.streamChat**`.   According to the OpenAI API streaming spec (and OpenRouter's `include_usage` flag), the `usage` object returned in a streaming chunk represents the **cumulative total tokens consumed so far**, not a delta for that specific chunk.   Currently, the code accumulates these totals using `+=`, which results in severe overcounting if the provider emits multiple usage chunks. For example, if a 100-token request sends 3 usage chunks (10, 50, 100), the system currently logs 160 tokens instead of 100.  The service should replace (`=`) the usage values with the latest chunk's values rather than accumulating (`+=`) them. I have tracked down the exact lines in `**chat-completion.service.ts**` causing this.   ### How to reproduce  1. Run a streaming request (`**streamChat**`) against a provider (like OpenRouter) that is capable of emitting multiple usage chunks. 2. Observe the returned `tokenUsage` in the final SSE stream payloads. 3. The reported total will be a multiple of the actual usage because it adds the cumulative chunks together.   ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this, please assign it to me!
  > Assigned to @sankar-chaitanya2025. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#2015](https://github.com/InsForge/InsForge/issues/2015) — Streaming token usage double-counts due to accumulation instead of replacement
  > @hemanthreddykoduru this issue is already assigned to @sankar-chaitanya2025. I won't reassign it automatically.

- **Issue #2005** (2026-08-25): **[Bug]: Users table: row content bleeds through the frozen "User" column on hover when grid is horizontally scrolled**
  *Symptoms*: ### What's the bug?  ## Summary  In the Authentication → Users table (`UsersDataGrid`), when the dashboard window/tab is narrower than the table's full column width (so the grid has to scroll horizontally), hovering over a row makes the ID/Email/Phone column text visually bleed through and overlap the frozen "User" column (checkbox + avatar + name). The two texts render stacked on top of each other, looking like corrupted/overlapping UI.  **Screenshot:**   <img width="2478" height="1636" alt="Image" src="https://github.com/user-attachments/assets/e48c353d-0c9a-414a-badd-4744f774f7f3" />  ## Root cause  The "User" column (`selectionColumnWidth`) is a `frozen: true` column in `react-data-grid`, which pins it via `position: sticky`. Frozen columns rely on having an **opaque** background so that content from the non-frozen columns scrolled underneath is fully hidden behind it.  In `packages/dashboard/src/rdg.css`:  ```css .rdg-cell {   ...   /* no background-color set here */ } ```  Cells get their background via react-data-grid's own base rule `background-color: inherit`, which pulls from `.rdg-row`'s background. Normally that's opaque:  ```css .rdg-row {   background-color: rgb(var(--semantic-0)); } ```  But on hover, `.rdg-row:hover` overrides it with a **translucent** color instead of layering a tint on top of the opaque background:  ```css .rdg-row:hover, .rdg-row[aria-selected='true'], .rdg-row[aria-selected='true']:hover {   background-color: var(--rdg-row-hover-color); /*
  **Post-Mortem & Fix Analysis**:
  > i would like to work on these  
  > Assigned to @vraj00222. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1941](https://github.com/InsForge/InsForge/issues/1941) — Add phone number (SMS) OTP sign-in - [InsForge#2005](https://github.com/InsForge/InsForge/issues/2005) — Users table: row content bleeds through the frozen "User" column on hover when g

- **Issue #1981** (2026-08-25): **[Bug]: `embedding_model` is recorded on insert, never set on update, and never checked on read**
  *Symptoms*: ### What's the bug?  `memory.memories.embedding_model` is written once and then never used. Nothing reads it, and the one path that replaces a stored vector doesn't maintain it. Changing the embedding model is currently not a shippable change: it corrupts recall instead of failing.  Grep across the repo returns exactly two references to the column, the schema default and the insert.  ## Where it stands on `main`  The insert sets it (`memory.service.ts:224-235`):  ``` INSERT INTO memory.memories (scope, kind, title, content, embedding, embedding_model, source) VALUES ($1, $2, $3, $4, $5::vector, $6, $7) ``` with `EMBED_MODEL` bound to `$6`.  The reconcile UPDATE computes a fresh vector and writes it without touching the column (`memory.service.ts:243-246`):  ``` const newEmbedding = await this.embed(`${title}\n${content}`); UPDATE memory.memories    SET kind = $1, title = $2, content = $3, embedding = $4::vector, source = $5 ```  So the moment `EMBED_MODEL` changes, any row that later goes through a reconcile UPDATE ends up holding a new-model vector under the old model's label. At that point the column isn't merely unread, it's wrong, and it's wrong in the one place someone would later look to write a backfill.  The read paths never mention it. `findSimilar` and `recall` compare the query vector against every row in the scope regardless of which model produced it.  ## The column type doesn't cover this  `embedding VECTOR(1536)` catches a change in dimension. It doesn't catch 
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this
  > Assigned to @ssrajadh. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1929](https://github.com/InsForge/InsForge/issues/1929) — a forget endpoint for agent memory, /api/memory has no way to remove a stored fa - [InsForge#1981](https://github.com/InsForge/InsForge/issues/1981) — `embedding_model` is recorded on insert, never set on update, and never checked 

- **Issue #1944** (2026-08-21): **[Bug]: Fix observability chart x-axis labels for unordered metric data**
  *Symptoms*: ### What's the bug?  Description  The observability metric chart can display incorrect x-axis time labels when metric data is returned in an unordered sequence.  Currently, the chart's end time label can be derived from the last item in the response array rather than the newest valid timestamp. When metric responses are not chronological, this can cause the x-axis labels to mismatch the actual chart data.  Expected Behavior  The chart should derive its time window from the newest finite metric timestamp, regardless of the order in which metric readings are returned.  Proposed Fix  Update the observability chart logic to:  Determine the newest finite metric timestamp from the response data. Use that timestamp when calculating the chart's x-axis time window. Ignore non-finite timestamp values. Testing  Add a regression test covering unordered metric responses and non-finite timestamp values.  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Assign this to me
  > Assigned to @Gautam-aman. Thanks for taking this on. You're now at the 3-issue limit.  Your open assigned issues (3/3): - [InsForge#1920](https://github.com/InsForge/InsForge/issues/1920) — the disk chart never renders the newest reading, so the last bar disagrees with  - [InsForge#1881](https://github.com/InsForge/InsForge/issues/1881) — D_TEST feature flag does not update UI when PostHog finishes loading - [InsForge#1944](https://github.com/InsForge/InsForge/issues/1944) — Fix observability chart x-axis labels for unordered metric data
  > unassign me 

- **Issue #1891** (2026-08-14): **[Bug]: AI Quick Start scripts load .env, but the setup step tells you to use .env.local**
  *Symptoms*: ### What's the bug?  Every generated AI Quick Start script begins with a bare `import 'dotenv/config'`, which loads **`.env`**. But step 3 of the same page tells you to put your key somewhere else:  - `AIQuickStartPage.tsx:275`: *"Add your OpenRouter API key to a `.env.local` file."* - `AIQuickStartPage.tsx:279`: a badge rendering the literal string `.env.local`  So a user who follows the Quick Start exactly ends up with `OPENROUTER_API_KEY` in `.env.local`, a script that never reads it, and an authentication failure on the first request, with nothing on the page to indicate why.  This affects **all four modes**. The `import 'dotenv/config'` lines are `constants.ts` 136, 157, 189, and 207, text, image, video, and embeddings alike. It is not specific to any one snippet.  Surfaced during review of #1889, where @greptile-apps and @cubic-dev-ai both flagged it against the new Embeddings snippet. It predates that PR, so it was left out to keep the diff scoped; @coderabbitai and @greptile-apps both suggested a separate issue covering all four modes together.   ### How to reproduce  1. Open **Model Gateway → Quick Start** in the dashboard. 2. Pick any mode (Text, Image, Video, or Embeddings). 3. Follow step 3 as written and put `OPENROUTER_API_KEY` in a `.env.local` file. 4. Copy the generated script and run it. 5. The request fails authentication, `dotenv/config` loaded `.env`, so the key is undefined.  I can open a PR for this once #1147 / #1889 is settled.
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this.  The fix can go one of two ways:  A: make the scripts read .env.local. Replace the bare import in all four snippets with import { config } from 'dotenv'; config({ path: '.env.local' });. Keeps the existing UI  copy and badge, and .env.local is the conventional choice for local secrets. B: change the guidance to .env. Update step3Description and the .env.local badge in AIQuickStartPage.tsx:275,279 plus all four locale files, leaving the scripts alone. Smaller diff.  A matches what the page already promises; B is less code. Let me know which direction works and I can open a PR.
  > Assigned to @ssrajadh. Thanks for taking this on. (1 more slot available.)  Your open assigned issues (2/3): - [InsForge#1147](https://github.com/InsForge/InsForge/issues/1147) — Embedding Models are not available in AI gateway - [InsForge#1891](https://github.com/InsForge/InsForge/issues/1891) — AI Quick Start scripts load .env, but the setup step tells you to use .env.local
  > Going with A, opening PR shortly

- **Issue #1883** (2026-08-20): **[Bug]: DTest install page does not redirect when onboarding is already complete**
  *Symptoms*: ### What's the bug?  I noticed that DTestInstallPage only redirects when onboarding transitions from incomplete to complete during the current session.  If hasCompletedOnboarding is already true on the initial render (for example, after revisiting or refreshing /dashboard/install), the redirect never occurs because the previous value is initialized to the current state.  Before submitting a fix, I wanted to confirm the intended behavior:  Should users who have already completed onboarding always be redirected away from /dashboard/install, or should they still be able to access the install page?  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Your reading of the mechanism is exactly right — `prevOnboarding` is seeded from the current value, so when `hasCompletedOnboarding` is already true on mount the `!prevOnboarding.current && hasCompletedOnboarding` condition never holds and no redirect fires.  On the question you actually asked, though, I think the current behaviour is intended and the redirect should **not** be broadened. Checked against `268d79d`.  The effect documents its own scope, `DTestInstallPage.tsx:26`:  ```ts // Auto-jump back to dashboard once onboarding flips false → true (e.g. an // MCP call lands while the user is mid-install). ```  That is a narrow job: the user is sitting on the install page, their first MCP call lands, and the page gets out of the way. Seeding the ref from the current value is what restricts it to that transition, so it reads as deliberate rather than accidental.  The reason I would not widen it is that `/dashboard/install` is a first-class destination, not just an onboarding step:  - `
  > @Chirag6722 Thanks for the detailed investigation. That makes sense ! .My initial concern was specifically about the initial hasCompletedOnboarding === true case, but I understand now that the current redirect is intentionally scoped to the false → true transition during the install flow.  I’ll close this issue as expected behavior. The ref naming/readability improvement is a good suggestion as well.

- **Issue #1832** (2026-08-03): **[Bug]: Schedule search duplicates function URL check instead of searching cron schedule**
  *Symptoms*: ### What's the bug?  ## Summary  The schedule search currently checks `functionUrl` twice instead of searching another schedule field.  Current implementation:  ```ts s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.functionUrl.toLowerCase().includes(searchQuery.toLowerCase()) || s.functionUrl.toLowerCase().includes(searchQuery.toLowerCase())  ### How to reproduce  _No response_  ### Environment (optional)  _No response_
  **Post-Mortem & Fix Analysis**:
  > Assign me this issue
  > Assigned to @Gautam-aman. Thanks for taking this on. (2 more slots available.)  Your open assigned issues (1/3): - [InsForge#1832](https://github.com/InsForge/InsForge/issues/1832) — Schedule search duplicates function URL check instead of searching cron schedule

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `87058283` (2026-09-26)
**Commit Message**: Merge pull request #2076 from prakharsingh-74/BUG/outage-permanent-data-loss-window

BUG: Adopt staged blue-green strategy for container updates

**File**: `backend/src/providers/compute/compute.provider.ts` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ import { ERROR_CODES } from '@insforge/shared-schemas';
 
 export interface LaunchMachineParams {
   appId: string;
+  /** Logical service name when different from container name/appId (e.g. during staged updates). */
+  serviceName?: string;
   /**
    * Image URL — image-mode (any registry) or source-mode (digest-pinned
    * registry.fly.io ref produced by the CLI's `flyctl deploy --build-only --push`).
```

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +149/-19)
```diff
@@ -41,7 +41,12 @@ const LABEL_SPEC = 'insforge.spec';
 type ContainerInspect = {
   Id: string;
   Name: string;
-  State: { Status: string; ExitCode: number; Running: boolean };
+  State: {
+    Status: string;
+    ExitCode: number;
+    Running: boolean;
+    Health?: { Status: 'starting' | 'healthy' | 'unhealthy' | string };
+  };
   Config: { Image: string; Labels?: Record<string, string> };
   HostConfig?: { NanoCpus?: number; Memory?: number };
   NetworkSettings: {
@@ -313,8 +318,9 @@ export class DockerProvider implements ComputeProvider {
   async launchMachine(
     params: LaunchMachineParams
   ): Promise<{ machineId: string; endpointUrl: string | null }> {
+    const serviceName = params.serviceName ?? params.appId;
     // Must precede create — see ensureImage.
-    await this.ensureImage(params.image, params.appId);
+    await this.ensureImage(params.image, serviceName);
 
     const network = await this.resolveNetwork();
     const ingress = this.ingressFor(params.ingress);
@@ -325,7 +331,7 @@ export class DockerProvider implements ComputeProvider {
       Labels: {
         [LABEL_MANAGED]: 'true',
         [LABEL_PROJECT]: this.projectKey(),
-        [LABEL_SERVICE]: params.appId,
+        [LABEL_SERVICE]: serviceName,
         [LABEL_SPEC]: this.specHash(params),
       },
       Env: Object.entries(params.envVars ?? {}).map(([k, v]) => `${k}=${v}`),
@@ -419,21 +425,16 @@ export class DockerProvider implements ComputeProvider {
         return {};
       }
 
-      // Recreate under the same name. Stop and remove first because the name is
-      // taken; if creating the replacement then fails, the row is left pointing
-      // at a removed container, which the existing MachineGoneError healing turns
-      // into a clean relaunch on the next request.
-      const name = (current.Name ?? '').replace(/^\//, '') || params.appId;
-      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
-        () => undefined
-      );
-      await dockerRequest(
-        'DELETE',
-        `/containers/${encodeURIComponent(params.machineId)}?force=true`
-      );
+      // Recreate using a Create-Before-Destroy (Staged Blue-Green) pattern.
+      // Launch the replacement container under a temporary staging identifier alongside
+      // the existing workload. If pulling the image, creating the container, or starting
+      // it fails, the original container is untouched and remains online serving live traffic.
+      const primaryName = (current.Name ?? '').replace(/^\//, '') || params.appId;
+      const stagingName = `${primaryName}-stage-${Date.now()}`;
 
       const launched = await this.launchMachine({
-        appId: name,
+        appId: stagingName,
+        serviceName: primaryName,
         image: params.image,
         port: params.port,
         cpu: params.cpu,
@@ -444,13 +445,88 @@ export class DockerProvider implements ComputeProvider {
         protocol: params.protocol,
         scaleToZero: params.scaleToZero,
       });
+
+      // Readiness Gate: verify the staging container is genuinely running and healthy
+      // before touching the original. Docker POST /start returns 204 immediately when
+      // the process starts; if the entrypoint crashes right after, state flips to
+      // 'exited'/'dead'. When the image defines a HEALTHCHECK, the initial status is
+      // 'starting' — accepting that would destroy the original before the first probe
+      // completes. Poll until health resolves or a timeout expires.
+      try {
+        await this.awaitStagingReady(launched.machineId);
+      } catch (err) {
+        await dockerRequest(
+          'DELETE',
+          `/containers/${encodeURIComponent(launched.machineId)}?force=true`
+        ).catch(() => undefined);
+        throw err;
+      }
+
+      // Promotion via rename-swap: the old container is never destroyed until the
+      // staging container successfully assumes the primary name. If any
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +403/-18)
```diff
@@ -436,7 +436,7 @@ describe('DockerProvider', () => {
     // The bug this guards: Docker cannot swap a running container's image, so
     // applying only cpu/memory would report success while the old image keeps
     // serving and the database records the new one.
-    it('recreates the container when the image changes, and reports the new id', async () => {
+    it('recreates the container when the image changes using staged blue-green strategy, and reports the new id', async () => {
       const oldSpec = await hashFor(baseSpec);
       mockRequest
         .mockResolvedValueOnce(
@@ -452,10 +452,15 @@ describe('DockerProvider', () => {
             },
           })
         )
-        .mockResolvedValueOnce(undefined) // stop
-        .mockResolvedValueOnce(undefined) // remove
-        .mockResolvedValueOnce({ Id: 'container-new' }) // create
-        .mockResolvedValueOnce(undefined); // start
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        ) // readiness check (no HEALTHCHECK — passes immediately)
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -466,15 +471,390 @@ describe('DockerProvider', () => {
 
       expect(result).toEqual({ machineId: 'container-new', endpointUrl: null });
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
-      expect(paths).toEqual([
-        'GET /containers/container-abc/json',
-        'POST /containers/container-abc/stop',
-        'DELETE /containers/container-abc?force=true',
-        'POST /containers/create?name=insforge-testkey1-api',
-        'POST /containers/container-new/start',
-      ]);
-      // Replacement runs the requested image, under the original name.
-      expect(mockRequest.mock.calls[3][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(paths[0]).toBe('GET /containers/container-abc/json');
+      expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
+      expect(paths[2]).toBe('POST /containers/container-new/start');
+      expect(paths[3]).toBe('GET /containers/container-new/json');
+      // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
+      expect(paths[4]).toMatch(
+        /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/
+      );
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      expect(paths[6]).toBe('POST /containers/container-abc/stop');
+      expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
+
+      // Replacement runs requested image and carries logical service name.
+      expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(mockRequest.mock.calls[1][2].body.Labels['insforge.service']).toBe(
+        'insforge-testkey1-api'
+      );
+    });
+
+    it('preserves old container untouched if staging launch fails (zero downtime)', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-doomed' }) // create staging succeeds
+        .mockRejectedValue
```

---

### Incident Patch 2: `d6ab4266` (2026-09-26)
**Commit Message**: prettier fixed

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +7/-5)
```diff
@@ -476,7 +476,9 @@ describe('DockerProvider', () => {
       expect(paths[2]).toBe('POST /containers/container-new/start');
       expect(paths[3]).toBe('GET /containers/container-new/json');
       // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
-      expect(paths[4]).toMatch(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/);
+      expect(paths[4]).toMatch(
+        /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/
+      );
       expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
       expect(paths[6]).toBe('POST /containers/container-abc/stop');
       expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
@@ -758,9 +760,7 @@ describe('DockerProvider', () => {
       await vi.advanceTimersByTimeAsync(35_000);
       vi.useRealTimers();
 
-      await expect(promise).rejects.toThrow(
-        /health check did not resolve within 30000ms/
-      );
+      await expect(promise).rejects.toThrow(/health check did not resolve within 30000ms/);
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
       expect(paths).not.toContain('POST /containers/container-abc/stop');
       expect(paths).toContain('DELETE /containers/container-slow?force=true');
@@ -847,7 +847,9 @@ describe('DockerProvider', () => {
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
       // The old container must be restored to its primary name — service stays online.
       expect(paths).toContainEqual(
-        expect.stringMatching(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api$/)
+        expect.stringMatching(
+          /^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api$/
+        )
       );
       // Staging must be cleaned up.
       expect(paths).toContain('DELETE /containers/container-new?force=true');
```

---

### Incident Patch 3: `c7cf0356` (2026-09-26)
**Commit Message**: Eslint Fixed

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +4/-8)
```diff
@@ -512,10 +512,9 @@ export class DockerProvider implements ComputeProvider {
       // Step 3: Tear down the retired container. It is now safely renamed and the
       // staging container owns the primary name. A failure here is non-fatal — the
       // retired container is just an orphan that stop/force-remove will clean up.
-      await dockerRequest(
-        'POST',
-        `/containers/${encodeURIComponent(params.machineId)}/stop`
-      ).catch(() => undefined);
+      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
+        () => undefined
+      );
       await dockerRequest(
         'DELETE',
         `/containers/${encodeURIComponent(params.machineId)}?force=true`
@@ -573,10 +572,7 @@ export class DockerProvider implements ComputeProvider {
    * status. `running` is accepted immediately because there is no further
    * readiness probe to wait for.
    */
-  private async awaitStagingReady(
-    machineId: string,
-    timeoutMs = 30_000
-  ): Promise<void> {
+  private async awaitStagingReady(machineId: string, timeoutMs = 30_000): Promise<void> {
     const start = Date.now();
     const pollMs = 1_000;
 
```

---

### Incident Patch 4: `fbae0614` (2026-09-26)
**Commit Message**: Merge branch 'main' into BUG/outage-permanent-data-loss-window

**File**: `README.md` (modified, +3/-3)
```diff
@@ -256,9 +256,9 @@ See the [self-hosted storage guide](https://docs.insforge.dev/deployment/self-ho
 
 In addition to running InsForge locally, you can also launch InsForge using a pre-configured setup. This allows you to get up and running quickly with InsForge without installing Docker on your local machine.
 
-| Railway | Zeabur | Sealos | RepoCloud |
-| --- | --- | --- | --- |
-| [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/insforge) | [![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/Q82M3Y) | [![Deploy on Sealos](https://sealos.io/Deploy-on-Sealos.svg)](https://sealos.io/products/app-store/insforge) | [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/InsForge/) |
+| Railway | Zeabur | Sealos | RepoCloud | ZopDay |
+| --- | --- | --- | --- | --- |
+| [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/insforge) | [![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/Q82M3Y) | [![Deploy on Sealos](https://sealos.io/Deploy-on-Sealos.svg)](https://sealos.io/products/app-store/insforge) | [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/InsForge/) | [![Deploy on ZopDay](https://zop.dev/deploytozopday-inkhard.svg)](https://zop.dev/zopday/app/deploy?image=ghcr.io/insforge/insforge-oss:latest&port=7130) |
 
 
 ## Contributing
```

---

### Incident Patch 5: `1cad3567` (2026-09-26)
**Commit Message**: fix(docker): poll health readiness and use rename-swap for safe cutover

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +95/-22)
```diff
@@ -446,20 +446,14 @@ export class DockerProvider implements ComputeProvider {
         scaleToZero: params.scaleToZero,
       });
 
-      // Readiness Gate: Verify raw Docker status is strictly 'running' and health is not 'unhealthy'.
-      // Docker POST /start returns HTTP 204 immediately when process starts. If entrypoint crashes right after,
-      // state will be non-running ('exited'/'stopped'/'dead'/'failed'/'restarting').
-      // Catch inspection failures so transient errors do not leak untracked staging containers.
+      // Readiness Gate: verify the staging container is genuinely running and healthy
+      // before touching the original. Docker POST /start returns 204 immediately when
+      // the process starts; if the entrypoint crashes right after, state flips to
+      // 'exited'/'dead'. When the image defines a HEALTHCHECK, the initial status is
+      // 'starting' — accepting that would destroy the original before the first probe
+      // completes. Poll until health resolves or a timeout expires.
       try {
-        const inspect = await this.assertOwned(launched.machineId);
-        const status = inspect.State?.Status;
-        const health = inspect.State?.Health?.Status;
-
-        if (status !== 'running' || health === 'unhealthy') {
-          throw new Error(
-            `Staging container failed readiness check (status: ${status}${health ? `, health: ${health}` : ''})`
-          );
-        }
+        await this.awaitStagingReady(launched.machineId);
       } catch (err) {
         await dockerRequest(
           'DELETE',
@@ -468,34 +462,44 @@ export class DockerProvider implements ComputeProvider {
         throw err;
       }
 
-      // Teardown superseded container once replacement is verified up and healthy.
+      // Promotion via rename-swap: the old container is never destroyed until the
+      // staging container successfully assumes the primary name. If any step fails,
+      // the old container is restored under its original name so the service stays
+      // online.
+      const retireName = `${primaryName}-retire-${Date.now()}`;
+
+      // Step 1: Move the old container out of the way by renaming to a retire name.
+      // This frees the primary name for the staging container without deleting anything.
       try {
         await dockerRequest(
           'POST',
-          `/containers/${encodeURIComponent(params.machineId)}/stop`
-        ).catch(() => undefined);
-        await dockerRequest(
-          'DELETE',
-          `/containers/${encodeURIComponent(params.machineId)}?force=true`
+          `/containers/${encodeURIComponent(params.machineId)}/rename?name=${encodeURIComponent(retireName)}`
         );
       } catch (err) {
+        // Old container could not be renamed — it is still running under the primary
+        // name. Clean up staging and surface the error; service remains online.
         await dockerRequest(
           'DELETE',
           `/containers/${encodeURIComponent(launched.machineId)}?force=true`
         ).catch(() => undefined);
         throw new Error(
-          `Failed to remove superseded container ${params.machineId}: ${err instanceof Error ? err.message : String(err)}`
+          `Failed to retire old container ${params.machineId}: ${err instanceof Error ? err.message : String(err)}`
         );
       }
 
-      // Atomic rename of staging container to primary application name (Promotion).
-      // If rename fails (e.g. name conflict), remove staging container and throw so success is never reported on failed promotion.
+      // Step 2: Promote staging container to the primary name.
       try {
         await dockerRequest(
           'POST',
           `/containers/${encodeURIComponent(launched.machineId)}/rename?name=${encodeURIComponent(primaryName)}`
         );
       } catch (err) {
+        // Promotion failed — restore the old container to its original name so the
+        // service remains available, then clean up s
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +231/-17)
```diff
@@ -456,10 +456,11 @@ describe('DockerProvider', () => {
         .mockResolvedValueOnce(undefined) // start staging
         .mockResolvedValueOnce(
           ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
-        ) // readiness check
-        .mockResolvedValueOnce(undefined) // stop old
-        .mockResolvedValueOnce(undefined) // remove old
-        .mockResolvedValueOnce(undefined); // rename staging
+        ) // readiness check (no HEALTHCHECK — passes immediately)
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -474,9 +475,11 @@ describe('DockerProvider', () => {
       expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
       expect(paths[2]).toBe('POST /containers/container-new/start');
       expect(paths[3]).toBe('GET /containers/container-new/json');
-      expect(paths[4]).toBe('POST /containers/container-abc/stop');
-      expect(paths[5]).toBe('DELETE /containers/container-abc?force=true');
-      expect(paths[6]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      // Rename-swap: old renamed to retire, staging renamed to primary, then old torn down.
+      expect(paths[4]).toMatch(/^POST \/containers\/container-abc\/rename\?name=insforge-testkey1-api-retire-\d+$/);
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+      expect(paths[6]).toBe('POST /containers/container-abc/stop');
+      expect(paths[7]).toBe('DELETE /containers/container-abc?force=true');
 
       // Replacement runs requested image and carries logical service name.
       expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
@@ -602,7 +605,168 @@ describe('DockerProvider', () => {
       expect(paths).toContain('DELETE /containers/container-inspect-fail?force=true');
     });
 
-    it('cleans up staging container and rejects when promotion rename fails', async () => {
+    it('polls until health check resolves from starting to healthy before cutover', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        // First readiness poll: health is 'starting' — must not proceed yet.
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Id: 'container-new',
+            State: { Status: 'running', Health: { Status: 'starting' } },
+          })
+        )
+        // Second readiness poll: health resolves to 'healthy' — proceed.
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Id: 'container-new',
+            State: { Status: 'running', Health: { Status: 'healthy' } },
+          })
+        )
+        .mockResolvedValueOnce(undefined) // rename old → retire
+        .mockResolvedValueOnce(undefined) // rename staging → primary
+        .mockResolvedValueOnce(undefined) // stop retired
+        .mockResolvedValueOnce(undefined); // delete retired
+      imageAlreadyPresent();
+
+      vi.useFakeTimers();
+      const promise = provider.updateMachine({
+        ...baseSpec,
+        machineId: 'container-abc',
+        image: 'nginx:1.27-alpine',
+      });
+      // Advance past the poll delay so awa
```

---

### Incident Patch 6: `4b0924aa` (2026-09-23)
**Commit Message**: fix Prettier code formatting in docker-provider unit test

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +10/-3)
```diff
@@ -454,7 +454,9 @@ describe('DockerProvider', () => {
         )
         .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
         .mockResolvedValueOnce(undefined) // start staging
-        .mockResolvedValueOnce(ownedContainer({ Id: 'container-new', State: { Status: 'running' } })) // readiness check
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        ) // readiness check
         .mockResolvedValueOnce(undefined) // stop old
         .mockResolvedValueOnce(undefined) // remove old
         .mockResolvedValueOnce(undefined); // rename staging
@@ -540,7 +542,10 @@ describe('DockerProvider', () => {
         .mockResolvedValueOnce({ Id: 'container-crashed' }) // create staging succeeds
         .mockResolvedValueOnce(undefined) // start staging returns 204
         .mockResolvedValueOnce(
-          ownedContainer({ Id: 'container-crashed', State: { Status: 'exited', ExitCode: 1, Running: false } })
+          ownedContainer({
+            Id: 'container-crashed',
+            State: { Status: 'exited', ExitCode: 1, Running: false },
+          })
         ) // readiness check returns exited
         .mockResolvedValueOnce(undefined); // delete staging
 
@@ -579,7 +584,9 @@ describe('DockerProvider', () => {
         )
         .mockResolvedValueOnce({ Id: 'container-new' })
         .mockResolvedValueOnce(undefined)
-        .mockResolvedValueOnce(ownedContainer({ Id: 'container-new', State: { Status: 'running' } }))
+        .mockResolvedValueOnce(
+          ownedContainer({ Id: 'container-new', State: { Status: 'running' } })
+        )
         .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined)
         .mockResolvedValueOnce(undefined);
```

---

### Incident Patch 7: `4255df35` (2026-09-23)
**Commit Message**: fix(backend): adopt staged blue-green strategy for container updates in DockerProvider

**File**: `backend/src/providers/compute/compute.provider.ts` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ import { ERROR_CODES } from '@insforge/shared-schemas';
 
 export interface LaunchMachineParams {
   appId: string;
+  /** Logical service name when different from container name/appId (e.g. during staged updates). */
+  serviceName?: string;
   /**
    * Image URL — image-mode (any registry) or source-mode (digest-pinned
    * registry.fly.io ref produced by the CLI's `flyctl deploy --build-only --push`).
```

**File**: `backend/src/providers/compute/docker.provider.ts` (modified, +35/-17)
```diff
@@ -313,8 +313,9 @@ export class DockerProvider implements ComputeProvider {
   async launchMachine(
     params: LaunchMachineParams
   ): Promise<{ machineId: string; endpointUrl: string | null }> {
+    const serviceName = params.serviceName ?? params.appId;
     // Must precede create — see ensureImage.
-    await this.ensureImage(params.image, params.appId);
+    await this.ensureImage(params.image, serviceName);
 
     const network = await this.resolveNetwork();
     const ingress = this.ingressFor(params.ingress);
@@ -325,7 +326,7 @@ export class DockerProvider implements ComputeProvider {
       Labels: {
         [LABEL_MANAGED]: 'true',
         [LABEL_PROJECT]: this.projectKey(),
-        [LABEL_SERVICE]: params.appId,
+        [LABEL_SERVICE]: serviceName,
         [LABEL_SPEC]: this.specHash(params),
       },
       Env: Object.entries(params.envVars ?? {}).map(([k, v]) => `${k}=${v}`),
@@ -419,21 +420,16 @@ export class DockerProvider implements ComputeProvider {
         return {};
       }
 
-      // Recreate under the same name. Stop and remove first because the name is
-      // taken; if creating the replacement then fails, the row is left pointing
-      // at a removed container, which the existing MachineGoneError healing turns
-      // into a clean relaunch on the next request.
-      const name = (current.Name ?? '').replace(/^\//, '') || params.appId;
-      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
-        () => undefined
-      );
-      await dockerRequest(
-        'DELETE',
-        `/containers/${encodeURIComponent(params.machineId)}?force=true`
-      );
+      // Recreate using a Create-Before-Destroy (Staged Blue-Green) pattern.
+      // Launch the replacement container under a temporary staging identifier alongside
+      // the existing workload. If pulling the image, creating the container, or starting
+      // it fails, the original container is untouched and remains online serving live traffic.
+      const primaryName = (current.Name ?? '').replace(/^\//, '') || params.appId;
+      const stagingName = `${primaryName}-stage-${Date.now()}`;
 
       const launched = await this.launchMachine({
-        appId: name,
+        appId: stagingName,
+        serviceName: primaryName,
         image: params.image,
         port: params.port,
         cpu: params.cpu,
@@ -444,14 +440,36 @@ export class DockerProvider implements ComputeProvider {
         protocol: params.protocol,
         scaleToZero: params.scaleToZero,
       });
+
+      // Teardown superseded container once replacement is up and healthy.
+      await dockerRequest('POST', `/containers/${encodeURIComponent(params.machineId)}/stop`).catch(
+        () => undefined
+      );
+      await dockerRequest(
+        'DELETE',
+        `/containers/${encodeURIComponent(params.machineId)}?force=true`
+      ).catch(() => undefined);
+
+      // Atomic rename of staging container to primary application name.
+      await dockerRequest(
+        'POST',
+        `/containers/${encodeURIComponent(launched.machineId)}/rename?name=${encodeURIComponent(primaryName)}`
+      );
+
+      const endpointUrl = await this.resolvePublishedUrl(
+        launched.machineId,
+        params.port,
+        params.ingress
+      );
+
       logger.info('Docker compute: recreated container to apply a spec change', {
-        name,
+        name: primaryName,
         previous: params.machineId.slice(0, 12),
         replacement: launched.machineId.slice(0, 12),
       });
       // The replacement's published port is newly assigned, so the URL has to
       // travel with the new id.
-      return { machineId: launched.machineId, endpointUrl: launched.endpointUrl };
+      return { machineId: launched.machineId, endpointUrl };
     });
   }
 
```

**File**: `backend/tests/unit/compute/docker-provider.test.ts` (modified, +58/-15)
```diff
@@ -436,7 +436,7 @@ describe('DockerProvider', () => {
     // The bug this guards: Docker cannot swap a running container's image, so
     // applying only cpu/memory would report success while the old image keeps
     // serving and the database records the new one.
-    it('recreates the container when the image changes, and reports the new id', async () => {
+    it('recreates the container when the image changes using staged blue-green strategy, and reports the new id', async () => {
       const oldSpec = await hashFor(baseSpec);
       mockRequest
         .mockResolvedValueOnce(
@@ -452,10 +452,11 @@ describe('DockerProvider', () => {
             },
           })
         )
-        .mockResolvedValueOnce(undefined) // stop
-        .mockResolvedValueOnce(undefined) // remove
-        .mockResolvedValueOnce({ Id: 'container-new' }) // create
-        .mockResolvedValueOnce(undefined); // start
+        .mockResolvedValueOnce({ Id: 'container-new' }) // create staging
+        .mockResolvedValueOnce(undefined) // start staging
+        .mockResolvedValueOnce(undefined) // stop old
+        .mockResolvedValueOnce(undefined) // remove old
+        .mockResolvedValueOnce(undefined); // rename staging
       imageAlreadyPresent();
 
       const result = await provider.updateMachine({
@@ -466,15 +467,56 @@ describe('DockerProvider', () => {
 
       expect(result).toEqual({ machineId: 'container-new', endpointUrl: null });
       const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
-      expect(paths).toEqual([
-        'GET /containers/container-abc/json',
-        'POST /containers/container-abc/stop',
-        'DELETE /containers/container-abc?force=true',
-        'POST /containers/create?name=insforge-testkey1-api',
-        'POST /containers/container-new/start',
-      ]);
-      // Replacement runs the requested image, under the original name.
-      expect(mockRequest.mock.calls[3][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(paths[0]).toBe('GET /containers/container-abc/json');
+      expect(paths[1]).toMatch(/^POST \/containers\/create\?name=insforge-testkey1-api-stage-\d+$/);
+      expect(paths[2]).toBe('POST /containers/container-new/start');
+      expect(paths[3]).toBe('POST /containers/container-abc/stop');
+      expect(paths[4]).toBe('DELETE /containers/container-abc?force=true');
+      expect(paths[5]).toBe('POST /containers/container-new/rename?name=insforge-testkey1-api');
+
+      // Replacement runs requested image and carries logical service name.
+      expect(mockRequest.mock.calls[1][2].body.Image).toBe('nginx:1.27-alpine');
+      expect(mockRequest.mock.calls[1][2].body.Labels['insforge.service']).toBe(
+        'insforge-testkey1-api'
+      );
+    });
+
+    it('preserves old container untouched if staging launch fails (zero downtime)', async () => {
+      const oldSpec = await hashFor(baseSpec);
+      mockRequest
+        .mockResolvedValueOnce(
+          ownedContainer({
+            Name: '/insforge-testkey1-api',
+            Config: {
+              Image: 'nginx:alpine',
+              Labels: {
+                'insforge.managed': 'true',
+                'insforge.project': 'testkey1',
+                'insforge.spec': oldSpec,
+              },
+            },
+          })
+        )
+        .mockResolvedValueOnce({ Id: 'container-doomed' }) // create staging succeeds
+        .mockRejectedValueOnce(new Error('container entrypoint crashed')) // start staging fails
+        .mockResolvedValueOnce(undefined); // cleanup doomed staging container
+
+      imageAlreadyPresent();
+
+      await expect(
+        provider.updateMachine({
+          ...baseSpec,
+          machineId: 'container-abc',
+          image: 'nginx:1.27-alpine',
+        })
+      ).rejects.toThrow('container entrypoint crashed');
+
+      const paths = mockRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
+      // Must NOT contain stop or delete for the old container-abc
+      e
```

---

### Incident Patch 8: `52b95bfa` (2026-09-08)
**Commit Message**: Merge pull request #2051 from InsForge/fix/shared-oauth-forged-callback

fix(auth): require a cloud-signed identity on shared OAuth callbacks

**File**: `backend/src/api/routes/auth/oauth.routes.ts` (modified, +28/-8)
```diff
@@ -3,6 +3,7 @@ import { AuthService } from '@/services/auth/auth.service.js';
 import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
 import { AuthConfigService } from '@/services/auth/auth-config.service.js';
 import { OAuthPKCEService } from '@/services/auth/oauth-pkce.service.js';
+import { SharedOAuthService } from '@/services/auth/shared-oauth.service.js';
 import { AuditService } from '@/services/logs/audit.service.js';
 import { TokenManager } from '@/infra/security/token.manager.js';
 import { AppError } from '@/utils/errors.js';
@@ -30,6 +31,7 @@ const authService = AuthService.getInstance();
 const authConfigService = AuthConfigService.getInstance();
 const oAuthConfigService = OAuthConfigService.getInstance();
 const oAuthPKCEService = OAuthPKCEService.getInstance();
+const sharedOAuthService = SharedOAuthService.getInstance();
 const auditService = AuditService.getInstance();
 
 // Helper function to validate JWT_SECRET
@@ -316,7 +318,7 @@ router.get('/shared/callback/:state', async (req: Request, res: Response, next:
 
   try {
     const { state } = req.params;
-    const { success, error, payload } = req.query;
+    const { success, error, token } = req.query;
 
     if (!state) {
       logger.warn('Shared OAuth callback called without state parameter');
@@ -351,6 +353,19 @@ router.get('/shared/callback/:state', async (req: Request, res: Response, next:
       );
     }
     const validatedProvider = providerValidation.data;
+
+    const oauthConfig = await oAuthConfigService.getConfigByProvider(validatedProvider);
+    if (!oauthConfig?.useSharedKey) {
+      logger.warn('Shared callback used by a provider that is not on shared keys', {
+        provider: validatedProvider,
+      });
+      throw new AppError(
+        `${validatedProvider} is not configured to use InsForge shared OAuth keys`,
+        400,
+        ERROR_CODES.INVALID_INPUT
+      );
+    }
+
     if (!redirectUri) {
       throw new AppError('redirectUri is required', 400, ERROR_CODES.INVALID_INPUT);
     }
@@ -380,16 +395,21 @@ router.get('/shared/callback/:state', async (req: Request, res: Response, next:
     }
 
     try {
-      if (!payload) {
-        throw new AppError('No payload provided in callback', 400, ERROR_CODES.INVALID_INPUT);
+      if (typeof token !== 'string' || !token) {
+        throw new AppError(
+          'No identity token provided in callback',
+          400,
+          ERROR_CODES.INVALID_INPUT
+        );
       }
 
-      const payloadData = JSON.parse(
-        Buffer.from(payload as string, 'base64').toString('utf8')
-      ) as Record<string, unknown>;
+      const identity = sharedOAuthService.verifyIdentityToken(token, {
+        provider: validatedProvider,
+        state,
+      });
 
-      // Handle shared callback - transforms payload and creates/finds user
-      const result = await authService.handleSharedCallback(validatedProvider, payloadData);
+      // Handle shared callback - transforms identity and creates/finds user
+      const result = await authService.handleSharedCallback(validatedProvider, identity);
 
       // Create exchange code for PKCE flow (instead of exposing tokens in URL)
       // Only store minimal data - user and token are fetched fresh on exchange
```

**File**: `backend/src/providers/oauth/apple.provider.ts` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
 import logger from '@/utils/logger.js';
 import { getApiBaseUrl } from '@/utils/environment.js';
 import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
+import { buildSharedOAuthInitQuery } from '@/services/auth/shared-oauth.service.js';
 import type { AppleUserInfo, OAuthUserData } from '@/types/auth.js';
 import { OAuthProvider } from './base.provider.js';
 
@@ -103,7 +104,7 @@ export class AppleOAuthProvider implements OAuthProvider {
       const cloudBaseUrl = process.env.CLOUD_API_HOST || 'https://api.insforge.dev';
       const redirectUri = `${selfBaseUrl}/api/auth/oauth/shared/callback/${state}`;
       const response = await axios.get(
-        `${cloudBaseUrl}/auth/v1/shared/apple?redirect_uri=${encodeURIComponent(redirectUri)}`,
+        `${cloudBaseUrl}/auth/v1/shared/apple?${buildSharedOAuthInitQuery(redirectUri, state)}`,
         {
           headers: {
             'Content-Type': 'application/json',
```

**File**: `backend/src/providers/oauth/discord.provider.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import axios from 'axios';
 import logger from '@/utils/logger.js';
 import { getApiBaseUrl } from '@/utils/environment.js';
 import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
+import { buildSharedOAuthInitQuery } from '@/services/auth/shared-oauth.service.js';
 import { OAuthProvider } from './base.provider.js';
 import type { DiscordUserInfo, OAuthUserData } from '@/types/auth.js';
 
@@ -48,7 +49,7 @@ export class DiscordOAuthProvider implements OAuthProvider {
       const cloudBaseUrl = process.env.CLOUD_API_HOST || 'https://api.insforge.dev';
       const redirectUri = `${selfBaseUrl}/api/auth/oauth/shared/callback/${state}`;
       const response = await axios.get(
-        `${cloudBaseUrl}/auth/v1/shared/discord?redirect_uri=${encodeURIComponent(redirectUri)}`,
+        `${cloudBaseUrl}/auth/v1/shared/discord?${buildSharedOAuthInitQuery(redirectUri, state)}`,
         {
           headers: {
             'Content-Type': 'application/json',
```

**File**: `backend/src/providers/oauth/facebook.provider.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import axios from 'axios';
 import logger from '@/utils/logger.js';
 import { getApiBaseUrl } from '@/utils/environment.js';
 import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
+import { buildSharedOAuthInitQuery } from '@/services/auth/shared-oauth.service.js';
 import { OAuthProvider } from './base.provider.js';
 import type { FacebookUserInfo, OAuthUserData } from '@/types/auth.js';
 
@@ -47,7 +48,7 @@ export class FacebookOAuthProvider implements OAuthProvider {
       const cloudBaseUrl = process.env.CLOUD_API_HOST || 'https://api.insforge.dev';
       const redirectUri = `${selfBaseUrl}/api/auth/oauth/shared/callback/${state}`;
       const response = await axios.get(
-        `${cloudBaseUrl}/auth/v1/shared/facebook?redirect_uri=${encodeURIComponent(redirectUri)}`,
+        `${cloudBaseUrl}/auth/v1/shared/facebook?${buildSharedOAuthInitQuery(redirectUri, state)}`,
         {
           headers: {
             'Content-Type': 'application/json',
```

**File**: `backend/src/providers/oauth/github.provider.ts` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ import axios from 'axios';
 import logger from '@/utils/logger.js';
 import { getApiBaseUrl } from '@/utils/environment.js';
 import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
+import { buildSharedOAuthInitQuery } from '@/services/auth/shared-oauth.service.js';
 import type { GitHubUserInfo, GitHubEmailInfo, OAuthUserData } from '@/types/auth.js';
 import { OAuthProvider } from './base.provider.js';
 
@@ -48,7 +49,7 @@ export class GitHubOAuthProvider implements OAuthProvider {
       const cloudBaseUrl = process.env.CLOUD_API_HOST || 'https://api.insforge.dev';
       const redirectUri = `${selfBaseUrl}/api/auth/oauth/shared/callback/${state}`;
       const response = await axios.get(
-        `${cloudBaseUrl}/auth/v1/shared/github?redirect_uri=${encodeURIComponent(redirectUri)}`,
+        `${cloudBaseUrl}/auth/v1/shared/github?${buildSharedOAuthInitQuery(redirectUri, state)}`,
         {
           headers: {
             'Content-Type': 'application/json',
```

---

### Incident Patch 9: `12d731a0` (2026-09-07)
**Commit Message**: fix(auth): verify the shared OAuth identity with this project's own secret

An assertion is delivered through the user's browser, and anything the cloud
JWKS verifies is a cloud-backend credential to an instance — verifyCloudBackend
authenticates on the signature alone and skips the project comparison when
PROJECT_ID is unset. Signing the assertion with that key handed a caller a token
that satisfied it.

Verification moves to this project's JWT_SECRET, which the cloud already holds,
and the assertion is rejected if it carries a subject, so it can never be read
as one of our own access tokens either.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `backend/src/api/routes/auth/oauth.routes.ts` (modified, +1/-1)
```diff
@@ -403,7 +403,7 @@ router.get('/shared/callback/:state', async (req: Request, res: Response, next:
         );
       }
 
-      const identity = await sharedOAuthService.verifyIdentityToken(token, {
+      const identity = sharedOAuthService.verifyIdentityToken(token, {
         provider: validatedProvider,
         state,
       });
```

**File**: `backend/src/services/auth/shared-oauth.service.ts` (modified, +33/-8)
```diff
@@ -1,4 +1,5 @@
 import crypto from 'crypto';
+import jwt from 'jsonwebtoken';
 import { ERROR_CODES } from '@insforge/shared-schemas';
 import { AppError } from '@/utils/errors.js';
 import { appConfig } from '@/infra/config/app.config.js';
@@ -17,6 +18,18 @@ function sharedOAuthFlowId(state: string): string {
   return crypto.createHash('sha256').update(state).digest('hex');
 }
 
+function validateJwtSecret(): string {
+  const jwtSecret = appConfig.app.jwtSecret;
+  if (!jwtSecret) {
+    throw new AppError(
+      'JWT_SECRET environment variable is not configured.',
+      500,
+      ERROR_CODES.INTERNAL_ERROR
+    );
+  }
+  return jwtSecret;
+}
+
 /**
  * Query string for the cloud shared-OAuth start endpoint. `sign` proves we hold this
  * project's JWT_SECRET, which is what lets the cloud bind its identity assertion to us.
@@ -36,8 +49,10 @@ export function buildSharedOAuthInitQuery(redirectUri: string, state: string): s
 /**
  * Verifies the identity the cloud OAuth proxy asserts on a shared-provider callback.
  *
- * The assertion travels through the user's browser, so none of it is identity until
- * the cloud signature, the project binding and the flow binding all hold.
+ * The assertion travels through the user's browser, so none of it is identity until the
+ * signature, the project binding and the flow binding all hold. It is signed with this
+ * project's JWT_SECRET rather than the cloud JWKS key, which every instance accepts as
+ * cloud-backend authority.
  */
 export class SharedOAuthService {
   private static instance: SharedOAuthService;
@@ -51,18 +66,28 @@ export class SharedOAuthService {
     return SharedOAuthService.instance;
   }
 
-  public async verifyIdentityToken(
+  public verifyIdentityToken(
     token: string,
     context: { provider: string; state: string }
-  ): Promise<Record<string, unknown>> {
-    const { payload } = await TokenManager.getInstance().verifyCloudToken(token);
+  ): Record<string, unknown> {
+    let payload: jwt.JwtPayload;
+    try {
+      payload = jwt.verify(token, validateJwtSecret(), {
+        algorithms: ['HS256'],
+      }) as jwt.JwtPayload;
+    } catch {
+      throw this.reject('Shared OAuth identity assertion is not signed for us', context.provider);
+    }
 
     if (payload.type !== IDENTITY_TOKEN_TYPE) {
-      throw this.reject('Cloud token is not a shared OAuth identity assertion', context.provider);
+      throw this.reject('Signed token is not a shared OAuth identity assertion', context.provider);
+    }
+
+    // An assertion that carried a subject would also verify as one of our access tokens
+    if (payload.sub !== undefined) {
+      throw this.reject('Shared OAuth identity assertion carries a subject', context.provider);
     }
 
-    // verifyCloudToken only compares project ids when PROJECT_ID is set; an assertion
-    // minted for another project must not be accepted just because ours is unset
     if (!appConfig.cloud.projectId || payload.projectId !== appConfig.cloud.projectId) {
       throw this.reject('Shared OAuth identity is for a different project', context.provider);
     }
```

**File**: `backend/tests/unit/shared-oauth-identity.test.ts` (modified, +75/-50)
```diff
@@ -1,139 +1,164 @@
 /**
  * The shared-OAuth callback used to accept a base64 `payload` query parameter as
  * identity, so anyone could mint a session for any email. These pin the checks that
- * replaced it: cloud signature, project binding, flow binding, single use.
+ * replaced it: the assertion is signed with this project's own secret, for this
+ * project, this provider and this login attempt, and it is usable once.
  */
 import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
 import crypto from 'crypto';
+import jwt from 'jsonwebtoken';
 
-const verifyCloudToken = vi.fn();
 const signCloudToken = vi.fn(() => 'project-sign-token');
 
 vi.mock('../../src/infra/security/token.manager.js', () => ({
-  TokenManager: { getInstance: () => ({ verifyCloudToken, signCloudToken }) },
+  TokenManager: { getInstance: () => ({ signCloudToken }) },
 }));
 vi.mock('../../src/utils/logger.js', () => ({
   default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
 }));
 
 const PROJECT_ID = 'project-under-test';
+const JWT_SECRET = 'this-projects-jwt-secret';
 const STATE = 'state-jwt-for-this-login-attempt';
 const FLOW_ID = crypto.createHash('sha256').update(STATE).digest('hex');
+const IDENTITY = { providerId: '42', email: 'victim@example.com', name: 'Victim' };
 
-function assertion(overrides: Record<string, unknown> = {}) {
-  return {
-    payload: {
+function assertion(overrides: Record<string, unknown> = {}, secret = JWT_SECRET) {
+  const now = Math.floor(Date.now() / 1000);
+  return jwt.sign(
+    {
       type: 'shared_oauth_identity',
       projectId: PROJECT_ID,
       provider: 'github',
       sid: FLOW_ID,
+      identity: IDENTITY,
       jti: crypto.randomUUID(),
-      exp: Math.floor(Date.now() / 1000) + 120,
-      identity: { providerId: '42', email: 'victim@example.com', name: 'Victim' },
+      iat: now,
+      exp: now + 120,
       ...overrides,
     },
-  };
+    secret,
+    { algorithm: 'HS256' }
+  );
 }
 
 async function getService() {
   const { SharedOAuthService } = await import('../../src/services/auth/shared-oauth.service.js');
   return SharedOAuthService.getInstance();
 }
 
+const context = { provider: 'github', state: STATE };
+
 describe('SharedOAuthService.verifyIdentityToken', () => {
   beforeEach(() => {
     vi.resetModules();
     vi.clearAllMocks();
     vi.stubEnv('PROJECT_ID', PROJECT_ID);
+    vi.stubEnv('JWT_SECRET', JWT_SECRET);
   });
 
   afterEach(() => {
     vi.unstubAllEnvs();
   });
 
-  it('returns the identity when the cloud assertion is valid', async () => {
-    verifyCloudToken.mockResolvedValue(assertion());
+  it('returns the identity when the assertion is valid', async () => {
     const service = await getService();
 
-    await expect(
-      service.verifyIdentityToken('cloud-token', { provider: 'github', state: STATE })
-    ).resolves.toEqual({ providerId: '42', email: 'victim@example.com', name: 'Victim' });
+    expect(service.verifyIdentityToken(assertion(), context)).toEqual(IDENTITY);
   });
 
-  it('rejects a token the cloud did not sign', async () => {
-    verifyCloudToken.mockRejectedValue(new Error('signature verification failed'));
+  it('rejects an identity the caller built themselves', async () => {
     const service = await getService();
+    const forged = Buffer.from(JSON.stringify(IDENTITY)).toString('base64');
 
-    await expect(
-      service.verifyIdentityToken('forged', { provider: 'github', state: STATE })
-    ).rejects.toThrow('signature verification failed');
+    expect(() => service.verifyIdentityToken(forged, context)).toThrowError(
+      expect.objectContaining({ statusCode: 401 })
+    );
   });
 
-  it('rejects a cloud token minted for something other than a shared OAuth login', async () => {
-    verifyCloudToken.mockResolvedValue(assertion({ type: 'project_authorization' }));
+  it('rejects an assertion signed with a secret that is not ours', async () => {
     const service = await getServic
```

**File**: `openapi/auth.yaml` (modified, +1/-1)
```diff
@@ -1663,7 +1663,7 @@ paths:
           in: query
           schema:
             type: string
-          description: Cloud-signed identity assertion for this project and login attempt
+          description: Identity assertion the cloud signed with this project's JWT secret, bound to this login attempt
       responses:
         '302':
           description: Redirect to application with access token or error
```

---

### Incident Patch 10: `a83c72a4` (2026-09-07)
**Commit Message**: fix(auth): cap the lifetime of a shared OAuth identity assertion

jose enforces that exp has not passed, not how far ahead it sits, so an
assertion carrying a long expiry widened the replay window and pinned its entry
in the consumed-token map indefinitely.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `backend/src/services/auth/shared-oauth.service.ts` (modified, +12/-3)
```diff
@@ -7,6 +7,10 @@ import logger from '@/utils/logger.js';
 
 const IDENTITY_TOKEN_TYPE = 'shared_oauth_identity';
 
+// Longest assertion lifetime we honour. The cloud signs two minutes; this bounds both
+// the replay window and the consumed-token map without clock skew rejecting honest ones.
+const MAX_IDENTITY_TOKEN_LIFETIME_MS = 10 * 60 * 1000;
+
 // Binds a cloud identity assertion to one OAuth attempt: sent when the flow starts,
 // re-derived when the callback lands.
 function sharedOAuthFlowId(state: string): string {
@@ -91,8 +95,13 @@ export class SharedOAuthService {
     }
 
     const now = Date.now();
-    for (const [seen, expiresAt] of this.consumedTokens) {
-      if (expiresAt <= now) {
+    const expiresAt = exp * 1000;
+    if (expiresAt > now + MAX_IDENTITY_TOKEN_LIFETIME_MS) {
+      throw this.reject('Shared OAuth identity assertion outlives its flow', provider);
+    }
+
+    for (const [seen, seenExpiresAt] of this.consumedTokens) {
+      if (seenExpiresAt <= now) {
         this.consumedTokens.delete(seen);
       }
     }
@@ -101,7 +110,7 @@ export class SharedOAuthService {
       throw this.reject('Shared OAuth identity assertion was already used', provider);
     }
 
-    this.consumedTokens.set(jti, exp * 1000);
+    this.consumedTokens.set(jti, expiresAt);
   }
 
   private reject(message: string, provider: string): AppError {
```

**File**: `backend/tests/unit/shared-oauth-identity.test.ts` (modified, +11/-0)
```diff
@@ -110,6 +110,17 @@ describe('SharedOAuthService.verifyIdentityToken', () => {
     ).rejects.toMatchObject({ statusCode: 401 });
   });
 
+  it('rejects an assertion whose lifetime runs far past the flow it belongs to', async () => {
+    verifyCloudToken.mockResolvedValue(
+      assertion({ exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 })
+    );
+    const service = await getService();
+
+    await expect(
+      service.verifyIdentityToken('cloud-token', { provider: 'github', state: STATE })
+    ).rejects.toMatchObject({ statusCode: 401 });
+  });
+
   it('rejects a replay of an assertion it already accepted', async () => {
     verifyCloudToken.mockResolvedValue(assertion({ jti: 'fixed-jti' }));
     const service = await getService();
```

#### Recent Merged Pull Requests:
- **PR #2078** (2026-09-26): docs(readme): add ZopDay to the One-click Deployment table (@muskanbandta23)
- **PR #2076** (2026-09-26): BUG: Adopt staged blue-green strategy for container updates (@prakharsingh-74)
- **PR #2061** (2026-09-11): chore(deps): bump qs and body-parser (@dependabot[bot])
- **PR #2057** (2026-09-10): chore(deps): vitest 4.1.11, nodemailer 9.1.1, js-yaml 4.3.2 (@tonychang04)
- **PR #2052** (2026-09-08): Bump version to 2.3.2 (@agent-zhang-beihai[bot])
- **PR #2051** (2026-09-08): fix(auth): require a cloud-signed identity on shared OAuth callbacks (@Fermionic-Lyu)
- **PR #2048** (2026-09-10): chore(deps): clear 3 of 4 Dependabot alerts (browserslist, @humanfs/node, fflate) (@tonychang04)
- **PR #2037** (2026-09-02): fix(ui): Skeleton shimmers in a tone that reads on both themes (@Fermionic-Lyu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
