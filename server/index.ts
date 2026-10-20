import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { pool } from "./db";

(async () => {
  const { app, httpServer } = await createApp();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // The dev server serves Vite's /@fs/ file access, so it listens on this machine only unless
  // HOST says otherwise (e.g. HOST=0.0.0.0 on a hosted dev environment). Production listens on
  // all interfaces.
  const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // Last-resort safety net for errors outside Express's request/response cycle (background
  // tasks, timers, etc. — anything express-async-errors above doesn't cover).
  //
  // unhandledRejection: a rejected promise nobody awaited doesn't corrupt process state, so
  // logging and continuing is safe and keeps the server available.
  //
  // uncaughtException: per Node's own docs, the process is in an undefined state after a truly
  // uncaught synchronous throw — continuing risks silent corruption or, as seen while testing
  // this (a swallowed EADDRINUSE left a zombie process not actually serving traffic), a process
  // that appears alive but isn't doing its job. Log and exit; let the process manager restart it.
  process.on("unhandledRejection", (reason) => {
    log(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack || reason.message : reason}`, "error");
  });
  process.on("uncaughtException", (err) => {
    log(`Uncaught exception, exiting: ${err.stack || err.message}`, "error");
    process.exit(1);
  });

  // Graceful shutdown: stop accepting new connections and let in-flight requests finish
  // before closing the DB pool, instead of dropping everything on SIGTERM/SIGINT.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      if (pool) {
        await pool.end().catch((err) => log(`Error closing DB pool: ${err}`, "error"));
      }
      log("Shutdown complete.");
      process.exit(0);
    });
    // Force-exit if connections don't drain in time
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
