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
  episode: string;
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

export interface AniMedia {
  episodes: number;
  status: status;
  endDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
  nextAiringEpisode: nextAiringEpisode | null;
  title: AniTitle;
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
