/** WebSocket lifecycle: connect/reconnect, link-status indicator, and the report-incident button. */
const linkEl = document.getElementById('link-status');
const linkLabelEl = linkEl ? linkEl.querySelector('.link-label') : null;
const reportBtn = document.getElementById('report-incident');

function setLink(ok) {
  if (!linkEl) return;
  linkEl.classList.toggle('link-down', !ok);
  if (linkLabelEl) linkLabelEl.textContent = ok ? 'LINK OK' : 'RECONNECTING';
}

/** @param {(boardState: import('./state.js').BoardState) => void} onState */
export function connect(onState) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.addEventListener('open', () => setLink(true));

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state') onState(msg.state);
  });

  ws.addEventListener('close', () => {
    setLink(false);
    setTimeout(() => connect(onState), 1000);
  });

  reportBtn.onclick = () => {
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
