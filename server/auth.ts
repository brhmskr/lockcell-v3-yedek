import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";

const PgStore = connectPgSimple(session);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const suppliedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, suppliedBuffer);
}

export function setupSession(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = !!process.env.REPL_SLUG || !!process.env.REPLIT_DEV_DOMAIN;

  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "lockcell-mes-secret-key",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction || isReplit,
        sameSite: isReplit ? "none" as const : "lax" as const,
      },
    })
  );
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
    adminRole?: string;
    operatorMachineId?: number;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Oturum acilmamis" });
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Oturum acilmamis" });
  }
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ message: "Yetkiniz yok" });
  }
  next();
};

let cachedLicenseOk: boolean | null = null;
let cachedLicenseTime = 0;
const LICENSE_CACHE_MS = 60_000;

export const requireLicense: RequestHandler = async (req, res, next) => {
  const now = Date.now();
  if (cachedLicenseOk !== null && now - cachedLicenseTime < LICENSE_CACHE_MS) {
    if (!cachedLicenseOk) {
      return res.status(403).json({ message: "LICENSE_EXPIRED", licenseExpired: true });
    }
    return next();
  }

  try {
    const { checkLicenseStatus } = await import("./license");
    const status = await checkLicenseStatus();
    const ok = status.status !== "expired";
    cachedLicenseOk = ok;
    cachedLicenseTime = now;

    if (!ok) {
      return res.status(403).json({ message: "Lisans suresi dolmus. Sistemi kullanmak icin lisansinizi yenileyin.", licenseExpired: true });
    }
    next();
  } catch (err) {
    console.error("License check error:", err);
    return res.status(403).json({ message: "Lisans dogrulamasi basarisiz. Lutfen sistem yoneticinizle iletisime gecin.", licenseExpired: true });
  }
};

export function invalidateLicenseCache() {
  cachedLicenseOk = null;
  cachedLicenseTime = 0;
}
