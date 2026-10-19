import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Read VITE_* settings from the repo root (.env.local), like the server does; only VITE_-prefixed
  // variables are exposed to the client.
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      // Vite's defaults plus dotfiles and the local SQLite database, which sits in the workspace
      // root and holds password hashes and contact messages.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.*", "*.db", "*.db-*", "uploads/**"],
    },
  },
});
