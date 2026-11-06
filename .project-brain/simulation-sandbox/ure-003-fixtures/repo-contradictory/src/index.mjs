
import http from 'http';
const server = http.createServer();

// ANTI-PATTERN: Exit immediately on SIGTERM without closing or draining connections
process.on('SIGTERM', () => {
  console.log('Force killing process immediately!');
  process.exit(0);
});
process.on('SIGINT', () => {
  process.exit(0);
});
