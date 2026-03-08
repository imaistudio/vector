import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Avvvatars from 'avvvatars-react';

const cache = new Map<string, string>();

/**
 * Renders an Avvvatars shape for a given seed and returns it as a data URI.
 * Results are memoized since this may be called from renderHTML on every view update.
 */
export function getAvatarDataUri(seed: string, size = 20): string {
  const key = `${seed}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const fullMarkup = renderToStaticMarkup(
    createElement(Avvvatars, {
      value: seed,
      style: 'shape',
      size,
      radius: size,
    }),
  );

  // Avvvatars renders: <div color="BG_HEX" class="..."><span color="FG_HEX" ...><svg>...</svg></span></div>
  // Extract colors from the HTML attributes
  const bgMatch = fullMarkup.match(/^<div[^>]*\scolor="([^"]+)"/);
  const fgMatch = fullMarkup.match(/<span[^>]*\scolor="([^"]+)"/);
  const bgColor = bgMatch ? `#${bgMatch[1]}` : '#e8e8e8';
  const fgColor = fgMatch ? `#${fgMatch[1]}` : '#666';

  // Extract just the inner SVG content (paths, etc.)
  const svgInnerMatch = fullMarkup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const svgInner = svgInnerMatch ? svgInnerMatch[1] : '';

  // Build a self-contained SVG with circle background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bgColor}"/><g transform="scale(${size / 32})" fill="${fgColor}">${svgInner.replace(/currentColor/g, fgColor)}</g></svg>`;

  // encodeURIComponent doesn't encode ( ) which breaks CSS url() parsing
  const uri = `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
  cache.set(key, uri);
  return uri;
}
