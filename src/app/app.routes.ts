import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
    title: 'Music · Dhruv Rajan',
  },
  {
    path: 'events',
    loadComponent: () => import('./pages/events/events').then((m) => m.EventsPage),
    title: 'Past Performances · Dhruv Rajan',
  },
  {
    path: 'setlists',
    loadComponent: () => import('./pages/setlists/setlists').then((m) => m.SetlistsPage),
    title: 'Setlists & Recordings · Dhruv Rajan',
  },
  {
    path: 'songs',
    loadComponent: () => import('./pages/songs/songs').then((m) => m.SongsPage),
    title: 'Songs by Artist · Dhruv Rajan',
  },
  {
    path: 'lyrics',
    loadComponent: () => import('./pages/lyrics/lyrics').then((m) => m.LyricsPage),
    title: 'Lyrics · Dhruv Rajan',
  },
  // Legacy static-site URL redirects (bookmarks / external links)
  { path: 'pages/events.html', redirectTo: 'events', pathMatch: 'full' },
  { path: 'pages/setlists.html', redirectTo: 'setlists', pathMatch: 'full' },
  { path: 'pages/songs_by_artist.html', redirectTo: 'songs', pathMatch: 'full' },
  { path: 'pages/lyrics.html', redirectTo: 'lyrics', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
    title: 'Page not found · Dhruv Rajan',
  },
];
