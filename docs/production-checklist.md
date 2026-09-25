# D-Board Production Readiness & Pre-Flight Checklist

This checklist must be executed and verified before releasing D-Board to production or promoting staging environments.

---

## 1. Security & Configuration Audit

- [ ] **Secret Hygiene**: Verify no default secrets or development keys are present in `.env`.
- [ ] **JWT Key Entropy**: Verify `JWT_SECRET` is at least 32 characters of high-entropy random bytes (`openssl rand -hex 32`).
- [ ] **Database Credentials**: Verify default PostgreSQL password (`postgres`) has been rotated to a strong password.
- [ ] **Cookie Flags**: Verify `NODE_ENV=production` so that cookies include the `Secure` flag.
- [ ] **CORS Configuration**: Verify `APP_URL` matches the production domain; wildcards (`*`) are prohibited.
- [ ] **Rate Limiting**: Confirm Redis is operational to ensure rate limiting protection against brute force and DDoS attacks.
- [ ] **Calendar Feed Tokens**: Confirm feed tokens use HMAC-SHA256 storage and cannot leak plaintext tokens from the database.

---

## 2. Infrastructure & Networking

- [ ] **TLS 1.3 Termination**: Verify SSL certificate validity and HTTP to HTTPS redirection.
- [ ] **WebSocket Proxying**: Verify reverse proxy supports `Upgrade` and `Connection` headers for Socket.IO.
- [ ] **Healthcheck Verification**:
  - `GET /api/health` returns `200 OK` (Liveness)
  - `GET /api/ready` returns `200 OK` with `status: ok` across database, redis, storage, and queues (Readiness)
- [ ] **Firewall & Ports**: Verify ports 5432 (PostgreSQL) and 6379 (Redis) are bound to internal networks only and not exposed to the public internet.

---

## 3. Database & Data Integrity

- [ ] **Migration Status**: Run `npx prisma migrate status` to confirm all schema migrations are applied.
- [ ] **Automated Backups**: Automated backup and restore procedures are documented in this runbook; actual backup/restore infrastructure (e.g. Supabase automated backups, cloud daily snapshots, or WAL archiving) is NOT yet configured or tested in this repository and remains a pre-production infrastructure deployment requirement.
- [ ] **Connection Pooling**: Verify Prisma connection pool limits are configured according to server RAM and PostgreSQL `max_connections` (use Supabase session pooler on port 5432 for Render persistent Express API).
- [ ] **Foreign Key Cascades**: Verify that deleting archived test projects cascades cleanly without foreign key violations.

---

## 4. Storage & File Management

- [ ] **Storage Driver**: Verify `STORAGE_DRIVER` is configured to `local` with persistent volume mount or `s3` with verified IAM credentials.
- [ ] **Deduplication Verification**: Upload duplicate binaries and confirm single physical object creation in storage.
- [ ] **Quota & Size Limits**: Verify uploads above 50MB are rejected at the edge with HTTP 413.
- [ ] **Web Worker Isolation**: Verify frontend spreadsheet previewing runs inside the sandboxed Web Worker.

---

## 5. Observability & Logging

- [ ] **Log Format**: Verify `NODE_ENV=production` outputs structured single-line JSON logs to stdout.
- [ ] **Log Redaction**: Confirm sensitive keys (`password`, `token`, `secret`, `jwt`) are redacted as `[REDACTED]`.
- [ ] **Request ID Tracing**: Verify each inbound request returns an `X-Request-Id` response header and correlates with server logs.
- [ ] **External Error Monitoring**: Structured logging and request correlation are implemented; external error monitoring/alerting remains a deployment requirement.

---

## 6. Disaster Recovery & Rollback Runbook

> [!IMPORTANT]
> **Status**: The procedures below are DOCUMENTED operational runbooks. Automated backup/restore infrastructure (e.g. scheduled cloud snapshots, offsite replication, automated restore drills) has NOT yet been configured or tested in this environment; it must be provisioned and validated by DevOps prior to production release.

### Target Recovery Metrics:
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 1 hour (via WAL archiving)

### Database Restore Procedure:
1. Stop API and Worker containers:
   ```bash
   docker compose stop api worker
   ```
2. Restore PostgreSQL dump:
   ```bash
   cat backup_YYYYMMDD.sql | docker compose exec -T postgres psql -U postgres -d d_board
   ```
3. Restart containers and verify health:
   ```bash
   docker compose start api worker
   curl -f http://localhost:5000/api/ready
   ```

### Code Deployment Rollback Procedure:
1. Revert Git tag or checkout previous release commit:
   ```bash
   git checkout tags/v1.0.0
   ```
2. Rebuild and restart services:
   ```bash
   docker compose up -d --build
   ```
3. Verify readiness probe:
   ```bash
   curl -f http://localhost:5000/api/ready
   ```
