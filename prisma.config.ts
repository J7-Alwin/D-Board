import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
