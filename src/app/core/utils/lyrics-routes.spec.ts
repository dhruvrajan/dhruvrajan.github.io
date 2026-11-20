import { UrlSegment } from '@angular/router';
import {
  artistNameSlug,
  buildLyricsUrl,
  legacySongHashToPath,
  lyricsUrlMatcher,
  parseLyricsUrl,
} from './lyrics-routes';

describe('lyrics-routes', () => {
  it('matches /lyrics and nested paths as one route', () => {
    const root = lyricsUrlMatcher([new UrlSegment('lyrics', {})]);
    expect(root?.consumed.length).toBe(1);

    const song = lyricsUrlMatcher([
      new UrlSegment('lyrics', {}),
      new UrlSegment('song', {}),
      new UrlSegment('hello-world', {}),
    ]);
    expect(song?.consumed.length).toBe(3);

    expect(lyricsUrlMatcher([new UrlSegment('songs', {})])).toBeNull();
  });

  it('parses index, artists, artist, and song paths', () => {
    expect(parseLyricsUrl('/lyrics').view).toBe('index');
    expect(parseLyricsUrl('/lyrics').songSlug).toBe('');
    expect(parseLyricsUrl('/lyrics/artists').view).toBe('artists');
    expect(parseLyricsUrl('/lyrics/artists/john-prine').view).toBe('artist');
    expect(parseLyricsUrl('/lyrics/artists/john-prine').artistSlug).toBe('john-prine');
    expect(parseLyricsUrl('/lyrics/song/angel-from-montgomery-john-prine').view).toBe(
      'song',
    );
    expect(parseLyricsUrl('/lyrics/song/angel-from-montgomery-john-prine').songSlug).toBe(
      'angel-from-montgomery-john-prine',
    );
  });

  it('parses filter query params on the index', () => {
    const state = parseLyricsUrl('/lyrics', '?q=angel&sort=title&instrument=Guitar');
    expect(state.q).toBe('angel');
    expect(state.sort).toBe('title');
    expect(state.instrument).toBe('Guitar');
  });

  it('builds paths and omits default filter params', () => {
    expect(buildLyricsUrl({ view: 'index' })).toBe('/lyrics');
    expect(buildLyricsUrl({ view: 'artists' })).toBe('/lyrics/artists');
    expect(buildLyricsUrl({ view: 'artist', artistSlug: 'john-prine' })).toBe(
      '/lyrics/artists/john-prine',
    );
    expect(buildLyricsUrl({ view: 'song', songSlug: 'hello' })).toBe('/lyrics/song/hello');
    expect(
      buildLyricsUrl({
        view: 'index',
        q: 'foo',
        sort: 'artist',
        instrument: 'all',
      }),
    ).toBe('/lyrics?q=foo');
  });

  it('maps legacy #song= hash to a song path', () => {
    expect(legacySongHashToPath('#song=hello-world')).toBe('/lyrics/song/hello-world');
    expect(legacySongHashToPath('#other=1')).toBeNull();
  });

  it('slugs artist names', () => {
    expect(artistNameSlug('John Prine')).toBe('john-prine');
    expect(artistNameSlug('')).toBe('other');
  });
});
