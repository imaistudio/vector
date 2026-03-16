import { NextResponse } from 'next/server';

export function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';

  return NextResponse.json({ convexUrl });
}
