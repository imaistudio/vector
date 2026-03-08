import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vector',
    short_name: 'Vector',
    description: 'Project management platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#111827',
    icons: [
      {
        src: '/icons/vector-app-icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/icons/vector-app-maskable.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
    ],
  };
}
