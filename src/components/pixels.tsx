"use client";
/**
 * Consentimiento de cookies y píxeles de Meta/TikTok.
 * Los píxeles NO se cargan hasta que la persona acepta (LOPDP). Los IDs se configuran
 * en el panel (Configuración) y se validan antes de insertarse en la página.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "chasqui_consent_v1";
const ID_RE = /^[A-Za-z0-9]{5,32}$/;

type W = Window & { fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } };

/** Dispara un evento de conversión si el píxel está cargado (es inocuo si no lo está). */
export function track(event: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase", data: Record<string, unknown> = {}) {
  const w = window as W;
  try {
    w.fbq?.("track", event, data);
    const ttEvent = { ViewContent: "ViewContent", AddToCart: "AddToCart", InitiateCheckout: "InitiateCheckout", Purchase: "CompletePayment" }[event];
    w.ttq?.track(ttEvent, data);
  } catch { /* nunca romper la tienda por un píxel */ }
}

function loadMeta(id: string) {
  if ((window as W).fbq) return;
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any) {
    const n: any = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    const t = b.createElement(e); t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  (window as W).fbq!("init", id);
  (window as W).fbq!("track", "PageView");
}

function loadTikTok(id: string) {
  if ((window as W).ttq) return;
  /* eslint-disable */
  (function (w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t;
    const ttq = (w[t] = w[t] || []);
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function (t: any, e: any) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (e: any) {
      const u = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = u; ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      const o = d.createElement("script"); o.type = "text/javascript"; o.async = true; o.src = u + "?sdkid=" + e + "&lib=" + t;
      const a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a);
    };
    ttq.load(id); ttq.page();
  })(window, document, "ttq");
  /* eslint-enable */
}

export function ConsentAndPixels({ metaPixelId, tiktokPixelId }: { metaPixelId: string; tiktokPixelId: string }) {
  const [choice, setChoice] = useState<"yes" | "no" | null | undefined>(undefined);
  const hasPixels = ID_RE.test(metaPixelId) || ID_RE.test(tiktokPixelId);

  useEffect(() => {
    try { setChoice((localStorage.getItem(KEY) as "yes" | "no" | null) ?? null); } catch { setChoice(null); }
  }, []);

  useEffect(() => {
    if (choice !== "yes") return;
    if (ID_RE.test(metaPixelId)) loadMeta(metaPixelId);
    if (ID_RE.test(tiktokPixelId)) loadTikTok(tiktokPixelId);
  }, [choice, metaPixelId, tiktokPixelId]);

  if (!hasPixels || choice !== null) return null; // sin píxeles configurados no hay nada que consentir

  const save = (v: "yes" | "no") => { try { localStorage.setItem(KEY, v); } catch { /* ignorar */ } setChoice(v); };
  return (
    <div role="dialog" aria-label="Preferencias de cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white p-4 shadow-2xl">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm">
          Usamos cookies de medición y publicidad (Meta y TikTok) para mejorar tu experiencia y medir nuestras campañas.
          Solo se activan si aceptas. <Link href="/politicas/privacidad" className="underline">Aviso de privacidad</Link>.
        </p>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => save("no")}>Rechazar</button>
          <button className="btn btn-primary" onClick={() => save("yes")}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}
