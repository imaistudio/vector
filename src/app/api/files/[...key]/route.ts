import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';

interface Params {
  key: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { key: keyArr } = await params;
    const storageId = keyArr.join('/');

    // Create Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Get the file URL from Convex
    const fileUrl = await convex.query(api.organizations.getFileUrlByString, {
      storageIdString: storageId,
    });

    if (!fileUrl) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Redirect to the Convex file URL
    return NextResponse.redirect(fileUrl);
  } catch (err) {
    console.error('File proxy error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
