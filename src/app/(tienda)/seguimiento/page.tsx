import type { Metadata } from "next";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Seguir mi pedido" };

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-extrabold">Seguir mi pedido</h1>
      <p className="mb-4 text-sm text-ink-soft">Ingresa tu número de pedido y los últimos 4 dígitos del celular con el que compraste.</p>
      <TrackForm />
    </div>
  );
}
