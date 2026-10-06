# Forensic Learning Record (Deep Inspection): kortix-ai/suna

> **Canonical Artifact**: `07_PROJECT_LEARNING/kortix-ai-suna-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kortix-ai/suna](https://github.com/kortix-ai/suna))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:03:58.247Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kortix-ai/suna`
- **Description**: The open-source AI Operating System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20245 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/src/accounts/core/account-name.ts`
```
/**
 * The name an account gets when nobody has chosen one yet (KRTX-638).
 *
 * Never the full email address. The old default was `"<email>'s Account"`,
 * which then sat in the sidebar, the account picker, the hub and the admin
 * console for every user who never renamed it. In order of preference:
 *
 *   1. the person's first name       → "Ada's workspace"
 *   2. the email's local part, as is → "ada.lovelace42"   (ada.lovelace42@gmail.com)
 *   3. nothing usable                → "My workspace"
 *
 * The DOMAIN is never used: most people sign up with a consumer address, and
 * an account called "Gmail" is wrong for all of them.
 *
 * A new user confirms or changes this on the onboarding name step
 * (`/projects`), so it is a suggestion, not a final name.
 */
export function suggestAccountName({
  email,
  fullName,
}: {
  email?: string | null;
  fullName?: string | null;
}): string {
  const firstName = fullName?.trim().split(/\s+/)[0];
  if (firstName) return `${capitalize(firstName)}'s workspace`;

  const local = email?.trim().split("@")[0]?.trim();
  if (local) return local;

  return "My workspace";
}

/** `full_name` / `name` from a Supabase user's metadata (OAuth fills them). */
export function profileNameFromMetadata(metadata: unknown): string | null {
  const meta = metadata as Record<string, unknown> | null | undefined;
  const name = meta?.full_name ?? meta?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

```

### Core Architecture Module: `apps/api/src/accounts/core/account-order.ts`
```
/**
 * Deterministic listing order for GET /v1/accounts.
 *
 * The memberships query has no ORDER BY, and the web landing door falls back
 * to `accounts[0]` when nothing is selected — so an unordered list made the
 * default landing account nondeterministic (see the sibling test). The order
 * clients can rely on: accounts the user owns first, then admin, then plain
 * memberships; oldest first within a role; account id as the final tie-break.
 */

const ROLE_WEIGHT: Record<string, number> = { owner: 0, admin: 1 };

interface OrderableAccountRow {
  accountId: string;
  accountRole: string | null;
  createdAt: Date | null;
}

export function sortAccountsForListing<T extends OrderableAccountRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const roleDelta =
      (ROLE_WEIGHT[a.accountRole ?? ''] ?? 2) - (ROLE_WEIGHT[b.accountRole ?? ''] ?? 2);
    if (roleDelta !== 0) return roleDelta;
    // A missing timestamp sorts last within its role — it is no evidence of age.
    const aTime = a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0;
  });
}

```

### Core Architecture Module: `apps/api/src/accounts/core/accounts.ts`
```
import { createRoute, z } from "@hono/zod-openapi";
import { and, count, eq, sql } from "drizzle-orm";
import { json, errors, auth } from "../../openapi";
import { accountMembers, accountMemberships, accounts, projects } from "@kortix/db";
import { config } from "../../config";
import { db } from "../../shared/db";
import { ACCOUNT_ACTIONS, assertAuthorized } from "../../iam";
import { actorOf } from '../../iam/actor';
import { assignRole, SYSTEM_ACTOR } from '../../iam/assignments';
import { accountRolesForUser } from '../../iam/read-models';
import { impersonatedAccountFor } from "../../shared/impersonation";
import { isPlatformAdmin } from "../../shared/platform-roles";
import { effectiveBranding } from '../branding';
import { sortAccountsForListing } from "./account-order";
import { bootstrapPersonalAccount } from "./bootstrap-personal-account";
import {
  AccountDetailSchema,
  AccountIdParam,
  AccountSummarySchema,
  accountDisplayName,
  accountsRouter,
  autoClaimPendingInvites,
  getMembership,
  normalizeString,
  resolveAccountDisplayNames,
  serializeAccount,
} from './app';
import { readJsonObject } from '../../shared/http-body';

// Routes are registered via this function (called by the orchestrator in the
// original route-registration order).
export function registerAccountRoutes(): void {
  // GET /v1/accounts — list user's accounts.
  accountsRouter.openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['accounts'],
      summary: "List the user's accounts",
      ...auth,
      responses: {
        200: json(z.array(AccountSummarySchema), 'Accounts the user belongs to'),
        ...errors(401, 500),
      },
    }),
    async (c) => {
      const userId = c.get('userId') as string;
      const userEmail = c.get('userEmail') as string;

      // ACT-AS: the operator's OWN accounts are not part of this session. The
      // list is what the whole app scopes itself from — the sidebar reads it,
      // then asks for that account's projects — so returning the admin's own
      // memberships here would make every downstream call carry the wrong
      // account id, which `resolveScopedAccountId` then (correctly) refuses.
      // One account in, one account out: the account the banner names.
      const impersonated = impersonatedAccountFor(userId);
      if (impersonated) {
        const [row] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.accountId, impersonated))
          .limit(1);
        if (!row) return c.json([]);
        return c.json([
          {
            account_id: row.accountId,
            name: accountDisplayName(row.name, null),
            slug: row.accountId.slice(0, 8),
            created_at: row.createdAt.toISOString(),
            updated_at: row.updatedAt.toISOString(),
            // Owner, matching the effective role every other gate resolves for
            // an impersonated request (see iam/engine-v2.ts and
            // projects/lib/git.ts). A lower label here would make the console
            // hide controls the server would in fact allow.
            account_role: 'owner',
            is_primary_owner: true,
            branding: await effectiveBranding(row.accountId, row.branding),
          },
        ]);
      }

      // `account_members` says WHICH accounts; `role_assignments` says at what
      // role. Reading the role off the join labelled the switcher with a value
      // the engine no longer decides on.
      const readMembershipRows = () =>
        db
          .select({
            accountId: accountMembers.accountId,
            name: accounts.name,
            createdAt: accounts.createdAt,
            updatedAt: accounts.updatedAt,
            branding: accounts.branding,
          })
          .from(accountMembers)
          .innerJoin(accounts, eq(accountMembers.accountId, accounts.accountId))
          .where(eq(accountMembers.userId, userId));
      const loadMemberships = async () => {
        const [membershipRows, rolesByAccount] = await Promise.all([
          readMembershipRows(),
          accountRolesForUser(userId),
        ]);
        return membershipRows.map((m) => ({
          ...m,
          accountRole: rolesByAccount.get(m.accountId) ?? 'member',
        }));
      };

      // Bootstrap BEFORE claiming pending invites, not after (R3). The old
      // order claimed invites first and only bootstrapped when the resulting
      // membership count was still zero — so the moment ANY invite was
      // pending, the claim alone made that count nonzero and the bootstrap
      // never ran. An invite-first signup then had no personal account at
      // all: its entire `GET /v1/accounts` was the inviter's org, and the
      // web landing door (which takes the first account in this list) put a
      // brand-new user straight into a stranger's workspace.
      //
      // `resolveAccountId` (shared/resolve-account.ts) never had this bug —
      // it bootstraps unconditionally the moment a caller has NO membership,
      // and never claims invites itself. Deciding on the PRE-claim
      // membership set here (not the post-claim one) makes this route agree
      // with that one: bootstrap fires exactly when the caller had no
      // account at all, independent of whether an invite is waiting.
      //
      // GET /v1/accounts/me (accounts/core/tokens.ts) applies the identical
      // pre-claim-decision ordering for the same reason — kept as a
      // parallel implementation rather than a shared helper because its
      // bootstrap primitive (`resolveAccountId`, best-effort, never fails
      // the request), gating (`authType === 'supabase'`), and response
      // shape all differ from this route's; forcing one function to cover
      // both would trade a 10-line ordering discipline for a multi-parameter
      // abstraction that hides the one real asymmetry that matters — this
      // route's bootstrap failure is fatal (500 below), /me's is not.
      //
      // The decision needs only WHETHER a membership exists, so this read
      // skips the roles. The list below reads both.
      if ((await readMembershipRows()).length === 0) {
        try {
          await bootstrapPersonalAccount(userId, userEmail);
        } catch (err) {
          console.warn('[accounts] Failed to bootstrap personal account:', err);
          return c.json({ error: 'Failed to initialize account' }, 500);
        }
      }

      // Claim AFTER the bootstrap decision above. `autoClaimPendingInvites`
      // already swallows its own errors (best-effort, must never block
      // listing) and is idempotent — a claimed invite is stamped
      // `accepted_at` and re-running is a no-op — so a claim failure here
      // leaves the user with exactly the personal account bootstrapped above
      // and the invite still pending, to be retried on the next call. No
      // shared transaction wraps the two steps: bootstrap failure is fatal
      // (500, above) because without it the account list is meaningless,
      // while invite-claiming is explicitly optional and self-healing, and
      // wrapping both in one transaction would contradict the per-invite
      // isolation `autoClaimPendingInvites` already does internally (one bad
      // invite must not roll back the others, or the account just bootstrapped).
      await autoClaimPendingInvites(userId, userEmail);

      // Read unconditionally, after the claim. Reusing the pre-claim rows when
      // this request claimed nothing races a concurrent list: the first call of
      // a fresh sign-in claims the invite between this call's first read and
      // its claim, so this call sees no pending invite, claims 0, and would
      // return the list without the workspace the user was just added to.
      const memberships = await loadMemberships();
      if (memberships.length === 0) {
        console.warn(`[accounts] No memberships for ${userId} after bootstrap+claim`);
        return c.json({ error: 'Failed to initialize account' }, 500);
      }

      const displayNames = await resolveAccountDisplayNames(memberships, {
        userId,
        email: userEmail,
      });
      // Deterministic order (owned first, oldest first): the web landing
      // door falls back to the FIRST account of this list, so an unordered
      // result made the default landing account nondeterministic.
      // Branding is resolved per account — `effectiveBranding` only touches
      // billing for accounts that actually carry a record, so this stays a
      // no-op for the overwhelming majority of lists.
      return c.json(
        await Promise.all(
          sortAccountsForListing(memberships).map(async (m) => ({
            account_id: m.accountId,
            name: displayNames.get(m.accountId) ?? accountDisplayName(m.name, userEmail),
            slug: m.accountId.slice(0, 8),
            created_at: m.createdAt?.toISOString() ?? new Date().toISOString(),
            updated_at: m.updatedAt?.toISOString() ?? new Date().toISOString(),
            account_role: m.accountRole || 'owner',
            is_primary_owner: m.accountRole === 'owner',
            branding: await effectiveBranding(m.accountId, m.branding),
          })),
        ),
      );
    },
  );

  // POST /v1/accounts — create a new team account.
  accountsRouter.openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['accounts'],
      summary: 'Create a new team account',
      ...auth,
      request: {
        body: {
          content: {
            'application/json': { schema: z.object({ name: z.string() }) },
          },
        },
      },
      responses: {
        201: json(AccountSummarySchema, "The newly created account"),
        ...errors(400, 401, 403),
      },
    }),
    async (c) => {
      const userId = c.get("userId") as string;

      // Self-host account-creation restriction: gate the creation of
      // ADDITIONAL/org account
```

### Core Architecture Module: `apps/api/src/accounts/core/app.ts`
```
import { AccountSummarySchema as ContractAccountSummarySchema } from '@kortix/api-contract';
import { z } from '@hono/zod-openapi';
import { accountInvitations, accountMembers, accountMemberships, iamRoles, roleAssignments, type accounts } from '@kortix/db';
import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { makeOpenApiApp } from '../../openapi';
import { db } from '../../shared/db';
import {
  isImpersonatingAccount,
  isImpersonationBlockedAccount,
} from '../../shared/impersonation';
import { accountRoleFor, countAccountOwners } from '../../iam/read-models';
import { assignRole, SYSTEM_ACTOR } from '../../iam/assignments';
import { trustedEmailForUser } from '../../iam/email-trust';
import { resolveAccountId } from '../../shared/resolve-account';
import { suggestAccountName } from './account-name';
import { lookupEmailsByUserIds } from './owner-emails';
import type { AppEnv } from '../../types';

// ─── Public router (leaf module — no route imports here to avoid cycles) ─────
export const accountsRouter = makeOpenApiApp<AppEnv>();

/**
 * The name for an account nobody named — never the raw email (KRTX-638). See
 * `suggestAccountName` for the order it tries.
 */
export function defaultAccountName(
  email: string | null | undefined,
  fullName?: string | null,
): string {
  return suggestAccountName({ email, fullName });
}

// A stored name counts as "proper" only when it isn't one of the placeholder
// values migrations left behind ('Personal', 'User'). Placeholder accounts
// fall back to `defaultAccountName` — a suggested name, never the email.
export function properAccountName(name: string | null | undefined): string | null {
  const normalized = name?.trim();
  if (!normalized || normalized === 'Personal' || normalized === 'User') return null;
  return normalized;
}

export function accountDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  return properAccountName(name) ?? defaultAccountName(email);
}

// ─── Shared response/request schemas (power the Scalar docs) ────────────────

/** Organization branding as members SEE it (see ../branding.ts). Absent or
 *  null = default Kortix marks — either nothing is set or the account's plan
 *  no longer carries the `branding` entitlement. */
export const EffectiveBrandingSchema = z
  .object({
    app_name: z.string().nullable(),
    logo_url: z.string().nullable(),
    icon_url: z.string().nullable(),
    favicon_url: z.string().nullable(),
    logo_dark_url: z.string().nullable(),
    icon_dark_url: z.string().nullable(),
    favicon_dark_url: z.string().nullable(),
  })
  .nullable()
  .optional();

export const AccountSummarySchema = ContractAccountSummarySchema.openapi('AccountSummary');

export const AccountDetailSchema = z
  .object({
    account_id: z.string(),
    name: z.string(),
    member_count: z.number(),
    project_count: z.number(),
    role: z.string(),
    /** Account-wide MFA enforcement flag — drives the members-list MFA badges. */
    mfa_required: z.boolean().optional(),
    branding: EffectiveBrandingSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi('AccountDetail');

export const AccountMemberSchema = z
  .object({
    user_id: z.string(),
    email: z.string().nullable(),
    account_role: z.string(),
    is_super_admin: z.boolean(),
    explicit_project_count: z.number(),
    /** Direct project grants only (mirrors explicit_project_count) — group-
     *  derived and implicit (owner/admin) access aren't enumerated here. */
    projects: z.array(z.object({ project_id: z.string(), name: z.string(), role: z.string() })),
    groups: z.array(z.object({ group_id: z.string(), name: z.string() })),
    active_pat_count: z.number(),
    has_verified_mfa: z.boolean(),
    joined_at: z.string(),
  })
  .openapi('AccountMember');

export const AccountTokenSchema = z
  .object({
    token_id: z.string(),
    name: z.string(),
    project_id: z.string().nullable().optional(),
    public_key: z.string(),
    status: z.string(),
    expires_at: z.string().nullable(),
    last_used_at: z.string().nullable().optional(),
    created_at: z.string(),
    revoked_at: z.string().nullable().optional(),
    secret_key: z.string().optional(),
  })
  .openapi('AccountToken');

export const AccountInviteSchema = z
  .object({
    invite_id: z.string(),
    email: z.string(),
    initial_role: z.string(),
    invited_by: z.string().nullable(),
    created_at: z.string(),
    expires_at: z.string(),
    invite_url: z.string(),
  })
  .openapi('AccountInvite');

export const OkSchema = z.object({ ok: z.boolean() }).openapi('OkResponse');

export const MeSchema = z
  .object({
    user_id: z.string(),
    email: z.string(),
    token_context: z
      .object({
        auth_type: z.string().nullable(),
        project_id: z.string().nullable(),
        session_id: z.string().nullable(),
        agent: z.string().nullable(),
        connectors: z.union([z.literal('all'), z.array(z.string())]).nullable(),
        kortix_permissions: z.union([z.literal('all'), z.array(z.string())]).nullable(),
        /** @deprecated Same value as kortix_permissions; kept for pre-rename CLIs. */
        kortix_cli: z.union([z.literal('all'), z.array(z.string())]).nullable(),
        env: z.union([z.literal('all'), z.array(z.string())]).nullable(),
      })
      .optional(),
    accounts: z.array(
      z.object({
        account_id: z.string(),
        slug: z.string(),
        name: z.string(),
        role: z.string(),
      }),
    ),
  })
  .openapi('AccountMe');

export const AccountIdParam = z.object({ accountId: z.string() });

// ─── Shared helpers ─────────────────────────────────────────────────────────

export type AccountRole = 'owner' | 'admin' | 'member';

export async function resolveAccountForUser(
  userId: string,
  override: string | undefined,
): Promise<string> {
  if (override) {
    const [membership] = await db
      .select({ accountId: accountMembers.accountId })
      .from(accountMembers)
      .where(and(eq(accountMembers.userId, userId), eq(accountMembers.accountId, override)))
      .limit(1);
    if (!membership) {
      throw new Error('not a member of the requested account');
    }
    return membership.accountId;
  }
  return resolveAccountId(userId);
}

export function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeEmail(value: unknown): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (!lower.includes('@')) return null;
  return lower;
}

export function parseRole(value: unknown, allowed: AccountRole[]): AccountRole | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (allowed as string[]).includes(v) ? (v as AccountRole) : null;
}

export async function getMembership(userId: string, accountId: string) {
  // ACT-AS: an operator with a live grant on this account reads as its owner.
  // Only ever widens the OPERATOR's own id — `impersonatedAccountFor` compares
  // against the grant's admin_user_id, so the several call sites that pass a
  // TARGET user's id (member role changes, invites) keep getting that user's
  // real membership, which is exactly what those routes must decide on.
  if (isImpersonatingAccount(userId, accountId)) {
    return { accountRole: 'owner' as const };
  }
  // Confinement, same as getAccountMembership: one account for the duration.
  if (isImpersonationBlockedAccount(userId, accountId)) return null;
  // Membership IS the account-scope assignment. `account_members` keeps the
  // identity columns (is_super_admin, scim_external_id, joined_at); the ROLE
  // comes from `role_assignments`, which is what the engine reads.
  const accountRole = await accountRoleFor(accountId, userId);
  return accountRole ? { accountRole } : null;
}

export async function countOwners(accountId: string): Promise<number> {
  return countAccountOwners(accountId);
}

// Batched + cached owner-email lookup. Lives in ./owner-emails so it stays a
// leaf module (db + sql only) and can be unit-tested without the account graph.
// Re-exported here because it was part of this module's public surface.
export { clearOwnerEmailCache, ownerEmailCacheSize } from './owner-emails';
export { lookupEmailsByUserIds };

// Display names for a batch of accounts, deriving the fallback for unnamed
// (placeholder-named) accounts from the account OWNER's email — not the
// caller's. Deriving from the caller made every unnamed account a user was
// invited into render as "<caller>'s Account", so shared projects looked like
// they lived in the caller's own personal account.
export async function resolveAccountDisplayNames(
  rows: Array<{ accountId: string; name: string | null }>,
  caller: { userId: string; email: string | null | undefined },
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unnamed: string[] = [];
  for (const row of rows) {
    const proper = properAccountName(row.name);
    if (proper) names.set(row.accountId, proper);
    else unnamed.push(row.accountId);
  }
  if (unnamed.length === 0) return names;

  // Primary owner per unnamed account = the earliest-joined holder of the
  // `owner` role. The ROLE comes from `role_assignments` (the store the engine
  // reads); `account_members.joined_at` is identity and stays where it is.
  const ownerByAccount = new Map<string, string>();
  try {
    const owners = await db
      .select({ accountId: accountMembers.accountId, userId: accountMembers.userId })
      .from(accountMembers)
      .innerJoin(
        roleAssignments,
        and(
          eq(roleAssignments.accountId, accountMembers.accountId),
          eq(roleAssignments.principalType, 'user'),
          eq(roleAssignments.principalId, accountMembers.userId),
          eq(ro
```

### Core Architecture Module: `apps/api/src/accounts/core/bootstrap-personal-account.ts`
```
import { accountMembers, accountMemberships, accounts } from '@kortix/db';
import { eq } from 'drizzle-orm';

import { initializeFreeTierAccount } from '../../billing/services/free-tier';
import { config } from '../../config';
import { syncSignupContactToMailtrap } from '../mailtrap-contacts';
import { assignRole, SYSTEM_ACTOR } from '../../iam/assignments';
import { db } from '../../shared/db';
import { getSupabase } from '../../shared/supabase';
import { profileNameFromMetadata } from './account-name';
import { defaultAccountName } from './app';

/**
 * The sign-in profile's name (Google/GitHub OAuth fill `full_name` / `name`).
 * Best effort: a miss only means the suggestion falls back to the email.
 */
async function profileName(userId: string): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.admin.getUserById(userId);
    return profileNameFromMetadata(data?.user?.user_metadata);
  } catch {
    return null;
  }
}

/**
 * Idempotent personal-account bootstrap for a new auth user.
 *
 * Personal accounts use `accountId === userId` so resolveAccountId and
 * GET /v1/accounts converge on the same row instead of racing to create
 * two different accounts (random UUID vs user id).
 */
export async function bootstrapPersonalAccount(
  userId: string,
  email?: string | null,
  /** Pass it when the caller already has the auth user; `undefined` looks it up. */
  fullName?: string | null,
  lookupProfileName: (userId: string) => Promise<string | null> = profileName,
): Promise<{ accountId: string; created: boolean }> {
  // Never `"<email>'s Account"` (KRTX-638): a suggested name the user confirms
  // or changes on their first project (`/new`).
  const name = defaultAccountName(
    email,
    fullName === undefined ? await lookupProfileName(userId) : fullName,
  );

  const created = await db
    .insert(accounts)
    .values({
      accountId: userId,
      name,
    })
    .onConflictDoNothing()
    .returning({ accountId: accounts.accountId });

  if (created.length > 0) {
    // IDENTITY, then the OWNER role. `SYSTEM_ACTOR`: the platform is the writer
    // here — there is no one to authorize, the account is being created FOR this
    // user.
    await db
      .insert(accountMemberships)
      .values({ userId, accountId: userId, isSuperAdmin: true })
      .onConflictDoNothing();
    await assignRole(SYSTEM_ACTOR, userId, {
      principal: { type: 'user', id: userId },
      roleKey: 'owner',
      scope: { type: 'account' },
      source: 'system',
      exclusive: true,
    });

    if (config.KORTIX_BILLING_INTERNAL_ENABLED) {
      try {
        await initializeFreeTierAccount(userId);
      } catch (err) {
        console.warn(`[accounts] Failed to initialize free tier for ${userId}:`, err);
      }
    }

    // Only genuinely-new users sync (created:true) — token-authed callers
    // that reach resolveAccount with an existing account never get here.
    // Fire-and-forget: Mailtrap being down must never affect signup.
    void syncSignupContactToMailtrap(email).catch((err) =>
      console.warn(`[accounts] Mailtrap contact sync failed for ${userId}:`, err),
    );

    return { accountId: userId, created: true };
  }

  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  return { accountId: membership?.accountId ?? userId, created: false };
}

```

### Core Architecture Module: `apps/api/src/accounts/core/devices.ts`
```
import { createRoute, z } from '@hono/zod-openapi';
import { json, errors, auth } from '../../openapi';
import { isUuid } from '../../shared/validate';
import { forgetUserJwtLiveness } from '../../shared/jwt-liveness';
import { listSignedInDevices, signOutDevice } from '../../repositories/auth-devices';
import { accountsRouter, OkSchema } from './app';

const SignedInDeviceSchema = z
  .object({
    session_id: z.string(),
    user_agent: z.string().nullable(),
    ip: z.string().nullable(),
    signed_in_at: z.string(),
    last_active_at: z.string(),
    current: z.boolean(),
  })
  .openapi('SignedInDevice');

// A device is a browser sign-in, so only a browser session may read or end
// one: a PAT or an agent token has no device of its own and must not be able
// to sign its owner out.
const BROWSER_ONLY = { error: 'Signed-in devices need a browser session.' };

// Registered before /:accountId so the static `me` segment is not shadowed.
export function registerDeviceRoutes(): void {
  accountsRouter.openapi(
    createRoute({
      method: 'get',
      path: '/me/devices',
      tags: ['accounts'],
      summary: "List the caller's signed-in devices",
      ...auth,
      responses: {
        200: json(z.object({ devices: z.array(SignedInDeviceSchema) }), 'Live sign-ins, most recently active first'),
        ...errors(401, 403),
      },
    }),
    async (c) => {
      if (c.get('authType') !== 'supabase') return c.json(BROWSER_ONLY, 403);
      const current = c.get('sessionId') as string | undefined;
      const rows = await listSignedInDevices(c.get('userId') as string);
      return c.json({ devices: rows.map((r) => ({ ...r, current: r.session_id === current })) });
    },
  );

  accountsRouter.openapi(
    createRoute({
      method: 'delete',
      path: '/me/devices/{sessionId}',
      tags: ['accounts'],
      summary: 'Sign one other device out',
      ...auth,
      request: { params: z.object({ sessionId: z.string() }) },
      responses: {
        200: json(OkSchema, 'The device is signed out'),
        ...errors(400, 401, 403, 404),
      },
    }),
    async (c) => {
      if (c.get('authType') !== 'supabase') return c.json(BROWSER_ONLY, 403);
      const sessionId = c.req.param('sessionId');
      if (!isUuid(sessionId)) return c.json({ error: 'Invalid device id.' }, 400);
      if (sessionId === c.get('sessionId')) {
        return c.json({ error: 'This is the current device. Sign out instead.' }, 400);
      }
      const userId = c.get('userId') as string;
      const ok = await signOutDevice(userId, sessionId);
      if (!ok) return c.json({ error: 'Device not found.' }, 404);
      // The liveness cache keys tokens, not sessions, so it cannot drop only the
      // signed-out device: drop the user's entries and let the next request of
      // every device ask GoTrue again. Without this a cached bearer of the
      // signed-out device keeps working until SUPABASE_JWT_LIVENESS_TTL_MS.
      forgetUserJwtLiveness(userId);
      return c.json({ ok: true });
    },
  );
}

```

### Core Architecture Module: `apps/api/src/accounts/core/invites.ts`
```
import { createRoute, z } from '@hono/zod-openapi';
import { accountInvitations, accountMemberships, accounts, projects } from '@kortix/db';
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { onMemberAdded } from '../../billing/services/seat-management';
import { ACCOUNT_ACTIONS, assertAuthorized, authorize } from '../../iam';
import { resolveAccountIdentityByEmail } from '../../iam/account-identity';
import { actorOf } from '../../iam/actor';
import { parseAssignableProjectRole, PROJECT_ROLE_INPUT_ERROR, type ProjectRole } from '../../iam/roles';
import { auth, errors, json } from '../../openapi';
import { grantProjectRole } from '../../projects/lib/access';
import { db } from '../../shared/db';
import { readJsonObject } from '../../shared/http-body';
import { buildInviteUrl, sendAccountInviteEmail } from '../email';
import { AccountIdParam, AccountInviteSchema, type AccountRole, OkSchema, accountsRouter, getMembership, normalizeEmail, parseRole } from './app';
import { grantAccountRole } from './member-role-write';
import { logger } from '../../lib/logger';

export function registerMemberInviteRoute(): void {
  // POST /v1/accounts/:accountId/members — invite a user by email. If the user
  // exists, they're added immediately. Otherwise we create a pending invitation
  // that auto-claims on first /v1/accounts call after signup.
  accountsRouter.openapi(
    createRoute({
      method: 'post',
      path: '/{accountId}/members',
      tags: ['accounts'],
      summary: 'Invite a user by email (added immediately or pending invite)',
      ...auth,
      request: {
        params: AccountIdParam,
        body: {
          content: {
            'application/json': {
              schema: z.object({
                email: z.string(),
                role: z.string().optional(),
                // Project access to grant alongside the invite — applied
                // immediately if the invitee already has a Kortix account,
                // or staged on the pending invite (same bootstrap_grants
                // column POST /projects/:id/access/invite already writes)
                // and applied automatically when they accept.
                project_grants: z
                  .array(z.object({ project_id: z.string(), role: z.string().optional() }))
                  .optional(),
              }),
            },
          },
        },
      },
      responses: {
        201: json(z.record(z.string(), z.any()), 'Member added or pending invitation created'),
        ...errors(400, 401, 403, 404, 409),
      },
    }),
    async (c: any) => {
      const userId = c.get('userId') as string;
      const callerEmail = (c.get('userEmail') as string | undefined) ?? null;
      const accountId = c.req.param('accountId');

      const membership = await getMembership(userId, accountId);
      if (!membership) return c.json({ error: 'Forbidden' }, 403);
      await assertAuthorized(await actorOf(c, accountId), ACCOUNT_ACTIONS.MEMBER_INVITE);

      const body = await readJsonObject(c);
      const email = normalizeEmail(body.email);
      if (!email) return c.json({ error: 'A valid email is required' }, 400);

      const role: AccountRole = parseRole(body.role, ['admin', 'member']) ?? 'member';

      // Project grants only apply to `member` invites — an admin/owner
      // already holds implicit Manager on every project in the account (see
      // the PATCH role-change handler below, which strips their direct
      // project_members rows for the same reason), so a grant would be
      // redundant at best and misleading at worst.
      const rawGrants: Array<{ project_id?: unknown; role?: unknown }> = Array.isArray(
        body.project_grants,
      )
        ? body.project_grants
        : [];
      let projectGrants: Array<{ project_id: string; role: ProjectRole }> = [];
      if (rawGrants.length > 0 && role === 'member') {
        const requestedIds = [
          ...new Set(
            rawGrants
              .map((g) => (typeof g.project_id === 'string' ? g.project_id : null))
              .filter((v): v is string => v !== null),
          ),
        ];
        // Never trust a client-supplied project_id at face value — confirm
        // it actually belongs to THIS account before granting, so a bad or
        // malicious payload can't plant a cross-account project_members row.
        const owned = requestedIds.length
          ? await db
              .select({ projectId: projects.projectId })
              .from(projects)
              .where(
                and(eq(projects.accountId, accountId), inArray(projects.projectId, requestedIds)),
              )
          : [];
        const ownedIds = new Set(owned.map((p) => p.projectId));
        for (const g of rawGrants) {
          const projectId = typeof g.project_id === 'string' ? g.project_id : null;
          if (!projectId || !ownedIds.has(projectId)) continue;
          // An omitted role still defaults to the floor tier; a role that was
          // SPELLED OUT and is not assignable (the removed `editor`, a typo) is
          // a 400, never a silent downgrade to `member` or upgrade to `manager`.
          const grantRole = g.role === undefined ? 'member' : parseAssignableProjectRole(g.role);
          if (!grantRole) return c.json({ error: PROJECT_ROLE_INPUT_ERROR }, 400);
          projectGrants.push({ project_id: projectId, role: grantRole });
        }
      }

      // Trial seat gate — covers both branches below (direct add + invite).
      const { trialSeatLimitBlocksNewMember } = await import(
        '../../billing/services/seat-management'
      );
      const seatBlock = await trialSeatLimitBlocksNewMember(accountId);
      if (seatBlock) {
        return c.json(
          {
            error: `Your trial includes ${seatBlock.limit} ${seatBlock.limit === 1 ? 'seat' : 'seats'} and all are in use. Contact the Kortix team to extend the trial.`,
            code: 'trial_seat_limit_reached',
            limit: seatBlock.limit,
            members: seatBlock.members,
          },
          403,
        );
      }

      // Need account name for the invite email
      const [accountRow] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.accountId, accountId))
        .limit(1);
      if (!accountRow) return c.json({ error: 'Account not found' }, 404);

      const identity = await resolveAccountIdentityByEmail(accountId, email);
      if (identity.ambiguous) {
        return c.json({ error: 'Multiple account identities use this email', code: 'account_identity_ambiguous' }, 409);
      }
      const targetUserId = identity.userId;

      if (targetUserId) {
        const existing = await getMembership(targetUserId, accountId);
        if (existing) {
          return c.json({ error: 'Already a member' }, 409);
        }

        // IDENTITY first, then the GRANT. Two stores, two writes: the row that
        // says "this user belongs to this account" (and carries is_super_admin /
        // scim_external_id) is kortix.account_memberships; the role is an
        // account-scope assignment. The route already asserted member.invite;
        // `assignRole` additionally asserts member.update, which owner and admin
        // both hold and no custom role can (both are non-delegable).
        await db.insert(accountMemberships).values({ userId: targetUserId, accountId });
        await grantAccountRole(await actorOf(c, accountId), accountId, targetUserId, role);
        // An account admin explicitly re-adding the same account-scoped person
        // clears the manual-removal tombstone. Future SAML logins may now sync
        // this identity again; SCIM can still deactivate it later.
        await db.execute(sql`
          UPDATE kortix.account_scim_users
          SET user_id=${targetUserId}::uuid, active=true, deleted_at=NULL, updated_at=now()
          WHERE account_id=${accountId}::uuid AND lower(user_name)=lower(${email})
        `);

        // Billing v2 — mint YOLO + push +1 seat to Stripe (no-op for legacy).
        void onMemberAdded(accountId, targetUserId).catch((err) =>
        // No seat reconciler exists: a failure here leaves the Stripe seat count
        // (and the member's YOLO token) wrong until the next member change.
        logger.error('[billing] seat sync FAILED after member added', { accountId: accountId, userId: targetUserId, error: err instanceof Error ? err.message : String(err) }),
      );

        for (const g of projectGrants) {
          await grantProjectRole({
            accountId,
            projectId: g.project_id,
            userId: targetUserId,
            role: g.role,
            grantedBy: userId,
          });
        }

        return c.json(
          {
            status: 'added',
            user_id: targetUserId,
            email,
            account_role: role,
            project_grants: projectGrants,
          },
          201,
        );
      }

      // User doesn't exist — create or refresh a pending invitation.
      // Upsert on the unique (account_id, email) index; if one exists,
      // refresh expires_at + initial_role (e.g. inviter changed role).
      // bootstrap_grants is fully replaced (not merged) on every call — the
      // caller resubmits the complete desired project-access set each time,
      // same "what you see is what you get" contract project_grants above
      // documents; a re-invite that no longer lists a project drops it.
      const bootstrapGrants = projectGrants.map((g) => ({
        project_id: g.project_id,
        role: g.role,
      }));
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const [invite] = await db
        .insert(accountInvitations)
        .values({
          accountId,
          email,
          invitedBy: userId,
          initialRole: role,
          expiresAt,
          bootstrapGrants,
        })
        .onConflictDoUpd
```

### Core Architecture Module: `apps/api/src/accounts/core/member-role-write.ts`
```
import { assignRole, type Writer } from '../../iam/assignments';
import type { AccountRole } from './app';

/**
 * The canonical half of an account-membership write.
 *
 * `account_members` is still written by these routes (a pre-cutover replica
 * reads it, and the mirror trigger derives the assignment from it), but the
 * ASSIGNMENT is what the engine reads, so every membership mutation goes
 * through `assignRole` / the revoke audit as well. Doing both is safe: the
 * trigger's upsert and `assignRole`'s upsert target the same identity index, so
 * the pair produces exactly ONE row.
 */
export async function grantAccountRole(
  writer: Writer,
  accountId: string,
  userId: string,
  role: AccountRole,
): Promise<void> {
  // THE write. `account_members.account_role` is a derived view column as of the
  // cutover — there is no second store to keep in step, so a failure here is a
  // failure of the membership change and must propagate.
  //
  // `exclusive` reproduces what the single `account_role` COLUMN enforced: one
  // system account role per member, so owner -> admin retracts the owner
  // assignment instead of unioning with it.
  await assignRole(writer, accountId, {
    principal: { type: 'user', id: userId },
    roleKey: role,
    scope: { type: 'account' },
    source: 'system',
    exclusive: true,
  });
}

```

### Core Architecture Module: `apps/api/src/accounts/core/member-visibility.ts`
```
/**
 * The member DIRECTORY (who is in the account — email, role, group names) is
 * visible to EVERY member of the account, the way Slack / GitHub / Notion show
 * teammates within one company. But one member's SECURITY POSTURE is not
 * something every teammate should see.
 *
 * `canSeeSensitiveMemberColumns` decides who may see the sensitive per-member
 * columns — active PAT count, verified-MFA flag, group memberships, and explicit
 * project grants: only member-managers (owners/admins, or anyone granted
 * `member.invite`) and the viewer's OWN row.
 *
 * Pure and dependency-free so it can be unit-tested in isolation.
 */
export function canSeeSensitiveMemberColumns(
  viewerUserId: string,
  rowUserId: string,
  canManageMembers: boolean,
): boolean {
  return canManageMembers || viewerUserId === rowUserId;
}

```

### Core Architecture Module: `apps/api/src/accounts/core/members.ts`
```
import { createRoute, z } from '@hono/zod-openapi';
import {
  accountGroupMembers,
  accountGroups,
  accountMembers,
  accountMemberships,
  projects,
} from '@kortix/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { onMemberRemoved } from '../../billing/services/seat-management';
import { ACCOUNT_ACTIONS, assertAuthorized, authorize } from '../../iam';
import { actorOf } from '../../iam/actor';
import { invalidateIamCacheForUser } from '../../iam/cache-invalidation';
import { auth, errors, json } from '../../openapi';
import {
  accountRoleMap,
  projectRoleGrants,
} from '../../iam/read-models';
import {
  auditAssignmentRevoked,
  deleteAccountScopeAssignments,
  deleteProjectScopeAssignments,
  listAssignments,
  type Writer,
} from '../../iam/assignments';
import { revokeAllAccountTokensForUser } from '../../repositories/account-tokens';
import { db } from '../../shared/db';
import { registerInviteRoutes, registerMemberInviteRoute } from './invites';
import { grantAccountRole } from './member-role-write';
import { canSeeSensitiveMemberColumns } from './member-visibility';
import {
  AccountIdParam,
  AccountMemberSchema,
  OkSchema,
  accountsRouter,
  countOwners,
  getMembership,
  lookupEmailsByUserIds,
  parseRole,
} from './app';
import { readJsonObject } from '../../shared/http-body';
import { logger } from '../../lib/logger';


/**
 * Emit the revoke events for the account-scope system assignments a legacy
 * write just removed through the mirror trigger.
 *
 * `auditAssignmentRevoked`, not `revokeAssignment`: the caller has already run
 * its own last-owner guard (and, for a role CHANGE, is replacing the row rather
 * than removing access), so re-running the guard per row would 409 the very
 * demotion the route just validated.
 */
async function auditAccountRoleRevoked(
  writer: Writer,
  accountId: string,
  userId: string,
  keep?: string,
): Promise<void> {
  try {
    const rows = await listAssignments({
      accountId,
      principal: { type: 'user', id: userId },
      scopeType: 'account',
      liveOnly: false,
    });
    for (const row of rows) {
      if (!row.roleIsSystem || row.objectType !== null) continue;
      if (keep && row.roleKey === keep) continue;
      await auditAssignmentRevoked(writer, accountId, row);
    }
  } catch (err) {
    console.warn('[members] canonical account-role revoke audit failed', {
      accountId,
      userId,
      err: (err as Error)?.message,
    });
  }
}

/** Every project assignment a member holds, revoked with its audit event. */
async function auditProjectAssignmentsRevoked(
  writer: Writer,
  accountId: string,
  userId: string,
): Promise<void> {
  try {
    const rows = await listAssignments({
      accountId,
      principal: { type: 'user', id: userId },
      scopeType: 'project',
      liveOnly: false,
    });
    for (const row of rows) await auditAssignmentRevoked(writer, accountId, row);
  } catch (err) {
    console.warn('[members] canonical project-assignment revoke audit failed', {
      accountId,
      userId,
      err: (err as Error)?.message,
    });
  }
}

// Routes are registered via this function (called by the orchestrator in the
// original route-registration order).
export function registerMemberRoutes(): void {
  // GET /v1/accounts/:accountId/members — list members.
  accountsRouter.openapi(
    createRoute({
      method: 'get',
      path: '/{accountId}/members',
      tags: ['accounts'],
      summary: 'List account members',
      ...auth,
      request: { params: AccountIdParam },
      responses: {
        200: json(z.array(AccountMemberSchema), 'Account members'),
        ...errors(401, 403),
      },
    }),
    async (c: any) => {
      const userId = c.get('userId') as string;
      const accountId = c.req.param('accountId');

      const membership = await getMembership(userId, accountId);
      if (!membership) return c.json({ error: 'Forbidden' }, 403);

      // The member directory is visible to EVERY member of the account (the way
      // Slack / GitHub show teammates within one company), so all rows are
      // returned. What stays gated is the SENSITIVE per-member data (PAT count,
      // MFA, group memberships, project grants): member-managers (owner / admin /
      // member.invite) see it on every row, everyone else only on their own —
      // enforced by canSeeSensitiveMemberColumns in the map below.
      //
      // Seven independent reads, each scoped to this account — none needs
      // another's result (`emails` is the one exception: it needs the member
      // user ids, so it's kicked off separately right below once `rows` is
      // known). These used to run one at a time (measured: 10 DB round trips
      // serialized to 479ms server time, 2026-09-27); firing them together
      // turns that sum into roughly the slowest single one. Each already
      // degrades independently (groups/PAT/MFA catch their own failures) so a
      // `Promise.all` rejection from the authorize/identity/role reads is the
      // only one allowed to fail the request — same as before.
      const [
        canManageMembers,
        identityRows,
        accountRoles,
        [assignedGrants, activeProjects],
        groupsByUser,
        patCountByUser,
        mfaByUser,
      ] = await Promise.all([
        authorize(await actorOf(c, accountId), ACCOUNT_ACTIONS.MEMBER_INVITE).then((r) => r.allowed),
        // `account_members` is the DIRECTORY (who is here, since when, and the
        // is_super_admin bypass flag). The ROLE comes from `role_assignments` —
        // the one store the engine reads — so this list can no longer disagree
        // with what the gate says a moment later.
        db
          .select({
            userId: accountMembers.userId,
            isSuperAdmin: accountMembers.isSuperAdmin,
            joinedAt: accountMembers.joinedAt,
          })
          .from(accountMembers)
          .where(eq(accountMembers.accountId, accountId)),
        accountRoleMap(accountId),
        // Direct project grants per member, one batched query (name + role, not
        // just a count) — powers both the "N projects" chip and a popover
        // listing exactly which projects. Active projects only; archived
        // projects don't clutter the chip. Group-derived and implicit
        // (owner/admin) access aren't rows in project_members, so neither is
        // enumerated here — that's the existing explicit_project_count scope.
        Promise.all([
          projectRoleGrants({ accountId }),
          db
            .select({ projectId: projects.projectId, name: projects.name })
            .from(projects)
            .where(and(eq(projects.accountId, accountId), eq(projects.status, 'active'))),
        ]),
        // Group memberships for every member, in one query — so the member list
        // can show which groups each person belongs to without N round-trips.
        // Wrapped so a missing/drifted groups table degrades to "no chips"
        // instead of 500-ing the whole member list.
        (async () => {
            const map = new Map<string, Array<{ group_id: string; name: string }>>();
            try {
              const groupRows = await db
                .select({
                  userId: accountGroupMembers.userId,
                  groupId: accountGroups.groupId,
                  name: accountGroups.name,
                })
                .from(accountGroupMembers)
                .innerJoin(accountGroups, eq(accountGroupMembers.groupId, accountGroups.groupId))
                .where(eq(accountGroups.accountId, accountId));
              for (const g of groupRows) {
                const list = map.get(g.userId) ?? [];
                list.push({ group_id: g.groupId, name: g.name });
                map.set(g.userId, list);
              }
            } catch {
              /* groups table unavailable — return members without group chips */
            }
            return map;
          })(),
          // Active-PAT counts per member, in one aggregate so the member list
          // can flag who's automating against the account. Best-effort —
          // failures degrade to "0".
          (async () => {
            const map = new Map<string, number>();
            try {
              const patRows = await db.execute<{ user_id: string; n: number }>(sql`
      SELECT user_id::text, COUNT(*)::int AS n
      FROM kortix.account_tokens
      WHERE account_id = ${accountId}::uuid AND status = 'active'
      GROUP BY user_id
    `);
              const patData = (patRows as unknown as { rows: typeof patRows }).rows ?? patRows;
              for (const row of patData as Array<{ user_id: string; n: number }>) {
                map.set(row.user_id, row.n);
              }
            } catch {
              /* swallow — display "0 PATs" on failure */
            }
            return map;
          })(),
          // Verified-MFA flag per member from Supabase Auth. Same forgiving
          // fallback as above so the list never 500s if auth.mfa_factors is
          // unavailable in a given environment.
          (async () => {
            const map = new Map<string, boolean>();
            try {
              const mfaRows = await db.execute<{ user_id: string }>(sql`
      SELECT DISTINCT user_id::text
      FROM auth.mfa_factors
      WHERE status = 'verified'
        AND user_id IN (
          SELECT user_id FROM kortix.account_members WHERE account_id = ${accountId}::uuid
        )
    `);
              const mfaData = (mfaRows as unknown as { rows: typeof mfaRows }).rows ?? mfaRows;
              for (const row of mfaData as Array<{ user_id: string }>) {
                map.set(row.user_id, true);
              }
            } catch {
              /* auth.mfa_factors unavailable in this env */
            }
            return map;
          })(),
        ]);
      const rows = identityRows.map((r) => ({
        ...r,
        // Floor labe
```

### Core Architecture Module: `apps/api/src/accounts/core/owner-emails.ts`
```
/**
 * Batched, cached user-email lookup.
 *
 * `resolveAccountDisplayNames` needs the OWNER's email to render a fallback name
 * for placeholder-named accounts. It used to get them from
 * `supabase.auth.admin.getUserById()` — one HTTPS call per owner, fanned out
 * with `Promise.all` and awaited inside `GET /v1/accounts`. That fan-out is free
 * against a localhost Supabase and costs one Auth-API round trip per owner
 * against a hosted project, so the route blocked on N remote calls.
 *
 * `auth.users` is in the same Postgres the API already pools, and reading it
 * directly is the established pattern in this codebase (`iam/account-identity.ts`,
 * `shared/platform-roles.ts`, `admin/index.ts`). One indexed lookup replaces the
 * fan-out, and a short TTL cache collapses repeat calls.
 *
 * Kept as a leaf module (only `db` + `sql`) so it stays unit-testable.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

// Owner emails change rarely and only decorate a display name, so a short TTL
// is the right trade. Bounded so a large tenant cannot grow the map without end.
export const OWNER_EMAIL_TTL_MS = 5 * 60 * 1000;
export const OWNER_EMAIL_CACHE_MAX = 5_000;

interface CacheEntry {
  email: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearOwnerEmailCache(): void {
  cache.clear();
}

export function ownerEmailCacheSize(): number {
  return cache.size;
}

/**
 * Resolve emails for a batch of user ids using ONE query for everything not
 * already cached. Unknown ids resolve to `null`. Never throws: a failed lookup
 * degrades the account name, it does not fail the request.
 */
export async function lookupEmailsByUserIds(
  userIds: string[],
  now: number = Date.now(),
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (userIds.length === 0) return result;

  const misses: string[] = [];
  for (const uid of new Set(userIds)) {
    const hit = cache.get(uid);
    if (hit && hit.expiresAt > now) result.set(uid, hit.email);
    else misses.push(uid);
  }
  if (misses.length === 0) return result;

  try {
    // Explicit placeholder list. Drizzle renders a bare JS array as
    // `($1, $2, …)`, so both `ANY(${ids}::uuid[])` and `IN (${ids})` produce
    // invalid SQL — verified against the live postgres-js driver.
    const placeholders = sql.join(
      misses.map((uid) => sql`${uid}::uuid`),
      sql`, `,
    );
    const rows = (await db.execute(
      sql`SELECT id::text AS id, email FROM auth.users WHERE id IN (${placeholders})`,
    )) as unknown as Array<{ id: string; email: string | null }>;
    for (const r of rows) result.set(r.id, r.email ?? null);
  } catch {
    // auth.users unreachable (restricted role, schema absent). Fall through and
    // cache nothing, so the next call retries rather than pinning a wrong null.
    for (const uid of misses) if (!result.has(uid)) result.set(uid, null);
    return result;
  }

  for (const uid of misses) {
    // Cache misses as null too: a deleted user id would otherwise re-query on
    // every account list.
    if (!result.has(uid)) result.set(uid, null);
    if (cache.size >= OWNER_EMAIL_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(uid, { email: result.get(uid) ?? null, expiresAt: now + OWNER_EMAIL_TTL_MS });
  }
  return result;
}

```

### Core Architecture Module: `apps/api/src/accounts/core/tokens.ts`
```
import { createRoute, z } from '@hono/zod-openapi';
import { eq } from 'drizzle-orm';
import { json, errors, auth } from '../../openapi';
import { accountMembers, accounts } from '@kortix/db';
import { db } from '../../shared/db';
import { accountRolesForUser } from '../../iam/read-models';
import { resolveAccountId } from '../../shared/resolve-account';
import {
  PatPolicyError,
  createAccountToken,
  listAccountTokens,
  listPersonalAccountTokens,
  getAccountTokenOwner,
  revokeAccountToken,
} from '../../repositories/account-tokens';
import { ACCOUNT_ACTIONS, assertAuthorized } from '../../iam';
import { actorOf, type Actor } from '../../iam/actor';
import { isUuid } from '../../shared/validate';
import { loadProjectForUser } from '../../projects/lib/access';
import {
  accountsRouter,
  accountDisplayName,
  AccountTokenSchema,
  OkSchema,
  MeSchema,
  autoClaimPendingInvites,
  resolveAccountForUser,
  resolveAccountDisplayNames,
  lookupEmailsByUserIds,
} from './app';
import { readJsonObject } from '../../shared/http-body';

/**
 * A query flag arrives as a string or not at all. `?mine`, `?mine=true` and
 * `?mine=1` all mean yes; anything else — including `?mine=false` — means no,
 * so a caller that spells the negative out gets the unnarrowed list rather
 * than a surprising narrowing on the truthiness of the string "false".
 */
export function isTruthyFlag(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return raw === '' || raw === 'true' || raw === '1';
}

/**
 * Whether the caller holds the person's full identity: a browser session, or an
 * unscoped personal access token. Only such a caller may mint or revoke a
 * personal token on the `token.personal.*` leaves. Every other credential — a
 * project-scoped PAT, an agent session, a service account, a third-party
 * `kortix_oat_` OAuth token, a sandbox API key — keeps needing the admin
 * `token.create` / `token.revoke` leaves, so it can never turn itself into a
 * wider or longer-lived bearer than the one it holds.
 */
export function actsAsFullIdentity(authType: string | undefined, actor: Actor): boolean {
  const credential = actor.credential;
  if (authType === 'supabase') return credential.kind === 'jwt';
  if (authType === 'pat') return credential.kind === 'pat' && credential.projectId === null;
  return false;
}

// Routes are registered via this function (called by the orchestrator AFTER
// middleware + mounts) so the registration order stays byte-identical to the
// original single-file router.
export function registerTokenRoutes(): void {
// GET /v1/accounts/me — identity probe for CLI + dashboard nav
accountsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['accounts'],
    summary: 'Identity probe for CLI + dashboard nav',
    ...auth,
    responses: {
      200: json(MeSchema, 'The authenticated user and their account memberships'),
      ...errors(401),
    },
  }),
  async (c: any) => {
  const userId = c.get('userId') as string;
  const authType = (c.get('authType') as string | undefined) ?? null;
  let userEmail = (c.get('userEmail') as string) || '';
  // CLI PAT requests carry no email in context (the auth middleware sets it
  // empty for PATs), so resolve it from the user record — otherwise whoami
  // and friends only ever see the user id.
  if (!userEmail) {
    userEmail = (await lookupEmailsByUserIds([userId])).get(userId) || '';
  }

  const loadMemberships = async (): Promise<Array<{
    accountId: string;
    accountRole: string;
    name: string;
  }>> => {
    try {
      // `account_members` says WHICH accounts; `role_assignments` says at what
      // role — the same split GET /accounts uses.
      const [rows, rolesByAccount] = await Promise.all([
        db
          .select({
            accountId: accountMembers.accountId,
            name: accounts.name,
          })
          .from(accountMembers)
          .innerJoin(accounts, eq(accountMembers.accountId, accounts.accountId))
          .where(eq(accountMembers.userId, userId)),
        accountRolesForUser(userId),
      ]);
      return rows.map((r) => ({ ...r, accountRole: rolesByAccount.get(r.accountId) ?? 'member' }));
    } catch {
      /* table may not exist yet */
      return [];
    }
  };

  // Bootstrap BEFORE claiming pending invites (R3 — see
  // accounts/core/accounts.ts:registerAccountRoutes, GET /). Decide on the
  // PRE-claim membership count, not the post-claim one: the old order
  // claimed first, so an invite-first caller of THIS route also never got a
  // personal account — whichever of /accounts or /accounts/me a client hit
  // first silently decided the user's fate, which is exactly the coupling
  // R3 was chosen to remove. `resolveAccountId` re-checks membership itself
  // and bootstraps only when it is still zero, so reading it here before
  // the claim is what makes the bootstrap actually fire.
  let memberships = await loadMemberships();
  if (memberships.length === 0 && authType === 'supabase') {
    await resolveAccountId(userId);
    memberships = await loadMemberships();
  }
  if (authType === 'supabase' && userEmail) {
    await autoClaimPendingInvites(userId, userEmail);
    memberships = await loadMemberships();
  }

  const displayNames = await resolveAccountDisplayNames(memberships, {
    userId,
    email: userEmail,
  });

  return c.json({
    user_id: userId,
    email: userEmail,
    token_context: {
      auth_type: authType,
      project_id: (c.get('tokenProjectId') as string | undefined) ?? null,
      session_id: (c.get('sessionId') as string | undefined) ?? null,
      agent: (c.get('agentGrant') as { agent?: string } | null | undefined)?.agent ?? null,
      connectors: (c.get('agentGrant') as { connectors?: string[] | 'all' } | null | undefined)?.connectors ?? null,
      kortix_permissions: (c.get('agentGrant') as { permissions?: string[] | 'all' } | null | undefined)?.permissions ?? null,
      // Deprecated wire alias of `kortix_permissions` — CLIs released before
      // the 2026-09-22 rename read this key.
      kortix_cli: (c.get('agentGrant') as { permissions?: string[] | 'all' } | null | undefined)?.permissions ?? null,
      env: (c.get('agentGrant') as { env?: string[] | 'all' } | null | undefined)?.env ?? null,
    },
    accounts: memberships.map((m) => ({
      account_id: m.accountId,
      slug: m.accountId.slice(0, 8),
      name: displayNames.get(m.accountId) ?? accountDisplayName(m.name, userEmail),
      role: m.accountRole,
    })),
  });
  },
);

// GET /v1/accounts/tokens — list CLI PATs for the active account
accountsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/tokens',
    tags: ['accounts'],
    summary: 'List CLI PATs for the active account',
    ...auth,
    request: {
      query: z
        .object({
          account_id: z.string(),
          // `mine=true` narrows the list to the CALLER'S OWN hand-minted API
          // keys — no other member's keys, no session connector tokens, no
          // service-account bearers. That is what a person's own settings page
          // shows (`/settings/tokens`); the account hub's Tokens tab is the
          // automation surface and reads service accounts instead. Any other
          // value is the unnarrowed account-wide list this route always
          // returned, so no existing caller changes behaviour.
          mine: z.string(),
        })
        .partial(),
    },
    responses: {
      200: json(z.array(AccountTokenSchema), 'Personal access tokens'),
      ...errors(401, 403),
    },
  }),
  async (c: any) => {
  const userId = c.get('userId') as string;
  const queryAccount = c.req.query('account_id') ?? undefined;

  let accountId: string;
  try {
    accountId = await resolveAccountForUser(userId, queryAccount);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 403);
  }

  await assertAuthorized(await actorOf(c, accountId), ACCOUNT_ACTIONS.TOKEN_READ);

  const onlyMine = isTruthyFlag(c.req.query('mine'));
  const tokens = onlyMine
    ? await listPersonalAccountTokens(accountId, userId)
    : await listAccountTokens(accountId);
  return c.json(
    tokens.map((t) => ({
      token_id: t.tokenId,
      name: t.name,
      project_id: t.projectId ?? null,
      public_key: t.publicKey,
      status: t.status,
      expires_at: t.expiresAt?.toISOString() ?? null,
      last_used_at: t.lastUsedAt?.toISOString() ?? null,
      created_at: t.createdAt.toISOString(),
      revoked_at: t.revokedAt?.toISOString() ?? null,
    })),
  );
  },
);

// POST /v1/accounts/tokens — mint a new PAT (plaintext returned ONCE)
accountsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/tokens',
    tags: ['accounts'],
    summary: 'Mint a new PAT (plaintext returned once)',
    ...auth,
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string(),
              account_id: z.string().optional(),
              expires_at: z.string().optional(),
              project_id: z.string().uuid().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: json(AccountTokenSchema, 'The newly minted token (secret_key returned once)'),
      ...errors(400, 401, 403),
    },
  }),
  async (c: any) => {
  const userId = c.get('userId') as string;
  // A connected app's revocable `kortix_oat_` token must not mint a durable one.
  if (c.get('authType') === 'oauth') {
    return c.json({ error: 'Connected apps cannot mint personal access tokens.' }, 403);
  }
  const body = await readJsonObject(c);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return c.json({ error: 'name is required' }, 400);
  }
  if (name.length > 255) {
    return c.json({ error: 'name too long (max 255 chars)' }, 400);
  }
  const accountOverride =
    typeof body.account_id === 'string' && body.account_id.trim() ? body
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9199** (2026-10-05): **fix(config-releases): relative OpenCode instructions read the release, not /workspace**
  *Symptoms*: ## Summary  With `config_releases` on, OpenCode still read relative `instructions` files from the session's `/workspace` checkout, not from the release. OpenCode resolves a relative entry against the session directory, never against its config dir: `session/instruction.ts`, `globUp(instruction, ctx.directory, ctx.worktree)`, OpenCode 1.18.23. So `"instructions": ["rules/RULES.md"]` ignored the base branch's copy whenever `/workspace` was behind it.  Now, while OpenCode serves a release, the composed config loads one platform plugin, `kortix-release-instructions.js`, with a `config` hook: - The hook receives OpenCode's live config and rewrites each relative `instructions` entry to the release root (`/opt/kortix/config/<release_id>/…`). - It finds the root from the real path of `OPENCODE_CONFIG_DIR`, which is the boot link. - OpenCode unions instruction arrays across config files, so only this hook can replace the entry instead of adding a second one. - URLs, `~/`, absolute paths, and globs in a directory part keep OpenCode's own resolution. - With the flag off, or on the image default, the plugin is not loaded.  Follow-up to #9197.  ### Also in this PR - `apps/web/src/lib/seo/content-timestamps.json`: the #9197 squash merge moved the runtime doc's commit time, so `build-content-timestamps.test.mjs` is red on `main` since #9197. Regenerated.  ### Not changed - OpenCode's own `AGENTS.md` lookup (`findUp` from `/workspace`) still reads the session checkout. It is not an `instruct
  **Post-Mortem & Fix Analysis**:
  > @DimitrijeGlibic is attempting to deploy a commit to the **Kortix AI Corp** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Kortix%20AI%20Corp&slug=kortixai&teamId=team_6wPTUrLXccl65xQAtgxIFIt6&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22577b8a4c735d43cf998784e409dfc43f3faf7e11%22%7D%2C%22id%22%3A%22Qmd9SsWS3PhahHqWPdQJ8FRxvqwtgGrrZrE5WoP93g9GKp%22%2C%22org%22%3A%22kortix-ai%22%2C%22prId%22%3A9199%2C%22repo%22%3A%22suna%22%7D).  
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed the config-releases instruction-path fix end to end. The change adds a platform plugin (`kortix-release-instructions.js`) that rewrites relative OpenCode `instructions` entries to the release root, derived from the real path of the `OPENCODE_CONFIG_DIR` boot link, and gates plugin load on `servesRelease` (verified by `releaseRootOf`). I traced the full data flow of `config.instructions` — entries originate only from the server-compiled agent config, the repository's own OpenCode config (both trusted project/org input), and platform-appended absolute paths — down through the plugin's `resolve(root, entry)` rewrite to OpenCode's file read. No attacker-controlled input crosses a trust boundary: the release store is hash-verified, and the in-box agent already runs as the same user with sudo, so instruction-path traversal (`..` escaping the release root 
  > <!-- dev-live --> ### Not live on dev yet  `972b5b1a2f` did not reach every surface this deploy changed. The next deploy from `main` retries every surface that is still stale, and edits this comment.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `972b5b1a2f` | | Web · dev.kortix.com | deploy failure |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37386484411

- **Issue #9198** (2026-10-05): **fix(snapshots): a failed Platinum template build names its cause**
  *Symptoms*: ## Summary  A failed Platinum template build reached users as a bare `Platinum template <name> build failed` with `error_category: unknown`, so `kortix sandboxes builds` and the dashboard gave no cause. Platinum already stores the podman output in `build_logs` and ends it with `[build failed] <reason>`; `waitForActive` dropped it.  - `waitForActive` reads `build_logs` from the polled by-id row (or one detail read when the row has none), streams the last 40 lines to the build-log tap, and throws `PlatinumTemplateBuildFailedError` whose message names the failing lines and the trailer — bounded to 400 chars per line and 1,200 total, because the message is stored on the build row and shown in UIs. - `isRetryablePlatinumBuildError` decides that error before its substring heuristics, by type and by message prefix (for a re-wrapped copy). Log text such as `timeout`, `no such file` or `network` can no longer flip a deterministic build failure into a retry that burns up to three ~9-minute attempts.  Found while debugging a prod project whose custom-Dockerfile template failed 4× on Platinum with no detail: the cause was a project `ENV` leaking into the appended Kortix layer (`uv python install` → `Permission denied` at STEP 15/49), visible only by reading `templates.build_logs` on Platinum directly.  Before → after, for that build:  ``` Platinum template kortix-tpl-<hash> build failed ``` ``` Platinum template kortix-tpl-<hash> build failed: error: failed to create file `/opt/uv-python
  **Post-Mortem & Fix Analysis**:
  > [vc]: #RM7fcQ06Ru+w3LvXMrOl4wjg6H5UvIIxLgnDW6cLpOw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS81M3g2WXVMUUZKNlJSd0xmQnd1d1NCclM0NEx1IiwicHJldmlld1VybCI6InN1bmEtZ2l0LWZpeC1wbGF0aW51bS1idWlsZC1mYWlsdXJlLWRldGFpbC1rb3J0aXhhaS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJhcHBzL3dlYiJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9a29ydGl4LWFpJnJlcG89c3VuYSZwcj05MTk4In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/sun
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed PR #9198 (improved diagnostics for failed Platinum template builds). The change embeds a bounded tail of the provider's redacted build_logs into a new PlatinumTemplateBuildFailedError, streams the last 40 log lines to the optional build tap, and pins these deterministic failures non-retryable by type/message-prefix before the transient substring heuristics. I traced the full data path: the error message is persisted to projectSnapshotBuilds.error (sliced to 2000 chars) and rendered in the dashboard as a React text node inside `<pre>` (auto-escaped), and in the CLI only as a truncated first line; JSON output escapes control characters. No unescaped HTML/markdown sink consumes this text in web or mobile, semgrep produced no findings, and the remaining changed files are tests and generated attestation manifests. The bounding (400-chars/line, 1200 total
  > <!-- dev-live --> ### Live on dev — 10m 24s after merge  `832402486e` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `832402486e` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37382689616

- **Issue #9197** (2026-10-05): **feat(config-releases): a release is a checkout of the base branch, with the repository's own layout**
  *Symptoms*: ## Summary  With `config_releases` on, a session's config came from an OpenCode-shaped release. It contained the OpenCode config dir with the root `skills/` merged into it and the pi config dir moved to `pi/`. That tree matched nothing in the repository. Every file outside those trees was missing: `AGENTS.md`, `memory/`, imported domain manifests, and code a tool imports. A config that worked in `/workspace` broke with the flag on.  A release is now **the base commit's whole tree**: the same files and folders a checkout holds in `/workspace`, under `/opt/kortix/config/<release_id>/`. Each harness reads its dirs inside the release exactly as it reads them in `/workspace`. Nothing is rearranged.  | | Before | After | |---|---|---| | `/opt/kortix/config/<id>/` (company repo) | `bun.lock opencode.jsonc package.json plugins skills tools`, 126 of 248 files | the repo root: `AGENTS.md agents connectors engineering harnesses kortix.yaml marketing memory sales scripts shared skills support …`, all 248 files, 2.6 MB | | OpenCode config dir | `<release>/` | `<release>/harnesses/opencode` (the manifest's `opencode.config_dir`), served through `/opt/kortix/config/boot` | | OpenCode project skills | merged into `<release>/skills` | `<release>/skills`, as on the working tree | | pi | `<release>/skills`, `<release>/pi` | `<release>/skills` (+ legacy `.kortix/opencode/skills`), and its config dir resolved by `resolvePiProjectConfigDir` (`pi.config_dir`, `harnesses/pi`, `.kortix/pi`) | | A too
  **Post-Mortem & Fix Analysis**:
  > @DimitrijeGlibic is attempting to deploy a commit to the **Kortix AI Corp** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Kortix%20AI%20Corp&slug=kortixai&teamId=team_6wPTUrLXccl65xQAtgxIFIt6&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2200fb6018702c19ac88afa230c7d7d21c40c80db3%22%7D%2C%22id%22%3A%22Qmen3u8cRAkFLFFHSzKWPxbUfvLMqBXtbNjmhqpw8SvBKu%22%2C%22org%22%3A%22kortix-ai%22%2C%22prId%22%3A9197%2C%22repo%22%3A%22suna%22%7D).  
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed the config-release refactor end to end: the API-side release-tree/builder/routes/serve-archive changes and the daemon-side boot-config/descriptor/release and OpenCode/pi harness changes. The release now ships the commit's full tree, but that change does not widen exposure — the archive and descriptor routes remain project-scoped and the whole-tree archive is withheld from sessions without repository access (`repositoryAccessFromSessionMetadata`), matching `toDescriptor`'s governance-only path. `config_dir`/`pi.config_dir` are validated as repo-relative paths (rejecting `..`, `.`, absolute, and unsafe characters), archive tree IDs are constrained to the project mirror, and the composed-archive path re-validates the commit and agent parameters. Extraction, sealing, and verification continue to refuse unsafe paths, write symlinks last, and compare syml
  > <!-- dev-live --> ### Not live on dev yet  `62a4514c7e` did not reach every surface this deploy changed. The next deploy from `main` retries every surface that is still stale, and edits this comment.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `62a4514c7e` | | Gateway · gateway-dev.kortix.com | serving `62a4514c7e` | | Web · dev.kortix.com | deploy failure |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37377141914. Shipped together with #9194.

- **Issue #9195** (2026-10-05): **Promote selected main commits (through 2010294429) to staging**
  *Symptoms*: ## Summary Selective release candidate. Cuts from `staging` (14ec877822) and cherry-picks (`-x`) these 10 commits from `main`, in `main` order:  - 28223a77dc fix(web): plain session header menu items, use Copy icon (#9169) - c6f92a56e4 feat(web): address-pill header for the session file and app viewers (#9171) - 1e89e4d188 feat(mobile): ship JS/TS as OTA updates from CI, guarded by the native fingerprint (#8767) - 15aa6c46ef fix(mobile): compare OTA native code only against builds of the current app id (#9175) - bf27469435 feat(mobile): one shimmer per running turn, Files row opens the Files page (#9176) - 4f2ef4049e feat(web): show hover card names running ports and links, not only files (#9178) - b5d17c91b4 fix(web): demo booking keeps its confirmation open and closes only on request (#9179) - 569b23a7ad fix(mobile): list the project's Apps instead of always showing "No apps yet" (#9183) - 49d084612f feat(web): redesign authenticator app enrollment in Security settings (#9185) - 2010294429 fix(mobile): scroll the drawer nav pills with the session list (#9192)  Conflict resolution on #8767: - `tests/migration/kortix-yolo-profiles-unused-indexes.test.ts`: not added. It tests migration #8935, which this candidate does not include. - `apps/web/src/lib/seo/content-timestamps.json`: kept the staging version (generated file).  No migrations are in the set.  ## Test plan - [ ] Every check on this PR finishes and passes (full six-lane `Tests`, CodeQL, scanners, builds). - [ ] After 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #5+iJh+rYaspXQzsekDHOGfF3+OUkyM2i6Z0BUM55DAU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS9CVnMxNFk3MTJONTNvYkd3emZxcDJpenNaNnVvIiwicHJldmlld1VybCI6InN1bmEtZ2l0LXNjcmF0Y2gtcHJvbW90ZS1zZWxlY3RpdmUtMjAxMDI5NDQyOS1rb3J0aXhhaS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJhcHBzL3dlYiJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9a29ydGl4LWFpJnJlcG89c3VuYSZwcj05MTk1In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai
  > <!-- strix-pr-review:master --> ## Strix Security Review  <!-- strix-pr-review:unreviewed-commits --> > [!WARNING] > This pull request has **1 commit** after the last Strix review (`a684e92`). Strix has **not** reviewed these changes. > Automatic review on push is off for this repository. To review the latest changes, tag `@strix-security` in a comment, or [turn on re-review on push](https://app.strix.ai/repositories/af7f4d79-2ea3-4790-bbf7-c1e4cdcae7fa). <!-- /strix-pr-review:unreviewed-commits -->  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all 87 changed files across this release-candidate promotion: the new mobile OTA release pipeline (CI workflow, `ota-publish.mjs`, `set-version.mjs`), the TOTP MFA enrollment UI redesign, the public share-link expiry feature, the demo-booking modal rework, the Android package rename, and the accompanying web/mobile UI and i18n changes.  The new OTA pipeline is defensive rather than risky: `EXPO_TOKEN` is sourc
  > <!-- Blacksmith CI Status --> Found 2 test failures on Blacksmith runners:  ### Failures  | Test | View Logs | | --- | --- | | <code>learnings-ledger.test.ts/the learnings ledger &gt;</code><br /><code> accepts an index reordered by a squash merge and rejects one that lost a line</code> | [View Logs](https://app.blacksmith.sh/kortix-ai/runs/37366531243/jobs/111952961168?attempt=1&ref=gh_comment&autoLogin=true&tab=tests&status=failed#test=9a46d653-7050-418f-8b65-28b703c2f13d) | | <code>learnings-ledger.test.ts/the learnings ledger &gt;</code><br /><code> keeps MEMORY.md listing the lines scripts/index.sh generates, in any order</code> | [View Logs](https://app.blacksmith.sh/kortix-ai/runs/37366531243/jobs/111952961168?attempt=1&ref=gh_comment&autoLogin=true&tab=tests&status=failed#test=6f6813ab-b6a6-4eda-843b-aa45ce78052c) |  <a href="https://app.blacksmith.sh/kortix-ai/codesmith/suna/pr/9195?prompt=Repository%3A+kortix-ai%2Fsuna%0ABranch%3A+scratch%2Fpromote-selective-2010294429%0APR%3

- **Issue #9194** (2026-10-05): **fix(desktop): show the DMG background on macOS 26**
  *Symptoms*: ## Summary  The drag-to-install DMG window from #9190 shows the default empty window on macOS 26. There are two reasons:  - dmg-builder 25.1.8 (the vendored dmgbuild) writes a `pBBk` bookmark into the volume `.DS_Store` with a volume-relative path (`/.background/1.tiff`). Finder on macOS 26 uses that bookmark first, fails to resolve it (error 4), and skips the valid `icvp.backgroundImageAlias`. - The v0.13.50 installers were built before #9190 merged.  Fix: `patches/dmg-builder@25.1.8.patch` removes the bookmark write (`Bookmark.for_file(background_file)` in `vendor/dmgbuild/core.py`), so Finder resolves the alias. The patch is registered in `pnpm.patchedDependencies`. CI's `pnpm install --frozen-lockfile` in `desktop.yml` and `deploy-prod.yml` applies it. Upstream: electron-builder#9072, dmgbuild#275.  I chose the patch over upgrading to electron-builder 26.15.3. Both fix the background, but the upgrade changes signing, the universal merge, and how app dependencies are collected.  ## Test plan  - [x] Unsigned universal DMGs built locally with `electron-builder --mac dmg --universal --prepackaged dist/mac-universal/Kortix.app --publish never` on macOS 26.6. - [x] Finder probe: shadow-attach the DMG, reset the atime of the files in `.background/`, `open -a Finder`, then check whether Finder read the background:   - Finder-made backgrounds (APFS and HFS+): read.   - Image present but no background set: not read.   - Build without the patch (0.13.51, has `pBBk`): **not read**, i
  **Post-Mortem & Fix Analysis**:
  > [vc]: #iIaeckInGi2IUluKbFx20w1K6PLORqd8EACdwjupf5w=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS8ybjI4Qlh5M0F0YVFtalBjTWllUkFmNVA0RjZKIiwicHJldmlld1VybCI6InN1bmEtZ2l0LWZpeC1kZXNrdG9wZG1nLWJhY2tncm91bmQtbWFjb3MyNi1rb3J0aXhhaS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJhcHBzL3dlYiJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9a29ydGl4LWFpJnJlcG89c3VuYSZwcj05MTk0In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/sun
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all three changed files in PR #9194 (package.json, patches/dmg-builder@25.1.8.patch, pnpm-lock.yaml). The change is packaging-only: it registers a pnpm patch for the build-time dmg-builder dependency, and the patch removes a single `Bookmark.for_file(background_file)` line from vendored dmgbuild core.py so the drag-to-install DMG background renders correctly on macOS 26. No runtime code, input handling, authentication, authorization, cryptographic, or secret-handling logic is touched, and no security control is removed. No security vulnerabilities were identified.  </details>  <sub>Updated for `7bf7812`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=07fea5c6-84b2-4561-87b0-1dc85e9d5a9c) · [Configure security review settings](https://app.strix.ai/repositories/af7f4d79-2ea3-
  > <!-- dev-live --> ### Not live on dev yet  `62a4514c7e` did not reach every surface this deploy changed. The next deploy from `main` retries every surface that is still stale, and edits this comment.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `62a4514c7e` | | Gateway · gateway-dev.kortix.com | serving `62a4514c7e` | | Web · dev.kortix.com | deploy failure |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37377141914. Shipped together with #9197.

- **Issue #9193** (2026-10-05): **fix(auth): a signed-out device's bearer stops working at once; label the device routes**
  *Symptoms*: ## Summary  `main` is red after #9184 (signed-in devices). This fixes forward the two failures `pnpm test` shows on `main`:  1. **`AUTH-7` (security behavior): a signed-out device's bearer kept working.**    - `DELETE /v1/accounts/me/devices/:sessionId` revoked the GoTrue session but left the JWT liveness cache (`shared/jwt-liveness.ts`) alone.    - That cache keeps a positive GoTrue answer per token for `SUPABASE_JWT_LIVENESS_TTL_MS`: 2 s in the local test profile (`tests/src/core/local-stack.ts:662`). Its contract says prod must run 0.    - So the signed-out device's bearer answered `200` instead of `401` for up to the TTL. `AUTH-7` probes it right away and failed: `status in [401] — expected [401], got 200`, 3 of 3 runs alone.    - `POST /v1/auth/logout` already drops its own token (`forgetJwtLiveness`). The device route now calls the existing `forgetUserJwtLiveness(userId)`.    - The cache keys tokens, not sessions, so it cannot drop only the signed-out device's entry. The caller's other devices re-ask GoTrue once on their next request. 2. **`unit-audit-route-labels`: the 2 device routes had no audit label.** Added `auth.device.list` ("Viewed signed-in devices") and `auth.device.sign_out` ("Signed a device out"), with both titles in 9 locales. The generated audit catalogs and `audit-actions.mdx` are regenerated.  Found while merging `main` into #9189; that PR cannot get a green attestation while `main` is red.  ## Demo video  No UI change. The evidence is the flow output 
  **Post-Mortem & Fix Analysis**:
  > @DimitrijeGlibic is attempting to deploy a commit to the **Kortix AI Corp** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Kortix%20AI%20Corp&slug=kortixai&teamId=team_6wPTUrLXccl65xQAtgxIFIt6&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%220462a400a7359f0e8b9fe7e0fb0e219357748b20%22%7D%2C%22id%22%3A%22QmUJEq7XYAEuro5diw7mazqVfKwxVZrE7D9jyqaHEFmJMV%22%2C%22org%22%3A%22kortix-ai%22%2C%22prId%22%3A9193%2C%22repo%22%3A%22suna%22%7D).  
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed all 17 changed files. The only security-relevant logic change is in apps/api/src/accounts/core/devices.ts: the DELETE device route now calls forgetUserJwtLiveness(userId) after a successful sign-out so the signed-out device's cached bearer is invalidated immediately. The userId is derived from the authenticated session context, signOutDevice enforces session ownership via a parameterized query, and forgetUserJwtLiveness only drops the calling user's own cache entries, so no authorization, injection, or cross-user issue is introduced. The remaining changes are audit-route labels, generated catalogs, i18n translations, docs, and a test attestation file — all without security impact. No vulnerabilities found in the PR.  </details>  <sub>Updated for `0462a40`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/a
  > <!-- dev-live --> ### Live on dev — 18m 58s after merge  `709cda2cc7` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `709cda2cc7` | | Gateway · gateway-dev.kortix.com | serving `709cda2cc7` | | Web · dev.kortix.com | serving `709cda2cc7` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37357821251. Shipped together with #9184, #9190, #9192, #9188.

- **Issue #9192** (2026-10-05): **fix(mobile): scroll the drawer nav pills with the session list**
  *Symptoms*: ## Summary - The project drawer's Search, Files, Review and Apps pills move from a fixed block above the list into the session list's header. They scroll with the sessions, so adding a pill no longer takes list height away. - While the viewer's own session list is loading, the drawer shows only the loader. The Shared header (a smaller page, often back first) and the Automated header (always shown) no longer render under it. - The list's top fade now sits under the switcher row. `apps/mobile/design.md` → Project sidebar is updated to match.  ## Test plan - [ ] Open a project with sessions on a cold start: the drawer shows the loader alone, with no Shared or Automated header under it. - [ ] After the load: Search, Files, Review and Apps sit above Needs you / Sessions and scroll up with the list. - [ ] Tap each pill: it closes the drawer and opens its page once (double-tap guard). - [ ] The Review count pill still shows when items wait. - [ ] Pull to refresh still works from the top of the list.  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/kortix-ai/codesmith/suna/pr/9192?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.bla
  **Post-Mortem & Fix Analysis**:
  > [vc]: #7oG7bPmnVsEmkz120cE5y+LlE0WeFztpVvnU+mu/rxE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS81RXY0N2F0Mm1IOVJhc1FxbVBWNGRNU0hhaTUxIiwicHJldmlld1VybCI6InN1bmEtZ2l0LXJldmFtcC1tb2JpbGUtdWktMTYta29ydGl4YWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWtvcnRpeC1haSZyZXBvPXN1bmEmcHI9OTE5MiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="ht
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  Reviewed the full diff for PR #9192. The only functional change is in `apps/mobile/components/session/ProjectLeftDrawer.tsx`, which relocates the Search/Files/Review/Apps navigation pills from a fixed block above the session list into the list's scrolling header, and suppresses section rendering while the viewer's own session list is loading. These are presentation and navigation-only changes: no new attacker-controlled input paths, sinks, authentication/authorization logic, cryptography, secrets, or client-side data handling were introduced. The navigation handlers and their double-tap guard are unchanged. The remaining three files (`design.md`, `MEMORY.md`, and the ASO mockup reference) are documentation only. Targeted static analysis reported no findings.  </details>  <sub>Updated for `cdc70b6`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-
  > <!-- dev-live --> ### Live on dev — 17m 54s after merge  `709cda2cc7` serves on every surface this deploy changed, checked on `/health`.  | Surface | Result | |---|---| | API · dev-api.kortix.com | serving `709cda2cc7` | | Gateway · gateway-dev.kortix.com | serving `709cda2cc7` | | Web · dev.kortix.com | serving `709cda2cc7` |  Deploy run: https://github.com/kortix-ai/suna/actions/runs/37357821251. Shipped together with #9184, #9190, #9193, #9188.

- **Issue #9190** (2026-10-05): **feat(desktop): drag-to-install DMG window with a dithered background**
  *Symptoms*: ## Summary  The macOS DMG used electron-builder's default window. This change gives it a drag-to-install window.  - `apps/desktop-electron/electron-builder.yml`, `dmg:` block:   - `background: build/background.png`;   - `iconSize: 160`;   - `Kortix.app` at (180, 170) and an `/Applications` link at (480, 170).   - The layout matches `sindresorhus/create-dmg` 8.1.0: a 660 × 400 window with two 160pt icons. - `apps/desktop-electron/build/background.png` (660 × 400) and `background@2x.png` (1320 × 800, 144 dpi):   - a `#102B53` 8 × 8 ordered dither on white;   - a dithered chevron with round ends between the icons;   - a dither band that rises from the bottom edge and starts below the icon labels. - dmg-builder finds `background@2x.png` next to `background.png`. It merges the two into one HiDPI TIFF (`tiffutil -cathidpicheck`), so the window is sharp on Retina displays. - The artwork's source is the "Desktop DMG · dither install window" page in the Kortix Paper file.  ![DMG window preview](https://github.com/user-attachments/assets/e2e57d91-ce78-4bd3-83fc-19020f7442c3)  ## Test plan  - [x] `bun test src` in `apps/desktop-electron`: 171 pass, 0 fail. - [ ] `pnpm test`: not run. The branch was pushed with `--no-verify`, so no attestation is committed and `pnpm test:verify` fails on this head until `pnpm test` runs. - [x] Built the universal app and the DMG locally, without signing:   - `electron-builder --dir --mac --universal`   - `electron-builder --mac dmg --universal --prepacka
  **Post-Mortem & Fix Analysis**:
  > [vc]: #A5N6nNvk6dZG4Imp/fSSZJBeb3vSpUTpJoYJfiMYaUE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdW5hIiwicHJvamVjdElkIjoicHJqX1NvVVVTTkpQdk9URG5lRTBFN2ZhV0hGdVdNQVkiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20va29ydGl4YWkvc3VuYS82bXRCMWY4azR4NVBxNll5Z2h4M3A2QnZzTmhEIiwicHJldmlld1VybCI6InN1bmEtZ2l0LWRlc2t0b3AtZG1nLXdpbmRvdy1rb3J0aXhhaS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJhcHBzL3dlYiJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9a29ydGl4LWFpJnJlcG89c3VuYSZwcj05MTkwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/kortixai/suna"><sup><img src="ht
  > <!-- strix-pr-review:master --> ## Strix Security Review  No security issues found.  <details> <summary>Review summary</summary>  This PR adds a custom drag-to-install window to the macOS DMG. The only non-binary change is a `dmg:` block in `apps/desktop-electron/electron-builder.yml` that sets the background image, icon size, and app / Applications icon positions; the two added files are static PNG background images. These are packaging-time, cosmetic DMG layout settings with no runtime code path, no user input, no secrets, and no effect on application security. No security-relevant change was found.  </details>  <sub>Updated for `4213ca4`.</sub>  --- *Reviewed by [Strix](https://strix.ai)* <sub>[Re-run review](https://app.strix.ai/api/pr-reviews/rerun?review_id=6ee58aa3-e986-41eb-9b9c-77b10e6b8e6b) · [Configure security review settings](https://app.strix.ai/repositories/af7f4d79-2ea3-4790-bbf7-c1e4cdcae7fa)</sub>
  > <!-- linear-linkback --> <p><a href="https://linear.app/kortix/issue/KRTX-1648">KRTX-1648</a></p>

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

### Incident Patch 1: `972b5b1a` (2026-10-05)
**Commit Message**: fix(config-releases): relative OpenCode instructions read the release, not /workspace (#9199)

## Summary

With `config_releases` on, OpenCode still read relative `instructions`
files from the session's `/workspace` checkout, not from the release.
OpenCode resolves a relative entry against the session directory, never
against its config dir: `session/instruction.ts`, `globUp(instruction,
ctx.directory, ctx.worktree)`, OpenCode 1.18.23. So `"instructions":
["rules/RULES.md"]` ignored the base branch's copy whenever `/workspace`
was behind it.

Now, while OpenCode serves a release, the composed config loads one
platform plugin, `kortix-release-instructions.js`, with a `config` hook:
- The hook receives OpenCode's live config and rewrites each relative
`instructions` entry to the release root
(`/opt/kortix/config/<release_id>/…`).
- It finds the root from the real path of `OPENCODE_CONFIG_DIR`, which
is the boot link.
- OpenCode unions instruction arrays across config files, so only this
hook can replace the entry instead of adding a second one.
- URLs, `~/`, absolute paths, and globs in a directory part keep
OpenCode's own resolution.
- With the flag off, or on the image default, the

**File**: `apps/api/src/config-releases/ROLLOUT.md` (modified, +10/-3)
```diff
@@ -136,9 +136,16 @@ request. The store is a cache; the Git mirror is always the source of truth.
 - Every commit to the base branch is a new release, because the tree changed.
   Running sessions converge to it in the background; a prompt on a box that is
   behind converges first.
-- A config file that points at another file of the repository by a relative
-  path (an `instructions` entry `../../rules/RULES.md`, a tool that imports
-  `../../../shared/x`) resolves inside the release exactly as in `/workspace`.
+- A tool that imports another file of the repository by a relative path
+  (`../../../shared/x`) resolves inside the release exactly as in `/workspace`.
+- OpenCode resolves a relative `instructions` entry against the session
+  directory (`/workspace`), not its config dir. While OpenCode serves a release,
+  the platform plugin `kortix-release-instructions.js`
+  (`harness/open-code/release-instructions.ts`) rewrites each relative entry to
+  the release root, so `"rules/RULES.md"` reads the base branch's file. URLs,
+  `~/`, absolute paths and globs in a directory part keep OpenCode's own
+  resolution. The project's `AGENTS.md` is OpenCode's own lookup from
+  `/workspace` and is not rewritten.
 - The descriptor format is `config-release-v2`. A daemon built for v1 (the
   composed layout) refuses it and keeps its running config until the
   runtime-assets swap gives it the current daemon.
```

**File**: `apps/kortix-sandbox-agent-server/src/__tests__/release-instructions.test.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+/**
+ * OpenCode resolves a relative `instructions` entry against the session
+ * directory (`/workspace`), never against its config dir (session/instruction.ts
+ * `globUp(instruction, ctx.directory, ctx.worktree)`, OpenCode 1.18.23). With a
+ * config release that read the session's checkout instead of the base branch's
+ * files (2026-10-05). The platform plugin rewrites those entries to the release.
+ */
+import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
+import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+import { RELEASE_INSTRUCTIONS_PLUGIN_SOURCE } from '@/harness/open-code/release-instructions'
+import { buildOpencodeConfigContent } from '@/harness/open-code/lifecycle'
+
+const ID = 'a'.repeat(64)
+let root: string
+let previousDir: string | undefined
+
+async function runHook(servedDir: string, instructions: unknown): Promise<unknown> {
+  const link = join(root, 'boot')
+  rmSync(link, { force: true })
+  symlinkSync(servedDir, link)
+  process.env.OPENCODE_CONFIG_DIR = link
+  const file = join(root, `plugin-${crypto.randomUUID()}.js`)
+  writeFileSync(file, RELEASE_INSTRUCTIONS_PLUGIN_SOURCE)
+  const mod = (await import(pathToFileURL(file).href)) as Record<string, () => Promise<{ config: (c: unknown) => Promise<void> }>>
+  const hooks = await mod.KortixReleaseInstructions!()
+  const config = { instructions }
+  await hooks.config(config)
+  return config.instructions
+}
+
+beforeEach(() => {
+  // Real path: macOS's tmpdir is a symlink (/var → /private/var), and the plugin resolves links.
+  root = realpathSync(mkdtempSync(join(tmpdir(), 'release-instructions-')))
+  previousDir = process.env.OPENCODE_CONFIG_DIR
+})
+
+afterEach(() => {
+  if (previousDir === undefined) delete process.env.OPENCODE_CONFIG_DIR
+  else process.env.OPENCODE_CONFIG_DIR = previousDir
+  rmSync(root, { recursive: true, force: true })
+})
+
+describe('the release instructions plugin', () => {
+  test('a relative entry resolves inside the release root, as it would at the root of /workspace', async () => {
+    const release = join(root, 'config', ID)
+    mkdirSync(join(release, 'harnesses', 'opencode'), { recursive: true })
+    const out = await runHook(join(release, 'harnesses', 'opencode'), [
+      'rules/RULES.md',
+      'rules/*.md',
+      './AGENTS.md',
+      '/tmp/kortix/config-release.md',
+      '~/global.md',
+      'https://example.test/rules.md',
+      '**/CONTRIBUTING.md',
+    ])
+    expect(out).toEqual([
+      join(release, 'rules/RULES.md'),
+      join(release, 'rules/*.md'),
+      join(release, 'AGENTS.md'),
+      '/tmp/kortix/config-release.md',
+      '~/global.md',
+      'https://example.test/rules.md',
+      '**/CONTRIBUTING.md',
+    ])
+  })
+
+  test('off the release path (the working tree, the image default) nothing changes', async () => {
+    const workspace = join(root, 'workspace', 'harnesses', 'opencode')
+    mkdirSync(workspace, { recursive: true })
+    expect(await runHook(workspace, ['rules/RULES.md'])).toEqual(['rules/RULES.md'])
+    expect(await runHook(workspace, undefined)).toBeUndefined()
+  })
+})
+
+describe('the composed config', () => {
+  test('carries the plugin only while OpenCode serves a release', async () => {
+    const plugins = async (servesRelease: boolean) => {
+      const content = await buildOpencodeConfigContent({}, { servesRelease })
+      return (JSON.parse(content ?? '{}').plugin ?? []) as string[]
+    }
+    expect((await plugins(true)).some((p) => p.endsWith('/kortix-release-instructions.js'))).toBe(true)
+    expect((await plugins(false)).some((p) => p.endsWith('/kortix-release-instructions.js'))).toBe(false)
+  })
+})
```

**File**: `apps/kortix-sandbox-agent-server/src/harness/open-code/lifecycle.ts` (modified, +16/-0)
```diff
@@ -123,6 +123,7 @@ import {
 } from '@/services/sandbox-env/secret-capabilities'
 import { configReleaseNoticePath } from '@/services/config-release/notice'
 import { bootLinkPath, readBootLinkTarget, releaseRootOf } from '@/services/config-release/boot-config'
+import { writeReleaseInstructionsPlugin } from './release-instructions'
 import { opencodeTurnInFlight } from './opencode-turn-state'
 import { CONNECTORS_MCP_COMMAND } from '@kortix/api-contract/sandbox-layout'
 import { MINIMAL_FALLBACK_MODELS, BUNDLED_MANAGED_MODELS, type KortixGatewayModel } from '@kortix/api-contract/fallback-models'
@@ -395,6 +396,8 @@ export async function buildOpencodeConfigContent(
     secretCapabilitiesInstructionPath?: string | null
     /** The config-release notice, when one exists (config-release/notice.ts). */
     configReleaseNoticePath?: string | null
+    /** OpenCode serves a config release: load the release instructions plugin (release-instructions.ts). */
+    servesRelease?: boolean
   } = {},
 ): Promise<string | undefined> {
   const connectorToken = env.KORTIX_TOKEN
@@ -518,6 +521,13 @@ export async function buildOpencodeConfigContent(
     out.instructions = instructions.includes(instructionPath) ? instructions : [...instructions, instructionPath]
   }
 
+  // A release's relative `instructions` resolve at the release root, not
+  // against `/workspace` (release-instructions.ts).
+  if (opts.servesRelease) {
+    const plugins = Array.isArray(out.plugin) ? out.plugin.filter((item): item is string => typeof item === 'string') : []
+    if (!plugins.includes(RELEASE_INSTRUCTIONS_PLUGIN_SPEC)) out.plugin = [...plugins, RELEASE_INSTRUCTIONS_PLUGIN_SPEC]
+  }
+
   // (5) Injected managed skills and the project root's skills — append to
   // whatever `skills.paths` the base config already declares; never clobber.
   const extraSkillDirs = [injectedSkillsDir, projectSkillsDir].filter((dir): dir is string => dir !== null)
@@ -1022,6 +1032,8 @@ function scheduleCatalogWarmToPath(
  * would then fail every session boot instead of one shell command.
  */
 const KORTIX_OPENCODE_CONFIG_PATH = join(OPENCODE_HOME, '.config', 'kortix-opencode.json')
+const RELEASE_INSTRUCTIONS_PLUGIN_PATH = join(OPENCODE_HOME, '.config', 'kortix-release-instructions.js')
+const RELEASE_INSTRUCTIONS_PLUGIN_SPEC = `file://${RELEASE_INSTRUCTIONS_PLUGIN_PATH}`
 
 /**
  * Materialize the composed Kortix config (see buildOpencodeConfigContent) and
@@ -1041,13 +1053,16 @@ export async function writeKortixOpencodeConfig(
     projectSkillsDir?: string | null
     secretCapabilitiesInstructionPath?: string | null
     configReleaseNoticePath?: string | null
+    servesRelease?: boolean
   } = {},
 ): Promise<string | null> {
+  if (opts.servesRelease) writeReleaseInstructionsPlugin(RELEASE_INSTRUCTIONS_PLUGIN_PATH)
   const content = await buildOpencodeConfigContent(env, {
     injectedSkillsDir: opts.injectedSkillsDir,
     projectSkillsDir: opts.projectSkillsDir,
     secretCapabilitiesInstructionPath: opts.secretCapabilitiesInstructionPath,
     configReleaseNoticePath: opts.configReleaseNoticePath,
+    servesRelease: opts.servesRelease,
   })
   if (!content) return null
   const configPath = opts.configPath ?? KORTIX_OPENCODE_CONFIG_PATH
@@ -2107,6 +2122,7 @@ export function createOpencodeLifecycle(
       configPath: options.configPathOverride,
       injectedSkillsDir: join(bootLinkPath(), 'skills'),
       projectSkillsDir: servesProject ? join(projectRoot, SKILLS_DIR) : null,
+      servesRelease: !!served && releaseRootOf(served) !== null,
       secretCapabilitiesInstructionPath,
       configReleaseNoticePath: configReleaseNoticePath(),
     })
```

**File**: `apps/kortix-sandbox-agent-server/src/harness/open-code/release-instructions.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import { mkdirSync, writeFileSync } from 'node:fs'
+import { dirname } from 'node:path'
+
+/**
+ * The platform plugin that makes a project's relative `instructions` entries
+ * read the config release, not the session's checkout.
+ *
+ * OpenCode resolves a relative entry against the session directory
+ * (`/workspace`), never against its config dir (session/instruction.ts
+ * `globUp(instruction, ctx.directory, ctx.worktree)`, OpenCode 1.18.23). A
+ * release is a checkout of the base branch at `/opt/kortix/config/<release_id>`
+ * with the repository's own layout, so the same entry resolved at the release
+ * root names the base branch's file. Instruction arrays are unioned across
+ * config files, so only a plugin's `config` hook, which receives the live
+ * config, can replace the entry instead of adding a second one.
+ *
+ * The release root comes from the real path of `OPENCODE_CONFIG_DIR` (the boot
+ * link), read at hook time: off a release (the working tree, the image default)
+ * the hook changes nothing. URLs, `~/`, absolute paths and globs in a directory
+ * part keep OpenCode's own resolution.
+ */
+export const RELEASE_INSTRUCTIONS_PLUGIN_SOURCE = `// Written by kortixd (harness/open-code/release-instructions.ts). Do not edit.
+import { realpathSync } from 'node:fs'
+import { isAbsolute, resolve } from 'node:path'
+
+const RELEASE_ROOT = /^(.*\\/[0-9a-f]{64})(?:\\/|$)/
+
+export const KortixReleaseInstructions = async () => ({
+  config: async (config) => {
+    let served
+    try {
+      served = realpathSync(process.env.OPENCODE_CONFIG_DIR ?? '')
+    } catch {
+      return
+    }
+    const root = RELEASE_ROOT.exec(served)?.[1]
+    if (!root || !Array.isArray(config.instructions)) return
+    config.instructions = config.instructions.map((entry) => {
+      if (typeof entry !== 'string' || /^https?:\\/\\//.test(entry) || entry.startsWith('~/') || isAbsolute(entry)) return entry
+      const slash = entry.lastIndexOf('/')
+      if (slash !== -1 && /[*?[{]/.test(entry.slice(0, slash))) return entry
+      return resolve(root, entry)
+    })
+  },
+})
+`
+
+/** Write the plugin beside the composed config, and return its `file://` spec. */
+export function writeReleaseInstructionsPlugin(path: string): string {
+  mkdirSync(dirname(path), { recursive: true })
+  writeFileSync(path, RELEASE_INSTRUCTIONS_PLUGIN_SOURCE, { mode: 0o644 })
+  return `file://${path}`
+}
```

**File**: `apps/web/src/lib/seo/content-timestamps.json` (modified, +1/-1)
```diff
@@ -69,6 +69,6 @@
   "docs:work/change-requests": "2026-09-01T14:42:59.000Z",
   "docs:work/harnesses": "2026-10-05T15:35:59.000Z",
   "docs:work": "2026-10-02T11:51:41.000Z",
-  "docs:work/runtime": "2026-10-05T18:44:45.000Z",
+  "docs:work/runtime": "2026-10-05T21:37:57.000Z",
   "docs:work/sessions": "2026-10-02T11:51:41.000Z"
 }
```

**File**: `tests/attestations/config-release-instructions.json` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+{
+  "source_hash": "b41d6dff84fe165c3bb2b7207e6b996c9e3f5ac7b3ecaff493085431e9d409e9",
+  "diff_files": [
+    "apps/api/src/config-releases/ROLLOUT.md",
+    "apps/kortix-sandbox-agent-server/src/__tests__/release-instructions.test.ts",
+    "apps/kortix-sandbox-agent-server/src/harness/open-code/lifecycle.ts",
+    "apps/kortix-sandbox-agent-server/src/harness/open-code/release-instructions.ts",
+    "apps/web/src/lib/seo/content-timestamps.json"
+  ],
+  "diff_hash": "f3e1e986d02ee7287b81c1362f4051ae46d2de8f8f078cb0fd94b46d5a964f35",
+  "head": "42d1cde840ec28d6464e50edcae8cd24537b6c52",
+  "passed": true,
+  "lanes": {
+    "core": "pass",
+    "packages": "pass",
+    "db-suites": "pass"
+  },
+  "at": "2026-10-05T22:49:05.399Z"
+}
```

---

### Incident Patch 2: `83240248` (2026-10-05)
**Commit Message**: fix(snapshots): a failed Platinum template build names its cause (#9198)

## Summary

A failed Platinum template build reached users as a bare `Platinum
template <name> build failed` with `error_category: unknown`, so `kortix
sandboxes builds` and the dashboard gave no cause. Platinum already
stores the podman output in `build_logs` and ends it with `[build
failed] <reason>`; `waitForActive` dropped it.

- `waitForActive` reads `build_logs` from the polled by-id row (or one
detail read when the row has none), streams the last 40 lines to the
build-log tap, and throws `PlatinumTemplateBuildFailedError` whose
message names the failing lines and the trailer — bounded to 400 chars
per line and 1,200 total, because the message is stored on the build row
and shown in UIs.
- `isRetryablePlatinumBuildError` decides that error before its
substring heuristics, by type and by message prefix (for a re-wrapped
copy). Log text such as `timeout`, `no such file` or `network` can no
longer flip a deterministic build failure into a retry that burns up to
three ~9-minute attempts.

Found while debugging a prod project whose custom-Dockerfile template
failed 4× on Platinum with no detail: the cause wa

**File**: `apps/api/src/snapshots/providers/platinum-build-retry.test.ts` (modified, +14/-0)
```diff
@@ -20,6 +20,7 @@ const {
   isRetryablePlatinumBuildError,
   isPlatinumSizeCapBuildFailure,
   PlatinumSizeCapBuildError,
+  PlatinumTemplateBuildFailedError,
 } = await import('./platinum');
 
 describe('Platinum build-error retry classifier', () => {
@@ -51,6 +52,19 @@ describe('Platinum build-error retry classifier', () => {
     // An EXPLICIT build failure — Platinum registered the template, actually ran
     // the build, and it failed. Retrying would just fail identically.
     ['explicit build failure', new Error('Platinum template kortix-default-abc123 build failed')],
+    // The failure now carries its log lines, which can contain transient-looking
+    // words. They must never turn a real build failure into a retry.
+    [
+      'explicit build failure whose log mentions a timeout and a missing file',
+      new PlatinumTemplateBuildFailedError(
+        'kortix-default-abc123',
+        'curl: (28) Connection timed out | cp: /src/x: No such file or directory | network unreachable | [build failed] podman build: exit status 1',
+      ),
+    ],
+    [
+      'the same failure re-wrapped as a plain Error',
+      new Error('attempt 1/3: Platinum template kortix-default-abc123 build failed: curl: (28) Connection timed out | network gateway 502'),
+    ],
     // Reached a real (non-missing) state before giving up — a genuine stuck
     // build, not a registration no-show.
     [
```

**File**: `apps/api/src/snapshots/providers/platinum-templates.ts` (modified, +84/-1)
```diff
@@ -14,6 +14,81 @@ export interface PlatinumTemplate {
   state?: string;
   /** Echoed by /from-build since Platinum #1326; absent on an older API. */
   kernel_modules?: string;
+  /** Redacted podman output. Only on the by-id detail row (the list strips it);
+   *  a failed build ends it with `[build failed] <reason>`. */
+  build_logs?: string | null;
+  buildLogs?: string | null;
+}
+
+/**
+ * Platinum reported `state: failed` for a template build. Carries the failing
+ * lines of the build log so the error a user sees (`kortix sandboxes builds`,
+ * the dashboard) names the step that broke instead of a bare "build failed" —
+ * Platinum always had the cause in `build_logs`; we dropped it.
+ *
+ * A genuine build failure is deterministic, so this is NEVER retried (see
+ * isRetryablePlatinumBuildError). The type — and the message prefix, for a
+ * re-wrapped copy — is what keeps the appended log text (which may contain
+ * words like "timeout" or "no such file") from flipping that decision.
+ */
+export class PlatinumTemplateBuildFailedError extends Error {
+  readonly templateName: string;
+  readonly detail: string;
+  constructor(templateName: string, detail: string) {
+    super(`Platinum template ${templateName} build failed${detail ? `: ${detail}` : ''}`);
+    this.name = 'PlatinumTemplateBuildFailedError';
+    this.templateName = templateName;
+    this.detail = detail;
+  }
+}
+
+/** Matches a (possibly re-wrapped) PlatinumTemplateBuildFailedError message. */
+export const PLATINUM_BUILD_FAILED_RE = /platinum template \S+ build failed/i;
+
+const FAILURE_DETAIL_MAX = 1_200;
+const FAILURE_LINE_MAX = 400;
+const ERRORISH_LINE = /\b(error|errors|failed|fatal|denied|cannot|can't|not found|no such|unable|invalid|exit status|exit code|killed|panic)\b/i;
+
+/**
+ * The few lines of a Platinum build log that explain a failure: the
+ * error-looking lines just before Platinum's `[build failed] <reason>` trailer,
+ * plus the trailer itself. Bounded (each line and the whole) because the
+ * result becomes an error message stored on the build row and shown in UIs.
+ */
+export function summarizePlatinumBuildFailure(logs: string | null | undefined): string {
+  const text = (logs ?? '').replace(/\r/g, '');
+  if (!text.trim()) return '';
+  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
+  const clip = (l: string) => (l.length > FAILURE_LINE_MAX ? `${l.slice(0, FAILURE_LINE_MAX)}…` : l);
+  let trailer = -1;
+  for (let i = lines.length - 1; i >= 0; i--) {
+    if (lines[i]!.startsWith('[build failed]')) { trailer = i; break; }
+  }
+  const end = trailer >= 0 ? trailer : lines.length;
+  const window = lines.slice(Math.max(0, end - 25), end);
+  // The giant "Error: building at STEP …" echo repeats the whole RUN line; the
+  // trailer already names the step, so prefer the shorter, causal error lines.
+  let picked = window.filter((l) => ERRORISH_LINE.test(l) && !/^Error: building at STEP/.test(l)).slice(-4);
+  if (picked.length === 0) picked = window.slice(-3);
+  const parts = [...picked, ...(trailer >= 0 ? [lines[trailer]!] : [])].map(clip);
+  const joined = parts.join(' | ');
+  return joined.length > FAILURE_DETAIL_MAX ? `${joined.slice(0, FAILURE_DETAIL_MAX)}…` : joined;
+}
+
+/** Best-effort: the failing build's log tail, from the polled row or its detail. */
+async function failedBuildLogs(
+  tpl: PlatinumTemplate | null,
+  client: PlatinumClient,
+): Promise<string> {
+  const inline = tpl?.build_logs ?? tpl?.buildLogs;
+  if (inline) return inline;
+  if (!tpl?.id) return '';
+  try {
+    const detail = await findTemplateById(tpl.id, client);
+    return detail?.build_logs ?? detail?.buildLogs ?? '';
+  } catch {
+    return ''; // the failure itself is already certain; the detail is a courtesy
+  }
 }
 
 /**
@@ -298,7 +373,15 @@ export async function waitForActive(
     const state = (tpl?.state ?? 'missing').toLowerCase();
     if (state !== last) { last = state; tap?.onLine?.(`template ${name}: ${state}`); }
     if (state === 'ready') return;
-    if (state === 'failed') throw new Error(`Platinum template ${name} build failed`);
+    if (state === 'failed') {
+      const logs = await failedBuildLogs(tpl, client);
+      if (logs) {
+        for (const line of logs.replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(-40)) {
+          tap?.onLine?.(line);
+        }
+      }
+      throw new PlatinumTemplateBuildFailedError(name, summarizePlatinumBuildFailure(logs));
+    }
     // building / pending / missing(=not-visible-yet) → healthy waiting.
     await new Promise((r) => setTimeout(r, POLL_MS));
   }
```

**File**: `apps/api/src/snapshots/providers/platinum-wait-active.test.ts` (modified, +74/-1)
```diff
@@ -18,7 +18,7 @@ setTestEnv('INTERNAL_KORTIX_ENV', 'dev');
 setTestEnv('PLATINUM_API_URL', 'https://platinum.test');
 setTestEnv('PLATINUM_API_KEY', 'pt_live_testkey');
 
-const { waitForActive, requireExternalTemplateId } = await import('./platinum');
+const { waitForActive, requireExternalTemplateId, PlatinumTemplateBuildFailedError, summarizePlatinumBuildFailure } = await import('./platinum');
 
 const originalFetch = globalThis.fetch;
 afterEach(() => {
@@ -94,3 +94,76 @@ describe('waitForActive — PHASE 2 poll error classification', () => {
     await expect(waitForActive('kortix-default-abc', undefined, 'tpl_abc')).rejects.toThrow(/build failed/);
   }, 10_000);
 });
+
+// The shape of a real failure (a prod project, 2026-10-05): a project Dockerfile's
+// global ENV leaked into the appended Kortix layer, whose `uv python install`
+// then died at STEP 15/49. Platinum stored all of this in build_logs; Kortix
+// used to surface only "Platinum template … build failed".
+const REAL_FAILURE_LOGS = [
+  'STEP 15/49: RUN case "$(uname -m)" in x86_64) uv_arch=x86_64 ;; esac && uv python install --default 3.12.13',
+  '/tmp/uv.tar.gz: OK',
+  'warning: The `--default` option is experimental and may change without warning.',
+  'error: failed to create file `/opt/uv-python/cpython-3.12.13-linux-x86_64-gnu/lib/python3.12/EXTERNALLY-MANAGED`: Permission denied (os error 13)',
+  'Error: building at STEP "RUN case "$(uname -m)" in x86_64) uv_arch=x86_64 ;; esac && uv python install --default 3.12.13": while running runtime: exit status 2',
+  '',
+  '[build failed] podman build: exit status 2 — Error: building at STEP "RUN case …',
+].join('\n');
+
+describe('waitForActive — a failed build names its cause', () => {
+  test('the error carries the failing log lines, and the tap gets the log tail', async () => {
+    globalThis.fetch = (async () =>
+      jsonResponse({ id: 'tpl_abc', name: 'kortix-default-abc', state: 'failed', build_logs: REAL_FAILURE_LOGS })) as unknown as typeof fetch;
+    const lines: string[] = [];
+    const err = await waitForActive('kortix-default-abc', { onLine: (l: string) => lines.push(l) } as never, 'tpl_abc').catch((e) => e);
+    expect(err).toBeInstanceOf(PlatinumTemplateBuildFailedError);
+    expect(err.message).toStartWith('Platinum template kortix-default-abc build failed: ');
+    expect(err.message).toContain('Permission denied (os error 13)');
+    expect(err.message).toContain('[build failed] podman build: exit status 2');
+    // The standalone `Error: building at STEP …` echo is dropped; only the trailer's copy remains.
+    expect(err.message.split('Error: building at STEP').length - 1).toBe(1);
+    expect(lines).toContain('/tmp/uv.tar.gz: OK');
+  }, 10_000);
+
+  test('reads the detail row when the polled row has no logs', async () => {
+    let calls = 0;
+    globalThis.fetch = (async () => {
+      calls += 1;
+      return calls === 1
+        ? jsonResponse({ id: 'tpl_abc', name: 'kortix-default-abc', state: 'failed' })
+        : jsonResponse({ id: 'tpl_abc', name: 'kortix-default-abc', state: 'failed', buildLogs: REAL_FAILURE_LOGS });
+    }) as unknown as typeof fetch;
+    await expect(waitForActive('kortix-default-abc', undefined, 'tpl_abc')).rejects.toThrow(/Permission denied/);
+    expect(calls).toBe(2);
+  }, 10_000);
+
+  test('no logs anywhere still fails with the plain message', async () => {
+    globalThis.fetch = (async () =>
+      jsonResponse({ id: 'tpl_abc', name: 'kortix-default-abc', state: 'failed' })) as unknown as typeof fetch;
+    const err = await waitForActive('kortix-default-abc', undefined, 'tpl_abc').catch((e) => e);
+    expect(err).toBeInstanceOf(PlatinumTemplateBuildFailedError);
+    expect(err.message).toBe('Platinum template kortix-default-abc build failed');
+  }, 10_000);
+});
+
+describe('summarizePlatinumBuildFailure', () => {
+  test('keeps the causal error lines plus the [build failed] trailer, bounded', () => {
+    const s = summarizePlatinumBuildFailure(REAL_FAILURE_LOGS);
+    expect(s).toContain('error: failed to create file');
+    expect(s).toEndWith('[build failed] podman build: exit status 2 — Error: building at STEP "RUN case …');
+    expect(s.length).toBeLessThanOrEqual(1_201);
+  });
+
+  test('falls back to the last lines when nothing looks like an error', () => {
+    expect(summarizePlatinumBuildFailure('a\nb\nc\nd')).toBe('b | c | d');
+  });
+
+  test('empty logs give an empty summary', () => {
+    expect(summarizePlatinumBuildFailure('')).toBe('');
+    expect(summarizePlatinumBuildFailure(null)).toBe('');
+  });
+
+  test('a single enormous line is clipped', () => {
+    const s = summarizePlatinumBuildFailure(`error: ${'x'.repeat(5_000)}\n[build failed] boom`);
+    expect(s.length).toBeLessThan(1_000);
+  });
+});
```

**File**: `apps/api/src/snapshots/providers/platinum.ts` (modified, +8/-2)
```diff
@@ -24,10 +24,10 @@ import {
 import { SANDBOX_SPEC_LIMITS } from '../dockerfile-layer';
 import { tarBuildContext } from '../staging-tar';
 import { normalizeExistingProviderState } from './state';
-import { productionPlatinumClient, observeTemplates, findTemplateByName, findTemplateById, paginateTemplates, fetchAllTemplates, lookupTemplatesNamed, waitForActive, requireExternalTemplateId, isPlatinumAuthFailure } from './platinum-templates';
+import { productionPlatinumClient, observeTemplates, findTemplateByName, findTemplateById, paginateTemplates, fetchAllTemplates, lookupTemplatesNamed, waitForActive, requireExternalTemplateId, isPlatinumAuthFailure, PlatinumTemplateBuildFailedError, PLATINUM_BUILD_FAILED_RE } from './platinum-templates';
 import type { PlatinumClient, PlatinumTemplate } from './platinum-templates';
 import { uploadWithRetry, templateInUseCount } from './platinum-upload';
-export { PlatinumTemplateListingError, findTemplateByName, waitForActive, requireExternalTemplateId } from './platinum-templates';
+export { PlatinumTemplateListingError, PlatinumTemplateBuildFailedError, summarizePlatinumBuildFailure, findTemplateByName, waitForActive, requireExternalTemplateId } from './platinum-templates';
 export type { PlatinumClient } from './platinum-templates';
 export { uploadUrlGuardOptsFromEnv, uploadWithRetry, UploadUrlRejectedError } from './platinum-upload';
 import type {
@@ -159,7 +159,13 @@ export function isRetryablePlatinumBuildError(err: unknown): boolean {
   // non-retryable even if a raw ENOSPC/too_big message happens to also contain
   // one of the transient substrings matched below (e.g. "network").
   if (isPlatinumSizeCapBuildFailure(err)) return false;
+  // An explicit `state: failed` is a genuine build error. It now carries the
+  // build log's failing lines, which can contain any of the transient
+  // substrings below ("no such file", "timeout", "network") — so it must be
+  // decided before them, by type or (re-wrapped) by its message prefix.
+  if (err instanceof PlatinumTemplateBuildFailedError) return false;
   const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
+  if (PLATINUM_BUILD_FAILED_RE.test(m)) return false;
   // Platinum answers 429 for TWO opposite conditions, and only one is transient:
   //   - `rate_limited` (server.ts) — the per-org mutation-rate bucket
   //     (PT_ORG_MUT_RATE, 20 req/s). Transient; retrying is right.
```

**File**: `tests/attestations/config-release-checkout.json` (removed, +0/-48)
```diff
@@ -1,48 +0,0 @@
-{
-  "source_hash": "7b9965dd9ea96ef06481e2af9a208c0c4a29d104ae913f88d5a46d5722bd62a8",
-  "diff_files": [
-    "apps/api/src/config-releases/ROLLOUT.md",
-    "apps/api/src/config-releases/__tests__/desired-agent.test.ts",
-    "apps/api/src/config-releases/__tests__/desired-freshness.test.ts",
-    "apps/api/src/config-releases/agent-plugins.test.ts",
-    "apps/api/src/config-releases/builder.test.ts",
-    "apps/api/src/config-releases/builder.ts",
-    "apps/api/src/config-releases/quarantine.test.ts",
-    "apps/api/src/config-releases/release-tree.ts",
-    "apps/api/src/config-releases/routes.ts",
-    "apps/api/src/config-releases/serve-archive.test.ts",
-    "apps/api/src/config-releases/serve-archive.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/boot-config.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/config-release-boot.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/config-release-converge.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/config-release-deps-prep.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/config-release-overlay-race.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/config-release-routes.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/helpers/config-release-fixtures.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-config-release.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-harness.test.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/README.md",
-    "apps/kortix-sandbox-agent-server/src/harness/open-code/assets.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/open-code/boot-config-path.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/open-code/config-release.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/open-code/lifecycle.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/open-code/project-layout.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/config-release.ts",
-    "apps/kortix-sandbox-agent-server/src/services/config-release/boot-config.ts",
-    "apps/kortix-sandbox-agent-server/src/services/config-release/descriptor.ts",
-    "apps/kortix-sandbox-agent-server/src/services/config-release/release.ts",
-    "apps/web/content/docs/work/runtime.mdx",
-    "apps/web/src/lib/seo/content-timestamps.json",
-    "tests/spec/end-to-end.md",
-    "tests/src/flows/config-releases.flow.ts"
-  ],
-  "diff_hash": "ebae296069628ae1d9b7c4a53203e1a6417104349b65f1a99ea5e45eddfe73c0",
-  "head": "17c3821ef9977d7b37a0e8ea82c167d97ce603be",
-  "passed": true,
-  "lanes": {
-    "core": "pass",
-    "packages": "pass",
-    "db-suites": "pass"
-  },
-  "at": "2026-10-05T21:36:30.930Z"
-}
```

**File**: `tests/attestations/fix-platinum-build-failure-detail.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "source_hash": "783c082ffe85088ef92d128099436db35f27a5758c268524cd331dc3519c745c",
+  "diff_files": [
+    "apps/api/src/snapshots/providers/platinum-build-retry.test.ts",
+    "apps/api/src/snapshots/providers/platinum-templates.ts",
+    "apps/api/src/snapshots/providers/platinum-wait-active.test.ts",
+    "apps/api/src/snapshots/providers/platinum.ts"
+  ],
+  "diff_hash": "af44a3f6a9738a6cfbbd51648b2e25149b89b4e50baea28f46faa8b2d35bf17b",
+  "head": "eacd526c325c7cebbff27652c7dffa062368fce1",
+  "passed": true,
+  "lanes": {
+    "core": "pass",
+    "packages": "pass",
+    "db-suites": "skipped-no-db"
+  },
+  "at": "2026-10-05T22:22:29.342Z"
+}
```

---

### Incident Patch 3: `c84cb3f0` (2026-10-05)
**Commit Message**: fix(desktop): show the DMG background on macOS 26 (#9194)

## Summary

The drag-to-install DMG window from #9190 shows the default empty window
on macOS 26. There are two reasons:

- dmg-builder 25.1.8 (the vendored dmgbuild) writes a `pBBk` bookmark
into the volume `.DS_Store` with a volume-relative path
(`/.background/1.tiff`). Finder on macOS 26 uses that bookmark first,
fails to resolve it (error 4), and skips the valid
`icvp.backgroundImageAlias`.
- The v0.13.50 installers were built before #9190 merged.

Fix: `patches/[REDACTED_EMAIL]` removes the bookmark write
(`Bookmark.for_file(background_file)` in `vendor/dmgbuild/core.py`), so
Finder resolves the alias. The patch is registered in
`pnpm.patchedDependencies`. CI's `pnpm install --frozen-lockfile` in
`desktop.yml` and `deploy-prod.yml` applies it. Upstream:
electron-builder#9072, dmgbuild#275.

I chose the patch over upgrading to electron-builder 26.15.3. Both fix
the background, but the upgrade changes signing, the universal merge,
and how app dependencies are collected.

## Test plan

- [x] Unsigned universal DMGs built locally with `electron-builder --mac
dmg --universal --prepackaged dist/mac-universal/Kortix.app --pub

**File**: `package.json` (modified, +2/-1)
```diff
@@ -124,7 +124,8 @@
     "patchedDependencies": {
       "e2b@2.37.0": "patches/e2b@2.37.0.patch",
       "blume@1.5.3": "patches/blume@1.5.3.patch",
-      "shaders@2.5.135": "patches/shaders@2.5.135.patch"
+      "shaders@2.5.135": "patches/shaders@2.5.135.patch",
+      "dmg-builder@25.1.8": "patches/dmg-builder@25.1.8.patch"
     }
   },
   "version": "1.0.0",
```

**File**: `patches/dmg-builder@25.1.8.patch` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+diff --git a/vendor/dmgbuild/core.py b/vendor/dmgbuild/core.py
+index 1adc35289fc604f3dd5545d3d86fbacb6baeaf69..e224b7144f07ad481d6cd525fb53fd4a3956a8bf 100644
+--- a/vendor/dmgbuild/core.py
++++ b/vendor/dmgbuild/core.py
+@@ -255,7 +255,8 @@ def build_dmg():
+       icvp['backgroundColorBlue'] = float(c.b)
+     elif background_file:
+       alias = Alias.for_file(background_file)
+-      background_bmk = Bookmark.for_file(background_file)
++      # No pBBk bookmark: macOS 26 Finder ignores the background when it is
++      # present (electron-builder#9072, fixed upstream in dmgbuild#275).
+ 
+       icvp['backgroundType'] = 2
+       icvp['backgroundImageAlias'] = biplist.Data(alias.to_bytes())
```

**File**: `pnpm-lock.yaml` (modified, +7/-3)
```diff
@@ -64,6 +64,9 @@ patchedDependencies:
   blume@1.5.3:
     hash: e2lihfsjc4kvtdhxezjuaintza
     path: patches/blume@1.5.3.patch
+  dmg-builder@25.1.8:
+    hash: x5orqgpci6mca5rbjguv3lxtri
+    path: patches/dmg-builder@25.1.8.patch
   e2b@2.37.0:
     hash: yvfhnsbredtxqzv5fhmwxaetam
     path: patches/e2b@2.37.0.patch
@@ -16012,7 +16015,7 @@ packages:
       chromium-pickle-js: 0.2.0
       config-file-ts: 0.2.8-rc1
       debug: 4.4.3
-      dmg-builder: 25.1.8(electron-builder-squirrel-windows@25.1.8)
+      dmg-builder: 25.1.8(patch_hash=x5orqgpci6mca5rbjguv3lxtri)(electron-builder-squirrel-windows@25.1.8)
       dotenv: 16.6.1
       dotenv-expand: 11.0.7
       ejs: 3.1.10
@@ -18495,7 +18498,7 @@ packages:
     resolution: {integrity: sha512-+HlytyjlPKnIG8XuRG8WvmBP8xs8P71y+SKKS6ZXWoEgLuePxtDoUEiH7WkdePWrQ5JBpE6aoVqfZfJUQkjXwA==}
     dev: false
 
-  /dmg-builder@25.1.8(electron-builder-squirrel-windows@25.1.8):
+  /dmg-builder@25.1.8(patch_hash=x5orqgpci6mca5rbjguv3lxtri)(electron-builder-squirrel-windows@25.1.8):
     resolution: {integrity: sha512-NoXo6Liy2heSklTI5OIZbCgXC1RzrDQsZkeEwXhdOro3FT1VBOvbubvscdPnjVuQ4AMwwv61oaH96AbiYg9EnQ==}
     dependencies:
       app-builder-lib: 25.1.8(dmg-builder@25.1.8)(electron-builder-squirrel-windows@25.1.8)
@@ -18511,6 +18514,7 @@ packages:
       - electron-builder-squirrel-windows
       - supports-color
     dev: true
+    patched: true
 
   /dmg-license@1.0.11:
     resolution: {integrity: sha512-ZdzmqwKmECOWJpqefloC5OJy1+WZBBse5+MR88z9g9Zn4VY+WYUkAyojmhzJckH5YbbZGcYIuGAkY5/Ys5OM2Q==}
@@ -18869,7 +18873,7 @@ packages:
       builder-util: 25.1.7
       builder-util-runtime: 9.2.10
       chalk: 4.1.2
-      dmg-builder: 25.1.8(electron-builder-squirrel-windows@25.1.8)
+      dmg-builder: 25.1.8(patch_hash=x5orqgpci6mca5rbjguv3lxtri)(electron-builder-squirrel-windows@25.1.8)
       fs-extra: 10.1.0
       is-ci: 3.0.1
       lazy-val: 1.0.5
```

---

### Incident Patch 4: `709cda2c` (2026-10-05)
**Commit Message**: feat(web): calm preview states: load line page, dot-matrix while building, debug harness (#9188)

## Summary

KRTX-1644. The preview "not responding" state was loud and unfinished.
This reworks every port-preview state.

**Proxy state page** (`previewStatePage`, now in
`@kortix/shared/preview-state-page`, re-exported by
`apps/api/src/sandbox-proxy/preview-state-page.ts`)
- One left-aligned title and one muted line per state. `starting` and
`not-listening` draw a 2px load line on the top edge. `unreachable`
shows a text-weight "Try again".
- Removed: the 1 s countdown (`setInterval`), the "Retry now" button,
the yellow dot, the raw sandbox URL.
- Auto-retry is unchanged: reload every 3 s, up to 40 times. After 40
the load line stops and "Try again" appears.
- The page posts `{ type: 'kortix:preview-state', state }` to the
embedding card, and `stalled: true` when it gives up.

**Show card**
- While the app builds (frame not loaded, `starting`, `not-listening`),
the header icon and every port tab show a `SessionDotMatrix` seeded by
the preview title or URL. `unreachable`, identity states, a stalled page
and a loaded app keep the desktop icon. The message is accepted only
from the card

**File**: `apps/api/src/__tests__/unit-worker-scope-wiring.test.ts` (modified, +0/-1)
```diff
@@ -66,7 +66,6 @@ const NOT_WORKERS: Record<string, string> = {
     'renews the lock of one claimed command while its drain lane or inline create runs',
   'projects/session-lifecycle/worker.ts': 'timer that calls drainSessionLifecycleQueue, which wraps itself',
   'router/config/model-pricing.ts': 'refreshes the in-memory model pricing',
-  'sandbox-proxy/preview-state-page.ts': 'browser JavaScript inside an HTML string',
   'sandbox-proxy/ws-proxy.ts': 'keepalive ping on one open preview WebSocket',
   'shared/access-control-cache.ts': 'refreshes the in-memory access-control cache',
   'snapshots/tmp-reaper.ts': 'deletes stale local tmp directories; no database writes',
```

**File**: `apps/api/src/sandbox-proxy/preview-state-page.test.ts` (modified, +51/-5)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, test } from 'bun:test';
-import { previewStatePage, type PreviewState } from './preview-state-page';
+import { PREVIEW_BUILDING_STATES, previewStatePage, type PreviewState } from './preview-state-page';
 
 // Literal copy, not the helper's own answer: a changed title or a state that
 // starts offering sign-in is a product change this table must be edited for.
@@ -8,8 +8,8 @@ const STATES: Array<[PreviewState, string, boolean, boolean]> = [
   ['forbidden', 'This preview address is not signed', true, false],
   ['unknown', 'This preview is no longer available', false, false],
   ['starting', 'Starting the sandbox', false, true],
-  ['not-listening', 'Nothing is listening on port 8081 yet', false, true],
-  ['unreachable', 'Port 8081 isn&#39;t responding', false, true],
+  ['not-listening', 'Waiting for port 8081', false, true],
+  ['unreachable', 'Port 8081 is not answering', false, true],
 ];
 
 const BASE = {
@@ -39,7 +39,44 @@ describe('every preview state renders a page a person can read', () => {
     expect(previewStatePage({ ...BASE, state: 'not-listening', port: 8081 })).toContain('port 8081');
     const noPort = previewStatePage({ ...BASE, state: 'not-listening' });
     expect(noPort).not.toContain('undefined');
-    expect(noPort).toContain('Nothing is listening yet');
+    expect(noPort).toContain('Waiting for the app');
+  });
+
+  // KRTX-1644: the waiting states are one title, one line and a load line.
+  // No countdown that re-renders every second, no in-body Retry that repeats
+  // the card header's refresh, and no raw sandbox address.
+  test.each(['starting', 'not-listening'] as const)('%s shows the load line and nothing noisy', (state) => {
+    const html = previewStatePage({ ...BASE, state, port: 8081 });
+    expect(html).toContain('class="load"');
+    expect(html).not.toContain('Retry now');
+    expect(html).not.toContain('Checking again');
+    expect(html).not.toContain('setInterval');
+    expect(html).not.toContain(BASE.returnTo);
+  });
+
+  // The card that embeds the page swaps its icon for the dot matrix while the
+  // app starts; it learns the state from this message, not from `load`.
+  test.each(['starting', 'not-listening', 'unreachable', 'unknown'] as const)(
+    '%s tells the embedding card its state',
+    (state) => {
+      const html = previewStatePage({ ...BASE, state, port: 8081 });
+      expect(html).toContain(`postMessage({ type: 'kortix:preview-state', state: "${state}" }, '*')`);
+    },
+  );
+
+  test('unreachable drops the load line and offers a quiet Try again', () => {
+    const html = previewStatePage({ ...BASE, state: 'unreachable', port: 8081 });
+    expect(html).not.toContain('class="load"');
+    expect(html).toContain('>Try again</button>');
+    expect(html).toContain('location.reload()');
+  });
+
+  test('a page that gave up stops the load line and offers Try again', () => {
+    const html = previewStatePage({ ...BASE, state: 'starting', port: 8081 });
+    expect(html).toContain('n >= MAX');
+    expect(html).toContain("load.hidden = true");
+    expect(html).toContain('stalled: true');
+    expect(html).toContain('>Try again</button>');
   });
 
   test('the sign-in hand-off carries where the person was going', () => {
@@ -60,12 +97,21 @@ describe('every preview state renders a page a person can read', () => {
       returnTo: 'https://x.test/"><script>alert(1)</script>',
     });
     expect(html).not.toContain('<script>alert(1)</script>');
-    expect(html).toContain('&lt;script&gt;');
+    // The address is never printed: it is an internal sandbox host.
+    expect(html).not.toContain('x.test');
+    const signIn = previewStatePage({ ...BASE, state: 'signed-out', returnTo: 'https://x.test/"><script>alert(1)</script>' });
+    expect(signIn).not.toContain('<script>alert(1)</script>');
   });
 
   test('it is self-contained — no external asset can fail to load', () => {
     const html = previewStatePage({ ...BASE, state: 'starting' });
     expect(html).not.toMatch(/<link[^>]+href="http/);
     expect(html).not.toMatch(/<script[^>]+src=/);
   });
+
+  // The card's busy glyph means "still building". A page that says the app
+  // stopped answering, or an identity page, must not get it.
+  test('only starting and not-listening count as building', () => {
+    expect([...PREVIEW_BUILDING_STATES].sort()).toEqual(['not-listening', 'starting']);
+  });
 });
```

**File**: `apps/api/src/sandbox-proxy/preview-state-page.ts` (modified, +3/-249)
```diff
@@ -1,251 +1,5 @@
 /**
- * What a PERSON sees for every state a preview can be in.
- *
- * A preview address is a real website address: people paste it, bookmark it,
- * open it in a fresh tab, and send it to each other. Every state it can be in
- * therefore needs a page — not JSON, and not an intermediary's error
- * interstitial. There are six, and they are all normal:
- *
- *   signed-out    no credential yet            → offer to sign in
- *   forbidden     host claimed without a signature
- *   unknown       no such sandbox any more
- *   starting      the box is waking             → wait, retry
- *   not-listening nothing bound to that port yet → wait, retry
- *   unreachable   the box is up but not answering
- *
- * ## Why the transient states answer 200
- *
- * "The dev server has not bound the port yet" is not a gateway failure — it is
- * the ordinary first few seconds of a preview. Reporting it as 502 was both
- * wrong and fragile: Cloudflare replaces an origin 5xx with its own branded
- * error page, so the careful page below never reached the browser at all (the
- * `x-kortix-proxy-hop` header was missing from what arrived, which is how we
- * know it was swapped, not passed through).
- *
- * So a browser navigation in a transient state gets 200 and this page, which
- * says what is happening and retries itself. The true state stays fully legible
- * to machines: the status, `x-kortix-proxy-hop` and `x-kortix-upstream-status`
- * are unchanged for every non-navigation request, and are still set on the HTML
- * response too, so a `fetch` probe can read them.
- *
- * The identity states keep their real status — 401, 403 and 404 are passed
- * through by every intermediary, and a crawler or monitor should see them.
+ * The preview state page lives in `@kortix/shared` so the web app's
+ * `/debug/preview-states` harness renders the exact HTML the proxy serves.
  */
-
-import { escapeHtml } from '../shared/html';
-
-/**
- * Names the state on every response, HTML included, so a probe or a log can
- * attribute what happened without parsing a page.
- */
-export const PREVIEW_STATE_HEADER = 'x-kortix-preview-state';
-
-/** Linear strip; the regex form backtracks on adversarial input. */
-function stripTrailingSlashes(value: string): string {
-  let end = value.length;
-  while (end > 0 && value.charCodeAt(end - 1) === 47 /* '/' */) end--;
-  return value.slice(0, end);
-}
-
-export type PreviewState =
-  | 'signed-out'
-  | 'forbidden'
-  | 'unknown'
-  | 'starting'
-  | 'not-listening'
-  | 'unreachable';
-
-export interface PreviewStateCopy {
-  title: string;
-  body: string;
-  /** Offer the Kortix sign-in hand-off. */
-  signIn: boolean;
-  /** Reload on a timer — only for states that resolve on their own. */
-  autoRetry: boolean;
-}
-
-export function previewStateCopy(state: PreviewState, port?: number): PreviewStateCopy {
-  switch (state) {
-    case 'signed-out':
-      return {
-        title: 'Sign in to open this preview',
-        body: 'This is a private preview of a Kortix sandbox. Sign in with the account that owns it and you will come straight back here.',
-        signIn: true,
-        autoRetry: false,
-      };
-    case 'forbidden':
-      return {
-        title: 'This preview address is not signed',
-        body: 'The request reached Kortix without the edge signature that binds it to this hostname. Open the preview from your Kortix session.',
-        signIn: true,
-        autoRetry: false,
-      };
-    case 'unknown':
-      return {
-        title: 'This preview is no longer available',
-        body: 'The sandbox behind this address does not exist any more. Sessions release their sandboxes when they are deleted.',
-        signIn: false,
-        autoRetry: false,
-      };
-    case 'starting':
-      return {
-        title: 'Starting the sandbox',
-        body: 'The machine behind this preview is waking up. This page will load it as soon as it answers.',
-        signIn: false,
-        autoRetry: true,
-      };
-    case 'not-listening':
-      return {
-        title: port ? `Nothing is listening on port ${port} yet` : 'Nothing is listening yet',
-        body: 'The sandbox is running, but no process has bound this port. Start the app in your session — this page will pick it up on its own.',
-        signIn: false,
-        autoRetry: true,
-      };
-    case 'unreachable':
-      return {
-        title: port ? `Port ${port} isn't responding` : 'This preview is not responding',
-        body: 'The sandbox is up but the app did not answer. It may still be compiling, or it may have exited.',
-        signIn: false,
-        autoRetry: true,
-      };
-  }
-}
-
-/**
- * The page. Self-contained (inline CSS and JS, no network), theme-aware, and
- * styled from the web app's tokens so it belongs beside the product rather than
- * looking like an error from somewhere else.
- */
-export function previewStatePage(input: {
-  state: PreviewState;
-  port?: number;
-  
```

**File**: `apps/api/src/sandbox-proxy/routes/preview.test.ts` (modified, +4/-4)
```diff
@@ -403,9 +403,9 @@ describe('isConnectionRefusedError', () => {
   });
 });
 
-// The unreachable-port page reconstructs the address the browser is on from the
-// preview host headers (the sign-in hand-off carries it), falling back to ''.
-test('the unreachable-port page carries the reconstructed browser address', async () => {
+// The unreachable-port page never prints the sandbox address: it is an
+// internal host, and the card header already names the preview (KRTX-1644).
+test('the unreachable-port page does not print the browser address', async () => {
   const res = portUnreachableResponse({
     port: 3000,
     status: 502,
@@ -414,7 +414,7 @@ test('the unreachable-port page carries the reconstructed browser address', asyn
     reason: 'x',
     hop: 'upstream_port',
   });
-  expect(await res.text()).toContain('https://p.example');
+  expect(await res.text()).not.toContain('p.example');
 });
 
 test('without host headers the page simply omits the address', async () => {
```

**File**: `apps/web/src/app/[locale]/(system)/debug/preview-states/page.tsx` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+'use client';
+
+import { SessionDotMatrix } from '@/components/ui/dot-matrix/session-dot-matrix';
+import type { ShowCarouselItem } from '@/features/file-renderers/show-content-renderer';
+import {
+  ServicePreviewViewport,
+  type ServicePreviewState,
+} from '@/features/session/tool/shared/infrastructure-preview';
+import { ShowCarouselTabs, showFileTypeIcon } from '@/features/session/tool/shared/show-helpers';
+import { ShowUnavailableNote } from '@/features/session/tool/tools/show-tool';
+import {
+  PREVIEW_BUILDING_STATES,
+  previewStatePage,
+  type PreviewState,
+} from '@kortix/shared/preview-state-page';
+import type { ReactNode } from 'react';
+
+/**
+ * /debug/preview-states
+ *
+ * Every state a `show` card for a running port can be in, side by side:
+ * the card header (desktop icon or the dot-matrix busy glyph) above the real
+ * proxy state page (`previewStatePage`, the exact HTML the API serves).
+ *
+ * The dot matrix shows only while the app is still building: the sandbox is
+ * waking (`starting`) or nothing has bound the port yet (`not-listening`),
+ * plus the moment before the frame has loaded anything. `unreachable` and
+ * every identity state keep the desktop icon.
+ *
+ * The frames are sandboxed without same-origin, so the page's auto-retry
+ * cannot reach sessionStorage and holds still instead of reloading.
+ *
+ * Not linked from anywhere — just hit /debug/preview-states.
+ */
+
+const PORT = 3000;
+const URL = `http://localhost:${PORT}`;
+const RETURN_TO = `https://p${PORT}-sbx-demo.localhost:8008/`;
+
+function statePageHtml(state: PreviewState, gaveUp = false): string {
+  const html = previewStatePage({
+    state,
+    port: PORT,
+    returnTo: RETURN_TO,
+    frontendUrl: typeof window === 'undefined' ? '' : window.location.origin,
+  });
+  // The give-up branch runs after 40 reloads. Start the counter there.
+  return gaveUp
+    ? html.replace("var n = parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0;", 'var n = 40;')
+    : html;
+}
+
+function DotMatrix({ seed }: { seed: string }) {
+  return <SessionDotMatrix sessionId={seed} size={14} className="shrink-0" />;
+}
+
+function DesktopIcon() {
+  return showFileTypeIcon('url', undefined, undefined, URL);
+}
+
+/** The inline `show` card chrome, as `ShowTool` draws it. */
+function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
+  return (
+    <div className="bg-secondary flex w-full flex-col overflow-hidden rounded-lg border-[0.5px]">
+      <div className="flex items-center gap-2 px-2 py-1.5">
+        <div className="text-foreground flex min-w-0 items-center gap-2 px-1 text-xs [&>svg]:size-4">
+          {icon}
+          <span className="min-w-0 truncate">{title}</span>
+        </div>
+      </div>
+      <div className="min-h-0 overflow-hidden">{children}</div>
+    </div>
+  );
+}
+
+function Frame({ html }: { html: string }) {
+  return (
+    <iframe
+      srcDoc={html}
+      sandbox="allow-scripts"
+      title="Preview state page"
+      className="bg-background block aspect-video w-full border-0"
+    />
+  );
+}
+
+function Case({
+  name,
+  note,
+  busy,
+  children,
+}: {
+  name: string;
+  note: string;
+  busy: boolean;
+  children: ReactNode;
+}) {
+  return (
+    <section className="space-y-2">
+      <div className="flex items-baseline justify-between gap-3">
+        <h2 className="text-foreground font-mono text-xs">{name}</h2>
+        <span className="text-muted-foreground text-xs">
+          {busy ? 'Dot matrix' : 'Desktop icon'}
+        </span>
+      </div>
+      <p className="text-muted-foreground text-xs">{note}</p>
+      {children}
+    </section>
+  );
+}
+
+const PROXY_CASES: Array<{ state: PreviewState; gaveUp?: boolean; note: string }> = [
+  { state: 'starting', note: 'The sandbox is waking. Load line, auto-retry every 3 s.' },
+  { state: 'not-listening', note: 'The sandbox is up; nothing has bound the port yet.' },
+  {
+    state: 'unreachable',
+    note: 'Something answered before and stopped. Not building: no busy glyph, Try again.',
+  },
+  {
+    state: 'starting',
+    gaveUp: true,
+    note: 'After 40 reloads (~2 min) the load line stops and Try again appears.',
+  },
+  { state: 'signed-out', note: 'No credential yet. Offers sign-in.' },
+  { state: 'forbidden', note: 'Host claimed without the edge signature.' },
+  { state: 'unknown', note: 'The sandbox behind the address no longer exists.' },
+];
+
+const LOADING_PREVIEW = {
+  previewUrl: '',
+  frameContent: 'app',
+  displayLabel: `HTML running on port ${PORT}`,
+  isLoading: true,
+  hasError: false,
+  refreshKey: 0,
+  onLoad: () => {},
+  onError: () => {},
+  frameRef: { current: null },
+} as unknown as ServicePreviewState;
+
+const PORT_TABS: ShowCarouselItem[] = [3000, 3001, 3002].map((port) => ({
+  type: 'url',
+  url: `http://localhost:${port}`,
+}));
+
+export default function DebugPreviewStatesPage() {
+  return (
+    <div
```

**File**: `apps/web/src/features/session/action-panel/easy/file-viewer.test.tsx` (modified, +12/-0)
```diff
@@ -171,6 +171,18 @@ describe('FileViewer toolbar', () => {
     expect(html).toContain('aria-label="Source"');
   });
 
+  test('the Preview/Source switch takes the type glyph slot inside the pill', () => {
+    // One radiogroup, two radios, placed before the file name, and selected
+    // on Preview by default.
+    const html = render('page.html', '<p>hi</p>');
+    expect(count(html, 'role="radiogroup"')).toBe(1);
+    expect(count(html, 'role="radio"')).toBe(2);
+    expect(html.indexOf('role="radiogroup"')).toBeLessThan(html.indexOf('>page.html<'));
+    expect(html).toMatch(/aria-checked="true" aria-label="Preview"/);
+    // No separate segmented Tabs control before the pill any more.
+    expect(html).not.toContain('role="tablist"');
+  });
+
   test('a file with only one form gets no toggle — it would have one position', () => {
     // Markdown is the other no-toggle kind, but `UnifiedMarkdown` can't be rendered
     // by this effect-free harness, so plain source stands in for both.
```

**File**: `apps/web/src/features/session/action-panel/easy/file-viewer.tsx` (modified, +60/-29)
```diff
@@ -24,7 +24,6 @@ import { useTranslations } from '@/i18n/use-translations';
 
 import { HighlightedCode } from '@/components/markdown/code';
 import { MarkdownWithFrontmatter } from '@/components/markdown/markdown-frontmatter';
-import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ImageRenderer } from '@/features/file-renderers/image-renderer';
 import { MermaidDiagram } from '@/features/file-renderers/mermaid/mermaid-diagram';
 import { isMermaidFile } from '@/features/file-renderers/mermaid/mermaid-utils';
@@ -34,7 +33,7 @@ import { getFileIcon } from '@/features/project-files';
 import { useIsMobile } from '@/hooks/utils';
 import { cn } from '@/lib/utils';
 import { CodeSimpleIcon as Code2, EyeIcon as Eye } from '@phosphor-icons/react';
-import { useEffect, useState } from 'react';
+import { type ReactNode, useEffect, useState } from 'react';
 import { CloseButton, DetailSidebarToggle } from './detail-view';
 import {
   PanelWidthButton,
@@ -128,37 +127,36 @@ export function FileViewer({
     <div className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
       <div className="flex shrink-0 items-center gap-1 border-b px-2.5 py-2">
         <DetailSidebarToggle className="size-7" />
-        {renders && (
-          // Only a file with both a rendered form and a source earns the
-          // toggle — and it sits before the pill, because it changes what the
-          // pill's name is showing you.
-          <Tabs value={view} onValueChange={(next) => setView(next as View)}>
-            <TabsList size="sm" className="h-7">
-              <TabsTrigger
-                size="xs"
-                value="preview"
-                aria-label={tI18nComplete.raw('text324b134f57c7')}
-                className="w-6 px-0"
-              >
-                <Eye className="size-3.5" />
-              </TabsTrigger>
-              <TabsTrigger
-                size="xs"
-                value="source"
-                aria-label={tI18nComplete.raw('text0e570ca6fabe')}
-                className="w-6 px-0"
-              >
-                <Code2 className="size-3.5" />
-              </TabsTrigger>
-            </TabsList>
-          </Tabs>
-        )}
-
         {/* Same actions in the same place for every file — they never move.
             Text is the one kind whose content a clipboard can hold, so `Copy`
             here copies the file itself. */}
+        {/* A file with both a rendered form and a source shows the Preview /
+            Code switch in the pill's icon slot: it changes what the pill's
+            name is showing you, and the type glyph says nothing the name
+            does not. Every other file keeps its type glyph there. */}
         <ViewerPathPill
-          icon={getFileIcon(fileName, { className: 'size-4', variant: 'monochrome' })}
+          icon={
+            renders ? (
+              <span role="radiogroup" className="flex items-center gap-px">
+                <ViewSwitchButton
+                  active={view === 'preview'}
+                  label={tI18nComplete.raw('text324b134f57c7')}
+                  onSelect={() => setView('preview')}
+                >
+                  <Eye className="size-3.5" />
+                </ViewSwitchButton>
+                <ViewSwitchButton
+                  active={view === 'source'}
+                  label={tI18nComplete.raw('text0e570ca6fabe')}
+                  onSelect={() => setView('source')}
+                >
+                  <Code2 className="size-3.5" />
+                </ViewSwitchButton>
+              </span>
+            ) : (
+              getFileIcon(fileName, { className: 'size-4', variant: 'monochrome' })
+            )
+          }
           path={path}
           fileName={fileName}
         >
@@ -348,3 +346,36 @@ function FileBody({
     </div>
   );
 }
+
+/** One option of the Preview / Code switch: a 24px square that matches the
+ *  pill's row, filled with the page background when selected. */
+function ViewSwitchButton({
+  active,
+  label,
+  onSelect,
+  children,
+}: {
+  active: boolean;
+  label: string;
+  onSelect: () => void;
+  children: ReactNode;
+}) {
+  return (
+    <button
+      type="button"
+      role="radio"
+      aria-checked={active}
+      aria-label={label}
+      onClick={onSelect}
+      className={cn(
+        'flex size-6 items-center justify-center rounded-sm transition-colors',
+        'focus-visible:ring-ring outline-none focus-visible:ring-2',
+        active
+          ? 'bg-background text-foreground shadow-xs'
+          : 'text-muted-foreground hover:text-foreground',
+      )}
+    >
+      {children}
+    </button>
+  );
+}
```

**File**: `apps/web/src/features/session/action-panel/easy/viewer-actions.tsx` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ export function ViewerPathPill({
   const crumbs = pathCrumbs(path);
   return (
     <span className="bg-muted flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md px-1">
-      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
+      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center">{icon}</span>
       <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" title={path}>
         {crumbs.length > 0 && (
           <span className="text-muted-foreground min-w-0 shrink-[3] truncate">
```

---

### Incident Patch 5: `20102944` (2026-10-05)
**Commit Message**: fix(mobile): scroll the drawer nav pills with the session list (#9192)

## Summary
- The project drawer's Search, Files, Review and Apps pills move from a
fixed block above the list into the session list's header. They scroll
with the sessions, so adding a pill no longer takes list height away.
- While the viewer's own session list is loading, the drawer shows only
the loader. The Shared header (a smaller page, often back first) and the
Automated header (always shown) no longer render under it.
- The list's top fade now sits under the switcher row.
`apps/mobile/design.md` → Project sidebar is updated to match.

## Test plan
- [ ] Open a project with sessions on a cold start: the drawer shows the
loader alone, with no Shared or Automated header under it.
- [ ] After the load: Search, Files, Review and Apps sit above Needs you
/ Sessions and scroll up with the list.
- [ ] Tap each pill: it closes the drawer and opens its page once
(double-tap guard).
- [ ] The Review count pill still shows when items wait.
- [ ] Pull to refresh still works from the top of the list.

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/kortix-ai/codesmith/suna/pr/9192?autoLogin=true&ref=co

**File**: `.agents/skills/kortix-brand/references/2026-10-02-mobile-aso-mockups-design.md` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+# Mobile ASO mockup studies
+
+Date: 2026-10-02
+Status: Direction approved. Written brief awaiting review.
+Canonical branch: `revamp/mobile-ui-13`.
+
+## Objective
+
+Improve the 80 mobile mockup studies in Paper. Show useful results and active
+moments through static composition. These are promotional concepts, not new
+app functionality and not verified production screenshots.
+
+The user approves conceptual presentation improvements. The app remains
+recognizable. Larger result previews and layered content can depart from the
+current transcript layout. No physical interaction or animation is required.
+
+## Scope and protected surfaces
+
+- Edit only the mockup collection below the eight original iOS assets.
+- Keep eight families with ten visible variants per family.
+- Keep every existing phone's dimensions, aspect ratio, position, edge path,
+  camera path, and screen aperture.
+- Do not edit the original iOS 01–08 assets, titles, backgrounds, or shaders.
+- Keep the approved Notion authorization component's layout and wording.
+  Improve context around it, not its dialog internals.
+- Keep the project's drawer icons, control sizes, rings, chevrons, badge
+  rules, and navigation structure. Do not replace them with illustrative icons.
+- Use Roobert only, as requested. Use existing shared mobile color roles.
+- Start in light mode. Review the new surfaces in dark mode before completion.
+- Do not change app source, backend behavior, or the brand token system.
+- Keep replaced design content recoverable. Do not delete the whole collection.
+
+## Design direction
+
+Mood: editorial, with a calm product shell and one prominent result.
+
+Each study has one focal element. Useful content creates personality.
+Color reports state or belongs to generated content and third-party artwork.
+Emoji can identify content, such as a trip plan. Do not scatter decorative
+emoji across controls, add confetti, or introduce unrelated gradient chrome.
+
+Use the current phone shell, header, composer, and navigation as the anchor.
+Use a larger generated result, expanded excerpt, selected state, or raised
+content surface to suggest an interaction that has just happened.
+
+Body copy stays short. Remove redundant introductions and repeated summaries.
+Use one primary action per focal element. Do not add an inert control unless
+the study label identifies it as a proposed component.
+
+New result surfaces use the existing neutral surface ladder. Floating surfaces
+use restrained elevation and a hairline that remains visible in dark mode.
+In-flow surfaces stay flat. Nested corners must be concentric.
+
+Use the existing type scale: normal body, medium labels, semibold titles.
+Do not enlarge every element. Keep native controls at their source geometry.
+Set new content on the mobile 4pt spacing grid. Use 16pt screen edges and
+20pt horizontal / 16pt vertical padding for roomy result sections.
+
+## Meeting example
+
+The selected conversation study currently gives the introductory sentence,
+numbered bullets, and Markdown file row similar emphasis. Replace that content
+treatment with one prominent generated summary preview.
+
+- Conversation request: “Summarize these meeting notes.”
+- Response: “Your meeting summary is ready.”
+- Preview title: “Coffee catch-up”.
+- Preview metadata: “Today · 11:30 am”.
+- Section: “Decisions”.
+- Decision 1: “Keep the first version focused.”
+- Decision 2: “Test the draft before adding more.”
+- Section: “Next step”.
+- Next step: “Share the revised plan on Friday.”
+- Primary action: “Open summary”.
+
+The preview is the largest content surface. A small document mark and a
+completed-state mark can support it. A partial second page can suggest more
+content without covering the readable text. Keep the composer visible.
+
+This enlarged transcript preview is a concept. The current mobile show result
+is a compact file row that opens its preview. Do not describe the enlarged
+preview as a shipped transcript component.
+
+## Eight families
+
+| Family | Focal treatment | Keep recognizable |
+| --- | --- | --- |
+| 01 · Start a task | A prepared request with meaningful attached context; restrained content previews suggest what the task can produce | Home shell, composer, native attachment controls |
+| 02 · Conversation | Large generated summary, plan, or answer preview; short request and response | Thread header, user bubble, composer, output context |
+| 03 · Follow the work | One active or completed activity moment with a readable result excerpt | Native activity sheet, timeline markers, source spacing and corners |
+| 04 · Choose a model | Selected model state over a concrete task; a visible answer excerpt explains the context | Actual picker rows, provider marks, checks and native controls |
+| 05 · Connect tools | Prominent connection moment with task context or a connected result behind it | Approved authorization layout and accurate third-party marks |
+| 06 · 
```

**File**: `.agents/skills/learnings/MEMORY.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Open the entry for the incident, the trigger surface, and the enforcement.
 
 Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 
+- `2026-10-02 15:21:03Z` [Ship mobile patches through the eas-build-post-install hook: the root .npmrc ignore-scripts skips postinstall on EAS](entries/2026-10-02T152103Z-ship-mobile-patches-through-the-eas-build-post-install-hook.md)
 - `2026-10-05 14:42:44Z` [Never let a config release the API cannot build replace a session's running config](entries/2026-10-05T144244Z-never-let-a-config-release-the-api-cannot-build-replace-a-se.md)
 - `2026-10-05 13:59:15Z` [Set the core size to zero in every sandbox shell: a crash dump carries the agent's whole environment](entries/2026-10-05T135915Z-set-the-core-size-to-zero-in-every-sandbox-shell-a-crash-dum.md)
 - `2026-10-05 10:19:14Z` [Treat a provider pause as temporary: a cooling key or account stays servable, and it rests until the provider's own reset time](entries/2026-10-05T101914Z-treat-a-provider-pause-as-temporary-a-cooling-key-or-account.md)
```

**File**: `apps/mobile/components/session/ProjectLeftDrawer.tsx` (modified, +64/-50)
```diff
@@ -10,14 +10,16 @@
  *   project/account switcher, not a navigation.
  *   The drawer's own gear button is gone: the project Settings page is
  *   reached from Settings (drawer avatar) → project row.
- * - Nav rows: Search (→ Sessions, its search field auto-focused), Files
+ * - Nav rows, the first rows of the scrolling list (they scroll away with
+ *   it, so a new pill never shrinks the list): Search (→ Sessions, its search field auto-focused), Files
  *   (→ /projects/[id]/files), Review (→ the Review page, a trailing count
  *   pill while items wait), and Apps (→ the Apps page, the project's
  *   deployed apps). Connectors moved to project Settings → Customize
  *   (KRTX-249): a "Customize in the web app" hand-off sheet, not a drawer row.
  * - Three sections of top-level sessions, by who started the run (KRTX-639):
  *   "Sessions" (yours, open), "Shared" (other members', collapsed, no header
  *   while empty) and "Automated" (triggers, channels, API keys; collapsed).
+ *   No section renders while the viewer's own list still loads.
  *   Each is its own paged query (`parent=root`), newest activity first
  *   (status mark · title; the session on screen is highlighted). A parent
  *   shows its child count and a caret, collapsed by default: a tap loads its
@@ -120,7 +122,7 @@ const LIST_END_GAP = 16;
 /**
  * Height of the fade at the top of the session list. It also is the scroll
  * distance over which the fade appears: invisible at rest, so the first row is
- * never dimmed, fully shown once a row has scrolled under the pills.
+ * never dimmed, fully shown once a row has scrolled under the switcher row.
  */
 const LIST_TOP_FADE_HEIGHT = 24;
 /** The open refetch waits out the drawer's 420ms slide (`DRAWER_OPEN`). */
@@ -349,42 +351,48 @@ export const ProjectLeftDrawer = React.memo(function ProjectLeftDrawer({
       }),
     [choices, projectId, activeParentSessionId]
   );
+  // While the viewer's own list loads, no section renders: Shared (a smaller
+  // page, often first back) and Automated (always shown) read as an empty
+  // drawer under the loader.
+  const sessionsLoading = projectSessionsPending;
   const items = useMemo(
     () =>
-      buildDrawerItems(
-        [
-          {
-            id: 'sessions',
-            title: 'Sessions',
-            rows: withoutNeedsYou(mineRoots),
-            open: sectionOpen('sessions'),
-            // No bare heading over nothing: the state block below (loading,
-            // error, empty) speaks for an empty list, and Needs you for a
-            // list whose every row waits on the user.
-            hidden: withoutNeedsYou(mineRoots).length === 0,
-            hasMore: hasNextPage,
-          },
-          {
-            id: 'shared',
-            title: 'Shared',
-            rows: withoutNeedsYou(sharedRoots),
-            open: sharedOpen,
-            hidden: sharedRoots.length === 0,
-            hasMore: shared.hasNextPage,
-          },
-          {
-            id: 'automated',
-            title: 'Automated',
-            rows: withoutNeedsYou(automatedRoots),
-            open: automatedOpen,
-            hidden: false,
-            hasMore: automated.hasNextPage,
-          },
-        ],
-        isExpanded
-      ),
+      sessionsLoading
+        ? []
+        : buildDrawerItems(
+            [
+              {
+                id: 'sessions',
+                title: 'Sessions',
+                rows: withoutNeedsYou(mineRoots),
+                open: sectionOpen('sessions'),
+                // No bare heading over nothing: the state block below (loading,
+                // error, empty) speaks for an empty list, and Needs you for a
+                // list whose every row waits on the user.
+                hidden: withoutNeedsYou(mineRoots).length === 0,
+                hasMore: hasNextPage,
+              },
+              {
+                id: 'shared',
+                title: 'Shared',
+                rows: withoutNeedsYou(sharedRoots),
+                open: sharedOpen,
+                hidden: sharedRoots.length === 0,
+                hasMore: shared.hasNextPage,
+              },
+              {
+                id: 'automated',
+                title: 'Automated',
+                rows: withoutNeedsYou(automatedRoots),
+                open: automatedOpen,
+                hidden: false,
+                hasMore: automated.hasNextPage,
+              },
+            ],
+            isExpanded
+          ),
     // eslint-disable-next-line react-hooks/exhaustive-deps -- sectionOpen reads `choices`
-    [mineRoots, sharedRoots, automatedRoots, withoutNeedsYou, sharedOpen, automatedOpen, choices, projectId, hasNextPage, shared.hasNextPage, automated.hasNextPage, isExpanded]
+    [sessionsLoading, mineRoots, sharedRoots, automatedRoots, withoutNeedsYou, sharedOpen, automatedOpen, choices, projectId, hasNextPage, shared.hasNextPage, automated.hasNextPage, isExpanded]
   );
   // loading / error / empty / rows
```

**File**: `apps/mobile/design.md` (modified, +3/-3)
```diff
@@ -321,17 +321,17 @@ from the drawer never deepens the project stack beyond one screen over home:
 | Drawer close | Faster than open (Jay, 2026-09-22): `closeSpringConfig={DRAWER_CLOSE_SPRING}` — `stiffness: 400, damping: 40, mass: 1`, critically damped, no overshoot: 90% of the travel in ~195ms, settled in ~330ms. Hamburger, session row, and swipe-release closes all use it; a swipe keeps its velocity. Open keeps the library spring (`1000 / 500 / 3`). The prop comes from `patches/react-native-drawer-layout+4.2.10.patch` (the library hardcodes one spring); without the patch `tsc` fails on the prop — run `npx patch-package`, then restart Metro with `--clear` |
 | Surface | `bg-chrome-background` (the web `--sidebar` token), `insets.top` top padding. **One straight left line at 20pt** (Jay, 2026-09-16): the switcher row, the Search / Files / Review icons, the "Sessions" label, the session status marks, and Previous chats all start at 20pt — the switcher row, like every other row, is `px-3` inside a `px-2` column |
 | Switcher row (COR-124/COR-157, replaces the old logo-only header) | Minimal (Jay, 2026-09-23): **no project tile**. One button edge to edge — a `px-2 pb-1` column holding a `Pressable` `flex-row items-center gap-3 rounded-2xl bg-card px-3 py-2 active:bg-secondary`, `hitSlop={4}`, label "Switch project, {project}, {account}"; children are `pointerEvents="none"`, so every part presses it. Leading: the project's chalk `Avatar` (32pt, Jay, 2026-09-24) in a 32pt (`w-8`) slot — the height of the two text lines (20pt + 17pt line boxes), so it spans both. Then a `min-w-0 flex-1` column: the project name (16pt / 20pt line, `font-roobert-medium`, one line) over the account name (13pt / 17pt line, `muted`, one line). Trailing: `CaretUpDownIcon` 16pt, `text-muted-foreground`. The `bg-card` fill at rest and the caret make the row read as a control (Jay, 2026-09-24, reversing the 2026-09-23 no-caret rule). Tap → the switcher sheet (`ProjectSwitcherSheet`, mounted in `ProjectScreen`) |
-| Nav rows | `NavPill` rows in a `px-2 pb-2` column, no gap: `Pressable` `flex-row items-center gap-3 rounded-full px-4 py-2.5 active:bg-foreground/5`, icon `size={18}` `text-foreground` on the 20pt line, label `Text` `font-medium flex-1`, one line, an optional trailing node. Order: Search (`MagnifyingGlassIcon` → the Sessions page, `navigateProjectRoute('sessions', { autoFocusSearch: '1' })` — the field is focused on arrival; this replaces the old plain "Sessions" row, since Search is now the only drawer path to it), Files (`FoldersIcon` → `files`, unchanged), Review (`SealCheckIcon`, the same glyph as the Review tab icon, → `useTabStore.getState().navigateToPage('page:review')`; a trailing pill — `bg-kortix-blue/15` / `text-kortix-blue`, the "needs-you" blue, not web's amber — shows `reviewNeedsYouCount` when it is greater than 0, hidden at 0; the count is `countReviewItemsBySegment(...).needs_you`, computed once in `ProjectScreen` and passed down, the same source the deleted project sheet's Review row badge used), Apps (`SquaresFourIcon`, → `useTabStore.getState().navigateToPage('page:apps')`, the same tab-store move as Review; **Apps**, below). **Connectors is gone from here** (KRTX-249): it moved to project Settings → Customize, a row that opens a hand-off sheet instead of leaving the app directly from the drawer — see **Settings**, below. The old "All projects" row is gone — the switcher row's `+`/chip flow replaces it |
+| Nav rows | The first rows of the session list's `ListHeaderComponent`: they scroll with the list, so a new pill never takes list height away (Jay, 2026-10-06). `NavPill` rows in a `px-2 pb-2` column, no gap: `Pressable` `flex-row items-center gap-3 rounded-full px-4 py-2.5 active:bg-foreground/5`, icon `size={18}` `text-foreground` on the 20pt line, label `Text` `font-medium flex-1`, one line, an optional trailing node. Order: Search (`MagnifyingGlassIcon` → the Sessions page, `navigateProjectRoute('sessions', { autoFocusSearch: '1' })` — the field is focused on arrival; this replaces the old plain "Sessions" row, since Search is now the only drawer path to it), Files (`FoldersIcon` → `files`, unchanged), Review (`SealCheckIcon`, the same glyph as the Review tab icon, → `useTabStore.getState().navigateToPage('page:review')`; a trailing pill — `bg-kortix-blue/15` / `text-kortix-blue`, the "needs-you" blue, not web's amber — shows `reviewNeedsYouCount` when it is greater than 0, hidden at 0; the count is `countReviewItemsBySegment(...).needs_you`, computed once in `ProjectScreen` and passed down, the same source the deleted project sheet's Review row badge used), Apps (`SquaresFourIcon`, → `useTabStore.getState().navigateToPage('page:apps')`, the same tab-store move as Review; **Apps**, below). **Connectors is gone from here** (KRTX-249): it moved to project Settings → Customize, a row that opens a hand-off sheet instead of leaving the app directly from the drawer — see **Settings**, below. The old "All p
```

---

### Incident Patch 6: `b1586bfc` (2026-10-05)
**Commit Message**: fix(auth): a signed-out device's bearer stops working at once; label the device routes (#9193)

## Summary

`main` is red after #9184 (signed-in devices). This fixes forward the
two failures `pnpm test` shows on `main`:

1. **`AUTH-7` (security behavior): a signed-out device's bearer kept
working.**
- `DELETE /v1/accounts/me/devices/:sessionId` revoked the GoTrue session
but left the JWT liveness cache (`shared/jwt-liveness.ts`) alone.
- That cache keeps a positive GoTrue answer per token for
`SUPABASE_JWT_LIVENESS_TTL_MS`: 2 s in the local test profile
(`tests/src/core/local-stack.ts:662`). Its contract says prod must run
0.
- So the signed-out device's bearer answered `200` instead of `401` for
up to the TTL. `AUTH-7` probes it right away and failed: `status in
[401] — expected [401], got 200`, 3 of 3 runs alone.
- `POST /v1/auth/logout` already drops its own token
(`forgetJwtLiveness`). The device route now calls the existing
`forgetUserJwtLiveness(userId)`.
- The cache keys tokens, not sessions, so it cannot drop only the
signed-out device's entry. The caller's other devices re-ask GoTrue once
on their next request.
2. **`unit-audit-route-labels`: the 2 device routes had no aud

**File**: `apps/api/src/accounts/core/devices.ts` (modified, +10/-2)
```diff
@@ -1,6 +1,7 @@
 import { createRoute, z } from '@hono/zod-openapi';
 import { json, errors, auth } from '../../openapi';
 import { isUuid } from '../../shared/validate';
+import { forgetUserJwtLiveness } from '../../shared/jwt-liveness';
 import { listSignedInDevices, signOutDevice } from '../../repositories/auth-devices';
 import { accountsRouter, OkSchema } from './app';
 
@@ -62,8 +63,15 @@ export function registerDeviceRoutes(): void {
       if (sessionId === c.get('sessionId')) {
         return c.json({ error: 'This is the current device. Sign out instead.' }, 400);
       }
-      const ok = await signOutDevice(c.get('userId') as string, sessionId);
-      return ok ? c.json({ ok: true }) : c.json({ error: 'Device not found.' }, 404);
+      const userId = c.get('userId') as string;
+      const ok = await signOutDevice(userId, sessionId);
+      if (!ok) return c.json({ error: 'Device not found.' }, 404);
+      // The liveness cache keys tokens, not sessions, so it cannot drop only the
+      // signed-out device: drop the user's entries and let the next request of
+      // every device ask GoTrue again. Without this a cached bearer of the
+      // signed-out device keeps working until SUPABASE_JWT_LIVENESS_TTL_MS.
+      forgetUserJwtLiveness(userId);
+      return c.json({ ok: true });
     },
   );
 }
```

**File**: `apps/web/content/docs/audit-actions.mdx` (modified, +3/-1)
```diff
@@ -13,7 +13,7 @@ Every row in the [audit log](/docs/accounts#audit-log) carries an `action`: `dom
 - A route with two actions (`secret.strategy.update` or `secret.strategy.changed`) records the second when its handler records that event, for example only for a real change. That event, with its before and after state, is then the request's row.
 - Rows written before 2026-09-24 carry `METHOD /template` as their action. The web app and the CLI show them with the same titles.
 
-This page lists 700 route actions and 64 other events.
+This page lists 702 route actions and 64 other events.
 
 ## `account.`
 
@@ -125,6 +125,8 @@ This page lists 700 route actions and 64 other events.
 | --- | --- | --- |
 | `auth.access_request.create` | Requested early access | `POST /v1/access/request-access` |
 | `auth.client_config.read` | Read the sign-in configuration | `GET /v1/auth/client-config` |
+| `auth.device.list` | Viewed signed-in devices | `GET /v1/accounts/me/devices` |
+| `auth.device.sign_out` | Signed a device out | `DELETE /v1/accounts/me/devices/:sessionId` |
 | `auth.email.check` | Checked sign-in email | `POST /v1/access/check-email` |
 | `auth.identity.read` | Viewed own identity | `GET /v1/accounts/me` |
 | `auth.logout` | Signed out | `POST /v1/auth/logout` (also `POST /v1/auth/sign-out`) |
```

**File**: `apps/web/src/components/iam/audit-http-routes.generated.ts` (modified, +2/-0)
```diff
@@ -151,6 +151,8 @@ const AUDIT_HTTP_ROUTE_KEYS = [
   "PUT|v1|accounts|:accountId|secret-resources|:secretId|grants|:userId",
   "PUT|v1|accounts|:accountId|secret-resources|:secretId|value",
   "GET|v1|accounts|me",
+  "GET|v1|accounts|me|devices",
+  "DELETE|v1|accounts|me|devices|:sessionId",
   "GET|v1|accounts|tokens",
   "POST|v1|accounts|tokens",
   "DELETE|v1|accounts|tokens|:tokenId",
```

**File**: `apps/web/src/components/iam/audit-title-translation-keys.generated.ts` (modified, +2/-0)
```diff
@@ -527,6 +527,7 @@ export const AUDIT_TITLE_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
   'Set session prompt queue hold': 'text520f1939d072',
   'Set super-admin status': 'text2bc95eda6944',
   'Shared a private connector account': 'texte817b7da7436',
+  'Signed a device out': 'text976811d9540a',
   'Signed in': 'textca566c8968e7',
   'Signed in with a password': 'text77413d074c15',
   'Signed out': 'text80c6e7caffee',
@@ -774,6 +775,7 @@ export const AUDIT_TITLE_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
   'Viewed setup wizard status': 'texte70edc6194ea',
   'Viewed setup wizard step': 'textd9391d4f76e8',
   'Viewed shared session file': 'text5377adb59e2e',
+  'Viewed signed-in devices': 'textc959682e0398',
   'Viewed signup status': 'textff6c0b2c730d',
   'Viewed system metrics': 'textd43c432b5930',
   'Viewed system status banner': 'text2afef4702cc0',
```

**File**: `apps/web/src/lib/seo/content-timestamps.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
   "marketing:download": "2026-10-04T21:48:06.000Z",
   "docs:accounts": "2026-10-03T23:15:00.000Z",
   "docs:ai-operating-system": "2026-10-04T21:48:06.000Z",
-  "docs:audit-actions": "2026-10-03T21:54:47.000Z",
+  "docs:audit-actions": "2026-10-05T18:28:14.000Z",
   "docs:backend": "2026-10-02T11:51:41.000Z",
   "docs:cli": "2026-10-05T15:35:59.000Z",
   "docs:compare": "2026-10-04T21:48:06.000Z",
```

**File**: `apps/web/translations/de.json` (modified, +3/-1)
```diff
@@ -19238,7 +19238,9 @@
       "text09e71792c6c3": "KI-Agenten für Vertriebsteams",
       "textaaab3a59b808": "KI-Agenten für Marketingteams",
       "text8f480bae8d16": "KI-Agenten für Finanzteams",
-      "text6243d930fc1c": "AI Operating System"
+      "text6243d930fc1c": "AI Operating System",
+      "textc959682e0398": "Angemeldete Geräte angezeigt",
+      "text976811d9540a": "Ein Gerät abgemeldet"
     },
     "publicShareConfirm": {
       "title": "Öffentlichen Link erstellen?",
```

**File**: `apps/web/translations/en.json` (modified, +3/-1)
```diff
@@ -19249,7 +19249,9 @@
       "text09e71792c6c3": "AI agents for sales teams",
       "textaaab3a59b808": "AI agents for marketing teams",
       "text8f480bae8d16": "AI agents for finance teams",
-      "text6243d930fc1c": "AI Operating System"
+      "text6243d930fc1c": "AI Operating System",
+      "textc959682e0398": "Viewed signed-in devices",
+      "text976811d9540a": "Signed a device out"
     },
     "publicShareConfirm": {
       "title": "Create a public link?",
```

**File**: `apps/web/translations/es.json` (modified, +3/-1)
```diff
@@ -19238,7 +19238,9 @@
       "text09e71792c6c3": "Agentes de IA para equipos de ventas",
       "textaaab3a59b808": "Agentes de IA para equipos de marketing",
       "text8f480bae8d16": "Agentes de IA para equipos de finanzas",
-      "text6243d930fc1c": "AI Operating System"
+      "text6243d930fc1c": "AI Operating System",
+      "textc959682e0398": "Vio los dispositivos con sesión iniciada",
+      "text976811d9540a": "Cerró la sesión de un dispositivo"
     },
     "publicShareConfirm": {
       "title": "¿Crear un enlace público?",
```

---

### Incident Patch 7: `fe9f4241` (2026-10-05)
**Commit Message**: feat(web): list every signed-in device in Settings > Security (#9184)

## Summary
- Settings > Security > Devices listed only the current browser. GoTrue
gives a browser no way to list the account's other sessions.
- New API routes read `auth.sessions` for the caller:
- `GET /v1/accounts/me/devices` returns `session_id`, `user_agent`,
`ip`, `signed_in_at`, `last_active_at`, `current`. The most recently
active device comes first.
- `DELETE /v1/accounts/me/devices/:sessionId` signs one other device
out. It deletes the session, which removes its refresh tokens. It also
stamps `account_session_activity`, so the device's access token gets
`401` immediately.
  - Both routes accept a browser session only. A PAT gets `403`.
- The current session and a malformed id get `400`. Another user's
session gets `404`.
- New SDK exports `listSignedInDevices`, `signOutDevice` and
`SignedInDevice` are additive. The public-surface snapshots were
updated.
- The web tab shows one row per device:
- The name comes from the user agent ("Chrome on macOS"), with a phone
or desktop icon.
  - Each row shows the last-active time and the IP.
- The current browser has a "This browser" badge. Every other row has a


**File**: `apps/api/src/accounts/core/devices.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import { createRoute, z } from '@hono/zod-openapi';
+import { json, errors, auth } from '../../openapi';
+import { isUuid } from '../../shared/validate';
+import { listSignedInDevices, signOutDevice } from '../../repositories/auth-devices';
+import { accountsRouter, OkSchema } from './app';
+
+const SignedInDeviceSchema = z
+  .object({
+    session_id: z.string(),
+    user_agent: z.string().nullable(),
+    ip: z.string().nullable(),
+    signed_in_at: z.string(),
+    last_active_at: z.string(),
+    current: z.boolean(),
+  })
+  .openapi('SignedInDevice');
+
+// A device is a browser sign-in, so only a browser session may read or end
+// one: a PAT or an agent token has no device of its own and must not be able
+// to sign its owner out.
+const BROWSER_ONLY = { error: 'Signed-in devices need a browser session.' };
+
+// Registered before /:accountId so the static `me` segment is not shadowed.
+export function registerDeviceRoutes(): void {
+  accountsRouter.openapi(
+    createRoute({
+      method: 'get',
+      path: '/me/devices',
+      tags: ['accounts'],
+      summary: "List the caller's signed-in devices",
+      ...auth,
+      responses: {
+        200: json(z.object({ devices: z.array(SignedInDeviceSchema) }), 'Live sign-ins, most recently active first'),
+        ...errors(401, 403),
+      },
+    }),
+    async (c) => {
+      if (c.get('authType') !== 'supabase') return c.json(BROWSER_ONLY, 403);
+      const current = c.get('sessionId') as string | undefined;
+      const rows = await listSignedInDevices(c.get('userId') as string);
+      return c.json({ devices: rows.map((r) => ({ ...r, current: r.session_id === current })) });
+    },
+  );
+
+  accountsRouter.openapi(
+    createRoute({
+      method: 'delete',
+      path: '/me/devices/{sessionId}',
+      tags: ['accounts'],
+      summary: 'Sign one other device out',
+      ...auth,
+      request: { params: z.object({ sessionId: z.string() }) },
+      responses: {
+        200: json(OkSchema, 'The device is signed out'),
+        ...errors(400, 401, 403, 404),
+      },
+    }),
+    async (c) => {
+      if (c.get('authType') !== 'supabase') return c.json(BROWSER_ONLY, 403);
+      const sessionId = c.req.param('sessionId');
+      if (!isUuid(sessionId)) return c.json({ error: 'Invalid device id.' }, 400);
+      if (sessionId === c.get('sessionId')) {
+        return c.json({ error: 'This is the current device. Sign out instead.' }, 400);
+      }
+      const ok = await signOutDevice(c.get('userId') as string, sessionId);
+      return ok ? c.json({ ok: true }) : c.json({ error: 'Device not found.' }, 404);
+    },
+  );
+}
```

**File**: `apps/api/src/accounts/index.ts` (modified, +3/-0)
```diff
@@ -10,6 +10,7 @@ import { accountSessionGate } from '../iam/session-gate';
 import { iamRouter } from './iam';
 import { auditRouter } from './audit';
 import { registerTokenRoutes } from './core/tokens';
+import { registerDeviceRoutes } from './core/devices';
 import { registerAccountRoutes } from './core/accounts';
 import { registerMemberRoutes } from './core/members';
 import { registerBrandingRoutes } from './branding';
@@ -41,9 +42,11 @@ accountsRouter.route('/', auditRouter);
 // Hono matches routes in registration order, so anything declared after the
 // `:accountId` handler would be shadowed by it. The calls below mirror the
 // original route-registration order exactly:
+//   me/devices GET/DELETE            → registerDeviceRoutes
 //   me, tokens GET/POST/DELETE        → registerTokenRoutes
 //   accounts list/create/get/patch    → registerAccountRoutes
 //   members + invites + leave         → registerMemberRoutes
+registerDeviceRoutes();
 registerTokenRoutes();
 registerAccountRoutes();
 registerMemberRoutes();
```

**File**: `apps/api/src/repositories/auth-devices.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+// A person's signed-in devices: their live Supabase auth sessions.
+//
+// GoTrue gives a client no way to list the account's sessions — a browser can
+// only see its own. The API reads `auth.sessions` directly, the same table
+// `auth.signOut({ scope: 'others' })` deletes from. Sessions an OAuth app holds
+// (`oauth_client_id`) are not devices; Connected apps lists those.
+
+import { and, eq, sql } from 'drizzle-orm';
+import { accountSessionActivity } from '@kortix/db';
+import { db } from '../shared/db';
+
+export interface SignedInDeviceRow {
+  session_id: string;
+  user_agent: string | null;
+  ip: string | null;
+  signed_in_at: string;
+  last_active_at: string;
+}
+
+/** Live sessions for `userId`, most recently active first. */
+export async function listSignedInDevices(userId: string): Promise<SignedInDeviceRow[]> {
+  // `refreshed_at` is `timestamp without time zone` in UTC; the others carry a zone.
+  return (await db.execute(sql`
+    SELECT s.id::text AS session_id,
+           s.user_agent,
+           host(s.ip) AS ip,
+           to_char(COALESCE(s.created_at, s.updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS signed_in_at,
+           to_char(GREATEST(s.refreshed_at, s.updated_at AT TIME ZONE 'UTC', s.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_active_at
+    FROM auth.sessions s
+    WHERE s.user_id = ${userId}::uuid
+      AND s.oauth_client_id IS NULL
+      AND (s.not_after IS NULL OR s.not_after > now())
+    ORDER BY GREATEST(s.refreshed_at, s.updated_at AT TIME ZONE 'UTC', s.created_at AT TIME ZONE 'UTC') DESC
+    LIMIT 100
+  `)) as unknown as SignedInDeviceRow[];
+}
+
+/**
+ * End one of `userId`'s sessions. Deleting the row cascades to its refresh
+ * tokens, so the device cannot renew. Its access token would live until it
+ * expires (~1 h); stamping `account_session_activity` makes the session gate
+ * refuse it on every account-scoped route now. Returns false when the session
+ * is not the caller's or no longer exists.
+ */
+export async function signOutDevice(userId: string, sessionId: string): Promise<boolean> {
+  const deleted = (await db.execute(sql`
+    DELETE FROM auth.sessions
+    WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
+    RETURNING id
+  `)) as unknown as unknown[];
+  if (deleted.length === 0) return false;
+  await db
+    .update(accountSessionActivity)
+    .set({
+      revokedAt: sql`COALESCE(${accountSessionActivity.revokedAt}, now())`,
+      revokedReason: sql`COALESCE(${accountSessionActivity.revokedReason}, 'user')`,
+      revokedBy: userId,
+    })
+    .where(
+      and(eq(accountSessionActivity.userId, userId), eq(accountSessionActivity.sessionId, sessionId)),
+    );
+  return true;
+}
```

**File**: `apps/web/src/app/[locale]/(system)/debug/devices/page.tsx` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+'use client';
+
+/**
+ * Visual harness for Settings → Security → Devices. Auth-free: every state is
+ * the pure `DevicesSection` fed fixture rows, so no sign-in and no API call.
+ * Rows go through the same `describeUserAgent` the container uses, so a label
+ * here is the label a real user agent gets. Open /debug/devices.
+ */
+import type { ReactNode } from 'react';
+
+import { useCopy } from '@/hooks/use-copy';
+
+import { describeUserAgent } from '@/features/workspace/settings/tabs/device-label';
+import {
+  DEFAULT_SECURITY_TAB_COPY,
+  type DeviceRow,
+  DevicesSection,
+  type DevicesSectionProps,
+} from '@/features/workspace/settings/tabs/security-tab';
+
+/** The section exactly as Settings renders it, with the default English copy. */
+function Devices(props: Omit<DevicesSectionProps, 'copy'>) {
+  const { copy } = useCopy({ successMessage: 'IP address copied' });
+  return (
+    <DevicesSection
+      {...props}
+      onCopyIp={(ip) => void copy(ip)}
+      copy={DEFAULT_SECURITY_TAB_COPY}
+    />
+  );
+}
+
+const UA = {
+  chromeMac:
+    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
+  safariIphone:
+    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
+  edgeWindows:
+    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
+  chromeAndroid:
+    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
+  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:156.0) Gecko/20100101 Firefox/156.0',
+  safariIpad:
+    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/604.1',
+  desktopApp:
+    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Kortix/1.4.0 Chrome/140.0.0.0 Electron/38.0.0 Safari/537.36',
+  chromebook:
+    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
+  linuxOther: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Konqueror/5',
+  script: 'Bun/1.3.14',
+  none: null,
+};
+
+/** One fixture row, labelled exactly the way the container labels it. */
+function device(
+  id: string,
+  userAgent: string | null,
+  detail: string,
+  ip: string | null = null,
+  current = false,
+): DeviceRow {
+  const { browser, os, mobile, brand } = describeUserAgent(userAgent);
+  const label = browser && os ? `${browser} on ${os}` : (browser ?? os ?? 'Unknown device');
+  return { id, label, detail, ip, mobile, brand, current };
+}
+
+const THIS_BROWSER = device('d-here', UA.chromeMac, 'Signed in October 5, 2026', '203.0.113.10', true);
+
+const SCENARIOS: { title: string; note: string; view: ReactNode }[] = [
+  {
+    title: 'One device',
+    note: 'Signed in only here. The bulk action has nothing to sign out but stays visible.',
+    view: <Devices devices={[THIS_BROWSER]} />,
+  },
+  {
+    title: 'Two devices',
+    note: 'This browser plus a phone.',
+    view: (
+      <Devices
+        devices={[
+          THIS_BROWSER,
+          device('d-phone', UA.safariIphone, 'Last active Oct 5, 2026, 9:12 PM', '198.51.100.24'),
+        ]}
+      />
+    ),
+  },
+  {
+    title: 'Many devices',
+    note: 'Every user-agent family the label helper names, most recently active first.',
+    view: (
+      <Devices
+        devices={[
+          THIS_BROWSER,
+          device('d-phone', UA.safariIphone, 'Last active Oct 5, 2026, 9:12 PM', '198.51.100.24'),
+          device('d-win', UA.edgeWindows, 'Last active Oct 5, 2026, 6:40 PM', '192.0.2.77'),
+          device('d-app', UA.desktopApp, 'Last active Oct 4, 2026, 11:03 AM', '203.0.113.10'),
+          device('d-android', UA.chromeAndroid, 'Last active Oct 3, 2026, 8:55 PM', '198.51.100.150'),
+          device('d-ipad', UA.safariIpad, 'Last active Oct 1, 2026, 7:20 AM', '198.51.100.24'),
+          device('d-linux', UA.firefoxLinux, 'Last active Sep 28, 2026, 4:02 PM', '192.0.2.9'),
+          device('d-crbook', UA.chromebook, 'Last active Sep 20, 2026, 1:15 PM', '192.0.2.200'),
+        ]}
+      />
+    ),
+  },
+  {
+    title: 'Unrecognised devices',
+    note: 'A browser with no logo on Linux (the system mark), a script (product token only), and a sign-in that recorded no user agent.',
+    view: (
+      <Devices
+        devices={[
+          THIS_BROWSER,
+          device('d-tux', UA.linuxOther, 'Last active Oct 5, 2026, 3:48 PM', '192.0.2.41'),
+          device('d-script', UA.script, 'Last active Oct 5, 2026, 2:22 PM', '203.0.113.10'),
+          device('d-none', UA.none, 'Last active Oct 2, 2026, 10:00 AM'),
+        ]}
+      />
+    ),
+  },
+  {
+    title: 'Signing out one device',
+    note: 'The phone sign-out is in flight
```

**File**: `apps/web/src/features/icon/icons/bun.tsx` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+'use client';
+
+import { cn } from '@/lib/utils';
+
+/** Bun brand mark, full colour. Source: gilbarbara/logos (CC0), `logos:bun`. */
+export const Bun = ({ className }: { className?: string }) => {
+  return (
+    <svg
+      viewBox="0 0 256 225"
+      xmlns="http://www.w3.org/2000/svg"
+      aria-hidden="true"
+      className={cn('size-4', className)}
+    >
+      <path d="M228.747 65.588a38 38 0 0 0-1.62-1.62c-.55-.519-1.07-1.102-1.62-1.62c-.551-.52-1.07-1.102-1.62-1.62c-.551-.52-1.07-1.103-1.62-1.621c-.552-.519-1.07-1.102-1.62-1.62c-.552-.519-1.07-1.102-1.621-1.62c-.551-.52-1.07-1.102-1.62-1.62a85.74 85.74 0 0 1 25.632 59.819c0 53.695-54.505 97.377-121.519 97.377c-37.525 0-71.097-13.707-93.424-35.192l1.62 1.62l1.62 1.62l1.62 1.62l1.621 1.621l1.62 1.62l1.62 1.62l1.621 1.62c22.295 22.393 56.612 36.813 95.044 36.813c67.014 0 121.519-43.682 121.519-97.215c0-22.878-9.851-44.557-27.253-61.602" />
+      <path
+        fill="#fbf0df"
+        d="M234.937 114.066c0 49.288-50.779 89.243-113.418 89.243S8.101 163.354 8.101 114.066c0-30.558 19.443-57.552 49.32-73.56C87.3 24.498 105.9 8.101 121.52 8.101s28.97 13.384 64.097 32.405c29.878 16.008 49.32 43.002 49.32 73.56"
+      />
+      <path
+        fill="#f6dece"
+        d="M234.937 114.066a70.2 70.2 0 0 0-2.593-18.73c-8.846 107.909-140.476 113.093-192.227 80.818a129.62 129.62 0 0 0 81.402 27.155c62.542 0 113.418-40.02 113.418-89.243"
+      />
+      <path
+        fill="#fffefc"
+        d="M77.87 34.576c14.484-8.684 33.733-24.984 52.658-25.017a30.1 30.1 0 0 0-9.009-1.458c-7.842 0-16.203 4.05-26.734 10.143c-3.662 2.139-7.453 4.504-11.472 6.967c-7.55 4.666-16.202 9.948-25.924 15.23c-30.85 16.69-49.288 44.201-49.288 73.625v3.856C27.74 48.542 63.417 43.261 77.87 34.576"
+      />
+      <path
+        fill="#ccbea7"
+        d="M112.186 16.3a53.18 53.18 0 0 1-18.244 40.409c-.907.81-.194 2.365.972 1.912c10.92-4.245 25.665-16.948 19.443-42.58c-.259-1.459-2.17-1.07-2.17.259m7.356 0a52.63 52.63 0 0 1 5.217 43.65c-.388 1.134 1.005 2.106 1.783 1.166c7.096-9.073 13.286-27.09-5.25-46.534c-.94-.842-2.398.454-1.75 1.588zm8.944-.551a53.2 53.2 0 0 1 22.198 38.108a1.07 1.07 0 0 0 2.106.357c2.981-11.31 1.296-30.59-23.235-40.604c-1.296-.518-2.138 1.232-1.069 2.01zM68.666 49.45a54.9 54.9 0 0 0 33.928-29.164c.584-1.167 2.43-.713 2.14.583c-5.607 25.924-24.37 31.336-36.035 30.623c-1.232.032-1.2-1.685-.033-2.042"
+      />
+      <path d="M121.519 211.443C54.505 211.443 0 167.761 0 114.066c0-32.405 20.026-62.64 53.566-80.754c9.721-5.184 18.05-10.402 25.47-14.97c4.083-2.528 7.94-4.894 11.666-7.097C102.076 4.505 111.797 0 121.519 0s18.212 3.889 28.84 10.175c3.241 1.847 6.482 3.856 9.949 6.06c8.069 4.99 17.175 10.629 29.164 17.077c33.54 18.115 53.566 48.316 53.566 80.754c0 53.695-54.505 97.377-121.519 97.377m0-203.342c-7.842 0-16.203 4.05-26.734 10.143c-3.662 2.139-7.453 4.504-11.472 6.967c-7.55 4.666-16.202 9.948-25.924 15.23c-30.85 16.69-49.288 44.201-49.288 73.625c0 49.223 50.876 89.276 113.418 89.276s113.418-40.053 113.418-89.276c0-29.424-18.439-56.936-49.32-73.56c-12.25-6.48-21.81-12.573-29.554-17.369c-3.532-2.17-6.773-4.18-9.722-5.962c-9.818-5.833-16.98-9.074-24.822-9.074" />
+      <path
+        fill="#b71422"
+        d="M144.365 137.722a28.94 28.94 0 0 1-9.463 15.263a22.07 22.07 0 0 1-12.962 6.092a22.17 22.17 0 0 1-13.383-6.092a28.94 28.94 0 0 1-9.333-15.263a2.333 2.333 0 0 1 2.593-2.625h39.988a2.333 2.333 0 0 1 2.56 2.625"
+      />
+      <path
+        fill="#ff6164"
+        d="M108.557 153.244a22.4 22.4 0 0 0 13.351 6.157a22.4 22.4 0 0 0 13.318-6.157a34.5 34.5 0 0 0 3.241-3.468a22.13 22.13 0 0 0-15.879-7.485a19.93 19.93 0 0 0-16.202 9.008c.745.681 1.393 1.33 2.171 1.945"
+      />
+      <path d="M109.076 150.684a17.37 17.37 0 0 1 13.577-6.74a19.44 19.44 0 0 1 12.962 5.476a51 51 0 0 0 2.139-2.495a22.68 22.68 0 0 0-15.263-6.254a20.61 20.61 0 0 0-15.846 7.647a31 31 0 0 0 2.43 2.366" />
+      <path d="M121.81 161.021a24.05 24.05 0 0 1-14.42-6.481a30.85 30.85 0 0 1-10.077-16.365a3.89 3.89 0 0 1 .842-3.24a4.57 4.57 0 0 1 3.662-1.653h39.988a4.67 4.67 0 0 1 3.661 1.653a3.86 3.86 0 0 1 .81 3.24A30.85 30.85 0 0 1 136.2 154.54c-3.93 3.717-9 6-14.388 6.481m-19.993-23.98c-.519 0-.648.227-.68.292a26.86 26.86 0 0 0 8.846 14.16a20.2 20.2 0 0 0 11.828 5.672a20.35 20.35 0 0 0 11.828-5.606a26.9 26.9 0 0 0 8.814-14.161a.68.68 0 0 0-.648-.292z" />
+      <g transform="translate(53.792 88.4)">
+        <ellipse cx="117.047" cy="40.183" fill="#febbd0" rx="18.957" ry="11.147" />
+        <ellipse cx="18.957" cy="40.183" fill="#febbd0" rx="18.957" ry="11.147" />
+        <path d="M27.868 35.71a17.855 17.855 0 1 0-17.822-17.854c0 9.848 7.974 17.837 17.822 17.855m80.268 0A17.855 17.855 0 1 0 90.41 17.857c-.018 9.818 7.908 17.801 17.726 17.855" />
+        <path
+          fill="#fff"
+          d="M22.36 18.99a6.708 6.708 0 1 0 .064-13.416a6.708 6.708 0 0 0-.065 13.416m80.267 0a6.708 6.708 0 1 0-.065 0z"
+        />
+      </g>
+    </svg>
+  );
+};
```

**File**: `apps/web/src/features/icon/icons/chrome.tsx` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+'use client';
+
+import { cn } from '@/lib/utils';
+
+/** Chrome brand mark, full colour. Source: gilbarbara/logos (CC0), `logos:chrome`. */
+export const Chrome = ({ className }: { className?: string }) => {
+  return (
+    <svg
+      viewBox="0 0 256 256"
+      xmlns="http://www.w3.org/2000/svg"
+      aria-hidden="true"
+      className={cn('size-4', className)}
+    >
+      <path
+        fill="#fff"
+        d="M128.003 199.216c39.335 0 71.221-31.888 71.221-71.223S167.338 56.77 128.003 56.77S56.78 88.658 56.78 127.993s31.887 71.223 71.222 71.223"
+      />
+      <path
+        fill="#229342"
+        d="M35.89 92.997Q27.92 79.192 17.154 64.02a127.98 127.98 0 0 0 110.857 191.981q17.671-24.785 23.996-35.74q12.148-21.042 31.423-60.251v-.015a63.993 63.993 0 0 1-110.857.017Q46.395 111.19 35.89 92.998"
+      />
+      <path
+        fill="#fbc116"
+        d="M128.008 255.996A127.97 127.97 0 0 0 256 127.997A128 128 0 0 0 238.837 64q-36.372-3.585-53.686-3.585q-19.632 0-57.152 3.585l-.014.01a63.99 63.99 0 0 1 55.444 31.987a63.99 63.99 0 0 1-.001 64.01z"
+      />
+      <path
+        fill="#1a73e8"
+        d="M128.003 178.677c27.984 0 50.669-22.685 50.669-50.67s-22.685-50.67-50.67-50.67c-27.983 0-50.669 22.686-50.669 50.67s22.686 50.67 50.67 50.67"
+      />
+      <path
+        fill="#e33b2e"
+        d="M128.003 64.004H238.84a127.973 127.973 0 0 0-221.685.015l55.419 95.99l.015.008a63.993 63.993 0 0 1 55.415-96.014z"
+      />
+    </svg>
+  );
+};
```

**File**: `apps/web/src/features/icon/icons/edge.tsx` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+'use client';
+
+import { useId } from 'react';
+
+import { cn } from '@/lib/utils';
+
+/** Edge brand mark, full colour. Source: gilbarbara/logos (CC0), `logos:microsoft-edge`. */
+export const Edge = ({ className }: { className?: string }) => {
+  // Gradient ids are per instance, so two marks on one page never share a definition.
+  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
+  return (
+    <svg
+      viewBox="0 0 256 256"
+      xmlns="http://www.w3.org/2000/svg"
+      aria-hidden="true"
+      className={cn('size-4', className)}
+    >
+      <defs>
+        <radialGradient
+          id={`${uid}SVGHFrboeCQ`}
+          cx="161.83"
+          cy="788.401"
+          r="95.38"
+          gradientTransform="matrix(.9999 0 0 .9498 -4.622 -570.387)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".72" stopOpacity="0" />
+          <stop offset=".95" stopOpacity=".53" />
+          <stop offset="1" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGVG94vbPK`}
+          cx="-773.636"
+          cy="746.715"
+          r="143.24"
+          gradientTransform="matrix(.15 -.9898 .8 .12 -410.718 -656.341)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".76" stopOpacity="0" />
+          <stop offset=".95" stopOpacity=".5" />
+          <stop offset="1" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGw2d8JdCl`}
+          cx="230.593"
+          cy="-106.038"
+          r="202.43"
+          gradientTransform="matrix(-.04 .9998 -2.1299 -.07998 -190.775 -191.635)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset="0" stopColor="#35c1f1" />
+          <stop offset=".11" stopColor="#34c1ed" />
+          <stop offset=".23" stopColor="#2fc2df" />
+          <stop offset=".31" stopColor="#2bc3d2" />
+          <stop offset=".67" stopColor="#36c752" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGIqWItcPR`}
+          cx="536.357"
+          cy="-117.703"
+          r="97.34"
+          gradientTransform="matrix(.28 .9598 -.78 .23 -1.928 -410.318)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset="0" stopColor="#66eb6e" />
+          <stop offset="1" stopColor="#66eb6e" stopOpacity="0" />
+        </radialGradient>
+        <linearGradient
+          id={`${uid}SVGktZSUcGK`}
+          x1="63.334"
+          x2="241.617"
+          y1="757.83"
+          y2="757.83"
+          gradientTransform="translate(-4.63 -580.81)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset="0" stopColor="#0c59a4" />
+          <stop offset="1" stopColor="#114a8b" />
+        </linearGradient>
+        <linearGradient
+          id={`${uid}SVGaPqZBebW`}
+          x1="157.401"
+          x2="46.028"
+          y1="680.556"
+          y2="801.868"
+          gradientTransform="translate(-4.63 -580.81)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset="0" stopColor="#1b9de2" />
+          <stop offset=".16" stopColor="#1595df" />
+          <stop offset=".67" stopColor="#0680d7" />
+          <stop offset="1" stopColor="#0078d4" />
+        </linearGradient>
+      </defs>
+      <path
+        fill={`url(#${uid}SVGktZSUcGK)`}
+        d="M231 190.5c-3.4 1.8-6.9 3.4-10.5 4.7c-11.5 4.3-23.6 6.5-35.9 6.5c-47.3 0-88.5-32.5-88.5-74.3c.1-11.4 6.4-21.9 16.4-27.3c-42.8 1.8-53.8 46.4-53.8 72.5c0 73.9 68.1 81.4 82.8 81.4c7.9 0 19.8-2.3 27-4.6l1.3-.4c27.6-9.5 51-28.1 66.6-52.8c1.2-1.9.6-4.3-1.2-5.5c-1.3-.8-2.9-.9-4.2-.2"
+      />
+      <path
+        fill={`url(#${uid}SVGHFrboeCQ)`}
+        d="M231 190.5c-3.4 1.8-6.9 3.4-10.5 4.7c-11.5 4.3-23.6 6.5-35.9 6.5c-47.3 0-88.5-32.5-88.5-74.3c.1-11.4 6.4-21.9 16.4-27.3c-42.8 1.8-53.8 46.4-53.8 72.5c0 73.9 68.1 81.4 82.8 81.4c7.9 0 19.8-2.3 27-4.6l1.3-.4c27.6-9.5 51-28.1 66.6-52.8c1.2-1.9.6-4.3-1.2-5.5c-1.3-.8-2.9-.9-4.2-.2"
+        opacity=".35"
+      />
+      <path
+        fill={`url(#${uid}SVGaPqZBebW)`}
+        d="M105.7 241.4c-8.9-5.5-16.6-12.8-22.7-21.3c-26.3-36-18.4-86.5 17.6-112.8c3.8-2.7 7.7-5.2 11.9-7.2c3.1-1.5 8.4-4.1 15.5-4c10.1.1 19.6 4.9 25.7 13c4 5.4 6.3 11.9 6.4 18.7c0-.2 24.5-79.6-80-79.6c-43.9 0-80 41.7-80 78.2c-.2 19.3 4 38.5 12.1 56c27.6 58.8 94.8 87.6 156.4 67.1c-21.1 6.6-44.1 3.7-62.9-8.1"
+      />
+      <path
+        fill={`url(#${uid}SVGVG94vbPK)`}
+        d="M105.7 241.4c-8.9-5.5-16.6-12.8-22.7-21.3c-26.3-36-18.4-86.5 17.6-112.8c3.8-2.7 7.7-5.2 11.9-7.2c3.1-1.5 8.4-4.1 15.5-4c10.1.1 19.6 4.9 25.7 13c4 5.4 6.3 11.9 6.4 18.7c0-.2 24.5-79.6-80-79.6c-43.9 0-80 41.7-80 78.2c-.2 19.3 4 38.5 12.1 56c27.6 58.8 94.8 87.6 156.4 67.1c-21.1 6.6-44.1 3.7-62.9-8.1"
+        opacity=".41"
+      />
+      <path
+        fill={`url(#${uid}SVGw2d8JdCl)`}
+        d="M152.3 148.9c-.8 1-3.3 2.5-3.3 5.7c0 2.6 1.7 5.1 4.7 7.2c14.4 10 41.5 8.7 41.6 8.7c10.7 0 21.1-2.9 30.3-8.3c18.8-11 30.4-31.1 30.4-52.9c
```

**File**: `apps/web/src/features/icon/icons/firefox.tsx` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+'use client';
+
+import { useId } from 'react';
+
+import { cn } from '@/lib/utils';
+
+/** Firefox brand mark, full colour. Source: gilbarbara/logos (CC0), `logos:firefox`. */
+export const Firefox = ({ className }: { className?: string }) => {
+  // Gradient ids are per instance, so two marks on one page never share a definition.
+  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
+  return (
+    <svg
+      viewBox="0 0 256 265"
+      xmlns="http://www.w3.org/2000/svg"
+      aria-hidden="true"
+      className={cn('size-4', className)}
+    >
+      <defs>
+        <radialGradient
+          id={`${uid}SVGyidrs6Xz`}
+          cx="-7907.187"
+          cy="-8515.121"
+          r="80.797"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".129" stopColor="#ffbd4f" />
+          <stop offset=".186" stopColor="#ffac31" />
+          <stop offset=".247" stopColor="#ff9d17" />
+          <stop offset=".283" stopColor="#ff980e" />
+          <stop offset=".403" stopColor="#ff563b" />
+          <stop offset=".467" stopColor="#ff3750" />
+          <stop offset=".71" stopColor="#f5156c" />
+          <stop offset=".782" stopColor="#eb0878" />
+          <stop offset=".86" stopColor="#e50080" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVG0IVpgbgM`}
+          cx="-7936.711"
+          cy="-8482.089"
+          r="80.797"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".3" stopColor="#960e18" />
+          <stop offset=".351" stopColor="#b11927" stopOpacity=".74" />
+          <stop offset=".435" stopColor="#db293d" stopOpacity=".343" />
+          <stop offset=".497" stopColor="#f5334b" stopOpacity=".094" />
+          <stop offset=".53" stopColor="#ff3750" stopOpacity="0" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVG5bHMjbfc`}
+          cx="-7926.97"
+          cy="-8533.457"
+          r="58.534"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".132" stopColor="#fff44f" />
+          <stop offset=".252" stopColor="#ffdc3e" />
+          <stop offset=".506" stopColor="#ff9d12" />
+          <stop offset=".526" stopColor="#ff980e" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGEHoaNdMW`}
+          cx="-7945.648"
+          cy="-8460.984"
+          r="38.471"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".353" stopColor="#3a8ee6" />
+          <stop offset=".472" stopColor="#5c79f0" />
+          <stop offset=".669" stopColor="#9059ff" />
+          <stop offset="1" stopColor="#c139e6" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVG6OUB2b6N`}
+          cx="-7935.62"
+          cy="-8491.546"
+          r="20.397"
+          gradientTransform="matrix(3.21411 -.77707 .90934 3.76302 33365.914 25904.014)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".206" stopColor="#9059ff" stopOpacity="0" />
+          <stop offset=".278" stopColor="#8c4ff3" stopOpacity=".064" />
+          <stop offset=".747" stopColor="#7716a8" stopOpacity=".45" />
+          <stop offset=".975" stopColor="#6e008b" stopOpacity=".6" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGfyXvUXoB`}
+          cx="-7937.731"
+          cy="-8518.427"
+          r="27.676"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset="0" stopColor="#ffe226" />
+          <stop offset=".121" stopColor="#ffdb27" />
+          <stop offset=".295" stopColor="#ffc82a" />
+          <stop offset=".502" stopColor="#ffa930" />
+          <stop offset=".732" stopColor="#ff7e37" />
+          <stop offset=".792" stopColor="#ff7139" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGT2ddtPSF`}
+          cx="-7915.977"
+          cy="-8535.981"
+          r="118.081"
+          gradientTransform="translate(26367.938 28186.305)scale(3.3067)"
+          gradientUnits="userSpaceOnUse"
+        >
+          <stop offset=".113" stopColor="#fff44f" />
+          <stop offset=".456" stopColor="#ff980e" />
+          <stop offset=".622" stopColor="#ff5634" />
+          <stop offset=".716" stopColor="#ff3647" />
+          <stop offset=".904" stopColor="#e31587" />
+        </radialGradient>
+        <radialGradient
+          id={`${uid}SVGH7WrGcHb`}
+          cx="-7927.165"
+          cy="-8522.859"
+          r="86.499"
+          gradientTransform="matrix(.3472 3.29017 -2.15928 .22816 -15491.597 28008.376)"
+          
```

---

### Incident Patch 8: `eeff928f` (2026-10-05)
**Commit Message**: fix(config-releases): an unbuildable or quarantined tip never silently drops a session's config (#9187)

## Summary

With the project flag `config_releases` on, a base-branch config the API
could not build silently dropped every session of the project to the
image default. The causes: an archive over 4 MiB, a selected plugin that
is missing, or a git error. A project quarantine was equally silent.
This PR makes both cases fall back to the last proven release and state
why. It raises the archive cap to 32 MiB and ships root `skills/` and
the pi dir for a project that has no OpenCode config dir.

Found by testing the flag end to end on a local stack with real Platinum
boxes: 3 projects, 14 sessions, OpenCode and pi.

### Defects found (all reproduced on real boxes before the fix)

| # | Defect | Before (measured) | After (measured) |
|---|---|---|---|
| 1 | A tip the API cannot build (one 5.5 MB file under `skills/`
crossed 4 MiB) | Running and new sessions swap to the image default:
tools 25 → 14, skills 22 → 1, no plugin. Health `proven: true,
fallback_reason: null`. `GET /config` `desired_release_id: null`,
`stale: true` forever. "Reload config" answers "already current". The
popo

**File**: `.agents/skills/learnings/MEMORY.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ Open the entry for the incident, the trigger surface, and the enforcement.
 
 Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 
+- `2026-10-05 14:42:44Z` [Never let a config release the API cannot build replace a session's running config](entries/2026-10-05T144244Z-never-let-a-config-release-the-api-cannot-build-replace-a-se.md)
 - `2026-10-05 13:59:15Z` [Set the core size to zero in every sandbox shell: a crash dump carries the agent's whole environment](entries/2026-10-05T135915Z-set-the-core-size-to-zero-in-every-sandbox-shell-a-crash-dum.md)
 - `2026-10-05 10:19:14Z` [Treat a provider pause as temporary: a cooling key or account stays servable, and it rests until the provider's own reset time](entries/2026-10-05T101914Z-treat-a-provider-pause-as-temporary-a-cooling-key-or-account.md)
 - `2026-10-05 00:11:46Z` [When you rename a migration, update every file that names the old filename](entries/2026-10-05T001146Z-when-you-rename-a-migration-update-every-file-that-names-the.md)
```

**File**: `.agents/skills/learnings/entries/2026-10-05T144244Z-never-let-a-config-release-the-api-cannot-build-replace-a-se.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+---
+recorded: 2026-10-05T14:42:44Z
+incident_date: 2026-10-05
+---
+# Never let a config release the API cannot build replace a session's running config
+
+**Rule:** A descriptor with `release_id: null` and a reason means "no release".
+The daemon keeps its running config. The API assigns the project's last proven
+release and states why in `fallback_reason`. Never derive a release ID from a
+failed build, and never report a step-down with `fallback_reason: null`.
+
+**Trigger surface:** editing `apps/api/src/config-releases/builder.ts` or
+`desired.ts`, `effectiveReleaseId` in the daemon's
+`services/config-release/release.ts`, or any path that returns a release
+without an archive.
+
+**Incident:** 2026-10-05, found while testing `config_releases` on a local
+stack with real Platinum boxes. One 5.5 MB file under `skills/` pushed the
+composed archive over the 4 MiB cap. The builder answered `release_id: null`,
+`config_tree_id: null` plus governance. The daemon derived a governance-only ID
+and swapped every running session of the project, OpenCode and pi, to the
+image default: 25 → 14 tools, 22 → 1 skill, no plugin. Health said `proven:
+true, fallback_reason: null`. `GET /config` said `stale: true` forever,
+"Reload config" answered "already current", and each prompt paid ~2.2 s of
+convergence. The same silence hid a project quarantine: new sessions ran an
+older commit and the API reported `stale: false`, no reason.
+
+**Enforcement:** `quarantine.test.ts` ("an unbuildable tip assigns the last
+proven release and says why"), `config-release-boot.test.ts` ("a descriptor
+with no release keeps the last proven copy and states the API reason"),
+`config-release-converge.test.ts` ("no release and no tree").
```

**File**: `apps/api/src/config-releases/ROLLOUT.md` (modified, +32/-7)
```diff
@@ -84,13 +84,20 @@ unbootable.
 
 **API side — which release a project's sessions get:**
 1. The base branch's current tip (the normal case, always).
-2. If that release fails in ≥ `PROJECT_QUARANTINE_SESSIONS` (2) **distinct**
-   sessions (`kortix.config_release_failures`), the project quarantines that
-   release ID and falls back to the newest release of the same variant any
-   session has **proven** (`kortix.config_releases.proven_at`).
-   Quarantine is per release ID: a new base commit produces a new release ID
-   and is assignable again immediately.
-3. If the flag is off for the project: no release is assigned at all; the session reads its workspace config
+2. If the tip's release **cannot be built** (the archive is over the limit, a
+   plugin an agent selects is missing, a git error), or it fails in ≥
+   `PROJECT_QUARANTINE_SESSIONS` (2) **distinct** sessions
+   (`kortix.config_release_failures`), the project assigns the newest release
+   of the same variant any session has **proven**
+   (`kortix.config_releases.proven_at`). Quarantine is per release ID: a new
+   base commit produces a new release ID and is assignable again immediately.
+   `GET /config` then reports `release.fallback_reason` ("The base branch's
+   latest agent config (commit …) could not be built: … / failed to load in 2
+   sessions: …. Sessions run the last config that loaded (commit …).") and the
+   web header shows "Config failed to load" with that reason.
+3. With nothing proven to fall back to, an unbuildable tip is assigned no
+   release: each box keeps what it runs, and `fallback_reason` says why.
+4. If the flag is off for the project: no release is assigned at all; the session reads its workspace config
    directory — pre-release behavior.
 
 **The meta coordinator is the exception.** A session whose agent is `meta`
@@ -114,6 +121,24 @@ S3 read/write failure (`[config-releases] store … failed`) makes the archive
 route stream a fresh build from the Git mirror instead of failing the
 request. The store is a cache; the Git mirror is always the source of truth.
 
+## Limits
+
+- The release archive is capped at 32 MiB gzip and 128 MiB uncompressed
+  (`MAX_CONFIG_ARCHIVE_BYTES` / `MAX_CONFIG_TAR_BYTES` in `release-tree.ts`,
+  matched by the daemon's `descriptor.ts` / `boot-config.ts`). It holds the
+  OpenCode config dir, the root `skills/` and the pi config dir. A daemon
+  older than the 32 MiB cap refuses a descriptor over 4 MiB and keeps its
+  running config until it updates.
+- A release holds only those three trees. A config file that points OUTSIDE
+  them — an `instructions` entry such as `../../rules/RULES.md`, or a tool that
+  imports `../../../shared/x` — resolves with the flag off (the checkout has
+  the file) and does not with the flag on. A missing instruction is skipped
+  silently by OpenCode. A missing import fails every tool, so the release
+  fails its proof and the session keeps its last proven config. Keep such
+  files inside the config dir.
+- A project with no OpenCode config dir still gets a release when it has root
+  `skills/` or a pi config dir: they ship on an empty OpenCode config dir.
+
 ## Retention
 
 `KORTIX_CONFIG_ARCHIVE_RETAIN_PER_PROJECT=0` in prod means **the API never
```

**File**: `apps/api/src/config-releases/__tests__/fakes.ts` (modified, +4/-0)
```diff
@@ -40,6 +40,10 @@ export class MemoryConfigReleaseLedger implements ConfigReleaseLedger {
   async quarantined(projectId: string, releaseIds: string[], threshold: number) {
     return new Set(releaseIds.filter((id) => this.failingSessions(projectId, id) >= threshold));
   }
+  async failureReason(projectId: string, releaseId: string) {
+    const rows = this.failures.filter((row) => row.projectId === projectId && row.releaseId === releaseId && row.reason);
+    return rows.at(-1)?.reason ?? null;
+  }
   async lastProven(projectId: string, variant: string, threshold: number) {
     const rows = this.assigned
       .filter(
```

**File**: `apps/api/src/config-releases/builder.test.ts` (modified, +30/-3)
```diff
@@ -21,6 +21,7 @@ import {
   configReleaseId,
   isTreeObject,
   listConfigFiles,
+  MAX_CONFIG_ARCHIVE_BYTES,
   storeConfigArchive,
   toDescriptor,
 } from './builder';
@@ -491,6 +492,29 @@ describe('buildConfigRelease', () => {
     expect(release.compiled_governance).not.toBeNull();
   });
 
+  // 2026-10-05: a pi project with no OpenCode config dir got a governance-only
+  // release, and pi lost its root skills and its own config dir.
+  test('a commit with no OpenCode config dir still releases the root skills and the pi config dir', async () => {
+    const sha = commit(
+      {
+        'kortix.yaml': MANIFEST('first'),
+        'skills/demo/SKILL.md': '---\nname: demo\n---\nDemo skill.\n',
+        'harnesses/pi/skills/native/SKILL.md': '---\nname: native\n---\nA pi skill.\n',
+      },
+      'pi only',
+    );
+    const release = await buildConfigRelease(project, sha, 'project', { store });
+    expect(release.reason).toBeNull();
+    expect(release.release_id).toMatch(/^[0-9a-f]{64}$/);
+    expect(release.archive).not.toBeNull();
+    expect(release.config_dir).toBeString();
+    expect(release.files!.map(([path]) => path).sort()).toEqual(['pi/skills/native/SKILL.md', 'skills/demo/SKILL.md']);
+    expect(store.objects.size).toBe(1);
+    const tar = gunzipSync([...store.objects.values()][0]!).toString('latin1');
+    expect(tar).toContain('skills/demo/SKILL.md');
+    expect(tar).toContain('pi/skills/native/SKILL.md');
+  });
+
   // Prod 2026-10-02: the meta coordinator's box has no project checkout and its
   // image has no `bun`. It was assigned the `project` release, could not install
   // the tool dependencies, and its failures quarantined that release for every
@@ -515,16 +539,19 @@ describe('buildConfigRelease', () => {
       {
         'kortix.yaml': MANIFEST('first'),
         '.kortix/opencode/opencode.json': '{}\n',
-        // Random bytes do not compress: the gzip stays above 4 MiB.
-        '.kortix/opencode/blob.bin': randomBytes(4 * 1024 * 1024 + 4096),
+        // Random bytes do not compress: the gzip stays above the limit.
+        '.kortix/opencode/blob.bin': randomBytes(MAX_CONFIG_ARCHIVE_BYTES + 4096),
       },
       'huge',
     );
     const release = await buildConfigRelease(project, sha, 'project', { store });
     expect(release.release_id).toBeNull();
     expect(release.config_tree_id).toMatch(/^[0-9a-f]{40}$/);
-    expect(release.reason).toContain('exceeds the 4194304-byte archive limit');
+    expect(release.reason).toContain(`exceeds the ${MAX_CONFIG_ARCHIVE_BYTES}-byte archive limit`);
     expect(store.objects.size).toBe(0);
+    // The answer is a fact of the commit: every box's descriptor request (one
+    // per minute per box) must not rebuild and gzip the whole tree again.
+    expect(await buildConfigRelease(project, sha, 'project', { store })).toBe(release);
 
     const mirror = await refreshMirror(project);
     await expect(buildConfigArchive(mirror, release.config_tree_id!, 1024)).rejects.toBeInstanceOf(
```

**File**: `apps/api/src/config-releases/builder.ts` (modified, +17/-4)
```diff
@@ -200,6 +200,17 @@ export async function storeConfigArchive(
   return outcome;
 }
 
+/**
+ * Releases over the archive limit. Unlike every other release without an ID,
+ * the answer is a fact of the commit, so it is cached: a box asks once a
+ * minute, and each miss tars and gzips the whole tree again (~1.5 s for 36 MB).
+ */
+const tooLargeReleases = new WeakSet<ConfigRelease>();
+function tooLarge(release: ConfigRelease): ConfigRelease {
+  tooLargeReleases.add(release);
+  return release;
+}
+
 /** The `none` variant's compiled governance: a valid, empty OpenCode config. */
 const EMPTY_GOVERNANCE = '{}';
 
@@ -291,12 +302,12 @@ async function build(
     }
   } catch (error) {
     if (error instanceof ConfigArchiveTooLargeError) {
-      return {
+      return tooLarge({
         ...withGovernance,
         config_dir: configDir,
         config_tree_id: composed ? null : treeId,
         reason: `config dir ${configDir}${composed ? ` with ${SKILLS_DIR}/ and the pi config dir` : ''} exceeds the ${MAX_CONFIG_ARCHIVE_BYTES}-byte archive limit`,
-      };
+      });
     }
     throw error;
   }
@@ -340,8 +351,10 @@ export async function buildConfigRelease(
   const next = build(project, commit, variant, store)
     .then((release) => {
       // A release with a reason can be transient (a compile read that failed).
-      // Only complete releases are cached.
-      if (release.release_id) bumpBounded(releases, cacheKey, { release, at: Date.now() }, MAX_CACHED_RELEASES);
+      // Only complete releases, and the deterministic over-limit answer, are cached.
+      if (release.release_id || tooLargeReleases.has(release)) {
+        bumpBounded(releases, cacheKey, { release, at: Date.now() }, MAX_CACHED_RELEASES);
+      }
       return release;
     })
     .finally(() => inflight.delete(cacheKey));
```

**File**: `apps/api/src/config-releases/desired.ts` (modified, +51/-23)
```diff
@@ -6,10 +6,11 @@
  * The desired release is ALWAYS the base branch's current tip. There is no
  * per-session mode: a session that edited its config dir under `/workspace`
  * still receives the base release, and its edits reach the box only once they
- * are pushed to the base branch. The one exception is the project quarantine,
- * which assigns the last release a session proved when the tip's release has
- * failed in enough sessions — a bad base config must not make sessions
- * unbootable.
+ * are pushed to the base branch. The one exception is a tip that cannot serve:
+ * a release the builder could not build, or one the project quarantined after
+ * it failed in enough sessions. Then the last release a session proved is
+ * assigned, with `fallbackReason` saying why — a bad base config must neither
+ * make sessions unbootable nor read as up to date.
  */
 
 import { resolveCommitSha } from '../projects/git/commits';
@@ -72,6 +73,13 @@ export interface DesiredRelease {
   descriptor: ConfigReleaseDescriptor;
   /** The base release ID the project quarantined, when a fallback replaced it. */
   quarantinedReleaseId: string | null;
+  /**
+   * Why this session does not get the base tip's release: the tip could not
+   * be built, or the project quarantined it. Null when the tip is assigned.
+   * `GET /config` shows it as the release's `fallback_reason`, so a session on
+   * an older release never reads as up to date.
+   */
+  fallbackReason: string | null;
   /** The variant the release was built for, after the agent resolution. */
   variant: ConfigReleaseVariant;
 }
@@ -104,10 +112,11 @@ export function ledgerVariant(variant: ConfigReleaseVariant, repositoryAccess: b
 }
 
 /**
- * Resolve the base tip, build its release, and apply the project quarantine. A quarantined release is replaced by the newest release
- * of the same variant that any session proved; with none, the quarantined
- * release is assigned unchanged and each box keeps its own last proven
- * config through its box quarantine and fallback chain.
+ * Resolve the base tip, build its release, and apply the fallback. An
+ * unbuildable or quarantined tip is replaced by the newest release of the same
+ * variant that any session proved. With none, a quarantined tip is assigned
+ * unchanged and each box keeps its own last proven config through its box
+ * quarantine and fallback chain; an unbuildable tip is assigned no release.
  */
 export async function resolveDesiredRelease(
   input: DesiredReleaseInput,
@@ -169,28 +178,47 @@ export async function resolveDesiredRelease(
   const base = await deps.build(input.project, baseSha, variant);
   let descriptor = toDescriptor(base, { repositoryAccess: input.repositoryAccess, agentRepoint });
   let quarantinedReleaseId: string | null = null;
+  let fallbackReason: string | null = null;
   const variantKey = ledgerVariant(variant, input.repositoryAccess);
   const projectId = input.project.projectId;
+  const tip = `The base branch's latest agent config (commit ${baseSha.slice(0, 12)})`;
 
-  if (descriptor.release_id) {
-    try {
+  try {
+    // Why the tip's release cannot be assigned, or null when it can. A tip the
+    // builder could not build (an archive over the limit, a missing plugin, a
+    // git error) has no release ID; a tip that failed in enough sessions is
+    // quarantined. Either way the project's last proven release serves.
+    let unusable: string | null = null;
+    if (!descriptor.release_id) {
+      unusable = `${tip} could not be built: ${descriptor.reason ?? 'no reason given'}`;
+    } else {
       const quarantined = await deps.ledger.quarantined(projectId, [descriptor.release_id], PROJECT_QUARANTINE_SESSIONS);
       if (quarantined.has(descriptor.release_id)) {
-        const fallback = await deps.ledger.lastProven(projectId, variantKey, PROJECT_QUARANTINE_SESSIONS);
-        if (fallback && fallback.releaseId !== descriptor.release_id) {
-          const rebuilt = await deps.build(input.project, fallback.sourceCommit, variant);
-          const candidate = toDescriptor(rebuilt, { repositoryAccess: input.repositoryAccess, agentRepoint });
-          // Assign the fallback only when the rebuild reproduces the proven ID.
-          if (candidate.release_id === fallback.releaseId) {
-            quarantinedReleaseId = descriptor.release_id;
-            descriptor = candidate;
-          }
+        const reported = await deps.ledger.failureReason(projectId, descriptor.release_id);
+        unusable = `${tip} failed to load in ${PROJECT_QUARANTINE_SESSIONS} sessions${reported ? `: ${reported}` : ''}`;
+      }
+    }
+    if (unusable) {
+      const fallback = await deps.ledger.lastProven(projectId, variantKey, PROJECT_QUARANTINE_SESSIONS);
+      if (fallback && fallback.releaseId !== descriptor.release_id) {
+        const rebuilt = await deps.build(input.project, fallback.sourceCommit, variant);
+        const candidate = toDescriptor(rebuilt, { reposit
```

**File**: `apps/api/src/config-releases/quarantine.test.ts` (modified, +41/-0)
```diff
@@ -59,10 +59,14 @@ const idAt = (commit: string) => releaseAt(commit).release_id!;
 let ledger: MemoryConfigReleaseLedger;
 let tip = C1;
 const builds: string[] = [];
+/** Commits whose release the builder cannot build, with the builder's reason. */
+const unbuildable = new Map<string, string>();
 const deps = (): DesiredReleaseDeps => ({
   ledger,
   build: async (_project, commit) => {
     builds.push(commit);
+    const reason = unbuildable.get(commit);
+    if (reason) return { ...releaseAt(commit), release_id: null, config_tree_id: null, archive: null, files: null, reason };
     return releaseAt(commit);
   },
   resolveBase: async () => tip,
@@ -99,6 +103,7 @@ beforeEach(() => {
   ledger = new MemoryConfigReleaseLedger();
   tip = C1;
   builds.length = 0;
+  unbuildable.clear();
   __clearQuarantineMemoForTests();
 });
 
@@ -128,6 +133,42 @@ describe('project quarantine', () => {
     expect(third.descriptor.release_id).toBe(idAt(C1));
     expect(third.descriptor.source_commit).toBe(C1);
     expect(third.baseSha).toBe(C2);
+    // The quarantine is stated, with what the daemons reported, so a session
+    // running the older release does not read as up to date.
+    expect(third.fallbackReason).toContain(C2.slice(0, 12));
+    expect(third.fallbackReason).toContain('failed to load in 2 sessions');
+    expect(third.fallbackReason).toContain('replacement did not serve GET /agent within 90 s');
+    expect(third.fallbackReason).toContain(C1.slice(0, 12));
+  });
+
+  test('a healthy tip states no fallback', async () => {
+    expect((await desired()).fallbackReason).toBeNull();
+  });
+
+  // 2026-10-05: a tip the builder cannot build (archive over the limit, a
+  // missing plugin, a git error) used to reach the box as `release_id: null`
+  // plus governance. The daemon derived a governance-only ID from it and ran
+  // the image default: no project tools, skills or plugins, `fallback_reason:
+  // null`, and `stale: true` that no reload could clear.
+  test('an unbuildable tip assigns the last proven release and says why', async () => {
+    await desired();
+    await report(S1, { running: idAt(C1) });
+    tip = C2;
+    unbuildable.set(C2, 'config dir harnesses/opencode exceeds the 33554432-byte archive limit');
+    const result = await desired();
+    expect(result.descriptor.release_id).toBe(idAt(C1));
+    expect(result.descriptor.source_commit).toBe(C1);
+    expect(result.baseSha).toBe(C2);
+    expect(result.fallbackReason).toContain(C2.slice(0, 12));
+    expect(result.fallbackReason).toContain('exceeds the 33554432-byte archive limit');
+    expect(result.fallbackReason).toContain(C1.slice(0, 12));
+  });
+
+  test('an unbuildable tip with no proven release stays unassigned and says why', async () => {
+    unbuildable.set(C1, 'OpenCode plugin not found in harnesses/opencode/plugins: x.ts');
+    const result = await desired();
+    expect(result.descriptor.release_id).toBeNull();
+    expect(result.fallbackReason).toContain('OpenCode plugin not found');
   });
 
   test('the fallback is the newest proven release, never an unproven or quarantined one', async () => {
```

---

### Incident Patch 9: `49d08461` (2026-10-05)
**Commit Message**: feat(web): redesign authenticator app enrollment in Security settings (#9185)

## Summary

Enrolling an authenticator app from **Settings → Security** used an
inline box with a QR code, a raw secret, and a plain text input. This PR
replaces it with a focused dialog and cleans up the two-factor row.

- **Enrollment dialog.** The left panel shows the QR code and the setup
key, grouped in fours, with a copy button at the right edge. The right
panel holds a six-cell code field that submits on the sixth digit. Paste
and `one-time-code` autofill work because the six cells share one native
input. Verify stays disabled until six digits are entered.
- **Two-factor row.** The "Session verified" / "Enrolled" pill is
replaced by an "On · Asked at sign-in and before sensitive changes"
status line. Verified factor rows drop their status badge. Only an
unverified factor keeps one.
- **Abandoned enrollments.** A reload or closed tab used to leave an
unverified TOTP factor in the list permanently. It also held the
same-day friendly name. `startEnroll` in `use-mfa.ts` now removes
unverified TOTP factors before it enrolls a new one.
- **Local Supabase.** `supabase/config.toml` enables TOTP enroll and

**File**: `apps/web/src/features/workspace/settings/tabs/security-tab.test.tsx` (modified, +26/-3)
```diff
@@ -1,6 +1,6 @@
 import { describe, expect, test } from 'bun:test';
 import { renderToStaticMarkup } from 'react-dom/server';
-import { FactorRow, SecurityTabView, totpQrSrc } from './security-tab';
+import { FactorRow, SecurityTabView, formatSecret, totpQrSrc } from './security-tab';
 
 const headings = (html: string): string[] =>
   [...html.matchAll(/<h([23])[^>]*>([^<]*)<\/h\1>/g)].map((m) => m[2]);
@@ -149,15 +149,16 @@ describe('totpQrSrc', () => {
 });
 
 describe('FactorRow', () => {
-  test('verified authenticator renders name, type, and verified badge', () => {
+  test('verified authenticator renders name and type, with no status badge', () => {
     const factorHtml = renderToStaticMarkup(
       <FactorRow
         factor={{ id: 'f1', friendly_name: 'My phone', factor_type: 'totp', status: 'verified' }}
         onRemove={() => {}}
       />,
     );
     expect(factorHtml).toContain('My phone');
-    expect(factorHtml).toContain('verified');
+    expect(factorHtml).toContain('Authenticator app (TOTP)');
+    expect(factorHtml).not.toContain('>verified<');
     expect(factorHtml).toContain('Remove factor');
   });
 
@@ -172,3 +173,25 @@ describe('FactorRow', () => {
     expect(factorHtml).toContain('unverified');
   });
 });
+
+describe('formatSecret', () => {
+  test('groups a TOTP secret in fours', () => {
+    expect(formatSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
+    expect(formatSecret('ABCDEF')).toBe('ABCD EF');
+    expect(formatSecret('GEMUX5K72V6OB2V2N3GNFH4O5U5NXCWS')).toBe(
+      'GEMU X5K7 2V6O B2V2\nN3GN FH4O 5U5N XCWS',
+    );
+  });
+});
+
+describe('two-factor row status', () => {
+  test('a verified factor shows the On status, never the old session badge', () => {
+    const out = renderToStaticMarkup(
+      <SecurityTabView
+        factors={[{ id: 'f1', friendly_name: 'My phone', factor_type: 'totp', status: 'verified' }]}
+      />,
+    );
+    expect(out).toContain('On · Asked at sign-in and before sensitive changes');
+    expect(out).not.toContain('Session verified');
+  });
+});
```

**File**: `apps/web/src/features/workspace/settings/tabs/security-tab.tsx` (modified, +185/-98)
```diff
@@ -26,20 +26,23 @@ import { useLocale, useTranslations } from '@/i18n/use-translations';
 import {
   KeyIcon as KeyRound,
   PlusIcon as Plus,
-  ShieldCheckIcon as ShieldCheck,
   ShieldWarningIcon as ShieldWarning,
   DeviceMobileIcon as Smartphone,
   TrashIcon as Trash2,
   WarningIcon as Warning,
 } from '@phosphor-icons/react';
 import { useMutation, useQuery } from '@tanstack/react-query';
+import { useEffect } from 'react';
+
+import { CopyButton } from '@/components/markdown/copy-button';
 
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { ConfirmDialog } from '@/components/ui/confirm-dialog';
+import { SessionDotMatrix } from '@/components/ui/dot-matrix/session-dot-matrix';
 import { InfoBanner } from '@/components/ui/info-banner';
-import { Input } from '@/components/ui/input';
-import { Label } from '@/components/ui/label';
+import { Modal, ModalContent, ModalDescription, ModalTitle } from '@/components/ui/modal';
+import { inputSurfaceClasses, inputTransitionClasses } from '@/components/ui/input';
 import Loading from '@/components/ui/loading';
 import { SettingsRow, SettingsRowGroup } from '@/components/ui/settings-row';
 import { SettingsSubsectionHeader } from '@/components/ui/settings-subsection-header';
@@ -91,13 +94,13 @@ export function FactorRow({
         </div>
       </div>
       <div className="flex shrink-0 items-center gap-2">
-        <Badge variant={factor.status === 'verified' ? 'kortix' : 'outline'} size="xs">
-          {factor.status === 'verified'
-            ? copy.verified
-            : factor.status === 'unverified'
-              ? copy.unverified
-              : factor.status}
-        </Badge>
+        {/* A verified factor is the normal case and needs no label; only an
+            unfinished one is called out. */}
+        {factor.status === 'verified' ? null : (
+          <Badge variant="outline" size="xs">
+            {factor.status === 'unverified' ? copy.unverified : factor.status}
+          </Badge>
+        )}
         <Button
           variant="ghost"
           size="icon"
@@ -111,13 +114,142 @@ export function FactorRow({
   );
 }
 
+const CODE_LENGTH = 6;
+
+/** Groups a TOTP secret in fours, the way authenticator apps print it,
+ *  four groups to a line so a 32-character key splits into two even rows. */
+export function formatSecret(secret: string): string {
+  return secret
+    .replace(/(.{4})(?=.)/g, '$1 ')
+    .replace(/((?:\S{4} ){3}\S{4}) /g, '$1\n');
+}
+
+/** The enrollment dialog: scan on the left, type the code on the right.
+ *  One real input sits over six drawn cells, so paste, autofill
+ *  (`one-time-code`) and screen readers all see a single field. The
+ *  container verifies as soon as the sixth digit lands. */
+export function EnrollDialog({
+  enrolling,
+  code,
+  onCodeChange,
+  onVerify,
+  isVerifying,
+  onCancel,
+  copy,
+}: {
+  enrolling: EnrollingFactor | null;
+  code: string;
+  onCodeChange: (value: string) => void;
+  onVerify: () => void;
+  isVerifying: boolean;
+  onCancel: () => void;
+  copy: SecurityTabCopy;
+}) {
+  return (
+    <Modal open={enrolling !== null} onOpenChange={(open) => !open && onCancel()}>
+      <ModalContent
+        // modal.tsx centres only from `lg`. From `sm` (640px, every tablet in
+        // portrait) this is the same centred two-column window as desktop;
+        // phones keep the bottom sheet.
+        className="overflow-hidden border-0 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-auto sm:w-[calc(100%-3rem)] sm:max-w-[46rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl lg:h-auto lg:max-w-[46rem]"
+        modalClassName="space-y-0"
+      >
+        {enrolling ? (
+          <div className="flex flex-col sm:flex-row">
+            {/* `dark` scopes the dark tokens to this panel in both themes. */}
+            <div className="dark bg-background text-foreground border-border flex shrink-0 flex-col gap-5 border-b p-6 sm:w-[44%] sm:gap-6 sm:border-e sm:border-b-0 md:w-[21rem]">
+              <div className="space-y-1 pe-8 sm:pe-0">
+                <h3 className="text-lg font-semibold tracking-tight">{copy.scanTitle}</h3>
+                <p className="text-muted-foreground text-sm text-pretty">{copy.scanDescription}</p>
+              </div>
+              {/* biome-ignore lint/performance/noImgElement: QR is an inline SVG data URL, next/image adds nothing */}
+              <img
+                src={totpQrSrc(enrolling.qr)}
+                alt={copy.qrAlt}
+                className="aspect-square w-full max-w-64 self-center rounded-lg bg-white p-3 sm:max-w-none"
+              />
+            </div>
+
+            <div className="flex min-w-0 flex-1 flex-col gap-6 p-6">
+              <div className="space-y-1 pe-8">
+                <ModalTitle className="text-lg leading-7 tracking-tight">{copy.codeTitle}</ModalTitle>
+                <ModalDescription className="text-pretty">{copy.code
```

**File**: `apps/web/src/hooks/account/use-mfa.ts` (modified, +19/-2)
```diff
@@ -63,6 +63,15 @@ export function useMfa() {
 
   const startEnrollMutation = useMutation({
     mutationFn: async () => {
+      // An unverified factor is an enrollment someone walked away from (a
+      // closed tab, a reload). It can never sign anyone in, and it holds the
+      // friendly name the new one wants, so clear it before starting over.
+      const { data: listed } = await supabase.auth.mfa.listFactors();
+      for (const stale of listed?.all ?? []) {
+        if (stale.factor_type === 'totp' && stale.status === 'unverified') {
+          await supabase.auth.mfa.unenroll({ factorId: stale.id });
+        }
+      }
       const { data, error } = await supabase.auth.mfa.enroll({
         factorType: 'totp',
         friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
@@ -115,9 +124,17 @@ export function useMfa() {
 
   const cancelEnroll = () => {
     // Abandoning enrollment leaves an unverified factor behind — clean it up
-    // so the list doesn't accumulate ghosts.
-    if (enrolling) removeFactorMutation.mutate(enrolling.factorId);
+    // so the list doesn't accumulate ghosts. Silently: the person cancelled,
+    // they did not remove a factor, so no "Factor removed" toast. A failed
+    // cleanup is harmless — the next enrollment clears unverified factors.
+    if (enrolling) {
+      void supabaseMFAService
+        .unenrollFactor(enrolling.factorId)
+        .catch(() => {})
+        .finally(() => queryClient.invalidateQueries({ queryKey: MFA_FACTORS_QUERY_KEY }));
+    }
     setEnrolling(null);
+    setEnrollCode('');
   };
 
   return {
```

**File**: `apps/web/translations/de.json` (modified, +7/-7)
```diff
@@ -613,20 +613,20 @@
       "twoFactorDescription": "Ein zweiter Faktor sorgt dafür, dass Ihr Konto auch dann sicher bleibt, wenn Ihre Anmeldung gefährdet ist.",
       "authenticatorApp": "Authentifizierungs-App",
       "authenticatorDescription": "Fügen Sie als zweiten Faktor eine Authentifizierungs-App (TOTP) hinzu.",
-      "sessionVerified": "Sitzung bestätigt",
-      "enrolled": "Eingerichtet",
+      "statusOn": "Ein · Abgefragt bei der Anmeldung und vor sensiblen Änderungen",
       "addAuthenticatorApp": "Authentifizierungs-App hinzufügen",
       "factorsLoadFailed": "Ihre Authentifizierungs-Apps konnten nicht geladen werden",
       "retry": "Wiederholen",
       "factorsUnchanged": "Ihre Zwei-Faktor-Einstellungen bleiben unverändert – nur die Liste kann nicht geladen werden.",
       "noFactorEnrolled": "Kein zweiter Faktor eingerichtet",
       "noFactorDescription": "Wenn Ihre Organisation MFA verlangt, können Sie geschützte Aktionen erst wieder ausführen, nachdem Sie hier eine Authentifizierungs-App eingerichtet haben.",
-      "scanTitle": "Scannen Sie mit Ihrer Authentifizierungs-App",
-      "scanDescription": "Verwenden Sie 1Password, Google Authenticator oder eine beliebige TOTP-App – geben Sie dann den angezeigten 6-stelligen Code ein.",
+      "scanTitle": "Mit dem Handy scannen",
+      "scanDescription": "Öffnen Sie eine Authentifizierungs-App und scannen Sie diesen Code.",
       "qrAlt": "QR-Code zur TOTP-Einrichtung",
-      "manualSecret": "Geheimnis zur manuellen Eingabe",
-      "sixDigitCode": "6-stelliger Code",
-      "verifyAndEnable": "Überprüfen und aktivieren",
+      "manualSecret": "Scannen nicht möglich? Diesen Schlüssel eingeben",
+      "codeTitle": "Code eingeben",
+      "codeDescription": "Geben Sie die 6 Ziffern aus Ihrer App ein. Die Prüfung erfolgt automatisch.",
+      "verifyAndEnable": "Bestätigen",
       "cancel": "Abbrechen",
       "removeFactorTitle": "Diesen Faktor entfernen?",
       "removeFactorDescription": "Wenn Ihre Organisation MFA verlangt und dies Ihr einziger bestätigter Faktor ist, können Sie geschützte Aktionen erst wieder ausführen, nachdem Sie einen neuen Faktor eingerichtet haben.",
```

**File**: `apps/web/translations/en.json` (modified, +7/-7)
```diff
@@ -439,20 +439,20 @@
       "twoFactorDescription": "A second factor keeps your account safe even if your sign-in is compromised.",
       "authenticatorApp": "Authenticator app",
       "authenticatorDescription": "Add an authenticator app (TOTP) as a second factor.",
-      "sessionVerified": "Session verified",
-      "enrolled": "Enrolled",
+      "statusOn": "On · Asked at sign-in and before sensitive changes",
       "addAuthenticatorApp": "Add authenticator app",
       "factorsLoadFailed": "Couldn’t load your authenticator apps",
       "retry": "Retry",
       "factorsUnchanged": "Your two-factor settings are unchanged — this is only the list failing to load.",
       "noFactorEnrolled": "No second factor enrolled",
       "noFactorDescription": "If your organization requires MFA, you’ll be blocked from gated actions until you enroll an authenticator here.",
-      "scanTitle": "Scan with your authenticator app",
-      "scanDescription": "Use 1Password, Google Authenticator, or any TOTP app — then enter the 6-digit code it shows.",
+      "scanTitle": "Scan with your phone",
+      "scanDescription": "Open any authenticator app and scan this code.",
       "qrAlt": "TOTP enrollment QR code",
-      "manualSecret": "Manual entry secret",
-      "sixDigitCode": "6-digit code",
-      "verifyAndEnable": "Verify and enable",
+      "manualSecret": "Can’t scan? Enter this key",
+      "codeTitle": "Enter the code",
+      "codeDescription": "Type the 6 digits your app shows. It verifies on its own.",
+      "verifyAndEnable": "Verify",
       "cancel": "Cancel",
       "removeFactorTitle": "Remove this factor?",
       "removeFactorDescription": "If your organization requires MFA and this is your only verified factor, you will be locked out of gated actions until you enroll again.",
```

**File**: `apps/web/translations/es.json` (modified, +7/-7)
```diff
@@ -613,20 +613,20 @@
       "twoFactorDescription": "Un segundo factor mantiene su cuenta segura incluso si su inicio de sesión se ve comprometido.",
       "authenticatorApp": "Aplicación de autenticación",
       "authenticatorDescription": "Agregue una aplicación de autenticación (TOTP) como segundo factor.",
-      "sessionVerified": "Sesión verificada",
-      "enrolled": "Configurado",
+      "statusOn": "Activado · Se pide al iniciar sesión y antes de cambios sensibles",
       "addAuthenticatorApp": "Agregar aplicación de autenticación",
       "factorsLoadFailed": "No se pudieron cargar tus aplicaciones de autenticación",
       "retry": "Reintentar",
       "factorsUnchanged": "Su configuración de dos factores no ha cambiado; esta es solo la lista que no se carga.",
       "noFactorEnrolled": "No hay un segundo factor configurado",
       "noFactorDescription": "Si su organización requiere MFA, no podrá realizar acciones protegidas hasta que configure aquí una aplicación de autenticación.",
-      "scanTitle": "Escanee con su aplicación de autenticación",
-      "scanDescription": "Utilice 1Password, Google Authenticator o cualquier aplicación TOTP y luego ingrese el código de 6 dígitos que muestra.",
+      "scanTitle": "Escanee con su teléfono",
+      "scanDescription": "Abra cualquier aplicación de autenticación y escanee este código.",
       "qrAlt": "Código QR para configurar TOTP",
-      "manualSecret": "Secreto de entrada manual",
-      "sixDigitCode": "código de 6 dígitos",
-      "verifyAndEnable": "Verificar y habilitar",
+      "manualSecret": "¿No puede escanear? Introduzca esta clave",
+      "codeTitle": "Introduzca el código",
+      "codeDescription": "Escriba los 6 dígitos que muestra su aplicación. Se verifica solo.",
+      "verifyAndEnable": "Verificar",
       "cancel": "Cancelar",
       "removeFactorTitle": "¿Eliminar este factor?",
       "removeFactorDescription": "Si su organización requiere MFA y este es su único factor verificado, no podrá realizar acciones protegidas hasta que configure un nuevo factor.",
```

**File**: `apps/web/translations/fr.json` (modified, +7/-7)
```diff
@@ -613,20 +613,20 @@
       "twoFactorDescription": "Un deuxième facteur assure la sécurité de votre compte même si votre connexion est compromise.",
       "authenticatorApp": "Application d'authentification",
       "authenticatorDescription": "Ajoutez une application d'authentification (TOTP) comme deuxième facteur.",
-      "sessionVerified": "Session vérifiée",
-      "enrolled": "Configuré",
+      "statusOn": "Activé · Demandé à la connexion et avant les modifications sensibles",
       "addAuthenticatorApp": "Ajouter une application d'authentification",
       "factorsLoadFailed": "Impossible de charger vos applications d'authentification",
       "retry": "Réessayer",
       "factorsUnchanged": "Vos paramètres à deux facteurs sont inchangés : il s'agit uniquement de la liste qui ne se charge pas.",
       "noFactorEnrolled": "Aucun deuxième facteur configuré",
       "noFactorDescription": "Si votre organisation exige la MFA, vous ne pourrez pas effectuer les actions protégées avant d'avoir configuré une application d'authentification ici.",
-      "scanTitle": "Scannez avec votre application d'authentification",
-      "scanDescription": "Utilisez 1Password, Google Authenticator ou n'importe quelle application TOTP, puis entrez le code à 6 chiffres qu'il affiche.",
+      "scanTitle": "Scannez avec votre téléphone",
+      "scanDescription": "Ouvrez une application d'authentification et scannez ce code.",
       "qrAlt": "Code QR de configuration TOTP",
-      "manualSecret": "Secret de saisie manuelle",
-      "sixDigitCode": "Code à 6 chiffres",
-      "verifyAndEnable": "Vérifier et activer",
+      "manualSecret": "Impossible de scanner ? Saisissez cette clé",
+      "codeTitle": "Saisissez le code",
+      "codeDescription": "Tapez les 6 chiffres affichés par votre application. La vérification est automatique.",
+      "verifyAndEnable": "Vérifier",
       "cancel": "Annuler",
       "removeFactorTitle": "Supprimer ce facteur ?",
       "removeFactorDescription": "Si votre organisation exige la MFA et qu'il s'agit de votre seul facteur vérifié, vous ne pourrez pas effectuer les actions protégées avant d'avoir configuré un nouveau facteur.",
```

**File**: `apps/web/translations/it.json` (modified, +7/-7)
```diff
@@ -613,20 +613,20 @@
       "twoFactorDescription": "Un secondo fattore mantiene il tuo account al sicuro anche se il tuo accesso è compromesso.",
       "authenticatorApp": "Applicazione di autenticazione",
       "authenticatorDescription": "Aggiungi un'app di autenticazione (TOTP) come secondo fattore.",
-      "sessionVerified": "Sessione verificata",
-      "enrolled": "Configurato",
+      "statusOn": "Attivo · Richiesto all'accesso e prima delle modifiche sensibili",
       "addAuthenticatorApp": "Aggiungi l'app di autenticazione",
       "factorsLoadFailed": "Impossibile caricare le app di autenticazione",
       "retry": "Riprova",
       "factorsUnchanged": "Le impostazioni dell'autenticazione a due fattori non sono cambiate. Solo l'elenco non è stato caricato.",
       "noFactorEnrolled": "Nessun secondo fattore configurato",
       "noFactorDescription": "Se la tua organizzazione richiede MFA, non potrai eseguire le azioni protette finché non configurerai qui un'app di autenticazione.",
-      "scanTitle": "Esegui la scansione con la tua app di autenticazione",
-      "scanDescription": "Utilizza 1Password, Google Authenticator o qualsiasi app TOTP, quindi inserisci il codice a 6 cifre visualizzato.",
+      "scanTitle": "Scansiona con il telefono",
+      "scanDescription": "Apri un'app di autenticazione e scansiona questo codice.",
       "qrAlt": "Codice QR per la configurazione TOTP",
-      "manualSecret": "Segreto di immissione manuale",
-      "sixDigitCode": "Codice a 6 cifre",
-      "verifyAndEnable": "Verifica e abilita",
+      "manualSecret": "Non riesci a scansionare? Inserisci questa chiave",
+      "codeTitle": "Inserisci il codice",
+      "codeDescription": "Digita le 6 cifre mostrate dalla tua app. La verifica è automatica.",
+      "verifyAndEnable": "Verifica",
       "cancel": "Annulla",
       "removeFactorTitle": "Rimuovere questo fattore?",
       "removeFactorDescription": "Se la tua organizzazione richiede MFA e questo è l'unico fattore verificato, non potrai eseguire le azioni protette finché non configurerai un nuovo fattore.",
```

---

### Incident Patch 10: `76d9981a` (2026-10-05)
**Commit Message**: fix(kortixd): pi 1.0.3 + daemon bun.lock, so the API image builds again (#9186)

## Summary

#8738 moved kortixd to pi 1.0.0 in
`apps/kortix-sandbox-agent-server/package.json` but left the daemon's
standalone `bun.lock` at pi 0.85.1. The API image's `sandbox-agent`
stage runs `bun install --frozen-lockfile` against that lockfile, so
Deploy Dev run
[37334151111](https://github.com/kortix-ai/suna/actions/runs/37334151111)
failed at **Build API image (amd64)** (`error: lockfile had changes, but
lockfile is frozen`). Dev API stayed on the previous image
(`b5d17c91b4`); gateway and frontend deployed.

- `bun.lock` regenerated: `undici` stays at 8.10.2 (the version #9127
moved to for 2 HIGH CVEs).
- **pi 1.0.0 → 1.0.3** (all eight `@earendil-works/*` packages, in
`package.json`, `pnpm-lock.yaml` and `bun.lock`). 1.0.3 was published
2026-10-05, inside the repo's 72 h cooldown; taken on purpose at the
maintainer's request and listed in `minimumReleaseAgeExclude` in
`pnpm-workspace.yaml`. Relevant upstream changes: the bash tool writes
its output files with mode `0600` and `wx` (1.0.3); "model is at
capacity" is retryable (pi-ai 1.0.1). The tool, session-manager,
compaction, skills and prom

**File**: `apps/kortix-sandbox-agent-server/bun.lock` (modified, +78/-108)
```diff
@@ -5,10 +5,10 @@
     "": {
       "name": "kortixd",
       "dependencies": {
-        "@earendil-works/pi-agent-core": "0.85.1",
-        "@earendil-works/pi-ai": "0.85.1",
-        "@earendil-works/pi-coding-agent": "0.85.1",
-        "@earendil-works/pi-tui": "0.85.1",
+        "@earendil-works/pi-agent-core": "1.0.3",
+        "@earendil-works/pi-ai": "1.0.3",
+        "@earendil-works/pi-coding-agent": "1.0.3",
+        "@earendil-works/pi-tui": "1.0.3",
         "hono": "^4.13.7",
         "node-forge": "^1.4.0",
         "tar": "^7.5.22",
@@ -32,17 +32,9 @@
     "undici": "8.10.2",
   },
   "packages": {
-    "@anthropic-ai/sdk": ["@anthropic-ai/sdk@0.123.0", "", { "dependencies": { "json-schema-to-ts": "^3.1.1", "standardwebhooks": "^1.0.0" }, "peerDependencies": { "zod": "^3.25.0 || ^4.0.0" }, "optionalPeers": ["zod"], "bin": { "anthropic-ai-sdk": "bin/cli" } }, "sha512-Y9oX9mPNGZClHQOFqrWRk43Srcu/UHuPq3rfxxOq7JgW0gi+lJA2MAOK4Ul3k/+AUrwRWFJvd0tK3oC0Pw25dw=="],
+    "@anthropic-ai/sdk": ["@anthropic-ai/sdk@0.129.0", "", { "dependencies": { "json-schema-to-ts": "^3.1.1", "standardwebhooks": "^1.0.0" }, "peerDependencies": { "zod": "^3.25.0 || ^4.0.0" }, "optionalPeers": ["zod"], "bin": { "anthropic-ai-sdk": "bin/cli" } }, "sha512-MH7LB20kNpGLUpPTe2OG5XvL/KhX8HUO9XyBaFjgFk6TLS4Xjt0VPIuMKywe7POKKPslX+QxSlVok9e+8kG5Nw=="],
 
-    "@aws-crypto/sha256-browser": ["@aws-crypto/sha256-browser@5.2.0", "", { "dependencies": { "@aws-crypto/sha256-js": "^5.2.0", "@aws-crypto/supports-web-crypto": "^5.2.0", "@aws-crypto/util": "^5.2.0", "@aws-sdk/types": "^3.222.0", "@aws-sdk/util-locate-window": "^3.0.0", "@smithy/util-utf8": "^2.0.0", "tslib": "^2.6.2" } }, "sha512-AXfN/lGotSQwu6HNcEsIASo7kWXZ5HYWvfOmSNKDsEqC4OashTp8alTmaz+F7TC2L083SFv5RdB+qU3Vs1kZqw=="],
-
-    "@aws-crypto/sha256-js": ["@aws-crypto/sha256-js@5.2.0", "", { "dependencies": { "@aws-crypto/util": "^5.2.0", "@aws-sdk/types": "^3.222.0", "tslib": "^2.6.2" } }, "sha512-FFQQyu7edu4ufvIZ+OadFpHHOt+eSTBaYaki44c+akjg7qZg9oOQeLlk77F6tSYqjDAFClrHJk9tMf0HdVyOvA=="],
-
-    "@aws-crypto/supports-web-crypto": ["@aws-crypto/supports-web-crypto@5.2.0", "", { "dependencies": { "tslib": "^2.6.2" } }, "sha512-iAvUotm021kM33eCdNfwIN//F77/IADDSs58i+MDaOqFrVjZo9bAal0NK7HurRuWLLpF1iLX7gbWrjHjeo+YFg=="],
-
-    "@aws-crypto/util": ["@aws-crypto/util@5.2.0", "", { "dependencies": { "@aws-sdk/types": "^3.222.0", "@smithy/util-utf8": "^2.0.0", "tslib": "^2.6.2" } }, "sha512-4RkU9EsI6ZpBve5fseQlGNUWKMa1RLPQ1dnjnQoe07ldfIzcsGb5hC5W0Dm7u423KWzawlrpbjXBrXCEv9zazQ=="],
-
-    "@aws-sdk/client-bedrock-runtime": ["@aws-sdk/client-bedrock-runtime@3.1048.0", "", { "dependencies": { "@aws-crypto/sha256-browser": "5.2.0", "@aws-crypto/sha256-js": "5.2.0", "@aws-sdk/core": "^3.974.11", "@aws-sdk/credential-provider-node": "^3.972.42", "@aws-sdk/eventstream-handler-node": "^3.972.16", "@aws-sdk/middleware-eventstream": "^3.972.12", "@aws-sdk/middleware-websocket": "^3.972.19", "@aws-sdk/token-providers": "3.1048.0", "@aws-sdk/types": "^3.973.8", "@smithy/core": "^3.24.2", "@smithy/fetch-http-handler": "^5.4.2", "@smithy/node-http-handler": "^4.7.2", "@smithy/types": "^4.14.1", "tslib": "^2.6.2" } }, "sha512-u+NT61JZEkRFtpL0CAw1N1dwxnaLgwVXQl/zjJxTGgLyS/jTIdg2SdoEoCTHxgDyCnqa1HEi9QOoE9/pYRNpOQ=="],
+    "@aws-sdk/client-bedrock-runtime": ["@aws-sdk/client-bedrock-runtime@3.1127.0", "", { "dependencies": { "@aws-sdk/core": "^3.977.9", "@aws-sdk/credential-provider-node": "^3.972.82", "@aws-sdk/eventstream-handler-node": "^3.972.34", "@aws-sdk/middleware-eventstream": "^3.972.29", "@aws-sdk/middleware-websocket": "^3.972.52", "@aws-sdk/token-providers": "3.1127.0", "@aws-sdk/types": "^3.974.5", "@smithy/core": "^3.33.3", "@smithy/fetch-http-handler": "^5.7.2", "@smithy/node-http-handler": "^4.11.3", "@smithy/types": "^4.17.2", "tslib": "^2.6.2" } }, "sha512-IDl/lrPb90aH+pZFHGNDmgH9nAUQj5PlZH1sJ3w7RikctyjHSnY3oNjZhrLoaBoQn/rNK0zsP6OHEqEhj2tdLA=="],
 
     "@aws-sdk/core": ["@aws-sdk/core@3.978.0", "", { "dependencies": { "@aws-sdk/types": "^3.974.5", "@aws-sdk/xml-builder": "^3.972.40", "@aws/lambda-invoke-store": "^0.3.0", "@smithy/core": "^3.33.3", "@smithy/signature-v4": "^5.6.12", "@smithy/types": "^4.17.2", "bowser": "^2.11.0", "tslib": "^2.6.2" } }, "sha512-2yX9LUmxPklVjSGTb8dfnWRJSiFQ3TeH2nn7G1mdKHTfnabzF0+gfrS8rYfLWmZrQ8A3mEcxMJjRc51dL5KWaA=="],
 
@@ -72,81 +64,83 @@
 
     "@aws-sdk/signature-v4-multi-region": ["@aws-sdk/signature-v4-multi-region@3.996.46", "", { "dependencies": { "@aws-sdk/types": "^3.974.5", "@smithy/signature-v4": "^5.6.12", "@smithy/types": "^4.17.2", "tslib": "^2.6.2" } }, "sha512-L+2xZTye/2T96f3lwCws0Zw6GG2JHZW9e8FpVgGBeeExSKyeoZ6CWRpBml/7DNiK/O26jrgPM9F+Ay8VkgzUWQ=="],
 
-    "@aws-sdk/token-providers": ["@aws-sdk/token-providers@3.1048.0", "", { "dependencies": { "@aws-sdk/core": "^3.974.11", "@aws-sdk/nested-clients": "^3.997.9", "@aws-sdk/types": "^3.973.8", "@smithy/core": "^3.24.2", "@smithy/types": "^4.14.1", "tslib": "^2.6.2" } }, "sha512-k0y/Gcu
```

**File**: `apps/kortix-sandbox-agent-server/package.json` (modified, +4/-4)
```diff
@@ -21,10 +21,10 @@
     "test": "bun test --timeout ${KORTIX_TEST_TIMEOUT_MS:-15000}"
   },
   "dependencies": {
-    "@earendil-works/pi-agent-core": "1.0.0",
-    "@earendil-works/pi-ai": "1.0.0",
-    "@earendil-works/pi-coding-agent": "1.0.0",
-    "@earendil-works/pi-tui": "1.0.0",
+    "@earendil-works/pi-agent-core": "1.0.3",
+    "@earendil-works/pi-ai": "1.0.3",
+    "@earendil-works/pi-coding-agent": "1.0.3",
+    "@earendil-works/pi-tui": "1.0.3",
     "hono": "^4.13.7",
     "node-forge": "^1.4.0",
     "tar": "^7.5.22",
```

**File**: `apps/kortix-sandbox-agent-server/src/__tests__/bun-lock-sync.test.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import { expect, test } from 'bun:test'
+import { readFileSync } from 'node:fs'
+import { join } from 'node:path'
+
+/**
+ * The API image builds kortixd standalone with `bun install --frozen-lockfile`
+ * (apps/api/Dockerfile, stage `sandbox-agent`). That install fails when a
+ * dependency spec in package.json differs from the one bun.lock recorded, and
+ * no API image builds (#8563, #8738). Regenerate with
+ * `bun install --lockfile-only --minimum-release-age=259200` in this directory.
+ */
+test('bun.lock records the dependency specs package.json declares', () => {
+  const root = join(import.meta.dir, '../..')
+  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
+  // bun.lock is JSON with trailing commas.
+  const lock = JSON.parse(readFileSync(join(root, 'bun.lock'), 'utf8').replace(/,(\s*[}\]])/g, '$1'))
+  const locked = lock.workspaces['']
+  expect({ dependencies: locked.dependencies ?? {}, devDependencies: locked.devDependencies ?? {} }).toEqual({
+    dependencies: pkg.dependencies ?? {},
+    devDependencies: pkg.devDependencies ?? {},
+  })
+})
```

**File**: `apps/kortix-sandbox-agent-server/src/harness/README.md` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ needs through `HarnessBootContext` (`serve` starts the HTTP server).
 > section. Until then OpenCode stays the default. When the move is complete,
 > `open-code/` and the `opencode` harness id are removed.
 
-pi (`@earendil-works/pi-agent-core` and `pi-coding-agent`, 1.0.0) is bundled
+pi (`@earendil-works/pi-agent-core` and `pi-coding-agent`, 1.0.3) is bundled
 into the daemon binary and runs INSIDE the daemon process. There is no child
 process, no port, no RPC and no second sandbox: pi-coding-agent's built-in
 `bash`/`read`/`write`/`edit` run on `/workspace` in this process, Kortix adds
```

**File**: `apps/kortix-sandbox-agent-server/src/harness/pi/version.ts` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 /** The pi release this daemon embeds. Its own module so `assets.ts` does not load the runtime. */
-export const PI_HARNESS_VERSION = 'pi-agent-core@1.0.0'
+export const PI_HARNESS_VERSION = 'pi-agent-core@1.0.3'
```

**File**: `pnpm-lock.yaml` (modified, +36/-35)
```diff
@@ -371,17 +371,17 @@ importers:
   apps/kortix-sandbox-agent-server:
     dependencies:
       '@earendil-works/pi-agent-core':
-        specifier: 1.0.0
-        version: 1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
+        specifier: 1.0.3
+        version: 1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
       '@earendil-works/pi-ai':
-        specifier: 1.0.0
-        version: 1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
+        specifier: 1.0.3
+        version: 1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
       '@earendil-works/pi-coding-agent':
-        specifier: 1.0.0
-        version: 1.0.0(ws@8.21.3)(zod@3.25.76)
+        specifier: 1.0.3
+        version: 1.0.3(ws@8.21.3)(zod@3.25.76)
       '@earendil-works/pi-tui':
-        specifier: 1.0.0
-        version: 1.0.0
+        specifier: 1.0.3
+        version: 1.0.3
       hono:
         specifier: ^4.13.7
         version: 4.13.7
@@ -1831,8 +1831,8 @@ packages:
       package-manager-detector: 1.8.0
       tinyexec: 1.3.1
 
-  /@anthropic-ai/sdk@0.124.0(zod@3.25.76):
-    resolution: {integrity: sha512-cN5O8i9UVxHeOQAzj/XjshWXG8KiibJDw9OGpH2Z/eR3n/RBxdoLxDJOcfqAJWvjaMDFfHTBADU04hWRJVkDyA==}
+  /@anthropic-ai/sdk@0.129.0(zod@3.25.76):
+    resolution: {integrity: sha512-MH7LB20kNpGLUpPTe2OG5XvL/KhX8HUO9XyBaFjgFk6TLS4Xjt0VPIuMKywe7POKKPslX+QxSlVok9e+8kG5Nw==}
     hasBin: true
     peerDependencies:
       zod: ^3.25.0 || ^4.0.0
@@ -4224,18 +4224,18 @@ packages:
       playwright: 1.63.0
     dev: true
 
-  /@earendil-works/chord@1.0.0:
-    resolution: {integrity: sha512-BIfWfrByM0pKq6tfKYXuwx0ed2CvaqIM3EDA7Dps+fP+d3CiPWdlHi1cDsJC05llqKJoRz5//G0hz0yQwwjISQ==}
+  /@earendil-works/chord@1.0.3:
+    resolution: {integrity: sha512-H5pKMs3S1z2q4V7NkDGKDFzOMW+OkzdsnGxxj5wNJUANG03VKj29UVmc1xnnnf0FAc03COHYNxwgNApO0nt0fg==}
     engines: {node: '>=22.19.0'}
     dependencies:
       esbuild: 0.28.2
     dev: false
 
-  /@earendil-works/pi-agent-core@1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76):
-    resolution: {integrity: sha512-bHFONjtEBDqiV+g1DmmtkSlfAaqHELr+XO+6I5Nah4gswwZrLJO4yZB/JjsnlI4AKWTayBLfgS6DCbeBBz9e2Q==}
+  /@earendil-works/pi-agent-core@1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76):
+    resolution: {integrity: sha512-lnvi2PJYaq8mDLzwWBttNqfxrLS63SSMONUJnTCypdvt/flmNJchXwWXsXUOJ5Yhe/mN+iHkrXu696lWZZ8o+w==}
     engines: {node: '>=22.19.0'}
     dependencies:
-      '@earendil-works/pi-ai': 1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
+      '@earendil-works/pi-ai': 1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
       typebox: 1.3.27
     transitivePeerDependencies:
       - '@aws-sdk/credential-provider-node'
@@ -4251,14 +4251,14 @@ packages:
       - zod
     dev: false
 
-  /@earendil-works/pi-ai@1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76):
-    resolution: {integrity: sha512-3/W1vdDaVtpeMd23ElvJC12HLA5yS/BGqqcXF+0SK082dN7cbgNcCwguTBRBC258Ke8SzSvUW1B75iAf8w8IxA==}
+  /@earendil-works/pi-ai@1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76):
+    resolution: {integrity: sha512-p+/EUrbmfT0xWOtL/NJRtWOsyzcKKFSyiivHLDBMG0DUVpHdaIykd5jFibq0YZDFGBN/nv61zdOelMb+ylPfSg==}
     engines: {node: '>=22.19.0'}
     hasBin: true
     dependencies:
-      '@anthropic-ai/sdk': 0.124.0(zod@3.25.76)
+      '@anthropic-ai/sdk': 0.129.0(zod@3.25.76)
       '@aws-sdk/client-bedrock-runtime': 3.1127.0
-      '@earendil-works/pi-telemetry': 1.0.0
+      '@earendil-works/pi-telemetry': 1.0.3
       '@google/genai': 2.21.0
       '@smithy/node-http-handler': 4.12.1
       http-proxy-agent: 9.1.0
@@ -4280,25 +4280,26 @@ packages:
       - zod
     dev: false
 
-  /@earendil-works/pi-codemode@1.0.0:
-    resolution: {integrity: sha512-LPpFI4+T9NzDnhBDs15izWAolaoM8xnwqdziRd6Zx8BQeoEPvzefD2vMMzSyF0rOtq34TfQqkZ0ki16f6cGdMg==}
+  /@earendil-works/pi-codemode@1.0.3:
+    resolution: {integrity: sha512-/rgWAXA9PhuFm0+j6N5FVvvWrAwt1LnhmbjA3Hy5+Q033XUHgh0YCMGAmU76S90ocr0Vfxm50ddYT/O76T5OGQ==}
     engines: {node: '>=22.19.0'}
     dependencies:
       quickjs-wasi: 3.6.2
     dev: false
 
-  /@earendil-works/pi-coding-agent@1.0.0(ws@8.21.3)(zod@3.25.76):
-    resolution: {integrity: sha512-/FtbxoSQU/mEv1QnichJjRjqteqaIaMWxmhB4G367+MwZfX7/DI5B9YAg5lqbN7nztFskBEtUSZ+FlmMBECtMw==}
+  /@earendil-works/pi-coding-agent@1.0.3(ws@8.21.3)(zod@3.25.76):
+    resolution: {integrity: sha512-t2lb0dw4y/jr5a2PRo6eTHGTZOPB3/YAMVyhhYFC1W3Hl5xE+462I/gMWjF4gCLuhGipNEfuNqONFmdqLFz4SQ==}
     engines: {node: '>=22.19.0'}
     hasBin: true
     dependencies:
-      '@earendil-works/chord': 1.0.0
-      '@earendil-works/pi-agent-core': 1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
-      '@earendil-works/pi-ai': 1.0.0(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
-      '@earendil-works/pi-codemode': 1.0.0
-      '@earendil-works/pi-mcp': 1.0.0
-      '@earendil-works/pi-tui': 1.0.0
+      '@earendil-works/chord': 1.0.3
+      '@earendil-works/pi-agent-core': 1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
+      '@earendil-works/pi-ai': 1.0.3(undici@8.10.2)(ws@8.21.3)(zod@3.25.76)
+      '@earendil-works/pi-cod
```

**File**: `pnpm-workspace.yaml` (modified, +3/-1)
```diff
@@ -17,7 +17,9 @@ packages:
 # are typically yanked within hours. 3 days covers Fri-night publish through
 # Monday-morning disclosure. Use minimumReleaseAgeExclude for emergency hotfixes.
 minimumReleaseAge: 4320
-minimumReleaseAgeExclude: []   # add specific packages here for emergency hotfixes
+# pi 1.0.3 (published 2026-10-05) was taken inside the cooldown on purpose (#8738 follow-up).
+minimumReleaseAgeExclude:
+  - '@earendil-works/*'
 
 # Block lifecycle scripts everywhere except the allow-list below. The TanStack
 # payload was a postinstall — this is the single most important defense.
```

**File**: `tests/attestations/pi-upgrade.json` (modified, +7/-30)
```diff
@@ -1,44 +1,21 @@
 {
-  "source_hash": "d95fc7f4bea312d0043d9517c458fa9508330d4aa4db469db907e47ba0657747",
+  "source_hash": "dd9ac8c8840b9933e3dcb930f5d3bfac61db75dcd1bc5638bf6e6012162a20dc",
   "diff_files": [
-    "AGENTS.md",
-    "apps/cli/src/commands/sessions-lifecycle.ts",
+    "apps/kortix-sandbox-agent-server/bun.lock",
     "apps/kortix-sandbox-agent-server/package.json",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-agent-sampling.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-harness.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-search-tools.test.ts",
-    "apps/kortix-sandbox-agent-server/src/__tests__/pi-transient-retry.test.ts",
+    "apps/kortix-sandbox-agent-server/src/__tests__/bun-lock-sync.test.ts",
     "apps/kortix-sandbox-agent-server/src/harness/README.md",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/diagnostics.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/extensions/host.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/runtime.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/sampling.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/surface.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/tools.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/transcript.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/transient-retry.ts",
-    "apps/kortix-sandbox-agent-server/src/harness/pi/turn-events.ts",
     "apps/kortix-sandbox-agent-server/src/harness/pi/version.ts",
-    "apps/web/content/docs/cli.mdx",
-    "apps/web/content/docs/work/harnesses.mdx",
-    "apps/web/src/features/workspace/command-palette.tsx",
-    "apps/web/src/lib/menu-registry.ts",
-    "apps/web/src/lib/seo/content-timestamps.json",
-    "packages/sdk/src/react/use-opencode-sessions/commands.ts",
-    "packages/starter/src/embedded.generated.json",
-    "packages/starter/templates/managed/skills/kortix-system/SKILL.md",
-    "packages/starter/templates/managed/skills/kortix-system/references/pi/overview.md",
     "pnpm-lock.yaml",
-    "tests/spec/end-to-end.md",
-    "tests/src/flows/run-session-backlog.flow.ts"
+    "pnpm-workspace.yaml"
   ],
-  "diff_hash": "af5e2858ff8d15ca24d3c6e7a3a309998e5b9eac693782a09b544737f19e2146",
-  "head": "77229431b677d5d7622e08f2ba42e5f2ab9f0487",
+  "diff_hash": "6d30ad04b872f2082f8e55bd650ce04e95466ce120a1cc1324ead9396a6bbf39",
+  "head": "45f190f4f82ead170bceb20f24deff1d396efd6f",
   "passed": true,
   "lanes": {
     "core": "pass",
     "packages": "pass",
     "db-suites": "pass"
   },
-  "at": "2026-10-05T15:13:17.181Z"
+  "at": "2026-10-05T16:13:06.836Z"
 }
```

---

### Incident Patch 11: `569b23a7` (2026-10-05)
**Commit Message**: fix(mobile): list the project's Apps instead of always showing "No apps yet" (#9183)

## Summary
- `AppsPage` passed `emptyLabel="No apps yet"` unconditionally.
`PageList` (`page-list.tsx:86`) renders the empty state whenever
`emptyLabel` is set, so the mobile Apps page showed "No apps yet" on
every project, even when `GET /projects/:id/apps` returned Apps.
- Pass the label only when the list is empty, as `SecretsNavPage` does.

## Test plan
- `GET /v1/projects/:id/apps` on dev returns 8 Apps (HTTP 200) for an
affected project; SDK `listApps` returns the same 8.
- `bun test lib/projects/apps` in `apps/mobile`: 7 pass, 0 fail.
- On device: project drawer → Apps lists the rows; a project with no
Apps still shows "No apps yet".

**File**: `apps/mobile/components/pages/AppsPage.tsx` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ export function AppsPage({ page, projectId, onOpenDrawer, isDrawerOpen }: AppsPa
           }
           onRetry={() => void refetch()}
           onRefresh={() => refetch()}
-          emptyLabel="No apps yet"
+          emptyLabel={apps.length === 0 ? 'No apps yet' : null}
           header={<View className="h-1" />}
           data={apps}
           keyExtractor={(app) => app.app_id}
```

---

### Incident Patch 12: `b5d17c91` (2026-10-05)
**Commit Message**: fix(web): demo booking keeps its confirmation open and closes only on request (#9179)

The demo modal no longer closes itself after a Cal.com booking, and it no longer stacks a booking listener on every open. A booked ticket replaces Cal's success page and stays open until the person closes it. The form and calendar steps share a meeting header with a close button.

**File**: `apps/web/src/features/contact/demo-booking.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { describe, expect, test } from 'bun:test';
+
+import { formatBookedSlot, subscribeBookingSuccess, type CalEventApi } from './demo-booking';
+
+function fakeCal() {
+  const listeners = new Set<(e: unknown) => void>();
+  const calls: string[] = [];
+  const cal: CalEventApi = (method, { action, callback }) => {
+    calls.push(`${method}:${action}`);
+    if (method === 'on') listeners.add(callback as (e: unknown) => void);
+    else listeners.delete(callback as (e: unknown) => void);
+  };
+  const fire = (data: Record<string, unknown>) =>
+    listeners.forEach((l) => l(new CustomEvent('x', { detail: { data } })));
+  return { cal, calls, listeners, fire };
+}
+
+describe('subscribeBookingSuccess', () => {
+  test('the cleanup removes the exact listener it added', () => {
+    const { cal, calls, listeners } = fakeCal();
+    const unsubscribe = subscribeBookingSuccess(cal, () => {});
+    expect(listeners.size).toBe(1);
+    unsubscribe();
+    expect(listeners.size).toBe(0);
+    expect(calls).toEqual(['on:bookingSuccessfulV2', 'off:bookingSuccessfulV2']);
+  });
+
+  test('re-opening the modal never stacks a second listener', () => {
+    const { cal, listeners, fire } = fakeCal();
+    let booked = 0;
+    for (let open = 0; open < 3; open++) subscribeBookingSuccess(cal, () => booked++)();
+    const unsubscribe = subscribeBookingSuccess(cal, () => booked++);
+    fire({ uid: 'b1', startTime: '2026-10-08T12:30:00Z', endTime: '2026-10-08T13:00:00Z' });
+    expect(listeners.size).toBe(1);
+    expect(booked).toBe(1);
+    unsubscribe();
+  });
+
+  test('passes the booking payload through', () => {
+    const { cal, fire } = fakeCal();
+    let got: unknown = null;
+    subscribeBookingSuccess(cal, (b) => (got = b));
+    fire({ uid: 'b1', title: 'Kortix demo', startTime: 'a', endTime: 'b' });
+    expect(got).toEqual({ uid: 'b1', title: 'Kortix demo', startTime: 'a', endTime: 'b' });
+  });
+});
+
+describe('formatBookedSlot', () => {
+  test('formats the slot in the viewer time zone', () => {
+    const slot = formatBookedSlot(
+      { startTime: '2026-10-08T12:30:00Z', endTime: '2026-10-08T13:00:00Z' },
+      'en-US',
+      'Europe/Berlin',
+    );
+    expect(slot).not.toBeNull();
+    expect(slot!.month).toBe('Oct');
+    expect(slot!.day).toBe('08');
+    expect(slot!.weekday).toBe('Thu');
+    expect(slot!.time.replace(/\s/g, ' ')).toMatch(/^2:30\s?–\s?3:00 PM$/);
+    expect(slot!.zone).toBe('GMT+2');
+    expect(slot!.minutes).toBe(30);
+  });
+
+  test('returns null for a payload without valid times', () => {
+    expect(formatBookedSlot({ startTime: undefined, endTime: undefined }, 'en-US')).toBeNull();
+    expect(formatBookedSlot({ startTime: 'nope', endTime: 'nope' }, 'en-US')).toBeNull();
+  });
+});
```

**File**: `apps/web/src/features/contact/demo-booking.ts` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+/** The fields of Cal.com's `bookingSuccessfulV2` embed event that we read. */
+export interface CalBooking {
+  uid?: string;
+  title?: string;
+  startTime?: string;
+  endTime?: string;
+}
+
+type BookingListener = (e: CustomEvent<{ data: CalBooking }>) => void;
+
+/** The `on` / `off` slice of the Cal.com embed API (`getCalApi`). */
+export type CalEventApi = (
+  method: 'on' | 'off',
+  args: { action: 'bookingSuccessfulV2'; callback: BookingListener },
+) => void;
+
+/**
+ * Listen for a completed booking and return the cleanup. The embed API keeps
+ * listeners per namespace for the life of the page, so a listener that is
+ * never removed fires again on every later booking, once per modal open.
+ */
+export function subscribeBookingSuccess(
+  cal: CalEventApi,
+  onBooked: (booking: CalBooking) => void,
+): () => void {
+  const callback: BookingListener = (e) => onBooked(e.detail.data);
+  cal('on', { action: 'bookingSuccessfulV2', callback });
+  return () => cal('off', { action: 'bookingSuccessfulV2', callback });
+}
+
+export interface BookedSlot {
+  month: string;
+  day: string;
+  weekday: string;
+  time: string;
+  zone: string;
+  minutes: number;
+}
+
+/** The booked slot, in the viewer's locale and time zone. */
+export function formatBookedSlot(
+  booking: CalBooking,
+  locale?: string,
+  timeZone?: string,
+): BookedSlot | null {
+  const start = new Date(booking.startTime ?? '');
+  const end = new Date(booking.endTime ?? '');
+  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
+
+  const part = (options: Intl.DateTimeFormatOptions) =>
+    new Intl.DateTimeFormat(locale, { timeZone, ...options });
+  const zone = part({ timeZoneName: 'short' })
+    .formatToParts(start)
+    .find((p) => p.type === 'timeZoneName')?.value;
+
+  return {
+    month: part({ month: 'short' }).format(start),
+    day: part({ day: '2-digit' }).format(start),
+    weekday: part({ weekday: 'short' }).format(start),
+    time: part({ hour: 'numeric', minute: '2-digit' }).formatRange(start, end),
+    zone: zone ?? '',
+    minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
+  };
+}
```

**File**: `apps/web/src/features/contact/demo-qualifier-modal.tsx` (modified, +228/-70)
```diff
@@ -1,10 +1,19 @@
 'use client';
 
+import { useLocale, useTranslations } from '@/i18n/use-translations';
 import Cal, { getCalApi } from '@calcom/embed-react';
-import { CheckIcon as Check, EnvelopeIcon as Mail } from '@phosphor-icons/react';
-import { useTranslations } from '@/i18n/use-translations';
+import {
+  ArrowRightIcon as ArrowRight,
+  CalendarBlankIcon as CalendarBlank,
+  CheckIcon as Check,
+  EnvelopeIcon as Mail,
+} from '@phosphor-icons/react';
 import { useCallback, useEffect, useMemo, useState } from 'react';
 
+import { KortixLogo } from '@/components/ui/kortix-logo';
+import { Close } from '@/features/icon/icons/close';
+import { SolidCheckIcon } from '@/features/icon/icons/solid-check-icon';
+
 import { isWorkEmail } from '@/lib/personal-email';
 
 import { Button } from '@/components/ui/button';
@@ -15,6 +24,7 @@ import Loading from '@/components/ui/loading';
 import {
   Modal,
   ModalBody,
+  ModalClose,
   ModalContent,
   ModalDescription,
   ModalFooter,
@@ -32,6 +42,13 @@ import { Textarea } from '@/components/ui/textarea';
 import { errorToast } from '@/components/ui/toast';
 import Link from 'next/link';
 
+import {
+  formatBookedSlot,
+  subscribeBookingSuccess,
+  type CalBooking,
+  type CalEventApi,
+} from './demo-booking';
+
 const CAL_FIELD_COMPANY_SIZE = 'Company_size';
 const CAL_FIELD_COMPANY_NAME = 'Company_name';
 
@@ -56,6 +73,20 @@ const sizeQualifies = (s: CompanySize, email: string) =>
 
 const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
+// Ticket perforation: each half of the confirmation is cut by an 11px
+// half-circle on both edges where the halves meet, so the overlay shows
+// through the notches.
+const notch = (y: '0' | '100%') =>
+  [
+    `radial-gradient(circle 11px at 0 ${y}, transparent 98%, #000) left / 51% 100% no-repeat`,
+    `radial-gradient(circle 11px at 100% ${y}, transparent 98%, #000) right / 51% 100% no-repeat`,
+  ].join(', ');
+const TICKET_TOP = { mask: notch('100%') };
+const TICKET_BOTTOM = { mask: notch('0') };
+
+// The Kortix logo tile is light in both themes.
+const LOGO_TILE = 'bg-white text-black';
+
 export interface DemoQualifierModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
@@ -69,20 +100,45 @@ export interface DemoQualifierModalProps {
   onBookingSuccessful?: () => void;
 }
 
+/** The demo's identity, shown above every step so the modal reads as one flow. */
+function MeetingHeader({ meta }: { meta: string }) {
+  const t = useTranslations('demoBooking');
+  return (
+    <div className="bg-sidebar border-border flex items-center gap-3 border-b px-5 py-4">
+      <div className={`flex size-8 shrink-0 items-center justify-center rounded-sm ${LOGO_TILE}`}>
+        <KortixLogo variant="icon" size={16} />
+      </div>
+      <div className="flex min-w-0 flex-1 flex-col">
+        <span className="text-foreground text-sm font-medium">{t('meetingTitle')}</span>
+        <span className="text-muted-foreground truncate text-xs">{meta}</span>
+      </div>
+      <ModalClose asChild>
+        <Button variant="ghost" size="icon-base" className="shrink-0">
+          <Close className="size-4 stroke-1" />
+          <span className="sr-only">{t('close')}</span>
+        </Button>
+      </ModalClose>
+    </div>
+  );
+}
+
 export function DemoQualifierModal({
   open,
   onOpenChange,
   calLink,
   calNamespace,
   source = 'contact',
-  title = 'Book your demo',
-  description = "A couple of quick details so we can tailor the session — or point you to self-serve if that's faster.",
+  title,
+  description,
   defaultName = '',
   defaultEmail = '',
   onBookingSuccessful,
 }: DemoQualifierModalProps) {
   const tI18nHardcoded = useTranslations('hardcodedUi');
-  const [step, setStep] = useState<'form' | 'cal' | 'received'>('form');
+  const t = useTranslations('demoBooking');
+  const locale = useLocale();
+  const [step, setStep] = useState<'form' | 'cal' | 'booked' | 'received'>('form');
+  const [booking, setBooking] = useState<CalBooking | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [name, setName] = useState(defaultName);
   const [email, setEmail] = useState(defaultEmail);
@@ -92,6 +148,7 @@ export function DemoQualifierModal({
   const [error, setError] = useState<string | null>(null);
 
   const companySizes = useMemo(() => companySizesForEmail(email), [email]);
+  const slot = useMemo(() => booking && formatBookedSlot(booking, locale), [booking, locale]);
 
   useEffect(() => {
     if (size === '1-10' && !isWorkEmail(email)) setSize(null);
@@ -100,6 +157,7 @@ export function DemoQualifierModal({
   useEffect(() => {
     if (open) {
       setStep('form');
+      setBooking(null);
       setError(null);
     }
   }, [open]);
@@ -117,18 +175,24 @@ export function DemoQualifierModal({
     // every enterprise CTA can open it) — the embed script loads lazily on
     // open, not on every page paint.
     if (!open) return;
-    (async function () {
-      co
```

**File**: `apps/web/translations/de.json` (modified, +15/-0)
```diff
@@ -20524,5 +20524,20 @@
     "people": "Personen in dieser Sitzung: {names}",
     "peopleMore": "Personen in dieser Sitzung: {names} und {count} weitere",
     "more": "{count} weitere können diese Sitzung öffnen"
+  },
+  "demoBooking": {
+    "meetingTitle": "Kortix-Demo",
+    "stepDetails": "Deine Angaben",
+    "stepTime": "Termin wählen",
+    "formTitle": "Bevor wir einen Termin wählen",
+    "formDescription": "Damit bereiten wir eine Vorführung für dein Team vor.",
+    "seeTimes": "Freie Termine ansehen",
+    "close": "Schließen",
+    "bookedLabel": "Termin bestätigt",
+    "bookedMeta": "{minutes} Min. · Link in deiner Einladung",
+    "inviteSent": "Einladung an {email} gesendet",
+    "reschedule": "Anderer Termin? Nutze den Link in der Einladung.",
+    "addToCalendar": "Zum Kalender hinzufügen",
+    "done": "Fertig"
   }
 }
```

**File**: `apps/web/translations/en.json` (modified, +15/-0)
```diff
@@ -20524,5 +20524,20 @@
     "people": "People in this session: {names}",
     "peopleMore": "People in this session: {names} and {count} more",
     "more": "{count} more can open this session"
+  },
+  "demoBooking": {
+    "meetingTitle": "Kortix demo",
+    "stepDetails": "Your details",
+    "stepTime": "Pick a time",
+    "formTitle": "Before we pick a time",
+    "formDescription": "We'll use this to prep a walkthrough for your team.",
+    "seeTimes": "See available times",
+    "close": "Close",
+    "bookedLabel": "Booking confirmed",
+    "bookedMeta": "{minutes} min · Link in your invite",
+    "inviteSent": "Invite sent to {email}",
+    "reschedule": "Need another time? Use the link in the invite.",
+    "addToCalendar": "Add to calendar",
+    "done": "Done"
   }
 }
```

**File**: `apps/web/translations/es.json` (modified, +15/-0)
```diff
@@ -20524,5 +20524,20 @@
     "people": "Personas en esta sesión: {names}",
     "peopleMore": "Personas en esta sesión: {names} y {count} más",
     "more": "{count} más pueden abrir esta sesión"
+  },
+  "demoBooking": {
+    "meetingTitle": "Demo de Kortix",
+    "stepDetails": "Tus datos",
+    "stepTime": "Elige una hora",
+    "formTitle": "Antes de elegir una hora",
+    "formDescription": "Lo usaremos para preparar una demostración para tu equipo.",
+    "seeTimes": "Ver horarios disponibles",
+    "close": "Cerrar",
+    "bookedLabel": "Reserva confirmada",
+    "bookedMeta": "{minutes} min · Enlace en tu invitación",
+    "inviteSent": "Invitación enviada a {email}",
+    "reschedule": "¿Necesitas otra hora? Usa el enlace de la invitación.",
+    "addToCalendar": "Añadir al calendario",
+    "done": "Listo"
   }
 }
```

**File**: `apps/web/translations/fr.json` (modified, +15/-0)
```diff
@@ -20524,5 +20524,20 @@
     "people": "Personnes dans cette session : {names}",
     "peopleMore": "Personnes dans cette session : {names} et {count} de plus",
     "more": "{count} autres peuvent ouvrir cette session"
+  },
+  "demoBooking": {
+    "meetingTitle": "Démo Kortix",
+    "stepDetails": "Vos informations",
+    "stepTime": "Choisissez un créneau",
+    "formTitle": "Avant de choisir un créneau",
+    "formDescription": "Nous nous en servirons pour préparer une démonstration pour votre équipe.",
+    "seeTimes": "Voir les créneaux disponibles",
+    "close": "Fermer",
+    "bookedLabel": "Réservation confirmée",
+    "bookedMeta": "{minutes} min · Lien dans votre invitation",
+    "inviteSent": "Invitation envoyée à {email}",
+    "reschedule": "Besoin d’un autre créneau ? Utilisez le lien de l’invitation.",
+    "addToCalendar": "Ajouter au calendrier",
+    "done": "Terminé"
   }
 }
```

**File**: `apps/web/translations/it.json` (modified, +15/-0)
```diff
@@ -20524,5 +20524,20 @@
     "people": "Persone in questa sessione: {names}",
     "peopleMore": "Persone in questa sessione: {names} e altre {count}",
     "more": "Altri {count} possono aprire questa sessione"
+  },
+  "demoBooking": {
+    "meetingTitle": "Demo di Kortix",
+    "stepDetails": "I tuoi dati",
+    "stepTime": "Scegli un orario",
+    "formTitle": "Prima di scegliere un orario",
+    "formDescription": "Ci serve per preparare una dimostrazione per il tuo team.",
+    "seeTimes": "Vedi gli orari disponibili",
+    "close": "Chiudi",
+    "bookedLabel": "Prenotazione confermata",
+    "bookedMeta": "{minutes} min · Link nell’invito",
+    "inviteSent": "Invito inviato a {email}",
+    "reschedule": "Ti serve un altro orario? Usa il link nell’invito.",
+    "addToCalendar": "Aggiungi al calendario",
+    "done": "Fatto"
   }
 }
```

---

### Incident Patch 13: `5854b88c` (2026-10-05)
**Commit Message**: fix(sandbox): no core dumps in sandbox shells; a crash dump carries the agent env (#9177)

## Problem
Commit ef980a9c22 (2026-10-04) published a 60 MB ELF core dump with a
factory worker's whole environment. Reproduced root-cause chain:
1. The worker ran `biome check <file> 2>&1 | head`. Biome 1.9.4 writes
diagnostics to stderr; when `head` closed the pipe it panicked
(`Result::unwrap()` on `Err(BrokenPipe)`,
`crates/biome_console/src/lib.rs:151`) and aborted with SIGABRT. Source:
the dump's NT_PRSTATUS (signal 6) and the panic text in its memory.
2. Daytona starts sandboxes with `ulimit -c unlimited` (soft and hard,
PID 1 `daytona`). On the worker's host the kernel wrote `core` into the
cwd, the repository root.
3. The worker staged the whole tree. Commit-side guard already merged in
#9149.

## Change
- `apps/sandbox/entrypoint.sh`: `ulimit -c 0` before the privilege drop,
so the hard limit binds the daemon and every descendant.
- `agent-env-file.ts`: the env file every shell sources (`BASH_ENV`)
sets `ulimit -c 0` again, for shells outside that tree.
- Learnings entry with the reproduced chain.

## Verification
- New test `disables core dumps in every shell that sources it`: red


**File**: `.agents/skills/learnings/MEMORY.md` (modified, +2/-2)
```diff
@@ -6,9 +6,8 @@ Open the entry for the incident, the trigger surface, and the enforcement.
 
 Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 
+- `2026-10-05 13:59:15Z` [Set the core size to zero in every sandbox shell: a crash dump carries the agent's whole environment](entries/2026-10-05T135915Z-set-the-core-size-to-zero-in-every-sandbox-shell-a-crash-dum.md)
 - `2026-10-05 10:19:14Z` [Treat a provider pause as temporary: a cooling key or account stays servable, and it rests until the provider's own reset time](entries/2026-10-05T101914Z-treat-a-provider-pause-as-temporary-a-cooling-key-or-account.md)
-- `2026-10-02 17:59:52Z` [Check the EAS environment an OTA update bakes in: eas update --environment compiles its EXPO_PUBLIC values over the shell and over eas.json](entries/2026-10-02T175952Z-check-the-eas-environment-an-ota-update-bakes-in-eas-update.md)
-- `2026-10-04 22:54:03Z` [Rotate the web gate password in every blob the deploy verifier reads, not only the env being served](entries/2026-10-04T225403Z-rotate-the-web-gate-password-in-every-blob-the-deploy-verifi.md)
 - `2026-10-05 00:11:46Z` [When you rename a migration, update every file that names the old filename](entries/2026-10-05T001146Z-when-you-rename-a-migration-update-every-file-that-names-the.md)
 - `2026-10-04 22:54:03Z` [Rotate the web gate password in every blob the deploy verifier reads, not only the env being served](entries/2026-10-04T225403Z-rotate-the-web-gate-password-in-every-blob-the-deploy-verifi.md)
 - `2026-10-04 20:04:58Z` [Never stage a core dump: a worker's crash dump carries its whole env](entries/2026-10-04T200458Z-never-stage-a-core-dump-a-worker-s-crash-dump-carries-its-wh.md)
@@ -34,6 +33,7 @@ Generated by `scripts/index.sh` from `entries/`. Do not edit by hand.
 - `2026-10-03 03:25:00Z` [A DB migration that names a nonexistent column merges unverified and blocks EVERY dev deploy](entries/2026-10-03T032500Z-a-db-migration-with-a-nonexistent-column-blocks-every-dev-deploy.md)
 - `2026-10-02 22:03:57Z` [Queue CREATE INDEX CONCURRENTLY through pgm.sql(): a statement issued directly from an async up() runs inside the still-open single transaction](entries/2026-10-02T220357Z-queue-create-index-concurrently-through-pgm-sql-a-statement.md)
 - `2026-10-02 18:36:20Z` [Register every model a sandbox is told to use; the gateway decides whether it is served, never the box's catalog](entries/2026-10-02T183620Z-register-every-model-a-sandbox-is-told-to-use-the-gateway-de.md)
+- `2026-10-02 17:59:52Z` [Check the EAS environment an OTA update bakes in: eas update --environment compiles its EXPO_PUBLIC values over the shell and over eas.json](entries/2026-10-02T175952Z-check-the-eas-environment-an-ota-update-bakes-in-eas-update.md)
 - `2026-10-02 16:48:22Z` [Restart the dev API before you measure it: every bun --hot reload keeps the previous instance's database connections and worker loops](entries/2026-10-02T164822Z-restart-the-dev-api-before-you-measure-it-every-bun-hot-relo.md)
 - `2026-10-02 15:35:22Z` [Assign a session only a config release its own sandbox image can load, and count a failure toward the project quarantine only when the reporting session shares the image of the sessions it would affect](entries/2026-10-02T153522Z-assign-a-session-only-a-config-release-its-own-sandbox-image.md)
 - `2026-10-02 15:21:03Z` [Ship mobile patches through the eas-build-post-install hook: the root .npmrc ignore-scripts skips postinstall on EAS](entries/2026-10-02T152103Z-ship-mobile-patches-through-the-eas-build-post-install-hook.md)
```

**File**: `.agents/skills/learnings/entries/2026-10-05T135915Z-set-the-core-size-to-zero-in-every-sandbox-shell-a-crash-dum.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+---
+recorded: 2026-10-05T13:59:15Z
+incident_date: 2026-10-04
+---
+# Set the core size to zero in every sandbox shell: a crash dump carries the agent's whole environment
+
+**Rule:** A sandbox process tree that holds secrets runs with `ulimit -c 0`. The
+entrypoint sets it before the privilege drop, and the agent env file that every
+shell sources sets it again. Never pipe a tool into `head` and then stage the
+whole tree: the pipe can crash the tool, and the crash can write `core` into
+the checkout.
+
+**Trigger surface:** changing `apps/sandbox/entrypoint.sh`, the agent env file
+(`harness/shared/agent-env-file.ts`), a sandbox provider, or a worker skill that
+stages files.
+
+**Incident:** 2026-10-04, commit ef980a9c22 on the public repository. Root cause
+chain, reproduced:
+1. A factory worker ran `biome check <file> 2>&1 | head`. Biome 1.9.4 writes
+   diagnostics to stderr; when `head` closed the pipe, Biome panicked
+   (`Result::unwrap()` on `Err(BrokenPipe)`, `crates/biome_console/src/lib.rs:151`)
+   and aborted with SIGABRT (exit 134). Evidence: the dump's NT_PRSTATUS
+   (signal 6) and the panic text in its memory; reproduced in amd64 Linux and in
+   a Company sandbox started with `--no-secrets`.
+2. Daytona starts sandboxes with `ulimit -c unlimited` (soft and hard, inherited
+   from PID 1). On the worker's host the kernel wrote `core` into the working
+   directory, the repository root. Reproduced: with `unlimited`, the Biome abort
+   leaves `core` in the checkout; with `ulimit -c 0`, it leaves none.
+3. The worker staged the whole tree. No `.gitignore` entry covered `/core`, no
+   hook checked for binaries, and GitHub push protection skips binary files.
+4. The worker's environment held 74 project secrets because its agent grant is
+   `secrets: all`, so the dump held all of them.
+
+**Enforcement:** `apps/kortix-sandbox-agent-server/src/__tests__/agent-env-file.test.ts`
+("disables core dumps in every shell that sources it") goes red when the env
+file stops lowering the limit. The commit-side guard is the 2026-10-04 entry
+"Never stage a core dump" (`scripts/check-binary-dumps.sh`, `.gitignore`).
```

**File**: `apps/kortix-sandbox-agent-server/src/__tests__/agent-env-file.test.ts` (modified, +17/-0)
```diff
@@ -34,6 +34,23 @@ describe('writeAgentEnvFile', () => {
     expect(statSync(sh).mode & 0o777).toBe(0o600)
   })
 
+  test('disables core dumps in every shell that sources it', () => {
+    const store = createProjectEnvStore({
+      KORTIX_PROJECT_SECRET_NAMES: 'API_KEY',
+      API_KEY: 'secret',
+    } as NodeJS.ProcessEnv)
+    const sh = shPath()
+
+    writeAgentEnvFile(store, { sh })
+
+    // Daytona starts sandboxes with an unlimited core size; raise it first.
+    const result = Bun.spawnSync(
+      ['bash', '-c', 'ulimit -c unlimited && BASH_ENV="$1" bash -c "ulimit -c"', '_', sh],
+      { env: { PATH: process.env.PATH ?? '/usr/bin:/bin' } },
+    )
+    expect(result.stdout.toString().trim()).toBe('0')
+  })
+
   test('injection-safe — values are single-quote escaped', () => {
     const store = createProjectEnvStore({
       KORTIX_PROJECT_SECRET_NAMES: 'EVIL',
```

**File**: `apps/kortix-sandbox-agent-server/src/harness/shared/agent-env-file.ts` (modified, +2/-0)
```diff
@@ -108,6 +108,8 @@ function renderShellEnv(
   const lines = [
     '# Generated by kortix-sandbox-agent-server. Sourced by every sandbox shell',
     '# (BASH_ENV + /etc/profile.d). Do not edit.',
+    // A crash dump carries this whole environment; on 2026-10-04 one was committed.
+    'ulimit -c 0 2>/dev/null || true',
   ]
   for (const name of bootNames) {
     if (isUnsafeName(name)) continue
```

**File**: `apps/sandbox/entrypoint.sh` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ case ":${PATH:-}:" in
 esac
 export PATH
 
+# No core dumps: a crash dump carries the process environment, secrets included.
+# Set before the privilege drop so the hard limit binds every descendant.
+ulimit -c 0 2>/dev/null || true
+
 if [ "$(id -u)" -eq 0 ] && id kortix >/dev/null 2>&1; then
   # TEMPORARY: Platinum starts with /dev/shm as a plain directory and low
   # nofile limits. Both settings must be repaired before the privilege drop.
```

---

### Incident Patch 14: `15aa6c46` (2026-10-05)
**Commit Message**: fix(mobile): compare OTA native code only against builds of the current app id (#9175)

## Summary
- `apps/mobile/scripts/ota-publish.mjs` lists builds with
`--app-identifier` taken from `app.json`, per platform.
- Before: the `production` channel also holds internal APKs of the
retired Android app id. The newest of them never matches `main`'s native
code, so the guard skipped every Android publish with "Rebuild
required", although the Play store build matches.
- Adds `appIdentifier(expo, platform)` and a test that pins both app
ids.

## Test plan
- `cd apps/mobile && bun test scripts/`: 16 pass, 0 fail.
- `node apps/mobile/scripts/ota-publish.mjs production --dry-run`,
before: iOS would publish, Android skipped ("native code differs from
android build 1.4.3 (18)"). After: iOS and Android both would publish
(dry run, nothing published).
- `eas fingerprint:compare` of `main` against the Play store build
(version code 4): 0 native differences.

<!-- codesmith:footer -->
---
<a
href="https://app.blacksmith.sh/kortix-ai/codesmith/suna/pr/9175?autoLogin=true&ref=codesmith_pr_footer"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://pr-comments-assets.blacksmith.sh/co

**File**: `apps/mobile/scripts/ota-publish.mjs` (modified, +12/-2)
```diff
@@ -89,13 +89,23 @@ function lastUpdateCommit(channel, platform, runtime) {
   return easJson(['update:view', group.group]).find((u) => u.platform === platform)?.gitCommitHash ?? null;
 }
 
+/**
+ * The app id this checkout builds for a platform. Only builds of that id are
+ * compared: a channel also carries builds of a retired id (the old Android
+ * `com.kortix.app` APKs), and their native code never matches today's.
+ */
+export function appIdentifier(expo, platform) {
+  return platform === 'ios' ? expo.ios?.bundleIdentifier : expo.android?.package;
+}
+
 /** Why this platform must not publish, or null when it may. */
 export function skipReason(channel, platform, runtime) {
+  const appId = appIdentifier(JSON.parse(readFileSync(join(MOBILE, 'app.json'), 'utf8')).expo, platform);
   const builds = easJson([
-    'build:list', '--channel', channel, '--platform', platform,
+    'build:list', '--channel', channel, '--platform', platform, '--app-identifier', appId,
     '--status', 'finished', '--runtime-version', runtime, '--limit', '50',
   ]);
-  if (builds.length === 0) return `no finished ${platform} build on channel "${channel}" has runtime ${runtime}`;
+  if (builds.length === 0) return `no finished ${platform} build of ${appId} on channel "${channel}" has runtime ${runtime}`;
 
   // The newest build of each distribution (STORE, INTERNAL) is the binary its
   // users run: Apple closes a version once it ships, so a released iOS build is
```

**File**: `apps/mobile/scripts/ota-publish.test.ts` (modified, +8/-1)
```diff
@@ -1,6 +1,7 @@
 import { describe, expect, test } from 'bun:test';
 
-import { nativeDiff, normalizePaths } from './ota-publish.mjs';
+import appJson from '../app.json';
+import { appIdentifier, nativeDiff, normalizePaths } from './ota-publish.mjs';
 
 // Shapes copied from `eas fingerprint:compare --build-id <id> --json` on the
 // 1.4.3 store build: the build side reaches node_modules from a temporary copy
@@ -25,6 +26,12 @@ function fingerprint(nm: string, overrides: { svg?: string; patches?: string; ea
 }
 
 describe('OTA native-change guard', () => {
+  test('compares only builds of the app id this checkout builds', () => {
+    // A stale com.kortix.app APK on the channel must not block the Play app.
+    expect(appIdentifier(appJson.expo, 'android')).toBe('com.kortix.application');
+    expect(appIdentifier(appJson.expo, 'ios')).toBe('com.kortix.app');
+  });
+
   test('normalizes both path forms to the same node_modules path', () => {
     expect(normalizePaths(`${BUILD_NM}${SVG}`)).toBe(`node_modules/${SVG}`);
     expect(normalizePaths(`${LOCAL_NM}${SVG}`)).toBe(`node_modules/${SVG}`);
```

---

### Incident Patch 15: `0c60f2d4` (2026-10-05)
**Commit Message**: fix(gateway): round the ChatGPT usage-limit reset wait (#9174)

## Summary

Follow-up to #9172. When every ChatGPT account in reach rests on its
plan limit, the gateway says "…reached their usage limit. The first
resets in N days." The wait was floored. On dev, a rest of 4 days less a
few seconds read "resets in 3 days" (see the #9172 dev comment). It is
now rounded:

- days (rests of 48 h or more): `Math.round(hours / 24)`;
- hours (2 h to 48 h): `Math.round(hours)`;
- minutes: unchanged, `Math.ceil`.

The prod value from the incident (414374 s, 4.8 days) now reads "5
days".

## Demo video

No video: a one-line change to an error sentence that appears only when
every ChatGPT account is at its plan limit. The tests below pin the
exact sentences. The Slack/Teams card copies the reset text, and its
classifier test passes unchanged.

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Refactor / chore
- [ ] Docs / skills
- [ ] Infrastructure / CI
- [ ] Security fix
- [ ] Breaking change

## How was this tested?

- `cd apps/api && bun test --isolate --env-file=scripts/test.env
src/llm-gateway/resolution/resolve-candidates.test.ts`:
- RED first. 414374 s read "4 days" (now expected

**File**: `apps/api/src/llm-gateway/resolution/resolve-candidates.test.ts` (modified, +10/-1)
```diff
@@ -690,10 +690,19 @@ describe('resolveCandidates — codex + unknown provider', () => {
     pooledSecrets = { configured: true, coolingDown: true, retryAfterSeconds: 414_374, secrets: [] };
     const refusal = await resolveCandidates(principal({ sessionId: 'session-1' }), 'codex/gpt-6.1-sol').catch((e) => e);
     expect(refusal).toMatchObject({ code: 'provider_pool_rate_limited', retryAfterSeconds: undefined });
-    expect(refusal.message).toBe('All selected ChatGPT connections reached their usage limit. The first resets in 4 days.');
+    // 414374 s is 4.8 days: rounded, not floored.
+    expect(refusal.message).toBe('All selected ChatGPT connections reached their usage limit. The first resets in 5 days.');
     expect(refusal.suggestion).toBe('Choose another model, or connect another ChatGPT account.');
   });
 
+  // Dev showed "resets in 3 days" for a rest of 4 days less a few seconds.
+  test('a rest just under a whole number of days reads as that number', async () => {
+    pooledEnabled = true;
+    pooledSecrets = { configured: true, coolingDown: true, retryAfterSeconds: 4 * 86_400 - 30, secrets: [] };
+    const refusal = await resolveCandidates(principal({ sessionId: 'session-1' }), 'codex/gpt-6.1-sol').catch((e) => e);
+    expect(refusal.message).toBe('All selected ChatGPT connections reached their usage limit. The first resets in 4 days.');
+  });
+
   test('every shared ChatGPT account resting for hours names the hours', async () => {
     pooledEnabled = true;
     sharedSecrets = { coolingDown: true, retryAfterSeconds: 3 * 3600 + 100, secrets: [] };
```

**File**: `apps/api/src/llm-gateway/resolution/resolve-candidates.ts` (modified, +3/-2)
```diff
@@ -102,8 +102,9 @@ function chatGptAccountsResting(subject: string, retryAfterSeconds: number | und
     return new GatewayResolutionError('provider_pool_rate_limited', `${subject} are cooling down.`, suggestion, retryAfterSeconds);
   }
   const hours = retryAfterSeconds / 3600;
-  const wait = hours >= 48 ? `${Math.floor(hours / 24)} days`
-    : hours >= 2 ? `${Math.floor(hours)} hours`
+  // Rounded: a floor read 4 days less a few seconds as "3 days".
+  const wait = hours >= 48 ? `${Math.round(hours / 24)} days`
+    : hours >= 2 ? `${Math.round(hours)} hours`
     : `${Math.ceil(retryAfterSeconds / 60)} minutes`;
   return new GatewayResolutionError('provider_pool_rate_limited',
     `${subject} reached their usage limit. The first resets in ${wait}.`,
```

**File**: `tests/attestations/ci-mobile-ota-updates.json` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-{
-  "source_hash": "c2607a7b2e661a2233eb7b44a52b8b609e9b18b43537aa2173dd9986454a56e3",
-  "diff_files": [
-    ".agents/skills/learnings/MEMORY.md",
-    ".agents/skills/learnings/entries/2026-10-02T175952Z-check-the-eas-environment-an-ota-update-bakes-in-eas-update.md",
-    ".github/workflows/mobile-ota.yml",
-    "apps/mobile/.gitignore",
-    "apps/mobile/BUILD_GUIDE.md",
-    "apps/mobile/android/app/build.gradle",
-    "apps/mobile/app.json",
-    "apps/mobile/eas.json",
-    "apps/mobile/ios/Kortix.xcodeproj/project.xcworkspace/contents.xcworkspacedata",
-    "apps/mobile/ios/Kortix.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist",
-    "apps/mobile/package.json",
-    "apps/mobile/scripts/ota-publish.mjs",
-    "apps/mobile/scripts/ota-publish.test.ts",
-    "apps/mobile/scripts/set-version.mjs",
-    "apps/mobile/scripts/set-version.test.ts",
-    "apps/mobile/scripts/start-android.sh",
-    "apps/web/public/.well-known/assetlinks.json",
-    "apps/web/public/manifest.json",
-    "scripts/check-blocked-terms.test.mjs"
-  ],
-  "diff_hash": "503a623c000032121efdd94ff23716d574ebe82d7287110d535b0145abd9db08",
-  "head": "ffdd5a65338afcc84e340bb29c199107f05a0355",
-  "passed": true,
-  "lanes": {
-    "core": "pass",
-    "packages": "pass",
-    "db-suites": "pass"
-  },
-  "at": "2026-10-03T19:46:23.676Z"
-}
```

**File**: `tests/attestations/claude-epic-vaughan-25275d.json` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-{
-  "source_hash": "8abb78dfbea90e3d4cf053dce93867d310e7a08fa0a8af44255487fc11dc1f6a",
-  "diff_files": [
-    "apps/api/src/__tests__/integration-account-identity-email-index.test.ts",
-    "apps/api/src/iam/account-identity.ts",
-    "apps/web/src/lib/seo/content-timestamps.json",
-    "tests/migration/kortix-yolo-profiles-unused-indexes.test.ts"
-  ],
-  "diff_hash": "c4f6fbe8d5d29203e0967d839e8642107fa59533632f8779084bf875e650abc0",
-  "head": "960577b4a63c343650694baed7f0445ec6ebd067",
-  "passed": true,
-  "lanes": {
-    "core": "pass",
-    "packages": "pass",
-    "db-suites": "pass"
-  },
-  "at": "2026-10-05T11:26:56.674Z"
-}
```

**File**: `tests/attestations/ino-chatgpt-usage-limit.json` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-{
-  "source_hash": "cdca136178a1273ced966b9a56ba6571fb544d8e1d326045a620b5598ee92b96",
-  "diff_files": [
-    ".agents/skills/learnings/MEMORY.md",
-    ".agents/skills/learnings/entries/2026-10-05T101914Z-treat-a-provider-pause-as-temporary-a-cooling-key-or-account.md",
-    "apps/api/src/__tests__/integration-usable-gateway-secrets.test.ts",
-    "apps/api/src/__tests__/unit-slack-error-classify.test.ts",
-    "apps/api/src/channels/slack/errors.ts",
-    "apps/api/src/llm-gateway/internal-routes.test.ts",
-    "apps/api/src/llm-gateway/internal-routes.ts",
-    "apps/api/src/llm-gateway/resolution/default-model.test.ts",
-    "apps/api/src/llm-gateway/resolution/default-model.ts",
-    "apps/api/src/llm-gateway/resolution/resolve-candidates.test.ts",
-    "apps/api/src/llm-gateway/resolution/resolve-candidates.ts",
-    "apps/api/src/secrets/account-resource.ts",
-    "apps/web/src/features/session/header/session-site-header.test.tsx",
-    "apps/web/src/features/session/persisted-turn-failure.test.ts",
-    "apps/web/src/features/session/persisted-turn-failure.ts",
-    "apps/web/src/features/session/session-chat.tsx",
-    "apps/web/src/lib/seo/content-timestamps.json",
-    "packages/llm-gateway/src/pipeline/dispatch.test.ts",
-    "packages/llm-gateway/src/pipeline/dispatch.ts",
-    "packages/sdk/src/core/turns/errors.test.ts",
-    "packages/sdk/src/core/turns/errors.ts"
-  ],
-  "diff_hash": "274c242b0235c3b43b63b903e1b4d26040b284f2c4839f75c6cf57afceb9a85c",
-  "head": "c091b0a274b7c351b8eb1850a94f65fc4eaba4b7",
-  "passed": false,
-  "lanes": {
-    "core": "fail",
-    "packages": "fail",
-    "db-suites": "fail"
-  },
-  "at": "2026-10-05T11:18:34.352Z"
-}
```

**File**: `tests/attestations/ino-usage-limit-rounding.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+{
+  "source_hash": "3280ce218cf17cc9c31e8412ad66bb46de82eb29f3ecdc83048f307839a41165",
+  "diff_files": [
+    "apps/api/src/llm-gateway/resolution/resolve-candidates.test.ts",
+    "apps/api/src/llm-gateway/resolution/resolve-candidates.ts"
+  ],
+  "diff_hash": "18f5f0af9f7ee08ced4c137e5b67add148309fbe0d2c4dd9198655688ed32629",
+  "head": "480ba7e1ab7d12db4a1360bc29a08e07a1e72c61",
+  "passed": false,
+  "lanes": {
+    "core": "fail",
+    "packages": "fail",
+    "db-suites": "fail"
+  },
+  "at": "2026-10-05T12:03:50.419Z"
+}
```

#### Recent Merged Pull Requests:
- **PR #9199** (2026-10-05): fix(config-releases): relative OpenCode instructions read the release, not /workspace (@DimitrijeGlibic)
- **PR #9198** (2026-10-05): fix(snapshots): a failed Platinum template build names its cause (@kubet)
- **PR #9197** (2026-10-05): feat(config-releases): a release is a checkout of the base branch, with the repository's own layout (@DimitrijeGlibic)
- **PR #9195** (2026-10-05): Promote selected main commits (through 2010294429) to staging (@sutharjay1)
- **PR #9194** (2026-10-05): fix(desktop): show the DMG background on macOS 26 (@sutharjay1)
- **PR #9193** (2026-10-05): fix(auth): a signed-out device's bearer stops working at once; label the device routes (@DimitrijeGlibic)
- **PR #9192** (2026-10-05): fix(mobile): scroll the drawer nav pills with the session list (@sutharjay1)
- **PR #9190** (2026-10-05): feat(desktop): drag-to-install DMG window with a dithered background (@sutharjay1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
