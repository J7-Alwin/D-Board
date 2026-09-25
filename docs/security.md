# D-Board Security Architecture & Threat Profile

This document outlines the security controls, authentication mechanisms, authorization boundaries, and threat mitigation strategies implemented across D-Board.

---

## 1. Security Architecture & Principles

D-Board adheres to Defense-in-Depth, Principle of Least Privilege, and Zero Trust data validation.

```
+-------------------------------------------------------------------------+
|                              EDGE / INGRESS                             |
|  - TLS 1.3 / Strict-Transport-Security (HSTS)                          |
|  - Rate Limiting (Redis sliding window)                                 |
|  - Security Headers (Helmet, CSP, X-Frame-Options: DENY, nosniff)       |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                        AUTHENTICATION & SESSIONS                        |
|  - HTTP-Only, Secure, SameSite=Lax Cookies                              |
|  - Signed JWT (30-day max TTL) with database session tracking           |
|  - Immediate revocation on logout, password change, or account deletion |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                        AUTHORIZATION & ACCESS CONTROL                   |
|  - Multi-tenant project boundary enforcement                            |
|  - Role-Based Access Control (RBAC): Admin, Member, Viewer              |
|  - Immediate Socket.IO room eviction on membership removal             |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                         DATA & STORAGE PROTECTION                       |
|  - Strict MIME magic byte inspection                                    |
|  - Anti-XSS SVG sanitization (DOMPurify)                                |
|  - Web Worker sandbox isolation for untrusted spreadsheet files         |
|  - Cryptographic token hashing (SHA-256) for calendar feeds             |
|  - Automated credential redaction in structured logs                    |
+-------------------------------------------------------------------------+
```

---

## 2. Authentication & Session Security

### Cookie Configuration
- **Name**: `token`
- **Flags**: `HttpOnly: true`, `SameSite: 'lax'`, `Secure: process.env.NODE_ENV === 'production'`, `Path: '/'`.
- **Mitigation**: Prevents Client-Side JavaScript access (XSS token theft) and restricts cross-origin leakage (CSRF protection).

### Password Hashing
- Passwords are hashed using **bcrypt** with a work factor of 12 rounds.
- Strong password complexity is strictly enforced via Zod schema (minimum 8 characters, requiring uppercase, lowercase, numbers, and special characters).

### Email Verification & Password Resets
- Cryptographically secure tokens generated via `crypto.randomBytes(32)`.
- Verification and reset tokens have short lifespans (1 hour for reset, 24 hours for email verification).

---

## 3. Authorization Matrix & Project Isolation

Every project-scoped endpoint executes access verification middleware before handling logic.

| Capability | Project Owner | Project Admin | Project Member | Project Viewer |
|---|---|---|---|---|
| Read Project Dashboard & Items | Yes | Yes | Yes | Yes |
| View Calendar & Subscribe to Feed | Yes | Yes | Yes | Yes |
| Create / Edit Tasks & Work Items | Yes | Yes | Yes | No |
| Upload Files & Create Folders | Yes | Yes | Yes | No |
| Invite New Members | Yes | Yes | No | No |
| Update Member Roles | Yes | Yes | No | No |
| Remove Members | Yes | Yes (non-owners) | No | No |
| Archive / Unarchive Project | Yes | Yes | No | No |
| Transfer Ownership | Yes | No | No | No |
| Delete Project Permanently | Yes | No | No | No |

---

## 4. Calendar Feed Subscription Security

Calendar feed endpoints (`/api/projects/:projectId/calendar/feed.ics` and `/api/calendar/feed.ics`) provide calendar synchronization to non-browser desktop/mobile applications (Apple Calendar, Google Calendar, Outlook) that cannot maintain browser cookies.

### Protection Model:
1. **Cryptographic Token Generation**: Feed tokens are generated using 32 bytes of cryptographically secure random bytes (256-bit entropy).
2. **One-Way Token Hashing**: The raw feed token is presented to the user **once** during generation. The database only stores the SHA-256 HMAC hash (`feedTokenHash`).
3. **Revocation**: Users can revoke or regenerate their feed token at any time. Revocation immediately invalidates all external calendar clients.
4. **Project Scoping**: Feed URLs are bound to a specific project. Possession of a token for Project A grants zero access to Project B.

---

## 5. Storage & File Upload Defense

1. **Magic Byte Verification**: File headers are inspected using binary magic numbers (e.g. `\xFF\xD8\xFF` for JPEG, `%PDF` for PDF, `PK\x03\x04` for ZIP/Office). Executable files (`.exe`, `.sh`, `.bat`, `.dll`) masquerading as images are rejected immediately with HTTP 400.
2. **SVG Sanitization**: SVG uploads are parsed through `DOMPurify` to eliminate embedded `<script>`, `onload`, `onerror`, or external entities (XXE).
3. **Storage Quota & Size Caps**: Default upload limit is enforced at 50MB per file via Multer streaming checks.

---

## 6. Structured Logging, Request Tracing & Error Monitoring

- **Structured JSON Logger** (`src/utils/logger.ts`): Automatically intercepts and redacts sensitive parameters before writing to stdout (`password`, `token`, `secret`, `jwt`, `authorization`, `cookie`, `apiKey`, `aws_secret_access_key`, `otp`, `feedtoken`).
- **Request Tracing**: Injects `X-Request-Id` UUID on all inbound requests for end-to-end log correlation.
- **External Error Alerting**: Structured logging and request correlation are implemented; external error monitoring/alerting remains a deployment requirement.

---

## 7. Rate Limiting Architecture (True Redis Sliding Window)

The API implements a **true sliding-window rate limiter** using Redis Sorted Sets (`src/middlewares/rateLimit.middleware.ts`):
- **Data Structure**: Redis Sorted Set (`dboard:rate:zset:<tier>:<identifier>`).
- **Pruning**: Atomically removes entries older than the current sliding window using `ZREMRANGEBYSCORE key 0 (nowMs - windowSeconds * 1000)`.
- **Counting**: Evaluates current window cardinality using `ZCARD key`.
- **Insertion**: If under limit, appends request timestamp score with `ZADD` and refreshes key TTL with `EXPIRE`.
- **Fallback**: If Redis is offline, an in-memory timestamp array sliding window provides graceful degradation.

---

## 8. Documented Residual Risk Registry

| Risk ID | Component | Description | Mitigation Strategy | Acceptance Status |
|---|---|---|---|---|
| **RES-01** | `xlsx@0.18.5` | Upstream package contains unpatched CVEs related to prototype pollution in sheet parsing (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). | **Web Worker Sandbox Isolation**: In the frontend SPA, spreadsheet parsing executes in an isolated Web Worker (`src/workers/spreadsheet.worker.ts`). The worker runs in a separate thread without access to the DOM, `window`, `document`, `document.cookie`, or `localStorage`, eliminating DOM-based XSS, cookie theft, and main-thread event loop blocking. Note: Web Workers inherit standard worker environment primitives (such as `fetch`); zero network access is not physically enforced at the thread level. Defense is provided by thread isolation, disabling macros (`bookVBA: false`), disabling external workbook dependencies (`bookDeps: false`), and strictly capping resource consumption (`maxSheets: 20`, `maxRows: 5000`). | **ACCEPTED RESIDUAL RISK** (Documented in Phase 1 & Phase 3) |

