import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('⚡ [Verify-Build] Starting production build verification...');

try {
  const stdout = execSync('npx astro build', {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log(stdout);

  const distIndex = path.join(process.cwd(), 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error('❌ [Verify-Build] Build succeeded but dist/index.html was not generated.');
    process.exit(1);
  }

  const stat = fs.statSync(distIndex);
  console.log(`✅ [Verify-Build] Production build verified successfully! (dist/index.html: ${stat.size} bytes)`);
  process.exit(0);
} catch (error) {
  console.error('❌ [Verify-Build] Production build failed!');
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
}
