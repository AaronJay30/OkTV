// lib/admin-auth.ts
//
// Admin authentication helpers. Spec 04 §4.
//
// Token format (payload.signature, base64url-encoded):
//   payload   = JSON.stringify({ exp: <epoch ms> })
//   signature = base64url(HMAC-SHA256(payload, ADMIN_SESSION_SECRET))
//
// Cookies set on login:
//   oktv_admin  = token (HttpOnly, Secure in prod, SameSite=Strict, Path=/)
//   oktv_csrf   = random 32-byte hex; non-HttpOnly; used for CSRF double-submit
//
// SECURITY MODEL:
//   - The admin password hash from ADMIN_PASSWORD_HASH is bcrypt.
//   - Sessions are HMAC-signed, self-validating (no server-side store).
//   - requireAdmin() verifies the cookie on every admin API call.
//   - All admin routes return 404 (not 401/403) on failure to avoid
//     leaking the existence of the admin path.

import bcrypt from "bcryptjs";
import crypto from "crypto";

export const ADMIN_COOKIE = "oktv_admin";
export const CSRF_COOKIE = "oktv_csrf";
const CSRF_HEADER = "x-admin-csrf";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h, locked in spec §4.5

/**
 * Read ADMIN_PATH_SLICE from env. Falls back to spec default (console-0724).
 * Never returns empty — that would 404 everything.
 */
export function getAdminPathSlice(): string {
    const raw = process.env.ADMIN_PATH_SLICE?.trim();
    if (raw && raw.length > 0 && !raw.startsWith("#")) return raw;
    return "console-0724";
}

/**
 * Whether the admin layer is configured enough to even attempt login.
 * Returns false (with reason) if hash or secret is missing — callers
 * should respond 503 ADMIN_NOT_CONFIGURED.
 */
export function getAdminConfigError(): string | null {
    if (!process.env.ADMIN_PASSWORD_HASH?.trim()) {
        return "ADMIN_PASSWORD_HASH not set";
    }
    if (!process.env.ADMIN_SESSION_SECRET?.trim()) {
        return "ADMIN_SESSION_SECRET not set";
    }
    return null;
}

/**
 * Bcrypt-compare a raw password against the stored hash. Returns false
 * on any error (missing hash, malformed hash, comparison failure) so
 * callers can collapse to a single "invalid credentials" response.
 */
export async function verifyAdminPassword(rawPassword: string): Promise<boolean> {
    const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
    if (!hash) return false;
    try {
        return await bcrypt.compare(rawPassword, hash);
    } catch {
        return false;
    }
}

// ── HMAC token sign/verify ──────────────────────────────────────────

function b64urlEncode(buf: Buffer | string): string {
    const b = typeof buf === "string" ? Buffer.from(buf) : buf;
    return b
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return Buffer.from(norm, "base64");
}

function hmac(payload: string, secret: string): Buffer {
    return crypto.createHmac("sha256", secret).update(payload).digest();
}

/**
 * Constant-time equality for Buffers. Returns false on length mismatch.
 * crypto.timingSafeEqual requires equal-length inputs.
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Mint a session token. Returns the token string (cookie value).
 */
export function issueAdminToken(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) throw new Error("ADMIN_SESSION_SECRET not set");
    const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
    const payloadB64 = b64urlEncode(payload);
    const signature = b64urlEncode(hmac(payloadB64, secret));
    return `${payloadB64}.${signature}`;
}

export type VerifyResult =
    | { ok: true }
    | { ok: false; reason: "missing" | "malformed" | "expired" | "bad-signature" };

/**
 * Verify a session token. On any failure returns ok:false with a reason —
 * callers should treat all four the same way externally (return 404).
 */
export function verifyAdminToken(token: string | undefined | null): VerifyResult {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!token || !secret) return { ok: false, reason: "missing" };
    const parts = token.split(".");
    if (parts.length !== 2) return { ok: false, reason: "malformed" };
    const [payloadB64, signatureB64] = parts;

    let sigBytes: Buffer;
    try {
        sigBytes = b64urlDecode(signatureB64);
    } catch {
        return { ok: false, reason: "malformed" };
    }
    const expected = hmac(payloadB64, secret);
    if (!timingSafeEqual(sigBytes, expected)) {
        return { ok: false, reason: "bad-signature" };
    }

    let payload: { exp?: number };
    try {
        const json = b64urlDecode(payloadB64).toString("utf8");
        payload = JSON.parse(json);
    } catch {
        return { ok: false, reason: "malformed" };
    }
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
        return { ok: false, reason: "expired" };
    }
    return { ok: true };
}

/**
 * Constant-time string equality. Used to compare CSRF token (header vs cookie).
 */
export function constantTimeEqual(a: string, b: string): boolean {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Issue a random CSRF token (32 hex chars). Sticks in ok_csrf cookie.
 */
export function issueCsrfToken(): string {
    return crypto.randomBytes(16).toString("hex");
}

// ── Cookie helpers ──────────────────────────────────────────────────

export interface CookieOptions {
    secure: boolean; // true in production
    httpOnly: boolean;
    sameSite: "Strict" | "Lax" | "None";
    maxAgeMs: number;
    path: string;
}

function baseCookieOptions(secure: boolean, maxAgeMs: number): CookieOptions {
    return {
        secure,
        httpOnly: true,
        sameSite: "Strict",
        maxAgeMs,
        path: "/",
    };
}

/**
 * Serialize a cookie header. CookieStore.set is not always available in
 * App Router route handlers, so we use Set-Cookie strings.
 */
export function serializeCookie(
    name: string,
    value: string,
    opts: CookieOptions
): string {
    const parts = [`${name}=${value}`];
    if (opts.maxAgeMs > 0) parts.push(`Max-Age=${Math.floor(opts.maxAgeMs / 1000)}`);
    parts.push(`Path=${opts.path}`);
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.secure) parts.push("Secure");
    parts.push(`SameSite=${opts.sameSite}`);
    return parts.join("; ");
}

/**
 * Build the two Set-Cookie headers for a successful login. Returned
 * as an array — callers concatenate into the Response headers.
 */
export function buildLoginCookieHeaders(token: string, csrf: string): string[] {
    const isProd = process.env.NODE_ENV === "production";
    const sessionOpts = baseCookieOptions(isProd, SESSION_TTL_MS);
    // CSRF cookie: NOT HttpOnly (read by JS to set header), SameSite=Strict.
    const csrfOpts: CookieOptions = {
        secure: isProd,
        httpOnly: false,
        sameSite: "Strict",
        maxAgeMs: SESSION_TTL_MS,
        path: "/",
    };
    return [
        serializeCookie(ADMIN_COOKIE, token, sessionOpts),
        serializeCookie(CSRF_COOKIE, csrf, csrfOpts),
    ];
}

export function buildLogoutCookieHeaders(): string[] {
    // Clear both cookies. Empty value + Max-Age=0 + same Path.
    const isProd = process.env.NODE_ENV === "production";
    const sessionOpts = baseCookieOptions(isProd, 0);
    const csrfOpts: CookieOptions = {
        secure: isProd,
        httpOnly: false,
        sameSite: "Strict",
        maxAgeMs: 0,
        path: "/",
    };
    return [
        serializeCookie(ADMIN_COOKIE, "", sessionOpts),
        serializeCookie(CSRF_COOKIE, "", csrfOpts),
    ];
}

// ── Path gate ───────────────────────────────────────────────────────

/**
 * Is this URL path within the configured admin segment?
 * Used by the dynamic [adminPath] layout to enforce the path gate.
 * Returns false for /api/admin/* since those have their own guard.
 */
export function isAdminPath(pathname: string): boolean {
    const slice = getAdminPathSlice();
    return pathname === `/${slice}` || pathname.startsWith(`/${slice}/`);
}

// ── Rate limiter (login throttle) ────────────────────────────────────
// 5 attempts / 60s / IP, checked before bcrypt (spec §4.2).
// In-memory — single-instance only. Documented limitation.

const LOGIN_RATE_WINDOW_MS = 60_000;
const LOGIN_RATE_MAX = 5;
const loginAttempts = new Map<string, number[]>();

export function checkLoginRate(ip: string): { ok: true } | { ok: false; retryMs: number } {
    const now = Date.now();
    const arr = loginAttempts.get(ip) ?? [];
    // Drop entries outside the window.
    const recent = arr.filter((t) => now - t < LOGIN_RATE_WINDOW_MS);
    if (recent.length >= LOGIN_RATE_MAX) {
        const oldest = recent[0];
        return { ok: false, retryMs: LOGIN_RATE_WINDOW_MS - (now - oldest) };
    }
    recent.push(now);
    loginAttempts.set(ip, recent);
    return { ok: true };
}

/** Forget attempts for an IP — call on successful login. */
export function clearLoginRate(ip: string): void {
    loginAttempts.delete(ip);
}

// ── requireAdmin ────────────────────────────────────────────────────

/**
 * Server-side guard. Call at the top of any admin API route handler.
 * Mutates the provided Response Init with appropriate headers (e.g.
 * 404 status) on failure — caller should `return` immediately.
 *
 * Usage:
 *   const guard = requireAdmin(req);
 *   if (!guard.ok) return NextResponse.json({}, { status: guard.status });
 */
export type AdminGuard =
    | { ok: true; csrfOk: boolean }
    | { ok: false; status: number };

/**
 * Minimal request shape — avoids depending on Next types. Pass
 * `req.cookies` and `req.headers` from a Next.js RouteContext.
 */
export interface GuardInput {
    cookies: { get(name: string): { value: string } | undefined };
    headers: { get(name: string): string | null };
    method: string;
}

export function requireAdmin(input: GuardInput): AdminGuard {
    if (getAdminConfigError()) {
        // Spec §4.2: 503 ADMIN_NOT_CONFIGURED. We still 404 the page itself;
        // the API returns 503 so scripts can distinguish "not set up" from
        // "wrong password".
        return { ok: false, status: 503 };
    }
    const tokenCookie = input.cookies.get(ADMIN_COOKIE);
    const verify = verifyAdminToken(tokenCookie?.value);
    if (!verify.ok) {
        return { ok: false, status: 404 };
    }
    // CSRF required on mutations only.
    const isMutation =
        input.method.toUpperCase() === "POST" ||
        input.method.toUpperCase() === "PUT" ||
        input.method.toUpperCase() === "PATCH" ||
        input.method.toUpperCase() === "DELETE";
    let csrfOk = true;
    if (isMutation) {
        const csrfCookie = input.cookies.get(CSRF_COOKIE)?.value ?? "";
        const csrfHeader = input.headers.get(CSRF_HEADER) ?? "";
        csrfOk =
            csrfCookie.length > 0 &&
            csrfHeader.length > 0 &&
            constantTimeEqual(csrfCookie, csrfHeader);
        if (!csrfOk) return { ok: false, status: 404 };
    }
    return { ok: true, csrfOk };
}

/**
 * Extract client IP from a request. Used by the login rate limiter.
 * X-Forwarded-For is trusted; in production behind a reverse proxy you
 * should also verify the header is set by the proxy (TODO if deployed).
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
    const xff = headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return headers.get("x-real-ip") ?? "unknown";
}
