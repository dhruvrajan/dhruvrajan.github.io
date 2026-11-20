import { UrlMatchResult, UrlSegment } from '@angular/router';
import { titleSlug } from './song-format';

/** Lyrics SPA view keyed off the path under `/lyrics`. */
export type LyricsView = 'index' | 'artists' | 'artist' | 'song';

export interface LyricsRouteState {
  view: LyricsView;
  artistSlug: string;
  songSlug: string;
  /** Filter/search query params mirrored in the URL on the index view. */
  q: string;
  sort: string;
  instrument: string;
  tuning: string;
  capo: string;
  artist: string;
}

export const LYRICS_FILTER_KEYS = [
  'q',
  'sort',
  'instrument',
  'tuning',
  'capo',
  'artist',
] as const;

/** Match `/lyrics` and every path under it as one route (component stays mounted). */
export function lyricsUrlMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (!segments.length || segments[0].path !== 'lyrics') {
    return null;
  }
  return { consumed: segments };
}

export function artistNameSlug(artist: string): string {
  return titleSlug(artist || 'Other');
}

export function parseLyricsPath(pathname: string): Pick<
  LyricsRouteState,
  'view' | 'artistSlug' | 'songSlug'
> {
  const path = (pathname || '/').split('?')[0].split('#')[0] || '/';
  const parts = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (parts[0] !== 'lyrics') {
    return { view: 'index', artistSlug: '', songSlug: '' };
  }

  if (parts.length === 1) {
    return { view: 'index', artistSlug: '', songSlug: '' };
  }

  if (parts[1] === 'artists') {
    if (parts.length === 2) {
      return { view: 'artists', artistSlug: '', songSlug: '' };
    }
    return {
      view: 'artist',
      artistSlug: decodeURIComponent(parts[2] || ''),
      songSlug: '',
    };
  }

  if (parts[1] === 'song' && parts[2]) {
    return {
      view: 'song',
      artistSlug: '',
      songSlug: decodeURIComponent(parts[2]),
    };
  }

  return { view: 'index', artistSlug: '', songSlug: '' };
}

export function parseLyricsSearch(search: string): Pick<
  LyricsRouteState,
  'q' | 'sort' | 'instrument' | 'tuning' | 'capo' | 'artist'
> {
  const params = new URLSearchParams(
    search && search.charAt(0) === '?' ? search.slice(1) : search || '',
  );
  return {
    q: params.get('q') || '',
    sort: params.get('sort') || '',
    instrument: params.get('instrument') || '',
    tuning: params.get('tuning') || '',
    capo: params.get('capo') || '',
    artist: params.get('artist') || '',
  };
}

export function parseLyricsUrl(pathname: string, search = ''): LyricsRouteState {
  return {
    ...parseLyricsPath(pathname),
    ...parseLyricsSearch(search),
  };
}

/** Build a lyrics path (no origin). Query params omitted when empty / default. */
export function buildLyricsUrl(state: Partial<LyricsRouteState>): string {
  const view = state.view || 'index';
  let path = '/lyrics';

  if (view === 'artists') {
    path = '/lyrics/artists';
  } else if (view === 'artist' && state.artistSlug) {
    path = '/lyrics/artists/' + encodeURIComponent(state.artistSlug);
  } else if (view === 'song' && state.songSlug) {
    path = '/lyrics/song/' + encodeURIComponent(state.songSlug);
  }

  if (view !== 'index') {
    return path;
  }

  const params = new URLSearchParams();
  const q = (state.q || '').trim();
  if (q) params.set('q', q);
  if (state.sort && state.sort !== 'artist') params.set('sort', state.sort);
  if (state.instrument && state.instrument !== 'all') {
    params.set('instrument', state.instrument);
  }
  if (state.tuning && state.tuning !== 'all') params.set('tuning', state.tuning);
  if (state.capo && state.capo !== 'all') params.set('capo', state.capo);
  if (state.artist && state.artist !== 'all') params.set('artist', state.artist);

  const qs = params.toString();
  return qs ? path + '?' + qs : path;
}

/** Legacy `#song=slug` → `/lyrics/song/slug` (same origin path only). */
export function legacySongHashToPath(hash: string): string | null {
  let raw = hash || '';
  if (raw.charAt(0) === '#') raw = raw.slice(1);
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  let song = params.get('song');
  if (!song) {
    const m = /(?:^|&)song=([^&]+)/.exec(raw);
    song = m ? m[1] : '';
  }
  if (!song) return null;
  try {
    song = decodeURIComponent(song);
  } catch {
    /* keep raw */
  }
  if (!song) return null;
  return buildLyricsUrl({ view: 'song', songSlug: song });
}
