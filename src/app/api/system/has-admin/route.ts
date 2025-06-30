import { NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  const rows = await db.select({ cnt: count() }).from(user);
  const hasAdmin = Number(rows[0]?.cnt ?? 0) > 0;
  return NextResponse.json({ hasAdmin });
}
