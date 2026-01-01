# Time Room

A real-time, high-precision collaborative timing application. Create or join a shared room to track time together across different timezones.

**Version:** 1.0.0

## Features

- **Shared Stopwatch**: A synchronized timer that starts the moment a room is created.
- **High Precision**: UI updates at ~60fps using `requestAnimationFrame` for a smooth, lag-free experience.
- **Collaborative Member List**: Track who is in the room and how long they've been active.
- **Timezone Intelligence**: Shows Local time, GMT, and calculates the **Majority Timezone** of all members in the room.
- **Ephemeral Sessions**: State is managed via URL parameters—no cookies or local storage required.
- **Auto-Cleanup**: The server automatically removes disconnected members and deletes empty rooms to stay lean.

## Technology Stack

- **Frontend**: 
  - Pure HTML5 / Semantic Layout
  - Vanilla CSS (Glassmorphism & Radial Gradients)
  - Vanilla JavaScript
  - Server-Sent Events (SSE) for real-time updates
- **Backend**:
  - Node.js (Standard `http` module)
  - No external dependencies (Zero NPM installs required for the app itself)

## Directory Structure

```text
├── backend/
│   ├── server.js      # Node.js HTTP & SSE Server
│   └── package.json   # Project configuration
├── index.html         # Landing page (Create/Join)
├── room.html          # Dynamic room view
├── script.js          # Core frontend logic
└── style.css          # Modern dark-mode styling
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine.
- A local server to host the frontend (or just open `index.html` in a browser, though some browsers block CORS on `file://` protocols).

### 1. Launch the Backend

Navigate to the `backend` directory and start the server:

```powershell
cd backend
npm run start
```

The server will be running at `http://localhost:8080`.

### 2. Launch the Frontend

You can use any light HTTP server. For example, using Python:

```powershell
# In the root project directory
python -m http.server 8000
```

Open your browser to `http://localhost:8000`.

## How it Works

### Real-Time Sync
The app uses **Server-Sent Events (SSE)**. When a client joins a room, it establishes a persistent connection to `/events`. The server pushes updates whenever:
- A new member joins.
- A member leaves.
- A member disconnects (detected via the `close` event on the SSE stream).

### High Precision Rendering
Unlike standard timers that use `setInterval(..., 1000)`, Time Room uses `requestAnimationFrame`. This allows the stopwatch to render milliseconds smoothly and ensures the clocks are always accurate to the system time without "drifting."

### URL-Based State
By using URL parameters (`?code=ROOM_ID&name=USER_NAME`), the application is completely stateless on the client's side. Refreshing the page simply re-joins the session using the data in the URL.
