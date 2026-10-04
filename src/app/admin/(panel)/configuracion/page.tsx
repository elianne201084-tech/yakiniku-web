import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "../../actions";
import { Flash, type PanelSP } from "../../ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<PanelSP> }) {
  await requireRole("ADMIN");
  const s = await getSettings();
  const sp = await searchParams;
  const T = ({ name, label, value, type = "text", hint }: { name: string; label: string; value: string | number; type?: string; hint?: string }) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={value} className="field" />{hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}</div>
  );
  const A = ({ name, label, value }: { name: string; label: string; value: string }) => (
    <div className="sm:col-span-2"><label className="label" htmlFor={name}>{label}</label><textarea id={name} name={name} rows={6} defaultValue={value} className="field" /></div>
  );
  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">Configuración</h1>
      <p className="mb-4 text-sm text-ink-soft">Datos de la empresa, impuestos, píxeles y textos legales.</p>
      <Flash {...sp} />
      <form action={saveSettingsAction} className="card grid gap-4 p-4 sm:grid-cols-2">
        <T name="storeName" label="Nombre de la tienda" value={s.storeName} /><T name="tagline" label="Eslogan" value={s.tagline} />
        <h2 className="text-lg font-extrabold sm:col-span-2">Empresa</h2>
        <T name="legalName" label="Razón social" value={s.company.legalName} /><T name="ruc" label="RUC" value={s.company.ruc} />
        <T name="address" label="Dirección" value={s.company.address} /><T name="phone" label="Teléfono" value={s.company.phone} />
        <T name="email" label="Correo de contacto" type="email" value={s.company.email === "[POR COMPLETAR]" ? "" : s.company.email} />
        <T name="whatsapp" label="WhatsApp de la tienda" value={s.company.whatsapp} hint="Formato internacional sin +, ej.: 593991234567. Activa los botones de WhatsApp." />
        <h2 className="text-lg font-extrabold sm:col-span-2">Precios y envío</h2>
        <T name="ivaPercent" label="IVA (%)" value={s.ivaPercent} hint="Confirma la tarifa vigente con tu contador. Los precios publicados incluyen IVA." />
        <T name="freeShipping" label="Envío gratis desde (USD, vacío = desactivado)" value={s.freeShippingOverCents ? (s.freeShippingOverCents / 100).toFixed(2) : ""} />
        <h2 className="text-lg font-extrabold sm:col-span-2">Píxeles (se activan solo con consentimiento)</h2>
        <T name="metaPixelId" label="ID del píxel de Meta" value={s.pixels.metaPixelId} /><T name="tiktokPixelId" label="ID del píxel de TikTok" value={s.pixels.tiktokPixelId} />
        <h2 className="text-lg font-extrabold sm:col-span-2">Textos legales</h2>
        <p className="text-xs text-ink-soft sm:col-span-2">Versión actual del aviso de privacidad: <b>{s.consentVersion}</b>. Cambia automáticamente cuando editas el aviso. Haz revisar estos textos por un abogado.</p>
        <A name="policy_returns" label="Devoluciones" value={s.policies.returns} /><A name="policy_warranty" label="Garantía" value={s.policies.warranty} />
        <A name="policy_privacy" label="Aviso de privacidad" value={s.policies.privacy} /><A name="policy_terms" label="Términos y condiciones" value={s.policies.terms} />
        <div className="sm:col-span-2"><button className="btn btn-primary">Guardar configuración</button></div>
      </form>
    </>
  );
}
