import type { ReactNode } from 'react';

interface OgCardProps {
  orgName: string;
  entityType: string;
  entityKey: string;
  children: ReactNode;
}

export function OgCard({
  orgName,
  entityType,
  entityKey,
  children,
}: OgCardProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        background:
          'linear-gradient(145deg, #0f0f14 0%, #1a1a2e 50%, #0f0f14 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800,
              color: 'white',
            }}
          >
            V
          </div>
          <span style={{ fontSize: 22, color: '#9ca3af', fontWeight: 500 }}>
            {orgName}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            backgroundColor: '#ffffff0d',
            border: '1px solid #ffffff1a',
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: '#6366f1',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {entityType}
          </span>
          {entityKey && (
            <span style={{ fontSize: 16, color: '#6b7280' }}>{entityKey}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
        {children}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 18, color: '#4b5563' }}>vector</span>
        <div
          style={{
            width: 200,
            height: 4,
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          }}
        />
      </div>
    </div>
  );
}
