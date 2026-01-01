/* ---------- Utilities ---------- */


function formatTime(ms) {
    const hours = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const minutes = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const milliseconds = (ms % 1000).toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function getMajorityTimezone(members) {
    if (!members.length) return null;
    const counts = {};
    members.forEach(m => counts[m.timezone] = (counts[m.timezone] || 0) + 1);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    // If tie between top two, handling it simply by picking first
    if (!sorted.length) return null;
    return sorted[0][0];
}

function formatTimeByLocale(date, locale, options) {
    try {
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (e) {
        console.error("Date formatting error:", e);
        return date.toLocaleTimeString();
    }
}

/* ---------- ROOM NAVIGATION ---------- */

async function createRoom() {
    const name = document.getElementById("name").value.trim();
    const userCode = document.getElementById("roomCode").value.trim();

    if (!name) return alert("Please enter your name.");

    try {
        const res = await fetch("http://localhost:8080/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: userCode || undefined })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to create room");
        }

        const data = await res.json();
        const code = data.code;

        // Redirect using URL parameters
        window.location.href = `room.html?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`;
    } catch (err) {
        alert(err.message);
    }
}

function joinRoom() {
    const name = document.getElementById("name").value.trim();
    const roomCode = document.getElementById("roomCode").value.trim().toUpperCase();

    if (!name) return alert("Please enter your name.");
    if (!roomCode) return alert("Please enter a room code to join.");

    // Redirect using URL parameters
    window.location.href = `room.html?code=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(name)}`;
}

/* ---------- ROOM PAGE LOGIC ---------- */

async function initRoomPage() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const name = params.get("name");

    if (!code || !name) {
        alert("Missing room information. Redirecting to home.");
        window.location.href = "index.html";
        return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language;

    // Generate a temporary ID for this session if we don't assume persistence
    // For this refactor, we can let the server assign one or generate one here.
    // The server code expects a memberId to be sent if rejoining, or it assigns a new one.
    // Since we are moving away from local storage, every refresh might be a "new join" unless we store ID in URL?
    // The user asked to remove cookies/storage. If we refresh, we re-join as a new member if we don't persist ID.
    // FOR USER REQUEST: "get rid of all the cookie saving". 
    // This implies ephemeral membership. Refreshing page = Re-joining.

    try {
        const res = await fetch(`http://localhost:8080/rooms/${code}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // We won't send an existing memberId, effectively treating every load as unique or new.
            body: JSON.stringify({ name, timezone, locale })
        });

        if (!res.ok) {
            alert("Failed to join room or room does not exist.");
            window.location.href = "index.html";
            return;
        }

        const responseData = await res.json();
        // Server now returns { member, roomState }
        // Handle backward compatibility if server wasn't updated (though we just updated it)
        const member = responseData.member || responseData;
        const roomState = responseData.roomState || null;

        setupRoomUI(code, member, roomState);
    } catch (err) {
        console.error(err);
        alert("Error connecting to server. Check console for details.");
        window.location.href = "index.html";
    }
}

function setupRoomUI(code, currentMember, initialRoomState) {
    console.log("Setting up UI for", currentMember.name, "in room", code);

    const stopwatchEl = document.getElementById("stopwatch");
    const memberListEl = document.getElementById("member-list");
    const localTimeEl = document.getElementById("local-time");
    const majorityTimeEl = document.getElementById("majority-time");
    const gmtTimeEl = document.getElementById("gmt-time");
    const roomCodeEl = document.getElementById("room-code-value");
    const leaveBtn = document.getElementById("leaveRoom");

    if (roomCodeEl) roomCodeEl.textContent = code;

    if (leaveBtn) {
        leaveBtn.addEventListener("click", () => {
            leaveRoom(code, currentMember.id);
        });
    }

    // SSE Connection
    const sseUrl = `http://localhost:8080/events?code=${code}&memberId=${currentMember.id}`;
    console.log("Connecting SSE:", sseUrl);
    const evtSource = new EventSource(sseUrl);

    let roomCreatedAt = initialRoomState ? initialRoomState.createdAt : null;
    const members = new Map();

    // Initialize members from initial state if available
    if (initialRoomState && initialRoomState.members) {
        initialRoomState.members.forEach(m => members.set(m.id, m));
    }

    // -- UI Updaters --

    function updateTopBar() {
        const now = new Date();

        // Local Time
        if (localTimeEl) {
            localTimeEl.textContent = `Local: ${formatTimeByLocale(now, navigator.language, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        }

        // Majority Time
        if (majorityTimeEl) {
            const memberList = Array.from(members.values());
            const majority = getMajorityTimezone(memberList);
            if (majority) {
                majorityTimeEl.textContent = `Majority: ${formatTimeByLocale(now, "en-US", { timeZone: majority, hour: "2-digit", minute: "2-digit", second: "2-digit" })} (${majority})`;
            } else {
                majorityTimeEl.textContent = "Majority: Calculating...";
            }
        }

        // GMT Time
        if (gmtTimeEl) {
            gmtTimeEl.textContent = `GMT: ${formatTimeByLocale(now, "en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
        }
    }

    function updateMemberList() {
        if (!memberListEl) return;
        memberListEl.innerHTML = "";

        members.forEach(m => {
            const li = document.createElement("li");

            // Calculate time since they joined
            const elapsed = Date.now() - m.joinedAt;

            // Their local time (based on their declared locale/timezone)
            let userLocalTime = "Unknown";
            try {
                // If they provided a timezone, we can show what time it is for THEM.
                if (m.timezone) {
                    userLocalTime = new Date().toLocaleTimeString("en-US", { timeZone: m.timezone, hour: '2-digit', minute: '2-digit' });
                }
            } catch (e) {
                console.error("Error formatting member time", e);
            }

            li.textContent = `${m.name} (${userLocalTime}) - On for ${formatTime(elapsed)}`;
            if (m.id === currentMember.id) {
                li.style.fontWeight = "bold";
                li.textContent += " (You)";
            }
            memberListEl.appendChild(li);
        });
    }

    // -- Event Handlers --

    evtSource.addEventListener("init", e => {
        const data = JSON.parse(e.data);
        roomCreatedAt = data.createdAt;

        members.clear();
        data.members.forEach(m => members.set(m.id, m));

        updateMemberList();
        updateTopBar();
    });

    evtSource.addEventListener("member-joined", e => {
        console.log("SSE: Member Joined", e.data);
        const m = JSON.parse(e.data);
        members.set(m.id, m);
        updateMemberList();
        updateTopBar();
    });

    // Initial render if we have state
    if (initialRoomState) {
        updateMemberList();
        updateTopBar();
    }

    evtSource.addEventListener("member-left", e => {
        const { memberId } = JSON.parse(e.data);
        members.delete(memberId);
        updateMemberList();
        updateTopBar();
    });

    evtSource.onerror = (err) => {
        console.error("SSE Error:", err);
        // Optional: Attempt reconnect or warn user
    };

    // -- Loop --
    function tick() {
        updateTopBar();

        if (roomCreatedAt && stopwatchEl) {
            const elapsed = Date.now() - roomCreatedAt;
            stopwatchEl.textContent = formatTime(elapsed);
        }

        // Also update member list "time online" counters
        updateMemberList();

        requestAnimationFrame(tick);
    }

    // Start the loop
    requestAnimationFrame(tick);
}

async function leaveRoom(code, memberId) {
    try {
        // Beacon is better for unload, but fetch works for explicit clicks
        await fetch(`http://localhost:8080/rooms/${code}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId })
        });
    } catch (e) {
        console.error(e);
    }
    window.location.href = "index.html";
}

/* ---------- DOM INITIALIZATION ---------- */

document.addEventListener("DOMContentLoaded", () => {
    // Check which page we are on
    if (document.getElementById("createRoom")) {
        // Index Page
        const createBtn = document.getElementById("createRoom");
        const joinBtn = document.getElementById("joinRoom");

        if (createBtn) createBtn.addEventListener("click", createRoom);
        if (joinBtn) joinBtn.addEventListener("click", joinRoom);

    } else if (document.getElementById("stopwatch")) {
        // Room Page
        initRoomPage();
    }
});
