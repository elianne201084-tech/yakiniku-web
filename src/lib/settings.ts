import { cache } from "react";
import { prisma } from "./db";

/** Configuración editable desde el panel (una fila JSON en la tabla Setting). */
export type StoreSettings = {
  storeName: string;
  tagline: string;
  company: { legalName: string; ruc: string; address: string; phone: string; email: string; whatsapp: string };
  /** Tarifa general de IVA en %. Verifica la tarifa vigente con tu contador antes de publicar. */
  ivaPercent: number;
  /** Envío gratis desde este subtotal (centavos). 0 = desactivado. */
  freeShippingOverCents: number;
  pixels: { metaPixelId: string; tiktokPixelId: string };
  /** Versión del aviso de privacidad aceptado. Súbela cuando cambie el texto. */
  consentVersion: string;
  policies: { returns: string; warranty: string; privacy: string; terms: string };
};

export const PENDING = "[POR COMPLETAR]";

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Chasqui Market",
  tagline: "Tu mensajero de compras en Ecuador",
  company: { legalName: PENDING, ruc: PENDING, address: PENDING, phone: PENDING, email: PENDING, whatsapp: "" },
  ivaPercent: 15,
  freeShippingOverCents: 0,
  pixels: { metaPixelId: "", tiktokPixelId: "" },
  consentVersion: "2026-10-borrador",
  policies: {
    returns:
      "Puedes devolver o cambiar tu compra dentro de los 15 días posteriores a su recepción, siempre que el producto conserve su estado original (art. 45 de la Ley Orgánica de Defensa del Consumidor).\n\n[POR COMPLETAR: procedimiento, quién paga el envío de devolución, reembolso. Revisar con un abogado.]",
    warranty:
      "[POR COMPLETAR: condiciones de garantía, plazos por categoría y cómo se gestiona con el fabricante. Revisar con un abogado.]",
    privacy:
      "[POR COMPLETAR: aviso de privacidad conforme a la Ley Orgánica de Protección de Datos Personales: responsable del tratamiento, datos que recogemos (nombre, cédula, teléfono, dirección), finalidad (entregar tu pedido y facturar), comunicación a proveedores y transportistas, transferencia internacional, plazo de conservación y cómo ejercer tus derechos.]",
    terms: "[POR COMPLETAR: términos y condiciones de uso y compra.]",
  },
};

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const row = await prisma.setting.findUnique({ where: { key: "store" } });
  const v = (row?.value ?? {}) as Partial<StoreSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    company: { ...DEFAULT_SETTINGS.company, ...v.company },
    pixels: { ...DEFAULT_SETTINGS.pixels, ...v.pixels },
    policies: { ...DEFAULT_SETTINGS.policies, ...v.policies },
  };
});

export async function saveSettings(s: StoreSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "store" },
    create: { key: "store", value: s },
    update: { value: s },
  });
}
