import type { Metadata } from "next";
import { Listing } from "@/components/listing";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "Buscar", robots: { index: false } };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  return (
    <>
      <h1 className="mb-3 text-2xl font-extrabold">{q ? <>Resultados para “{q.slice(0, 80)}”</> : "Todos los productos"}</h1>
      <Listing sp={sp} basePath="/buscar" />
    </>
  );
}
