# Deploying the OPTCG server to Fly.io

> Not executed during Fase 6 — this is the manual recipe for when we're ready to go public.

## Prerequisites

- `flyctl` installed (https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io account + `fly auth login`

## One-time setup

From the repo root:

```bash
cd apps/server
fly launch --no-deploy --name optcg-server --region mad
```

Choose "No" for Postgres/Upstash. Keep the generated `fly.toml`.

In `fly.toml`, make sure:

- `[[services]]` has `internal_port = 3001`.
- `[[services.ports]]` exposes 80 and 443 with `handlers = ["http", "tls"]`.
- `primary_region = "mad"` (or closest to users).

## Dockerfile (`apps/server/Dockerfile`)

```
FROM node:20-alpine
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN corepack pnpm@9.7.0 install --frozen-lockfile --filter @optcg/server...
RUN corepack pnpm@9.7.0 --filter @optcg/server catalog:build
EXPOSE 3001
CMD ["corepack", "pnpm@9.7.0", "--filter", "@optcg/server", "start"]
```

## Env vars

- `PORT=3001`
- `CORS_ORIGIN=https://<your-web-domain>`

Set with `fly secrets set CORS_ORIGIN=https://…`.

## Deploy

```bash
fly deploy --remote-only
```

Verify `https://optcg-server.fly.dev/health` → `{"status":"ok"}`.

## Client configuration

In the web deploy, set `NEXT_PUBLIC_SERVER_URL=https://optcg-server.fly.dev` (build-time env).

## Sticky sessions

Socket.IO works with default Fly.io settings for a single-region single-machine deploy. If scaling to multiple machines, add sticky-session annotations in `fly.toml` under `[[services]]`:

```
load_balancing_strategy = "sticky"
```

Not needed for MVP.
