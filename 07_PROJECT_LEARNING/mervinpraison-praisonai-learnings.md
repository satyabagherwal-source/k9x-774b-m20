# Forensic Learning Record (Deep Inspection): MervinPraison/PraisonAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/mervinpraison-praisonai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MervinPraison/PraisonAI](https://github.com/MervinPraison/PraisonAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:55:57.862Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MervinPraison/PraisonAI`
- **Description**: PraisonAI 🦞 — Hire a 24/7 AI Workforce. Stop writing boilerplate and start shipping autonomous self-improving agents that research, plan, code, and execute tasks. Deployed in 5 lines of code with built-in memory, RAG, and support for 100+ LLMs.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9128 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/consolidated_params/basic_hooks.py`
```
"""
Basic Hooks Example - Agent-Centric API

Demonstrates lifecycle hooks with consolidated params.
Valid keys: on_step, on_tool_call, middleware
"""

from praisonaiagents import Agent

# Define hook callbacks
def on_step_callback(step_info):
    print(f"Step: {step_info}")

def on_tool_call_callback(tool_info):
    print(f"Tool called: {tool_info}")

# Basic: Enable hooks with dict
agent = Agent(
    instructions="You are a helpful assistant.",
    hooks={
        "on_step": on_step_callback,
        "on_tool_call": on_tool_call_callback,
    },
)

if __name__ == "__main__":
    response = agent.start("What is 2 + 2?")
    print(response)

```

### Core Architecture Module: `examples/hooks/basic_hooks.py`
```
#!/usr/bin/env python3
"""
Basic Hooks Example for PraisonAI Agents.

This example demonstrates the simplified hook API using add_hook():
1. Log tool calls before execution
2. Block dangerous operations
3. Add context to agent responses
4. Monitor session lifecycle

For the simplest example, see simple_hooks.py

Usage:
    python basic_hooks.py
"""

import asyncio
from praisonaiagents.hooks import (
    add_hook, remove_hook, has_hook, get_default_registry,
    HookRunner, HookEvent, HookResult,
    BeforeToolInput, AfterToolInput
)


def main():
    # Clear any existing hooks from previous runs
    get_default_registry().clear()
    
    # ==========================================================================
    # Hook 1: Log all tool calls (using string event name)
    # ==========================================================================
    @add_hook('before_tool')
    def log_tool_calls(event_data: BeforeToolInput) -> HookResult:
        """Log every tool call before execution."""
        print(f"\n📝 [LOG] Tool: {event_data.tool_name}")
        print(f"   Input: {event_data.tool_input}")
        return HookResult.allow()
    
    # ==========================================================================
    # Hook 2: Block dangerous file operations
    # ==========================================================================
    @add_hook('before_tool')
    def block_delete_operations(event_data: BeforeToolInput) -> HookResult:
        """Block any delete or remove operations."""
        dangerous_keywords = ['delete', 'remove', 'rm', 'unlink']
        tool_lower = event_data.tool_name.lower()
        
        if any(kw in tool_lower for kw in dangerous_keywords):
            print(f"\n🚫 [BLOCKED] Dangerous operation: {event_data.tool_name}")
            return HookResult.deny(
                f"Operation '{event_data.tool_name}' is blocked by security policy"
            )
        return HookResult.allow()
    
    # ==========================================================================
    # Hook 3: Require confirmation for write operations
    # ==========================================================================
    @add_hook('before_tool')
    def confirm_write_operations(event_data: BeforeToolInput) -> HookResult:
        """Request confirmation for write operations."""
        write_keywords = ['write', 'save', 'create', 'update']
        tool_lower = event_data.tool_name.lower()
        
        if any(kw in tool_lower for kw in write_keywords):
            print(f"\n⚠️  [CONFIRM] Write operation: {event_data.tool_name}")
            # In a real scenario, you might prompt the user here
            return HookResult.allow("Auto-approved for demo")
        return HookResult.allow()
    
    # ==========================================================================
    # Hook 4: Add timing information after tool execution
    # ==========================================================================
    @add_hook('after_tool')
    def log_tool_completion(event_data: AfterToolInput) -> HookResult:
        """Log tool completion with timing."""
        print(f"\n✅ [DONE] Tool: {event_data.tool_name}")
        print(f"   Duration: {event_data.execution_time_ms:.2f}ms")
        if event_data.tool_error:
            print(f"   Error: {event_data.tool_error}")
        return HookResult.allow()
    
    # ==========================================================================
    # Test the hooks
    # ==========================================================================
    print("=" * 60)
    print("Testing Hooks System (using add_hook API)")
    print("=" * 60)
    
    # Check hooks are registered
    print(f"\nHooks registered for 'before_tool': {has_hook('before_tool')}")
    print(f"Hooks registered for 'after_tool': {has_hook('after_tool')}")
    
    runner = HookRunner(get_default_registry())
    
    # Test 1: Normal tool call (should be logged and allowed)
    print("\n--- Test 1: Normal read operation ---")
    input1 = BeforeToolInput(
        session_id="test",
        cwd="/tmp",
        event_name="before_tool",
        timestamp="2024-01-01T00:00:00",
        tool_name="read_file",
        tool_input={"path": "/tmp/test.txt"}
    )
    results = asyncio.run(runner.execute(HookEvent.BEFORE_TOOL, input1))
    print(f"Result: {'ALLOWED' if not HookRunner.is_blocked(results) else 'BLOCKED'}")
    
    # Test 2: Delete operation (should be blocked)
    print("\n--- Test 2: Delete operation ---")
    input2 = BeforeToolInput(
        session_id="test",
        cwd="/tmp",
        event_name="before_tool",
        timestamp="2024-01-01T00:00:00",
        tool_name="delete_file",
        tool_input={"path": "/important/data.txt"}
    )
    results = asyncio.run(runner.execute(HookEvent.BEFORE_TOOL, input2))
    print(f"Result: {'ALLOWED' if not HookRunner.is_blocked(results) else 'BLOCKED'}")
    if HookRunner.is_blocked(results):
        print(f"Reason: {HookRunner.get_blocking_reason(results)}")
    
    # Test 3: Write operation (should be confirmed)
    print("\n--- Test 3: Write operation ---")
    input3 = BeforeToolInput(
        session_id="test",
        cwd="/tmp",
        event_name="before_tool",
        timestamp="2024-01-01T00:00:00",
        tool_name="write_file",
        tool_input={"path": "/tmp/output.txt", "content": "Hello"}
    )
    results = asyncio.run(runner.execute(HookEvent.BEFORE_TOOL, input3))
    print(f"Result: {'ALLOWED' if not HookRunner.is_blocked(results) else 'BLOCKED'}")
    
    # Show registered hooks
    print("\n" + "=" * 60)
    print("Registered Hooks:")
    print("=" * 60)
    for event, hooks in get_default_registry().list_hooks().items():
        print(f"\n{event}:")
        for hook in hooks:
            print(f"  - {hook['name']} (matcher: {hook['matcher'] or '*'})")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/hooks/simple_hooks.py`
```
#!/usr/bin/env python3
"""
Simple Hooks Example for PraisonAI Agents.

This example shows the SIMPLEST way to use hooks with the add_hook API.
Just a few lines of code to intercept tool calls!

No need to import HookResult - just return None/True to allow, 
False to deny, or a string to deny with a reason.

Usage:
    python simple_hooks.py
"""

from praisonaiagents.hooks import add_hook, has_hook


# =============================================================================
# Register hooks with simple string event names
# =============================================================================

@add_hook('before_tool')
def log_tools(event_data):
    """Log every tool call. Return nothing (None) to allow."""
    print(f"🔧 Tool: {event_data.tool_name}")
    # No return needed - defaults to allow


@add_hook('before_tool')
def block_dangerous(event_data):
    """Block delete operations. Return False or string to deny."""
    if 'delete' in event_data.tool_name.lower():
        print(f"🚫 Blocked: {event_data.tool_name}")
        return "Delete operations are not allowed"  # String = deny with reason
    # No return = allow


@add_hook('after_tool')
def log_completion(event_data):
    """Log tool completion."""
    print(f"✅ Done: {event_data.tool_name} ({event_data.execution_time_ms:.0f}ms)")


# =============================================================================
# Test the hooks
# =============================================================================

if __name__ == "__main__":
    print("=" * 50)
    print("Simple Hooks Example")
    print("=" * 50)
    
    # Check hooks are registered
    print(f"\nHooks registered for 'before_tool': {has_hook('before_tool')}")
    print(f"Hooks registered for 'after_tool': {has_hook('after_tool')}")
    
    # You can now create an Agent and the hooks will be applied
    print("\n💡 Hooks are now globally registered!")
    print("   Any Agent will automatically use these hooks.")
    print("\n   Example:")
    print("   from praisonaiagents import Agent")
    print("   agent = Agent(instructions='You are helpful')")
    print("   agent.start('Help me with files')")
    print("\n📝 Hook returns:")
    print("   - None or True  → Allow the operation")
    print("   - False         → Deny the operation")
    print("   - 'reason'      → Deny with a custom message")

```

### Core Architecture Module: `examples/js/knowledge/query-engine.ts`
```
/**
 * QueryEngine Integration Test
 * 
 * Tests semantic and keyword search for RAG applications.
 * 
 * Run: npx ts-node query-engine.ts
 */

import {
    QueryEngine,
    createQueryEngine,
    createSimpleQueryEngine
} from '../../../src/praisonai-ts/dist';

async function main() {
    console.log('=== QueryEngine Integration Test ===\n');

    // Test 1: Simple in-memory engine
    console.log('1. Testing simple in-memory QueryEngine:');
    const docs = [
        { id: 'doc1', content: 'PraisonAI is a high-performance AI agent framework designed for production use.' },
        { id: 'doc2', content: 'TypeScript provides static typing and better tooling for JavaScript projects.' },
        { id: 'doc3', content: 'Agents can use tools, memory, and knowledge to complete complex tasks.' },
        { id: 'doc4', content: 'RAG (Retrieval-Augmented Generation) improves AI responses with relevant context.' },
        { id: 'doc5', content: 'Workflows enable sequential and parallel execution of agent tasks.' }
    ];

    const engine = createSimpleQueryEngine(docs);

    const results1 = await engine.query('agent framework', { topK: 2 });
    console.log('   Query: "agent framework"');
    console.log(`   Found: ${results1.length} results`);
    results1.forEach((r, i) => {
        console.log(`   [${i + 1}] ${r.content.slice(0, 50)}... (score: ${r.score.toFixed(2)})`);
    });
    console.log('   Success: ✅');

    // Test 2: Different queries
    console.log('\n2. Testing various queries:');
    const queries = ['TypeScript', 'RAG', 'workflow', 'tools memory'];

    for (const q of queries) {
        const results = await engine.query(q, { topK: 1 });
        console.log(`   "${q}" → ${results.length > 0 ? results[0].content.slice(0, 40) + '...' : 'No results'}`);
    }
    console.log('   Success: ✅');

    // Test 3: Query for context string
    console.log('\n3. Testing queryForContext:');
    const context = await engine.queryForContext('agent tasks', { topK: 2 });
    console.log('   Context string (preview):');
    console.log('   ' + context.split('\n')[0]);
    console.log('   Success: ✅');

    // Test 4: Cache behavior
    console.log('\n4. Testing caching:');
    const start = Date.now();
    await engine.query('agent framework', { topK: 2 });
    const cachedTime = Date.now() - start;
    console.log(`   Cached query time: ${cachedTime}ms (should be fast)`);

    engine.clearCache();
    const start2 = Date.now();
    await engine.query('agent framework', { topK: 2 });
    const uncachedTime = Date.now() - start2;
    console.log(`   Uncached query time: ${uncachedTime}ms`);
    console.log('   Success: ✅');

    // Test 5: QueryEngine configuration
    console.log('\n5. Testing custom QueryEngine configuration:');
    const customEngine = new QueryEngine({
        keywordSearch: async (query, options) => {
            return docs
                .filter(d => d.content.toLowerCase().includes(query.toLowerCase()))
                .map(d => ({ id: d.id, content: d.content, score: 0.8 }))
                .slice(0, options?.topK ?? 5);
        },
        defaultOptions: { mode: 'keyword', topK: 3 }
    });

    const customResults = await customEngine.query('TypeScript');
    console.log(`   Custom engine results: ${customResults.length}`);
    console.log('   Success: ✅');

    // Test 6: Empty results handling
    console.log('\n6. Testing empty results:');
    const emptyResults = await engine.query('nonexistent_query_12345');
    console.log(`   Results for nonsense query: ${emptyResults.length}`);

    const emptyContext = await engine.queryForContext('nonexistent_query_12345');
    console.log(`   Context: "${emptyContext}"`);
    console.log('   Success: ✅');

    console.log('\n=== QueryEngine Tests Complete ===');
}

main().catch(console.error);

```

### Core Architecture Module: `examples/js/memory/memory-hooks.ts`
```
/**
 * MemoryHooks Integration Test
 * 
 * Tests pre/post hooks for memory operations.
 * 
 * Run: npx ts-node memory-hooks.ts
 */

import {
    MemoryHooks,
    createMemoryHooks,
    createLoggingHooks,
    createValidationHooks,
    Memory,
    createMemory
} from '../../../src/praisonai-ts/dist';

async function main() {
    console.log('=== MemoryHooks Integration Test ===\n');

    // Test 1: Basic hooks
    console.log('1. Testing basic MemoryHooks:');
    const logs: string[] = [];

    const hooks = new MemoryHooks({
        beforeStore: async (key, value) => {
            logs.push(`beforeStore: ${key}`);
            return { key, value };
        },
        afterStore: async (key) => {
            logs.push(`afterStore: ${key}`);
        },
        beforeRetrieve: async (key) => {
            logs.push(`beforeRetrieve: ${key}`);
            return key;
        },
        afterRetrieve: async (key, value) => {
            logs.push(`afterRetrieve: ${key}`);
            return value;
        }
    });

    await hooks.beforeStore('key1', { data: 'value1' });
    await hooks.afterStore('key1', { data: 'value1' });
    await hooks.beforeRetrieve('key1');
    await hooks.afterRetrieve('key1', { data: 'value1' });

    console.log('   Triggered hooks:', logs);
    console.log('   Success: ✅');

    // Test 2: Logging hooks
    console.log('\n2. Testing createLoggingHooks:');
    const logMessages: string[] = [];
    const loggingHooks = createLoggingHooks((msg) => logMessages.push(msg));

    await loggingHooks.beforeStore('test', 'data');
    await loggingHooks.afterStore('test', 'data');
    await loggingHooks.beforeRetrieve('test');
    await loggingHooks.afterRetrieve('test', 'data');

    console.log('   Log messages:', logMessages.length);
    logMessages.forEach(m => console.log('    -', m));
    console.log('   Success: ✅');

    // Test 3: Validation hooks
    console.log('\n3. Testing createValidationHooks:');
    const validationHooks = createValidationHooks((key, value) => {
        // Only allow non-empty strings
        if (typeof value !== 'string' || value.length === 0) {
            return { valid: false, reason: 'Value must be non-empty string' };
        }
        return { valid: true };
    });

    const validResult = await validationHooks.beforeStore('good', 'valid string');
    console.log('   Valid data allowed:', validResult !== null);

    const invalidResult = await validationHooks.beforeStore('bad', '');
    console.log('   Invalid data blocked:', invalidResult === null);
    console.log('   Success: ✅');

    // Test 4: Delete hooks
    console.log('\n4. Testing delete hooks:');
    const deleteHooks = new MemoryHooks({
        beforeDelete: async (key) => {
            console.log(`   [Hook] About to delete: ${key}`);
            return true; // Allow deletion
        },
        afterDelete: async (key, success) => {
            console.log(`   [Hook] Delete ${key}: ${success ? 'succeeded' : 'failed'}`);
        }
    });

    const canDelete = await deleteHooks.beforeDelete('item-to-delete');
    console.log('   Deletion allowed:', canDelete);
    await deleteHooks.afterDelete('item-to-delete', true);
    console.log('   Success: ✅');

    // Test 5: Search hooks
    console.log('\n5. Testing search hooks:');
    const searchHooks = new MemoryHooks({
        beforeSearch: async (query, options) => {
            console.log(`   [Hook] Searching: "${query}"`);
            // Could modify query here
            return { query: query.toLowerCase(), options };
        },
        afterSearch: async (query, results) => {
            console.log(`   [Hook] Found ${results.length} results for "${query}"`);
            return results;
        }
    });

    const searchParams = await searchHooks.beforeSearch('UPPERCASE QUERY');
    console.log('   Modified query:', searchParams?.query);

    await searchHooks.afterSearch('query', [{ id: '1' }, { id: '2' }]);
    console.log('   Success: ✅');

    // Test 6: Dynamic hook management
    console.log('\n6. Testing dynamic hook management:');
    const dynamicHooks = new MemoryHooks({});

    console.log('   Initial config:', Object.keys(dynamicHooks.getConfig()).length === 0 ? 'empty' : 'has hooks');

    dynamicHooks.addHook('logging', true);
    dynamicHooks.setLogging(true);

    console.log('   After adding logging:', dynamicHooks.getConfig().logging);

    dynamicHooks.removeHook('logging');
    console.log('   After removing:', dynamicHooks.getConfig().logging ?? 'undefined');
    console.log('   Success: ✅');

    console.log('\n=== MemoryHooks Tests Complete ===');
}

main().catch(console.error);

```

### Core Architecture Module: `examples/js/workflows/loop-pattern.ts`
```
/**
 * Loop Pattern Integration Test
 * 
 * Tests the Loop workflow pattern with real data.
 * 
 * Run: npx ts-node loop-pattern.ts
 */

import { Loop, loopPattern, Agent, Workflow } from '../../../src/praisonai-ts/dist';

async function main() {
    console.log('=== Loop Pattern Integration Test ===\n');

    // Test 1: Basic Loop with array
    console.log('1. Testing Loop with array iteration:');
    const items = ['apple', 'banana', 'cherry'];

    const processor = (item: string) => `Processed: ${item.toUpperCase()}`;
    const arrayLoop = new Loop(processor, { over: 'items' });

    const result1 = await arrayLoop.run({ items });
    console.log('   Results:', result1.results);
    console.log('   Iterations:', result1.iterations);
    console.log('   Success:', result1.success ? '✅' : '❌');

    // Test 2: Loop with convenience function
    console.log('\n2. Testing loop() convenience function:');
    const doubler = (n: number) => n * 2;
    const numberLoop = loopPattern(doubler, { over: 'numbers' });

    const result2 = await numberLoop.run({ numbers: [1, 2, 3, 4, 5] });
    console.log('   Input: [1, 2, 3, 4, 5]');
    console.log('   Output:', result2.results);
    console.log('   Success:', result2.success ? '✅' : '❌');

    // Test 3: Loop with Agent (requires OPENAI_API_KEY)
    if (process.env.OPENAI_API_KEY) {
        console.log('\n3. Testing Loop with Agent (live API):');
        try {
            const agent = new Agent({
                name: 'Summarizer',
                instructions: 'Summarize the given topic in one sentence.',
                llm: 'openai/gpt-4o-mini'
            });

            const topics = ['AI', 'TypeScript'];
            const agentLoop = new Loop(agent, { over: 'topics', varName: 'topic' });

            console.log('   Processing topics:', topics);
            const result3 = await agentLoop.run({ topics });

            result3.results.forEach((res, i) => {
                console.log(`   [${topics[i]}]: ${res.slice(0, 80)}...`);
            });
            console.log('   Success:', result3.success ? '✅' : '❌');
        } catch (error: any) {
            console.log('   ⚠️ Agent test failed:', error.message);
        }
    } else {
        console.log('\n3. Agent Loop Test: Skipped (OPENAI_API_KEY not set)');
    }

    // Test 4: Loop with error handling
    console.log('\n4. Testing Loop with continueOnError:');
    const errorProneProcessor = (item: string) => {
        if (item === 'fail') throw new Error('Intentional failure');
        return `OK: ${item}`;
    };

    const errorLoop = new Loop(errorProneProcessor, {
        over: 'items',
        continueOnError: true
    });

    const result4 = await errorLoop.run({ items: ['a', 'fail', 'b'] });
    console.log('   Results:', result4.results);
    console.log('   Errors:', result4.errors.length);
    console.log('   Success:', result4.success ? '✅' : '❌ (expected - has errors)');

    // Test 5: Loop type exports
    console.log('\n5. Verifying exports:');
    console.log('   Loop class:', typeof Loop);
    console.log('   loop function:', typeof loopPattern);

    console.log('\n=== Loop Pattern Tests Complete ===');
}

main().catch(console.error);

```

### Core Architecture Module: `examples/middleware/injected_state.py`
```
"""
Injected State Example - PraisonAI Agents

Demonstrates injecting agent state into tools without exposing it in the schema.
"""

from praisonaiagents import Agent, tool
from praisonaiagents.tools import Injected
from praisonaiagents.tools.injected import AgentState, with_injection_context

# Tool with injected state - state param is NOT in the public schema
@tool
def show_context(query: str, state: Injected[dict]) -> str:
    """Show the current agent context."""
    session_id = state.get('session_id', 'unknown')
    agent_id = state.get('agent_id', 'unknown')
    return f"Query: {query}, Session: {session_id}, Agent: {agent_id}"

# Create agent with the tool
agent = Agent(
    name="ContextBot",
    instructions="You help show context information.",
    tools=[show_context],
    memory={"session_id": "my-session-123"},
)

if __name__ == "__main__":
    # Verify injected param is not in schema
    schema = show_context.get_schema()
    params = schema['function']['parameters']['properties']
    print(f"Schema params: {list(params.keys())}")
    assert 'state' not in params, "state should NOT be in schema"
    print("✓ 'state' correctly excluded from schema")
    
    # Test with manual injection context
    mock_state = AgentState(
        agent_id="test-agent",
        run_id="run-1",
        session_id="session-abc"
    )
    
    with with_injection_context(mock_state):
        result = show_context(query="hello")
        print(f"Result: {result}")
    
    # Test via agent.execute_tool
    result = agent.execute_tool("show_context", {"query": "test"})
    print(f"Agent result: {result}")
    
    print("\n✓ Injected state example complete")

```

### Core Architecture Module: `examples/persistence/mongodb_state_store.py`
```
# praisonai: skip=true
"""
MongoDB StateStore — Full Persistence Example

Demonstrates:
  - Creating a MongoDB StateStore
  - Key-value operations (get/set/delete/exists)
  - Complex state persistence (agent metadata, usage tokens)
  - Direct MongoDB verification
  - Session resume after simulated restart

Requirements:
    pip install praisonai pymongo
    Docker: MongoDB on localhost:27017 (no auth)

Run:
    python mongodb_state_store.py
"""

import uuid
import pymongo
from praisonai.persistence.state.mongodb import MongoDBStateStore

MONGO_URL = "mongodb://localhost:27017"
DATABASE = "praisonai_example"
COLLECTION = f"state_{uuid.uuid4().hex[:8]}"

print(f"MongoDB: {MONGO_URL}")
print(f"Database: {DATABASE}, Collection: {COLLECTION}\n")

store = MongoDBStateStore(url=MONGO_URL, database=DATABASE, collection=COLLECTION)

# --- Phase 1: Basic key-value operations ---
print("=== Phase 1: Basic Key-Value Operations ===")
store.set("agent_id", "mongo_demo_agent_001")
store.set("model", "gpt-4o-mini")
store.set("counter", 42)

print(f"  agent_id: {store.get('agent_id')}")
print(f"  model: {store.get('model')}")
print(f"  counter: {store.get('counter')}")
print(f"  exists('agent_id'): {store.exists('agent_id')}")
print(f"  exists('missing'): {store.exists('missing')}")

assert store.get("agent_id") == "mongo_demo_agent_001"
assert store.get("counter") == 42

print()

# --- Phase 2: Complex state persistence ---
print("=== Phase 2: Complex State Persistence ===")
managed_state = {
    "agent_id": "mongo_demo_agent_001",
    "agent_version": 4,
    "environment_id": "env_mongo_001",
    "total_input_tokens": 800,
    "total_output_tokens": 300,
    "compute_instance_id": "e2b_mongo_demo",
    "session_history": [
        {"id": "session_m1", "status": "completed"},
        {"id": "session_m2", "status": "idle"},
    ],
}

store.set("managed_state", managed_state)
recovered = store.get("managed_state")

print(f"  agent_id: {recovered['agent_id']}")
print(f"  agent_version: {recovered['agent_version']}")
print(f"  total_input_tokens: {recovered['total_input_tokens']}")
print(f"  compute_instance_id: {recovered['compute_instance_id']}")
print(f"  session_history count: {len(recovered['session_history'])}")

assert recovered["agent_id"] == "mongo_demo_agent_001"
assert recovered["total_input_tokens"] == 800

print()

# --- Phase 3: Direct MongoDB Verification ---
print("=== Phase 3: Direct MongoDB Verification ===")
client = pymongo.MongoClient(MONGO_URL)
doc = client[DATABASE][COLLECTION].find_one({"_id": "managed_state"})
print(f"  Raw doc _id: {doc['_id']}")
print(f"  Raw doc value.agent_id: {doc['value']['agent_id']}")
print(f"  Raw doc value.total_input_tokens: {doc['value']['total_input_tokens']}")
assert doc["value"]["compute_instance_id"] == "e2b_mongo_demo"
client.close()

print()

# --- Phase 4: Session Resume ---
print("=== Phase 4: Session Resume (Simulating Restart) ===")
store.close()

store2 = MongoDBStateStore(url=MONGO_URL, database=DATABASE, collection=COLLECTION)

recovered2 = store2.get("managed_state")
assert recovered2 is not None, "State not found after restart!"
print(f"  Recovered agent_id: {recovered2['agent_id']}")
print(f"  Recovered tokens: in={recovered2['total_input_tokens']}, out={recovered2['total_output_tokens']}")
print(f"  Recovered compute: {recovered2['compute_instance_id']}")

# Update
recovered2["total_input_tokens"] += 400
store2.set("managed_state", recovered2)
final = store2.get("managed_state")
print(f"  Updated input_tokens: {final['total_input_tokens']}")
assert final["total_input_tokens"] == 1200

# Delete test
store2.delete("counter")
assert not store2.exists("counter")
print("  Delete verified: counter removed")

store2.close()

# --- Cleanup ---
print("\n=== Cleanup ===")
client = pymongo.MongoClient(MONGO_URL)
client[DATABASE].drop_collection(COLLECTION)
client.close()
print("  Collection dropped.")

print("\n✅ MongoDB StateStore — All tests passed!")

```

### Core Architecture Module: `examples/persistence/redis_state.py`
```
"""
Redis State Store - Agent-First Example

Use Redis for state management with an Agent.

Docker Setup:
    docker run -d --name redis -p 6379:6379 redis:7

Run:
    python redis_state.py

Expected output:
    Agent responds with state persisted to Redis
"""

from praisonaiagents import Agent
from praisonaiagents.db import db

print("=== Redis State Store (Agent-First) ===")

# Agent-first approach: use db parameter with Redis state store
my_db = db(
    database_url="sqlite:///conversations.db",  # Conversations
    state_url="redis://localhost:6379"          # State/tracing
)

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant.",
    memory={
        "db": my_db,
        "session_id": "redis-state-session",
    },
)

# Chat - state is automatically managed via Redis
response = agent.chat("Hello! Remember my name is Alice.")
print(f"Response: {response}")

# Second message to test state
response2 = agent.chat("What is my name?")
print(f"Response: {response2}")

my_db.close()
print("\n✅ Done")

# --- Advanced: Direct Store Usage ---
# from praisonaiagents import db
# redis_db = db.RedisDB(host="localhost", port=6379)

```

### Core Architecture Module: `examples/persistence/redis_state_store.py`
```
# praisonai: skip=true
"""
Redis StateStore — Full Persistence Example

Demonstrates:
  - Creating a Redis StateStore
  - Key-value operations (get/set/delete/exists)
  - JSON state persistence (agent metadata, usage tokens)
  - Hash operations for structured data
  - Session resume: simulate restart, recover state

Requirements:
    pip install praisonai redis
    Docker: Redis on localhost:6379 (password=myredissecret)

Run:
    python redis_state_store.py
"""

import uuid
import redis as redis_lib
from praisonai.persistence.state.redis import RedisStateStore

REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_PASSWORD = "myredissecret"
PREFIX = f"example_{uuid.uuid4().hex[:6]}:"

print(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
print(f"Key prefix: {PREFIX}\n")

store = RedisStateStore(
    host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, prefix=PREFIX,
)

# --- Phase 1: Basic key-value operations ---
print("=== Phase 1: Basic Key-Value Operations ===")
store.set("agent_id", "redis_demo_agent_001")
store.set("model", "gpt-4o-mini")
store.set("counter", "42")

print(f"  agent_id: {store.get('agent_id')}")
print(f"  model: {store.get('model')}")
print(f"  counter: {store.get('counter')}")
print(f"  exists('agent_id'): {store.exists('agent_id')}")
print(f"  exists('missing'): {store.exists('missing')}")

print()

# --- Phase 2: JSON state persistence ---
print("=== Phase 2: JSON State Persistence ===")
managed_state = {
    "agent_id": "redis_demo_agent_001",
    "agent_version": 3,
    "environment_id": "env_local_001",
    "total_input_tokens": 1500,
    "total_output_tokens": 600,
    "compute_instance_id": "docker_redis_demo",
    "session_history": [
        {"id": "session_001", "status": "completed", "title": "Weather chat"},
        {"id": "session_002", "status": "idle", "title": "Code review"},
    ],
}

store.set_json("managed_state", managed_state)
recovered = store.get_json("managed_state")

print(f"  agent_id: {recovered['agent_id']}")
print(f"  agent_version: {recovered['agent_version']}")
print(f"  total_input_tokens: {recovered['total_input_tokens']}")
print(f"  total_output_tokens: {recovered['total_output_tokens']}")
print(f"  compute_instance_id: {recovered['compute_instance_id']}")
print(f"  session_history count: {len(recovered['session_history'])}")

assert recovered["agent_id"] == "redis_demo_agent_001"
assert recovered["total_input_tokens"] == 1500
assert recovered["compute_instance_id"] == "docker_redis_demo"

print()

# --- Phase 3: Hash operations ---
print("=== Phase 3: Hash Operations ===")
store.hset("agent_meta", "version", "5")
store.hset("agent_meta", "env_id", "env_abc")
store.hset("agent_meta", "model", "gpt-4o")

print(f"  version: {store.hget('agent_meta', 'version')}")
all_meta = store.hgetall("agent_meta")
print(f"  all fields: {all_meta}")

print()

# --- Phase 4: Session Resume (Simulating Restart) ---
print("=== Phase 4: Session Resume (Simulating Restart) ===")
store.close()

# New store instance (simulating process restart)
store2 = RedisStateStore(
    host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, prefix=PREFIX,
)

# Recover state
recovered2 = store2.get_json("managed_state")
assert recovered2 is not None, "State not found after restart!"
print(f"  Recovered agent_id: {recovered2['agent_id']}")
print(f"  Recovered tokens: in={recovered2['total_input_tokens']}, out={recovered2['total_output_tokens']}")
print(f"  Recovered compute: {recovered2['compute_instance_id']}")
print(f"  Recovered sessions: {len(recovered2['session_history'])}")

# Update state (simulate more work)
recovered2["total_input_tokens"] += 500
recovered2["total_output_tokens"] += 200
store2.set_json("managed_state", recovered2)

final = store2.get_json("managed_state")
print(f"  Updated tokens: in={final['total_input_tokens']}, out={final['total_output_tokens']}")
assert final["total_input_tokens"] == 2000
assert final["total_output_tokens"] == 800

store2.close()

# --- Cleanup ---
print("\n=== Cleanup ===")
r = redis_lib.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD)
for key in r.keys(f"{PREFIX}*"):
    r.delete(key)
r.close()
print("  Keys deleted.")

print("\n✅ Redis StateStore — All tests passed!")

```

### Core Architecture Module: `examples/persistence/state_redis.py`
```
# praisonai: skip=true
"""
Redis State Store - Agent-First Example

Use Redis for state management with an Agent.

Docker Setup:
    docker run -d --name praison-redis -p 6379:6379 redis:7

Run:
    python state_redis.py

Expected Output:
    Agent responds with state persisted to Redis
"""

from praisonaiagents import Agent, MemoryConfig
from praisonaiagents.db import db

print("=== Redis State Store (Agent-First) ===")

# Agent-first approach: use db parameter with Redis state store
my_db = db(
    database_url="sqlite:///conversations.db",  # Conversations
    state_url="redis://localhost:6379"          # State/tracing
)

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant.",
    memory=MemoryConfig(db=my_db, session_id="redis-state-example"),
)

# Chat - state is automatically managed via Redis
response = agent.chat("Hello! Remember my favorite color is blue.")
print(f"Response: {response}")

# Second message to test state
response2 = agent.chat("What is my favorite color?")
print(f"Response: {response2}")

my_db.close()
print("\n=== Demo Complete ===")

# --- Advanced: Direct Store Usage ---
# from praisonai.persistence.factory import create_state_store
# store = create_state_store("redis", url="redis://localhost:6379")

```

### Core Architecture Module: `examples/python/autonomy/03_verification_hooks.py`
```
"""
Verification Hooks Example.

Demonstrates how to use verification hooks with Agent autonomy.

Run with: python 03_verification_hooks.py

Requirements:
- OPENAI_API_KEY environment variable set
"""

from praisonaiagents import Agent

# Agent-centric quickstart
agent = Agent(
    name="VerificationHooksDemo",
    instructions="You are a helpful assistant demonstrating verification hooks."
)

# --- Advanced: Low-level Verification API ---
from praisonaiagents.hooks.verification import (
    VerificationHook,
    VerificationResult,
    BaseVerificationHook,
    CommandVerificationHook,
    FileCheckHook,
)


class SimpleTestHook(BaseVerificationHook):
    """A simple test verification hook."""
    
    name = "simple_test"
    
    def _execute(self, context=None):
        return VerificationResult(
            success=True,
            output="All tests passed!",
            details={"tests_run": 5, "passed": 5, "failed": 0},
        )


class LintHook(BaseVerificationHook):
    """A lint verification hook."""
    
    name = "lint"
    
    def _execute(self, context=None):
        return VerificationResult(
            success=True,
            output="No lint errors found",
            details={"files_checked": 10, "errors": 0, "warnings": 2},
        )


def main():
    print("=" * 60)
    print("Verification Hooks Example")
    print("=" * 60)
    
    # 1. Create hooks
    print("\n1. Creating Verification Hooks:")
    test_hook = SimpleTestHook()
    lint_hook = LintHook()
    
    print(f"   - {test_hook.name}: {type(test_hook).__name__}")
    print(f"   - {lint_hook.name}: {type(lint_hook).__name__}")
    
    # 2. Run hooks manually
    print("\n2. Running Hooks Manually:")
    test_result = test_hook.run()
    lint_result = lint_hook.run()
    
    print(f"   Test result: success={test_result.success}, output='{test_result.output}'")
    print(f"   Lint result: success={lint_result.success}, output='{lint_result.output}'")
    
    # 3. Create agent with verification hooks
    print("\n3. Agent with Verification Hooks:")
    agent = Agent(
        instructions="You are a test-driven developer.",
        autonomy=True,
        verification_hooks=[test_hook, lint_hook],
    )
    
    print(f"   Hooks registered: {len(agent._verification_hooks)}")
    
    # 4. Run verification hooks through agent
    print("\n4. Running Hooks Through Agent:")
    results = agent._run_verification_hooks()
    
    for result in results:
        print(f"   - {result['hook']}: success={result['success']}")
    
    # 5. CommandVerificationHook example (without running)
    print("\n5. CommandVerificationHook (structure only):")
    cmd_hook = CommandVerificationHook(
        name="pytest",
        command=["python", "-m", "pytest", "-v"],
        timeout=30.0,
    )
    print(f"   Name: {cmd_hook.name}")
    print(f"   Command: {cmd_hook.command}")
    print(f"   Timeout: {cmd_hook.timeout_seconds}s")

    # 6. FileCheckHook: declarative, no-shell completion gate
    print("\n6. FileCheckHook (declarative completion gate):")
    file_hook = FileCheckHook(
        name="changelog", path="CHANGELOG.md", non_empty=True
    )
    file_result = file_hook.run()
    print(f"   {file_hook.name}: success={file_result.success} — {file_result.output}")
    print(
        "   Gate wiring: when verification_hooks are configured, the autonomous "
        "loop cannot finalise with a success outcome while a blocking hook fails."
    )

    print("\n" + "=" * 60)
    print("✓ Verification hooks example completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5659** (2026-10-05): **src/praisonai/praisonai: three validated correctness gaps (ACP path traversal, non-atomic persistence writes, scheduler process-lifecycle races)**
  *Symptoms*: ## Scope  A focused audit of `src/praisonai/praisonai/` (the "wrapper" tier — not core SDK, not tests, not docs) surfaces three concrete, verifiable gaps that each break a documented wrapper guarantee (safe-by-default, multi-agent safe, data-preserving). Line numbers below were read on `HEAD` (commit `e49b254`).  Nothing here is a size / coverage / style finding. Each defect has a concrete failure scenario, a cited call-site, and a fix sketch — and in two of the three cases a sibling helper that already does the right thing is sitting in the repo, just not reused.  ---  ## 1. ACP `SessionStore` uses the client-controlled `session_id` as a filename — path traversal (arbitrary `*.json` read + delete, plus silent save failure)  **Files**  - `src/praisonai/praisonai/acp/session.py` lines 126–143, 145–159, 177–188 - Reached from `src/praisonai/praisonai/acp/server.py` (`load_session`, `fork_session`, `resume_session`) with raw client input  **Problematic code — `acp/session.py:126-143`**  ```python def _session_path(self, session_id: str) -> Path:     """Get path for session file."""     return self.storage_dir / f"{session_id}.json"  def save(self, session: ACPSession) -> None:     """Save session to disk."""     try:         path = self._session_path(session.session_id)         with open(path, "w") as f:             json.dump(session.to_dict(), f, indent=2)          # Update last session pointer         with open(self._last_session_file, "w") as f:             f.write(session.se
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37188590921) • [`claude/issue-5659-20261004-0820`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5659-20261004-0820) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5659-20261004-0820?quick_pull=1&title=Issue%20%235659%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235659%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Fixed three validated correctness gaps in `src/praisonai/praisonai/`  - [x] Read AGENTS.md & validate routing (wrapper-tier, lightweight, no new params) - [x] Read all cited source files at HEAD - [x] Fix #1: ACP `SessionStore` path traversal + atomic writes - [x] Fix #2: Non-atomic JSON writes (`JSONConversationStore` + `SchedulerStateManager`) - [x] Fix #3: Scheduler PID-reuse + name-claim races - [x] Run tests - [x] Commit, push, create PR  **PR: ht

- **Issue #5653** (2026-10-03): **Core SDK: duplicate lazy run-lock idiom across agents/ and workflows/ (DRY/concurrency drift risk)**
  *Symptoms*: ## Summary The lazily-created re-entrancy lock (`_execution_lock` + module-level `_RUN_LOCK_INIT_GUARD`) is implemented twice — once in `agents/agents.py` (AgentTeam) and once in `workflows/workflows.py` (AgentFlow/Workflow). This is behaviour-identical concurrency-primitive logic duplicated across two core orchestration modules. This is a structural (DRY) finding only — **no feature, behaviour, or public API changes**.  ## Current behaviour Two separate module-level guards, same name and same rationale:  - `praisonaiagents/agents/agents.py:30` → `_RUN_LOCK_INIT_GUARD = threading.Lock()` - `praisonaiagents/workflows/workflows.py:54` → `_RUN_LOCK_INIT_GUARD = threading.Lock()`  Two `_execution_lock` properties implementing the identical double-checked-locking idiom:  ```python # agents/agents.py:2077-2098 @property def _execution_lock(self):     lock = getattr(self, '_run_lock', None)     if lock is None:         with _RUN_LOCK_INIT_GUARD:             lock = getattr(self, '_run_lock', None)             if lock is None:                 lock = threading.Lock()                 self._run_lock = lock     return lock  # workflows/workflows.py:791-806 — same create-under-guard steps @property def _execution_lock(self):     lock = self._run_lock     if lock is None:         with _RUN_LOCK_INIT_GUARD:             lock = self._run_lock             if lock is None:                 lock = threading.Lock()                 self._run_lock = lock     return lock ```  The only incidental diffe
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37139723542) • [`claude/issue-5653-20261003-1713`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5653-20261003-1713) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5653-20261003-1713?quick_pull=1&title=Issue%20%235653%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235653%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Task: Extract duplicate lazy run-lock idiom — Done  - [x] Read AGENTS.md guidelines - [x] Verify current code in agents/agents.py and workflows/workflows.py - [x] Create shared helper `praisonaiagents/_run_lock.py` - [x] Update both `_execution_lock` properties to delegate - [x] Run tests - [x] Commit, push, create PR  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5656  ### What changed - New `praisonaiagents/_run_lock.py` — single `_RUN_LOCK

- **Issue #5650** (2026-10-03): **Wrapper duplicates core SDK tool-timeout semantics; forward native path to core ToolConfig**
  *Symptoms*: ## Summary The `praisonai` wrapper carries its own ~360-line per-tool timeout enforcement implementation that re-implements the same subtle "run on a dedicated worker, abandon on expiry, raise a typed timeout error" semantics the core SDK already owns. This is duplicated logic (and a second, separate `ToolTimeoutError` type) that must be kept behaviourally in sync across two layers. This is a wrapper-health/duplication finding — **not** a request to remove any timeout capability.  ## Current behaviour Wrapper (`src/praisonai/praisonai/agents_generator.py`): - `ToolTimeoutError(TimeoutError)` — line 195 - `_TimeoutBoundTool` — line 269 - `_make_timeout_proxy(...)` — line 333 - `_wrap_with_timeout(tool, timeout_seconds, executor_factory, on_leaked=...)` — line 376 (instance-owned `ThreadPoolExecutor`, `future.result(timeout=...)`, best-effort cancel, abandon-on-expiry with leaked-worker recycling) - Wired via `_resolve_uniform_tool_timeout` (1174), `make_agent_tool_wrap_resolver` (1221), `_wrap_tool_with_timeout` (778)  Core SDK (reference): - `praisonaiagents/tools/call_executor.py:77` `ToolTimeoutError`; `:234` `run_single_tool_call(..., timeout_ms=...)` — dedicated `ThreadPoolExecutor(max_workers=1)`, `fut.result(timeout=...)`, `shutdown(wait=False)` abandon, typed timeout result - `praisonaiagents/agent/tool_execution.py:1301` reads `self._tool_timeout`; `:1394` `future.result(timeout=tool_timeout)` with a leaked-thread guard  ## Why it matters Two independently-maintained 
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37136192569) • [`claude/issue-5650-20261003-1616`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5650-20261003-1616) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5650-20261003-1616?quick_pull=1&title=Issue%20%235650%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235650%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Issue #5650 — Forward native tool-timeout to core ✅  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5652  - [x] Read guidelines + wrapper/core timeout code - [x] Architecture validation (wrapper-only change; relies on existing core `ToolConfig(timeout=)` enforcement — **no core change**) - [x] `_wrap_with_timeout`: opt-in `native_delegates_to_core` — native plain callables delegate to core; framework tool objects still wrapped (schema preserve

- **Issue #5646** (2026-10-05): **Gateway runtime posture persists outside gateway.yaml (hidden start-flags file) — no single, exportable resolved-config source of truth**
  *Symptoms*: ## Summary  A running gateway's configuration is split across two places that never get reconciled into one inspectable artefact:  1. the declared config (`gateway.yaml` / `bot.yaml`), and 2. a **hidden, per-host:port JSON side file** (`~/.praisonai/gateway.start.<host>.<port>.json`) that stores the CLI-only runtime posture so `gateway restart` can replay it.  Because of this, `gateway.yaml` is **not the single source of truth** for how the gateway is actually running, and there is no command to print or export the **resolved effective configuration** (declared YAML ⊕ CLI overrides ⊕ env). This hurts reproducibility, GitOps/version-control workflows, and debugging ("why is this gateway draining at 30s / running with the watchdog on?" — the answer lives in a file the operator never sees). It also cuts against the project's own "every feature runs 3 ways: CLI, YAML, Python" and config-as-source-of-truth principles: several posture knobs are reachable **only** via CLI flags and are then persisted outside the config file.  ## Current behaviour  `src/praisonai-bot/praisonai_bot/cli/features/gateway.py` persists CLI-only runtime flags to a side artefact keyed by host:port:  ```python def _start_flags_path(host: str, port: int) -> Path:     home = Path(os.environ.get("PRAISONAI_HOME") or (Path.home() / ".praisonai"))     safe_host = str(host).replace(":", "_")     return home / f"gateway.start.{safe_host}.{port}.json"  def _persist_start_flags(host: str, port: int, flags: Dict) -> N
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37112365820) • [`claude/issue-5646-20261003-0914`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5646-20261003-0914) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5646-20261003-0914?quick_pull=1&title=Issue%20%235646%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235646%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Done: Resolved-config snapshot/export for gateway  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5648  - [x] Read AGENTS.md & architecture rules - [x] Read gateway CLI features & commands files - [x] Review existing redaction & config resolution code - [x] Architecture validation (scope/routing check) - [x] Implement `resolve_effective_config` / `export_effective_config` (wrapper) - [x] Add `gateway config --resolved/--export` CLI - [x] Test 

- **Issue #5645** (2026-10-03): **Gateway inbound number→agent routing (AgentRegistry) is in-memory and thread-unsafe — mappings are lost on restart and race under concurrent dispatch**
  *Symptoms*: ## Summary  The gateway's inbound routing table that maps a phone number (WhatsApp/SMS/Signal) to the agent that should answer it is a plain in-process dictionary with **no persistence and no concurrency safety**. The public developer API `praisonai_bot.bots.AgentRegistry` is documented as something "a gateway can build one per process and consult on every inbound message", yet:  - every `assign(...)` is **lost on gateway restart** (an operator must re-assign all numbers after any restart, crash, or `gateway restart`), and - it is **explicitly thread-unsafe**, so concurrent inbound turns (the gateway dispatches turns concurrently and across workers) can race on the shared dict.  This is out of step with the rest of the gateway, where every other piece of routing/delivery state is already durable (SQLite, often with a Redis mirror). For a routing table that sits on the **inbound hot path**, losing it on restart is a production-grade reliability gap: messages silently fall back to the default agent (or `None`) until a human re-registers every number.  ## Current behaviour  `src/praisonai-bot/praisonai_bot/bots/_agent_registry.py` — the class docstring states the limitation outright, and the implementation is a bare dict:  ```python class AgentRegistry:     """A thread-unsafe, in-memory phone-number → agent routing table.      Lightweight by design: it holds references to already-constructed agents     and a normalised-number index. It performs no I/O and adds no dependencies,  
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37112335262) • [`claude/issue-5645-20261003-0914`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5645-20261003-0914) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5645-20261003-0914?quick_pull=1&title=Issue%20%235645%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235645%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Done — thread-safe AgentRegistry  - [x] Read AGENTS.md and architecture guidelines - [x] Read current `_agent_registry.py` and sibling stores - [x] Architecture validation - [x] Add thread-safety to `AgentRegistry` - [x] Add concurrency tests - [x] Run tests — **18 passed** (16 existing + 2 new) - [x] Commit, push, open PR  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5647  ### What changed Guarded the inbound phone-number→agent routing tabl

- **Issue #5640** (2026-10-03): **Sync hook/compaction paths break inside a running event loop, and DefaultSessionStore grows without bound (cache + O(n) rewrites)**
  *Symptoms*: ## Summary  An in-depth review of `src/praisonai-agents/praisonaiagents` found three gaps. All three were reproduced against the current `main` (v4.7.12). Scope is limited to core SDK runtime behaviour: robustness and performance.  ---  ## 1. Sync agent calls inside a running event loop crash whenever any hook is registered  **Where:** `hooks/runner.py:169-181` (`HookRunner.execute_sync`) is called directly from the sync hot path at about 14 sites: `chat_mixin.py:1133, 1476, 1499, 1777, 1916, 2107, 3320, 5858, 5893, 6200` and `tool_execution.py:1175, 1804, 2000, 4508`.  ```python # hooks/runner.py if loop is not None and loop.is_running():     raise RuntimeError("execute_sync() cannot be called from within a running event loop. ...") ```  `agent.start()` / `agent.chat()` are the documented "few lines" entry points. They are routinely called from inside a running loop, for example a FastAPI/aiohttp handler, Jupyter, or a bot callback. As soon as one BEFORE_LLM / BEFORE_TOOL / BEFORE_AGENT hook, plugin or guardrail is registered, the whole call fails.  **Reproduction (validated):**  ```python import asyncio from praisonaiagents import Agent from praisonaiagents.hooks import HookEvent, HookResult  agent = Agent(name="a", instructions="x", llm="gpt-4o-mini", output="silent")  @agent._hook_runner.registry.on(HookEvent.BEFORE_LLM) def deny(data):     return HookResult(decision="deny", reason="policy")  agent.start("hi")                                   # hook runs, request blocked
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37105888301) • [`claude/issue-5640-20261003-0718`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5640-20261003-0718) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5640-20261003-0718?quick_pull=1&title=Issue%20%235640%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235640%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Done — PR #5641 opened ✅  **[Create/view PR #5641](https://github.com/MervinPraison/PraisonAI/pull/5641)**  - [x] Read AGENTS.md & validate routing (Python core SDK, in-scope; minimal fixes, no new deps/public API) - [x] **Gap 1** — `hooks/runner.py` `execute_sync`: now routes through the canonical `run_coroutine_from_any_context` bridge instead of raising in a running loop. Blocking policy/guardrail hooks run **and can deny** from FastAPI/aiohttp/Jupy

- **Issue #5632** (2026-10-02): **YAML runner import failure is masked by an uninitialized guard variable**
  *Symptoms*: When the YAML runner cannot import PraisonAI from praisonai_code.cli.main, its error handler emits the import error and intends to raise typer.Exit(1). The finally block then reads _prev_in_run, which was assigned only after that import, and raises UnboundLocalError instead.  Reproduced on main a3e66c800ac8cfc95c3be6b5b959fe95c70ef766 using a provider-free test that makes that exact import raise ImportError. Both an absent PRAISONAI_IN_MODERN_RUN sentinel and an existing sentinel reproduce the failure. Expected: preserve the original diagnostic, exit 1, and leave the previous sentinel unchanged.  The fix captures the previous sentinel before entering the guarded try block. Regressions cover both previous-state cases. This also addresses review comment https://github.com/MervinPraison/PraisonAI/pull/5628#discussion_r4165496156 on code inherited from main. 
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue, @dajiaohuang!  A maintainer will review this shortly. In the meantime: - Make sure you've included steps to reproduce (for bugs) - Check [existing issues](https://github.com/MervinPraison/PraisonAI/issues) for duplicates - Review the [documentation](https://docs.praison.ai) for related guides  _Bug and enhancement reports are auto-triaged with Claude. Questions and other issues: a maintainer can comment `@claude` to trigger analysis._  **Routing:** Agent-callable tools → [PraisonAI-Tools](https://github.com/MervinPraison/PraisonAI-Tools); lifecycle plugins (tracing/hooks/guardrails) → [PraisonAI-Plugins](https://github.com/MervinPraison/PraisonAI-Plugins). TypeScript/JavaScript SDK fixes land in `src/praisonai-ts/` in this repo.
  > **Claude finished @dajiaohuang's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37010442633) • [`claude/issue-5632-20261002-1333`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5632-20261002-1333) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5632-20261002-1333?quick_pull=1&title=Issue%20%235632%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235632%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Fixed Issue #5632 ✅  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5636  - [x] Read AGENTS.md guidelines - [x] Locate the YAML runner import error handler and guard variable - [x] Understand the bug (`_prev_in_run` UnboundLocalError) - [x] Implement minimal fix - [x] Add regression tests - [x] Run tests (2 passed, 6 skipped) - [x] Commit, push, create PR  ### Root cause In `_run_from_file` (`src/praisonai-code/praisonai_code/cli/commands/run.py

- **Issue #5627** (2026-10-02): **Indexed session imports reject overwrite after portable import merges**
  *Symptoms*: The current main branch combines #5547's locked no-clobber import check with #5524's indexed-store import hook. `DefaultSessionStore.import_sessions()` now supplies `overwrite=overwrite`, but `SqliteSessionStore._save_imported_session()` does not accept that keyword.  Consequently valid imports are skipped with `import error: SqliteSessionStore._save_imported_session() got an unexpected keyword argument 'overwrite'`, including imports into empty indexed stores.  Reproduction: run `tests/unit/session/test_sqlite_import_index.py` from the agents package on main after both merges. The existing suite yields 14 failures and 9 passes. An empty-store import also returns `imported=0` instead of 1.  The indexed override should accept and forward the existing overwrite flag to the parent's locked persistence operation. Its concurrency test wrapper should forward the keyword as well. The no-clobber race regression should cover both default and indexed stores, so accepting the keyword cannot silently discard the protection. 
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue, @dajiaohuang!  A maintainer will review this shortly. In the meantime: - Make sure you've included steps to reproduce (for bugs) - Check [existing issues](https://github.com/MervinPraison/PraisonAI/issues) for duplicates - Review the [documentation](https://docs.praison.ai) for related guides  _Bug and enhancement reports are auto-triaged with Claude. Questions and other issues: a maintainer can comment `@claude` to trigger analysis._  **Routing:** Agent-callable tools → [PraisonAI-Tools](https://github.com/MervinPraison/PraisonAI-Tools); lifecycle plugins (tracing/hooks/guardrails) → [PraisonAI-Plugins](https://github.com/MervinPraison/PraisonAI-Plugins). TypeScript/JavaScript SDK fixes land in `src/praisonai-ts/` in this repo.
  > **Claude finished @dajiaohuang's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/37003102079) • [`claude/issue-5627-20261002-1210`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5627-20261002-1210) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5627-20261002-1210?quick_pull=1&title=Issue%20%235627%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235627%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Fixed issue #5627 — indexed session import overwrite keyword  - [x] Read AGENTS.md guidelines - [x] Locate `SqliteSessionStore._save_imported_session()` and `DefaultSessionStore.import_sessions()` - [x] Review the test file `tests/unit/session/test_sqlite_import_index.py` - [x] Implement minimal fix (accept/forward `overwrite` keyword) - [x] Run tests - [x] Commit, push, create PR  ### Root cause `DefaultSessionStore.import_sessions()` calls `_save_impor

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

### Incident Patch 1: `bde2501f` (2026-10-05)
**Commit Message**: fix: drain compute teardown before process exit (#5440)

* Drain compute teardown before the process bridge exits

* fix: synchronize GC-to-exit teardown handoff for compute release

Close the unsynchronised window where the GC finalizer submits the
teardown future before recording it in pending_release, letting a
concurrent exit callback return early and the bridge cancel the
in-flight shutdown. Guard both reclaim and reclaim_at_exit with a lock.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

* Coordinate release ownership and future publication at exit

* fix: retain process-owned bridge for compute cleanup

* test: collect coverage from compute exit subprocesses

---------

Co-authored-by: praisonai-triage-agent[bot] <272766704+praisonai-triage-agent[bot]@users.noreply.github.com>
Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

**File**: `src/praisonai/praisonai/integrations/compute_managed_agent.py` (modified, +79/-31)
```diff
@@ -28,11 +28,12 @@
 
 from __future__ import annotations
 
+import atexit
 import json
 import logging
 import os
 import shlex
-import sys
+import threading
 import uuid
 import weakref
 from typing import Any, Dict, List, Optional
@@ -105,6 +106,7 @@ def __init__(
         self._instance: Optional[str] = None
         self._prepared = False
         self._finalizer = None
+        self._exit_reclaimer = None
 
     @property
     def provider_name(self) -> str:
@@ -168,6 +170,9 @@ def reset_all(self) -> None:
 
     # ── lifecycle ────────────────────────────────────────────────────────────
     async def ashutdown(self) -> None:
+        if self._exit_reclaimer is not None:
+            atexit.unregister(self._exit_reclaimer)
+            self._exit_reclaimer = None
         if self._finalizer is not None:
             self._finalizer.detach()      # shutting down deliberately
             self._finalizer = None
@@ -210,6 +215,12 @@ async def _ensure(self) -> None:
         config = ComputeConfig(env=env)
         if self._image:
             config.image = self._image
+        # Start the shared bridge before registering our exit callback. atexit
+        # is LIFO: instance teardown must finish before the bridge shuts down.
+        # A backend may outlive a scoped bridge. Cleanup belongs to the
+        # process-owned bridge, independent of the finalizer's ContextVars.
+        from praisonai._async_bridge import _BG as release_bridge
+        release_bridge.get()
         info = await provider.provision(config)
         self._instance = getattr(info, "instance_id", info)
 
@@ -219,9 +230,51 @@ async def _ensure(self) -> None:
         # docker that was a container per script; for a cloud place it is a
         # billed instance whose only other reaper is the provider's own idle
         # timer, which docker and flyio do not have.
-        self._finalizer = weakref.finalize(
-            self, _release, provider, self._instance, self._place
-        )
+        instance_id, place = self._instance, self._place
+        pending_release = []
+        release_lock = threading.Lock()
+        claimed = False
+
+        def reclaim():
+            nonlocal claimed
+            with release_lock:
+                if claimed:
+                    return
+                claimed = True
+                future = _release(provider, instance_id, place, bridge=release_bridge)
+                if future is not None:
+                    pending_release.append(future)
+            if future is None:
+                atexit.unregister(reclaim_at_exit)
+            else:
+                future.add_done_callback(lambda done: atexit.unregister(reclaim_at_exit))
+
+        finalizer = weakref.finalize(self, reclaim)
+        # weakref's own exit hook cannot tell its callback that this is exit;
+        # sys.is_finalizing() is still false while atexit callbacks are running.
+        finalizer.atexit = False
+
+        def reclaim_at_exit():
+            nonlocal claimed
+            with release_lock:
+                if not claimed:
+                    claimed = True
+                    finalizer.detach()
+                    future = _release(provider, instance_id, place, bridge=release_bridge)
+                    if future is not None:
+                        pending_release.append(future)
+                else:
+                    future = pending_release[0] if pending_release else None
+            # The claim and future publication are atomic; even a finalizer
+            # that has fired but not entered reclaim cannot leave a handoff gap.
+            # Wait outside the lock so it never guards a provider round trip.
+            if future is not None:
+                _wait_for_release_at_exit(future, instance_id, place)
+            atexit.unregister(reclaim_at_exit)
+
+        self._finalizer = finalizer
+        self._exit_reclaimer = reclaim_at_exit
+        atexit.register(reclaim_at_exit)
         logger.info("[compute_managed] provisioned %s on %s", self._instance, self._place)
 
         probe = await provider.execute(self._instance, "python -c 'import praisonaiagents'", 180)
@@ -261,7 +314,7 @@ async def _write(self, path: str, content: str) -> None:
 
 
 
-def _release(provider, instance_id: str, place: str) -> None:
+def _release(provider, instance_id: str, place: str, *, bridge=None):
     """Reclaim an instance whose backend is gone.
 
     Registered with weakref.finalize, so it runs when the backend is collected
@@ -274,23 +327,21 @@ def _release(provider, instance_id: str, place: str) -> None:
     ``AsyncBridge`` — one long-lived background loop, never a fresh loop per
     teardown.
 
-    Exit-safety: ``weakref.finalize`` fires at interpreter shutdown too, where
-    fire-and-forget is unsafe — the bridge's own ``atexit`` teardown can cancel
-    the in-flight shutdown, or its daemon loop thread can be killed, before the
-    cloud round-trip lands, leaking a provisioned instance. So wh
```

**File**: `src/praisonai/tests/unit/test_compute_release_exit.py` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+"""Process-exit teardown must finish before the shared bridge stops."""
+
+import os
+from pathlib import Path
+import subprocess
+import sys
+
+import pytest
+
+
+CHILD = r'''
+import os
+coverage_file = os.environ.get("PRAISONAI_EXIT_TEST_COVERAGE_FILE")
+if coverage_file:
+    import atexit
+    from coverage import Coverage
+    if Coverage.current() is None:
+        child_coverage = Coverage(data_file=coverage_file, data_suffix=True, source=["praisonai"])
+        child_coverage.start()
+        def save_child_coverage():
+            child_coverage.stop()
+            child_coverage.save()
+        # Registered before runtime cleanup: tracing stops after the real
+        # exit callbacks have run, including their background teardown.
+        atexit.register(save_child_coverage)
+import asyncio
+from pathlib import Path
+import sys
+from praisonai._async_bridge import current_bridge, scoped_bridge
+from praisonai.integrations.compute_managed_agent import ComputeManagedAgent
+from praisonaiagents.managed.protocols import InstanceInfo, InstanceStatus
+
+marker = Path(sys.argv[1])
+mode = sys.argv[2]
+if mode == "warm":
+    current_bridge().get()
+
+class Provider:
+    async def provision(self, config):
+        return InstanceInfo(instance_id="exit-instance", status=InstanceStatus.RUNNING,
+                            provider="fake")
+    async def execute(self, *args):
+        return {"exit_code": 0}
+    async def shutdown(self, instance_id):
+        await asyncio.sleep(60 if mode == "hung" else 0.05)
+        with marker.open("a", encoding="utf-8") as output:
+            output.write(instance_id + "\n")
+
+backend = ComputeManagedAgent("docker")
+backend._provider = Provider()
+if mode == "scoped":
+    with scoped_bridge():
+        asyncio.run(backend._ensure())
+    # Cleanup must use an already-running process-owned bridge after the
+    # scope-owned bridge closes. Model hosts that forbid late thread startup.
+    import threading
+    def forbid_late_thread_start(self):
+        raise RuntimeError("late thread startup is forbidden")
+    threading.Thread.start = forbid_late_thread_start
+else:
+    asyncio.run(backend._ensure())
+if mode == "explicit":
+    asyncio.run(backend.ashutdown())
+elif mode == "gc":
+    import gc
+    del backend
+    gc.collect()
+elif mode == "race":
+    import threading
+    from praisonai.integrations import compute_managed_agent as module
+
+    entered = threading.Event()
+    allow_submission = threading.Event()
+    original_release = module._release
+
+    def delayed_release(*args, **kwargs):
+        entered.set()
+        assert allow_submission.wait(5)
+        return original_release(*args, **kwargs)
+
+    module._release = delayed_release
+    exit_callback = backend._exit_reclaimer
+    holder = [backend]
+    del backend
+    worker = threading.Thread(target=lambda: holder.pop())
+    worker.start()
+    assert entered.wait(5)
+    timer = threading.Timer(0.1, allow_submission.set)
+    timer.start()
+    try:
+        # GC is inside _release but has not published its future yet.
+        exit_callback()
+        assert marker.exists(), "exit missed the in-progress GC handoff"
+    finally:
+        allow_submission.set()
+        worker.join(5)
+        timer.join(5)
+'''
+
+
+def _child(tmp_path, mode):
+    root = Path(__file__).resolve().parents[4]
+    marker = tmp_path / "released.txt"
+    env = dict(os.environ)
+    env["PYTHONPATH"] = os.pathsep.join(
+        [str(p) for p in (root / "src").iterdir() if p.is_dir()]
+        + [env.get("PYTHONPATH", "")]
+    )
+    env["PRAISONAI_COMPUTE_RELEASE_EXIT_TIMEOUT"] = "0.2" if mode == "hung" else "2"
+    env.pop("PRAISONAI_EXIT_TEST_COVERAGE_FILE", None)
+    try:
+        from coverage import Coverage
+    except ImportError:
+        pass
+    else:
+        active_coverage = Coverage.current()
+        if active_coverage is not None:
+            # pytest-cov combines parallel data files when its parent run ends.
+            env["PRAISONAI_EXIT_TEST_COVERAGE_FILE"] = str(
+                Path(active_coverage.config.data_file).resolve()
+            )
+    result = subprocess.run(
+        [sys.executable, "-c", CHILD, str(marker), mode], env=env,
+        capture_output=True, text=True, timeout=10,
+    )
+    assert result.returncode == 0, result.stderr
+    return marker, result
+
+
+@pytest.mark.parametrize("mode", ["warm", "cold", "explicit", "gc", "race", "scoped"])
+def test_exit_reclaims_instance_once(tmp_path, mode):
+    marker, result = _child(tmp_path, mode)
+    assert marker.exists(), result.stderr
+    assert marker.read_text(encoding="utf-8").splitlines() == ["exit-instance"]
+
+
+def test_hung_exit_release_is_bounded(tmp_path):
+    marker, result = _child(tmp_path, "hung")
+    assert not marker.exists()
+    assert "could not release" in result.stderr
```

---

### Incident Patch 2: `f02e58fe` (2026-10-05)
**Commit Message**: fix: harden ACP session store, atomic JSON writes, and scheduler PID safety (#5660)

* fix: harden ACP session store, atomic JSON writes, and scheduler PID safety (fixes #5659)

Three validated correctness gaps in src/praisonai/praisonai/:

1. ACP SessionStore: validate client-supplied session_id against a
   server-minted format before interpolating into a filesystem path
   (blocks arbitrary *.json read/delete via traversal) and write session
   files + the .last_session pointer atomically.

2. Non-atomic JSON writes: route JSONConversationStore and
   SchedulerStateManager saves through atomic temp-file + os.replace so a
   crash/Ctrl-C mid-write can't zero conversation history or scheduler
   state; sanitize session_id / name before filename interpolation
   (reuses the existing _atomic_write_json helper for scheduler state).

3. Scheduler lifecycle races: record process start_time and compare it in
   is_process_alive / stop_daemon so a recycled PID is never signalled
   (prevents killing an innocent process), and make generate_unique_name
   race-free via O_CREAT|O_EXCL.

Changes are backward-compatible (start_time optional) and reuse existing
in-tree helpers/patterns; no new

**File**: `src/praisonai/praisonai/acp/session.py` (modified, +55/-12)
```diff
@@ -6,6 +6,9 @@
 
 import json
 import logging
+import os
+import re
+import tempfile
 import time
 import uuid
 from dataclasses import dataclass, field
@@ -14,6 +17,23 @@
 
 logger = logging.getLogger(__name__)
 
+# Matches the ids minted by ``ACPSession.create`` (``sess_`` + 16 hex chars).
+# Allowing up to 32 hex chars keeps forward-compat if the id width grows.
+_SESSION_ID_RE = re.compile(r"^sess_[0-9a-f]{1,32}$")
+
+
+def _validate_session_id(session_id: str) -> str:
+    """Reject anything that is not a server-minted session id.
+
+    ``session_id`` arrives over JSON-RPC from an external peer and is
+    interpolated into a filesystem path, so an unvalidated value like
+    ``"../../tmp/secret"`` would let the peer read or delete arbitrary
+    ``*.json`` files. Only ids matching the ``create()`` format are allowed.
+    """
+    if not isinstance(session_id, str) or not _SESSION_ID_RE.match(session_id):
+        raise ValueError(f"invalid session_id: {session_id!r}")
+    return session_id
+
 
 @dataclass
 class ACPSession:
@@ -124,23 +144,46 @@ def __init__(self, storage_dir: Optional[Path] = None):
         self._last_session_file = self.storage_dir / ".last_session"
     
     def _session_path(self, session_id: str) -> Path:
-        """Get path for session file."""
-        return self.storage_dir / f"{session_id}.json"
-    
+        """Get path for session file (validated against traversal)."""
+        _validate_session_id(session_id)
+        # ``resolve`` anchors the path so a future id-format change can't
+        # silently re-open the traversal hole.
+        return (self.storage_dir / f"{session_id}.json").resolve()
+
+    @staticmethod
+    def _atomic_write(path: Path, text: str) -> None:
+        """Write ``text`` to ``path`` atomically via a temp file + os.replace.
+
+        A crash or Ctrl-C mid-write can never leave the target empty or
+        half-written — the old content survives until the rename succeeds.
+        """
+        path.parent.mkdir(parents=True, exist_ok=True)
+        fd, tmp = tempfile.mkstemp(prefix=".sess-", suffix=".tmp", dir=str(path.parent))
+        try:
+            with os.fdopen(fd, "w") as f:
+                f.write(text)
+                f.flush()
+                os.fsync(f.fileno())
+            os.replace(tmp, path)
+        except BaseException:
+            try:
+                os.unlink(tmp)
+            except OSError:
+                pass
+            raise
+
     def save(self, session: ACPSession) -> None:
-        """Save session to disk."""
+        """Save session to disk atomically."""
         try:
             path = self._session_path(session.session_id)
-            with open(path, "w") as f:
-                json.dump(session.to_dict(), f, indent=2)
-            
-            # Update last session pointer
-            with open(self._last_session_file, "w") as f:
-                f.write(session.session_id)
-            
+            self._atomic_write(path, json.dumps(session.to_dict(), indent=2))
+
+            # Update last session pointer ONLY after the payload is durable.
+            self._atomic_write(self._last_session_file, session.session_id)
+
             logger.debug(f"Saved session {session.session_id}")
         except Exception as e:
-            logger.error(f"Failed to save session: {e}")
+            logger.error(f"Failed to save session {session.session_id}: {e}")
     
     def load(self, session_id: str) -> Optional[ACPSession]:
         """Load session from disk."""
```

**File**: `src/praisonai/praisonai/cli/commands/schedule.py` (modified, +1/-1)
```diff
@@ -372,7 +372,7 @@ def _daemon_states_payload() -> list:
                 "source": "daemon",
                 "name": s.get("name", "unknown"),
                 "pid": pid,
-                "status": "running" if state_manager.is_process_alive(pid) else "stopped",
+                "status": "running" if state_manager.is_process_alive(pid, s.get("start_time")) else "stopped",
                 "interval": s.get("interval", "unknown"),
                 "task": s.get("task", ""),
             })
```

**File**: `src/praisonai/praisonai/cli/features/agent_scheduler.py` (modified, +26/-9)
```diff
@@ -74,7 +74,18 @@ def _handle_start(args, unknown_args, state_manager, daemon_manager) -> int:
         
         # Parse arguments
         name = unknown_args[0]
-        
+
+        # Validate the name BEFORE launching any daemon: save_state rejects an
+        # unsafe name, and launching first would orphan a running daemon with no
+        # state file the CLI could use to stop it.
+        from praisonai.scheduler.state_manager import _validate_name
+        try:
+            _validate_name(name)
+        except ValueError:
+            print(f"❌ Error: Invalid scheduler name {name!r}")
+            print("   Use letters, digits, '_', '-', '.' (max 128 chars, no '..').")
+            return 1
+
         # Check for --recipe flag in unknown_args
         recipe_name = None
         task = None
@@ -96,9 +107,13 @@ def _handle_start(args, unknown_args, state_manager, daemon_manager) -> int:
         max_cost = getattr(args, 'max_cost', None)
         deliver = getattr(args, 'schedule_deliver', None) or ''
         
-        # Check if name already exists
+        # Check if name already exists. Use is_process_alive with the recorded
+        # start_time (not a PID-only probe) so a stale state whose PID was reused
+        # by an unrelated process does not falsely block a fresh start.
         existing = state_manager.load_state(name)
-        if existing and daemon_manager.get_status(existing.get('pid', 0))['is_alive']:
+        if existing and state_manager.is_process_alive(
+            existing.get('pid', 0), existing.get('start_time')
+        ):
             print(f"❌ Error: Scheduler '{name}' is already running (PID: {existing['pid']})")
             print(f"   Use 'praisonai schedule stop {name}' to stop it first")
             return 1
@@ -177,7 +192,7 @@ def _handle_list(state_manager) -> int:
         for state in states:
             name = state.get('name', 'unknown')[:20]
             pid = state.get('pid', 0)
-            status = "running" if state_manager.is_process_alive(pid) else "stopped"
+            status = "running" if state_manager.is_process_alive(pid, state.get('start_time')) else "stopped"
             interval = state.get('interval', 'unknown')[:12]
             task = state.get('task', '')[:40]
             
@@ -261,7 +276,7 @@ def _handle_stop_all(state_manager, daemon_manager) -> int:
             pid = state['pid']
             
             try:
-                if daemon_manager.stop_daemon(pid):
+                if daemon_manager.stop_daemon(pid, expected_start_time=state.get('start_time')):
                     state_manager.delete_state(name)
                     print(f"✅ Stopped '{name}' (PID: {pid})")
                     stopped += 1
@@ -298,7 +313,7 @@ def _handle_stop(unknown_args, state_manager, daemon_manager) -> int:
         
         print(f"🛑 Stopping scheduler '{name}' (PID: {pid})...")
         
-        success = daemon_manager.stop_daemon(pid)
+        success = daemon_manager.stop_daemon(pid, expected_start_time=state.get('start_time'))
         
         if success:
             state['status'] = 'stopped'
@@ -365,8 +380,9 @@ def _handle_restart(unknown_args, state_manager, daemon_manager) -> int:
         
         # Stop if running
         pid = state.get('pid')
-        if pid and state_manager.is_process_alive(pid):
-            daemon_manager.stop_daemon(pid)
+        start_time = state.get('start_time')
+        if pid and state_manager.is_process_alive(pid, start_time):
+            daemon_manager.stop_daemon(pid, expected_start_time=start_time)
             time.sleep(1)
         
         # Start again
@@ -384,6 +400,7 @@ def _handle_restart(unknown_args, state_manager, daemon_manager) -> int:
         state['pid'] = new_pid
         state['status'] = 'running'
         state['started_at'] = datetime.now().isoformat()
+        state.pop('start_time', None)  # let save_state record the new process's identity
         state_manager.save_state(name, state)
         
         print(f"✅ Scheduler '{name}' restarted (PID: {new_pid})")
@@ -426,7 +443,7 @@ def _handle_describe(unknown_args, state_manager, daemon_manager) -> int:
         
         # Get process status
         pid = state.get('pid', 0)
-        is_alive = state_manager.is_process_alive(pid)
+        is_alive = state_manager.is_process_alive(pid, state.get('start_time'))
         status = "🟢 running" if is_alive else "🔴 stopped"
         
         # Calculate uptime
```

**File**: `src/praisonai/praisonai/persistence/conversation/json_store.py` (modified, +57/-14)
```diff
@@ -7,6 +7,9 @@
 
 import json
 import logging
+import os
+import re
+import tempfile
 import time
 from pathlib import Path
 from typing import Dict, List, Optional
@@ -16,6 +19,54 @@
 
 logger = logging.getLogger(__name__)
 
+# Reject ids that could escape the storage dir (path separators, ``..``) before
+# interpolating them into a filename. External ids reach here via
+# api/agent_invoke -> PraisonAIDB -> JSONConversationStore.
+_ID_RE = re.compile(r"^[A-Za-z0-9_\-:.]{1,128}$")
+
+# The store keeps its own index at ``_sessions_index.json``; a session id that
+# maps to the same file would let create/update silently overwrite the index
+# (and vice versa), corrupting every session's listing. Reserve it.
+_RESERVED_IDS = frozenset({"_sessions_index"})
+
+
+def _validate_id(session_id: str) -> str:
+    """Reject a session id that is unsafe as a filesystem path component."""
+    if (
+        not isinstance(session_id, str)
+        or ".." in session_id
+        or session_id in _RESERVED_IDS
+        or not _ID_RE.match(session_id)
+    ):
+        raise ValueError(f"invalid session id for filesystem storage: {session_id!r}")
+    return session_id
+
+
+def _atomic_write_json(path: Path, payload, pretty: bool = True) -> None:
+    """Write JSON to ``path`` atomically (temp file + os.replace).
+
+    A crash / Ctrl-C mid-write can never leave the file empty or truncated,
+    which would otherwise silently zero a session's conversation history on the
+    next load.
+    """
+    path.parent.mkdir(parents=True, exist_ok=True)
+    fd, tmp = tempfile.mkstemp(prefix=".conv-", suffix=".tmp", dir=str(path.parent))
+    try:
+        with os.fdopen(fd, "w") as f:
+            if pretty:
+                json.dump(payload, f, indent=2, default=str)
+            else:
+                json.dump(payload, f, default=str)
+            f.flush()
+            os.fsync(f.fileno())
+        os.replace(tmp, path)
+    except BaseException:
+        try:
+            os.unlink(tmp)
+        except OSError:
+            pass
+        raise
+
 
 class JSONConversationStore(ConversationStore):
     """
@@ -61,16 +112,12 @@ def _load_index(self):
             self._save_index()
     
     def _save_index(self):
-        """Save sessions index."""
-        with open(self._index_file, 'w') as f:
-            if self.pretty:
-                json.dump(self._index, f, indent=2, default=str)
-            else:
-                json.dump(self._index, f, default=str)
+        """Save sessions index atomically."""
+        _atomic_write_json(self._index_file, self._index, self.pretty)
     
     def _session_file(self, session_id: str) -> Path:
-        """Get path to session file."""
-        return self.path / f"{session_id}.json"
+        """Get path to session file (validated against traversal)."""
+        return self.path / f"{_validate_id(session_id)}.json"
     
     def _load_session_data(self, session_id: str) -> Optional[Dict]:
         """Load session data from file."""
@@ -81,13 +128,9 @@ def _load_session_data(self, session_id: str) -> Optional[Dict]:
         return None
     
     def _save_session_data(self, session_id: str, data: Dict):
-        """Save session data to file."""
+        """Save session data to file atomically."""
         file_path = self._session_file(session_id)
-        with open(file_path, 'w') as f:
-            if self.pretty:
-                json.dump(data, f, indent=2, default=str)
-            else:
-                json.dump(data, f, default=str)
+        _atomic_write_json(file_path, data, self.pretty)
     
     def create_session(self, session: ConversationSession) -> ConversationSession:
         """Create a new session."""
```

**File**: `src/praisonai/praisonai/scheduler/daemon_manager.py` (modified, +35/-2)
```diff
@@ -29,6 +29,22 @@ def __init__(self, log_dir: Optional[Path] = None, max_log_size_mb: float = 10.0
         self.log_dir = Path(log_dir)
         self.log_dir.mkdir(parents=True, exist_ok=True)
         self.max_log_size_bytes = int(max_log_size_mb * 1024 * 1024)
+
+    @staticmethod
+    def _owns_pid(pid: int, expected_start_time: Optional[float]) -> bool:
+        """Whether it's safe to signal ``pid`` as our daemon.
+
+        When ``expected_start_time`` is recorded, the process's actual start
+        time must match; a recycled PID owned by an unrelated process is refused
+        so we never SIGTERM/SIGKILL an innocent process.
+        """
+        if expected_start_time is None:
+            return True  # Backward-compatible: nothing recorded to verify.
+        from .state_manager import _process_start_time
+        actual = _process_start_time(pid)
+        if actual is None:
+            return False  # Can't prove ownership; fail safe.
+        return abs(actual - expected_start_time) < 1.0
     
     def start_daemon(
         self,
@@ -126,17 +142,23 @@ def start_scheduler_daemon(
         display_task = recipe_name or task
         return self.start_daemon(name, display_task, interval, command)
     
-    def stop_daemon(self, pid: int, timeout: int = 10) -> bool:
+    def stop_daemon(self, pid: int, timeout: int = 10, expected_start_time: Optional[float] = None) -> bool:
         """
         Stop a daemon process gracefully.
         
         Args:
             pid: Process ID
             timeout: Timeout in seconds
+            expected_start_time: Start time recorded for the daemon. When given,
+                the process is only signalled if its actual start time matches —
+                guarding against SIGTERM/SIGKILL hitting an innocent process that
+                now owns a recycled PID.
             
         Returns:
             True if stopped successfully
         """
+        if not self._owns_pid(pid, expected_start_time):
+            return False
         try:
             # Try graceful shutdown first (SIGTERM)
             os.kill(pid, signal.SIGTERM)
@@ -150,6 +172,10 @@ def stop_daemon(self, pid: int, timeout: int = 10) -> bool:
                 except (OSError, ProcessLookupError):
                     return True  # Process terminated
             
+            # Re-verify ownership before escalating: the daemon may have exited
+            # during the wait and its PID been reused by an unrelated process.
+            if not self._owns_pid(pid, expected_start_time):
+                return True
             # Force kill if still alive
             try:
                 os.kill(pid, signal.SIGKILL)
@@ -162,17 +188,20 @@ def stop_daemon(self, pid: int, timeout: int = 10) -> bool:
         except (OSError, ProcessLookupError):
             return False
 
-    async def astop_daemon(self, pid: int, timeout: int = 10) -> bool:
+    async def astop_daemon(self, pid: int, timeout: int = 10, expected_start_time: Optional[float] = None) -> bool:
         """
         Async variant of stop_daemon — never blocks the event loop.
         
         Args:
             pid: Process ID
             timeout: Timeout in seconds
+            expected_start_time: Start time recorded for the daemon (see stop_daemon).
             
         Returns:
             True if stopped successfully
         """
+        if not self._owns_pid(pid, expected_start_time):
+            return False
         try:
             # Try graceful shutdown first (SIGTERM)
             os.kill(pid, signal.SIGTERM)
@@ -185,6 +214,10 @@ async def astop_daemon(self, pid: int, timeout: int = 10) -> bool:
                 except (OSError, ProcessLookupError):
                     return True  # Process terminated
             
+            # Re-verify ownership before escalating: the daemon may have exited
+            # during the wait and its PID been reused by an unrelated process.
+            if not self._owns_pid(pid, expected_start_time):
+                return True
             # Force kill if still alive
             try:
                 os.kill(pid, signal.SIGKILL)
```

**File**: `src/praisonai/praisonai/scheduler/state_manager.py` (modified, +87/-17)
```diff
@@ -3,11 +3,40 @@
 """
 import json
 import os
+import re
 import signal
 from pathlib import Path
 from typing import Dict, List, Optional
 from datetime import datetime
 
+from ._base_scheduler import _atomic_write_json
+
+# A scheduler name is interpolated into a filename; reject path separators and
+# ``..`` so a crafted name can't escape the state directory.
+_NAME_RE = re.compile(r"^[A-Za-z0-9_\-.]{1,128}$")
+
+
+def _validate_name(name: str) -> str:
+    """Reject a scheduler name that is unsafe as a filesystem path component."""
+    if not isinstance(name, str) or ".." in name or not _NAME_RE.match(name):
+        raise ValueError(f"invalid scheduler name for filesystem storage: {name!r}")
+    return name
+
+
+def _process_start_time(pid: int) -> Optional[float]:
+    """Return the process start time (clock ticks since boot) or None.
+
+    Used to distinguish "the same process we started" from "a different process
+    that now owns a recycled PID". Linux ``/proc`` only; returns None on any
+    error so callers can conservatively treat the PID as not ours.
+    """
+    try:
+        with open(f"/proc/{pid}/stat") as f:
+            fields = f.read().rsplit(") ", 1)[1].split()
+        return float(fields[19])  # starttime
+    except (OSError, ValueError, IndexError):
+        return None
+
 
 class SchedulerStateManager:
     """Manages persistent state for scheduler processes."""
@@ -34,10 +63,18 @@ def save_state(self, name: str, state: Dict) -> None:
             name: Scheduler name
             state: State dictionary to save
         """
+        _validate_name(name)
         state_file = self.state_dir / f"{name}.json"
-        
-        with open(state_file, 'w') as f:
-            json.dump(state, f, indent=2)
+
+        # Record the owning process's start time so a later PID-reuse can be
+        # detected (see is_process_alive). Only when a live pid is present.
+        pid = state.get("pid")
+        if isinstance(pid, int) and "start_time" not in state:
+            start_time = _process_start_time(pid)
+            if start_time is not None:
+                state = {**state, "start_time": start_time}
+
+        _atomic_write_json(str(state_file), state)
     
     def load_state(self, name: str) -> Optional[Dict]:
         """
@@ -49,6 +86,10 @@ def load_state(self, name: str) -> Optional[Dict]:
         Returns:
             State dictionary or None if not found
         """
+        try:
+            _validate_name(name)
+        except ValueError:
+            return None
         state_file = self.state_dir / f"{name}.json"
         
         if not state_file.exists():
@@ -70,6 +111,12 @@ def delete_state(self, name: str) -> bool:
         Returns:
             True if deleted, False if not found
         """
+        try:
+            _validate_name(name)
+        except ValueError:
+            # A crafted name must never traverse out of the state dir to
+            # unlink an arbitrary ``*.json`` file.
+            return False
         state_file = self.state_dir / f"{name}.json"
         
         if state_file.exists():
@@ -99,40 +146,62 @@ def list_all(self) -> List[Dict]:
     
     def generate_unique_name(self, base_name: str = "scheduler") -> str:
         """
-        Generate a unique scheduler name.
-        
+        Atomically claim a unique scheduler name.
+
+        Uses ``O_CREAT | O_EXCL`` to create a placeholder state file so two
+        concurrent ``schedule start`` invocations can never both pick the same
+        name and orphan each other's daemon (TOCTOU). The real state is written
+        afterwards via :meth:`save_state`.
+
         Args:
             base_name: Base name for the scheduler
-            
+
         Returns:
             Unique name like "scheduler-0", "scheduler-1", etc.
         """
-        existing_states = self.list_all()
-        existing_names = {s.get("name", "") for s in existing_states}
-        
+        _validate_name(base_name)
         counter = 0
         while True:
             name = f"{base_name}-{counter}"
-            if name not in existing_names:
+            path = self.state_dir / f"{name}.json"
+            try:
+                fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
+                os.close(fd)
                 return name
-            counter += 1
+            except FileExistsError:
+                counter += 1
     
-    def is_process_alive(self, pid: int) -> bool:
+    def is_process_alive(self, pid: int, expected_start_time: Optional[float] = None) -> bool:
         """
         Check if a process is still alive.
-        
+
+        When ``expected_start_time`` is provided (recorded by :meth:`save_state`),
+        the process's actual start time is compared so a recycled PID now owned by
+        an unrelated process is reported as *not* alive — preventing
+        ``stop_daemon`` from signalling an innocent process.
+
         Args:
             pid: Process I
```

---

### Incident Patch 3: `cfa1d131` (2026-10-05)
**Commit Message**: fix: retain indexed session routes when clearing turns (#5522)

Merged after rebase onto current main with minimal sqlite_store fix (stop de-indexing on clear_session).

**File**: `src/praisonai-agents/praisonaiagents/session/sqlite_store.py` (modified, +0/-6)
```diff
@@ -613,12 +613,6 @@ def add_message(
                 logger.debug("Post-add index refresh failed for %s: %s", session_id, exc)
         return ok
 
-    def clear_session(self, session_id: str) -> bool:
-        ok = super().clear_session(session_id)
-        if ok:
-            self._deindex_session(session_id)
-        return ok
-
     def delete_session(self, session_id: str) -> bool:
         ok = super().delete_session(session_id)
         if ok:
```

**File**: `src/praisonai-agents/tests/unit/session/test_session_index_atomic_refresh.py` (modified, +6/-0)
```diff
@@ -21,6 +21,12 @@ def test_wal_reader_retains_session_during_or_after_failed_index_refresh(tmp_pat
         conn = store._conn
         session = store._read_session_fresh("session")
         session.messages[0].content = "needle new"
+        # Refresh indexes the committed file generation, not a caller's
+        # possibly stale object. Persist the new transcript without refreshing
+        # its index so the WAL reader still starts with the old index row.
+        assert store._atomic_write_json(
+            store._get_session_path("session"), session.to_dict()
+        )
         reader = sqlite3.connect(store.db_path, isolation_level=None)
 
         class PausedConnection:
```

**File**: `src/praisonai-agents/tests/unit/session/test_sqlite_clear_lifecycle.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Clearing active turns preserves the session's routing and archived recall."""
+
+import pytest
+import threading
+from concurrent.futures import ThreadPoolExecutor
+
+from praisonaiagents.session.sqlite_store import SqliteSessionStore
+from praisonaiagents.session.store import DefaultSessionStore
+
+
+@pytest.fixture
+def make_store(tmp_path):
+    stores = []
+
+    def create(kind, **kwargs):
+        store = kind(session_dir=str(tmp_path / str(len(stores))), **kwargs)
+        stores.append(store)
+        return store
+
+    yield create
+    for store in stores:
+        conn = getattr(store, "_conn", None)
+        if conn is not None:
+            conn.close()
+
+
+@pytest.mark.parametrize("kind", [DefaultSessionStore, SqliteSessionStore])
+@pytest.mark.parametrize("warm", ["cold", "search", "route"])
+def test_clear_preserves_gateway_and_agent_routes(make_store, kind, warm):
+    store = make_store(kind)
+    assert store.add_message("session", "user", "pelican notes")
+    assert store.set_gateway_info("session", gateway_session_id="gateway", agent_id="agent")
+    if warm == "search":
+        assert store.search("pelican")
+    elif warm == "route":
+        assert store.get_by_gateway_session("gateway") is not None
+
+    assert store.clear_session("session")
+    session = store.get_session("session")
+    assert session.messages == []
+    assert session.gateway_session_id == "gateway"
+    assert session.agent_id == "agent"
+    found = store.get_by_gateway_session("gateway")
+    assert found is not None and found.session_id == "session"
+    assert store.list_sessions_by_gateway_agent("agent") == ["session"]
+    assert store.search("pelican") == []
+
+    assert store.add_message("session", "user", "narwhal notes")
+    assert [hit.session_id for hit in store.search("narwhal")] == ["session"]
+    assert store.delete_session("session")
+    assert store.get_by_gateway_session("gateway") is None
+    assert store.list_sessions_by_gateway_agent("agent") == []
+    assert store.search("narwhal") == []
+
+
+@pytest.mark.parametrize("kind", [DefaultSessionStore, SqliteSessionStore])
+def test_clear_keeps_archived_turns_searchable(make_store, kind):
+    store = make_store(kind, active_window=3)
+    assert store.add_message("session", "user", "archived pelican marker")
+    for index in range(8):
+        assert store.add_message("session", "user", f"later turn {index}")
+    before = store.get_session("session")
+    assert any("pelican" in message.content for message in before.archived_messages)
+    assert store.search("pelican")
+
+    assert store.clear_session("session")
+    after = store.get_session("session")
+    assert after.messages == []
+    assert after.archived_messages == before.archived_messages
+    hits = store.search("pelican")
+    assert [hit.session_id for hit in hits] == ["session"]
+    assert any(message["archived"] for message in hits[0].messages)
+
+
+@pytest.mark.parametrize("separate_store", [False, True])
+def test_delete_before_clear_index_refresh_does_not_restore_route(make_store, monkeypatch, separate_store):
+    store = make_store(SqliteSessionStore)
+    assert store.add_message("session", "user", "pelican notes")
+    assert store.set_gateway_info("session", gateway_session_id="gateway", agent_id="agent")
+    assert store.get_by_gateway_session("gateway") is not None
+    deleting = store
+    if separate_store:
+        deleting = SqliteSessionStore(session_dir=store.session_dir, db_path=store.db_path)
+        assert deleting.get_by_gateway_session("gateway") is not None
+
+    read_complete = threading.Event()
+    resume = threading.Event()
+    original = store._index_session
+
+    def delayed_index(session):
+        read_complete.set()
+        assert resume.wait(5), "delete did not release the delayed refresh"
+        original(session)
+
+    monkeypatch.setattr(store, "_index_session", delayed_index)
+    try:
+        with ThreadPoolExecutor(max_workers=1) as executor:
+            clearing = executor.submit(store.clear_session, "session")
+            try:
+                assert read_complete.wait(5), "clear did not reach index refresh"
+                assert deleting.delete_session("session")
+            finally:
+                resume.set()
+            assert clearing.result(timeout=5)
+        assert not store.session_exists("session")
+        assert store.list_sessions_by_gateway_agent("agent") == []
+        assert store.get_by_gateway_session("gateway") is None
+    finally:
+        if separate_store and deleting._conn is not None:
+            deleting._conn.close()
```

---

### Incident Patch 4: `2135d031` (2026-10-05)
**Commit Message**: fix: isolate provider tool additions to each request (#5451)

**File**: `src/praisonai-agents/praisonaiagents/llm/llm.py` (modified, +5/-12)
```diff
@@ -6994,10 +6994,7 @@ def _build_completion_params(self, **override_params) -> Dict[str, Any]:
                 web_fetch_tool['max_uses'] = 5
             
             # Add web_fetch tool to existing tools or create tools list
-            if 'tools' in params and params['tools']:
-                params['tools'].append(web_fetch_tool)
-            else:
-                params['tools'] = [web_fetch_tool]
+            params['tools'] = list(params.get('tools') or []) + [web_fetch_tool]
             
             logging.debug(f"Web fetch enabled with tool: {web_fetch_tool}")
         
@@ -7009,17 +7006,13 @@ def _build_completion_params(self, **override_params) -> Dict[str, Any]:
                 memory_tool_def = memory_tool.get_tool_definition()
                 
                 # Add memory tool to existing tools or create tools list
-                if 'tools' in params and params['tools']:
-                    params['tools'].append(memory_tool_def)
-                else:
-                    params['tools'] = [memory_tool_def]
+                params['tools'] = list(params.get('tools') or []) + [memory_tool_def]
                 
                 # Add the beta header for Anthropic
                 beta_header = memory_tool.get_beta_header()
-                if 'extra_headers' in params:
-                    params['extra_headers']['anthropic-beta'] = beta_header
-                else:
-                    params['extra_headers'] = {'anthropic-beta': beta_header}
+                extra_headers = dict(params.get('extra_headers') or {})
+                extra_headers['anthropic-beta'] = beta_header
+                params['extra_headers'] = extra_headers
                 
                 logging.debug(f"Claude memory tool enabled with beta header: {beta_header}")
         
```

**File**: `src/praisonai-agents/tests/unit/llm/test_provider_tool_request_ownership.py` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+"""Provider additions must belong to the request rather than its caller."""
+
+from copy import deepcopy
+from types import SimpleNamespace
+
+import pytest
+
+from praisonaiagents.llm.llm import LLM
+
+
+def memory_tool():
+    return SimpleNamespace(
+        get_tool_definition=lambda: {'type': 'memory_20250818', 'name': 'memory'},
+        get_beta_header=lambda: 'context-management-2025-06-27',
+    )
+
+
+@pytest.mark.parametrize('source', ['override', 'settings'])
+@pytest.mark.parametrize('web_fetch', [False, True])
+@pytest.mark.parametrize('memory', [False, True])
+def test_provider_tool_additions_do_not_mutate_inputs(source, web_fetch, memory):
+    tools = [{'type': 'function', 'function': {'name': 'local_tool'}}]
+    original = deepcopy(tools)
+    llm = LLM(model='anthropic/claude-sonnet-4-5', web_fetch=web_fetch,
+              **({'tools': tools} if source == 'settings' else {}))
+    llm._supports_claude_memory = lambda: memory
+    llm._get_claude_memory_tool = memory_tool
+    overrides = {'tools': tools} if source == 'override' else {}
+    first = llm._build_completion_params(**overrides)
+    first_snapshot = deepcopy(first['tools'])
+    second = llm._build_completion_params(**overrides)
+    assert tools == original
+    assert first['tools'] == first_snapshot
+    assert second['tools'] == first_snapshot
+    assert len(second['tools']) == 1 + int(web_fetch) + int(memory)
+
+
+@pytest.mark.parametrize('source', ['override', 'settings'])
+def test_memory_beta_header_does_not_mutate_input_headers(source):
+    headers = {'x-custom': 'keep'}
+    llm = LLM(model='anthropic/claude-sonnet-4-5',
+              **({'extra_headers': headers} if source == 'settings' else {}))
+    llm._supports_claude_memory = lambda: True
+    llm._get_claude_memory_tool = memory_tool
+    result = llm._build_completion_params(
+        **({'extra_headers': headers} if source == 'override' else {}),
+    )
+    assert headers == {'x-custom': 'keep'}
+    assert result['extra_headers'] == {
+        'x-custom': 'keep', 'anthropic-beta': 'context-management-2025-06-27',
+    }
```

---

### Incident Patch 5: `1424ca01` (2026-10-05)
**Commit Message**: fix: add resolved-config snapshot/export for gateway (fixes #5646) (#5648)

A running gateway's posture was split between the declared gateway.yaml and a
hidden per-host:port start-flags side file, so the YAML never described how the
gateway was actually running and no command rendered the resolved, merged,
redacted configuration. Add resolve_effective_config()/export_effective_config()
(wrapper) that merge declared YAML with the persisted CLI overrides into one
promotable document, and a `praisonai gateway config --resolved/--export` CLI.
Secrets are redacted by default via the existing diagnostics _SECRET_KEYS set
while non-secret values are preserved so the output stays a usable, commitable
config.

Co-authored-by: praisonai-triage-agent[bot] <272766704+praisonai-triage-agent[bot]@users.noreply.github.com>
Co-authored-by: MervinPraison <[REDACTED_EMAIL]>

**File**: `src/praisonai-bot/praisonai_bot/cli/commands/gateway.py` (modified, +77/-0)
```diff
@@ -2021,6 +2021,82 @@ def gateway_schema(
         sys.stdout.write(schema_json + "\n")
 
 
+@app.command("config")
+def gateway_config(
+    host: str = typer.Option("127.0.0.1", "--host", help="Gateway host (keys the persisted start-flags)"),
+    port: Optional[int] = typer.Option(None, "--port", help="Gateway port (keys the persisted start-flags)"),
+    config: Optional[str] = typer.Option(
+        None, "--config", "-c",
+        help="Declared gateway.yaml to merge (default: the file the running "
+        "gateway was started with, else auto-discovered)",
+    ),
+    resolved: bool = typer.Option(
+        False, "--resolved",
+        help="Print the resolved effective config (declared YAML ⊕ CLI "
+        "overrides), secret-redacted",
+    ),
+    export: Optional[str] = typer.Option(
+        None, "--export",
+        help="Write the resolved effective config to a YAML file for diff / "
+        "version control",
+    ),
+    no_redact: bool = typer.Option(
+        False, "--no-redact",
+        help="Do not redact secrets (local inspection only — never share)",
+    ),
+):
+    """Show or export the gateway's resolved effective configuration (#5646).
+
+    The running gateway's posture is split between the declared ``gateway.yaml``
+    and a hidden per-host:port start-flags side file that stores the CLI-only
+    runtime knobs so ``restart`` can replay them. This command merges both into
+    ONE inspectable document — the configuration actually in force — so the YAML
+    can be the single source of truth. Secrets are redacted by default, so the
+    output is safe to diff, review, and commit.
+
+    Examples:
+        praisonai gateway config --resolved
+        praisonai gateway config --export gateway.resolved.yaml
+        praisonai gateway config --resolved --port 9000
+    """
+    import os
+
+    from ..features.gateway import export_effective_config
+
+    if port is None:
+        try:
+            port = int(os.environ.get("GATEWAY_PORT", "8765"))
+        except ValueError:
+            port = 8765
+
+    # Discover the same onboarded config start/status use when none is passed so
+    # the merge reflects the declared file the operator actually maintains.
+    if config is None:
+        config = _resolve_gateway_config_path(None)
+
+    # Default action is --resolved so a bare ``gateway config`` is useful.
+    if not resolved and not export:
+        resolved = True
+
+    text = export_effective_config(
+        host, port, config_file=config, redact=not no_redact
+    )
+
+    if export:
+        from pathlib import Path
+
+        out_path = Path(export)
+        try:
+            out_path.write_text(text, encoding="utf-8")
+        except OSError as exc:
+            print(f"Failed to write {out_path}: {exc}")
+            raise typer.Exit(1)
+        print(f"Wrote resolved gateway config to {out_path}")
+
+    if resolved:
+        sys.stdout.write(text if text.endswith("\n") else text + "\n")
+
+
 hooks_app = typer.Typer(
     help="Manage inbound trigger hooks (POST /hooks/<path>) in gateway.yaml",
     no_args_is_help=True,
@@ -2556,6 +2632,7 @@ def gateway_callback(ctx: typer.Context):
   [green]restart[/green]     Gracefully drain + relaunch (daemon-aware)
   [green]stop[/green]        Stop a running gateway instance
   [green]status[/green]      Check gateway and daemon status
+  [green]config[/green]      Show/export the resolved effective config (--resolved | --export)
   [green]doctor[/green]      Validate channel credentials (pre-flight check)
   [green]test[/green]        One-shot readiness (probes + shell + optional turn)
   [green]channels[/green]    List channels from gateway.yaml (use --probe to check creds)
```

**File**: `src/praisonai-bot/praisonai_bot/cli/features/gateway.py` (modified, +125/-0)
```diff
@@ -163,6 +163,131 @@ def load_start_flags(host: str, port: int) -> Dict:
     return {k: v for k, v in data.items() if k in _START_FLAG_KEYS}
 
 
+def resolve_effective_config(
+    host: str, port: int, config_file: Optional[str] = None
+) -> Dict:
+    """Resolve the effective gateway configuration actually in force (#5646).
+
+    Merges the declared config (``gateway.yaml`` / ``bot.yaml``) with the
+    CLI-only runtime posture persisted at ``start`` time (the hidden
+    ``gateway.start.<host>.<port>.json`` side file) so a single document
+    describes how the gateway is really running — not a partial YAML plus an
+    opaque, operator-invisible side file.
+
+    Precedence (lowest → highest): declared YAML < persisted CLI start-flags.
+    ``None`` persisted values mean "fall back to YAML" and are already dropped
+    on persist, so they never clobber a declared value here.
+
+    The persisted ``config_file`` key resolves which YAML to read when
+    ``config_file`` is not passed explicitly, so the snapshot reflects the file
+    the running process was launched against.
+
+    Returns a plain dict (NOT yet redacted): the ``declared`` YAML mapping, the
+    ``cli_overrides`` that were replayed over it, the ``resolved`` merge, plus
+    the ``host``/``port`` the snapshot was keyed by. Use
+    :func:`export_effective_config` for a secret-redacted, serialisable view.
+    """
+    import yaml
+
+    overrides = load_start_flags(host, port)
+
+    resolved_config_file = config_file or overrides.get("config_file")
+    declared: Dict = {}
+    declared_path: Optional[str] = None
+    if resolved_config_file and os.path.exists(resolved_config_file):
+        try:
+            with open(resolved_config_file) as fh:
+                loaded = yaml.safe_load(fh) or {}
+            if isinstance(loaded, dict):
+                declared = loaded
+                declared_path = resolved_config_file
+        except (OSError, yaml.YAMLError) as exc:  # pragma: no cover — advisory
+            logger.warning(
+                "Could not read gateway config %s: %s", resolved_config_file, exc
+            )
+
+    # The posture knobs ``start`` persists map onto the ``gateway.*`` block in
+    # YAML; surface them under one ``gateway`` mapping in the merge so the
+    # resolved document reads back exactly like a gateway.yaml an operator could
+    # promote into version control.
+    resolved: Dict = dict(declared)
+    gateway_section = dict(resolved.get("gateway") or {})
+    cli_overrides: Dict = {}
+    for key, value in overrides.items():
+        if key == "config_file":
+            continue
+        cli_overrides[key] = value
+        if key == "agent_file":
+            # agent_file is a top-level launch input, not a gateway.* knob.
+            resolved["agent_file"] = value
+        else:
+            gateway_section[key] = value
+    if gateway_section:
+        resolved["gateway"] = gateway_section
+
+    return {
+        "host": host,
+        "port": port,
+        "config_file": declared_path,
+        "declared": declared,
+        "cli_overrides": cli_overrides,
+        "resolved": resolved,
+    }
+
+
+def _redact_secret_values(value):
+    """Mask only secret-bearing keys, preserving every other value (#5646).
+
+    Unlike the diagnostics bundle's shape-only sanitiser (which reduces *every*
+    scalar to its type so nothing leaks), a promotable config must keep its
+    real, non-secret values — drain windows, policies, channel platforms — so an
+    operator can diff it against ``gateway.yaml`` and commit it. Only values
+    under a credential-named key (reusing the diagnostics ``_SECRET_KEYS`` set)
+    are replaced with a ``<set>``/``<empty>`` presence marker.
+    """
+    try:
+        from praisonai_bot.gateway.diagnostics import _SECRET_KEYS
+    except Exception:  # pragma: no cover — defensive
+        _SECRET_KEYS = frozenset()
+
+    if isinstance(value, dict):
+        out = {}
+        for key, val in value.items():
+            if str(key).lower() in _SECRET_KEYS:
+                out[key] = "<set>" if val not in (None, "") else "<empty>"
+            else:
+                out[key] = _redact_secret_values(val)
+        return out
+    if isinstance(value, list):
+        return [_redact_secret_values(v) for v in value]
+    return value
+
+
+def export_effective_config(
+    host: str,
+    port: int,
+    config_file: Optional[str] = None,
+    redact: bool = True,
+) -> str:
+    """Serialise the resolved effective config to YAML for diff / commit (#5646).
+
+    Produces the ``resolved`` document from :func:`resolve_effective_config`
+    as YAML so an operator can diff it against their declared ``gateway.yaml``
+    and promote the running posture back into version control. When ``redact``
+    is ``True`` (the default) only secret-bearing values are reduced to presence
+    markers (reusing the diagnostics ``_SECRET_KEYS`` set) while every other
+    value is kept, so t
```

**File**: `src/praisonai-bot/tests/unit/cli/test_gateway_resolved_config.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+"""Gateway resolved-config snapshot and export (#5646).
+
+A running gateway's posture was split between the declared ``gateway.yaml`` and
+a hidden per-host:port start-flags side file, so the YAML never described how
+the gateway was actually running and no command rendered the resolved, merged,
+redacted config. ``resolve_effective_config`` / ``export_effective_config`` and
+the ``gateway config --resolved/--export`` CLI close that gap. These tests cover
+the merge precedence, secret redaction, and the CLI surface.
+"""
+
+import yaml
+
+from praisonai_bot.cli.features.gateway import (
+    _persist_start_flags,
+    export_effective_config,
+    resolve_effective_config,
+)
+
+
+def _write_yaml(path, data):
+    path.write_text(yaml.safe_dump(data, sort_keys=False))
+    return str(path)
+
+
+def test_resolve_merges_declared_yaml_with_cli_overrides(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(
+        tmp_path / "gateway.yaml",
+        {"gateway": {"drain_timeout": 5}, "channels": {"telegram": {"platform": "telegram"}}},
+    )
+    _persist_start_flags(
+        "127.0.0.1", 8765,
+        {"drain_timeout": 30, "reliability": "production", "config_file": cfg},
+    )
+
+    snapshot = resolve_effective_config("127.0.0.1", 8765)
+    resolved = snapshot["resolved"]
+
+    # CLI override wins over the declared YAML value.
+    assert resolved["gateway"]["drain_timeout"] == 30
+    # A CLI-only posture knob materialises into the resolved gateway block.
+    assert resolved["gateway"]["reliability"] == "production"
+    # Declared-only config survives the merge.
+    assert resolved["channels"]["telegram"]["platform"] == "telegram"
+    assert snapshot["cli_overrides"]["reliability"] == "production"
+    assert snapshot["config_file"] == cfg
+
+
+def test_resolve_uses_persisted_config_file_when_not_passed(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(tmp_path / "bot.yaml", {"gateway": {"max_concurrent_runs": 4}})
+    _persist_start_flags("127.0.0.1", 8765, {"config_file": cfg})
+
+    snapshot = resolve_effective_config("127.0.0.1", 8765)
+    assert snapshot["config_file"] == cfg
+    assert snapshot["resolved"]["gateway"]["max_concurrent_runs"] == 4
+
+
+def test_resolve_empty_when_nothing_persisted(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    snapshot = resolve_effective_config("127.0.0.1", 8765)
+    assert snapshot["declared"] == {}
+    assert snapshot["cli_overrides"] == {}
+    assert snapshot["resolved"] == {}
+
+
+def test_agent_file_override_is_top_level(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    _persist_start_flags("127.0.0.1", 8765, {"agent_file": "agents.yaml"})
+    resolved = resolve_effective_config("127.0.0.1", 8765)["resolved"]
+    assert resolved["agent_file"] == "agents.yaml"
+    assert "gateway" not in resolved or "agent_file" not in resolved.get("gateway", {})
+
+
+def test_export_redacts_secrets_by_default(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(
+        tmp_path / "gateway.yaml",
+        {"channels": {"telegram": {"platform": "telegram", "token": "SECRET123"}}},
+    )
+    _persist_start_flags("127.0.0.1", 8765, {"config_file": cfg})
+
+    text = export_effective_config("127.0.0.1", 8765)
+    assert "SECRET123" not in text
+    loaded = yaml.safe_load(text)
+    assert loaded["channels"]["telegram"]["token"] == "<set>"
+
+
+def test_export_no_redact_keeps_values(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(
+        tmp_path / "gateway.yaml",
+        {"channels": {"telegram": {"token": "SECRET123"}}},
+    )
+    _persist_start_flags("127.0.0.1", 8765, {"config_file": cfg})
+
+    text = export_effective_config("127.0.0.1", 8765, redact=False)
+    assert "SECRET123" in text
+
+
+def test_cli_config_resolved_prints_merged(tmp_path, monkeypatch, capsys):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(tmp_path / "gateway.yaml", {"gateway": {"drain_timeout": 5}})
+    _persist_start_flags(
+        "127.0.0.1", 8765, {"reliability": "production", "config_file": cfg}
+    )
+
+    from praisonai_bot.cli.commands import gateway as gw_cmd
+
+    gw_cmd.gateway_config(
+        host="127.0.0.1", port=8765, config=cfg,
+        resolved=True, export=None, no_redact=False,
+    )
+    out = capsys.readouterr().out
+    loaded = yaml.safe_load(out)
+    assert loaded["gateway"]["reliability"] == "production"
+    assert loaded["gateway"]["drain_timeout"] == 5
+
+
+def test_cli_config_export_writes_file(tmp_path, monkeypatch):
+    monkeypatch.setenv("PRAISONAI_HOME", str(tmp_path))
+    cfg = _write_yaml(tmp_path / "gateway.yaml", {"gateway": {"drain_timeout": 5}})
+    _persist_start_flags("127.0.0.1", 8765, {"
```

---

### Incident Patch 6: `3e7fd418` (2026-10-05)
**Commit Message**: fix(storage): match SQLite key prefixes literally (#5560)

**File**: `src/praisonai-agents/praisonaiagents/storage/backends.py` (modified, +2/-2)
```diff
@@ -324,9 +324,9 @@ def list_keys(self, prefix: str = "") -> List[str]:
         if prefix:
             cur.execute(f"""
                 SELECT key FROM {self._quoted_table}
-                WHERE key LIKE ?
+                WHERE instr(key, ?) = 1
                 ORDER BY key
-            """, (f"{prefix}%",))
+            """, (prefix,))
         else:
             cur.execute(f"""
                 SELECT key FROM {self._quoted_table}
```

**File**: `src/praisonai-agents/tests/unit/storage/test_sqlite_backend_literal_prefix.py` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+"""SQLite key enumeration uses literal, case-sensitive prefixes."""
+
+import pytest
+
+from praisonaiagents.storage.backends import SQLiteBackend
+
+
+@pytest.mark.parametrize("prefix", ["task_", "task%", "Task", "", "ordinary", "键", "slash\\", "nul\x00"])
+def test_list_keys_matches_literal_prefix(tmp_path, prefix):
+    keys = ["task_one", "taskXone", "task%one", "TaskOne", "ordinary", "键一", "键二", "slash\\one", "slashXone", "nul\x00one", "nulXone"]
+    store = SQLiteBackend(db_path=str(tmp_path / "storage.db"))
+    try:
+        for key in keys:
+            store.save(key, {"key": key})
+        assert store.list_keys(prefix) == sorted(key for key in keys if key.startswith(prefix))
+        assert store.list_keys("missing") == []
+    finally:
+        store.close()
```

---

### Incident Patch 7: `295ebf33` (2026-10-05)
**Commit Message**: fix: persist portable SQLite transcript operations in the database (#5518)

* fix: use SQLite transcript rows for portable session operations

* fix: preserve transcript import no-clobber and cache contracts

* fix(session): filter lineage exports before loading transcript rows

**File**: `src/praisonai-agents/praisonaiagents/session/sqlite_transcript_store.py` (modified, +54/-4)
```diff
@@ -216,7 +216,7 @@ def _read_row(self, session_id: str, conn=None) -> Optional[Dict[str, Any]]:
         except (json.JSONDecodeError, TypeError):
             return None
 
-    def _write_row(self, session: SessionData, conn=None) -> bool:
+    def _write_row(self, session: SessionData, conn=None, *, overwrite: bool = True) -> bool:
         own_lock = conn is None
         if conn is None:
             conn = self._connect()
@@ -235,17 +235,21 @@ def _write_row(self, session: SessionData, conn=None) -> bool:
             getattr(session, "updated_at", None),
         )
         sql = (
-            "INSERT OR REPLACE INTO sessions "
+            ("INSERT OR REPLACE" if overwrite else "INSERT OR IGNORE") + " INTO sessions "
             "(session_id, data, agent_name, gateway_session_id, agent_id, updated_at) "
             "VALUES (?, ?, ?, ?, ?, ?)"
         )
         try:
             if own_lock:
                 with self._db_lock:
-                    conn.execute(sql, params)
+                    cursor = conn.execute(sql, params)
             else:
-                conn.execute(sql, params)
+                cursor = conn.execute(sql, params)
+            if not overwrite and cursor.rowcount == 0:
+                raise FileExistsError(session.session_id)
             return True
+        except FileExistsError:
+            raise
         except Exception as exc:
             logger.error("Failed to write session %s: %s", session.session_id, exc)
             return False
@@ -288,6 +292,52 @@ def _save_session(self, session: SessionData) -> bool:
                 self._cache[session.session_id] = session
             return True
 
+    def _save_imported_session(self, session: SessionData, *, overwrite: bool = True) -> bool:
+        """Restore to the database without applying the destination's window."""
+        session.updated_at = datetime.now(timezone.utc).isoformat()
+        with self._db_lock:
+            # INSERT OR IGNORE makes no-clobber atomic across store instances;
+            # checking session_exists before a replace would still race.
+            if not self._write_row(session, overwrite=overwrite):
+                return False
+            with self._lock:
+                self._cache[session.session_id] = session
+            return True
+
+    def export_all(self) -> Dict[str, Any]:
+        """Export durable database rows, not legacy JSON sidecar files."""
+        return {
+            "version": self.PORTABLE_VERSION,
+            "sessions": [data for data in self._all_rows() if isinstance(data, dict)],
+        }
+
+    def _collect_lineage(
+        self, session: SessionData, *, exclude: str
+    ) -> List[Dict[str, Any]]:
+        """Collect persisted database records from the same conversation chain."""
+        lineage = self._lineage_key(session.to_dict())
+        if not lineage:
+            return []
+
+        def record_lineage(raw):
+            # Preserve the writer's Python JSON semantics (including NaN)
+            # and the shared lineage precedence, without retaining other rows.
+            try:
+                data = json.loads(raw)
+                return self._lineage_key(data) if isinstance(data, dict) else None
+            except (json.JSONDecodeError, TypeError, AttributeError):
+                return None
+
+        conn = self._connect()
+        with self._db_lock:
+            conn.create_function("portable_session_lineage", 1, record_lineage)
+            rows = conn.execute(
+                "SELECT data FROM sessions WHERE session_id != ? "
+                "AND portable_session_lineage(data) = ? ORDER BY updated_at DESC",
+                (exclude, lineage),
+            ).fetchall()
+        return [json.loads(row[0]) for row in rows]
+
     def _modify_session_locked(
         self,
         session_id: str,
```

**File**: `src/praisonai-agents/tests/unit/session/test_sqlite_transcript_portability.py` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+"""Portable session operations use the SQLite transcript persistence backend."""
+
+import json
+import tracemalloc
+
+import pytest
+
+from praisonaiagents.session.store import DefaultSessionStore
+from praisonaiagents.session.sqlite_transcript_store import SqliteTranscriptStore
+
+
+@pytest.fixture
+def stores(tmp_path):
+    opened = []
+
+    def make(name, backend=SqliteTranscriptStore, **kwargs):
+        store = backend(session_dir=str(tmp_path / name), **kwargs)
+        opened.append(store)
+        return store
+
+    yield make
+    for store in opened:
+        conn = getattr(store, "_conn", None)
+        if conn is not None:
+            conn.close()
+
+
+def test_export_all_reads_database_not_json_sidecars(stores):
+    store = stores("source")
+    assert store.add_message("one", "user", "First")
+    assert store.add_message("two", "assistant", "Second")
+    from pathlib import Path
+    (Path(store.session_dir) / "unrelated.json").write_text(
+        json.dumps({"session_id": "sidecar", "messages": []}), encoding="utf-8"
+    )
+    payload = store.export_all()
+    assert payload["version"] == store.PORTABLE_VERSION
+    assert {record["session_id"] for record in payload["sessions"]} == {"one", "two"}
+
+
+@pytest.mark.parametrize("key", ["lineage_id", "root_session_id", "thread_id"])
+def test_single_export_includes_database_lineage(stores, key):
+    store = stores("source")
+    for session_id in ("first", "continuation", "unrelated"):
+        assert store.add_message(session_id, "user", session_id)
+        assert store.update_session_metadata(session_id, **{key: "shared" if session_id != "unrelated" else "other"})
+    payload = store.export_session("continuation")
+    assert {record["session_id"] for record in payload["sessions"]} == {"first", "continuation"}
+    assert [record["session_id"] for record in store.export_session("continuation", include_lineage=False)["sessions"]] == ["continuation"]
+
+
+@pytest.mark.parametrize("source_backend", [DefaultSessionStore, SqliteTranscriptStore])
+@pytest.mark.parametrize("target_backend", [DefaultSessionStore, SqliteTranscriptStore])
+def test_cross_backend_restore_survives_reopen_without_window_truncation(stores, source_backend, target_backend):
+    source = stores("source", source_backend)
+    for index in range(6):
+        assert source.add_message("reference", "user", f"message-{index}")
+    assert source.set_gateway_info("reference", gateway_session_id="live", agent_id="agent")
+    payload = source.export_all()
+    assert len(payload["sessions"]) == 1
+    target = stores("target", target_backend, active_window=2, retention="truncate")
+    # An existing SQLite row prevents legacy JSON migration from masking a
+    # restore incorrectly written to a sidecar file instead of the database.
+    assert target.add_message("existing", "user", "Existing history")
+    assert target.import_sessions(payload).imported == 1
+    assert target.session_exists("reference")
+    target.invalidate_cache()
+    reopened = stores("target", target_backend, active_window=2, retention="truncate")
+    for current in (target, reopened):
+        assert [message["content"] for message in current.get_chat_history("reference")] == [f"message-{index}" for index in range(6)]
+        session = current.get_session("reference")
+        assert session.gateway_session_id is None
+        assert session.agent_id is None
+    if target_backend is SqliteTranscriptStore:
+        from pathlib import Path
+        assert list(Path(target.session_dir).glob("*.json")) == []
+
+
+def test_import_sqlite_write_failure_is_reported_and_preserves_existing_row(stores):
+    source = stores("source", DefaultSessionStore)
+    assert source.add_message("reference", "user", "New history")
+    target = stores("target")
+    assert target.add_message("reference", "user", "Original history")
+    target._connect().execute("PRAGMA query_only=ON")
+    report = target.import_sessions(source.export_all(), overwrite=True)
+    assert report.imported == 0
+    assert report.skipped_count == 1
+    assert "write failed" in report.skipped[0]["reason"]
+    target.invalidate_cache()
+    assert target.get_chat_history("reference")[0]["content"] == "Original history"
+
+
+@pytest.mark.parametrize("reset_live_fields", [True, False])
+def test_restore_preserves_archived_history_and_tool_calls(stores, reset_live_fields):
+    tool_calls = [{"id": "call-1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}]
+    payload = {"sessions": [{
+        "session_id": "reference",
+        "gateway_session_id": "live",
+        "agent_id": "agent",
+        "metadata": {"gateway_session_id": "live", "agent_id": "agent", "lineage_id": "shared"},
+        "archived_messages": [{"role": "user", "content": "Archived", "timestamp": 1}],
+        "messages": [{"role": "assistant", "content": "Tool call", "tool_calls": tool_calls}],
+    }]}
+    target = stor
```

---

### Incident Patch 8: `1f2c9c58` (2026-10-05)
**Commit Message**: fix(session): honor hierarchy retention and preserve snapshot transcripts (#5534)

* fix(session): honor hierarchy retention policies

* fix(session): restore hierarchy imports without retention loss

* fix(session): restore independent snapshot transcripts after retention

* fix: preserve imported live history when taking snapshots

* fix: pool durable snapshot transcript records

* fix: reject pooled snapshots in positional readers

* fix: reject incomplete pooled snapshot transcripts

* fix: validate pooled snapshot reference types

**File**: `src/praisonai-agents/praisonaiagents/session/hierarchy.py` (modified, +221/-23)
```diff
@@ -30,24 +30,39 @@
 
 @dataclass
 class SessionSnapshot:
-    """A snapshot of session state at a point in time."""
+    """A transcript snapshot; old records may contain only a message index.
+
+    Durable records pool repeated transcript entries; portable exports inline them.
+    Legacy records cannot recover history already discarded before upgrading.
+    """
     
     id: str = field(default_factory=lambda: str(uuid.uuid4()))
     session_id: str = ""
     message_index: int = 0  # Index of last message in snapshot
     created_at: float = field(default_factory=time.time)
     label: Optional[str] = None
     metadata: Dict[str, Any] = field(default_factory=dict)
+    transcript: Optional[Dict[str, Any]] = None
+    invalidated: bool = False
     
-    def to_dict(self) -> Dict[str, Any]:
-        return {
+    def _header_dict(self) -> Dict[str, Any]:
+        data = {
             "id": self.id,
             "session_id": self.session_id,
             "message_index": self.message_index,
             "created_at": self.created_at,
             "label": self.label,
             "metadata": self.metadata,
         }
+        if self.invalidated:
+            data["invalidated"] = True
+        return data
+
+    def to_dict(self) -> Dict[str, Any]:
+        data = self._header_dict()
+        if self.transcript is not None:
+            data["transcript"] = copy.deepcopy(self.transcript)
+        return data
     
     @classmethod
     def from_dict(cls, data: Dict[str, Any]) -> "SessionSnapshot":
@@ -58,6 +73,8 @@ def from_dict(cls, data: Dict[str, Any]) -> "SessionSnapshot":
             created_at=data.get("created_at", time.time()),
             label=data.get("label"),
             metadata=data.get("metadata", {}),
+            transcript=copy.deepcopy(data.get("transcript")),
+            invalidated=data.get("invalidated", False),
         )
 
 @dataclass
@@ -82,14 +99,128 @@ def to_dict(self) -> Dict[str, Any]:
             "title": self.title,
         })
         return d
+
+    def _to_storage_dict(self) -> Dict[str, Any]:
+        """Pool snapshot records in the atomic session file, not portable exports."""
+        data = super().to_dict()
+        data.update({
+            "parent_id": self.parent_id,
+            "forked_from_message_id": self.forked_from_message_id,
+            "children_ids": self.children_ids,
+            "is_shared": self.is_shared,
+            "title": self.title,
+        })
+        records = {}
+        record_ids = {}
+
+        def intern(value):
+            # Most transcript records contain text plus scalar fields and empty
+            # metadata. Reuse hashes of their immutable strings rather than
+            # re-encoding every archived text for every snapshot on each write.
+            if isinstance(value, dict) and all(
+                item is None or isinstance(item, (str, bool, int, float))
+                or isinstance(item, (dict, list)) and not item
+                for item in value.values()
+            ):
+                identity = ("flat", tuple(
+                    (name, type(item), None if isinstance(item, (dict, list)) else item)
+                    for name, item in value.items()
+                ))
+            else:
+                identity = ("json", json.dumps(value, ensure_ascii=False,
+                                               separators=(",", ":")))
+            key = record_ids.get(identity)
+            if key is None:
+                key = str(len(records))
+                record_ids[identity] = key
+                records[key] = copy.deepcopy(value)
+            return key
+
+        snapshots = []
+        for snapshot in self.snapshots:
+            saved = snapshot._header_dict()
+            required = {"messages", "archived_messages", "last_compaction"}
+            if (snapshot.transcript is not None and required <= snapshot.transcript.keys()
+                    and all(isinstance(snapshot.transcript[name], list)
+                            and all(isinstance(item, dict) for item in snapshot.transcript[name])
+                            for name in ("messages", "archived_messages"))
+                    and (snapshot.transcript["last_compaction"] is None
+                         or isinstance(snapshot.transcript["last_compaction"], dict))):
+                refs = {}
+                for name, value in snapshot.transcript.items():
+                    if name in ("messages", "archived_messages") and isinstance(value, list):
+                        refs[name] = {"items": [intern(item) for item in value]}
+                    else:
+                        refs[name] = {"value": intern(value)}
+                saved["transcript_refs"] = refs
+                # Readers that only understand positional/inline snapshots
+                # must reject this record instead of restoring a stale index.
+                saved["invalidated"] = True
+                saved["transcript_invalidated"] = snapsho
```

**File**: `src/praisonai-agents/praisonaiagents/session/store.py` (modified, +17/-7)
```diff
@@ -1038,6 +1038,10 @@ def _report_unreadable_session(self, session_id: str, filepath: str, error: Exce
             logger.warning("Skipping unreadable session file %s: %s", filepath, error)
             self._fire_corruption_hook(session_id, str(error), None)
 
+    def _dump_session_json(self, data: Any, stream) -> None:
+        """Write durable JSON; subclasses can format private storage records."""
+        json.dump(data, stream, indent=2, ensure_ascii=False)
+
     def _atomic_write_json(self, filepath: str, data: Any) -> bool:
         """Atomically write JSON data to disk (temp file + os.replace)."""
         temp_path = None
@@ -1052,7 +1056,7 @@ def _atomic_write_json(self, filepath: str, data: Any) -> bool:
                 suffix=".tmp",
             ) as f:
                 temp_path = f.name
-                json.dump(data, f, indent=2, ensure_ascii=False)
+                self._dump_session_json(data, f)
 
             os.replace(temp_path, filepath)
             return True
@@ -1305,7 +1309,7 @@ def _key(message: SessionMessage) -> tuple:
             # expose an oversized transcript that stays inconsistent until a
             # later mutation happens to compact it.
             self._enforce_window(session)
-            if not self._atomic_write_json(filepath, session.to_dict()):
+            if not self._atomic_write_json(filepath, self._session_to_storage(session)):
                 # Could not fold the salvage back in durably — leave the spill
                 # files in place so a later load can retry.
                 return
@@ -1323,6 +1327,7 @@ def _modify_session_locked(
         mutator: Callable[[SessionData], None],
         *,
         error_label: str = "modify session",
+        apply_retention: bool = True,
     ) -> bool:
         """Apply mutator after reloading from disk under FileLock."""
         filepath = self._get_session_path(session_id)
@@ -1338,9 +1343,10 @@ def _modify_session_locked(
             mutator(session)
             session.updated_at = datetime.now(timezone.utc).isoformat()
 
-            self._enforce_window(session)
+            if apply_retention:
+                self._enforce_window(session)
 
-            if not self._atomic_write_json(filepath, session.to_dict()):
+            if not self._atomic_write_json(filepath, self._session_to_storage(session)):
                 logger.error(f"Failed to {error_label} {session_id}")
                 return False
 
@@ -1349,6 +1355,10 @@ def _modify_session_locked(
 
             return True
     
+    def _session_to_storage(self, session: SessionData) -> Dict[str, Any]:
+        """Serialize a durable record; subclasses may retain portable exports."""
+        return session.to_dict()
+
     def _save_session(self, session: SessionData) -> bool:
         """Save session to disk with atomic write."""
         filepath = self._get_session_path(session.session_id)
@@ -1358,7 +1368,7 @@ def _save_session(self, session: SessionData) -> bool:
         self._enforce_window(session)
         
         with FileLock(filepath, self.lock_timeout):
-            if not self._atomic_write_json(filepath, session.to_dict()):
+            if not self._atomic_write_json(filepath, self._session_to_storage(session)):
                 logger.error(f"Failed to save session {session.session_id}")
                 return False
             return True
@@ -1425,7 +1435,7 @@ def add_message(
             self._enforce_window(session)
             
             # Write atomically
-            if not self._atomic_write_json(filepath, session.to_dict()):
+            if not self._atomic_write_json(filepath, self._session_to_storage(session)):
                 logger.error(f"Failed to save session {session_id}")
                 # Issue #3597: durable write failed (disk-full / corruption).
                 # Spill just this turn to a fallback file and fire the
@@ -2448,7 +2458,7 @@ def _save_imported_session(self, session: SessionData, *, overwrite: bool = True
             # Check again inside the same lock that protects the replacement.
             if not overwrite and os.path.exists(filepath):
                 raise FileExistsError(filepath)
-            if not self._atomic_write_json(filepath, session.to_dict()):
+            if not self._atomic_write_json(filepath, self._session_to_storage(session)):
                 logger.error(f"Failed to save imported session {session.session_id}")
                 return False
             session._import_file_identity = self._session_file_identity(filepath)
```

**File**: `src/praisonai-agents/tests/unit/session/test_hierarchy_retention.py` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+"""Hierarchy writes must honor the inherited retention policy before slicing."""
+
+import json
+
+import pytest
+
+from praisonaiagents.session.hierarchy import HierarchicalSessionStore
+from praisonaiagents.session.store import DefaultSessionStore, SessionData, SessionMessage
+
+
+@pytest.mark.parametrize("operation", ["add", "fork", "import"])
+@pytest.mark.parametrize(
+    "retention,window,active,archived",
+    [
+        ("keep_all", 2, ["0", "1", "2", "3", "4"], []),
+        ("compact", 2, ["3", "4"], ["0", "1", "2"]),
+        ("truncate", 4, ["1", "2", "3", "4"], []),
+        (None, None, ["3", "4"], []),
+    ],
+)
+def test_retention_survives_public_hierarchy_writes(
+    tmp_path, operation, retention, window, active, archived
+):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=2,
+        retention=retention, active_window=window,
+    )
+    messages = [SessionMessage("user", str(index), timestamp=index) for index in range(5)]
+    if operation == "add":
+        result_id = store.create_session(session_id="parent")
+        for message in messages:
+            assert store.add_message(result_id, message.role, message.content)
+    elif operation == "fork":
+        source = DefaultSessionStore(session_dir=str(tmp_path), retention="keep_all")
+        for message in messages:
+            assert source.add_message("parent", message.role, message.content)
+        result_id = store.fork_session("parent")
+    else:
+        result_id = store.import_session(
+            SessionData(session_id="source", messages=messages).to_dict(),
+            new_session_id="imported",
+        )
+        active = ["0", "1", "2", "3", "4"]
+        archived = []
+
+    result = json.loads((tmp_path / f"{result_id}.json").read_text(encoding="utf-8"))
+    raw_active = [message for message in result["messages"] if not message["metadata"].get("compaction")]
+    assert [message["content"] for message in raw_active] == active
+    assert [message["content"] for message in result["archived_messages"]] == archived
+    if retention == "compact" and operation != "import":
+        summary = result["messages"][0]
+        assert summary["role"] == "system"
+        assert summary["metadata"]["compaction"] is True
+        assert summary["metadata"]["compacted_count"] == 3
+    reopened = HierarchicalSessionStore(session_dir=str(tmp_path))
+    fresh = reopened.get_extended_session(result_id, force_reload=True)
+    assert [message.content for message in fresh.archived_messages] == archived
+
+
+@pytest.mark.parametrize("retention", ["keep_all", "compact", "truncate"])
+def test_import_restores_export_larger_than_destination_window(tmp_path, retention):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2,
+        retention=retention,
+    )
+    data = SessionData(
+        session_id="source",
+        messages=[SessionMessage("user", str(index), timestamp=index) for index in range(5)],
+        archived_messages=[SessionMessage("user", "archived", timestamp=-1)],
+    ).to_dict()
+
+    imported_id = store.import_session(data)
+
+    saved = json.loads((tmp_path / f"{imported_id}.json").read_text(encoding="utf-8"))
+    assert saved["messages"] == data["messages"]
+    assert saved["archived_messages"] == data["archived_messages"]
+
+
+def test_truncate_does_not_persist_orphaned_tool_result(tmp_path):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=2, retention="truncate"
+    )
+    calls = [{"id": "call1", "type": "function", "function": {"name": "read", "arguments": "{}"}}]
+    assert store.add_message("parent", "assistant", "", tool_calls=calls)
+    assert store.add_message("parent", "tool", "result", tool_call_id="call1")
+    assert store.add_message("parent", "user", "next")
+
+    result = json.loads((tmp_path / "parent.json").read_text(encoding="utf-8"))
+    assert [message["role"] for message in result["messages"]] == ["user"]
+    assert result["messages"][0]["content"] == "next"
```

**File**: `src/praisonai-agents/tests/unit/session/test_hierarchy_snapshot_transcript.py` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+"""Snapshots must restore their transcript after the live window moves."""
+
+import json
+
+import pytest
+
+from praisonaiagents.session.hierarchy import HierarchicalSessionStore, SessionSnapshot
+from praisonaiagents.session.store import CompactionCheckpoint, SessionData, SessionMessage
+
+
+@pytest.mark.parametrize("retention", ["compact", "truncate", "keep_all"])
+def test_snapshot_survives_retention_and_reopen(tmp_path, retention):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2,
+        retention=retention,
+    )
+    for content in ["one", "two"]:
+        assert store.add_message("parent", "user", content)
+    before = json.loads((tmp_path / "parent.json").read_text(encoding="utf-8"))
+    snapshot_id = store.create_snapshot("parent")
+    for content in ["three", "four"]:
+        assert store.add_message("parent", "user", content)
+    reopened = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2,
+        retention=retention,
+    )
+
+    assert reopened.revert_to_snapshot("parent", snapshot_id)
+
+    restored = json.loads((tmp_path / "parent.json").read_text(encoding="utf-8"))
+    assert restored["messages"] == before["messages"]
+    assert restored["archived_messages"] == before["archived_messages"]
+    assert restored.get("last_compaction") == before.get("last_compaction")
+
+
+@pytest.mark.parametrize("retention", ["compact", "truncate", "keep_all"])
+def test_snapshot_restores_large_import_without_reapplying_window(tmp_path, retention):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2, retention=retention
+    )
+    exported = SessionData(
+        session_id="source",
+        messages=[SessionMessage("user", str(index), timestamp=index) for index in range(5)],
+        archived_messages=[SessionMessage("user", "archived", timestamp=-1)],
+    ).to_dict()
+    session_id = store.import_session(exported)
+    snapshot_id = store.create_snapshot(session_id)
+    live = json.loads((tmp_path / f"{session_id}.json").read_text(encoding="utf-8"))
+    assert live["messages"] == exported["messages"]
+    assert live["archived_messages"] == exported["archived_messages"]
+    assert store.add_message(session_id, "user", "later")
+
+    assert store.revert_to_snapshot(session_id, snapshot_id)
+
+    saved = json.loads((tmp_path / f"{session_id}.json").read_text(encoding="utf-8"))
+    assert saved["messages"] == exported["messages"]
+    assert saved["archived_messages"] == exported["archived_messages"]
+
+
+def test_empty_snapshot_removes_later_archive_and_messages(tmp_path):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2, retention="compact"
+    )
+    store.create_session(session_id="parent")
+    snapshot_id = store.create_snapshot("parent")
+    for content in ["one", "two", "three", "four"]:
+        assert store.add_message("parent", "user", content)
+    assert store.export_session("parent")["archived_messages"]
+
+    assert store.revert_to_snapshot("parent", snapshot_id)
+
+    restored = store.export_session("parent")
+    assert restored["messages"] == []
+    assert restored["archived_messages"] == []
+
+
+def test_legacy_snapshot_without_window_change_remains_compatible(tmp_path):
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    assert store.add_message("parent", "user", "one")
+    path = tmp_path / "parent.json"
+    data = json.loads(path.read_text(encoding="utf-8"))
+    legacy = SessionSnapshot(id="legacy", session_id="parent", message_index=0).to_dict()
+    assert "transcript" not in legacy
+    data["snapshots"] = [legacy]
+    path.write_text(json.dumps(data), encoding="utf-8")
+    assert store.add_message("parent", "user", "two")
+
+    assert store.revert_to_snapshot("parent", "legacy")
+    assert [message["content"] for message in store.export_session("parent")["messages"]] == ["one"]
+
+
+@pytest.mark.parametrize("retention", ["compact", "truncate"])
+def test_legacy_snapshot_is_rejected_after_window_change(tmp_path, retention):
+    store = HierarchicalSessionStore(
+        session_dir=str(tmp_path), max_messages=100, active_window=2, retention=retention
+    )
+    for content in ["one", "two"]:
+        assert store.add_message("parent", "user", content)
+    path = tmp_path / "parent.json"
+    data = json.loads(path.read_text(encoding="utf-8"))
+    data["snapshots"] = [SessionSnapshot(id="legacy", session_id="parent", message_index=1).to_dict()]
+    path.write_text(json.dumps(data), encoding="utf-8")
+    for content in ["three", "four"]:
+        assert store.add_message("parent", "user", content)
+    before = path.read_bytes()
+
+    assert store.revert_to_snapshot("parent", "legacy") is False
+    assert path.read_bytes() == before
+
+
+def test_persisted_snapshot_r
```

**File**: `src/praisonai-agents/tests/unit/session/test_snapshot_storage_pool.py` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+"""Durable snapshot pooling must preserve portable and independent transcripts."""
+
+import copy
+import json
+
+import pytest
+
+from praisonaiagents.session.hierarchy import (
+    ExtendedSessionData, HierarchicalSessionStore, SessionSnapshot,
+)
+from praisonaiagents.session.store import SessionData, SessionMessage
+
+
+def test_repeated_snapshots_share_archive_on_disk_and_export_in_full(tmp_path):
+    source = SessionData(
+        session_id="source",
+        messages=[SessionMessage("user", "live", timestamp=1)],
+        archived_messages=[SessionMessage("user", "archive-marker-" + str(i) + "x" * 2048,
+                                          timestamp=i) for i in range(100)],
+    ).to_dict()
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    sid = store.import_session(source, new_session_id="s")
+    path = tmp_path / "s.json"
+    initial = path.stat().st_size
+    ids = [store.create_snapshot(sid) for _ in range(10)]
+    assert store.add_message(sid, "user", "later")
+
+    assert path.read_text(encoding="utf-8").count("archive-marker-0x") == 2
+    assert path.stat().st_size < initial * 3
+    reopened = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    exported = reopened.export_session(sid)
+    assert "snapshot_storage" not in exported
+    assert all(s["transcript"]["archived_messages"] == source["archived_messages"]
+               for s in exported["snapshots"])
+    assert all("transcript_refs" not in s for s in exported["snapshots"])
+    imported = reopened.import_session(json.loads(json.dumps(exported)), new_session_id="copy")
+    assert reopened.revert_to_snapshot(imported, ids[0])
+    assert reopened.export_session(imported)["messages"] == source["messages"]
+
+
+def test_ordinary_write_does_not_expand_portable_snapshot_dicts(tmp_path, monkeypatch):
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    assert store.add_message("s", "user", "first")
+    snapshot_id = store.create_snapshot("s")
+
+    def no_portable_copy(self):
+        raise AssertionError("ordinary write expanded a portable snapshot")
+
+    monkeypatch.setattr(SessionSnapshot, "to_dict", no_portable_copy)
+    assert store.add_message("s", "user", "second")
+    assert store.revert_to_snapshot("s", snapshot_id)
+
+
+def test_positional_reader_rejects_pooled_snapshot_without_losing_real_flag(tmp_path):
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    assert store.add_message("s", "user", "first")
+    snapshot_id = store.create_snapshot("s")
+    record = json.loads((tmp_path / "s.json").read_text(encoding="utf-8"))
+    legacy_view = SessionSnapshot.from_dict(record["snapshots"][0])
+    assert legacy_view.transcript is None
+    assert legacy_view.invalidated is True
+    assert store.revert_to_snapshot("s", snapshot_id)
+    record["snapshots"][0]["transcript_invalidated"] = True
+    assert ExtendedSessionData.from_dict(record).snapshots[0].invalidated is True
+
+
+def test_legacy_transcripts_upgrade_and_pooled_values_remain_independent(tmp_path):
+    transcript = {"messages": [{"role": "user", "content": [{"text": "old"}], "timestamp": 1}],
+                  "archived_messages": [], "last_compaction": None}
+    record = ExtendedSessionData(session_id="s", snapshots=[
+        SessionSnapshot(id="a", transcript=copy.deepcopy(transcript)),
+        SessionSnapshot(id="b", transcript=copy.deepcopy(transcript)),
+        SessionSnapshot(id="empty", transcript={}),
+    ]).to_dict()
+    (tmp_path / "s.json").write_text(json.dumps(record), encoding="utf-8")
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    assert store.add_message("s", "user", "new")
+    reopened = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    snapshots = reopened.get_snapshots("s")
+    snapshots[0].transcript["messages"][0]["content"][0]["text"] = "changed"
+    assert snapshots[1].transcript == transcript
+    assert snapshots[2].transcript == {}
+    assert reopened.export_session("s")["snapshots"][0]["transcript"] == transcript
+
+
+@pytest.mark.parametrize("damage", ["missing", "version", "descriptor"])
+def test_invalid_pool_preserves_durable_record_on_write(tmp_path, damage):
+    store = HierarchicalSessionStore(session_dir=str(tmp_path), retention="keep_all")
+    assert store.add_message("s", "user", "first")
+    store.create_snapshot("s")
+    path = tmp_path / "s.json"
+    record = json.loads(path.read_text(encoding="utf-8"))
+    if damage == "missing":
+        record["snapshot_storage"]["records"] = {}
+    elif damage == "version":
+        record["snapshot_storage"]["version"] = 2
+    else:
+        record["snapshots"][0]["transcript_refs"]["messages"] = {"bad": "ref"}
+    path.write_text(json.dumps(record), encoding="utf-8")
+    before = path.read_bytes()
+    assert stor
```

---

### Incident Patch 9: `e8657b70` (2026-10-05)
**Commit Message**: fix(session): recover structured spill messages and skip invalid UTF-8 (#5551)

* fix(session): recover structured spill messages and skip invalid UTF-8

* fix: distinguish JSON scalar types during spill recovery

* fix: avoid recursive keys during spill recovery

**File**: `src/praisonai-agents/praisonaiagents/session/store.py` (modified, +58/-13)
```diff
@@ -1212,16 +1212,55 @@ def _reingest_spill(self, session_id: str, session: SessionData) -> None:
         except (IOError, OSError):
             return
 
-        seen = {
-            (m.role, m.content, m.timestamp) for m in session.messages
-        }
+        def _freeze(value: Any) -> Any:
+            # A flat, iterative key avoids recursion both while converting and
+            # hashing deeply nested JSON. Sort object keys to preserve equality
+            # independently of insertion order; keep scalar types distinct.
+            tokens = []
+            stack = [("visit", value)]
+            ancestors = set()
+            while stack:
+                operation, item = stack.pop()
+                if operation == "leave":
+                    ancestors.remove(item)
+                elif operation == "key":
+                    tokens.append(("key", type(item), item))
+                elif isinstance(item, (list, dict)):
+                    identity = id(item)
+                    if identity in ancestors:
+                        raise ValueError("cyclic spill content")
+                    ancestors.add(identity)
+                    stack.append(("leave", identity))
+                    tokens.append((type(item), len(item)))
+                    if isinstance(item, list):
+                        stack.extend(("visit", child) for child in reversed(item))
+                    else:
+                        for key in sorted(item, reverse=True):
+                            stack.append(("visit", item[key]))
+                            stack.append(("key", key))
+                else:
+                    tokens.append((type(item), item))
+            return tuple(tokens)
+
+        def _key(message: SessionMessage) -> tuple:
+            return tuple(_freeze(value) for value in (
+                message.role, message.content, message.timestamp,
+            ))
+
+        seen = set()
+        for message in session.messages:
+            try:
+                seen.add(_key(message))
+            except (RecursionError, TypeError, ValueError):
+                # An unsupported existing value must not stop other salvage.
+                continue
         recovered: List[tuple] = []  # (filepath, [SessionMessage])
         for filename in candidates:
             filepath = os.path.join(spill_dir, filename)
             try:
                 with open(filepath, "r", encoding="utf-8") as f:
                     data = json.load(f)
-            except (json.JSONDecodeError, IOError, OSError):
+            except (json.JSONDecodeError, UnicodeDecodeError, RecursionError, IOError, OSError):
                 continue
             # A syntactically valid spill can still carry an unexpected shape
             # (non-object root, non-list messages, non-object message). Guard
@@ -1235,15 +1274,21 @@ def _reingest_spill(self, session_id: str, session: SessionData) -> None:
             if not isinstance(raw_messages, list):
                 continue
             msgs = []
-            for raw in raw_messages:
-                if not isinstance(raw, dict):
-                    continue
-                msg = SessionMessage.from_dict(raw)
-                key = (msg.role, msg.content, msg.timestamp)
-                if key in seen:
-                    continue
-                seen.add(key)
-                msgs.append(msg)
+            pending_keys = set()
+            try:
+                for raw in raw_messages:
+                    if not isinstance(raw, dict):
+                        continue
+                    msg = SessionMessage.from_dict(raw)
+                    key = _key(msg)
+                    if key in seen or key in pending_keys:
+                        continue
+                    pending_keys.add(key)
+                    msgs.append(msg)
+            except (RecursionError, TypeError, ValueError):
+                # Retain the entire spill, without poisoning neighbor dedup.
+                continue
+            seen.update(pending_keys)
             recovered.append((filepath, msgs))
 
         if not recovered:
```

**File**: `src/praisonai-agents/tests/unit/session/test_session_spill_structured_recovery.py` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+"""Salvaged JSON content and one corrupt file must not break session loading."""
+
+from pathlib import Path
+import json
+
+import pytest
+
+from praisonaiagents.session.store import DefaultSessionStore, SessionMessage
+
+
+@pytest.mark.parametrize("incoming,expected", [
+    ({"b": [2], "a": [1]}, 1),
+    ({"a": [[1]], "b": [2]}, 2),
+])
+def test_spill_key_preserves_object_order_and_array_structure(tmp_path, monkeypatch, incoming, expected):
+    store = DefaultSessionStore(session_dir=str(tmp_path / "sessions"))
+    monkeypatch.setattr(store, "_spill_dir", lambda: str(tmp_path / "spill"))
+    assert store.add_message("s", "user", {"a": [1], "b": [2]})
+    timestamp = store.get_session("s").messages[0].timestamp
+    spill = store._spill("s", [SessionMessage("user", incoming, timestamp=timestamp)])
+
+    assert len(store.get_chat_history("s")) == expected
+    assert not Path(spill).exists()
+
+
+@pytest.mark.parametrize("existing", [False, True])
+def test_deep_json_content_does_not_abort_recovery(tmp_path, monkeypatch, existing):
+    directory = tmp_path / "sessions"
+    store = DefaultSessionStore(session_dir=str(directory), retention="keep_all")
+    monkeypatch.setattr(store, "_spill_dir", lambda: str(tmp_path / "spill"))
+    # Valid JSON whose recursive key conversion exceeded Python's stack limit.
+    content = json.loads("[" * 500 + "0" + "]" * 500)
+    message = SessionMessage(role="user", content=content, timestamp=123)
+    if existing:
+        assert store.add_message("s", "user", content)
+        message = store.get_session("s").messages[0]
+    spill = store._spill("s", [message])
+    neighbor = store._spill("s", [SessionMessage("user", "neighbor", timestamp=124)])
+
+    history = store.get_chat_history("s")
+
+    assert len(history) == 2
+    assert json.dumps(history[0]["content"]) == json.dumps(content)
+    assert history[1]["content"] == "neighbor"
+    assert not Path(spill).exists()
+    assert not Path(neighbor).exists()
+    reopened = DefaultSessionStore(session_dir=str(directory), retention="keep_all")
+    assert json.dumps(reopened.get_chat_history("s")) == json.dumps(history)
+
+
+def test_json_parse_recursion_failure_preserves_spill_and_recovers_neighbor(tmp_path, monkeypatch):
+    store = DefaultSessionStore(session_dir=str(tmp_path / "sessions"))
+    directory = tmp_path / "spill"
+    monkeypatch.setattr(store, "_spill_dir", lambda: str(directory))
+    neighbor = store._spill("s", [SessionMessage("user", "neighbor", timestamp=124)])
+    bad = directory / "s.000.json"
+    raw = json.dumps({"session_id": "s", "messages": []})
+    bad.write_text(raw, encoding="utf-8")
+    load = json.load
+
+    def decoder(file, *args, **kwargs):
+        if Path(file.name) == bad:
+            raise RecursionError("decoder nesting limit")
+        return load(file, *args, **kwargs)
+
+    monkeypatch.setattr(json, "load", decoder)
+
+    assert store.get_chat_history("s") == [{"role": "user", "content": "neighbor"}]
+    assert bad.read_text(encoding="utf-8") == raw
+    assert not Path(neighbor).exists()
+
+
+@pytest.mark.parametrize("existing", [False, True])
+def test_structured_content_recovers_once(tmp_path, monkeypatch, existing):
+    store = DefaultSessionStore(session_dir=str(tmp_path / "sessions"))
+    monkeypatch.setattr(store, "_spill_dir", lambda: str(tmp_path / "spill"))
+    content = [{"type": "text", "text": "hello"}, {
+        "type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="},
+    }]
+    if existing:
+        assert store.add_message("s", "user", content)
+        msg = store.get_session("s").messages[0]
+    else:
+        msg = SessionMessage(role="user", content=content, timestamp=123)
+    spill = store._spill("s", [msg])
+    assert spill is not None
+    history = store.get_chat_history("s")
+    assert history == [{"role": "user", "content": content}]
+    assert not Path(spill).exists()
+    assert store.get_chat_history("s") == history
+
+
+def test_invalid_utf8_spill_does_not_block_valid_neighbor(tmp_path, monkeypatch):
+    store = DefaultSessionStore(session_dir=str(tmp_path / "sessions"))
+    directory = tmp_path / "spill"
+    monkeypatch.setattr(store, "_spill_dir", lambda: str(directory))
+    spill = store._spill("s", [SessionMessage(role="user", content="recovered", timestamp=123)])
+    bad = directory / "s.000.json"
+    bad.write_bytes(b"\xff\xfeinvalid")
+    assert store.get_chat_history("s") == [{"role": "user", "content": "recovered"}]
+    assert not Path(spill).exists()
+    assert bad.read_bytes() == b"\xff\xfeinvalid"
+
+
+@pytest.mark.parametrize("shape", ["object", "array"])
+@pytest.mark.parametrize("previous,incoming", [(True, 1), (1, 1.0), (False, 0), (True, True)])
+def test_spill_identity_preserves_json_scalar_types(tmp_path, monkeypatch, shape, previous, incoming):
+    directory = tmp_path / "sessions"
+    store = DefaultSessionStore(session_dir=str(directory))
+    m
```

---

### Incident Patch 10: `c5c1f909` (2026-10-05)
**Commit Message**: fix(session): recover failed import indexes and preserve peer updates (#5628)

* fix: forward overwrite through indexed session imports

* fix: retain refreshed portable import cache generations

* fix: preserve newer peer indexes after failed import refresh

* fix(session): invalidate import indexes after SQL refresh failures

* fix(run): guard profiled YAML path against legacy re-dispatch recursion

The profiled YAML runner (_run_from_file_profiled) delegated to the legacy
PraisonAI.run() without setting the PRAISONAI_IN_MODERN_RUN sentinel, so the
legacy dispatcher would re-enter the modern Typer run app and recurse. Set and
restore the sentinel around the profiled run just like _run_from_file, and add
a focused regression.

Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

* fix(session): retain atomic index refresh in portable import repair

* fix(session): recover import file identity after path stat failures

* fix(session): preserve a peer refreshed index of the same generation

* fix(session): invalidate stale indexes after plain peer replacements

* fix: roll back failed outermost index refresh commits

* fix: avoid import backfill lock inversion and retry incomplete pas

**File**: `src/praisonai-agents/praisonaiagents/session/sqlite_store.py` (modified, +249/-42)
```diff
@@ -75,10 +75,13 @@ def __init__(
             db_path = os.path.expanduser(db_path)
         self.db_path = db_path
         self._db_lock = threading.RLock()
+        self._backfill_lock = threading.RLock()
+        self._backfill_running = False
         self._conn = None
         self._fts_available = False
         self._db_ready = False
         self._backfilled = False
+        self._backfill_upgraded_files = {}
 
     # ── index lifecycle ───────────────────────────────────────────────
 
@@ -244,6 +247,7 @@ def _index_session(self, session: SessionData) -> bool:
             with self._db_lock:
                 # A separate WAL reader must see the old or new index record,
                 # never the autocommitted gap between DELETE and INSERT.
+                owns_transaction = not conn.in_transaction
                 conn.execute("SAVEPOINT praisonai_index_refresh")
                 try:
                     conn.execute("DELETE FROM session_fts WHERE session_id = ?", (sid,))
@@ -265,11 +269,21 @@ def _index_session(self, session: SessionData) -> bool:
                         )
                     else:
                         conn.execute("DELETE FROM session_route WHERE session_id = ?", (sid,))
+                    conn.execute(
+                        "DELETE FROM session_index_meta WHERE key = ?",
+                        ("import_pending:" + sid,),
+                    )
+                    conn.execute("RELEASE praisonai_index_refresh")
                 except BaseException:
-                    conn.execute("ROLLBACK TO praisonai_index_refresh")
+                    if conn.in_transaction:
+                        if owns_transaction:
+                            # A failed outermost RELEASE leaves the transaction
+                            # active, including its uncommitted writes and locks.
+                            conn.execute("ROLLBACK")
+                        else:
+                            conn.execute("ROLLBACK TO praisonai_index_refresh")
+                            conn.execute("RELEASE praisonai_index_refresh")
                     raise
-                finally:
-                    conn.execute("RELEASE praisonai_index_refresh")
         except Exception as exc:  # never let indexing break a write
             logger.debug("Session index update failed for %s: %s", sid, exc)
             return False
@@ -288,22 +302,60 @@ def _deindex_session(self, session_id: str) -> None:
             logger.debug("Session de-index failed for %s: %s", session_id, exc)
 
     def _ensure_backfilled(self) -> None:
-        """Backfill the index from existing JSON transcripts exactly once.
+        """Backfill existing transcripts, retrying an incomplete pass.
 
-        Guarded by a one-time flag rather than by an empty-index check: a
+        Guarded by a successful-pass flag rather than an empty-index check: a
         single ``add_message`` on a *new* session could otherwise make the
         index non-empty and permanently skip backfilling pre-existing JSON
         transcripts, silently omitting legacy sessions from search results.
         Only sessions not already present in the index are (re)indexed, so the
         pass is cheap on a warm index.
         """
-        if self._backfilled:
-            return
-        with self._db_lock:
-            if self._backfilled:
+        # Do not hold the database lock while waiting for transcript locks:
+        # imports acquire their file lock before refreshing SQLite.
+        with self._backfill_lock:
+            if self._backfill_running:
                 return
-            self._backfilled = True
-            self._reindex_all()
+            # A corruption callback can query this store during the pass.
+            # It sees the index built so far; other threads wait for completion.
+            self._backfill_running = True
+            try:
+                self._retry_import_indexes()
+                if not self._backfilled:
+                    self._backfilled = self._reindex_all()
+            finally:
+                self._backfill_running = False
+
+    def _retry_import_indexes(self) -> None:
+        """Retry only failed restores, including after reopening the store."""
+        conn = self._connect()
+        if conn is None:
+            return
+        try:
+            with self._db_lock:
+                keys = conn.execute(
+                    "SELECT key FROM session_index_meta WHERE key GLOB 'import_pending:*'"
+                ).fetchall()
+            for (key,) in keys:
+                sid = key[len("import_pending:"):]
+                filepath = self._get_session_path(sid)
+                try:
+                    # Match the writer's file -> database order. File identity
+                    # may be unavailable; the lock still protects this read.
+                    with FileLock(filepath, self.lock_timeout):
+                        if not os.path.isfile(filepath):
+                      
```

**File**: `src/praisonai-agents/praisonaiagents/session/store.py` (modified, +20/-2)
```diff
@@ -2406,8 +2406,28 @@ def _save_imported_session(self, session: SessionData, *, overwrite: bool = True
             if not self._atomic_write_json(filepath, session.to_dict()):
                 logger.error(f"Failed to save imported session {session.session_id}")
                 return False
+            session._import_file_identity = self._session_file_identity(filepath)
+            # Persistence hooks own their cache value; a subclass may refresh
+            # it from a newer durable generation before returning to import.
+            with self._lock:
+                self._cache[session.session_id] = session
             return True
 
+    @staticmethod
+    def _session_file_identity(filepath):
+        """Identify an atomic file generation without depending on wall-clock ordering."""
+        try:
+            stat = os.stat(filepath)
+        except OSError:
+            # A path metadata failure need not make the atomic generation
+            # unknowable: an opened descriptor can still identify that file.
+            try:
+                with open(filepath, "rb") as current:
+                    stat = os.fstat(current.fileno())
+            except OSError:
+                return None
+        return stat.st_dev, stat.st_ino, stat.st_mtime_ns, stat.st_size
+
     def import_sessions(
         self,
         payload: Dict[str, Any],
@@ -2507,8 +2527,6 @@ def import_sessions(
                         {"session_id": session_id, "reason": "write failed"}
                     )
                     continue
-                with self._lock:
-                    self._cache[session_id] = session
                 report.imported += 1
             except FileExistsError:
                 report.skipped.append(
```

**File**: `src/praisonai-agents/tests/unit/session/test_import_backfill_reentrant.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+"""Backfill callbacks may query the same indexed store without restarting a pass."""
+
+import threading
+
+import pytest
+
+from praisonaiagents.session.sqlite_store import SqliteSessionStore
+
+
+@pytest.mark.parametrize("query", ["route", "search"])
+def test_corruption_callback_can_query_same_store(tmp_path, monkeypatch, query):
+    store = SqliteSessionStore(session_dir=str(tmp_path), db_path=":memory:")
+    assert store.add_message("healthy", "user", "narwhal record")
+    assert store.set_gateway_info("healthy", gateway_session_id="gateway")
+    assert store.get_by_gateway_session("gateway") is not None
+    (tmp_path / "broken.json").write_text("{invalid", encoding="utf-8")
+    store._backfilled = False
+    results, failures = [], []
+
+    def on_corruption(*args):
+        if query == "route":
+            results.append(store.get_by_gateway_session("gateway").session_id)
+        else:
+            results.append([hit.session_id for hit in store.search("narwhal")])
+
+    monkeypatch.setattr(store, "_fire_corruption_hook", on_corruption)
+
+    def backfill():
+        try:
+            store._ensure_backfilled()
+        except BaseException as exc:
+            failures.append(exc)
+
+    worker = threading.Thread(target=backfill, daemon=True)
+    worker.start()
+    worker.join(2)
+    try:
+        assert not worker.is_alive(), "callback query deadlocked during backfill"
+        assert failures == []
+        expected = ["healthy"] if query == "route" else [["healthy"]]
+        assert results == expected
+        assert store._backfilled
+    finally:
+        if not worker.is_alive() and store._conn is not None:
+            store._conn.close()
+
+
+def test_raised_backfill_releases_running_guard_for_retry(tmp_path, monkeypatch):
+    store = SqliteSessionStore(session_dir=str(tmp_path), db_path=":memory:")
+    original = store._reindex_all
+
+    def fail():
+        raise RuntimeError("failed pass")
+
+    monkeypatch.setattr(store, "_reindex_all", fail)
+    try:
+        with pytest.raises(RuntimeError, match="failed pass"):
+            store._ensure_backfilled()
+        assert not store._backfilled
+        monkeypatch.setattr(store, "_reindex_all", original)
+        store._ensure_backfilled()
+        assert store._backfilled
+    finally:
+        if store._conn is not None:
+            store._conn.close()
```

**File**: `src/praisonai-agents/tests/unit/session/test_session_import_no_clobber.py` (modified, +3/-2)
```diff
@@ -11,9 +11,10 @@
 
 @pytest.mark.parametrize("kind", [DefaultSessionStore, SqliteSessionStore])
 @pytest.mark.parametrize("overwrite", [False, True])
-def test_import_rechecks_new_peer_session_under_write_lock(tmp_path, monkeypatch, kind, overwrite):
+@pytest.mark.parametrize("peer_kind", [DefaultSessionStore, SqliteSessionStore])
+def test_import_rechecks_new_peer_session_under_write_lock(tmp_path, monkeypatch, kind, overwrite, peer_kind):
     directory = str(tmp_path / "sessions")
-    stores = [kind(session_dir=directory), kind(session_dir=directory)]
+    stores = [kind(session_dir=directory), peer_kind(session_dir=directory)]
     importer, peer = stores
     ready, completed = Event(), Event()
     original = importer._save_imported_session
```

**File**: `src/praisonai-agents/tests/unit/session/test_session_index_atomic_refresh.py` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ def test_wal_reader_retains_session_during_or_after_failed_index_refresh(tmp_pat
         reader = sqlite3.connect(store.db_path, isolation_level=None)
 
         class PausedConnection:
+            @property
+            def in_transaction(self):
+                return conn.in_transaction
+
             def execute(self, sql, parameters=()):
                 if failure and sql.startswith("INSERT INTO session_fts"):
                     raise sqlite3.OperationalError("injected index insert failure")
```

**File**: `src/praisonai-agents/tests/unit/session/test_sqlite_import_index.py` (modified, +597/-2)
```diff
@@ -2,10 +2,12 @@
 
 import pytest
 import threading
+import os
+import sqlite3
 from concurrent.futures import ThreadPoolExecutor
 
 from praisonaiagents.session.sqlite_store import SqliteSessionStore
-from praisonaiagents.session.store import DefaultSessionStore
+from praisonaiagents.session.store import DefaultSessionStore, FileLock
 
 
 @pytest.fixture
@@ -129,6 +131,13 @@ def delayed_save(store, session, *, overwrite=True):
             finally:
                 resume.set()
             assert importing.result(timeout=5).imported == 1
+        assert destination._cache["session"].messages[0].content == "narwhal newer turn"
+        with monkeypatch.context() as fallback:
+            def unavailable(*args):
+                raise OSError("temporary read failure")
+
+            fallback.setattr(destination, "_load_session_from_disk", unavailable)
+            assert destination._read_session_fresh("session").messages[0].content == "narwhal newer turn"
         destination.invalidate_cache()
         assert destination.get_session("session").messages[0].content == "narwhal newer turn"
         assert [hit.session_id for hit in destination.search("narwhal")] == ["session"]
@@ -181,7 +190,593 @@ def unavailable(*args):
     assert saved.gateway_session_id is None
     assert saved.agent_id is None
     assert saved.messages[0].content == "narwhal replacement"
-    assert destination.search("narwhal") == []
+    assert [hit.session_id for hit in destination.search("narwhal")] == ["session"]
     assert destination.add_message("session", "user", "later update")
     assert [hit.session_id for hit in destination.search("narwhal")] == ["session"]
     assert destination.get_by_gateway_session("old-gateway") is None
+
+
+@pytest.mark.parametrize("existing_index", [False, True])
+@pytest.mark.parametrize("stat_failure", [False, True])
+def test_failed_import_refresh_preserves_new_peer_index(make_store, monkeypatch, existing_index, stat_failure):
+    source = make_store(DefaultSessionStore)
+    assert source.add_message("session", "user", "imported pelican")
+    destination = make_store(SqliteSessionStore)
+    if existing_index:
+        assert destination.add_message("session", "user", "old otter")
+    destination.search("pelican")
+    peer = SqliteSessionStore(session_dir=destination.session_dir, db_path=destination.db_path)
+    original = DefaultSessionStore._save_imported_session
+    original_stat = os.stat
+
+    def unavailable_stat(path, *args, **kwargs):
+        if os.fspath(path) == destination._get_session_path("session"):
+            raise OSError("path stat temporarily unavailable")
+        return original_stat(path, *args, **kwargs)
+
+    def save_then_peer_write(store, session, **kwargs):
+        saved = original(store, session, **kwargs)
+        assert peer.set_chat_history("session", [{"role": "user", "content": "newer narwhal"}])
+        assert peer.set_gateway_info("session", gateway_session_id="new-route", agent_id="new-agent")
+        if stat_failure:
+            monkeypatch.setattr(os, "stat", unavailable_stat)
+        return saved
+
+    def unavailable(*args):
+        raise OSError("post-import refresh unavailable")
+
+    monkeypatch.setattr(DefaultSessionStore, "_save_imported_session", save_then_peer_write)
+    monkeypatch.setattr(destination, "_load_session_from_disk", unavailable)
+    try:
+        assert destination.import_sessions(source.export_all(), overwrite=existing_index).imported == 1
+        conn = destination._connect()
+        assert conn.execute("SELECT content FROM session_fts WHERE session_id = ?", ("session",)).fetchone() == ("newer narwhal",)
+        assert conn.execute("SELECT gateway_session_id, agent_id FROM session_route WHERE session_id = ?", ("session",)).fetchone() == ("new-route", "new-agent")
+    finally:
+        if peer._conn is not None:
+            peer._conn.close()
+
+
+@pytest.mark.parametrize("peer_write", [False, True])
+def test_post_import_sql_failure_invalidates_all_old_index_views(make_store, monkeypatch, peer_write):
+    source = make_store(DefaultSessionStore)
+    assert source.add_message("session", "user", "narwhal replacement")
+    destination = make_store(SqliteSessionStore)
+    assert destination.add_message("session", "user", "pelican original")
+    assert destination.set_gateway_info("session", gateway_session_id="old-gateway", agent_id="old-agent")
+    assert destination.search("pelican")
+    conn = destination._connect()
+    conn.execute("CREATE TRIGGER fail_import_metadata BEFORE INSERT ON session_meta "
+                 "BEGIN SELECT RAISE(FAIL, 'injected index failure'); END")
+    if peer_write:
+        peer = DefaultSessionStore(session_dir=destination.session_dir)
+        original = DefaultSessionStore._save_imported_session
+
+        def save_then_peer_write(store, session, **kwargs):
+            saved = original(store, session, **kwargs)
+            assert peer.set_chat_history("session",
```

---

### Incident Patch 11: `3bdfbb8d` (2026-10-03)
**Commit Message**: test: add regression tests for shared run-lock helper

Covers stable per-instance identity, both plain-attribute (AgentTeam) and
preset-None dataclass-field (Workflow) cases, and single-lock observation
under a concurrent first-access race (double-checked locking). Addresses
Greptile P2 finding that the shared concurrency path lacked a regression test.

Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

**File**: `src/praisonai-agents/tests/unit/test_run_lock.py` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+"""Regression tests for the shared lazy run-lock helper (``_run_lock``).
+
+AgentTeam and Workflow/AgentFlow both delegate their ``_execution_lock`` to
+``ensure_run_lock``; these tests pin the invariants that delegation relies on:
+stable per-instance identity, support for both the plain-attribute and
+preset-``None`` dataclass-field cases, and a single shared lock object under a
+concurrent first-access race (double-checked locking).
+"""
+import threading
+
+from praisonaiagents._run_lock import ensure_run_lock
+
+
+class _PlainAttr:
+    """Mimics AgentTeam: ``_run_lock`` is a plain (missing) attribute."""
+
+
+class _PresetNoneField:
+    """Mimics the Workflow dataclass field defaulting to ``None``."""
+
+    def __init__(self):
+        self._run_lock = None
+
+
+def test_mints_and_returns_stable_lock_plain_attribute():
+    obj = _PlainAttr()
+    lock = ensure_run_lock(obj)
+    assert lock is not None
+    assert ensure_run_lock(obj) is lock
+    assert obj._run_lock is lock
+
+
+def test_mints_and_returns_stable_lock_preset_none_field():
+    obj = _PresetNoneField()
+    lock = ensure_run_lock(obj)
+    assert lock is not None
+    assert ensure_run_lock(obj) is lock
+    assert obj._run_lock is lock
+
+
+def test_distinct_instances_get_distinct_locks():
+    assert ensure_run_lock(_PlainAttr()) is not ensure_run_lock(_PlainAttr())
+
+
+def test_concurrent_first_access_observes_single_lock():
+    """Threads racing into the first access must all observe the same lock."""
+    obj = _PlainAttr()
+    start = threading.Event()
+    observed = []
+    observed_guard = threading.Lock()
+
+    def _race():
+        start.wait(5)
+        lock = ensure_run_lock(obj)
+        with observed_guard:
+            observed.append(lock)
+
+    threads = [threading.Thread(target=_race) for _ in range(16)]
+    for t in threads:
+        t.start()
+    start.set()
+    for t in threads:
+        t.join(5)
+
+    assert len(observed) == 16
+    assert all(lock is observed[0] for lock in observed)
+    assert obj._run_lock is observed[0]
```

---

### Incident Patch 12: `22ee4fe3` (2026-10-03)
**Commit Message**: refactor: extract shared lazy run-lock helper (fixes #5653)

Consolidate the duplicate double-checked-locking idiom (_RUN_LOCK_INIT_GUARD
+ _execution_lock) from agents/agents.py and workflows/workflows.py into a
single praisonaiagents/_run_lock.py helper. Behaviour-preserving: getattr-based
access works for both the dataclass-field (Workflow) and plain-attribute
(AgentTeam) cases. No public API or behaviour changes.

Co-authored-by: MervinPraison <[REDACTED_EMAIL]>

**File**: `src/praisonai-agents/praisonaiagents/_run_lock.py` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+"""Shared lazy run-lock helper for core orchestration modules.
+
+AgentTeam (``agents/agents.py``) and Workflow/AgentFlow (``workflows/workflows.py``)
+both lazily mint a per-instance re-entrancy lock the first time a run begins.
+Creation is serialized through a single module-level guard (double-checked
+locking) so two threads racing into the first ``start()``/``astart()``/``run()``
+observe the *same* lock object rather than each minting and acquiring its own.
+"""
+import threading
+
+# Guards lazy creation of each instance's per-instance ``_run_lock`` so two
+# threads that first reach start()/astart()/run() concurrently observe the same
+# lock object (double-checked locking) rather than each minting its own.
+_RUN_LOCK_INIT_GUARD = threading.Lock()
+
+
+def ensure_run_lock(obj):
+    """Lazily mint ``obj._run_lock`` under a shared module guard.
+
+    ``getattr(obj, "_run_lock", None)`` works for both the dataclass-field case
+    (Workflow) and the plain-attribute case (AgentTeam), so the behaviour is
+    identical to the per-module implementations it replaces.
+    """
+    lock = getattr(obj, "_run_lock", None)
+    if lock is None:
+        with _RUN_LOCK_INIT_GUARD:
+            lock = getattr(obj, "_run_lock", None)
+            if lock is None:
+                lock = threading.Lock()
+                obj._run_lock = lock
+    return lock
```

**File**: `src/praisonai-agents/praisonaiagents/agents/agents.py` (modified, +2/-12)
```diff
@@ -24,10 +24,7 @@
 except ImportError:
     get_token_collector = None
 
-# Guards lazy creation of each AgentTeam's per-instance _run_lock so two threads
-# that first reach start()/astart() concurrently observe the same lock object
-# (double-checked locking) rather than each minting and acquiring its own.
-_RUN_LOCK_INIT_GUARD = threading.Lock()
+from .._run_lock import ensure_run_lock
 
 # Task status constants
 class TaskStatus(Enum):
@@ -2088,14 +2085,7 @@ def _execution_lock(self):
         guard (double-checked locking) so two threads racing into start()/astart()
         observe the same lock object.
         """
-        lock = getattr(self, '_run_lock', None)
-        if lock is None:
-            with _RUN_LOCK_INIT_GUARD:
-                lock = getattr(self, '_run_lock', None)
-                if lock is None:
-                    lock = threading.Lock()
-                    self._run_lock = lock
-        return lock
+        return ensure_run_lock(self)
 
     def _execution_identity(self):
         """Identity of the current execution for re-entrancy checks.
```

**File**: `src/praisonai-agents/praisonaiagents/workflows/workflows.py` (modified, +2/-13)
```diff
@@ -25,7 +25,6 @@
 import copy
 import time
 import logging
-import threading
 from praisonaiagents._logging import get_logger
 from pathlib import Path
 from typing import Any, Dict, List, Optional, Callable, Tuple, Union
@@ -48,10 +47,7 @@
 # summarisation request consumes roughly as many tokens as it saves.
 MIN_BRANCHES_FOR_LLM_SUMMARY = 3
 
-# Guards lazy creation of each Workflow's per-instance _run_lock so two threads
-# entering run()/astart() concurrently on a fresh instance cannot each create
-# and acquire a *different* lock object (which would defeat the run guard).
-_RUN_LOCK_INIT_GUARD = threading.Lock()
+from .._run_lock import ensure_run_lock
 
 
 class _WriteTrackingDict(dict):
@@ -796,14 +792,7 @@ def _execution_lock(self):
         first reach run()/astart() concurrently observe the *same* lock object
         (double-checked locking) rather than each minting and acquiring its own.
         """
-        lock = self._run_lock
-        if lock is None:
-            with _RUN_LOCK_INIT_GUARD:
-                lock = self._run_lock
-                if lock is None:
-                    lock = threading.Lock()
-                    self._run_lock = lock
-        return lock
+        return ensure_run_lock(self)
 
     def __post_init__(self):
         """Resolve consolidated params to internal values."""
```

---

### Incident Patch 13: `1ff45385` (2026-10-03)
**Commit Message**: fix: preserve subsecond native tool-timeout when forwarding to core (#5650)

The native adapter rounded the resolved per-agent budget via int(round())
before building ToolConfig, collapsing subsecond budgets (e.g. 0.4 -> 0).
Core treats a non-positive timeout as "no timeout" and the native callable
is left unwrapped, so enforcement was silently lost. Core consumes
ToolConfig.timeout directly as seconds (float) on both sync and async paths,
so forward the budget unrounded. Adds a subsecond regression test.

Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

**File**: `src/praisonai/praisonai/framework_adapters/praisonai_adapter.py` (modified, +9/-1)
```diff
@@ -612,7 +612,15 @@ def _build_agents_and_tasks(
                 if isinstance(budget, (int, float)) and not isinstance(budget, bool) and budget > 0:
                     try:
                         from praisonaiagents.config.feature_configs import ToolConfig
-                        agent_kwargs['tool_config'] = ToolConfig(timeout=int(round(budget)))
+                        # Preserve the resolved budget as-is (float seconds).
+                        # Core consumes ToolConfig.timeout directly as seconds in
+                        # both the sync (future.result(timeout=...)) and async
+                        # (asyncio.wait_for(timeout=...)) paths, so fractional
+                        # budgets survive. Rounding to int would collapse a
+                        # subsecond budget (e.g. 0.4 -> 0), and core treats a
+                        # non-positive timeout as "no timeout" — silently dropping
+                        # enforcement for native callables that are now unwrapped.
+                        agent_kwargs['tool_config'] = ToolConfig(timeout=budget)
                     except Exception as _tc_err:
                         logger.warning(
                             "Could not set core tool_config timeout for agent %r: %s",
```

**File**: `src/praisonai/tests/unit/test_tool_timeout_enforcement.py` (modified, +49/-0)
```diff
@@ -924,3 +924,52 @@ def _native_resolver(agent_key):
     tc = captured.get("tool_config")
     assert isinstance(tc, ToolConfig)
     assert tc.timeout == 7
+
+
+def test_native_adapter_preserves_subsecond_tool_timeout():
+    # Regression (#5650 review): a subsecond per-agent budget must survive the
+    # forward to core unrounded. Previously the adapter did int(round(budget)),
+    # collapsing 0.4 -> 0; core treats a non-positive timeout as "no timeout"
+    # and the native callable is left unwrapped, so enforcement was silently
+    # lost. The fractional budget must reach core intact.
+    try:
+        from praisonai.framework_adapters.praisonai_adapter import PraisonAIAdapter
+        from praisonaiagents.config.feature_configs import ToolConfig
+    except ImportError:
+        pytest.skip("PraisonAIAdapter / core ToolConfig not available")
+
+    import praisonaiagents
+    from unittest import mock
+
+    adapter = PraisonAIAdapter.__new__(PraisonAIAdapter)
+    adapter._format_template = lambda v, topic="": v
+
+    captured = {}
+
+    class _FakeAgent:
+        def __init__(self, **kwargs):
+            captured.update(kwargs)
+
+    class _FakeTask:
+        def __init__(self, **kwargs):
+            pass
+
+    config = {"roles": {"a": {"role": "A", "tool_timeout": 0.4, "tools": []}}}
+
+    def _native_resolver(agent_key):
+        return 0.4 if agent_key == "a" else None
+
+    cli_config = {"_native_tool_timeout_resolver": _native_resolver}
+
+    with mock.patch.object(praisonaiagents, "Agent", _FakeAgent), \
+         mock.patch.object(praisonaiagents, "Task", _FakeTask):
+        adapter._build_agents_and_tasks(
+            config, "topic", {}, None, None, "gpt-4o-mini",
+            cli_config=cli_config,
+        )
+
+    tc = captured.get("tool_config")
+    assert isinstance(tc, ToolConfig)
+    # Fractional budget preserved exactly (not rounded to 0, not to 1).
+    assert tc.timeout == 0.4
+    assert tc.timeout > 0
```

---

### Incident Patch 14: `6b6c3f51` (2026-10-03)
**Commit Message**: fix: forward native tool-timeout to core instead of wrapper-side pool (fixes #5650)

On the praisonai-native execution path, a plain callable already flows
through core's tool executor (agent/tool_execution.py), which enforces
the per-tool timeout with the same abandon-on-expiry semantics. The
wrapper no longer stands up a second ThreadPoolExecutor for those tools:
it leaves native callables unwrapped and forwards the resolved per-agent
tool_timeout to the core Agent via tool_config=ToolConfig(timeout=...).

Framework tool objects (CrewAI/AutoGen/LangChain BaseTool) never reach
core's executor, so they are still wrapped in place to preserve their
args_schema. Non-native frameworks keep the existing wrapper-side guard.
No new API surface; backward-compatible (flag defaults off).

Co-authored-by: MervinPraison <[REDACTED_EMAIL]>

**File**: `src/praisonai/praisonai/agents_generator.py` (modified, +80/-4)
```diff
@@ -373,7 +373,7 @@ def _make_timeout_proxy(inner, wrapped_run=None, wrapped__run=None):
     return proxy
 
 
-def _wrap_with_timeout(tool, timeout_seconds: float, executor_factory, on_leaked=None, owner_key=None):
+def _wrap_with_timeout(tool, timeout_seconds: float, executor_factory, on_leaked=None, owner_key=None, native_delegates_to_core=False):
     """Enforce a per-call timeout on a tool, sync or async.
 
     For async tools the underlying task is cancelled on timeout. For sync tools
@@ -387,10 +387,33 @@ def _wrap_with_timeout(tool, timeout_seconds: float, executor_factory, on_leaked
     On timeout the wrapper raises :class:`ToolTimeoutError` rather than returning
     a JSON string, so a tool's declared return-type contract is never silently
     downgraded; the framework adapter decides how to surface the timeout.
+
+    ``native_delegates_to_core``: when True, a *plain native callable* (not a
+    framework tool object) is returned unwrapped so core's own per-tool timeout
+    enforcement (``praisonaiagents`` ``agent/tool_execution.py`` /
+    ``tools/call_executor.py``, configured via the agent's ``tool_config``
+    timeout) owns it — avoiding a second, duplicated abandon-on-timeout thread
+    pool for tools that already flow through core (#5650). Framework tool
+    objects (CrewAI/AutoGen/LangChain ``BaseTool``) never reach core's executor,
+    so they are *always* wrapped here to preserve their ``args_schema``.
     """
     if timeout_seconds is None or timeout_seconds <= 0:
         return tool
 
+    # praisonai-native path: a plain callable already flows through core's tool
+    # executor, which enforces the resolved per-tool timeout. Returning it
+    # unwrapped lets core own the abandon-on-expiry semantics instead of the
+    # wrapper standing up a second thread pool with the same behaviour. Only
+    # framework tool objects (which bypass core) still need wrapper wrapping, so
+    # they fall through to the logic below.
+    if (
+        native_delegates_to_core
+        and callable(tool)
+        and not isinstance(tool, type)
+        and not _looks_like_framework_tool(tool)
+    ):
+        return tool
+
     import asyncio
     import concurrent.futures
     import functools
@@ -775,14 +798,31 @@ def _note_leaked_worker(self):
         with self._tool_timeout_executor_lock:
             self._leaked_workers += 1
 
-    def _wrap_tool_with_timeout(self, tool, timeout_seconds):
-        """Wrap a tool with this generator's instance-owned timeout executor."""
+    def _wrap_tool_with_timeout(self, tool, timeout_seconds, native_delegates_to_core=None):
+        """Wrap a tool with this generator's instance-owned timeout executor.
+
+        On the praisonai-native framework the resolved per-tool timeout is
+        enforced by core (``praisonaiagents`` ``agent/tool_execution.py``, wired
+        via the agent's ``tool_config`` timeout), so a *native* callable is left
+        unwrapped here instead of being bound to a second wrapper-owned thread
+        pool with the same abandon-on-expiry semantics (#5650). Framework tool
+        objects (CrewAI/AutoGen/LangChain ``BaseTool``) bypass core, so they are
+        still wrapped.
+
+        ``native_delegates_to_core``: callers that already know the resolved
+        framework (the per-run wrap/resolver closures) pass it explicitly;
+        otherwise it is inferred from ``self.framework`` (resolved to the chosen
+        adapter name by the time an adapter invokes a wrap closure at run time).
+        """
+        if native_delegates_to_core is None:
+            native_delegates_to_core = (getattr(self, "framework", None) or "") == "praisonai"
         return _wrap_with_timeout(
             tool,
             timeout_seconds,
             self._get_tool_timeout_executor,
             on_leaked=self._note_leaked_worker,
             owner_key=self._timeout_owner_key,
+            native_delegates_to_core=native_delegates_to_core,
         )
 
     def close(self):
@@ -1080,11 +1120,35 @@ def _build_tools_dict(self, config):
         # that when the *same* generator instance is reused with a different
         # timeout layout, a stale closure from a previous run can never leak into
         # the adapters and apply the wrong budget to the current run.
+        # Resolve the chosen framework now (the same registry resolution the
+        # run prep uses) so native-vs-framework tool handling is decided BEFORE
+        # the uniform wrap is applied eagerly below — ``self.framework`` is not
+        # yet updated to the resolved adapter name at this point in the run.
+        _requested_framework = getattr(self, "framework", None) or config.get('framework')
+        registry = getattr(self, "_adapter_registry", None)
+        try:
+            resolved_framework = (
+                registry.resolve_or_default(_requested_framework)
+                if registry is not None else _requested_framework
+            )
+        except E
```

**File**: `src/praisonai/praisonai/framework_adapters/praisonai_adapter.py` (modified, +23/-1)
```diff
@@ -596,7 +596,29 @@ def _build_agents_and_tasks(
             # Add approval config if present
             if agent_approval:
                 agent_kwargs['approval'] = agent_approval
-            
+
+            # Forward the resolved per-agent tool_timeout to core so native
+            # tools are enforced by core's own per-tool timeout (#5650) instead
+            # of a duplicate wrapper-side executor. The generator exposes the
+            # resolved budget only on the native framework; framework tool
+            # objects keep wrapper-side wrapping. A user-supplied tool_config in
+            # YAML (details['llm'] etc.) is not overridden here — this only
+            # fills the timeout the wrapper would otherwise have enforced.
+            native_timeout_resolver = (cli_config or {}).get(
+                "_native_tool_timeout_resolver"
+            )
+            if callable(native_timeout_resolver) and 'tool_config' not in agent_kwargs:
+                budget = native_timeout_resolver(role)
+                if isinstance(budget, (int, float)) and not isinstance(budget, bool) and budget > 0:
+                    try:
+                        from praisonaiagents.config.feature_configs import ToolConfig
+                        agent_kwargs['tool_config'] = ToolConfig(timeout=int(round(budget)))
+                    except Exception as _tc_err:
+                        logger.warning(
+                            "Could not set core tool_config timeout for agent %r: %s",
+                            role_filled, _tc_err,
+                        )
+
             agent = PraisonAgent(**agent_kwargs)
             
             if agent_callback:
```

**File**: `src/praisonai/tests/unit/test_tool_timeout_enforcement.py` (modified, +192/-0)
```diff
@@ -732,3 +732,195 @@ def submit(self, fn, *a, **k):
         assert wrapped(21) == 42
     finally:
         live.shutdown()
+
+
+# --- Issue #5650: native tools delegate per-tool timeout to core --------------
+
+
+def test_native_delegation_returns_plain_callable_unwrapped():
+    # On the native framework a plain callable is enforced by core's own tool
+    # executor, so the wrapper must NOT bind it to a second pool — it returns
+    # the callable unchanged (identity) rather than a timeout wrapper.
+    from praisonai.agents_generator import _wrap_with_timeout
+
+    def tool(x):
+        return x + 1
+
+    def _factory():  # must never be consulted on the native path
+        raise AssertionError("native plain callable must not build an executor")
+
+    wrapped = _wrap_with_timeout(
+        tool, 5.0, _factory, owner_key=uuid.uuid4(), native_delegates_to_core=True
+    )
+    assert wrapped is tool
+
+
+def test_native_delegation_still_wraps_framework_tool_objects():
+    # Framework tool objects (CrewAI/LangChain BaseTool) never reach core's
+    # executor, so even on the native path they must still be wrapped so their
+    # args_schema survives and the per-call timeout is enforced by the wrapper.
+    from concurrent.futures import ThreadPoolExecutor
+
+    from praisonai.agents_generator import _wrap_with_timeout, _TimeoutBoundTool
+
+    class FrameworkTool:
+        name = "calc"
+        description = "doubles x"
+        args_schema = {"x": "int"}
+
+        def _run(self, x=1):
+            return x * 2
+
+        def run(self, x=1):
+            return self._run(x)
+
+    inner = FrameworkTool()
+    executor = ThreadPoolExecutor(max_workers=2)
+    try:
+        proxy = _wrap_with_timeout(
+            inner, 5.0, lambda: executor, owner_key=uuid.uuid4(),
+            native_delegates_to_core=True,
+        )
+        # Framework objects are still wrapped (schema-preserving proxy), never
+        # passed through as the bare inner object.
+        assert proxy is not inner
+        assert isinstance(proxy, _TimeoutBoundTool)
+        assert isinstance(proxy, FrameworkTool)
+        assert proxy.args_schema == {"x": "int"}
+        assert proxy.run(x=3) == 6
+    finally:
+        executor.shutdown()
+
+
+def test_native_delegation_off_by_default_wraps_everything():
+    # Backward compatibility: without the flag a plain callable is wrapped as
+    # before (crewai/autogen frameworks that never flow through core).
+    from concurrent.futures import ThreadPoolExecutor
+    from praisonai.agents_generator import _wrap_with_timeout
+
+    def tool(x):
+        return x + 1
+
+    executor = ThreadPoolExecutor(max_workers=1)
+    try:
+        wrapped = _wrap_with_timeout(
+            tool, 5.0, lambda: executor, owner_key=uuid.uuid4()
+        )
+        # A wrapper was installed (not identity), preserving existing behaviour.
+        assert wrapped is not tool
+        assert wrapped(41) == 42
+    finally:
+        executor.shutdown()
+
+
+def test_build_tools_dict_native_leaves_plain_callables_unwrapped():
+    # End-to-end on the native framework: the uniform CLI timeout no longer
+    # wraps plain callables (core enforces), and the generator exposes the raw
+    # per-agent budget so the native adapter can set the core tool_config.
+    gen = _make_generator()
+    gen.framework = "praisonai"
+    gen.cli_config = {"tool_timeout": 5}
+
+    def sentinel():
+        return "ok"
+
+    class _FakeResolver:
+        def resolve_all_from_yaml(self, config):
+            return {"plain": sentinel}
+
+    gen.tool_resolver = _FakeResolver()
+    gen.tools = []
+
+    try:
+        tools_dict = gen._build_tools_dict({"roles": {"a": {}}})
+        # Native path: plain callable is left unwrapped for core to enforce.
+        assert tools_dict["plain"] is sentinel
+        # The raw per-agent timeout resolver is exposed for the native adapter.
+        native_resolver = gen._run_ctx.get("_native_tool_timeout_resolver")
+        assert callable(native_resolver)
+        assert native_resolver("a") == 5.0
+    finally:
+        gen.close()
+
+
+def test_build_tools_dict_non_native_still_wraps_and_no_native_resolver():
+    # A non-native framework keeps wrapper-side wrapping and exposes no native
+    # timeout resolver (core does not own those tools).
+    gen = _make_generator()
+    gen.framework = "crewai"
+    gen.cli_config = {"tool_timeout": 5}
+
+    never = threading.Event()
+
+    def _blocking():
+        never.wait(30)
+        return "done"
+
+    class _FakeResolver:
+        def resolve_all_from_yaml(self, config):
+            return {"blocking": _blocking}
+
+    gen.tool_resolver = _FakeResolver()
+    gen.tools = []
+
+    try:
+        from praisonai.agents_generator import ToolTimeoutError
+        tools_dict = gen._build_tools_dict({"roles": {"a": {}}})
+        # Non-native: the plain callable is still wrapped (identity changed).
+        assert tools_dict["blocking"] is
```

---

### Incident Patch 15: `921608eb` (2026-10-03)
**Commit Message**: test: add shared-key contention regression test for AgentRegistry lock

Address greptile P2: the existing concurrent test used a distinct number per
worker (no shared-key contention) and accepted the fallback, so it could pass
even with the lock removed. Add a reader/writer test where writers churn an
overlapping key set while many readers snapshot concurrently — this surfaces
the exact race (RuntimeError: dictionary changed size during iteration / torn
resolve) that the per-instance lock + __iter__ snapshot prevent.

Co-authored-by: Mervin Praison <[REDACTED_EMAIL]>

**File**: `src/praisonai-bot/tests/unit/bots/test_agent_registry.py` (modified, +61/-0)
```diff
@@ -145,6 +145,67 @@ def worker(number: str, agent: _FakeAgent) -> None:
 
         assert not errors, f"concurrent access raised: {errors[:3]}"
 
+    def test_shared_key_churn_during_iteration_is_race_free(self):
+        """Readers iterating/snapshotting while writers churn a shared key.
+
+        This is the case that a missing lock surfaces: on an unguarded dict,
+        ``numbers()``/``__iter__``/``__len__`` taken while another thread is
+        mutating the *same* keys can raise ``RuntimeError: dictionary changed
+        size during iteration`` or observe a torn ``resolve``. Writers add and
+        remove a small, overlapping key set as fast as possible while readers
+        continuously snapshot; the run must complete with zero errors and every
+        resolved value must be a known agent or the fallback.
+        """
+        import threading
+
+        keys = [f"+1415555{i:04d}" for i in range(8)]
+        agents = {k: _FakeAgent(k) for k in keys}
+        known = set(agents.values())
+        fallback = _FakeAgent("default")
+        reg = AgentRegistry(default_agent=fallback)
+        errors: list[Exception] = []
+        stop = threading.Event()
+        n_readers = 16
+        n_writers = 8
+        barrier = threading.Barrier(n_readers + n_writers)
+
+        def writer() -> None:
+            try:
+                barrier.wait()
+                while not stop.is_set():
+                    for k in keys:
+                        reg.assign(k, agents[k])
+                    for k in keys:
+                        reg.unassign(k)
+            except Exception as exc:  # pragma: no cover - failure path
+                errors.append(exc)
+
+        def reader() -> None:
+            try:
+                barrier.wait()
+                for _ in range(2000):
+                    list(reg.numbers())
+                    dict(reg)
+                    len(reg)
+                    for k in keys:
+                        resolved = reg.resolve(k)
+                        assert resolved in known or resolved is fallback
+            except Exception as exc:  # pragma: no cover - failure path
+                errors.append(exc)
+
+        threads = [threading.Thread(target=writer) for _ in range(n_writers)]
+        threads += [threading.Thread(target=reader) for _ in range(n_readers)]
+        for t in threads:
+            t.start()
+        # readers finish their bounded loops; then release writers.
+        for t in threads[n_writers:]:
+            t.join()
+        stop.set()
+        for t in threads[:n_writers]:
+            t.join()
+
+        assert not errors, f"shared-key concurrent access raised: {errors[:3]}"
+
     def test_iter_snapshot_is_stable_under_mutation(self):
         """``__iter__`` returns a stable snapshot, not a live view.
 
```

#### Recent Merged Pull Requests:
- **PR #5660** (2026-10-05): fix: harden ACP session store, atomic JSON writes, and scheduler PID safety (@praisonai-triage-agent[bot])
- **PR #5656** (2026-10-03): refactor: extract shared lazy run-lock helper (@praisonai-triage-agent[bot])
- **PR #5652** (2026-10-03): fix: forward native tool-timeout to core (fixes #5650) (@praisonai-triage-agent[bot])
- **PR #5648** (2026-10-05): fix: add resolved-config snapshot/export for gateway (#5646) (@praisonai-triage-agent[bot])
- **PR #5647** (2026-10-03): fix: make AgentRegistry inbound routing thread-safe (@praisonai-triage-agent[bot])
- **PR #5641** (2026-10-03): fix: async-safe sync hooks/compaction + bounded session cache (@praisonai-triage-agent[bot])
- **PR #5638** (2026-10-02): fix(ci): tolerate 403 clearing conflict-pending on fork PRs (@MervinPraison)
- **PR #5636** (2026-10-02): fix: capture re-entrancy sentinel before guarded import in YAML runner (@praisonai-triage-agent[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
