import { Component, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements OnInit {
  showMultiplayerOptions = false;

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private router: Router
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());
  }

  // Torna alla selezione modalità
  onBackToModeSelection() {
    // Return to the mode selection screen
    this.showMultiplayerOptions = false;
  }

  // Multiplayer: crea stanza
  onCreateGame() {
    // Navigate to the room creation screen for multiplayer
    this.router.navigate(['/room-create']);
  }

  // Singleplayer
  onStartSinglePlayer() {
    // Start a single-player game
    this.router.navigate(['/room-create'], { queryParams: { single: true } });
  }

  // Multiplayer: join stanza
  onJoinGame() {
    // Navigate to the room join screen for multiplayer
    this.router.navigate(['/room-join']);
  }

  // Mostra opzioni multiplayer
  onShowMultiplayerOptions() {
    // Display multiplayer options on the homepage
    this.showMultiplayerOptions = true;
  }
}
