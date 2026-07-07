/**
 * Non-modal inspector drawer for a clicked incident/unit row.
 * `role="dialog"` with `aria-modal="false"` — no focus trap, no backdrop.
 */
import { STATUS_LABEL, UNIT_STATE_CLASS, UNIT_STATE_LABEL, STAGE_ORDER, state, displayCall, fmtElapsed, fmtClock } from './state.js';
import { queueEl } from './render-incidents.js';
import { unitEl } from './render-units.js';

const detailPanel = document.getElementById('detail-panel');
const detailKicker = document.getElementById('detail-kicker');
const detailTitle = document.getElementById('detail-title');
const detailBody = document.getElementById('detail-body');
const detailClose = document.getElementById('detail-close');
const reportBtn = document.getElementById('report-incident');

export function markInspectedEls() {
  queueEl.querySelectorAll('.incident-row').forEach((row) => {
    row.classList.toggle(
      'is-inspected',
      !!state.inspected && state.inspected.kind === 'incident' && row.getAttribute('data-id') === state.inspected.id,
    );
  });
  unitEl.querySelectorAll('.unit').forEach((el) => {
    el.classList.toggle(
      'is-inspected',
      !!state.inspected && state.inspected.kind === 'unit' && el.getAttribute('data-id') === state.inspected.id,
    );
  });
}

/** @param {import('./state.js').Incident} inc */
function buildIncidentDetail(inc) {
  let unitCallsign = null;
  state.lastState.units.forEach((u) => {
    if (u.assignedIncidentId === inc.id) unitCallsign = u.callsign;
  });

  detailKicker.textContent = displayCall(inc.id);
  detailTitle.textContent = inc.type;

  const frag = document.createDocumentFragment();

  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  const pri = document.createElement('span');
  pri.className = `pri-tag detail-pri priority-${inc.priority}`;
  pri.textContent = `P${inc.priority}`;
  const status = document.createElement('span');
  const statusClass = `status-${inc.status === 'closed' ? 'cleared' : inc.status}`;
  status.className = `status-tag detail-status ${statusClass}`;
  status.textContent = STATUS_LABEL[inc.status];
  tags.append(pri, status);
  frag.appendChild(tags);

  const fields = document.createElement('dl');
  fields.className = 'detail-fields';
  [
    ['TYPE', inc.type],
    ['LOCATION', inc.location],
    ['ELAPSED', fmtElapsed(Date.now() - inc.createdAt)],
    ['ASSIGNED UNIT', unitCallsign || '—'],
  ].forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    fields.append(dt, dd);
  });
  frag.appendChild(fields);

  const timeline = document.createElement('div');
  timeline.className = 'detail-timeline';
  let prevTs = null;
  STAGE_ORDER.forEach((stage) => {
    const ts = inc[stage.key];
    if (!ts) return;
    const row = document.createElement('div');
    row.className = 'tl-row';
    const dot = document.createElement('span');
    dot.className = 'tl-dot';
    const label = document.createElement('span');
    label.className = 'tl-label';
    label.textContent = stage.label;
    const time = document.createElement('span');
    time.className = 'tl-time';
    time.textContent = fmtClock(ts);
    row.append(dot, label, time);
    if (prevTs !== null) {
      const delta = document.createElement('span');
      delta.className = 'tl-delta';
      delta.textContent = `+${fmtElapsed(ts - prevTs)}`;
      row.appendChild(delta);
    }
    timeline.appendChild(row);
    prevTs = ts;
  });
  frag.appendChild(timeline);

  detailBody.replaceChildren(frag);
}

/** @param {import('./state.js').Unit} u */
function buildUnitDetail(u) {
  let call = null;
  let assignedInc = null;
  if (u.assignedIncidentId) {
    assignedInc = state.lastState.incidents.find((i) => i.id === u.assignedIncidentId);
    if (assignedInc) call = displayCall(assignedInc.id);
  }

  detailKicker.textContent = 'UNIT';
  detailTitle.textContent = u.callsign;

  const frag = document.createDocumentFragment();

  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  const stateTag = document.createElement('span');
  stateTag.className = `unit-state-tag ${UNIT_STATE_CLASS[u.status] || 'u-available'}`;
  stateTag.textContent = UNIT_STATE_LABEL[u.status] || u.status;
  tags.appendChild(stateTag);
  frag.appendChild(tags);

  const fields = document.createElement('dl');
  fields.className = 'detail-fields';
  [
    ['CALLSIGN', u.callsign],
    ['STATUS', UNIT_STATE_LABEL[u.status] || u.status],
  ].forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    fields.append(dt, dd);
  });
  frag.appendChild(fields);

  const assignment = document.createElement('div');
  assignment.className = 'detail-assignment';
  const head = document.createElement('div');
  head.className = 'da-head';
  head.textContent = 'ASSIGNMENT';
  assignment.appendChild(head);
  if (assignedInc) {
    const row = document.createElement('div');
    row.className = 'da-row';
    const callSpan = document.createElement('span');
    callSpan.className = 'da-call';
    callSpan.textContent = call;
    const typeSpan = document.createElement('span');
    typeSpan.className = 'da-type';
    typeSpan.textContent = assignedInc.type;
    const locSpan = document.createElement('span');
    locSpan.className = 'da-loc';
    locSpan.textContent = assignedInc.location;
    row.append(callSpan, typeSpan, locSpan);
    assignment.appendChild(row);
  } else {
    const empty = document.createElement('div');
    empty.className = 'da-empty';
    const none = document.createElement('span');
    none.className = 'da-none';
    none.textContent = 'NO ACTIVE ASSIGNMENT';
    empty.appendChild(none);
    assignment.appendChild(empty);
  }
  frag.appendChild(assignment);

  detailBody.replaceChildren(frag);
}

/** @param {'incident'|'unit'} kind */
function buildGoneDetail(kind) {
  detailKicker.textContent = '';
  detailTitle.textContent = kind === 'incident' ? 'CALL CLEARED' : 'UNIT OFFLINE';
  const wrap = document.createElement('div');
  wrap.className = 'detail-gone';
  const mark = document.createElement('div');
  mark.className = 'dg-mark';
  const title = document.createElement('div');
  title.className = 'dg-title';
  title.textContent = kind === 'incident' ? 'CALL CLEARED FROM BOARD' : 'UNIT OFF ROSTER';
  const sub = document.createElement('div');
  sub.className = 'dg-sub';
  sub.textContent = 'This entity is no longer present on the board.';
  wrap.append(mark, title, sub);
  detailBody.replaceChildren(wrap);
}

export function renderDetail() {
  if (!state.inspected) return;
  if (state.inspected.kind === 'incident') {
    const inc = state.lastState.incidents.find((i) => i.id === state.inspected.id);
    if (inc) buildIncidentDetail(inc);
    else buildGoneDetail('incident');
  } else {
    const u = state.lastState.units.find((x) => x.id === state.inspected.id);
    if (u) buildUnitDetail(u);
    else buildGoneDetail('unit');
  }
}

/**
 * @param {'incident'|'unit'} kind
 * @param {string} id
 * @param {Element} [triggerEl]
 */
function openDetail(kind, id, triggerEl) {
  const isRetarget = !!state.inspected;
  state.inspected = { kind, id };
  renderDetail();
  markInspectedEls();
  if (!isRetarget) {
    state.lastFocusEl = triggerEl || document.activeElement;
    detailPanel.hidden = false;
    detailPanel.classList.remove('is-open');
    void detailPanel.offsetWidth;
    detailPanel.classList.add('is-open');
    detailClose.focus();
  }
}

export function closeDetail() {
  if (!state.inspected) return;
  state.inspected = null;
  markInspectedEls();
  detailPanel.classList.remove('is-open');
  detailPanel.hidden = true;
  if (state.lastFocusEl && document.contains(state.lastFocusEl)) {
    state.lastFocusEl.focus();
  } else if (reportBtn) {
    reportBtn.focus();
  }
  state.lastFocusEl = null;
}

/**
 * @param {'incident'|'unit'} kind
 * @param {string} id
 * @param {Element} [triggerEl]
 */
function toggleDetail(kind, id, triggerEl) {
  if (state.inspected && state.inspected.kind === kind && state.inspected.id === id) {
    closeDetail();
  } else {
    openDetail(kind, id, triggerEl);
  }
}

export function updateInspectedElapsed(now) {
  if (state.inspected && state.inspected.kind === 'incident') {
    const elapsedDd = detailBody.querySelector('.detail-fields dd:nth-of-type(3)');
    const inspectedInc = state.lastState.incidents.find((x) => x.id === state.inspected.id);
    if (elapsedDd && inspectedInc) elapsedDd.textContent = fmtElapsed(now - inspectedInc.createdAt);
  }
}

queueEl.addEventListener('click', (e) => {
  const row = e.target.closest('.incident-row');
  if (!row) return;
  toggleDetail('incident', row.getAttribute('data-id'), row);
});
queueEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('.incident-row');
  if (!row) return;
  e.preventDefault();
  toggleDetail('incident', row.getAttribute('data-id'), row);
});

unitEl.addEventListener('click', (e) => {
  const el = e.target.closest('.unit');
  if (!el) return;
  toggleDetail('unit', el.getAttribute('data-id'), el);
});
unitEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('.unit');
  if (!el) return;
  e.preventDefault();
  toggleDetail('unit', el.getAttribute('data-id'), el);
});

detailClose.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.inspected) closeDetail();
});
document.addEventListener('pointerdown', (e) => {
  if (!state.inspected || detailPanel.hidden) return;
  if (detailPanel.contains(e.target)) return;
  if (e.target.closest('.incident-row') || e.target.closest('.unit')) return;
  closeDetail();
});
