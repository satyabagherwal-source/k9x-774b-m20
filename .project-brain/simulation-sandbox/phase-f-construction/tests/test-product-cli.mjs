/**
 * CLI Integration Test Suite for Agentic Knowledge Gateway
 */
import assert from 'assert';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const cliPath = path.resolve('.project-brain/simulation-sandbox/phase-f-construction/bin/cli.mjs');

function runCli(args, inputStdin = null) {
  try {
    const cmd = `node "${cliPath}" ${args}`;
    const stdout = execSync(cmd, {
      input: inputStdin,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { code: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout ? err.stdout.toString().trim() : '',
      stderr: err.stderr ? err.stderr.toString().trim() : ''
    };
  }
}

export function runCliTests() {
  const log = [];
  log.push('--- RUNNING AGENTIC-KGW CLI INTEGRATION TESTS ---');

  // 1. Help command
  const helpRes = runCli('help');
  assert.strictEqual(helpRes.code, 0);
  assert.strictEqual(helpRes.stdout.includes('agentic-kgw — Agentic Knowledge Gateway CLI'), true);
  log.push('  PASS: CLI help returned code 0 and displayed usage text');

  // 2. Version command
  const verRes = runCli('version');
  assert.strictEqual(verRes.code, 0);
  assert.strictEqual(verRes.stdout, 'agentic-kgw v1.0.0');
  log.push('  PASS: CLI version returned code 0 and "agentic-kgw v1.0.0"');

  // 3. extract-json inline string
  const extRes = runCli('extract-json "Prefix text: {\\\"result\\\": 42} suffix text."');
  assert.strictEqual(extRes.code, 0);
  const parsedExt = JSON.parse(extRes.stdout);
  assert.strictEqual(parsedExt.result, 42);
  log.push('  PASS: CLI extract-json parsed inline string with code 0');

  // 4. extract-json --pretty flag
  const prettyRes = runCli('extract-json "{\\\"a\\\": 1}" --pretty');
  assert.strictEqual(prettyRes.code, 0);
  assert.strictEqual(prettyRes.stdout.includes('\n  "a": 1\n'), true);
  log.push('  PASS: CLI extract-json --pretty output formatted JSON');

  // 5. extract-json error condition (invalid JSON)
  const errExtRes = runCli('extract-json "Just plain text without json"');
  assert.strictEqual(errExtRes.code, 1);
  assert.strictEqual(errExtRes.stderr.includes('No JSON object found'), true);
  log.push('  PASS: CLI extract-json on plain text returned code 1 and error description');

  // 6. slugify command
  const slugRes = runCli('slugify "## Architecture & System Design (v2)"');
  assert.strictEqual(slugRes.code, 0);
  assert.strictEqual(slugRes.stdout, 'architecture--system-design-v2');
  log.push('  PASS: CLI slugify returned code 0 and valid anchor slug');

  // 7. slugify missing argument returns code 2
  const noArgSlug = runCli('slugify');
  assert.strictEqual(noArgSlug.code, 2);
  assert.strictEqual(noArgSlug.stderr.includes('requires a heading string'), true);
  log.push('  PASS: CLI slugify missing argument returned code 2 (usage error)');

  // 8. validate-config valid
  const validCfg = runCli('validate-config "{\\\"temperature\\\": 0.0, \\\"do_sample\\\": false}"');
  assert.strictEqual(validCfg.code, 0);
  const parsedCfg = JSON.parse(validCfg.stdout);
  assert.strictEqual(parsedCfg.isDeterministic, true);
  log.push('  PASS: CLI validate-config approved valid deterministic config with code 0');

  // 9. validate-config non-deterministic returns code 1
  const invalidCfg = runCli('validate-config "{\\\"temperature\\\": 0.8}"');
  assert.strictEqual(invalidCfg.code, 1);
  assert.strictEqual(invalidCfg.stderr.includes('temperature must be 0.0'), true);
  log.push('  PASS: CLI validate-config rejected stochastic temperature with code 1');

  // 10. Unknown command returns code 2
  const unkRes = runCli('bad-cmd');
  assert.strictEqual(unkRes.code, 2);
  assert.strictEqual(unkRes.stderr.includes('Unknown command'), true);
  log.push('  PASS: CLI unknown command returned code 2');

  return { passed: 10, total: 10, log };
}

