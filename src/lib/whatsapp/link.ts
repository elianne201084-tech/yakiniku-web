/** Enlace wa.me con mensaje prellenado. `number` en formato internacional (593...). */
export function waLink(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
