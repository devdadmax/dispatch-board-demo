import type { BoardState, Incident, IncidentPriority, Unit } from './types';

export const ENROUTE_MS = 4000;
export const ONSCENE_MS = 6000;
export const CLOSED_RETENTION_MS = 15000;

const UNIT_CALLSIGNS = ['Adam-12', 'Baker-7', 'Charlie-3', 'David-9', 'Edward-5', 'Frank-1'];

export function createInitialState(): BoardState {
  return {
    units: UNIT_CALLSIGNS.map((callsign, i) => ({
      id: `unit-${i}`,
      callsign,
      status: 'available',
      assignedIncidentId: null,
    })),
    incidents: [],
  };
}

export function reportIncident(
  state: BoardState,
  input: { id: string; type: string; location: string; priority: IncidentPriority },
  now: number,
): BoardState {
  const incident: Incident = {
    id: input.id,
    type: input.type,
    priority: input.priority,
    location: input.location,
    status: 'pending',
    createdAt: now,
    dispatchedAt: null,
    onSceneAt: null,
    closedAt: null,
  };
  return { ...state, incidents: [...state.incidents, incident] };
}

export function tick(state: BoardState, now: number): BoardState {
  const units: Unit[] = state.units.map((u) => ({ ...u }));
  const incidents: Incident[] = state.incidents.map((i) => ({ ...i }));

  // 1. Onscene units past ONSCENE_MS clear and close their incident, freeing the unit this tick.
  for (const unit of units) {
    if (unit.status !== 'onscene' || !unit.assignedIncidentId) continue;
    const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
    if (incident && incident.onSceneAt !== null && now - incident.onSceneAt >= ONSCENE_MS) {
      incident.status = 'closed';
      incident.closedAt = now;
      unit.status = 'available';
      unit.assignedIncidentId = null;
    }
  }

  // 2. Enroute units past ENROUTE_MS arrive onscene.
  for (const unit of units) {
    if (unit.status !== 'enroute' || !unit.assignedIncidentId) continue;
    const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
    if (incident && incident.dispatchedAt !== null && now - incident.dispatchedAt >= ENROUTE_MS) {
      incident.status = 'onscene';
      incident.onSceneAt = now;
      unit.status = 'onscene';
    }
  }

  // 3. Assign available units to pending incidents, highest priority (lowest number) then oldest first.
  const pending = incidents
    .filter((i) => i.status === 'pending')
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

  for (const incident of pending) {
    const freeUnit = units.find((u) => u.status === 'available');
    if (!freeUnit) break;
    freeUnit.status = 'enroute';
    freeUnit.assignedIncidentId = incident.id;
    incident.status = 'dispatched';
    incident.dispatchedAt = now;
  }

  // 4. Drop old closed incidents so state (and the broadcast payload) doesn't grow forever.
  const retained = incidents.filter(
    (i) => i.status !== 'closed' || i.closedAt === null || now - i.closedAt < CLOSED_RETENTION_MS,
  );

  return { units, incidents: retained };
}
