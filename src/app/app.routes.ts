import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { EventsPage } from './pages/events/events';
import { SetlistsPage } from './pages/setlists/setlists';
import { SongsPage } from './pages/songs/songs';
import { LyricsPage } from './pages/lyrics/lyrics';
import { NotFoundPage } from './pages/not-found/not-found';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'Music · Dhruv Rajan' },
  { path: 'events', component: EventsPage, title: 'Past Performances · Dhruv Rajan' },
  { path: 'setlists', component: SetlistsPage, title: 'Setlists & Recordings · Dhruv Rajan' },
  { path: 'songs', component: SongsPage, title: 'Songs by Artist · Dhruv Rajan' },
  { path: 'lyrics', component: LyricsPage, title: 'Lyrics · Dhruv Rajan' },
  // Legacy Jekyll paths
  { path: 'pages/events.html', redirectTo: 'events', pathMatch: 'full' },
  { path: 'pages/setlists.html', redirectTo: 'setlists', pathMatch: 'full' },
  { path: 'pages/songs_by_artist.html', redirectTo: 'songs', pathMatch: 'full' },
  { path: 'pages/lyrics.html', redirectTo: 'lyrics', pathMatch: 'full' },
  { path: '**', component: NotFoundPage, title: 'Page not found · Dhruv Rajan' },
];
