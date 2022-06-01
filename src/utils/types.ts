export type Resolution = "480" | "540" | "720" | "1080";
export type status = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED";

/*************************************************************************************** */
/**
 * @description This contains interfaces and enums used in this application.
 */
/*************************************************************************************** */

// This interface is used to store the torrent information from an anime retrieved in Nyaa.
export interface AnimeTorrent {
  title: string;
  link: string;
  pubDate: string;
  "nyaa:seeders": string;
  content: string;
  contentSnipet: string;
  guid: string;
  isoDate: string;
  episode?: string;
}

// Helper interface for Media. It is used to store the next episode number, and the its ID.
export interface nextAiringEpisode {
  episode: number;
  id: number;
}

// Helper interface for Media. It is used to define the title of the anime. This can be in 3 different forms.
export interface AniTitle {
  romaji: string;
  english: string;
  native: string;
}

// Helper enum for Media. It is used to define the format of anime.
export enum AnimeFormat {
  TV = "TV",
  TV_SHORT = "TV_SHORT",
  OVA = "OVA",
  ONA = "ONA",
  MOVIE = "MOVIE",
  SPECIAL = "SPECIAL",
  MUSIC = "MUSIC",
  MANGA = "MANGA",
  NOVEL = "NOVEL",
  ONE_SHOT = "ONE_SHOT",
}

// Enum which stores which format of anime is being searched for.

export enum SearchMode {
  EPISODE = "EPISODE",
  OVA = "OVA",
  ONA = "ONA",
  MOVIE = "MOVIE",
  BATCH = "BATCH",
  TV_SHORT = "TV_SHORT",
}

// Helper interface for Media. It is used to define the anime's cover art size.
export interface AniCoverImage {
  extraLarge: string;
  large: string;
  medium: string;
  color: string;
}

// The parent of AniMedia. This is what is retrieved from AniList. It contains user progress, and info about the anime itself.
export interface AniQuery {
  progress: number;
  mediaId: number;
  media: AniMedia;
}

// Main interface for the application. It is used to store the entire infromation about the anime.
export interface AniMedia {
  episodes: number;
  format: AnimeFormat;
  status: status;
  endDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
  nextAiringEpisode: nextAiringEpisode | null;
  title: AniTitle;
  synonyms: string[];
  coverImage: AniCoverImage;
}

// For Discord Bot.
export interface Command {
  msg: string;
  cmd: Function;
}

// offline db
export interface OfflineDB {
  [key: string]: OfflineAnime;
}

export class OfflineAnime {
  episodes: Array<number>;
  timeouts: number = 0;
  maxTimeouts: number = 0;

  constructor(episodes: Array<number>) {
    this.episodes = episodes;
  }

  public setTimeout() {
    if (this.maxTimeouts === 50) this.maxTimeouts = 0;
    this.maxTimeouts += 2;
    this.timeouts = this.maxTimeouts;
  }
}
