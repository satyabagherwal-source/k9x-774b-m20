import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const distIndex = path.join(projectRoot, 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  const stat = fs.statSync(distIndex);
  console.log(`✅ Build Verified: dist/index.html exists (${stat.size} bytes)`);
  process.exit(0);
} else {
  console.error(`❌ Build Verification Failed: dist/index.html not found`);
  process.exit(1);
}
