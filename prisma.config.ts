import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
config({ path: ".env.local" });
config({ path: ".env" });

// Support both our name and Vercel's Prisma Postgres integration variable names
const dbUrl =
  process.env["DATABASE_URL"] ||
  process.env["POSTGRES_URL"] ||
  process.env["PRISMA_DATABASE_URL"];

const directUrl = process.env["DIRECT_URL"] || dbUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: dbUrl!,
    ...(directUrl && directUrl !== dbUrl && { directUrl }),
  },
});
