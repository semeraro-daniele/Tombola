import { Component, OnInit, OnDestroy } from '@angular/core';

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
  imports: [TranslateModule],
  templateUrl: './scheda.html',
  styleUrl: './scheda.css',
})
export class Scheda implements OnInit, OnDestroy {
  cardNumbers: Extract[] = [];
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
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());
    this.cardNumbers = this.gameService.getScheda().flat();

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
    this.subscription?.unsubscribe();
  }

  extractedNumber(cell: Extract): void {
    if (cell.value === 0) return;
    cell.isExtracted = !cell.isExtracted;
  }

  callAction(action: CallActionType) {
    if (this.nextAction !== action) {
      alert(`You must call ${this.nextAction?.toUpperCase()} before ${action.toUpperCase()}!`);
      return;
    }

    const extractedNumbers = this.gameService.getExtractedNumbers();
    const scheda2D = this.gameService.getScheda();

    const validation = this.schedaService.validateScheda(scheda2D, extractedNumbers);
    if (!validation.isValid) {
      alert(validation.message);
      if (validation.invalidNumbers && validation.invalidNumbers.length > 0) {
        this._highlightInvalidNumbers(validation.invalidNumbers);
      }
      return;
    }

    const actionCheck = this.schedaService.checkAction(action, scheda2D, extractedNumbers);
    if (!actionCheck.isValid) {
      alert(actionCheck.message);
      return;
    }

    this.isDeclaring = true;
    this.lobby
      .declareWin(action)
      .then(() => {
        this.gameService.completeAction(action);
        this.isDeclaring = false;
        alert(actionCheck.message);
      })
      .catch((err) => {
        const msg = err?.error || (typeof err === 'string' ? err : 'Error during declaration');
        alert(msg);
        this.isDeclaring = false;
      });
  }

  isActionEnabled(action: CallActionType): boolean {
    return this.nextAction === action;
  }

  isActionCompleted(action: CallActionType): boolean {
    return this.completedActions.includes(action);
  }

  isActionCompletedByMe(action: CallActionType): boolean {
    if (!this.completedActions.includes(action)) return false;
    const winners = this.lobby.completedWinners$.value;
    const winnerId = winners ? (winners[action] as string | null) : null;
    return !!(winnerId && this.lobby.socketId && winnerId === this.lobby.socketId);
  }

  private _highlightInvalidNumbers(invalidNumbers: number[]): void {
    this.cardNumbers.forEach((cell) => {
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
