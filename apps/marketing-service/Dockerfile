# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/marketing-service ./apps/marketing-service
RUN npm ci
RUN npm run build --workspace=apps/marketing-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/apps/marketing-service/package.json ./apps/marketing-service/
RUN npm ci --omit=dev
COPY --from=builder /app/apps/marketing-service/dist ./apps/marketing-service/dist
WORKDIR /app/apps/marketing-service
EXPOSE 4006
CMD ["node", "dist/main"]
