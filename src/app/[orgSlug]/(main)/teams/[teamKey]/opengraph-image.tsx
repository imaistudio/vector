import { ImageResponse } from 'next/og';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import { OgCard } from '@/components/og/og-card';

export const runtime = 'nodejs';
export const alt = 'Team preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface TeamData {
  key: string;
  name: string;
  description: string | null;
  orgName: string;
  orgSlug: string;
  icon: string | null;
  color: string | null;
  memberCount: number;
}

function TeamOgImage({ data }: { data: TeamData }) {
  const teamColor = data.color ?? '#6366f1';

  return (
    <OgCard orgName={data.orgName} entityType='Team' entityKey={data.key}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '12px',
              backgroundColor: `${teamColor}33`,
              border: `2px solid ${teamColor}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: teamColor,
            }}
          >
            {data.name.charAt(0).toUpperCase()}
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
            {data.name}
          </div>
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
              {data.memberCount} member{data.memberCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </OgCard>
  );
}

function NotFoundImage() {
  return (
    <OgCard orgName='Vector' entityType='Team' entityKey=''>
      <div style={{ fontSize: 44, fontWeight: 700, color: '#6b7280' }}>
        Team not found
      </div>
    </OgCard>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ orgSlug: string; teamKey: string }>;
}) {
  const { orgSlug, teamKey } = await params;

  let data: TeamData | null = null;
  try {
    const client = getConvexClient();
    data = await client.query(api.og.queries.getPublicTeam, {
      orgSlug,
      teamKey,
    });
  } catch {
    // fall through to not-found
  }

  return new ImageResponse(
    data ? <TeamOgImage data={data} /> : <NotFoundImage />,
    { ...size },
  );
}
