import { Component, OnInit, OnDestroy } from '@angular/core';

import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { LanguageService } from '../../../services/language.service';
import { LobbyService } from '../../../services/lobby.service';

@Component({
  selector: 'app-multiplayer-lobby',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './multiplayer-lobby.html',
  styleUrl: './multiplayer-lobby.css',
})
export class MultiplayerLobby implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  players: { id: string; name: string }[] = [];
  roomCode = '';
  isHost = false;
  isSingleMode = false;
  playerName = '';

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private lobby: LobbyService,
    private router: Router
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());

    // Ottieni info sulla stanza
    this.lobby.roomState$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.roomCode = state.roomCode || '';
      this.isHost = state.isHost;
      this.isSingleMode = !!state.single;
    });

    // Ottieni lista giocatori
    this.lobby.roomPlayers$.pipe(takeUntil(this.destroy$)).subscribe((players) => {
      this.players = players;
    });

    // Ottieni nome giocatore
    this.playerName = this.lobby.playerName;

    // Quando la partita inizia, vai al game
    this.lobby.gameStarted$.pipe(takeUntil(this.destroy$)).subscribe((started) => {
      if (started) {
        this.router.navigate(['/game']);
      }
    });

    // Se non sei in una stanza, torna alla home
    if (!this.roomCode) {
      this.router.navigate(['/homepage']);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Start the game if the player is the host and there are enough players
  onStartGame() {
    if (!this.isHost) return;

    if (!this.isSingleMode && this.players.length < 2) {
      alert('Aspetta almeno un altro giocatore!');
      return;
    }

    this.lobby.startGame();
  }

  onCopyCode() {
    navigator.clipboard.writeText(this.roomCode);
  }

  onLeave() {
    this.lobby.reset();
    this.router.navigate(['/homepage']);
  }
}
