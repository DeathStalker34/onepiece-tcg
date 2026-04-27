FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/engine ./packages/engine
COPY packages/protocol ./packages/protocol
COPY apps/server ./apps/server

RUN corepack pnpm@9.7.0 install --frozen-lockfile --filter @optcg/server...

EXPOSE 3001

CMD ["corepack", "pnpm@9.7.0", "--filter", "@optcg/server", "start"]
