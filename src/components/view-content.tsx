"use client";
import { useEffect } from "react";
import { track } from "./pixels";

export function ViewContent({ productId, value }: { productId: string; value: number }) {
  useEffect(() => { track("ViewContent", { content_ids: [productId], value, currency: "USD" }); }, [productId, value]);
  return null;
}
