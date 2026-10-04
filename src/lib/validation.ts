/** Validaciones de identificación y teléfono para Ecuador. */

const onlyDigits = (s: string) => /^\d+$/.test(s);

/** Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30), tercer dígito < 6, módulo 10. */
export function isValidCedula(value: string): boolean {
  if (value.length !== 10 || !onlyDigits(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  const third = Number(value[2]);
  if (third >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(value[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[9]);
}

function mod11(digits: string, coefs: number[], checkIndex: number): boolean {
  let sum = 0;
  for (let i = 0; i < coefs.length; i++) sum += Number(digits[i]) * coefs[i];
  const r = sum % 11;
  const check = r === 0 ? 0 : 11 - r;
  return check === Number(digits[checkIndex]);
}

/** RUC de 13 dígitos: persona natural (cédula + 001), sociedad privada (3.er dígito 9) o pública (6). */
export function isValidRuc(value: string): boolean {
  if (value.length !== 13 || !onlyDigits(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  const third = Number(value[2]);
  const suffix = value.slice(10);
  if (third < 6) return isValidCedula(value.slice(0, 10)) && Number(suffix) >= 1;
  if (third === 9) return mod11(value, [4, 3, 2, 7, 6, 5, 4, 3, 2], 9) && Number(suffix) >= 1;
  if (third === 6) return mod11(value, [3, 2, 7, 6, 5, 4, 3, 2], 8) && Number(value.slice(9)) >= 1;
  return false;
}

export function isValidIdNumber(value: string): boolean {
  return isValidCedula(value) || isValidRuc(value);
}

/**
 * Celular ecuatoriano → formato internacional sin "+" (593 9XXXXXXXX), que es lo que
 * pide WhatsApp. Acepta 09XXXXXXXX, 9XXXXXXXX, +593 9XXXXXXXX. Devuelve null si no es válido.
 */
export function normalizeEcMobile(input: string): string | null {
  const d = input.replace(/[\s\-().+]/g, "");
  let national: string | null = null;
  if (/^09\d{8}$/.test(d)) national = d.slice(1);
  else if (/^9\d{8}$/.test(d)) national = d;
  else if (/^5939\d{8}$/.test(d)) national = d.slice(3);
  return national ? `593${national}` : null;
}

/** 593991234567 → 0991234567 (para mostrar al operador). */
export function displayPhone(e164: string): string {
  return e164.startsWith("593") ? `0${e164.slice(3)}` : e164;
}
