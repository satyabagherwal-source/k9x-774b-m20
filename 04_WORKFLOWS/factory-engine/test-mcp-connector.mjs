/**
 * Automated Verification Suite for External Client MCP Interoperability
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-mcp-connector.mjs
 * Purpose: Verifies Requirement 4: External AI agent communication with AI-Builder-Brain
 *          over standard Model Context Protocol (MCP) JSON-RPC 2.0 stdio transport.
 */

import { spawn } from 'child_process';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_SCRIPT = path.join(__dirname, 'brain-mcp-server.mjs');

console.log('======================================================================');
console.log('🧪 TEST SUITE: EXTERNAL MCP CLIENT INTEROPERABILITY (REQUIREMENT 4)');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? ': ' + details : ''}`);
    failedTests++;
  }
}

async function runMcpClientTest() {
  console.log('[STAGE 1] Spawning External Brain MCP Server Process (Stdio Transport)...');
  
  const serverProc = spawn('node', [SERVER_SCRIPT], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const rl = readline.createInterface({
    input: serverProc.stdout,
    terminal: false
  });

  let messageId = 1;
  const pendingRequests = new Map();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id && pendingRequests.has(msg.id)) {
        const resolve = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        resolve(msg);
      }
    } catch (e) {
      console.error('Failed to parse line:', line, e);
    }
  });

  function sendRpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const req = { jsonrpc: '2.0', id, method, params };
      pendingRequests.set(id, resolve);
      serverProc.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  // TEST 1: MCP Initialize Handshake
  console.log('[TEST 1] Testing MCP Initialize Handshake...');
  const initResp = await sendRpc('initialize');
  assert(initResp.result !== undefined, 'Server responded to initialize');
  assert(initResp.result.serverInfo.name === 'ai-builder-brain', 'Server identifies as ai-builder-brain');
  assert(initResp.result.protocolVersion === '2024-11-05', 'Server conforms to MCP protocol 2024-11-05');

  // TEST 2: Discovering Available Brain Tools
  console.log('\n[TEST 2] Discovering Available Brain Tools via tools/list...');
  const toolsResp = await sendRpc('tools/list');
  assert(Array.isArray(toolsResp.result.tools), 'Tools array returned');
  const toolNames = toolsResp.result.tools.map(t => t.name);
  assert(toolNames.includes('brain_search'), 'brain_search tool available');
  assert(toolNames.includes('brain_create_task'), 'brain_create_task tool available');
  assert(toolNames.includes('brain_get_plan'), 'brain_get_plan tool available');
  assert(toolNames.includes('brain_verify_task'), 'brain_verify_task tool available');
  assert(toolNames.includes('brain_record_memory'), 'brain_record_memory tool available');

  // TEST 3: Executing External Brain Knowledge Search
  console.log('\n[TEST 3] External Client Calling brain_search Tool...');
  const searchResp = await sendRpc('tools/call', {
    name: 'brain_search',
    arguments: { query: 'Rule 12 Windows CRLF line endings', maxTokens: 500 }
  });
  assert(searchResp.result !== undefined, 'Search tool executed successfully');
  const searchData = JSON.parse(searchResp.result.content[0].text);
  assert(searchData.returnedCount > 0, 'Returned precision knowledge items', `Items: ${searchData.returnedCount}`);
  assert(searchData.estimatedTokens <= 500, 'Search strictly adhered to token budget', `${searchData.estimatedTokens} tokens`);

  // TEST 4: External Client Creating Task Contract
  console.log('\n[TEST 4] External Client Calling brain_create_task Tool...');
  const taskResp = await sendRpc('tools/call', {
    name: 'brain_create_task',
    arguments: {
      task_type: 'MICRO_FIX',
      objective: 'Normalize CRLF in template string parser to avoid SSR hydration crash'
    }
  });
  assert(taskResp.result !== undefined, 'Task creation tool executed');
  const taskData = JSON.parse(taskResp.result.content[0].text);
  assert(taskData.task_id.startsWith('task-'), 'Assigned valid task ID', taskData.task_id);
  assert(taskData.status === 'CONTEXT_RESOLVED', 'Task status is CONTEXT_RESOLVED');
  assert(taskData.negative_constraints.length > 0, 'Negative constraints injected into contract');

  // TEST 5: External Client Inspecting DAG Execution Plan
  console.log('\n[TEST 5] External Client Calling brain_get_plan Tool...');
  const planResp = await sendRpc('tools/call', {
    name: 'brain_get_plan',
    arguments: {
      task_id: taskData.task_id,
      task_type: 'MICRO_FIX',
      objective: taskData.objective
    }
  });
  assert(planResp.result !== undefined, 'Plan decomposition tool executed');
  const planData = JSON.parse(planResp.result.content[0].text);
  assert(planData.total_steps === 3, 'MICRO_FIX decomposed into 3 DAG steps', `Steps: ${planData.total_steps}`);
  assert(planData.next_executable_steps.length === 1, 'Only step 1 is initially executable');

  // TEST 6: External Client Submitting Verification Evidence
  console.log('\n[TEST 6] External Client Calling brain_verify_task Tool...');
  const verifyResp = await sendRpc('tools/call', {
    name: 'brain_verify_task',
    arguments: {
      task_id: taskData.task_id,
      buildExitCode: 0,
      terminalOutput: '✓ Test passed: 0 regressions, build exit code 0',
      evidenceTypes: ['BUILD_EXIT_0', 'TEST_PASS']
    }
  });
  assert(verifyResp.result !== undefined, 'Verification barrier tool executed');
  const verifyData = JSON.parse(verifyResp.result.content[0].text);
  assert(verifyData.verified === true, 'Task verified successfully by external client evidence');
  assert(verifyData.status === 'VERIFIED', 'Task status transitioned to VERIFIED');

  // Shutdown server process cleanly
  serverProc.kill();

  console.log('\n======================================================================');
  console.log(`🏁 MCP CONNECTOR INTEROPERABILITY: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) process.exit(1);
  else process.exit(0);
}

runMcpClientTest().catch(err => {
  console.error('Fatal MCP test error:', err);
  process.exit(1);
});
