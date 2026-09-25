# D-Board Production Deployment Runbook

This guide covers deployment procedures, environment configuration, database migrations, reverse proxy configuration, and scaling architecture for D-Board.

---

## 1. Environment Variables Specification

All configuration variables are defined and validated on startup using Zod schemas (`src/config/env.ts`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Runtime environment (`development`, `production`, `test`). |
| `PORT` | No | `5000` | Port for the backend Express HTTP server (Render assigns dynamically). |
| `DATABASE_URL` | Yes | - | PostgreSQL connection URI (Local or Supabase pooler with SSL). |
| `DATABASE_SSL` | No | `false` | Explicitly enforce TLS on PostgreSQL database connection. |
| `REDIS_URL` | Yes | `redis://127.0.0.1:6379` | Redis connection URI (Local `redis://` or Render Key Value / Valkey internal URL). |
| `JWT_SECRET` | Yes | - | Cryptographic secret for signing session tokens (min 32 chars in prod). |
| `APP_URL` | Yes | `http://localhost:5000` | Public URL of the backend API (or Render Web Service). |
| `CLIENT_URL` | No | `http://localhost:5173` | Public URL of the frontend Web SPA (for CORS and OAuth redirect). |
| `COOKIE_SAME_SITE` | No | `lax` | SameSite cookie policy (`lax` for local/same-origin, `none` for Render cross-origin). |
| `ENABLE_EMBEDDED_WORKER` | No | `true` | Co-locate BullMQ workers inside the API web service process for Free Tier. |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum file upload size in megabytes. |
| `STORAGE_DRIVER` | No | `local` | Active file storage driver: `local` or `s3`. |
| `STORAGE_LOCAL_PATH` | No | `./uploads_storage` | Local directory for file storage when `STORAGE_DRIVER=local`. |
| `S3_ENDPOINT` | Conditional | - | S3 API endpoint URL (e.g. Cloudflare R2: `https://<id>.r2.cloudflarestorage.com`). |
| `S3_REGION` | Conditional | `auto` | S3 region (`auto` for Cloudflare R2, or AWS region). |
| `S3_BUCKET` | Conditional | `d-board-files` | Bucket name for S3-compatible object storage (`d-board-files`). |
| `S3_ACCESS_KEY_ID` | Conditional | - | API Access Key ID for S3 or Cloudflare R2. |
| `S3_SECRET_ACCESS_KEY` | Conditional | - | API Secret Access Key for S3 or Cloudflare R2. |
| `S3_FORCE_PATH_STYLE` | No | `false` | Force path-style addressing if required by MinIO / local S3 emulator. |
| `SMTP_HOST` | No | - | Outbound SMTP relay hostname (e.g. `smtp-relay.brevo.com`). |
| `SMTP_PORT` | No | `587` | Outbound SMTP relay port. |
| `SMTP_USER` | No | - | SMTP authentication username. |
| `SMTP_PASSWORD` | No | - | SMTP authentication password. |
| `EMAIL_FROM` | No | `D-Board <notifications@d-board.local>` | Display sender name and email address. |

---

## 2. Containerized Deployment (Docker Compose)

The recommended production deployment method is via Docker Compose:

### Step 1: Clone Repository & Create Production `.env`
```bash
git clone https://github.com/your-org/d-board.git /opt/d-board
cd /opt/d-board
cp apps/api/.env.example .env
```

### Step 2: Edit Production Credentials
Set strong passwords for PostgreSQL, Redis, and `JWT_SECRET`:
```bash
nano .env
```

### Step 3: Launch Containers
```bash
docker compose up -d --build
```

### Step 4: Run Database Migrations
Run database migrations inside the running API container:
```bash
docker compose exec api npx prisma migrate deploy
```

---

## 3. Database Migration Runbook

Database schema changes are managed exclusively via Prisma migrations.

### Running Migrations in Production
```bash
# Safe, non-destructive migration deployment:
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

> [!CAUTION]
> **NEVER** run `prisma migrate reset` or `prisma db push` against production databases. These commands can result in catastrophic data loss.

### Zero-Downtime Migration Guidelines:
1. **Additive Changes**: Always introduce new columns as optional (`nullable`) or with default values.
2. **Deprecation**: Deprecate old fields over two release cycles before removing them.
3. **Index Creation**: Add indexes concurrently or during low-traffic maintenance windows.

---

## 4. Production Reverse Proxy (Host Nginx Configuration)

If running behind a host-level Nginx reverse proxy with TLS/SSL:

```nginx
# Upstream clusters
upstream dboard_api {
    server 127.0.0.1:5000;
    keepalive 32;
}

upstream dboard_web {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name dboard.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dboard.example.com;

    ssl_certificate /etc/letsencrypt/live/dboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dboard.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API and WebSocket proxy
    location /api/ {
        proxy_pass http://dboard_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        client_max_body_size 50M;
    }

    # Socket.IO WebSocket endpoint
    location /socket.io/ {
        proxy_pass http://dboard_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    # Frontend SPA
    location / {
        proxy_pass http://dboard_web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

---

## 5. Free Cloud Deployment (Supabase, Render Key Value / Valkey, Cloudflare R2, Brevo, Render)

D-Board can be deployed 100% on modern free cloud infrastructure tiers without AWS managed services:

| Component | Target Free Provider | Key Connection Setting | Free Tier Notes & Limitations |
|---|---|---|---|
| **Web SPA** | Render Static Site | `VITE_API_URL=https://<api>.onrender.com` | Unlimited bandwidth within fair-use, automatic SSL, SPA routing via `_redirects`. |
| **API & Worker** | Render Web Service | `PORT`, `ENABLE_EMBEDDED_WORKER=true` | 512MB RAM, shared CPU. Spins down after 15 min idle (cold start delay ~50s). |
| **Database** | Supabase PostgreSQL | `DATABASE_URL` (Supabase Session Pooler on port 5432) | 500MB storage, auto-pauses after 1 week inactivity without queries. |
| **Redis & Queues**| Render Key Value / Valkey | `REDIS_URL=redis://...` | Low-latency in-region managed key-value store, internal connection URL. |
| **Object Storage**| Cloudflare R2 | `STORAGE_DRIVER=s3`, `S3_ENDPOINT` | Bucket: `d-board-files`. 10GB storage, 10M Class B (read) & 1M Class A (write) ops/month. $0 egress. |
| **Outbound Email**| Brevo SMTP | `smtp-relay.brevo.com:587` | 300 emails/day outbound limit. BullMQ retries transient errors. |

### Render Blueprint Deployment (`render.yaml`)
1. Fork or push the repository to GitHub.
2. In the Render Dashboard, select **New +** -> **Blueprint**.
3. Select your repository. Render will automatically parse `render.yaml` and configure:
   - `d-board-api` (Node Web Service with embedded BullMQ workers)
   - `d-board-web` (Static Site with SPA rewrite rules)
4. Populate the secret environment variables in the Render Dashboard:
   - `DATABASE_URL`: Supabase Session Pooler URL using port 5432 (e.g. `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`)
   - `REDIS_URL`: Automatically wired from the `d-board-cache` Key Value service via Render blueprint `fromService`.
   - `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
   - `S3_BUCKET`: `d-board-files`
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: From Cloudflare R2 API token
   - `SMTP_USER`, `SMTP_PASSWORD`: From Brevo SMTP credentials
   - `COOKIE_SAME_SITE`: `none` (required because Render Web Service and Static Site use separate `*.onrender.com` subdomains)
   - `CLIENT_URL`: `https://<d-board-web>.onrender.com` (Frontend public URL)
   - `APP_URL`: `https://<d-board-api>.onrender.com` (API public URL)
5. Deploy the Blueprint.
   - **Safe Migration Strategy (Strategy B - Controlled Startup Migration)**: Render Free tier builds do not have network access or live production database dependencies (`buildCommand: npm ci && npm run build:api`). Migrations are safely applied immediately before server process execution (`startCommand: npx prisma migrate deploy && node apps/api/dist/server.js`). `prisma migrate reset` and `prisma db push` are strictly prohibited in production.

---

## 6. Scaling Strategy

- **API Tier**: The Express API server is stateless. On paid tiers, multiple instances run behind a load balancer with sticky sessions or Redis-backed Socket.IO adapters.
- **Worker Tier**: On Render Free, background workers run inside the API process (`ENABLE_EMBEDDED_WORKER=true`). On paid plans, set `ENABLE_EMBEDDED_WORKER=false` and run dedicated standalone worker instances (`node apps/api/dist/worker.js`).
- **Database & Cache**: Use managed services (Supabase PostgreSQL, Render Key Value / Valkey). AWS S3 remains a future supported S3 provider if AWS credentials are provided.

---

## 7. Infrastructure Deployment Requirements

### Automated Backups & Disaster Recovery
- **Runbook Status**: The database restore commands and disaster recovery procedures are documented in `docs/production-checklist.md`.
- **Infrastructure Requirement**: Automated cloud snapshot backups (e.g. Supabase automated daily backups or WAL archiving) and automated restore drills are NOT pre-configured in this repository. Provisioning and validating this infrastructure is a required pre-production deployment task.

### Error Monitoring & Alerting
- **Application Status**: Structured logging and request correlation (`X-Request-Id`) are implemented in the API server.
- **Infrastructure Requirement**: External error monitoring/alerting (e.g. Sentry, Datadog, PagerDuty) remains a deployment requirement.

