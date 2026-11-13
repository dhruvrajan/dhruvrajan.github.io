import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { songs } from '../../data';
import { Song } from '../../models/site';
import { formatSetupCompact, lyricsSongSlug, songLink } from '../../utils/song-setup';

interface ArtistGroup {
  artist: string;
  id: string;
  songs: Song[];
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

@Component({
  selector: 'app-songs',
  imports: [RouterLink],
  templateUrl: './songs.html',
})
export class SongsPage {
  readonly filter = signal('');

  private readonly allGroups: ArtistGroup[] = (() => {
    const byArtist = new Map<string, Song[]>();
    for (const song of songs) {
      const artist = song.artist || 'Unknown';
      const list = byArtist.get(artist) || [];
      list.push(song);
      byArtist.set(artist, list);
    }
    const artists = [...byArtist.keys()].sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    });
    return artists.map((artist, index) => ({
      artist,
      id: artist === 'Unknown' ? 'artist-unknown' : `artist-${index + 1}`,
      songs: byArtist.get(artist)!,
    }));
  })();

  readonly groups = computed(() => {
    const q = normalize(this.filter());
    if (!q) return this.allGroups;
    return this.allGroups
      .map((group) => ({
        ...group,
        songs: group.songs.filter((song) => {
          const title = normalize(song.title);
          const songArtist = normalize(song.artist || '');
          const artist = normalize(group.artist);
          return title.includes(q) || songArtist.includes(q) || artist.includes(q);
        }),
      }))
      .filter((g) => g.songs.length > 0);
  });

  readonly filterStatus = computed(() => {
    const q = normalize(this.filter());
    if (!q) return '';
    const visible = this.groups();
    const songCount = visible.reduce((n, g) => n + g.songs.length, 0);
    if (songCount === 0) return 'No matching songs.';
    return (
      songCount +
      ' song' +
      (songCount === 1 ? '' : 's') +
      ' · ' +
      visible.length +
      ' artist' +
      (visible.length === 1 ? '' : 's')
    );
  });

  setup(song: Song): string {
    return formatSetupCompact(song);
  }

  href(song: Song): string | null {
    return songLink(song);
  }

  lyricsSlug(song: Song): string {
    return lyricsSongSlug(song);
  }

  onFilter(value: string): void {
    this.filter.set(value);
  }
}
