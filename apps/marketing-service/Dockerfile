# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/marketing-service ./apps/marketing-service
RUN --mount=type=cache,target=/root/.npm \
    npm install
RUN cd apps/marketing-service && npx prisma generate
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/marketing-service

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/marketing-service/dist ./apps/marketing-service/dist
COPY --from=builder /app/apps/marketing-service/package.json ./apps/marketing-service/
COPY --from=builder /app/apps/marketing-service/prisma ./apps/marketing-service/prisma
WORKDIR /app/apps/marketing-service
EXPOSE 4006
CMD ["node", "dist/main"]
