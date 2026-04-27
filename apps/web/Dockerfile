FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

# Workspace setup
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install all needed for web (engine, card-data, ai, protocol)
RUN corepack pnpm@9.7.0 install --filter @optcg/web...

# Generate prisma client (uses placeholder DATABASE_URL — engine never connects at build time)
ENV DATABASE_URL=file:/tmp/build-placeholder.db
RUN corepack pnpm@9.7.0 --filter @optcg/card-data db:generate

# Build Next.js (standalone output)
RUN corepack pnpm@9.7.0 --filter @optcg/web build

# Volume for persistent SQLite (decks, users, games)
ENV DATABASE_URL=file:/data/optcg.db

EXPOSE 3000

# At startup: apply migrations against the volume DB, then start Next.js
CMD ["sh", "-c", "cd packages/card-data && corepack pnpm@9.7.0 prisma migrate deploy && cd /app && corepack pnpm@9.7.0 --filter @optcg/web start"]
