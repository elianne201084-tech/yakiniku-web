import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { renderTemplate, TEMPLATES } from "@/lib/whatsapp/templates";

describe("firma del webhook de Meta", () => {
  const secret = "app-secret";
  const body = JSON.stringify({ hola: "mundo" });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("acepta una firma válida", () => expect(verifyMetaSignature(body, sig, secret)).toBe(true));
  it("rechaza cuerpo alterado, firma ajena, vacía o sin secreto", () => {
    expect(verifyMetaSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, "otro")).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=zz", secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, "")).toBe(false);
  });
});

describe("plantillas", () => {
  it("rellena las variables", () => {
    expect(renderTemplate("pedido_confirmado", ["Ana", "CH-1", "https://x/y"])).toBe(
      "¡Listo Ana! Confirmamos tu pedido CH-1 y ya lo estamos preparando. Sigue tu pedido aquí: https://x/y",
    );
  });
  it("todas las plantillas usan variables consecutivas desde {{1}}", () => {
    for (const [name, text] of Object.entries(TEMPLATES)) {
      const nums = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const max = Math.max(...nums);
      expect(new Set(nums).size, name).toBe(max);
    }
  });
});
