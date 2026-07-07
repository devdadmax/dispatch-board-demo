export type UnitStatus = 'available' | 'enroute' | 'onscene' | 'clear';
export type IncidentStatus = 'pending' | 'dispatched' | 'onscene' | 'closed';
export type IncidentPriority = 1 | 2 | 3;

export interface Unit {
  id: string;
  callsign: string;
  status: UnitStatus;
  assignedIncidentId: string | null;
}

export interface Incident {
  id: string;
  type: string;
  priority: IncidentPriority;
  location: string;
  status: IncidentStatus;
  createdAt: number;
  dispatchedAt: number | null;
  onSceneAt: number | null;
  closedAt: number | null;
}

export interface BoardState {
  units: Unit[];
  incidents: Incident[];
}
