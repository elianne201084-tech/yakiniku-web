import { prisma } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp/provider";
import type { TemplateName } from "@/lib/whatsapp/templates";
import type { Prisma } from "@/generated/prisma/client";

const MAX_ATTEMPTS = 5;

/** Encola un mensaje (se guarda junto al pedido; un fallo de WhatsApp nunca pierde el pedido). */
export function enqueueWhatsApp(
  tx: Prisma.TransactionClient,
  args: { orderId: string; to: string; template: TemplateName; vars: string[] },
) {
  return tx.notification.create({
    data: {
      orderId: args.orderId,
      channel: "WHATSAPP",
      to: args.to,
      template: args.template,
      payload: { vars: args.vars },
    },
  });
}

type Claimed = { id: string; to: string; template: TemplateName; payload: { vars: string[] }; attempts: number };

/**
 * Envía los mensajes pendientes. Reclama filas con SKIP LOCKED (dos ejecuciones
 * simultáneas no envían el mismo mensaje) y reintenta con espera creciente.
 * Se llama justo después de crear/cambiar un pedido y desde /api/cron/outbox.
 */
export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  const rows = await prisma.$queryRaw<Claimed[]>`
    UPDATE "Notification" n SET
      "attempts" = n."attempts" + 1,
      "nextAttemptAt" = now() + make_interval(mins => 2 * (n."attempts" + 1) * (n."attempts" + 1))
    WHERE n."id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "createdAt" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED)
    RETURNING n."id", n."to", n."template", n."payload", n."attempts"`;

  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await sendWhatsApp({ to: r.to, template: r.template, vars: r.payload.vars });
      await prisma.notification.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (e) {
      failed++;
      await prisma.notification.update({
        where: { id: r.id },
        data: { lastError: String(e).slice(0, 500), status: r.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING" },
      });
    }
  }
  return { sent, failed };
}
