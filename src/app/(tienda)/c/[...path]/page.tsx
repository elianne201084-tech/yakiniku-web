import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryByPath } from "@/modules/catalog";
import { Listing } from "@/components/listing";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const data = await getCategoryByPath(path.map(decodeURIComponent).join("/"));
  return data ? { title: data.cat.name, description: `Compra ${data.cat.name} con envío a todo el Ecuador y pago contra entrega.` } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { path } = await params;
  const joined = path.map(decodeURIComponent).join("/");
  const data = await getCategoryByPath(joined);
  if (!data) notFound();
  const { cat, crumbs } = data;
  return (
    <>
      <nav aria-label="Ruta" className="mb-2 text-sm text-ink-soft">
        <Link href="/" className="underline">Inicio</Link>
        {crumbs.map((c) => (<span key={c.path}> / <Link href={`/c/${c.path}`} className="underline">{c.name}</Link></span>))}
      </nav>
      <h1 className="text-2xl font-extrabold">{cat.name}</h1>
      {cat.children.length > 0 && (
        <ul className="my-3 flex gap-2 overflow-x-auto pb-1">
          {cat.children.map((s) => (
            <li key={s.id} className="shrink-0"><Link href={`/c/${s.path}`} className="btn btn-ghost !min-h-10 whitespace-nowrap text-sm">{s.name}</Link></li>
          ))}
        </ul>
      )}
      <div className="mt-3"><Listing sp={await searchParams} categoryPath={cat.path} basePath={`/c/${cat.path}`} /></div>
    </>
  );
}
