'use client';

import { useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';

export function useDocumentTitle(title: string | null | undefined) {
  const branding = useBranding();

  useEffect(() => {
    const trimmedTitle = title?.trim();
    const brandName = branding.name || 'Vector';
    if (!trimmedTitle) return;

    document.title =
      trimmedTitle === brandName ? brandName : `${trimmedTitle} · ${brandName}`;
  }, [branding.name, title]);
}
