import crypto from 'crypto';

// Hash versioning and domain separation constants
export const HASH_VERSION = 1;
export const HASH_PREFIX = 'PROJECT_ISEKAI_LEDGER_V1|';

export type MutationClass = 'STATE_CHANGE' | 'REJECTION' | 'SYSTEM' | 'NARRATIVE';

export type Event = {
  id: string;
  worldInstanceId: string;
  actorId: string;
  type: string;
  payload: any;
  timestamp: number;
  templateOrigin?: string; // optional origin/template id that produced this event
  mutationClass?: MutationClass;
  // ledger fields
  eventIndex?: number;
  prevHash?: string;
  hash?: string;
};

// internal event log (do not export mutable array)
const eventLog: Event[] = [];

function isPlainObject(v: any): boolean {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

export function canonicalize(value: any): string {
  // primitives
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new Error('Numeric value not allowed in canonicalization: ' + String(value));
    // JSON.stringify normalizes numbers (1 and 1.0 -> "1")
    return JSON.stringify(value);
  }
  if (t === 'string') return JSON.stringify(value);
  if (t === 'undefined') return 'null';
  if (t === 'symbol' || t === 'function') throw new Error('Unsupported type in canonicalization: ' + t);

  // objects/arrays
  if (Array.isArray(value)) {
    const items = value.map((it) => canonicalize(it));
    return '[' + items.join(',') + ']';
  }

  // Map/Set/Date/other non-plain objects are rejected
  if (value instanceof Date) {
    throw new Error('Date objects are not allowed in canonicalized payloads');
  }
  if (value instanceof Map || value instanceof Set) {
    throw new Error('Map/Set are not allowed in canonicalized payloads');
  }
  if (!isPlainObject(value)) {
    throw new Error('Only plain objects are allowed in canonicalized payloads');
  }

  const keys = Object.keys(value).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = value[k];
    // Omit undefined-valued keys from canonicalization to match JSON semantics
    if (typeof v === 'undefined') continue;
    parts.push(JSON.stringify(k) + ':' + canonicalize(v));
  }
  return '{' + parts.join(',') + '}';
}

export function appendEvent(event: Event) {
  // Ensure mutationClass default
  if (!event.mutationClass) event.mutationClass = 'STATE_CHANGE';

  // Event creation boundary hardening:
  // - callers must not set ledger fields (`eventIndex`, `prevHash`, `hash`)
  // - timestamp may be supplied but must be monotonic per-world
  // - worldInstanceId, actorId, and type must be present
  if (!event.worldInstanceId) throw new Error('event.worldInstanceId is required');
  if (!event.actorId) throw new Error('event.actorId is required');
  if (!event.type) throw new Error('event.type is required');

  // Remove any externally supplied ledger fields to prevent bypass
  try { delete (event as any).eventIndex; } catch (e) { }
  try { delete (event as any).prevHash; } catch (e) { }
  try { delete (event as any).hash; } catch (e) { }

  // compute per-world monotonic index
  const last = (() => {
    for (let i = eventLog.length - 1; i >= 0; i--) {
      if (eventLog[i].worldInstanceId === event.worldInstanceId) return eventLog[i];
    }
    return null as Event | null;
  })();
  const lastIndex = last ? (last.eventIndex || 0) : 0;
  event.eventIndex = lastIndex + 1;
  event.prevHash = last ? (last.hash || '') : '';

  // Timestamp handling: if caller provided timestamp, ensure monotonicity per world
  if (typeof event.timestamp !== 'number') {
    event.timestamp = Date.now();
  } else {
    const lastTs = last ? (last.timestamp || 0) : 0;
    if (event.timestamp < lastTs) {
      throw new Error(`Non-monotonic timestamp for world=${event.worldInstanceId}: ${event.timestamp} < ${lastTs}`);
    }
  }

  // Invariant checks:
  // - Duplicate eventIndex for the same world is always an error (possible tamper/race)
  // - Gaps in the index sequence are considered errors in development (to surface corruption early)
  // Note: We hash ALL events (STATE_CHANGE, REJECTION, SYSTEM, etc.). The ledger must be canonical
  // and include metadata events even if replay ignores some classes.
  // Duplicate detection
  const dup = eventLog.find(e => e.worldInstanceId === event.worldInstanceId && e.eventIndex === event.eventIndex);
  if (dup) {
    throw new Error(`Duplicate eventIndex detected for world=${event.worldInstanceId} index=${event.eventIndex}`);
  }
  // Contiguity check: ensure indices for this world form a continuous sequence starting at 1
  const own = eventLog.filter(e => e.worldInstanceId === event.worldInstanceId).map(e => e.eventIndex || 0);
  const indices = [...own, event.eventIndex || 0].sort((a,b)=>a-b);
  // expected sequence 1..max
  const max = indices.length ? indices[indices.length-1] : 0;
  let contiguous = true;
  for (let i = 1; i <= max; i++) {
    if (!indices.includes(i)) { contiguous = false; break; }
  }
  if (!contiguous && process.env.NODE_ENV === 'development') {
    throw new Error(`Event index gap detected for world=${event.worldInstanceId}; indices=${indices.join(',')}`);
  }

  // compute stable hash over the event payload and header (excluding hash fields)
  // Strip undefined keys from payload to avoid storing ambiguous undefineds
  const cleanPayload = (function clean(o: any): any {
    if (o instanceof Date) throw new Error('Date objects are not allowed in payloads');
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(clean);
    const out: any = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'undefined') continue;
      out[k] = clean(v);
    }
    return out;
  })(event.payload);
  // update event.payload to the cleaned form so stored events don't carry undefined
  event.payload = cleanPayload;

  const toHash: any = {
    hashVersion: HASH_VERSION,
    id: event.id,
    worldInstanceId: event.worldInstanceId,
    actorId: event.actorId,
    type: event.type,
    payload: event.payload,
    timestamp: event.timestamp,
    templateOrigin: event.templateOrigin,
    mutationClass: event.mutationClass,
    eventIndex: event.eventIndex,
    prevHash: event.prevHash,
  };
  // canonicalize and compute hash
  const serialized = canonicalize(toHash);
  // Use domain-separated canonical bytes only; do not concatenate prevHash separately
  const hash = crypto.createHash('sha256').update(HASH_PREFIX + serialized).digest('hex');
  // assign hash before freezing to avoid TypeError on non-extensible objects
  event.hash = hash;
  // deep freeze payload and event to prevent in-process mutation after hashing
  function deepFreeze(o: any) {
    if (o && typeof o === 'object') {
      Object.freeze(o);
      if (Array.isArray(o)) {
        for (const it of o) deepFreeze(it);
      } else {
        for (const k of Object.keys(o)) deepFreeze(o[k]);
      }
    }
  }
  try { deepFreeze(event.payload); } catch (e) { /* ignore */ }
  try { deepFreeze(event); } catch (e) { /* ignore */ }

  eventLog.push(event);
}

export function getEventsForWorld(worldId: string) {
  return eventLog.filter(e => e.worldInstanceId === worldId);
}

export function getReplayableEvents(worldId: string) {
  // replayable events exclude REJECTION-class meta events
  return eventLog.filter(e => e.worldInstanceId === worldId && e.mutationClass !== 'REJECTION');
}

export function clearEventLog() {
  eventLog.length = 0;
}

export function truncateEventsForWorld(worldId: string, keep = 0) {
  const others = eventLog.filter(e => e.worldInstanceId !== worldId);
  const own = eventLog.filter(e => e.worldInstanceId === worldId).slice(0, keep);
  eventLog.length = 0;
  eventLog.push(...others, ...own);
}

// Test-only: expose internal mutable event log for verification/hardening tests.
// This should only be used in test environments and is not part of the public runtime contract.
export function __getInternalEventLog(): Event[] {
  return eventLog;
}
