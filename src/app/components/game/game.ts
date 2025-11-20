import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import type { Extract } from '../../models/extract';
import { LanguageService } from '../../services/language.service';
import { CallActionType, SchedaService } from '../../services/scheda.service';
import { Scheda } from './scheda/scheda';
import { Tabellone } from './tabellone/tabellone';
import { LobbyService } from '../../services/lobby.service';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [TranslateModule, Tabellone, Scheda, CommonModule],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class Game implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  players: { id: string; name: string }[] = [];
  scheda: Extract[][] = [];
  lastAction = '';
  lastWinner: string | null = null;
  extractedNumbers: number[] = [];
  lastExtractedNumber: number | null = null;

  playerName = '';
  isHost = false;
  roomCode = '';
  isSingleMode: boolean | undefined = false;

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private gameService: GameService,
    private lobby: LobbyService,
    private schedaService: SchedaService,
    private router: Router
  ) {}

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());

    // Verifica se sei in una sessione valida
    const state = this.lobby.roomState$.value;

    if (!state.roomCode || !state.gameStarted) {
      this.router.navigate(['/homepage']);
      return;
    }

    // Ottieni informazioni sulla sessione
    this.playerName = this.lobby.playerName;
    this.isHost = this.lobby.isHost;
    this.roomCode = state.roomCode;

    this.isSingleMode = state.single

    // Resetta sempre il GameService
    this.gameService.resetGame();

    // Genera la scheda e sincronizza
    this.scheda = this.schedaService.generateScheda();
    this.gameService.setScheda(this.scheda);

    // Giocatori
    this.lobby.roomPlayers$.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.players = p;
    });

    // Numeri estratti
    this.lobby.extractedNumbers$.pipe(takeUntil(this.destroy$)).subscribe((nums) => {
      this.extractedNumbers = nums;
      // Imposta l'ultimo numero estratto
      if (nums.length > 0) {
        this.lastExtractedNumber = nums[nums.length - 1];
      } else {
        this.lastExtractedNumber = null;
      }
    });

    // Ultima azione
    this.lobby.lastAction$.pipe(takeUntil(this.destroy$)).subscribe((a) => {
      this.lastAction = a ?? '';
    });

    this.lobby.win$.pipe(takeUntil(this.destroy$)).subscribe((win) => {
      if (win) {
        this.lastAction = win.action;
        this.lastWinner = win.player;
      } else {
        this.lastAction = '';
        this.lastWinner = null;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Declare a game action (e.g., win) after validation
  declare(action: CallActionType) {
    if (action !== this.lobby.nextAction$.value) {
      alert(
        `Non puoi dichiarare ${action.toUpperCase()}. La prossima azione è ${this.lobby.nextAction$.value?.toUpperCase()}`
      );
      return;
    }

    const result = this.schedaService.checkAction(action, this.scheda, this.extractedNumbers);

    if (!result.isValid) {
      alert(result.message);
      return;
    }

    this.lobby
      .declareWin(action)
      .then(() => {
        alert(`Hai dichiarato ${action.toUpperCase()}!`);
      })
      .catch((err) => {
        const msg = err?.error || (typeof err === 'string' ? err : 'Errore nella dichiarazione');
        alert(msg);
      });
  }

  // Leave the current game session and navigate to the homepage
  onLeaveGame() {
    if (confirm('Vuoi davvero lasciare la partita?')) {
      this.lobby.reset();
      this.router.navigate(['/homepage']);
    }
  }
}
