import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';

const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

console.log('========================================================================');
console.log('SAFE BYTE-LEVEL BACKUP & RESTORE INTEGRITY VERIFICATION');
console.log('========================================================================\n');

const sourcePath = '05_KNOWLEDGE/engineering-patterns.md';
const backupDir = '.project-brain/simulation-sandbox/controlled-integration/backups';

// 1. Compute pre-change source hash
const preHash = hashFile(sourcePath);
const preSize = fs.statSync(sourcePath).size;
console.log(`Source File: ${sourcePath}`);
console.log(`Pre-change Size: ${preSize} bytes`);
console.log(`Pre-change SHA-256: ${preHash}`);

// 2. Create isolated byte-level backup
const backupFileName = `05_KNOWLEDGE_engineering-patterns.md.bak.${preHash.slice(0, 16)}`;
const backupFilePath = path.join(backupDir, backupFileName);

console.log(`\nCreating isolated byte-level snapshot at:\n${backupFilePath}`);
fs.copyFileSync(sourcePath, backupFilePath);

// 3. Verify backup file integrity
const backupHash = hashFile(backupFilePath);
const backupSize = fs.statSync(backupFilePath).size;
assert.strictEqual(backupHash, preHash, 'Backup file SHA-256 does not match source file!');
assert.strictEqual(backupSize, preSize, 'Backup file size does not match source file!');
console.log('[PASS] Backup file created and verified bitwise identical (100% hash match).');

// 4. Test safe rollback on a simulated isolated file
const simTarget = path.join(backupDir, 'simulated-target-file.md');
fs.copyFileSync(sourcePath, simTarget);

// Simulate an additive change (e.g. appending new patterns)
fs.appendFileSync(simTarget, '\n\n## 7273. Test Additive Pattern\nSome test content.\n', 'utf8');
const modifiedHash = hashFile(simTarget);
assert.notStrictEqual(modifiedHash, preHash, 'Simulated modification failed to change hash');
console.log(`\nSimulated Additive Mutation: Hash changed to ${modifiedHash}`);

// Execute byte-level safe restore without using git checkout
console.log('Executing safe byte-level restore from snapshot (zero git reliance)...');
fs.copyFileSync(backupFilePath, simTarget);

// Verify restored file
const restoredHash = hashFile(simTarget);
const restoredSize = fs.statSync(simTarget).size;
assert.strictEqual(restoredHash, preHash, 'Restored file does not match original pre-change hash!');
assert.strictEqual(restoredSize, preSize, 'Restored file size does not match original size!');
console.log('[PASS] Safe byte-level restore verified bitwise identical to pre-change baseline!');

// Clean up simulated target
fs.unlinkSync(simTarget);

console.log('\n========================================================================');
console.log('SAFE BACKUP & RESTORE VERIFICATION: ALL 4 CHECKS PASSED');
console.log('========================================================================');

