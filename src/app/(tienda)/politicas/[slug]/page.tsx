import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, PENDING } from "@/lib/settings";

const PAGES = {
  devoluciones: { title: "Política de devoluciones", key: "returns" },
  garantia: { title: "Garantía", key: "warranty" },
  privacidad: { title: "Aviso de privacidad", key: "privacy" },
  terminos: { title: "Términos y condiciones", key: "terms" },
} as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = PAGES[(await params).slug as keyof typeof PAGES];
  return p ? { title: p.title } : {};
}

export default async function PolicyPage({ params }: Props) {
  const page = PAGES[(await params).slug as keyof typeof PAGES];
  if (!page) notFound();
  const s = await getSettings();
  const text = s.policies[page.key];
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mb-3 text-2xl font-extrabold">{page.title}</h1>
      <div className="card whitespace-pre-line p-4 text-sm leading-relaxed">{text}</div>
      <section className="mt-4 text-sm text-ink-soft">
        <p><b>{s.company.legalName}</b> · RUC {s.company.ruc}</p>
        <p>{s.company.address} · {s.company.phone} · {s.company.email}</p>
        {(text.includes(PENDING) || s.company.ruc === PENDING) && <p className="mt-2 font-semibold text-brand-700">Texto provisional: completa los datos en el panel (Configuración) antes de publicar.</p>}
      </section>
    </article>
  );
}
