import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { findSongByTitle, setlists } from '../../data';
import { Song } from '../../models/site';
import { songLink } from '../../utils/song-setup';

interface ResolvedSetlist {
  name: string;
  instruments?: string[];
  songs: { title: string; song?: Song; href: string | null }[];
}

@Component({
  selector: 'app-setlists',
  imports: [RouterLink],
  templateUrl: './setlists.html',
})
export class SetlistsPage {
  readonly resolved: ResolvedSetlist[] = setlists.map((sl) => ({
    name: sl.setlist_name,
    instruments: sl.instruments,
    songs: sl.songs.map((entry) => {
      const song = findSongByTitle(entry.title);
      return {
        title: entry.title,
        song,
        href: songLink(song),
      };
    }),
  }));
}
