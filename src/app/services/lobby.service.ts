import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environment';

export interface Player {
  id: string;
  name: string;
}

export interface RoomState {
  roomCode: string | null;
  isHost: boolean;
  gameStarted: boolean;
  single?: boolean;
}

export interface WinData {
  action: string;
  player: string;
}

@Injectable({ providedIn: 'root' })
export class LobbyService {
  private socket: Socket;

  // Observables
  roomPlayers$ = new BehaviorSubject<Player[]>([]);
  extractedNumbers$ = new BehaviorSubject<number[]>([]);
  newNumber$ = new BehaviorSubject<number | null>(null);
  win$ = new BehaviorSubject<WinData | null>(null);
  // ID del socket locale e del vincitore dell'ultima azione
  socketId: string | null = null;
  lastWinnerId$ = new BehaviorSubject<string | null>(null);
  roomState$ = new BehaviorSubject<RoomState>({
    roomCode: null,
    isHost: false,
    gameStarted: false,
  });
  // Draw controls for auto-draw interval in milliseconds (default 3000 = 3s)
  drawIntervalMs$ = new BehaviorSubject<number>(3000);
  // Paused flag to pause/resume automatic draws
  isPaused$ = new BehaviorSubject<boolean>(false);
  gameStarted$ = new BehaviorSubject<boolean>(false);
  completedActions$ = new BehaviorSubject<string[]>([]);
  // Map action -> winner socket id
  completedWinners$ = new BehaviorSubject<Record<string, string | null>>({});
  lastAction$ = new BehaviorSubject<string | null>(null);
  nextAction$ = new BehaviorSubject<string | null>('ambo');

  // Player data
  playerName = '';
  private _isHost = false;
  // When true the room is local singleplayer (no server involvement)
  private _isSingleMode: boolean = false;
  private _localAutoDrawInterval: any = null;

  constructor() {
    this.socket = io(environment.apiUrl);

    // Aggiorna lista giocatori
    this.socket.on('playersUpdate', (players: Player[]) => {
      this.roomPlayers$.next(players);
    });

    // Numero estratto
    this.socket.on('numberDrawn', (n: number) => {
      const current = this.extractedNumbers$.value;
      if (!current.includes(n)) {
        const updated = [...current, n];
        this.extractedNumbers$.next(updated);
        this.newNumber$.next(n);
      }
    });

    // Memorizza l'id socket locale quando connesso
    this.socket.on('connect', () => {
      this.socketId = this.socket.id ?? null;
    });

    // Sync draw interval and pause/resume from server
    this.socket.on('drawIntervalChanged', (ms: number) => {
      this.drawIntervalMs$.next(ms);
    });

    this.socket.on('autoDrawPaused', () => {
      this.isPaused$.next(true);
    });

    this.socket.on('autoDrawResumed', () => {
      this.isPaused$.next(false);
    });

    // Vittoria dichiarata dal server (con stato aggiornato)
    this.socket.on(
      'winDeclared',
      (data: {
        action: string;
        player: string;
        winnerId?: string;
        completedActions: string[];
        completedWinners?: Record<string, string | null>;
        nextAction: string | null;
      }) => {
        this.completedActions$.next(data.completedActions);
        this.lastAction$.next(data.action);
        this.nextAction$.next(data.nextAction);

        // salva la mappa action->winner per permettere evidenziazione action-specific
        if (data.completedWinners && typeof data.completedWinners === 'object') {
          this.completedWinners$.next(data.completedWinners || {});
        } else if (data.winnerId) {
          // legacy: se arriva solo winnerId, aggiorna lastWinnerId
          this.lastWinnerId$.next(data.winnerId || null);
        }

        this.win$.next({ action: data.action, player: data.player });
      }
    );

    // Partita iniziata dall'host
    this.socket.on('gameStarted', () => {
      this.gameStarted$.next(true);
      this._updateRoomState({ gameStarted: true });
    });

    // Fine partita
    this.socket.on('gameEnded', () => {
      //alert('Tutti i numeri sono stati estratti! La partita è terminata.');
    });

    // Errore generale
    this.socket.on('error', (msg: string) => {
      console.error('Socket error:', msg);
      alert(`Errore: ${msg}`);
    });
  }

  // Create a local singleplayer room
  createLocalRoom(playerName: string, cb?: (res: any) => void) {
    this.playerName = playerName;
    this._isSingleMode = true;
    this._isHost = true;
    const localId = 'single';
    this.socketId = localId;

    const state = {
      roomCode: 'SINGLE',
      isHost: true,
      gameStarted: false,
      single: true,
    };

    this.roomState$.next(state as any);
    this.roomPlayers$.next([{ id: localId, name: playerName }]);
    this.extractedNumbers$.next([]);
    this.completedActions$.next([]);
    this.completedWinners$.next({});
    this.nextAction$.next('ambo');

    const res = {
      ok: true,
      roomCode: 'SINGLE',
      hostId: localId,
      players: [{ id: localId, name: playerName }],
      extracted: [],
      completedActions: [],
      nextAction: 'ambo',
      gameStarted: false,
    };

    if (cb) cb(res);
  }

  // Set draw interval in milliseconds
  setDrawIntervalMs(ms: number) {
    // Set the interval for automatic number draws
    if (ms <= 0) return;
    const roomCode = this.roomState$.value.roomCode;
    if (this._isSingleMode) {
      this.drawIntervalMs$.next(ms);
      // restart local auto-draw with new interval if running
      if (this._localAutoDrawInterval) {
        clearInterval(this._localAutoDrawInterval);
        this._localAutoDrawInterval = null;
        if (!this.isPaused$.value && this.gameStarted$.value) this._startLocalAutoDraw();
      }
      return;
    }

    if (this._isHost && roomCode) {
      this.socket.emit('setDrawInterval', { roomCode, ms });
      this.drawIntervalMs$.next(ms);
    } else {
      this.drawIntervalMs$.next(ms);
    }
  }

  // Pause the automatic number draw
  pauseDraw() {
    const roomCode = this.roomState$.value.roomCode;
    if (this._isSingleMode) {
      // stop local interval
      if (this._localAutoDrawInterval) {
        clearInterval(this._localAutoDrawInterval);
        this._localAutoDrawInterval = null;
      }
      this.isPaused$.next(true);
      return;
    }

    if (this._isHost && roomCode) {
      this.socket.emit('pauseAutoDraw', roomCode);
    }
    this.isPaused$.next(true);
  }

  // Resume the automatic number draw
  resumeDraw() {
    const roomCode = this.roomState$.value.roomCode;
    if (this._isSingleMode) {
      this.isPaused$.next(false);
      if (this.gameStarted$.value && !this._localAutoDrawInterval) {
        this._startLocalAutoDraw();
      }
      return;
    }

    if (this._isHost && roomCode) {
      this.socket.emit('resumeAutoDraw', roomCode);
    }
    this.isPaused$.next(false);
  }

  // Toggle between pausing and resuming the draw
  togglePause() {
    const willPause = !this.isPaused$.value;
    if (willPause) this.pauseDraw();
    else this.resumeDraw();
  }

  // Create a new game room and set the player as the host
  createRoom(playerName: string, cb?: (res: any) => void) {
    this.playerName = playerName;
    const payload = playerName;

    this.socket.emit('createRoom', payload, (res: any) => {
      if (res && res.ok) {
        this._isHost = res.hostId === this.socketId;
        this._updateRoomState({
          roomCode: res.roomCode,
          isHost: this._isHost,
          gameStarted: !!res.gameStarted,
          single: false,
        });
        this.extractedNumbers$.next(res.extracted || []);
        this.completedActions$.next(res.completedActions || []);
        this.nextAction$.next(res.nextAction || 'ambo');
        if (res.gameStarted) this.gameStarted$.next(true);
      }
      if (cb) cb(res);
    });
  }

  // Join an existing game room using the room code
  joinRoom(roomCode: string, playerName: string, cb?: (res: any) => void) {
    this.playerName = playerName;
    this.socket.emit('joinRoom', { roomCode, playerName }, (res: any) => {
      if (res.ok) {
        this._isHost = false;
        // Inizializza i numeri estratti ricevuti dal server (una sola volta)
        if (res.extracted && Array.isArray(res.extracted)) {
          this.extractedNumbers$.next(res.extracted);
        }
        this._updateRoomState({
          roomCode: roomCode,
          isHost: false,
          gameStarted: res.gameStarted || false,
        });

        if (res.completedActions && Array.isArray(res.completedActions)) {
          this.completedActions$.next(res.completedActions);
        }

        if (res.nextAction) {
          this.nextAction$.next(res.nextAction);
        }

        // Se il gioco è già iniziato, aggiorna lo stato
        if (res.gameStarted) {
          this.gameStarted$.next(true);
        }
      }
      if (cb) cb(res);
    });
  }

  // Start the game if the player is the host
  startGame() {
    const roomCode = this.roomState$.value.roomCode;
    if (!roomCode || !this._isHost) {
      alert("Solo l'host può avviare la partita");
      return;
    }
    if (this._isSingleMode) {
      // Start local game
      this.gameStarted$.next(true);
      this._updateRoomState({ gameStarted: true });
      // Start local auto-draw
      if (!this._localAutoDrawInterval && !this.isPaused$.value) {
        this._startLocalAutoDraw();
      }
      return;
    }

    this.socket.emit('startGame', roomCode);
  }

  // Declare a win for a specific action
  declareWin(action: string): Promise<any> {
    const roomCode = this.roomState$.value.roomCode;
    if (!roomCode) return Promise.reject({ ok: false, error: 'Non sei in una stanza' });

    if (this._isSingleMode) {
      return new Promise((resolve, reject) => {
        const order = ['ambo', 'terna', 'quaterna', 'cinquina', 'tombola'];
        const currentNext = this.nextAction$.value || 'ambo';
        if (currentNext !== action) {
          const msg = `Non puoi dichiarare ${action}. La prossima azione è: ${currentNext}`;
          reject({ ok: false, error: msg });
          return;
        }

        const completed = [...this.completedActions$.value, action];
        this.completedActions$.next(completed);
        const currentIndex = order.indexOf(action);
        const next = currentIndex < order.length - 1 ? order[currentIndex + 1] : null;
        this.nextAction$.next(next);

        const winners = { ...(this.completedWinners$.value || {}) };
        winners[action] = this.socketId || 'single';
        this.completedWinners$.next(winners);

        const payload = {
          ok: true,
          action,
          player: this.playerName,
          winnerId: this.socketId || 'single',
          completedActions: completed,
          completedWinners: winners,
          nextAction: next,
        };

        this.lastAction$.next(action);
        this.win$.next({ action, player: this.playerName });
        resolve(payload);
      });
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('declareWin', { roomCode, action, player: this.playerName }, (res: any) => {
        if (res && res.ok) {
          resolve(res);
        } else {
          reject(res || { ok: false, error: 'Errore sconosciuto' });
        }
      });
    });
  }

  // Getter per verificare se sei l'host
  get isHost(): boolean {
    return this._isHost;
  }

  // Getter per il codice stanza
  get roomCode(): string | null {
    return this.roomState$.value.roomCode;
  }

  // Reset the lobby state and disconnect the socket
  reset() {
    this.playerName = '';
    this._isHost = false;
    this.roomPlayers$.next([]);
    this.extractedNumbers$.next([]);
    this.newNumber$.next(null);
    this.win$.next(null);
    this.gameStarted$.next(false);
    this.completedActions$.next([]);
    this.lastAction$.next(null);
    this.roomState$.next({
      roomCode: null,
      isHost: false,
      gameStarted: false,
    });

    // clear local interval if present and reset local flag
    if (this._localAutoDrawInterval) {
      clearInterval(this._localAutoDrawInterval);
      this._localAutoDrawInterval = null;
    }
    this._isSingleMode = false;

    // Disconnetti il socket se esiste
    if (this.socket) {
      this.socket.disconnect();
      // Riconnetti
      this.socket.connect();
    }
  }

  // Aggiorna lo stato della stanza
  private _updateRoomState(partial: Partial<RoomState>) {
    const current = this.roomState$.value;
    this.roomState$.next({ ...current, ...partial });
  }

  // Local auto-draw implementation for singleplayer
  private _startLocalAutoDraw() {
    const intervalMs = this.drawIntervalMs$.value || 3000;
    if (this._localAutoDrawInterval) return;

    this._localAutoDrawInterval = setInterval(() => {
      if (this.isPaused$.value) return;

      const current = this.extractedNumbers$.value || [];
      if (current.length >= 90) {
        clearInterval(this._localAutoDrawInterval);
        this._localAutoDrawInterval = null;
        this.gameStarted$.next(false);
        return;
      }

      let num;
      do {
        num = Math.floor(Math.random() * 90) + 1;
      } while (current.includes(num));

      const updated = [...current, num];
      this.extractedNumbers$.next(updated);
      this.newNumber$.next(num);
    }, intervalMs);
  }
}
