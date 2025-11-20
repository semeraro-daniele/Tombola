# Tombola

Tombola is a modern web implementation of the classic Italian bingo-style game. This repository contains an Angular frontend and a Node.js backend (Socket.IO) that together provide single-player and multiplayer modes with live number draws and room-based multiplayer games.

**Key highlights:**
- **Single-player:** Play locally against the automatic number draw.
- **Multiplayer:** Create or join rooms, live sync via WebSockets, host controls for drawing and pausing numbers.
- **Backend:** Node.js + Express + Socket.IO powering rooms, game state and authoritative win declarations.

**Stack:** Angular (frontend), Node.js + Express + Socket.IO (backend).

**Ports used by default:** frontend `4200`, backend `3000`.

**Repository layout (important files):**
- `src/`: Angular app sources.
- `back-end/server.js`: Node.js server for development multiplayer (listens on port 3000).
- `back-end/server_rasp.js`: Node.js server that also serves static files from `back-end/dist` (useful for production on small devices / Raspberry Pi).

**How the game works (brief):**
- Each multiplayer room has a host (creator) who can start the game, set draw interval, pause/resume the auto-draw, and the server authoritatively announces drawn numbers to all clients.
- Players can declare wins (ambo, terna, quaterna, cinquina, tombola). The server verifies and broadcasts winners and progression.

## Getting started (development)

Prerequisites:
- Node.js (>= 18 recommended)
- npm (comes with Node.js)

1) Install dependencies (run from project root):

```powershell
npm install
```

2) Run backend (development):

Open a terminal and start the backend server:

```powershell
node back-end/server.js
```

3) Run frontend (development):

Open another terminal and run:

```powershell
npm run start
```
or
```
ng serve
```

The Angular dev server will be available at `http://localhost:4200/` and the backend at `http://localhost:3000/`. In development you typically run both processes in separate terminals.

Note: frontend and backend are separate processes. The frontend uses Socket.IO client to communicate with the backend on port 3000.

## Building for production

This project uses an Express static server in `back-end/server_rasp.js` that expects the built frontend in `back-end/dist`.

1) Build the Angular app and put the output inside `back-end/dist` (so the backend can serve it):

```powershell
ng build --output-path back-end/dist --configuration production
```

2) Start the production server (serves static files and Socket.IO API):

```powershell
node back-end/server_rasp.js
```

The app will then be served from the Node server at `http://localhost:3000/`.

## Running on a Raspberry Pi or small VPS

- Build with `ng build --output-path back-end/dist --configuration production` on your machine or on-device.
- Transfer the repository to the device (or build on-device if Node and Angular CLI installed).
- Run `node back-end/server_rasp.js` to serve the static frontend and Socket.IO endpoint from a single process.

## Single-player vs Multiplayer

- Single-player: Open the app locally and use the single-player game mode — the frontend drives an automatic draw locally or connects to backend auto-draw depending on configuration.
- Multiplayer: Use the lobby UI to create a room or join an existing room. The backend is authoritative for draws and win declarations, ensuring consistent state for all players.

## Configuration & notes for developers

- Ports are hard-coded to `3000` (backend) and `4200` (Angular dev). If you change ports, update the client configuration in `src/environments/*.ts` or `app.config.ts` so the Socket.IO client points to the correct backend URL.
- The backend keeps rooms and game state in-memory.
- Server scripts use Socket.IO events such as `createRoom`, `joinRoom`, `startGame`, `numberDrawn`, and `declareWin` — inspect `back-end/server.js` for the full protocol.

## Contributing

- Open an issue or a pull request describing proposed changes.
- Keep changes scoped and run the app locally to verify both single-player and multiplayer flows.
