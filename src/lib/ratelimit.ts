import { prisma } from "./db";

/**
 * Límite de intentos en PostgreSQL (sirve en serverless sin Redis).
 * Devuelve true si se permite el intento, false si se superó el límite en la ventana.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count"       = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                           THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                           THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return rows[0].count <= max;
}
