import { spawn } from 'child_process';
import http from 'http';

console.log('⚡ [Verify-Dev] Starting dev server runtime verification on port 4321...');

const devProcess = spawn('npx.cmd', ['astro', 'dev', '--port', '4321', '--host', '127.0.0.1'], {
  cwd: process.cwd(),
  shell: true,
  stdio: 'pipe'
});

let isAlive = false;
let attempts = 0;
const maxAttempts = 20;

const ping = () => {
  attempts++;
  const req = http.get('http://127.0.0.1:4321/', (res) => {
    if (res.statusCode === 200) {
      console.log(`✅ [Verify-Dev] Server responded with HTTP 200 OK after ${attempts} attempts!`);
      cleanup(0);
    } else {
      console.log(`⏳ [Verify-Dev] Server responded with HTTP ${res.statusCode}. Retrying...`);
      retry();
    }
  });

  req.on('error', () => {
    retry();
  });
  req.setTimeout(1500, () => {
    req.destroy();
    retry();
  });
};

const retry = () => {
  if (attempts >= maxAttempts) {
    console.error('❌ [Verify-Dev] Dev server failed to respond within timeout window.');
    cleanup(1);
    return;
  }
  setTimeout(ping, 1000);
};

const cleanup = (code) => {
  try {
    devProcess.kill('SIGINT');
  } catch (e) {}
  process.exit(code);
};

// Start pinging after 2 seconds
setTimeout(ping, 2000);
