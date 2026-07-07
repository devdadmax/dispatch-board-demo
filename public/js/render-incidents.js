/**
 * Renders and diff-patches the incident queue table.
 *
 * We never `replaceChildren()` and rebuild — incoming state is diffed by
 * `id` and patched into the existing DOM, so pending -> dispatched and
 * status transitions have a persistent node for CSS to animate.
 */
import { PRIORITY_ORDER, STATUS_LABEL, displayCall, fmtElapsed, pulse } from './state.js';

const queueEl = document.getElementById('incident-queue');

/** @param {import('./state.js').Incident[]} list */
function sortIncidents(list) {
  return list.slice().sort((a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return a.createdAt - b.createdAt;
  });
}

/** @param {import('./state.js').Incident} inc */
function buildRow(inc) {
  const row = document.createElement('div');
  row.className = 'incident-row';
  row.dataset.testid = 'incident-row';
  row.dataset.id = inc.id;
  row.setAttribute('role', 'row');
  row.setAttribute('tabindex', '0');

  const pri = document.createElement('span');
  pri.className = 'col-pri';
  const priTag = document.createElement('span');
  priTag.className = 'pri-tag';
  pri.appendChild(priTag);

  const call = document.createElement('span');
  call.className = 'col-call';
  const time = document.createElement('span');
  time.className = 'col-time';
  const type = document.createElement('span');
  type.className = 'col-type';
  const loc = document.createElement('span');
  loc.className = 'col-loc';

  const status = document.createElement('span');
  status.className = 'col-status';
  const statusTag = document.createElement('span');
  statusTag.className = 'status-tag';
  status.appendChild(statusTag);

  const unit = document.createElement('span');
  unit.className = 'col-unit';

  row.append(pri, call, time, type, loc, status, unit);
  return row;
}

/**
 * @param {HTMLElement} row
 * @param {import('./state.js').Incident} inc
 * @param {string|undefined} unitCallsign
 * @param {number} now
 */
function patchRow(row, inc, unitCallsign, now) {
  row.classList.remove('priority-1', 'priority-2', 'priority-3');
  row.classList.add(`priority-${inc.priority}`);
  row.querySelector('.pri-tag').textContent = `P${inc.priority}`;

  const callCell = row.querySelector('.col-call');
  const call = displayCall(inc.id);
  if (callCell.textContent !== call) callCell.textContent = call;

  const timeCell = row.querySelector('.col-time');
  timeCell.textContent = fmtElapsed(now - inc.createdAt);
  timeCell.classList.toggle('overdue', inc.status === 'pending' && now - inc.createdAt > 90000);

  const typeCell = row.querySelector('.col-type');
  if (typeCell.textContent !== inc.type) typeCell.textContent = inc.type;

  const locCell = row.querySelector('.col-loc');
  if (locCell.textContent !== inc.location) locCell.textContent = inc.location;

  const statusClass = `status-${inc.status === 'closed' ? 'cleared' : inc.status}`;
  if (!row.classList.contains(statusClass)) {
    row.classList.remove('status-pending', 'status-dispatched', 'status-onscene', 'status-cleared');
    row.classList.add(statusClass);
    pulse(row.querySelector('.col-status'));
  }
  row.querySelector('.status-tag').textContent = STATUS_LABEL[inc.status];

  const unitCell = row.querySelector('.col-unit');
  const unitTxt = unitCallsign || '—';
  if (unitCell.textContent !== unitTxt) {
    unitCell.textContent = unitTxt;
    pulse(unitCell);
  }
  unitCell.classList.toggle('unassigned', !unitCallsign);
}

function renderEmpty() {
  const wrap = document.createElement('div');
  wrap.className = 'queue-empty';
  const mark = document.createElement('div');
  mark.className = 'empty-mark';
  const title = document.createElement('div');
  title.className = 'empty-title';
  title.textContent = 'QUEUE CLEAR';
  const sub = document.createElement('div');
  sub.className = 'empty-sub';
  sub.textContent = 'No active incidents. All units available.';
  wrap.append(mark, title, sub);
  queueEl.replaceChildren(wrap);
}

/**
 * @param {import('./state.js').Incident[]} incidents
 * @param {import('./state.js').Unit[]} units
 * @param {number} now
 */
export function renderIncidents(incidents, units, now) {
  const active = incidents.filter((i) => i.status !== 'closed');
  const sorted = sortIncidents(active);

  if (sorted.length === 0) {
    if (!queueEl.querySelector('.queue-empty')) renderEmpty();
    return;
  }
  const empty = queueEl.querySelector('.queue-empty');
  if (empty) empty.remove();

  const unitByIncident = {};
  units.forEach((u) => {
    if (u.assignedIncidentId) unitByIncident[u.assignedIncidentId] = u.callsign;
  });

  const seen = {};
  sorted.forEach((inc) => {
    seen[inc.id] = true;
    let row = queueEl.querySelector(`.incident-row[data-id="${inc.id}"]`);
    const isNew = !row;
    if (isNew) row = buildRow(inc);
    patchRow(row, inc, unitByIncident[inc.id], now);
    queueEl.appendChild(row); // reorders existing nodes; no-op if already last-in-order
    if (isNew) {
      row.classList.remove('row-enter');
      void row.offsetWidth;
      row.classList.add('row-enter');
    }
  });

  queueEl.querySelectorAll('.incident-row').forEach((row) => {
    if (!seen[row.getAttribute('data-id')]) row.remove();
  });
}

/** Re-stamps the elapsed-time cell on every row without a full re-render. */
export function updateElapsed(incidents, now) {
  queueEl.querySelectorAll('.incident-row').forEach((row) => {
    const inc = incidents.find((x) => x.id === row.getAttribute('data-id'));
    if (!inc) return;
    const cell = row.querySelector('.col-time');
    cell.textContent = fmtElapsed(now - inc.createdAt);
    cell.classList.toggle('overdue', inc.status === 'pending' && now - inc.createdAt > 90000);
  });
}

export { queueEl };
