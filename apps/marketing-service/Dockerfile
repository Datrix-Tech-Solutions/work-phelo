# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/marketing-service ./apps/marketing-service
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npm run build --workspace=apps/marketing-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/marketing-service/dist ./apps/marketing-service/dist
COPY --from=builder /app/apps/marketing-service/package.json ./apps/marketing-service/
COPY --from=builder /app/apps/marketing-service/node_modules ./apps/marketing-service/node_modules
WORKDIR /app/apps/marketing-service
EXPOSE 4006
CMD ["node", "dist/main"]
