import { describe, expect, it } from "vitest";
import { isValidCedula, isValidIdNumber, isValidRuc, normalizeEcMobile } from "@/lib/validation";

describe("cédula", () => {
  it("acepta cédulas con dígito verificador correcto", () => {
    expect(isValidCedula("1710034065")).toBe(true);
    expect(isValidCedula("0926687856")).toBe(true);
  });
  it("rechaza dígito verificador incorrecto, largo y caracteres", () => {
    expect(isValidCedula("1710034066")).toBe(false);
    expect(isValidCedula("171003406")).toBe(false);
    expect(isValidCedula("17100340ab")).toBe(false);
  });
  it("rechaza provincia inexistente y tercer dígito >= 6", () => {
    expect(isValidCedula("9910034065")).toBe(false);
    expect(isValidCedula("1760034065")).toBe(false);
  });
});

describe("RUC", () => {
  it("persona natural = cédula válida + establecimiento", () => {
    expect(isValidRuc("1710034065001")).toBe(true);
    expect(isValidRuc("1710034065000")).toBe(false);
    expect(isValidRuc("1710034066001")).toBe(false);
  });
  it("acepta cédula o RUC como documento", () => {
    expect(isValidIdNumber("1710034065")).toBe(true);
    expect(isValidIdNumber("1710034065001")).toBe(true);
    expect(isValidIdNumber("123")).toBe(false);
  });
});

describe("celular", () => {
  it("normaliza formatos comunes a 593XXXXXXXXX", () => {
    expect(normalizeEcMobile("0991234567")).toBe("593991234567");
    expect(normalizeEcMobile("099 123 4567")).toBe("593991234567");
    expect(normalizeEcMobile("+593 99 123 4567")).toBe("593991234567");
    expect(normalizeEcMobile("991234567")).toBe("593991234567");
  });
  it("rechaza fijos y números inválidos", () => {
    expect(normalizeEcMobile("022345678")).toBeNull();
    expect(normalizeEcMobile("0891234567")).toBeNull();
    expect(normalizeEcMobile("abc")).toBeNull();
  });
});
