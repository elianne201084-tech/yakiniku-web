import type { Metadata } from "next";
import { WishlistView } from "./wishlist-view";

export const metadata: Metadata = { title: "Lista de deseos", robots: { index: false } };

export default function WishlistPage() {
  return (<><h1 className="mb-3 text-2xl font-extrabold">Lista de deseos</h1><WishlistView /></>);
}
