import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDynamicIcon } from '@/lib/dynamic-icons';

const cache = new Map<string, string>();

/**
 * Renders a Lucide icon as an SVG data URI for use in CSS background-image.
 * Results are memoized since this is called from renderHTML.
 */
export function getLucideIconDataUri(iconName: string, color = '#666'): string {
  const key = `${iconName}:${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const IconComponent = getDynamicIcon(iconName);
  if (!IconComponent) return '';

  const markup = renderToStaticMarkup(
    createElement(IconComponent, {
      size: 14,
      color,
      strokeWidth: 2,
    }),
  );

  const uri = `data:image/svg+xml,${encodeURIComponent(markup)}`;
  cache.set(key, uri);
  return uri;
}
