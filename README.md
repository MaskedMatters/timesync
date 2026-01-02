# Time Room

A real-time, high-precision collaborative timing application. Create or join a shared room to track time together across different timezones.

**Version:** 1.2.1-p

## Features

- **Shared Stopwatch**: A synchronized timer that starts the moment a room is created.
- **Timer Controls**: Reset the timer instantly or **schedule a future start time** with timezone precision.
- **Smart Continuity**: A sub-stopwatch automatically tracks elapsed time since the *previous* reset during countdowns, ensuring no data is lost.
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
  - Node.js environment
  - **Express.js** framework
  - Serves both API and Static Files

## Directory Structure

```text
├── backend/
│   ├── server.js      # Express Server (API + Static Serving)
│   ├── package.json   # Project configuration
│   └── package-lock.json
├── index.html         # Landing page (Create/Join)
├── room.html          # Dynamic room view
├── script.js          # Core frontend logic
└── style.css          # Modern dark-mode styling
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed on your machine.

### 1. Launch the Server

Navigate to the `backend` directory, install dependencies, and start the server:

```powershell
cd backend
npm install
npm start
```

### 2. Access the App

Open your browser to `http://localhost:3000`.

The backend (Express) serves the frontend static files automatically, so there is no need to run a separate frontend server.

### 3. Docker Deployment (Alternative)

You can run the application instantly using the pre-built Docker image:

```bash
docker run -p 3000:3000 maskedmatters/timesync:v1.2.1-p
```

The app will be available at `http://localhost:3000`.

## How it Works

### Real-Time Sync
The app uses **Server-Sent Events (SSE)**. When a client joins a room, it establishes a persistent connection to `/events`. The server pushes updates whenever:
- A new member joins.
- A member leaves.
- A member disconnects (detected via the `close` event on the SSE stream).
- The timer is manually reset or scheduled (broadcasts `timer-update`).

### High Precision Rendering
Unlike standard timers that use `setInterval(..., 1000)`, Time Room uses `requestAnimationFrame`. This allows the stopwatch to render milliseconds smoothly and ensures the clocks are always accurate to the system time without "drifting."

### URL-Based State
By using URL parameters (`?code=ROOM_ID&name=USER_NAME`), the application is completely stateless on the client's side. Refreshing the page simply re-joins the session using the data in the URL.
