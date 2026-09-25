# Multi-stage Dockerfile for D-Board Web Frontend SPA
# ========================================================
# Stage 1: Build & Bundle
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

# Install dependencies
RUN npm ci

# Copy web source
COPY apps/web ./apps/web

# Build production bundle with Vite
WORKDIR /app/apps/web
RUN npm run build

# ========================================================
# Stage 2: High-Performance Nginx Alpine Runtime
# ========================================================
FROM nginx:1.27-alpine AS runner

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with security headers
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built SPA artifacts from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
