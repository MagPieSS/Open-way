import { defineConfig } from "vitest/config";
import path from "path";
import os from "os";

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
      // Route tests upload images; keep them out of the project's uploads/ folder.
      UPLOADS_DIR: path.join(os.tmpdir(), "openway-test-uploads"),
    },
    // Stands in for Google sign-in (see the file for how test sign-in codes work).
    setupFiles: ["server/test-setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
