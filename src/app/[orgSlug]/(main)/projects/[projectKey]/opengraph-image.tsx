import { ImageResponse } from 'next/og';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import { OgCard } from '@/components/og/og-card';

export const runtime = 'nodejs';
export const alt = 'Project preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ProjectData {
  key: string;
  name: string;
  description: string | null;
  orgName: string;
  orgSlug: string;
  status: { name: string; color?: string; type: string } | null;
  issueCount: number;
}

function ProjectOgImage({ data }: { data: ProjectData }) {
  const statusColor = data.status?.color ?? '#6b7280';

  return (
    <OgCard orgName={data.orgName} entityType='Project' entityKey={data.key}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: '#f9fafb',
            lineHeight: 1.2,
            display: 'flex',
          }}
        >
          {data.name}
        </div>
        {data.description && (
          <div
            style={{
              fontSize: 22,
              color: '#9ca3af',
              lineHeight: 1.4,
              display: 'flex',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data.description.slice(0, 200)}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {data.status && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: `${statusColor}22`,
                border: `1px solid ${statusColor}44`,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                }}
              />
              <span style={{ fontSize: 20, color: '#d1d5db' }}>
                {data.status.name}
              </span>
            </div>
          )}
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
              {data.issueCount} issue{data.issueCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </OgCard>
  );
}

function NotFoundImage() {
  return (
    <OgCard orgName='Vector' entityType='Project' entityKey=''>
      <div style={{ fontSize: 44, fontWeight: 700, color: '#6b7280' }}>
        Project not found
      </div>
    </OgCard>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ orgSlug: string; projectKey: string }>;
}) {
  const { orgSlug, projectKey } = await params;

  let data: ProjectData | null = null;
  try {
    const client = getConvexClient();
    data = await client.query(api.og.queries.getPublicProject, {
      orgSlug,
      projectKey,
    });
  } catch {
    // fall through to not-found
  }

  return new ImageResponse(
    data ? <ProjectOgImage data={data} /> : <NotFoundImage />,
    { ...size },
  );
}
