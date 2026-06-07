# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:24.16.0-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:24.16.0-bookworm-slim AS runtime
WORKDIR /app

# Usuario no root (FR-039)
RUN groupadd --gid 1001 appgroup \
 && useradd --uid 1001 --gid appgroup --shell /bin/false --no-create-home appuser

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000
USER appuser

ENV NODE_ENV=production
ENV PORT=3000

# Healthcheck contra el endpoint de readiness (FR-028)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/health/ready').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
