export const SOCIAL_LINK_PLATFORMS = [
  'website',
  'github',
  'x',
  'linkedin',
  'youtube',
  'instagram',
] as const;

export type SocialLinkPlatform = (typeof SOCIAL_LINK_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialLinkPlatform;
  url: string;
}

export const SOCIAL_LINK_LABELS: Record<SocialLinkPlatform, string> = {
  website: 'Website',
  github: 'GitHub',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
};

const URL_WITH_PROTOCOL_PATTERN = /^https?:\/\//i;

export function normalizeSocialLinkUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = URL_WITH_PROTOCOL_PATTERN.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
