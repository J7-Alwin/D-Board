export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "D-Board REST API",
    version: "1.0.0",
    description: "Production REST API for D-Board workspace management, collaborative projects, secure file storage, real-time messaging, and scheduling.",
    contact: {
      name: "D-Board Engineering Team"
    }
  },
  servers: [
    {
      url: "/api",
      description: "Default API Gateway"
    }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "HTTP-only JWT session cookie"
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Authorization header: Bearer <token>"
      },
      feedTokenAuth: {
        type: "apiKey",
        in: "query",
        name: "token",
        description: "High-entropy revocable calendar feed secret token"
      }
    },
    schemas: {
      StandardResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operation completed successfully" }
        },
        required: ["success"]
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Invalid or unauthorized request" },
          code: { type: "string", example: "UNAUTHORIZED" },
          requestId: { type: "string", example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
          errors: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: { type: "string" }
            }
          }
        },
        required: ["success", "message", "code"]
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          username: { type: "string" },
          email: { type: "string", format: "email" },
          fullName: { type: "string", nullable: true },
          avatarUrl: { type: "string", nullable: true },
          isEmailVerified: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          key: { type: "string" },
          description: { type: "string", nullable: true },
          status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
          createdById: { type: "string", format: "uuid" },
          technologyStack: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      WorkItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          type: { type: "string", enum: ["TASK", "BUG", "FEATURE", "IMPROVEMENT"] },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueDate: { type: "string", format: "date-time", nullable: true },
          assignedToId: { type: "string", format: "uuid", nullable: true },
          createdById: { type: "string", format: "uuid" }
        }
      },
      CalendarEvent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          type: { type: "string", enum: ["MEETING", "MILESTONE", "RELEASE", "DEADLINE", "OTHER"] },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          allDay: { type: "boolean" },
          location: { type: "string", nullable: true }
        }
      },
      Attachment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          originalName: { type: "string" },
          mimeType: { type: "string" },
          sizeBytes: { type: "integer" },
          category: { type: "string" },
          checksum: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      }
    }
  },
  paths: {
    "/health": {
      get: {
        summary: "API Liveness Probe",
        description: "Lightweight liveness check verifying the application process is running.",
        responses: {
          200: {
            description: "Process healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "d-board-api" },
                    uptimeSeconds: { type: "number" },
                    timestamp: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/ready": {
      get: {
        summary: "API Readiness Probe",
        description: "Verifies database, Redis cache, BullMQ queues, and object storage connectivity.",
        responses: {
          200: {
            description: "All core subsystems ready",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ready" },
                    service: { type: "string", example: "d-board-api" },
                    checks: {
                      type: "object",
                      properties: {
                        database: { type: "object", properties: { status: { type: "string" }, latencyMs: { type: "number" } } },
                        redis: { type: "object", properties: { status: { type: "string" }, latencyMs: { type: "number" } } },
                        storage: { type: "object", properties: { status: { type: "string" }, latencyMs: { type: "number" } } },
                        queues: { type: "object", properties: { status: { type: "string" }, details: { type: "string" } } }
                      }
                    },
                    timestamp: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          },
          503: {
            description: "One or more critical subsystems unavailable",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "not_ready" },
                    checks: { type: "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/auth/register": {
      post: {
        summary: "Register Account",
        description: "Registers a new user and dispatches an email verification token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "username", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  username: { type: "string", minLength: 3 },
                  password: { type: "string", minLength: 8 },
                  fullName: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "User registered successfully" },
          400: { description: "Validation error" },
          409: { description: "Email or username already exists" }
        }
      }
    },
    "/auth/login": {
      post: {
        summary: "User Login",
        description: "Authenticates credentials and sets an HTTP-only session cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Logged in successfully with session cookie" },
          401: { description: "Invalid credentials or deactivated account" }
        }
      }
    },
    "/auth/logout": {
      post: {
        summary: "User Logout",
        description: "Revokes the active session record and clears the session cookie.",
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: "Logged out successfully" }
        }
      }
    },
    "/projects": {
      get: {
        summary: "List User Projects",
        description: "Returns all projects where the authenticated user is an active member or owner.",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Array of accessible projects",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Project" } }
                  }
                }
              }
            }
          },
          401: { description: "Unauthorized" }
        }
      },
      post: {
        summary: "Create Project",
        description: "Creates a new project and initializes the creator as PROJECT_OWNER.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "key"],
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 80 },
                  key: { type: "string", minLength: 2, maxLength: 10 },
                  description: { type: "string", maxLength: 500 },
                  technologyStack: { type: "array", items: { type: "string" } },
                  invitations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        email: { type: "string", format: "email" },
                        role: { type: "string", enum: ["PROJECT_ADMIN", "PROJECT_MEMBER"] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Project created" },
          400: { description: "Invalid parameters or duplicate key" }
        }
      }
    },
    "/projects/{projectId}/files": {
      get: {
        summary: "List Project Files",
        description: "Retrieves project files with filtering, category classification, and pagination. Accessible even if project is ARCHIVED.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Files retrieved" },
          403: { description: "Not a project member" }
        }
      },
      post: {
        summary: "Upload Files to Project",
        description: "Uploads multiple files with SHA-256 deduplication. Strictly BLOCKED if project is ARCHIVED.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: { type: "array", items: { type: "string", format: "binary" } },
                  folderId: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Files uploaded and bound" },
          400: { description: "Project is ARCHIVED or quota exceeded" },
          403: { description: "Unauthorized" }
        }
      }
    },
    "/projects/{projectId}/calendar/feed.ics": {
      get: {
        summary: "Subscribe to Project iCalendar Stream",
        description: "Standard RFC 5545 iCalendar feed authenticated via high-entropy secret query token. Cross-project access is blocked.",
        security: [{ feedTokenAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "token", in: "query", required: false, schema: { type: "string" } }
        ],
        responses: {
          200: {
            description: "Standard text/calendar stream",
            content: { "text/calendar": { schema: { type: "string" } } }
          },
          401: { description: "Invalid, revoked, or missing token" },
          403: { description: "Token issued for a different project" }
        }
      }
    },
    "/projects/{projectId}/calendar/feed/token": {
      post: {
        summary: "Generate or Rotate Feed Token",
        description: "Generates a 256-bit cryptographic subscription feed token and invalidates previous tokens.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          201: { description: "Feed token generated" },
          403: { description: "Non-member unauthorized" }
        }
      },
      delete: {
        summary: "Revoke Feed Token",
        description: "Immediately marks the active subscription feed token as revoked.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          200: { description: "Token revoked" }
        }
      }
    }
  }
};
