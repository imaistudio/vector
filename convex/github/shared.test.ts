import { describe, expect, it } from 'vitest';
import { extractIssueKeysFromText } from './shared';

describe('GitHub issue key extraction', () => {
  it('extracts issue keys with hyphenated and alphanumeric prefixes', () => {
    expect(
      extractIssueKeysFromText(
        'Fix RARE-RABBIT-2 in the PR title',
        'also references api2-17 in the body',
        'feature/rare-rabbit-2-follow-up',
      ),
    ).toEqual(['RARE-RABBIT-2', 'API2-17']);
  });

  it('keeps simple issue keys working', () => {
    expect(extractIssueKeysFromText('Closes eng-123')).toEqual(['ENG-123']);
  });
});
