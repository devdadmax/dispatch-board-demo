/** Renders and diff-patches the unit status board. */
import { UNIT_STATE_CLASS, UNIT_STATE_LABEL, displayCall } from './state.js';

const unitEl = document.getElementById('unit-board');

/** @param {import('./state.js').Unit} u */
function buildUnit(u) {
  const el = document.createElement('div');
  el.className = 'unit';
  el.dataset.testid = 'unit-badge';
  el.dataset.id = u.id;
  el.setAttribute('role', 'listitem');
  el.setAttribute('tabindex', '0');

  const top = document.createElement('div');
  top.className = 'unit-top';
  const id = document.createElement('span');
  id.className = 'unit-id';
  top.appendChild(id);

  const state = document.createElement('span');
  state.className = 'unit-state';
  const assign = document.createElement('span');
  assign.className = 'unit-assign';

  el.append(top, state, assign);
  return el;
}

/**
 * @param {HTMLElement} el
 * @param {import('./state.js').Unit} u
 * @param {string|null} assignedCall
 */
function patchUnit(el, u, assignedCall) {
  el.querySelector('.unit-id').textContent = u.callsign;

  const stateClass = UNIT_STATE_CLASS[u.status] || 'u-available';
  if (!el.classList.contains(stateClass)) {
    el.classList.remove('u-available', 'u-dispatched', 'u-onscene', 'u-oos');
    el.classList.add(stateClass);
    el.classList.remove('state-change');
    void el.offsetWidth;
    el.classList.add('state-change');
  }
  el.querySelector('.unit-state').textContent = UNIT_STATE_LABEL[u.status] || u.status;

  const assign = el.querySelector('.unit-assign');
  if (assignedCall) {
    assign.textContent = '';
    const label = document.createTextNode('assigned ');
    const call = document.createElement('span');
    call.className = 'assign-call';
    call.textContent = assignedCall;
    assign.append(label, call);
  } else {
    assign.textContent = 'clear';
  }
}

/**
 * @param {import('./state.js').Unit[]} units
 * @param {import('./state.js').Incident[]} incidents
 */
export function renderUnits(units, incidents) {
  const callById = {};
  incidents.forEach((i) => {
    callById[i.id] = displayCall(i.id);
  });

  const seen = {};
  units.forEach((u) => {
    seen[u.id] = true;
    let el = unitEl.querySelector(`.unit[data-id="${u.id}"]`);
    if (!el) {
      el = buildUnit(u);
      unitEl.appendChild(el);
    }
    patchUnit(el, u, u.assignedIncidentId ? callById[u.assignedIncidentId] : null);
  });

  unitEl.querySelectorAll('.unit').forEach((el) => {
    if (!seen[el.getAttribute('data-id')]) el.remove();
  });
}

export { unitEl };
