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

### Google OAuth 2.0 Integration
- **Flow**: Server-side confidential client Authorization Code Flow (`response_type=code`).
- **CSRF Protection**: 24-byte cryptographically secure random `state` token generated per flow and persisted in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`oauth_state`), verified upon callback redirect.
- **Server-to-Server Token Exchange**: The authorization code is exchanged directly by the backend API with Google's token endpoint (`https://oauth2.googleapis.com/token`) using the confidential `GOOGLE_CLIENT_SECRET`.
- **Identity Verification & UserInfo**: User identity is retrieved directly from Google's authenticated UserInfo endpoint (`https://www.googleapis.com/oauth2/v3/userinfo`) over TLS. The implementation enforces `email_verified === true` (unverified Google accounts are rejected with HTTP 403). Note: Verification relies on direct authenticated HTTPS UserInfo retrieval rather than offline ID-token signature validation.
- **Account Takeover Prevention**: Existing user accounts with matching emails are linked to `googleId` only if they are not already linked to a different Google identity. Conflicting Google IDs are rejected with HTTP 409.
- **PKCE Decision**: Because D-Board operates as a confidential client where `GOOGLE_CLIENT_SECRET` is stored securely on the backend server (Render Web Service) and never exposed to browser clients, PKCE (RFC 7636, designed for public clients) is not required for the server-mediated authorization code exchange.

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
| **RES-01** | `xlsx@0.18.5` | Upstream package contains unpatched CVEs related to prototype pollution in sheet parsing (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). "Zero vulnerabilities" is NOT claimed due to these known upstream issues. | **Web Worker Sandbox Isolation**: In the frontend SPA, spreadsheet parsing executes in an isolated Web Worker (`src/workers/spreadsheet.worker.ts`). The worker runs in a separate thread without access to the DOM, `window`, `document`, `document.cookie`, or `localStorage`, eliminating DOM-based XSS, cookie theft, and main-thread event loop blocking. Note: Worker isolation is not equivalent to a separate security origin and does not inherently remove fetch/network primitives. Defense is provided by thread isolation, disabling macros (`bookVBA: false`), disabling external workbook dependencies (`bookDeps: false`), strictly capping resource consumption (`maxSheets: 20`, `maxRows: 5000`), and terminating the worker on parsing completion. | **ACCEPTED RESIDUAL RISK** (Documented in Phase 1, Phase 2, & Phase 3) |

