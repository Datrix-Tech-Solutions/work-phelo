FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/subscription-service ./apps/subscription-service

RUN npm install
RUN cd apps/subscription-service && npx prisma generate

RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/subscription-service

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/subscription-service/dist ./apps/subscription-service/dist
COPY --from=builder /app/apps/subscription-service/package.json ./apps/subscription-service/
COPY --from=builder /app/apps/subscription-service/prisma ./apps/subscription-service/prisma

WORKDIR /app/apps/subscription-service
EXPOSE 4005
CMD ["node", "dist/main"]
