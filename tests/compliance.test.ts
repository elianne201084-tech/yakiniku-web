import { describe, expect, it } from "vitest";
import { checkPublishable, docStatus, resolveRegulation, type PublishInput } from "@/modules/compliance";

const now = new Date("2026-06-01T00:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

const base = (o: Partial<PublishInput> = {}): PublishInput => ({
  title: "Licuadora de 600 W",
  brandDeclaration: "GENERICO_SIN_MARCA",
  declaredAt: now,
  brandName: null,
  brandBlocked: false,
  hasImage: true,
  activeVariants: [{ priceCents: 2500, costCents: 1500 }],
  docs: [],
  regulation: { regulated: false, accepted: [] },
  ...o,
});

describe("herencia de la marca regulado", () => {
  it("es regulado si cualquier ancestro lo es", () => {
    const r = resolveRegulation([
      { isRegulated: false, acceptedDocTypes: [] },
      { isRegulated: true, acceptedDocTypes: ["CERTIFICADO_INEN"] },
    ]);
    expect(r).toEqual({ regulated: true, accepted: ["CERTIFICADO_INEN"] });
  });
  it("no regulado si ninguno lo es", () => {
    expect(resolveRegulation([{ isRegulated: false, acceptedDocTypes: [] }]).regulated).toBe(false);
  });
});

describe("estado de vigencia", () => {
  it("vigente, por vencer (<=60 días) y vencido", () => {
    expect(docStatus({ expiresAt: days(200) }, now)).toBe("VALID");
    expect(docStatus({ expiresAt: days(30) }, now)).toBe("EXPIRING");
    expect(docStatus({ expiresAt: days(-1) }, now)).toBe("EXPIRED");
  });
});

describe("publicación", () => {
  it("producto no regulado completo es publicable", () => {
    expect(checkPublishable(base(), now)).toEqual([]);
  });
  it("regulado sin documento no se publica", () => {
    const e = checkPublishable(base({ regulation: { regulated: true, accepted: ["CERTIFICADO_INEN"] } }), now);
    expect(e.join(" ")).toMatch(/regulada/);
  });
  it("regulado con documento aprobado y vigente sí", () => {
    const e = checkPublishable(
      base({
        regulation: { regulated: true, accepted: ["CERTIFICADO_INEN"] },
        docs: [{ type: "CERTIFICADO_INEN", expiresAt: days(300), review: "APPROVED" }],
      }),
      now,
    );
    expect(e).toEqual([]);
  });
  it("documento vencido, pendiente o de otro tipo no sirve", () => {
    const reg = { regulated: true, accepted: ["CERTIFICADO_INEN" as const] };
    for (const doc of [
      { type: "CERTIFICADO_INEN" as const, expiresAt: days(-5), review: "APPROVED" as const },
      { type: "CERTIFICADO_INEN" as const, expiresAt: days(100), review: "PENDING" as const },
      { type: "REGISTRO_SANITARIO" as const, expiresAt: days(100), review: "APPROVED" as const },
    ]) {
      expect(checkPublishable(base({ regulation: reg, docs: [doc] }), now).length).toBeGreaterThan(0);
    }
  });
  it("exige declaración de marca y rechaza marcas bloqueadas", () => {
    expect(checkPublishable(base({ declaredAt: null }), now).join(" ")).toMatch(/declaración/);
    expect(checkPublishable(base({ brandDeclaration: "ORIGINAL_AUTORIZADO" }), now).join(" ")).toMatch(/marca/);
    expect(
      checkPublishable(base({ brandName: "X", brandBlocked: true, brandDeclaration: "ORIGINAL_AUTORIZADO" }), now).join(" "),
    ).toMatch(/bloqueada/);
  });
  it("precio menor al costo, sin imagen o sin variantes bloquea", () => {
    expect(checkPublishable(base({ activeVariants: [{ priceCents: 100, costCents: 500 }] }), now).length).toBe(1);
    expect(checkPublishable(base({ hasImage: false }), now).length).toBe(1);
    expect(checkPublishable(base({ activeVariants: [] }), now).length).toBe(1);
  });
});
