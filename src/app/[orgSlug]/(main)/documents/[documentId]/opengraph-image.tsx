import { ImageResponse } from 'next/og';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import { OgCard } from '@/components/og/og-card';

export const runtime = 'nodejs';
export const alt = 'Document preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface DocumentData {
  title: string;
  orgName: string;
  orgSlug: string;
  icon: string | null;
  color: string | null;
  author: { name: string | undefined } | null;
}

function DocumentOgImage({ data }: { data: DocumentData }) {
  const docColor = data.color ?? '#6366f1';

  return (
    <OgCard orgName={data.orgName} entityType='Document' entityKey=''>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '12px',
              backgroundColor: `${docColor}33`,
              border: `2px solid ${docColor}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: docColor,
            }}
          >
            D
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#f9fafb',
              lineHeight: 1.2,
              display: 'flex',
            }}
          >
            {data.title}
          </div>
        </div>
        {data.author && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff11',
                border: '1px solid #ffffff22',
              }}
            >
              <span style={{ fontSize: 20, color: '#9ca3af' }}>
                by {data.author.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </OgCard>
  );
}

function NotFoundImage() {
  return (
    <OgCard orgName='Vector' entityType='Document' entityKey=''>
      <div style={{ fontSize: 44, fontWeight: 700, color: '#6b7280' }}>
        Document not found
      </div>
    </OgCard>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ orgSlug: string; documentId: string }>;
}) {
  const { orgSlug, documentId } = await params;

  let data: DocumentData | null = null;
  try {
    const client = getConvexClient();
    data = await client.query(api.og.queries.getPublicDocument, {
      orgSlug,
      documentId,
    });
  } catch {
    // fall through to not-found
  }

  return new ImageResponse(
    data ? <DocumentOgImage data={data} /> : <NotFoundImage />,
    { ...size },
  );
}
