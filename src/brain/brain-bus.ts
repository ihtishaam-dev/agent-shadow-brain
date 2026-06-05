// src/brain/brain-bus.ts — In-process realtime activity bus (v6.1.0)
//
// A single, dependency-free pub/sub singleton that every brain subsystem
// publishes "something happened" events to, and the dashboard (or any other
// consumer) subscribes to once. This is what makes the dashboard truly
// realtime: instead of polling /api/v6/activity-log every few seconds, the
// WebSocket layer forwards bus events to the browser the instant they fire.
//
// Design notes:
//  - Local-first + zero new deps: extends Node's EventEmitter, the same
//    pattern already used by the Orchestrator and other modules.
//  - Ring buffer (cap 500) so a late-connecting client can replay a backlog
//    and never see an empty feed on first paint.
//  - Dedup by event id: the same logical memory-write can be observed twice —
//    once in-process (global-brain emits on write) and once via the dashboard
//    file watcher (global.json changed on disk). Identical ids collapse to one.
//  - Callers build a composite id of the form `${type}:${nativeId}` so that
//    two different events about the same entity (e.g. seed-draft vs
//    seed-commit for one draft id) are NOT collapsed, while genuine duplicates
//    (same type + same entity) are.

import { EventEmitter } from 'events';

/** A single realtime activity event broadcast across the brain. */
export interface BrainActivityEvent {
  /** Stable, composite id used for dedup. Convention: `${type}:${nativeId}`. */
  id: string;
  /** Epoch milliseconds. Kept as a number for clean JSON over the wire. */
  ts: number;
  /** Event kind, e.g. 'memory-write' | 'dream' | 'seed-draft' | 'collision'. */
  type: string;
  /** Where it came from — an agent tool name, engine name, etc. */
  source: string;
  /** Short human-readable description (already truncated by the caller). */
  detail: string;
  /** Optional structured payload for richer UI rendering. */
  meta?: Record<string, unknown>;
}

const RING_CAP = 500;
const SEEN_CAP = 2000;

export class BrainBus extends EventEmitter {
  private static instance: BrainBus | null = null;
  private ring: BrainActivityEvent[] = [];
  private seen = new Set<string>();
  private seenOrder: string[] = [];

  private constructor() {
    super();
    // Many consumers may attach (dashboard + future listeners); avoid the
    // default 10-listener warning without leaking unbounded listeners.
    this.setMaxListeners(64);
  }

  static getInstance(): BrainBus {
    if (!BrainBus.instance) BrainBus.instance = new BrainBus();
    return BrainBus.instance;
  }

  /**
   * Publish an activity event. Returns true if it was broadcast, false if it
   * was suppressed as a duplicate (same id already seen recently).
   */
  publish(ev: Partial<BrainActivityEvent> & Pick<BrainActivityEvent, 'type' | 'source'>): boolean {
    const id = ev.id ?? `${ev.type}:${ev.source}:${Date.now()}:${Math.round(Math.random() * 1e9)}`;
    if (this.seen.has(id)) return false;

    const full: BrainActivityEvent = {
      id,
      ts: typeof ev.ts === 'number' ? ev.ts : Date.now(),
      type: ev.type,
      source: ev.source,
      detail: typeof ev.detail === 'string' ? ev.detail : '',
      meta: ev.meta,
    };

    // Track id for dedup, bounded FIFO.
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > SEEN_CAP) {
      const drop = this.seenOrder.splice(0, this.seenOrder.length - SEEN_CAP);
      for (const d of drop) this.seen.delete(d);
    }

    // Ring buffer, bounded.
    this.ring.push(full);
    if (this.ring.length > RING_CAP) this.ring.splice(0, this.ring.length - RING_CAP);

    this.emit('activity', full);
    return true;
  }

  /** Most recent events, newest first (matches the activity-log API ordering). */
  recent(limit = 50): BrainActivityEvent[] {
    const n = Math.max(1, Math.min(RING_CAP, limit));
    return this.ring.slice(-n).reverse();
  }

  /**
   * Subscribe to live activity. Returns an unsubscribe function so callers
   * (e.g. the dashboard server) can detach cleanly on shutdown.
   */
  subscribe(fn: (ev: BrainActivityEvent) => void): () => void {
    this.on('activity', fn);
    return () => { this.off('activity', fn); };
  }

  /** Test/maintenance helper — clears buffers and dedup state. */
  reset(): void {
    this.ring = [];
    this.seen.clear();
    this.seenOrder = [];
  }
}

export function getBrainBus(): BrainBus {
  return BrainBus.getInstance();
}
