'use client';

import { useEffect } from 'react';
import { registerNotificationServiceWorker } from '@/lib/notifications';

export function NotificationClientBootstrap() {
  useEffect(() => {
    void registerNotificationServiceWorker().catch(() => {
      // Registration is best-effort until the user explicitly opts into push.
    });
  }, []);

  return null;
}
