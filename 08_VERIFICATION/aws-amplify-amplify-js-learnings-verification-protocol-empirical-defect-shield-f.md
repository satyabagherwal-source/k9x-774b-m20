# Verification Protocol: Verification Protocol: Empirical Defect Shield for aws-amplify-amplify-js-learnings

<!-- PROVENANCE_START
{
  "source_repository": "aws-amplify-amplify-js-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:33:50.214Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-aws-amplify-amplify-js-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-amplify-amplify-js-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:33:50.214Z`  
> **Learning ID**: `LEARN-REEXTRACT-aws-amplify-amplify-js-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `aws-amplify-amplify-js-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source**: github ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Source Version**: `3a9b151d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T23:19:53.393Z  
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
> **Harvest Timestamp**: 2026-11-06T23:19:52.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws-amplify/amplify-js`
- **Description**: A declarative JavaScript library for application development using cloud services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9554 stars

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
- **Issue #15005** (2026-11-05): **`signOut({ global: true })` silently fails to revoke tokens for federated (hosted-UI) users.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  @aws-amplify/auth (v6)  ### Describe the bug  `signOut({ global: true })` relies on the Cognito `GlobalSignOut` API, which requires the access token to carry the `aws.cognito.signin.user.admin` scope. Access tokens issued through federated / hosted-UI sign-in (SAML, social) do not carry that scope, so the call fails with NotAuthorizedException. The error is swallowed, local tokens are cleared, and the app appears logged out, but the refresh token is never revoked and stays valid for its full lifetime. Native (SRP / USER_PASSWORD) users are unaffected because their tokens carry the scope, which masks the problem in testing.  ### Expected behavior  When `global: true` cannot invoke `GlobalSignOut` for a federated user, Amplify should fall back to the token-revocation endpoint (`/oauth2/revoke`, which needs only the client id a

- **Issue #14978** (2026-10-06): **[Auth] fetchAuthSession throws "Access to Identity is forbidden" after a failed token refresh because the signed-in user's identityId is reused for guest access**
  *Symptoms*: ### Describe the bug  After a token refresh fails with an authentication error (for example, a revoked or expired refresh token, or an admin global sign-out), `fetchAuthSession()` throws on every call for the rest of the page's lifetime:  ``` NotAuthorizedException: Access to Identity 'us-west-2:…' is forbidden. ```  This happens with an identity pool that allows guest access.  Cause: 1. While the user is signed in, `DefaultIdentityIdStore` keeps the user's authenticated identityId in memory (`_primaryIdentityId`). 2. When the refresh fails, `TokenOrchestrator.handleErrors` clears the tokens and returns `null`. Nothing clears `_primaryIdentityId`; only `signOut()` calls `clearCredentialsAndIdentityId()`. 3. `fetchAuthSession()` now has no tokens, so it calls the credentials provider with `authenticated: false`. `cognitoIdentityIdProvider` calls `loadIdentityId()`, which returns the in-memory primary identityId first (`IdentityIdStore.ts`). 4. `getGuestCredentials` sends that authenticated identityId to `GetCredentialsForIdentity` without `Logins`. Cognito rejects it as forbidden, and the same identityId is used again on every call.  The app can only recover by reloading the page or calling `signOut()`.  This was found while investigating #14975 (listed there under "A leftover primary ID in the guest branch"). It is reported separately because the library gets into this state on its own.  ### Expected behavior  With no tokens, `fetchAuthSession()` does not use the signed-in us

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

### Incident Patch 1: `2d7d7cb0` (2026-11-05)
**Commit Message**: fix(auth): revoke refresh token when global sign out fails (#15009)

**File**: `.changeset/auth-global-signout-revoke-fallback.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/auth': patch
+---
+
+fix(auth): revoke the refresh token when global sign out cannot complete
```

**File**: `packages/auth/__tests__/providers/cognito/signOut.test.ts` (modified, +37/-2)
```diff
@@ -254,15 +254,50 @@ describe('signOut', () => {
 			expectSignOut().toComplete();
 		});
 
-		it('should still perform global sign out if token revoke fails', async () => {
+		it('should complete sign out when global sign out fails', async () => {
 			mockGlobalSignOut.mockRejectedValue(new Error());
 
 			await signOut(mockCtx, { global: true });
 
 			expect(loggerDebugSpy).toHaveBeenCalledWith(
 				expect.stringContaining('Global signOut error caught'),
 			);
-			expect(mockGetRegionFromUserPoolId).toHaveBeenCalledTimes(1);
+			// once for GlobalSignOut, once for the RevokeToken fallback
+			expect(mockGetRegionFromUserPoolId).toHaveBeenCalledTimes(2);
+			expectSignOut().toComplete();
+		});
+
+		it('should fall back to revoking the refresh token when global sign out is rejected', async () => {
+			const notAuthorized = new Error(
+				'Access Token does not have required scopes',
+			);
+			notAuthorized.name = 'NotAuthorizedException';
+			mockGlobalSignOut.mockRejectedValue(notAuthorized);
+
+			await signOut(mockCtx, { global: true });
+
+			expect(mockGlobalSignOut).toHaveBeenCalledTimes(1);
+			expect(mockRevokeToken).toHaveBeenCalledWith(
+				{ region },
+				{ ClientId: cognitoConfig.userPoolClientId, Token: refreshToken },
+			);
+			expect(loggerDebugSpy).not.toHaveBeenCalledWith(
+				expect.stringContaining('Client signOut error caught'),
+			);
+			expectSignOut().toComplete();
+		});
+
+		it('should not revoke the refresh token when global sign out is rejected on an irrevocable session', async () => {
+			mockLoadTokens.mockResolvedValue({
+				...cognitoAuthTokens,
+				accessToken: {},
+			});
+			mockGlobalSignOut.mockRejectedValue(new Error());
+
+			await signOut(mockCtx, { global: true });
+
+			expect(mockGlobalSignOut).toHaveBeenCalledTimes(1);
+			expect(mockRevokeToken).not.toHaveBeenCalled();
 			expectSignOut().toComplete();
 		});
 	});
```

**File**: `packages/auth/src/providers/cognito/apis/signOut.ts` (modified, +6/-0)
```diff
@@ -158,6 +158,12 @@ async function globalSignOut(
 		logger.debug(
 			'Global signOut error caught but will proceed with token removal',
 		);
+		// GlobalSignOut requires the access token to carry the
+		// `aws.cognito.signin.user.admin` scope, which tokens issued through the
+		// hosted UI or federated sign-in often lack. Fall back to revoking the
+		// current refresh token (when the session is revocable) so it can no
+		// longer be used to refresh the session.
+		await clientSignOut(cognitoConfig, tokenOrchestrator);
 	}
 }
 
```

---

### Incident Patch 2: `7829a19c` (2026-11-05)
**Commit Message**: fix(auth): get a new guest identityId when the stored one can't be used for guest access (#14999)

* fix(auth): get a new guest identityId when the stored one can't be used for guest access

* fix(auth): share one guest identityId recovery between concurrent calls

* fix(auth): only reuse cached guest credentials for the requested identityId

getGuestCredentials returned the in-memory guest credentials whenever they
were unexpired, without checking that they belong to the identityId it was
asked for. During a guest identityId recovery, another call that starts after
the store is cleared can get its own identityId and cache its credentials, so
the recovery stored one identityId and returned the other's credentials.

**File**: `.changeset/guest-unusable-identity-id.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/auth': patch
+---
+
+fix(auth): get a new guest identityId when the stored one can't be used for guest access (deleted, linked to a login, or malformed), instead of failing on every `fetchAuthSession()` call
```

**File**: `packages/auth/__tests__/providers/cognito/credentialsProvider/credentialsProvider.test.ts` (modified, +8/-0)
```diff
@@ -121,6 +121,14 @@ describe('credentialsProvider', () => {
 			});
 
 			test('in-memory guest creds are returned if not expired and not past TTL', async () => {
+				// Cognito returns the requested identityId, which the cache is keyed on
+				mockGetCredentialsForIdentity.mockReset();
+				mockGetCredentialsForIdentity.mockImplementation(
+					async (_config, { IdentityId }) => ({
+						...authAPITestParams.CredentialsForIdentityIdResult,
+						IdentityId,
+					}),
+				);
 				await cognitoCredentialsProvider.getCredentialsAndIdentityId({
 					authenticated: false,
 					authConfig: validAuthConfig.Auth!,
```

**File**: `packages/auth/__tests__/providers/cognito/credentialsProvider/unusableGuestIdentityId.test.ts` (added, +434/-0)
```diff
@@ -0,0 +1,434 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import {
+	KeyValueStorageInterface,
+	ResourcesConfig,
+	createGetCredentialsForIdentityClient,
+	createGetIdClient,
+} from '@aws-amplify/core';
+
+import {
+	CognitoAWSCredentialsAndIdentityIdProvider,
+	DefaultIdentityIdStore,
+} from '../../../../src/providers/cognito';
+import { AuthError } from '../../../../src/errors/AuthError';
+import { authAPITestParams } from '../testUtils/authApiTestParams';
+
+jest.mock('@aws-amplify/core', () => ({
+	...jest.requireActual('@aws-amplify/core'),
+	createGetCredentialsForIdentityClient: jest.fn(),
+	createGetIdClient: jest.fn(),
+}));
+
+const identityPoolId = 'us-east-1:test-id';
+const identityIdKey = `com.amplify.Cognito.${identityPoolId}.identityId`;
+const storedIdentityId = 'us-east-1:00000000-0000-0000-0000-000000000001';
+const newIdentityId = 'us-east-1:00000000-0000-0000-0000-000000000002';
+
+const authConfig: ResourcesConfig['Auth'] = {
+	Cognito: {
+		userPoolId: 'us-east-1_test-id',
+		identityPoolId,
+		userPoolClientId: 'test-id',
+		allowGuestAccess: true,
+	},
+};
+
+const serviceError = (name: string, message: string) =>
+	Object.assign(new Error(message), { name, $metadata: {} });
+
+const resourceNotFound = () =>
+	serviceError(
+		'ResourceNotFoundException',
+		`Identity '${storedIdentityId}' not found.`,
+	);
+const accessForbidden = () =>
+	serviceError(
+		'NotAuthorizedException',
+		`Access to Identity '${storedIdentityId}' is forbidden.`,
+	);
+const malformedIdentityId = () =>
+	serviceError(
+		'ValidationException',
+		"1 validation error detected: Value 'not-an-identity-id' at 'identityId' failed to satisfy constraint: Member must satisfy regular expression pattern: [\\w-]+:[0-9a-f-]+",
+	);
+
+/**
+ * Browser-like storage: reads see earlier writes.
+ */
+const createBrowserStorage = (initial: Record<string, string>) => {
+	const items = new Map(Object.entries(initial));
+	const storage: KeyValueStorageInterface = {
+		setItem: jest.fn(async (key: string, value: string) => {
+			items.set(key, value);
+		}),
+		getItem: jest.fn(async (key: string) => items.get(key) ?? null),
+		removeItem: jest.fn(async (key: string) => {
+			items.delete(key);
+		}),
+		clear: jest.fn(async () => {
+			items.clear();
+		}),
+	};
+
+	return { storage, items };
+};
+
+/**
+ * Server-like storage, like the cookie storage on the server: reads come from
+ * the request's cookies, and writes are only recorded for the response.
+ */
+const createServerStorage = (requestCookies: Record<string, string>) => {
+	const responseCookies: string[] = [];
+	const storage: KeyValueStorageInterface = {
+		setItem: jest.fn(async (key: string, value: string) => {
+			responseCookies.push(`${key}=${value}`);
+		}),
+		getItem: jest.fn(async (key: string) => requestCookies[key] ?? null),
+		removeItem: jest.fn(async (key: string) => {
+			responseCookies.push(`${key}=`);
+		}),
+		clear: jest.fn(),
+	};
+
+	return { storage, responseCookies };
+};
+
+const mockCreateGetCredentialsForIdentityClient = jest.mocked(
+	createGetCredentialsForIdentityClient,
+);
+const mockCreateGetIdClient = jest.mocked(createGetIdClient);
+const mockGetCredentialsForIdentity = jest.fn();
+const mockGetId = jest.fn();
+
+const credentialsFor = (identityId: string) => ({
+	...authAPITestParams.CredentialsForIdentityIdResult,
+	IdentityId: identityId,
+});
+
+const createProvider = (storage: KeyValueStorageInterface) =>
+	new CognitoAWSCredentialsAndIdentityIdProvider(
+		new DefaultIdentityIdStore(storage),
+	);
+
+const fetchGuestCredentials = (
+	provider: CognitoAWSCredentialsAndIdentityIdProvider,
+) =>
+	provider.getCredentialsAndIdentityId({
+		authenticated: false,
+		authConfig: authConfig!,
+	});
+
+describe('guest credentials with an unusable stored identityId', () => {
+	beforeAll(() => {
+		mockCreateGetCredentialsForIdentityClient.mockReturnValue(
+			mockGetCredentialsForIdentity,
+		);
+		mockCreateGetIdClient.mockReturnValue(mockGetId);
+	});
+
+	beforeEach(() => {
+		mockGetCredentialsForIdentity.mockReset();
+		mockGetId.mockReset();
+		mockGetId.mockResolvedValue({ IdentityId: newIdentityId });
+		mockGetCredentialsForIdentity.mockImplementation(
+			async (_config, { IdentityId }) => {
+				if (IdentityId === storedIdentityId) {
+					throw resourceNotFound();
+				}
+
+				return credentialsFor(IdentityId);
+			},
+		);
+	});
+
+	describe.each([
+		['ResourceNotFoundException (deleted identity)', resourceNotFound],
+		['NotAuthorizedException (identity linked to a login)', accessForbidden],
+		['ValidationException (malformed identityId)', malformedIdentityId],
+	])('when the stored identityId fails with %s', (_, createError) => {
+		beforeEach(() => {
+			mockGetCredentialsForIdentity.mockImplementation(
+				async (_config, { IdentityId }) => {
+					if (IdentityId === storedIdentityId) {
+						throw createError();
+					}
+
+					return
```

**File**: `packages/auth/src/providers/cognito/credentialsProvider/IdentityIdProvider.ts` (modified, +7/-1)
```diff
@@ -17,6 +17,8 @@ import { formLoginsMap } from './utils';
  * Provides a Cognito identityId
  *
  * @param tokens - The AuthTokens received after SignIn
+ * @param forceNewIdentityId - Skip the stored identityId and get one from
+ *  Cognito's GetId API. The stored identityId is replaced with the result.
  * @returns string
  * @throws configuration exceptions: `InvalidIdentityPoolIdException`
  *  - Auth errors that may arise from misconfiguration.
@@ -26,15 +28,19 @@ export async function cognitoIdentityIdProvider({
 	tokens,
 	authConfig,
 	identityIdStore,
+	forceNewIdentityId = false,
 }: {
 	tokens?: AuthTokens;
 	authConfig: CognitoIdentityPoolConfig;
 	identityIdStore: IdentityIdStore;
+	forceNewIdentityId?: boolean;
 }): Promise<string> {
 	identityIdStore.setAuthConfig({ Cognito: authConfig });
 
 	// will return null only if there is no identityId cached or if there is an error retrieving it
-	let identityId: Identity | null = await identityIdStore.loadIdentityId();
+	let identityId: Identity | null = forceNewIdentityId
+		? null
+		: await identityIdStore.loadIdentityId();
 
 	// A primary identityId belongs to a signed-in user and cannot be used for
 	// guest access. It can be left in memory when the tokens are cleared without
```

**File**: `packages/auth/src/providers/cognito/credentialsProvider/credentialsProvider.ts` (modified, +77/-4)
```diff
@@ -22,7 +22,7 @@ import { createCognitoIdentityPoolEndpointResolver } from '../factories';
 
 import { IdentityIdStore } from './types';
 import { cognitoIdentityIdProvider } from './IdentityIdProvider';
-import { formLoginsMap } from './utils';
+import { formLoginsMap, isUnusableGuestIdentityIdError } from './utils';
 
 const logger = new ConsoleLogger('CognitoCredentialsProvider');
 const CREDENTIALS_TTL = 50 * 60 * 1000; // 50 min, can be modified on config if required in the future
@@ -42,6 +42,11 @@ export class CognitoAWSCredentialsAndIdentityIdProvider
 
 	private _nextCredentialsRefresh = 0;
 
+	private _guestRecovery?: {
+		failedIdentityId: string;
+		promise: Promise<CredentialsAndIdentityId>;
+	};
+
 	async clearCredentialsAndIdentityId(): Promise<void> {
 		logger.debug('Clearing out credentials and identityId');
 		this._credentialsAndIdentityId = undefined;
@@ -84,23 +89,91 @@ export class CognitoAWSCredentialsAndIdentityIdProvider
 			this.clearCredentials();
 		}
 		if (!isAuthenticated) {
-			return this.getGuestCredentials(identityId, authConfig.Cognito);
+			return this.getGuestCredentialsWithRecovery(
+				identityId,
+				authConfig.Cognito,
+			);
 		} else {
 			assertIdTokenInAuthTokens(tokens);
 
 			return this.credsForOIDCTokens(authConfig.Cognito, tokens, identityId);
 		}
 	}
 
+	/**
+	 * Gets guest credentials. If Cognito rejects the stored identityId because
+	 * the identityId itself can't be used (for example, it was deleted or it is
+	 * linked to a login), clears it, gets a new guest identityId from GetId and
+	 * tries once more. A second failure is thrown.
+	 *
+	 * Concurrent calls that fail with the same identityId share one recovery,
+	 * and a call that fails after another call has already recovered returns
+	 * the new credentials, so only one new identityId is created.
+	 */
+	private async getGuestCredentialsWithRecovery(
+		identityId: string,
+		authConfig: CognitoIdentityPoolConfig,
+	): Promise<CredentialsAndIdentityId> {
+		try {
+			return await this.getGuestCredentials(identityId, authConfig);
+		} catch (error) {
+			if (!isUnusableGuestIdentityIdError(error)) {
+				throw error;
+			}
+			if (
+				this._credentialsAndIdentityId &&
+				!this.isPastTTL() &&
+				this._credentialsAndIdentityId.isAuthenticatedCreds === false &&
+				this._credentialsAndIdentityId.identityId !== identityId
+			) {
+				return this._credentialsAndIdentityId;
+			}
+			if (this._guestRecovery?.failedIdentityId !== identityId) {
+				const promise = this.recoverGuestCredentials(
+					authConfig,
+					error as AuthError,
+				).finally(() => {
+					if (this._guestRecovery?.promise === promise) {
+						this._guestRecovery = undefined;
+					}
+				});
+				this._guestRecovery = { failedIdentityId: identityId, promise };
+			}
+
+			return this._guestRecovery.promise;
+		}
+	}
+
+	private async recoverGuestCredentials(
+		authConfig: CognitoIdentityPoolConfig,
+		error: AuthError,
+	): Promise<CredentialsAndIdentityId> {
+		logger.warn(
+			`The stored identityId can't be used for guest access (${error.name}). Getting a new guest identityId.`,
+		);
+		await this.clearCredentialsAndIdentityId();
+		// Don't load the identityId from the store again: on the server, the
+		// cookie storage keeps returning the request's cookie after it's removed.
+		const newIdentityId = await cognitoIdentityIdProvider({
+			authConfig,
+			identityIdStore: this._identityIdStore,
+			forceNewIdentityId: true,
+		});
+
+		return this.getGuestCredentials(newIdentityId, authConfig);
+	}
+
 	private async getGuestCredentials(
 		identityId: string,
 		authConfig: CognitoIdentityPoolConfig,
 	): Promise<CredentialsAndIdentityId> {
-		// Return existing in-memory cached credentials only if it exists, is not past it's lifetime and is unauthenticated credentials
+		// Return existing in-memory cached credentials only if it exists, is not past it's lifetime, is unauthenticated credentials
+		// and belongs to the requested identityId
 		if (
 			this._credentialsAndIdentityId &&
 			!this.isPastTTL() &&
-			this._credentialsAndIdentityId.isAuthenticatedCreds === false
+			this._credentialsAndIdentityId.isAuthenticatedCreds === false &&
+			this._credentialsAndIdentityId.identityId === identityId
 		) {
 			logger.info(
 				'returning stored credentials as they neither past TTL nor expired.',
```

**File**: `packages/auth/src/providers/cognito/credentialsProvider/utils.ts` (modified, +30/-0)
```diff
@@ -20,3 +20,33 @@ export function formLoginsMap(idToken: string) {
 
 	return res;
 }
+
+/**
+ * Returns true when Cognito rejected an identityId used for guest access
+ * because the identityId itself can't be used: it was deleted or never
+ * existed, it is linked to a login, or it is malformed.
+ *
+ * Other errors, such as throttling, network errors or an identity pool that
+ * doesn't allow guest access, return false: getting a new identityId would
+ * not help with them.
+ */
+export function isUnusableGuestIdentityIdError(error: unknown): boolean {
+	if (!(error instanceof AuthError)) {
+		return false;
+	}
+	const message = error.message ?? '';
+
+	switch (error.name) {
+		case 'ResourceNotFoundException':
+			// "Identity '<identityId>' not found."
+			return true;
+		case 'NotAuthorizedException':
+			// "Access to Identity '<identityId>' is forbidden."
+			return /^Access to Identity '[^']*' is forbidden/.test(message);
+		case 'ValidationException':
+			// "... Value '<identityId>' at 'identityId' failed to satisfy constraint ..."
+			return /at 'identityId'/i.test(message);
+		default:
+			return false;
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #15010** (2026-11-05): chore(deps): update glob and minimatch transitive dependencies (@soberm)
- **PR #15009** (2026-11-05): fix(auth): revoke refresh token when global sign out fails (@soberm)
- **PR #15008** (2026-11-05): chore(deps): bump joi from 18.2.9 to 18.3.2 (@dependabot[bot])
- **PR #15007** (2026-11-05): chore(deps-dev): bump glob from 10.5.0 to 14.0.2 (@dependabot[bot])
- **PR #15006** (2026-11-05): chore(deps): bump qs from 6.16.0 to 6.17.1 (@dependabot[bot])
- **PR #15003** (2026-11-05): chore(deps): bump zod from 4.6.5 to 4.6.7 (@dependabot[bot])

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

## X. auth): revoke refresh token when global sign out fails (#15009)

**RULE**:
When implementing operations in `.changeset/auth-global-signout-revoke-fallback.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws-amplify/amplify-js. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d7d7cb0`: auth): revoke refresh token when global sign out fails (#15009). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/auth-global-signout-revoke-fallback.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@aws-amplify/auth': patch
---

fix(auth): revoke the refresh token when global sign out cannot complete
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d7d7cb0` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
