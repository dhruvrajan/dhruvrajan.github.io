import { EventItem, Setlist, Song, VideoItem } from '../models/site';
import { EVENTS } from './events';
import { SETLISTS } from './setlists';
import { SONGS } from './songs';
import { VIDEOS } from './videos';

export const events = EVENTS as unknown as EventItem[];
export const setlists = SETLISTS as unknown as Setlist[];
export const songs = SONGS as unknown as Song[];
export const videos = VIDEOS as unknown as VideoItem[];

export function findSongByTitle(title: string): Song | undefined {
  return songs.find((s) => s.title === title);
}
