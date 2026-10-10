/**
 * AI-BUILDER-BRAIN Universal MCP Server (Stdio JSON-RPC Interface)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\brain-mcp-server.mjs
 * Purpose: Exposes AI-Builder-Brain intelligence layer as a Model Context Protocol (MCP)
 *          server over stdio. Enables any MCP-compatible AI agent (Antigravity IDE, Cursor,
 *          Claude Desktop, Windsurf, custom agents) to search Brain intelligence,
 *          create Task Contracts, inspect DAG plans, and verify empirical evidence.
 * 
 * Protocol: JSON-RPC 2.0 / MCP Stdio Transport
 * Zero external dependencies. Native Node.js ES Module.
 */

import readline from 'readline';
import { retrieveKnowledge } from './retrieval-engine.mjs';
import { createTaskContract, validateTaskContract, TASK_STATUS } from './task-contract.mjs';
import { resolveTaskContext, verifyExecutionResult, loadTaskCheckpoint } from './brain-connector.mjs';
import { planTaskDecomposition, getNextExecutableSteps } from './task-planner.mjs';
import { bindSkillToTask, listRegisteredSkills } from './skill-runner.mjs';
import { recordSessionMemory, querySessionMemories } from './cross-session-memory.mjs';

const SERVER_NAME = 'ai-builder-brain';
const SERVER_VERSION = '2.0.0';
const PROTOCOL_VERSION = '2024-11-05';

export const BRAIN_TOOLS = [
  {
    name: 'brain_search',
    description: 'Search AI-Builder-Brain canonical knowledge (BM25 hybrid retrieval) with strict token budgeting.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Engineering keywords or rule topic (e.g. "CRLF regex", "Rule 12")' },
        maxTokens: { type: 'number', description: 'Maximum tokens to pack into prompt block (default: 800)' },
        topK: { type: 'number', description: 'Maximum items to retrieve (default: 3)' }
      },
      required: ['query']
    }
  },
  {
    name: 'brain_create_task',
    description: 'Initialize a formal, bounded Task Contract with anti-regression shield and negative constraints.',
    inputSchema: {
      type: 'object',
      properties: {
        task_type: { 
          type: 'string', 
          enum: ['MICRO_FIX', 'FEATURE', 'SYSTEM_BUILD', 'HARVEST', 'AUDIT'],
          description: 'Complexity envelope of the task' 
        },
        objective: { type: 'string', description: 'Concrete engineering objective (min 10 characters)' },
        max_tokens_budget: { type: 'number', description: 'Maximum token budget' }
      },
      required: ['task_type', 'objective']
    }
  },
  {
    name: 'brain_get_plan',
    description: 'Decompose a task into a Directed Acyclic Graph (DAG) with step dependencies and verification probes.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID to look up or plan' },
        task_type: { type: 'string', description: 'Task type if creating a fresh plan' },
        objective: { type: 'string', description: 'Objective if creating a fresh plan' },
        skill_id: { type: 'string', description: 'Optional skill to bind (e.g. "tailwind-v4-css-first-design")' }
      }
    }
  },
  {
    name: 'brain_verify_task',
    description: 'Submit empirical execution evidence to the Verification Barrier to validate task completion.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID under verification' },
        buildExitCode: { type: 'number', description: 'Terminal exit code of build / test execution (must be 0)' },
        terminalOutput: { type: 'string', description: 'Terminal stdout / stderr proof' },
        evidenceTypes: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of verified evidence types (e.g. ["BUILD_EXIT_0", "TEST_PASS"])' 
        }
      },
      required: ['buildExitCode', 'terminalOutput']
    }
  },
  {
    name: 'brain_record_memory',
    description: 'Record an episodic failure, user critique, or invariant lesson into Cross-Session Memory to prevent repeat mistakes.',
    inputSchema: {
      type: 'object',
      properties: {
        task_context: { type: 'string', description: 'Context of the defect' },
        defect_observed: { type: 'string', description: 'What went wrong' },
        user_critique: { type: 'string', description: 'User correction or critique' },
        negative_warning: { type: 'string', description: 'Strict negative constraint to prevent repeat' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords for recall' }
      },
      required: ['negative_warning']
    }
  }
];

/**
 * Executes a tool by name with arguments
 */
export async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'brain_search': {
      const query = args.query || '';
      const maxTokens = args.maxTokens || 800;
      const topK = args.topK || 3;
      const result = retrieveKnowledge(query, { maxTokens, topK });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: result.query,
              totalIndexed: result.totalIndexed,
              returnedCount: result.returnedCount,
              estimatedTokens: result.estimatedTokens,
              items: result.items,
              promptBlock: result.promptBlock
            }, null, 2)
          }
        ]
      };
    }

    case 'brain_create_task': {
      const contract = createTaskContract({
        task_type: args.task_type || 'FEATURE',
        objective: args.objective || '',
        constraints: {
          max_tokens_budget: args.max_tokens_budget || 1200
        }
      });
      resolveTaskContext(contract);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task_id: contract.task_id,
              task_type: contract.task_type,
              status: contract.status,
              objective: contract.objective,
              resolved_rules: contract.context.relevant_rules.map(r => r.id + ': ' + r.title),
              negative_constraints: contract.constraints.negative_constraints
            }, null, 2)
          }
        ]
      };
    }

    case 'brain_get_plan': {
      let contract = null;
      if (args.task_id) {
        const cp = loadTaskCheckpoint(args.task_id);
        if (cp) {
          contract = createTaskContract({
            task_id: cp.task_id,
            task_type: cp.task_type,
            objective: cp.objective
          });
        }
      }
      if (!contract) {
        contract = createTaskContract({
          task_type: args.task_type || 'FEATURE',
          objective: args.objective || 'Default task execution'
        });
      }

      if (args.skill_id) {
        try { bindSkillToTask(contract, args.skill_id); } catch (e) {}
      }

      planTaskDecomposition(contract);
      const nextSteps = getNextExecutableSteps(contract);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task_id: contract.task_id,
              total_steps: contract.execution_plan.length,
              steps: contract.execution_plan,
              next_executable_steps: nextSteps.map(s => ({ id: s.step_id, title: s.title, action: s.action }))
            }, null, 2)
          }
        ]
      };
    }

    case 'brain_verify_task': {
      let contract = null;
      if (args.task_id) {
        const cp = loadTaskCheckpoint(args.task_id);
        if (cp) {
          contract = createTaskContract({
            task_id: cp.task_id,
            task_type: cp.task_type,
            objective: cp.objective
          });
        }
      }
      if (!contract) {
        contract = createTaskContract({
          task_type: 'MICRO_FIX',
          objective: 'Verification target'
        });
      }

      const barrierResult = verifyExecutionResult(contract, {
        buildExitCode: args.buildExitCode,
        terminalOutput: args.terminalOutput,
        evidenceTypes: args.evidenceTypes || ['BUILD_EXIT_0', 'TEST_PASS']
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: barrierResult.verified,
              status: contract.status,
              evidence_collected: contract.verification_results.evidence_collected,
              failure_reason: barrierResult.failureReason
            }, null, 2)
          }
        ]
      };
    }

    case 'brain_record_memory': {
      const record = recordSessionMemory({
        task_context: args.task_context,
        defect_observed: args.defect_observed,
        user_critique: args.user_critique,
        negative_warning: args.negative_warning,
        keywords: args.keywords || []
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              recorded: true,
              memory_id: record.memory_id,
              timestamp: record.timestamp,
              negative_warning: record.negative_warning
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Handles an incoming JSON-RPC request and returns JSON-RPC response
 */
export async function processJsonRpcMessage(message) {
  const { id, method, params } = message;

  // JSON-RPC 2.0 & MCP Spec: Notifications MUST NOT receive a response
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const clientVersion = params?.protocolVersion || PROTOCOL_VERSION;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: clientVersion,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false }
          },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
        }
      };
    }

    case 'notifications/initialized':
    case 'initialized':
      // Client handshake complete notification
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: BRAIN_TOOLS
        }
      };

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = await handleToolCall(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: err.message }
        };
      }
    }

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { resources: [] }
      };

    case 'resources/templates/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { resourceTemplates: [] }
      };

    case 'prompts/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { prompts: [] }
      };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'logging/setLevel':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      if (isNotification) {
        // Unhandled notification - drop silently per JSON-RPC 2.0
        return null;
      }
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

/**
 * Starts stdio line-buffered server for external process communication
 */
export function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const request = JSON.parse(trimmed);
      const response = await processJsonRpcMessage(request);
      if (response !== null && response !== undefined) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (e) {
      // Return parse error only if not an empty line
      const errResp = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${e.message}` }
      };
      process.stdout.write(JSON.stringify(errResp) + '\n');
    }
  });
}

// Direct CLI Execution as Stdio Server
if (process.argv[1] && process.argv[1].endsWith('brain-mcp-server.mjs')) {
  startStdioServer();
}
