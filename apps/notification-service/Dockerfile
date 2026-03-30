# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/notification-service ./apps/notification-service
RUN npm ci
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/notification-service

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/notification-service/package.json ./apps/notification-service/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/apps/notification-service/dist ./apps/notification-service/dist
WORKDIR /app/apps/notification-service
EXPOSE 4004
CMD ["node", "dist/main"]
