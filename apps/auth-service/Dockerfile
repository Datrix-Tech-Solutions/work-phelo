FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# Copy shared packages
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config

# Copy the service itself
COPY apps/auth-service ./apps/auth-service

# Install all dependencies
RUN npm install

# Generate Prisma client
RUN cd apps/auth-service && npx prisma generate

# Build shared packages first, then the service
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/auth-service

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/
COPY --from=builder /app/apps/auth-service/prisma ./apps/auth-service/prisma

WORKDIR /app/apps/auth-service

EXPOSE 4001

CMD ["node", "dist/main"]
