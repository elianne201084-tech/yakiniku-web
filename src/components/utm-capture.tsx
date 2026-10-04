"use client";
import { useEffect } from "react";

/** Guarda los parámetros UTM de la visita (canal de captación) para adjuntarlos al pedido. */
export function UtmCapture() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const found: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "ttclid"]) {
        const v = p.get(k);
        if (v) found[k] = v.slice(0, 100);
      }
      if (Object.keys(found).length) sessionStorage.setItem("chasqui_utm", JSON.stringify(found));
    } catch { /* ignorar */ }
  }, []);
  return null;
}
