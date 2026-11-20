> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rocketride-org-rocketride-server-learnings.md`  
> **Source**: github ([https://github.com/rocketride-org/rocketride-server](https://github.com/rocketride-org/rocketride-server))  
> **Source Version**: `8b5785c8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T09:59:05.149Z  
> **Learning ID**: `learn-github-rocketride-org-rocketride-server`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): rocketride-org/rocketride-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/rocketride-org-rocketride-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rocketride-org/rocketride-server](https://github.com/rocketride-org/rocketride-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T09:58:55.643Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rocketride-org/rocketride-server`
- **Description**: RocketRide is an open source AI meta-harness with the only enterprise-grade runtime built on C++. Build, test and publish durable agents that scale in production.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 20008 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/chat-ui/src/components/ChartJsRenderer.tsx`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useMemo } from 'react';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	RadialLinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Filler,
	Tooltip,
	Legend,
	Title,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter, Bubble } from 'react-chartjs-2';

ChartJS.register(
	CategoryScale,
	LinearScale,
	RadialLinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Filler,
	Tooltip,
	Legend,
	Title,
);

const CHART_COMPONENTS: Record<string, React.ComponentType<any>> = {
	bar: Bar,
	line: Line,
	pie: Pie,
	doughnut: Doughnut,
	radar: Radar,
	polarArea: PolarArea,
	scatter: Scatter,
	bubble: Bubble,
};

interface ChartJsRendererProps {
	config: string;
}

/**
 * Recursively strip any string values that look like stringified functions
 * (e.g. "function(context){ ... }") since Chart.js cannot execute those
 * from JSON — they would render as literal text.
 */
function stripFunctionStrings(obj: unknown): unknown {
	// Match traditional functions and arrow functions — LLMs may generate either form.
	// Neither can be executed from JSON; both must be stripped before Chart.js renders.
	if (typeof obj === 'string' && /^\s*(function\s*\(|\(.*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>)/.test(obj)) {
		return undefined;
	}
	if (Array.isArray(obj)) {
		return obj.map(stripFunctionStrings);
	}
	if (obj !== null && typeof obj === 'object') {
		const cleaned: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const v = stripFunctionStrings(value);
			if (v !== undefined) {
				cleaned[key] = v;
			}
		}
		return cleaned;
	}
	return obj;
}

export const ChartJsRenderer: React.FC<ChartJsRendererProps> = ({ config }) => {
	const result = useMemo(() => {
		try {
			// Strip a nested ```chartjs fence if the config arrived double-fenced.
			// This happens when the agent stores the tool output (already a ```chartjs block)
			// in memory and then wraps the recalled value in another ```chartjs fence.
			// react-markdown strips the outer fence, leaving the inner one here.
			let cleanConfig = config.trim();
			if (cleanConfig.startsWith('```chartjs')) {
				cleanConfig = cleanConfig.slice(10).trim();
				if (cleanConfig.endsWith('```')) {
					cleanConfig = cleanConfig.slice(0, -3).trim();
				}
			}

			const raw = JSON.parse(cleanConfig);
			const parsed = stripFunctionStrings(raw) as Record<string, any>;

			if (!parsed.type || !parsed.data) {
				return { error: 'Chart config must include "type" and "data" fields.', parsed: null, raw: config };
			}

			return { error: null, parsed, raw: config };
		} catch {
			return { error: 'Invalid JSON in chart configuration.', parsed: null, raw: config };
		}
	}, [config]);

	if (result.error || !result.parsed) {
		return (
			<div className="chartjs-error">
				<strong>{result.error}</strong>
				<pre>{result.raw}</pre>
			</div>
		);
	}

	const { type, data, options = {} } = result.parsed;
	// Intentional silent fallback: unknown/omitted chart types render as Bar.
	// chart_type is validated by chartjs_driver.py; this handles edge cases gracefully.
	// Note: expectJson=true in the LLM invoke contract guarantees markdown fences are
	// stripped server-side before the config reaches this component — no double-fencing possible.
	const ChartComponent = CHART_COMPONENTS[type] || Bar;

	const mergedOptions = {
		...options,
		responsive: true,
		maintainAspectRatio: true,
	};

	return (
		<div className="chartjs-container">
			<ChartComponent data={data} options={mergedOptions} />
		</div>
	);
};

```

### Core Architecture Module: `apps/chat-ui/src/components/MarkdownRenderer.tsx`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChartJsRenderer } from './ChartJsRenderer';

interface MarkdownRendererProps {
	content: string;
}

const HTML_WRAPPER_TEMPLATE = (bodyContent: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 16px; font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Ubuntu, "Droid Sans", sans-serif); font-size: var(--vscode-font-size, 13px); }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[rehypeRaw]}
			components={{
				pre: ({ children, ...rest }: any) => {
					// When the code renderer returns a non-code element (chart, iframe),
					// skip the <pre> wrapper so it doesn't break layout.
					if (React.isValidElement(children)) {
						const child = children as React.ReactElement<any>;
						if (child.type !== 'code') {
							return <>{children}</>;
						}
					}
					return <pre {...rest}>{children}</pre>;
				},
				code: (props: any) => {
					const { inline, className, children, ...rest } = props;
					const match = /language-(\w+)/.exec(className || '');
					const codeContent = String(children).replace(/\n$/, '');

					if (!inline && match && match[1] === 'html') {
						const isFullDocument = codeContent.trim().startsWith('<!DOCTYPE') ||
							codeContent.trim().startsWith('<html');
						const htmlContent = isFullDocument ? codeContent : HTML_WRAPPER_TEMPLATE(codeContent);

						return (
							<iframe
								srcDoc={htmlContent}
								sandbox="allow-scripts"
								className='html-iframe'
								title="Rendered HTML"
							/>
						);
					}

					if (!inline && match && match[1] === 'chartjs') {
						return <ChartJsRenderer config={codeContent} />;
					}

					return !inline && match ? (
						<SyntaxHighlighter
							style={oneDark}
							language={match[1]}
							PreTag="div"
							customStyle={{
								margin: 0,
								borderRadius: '6px',
								fontSize: 'var(--vscode-editor-font-size, 13px)'
							}}
						>
							{codeContent}
						</SyntaxHighlighter>
					) : (
						<code className={className} {...rest}>
							{children}
						</code>
					);
				},
				table: (props) => {
					return (
						<div className="table-wrapper">
							<table className="markdown-table">
								{props.children}
							</table>
						</div>
					);
				},
				a: (props) => {
					return (
						<a href={props.href} target="_blank" rel="noopener noreferrer" className="markdown-link">
							{props.children}
						</a>
					);
				},
				blockquote: (props) => {
					return (
						<blockquote className="markdown-blockquote">
							{props.children}
						</blockquote>
					);
				},
				ul: (props) => {
					return <ul className="markdown-list">{props.children}</ul>;
				},
				ol: (props) => {
					return <ol className="markdown-list">{props.children}</ol>;
				}
			}}
		>
			{content}
		</ReactMarkdown>
	);
};

```

### Core Architecture Module: `apps/chat-ui/src/hooks/clientSingleton.ts`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * RocketRide Client Singleton Module
 *
 * Manages a single, shared WebSocket connection to RocketRide services across
 * the entire application. This singleton pattern ensures:
 * 
 * Benefits:
 * - Only one WebSocket connection exists (no duplicate connections)
 * - Connection persists across component mount/unmount cycles
 * - Immune to React StrictMode double-mounting
 * - Multiple components can share the same connection
 * - Automatic reconnection handling
 * - Centralized event broadcasting
 * 
 * Architecture:
 * - Singleton instance stored outside React lifecycle
 * - Pub/sub pattern for event distribution
 * - Promise-based connection management
 * 
 * Event Types:
 * - Connection events: broadcast when WebSocket connects
 * - Disconnection events: broadcast when WebSocket disconnects
 * - Message events: broadcast for all incoming RocketRide messages
 * - Status events: broadcast for UI status updates
 * 
 * Authentication: Token is obtained by App and passed to startClient().
 * 
 * @module clientSingleton
 */

import { RocketRideClient, RocketRideClientConfig, ConnectionException } from 'rocketride';
import { API_CONFIG } from '../config/apiConfig';

// ============================================================================
// SINGLETON STATE
// ============================================================================

/** The single shared RocketRideClient instance (null if not yet created) */
let clientInstance: RocketRideClient | null = null;

// ============================================================================
// SUBSCRIBER TYPES
// ============================================================================

/** Callback for RocketRide message events */
type EventSubscriber = (message: any) => void | Promise<void>;

/** Callback for successful connection events */
type ConnectionSubscriber = (client: RocketRideClient) => void | Promise<void>;

/** Callback for disconnection events */
type DisconnectionSubscriber = (reason: string, hasError: boolean) => void | Promise<void>;

/** Callback for UI status message updates */
type StatusSubscriber = (message: string | null) => void;

// ============================================================================
// SUBSCRIBER COLLECTIONS
// ============================================================================

/** Set of functions subscribed to RocketRide message events */
const eventSubscribers = new Set<EventSubscriber>();

/** Set of functions subscribed to connection events */
const connectedSubscribers = new Set<ConnectionSubscriber>();

/** Set of functions subscribed to disconnection events */
const disconnectedSubscribers = new Set<DisconnectionSubscriber>();

/** Set of functions subscribed to status message updates */
const statusSubscribers = new Set<StatusSubscriber>();

/**
 * Last connection error (from connect failure or onDisconnected with hasError).
 * Stored so late subscribers (e.g. ChatContainer after App's startClient) can display it.
 */
let lastConnectionError: { reason: string; hasError: boolean } | null = null;

// ============================================================================
// EVENT BROADCASTING
// ============================================================================

/**
 * Broadcasts incoming RocketRide events to all subscribed listeners
 * 
 * Error Handling:
 * - Individual subscriber errors are caught and logged
 * - One failing subscriber doesn't affect others
 * - Ensures all subscribers receive the event
 * 
 * @param message - Event message from RocketRide client
 */
async function handleEvent(message: any): Promise<void> {
	for (const subscriber of eventSubscribers) {
		try {
			await subscriber(message);
		} catch (error) {
			console.error('Error in event subscriber:', error);
		}
	}
}

/**
 * Broadcasts connection event to all subscribed listeners
 * 
 * Flow:
 * 1. Clears any status messages (connection successful)
 * 2. Notifies all connection subscribers
 * 3. Allows subscribers to perform setup (e.g., initialize pipelines)
 * 
 * @param client - The connected RocketRideClient instance
 */
async function handleConnected(client: RocketRideClient): Promise<void> {
	lastConnectionError = null;

	// Clear any status messages (e.g., "Connecting...")
	for (const subscriber of statusSubscribers) {
		try {
			subscriber(null);
		} catch (error) {
			console.error('Error in status subscriber:', error);
		}
	}

	// Notify connection subscribers
	for (const subscriber of connectedSubscribers) {
		try {
			await subscriber(client);
		} catch (error) {
			console.error('Error in connected subscriber:', error);
		}
	}
}

/**
 * Broadcasts disconnection event to all subscribed listeners
 * 
 * Flow:
 * 1. Shows descriptive error message from server
 * 2. Notifies all disconnection subscribers
 * 3. SDK will automatically attempt reconnection
 * 
 * Server Error Messages:
 * - HTTP 400: Pipeline not running
 * - HTTP 401: Authentication error
 * - Other: Connection lost or network errors
 * 
 * @param reason - Reason for disconnection (from server or network)
 * @param hasError - Whether disconnection was due to an error
 */
async function handleDisconnected(reason: string, hasError: boolean): Promise<void> {
	if (hasError) {
		lastConnectionError = { reason, hasError: true };
	}

	// Notify disconnection subscribers - they handle their own status display logic
	for (const subscriber of disconnectedSubscribers) {
		try {
			await subscriber(reason, hasError);
		} catch (error) {
			console.error('Error in disconnected subscriber:', error);
		}
	}
}

// ============================================================================
// CLIENT MANAGEMENT
// ============================================================================

/**
 * CONNECTION FLOW (connect / disconnect with persistent connections)
 *
 * 1) connect() [RocketRideClient]
 *    - Sets _manualDisconnect = false (allow reconnect on drop).
 *    - Calls super.connect() (DAPClient):
 *      a) transport.connect() → WebSocket open (no auth on wire).
 *      b) Sends DAP auth request; on failure: transport.disconnect(message, true), then throws.
 *      c) On success: onConnected(connectionInfo) → user's onConnected (we never got here if (b) failed).
 *    - If super.connect() throws:
 *      - persist false: rethrow (caller handles).
 *      - persist true: call onConnectError(message), _scheduleReconnect(), resolve (do not throw).
 *    - SDK does NOT call onDisconnected when connect fails (only when onConnected had been called).
 *
 * 2) disconnect() [RocketRideClient]
 *    - Sets _manualDisconnect = true and clears reconnect timeout.
 *    - transport.disconnect() → transport calls bound onDisconnected(reason, hasError).
 *    - Client's onDisconnected: only invokes user's onDisconnected if _didNotifyConnected (we had
 *      called onConnected); then schedules reconnect only when persist && !_manualDisconnect.
 *
 * 3) Persistent connection — handled by the client (RocketRideClient), not the app.
 *    - When created with persist: true, the client owns reconnection. After a successful
 *      connection, if the link drops, transport calls onDisconnected; the client invokes the
 *      user's onDisconnected and _scheduleReconnect(). After reconnectDelay it calls connect()
 *      again; success → onConnected again. The app does not run a reconnect loop.
 *
 *    How persist affects connect/disconnect:
 *    - connect(): The app typically calls it once to start. With persist, the client may also
 *      call connect() internally on each reconnect attempt. So connect() means "establish or
 *      re-establish the connection."
 *    - disconnect(): Only the app calls this. It sets _manualDisconnect = true and closes the
 *      transport, so the client will not schedule any further reconnects. So disconnect() means
 *      "I'm done; close the connection and do not reconnect." Without a call to disconnect(),
 *      the client keeps reconnecting whenever the link drops.
 *
 * 4) Chat UI (startClient)
 *    - Creates RocketRideClient with persist: true and callbacks; calls client.connect() once.
 *    - On throw: handleDisconnected(message, true) and lastConnectionError for late subscribers.
 *    - The client itself handles reconnection on subsequent drops; subscribers get catch-up on
 *      subscribe if lastConnectionError is set.
 */

/**
 * Starts the RocketRide client singleton with persistent connection
 * 
 * This function initializes the client once and enables automatic reconnection.
 * If the client is already started, this function does nothing (idempotent).
 * 
 * Connection Flow:
 * - Creates RocketRideClient with persist: true
 * - Attempts initial connection (may fail if pipeline not running)
 * - SDK automatically retries connection every 1 second
 * - onConnected/onDis
```

### Core Architecture Module: `apps/chat-ui/src/hooks/useChatMessages.ts`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useState, useCallback } from 'react';
import { Question, QuestionType } from 'rocketride';
import type { PIPELINE_RESULT } from 'rocketride';
import { Message } from '../types/chat.types';
import { extractTextFromResult } from '../utils/pipelineUtils';

/**
 * Custom hook for managing chat message state and API communication
 *
 * Handles:
 * - Message history management
 * - Sending messages to RocketRide AI
 * - Processing API responses
 * - Typing indicators
 * - System messages (connection status, errors)
 * 
 * @returns Message state and control functions
 */
export const useChatMessages = () => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isTyping, setIsTyping] = useState(false);

	/**
	 * Sends user message to RocketRide AI and processes response
	 * 
	 * Process:
	 * 1. Validates connection state
	 * 2. Builds Question object with user message
	 * 3. Adds conversation history for context (last 6 messages)
	 * 4. Sends to RocketRide via SDK
	 * 5. Extracts and returns text responses
	 * 
	 * @param userMessage - User's message text
	 * @param client - RocketRideClient instance
	 * @param authToken - Auth token for pipeline operations
	 * @returns Array of formatted response strings
	 * @throws Error if not connected or API request fails
	 */
	const sendMessageToAPI = useCallback(async (
		userMessage: string,
		client: any,
		authToken: string
	): Promise<ReturnType<typeof extractTextFromResult>> => {
		try {
			if (!client || !authToken) {
				throw new Error('Not connected to RocketRide. Please refresh the page.');
			}

			// Build question with conversation history for context
			const question = new Question({
				type: QuestionType.PROMPT,
				expectJson: false
			});

			question.addQuestion(userMessage);

			// Include last 6 messages for context - helps AI maintain conversation flow
			// Filter out system/status messages (UI-only) to avoid priming the LLM
			messages.filter(msg => msg.sender !== 'system' && msg.sender !== 'status').slice(-6).forEach(msg => {
				question.addHistory({
					role: msg.sender === 'user' ? 'user' : 'assistant',
					content: msg.text
				});
			});

			// Send to RocketRide; onSSE adds real-time status messages to the chat
			const result: PIPELINE_RESULT = await client.chat({
				token: authToken,
				question: question,
				onSSE: async (type: string, data: Record<string, unknown>) => {
					const text = data.message as string | undefined;
					if (text) {
						setMessages(prev => [...prev, {
							id: Date.now(),
							text,
							sender: 'status',
							sseType: type,
							timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
						}]);
					}
				}
			});

			// Extract text responses from result
			const textResponses = extractTextFromResult(result);

			return textResponses.length > 0 ? textResponses : [{ text: 'No valid response received', key: '' }];

		} catch (error) {
			console.error('Error sending message via SDK:', error);
			throw error;
		}
	}, [messages]);

	/**
	 * Sends a message and updates the chat history
	 * 
	 * @param text - Message text to send
	 * @param client - RocketRideClient instance
	 * @param authToken - Auth token for pipeline operations
	 * @returns Promise that resolves when message is sent and response received
	 */
	const sendMessage = useCallback(async (
		text: string,
		client: any,
		authToken: string
	): Promise<void> => {
		if (!text.trim()) return;

		// Add user message to chat
		const userMessage: Message = {
			id: Date.now(),
			text,
			sender: 'user',
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};

		setMessages(prev => [...prev, userMessage]);
		setIsTyping(true);

		try {
			// Send to API and get response using authToken
			const answers = await sendMessageToAPI(text, client, authToken);

			// Add bot response(s) to chat
			const botResponses: Message[] = answers.map((answer, index) => ({
				id: Date.now() + index + 1,
				text: answer.text,
				sender: 'bot' as const,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				...(answer.key ? { resultKey: answer.key } : {})
			}));

			setMessages(prev => [...prev, ...botResponses]);
		} catch (error) {
			// Show error message in chat
			const errorMessage: Message = {
				id: Date.now() + 1,
				text: error instanceof Error ? error.message : 'Sorry, I encountered an unexpected error. Please try again.',
				sender: 'bot',
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			};

			setMessages(prev => [...prev, errorMessage]);
		} finally {
			setIsTyping(false);
		}
	}, [sendMessageToAPI]);

	/**
	 * Adds a system message to the chat
	 * 
	 * Used for connection status updates, errors, and other system notifications.
	 * 
	 * @param text - System message text to display
	 */
	const addSystemMessage = useCallback((text: string) => {
		const systemMessage: Message = {
			id: Date.now(),
			text,
			sender: 'system',
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
		setMessages(prev => [...prev, systemMessage]);
	}, []);

	/**
	 * Clears all messages and resets to initial state
	 */
	const clearMessages = useCallback(() => {
		setMessages([
			{
				id: Date.now(),
				text: "Chat cleared! I'm your RocketRide assistant. How can I help you today?",
				sender: 'system',
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
		]);
	}, []);

	return {
		messages,
		isTyping,
		sendMessage,
		clearMessages,
		addSystemMessage
	};
};

```

### Core Architecture Module: `apps/chat-ui/src/hooks/useRocketRide.ts`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RocketRideClient } from 'rocketride';
import { getClient, subscribeToClient } from './clientSingleton';

/**
 * useRocketRideClient - React hook for accessing shared RocketRide WebSocket client
 *
 * This hook provides a React-friendly interface to the RocketRide client singleton,
 * ensuring a single, persistent WebSocket connection across the entire application.
 *
 * Architecture Benefits:
 * - Singleton Pattern: Only one WebSocket connection for entire app
 * - React StrictMode Compatible: Immune to double-mount issues
 * - Persistent Connection: Survives component mount/unmount cycles
 * - Shared State: Multiple components can use same connection
 * - Automatic Reconnection: Built-in reconnection logic
 *
 * Connection Lifecycle:
 * 1. Hook mounts → subscribes to singleton events
 * 2. Singleton creates/returns client instance
 * 3. If already connected → fires onConnected immediately
 * 4. Component unmounts → unsubscribes but keeps connection alive
 * 5. Other components can reuse the same connection
 *
 * Usage Pattern:
 * ```tsx
 * const { isConnected, client } = useRocketRideClient(
 *   async (client) => {
 *     // Setup: Initialize pipelines when connected
 *     const result = await client.use({ pipeline: myPipeline });
 *   },
 *   (reason, hasError) => {
 *     // Cleanup: Handle disconnection
 *     console.log('Disconnected:', reason);
 *   },
 *   (status) => {
 *     // Status: Show connection messages to user
 *     setStatusMessage(status);
 *   }
 * );
 * ```
 *
 * Callback Stability:
 * - Callbacks are stored in refs to prevent unnecessary effect triggers
 * - Callback refs updated synchronously when props change
 * - Effect dependencies remain stable
 *
 * Memory Safety:
 * - isMountedRef prevents state updates after unmount
 * - Unsubscribes from singleton on unmount
 * - Connection persists for other components
 *
 * @param onConnected - Called when WebSocket connects (setup pipelines here)
 * @param onDisconnected - Called when WebSocket disconnects (cleanup here)
 * @param onStatusChange - Called for transient status updates
 *
 * @returns Object with connection state and client reference
 * @returns isConnected - Current WebSocket connection status
 * @returns client - Shared RocketRideClient instance derived from singleton (null if not started)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, client } = useRocketRideClient(
 *     async (client) => {
 *       console.log('Connected!');
 *       await setupPipelines(client);
 *     }
 *   );
 *
 *   if (!isConnected) return <div>Connecting...</div>;
 *
 *   return <div>Ready to process files</div>;
 * }
 * ```
 */
export const useRocketRideClient = (
	onConnected?: (client: RocketRideClient) => void | Promise<void>,
	onDisconnected?: (reason: string, hasError: boolean) => void | Promise<void>,
	onStatusChange?: (message: string | null) => void
) => {
	// ============= STATE =============

	/** Tracks whether the WebSocket client is currently connected */
	const [isConnected, setIsConnected] = useState(false);

	// ============= REFS =============

	/**
	 * Tracks if component is still mounted
	 * Prevents state updates after unmount (memory leak prevention)
	 */
	const isMountedRef = useRef(true);

	/**
	 * Stable references to callbacks
	 * Prevents unnecessary re-renders when callbacks change
	 * Updated synchronously when props change
	 */
	const onConnectedRef = useRef(onConnected);
	const onDisconnectedRef = useRef(onDisconnected);
	const onStatusChangeRef = useRef(onStatusChange);

	/**
	 * Keep callback refs up to date without triggering effect dependencies
	 * This allows callbacks to change without recreating subscriptions
	 */
	useEffect(() => {
		onConnectedRef.current = onConnected;
		onDisconnectedRef.current = onDisconnected;
		onStatusChangeRef.current = onStatusChange;
	}, [onConnected, onDisconnected, onStatusChange]);

	// ============= EVENT HANDLERS =============

	/**
	 * Handles successful WebSocket connection
	 *
	 * Flow:
	 * 1. Updates connection state
	 * 2. Delegates to consumer's onConnected callback
	 * 3. Catches and logs any errors in callback
	 *
	 * Safety:
	 * - Checks if component still mounted
	 * - Error handling prevents crashes
	 * - Only calls callback if provided
	 */
	const handleConnected = useCallback(async (connectedClient: RocketRideClient) => {
		if (!isMountedRef.current) return;

		setIsConnected(true);

		// Let the consumer handle what happens on connection (e.g., pipeline setup)
		if (onConnectedRef.current) {
			try {
				await onConnectedRef.current(connectedClient);
			} catch (error) {
				console.error('Error in onConnected callback:', error);
			}
		}
	}, []);

	/**
	 * Handles WebSocket disconnection
	 *
	 * Flow:
	 * 1. Updates connection state
	 * 2. Delegates to consumer's onDisconnected callback
	 * 3. Catches and logs any errors in callback
	 *
	 * Note: Client will automatically attempt reconnection
	 */
	const handleDisconnected = useCallback(async (reason: string, hasError: boolean) => {
		if (!isMountedRef.current) return;

		setIsConnected(false);

		// Let the consumer handle disconnection
		if (onDisconnectedRef.current) {
			try {
				await onDisconnectedRef.current(reason, hasError);
			} catch (error) {
				console.error('Error in onDisconnected callback:', error);
			}
		}
	}, []);

	/**
	 * Handles status change messages
	 * Used for displaying connection status to users
	 */
	const handleStatusChange = useCallback((message: string | null) => {
		if (!isMountedRef.current) return;

		if (onStatusChangeRef.current) {
			onStatusChangeRef.current(message);
		}
	}, []);

	/**
	 * Handles incoming events from the RocketRide client
	 *
	 * Note: Events are already logged in the singleton
	 * Additional per-component handling can be added here if needed
	 */
	const handleEvent = useCallback(async (_message: any) => {
		// Events are logged in the singleton
		// Additional handling can be added here if needed per-component
	}, []);

	// ============= LIFECYCLE =============

	/**
	 * Main effect: Get client and subscribe to events
	 *
	 * Flow:
	 * 1. Mark component as mounted
	 * 2. Get client instance (may be null if not started)
	 * 3. Subscribe to singleton events
	 * 4. If already connected, fire onConnected immediately
	 * 5. On unmount: unsubscribe and mark as unmounted
	 *
	 * Important: Does NOT start or disconnect client
	 * Client must be started by App.tsx using startClient()
	 */
	useEffect(() => {
		// Mark component as mounted
		isMountedRef.current = true;

		// Subscribe to client events from singleton
		const unsubscribe = subscribeToClient({
			onEvent: handleEvent,
			onConnected: handleConnected,
			onDisconnected: handleDisconnected,
			onStatusChange: handleStatusChange,
		});

		// Get the client from singleton (synchronous)
		const c = getClient();

		if (c) {
			const connected = c.isConnected();
			setIsConnected(connected);

			// If already connected, fire onConnected callback immediately
			// This handles the case where client was already connected
			// when this component mounted
			if (connected && onConnectedRef.current) {
				Promise.resolve(onConnectedRef.current(c)).catch((error: Error) => {
					console.error('Error in onConnected callback:', error);
				});
			}
		}

		// Cleanup on unmount
		return () => {
			isMountedRef.current = false;
			unsubscribe();
			// Note: We don't disconnect the client - it persists for other components
		};
	}, [handleEvent, handleConnected, handleDisconnected, handleStatusChange]);

	// ============= RETURN API =============

	return {
		/** Current connection status */
		isConnected,

		/** Shared client instance (derived from singleton) */
		client: getClient(),
	};
};

```

### Core Architecture Module: `apps/chat-ui/src/hooks/useTheme.tsx`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useVSCode } from './useVSCode';

export type ThemeName = 'ocean' | 'forest' | 'sunset' | 'midnight' | 'corporate' | 'vscode';

interface ThemeColors {
	[key: string]: string;
}

interface ThemeContextType {
	currentTheme: ThemeName;
	setTheme: (theme: ThemeName) => void;
	isVSCode: boolean;
	mode: 'standalone' | 'vscode';
	availableThemes: ThemeName[];
}

const THEMES: Record<ThemeName, ThemeColors> = {
	corporate: {
		'bg-primary': '#ffffff',
		'bg-secondary': '#f5f5f5',
		'bg-tertiary': '#e5e5e5',
		'bg-hover': '#d5d5d5',
		'text-primary': '#1a1a1a',
		'text-secondary': '#4a4a4a',
		'text-muted': '#7a7a7a',
		'border-color': '#d5d5d5',
		'border-hover': '#c5c5c5',
		'accent-primary': '#FF8C42',
		'accent-secondary': '#E67A2E',
		'accent-hover': '#FFA366',
		'success-color': '#10b981',
		'error-color': '#ef4444',
		'warning-color': '#f59e0b',
		'info-color': '#3b82f6',
		'code-bg': '#f5f5f5',
		'input-bg': '#ffffff',
		'input-border': '#d5d5d5',
	},
	ocean: {
		'bg-primary': '#0f172a',
		'bg-secondary': '#1e293b',
		'bg-tertiary': '#334155',
		'bg-hover': '#475569',
		'text-primary': '#f1f5f9',
		'text-secondary': '#94a3b8',
		'text-muted': '#64748b',
		'border-color': '#334155',
		'border-hover': '#475569',
		'accent-primary': '#0ea5e9',
		'accent-secondary': '#06b6d4',
		'accent-hover': '#38bdf8',
		'success-color': '#10b981',
		'error-color': '#ef4444',
		'warning-color': '#f59e0b',
		'info-color': '#3b82f6',
		'code-bg': '#1e293b',
		'input-bg': '#1e293b',
		'input-border': '#334155',
	},
	forest: {
		'bg-primary': '#0a1f0a',
		'bg-secondary': '#1a2f1a',
		'bg-tertiary': '#2a4f2a',
		'bg-hover': '#3a5f3a',
		'text-primary': '#e8f5e8',
		'text-secondary': '#b8d5b8',
		'text-muted': '#88a588',
		'border-color': '#2a4f2a',
		'border-hover': '#3a5f3a',
		'accent-primary': '#10b981',
		'accent-secondary': '#059669',
		'accent-hover': '#34d399',
		'success-color': '#10b981',
		'error-color': '#ef4444',
		'warning-color': '#f59e0b',
		'info-color': '#3b82f6',
		'code-bg': '#1a2f1a',
		'input-bg': '#1a2f1a',
		'input-border': '#2a4f2a',
	},
	sunset: {
		'bg-primary': '#1f0a0a',
		'bg-secondary': '#2f1a1a',
		'bg-tertiary': '#4f2a2a',
		'bg-hover': '#5f3a3a',
		'text-primary': '#f5e8e8',
		'text-secondary': '#d5b8b8',
		'text-muted': '#a58888',
		'border-color': '#4f2a2a',
		'border-hover': '#5f3a3a',
		'accent-primary': '#f97316',
		'accent-secondary': '#ea580c',
		'accent-hover': '#fb923c',
		'success-color': '#10b981',
		'error-color': '#ef4444',
		'warning-color': '#f59e0b',
		'info-color': '#3b82f6',
		'code-bg': '#2f1a1a',
		'input-bg': '#2f1a1a',
		'input-border': '#4f2a2a',
	},
	midnight: {
		'bg-primary': '#000000',
		'bg-secondary': '#1a1a1a',
		'bg-tertiary': '#2a2a2a',
		'bg-hover': '#3a3a3a',
		'text-primary': '#ffffff',
		'text-secondary': '#b8b8b8',
		'text-muted': '#888888',
		'border-color': '#2a2a2a',
		'border-hover': '#3a3a3a',
		'accent-primary': '#8b5cf6',
		'accent-secondary': '#7c3aed',
		'accent-hover': '#a78bfa',
		'success-color': '#10b981',
		'error-color': '#ef4444',
		'warning-color': '#f59e0b',
		'info-color': '#3b82f6',
		'code-bg': '#1a1a1a',
		'input-bg': '#1a1a1a',
		'input-border': '#2a2a2a',
	},
	vscode: {
		'bg-primary': '#1e1e1e',
		'bg-secondary': '#252526',
		'bg-tertiary': '#2d2d30',
		'bg-hover': '#3e3e42',
		'text-primary': '#cccccc',
		'text-secondary': '#9d9d9d',
		'text-muted': '#6e6e6e',
		'border-color': '#3e3e42',
		'border-hover': '#4e4e52',
		'accent-primary': '#007acc',
		'accent-secondary': '#005a9e',
		'accent-hover': '#1e8ad6',
		'success-color': '#89d185',
		'error-color': '#f48771',
		'warning-color': '#cca700',
		'info-color': '#75beff',
		'code-bg': '#1e1e1e',
		'input-bg': '#3c3c3c',
		'input-border': '#3e3e42',
	},
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};

interface ThemeProviderProps {
	children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const { isVSCode, theme: vscodeTheme } = useVSCode();

	const [currentTheme, setCurrentTheme] = useState<ThemeName>(
		isVSCode ? 'vscode' : 'ocean'
	);

	const mode: 'standalone' | 'vscode' = isVSCode ? 'vscode' : 'standalone';
	const availableThemes: ThemeName[] = isVSCode
		? ['vscode']
		: ['ocean', 'forest', 'sunset', 'midnight', 'corporate'];

	// Apply theme colors to CSS variables
	useEffect(() => {
		// In VSCode mode, don't apply any theme until we have the vscodeTheme
		if (isVSCode && !vscodeTheme) {
			return;
		}

		const root = document.documentElement;

		// Determine which colors to use
		let colors: ThemeColors;
		if (isVSCode && vscodeTheme) {
			colors = vscodeTheme;
		} else {
			colors = THEMES[currentTheme];
		}

		// Apply colors as CSS variables
		Object.entries(colors).forEach(([key, value]) => {
			// If key already has --, use it as is, otherwise add --
			const cssVarName = key.startsWith('--') ? key : `--${key}`;
			root.style.setProperty(cssVarName, value);
		});

	}, [currentTheme, vscodeTheme, isVSCode]);

	const setTheme = (theme: ThemeName) => {
		// Only allow theme switching in standalone mode
		if (!isVSCode) {
			setCurrentTheme(theme);
		}
	};

	return (
		<ThemeContext.Provider value={{
			currentTheme: isVSCode ? 'vscode' : currentTheme,
			setTheme,
			isVSCode,
			mode,
			availableThemes
		}}>
			{children}
		</ThemeContext.Provider>
	);
};

```

### Core Architecture Module: `apps/chat-ui/src/hooks/useVSCode.tsx`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { createContext, useContext, ReactNode } from 'react';

interface VSCodeTheme {
	[key: string]: string;
}

export interface VSCodeContextType {
	isVSCode: boolean;
	isReady: boolean;
	theme: VSCodeTheme | null;
}

const VSCodeContext = createContext<VSCodeContextType | undefined>(undefined);

interface VSCodeProviderProps {
	children: ReactNode;
	value: VSCodeContextType;
}

export const VSCodeProvider: React.FC<VSCodeProviderProps> = ({ children, value }) => {
	return (
		<VSCodeContext.Provider value={value}>
			{children}
		</VSCodeContext.Provider>
	);
};

export const useVSCode = (): VSCodeContextType => {
	const context = useContext(VSCodeContext);
	if (context === undefined) {
		throw new Error('useVSCode must be used within a VSCodeProvider');
	}
	return context;
};

```

### Core Architecture Module: `apps/chat-ui/src/utils/pipelineUtils.ts`
```
/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { PIPELINE_RESULT } from 'rocketride';

/**
 * Extracts text responses from pipeline result
 *
 * The PIPELINE_RESULT structure uses a dynamic field system where:
 * - result_types maps field names to their data types
 * - Actual data is stored in fields identified by result_types
 * - Fields marked as "text" or "answers" contain displayable strings
 *
 * @param result - Pipeline result from RocketRide API
 * @returns Array of text strings ready for display
 * 
 * @example
 * // If result has: { result_types: { "answers": "answers" }, answers: ["Hello", "World"] }
 * // Returns: ["Hello", "World"]
 */
export interface TextResult {
	text: string;
	key: string;
}

export const extractTextFromResult = (result: PIPELINE_RESULT): TextResult[] => {
	const textResponses: TextResult[] = [];

	// If we didn't get any result types, make sure they were returned
	if (!result.result_types) {
		textResponses.push({ text: '### I don\'t see any answers in there...\nAre you sure you returned them in your pipeline?', key: '' });
		return textResponses;
	}

	// Iterate through result_types to find fields containing text/answers
	for (const [fieldName, fieldType] of Object.entries(result.result_types)) {
		if (fieldType === 'text' || fieldType === 'answers') {
			const fieldData = result[fieldName];

			if (Array.isArray(fieldData)) {
				fieldData.filter(item => typeof item === 'string' && item.trim())
					.forEach(item => textResponses.push({ text: item, key: fieldName }));
			} else if (typeof fieldData === 'string' && fieldData.trim()) {
				textResponses.push({ text: fieldData, key: fieldName });
			} else if (typeof fieldData === 'object' && fieldData !== null && typeof (fieldData as Record<string, unknown>).answer === 'string') {
				// Answer objects arrive as { answer: string, expectJson: bool } — extract the text directly.
				const text = ((fieldData as Record<string, unknown>).answer as string).trim();
				if (text) textResponses.push({ text, key: fieldName });
			}
		}
	}

	return textResponses;
};
```

### Core Architecture Module: `apps/dropper-ui/src/components/Views/MarkdownRenderer.tsx`
```
/**
 * MIT License
 * Copyright (c) 2026 Aparavi Software AG
 * See LICENSE file for details.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Props for the MarkdownRenderer component
 */
interface MarkdownRendererProps {
	/** Markdown-formatted string to render as HTML */
	content: string;
}

/**
 * MarkdownRenderer - Advanced markdown parser with syntax highlighting
 * 
 * Renders markdown content with GitHub Flavored Markdown (GFM) support and
 * custom styling. This component provides a rich text display experience with:
 * 
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, etc.)
 * - Syntax-highlighted code blocks using Prism
 * - Custom table styling with responsive wrapper
 * - External links with proper security attributes
 * - Styled blockquotes and lists
 * - Inline code highlighting
 * - Safe rendering (escapes potentially dangerous HTML)
 * 
 * Code Block Support:
 * - Detects language from code fence (```language)
 * - Applies syntax highlighting for 100+ languages
 * - Uses oneDark theme for consistent appearance
 * - Inline code uses simple background styling
 * 
 * Security:
 * - External links open in new tab with rel="noopener noreferrer"
 * - Does not render raw HTML to prevent XSS and invalid tag errors
 * - All content is escaped by default
 * 
 * Styling:
 * - Custom CSS classes applied via markdown-* prefixes
 * - Integrates with application's design system
 * - Responsive tables with horizontal scroll wrapper
 * 
 * @component
 * @example
 * ```tsx
 * <MarkdownRenderer content={`
 * # Hello World
 * 
 * Here's some **bold** text and a [link](https://example.com).
 * 
 * \`\`\`javascript
 * console.log('Syntax highlighted!');
 * \`\`\`
 * `} />
 * ```
 * 
 * @param props - Component props
 * @param props.content - Markdown string to render
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
	return (
		<ReactMarkdown
			// Enable GitHub Flavored Markdown extensions
			remarkPlugins={[remarkGfm]}
			// NOTE: rehypeRaw removed to prevent invalid HTML tags from PDFs
			// Custom component renderers for specific elements
			components={{
				/**
				 * Code block renderer with syntax highlighting
				 * Distinguishes between inline code and code blocks
				 */
				code: (props: any) => {
					const { inline, className, children, ...rest } = props;
					// Extract language from className (format: language-xxx)
					const match = /language-(\w+)/.exec(className || '');
					// Remove trailing newline from code content
					const codeContent = String(children).replace(/\n$/, '');

					// Render syntax-highlighted block for non-inline code with language
					return !inline && match ? (
						<SyntaxHighlighter
							style={oneDark}
							language={match[1]}
							PreTag="div"
							customStyle={{
								margin: 0,
								borderRadius: '6px',
								fontSize: 'var(--vscode-editor-font-size, 13px)'
							}}
						>
							{codeContent}
						</SyntaxHighlighter>
					) : (
						// Render simple inline code with background
						<code className={className} {...rest}>
							{children}
						</code>
					);
				},

				/**
				 * Table renderer with responsive wrapper
				 * Prevents table overflow on small screens
				 */
				table: (props) => {
					return (
						<div className="table-wrapper">
							<table className="markdown-table">
								{props.children}
							</table>
						</div>
					);
				},

				/**
				 * Link renderer with security attributes
				 * Opens external links in new tab safely
				 */
				a: (props) => {
					return (
						<a
							href={props.href}
							target="_blank"
							rel="noopener noreferrer"
							className="markdown-link"
						>
							{props.children}
						</a>
					);
				},

				/**
				 * Blockquote renderer with custom styling
				 */
				blockquote: (props) => {
					return (
						<blockquote className="markdown-blockquote">
							{props.children}
						</blockquote>
					);
				},

				/**
				 * Unordered list renderer with custom styling
				 */
				ul: (props) => {
					return <ul className="markdown-list">{props.children}</ul>;
				},

				/**
				 * Ordered list renderer with custom styling
				 */
				ol: (props) => {
					return <ol className="markdown-list">{props.children}</ol>;
				}
			}}
		>
			{content}
		</ReactMarkdown>
	);
};

```

### Core Architecture Module: `apps/dropper-ui/src/hooks/clientSingleton.ts`
```
/**
 * MIT License
 * Copyright (c) 2026 Aparavi Software AG
 * See LICENSE file for details.
 */

/**
 * RocketRide Client Singleton Module
 * 
 * Manages a single, shared WebSocket connection to RocketRideservices across
 * the entire application. This singleton pattern ensures:
 * 
 * Benefits:
 * - Only one WebSocket connection exists (no duplicate connections)
 * - Connection persists across component mount/unmount cycles
 * - Immune to React StrictMode double-mounting
 * - Multiple components can share the same connection
 * - Automatic reconnection handling
 * - Centralized event broadcasting
 * 
 * Architecture:
 * - Singleton instance stored outside React lifecycle
 * - Pub/sub pattern for event distribution
 * - Promise-based connection management
 * - Session-based authentication caching
 * 
 * Event Types:
 * - Connection events: broadcast when WebSocket connects
 * - Disconnection events: broadcast when WebSocket disconnects
 * - Message events: broadcast for all incoming RocketRidemessages
 * - Status events: broadcast for UI status updates
 * 
 * Authentication Flow:
 * 1. Check session storage for cached token
 * 2. In dev mode: use API key from config
 * 3. In production: check URL params or fetch from /api/auth
 * 4. Cache token in session storage for reuse
 * 
 * @module clientSingleton
 */

import { RocketRideClient, RocketRideClientConfig, ConnectionException } from 'rocketride';
import { API_CONFIG } from '../config/apiConfig';

// ============================================================================
// SINGLETON STATE
// ============================================================================

/** The single shared RocketRideClient instance (null if not yet created) */
let clientInstance: RocketRideClient | null = null;

// ============================================================================
// SUBSCRIBER TYPES
// ============================================================================

/** Callback for RocketRidemessage events */
type EventSubscriber = (message: any) => void | Promise<void>;

/** Callback for successful connection events */
type ConnectionSubscriber = (client: RocketRideClient) => void | Promise<void>;

/** Callback for disconnection events */
type DisconnectionSubscriber = (reason: string, hasError: boolean) => void | Promise<void>;

/** Callback for UI status message updates */
type StatusSubscriber = (message: string | null) => void;

// ============================================================================
// SUBSCRIBER COLLECTIONS
// ============================================================================

/** Set of functions subscribed to RocketRidemessage events */
const eventSubscribers = new Set<EventSubscriber>();

/** Set of functions subscribed to connection events */
const connectedSubscribers = new Set<ConnectionSubscriber>();

/** Set of functions subscribed to disconnection events */
const disconnectedSubscribers = new Set<DisconnectionSubscriber>();

/** Set of functions subscribed to status message updates */
const statusSubscribers = new Set<StatusSubscriber>();

/**
 * Last connection error (from connect failure or onDisconnected with hasError).
 * Stored so late subscribers can display it.
 */
let lastConnectionError: { reason: string; hasError: boolean } | null = null;

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Retrieves authentication token from various sources
 * 
 * Token Priority:
 * 1. Session storage (cached from previous retrieval)
 * 2. Dev mode: API key from configuration
 * 3. Production: URL parameter or /api/auth endpoint
 * 
 * Caching:
 * - Tokens are cached in sessionStorage for reuse
 * - Reduces authentication requests
 * - Cleared on browser tab close
 * 
 * URL Cleanup:
 * - Removes token from URL bar after extraction (security)
 * - Uses history.replaceState to avoid adding to browser history
 * 
 * @returns Authentication token string or null if unavailable
 * 
 * @example
 * ```typescript
 * const token = await getAuthToken();
 * if (!token) {
 *   throw new Error('Authentication failed');
 * }
 * ```
 */
async function getAuthToken(): Promise<string | null> {
	// Check session storage first for cached token
	let auth = sessionStorage.getItem('auth');
	if (auth) return auth;

	if (API_CONFIG.devMode) {
		// Development mode: use API key from configuration
		auth = API_CONFIG.ROCKETRIDE_APIKEY || null;
	} else {
		// Production mode or vscode: check URL params or fetch from backend
		const urlParams = new URLSearchParams(window.location.search);
		auth = urlParams.get('token');

		if (!auth) {
			// No token in URL, fetch from backend authentication service
			try {
				const response = await fetch('/api/auth');
				if (!response.ok) return null;
				const result = await response.json();
				auth = result.auth;
			} catch {
				return null;
			}
		} else {
			// Token found in URL - clean up URL bar for security
			if (window.location.search.includes('token=')) {
				window.history.replaceState({}, "", window.location.pathname);
			}
		}
	}

	// Cache token in session storage for subsequent requests
	if (auth) sessionStorage.setItem('auth', auth);
	return auth;
}

// ============================================================================
// EVENT BROADCASTING
// ============================================================================

/**
 * Broadcasts incoming RocketRideevents to all subscribed listeners
 * 
 * Error Handling:
 * - Individual subscriber errors are caught and logged
 * - One failing subscriber doesn't affect others
 * - Ensures all subscribers receive the event
 * 
 * @param message - Event message from RocketRideclient
 */
async function handleEvent(message: any): Promise<void> {
	for (const subscriber of eventSubscribers) {
		try {
			await subscriber(message);
		} catch (error) {
			console.error('Error in event subscriber:', error);
		}
	}
}

/**
 * Broadcasts connection event to all subscribed listeners
 * 
 * Flow:
 * 1. Clears any status messages (connection successful)
 * 2. Notifies all connection subscribers
 * 3. Allows subscribers to perform setup (e.g., initialize pipelines)
 * 
 * @param client - The connected RocketRideClient instance
 */
async function handleConnected(client: RocketRideClient): Promise<void> {
	lastConnectionError = null;

	// Clear any status messages (e.g., "Connecting...")
	for (const subscriber of statusSubscribers) {
		try {
			subscriber(null);
		} catch (error) {
			console.error('Error in status subscriber:', error);
		}
	}

	// Notify connection subscribers
	for (const subscriber of connectedSubscribers) {
		try {
			await subscriber(client);
		} catch (error) {
			console.error('Error in connected subscriber:', error);
		}
	}
}

/**
 * Broadcasts disconnection event to all subscribed listeners
 * 
 * Flow:
 * 1. Shows descriptive error message from server
 * 2. Notifies all disconnection subscribers
 * 3. SDK will automatically attempt reconnection
 * 
 * Server Error Messages:
 * - HTTP 400: Pipeline not running
 * - HTTP 401: Authentication error
 * - Other: Connection lost or network errors
 * 
 * @param reason - Reason for disconnection (from server or network)
 * @param hasError - Whether disconnection was due to an error
 */
async function handleDisconnected(reason: string, hasError: boolean): Promise<void> {
	if (hasError) {
		lastConnectionError = { reason, hasError: true };
	}

	// Notify disconnection subscribers - they handle their own status display logic
	for (const subscriber of disconnectedSubscribers) {
		try {
			await subscriber(reason, hasError);
		} catch (error) {
			console.error('Error in disconnected subscriber:', error);
		}
	}
}

// ============================================================================
// CLIENT MANAGEMENT
// ============================================================================

/**
 * CONNECTION FLOW (persist mode): With persist, connect() resolves after first attempt
 * (success or scheduled retry). Client calls onConnectError on each failure and keeps
 * retrying. Subscribers get catch-up on subscribe if lastConnectionError is set.
 */

/**
 * Starts the RocketRideclient singleton with persistent connection
 * 
 * This function initializes the client once and enables automatic reconnection.
 * If the client is already started, this function does nothing (idempotent).
 * With persist, the client retries from initial failure and calls onConnectError.
 * 
 * @param authToken - Optional authentication token. If not provided, calls getAuthToken()
 * @throws Error if authentication token cannot be obtained
 * 
 * @example
 * ```typescript
 * // In App.tsx
 * await startClient(token);
 * ```
 */
export async function startClient(authToken?: string): Promise<void> {
	// Already started - do nothing (idempotent)
	if (clientInstance) {
		return;
	}

	// Get authentication token
	const token = authToken || await getAuthToken();
	
	if (!token) {
		throw new Error("Sorry, I couldn't get you authenticated. Please contact your system admin.");
	}

	// Create client first (before config) so we can reference it in callbacks
	let client: RocketRideClient;
	
	const config: RocketRideClientConfig = {
		auth: token,
		uri: API_CONFIG.ROCKETRIDE_URI || (typeof window !== 'undefined' ? window.location.origin : ''),
		persist: true,
		onEvent: handleEvent,
		onConnected: async (_info?: string) => {
			await handleConnected(client);
		},
		onDisconnected: async (reason?: string, hasError?: boolean) => {
			await handleDisconnected(reason || 'Connection lost', hasError || false);
		},
		onConnectError: (error: ConnectionException) =>
			handleDisconnected(error.message, true).catch((e) => console.error('handleDisconnected:', e)),
		env: API_CONFIG,
	};

	client = new RocketRideClient(config);
	await client.connect();
	clientInstance = client;
}

/**
 *
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3363** (2026-11-19): **llm_openai_api sends temperature: 0 on every call: Claude Opus 4.7 and later, OpenAI o3 and gpt-6.2-sol, and gateway deployments in front of them return an LLM error instead of an answer**
  *Symptoms*: ### Description  `llm_openai_api` builds its client with `'temperature': 0` for every model (`nodes/src/nodes/llm_openai_api/openai_client.py`), and the node has no setting for it: its settings are `model`, `base_url`, `apikey`, `modelTotalTokens` and `modelOutputTokens`. Models that no longer accept a caller-set temperature answer HTTP 400, so the node cannot be used with them. This is the same on 3.6.0.38 and 3.6.0.738, and the file is unchanged on develop (77e7ed78).  One `chat()` per model through `chat -> llm_openai_api -> response_answers` on 3.6.0.738, 28 combinations, 13 failed:  | Endpoint | Failed | Worked | |---|---|---| | Anthropic's OpenAI-compatible endpoint (`https://api.anthropic.com/v1/`) | `claude-fable-5-2`, `claude-fable-5-1`, `claude-fable-5`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5`, `claude-sonnet-5`, `claude-opus-4-8`, `claude-opus-4-7` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929` | | OpenAI API | `o3`, `gpt-6.2-sol` | `gpt-5`, `gpt-5-mini`, `gpt-5.1`, `gpt-5.5`, `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` | | Ollama 0.40.16 on localhost | none | `llama3.2` | | LiteLLM 1.106.7 gateway over the Anthropic Messages API, custom deployment names | the deployment that serves `claude-opus-5-5` | the deployment that serves `claude-sonnet-4-6`; the `claude-opus-5-5` deployment with `drop_params: true` |  For every failing row, a direct `POST chat/complet

- **Issue #3246** (2026-11-18): **A stopped task on Linux reports exit code 1 and a source location as its exit message**
  *Symptoms*: Found while following up #3024 (issue #2879, crash reporting) after its merge; reproduced on develop `2bfff9e54`.  ### Problem Statement  A task stopped on request (`client.terminate(token)`) ends with a different exit code and exit message per platform, through a real `eaas.py`:  | Platform | `status` | `exitCode` | `exitMessage` | | --- | --- | --- | --- | | Linux (WSL) | `Stopped` | `1` | `Queue.hpp:61` | | Windows | `Stopped` | `0` | empty |  Each row held in 3 runs of 3. On Linux the dashboard also gets a `task_error` for the stop. A `SIGTERM` sent straight to a Linux task process by someone other than the server reads the same as the Linux row (3 runs of 3).  What happens on Linux, from the code:  - The stop ends the engine with an error that has a code and a place but no text: `cancel(APERR(ec))` at `packages/server/engine-core/apLib/async/Queue.hpp:61`. `App::outputWarningOrError` (`packages/server/engine-lib/engLib/monitor/App.hpp`) writes the code, the text and the place joined by `*`, and an error with no text comes out as three fields: `>EXIT*Cancelled*Queue.hpp:61` (the raw line, read from a task process while reviewing #3024; the server's result above matches only this form). - `packages/ai/src/ai/common/dap/transport_stdio.py` reads a three-field line as `>EXIT*<code>*<message>`: the place becomes the exit message, and a code name that is not hex becomes exit code 1. - The four-field branch maps only `CANCELLED` to exit code 0. No engine code has that name (`Ec

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

### Incident Patch 1: `b5952dd0` (2026-11-16)
**Commit Message**: fix(anonymize): fail closed when a GLiNER prediction fails (#3172)

* fix(anonymize): fail closed when GLiNER prediction fails

Propagate chunk failures and prevent closing from emitting unredacted text after a failed classification callback. Preserve valid empty detections.

Co-Authored-By: Codex <[REDACTED_EMAIL]>

* fix(anonymize): report the GLiNER cause and test the real guards

Review follow-up to the fail-closed change.

- The engine builds a document's error from the raised exception's
  message only and never reads __cause__ (engLib/python/call.hpp), so
  the error said "Anonymization failed" with no sign of a CUDA out of
  memory or a model-server failure. process_chunk now puts the cause in
  its message (the exception type when the message is empty) and the
  outer handler appends that text once, so the document error reads
  "Anonymization failed; no redacted result is available: GLiNER
  inference failed for chunk N: <cause>".
- The run-mode test swapped in a BoundedSemaphore that develop never
  uses, on a one-chunk text. It is replaced by a test in
  test_predict_lock.py that builds the recognizer through its real
  __init__ in both run modes (threading.Lock in-proc

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **twelvelabs**: the node buffered an entire video in a Python list before submitting it, so a large upload held the whole file in memory at once. Incoming chunks now stream straight to a `mkstemp` temp file on `BEGIN`/`WRITE`, and the file is submitted and deleted on `END`; a displaced stream (a second `BEGIN` with no prior `END`) and a document that reaches `closing()` without ever getting an `END` both release their temp file too (#2564)
 - **tool_github**: `file_get` returned an empty `content` without a word for files over 1 MB, the Contents API's limit, so an agent verifying code read missing evidence as an empty file. It now reads such files through the Git blob API by the SHA the metadata named (GitHub serves blobs up to 100 MB), up to a new `max_bytes` input (default 1 MiB, the Contents API's own boundary, so a larger file is reported, not downloaded, until the call raises it; refused from the metadata before any download); when GitHub cannot serve the content, for a file over 100 MB or a blob read that fails, or when such a file is binary (a NUL byte in its first 8000 bytes), `content` is `null` and `message` says why and what to do instead (#2464)
 - **ai, nodes**: task and vector-store errors give a short cause and recovery action; detailed SDK, pipeline-lane and agent-tool guidance moved to `docs/agents/skills/rocketride-debugging-pipelines/ERROR_TABLE.md`, with the previous wording of each message. A run request whose pipeline is missing, empty or not an object is refused with one message on both the launch and execute paths, instead of an AttributeError, a TypeError or a no-source report for an empty `{}` (#2476, #2465)
+- **anonymize**: a GLiNER prediction that failed for one chunk or label batch, such as CUDA out of memory or a model-server error, was logged at debug level and skipped, so the node passed the document on as a success with that chunk's entities left unredacted, or with the original text when every chunk failed. A failed prediction now fails the document with the cause and the node emits no text for it; the rest of the batch and the task continue, in-process and with `--modelserver`. A prediction that succeeds and finds no entities still passes the text through unchanged. When handling classifier input fails, the node no longer emits the text it was holding when the object closes (#3172)
 - **ai**: a document batch missing an embedding vector or model name failed with `object of type 'NoneType' has no len()`, or created the collection and wrote its setup record with no model name before being refused; it is now refused before anything is created or written, on an existing collection too, and a semantic question without a vector is refused before the store driver is called (#2476)
 - **agent_langchain, agent_deepagent**: each tool's input schema reached the model three times per step (pasted into the description, as the generated argument schema, and as the original schema); it is now sent once, the original when available. LlamaIndex keeps the schema in the description, which is the only schema it has (#2995)
 - **ai**: deploying or publishing an app from an organization with no developer id told the user to run `rrext_app developer_register`, a subcommand `rrext_app` rejects (registration lives on `rrext_deploy_app`). The error now names the ways that work: the Deploy tab in the App Builder, `rocketride app developer register <id>` (npm CLI) or `client.registerDeveloper(id)` (Python: `client.register_developer(id)`), and says that only an org admin can register, once and permanently (#2471)
```

**File**: `nodes/src/nodes/anonymize/IInstance.py` (modified, +15/-3)
```diff
@@ -21,6 +21,8 @@
 # SOFTWARE.
 # =============================================================================
 
+from typing import Optional
+
 from rocketlib import Entry, IInstanceBase
 from .IGlobal import IGlobal
 
@@ -33,10 +35,12 @@ class IInstance(IInstanceBase):
     #
     target_object_text: str = ''
     has_classifications: bool = False
+    _anonymize_error: Optional[BaseException] = None
 
     def open(self, object: Entry):
         self.target_object_text = ''
         self.has_classifications = False
+        self._anonymize_error = None
 
     def writeText(self, text: str):
         self.target_object_text = self.target_object_text + text
@@ -45,11 +49,19 @@ def writeText(self, text: str):
 
     def writeClassifications(self, classifications: dict, classificationPolicy: dict, classificationRules: dict):
         self.has_classifications = True
-        self.target_object_text = self.IGlobal.recognizer.handleClassifications(
-            classifications, self.target_object_text, classificationPolicy, classificationRules
-        )
+        try:
+            self.target_object_text = self.IGlobal.recognizer.handleClassifications(
+                classifications, self.target_object_text, classificationPolicy, classificationRules
+            )
+        except Exception as exc:
+            self._anonymize_error = exc
+            raise
 
     def closing(self):
+        # The engine still calls closing() after writeClassifications raised, and
+        # target_object_text then still holds the unredacted input: emit nothing.
+        if self._anonymize_error is not None:
+            raise RuntimeError('Cannot emit text after failed anonymization') from self._anonymize_error
         if not self.has_classifications:
             # No classifications received - anonymize with the configured entity types
             self.target_object_text = self.IGlobal.recognizer.process(
```

**File**: `nodes/src/nodes/anonymize/README.md` (modified, +6/-3)
```diff
@@ -107,9 +107,12 @@ plan for, especially before selecting a larger profile.
 
 Text is processed in 1,024-character chunks with 128-character overlap, label
 lists are sent in batches of 32, and up to four chunks run concurrently.
-Duplicate entities from overlapping chunks are removed. A model error for one
-label batch or chunk is logged and processing continues, so review redaction
-results when complete coverage is required.
+Duplicate entities from overlapping chunks are removed. If prediction fails for
+any chunk or label batch, the document fails with an error that names the chunk
+and the cause, and the node emits no text for it; other documents continue. If
+handling classifier input fails, the node likewise emits no text for that
+document. A prediction that succeeds and finds no entities passes the text
+through unchanged.
 
 ### Classifier input
 
```

**File**: `nodes/src/nodes/anonymize/glinerRecognizer.py` (modified, +12/-4)
```diff
@@ -178,7 +178,13 @@ def process_chunk(chunk_idx):
                         chunk_results.append(res)
 
                 except Exception as e:
-                    debug(f'Anonymize: GLiNER Error on chunk {chunk_idx} with labels {label_batch}: {str(e)}')
+                    # A failed prediction is not evidence that the chunk contains
+                    # no sensitive entities. Never return partially redacted text.
+                    # The cause goes in the message: the engine reports only the
+                    # raised exception's text, never its __cause__.
+                    raise RuntimeError(
+                        f'GLiNER inference failed for chunk {chunk_idx}: {str(e) or type(e).__name__}'
+                    ) from e
 
             return chunk_results
 
@@ -191,9 +197,11 @@ def process_chunk(chunk_idx):
                 try:
                     all_results.extend(future.result())
                 except Exception as e:
-                    # Per-batch failures are already handled inside process_chunk,
-                    # so this only catches a failure in the surrounding scaffolding.
-                    debug(f'Anonymize: Error processing chunk: {str(e)}')
+                    for pending in futures:
+                        pending.cancel()
+                    # e is process_chunk's error, which already names the chunk and
+                    # the root cause, so its text is appended once here.
+                    raise RuntimeError(f'Anonymization failed; no redacted result is available: {e}') from e
 
                 completed += 1
                 if completed % 5 == 0 or completed == total_chunks:
```

**File**: `nodes/test/anonymize/test_failure_contract.py` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# =============================================================================
+# MIT License
+# Copyright (c) 2026 Aparavi Software AG
+# =============================================================================
+
+"""
+Tests for the anonymize node's failure contract in ``IInstance``.
+
+If ``writeClassifications`` fails, ``closing()`` must not emit the text the node
+was holding, which is still the unredacted input. ``IInstance.py`` is loaded by
+file path under a synthetic package, with ``rocketlib`` and the package's
+``IGlobal`` stubbed through ``monkeypatch`` so they are restored afterwards.
+
+Usage:
+    ./builder.cmd nodes:test --pytest-pattern=anonymize --verbose
+"""
+
+import importlib.util
+from pathlib import Path
+import sys
+import types
+
+import pytest
+
+
+def test_failed_classification_cannot_emit_on_closing(monkeypatch):
+    """A failed ``writeClassifications`` makes ``closing()`` raise and emit nothing; ``open()`` resets it."""
+    root = Path(__file__).parents[2] / 'src/nodes/anonymize'
+    package = types.ModuleType('_anonymize_failure_contract')
+    package.__path__ = [str(root)]
+    glb = types.ModuleType(package.__name__ + '.IGlobal')
+    glb.IGlobal = type('IGlobal', (), {})
+    monkeypatch.setitem(sys.modules, package.__name__, package)
+    monkeypatch.setitem(sys.modules, glb.__name__, glb)
+    monkeypatch.setitem(sys.modules, 'rocketlib', types.SimpleNamespace(Entry=object, IInstanceBase=object))
+    spec = importlib.util.spec_from_file_location(package.__name__ + '.IInstance', root / 'IInstance.py')
+    module = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(module)
+    instance = module.IInstance()
+    assert instance._anonymize_error is None, 'the class default must exist before open() runs'
+    emitted = []
+
+    def fail(*args):
+        raise RuntimeError('injected prediction failure')
+
+    instance.IGlobal = types.SimpleNamespace(recognizer=types.SimpleNamespace(handleClassifications=fail))
+    instance.instance = types.SimpleNamespace(writeText=emitted.append)
+    instance.open(None)
+    instance.target_object_text = 'Alice Example'
+    with pytest.raises(RuntimeError, match='prediction failure'):
+        instance.writeClassifications({}, {}, {})
+    with pytest.raises(RuntimeError, match='failed anonymization'):
+        instance.closing()
+    assert emitted == []
+    instance.open(None)
+    assert instance._anonymize_error is None
```

**File**: `nodes/test/anonymize/test_predict_lock.py` (modified, +50/-3)
```diff
@@ -12,6 +12,9 @@
 passes, and a no-op with ``--modelserver`` so the recognizer's chunk workers reach
 the model server's own workers instead of queueing here one request at a time.
 
+A failed forward pass must fail the document in both run modes, with its cause in
+the message and the guard free again; the unredacted text must never come back.
+
 ``glinerRecognizer.py`` is loaded by file path under a synthetic package whose
 ``__path__`` is the node's source directory, so its relative imports
 (``.Ruleparser``, ``.anonymize``) resolve to the real modules. The GLiNER model
@@ -24,6 +27,7 @@
 
 import contextlib
 import importlib.util
+import re
 import sys
 import threading
 import time
@@ -153,8 +157,9 @@ def test_model_server_predictions_run_concurrently(make_recognizer, monkeypatch)
     """Proxy mode: the four chunk workers are inside ``predict_entities`` at the same time."""
     rec = make_recognizer(model_server=True)
     # Four parties = the four chunks of _TEXT, one per worker of the recognizer's pool.
-    # process_chunk swallows exceptions, so a BrokenBarrierError would not propagate: it
-    # would show up as a missing forward pass, hence the count and the content check.
+    # If the workers were serialized, the barrier would break and the BrokenBarrierError
+    # would fail predict() with 'Anonymization failed'. The count and the content check
+    # below are extra checks on top of that.
     barrier = threading.Barrier(4, timeout=10)
     state = {'completed': 0}
     guard = threading.Lock()
@@ -181,5 +186,47 @@ def test_model_server_recognizers_run_concurrently_across_documents(make_recogni
 
     results = _run_threads(4, lambda: rec.predict('short text', ['person']))
 
-    # A swallowed BrokenBarrierError would leave a document with no entities.
+    # A broken barrier fails that document's predict() with 'Anonymization failed', which
+    # _run_threads reports through its errors assert; the content check is an extra check.
     assert [[(e['label'], e['text']) for e in r] for r in results] == [[('person', 'shor')]] * 4
+
+
+@pytest.mark.parametrize(
+    ('model_server', 'guard_type'),
+    [(False, type(threading.Lock())), (True, contextlib.nullcontext)],
+    ids=['local', 'modelserver'],
+)
+def test_model_error_fails_the_document_in_both_run_modes(
+    make_recognizer, monkeypatch, model_server, guard_type
+) -> None:
+    """A failed forward pass fails ``process()`` with its cause, under the run mode's real guard.
+
+    The text spans several chunks, so the other chunk workers are queued or in flight
+    when the first one fails. The original text must never come back, and in-process
+    the lock must be free again afterwards.
+    """
+    rec = make_recognizer(model_server=model_server)
+    assert isinstance(rec._predict_lock, guard_type)
+    text = 'Alice Example works at Example Company. ' * 100
+    assert len(text) > 1024, 'the text must span several chunks'
+
+    def on_predict() -> None:
+        raise RuntimeError('injected inference failure')
+
+    monkeypatch.setattr(_StubGLiNER, 'on_predict', staticmethod(on_predict))
+
+    try:
+        result = rec.process(text, ['person'])
+    except RuntimeError as error:
+        message = str(error)
+    else:
+        assert result != text, 'process() returned the original, unredacted text after a model error'
+        pytest.fail('process() returned text after a model error')
+
+    assert re.fullmatch(
+        r'Anonymization failed; no redacted result is available: '
+        r'GLiNER inference failed for chunk \d+: injected inference failure',
+        message,
+    ), message
+    if not model_server:
+        assert not rec._predict_lock.locked(), 'the in-process lock must be released after a failed prediction'
```

**File**: `nodes/test/test_gliner_predict.py` (modified, +29/-7)
```diff
@@ -10,12 +10,14 @@
 concurrent forward passes, so a lock is held around ``predict_entities`` only:
 chunking, offset arithmetic and the overlap filter stay concurrent.
 
-These tests pin two things:
+These tests pin three things:
 
 * the entities and offsets ``predict`` returns for a multi-chunk input, which is
-  what the overlap filter and the final dedup decide, and
+  what the overlap filter and the final dedup decide,
 * that concurrent chunks never enter ``predict_entities`` at the same time,
-  while still genuinely running in parallel.
+  while still genuinely running in parallel, and
+* the failure contract: a failed prediction fails the whole call with its cause
+  in the message, while a prediction that finds nothing is still a success.
 
 No GLiNER model or engine is required: the module is loaded by path with the
 heavy dependencies stubbed, and a recording double stands in for the model.
@@ -283,8 +285,8 @@ def recording(chunk, labels):
     assert threading.current_thread().name not in calling_threads, 'work must run off the calling thread'
 
 
-def test_a_failing_chunk_does_not_lose_the_others():
-    """One bad batch is logged and skipped; the rest still come back."""
+def test_a_failing_chunk_rejects_partial_anonymization():
+    """One failed chunk makes the document fail instead of exposing unredacted text."""
     positions = [10, 900, 1800, 2700, 3600]
     text = build_text(positions)
 
@@ -300,9 +302,29 @@ def flaky(chunk, labels):
 
     model.predict_entities = flaky
 
-    results = make_recognizer(model).predict(text, ['organization'])
+    with pytest.raises(RuntimeError, match='Anonymization failed.*: CUDA error on this chunk$'):
+        make_recognizer(model).predict(text, ['organization'])
+
+
+def test_a_cause_without_a_message_is_named_by_its_type():
+    """An exception with an empty message, such as TimeoutError(), still names a cause."""
+    model = _MarkerModel()
+
+    def timeout(chunk, labels):
+        raise TimeoutError()
+
+    model.predict_entities = timeout
+
+    with pytest.raises(RuntimeError, match=r'GLiNER inference failed for chunk 0: TimeoutError$'):
+        make_recognizer(model).predict('short text', ['organization'])
+
 
-    assert results, 'a single chunk failure must not empty the result'
+def test_successful_empty_prediction_still_returns_original_text():
+    """A prediction that succeeds and finds nothing is a valid result, not a failure."""
+    recognizer = make_recognizer(_MarkerModel(marker='NOT_PRESENT'))
+    recognizer.redaction_style = 'mask'
+    recognizer.anonymize_char = 'X'
+    assert recognizer.process('Nothing matched.', ['person']) == 'Nothing matched.'
 
 
 @pytest.mark.parametrize('label_count', [1, 40, 70])
```

---

### Incident Patch 2: `dab02749` (2026-11-18)
**Commit Message**: feat(shell): descriptor telemetryId for the app stamp; consent at send time; port regressions (#3290)

* feat(shell): AppDescriptor.telemetryId sets the app stamp once per reporter

The shell binds each app's reporter to telemetryAppStamp(id, telemetryId): the descriptor's telemetryId when well formed, else its id. The stamp stays fixed at reporter creation, so per-event props still cannot overwrite app; auth facts keep app "shell". For apps whose dashboards predate the descriptor id (home-ui sets telemetryId: 'home-ui').

Also on the host: under a privacy signal (DNT/GPC) clear PostHog's persisted storage from earlier visits, as home-ui did before the port; and correct the ConsentedReporter doc (true means handed to the transport, not delivered).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(shell): consent at send time for experiment ids; Privacy settings opens under a privacy signal

attributionGate drops events carrying assignment_id or exposure_id unless consent reads accepted with no privacy signal when they are sent (consented before_send); the cookieless before_send always drops them. Queued and held events replay through before_send, so a withdrawal before the

**File**: `docs/agents/context/ROCKETRIDE_APPS.md` (modified, +17/-4)
```diff
@@ -536,6 +536,9 @@ interface AppDescriptor {
 	/** Optional cross-app component catalog. Never mounted by the shell —
 	 * entries are loadable by other apps via useAppComponent(). */
 	components?: { [key: string]: React.ComponentType<any> | undefined };
+	/** First-party apps only: the `app` value stamped on telemetry instead
+	 * of `id`. Ignored for other apps. See Telemetry below. */
+	telemetryId?: string;
 }
 ```
 
@@ -853,10 +856,20 @@ uses the snake_case `signup_properties` key. See the public Shell API signup att
 **Telemetry.** The shell owns the ONE product-telemetry transport: the key
 arrives from the server's pre-auth probe at runtime (never baked into any
 bundle), consent and delivery are the shell's, and the shell reports its own
-auth facts (`auth:start`, `auth:complete`). Your app receives a bound
-reporter from the shell — `useReport()` from `'shell'` — and calls
-`report(event, props?, options?)`; every event is stamped with YOUR app id,
-fixed at creation. Event names are your app's own taxonomy. `useConsent()`
+auth facts (`auth:start` with `is_authed: false`, `auth:complete` with
+`is_authed: true`) and consent facts, stamped `app: 'shell'`. Your app
+receives a bound reporter from the shell (`useReport()` from `'shell'`) and
+calls `report(event, props?, options?)`. Every event is stamped with an `app`
+property, fixed at creation: the descriptor's `telemetryId` when the app is
+first-party (id `rocketride` or starting `rocketride.`) and the alias matches
+`^[A-Za-z0-9._-]{1,128}$`, is not `shell` and is not another registered app's
+id. Otherwise it is the app's `id`, with no warning. SDK-generated events
+(`$pageleave`, `$web_vitals`, `$autocapture` and the like) carry no `app`.
+Events sent through `getConsentedCapture(...).report` are tagged internally
+and dropped at send time unless consent is still accepted and no DNT/GPC
+signal is on; without consent they are always dropped. Ordinary events are
+never dropped for their property names, and apps cannot set the tag. Event
+names are your app's own taxonomy. `useConsent()`
 reads the visitor's consent state (plus `openSettings()`); with no telemetry
 configured on the server, every call is a silent no-op. The old
 `cm.drainTelemetry()` / `shell:telemetry` channel is deprecated and drains
```

**File**: `docs/development/ci-gates.md` (modified, +5/-1)
```diff
@@ -129,7 +129,11 @@ node scripts/build.js shell:regen-derived && git diff --exit-code -- \
 ```
 
 `shell:check` fails on a removed or broken frozen export (via per-version tsc
-floors) and on an added export that was never `shell:freeze`d. The second step
+floors), on an added export that was never `shell:freeze`d, and on a changed
+body of an existing exported declaration (for example a new member on an
+interface) that was never frozen. Comments and whitespace are ignored. The
+inlined `RocketRideClient` class is exempt from the body comparison so additive
+SDK method changes don't fail every PR. The second step
 regenerates the floors from the immutable frozen versions and fails on any diff,
 so a floor cannot be hand-edited to launder a removed export past tsc.
 
```

**File**: `docs/public/product/guides/apps/index.md` (modified, +25/-5)
```diff
@@ -549,6 +549,10 @@ interface AppDescriptor {
       mount these directly instead of booting the full `app`. */
   devToolFrame?: React.ComponentType<DevToolProps>;
   devToolSidebar?: React.ComponentType<DevToolProps>;
+
+  /** First-party apps only: the `app` value stamped on telemetry instead of
+      `id`. See "Telemetry" below. */
+  telemetryId?: string;
 }
 ```
 
@@ -648,8 +652,8 @@ import { useShellConnection, useShellApiConfig, useWorkspace, connectionManager
 
 ### Telemetry
 
-The shell owns the one product-telemetry transport (keys, consent, delivery —
-served to it at runtime by the platform; your app never carries any of it).
+The shell owns the one product-telemetry transport (keys, consent, delivery).
+The platform serves these to it at runtime; your app never carries any of them.
 Your app receives a bound reporter and simply calls it:
 
 ```typescript
@@ -659,8 +663,24 @@ const report = useReport();
 report('chat:message_sent', { length: 42 });
 ```
 
-The reporter is bound to YOUR app id by the shell — every event is stamped
-with its true emitter, and there is nothing to initialise or configure. Event
+The shell binds the reporter to your app. Every event is stamped with an `app`
+property, last, so your props cannot overwrite it. There is nothing to
+initialise or configure. The stamped value is your descriptor's `telemetryId`
+when the app is first-party (id `rocketride` or starting `rocketride.`) and the
+alias is valid. Otherwise it is your app's `id`. A valid alias matches
+`^[A-Za-z0-9._-]{1,128}$`, is not `shell` (reserved for the shell's own events)
+and is not another registered app's id. An alias that fails these checks falls
+back to the id with no warning. The alias is chosen once on the descriptor,
+never per event. Events the analytics SDK generates on its own (`$pageleave`,
+`$web_vitals`, `$autocapture`, `$exception` and the like) carry no `app`.
+`$host` and `$pathname` do not identify the app either, because the URL does
+not change on an app switch.
+
+Events sent through `getConsentedCapture(...).report` are tagged internally as
+attributed. A tagged event is dropped at send time unless consent is still
+accepted and no browser privacy signal (DNT or GPC) is on. Without consent (the
+cookieless instance) it is always dropped. Ordinary events are never dropped
+because of their property names, and an app cannot set the tag itself. Event
 names are your app's own taxonomy (`object:action` by convention); document
 them beside your call sites. `useConsent()` exposes the visitor's
 analytics-consent state read-only (plus `openSettings()` to the Privacy
@@ -796,7 +816,7 @@ The events marked **Shell-internal** exist only in the shell package's internal
 
 ### Telemetry facts
 
-The shell reports its own product facts on its own reporter, stamped with app `shell`. No app forwards them. They are `auth:start`, when it starts the OAuth redirect, and `auth:complete`, when the callback resolves an identity, with the account's new-user flag `is_new`, its waitlist state `waitlisted`, and `duration_ms`, the OAuth round trip in milliseconds from the redirect to the callback (null when it is not known). The consent banner's `consent:shown`, `consent:decision` and `consent:handoff` events are the shell's too. A fact raised before the analytics SDK has started waits in the shell's queue, which is mirrored to the tab's sessionStorage, so it is replayed with its original time on the next page load (the OAuth callback, for `auth:start`) if this one ends first.
+The shell reports its own product facts on its own reporter, stamped with app `shell`. No app forwards them. They are `auth:start`, when it starts the OAuth redirect, and `auth:complete`, when the callback resolves an identity, with the account's new-user flag `is_new`, its waitlist state `waitlisted`, and `duration_ms`, the OAuth round trip in milliseconds from the redirect to the callback (null when it is not known). `auth:start` always carries `is_authed: false` and `auth:complete` always carries `is_authed: true`, whatever the state of the page load that sends them. The consent banner's `consent:shown`, `consent:decision` and `consent:handoff` events are the shell's too. A fact raised before the analytics SDK has started waits in the shell's queue, which is mirrored to the tab's sessionStorage, so it is replayed with its original time on the next page load (the OAuth callback, for `auth:start`) if this one ends first.
 
 `connectionManager.drainTelemetry()` and the `shell:telemetry` event are deprecated. Nothing feeds them any more: `drainTelemetry()` always returns an empty list and `shell:telemetry` is never emitted. They stay typed only for compatibility with the frozen v8/v9 floor. Do not subscribe to them or forward from them; your own events go through `useReport()` as described in [Telemetry](#telemetry).
 
```

**File**: `docs/public/typescript/analytics.md` (modified, +9/-3)
```diff
@@ -25,9 +25,15 @@ from a backgrounded app still names its true emitter. The Python mirror lives
 at `rocketride.analytics` in the Python SDK.
 
 Apps running on the platform shell do not call `createReporter` themselves —
-the shell mints their reporter and hands it over (`useReport()` /
-`getReporter(appId)` from the shell API). Creating reporters directly is for
-hosts and for standalone code with its own transport.
+the shell mints their reporter and hands it over (`useReport()` from the shell
+API). The shell stamps the app descriptor's
+`id`, or its optional `telemetryId` alias (for apps whose dashboards predate
+the descriptor id). The alias is honoured only for first-party apps (id
+`rocketride` or starting `rocketride.`). It must match
+`^[A-Za-z0-9._-]{1,128}$`, must not be `shell`, and must not be another
+registered app's id. Otherwise the shell stamps the `id`, with no warning. The
+alias is chosen once on the descriptor, never per event. Creating reporters directly is for hosts and for standalone code
+with its own transport.
 
 ## **Import**
 
```

**File**: `packages/client-typescript/src/app-sdk/types.ts` (modified, +8/-0)
```diff
@@ -243,6 +243,14 @@ export interface AppDescriptor {
 	id: string;
 	/** Display name shown in the app switcher. */
 	name: string;
+	/**
+	 * The `app` value stamped on this app's telemetry events; defaults to
+	 * `id`. Only honoured for first-party apps (`rocketride` or `rocketride.*`); for any other
+	 * app the shell ignores it and uses `id`. Never `'shell'` or another
+	 * app's id. Must match `^[A-Za-z0-9._-]{1,128}$`; any other value falls
+	 * back to `id` without a warning.
+	 */
+	telemetryId?: string;
 	/** Optional icon shown in the app switcher list. */
 	icon?: React.ReactNode;
 	/** Branding tokens (logo, welcome text) for the app. */
```

**File**: `packages/shell/contract/index.ts` (modified, +3/-1)
```diff
@@ -37,6 +37,7 @@ import type { ShellApiV9 } from './versions/v9';
 import type { ShellApiV10 } from './versions/v10';
 import type { ShellApiV11 } from './versions/v11';
 import type { ShellApiV12 } from './versions/v12';
+import type { ShellApiV13 } from './versions/v13';
 
 /** Registry mapping each frozen shell API version number to its type snapshot. */
 export interface ShellApiVersions {
@@ -53,6 +54,7 @@ export interface ShellApiVersions {
 	10: ShellApiV10;
 	11: ShellApiV11;
 	12: ShellApiV12;
+	13: ShellApiV13;
 }
 
 /**
@@ -64,6 +66,6 @@ export interface ShellApiVersions {
  * contract-check.generated.ts, which assert the live surface still satisfies
  * EACH frozen version separately.
  */
-export type ShellApiLatest = ShellApiVersions[12];
+export type ShellApiLatest = ShellApiVersions[13];
 
 export type * from './latest';
```

**File**: `packages/shell/contract/latest.ts` (modified, +1/-1)
```diff
@@ -23,4 +23,4 @@
 // =============================================================================
 // GENERATED by `./builder shell:freeze` — do not edit by hand.
 // =============================================================================
-export type * from './versions/v12';
+export type * from './versions/v13';
```

**File**: `packages/shell/scripts/freeze-shell-api.js` (modified, +104/-20)
```diff
@@ -546,26 +546,107 @@ function surfaceNames(bundleText) {
 }
 
 /**
- * Is there an ACTIONABLE change vs the newest frozen version — i.e. a genuinely
- * NEW exported name (value member or type)? Removals can't reach here (the floors
- * fail the shell's build first), and the floors guarantee the candidate is a
- * superset of the newest, so the only possibility is additions. A cosmetic edit
- * (reordering, whitespace) or a floor-compatible type tweak leaves the name set
- * unchanged and is therefore NOT actionable — no redundant version is minted.
+ * Map every top-level statement of a bundle to its normalized declaration text,
+ * keyed by declaration (kind + name), so two bundles can be compared one
+ * declaration at a time. Keying by name makes the comparison order-independent:
+ * moving a declaration around in api.ts (or dts-bundle-generator emitting it in
+ * a different order) changes no entry. Each statement is re-printed by the
+ * TypeScript printer with comments removed. The printer emits from the syntax
+ * tree with its own layout, so JSDoc edits and formatting are not changes
+ * either, while the text inside string and template literals (such as a
+ * quoted property name) is kept exactly. Declarations that share a key
+ * (function overloads, an interface declared twice) are joined in source
+ * order, not sorted: overload order decides which signature TypeScript picks,
+ * so swapping two overloads is a real change.
+ *
+ * @param {string} bundleText - A generated/frozen bundle body.
+ * @returns {Map<string, string>} declaration key -> normalized text.
+ */
+function declarationTexts(bundleText) {
+	const sf = ts.createSourceFile('bundle.d.ts', bundleText, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
+	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
+	const groups = new Map();
+	const add = (key, text) => {
+		if (!groups.has(key)) groups.set(key, []);
+		groups.get(key).push(text);
+	};
+	for (const st of sf.statements) {
+		const text = printer.printNode(ts.EmitHint.Unspecified, st, sf).trim();
+		if (st.name && ts.isIdentifier(st.name)) {
+			add(`${ts.SyntaxKind[st.kind]}:${st.name.text}`, text);
+		} else if (ts.isVariableStatement(st)) {
+			const names = st.declarationList.declarations.map((d) => d.name.getText(sf)).join(',');
+			add(`VariableStatement:${names}`, text);
+		} else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
+			// `export { A as B, ... }` blocks: one entry per exported name.
+			for (const el of st.exportClause.elements) {
+				add(`Export:${el.name.text}`, printer.printNode(ts.EmitHint.Unspecified, el, sf).trim());
+			}
+		} else {
+			// Anything else (`export {}`, side-effect statements) is keyed by
+			// its own text: a new or changed one shows up as a new key.
+			add(`Other:${text}`, text);
+		}
+	}
+	const out = new Map();
+	for (const [key, texts] of groups) out.set(key, texts.join('\n'));
+	return out;
+}
+
+/**
+ * Declarations left out of the body comparison. The RocketRideClient class is
+ * inlined from the TypeScript SDK, and its methods gain optional parameters on
+ * the SDK's own release cadence (append-only, held by its covariant floor; see
+ * the NOTE near the top). Without this exemption every such SDK change would
+ * fail shell:check until someone mints a shell version. The client is still
+ * re-captured in full by the next freeze, and a new export is still caught by
+ * the name comparison. Other declarations inlined from the SDK (its exported
+ * interfaces and types) are body-compared like the shell's own, so a change to
+ * one of them needs a shell:freeze.
+ */
+const BODY_COMPARE_EXEMPT = new Set(['ClassDeclaration:RocketRideClient']);
+
+/**
+ * List the ACTIONABLE changes vs the newest frozen version: a declaration that
+ * is new, or whose normalized body differs from the frozen one. Comparing
+ * bodies (not just exported names) is what catches a new member on an EXISTING
+ * type, such as an optional field added to AppDescriptor; a name-only check
+ * reads that as "up to date" and the field never reaches the frozen shell.d.ts
+ * that apps type against. Removals are not listed: the floors fail the shell's
+ * build before this runs. Cosmetic edits (reordering, comments, whitespace)
+ * normalize away and mint no redundant version.
  *
  * @param {number} prev - Newest existing version, or -1.
  * @param {string} candidateBody - The freshly generated bundle body.
- * @returns {boolean} True when a new name appeared since the newest version.
+ * @returns {string[]} Descriptions of the changed declarations (empty = up to date).
  */
-function hasActionableChange(prev, candidateBody) {
-	if (prev < 0) return true; // no prior version — the first freeze is always actionable
+function actionableChanges(prev, candidateBody) {
+	if (prev < 0) return ['no frozen version yet']; // the first freeze is always actionable
 	const prevBody = 
```

---

### Incident Patch 3: `23568240` (2026-11-19)
**Commit Message**: fix(shell): production builds never enable dev hooks; vet `rrdev:*` senders and remote entries (#2960)

* fix(shell): production builds never enable dev hooks; vet rrdev:* senders and remote entries

The dev gate was `NODE_ENV !== 'production' || urlFlag`, with urlFlag read
from `?rrdev=1` or sessionStorage['rr:dev'], so a production shell honoured a
URL parameter. The dev hooks' `message` listener then checked neither
`e.origin` nor `e.source`, so any page that opened or framed the shell could
send `rrdev:registerRemote` (load and run an arbitrary remoteEntry.js with the
user's session) or `rrdev:auth` (replace/clear the session token).

- devGate: the gate is a build-time capability only (NODE_ENV). A production
  build is constant-false; the URL/sessionStorage flag only selects the dev
  flavor's assets in the flavor picker, it is never read as a capability.
- devMode: the listener is handleEmbedderMessage(); every rrdev:* message must
  come from window.parent of an embedded dev shell, from an expected embedder
  origin (same origin, vscode-webview://<id>, or loopback). window.opener,
  foreign framers, siblings and top-level shells are ignored. Console rows
  forwarded to the 

**File**: `docs/development/apps/appdev.md` (modified, +44/-0)
```diff
@@ -70,6 +70,50 @@ instead **self-registers by URL convention**, fetching
 `/apps/<appId>/dev/package.json` from its own origin. A locally registered
 app id REPLACES the server's manifest row wholesale.
 
+**Trust boundary.** The dev hooks (`window.__rrShellDev`, the `rrdev:*` message
+listener) exist only in the DEV flavor of the shell; a production build can
+never enable them from the URL, `sessionStorage` or an injected boot config.
+`?rrdev=1` merely selects the dev flavor's assets, and that flavor is reachable
+from the production origin, so what it does for a caller is restricted in code.
+A `rrdev:*` message is honoured only from a window with the right relation AND
+an origin from a closed set of exactly two:
+
+- as the shell's **parent** (a framed shell): a `vscode-webview://<id>` page
+  (the VS Code App Builder) or a page of the shell's **own origin** (the web
+  App Builder's blob preview iframe);
+- as the shell's **opener** (a top-level tab): a page of the shell's **own
+  origin** only (the web App Builder's debug tab). No other origin, and
+  `vscode-webview://`, is ever an opener.
+
+A loopback origin is **never** a sender, not even for a loopback-served shell,
+and a page that merely `window.open()`s or frames the shell is not trusted by
+that fact. `rrdev:registerRemote` entries must be absolute `http(s)` loopback
+URLs; console rows are posted only to the verified embedder origin. `#rrtoken=`
+seeding is honoured only in a dev build, on a top-level shell served from
+loopback (`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`). In a dev build on
+a top-level shell that is NOT loopback-served, and in a production build on a
+top-level shell (loopback or not), the fragment is ignored (nothing is saved or
+cleared) and stripped from the URL; a framed shell never acts on it or strips it
+here. The `rrauthorigin` sign-in relay is armed only on `http://localhost` and
+`http://127.0.0.1`, the shells its OAuth bounce can return to (any port; the
+`pnpm start` server is `http://localhost:3000`, so it is armed there); on any
+other shell (an `https://` origin, `[::1]`, `*.localhost`, other `127.x.x.x`
+addresses) it is not armed.
+
+Deliberate compatibility costs of a closed set, so nobody is surprised:
+browser-hosted VS Code and Codespaces (webview origins on `*.vscode-cdn.net`)
+are refused; code-server is refused whether it is served from a loopback or a
+non-loopback host; and a dev server reached by LAN IP or a forwarded hostname
+(not loopback) loses URL-convention self-registration, remote entries,
+`#rrtoken` seeding and the sign-in relay. Those dev servers are intentionally
+unsupported: dev remotes, token seeding and the relay are bound to loopback so
+that a dev flavor served from a real origin (the production origin included)
+cannot be steered by a link, and the loopback predicate (`isLoopbackHostname`,
+devGate.ts) cannot tell a LAN dev server from an attacker's host. Only the
+embedder cases (`*.vscode-cdn.net`, code-server) are governed by the allow-list
+`isAllowedEmbedderOrigin`; supporting one of them is a deliberate change there,
+with its own review.
+
 The extension manages the dev servers through a serialized per-app operation
 chain (start/stop/restart run one at a time). Closing a preview **lingers**
 the server for 60 s so a quick reopen revives it instantly; a Reload or
```

**File**: `packages/shell/scripts/stitch-flavors.mjs` (modified, +13/-0)
```diff
@@ -34,6 +34,19 @@
  *     back to the same flavor and the same locked app.
  *   - Everyone else gets the production assets; dev assets are dormant
  *     objects in the bucket that production visitors never fetch.
+ *   - Picking the flavor is NOT the dev-hooks capability: the hooks are a
+ *     build-time property of the dev flavor itself (src/util/devGate.ts —
+ *     the production flavor can never enable them, whatever the URL,
+ *     sessionStorage or injected boot config says). The dev flavor is
+ *     reachable from the production origin by anyone who can link to it
+ *     (`?rrdev=1`), so what it will DO for a caller is restricted in code,
+ *     not here: it answers `rrdev:*` messages only from a verified embedder
+ *     (the VS Code App Builder webview, or the web App Builder on the shell's
+ *     own origin — isTrustedEmbedderMessage) and loads dev remotes only from
+ *     loopback dev servers. The credential-persisting conveniences (a
+ *     `#rrtoken=` fragment, the dev sign-in relay) work only on a shell
+ *     served from loopback, so a bare link to the production origin cannot
+ *     sign a tab in or steer its sign-in.
  *
  * Steps: copy shell-dev's hashed assets into shell (hash-named — no
  * collisions), extract each flavor's script/css tags from its emitted html,
```

**File**: `packages/shell/src/bootstrap.tsx` (modified, +6/-3)
```diff
@@ -74,9 +74,12 @@ async function main() {
 	}
 
 	// Install the app-dev hooks (registerLocalApp / __rrShellDev / dev share
-	// scope). No-ops entirely unless this is a dev build or the URL carries
-	// rrdev=1 — production sessions expose nothing. Fire-and-forget: the
-	// hooks signal readiness to embedders themselves via shell:devReady.
+	// scope). No-ops entirely unless this is a DEV BUILD (NODE_ENV !==
+	// 'production': `rsbuild dev` or the stitched dev flavor). `rrdev=1` and the
+	// per-tab session only SELECT that flavor in the index.html picker; they
+	// never enable hooks in a production build — production sessions expose
+	// nothing. Fire-and-forget: the hooks signal readiness to embedders
+	// themselves via shell:devReady.
 	void installDevHooks();
 
 	// Assemble the shell configuration with server capabilities
```

**File**: `packages/shell/src/connection/connection.test.ts` (modified, +186/-24)
```diff
@@ -367,13 +367,20 @@ test('handleStoredTokenFailure keeps the network latch when the probe answers 20
 });
 
 /** Stage browser globals for one test and restore them afterwards; the dev gate recomputes from the staged window. */
-async function withGlobals(globals: Record<string, unknown>, run: () => void | Promise<void>): Promise<void> {
+async function withGlobals(globals: Record<string, unknown>, run: () => void | Promise<void>, opts: { nodeEnv?: string } = {}): Promise<void> {
 	const originals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
 	for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
+	// The dev gate is a BUILD-TIME constant (NODE_ENV), not something a URL can
+	// switch on: stage the build under test instead of inheriting the runner's
+	// NODE_ENV, so the suite means the same under `NODE_ENV=production`.
+	const originalNodeEnv = process.env.NODE_ENV;
+	process.env.NODE_ENV = opts.nodeEnv ?? 'development';
 	resetDevGateForTests();
 	try {
 		await run();
 	} finally {
+		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
+		else process.env.NODE_ENV = originalNodeEnv;
 		resetDevGateForTests();
 		for (const [key, original] of originals) {
 			if (original) Object.defineProperty(globalThis, key, original);
@@ -883,6 +890,7 @@ test('auth providers sign out by removing the stored token from localStorage onl
 });
 
 test('token methods use frame-local memory in embedded dev shells', () => {
+	const originalNodeEnv = process.env.NODE_ENV;
 	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
 	const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
 	const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
@@ -897,13 +905,14 @@ test('token methods use frame-local memory in embedded dev shells', () => {
 	// top-level browsing context, so it cannot isolate panels either). The
 	// parent shares this page's origin — the web App Builder flavor — which
 	// is the case where the /apps cookie prime must be suppressed. The gate
-	// cache is reset so it recomputes from this staged environment (the test
-	// runner builds with NODE_ENV=production, so the URL flag is the live
-	// path).
+	// cache is reset so it recomputes from this staged environment (the dev
+	// build is staged explicitly: the gate is a build-time constant).
 	Object.defineProperty(globalThis, 'window', {
 		configurable: true,
 		value: { self: {}, top: {}, parent: { location: { origin: 'https://cloud.test' } }, location: { search: '?rrdev=1', origin: 'https://cloud.test' } },
 	});
+	// The gate is a build-time constant: stage the dev build, whatever the runner's NODE_ENV.
+	process.env.NODE_ENV = 'development';
 	resetDevGateForTests();
 	Object.defineProperty(globalThis, 'localStorage', {
 		configurable: true,
@@ -945,6 +954,8 @@ test('token methods use frame-local memory in embedded dev shells', () => {
 		// injected session must not replace their bundle credentials.
 		assert.deepEqual(fetchCalls, []);
 	} finally {
+		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
+		else process.env.NODE_ENV = originalNodeEnv;
 		resetDevGateForTests();
 		if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
 		else delete (globalThis as { window?: Window }).window;
@@ -958,6 +969,7 @@ test('token methods use frame-local memory in embedded dev shells', () => {
 });
 
 test('saveToken primes the /apps cookie in a CROSS-origin embedded preview', () => {
+	const originalNodeEnv = process.env.NODE_ENV;
 	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
 	const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
 	const fetchCalls: string[] = [];
@@ -975,6 +987,8 @@ test('saveToken primes the /apps cookie in a CROSS-origin embedded preview', ()
 		configurable: true,
 		value: { self: {}, top: {}, parent: hostileParent, location: { search: '?rrdev=1', origin: 'http://localhost:3013' } },
 	});
+	// The gate is a build-time constant: stage the dev build, whatever the runner's NODE_ENV.
+	process.env.NODE_ENV = 'development';
 	resetDevGateForTests();
 	Object.defineProperty(globalThis, 'fetch', {
 		configurable: true,
@@ -988,6 +1002,8 @@ test('saveToken primes the /apps cookie in a CROSS-origin embedded preview', ()
 		assert.equal(manager.loadToken(), 'rr_proxy-token');
 		assert.deepEqual(fetchCalls, ['/apps/session']);
 	} finally {
+		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
+		else process.env.NODE_ENV = originalNodeEnv;
 		resetDevGateForTests();
 		if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
 		else delete (globalThis as { window?: Window }).window;
@@ -1032,6 +1048,7 @@ test('saveToken primes the /apps cookie for real tabs', () => {
 });
 
 test('ini
```

**File**: `packages/shell/src/connection/connection.ts` (modified, +32/-7)
```diff
@@ -59,7 +59,7 @@ import { CLIENT_EVENT_OP } from '../ops/clientOps';
 import type { IOpBus, IBusRequestOptions, BusOpHandler } from '../ops/busOps';
 import { createRetainedRegistry, localRetainedPort } from '../ops/retained';
 import type { IRetainedPort, RetainedSubscriber } from '../ops/retained';
-import { isEmbeddedDevShell, isSameOriginEmbed, isDevHooksEnabled, isFramedShell, tokenStore, tabSession, updateTabSession } from '../util/devGate';
+import { isEmbeddedDevShell, isSameOriginEmbed, isDevHooksEnabled, isFramedShell, isLoopbackShell, isRelayBounceTarget, tokenStore, tabSession, updateTabSession } from '../util/devGate';
 import { TelemetryChannel, type TelemetryFact } from '../util/telemetryChannel';
 import { shellReporter } from '../telemetry/host';
 import { AUTH_START_STAMP_KEY, getStoredVerifier, clearStoredVerifier, getStoredRedirectUri, clearStoredRedirectUri } from '../util/pkce';
@@ -875,7 +875,8 @@ export class ConnectionManager implements IConnectionManager {
 			const relayCode = relayParams.get('code') ?? '';
 			if (relayCode && relayState.startsWith('rrdev:')) {
 				const target = relayState.slice('rrdev:'.length).replace(/\/+$/, '');
-				const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(target);
+				// One definition with devRelayOrigin(), which arms the relay only where this accepts.
+				const isLoopback = isRelayBounceTarget(target);
 				if (isLoopback && target !== window.location.origin) {
 					// replace(), not assign(): the bounce must not linger in
 					// history — Back should land before the sign-in, not here.
@@ -887,12 +888,22 @@ export class ConnectionManager implements IConnectionManager {
 
 		// ── Dev token seeding ─────────────────────────────────────────────
 		// The terminal dev host (`rocketride app dev`) hands the workspace
-		// credential in the URL FRAGMENT — never sent on the wire, stripped
-		// before anything else reads the URL, honored ONLY in a top-level
-		// dev shell (framed previews inherit their embedder's session via
-		// rrdev:auth, and production builds have no dev gate). Seeding goes
+		// credential in the URL FRAGMENT — never sent on the wire; a top-level
+		// shell strips it in this block. Seeding is honoured ONLY in a
+		// top-level dev shell served from a LOOPBACK origin (framed previews
+		// inherit their embedder's session via rrdev:auth; production builds
+		// have no dev gate; and a dev flavor served from a real origin — the
+		// production origin included — must not let a bare link sign the tab
+		// in as a chosen credential: the launcher only ever opens its own
+		// localhost dev server). Seeding goes
 		// through saveToken so the /apps cookie primes exactly like any
 		// other sign-in; the normal stored-token path below then connects.
+		// A REFUSED directive (production build, non-loopback origin) is
+		// never acted on, but a TOP-LEVEL shell still strips the fragment in
+		// every build. This block leaves a FRAMED shell's URL alone (previews
+		// inherit their embedder's session via rrdev:auth and no launcher puts
+		// the directive in a frame URL). Only the exact `#rrtoken=` prefix is
+		// a directive.
 		// The fragment is the LAUNCHER's definitive session directive (the
 		// same vocabulary as the embedded flow's rrdev:auth answer): a
 		// value signs the tab in as that credential; EMPTY (`#rrtoken=`,
@@ -904,7 +915,21 @@ export class ConnectionManager implements IConnectionManager {
 		// is reserved for an explicit logout or an abandoned sign-in. An
 		// ABSENT fragment leaves the tab's own state alone.
 		const bootHash = String(window.location.hash ?? '');
-		if (isDevHooksEnabled() && !isFramedShell() && bootHash.startsWith('#rrtoken=')) {
+		const hasTokenDirective = bootHash.startsWith('#rrtoken=');
+		const framedBoot = isFramedShell();
+		const tokenSeedDirective = hasTokenDirective && isDevHooksEnabled() && !framedBoot;
+		if (hasTokenDirective && !framedBoot && !(tokenSeedDirective && isLoopbackShell())) {
+			if (tokenSeedDirective) {
+				console.warn('[shell] ignoring #rrtoken: dev token seeding is honoured only by a shell served from a loopback dev server');
+			}
+			// Best-effort: rewrites the CURRENT history entry so the fragment
+			// leaves the address bar and Back/Forward history. It cannot remove
+			// a visit the browser already recorded when the page loaded.
+			try {
+				window.history.replaceState({ ...(window.history.state ?? {}) }, '', window.location.pathname + window.location.search);
+			} catch { /* ignore */ }
+		}
+		if (tokenSeedDirective && isLoopbackShell()) {
 			const seeded = decodeURIComponent(bootHash.slice('#rrtoken='.length));
 			// Strip the fragment FIRST (replaceState rewrites the history
 			// entry) so the credential survives in no URL bar, history
```

**File**: `packages/shell/src/telemetry/host.test.ts` (modified, +16/-6)
```diff
@@ -426,10 +426,20 @@ test('a privacy-signal boot still clears what it can read when localStorage thro
 test("an embedded preview's disabled boot never touches the host tab's hold", async () => {
 	const tab = session(heldEntry());
 	const win: Record<string, unknown> = { location: { search: '?rrdev=1', pathname: '/', hostname: 'cloud.example.test' }, self: {}, top: {} };
-	await withGlobals({ window: win, document: docHidden, sessionStorage: tab.storage }, () => {
-		resetTelemetryHostForTests(); // the preview's queue is memory-only
-		initTelemetryHost({ key: '', host: '', consentSource: 'stored' });
-		assert.deepEqual(tab.removed, [], 'nothing removed from the shared sessionStorage');
-		assert.equal(tab.data.has(HOLD_STORAGE_KEY), true);
-	});
+	// An embedded dev preview is a DEV BUILD framed with rrdev=1: the dev gate
+	// is build-time, so pin the build regardless of the runner's NODE_ENV.
+	const originalNodeEnv = process.env.NODE_ENV;
+	process.env.NODE_ENV = 'development';
+	try {
+		await withGlobals({ window: win, document: docHidden, sessionStorage: tab.storage }, () => {
+			resetTelemetryHostForTests(); // the preview's queue is memory-only
+			initTelemetryHost({ key: '', host: '', consentSource: 'stored' });
+			assert.deepEqual(tab.removed, [], 'nothing removed from the shared sessionStorage');
+			assert.equal(tab.data.has(HOLD_STORAGE_KEY), true);
+		});
+	} finally {
+		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
+		else process.env.NODE_ENV = originalNodeEnv;
+		resetDevGateForTests();
+	}
 });
```

**File**: `packages/shell/src/util/appLoader.test.ts` (modified, +53/-1)
```diff
@@ -28,7 +28,7 @@
 import assert from 'node:assert/strict';
 import test, { afterEach, mock } from 'node:test';
 import { init } from '@module-federation/runtime';
-import { devPreviewHoldRemainingMs, isDevPreviewPending, isRemoteLoaded, isRemotePending, loadAppModule, registerAndMapApps, registerDevRemote, registerLocalApp, setDescriptorInvalidator } from './appLoader';
+import { devPreviewHoldRemainingMs, isDevPreviewPending, isDevRemote, isRemoteLoaded, isRemotePending, loadAppModule, registerAndMapApps, registerDevRemote, registerLocalApp, setDescriptorInvalidator } from './appLoader';
 import { resetDevGateForTests } from './devGate';
 import type { AppDescriptor } from '../components/workspace/types';
 
@@ -52,6 +52,9 @@ function stubLoader(load: (id: string) => unknown): void {
  * framed (an embedded App Builder preview) or the top-level window.
  */
 function stubPage(search: string, framed: boolean): void {
+	// The preview behaviour under test is a DEV-build capability: stage it
+	// explicitly instead of inheriting whatever NODE_ENV the runner has.
+	process.env.NODE_ENV = 'development';
 	const self = {};
 	const store = new Map<string, string>();
 	Reflect.set(globalThis, 'window', { self, top: framed ? {} : self, location: { search } });
@@ -70,9 +73,14 @@ function stubClock(ms: number): void {
 	mock.method(performance, 'now', () => ms);
 }
 
+const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
+
 afterEach(() => {
 	mock.restoreAll();
 	setDescriptorInvalidator(null);
+	if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
+	else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
+	resetDevGateForTests();
 });
 
 /** A module loader whose loads stay open until the test settles them, one handle per module id. */
@@ -215,3 +223,47 @@ test('a dev registration for the locked app is not reported as a mismatch', () =
 	registerDevRemote('org.match', 'org_match', 'Match', 'http://localhost:1/remoteEntry.js');
 	assert.equal(warn.mock.callCount(), 0);
 });
+
+test('a dev registration whose entry is not a loopback dev server is refused (no remote, no local app)', () => {
+	stubPage('?appid=org.evil&rrdev=1', true);
+	// isDevPreviewPending() below is measured against the page clock: pin it,
+	// or the assertion holds only while the process is under 30 s old.
+	stubClock(1_000);
+	setDescriptorInvalidator(() => {});
+	mock.method(console, 'error', () => {});
+	const registerRemotes = mock.method(federation, 'registerRemotes', () => {});
+	for (const [i, entry] of ['https://attacker.example/remoteEntry.js', '//attacker.example/remoteEntry.js', 'javascript:alert(1)', 'http://localhost.attacker.example/remoteEntry.js', 'http://user:pw@localhost:1/remoteEntry.js', '/remoteEntry.js'].entries()) {
+		registerDevRemote('org.evil', `org_evil${i}`, 'Evil', entry);
+		assert.equal(isDevRemote(`org_evil${i}`), false, entry);
+	}
+	assert.equal(registerRemotes.mock.callCount(), 0, 'nothing was handed to Module Federation');
+	assert.equal(isDevPreviewPending('org.evil'), true, 'the locked app is still waiting for a real registration');
+});
+
+test('a dev registration with a loopback dev-server entry is registered', () => {
+	stubPage('?appid=org.good&rrdev=1', true);
+	setDescriptorInvalidator(() => {});
+	registerDevRemote('org.good', 'org_good', 'Good', 'http://127.0.0.1:3001/remoteEntry.js?t=1');
+	assert.equal(isDevRemote('org_good'), true);
+});
+
+test('the registered entry is the canonical URL that was vetted, not the raw input', () => {
+	stubPage('?appid=org.canon&rrdev=1', true);
+	setDescriptorInvalidator(() => {});
+	const registerRemotes = mock.method(federation, 'registerRemotes', () => {});
+	// Tabs and newlines are stripped by the URL parser; the loader must fetch
+	// exactly what was vetted.
+	registerDevRemote('org.canon', 'org_canon', 'Canon', 'http://loc\talhost:3001/remote\nEntry.js?t=1');
+	assert.equal(isDevRemote('org_canon'), true);
+	assert.equal(registerRemotes.mock.callCount(), 1, 'the module federation runtime was handed the remote');
+	assert.deepEqual(registerRemotes.mock.calls[0].arguments[0], [{ name: 'org_canon', entry: 'http://localhost:3001/remoteEntry.js?t=1' }]);
+});
+
+test('a production build never holds for a dev preview, whatever the URL and tab session say', () => {
+	stubPage('?appid=org.held&rrdev=1', true);
+	process.env.NODE_ENV = 'production';
+	resetDevGateForTests();
+	stubClock(1_000);
+	assert.equal(isDevPreviewPending('org.held'), false);
+	assert.equal(devPreviewHoldRemainingMs(), 0);
+});
```

**File**: `packages/shell/src/util/appLoader.ts` (modified, +21/-1)
```diff
@@ -35,7 +35,7 @@ import type { AppManifestEntry, AppDescriptor, AppConfiguration } from '../compo
 // modules reference each other strictly through function calls at runtime,
 // so the import cycle carries no module-evaluation (TDZ) risk.
 import { getAppVersionOverrides, versionedEntryUrl } from './versionOverride';
-import { devBootConfig, tabSession } from './devGate';
+import { devBootConfig, isDevHooksEnabled, normalizeDevRemoteEntry, tabSession } from './devGate';
 
 /**
  * Shape of an app entry from the server (rrext_public_probe or ConnectResult).
@@ -428,6 +428,23 @@ export function unregisterLocalApp(id: string): void {
  *               in dev the workspace is the truth, not the server registry.
  */
 export function registerDevRemote(appId: string, moduleId: string, name: string, entry: string, meta?: LocalAppMeta): void {
+	// The one choke point for dev-remote ENTRIES: a remote entry is a URL of
+	// SCRIPT the shell executes with the user's session, so only a loopback dev
+	// server may supply one (the embedder's own rsbuild server), whoever the
+	// caller is — the rrdev:registerRemote handler vets it too, but this is the
+	// guard that holds for every caller of this function (the message handler,
+	// the URL-convention self-registration, a future one). It does not cover
+	// `registerLocalApp` (also on window.__rrShellDev): that takes a
+	// caller-supplied loader FUNCTION, which cannot arrive by message or URL —
+	// only script already running on this origin can supply one. What was
+	// vetted is what gets registered: the canonical URL, never the raw input.
+	const vetted = normalizeDevRemoteEntry(entry);
+	if (vetted === null) {
+		console.error(`[appLoader] refusing dev remote "${moduleId}": entry ${JSON.stringify(entry)} is not a loopback dev-server URL`);
+		return;
+	}
+	entry = vetted;
+
 	// The wrong-id signal: an embedded preview receives ONE registration, for
 	// the app its URL is locked to. A registration for any other id means the
 	// two disagree, and the locked app will never register — say so instead
@@ -549,6 +566,9 @@ export function fallbackSkippedRemote(appId: string): boolean {
  */
 export function isDevPreviewPage(): boolean {
 	try {
+		// A production build is never a dev preview, whatever the URL or the
+		// persisted tab session says.
+		if (!isDevHooksEnabled()) return false;
 		return tabSession().dev;
 	} catch {
 		return false;
```

#### Recent Merged Pull Requests:
- **PR #3390** (2026-11-20): test(seed): consecutive boots leave the registry unchanged; a changed bundle mints exactly one version (@Rod-Christensen)
- **PR #3389** (2026-11-20): feat(mcp): an upload checks once that the run's control is still live before forwarding (follow-up to #3380) (@Rod-Christensen)
- **PR #3387** (2026-11-20): chore(nodes): the node test tree is green after C.22; the multitenant vocabulary leaves the node side (plan 4.2, 4.4) (@Rod-Christensen)
- **PR #3386** (2026-11-20): feat(pipeline-actions): C.16b: a running node's open-tool note is its Open button; the openTool host op on both IDEs; the URL path for nodes is gone (plan 3.6, B2) (@Rod-Christensen)
- **PR #3385** (2026-11-20): feat(desktop): Catalog & desktop 6b.0-6b.3, server side: the OSS per-user desktop, CatalogPicker in the shell, hello-ui, /catalog (plan 9.1, Step 6b, B41) (@Rod-Christensen)
- **PR #3384** (2026-11-20): feat(shared): the editor converts an old-shape pipeline on open through rrext_convert (plan 5.6.8, C.5d PR 3) (@Rod-Christensen)

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

## X. anonymize): fail closed when a GLiNER prediction fails

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rocketride-org/rocketride-server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b5952dd0`: anonymize): fail closed when a GLiNER prediction fails. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **anonymize**: a GLiNER prediction that failed for one chunk or label batch, such as CUDA out of memory or a model-server error, was logged at debug level and skipped, so the node passed the document on as a success with that chunk's entities left unredacted, or with the original text when every chunk failed. A failed prediction now fails the document with the cause and the node emits no text for it; the rest of the batch and the task continue, in-process and with `--modelserver`. A prediction that succeeds and finds no entities still passes the text through unchanged. When handling classifier input fails, the node no longer emits the text it was holding when the object closes (#3172)
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b5952dd0` are properly handled with clean fallback behavior.
