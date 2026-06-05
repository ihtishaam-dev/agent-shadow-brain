import { beforeEach, describe, expect, it } from 'vitest';
import { getBrainBus, BrainActivityEvent } from '../../src/brain/brain-bus.js';

describe('brain bus (realtime activity)', () => {
  beforeEach(() => {
    getBrainBus().reset();
  });

  it('delivers a published event to subscribers', () => {
    const bus = getBrainBus();
    const received: BrainActivityEvent[] = [];
    const unsub = bus.subscribe(ev => received.push(ev));

    const ok = bus.publish({ id: 'memory-write:a1', type: 'memory-write', source: 'codex', detail: 'wrote a lesson' });

    expect(ok).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('memory-write');
    expect(received[0].source).toBe('codex');
    expect(typeof received[0].ts).toBe('number');
    unsub();
  });

  it('suppresses duplicate events with the same id', () => {
    const bus = getBrainBus();
    const received: BrainActivityEvent[] = [];
    bus.subscribe(ev => received.push(ev));

    const first = bus.publish({ id: 'dream:d1', type: 'dream', source: 'dream-engine', detail: 'first' });
    const second = bus.publish({ id: 'dream:d1', type: 'dream', source: 'dream-engine', detail: 'duplicate' });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(received).toHaveLength(1);
    expect(bus.recent(10)).toHaveLength(1);
  });

  it('treats distinct ids about the same entity as separate events', () => {
    const bus = getBrainBus();
    const draft = bus.publish({ id: 'seed-draft:s1', type: 'seed-draft', source: 'seed:codex', detail: 'drafted' });
    const commit = bus.publish({ id: 'seed-commit:s1', type: 'seed-commit', source: 'seed:codex', detail: 'committed' });

    expect(draft).toBe(true);
    expect(commit).toBe(true);
    expect(bus.recent(10)).toHaveLength(2);
  });

  it('caps the ring buffer at 500 entries', () => {
    const bus = getBrainBus();
    for (let i = 0; i < 600; i++) {
      bus.publish({ id: `memory-write:${i}`, type: 'memory-write', source: 'codex', detail: `entry ${i}` });
    }
    const recent = bus.recent(1000);
    expect(recent.length).toBe(500);
    // The oldest 100 should have been dropped; newest is entry 599.
    expect(recent[0].detail).toBe('entry 599');
    expect(recent.some(e => e.detail === 'entry 99')).toBe(false);
    expect(recent.some(e => e.detail === 'entry 100')).toBe(true);
  });

  it('returns recent events newest-first and respects the limit', () => {
    const bus = getBrainBus();
    bus.publish({ id: 'a:1', type: 'memory-write', source: 'codex', detail: 'oldest' });
    bus.publish({ id: 'a:2', type: 'memory-write', source: 'codex', detail: 'middle' });
    bus.publish({ id: 'a:3', type: 'memory-write', source: 'codex', detail: 'newest' });

    const recent = bus.recent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].detail).toBe('newest');
    expect(recent[1].detail).toBe('middle');
  });

  it('stops delivering after unsubscribe', () => {
    const bus = getBrainBus();
    const received: BrainActivityEvent[] = [];
    const unsub = bus.subscribe(ev => received.push(ev));

    bus.publish({ id: 'x:1', type: 'memory-write', source: 'codex', detail: 'before' });
    unsub();
    bus.publish({ id: 'x:2', type: 'memory-write', source: 'codex', detail: 'after' });

    expect(received).toHaveLength(1);
    expect(received[0].detail).toBe('before');
  });

  it('fills in id and ts when the caller omits them', () => {
    const bus = getBrainBus();
    const received: BrainActivityEvent[] = [];
    bus.subscribe(ev => received.push(ev));

    const ok = bus.publish({ type: 'collision', source: 'claude-code' });

    expect(ok).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].id).toBeTruthy();
    expect(typeof received[0].ts).toBe('number');
    expect(received[0].detail).toBe('');
  });
});
