import { renderTemplate, type TemplateName } from "./templates";

export type OutboundWhatsApp = { to: string; template: TemplateName; vars: string[] };

/**
 * Envía un mensaje de plantilla. Lanza error si falla (el procesador reintenta).
 * WHATSAPP_PROVIDER=console solo registra el mensaje (desarrollo y pruebas).
 * WHATSAPP_PROVIDER=cloud usa la API Cloud de WhatsApp Business (Meta).
 */
export async function sendWhatsApp(msg: OutboundWhatsApp): Promise<void> {
  const provider = process.env.WHATSAPP_PROVIDER ?? "console";
  if (provider === "console") {
    console.log(`[whatsapp:console] → ${msg.to}: ${renderTemplate(msg.template, msg.vars)}`);
    return;
  }
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN");

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "template",
      template: {
        name: msg.template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
        components: [{ type: "body", parameters: msg.vars.map((text) => ({ type: "text", text })) }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
