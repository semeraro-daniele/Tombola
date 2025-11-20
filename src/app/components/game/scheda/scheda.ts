import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { LanguageService } from '../../../services/language.service';
import { SchedaService, CallActionType } from '../../../services/scheda.service';
import { GameService } from '../../../services/game.service';
import { LobbyService } from '../../../services/lobby.service';
import type { Extract } from '../../../models/extract';

@Component({
  selector: 'app-scheda',
  standalone: true,
  imports: [TranslateModule, CommonModule],
  templateUrl: './scheda.html',
  styleUrl: './scheda.css',
})
export class Scheda implements OnInit, OnDestroy {
  scheda: Extract[][] = [];
  nextAction: CallActionType | null = null;
  completedActions: CallActionType[] = [];
  isDeclaring = false;

  private subscription?: Subscription;

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private schedaService: SchedaService,
    private gameService: GameService,
    private lobby: LobbyService
  ) {}

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());
    this.scheda = this.gameService.getScheda();

    // Sottoscrizioni allo stato della lobby
    this.subscription = new Subscription();
    this.subscription.add(
      this.lobby.nextAction$.subscribe((na) => {
        this.nextAction = na as CallActionType | null;
      })
    );
    this.subscription.add(
      this.lobby.completedActions$.subscribe((actions) => {
        this.completedActions = actions as CallActionType[];
      })
    );
  }

  ngOnDestroy() {
    // Clean up subscriptions when the component is destroyed
    this.subscription?.unsubscribe();
  }

  extractedNumber(cell: Extract): void {
    // Toggle the extracted state of a number on the scheda
    if (cell.value === 0) return;
    cell.isExtracted = !cell.isExtracted;
  }

  callAction(action: CallActionType) {
    // Validate and declare a game action (e.g., win)
    // 1. Verifica se questa è l'azione corretta da chiamare
    if (this.nextAction !== action) {
      alert(`Devi chiamare ${this.nextAction?.toUpperCase()} prima di ${action.toUpperCase()}!`);
      return;
    }

    // 2. Ottieni i numeri estratti dal tabellone
    const extractedNumbers = this.gameService.getExtractedNumbers();

    // 3. Valida che tutti i numeri segnati siano stati estratti
    const validation = this.schedaService.validateScheda(this.scheda, extractedNumbers);
    if (!validation.isValid) {
      alert(validation.message);
      if (validation.invalidNumbers && validation.invalidNumbers.length > 0) {
        this._highlightInvalidNumbers(validation.invalidNumbers);
      }
      return;
    }

    // 4. Controlla se l'azione è corretta
    const actionCheck = this.schedaService.checkAction(action, this.scheda, extractedNumbers);
    if (!actionCheck.isValid) {
      alert(actionCheck.message);
      return;
    }

    this.isDeclaring = true;
    this.lobby
      .declareWin(action)
      .then(() => {
        // Il server ha confermato; aggiorna anche il GameService localmente
        this.gameService.completeAction(action);
        this.isDeclaring = false;
        alert(actionCheck.message);
      })
      .catch((err) => {
        const msg = err?.error || (typeof err === 'string' ? err : 'Errore nella dichiarazione');
        alert(msg);
        this.isDeclaring = false;
      });
  }

  // Check if a specific action is currently enabled
  isActionEnabled(action: CallActionType): boolean {
    return this.nextAction === action;
  }

  // Check if a specific action has been completed
  isActionCompleted(action: CallActionType): boolean {
    return this.completedActions.includes(action);
  }

  // Ritorna true se l'azione è completata E il vincitore è il giocatore locale
  isActionCompletedByMe(action: CallActionType): boolean {
    // Check if the current player completed a specific action
    if (!this.completedActions.includes(action)) return false;
    const winners = this.lobby.completedWinners$.value;
    const winnerId = winners ? (winners[action] as string | null) : null;
    return !!(winnerId && this.lobby.socketId && winnerId === this.lobby.socketId);
  }

  private _highlightInvalidNumbers(invalidNumbers: number[]): void {
    // Temporarily highlight invalid numbers on the scheda
    this.scheda.flat().forEach((cell) => {
      if (invalidNumbers.includes(cell.value)) {
        const wasExtracted = cell.isExtracted;
        cell.isExtracted = false;

        setTimeout(() => {
          cell.isExtracted = wasExtracted;
        }, 500);
      }
    });
  }
}
