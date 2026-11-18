# syntax=docker/dockerfile:1
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/ai-service/package.json ./apps/ai-service/package.json
RUN npm ci --workspace=apps/ai-service --include-workspace-root=false --ignore-scripts --no-audit --no-fund
COPY apps/ai-service/nest-cli.json apps/ai-service/tsconfig.json apps/ai-service/tsconfig.build.json ./apps/ai-service/
COPY apps/ai-service/src ./apps/ai-service/src
RUN npm run build --workspace=apps/ai-service
RUN find apps/ai-service/dist -type f ! -name '*.js' -delete

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY apps/ai-service/package.json ./apps/ai-service/package.json
RUN npm ci --workspace=apps/ai-service --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production
ENV AI_SERVICE_PORT=4011
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/ai-service ./apps/ai-service
COPY --from=builder --chown=node:node /app/apps/ai-service/dist ./apps/ai-service/dist
WORKDIR /app/apps/ai-service
USER node
EXPOSE 4011
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.AI_SERVICE_PORT || 4011) + '/api/health', { signal: AbortSignal.timeout(2000) }).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
