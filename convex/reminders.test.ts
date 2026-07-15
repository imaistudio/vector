import { describe, expect, it } from 'vitest';
import type { Doc } from './_generated/dataModel';
import { nextFutureOccurrence, nextOccurrence } from './reminders';

function rule(cadence: Doc<'reminderRules'>['cadence']): Doc<'reminderRules'> {
  return {
    _id: 'reminder' as Doc<'reminderRules'>['_id'],
    _creationTime: 0,
    organizationId: 'organization' as Doc<'reminderRules'>['organizationId'],
    targetType: 'work',
    recipientPolicies: ['work_owner'],
    cadence,
    localTime: '09:00',
    timezone: 'America/New_York',
    enabled: true,
    nextFireAt: 0,
    createdBy: 'user' as Doc<'reminderRules'>['createdBy'],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('reminder recurrence', () => {
  it('keeps the configured local time across a daylight-saving transition', () => {
    const saturdayAtNine = Date.parse('2026-03-07T14:00:00.000Z');
    const sundayAtNine = nextOccurrence(rule('daily'), saturdayAtNine);

    expect(sundayAtNine).toBe(Date.parse('2026-03-08T13:00:00.000Z'));
    expect(sundayAtNine! - saturdayAtNine).toBe(23 * 60 * 60 * 1000);
  });

  it('skips weekends using the reminder timezone', () => {
    const fridayAtNine = Date.parse('2026-03-06T14:00:00.000Z');

    expect(nextOccurrence(rule('weekdays'), fridayAtNine)).toBe(
      Date.parse('2026-03-09T13:00:00.000Z'),
    );
  });

  it('advances past every stale occurrence after downtime', () => {
    const scheduled = Date.parse('2026-03-01T14:00:00.000Z');
    const now = Date.parse('2026-03-05T16:00:00.000Z');

    expect(nextFutureOccurrence(rule('daily'), scheduled, now)).toBe(
      Date.parse('2026-03-06T14:00:00.000Z'),
    );
  });
});
