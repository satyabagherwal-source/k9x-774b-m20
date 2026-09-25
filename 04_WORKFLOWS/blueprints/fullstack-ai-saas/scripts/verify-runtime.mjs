import http from 'http';

const port = process.env.PORT || 3000;
const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
  if (res.statusCode === 200) {
    console.log(`✅ Runtime Verified: HTTP 200 OK from http://127.0.0.1:${port}/api/health`);
    process.exit(0);
  } else {
    console.error(`❌ Runtime Probe Failed: HTTP ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error(`❌ Runtime Probe Error: ${err.message}`);
  process.exit(1);
});
