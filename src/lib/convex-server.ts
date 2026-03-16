import { ConvexHttpClient } from 'convex/browser';

let _client: ConvexHttpClient | null = null;

export function getConvexClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    _client = new ConvexHttpClient(url);
  }
  return _client;
}
