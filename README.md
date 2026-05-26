# Time Room

A real-time, high-precision collaborative timing application. Create or join a shared room to track time together across different timezones.

**Version:** 1.3.3-p

---

## Quick summary

- Synchronized shared stopwatch with millisecond precision
- Schedule future starts with timezone-aware interpretation
- Real-time updates over Server-Sent Events (SSE)
- Per-user local time display and majority-timezone calculation

---

## Project layout

All frontend assets live under `static/` and the server is `server.js` at the repository root.

```text
.
├── Dockerfile
├── README.md
├── package.json
├── package-lock.json
├── server.js          # Express server (API + static)
└── static/            # Frontend static files
    ├── index.html
    ├── room.html
    ├── script.js
    └── style.css
```

---

## Run locally

1. From the project root, install dependencies and start the server:

```bash
npm install
npm start
```

2. Open `http://localhost:3000` in your browser.

---

## Docker (prebuilt images)

Prebuilt images are published to container registries; you do not need to build the image locally. Example pull/run commands:

GitHub Container Registry (GHCR):

```bash
docker pull ghcr.io/maskedmatters/timesync:latest
docker run -p 3000:3000 ghcr.io/maskedmatters/timesync:latest
```

Docker Hub:

```bash
docker pull maskedmatters/timesync:latest
docker run -p 3000:3000 maskedmatters/timesync:latest
```

Note: the published image includes metadata labels such as `org.opencontainers.image.description`.

---

## Developer notes

- Real-time events: `/events` (SSE)
- API endpoints: `/rooms`, `/rooms/:code/join`, `/rooms/:code/reset`, `/rooms/:code/leave`, `/dst-stats`
- The schedule input (`datetime-local`) is interpreted as the selected timezone when setting a scheduled start.
