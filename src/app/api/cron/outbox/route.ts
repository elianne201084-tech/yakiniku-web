import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { processOutbox } from "@/modules/notifications";

export const maxDuration = 60;

/** Reintenta los mensajes de WhatsApp pendientes. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  return NextResponse.json(await processOutbox(100));
}
