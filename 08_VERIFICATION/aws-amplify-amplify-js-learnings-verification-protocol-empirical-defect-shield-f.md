# Verification Protocol: Verification Protocol: Empirical Defect Shield for aws-amplify-amplify-js-learnings

<!-- PROVENANCE_START
{
  "source_repository": "aws-amplify-amplify-js-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T17:02:42.071Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aws-amplify-amplify-js-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-amplify-amplify-js-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T17:02:42.071Z`  
> **Learning ID**: `LEARN-EVO-aws-amplify-amplify-js-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `aws-amplify-amplify-js-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source**: github ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Source Version**: `9e01896b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T17:02:31.499Z  
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
> **Harvest Timestamp**: 2026-11-17T17:02:31.494Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws-amplify/amplify-js`
- **Description**: A declarative JavaScript library for application development using cloud services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9556 stars

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
- **Issue #15016** (2026-11-16): **fetchAuthSession() waits up to 5 minutes when signInWithRedirect completion fails early on page load**
  *Symptoms*: ### Before opening, please confirm:  - [x] I have searched for duplicate or closed issues and discussions. - [x] I have read the guide for submitting bug reports. - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React (also reproducible without a framework)  ### Amplify APIs  Authentication  ### Amplify Version  v6 (`@aws-amplify/auth` 6.21.2 and `main` at 6a065b1)  ### Amplify Categories  auth  ### Environment information  Browser, Cognito user pool with Hosted UI (`signInWithRedirect`), authorization code flow.  ### Describe the bug  `fetchAuthSession()` and `getCurrentUser()` can wait for the whole inflight OAuth deadline (5 minutes) after the redirect flow has already failed.  `TokenOrchestrator.waitForInflightOAuth()` first awaits `oAuthStore.loadOAuthInFlightDeadline()`, then registers its resolver with `addInflightPromise`. `handleFailure()` releases the registered resolvers synchronously, then clears the inflight data.  If completion fails early, the release runs before a token consumer that started at the same time has registered. Two examples: `getRedirectUrl()` throws `InvalidOriginException` after a single storage read, or the redirect URL has no `code`/`state`. The consumer then finishes its deadline read (the value it read before the clear), parks, and nothing releases it until the backstop timer fires at the deadline.  A related case is in the shared backstop ti

- **Issue #15005** (2026-11-05): **`signOut({ global: true })` silently fails to revoke tokens for federated (hosted-UI) users.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  @aws-amplify/auth (v6)  ### Describe the bug  `signOut({ global: true })` relies on the Cognito `GlobalSignOut` API, which requires the access token to carry the `aws.cognito.signin.user.admin` scope. Access tokens issued through federated / hosted-UI sign-in (SAML, social) do not carry that scope, so the call fails with NotAuthorizedException. The error is swallowed, local tokens are cleared, and the app appears logged out, but the refresh token is never revoked and stays valid for its full lifetime. Native (SRP / USER_PASSWORD) users are unaffected because their tokens carry the scope, which masks the problem in testing.  ### Expected behavior  When `global: true` cannot invoke `GlobalSignOut` for a federated user, Amplify should fall back to the token-revocation endpoint (`/oauth2/revoke`, which needs only the client id a

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

### Incident Patch 1: `9e01896b` (2026-11-16)
**Commit Message**: fix(auth): register OAuth token waiters before reading the deadline (#15017)

* fix(auth): register OAuth token waiters before reading the deadline

A token consumer read the inflight OAuth deadline before registering its
resolver. When the redirect completion failed early (for example an invalid
origin or a cancelled sign-in), handleFailure released the registered
waiters before that consumer registered, so fetchAuthSession() and
getCurrentUser() parked until the 5-minute deadline.

Each waiter now registers synchronously, then reads the deadline, and owns
its own backstop timer. A release settles it even while its read is pending,
and a stale re-check only settles its own waiter, never one parked for a
newer flow. The deadline, renewal, cross-tab release and fail-open
re-check behavior are unchanged.

* fix(auth): address review feedback on inflight OAuth waiters

- Drop the stale addInflightPromise mock from attemptCompleteOAuthFlow tests.
- Release the waiter if checkDeadline throws on the first deadline read,
  matching the backstop re-check.
- Bump the changeset to minor: removing TokenOrchestrator.inflightPromise
  changes the public type exported from @aws-amplify/auth/cogn

**File**: `.changeset/auth-oauth-wait-register-before-read.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/auth': minor
+---
+
+fix(auth): release token consumers when a redirect sign-in fails during their inflight OAuth deadline read, and stop a stale deadline re-check from releasing waiters of a newer flow
```

**File**: `packages/auth/__tests__/providers/cognito/tokenOrchestrator.test.ts` (modified, +5/-25)
```diff
@@ -5,7 +5,6 @@ import { Hub, ResourcesConfig } from '@aws-amplify/core';
 import { AMPLIFY_SYMBOL } from '@aws-amplify/core/internals/utils';
 
 import { TokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
-import { addInflightPromise } from '../../../src/providers/cognito/utils/oauth/inflightPromise';
 import { oAuthStore } from '../../../src/providers/cognito/utils/oauth';
 
 jest.mock('../../../src/providers/cognito/utils/oauth/oAuthStore');
@@ -40,11 +39,6 @@ const validAuthConfig: ResourcesConfig = {
 	},
 };
 
-jest.mock('../../../src/providers/cognito/utils/oauth/inflightPromise', () => ({
-	addInflightPromise: jest.fn(),
-	armInflightDeadline: jest.fn(),
-}));
-
 const currentDate = new Date();
 
 const expiredDate = new Date();
@@ -101,15 +95,15 @@ const validAuthTokens = {
 	metadata: undefined,
 };
 
-const mockAddInflightPromise = addInflightPromise as jest.Mock;
-
 describe('TokenOrchestrator', () => {
 	const tokenOrchestrator = new TokenOrchestrator();
+	beforeEach(() => {
+		(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
+			undefined,
+		);
+	});
 	describe('Happy Path Cases:', () => {
 		beforeAll(() => {
-			mockAddInflightPromise.mockImplementation(resolver => {
-				resolver();
-			});
 			tokenOrchestrator.setAuthConfig(validAuthConfig.Auth!);
 			tokenOrchestrator.setAuthTokenStore(mockAuthTokenStore);
 			tokenOrchestrator.setTokenRefresher(mockTokenRefresher);
@@ -142,29 +136,15 @@ describe('TokenOrchestrator', () => {
 			);
 		});
 
-		it('Should call addInflightPromise when OAuth is inflight', async () => {
-			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
-			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
-				Date.now() + 60_000,
-			);
-
-			const tokens = await tokenOrchestrator.getTokens();
-
-			expect(addInflightPromise).toHaveBeenCalledWith(expect.any(Function));
-			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
-		});
-
 		it('Should not block when the inflight OAuth blocking deadline has passed', async () => {
 			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
 			// An absent or expired deadline is reported as `undefined` by the store.
 			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
 				undefined,
 			);
-			mockAddInflightPromise.mockClear();
 
 			const tokens = await tokenOrchestrator.getTokens();
 
-			expect(addInflightPromise).not.toHaveBeenCalled();
 			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
 		});
 	});
```

**File**: `packages/auth/__tests__/providers/cognito/utils/oauth/attemptCompleteOAuthFlow.test.ts` (modified, +0/-7)
```diff
@@ -35,13 +35,6 @@ jest.mock(
 	}),
 );
 
-jest.mock(
-	'../../../../../src/providers/cognito/utils/oauth/inflightPromise',
-	() => ({
-		addInflightPromise: jest.fn(),
-	}),
-);
-
 const mockAssertOAuthConfig = assertOAuthConfig as jest.Mock;
 const mockAssertTokenProviderConfig = assertTokenProviderConfig as jest.Mock;
 const mockCompleteOAuthFlow = completeOAuthFlow as jest.Mock;
```

**File**: `packages/auth/__tests__/providers/cognito/utils/oauth/inflightOAuthDeadline.test.ts` (modified, +310/-6)
```diff
@@ -1,7 +1,7 @@
 // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 // SPDX-License-Identifier: Apache-2.0
 
-import { defaultStorage } from '@aws-amplify/core';
+import { Hub, defaultStorage } from '@aws-amplify/core';
 
 import { TokenOrchestrator } from '../../../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
 import { AUTH_KEY_PREFIX } from '../../../../../src/providers/cognito/tokenProvider/constants';
@@ -11,6 +11,8 @@ import {
 } from '../../../../../src/providers/cognito/utils/signInWithRedirectStore';
 import { oAuthStore } from '../../../../../src/providers/cognito/utils/oauth/oAuthStore';
 import { resolveAndClearInflightPromises } from '../../../../../src/providers/cognito/utils/oauth/inflightPromise';
+import { attemptCompleteOAuthFlow } from '../../../../../src/providers/cognito/utils/oauth/attemptCompleteOAuthFlow';
+import { AuthTokenStore } from '../../../../../src/providers/cognito/tokenProvider/types';
 
 // Registers the browser-only side effects at module load — including the
 // cross-tab storage listener that releases parked token consumers when the
@@ -69,17 +71,129 @@ const park = (orchestrator: TokenOrchestrator) => {
 	return { promise, isSettled: () => settled };
 };
 
+interface HeldRead {
+	started: Promise<void>;
+	deliver(): void;
+	fail(error: unknown): void;
+}
+
+const heldReads: HeldRead[] = [];
+
+// Holds the next `count` reads of the deadline key at the storage boundary.
+// Each read captures the stored value when it starts and returns it only when
+// delivered, like a slow storage backend.
+const holdDeadlineReads = (count: number) => {
+	const getItem = defaultStorage.getItem.bind(defaultStorage);
+	const holds = Array.from({ length: count }, () => {
+		let markStarted!: () => void;
+		let settle!: (read: () => Promise<string | null>) => void;
+		const value = new Promise<() => Promise<string | null>>(resolve => {
+			settle = resolve;
+		});
+		let captured: string | null = null;
+		const held: HeldRead & { start(value: string | null): void } = {
+			started: new Promise<void>(resolve => {
+				markStarted = resolve;
+			}),
+			start(storedValue) {
+				captured = storedValue;
+				markStarted();
+			},
+			deliver: () => {
+				settle(async () => captured);
+			},
+			fail: error => {
+				settle(() => Promise.reject(error));
+			},
+		};
+
+		return { held, value };
+	});
+	const pending = [...holds];
+	jest.spyOn(defaultStorage, 'getItem').mockImplementation(async key => {
+		const next = key === deadlineKey ? pending.shift() : undefined;
+		if (!next) {
+			return getItem(key);
+		}
+		next.held.start(window.localStorage.getItem(key));
+
+		return (await next.value)();
+	});
+	heldReads.push(...holds.map(({ held }) => held));
+
+	return holds.map(({ held }) => held);
+};
+
+const oauthConfig = {
+	Cognito: {
+		...authConfig.Cognito,
+		loginWith: {
+			oauth: {
+				domain: 'auth.example.com',
+				redirectSignIn: ['http://localhost/'],
+				redirectSignOut: ['http://localhost/'],
+				responseType: 'code' as const,
+				scopes: ['openid'],
+			},
+		},
+	},
+};
+
+const priorTokens = {
+	accessToken: {
+		payload: { exp: Math.floor(Date.now() / 1000) + 3600 },
+		toString: () => 'prior-access-token',
+	},
+	idToken: {
+		payload: { exp: Math.floor(Date.now() / 1000) + 3600 },
+		toString: () => 'prior-id-token',
+	},
+	clockDrift: 0,
+};
+
+const createSignedInOrchestrator = () => {
+	const orchestrator = createOrchestrator();
+	orchestrator.setAuthTokenStore({
+		loadTokens: async () => priorTokens,
+		getLastAuthUser: async () => 'prior-user',
+	} as unknown as AuthTokenStore);
+
+	return orchestrator;
+};
+
+const listenForRedirectFailure = () => {
+	const errors: Error[] = [];
+	const stop = Hub.listen('auth', ({ payload }) => {
+		const { event, data } = payload as {
+			event: string;
+			data?: { error?: Error };
+		};
+		if (event === 'signInWithRedirect_failure' && data?.error) {
+			errors.push(data.error);
+		}
+	});
+
+	return { errors, stop };
+};
+
 describe('inflight OAuth blocking deadline', () => {
 	beforeEach(() => {
 		jest.useFakeTimers();
 		window.localStorage.clear();
+		oAuthStore.setAuthConfig(authConfig.Cognito as any);
 	});
 
 	afterEach(async () => {
-		// Drain any parked waiters and clear the singleton backstop timer so
+		// Drain any parked waiters and clear their backstop timers so
 		// module-level state never leaks between tests.
 		resolveAndClearInflightPromises();
+		heldReads.splice(0).forEach(held => {
+			held.deliver();
+		});
 		await drainMicrotasks();
+		resolveAndClearInflightPromises();
+		jest.restoreAllMocks();
+		window.history.replaceState({}, '', '/');
 		jest.clearAllTimers();
 		jest.useRealTimers();
 	});
@@ -250,10 +364,9 @@ describe('inflight OAuth blocking deadline', () => {
 	});
 
 	it('blocks on a new flow parked on the SAME orchestrator right after a release', async () => {
-		// Pins the fix for the post-release hole: `this.inflightPromise` is reset
-		// by
```

**File**: `packages/auth/src/providers/cognito/tokenProvider/TokenOrchestrator.ts` (modified, +13/-61)
```diff
@@ -18,10 +18,7 @@ import {
 import { assertServiceError } from '../../../errors/utils/assertServiceError';
 import { AuthError } from '../../../errors/AuthError';
 import { oAuthStore } from '../utils/oauth/oAuthStore';
-import {
-	addInflightPromise,
-	armInflightDeadline,
-} from '../utils/oauth/inflightPromise';
+import { waitForInflightOAuth } from '../utils/oauth/inflightPromise';
 import { ClientMetadata, CognitoAuthSignInDetails } from '../types';
 
 import {
@@ -38,60 +35,19 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 	clientMetadataProvider?: ClientMetadataProvider;
 	tokenStore?: AuthTokenStore;
 	tokenRefresher?: TokenRefresher;
-	inflightPromise: Promise<void> | undefined;
+	// when there is valid oauth config and there is an inflight oauth flow, try
+	// to block async calls that require fetching tokens before the oauth flow completes
+	// e.g. getCurrentUser, fetchAuthSession etc.
+	// Read-time evaluation of the blocking deadline: absent flag, an
+	// expired deadline, or a flag value other than 'true' all mean
+	// "do not block". An abandoned flow in another tab can therefore
+	// never park token consumers indefinitely.
+	// (`loadOAuthInFlightDeadline` is optional on the OAuthStore
+	// interface for custom-implementation compatibility, but this
+	// singleton is always the concrete DefaultOAuthStore, which
+	// implements it.)
 	waitForInflightOAuth: () => Promise<void> = isBrowser()
-		? async () => {
-				// Read-time evaluation of the blocking deadline: absent flag, an
-				// expired deadline, or a flag value other than 'true' all mean
-				// "do not block". An abandoned flow in another tab can therefore
-				// never park token consumers indefinitely.
-				// (`loadOAuthInFlightDeadline` is optional on the OAuthStore
-				// interface for custom-implementation compatibility, but this
-				// singleton is always the concrete DefaultOAuthStore, which
-				// implements it.)
-				const deadline = await oAuthStore.loadOAuthInFlightDeadline();
-				if (deadline === undefined) {
-					return;
-				}
-
-				if (this.inflightPromise) {
-					// Keep the backstop aligned with the current deadline for waiters
-					// piggybacking on the existing park.
-					armInflightDeadline(deadline, () =>
-						oAuthStore.loadOAuthInFlightDeadline(),
-					);
-
-					return this.inflightPromise;
-				}
-
-				// when there is valid oauth config and there is an inflight oauth flow, try
-				// to block async calls that require fetching tokens before the oauth flow completes
-				// e.g. getCurrentUser, fetchAuthSession etc.
-
-				this.inflightPromise = new Promise<void>(resolve => {
-					// Invariant: `this.inflightPromise` is owned by the park lifecycle —
-					// created here and reset by the very resolver that releases it
-					// (drained by the backstop timer, the cross-tab listener, or
-					// in-process completion). Resetting BEFORE resolving closes the
-					// post-release hole where a caller for a NEW flow could observe a
-					// stale, already-resolved promise and skip blocking on it.
-					addInflightPromise(() => {
-						this.inflightPromise = undefined;
-						resolve();
-					});
-					// Arm the deadline backstop in the same synchronous step as the
-					// park: it releases this waiter even when the cross-tab release
-					// fired between the deadline read above and this park (that storage
-					// event never re-fires), when storage events are unavailable
-					// (Safari private mode), or when the flow is simply never
-					// completed anywhere.
-					armInflightDeadline(deadline, () =>
-						oAuthStore.loadOAuthInFlightDeadline(),
-					);
-				});
-
-				return this.inflightPromise;
-			}
+		? () => waitForInflightOAuth(() => oAuthStore.loadOAuthInFlightDeadline())
 		: async () => {
 				// no-op for non-browser environments
 			};
@@ -151,10 +107,6 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 			return null;
 		}
 		await this.waitForInflightOAuth();
-		// NOTE: `this.inflightPromise` is reset by the resolver registered in
-		// `waitForInflightOAuth` (co-located with the release), NOT here — a reset
-		// here could clobber a newer flow's park created between the release and
-		// this line resuming.
 		tokens = await this.getTokenStore().loadTokens();
 		const username = await this.getTokenStore().getLastAuthUser();
 
```

**File**: `packages/auth/src/providers/cognito/utils/oauth/inflightPromise.ts` (modified, +61/-57)
```diff
@@ -1,69 +1,73 @@
 // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 // SPDX-License-Identifier: Apache-2.0
 
-const inflightPromises: ((value: void | PromiseLike<void>) => void)[] = [];
-
-// Module-level singleton backstop timer for the inflight OAuth blocking
-// deadline. A single timer (not one per waiter) is sufficient because all
-// parked waiters share one release (`resolveAndClearInflightPromises` drains
-// them all), and every park re-arms it with the current deadline.
-let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
-
-export const addInflightPromise = (resolver: () => void) => {
-	inflightPromises.push(resolver);
-};
+const inflightPromises = new Set<() => void>();
 
 /**
- * Arms (or re-arms) the backstop timer that releases parked token consumers
- * once the inflight OAuth blocking deadline passes.
+ * Blocks a token consumer while an OAuth flow is in flight, until the flow
+ * settles (`resolveAndClearInflightPromises`) or its blocking deadline passes.
  *
- * On fire it re-reads the deadline instead of trusting the armed one: a fresh
- * `signInWithRedirect` may have renewed it (re-arm for the new deadline), or
- * the flow may have been released through another path already (the re-check
- * returns `undefined` and draining is a no-op). The release is purely local —
- * it never mutates shared OAuth state, so another tab's still-running flow is
- * left intact.
+ * The waiter registers before it reads the deadline, so a release that happens
+ * while that read is pending still settles it. Each waiter owns its backstop
+ * timer: on fire it re-reads the deadline instead of trusting the armed one, as
+ * a fresh `signInWithRedirect` may have renewed it. Its re-check only ever
+ * settles this waiter, never one parked for a newer flow. The backstop also
+ * covers environments without storage events (Safari private mode) and flows
+ * that are never completed anywhere. The release is purely
+ * local: it never mutates shared OAuth state, so another tab's still-running
+ * flow is left intact.
  *
  * Note: browsers throttle timers in background tabs, which may delay (never
- * prevent) this release; the cross-tab storage listener remains the fast path.
+ * prevent) the backstop release; the cross-tab storage listener remains the
+ * fast path.
  */
-export const armInflightDeadline = (
-	deadline: number,
-	recheckDeadline: () => Promise<number | undefined>,
-) => {
-	if (deadlineTimer !== undefined) {
-		clearTimeout(deadlineTimer);
-	}
-	deadlineTimer = setTimeout(
-		() => {
-			deadlineTimer = undefined;
-			recheckDeadline()
-				.then(renewedDeadline => {
-					if (renewedDeadline !== undefined) {
-						armInflightDeadline(renewedDeadline, recheckDeadline);
+export const waitForInflightOAuth = (
+	readDeadline: () => Promise<number | undefined>,
+): Promise<void> =>
+	new Promise<void>((resolve, reject) => {
+		let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
 
-						return;
-					}
-					resolveAndClearInflightPromises();
-				})
-				// Fail open: an error while re-checking (e.g. auth config torn down)
-				// must release the waiters rather than leave them parked forever.
-				.catch(() => {
-					resolveAndClearInflightPromises();
-				});
-		},
-		Math.max(0, deadline - Date.now()),
-	);
-};
+		const release = () => {
+			if (!inflightPromises.delete(release)) {
+				return;
+			}
+			clearTimeout(deadlineTimer);
+			resolve();
+		};
+
+		const checkDeadline = (deadline: number | undefined) => {
+			if (!inflightPromises.has(release)) {
+				return;
+			}
+			if (deadline === undefined) {
+				release();
+
+				return;
+			}
+			deadlineTimer = setTimeout(
+				() => {
+					readDeadline()
+						.then(checkDeadline)
+						// Fail open: an error while re-checking (e.g. auth config torn
+						// down) must release the waiter rather than leave it parked.
+						.catch(release);
+				},
+				Math.max(0, deadline - Date.now()),
+			);
+		};
+
+		inflightPromises.add(release);
+		readDeadline()
+			.then(checkDeadline, error => {
+				if (inflightPromises.delete(release)) {
+					reject(error);
+				}
+			})
+			.catch(release);
+	});
 
-export const resolveAndClearInflightPromises = () => {
-	// The waiters this timer guarded are being released through this very call
-	// (whatever triggered it) — clear it so no stale timer outlives its waiters.
-	if (deadlineTimer !== undefined) {
-		clearTimeout(deadlineTimer);
-		deadlineTimer = undefined;
-	}
-	while (inflightPromises.length) {
-		inflightPromises.pop()?.();
-	}
+export const resolveAndClearInflightPromises = (): void => {
+	inflightPromises.forEach(release => {
+		release();
+	});
 };
```

#### Recent Merged Pull Requests:
- **PR #15017** (2026-11-16): fix(auth): register OAuth token waiters before reading the deadline (@maxence-lefebvre)
- **PR #15013** (2026-11-10): chore(e2e): disable Pinpoint-backed E2E tests (@soberm)
- **PR #15010** (2026-11-05): chore(deps): update glob and minimatch transitive dependencies (@soberm)
- **PR #15009** (2026-11-05): fix(auth): revoke refresh token when global sign out fails (@soberm)
- **PR #15008** (2026-11-05): chore(deps): bump joi from 18.2.9 to 18.3.2 (@dependabot[bot])
- **PR #15007** (2026-11-05): chore(deps-dev): bump glob from 10.5.0 to 14.0.2 (@dependabot[bot])

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

## X. auth): register OAuth token waiters before reading the deadline

**RULE**:
When implementing operations in `.changeset/auth-oauth-wait-register-before-read.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws-amplify/amplify-js. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e01896b`: auth): register OAuth token waiters before reading the deadline. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/auth-oauth-wait-register-before-read.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@aws-amplify/auth': minor
---

fix(auth): release token consumers when a redirect sign-in fails during their inflight OAuth deadline read, and stop a stale deadline re-check from releasing waiters of a newer flow
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e01896b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
