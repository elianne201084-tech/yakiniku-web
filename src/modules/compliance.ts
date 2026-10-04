/**
 * Reglas de productos regulados y publicación.
 * Un producto regulado no puede publicarse sin al menos un documento de respaldo
 * aprobado y vigente. Estas funciones son puras para poder probarlas sin base de datos.
 */

export type DocTypeKey =
  | "REGISTRO_SANITARIO"
  | "NOTIFICACION_SANITARIA"
  | "CERTIFICADO_INEN"
  | "HOMOLOGACION_ARCOTEL"
  | "OTRO";

export const DOC_TYPE_LABEL: Record<DocTypeKey, string> = {
  REGISTRO_SANITARIO: "Registro sanitario",
  NOTIFICACION_SANITARIA: "Notificación sanitaria",
  CERTIFICADO_INEN: "Certificado INEN",
  HOMOLOGACION_ARCOTEL: "Homologación ARCOTEL",
  OTRO: "Otro documento",
};

export const EXPIRY_WARNING_DAYS = [60, 30, 7] as const;

export type CategoryNode = { isRegulated: boolean; acceptedDocTypes: DocTypeKey[] };

/** Un producto es regulado si su categoría o cualquier ancestro lo es. */
export function resolveRegulation(chain: CategoryNode[]): { regulated: boolean; accepted: DocTypeKey[] } {
  const regulatedNodes = chain.filter((n) => n.isRegulated);
  if (regulatedNodes.length === 0) return { regulated: false, accepted: [] };
  const accepted = [...new Set(regulatedNodes.flatMap((n) => n.acceptedDocTypes))];
  return { regulated: true, accepted };
}

export type DocLite = {
  type: DocTypeKey;
  expiresAt: Date;
  review: "PENDING" | "APPROVED" | "REJECTED";
};

export type DocStatus = "VALID" | "EXPIRING" | "EXPIRED";

const DAY = 86_400_000;

export function docStatus(doc: Pick<DocLite, "expiresAt">, now = new Date()): DocStatus {
  const left = doc.expiresAt.getTime() - now.getTime();
  if (left < 0) return "EXPIRED";
  if (left <= EXPIRY_WARNING_DAYS[0] * DAY) return "EXPIRING";
  return "VALID";
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY);
}

export type PublishInput = {
  title: string;
  brandDeclaration: "ORIGINAL_AUTORIZADO" | "GENERICO_SIN_MARCA";
  declaredAt: Date | null;
  brandName: string | null;
  brandBlocked: boolean;
  hasImage: boolean;
  activeVariants: { priceCents: number; costCents: number }[];
  docs: DocLite[];
  regulation: { regulated: boolean; accepted: DocTypeKey[] };
};

/** Devuelve la lista de motivos por los que NO se puede publicar. Vacía = publicable. */
export function checkPublishable(p: PublishInput, now = new Date()): string[] {
  const errors: string[] = [];
  if (p.title.trim().length < 5) errors.push("El título es demasiado corto.");
  if (!p.hasImage) errors.push("Falta al menos una imagen.");
  if (p.activeVariants.length === 0) errors.push("Falta al menos una variante activa.");
  if (p.activeVariants.some((v) => v.priceCents <= 0)) errors.push("Hay variantes sin precio.");
  if (p.activeVariants.some((v) => v.priceCents < v.costCents)) {
    errors.push("Hay variantes con precio menor al costo.");
  }

  if (!p.declaredAt) errors.push("Falta la declaración del proveedor sobre la marca (original o genérico).");
  if (p.brandDeclaration === "ORIGINAL_AUTORIZADO" && !p.brandName) {
    errors.push("Un producto original debe indicar su marca.");
  }
  if (p.brandBlocked) errors.push(`La marca "${p.brandName}" está bloqueada: no se permite su publicación.`);

  if (p.regulation.regulated) {
    const usable = p.docs.filter(
      (d) =>
        d.review === "APPROVED" &&
        docStatus(d, now) !== "EXPIRED" &&
        (p.regulation.accepted.length === 0 || p.regulation.accepted.includes(d.type)),
    );
    if (usable.length === 0) {
      const names = p.regulation.accepted.map((t) => DOC_TYPE_LABEL[t]).join(" / ");
      errors.push(
        `Categoría regulada: falta un documento de respaldo aprobado y vigente${names ? ` (${names})` : ""}.`,
      );
    }
  }
  return errors;
}
