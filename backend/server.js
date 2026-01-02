import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
const rooms = new Map();

/* ---------- Helpers ---------- */

function log(...args) {
    console.log(new Date().toISOString(), "-", ...args);
}

function sendSSE(res, event, data) {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
        log(`[SSE ERROR] Failed to send event ${event}: ${err.message}`);
    }
}

function broadcast(room, event, data) {
    log(`[ROOM ${room.code}] Broadcasting event: ${event}`);
    for (const res of room.streams) {
        sendSSE(res, event, data);
    }
}

function generateRoomCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/* ---------- Middleware ---------- */

app.use(express.json());

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, "..")));

/* ---------- SSE Endpoint ---------- */

app.get("/events", (req, res) => {
    const { code, memberId } = req.query;
    const room = rooms.get(code);

    if (!room) {
        log(`[SSE] Room not found: ${code}`);
        return res.status(404).end();
    }

    log(`[SSE] Client connected to room ${code} (Member: ${memberId || "Unknown"})`);

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });

    room.streams.add(res);

    sendSSE(res, "init", {
        createdAt: room.createdAt,
        startTime: room.startTime,
        previousStartTime: room.previousStartTime,
        code: room.code,
        members: [...room.members.values()]
    });

    req.on("close", () => {
        log(`[SSE] Client disconnected from room ${code}`);
        room.streams.delete(res);

        if (memberId && room.members.has(memberId)) {
            const member = room.members.get(memberId);
            room.members.delete(memberId);
            log(`[ROOM ${code}] Member removed due to disconnect: ${member.name}`);
            broadcast(room, "member-left", { memberId });
        }

        if (room.members.size === 0 && room.streams.size === 0) {
            log(`[CLEANUP] Deleting empty room ${code}`);
            rooms.delete(code);
        }
    });
});

/* ---------- API Endpoints ---------- */

// Create Room
app.post("/rooms", (req, res) => {
    let { roomCode } = req.body;

    if (!roomCode) {
        roomCode = generateRoomCode();
    } else {
        roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!roomCode) roomCode = generateRoomCode();
    }

    if (rooms.has(roomCode)) {
        log(`[CREATE FAILED] Room code already exists: ${roomCode}`);
        return res.status(400).json({ error: "Room code already exists" });
    }

    rooms.set(roomCode, {
        code: roomCode,
        createdAt: Date.now(),
        startTime: Date.now(), // Default start time is creation time
        previousStartTime: Date.now(), // Track previous reset for sub-timer
        members: new Map(),
        streams: new Set()
    });

    log(`[ROOM CREATED] ${roomCode}`);
    res.json({ code: roomCode, createdAt: Date.now() });
});

// Join Room
app.post("/rooms/:code/join", (req, res) => {
    const { code } = req.params;
    const room = rooms.get(code);

    if (!room) {
        log(`[JOIN FAILED] Room not found: ${code}`);
        return res.status(404).end();
    }

    const { memberId, name, timezone, locale } = req.body;
    let member;

    if (memberId && room.members.has(memberId)) {
        member = room.members.get(memberId);
        log(`[ROOM ${code}] Reconnected member ${member.name} (${member.id})`);
    } else {
        member = {
            id: crypto.randomUUID(),
            name,
            timezone,
            locale,
            joinedAt: Date.now()
        };

        room.members.set(member.id, member);
        log(`[ROOM ${code}] New member joined: ${name} (${member.id})`);

        broadcast(room, "member-joined", member);
    }

    res.json({
        member,
        roomState: {
            code: room.code,
            createdAt: room.createdAt,
            startTime: room.startTime,
            previousStartTime: room.previousStartTime,
            members: [...room.members.values()]
        }
    });
});

// Reset Timer
app.post("/rooms/:code/reset", (req, res) => {
    const { code } = req.params;
    const room = rooms.get(code);
    const { startTime } = req.body;

    if (!room) return res.status(404).end();

    const now = Date.now();
    const currentStart = Number(room.startTime);

    // Only update previousStartTime if the CURRENT timer is NOT a future countdown.
    // Logic: If room.startTime is in the past (<= now), it means the previous countdown FINISHED.
    // So we "bank" that finish time as the new 'previousStartTime'.

    const isExpired = currentStart <= now;

    if (isExpired) {
        room.previousStartTime = currentStart;
    }

    // If startTime is provided, use it. Otherwise reset to NOW.
    room.startTime = startTime || now;

    log(`[ROOM ${code}] Timer reset to ${new Date(room.startTime).toISOString()}`);
    broadcast(room, "timer-update", { startTime: room.startTime, previousStartTime: room.previousStartTime });

    res.json({ startTime: room.startTime });
});

// Leave Room
app.post("/rooms/:code/leave", (req, res) => {
    const { code } = req.params;
    const room = rooms.get(code);
    const { memberId } = req.body;

    if (room && room.members.has(memberId)) {
        const member = room.members.get(memberId);
        room.members.delete(memberId);

        log(`[ROOM ${code}] Member left: ${member.name} (${memberId})`);
        broadcast(room, "member-left", { memberId });
    }

    res.status(204).end();
});

app.listen(PORT, () => {
    log(`Server running at http://localhost:${PORT}`);
});
