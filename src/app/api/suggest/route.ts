import { NextResponse } from "next/server";
import { suggest } from "@/modules/catalog";
import { allow } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await allow(`suggest:${ip}`, 120, 60))) return NextResponse.json({ products: [], categories: [] }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const data = await suggest(q.slice(0, 80));
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
