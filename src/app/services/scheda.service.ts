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
    // 1) crea le colonne con i range corretti:
    // col 0: 1..9
    // col 1: 10..19
    // ...
    // col 8: 80..90
    const columns: number[][] = [];
    for (let i = 0; i < 9; i++) {
      const colNumbers: number[] = [];
      if (i === 0) {
        for (let n = 1; n <= 9; n++) colNumbers.push(n);
      } else if (i === 8) {
        for (let n = 80; n <= 90; n++) colNumbers.push(n);
      } else {
        const start = i * 10;
        for (let n = start; n <= start + 9; n++) colNumbers.push(n);
      }
      columns.push(colNumbers);
    }

    // 2) scheda vuota 3x9
    const scheda: Extract[][] = Array.from({ length: 3 }, () =>
      Array.from({ length: 9 }, () => ({ value: 0, isExtracted: false }))
    );

    // contatori numeri per riga
    const rowCounts = [0, 0, 0];

    // Helper: assegna un numero casuale dalla colonna colIdx a riga rowIdx
    const assignFromColumnToRow = (colIdx: number, rowIdx: number) => {
      const colArray = columns[colIdx];
      if (!colArray || colArray.length === 0) return false;
      const idx = this.pickRandomIndex(colArray.length);
      const number = colArray.splice(idx, 1)[0];
      scheda[rowIdx][colIdx] = { value: number, isExtracted: false };
      rowCounts[rowIdx]++;
      return true;
    };

    // 3) Prima garantisco almeno 1 numero per colonna (9 numeri)
    // assegno ciascuno a una riga scelta casualmente che non abbia ancora 5 numeri
    for (let col = 0; col < 9; col++) {
      // scegli una riga valida (che ha < 5 e la cella col è libera)
      const validRows = [0, 1, 2].filter((r) => rowCounts[r] < 5);
      if (validRows.length === 0) {
        // Molto improbabile, ma per sicurezza: riavvia il processo (fallback semplice)
        throw new Error('Impossibile assegnare un numero per colonna: stato inconsistente.');
      }
      // scegli riga casuale tra quelle valide
      const row = validRows[this.pickRandomIndex(validRows.length)];
      assignFromColumnToRow(col, row);
    }

    // 4) Riempi i restanti 6 numeri (totale 15, 5 per riga)
    let placed = 9;
    while (placed < 15) {
      // Scegli una riga che non sia ancora piena
      const rowsAvailable = [0, 1, 2].filter((r) => rowCounts[r] < 5);
      if (rowsAvailable.length === 0) {
        // Non dovrebbero finire: fallback di sicurezza
        throw new Error('Tutte le righe sono piene prima di aver piazzato 15 numeri.');
      }
      const row = rowsAvailable[this.pickRandomIndex(rowsAvailable.length)];

      // Scegli una colonna dove la cella [row][col] è vuota
      const possibleCols = [];
      for (let col = 0; col < 9; col++) {
        if (scheda[row][col].value === 0 && columns[col].length > 0) {
          possibleCols.push(col);
        }
      }

      // Se non ci sono colonne con numeri rimanenti per questa riga,
      // Proviamo altre righe disponibili; se niente, proviamo colonne anche se hanno già numeri (ma cella libera)
      if (possibleCols.length === 0) {
        // Come fallback, consideriamo colonne con cella libera indipendentemente dal pool (dovrebbero esserci comunque numeri)
        for (let col = 0; col < 9; col++) {
          if (scheda[row][col].value === 0) possibleCols.push(col);
        }
      }

      if (possibleCols.length === 0) {
        // Stato inatteso
        throw new Error('Nessuna colonna disponibile per piazzare ulteriori numeri.');
      }

      const col = possibleCols[this.pickRandomIndex(possibleCols.length)];

      // Se la colonna non ha più numeri, potrebbe succedere: prendi comunque se ci sono numeri altrove
      if (columns[col].length === 0) {
        // Trova una col diversa con cella libera e numeri
        const alt = possibleCols.find((c) => columns[c].length > 0);
        if (alt === undefined) {
          // Molto improbabile, ma fallback per evitare loop infinito:
          throw new Error('Pool numeri esaurito in colonne disponibili.');
        }
        assignFromColumnToRow(alt, row);
      } else {
        assignFromColumnToRow(col, row);
      }

      placed++;
    }

    // 5) Ordina verticalmente i numeri in ogni colonna
    for (let col = 0; col < 9; col++) {
      // Prendi tutte le celle non vuote in questa colonna
      const cells = scheda.map((r) => r[col]).filter((c) => c.value !== 0);
      cells.sort((a, b) => a.value - b.value);

      // Riassegna i valori ordinati nella colonna, mantenendo le posizioni vuote dove erano 0
      let idx = 0;
      for (let row = 0; row < 3; row++) {
        if (scheda[row][col].value !== 0) {
          scheda[row][col] = { ...cells[idx++] };
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
        row.filter((c) => c.isExtracted && c.value !== 0 && extractedNumbers.includes(c.value))
          .length
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
  private pickRandomIndex(max: number): number {
    return Math.floor(Math.random() * max);
  }
}
