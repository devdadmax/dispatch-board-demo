# Live Dispatch Board

A simulated real-time CAD (computer-aided dispatch) board built on Cloudflare
Workers and Durable Objects — part of an ongoing series of small, deployable
showcase projects at [hardenwallace.dev](https://hardenwallace.dev/projects).

Most of my real work in this domain (public-safety dispatch systems, ~2013-2021)
is under NDA. This project uses entirely synthetic data to demonstrate the same
kind of system: real-time state management, priority-based triage, and
mission-critical UX, without exposing any client work.

## How it works

- A single Durable Object (`DispatchBoard`) holds all state in memory and in
  `ctx.storage`: a roster of units and a queue of incidents.
- A self-rescheduling `alarm()` loop ticks every few seconds, spawning
  incidents, triaging by priority, and advancing units through
  available → enroute → onscene → clear.
- Browser clients connect over a WebSocket and receive the full board state on
  every change — no polling.
- Click **Report Incident** to inject your own incident and watch it get
  triaged and dispatched live.

## Stack

Cloudflare Workers, Durable Objects (SQLite-backed storage), native
WebSockets, Vitest, Playwright.

## Local development

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test:unit   # pure triage/dispatch/lifecycle logic
npm run test:e2e    # full browser flow against wrangler dev
```
