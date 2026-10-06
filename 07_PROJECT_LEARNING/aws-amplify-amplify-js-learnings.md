# Forensic Learning Record (Deep Inspection): aws-amplify/amplify-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:43.291Z  
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

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/getCookieValuesFromNextApiRequest.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NextApiRequest } from 'next';

export const getCookieValuesFromNextApiRequest = <
	CookieNames extends string[],
	R = Partial<Record<CookieNames[number], string | undefined>>,
>(
	request: NextApiRequest,
	cookieNames: CookieNames,
): R => {
	const result: Record<string, string | undefined> = {};

	for (const cookieName of cookieNames) {
		result[cookieName] = request.cookies[cookieName];
	}

	return result as R;
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/auth/utils/getCookieValuesFromRequest.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ensureEncodedForJSCookie } from '../../utils/cookie/ensureEncodedForJSCookie';

export const getCookieValuesFromRequest = <CookieNames extends string[]>(
	request: Request,
	cookieNames: CookieNames,
): Partial<Record<CookieNames[number], string | undefined>> => {
	const cookieHeader = request.headers.get('Cookie');

	if (!cookieHeader) {
		return {};
	}

	const cookieValues: Record<string, string> = cookieHeader
		.split(';')
		.map(cookie => cookie.trim().split('='))
		.reduce<Record<string, string>>((result, [key, value]) => {
			result[key] = value;

			return result;
		}, {});

	// Cookie names are written via `ensureEncodedForJSCookie`, so they appear
	// percent-encoded on the wire when they contain unsafe characters (e.g. `@`
	// in email-based Cognito usernames). Match the lookup keys using the same
	// encoding so reads align with writes.
	const result: Record<string, string | undefined> = {};
	for (const cookieName of cookieNames) {
		result[cookieName] = cookieValues[ensureEncodedForJSCookie(cookieName)];
	}

	return result as Partial<Record<CookieNames[number], string | undefined>>;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14961** (2026-09-25): **getAmplifyDataClientConfig() custom IAM Auth.credentialsProvider broken since 6.21.0 (fetchAuthSession() returns no credentials)**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  Amplify Gen 2  ### Environment information  <details>  ``` # Put output below this line System:     OS: macOS 26.6.2     CPU: (8) arm64 Apple M1 Pro     Memory: 120.11 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 24.15.0 - /Users/andrei.muresianu/.nvm/versions/node/v24.15.0/bin/node     Yarn: 1.22.22 - /opt/homebrew/bin/yarn     npm: 11.19.0 - /Users/andrei.muresianu/Documents/workspaces/devops-dashboard/node_modules/.bin/npm   Browsers:     Chrome: 153.0.8010.54     Safari: 26.6.2   npmPackages:     @atlaskit/eslint-plugin-design-system: 16.13.0 => 16.13.0      @aws-amplify/backend: 1.23.0 => 1.23.0      @aws-amplify/backend-cli: 1.10.0 => 1.10.0      @aws-sdk/client-appsync: 3.1137.0 => 3.1137.0      @aws-sdk/client-dynamodb: 3.1137.0 => 3.1137.0      @aws-sdk/client-resource-groups-tagging-api: 3.1137.0 => 3.1137.0      @commitlint/cli: 21
  **Post-Mortem & Fix Analysis**:
  > hey @amuresia   thanks for reporting this issue. that is clearly a bug and regression for which we had no test coverage. We will work on this and quickly open up a PR.  sorry for the trouble 🙇🏻  Cheers Philipp

- **Issue #14947** (2026-09-17): **Events: an onSubscribe util.unauthorized() deny closes the whole socket and loops (kills sibling subscriptions)**
  *Symptoms*: ### Before opening, please confirm:  - [x] I have searched for duplicate or closed issues.  ### JavaScript Framework  Not applicable (Node.js)  ### Amplify APIs  Events (AppSync Events API)  ### Amplify Version  v6  ### Amplify Categories  api  ### Backend  AppSync Events API with an `onSubscribe` authorization handler (APPSYNC_JS)  ## Describe the bug  `aws-amplify` **6.20.0** / `@aws-amplify/api-graphql` **4.8.10**.  When an `onSubscribe` handler denies a single subscription using `util.unauthorized()`, AppSync returns an error frame whose `errorType` is `Unauthorized`. Amplify's `AUTH_ERROR_TYPES` check classifies that as a credentials problem and tears down the **entire WebSocket**, rather than failing just the one subscription.  The socket then reconnects, re-establishes all subscriptions including the one that is legitimately denied, is denied again, and closes again — an unbounded deny/reconnect loop. Every unrelated subscription multiplexed onto that socket is destroyed on each cycle.  The same classification also triggers on an error frame whose **message** contains `Token expired`, even when the credentials are valid.  ## Expected behavior  A per-subscription authorization denial should fail that subscription's observable (`error` callback) and leave the socket and all sibling subscriptions intact. Only an actual connection-level credentials failure should tear down the socket.  At minimum, the reconnect should be bounded so a permanently-denied subscription cannot 
  **Post-Mortem & Fix Analysis**:
  > Hi @ataran-dev,   Thank you for creating this issue. We will look into that and get back to you as soon as we have more information or need additional details.

- **Issue #14946** (2026-09-17): **Events: a publish is rejected by an unrelated subscription's error frame (message is actually delivered)**
  *Symptoms*: ### Before opening, please confirm:  - [x] I have searched for duplicate or closed issues.  ### JavaScript Framework  Not applicable (Node.js)  ### Amplify APIs  Events (AppSync Events API)  ### Amplify Version  v6  ### Amplify Categories  api  ### Backend  Amplify Gen 2 / AppSync Events API (created directly)  ## Describe the bug  `aws-amplify` **6.20.0** / `@aws-amplify/api-graphql` **4.8.10**.  The Events client multiplexes every channel onto a single WebSocket. In `AWSWebSocketProvider`'s `_publishMessage`, the **resolve** branch is keyed to the publish's own subscription id, but the **reject** branch is keyed to nothing:  ```js // dist/esm/Providers/AWSWebSocketProvider/index.mjs, _publishMessage if (data.id === subscriptionId && data.type === 'publish_success') {     resolve();                       // correctly scoped to this publish } ... if (data.errors && data.errors.length > 0) {     reject(new Error(`Publish errors: ...`));   // no id check, no type check } ```  The result is that **any** frame carrying `errors` on that socket rejects whatever publish happens to be in flight — including a `subscribe_error` belonging to a completely unrelated subscription on a different channel.  The caller is therefore told its publish failed for a message that was in fact **accepted, persisted and fanned out**. A client that retries on that rejection duplicates the message.  ## Expected behavior  A publish promise should only be rejected by an error frame that belongs to that pub
  **Post-Mortem & Fix Analysis**:
  > Hi @ataran-dev,   Thank you for creating this issue. We will look into that and get back to you as soon as we have more information or need additional details.

- **Issue #14909** (2026-08-20): **NewDeviceMetadata not returned when using a CUSTOM_AUTH flow.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  Amplify CLI  ### Environment information  <details>  ``` # Put output below this line  System:     OS: Windows 10 10.0.19045     CPU: (12) x64 Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz     Memory: 2.35 GB / 15.83 GB   Binaries:     Node: 24.11.0 - C:\Program Files\nodejs\node.EXE     npm: 11.6.1 - C:\Program Files\nodejs\npm.CMD   Browsers:     Chrome: 151.0.7922.76     Edge: Chromium (151.0.4129.72)     Internet Explorer: 11.0.19041.5794   npmPackages:     @carbon/icons-react: 11.80.0 => 11.80.0      @carbon/react: 1.107.1 => 1.107.1      @casl/ability: ^6.3.3 => 6.8.0      @casl/ability/extra:  undefined ()     @casl/react: ^3.1.0 => 3.1.0      @embedpdf/core: ^2.14.0 => 2.14.0      @embedpdf/engines: ^2.14.0 => 2.14.0      @embedpdf/plugin-document-manager: ^2.14.0 => 2.14.0      @embedpdf/plugin-interaction-manager: ^2.14.0 => 2.14.0      @embedpdf/plugin
  **Post-Mortem & Fix Analysis**:
  > Hey @rexidecimal9  Looking at the issue and the description, it looks like a bug. I will classify it as such and will take a look into it.  I will let you know of any outcome
  >  Thanks for reaching out @rexidecimal9.    Cognito does not issue `NewDeviceMetadata` for the native `CUSTOM_AUTH` flow. Device tracking is only bootstrapped through the SRP/password-verifier path (`USER_SRP_AUTH` with the `PASSWORD_VERIFIER` challenge, or `USER_PASSWORD_AUTH`). Because `CUSTOM_AUTH` runs the Define/Create/Verify Auth Challenge Lambda triggers and bypasses SRP verification, the `AuthenticationResult` comes back without `NewDeviceMetadata` (no DeviceKey/DeviceGroupKey), so "Remember devices" is not established through a pure custom auth flow.    If you need device tracking specifically within a pure CUSTOM_AUTH flow, that isn't currently supported by Cognito. For a feature request or a deeper account-specific investigation, please [open a case with AWS Support](https://support.console.aws.amazon.com/support/home#/case/create). I will be closing this issue as this is a limitation on Cognito's side.

- **Issue #14897** (2026-08-03): **signInWithRedirect always sends identity_provider=COGNITO, preventing Cognito from resuming a federated session**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Angular  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  <details>  ``` # Put output below this line System:     OS: Windows 11 10.0.26200     CPU: (24) x64 13th Gen Intel(R) Core(TM) i7-13700HX   Binaries:     Node: 24.0.0     npm: 11.3.0   Browsers:     Chrome: 150.0.7871.184   npmPackages:     @angular/core: ^21.1.0 => 21.1.0     aws-amplify: ^6.16.2 => 6.16.2     typescript: ~5.9.3 => 5.9.3  @aws-amplify/auth resolves to 6.19.1   ```  </details>   ### Describe the bug  <html> <body> <!--StartFragment--><html><head></head><body><h2>Description</h2><p><code inline="">signInWithRedirect()</code> unconditionally adds an <code inline="">identity_provider</code> parameter to the <code inline="">/oauth2/authorize</code> request. When the caller does not specify a provider, Amplify defaults the value to <code inline="">COGNITO</code>.</p><p>Cognito treats <code inline="">identity_pr
  **Post-Mortem & Fix Analysis**:
  > Hi @jeremyswensen,  Thanks for the detailed writeup and the test matrix. We will investigate and update here as soon as we have more information.

- **Issue #14863** (2026-07-08): **Amplify has not been configured warning when opening app in a new browser tab while already logged In.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Angular  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  aws-amplify: 6.17.0 Framework: Angular with Module Federation (NX monorepo) Auth: Amazon Cognito (custom auth flow / magic link)  ### Describe the bug  When the application is already open and authenticated in one browser tab, opening a new tab triggers a console warning:  **Amplify has not been configured. Please call Amplify.configure() before using this service.**  This occurs even though `Amplify.configure()` is called during app initialization. The warning fires during the auth flow (`sigOut` / `signIn` calls)  ### Expected behavior  No warning should appear. The Amplify configuration applied during app startup should persist and be available across the entire session, including flows triggered in new tabs.  ### Reproduction steps  1. Open the app in a browser tab and log in 2. While still logged in, open a new tab in
  **Post-Mortem & Fix Analysis**:
  > Hi @osama-rizk / @Simone319 , could someone please take a look at this issue and help ?
  >  Hey @ashishrawat-19 ,    Thank you for creating this issue. We will investigate and get back to you as soon as we have more information or need additional details. 
  > After further investigation, I found for Basic Auth login it is working, issue only in SSO flow. Here's the complete picture: Our SSO Auth Flow We do not use Amplify's signInWithRedirect(). Instead: 1. App redirects to Cognito Hosted UI (authorize endpoint) 2. Cognito creates a session 3. App calls Cognito's /oauth2/token endpoint directly to get tokens 4. App manually feeds those tokens into Amplify using a custom tokenProvider: ```typescript configureAmplify(): void {     const isSsoFromSession =       sessionStorage.getItem(authorization.AuthConstants.LoginVia) ===       authorization.AuthConstants.SSO;      const isSsoFromCookie = this.isSsoUserFromAccessTokenCookie();     const isSsoUser = isSsoFromSession || isSsoFromCookie;      if (isSsoUser) {       // Rehydrate sessionStorage so downstream checks stay compatible       if (!isSsoFromSession) {         sessionStorage.setItem(           authorization.AuthConstants.LoginVia,           authorization.AuthConstants.SSO         );   

- **Issue #14827** (2026-07-07): **uuid, js-cookie and axios updates for v5**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Not applicable  ### Amplify APIs  Not applicable  ### Amplify Version  v5  ### Amplify Categories  Not applicable  ### Backend  None  ### Environment information  <details>  ``` # Put output below this line   System:     OS: macOS 26.5     CPU: (10) arm64 Apple M4     Memory: 218.36 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 24.13.0 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/node     Yarn: 1.22.22 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/yarn     npm: 11.12.1 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/npm   Browsers:     Chrome: 148.0.7778.179     Safari: 26.5   npmPackages:     aws-amplify: ^5.0.0 => 5.3.33   npmGlobalPackages:     corepack: 0.34.5     http-server: 14.1.1     npm: 11.12.1     yarn: 1.22.22  ```  </details>   ### Describe the bug  I can see there are current PRs open for v6 to address the recent high severity CVEs for uuid ([GHSA-w5hq-g745-h8pq)](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745
  **Post-Mortem & Fix Analysis**:
  > Looking again, I think axios might also be in need of a bump up to at least 1.16.1 to address the security issues patched as mentioned in [the tag](https://github.com/axios/axios/releases/tag/v1.16.1) and some critical/highs in the intervening releases: ``` % npm why axios | grep axios axios@1.13.6 node_modules/axios   axios@"1.13.6" from @aws-amplify/api-rest@3.5.18 ```
  > Hi @brendanqshuttleid ,   Thank you for creating this issue. We will look into that and provide any updates here.
  > Hi @soberm,  I can see you've done some work around this, which is very much appreciated, some of which has been merged.  Just wondering if you have a timescale on when we might see a release to address the updates?  Thanks again.

- **Issue #14820** (2026-06-04): **fix(aws-amplify): refresh default Cognito auth config on DefaultAmplify reconfigure**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Next.js  ### Amplify APIs  Authentication, Storage  ### Amplify Version  v6  ### Amplify Categories  auth, storage  ### Backend  Amplify Gen 2  ### Environment information  <details>  ``` # Put output below this line  System:   OS: Windows 11 10.0.26200   CPU: (8) x64 Intel(R) Core(TM) Ultra 7 256V   Memory: 1.94 GB / 15.54 GB Binaries:   Node: 22.17.0   npm: 10.9.2 Browsers:   Edge: Chromium (140.0.3485.54) npmPackages:   aws-amplify: 6.x (latest on npm at time of report)  ```  </details>   ### Describe the bug  When using Amplify.configure from the aws-amplify package (DefaultAmplify.configure in packages/aws-amplify/src/initSingleton.ts), subsequent configure calls can behave incorrectly in two ways:  1. Non-Auth libraryOptions are dropped on reconfigure @aws-amplify/core replaces libraryOptions when a new object is passed (no merge). DefaultAmplify is responsible for merging before calling core, but several reconfigure paths did not:  Passing libraryOptions.Auth
  **Post-Mortem & Fix Analysis**:
  > I have already worked on the solution for this issue Please review below pr: https://github.com/aws-amplify/amplify-js/pull/14819
  > hey @ShrutiPundir17   thanks for reporting this issue. I think this is a bug too, but might not be possible to fix without a breaking change.   See this example: ```ts // first configure Amplify.configure({   Auth: {     Cognito: {       userPoolId: 'us-east-1_poolA',       userPoolClientId: 'client-a',     },   },   API: {     endpoint: "https://my-auth-website.com"   } }, {   API: {     REST: {       headers: () => new Headers({ auth: `Bearer ${myToken}` })     }   } });  // second configure Amplify.configure({   Auth: {     Cognito: {       userPoolId: 'us-east-1_poolB',       userPoolClientId: 'client-b',     },   },   API: {     endpoint: "https://sketchy-anon-website-where-i-dont-want-tokens-to-leak.com"   } }, {   Auth: {     headers: () => new Headers({ `x-do-not-track`: true })   } }) ```  the second configure - since it has `Auth` libraryOptions, would inherit the API libraryOptions (through `Amplify.libraryOptions`) from the first configure, potentially leaking sensitive inf
  > Let's discuss this in this issue. if we come to the conclusion that the PR makes sense, we can move forward with it.

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

### Incident Patch 1: `88f2d798` (2026-10-01)
**Commit Message**: fix(api-rest): require REST request URLs to resolve to the configured endpoint origin (#14968)

* fix(api-rest): require REST request URLs to resolve to the configured endpoint origin

resolveApiUrl() joined the configured endpoint and the request path as strings. Depending on the path, the joined URL could resolve to a different origin than the configured endpoint. resolveApiUrl() now throws an InvalidPath validation error when the resolved origin differs from the endpoint's origin.

Also anchors APIG_HOSTNAME_PATTERN to the end of the hostname (including .amazonaws.com.cn) so signing service and region are only inferred from API Gateway hostnames.

* fix(api-rest): compare protocol and host, and report path parse failures as InvalidPath

* fix(api-rest): compare userinfo and accept trailing-dot API Gateway hostnames

**File**: `.changeset/fix-api-rest-resolve-url-origin.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@aws-amplify/api-rest': patch
+---
+
+fix(api-rest): require REST request URLs to resolve to the configured endpoint origin
+
+REST API calls whose `path` would change the configured endpoint's host, port, or protocol (for example, a path without a leading `/` on an endpoint that has no trailing path) now reject with an `InvalidPath` validation error instead of sending the request to the resulting URL.
```

**File**: `packages/api-rest/__tests__/utils/parseSigningInfo.test.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { parseSigningInfo } from '../../src/utils';
+
+describe('parseSigningInfo', () => {
+	it.each([
+		[
+			'https://abc.execute-api.us-west-2.amazonaws.com/prod',
+			'execute-api',
+			'us-west-2',
+		],
+		[
+			'https://abc.execute-api.cn-north-1.amazonaws.com.cn/prod',
+			'execute-api',
+			'cn-north-1',
+		],
+		[
+			'https://abc.execute-api.us-west-2.amazonaws.com./prod',
+			'execute-api',
+			'us-west-2',
+		],
+		[
+			'https://abc.appsync-api.eu-west-1.amazonaws.com/graphql',
+			'appsync',
+			'eu-west-1',
+		],
+	])('infers signing info from %s', (url, service, region) => {
+		expect(parseSigningInfo(new URL(url))).toEqual({ service, region });
+	});
+
+	// When the pattern does not match, the service falls back to the default `execute-api`,
+	// so only the region distinguishes a match: the URLs below must use a non-default region.
+	it('does not match hosts that only start with an API Gateway hostname', () => {
+		expect(
+			parseSigningInfo(
+				new URL(
+					'https://abc.execute-api.us-west-2.amazonaws.com.other.example/x',
+				),
+			),
+		).toEqual({ service: 'execute-api', region: 'us-east-1' });
+	});
+
+	it('falls back to the defaults for VPC endpoint hostnames', () => {
+		// Pins existing behavior: the pattern captures `us-west-2` and `vpce` as service and region,
+		// which matches neither known service, so the defaults apply. This is not the correct region.
+		expect(
+			parseSigningInfo(
+				new URL('https://vpce-1-2.execute-api.us-west-2.vpce.amazonaws.com/x'),
+			),
+		).toEqual({ service: 'execute-api', region: 'us-east-1' });
+	});
+});
```

**File**: `packages/api-rest/__tests__/utils/resolveApiUrl.test.ts` (modified, +71/-0)
```diff
@@ -95,4 +95,75 @@ describe('resolveApiUrl', () => {
 			'https://example.com/api/rest?baz=2&foo=bar',
 		);
 	});
+
+	describe('origin validation', () => {
+		it.each([
+			[
+				'https://abc.execute-api.us-east-1.amazonaws.com',
+				'.other.example/items',
+			],
+			[
+				'https://abc.execute-api.us-east-1.amazonaws.com',
+				'@other.example/items',
+			],
+			['https://abc.execute-api.us-east-1.amazonaws.com', ':8443/items'],
+			['https://example.com', '.other.example'],
+			['/', '/other.example/items'],
+			['capacitor://localhost', '@other.example/items'],
+			['capacitor://localhost', '.other.example/items'],
+			['http://localhost:3000', ':8443/items'],
+			['https://example.com', ':pass@example.com/x'],
+		])(
+			'rejects endpoint %s with path %s resolving to a different origin',
+			(endpoint, path) => {
+				expect(() => resolveApiUrl(mkAmplify(endpoint), 'myAPI', path)).toThrow(
+					expect.objectContaining({
+						name: RestApiValidationErrorCode.InvalidPath,
+						...validationErrorMap[RestApiValidationErrorCode.InvalidPath],
+					}),
+				);
+			},
+		);
+
+		it('reports an endpoint that fails to parse as InvalidApiName', () => {
+			expect(() =>
+				resolveApiUrl(mkAmplify('https://'), 'myAPI', '/items'),
+			).toThrow(
+				expect.objectContaining({
+					name: RestApiValidationErrorCode.InvalidApiName,
+					recoverySuggestion: expect.stringContaining('Got https://'),
+				}),
+			);
+		});
+
+		it.each([
+			[
+				'https://abc.execute-api.us-east-1.amazonaws.com',
+				'/items',
+				'https://abc.execute-api.us-east-1.amazonaws.com/items',
+			],
+			[
+				'https://abc.execute-api.us-east-1.amazonaws.com/prod',
+				'.other.example',
+				'https://abc.execute-api.us-east-1.amazonaws.com/prod.other.example',
+			],
+			[
+				'https://abc.execute-api.us-east-1.amazonaws.com/',
+				'items',
+				'https://abc.execute-api.us-east-1.amazonaws.com/items',
+			],
+			[
+				'https://example.com',
+				'//other.example/x',
+				'https://example.com//other.example/x',
+			],
+			['https://example.com', '?q=1', 'https://example.com/?q=1'],
+			['capacitor://localhost', '/items', 'capacitor://localhost/items'],
+			['/api', '/items', 'http://localhost/api/items'],
+		])('allows endpoint %s with path %s', (endpoint, path, expected) => {
+			expect(
+				resolveApiUrl(mkAmplify(endpoint), 'myAPI', path).toString(),
+			).toEqual(expected);
+		});
+	});
 });
```

**File**: `packages/api-rest/src/errors/validation.ts` (modified, +7/-0)
```diff
@@ -5,6 +5,7 @@ import { AmplifyErrorMap } from '@aws-amplify/core/internals/utils';
 
 export enum RestApiValidationErrorCode {
 	InvalidApiName = 'InvalidApiName',
+	InvalidPath = 'InvalidPath',
 }
 
 export const validationErrorMap: AmplifyErrorMap<RestApiValidationErrorCode> = {
@@ -13,4 +14,10 @@ export const validationErrorMap: AmplifyErrorMap<RestApiValidationErrorCode> = {
 		recoverySuggestion:
 			'Check if the API name matches the one in your configuration or `aws-exports.js`',
 	},
+	[RestApiValidationErrorCode.InvalidPath]: {
+		message:
+			'API path does not resolve to the same protocol, host and userinfo as the configured endpoint.',
+		recoverySuggestion:
+			'Make sure the path is relative to the configured endpoint (for example `/items`) and does not change its host, port, or protocol.',
+	},
 };
```

**File**: `packages/api-rest/src/utils/constants.ts` (modified, +1/-1)
```diff
@@ -12,4 +12,4 @@ export const DEFAULT_IAM_SIGNING_REGION = 'us-east-1';
  * @see {@link https://docs.aws.amazon.com/general/latest/gr/apigateway.html#apigateway_region_data_plane}
  */
 export const APIG_HOSTNAME_PATTERN =
-	/^.+\.([a-z0-9-]+)\.([a-z0-9-]+)\.amazonaws\.com/;
+	/^.+\.([a-z0-9-]+)\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?\.?$/;
```

**File**: `packages/api-rest/src/utils/resolveApiUrl.ts` (modified, +35/-16)
```diff
@@ -21,6 +21,7 @@ import {
  * 3. Merge the query parameters from path and the queryParameter argument which is taken from the public REST API
  *   options.
  * 4. Validating the resulting URL string.
+ * 5. Validating the resulting URL has the same protocol, host and userinfo as the configured endpoint.
  *
  * @internal
  */
@@ -32,28 +33,46 @@ export const resolveApiUrl = (
 ): URL => {
 	const urlStr = amplify.resourcesConfig?.API?.REST?.[apiName]?.endpoint;
 	assertValidationError(!!urlStr, RestApiValidationErrorCode.InvalidApiName);
+	let endpointUrl: URL;
 	try {
-		let url: URL;
-		if (AmplifyUrl.canParse(urlStr + path)) {
-			url = new AmplifyUrl(urlStr + path);
-		} else {
-			url = new AmplifyUrl(urlStr + path, location?.origin);
-		}
-
-		if (queryParams) {
-			const mergedQueryParams = new AmplifyUrlSearchParams(url.searchParams);
-			Object.entries(queryParams).forEach(([key, value]) => {
-				mergedQueryParams.set(key, value);
-			});
-			url.search = new AmplifyUrlSearchParams(mergedQueryParams).toString();
-		}
-
-		return url;
+		endpointUrl = parseUrl(urlStr);
 	} catch (error) {
 		throw new RestApiError({
 			name: RestApiValidationErrorCode.InvalidApiName,
 			...validationErrorMap[RestApiValidationErrorCode.InvalidApiName],
 			recoverySuggestion: `Please make sure the REST endpoint URL is a valid URL string. Got ${urlStr}`,
 		});
 	}
+	let url: URL;
+	try {
+		url = parseUrl(urlStr + path);
+	} catch (error) {
+		throw new RestApiError({
+			name: RestApiValidationErrorCode.InvalidPath,
+			...validationErrorMap[RestApiValidationErrorCode.InvalidPath],
+		});
+	}
+	// Compare protocol, host and userinfo rather than `origin`, which is the opaque "null" for non-special schemes.
+	assertValidationError(
+		url.protocol === endpointUrl.protocol &&
+			url.host === endpointUrl.host &&
+			url.username === endpointUrl.username &&
+			url.password === endpointUrl.password,
+		RestApiValidationErrorCode.InvalidPath,
+	);
+
+	if (queryParams) {
+		const mergedQueryParams = new AmplifyUrlSearchParams(url.searchParams);
+		Object.entries(queryParams).forEach(([key, value]) => {
+			mergedQueryParams.set(key, value);
+		});
+		url.search = new AmplifyUrlSearchParams(mergedQueryParams).toString();
+	}
+
+	return url;
 };
+
+const parseUrl = (urlStr: string): URL =>
+	AmplifyUrl.canParse(urlStr)
+		? new AmplifyUrl(urlStr)
+		: new AmplifyUrl(urlStr, location?.origin);
```

---

### Incident Patch 2: `58609d9e` (2026-09-25)
**Commit Message**: fix(core): honor custom Auth providers when the resource config has no Auth block (#14962)

createAmplifyContext() only called AuthClass.configure() when resourcesConfig.Auth was present. That call is the sole place AuthClass stores libraryOptions.Auth, so a resource config with no Auth block left custom token/credentials providers unregistered: fetchAuthSession() resolved with credentials: undefined and the iam GraphQL auth mode threw "No credentials".

This is the shape @aws-amplify/backend-function's getAmplifyDataClientConfig() produces for IAM-authorized Data access inside a Lambda. It worked through the pre-context singleton, whose AmplifyClass.configure() calls this.Auth.configure() unconditionally, and broke when Amplify.configure() moved onto the context factory.

Fixes #14961

**File**: `.changeset/fix-core-context-custom-auth-providers.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/core': patch
+---
+
+fix(core): honor custom `libraryOptions.Auth` providers when the resource config carries no `Auth` block
```

**File**: `packages/core/__tests__/context/createAmplifyContext.test.ts` (modified, +103/-0)
```diff
@@ -155,6 +155,109 @@ describe('createAmplifyContext', () => {
 			const ctx2 = createAmplifyContext(resourcesConfig);
 			expect(ctx1).not.toBe(ctx2);
 		});
+
+		it('still hands the real Auth config to a custom provider when the resource config HAS an Auth block', async () => {
+			// Guards the path that already worked before the guard was removed:
+			// with `Auth` present, the provider must receive that config rather
+			// than `undefined`.
+			const { tokenProvider, credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(resourcesConfig, {
+				Auth: { tokenProvider, credentialsProvider },
+			});
+
+			await ctx.fetchAuthSession();
+
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId,
+			).toHaveBeenCalledWith(
+				expect.objectContaining({
+					authConfig: resourcesConfig.Auth,
+					authenticated: true,
+				}),
+			);
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId.mock.calls[0][0]
+					.authConfig?.Cognito?.userPoolId,
+			).toBe('us-east-1_test');
+		});
+	});
+
+	describe('custom Auth providers with no Auth resource config', () => {
+		// Regression: the Lambda IAM shape produced by
+		// `getAmplifyDataClientConfig()` — an `API.GraphQL`-only resource config
+		// plus a custom `credentialsProvider` that returns the function's own
+		// execution-role credentials. Wiring the per-context AuthClass only when
+		// `resourcesConfig.Auth` was present left `libraryOptions.Auth`
+		// unregistered, so `fetchAuthSession()` resolved without credentials and
+		// the `iam` GraphQL auth mode threw "No credentials".
+		const iamResourcesConfig: ResourcesConfig = {
+			API: {
+				GraphQL: {
+					endpoint: 'https://test.appsync-api.us-east-1.amazonaws.com/graphql',
+					region: 'us-east-1',
+					defaultAuthMode: 'iam',
+				},
+			},
+		};
+
+		it('invokes a custom credentialsProvider from fetchAuthSession', async () => {
+			const { credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { credentialsProvider },
+			});
+
+			const session = await ctx.fetchAuthSession();
+
+			// `authConfig: undefined` is the point, not an oversight: with no
+			// `Auth` block there is no auth resource config to hand the provider,
+			// and a custom provider that sources its own credentials does not
+			// need one. Pinning it here keeps the contract explicit.
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId,
+			).toHaveBeenCalledWith({
+				authConfig: undefined,
+				authenticated: false,
+				forceRefresh: undefined,
+			});
+			expect(session.credentials).toEqual({ accessKeyId: 'AKIA' });
+		});
+
+		it('invokes a custom tokenProvider from getTokens', async () => {
+			const { tokenProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { tokenProvider },
+			});
+
+			await ctx.getTokens({ forceRefresh: false });
+
+			expect(tokenProvider.getTokens).toHaveBeenCalledWith({
+				forceRefresh: false,
+			});
+		});
+
+		it('invokes a custom credentialsProvider from clearCredentials', async () => {
+			const { credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { credentialsProvider },
+			});
+
+			await ctx.clearCredentials();
+
+			expect(
+				credentialsProvider.clearCredentialsAndIdentityId,
+			).toHaveBeenCalledTimes(1);
+		});
+
+		it('resolves an empty session when no Auth providers are supplied', async () => {
+			const ctx = createAmplifyContext(iamResourcesConfig);
+
+			await expect(ctx.fetchAuthSession()).resolves.toEqual({
+				tokens: undefined,
+				credentials: undefined,
+				identityId: undefined,
+				userSub: undefined,
+			});
+		});
 	});
 
 	describe('skipConfigParse (internal single-parse option)', () => {
```

**File**: `packages/core/src/context/createAmplifyContext.ts` (modified, +15/-3)
```diff
@@ -93,10 +93,22 @@ export function createAmplifyContext(
 
 	// Fresh, per-context Auth instance (not the global singleton) so that
 	// multiple contexts remain isolated from one another.
+	//
+	// `configure()` is called UNCONDITIONALLY, exactly as the pre-context
+	// `AmplifyClass.configure()` does (see singleton/Amplify.ts). It is the only
+	// place `AuthClass` stores `libraryOptions.Auth`, so gating it on the
+	// presence of `resourcesConfig.Auth` would silently drop caller-supplied
+	// token/credentials providers whenever the resource config carries no `Auth`
+	// block — the shape `getAmplifyDataClientConfig()` produces for IAM-authed
+	// Data access from a Lambda (`API.GraphQL` only, plus a custom
+	// `credentialsProvider`). `AuthClass.configure()` tolerates an undefined
+	// auth resource config.
+	//
+	// The `Auth!` assertion is deliberately false: in the very case this fixes,
+	// `Auth` IS undefined at runtime. It mirrors the identical assertion in the
+	// singleton rather than widening `AuthClass.configure()`'s parameter type.
 	const auth = new AuthClass();
-	if (resolvedResourceConfig.Auth) {
-		auth.configure(resolvedResourceConfig.Auth, resolvedLibraryOptions.Auth);
-	}
+	auth.configure(resolvedResourceConfig.Auth!, resolvedLibraryOptions.Auth);
 
 	const ctx: AmplifyContext = {
 		// Already deep-frozen above (both parse paths).
```

---

### Incident Patch 3: `dd20d261` (2026-09-25)
**Commit Message**: fix(core): externalize tslib to fix SSR module resolution (#14956)

fix(core): mark tslib external to fix SSR module resolution

**File**: `.changeset/tslib-external-ssr-resolution.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/core': patch
+---
+
+fix(core): mark tslib as external in the rollup build so ESM/CJS output imports the bare `tslib` specifier instead of a vendored nested copy, fixing SSR module resolution (ERR_MODULE_NOT_FOUND) under bundlers like Nitro/Nuxt
```

**File**: `packages/core/rollup.config.mjs` (modified, +9/-0)
```diff
@@ -13,16 +13,25 @@ import {
 
 const input = getInputForGlob('src/**/*.ts');
 
+// Keep `tslib` a bare external specifier. With `importHelpers` enabled,
+// downleveled helpers (e.g. for native `#private` fields) import from
+// `tslib`; without this, rollup would bundle it and `preserveModules` would
+// emit a nested `node_modules/tslib` copy that SSR bundlers (Nitro/Nuxt)
+// fail to trace, causing ERR_MODULE_NOT_FOUND. tslib is a runtime dependency.
+const external = [/^tslib(\/.*)?$/];
+
 const config = defineConfig([
 	// CJS config
 	{
 		input: input,
+		external,
 		output: cjsOutput,
 		plugins: [typescript(cjsTSOptions)],
 	},
 	// ESM config
 	{
 		input: input,
+		external,
 		output: esmOutput,
 		plugins: [typescript(esmTSOptions)],
 	},
```

---

### Incident Patch 4: `d8f5356d` (2026-09-18)
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

### Incident Patch 5: `fb070dd3` (2026-09-17)
**Commit Message**: fix(api-graphql): correlate Events publish errors by operation id (#14950)

* fix(api-graphql): correlate Events publish errors by operation id (#14946)

The Events WebSocket is multiplexed across operations. A publish promise
was rejecting on any error frame carrying `data.errors`, including
subscribe_error frames belonging to unrelated operations on other
channels. Gate rejection on `data.id === subscriptionId` so a publish
only settles on error frames correlated to its own operation id.

Adds regression coverage verifying unrelated subscribe_error frames no
longer reject a publish and matching publish_error frames still reject.

Fixes #14946

* chore(changeset): add patch changeset for api-graphql Events publish error correlation

* fix(api-graphql): gate Events publish errors on publish_error type (#14946)

Mirror the publish_success gate on the publish error branch so only the terminal publish_error frame correlated by operation id settles a pending publish. Document that AppSync Events guarantees every publish response frame carries the operation id, so uncorrelated or id-less error frames are intentionally ignored for the publish. Add a test pinning the id-less case.

**File**: `.changeset/fix-api-graphql-events-publish-error-correlation.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+'@aws-amplify/api-graphql': patch
+---
+
+fix(api-graphql): correlate Events publish errors by operation id
+
+The AppSync Events WebSocket is multiplexed across operations, so a single
+socket carries error frames for many channels at once. A publish promise
+previously rejected on any incoming error frame that carried `data.errors` —
+including `subscribe_error` frames belonging to unrelated operations on other
+channels — causing publishes to fail spuriously.
+
+Rejection is now gated on `data.id === subscriptionId`, so a publish only
+settles on error frames correlated to its own operation id. Error frames for
+unrelated operations are ignored, while matching `publish_error` frames still
+reject the publish as before.
```

**File**: `packages/api-graphql/__tests__/AWSAppSyncEventProvider.test.ts` (modified, +201/-0)
```diff
@@ -721,6 +721,207 @@ describe('AppSyncEventProvider', () => {
 		});
 	});
 
+	describe('publish error-frame correlation (issue #14946)', () => {
+		let provider: AWSAppSyncEventProvider;
+		let reachabilityObserver: Observer<{ online: boolean }>;
+		let messageListeners: EventListener[];
+		let capturedPublishId: string | undefined;
+
+		beforeEach(() => {
+			// Set the network to "online" for these tests
+			jest
+				.spyOn(Reachability.prototype, 'networkMonitor')
+				.mockImplementationOnce(
+					() =>
+						new Observable(observer => {
+							reachabilityObserver = observer;
+						}),
+				)
+				// Twice because we subscribe to get the initial state then again to monitor reachability
+				.mockImplementationOnce(
+					() =>
+						new Observable(observer => {
+							reachabilityObserver = observer;
+						}),
+				);
+
+			provider = new AWSAppSyncEventProvider();
+
+			messageListeners = [];
+			capturedPublishId = undefined;
+
+			// Minimal controllable socket: it records the 'message' listener the
+			// provider registers for the publish and captures the id of the frame
+			// it sends, so the test can replay arbitrary server frames and assert
+			// how the publish promise correlates them. (The shared
+			// FakeWebSocketInterface no-ops addEventListener, so it cannot exercise
+			// the publish listener path.)
+			const controllableSocket = {
+				onclose: (_event: CloseEvent) => {},
+				onerror: (_event: Event) => {},
+				addEventListener: (type: string, listener: EventListener) => {
+					if (type === 'message') {
+						messageListeners.push(listener);
+					}
+				},
+				removeEventListener: (type: string, listener: EventListener) => {
+					if (type === 'message') {
+						messageListeners = messageListeners.filter(l => l !== listener);
+					}
+				},
+				send: (data: string) => {
+					capturedPublishId = JSON.parse(String(data)).id;
+				},
+				close: () => {
+					controllableSocket.onclose(new CloseEvent('close'));
+				},
+			};
+
+			Object.defineProperty(provider, 'socketStatus', {
+				value: constants.SOCKET_STATUS.READY,
+			});
+			Object.defineProperty(provider, 'awsRealTimeSocket', {
+				value: controllableSocket,
+				writable: true,
+				configurable: true,
+			});
+		});
+
+		afterEach(async () => {
+			provider?.close();
+		});
+
+		const deliverFrame = (frame: Record<string, unknown>) => {
+			const event = new MessageEvent('message', {
+				data: JSON.stringify(frame),
+			});
+			messageListeners.forEach(listener => listener(event));
+		};
+
+		const waitForPublishSent = async () => {
+			for (let i = 0; i < 200 && capturedPublishId === undefined; i++) {
+				await delay(5);
+			}
+			if (capturedPublishId === undefined) {
+				throw new Error('publish frame was never sent');
+			}
+		};
+
+		test('a pending publish is not rejected by an unrelated subscription error frame', async () => {
+			expect.assertions(1);
+
+			const pub = provider.publish({
+				appSyncGraphqlEndpoint: 'ws://localhost:8080',
+				query: 'events/allowed-channel',
+				variables: { some: 'data' },
+				authenticationType: 'iam',
+				region: 'us-east-1',
+			});
+
+			// Wait until the publish frame has been sent and its id captured.
+			await waitForPublishSent();
+
+			// An error frame for a DIFFERENT operation id (e.g. a subscribe_error
+			// on an unrelated channel) arrives while this publish is in flight.
+			// It must not settle this publish's promise.
+			deliverFrame({
+				id: 'unrelated-subscription-id',
+				type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+				errors: [
+					{
+						errorType: 'AuthorizationError',
+						message: 'Not authorized to access channel',
+					},
+				],
+			});
+
+			// The correlated publish_success then arrives for this publish.
+			deliverFrame({
+				id: capturedPublishId,
+				type: MESSAGE_TYPES.EVENT_PUBLISH_ACK,
+			});
+
+			// The publish was accepted, so the promise must resolve — the
+			// unrelated error frame must not have rejected it.
+			await expect(pub).resolves.toBeUndefined();
+		});
+
+		test('a pending publish is still rejected by an error frame correlated to its own operation id', async () => {
+			expect.assertions(1);
+
+			const pub = provider.publish({
+				appSyncGraphqlEndpoint: 'ws://localhost:8080',
+				query: 'events/denied-channel',
+				variables: { some: 'data' },
+				authenticationType: 'iam',
+				region: 'us-east-1',
+			});
+
+			// Wait until the publish frame has been sent and its id captured.
+			await waitForPublishSent();
+
+			// A genuine publish_error frame correlated to THIS publish's operation
+			// id arrives. (AppSync Events emits publish_error for a failed publish;
+			// a subscribe_error would never legitimately carry a publish's id.)
+			// The id-correlation guard must not suppress it: a matching-id error
+			// must retain the original rejection behavior so genuine publish
+			// failures still surface to the caller.
+			deliverFrame({
+				id: capturedPublishId,
+				type: 'publ
```

**File**: `packages/api-graphql/src/Providers/AWSWebSocketProvider/index.ts` (modified, +15/-0)
```diff
@@ -271,6 +271,21 @@ export abstract class AWSWebSocketProvider {
 					}
 
 					if (data.errors && data.errors.length > 0) {
+						// Only reject on the terminal `publish_error` frame correlated to
+						// THIS publish's operation id. AppSync Events guarantees that every
+						// publish response frame (`publish_success`/`publish_error`) carries
+						// the operation `id`, so error frames are correlated by `id` exactly
+						// like the `publish_success` branch above, and the `data.type` gate
+						// mirrors that branch's specificity. The socket is multiplexed, so an
+						// error frame (e.g. a `subscribe_error`) can belong to an unrelated
+						// operation on another channel; likewise an uncorrelated or id-less
+						// error frame is not this publish's response. Such frames are
+						// intentionally ignored for this publish and must not settle its
+						// promise.
+						if (data.id !== subscriptionId || data.type !== 'publish_error') {
+							return;
+						}
+
 						const errorTypes = data.errors.map((error: any) => error.errorType);
 						cleanup();
 						reject(new Error(`Publish errors: ${errorTypes.join(', ')}`));
```

---

### Incident Patch 6: `f87199a0` (2026-09-17)
**Commit Message**: fix(api-graphql): keep Events subscribe authorization errors scoped to a single subscription (#14951)

**File**: `.changeset/quick-mangos-wave.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+'@aws-amplify/api-graphql': patch
+---
+
+fix(api-graphql): keep Events subscribe authorization errors scoped to a single subscription
+
+An authorization error on an Events subscribe (for example a per-subscription `util.unauthorized()` deny, surfaced as errorType `Unauthorized`) is no longer treated as a connection-level auth failure. Previously it closed the shared WebSocket, which tore down sibling subscriptions and, for a permanently denied channel, produced an unbounded deny/reconnect loop. The error is now delivered only to the affected subscription; other active subscriptions and the shared socket stay connected. Connection-level `GQL_ERROR` auth failures still trigger a reconnect as before.
+
+Fixes https://github.com/aws-amplify/amplify-js/issues/14947
```

**File**: `packages/api-graphql/__tests__/AWSAppSyncEventProvider.test.ts` (modified, +108/-0)
```diff
@@ -280,6 +280,114 @@ describe('AppSyncEventProvider', () => {
 					);
 				});
 
+				test('a subscribe_error with errorType "Unauthorized" (util.unauthorized) fails only that subscription and does NOT close the shared socket', async () => {
+					expect.assertions(2);
+
+					// Do not call through: we only want to observe whether the provider
+					// initiates a socket close, not drive the reconnect machinery.
+					const socketCloseSpy = jest
+						.spyOn(fakeWebSocketInterface.webSocket, 'close')
+						.mockImplementation(() => {});
+
+					const observer = provider.subscribe({
+						appSyncGraphqlEndpoint: 'ws://localhost:8080',
+					});
+
+					const errorSpy = jest.fn();
+					observer.subscribe({
+						error: errorSpy,
+					});
+
+					await fakeWebSocketInterface?.standardConnectionHandshake();
+					await fakeWebSocketInterface?.startAckMessage({
+						connectionTimeoutMs: 100,
+					});
+
+					// A per-subscription authorization denial: AppSync's util.unauthorized()
+					// surfaces as an errorType "Unauthorized" subscribe_error frame.
+					await fakeWebSocketInterface?.sendDataMessage({
+						id: fakeWebSocketInterface?.webSocket.subscriptionId,
+						type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+						errors: [
+							{
+								errorType: 'Unauthorized',
+								message: 'You are not authorized to make this call.',
+							},
+						],
+					});
+
+					// The denied subscription's observable errors out (terminal to just it)
+					expect(errorSpy).toHaveBeenCalledWith(
+						expect.objectContaining({
+							errors: [
+								expect.objectContaining({
+									message:
+										'Connection failed: Unauthorized: You are not authorized to make this call.',
+								}),
+							],
+						}),
+					);
+
+					// The shared socket must stay open so sibling subscriptions survive
+					expect(socketCloseSpy).not.toHaveBeenCalledWith(
+						1000,
+						'Auth error - reconnecting',
+					);
+				});
+
+				test('a subscribe_error whose message contains "Token expired" does NOT close the shared socket', async () => {
+					expect.assertions(2);
+
+					const socketCloseSpy = jest
+						.spyOn(fakeWebSocketInterface.webSocket, 'close')
+						.mockImplementation(() => {});
+
+					const observer = provider.subscribe({
+						appSyncGraphqlEndpoint: 'ws://localhost:8080',
+					});
+
+					const errorSpy = jest.fn();
+					observer.subscribe({
+						error: errorSpy,
+					});
+
+					await fakeWebSocketInterface?.standardConnectionHandshake();
+					await fakeWebSocketInterface?.startAckMessage({
+						connectionTimeoutMs: 100,
+					});
+
+					// Incidental "Token expired" text on a per-subscription error frame
+					// must not be classified as a connection-level credentials failure.
+					await fakeWebSocketInterface?.sendDataMessage({
+						id: fakeWebSocketInterface?.webSocket.subscriptionId,
+						type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+						errors: [
+							{
+								errorType: 'AuthorizationError',
+								message: 'Token expired for this channel',
+							},
+						],
+					});
+
+					// The denied subscription's observable errors out (terminal to just it)
+					expect(errorSpy).toHaveBeenCalledWith(
+						expect.objectContaining({
+							errors: [
+								expect.objectContaining({
+									message:
+										'Connection failed: AuthorizationError: Token expired for this channel',
+								}),
+							],
+						}),
+					);
+
+					// The shared socket must stay open so sibling subscriptions survive
+					expect(socketCloseSpy).not.toHaveBeenCalledWith(
+						1000,
+						'Auth error - reconnecting',
+					);
+				});
+
 				test('subscription observer error is not triggered when a connection is formed and a retriable connection_error data message is received', async () => {
 					expect.assertions(2);
 
```

**File**: `packages/api-graphql/src/Providers/AWSWebSocketProvider/index.ts` (modified, +10/-3)
```diff
@@ -715,9 +715,16 @@ export abstract class AWSWebSocketProvider {
 					if (Array.isArray(errors) && errors.length > 0) {
 						const error = errors[0];
 						errorMessage = `${error.errorType}: ${error.message}`;
-						isAuthError =
-							AUTH_ERROR_TYPES.includes(error.errorType) ||
-							error.message?.includes('Token expired');
+						// An Events subscribe_error (e.g. a per-subscription
+						// util.unauthorized() deny, which surfaces as errorType
+						// 'Unauthorized', or an error whose message incidentally
+						// contains 'Token expired') is terminal to only this
+						// subscription. It must NOT close the shared socket: doing so
+						// tears down sibling subscriptions and, for a permanently
+						// denied channel, produces an unbounded deny/reconnect loop.
+						// So isAuthError stays false here — only connection-level
+						// GQL_ERROR auth failures below trigger a socket-closing
+						// reconnect.
 					}
 				} else if (
 					type === MESSAGE_TYPES.GQL_ERROR &&
```

---

### Incident Patch 7: `b3fa3570` (2026-09-16)
**Commit Message**: fix(deps): remediate open Dependabot alerts (#14949)

* fix(deps): remediate open Dependabot alerts

Upgrade vulnerable transitive/dev dependencies to close all 7 open Dependabot alerts across 5 packages (upgrades only, no new resolutions/overrides):

- next: 2 critical alerts -> ^16.3.4 (resolves 16.3.5)
- sharp: 1 alert -> 0.35.4 (via next optional dep)
- js-yaml: 1 alert -> 4.3.2
- joi: 2 low alerts -> 18.2.9
- baseline-browser-mapping: 1 alert -> 2.11.20

Published peerDependency range for next is intentionally unchanged.

* chore(adapter-nextjs): remove changeset for non-releasable dependabot fix

The dependency bumps remediate Dependabot alerts and do not require a
package release, so the release changeset is unnecessary.

**File**: `packages/adapter-nextjs/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 		"@types/react-dom": "^18.2.6",
 		"aws-amplify": "6.21.0",
 		"jest-fetch-mock": "3.0.3",
-		"next": ">= 13.5.0 <17.0.0"
+		"next": "^16.3.4"
 	},
 	"publishConfig": {
 		"access": "public"
```

**File**: `yarn.lock` (modified, +220/-225)
```diff
@@ -2637,10 +2637,10 @@
     "@emnapi/wasi-threads" "1.0.4"
     tslib "^2.4.0"
 
-"@emnapi/runtime@^1.11.1":
-  version "1.11.2"
-  resolved "https://registry.yarnpkg.com/@emnapi/runtime/-/runtime-1.11.2.tgz#eb22f04d76febfdf4f87fdaff54c8a53f6bf0dbd"
-  integrity sha512-kyOl3X0DuTiT1h2ft8r2fYO8JYtU9a9Xis/zBSiGArNaagCOWx90N1k2wxp18czFDH+OgcWGb5ZP/XMt3dcyPA==
+"@emnapi/runtime@^1.11.3":
+  version "1.11.3"
+  resolved "https://registry.yarnpkg.com/@emnapi/runtime/-/runtime-1.11.3.tgz#84257ae3b0531eb2aec1ffa23d70700da007ba95"
+  integrity sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==
   dependencies:
     tslib "^2.4.0"
 
@@ -2840,161 +2840,161 @@
   resolved "https://registry.yarnpkg.com/@img/colour/-/colour-1.1.0.tgz#b0c2c2fa661adf75effd6b4964497cd80010bb9d"
   integrity sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==
 
-"@img/sharp-darwin-arm64@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.3.tgz#8b2740884bc58b127fc3020479a01294fa1095cb"
-  integrity sha512-RMnFX7YQsMoh7lWfcM4NEHHymBX/rLuKNPVM84XE9ONPcaSCDgE7CHIHpSgPcO2xcRthgBy1HfNO319mwhIAkg==
+"@img/sharp-darwin-arm64@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.4.tgz#bc10b262de2fc80088013f5f998298d1c8909fbf"
+  integrity sha512-Uhfl4V4lhP2nbUVF9+hyH1+luj86f1gUFeo8ALYxFoULoU+G87D43BfeMP8XHsk9boxAnCY/bf2EHwhA7MuGsA==
   optionalDependencies:
-    "@img/sharp-libvips-darwin-arm64" "1.3.2"
+    "@img/sharp-libvips-darwin-arm64" "1.3.3"
 
-"@img/sharp-darwin-x64@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.3.tgz#92df91320faf57cc54b331185770d5a93d510049"
-  integrity sha512-Xo+5uFBtLN0BKqieTxiFzFPQAUlBbbH5iBKyRX/z1JrbnYsHTfKJnUfL8+p2TPXr1pXqao4eeL4Rl144uDpK9w==
+"@img/sharp-darwin-x64@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.4.tgz#76c49ff04fb3f9d846b0d0575841b7ee59beec68"
+  integrity sha512-hWniXY3bG5qKpkKrAwPe4y+VTPmf086YQAnkxWh7uA1YrlRouWGa0M0Mxj3ZjnXFkv7/TD1bTy9lGUK26vRvWw==
   optionalDependencies:
-    "@img/sharp-libvips-darwin-x64" "1.3.2"
+    "@img/sharp-libvips-darwin-x64" "1.3.3"
 
-"@img/sharp-freebsd-wasm32@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.3.tgz#48018c1379a8f507d681d6cd8dbe43d9795dc809"
-  integrity sha512-lUxcqWIj2wMQ9BrwNjngcr1gWUr5xgaGThBRqPPalIC2n67Cqj1uPh8NnA/ZhAg8hUbKl+kVHKwgUIwe6ZYPrg==
+"@img/sharp-freebsd-wasm32@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.4.tgz#ba55fd603c5d1d01a1cb14ffb4d970bc6ced80e1"
+  integrity sha512-lIsKw/BU+kjB4eZjxrYrZmwOJYi3Ajrv66iAlBmUPyKc3HpnloevB1g3wxGD9P/5BbQ1brBGl65VRRrCvQDEqA==
   dependencies:
-    "@img/sharp-wasm32" "0.35.3"
+    "@img/sharp-wasm32" "0.35.4"
 
-"@img/sharp-libvips-darwin-arm64@1.3.2":
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.2.tgz#227b41ffc6c99612bceaba56f994a1933d779573"
-  integrity sha512-9J6ypZFpQBj4YnePGoq/S38w6nz+vqg5WZLrLGY4YuSemdMq47GMLBPO42MzwdGwpg/agZ7xzZcFHa48xlywfg==
+"@img/sharp-libvips-darwin-arm64@1.3.3":
+  version "1.3.3"
+  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.3.tgz#08a6cf4fb4ee8d45f99404a569dcaa6b29391d97"
+  integrity sha512-suTBPTDGrI9WodccaDdwZItTSaBYASlBk1NSfElSHrUfzu3szG6lvIF58+WiFvnfzuK8ZBFS5zE00PxqxnRiPg==
 
-"@img/sharp-libvips-darwin-x64@1.3.2":
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.2.tgz#694903ec410c00945ce5b0c26dac83d7184c8b86"
-  integrity sha512-m2pW1n6cns9VaubNwsZ+c3CRYjxNQWgJ5gPlnL1nbBcpkBvFm6SCFN5o0psFHI8w9n11NKhFkeEDns98tiqbEw==
+"@img/sharp-libvips-darwin-x64@1.3.3":
+  version "1.3.3"
+  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.3.tgz#1461e6fb310a869b3c13504589b8dd5c06624da8"
+  integrity sha512-FVJZ5mITMobmXIz/hPDTw0EintTW5H3WfrxwLqEqjiIihlu+hVRyGrFQ60xl0Lxn7Bt3zdpevPaQi0HEzqz9fw==
 
-"@img/sharp-libvips-linux-arm64@1.3.2":
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.2.tgz#49ddf156728666a21deed0716f3bb72bb351179e"
-  integrity sha512-dqVSFynCox4C/J8kT16V7SIFAns0IjgLwkvYT7p8LQVmJ5OS5b6tI9IGflxTeuBS//zXeFIUbwt5dwxyZ17cnA==
+"@img/sharp-libvips-linux-arm64@1.3.3":
+  version "1.3.3"
+  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.3.tgz#cb938a3971b9a36329bc99427f1e5b72e266ba2e"
+  integrity sha512-0DaL0A6Xu6sQSQFwe4iVCrKWU2cCTItnRsYsCdxAMm9NF6twAA9BKnoqy4hqz4+azQ0JHuA26qi
```

---

### Incident Patch 8: `556185e7` (2026-09-09)
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

### Incident Patch 9: `ca44980d` (2026-09-07)
**Commit Message**: fix(interactions): bump fflate to 0.7.5 to fix unzipSync DoS (resolves #308/#309) (#14939)

fix(interactions): bump fflate to 0.7.5 to fix unzipSync infinite-loop DoS

Resolves Dependabot alerts #308 (packages/interactions) and #309 (yarn.lock).
fflate 0.7.3 -> 0.7.5 (patched); direct runtime dependency of @aws-amplify/interactions.

Co-authored-by: Osama Rizk <[REDACTED_EMAIL]>

**File**: `.changeset/fix-interactions-fflate-dos.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/interactions': patch
+---
+
+fix(interactions): bump fflate to 0.7.5 to address unzipSync infinite-loop DoS (GHSA)
```

**File**: `packages/interactions/package.json` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@
 		"@aws-sdk/client-lex-runtime-service": "^3.1012.0",
 		"@aws-sdk/client-lex-runtime-v2": "^3.1012.0",
 		"base-64": "1.0.0",
-		"fflate": "0.7.3",
+		"fflate": "0.7.5",
 		"pako": "2.0.4",
 		"tslib": "^2.5.0"
 	},
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -7988,10 +7988,10 @@ fdir@^6.5.0:
   resolved "https://registry.yarnpkg.com/fdir/-/fdir-6.5.0.tgz#ed2ab967a331ade62f18d077dae192684d50d350"
   integrity sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==
 
-fflate@0.7.3:
-  version "0.7.3"
-  resolved "https://registry.yarnpkg.com/fflate/-/fflate-0.7.3.tgz#288b034ff0e9c380eaa2feff48c787b8371b7fa5"
-  integrity sha512-0Zz1jOzJWERhyhsimS54VTqOteCNwRtIlh8isdL0AXLo0g7xNTfTL7oWrkmCnPhZGocKIkWHBistBrrpoNH3aw==
+fflate@0.7.5:
+  version "0.7.5"
+  resolved "https://registry.yarnpkg.com/fflate/-/fflate-0.7.5.tgz#1dfcb7189bc104d599da0436eace14ed26de879f"
+  integrity sha512-QieYf//cis6ywHNi5qW1+PXPQ4bC+XVJAtS4AXIML8P76GroEiOxm/oQtn1f02UkJY1+KsXMJcC+R2v/Eg4G3g==
 
 file-entry-cache@^8.0.0:
   version "8.0.0"
```

---

### Incident Patch 10: `b44e0183` (2026-09-04)
**Commit Message**: fix(datastore): apply pagination when only one record matches (#14926)

`inMemoryPagination` guarded its pagination branch on `records.length > 1`,
so a result set of exactly one record was returned verbatim for any `page`.
Querying page 0 and then page 1 of a single-record table therefore yielded
the same item twice instead of an empty second page.

Only an empty result set is genuinely unaffected by pagination, so the
guard now checks `records.length > 0`. A single record follows exactly the
same slicing path as any larger set rather than taking a size-dependent
special case; the 0-record and multi-record paths are unchanged.

Adds unit coverage for inMemoryPagination over 0/1/multiple records,
pages past the end, and an absent sort predicate.

Fixes #12049

**File**: `.changeset/fix-datastore-single-record-pagination.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/datastore': patch
+---
+
+fix(datastore): apply pagination when only one record matches a query
```

**File**: `packages/datastore/__tests__/util.test.ts` (modified, +56/-0)
```diff
@@ -20,6 +20,7 @@ import {
 	isIdOptionallyManaged,
 	indexNameFromKeys,
 	keysEqual,
+	inMemoryPagination,
 } from '../src/util';
 
 import { testSchema } from './helpers';
@@ -841,4 +842,59 @@ describe('datastore util', () => {
 			});
 		});
 	});
+
+	// See https://github.com/aws-amplify/amplify-js/issues/12049
+	describe('inMemoryPagination', () => {
+		const buildRecords = (count: number) =>
+			Array.from({ length: count }, (_, index) => ({ id: `id-${index}` }));
+
+		test('should return an empty page when there are no records', () => {
+			expect(
+				inMemoryPagination(buildRecords(0), { page: 1, limit: 20 }),
+			).toEqual([]);
+		});
+
+		test('should return the only record on the first page', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 0, limit: 20 }),
+			).toEqual([{ id: 'id-0' }]);
+		});
+
+		test('should return an empty page for the page after a single record', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 1, limit: 20 }),
+			).toEqual([]);
+		});
+
+		test('should return an empty page for any page past a single record', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 2, limit: 1 }),
+			).toEqual([]);
+		});
+
+		test('should page through multiple records', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 0, limit: 2 }),
+			).toEqual([{ id: 'id-0' }, { id: 'id-1' }]);
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 1, limit: 2 }),
+			).toEqual([{ id: 'id-2' }]);
+		});
+
+		test('should return an empty page past the end of multiple records', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 2, limit: 2 }),
+			).toEqual([]);
+		});
+
+		test('should not require a sort predicate', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), {
+					page: 1,
+					limit: 2,
+					sort: undefined,
+				}),
+			).toEqual([{ id: 'id-2' }]);
+		});
+	});
 });
```

**File**: `packages/datastore/src/util.ts` (modified, +3/-1)
```diff
@@ -621,7 +621,9 @@ export function inMemoryPagination<T extends PersistentModel>(
 	records: T[],
 	pagination?: PaginationInput<T>,
 ): T[] {
-	if (pagination && records.length > 1) {
+	// Only an empty set is unaffected by pagination: with one record a page
+	// beyond the first must still resolve to no records.
+	if (pagination && records.length > 0) {
 		if (pagination.sort) {
 			const sortPredicates = ModelSortPredicateCreator.getPredicates(
 				pagination.sort,
```

---

### Incident Patch 11: `340ecd38` (2026-09-03)
**Commit Message**: fix(deps): bump qs 6.16.0, fast-uri 3.1.7, @humanfs/node 0.16.8 (resolves #302-#305) (#14936)

fix(deps): bump qs, fast-uri, @humanfs/node to patched versions

Resolves Dependabot alerts:
- qs 6.15.3 -> 6.16.0: array-limit bypass (#305)
- fast-uri 3.1.5 -> 3.1.7: SSRF (#304) & host confusion (#303)
- @humanfs/node 0.16.6 -> 0.16.8: recursive copy follows symlinks (#302)

Co-authored-by: Osama Rizk <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +4/-2)
```diff
@@ -135,14 +135,16 @@
 		"**/glob/minipass": "6.0.2",
 		"xml2js": "0.5.0",
 		"**/form-data": "4.0.6",
-		"qs": "^6.14.1",
+		"qs": "^6.16.0",
 		"js-yaml": "^4.3.1",
 		"launch-editor": "^2.14.1",
 		"serialize-javascript": "^7.0.5",
 		"@tootallnate/once": "3.0.1",
 		"uuid": "^11.1.1",
 		"joi": "^18.2.1",
-		"**/next/sharp": "^0.35.0"
+		"**/next/sharp": "^0.35.0",
+		"fast-uri": "^3.1.6",
+		"@humanfs/node": "^0.16.8"
 	},
 	"packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
 }
```

**File**: `yarn.lock` (modified, +27/-24)
```diff
@@ -2796,30 +2796,33 @@
   dependencies:
     "@hapi/hoek" "^11.0.2"
 
-"@humanfs/core@^0.19.1":
-  version "0.19.1"
-  resolved "https://registry.yarnpkg.com/@humanfs/core/-/core-0.19.1.tgz#17c55ca7d426733fe3c561906b8173c336b40a77"
-  integrity sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==
+"@humanfs/core@^0.19.2":
+  version "0.19.2"
+  resolved "https://registry.yarnpkg.com/@humanfs/core/-/core-0.19.2.tgz#a8272ca03b2acf492670222b2320b6c421bfde60"
+  integrity sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==
+  dependencies:
+    "@humanfs/types" "^0.15.0"
 
-"@humanfs/node@^0.16.6":
-  version "0.16.6"
-  resolved "https://registry.yarnpkg.com/@humanfs/node/-/node-0.16.6.tgz#ee2a10eaabd1131987bf0488fd9b820174cd765e"
-  integrity sha512-YuI2ZHQL78Q5HbhDiBA1X4LmYdXCKCMQIfw0pw7piHJwyREFebJUvrQN4cMssyES6x+vfUbx1CIpaQUKYdQZOw==
+"@humanfs/node@^0.16.6", "@humanfs/node@^0.16.8":
+  version "0.16.8"
+  resolved "https://registry.yarnpkg.com/@humanfs/node/-/node-0.16.8.tgz#8f800cccc13f4f8cd3116e2d9c0a94939da3e3ed"
+  integrity sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==
   dependencies:
-    "@humanfs/core" "^0.19.1"
-    "@humanwhocodes/retry" "^0.3.0"
+    "@humanfs/core" "^0.19.2"
+    "@humanfs/types" "^0.15.0"
+    "@humanwhocodes/retry" "^0.4.0"
+
+"@humanfs/types@^0.15.0":
+  version "0.15.0"
+  resolved "https://registry.yarnpkg.com/@humanfs/types/-/types-0.15.0.tgz#f2a09f62012390b2bff3fc6fb248ddec8c09a090"
+  integrity sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==
 
 "@humanwhocodes/module-importer@^1.0.1":
   version "1.0.1"
   resolved "https://registry.yarnpkg.com/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz#af5b2691a22b44be847b0ca81641c5fb6ad0172c"
   integrity sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==
 
-"@humanwhocodes/retry@^0.3.0":
-  version "0.3.1"
-  resolved "https://registry.yarnpkg.com/@humanwhocodes/retry/-/retry-0.3.1.tgz#c72a5c76a9fbaf3488e231b13dc52c0da7bab42a"
-  integrity sha512-JBxkERygn7Bv/GbN5Rv8Ul6LVknS+5Bp6RgDC/O8gEBU/yeH5Ui5C/OlWrTb6qct7LjjfT6Re2NxB0ln0yYybA==
-
-"@humanwhocodes/retry@^0.4.2":
+"@humanwhocodes/retry@^0.4.0", "@humanwhocodes/retry@^0.4.2":
   version "0.4.3"
   resolved "https://registry.yarnpkg.com/@humanwhocodes/retry/-/retry-0.4.3.tgz#c2b9d2e374ee62c586d3adbea87199b1d7a7a6ba"
   integrity sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==
@@ -7923,10 +7926,10 @@ fast-levenshtein@^2.0.6:
   resolved "https://registry.yarnpkg.com/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz#3d8a5c66883a16a30ca8643e851f19baa7797917"
   integrity sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==
 
-fast-uri@^3.0.1:
-  version "3.1.5"
-  resolved "https://registry.yarnpkg.com/fast-uri/-/fast-uri-3.1.5.tgz#610f37419a030270430cecd68d74e3d4d96725d0"
-  integrity sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==
+fast-uri@^3.0.1, fast-uri@^3.1.6:
+  version "3.1.7"
+  resolved "https://registry.yarnpkg.com/fast-uri/-/fast-uri-3.1.7.tgz#743157d957f3cbb4c65310e033dc2ad4ad7dc60a"
+  integrity sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==
 
 fast-xml-builder@^1.1.5:
   version "1.2.0"
@@ -11123,10 +11126,10 @@ pure-rand@^6.0.0:
   resolved "https://registry.yarnpkg.com/pure-rand/-/pure-rand-6.1.0.tgz#d173cf23258231976ccbdb05247c9787957604f2"
   integrity sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==
 
-qs@^6.14.1, qs@~6.15.1:
-  version "6.15.3"
-  resolved "https://registry.yarnpkg.com/qs/-/qs-6.15.3.tgz#76852132a58ed5c7c0ef67e4441b9bb5d6061b3b"
-  integrity sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliSvy5Dzx7/DJcI+SwgICv+IneSZwhBh1oSyEHA71A==
+qs@^6.16.0, qs@~6.15.1:
+  version "6.16.0"
+  resolved "https://registry.yarnpkg.com/qs/-/qs-6.16.0.tgz#c22c723a28a920f3aacdce8289fabd43eccb79fd"
+  integrity sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==
   dependencies:
     es-define-property "^1.0.1"
     side-channel "^1.1.1"
```

---

### Incident Patch 12: `36e3ce19` (2026-08-18)
**Commit Message**: fix(deps): bump transitive nanoid to 3.3.18 (#14911)

nanoid <3.3.18 has an infinite-loop DoS in customAlphabet/customRandom
when called with size 0. The 3.x copy is pulled in transitively via
next > postcss; its existing ^3.3.16 range already permits the patched
release, so re-resolving the lockfile entry is sufficient.

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -10391,9 +10391,9 @@ ms@2.1.3, ms@^2.1.1, ms@^2.1.3:
   integrity sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==
 
 nanoid@^3.3.16:
-  version "3.3.17"
-  resolved "https://registry.yarnpkg.com/nanoid/-/nanoid-3.3.17.tgz#f1c3aa253c52547956a52c50bff754316f61037a"
-  integrity sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==
+  version "3.3.18"
+  resolved "https://registry.yarnpkg.com/nanoid/-/nanoid-3.3.18.tgz#f66a2de1199ffde0fcf21c8a5f13106b1c081913"
+  integrity sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==
 
 nanoid@^5.1.0:
   version "5.1.16"
```

---

### Incident Patch 13: `75e63c5d` (2026-08-18)
**Commit Message**: fix(deps): patch nanoid and js-yaml Dependabot alerts (#14910)

- js-yaml 4.3.0 -> 4.3.1 via root resolutions bump (quadratic CPU
  consumption in !!omap resolution)
- nanoid 5.1.6 -> 5.1.16 via lockfile re-resolve (non-secure generators
  can loop indefinitely with a negative length)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@
 		"xml2js": "0.5.0",
 		"**/form-data": "4.0.6",
 		"qs": "^6.14.1",
-		"js-yaml": "^4.3.0",
+		"js-yaml": "^4.3.1",
 		"launch-editor": "^2.14.1",
 		"serialize-javascript": "^7.0.5",
 		"@tootallnate/once": "3.0.1",
```

**File**: `yarn.lock` (modified, +7/-7)
```diff
@@ -9544,10 +9544,10 @@ js-cookie@^3.0.7:
   resolved "https://registry.yarnpkg.com/js-tokens/-/js-tokens-4.0.0.tgz#19203fb59991df98e3a287050d4647cdeaf32499"
   integrity sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==
 
-js-yaml@^3.13.1, js-yaml@^3.6.1, js-yaml@^4.1.0, js-yaml@^4.1.1, js-yaml@^4.3.0:
-  version "4.3.0"
-  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.0.tgz#d1900572a7f7cf0b5f540c83673e60bad3436592"
-  integrity sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==
+js-yaml@^3.13.1, js-yaml@^3.6.1, js-yaml@^4.1.0, js-yaml@^4.1.1, js-yaml@^4.3.1:
+  version "4.3.1"
+  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.1.tgz#01216c001d67f48e2cd560d708c7af21090a3848"
+  integrity sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==
   dependencies:
     argparse "^2.0.1"
 
@@ -10396,9 +10396,9 @@ nanoid@^3.3.16:
   integrity sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==
 
 nanoid@^5.1.0:
-  version "5.1.6"
-  resolved "https://registry.yarnpkg.com/nanoid/-/nanoid-5.1.6.tgz#30363f664797e7d40429f6c16946d6bd7a3f26c9"
-  integrity sha512-c7+7RQ+dMB5dPwwCp4ee1/iV/q2P6aK1mTZcfr1BTuVlyW9hJYiMPybJCcnBlQtuSmTIWNeazm/zqNoZSSElBg==
+  version "5.1.16"
+  resolved "https://registry.yarnpkg.com/nanoid/-/nanoid-5.1.16.tgz#fe345c0a1f9007c32fbb5c139e1208bfd3f41ef7"
+  integrity sha512-kVrnsrJqMR8+oLJnGEmSWw9BivK5mt7H3FZatVRjrc5wGqFYuBxX1yG7+A7Gi5AefkX6t/oCkizcQgpu0cY1dQ==
 
 nanospinner@^1.2.2:
   version "1.2.2"
```

---

### Incident Patch 14: `2279785e` (2026-08-04)
**Commit Message**: fix(deps): bump next to 16.3.0 to pull patched postcss (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849) (#14904)

fix(deps): bump next to 16.3.0 to pull patched postcss 8.5.23 (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849)

Co-authored-by: Osama Rizk <[REDACTED_EMAIL]>

**File**: `yarn.lock` (modified, +72/-72)
```diff
@@ -3341,50 +3341,50 @@
     "@emnapi/runtime" "^1.4.3"
     "@tybys/wasm-util" "^0.10.0"
 
-"@next/env@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/env/-/env-16.2.11.tgz#9dea1a225a99b1636e5a7166237db1f979b6c532"
-  integrity sha512-0do5A3BJ2gxWr0ZCMcD6BhW+e595jyxdTl3rXTS6lOtD8ektMiW6CO+EPwt1Eca1DBnm90r/7GdiKWBKxH++DA==
-
-"@next/swc-darwin-arm64@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.2.11.tgz#dddeb7795d321321d2b2f01e813b28df22794def"
-  integrity sha512-wryL4pjKmDwGv2ox6+GZDFxvmtSRLqApBR8kL1j4+vhB7Z5vJC/zAnXpiR9Xkfzl0AS8WLMnsuGV/UKI67/rrw==
-
-"@next/swc-darwin-x64@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-16.2.11.tgz#bdf0a4d6b36a3ce72c6c997868e76d3bc02043fb"
-  integrity sha512-aZl2j4f/fLyjQvOhv0Oe9UaMAQHolYpKhctsoYzplSumKJKPUmgjcf6545aBtysLTcu994TREd0+pSgNE4ohmg==
-
-"@next/swc-linux-arm64-gnu@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.2.11.tgz#e194f75343aeaa696dc4946c29407909d759d214"
-  integrity sha512-5jEriyEnH/LWFy27L2ZG0XaLlyEJIjhsImEsiS9P563PKEVp2BVups/xfOucIrsvVntp11oNcZwjHvaDPYVB5g==
-
-"@next/swc-linux-arm64-musl@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.2.11.tgz#1ce77d8d30e854b4ef41fa9e24310e411e1a0f96"
-  integrity sha512-eIjcpx2fnnFSSkZDbTxy74KnokUXDjfoLClpWelfgHLf621aTqswhwXQ7GkD5K5rplrS6LZ/Bj+mVuvzluBOEg==
-
-"@next/swc-linux-x64-gnu@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.2.11.tgz#59324ea909a2654b57675cfd6b5fa43f81e05405"
-  integrity sha512-8WgzpaWMs46qJT9kiV47cje86L0x/Mu9t8/Gwj+pnbgW3rETVfCnaScPjlYUwNScpOozdcIMHWmAvuZJUonR2w==
-
-"@next/swc-linux-x64-musl@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.2.11.tgz#648322d29c955d3ccd78339436f695da5565e366"
-  integrity sha512-I3UgPds7G4ZYnTb/H+5GBGuUT2DhAk6j0mL6A4s63RjFs74wB2hOWP0vaxsK+3NJraExt3eYEPQ/UtT0x/64Nw==
-
-"@next/swc-win32-arm64-msvc@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.2.11.tgz#0c7efca14c2197e8386eb71b6272e237a9a99ac3"
-  integrity sha512-n89CjtcThnjrwgJMAiI5xbqwLY51zvwC9tSlArmVndAJLYVl9T9UAdlkXTmZvE++idoXe8KdglQlhNRdUp1c6g==
-
-"@next/swc-win32-x64-msvc@16.2.11":
-  version "16.2.11"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.2.11.tgz#9dcb67b2b2b7e01b68f337958b6c77a973d3b46b"
-  integrity sha512-md8CLNggS1Dx9pUgApzps5uAf+N8GN9xywzmNx9vHAWo94HtBwCCqkSnhIrdfQe83Dhz8Lfo/20Nb1Zxal092w==
+"@next/env@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/env/-/env-16.3.0.tgz#9a109a0e1367044e082edf0ca265231768314dc7"
+  integrity sha512-o9r1S0BNiNreHP9Vs+Qnqd9kviDkJh8xIACY7UFZSmiGbbQRzPBBosvHzAU4TULHOIuOj/18RSsyz2qrREmIFw==
+
+"@next/swc-darwin-arm64@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.0.tgz#d4f492a29837745e945e306d49d4c1c9181353df"
+  integrity sha512-55hpqq18bEVAlxedlTt3tFqZmKg2nUXT1kn1G/BGEy0R13h3LwtwHPVzzjG6P4LLeOHE32PFDQUVaJEWvBEZBw==
+
+"@next/swc-darwin-x64@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.0.tgz#98534e7cff6b8b5f7bc941fdee72926b00cd68ee"
+  integrity sha512-SOi96kSaF5T+0wW4koiM1bWzSPwjzTesC1p3df+FjdOi5LIQkBK/blxh7HdoKnNuI4PURF1OO7TZqtfnbWDSgw==
+
+"@next/swc-linux-arm64-gnu@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.0.tgz#aa84de7859471415fcfd36e03d01667137e6d9a6"
+  integrity sha512-P0gZAoPMF4dyTRzhmkV4PrqVzSOB6t4mC1oI3c4dqijJ+OVEVx5clIXAKR4/uQpsqw2KKM/0D5tVumcR2r5blg==
+
+"@next/swc-linux-arm64-musl@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.0.tgz#3c7211003c6ac82d06ae6944388132c8811425c7"
+  integrity sha512-tXXGKJw0m37O0eKJARVTX/TheKPhz0QFVtVVZXmOig+9YKLQOSP6hvf2pxv5DO7CLEJyTHx3Pg043CDQkv1G4Q==
+
+"@next/swc-linux-x64-gnu@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.3.0.tgz#e4412d917512729b1faf5c5e31f0ad53a38e2c6a"
+  integrity sha512-pjGxK5EY7yWml78ALejFkWmgHsU7wbFQrISiugpH6FbUJhgEvw3xFZ/EBAtLl7QtL0WdQKiG9eWJ3mOKGTukHw==
+
+"@next/swc-linux-x64-musl@16.3.0":
+  version "16.3.0"
+  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.3.0.tgz#e91531118ad14df129cbf00df7c4ca4a29152e7b"
+  integrity sha512-sjo++Xx+lomlPs3HRsHWhVDyGG6ms1kGW5EtHLERdII8AyG1i+f6aq68xHREO6AEMlhjTNEWBSmfJfqm9orf7g==
+
+"@next/swc-win32-arm64-msvc@16.3.0":
+  version "16.3.0"
+  re
```

---

### Incident Patch 15: `46614015` (2026-08-03)
**Commit Message**: fix(auth): allow prompt=none silent SSO to resume federated sessions (#14897) (#14902)

fix(auth): allow prompt=none silent SSO to resume federated sessions

**File**: `.changeset/fluffy-donkeys-jump.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+'@aws-amplify/auth': patch
+---
+
+fix(auth): allow prompt=none silent SSO to resume federated sessions
+
+`signInWithRedirect` always appended `identity_provider=COGNITO` to the `/oauth2/authorize` request when no `provider` or `idpIdentifier` was supplied. Cognito treats `identity_provider` as a provider selector, so pinning it to `COGNITO` while requesting a silent sign in with `options.prompt: 'NONE'` restricted the attempt to native Cognito sessions. Users whose live hosted UI session originated from a federated IdP (for example Google or a SAML provider) were rejected with `error=login_required` instead of having their session resumed.
+
+`identity_provider` is now omitted only when `prompt` is `'NONE'` and neither `provider` nor `idpIdentifier` is specified, which lets Cognito resume whichever session is already active. All other behavior is unchanged: an explicit `provider` still sends `identity_provider`, an `idpIdentifier` still sends `idp_identifier`, and the interactive no-argument call still defaults to `identity_provider=COGNITO`.
+
+Fixes https://github.com/aws-amplify/amplify-js/issues/14897
```

**File**: `packages/auth/__tests__/providers/cognito/signInWithRedirect.test.ts` (modified, +37/-0)
```diff
@@ -203,6 +203,43 @@ describe('signInWithRedirect', () => {
 		);
 	});
 
+	it('omits identity_provider when prompt is NONE and no provider is specified', async () => {
+		await signInWithRedirect({ options: { prompt: 'NONE' } });
+		const [oauthUrl] = mockOpenAuthSession.mock.calls[0];
+		expect(oauthUrl).not.toContain('identity_provider');
+		expect(oauthUrl).toStrictEqual(
+			`https://oauth.domain.com/oauth2/authorize?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F&response_type=code&client_id=userPoolClientId&scope=phone+email+openid+profile+aws.cognito.signin.user.admin&prompt=none&state=oauth_state&code_challenge=code_challenge&code_challenge_method=S256`,
+		);
+	});
+
+	it('keeps identity_provider when prompt is NONE and a provider is specified', async () => {
+		await signInWithRedirect({
+			provider: 'Google',
+			options: { prompt: 'NONE' },
+		});
+		const [oauthUrl] = mockOpenAuthSession.mock.calls[0];
+		expect(oauthUrl).toContain('identity_provider=Google');
+	});
+
+	it('keeps idp_identifier only when prompt is NONE and an idpIdentifier is specified', async () => {
+		await signInWithRedirect({
+			provider: { idpIdentifier: 'example.com' },
+			options: { prompt: 'NONE' },
+		});
+		const [oauthUrl] = mockOpenAuthSession.mock.calls[0];
+		expect(oauthUrl).toContain('idp_identifier=example.com');
+		expect(oauthUrl).not.toContain('identity_provider');
+	});
+
+	it('keeps the default identity_provider for prompt values other than NONE', async () => {
+		for (const prompt of promptTypes.filter(value => value !== 'NONE')) {
+			await signInWithRedirect({ options: { prompt } });
+			const [oauthUrl] = mockOpenAuthSession.mock.calls[0];
+			expect(oauthUrl).toContain('identity_provider=COGNITO');
+			mockOpenAuthSession.mockClear();
+		}
+	});
+
 	it('uses custom state if specified', async () => {
 		const expectedCustomState = 'verify_me';
 		await signInWithRedirect({ customState: expectedCustomState });
```

**File**: `packages/auth/src/providers/cognito/apis/signInWithRedirect.ts` (modified, +10/-3)
```diff
@@ -50,7 +50,7 @@ export async function signInWithRedirect(
 		await assertUserNotAuthenticated();
 	}
 
-	let provider = 'COGNITO'; // Default
+	let provider: string | undefined = 'COGNITO'; // Default
 	let idpIdentifier: string | undefined;
 
 	if (typeof input?.provider === 'string') {
@@ -59,6 +59,13 @@ export async function signInWithRedirect(
 		provider = input.provider.custom;
 	} else if (input?.provider?.idpIdentifier) {
 		({ idpIdentifier } = input.provider);
+	} else if (input?.options?.prompt === 'NONE') {
+		// `identity_provider` acts as a provider selector, so pinning it to the
+		// default `COGNITO` would restrict a silent `prompt=none` attempt to
+		// native Cognito sessions and fail with `login_required` for users whose
+		// existing session came from a federated IdP. Omitting it lets Cognito
+		// resume whichever session is already active.
+		provider = undefined;
 	}
 
 	return oauthSignIn({
@@ -89,7 +96,7 @@ const oauthSignIn = async ({
 	authSessionOpener,
 }: {
 	oauthConfig: OAuthConfig;
-	provider: string;
+	provider?: string;
 	idpIdentifier?: string;
 	clientId: string;
 	customState?: string;
@@ -127,7 +134,7 @@ const oauthSignIn = async ({
 	// Add either identity_provider or idp_identifier, but not both
 	if (idpIdentifier) {
 		params.append('idp_identifier', idpIdentifier);
-	} else {
+	} else if (provider) {
 		params.append('identity_provider', provider);
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #14970** (closed): fix(api-rest): feature-detect URL.canParse in resolveApiUrl (@ahmedhamouda78)
- **PR #14969** (2026-10-01): fix(api-rest): require REST request URLs to resolve to the configured endpoint origin (v5) (@osama-rizk)
- **PR #14968** (2026-10-01): fix(api-rest): require REST request URLs to resolve to the configured endpoint origin (@osama-rizk)
- **PR #14963** (2026-09-28): Version Packages (main) (@github-actions[bot])
- **PR #14962** (2026-09-25): fix(core): honor custom Auth providers when the resource config has no Auth block (@bobbor)
- **PR #14959** (closed): fix(datastore): prevent stop() from hanging while sync queries are in progress (@nghiatranhnl)
- **PR #14956** (2026-09-25): fix(core): externalize tslib to fix SSR module resolution (@soberm)
- **PR #14954** (2026-09-18): feat(events): observe subscription readiness via channel.subscribe().ready (@soberm)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
