import http from "http";
import crypto from "crypto";

const PORT = 8080;
const rooms = new Map();

/* ---------- Helpers ---------- */

function log(...args) {
    console.log(new Date().toISOString(), "-", ...args);
}

function setCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:8000");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendSSE(res, event, data) {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
        log(`[SSE ERROR] Failed to send event ${event}: ${err.message}`);
        // If write fails, the stream is likely dead. usage of this function inside broadcast loop
        // implies we might want to clean it up, but the close handler should handle it.
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

/* ---------- Server ---------- */

const server = http.createServer((req, res) => {
    setCORS(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    /* ---------- SSE ---------- */
    if (req.method === "GET" && url.pathname === "/events") {
        const code = url.searchParams.get("code");
        const memberId = url.searchParams.get("memberId");
        const room = rooms.get(code);

        if (!room) {
            log(`[SSE] Room not found: ${code}`);
            res.writeHead(404);
            res.end();
            return;
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
            code: room.code,
            members: [...room.members.values()]
        });

        req.on("close", () => {
            log(`[SSE] Client disconnected from room ${code}`);
            room.streams.delete(res);

            // If a memberId was provided, remove them from the room
            if (memberId && room.members.has(memberId)) {
                const member = room.members.get(memberId);
                room.members.delete(memberId);
                log(`[ROOM ${code}] Member removed due to disconnect: ${member.name}`);
                broadcast(room, "member-left", { memberId });
            }

            // Cleanup empty room
            if (room.members.size === 0 && room.streams.size === 0) {
                log(`[CLEANUP] Deleting empty room ${code}`);
                rooms.delete(code);
            }
        });

        return;
    }

    /* ---------- CREATE ROOM ---------- */
    if (req.method === "POST" && url.pathname === "/rooms") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            let { roomCode } = body ? JSON.parse(body) : {};

            if (!roomCode) {
                roomCode = generateRoomCode();
            } else {
                roomCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
                if (!roomCode) roomCode = generateRoomCode();
            }

            if (rooms.has(roomCode)) {
                log(`[CREATE FAILED] Room code already exists: ${roomCode}`);
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Room code already exists" }));
            }

            rooms.set(roomCode, {
                code: roomCode,
                createdAt: Date.now(),
                members: new Map(),
                streams: new Set()
            });

            log(`[ROOM CREATED] ${roomCode}`);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ code: roomCode, createdAt: Date.now() }));
        });

        return;
    }

    /* ---------- JOIN ROOM ---------- */
    if (req.method === "POST" && url.pathname.match(/^\/rooms\/.+\/join$/)) {
        const code = url.pathname.split("/")[2];
        const room = rooms.get(code);

        if (!room) {
            log(`[JOIN FAILED] Room not found: ${code}`);
            res.writeHead(404);
            res.end();
            return;
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            const { memberId, name, timezone, locale } = JSON.parse(body);

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

            // Return member AND current room state so client can init immediately without waiting for SSE
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                member,
                roomState: {
                    code: room.code,
                    createdAt: room.createdAt,
                    members: [...room.members.values()]
                }
            }));
        });

        return;
    }

    /* ---------- LEAVE ROOM ---------- */
    if (req.method === "POST" && url.pathname.match(/^\/rooms\/.+\/leave$/)) {
        const code = url.pathname.split("/")[2];
        const room = rooms.get(code);

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            const { memberId } = JSON.parse(body);

            if (room && room.members.has(memberId)) {
                const member = room.members.get(memberId);
                room.members.delete(memberId);

                log(`[ROOM ${code}] Member left: ${member.name} (${memberId})`);

                broadcast(room, "member-left", { memberId });
            }

            res.writeHead(204);
            res.end();
        });

        return;
    }

    log(`[404] ${req.method} ${url.pathname}`);
    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    log(`Server running at http://localhost:${PORT}`);
});
