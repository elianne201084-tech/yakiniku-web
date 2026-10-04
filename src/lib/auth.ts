import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "./db";
import { allow } from "./ratelimit";
import type { Role } from "@/generated/prisma/enums";

const COOKIE = "chasqui_session";
const MAX_AGE = 60 * 60 * 8; // 8 horas
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type Session = { userId: string; role: Role; supplierId: string | null; name: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export const hashPassword = (pw: string) => hash(pw, { algorithm: 2 /* argon2id */ });

// Hash de relleno (válido) para que el tiempo de respuesta no revele si el correo existe.
let dummyHash: Promise<string> | undefined;
const getDummy = () => (dummyHash ??= hashPassword("relleno-no-es-una-clave-real"));

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientIp();
  const mail = email.trim().toLowerCase();
  const [okIp, okMail] = await Promise.all([allow(`login:ip:${ip}`, 20, 900), allow(`login:mail:${mail}`, 8, 900)]);
  if (!okIp || !okMail) return { ok: false, error: "Demasiados intentos. Espera unos minutos." };

  const user = await prisma.user.findUnique({ where: { email: mail } });
  const generic = { ok: false as const, error: "Correo o contraseña incorrectos." };
  if (!user || !user.active) {
    await verify(await getDummy(), password).catch(() => false);
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde." };
  }
  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) {
    const failed = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });

  const token = await new SignJWT({ role: user.role, supplierId: user.supplierId, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.sub),
      role: payload.role as Role,
      supplierId: (payload.supplierId as string | null) ?? null,
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

/** Úsalo al inicio de cada página y Server Action del panel. Redirige al login si no hay sesión. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (!roles.includes(s.role)) redirect("/admin/login?error=permiso");
  return s;
}
