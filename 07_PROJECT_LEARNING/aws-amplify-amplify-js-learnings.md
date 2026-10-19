> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source**: github ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Source Version**: `26b49ecd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T00:54:36.668Z  
> **Learning ID**: `learn-github-aws-amplify-amplify-js`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): aws-amplify/amplify-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T00:54:36.661Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws-amplify/amplify-js`
- **Description**: A declarative JavaScript library for application development using cloud services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9551 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/appendSetCookieHeaders.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { CookieStorage } from 'aws-amplify/adapter-core';

import { serializeCookie } from '../../utils/cookie';

export const appendSetCookieHeaders = (
	headers: Headers,
	cookies: { name: string; value: string }[],
	setCookieOptions?: CookieStorage.SetCookieOptions,
): void => {
	for (const { name, value } of cookies) {
		headers.append(
			'Set-Cookie',
			serializeCookie(name, value, setCookieOptions),
		);
	}
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/appendSetCookieHeadersToNextApiResponse.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NextApiResponse } from 'next';
import { CookieStorage } from 'aws-amplify/adapter-core';

import { serializeCookie } from '../../utils/cookie';

export const appendSetCookieHeadersToNextApiResponse = (
	response: NextApiResponse,
	cookies: { name: string; value: string }[],
	setCookieOptions?: CookieStorage.SetCookieOptions,
): void => {
	for (const { name, value } of cookies) {
		response.appendHeader(
			'Set-Cookie',
			serializeCookie(name, value, setCookieOptions),
		);
	}
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/authFlowProofCookies.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CookieStorage } from 'aws-amplify/adapter-core';

import {
	AUTH_FLOW_PROOF_MAX_AGE,
	IS_SIGNING_OUT_COOKIE_NAME,
	IS_SIGNING_OUT_REDIRECTING_COOKIE_NAME,
	PKCE_COOKIE_NAME,
	REMOVE_COOKIE_MAX_AGE,
	STATE_COOKIE_NAME,
} from '../constant';

import { isSSLOrigin } from './origin';

export const createSignInFlowProofCookies = ({
	state,
	pkce,
}: {
	state: string;
	pkce: string;
}) => [
	{
		name: PKCE_COOKIE_NAME,
		value: pkce,
	},
	{
		name: STATE_COOKIE_NAME,
		value: state,
	},
];

export const createSignOutFlowProofCookies = () => [
	{
		name: IS_SIGNING_OUT_COOKIE_NAME,
		value: 'true',
	},
	{
		name: IS_SIGNING_OUT_REDIRECTING_COOKIE_NAME,
		value: 'true',
	},
];

export const createAuthFlowProofCookiesSetOptions = (
	setCookieOptions: CookieStorage.SetCookieOptions,
	origin: string,
) => ({
	domain: setCookieOptions?.domain,
	path: '/',
	httpOnly: true,
	secure: isSSLOrigin(origin),
	sameSite: 'lax' as const,
	maxAge: AUTH_FLOW_PROOF_MAX_AGE,
});

export const createAuthFlowProofCookiesRemoveOptions = (
	setCookieOptions: CookieStorage.SetCookieOptions,
) => ({
	domain: setCookieOptions?.domain,
	path: '/',
	maxAge: REMOVE_COOKIE_MAX_AGE,
});

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/authNTokens.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OAuthConfig } from 'aws-amplify/adapter-core/internals';

import { OAUTH_GRANT_TYPE } from '../constant';
import { OAuthTokenExchangeResult, OAuthTokenRevocationResult } from '../types';

import {
	createUrlSearchParamsForTokenExchange,
	createUrlSearchParamsForTokenRevocation,
} from './createUrlSearchParams';
import {
	createRevokeEndpoint,
	createTokenEndpoint,
} from './cognitoHostedUIEndpoints';

export const exchangeAuthNTokens = async ({
	redirectUri,
	userPoolClientId,
	oAuthConfig,
	code,
	codeVerifier,
}: {
	redirectUri: string;
	userPoolClientId: string;
	oAuthConfig: OAuthConfig;
	code: string;
	codeVerifier: string;
}): Promise<OAuthTokenExchangeResult> => {
	const searchParams = createUrlSearchParamsForTokenExchange({
		client_id: userPoolClientId,
		code,
		redirect_uri: redirectUri,
		code_verifier: codeVerifier,
		grant_type: OAUTH_GRANT_TYPE,
	});

	const oAuthTokenEndpoint = createTokenEndpoint(oAuthConfig.domain);
	const tokenExchangeResponse = await fetch(oAuthTokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache',
		},
		body: searchParams.toString(),
	});

	// Exchanging an authorization code grant with PKCE for tokens with
	// `grant_type=authorization_code` produces a stable shape of payload.
	// Details see https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
	// Possible errors: invalid_request|invalid_client|invalid_grant|unauthorized_client|unsupported_grant_type
	// Should not happen unless configuration is wrong;
	return (await tokenExchangeResponse.json()) as OAuthTokenExchangeResult;
};

export const revokeAuthNTokens = async ({
	userPoolClientId,
	refreshToken,
	endpointDomain,
}: {
	userPoolClientId: string;
	refreshToken: string;
	endpointDomain: string;
}): Promise<OAuthTokenRevocationResult> => {
	const searchParams = createUrlSearchParamsForTokenRevocation({
		client_id: userPoolClientId,
		token: refreshToken,
	});
	const oAuthTokenRevocationEndpoint = createRevokeEndpoint(endpointDomain);
	const response = await fetch(oAuthTokenRevocationEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache',
		},
		body: searchParams.toString(),
	});
	const contentLength = parseInt(
		response.headers.get('Content-Length') ?? '0',
		10,
	);

	return contentLength === 0
		? {}
		: ((await response.json()) as OAuthTokenRevocationResult);
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/cognitoHostedUIEndpoints.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const createAuthorizeEndpoint = (
	domain: string,
	urlSearchParams: URLSearchParams,
): string =>
	new URL(
		`https://${domain}/oauth2/authorize?${urlSearchParams.toString()}`,
	).toString();

export const createTokenEndpoint = (domain: string): string =>
	new URL(`https://${domain}/oauth2/token`).toString();

export const createRevokeEndpoint = (domain: string) =>
	new URL(`https://${domain}/oauth2/revoke`).toString();

export const createSignUpEndpoint = (
	domain: string,
	urlSearchParams: URLSearchParams,
): string =>
	new URL(`https://${domain}/signup?${urlSearchParams.toString()}`).toString();

export const createLogoutEndpoint = (
	domain: string,
	urlSearchParams: URLSearchParams,
): string =>
	new URL(`https://${domain}/logout?${urlSearchParams.toString()}`).toString();

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/createAuthFlowProofs.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { urlSafeEncode } from 'aws-amplify/adapter-core/internals';
import { generateCodeVerifier, generateState } from 'aws-amplify/adapter-core';

export const createAuthFlowProofs = ({
	customState,
}: {
	customState?: string;
}): {
	codeVerifier: ReturnType<typeof generateCodeVerifier>;
	state: string;
} => {
	const codeVerifier = generateCodeVerifier(128);
	const randomState = generateState();
	const state = customState
		? `${randomState}-${urlSafeEncode(customState)}`
		: randomState;

	return { codeVerifier, state };
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/createErrorSearchParamsString.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const createErrorSearchParamsString = ({
	error,
	errorDescription,
}: {
	error: string | null;
	errorDescription: string | null;
}): string => {
	const errorParams = new URLSearchParams();

	if (error) {
		errorParams.set('error', error);
	}

	if (errorDescription) {
		errorParams.set('error_description', errorDescription);
	}

	return errorParams.toString();
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/createRedirectionIntermediary.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const createRedirectionIntermediary = ({
	redirectTo: redirectOnSignInComplete,
}: {
	redirectTo: string;
}) => createHTML(redirectOnSignInComplete);

// This HTML does the following:
// 1. redirect to `redirectTarget` using JavaScript on page load
// 2. redirect to `redirectTarget` relying on the meta tag if JavaScript is disabled
// 3. display a link to `redirectTarget` if the redirect does not happen
const createHTML = (redirectTarget: string) => `
<!DOCTYPE html>
	<html>
	<head>
			<title>Redirecting...</title>
			<meta http-equiv="refresh" content="0; URL='${redirectTarget}'" />
			<script>window.location.replace("${redirectTarget}")</script>
	</head>
	<body>
			<p>If you are not redirected automatically, follow this <a href="${redirectTarget}">link to the new page</a>.</p>
	</body>
</html>`;

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/createUrlSearchParams.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OAuthConfig } from 'aws-amplify/adapter-core/internals';
import { generateCodeVerifier } from 'aws-amplify/adapter-core';

import { resolveIdentityProviderFromUrl } from './resolveIdentityProviderFromUrl';
import { resolveRedirectSignInUrl } from './resolveRedirectUrl';
import { getSearchParamValueFromUrl } from './getSearchParamValueFromUrl';

export const createUrlSearchParamsForSignInSignUp = ({
	url,
	oAuthConfig,
	userPoolClientId,
	state,
	origin,
	codeVerifier,
}: {
	url: string;
	oAuthConfig: OAuthConfig;
	userPoolClientId: string;
	state: string;
	origin: string;
	codeVerifier: ReturnType<typeof generateCodeVerifier>;
}): URLSearchParams => {
	const resolvedProvider = resolveIdentityProviderFromUrl(url);
	const lang = getSearchParamValueFromUrl(url, 'lang');

	const redirectUrlSearchParams = new URLSearchParams({
		redirect_uri: resolveRedirectSignInUrl(origin, oAuthConfig),
		response_type: oAuthConfig.responseType,
		client_id: userPoolClientId,
		scope: oAuthConfig.scopes.join(' '),
		state,
		code_challenge: codeVerifier.toCodeChallenge(),
		code_challenge_method: codeVerifier.method,
	});

	if (resolvedProvider) {
		redirectUrlSearchParams.append('identity_provider', resolvedProvider);
	}

	if (lang) {
		redirectUrlSearchParams.append('lang', lang);
	}

	return redirectUrlSearchParams;
};

export const createUrlSearchParamsForTokenExchange = (input: {
	code: string;
	client_id: string;
	redirect_uri: string;
	code_verifier: string;
	grant_type: string;
}): URLSearchParams => new URLSearchParams(input);

export const createUrlSearchParamsForTokenRevocation = (input: {
	token: string;
	client_id: string;
}): URLSearchParams => new URLSearchParams(input);

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/getAccessTokenUsername.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { decodeJWT } from 'aws-amplify/adapter-core/internals';

export const getAccessTokenUsername = (accessToken: string): string =>
	decodeJWT(accessToken).payload.username as string;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14978** (2026-10-06): **[Auth] fetchAuthSession throws "Access to Identity is forbidden" after a failed token refresh because the signed-in user's identityId is reused for guest access**
  *Symptoms*: ### Describe the bug  After a token refresh fails with an authentication error (for example, a revoked or expired refresh token, or an admin global sign-out), `fetchAuthSession()` throws on every call for the rest of the page's lifetime:  ``` NotAuthorizedException: Access to Identity 'us-west-2:…' is forbidden. ```  This happens with an identity pool that allows guest access.  Cause: 1. While the user is signed in, `DefaultIdentityIdStore` keeps the user's authenticated identityId in memory (`_primaryIdentityId`). 2. When the refresh fails, `TokenOrchestrator.handleErrors` clears the tokens and returns `null`. Nothing clears `_primaryIdentityId`; only `signOut()` calls `clearCredentialsAndIdentityId()`. 3. `fetchAuthSession()` now has no tokens, so it calls the credentials provider with `authenticated: false`. `cognitoIdentityIdProvider` calls `loadIdentityId()`, which returns the in-memory primary identityId first (`IdentityIdStore.ts`). 4. `getGuestCredentials` sends that authenticated identityId to `GetCredentialsForIdentity` without `Logins`. Cognito rejects it as forbidden, and the same identityId is used again on every call.  The app can only recover by reloading the page or calling `signOut()`.  This was found while investigating #14975 (listed there under "A leftover primary ID in the guest branch"). It is reported separately because the library gets into this state on its own.  ### Expected behavior  With no tokens, `fetchAuthSession()` does not use the signed-in us

- **Issue #14974** (2026-10-06): **[adapter-nextjs] Server-side cookie deletion omits `Path`, so auth cookies are not removed on `_next/data`, nested-route and API-route requests**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Next.js  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  storage, auth  ### Backend  Other  ### Environment information  <details>  ```   System:     OS: Windows 11 10.0.26200   Binaries:     Node: 26.7.0     npm: 11.19.0   Browsers:     Chrome: 154.0.8037.97   npmPackages:     @aws-amplify/adapter-nextjs: 1.8.0 => 1.8.0     aws-amplify: 6.22.1 => 6.22.1 (@aws-amplify/auth 6.21.1, @aws-amplify/core 6.19.2)     next: 16.3.8 => 16.3.8     react: 19.3.0 => 19.3.0     react-dom: 19.3.0 => 19.3.0     playwright: 1.62.0 => 1.62.0     typescript: 6.0.3 => 6.0.3 ``` (trimmed `npx envinfo` output; the full output only adds unresolved sub-paths)  </details>  ### Describe the bug  Cookies written through `createKeyValueStorageFromCookieStorageAdapter` get `Path=/` ([L13-L17](https://github.com/aws-amplify/amplify-js/blob/88f2d79878df66754caf85b7c409df912739f53d/packages/aws-amplify/src/adapter-core/storageFactories/createKeyValueStorageFromCo

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

### Incident Patch 1: `556185e7` (2026-09-09)
**Commit Message**: fix(auth): bound waiting on inflight OAuth flow with read-time deadline (#14942)

* fix(auth): bound waiting on an inflight OAuth flow with a read-time deadline

fetchAuthSession/getCurrentUser could hang forever when another tab started
signInWithRedirect and abandoned the Hosted UI page: the shared inflightOAuth
flag has no expiry and parked waiters were only released by the tab that
completes the flow.

- signInWithRedirect now records a blocking deadline in a sibling storage key
  (inflightOAuthDeadline, 5 min), written before the flag so racing readers
  never misclassify the writer as legacy
- TokenOrchestrator.waitForInflightOAuth evaluates the deadline at read time
  and arms a singleton backstop timer on every park (covers the release-race,
  missing storage events, and abandoned flows)
- a cross-tab storage listener releases parked waiters as soon as the owning
  tab settles the flow (requires the crossTab storage listener machinery)
- the completion gate keeps ignoring the deadline and no tab ever mutates
  another tab's flow state, so slow-but-successful logins still complete
- flags written by older library versions get a persisted default deadline
  from first observa

**File**: `.changeset/oauth-inflight-deadline.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+'@aws-amplify/auth': patch
+---
+
+fix(auth): bound waiting on an inflight OAuth flow with a read-time deadline
+
+`fetchAuthSession` / `getCurrentUser` could previously hang forever when another
+tab started `signInWithRedirect` and abandoned the Hosted UI page: the shared
+`inflightOAuth` flag has no expiry and the parked promise was only released by
+the tab completing the flow.
+
+The flow now records a blocking deadline next to the flag (`inflightOAuthDeadline`,
+5 minutes). Token consumers evaluate it at read time and park with a backstop
+timer, and a cross-tab storage listener releases waiters as soon as the owning
+tab settles the flow. The deadline bounds only how long other work may block —
+the completion path deliberately ignores it, and no tab ever mutates another
+tab's flow state, so a slow-but-successful login still completes. Flags written
+by older library versions are handled by persisting a default deadline on first
+observation.
```

**File**: `packages/auth/__tests__/providers/cognito/tokenOrchestrator.test.ts` (modified, +18/-1)
```diff
@@ -42,6 +42,7 @@ const validAuthConfig: ResourcesConfig = {
 
 jest.mock('../../../src/providers/cognito/utils/oauth/inflightPromise', () => ({
 	addInflightPromise: jest.fn(),
+	armInflightDeadline: jest.fn(),
 }));
 
 const currentDate = new Date();
@@ -143,13 +144,29 @@ describe('TokenOrchestrator', () => {
 
 		it('Should call addInflightPromise when OAuth is inflight', async () => {
 			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
-			(oAuthStore.loadOAuthInFlight as jest.Mock).mockResolvedValue(true);
+			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
+				Date.now() + 60_000,
+			);
 
 			const tokens = await tokenOrchestrator.getTokens();
 
 			expect(addInflightPromise).toHaveBeenCalledWith(expect.any(Function));
 			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
 		});
+
+		it('Should not block when the inflight OAuth blocking deadline has passed', async () => {
+			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
+			// An absent or expired deadline is reported as `undefined` by the store.
+			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
+				undefined,
+			);
+			mockAddInflightPromise.mockClear();
+
+			const tokens = await tokenOrchestrator.getTokens();
+
+			expect(addInflightPromise).not.toHaveBeenCalled();
+			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
+		});
 	});
 
 	describe('setClientMetadataProvider', () => {
```

**File**: `packages/auth/__tests__/providers/cognito/utils/oauth/inflightOAuthDeadline.test.ts` (added, +276/-0)
```diff
@@ -0,0 +1,276 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { defaultStorage } from '@aws-amplify/core';
+
+import { TokenOrchestrator } from '../../../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
+import { AUTH_KEY_PREFIX } from '../../../../../src/providers/cognito/tokenProvider/constants';
+import {
+	DefaultOAuthStore,
+	OAUTH_INFLIGHT_TTL_MS,
+} from '../../../../../src/providers/cognito/utils/signInWithRedirectStore';
+import { oAuthStore } from '../../../../../src/providers/cognito/utils/oauth/oAuthStore';
+import { resolveAndClearInflightPromises } from '../../../../../src/providers/cognito/utils/oauth/inflightPromise';
+
+// Registers the browser-only side effects at module load — including the
+// cross-tab storage listener that releases parked token consumers when the
+// inflight flag is removed in another tab.
+import '../../../../../src/providers/cognito/utils/oauth/enableOAuthListener';
+
+// Per repo convention only the boundaries are mocked: `isBrowser` (so the
+// browser-only branches are taken deterministically). The real oAuthStore,
+// defaultStorage (jsdom localStorage), inflightPromise module, and
+// TokenOrchestrator internals are exercised.
+jest.mock('@aws-amplify/core/internals/utils', () => ({
+	...jest.requireActual('@aws-amplify/core/internals/utils'),
+	isBrowser: jest.fn(() => true),
+}));
+
+const userPoolClientId = 'test-client-id';
+const authConfig = {
+	Cognito: {
+		userPoolId: 'us-east-1_test-id',
+		userPoolClientId,
+	},
+};
+
+const inflightKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.inflightOAuth`;
+const deadlineKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.inflightOAuthDeadline`;
+const pkceKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.oauthPKCE`;
+const stateKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.oauthState`;
+
+// Bounded microtask drain, used ONLY ahead of NEGATIVE (`isSettled() === false`)
+// assertions, where it is safe by construction: draining too little can only
+// make the assertion weaker, never flaky-pass a regression, and extra passes
+// only strengthen it. POSITIVE assertions never rely on this — they `await`
+// the parked promise itself, which is deterministic at any async-chain depth
+// and turns a regression into a hard jest timeout instead of a silent
+// under-drain (jest's jsdom provides neither setImmediate nor MessageChannel
+// for a true macrotask boundary).
+const drainMicrotasks = async () => {
+	for (let i = 0; i < 25; i++) {
+		await Promise.resolve();
+	}
+};
+
+const createOrchestrator = () => {
+	const orchestrator = new TokenOrchestrator();
+	orchestrator.setAuthConfig(authConfig as any);
+
+	return orchestrator;
+};
+
+const park = (orchestrator: TokenOrchestrator) => {
+	let settled = false;
+	const promise = orchestrator.waitForInflightOAuth().then(() => {
+		settled = true;
+	});
+
+	return { promise, isSettled: () => settled };
+};
+
+describe('inflight OAuth blocking deadline', () => {
+	beforeEach(() => {
+		jest.useFakeTimers();
+		window.localStorage.clear();
+	});
+
+	afterEach(async () => {
+		// Drain any parked waiters and clear the singleton backstop timer so
+		// module-level state never leaks between tests.
+		resolveAndClearInflightPromises();
+		await drainMicrotasks();
+		jest.clearAllTimers();
+		jest.useRealTimers();
+	});
+
+	it('does not block when no OAuth flow is in flight', async () => {
+		const orchestrator = createOrchestrator();
+
+		// Deterministic positive assertion: resolves without any timer advance,
+		// or times out the test on regression.
+		await park(orchestrator).promise;
+	});
+
+	it('parks while a flow is in flight and releases once the deadline passes, without mutating shared state', async () => {
+		await oAuthStore.storeOAuthInFlight(true);
+		await defaultStorage.setItem(pkceKey, 'test-pkce');
+		await defaultStorage.setItem(stateKey, 'test-state');
+
+		const orchestrator = createOrchestrator();
+		const waiter = park(orchestrator);
+		await drainMicrotasks();
+		expect(waiter.isSettled()).toBe(false);
+
+		// One millisecond before the deadline: still parked.
+		await jest.advanceTimersByTimeAsync(OAUTH_INFLIGHT_TTL_MS - 1);
+		await drainMicrotasks();
+		expect(waiter.isSettled()).toBe(false);
+
+		// Deadline passes: the backstop timer releases the waiter locally...
+		await jest.advanceTimersByTimeAsync(2);
+		await waiter.promise;
+
+		// ...while the (possibly still running) flow's shared state is intact:
+		// only the flow-owner tab may mutate it.
+		expect(window.localStorage.getItem(inflightKey)).toBe('true');
+		expect(window.localStorage.getItem(deadlineKey)).not.toBeNull();
+		expect(window.localStorage.getItem(pkceKey)).toBe('test-pkce');
+		expect(window.localStorage.getItem(stateKey)).toBe('test-state');
+	});
+
+	it('releases parked waiters when another tab removes the inflight flag', async () => {
+		await oAuthStore.storeOAuthInFlight(true);
+
+		const or
```

**File**: `packages/auth/src/providers/cognito/tokenProvider/TokenOrchestrator.ts` (modified, +44/-5)
```diff
@@ -18,7 +18,10 @@ import {
 import { assertServiceError } from '../../../errors/utils/assertServiceError';
 import { AuthError } from '../../../errors/AuthError';
 import { oAuthStore } from '../utils/oauth/oAuthStore';
-import { addInflightPromise } from '../utils/oauth/inflightPromise';
+import {
+	addInflightPromise,
+	armInflightDeadline,
+} from '../utils/oauth/inflightPromise';
 import { ClientMetadata, CognitoAuthSignInDetails } from '../types';
 
 import {
@@ -38,20 +41,53 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 	inflightPromise: Promise<void> | undefined;
 	waitForInflightOAuth: () => Promise<void> = isBrowser()
 		? async () => {
-				if (!(await oAuthStore.loadOAuthInFlight())) {
+				// Read-time evaluation of the blocking deadline: absent flag, an
+				// expired deadline, or a flag value other than 'true' all mean
+				// "do not block". An abandoned flow in another tab can therefore
+				// never park token consumers indefinitely.
+				// (`loadOAuthInFlightDeadline` is optional on the OAuthStore
+				// interface for custom-implementation compatibility, but this
+				// singleton is always the concrete DefaultOAuthStore, which
+				// implements it.)
+				const deadline = await oAuthStore.loadOAuthInFlightDeadline();
+				if (deadline === undefined) {
 					return;
 				}
 
 				if (this.inflightPromise) {
+					// Keep the backstop aligned with the current deadline for waiters
+					// piggybacking on the existing park.
+					armInflightDeadline(deadline, () =>
+						oAuthStore.loadOAuthInFlightDeadline(),
+					);
+
 					return this.inflightPromise;
 				}
 
 				// when there is valid oauth config and there is an inflight oauth flow, try
 				// to block async calls that require fetching tokens before the oauth flow completes
 				// e.g. getCurrentUser, fetchAuthSession etc.
 
-				this.inflightPromise = new Promise<void>((resolve, _reject) => {
-					addInflightPromise(resolve);
+				this.inflightPromise = new Promise<void>(resolve => {
+					// Invariant: `this.inflightPromise` is owned by the park lifecycle —
+					// created here and reset by the very resolver that releases it
+					// (drained by the backstop timer, the cross-tab listener, or
+					// in-process completion). Resetting BEFORE resolving closes the
+					// post-release hole where a caller for a NEW flow could observe a
+					// stale, already-resolved promise and skip blocking on it.
+					addInflightPromise(() => {
+						this.inflightPromise = undefined;
+						resolve();
+					});
+					// Arm the deadline backstop in the same synchronous step as the
+					// park: it releases this waiter even when the cross-tab release
+					// fired between the deadline read above and this park (that storage
+					// event never re-fires), when storage events are unavailable
+					// (Safari private mode), or when the flow is simply never
+					// completed anywhere.
+					armInflightDeadline(deadline, () =>
+						oAuthStore.loadOAuthInFlightDeadline(),
+					);
 				});
 
 				return this.inflightPromise;
@@ -115,7 +151,10 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 			return null;
 		}
 		await this.waitForInflightOAuth();
-		this.inflightPromise = undefined;
+		// NOTE: `this.inflightPromise` is reset by the resolver registered in
+		// `waitForInflightOAuth` (co-located with the release), NOT here — a reset
+		// here could clobber a newer flow's park created between the release and
+		// this line resuming.
 		tokens = await this.getTokenStore().loadTokens();
 		const username = await this.getTokenStore().getLastAuthUser();
 
```

**File**: `packages/auth/src/providers/cognito/utils/oauth/enableOAuthListener.ts` (modified, +30/-0)
```diff
@@ -3,13 +3,19 @@
 
 import {
 	Hub,
+	KeyValueStorageEvent,
 	ResourcesConfig,
+	defaultStorage,
 	getGlobalContext,
 	hasGlobalContext,
 } from '@aws-amplify/core';
 import { isBrowser } from '@aws-amplify/core/internals/utils';
 
+import { AUTH_KEY_PREFIX } from '../../tokenProvider/constants';
+import { OAuthStorageKeys } from '../types';
+
 import { attemptCompleteOAuthFlow } from './attemptCompleteOAuthFlow';
+import { resolveAndClearInflightPromises } from './inflightPromise';
 
 // Synchronous re-entry guard for the OAuth completion side effect (PR #14925).
 //
@@ -71,6 +77,30 @@ if (isBrowser()) {
 		}
 	});
 
+	// Cross-tab release of parked token consumers: when the tab owning an
+	// inflight OAuth flow settles it (success, failure, or cancellation), it
+	// removes the `inflightOAuth` flag from shared storage — `completeOAuthFlow`
+	// on success, `handleFailure` otherwise. Observing that transition here
+	// releases this tab's waiters (`fetchAuthSession`, `getCurrentUser`, ...)
+	// immediately instead of leaving them parked until the blocking-deadline
+	// backstop fires. The release is purely local; no shared state is mutated.
+	// Registered for the module (page) lifetime, mirroring the Hub subscription
+	// above — deliberately never unsubscribed.
+	defaultStorage.addListener?.(async (event: KeyValueStorageEvent) => {
+		const { key, newValue } = event;
+		// Match by prefix/suffix rather than positional `split('.')`, consistent
+		// with the cross-tab token listener (key shape:
+		// `${AUTH_KEY_PREFIX}.<clientId>.inflightOAuth`).
+		if (
+			!!key &&
+			key.startsWith(`${AUTH_KEY_PREFIX}.`) &&
+			key.endsWith(`.${OAuthStorageKeys.inflightOAuth}`) &&
+			newValue !== 'true'
+		) {
+			resolveAndClearInflightPromises();
+		}
+	});
+
 	// Catch-up: `Amplify.configure()` may have run before this module was
 	// imported (dynamic imports / code-splitting), in which case the 'configure'
 	// Hub event already fired and was missed. If a global context configured with
```

**File**: `packages/auth/src/providers/cognito/utils/oauth/inflightPromise.ts` (modified, +55/-0)
```diff
@@ -3,11 +3,66 @@
 
 const inflightPromises: ((value: void | PromiseLike<void>) => void)[] = [];
 
+// Module-level singleton backstop timer for the inflight OAuth blocking
+// deadline. A single timer (not one per waiter) is sufficient because all
+// parked waiters share one release (`resolveAndClearInflightPromises` drains
+// them all), and every park re-arms it with the current deadline.
+let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
+
 export const addInflightPromise = (resolver: () => void) => {
 	inflightPromises.push(resolver);
 };
 
+/**
+ * Arms (or re-arms) the backstop timer that releases parked token consumers
+ * once the inflight OAuth blocking deadline passes.
+ *
+ * On fire it re-reads the deadline instead of trusting the armed one: a fresh
+ * `signInWithRedirect` may have renewed it (re-arm for the new deadline), or
+ * the flow may have been released through another path already (the re-check
+ * returns `undefined` and draining is a no-op). The release is purely local —
+ * it never mutates shared OAuth state, so another tab's still-running flow is
+ * left intact.
+ *
+ * Note: browsers throttle timers in background tabs, which may delay (never
+ * prevent) this release; the cross-tab storage listener remains the fast path.
+ */
+export const armInflightDeadline = (
+	deadline: number,
+	recheckDeadline: () => Promise<number | undefined>,
+) => {
+	if (deadlineTimer !== undefined) {
+		clearTimeout(deadlineTimer);
+	}
+	deadlineTimer = setTimeout(
+		() => {
+			deadlineTimer = undefined;
+			recheckDeadline()
+				.then(renewedDeadline => {
+					if (renewedDeadline !== undefined) {
+						armInflightDeadline(renewedDeadline, recheckDeadline);
+
+						return;
+					}
+					resolveAndClearInflightPromises();
+				})
+				// Fail open: an error while re-checking (e.g. auth config torn down)
+				// must release the waiters rather than leave them parked forever.
+				.catch(() => {
+					resolveAndClearInflightPromises();
+				});
+		},
+		Math.max(0, deadline - Date.now()),
+	);
+};
+
 export const resolveAndClearInflightPromises = () => {
+	// The waiters this timer guarded are being released through this very call
+	// (whatever triggered it) — clear it so no stale timer outlives its waiters.
+	if (deadlineTimer !== undefined) {
+		clearTimeout(deadlineTimer);
+		deadlineTimer = undefined;
+	}
 	while (inflightPromises.length) {
 		inflightPromises.pop()?.();
 	}
```

**File**: `packages/auth/src/providers/cognito/utils/signInWithRedirectStore.ts` (modified, +62/-0)
```diff
@@ -14,6 +14,14 @@ import { OAuthStorageKeys, OAuthStore } from './types';
 
 const V5_HOSTED_UI_KEY = 'amplify-signin-with-hostedUI';
 
+// Bounds how long OTHER auth work (fetchAuthSession, getCurrentUser, ...) may
+// block on an inflight OAuth flow, aligned with the validity period of a
+// Cognito authorization code. It does NOT bound the flow itself: the
+// completion path (`attemptCompleteOAuthFlow`) deliberately keeps gating on
+// the raw `loadOAuthInFlight` flag and ignores this deadline, so a
+// slow-but-successful Hosted UI login still completes after it passes.
+export const OAUTH_INFLIGHT_TTL_MS = 5 * 60 * 1000;
+
 export class DefaultOAuthStore implements OAuthStore {
 	keyValueStorage: KeyValueStorageInterface;
 	cognitoConfig?: CognitoUserPoolConfig;
@@ -31,6 +39,7 @@ export class DefaultOAuthStore implements OAuthStore {
 		);
 		await Promise.all([
 			this.keyValueStorage.removeItem(authKeys.inflightOAuth),
+			this.keyValueStorage.removeItem(authKeys.inflightOAuthDeadline),
 			this.keyValueStorage.removeItem(authKeys.oauthPKCE),
 			this.keyValueStorage.removeItem(authKeys.oauthState),
 		]);
@@ -109,13 +118,66 @@ export class DefaultOAuthStore implements OAuthStore {
 		);
 	}
 
+	async loadOAuthInFlightDeadline(): Promise<number | undefined> {
+		assertTokenProviderConfig(this.cognitoConfig);
+		const { userPoolClientId } = this.cognitoConfig;
+
+		if (!(await this.loadOAuthInFlight())) {
+			return undefined;
+		}
+
+		const authKeys = createKeysForAuthStorage(
+			AUTH_KEY_PREFIX,
+			userPoolClientId,
+		);
+
+		const storedDeadline = await this.keyValueStorage.getItem(
+			authKeys.inflightOAuthDeadline,
+		);
+		let deadline = Number(storedDeadline);
+
+		if (storedDeadline === null || Number.isNaN(deadline)) {
+			// Legacy writer (an older library version set the flag without a
+			// deadline). Persist a default deadline counted from first observation
+			// so it stays stable across tabs and page reloads instead of resetting
+			// on every load. This write is purely additive — the legacy flow's own
+			// state (inflight flag, PKCE, state) is never touched, and legacy
+			// readers ignore the extra key. Independent first-observers race this
+			// write (last writer wins), so the persisted deadline can shift by the
+			// observation-time gap between tabs — harmless, as it stays bounded by
+			// observation time + OAUTH_INFLIGHT_TTL_MS.
+			deadline = Date.now() + OAUTH_INFLIGHT_TTL_MS;
+			await this.keyValueStorage.setItem(
+				authKeys.inflightOAuthDeadline,
+				String(deadline),
+			);
+		}
+
+		// An expired deadline makes the flag inert for BLOCKING purposes only; it
+		// is evaluated at read time, never enforced by deleting the flow state
+		// (only the flow-owner tab mutates it), so a slow login can still finish.
+		return deadline > Date.now() ? deadline : undefined;
+	}
+
 	async storeOAuthInFlight(inflight: boolean): Promise<void> {
 		assertTokenProviderConfig(this.cognitoConfig);
 		const authKeys = createKeysForAuthStorage(
 			AUTH_KEY_PREFIX,
 			this.cognitoConfig.userPoolClientId,
 		);
 
+		if (inflight) {
+			// Write the deadline BEFORE the flag: a reader racing the two storage
+			// writes must never observe the flag without its deadline, or it would
+			// misclassify this writer as a legacy one and persist its own default.
+			await this.keyValueStorage.setItem(
+				authKeys.inflightOAuthDeadline,
+				String(Date.now() + OAUTH_INFLIGHT_TTL_MS),
+			);
+		} else {
+			await this.keyValueStorage.removeItem(authKeys.inflightOAuthDeadline);
+		}
+
 		await this.keyValueStorage.setItem(authKeys.inflightOAuth, `${inflight}`);
 	}
 
```

**File**: `packages/auth/src/providers/cognito/utils/types.ts` (modified, +11/-0)
```diff
@@ -103,6 +103,7 @@ export function assertDeviceMetadata(
 
 export const OAuthStorageKeys = {
 	inflightOAuth: 'inflightOAuth',
+	inflightOAuthDeadline: 'inflightOAuthDeadline',
 	oauthSignIn: 'oauthSignIn',
 	oauthPKCE: 'oauthPKCE',
 	oauthState: 'oauthState',
@@ -111,6 +112,16 @@ export const OAuthStorageKeys = {
 export interface OAuthStore {
 	setAuthConfig(authConfigParam: CognitoUserPoolConfig): void;
 	loadOAuthInFlight(): Promise<boolean>;
+	/**
+	 * Returns the timestamp (epoch ms) until which token consumers should block
+	 * on the inflight OAuth flow, or `undefined` when there is nothing to block
+	 * on (no flow in flight, or its blocking deadline has passed).
+	 *
+	 * Optional so that custom {@link OAuthStore} implementations written before
+	 * this method existed keep compiling; callers must treat its absence as
+	 * "no deadline available".
+	 */
+	loadOAuthInFlightDeadline?(): Promise<number | undefined>;
 	storeOAuthInFlight(inflight: boolean): Promise<void>;
 	loadOAuthSignIn(): Promise<{
 		isOAuthSignIn: boolean;
```

---

### Incident Patch 2: `d8f5356d` (2026-09-18)
**Commit Message**: fix(auth): local AmplifyContext sign-in without Amplify.configure() (#14948)

* fix(core): restore Amplify.getConfig() empty-config behavior before configure()

The aws-amplify umbrella Amplify.getConfig() was rewritten in #14931 to route through getGlobalContext(), which throws NoAmplifyContextError when Amplify.configure() has not been called. Released 6.20.0 behavior was to warn and return an empty config ({}). This unintended regression crashed the storage/local-context e2e (the sample renders Amplify.getConfig() before configure and expects {}), gating the 6.21.0 release.

Restore the pre-configure contract: getConfig() now warns and returns {} when there is no global context (via the existing hasGlobalContext() guard), and returns the real resourcesConfig once configured. Category fn(ctx, input) APIs and the getGlobalContext()/NoAmplifyContextError guard are unchanged; the adapter-nextjs InvalidServerContextError SSR guard is untouched.

* fix(auth): persist sign-in tokens to the per-context orchestrator for local AmplifyContext

Sign-in flows persisted Cognito tokens via a module-level singleton tokenOrchestrator whose authConfig/storage are set only by Amplify.configure(). 

**File**: `.changeset/local-context-auth.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+"aws-amplify": patch
+"@aws-amplify/auth": patch
+"@aws-amplify/core": patch
+---
+
+fix(auth): support user-pool sign-in through a local `createAmplifyContext()` without `Amplify.configure()`
+
+Makes a locally created `AmplifyContext` (`createAmplifyContext()`, without calling `Amplify.configure()`) usable end-to-end for Cognito user-pool auth:
+
+- `Amplify.getConfig()` again returns an empty config (`{}`) with a warning before `configure()` instead of throwing `NoAmplifyContextError`, restoring the released 6.20.0 contract that the explicit-AmplifyContext migration (#14931) unintentionally changed.
+- Cognito sign-in, `fetchAuthSession`, and the device APIs now resolve the per-context token orchestrator at the flow entry point (falling back to the global singleton for the `Amplify.configure()` path), so tokens persist to and are read from the same per-context store. The global `Amplify.configure()` path is unchanged.
+- Known limitation: OAuth (`signInWithRedirect`) sign-in tokens still cache to the **global** orchestrator, because OAuth completion runs after a full-page redirect via `enableOAuthListener`, at which point no `AmplifyContext` survives — so a local `createAmplifyContext()` that initiates `signInWithRedirect` cannot read its OAuth tokens back per-context. This fix covers user-pool (non-redirect) sign-in.
```

**File**: `packages/auth/__tests__/providers/cognito/deleteUser.test.ts` (modified, +10/-1)
```diff
@@ -9,7 +9,10 @@ import {
 
 import { AuthError } from '../../../src/errors/AuthError';
 import { deleteUser } from '../../../src/providers/cognito';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { DeleteUserException } from '../../../src/providers/cognito/types/errors';
 import { signOut } from '../../../src/providers/cognito/apis/signOut';
 import { createDeleteUserClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
@@ -24,6 +27,12 @@ jest.mock(
 );
 jest.mock('../../../src/providers/cognito/factories');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('deleteUser', () => {
 	// assert mocks
 	const mockDeleteUser = jest.fn();
```

**File**: `packages/auth/__tests__/providers/cognito/forgetDevice.test.ts` (modified, +10/-1)
```diff
@@ -11,7 +11,10 @@ import { AuthError } from '../../../src/errors/AuthError';
 import { DEVICE_METADATA_NOT_FOUND_EXCEPTION } from '../../../src/errors/constants';
 import { forgetDevice } from '../../../src/providers/cognito';
 import { ForgetDeviceException } from '../../../src/providers/cognito/types/errors';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { createForgetDeviceClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
 import { createCognitoUserPoolEndpointResolver } from '../../../src/providers/cognito/factories';
 
@@ -23,6 +26,12 @@ jest.mock(
 );
 jest.mock('../../../src/providers/cognito/factories');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('fetchMFAPreference', () => {
 	const mockDeviceMetadata = {
 		deviceKey: 'deviceKey',
```

**File**: `packages/auth/__tests__/providers/cognito/rememberDevice.test.ts` (modified, +10/-1)
```diff
@@ -10,7 +10,10 @@ import {
 import { AuthError } from '../../../src/errors/AuthError';
 import { rememberDevice } from '../../../src/providers/cognito';
 import { UpdateDeviceStatusException } from '../../../src/providers/cognito/types/errors';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { DeviceMetadata } from '../../../src/providers/cognito/tokenProvider/types';
 import { createUpdateDeviceStatusClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
 import { createCognitoUserPoolEndpointResolver } from '../../../src/providers/cognito/factories';
@@ -23,6 +26,12 @@ jest.mock(
 jest.mock('../../../src/providers/cognito/factories');
 jest.mock('../../../src/providers/cognito/tokenProvider');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('rememberDevice', () => {
 	const mockDeviceMetadata: DeviceMetadata = {
 		deviceKey: 'deviceKey',
```

**File**: `packages/auth/__tests__/providers/cognito/signInEntryPointOrchestrator.test.ts` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { AmplifyContext, KeyValueStorageInterface } from '@aws-amplify/core';
+import { registerContextTokenOrchestrator } from '@aws-amplify/core/internals/utils';
+import { createMockAmplifyContext } from '@aws-amplify/core/internals/testing';
+
+import { signInWithSRP } from '../../../src/providers/cognito/apis/signInWithSRP';
+import { signInWithUserPassword } from '../../../src/providers/cognito/apis/signInWithUserPassword';
+import { signInWithCustomAuth } from '../../../src/providers/cognito/apis/signInWithCustomAuth';
+import { signInWithCustomSRPAuth } from '../../../src/providers/cognito/apis/signInWithCustomSRPAuth';
+import { signInWithUserAuth } from '../../../src/providers/cognito/apis/signInWithUserAuth';
+import { confirmSignIn } from '../../../src/providers/cognito/apis/confirmSignIn';
+import { handleWebAuthnSignInResult } from '../../../src/client/flows/userAuth/handleWebAuthnSignInResult';
+import { handleUserAuthFlow } from '../../../src/client/flows/userAuth/handleUserAuthFlow';
+import * as signInHelpers from '../../../src/providers/cognito/utils/signInHelpers';
+import {
+	resetActiveSignInState,
+	setActiveSignInState,
+} from '../../../src/client/utils/store/signInStore';
+import { DefaultTokenStore } from '../../../src/providers/cognito/tokenProvider/TokenStore';
+import { TokenOrchestrator } from '../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
+import { tokenOrchestrator as globalTokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import { refreshAuthTokensWithoutDedupe } from '../../../src/providers/cognito/utils/refreshAuthTokens';
+import { createRespondToAuthChallengeClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
+import { RespondToAuthChallengeCommandOutput } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider/types';
+
+import { authAPITestParams } from './testUtils/authApiTestParams';
+
+jest.mock('../../../src/providers/cognito/utils/dispatchSignedInHubEvent');
+jest.mock('../../../src/providers/cognito/utils/getNewDeviceMetadata', () => ({
+	getNewDeviceMetadata: jest.fn().mockResolvedValue(undefined),
+}));
+jest.mock('../../../src/client/flows/userAuth/handleUserAuthFlow');
+jest.mock('../../../src/client/utils/passkey', () => ({
+	getPasskey: jest.fn().mockResolvedValue({ id: 'mock-credential' }),
+}));
+jest.mock(
+	'../../../src/foundation/factories/serviceClients/cognitoIdentityProvider',
+	() => ({
+		...jest.requireActual(
+			'../../../src/foundation/factories/serviceClients/cognitoIdentityProvider',
+		),
+		createRespondToAuthChallengeClient: jest.fn(),
+	}),
+);
+
+const authConfig = {
+	Cognito: {
+		userPoolClientId: '111111-aaaaa-42d8-891d-ee81a1549398',
+		userPoolId: 'us-west-2_zzzzz',
+	},
+};
+
+const createMemoryStorage = (): KeyValueStorageInterface => {
+	const store = new Map<string, string>();
+
+	return {
+		setItem: async (key, value) => {
+			store.set(key, value);
+		},
+		getItem: async key => store.get(key) ?? null,
+		removeItem: async key => {
+			store.delete(key);
+		},
+		clear: async () => {
+			store.clear();
+		},
+	};
+};
+
+/**
+ * Builds the write-capable per-context orchestrator exactly the way
+ * `createUserPoolsTokenProvider` does for a local `AmplifyContext`.
+ */
+const createContextOrchestrator = (): TokenOrchestrator => {
+	const tokenStore = new DefaultTokenStore();
+	tokenStore.setAuthConfig(authConfig);
+	tokenStore.setKeyValueStorage(createMemoryStorage());
+
+	const orchestrator = new TokenOrchestrator();
+	orchestrator.setAuthConfig(authConfig);
+	orchestrator.setAuthTokenStore(tokenStore);
+	orchestrator.setTokenRefresher(refreshAuthTokensWithoutDedupe);
+
+	return orchestrator;
+};
+
+/**
+ * Regression guard for the local-context sign-in defect: token WRITES were
+ * per-context but every `signIn*` entry point handed the flow the module-level
+ * GLOBAL singleton orchestrator. Because that singleton is never configured on
+ * the `createAmplifyContext()` path, the device-metadata read during the SRP
+ * PASSWORD_VERIFIER challenge threw `AuthUserPoolException: Auth UserPool not
+ * configured` several frames BEFORE token persistence was reached.
+ *
+ * The global singleton is deliberately left UNCONFIGURED here — that is the
+ * condition the pre-existing mocked signIn tests never exercised.
+ */
+describe('signIn entry point token orchestrator resolution', () => {
+	const { username, password } = authAPITestParams.user1;
+
+	let contextOrchestrator: TokenOrchestrator;
+	/** The orchestrator the flow under test was actually handed. */
+	let receivedOrchestrator: unknown;
+
+	beforeEach(() => {
+		jest.clearAllMocks();
+		resetActiveSignInState();
+		receivedOrchestrator = undefined;
+		contextOrchestrator = createContextOrchestrator();
+	});
+
+	afterEach(() => {
+		jest.rest
```

**File**: `packages/auth/__tests__/providers/cognito/signInErrorCases.test.ts` (modified, +9/-0)
```diff
@@ -11,6 +11,10 @@ import { InitiateAuthException } from '../../../src/providers/cognito/types/erro
 import { USER_ALREADY_AUTHENTICATED_EXCEPTION } from '../../../src/errors/constants';
 import { createInitiateAuthClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
 import { AuthErrorCodes } from '../../../src/common/AuthErrorStrings';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 
 import { authAPITestParams } from './testUtils/authApiTestParams';
 import { getMockError } from './testUtils/data';
@@ -25,6 +29,11 @@ jest.mock(
 );
 jest.mock('../../../src/providers/cognito/tokenProvider');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so the sign-in flows keep
+// receiving a usable orchestrator.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('signIn API error path cases:', () => {
 	// assert mocks
 	const mockCreateInitiateAuthClient = jest.mocked(createInitiateAuthClient);
```

**File**: `packages/auth/__tests__/providers/cognito/signOut.test.ts` (modified, +46/-8)
```diff
@@ -6,10 +6,14 @@ import { AMPLIFY_SYMBOL } from '@aws-amplify/core/internals/utils';
 import { createMockAmplifyContext } from '@aws-amplify/core/internals/testing';
 
 import { signOut } from '../../../src/providers/cognito/apis/signOut';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	tokenOrchestrator as globalTokenOrchestrator,
+	resolveTokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { DefaultOAuthStore } from '../../../src/providers/cognito/utils/signInWithRedirectStore';
 import { handleOAuthSignOut } from '../../../src/providers/cognito/utils/oauth';
 import { AuthTokenStore } from '../../../src/providers/cognito/tokenProvider/types';
+import type { TokenOrchestrator } from '../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
 import {
 	createGlobalSignOutClient,
 	createRevokeTokenClient,
@@ -31,6 +35,19 @@ jest.mock(
 jest.mock('../../../src/foundation/parsers');
 jest.mock('../../../src/providers/cognito/factories');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at a DISTINCT per-context orchestrator mock (not the global
+// singleton) so these suites prove `signOut` clears the context's own token
+// store and never reaches for the module-level singleton.
+const mockContextTokenOrchestrator = {
+	clearTokens: jest.fn(),
+	getTokenStore: jest.fn(),
+	getOAuthMetadata: jest.fn(),
+} as unknown as jest.Mocked<TokenOrchestrator>;
+jest
+	.mocked(resolveTokenOrchestrator)
+	.mockReturnValue(mockContextTokenOrchestrator);
+
 describe('signOut', () => {
 	// eslint-disable-next-line camelcase
 	const accessToken = { payload: { origin_jti: 'revocation-id' } };
@@ -64,8 +81,8 @@ describe('signOut', () => {
 	const mockHub = Hub as jest.Mocked<typeof Hub>;
 	const mockRevokeToken = jest.fn();
 	const mockedRevokeTokenClient = jest.mocked(createRevokeTokenClient);
-	const mockTokenOrchestrator = tokenOrchestrator as jest.Mocked<
-		typeof tokenOrchestrator
+	const mockGlobalTokenOrchestrator = globalTokenOrchestrator as jest.Mocked<
+		typeof globalTokenOrchestrator
 	>;
 	const MockDefaultOAuthStore = DefaultOAuthStore as jest.Mock;
 	const mockCreateCognitoUserPoolEndpointResolver = jest.mocked(
@@ -84,7 +101,10 @@ describe('signOut', () => {
 	// create test helpers
 	const expectSignOut = () => ({
 		toComplete: () => {
-			expect(mockTokenOrchestrator.clearTokens).toHaveBeenCalledTimes(1);
+			expect(mockContextTokenOrchestrator.clearTokens).toHaveBeenCalledTimes(1);
+			// The clear must go through the context's orchestrator, never the
+			// module-level singleton.
+			expect(mockGlobalTokenOrchestrator.clearTokens).not.toHaveBeenCalled();
 			expect(mockClearCredentials()).toHaveBeenCalledTimes(1);
 			expect(mockHub.dispatch).toHaveBeenCalledWith(
 				'auth',
@@ -95,7 +115,8 @@ describe('signOut', () => {
 		},
 		not: {
 			toComplete: () => {
-				expect(mockTokenOrchestrator.clearTokens).not.toHaveBeenCalled();
+				expect(mockContextTokenOrchestrator.clearTokens).not.toHaveBeenCalled();
+				expect(mockGlobalTokenOrchestrator.clearTokens).not.toHaveBeenCalled();
 				expect(mockClearCredentials()).not.toHaveBeenCalled();
 				expect(mockHub.dispatch).not.toHaveBeenCalled();
 			},
@@ -114,7 +135,9 @@ describe('signOut', () => {
 		mockCreateGlobalSignOutClient.mockReturnValueOnce(mockGlobalSignOut);
 		mockRevokeToken.mockResolvedValue({});
 		mockedRevokeTokenClient.mockReturnValueOnce(mockRevokeToken);
-		mockTokenOrchestrator.getTokenStore.mockReturnValue(mockAuthTokenStore);
+		mockContextTokenOrchestrator.getTokenStore.mockReturnValue(
+			mockAuthTokenStore,
+		);
 		mockLoadTokens.mockResolvedValue(cognitoAuthTokens);
 	});
 
@@ -124,7 +147,8 @@ describe('signOut', () => {
 		mockClearCredentials().mockClear();
 		mockGetRegionFromUserPoolId.mockClear();
 		mockHub.dispatch.mockClear();
-		mockTokenOrchestrator.clearTokens.mockClear();
+		mockContextTokenOrchestrator.clearTokens.mockClear();
+		mockGlobalTokenOrchestrator.clearTokens.mockClear();
 		loggerDebugSpy.mockClear();
 		mockCreateCognitoUserPoolEndpointResolver.mockClear();
 	});
@@ -262,6 +286,7 @@ describe('signOut', () => {
 		});
 
 		beforeEach(() => {
+			mockCtxWithOAuth.clearCredentials.mockClear();
 			mockHandleOAuthSignOut.mockResolvedValue({ type: 'success' });
 		});
 
@@ -279,8 +304,9 @@ describe('signOut', () => {
 			expect(mockHandleOAuthSignOut).toHaveBeenCalledWith(
 				cognitoConfigWithOauth,
 				mockDefaultOAuthStoreInstance,
-				mockTokenOrchestrator,
+				mockContextTokenOrchestrator,
 				undefined,
+				expect.any(Function),
 			);
 			// In cases of OAuth, token removal and Hub dispatch should be performed by the OAuth handling since
 			// these actions can be deferred or canceled out of altogether.
@@ -292,5 +318,17 @@ describe('signOut', () => {
 
 			await expect(signOut(mockCtxWithOAuth)).rejects.toThrow();
 		});
+
+		it('passes a clearCr
```

**File**: `packages/auth/__tests__/providers/cognito/signOutContextOrchestrator.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { KeyValueStorageInterface, clearCredentials } from '@aws-amplify/core';
+import { registerContextTokenOrchestrator } from '@aws-amplify/core/internals/utils';
+import { createMockAmplifyContext } from '@aws-amplify/core/internals/testing';
+
+import { signOut } from '../../../src/providers/cognito/apis/signOut';
+import { DefaultTokenStore } from '../../../src/providers/cognito/tokenProvider/TokenStore';
+import { TokenOrchestrator } from '../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
+import { tokenOrchestrator as globalTokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import { refreshAuthTokensWithoutDedupe } from '../../../src/providers/cognito/utils/refreshAuthTokens';
+import { DefaultOAuthStore } from '../../../src/providers/cognito/utils/signInWithRedirectStore';
+
+jest.mock('@aws-amplify/core', () => ({
+	...jest.requireActual('@aws-amplify/core'),
+	clearCredentials: jest.fn().mockResolvedValue(undefined),
+}));
+jest.mock('../../../src/providers/cognito/utils/signInWithRedirectStore');
+
+const region = 'us-west-2';
+const cognitoConfigWithOAuth = {
+	userPoolClientId: '111111-aaaaa-42d8-891d-ee81a1549398',
+	userPoolId: `${region}_zzzzz`,
+	identityPoolId: `${region}:xxxxxx`,
+	loginWith: {
+		oauth: {
+			domain: 'hosted-ui.test',
+			redirectSignIn: ['https://myapp.test/completeSignIn/'],
+			redirectSignOut: ['https://myapp.test/completeSignOut/'],
+			responseType: 'code' as const,
+			scopes: [],
+		},
+	},
+};
+
+const createMemoryStorage = (): KeyValueStorageInterface => {
+	const store = new Map<string, string>();
+
+	return {
+		setItem: async (key, value) => {
+			store.set(key, value);
+		},
+		getItem: async key => store.get(key) ?? null,
+		removeItem: async key => {
+			store.delete(key);
+		},
+		clear: async () => {
+			store.clear();
+		},
+	};
+};
+
+/**
+ * Builds the write-capable per-context orchestrator exactly the way
+ * `createUserPoolsTokenProvider` does for a local `AmplifyContext`.
+ */
+const createContextOrchestrator = (): TokenOrchestrator => {
+	const authConfig = { Cognito: cognitoConfigWithOAuth };
+	const tokenStore = new DefaultTokenStore();
+	tokenStore.setAuthConfig(authConfig);
+	tokenStore.setKeyValueStorage(createMemoryStorage());
+
+	const orchestrator = new TokenOrchestrator();
+	orchestrator.setAuthConfig(authConfig);
+	orchestrator.setAuthTokenStore(tokenStore);
+	orchestrator.setTokenRefresher(refreshAuthTokensWithoutDedupe);
+
+	return orchestrator;
+};
+
+/**
+ * Regression guard for the OAuth-configured local-context sign-out defect:
+ * `signOut(ctx)` resolved the per-context orchestrator and threaded it into
+ * `handleOAuthSignOut`, but `completeOAuthSignOut` reached past it and cleared
+ * the module-level GLOBAL orchestrator plus the GLOBAL credentials. On a pool
+ * that has OAuth configured, a user-pool sign-in through a local
+ * `createAmplifyContext()` therefore persisted per-context while sign-out
+ * cleared the (empty) global store — leaving the user signed in.
+ *
+ * Unlike `signOut.test.ts`, this suite deliberately does NOT mock the oauth
+ * utils, so the real `handleOAuthSignOut` -> `completeOAuthSignOut` chain runs.
+ */
+describe('signOut token orchestrator resolution (OAuth-configured local context)', () => {
+	const MockDefaultOAuthStore = DefaultOAuthStore as jest.Mock;
+	const mockGlobalClearCredentials = jest.mocked(clearCredentials);
+
+	let contextOrchestrator: TokenOrchestrator;
+	let contextClearTokensSpy: jest.SpyInstance;
+	let globalClearTokensSpy: jest.SpyInstance;
+	let mockOAuthStoreInstance: {
+		setAuthConfig: jest.Mock;
+		loadOAuthSignIn: jest.Mock;
+		clearOAuthData: jest.Mock;
+	};
+
+	beforeEach(() => {
+		jest.clearAllMocks();
+
+		mockOAuthStoreInstance = {
+			setAuthConfig: jest.fn(),
+			// Not an OAuth sign-in, so sign-out completes in-process instead of
+			// redirecting to the Hosted UI logout endpoint.
+			loadOAuthSignIn: jest.fn().mockResolvedValue({
+				isOAuthSignIn: false,
+				preferPrivateSession: false,
+			}),
+			clearOAuthData: jest.fn().mockResolvedValue(undefined),
+		};
+		MockDefaultOAuthStore.mockImplementation(() => mockOAuthStoreInstance);
+
+		contextOrchestrator = createContextOrchestrator();
+		contextClearTokensSpy = jest.spyOn(contextOrchestrator, 'clearTokens');
+		globalClearTokensSpy = jest
+			.spyOn(globalTokenOrchestrator, 'clearTokens')
+			.mockResolvedValue(undefined);
+	});
+
+	afterEach(() => {
+		contextClearTokensSpy.mockRestore();
+		globalClearTokensSpy.mockRestore();
+	});
+
+	const createLocalCtx = () => {
+		const tokenProvider = { getTokens: jest.fn() };
+		registerContextTokenOrchestrator(tokenProvider, contextOrchestrator);
+
+		return createMockAmplifyContext(
+			{ Auth: { Cognito: cognitoConfigWithOAuth } },
+			{ libraryOptions: { Auth: { tokenProvider } } },
+		);
+	}
```

---

### Incident Patch 3: `af995209` (2026-10-15)
**Commit Message**: ci(e2e): pin iOS Detox simulator runtime and bound Detox step timeouts (#14990)

- Create the 'iPhone 15' simulator on the iOS runtime bundled with the
  selected Xcode (iOS 18.5 for Xcode 16.4) instead of the newest runtime on
  the image, which resolved to iOS 26.2.
- Download the passkeys iOS 17.4 runtime only when missing, and cap the step.
- Pass --forceExit to Jest so a failed attempt cannot hang until the job
  timeout, and add step timeouts to CocoaPods, Detox build and Detox run.

**File**: `.github/workflows/callable-e2e-test-detox.yml` (modified, +59/-14)
```diff
@@ -54,29 +54,64 @@ jobs:
           echo "Active Xcode: $(xcode-select -p)"
       - name: Ensure iPhone 15 simulator exists
         # The 'iPhone 15' device name is required by detox config in the samples
-        # repo. If the runner image doesn't ship one, create it with the newest
-        # available iOS runtime. Passkeys tests handle their own sim (iOS 17.4).
+        # repo. The macos-15 image does not ship an 'iPhone 15' device, so create
+        # one on the iOS runtime bundled with the selected Xcode (iOS 18.5 for
+        # Xcode 16.4). The image also preinstalls iOS 26.x runtimes for Xcode 26,
+        # so "newest runtime" is not deterministic: it picked iOS 26.2 under
+        # Xcode 16.4. Fallback order: runtime matching the Xcode simulator SDK,
+        # then newest preinstalled iOS 18.x, then newest iOS runtime (warning).
+        # Passkeys tests handle their own sim (iOS 17.4).
         if: ${{ !contains(inputs.test_name, 'integ_rn_ios_passkeys') }}
+        timeout-minutes: 5
         run: |
-          if xcrun simctl list devices available | grep -q '"iPhone 15"'; then
-            echo "iPhone 15 simulator already available."
+          RUNTIMES=$(xcrun simctl list runtimes available | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9]+-[0-9]+' | sort -t- -k2,2n -k3,3n)
+          SDK_VERSION=$(xcrun --sdk iphonesimulator --show-sdk-version)
+          echo "Xcode simulator SDK: iOS $SDK_VERSION"
+          echo "Available iOS runtimes:"
+          echo "$RUNTIMES"
+          WANTED="com.apple.CoreSimulator.SimRuntime.iOS-$(echo "$SDK_VERSION" | tr '.' '-')"
+          if echo "$RUNTIMES" | grep -qx "$WANTED"; then
+            RUNTIME="$WANTED"
           else
-            echo "iPhone 15 simulator not found — creating one."
-            # Pick the newest iOS runtime available on this image
-            RUNTIME=$(xcrun simctl list runtimes iOS | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9]+-[0-9]+' | sort -V | tail -n1)
+            RUNTIME=$(echo "$RUNTIMES" | grep -E 'iOS-18-[0-9]+$' | tail -n1)
             if [ -z "$RUNTIME" ]; then
-              echo "::error::No iOS runtime found. Cannot create simulator."
-              exit 1
+              RUNTIME=$(echo "$RUNTIMES" | tail -n1)
             fi
-            echo "Using runtime: $RUNTIME"
+            echo "::warning::No runtime matching iOS $SDK_VERSION. Falling back to: ${RUNTIME:-none}"
+          fi
+          if [ -z "$RUNTIME" ]; then
+            echo "::error::No iOS runtime found. Cannot create simulator."
+            exit 1
+          fi
+          echo "Using runtime: $RUNTIME"
+          EXISTING=$(xcrun simctl list devices available -j | jq -r --arg rt "$RUNTIME" '.devices[$rt] // [] | map(select(.name == "iPhone 15")) | .[0].udid // empty')
+          if [ -n "$EXISTING" ]; then
+            echo "iPhone 15 simulator already available on $RUNTIME: $EXISTING"
+          else
             xcrun simctl create "iPhone 15" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "$RUNTIME"
             echo "iPhone 15 simulator created successfully."
           fi
-      - name: Download iOS platform and create simulator
+      - name: Ensure iOS 17.4 runtime and create simulator
+        # Passkeys tests run on an iOS 17.4 simulator. The macos-15 image only
+        # preinstalls iOS 18.5/18.6 and 26.x runtimes, so 17.4 (~7 GB) is
+        # downloaded when missing (about 2.5 minutes on recent runs). Skip the
+        # download if the runtime is already present, and cap the step so a slow
+        # download fails fast instead of consuming the job timeout.
         if: ${{ contains(inputs.test_name, 'integ_rn_ios_passkeys') }}
+        timeout-minutes: 20
         run: |
-          xcodebuild -downloadPlatform iOS -buildVersion 17.4
-          xcrun simctl create "iPhone 15" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "com.apple.CoreSimulator.SimRuntime.iOS-17-4"
+          RUNTIME="com.apple.CoreSimulator.SimRuntime.iOS-17-4"
+          if xcrun simctl list runtimes available | grep -q "$RUNTIME"; then
+            echo "iOS 17.4 runtime already installed."
+          else
+            echo "iOS 17.4 runtime not installed. Downloading."
+            xcodebuild -downloadPlatform iOS -buildVersion 17.4
+          fi
+          if ! xcrun simctl list runtimes available | grep -q "$RUNTIME"; then
+            echo "::error::iOS 17.4 runtime is not available after download."
+            exit 1
+          fi
+          xcrun simctl create "iPhone 15" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" "$RUNTIME"
       - name: Setup samples staging repository
         uses: ./amplify-js/.github/actions/setup-samples-staging
         with:
@@ -93,6 +128,7 @@ jobs:
         shell: bash
       - name: Install CocoaPods
         # Retry to guard against transient network failures (CDN/specs fetch)
+        timeout-minutes: 15
         run: |
           for i in 1 2 3; do
             echo "pod inst
```

#### Recent Merged Pull Requests:
- **PR #14994** (2026-10-16): chore(deps): bump brace-expansion to 1.1.21, 2.1.7, 5.0.12 (@pranavosu)
- **PR #14993** (closed): chore(deps): bump brace-expansion to 1.1.21, 2.1.7, 5.0.12 (@pranavosu)
- **PR #14991** (2026-10-15): ci(e2e): set realistic iOS Detox timeouts and bound Detox steps (@pranavosu)
- **PR #14990** (2026-10-15): ci(e2e): pin iOS Detox simulator runtime and bound Detox step timeouts (@pranavosu)
- **PR #14989** (2026-10-14): chore(deps): bump source-map-js from 1.2.1 to 1.2.2 (@dependabot[bot])
- **PR #14988** (closed): chore(deps): bump sharp from 0.35.4 to 0.35.5 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. auth): bound waiting on inflight OAuth flow with read-time deadline (#14942)

**RULE**:
When implementing operations in `.changeset/oauth-inflight-deadline.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws-amplify/amplify-js. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `556185e7`: auth): bound waiting on inflight OAuth flow with read-time deadline (#14942). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/oauth-inflight-deadline.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@aws-amplify/auth': patch
---

fix(auth): bound waiting on an inflight OAuth flow with a read-time deadline

`fetchAuthSession` / `getCurrentUser` could previously hang forever when another
tab started `signInWithRedirect` and abandoned the Hosted UI page: the shared
`inflightOAuth` flag has no expiry and the parked promise was only released by
the tab completing the flow.

The flow now records a blocking deadline next to the flag (`inflightOAuthDeadline`,
5 minutes). Token consumers evaluate it at read time and park with a backstop
timer, and a cross-tab storage listener releases waiters as soon as the owning
tab settles the flow. The deadline bounds only how long other work may block —
the completion path deliberately ignores it, and no tab ever mutates another
tab's flow state, so a slow-but-successful login still completes. Flags written
by older library versions are handled by persisting a default deadline on first
observation.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `556185e7` are properly handled with clean fallback behavior.
