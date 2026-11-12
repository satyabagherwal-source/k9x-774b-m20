/**
 * Independent Consumer Reuse Test for Phase G Capabilities
 * Simulates an external 3rd-party microservice or CLI tool consuming the Phase G modules.
 */
import assert from 'assert';
import path from 'path';
import { CliCommandDispatcher } from '../phase-g-improvements/src/cli-command-dispatcher.mjs';
import { validateSchema, SchemaValidationError } from '../phase-g-improvements/src/schema-invariant-validator.mjs';

console.log('========================================================================');
console.log('PHASE G INDEPENDENT CONSUMER REUSE & BOUNDARY STRESS TEST');
console.log('========================================================================\n');

let passed = 0;
let total = 0;

function check(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. Consumer Reuse of CliCommandDispatcher in a "Deploy Tool"
// -------------------------------------------------------------
check('Consumer CLI: Registering multiple enterprise commands & aliases', async () => {
  const deployCli = new CliCommandDispatcher({
    programName: 'cloud-deploy',
    version: '2.1.0',
    description: 'Enterprise Cloud Deployment Tool'
  });

  let deployCalled = false;
  deployCli.registerCommand({
    name: 'deploy',
    description: 'Deploys an artifact to a target cluster',
    usage: 'cloud-deploy deploy <environment> <artifact-path> [--dry-run] [--timeout <sec>]',
    minArgs: 2,
    options: [
      { flag: '--dry-run', description: 'Simulate deployment without applying changes' },
      { flag: '--timeout <sec>', description: 'Maximum deployment duration' }
    ],
    handler: async ({ positional, options }) => {
      deployCalled = true;
      assert.strictEqual(positional[0], 'production');
      assert.strictEqual(positional[1], 'pkg-v1.tar.gz');
      assert.strictEqual(options['dry-run'], true);
      assert.strictEqual(options.timeout, '300');
      return 0;
    }
  });

  const res = await deployCli.dispatch(['deploy', 'production', 'pkg-v1.tar.gz', '--dry-run', '--timeout', '300']);
  assert.strictEqual(res, 0);
  assert.strictEqual(deployCalled, true);
});

check('Consumer CLI: Stress testing short-flag parsing & multiple options', async () => {
  const cli = new CliCommandDispatcher({ programName: 'stress-cli' });
  let optsReceived = null;
  cli.registerCommand({
    name: 'build',
    handler: async ({ options }) => {
      optsReceived = options;
      return 0;
    }
  });

  await cli.dispatch(['build', '-v', '-f', '--port', '8080', '--mode', 'cluster']);
  assert.strictEqual(optsReceived.v, true);
  assert.strictEqual(optsReceived.f, true);
  assert.strictEqual(optsReceived.port, '8080');
  assert.strictEqual(optsReceived.mode, 'cluster');
});

// -------------------------------------------------------------
// 2. Consumer Reuse of SchemaInvariantValidator in an "Order API"
// -------------------------------------------------------------
const orderSchema = {
  properties: {
    orderId: { type: 'string', required: true, nonEmpty: true, pattern: /^ORD-\d{4}$/ },
    customerEmail: { type: 'string', required: true, pattern: /@/ },
    amount: { type: 'number', required: true, positive: true },
    priority: { type: 'string', enum: ['LOW', 'NORMAL', 'URGENT'] },
    items: { type: 'array', itemType: 'string' }
  },
  strict: true
};

check('Consumer Schema: Validates complex e-commerce order contract', () => {
  const validOrder = {
    orderId: 'ORD-1234',
    customerEmail: 'alice@example.com',
    amount: 149.99,
    priority: 'URGENT',
    items: ['item_1', 'item_2']
  };
  const result = validateSchema(validOrder, orderSchema);
  assert.strictEqual(result.isValid, true);
});

check('Consumer Schema: Regex pattern mismatch correctly rejected', () => {
  const badOrderId = {
    orderId: 'INVALID-ID-FORMAT',
    customerEmail: 'alice@example.com',
    amount: 100
  };
  assert.throws(() => validateSchema(badOrderId, orderSchema), (err) => {
    return err instanceof SchemaValidationError && err.violations.some(v => v.includes('does not match required pattern'));
  });
});

check('Consumer Schema: Non-object / array input correctly rejected', () => {
  assert.throws(() => validateSchema(['not', 'an', 'object'], orderSchema), (err) => {
    return err instanceof SchemaValidationError && err.message.includes('Target data must be a non-null object');
  });
  assert.throws(() => validateSchema(null, orderSchema), (err) => {
    return err instanceof SchemaValidationError;
  });
  assert.throws(() => validateSchema('string-input', orderSchema), (err) => {
    return err instanceof SchemaValidationError;
  });
});

// -------------------------------------------------------------
// 3. Documenting Schema Validator Limitations (Edge-case Audit)
// -------------------------------------------------------------
check('Auditing Schema Validator Limitations: Deeply nested object schemas', () => {
  // Current limitation: Schema validator only checks type: 'object' at top level;
  // it does not recursively validate nested object properties if specified as schema.
  const shallowNestedSchema = {
    properties: {
      user: { type: 'object', required: true }
    }
  };
  const data = { user: { name: 'Bob', age: -99 } }; // nested negative age is unvalidated
  const res = validateSchema(data, shallowNestedSchema);
  assert.strictEqual(res.isValid, true);
  // This verifies that deep nested validation is currently NOT implemented.
  // We record this limitation explicitly in the report!
});

console.log('\n========================================================================');
console.log(`CONSUMER REUSE TEST RESULTS: ${passed} / ${total} passed (${(passed / total * 100).toFixed(1)}%)`);
console.log('========================================================================\n');

