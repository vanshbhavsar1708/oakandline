import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Stateless signed tokens (HMAC-SHA256). The token is kept in memory on the client
 * and sent as `Authorization: Bearer <token>`. AUTH_SECRET must be set in production.
 */
const SECRET =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("AUTH_SECRET must be set in production");
      })()
    : "dev-only-secret-change-me");

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

type TokenPayload = { sub: number; role: string; exp: number };

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signToken(adminId: number, role: string): string {
  const payload: TokenPayload = { sub: adminId, role, exp: Date.now() + TOKEN_TTL_MS };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      admin?: TokenPayload;
    }
  }
}

export function requireAdmin(roles: string[] = ["owner", "editor"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ message: "Please sign in again." });
    if (!roles.includes(payload.role)) return res.status(403).json({ message: "You don't have access to this." });
    req.admin = payload;
    next();
  };
}

/** Minimal in-memory rate limiter for login + public enquiry endpoints. */
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ message: "Too many attempts. Please wait a few minutes and try again." });
    }
    next();
  };
}
