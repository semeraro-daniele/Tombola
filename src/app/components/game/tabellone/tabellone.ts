import { Component, OnInit, OnDestroy } from '@angular/core';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { LanguageService } from '../../../services/language.service';
import { TabelloneService } from '../../../services/tabellone.service';
import type { Extract } from '../../../models/extract';
import { LobbyService } from '../../../services/lobby.service';

@Component({
  selector: 'app-tabellone',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './tabellone.html',
  styleUrl: './tabellone.css',
})
export class Tabellone implements OnInit, OnDestroy {
  numbers: Extract[] = [];
  lastExtracted: Extract | null = null;
  lastFive: number[] = [];
  endGame: boolean = false;

  private destroy$ = new Subject<void>();
  // Draw controls
  drawSeconds: number = 3; // seconds
  isPaused: boolean = false;

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private tabelloneService: TabelloneService,
    public lobbyService: LobbyService
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());

    this.numbers = this.tabelloneService.getExtractions();

    // Subscribe to the full list of extracted numbers
    this.lobbyService.extractedNumbers$.pipe(takeUntil(this.destroy$)).subscribe((numbers) => {
      this._updateExtracts(numbers);
    });

    // Subscribe to the new number drawn
    this.lobbyService.newNumber$.pipe(takeUntil(this.destroy$)).subscribe((num) => {
      if (num !== null) {
        const extract = this.numbers.find((e) => e.value === num);
        if (extract) {
          this.lastExtracted = extract;
          extract.isExtracted = true;
        }
      }
    });

    // Subscribe to draw controls
    this.lobbyService.drawIntervalMs$.pipe(takeUntil(this.destroy$)).subscribe((ms) => {
      const secs = Math.round(ms / 1000);
      this.drawSeconds = Math.max(3, Math.min(15, secs));
    });

    this.lobbyService.isPaused$.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.isPaused = p;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Update the state of extracted numbers and check if the game has ended
  private _updateExtracts(extractedNumbers: number[]) {
    this.numbers.forEach((extract) => {
      extract.isExtracted = extractedNumbers.includes(extract.value);
    });

    // Set the last extracted number
    if (extractedNumbers.length > 0) {
      const lastNumber = extractedNumbers[extractedNumbers.length - 1];
      const extract = this.numbers.find((e) => e.value === lastNumber);
      if (extract) {
        this.lastExtracted = extract;
      }
    } else {
      this.lastExtracted = null;
    }

    // Aggiorna gli ultimi 5 numeri
    this.lastFive = extractedNumbers.slice(-6, -1);

    // Check if the game is over
    if (extractedNumbers.length >= 90) {
      this.endGame = true;
    }
  }

  // Called when slider changes (seconds)
  onDrawSpeedChange(secs: any) {
    const n = Number(secs);
    const clamped = Math.max(3, Math.min(15, Math.round(n)));
    this.lobbyService.setDrawIntervalMs(clamped * 1000);
  }

  togglePause() {
    this.lobbyService.togglePause();
  }
}
