import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../../services/language.service';
import { LobbyService } from '../../../services/lobby.service';

@Component({
  selector: 'app-room-create',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './room-create.html',
  styleUrl: './room-create.css',
})
export class RoomCreate implements OnInit {
  playerName = '';
  isSingleMode = false;

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private lobbyService: LobbyService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());
    const qp = this.route.snapshot.queryParams as any;
    this.isSingleMode = qp && (qp['single'] === 'true' || qp['single'] === true);
  }

  goBack() {
    this.router.navigate(['/homepage']);
  }

  // Start a new multiplayer or singleplayer game room
  startRoom() {
    if (!this.playerName.trim()) {
      alert('Inserisci il tuo nome!');
      return;
    }

    const name = this.playerName.trim();

    if (this.isSingleMode) {
      this.lobbyService.createLocalRoom(name, (res) => {
        if (res && res.ok) {
          this.lobbyService.startGame();
          this.router.navigate(['/game']);
        } else {
          alert('Errore nella creazione della stanza locale');
        }
      });
      return;
    }

    this.lobbyService.createRoom(name, (res) => {
      if (res && res.ok) {
        this.router.navigate(['/multiplayer/lobby']);
      } else {
        alert('Errore nella creazione della stanza');
      }
    });
  }
}
