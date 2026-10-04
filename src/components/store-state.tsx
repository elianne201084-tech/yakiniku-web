"use client";
/**
 * Carrito y lista de deseos del cliente. Se guardan en el navegador (localStorage):
 * no hace falta cuenta y no se guardan datos personales. El servidor vuelve a validar
 * precios y stock al cotizar y al confirmar, así que nada de aquí es de confianza.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = { variantId: string; qty: number };
const CART_KEY = "chasqui_cart_v1";
const WISH_KEY = "chasqui_wish_v1";
export const MAX_QTY = 10;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado: se ignora */ }
}

type Ctx = {
  ready: boolean;
  items: CartItem[];
  count: number;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  wish: string[];
  toggleWish: (productId: string) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(read<CartItem[]>(CART_KEY, []).filter((i) => i && typeof i.variantId === "string" && i.qty > 0));
    setWish(read<string[]>(WISH_KEY, []));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setItems(read(CART_KEY, []));
      if (e.key === WISH_KEY) setWish(read(WISH_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveItems = useCallback((next: CartItem[]) => { setItems(next); write(CART_KEY, next); }, []);

  const value = useMemo<Ctx>(() => ({
    ready,
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    add: (variantId, qty = 1) => {
      const cur = read<CartItem[]>(CART_KEY, []);
      const found = cur.find((i) => i.variantId === variantId);
      if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
      else cur.push({ variantId, qty: Math.min(MAX_QTY, qty) });
      saveItems(cur);
    },
    setQty: (variantId, qty) => saveItems(items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))),
    remove: (variantId) => saveItems(items.filter((i) => i.variantId !== variantId)),
    clear: () => saveItems([]),
    wish,
    toggleWish: (id) => {
      const next = wish.includes(id) ? wish.filter((w) => w !== id) : [...wish, id];
      setWish(next);
      write(WISH_KEY, next);
    },
  }), [ready, items, wish, saveItems]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return c;
}
