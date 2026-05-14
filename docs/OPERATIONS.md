# Operations Runbook

## 1. Service Startup

### Signaling server

```bash
cd server
pnpm dev
```

Production-style launch:

```bash
cd server
pnpm build
PORT=8080 HEARTBEAT_INTERVAL_MS=15000 IDLE_TIMEOUT_MS=45000 pnpm start
```

### Electron client

```bash
cd client
pnpm dev
```

## 2. Health Check

Endpoint:

```bash
curl http://localhost:8080/healthz
```

Expected response shape:

```json
{
  "status": "ok",
  "uptimeSec": 123,
  "totalRooms": 1,
  "totalPeers": 2,
  "pairedRooms": 1
}
```

## 3. Runtime Signals and Shutdown

The signaling server handles:
- `SIGINT`
- `SIGTERM`

Behavior:
- stop heartbeat loop
- close WebSocket server
- close HTTP server
- exit gracefully

## 4. Log Semantics

Server logs are JSON lines with:
- `ts`
- `level`
- `message`
- contextual fields (room ID, peer role, socket ID, etc.)

Typical events:
- websocket connect/disconnect
- peer join/pair
- validation errors
- stale socket eviction
- shutdown sequence

## 5. Permission Requirements (Host Native Control)

For real native control on Host:
- macOS: Accessibility permission is required.
- screen capture generally also requires Screen Recording permission.

If unavailable, the client automatically falls back to mock mode and continues streaming/signaling.

## 6. Known Operational Risks

- No TURN in default setup; connectivity may fail in restrictive NAT/firewall environments.
- In-memory room state means server restarts drop active sessions.
- Single-machine Host+Viewer testing can cause local input contention.

## 7. Recommended Production Hardening

- Deploy TURN and configure ICE policy.
- Terminate TLS and expose secure signaling endpoint (`wss://`).
- Add room access token validation and expiration.
- Add per-room rate limiting and abuse controls.
- Add centralized logging + metrics dashboards.
