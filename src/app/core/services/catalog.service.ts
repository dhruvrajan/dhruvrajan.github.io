import { Injectable, computed, signal } from '@angular/core';
import { EVENTS } from '../../data/events';
import { SETLISTS } from '../../data/setlists';
import { SONGS } from '../../data/songs';
import { VIDEOS } from '../../data/videos';
import { EventItem, Setlist, Song, VideoItem } from '../models/site';

/**
 * Root catalog of site content (events, songs, setlists, videos).
 * Components should depend on this service instead of importing data modules directly.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly eventsState = signal<readonly EventItem[]>(EVENTS as EventItem[]);
  private readonly songsState = signal<readonly Song[]>(SONGS as Song[]);
  private readonly setlistsState = signal<readonly Setlist[]>(SETLISTS as Setlist[]);
  private readonly videosState = signal<readonly VideoItem[]>(VIDEOS as VideoItem[]);

  readonly events = this.eventsState.asReadonly();
  readonly songs = this.songsState.asReadonly();
  readonly setlists = this.setlistsState.asReadonly();
  readonly videos = this.videosState.asReadonly();

  readonly featuredVideo = computed(() => this.videos()[0] ?? null);
  readonly moreVideos = computed(() => this.videos().slice(1));

  findSongByTitle(title: string): Song | undefined {
    return this.songs().find((song) => song.title === title);
  }
}
