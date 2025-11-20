import { Routes } from '@angular/router';
import { ErrorPage } from './shared/error-page/error-page';
import { Homepage } from './components/homepage/homepage';
import { Game } from './components/game/game';
import { RoomCreate } from './components/homepage/room-create/room-create';
import { RoomJoin } from './components/homepage/room-join/room-join';
import { MultiplayerLobby } from './components/homepage/multiplayer-lobby/multiplayer-lobby';

export const routes: Routes = [
  { path: '', redirectTo: 'homepage', pathMatch: 'full' },
  { path: 'homepage', component: Homepage },

  // Game
  { path: 'game', component: Game },

  { path: 'room-create', component: RoomCreate },

  // Join stanza
  { path: 'room-join', component: RoomJoin },

  // Lobby multiplayer
  { path: 'multiplayer/lobby', component: MultiplayerLobby },

  // Wildcard error page
  { path: '**', pathMatch: 'full', component: ErrorPage },
];
