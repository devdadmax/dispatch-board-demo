import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import type { BoardState, IncidentPriority } from './types';
import { createInitialState, reportIncident, tick } from './simulation';

const TICK_MS = 3000;
const STORAGE_KEY = 'board-state';

const RANDOM_INCIDENTS: Array<{ type: string; location: string; priority: IncidentPriority }> = [
  { type: 'Structure Fire', location: '412 Maple St', priority: 1 },
  { type: 'Vehicle Collision', location: 'I-40 Mile Marker 12', priority: 2 },
  { type: 'Medical Emergency', location: '88 River Rd', priority: 1 },
  { type: 'Alarm Activation', location: '900 Commerce Dr', priority: 3 },
  { type: 'Welfare Check', location: '215 Oak Ave', priority: 3 },
  { type: 'Domestic Disturbance', location: '77 Pine Ln', priority: 2 },
];

const VISITOR_INCIDENT = {
  type: 'Visitor Reported Incident',
  location: 'Portfolio Demo',
  priority: 1 as IncidentPriority,
};

const MAX_OPEN_INCIDENTS = 6;

interface ClientMessage {
  type: string;
}

export class DispatchBoard extends DurableObject<Env> {
  private sessions = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sessions.add(server);

    const state = await this.getState();
    server.send(JSON.stringify({ type: 'state', state }));

    server.addEventListener('message', (event) => this.handleMessage(event));
    server.addEventListener('close', () => this.sessions.delete(server));
    server.addEventListener('error', () => this.sessions.delete(server));

    await this.ensureAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    let state = await this.getState();

    const openIncidents = state.incidents.filter((i) => i.status !== 'closed').length;
    if (openIncidents < MAX_OPEN_INCIDENTS && Math.random() < 0.4) {
      const pick = RANDOM_INCIDENTS[Math.floor(Math.random() * RANDOM_INCIDENTS.length)];
      state = reportIncident(state, { id: crypto.randomUUID(), ...pick }, Date.now());
    }

    state = tick(state, Date.now());
    await this.saveState(state);
    this.broadcast(state);

    // No point re-arming the alarm if nobody's watching — fetch() re-arms on the next connect.
    if (this.sessions.size > 0) {
      await this.ensureAlarm();
    }
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (typeof event.data !== 'string') return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    // Every field of the injected incident is server-chosen — we never trust
    // client-supplied strings into broadcast state (they'd render via
    // innerHTML in every connected browser, so this isn't just tidiness).
    if (msg.type !== 'reportIncident') return;

    const state = await this.getState();
    const openIncidents = state.incidents.filter((i) => i.status !== 'closed').length;
    if (openIncidents >= MAX_OPEN_INCIDENTS + 2) return; // absorb spam-clicking without unbounded growth

    const updated = reportIncident(state, { id: crypto.randomUUID(), ...VISITOR_INCIDENT }, Date.now());
    await this.saveState(updated);
    this.broadcast(updated);
  }

  private async getState(): Promise<BoardState> {
    const stored = await this.ctx.storage.get<BoardState>(STORAGE_KEY);
    if (stored) return stored;
    const fresh = createInitialState();
    await this.saveState(fresh);
    return fresh;
  }

  private async saveState(state: BoardState): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, state);
  }

  private broadcast(state: BoardState): void {
    const payload = JSON.stringify({ type: 'state', state });
    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch {
        this.sessions.delete(session);
      }
    }
  }

  private async ensureAlarm(): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null) {
      await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    }
  }
}
