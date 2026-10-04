import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };

export default function CartPage() {
  return (<><h1 className="mb-3 text-2xl font-extrabold">Tu carrito</h1><CartView /></>);
}
