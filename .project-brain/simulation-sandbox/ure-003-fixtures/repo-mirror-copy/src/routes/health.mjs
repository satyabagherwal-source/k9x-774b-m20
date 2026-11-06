
export async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    const isReady = true;
    if (!isReady) {
      return reply.status(503).send({ status: 'UNHEALTHY', reason: 'Collector buffer saturated' });
    }
    return reply.status(200).send({ status: 'HEALTHY' });
  });
}
