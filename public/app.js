/* ============================================================
   DISPATCH // CENTRAL — frontend
   ------------------------------------------------------------
   Connects over WebSocket and receives a FULL board-state push
   on every change. To keep CSS state transitions animatable, we
   do NOT replaceChildren() and rebuild — we diff the incoming
   state by id and patch the existing DOM in place, so
   pending -> dispatched and unit state changes have a
   persistent node to animate.
   ============================================================ */
(function () {
  'use strict';

  var queueEl = document.getElementById('incident-queue');
  var unitEl = document.getElementById('unit-board');
  var activeEl = document.getElementById('active-count');
  var availEl = document.getElementById('available-count');
  var qCountEl = document.getElementById('queue-count');
  var uTotalEl = document.getElementById('unit-total');
  var reportBtn = document.getElementById('report-incident');
  var linkEl = document.getElementById('link-status');
  var linkLabelEl = linkEl ? linkEl.querySelector('.link-label') : null;
  var clockEl = document.getElementById('clock');

  var detailPanel = document.getElementById('detail-panel');
  var detailKicker = document.getElementById('detail-kicker');
  var detailTitle = document.getElementById('detail-title');
  var detailBody = document.getElementById('detail-body');
  var detailClose = document.getElementById('detail-close');

  var PRIORITY_ORDER = { 1: 0, 2: 1, 3: 2 };
  var STATUS_LABEL = { pending: 'pending', dispatched: 'dispatched', onscene: 'on-scene', closed: 'cleared' };
  var UNIT_STATE_CLASS = { available: 'u-available', enroute: 'u-dispatched', onscene: 'u-onscene', clear: 'u-available' };
  var UNIT_STATE_LABEL = { available: 'available', enroute: 'en route', onscene: 'on scene', clear: 'available' };

  function displayCall(id) {
    return 'INC-' + id.slice(-4).toUpperCase();
  }

  function fmtElapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return h > 0 ? h + ':' + p(m) + ':' + p(sec) : p(m) + ':' + p(sec);
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth; // reflow, so the animation re-triggers
    el.classList.add('pulse');
  }

  /* ============================================================
     RENDER + DIFF  (the animatable path)
     ============================================================ */

  function sortIncidents(list) {
    return list.slice().sort(function (a, b) {
      if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      return a.createdAt - b.createdAt;
    });
  }

  function buildRow(inc) {
    var row = document.createElement('div');
    row.className = 'incident-row';
    row.dataset.testid = 'incident-row';
    row.dataset.id = inc.id;
    row.setAttribute('role', 'row');
    row.setAttribute('tabindex', '0');
    var pri = document.createElement('span');
    pri.className = 'col-pri';
    var priTag = document.createElement('span');
    priTag.className = 'pri-tag';
    pri.appendChild(priTag);
    var call = document.createElement('span');
    call.className = 'col-call';
    var time = document.createElement('span');
    time.className = 'col-time';
    var type = document.createElement('span');
    type.className = 'col-type';
    var loc = document.createElement('span');
    loc.className = 'col-loc';
    var status = document.createElement('span');
    status.className = 'col-status';
    var statusTag = document.createElement('span');
    statusTag.className = 'status-tag';
    status.appendChild(statusTag);
    var unit = document.createElement('span');
    unit.className = 'col-unit';
    row.append(pri, call, time, type, loc, status, unit);
    return row;
  }

  function patchRow(row, inc, unitCallsign, now) {
    row.classList.remove('priority-1', 'priority-2', 'priority-3');
    row.classList.add('priority-' + inc.priority);
    row.querySelector('.pri-tag').textContent = 'P' + inc.priority;

    var callCell = row.querySelector('.col-call');
    var call = displayCall(inc.id);
    if (callCell.textContent !== call) callCell.textContent = call;

    var timeCell = row.querySelector('.col-time');
    timeCell.textContent = fmtElapsed(now - inc.createdAt);
    timeCell.classList.toggle('overdue', inc.status === 'pending' && now - inc.createdAt > 90000);

    var typeCell = row.querySelector('.col-type');
    if (typeCell.textContent !== inc.type) typeCell.textContent = inc.type;

    var locCell = row.querySelector('.col-loc');
    if (locCell.textContent !== inc.location) locCell.textContent = inc.location;

    var statusClass = 'status-' + (inc.status === 'closed' ? 'cleared' : inc.status);
    if (!row.classList.contains(statusClass)) {
      row.classList.remove('status-pending', 'status-dispatched', 'status-onscene', 'status-cleared');
      row.classList.add(statusClass);
      pulse(row.querySelector('.col-status'));
    }
    row.querySelector('.status-tag').textContent = STATUS_LABEL[inc.status];

    var unitCell = row.querySelector('.col-unit');
    var unitTxt = unitCallsign || '—';
    if (unitCell.textContent !== unitTxt) {
      unitCell.textContent = unitTxt;
      pulse(unitCell);
    }
    unitCell.classList.toggle('unassigned', !unitCallsign);
  }

  function renderEmpty() {
    var wrap = document.createElement('div');
    wrap.className = 'queue-empty';
    var mark = document.createElement('div');
    mark.className = 'empty-mark';
    var title = document.createElement('div');
    title.className = 'empty-title';
    title.textContent = 'QUEUE CLEAR';
    var sub = document.createElement('div');
    sub.className = 'empty-sub';
    sub.textContent = 'No active incidents. All units available.';
    wrap.append(mark, title, sub);
    queueEl.replaceChildren(wrap);
  }

  function renderIncidents(incidents, units, now) {
    var active = incidents.filter(function (i) { return i.status !== 'closed'; });
    var sorted = sortIncidents(active);

    if (sorted.length === 0) {
      if (!queueEl.querySelector('.queue-empty')) renderEmpty();
      return;
    }
    var empty = queueEl.querySelector('.queue-empty');
    if (empty) empty.remove();

    var unitByIncident = {};
    units.forEach(function (u) {
      if (u.assignedIncidentId) unitByIncident[u.assignedIncidentId] = u.callsign;
    });

    var seen = {};
    sorted.forEach(function (inc) {
      seen[inc.id] = true;
      var row = queueEl.querySelector('.incident-row[data-id="' + inc.id + '"]');
      var isNew = !row;
      if (isNew) row = buildRow(inc);
      patchRow(row, inc, unitByIncident[inc.id], now);
      queueEl.appendChild(row); // reorders existing nodes; no-op if already last-in-order
      if (isNew) {
        row.classList.remove('row-enter');
        void row.offsetWidth;
        row.classList.add('row-enter');
      }
    });

    var rows = queueEl.querySelectorAll('.incident-row');
    for (var i = 0; i < rows.length; i++) {
      if (!seen[rows[i].getAttribute('data-id')]) rows[i].remove();
    }
  }

  function buildUnit(u) {
    var el = document.createElement('div');
    el.className = 'unit';
    el.dataset.testid = 'unit-badge';
    el.dataset.id = u.id;
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    var top = document.createElement('div');
    top.className = 'unit-top';
    var id = document.createElement('span');
    id.className = 'unit-id';
    top.appendChild(id);
    var state = document.createElement('span');
    state.className = 'unit-state';
    var assign = document.createElement('span');
    assign.className = 'unit-assign';
    el.append(top, state, assign);
    return el;
  }

  function patchUnit(el, u, assignedCall) {
    el.querySelector('.unit-id').textContent = u.callsign;

    var stateClass = UNIT_STATE_CLASS[u.status] || 'u-available';
    if (!el.classList.contains(stateClass)) {
      el.classList.remove('u-available', 'u-dispatched', 'u-onscene', 'u-oos');
      el.classList.add(stateClass);
      el.classList.remove('state-change');
      void el.offsetWidth;
      el.classList.add('state-change');
    }
    el.querySelector('.unit-state').textContent = UNIT_STATE_LABEL[u.status] || u.status;

    var assign = el.querySelector('.unit-assign');
    if (assignedCall) {
      assign.textContent = '';
      var label = document.createTextNode('assigned ');
      var call = document.createElement('span');
      call.className = 'assign-call';
      call.textContent = assignedCall;
      assign.append(label, call);
    } else {
      assign.textContent = 'clear';
    }
  }

  function renderUnits(units, incidents) {
    var callById = {};
    incidents.forEach(function (i) { callById[i.id] = displayCall(i.id); });

    var seen = {};
    units.forEach(function (u) {
      seen[u.id] = true;
      var el = unitEl.querySelector('.unit[data-id="' + u.id + '"]');
      if (!el) {
        el = buildUnit(u);
        unitEl.appendChild(el);
      }
      patchUnit(el, u, u.assignedIncidentId ? callById[u.assignedIncidentId] : null);
    });
    var els = unitEl.querySelectorAll('.unit');
    for (var i = 0; i < els.length; i++) {
      if (!seen[els[i].getAttribute('data-id')]) els[i].remove();
    }
  }

  function setCount(el, val) {
    var cur = parseInt(el.textContent, 10);
    if (cur !== val) {
      el.textContent = val;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
    }
  }

  var lastState = { incidents: [], units: [] };

  /* ============================================================
     DETAIL PANEL — inspector drawer for a clicked incident/unit
     ============================================================ */
  var inspected = null; // { kind: 'incident'|'unit', id }
  var lastFocusEl = null;

  var STAGE_ORDER = [
    { key: 'createdAt', label: 'REPORTED' },
    { key: 'dispatchedAt', label: 'DISPATCHED' },
    { key: 'onSceneAt', label: 'ON SCENE' },
    { key: 'closedAt', label: 'CLEARED' },
  ];

  function fmtClock(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function markInspectedEls() {
    var rows = queueEl.querySelectorAll('.incident-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle(
        'is-inspected',
        !!inspected && inspected.kind === 'incident' && rows[i].getAttribute('data-id') === inspected.id,
      );
    }
    var units = unitEl.querySelectorAll('.unit');
    for (var j = 0; j < units.length; j++) {
      units[j].classList.toggle(
        'is-inspected',
        !!inspected && inspected.kind === 'unit' && units[j].getAttribute('data-id') === inspected.id,
      );
    }
  }

  function buildIncidentDetail(inc) {
    var callById = {};
    lastState.incidents.forEach(function (i) { callById[i.id] = displayCall(i.id); });
    var unitCallsign = null;
    lastState.units.forEach(function (u) {
      if (u.assignedIncidentId === inc.id) unitCallsign = u.callsign;
    });

    detailKicker.textContent = displayCall(inc.id);
    detailTitle.textContent = inc.type;

    var frag = document.createDocumentFragment();

    var tags = document.createElement('div');
    tags.className = 'detail-tags';
    var pri = document.createElement('span');
    pri.className = 'pri-tag detail-pri priority-' + inc.priority;
    pri.textContent = 'P' + inc.priority;
    var status = document.createElement('span');
    var statusClass = 'status-' + (inc.status === 'closed' ? 'cleared' : inc.status);
    status.className = 'status-tag detail-status ' + statusClass;
    status.textContent = STATUS_LABEL[inc.status];
    tags.append(pri, status);
    frag.appendChild(tags);

    var fields = document.createElement('dl');
    fields.className = 'detail-fields';
    [
      ['TYPE', inc.type],
      ['LOCATION', inc.location],
      ['ELAPSED', fmtElapsed(Date.now() - inc.createdAt)],
      ['ASSIGNED UNIT', unitCallsign || '—'],
    ].forEach(function (pair) {
      var dt = document.createElement('dt');
      dt.textContent = pair[0];
      var dd = document.createElement('dd');
      dd.textContent = pair[1];
      fields.append(dt, dd);
    });
    frag.appendChild(fields);

    var timeline = document.createElement('div');
    timeline.className = 'detail-timeline';
    var prevTs = null;
    STAGE_ORDER.forEach(function (stage) {
      var ts = inc[stage.key];
      if (!ts) return;
      var row = document.createElement('div');
      row.className = 'tl-row';
      var dot = document.createElement('span');
      dot.className = 'tl-dot';
      var label = document.createElement('span');
      label.className = 'tl-label';
      label.textContent = stage.label;
      var time = document.createElement('span');
      time.className = 'tl-time';
      time.textContent = fmtClock(ts);
      row.append(dot, label, time);
      if (prevTs !== null) {
        var delta = document.createElement('span');
        delta.className = 'tl-delta';
        delta.textContent = '+' + fmtElapsed(ts - prevTs);
        row.appendChild(delta);
      }
      timeline.appendChild(row);
      prevTs = ts;
    });
    frag.appendChild(timeline);

    detailBody.replaceChildren(frag);
  }

  function buildUnitDetail(u) {
    var call = null;
    var assignedInc = null;
    if (u.assignedIncidentId) {
      assignedInc = lastState.incidents.find(function (i) { return i.id === u.assignedIncidentId; });
      if (assignedInc) call = displayCall(assignedInc.id);
    }

    detailKicker.textContent = 'UNIT';
    detailTitle.textContent = u.callsign;

    var frag = document.createDocumentFragment();

    var tags = document.createElement('div');
    tags.className = 'detail-tags';
    var stateTag = document.createElement('span');
    stateTag.className = 'unit-state-tag ' + (UNIT_STATE_CLASS[u.status] || 'u-available');
    stateTag.textContent = UNIT_STATE_LABEL[u.status] || u.status;
    tags.appendChild(stateTag);
    frag.appendChild(tags);

    var fields = document.createElement('dl');
    fields.className = 'detail-fields';
    [
      ['CALLSIGN', u.callsign],
      ['STATUS', UNIT_STATE_LABEL[u.status] || u.status],
    ].forEach(function (pair) {
      var dt = document.createElement('dt');
      dt.textContent = pair[0];
      var dd = document.createElement('dd');
      dd.textContent = pair[1];
      fields.append(dt, dd);
    });
    frag.appendChild(fields);

    var assignment = document.createElement('div');
    assignment.className = 'detail-assignment';
    var head = document.createElement('div');
    head.className = 'da-head';
    head.textContent = 'ASSIGNMENT';
    assignment.appendChild(head);
    if (assignedInc) {
      var row = document.createElement('div');
      row.className = 'da-row';
      var callSpan = document.createElement('span');
      callSpan.className = 'da-call';
      callSpan.textContent = call;
      var typeSpan = document.createElement('span');
      typeSpan.className = 'da-type';
      typeSpan.textContent = assignedInc.type;
      var locSpan = document.createElement('span');
      locSpan.className = 'da-loc';
      locSpan.textContent = assignedInc.location;
      row.append(callSpan, typeSpan, locSpan);
      assignment.appendChild(row);
    } else {
      var empty = document.createElement('div');
      empty.className = 'da-empty';
      var none = document.createElement('span');
      none.className = 'da-none';
      none.textContent = 'NO ACTIVE ASSIGNMENT';
      empty.appendChild(none);
      assignment.appendChild(empty);
    }
    frag.appendChild(assignment);

    detailBody.replaceChildren(frag);
  }

  function buildGoneDetail(kind) {
    detailKicker.textContent = '';
    detailTitle.textContent = kind === 'incident' ? 'CALL CLEARED' : 'UNIT OFFLINE';
    var wrap = document.createElement('div');
    wrap.className = 'detail-gone';
    var mark = document.createElement('div');
    mark.className = 'dg-mark';
    var title = document.createElement('div');
    title.className = 'dg-title';
    title.textContent = kind === 'incident' ? 'CALL CLEARED FROM BOARD' : 'UNIT OFF ROSTER';
    var sub = document.createElement('div');
    sub.className = 'dg-sub';
    sub.textContent = 'This entity is no longer present on the board.';
    wrap.append(mark, title, sub);
    detailBody.replaceChildren(wrap);
  }

  function renderDetail() {
    if (!inspected) return;
    if (inspected.kind === 'incident') {
      var inc = lastState.incidents.find(function (i) { return i.id === inspected.id; });
      if (inc) buildIncidentDetail(inc);
      else buildGoneDetail('incident');
    } else {
      var u = lastState.units.find(function (x) { return x.id === inspected.id; });
      if (u) buildUnitDetail(u);
      else buildGoneDetail('unit');
    }
  }

  function openDetail(kind, id, triggerEl) {
    var isRetarget = !!inspected;
    inspected = { kind: kind, id: id };
    renderDetail();
    markInspectedEls();
    if (!isRetarget) {
      lastFocusEl = triggerEl || document.activeElement;
      detailPanel.hidden = false;
      detailPanel.classList.remove('is-open');
      void detailPanel.offsetWidth;
      detailPanel.classList.add('is-open');
      detailClose.focus();
    }
  }

  function closeDetail() {
    if (!inspected) return;
    inspected = null;
    markInspectedEls();
    detailPanel.classList.remove('is-open');
    detailPanel.hidden = true;
    if (lastFocusEl && document.contains(lastFocusEl)) {
      lastFocusEl.focus();
    } else if (reportBtn) {
      reportBtn.focus();
    }
    lastFocusEl = null;
  }

  function toggleDetail(kind, id, triggerEl) {
    if (inspected && inspected.kind === kind && inspected.id === id) {
      closeDetail();
    } else {
      openDetail(kind, id, triggerEl);
    }
  }

  queueEl.addEventListener('click', function (e) {
    var row = e.target.closest('.incident-row');
    if (!row) return;
    toggleDetail('incident', row.getAttribute('data-id'), row);
  });
  queueEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('.incident-row');
    if (!row) return;
    e.preventDefault();
    toggleDetail('incident', row.getAttribute('data-id'), row);
  });

  unitEl.addEventListener('click', function (e) {
    var el = e.target.closest('.unit');
    if (!el) return;
    toggleDetail('unit', el.getAttribute('data-id'), el);
  });
  unitEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest('.unit');
    if (!el) return;
    e.preventDefault();
    toggleDetail('unit', el.getAttribute('data-id'), el);
  });

  detailClose.addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inspected) closeDetail();
  });
  document.addEventListener('pointerdown', function (e) {
    if (!inspected || detailPanel.hidden) return;
    if (detailPanel.contains(e.target)) return;
    if (e.target.closest('.incident-row') || e.target.closest('.unit')) return;
    closeDetail();
  });

  function render(boardState) {
    lastState = boardState;
    var now = Date.now();
    renderIncidents(boardState.incidents, boardState.units, now);
    renderUnits(boardState.units, boardState.incidents);

    var active = boardState.incidents.filter(function (i) { return i.status !== 'closed'; }).length;
    var avail = boardState.units.filter(function (u) { return u.status === 'available'; }).length;
    setCount(activeEl, active);
    setCount(availEl, avail);
    if (qCountEl) qCountEl.textContent = active;
    if (uTotalEl) uTotalEl.textContent = boardState.units.length;

    markInspectedEls();
    renderDetail();
  }

  function setLink(ok) {
    if (!linkEl) return;
    linkEl.classList.toggle('link-down', !ok);
    if (linkLabelEl) linkLabelEl.textContent = ok ? 'LINK OK' : 'RECONNECTING';
  }

  function updateElapsed() {
    var now = Date.now();
    var rows = queueEl.querySelectorAll('.incident-row');
    for (var i = 0; i < rows.length; i++) {
      var id = rows[i].getAttribute('data-id');
      var inc = lastState.incidents.find(function (x) { return x.id === id; });
      if (!inc) continue;
      var cell = rows[i].querySelector('.col-time');
      cell.textContent = fmtElapsed(now - inc.createdAt);
      cell.classList.toggle('overdue', inc.status === 'pending' && now - inc.createdAt > 90000);
    }
    if (inspected && inspected.kind === 'incident') {
      var elapsedDd = detailBody.querySelector('.detail-fields dd:nth-of-type(3)');
      var inspectedInc = lastState.incidents.find(function (x) { return x.id === inspected.id; });
      if (elapsedDd && inspectedInc) elapsedDd.textContent = fmtElapsed(now - inspectedInc.createdAt);
    }
  }

  function updateClock() {
    if (!clockEl) return;
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    clockEl.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------- WebSocket connection ---------- */
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    var ws = new WebSocket(proto + '://' + location.host + '/ws');

    ws.addEventListener('open', function () { setLink(true); });

    ws.addEventListener('message', function (event) {
      var msg = JSON.parse(event.data);
      if (msg.type === 'state') render(msg.state);
    });

    ws.addEventListener('close', function () {
      setLink(false);
      setTimeout(connect, 1000);
    });

    reportBtn.onclick = function () {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'reportIncident',
          incidentType: 'Visitor Reported Incident',
          location: 'Portfolio Demo',
          priority: 1,
        }),
      );
    };
  }

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(updateElapsed, 1000);
  connect();
})();
