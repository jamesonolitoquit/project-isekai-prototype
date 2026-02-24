import { appendEvent, getReplayableEvents, clearEventLog } from "../events/mutationLog";

describe('mutationLog determinism', () => {
  beforeEach(() => {
    clearEventLog();
  });

  test('reproducible eventIndex and hash for same sequence', () => {
    const seq = [
      { id: 'e1', worldInstanceId: 'w1', actorId: 'p1', type: 'T1', payload: { a: 1 }, timestamp: 1000 },
      { id: 'e2', worldInstanceId: 'w1', actorId: 'p1', type: 'T2', payload: { b: 2 }, timestamp: 1010 },
      { id: 'e3', worldInstanceId: 'w1', actorId: 'p1', type: 'T3', payload: { c: 3 }, timestamp: 1020 },
    ];

    const firstRun: any[] = [];
    for (const e of seq) {
      appendEvent({ ...e });
      const events = getReplayableEvents('w1');
      firstRun.push(events[events.length - 1]);
    }

    const snapshot = firstRun.map(ev => ({ eventIndex: ev.eventIndex, prevHash: ev.prevHash, hash: ev.hash }));

    clearEventLog();

    const secondRun: any[] = [];
    for (const e of seq) {
      appendEvent({ ...e });
      const events = getReplayableEvents('w1');
      secondRun.push(events[events.length - 1]);
    }

    const snapshot2 = secondRun.map(ev => ({ eventIndex: ev.eventIndex, prevHash: ev.prevHash, hash: ev.hash }));

    expect(snapshot2).toEqual(snapshot);
  });

  test('replayable excludes REJECTION', () => {
    appendEvent({ id: 'r1', worldInstanceId: 'w2', actorId: 'p2', type: 'R', payload: {}, timestamp: 2000, mutationClass: 'REJECTION' });
    appendEvent({ id: 's1', worldInstanceId: 'w2', actorId: 'p2', type: 'S', payload: {}, timestamp: 2010, mutationClass: 'STATE_CHANGE' });
    const events = getReplayableEvents('w2');
    expect(events.map(e => e.id)).toEqual(['s1']);
  });
});
