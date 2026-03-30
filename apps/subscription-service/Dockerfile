# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/subscription-service ./apps/subscription-service
RUN npm ci
RUN npm run build --workspace=apps/subscription-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/apps/subscription-service/package.json ./apps/subscription-service/
RUN npm ci --omit=dev
COPY --from=builder /app/apps/subscription-service/dist ./apps/subscription-service/dist
WORKDIR /app/apps/subscription-service
EXPOSE 4005
CMD ["node", "dist/main"]
