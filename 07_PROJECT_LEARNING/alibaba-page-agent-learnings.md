# Forensic Learning Record (Deep Inspection): alibaba/page-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-page-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/page-agent](https://github.com/alibaba/page-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:28:18.072Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/page-agent`
- **Description**: JavaScript in-page GUI agent. Control web interfaces with natural language.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29334 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/src/PageAgentCore.ts`
```
/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * Copyright (C) 2026 SimonLuvRamen
 * All rights reserved.
 */
import { InvokeError, LLM, type Tool } from '@page-agent/llms'
import type { BrowserState, PageController } from '@page-agent/page-controller'
import chalk from 'chalk'
import * as z from 'zod/v4'

import SYSTEM_PROMPT from './prompts/system_prompt.md?raw'
import { tools } from './tools'
import type {
	AgentActivity,
	AgentConfig,
	AgentReflection,
	AgentStatus,
	AgentStepEvent,
	ExecutionResult,
	HistoricalEvent,
	MacroToolInput,
	MacroToolResult,
} from './types'
import { assert, fetchLlmsTxt, normalizeResponse, suppress, uid, waitFor } from './utils'

export { tool, type PageAgentTool, type ToolContext } from './tools'
export type * from './types'

export type PageAgentCoreConfig = AgentConfig & { pageController: PageController }

/**
 * AI agent for browser automation.
 *
 * @remarks
 * ## Re-act Agent Loop
 * - step
 *    - observe (gather information about current environment and context)
 *    - think (LLM calling)
 *      - reflection (evaluate history, generate memory, short-term planning)
 *      - action (give the action to approach the next goal)
 *    - act (execute the action)
 * - loop
 *
 * ## Event System
 * - `statuschange` - Agent status transitions (idle → running → completed/error/stopped)
 * - `historychange` - History events updated (persistent, part of agent memory)
 * - `activity` - Real-time activity feedback (transient, for UI only)
 * - `dispose` - Agent cleanup triggered
 *
 * ## Information Streams
 * 1. **History Events** (`history` array)
 *    - Persistent event stream that forms agent's memory
 *    - Included in LLM context across steps
 *    - Types: steps, observations, user takeovers, llm errors
 *
 * 2. **Activity Events** (via `activity` event)
 *    - Transient UI feedback during task execution
 *    - NOT included in LLM context
 *    - Types: thinking, executing, executed, retrying, error
 */
export class PageAgentCore extends EventTarget {
	readonly id = uid()
	readonly config: PageAgentCoreConfig & { maxSteps: number }
	readonly tools: typeof tools
	/** PageController for DOM operations */
	readonly pageController: PageController

	task = ''
	taskId = ''
	/** History events */
	history: HistoricalEvent[] = []
	/** Whether this agent has been disposed */
	disposed = false

	/**
	 * Called when the agent needs to ask the user questions.
	 * If unset, the `ask_user` tool will be disabled.
	 * Implementations should reject the promise when `signal` aborts.
	 * @example onAskUser: (q) => window.prompt(q) || ''
	 */
	onAskUser?: (question: string, options?: { signal: AbortSignal }) => Promise<string>

	#status: AgentStatus = 'idle'
	#llm: LLM
	/**
	 * Task cancellation primitive: its signal reaches the LLM fetch, tools
	 * (via `ctx.signal`) and async callbacks. Aborted only by `stop`/`dispose`
	 * (during a task) or task setup, always WITHOUT a reason so `signal.reason`
	 * stays a standard `AbortError`.
	 */
	#abortController = new AbortController()
	#observations: string[] = []

	/** Resolves when the current run has fully settled. Awaited by `stop()`. */
	#running: Promise<void> = Promise.resolve()
	#lastResult: ExecutionResult | null = null

	/** internal states during a single task execution */
	#states = {
		/** Accumulated wait time in seconds */
		totalWaitTime: 0,
		/** For detecting navigation */
		lastURL: '',
		/** Browser state */
		browserState: null as BrowserState | null,
	}

	constructor(config: PageAgentCoreConfig) {
		super()

		this.config = { ...config, maxSteps: config.maxSteps ?? 40 }

		this.#llm = new LLM(this.config)
		this.tools = new Map(tools)
		this.pageController = config.pageController

		this.#llm.addEventListener('retry', (e) => {
			const { attempt, maxAttempts, lastError } = (e as CustomEvent).detail
			this.#emitActivity({ type: 'retrying', attempt, maxAttempts })
			this.history.push({
				type: 'error',
				message: String(lastError),
				rawResponse: (lastError as InvokeError).rawResponse,
			})
			this.history.push({
				type: 'retry',
				message: `LLM retry attempt ${attempt} of ${maxAttempts}`,
				attempt,
				maxAttempts,
			})
			this.#emitHistoryChange()
		})

		if (this.config.customTools) {
			for (const [name, tool] of Object.entries(this.config.customTools)) {
				if (tool === null) {
					this.tools.delete(name)
					continue
				}
				this.tools.set(name, tool)
			}
		}

		if (!this.config.experimentalScriptExecutionTool) {
			this.tools.delete('execute_javascript')
		}
	}

	/** Get current agent status */
	get status(): AgentStatus {
		return this.#status
	}

	/** Result of the most recent run, or `null` before the first run completes. */
	get lastResult(): ExecutionResult | null {
		return this.#lastResult
	}

	/** Emit statuschange event */
	#emitStatusChange(): void {
		this.dispatchEvent(new Event('statuschange'))
	}

	/** Emit historychange event */
	#emitHistoryChange(pushHistoricalEvent?: HistoricalEvent): void {
		if (pushHistoricalEvent) this.history.push(pushHistoricalEvent)
		this.dispatchEvent(new Event('historychange'))
	}

	/**
	 * Emit activity event - for transient UI feedback
	 * @param activity - Current agent activity
	 */
	#emitActivity(activity: AgentActivity): void {
		this.dispatchEvent(new CustomEvent('activity', { detail: activity }))
	}

	/** Update status and emit event */
	#setStatus(status: AgentStatus): void {
		if (this.#status !== status) {
			this.#status = status
			this.#emitStatusChange()
		}
	}

	/**
	 * Push an observation message to the history event stream.
	 * This will be visible in <agent_history> and remain persistent in memory across steps.
	 * @experimental @internal
	 * @note history change will be emitted before next step starts
	 */
	pushObservation(content: string): void {
		this.#observations.push(content)
	}

	/**
	 * Stop the current task and wait until the run has fully settled (including lifecycle hooks).
	 * @note never await .stop() in a lifecycle hook.
	 */
	async stop(): Promise<void> {
		if (this.#status !== 'running') return
		this.#abortController.abort()
		await this.#running
	}

	/**
	 * external errors (pre-checks/config/hooks) will threw;
	 * agent errors will be caught and added to history, and return a failed result
	 */
	async execute(task: string): Promise<ExecutionResult> {
		// pre-checks
		if (this.disposed) throw new Error('PageAgent has been disposed. Create a new instance.')
		if (this.#status === 'running') throw new Error('A task is already running.')
		if (!task) throw new Error('Task is required')

		this.task = task
		this.taskId = uid()

		this.history = []
		this.#observations = []
		this.#states = { totalWaitTime: 0, lastURL: '', browserState: null }
		this.#abortController = new AbortController()
		const signal = this.#abortController.signal

		let resolveRunning!: () => void
		this.#running = new Promise<void>((r) => (resolveRunning = r))

		this.#setStatus('running')
		this.#emitHistoryChange()

		// Disable ask_user tool if onAskUser is not set
		if (!this.onAskUser) this.tools.delete('ask_user')

		const onBeforeStep = this.config.onBeforeStep
		const onAfterStep = this.config.onAfterStep
		const onBeforeTask = this.config.onBeforeTask
		const onAfterTask = this.config.onAfterTask
		const stepDelay = this.config.stepDelay ?? 0.4
		const maxSteps = this.config.maxSteps

		let step = 0
		let taskResult: ExecutionResult
		let finalStatus: AgentStatus = 'error'

		await suppress(() => this.pageController.showMask())

		// graceful exit
		try {
			await onBeforeTask?.(this)

			while (true) {
				await onBeforeStep?.(this, step)

				// handle internal agent errors
				try {
					console.group(`step: ${step}`)

					// @note It's convenient to treat stepDelay as part of the next step.
					// Maybe move it to a dedicated try block for better semantics?
					if (step > 0) await waitFor(stepDelay, signal)

					signal.throwIfAborted()

					// observe

					console.log(chalk.blue.bold('👀 Observing...'))

					this.#states.browserState = await this.pageController.getBrowserState()
					await this.#handleObservations(step)

					// assemble prompts

					const messages = [
						{ role: 'system' as const, content: this.#getSystemPrompt() },
						{ role: 'user' as const, content: await this.#assembleUserPrompt() },
					]

					const macroTool = { AgentOutput: this.#packMacroTool() }

					// invoke LLM

					console.log(chalk.blue.bold('🧠 Thinking...'))
					this.#emitActivity({ type: 'thinking' })

					const result = await this.#llm.invoke(messages, macroTool, signal, {
						toolChoiceName: 'AgentOutput',
						normalizeResponse: (res) => normalizeResponse(res, this.tools),
					})

					// assemble history

					const macroResult = result.toolResult as MacroToolResult
					const input = macroResult.input
					const output = macroResult.output
					const reflection: Partial<AgentReflection> = {
						evaluation_previous_goal: input.evaluation_previous_goal,
						memory: input.memory,
						next_goal: input.next_goal,
					}
					const actionName = Object.keys(input.action)[0]
					const action: AgentStepEvent['action'] = {
						name: actionName,
						input: input.action[actionName],
						output: output,
					}

					this.#emitHistoryChange({
						type: 'step',
						stepIndex: step,
						reflection,
						action,
						usage: result.usage,
						rawResponse: result.rawResponse,
						rawRequest: result.rawRequest,
					})

					if (actionName === 'done') {
						const success = action.input?.success ?? false
						const data = action.input?.text || 'no text provided'
						console.log(chalk.green.bold('Task completed'), success, data)
						taskResult = { success, data, history: this.history }
						this.#lastResult = taskResult
						finalStatus = 'completed'
						break
					}
				} catch (error: unknown) {
					// catch block must not throw error. otherwise the error may be overridden if finally block als
```

### Core Architecture Module: `packages/core/src/env.d.ts`
```
/// <reference types="vite/client" />

declare module '*.md?raw' {
	const content: string
	export default content
}

```

### Core Architecture Module: `packages/core/src/tools/index.ts`
```
/**
 * Internal tools for PageAgent.
 * @note Adapted from browser-use
 */
import * as z from 'zod/v4'

import type { PageAgentCore } from '../PageAgentCore'
import { waitFor } from '../utils'

/**
 * Per-invocation context passed to every tool execution.
 * Tools MUST honor `signal` to support cooperative cancellation.
 */
export interface ToolContext {
	signal: AbortSignal
}

/**
 * Internal tool definition that has access to PageAgent `this` context
 */
export interface PageAgentTool<TParams = any> {
	// name: string
	description: string
	inputSchema: z.ZodType<TParams>
	execute: (this: PageAgentCore, args: TParams, ctx: ToolContext) => Promise<string>
}

export function tool<TParams>(options: PageAgentTool<TParams>): PageAgentTool<TParams> {
	return options
}

/**
 * Internal tools for PageAgent.
 * Note: Using any to allow different parameter types for each tool
 */
export const tools = new Map<string, PageAgentTool>()

tools.set(
	'done',
	tool({
		description:
			'Complete task. Text is your final response to the user — keep it concise unless the user explicitly asks for detail.',
		inputSchema: z.object({
			text: z.string(),
			success: z.boolean().default(true),
		}),
		execute: async function (this: PageAgentCore, input) {
			// @note main loop will handle this one
			return Promise.resolve('Task completed')
		},
	})
)

tools.set(
	'wait',
	tool({
		description: 'Wait for x seconds. Can be used to wait until the page or data is fully loaded.',
		inputSchema: z.object({
			seconds: z.number().min(1).max(10).default(1),
		}),
		execute: async function (this: PageAgentCore, input, { signal }) {
			// try to subtract LLM calling time from the actual wait time
			const lastTimeUpdate = await this.pageController.getLastUpdateTime()
			const secondsSinceLastUpdate = (Date.now() - lastTimeUpdate) / 1000
			const actualWaitTime = Math.max(0, input.seconds - secondsSinceLastUpdate)
			console.log(`actualWaitTime: ${actualWaitTime} seconds`)
			await waitFor(actualWaitTime, signal)

			const waitedSeconds = (secondsSinceLastUpdate + actualWaitTime).toFixed(2)
			return `✅ Waited for ${waitedSeconds} seconds.`
		},
	})
)

tools.set(
	'ask_user',
	tool({
		description:
			'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
		inputSchema: z.object({
			question: z.string(),
		}),
		execute: async function (this: PageAgentCore, input, { signal }) {
			if (!this.onAskUser) {
				throw new Error('ask_user tool requires onAskUser callback to be set')
			}
			const answer = await this.onAskUser(input.question, { signal })
			return `User answered: ${answer}`
		},
	})
)

tools.set(
	'click_element_by_index',
	tool({
		description: 'Click element by index',
		inputSchema: z.object({
			index: z.int().min(0),
		}),
		execute: async function (this: PageAgentCore, input) {
			const result = await this.pageController.clickElement(input.index)
			return result.message
		},
	})
)

tools.set(
	'input_text',
	tool({
		description: 'Click and type text into an interactive input element',
		inputSchema: z.object({
			index: z.int().min(0),
			text: z.string(),
		}),
		execute: async function (this: PageAgentCore, input) {
			const result = await this.pageController.inputText(input.index, input.text)
			return result.message
		},
	})
)

tools.set(
	'select_dropdown_option',
	tool({
		description:
			'Select dropdown option for interactive element index by the text of the option you want to select',
		inputSchema: z.object({
			index: z.int().min(0),
			text: z.string(),
		}),
		execute: async function (this: PageAgentCore, input) {
			const result = await this.pageController.selectOption(input.index, input.text)
			return result.message
		},
	})
)

/**
 * @note Reference from browser-use
 */
tools.set(
	'scroll',
	tool({
		description:
			'Scroll vertically. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.',
		inputSchema: z.object({
			down: z.boolean().default(true),
			num_pages: z.number().min(0).max(10).optional().default(0.1),
			pixels: z.number().int().min(0).optional(),
			index: z.number().int().min(0).optional(),
		}),
		execute: async function (this: PageAgentCore, input) {
			const result = await this.pageController.scroll({
				...input,
				numPages: input.num_pages,
			})
			return result.message
		},
	})
)

/**
 * @todo Tables need a dedicated parser to extract structured data. This tool is useless.
 */
tools.set(
	'scroll_horizontally',
	tool({
		description:
			'Scroll horizontally. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.',
		inputSchema: z.object({
			right: z.boolean().default(true),
			pixels: z.number().int().min(0),
			index: z.number().int().min(0).optional(),
		}),
		execute: async function (this: PageAgentCore, input) {
			const result = await this.pageController.scrollHorizontally(input)
			return result.message
		},
	})
)

tools.set(
	'execute_javascript',
	tool({
		description:
			'Execute JavaScript code on the current page. Supports async/await syntax. Use with caution! ' +
			'An `AbortSignal` named `signal` is available in scope: long-running async code MUST honor it ' +
			'(e.g. `await fetch(url, { signal })`, or `signal.throwIfAborted()` in loops)',
		inputSchema: z.object({
			script: z.string(),
		}),
		execute: async function (this: PageAgentCore, input, { signal }) {
			const result = await this.pageController.executeJavascript(input.script, signal)
			signal.throwIfAborted()
			return result.message
		},
	})
)

// @todo send_keys
// @todo upload_file
// @todo extract_structured_data

```

### Core Architecture Module: `packages/core/src/types.ts`
```
import type { LLMConfig } from '@page-agent/llms'

// @note circular dependency but okay
import type { PageAgentCore } from './PageAgentCore'
import type { PageAgentTool } from './tools'

/** Supported UI languages */
export type SupportedLanguage = 'en-US' | 'zh-CN'

export interface AgentConfig extends LLMConfig {
	language?: SupportedLanguage

	/**
	 * Maximum number of steps the agent can take per task.
	 * @default 40
	 */
	maxSteps?: number

	/**
	 * Custom tools to extend PageAgent capabilities
	 * @experimental
	 * @note You can also override or remove internal tools by using the same name.
	 * @see PageAgentTool
	 *
	 * @example
	 * // override internal tool
	 * import { z } from 'zod/v4'
	 * import { tool } from 'page-agent'
	 * const customTools = {
	 * ask_user: tool({
	 * 	description:
	 * 		'Ask the user or parent model a question and wait for their answer. Use this if you need more information or clarification.',
	 * 	inputSchema: z.object({
	 * 		question: z.string(),
	 * 	}),
	 * 	execute: async function (this: PageAgent, input) {
	 * 		const answer = await do_some_thing(input.question)
	 * 		return "✅ Received user answer: " + answer
	 * 	},
	 * })
	 * }
	 *
	 * @example
	 * // remove internal tool
	 * const customTools = {
	 * 	ask_user: null // never ask user questions
	 * }
	 */
	customTools?: Record<string, PageAgentTool | null>

	/**
	 * Instructions to guide the agent's behavior
	 */
	instructions?: {
		/**
		 * Global system-level instructions, applied to all tasks
		 */
		system?: string

		/**
		 * Dynamic page-level instructions callback
		 * Called before each step to get instructions for the current page
		 * @param url - Current page URL (window.location.href)
		 * @returns Instructions string, or undefined/null to skip
		 */
		getPageInstructions?: (url: string) => string | undefined | null
	}

	/**
	 * Lifecycle hooks for task execution.
	 * @experimental API may change in future versions.
	 *
	 * All hooks receive the agent instance as first parameter.
	 */

	/**
	 * Called before each step execution.
	 * @experimental
	 * @param agent - The PageAgentCore instance
	 * @param stepCount - Current step number (0-indexed)
	 */
	onBeforeStep?: (agent: PageAgentCore, stepCount: number) => Promise<void> | void

	/**
	 * Called after each step execution.
	 * @experimental
	 * @param agent - The PageAgentCore instance
	 * @param history - Current history of events
	 */
	onAfterStep?: (agent: PageAgentCore, history: HistoricalEvent[]) => Promise<void> | void

	/**
	 * Called before task execution starts.
	 * @experimental
	 * @param agent - The PageAgentCore instance
	 */
	onBeforeTask?: (agent: PageAgentCore) => Promise<void> | void

	/**
	 * Called after task execution completes (success or failure).
	 * @experimental
	 * @param agent - The PageAgentCore instance
	 * @param result - The execution result
	 */
	onAfterTask?: (agent: PageAgentCore, result: ExecutionResult) => Promise<void> | void

	/**
	 * Called when the agent is disposed.
	 * @experimental
	 * @note This hook can block the disposal process if it's async.
	 * @param agent - The PageAgentCore instance
	 * @param reason - Optional reason for disposal
	 */
	onDispose?: (agent: PageAgentCore, reason?: string) => void

	// page behavior hooks

	/**
	 * @experimental
	 * Enable the experimental script execution tool that allows executing generated JavaScript code on the page.
	 * @note Can cause unpredictable side effects.
	 * @note May bypass some safe guards and data-masking mechanisms.
	 */
	experimentalScriptExecutionTool?: boolean

	/**
	 * @experimental
	 * Fetch /llms.txt from current site origin and include as context.
	 * Only fetched once per origin per task.
	 * @default false
	 */
	experimentalLlmsTxt?: boolean

	/**
	 * Transform page content before sending to LLM.
	 * Called after DOM extraction and simplification, before LLM invocation.
	 * Use cases: inspect extraction results, modify page info, mask sensitive data.
	 *
	 * @param content - Simplified page content that will be sent to LLM
	 * @returns Transformed content
	 *
	 * @example
	 * // Mask phone numbers
	 * transformPageContent: async (content) => {
	 *   return content.replace(/1[3-9]\d{9}/g, '***********')
	 * }
	 */
	transformPageContent?: (content: string) => Promise<string> | string

	/**
	 * Completely override the default system prompt.
	 * @experimental Use with caution - incorrect prompts may break agent behavior.
	 */
	customSystemPrompt?: string

	/**
	 * Delay between steps in seconds.
	 * @default 0.4
	 */
	stepDelay?: number
}

/**
 * Agent reflection state - the reflection-before-action model
 *
 * Every tool call must first reflect on:
 * - evaluation_previous_goal: How well did the previous action achieve its goal?
 * - memory: Key information to remember for future steps
 * - next_goal: What should be accomplished in the next action?
 */
export interface AgentReflection {
	evaluation_previous_goal: string
	memory: string
	next_goal: string
}

/**
 * MacroTool input structure
 *
 * This is the core abstraction that enforces the "reflection-before-action" mental model.
 * Before executing any action, the LLM must output its reasoning state.
 */
export interface MacroToolInput extends Partial<AgentReflection> {
	action: Record<string, any>
}

/**
 * MacroTool output structure
 */
export interface MacroToolResult {
	input: MacroToolInput
	output: string
}

/**
 * A single agent step with reflection and action
 */
export interface AgentStepEvent {
	type: 'step'
	stepIndex: number
	reflection: Partial<AgentReflection>
	action: {
		name: string
		input: any
		output: string
	}
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
		cachedTokens?: number
		reasoningTokens?: number
	}
	/** Raw LLM response for debugging */
	rawResponse?: unknown
	/** Raw LLM request for debugging */
	rawRequest?: unknown
}

/**
 * Persistent observation event (stays in memory)
 */
export interface ObservationEvent {
	type: 'observation'
	content: string
}

/**
 * User takeover event
 */
export interface UserTakeoverEvent {
	type: 'user_takeover'
}

/**
 * Retry event - LLM call is being retried
 */
export interface RetryEvent {
	type: 'retry'
	message: string
	attempt: number
	maxAttempts: number
}

/**
 * Error event - fatal error from LLM or execution
 */
export interface AgentErrorEvent {
	type: 'error'
	message: string
	rawResponse?: unknown
}

/**
 * Union type for all history events
 */
export type HistoricalEvent =
	AgentStepEvent | ObservationEvent | UserTakeoverEvent | RetryEvent | AgentErrorEvent

/**
 * Agent lifecycle status.
 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'stopped'

/**
 * Agent activity - transient state for immediate UI feedback.
 *
 * Unlike historical events (which are persisted), activities are ephemeral
 * and represent "what the agent is doing right now". UI components should
 * listen to 'activity' events to show real-time feedback.
 *
 * Note: There is no 'idle' activity - absence of activity events means idle.
 */
export type AgentActivity =
	| { type: 'thinking' }
	| { type: 'executing'; tool: string; input: unknown }
	| { type: 'executed'; tool: string; input: unknown; output: string; duration: number }
	| { type: 'retrying'; attempt: number; maxAttempts: number }
	| { type: 'error'; message: string }

export interface ExecutionResult {
	success: boolean
	data: string
	history: HistoricalEvent[]
}

```

### Core Architecture Module: `packages/core/src/utils/autoFixer.ts`
```
import { InvokeError, InvokeErrorTypes } from '@page-agent/llms'
import chalk from 'chalk'
import * as z from 'zod/v4'

import type { PageAgentTool } from '../tools'

const log = console.log.bind(console, chalk.yellow('[autoFixer]'))

/**
 * Normalize LLM response and fix common format issues.
 *
 * Handles:
 * - No tool_calls but JSON in message.content (fallback)
 * - Model returns action name as tool call instead of AgentOutput
 * - Arguments wrapped as double JSON string
 * - Nested function call format
 * - Missing action field (fallback to wait)
 * - Primitive action input for single-field tools (e.g. `{"click_element_by_index": 2}`)
 * - etc.
 */
export function normalizeResponse(response: any, tools?: Map<string, PageAgentTool>): any {
	let resolvedArguments: any

	const choice = (response as { choices?: Choice[] }).choices?.[0]
	if (!choice) throw new Error('No choices in response')

	const message = choice.message
	if (!message) throw new Error('No message in choice')

	const toolCall = message.tool_calls?.[0]

	// fix level and location of arguments

	if (toolCall?.function?.arguments) {
		resolvedArguments = safeJsonParse(toolCall.function.arguments)

		// case: sometimes the model only returns the action level
		if (toolCall.function.name && toolCall.function.name !== 'AgentOutput') {
			log(`#1: fixing tool_call`)
			resolvedArguments = { action: safeJsonParse(resolvedArguments) }
		}
	} else {
		// case: sometimes the model returns json in content instead of tool_calls
		if (message.content) {
			const content = message.content.trim()
			const jsonInContent = retrieveJsonFromString(content)
			if (jsonInContent) {
				resolvedArguments = safeJsonParse(jsonInContent)

				// case: sometimes the content json includes upper level wrapper
				if (resolvedArguments?.name === 'AgentOutput') {
					log(`#2: fixing tool_call`)
					resolvedArguments = safeJsonParse(resolvedArguments.arguments)
				}

				// case: sometimes even 2-levels of wrapping
				if (resolvedArguments?.type === 'function') {
					log(`#3: fixing tool_call`)
					resolvedArguments = safeJsonParse(resolvedArguments.function.arguments)
				}

				// case: and sometimes action level only
				// todo: needs better detection logic
				if (
					!resolvedArguments?.action &&
					!resolvedArguments?.evaluation_previous_goal &&
					!resolvedArguments?.memory &&
					!resolvedArguments?.next_goal &&
					!resolvedArguments?.thinking
				) {
					log(`#4: fixing tool_call`)
					resolvedArguments = { action: safeJsonParse(resolvedArguments) }
				}
			} else {
				throw new Error('No tool_call and the message content does not contain valid JSON')
			}
		} else {
			throw new Error('No tool_call nor message content is present')
		}
	}

	// fix double stringified arguments
	resolvedArguments = safeJsonParse(resolvedArguments)
	if (resolvedArguments.action) {
		resolvedArguments.action = safeJsonParse(resolvedArguments.action)
	}

	// validate and fix action input using tool schemas
	if (resolvedArguments.action && tools) {
		resolvedArguments.action = validateAction(resolvedArguments.action, tools)
	}

	// fix incomplete formats
	if (!resolvedArguments.action) {
		log(`#5: fixing tool_call`)
		resolvedArguments.action = { wait: { seconds: 1 } }
	}

	// pack back to standard format
	return {
		...response,
		choices: [
			{
				...choice,
				message: {
					...message,
					tool_calls: [
						{
							...(toolCall || {}),
							function: {
								...(toolCall?.function || {}),
								name: 'AgentOutput',
								arguments: JSON.stringify(resolvedArguments),
							},
						},
					],
				},
			},
		],
	}
}

/**
 * Validate action against tool schemas. Provides clear error messages
 * instead of letting the union schema produce unreadable errors.
 *
 * Also coerces primitive inputs for single-field tools:
 * e.g. `{"click_element_by_index": 2}` → `{"click_element_by_index": {"index": 2}}`
 */
function validateAction(action: any, tools: Map<string, PageAgentTool>): any {
	if (typeof action !== 'object' || action === null) return action

	const toolName = Object.keys(action)[0]
	if (!toolName) return action

	const tool = tools.get(toolName)
	if (!tool) {
		const available = Array.from(tools.keys()).join(', ')
		throw new InvokeError(
			InvokeErrorTypes.INVALID_TOOL_ARGS,
			`Unknown action "${toolName}". Available: ${available}`
		)
	}

	let value = action[toolName]
	const schema = tool.inputSchema

	// coerce primitive input for single-field tools
	if (schema instanceof z.ZodObject && value !== null && typeof value !== 'object') {
		const requiredKey = Object.keys(schema.shape).find(
			(k) => !(schema.shape as Record<string, z.ZodType>)[k].safeParse(undefined).success
		)
		if (requiredKey) {
			log(`coercing primitive action input for "${toolName}"`)
			value = { [requiredKey]: value }
		}
	}

	const result = schema.safeParse(value)
	if (!result.success) {
		throw new InvokeError(
			InvokeErrorTypes.INVALID_TOOL_ARGS,
			`Invalid input for action "${toolName}": ${z.prettifyError(result.error)}`
		)
	}

	return { [toolName]: result.data }
}

/**
 * Safely parse JSON, return original input if not json.
 */
function safeJsonParse(input: any): any {
	if (typeof input === 'string') {
		try {
			return JSON.parse(input.trim())
		} catch {
			return input
		}
	}
	return input
}

/**
 * Extract and parse JSON from a string.
 * - Treat content between the first `{` and the last `}` as JSON.
 * - Try to parse that content as JSON and return the parsed value (object/array/primitive) if successful, otherwise return null.
 */
function retrieveJsonFromString(str: string): any {
	try {
		const json = /({[\s\S]*})/.exec(str) ?? []
		if (json.length === 0) {
			return null
		}
		return JSON.parse(json[0]!)
	} catch {
		return null
	}
}

interface Choice {
	message?: {
		role?: 'assistant'
		content?: string
		tool_calls?: {
			id?: string
			type?: 'function'
			function?: {
				name?: string
				arguments?: string
			}
		}[]
	}
	index?: 0
	finish_reason?: 'tool_calls'
}

```

### Core Architecture Module: `packages/core/src/utils/index.ts`
```
import chalk from 'chalk'

export * from './autoFixer'

/**
 * Wait for `seconds`. If a `signal` is provided, the wait is cancellable:
 * aborting rejects with the signal's reason (an `AbortError`).
 */
export async function waitFor(seconds: number, signal?: AbortSignal): Promise<void> {
	if (!signal) {
		await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
		return
	}
	signal.throwIfAborted()
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort)
			resolve()
		}, seconds * 1000)
		const onAbort = () => {
			clearTimeout(timer)
			// reason is a DOMException AbortError.
			reject(signal.reason as DOMException)
		}
		signal.addEventListener('abort', onAbort, { once: true })
	})
}

//

export function truncate(text: string, maxLength: number): string {
	if (text.length > maxLength) {
		return text.substring(0, maxLength) + '...'
	}
	return text
}

//

export function randomID(existingIDs?: string[]): string {
	let id = Math.random().toString(36).substring(2, 11)

	if (!existingIDs) {
		return id
	}

	const MAX_TRY = 1000
	let tryCount = 0

	while (existingIDs.includes(id)) {
		id = Math.random().toString(36).substring(2, 11)
		tryCount++
		if (tryCount > MAX_TRY) {
			throw new Error('randomID: too many tries')
		}
	}

	return id
}

//
const _global = globalThis as any

if (!_global.__PAGE_AGENT_IDS__) {
	_global.__PAGE_AGENT_IDS__ = []
}

const ids = _global.__PAGE_AGENT_IDS__

/**
 * Generate a random ID.
 * @note Unique within this window.
 */
export function uid() {
	const id = randomID(ids)
	ids.push(id)
	return id
}

const llmsTxtCache = new Map<string, string | null>()

/** Fetch /llms.txt for a URL's origin. Cached per origin, `null` = tried and not found. */
export async function fetchLlmsTxt(url: string): Promise<string | null> {
	let origin: string
	try {
		origin = new URL(url).origin
	} catch {
		return null // Invalid URL
	}
	// about:blank, data:, file:
	if (origin === 'null') return null

	if (llmsTxtCache.has(origin)) return llmsTxtCache.get(origin)!

	const endpoint = `${origin}/llms.txt`
	let result: string | null = null
	try {
		console.log(chalk.gray(`[llms.txt] Fetching ${endpoint}`))
		const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) })
		if (res.ok) {
			result = await res.text()
			console.log(chalk.green(`[llms.txt] Found (${result.length} chars)`))
			if (result.length > 1000) {
				console.log(chalk.yellow(`[llms.txt] Truncating to 1000 chars`))
				result = truncate(result, 1000)
			}
		} else {
			console.debug(chalk.gray(`[llms.txt] ${res.status} for ${endpoint}`))
		}
	} catch (e) {
		console.debug(chalk.gray(`[llms.txt] not found for ${endpoint}`), e)
	}
	llmsTxtCache.set(origin, result)
	return result
}

/**
 * Simple assertion function that throws an error if the condition is falsy
 * @param condition - The condition to assert
 * @param message - Optional error message
 * @throws Error if condition is falsy
 */
export function assert(condition: unknown, message?: string, silent?: boolean): asserts condition {
	if (!condition) {
		const errorMessage = message ?? 'Assertion failed'

		if (!silent) console.error(chalk.red(`❌ assert: ${errorMessage}`))

		throw new Error(errorMessage)
	}
}

/**
 * Suppress errors from a function.
 */
export async function suppress<T>(fn: () => T | Promise<T>): Promise<Awaited<T> | undefined> {
	try {
		return await fn()
	} catch (error) {
		console.error(error)
		return undefined
	}
}

```

### Core Architecture Module: `packages/core/vite.config.js`
```
// @ts-check
import { dirname, resolve } from 'path'
import dts from 'unplugin-dts/vite'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ES Module for NPM Package
export default defineConfig({
	clearScreen: false,
	plugins: [
		dts({
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts'],
			bundleTypes: true,
			compilerOptions: {
				composite: true,
				noEmit: false,
				emitDeclarationOnly: true,
				declaration: true,
			},
		}),
		cssInjectedByJsPlugin({ relativeCSSInjection: true }),
	],
	publicDir: false,
	build: {
		lib: {
			entry: resolve(__dirname, 'src/PageAgentCore.ts'),
			name: 'PageAgentCore',
			fileName: 'page-agent-core',
			formats: ['es'],
		},
		outDir: resolve(__dirname, 'dist', 'esm'),
		rollupOptions: {
			external: [
				'chalk',
				'zod',
				'zod/v4',
				// all the internal packages
				/^@page-agent\//,
			],
		},
		minify: false,
		sourcemap: true,
		cssCodeSplit: true,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
})

```

### Core Architecture Module: `packages/extension/src/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `packages/llms/src/utils.ts`
```
/**
 * Utility functions for LLM integration
 */
import chalk from 'chalk'
import * as z from 'zod/v4'

import type { Tool } from './types'

function debug(...args: unknown[]) {
	console.debug(chalk.gray('[LLM]'), ...args)
}

/**
 * Convert Zod schema to OpenAI tool format
 * Uses Zod 4 native z.toJSONSchema()
 */
export function zodToOpenAITool(name: string, tool: Tool) {
	return {
		type: 'function' as const,
		function: {
			name,
			description: tool.description,
			parameters: z.toJSONSchema(tool.inputSchema, { target: 'openapi-3.0' }),
		},
	}
}

/**
 * Patch model specific parameters. Only patches known models.
 *
 * @purpose
 * - Reconcile the differences in the parameter schema each model accepts.
 * - Disable thinking/reasoning, or lower it to the minimum where a full disable is impossible.
 * - Minimize returned tokens.
 * - Raise temperature for known smaller models to improve auto-recovery odds.
 * @note Honor temperature if explicitly set by the user
 *
 * @todo Need vendor-specific patches.
 * Local and 3rd-party hosted models may have different schema.
 */
export function modelPatch(body: Record<string, any>, baseURL?: string) {
	const model: string = body.model || ''
	if (!model) return body

	const provider = getProvider(baseURL)

	const modelName = normalizeModelName(model)

	if (modelName.startsWith('qwen')) {
		if (provider === 'openrouter' && modelName.startsWith('qwen38-max')) {
			// OpenRouter forces thinking on for this endpoint, and Qwen rejects tool_choice in thinking mode
			debug('Patch Qwen3.8-max on OpenRouter: reasoning_effort=low, remove tool_choice')
			body.reasoning_effort = 'low'
			delete body.tool_choice
		} else {
			debug('Patch Qwen: disable thinking')
			body.enable_thinking = false
		}
		if (body.temperature === undefined && !/max|plus/.test(modelName)) {
			debug('Patch Qwen: raise temperature to 1.0')
			body.temperature = 1.0
		}
	}

	if (modelName.startsWith('deepseek')) {
		debug('Patch DeepSeek: disable thinking, remove tool_choice')
		body.thinking = { type: 'disabled' }
		delete body.tool_choice
	}

	if (modelName.startsWith('gpt')) {
		if (modelName.startsWith('gpt-5')) {
			body.verbosity = 'low'
		}

		// Since gpt-5.4, /chat/completions rejects any explicit reasoning_effort
		// when function tools are present. Newer models are expected to follow.
		// - gpt-5.1 / gpt-5.2 can fully disable reasoning
		// - gpt-5 / -mini / -nano bottom out at "minimal"
		// - everything else (gpt-4.x, chat-latest, gpt-5.4+) must not receive it
		if (modelName.includes('chat-latest')) {
			debug('Patch chat-latest: omit reasoning_effort and temperature')
			delete body.reasoning_effort
			delete body.temperature
		} else if (/^gpt-5[12](-|$)/.test(modelName)) {
			debug('Patch GPT-5.1/5.2: reasoning_effort=none')
			body.reasoning_effort = 'none'
		} else if (/^gpt-5(-|$)/.test(modelName)) {
			debug('Patch GPT-5: reasoning_effort=minimal')
			body.reasoning_effort = 'minimal'
		} else {
			debug('Patch GPT: omit reasoning_effort')
			delete body.reasoning_effort
		}
	}

	if (modelName.startsWith('claude')) {
		if (/opus|sonnet|haiku/.test(modelName)) {
			debug('Patch Claude: disable thinking')
			body.thinking = { type: 'disabled' }

			if (provider !== 'openrouter') {
				// Convert tool_choice to Claude format
				if (body.tool_choice === 'required') {
					// 'required' -> { type: 'any' } (must call some tool)
					debug('Applying Claude patch: convert tool_choice "required" to { type: "any" }')
					body.tool_choice = { type: 'any' }
				} else if (body.tool_choice?.function?.name) {
					// { type: 'function', function: { name: '...' } } -> { type: 'tool', name: '...' }
					debug('Applying Claude patch: convert tool_choice format')
					body.tool_choice = { type: 'tool', name: body.tool_choice.function.name }
				}
			}
		} else {
			debug('Patch Claude: reasoning_effort=low')
			body.reasoning_effort = 'low'

			// Fable and mythos can not disable adaptive thinking.
			// Claude does not support tool_choice with extended thinking.
			// These 2 concepts are blurred. Basically no tool_choice with thinking.
			delete body.tool_choice
		}
	}

	if (modelName.startsWith('gemini')) {
		debug('Patch Gemini: reasoning_effort=low')
		body.reasoning_effort = 'low'
		if (/^gemini-25(?!.*pro)/.test(modelName)) {
			debug('Patch Gemini 2.5 non-Pro: reasoning_effort=none')
			body.reasoning_effort = 'none'
		} else if (
			modelName.startsWith('gemini-35-flash') ||
			modelName.startsWith('gemini-31-flash-lite') ||
			modelName.startsWith('gemini-3-flash')
		) {
			debug('Patch Gemini 3.x Flash/Lite: reasoning_effort=minimal')
			body.reasoning_effort = 'minimal'
		}
	}

	if (modelName.startsWith('glm')) {
		if (/^glm-5[3-9]/.test(modelName)) {
			// GLM 5.3+ cannot disable thinking
			debug('Patch GLM 5.3+: reasoning_effort=low')
			body.reasoning_effort = 'low'
		} else {
			debug('Patch GLM: disable thinking')
			body.thinking = { type: 'disabled' }
		}
	}

	if (modelName.startsWith('hy')) {
		debug('Patch Hunyuan: disable thinking, reasoning_effort=low')
		body.thinking = { type: 'disabled' }
		body.reasoning_effort = 'low'
	}

	if (modelName.startsWith('grok')) {
		if (/^grok-4-?3/.test(modelName)) {
			debug('Patch Grok 4.3: reasoning_effort=none')
			body.reasoning_effort = 'none'
		} else if (modelName.startsWith('grok-3-mini') || modelName.startsWith('grok-code-fast')) {
			debug('Patch Grok mini/code: reasoning_effort=low')
			body.reasoning_effort = 'low'
		}
	}

	if (modelName.startsWith('kimi')) {
		if (modelName.startsWith('kimi-k3')) {
			// Kimi K3 always thinks and rejects named tool choice while thinking.
			debug('Patch Kimi K3: use required tool choice, remove parallel tool calls')
			delete body.parallel_tool_calls
			if (body.tool_choice?.function?.name) body.tool_choice = 'required'
		} else if (!modelName.includes('code')) {
			// kimi-k2.7-code cannot disable thinking
			debug('Patch Kimi: disable thinking')
			body.thinking = { type: 'disabled' }
		}
	}

	if (modelName.startsWith('minimax')) {
		debug('Patch MiniMax: remove parallel_tool_calls')
		delete body.parallel_tool_calls

		if (modelName.includes('m3')) {
			// Only M3 can disable thinking
			debug('Patch MiniMax: disable thinking')
			body.thinking = { type: 'disabled' }
		}
	}

	// provider patches

	if (provider === 'openrouter') {
		// openrouter use reasoning object instead of reasoning_effort

		const reasoningEffort = body.reasoning_effort
		const reasoningDisabled =
			body.thinking?.type === 'disabled' ||
			body.enable_thinking === false ||
			reasoningEffort === 'none'

		if (reasoningDisabled) {
			body.reasoning = { enabled: false }
		} else if (reasoningEffort) {
			body.reasoning = { enabled: true, effort: reasoningEffort }
		}
	}

	return body
}

/**
 * check if a given model ID fits a specific model name
 *
 * @note
 * Different model providers may use different model IDs for the same model.
 * For example, openai's `gpt-5.2` may called:
 *
 * - `gpt-5.2-version`
 * - `gpt-5_2-date`
 * - `GPT-52-version-date`
 * - `openai/gpt-5.2-chat`
 *
 * They should be treated as the same model.
 * Normalize them to `gpt-52`
 */
export function normalizeModelName(modelName: string): string {
	let normalizedName = modelName.toLowerCase()

	// remove prefix before '/'
	if (normalizedName.includes('/')) {
		normalizedName = normalizedName.split('/')[1]
	}

	// remove '_'
	normalizedName = normalizedName.replace(/_/g, '')

	// remove '.'
	normalizedName = normalizedName.replace(/\./g, '')

	return normalizedName
}

export function getProvider(baseURL?: string): 'openrouter' | undefined {
	if (!baseURL) return undefined
	try {
		const url = new URL(baseURL)
		const hostname = url.hostname
		if (hostname === 'openrouter.ai') return 'openrouter'
		return undefined
	} catch (e) {
		return undefined
	}
}

```

### Core Architecture Module: `packages/page-controller/src/utils/index.ts`
```
// ======= type guards =======
// @note instanceof fails for elements inside iframes

export function isHTMLElement(el: unknown): el is HTMLElement {
	// @todo either specify to HTMLElement or allow Element here.
	return !!el && (el as Node).nodeType === 1
}

export function isInputElement(el: Element): el is HTMLInputElement {
	return el?.nodeType === 1 && el.tagName === 'INPUT'
}

export function isTextAreaElement(el: Element): el is HTMLTextAreaElement {
	return el?.nodeType === 1 && el.tagName === 'TEXTAREA'
}

export function isSelectElement(el: Element): el is HTMLSelectElement {
	return el?.nodeType === 1 && el.tagName === 'SELECT'
}

export function isAnchorElement(el: Element): el is HTMLAnchorElement {
	return el?.nodeType === 1 && el.tagName === 'A'
}

// ======= iframe helpers =======

/** Iframe offset for translating element coordinates to top-frame viewport. */
export function getIframeOffset(element: HTMLElement): { x: number; y: number } {
	const frame = element.ownerDocument.defaultView?.frameElement as HTMLElement | null
	if (!frame) return { x: 0, y: 0 }
	const rect = frame.getBoundingClientRect()
	return { x: rect.left, y: rect.top }
}

/**
 * Get native value setter from the element's own prototype (iframe-safe).
 * @note for React
 */
export function getNativeValueSetter(element: HTMLInputElement | HTMLTextAreaElement) {
	// eslint-disable-next-line @typescript-eslint/unbound-method
	return Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element) as object, 'value')!
		.set as (v: string) => void
}

// ======= general utils =======

export async function waitFor(seconds: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

// ======= mask events =======

/**
 * Move the visual pointer to a position within an element.
 * @param x - x coordinate in the element's document viewport
 * @param y - y coordinate in the element's document viewport
 */
export async function movePointerToElement(element: HTMLElement, x: number, y: number) {
	const offset = getIframeOffset(element)

	window.dispatchEvent(
		new CustomEvent('PageAgent::MovePointerTo', {
			detail: { x: x + offset.x, y: y + offset.y },
		})
	)

	await waitFor(0.3)
}

export async function clickPointer() {
	window.dispatchEvent(new CustomEvent('PageAgent::ClickPointer'))
}

export async function enablePassThrough() {
	window.dispatchEvent(new CustomEvent('PageAgent::EnablePassThrough'))
}

export async function disablePassThrough() {
	window.dispatchEvent(new CustomEvent('PageAgent::DisablePassThrough'))
}

```

### Core Architecture Module: `packages/ui/src/utils.ts`
```
export function truncate(text: string, maxLength: number): string {
	if (text.length > maxLength) {
		return text.substring(0, maxLength) + '...'
	}
	return text
}

/**
 * Escape HTML special characters to prevent XSS and rendering issues
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

```

### Core Architecture Module: `packages/website/src/hooks/useGitHubStars.ts`
```
import { useEffect, useState } from 'react'

const STATS_URL = 'https://page-agent.github.io/gh-stats/stats.json'

let cached: number | null = null

export function useGitHubStars() {
	const [stars, setStars] = useState(cached)

	useEffect(() => {
		if (cached !== null) return
		const controller = new AbortController()
		fetch(STATS_URL, { signal: controller.signal })
			.then((r) => r.json())
			.then((data) => {
				cached = data.stargazers_count ?? null
				setStars(cached)
			})
			.catch(() => {})
		return () => controller.abort()
	}, [])

	return stars
}

export function formatStars(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
	return String(n)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #550** (2026-06-11): **Stale currentTabId can flash mask on previous tab when a new run starts quickly**
  *Symptoms*: ## Problem  When a second extension run starts within ~2s of the previous run's heartbeat, the content script can briefly re-enable the mask on the **previous** run's tab.  ### Root cause  `MultiPageAgent` projects `isAgentRunning: true` into `chrome.storage` synchronously on the core `running` status event, *before* `TabsController.init()` runs. `init()` resets `this.currentTabId` only in memory and does not publish the new `currentTabId` to storage until the end of its async tab/group setup.  The content script decides where to show the mask from `isAgentRunning` + a recent `agentHeartbeat` + `currentTabId`. During the init window, storage still holds the **previous** run's `currentTabId`, so the old tab can flash the mask until init completes.  ### Trigger conditions (all required)  - Two runs start < 2s apart (heartbeat still within the `agentInTouch` window) - The two runs use different initial tabs - The previous tab's content script is still alive  ### Impact  Cosmetic only: a brief (≤1s) mask flicker on the previous tab. No functional breakage.  ### Fix  In `TabsController.init()`, clear `currentTabId` through `updateCurrentTabId(null)` (which also writes storage) instead of only resetting the in-memory field, keeping the storage projection consistent with `isAgentRunning`.
  **Post-Mortem & Fix Analysis**:
  > done

- **Issue #391** (2026-04-03): **[Bug] 是否支持本地部署的模型**
  *Symptoms*: ### What happened?  是否支持本地部署的模型，使用sglang跑的没有apikey？填写地址得时候只需要填写到V1就行嘛？运行的时候会显示 InvokeError: HTTP 404: Not Found  ### Code  ```typescript  ```  ### Browser  _No response_  ### version  _No response_  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > 已解决

- **Issue #387** (2026-04-02): **[Bug] 无法使用minimax模型**
  *Symptoms*: ### What happened?  InvokeError: Authentication failed: invalid api key (2049) 一直报错，但是postman能够正常访问 const pageAgent = new PageAgent({   baseURL: 'https://api.minimax.io/v1',   apiKey: '',   model: 'MiniMax-M2.7' }); 这个是我的  // MiniMax const pageAgent = new PageAgent({   baseURL: 'https://api.minimax.io/v1',   apiKey: 'your-minimax-api-key',   model: 'MiniMax-M2.7' });这个是你们官方提供的，这样就报错  https://api.minimaxi.com/v1/chat/completions我这样用postman调用是正常的，一样的apikey  ### Code  ```typescript  ```  ### Browser  _No response_  ### version  _No response_  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > 看起来就是填错了 apiKey 呀？
  > 但是为什么使用postman就可以正常调用呢？  ---原始邮件--- 发件人: ***@***.***&gt; 发送时间: 2026年4月2日(周四) 晚上7:50 收件人: ***@***.***&gt;; 抄送: ***@***.******@***.***&gt;; 主题: Re: [alibaba/page-agent] [Bug] 无法使用minimax模型 (Issue #387)   gaomeng1900 left a comment (alibaba/page-agent#387)   看起来就是填错了 apiKey 呀？   — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***&gt;
  > 您是否使用过pageAgent？我在apikey这个参数能否填token plan的那个apikey？    ---原始邮件--- 发件人: ***@***.***&gt; 发送时间: 2026年4月2日(周四) 晚上7:50 收件人: ***@***.***&gt;; 抄送: ***@***.******@***.***&gt;; 主题: Re: [alibaba/page-agent] [Bug] 无法使用minimax模型 (Issue #387)   gaomeng1900 left a comment (alibaba/page-agent#387)   看起来就是填错了 apiKey 呀？   — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

- **Issue #382** (2026-04-02): **[Bug] 点击按钮的弹出窗口中，再添加会失败**
  *Symptoms*: ### What happened?  我是要在地图弹窗，取坐标，先搜，再下拉关联搜索中选一个，再点击获取坐标，再选中坐标，返回到父窗口，有些复杂了。 高德地图开放的的搜索apikey是没有按钮的(放按钮也没反应)，只能通过输入的内容，在input框的下方出现关联搜索，点击第一条匹配的条目，完成搜索。地图同时定位到第一条关联搜索中的地址，点击地图，获取到经纬度，再点击选定此坐标。返回父窗口。 <img width="1217" height="1096" alt="Image" src="https://github.com/user-attachments/assets/a06fa2dc-41a6-4abb-b965-900b0cdab27e" />  ### Code  ```typescript  ```  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > js 版本只能操作页面内哦，同源 iframe 还有可能，弹窗不行的。 插件可以操作同一窗口中的多个 tab，但是弹窗是单独的窗口，也是不行的。

- **Issue #367** (2026-03-30): **[Bug] Cannot support lm studio**
  *Symptoms*: ### What happened?  Invalid tool_choice type: 'object'. Supported string values: none, auto, required <img width="1746" height="1222" alt="Image" src="https://github.com/user-attachments/assets/a031e05b-9b31-4a21-9f97-e7d798970a29" />   ### Code  ```typescript  ```  ### Browser  _No response_  ### version  _No response_  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > Try `disableNamedToolChoice`.

- **Issue #361** (2026-03-31): **[Bug] ChatGPT对话右上角按钮模拟点击无响应**
  *Symptoms*: ### What happened?  <img width="2242" height="1311" alt="Image" src="https://github.com/user-attachments/assets/de0a41f0-29c7-4177-b1e8-ea04a9bd082c" /> 如图所示，红框内按钮能识别到，但是点击无响应。  ### Code  ```typescript  ```  ### Browser  _No response_  ### version  _No response_  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > 已定位到问题，我来修一下
  > 已修复，随 1.7.0 发布

- **Issue #359** (2026-04-02): **[Bug] 请问使用浏览器扩展的方式，如何使用系统提示词instructions**
  *Symptoms*: ### What happened?  <img width="645" height="320" alt="Image" src="https://github.com/user-attachments/assets/baf3662c-1122-4fc3-a14f-029a7b8f7019" />  如图所是，我这样设置instructions在项目组运行无效，完全不参考。并不是写的是否正确的问题，是完全不参考。所以想请问一下扩展模式下，如何使用instructions，谢谢。  另，我在扩展侧栏中输入提示词是可以的，但是代码里不行。  <img width="402" height="662" alt="Image" src="https://github.com/user-attachments/assets/9f60a2cb-1418-436b-a6f9-04a6a771d63e" />  <img width="351" height="213" alt="Image" src="https://github.com/user-attachments/assets/3c548d52-3e0c-41de-9ed1-f1ea016540f5" />  ### Code  ```typescript // 执行指令 并返回结果。    command：用户指令   const executeCommand = async (command: string): Promise<string> => {     // Usage     if (await waitForExtension()) {       const result = await (window as any).PAGE_AGENT_EXT.execute(command, {         baseURL: config.baseURL,         apiKey: config.apiKey,         model: config.model,         // includeInitialTab: false,         instructions: {           system: `           你是一个专业的网页操作助手，负责帮助用户执行数据中台系统的任务。            当我让你做数据中台的指令时，你就前往http://localhost:7777/web/#/portal这个页面。            请严格遵循以下步骤：           1. 首先确保你在 http://localhost:7777/web/#/portal 页面           2. 如果需要操作子系统，点击"进入系统"按钮后，必须切换到新打开的标签页继续操作           3. 如果右上角显示未登录状态，请先登录：             - 账号：admin             - 密码：admin             - 验证码：123           4. 执行用户指令时，确保在正确的页面上操作，不要停留在门户页面            请按照以上规则执行任务，确保操作的准确性。           `,         },         // 当前 Agent 执行状态。 'idle' | 'running' | 'completed' | 'error'         onStatusChange: 
  **Post-Mortem & Fix Analysis**:
  > `PAGE_AGENT_EXT` 上暴露的接口中没有包含 `instructions` 字段，  ```typescript interface ExecuteConfig {   baseURL: string   model: string   apiKey?: string   includeInitialTab?: boolean   onStatusChange?: (status: AgentStatus) => void   onActivity?: (activity: AgentActivity) => void   onHistoryUpdate?: (history: HistoricalEvent[]) => void }  ```  倒是可以加上。这份配置需要跨线程传输，不能传函数，可以加个字段就叫 `systemInstruction` 来避开 `getPageInstructions`
  > > `PAGE_AGENT_EXT` 上暴露的接口中没有包含 `instructions` 字段， >  > interface ExecuteConfig { >   baseURL: string >   model: string >   apiKey?: string >   includeInitialTab?: boolean >   onStatusChange?: (status: AgentStatus) => void >   onActivity?: (activity: AgentActivity) => void >   onHistoryUpdate?: (history: HistoricalEvent[]) => void > } > 倒是可以加上。这份配置需要跨线程传输，不能传函数，可以加个字段就叫 `systemInstruction` 来避开 `getPageInstructions`  是的，系统提示词还是需要的。谢谢回复~👍🏻
  > 安全起见 agent 这能看到当前任务的 tab group 中的 tab，听起来 C 没有在可控的 tab group 中。 尝试下 includeInitialTab ？

- **Issue #357** (2026-04-03): **[Bug] 当输入指令，让其填写表单，点击表单提交时无法通过表单验证**
  *Symptoms*: ### What happened?  <img width="1066" height="686" alt="Image" src="https://github.com/user-attachments/assets/e518e298-a474-48af-9f55-ba0d039984a4" />  ### Code  ```typescript  ```  ### Browser  _No response_  ### version  _No response_  ### Community Communication / 社区沟通  - [x] I will be polite and respectful. / 我会保持礼貌与尊重。 - [x] I will share constructive, actionable suggestions. / 我会提供建设性、可行动的建议。 - [x] I have read the Code of Conduct. / 我已阅读行为准则。
  **Post-Mortem & Fix Analysis**:
  > 看起来没有 trigger 到这个表单的数据更新。 能否提供下可复现的网址，不能的话需要提供下该表单的技术方案。
  > 需要更多信息来复现，暂时先关了

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

### Incident Patch 1: `891765cb` (2026-09-06)
**Commit Message**: chore: fix size badge (#714)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 [![CI](https://img.shields.io/github/actions/workflow/status/alibaba/page-agent/main-ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/alibaba/page-agent/actions/workflows/main-ci.yml)
 [![npm](https://img.shields.io/npm/v/page-agent?style=flat-square&label=npm)](https://www.npmjs.com/package/page-agent)
 [![downloads](https://img.shields.io/npm/dt/page-agent?style=flat-square)](https://www.npmjs.com/package/page-agent)
-[![size](https://img.shields.io/bundlephobia/minzip/page-agent?style=flat-square&label=size)](https://bundlephobia.com/package/page-agent)
+[![Minzipped bundle size (excluding Zod)](https://deno.bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D&badge&badge-style=flat-square)](https://bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D 'Minified + gzip size, excluding the Zod peer dependency')
 [![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
 [![typescript](https://img.shields.io/badge/%3C%2F%3E-typescript-blue?style=flat-square)](http://www.typescriptlang.org/)
 [![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/akldabonmimlicnjlflnapfeklbfemhj?style=flat-square&label=chrome%20rating)](https://chromewebstore.google.com/detail/page-agent-ext/akldabonmimlicnjlflnapfeklbfemhj)
```

**File**: `docs/README-zh.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 [![CI](https://img.shields.io/github/actions/workflow/status/alibaba/page-agent/main-ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/alibaba/page-agent/actions/workflows/main-ci.yml)
 [![npm](https://img.shields.io/npm/v/page-agent?style=flat-square&label=npm)](https://www.npmjs.com/package/page-agent)
 [![downloads](https://img.shields.io/npm/dt/page-agent?style=flat-square)](https://www.npmjs.com/package/page-agent)
-[![size](https://img.shields.io/bundlephobia/minzip/page-agent?style=flat-square&label=size)](https://bundlephobia.com/package/page-agent)
+[![Minzipped bundle size (excluding Zod)](https://deno.bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D&badge&badge-style=flat-square)](https://bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D 'Minified + gzip size, excluding the Zod peer dependency')
 [![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
 [![typescript](https://img.shields.io/badge/%3C%2F%3E-typescript-blue?style=flat-square)](http://www.typescriptlang.org/)
 [![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/akldabonmimlicnjlflnapfeklbfemhj?style=flat-square&label=chrome%20rating)](https://chromewebstore.google.com/detail/page-agent-ext/akldabonmimlicnjlflnapfeklbfemhj)
```

**File**: `packages/website/src/pages/docs/introduction/overview/page.tsx` (modified, +5/-2)
```diff
@@ -33,11 +33,14 @@ export default function Overview() {
 						<img src="https://img.shields.io/npm/dt/page-agent.svg" alt="Downloads" />
 					</a>
 					<a
-						href="https://bundlephobia.com/package/page-agent"
+						href="https://bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D"
 						target="_blank"
 						rel="noopener noreferrer"
 					>
-						<img src="https://img.shields.io/bundlephobia/minzip/page-agent" alt="Bundle Size" />
+						<img
+							src="https://deno.bundlejs.com/?q=page-agent&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22zod%22%5D%7D%7D&badge"
+							alt="Minzipped bundle size (excluding Zod)"
+						/>
 					</a>
 					<a href="https://github.com/alibaba/page-agent" target="_blank" rel="noopener noreferrer">
 						<img
```

---

### Incident Patch 2: `5d7338c1` (2026-09-05)
**Commit Message**: fix(page-controller): preserve input focus for Bing suggestions (#712)

**File**: `packages/page-controller/src/actions.ts` (modified, +0/-2)
```diff
@@ -227,8 +227,6 @@ export async function inputTextElement(element: HTMLElement, text: string) {
 	}
 
 	await waitFor(0.1)
-
-	blurLastClickedElement()
 }
 
 /**
```

---

### Incident Patch 3: `dd4e0f09` (2026-09-05)
**Commit Message**: fix(llms): make debug logs removable by consumer bundles (#623)

* fix(llms): make debug logs removable by consumer bundles

* chore(llms): remove redundant console-drop test and comments

---------

Co-authored-by: Simon <[REDACTED_EMAIL]>

**File**: `packages/llms/src/utils.ts` (modified, +3/-1)
```diff
@@ -6,7 +6,9 @@ import * as z from 'zod/v4'
 
 import type { Tool } from './types'
 
-const debug = console.debug.bind(console, chalk.gray('[LLM]'))
+function debug(...args: unknown[]) {
+	console.debug(chalk.gray('[LLM]'), ...args)
+}
 
 /**
  * Convert Zod schema to OpenAI tool format
```

---

### Incident Patch 4: `eae9aecd` (2026-09-05)
**Commit Message**: chore(deps): bump brace-expansion (#695)

Bumps  and [brace-expansion](https://github.com/juliangruber/brace-expansion). These dependencies needed to be updated together.

Updates `brace-expansion` from 5.0.6 to 5.0.9
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.9)

Updates `brace-expansion` from 1.1.15 to 1.1.18
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.9)

Updates `brace-expansion` from 2.1.1 to 2.1.4
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.9)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.9
  dependency-type: indirect
- dependency-name: brace-expansion
  dependency-version: 1.1.18
  dependency-type: indirect
- dependency-name: brace-expansion
  dependency-version: 2.1.4
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+depen

**File**: `package-lock.json` (modified, +10/-10)
```diff
@@ -2914,9 +2914,9 @@
             "license": "MIT"
         },
         "node_modules/@trivago/prettier-plugin-sort-imports/node_modules/brace-expansion": {
-            "version": "2.1.1",
-            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.1.tgz",
-            "integrity": "sha512-WR1cURNjuvBLMZBMbqM0UoE+WAfdUcEV1ccD8PVBVOI+Z3ND4+SZbN8RsfT2bMuG1qwz5RFvPukSZm5fF2D5eA==",
+            "version": "2.1.4",
+            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
+            "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
@@ -4426,16 +4426,16 @@
             }
         },
         "node_modules/brace-expansion": {
-            "version": "5.0.6",
-            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.6.tgz",
-            "integrity": "sha512-kLpxurY4Z4r9sgMsyG0Z9uzsBlgiU/EFKhj/h91/8yHu0edo7XuixOIH3VcJ8kkxs6/jPzoI6U9Vj3WqbMQ94g==",
+            "version": "5.0.9",
+            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
+            "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
                 "balanced-match": "^4.0.2"
             },
             "engines": {
-                "node": "18 || 20 || >=22"
+                "node": "20 || >=22"
             }
         },
         "node_modules/buffer-equal-constant-time": {
@@ -8270,9 +8270,9 @@
             "license": "MIT"
         },
         "node_modules/multimatch/node_modules/brace-expansion": {
-            "version": "1.1.15",
-            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-            "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+            "version": "1.1.18",
+            "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
+            "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
```

---

### Incident Patch 5: `e223e238` (2026-09-03)
**Commit Message**: fix(extension): restore Zod 3/4 peer range (#705)

Dependabot #690 rewrote the compatibility union to ^4.5.1.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +1/-1)
```diff
@@ -11432,7 +11432,7 @@
                 "wxt": "^0.20.27"
             },
             "peerDependencies": {
-                "zod": "^4.5.1"
+                "zod": "^3.25.0 || ^4.0.0"
             }
         },
         "packages/llms": {
```

**File**: `packages/extension/package.json` (modified, +1/-1)
```diff
@@ -47,6 +47,6 @@
         "chalk": "^6.0.0"
     },
     "peerDependencies": {
-        "zod": "^4.5.1"
+        "zod": "^3.25.0 || ^4.0.0"
     }
 }
```

---

### Incident Patch 6: `053ff924` (2026-09-03)
**Commit Message**: chore(deps): bump postcss from 8.5.20 to 8.5.26 (#667)

Bumps [postcss](https://github.com/postcss/postcss) from 8.5.20 to 8.5.26.
- [Release notes](https://github.com/postcss/postcss/releases)
- [Changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss/compare/8.5.20...8.5.26)

---
updated-dependencies:
- dependency-name: postcss
  dependency-version: 8.5.26
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +7/-7)
```diff
@@ -7873,9 +7873,9 @@
             }
         },
         "node_modules/nanoid": {
-            "version": "3.3.16",
-            "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.16.tgz",
-            "integrity": "sha512-bzlKTyNJ7+LdGIIwy8ijFpIqEQIvafahV7eYykJ8Cvh42EdJeODoJ6gUJXpQJvej1BddH8OqTXZNE/KfbWAu8Q==",
+            "version": "3.3.18",
+            "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+            "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
             "dev": true,
             "funding": [
                 {
@@ -8435,9 +8435,9 @@
             }
         },
         "node_modules/postcss": {
-            "version": "8.5.20",
-            "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.20.tgz",
-            "integrity": "sha512-lW616l85ucIQL+FocMmL7pQFPqBmwejrCMg+iPxyImlrANNJG9NHq/RkyCZopDhd8C3LA03PHRJDjkbGu8vvug==",
+            "version": "8.5.26",
+            "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.26.tgz",
+            "integrity": "sha512-u82N74LFzG8ca+dD8puPnplTXoGH4fTPpVGuIbt36G3qvNlkvfD0lEAZSxaly3KX8TS/L1A1gsCEmvKmBcVbkQ==",
             "dev": true,
             "funding": [
                 {
@@ -8455,7 +8455,7 @@
             ],
             "license": "MIT",
             "dependencies": {
-                "nanoid": "^3.3.16",
+                "nanoid": "^3.3.17",
                 "picocolors": "^1.1.1",
                 "source-map-js": "^1.2.1"
             },
```

---

### Incident Patch 7: `e053d55a` (2026-07-15)
**Commit Message**: docs: CDN quick start in README and website (#617)

* docs: simplify README CDN quick start

Prefer one primary script URL per locale and clarify autoInit with custom LLMs.

* docs(website): add CDN mirror dropdown to quick start

Replace the mirrors table with a dropdown that switches the script URL.

* docs(website): pass page language to demo CDN URL in quick start

**File**: `README.md` (modified, +5/-6)
```diff
@@ -59,15 +59,14 @@ Fastest way to try PageAgent with our free Demo LLM:
     src="https://cdn.jsdelivr.net/npm/page-agent@1.12.1/dist/iife/page-agent.demo.js"
     crossorigin="anonymous"
 ></script>
+
+<!-- China CDN mirror if you can't access jsDelivr -->
+<!-- https://registry.npmmirror.com/page-agent/1.12.1/files/dist/iife/page-agent.demo.js -->
 ```
 
 > **⚠️ For technical evaluation only.** This demo CDN uses our free [testing LLM API](https://alibaba.github.io/page-agent/docs/features/models#free-testing-api). By using it, you agree to its [terms](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md).
-> Add `?autoInit=false` to load the script without creating the demo agent automatically. You can then instantiate it with `new window.PageAgent(...)`.
-
-| Mirrors | URL                                                                                 |
-| ------- | ----------------------------------------------------------------------------------- |
-| Global  | https://cdn.jsdelivr.net/npm/page-agent@1.12.1/dist/iife/page-agent.demo.js         |
-| China   | https://registry.npmmirror.com/page-agent/1.12.1/files/dist/iife/page-agent.demo.js |
+>
+> Add `?autoInit=false` to load the script without creating the demo agent automatically. You can then instantiate it with `new window.PageAgent(...)` and your own LLMs.
 
 ### NPM Installation
 
```

**File**: `docs/README-zh.md` (modified, +3/-7)
```diff
@@ -55,18 +55,14 @@
 
 ```html
 <script
-    src="https://cdn.jsdelivr.net/npm/page-agent@1.12.1/dist/iife/page-agent.demo.js"
+    src="https://registry.npmmirror.com/page-agent/1.12.1/files/dist/iife/page-agent.demo.js"
     crossorigin="anonymous"
 ></script>
 ```
 
 > **⚠️ 仅用于技术评估。** 该 Demo CDN 使用了免费的[测试 LLM API](https://alibaba.github.io/page-agent/docs/features/models#free-testing-api)，使用即表示您同意其[条款](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md)。
-> 在 URL 后添加 `?autoInit=false` 可只加载脚本，不自动创建 Demo Agent；之后可通过 `new window.PageAgent(...)` 手动初始化。
-
-| Mirrors | URL                                                                                 |
-| ------- | ----------------------------------------------------------------------------------- |
-| Global  | https://cdn.jsdelivr.net/npm/page-agent@1.12.1/dist/iife/page-agent.demo.js         |
-| China   | https://registry.npmmirror.com/page-agent/1.12.1/files/dist/iife/page-agent.demo.js |
+>
+> 在 URL 后添加 `?autoInit=false` 可只加载脚本，不自动创建 Demo Agent，之后可通过 `new window.PageAgent(...)` 手动初始化，并使用自定义 LLM。
 
 ### NPM 安装
 
```

**File**: `packages/website/src/pages/docs/introduction/quick-start/page.tsx` (modified, +25/-24)
```diff
@@ -1,10 +1,17 @@
+import { useState } from 'react'
+
 import CodeEditor from '@/components/CodeEditor'
 import { Heading } from '@/components/Heading'
 import { CDN_DEMO_CN_URL, CDN_DEMO_URL } from '@/constants'
 import { useLanguage } from '@/i18n/context'
 
 export default function QuickStart() {
 	const { isZh } = useLanguage()
+	const [cdnSource, setCdnSource] = useState<'international' | 'china'>(
+		isZh ? 'china' : 'international'
+	)
+	const cdnBase = cdnSource === 'china' ? CDN_DEMO_CN_URL : CDN_DEMO_URL
+	const cdnUrl = `${cdnBase}?lang=${isZh ? 'zh-CN' : 'en-US'}`
 
 	return (
 		<div>
@@ -54,35 +61,29 @@ export default function QuickStart() {
 							)}
 						</span>
 					</div>
+					<div className="flex items-center gap-2 text-sm">
+						<label htmlFor="cdn-source" className="text-gray-700 dark:text-gray-300">
+							{isZh ? '镜像：' : 'Mirror:'}
+						</label>
+						<select
+							id="cdn-source"
+							value={cdnSource}
+							onChange={(e) => setCdnSource(e.target.value as 'international' | 'china')}
+							className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200"
+						>
+							<option value="international">jsdelivr CDN {isZh ? '（全球）' : '(Global)'}</option>
+							<option value="china">npmmirror CDN {isZh ? '（中国）' : '(China)'}</option>
+						</select>
+					</div>
 					<CodeEditor
-						code={`<script src="DEMO_CDN_URL" crossorigin="true"></script>`}
+						code={`<script src="${cdnUrl}" crossorigin="anonymous"></script>`}
 						language="html"
 					/>
-					<p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
+					<p className="text-sm text-gray-600 dark:text-gray-300">
 						{isZh
-							? '在 URL 后添加 ?autoInit=false 可只加载脚本，不自动创建 Demo Agent；之后可通过 new window.PageAgent(...) 手动初始化。'
-							: 'Add ?autoInit=false to load the script without creating the demo agent automatically. You can then instantiate it with new window.PageAgent(...).'}
+							? '添加 autoInit=false 参数可只加载脚本，不自动创建 Demo Agent，之后可通过 new window.PageAgent(...) 手动初始化，并使用自定义 LLM。'
+							: 'Add the autoInit=false parameter to load the script without creating the demo agent automatically. You can then instantiate it with new window.PageAgent(...) and your own LLMs.'}
 					</p>
-					<table className="w-full border-collapse text-sm">
-						<thead>
-							<tr className="border-b border-gray-200 dark:border-gray-700">
-								<th className="text-left py-2 px-3 font-semibold w-28">
-									{isZh ? '镜像' : 'Mirrors'}
-								</th>
-								<th className="text-left py-2 px-3 font-semibold">URL</th>
-							</tr>
-						</thead>
-						<tbody>
-							<tr className="border-b border-gray-100 dark:border-gray-800">
-								<td className="py-2 px-3">{isZh ? '全球' : 'Global'}</td>
-								<td className="py-2 px-3 font-mono text-xs break-all">{CDN_DEMO_URL}</td>
-							</tr>
-							<tr>
-								<td className="py-2 px-3">{isZh ? '中国' : 'China'}</td>
-								<td className="py-2 px-3 font-mono text-xs break-all">{CDN_DEMO_CN_URL}</td>
-							</tr>
-						</tbody>
-					</table>
 				</div>
 
 				{/* NPM - Recommended */}
```

---

### Incident Patch 8: `4c76a5f1` (2026-07-10)
**Commit Message**: fix(ci): pin release workflow to npm 11 (#609)

npm@latest now resolves to npm 12, whose install-time security defaults break the release pipeline.

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -23,9 +23,9 @@ jobs:
           node-version: 24
           registry-url: 'https://registry.npmjs.org'
 
-      # Ensure npm 11.5.1 or later is installed
+      # Stay on the latest npm 11 release
       - name: Update npm
-        run: npm install -g npm@latest
+        run: npm install -g npm@11
 
       - name: Install dependencies
         run: npm ci
```

---

### Incident Patch 9: `35ff6d44` (2026-07-07)
**Commit Message**: fix(extension): stateless SW, pull tab state instead of ports (#596)

* feat(extension)!: make sw stateless; tabs update with pulling instead of pushing

* fix(extension): harden tab loading wait

* fix: safer `waitUntil`

* chore: comments

* chore: reduce polling logs

**File**: `packages/extension/src/agent/MultiPageAgent.ts` (modified, +3/-1)
```diff
@@ -64,9 +64,11 @@ export class MultiPageAgent extends PageAgentCore {
 			},
 
 			onBeforeStep: async (agent) => {
+				// pull latest tab state so that tabs changes can be observed
+				await tabsController.syncTabs()
 				if (!tabsController.currentTabId) return
 				// make sure the current tab is loaded before the step starts
-				await tabsController.waitUntilTabLoaded(tabsController.currentTabId!)
+				await tabsController.waitUntilTabLoaded(tabsController.currentTabId)
 			},
 
 			onDispose: () => {
```

**File**: `packages/extension/src/agent/TabsController.background.ts` (modified, +4/-39)
```diff
@@ -1,5 +1,9 @@
 /**
  * background logics for TabsController
+ *
+ * Keep this stateless: pure request/response handlers only, no in-memory
+ * state, no ports, no event pushing. MV3 SW should be killed and restarted at
+ * any time (idle timeout, extension update) without special handling.
  */
 import type { TabAction } from './TabsController'
 
@@ -144,7 +148,6 @@ export function handleTabControlMessage(
 		}
 
 		case 'get_window_tabs': {
-			debug('get_window_tabs', payload)
 			chrome.tabs
 				.query({ windowId: payload.windowId })
 				.then((tabs) => {
@@ -161,41 +164,3 @@ export function handleTabControlMessage(
 			return
 	}
 }
-
-const tabEventPorts = new Set<chrome.runtime.Port>()
-
-function broadcastTabEvent(message: object) {
-	for (const port of tabEventPorts) {
-		port.postMessage(message)
-	}
-}
-
-/**
- * Port-based tab events: agents connect via `chrome.runtime.connect({ name: 'tab-events' })`
- * and receive tab change events through the port. Works for both extension pages and content scripts.
- */
-export function setupTabEventsPort() {
-	chrome.runtime.onConnect.addListener((port) => {
-		if (port.name !== 'tab-events') return
-
-		debug('port connected', port.sender?.tab?.id ?? port.sender?.url)
-		tabEventPorts.add(port)
-
-		port.onDisconnect.addListener(() => {
-			debug('port disconnected')
-			tabEventPorts.delete(port)
-		})
-	})
-
-	chrome.tabs.onCreated.addListener((tab) => {
-		broadcastTabEvent({ action: 'created', payload: { tab } })
-	})
-
-	chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
-		broadcastTabEvent({ action: 'removed', payload: { tabId, removeInfo } })
-	})
-
-	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
-		broadcastTabEvent({ action: 'updated', payload: { tabId, changeInfo, tab } })
-	})
-}
```

**File**: `packages/extension/src/agent/TabsController.ts` (modified, +93/-79)
```diff
@@ -33,15 +33,16 @@ async function getOwnWindowId(): Promise<number | undefined> {
  * Controller for managing browser tabs.
  * - live in the agent env (extension page or content script)
  * - no chrome apis. call sw for tab operations
+ * - store tabs states, pull tabs info and detect changes
  */
 export class TabsController {
 	currentTabId: number | null = null
 
 	private disposed = false
-	private port?: chrome.runtime.Port
-	private portRetries = 0
 
+	/* tracked window */
 	private windowId: number | null = null
+	/* tracked tabs */
 	private tabs: TabMeta[] = []
 	private initialTabId: number | null = null
 	private tabGroupId: number | null = null
@@ -57,9 +58,6 @@ export class TabsController {
 		}
 
 		await this.updateCurrentTabId(null)
-		this.disposed = false
-		this.port = undefined
-		this.portRetries = 0
 
 		this.windowId = null
 		this.tabs = []
@@ -85,8 +83,6 @@ export class TabsController {
 			}
 		}
 
-		this.connectTabEvents()
-
 		if (experimentalIncludeAllTabs) {
 			const allTabs = await sendMessage({
 				type: 'TAB_CONTROL',
@@ -297,82 +293,96 @@ export class TabsController {
 	async waitUntilTabLoaded(tabId: number): Promise<void> {
 		const tab = this.tabs.find((t) => t.id === tabId)
 		if (!tab) throw new Error(`Tab ID ${tabId} not found in tab list.`)
-
-		if (tab.status === 'unloaded') throw new Error(`Tab ID ${tabId} is unloaded.`)
 		if (tab.status === 'complete') return
 
+		// When a tracked tab is closed or untracked.
+		// The tab object will be removed from the tab list.
+		// Finding the latest tab object is the only way to know if it's closed.
+
 		debug('waitUntilTabLoaded', tabId)
-		await waitUntil(() => tab.status === 'complete', 4_000)
+		await waitUntil(async () => {
+			await this.syncTabs()
+			const latest = this.tabs.find((t) => t.id === tabId)
+			return !latest || latest.status !== 'loading'
+		}, 4_000)
+
+		const latest = this.tabs.find((t) => t.id === tabId)
+		if (latest?.status === 'unloaded') throw new Error(`Tab ID ${tabId} is unloaded.`)
 	}
 
 	/**
-	 * Connect to background SW via port to receive tab change events.
-	 *
-	 * @note Port is 1:1 (runtime.connect → background SW has no frames),
-	 * so onDisconnect fires exactly once and we can safely reconnect.
-	 * Reconnection may miss events during the gap.
-	 * TODO: refresh this.tabs from background after reconnect to stay consistent.
+	 * Pull the window's tabs from the background.
+	 * Pulling is better than pushing. Long-lived ports are stateful troublemakers.
 	 */
-	private connectTabEvents() {
-		this.port = chrome.runtime.connect({ name: 'tab-events' })
-
-		this.port.onMessage.addListener((message: any) => {
-			if (this.disposed) return
-			this.portRetries = 0
-
-			if (message.action === 'created') {
-				const tab = message.payload.tab as chrome.tabs.Tab
-				const shouldTrack =
-					tab.groupId === this.tabGroupId ||
-					// @note Never track tabs from other windows.
-					(this.experimentalIncludeAllTabs && tab.windowId === this.windowId)
-				if (shouldTrack && tab.id != null) {
-					this.addTab({ id: tab.id, isInitial: false })
-					this.switchToTab(tab.id)
-				}
-			} else if (message.action === 'removed') {
-				const { tabId } = message.payload as { tabId: number }
-				const targetTab = this.tabs.find((t) => t.id === tabId)
-				if (targetTab) {
-					this.tabs = this.tabs.filter((t) => t.id !== tabId)
-					if (this.currentTabId === tabId) {
-						const newCurrentTab = this.tabs[this.tabs.length - 1] || null
-						if (newCurrentTab) {
-							this.switchToTab(newCurrentTab.id)
-						} else {
-							this.updateCurrentTabId(null)
-						}
-					}
-				}
-			} else if (message.action === 'updated') {
-				const { tabId, tab } = message.payload as { tabId: number; tab: chrome.tabs.Tab }
-				const targetTab = this.tabs.find((t) => t.id === tabId)
-				if (targetTab) {
-					targetTab.url = tab.url
-					targetTab.title = tab.title
-					targetTab.status = tab.status
+	async syncTabs(): Promise<void> {
+		if (this.disposed || this.windowId == null) return
+
+		const result = await sendMessage({
+			type: 'TAB_CONTROL',
+			action: 'get_window_tabs',
+			payload: { windowId: this.windowId },
+		})
+		// sendMessage already logged the failure; keep the stale mirror
+		if (!result?.success) return
+
+		const liveTabs = (result.tabs as chrome.tabs.Tab[]).filter((t) => t.id != null)
+		const liveIds = new Set(liveTabs.map((t) => t.id!))
+
+		const closedIds = this.tabs.filter((t) => !liveIds.has(t.id)).map((t) => t.id)
+		if (closedIds.length) {
+			debug('syncTabs: tabs closed', closedIds)
+			this.tabs = this.tabs.filter((t) => liveIds.has(t.id))
+		}
+
+		const newTabs: TabMeta[] = []
+		for (const live of liveTabs) {
+			const tracked = this.tabs.find((t) => t.id === live.id)
+			if (tracked) {
+				tracked.url = live.url
+				tracked.title = live.title
+				tracked.status = live.status as TabMeta['status']
+			} else if (this.shouldTrack(live)) {
+				debug('syncTa
```

**File**: `packages/extension/src/entrypoints/background.ts` (modified, +1/-5)
```diff
@@ -1,13 +1,9 @@
 import { handlePageControlMessage } from '@/agent/RemotePageController.background'
-import { handleTabControlMessage, setupTabEventsPort } from '@/agent/TabsController.background'
+import { handleTabControlMessage } from '@/agent/TabsController.background'
 
 export default defineBackground(() => {
 	console.log('[Background] Service Worker started')
 
-	// tab change events
-
-	setupTabEventsPort()
-
 	// generate user auth token
 
 	chrome.storage.local.get('PageAgentExtUserAuthToken').then((result) => {
```

---

### Incident Patch 10: `08624ec2` (2026-07-06)
**Commit Message**: fix(ci): format README and align markdown tooling with Prettier (#593)

**File**: `.vscode/settings.json` (modified, +0/-15)
```diff
@@ -2,21 +2,6 @@
     "files.exclude": {
         "packages/*/node_modules": true
     },
-    "markdownlint.config": {
-        // Relaxed rules
-        "default": true,
-        "whitespace": false,
-        "line_length": false,
-        "ul-indent": false,
-        "no-inline-html": false,
-        "no-bare-urls": false,
-        "fenced-code-language": false,
-        "first-line-h1": false,
-        "block-spacing": false,
-        "blanks-around-lists": false,
-        "ol-prefix": false,
-        "no-duplicate-heading": false
-    },
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "js/ts.tsdk.path": "node_modules/typescript/lib",
     "typescript.tsdk": "node_modules/typescript/lib",
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -55,7 +55,10 @@ The GUI Agent Living in Your Webpage. One script gives any web page its own AI a
 Fastest way to try PageAgent with our free Demo LLM:
 
 ```html
-<script src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js" crossorigin="anonymous"></script>
+<script
+    src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js"
+    crossorigin="anonymous"
+></script>
 ```
 
 > **⚠️ For technical evaluation only.** This demo CDN uses our free [testing LLM API](https://alibaba.github.io/page-agent/docs/features/models#free-testing-api). By using it, you agree to its [terms](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md).
```

**File**: `docs/README-zh.md` (modified, +4/-1)
```diff
@@ -54,7 +54,10 @@
 通过我们免费的 Demo LLM 快速体验 PageAgent：
 
 ```html
-<script src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js" crossorigin="anonymous"></script>
+<script
+    src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js"
+    crossorigin="anonymous"
+></script>
 ```
 
 > **⚠️ 仅用于技术评估。** 该 Demo CDN 使用了免费的[测试 LLM API](https://alibaba.github.io/page-agent/docs/features/models#free-testing-api)，使用即表示您同意其[条款](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md)。
```

**File**: `package.json` (modified, +3/-0)
```diff
@@ -82,6 +82,9 @@
         ],
         "*.css": [
             "npx prettier --write --ignore-unknown"
+        ],
+        "*.md": [
+            "npx prettier --write --ignore-unknown"
         ]
     },
     "commitlint": {
```

---

### Incident Patch 11: `8bc2483a` (2026-07-06)
**Commit Message**: docs: improve README copy and quick start (#592)

* docs: improve README copy and quick start

* docs: put each badge on its own line

**File**: `README.md` (modified, +17/-17)
```diff
@@ -5,17 +5,26 @@
   <img alt="Page Agent Banner" src="https://page-agent.github.io/assets/readme/banner-light.png">
 </picture>
 
-[![License: MIT](https://img.shields.io/badge/License-MIT-auto.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/page-agent)](https://bundlephobia.com/package/page-agent) [![Downloads](https://img.shields.io/npm/dt/page-agent.svg)](https://www.npmjs.com/package/page-agent) [![GitHub stars](https://img.shields.io/github/stars/alibaba/page-agent.svg)](https://github.com/alibaba/page-agent)
+[![CI](https://img.shields.io/github/actions/workflow/status/alibaba/page-agent/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/alibaba/page-agent/actions/workflows/ci.yml)
+[![npm](https://img.shields.io/npm/v/page-agent?style=flat-square&label=npm)](https://www.npmjs.com/package/page-agent)
+[![downloads](https://img.shields.io/npm/dt/page-agent?style=flat-square)](https://www.npmjs.com/package/page-agent)
+[![size](https://img.shields.io/bundlephobia/minzip/page-agent?style=flat-square&label=size)](https://bundlephobia.com/package/page-agent)
+[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
+[![typescript](https://img.shields.io/badge/%3C%2F%3E-typescript-blue?style=flat-square)](http://www.typescriptlang.org/)
+[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/akldabonmimlicnjlflnapfeklbfemhj?style=flat-square&label=chrome%20rating)](https://chromewebstore.google.com/detail/page-agent-ext/akldabonmimlicnjlflnapfeklbfemhj)
+[![GitHub stars](https://img.shields.io/github/stars/alibaba/page-agent.svg)](https://github.com/alibaba/page-agent)
 
-The GUI Agent Living in Your Webpage. Control web interfaces with natural language.
+The GUI Agent Living in Your Webpage. One script gives any web page its own AI agent.
+
+<a href="https://trendshift.io/repositories/22551?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-22551" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/22551" alt="alibaba%2Fpage-agent | Trendshift" width="180"/></a>
 
 🌐 **English** | [中文](./docs/README-zh.md)
 
 <a href="https://alibaba.github.io/page-agent/" target="_blank"><b>🚀 Demo</b></a> | <a href="https://alibaba.github.io/page-agent/docs/introduction/overview" target="_blank"><b>📖 Docs</b></a> | <a href="https://news.ycombinator.com/item?id=47264138" target="_blank"><b>📢 HN Discussion</b></a> | <a href="https://x.com/simonluvramen" target="_blank"><b>𝕏 Follow on X</b></a>
 
 <!-- demo video -->
 
-https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
+[![Watch the demo](https://page-agent.github.io/assets/readme/poster.jpg)](https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2)
 
 ---
 
@@ -27,6 +36,7 @@ https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
 - **📖 Text-based DOM manipulation**
     - No screenshots. No multi-modal LLMs or special permissions needed.
 - **🧠 Bring your own LLMs**
+    - Works with most mainstream models, including locally deployed ones. See [supported models](https://alibaba.github.io/page-agent/docs/features/models).
 - **🐙 Optional [chrome extension](https://alibaba.github.io/page-agent/docs/features/chrome-extension) for multi-page tasks.**
     - And an [MCP Server (Beta)](https://alibaba.github.io/page-agent/docs/features/mcp-server) to control it from outside
 
@@ -35,7 +45,7 @@ https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
 - **SaaS AI Copilot** — Ship an AI copilot in your product in lines of code. No backend rewrite.
 - **Smart Form Filling** — Turn 20-click workflows into one sentence. Perfect for ERP, CRM, and admin systems.
 - **Accessibility** — Make any web app accessible through natural language. Voice commands, screen readers, zero barrier.
-- **Multi-page Agent** — Extend your own web agent's reach across browser tabs [chrome extension](https://alibaba.github.io/page-agent/docs/features/chrome-extension).
+- **Multi-page Agent** — Extend your own web agent's reach across browser tabs via the [Chrome extension](https://alibaba.github.io/page-agent/docs/features/chrome-extension).
 - **MCP** - Allow your agent clients to control your browser.
 
 ## 🚀 Quick Start
@@ -45,7 +55,7 @@ https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
 Fastest way to try PageAgent with our free Demo LLM:
 
 ```html
-<script src="{URL}" crossorigin="true"></script>
+<script src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js" crossorigin="anonymous"></script>
 ```
 
 > **⚠️ For technical evaluation only.** This demo CDN uses our free [testing LLM API](https://alibaba.gi
```

**File**: `docs/README-zh.md` (modified, +15/-5)
```diff
@@ -5,17 +5,26 @@
   <img alt="Page Agent Banner" src="https://page-agent.github.io/assets/readme/banner-light.png">
 </picture>
 
-[![License: MIT](https://img.shields.io/badge/License-MIT-auto.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/page-agent)](https://bundlephobia.com/package/page-agent) [![Downloads](https://img.shields.io/npm/dt/page-agent.svg)](https://www.npmjs.com/package/page-agent) [![GitHub stars](https://img.shields.io/github/stars/alibaba/page-agent.svg)](https://github.com/alibaba/page-agent)
+[![CI](https://img.shields.io/github/actions/workflow/status/alibaba/page-agent/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/alibaba/page-agent/actions/workflows/ci.yml)
+[![npm](https://img.shields.io/npm/v/page-agent?style=flat-square&label=npm)](https://www.npmjs.com/package/page-agent)
+[![downloads](https://img.shields.io/npm/dt/page-agent?style=flat-square)](https://www.npmjs.com/package/page-agent)
+[![size](https://img.shields.io/bundlephobia/minzip/page-agent?style=flat-square&label=size)](https://bundlephobia.com/package/page-agent)
+[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://opensource.org/licenses/MIT)
+[![typescript](https://img.shields.io/badge/%3C%2F%3E-typescript-blue?style=flat-square)](http://www.typescriptlang.org/)
+[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/akldabonmimlicnjlflnapfeklbfemhj?style=flat-square&label=chrome%20rating)](https://chromewebstore.google.com/detail/page-agent-ext/akldabonmimlicnjlflnapfeklbfemhj)
+[![GitHub stars](https://img.shields.io/github/stars/alibaba/page-agent.svg)](https://github.com/alibaba/page-agent)
 
 纯 JS 实现的 GUI agent。使用自然语言操作你的 Web 应用。无须后端、客户端、浏览器插件。
 
+<a href="https://trendshift.io/repositories/22551?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-22551" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/22551" alt="alibaba%2Fpage-agent | Trendshift" width="180"/></a>
+
 🌐 [English](../README.md) | **中文**
 
 <a href="https://alibaba.github.io/page-agent/" target="_blank"><b>🚀 Demo</b></a> | <a href="https://alibaba.github.io/page-agent/docs/introduction/overview" target="_blank"><b>📖 Docs</b></a> | <a href="https://news.ycombinator.com/item?id=47264138" target="_blank"><b>📢 HN Discussion</b></a> | <a href="https://x.com/simonluvramen" target="_blank"><b>𝕏 Follow on X</b></a>
 
 <!-- demo video -->
 
-https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
+[![Watch the demo](https://page-agent.github.io/assets/readme/poster.jpg)](https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2)
 
 ---
 
@@ -26,6 +35,7 @@ https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
 - **📖 基于文本的 DOM 操作**
     - 无需截图，无需多模态模型或特殊权限
 - **🧠 自备 LLM**
+    - 支持多数主流模型，包括本地部署模型。参见[支持的模型](https://alibaba.github.io/page-agent/docs/features/models)。
 - 🐙 可选的 [Chrome 扩展](https://alibaba.github.io/page-agent/docs/features/chrome-extension)，支持跨页面任务
     - [MCP Server (Beta)](https://alibaba.github.io/page-agent/docs/features/mcp-server)
 
@@ -44,7 +54,7 @@ https://github.com/user-attachments/assets/a1f2eae2-13fb-4aae-98cf-a3fc1620a6c2
 通过我们免费的 Demo LLM 快速体验 PageAgent：
 
 ```html
-<script src="{URL}" crossorigin="true"></script>
+<script src="https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js" crossorigin="anonymous"></script>
 ```
 
 > **⚠️ 仅用于技术评估。** 该 Demo CDN 使用了免费的[测试 LLM API](https://alibaba.github.io/page-agent/docs/features/models#free-testing-api)，使用即表示您同意其[条款](https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md)。
@@ -85,6 +95,8 @@ await agent.execute('点击登录按钮')
 
 我们不接受未经实质性人类参与、完全由 Bot 或 Agent 自动生成的代码。
 
+用 PageAgent 做了有趣的东西？欢迎到 [Show and Tell](https://github.com/alibaba/page-agent/discussions/categories/show-and-tell) 分享。🙌
+
 ## 👏 声明与致谢
 
 本项目基于 **[`browser-use`](https://github.com/browser-use/browser-use)** 的优秀工作构建。
@@ -107,6 +119,4 @@ this project possible.
 
 [MIT License](../LICENSE)
 
----
-
 **⭐ 如果觉得 PageAgent 有用或有趣，请给项目点个星！**
```

---

### Incident Patch 12: `f8af5603` (2026-07-03)
**Commit Message**: chore(ui): remove legacy motion-css code (#583)

Unused CSS motion experiment with known performance issues; no references remain.

**File**: `packages/ui/src/motion-css/createMotion.ts` (removed, +0/-64)
```diff
@@ -1,64 +0,0 @@
-import styles from './motion.module.css'
-
-export function createMotion() {
-	const wrapper = document.createElement('div')
-	wrapper.className = styles.wrapper
-
-	{
-		const colorWrapper = document.createElement('div')
-		colorWrapper.className = styles.colorWrapper
-		wrapper.appendChild(colorWrapper)
-
-		const layerA = document.createElement('div')
-		layerA.className = styles.colorLayer + ' ' + styles.layerA
-		colorWrapper.appendChild(layerA)
-
-		const layerB = document.createElement('div')
-		layerB.className = styles.colorLayer + ' ' + styles.layerB
-		colorWrapper.appendChild(layerB)
-
-		const layerC = document.createElement('div')
-		layerC.className = styles.colorLayer + ' ' + styles.layerC
-		colorWrapper.appendChild(layerC)
-	}
-
-	{
-		const borderWrapper = document.createElement('div')
-		borderWrapper.className = styles.borderWrapper
-		wrapper.appendChild(borderWrapper)
-
-		const layerA = document.createElement('div')
-		layerA.className = styles.borderLayer + ' ' + styles.layerA
-		borderWrapper.appendChild(layerA)
-
-		const layerB = document.createElement('div')
-		layerB.className = styles.borderLayer + ' ' + styles.layerB
-		borderWrapper.appendChild(layerB)
-
-		const layerC = document.createElement('div')
-		layerC.className = styles.borderLayer + ' ' + styles.layerC
-		borderWrapper.appendChild(layerC)
-	}
-
-	function show() {
-		wrapper.classList.remove(styles.exit)
-		wrapper.classList.remove(styles.entry)
-		// Force reflow to restart animation
-		void wrapper.offsetHeight
-		wrapper.classList.add(styles.entry)
-	}
-
-	function hide() {
-		wrapper.classList.remove(styles.entry)
-		wrapper.classList.remove(styles.exit)
-		// Force reflow to restart animation
-		void wrapper.offsetHeight
-		wrapper.classList.add(styles.exit)
-	}
-
-	return {
-		element: wrapper,
-		show,
-		hide,
-	}
-}
```

**File**: `packages/ui/src/motion-css/motion.module.css` (removed, +0/-395)
```diff
@@ -1,395 +0,0 @@
-.wrapper {
-	position: absolute;
-	inset: 0;
-	pointer-events: none;
-
-	transform-origin: center;
-
-	--color-1: rgb(57, 182, 255);
-	--color-2: rgb(189, 69, 251);
-	--color-3: rgb(255, 87, 51);
-	--color-4: rgb(255, 214, 0);
-
-	--blend-mode: screen;
-}
-
-.colorLayer {
-	position: absolute;
-	inset: 0;
-
-	/* 变亮混合模式 */
-	/* mix-blend-mode: screen; */
-	/* mix-blend-mode: overlay; */
-	/* mix-blend-mode: multiply; */
-	mix-blend-mode: add;
-
-	/* 边框遮罩 - 中间透明，边缘不透明 */
-	mask-image: url(https://page-agent.github.io/assets/ui/motion-mask.png);
-	mask-repeat: no-repeat;
-	mask-size: calc(100% + 10px) calc(100% + 10px);
-}
-
-.borderWrapper {
-	position: absolute;
-	inset: 0;
-
-	/* filter: blur(10px); */
-}
-
-.borderLayer {
-	position: absolute;
-	inset: 0;
-
-	/* 变亮混合模式 */
-	/* mix-blend-mode: overlay; */
-	mix-blend-mode: add;
-
-	mask-image:
-		linear-gradient(
-			to right,
-			black 0px,
-			black 2px,
-			transparent 2px,
-			transparent calc(100% - 2px),
-			black calc(100% - 2px),
-			black 100%
-		),
-		linear-gradient(
-			to top,
-			black 0px,
-			black 2px,
-			transparent 2px,
-			transparent calc(100% - 2px),
-			black calc(100% - 2px),
-			black 100%
-		);
-
-	mask-composite: add;
-	mask-repeat: no-repeat;
-	mask-size: 100% 100%;
-
-	/* filter: blur(100px); */
-}
-
-.blueLayer {
-	&.colorLayer {
-		mask-position: left -5px top -5px;
-	}
-
-	&::after {
-		content: '';
-		position: absolute;
-		/* inset: 0; */
-		width: calc(max(100vw, 100vh) * 1.5);
-		height: 600px;
-		top: calc(50% - 300px);
-		left: 50%;
-		filter: blur(100px);
-		background: rgb(57, 182, 255);
-		animation: rotate-clockwise 4s linear infinite;
-		animation-delay: -3s;
-	}
-}
-
-.purpleLayer {
-	&.colorLayer {
-		mask-position: left -3px top -7px;
-	}
-
-	&::after {
-		content: '';
-		position: absolute;
-		/* inset: 0; */
-		width: calc(max(100vw, 100vh) * 1.5);
-		height: 600px;
-		top: calc(50% - 300px);
-		left: 50%;
-		filter: blur(100px);
-		background: rgb(189, 69, 251);
-		animation: rotate-clockwise 4s linear infinite;
-		animation-delay: -2s;
-	}
-}
-
-.orangeLayer {
-	/* opacity: 0.5; */
-
-	&.colorLayer {
-		mask-position: left -7px top -2px;
-	}
-
-	&::after {
-		content: '';
-		position: absolute;
-		/* inset: 0; */
-		width: calc(max(100vw, 100vh) * 1.5);
-		height: 600px;
-		top: calc(50% - 300px);
-		left: 50%;
-		filter: blur(100px);
-		background: rgb(255, 87, 51);
-		animation: rotate-counter-clockwise 3s linear infinite;
-		animation-delay: -2s;
-	}
-}
-
-.yellowLayer {
-	/* opacity: 0.5; */
-
-	&.colorLayer {
-		mask-position: left -6px top -4px;
-	}
-
-	&::after {
-		content: '';
-		position: absolute;
-		/* inset: 0; */
-		width: calc(max(100vw, 100vh) * 1.5);
-		height: 600px;
-		top: calc(50% - 300px);
-		left: 50%;
-		filter: blur(100px);
-		background: rgb(255, 214, 0);
-		animation: rotate-counter-clockwise 4s linear infinite;
-		animation-delay: -1s;
-	}
-}
-
-/* 旋转动画 */
-@keyframes rotate-clockwise {
-	0% {
-		transform: translateX(-50%) rotate(0deg);
-	}
-	100% {
-		transform: translateX(-50%) rotate(360deg);
-	}
-}
-
-@keyframes rotate-counter-clockwise {
-	0% {
-		transform: translateX(-50%) rotate(0deg);
-	}
-	100% {
-		transform: translateX(-50%) rotate(-360deg);
-	}
-}
-
-@keyframes wrapper-entry {
-	from {
-		transform: scale(1.1);
-	}
-	to {
-		transform: scale(1);
-	}
-}
-
-/* 
-rgb(57, 182, 255)
-rgb(189, 69, 251)
-rgb(255, 87, 51)
-rgb(255, 214, 0)
-*/
-
-@keyframes mask-running {
-	from {
-		transform: translateX(0%);
-	}
-	to {
-		transform: translateX(100%);
-	}
-}
-
-@keyframes mask-running-reverse {
-	from {
-		transform: translateX(100%);
-	}
-	to {
-		transform: translateX(0%);
-	}
-}
-
-.colorWrapper {
-	position: absolute;
-	inset: 0;
-
-	.colorLayer {
-		position: absolute;
-		inset: 0;
-
-		mix-blend-mode: var(--blend-mode);
-
-		/* 边框遮罩 - 中间透明，边缘不透明 */
-		mask-image: url(https://page-agent.github.io/assets/ui/motion-mask.png);
-		mask-repeat: no-repeat;
-		mask-size: 100% 100%;
-	}
-}
-
-.borderWrapper {
-	position: absolute;
-	inset: 0;
-
-	--blend-mode: lighten;
-
-	.borderLayer {
-		position: absolute;
-		inset: 0;
-
-		mix-blend-mode: var(--blend-mode);
-
-		mask-border: url(https://page-agent.github.io/assets/ui/motion-border.png) 25;
-		-webkit-mask-box-image: url(https://page-agent.github.io/assets/ui/motion-border.png) 25;
-
-		mask-repeat: no-repeat;
-		mask-size: 100% 100%;
-
-		background-color: var(--color-2);
-	}
-}
-
-.entry .colorWrapper,
-.entry .borderWrapper {
-	animation: wrapper-entry 0.8s ease-in-out forwards;
-}
-
-.exit .colorWrapper,
-.exit .borderWrapper {
-	animation: wrapper-entry 0.8s ease-in-out reverse forwards;
-}
-
-.layerA {
-	position: absolute;
-	inset: 0;
-
-	&::before {
-		mix-blend-mode: var(--blend-mode);
-		content: '';
-		display: block;
-		position: absolute;
-		width: 100%;
-		height: 100%;
-		left: -100%;
-		top: 0;
-		background-image: linear-gradient(
-			to right bottom,
-			transparent,
-			var(--color-1)
```

**File**: `packages/ui/src/motion-css/readme` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-This is the CSS implementation of ai-motion.
-
-Easy to use but Terrible performance. Causing full screen glitching in some browsers.
-
-Use it only in a small area.
```

---

### Incident Patch 13: `9a75ead6` (2026-07-03)
**Commit Message**: fix: do not enable OpenRouter reasoning by default

**File**: `packages/llms/src/utils.ts` (modified, +9/-9)
```diff
@@ -160,15 +160,15 @@ export function modelPatch(body: Record<string, any>, baseURL?: string) {
 		// openrouter use reasoning object instead of reasoning_effort
 
 		const reasoningEffort = body.reasoning_effort
-		let reasoningEnabled = true
-		if (body.thinking?.type === 'disabled') reasoningEnabled = false
-		if (body.enable_thinking === false) reasoningEnabled = false
-		if (reasoningEffort === 'none') reasoningEnabled = false
-
-		body.reasoning = { enabled: reasoningEnabled }
-
-		if (reasoningEnabled && reasoningEffort) {
-			body.reasoning.effort = reasoningEffort
+		const reasoningDisabled =
+			body.thinking?.type === 'disabled' ||
+			body.enable_thinking === false ||
+			reasoningEffort === 'none'
+
+		if (reasoningDisabled) {
+			body.reasoning = { enabled: false }
+		} else if (reasoningEffort) {
+			body.reasoning = { enabled: true, effort: reasoningEffort }
 		}
 	}
 
```

---

### Incident Patch 14: `10276c6e` (2026-07-03)
**Commit Message**: fix: `new URL` should always be in a try block

**File**: `packages/llms/src/utils.ts` (modified, +8/-4)
```diff
@@ -209,8 +209,12 @@ export function normalizeModelName(modelName: string): string {
 
 export function getProvider(baseURL?: string): 'openrouter' | undefined {
 	if (!baseURL) return undefined
-	const url = new URL(baseURL)
-	const hostname = url.hostname
-	if (hostname === 'openrouter.ai') return 'openrouter'
-	return undefined
+	try {
+		const url = new URL(baseURL)
+		const hostname = url.hostname
+		if (hostname === 'openrouter.ai') return 'openrouter'
+		return undefined
+	} catch (e) {
+		return undefined
+	}
 }
```

---

### Incident Patch 15: `04b84b6e` (2026-07-02)
**Commit Message**: fix(llms): model compatibility problem

**File**: `packages/llms/src/OpenAIClient.ts` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ export class OpenAIClient implements LLMClient {
 			requestBody.temperature = this.config.temperature
 		}
 
-		modelPatch(requestBody)
+		modelPatch(requestBody, this.config.baseURL)
+
 		let transformedBody: Record<string, unknown> | undefined
 		try {
 			transformedBody = this.config.transformRequestBody(requestBody)
```

**File**: `packages/llms/src/utils.ts` (modified, +65/-24)
```diff
@@ -36,10 +36,12 @@ export function zodToOpenAITool(name: string, tool: Tool) {
  * @todo Need vendor-specific patches.
  * Local and 3rd-party hosted models may have different schema.
  */
-export function modelPatch(body: Record<string, any>) {
+export function modelPatch(body: Record<string, any>, baseURL?: string) {
 	const model: string = body.model || ''
 	if (!model) return body
 
+	const provider = getProvider(baseURL)
+
 	const modelName = normalizeModelName(model)
 
 	if (modelName.startsWith('qwen')) {
@@ -58,12 +60,14 @@ export function modelPatch(body: Record<string, any>) {
 	}
 
 	if (modelName.startsWith('gpt')) {
-		body.verbosity = 'low'
+		if (modelName.startsWith('gpt-5')) {
+			body.verbosity = 'low'
 
-		// gpt-5 gpt-5-mini gpt-5-nano only supports "minimal";
-		// 5.1+ supports "none".
-		body.reasoning_effort = /^gpt-5(-|$)/.test(modelName) ? 'minimal' : 'none'
-		debug(`Patch GPT-5: verbosity=low, reasoning_effort=${body.reasoning_effort}`)
+			// gpt-5 gpt-5-mini gpt-5-nano only supports "minimal";
+			// 5.1+ supports "none".
+			body.reasoning_effort = /^gpt-5(-|$)/.test(modelName) ? 'minimal' : 'none'
+			debug(`Patch GPT-5: verbosity=low, reasoning_effort=${body.reasoning_effort}`)
+		}
 
 		if (modelName.includes('chat-latest')) {
 			debug('Omitting reasoning_effort and temperature for chat-latest')
@@ -76,20 +80,27 @@ export function modelPatch(body: Record<string, any>) {
 		if (/opus|sonnet|haiku/.test(modelName)) {
 			debug('Patch Claude: disable thinking')
 			body.thinking = { type: 'disabled' }
+
+			if (provider !== 'openrouter') {
+				// Convert tool_choice to Claude format
+				if (body.tool_choice === 'required') {
+					// 'required' -> { type: 'any' } (must call some tool)
+					debug('Applying Claude patch: convert tool_choice "required" to { type: "any" }')
+					body.tool_choice = { type: 'any' }
+				} else if (body.tool_choice?.function?.name) {
+					// { type: 'function', function: { name: '...' } } -> { type: 'tool', name: '...' }
+					debug('Applying Claude patch: convert tool_choice format')
+					body.tool_choice = { type: 'tool', name: body.tool_choice.function.name }
+				}
+			}
 		} else {
 			debug('Patch Claude: reasoning_effort=low')
 			body.reasoning_effort = 'low'
-		}
 
-		// Convert tool_choice to Claude format
-		if (body.tool_choice === 'required') {
-			// 'required' -> { type: 'any' } (must call some tool)
-			debug('Applying Claude patch: convert tool_choice "required" to { type: "any" }')
-			body.tool_choice = { type: 'any' }
-		} else if (body.tool_choice?.function?.name) {
-			// { type: 'function', function: { name: '...' } } -> { type: 'tool', name: '...' }
-			debug('Applying Claude patch: convert tool_choice format')
-			body.tool_choice = { type: 'tool', name: body.tool_choice.function.name }
+			// Fable and mythos can not disable adaptive thinking.
+			// Claude does not support tool_choice with extended thinking.
+			// These 2 concepts are blurred. Basically no tool_choice with thinking.
+			delete body.tool_choice
 		}
 	}
 
@@ -124,18 +135,40 @@ export function modelPatch(body: Record<string, any>) {
 		}
 	}
 
-	if (modelName.startsWith('kimi') && !modelName.includes('code')) {
-		// kimi-k2.7-code cannot disable thinking (errors), hence the code exclusion.
-		debug('Patch Kimi: disable thinking')
-		body.thinking = { type: 'disabled' }
+	if (modelName.startsWith('kimi')) {
+		if (!modelName.includes('code')) {
+			// kimi-k2.7-code cannot disable thinking
+			debug('Patch Kimi: disable thinking')
+			body.thinking = { type: 'disabled' }
+		}
 	}
 
 	if (modelName.startsWith('minimax')) {
-		// Only M3 can disable thinking; M2.x accepts the field as a silent no-op.
-		// parallel_tool_calls is unsupported.
-		debug('Patch MiniMax: disable thinking, remove parallel_tool_calls')
-		body.thinking = { type: 'disabled' }
+		debug('Patch MiniMax: remove parallel_tool_calls')
 		delete body.parallel_tool_calls
+
+		if (modelName.includes('m3')) {
+			// Only M3 can disable thinking
+			debug('Patch MiniMax: disable thinking')
+			body.thinking = { type: 'disabled' }
+		}
+	}
+
+	// provider patches
+
+	if (provider === 'openrouter') {
+		// openrouter use reasoning object instead of reasoning_effort
+
+		const reasoningEffort = body.reasoning_effort
+		let reasoningEnabled = true
+		if (body.thinking?.type === 'disabled') reasoningEnabled = false
+		if (body.enable_thinking === false) reasoningEnabled = false
+
+		body.reasoning = { enabled: reasoningEnabled }
+
+		if (reasoningEnabled && reasoningEffort) {
+			body.reasoning.effort = reasoningEffort
+		}
 	}
 
 	return body
@@ -172,3 +205,11 @@ export function normalizeModelName(modelName: string): string {
 
 	return normalizedName
 }
+
+export function getProvider(baseURL?: string): 'openrouter' | undefined {
+	if (!baseURL) return undefined
+	const url = new URL(baseURL)
+	const hostname = url.hostname
+	if (hostname === 'openrouter.ai') return 'openrouter'
+	return und
```

#### Recent Merged Pull Requests:
- **PR #738** (closed): chore(deps-dev): bump the development-dependencies group across 1 directory with 22 updates (@dependabot[bot])
- **PR #737** (closed): chore(deps): bump the production-dependencies group across 1 directory with 2 updates (@dependabot[bot])
- **PR #735** (closed): feat(page-controller): add keyboard press action (@dvd233)
- **PR #733** (closed): chore(deps-dev): bump the development-dependencies group across 1 directory with 19 updates (@dependabot[bot])
- **PR #726** (closed): fix(page-controller): preserve label checkbox state (@Oliver-Ysq)
- **PR #723** (closed): chore(deps-dev): bump the development-dependencies group across 1 directory with 17 updates (@dependabot[bot])
- **PR #721** (closed): fix(deps): resolve critical/high npm audit advisories (@PilonQV)
- **PR #717** (closed): chore(deps-dev): bump the development-major group with 2 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
