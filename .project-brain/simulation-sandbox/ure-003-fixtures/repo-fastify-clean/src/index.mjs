
import Fastify from 'fastify';
import { healthRoutes } from './routes/health.mjs';

const app = Fastify({ logger: true });
app.register(healthRoutes);

const shutdown = async (signal) => {
  console.log(`Received ${signal}, closing active server sockets and draining connections...`);
  await app.close();
  console.log('Server closed successfully.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
