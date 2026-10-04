"use client";
import { useEffect } from "react";
import { useStore } from "./store-state";
import { track } from "./pixels";

/** Vacía el carrito y dispara la conversión una sola vez al llegar a la confirmación de un pedido nuevo. */
export function OrderPlaced({ value, orderNumber }: { value: number; orderNumber: string }) {
  const { clear, ready } = useStore();
  useEffect(() => {
    if (!ready) return;
    try {
      const k = `chasqui_purchase_${orderNumber}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* ignorar */ }
    clear();
    track("Purchase", { value, currency: "USD" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
