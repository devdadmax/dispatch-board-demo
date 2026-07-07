/**
 * Shared constants, formatting helpers, and mutable board state.
 *
 * @typedef {'available'|'enroute'|'onscene'|'clear'} UnitStatus
 * @typedef {'pending'|'dispatched'|'onscene'|'closed'} IncidentStatus
 * @typedef {1|2|3} IncidentPriority
 *
 * @typedef {object} Unit
 * @property {string} id
 * @property {string} callsign
 * @property {UnitStatus} status
 * @property {string|null} assignedIncidentId
 *
 * @typedef {object} Incident
 * @property {string} id
 * @property {string} type
 * @property {IncidentPriority} priority
 * @property {string} location
 * @property {IncidentStatus} status
 * @property {number} createdAt
 * @property {number|null} dispatchedAt
 * @property {number|null} onSceneAt
 * @property {number|null} closedAt
 *
 * @typedef {object} BoardState
 * @property {Unit[]} units
 * @property {Incident[]} incidents
 */

export const PRIORITY_ORDER = { 1: 0, 2: 1, 3: 2 };

export const STATUS_LABEL = {
  pending: 'pending',
  dispatched: 'dispatched',
  onscene: 'on-scene',
  closed: 'cleared',
};

export const UNIT_STATE_CLASS = {
  available: 'u-available',
  enroute: 'u-dispatched',
  onscene: 'u-onscene',
  clear: 'u-available',
};

export const UNIT_STATE_LABEL = {
  available: 'available',
  enroute: 'en route',
  onscene: 'on scene',
  clear: 'available',
};

export const STAGE_ORDER = [
  { key: 'createdAt', label: 'REPORTED' },
  { key: 'dispatchedAt', label: 'DISPATCHED' },
  { key: 'onSceneAt', label: 'ON SCENE' },
  { key: 'closedAt', label: 'CLEARED' },
];

/**
 * Mutable app-wide state shared across modules by reference.
 * @type {{ lastState: BoardState, inspected: { kind: 'incident'|'unit', id: string } | null, lastFocusEl: Element | null }}
 */
export const state = {
  lastState: { incidents: [], units: [] },
  inspected: null,
  lastFocusEl: null,
};

/** @param {number} n */
function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** @param {string} id */
export function displayCall(id) {
  return 'INC-' + id.slice(-4).toUpperCase();
}

/** @param {number} ms */
export function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

/** @param {number} ts */
export function fmtClock(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Re-triggers a CSS animation on `el` by forcing a reflow. */
export function pulse(el) {
  if (!el) return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}
