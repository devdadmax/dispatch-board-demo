function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state') render(msg.state);
  });

  ws.addEventListener('close', () => setTimeout(connect, 1000));

  document.getElementById('report-incident').onclick = () => {
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

function makeRow(tag, testId, className, fields) {
  const el = document.createElement(tag);
  el.dataset.testid = testId;
  if (className) el.className = className;
  for (const text of fields) {
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
  }
  return el;
}

function render(boardState) {
  const queue = document.getElementById('incident-queue');
  queue.replaceChildren(
    ...boardState.incidents
      .filter((i) => i.status !== 'closed')
      .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)
      .map((i) => makeRow('li', 'incident-row', `priority-${i.priority}`, [i.type, i.location, i.status])),
  );

  const units = document.getElementById('unit-board');
  units.replaceChildren(
    ...boardState.units.map((u) => makeRow('div', 'unit-badge', 'unit', [u.callsign, u.status])),
  );

  document.getElementById('active-count').textContent = boardState.incidents.filter(
    (i) => i.status !== 'closed',
  ).length;
  document.getElementById('available-count').textContent = boardState.units.filter(
    (u) => u.status === 'available',
  ).length;
}

connect();
