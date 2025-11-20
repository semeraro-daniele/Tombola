const express = require("express");
const path = require("path");
const app = express();
const server = require("http").createServer(app);

const io = require("socket.io")(server, {
  cors: { origin: "*" },
  path: "/socket.io"
});

const rooms = {};

function generateRoomCode(len = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * startAutoDraw: avvia l'auto-draw per la stanza indicata
 * - legge room.drawIntervalMs
 * - evita multipli setInterval
 * - si ferma quando tutti i numeri sono estratti
 */
function startAutoDraw(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  if (room.autoDrawInterval) {
    console.log(`⚠️ AutoDraw already running in room ${roomCode}`);
    return;
  }

  if (!room.gameStarted) {
    console.log(`⚠️ Cannot start autodraw: game not started for room ${roomCode}`);
    return;
  }

  console.log(`🚀 Starting auto-draw for room ${roomCode} (interval ${room.drawIntervalMs}ms)`);

  const intervalMs = room.drawIntervalMs || 3000;

  room.autoDrawInterval = setInterval(() => {
    if (!rooms[roomCode]) {
      clearInterval(room.autoDrawInterval);
      return;
    }

    if (room.paused) {
      return;
    }

    if (room.extracted.length >= 90) {
      clearInterval(room.autoDrawInterval);
      room.autoDrawInterval = null;
      console.log(`🏁 All numbers extracted in room ${roomCode}`);
      io.to(roomCode).emit("gameEnded");
      return;
    }

    let num;
    do {
      num = Math.floor(Math.random() * 90) + 1;
    } while (room.extracted.includes(num));

    room.extracted.push(num);
    io.to(roomCode).emit("numberDrawn", num);
  }, intervalMs);
}

/**
 * startGame: avvia lo stato di gioco per la stanza
 * - imposta room.gameStarted = true
 * - avvia auto-draw se richiesto (room.autoStart true)
 * - emette "gameStarted" nello room
 */
function startGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return false;

  if (room.gameStarted) {
    console.log(`⚠️ Game already started for room ${roomCode}`);
    return false;
  }

  room.gameStarted = true;
  console.log(`🎮 Game started in room ${roomCode}`);

  startAutoDraw(roomCode);

  io.to(roomCode).emit("gameStarted");
  return true;
}

// Helper: build state object to return to clients
function buildRoomStateForClient(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;
  return {
    roomCode,
    ok: true,
    hostId: room.hostId,
    players: room.players,
    extracted: room.extracted,
    gameStarted: room.gameStarted,
    drawIntervalMs: room.drawIntervalMs,
    paused: !!room.paused,
    completedActions: room.completedActions,
    completedWinners: room.completedWinners,
    nextAction: room.nextAction,
    autoStart: !!room.autoStart
  };
}

// SOCKET.IO
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  /**
   * createRoom
   * payload can be:
  *  - string -> playerName (multiplayer)
   *  - object -> { playerName } (payload object)
   *
   * Always returns full room state (including hostId).
   */
  socket.on("createRoom", (payload, callback) => {
    let playerName = "";

    if (typeof payload === "string") {
      playerName = payload;
    } else if (payload && typeof payload === "object") {
      playerName = payload.playerName || "";
    }

    let code;
    do {
      code = generateRoomCode();
    } while (rooms[code]);

    rooms[code] = {
      players: [],
      extracted: [],
      gameStarted: false,
      hostId: socket.id,
      drawIntervalMs: 3000,
      paused: false,
      autoStart: false,
      autoDrawInterval: null,
      completedActions: [],
      completedWinners: {},
      nextAction: "ambo"
    };

    // Join room
    socket.join(code);
    rooms[code].players.push({ id: socket.id, name: playerName });

    console.log(`Room ${code} created by ${playerName} (${socket.id})`);

    // Reply to creator with full room state (always include hostId)
    const state = buildRoomStateForClient(code);
    if (typeof callback === "function") callback(state);

    // Broadcast players update
    io.to(code).emit("playersUpdate", rooms[code].players);
  });

  // Join Room
  socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
    const room = rooms[roomCode];
    if (!room) {
      if (typeof callback === "function") callback({ error: "Stanza non trovata" });
      return;
    }

    if (room.players.some((p) => p.name === playerName)) {
      if (typeof callback === "function") callback({ error: "Nome già in uso in questa stanza" });
      return;
    }

    socket.join(roomCode);
    room.players.push({ id: socket.id, name: playerName });

    console.log(`${playerName} (${socket.id}) joined room ${roomCode}`);

    // Return full room state so client can sync
    const state = buildRoomStateForClient(roomCode);
    if (typeof callback === "function") callback(state);

    io.to(roomCode).emit("playersUpdate", room.players);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("error", "Solo l'host può avviare la partita");
      return;
    }

    if (!room.autoStart && room.players.length < 2) {
      socket.emit("error", "Servono almeno 2 giocatori per iniziare");
      return;
    }

    startGame(roomCode);
  });

  // setDrawInterval (host-only)
  socket.on("setDrawInterval", ({ roomCode, ms } = {}) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (socket.id !== room.hostId) {
      socket.emit("error", "Solo l'host può cambiare la velocità di estrazione");
      return;
    }

    const n = Number(ms) || 3000;
    const clamped = Math.max(3000, Math.min(15000, Math.round(n)));
    room.drawIntervalMs = clamped;

    // Notify all clients
    io.to(roomCode).emit("drawIntervalChanged", clamped);

    // If auto-draw is active, restart it with the new interval
    if (room.autoDrawInterval) {
      clearInterval(room.autoDrawInterval);
      room.autoDrawInterval = null;
      if (!room.paused && room.gameStarted) {
        startAutoDraw(roomCode);
      }
    }
  });

  // pauseAutoDraw (host-only)
  socket.on("pauseAutoDraw", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (socket.id !== room.hostId) {
      socket.emit("error", "Solo l'host può mettere in pausa l'estrazione");
      return;
    }

    if (room.autoDrawInterval) {
      clearInterval(room.autoDrawInterval);
      room.autoDrawInterval = null;
    }
    room.paused = true;
    io.to(roomCode).emit("autoDrawPaused");
    console.log(`⏸️ AutoDraw paused in ${roomCode} by ${socket.id}`);
  });

  // resumeAutoDraw (host-only)
  socket.on("resumeAutoDraw", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (socket.id !== room.hostId) {
      socket.emit("error", "Solo l'host può riavviare l'estrazione");
      return;
    }

    room.paused = false;
    io.to(roomCode).emit("autoDrawResumed");
    console.log(`▶️ AutoDraw resumed in ${roomCode} by ${socket.id}`);

    if (room.gameStarted && !room.autoDrawInterval) {
      startAutoDraw(roomCode);
    }
  });

  // declareWin (server authoritative)
  socket.on("declareWin", (data, callback) => {
    const { roomCode, action, player } = data || {};
    const room = rooms[roomCode];

    if (!room) {
      if (typeof callback === "function") callback({ ok: false, error: "Stanza non trovata" });
      return;
    }

    const order = ["ambo", "terna", "quaterna", "cinquina", "tombola"];

    if (room.nextAction !== action) {
      const msg = `Non puoi dichiarare ${action}. La prossima azione è: ${room.nextAction}`;
      socket.emit("error", msg);
      if (typeof callback === "function") callback({ ok: false, error: msg });
      return;
    }

    room.completedActions.push(action);
    const currentIndex = order.indexOf(action);
    room.nextAction = currentIndex < order.length - 1 ? order[currentIndex + 1] : null;

    console.log(`✅ ${player} HA VINTO ${action} in ${roomCode}! Next action: ${room.nextAction}`);

    room.completedWinners[action] = socket.id;

    const payload = {
      action,
      player,
      winnerId: socket.id,
      completedActions: room.completedActions,
      completedWinners: room.completedWinners,
      nextAction: room.nextAction,
    };

    io.to(roomCode).emit("winDeclared", payload);
    if (typeof callback === "function") callback({ ok: true, ...payload });
  });

  // handle disconnect: remove player, reassign host if needed, cleanup room
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx >= 0) {
        const playerName = room.players[idx].name;
        room.players.splice(idx, 1);

        console.log(`${playerName} left room ${code}`);
        io.to(code).emit("playersUpdate", room.players);

        // If host left, cleanup autoDraw and reassign
        if (room.hostId === socket.id) {
          if (room.autoDrawInterval) {
            clearInterval(room.autoDrawInterval);
            room.autoDrawInterval = null;
          }

          if (room.players.length > 0) {
            room.hostId = room.players[0].id;
            console.log(`👑 New host for room ${code}: ${room.players[0].name}`);
            io.to(code).emit("hostChanged", { hostId: room.hostId });

            // If game was started (autoStart true or normal game started), resume autodraw
            if (room.gameStarted) {
              // Ensure autodraw running with new host
              if (!room.autoDrawInterval && !room.paused) {
                startAutoDraw(code);
              }
            }
          }
        }

        // If no players left, delete room
        if (room.players.length === 0) {
          if (room.autoDrawInterval) clearInterval(room.autoDrawInterval);
          delete rooms[code];
          console.log(`🗑️ Room ${code} deleted`);
        }

        break;
      }
    }
  });
});

// Start server
server.listen(3000, () => {
  console.log("🎄 Tombola server listening on port 3000");
});
