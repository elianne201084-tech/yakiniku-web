import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/cron-auth";
import { suspendNonCompliant } from "@/modules/products";

export const maxDuration = 300;

/** Diario: despublica productos cuyo documento de respaldo venció (o que dejaron de cumplir). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const r = await suspendNonCompliant();
  if (r.suspended.length) revalidateTag("products", "max");
  return NextResponse.json(r);
}
