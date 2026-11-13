import { Injectable, inject } from '@angular/core';
import { EventItem, Setlist, Song } from '../models/site';
import {
  formatSetupCompact,
  lyricsSongSlug,
  songLink,
  titleSlug,
} from '../utils/song-format';
import { CatalogService } from './catalog.service';

export interface ArtistGroup {
  artist: string;
  id: string;
  songs: Song[];
}

export interface EventYearGroup {
  year: string;
  items: { event: EventItem; dateLabel: string }[];
}

export interface ResolvedSetlist {
  name: string;
  instruments?: string[];
  songs: { title: string; song?: Song; href: string | null }[];
}

function normalize(value: string): string {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function eventYear(date: string): string {
  const parts = date.split(',');
  return (parts[parts.length - 1] || '').trim();
}

function dateWithoutYear(date: string, year: string): string {
  return date.replace(year, '').replace(/,/g, '').trim();
}

/**
 * Filtering, grouping, and presentation helpers for repertoire pages.
 */
@Injectable({ providedIn: 'root' })
export class RepertoireService {
  private readonly catalog = inject(CatalogService);

  private artistGroupsCache: ArtistGroup[] | null = null;

  formatSetup(song: Song | null | undefined): string {
    return formatSetupCompact(song);
  }

  mediaLink(song: Song | undefined): string | null {
    return songLink(song);
  }

  lyricsSlug(song: Song): string {
    return lyricsSongSlug(song);
  }

  slugifyTitle(title: string): string {
    return titleSlug(title);
  }

  groupEventsByYear(events: readonly EventItem[] = this.catalog.events()): EventYearGroup[] {
    const years: string[] = [];
    for (const event of events) {
      const year = eventYear(event.date);
      if (year && !years.includes(year)) {
        years.push(year);
      }
    }

    return years.map((year) => ({
      year,
      items: events
        .filter((event) => eventYear(event.date) === year)
        .map((event) => ({
          event,
          dateLabel: dateWithoutYear(event.date, year),
        })),
    }));
  }

  resolveSetlists(setlists: readonly Setlist[] = this.catalog.setlists()): ResolvedSetlist[] {
    return setlists.map((setlist) => ({
      name: setlist.setlist_name,
      instruments: setlist.instruments,
      songs: setlist.songs.map((entry) => {
        const song = this.catalog.findSongByTitle(entry.title);
        return {
          title: entry.title,
          song,
          href: songLink(song),
        };
      }),
    }));
  }

  groupSongsByArtist(songs: readonly Song[] = this.catalog.songs()): ArtistGroup[] {
    if (this.artistGroupsCache && songs === this.catalog.songs()) {
      return this.artistGroupsCache;
    }

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

    const groups = artists.map((artist, index) => ({
      artist,
      id: artist === 'Unknown' ? 'artist-unknown' : `artist-${index + 1}`,
      songs: byArtist.get(artist)!,
    }));

    if (songs === this.catalog.songs()) {
      this.artistGroupsCache = groups;
    }

    return groups;
  }

  filterArtistGroups(query: string, groups?: ArtistGroup[]): ArtistGroup[] {
    const all = groups ?? this.groupSongsByArtist();
    const q = normalize(query);
    if (!q) {
      return all;
    }

    return all
      .map((group) => ({
        ...group,
        songs: group.songs.filter((song) => {
          const title = normalize(song.title);
          const songArtist = normalize(song.artist || '');
          const artist = normalize(group.artist);
          return title.includes(q) || songArtist.includes(q) || artist.includes(q);
        }),
      }))
      .filter((group) => group.songs.length > 0);
  }

  filterStatus(query: string, groups: ArtistGroup[]): string {
    const q = normalize(query);
    if (!q) {
      return '';
    }

    const songCount = groups.reduce((count, group) => count + group.songs.length, 0);
    if (songCount === 0) {
      return 'No matching songs.';
    }

    return (
      songCount +
      ' song' +
      (songCount === 1 ? '' : 's') +
      ' · ' +
      groups.length +
      ' artist' +
      (groups.length === 1 ? '' : 's')
    );
  }

  /** JSON payloads consumed by the legacy lyrics browser scripts. */
  songsMetaJson(): string {
    return JSON.stringify(
      this.catalog.songs().map((song) => {
        const row: Record<string, unknown> = {
          title: song.title,
          artist: song.artist,
        };
        if (song.instrument) row['instrument'] = song.instrument;
        if (song.instruments) row['instruments'] = song.instruments;
        if (song.tuning) row['tuning'] = song.tuning;
        if (song.capo != null) row['capo'] = song.capo;
        if (song.tuning_unverified) row['tuning_unverified'] = true;
        return row;
      }),
    );
  }

  songbookSectionsJson(): string {
    return JSON.stringify(
      this.catalog
        .setlists()
        .filter((setlist) => setlist.songbook !== false)
        .map((setlist) => ({
          name: setlist.setlist_name,
          instrument: setlist.instruments?.[0] ?? null,
          titles: setlist.songs.map((song) => song.title),
        })),
    );
  }
}
