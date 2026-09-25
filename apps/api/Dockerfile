# Multi-stage Dockerfile for D-Board API
# ========================================================
# Stage 1: Build & Compile
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies needed for native modules & Prisma
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Copy root monorepo manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

# Install full dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy API source and Prisma configuration
COPY apps/api ./apps/api

# Generate Prisma Client and compile TypeScript
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ========================================================
# Stage 2: Minimal Production Runtime
# ========================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies (OpenSSL for Prisma engine, curl for healthcheck)
RUN apk add --no-cache openssl libc6-compat curl

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy root node_modules and built API artifacts
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Ensure local file upload directory exists with proper permissions
RUN mkdir -p /app/uploads_storage && chown -R nodejs:nodejs /app/uploads_storage

USER nodejs

WORKDIR /app/apps/api

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
