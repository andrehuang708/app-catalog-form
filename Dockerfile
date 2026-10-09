# Stage 1 — dependencies + the Vite production build.
FROM oven/bun:1.4-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 2 — slim runtime: production dependencies, the built bundle, and the
# TypeScript sources the Bun server runs directly (no compile step). The
# container starts `bun src/server/index.ts`, which serves /api/* from
# Postgres and everything else from dist/ — no outbound network needed.
FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY src/server ./src/server
COPY src/lib/onboarding-schema.ts ./src/lib/onboarding-schema.ts
COPY scripts/seed.ts ./scripts/seed.ts

# Non-root: the app never needs write access outside /tmp.
USER bun
EXPOSE 8080
# Compose waits on the db healthcheck, but the schema is also created
# idempotently on first query, so a manual `docker run` self-heals too.
CMD ["bun", "src/server/index.ts"]
