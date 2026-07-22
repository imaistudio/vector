export type MentionRef = {
  mentionType: 'user' | 'team' | 'project' | 'issue' | 'document';
  rawRef: string;
};

const HREF_RE = /href="([^"]+)"/g;

const MENTION_PATTERNS: {
  type: MentionRef['mentionType'];
  pattern: RegExp;
}[] = [
  { type: 'user', pattern: /\/[^/]+\/people\/([^#/?]+)/ },
  { type: 'team', pattern: /\/[^/]+\/teams\/([A-Z][A-Z0-9_-]*)(?:#|$)/ },
  {
    type: 'project',
    pattern: /\/[^/]+\/projects\/([A-Z][A-Z0-9_-]*)(?:#|$)/,
  },
  { type: 'issue', pattern: /\/[^/]+\/issues\/([A-Z]+-\d+)/ },
  { type: 'document', pattern: /\/[^/]+\/documents\/([^#/?]+)/ },
];

export function extractMentions(content: string): MentionRef[] {
  const seen = new Set<string>();
  const refs: MentionRef[] = [];

  for (const match of content.matchAll(HREF_RE)) {
    const href = match[1];
    for (const { type, pattern } of MENTION_PATTERNS) {
      const mention = href.match(pattern);
      if (!mention) continue;
      const key = `${type}:${mention[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ mentionType: type, rawRef: mention[1] });
      }
      break;
    }
  }

  return refs;
}
