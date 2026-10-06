# Forensic Learning Record (Deep Inspection): corsairdev/corsair

> **Canonical Artifact**: `07_PROJECT_LEARNING/corsairdev-corsair-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/corsairdev/corsair](https://github.com/corsairdev/corsair))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:00:47.839Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `corsairdev/corsair`
- **Description**: Connect your users to their apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13407 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/minimal/webhooks.ts`
```
import { processWebhook } from 'corsair';
import express from 'express';
import { corsair } from './corsair';

const app = express();
app.use(express.json());

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

app.get('/webhooks', (req, res) => {
	const mode = req.query['hub.mode'];
	const verifyToken = req.query['hub.verify_token'];
	const challenge = req.query['hub.challenge'];

	if (typeof META_VERIFY_TOKEN !== 'string' || META_VERIFY_TOKEN.length === 0) {
		return res.status(503).send('Webhook verification is not configured');
	}

	if (
		mode === 'subscribe' &&
		typeof verifyToken === 'string' &&
		verifyToken === META_VERIFY_TOKEN &&
		typeof challenge === 'string'
	) {
		return res.status(200).send(challenge);
	}

	return res.status(403).send('Forbidden');
});

// Single webhook endpoint for ALL integrations
// Corsair automatically routes to the right plugin
app.post('/webhooks', async (req, res) => {
	// Extract tenant ID from query params (optional)
	const tenantId = req.query.tenantId as string | undefined;

	// Process the webhook - one function handles everything!
	// The list of plugins in createCorsair will subscribe to these webhooks
	const result = await processWebhook(corsair, req.headers, req.body, {
		tenantId,
	});

	// Return the response (or 200 OK if no response needed)
	if (result.response) {
		return res.json(result.response);
	}
});

```

### Core Architecture Module: `demo/sdk/github/core/ApiError.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiRequestOptions } from './ApiRequestOptions';
import type { ApiResult } from './ApiResult';

export class ApiError extends Error {
	public readonly url: string;
	public readonly status: number;
	public readonly statusText: string;
	public readonly body: any;
	public readonly request: ApiRequestOptions;

	constructor(
		request: ApiRequestOptions,
		response: ApiResult,
		message: string,
	) {
		super(message);

		this.name = 'ApiError';
		this.url = response.url;
		this.status = response.status;
		this.statusText = response.statusText;
		this.body = response.body;
		this.request = request;
	}
}

```

### Core Architecture Module: `demo/sdk/github/core/ApiRequestOptions.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ApiRequestOptions = {
	readonly method:
		| 'GET'
		| 'PUT'
		| 'POST'
		| 'DELETE'
		| 'OPTIONS'
		| 'HEAD'
		| 'PATCH';
	readonly url: string;
	readonly path?: Record<string, any>;
	readonly cookies?: Record<string, any>;
	readonly headers?: Record<string, any>;
	readonly query?: Record<string, any>;
	readonly formData?: Record<string, any>;
	readonly body?: any;
	readonly mediaType?: string;
	readonly responseHeader?: string;
	readonly errors?: Record<number, string>;
};

```

### Core Architecture Module: `demo/sdk/github/core/ApiResult.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ApiResult = {
	readonly url: string;
	readonly ok: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly body: any;
};

```

### Core Architecture Module: `demo/sdk/github/core/CancelablePromise.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export class CancelError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CancelError';
	}

	public get isCancelled(): boolean {
		return true;
	}
}

export interface OnCancel {
	readonly isResolved: boolean;
	readonly isRejected: boolean;
	readonly isCancelled: boolean;

	(cancelHandler: () => void): void;
}

export class CancelablePromise<T> implements Promise<T> {
	#isResolved: boolean;
	#isRejected: boolean;
	#isCancelled: boolean;
	readonly #cancelHandlers: (() => void)[];
	readonly #promise: Promise<T>;
	#resolve?: (value: T | PromiseLike<T>) => void;
	#reject?: (reason?: any) => void;

	constructor(
		executor: (
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
			onCancel: OnCancel,
		) => void,
	) {
		this.#isResolved = false;
		this.#isRejected = false;
		this.#isCancelled = false;
		this.#cancelHandlers = [];
		this.#promise = new Promise<T>((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;

			const onResolve = (value: T | PromiseLike<T>): void => {
				if (this.#isResolved || this.#isRejected || this.#isCancelled) {
					return;
				}
				this.#isResolved = true;
				if (this.#resolve) this.#resolve(value);
			};

			const onReject = (reason?: any): void => {
				if (this.#isResolved || this.#isRejected || this.#isCancelled) {
					return;
				}
				this.#isRejected = true;
				if (this.#reject) this.#reject(reason);
			};

			const onCancel = (cancelHandler: () => void): void => {
				if (this.#isResolved || this.#isRejected || this.#isCancelled) {
					return;
				}
				this.#cancelHandlers.push(cancelHandler);
			};

			Object.defineProperty(onCancel, 'isResolved', {
				get: (): boolean => this.#isResolved,
			});

			Object.defineProperty(onCancel, 'isRejected', {
				get: (): boolean => this.#isRejected,
			});

			Object.defineProperty(onCancel, 'isCancelled', {
				get: (): boolean => this.#isCancelled,
			});

			return executor(onResolve, onReject, onCancel as OnCancel);
		});
	}

	get [Symbol.toStringTag]() {
		return 'Cancellable Promise';
	}

	public then<TResult1 = T, TResult2 = never>(
		onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
		onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return this.#promise.then(onFulfilled, onRejected);
	}

	public catch<TResult = never>(
		onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
	): Promise<T | TResult> {
		return this.#promise.catch(onRejected);
	}

	public finally(onFinally?: (() => void) | null): Promise<T> {
		return this.#promise.finally(onFinally);
	}

	public cancel(): void {
		if (this.#isResolved || this.#isRejected || this.#isCancelled) {
			return;
		}
		this.#isCancelled = true;
		if (this.#cancelHandlers.length) {
			try {
				for (const cancelHandler of this.#cancelHandlers) {
					cancelHandler();
				}
			} catch (error) {
				console.warn('Cancellation threw an error', error);
				return;
			}
		}
		this.#cancelHandlers.length = 0;
		if (this.#reject) this.#reject(new CancelError('Request aborted'));
	}

	public get isCancelled(): boolean {
		return this.#isCancelled;
	}
}

```

### Core Architecture Module: `demo/sdk/github/core/OpenAPI.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiRequestOptions } from './ApiRequestOptions';

type Resolver<T> = (options: ApiRequestOptions) => Promise<T>;
type Headers = Record<string, string>;

export type OpenAPIConfig = {
	BASE: string;
	VERSION: string;
	WITH_CREDENTIALS: boolean;
	CREDENTIALS: 'include' | 'omit' | 'same-origin';
	TOKEN?: string | Resolver<string> | undefined;
	USERNAME?: string | Resolver<string> | undefined;
	PASSWORD?: string | Resolver<string> | undefined;
	HEADERS?: Headers | Resolver<Headers> | undefined;
	ENCODE_PATH?: ((path: string) => string) | undefined;
};

export const OpenAPI: OpenAPIConfig = {
	BASE: 'https://api.github.com',
	VERSION: '1.1.4',
	WITH_CREDENTIALS: false,
	CREDENTIALS: 'include',
	TOKEN: undefined,
	USERNAME: undefined,
	PASSWORD: undefined,
	HEADERS: undefined,
	ENCODE_PATH: undefined,
};

```

### Core Architecture Module: `demo/sdk/github/core/request.ts`
```
/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import { ApiError } from './ApiError';
import type { ApiRequestOptions } from './ApiRequestOptions';
import type { ApiResult } from './ApiResult';
import type { OnCancel } from './CancelablePromise';
import { CancelablePromise } from './CancelablePromise';
import type { OpenAPIConfig } from './OpenAPI';

export const isDefined = <T>(
	value: T | null | undefined,
): value is Exclude<T, null | undefined> => {
	return value !== undefined && value !== null;
};

export const isString = (value: any): value is string => {
	return typeof value === 'string';
};

export const isStringWithValue = (value: any): value is string => {
	return isString(value) && value !== '';
};

export const isBlob = (value: any): value is Blob => {
	return (
		typeof value === 'object' &&
		typeof value.type === 'string' &&
		typeof value.stream === 'function' &&
		typeof value.arrayBuffer === 'function' &&
		typeof value.constructor === 'function' &&
		typeof value.constructor.name === 'string' &&
		/^(Blob|File)$/.test(value.constructor.name) &&
		/^(Blob|File)$/.test(value[Symbol.toStringTag])
	);
};

export const isFormData = (value: any): value is FormData => {
	return value instanceof FormData;
};

export const base64 = (str: string): string => {
	try {
		return btoa(str);
	} catch (err) {
		// @ts-expect-error
		return Buffer.from(str).toString('base64');
	}
};

export const getQueryString = (params: Record<string, any>): string => {
	const qs: string[] = [];

	const append = (key: string, value: any) => {
		qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
	};

	const process = (key: string, value: any) => {
		if (isDefined(value)) {
			if (Array.isArray(value)) {
				value.forEach((v) => {
					process(key, v);
				});
			} else if (typeof value === 'object') {
				Object.entries(value).forEach(([k, v]) => {
					process(`${key}[${k}]`, v);
				});
			} else {
				append(key, value);
			}
		}
	};

	Object.entries(params).forEach(([key, value]) => {
		process(key, value);
	});

	if (qs.length > 0) {
		return `?${qs.join('&')}`;
	}

	return '';
};

const getUrl = (config: OpenAPIConfig, options: ApiRequestOptions): string => {
	const encoder = config.ENCODE_PATH || encodeURI;

	const path = options.url
		.replace('{api-version}', config.VERSION)
		.replace(/{(.*?)}/g, (substring: string, group: string) => {
			if (options.path?.hasOwnProperty(group)) {
				return encoder(String(options.path[group]));
			}
			return substring;
		});

	const url = `${config.BASE}${path}`;
	if (options.query) {
		return `${url}${getQueryString(options.query)}`;
	}
	return url;
};

export const getFormData = (
	options: ApiRequestOptions,
): FormData | undefined => {
	if (options.formData) {
		const formData = new FormData();

		const process = (key: string, value: any) => {
			if (isString(value) || isBlob(value)) {
				formData.append(key, value);
			} else {
				formData.append(key, JSON.stringify(value));
			}
		};

		Object.entries(options.formData)
			.filter(([_, value]) => isDefined(value))
			.forEach(([key, value]) => {
				if (Array.isArray(value)) {
					value.forEach((v) => process(key, v));
				} else {
					process(key, value);
				}
			});

		return formData;
	}
	return undefined;
};

type Resolver<T> = (options: ApiRequestOptions) => Promise<T>;

export const resolve = async <T>(
	options: ApiRequestOptions,
	resolver?: T | Resolver<T>,
): Promise<T | undefined> => {
	if (typeof resolver === 'function') {
		return (resolver as Resolver<T>)(options);
	}
	return resolver;
};

export const getHeaders = async (
	config: OpenAPIConfig,
	options: ApiRequestOptions,
): Promise<Headers> => {
	const [token, username, password, additionalHeaders] = await Promise.all([
		resolve(options, config.TOKEN),
		resolve(options, config.USERNAME),
		resolve(options, config.PASSWORD),
		resolve(options, config.HEADERS),
	]);

	const headers = Object.entries({
		Accept: 'application/json',
		...additionalHeaders,
		...options.headers,
	})
		.filter(([_, value]) => isDefined(value))
		.reduce(
			(headers, [key, value]) => ({
				...headers,
				[key]: String(value),
			}),
			{} as Record<string, string>,
		);

	if (isStringWithValue(token)) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	if (isStringWithValue(username) && isStringWithValue(password)) {
		const credentials = base64(`${username}:${password}`);
		headers['Authorization'] = `Basic ${credentials}`;
	}

	if (options.body !== undefined) {
		if (options.mediaType) {
			headers['Content-Type'] = options.mediaType;
		} else if (isBlob(options.body)) {
			headers['Content-Type'] = options.body.type || 'application/octet-stream';
		} else if (isString(options.body)) {
			headers['Content-Type'] = 'text/plain';
		} else if (!isFormData(options.body)) {
			headers['Content-Type'] = 'application/json';
		}
	}

	return new Headers(headers);
};

export const getRequestBody = (options: ApiRequestOptions): any => {
	if (options.body !== undefined) {
		if (options.mediaType?.includes('/json')) {
			return JSON.stringify(options.body);
		} else if (
			isString(options.body) ||
			isBlob(options.body) ||
			isFormData(options.body)
		) {
			return options.body;
		} else {
			return JSON.stringify(options.body);
		}
	}
	return undefined;
};

export const sendRequest = async (
	config: OpenAPIConfig,
	options: ApiRequestOptions,
	url: string,
	body: any,
	formData: FormData | undefined,
	headers: Headers,
	onCancel: OnCancel,
): Promise<Response> => {
	const controller = new AbortController();

	const request: RequestInit = {
		headers,
		body: body ?? formData,
		method: options.method,
		signal: controller.signal,
	};

	if (config.WITH_CREDENTIALS) {
		request.credentials = config.CREDENTIALS;
	}

	onCancel(() => controller.abort());

	return await fetch(url, request);
};

export const getResponseHeader = (
	response: Response,
	responseHeader?: string,
): string | undefined => {
	if (responseHeader) {
		const content = response.headers.get(responseHeader);
		if (isString(content)) {
			return content;
		}
	}
	return undefined;
};

export const getResponseBody = async (response: Response): Promise<any> => {
	if (response.status !== 204) {
		try {
			const contentType = response.headers.get('Content-Type');
			if (contentType) {
				const jsonTypes = ['application/json', 'application/problem+json'];
				const isJSON = jsonTypes.some((type) =>
					contentType.toLowerCase().startsWith(type),
				);
				if (isJSON) {
					return await response.json();
				} else {
					return await response.text();
				}
			}
		} catch (error) {
			console.error(error);
		}
	}
	return undefined;
};

export const catchErrorCodes = (
	options: ApiRequestOptions,
	result: ApiResult,
): void => {
	const errors: Record<number, string> = {
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		500: 'Internal Server Error',
		502: 'Bad Gateway',
		503: 'Service Unavailable',
		...options.errors,
	};

	const error = errors[result.status];
	if (error) {
		throw new ApiError(options, result, error);
	}

	if (!result.ok) {
		const errorStatus = result.status ?? 'unknown';
		const errorStatusText = result.statusText ?? 'unknown';
		const errorBody = (() => {
			try {
				return JSON.stringify(result.body, null, 2);
			} catch (e) {
				return undefined;
			}
		})();

		throw new ApiError(
			options,
			result,
			`Generic Error: status: ${errorStatus}; status text: ${errorStatusText}; body: ${errorBody}`,
		);
	}
};

/**
 * Request method
 * @param config The OpenAPI configuration object
 * @param options The request options from the service
 * @returns CancelablePromise<T>
 * @throws ApiError
 */
export const request = <T>(
	config: OpenAPIConfig,
	options: ApiRequestOptions,
): CancelablePromise<T> => {
	return new CancelablePromise(async (resolve, reject, onCancel) => {
		try {
			const url = getUrl(config, options);
			const formData = getFormData(options);
			const body = getRequestBody(options);
			const headers = await getHeaders(config, options);

			if (!onCancel.isCancelled) {
				const response = await sendRequest(
					config,
					options,
					url,
					body,
					formData,
					headers,
					onCancel,
				);
				const responseBody = await getResponseBody(response);
				const responseHeader = getResponseHeader(
					response,
					options.responseHeader,
				);

				const result: ApiResult = {
					url,
					ok: response.ok,
					status: response.status,
					statusText: response.statusText,
					body: responseHeader ?? responseBody,
				};

				catchErrorCodes(options, result);

				resolve(result.body);
			}
		} catch (error) {
			reject(error);
		}
	});
};

```

### Core Architecture Module: `demo/sdk/github/webhook-handler.ts`
```
import * as crypto from 'crypto';
import type {
	CommitCommentEvent,
	DeploymentEvent,
	PullRequestEvent,
	PushEvent,
	StarEvent,
	TeamAddEvent,
	WatchEvent,
} from './webhooks';

export type WebhookEventName =
	| 'commit_comment'
	| 'deployment'
	| 'pull_request'
	| 'push'
	| 'star'
	| 'team_add'
	| 'watch';

export interface WebhookEventMap {
	commit_comment: CommitCommentEvent;
	deployment: DeploymentEvent;
	pull_request: PullRequestEvent;
	push: PushEvent;
	star: StarEvent;
	team_add: TeamAddEvent;
	watch: WatchEvent;
}

export type WebhookEventHandler<T extends WebhookEventName> = (
	event: WebhookEventMap[T],
) => void | Promise<void>;

export interface WebhookHeaders {
	'x-github-event'?: string;
	'x-hub-signature-256'?: string;
	'x-github-delivery'?: string;
	[key: string]: string | undefined;
}

export interface GithubWebhookHandlerOptions {
	secret?: string;
}

export interface HandleWebhookResult {
	success: boolean;
	eventType?: WebhookEventName;
	error?: string;
}

export class GithubWebhookHandler {
	private secret?: string;
	private handlers: Map<
		WebhookEventName,
		WebhookEventHandler<WebhookEventName>[]
	> = new Map();

	constructor(options: GithubWebhookHandlerOptions = {}) {
		this.secret = options.secret;
	}

	on<T extends WebhookEventName>(
		eventName: T,
		handler: WebhookEventHandler<T>,
	): this {
		const existingHandlers = this.handlers.get(eventName) || [];
		existingHandlers.push(handler as WebhookEventHandler<WebhookEventName>);
		this.handlers.set(eventName, existingHandlers);
		return this;
	}

	off<T extends WebhookEventName>(
		eventName: T,
		handler: WebhookEventHandler<T>,
	): this {
		const existingHandlers = this.handlers.get(eventName) || [];
		const index = existingHandlers.indexOf(
			handler as WebhookEventHandler<WebhookEventName>,
		);
		if (index !== -1) {
			existingHandlers.splice(index, 1);
			this.handlers.set(eventName, existingHandlers);
		}
		return this;
	}

	verifySignature(payload: string | Buffer, signature: string): boolean {
		if (!this.secret) {
			return true;
		}

		if (!signature) {
			return false;
		}

		const expectedSignature =
			'sha256=' +
			crypto.createHmac('sha256', this.secret).update(payload).digest('hex');

		try {
			return crypto.timingSafeEqual(
				Buffer.from(signature),
				Buffer.from(expectedSignature),
			);
		} catch {
			return false;
		}
	}

	async handleWebhook(
		headers: WebhookHeaders,
		payload: string | object,
	): Promise<HandleWebhookResult> {
		const eventName = headers['x-github-event'] as WebhookEventName | undefined;
		const signature = headers['x-hub-signature-256'];

		if (!eventName) {
			return {
				success: false,
				error: 'Missing x-github-event header',
			};
		}

		const payloadString =
			typeof payload === 'string' ? payload : JSON.stringify(payload);

		if (this.secret && signature) {
			const isValid = this.verifySignature(payloadString, signature);
			if (!isValid) {
				return {
					success: false,
					eventType: eventName,
					error: 'Invalid signature',
				};
			}
		} else if (this.secret && !signature) {
			return {
				success: false,
				eventType: eventName,
				error: 'Missing signature header',
			};
		}

		const parsedPayload =
			typeof payload === 'string' ? JSON.parse(payload) : payload;

		const handlers = this.handlers.get(eventName) || [];

		try {
			for (const handler of handlers) {
				await handler(parsedPayload);
			}

			return {
				success: true,
				eventType: eventName,
			};
		} catch (error) {
			return {
				success: false,
				eventType: eventName,
				error:
					error instanceof Error ? error.message : 'Handler execution failed',
			};
		}
	}

	getRegisteredEvents(): WebhookEventName[] {
		return Array.from(this.handlers.keys());
	}

	hasHandlers(eventName: WebhookEventName): boolean {
		const handlers = this.handlers.get(eventName);
		return !!handlers && handlers.length > 0;
	}

	clearHandlers(eventName?: WebhookEventName): this {
		if (eventName) {
			this.handlers.delete(eventName);
		} else {
			this.handlers.clear();
		}
		return this;
	}
}

export function createWebhookHandler(
	options?: GithubWebhookHandlerOptions,
): GithubWebhookHandler {
	return new GithubWebhookHandler(options);
}

```

### Core Architecture Module: `demo/sdk/github/webhooks.ts`
```
export type AuthorAssociation =
	| 'COLLABORATOR'
	| 'CONTRIBUTOR'
	| 'FIRST_TIMER'
	| 'FIRST_TIME_CONTRIBUTOR'
	| 'MANNEQUIN'
	| 'MEMBER'
	| 'NONE'
	| 'OWNER';

export interface InstallationLite {
	id: number;
	node_id: string;
}

export interface Organization {
	login: string;
	id: number;
	node_id: string;
	url: string;
	html_url?: string;
	repos_url: string;
	events_url: string;
	hooks_url: string;
	issues_url: string;
	members_url: string;
	public_members_url: string;
	avatar_url: string;
	description: string | null;
}

export interface User {
	login: string;
	id: number;
	node_id: string;
	name?: string;
	email?: string | null;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: 'Bot' | 'User' | 'Organization';
	site_admin: boolean;
}

export interface License {
	key: string;
	name: string;
	spdx_id: string;
	url: string | null;
	node_id: string;
}

export interface Repository {
	id: number;
	node_id: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: User;
	html_url: string;
	description: string | null;
	fork: boolean;
	url: string;
	forks_url: string;
	keys_url: string;
	collaborators_url: string;
	teams_url: string;
	hooks_url: string;
	issue_events_url: string;
	events_url: string;
	assignees_url: string;
	branches_url: string;
	tags_url: string;
	blobs_url: string;
	git_tags_url: string;
	git_refs_url: string;
	trees_url: string;
	statuses_url: string;
	languages_url: string;
	stargazers_url: string;
	contributors_url: string;
	subscribers_url: string;
	subscription_url: string;
	commits_url: string;
	git_commits_url: string;
	comments_url: string;
	issue_comment_url: string;
	contents_url: string;
	compare_url: string;
	merges_url: string;
	archive_url: string;
	downloads_url: string;
	issues_url: string;
	pulls_url: string;
	milestones_url: string;
	notifications_url: string;
	labels_url: string;
	releases_url: string;
	deployments_url: string;
	created_at: number | string;
	updated_at: string;
	pushed_at: number | string | null;
	git_url: string;
	ssh_url: string;
	clone_url: string;
	svn_url: string;
	homepage: string | null;
	size: number;
	stargazers_count: number;
	watchers_count: number;
	language: string | null;
	has_issues: boolean;
	has_projects: boolean;
	has_downloads: boolean;
	has_wiki: boolean;
	has_pages: boolean;
	has_discussions?: boolean;
	forks_count: number;
	mirror_url: string | null;
	archived: boolean;
	disabled?: boolean;
	open_issues_count: number;
	license: License | null;
	forks: number;
	open_issues: number;
	watchers: number;
	stargazers?: number;
	default_branch: string;
	allow_squash_merge?: boolean;
	allow_merge_commit?: boolean;
	allow_rebase_merge?: boolean;
	allow_auto_merge?: boolean;
	allow_forking?: boolean;
	allow_update_branch?: boolean;
	use_squash_pr_title_as_default?: boolean;
	squash_merge_commit_message?: string;
	squash_merge_commit_title?: string;
	merge_commit_message?: string;
	merge_commit_title?: string;
	is_template: boolean;
	web_commit_signoff_required: boolean;
	topics: string[];
	visibility: 'public' | 'private' | 'internal';
	delete_branch_on_merge?: boolean;
	master_branch?: string;
	permissions?: {
		pull: boolean;
		push: boolean;
		admin: boolean;
		maintain?: boolean;
		triage?: boolean;
	};
	public?: boolean;
	organization?: string;
	custom_properties: {
		[k: string]: null | string | string[];
	};
}

export interface Team {
	name: string;
	id: number;
	node_id: string;
	slug: string;
	description: string | null;
	privacy: 'open' | 'closed' | 'secret';
	url: string;
	html_url: string;
	members_url: string;
	repositories_url: string;
	permission: string;
	parent?: {
		name: string;
		id: number;
		node_id: string;
		slug: string;
		description: string | null;
		privacy: 'open' | 'closed' | 'secret';
		url: string;
		html_url: string;
		members_url: string;
		repositories_url: string;
		permission: string;
		notification_setting?: 'notifications_enabled' | 'notifications_disabled';
	} | null;
	notification_setting?: 'notifications_enabled' | 'notifications_disabled';
}

export interface Label {
	id: number;
	node_id: string;
	url: string;
	name: string;
	description: string | null;
	color: string;
	default: boolean;
}

export interface Milestone {
	url: string;
	html_url: string;
	labels_url: string;
	id: number;
	node_id: string;
	number: number;
	title: string;
	description: string | null;
	creator: User;
	open_issues: number;
	closed_issues: number;
	state: 'open' | 'closed';
	created_at: string;
	updated_at: string;
	due_on: string | null;
	closed_at: string | null;
}

export interface Link {
	href: string;
}

export interface PullRequestAutoMerge {
	enabled_by: User | null;
	merge_method: 'merge' | 'squash' | 'rebase';
	commit_title: string | null;
	commit_message: string | null;
}

export interface Committer {
	name: string;
	email: string | null;
	date?: string;
	username?: string;
}

export interface App {
	id: number;
	slug?: string;
	node_id: string;
	owner: User;
	name: string;
	description: string | null;
	external_url: string;
	html_url: string;
	created_at: string;
	updated_at: string;
	permissions?: {
		actions?: 'read' | 'write';
		administration?: 'read' | 'write';
		checks?: 'read' | 'write';
		contents?: 'read' | 'write';
		deployments?: 'read' | 'write';
		issues?: 'read' | 'write';
		members?: 'read' | 'write';
		metadata?: 'read' | 'write';
		packages?: 'read' | 'write';
		pages?: 'read' | 'write';
		pull_requests?: 'read' | 'write';
		statuses?: 'read' | 'write';
		[k: string]: 'read' | 'write' | undefined;
	};
	events?: string[];
}

export interface Workflow {
	badge_url: string;
	created_at: string;
	html_url: string;
	id: number;
	name: string;
	node_id: string;
	path: string;
	state: string;
	updated_at: string;
	url: string;
}

export interface Deployment {
	url: string;
	id: number;
	node_id: string;
	sha: string;
	ref: string;
	task: string;
	payload: {
		[k: string]: unknown;
	};
	original_environment: string;
	environment: string;
	transient_environment?: boolean;
	production_environment?: boolean;
	description: string | null;
	creator: User;
	created_at: string;
	updated_at: string;
	statuses_url: string;
	repository_url: string;
	performed_via_github_app?: App | null;
}

export interface PullRequest {
	url: string;
	id: number;
	node_id: string;
	html_url: string;
	diff_url: string;
	patch_url: string;
	issue_url: string;
	number: number;
	state: 'open' | 'closed';
	locked: boolean;
	title: string;
	user: User;
	body: string | null;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	merged_at: string | null;
	merge_commit_sha: string | null;
	assignee: User | null;
	assignees: User[];
	requested_reviewers: (User | Team)[];
	requested_teams: Team[];
	labels: Label[];
	milestone: Milestone | null;
	commits_url: string;
	review_comments_url: string;
	review_comment_url: string;
	comments_url: string;
	statuses_url: string;
	head: {
		label: string;
		ref: string;
		sha: string;
		user: User;
		repo: Repository | null;
	};
	base: {
		label: string;
		ref: string;
		sha: string;
		user: User;
		repo: Repository;
	};
	_links: {
		self: Link;
		html: Link;
		issue: Link;
		comments: Link;
		review_comments: Link;
		review_comment: Link;
		commits: Link;
		statuses: Link;
	};
	author_association: AuthorAssociation;
	auto_merge: PullRequestAutoMerge | null;
	active_lock_reason: 'resolved' | 'off-topic' | 'too heated' | 'spam' | null;
	draft: boolean;
	merged: boolean | null;
	mergeable: boolean | null;
	rebaseable: boolean | null;
	mergeable_state: string;
	merged_by: User | null;
	comments: number;
	review_comments: number;
	maintainer_can_modify: boolean;
	commits: number;
	additions: number;
	deletions: number;
	changed_files: number;
}

export interface Commit {
	id: string;
	tree_id: string;
	distinct: boolean;
	message: string;
	timestamp: string;
	url: string;
	author: Committer;
	committer: Committer;
	added: string[];
	modified: string[];
	removed: string[];
}

export interface CommitCommentCreatedEvent {
	action: 'created';
	comment: {
		url: string;
		html_url: string;
		id: number;
		node_id: string;
		user: User;
		position: number | null;
		line: number | null;
		path: string | null;
		commit_id: string;
		created_at: string;
		updated_at: string;
		author_association: AuthorAssociation;
		body: string;
	};
	repository: Repository;
	sender: User;
	installation?: InstallationLite;
	organization?: Organization;
}

export type CommitCommentEvent = CommitCommentCreatedEvent;

export interface DeploymentCreatedEvent {
	action: 'created';
	deployment: Deployment;
	workflow: Workflow | null;
	workflow_run: {
		id: number;
		name: string;
		path?: string;
		display_title?: string;
		node_id: string;
		head_branch: string;
		head_sha: string;
		run_number: number;
		event: string;
		status: 'requested' | 'in_progress' | 'completed' | 'queued';
		conclusion:
			| 'success'
			| 'failure'
			| 'neutral'
			| 'cancelled'
			| 'timed_out'
			| 'action_required'
			| 'stale'
			| null;
		workflow_id: number;
		check_suite_id: number;
		check_suite_node_id: string;
		url: string;
		html_url: string;
		pull_requests: {
			url: string;
			id: number;
			number: number;
			head: {
				ref: string;
				sha: string;
				repo: {
					id: number;
					url: string;
					name: string;
				};
			};
			base: {
				ref: string;
				sha: string;
				repo: {
					id: number;
					url: string;
					name: string;
				};
			};
		}[];
		created_at: string;
		updated_at: string;
		actor: User;
		triggering_actor: User;
		run_attempt: number;
		run_started_at: string;
		referenced_workflows?: {
			path: string;
			sha: string;
			ref?: string;
		}[];
	} | null;
	repository: Repository;
	sender: User;
	installation?: InstallationLite;
	organization?: Or
```

### Core Architecture Module: `demo/sdk/gmail/core/ApiError.ts`
```
import type { ApiRequestOptions } from './ApiRequestOptions';
import type { ApiResult } from './ApiResult';

export class ApiError extends Error {
	public readonly url: string;
	public readonly status: number;
	public readonly statusText: string;
	public readonly body: any;
	public readonly request: ApiRequestOptions;

	constructor(
		request: ApiRequestOptions,
		response: ApiResult,
		message: string,
	) {
		super(message);

		this.name = 'ApiError';
		this.url = response.url;
		this.status = response.status;
		this.statusText = response.statusText;
		this.body = response.body;
		this.request = request;
	}
}

```

### Core Architecture Module: `demo/sdk/gmail/core/ApiRequestOptions.ts`
```
export type ApiRequestOptions = {
	readonly method:
		| 'GET'
		| 'PUT'
		| 'POST'
		| 'DELETE'
		| 'OPTIONS'
		| 'HEAD'
		| 'PATCH';
	readonly url: string;
	readonly path?: Record<string, any>;
	readonly cookies?: Record<string, any>;
	readonly headers?: Record<string, any>;
	readonly query?: Record<string, any>;
	readonly formData?: Record<string, any>;
	readonly body?: any;
	readonly mediaType?: string;
	readonly responseHeader?: string;
	readonly errors?: Record<number, string>;
};

```

### Core Architecture Module: `demo/sdk/gmail/core/ApiResult.ts`
```
export type ApiResult = {
	readonly url: string;
	readonly ok: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly body: any;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1815** (2026-10-04): **Mailtrap sends Bearer with an empty token when the API key is missing**
  *Symptoms*: Mailtrap does the same thing when the token is not stored.  `keyBuilder` in `packages/mailtrap/index.ts` (line 679) returns `''` when `get_api_key()` is null. `bind.ts` does not treat `''` as missing auth.  `mailtrapCall` in `packages/mailtrap/endpoints/shared.ts` line 63 passes `ctx.key` to `makeMailtrapRequest`. In `packages/mailtrap/client.ts` line 104 the header is `Authorization: Bearer ${personalAccessToken}`, and there is no empty check. A missing token is sent as `Bearer `. Account discovery uses the same token.  Please throw `AuthMissingError` when the token is missing, and add a unit test for the empty keystore case.
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to work on this issue. Could you please assign it to me?
  > @valdovinusjr-code Assigned
  > He hasnt made a PR yet, this issue should not take much time  i will create a pull request right away. can you assign it to me? @Dhirenderchoudhary  

- **Issue #1814** (2026-10-04): **Harvest sends Bearer with an empty token when auth is missing**
  *Symptoms*: Harvest does not fail when the access token is missing. It sends the request anyway.  `keyBuilder` in `packages/harvest/index.ts` (line 752) returns `''` when `get_access_token()` is null. This file never throws `AuthMissingError`. `bind.ts` then passes that empty string as `ctx.key`.  `harvestCall` in `packages/harvest/endpoints/shared.ts` resolves the account and then calls `makeHarvestRequest` with `ctx.key`. In `packages/harvest/client.ts` line 134 it checks `accountId`, but it does not check the token. The header is `Authorization: Bearer ${accessToken}`, so a missing token is sent as `Bearer `. If there is no account id either, `discoverHarvestAccountId` sends that same empty bearer token first.  Please throw `AuthMissingError` when the access token is missing, and add a unit test for the empty keystore case.
  **Post-Mortem & Fix Analysis**:
  > I'd love to work on this can u assign this issue to me !! 
  > @sahiljadhav7 assigned

- **Issue #1813** (2026-10-04): **WakaTime sends an empty Basic auth header when the API key is missing**
  *Symptoms*: If the WakaTime API key is not stored, the plugin still makes the request.  `keyBuilder` in `packages/wakatime/index.ts` (line 121) does `return res ?? ''` when `get_api_key()` is null. A missing key from the store is `null` (`packages/corsair/core/auth/key-manager.ts` line 40). `bind.ts` only shows the connect-link error when `keyBuilder` throws `AuthMissingError`. An empty string is not a throw, so the endpoint runs with `ctx.key === ''`.  `packages/wakatime/endpoints/users.ts` line 13 passes that key into `makeWakaTimeRequest`. The client sets `Authorization: Basic ${base64(apiKey)}` in `packages/wakatime/client.ts` line 52. With an empty key the header is just `Basic ` and the API returns 401.  It should throw `AuthMissingError` when the key is missing, same as the other plugins, and there should be a unit test for the empty keystore case.
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one. I haven't merged anything in this repo before.  Plan: in `keyBuilder` in `packages/wakatime/index.ts`, throw `AuthMissingError('wakatime', 'api_key')` when `get_api_key()` returns null or empty, the same way the twilio plugin does. Add a `key-builder.test.ts` covering the empty keystore case (throws, never returns `''`), plus the stored key and `options.key` cases still resolving.  Happy to wait for an assignment before opening a PR.
  > @DeepanshuPal Assigned

- **Issue #1812** (2026-10-03): **Zendesk plugin still has the generator example webhook**
  *Symptoms*: Same leftover as the old generator scaffold.  `packages/zendesk/index.ts` line 119 registers `example.example`. The schema says "An example webhook event", and `zendesk()` returns that webhook map. `packages/zendesk/webhooks/types.ts` uses `z.literal('example')`. The handler in `packages/zendesk/webhooks/example.ts` only matches that type.  A real Zendesk webhook is not `type: 'example'`, so this stub does not handle real Zendesk events. This issue is only to delete the stub, not to add Zendesk webhook support.  Please remove the example handler, the example schema, and the registry entries. Keep the signature helper and the tests that cover it.
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to take this one. I'm a first-time contributor to Corsair.  My plan, which sticks to what the issue lists:  - Delete `packages/zendesk/webhooks/example.ts` (the example handler). - Remove `ExampleEventSchema` / `ExampleEvent` and the `example` entry in `ZendeskWebhookOutputs` from `webhooks/types.ts`, and the `ExampleWebhooks` export from `webhooks/index.ts`. - In `packages/zendesk/index.ts`, drop the `example.example` entries from the webhook map, the webhook schema map and the `ZendeskWebhooks` type, so both maps are empty. - Keep `verifyZendeskWebhookSignature`, the tenant matcher, `pluginWebhookMatcher` and the tests that cover them as they are.  I have tried this locally and typecheck, lint, `validate:plugins` and the zendesk tests pass. I'll wait to be assigned before opening a PR, as CONTRIBUTING asks.
  > @DeepanshuPal You worked on 3 GFI issues let this one open for new contributors
  > Understood, thanks for the heads up. Leaving this one open for a new contributor.

- **Issue #1811** (2026-10-04): **Spotify plugin still has the generator example webhook**
  *Symptoms*: The Spotify plugin still ships the example webhook from the generator.  `packages/spotify/index.ts` line 301 registers `example.example`, and the plugin returns it. The schema description is "An example Spotify webhook event". In `packages/spotify/webhooks/types.ts` the event type is literally `example`, and the file still has the comment `TODO: Add your event data fields here`. The handler in `packages/spotify/webhooks/example.ts` only accepts `type: 'example'`.  This is not a real Spotify webhook. Spotify API calls do not use it.  Please remove the example handler, the example schema, and the `example.example` registry entries. Keep `verifySpotifyWebhookSignature` and the tests in `packages/spotify/webhooks/types.test.ts`.
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to take this one. I'm a first-time contributor to Corsair.  Plan: delete `packages/spotify/webhooks/example.ts`, drop the example schema and `ExampleEvent` type from `webhooks/types.ts`, and remove the `example.example` entries (the webhook type, the nested webhooks map and the webhook schema registry) from `packages/spotify/index.ts`. `verifySpotifyWebhookSignature` and `types.test.ts` stay untouched. I'll leave the existing `pluginWebhookMatcher` as it is, since the issue doesn't mention it, and flag it in the PR in case you'd rather change it.  I've already run this locally against a fresh clone. Happy to wait for assignment before opening a PR.
  > Seeing #1817 already covers this, so I'm standing down and leaving it to them. One correction: my earlier line about having run this locally was premature. The scoped validation didn't finish before I commented. Apologies for the noise.

- **Issue #1809** (2026-10-04): **Toggl sends Basic auth of :api_token when the token is missing**
  *Symptoms*: If no Toggl API token is stored, the request still goes out.  `keyBuilder` in `packages/toggl/index.ts` (line 865) returns `''` when `get_api_key()` is null. `bind.ts` only treats a thrown `AuthMissingError` as missing auth, so the call runs with an empty `ctx.key`.  `buildAuthHeader` in `packages/toggl/client.ts` line 39 encodes `` `${apiToken}:api_token` ``. An empty token becomes Basic auth of `:api_token`. Toggl then returns 401.  Please throw `AuthMissingError` when the token is missing, and add a unit test for the empty keystore case.
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to take this one. I'm a first-time contributor to Corsair.  I read through the Toggl plugin and the root cause matches the issue: `keyBuilder` in `packages/toggl/index.ts` returns `res ?? ''` when `get_api_key()` is empty, and `bind.ts` only treats a thrown `AuthMissingError` as missing auth, so the request goes out with an empty key.  Plan: - In the `endpoint` + `api_key` branch of `keyBuilder`, throw `AuthMissingError('toggl', 'api_key')` when the stored key is empty, following the pattern in the twilio plugin. - Leave the `options.key` override and the other branches alone, so existing behaviour is unchanged for anyone who already has a key set. - Add a `key-builder.test.ts` for the empty keystore case (null and empty string throw, a stored key and the `options.key` override still resolve), modelled on the twilio one. - Run the Toggl package tests, `pnpm typecheck` and `pnpm lint` before anything goes up.  As CONTRIBUTING suggests, I'll wait for assignment before starti

- **Issue #1808** (2026-10-03): **corsair ui --port accepts 3000abc and crashes on abc**
  *Symptoms*: I was looking at the studio command and the port check looks incomplete.  In `packages/cli/src/commands/studio.command.ts` line 42 the port is only passed through `Number.parseInt`. There is no check that the whole string is a number.  - `--port 3000abc` becomes 3000, so studio starts on port 3000 - `--port abc` becomes `NaN`  In `packages/studio/src/server/index.ts` line 32 the fallback is `options.port ?? 4317`. `??` does not replace `NaN`, so `server.listen` (line 148) gets `NaN` and throws `ERR_SOCKET_BAD_PORT`.  The http command already does this properly in `packages/cli/src/commands/http.command.ts` (only digits, port from 1 to 65535). Same check should be used here, plus a small test for `3000abc`, `abc`, and a normal port.
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to work on this issue — happy to be assigned.  Plan: reuse the validation `http.command.ts` already does (`/^\d+$/` plus the 1-65535 range check) in `studio.command.ts`, where `--port` currently goes through `Number.parseInt` unchecked.  Two details I want to keep intact: - `--port` stays optional, so omitting it still leaves `options.port` undefined and the `options.port ?? 4317` fallback keeps working. - Invalid input fails fast with a clear message (same `console.error` + `process.exit(1)` style as the http command) instead of silently starting on port 3000.  For tests, the three cases you listed (`3000abc`, `abc`, a valid port) plus the no-flag case. `packages/cli` already has a Jest setup (`jest.config.cjs`), so this needs no new tooling.  I'll run `pnpm lint`, `pnpm typecheck` and `pnpm test` before opening the PR. 
  > @MarceloAdan73 Assigned

- **Issue #1784** (2026-09-29): **Skill docs list an invalid npm corsair command**
  *Symptoms*: `skills/corsair/SKILL.md:162` tells users to run `npm corsair list`, with two more variants on the next lines. Npm has no `corsair` subcommand, so that fails with Unknown command. The CLI package in `packages/cli/package.json:9` exposes a `corsair` bin meant to run through `npx corsair` or the package manager exec, as `packages/cli/README.md:17` shows. Anyone following the skill verbatim stalls at verification. Change the three run lines to `npx corsair` and the docs match the actual install model.    This one is reserved for first-time contributors. Returning contributors, please try one of the other medium issues instead.

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

### Incident Patch 1: `41cd9c66` (2026-10-04)
**Commit Message**: fix(studio): remove duplicate aria-label props on ScriptPage (#1798)

**File**: `packages/studio/src/web/pages/ScriptPage.tsx` (modified, +0/-2)
```diff
@@ -80,7 +80,6 @@ export function ScriptPage({ tenant }: { tenant: string }) {
 					<Card className="p-3 flex items-center gap-2">
 						<select
 							value={activeTenant}
-							aria-label="Tenant"
 							onChange={(e) => setActiveTenant(e.target.value)}
 							className="h-8 px-2 rounded-md text-xs bg-[var(--color-bg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent-dim)]"
 							aria-label="Active Tenant"
@@ -112,7 +111,6 @@ export function ScriptPage({ tenant }: { tenant: string }) {
 						rows={14}
 						value={code}
 						onChange={(e) => setCode(e.target.value)}
-						aria-label="Script"
 						spellCheck={false}
 						aria-label="Script Source"
 					/>
```

---

### Incident Patch 2: `16b9b6de` (2026-10-04)
**Commit Message**: fix (mailtrap): throw AuthMissingError when API key is missing (#1822)

**File**: `packages/mailtrap/index.ts` (modified, +5/-1)
```diff
@@ -14,6 +14,7 @@ import type {
 	RequiredPluginEndpointSchemas,
 	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import {
 	Account,
 	ContactFields,
@@ -682,7 +683,10 @@ export function mailtrap<const T extends MailtrapPluginOptions>(
 
 			if (source === 'endpoint' && ctx.authType === 'api_key') {
 				const res = await ctx.keys.get_api_key();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('mailtrap', 'api_key');
+				}
+				return res;
 			}
 
 			return '';
```

**File**: `packages/mailtrap/key-builder.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { AuthMissingError } from 'corsair/core';
+import { mailtrap } from './index';
+
+describe('Mailtrap keyBuilder', () => {
+	it.each([null, undefined, ''])(
+		'throws AuthMissingError when the keystore returns %p',
+		async (empty) => {
+			const plugin = mailtrap();
+
+			await expect(
+				plugin.keyBuilder!(
+					{
+						authType: 'api_key',
+						keys: {
+							get_api_key: async () => empty,
+						},
+					} as never,
+					'endpoint',
+				),
+			).rejects.toBeInstanceOf(AuthMissingError);
+		},
+	);
+
+	it('returns the stored API key when present', async () => {
+		const plugin = mailtrap();
+
+		const key = await plugin.keyBuilder!(
+			{
+				authType: 'api_key',
+				keys: {
+					get_api_key: async () => 'test-token',
+				},
+			} as never,
+			'endpoint',
+		);
+
+		expect(key).toBe('test-token');
+	});
+});
```

---

### Incident Patch 3: `7fbc3366` (2026-10-04)
**Commit Message**: fix(spotify): remove generator example webhook (#1821)

**File**: `docs/plugins/spotify/get-credentials.mdx` (modified, +1/-10)
```diff
@@ -1,6 +1,6 @@
 ---
 title: Get Credentials
-description: Step-by-step instructions for Spotify OAuth credentials, optional client credentials, and webhook secrets for the Corsair Spotify plugin.
+description: Step-by-step instructions for Spotify OAuth credentials and optional client credentials for the Corsair Spotify plugin.
 ---
 
 This guide walks you through obtaining all required credentials for the Spotify plugin.
@@ -55,20 +55,11 @@ pnpm corsair setup --plugin=spotify api_key=your-access-token
 
 Remember that Spotify access tokens expire; prefer [`oauth_2`](/concepts/oauth) so Corsair can refresh tokens automatically.
 
-## Webhooks (Optional)
-
-If you use Spotify webhooks that sign payloads, store the verification secret Corsair should use for your webhook endpoint.
-
-```bash
-pnpm corsair setup --plugin=spotify webhook_signature=your-webhook-secret
-```
-
 ## Required Credentials Summary
 
 | Credential | Required for | Where to find |
 |------------|----------------|---------------|
 | Client ID / secret | [`oauth_2`](/concepts/oauth) | Developer Dashboard → app → Settings |
 | Access token string | [`api_key`](/concepts/api-key) (manual) | Your own token acquisition flow |
-| Webhook secret | Webhooks (if used) | Spotify webhook / app configuration |
 
 For general information about how Corsair handles authentication, see [Authentication](/concepts/auth).
```

**File**: `packages/spotify/README.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ Auth: OAuth 2.0, API key, Managed OAuth (default OAuth 2.0). Set `authType` on t
 
 ## Webhooks
 
-Handles 1 webhook event. See the reference for payloads and `webhookHooks`.
+No webhooks. Spotify does not offer a public webhook API.
 
 ## Reference
 
```

**File**: `packages/spotify/index.ts` (modified, +14/-48)
```diff
@@ -6,11 +6,11 @@ import type {
 	CorsairErrorHandler,
 	CorsairPlugin,
 	CorsairPluginContext,
-	CorsairWebhook,
 	KeyBuilderContext,
 	PickAuth,
 	PluginPermissionsConfig,
 	RequiredPluginEndpointMeta,
+	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
 import { AuthMissingError, getOAuthAccessToken } from 'corsair/core';
 import { attachManagedRefreshAuth, getManagedAccessToken } from 'corsair/hub';
@@ -33,10 +33,7 @@ import {
 } from './endpoints/types';
 import { errorHandlers } from './error-handlers';
 import { SpotifySchema } from './schema';
-import { ExampleWebhooks } from './webhooks';
 import { matchSpotifyTenantWebhook } from './webhooks/tenant-matcher';
-import type { ExampleEvent, SpotifyWebhookOutputs } from './webhooks/types';
-import { ExampleEventSchema } from './webhooks/types';
 
 /**
  * Plugin options type - configure authentication and behavior
@@ -117,14 +114,11 @@ export type SpotifyEndpoints = {
 	tracksSearch: SpotifyEndpoint<'tracksSearch'>;
 };
 
-type SpotifyWebhook<
-	K extends keyof SpotifyWebhookOutputs,
-	TEvent,
-> = CorsairWebhook<SpotifyContext, TEvent, SpotifyWebhookOutputs[K]>;
-
-export type SpotifyWebhooks = {
-	example: SpotifyWebhook<'example', ExampleEvent>;
-};
+/**
+ * Spotify does not offer a public webhook API, so there are no triggers to
+ * register. See https://github.com/spotify/web-api/issues/538
+ */
+export type SpotifyWebhooks = Record<string, never>;
 
 export type SpotifyBoundWebhooks = BindWebhooks<SpotifyWebhooks>;
 
@@ -298,19 +292,12 @@ export const spotifyEndpointSchemas = {
 	},
 } as const;
 
-const spotifyWebhooksNested = {
-	example: {
-		example: ExampleWebhooks.example,
-	},
-} as const;
+const spotifyWebhooksNested = {} as const;
 
-const spotifyWebhookSchemas = {
-	'example.example': {
-		description: 'An example Spotify webhook event',
-		payload: ExampleEventSchema,
-		response: ExampleEventSchema,
-	},
-} as const;
+const spotifyWebhookSchemas =
+	{} as const satisfies RequiredPluginWebhookSchemas<
+		typeof spotifyWebhooksNested
+	>;
 
 const defaultAuthType: AuthTypes = 'oauth_2';
 
@@ -478,26 +465,8 @@ export function spotify<const T extends SpotifyPluginOptions>(
 		endpointMeta: spotifyEndpointMeta,
 		endpointSchemas: spotifyEndpointSchemas,
 		webhookSchemas: spotifyWebhookSchemas,
-		/**
-		 * Webhook matcher function - determines if an incoming request is a webhook for this plugin
-		 *
-		 * WEBHOOK CONFIGURATION:
-		 * Update this to check for headers that identify your provider's webhooks.
-		 * Common patterns:
-		 * - Check for signature headers (e.g., 'x-spotify-signature')
-		 * - Check for user-agent strings
-		 * - Check for specific path patterns
-		 *
-		 * Example for multiple headers:
-		 * pluginWebhookMatcher: (request) => {
-		 *   const headers = request.headers;
-		 *   return 'x-spotify-signature' in headers && 'x-spotify-timestamp' in headers;
-		 * },
-		 */
-		pluginWebhookMatcher: (request) => {
-			const headers = request.headers;
-			return 'x-spotify-signature' in headers || 'spotify-webhook' in headers;
-		},
+		// Spotify has no public webhook API, so never claim incoming webhook traffic.
+		pluginWebhookMatcher: () => false,
 		pluginTenantWebhookMatcher: matchSpotifyTenantWebhook,
 		errorHandlers: {
 			...errorHandlers,
@@ -596,10 +565,7 @@ export function spotify<const T extends SpotifyPluginOptions>(
 // Webhook Type Exports
 // ─────────────────────────────────────────────────────────────────────────────
 
-export type {
-	ExampleEvent,
-	SpotifyWebhookOutputs,
-} from './webhooks/types';
+export type { SpotifyWebhookOutputs } from './webhooks/types';
 
 // ─────────────────────────────────────────────────────────────────────────────
 // Endpoint Type Exports
```

**File**: `packages/spotify/webhooks/example.ts` (removed, +0/-44)
```diff
@@ -1,44 +0,0 @@
-import { logEventFromContext } from 'corsair/core';
-import type { SpotifyWebhooks } from '../index';
-import { createSpotifyMatch, verifySpotifyWebhookSignature } from './types';
-
-export const example: SpotifyWebhooks['example'] = {
-	match: createSpotifyMatch('example'),
-
-	handler: async (ctx, request) => {
-		const webhookSecret = ctx.key;
-		const verification = verifySpotifyWebhookSignature(request, webhookSecret);
-		if (!verification.valid) {
-			return {
-				success: false,
-				statusCode: 401,
-				error: verification.error || 'Signature verification failed',
-			};
-		}
-
-		const event = request.payload;
-
-		if (event.type !== 'example') {
-			return {
-				success: true,
-				data: undefined,
-			};
-		}
-
-		console.log('📦 Spotify Example Event:', {
-			id: event.data.id,
-		});
-
-		await logEventFromContext(
-			ctx,
-			'spotify.webhook.example',
-			{ ...event },
-			'completed',
-		);
-
-		return {
-			success: true,
-			data: event,
-		};
-	},
-};
```

**File**: `packages/spotify/webhooks/index.ts` (modified, +0/-6)
```diff
@@ -1,7 +1 @@
-import { example } from './example';
-
-export const ExampleWebhooks = {
-	example: example,
-};
-
 export * from './types';
```

**File**: `packages/spotify/webhooks/types.test.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { verifySpotifyWebhookSignature } from './types';
 describe('verifySpotifyWebhookSignature', () => {
 	const secret = 'my-super-secret-key';
 	const payload: SpotifyWebhookPayload = {
-		type: 'example',
+		type: 'test.event',
 		created_at: '2026-05-22T00:00:00Z',
 		data: { id: '123' },
 	};
```

**File**: `packages/spotify/webhooks/types.ts` (modified, +4/-66)
```diff
@@ -1,9 +1,5 @@
 import * as crypto from 'node:crypto';
-import type {
-	CorsairWebhookMatcher,
-	RawWebhookRequest,
-	WebhookRequest,
-} from 'corsair/core';
+import type { WebhookRequest } from 'corsair/core';
 import { z } from 'zod';
 
 // ─────────────────────────────────────────────────────────────────────────────
@@ -25,73 +21,15 @@ export const SpotifyWebhookPayloadSchema = z.object({
 export type SpotifyWebhookPayload = z.infer<typeof SpotifyWebhookPayloadSchema>;
 
 /**
- * Webhook Event Schemas
- *
- * CONFIGURATION:
- * - Replace ExampleEvent with your actual webhook event types
- * - Each event type should extend SpotifyWebhookPayload
- * - Add all event-specific fields in the data object
- *
- * Example:
- * export const UserCreatedEventSchema = SpotifyWebhookPayloadSchema.extend({
- *   type: z.literal('user.created'),
- *   data: z.object({
- *     user_id: z.string(),
- *     email: z.string(),
- *     name: z.string(),
- *   }),
- * });
- * export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;
- */
-export const ExampleEventSchema = SpotifyWebhookPayloadSchema.extend({
-	type: z.literal('example'),
-	data: z
-		.object({
-			id: z.string(),
-			// TODO: Add your event data fields here
-		})
-		.catchall(z.unknown()),
-});
-export type ExampleEvent = z.infer<typeof ExampleEventSchema>;
-
-/**
- * Webhook Outputs Type
- *
- * Maps each webhook key to its event type.
- * This is used by the plugin system for type inference.
- *
- * CONFIGURATION:
- * - Replace 'example' with your actual webhook keys
- * - Add all your webhooks here
- * - Each key should match a webhook in your webhooks/ directory
+ * Spotify does not offer a public webhook API, so no webhook handlers are
+ * registered. See https://github.com/spotify/web-api/issues/538
  */
-export type SpotifyWebhookOutputs = {
-	example: ExampleEvent;
-	// TODO: Add more webhooks as you implement them
-};
+export type SpotifyWebhookOutputs = Record<string, never>;
 
 // ─────────────────────────────────────────────────────────────────────────────
 // Utilities
 // ─────────────────────────────────────────────────────────────────────────────
 
-function parseBody(body: unknown): unknown {
-	return typeof body === 'string' ? JSON.parse(body) : body;
-}
-
-/**
- * Creates a matcher function for a specific event type
- *
- * CONFIGURATION:
- * This function is used to match incoming webhooks to the correct handler.
- * Most providers use a 'type' field, but you may need to customize this.
- */
-export function createSpotifyMatch(eventType: string): CorsairWebhookMatcher {
-	return (request: RawWebhookRequest) => {
-		const parsedBody = parseBody(request.body) as Record<string, unknown>;
-		return typeof parsedBody.type === 'string' && parsedBody.type === eventType;
-	};
-}
-
 /**
  * Webhook Signature Verification
  *
```

---

### Incident Patch 4: `da064ec4` (2026-10-04)
**Commit Message**: fix(toggl): throw AuthMissingError when api key is missing (#1820)

**File**: `packages/toggl/index.ts` (modified, +9/-1)
```diff
@@ -14,6 +14,7 @@ import type {
 	RequiredPluginEndpointSchemas,
 	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import {
 	Clients,
 	Me,
@@ -862,14 +863,21 @@ export function toggl<const T extends TogglPluginOptions>(
 			...errorHandlers,
 			...options.errorHandlers,
 		},
+		/**
+		 * Resolves the Toggl API token. Throws AuthMissingError when the stored
+		 * key is missing, so the request is not sent as Basic auth of `:api_token`.
+		 */
 		keyBuilder: async (ctx: TogglKeyBuilderContext, source) => {
 			if (source === 'endpoint' && options.key) {
 				return options.key;
 			}
 
 			if (source === 'endpoint' && ctx.authType === 'api_key') {
 				const res = await ctx.keys.get_api_key();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('toggl', 'api_key');
+				}
+				return res;
 			}
 
 			return '';
```

**File**: `packages/toggl/key-builder.test.ts` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+import { AuthMissingError } from 'corsair/core';
+import type { TogglKeyBuilderContext, TogglPluginOptions } from './index';
+import { toggl } from './index';
+
+/** Stub key manager: keyBuilder only reads get_api_key. */
+function stubCtx(
+	apiKey: string | null,
+	options: TogglPluginOptions = {},
+): TogglKeyBuilderContext {
+	const ignoreSetter = async (): Promise<void> => undefined;
+	return {
+		authType: 'api_key',
+		options,
+		keys: {
+			get_dek: async () => 'test-dek',
+			issue_new_dek: async () => 'test-dek',
+			get_api_key: async () => apiKey,
+			set_api_key: ignoreSetter,
+			get_webhook_signature: async () => null,
+			set_webhook_signature: ignoreSetter,
+		},
+		tenantId: 'default',
+	};
+}
+
+/**
+ * Invokes keyBuilder with a TogglKeyBuilderContext. The plugin is pinned to
+ * TogglPluginOptions so the callback accepts that context.
+ */
+async function resolveKey(
+	plugin: ReturnType<typeof toggl<TogglPluginOptions>>,
+	ctx: TogglKeyBuilderContext,
+): Promise<string> {
+	const build = plugin.keyBuilder;
+	if (!build) {
+		throw new Error('toggl plugin must define keyBuilder');
+	}
+	return Promise.resolve(build(ctx, 'endpoint'));
+}
+
+describe('toggl keyBuilder authentication', () => {
+	const plugin = toggl<TogglPluginOptions>();
+
+	it('throws AuthMissingError when no api key is stored', async () => {
+		await expect(resolveKey(plugin, stubCtx(null))).rejects.toBeInstanceOf(
+			AuthMissingError,
+		);
+	});
+
+	it('throws AuthMissingError when the stored api key is empty', async () => {
+		await expect(resolveKey(plugin, stubCtx(''))).rejects.toBeInstanceOf(
+			AuthMissingError,
+		);
+	});
+
+	it('reports toggl / api_key on the thrown error', async () => {
+		await expect(resolveKey(plugin, stubCtx(null))).rejects.toMatchObject({
+			pluginId: 'toggl',
+			authType: 'api_key',
+		});
+	});
+
+	it('returns the stored api key', async () => {
+		await expect(resolveKey(plugin, stubCtx('stored-token'))).resolves.toBe(
+			'stored-token',
+		);
+	});
+
+	it('returns options.key without reading the key manager', async () => {
+		let reads = 0;
+		const ctx = stubCtx(null);
+		ctx.keys.get_api_key = async () => {
+			reads += 1;
+			return null;
+		};
+		const withKey = toggl<TogglPluginOptions>({ key: 'option-token' });
+		await expect(resolveKey(withKey, ctx)).resolves.toBe('option-token');
+		expect(reads).toBe(0);
+	});
+});
```

---

### Incident Patch 5: `d776c363` (2026-10-04)
**Commit Message**: fix(wakatime): throw AuthMissingError when the API key is missing (#1818)

**File**: `packages/wakatime/index.ts` (modified, +5/-1)
```diff
@@ -12,6 +12,7 @@ import type {
 	RequiredPluginEndpointMeta,
 	RequiredPluginEndpointSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import { Users } from './endpoints';
 import type {
 	WakaTimeEndpointInputs,
@@ -125,7 +126,10 @@ export function wakatime<const T extends WakaTimePluginOptions>(
 
 			if (source === 'endpoint' && ctx.authType === 'api_key') {
 				const res = await ctx.keys.get_api_key();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('wakatime', 'api_key');
+				}
+				return res;
 			}
 
 			return '';
```

**File**: `packages/wakatime/key-builder.test.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { AuthMissingError } from 'corsair/core';
+import type { WakaTimeKeyBuilderContext, WakaTimePluginOptions } from './index';
+import { wakatime } from './index';
+
+/** Stub account key manager backed by a single in-memory api key. */
+function stubKeys(apiKey: string | null): WakaTimeKeyBuilderContext['keys'] {
+	return {
+		get_dek: async () => 'test-dek',
+		issue_new_dek: async () => 'test-dek',
+		get_api_key: async () => apiKey,
+		set_api_key: async () => undefined,
+		get_webhook_signature: async () => null,
+		set_webhook_signature: async () => undefined,
+	};
+}
+
+function stubCtx(
+	apiKey: string | null,
+	options: WakaTimePluginOptions = {},
+): WakaTimeKeyBuilderContext {
+	return {
+		authType: 'api_key',
+		options,
+		keys: stubKeys(apiKey),
+		tenantId: 'default',
+	};
+}
+
+async function resolveKey(
+	plugin: ReturnType<typeof wakatime>,
+	ctx: WakaTimeKeyBuilderContext,
+): Promise<string> {
+	const build = plugin.keyBuilder;
+	if (!build) {
+		throw new Error('wakatime plugin must define keyBuilder');
+	}
+	return build(ctx, 'endpoint');
+}
+
+describe('wakatime keyBuilder authentication', () => {
+	const plugin = wakatime();
+
+	it('throws AuthMissingError when the keystore has no api key', async () => {
+		await expect(resolveKey(plugin, stubCtx(null))).rejects.toBeInstanceOf(
+			AuthMissingError,
+		);
+	});
+
+	it('throws AuthMissingError when the stored api key is an empty string', async () => {
+		await expect(resolveKey(plugin, stubCtx(''))).rejects.toBeInstanceOf(
+			AuthMissingError,
+		);
+	});
+
+	it('identifies the wakatime plugin and api_key auth in the error', async () => {
+		await expect(resolveKey(plugin, stubCtx(null))).rejects.toMatchObject({
+			pluginId: 'wakatime',
+			authType: 'api_key',
+		});
+	});
+
+	it('returns the stored api key when present', async () => {
+		await expect(resolveKey(plugin, stubCtx('stored-key'))).resolves.toBe(
+			'stored-key',
+		);
+	});
+
+	it('prefers options.key over the keystore', async () => {
+		const withKey = wakatime({ key: 'option-key' });
+		await expect(
+			resolveKey(withKey, stubCtx(null, { key: 'option-key' })),
+		).resolves.toBe('option-key');
+	});
+});
```

---

### Incident Patch 6: `4fb7fcdb` (2026-10-04)
**Commit Message**: fix(harvest): throw AuthMissingError when access token is missing (#1816)

Co-authored-by: Dhirender Choudhary <[REDACTED_EMAIL]>

**File**: `packages/harvest/endpoints.test.ts` (modified, +72/-2)
```diff
@@ -3,7 +3,7 @@
  * the cache writes they perform, and what reaches the event log. Network access
  * is mocked, so this runs in CI.
  */
-import { logEventFromContext } from 'corsair/core';
+import { AuthMissingError, logEventFromContext } from 'corsair/core';
 import {
 	Clients,
 	Company,
@@ -17,7 +17,8 @@ import {
 	Users,
 } from './endpoints';
 import { isNonIdempotent } from './error-handlers';
-import { harvestEndpointMeta } from './index';
+import type { HarvestKeyBuilderContext, HarvestPluginOptions } from './index';
+import { harvest, harvestEndpointMeta } from './index';
 
 // The event-log payload is asserted directly further down: it is the one place
 // caller-supplied text could leak into durable storage, so it needs to be
@@ -702,3 +703,72 @@ describe('delete results', () => {
 		).resolves.toEqual({ success: true, id: 11 });
 	});
 });
+
+describe('keyBuilder', () => {
+	/** Account key manager stub. keyBuilder only reads get_access_token. */
+	function stubKeys(
+		accessToken: string | null,
+	): HarvestKeyBuilderContext['keys'] {
+		const ignore = async (): Promise<void> => undefined;
+		return {
+			get_dek: async () => 'dek',
+			issue_new_dek: async () => 'dek',
+			get_access_token: async () => accessToken,
+			set_access_token: ignore,
+			get_refresh_token: async () => null,
+			set_refresh_token: ignore,
+			get_expires_at: async () => null,
+			set_expires_at: ignore,
+			get_scope: async () => null,
+			set_scope: ignore,
+			get_webhook_signature: async () => null,
+			set_webhook_signature: ignore,
+			get_integration_credentials: async () => ({
+				client_id: null,
+				client_secret: null,
+				redirect_url: null,
+			}),
+		};
+	}
+
+	/**
+	 * Runs the plugin keyBuilder with a HarvestKeyBuilderContext. The plugin
+	 * is pinned to HarvestPluginOptions so the callback accepts that context
+	 * instead of the generic `never` parameter.
+	 */
+	function buildKey(
+		accessToken: string | null,
+		options: { key?: string } = {},
+	): Promise<string> {
+		const keyBuilder = harvest<HarvestPluginOptions>(options).keyBuilder;
+		if (!keyBuilder) {
+			throw new Error('harvest plugin must define keyBuilder');
+		}
+		const ctx: HarvestKeyBuilderContext = {
+			authType: 'oauth_2',
+			options: {},
+			tenantId: 'tenant',
+			keys: stubKeys(accessToken),
+		};
+		return Promise.resolve(keyBuilder(ctx, 'endpoint'));
+	}
+
+	it('returns the stored access token', async () => {
+		await expect(buildKey('stored-token')).resolves.toBe('stored-token');
+	});
+
+	it('throws AuthMissingError when the keystore has no access token', async () => {
+		await expect(buildKey(null)).rejects.toMatchObject({
+			pluginId: 'harvest',
+			authType: 'oauth_2',
+		});
+	});
+
+	it('throws AuthMissingError when the stored access token is empty', async () => {
+		await expect(buildKey('')).rejects.toBeInstanceOf(AuthMissingError);
+	});
+
+	it('prefers options.key over the keystore', async () => {
+		await expect(buildKey(null, { key: 'explicit' })).resolves.toBe('explicit');
+	});
+});
```

**File**: `packages/harvest/index.ts` (modified, +10/-1)
```diff
@@ -14,6 +14,7 @@ import type {
 	RequiredPluginEndpointSchemas,
 	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import {
 	Clients,
 	Company,
@@ -749,14 +750,22 @@ export function harvest<const T extends HarvestPluginOptions>(
 			...errorHandlers,
 			...options.errorHandlers,
 		},
+		/**
+		 * Resolves the Harvest bearer token. Throws AuthMissingError when the
+		 * stored OAuth access token is missing, so the request is not sent
+		 * with an empty Authorization header.
+		 */
 		keyBuilder: async (ctx: HarvestKeyBuilderContext, source) => {
 			if (source === 'endpoint' && options.key) {
 				return options.key;
 			}
 
 			if (source === 'endpoint' && ctx.authType === 'oauth_2') {
 				const res = await ctx.keys.get_access_token();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('harvest', 'oauth_2');
+				}
+				return res;
 			}
 
 			return '';
```

---

### Incident Patch 7: `b9d8d9b5` (2026-10-03)
**Commit Message**: fix(cli): validate --port in the ui command (#1824)

* fix(cli): validate --port in the ui command

corsair ui --port went straight through Number.parseInt, so "3000abc"
silently started on port 3000 and "abc" became NaN. NaN is not nullish,
so the options.port ?? 4317 fallback does not apply and NaN reaches the
server bind, which crashes.

Parse and range-check the value with the same rules http.command.ts
already uses, and fail fast with a clear message. --port stays optional:
omitting it leaves the value undefined so the existing fallback keeps
applying.

The parse is extracted into an exported pure helper because action()
resolves @corsair-dev/studio/server from process.cwd() and imports it
dynamically, which makes it untestable in isolation.

Fixes #1808

* test(cli): restore port validation spies in afterEach

Greptile flagged the spy cleanup as non-blocking, and it was right: a
failing assertion before the inline mockRestore() would leak the
console.error and process.exit mocks into the following tests.

Move the setup to beforeEach/afterEach with jest.restoreAllMocks(), and
fold the repetitive per-case mocks into it.each. Adds the empty string,
sign, decimal and whitespace-

**File**: `packages/cli/src/commands/studio.command.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { parseStudioPort } from './studio.command';
+
+const INVALID_PORT_MESSAGE =
+	'[corsair]: Invalid port. Usage: corsair ui --port <number> (1-65535).';
+
+describe('parseStudioPort', () => {
+	beforeEach(() => {
+		jest.spyOn(console, 'error').mockImplementation(() => {});
+		// `process.exit` is typed as returning `never`, so the only way to keep
+		// the mock's signature is to let it throw instead of returning.
+		jest.spyOn(process, 'exit').mockImplementation((() => {
+			throw new Error('process.exit');
+		}) as typeof process.exit);
+	});
+
+	// Restore in one place so a failing assertion cannot leak the spies into
+	// the next test.
+	afterEach(() => {
+		jest.restoreAllMocks();
+	});
+
+	it('returns undefined when no port is provided', () => {
+		expect(parseStudioPort(undefined)).toBeUndefined();
+		expect(console.error).not.toHaveBeenCalled();
+	});
+
+	it.each(['1', '3000', '4317', '65535'])(
+		'returns %p as the port number',
+		(raw) => {
+			expect(parseStudioPort(raw)).toBe(Number(raw));
+			expect(console.error).not.toHaveBeenCalled();
+		},
+	);
+
+	// The three cases from the issue, plus the empty string, the sign, and the
+	// two range boundaries.
+	it.each(['3000abc', 'abc', '', '-1', '0', '65536', '1.5', ' 3000', '3000 '])(
+		'exits with code 1 for %p',
+		(raw) => {
+			expect(() => parseStudioPort(raw)).toThrow('process.exit');
+			expect(process.exit).toHaveBeenCalledWith(1);
+			expect(console.error).toHaveBeenCalledWith(INVALID_PORT_MESSAGE);
+		},
+	);
+});
```

**File**: `packages/cli/src/commands/studio.command.ts` (modified, +22/-1)
```diff
@@ -8,6 +8,27 @@ type StartStudio = (opts: {
 	open?: boolean;
 }) => Promise<unknown>;
 
+/**
+ * Parse and validate a port string for the studio command.
+ * Returns undefined when no port is provided (so the caller's fallback applies).
+ * Exits with code 1 when the port is invalid.
+ */
+export function parseStudioPort(raw: string | undefined): number | undefined {
+	if (raw === undefined) {
+		return undefined;
+	}
+
+	const port = Number(raw);
+	if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
+		console.error(
+			'[corsair]: Invalid port. Usage: corsair ui --port <number> (1-65535).',
+		);
+		process.exit(1);
+	}
+
+	return port;
+}
+
 export default class StudioCommand extends BaseCommand {
 	getName(): string {
 		return 'ui';
@@ -39,7 +60,7 @@ export default class StudioCommand extends BaseCommand {
 
 	async action({ options }: CommandActionData) {
 		const cwd = process.cwd();
-		const port = options.port ? Number.parseInt(options.port, 10) : undefined;
+		const port = parseStudioPort(options.port);
 
 		let startStudio: StartStudio;
 		try {
```

---

### Incident Patch 8: `c642bf63` (2026-10-03)
**Commit Message**: fix(zendesk): remove generator example webhook (#1825)

* fix(zendesk): remove generator example webhook

The Zendesk plugin still registered the generator's example.example
webhook. Its handler only matched `type: 'example'` payloads, which
Zendesk never sends, so it never handled a real event.

Remove the example handler, ExampleEventSchema / ExampleEvent and the
registry and schema entries, leaving empty webhook maps as in bitwarden
and alphavantage. Keep verifyZendeskWebhookSignature and its tests,
createZendeskMatch and the plugin and tenant webhook matchers.

Fixes #1812

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(zendesk): note the plugin has no webhooks

The README still said the plugin handles one webhook event. Use the
README generator's wording for plugins without webhooks.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/zendesk/README.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ Auth: API key. Corsair prompts your tenant for credentials on first use.
 
 ## Webhooks
 
-Handles 1 webhook event. See the reference for payloads and `webhookHooks`.
+No webhooks.
 
 ## Reference
 
```

**File**: `packages/zendesk/index.ts` (modified, +8/-22)
```diff
@@ -27,10 +27,8 @@ import {
 } from './endpoints/types';
 import { errorHandlers } from './error-handlers';
 import { ZendeskSchema } from './schema';
-import { ExampleWebhooks } from './webhooks';
 import { matchZendeskTenantWebhook } from './webhooks/tenant-matcher';
-import type { ExampleEvent, ZendeskWebhookOutputs } from './webhooks/types';
-import { ExampleEventSchema } from './webhooks/types';
+import type { ZendeskWebhookOutputs } from './webhooks/types';
 
 export type ZendeskPluginOptions = {
 	authType?: PickAuth<'api_key'>;
@@ -90,9 +88,7 @@ type ZendeskWebhook<
 	TEvent,
 > = CorsairWebhook<ZendeskContext, TEvent, ZendeskWebhookOutputs[K]>;
 
-export type ZendeskWebhooks = {
-	example: ZendeskWebhook<'example', ExampleEvent>;
-};
+export type ZendeskWebhooks = Record<string, never>;
 
 export type ZendeskBoundWebhooks = BindWebhooks<ZendeskWebhooks>;
 
@@ -116,11 +112,7 @@ const zendeskEndpointsNested = {
 	},
 } as const;
 
-const zendeskWebhooksNested = {
-	example: {
-		example: ExampleWebhooks.example,
-	},
-} as const;
+const zendeskWebhooksNested = {} as const;
 
 export const zendeskEndpointSchemas = {
 	'tickets.create': {
@@ -171,13 +163,10 @@ export const zendeskEndpointSchemas = {
 	typeof zendeskEndpointsNested
 >;
 
-const zendeskWebhookSchemas = {
-	'example.example': {
-		description: 'An example webhook event',
-		payload: ExampleEventSchema,
-		response: ExampleEventSchema,
-	},
-} as const satisfies RequiredPluginWebhookSchemas<typeof zendeskWebhooksNested>;
+const zendeskWebhookSchemas =
+	{} as const satisfies RequiredPluginWebhookSchemas<
+		typeof zendeskWebhooksNested
+	>;
 
 const defaultAuthType: AuthTypes = 'api_key' as const;
 
@@ -309,7 +298,4 @@ export type {
 	ZendeskEndpointInputs,
 	ZendeskEndpointOutputs,
 } from './endpoints/types';
-export type {
-	ExampleEvent,
-	ZendeskWebhookOutputs,
-} from './webhooks/types';
+export type { ZendeskWebhookOutputs } from './webhooks/types';
```

**File**: `packages/zendesk/webhooks/example.ts` (removed, +0/-32)
```diff
@@ -1,32 +0,0 @@
-import { logEventFromContext } from 'corsair/core';
-import type { ZendeskWebhooks } from '..';
-import { createZendeskMatch, verifyZendeskWebhookSignature } from './types';
-
-export const example: ZendeskWebhooks['example'] = {
-	match: createZendeskMatch('example'),
-
-	handler: async (ctx, request) => {
-		const verification = verifyZendeskWebhookSignature(request, ctx.key);
-		if (!verification.valid) {
-			return {
-				success: false,
-				statusCode: 401,
-				error: verification.error || 'Signature verification failed',
-			};
-		}
-
-		const event = request.payload;
-		if (event.type !== 'example') {
-			return { success: true, data: undefined };
-		}
-
-		await logEventFromContext(
-			ctx,
-			'zendesk.webhook.example',
-			{ ...event },
-			'completed',
-		);
-
-		return { success: true, data: event };
-	},
-};
```

**File**: `packages/zendesk/webhooks/index.ts` (modified, +0/-6)
```diff
@@ -1,7 +1 @@
-import { example } from './example';
-
-export const ExampleWebhooks = {
-	example: example,
-};
-
 export * from './types';
```

**File**: `packages/zendesk/webhooks/types.ts` (modified, +2/-14)
```diff
@@ -14,20 +14,8 @@ export const ZendeskWebhookPayloadSchema = z.object({
 
 export type ZendeskWebhookPayload = z.infer<typeof ZendeskWebhookPayloadSchema>;
 
-export const ExampleEventSchema = ZendeskWebhookPayloadSchema.extend({
-	type: z.literal('example'),
-	data: z
-		.object({
-			id: z.string(),
-		})
-		.loose(),
-});
-
-export type ExampleEvent = z.infer<typeof ExampleEventSchema>;
-
-export type ZendeskWebhookOutputs = {
-	example: ExampleEvent;
-};
+/** No webhook handlers are registered yet. */
+export type ZendeskWebhookOutputs = Record<string, never>;
 
 function parseBody(body: unknown): Record<string, unknown> | null {
 	if (typeof body === 'string') {
```

---

### Incident Patch 9: `0364a62a` (2026-10-03)
**Commit Message**: fix(supabase): migrate project logs endpoint (#1745)

* fix(supabase): migrate project logs endpoint

* test(supabase): cover replacement logs endpoint

* chore: retrigger CI after PR description/gate update

* chore: retrigger gate after R4 evidence update (real runtime verification)

* ci: re-run PR checks with runtime demo evidence

---------

Co-authored-by: elli0t-yash <[REDACTED_EMAIL]>

**File**: `packages/supabase/api.test.ts` (modified, +25/-0)
```diff
@@ -265,6 +265,31 @@ describe('Supabase endpoints', () => {
 		);
 	});
 
+	it('routes project logs through the replacement analytics endpoint', async () => {
+		const plugin = supabase({ key: 'test-token' });
+		const endpoints = plugin.endpoints as NonNullable<
+			typeof plugin.endpoints
+		> & {
+			analytics: {
+				getProjectLogs: (
+					ctx: SupabaseContext,
+					input: { ref: string; query?: Record<string, unknown> },
+				) => Promise<unknown>;
+			};
+		};
+
+		await endpoints.analytics.getProjectLogs(mockCtx, {
+			ref: 'abcdefghijklmnopqrst',
+			query: { sql: 'select * from logs limit 1' },
+		});
+
+		expect(mockRequest.mock.calls[0]?.[1]).toMatchObject({
+			method: 'GET',
+			url: '/v1/projects/abcdefghijklmnopqrst/analytics/endpoints/logs',
+			query: { sql: 'select * from logs limit 1' },
+		});
+	});
+
 	it('routes project-hosted APIs through the project base URL', async () => {
 		const plugin = supabase({
 			key: 'test-token',
```

**File**: `packages/supabase/operations/analytics.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ export const analyticsOperations = [
 		group: 'analytics',
 		name: 'getProjectLogs',
 		method: 'GET',
-		path: '/v1/projects/{ref}/analytics/endpoints/logs.all',
+		path: '/v1/projects/{ref}/analytics/endpoints/logs',
 		pathParams: ['ref'],
 		riskLevel: 'read',
 		description: 'Get project logs',
```

---

### Incident Patch 10: `ad90cea2` (2026-10-03)
**Commit Message**: fix: sync testing permissions schema (#1731)

* fix: sync testing permissions schema

* fix: make testing migration retry-safe

**File**: `demo/testing/drizzle/0001_productive_puck.sql` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+DROP TABLE IF EXISTS `corsair_permissions`;--> statement-breakpoint
+
+CREATE TABLE `corsair_permissions` (
+	`id` text PRIMARY KEY NOT NULL,
+	`created_at` integer NOT NULL,
+	`updated_at` integer NOT NULL,
+	`token` text NOT NULL,
+	`plugin` text NOT NULL,
+	`endpoint` text NOT NULL,
+	`args` text NOT NULL,
+	`tenant_id` text DEFAULT 'default' NOT NULL,
+	`status` text DEFAULT 'pending' NOT NULL,
+	`expires_at` text NOT NULL,
+	`error` text
+);
+--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS `corsair_events_account_type_created_idx` ON `corsair_events` (`account_id`,`event_type`,`created_at`);
```

**File**: `demo/testing/drizzle/meta/0001_snapshot.json` (added, +359/-0)
```diff
@@ -0,0 +1,359 @@
+{
+  "version": "6",
+  "dialect": "sqlite",
+  "id": "d5bc9243-e4eb-4326-aa1d-c84a86253a10",
+  "prevId": "a5e0ee72-cd9f-4f83-b44b-d0ebc1b17246",
+  "tables": {
+    "corsair_accounts": {
+      "name": "corsair_accounts",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "tenant_id": {
+          "name": "tenant_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "integration_id": {
+          "name": "integration_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "config": {
+          "name": "config",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false,
+          "autoincrement": false
+        },
+        "dek": {
+          "name": "dek",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false,
+          "autoincrement": false
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "corsair_accounts_integration_id_corsair_integrations_id_fk": {
+          "name": "corsair_accounts_integration_id_corsair_integrations_id_fk",
+          "tableFrom": "corsair_accounts",
+          "tableTo": "corsair_integrations",
+          "columnsFrom": ["integration_id"],
+          "columnsTo": ["id"],
+          "onDelete": "no action",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "checkConstraints": {}
+    },
+    "corsair_entities": {
+      "name": "corsair_entities",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "entity_id": {
+          "name": "entity_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "entity_type": {
+          "name": "entity_type",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "version": {
+          "name": "version",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "data": {
+          "name": "data",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {},
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "checkConstraints": {}
+    },
+    "corsair_events": {
+      "name": "corsair_events",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "event_type": {
+          "name": "event_type",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true,
+          "autoincrement": false
+        },
+        "payload": {
+          "name": "payload",
+          "type": "text",
+      
```

**File**: `demo/testing/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -8,6 +8,13 @@
       "when": 1773529091251,
       "tag": "0000_nasty_moondragon",
       "breakpoints": true
+    },
+    {
+      "idx": 1,
+      "version": "6",
+      "when": 1788887010850,
+      "tag": "0001_productive_puck",
+      "breakpoints": true
     }
   ]
 }
```

**File**: `demo/testing/src/db/schema.ts` (modified, +20/-0)
```diff
@@ -75,3 +75,23 @@ export const corsair_events = sqliteTable(
 		),
 	],
 );
+
+export const corsair_permissions = sqliteTable('corsair_permissions', {
+	id: text('id')
+		.primaryKey()
+		.$defaultFn(() => crypto.randomUUID()),
+	created_at: integer('created_at', { mode: 'timestamp' })
+		.notNull()
+		.$defaultFn(() => new Date()),
+	updated_at: integer('updated_at', { mode: 'timestamp' })
+		.notNull()
+		.$defaultFn(() => new Date()),
+	token: text('token').notNull(),
+	args: text('args').notNull(),
+	plugin: text('plugin').notNull(),
+	endpoint: text('endpoint').notNull(),
+	tenant_id: text('tenant_id').notNull().default('default'),
+	status: text('status').notNull().default('pending'),
+	expires_at: text('expires_at').notNull(),
+	error: text('error'),
+});
```

---

### Incident Patch 11: `9dce172e` (2026-10-01)
**Commit Message**: fix(googledocs): add tabs access to google docs package

**File**: `packages/googledocs/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@corsair-dev/googledocs",
-  "version": "0.1.4",
+  "version": "0.1.5",
   "description": "Google Docs plugin for Corsair",
   "type": "module",
   "main": "./dist/index.js",
```

---

### Incident Patch 12: `09730f18` (2026-10-01)
**Commit Message**: fix(googledocs): add tabs access to google docs package

**File**: `packages/googledocs/api.test.ts` (modified, +105/-4)
```diff
@@ -53,6 +53,10 @@ function lastCall() {
 	return { config: call?.[0], options: call?.[1] };
 }
 
+function optionsQueryFromLastCall() {
+	return lastCall().options?.query;
+}
+
 function countLeaves(tree: Record<string, unknown>): number {
 	return Object.values(tree).reduce<number>((count, value) => {
 		if (typeof value === 'function') return count + 1;
@@ -64,13 +68,13 @@ function countLeaves(tree: Record<string, unknown>): number {
 }
 
 describe('Google Docs plugin shape', () => {
-	it('exposes all 36 operations with schemas and meta in lockstep', () => {
+	it('exposes all 37 operations with schemas and meta in lockstep', () => {
 		const plugin = googledocs();
 		const endpoints = plugin.endpoints as unknown as Record<string, unknown>;
 
-		expect(countLeaves(endpoints)).toBe(36);
-		expect(Object.keys(plugin.endpointMeta ?? {})).toHaveLength(36);
-		expect(Object.keys(googledocsEndpointSchemas)).toHaveLength(36);
+		expect(countLeaves(endpoints)).toBe(37);
+		expect(Object.keys(plugin.endpointMeta ?? {})).toHaveLength(37);
+		expect(Object.keys(googledocsEndpointSchemas)).toHaveLength(37);
 	});
 
 	it('requests the documents, drive, and sheets-read OAuth scopes', () => {
@@ -207,6 +211,103 @@ describe('Google Docs endpoint routing (mocked HTTP)', () => {
 			expect(options).toMatchObject({ method: 'GET', url: '/documents/doc1' });
 		});
 
+		it('getDocument passes includeTabsContent when requested', async () => {
+			mockRequest.mockResolvedValue({ ...minimalDocument, tabs: [] });
+			await DocumentsEndpoints.getDocument(ctx, {
+				documentId: 'doc1',
+				includeTabsContent: true,
+			});
+
+			const { options } = lastCall();
+			expect(options.query).toEqual({ includeTabsContent: true });
+		});
+
+		it('getDocumentPlaintext reads a specific tab when tabIndex is set', async () => {
+			mockRequest.mockResolvedValue({
+				documentId: 'doc1',
+				title: 'Meet notes',
+				tabs: [
+					{
+						tabProperties: { tabId: 't0', title: 'Summary', index: 0 },
+						documentTab: {
+							body: {
+								content: [
+									{
+										paragraph: {
+											elements: [{ textRun: { content: 'short summary' } }],
+										},
+									},
+								],
+							},
+						},
+					},
+					{
+						tabProperties: { tabId: 't1', title: 'Transcript', index: 1 },
+						documentTab: {
+							body: {
+								content: [
+									{
+										paragraph: {
+											elements: [{ textRun: { content: 'long transcript' } }],
+										},
+									},
+								],
+							},
+						},
+					},
+				],
+			});
+			const result = await DocumentsEndpoints.getDocumentPlaintext(ctx, {
+				documentId: 'doc1',
+				tabIndex: 1,
+			});
+
+			expect(optionsQueryFromLastCall()).toEqual({ includeTabsContent: true });
+			expect(result.text).toBe('long transcript');
+			expect(result.tabId).toBe('t1');
+			expect(result.tabTitle).toBe('Transcript');
+		});
+
+		it('listDocumentTabs returns tab metadata without document bodies', async () => {
+			mockRequest.mockResolvedValue({
+				documentId: 'doc1',
+				title: 'Meet notes',
+				tabs: [
+					{
+						tabProperties: { tabId: 't0', title: 'Summary', index: 0 },
+						documentTab: { body: { content: [] } },
+						childTabs: [
+							{
+								tabProperties: {
+									tabId: 't0a',
+									title: 'Nested',
+									index: 0,
+									parentTabId: 't0',
+									nestingLevel: 1,
+								},
+								documentTab: { body: { content: [] } },
+							},
+						],
+					},
+				],
+			});
+			const result = await DocumentsEndpoints.listDocumentTabs(ctx, {
+				documentId: 'doc1',
+			});
+
+			expect(optionsQueryFromLastCall()).toEqual({ includeTabsContent: true });
+			expect(result.tabs).toEqual([
+				{ tabId: 't0', title: 'Summary', index: 0 },
+				{
+					tabId: 't0a',
+					title: 'Nested',
+					index: 0,
+					parentTabId: 't0',
+					nestingLevel: 1,
+				},
+			]);
+		});
+
 		it('getDocumentPlaintext flattens the fetched document body', async () => {
 			mockRequest.mockResolvedValue({
 				...minimalDocument,
```

**File**: `packages/googledocs/client.test.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import { extractPlainText, findTab, listTabSummaries } from './client';
+import type { Document } from './types';
+
+const multiTabDocument: Document = {
+	documentId: 'doc1',
+	tabs: [
+		{
+			tabProperties: { tabId: 'a', title: 'First', index: 0 },
+			documentTab: {
+				body: {
+					content: [
+						{
+							paragraph: {
+								elements: [{ textRun: { content: 'alpha' } }],
+							},
+						},
+					],
+				},
+			},
+		},
+		{
+			tabProperties: { tabId: 'b', title: 'Second', index: 1 },
+			documentTab: {
+				body: {
+					content: [
+						{
+							paragraph: {
+								elements: [{ textRun: { content: 'beta' } }],
+							},
+						},
+					],
+				},
+			},
+		},
+	],
+};
+
+describe('googledocs tab helpers', () => {
+	it('findTab resolves by tabIndex on root tabs', () => {
+		const tab = findTab(multiTabDocument, { tabIndex: 1 });
+		expect(tab?.tabProperties?.tabId).toBe('b');
+	});
+
+	it('extractPlainText reads a single tab', () => {
+		expect(extractPlainText(multiTabDocument, { tabId: 'b' })).toBe('beta');
+	});
+
+	it('extractPlainText concatenates all tabs when body is empty', () => {
+		const text = extractPlainText(multiTabDocument, { allTabs: true });
+		expect(text).toContain('alpha');
+		expect(text).toContain('beta');
+		expect(text).toContain('## First');
+	});
+
+	it('listTabSummaries walks nested tabs', () => {
+		const doc: Document = {
+			tabs: [
+				{
+					tabProperties: { tabId: 'root', title: 'Root', index: 0 },
+					childTabs: [
+						{
+							tabProperties: {
+								tabId: 'child',
+								title: 'Child',
+								index: 0,
+								parentTabId: 'root',
+								nestingLevel: 1,
+							},
+						},
+					],
+				},
+			],
+		};
+		expect(listTabSummaries(doc)).toEqual([
+			{ tabId: 'root', title: 'Root', index: 0 },
+			{
+				tabId: 'child',
+				title: 'Child',
+				index: 0,
+				parentTabId: 'root',
+				nestingLevel: 1,
+			},
+		]);
+	});
+});
```

**File**: `packages/googledocs/client.ts` (modified, +202/-17)
```diff
@@ -1,6 +1,12 @@
 import type { ApiRequestOptions, OpenAPIConfig } from 'corsair/http';
 import { request } from 'corsair/http';
-import type { BatchUpdateResponse, Document, StructuralElement } from './types';
+import type {
+	BatchUpdateResponse,
+	Document,
+	DocumentTabSummary,
+	StructuralElement,
+	Tab,
+} from './types';
 
 export class GoogleDocsAPIError extends Error {
 	constructor(
@@ -155,9 +161,145 @@ function flattenStructuralElements(elements: StructuralElement[]): string {
 	return lines.join('\n');
 }
 
-export function extractPlainText(document: Document): string {
-	const bodyText = flattenStructuralElements(document.body?.content ?? []);
-	return bodyText.replace(/\n{3,}/g, '\n\n').trim();
+export type ExtractPlainTextOptions = {
+	tabId?: string;
+	tabTitle?: string;
+	/** Root-level tab index (see TabProperties.index). */
+	tabIndex?: number;
+	/** When document.tabs is populated, concatenate text from every tab. */
+	allTabs?: boolean;
+};
+
+function normalizePlainText(text: string): string {
+	return text.replace(/\n{3,}/g, '\n\n').trim();
+}
+
+function walkTabs(tabs: Tab[], visit: (tab: Tab) => void): void {
+	for (const tab of tabs) {
+		visit(tab);
+		if (tab.childTabs?.length) {
+			walkTabs(tab.childTabs, visit);
+		}
+	}
+}
+
+/** Find a tab by id, case-insensitive title, or root-level index (depth-first for id/title). */
+export function findTab(
+	document: Document,
+	criteria: { tabId?: string; tabTitle?: string; tabIndex?: number },
+): Tab | undefined {
+	if (!document.tabs?.length) {
+		return undefined;
+	}
+	if (criteria.tabIndex !== undefined) {
+		const roots = document.tabs;
+		const byProp = roots.find(
+			(tab) => tab.tabProperties?.index === criteria.tabIndex,
+		);
+		if (byProp) return byProp;
+		return roots[criteria.tabIndex];
+	}
+
+	const wantId = criteria.tabId;
+	const wantTitle = criteria.tabTitle?.trim().toLowerCase();
+	if (!wantId && !wantTitle) {
+		return undefined;
+	}
+
+	let match: Tab | undefined;
+	walkTabs(document.tabs, (tab) => {
+		if (match) return;
+		const props = tab.tabProperties;
+		if (wantId && props?.tabId === wantId) {
+			match = tab;
+			return;
+		}
+		if (wantTitle && props?.title?.trim().toLowerCase() === wantTitle) {
+			match = tab;
+		}
+	});
+	return match;
+}
+
+/** Flat list of tab metadata for agents (includes nested tabs). */
+export function listTabSummaries(document: Document): DocumentTabSummary[] {
+	if (!document.tabs?.length) {
+		return [];
+	}
+	const summaries: DocumentTabSummary[] = [];
+	walkTabs(document.tabs, (tab) => {
+		const tabId = tab.tabProperties?.tabId;
+		if (!tabId) return;
+		summaries.push({
+			tabId,
+			title: tab.tabProperties?.title,
+			index: tab.tabProperties?.index,
+			parentTabId: tab.tabProperties?.parentTabId,
+			nestingLevel: tab.tabProperties?.nestingLevel,
+		});
+	});
+	return summaries;
+}
+
+function extractPlainTextFromBody(document: Document): string {
+	return flattenStructuralElements(document.body?.content ?? []);
+}
+
+function extractPlainTextFromTab(tab: Tab): string {
+	return flattenStructuralElements(tab.documentTab?.body?.content ?? []);
+}
+
+export function extractPlainText(
+	document: Document,
+	options?: ExtractPlainTextOptions,
+): string {
+	if (options?.tabId || options?.tabTitle || options?.tabIndex !== undefined) {
+		const tab = findTab(document, {
+			tabId: options.tabId,
+			tabTitle: options.tabTitle,
+			tabIndex: options.tabIndex,
+		});
+		if (!tab) {
+			const hint =
+				options.tabId !== undefined
+					? `tabId "${options.tabId}"`
+					: options.tabTitle !== undefined
+						? `tabTitle "${options.tabTitle}"`
+						: `tabIndex ${options.tabIndex}`;
+			throw new Error(
+				`[googledocs] No tab matching ${hint}. Call documents.listDocumentTabs or pass includeTabsContent on getDocumentPlaintext.`,
+			);
+		}
+		return normalizePlainText(extractPlainTextFromTab(tab));
+	}
+
+	if (options?.allTabs && document.tabs?.length) {
+		const parts: string[] = [];
+		walkTabs(document.tabs, (tab) => {
+			const chunk = extractPlainTextFromTab(tab);
+			if (chunk) {
+				const label = tab.tabProperties?.title?.trim();
+				parts.push(label ? `## ${label}\n${chunk}` : chunk);
+			}
+		});
+		return normalizePlainText(parts.join('\n\n'));
+	}
+
+	// includeTabsContent=true leaves top-level body empty; fall back to tabs.
+	if (document.tabs?.length && !document.body?.content?.length) {
+		return extractPlainText(document, { allTabs: true });
+	}
+
+	return normalizePlainText(extractPlainTextFromBody(document));
+}
+
+export function documentGetQuery(options?: {
+	includeTabsContent?: boolean;
+}): Record<string, string | boolean | undefined> {
+	if (options?.includeTabsContent) {
+		return { includeTabsContent: true };
+	}
+	return {};
 }
 
 export function countWords(text: string): number {
@@ -175,25 +317,68 @@ export type DocumentStructure = {
 	namedRanges: number;
 };
 
-export function summarizeStructure(document: Document): DocumentStructure
```

**File**: `packages/googledocs/endpoints/documents.ts` (modified, +89/-7)
```diff
@@ -3,7 +3,10 @@ import {
 	countWords,
 	DOCS_API_BASE,
 	DRIVE_API_BASE,
+	documentGetQuery,
 	extractPlainText,
+	findTab,
+	listTabSummaries,
 	makeAuthenticatedGoogleRequest,
 	runBatchUpdate,
 	summarizeStructure,
@@ -83,6 +86,36 @@ function documentEndIndex(document: Document): number {
 	return last?.endIndex ?? 1;
 }
 
+function wantsTabContent(input: {
+	includeTabsContent?: boolean;
+	tabId?: string;
+	tabTitle?: string;
+	tabIndex?: number;
+}): boolean {
+	return Boolean(
+		input.includeTabsContent ||
+			input.tabId ||
+			input.tabTitle ||
+			input.tabIndex !== undefined,
+	);
+}
+
+async function fetchDocumentResource(
+	ctx: Parameters<GoogleDocsEndpoints['getDocument']>[0],
+	documentId: string,
+	options?: { includeTabsContent?: boolean },
+): Promise<Document> {
+	return makeAuthenticatedGoogleRequest<Document>(
+		DOCS_API_BASE,
+		`/documents/${documentId}`,
+		ctx,
+		{
+			method: 'GET',
+			query: documentGetQuery(options),
+		},
+	);
+}
+
 // ─────────────────────────────────────────────────────────────────────────────
 // documents
 // ─────────────────────────────────────────────────────────────────────────────
@@ -197,9 +230,9 @@ export const getDocument: GoogleDocsEndpoints['getDocument'] = async (
 	ctx,
 	input,
 ) => {
-	const document = await makeAuthenticatedGoogleRequest<
-		GoogleDocsEndpointOutputs['getDocument']
-	>(DOCS_API_BASE, `/documents/${input.documentId}`, ctx, { method: 'GET' });
+	const document = await fetchDocumentResource(ctx, input.documentId, {
+		includeTabsContent: input.includeTabsContent,
+	});
 
 	await persistDocument(ctx, document);
 	await logEventFromContext(
@@ -213,16 +246,41 @@ export const getDocument: GoogleDocsEndpoints['getDocument'] = async (
 
 export const getDocumentPlaintext: GoogleDocsEndpoints['getDocumentPlaintext'] =
 	async (ctx, input) => {
-		const document = await makeAuthenticatedGoogleRequest<
-			GoogleDocsEndpointOutputs['getDocument']
-		>(DOCS_API_BASE, `/documents/${input.documentId}`, ctx, { method: 'GET' });
+		const targetingTab =
+			Boolean(input.tabId) ||
+			Boolean(input.tabTitle) ||
+			input.tabIndex !== undefined;
+		const includeTabsContent = wantsTabContent(input);
+		const document = await fetchDocumentResource(ctx, input.documentId, {
+			includeTabsContent,
+		});
+
+		const text = extractPlainText(document, {
+			tabId: input.tabId,
+			tabTitle: input.tabTitle,
+			tabIndex: input.tabIndex,
+			allTabs: includeTabsContent && !targetingTab,
+		});
+
+		let tabId: string | undefined = input.tabId;
+		let tabTitle: string | undefined;
+		if (targetingTab) {
+			const tab = findTab(document, {
+				tabId: input.tabId,
+				tabTitle: input.tabTitle,
+				tabIndex: input.tabIndex,
+			});
+			tabId = tab?.tabProperties?.tabId ?? input.tabId;
+			tabTitle = tab?.tabProperties?.title;
+		}
 
-		const text = extractPlainText(document);
 		const result = {
 			documentId: input.documentId,
 			title: document.title,
 			text,
 			wordCount: countWords(text),
+			...(tabId ? { tabId } : {}),
+			...(tabTitle ? { tabTitle } : {}),
 		};
 
 		await persistDocument(ctx, document);
@@ -235,6 +293,29 @@ export const getDocumentPlaintext: GoogleDocsEndpoints['getDocumentPlaintext'] =
 		return result;
 	};
 
+export const listDocumentTabs: GoogleDocsEndpoints['listDocumentTabs'] = async (
+	ctx,
+	input,
+) => {
+	const document = await fetchDocumentResource(ctx, input.documentId, {
+		includeTabsContent: true,
+	});
+
+	const result = {
+		documentId: input.documentId,
+		title: document.title,
+		tabs: listTabSummaries(document),
+	};
+
+	await logEventFromContext(
+		ctx,
+		'googledocs.documents.listDocumentTabs',
+		{ ...input },
+		'completed',
+	);
+	return result;
+};
+
 export const updateDocumentMarkdown: GoogleDocsEndpoints['updateDocumentMarkdown'] =
 	async (ctx, input) => {
 		const document = await makeAuthenticatedGoogleRequest<
@@ -478,6 +559,7 @@ export const DocumentsEndpoints = {
 	copyDocument,
 	getDocument,
 	getDocumentPlaintext,
+	listDocumentTabs,
 	updateDocumentMarkdown,
 	updateDocumentSectionMarkdown,
 	updateDocumentStyle,
```

**File**: `packages/googledocs/endpoints/index.ts` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ export const DocumentsEndpoints = {
 	copyDocument: Documents.copyDocument,
 	getDocument: Documents.getDocument,
 	getDocumentPlaintext: Documents.getDocumentPlaintext,
+	listDocumentTabs: Documents.listDocumentTabs,
 	updateDocumentMarkdown: Documents.updateDocumentMarkdown,
 	updateDocumentSectionMarkdown: Documents.updateDocumentSectionMarkdown,
 	updateDocumentStyle: Documents.updateDocumentStyle,
```

**File**: `packages/googledocs/endpoints/types.ts` (modified, +39/-0)
```diff
@@ -2,6 +2,7 @@ import { z } from 'zod';
 import type {
 	BatchUpdateResponse,
 	Document,
+	DocumentTabSummary,
 	DriveFile,
 	DriveFileList,
 	SpreadsheetChartsResponse,
@@ -66,12 +67,25 @@ const CopyDocumentInputSchema = z.object({
 	parents: z.array(z.string()).optional(),
 });
 
+const TabSelectorFields = {
+	includeTabsContent: z.boolean().optional(),
+	tabId: z.string().optional(),
+	tabTitle: z.string().optional(),
+	tabIndex: z.number().int().nonnegative().optional(),
+};
+
 const GetDocumentInputSchema = z.object({
 	documentId: z.string(),
+	includeTabsContent: z.boolean().optional(),
 });
 
 const GetDocumentPlaintextInputSchema = z.object({
 	documentId: z.string(),
+	...TabSelectorFields,
+});
+
+const ListDocumentTabsInputSchema = z.object({
+	documentId: z.string(),
 });
 
 const UpdateDocumentMarkdownInputSchema = z.object({
@@ -293,6 +307,7 @@ export const GoogleDocsEndpointInputSchemas = {
 	copyDocument: CopyDocumentInputSchema,
 	getDocument: GetDocumentInputSchema,
 	getDocumentPlaintext: GetDocumentPlaintextInputSchema,
+	listDocumentTabs: ListDocumentTabsInputSchema,
 	updateDocumentMarkdown: UpdateDocumentMarkdownInputSchema,
 	updateDocumentSectionMarkdown: UpdateDocumentSectionMarkdownInputSchema,
 	updateDocumentStyle: UpdateDocumentStyleInputSchema,
@@ -352,6 +367,21 @@ const DocumentSchema = z.object({
 	lists: z.unknown().optional(),
 	documentStyle: z.unknown().optional(),
 	suggestionsViewMode: z.string().optional(),
+	tabs: z.unknown().optional(),
+});
+
+const DocumentTabSummarySchema = z.object({
+	tabId: z.string(),
+	title: z.string().optional(),
+	index: z.number().optional(),
+	parentTabId: z.string().optional(),
+	nestingLevel: z.number().optional(),
+});
+
+const ListDocumentTabsResultSchema = z.object({
+	documentId: z.string(),
+	title: z.string().optional(),
+	tabs: z.array(DocumentTabSummarySchema),
 });
 
 const BatchUpdateResponseSchema = z.object({
@@ -405,6 +435,8 @@ const PlaintextResultSchema = z.object({
 	title: z.string().optional(),
 	text: z.string(),
 	wordCount: z.number(),
+	tabId: z.string().optional(),
+	tabTitle: z.string().optional(),
 });
 
 const ExportResultSchema = z.object({
@@ -420,6 +452,7 @@ export const GoogleDocsEndpointOutputSchemas = {
 	copyDocument: DriveFileSchema,
 	getDocument: DocumentSchema,
 	getDocumentPlaintext: PlaintextResultSchema,
+	listDocumentTabs: ListDocumentTabsResultSchema,
 	updateDocumentMarkdown: BatchUpdateResponseSchema,
 	updateDocumentSectionMarkdown: BatchUpdateResponseSchema,
 	updateDocumentStyle: BatchUpdateResponseSchema,
@@ -453,6 +486,11 @@ export const GoogleDocsEndpointOutputSchemas = {
 } as const;
 
 export type PlaintextResult = z.infer<typeof PlaintextResultSchema>;
+export type ListDocumentTabsResult = {
+	documentId: string;
+	title?: string;
+	tabs: DocumentTabSummary[];
+};
 export type ExportResult = z.infer<typeof ExportResultSchema>;
 
 export type GoogleDocsEndpointOutputs = {
@@ -462,6 +500,7 @@ export type GoogleDocsEndpointOutputs = {
 	copyDocument: DriveFile;
 	getDocument: Document;
 	getDocumentPlaintext: PlaintextResult;
+	listDocumentTabs: ListDocumentTabsResult;
 	updateDocumentMarkdown: BatchUpdateResponse;
 	updateDocumentSectionMarkdown: BatchUpdateResponse;
 	updateDocumentStyle: BatchUpdateResponse;
```

**File**: `packages/googledocs/index.ts` (modified, +9/-2)
```diff
@@ -174,11 +174,18 @@ const googledocsEndpointMeta = {
 	},
 	'documents.getDocument': {
 		riskLevel: 'read',
-		description: 'Retrieve a Google Doc by id',
+		description:
+			'Retrieve a Google Doc by id (set includeTabsContent for multi-tab documents)',
 	},
 	'documents.getDocumentPlaintext': {
 		riskLevel: 'read',
-		description: 'Retrieve a Google Doc as best-effort plain text',
+		description:
+			'Retrieve a Google Doc as plain text; optional tabId, tabTitle, or tabIndex for a specific tab',
+	},
+	'documents.listDocumentTabs': {
+		riskLevel: 'read',
+		description:
+			'List tab id, title, and hierarchy for a Google Doc (includes nested tabs)',
 	},
 	'documents.updateDocumentMarkdown': {
 		riskLevel: 'write',
```

**File**: `packages/googledocs/types.ts` (modified, +36/-0)
```diff
@@ -160,11 +160,47 @@ export type DocumentStyle = {
 	flipPageOrientation?: boolean;
 };
 
+export type TabProperties = {
+	tabId?: string;
+	title?: string;
+	index?: number;
+	parentTabId?: string;
+	nestingLevel?: number;
+};
+
+/** Text-bearing content of a single document tab. */
+export type DocumentTab = {
+	body?: Body;
+	headers?: Record<string, Header>;
+	footers?: Record<string, Footer>;
+	footnotes?: Record<string, Footnote>;
+	namedRanges?: Record<string, NamedRanges>;
+	inlineObjects?: Record<string, InlineObject>;
+	positionedObjects?: Record<string, unknown>;
+	lists?: Record<string, unknown>;
+	documentStyle?: DocumentStyle;
+};
+
+export type Tab = {
+	tabProperties?: TabProperties;
+	childTabs?: Tab[];
+	documentTab?: DocumentTab;
+};
+
+export type DocumentTabSummary = {
+	tabId: string;
+	title?: string;
+	index?: number;
+	parentTabId?: string;
+	nestingLevel?: number;
+};
+
 export type Document = {
 	documentId?: string;
 	title?: string;
 	revisionId?: string;
 	suggestionsViewMode?: string;
+	tabs?: Tab[];
 	body?: Body;
 	headers?: Record<string, Header>;
 	footers?: Record<string, Footer>;
```

---

### Incident Patch 13: `b3f1c2b6` (2026-09-30)
**Commit Message**: fix(twilio): split stored key on first colon only (#1792)

Co-authored-by: Maros Mamrak <[REDACTED_EMAIL]>

**File**: `packages/twilio/client.test.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import { getTwilioAuthToken } from './client';
+
+describe('getTwilioAuthToken', () => {
+	it('returns a plain token unchanged', () => {
+		expect(getTwilioAuthToken('token123')).toBe('token123');
+	});
+
+	it('returns the token part of sid:token', () => {
+		expect(getTwilioAuthToken('AC123:token123')).toBe('token123');
+	});
+
+	it('keeps colons inside the token', () => {
+		expect(getTwilioAuthToken('AC123:tok:en:123')).toBe('tok:en:123');
+	});
+});
```

**File**: `packages/twilio/client.ts` (modified, +10/-0)
```diff
@@ -14,6 +14,16 @@ export class TwilioAPIError extends Error {
 
 const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
 
+/**
+ * Extracts the auth token from a stored key, which is either a bare token or
+ * `accountSid:authToken`. Splits on the first colon only, so tokens that
+ * themselves contain colons are preserved.
+ */
+export function getTwilioAuthToken(key: string): string {
+	const separator = key.indexOf(':');
+	return separator === -1 ? key : key.slice(separator + 1);
+}
+
 export async function makeTwilioRequest<T>(
 	endpoint: string,
 	accountSid: string,
```

**File**: `packages/twilio/endpoints/auth-token.test.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import * as client from '../client';
+import { Calls, Messages } from './index';
+
+jest.mock('corsair/core', () => {
+	const actual =
+		jest.requireActual<typeof import('corsair/core')>('corsair/core');
+
+	return {
+		...actual,
+		logEventFromContext: jest.fn().mockResolvedValue(null),
+	};
+});
+
+jest.mock('../client', () => ({
+	...jest.requireActual<typeof import('../client')>('../client'),
+	makeTwilioRequest: jest.fn(),
+}));
+
+const mockedRequest = client.makeTwilioRequest as jest.MockedFunction<
+	typeof client.makeTwilioRequest
+>;
+
+const TOKEN_WITH_COLONS = 'tok:en:123';
+
+/**
+ * Minimal endpoint context. The six endpoints under test only read ctx.key,
+ * ctx.options, ctx.keys.get_accountSid, and ctx.db, so the stub provides
+ * exactly those. The full endpoint context type additionally carries
+ * database clients and key managers, hence the any below keeps this
+ * token-focused test decoupled from unrelated infrastructure types.
+ */
+const ctx = {
+	key: `AC123:${TOKEN_WITH_COLONS}`,
+	options: {},
+	keys: { get_accountSid: jest.fn().mockResolvedValue(null) },
+	db: {},
+} as any;
+
+// Inputs carry only the fields each handler reads. Full zod-valid inputs
+// would couple this token test to unrelated endpoint validation, hence any.
+// Each case is an opaque invocation thunk: only the arguments it records
+// on the mocked request matter, so the resolved payload stays unknown.
+const cases: [string, () => Promise<unknown>][] = [
+	[
+		'messages.send',
+		() => Messages.send(ctx, { To: '+1', From: '+2', Body: 'hi' } as any),
+	],
+	['messages.get', () => Messages.get(ctx, { messageSid: 'SM1' } as any)],
+	['messages.list', () => Messages.list(ctx, {} as any)],
+	['calls.create', () => Calls.create(ctx, { To: '+1', From: '+2' } as any)],
+	['calls.get', () => Calls.get(ctx, { callSid: 'CA1' } as any)],
+	['calls.list', () => Calls.list(ctx, {} as any)],
+];
+
+describe('Twilio endpoints auth token', () => {
+	beforeEach(() => {
+		jest.clearAllMocks();
+		// Outputs are irrelevant here: assertions target the request
+		// arguments, so the mocked response is an empty payload cast onward.
+		mockedRequest.mockResolvedValue({} as never);
+	});
+
+	it.each(cases)(
+		'%s sends the full token when it contains colons',
+		async (_, call) => {
+			await call();
+
+			expect(mockedRequest).toHaveBeenCalledTimes(1);
+			const recorded = mockedRequest.mock.calls[0];
+			if (!recorded) {
+				throw new Error('expected makeTwilioRequest to be called once');
+			}
+			const [, accountSid, authToken] = recorded;
+			expect(accountSid).toBe('AC123');
+			expect(authToken).toBe(TOKEN_WITH_COLONS);
+		},
+	);
+});
```

**File**: `packages/twilio/endpoints/calls.ts` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
 import { logEventFromContext } from 'corsair/core';
-import { makeTwilioRequest } from '../client';
+import { getTwilioAuthToken, makeTwilioRequest } from '../client';
 import type { TwilioEndpoints } from '../index';
 import type { TwilioEndpointOutputs } from './types';
 
@@ -9,7 +9,7 @@ export const create: TwilioEndpoints['callsCreate'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['callsCreate']
@@ -53,7 +53,7 @@ export const get: TwilioEndpoints['callsGet'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<TwilioEndpointOutputs['callsGet']>(
 		`Accounts/${accountSid}/Calls/${input.callSid}.json`,
@@ -72,7 +72,7 @@ export const list: TwilioEndpoints['callsList'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<TwilioEndpointOutputs['callsList']>(
 		`Accounts/${accountSid}/Calls.json`,
```

**File**: `packages/twilio/endpoints/messages.ts` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
 import { logEventFromContext } from 'corsair/core';
-import { makeTwilioRequest } from '../client';
+import { getTwilioAuthToken, makeTwilioRequest } from '../client';
 import type { TwilioEndpoints } from '../index';
 import type { TwilioEndpointOutputs } from './types';
 
@@ -9,7 +9,7 @@ export const send: TwilioEndpoints['messagesSend'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesSend']
@@ -52,7 +52,7 @@ export const get: TwilioEndpoints['messagesGet'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesGet']
@@ -78,7 +78,7 @@ export const list: TwilioEndpoints['messagesList'] = async (ctx, input) => {
 		(await ctx.keys.get_accountSid()) ??
 		ctx.key.split(':')[0] ??
 		'';
-	const authToken = ctx.key.includes(':') ? ctx.key.split(':')[1]! : ctx.key;
+	const authToken = getTwilioAuthToken(ctx.key);
 
 	const response = await makeTwilioRequest<
 		TwilioEndpointOutputs['messagesList']
```

---

### Incident Patch 14: `003e9fd5` (2026-09-30)
**Commit Message**: fix(www): guard invalid dates and add year unit to formatRelativeTime (#1801)

**File**: `www/src/app/oss/relative-time.test.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+import assert from 'node:assert/strict';
+import { describe, it } from 'node:test';
+
+import { formatRelativeTime } from './relative-time';
+
+const NOW = Date.parse('2026-09-29T12:00:00.000Z');
+
+function secondsAgo(seconds: number): string {
+	return new Date(NOW - seconds * 1000).toISOString();
+}
+
+describe('formatRelativeTime', () => {
+	it('renders an em dash for invalid dates instead of NaNmo ago', () => {
+		assert.equal(formatRelativeTime('not-a-date', NOW), '—');
+		assert.equal(formatRelativeTime('', NOW), '—');
+		assert.equal(formatRelativeTime('2026-13-45', NOW), '—');
+	});
+
+	it('says just now for brand new and future timestamps', () => {
+		assert.equal(formatRelativeTime(secondsAgo(0), NOW), 'just now');
+		assert.equal(formatRelativeTime(secondsAgo(-5), NOW), 'just now');
+		assert.equal(
+			formatRelativeTime(new Date(NOW + 86_400_000).toISOString(), NOW),
+			'just now',
+		);
+	});
+
+	it('steps through each unit at its boundary', () => {
+		assert.equal(formatRelativeTime(secondsAgo(1), NOW), '1s ago');
+		assert.equal(formatRelativeTime(secondsAgo(59), NOW), '59s ago');
+		assert.equal(formatRelativeTime(secondsAgo(60), NOW), '1m ago');
+		assert.equal(formatRelativeTime(secondsAgo(3599), NOW), '59m ago');
+		assert.equal(formatRelativeTime(secondsAgo(3600), NOW), '1h ago');
+		assert.equal(formatRelativeTime(secondsAgo(86_399), NOW), '23h ago');
+		assert.equal(formatRelativeTime(secondsAgo(86_400), NOW), '1d ago');
+		assert.equal(formatRelativeTime(secondsAgo(604_799), NOW), '6d ago');
+		assert.equal(formatRelativeTime(secondsAgo(604_800), NOW), '1w ago');
+		assert.equal(formatRelativeTime(secondsAgo(2_629_799), NOW), '4w ago');
+		assert.equal(formatRelativeTime(secondsAgo(2_629_800), NOW), '1mo ago');
+		assert.equal(formatRelativeTime(secondsAgo(31_535_999), NOW), '11mo ago');
+		assert.equal(formatRelativeTime(secondsAgo(31_536_000), NOW), '1y ago');
+	});
+
+	it('renders years for old timestamps instead of runaway months', () => {
+		assert.equal(formatRelativeTime(secondsAgo(800 * 86_400), NOW), '2y ago');
+		assert.equal(formatRelativeTime(secondsAgo(365 * 86_400), NOW), '1y ago');
+	});
+
+	it('keeps using the default clock when now is omitted', (t) => {
+		t.mock.method(Date, 'now', () => NOW);
+		assert.equal(formatRelativeTime(secondsAgo(30)), '30s ago');
+	});
+});
```

**File**: `www/src/app/oss/relative-time.ts` (modified, +16/-7)
```diff
@@ -1,22 +1,31 @@
+const MONTH_SECONDS = 2_629_800; // average Gregorian month (30.44 days)
+const YEAR_SECONDS = 31_536_000; // 365 days
+
 const UNITS: Array<{ limit: number; divisor: number; suffix: string }> = [
 	{ limit: 60, divisor: 1, suffix: 's' },
 	{ limit: 3600, divisor: 60, suffix: 'm' },
 	{ limit: 86400, divisor: 3600, suffix: 'h' },
 	{ limit: 604800, divisor: 86400, suffix: 'd' },
-	{ limit: 2629800, divisor: 604800, suffix: 'w' },
+	{ limit: MONTH_SECONDS, divisor: 604800, suffix: 'w' },
+	{ limit: YEAR_SECONDS, divisor: MONTH_SECONDS, suffix: 'mo' },
 ];
 
 export function formatRelativeTime(iso: string, now = Date.now()): string {
-	const seconds = Math.max(
-		0,
-		Math.floor((now - new Date(iso).getTime()) / 1000),
-	);
+	const timestamp = new Date(iso).getTime();
+	if (!Number.isFinite(timestamp)) {
+		return '—';
+	}
+
+	const seconds = Math.floor((now - timestamp) / 1000);
+	if (seconds < 1) {
+		return 'just now';
+	}
 
 	for (const unit of UNITS) {
 		if (seconds < unit.limit) {
-			return `${Math.max(1, Math.floor(seconds / unit.divisor))}${unit.suffix} ago`;
+			return `${Math.floor(seconds / unit.divisor)}${unit.suffix} ago`;
 		}
 	}
 
-	return `${Math.floor(seconds / 2629800)}mo ago`;
+	return `${Math.floor(seconds / YEAR_SECONDS)}y ago`;
 }
```

---

### Incident Patch 15: `2576d96c` (2026-09-29)
**Commit Message**: fix(twilio): throw AuthMissingError when credentials are missing (#1793)

**File**: `packages/twilio/index.ts` (modified, +11/-4)
```diff
@@ -14,6 +14,7 @@ import type {
 	RequiredPluginEndpointSchemas,
 	RequiredPluginWebhookSchemas,
 } from 'corsair/core';
+import { AuthMissingError } from 'corsair/core';
 import { Calls, Messages } from './endpoints';
 import type {
 	TwilioEndpointInputs,
@@ -286,9 +287,12 @@ export function twilio<const T extends TwilioPluginOptions>(
 				}
 				if (ctx.authType === 'api_key') {
 					const apiKey = await ctx.keys.get_api_key();
-					return apiKey ?? '';
+					if (!apiKey) {
+						throw new AuthMissingError('twilio', 'api_key');
+					}
+					return apiKey;
 				}
-				return '';
+				throw new AuthMissingError('twilio', 'api_key');
 			}
 
 			if (source === 'endpoint' && options.key) {
@@ -297,10 +301,13 @@ export function twilio<const T extends TwilioPluginOptions>(
 
 			if (source === 'endpoint' && ctx.authType === 'api_key') {
 				const res = await ctx.keys.get_api_key();
-				return res ?? '';
+				if (!res) {
+					throw new AuthMissingError('twilio', 'api_key');
+				}
+				return res;
 			}
 
-			return '';
+			throw new AuthMissingError('twilio', 'api_key');
 		},
 	} satisfies InternalTwilioPlugin;
 }
```

**File**: `packages/twilio/key-builder.test.ts` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+import { AuthMissingError } from 'corsair/core';
+import type { TwilioKeyBuilderContext, TwilioPluginOptions } from './index';
+import { twilio } from './index';
+
+type KeySource = 'endpoint' | 'webhook';
+
+/** Minimal in-memory credential values backing the stub key manager. */
+type KeyStore = {
+	apiKey: string | null;
+	webhookSignature: string | null;
+};
+
+const emptyStore = (): KeyStore => ({ apiKey: null, webhookSignature: null });
+
+/**
+ * Stub account key manager. keyBuilder only reads get_api_key and
+ * get_webhook_signature; the remaining methods satisfy the typed
+ * manager contract so no cast is needed.
+ */
+function stubKeys(store: KeyStore): TwilioKeyBuilderContext['keys'] {
+	const ignoreSetter = async (): Promise<void> => undefined;
+	return {
+		get_dek: async () => 'test-dek',
+		issue_new_dek: async () => 'test-dek',
+		get_api_key: async () => store.apiKey,
+		set_api_key: ignoreSetter,
+		get_webhook_signature: async () => store.webhookSignature,
+		set_webhook_signature: ignoreSetter,
+		get_accountSid: async () => null,
+		set_accountSid: ignoreSetter,
+	};
+}
+
+/** Minimal keyBuilder context: api_key auth, default tenant, stubbed keys. */
+function stubCtx(
+	store: KeyStore,
+	options: TwilioPluginOptions = {},
+): TwilioKeyBuilderContext {
+	return {
+		authType: 'api_key',
+		options,
+		keys: stubKeys(store),
+		tenantId: 'default',
+	};
+}
+
+async function resolveKey(
+	plugin: ReturnType<typeof twilio>,
+	ctx: TwilioKeyBuilderContext,
+	source: KeySource,
+): Promise<string> {
+	const build = plugin.keyBuilder;
+	if (!build) {
+		throw new Error('twilio plugin must define keyBuilder');
+	}
+	return build(ctx, source);
+}
+
+describe('twilio keyBuilder authentication', () => {
+	const plugin = twilio();
+
+	it('throws AuthMissingError for endpoint source when api key is absent', async () => {
+		await expect(
+			resolveKey(plugin, stubCtx(emptyStore()), 'endpoint'),
+		).rejects.toBeInstanceOf(AuthMissingError);
+	});
+
+	it('throws AuthMissingError for webhook source when credentials are absent', async () => {
+		await expect(
+			resolveKey(plugin, stubCtx(emptyStore()), 'webhook'),
+		).rejects.toBeInstanceOf(AuthMissingError);
+	});
+
+	it('never returns an empty key — that would build Accounts//Messages.json', async () => {
+		// Regression guard for the original bug: an empty string flowed into
+		// endpoint URL building and produced a confusing transport 401.
+		const out = await resolveKey(
+			plugin,
+			stubCtx(emptyStore()),
+			'endpoint',
+		).then(
+			(key) => key,
+			() => null,
+		);
+		expect(out).not.toBe('');
+	});
+
+	it('reports twilio / api_key on the thrown error', async () => {
+		// The rejection value carries no static type, so it stays unknown
+		// here until instanceof narrows it to AuthMissingError below.
+		const err: unknown = await resolveKey(
+			plugin,
+			stubCtx(emptyStore()),
+			'endpoint',
+		).catch((e: unknown) => e);
+
+		expect(err).toBeInstanceOf(AuthMissingError);
+		if (!(err instanceof AuthMissingError)) {
+			throw new Error('expected AuthMissingError');
+		}
+		expect(err.pluginId).toBe('twilio');
+		expect(err.authType).toBe('api_key');
+	});
+
+	it('returns options.key for endpoint source', async () => {
+		const withOptionsKey = twilio({ key: 'test-auth-token' });
+		const out = await resolveKey(
+			withOptionsKey,
+			stubCtx(emptyStore()),
+			'endpoint',
+		);
+		expect(out).toBe('test-auth-token');
+	});
+
+	it('reads api key from the key manager for endpoint source', async () => {
+		const ctx = stubCtx({ apiKey: 'test-api-key', webhookSignature: null });
+
+		await expect(resolveKey(plugin, ctx, 'endpoint')).resolves.toBe(
+			'test-api-key',
+		);
+	});
+
+	it('prefers options.webhookSecret for webhook source', async () => {
+		const withSecret = twilio({ webhookSecret: 'test-webhook-secret' });
+		const out = await resolveKey(withSecret, stubCtx(emptyStore()), 'webhook');
+		expect(out).toBe('test-webhook-secret');
+	});
+
+	it('falls back to the stored webhook signature', async () => {
+		const ctx = stubCtx({ apiKey: null, webhookSignature: 'test-signature' });
+
+		await expect(resolveKey(plugin, ctx, 'webhook')).resolves.toBe(
+			'test-signature',
+		);
+	});
+
+	it('falls back to the api key for webhook signature verification', async () => {
+		const ctx = stubCtx({ apiKey: 'test-api-key', webhookSignature: null });
+
+		await expect(resolveKey(plugin, ctx, 'webhook')).resolves.toBe(
+			'test-api-key',
+		);
+	});
+});
```

#### Recent Merged Pull Requests:
- **PR #1825** (2026-10-03): fix(zendesk): remove generator example webhook (@NishilRathod)
- **PR #1824** (2026-10-03): fix(cli): validate --port in the ui command (@MarceloAdan73)
- **PR #1823** (2026-10-03): feat(reducto): add plugin (@Dhirenderchoudhary)
- **PR #1822** (2026-10-04): fix (mailtrap): throw AuthMissingError when API key is missing (@valdovinusjr-code)
- **PR #1821** (2026-10-04): fix(spotify): remove generator example webhook (@sahiljadhav7)
- **PR #1820** (2026-10-04): fix(toggl): throw AuthMissingError when api key is missing (@DeepanshuPal)
- **PR #1818** (2026-10-04): fix(wakatime): throw AuthMissingError when the API key is missing (@DeepanshuPal)
- **PR #1817** (closed): fix(spotify): remove generator example webhook (@sahiljadhav7)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
