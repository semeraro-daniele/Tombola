const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

const rooms = {};

function generateRoomCode(len = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function startGame(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.gameStarted) return false;

  room.gameStarted = true;
  room.paused = false;

  console.log(`🎮 Game started in room ${roomCode}`);

  if (room.autoResumeTimeout) {
    clearTimeout(room.autoResumeTimeout);
    room.autoResumeTimeout = null;
  }

  io.to(roomCode).emit("autoDrawResumed");
  io.to(roomCode).emit("gameStarted");

  startAutoDraw(roomCode);
  return true;
}

function startAutoDraw(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.autoDrawInterval || !room.gameStarted) return;

  console.log(`🚀 Starting auto-draw for room ${roomCode} (interval ${room.drawIntervalMs}ms)`);

  room.autoDrawInterval = setInterval(() => {
    if (!rooms[roomCode]) {
      clearInterval(room.autoDrawInterval);
      return;
    }

    if (room.paused) return;

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
  }, room.drawIntervalMs || 3000);
}

function pauseAutoDraw(roomCode) {
  const room = rooms[roomCode];
  clearAutoDrawInterval(room);
  clearAutoResumeTimeout(room);
  room.paused = true;
  io.to(roomCode).emit("autoDrawPaused");
}

function resumeAutoDraw(roomCode) {
  const room = rooms[roomCode];
  clearAutoResumeTimeout(room);
  room.paused = false;
  io.to(roomCode).emit("autoDrawResumed");

  if (room.gameStarted && !room.autoDrawInterval) {
    startAutoDraw(roomCode);
  }
}

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

function clearAutoDrawInterval(room) {
  if (room.autoDrawInterval) {
    clearInterval(room.autoDrawInterval);
    room.autoDrawInterval = null;
  }
}

function clearAutoResumeTimeout(room) {
  if (room.autoResumeTimeout) {
    clearTimeout(room.autoResumeTimeout);
    room.autoResumeTimeout = null;
  }
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("createRoom", (payload, callback) => {
    const playerName = typeof payload === "string" ? payload : (payload?.playerName || "");

    let code;
    do {
      code = generateRoomCode();
    } while (rooms[code]);

    rooms[code] = {
      players: [{ id: socket.id, name: playerName }],
      extracted: [],
      gameStarted: false,
      hostId: socket.id,
      drawIntervalMs: 3000,
      paused: false,
      autoStart: false,
      autoDrawInterval: null,
      autoResumeTimeout: null,
      completedActions: [],
      completedWinners: {},
      nextAction: "ambo"
    };

    socket.join(code);
    console.log(`Room ${code} created by ${playerName} (${socket.id})`);

    if (typeof callback === "function") {
      callback(buildRoomStateForClient(code));
    }

    io.to(code).emit("playersUpdate", rooms[code].players);
  });

  socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
    const room = rooms[roomCode];

    if (!room) {
      return callback?.({ error: "Stanza non trovata" });
    }

    if (room.players.some((p) => p.name === playerName)) {
      return callback?.({ error: "Nome già in uso in questa stanza" });
    }

    socket.join(roomCode);
    room.players.push({ id: socket.id, name: playerName });

    console.log(`${playerName} (${socket.id}) joined room ${roomCode}`);

    callback?.(buildRoomStateForClient(roomCode));
    io.to(roomCode).emit("playersUpdate", room.players);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      return socket.emit("error", "Solo l'host può avviare la partita");
    }

    if (!room.autoStart && room.players.length < 2) {
      return socket.emit("error", "Servono almeno 2 giocatori per iniziare");
    }

    startGame(roomCode);
  });

  socket.on("setDrawInterval", ({ roomCode, ms } = {}) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (socket.id !== room.hostId) {
      return socket.emit("error", "Solo l'host può cambiare la velocità di estrazione");
    }

    room.drawIntervalMs = Math.max(3000, Math.min(15000, Math.round(Number(ms) || 3000)));

    io.to(roomCode).emit("drawIntervalChanged", room.drawIntervalMs);

    if (room.autoDrawInterval) {
      clearAutoDrawInterval(room);
      if (!room.paused && room.gameStarted) {
        startAutoDraw(roomCode);
      }
    }
  });

  socket.on("pauseAutoDraw", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.hostId) {
      return socket.emit("error", "Solo l'host può mettere in pausa l'estrazione");
    }

    pauseAutoDraw(roomCode);
    console.log(`⏸️ AutoDraw paused in ${roomCode} by ${socket.id}`);
  });

  socket.on("resumeAutoDraw", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.hostId) {
      return socket.emit("error", "Solo l'host può riavviare l'estrazione");
    }

    resumeAutoDraw(roomCode);
    console.log(`▶️ AutoDraw resumed in ${roomCode} by ${socket.id}`);
  });

  socket.on("declareWin", (data, callback) => {
    const { roomCode, action, player } = data || {};
    const room = rooms[roomCode];

    if (!room) {
      return callback?.({ ok: false, error: "Stanza non trovata" });
    }

    const order = ["ambo", "terna", "quaterna", "cinquina", "tombola"];

    if (room.nextAction !== action) {
      const msg = `Non puoi dichiarare ${action}. La prossima azione è: ${room.nextAction}`;
      socket.emit("error", msg);
      return callback?.({ ok: false, error: msg });
    }

    room.completedActions.push(action);
    const currentIndex = order.indexOf(action);
    room.nextAction = currentIndex < order.length - 1 ? order[currentIndex + 1] : null;
    room.completedWinners[action] = socket.id;

    console.log(`✅ ${player} HA VINTO ${action} in ${roomCode}! Next action: ${room.nextAction}`);

    const payload = {
      action,
      player,
      winnerId: socket.id,
      completedActions: room.completedActions,
      completedWinners: room.completedWinners,
      nextAction: room.nextAction,
    };

    io.to(roomCode).emit("winDeclared", payload);
    callback?.({ ok: true, ...payload });

    // Pause for 5 seconds, then auto-resume
    pauseAutoDraw(roomCode);
    console.log(`⏸️ AutoDraw auto-paused for 5s in ${roomCode}`);

    room.autoResumeTimeout = setTimeout(() => {
      if (!rooms[roomCode]) return;

      const r = rooms[roomCode];
      r.autoResumeTimeout = null;

      if (!r.paused) return;

      resumeAutoDraw(roomCode);
      console.log(`▶️ AutoDraw auto-resumed after 5s in ${roomCode}`);
    }, 5000);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const idx = room.players.findIndex((p) => p.id === socket.id);

      if (idx === -1) continue;

      const playerName = room.players[idx].name;
      room.players.splice(idx, 1);

      console.log(`${playerName} left room ${code}`);
      io.to(code).emit("playersUpdate", room.players);

      // Host left: cleanup and reassign
      if (room.hostId === socket.id) {
        clearAutoDrawInterval(room);

        if (room.players.length > 0) {
          room.hostId = room.players[0].id;
          console.log(`👑 New host for room ${code}: ${room.players[0].name}`);
          io.to(code).emit("hostChanged", { hostId: room.hostId });

          if (room.gameStarted && !room.autoDrawInterval && !room.paused) {
            startAutoDraw(code);
          }
        }
      }

      // No players left: delete room
      if (room.players.length === 0) {
        clearAutoDrawInterval(room);
        clearAutoResumeTimeout(room);
        delete rooms[code];
        console.log(`🗑️ Room ${code} deleted`);
      }

      break;
    }
  });
});

server.listen(3000, () => {
  console.log("🎄 Tombola server listening on port 3000");
});