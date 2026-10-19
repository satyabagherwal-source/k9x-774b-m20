import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function executeRollback(targetRootDir = 'c:\\AI-Builder-Brain') {
  console.log(`[ROLLBACK] Restoring 5 files from backup to: ${targetRootDir}`);
  const manifestPath = path.join(__dirname, 'backup-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let restoredCount = 0;
  for (const item of manifest.files) {
    const backupSrc = path.join(__dirname, item.relPath);
    const restoreDest = path.join(targetRootDir, item.relPath);

    if (!fs.existsSync(backupSrc)) {
      throw new Error(`Backup file missing: ${backupSrc}`);
    }

    const backupBytes = fs.readFileSync(backupSrc);
    fs.mkdirSync(path.dirname(restoreDest), { recursive: true });
    fs.writeFileSync(restoreDest, backupBytes);

    const checkHash = crypto.createHash('sha256').update(fs.readFileSync(restoreDest)).digest('hex');
    if (checkHash !== item.sha256) {
      throw new Error(`ROLLBACK_HASH_MISMATCH: Failed to verify ${item.relPath}`);
    }
    console.log(`[ROLLBACK] Restored ${item.relPath} (Verified SHA256: ${checkHash.slice(0, 12)}...)`);
    restoredCount++;
  }
  console.log(`[ROLLBACK] Successfully restored all ${restoredCount} files byte-for-byte.`);
  return true;
}

if (process.argv[1] === __filename) {
  executeRollback();
}
