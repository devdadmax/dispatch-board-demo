import { state, fmtClock } from './state.js';
import { renderIncidents, updateElapsed as updateElapsedRows } from './render-incidents.js';
import { renderUnits } from './render-units.js';
import { markInspectedEls, renderDetail, updateInspectedElapsed } from './detail-panel.js';
import { connect } from './socket.js';

const activeEl = document.getElementById('active-count');
const availEl = document.getElementById('available-count');
const qCountEl = document.getElementById('queue-count');
const uTotalEl = document.getElementById('unit-total');
const clockEl = document.getElementById('clock');

function setCount(el, val) {
  const cur = parseInt(el.textContent, 10);
  if (cur !== val) {
    el.textContent = val;
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
  }
}

/** @param {import('./state.js').BoardState} boardState */
function render(boardState) {
  state.lastState = boardState;
  const now = Date.now();

  renderIncidents(boardState.incidents, boardState.units, now);
  renderUnits(boardState.units, boardState.incidents);

  const active = boardState.incidents.filter((i) => i.status !== 'closed').length;
  const avail = boardState.units.filter((u) => u.status === 'available').length;
  setCount(activeEl, active);
  setCount(availEl, avail);
  if (qCountEl) qCountEl.textContent = active;
  if (uTotalEl) uTotalEl.textContent = boardState.units.length;

  markInspectedEls();
  renderDetail();
}

function updateElapsed() {
  const now = Date.now();
  updateElapsedRows(state.lastState.incidents, now);
  updateInspectedElapsed(now);
}

function updateClock() {
  if (!clockEl) return;
  clockEl.textContent = fmtClock(Date.now());
}

updateClock();
setInterval(updateClock, 1000);
setInterval(updateElapsed, 1000);
connect(render);
