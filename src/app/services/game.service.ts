import { Injectable } from '@angular/core';
import type { Extract } from '../models/extract';
import { TabelloneService } from './tabellone.service';
import { SchedaService, CallActionType } from './scheda.service';
import { BehaviorSubject } from 'rxjs';

export interface GameState {
  completedActions: CallActionType[];
  lastAction: CallActionType | null;
  nextAction: CallActionType | null;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private scheda: Extract[][] = [];
  private actionOrder: CallActionType[] = ['ambo', 'terna', 'quaterna', 'cinquina', 'tombola'];

  private gameStateSubject = new BehaviorSubject<GameState>({
    completedActions: [],
    lastAction: null,
    nextAction: 'ambo',
  });

  gameState$ = this.gameStateSubject.asObservable();

  constructor(private tabelloneService: TabelloneService, private schedaService: SchedaService) {
    this.resetGame();
  }

  // Reset the game state and generate a new scheda
  resetGame() {
    this.tabelloneService.reset();
    this.scheda = this.schedaService.generateScheda();
    this.gameStateSubject.next({
      completedActions: [],
      lastAction: null,
      nextAction: 'ambo',
    });
  }

  // Set the current scheda for the game
  setScheda(scheda: Extract[][]) {
    this.scheda = scheda;
  }

  // Retrieve the current scheda
  getScheda(): Extract[][] {
    return this.scheda;
  }

  // Get the next action to be performed in the game
  getNextAction(): CallActionType | null {
    return this.gameStateSubject.value.nextAction;
  }

  // Get the list of completed actions
  getCompletedActions(): CallActionType[] {
    return this.gameStateSubject.value.completedActions;
  }

  // Mark an action as completed and update the game state
  completeAction(action: CallActionType): void {
    const currentState = this.gameStateSubject.value;

    // Aggiungi l'azione completata
    const newCompletedActions = [...currentState.completedActions, action];

    // Determina la prossima azione
    const currentIndex = this.actionOrder.indexOf(action);
    const nextAction =
      currentIndex < this.actionOrder.length - 1 ? this.actionOrder[currentIndex + 1] : null;

    this.gameStateSubject.next({
      completedActions: newCompletedActions,
      lastAction: action,
      nextAction: nextAction,
    });
  }

  // Get all numbers that have been extracted from the tabellone
  getExtractedNumbers(): number[] {
    return this.tabelloneService
      .getExtractions()
      .filter((n) => n.isExtracted)
      .map((n) => n.value);
  }
}
