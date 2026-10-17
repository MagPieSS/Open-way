import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    // Tests must never touch the developer's sqlite.db or a Postgres DATABASE_URL from .env.local.
    // dotenv (loaded in server/db.ts) does not override variables that are already set, even to "".
    env: {
      SQLITE_PATH: ":memory:",
      DATABASE_URL: "",
      NODE_ENV: "test",
    },
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
