import { InstrumentSetup, Song } from '../models/site';

function abbreviateInstrument(name: string): string {
  const nm = name.toLowerCase();
  if (nm === 'guitar') return 'Gtr';
  if (nm === 'octave mandolin' || nm === 'mandolin') return 'OM';
  return name;
}

/** Compact tuning/capo string shown beside a song title. */
export function formatSetupCompact(song: Song | null | undefined): string {
  if (!song) return '';

  if (song.instruments && song.instruments.length > 0) {
    if (song.instruments.length === 1) {
      return formatSingleInstrument(song.instruments[0]);
    }
    return song.instruments
      .map((inst) => {
        let piece = abbreviateInstrument(inst.name) + ': ';
        if (inst.tuning) {
          piece += inst.tuning;
          if (inst.unverified) piece += '?';
        }
        if (inst.capo && inst.capo !== 0) {
          if (inst.tuning) piece += ' · ';
          piece += 'Capo ' + inst.capo;
        }
        return piece;
      })
      .join(' · ');
  }

  const bits: string[] = [];
  if (song.tuning) {
    bits.push(song.tuning + (song.tuning_unverified ? '?' : ''));
  }
  if (song.capo && song.capo !== 0) {
    bits.push('Capo ' + song.capo);
  }
  return bits.join(' · ');
}

function formatSingleInstrument(inst: InstrumentSetup): string {
  const bits: string[] = [];
  if (inst.tuning) {
    bits.push(inst.tuning + (inst.unverified ? '?' : ''));
  }
  if (inst.capo && inst.capo !== 0) {
    bits.push('Capo ' + inst.capo);
  }
  return bits.join(' · ');
}

/** Title slug matching the lyrics index rule. */
export function titleSlug(title: string): string {
  return String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function lyricsSongSlug(song: Song): string {
  const artist = song.artist === 'Unknown' || !song.artist ? 'Other' : song.artist;
  return titleSlug(`${song.title}-${artist}`);
}

export function lyricsDeepLink(song: Song): string {
  return `/lyrics#song=${lyricsSongSlug(song)}`;
}

export function songLink(song: Song | undefined): string | null {
  if (!song) return null;
  return song.youtube_link || song.soundcloud_link || null;
}
