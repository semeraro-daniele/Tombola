import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../services/language.service';
import { LobbyService } from '../../../services/lobby.service';

@Component({
  selector: 'app-room-join',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './room-join.html',
  styleUrl: './room-join.css',
})
export class RoomJoin implements OnInit {
  playerName = '';
  roomCode = '';

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private lobby: LobbyService,
    private router: Router
  ) { }

  ngOnInit() {
    this.translate.use(this.languageService.getLanguage());
  }

  goBack() {
    this.router.navigate(['/homepage']);
  }

  // Join an existing game room using the provided room code
  joinRoom() {
    if (!this.playerName.trim() || !this.roomCode.trim()) {
      alert('Completa tutti i campi!');
      return;
    }

    this.lobby.joinRoom(this.roomCode.toUpperCase().trim(), this.playerName.trim(), (res: any) => {
      if (res.error) {
        alert(res.error);
      } else {
        this.router.navigate(res.gameStarted ? ['/game'] : ['/multiplayer/lobby']);
      }
    });
  }
}
