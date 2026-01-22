import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import path from "path";

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

// Use provided secret or secure development fallback
const effectiveSessionSecret = sessionSecret || "dev-only-secret-not-for-production-use-32chars";

// Trust first proxy (required for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Extend express-session types to include our user data
declare module "express-session" {
  interface SessionData {
    userId: number;
    email: string;
    pending2FAUserId?: number;
    csrfToken?: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security headers with helmet (configured for production)
app.use(
  helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
  })
);

// Rate limiting for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiRateLimiter);

// Session setup with PostgreSQL store
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool: pool,
  tableName: "session",
  createTableIfMissing: true,
});

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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Serve stock images from attached_assets folder
const assetsPath = path.resolve(process.cwd(), "attached_assets");
app.use("/assets", express.static(assetsPath));

// ==================== CSRF PROTECTION ====================
import crypto from "crypto";

// Generate CSRF token for session
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Middleware to ensure CSRF token exists in session
export function ensureCsrfToken(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

// CSRF validation middleware for state-changing requests
export function validateCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF for unauthenticated users (register/login handle their own protection via rate limiting)
  if (!req.session.userId) {
    return next();
  }

  const csrfToken = req.headers["x-csrf-token"] as string;
  
  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid security token. Please refresh and try again." });
  }

  next();
}

// Apply CSRF token generation to all requests (after session middleware)
app.use(ensureCsrfToken);

// Endpoint to get CSRF token (needed by frontend)
app.get("/api/csrf-token", (req, res) => {
  res.json({ token: req.session.csrfToken });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Don't log sensitive auth responses
      if (capturedJsonResponse && !path.includes("/auth/")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
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
  httpServer.listen(
    {
      port,
      host: "localhost",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
