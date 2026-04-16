# Build and run Signal Ridge CRM (Express server + React client)
FROM node:22-slim

# OpenSSL is required by Prisma's query engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source
COPY . .

# Build CRM client (Vite)
RUN cd crm/client && npm install && npm run build

# Build workflow client (Vite) — served at /workflow
RUN cd crm/workflow-client && npm install && npm run build

# Build server (TypeScript + Prisma)
RUN cd crm/server && npm install && npx prisma generate && npm run build

# Server runtime port (Railway injects PORT env var, server honors it)
EXPOSE 3001

# Run from repo root so process.cwd() resolves crm/client/dist correctly
CMD ["node", "crm/server/dist/src/index.js"]
