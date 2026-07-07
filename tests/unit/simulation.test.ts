import { describe, expect, it } from 'vitest';
import { CLOSED_RETENTION_MS, createInitialState, ENROUTE_MS, ONSCENE_MS, reportIncident, tick } from '../../src/simulation';

describe('createInitialState', () => {
  it('creates six available units and no incidents', () => {
    const state = createInitialState();
    expect(state.units).toHaveLength(6);
    expect(state.units.every((u) => u.status === 'available')).toBe(true);
    expect(state.incidents).toHaveLength(0);
  });
});

describe('reportIncident', () => {
  it('adds a pending incident with the given id, type, location, priority', () => {
    const state = createInitialState();
    const next = reportIncident(
      state,
      { id: 'inc-1', type: 'Medical Emergency', location: '88 River Rd', priority: 1 },
      1000,
    );
    expect(next.incidents).toHaveLength(1);
    expect(next.incidents[0]).toMatchObject({
      id: 'inc-1',
      type: 'Medical Emergency',
      location: '88 River Rd',
      priority: 1,
      status: 'pending',
      createdAt: 1000,
      dispatchedAt: null,
      onSceneAt: null,
      closedAt: null,
    });
  });
});

describe('tick', () => {
  it('assigns an available unit to a pending incident', () => {
    let state = createInitialState();
    state = reportIncident(state, { id: 'inc-1', type: 'Fire', location: 'A', priority: 2 }, 0);

    const next = tick(state, 100);

    const incident = next.incidents.find((i) => i.id === 'inc-1')!;
    expect(incident.status).toBe('dispatched');
    expect(incident.dispatchedAt).toBe(100);
    const assignedUnit = next.units.find((u) => u.assignedIncidentId === 'inc-1');
    expect(assignedUnit?.status).toBe('enroute');
  });

  it('dispatches the higher-priority incident first when only one unit is available', () => {
    let state = createInitialState();
    state = { ...state, units: [state.units[0]] }; // only one unit
    state = reportIncident(state, { id: 'low', type: 'Alarm', location: 'A', priority: 3 }, 0);
    state = reportIncident(state, { id: 'high', type: 'Fire', location: 'B', priority: 1 }, 0);

    const next = tick(state, 100);

    expect(next.incidents.find((i) => i.id === 'high')?.status).toBe('dispatched');
    expect(next.incidents.find((i) => i.id === 'low')?.status).toBe('pending');
  });

  it('leaves an incident pending when no units are available', () => {
    let state = createInitialState();
    state = { ...state, units: [] };
    state = reportIncident(state, { id: 'inc-1', type: 'Fire', location: 'A', priority: 1 }, 0);

    const next = tick(state, 100);

    expect(next.incidents[0].status).toBe('pending');
  });

  it('advances an enroute unit to onscene only after ENROUTE_MS has elapsed', () => {
    let state = createInitialState();
    state = reportIncident(state, { id: 'inc-1', type: 'Fire', location: 'A', priority: 1 }, 0);
    state = tick(state, 0); // dispatched at t=0

    const tooSoon = tick(state, ENROUTE_MS - 1);
    expect(tooSoon.incidents[0].status).toBe('dispatched');

    const onTime = tick(state, ENROUTE_MS);
    expect(onTime.incidents[0].status).toBe('onscene');
    expect(onTime.units.find((u) => u.assignedIncidentId === 'inc-1')?.status).toBe('onscene');
  });

  it('clears a unit and closes the incident after ONSCENE_MS, freeing the unit for the next tick', () => {
    let state = createInitialState();
    state = { ...state, units: [state.units[0]] }; // only one unit
    state = reportIncident(state, { id: 'first', type: 'Fire', location: 'A', priority: 1 }, 0);
    state = tick(state, 0); // 'first' dispatched at t=0
    state = tick(state, ENROUTE_MS); // 'first' onscene at t=ENROUTE_MS
    state = reportIncident(state, { id: 'second', type: 'Alarm', location: 'B', priority: 1 }, ENROUTE_MS + 1);

    const next = tick(state, ENROUTE_MS + ONSCENE_MS);

    expect(next.incidents.find((i) => i.id === 'first')?.status).toBe('closed');
    expect(next.incidents.find((i) => i.id === 'second')?.status).toBe('dispatched');
  });

  it('drops a closed incident once it is older than CLOSED_RETENTION_MS', () => {
    let state = createInitialState();
    state = { ...state, units: [state.units[0]] };
    state = reportIncident(state, { id: 'inc-1', type: 'Fire', location: 'A', priority: 1 }, 0);
    state = tick(state, 0); // dispatched
    state = tick(state, ENROUTE_MS); // onscene
    state = tick(state, ENROUTE_MS + ONSCENE_MS); // closed here, still retained

    expect(state.incidents.find((i) => i.id === 'inc-1')?.status).toBe('closed');

    const pruned = tick(state, ENROUTE_MS + ONSCENE_MS + CLOSED_RETENTION_MS + 1);

    expect(pruned.incidents.find((i) => i.id === 'inc-1')).toBeUndefined();
  });
});
