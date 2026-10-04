import { timingSafeEqual } from "node:crypto";

/** Las rutas /api/cron/* exigen `Authorization: Bearer <CRON_SECRET>` (Vercel Cron lo envía solo). */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sin secreto configurado, las tareas quedan cerradas
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
