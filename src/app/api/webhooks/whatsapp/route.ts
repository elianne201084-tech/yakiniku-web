import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { confirmByWhatsAppReply } from "@/modules/orders";
import { processOutbox } from "@/modules/notifications";
import { after } from "next/server";

/** Verificación inicial del webhook (Meta llama con GET al configurarlo). */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

const YES = new Set(["si", "sí", "s", "confirmo", "confirmar", "confirmado", "ok", "dale", "listo"]);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

type Payload = { entry?: { changes?: { value?: { messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[] };

/** Mensajes entrantes. Un "SI" confirma el pedido nuevo más reciente de ese número. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET ?? "";
  // Sin firma válida no se procesa nada (cualquiera podría fingir ser el cliente).
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }
  let body: Payload;
  try { body = JSON.parse(raw); } catch { return new Response("bad request", { status: 400 }); }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type !== "text" || !m.text) continue;
        if (!YES.has(norm(m.text.body))) continue;
        try {
          await confirmByWhatsAppReply(m.from);
        } catch (e) {
          console.error("[whatsapp:webhook]", e);
        }
      }
    }
  }
  after(() => processOutbox(10).catch(() => undefined));
  return NextResponse.json({ ok: true });
}
