
import express from 'express';
import http from 'http';

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: Date.now() });
});

const handleTermination = (signal) => {
  console.log(`[OrderAPI] Termination signal ${signal} intercepted. Draining active HTTP connections...`);
  server.close((err) => {
    if (err) {
      console.error('Error closing server sockets:', err);
      process.exit(1);
    }
    console.log('[OrderAPI] Sockets drained cleanly. Exiting.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleTermination('SIGTERM'));
process.on('SIGINT', () => handleTermination('SIGINT'));

export { app, server };
