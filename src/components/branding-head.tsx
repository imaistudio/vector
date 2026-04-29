'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useBranding } from '@/hooks/use-branding';

/**
 * Updates the document title and theme-color meta tag to reflect
 * the platform brand and current shadcn theme.
 * Rendered once in the root layout — no visible output.
 */
export function BrandingHead() {
  const branding = useBranding();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const brandName = branding.name || 'Vector';
    const currentTitle = document.title.trim();
    const genericTitles = new Set([
      '',
      'Vector',
      brandName,
      `Vector · ${brandName}`,
      `${brandName} · Vector`,
    ]);

    if (shouldUseFallbackTitle(pathname) || genericTitles.has(currentTitle)) {
      document.title = formatDocumentTitle(
        getFallbackPageTitle(pathname),
        brandName,
      );
    }
  }, [branding.name, pathname]);

  useEffect(() => {
    const color = getComputedStyle(document.body).backgroundColor;
    if (!color) return;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  // Switch favicon based on resolved theme (class-based, not prefers-color-scheme)
  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    const svgHref = isDark
      ? '/icons/vector-mark-gradient.svg'
      : '/icons/vector-mark-dark.svg';

    let link = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = svgHref;
  }, [resolvedTheme]);

  return null;
}

function formatSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatDocumentTitle(pageTitle: string, brandName: string) {
  return pageTitle === brandName ? brandName : `${pageTitle} · ${brandName}`;
}

function getFallbackPageTitle(pathname: string | null) {
  const segments = (pathname ?? '/').split('/').filter(Boolean);
  if (segments.length === 0) return 'Home';

  const [first, second, third, fourth] = segments;

  if (first === 'auth') {
    if (second === 'login') return 'Log in';
    if (second === 'signup') return 'Sign up';
    if (second === 'forgot-password') return 'Reset password';
    if (second === 'sign-out') return 'Signing out';
    return 'Authentication';
  }

  if (first === 'admin') {
    if (second === 'assistant') return 'Assistant settings';
    if (second === 'branding') return 'Branding';
    if (second === 'integrations') return 'Platform integrations';
    return 'Platform admin';
  }

  if (first === 'settings') {
    if (second === 'profile') return 'Profile settings';
    if (second === 'notifications') return 'Notification settings';
    if (second === 'devices') return 'Device settings';
    if (second === 'invites') return 'Invitations';
    return 'Settings';
  }

  if (first === 'device') return 'Device pairing';
  if (first === 'org-setup') return 'Create workspace';
  if (first === 'setup-admin') return 'Set up admin';
  if (first === '403') return 'Access denied';
  if (first === 'threads') return second ? 'Public thread' : 'Threads';

  if (!second) return formatSegment(first);

  if (second === 'issues') {
    if (third)
      return third === 'public' ? 'Public issue' : formatSegment(third);
    return 'Issues';
  }
  if (second === 'projects') {
    if (third)
      return third === 'public' || fourth === 'public'
        ? 'Public project'
        : formatSegment(third);
    return 'Projects';
  }
  if (second === 'teams') {
    if (third)
      return third === 'public' || fourth === 'public'
        ? 'Public team'
        : formatSegment(third);
    return 'Teams';
  }
  if (second === 'documents') {
    if (third === 'folders') return fourth ? formatSegment(fourth) : 'Folder';
    if (third) return fourth === 'public' ? 'Public document' : 'Document';
    return 'Documents';
  }
  if (second === 'views') {
    if (third) return fourth === 'public' ? 'Public view' : 'View';
    return 'Views';
  }
  if (second === 'threads') return third ? 'Thread' : 'Threads';
  if (second === 'dashboard') return 'Dashboard';
  if (second === 'settings') {
    if (third === 'integrations') {
      return fourth === 'github' ? 'GitHub integration' : 'Integrations';
    }
    return third ? `${formatSegment(third)} settings` : 'Workspace settings';
  }

  return formatSegment(second);
}

function shouldUseFallbackTitle(pathname: string | null) {
  const segments = (pathname ?? '/').split('/').filter(Boolean);
  const [first, second, third, fourth] = segments;

  if (segments.length === 0) return true;
  if (
    first === 'auth' ||
    first === 'admin' ||
    first === 'settings' ||
    first === 'device' ||
    first === 'org-setup' ||
    first === 'setup-admin' ||
    first === '403'
  ) {
    return true;
  }

  if (!second) return false;
  if (second === 'dashboard') return true;
  if (second === 'settings') return true;
  if (second === 'issues') return !third;
  if (second === 'projects') return !third;
  if (second === 'teams') return !third;
  if (second === 'documents') return !third || third === 'folders';
  if (second === 'views') return !third;
  if (second === 'threads') return !third;
  if (fourth === 'public') return false;

  return true;
}
