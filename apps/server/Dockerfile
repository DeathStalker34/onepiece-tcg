FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/engine ./packages/engine
COPY packages/protocol ./packages/protocol
COPY packages/card-data ./packages/card-data
COPY apps/server ./apps/server

RUN corepack pnpm@9.7.0 install --filter @optcg/server...
RUN corepack pnpm@9.7.0 --filter @optcg/card-data exec prisma generate

EXPOSE 3001

# At startup: apply Postgres migrations against $DATABASE_URL, then start the server.
CMD ["sh", "-c", "cd packages/card-data && corepack pnpm@9.7.0 exec prisma migrate deploy && cd /app && corepack pnpm@9.7.0 --filter @optcg/server start"]
