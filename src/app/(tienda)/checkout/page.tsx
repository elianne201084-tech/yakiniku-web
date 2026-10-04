import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  const [provinces, settings] = await Promise.all([prisma.province.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }), getSettings()]);
  return (
    <>
      <h1 className="mb-3 text-2xl font-extrabold">Finalizar compra</h1>
      <CheckoutForm provinces={provinces} freeShippingOverCents={settings.freeShippingOverCents} />
    </>
  );
}
