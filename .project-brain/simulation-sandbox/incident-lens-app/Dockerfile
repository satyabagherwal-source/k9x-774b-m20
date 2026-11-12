# IncidentLens — Container Deployment Specification
# Non-root alpine image, zero runtime external dependencies, built-in healthcheck probe.

FROM node:20-alpine AS runner

WORKDIR /app

# Enforce secure environment
ENV NODE_ENV=production
ENV PORT=3456

# Copy application assets
COPY package.json ./
COPY src/ ./src/

# Create persistent data directory owned by non-root node user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3456

# In-container health probe validating operational readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3456/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.mjs"]

