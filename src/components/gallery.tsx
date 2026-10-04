"use client";
import { useState } from "react";
import { ProductImage } from "./ui";

export function Gallery({ images, title }: { images: { url: string; alt: string }[]; title: string }) {
  const [i, setI] = useState(0);
  const list = images.length ? images : [{ url: "", alt: title }];
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-white">
        <ProductImage src={list[i].url || null} alt={list[i].alt || title} sizes="(min-width:1024px) 45vw, 100vw" priority />
      </div>
      {list.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Fotos del producto">
          {list.map((im, k) => (
            <li key={k} className="shrink-0">
              <button type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i}
                className={`relative block size-16 overflow-hidden rounded-lg border-2 ${k === i ? "border-ink" : "border-line"}`}>
                <ProductImage src={im.url} alt="" sizes="64px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
