# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY packages/internal-auth ./packages/internal-auth
COPY apps/inventory-service ./apps/inventory-service
RUN npm ci
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=packages/internal-auth
RUN npm run build --workspace=apps/inventory-service

FROM node:20-alpine AS runner
RUN apk add --no-cache ca-certificates openssl
WORKDIR /app
ENV NODE_ENV=production
ENV INVENTORY_SERVICE_PORT=4009
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/packages/internal-auth/package.json ./packages/internal-auth/
COPY --from=builder /app/apps/inventory-service/package.json ./apps/inventory-service/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/internal-auth/dist ./packages/internal-auth/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/inventory-service/node_modules ./apps/inventory-service/node_modules
COPY --from=builder /app/apps/inventory-service/prisma ./apps/inventory-service/prisma
COPY --from=builder /app/apps/inventory-service/dist ./apps/inventory-service/dist
WORKDIR /app/apps/inventory-service
EXPOSE 4009
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.INVENTORY_SERVICE_PORT || 4009) + '/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
