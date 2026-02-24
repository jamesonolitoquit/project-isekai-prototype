import crypto from 'crypto';
import {
  appendEvent,
  canonicalize,
  clearEventLog,
  getEventsForWorld,
  HASH_PREFIX,
  HASH_VERSION,
  truncateEventsForWorld,
  __getInternalEventLog,
} from '../events/mutationLog';

describe('mutationLog invariants', () => {
  beforeEach(() => {
    clearEventLog();
  });

  test('monotonic timestamp enforcement and equal-timestamp allowed', () => {
    const world = 'w-ts';
    // append with explicit timestamp
    appendEvent({ id: 'a', worldInstanceId: world, actorId: 'x', type: 'T', payload: { v: 1 }, timestamp: 1000 });
    // equal timestamp is allowed
    appendEvent({ id: 'b', worldInstanceId: world, actorId: 'x', type: 'T', payload: { v: 2 }, timestamp: 1000 });
    // earlier timestamp must throw
    expect(() => {
      appendEvent({ id: 'c', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 999 });
    }).toThrow(/Non-monotonic timestamp/);
  });

  test('index continuity and duplicate detection', () => {
    const world = 'w-idx';
    appendEvent({ id: 'e1', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 1 });
    appendEvent({ id: 'e2', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 2 });

    // Duplicate index: simulate tamper by directly pushing an event with same index
    const internal = __getInternalEventLog();
    // Insert a tamper entry *before* the last real event so the next append will compute index=3 and detect duplicate
    internal.splice(1, 0, { id: 'tamper', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 3, eventIndex: 3, prevHash: '', hash: 'bad' } as any);
    expect(() => {
      appendEvent({ id: 'e3', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 4 });
    }).toThrow(/Duplicate eventIndex detected/);

    // Now test contiguity (gap detection) when NODE_ENV=development
    clearEventLog();
    appendEvent({ id: 'a1', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 10 });
    // push a gap entry with index 3 (skipping 2)
    const intr = __getInternalEventLog();
    intr.push({ id: 'gap', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 11, eventIndex: 3, prevHash: '', hash: 'h' } as any);
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(() => {
        appendEvent({ id: 'a2', worldInstanceId: world, actorId: 'x', type: 'T', payload: {}, timestamp: 12 });
      }).toThrow(/Event index gap detected/);
    } finally {
      process.env.NODE_ENV = old;
    }
  });

  test('truncation behavior and reappend determinism', () => {
    const world = 'w-trunc';
    appendEvent({ id: 't1', worldInstanceId: world, actorId: 'a', type: 'T', payload: { n: 1 }, timestamp: 1 });
    appendEvent({ id: 't2', worldInstanceId: world, actorId: 'a', type: 'T', payload: { n: 2 }, timestamp: 2 });
    appendEvent({ id: 't3', worldInstanceId: world, actorId: 'a', type: 'T', payload: { n: 3 }, timestamp: 3 });

    // Truncate to keep first 2
    truncateEventsForWorld(world, 2);
    const after = getEventsForWorld(world);
    expect(after.length).toBe(2);
    expect(after.map(e => e.eventIndex)).toEqual([1,2]);
    // Hash chain: second.prevHash === first.hash
    expect(after[1].prevHash).toBe(after[0].hash);

    // Re-append deterministic: provide explicit timestamp to avoid Date.now variability
    appendEvent({ id: 't4', worldInstanceId: world, actorId: 'a', type: 'T', payload: { n: 4 }, timestamp: 4 });
    const after2 = getEventsForWorld(world);
    expect(after2.length).toBe(3);
    expect(after2[2].eventIndex).toBe(3);
    expect(after2[2].prevHash).toBe(after2[1].hash);
  });

  test('hash domain separation and canonicalization determinism', () => {
    const world = 'w-hash';
    const payloadA = { a: 1, b: 2 };
    const payloadB = { b: 2, a: 1 };
    // canonicalized forms should be equal regardless of key order
    const sA = canonicalize(payloadA);
    const sB = canonicalize(payloadB);
    expect(sA).toBe(sB);

    // same payload, different prefix => different hash
    const serialized = canonicalize({ foo: 'bar' });
    const h1 = crypto.createHash('sha256').update(HASH_PREFIX + serialized).digest('hex');
    const h2 = crypto.createHash('sha256').update(HASH_PREFIX + 'X' + serialized).digest('hex');
    expect(h1).not.toBe(h2);

    // Arrays preserve order
    const arr1 = canonicalize(['x','y']);
    const arr2 = canonicalize(['y','x']);
    expect(arr1).not.toBe(arr2);
  });

  test('deep immutability enforcement (deep freeze)', () => {
    const world = 'w-freeze';
    appendEvent({ id: 'f1', worldInstanceId: world, actorId: 'a', type: 'T', payload: { nested: { v: 1 }, arr: [1,2] }, timestamp: 100 });
    const events = getEventsForWorld(world);
    const e = events[0] as any;
    // object should be frozen deeply
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.payload)).toBe(true);
    expect(Object.isFrozen(e.payload.nested)).toBe(true);
    expect(Object.isFrozen(e.payload.arr)).toBe(true);

    // assignment in strict mode should throw
    expect(() => {
      (function() {
        'use strict';
        e.newProp = 5;
      })();
    }).toThrow();

    expect(() => {
      (function() {
        'use strict';
        e.payload.nested.v = 10;
      })();
    }).toThrow();
  });

  describe('canonicalize and input validation edge cases', () => {
    test('canonicalize rejects Date/Map/Set/non-plain objects', () => {
      expect(() => canonicalize(new Date())).toThrow(/Date objects are not allowed/);
      expect(() => canonicalize(new Map())).toThrow(/Map\/Set are not allowed/);
      expect(() => canonicalize(new Set())).toThrow(/Map\/Set are not allowed/);
      // non-plain object (e.g., constructed object with prototype)
      function Ctor(this: any) { this.x = 1; }
      // @ts-ignore
      const obj = new (Ctor as any)();
      expect(() => canonicalize(obj)).toThrow(/Only plain objects are allowed/);
    });

    test('canonicalize rejects NaN/Infinity and unsupported primitives', () => {
      expect(() => canonicalize(NaN)).toThrow(/Numeric value not allowed/);
      expect(() => canonicalize(Infinity)).toThrow(/Numeric value not allowed/);
      // symbol/function unsupported
      // @ts-ignore
      expect(() => canonicalize(Symbol('s'))).toThrow(/Unsupported type/);
      // @ts-ignore
      expect(() => canonicalize(() => {})).toThrow(/Unsupported type/);
    });

    test('appendEvent validates required fields and strips ledger fields', () => {
      clearEventLog();
      // missing worldInstanceId
      expect(() => appendEvent({ id: 'x', worldInstanceId: '' as any, actorId: 'a', type: 'T', payload: {}, timestamp: 1 })).toThrow(/event.worldInstanceId is required/);
      expect(() => appendEvent({ id: 'x', worldInstanceId: 'w', actorId: '' as any, type: 'T', payload: {}, timestamp: 1 })).toThrow(/event.actorId is required/);
      expect(() => appendEvent({ id: 'x', worldInstanceId: 'w', actorId: 'a', type: '' as any, payload: {}, timestamp: 1 })).toThrow(/event.type is required/);

      // ledger fields supplied by caller are removed and replaced
      appendEvent({ id: 'ok1', worldInstanceId: 'w-s', actorId: 'a', type: 'T', payload: {}, timestamp: 10, eventIndex: 999 as any, prevHash: 'x' as any, hash: 'y' as any } as any);
      const ev = getEventsForWorld('w-s')[0] as any;
      expect(ev.eventIndex).toBe(1);
      expect(ev.prevHash).toBe('');
      expect(typeof ev.hash).toBe('string');
    });

    test('appendEvent assigns Date.now when timestamp not provided', () => {
      clearEventLog();
      appendEvent({ id: 'ts1', worldInstanceId: 'w-now', actorId: 'a', type: 'T', payload: {} } as any);
      const ev = getEventsForWorld('w-now')[0] as any;
      expect(typeof ev.timestamp).toBe('number');
      expect(ev.timestamp).toBeGreaterThan(0);
    });

    test('canonicalize handles null/undefined/booleans/numbers', () => {
      expect(canonicalize(undefined)).toBe('null');
      expect(canonicalize(null)).toBe('null');
      expect(canonicalize(true)).toBe('true');
      expect(canonicalize(false)).toBe('false');
      expect(canonicalize(5)).toBe('5');
      expect(canonicalize('x')).toBe('"x"');
    });
  });
});
