import { Injectable } from '@angular/core';

import type { Extract } from '../models/extract';
import { LobbyService } from './lobby.service';

@Injectable({ providedIn: 'root' })
export class TabelloneService {
  private numbers: Extract[] = Array.from({ length: 90 }, (_, i) => ({
    value: i + 1,
    isExtracted: false,
  }));

  constructor(private lobby: LobbyService) {
    // Sottoscrivi ai singoli numeri estratti per aggiornamento in tempo reale
    this.lobby.newNumber$.subscribe((num) => {
      if (num !== null) {
        this.markExtracted(num);
      }
    });

    // Sottoscrivi alla lista completa per sincronizzazione (es. quando entri in una stanza)
    this.lobby.extractedNumbers$.subscribe((list) => {
      this.reset();
      list.forEach((n) => this.markExtracted(n));
    });
  }

  // Mark a specific number as extracted
  private markExtracted(num: number) {
    if (num >= 1 && num <= 90) {
      this.numbers[num - 1].isExtracted = true;
    }
  }

  // Retrieve the list of all numbers with their extraction status
  getExtractions(): Extract[] {
    return this.numbers;
  }

  // Reset the extraction status of all numbers
  reset() {
    this.numbers.forEach((n) => (n.isExtracted = false));
  }
}
