export interface InstrumentSetup {
  name: string;
  tuning?: string;
  capo?: number;
  unverified?: boolean;
}

export interface Song {
  title: string;
  artist?: string;
  instrument?: string;
  instruments?: InstrumentSetup[];
  tuning?: string;
  capo?: number;
  tuning_unverified?: boolean;
  youtube_link?: string | null;
  soundcloud_link?: string | null;
}

export interface SetlistSong {
  title: string;
}

export interface Setlist {
  setlist_name: string;
  instruments?: string[];
  songs: SetlistSong[];
  songbook?: boolean;
}

export interface EventItem {
  event_name: string;
  date: string;
  location?: string;
}

export interface VideoItem {
  id: string;
}
