> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sindresorhus-got-learnings.md`  
> **Source**: github ([https://github.com/sindresorhus/got](https://github.com/sindresorhus/got))  
> **Source Version**: `05b44769`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T23:53:46.023Z  
> **Learning ID**: `learn-github-sindresorhus-got`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sindresorhus/got

> **Canonical Artifact**: `07_PROJECT_LEARNING/sindresorhus-got-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sindresorhus/got](https://github.com/sindresorhus/got))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T23:53:44.850Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sindresorhus/got`
- **Description**: 🌐 Human-friendly and powerful HTTP request library for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 14952 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `source/core/calculate-retry-delay.ts`
```
import type {RetryFunction} from './options.js';

type Returns<T extends (...arguments_: any) => unknown, V> = (...arguments_: Parameters<T>) => V;

const calculateRetryDelay: Returns<RetryFunction, number> = ({
	attemptCount,
	retryOptions,
	error,
	retryAfter,
	computedValue,
}) => {
	if (error.name === 'RetryError') {
		return 1;
	}

	if (attemptCount > retryOptions.limit) {
		return 0;
	}

	const hasMethod = retryOptions.methods.includes(error.options.method);
	const hasErrorCode = retryOptions.errorCodes.includes(error.code);
	const hasStatusCode = error.response && retryOptions.statusCodes.includes(error.response.statusCode);
	if (!hasMethod || (!hasErrorCode && !hasStatusCode)) {
		return 0;
	}

	if (error.response) {
		if (retryAfter !== undefined) {
			// In this case `computedValue` is `retryOptions.maxRetryAfter ?? options.timeout.request ?? Infinity`
			// Compare the server delay before applying the minimum nonzero retry timer.
			return retryAfter > computedValue ? 0 : Math.max(1, retryAfter);
		}

		if (error.response.statusCode === 413) {
			return 0;
		}
	}

	const noise = Math.random() * retryOptions.noise;
	// Zero disables retries, so represent an immediate retry with the minimum timer delay.
	return Math.max(1, Math.min(((2 ** (attemptCount - 1)) * 1000), retryOptions.backoffLimit) + noise);
};

export default calculateRetryDelay;

```

### Core Architecture Module: `source/core/diagnostics-channel.ts`
```
import {randomUUID} from 'node:crypto';
import diagnosticsChannel from 'node:diagnostics_channel';
import type {Timings} from './utils/timer.js';
import type {RequestError} from './errors.js';

const channels = {
	requestCreate: diagnosticsChannel.channel('got:request:create'),
	requestStart: diagnosticsChannel.channel('got:request:start'),
	responseStart: diagnosticsChannel.channel('got:response:start'),
	responseEnd: diagnosticsChannel.channel('got:response:end'),
	retry: diagnosticsChannel.channel('got:request:retry'),
	error: diagnosticsChannel.channel('got:request:error'),
	redirect: diagnosticsChannel.channel('got:response:redirect'),
};

export type RequestId = string;

/**
Message for the `got:request:create` diagnostic channel.

Emitted when a request is created.
*/
export type DiagnosticRequestCreate = {
	requestId: RequestId;
	url: string;
	method: string;
};

/**
Message for the `got:request:start` diagnostic channel.

Emitted before the native HTTP request is sent.
*/
export type DiagnosticRequestStart = {
	requestId: RequestId;
	url: string;
	method: string;
	headers: Record<string, string | string[] | undefined>;
};

/**
Message for the `got:response:start` diagnostic channel.

Emitted when response headers are received.
*/
export type DiagnosticResponseStart = {
	requestId: RequestId;
	url: string;
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	isFromCache: boolean;
};

/**
Message for the `got:response:end` diagnostic channel.

Emitted when the response completes.
*/
export type DiagnosticResponseEnd = {
	requestId: RequestId;
	url: string;
	statusCode: number;
	bodySize?: number;
	timings?: Timings;
};

/**
Message for the `got:request:retry` diagnostic channel.

Emitted when retrying a request.
*/
export type DiagnosticRequestRetry = {
	requestId: RequestId;
	retryCount: number;
	error: RequestError;
	delay: number;
};

/**
Message for the `got:request:error` diagnostic channel.

Emitted when a request fails.

The error can be replaced by a `beforeError` hook. Use `error instanceof RequestError` before accessing Got-specific properties.
*/
export type DiagnosticRequestError = {
	requestId: RequestId;
	url: string;
	error: Error;
	timings?: Timings;
};

/**
Message for the `got:response:redirect` diagnostic channel.

Emitted when following a redirect.
*/
export type DiagnosticResponseRedirect = {
	requestId: RequestId;
	fromUrl: string;
	toUrl: string;
	statusCode: number;
};

export function generateRequestId(): RequestId {
	return randomUUID();
}

const publishToChannel = (channel: diagnosticsChannel.Channel, message: unknown): void => {
	if (channel.hasSubscribers) {
		channel.publish(message);
	}
};

export function publishRequestCreate(message: DiagnosticRequestCreate): void {
	publishToChannel(channels.requestCreate, message);
}

export function publishRequestStart(message: DiagnosticRequestStart): void {
	publishToChannel(channels.requestStart, message);
}

export function publishResponseStart(message: DiagnosticResponseStart): void {
	publishToChannel(channels.responseStart, message);
}

export function publishResponseEnd(message: DiagnosticResponseEnd): void {
	publishToChannel(channels.responseEnd, message);
}

export function publishRetry(message: DiagnosticRequestRetry): void {
	publishToChannel(channels.retry, message);
}

export function publishError(message: DiagnosticRequestError): void {
	publishToChannel(channels.error, message);
}

export function publishRedirect(message: DiagnosticResponseRedirect): void {
	publishToChannel(channels.redirect, message);
}

```

### Core Architecture Module: `source/core/errors.ts`
```
import is from '@sindresorhus/is';
import stripUrlAuth from './utils/strip-url-auth.js';
import type {Timings} from './utils/timer.js';
import type Options from './options.js';
import type {TimeoutError as TimedOutTimeoutError} from './timed-out.js';
import type {PlainResponse, Response} from './response.js';
import type Request from './index.js';

type Error = NodeJS.ErrnoException;

export const normalizeError = (error: unknown): Error => {
	if (error instanceof globalThis.Error) {
		return error;
	}

	if (is.object(error)) {
		const errorLike = error as Partial<Error & {code?: string; input?: string}>;
		const message = typeof errorLike.message === 'string' ? errorLike.message : 'Non-error object thrown';
		const normalizedError = new globalThis.Error(message, {cause: error}) as Error & {code?: string; input?: string};

		if (typeof errorLike.stack === 'string') {
			normalizedError.stack = errorLike.stack;
		}

		if (typeof errorLike.code === 'string') {
			normalizedError.code = errorLike.code;
		}

		if (typeof errorLike.input === 'string') {
			normalizedError.input = errorLike.input;
		}

		return normalizedError;
	}

	return new globalThis.Error(String(error));
};

// A hacky check to prevent circular references.
function isRequest(x: unknown): x is Request {
	return is.object(x) && '_onResponse' in x;
}

/**
An error to be thrown when a request fails.
Contains a `code` property with error class code, like `ECONNREFUSED`.
*/
export class RequestError<T = unknown> extends Error {
	override name = 'RequestError';
	code = 'ERR_GOT_REQUEST_ERROR';
	input?: string;
	override stack!: string;
	declare readonly options: Options;
	readonly response?: Response<T>;
	readonly request?: Request;
	readonly timings?: Timings;

	constructor(message: string, error: Partial<Error & {code?: string}>, self: Request | Options, response?: PlainResponse) {
		super(message, {cause: error});

		// The stack is trimmed here so that the frames inside `got` do not appear in the trace the
		// caller sees. `unicorn/no-useless-error-capture-stack-trace` assumes the call is redundant
		// for a subclass of `Error`, which is not the case here.
		// eslint-disable-next-line unicorn/no-useless-error-capture-stack-trace
		Error.captureStackTrace(this, this.constructor);

		// The cause is kept as thrown, so it can be any value. Only an object can carry details.
		const errorLike = is.object(error) ? error as Error & {code?: string; input?: string; stack?: string} : undefined;

		if (errorLike?.code) {
			this.code = errorLike.code;
		}

		this.input = errorLike?.input;

		if (isRequest(self)) {
			Object.defineProperties(this, {
				request: {
					enumerable: false,
					value: self,
				},
				response: {
					enumerable: false,
					value: response ?? self.response,
				},
			});

			this.options = self.options;
		} else {
			this.options = self;
		}

		this.timings = this.request?.timings;

		// Recover the original stacktrace
		if (is.string(errorLike?.stack) && is.string(this.stack)) {
			// Both stacks start with a `name: message` header, and both headers are rebuilt below
			// by dropping everything before this point. A multi-line message spans several lines,
			// so the whole message is the boundary. A message that is empty or absent matches at
			// zero and would leave the header in the frames, so the first newline is the boundary.
			// A message that is not in its stack, such as one changed after the stack was read, has no
			// boundary at all.
			const frameStart = (stack: string, message: string | undefined): number => {
				if (!message) {
					return stack.indexOf('\n');
				}

				const messageStart = stack.indexOf(message);
				return messageStart === -1 ? -1 : messageStart + message.length;
			};

			const headerEnd = frameStart(this.stack, this.message);
			const thisStackTrace = (headerEnd === -1 ? '' : this.stack.slice(headerEnd)).split('\n').toReversed();
			const causeStart = frameStart(errorLike.stack, errorLike.message);
			const originalStack = is.string(errorLike.message) && causeStart !== -1
				? errorLike.stack.slice(causeStart)
				: `\n${errorLike.stack}`;
			const errorStackTrace = originalStack.split('\n').toReversed();

			// Remove duplicated traces
			while (errorStackTrace.length > 0 && errorStackTrace[0] === thisStackTrace[0]) {
				thisStackTrace.shift();
			}

			const frames = `${thisStackTrace.toReversed().join('\n')}${errorStackTrace.toReversed().join('\n')}`;
			let assignedStack: string | undefined;

			// A subclass sets `name` only after `super()` returns, so building the header here
			// would label every subclass as a plain `RequestError`. Read the names on access
			// instead, while still honouring an assigned stack the way `Error` does.
			Object.defineProperty(this, 'stack', {
				configurable: true,
				enumerable: false,
				get: () => assignedStack ?? `${this.name}: ${this.message}${frames}`,
				set(value: unknown) {
					assignedStack = is.string(value) ? value : undefined;
				},
			});
		}
	}
}

/**
An error to be thrown when the server redirects you more than ten times.
Includes a `response` property.
*/
export class MaxRedirectsError extends RequestError {
	override name = 'MaxRedirectsError';
	override code = 'ERR_TOO_MANY_REDIRECTS';
	declare readonly response: Response;
	declare readonly request: Request;

	constructor(request: Request) {
		super(`Redirected ${request.options.maxRedirects} times. Aborting.`, {}, request);
	}
}

/**
An error to be thrown when the server response code is not 2xx nor 3xx if `options.followRedirect` is `true`, but always except for 304.
Includes a `response` property.
*/
// eslint-disable-next-line @typescript-eslint/naming-convention
export class HTTPError<T = unknown> extends RequestError<T> {
	override name = 'HTTPError';
	override code = 'ERR_NON_2XX_3XX_RESPONSE';
	declare readonly response: Response<T>;
	declare readonly request: Request;

	constructor(response: PlainResponse) {
		super(`Request failed with status code ${response.statusCode} (${response.statusMessage!}): ${response.request.options.method} ${stripUrlAuth(response.request.options.url!)}`, {}, response.request, response);
	}
}

/**
An error to be thrown when a cache method fails.
For example, if the database goes down or there's a filesystem error.
*/
export class CacheError extends RequestError {
	override name = 'CacheError';
	override code = 'ERR_CACHE_ACCESS';
	declare readonly request: Request;

	constructor(error: Error, request: Request) {
		super(error.message, error, request);
	}
}

/**
An error to be thrown when the request body is a stream and an error occurs while reading from that stream.
*/
export class UploadError extends RequestError {
	override name = 'UploadError';
	override code = 'ERR_UPLOAD';
	declare readonly request: Request;

	constructor(error: Error, request: Request) {
		super(error.message, error, request);
	}
}

/**
An error to be thrown when the request is aborted due to a timeout.
Includes an `event` and `timings` property.
*/
export class TimeoutError extends RequestError {
	override name = 'TimeoutError';
	override code = 'ETIMEDOUT';
	declare readonly request: Request;
	override readonly timings: Timings;
	readonly event: string;

	constructor(error: TimedOutTimeoutError, timings: Timings, request: Request) {
		super(error.message, error, request);
		// `AbortSignal.timeout()` reports a `DOMException`, which names no phase.
		this.event = error.event ?? 'request';
		this.timings = timings;
	}
}

/**
An error to be thrown when reading from response stream fails.
*/
export class ReadError extends RequestError {
	override name = 'ReadError';
	override code = 'ERR_READING_RESPONSE_STREAM';
	declare readonly request: Request;
	declare readonly response: Response;

	constructor(error: Error, request: Request) {
		super(error.message, error, request);

		if (error.code === 'ECONNRESET' || error.code === 'ERR_HTTP_CONTENT_LENGTH_MISMATCH') {
			this.code = error.code;
		}
	}
}

/**
An error which always triggers a new retry when thrown.
*/
export class RetryError extends RequestError {
	override name = 'RetryError';
	override code = 'ERR_RETRYING';

	constructor(request: Request) {
		super('Retrying', {}, request);
	}
}

/**
An error to be thrown when the request is aborted by AbortController.
*/
export class AbortError extends RequestError {
	override name = 'AbortError';
	override code = 'ERR_ABORTED';

	constructor(request: Request) {
		super('This operation was aborted.', {}, request);
		if (request.options?.signal?.aborted) {
			this.cause = request.options.signal.reason;
		}
	}
}

```

### Core Architecture Module: `source/core/index.ts`
```
import process from 'node:process';
import {Buffer} from 'node:buffer';
import {Duplex, type Readable} from 'node:stream';
import {addAbortListener, errorMonitor} from 'node:events';
import http, {ServerResponse, type ClientRequest, type RequestOptions} from 'node:http';
import {Http2ServerResponse, constants as http2Constants} from 'node:http2';
import type {Socket} from 'node:net';
import {byteLength} from 'byte-counter';
import {chunk} from 'chunk-data';
import {concatUint8Arrays, stringToBase64, stringToUint8Array} from 'uint8array-extras';
import CacheableRequest, {
	CacheError as CacheableCacheError,
	type CacheableRequestFunction,
	type CacheableOptions,
} from 'cacheable-request';
import type {KeyvStoreAdapter} from 'keyv';
import type KeyvType from 'keyv';
import is, {isBuffer} from '@sindresorhus/is';
import type ResponseLike from 'responselike';
import timer, {type ClientRequestWithTimings, type Timings, type IncomingMessageWithTimings} from './utils/timer.js';
import decompressResponse from './utils/decompress-response.js';
import getBodySize from './utils/get-body-size.js';
import isNonReplayableBody from './utils/is-non-replayable-body.js';
import proxyEvents from './utils/proxy-events.js';
import timedOut, {TimeoutError as TimedOutTimeoutError, isArmableTimerDelay} from './timed-out.js';
import stripUrlAuth from './utils/strip-url-auth.js';
import WeakableMap from './utils/weakable-map.js';
import calculateRetryDelay from './calculate-retry-delay.js';
import Options, {
	assertUrlHasSameOriginAsPrefixUrlIfNeeded,
	crossOriginStripHeaders,
	getUrlPrefixBoundary,
	hasBodyOptionChanged,
	hasUrlOrPrefixUrlBoundaryChanged,
	hasExplicitCredentialInUrlChange,
	isBodyUnchanged,
	isCrossOriginCredentialChanged,
	isSameOrigin,
	snapshotCrossOriginState,
	type CrossOriginState,
	type PromiseCookieJar,
	type NativeRequestOptions,
	type RetryOptions,
	type OptionsError,
	type OptionsInit,
	type NormalizedOptions,
} from './options.js';
import {
	cacheDecodedBody,
	copyRedirectDecision,
	decodeUint8Array,
	isResponseOk,
	isUtf8Encoding,
	parseBody,
	type PlainResponse,
	type Response,
} from './response.js';
import isClientRequest from './utils/is-client-request.js';
import {getUnixSocketPath} from './utils/is-unix-socket-url.js';
import {
	normalizeError,
	RequestError,
	ReadError,
	MaxRedirectsError,
	HTTPError,
	TimeoutError,
	UploadError,
	CacheError,
	AbortError,
} from './errors.js';
import {
	generateRequestId,
	publishRequestCreate,
	publishRequestStart,
	publishResponseStart,
	publishResponseEnd,
	publishRetry,
	publishError,
	publishRedirect,
} from './diagnostics-channel.js';

type Error = NodeJS.ErrnoException;

export type Progress = {
	percent: number;
	transferred: number;
	total?: number;
};

const supportsBrotli = is.string(process.versions.brotli);
const supportsZstd = is.string(process.versions.zstd);
const methodsWithoutBody: ReadonlySet<string> = new Set(['GET', 'HEAD']);
const singleValueRequestHeaders: ReadonlySet<string> = new Set([
	'authorization',
	'content-length',
	'host',
	'proxy-authorization',
]);

export type GotEventFunction<T> =
	/**
	`request` event to get the request object of the request.

	 __Tip__: You can use `request` event to abort requests.

	@example
	```
	import got from 'got';

	got.stream('https://github.com')
		.on('request', request => setTimeout(() => request.destroy(), 50));
	```
	*/
	((name: 'request', listener: (request: ClientRequest) => void) => T)

	/**
	The `response` event to get the response object of the final request.

	__Note__: Stream responses are plain: `body` and `rawBody` are only parsed for the Promise API.
	*/
	& (<R extends PlainResponse>(name: 'response', listener: (response: R) => void) => T)

	/**
	The `redirect` event to get the options for the next request to the redirect location. The second argument is the response object of the redirect.
	*/
	& (<R extends PlainResponse, N extends Options>(name: 'redirect', listener: (nextOptions: N, response: R) => void) => T)

	/**
	Progress events for uploading (sending a request) and downloading (receiving a response).
	The `progress` argument is an object like:

	```
	{
		percent: 0.1,
		transferred: 1024,
		total: 10240
	}
	```

	If the `content-length` header is missing, `total` will be `undefined`.

	@example
	```
	import got from 'got';

	const response = await got('https://sindresorhus.com')
		.on('downloadProgress', progress => {
			// Report download progress
		})
		.on('uploadProgress', progress => {
			// Report upload progress
		});

	console.log(response);
	```
	*/
	& ((name: 'uploadProgress' | 'downloadProgress', listener: (progress: Progress) => void) => T)
	/**
	To enable retrying on a Got stream, it is required to have a `retry` handler attached.

	When this event is emitted, you should reset the stream you were writing to and prepare the body again.

	See `got.options.retry` for more information.
	*/
	& ((name: 'retry', listener: (retryCount: number, error: RequestError, createRetryStream: (options?: OptionsInit) => Request) => void) => T);

export type RequestEvents<T> = {
	on: GotEventFunction<T>;
	once: GotEventFunction<T>;
	off: GotEventFunction<T>;
};

type StorageAdapter = KeyvStoreAdapter | KeyvType | Map<unknown, unknown>;

const cacheableStore = new WeakableMap<string | StorageAdapter, CacheableRequestFunction>();

const redirectCodes: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
export {crossOriginStripHeaders} from './options.js';
const transientWriteErrorCodes: ReadonlySet<string> = new Set(['EPIPE', 'ECONNRESET']);
// See https://www.rfc-editor.org/rfc/rfc9110#section-7.6.1
const hopByHopHeaders: ReadonlySet<string> = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'proxy-connection',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
]);
const omittedPipedHeaders: ReadonlySet<string> = new Set([
	...hopByHopHeaders,
	'host',
	'authorization',
	'cookie',
	'cookie2',
	'set-cookie',
	'set-cookie2',
]);

// Track errors that have been processed by beforeError hooks to preserve custom error types
const errorsProcessedByHooks = new WeakSet<Error>();

const proxiedRequestEvents = [
	'socket',
	'connect',
	'continue',
	'information',
	'upgrade',
] as const;

const noop = (): void => {};

// Both the HTTP/1 and the HTTP/2 server responses get the status and headers copied in, so Got
// owns ending them.
type PipedServerResponse = ServerResponse | Http2ServerResponse;

const isPipedServerResponse = (destination: NodeJS.WritableStream): destination is PipedServerResponse => destination instanceof ServerResponse
	|| destination instanceof Http2ServerResponse;

const destroyRequestResult = (result: unknown): void => {
	if (!is.object(result) || !('destroy' in result) || !is.function(result.destroy)) {
		return;
	}

	if ('once' in result && is.function(result.once)) {
		result.once('error', noop);
	}

	result.destroy();
};

const createPreRequestErrorTimings = (): Timings => {
	const now = Date.now();

	return {
		start: now,
		error: now,
		phases: {
			total: 0,
		},
	};
};

type NativeFormDataBodyMetadata = {
	form: FormData;
	body: ReadableStream;
	contentTypeWasGenerated: boolean;
};

const serializeNativeFormDataBody = (form: FormData) => {
	const response = new globalThis.Response(form);
	return {
		body: response.body!,
		contentType: response.headers.get('content-type') ?? 'multipart/form-data',
	};
};

const isTransientWriteError = (error: Error): boolean => {
	const {code} = error;
	return typeof code === 'string' && transientWriteErrorCodes.has(code);
};

const getConnectionListedHeaders = (headers: Record<string, string | string[] | undefined>): Set<string> => {
	const connectionListedHeaders = new Set<string>();

	for (const [header, connectionHeader] of Object.entries(headers)) {
		const normalizedHeader = header.toLowerCase();

		if (normalizedHeader !== 'connection' && normalizedHeader !== 'proxy-connection') {
			continue;
		}

		const connectionHeaderValues = Array.isArray(connectionHeader) ? connectionHeader : [connectionHeader];

		for (const value of connectionHeaderValues) {
			if (typeof value !== 'string') {
				continue;
			}

			for (const token of value.split(',')) {
				const normalizedToken = token.trim().toLowerCase();

				if (normalizedToken.length > 0) {
					connectionListedHeaders.add(normalizedToken);
				}
			}
		}
	}

	return connectionListedHeaders;
};

type UrlType = ConstructorParameters<typeof Options>[0];
type OptionsType = ConstructorParameters<typeof Options>[1];
type DefaultsType = ConstructorParameters<typeof Options>[2];
const getSanitizedUrl = (options?: Options): string => options?.url ? stripUrlAuth(options.url) : '';

const methodCanHaveBody = (options: Options): boolean => !methodsWithoutBody.has(options.method) || (options.method === 'GET' && options.allowGetBody);

const makeProgress = (transferred: number, total?: number): Progress => {
	let percent = 0;
	if (total === transferred) {
		// Known-size complete transfers (including 0/0) should report 100% rather than 0%.
		percent = 1;
	} else if (total) {
		percent = transferred / total;
	}

	return {percent, transferred, total};
};

const parseContentLength = (value: unknown): number | undefined => {
	const length = Number(value);
	return Number.isNaN(length) ? undefined : length;
};

const hasBodyOption = (options: Options | undefined): boolean => !is.undefined(options?.body) || !is.undefined(options?.json) || !is.undefined(options?.form);

const isIterableBody = (body: unknown): body is Iterable<unknown> | AsyncIterable<unknown> => is.asyncIterable(body) || (is.iterable(body) && !is.string(body) && !isBuffer(body));

const hasResponse = (request: ClientRequest): boolean => Boolean((request as ClientRequest & {res?: unknown}).res);

const toRequestError = (thrown: unknown, request: Request): RequestError => {
	const normalizedError = normalizeError(thrown);
	return new RequestError(normalizedError.message, normalizedE
```

### Core Architecture Module: `source/core/options.ts`
```
import {
	promisify,
	inspect,
	isDeepStrictEqual,
	type InspectOptions,
} from 'node:util';
import {checkServerIdentity, type SecureContextOptions, type DetailedPeerCertificate} from 'node:tls';
// DO NOT use destructuring for `https.request` and `http.request` as it's not compatible with `nock`.
import https, {
	type RequestOptions as HttpsRequestOptions,
	type Agent as HttpsAgent,
} from 'node:https';
import http, {
	type Agent as HttpAgent,
	type ClientRequest,
} from 'node:http';
import type {Readable} from 'node:stream';
import type {Socket, LookupFunction} from 'node:net';
import type {ClientHttp2Session} from 'node:http2';
import is, {assert} from '@sindresorhus/is';
import lowercaseKeys from 'lowercase-keys';
import type {KeyvStoreAdapter} from 'keyv';
import type KeyvType from 'keyv';
import type ResponseLike from 'responselike';
import type {LiteralUnion} from 'type-fest';
import type {RequestPromise} from '../as-promise/types.js';
import type {IncomingMessageWithTimings} from './utils/timer.js';
import parseLinkHeader from './parse-link-header.js';
import {decodeUint8Array, type PlainResponse, type Response} from './response.js';
import {normalizeError, type RequestError} from './errors.js';
import {isArmableTimerDelay, type Delays} from './timed-out.js';
import {getUnixSocketPath} from './utils/is-unix-socket-url.js';
import DnsCache, {type DnsCacheLookup} from './utils/dns-cache.js';
import http2Client from './utils/http2-client.js';

type StorageAdapter = KeyvStoreAdapter | KeyvType | Map<unknown, unknown>;

type Promisable<T> = T | Promise<T>;

export type DnsLookupIpVersion = undefined | 4 | 6;

type Except<ObjectType, KeysType extends keyof ObjectType> = Pick<ObjectType, Exclude<keyof ObjectType, KeysType>>;

export type NativeRequestOptions = HttpsRequestOptions & CacheOptions & {
	checkServerIdentity?: CheckServerIdentityFunction;
};

type AcceptableResponse = IncomingMessageWithTimings | ResponseLike;
type AcceptableRequestResult = Promisable<AcceptableResponse | ClientRequest | undefined>;
export type RequestFunction = (url: URL, options: NativeRequestOptions, callback?: (response: AcceptableResponse) => void) => AcceptableRequestResult;

type RequestFallbackContext = {
	url: URL;
	options: NativeRequestOptions;
	callback?: (response: AcceptableResponse) => void;
};

const isAgentObject = (agent: unknown): agent is Agents => is.object(agent) && ('http' in agent || 'https' in agent || 'http2' in agent);

const getNativeAgent = (url: URL, agent: NativeRequestOptions['agent']): NativeRequestOptions['agent'] => {
	if (!isAgentObject(agent)) {
		return agent;
	}

	return url.protocol === 'https:' ? agent.https : agent.http;
};

export type Agents = {
	http?: HttpAgent | false;
	https?: HttpsAgent | false;
	http2?: false;
};

export type Headers = Record<string, string | string[] | undefined>;

// Numbers are accepted like in Node's `OutgoingHttpHeaders`, and stored as strings so reads keep the `Headers` type.
type HeadersInit = Record<string, string | string[] | number | undefined>;
export type CrossOriginState = {
	headers: Headers;
	hadCookieJar: boolean;
	cookieWasExplicitlySet: boolean;
	username: string;
	password: string;
	body: unknown;
	json: unknown;
	form: unknown;
	bodySnapshot: unknown;
	jsonSnapshot: unknown;
	formSnapshot: unknown;
};

export type ToughCookieJar = {
	getCookieString: ((currentUrl: string, options: Record<string, unknown>, callback: (error: Error | undefined, cookies: string) => void) => void)
		& ((url: string, callback: (error: Error | undefined, cookieHeader: string) => void) => void);
	setCookie: ((cookieOrString: unknown, currentUrl: string, options: Record<string, unknown>, callback: (error: Error | undefined, cookie: unknown) => void) => void)
		& ((rawCookie: string, url: string, callback: (error: Error | undefined, result: unknown) => void) => void);
};

export type PromiseCookieJar = {
	getCookieString: (url: string) => Promise<string>;
	setCookie: (rawCookie: string, url: string) => Promise<unknown>;
};

/**
Utility type to override specific properties in a type.

Uses `Omit` to remove properties before adding them back to ensure proper type replacement rather than intersection, which handles edge cases with optional/required properties correctly.
*/
type OverrideProperties<T, U> = Omit<T, keyof U> & U;

/**
Represents the runtime state of Options as seen by hooks after normalization.

Some Options properties accept multiple input types but are normalized to a single type internally by the Options class setters. This type reflects the actual runtime types that hooks receive, ensuring type safety when accessing options within hook functions.
*/
export type NormalizedOptions = OverrideProperties<Options, {
	// The URL is always normalized to a URL instance (or undefined) by the time hooks execute.
	get url(): URL | undefined;
	set url(value: Options['url']);

	// When set to `true`, dnsCache is normalized to a DNS cache instance. When set to `false`, it becomes `undefined`.
	get dnsCache(): DnsCacheLookup | undefined;
	set dnsCache(value: DnsCacheLookup | boolean | undefined);

	// When set to `true`, cache is normalized to the global cache Map. When set to `false`, it becomes `undefined`. Storage URI strings are preserved.
	get cache(): string | StorageAdapter | undefined;
	set cache(value: Options['cache']);

	// The prefix URL is always normalized to a string.
	get prefixUrl(): string;
	set prefixUrl(value: Options['prefixUrl']);

	// Search parameters are normalized to URLSearchParams, including after assignment.
	get searchParams(): URLSearchParams;
	set searchParams(value: string | SearchParameters | URLSearchParams | undefined);
}>;

export type InitHook = (init: OptionsInit, self: Options) => void;

export type BeforeRequestHookContext = {
	/**
	The current retry count.

	It will be `0` for the initial request and increment for each retry.
	*/
	retryCount: number;
};

export type BeforeRequestHook = (options: NormalizedOptions, context: BeforeRequestHookContext) => Promisable<void | AcceptableResponse | ClientRequest>;
export type BeforeRedirectHook = (updatedOptions: NormalizedOptions, plainResponse: PlainResponse) => Promisable<void>;
export type BeforeErrorHook = (error: RequestError) => Promisable<Error>;
export type BeforeRetryHook = (error: RequestError, retryCount: number) => Promisable<void>;
export type BeforeCacheHook = (response: Pick<PlainResponse, 'headers' | 'statusCode' | 'statusMessage'>) => false | void;
export type AfterResponseHook<ResponseType = unknown> = (response: Response<ResponseType>, retryWithMergedOptions: (options: OptionsInit) => never) => Promisable<Response | RequestPromise<Response>>;

/**
All available hooks of Got.
*/
export type Hooks = {
	/**
	Called with the plain request options, right before their normalization.

	The second argument represents the current `Options` instance.

	@default []

	Note:
	> - This hook must be synchronous.

	Note:
	> - This is called every time options are merged.

	Note:
	> - The `options` object may not have the `url` property. To modify it, use a `beforeRequest` hook instead.

	Note:
	> - This hook is called when a new instance of `Options` is created.
	> - Do not confuse this with the creation of `Request` or `got(…)`.

	Note:
	> - When using `got(url)` or `got(url, undefined, defaults)` this hook will **not** be called.

	This is especially useful in conjunction with `got.extend()` when the input needs custom handling.

	For example, this can be used to fix typos to migrate from older versions faster.

	@example
	```
	import got from 'got';

	const instance = got.extend({
		hooks: {
			init: [
				plain => {
					if ('followRedirects' in plain) {
						plain.followRedirect = plain.followRedirects;
						delete plain.followRedirects;
					}
				}
			]
		}
	});

	// Normally, the following would throw:
	const response = await instance(
		'https://example.com',
		{
			followRedirects: true
		}
	);

	// There is no option named `followRedirects`, but we correct it in an `init` hook.
	```

	Or you can create your own option and store it in a context:

	```
	import got from 'got';

	const instance = got.extend({
		hooks: {
			init: [
				(plain, options) => {
					if ('secret' in plain) {
						options.context.secret = plain.secret;
						delete plain.secret;
					}
				}
			],
			beforeRequest: [
				options => {
					options.headers.secret = options.context.secret;
				}
			]
		}
	});

	const {headers} = await instance(
		'https://httpbin.org/anything',
		{
			secret: 'passphrase'
		}
	).json();

	console.log(headers.Secret);
	//=> 'passphrase'
	```
	*/
	init: InitHook[];

	/**
	Called right before making the request with `options.createNativeRequestOptions()`.

	The second argument is a context object containing request state information.

	This hook is especially useful in conjunction with `got.extend()` when you want to sign your request.

	@default []

	Note:
	> - Got will make no further changes to the request before it is sent.

	Note:
	> - Changing `options.json` or `options.form` has no effect on the request. You should change `options.body` instead. If needed, update the `options.headers` accordingly.

	@example
	```
	import got from 'got';

	const response = await got.post(
		'https://httpbin.org/anything',
		{
			json: {payload: 'old'},
			hooks: {
				beforeRequest: [
					(options, context) => {
						options.body = JSON.stringify({payload: 'new'});
						options.headers['content-length'] = options.body.length.toString();
					}
				]
			}
		}
	);
	```

	Example using `context.retryCount`:

	```
	import got from 'got';

	await got('https://httpbin.org/status/500', {
		retry: {
			limit: 2
		},
		hooks: {
			beforeRequest: [
				(options, context) => {
					// Only log on the initial request, not on retries
					if (context.retryCount === 0) {
						console.log('Making initial request');
					}
				}
			]
		}
	});
	```

	Tip:
	> - You can indirectly override the `requ
```

### Core Architecture Module: `source/core/parse-link-header.ts`
```
const splitHeaderValue = (value: string, separator: string): string[] => {
	const values = [];
	let current = '';
	let inQuotes = false;
	let inReference = false;
	let isEscaped = false;

	for (const character of value) {
		if (inQuotes) {
			if (isEscaped) {
				isEscaped = false;
			} else if (character === '\\') {
				isEscaped = true;
			} else if (character === '"') {
				inQuotes = false;
			}
		} else if (character === '"') {
			inQuotes = true;
		} else if (character === '<' || character === '>') {
			inReference = character === '<';
		} else if (!inReference && character === separator) {
			// Link headers use both quoted strings and <URI-reference> values, so raw
			// splitting on `,` / `;` would break valid values containing those characters.
			values.push(current);
			current = '';
			continue;
		}

		current += character;
	}

	if (inQuotes) {
		throw new Error(`Failed to parse Link header: ${value}`);
	}

	values.push(current);
	return values;
};

export default function parseLinkHeader(link: string) {
	const parsed = [];

	for (const item of splitHeaderValue(link, ',')) {
		// HTTP list recipients ignore empty members (RFC 9110, section 5.6.1.2).
		if (item.trim() === '') {
			continue;
		}

		// https://tools.ietf.org/html/rfc5988#section-5
		const [rawUriReference, ...rawLinkParameters] = splitHeaderValue(item, ';') as [string, ...string[]];
		const trimmedUriReference = rawUriReference.trim();

		// eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
		if (trimmedUriReference[0] !== '<' || trimmedUriReference.at(-1) !== '>') {
			throw new Error(`Invalid format of the Link header reference: ${trimmedUriReference}`);
		}

		// Optional whitespace is allowed inside the angle brackets (RFC 8288, section 3).
		const reference = trimmedUriReference.slice(1, -1).trim();
		if (reference.includes('<') || reference.includes('>')) {
			throw new Error(`Invalid format of the Link header reference: ${trimmedUriReference}`);
		}

		// Parameter names can match `Object.prototype` properties, so use a null-prototype object.
		const parameters: Record<string, string> = Object.create(null) as Record<string, string>;

		for (const rawParameter of rawLinkParameters) {
			const trimmedRawParameter = rawParameter.trim();
			const center = trimmedRawParameter.indexOf('=');
			// The parameter value is optional. See https://www.rfc-editor.org/rfc/rfc8288#section-3
			const name = center === -1 ? trimmedRawParameter : trimmedRawParameter.slice(0, center).trim();

			if (name === '') {
				throw new Error(`Failed to parse Link header: ${link}`);
			}

			const value = center === -1 ? '' : trimmedRawParameter.slice(center + 1).trim();

			const normalizedName = name.toLowerCase();

			if (!Object.hasOwn(parameters, normalizedName)) {
				parameters[normalizedName] = value;
			}
		}

		parsed.push({
			reference,
			parameters,
		});
	}

	return parsed;
}

```

### Core Architecture Module: `source/core/response.ts`
```
import {Buffer} from 'node:buffer';
import type {IncomingMessageWithTimings, Timings} from './utils/timer.js';
import {normalizeError, RequestError} from './errors.js';
import stripUrlAuth from './utils/strip-url-auth.js';
import type {ParseJsonFunction, ResponseType} from './options.js';
import type Request from './index.js';

const decodedBodyCache = new WeakMap<PlainResponse, string>();
const redirectDecisions = new WeakMap<PlainResponse, {predicate: (response: PlainResponse) => boolean; follow: boolean}>();
// TextDecoder strips a leading byte order mark, which Buffer#toString keeps.
const bomStrippingDecoders = new Map([
	['utf8', new TextDecoder()],
	['utf16le', new TextDecoder('utf-16le')],
]);

const normalizeEncoding = (encoding?: BufferEncoding): string => (encoding ?? 'utf8').toLowerCase().replace('-', '').replace('ucs2', 'utf16le');

export const isUtf8Encoding = (encoding?: BufferEncoding): boolean => normalizeEncoding(encoding) === 'utf8';

export const decodeUint8Array = (data: Uint8Array, encoding?: BufferEncoding): string => bomStrippingDecoders.get(normalizeEncoding(encoding))?.decode(data) ?? Buffer.from(data).toString(encoding);

export type PlainResponse = {
	/**
	The original request URL.
	*/
	requestUrl: URL;

	/**
	The redirect URLs.
	*/
	redirectUrls: URL[];

	/**
	- `options` - The Got options that were set on this request.

	__Note__: This is not a [http.ClientRequest](https://nodejs.org/api/http.html#http_class_http_clientrequest).
	*/
	request: Request;

	/**
	The remote IP address.

	This is hopefully a temporary limitation, see [lukechilds/cacheable-request#86](https://web.archive.org/web/20220804165050/https://github.com/jaredwray/cacheable-request/issues/86).

	__Note__: Not available when the response is cached.
	*/
	ip?: string;

	/**
	Whether the response was retrieved from the cache.
	*/
	isFromCache: boolean;

	/**
	The status code of the response.
	*/
	statusCode: number;

	/**
	The request URL or the final URL after redirects.
	*/
	url: string;

	/**
	The object contains the following properties:

	- `start` - Time when the request started.
	- `socket` - Time when a socket was assigned to the request.
	- `lookup` - Time when the DNS lookup finished.
	- `connect` - Time when the socket successfully connected.
	- `secureConnect` - Time when the socket securely connected.
	- `upload` - Time when the request finished uploading.
	- `response` - Time when the request fired `response` event.
	- `end` - Time when the response fired `end` event.
	- `error` - Time when the request fired `error` event.
	- `abort` - Time when the request fired `abort` event.
	- `phases`
		- `wait` - `timings.socket - timings.start`
		- `dns` - `timings.lookup - timings.socket`
		- `tcp` - `timings.connect - timings.lookup`
		- `tls` - `timings.secureConnect - timings.connect`
		- `request` - `timings.upload - (timings.secureConnect || timings.connect)`
		- `firstByte` - `timings.response - timings.upload`
		- `download` - `timings.end - timings.response`
		- `total` - `(timings.end || timings.error || timings.abort) - timings.start`

	If something has not been measured yet, it will be `undefined`.

	The entire property is `undefined` for cached responses and responses returned directly by hooks or custom request functions without timing information.

	__Note__: The time is a `number` representing the milliseconds elapsed since the UNIX epoch.
	*/
	timings?: Timings;

	/**
	The number of times the request was retried.
	*/
	retryCount: number;

	// Defined only if request errored
	/**
	The raw result of the request.
	*/
	rawBody?: Uint8Array<ArrayBuffer>;

	/**
	The result of the request.
	*/
	body?: unknown;

	/**
	Whether the response was successful.

	__Note__: Got throws automatically when `response.ok` is `false` and `throwHttpErrors` is `true`.
	*/
	ok: boolean;
} & IncomingMessageWithTimings;

// For Promise support
export type Response<T = unknown> = {
	/**
	The result of the request.
	*/
	body: T;

	/**
	The raw result of the request.
	*/
	rawBody: Uint8Array<ArrayBuffer>;
} & PlainResponse;

export const isResponseOk = (response: PlainResponse): boolean => {
	const {statusCode} = response;
	if ((statusCode >= 200 && statusCode <= 299) || statusCode === 304) {
		return true;
	}

	if (statusCode < 300 || statusCode > 399) {
		return false;
	}

	const {followRedirect} = response.request.options;
	if (typeof followRedirect !== 'function') {
		return !followRedirect;
	}

	let decision = redirectDecisions.get(response);
	if (decision?.predicate !== followRedirect) {
		decision = {predicate: followRedirect, follow: followRedirect(response)};
		redirectDecisions.set(response, decision);
	}

	return !decision.follow;
};

/**
Shares the redirect decision when a response stream is wrapped for decompression.
*/
export const copyRedirectDecision = (source: PlainResponse, destination: PlainResponse): void => {
	const decision = redirectDecisions.get(source);
	if (decision !== undefined) {
		redirectDecisions.set(destination, decision);
	}
};

/**
An error to be thrown when server response code is 2xx, and parsing body fails.
Includes a `response` property.
*/
export class ParseError extends RequestError {
	override name = 'ParseError';
	override code = 'ERR_BODY_PARSE_FAILURE';
	declare readonly response: Response;

	constructor(error: Error, response: Response) {
		const {options} = response.request;
		// The thrown value is kept as the cause, so only its message is normalized.
		super(`${normalizeError(error).message} in "${stripUrlAuth(options.url!)}"`, error, response.request, response);
	}
}

export const cacheDecodedBody = (response: PlainResponse, decodedBody: string): void => {
	decodedBodyCache.set(response, decodedBody);
};

export const parseBody = (response: Response, responseType: ResponseType, parseJson: ParseJsonFunction, encoding?: BufferEncoding): unknown => {
	const {rawBody} = response;
	const cachedDecodedBody = decodedBodyCache.get(response);
	// Shortcuts must read the current bytes because callers can mutate `rawBody`.
	decodedBodyCache.delete(response);

	try {
		if (responseType === 'text') {
			return cachedDecodedBody ?? decodeUint8Array(rawBody, encoding);
		}

		if (responseType === 'json') {
			if (rawBody.length === 0) {
				return '';
			}

			const text = cachedDecodedBody ?? decodeUint8Array(rawBody, encoding);
			return parseJson(text);
		}

		if (responseType === 'buffer') {
			return rawBody;
		}
	} catch (error) {
		// `ParseError` normalizes the message and keeps the thrown value as the cause.
		throw new ParseError(error as Error, response);
	}

	throw new ParseError({
		message: `Unknown body type '${responseType as string}'`,
		name: 'Error',
	}, response);
};

```

### Core Architecture Module: `source/core/timed-out.ts`
```
import net from 'node:net';
import type {EventEmitter} from 'node:events';
import type {ClientRequest, IncomingMessage} from 'node:http';

const reentry: unique symbol = Symbol('reentry');
const noop = (): void => {};

type TimedOutOptions = {
	host?: string;
	hostname?: string;
	protocol?: string;
};

export type Delays = {
	lookup?: number;
	socket?: number;
	connect?: number;
	secureConnect?: number;
	send?: number;
	response?: number;
	read?: number;
	request?: number;
};

export type ErrorCode =
	| 'ETIMEDOUT'
	| 'ECONNRESET'
	| 'EADDRINUSE'
	| 'ECONNREFUSED'
	| 'EPIPE'
	| 'ENOTFOUND'
	| 'ENETUNREACH'
	| 'EAI_AGAIN';

export class TimeoutError extends Error {
	override name = 'TimeoutError';
	code: ErrorCode = 'ETIMEDOUT';
	event: string;

	constructor(threshold: number, event: string) {
		super(`Timeout awaiting '${event}' for ${threshold}ms`);
		this.event = event;
	}
}

// Node.js turns timer delays above the 32-bit limit (including `Infinity`) into 1 ms with a
// warning, so such a delay means "no timeout" instead of an instant timeout.
const maximumTimerDelay = 2_147_483_647;

/**
Whether a delay can be armed as a Node.js timer without collapsing into an instant timeout.
*/
export const isArmableTimerDelay = (delay: number): boolean => delay <= maximumTimerDelay && Number.isFinite(delay);

export default function timedOut(request: ClientRequest, delays: Delays, options: TimedOutOptions): () => void {
	// `reentry` is a symbol, so it cannot collide with a header name, and the request object is
	// itself the marker. Rewriting either line as an `Object.hasOwn` call would check something else.
	// eslint-disable-next-line unicorn/no-computed-property-existence-check
	if (reentry in request) {
		return noop;
	}

	request[reentry] = true;
	const cancelers: Array<typeof noop> = [];
	const handled = new Set<string>();

	// When attaching listeners, it's very easy to forget about them.
	// Especially if you do error handling and set timeouts.
	// So instead of checking if it's proper to throw an error on every timeout ever,
	// track every listener attached through `once` below, so `cancelTimeouts` can remove all of them.
	const listeners: Array<{origin: EventEmitter; event: string; listener: (...arguments_: any[]) => void}> = [];

	const once = (origin: EventEmitter, event: string, listener: (...arguments_: any[]) => void): void => {
		origin.once(event, listener);
		listeners.push({origin, event, listener});
	};

	const addTimeout = (delay: number, event: string): (typeof noop) => {
		if (!isArmableTimerDelay(delay)) {
			return noop;
		}

		const timeout = setTimeout(timeoutHandler, delay, delay, event);

		timeout.unref();

		const cancel = (): void => {
			handled.add(event);
			clearTimeout(timeout);
		};

		cancelers.push(cancel);

		return cancel;
	};

	const {host, hostname} = options;

	const timeoutHandler = (delay: number, event: string): void => {
		// Use setTimeout to allow for any cancelled events to be handled first,
		// to prevent firing any TimeoutError unneeded when the event loop is busy or blocked
		setTimeout(() => {
			if (!handled.has(event)) {
				request.destroy(new TimeoutError(delay, event));
			}
		}, 0);
	};

	const cancelTimeouts = (): void => {
		for (const cancel of cancelers) {
			cancel();
		}

		for (const {origin, event, listener} of listeners) {
			origin.removeListener(event, listener);
		}

		listeners.length = 0;
	};

	request.once('error', error => {
		cancelTimeouts();

		// Save original behavior
		/* istanbul ignore next */
		if (request.listenerCount('error') === 0) {
			throw error;
		}
	});

	if (delays.socket !== undefined && isArmableTimerDelay(delays.socket)) {
		const {socket} = delays;

		const socketTimeoutHandler = (): void => {
			timeoutHandler(socket, 'socket');
		};

		request.setTimeout(socket, socketTimeoutHandler);

		// `request.setTimeout(0)` causes a memory leak.
		// We can just remove the listener and forget about the timer - it's unreffed.
		// See https://github.com/sindresorhus/got/issues/690
		cancelers.push(() => {
			handled.add('socket');
			request.removeListener('timeout', socketTimeoutHandler);
		});
	}

	const hasLookup = delays.lookup !== undefined;
	const hasConnect = delays.connect !== undefined;
	const hasSecureConnect = delays.secureConnect !== undefined;
	const hasSend = delays.send !== undefined;
	if (hasLookup || hasConnect || hasSecureConnect || hasSend) {
		const onSocket = (socket: net.Socket): void => {
			const {socketPath} = request as ClientRequest & {socketPath?: string};

			/* istanbul ignore next: hard to test */
			if (socket.connecting) {
				// WHATWG URL hostnames keep IPv6 brackets, which `net.isIP` rejects. Strip them so IPv6 URLs skip DNS correctly.
				const normalizedHostname = hostname?.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
				const hasPath = Boolean(socketPath ?? (net.isIP(normalizedHostname ?? host ?? '') !== 0));
				// A synchronous lookup can finish before the socket is assigned to the request.
				const hasLookupCompleted = (socket.address() as net.AddressInfo).address !== undefined;

				if (hasLookup && !hasPath && !hasLookupCompleted) {
					const cancelTimeout = addTimeout(delays.lookup!, 'lookup');
					once(socket, 'lookup', cancelTimeout);
				}

				if (hasConnect) {
					const timeConnect = (): (() => void) => addTimeout(delays.connect!, 'connect');

					if (hasPath || hasLookupCompleted) {
						once(socket, 'connect', timeConnect());
					} else {
						once(socket, 'lookup', (error: Error): void => {
							if (error === null) {
								once(socket, 'connect', timeConnect());
							}
						});
					}
				}

				if (hasSecureConnect && options.protocol === 'https:') {
					once(socket, 'connect', (): void => {
						const cancelTimeout = addTimeout(delays.secureConnect!, 'secureConnect');
						once(socket, 'secureConnect', cancelTimeout);
					});
				}
			}

			if (hasSend) {
				const timeRequest = (): (() => void) => addTimeout(delays.send!, 'send');
				/* istanbul ignore next: hard to test */
				if (socket.connecting) {
					once(socket, 'connect', (): void => {
						once(request, 'upload-complete', timeRequest());
					});
				} else {
					once(request, 'upload-complete', timeRequest());
				}
			}
		};

		if (request.socket) {
			onSocket(request.socket);
		} else {
			once(request, 'socket', onSocket);
		}
	}

	if (delays.response !== undefined) {
		let cancelTimeout = noop;
		const startTimeout = (): void => {
			cancelTimeout = addTimeout(delays.response!, 'response');
		};

		once(request, 'upload-complete', startTimeout);
		once(request, 'response', (): void => {
			// A server can respond before the upload finishes.
			request.removeListener('upload-complete', startTimeout);
			cancelTimeout();
		});
	}

	if (delays.read !== undefined) {
		once(request, 'response', (response: IncomingMessage): void => {
			const cancelTimeout = addTimeout(delays.read!, 'read');
			once(response, 'end', cancelTimeout);
		});
	}

	return cancelTimeouts;
}

declare module 'http' {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- This has to be an `interface` to be able to be merged.
	interface ClientRequest {
		[reentry]?: boolean;
	}
}

```

### Core Architecture Module: `source/core/utils/decompress-response.ts`
```
import zlib from 'node:zlib';
import type {IncomingMessage} from 'node:http';
import decompressResponse from 'decompress-response';

const supportedEncodings = new Set(['gzip', 'deflate', 'br', ...(typeof zlib.createZstdDecompress === 'function' ? ['zstd'] : [])]);

export default function decompressResponseBody(response: IncomingMessage): IncomingMessage {
	const encodings = (response.headers['content-encoding'] ?? '')
		.toLowerCase()
		.split(',')
		.map(encoding => encoding.trim())
		// Empty list members are ignored (RFC 9110, section 5.6.1.1).
		.filter(encoding => encoding.length > 0)
		// `identity` means the content was not transformed, so it adds no decoding step.
		.filter(encoding => encoding !== 'identity')
		.map(encoding => encoding === 'x-gzip' ? 'gzip' : encoding);
	if (encodings.some(encoding => !supportedEncodings.has(encoding))) {
		return decompressResponse(response);
	}

	const nativeResponse = response;
	// Content-Encoding lists codings in application order (RFC 9110, section 8.4).
	for (const encoding of encodings.toReversed()) {
		const source = response;
		const originalHeaders = source.headers;
		try {
			// The dependency accepts one coding. Retain the native headers for wire-byte validation.
			source.headers = {...originalHeaders, 'content-encoding': encoding};
			response = decompressResponse(source);
		} finally {
			source.headers = originalHeaders;
		}

		if (source === nativeResponse) {
			continue;
		}

		const decoded = response;
		source.once('error', error => {
			decoded.destroy(error);
		});
	}

	return response;
}

```

### Core Architecture Module: `source/core/utils/dns-cache.ts`
```
import {
	ADDRCONFIG,
	ALL,
	V4MAPPED,
	getDefaultResultOrder,
	lookup as dnsLookup,
	promises as dnsPromises,
	type LookupOptions,
} from 'node:dns';
import {isIP, type LookupFunction} from 'node:net';
import os from 'node:os';
import {promisify} from 'node:util';

type DnsFamily = 4 | 6;

type DnsLookupOptions = Omit<LookupOptions, 'verbatim'> & {
	verbatim?: boolean;
};

type DnsLookupCallback = Parameters<LookupFunction>[2];
type DnsLookupOrder = ReturnType<typeof getDefaultResultOrder>;

type ResolverRecord = {
	address: string;
	ttl: number;
};

type Resolver = {
	resolve4(hostname: string, options: {ttl: true}): Promise<ResolverRecord[]> | ResolverRecord[];
	resolve6(hostname: string, options: {ttl: true}): Promise<ResolverRecord[]> | ResolverRecord[];
};

type DnsLookupResult = {
	address: string;
	family: DnsFamily;
};

type DnsCacheEntry = DnsLookupResult & {
	expires?: number;
};

type CachedFamily = {
	entries: DnsCacheEntry[];
	expires: number;
	clearVersion: number;
};

type MaybePromise<T> = T | Promise<T>;

type DnsCacheStore = {
	get(key: string): MaybePromise<CachedFamily | undefined>;
	set(key: string, value: CachedFamily): MaybePromise<unknown>;
	delete(key: string): boolean;
};

export type DnsCacheOptions = {
	cache?: DnsCacheStore;
	maxTtl?: number;
	fallbackDuration?: number;
	errorTtl?: number;
	resolver?: Resolver;
	lookup?: LookupFunction | false;
};

export type DnsCacheLookup = {
	lookup: LookupFunction;
	clear?(hostname?: string): void;
};

const ttl = {ttl: true} as const;
const noResultErrorCodes = new Set(['ENODATA', 'ENOTFOUND', 'ENOENT']);
const maximumCacheTtl = Math.floor(2_147_483_647 / 1000);

const isPromiseLike = <T>(value: MaybePromise<T>): value is Promise<T> => typeof (value as Promise<T>)?.then === 'function';

const now = () => Date.now();

const hasUnexpired = (cache: Map<string, number>, key: string) => {
	const expires = cache.get(key);

	if (expires === undefined) {
		return false;
	}

	if (expires <= now()) {
		cache.delete(key);
		return false;
	}

	return true;
};

const deleteExpiredMapEntries = (cache: Map<string, number>, time = now()) => {
	for (const [key, expires] of cache) {
		if (expires <= time) {
			cache.delete(key);
		}
	}
};

// eslint-disable-next-line no-bitwise
const hasFlag = (value: number | undefined, flag: number) => value !== undefined && (value & flag) === flag;

const getConfiguredFamilies = (): Set<DnsFamily> => {
	const families = new Set<DnsFamily>();

	for (const networkInterface of Object.values(os.networkInterfaces())) {
		for (const address of networkInterface ?? []) {
			if (!address.internal) {
				families.add(address.family === 'IPv6' ? 6 : 4);
			}
		}
	}

	return families;
};

const createNoResultError = (hostname: string): NodeJS.ErrnoException => {
	const error = new Error(`DNS cache lookup ENOTFOUND ${hostname}`) as NodeJS.ErrnoException & {hostname: string};
	error.code = 'ENOTFOUND';
	error.hostname = hostname;
	return error;
};

// Caller mutations must not change an in-flight lookup or its callback shape.
const normalizeLookupOptions = (options: number | DnsLookupOptions | undefined): DnsLookupOptions =>
	typeof options === 'number' ? {family: options} : {...options};

const normalizeResolverRecord = (record: ResolverRecord, family: DnsFamily, maxTtl: number): DnsCacheEntry => {
	// A record without a usable TTL must expire immediately. A `NaN` expiry would never
	// elapse, which caches the address forever.
	const recordTtl = record.ttl;
	const entryTtl = Number.isFinite(recordTtl) ? Math.min(recordTtl, maxTtl) : 0;

	return {
		address: record.address,
		family,
		expires: now() + (entryTtl * 1000),
	};
};

const map4To6 = (entries: DnsCacheEntry[]): DnsCacheEntry[] => entries.map(entry => {
	if (entry.family === 6) {
		return entry;
	}

	return {
		...entry,
		address: `::ffff:${entry.address}`,
		family: 6,
	};
});

const familyFromOptions = (options: DnsLookupOptions): DnsFamily | undefined => {
	if (options.family === 4 || options.family === 6) {
		return options.family;
	}

	if (options.family === 'IPv4') {
		return 4;
	}

	return options.family === 'IPv6' ? 6 : undefined;
};

const orderFromOptions = (options: DnsLookupOptions): DnsLookupOrder => {
	if (options.order !== undefined) {
		return options.order;
	}

	if (options.verbatim !== undefined) {
		return options.verbatim ? 'verbatim' : 'ipv4first';
	}

	return getDefaultResultOrder();
};

const familiesFromOptions = (options: DnsLookupOptions): DnsFamily[] => {
	const family = familyFromOptions(options);

	if (family === 6 && hasFlag(options.hints, V4MAPPED) && hasFlag(options.hints, ALL)) {
		return [6, 4];
	}

	if (family !== undefined) {
		return [family];
	}

	return orderFromOptions(options) === 'ipv6first' ? [6, 4] : [4, 6];
};

const filterFamiliesByAddrConfig = (families: DnsFamily[], options: DnsLookupOptions): DnsFamily[] => {
	if (!hasFlag(options.hints, ADDRCONFIG)) {
		return families;
	}

	const configuredFamilies = getConfiguredFamilies();
	return families.filter(family => configuredFamilies.has(family));
};

const shouldQueryMappedIpv4 = (entries: DnsCacheEntry[], options: DnsLookupOptions): boolean => familyFromOptions(options) === 6
	&& hasFlag(options.hints, V4MAPPED)
	&& !hasFlag(options.hints, ALL)
	&& entries.every(entry => entry.family !== 6);

const cacheKey = (hostname: string, family: DnsFamily) => `${hostname}:${family}`;

const lookupOptionsKey = (hostname: string, options: DnsLookupOptions) => `${hostname}:${familyFromOptions(options) ?? 0}:${options.hints ?? 0}:${orderFromOptions(options)}`;

const shouldIgnoreResolveError = (error: NodeJS.ErrnoException) => error.code !== undefined && noResultErrorCodes.has(error.code);

const toLookupResult = ({address, family}: DnsCacheEntry): DnsLookupResult => ({
	address,
	family,
});

export default class DnsCache implements DnsCacheLookup {
	readonly lookup: LookupFunction;

	readonly #cache: DnsCacheStore;
	readonly #resolver: Resolver;
	readonly #dnsLookupAsync?: (hostname: string, options: DnsLookupOptions) => Promise<any>;
	readonly #cacheKeys = new Set<string>();
	readonly #pending = new Map<string, Promise<DnsCacheEntry[]>>();
	readonly #pendingFallback = new Map<string, Promise<DnsCacheEntry[]>>();
	readonly #lookupOptionsToFallback = new Map<string, number>();
	readonly #lookupOptionsWithoutFallback = new Map<string, number>();
	readonly #maxTtl: number;
	readonly #fallbackDuration: number;
	readonly #errorTtl: number;
	readonly #minimumVersionByHostname = new Map<string, number>();
	readonly #activeQueriesByHostname = new Map<string, number>();
	#minimumVersion = 0;
	#clearVersion = 0;

	constructor({
		cache = new Map<string, CachedFamily>(),
		maxTtl = maximumCacheTtl,
		fallbackDuration = 3600,
		errorTtl = 0.15,
		resolver = new dnsPromises.Resolver(),
		lookup = dnsLookup,
	}: DnsCacheOptions = {}) {
		this.#cache = cache;
		this.#resolver = resolver;
		this.#maxTtl = Math.min(maxTtl, maximumCacheTtl);
		this.#fallbackDuration = fallbackDuration;
		this.#errorTtl = errorTtl;
		this.#dnsLookupAsync = lookup === false ? undefined : promisify(lookup);
		this.lookup = this.#lookup.bind(this);
	}

	async lookupAsync(hostname: string, options?: number | DnsLookupOptions): Promise<DnsLookupResult | DnsLookupResult[]> {
		const normalizedOptions = normalizeLookupOptions(options);
		const literalFamily = isIP(hostname) as DnsFamily | 0;

		if (literalFamily !== 0) {
			const entries = [{
				address: hostname,
				family: literalFamily,
			}];
			return normalizedOptions.all ? entries : entries[0]!;
		}

		let entries = await this.#query(hostname, normalizedOptions);
		entries = this.#filterEntries(entries, normalizedOptions);

		if (entries.length === 0) {
			throw createNoResultError(hostname);
		}

		const lookupResults = entries.map(entry => toLookupResult(entry));

		return normalizedOptions.all ? lookupResults : lookupResults[0]!;
	}

	clear(hostname?: string): void {
		this.#clearVersion++;

		if (hostname === undefined) {
			this.#minimumVersion = this.#clearVersion;
			this.#minimumVersionByHostname.clear();
			for (const key of this.#cacheKeys) {
				this.#cache.delete(key);
			}

			this.#cacheKeys.clear();
			this.#pending.clear();
			this.#pendingFallback.clear();
			this.#lookupOptionsToFallback.clear();
			this.#lookupOptionsWithoutFallback.clear();
			return;
		}

		for (const family of [4, 6] as const) {
			const key = cacheKey(hostname, family);
			this.#deleteCacheEntry(key);
			this.#pending.delete(key);
		}

		if (this.#activeQueriesByHostname.has(hostname)) {
			this.#minimumVersionByHostname.set(hostname, this.#clearVersion);
		}

		for (const map of [this.#pendingFallback, this.#lookupOptionsToFallback, this.#lookupOptionsWithoutFallback]) {
			for (const key of map.keys()) {
				if (key.startsWith(`${hostname}:`)) {
					map.delete(key);
				}
			}
		}
	}

	#lookup(hostname: string, options: number | DnsLookupOptions | DnsLookupCallback, callback?: DnsLookupCallback): void {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		if (callback === undefined) {
			throw new Error('Callback must be a function.');
		}

		const normalizedOptions = normalizeLookupOptions(options);

		void this.#lookupAndCallback(hostname, normalizedOptions, callback);
	}

	async #lookupAndCallback(hostname: string, options: DnsLookupOptions, callback: DnsLookupCallback): Promise<void> {
		let result: DnsLookupResult | DnsLookupResult[];

		try {
			result = await this.lookupAsync(hostname, options);
		} catch (error: unknown) {
			queueMicrotask(() => {
				const callbackWithError = callback as (error: NodeJS.ErrnoException) => void;
				callbackWithError(error as NodeJS.ErrnoException);
			});

			return;
		}

		queueMicrotask(() => {
			if (options.all) {
				callback(null, result as DnsLookupResult[]);
				return;
			}

			const entry = result as DnsLookupResult;
			callback(null, entry.address, entry.family);
		});
	}

	async #query(hostname:
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2196** (2025-10-14): **`.json()` ignores handler errors**
  *Symptoms*: #### Describe the bug   - Node.js version: v16.14.0  - OS & version: macOS Monterey (12.6.1)  The documentation page includes an example of a handler that throws a custom error to replace the original error. This example does not work and any error you throw from within a handler will leak (unless you have an `unhandledRejection` listener to do something with it).  I tested this with a handler that is pretty much identical to the recommendation in the docs:  ```js     const got = Got.extend( { handlers : [       ( options, next ) => {         return ( async () => {           try {             return await next( options );           } catch ( error ) {             throw new Error( 'Replacement Error' );           }         } )();       },     ] } );     await got( `https://httpstat.us/404` ).json(); ```  #### Actual behavior  Throwing an error from a handler leaks a promise that will be rejected with the new error, and has no effect on the result of the request. If the actual HTTP request was successful then the got request will be resolved successfully, ignoring the error that was thrown in the handler. If the actual HTTP request was unsuccessful then any error you throw from the handler will again be ignored, and the got request will be resolved with whatever the original failure was.  Running the script included below produces this:  ``` Attempting to replace error [FAIL] Got wrong error: Response code 404 (Not Found) [FAIL] Got unhandled re

- **Issue #2188** (2023-10-14): **ETIMEDOUT taking far longer than timeout**
  *Symptoms*: #### What would you like to discuss?  We've discussed this type of thing before and never fully fixed it. Here's a recent example:  ``` DEBUG: GitHub failure: RequestError {   "err": {     "name": "TimeoutError",     "code": "ETIMEDOUT",     "timings": {       "start": 1669307856735,       "socket": 1669307856735,       "lookup": 1669307859457,       "connect": 1669307859457,       "error": 1669308120448,       "phases": {         "wait": 0,         "dns": 2722,         "tcp": 0,         "total": 263713       }     },     "event": "request",     "message": "Timeout awaiting 'request' for 10000ms", ```  This just seems wrong - 10s timeout but it takes 26x longer before it actually times out. Is it explainable or must be a bug somehow? This is in got v11.  FYI the host is api.github.com  #### Checklist  - [x] I have read the documentation. 

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

### Incident Patch 1: `724ebc29` (2026-10-04)
**Commit Message**: Do not arm timeouts that Node.js cannot represent

Node.js collapses timer delays above the 32-bit limit (including
Infinity) to 1 ms with a warning, so timeout: {request: Infinity}
produced an instant TimeoutError and timeout: {socket: Infinity}
threw ERR_OUT_OF_RANGE. Treat an unarmable delay as no timeout in the
phase timers, the request budget and the HTTP/2 path, mirroring how
retry delays already treat overflowing values.

**File**: `source/core/index.ts` (modified, +6/-1)
```diff
@@ -21,7 +21,7 @@ import decompressResponse from './utils/decompress-response.js';
 import getBodySize from './utils/get-body-size.js';
 import isNonReplayableBody from './utils/is-non-replayable-body.js';
 import proxyEvents from './utils/proxy-events.js';
-import timedOut, {TimeoutError as TimedOutTimeoutError} from './timed-out.js';
+import timedOut, {TimeoutError as TimedOutTimeoutError, isArmableTimerDelay} from './timed-out.js';
 import stripUrlAuth from './utils/strip-url-auth.js';
 import WeakableMap from './utils/weakable-map.js';
 import calculateRetryDelay from './calculate-retry-delay.js';
@@ -2461,6 +2461,11 @@ export default class Request extends Duplex implements RequestEvents<Request> {
 			return;
 		}
 
+		// Node turns overflowing timer delays into 1 ms, so an unarmable budget means no timeout.
+		if (!isArmableTimerDelay(remaining)) {
+			return;
+		}
+
 		this._requestTimeout = setTimeout(() => {
 			// A hook may have changed the budget while the timer was pending, so only an unchanged budget expires here.
 			if (this.options.timeout.request === budget) {
```

**File**: `source/core/options.ts` (modified, +4/-3)
```diff
@@ -28,7 +28,7 @@ import type {IncomingMessageWithTimings} from './utils/timer.js';
 import parseLinkHeader from './parse-link-header.js';
 import {decodeUint8Array, type PlainResponse, type Response} from './response.js';
 import {normalizeError, type RequestError} from './errors.js';
-import type {Delays} from './timed-out.js';
+import {isArmableTimerDelay, type Delays} from './timed-out.js';
 import {getUnixSocketPath} from './utils/is-unix-socket-url.js';
 import DnsCache, {type DnsCacheLookup} from './utils/dns-cache.js';
 import http2Client from './utils/http2-client.js';
@@ -1603,14 +1603,15 @@ const cloneRaw = (raw: OptionsInit) => {
 };
 
 // The HTTP/2 client uses one timer for these phases, so the smallest value decides both when
-// it fires and which phase the resulting error reports.
+// it fires and which phase the resulting error reports. Delays Node.js cannot arm mean no
+// constraint and are excluded instead of winning the minimum.
 const getHttp2Timeout = (internals: typeof defaultInternals): {timeout: number; phase: 'lookup' | 'connect' | 'secureConnect' | 'request'} | undefined => {
 	const delays: Array<['lookup' | 'connect' | 'secureConnect' | 'request', number]> = [
 		['lookup', internals.timeout.lookup],
 		['connect', internals.timeout.connect],
 		['secureConnect', internals.timeout.secureConnect],
 		['request', internals.timeout.request],
-	].filter((entry): entry is ['lookup' | 'connect' | 'secureConnect' | 'request', number] => typeof entry[1] === 'number');
+	].filter((entry): entry is ['lookup' | 'connect' | 'secureConnect' | 'request', number] => typeof entry[1] === 'number' && isArmableTimerDelay(entry[1]));
 
 	if (delays.length === 0) {
 		return undefined;
```

**File**: `source/core/timed-out.ts` (modified, +14/-1)
```diff
@@ -43,6 +43,15 @@ export class TimeoutError extends Error {
 	}
 }
 
+// Node.js turns timer delays above the 32-bit limit (including `Infinity`) into 1 ms with a
+// warning, so such a delay means "no timeout" instead of an instant timeout.
+const maximumTimerDelay = 2_147_483_647;
+
+/**
+Whether a delay can be armed as a Node.js timer without collapsing into an instant timeout.
+*/
+export const isArmableTimerDelay = (delay: number): boolean => delay <= maximumTimerDelay && Number.isFinite(delay);
+
 export default function timedOut(request: ClientRequest, delays: Delays, options: TimedOutOptions): () => void {
 	// `reentry` is a symbol, so it cannot collide with a header name, and the request object is
 	// itself the marker. Rewriting either line as an `Object.hasOwn` call would check something else.
@@ -57,6 +66,10 @@ export default function timedOut(request: ClientRequest, delays: Delays, options
 	const handled = new Set<string>();
 
 	const addTimeout = (delay: number, callback: (delay: number, event: string) => void, event: string): (typeof noop) => {
+		if (!isArmableTimerDelay(delay)) {
+			return noop;
+		}
+
 		const timeout = setTimeout(callback, delay, delay, event);
 
 		timeout.unref();
@@ -101,7 +114,7 @@ export default function timedOut(request: ClientRequest, delays: Delays, options
 		}
 	});
 
-	if (delays.socket !== undefined) {
+	if (delays.socket !== undefined && isArmableTimerDelay(delays.socket)) {
 		const {socket} = delays;
 
 		const socketTimeoutHandler = (): void => {
```

**File**: `source/core/utils/http2-client.ts` (modified, +11/-1)
```diff
@@ -15,7 +15,7 @@ import {Writable, Readable} from 'node:stream';
 import tls from 'node:tls';
 import {urlToHttpOptions} from 'node:url';
 import net, {type Socket} from 'node:net';
-import {TimeoutError} from '../timed-out.js';
+import {TimeoutError, isArmableTimerDelay} from '../timed-out.js';
 
 const {
 	HTTP2_HEADER_AUTHORITY,
@@ -436,6 +436,11 @@ const resolveProtocol = async (
 		};
 
 		const applySocketTimeout = () => {
+			// A delay Node.js cannot arm means no socket timeout.
+			if (!isArmableTimerDelay(_socketTimeout!)) {
+				return;
+			}
+
 			socketTimeoutApplied = true;
 			socket.setTimeout(_socketTimeout!);
 			socket.once('timeout', onSocketTimeout);
@@ -983,6 +988,11 @@ export class Http2Agent extends EventEmitter {
 		};
 
 		const applySocketTimeout = () => {
+			// A delay Node.js cannot arm means no socket timeout.
+			if (!isArmableTimerDelay(_socketTimeout!)) {
+				return;
+			}
+
 			socketTimeoutApplied = true;
 			session.setTimeout(_socketTimeout!, onSocketTimeout);
 		};
```

**File**: `test/timeout.ts` (modified, +38/-0)
```diff
@@ -3194,3 +3194,41 @@ test('http2 socket timeout applies to a stalled response body', async t => {
 	assert.strictEqual(error?.event, 'socket');
 	assert.match(error?.message ?? '', /^Timeout awaiting 'socket' for 300ms$/v);
 });
+
+// Node.js collapses timer delays above the 32-bit limit to 1 ms, so such delays, including
+// `Infinity`, must mean "no timeout" rather than an instant timeout.
+test('delays above the Node.js timer limit are not armed as timeouts', withServer, async (_t, server, got) => {
+	server.get('/', (_request, response) => {
+		response.end('ok');
+	});
+
+	const response = await got(server.url, {
+		timeout: {
+			request: Infinity,
+			response: Infinity,
+			connect: Infinity,
+			send: Infinity,
+			socket: Infinity,
+		},
+		retry: {limit: 0},
+	});
+
+	assert.strictEqual(response.body, 'ok');
+});
+
+test('a read delay above the Node.js timer limit does not abort the body', withServer, async (_t, server, got) => {
+	server.get('/', (_request, response) => {
+		response.writeHead(200, {'transfer-encoding': 'chunked'});
+		response.write('part');
+		setTimeout(() => {
+			response.end(' done');
+		}, 50);
+	});
+
+	const response = await got(server.url, {
+		timeout: {read: Infinity},
+		retry: {limit: 0},
+	});
+
+	assert.strictEqual(response.body, 'part done');
+});
```

---

### Incident Patch 2: `1c947954` (2026-10-04)
**Commit Message**: Fix documentation drift in the hooks, timeout, https and cache contracts

The beforeRedirect example rewrote options.hostname, which is not an
Options property, so the documented rewrite silently did nothing; it
now rewrites options.url. The read timeout was struck through as
blocked, but it is implemented and tested. The cache and dnsCache
defaults normalize to undefined rather than false, and alpnProtocols
defaults to offering no protocols, with the h2 offer coming from the
http2 negotiation path.

**File**: `documentation/5-https.md` (modified, +2/-2)
```diff
@@ -11,11 +11,11 @@ This option represents the options used to make HTTPS requests.
 #### `alpnProtocols`
 
 **Type: `string[]`**\
-**Default: `['http/1.1']`**
+**Default: `undefined`**
 
 Acceptable [ALPN](https://en.wikipedia.org/wiki/Application-Layer_Protocol_Negotiation) protocols.
 
-If the `http2` option is `true`, this defaults to `['h2', 'http/1.1']`.
+By default no ALPN protocols are offered. When the `http2` option is `true`, the HTTP/2 negotiation path offers `['h2', 'http/1.1']` unless this option is set.
 
 #### `rejectUnauthorized`
 
```

**File**: `documentation/6-timeout.md` (modified, +1/-4)
```diff
@@ -120,16 +120,13 @@ Ends when all data have been written to the socket.
 Starts when request has been flushed.\
 Ends when the headers are received.
 
-#### ~~`read`~~
+#### `read`
 
 **Type: `number`**
 
 Starts when the headers are received.\
 Ends when the response's `end` event fires.
 
-**Note:**
-> - This timeout is blocked by https://github.com/nodejs/node/issues/35923
-
 #### `request`
 
 **Type: `number`**
```

**File**: `documentation/9-hooks.md` (modified, +2/-2)
```diff
@@ -189,8 +189,8 @@ const response = await got('https://example.com', {
 	hooks: {
 		beforeRedirect: [
 			(options, response) => {
-				if (options.hostname === 'deadSite') {
-					options.hostname = 'fallbackSite';
+				if (options.url.hostname === 'deadSite') {
+					options.url = 'https://fallbackSite.com';
 				}
 			}
 		]
```

**File**: `source/core/options.ts` (modified, +4/-4)
```diff
@@ -324,8 +324,8 @@ export type Hooks = {
 		hooks: {
 			beforeRedirect: [
 				(options, response) => {
-					if (options.hostname === 'deadSite') {
-						options.hostname = 'fallbackSite';
+					if (options.url.hostname === 'deadSite') {
+						options.url = 'https://fallbackSite.com';
 					}
 				}
 			]
@@ -2459,7 +2459,7 @@ export default class Options {
 
 	__Note__: This should stay disabled when making requests to internal hostnames such as `localhost`, `database.local` etc.
 
-	@default false
+	@default undefined
 	*/
 	get dnsCache(): DnsCacheLookup | undefined {
 		return this.#internals.dnsCache;
@@ -2612,7 +2612,7 @@ export default class Options {
 	/**
 	A cache adapter instance for storing cached response data.
 
-	@default false
+	@default undefined
 	*/
 	get cache(): string | StorageAdapter | boolean | undefined {
 		return this.#internals.cache;
```

---

### Incident Patch 3: `494279ba` (2026-10-05)
**Commit Message**: Name null in the beforeError return validation

typeof null is object, so a hook returning null was told it returned
an object. Report null as null, like undefined already is.

**File**: `source/core/index.ts` (modified, +2/-1)
```diff
@@ -2929,7 +2929,8 @@ export default class Request extends Duplex implements RequestEvents<Request> {
 
 						// Validate hook return value
 						if (!(error instanceof Error)) {
-							throw new TypeError(`The \`beforeError\` hook must return an Error instance. Received ${is.string(error) ? 'string' : (typeof error)}.`);
+							const received = error === null ? 'null' : (is.string(error) ? 'string' : (typeof error));
+							throw new TypeError(`The \`beforeError\` hook must return an Error instance. Received ${received}.`);
 						}
 					}
 
```

**File**: `test/error.ts` (modified, +16/-0)
```diff
@@ -973,3 +973,19 @@ for (const [name, responseType, expected] of [
 		assert.deepStrictEqual(error?.response?.body, expected);
 	});
 }
+
+test('a beforeError hook returning null is named in the validation error', withServer, async (_t, server, got) => {
+	server.get('/', (_request, response) => {
+		response.statusCode = 404;
+		response.end('nope');
+	});
+
+	const error = await rejects(got('', {
+		retry: {limit: 0},
+		hooks: {
+			beforeError: [() => null as any],
+		},
+	}));
+
+	assert.match(error.message, /Received null/v);
+});
```

#### Recent Merged Pull Requests:
- **PR #2471** (2026-08-29): Fix HTTP/2 socket timeout handling (@sindresorhus)
- **PR #2470** (2026-08-28): Fix retries on connection errors (@sindresorhus)
- **PR #2466** (2026-07-06): Add support for `QUERY` HTTP method (@sindresorhus)
- **PR #2465** (2026-07-06): Various tweaks (@sindresorhus)
- **PR #2464** (2026-07-06): Remove HTTP/2 wrapper (@sindresorhus)
- **PR #2463** (2026-07-05):  Replace `cacheable-lookup` dependency with internal DNS cache (@sindresorhus)

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

## X. Do not arm timeouts that Node.js cannot represent

**RULE**:
When implementing operations in `source/core/index.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sindresorhus/got. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `724ebc29`: Do not arm timeouts that Node.js cannot represent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `source/core/index.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import timedOut, {TimeoutError as TimedOutTimeoutError, isArmableTimerDelay} from './timed-out.js';
		// Node turns overflowing timer delays into 1 ms, so an unarmable budget means no timeout.
		if (!isArmableTimerDelay(remaining)) {
			return;
		}

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
import timedOut, {TimeoutError as TimedOutTimeoutError} from './timed-out.js';
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `724ebc29` are properly handled with clean fallback behavior.
