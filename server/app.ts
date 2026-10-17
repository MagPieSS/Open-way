import express, { type Express, type Request, Response, NextFunction } from "express";
// Must be imported before any routes are registered: patches Express to forward rejected
// promises from async route handlers to the error middleware instead of crashing the process.
// Express 4 does not do this natively — before this was added, any unhandled error/rejection
// inside an `async (req, res) => {...}` route handler took down the entire server for every user.
import "express-async-errors";
import session, { MemoryStore } from "express-session";
import helmet from "helmet";
import cors from "cors";
import connectPgSimple from "connect-pg-simple";
import { createServer, type Server } from "http";
import path from "path";
import fsSync from "fs";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import { apiRateLimiter, generateCsrfToken } from "./middleware";
import { uploadsDir } from "./uploads";

// Extend express-session types to include our user data
declare module "express-session" {
  interface SessionData {
    userId: number;
    email: string;
    pending2FAUserId?: number;
    csrfToken?: string;
    // users.session_version at sign-in; see checkSessionUser() in routes.ts.
    sessionVersion?: number;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Builds the Express app with its middleware stack, API routes and error handler, without
// listening on a port or attaching Vite/static serving. index.ts adds those for the real server;
// route tests call this directly and listen on an ephemeral port.
export async function createApp(): Promise<{ app: Express; httpServer: Server }> {
  const app = express();
  const httpServer = createServer(app);

  // ==================== SECURITY VALIDATION ====================
  // Validate critical security secrets on startup
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;

  if (isProduction && !sessionSecret) {
    console.error("FATAL: SESSION_SECRET environment variable is required in production");
    process.exit(1);
  }

  if (sessionSecret && sessionSecret.length < 32) {
    console.error("FATAL: SESSION_SECRET must be at least 32 characters for security");
    process.exit(1);
  }

  if (isProduction && !process.env.APP_BASE_URL) {
    console.warn(
      "[security] APP_BASE_URL is not set. Password-reset and verification links will be built from " +
      "the request's Host header, which can be forged. Set APP_BASE_URL to the site's public address."
    );
  }

  // Use provided secret or secure development fallback
  const effectiveSessionSecret = sessionSecret || "dev-only-secret-not-for-production-use-32chars";

  // Trust first proxy (required for rate limiting behind reverse proxy)
  app.set("trust proxy", 1);

  // Security headers with helmet (configured for production)
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
          connectSrc: ["'self'", "https://storage.googleapis.com", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          workerSrc: ["'self'", "blob:"],
        },
      } : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      noSniff: true,
      xssFilter: true,
    })
  );

  // CORS: same-origin by default. Set ALLOWED_ORIGINS (comma-separated) to allow the API to be
  // called from other origins (e.g. a separately-hosted frontend); credentialed requests from
  // origins not on that list are rejected.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // same-origin / non-browser requests
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use("/api", apiRateLimiter);

  // Session setup with PostgreSQL store when available, otherwise use memory for local development
  let sessionStore: session.Store;
  if (pool) {
    const PgSession = connectPgSimple(session);
    sessionStore = new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  } else {
    sessionStore = new MemoryStore();
    console.log("[session] Using in-memory session store because no PostgreSQL database is configured.");
  }

  app.use(
    session({
      store: sessionStore,
      secret: effectiveSessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "openway.sid",
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  app.use((req, res, next) => {
    if (req.path === "/api/uploads/proxy") {
      return next();
    }
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });

  // No urlencoded body parser: every client write is JSON via apiRequest(). Parsing form posts
  // let a cross-site <form> log a visitor into someone else's account (login CSRF), because
  // cross-site JSON needs a CORS preflight that the CORS config rejects but a form post does not.

  // Serve static uploads
  app.use("/uploads", express.static(uploadsDir(), { maxAge: "1d" }));

  // Serve stock images from attached_assets folder
  const assetsPath = path.resolve(process.cwd(), "attached_assets");
  app.use("/assets", express.static(assetsPath));

  // Serve place images - try multiple paths for dev vs production
  const possibleImagePaths = [
    path.resolve(process.cwd(), "dist/public/images"),
    path.resolve(process.cwd(), "client/public/images"),
  ];
  for (const imgPath of possibleImagePaths) {
    if (fsSync.existsSync(imgPath)) {
      app.use("/images", express.static(imgPath, { maxAge: "1d" }));
      console.log(`[static] Serving images from: ${imgPath}`);
    }
  }

  // The token is created only when the client asks for one (apiRequest() does before any write).
  // Creating it on every request stored a session for every anonymous page view and bot hit.
  app.get("/api/csrf-token", (req, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    res.json({ token: req.session.csrfToken });
  });

  // Request logging: method, path, status and timing only. Response bodies used to be logged too,
  // which wrote contact messages, emails and petition signatures into the hosting logs.
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      if (path.startsWith("/api") && process.env.NODE_ENV !== "test") {
        log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });

    next();
  });

  console.log("[startup] Database connection check...");
  await registerRoutes(httpServer, app);

  // Error handler - don't expose stack traces to users
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Only show generic message in production
    const message = process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : err.message || "Internal Server Error";

    log(`Error: ${err.message || err}`, "error");
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
