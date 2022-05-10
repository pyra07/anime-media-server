export type Resolution = "480" | "720" | "1080";
export type status = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED";

/*************************************************************************************** */

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

export interface nextAiringEpisode {
  episode: number;
  id: number;
}

export interface AniTitle {
  romaji: string;
  english: string;
  native: string;
}

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
export interface AniCoverImage {
  extraLarge: string;
  large: string;
  medium: string;
  color: string;
}
export interface AniQuery {
  progress: number;
  mediaId: number;
  media: AniMedia;
}

export interface Command {
  msg: string;
  cmd: Function;
}
