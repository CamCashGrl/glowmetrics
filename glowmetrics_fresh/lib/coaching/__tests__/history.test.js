import { describe, it, expect } from 'vitest';
import { shapeHistoryEvent, sortByShownAtDesc, dedupeById } from '../history';

describe('shapeHistoryEvent', () => {
  it('returns null for null input', () => {
    expect(shapeHistoryEvent(null)).toBeNull();
  });

  it('maps only the public fields, never leaking internal/session columns', () => {
    const row = {
      id: 'evt-1', session_id: 'sess-1', user_id: 'user-1',
      type: 'dead_air_high', category: 'room_recovery', priority: 2, dedupe_key: 'dk-1',
      title: 'Room Has Gone Quiet', message: 'Try greeting recent viewers.',
      compact_message: 'Room quiet', shown_at: '2026-07-29T10:00:00Z',
      expires_at: '2026-07-29T10:10:00Z', dismissed_at: null,
      action_status: 'unmarked', action_responded_at: null,
      related_tipper_id: null, related_tipper_name: null, related_amount_usd: null,
    };
    const shaped = shapeHistoryEvent(row);
    expect(shaped).not.toHaveProperty('session_id');
    expect(shaped).not.toHaveProperty('user_id');
    expect(shaped).not.toHaveProperty('dedupe_key');
    expect(shaped.id).toBe('evt-1');
    expect(shaped.title).toBe('Room Has Gone Quiet');
    expect(shaped.action_status).toBe('unmarked');
  });
});

describe('sortByShownAtDesc', () => {
  it('orders newest prompt first', () => {
    const events = [
      { id: 'a', shown_at: '2026-07-29T09:42:00Z' }, // 18 min ago
      { id: 'b', shown_at: '2026-07-29T09:53:00Z' }, // 7 min ago
      { id: 'c', shown_at: '2026-07-29T09:59:00Z' }, // 1 min ago
    ];
    const sorted = sortByShownAtDesc(events);
    expect(sorted.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input array', () => {
    const events = [{ id: 'a', shown_at: '2026-01-01T00:00:00Z' }, { id: 'b', shown_at: '2026-01-02T00:00:00Z' }];
    const original = [...events];
    sortByShownAtDesc(events);
    expect(events).toEqual(original);
  });
});

describe('dedupeById', () => {
  it('drops duplicate ids, keeping the first occurrence', () => {
    const events = [{ id: '1', v: 'first' }, { id: '2', v: 'only' }, { id: '1', v: 'second' }];
    const result = dedupeById(events);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === '1').v).toBe('first');
  });
});
