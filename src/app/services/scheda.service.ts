import { Injectable } from '@angular/core';
import type { Extract } from '../models/extract';

export type CallActionType = 'ambo' | 'terna' | 'quaterna' | 'cinquina' | 'tombola';

export interface ValidationResult {
  isValid: boolean;
  message: string;
  invalidNumbers?: number[];
}

@Injectable({ providedIn: 'root' })
export class SchedaService {
  generateScheda(): Extract[][] {
    const columns: number[][] = [];

    // 1. Genera array dei numeri per colonna
    for (let i = 0; i < 9; i++) {
      const start = i * 10 + 1;
      const end = i === 8 ? 90 : start + 9;
      const colNumbers = [];
      for (let n = start; n <= end; n++) colNumbers.push(n);
      columns.push(colNumbers);
    }

    // 2. Genera la schedina: 3 righe x 9 colonne (tutte vuote inizialmente)
    const scheda: Extract[][] = Array.from({ length: 3 }, () =>
      Array.from({ length: 9 }, () => ({ value: 0, isExtracted: false }))
    );

    // 3. Per ogni riga, scegli 5 colonne casuali
    for (let row = 0; row < 3; row++) {
      const colIndexes = this.getRandomIndexes(9, 5).sort((a, b) => a - b);
      for (const col of colIndexes) {
        const colArray = columns[col];
        const index = Math.floor(Math.random() * colArray.length);
        const number = colArray.splice(index, 1)[0];

        scheda[row][col] = { value: number, isExtracted: false };
      }
    }

    // 4. Ordina i numeri in ogni colonna (per tutte e 3 le righe)
    for (let col = 0; col < 9; col++) {
      const colCells = scheda.map((row) => row[col]).filter((cell) => cell.value !== 0);
      colCells.sort((a, b) => a.value - b.value);

      let idx = 0;
      for (let row = 0; row < 3; row++) {
        if (scheda[row][col].value !== 0) {
          scheda[row][col] = colCells[idx++];
        }
      }
    }

    return scheda;
  }

  // Validate that all marked numbers on the scheda have been extracted
  validateScheda(scheda: Extract[][], extractedNumbers: number[]): ValidationResult {
    const invalidNumbers: number[] = [];

    // Controlla ogni cella segnata sulla schedina
    scheda.flat().forEach((cell) => {
      if (cell.value !== 0 && cell.isExtracted) {
        // Verifica che il numero sia stato effettivamente estratto dal tabellone
        if (!extractedNumbers.includes(cell.value)) {
          invalidNumbers.push(cell.value);
        }
      }
    });

    if (invalidNumbers.length > 0) {
      return {
        isValid: false,
        message: `Attenzione! I seguenti numeri non sono stati estratti dal tabellone: ${invalidNumbers.join(
          ', '
        )}`,
        invalidNumbers,
      };
    }

    return {
      isValid: true,
      message: 'Scheda valida',
    };
  }

  checkAction(
    action: CallActionType,
    scheda: Extract[][],
    extractedNumbers: number[]
  ): ValidationResult {
    // Check if the called action is valid based on the scheda and extracted numbers
    const rowCounts = scheda.map(
      (row) =>
        row.filter((c) => c.isExtracted && c.value !== 0 && extractedNumbers.includes(c.value)).length
    );

    const totalValidExtracted = scheda
      .flat()
      .filter((c) => c.isExtracted && c.value !== 0 && extractedNumbers.includes(c.value)).length;

    switch (action) {
      case 'ambo':
        if (!rowCounts.some((count) => count >= 2)) {
          return {
            isValid: false,
            message: 'Non hai almeno 2 numeri estratti in una riga!',
          };
        }
        break;

      case 'terna':
        if (!rowCounts.some((count) => count >= 3)) {
          return {
            isValid: false,
            message: 'Non hai almeno 3 numeri estratti in una riga!',
          };
        }
        break;

      case 'quaterna':
        if (!rowCounts.some((count) => count >= 4)) {
          return {
            isValid: false,
            message: 'Non hai almeno 4 numeri estratti in una riga!',
          };
        }
        break;

      case 'cinquina':
        if (!rowCounts.some((count) => count >= 5)) {
          return {
            isValid: false,
            message: 'Non hai tutti e 5 i numeri estratti in una riga!',
          };
        }
        break;

      case 'tombola':
        if (totalValidExtracted !== 15) {
          return {
            isValid: false,
            message: `Hai solo ${totalValidExtracted}/15 numeri estratti validi! Ti mancano ancora ${
              15 - totalValidExtracted
            } numeri.`,
          };
        }
        break;

      default:
        return {
          isValid: false,
          message: 'Azione non valida',
        };
    }

    return {
      isValid: true,
      message: `${action.toUpperCase()} vinto! 🎉`,
    };
  }

  // Generate a list of random indexes
  private getRandomIndexes(max: number, count: number): number[] {
    const indexes = Array.from({ length: max }, (_, i) => i);
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * indexes.length);
      result.push(indexes.splice(idx, 1)[0]);
    }
    return result;
  }
}
